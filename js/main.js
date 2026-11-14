/**
 * 責務：各モジュールの初期化と連携(依存性の注入)を担う。
 */

import { VectorModel } from './core/VectorModel.js';
import { CanvasManager } from './core/CanvasManager.js';
import { RulerRenderer } from './core/RulerRenderer.js';
import { CanvasCursorTracker } from './core/CanvasCursorTracker.js';
import { InputTracker, OperationMode, WHEEL_ZOOM_STEP, hasCtrlModifier } from './core/InputTracker.js';
import { KeyboardShortcuts } from './core/KeyboardShortcuts.js';
import { AltKeyGuard } from './core/AltKeyGuard.js';
import { invertSelection } from './core/SelectionRules.js';
import { WindowManager } from './core/WindowManager.js';
import { ViewTransform } from './core/ViewTransform.js';
import { HistoryManager } from './core/HistoryManager.js';
import { ToolPalette } from './palette/ToolPalette.js';
import { TOOL_IDS, EYEDROPPER_TOOL_ID, resolveActiveTool } from './core/ToolRules.js';
import { SHAPE_TYPES } from './core/ShapeFactory.js';
import { DocumentSerializer } from './io/DocumentSerializer.js';
import { DevPanel } from './palette/DevPanel.js';
import { ShapeInserter } from './edit/ShapeInserter.js';
import { PathJoiner } from './edit/PathJoiner.js';
import { EndpointSnapper } from './edit/EndpointSnapper.js';
import { ClipboardController } from './edit/ClipboardController.js';
import { SnapshotAdapter } from './edit/SnapshotAdapter.js';
import { CanvasStorage } from './io/CanvasStorage.js';
import { CanvasLibrary } from './edit/CanvasLibrary.js';
import { DocumentFileIO } from './io/DocumentFileIO.js';
import { CanvasFileOperations } from './edit/CanvasFileOperations.js';
import { CanvasPalette } from './palette/CanvasPalette.js';
import { PaletteLauncher } from './palette/PaletteLauncher.js';
import { ShapeStyleEditor } from './edit/ShapeStyleEditor.js';
import { StyleEyedropper } from './edit/StyleEyedropper.js';
import { OptionBarStyleGroup } from './palette/OptionBarStyleGroup.js';
import { ShapeOrderEditor } from './edit/ShapeOrderEditor.js';
import { ShapeOrderOperation } from './edit/ShapeOrderRules.js';
import { OptionBarOrderGroup } from './palette/OptionBarOrderGroup.js';
import { ShapeExtentReader } from './edit/ShapeExtentReader.js';
import { formatCursorReadout, formatSizeReadout, formatGridReadout } from './core/StatusReadoutRules.js';
import { computeGridSpacing } from './core/GridSpacingRules.js';
import { computeFitView } from './core/ViewFitRules.js';
import { DisplayState } from './core/DisplayState.js';
import { UnitSnapSettings } from './core/UnitSnapSettings.js';
import { resolveUnitSnapStep, roundPointToUnit } from './core/UnitSnapRules.js';
import { ViewToggleGroup } from './palette/ViewToggleGroup.js';
import { UnitSnapGroup } from './palette/UnitSnapGroup.js';

// DOMが読み込まれた後に初期化を行う
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) {
        console.error('Canvas element not found.');
        return;
    }

    // 1. Model (データ管理)
    const model = new VectorModel();
    
    // 2. View (描画管理)
    const canvasManager = new CanvasManager(canvas);
    // 定規（横・縦の2本。目盛り・数字・カーソル位置の印の描画のみ。描画に使う値は`renderRulers`が渡す）
    const rulerRenderer = new RulerRenderer(document.getElementById('ruler-horizontal'), document.getElementById('ruler-vertical'));

    // 3. ViewTransform (ビュー変換：表示倍率・オフセットの保持とスクリーン⇔ワールド座標変換)
    const viewTransform = new ViewTransform();

    // 3.2. DisplayState (表示の状態：アウトライン表示・背景の白/黒・グリッドの表示・フロートウィンドウの表示。表示専用で保存しない)
    const displayState = new DisplayState();

    // 3.3. UnitSnapSettings (スナップの設定：ON/OFF・単位（1px／グリッド10px）。端点への吸い付きとは別。保存せず、履歴・取り消し/やり直しの対象外)
    // ページを開いたときはON・1px。キャンバスの切り替え・取り消し/やり直し・?devの復元では触れない。
    // inputTrackerの第7引数が照会で参照するため、inputTrackerより前に生成する（コンストラクタは照会を呼ばないが、後に宣言するとデッドゾーンになるのを避ける）
    const unitSnapSettings = new UnitSnapSettings();

    // 3.5. 履歴（取り消し・やり直し）配線
    // スナップショットの取得・適用の実体はSnapshotAdapter（edit/。core/からio/をimportしないため、DocumentSerializerを使う処理はedit/に置く）が持ち、
    // ここではその生成とHistoryManagerへの注入に加えて、取り消し・やり直しの操作関数performUndo/performRedoを置く。
    // 取り消し・やり直しボタンの配線は「// 6.」、?devの復元の履歴への記録はonImportで行う。
    // HistoryManagerはInputTrackerのコンストラクタへ注入するため、InputTrackerより先に生成する。
    // shouldRestoreSelectionの実体：選択モードのときのみ記録時点の選択集合を復元する（選択モード以外では選択集合は空のまま）。
    // 本体で後に`const`宣言される`inputTracker`を参照するが、この関数が呼ばれるのは起動完了後の
    // 取り消し・やり直しの実行時のみで、生成時には呼ばれないため問題ない。
    const snapshotAdapter = new SnapshotAdapter({
        model,
        shouldRestoreSelection: () => inputTracker.getMode() === OperationMode.SELECT
    });

    const historyManager = new HistoryManager({
        capture: () => snapshotAdapter.capture(),
        restore: (snapshot) => snapshotAdapter.restore(snapshot)
    });

    /**
     * 取り消しの操作関数。キーボードショートカット（Ctrl+Z）とツールバーの取り消しボタンの
     * 共通経路であり、受理条件・動作はどちらから呼ばれても同一。
     * (1) ドラッグ中（InputTracker.isDragging()が真）なら何もせずfalse（不受理）。
     * (2) 進行中の入力操作を中断し、作成途中の図形を破棄した場合はそれで終了しtrue（履歴は変化させない。Escと同じ結果。
     *     (1)でドラッグ中でないことを確認済みのため、ここで中断し得るのは作成途中の図形のみ）。
     * (3) それ以外は履歴の取り消しを行いtrue。
     * 戻り値の方針：ドラッグ中でなければ、取り消せる履歴がなくても常にtrue（ブラウザ標準のCtrl+Zを起こさないため）。
     * 本体で後に`const`宣言される`inputTracker`を参照するが、本関数が呼ばれるのは起動完了後のみのため問題ない
     * （8.の注入・6.のボタン登録より前で宣言しており、関数宣言の巻き上げには頼らない）。
     * @returns {boolean} 受理したか（ドラッグ中のみfalse）
     */
    function performUndo() {
        if (inputTracker.isDragging()) {
            return false;
        }
        if (inputTracker.abortOngoingOperation()) {
            return true;
        }
        historyManager.undo();
        return true;
    }

    /**
     * やり直しの操作関数。キーボードショートカット（Ctrl+Y／Ctrl+Shift+Z）とツールバーのやり直しボタンの
     * 共通経路であり、受理条件・動作はどちらから呼ばれても同一。
     * (1) ドラッグ中（InputTracker.isDragging()が真）なら何もせずfalse（不受理）。
     * (2) 進行中の入力操作を中断する（作成途中の図形があれば破棄する。戻り値は使わない）。
     * (3) 履歴のやり直しを行いtrue（やり直せる履歴がなければ(2)の破棄のみ）。
     * 戻り値の方針：ドラッグ中でなければ、やり直せる履歴がなくても常にtrue（ブラウザ標準のCtrl+Y等を起こさないため）。
     * 本体で後に`const`宣言される`inputTracker`を参照するが、本関数が呼ばれるのは起動完了後のみのため問題ない
     * （8.の注入・6.のボタン登録より前で宣言しており、関数宣言の巻き上げには頼らない）。
     * @returns {boolean} 受理したか（ドラッグ中のみfalse）
     */
    function performRedo() {
        if (inputTracker.isDragging()) {
            return false;
        }
        inputTracker.abortOngoingOperation();
        historyManager.redo();
        return true;
    }

    // 4. Controller (入力管理)
    // 端点への吸い付き。規則はshapes/EndpointSnapRules・shapes/PathJoinRules、手順はedit/EndpointSnapperが担い、
    // InputTrackerは注入されたものを呼ぶだけ（core/はedit/をimportしないため、ここで生成して注入する）。
    const endpointSnapper = new EndpointSnapper({
        model,
        editRecorder: historyManager,
        screenLengthToWorld: (length) => viewTransform.screenLengthToWorld(length)
    });
    // スポイトの待ち受けの状態と取り込みの手順（edit/StyleEyedropper。DOM・操作モード・InputTrackerを知らない）。
    // 生成順の制約：InputTrackerのコンストラクタが#updateCursor() → #resolveCursor → isPickingShape()を呼ぶため、
    // inputTrackerより前に生成する（後に宣言すると一時的デッドゾーンでReferenceError）。
    // shapeStyleEditorは後の「// 7.7.」でconst宣言されるが、applyStyleが呼ばれるのは取り込み時（起動完了後）だけで、
    // StyleEyedropperのコンストラクタはapplyStyleを呼ばない（既存のinputTrackerの前方参照と同じ扱い）
    const styleEyedropper = new StyleEyedropper({
        model,
        applyStyle: (style) => shapeStyleEditor.applyStyle(style)
    });
    // 編集操作の記録先（EditRecorder）としてhistoryManagerを、吸い付きの照会と反映としてendpointSnapperを注入する
    // 第6引数は、塗った内側を当たりに含めないかの照会（アウトライン表示の間は含めない）
    // 第7引数は入力の補助：Alt+ドラッグで選択中の図形を複製する補助（実体はclipboardController.duplicateInPlaceWithinEdit()）と、
    // スポイトの待ち受けの照会・クリックした図形の受け渡し（実体はstyleEyedropper。InputTrackerはスポイト・スタイルを知らない）、
    // スナップの刻みの照会（実体はunitSnapSettings.getActiveStep()。ONなら刻み、OFFならnull＝丸めない。InputTrackerはスナップの設定を知らない）
    const inputTracker = new InputTracker(canvas, model, viewTransform, historyManager, endpointSnapper, () => displayState.isOutline(), {
        // clipboardControllerは後の「// 7.5.」でconst宣言されるが、呼ばれるのはAlt+ドラッグ中（起動完了後）だけで、
        // InputTrackerのコンストラクタはduplicateSelectionを呼ばない（既存のinputTrackerの前方参照と同じ扱い）
        duplicateSelection: () => { clipboardController.duplicateInPlaceWithinEdit(); },
        isPickingShape: () => styleEyedropper.isPicking(),
        pickShape: (shapeId) => { styleEyedropper.pickFrom(shapeId); },
        // 今効いているスナップの刻み（number|null）。点を打つとき・図形や頂点を動かすときの丸めに使われ、Ctrlの間の一時無効はInputTracker側で扱う
        getUnitSnapStep: () => unitSnapSettings.getActiveStep(),
    });

    /**
     * Modelの現在の状態（shapes/selectedIds/hoveredId/draftShape/selectionRect/snapPoint）とビュー変換の現在の状態
     * （`viewTransform.getState()`による倍率・オフセットのスナップショット）をCanvasManagerへ渡し、
     * 再描画を要求するローカル関数。表示の状態（`displayState.getState()`のアウトライン表示・背景の白/黒・グリッドの表示）も
     * あわせて渡す。model.onChange・viewTransform.onChange・displayState.onChangeのコールバックと
     * resizeハンドラの4経路から同一の引数構成で呼び出すことで、再描画トリガーの重複定義を避ける。
     */
    function renderCurrentState() {
        const display = displayState.getState();
        canvasManager.render(model.getShapes(), {
            outline: display.outline,
            darkBackground: display.darkBackground,
            showGrid: display.gridVisible,
            selectedIds: model.getSelectedIds(),
            hoveredId: model.getHoveredId(),
            draftShape: model.getDraftShape(),
            selectionRect: model.getSelectionRect(),
            snapPoint: model.getSnapPoint(),
            view: viewTransform.getState()
        });
    }

    // 依存性の注入と連携セットアップ:
    // Modelのデータが変更されたら、Viewに描画を要求する
    model.onChange(renderCurrentState);
    // ビュー変換（パン・ズーム・リセット）が変化したら、同一経路で再描画する
    viewTransform.onChange(renderCurrentState);
    // 表示の状態（アウトライン・背景・グリッド）が変化したら、同一経路で再描画する
    displayState.onChange(renderCurrentState);

    // カーソル位置の追跡（キャンバス上の最後のカーソル位置と、その mousemove で Ctrl が押されていたか。
    // スクリーン座標の求め方・ワールド座標への変換・Ctrl（⌘を含む）の読み取りは既存のものを注入する。座標の表示の丸めの一時無効に使う）
    const cursorTracker = new CanvasCursorTracker(canvas, {
        getScreenPoint: (event) => inputTracker.getScreenCoordinate(event),
        screenToWorld: (x, y) => viewTransform.screenToWorld(x, y),
        readCtrlModifier: hasCtrlModifier
    });

    /**
     * 現在のビュー変換とカーソル位置（スクリーン座標）で、定規（目盛り・数字・カーソル位置の印）を再描画するローカル関数。
     * viewTransform.onChange・cursorTracker.onChange・resizeハンドラから呼ぶ（キャンバスは再描画しない）。
     */
    function renderRulers() {
        rulerRenderer.render({
            view: viewTransform.getState(),
            cursor: cursorTracker.getScreenPosition()
        });
    }
    // ビュー変換（パン・ズーム・リセット）・カーソル位置が変化したら、定規を再描画する
    viewTransform.onChange(renderRulers);
    cursorTracker.onChange(renderRulers);

    // ウィンドウリサイズ時は、まずCanvasManager.resize()でdprの算出と内部バッファサイズの同期を行い
    // （resize()は描画変換を適用しない。dpr × ビュー変換の描画変換はrender()が毎フレーム設定する）、
    // 続いて定規の内部バッファの大きさを同期し（rulerRenderer.resize()。描画はしない）、
    // その直後に最新のModel状態・ビュー変換状態でキャンバスと定規を再描画する（この呼び出し順序を厳守すること）
    window.addEventListener('resize', () => {
        canvasManager.resize();
        rulerRenderer.resize();
        renderCurrentState();
        renderRulers();
    });

    // 5. フロートウィンドウ統治（ドラッグ・最前面化・イベント遮断の一元管理）
    new WindowManager();

    // 6. ツールバー・ステータスバー配線
    // ステータスバーの倍率表示・リセットボタン
    const zoomDisplayEl = document.getElementById('view-zoom-display');
    const viewResetBtn = document.getElementById('view-reset');
    // ツールバーの削除ボタン
    const deleteSelectionBtn = document.getElementById('selection-delete');
    // ツールバーの取り消し・やり直しボタン
    const historyUndoBtn = document.getElementById('history-undo');
    const historyRedoBtn = document.getElementById('history-redo');

    /**
     * ステータスバーの倍率表示（`#view-zoom-display`）を、ViewTransformの現在の倍率に同期する。
     * 倍率は百分率の整数に四捨五入して表示する（例：1.1 → "110%"）。viewTransform.onChangeの
     * コールバックとして登録し、起動時にも明示的に1回呼び出す。表示要素のDOM更新はmain.jsが担い、
     * ViewTransform・CanvasManager・VectorModelはDOMに触れない。
     */
    function syncZoomDisplay() {
        zoomDisplayEl.textContent = `${Math.round(viewTransform.getScale() * 100)}%`;
    }

    // ビュー変換が変化したら倍率表示を更新する（再描画はrenderCurrentStateの登録で別途行われる）
    viewTransform.onChange(syncZoomDisplay);

    /**
     * ビュー変換を初期表示（倍率1.0・ワールド原点がキャンバスの領域（キャンバス要素。ツールバー・定規・ステータスバーを除いた領域）の中心）へ戻す。
     * キャンバス要素の大きさ（CSSピクセル）を使う計算はこの関数（とzoomAtCanvasCenter）に集める。
     * フロートウィンドウに隠れる部分は考慮しない。ウィンドウの大きさ変更には追従しない（呼ばれた時点の大きさのみ使う）。
     * リセットボタン・リセットのショートカット・CanvasLibraryへ注入するresetViewの共通経路。
     * 再描画・倍率表示の更新はviewTransform.onChange経由で行われる。
     */
    function resetViewToCenter() {
        viewTransform.reset(canvas.clientWidth / 2, canvas.clientHeight / 2);
    }

    // リセットボタン：ビュー変換を初期表示（倍率1.0・原点がキャンバス中央）へ戻すのみ。
    // 操作モード・選択集合には触れない（再描画・倍率表示の更新はviewTransform.onChange経由）
    viewResetBtn.addEventListener('click', () => resetViewToCenter());

    /**
     * ツールバーの削除ボタン（`#selection-delete`）の押せる/押せない状態を、Modelの選択集合に
     * 同期する。選択集合が空なら押せない状態（HTMLの`disabled`属性）にする。model.onChangeの
     * コールバックとして登録し、起動時にも明示的に1回呼び出す（通知の有無に依存しない）。
     * ボタンのDOM更新はmain.jsが担い、VectorModel・InputTrackerはDOMに触れない。
     * 選択集合は操作モード切替でクリアされるため、図形作成・キャンバス移動モード中は常に押せない
     * 状態になる（モード別の分岐は不要）。
     */
    function syncDeleteButtonState() {
        deleteSelectionBtn.disabled = model.getSelectedIds().length === 0;
    }

    // 選択集合の変化（選択・選択解除・削除）に応じて削除ボタンの状態を更新する
    model.onChange(syncDeleteButtonState);

    // 削除ボタン：受理条件の判定と削除はinputTracker.deleteSelection()のみが担う
    // （Delete/Backspaceショートカットと同一経路。ここでmodel.deleteShapesを直接呼ばないこと）
    deleteSelectionBtn.addEventListener('click', () => inputTracker.deleteSelection());

    // 結合（選択中の線の結合）。規則はshapes/PathJoinRules、手順はedit/PathJoinerが担い、ここは配線のみ。
    // 端点の重なりの許容距離（画面上のpx）は、結合を行う時点の表示倍率でワールド座標の長さへ換算する
    const pathJoiner = new PathJoiner({
        model,
        editRecorder: historyManager,
        screenLengthToWorld: (length) => viewTransform.screenLengthToWorld(length),
    });
    // ツールバーの結合ボタン
    const joinSelectionBtn = document.getElementById('selection-join');

    /**
     * 選択中の線を結合する。結合ボタンとキー`J`の共通経路（どちらもこの関数のみを呼ぶ）。
     * (1) ドラッグ中（InputTracker.isDragging()が真）なら何もせずfalse（不受理）。ボタンはショートカット以外の
     *     呼び出し元のため、中ボタンのパン中に左クリックで押される場合に備えてここで判定する。
     * (2) それ以外はpathJoiner.join()の結果を返す。
     * @returns {boolean} 結合した場合のみtrue（不受理・結合できない選択ではfalse）
     */
    function performJoin() {
        if (inputTracker.isDragging()) {
            return false;
        }
        return pathJoiner.join();
    }

    /**
     * ツールバーの結合ボタン（`#selection-join`）の押せる/押せない状態を、現在の選択が結合できるか
     * （pathJoiner.canJoin()）に同期する（HTMLの`disabled`属性）。canJoin()は表示倍率を見ない。
     * model.onChangeのコールバックとして登録し、起動時にも明示的に1回呼び出す。ボタンのDOM更新はmain.jsが担う。
     */
    function syncJoinButtonState() {
        joinSelectionBtn.disabled = !pathJoiner.canJoin();
    }

    // 選択集合・図形の変化に応じて結合ボタンの状態を更新する
    model.onChange(syncJoinButtonState);

    // 結合ボタン：受理条件の判定と結合はperformJoin→pathJoiner.join()のみが担う（キー`J`と同一経路）
    joinSelectionBtn.addEventListener('click', () => performJoin());

    /**
     * ツールバーの取り消し・やり直しボタン（`#history-undo`／`#history-redo`）の押せる/押せない状態を
     * 同期する（HTMLの`disabled`属性）。
     * 取り消しボタンは「取り消す履歴がなく、作成途中の図形もない」ときに押せない状態にする
     * （作成途中の図形がある間は、取り消しで破棄できるため押せる）。
     * やり直しボタンは「やり直す履歴がない」ときに押せない状態にする。
     * model.onChange（作成途中の図形の有無の変化）とhistoryManager.onChange（記録・適用・リセット）の
     * 両方のコールバックとして登録し、起動時にも明示的に1回呼び出す。ボタンのDOM更新はmain.jsが担い、
     * HistoryManager・VectorModel・InputTrackerはDOMに触れない。
     */
    function syncHistoryButtonState() {
        historyUndoBtn.disabled = !(historyManager.canUndo() || model.getDraftShape() !== null);
        historyRedoBtn.disabled = !historyManager.canRedo();
    }

    // 作成途中の図形の有無の変化に応じて取り消しボタンの状態を更新する
    model.onChange(syncHistoryButtonState);
    // 履歴の変化（記録・取り消し・やり直し・リセット）に応じて両ボタンの状態を更新する
    historyManager.onChange(syncHistoryButtonState);

    // 取り消し・やり直しボタン：受理条件の判定と実行はperformUndo/performRedoのみが担う
    // （ショートカットと同一経路。ここでhistoryManager.undo()/redo()を直接呼ばないこと）
    historyUndoBtn.addEventListener('click', () => performUndo());
    historyRedoBtn.addEventListener('click', () => performRedo());

    // 6.5. 表示配線（ステータスバーの座標・大きさ・グリッドの表示、表示の切り替えのまとまり（アウトライン・背景・グリッド）、スナップのまとまり（ON/OFF・単位）、パレットを隠す、全体を画面に収める）
    // 外枠の照会（選択中の図形の大きさに使う）
    const shapeExtentReader = new ShapeExtentReader({ model });
    const cursorReadoutEl = document.getElementById('cursor-readout');
    const selectionSizeReadoutEl = document.getElementById('selection-size-readout');
    const gridSizeReadoutEl = document.getElementById('grid-size-readout');

    /**
     * ステータスバーのカーソル位置の座標（`#cursor-readout`）を、最後のカーソル位置から求め直して同期する。
     * cursorTracker.onChange・viewTransform.onChange・unitSnapSettings.onChangeに登録する
     * （ビュー変換・スナップの設定が変わったときも求め直す）。
     * スナップがONで、最後のmousemoveでCtrlが押されていなかったときは、点を打つ位置と同じ規則（resolveUnitSnapStep・roundPointToUnit）で
     * 丸めた値を表示する。丸めるかの判定は規則の関数が持つ（world === nullの分岐は「位置なし」の受け渡し）。
     * 端点への吸い付きの結果は反映しない。定規の印（renderRulers）は丸めないカーソル位置のまま。
     */
    function syncCursorReadout() {
        const world = cursorTracker.getWorldPosition();
        const step = resolveUnitSnapStep(unitSnapSettings.getActiveStep(), cursorTracker.isCtrlPressed());
        cursorReadoutEl.textContent = formatCursorReadout(world === null ? null : roundPointToUnit(world, step));
    }

    /**
     * ステータスバーの選択中の図形の大きさ（`#selection-size-readout`）を同期する。
     * model.onChangeに登録する（ドラッグでの移動・変形の途中も追従する）。
     */
    function syncSelectionSizeReadout() {
        selectionSizeReadoutEl.textContent = formatSizeReadout(shapeExtentReader.getSelectedBounds());
    }

    /**
     * ステータスバーのグリッド1マスの大きさ（`#grid-size-readout`）を、現在の表示倍率から同期する。
     * viewTransform.onChangeに登録する（グリッドを非表示にしている間も表示したまま）。
     */
    function syncGridSizeReadout() {
        gridSizeReadoutEl.textContent = formatGridReadout(computeGridSpacing(viewTransform.getScale()).minor);
    }

    cursorTracker.onChange(syncCursorReadout);
    viewTransform.onChange(syncCursorReadout);
    unitSnapSettings.onChange(syncCursorReadout);
    model.onChange(syncSelectionSizeReadout);
    viewTransform.onChange(syncGridSizeReadout);

    // 表示の切り替えのまとまり（▢◐▦）。表示（押し込みの付け外しと押下の通知）はViewToggleGroup（palette/）が持ち、
    // ここは生成・注入・同期のみを行う。コールバックはキー（Z・X・C）と同じdisplayStateの操作を呼ぶだけで、判定を持たない
    const viewToggleGroup = new ViewToggleGroup(document.getElementById('view-toggle-group'), {
        onToggleOutline: () => displayState.toggleOutline(),
        onToggleBackground: () => displayState.toggleBackground(),
        onToggleGrid: () => displayState.toggleGrid()
    });

    /**
     * ステータスバーの表示の切り替えのまとまり（▢◐▦）の押し込みを、表示の状態（`displayState.getState()`）に同期する
     * （`viewToggleGroup.render`）。displayState.onChangeに登録し、起動時にも明示的に1回呼び出す
     * （キーで切り替えてもボタンの表示が追従する）。DOMの更新はViewToggleGroupが担い、ここは橋渡しのみ。
     */
    function syncViewToggleGroup() {
        viewToggleGroup.render(displayState.getState());
    }

    displayState.onChange(syncViewToggleGroup);

    // スナップのまとまり（🧲・単位のボタン）。表示（ON/OFFの押し込みと単位のボタンの文字・title、押下の通知）はUnitSnapGroup（palette/）が持ち、
    // ここは生成・注入・同期のみを行う。コールバックはunitSnapSettingsの操作を呼ぶだけで、判定を持たない
    const unitSnapGroup = new UnitSnapGroup(document.getElementById('unit-snap-group'), {
        onToggleEnabled: () => unitSnapSettings.toggleEnabled(),
        onToggleUnit: () => unitSnapSettings.toggleUnit()
    });

    /**
     * ステータスバーのスナップのまとまり（🧲・単位のボタン）の表示を、スナップの設定（`unitSnapSettings.getState()`）に同期する
     * （`unitSnapGroup.render`）。unitSnapSettings.onChangeに登録し、起動時にも明示的に1回呼び出す。
     * DOMの更新はUnitSnapGroupが担い、ここは橋渡しのみ。
     */
    function syncUnitSnapGroup() {
        unitSnapGroup.render(unitSnapSettings.getState());
    }

    unitSnapSettings.onChange(syncUnitSnapGroup);

    // フロートウィンドウをまとめて隠す/出す（🧰。キーTabと同じdisplayStateの操作を呼ぶだけで、判定を持たない）
    const floatWindowsToggleBtn = document.getElementById('float-windows-toggle');
    floatWindowsToggleBtn.addEventListener('click', () => displayState.toggleFloatWindows());

    /**
     * フロートウィンドウの表示の状態（`displayState.isFloatWindowsVisible()`）を、`body`のクラス`float-windows-hidden`
     * （index.htmlのCSSがすべての`.float-window`を隠す）と🧰の押し込み（表示中＝押し込み）に同期する。
     * displayState.onChangeに登録し、起動時にも明示的に1回呼び出す（キーで切り替えてもボタンの表示が追従する）。
     */
    function syncFloatWindowVisibility() {
        const visible = displayState.isFloatWindowsVisible();
        document.body.classList.toggle('float-windows-hidden', !visible);
        floatWindowsToggleBtn.classList.toggle('active', visible);
    }

    displayState.onChange(syncFloatWindowVisibility);

    /**
     * 全図形の外枠がキャンバスの領域（キャンバス要素）に余白を空けて収まるよう、表示倍率とオフセットを設定する。
     * 求める規則は`computeFitView`（図形0個のときは表示のリセットと同じ結果）。再描画・倍率表示・定規・座標の表示は
     * viewTransform.onChangeが追従する。⛶（`#view-fit`）のclickからのみ呼ぶ（キーは割り当てない）。
     */
    function fitViewToShapes() {
        const view = computeFitView(
            shapeExtentReader.getAllBounds(),
            canvas.clientWidth,
            canvas.clientHeight,
            { minScale: ViewTransform.MIN_SCALE, maxScale: ViewTransform.MAX_SCALE }
        );
        viewTransform.setView(view.scale, view.offsetX, view.offsetY);
    }

    // 全体を画面に収める（⛶。単独のボタン。🎯と同じく判定を持たない）
    document.getElementById('view-fit').addEventListener('click', () => fitViewToShapes());

    // 7. ツールパレット配線
    // ツールの識別子一覧はToolRulesのTOOL_IDS（選択・キャンバス移動・スポイト・SHAPE_TYPES）。パレットのボタンはid`tool-${toolId}`で照合される
    const toolPalette = new ToolPalette(document.getElementById('window-tool-palette'), TOOL_IDS, (toolId) => selectTool(toolId));

    /**
     * ツールパレットの押し込みの表示を、InputTrackerの現在の操作モード・図形種別・スポイトの待ち受けに同期する。
     * 求める規則はToolRulesのresolveActiveTool。呼ばれる経路は、applyMode・applyShapeTypeの中と、
     * styleEyedropper.onChange（待ち受けの開始・終了（?devの復元でやめる場合を含む）・取り込み。applyMode・applyShapeTypeを通らないため）の2系統だけ。
     */
    function syncToolPalette() {
        toolPalette.setActiveTool(resolveActiveTool(inputTracker.getMode(), inputTracker.getShapeType(), styleEyedropper.isPicking()));
    }

    // スポイトの待ち受けの変化（I・ボタン・Esc・applyModeでのやめる・?devの復元でのやめる・取り込み）のたびに押し込みを同期する。
    // 同期の経路へ足す1つの通知で、キャンバスの再描画はしない
    styleEyedropper.onChange(syncToolPalette);

    /**
     * 操作モードの切り替えを一元的に行う共通関数。ツールパレットの選択・キャンバス移動のボタン
     * （`selectTool`経由の`toolActions`）、図形のツール・数字キー（`selectShapeTool`経由）、
     * キー`V`・`P`・`H`（`KeyboardShortcuts`の`setMode`）、貼り付け・同じ位置に貼り付け・全選択・選択の反転・スポイトの開始
     * （いずれも`ensureSelectMode`経由）、キャンバスの切り替え（`prepareSwitch`）・インポート（`prepareInsert`）、
     * 起動時の初期化から呼び出される。
     * InputTrackerへのモード切り替え要求の後、切替後に`inputTracker.getMode()`・`getShapeType()`で
     * 実際の内部状態を読み返し、`resolveActiveTool`で求めたツールを押し込みにする（未知の値が渡され
     * InputTracker側で無視された場合でも、UI表示と内部状態が乖離しないようにするため）。
     * applyModeを通ったらスポイトの待ち受けは必ずやめる（`styleEyedropper.stop()`）。待ち受け中だったときは
     * stopの通知によるsyncToolPaletteと末尾の呼び出しの2回呼ばれ得るが、同じ結果を設定するだけで害はない。
     * @param {'select'|'create'|'pan'} mode - 切り替え先の操作モード（OperationModeの値）
     */
    function applyMode(mode) {
        inputTracker.setMode(mode);
        styleEyedropper.stop();
        syncToolPalette();
    }

    /**
     * 操作モードが選択モード以外なら、先に`applyMode(OperationMode.SELECT)`で選択モードへ切り替える（すでに選択モードなら何もしない）。
     * 全選択・貼り付け・同じ位置に貼り付け・選択の反転・スポイトの開始が共通に使う前処理（同じ前処理を各所に書かないため）。
     * 判定は現在の操作モードの照会だけで、切り替えは`applyMode`の経路（作成途中の図形の破棄・選択の全解除・押し込みの同期）に任せる。
     */
    function ensureSelectMode() {
        if (inputTracker.getMode() !== OperationMode.SELECT) {
            applyMode(OperationMode.SELECT);
        }
    }

    /**
     * 図形種別の切り替えを一元的に行う共通関数。操作モードは変更しない。
     * InputTrackerへの図形種別切り替え要求の後、切替後に`inputTracker.getMode()`・`getShapeType()`で
     * 実際の内部状態を読み返し、`resolveActiveTool`で求めたツールを押し込みにする
     * （未知の値が無視された場合でもUIと内部状態を一致させるため）。
     * @param {string} type - 切り替え先の図形種別（`SHAPE_TYPES`のいずれか）
     */
    function applyShapeType(type) {
        inputTracker.setShapeType(type);
        syncToolPalette();
    }

    /**
     * 図形のツールを選ぶ。ツールパレットの図形のボタンと数字キーの共通経路。
     * 図形作成モード以外では先に図形作成モードへ切り替えてから、図形種別を切り替える。
     * @param {string} type - 選ぶ図形種別（`SHAPE_TYPES`のいずれか）
     */
    function selectShapeTool(type) {
        if (inputTracker.getMode() !== OperationMode.CREATE) {
            applyMode(OperationMode.CREATE);
        }
        applyShapeType(type);
    }

    /**
     * スポイトの待ち受けを始める（ツールパレットのスポイトのボタンとキー`I`の同一経路。どちらもこの関数を呼ぶ）。
     * 選択モード以外なら先に選択モードへ切り替え（`ensureSelectMode`。待ち受けは切り替えの後に始まる）、
     * 待ち受けを始める。すでに待ち受け中なら何も変わらない。判定は持たない。
     */
    function startEyedropper() {
        ensureSelectMode();
        styleEyedropper.start();
    }

    /**
     * ツールの識別子から操作への対応表。識別子は`TOOL_IDS`と同じ（同じ並び）。
     * 選択・キャンバス移動は`applyMode`、スポイトは`startEyedropper`、図形は`selectShapeTool`の経路を通る。
     * @type {Object<string, function(): void>}
     */
    const toolActions = {
        [OperationMode.SELECT]: () => applyMode(OperationMode.SELECT),
        [OperationMode.PAN]: () => applyMode(OperationMode.PAN),
        [EYEDROPPER_TOOL_ID]: () => startEyedropper(),
        ...Object.fromEntries(SHAPE_TYPES.map((type) => [type, () => selectShapeTool(type)])),
    };

    /**
     * ツールパレットのボタンが押されたときの処理（ToolPaletteへ`onToolSelected`として渡す）。
     * 対応表に無い識別子は無視する（判定ではなく一覧外の識別子に対する防御のみ）。
     * @param {string} toolId - 選ばれたツールの識別子（`TOOL_IDS`のいずれか）
     */
    function selectTool(toolId) {
        const action = toolActions[toolId];
        if (action) {
            action();
        }
    }

    // 7.5. クリップボード（コピー・切り取り・貼り付け・複製）配線
    // 処理本体はedit/の新設クラスが持ち、ここは生成と注入のみを行う。
    // 貼り付け・複製は編集操作の記録先（EditRecorder）としてhistoryManagerを注入する
    const shapeInserter = new ShapeInserter({ model, editRecorder: historyManager });
    // 切り取りの削除は、既存の唯一の削除経路inputTracker.deleteSelection()を注入する（Delete/削除ボタンと同一経路）
    const clipboardController = new ClipboardController({ model, inserter: shapeInserter, deleteSelection: () => inputTracker.deleteSelection() });

    /**
     * 貼り付け系の操作（`Ctrl`+`V`の貼り付け・`Ctrl`+`Shift`+`V`の同じ位置に貼り付け）の共通の前処理。
     * クリップボードが空なら何もしない（操作モードも切り替えない）。空でなければ`ensureSelectMode()`で
     * 選択モードへ切り替えてから、渡された貼り付けの手順を呼ぶ。判定は`isEmpty()`の照会だけで、
     * 貼り付けの中身（ずらし量・追加・選択・記録）は`clipboardController`・`ShapeInserter`が持つ。
     * @param {() => boolean} pasteDocument - 貼り付けの手順（`clipboardController.paste`または`pasteInPlace`の呼び出し）
     * @returns {boolean} 常にtrue（ブラウザ標準の貼り付けを起こさないため）
     */
    function performPaste(pasteDocument) {
        if (clipboardController.isEmpty()) {
            return true;
        }
        ensureSelectMode();
        pasteDocument();
        return true;
    }

    // 7.6. キャンバス管理（キャンバス一覧・自動保存・ファイル操作・キャンバスパレット・呼び出し口）配線
    // 処理本体（起動時の復元・開く・新規作成・名前の変更・削除・切り替え処理・自動保存）はCanvasLibrary（edit/）が、
    // ファイル操作（出力（作業ファイル・エンジン用）・開く（ファイル）・インポート）の組み立てはCanvasFileOperations（edit/）が持ち、
    // ここは生成・注入コールバック・表示の同期・イベントの配線のみを行う。
    // applyMode・viewTransform・historyManagerの生成後であること（切り替え処理の前提）。
    /**
     * 呼び出し口のボタンと開閉式パレットの対応表（PaletteLauncherへ渡す。唯一の定義箇所）。
     * 後続のパレットを追加する場合は、index.htmlのツールバーへ呼び出し口のボタンとパレットのDOM（`hidden`で初期非表示）を
     * 静的に置き、本表へ`{ button, palette }`の1エントリを追加する（PaletteLauncherの変更は不要）。
     * @type {Array<{button: HTMLElement|null, palette: HTMLElement|null}>}
     */
    const paletteLaunchers = [
        { button: document.getElementById('launcher-canvas'), palette: document.getElementById('window-canvas-palette') },
    ];
    // 隠している間の📁は、パレットを出して必ず開く（規則はPaletteLauncherが持ち、ここは照会と「出す」の注入のみ）
    new PaletteLauncher(paletteLaunchers, {
        isFloatWindowsVisible: () => displayState.isFloatWindowsVisible(),
        showFloatWindows: () => displayState.setFloatWindowsVisible(true)
    });

    // 切り替え処理の手順1（進行中の入力操作の中断と選択モードへの切り替え）はapplyModeの経路、
    // ビュー変換の初期表示化はresetViewToCenter()（原点をキャンバス中央へ）を注入する（再描画・UI同期は既存のonChange経路に任せる）
    // confirmOpenUnsavedが使うcanvasPaletteは後でconst宣言されるが、呼ばれるのは起動後の利用者の操作のみ
    // （起動時の#createAndEnterでは呼ばれない）
    const canvasLibrary = new CanvasLibrary({
        storage: new CanvasStorage(),
        model,
        historyManager,
        prepareSwitch: () => applyMode(OperationMode.SELECT),
        resetView: () => resetViewToCenter(),
        confirmOpenUnsaved: () => canvasPalette.confirmOpenUnsaved()
    });

    // ファイル操作（出力（作業ファイル・エンジン用）・開く（ファイル）・インポート）の組み立てはCanvasFileOperationsが持つ。
    // ファイルの読み書きはDocumentFileIOを注入し、インポートの前提（選択モード）はprepareInsertで満たす
    const canvasFileOperations = new CanvasFileOperations({
        fileIO: new DocumentFileIO(),
        canvasLibrary,
        inserter: shapeInserter,
        model,
        prepareInsert: () => applyMode(OperationMode.SELECT)
    });

    // キャンバスパレットの操作は通知をCanvasLibrary／CanvasFileOperationsへ渡すのみ（受理判定は各クラスが行う）
    const canvasPalette = new CanvasPalette(document.getElementById('window-canvas-palette'), {
        onOpen: (id) => canvasLibrary.openCanvas(id),
        onCreate: () => canvasLibrary.createCanvas(),
        onRename: (id, name) => canvasLibrary.renameCanvas(id, name),
        onDelete: (id) => canvasLibrary.deleteCanvas(id),
        onExport: () => canvasFileOperations.exportCanvas(),
        onExportSprite: () => canvasFileOperations.exportSprite(),
        onOpenFile: (file) => canvasFileOperations.openFile(file),
        onImportFile: (file) => canvasFileOperations.importFile(file)
    });

    const canvasNameDisplayEl = document.getElementById('canvas-name-display');
    const canvasLoadingCoverEl = document.getElementById('canvas-loading-cover');

    /**
     * 開いているキャンバスの名前の表示（`#canvas-name-display`）とページのタイトル（`document.title`）を、
     * `canvasLibrary.getState()`に同期する。
     * 読み込み中は「読み込み中…」（タイトルは`OZ Vector Editor`）。`openCanvasName`が`null`のとき
     * （起動時の読み込み中と、開いているキャンバスの記録の削除に成功してから切り替えが完了するまで）も同様に「読み込み中…」と表示する。それ以外は`<キャンバス名> - OZ Vector Editor`とし、
     * 保存の問題があるとき（`hasSaveProblem`）は表示の先頭に`⚠ `を付ける。長い名前は省略表示されるため、
     * 名前全体を`title`属性に設定する。canvasLibrary.onChangeのコールバックとして登録し、起動時にも明示的に1回呼び出す。
     * 表示要素が無ければ表示の更新は行わない（タイトルは更新する）。
     */
    function syncCanvasNameDisplay() {
        const state = canvasLibrary.getState();
        const name = state.openCanvasName;
        const isLoading = state.loading || name === null;
        const label = isLoading ? '読み込み中…' : name;
        if (canvasNameDisplayEl) {
            canvasNameDisplayEl.textContent = (state.hasSaveProblem ? '⚠ ' : '') + label;
            canvasNameDisplayEl.title = isLoading ? '' : name;
        }
        document.title = isLoading ? 'OZ Vector Editor' : `${name} - OZ Vector Editor`;
    }

    /**
     * 読み込み中の覆い要素（`#canvas-loading-cover`）の表示を`canvasLibrary.getState().loading`に同期する
     * （読み込み中なら表示、それ以外は非表示。`hidden`属性の切り替えのみ）。
     * 目的：起動時の読み込み完了まで、キャンバスへのマウス入力（図形作成・選択・ドラッグ・パン・ホイールズーム）を
     * 前面の覆い要素で遮り、読み込み完了時の切り替え処理（図形一式の入れ替え・履歴のリセット）で利用者の操作が消されたり、
     * 別のキャンバスに保存されたりしないようにする。覆い要素はindex.htmlの時点で表示状態で始まる。
     * canvasLibrary.onChangeのコールバックとして登録し、起動時にも明示的に1回呼び出す。要素が無ければ`console.warn`のみ。
     */
    function syncLoadingCover() {
        if (!canvasLoadingCoverEl) {
            console.warn('読み込み中の覆い要素（#canvas-loading-cover）が見つかりません。');
            return;
        }
        canvasLoadingCoverEl.hidden = !canvasLibrary.getState().loading;
    }

    // キャンバス一覧の状態の変化（名前の変更・切り替え・削除・読み込み完了・保存の問題）で表示を直ちに更新する
    canvasLibrary.onChange(syncCanvasNameDisplay);
    canvasLibrary.onChange(syncLoadingCover);
    // パレットの表示同期は、canvasLibrary.onChangeの転送を含むcanvasFileOperations.onChangeの1経路で行う
    canvasFileOperations.onChange(() => canvasPalette.render(canvasFileOperations.getState()));

    // ページ非表示時（タブの切り替え・閉じる・再読み込み）に保留中の自動保存を直ちに確定する
    // （作業データの取得と書き込みの開始はハンドラ内で同期的に行われる）
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            canvasLibrary.flushPendingSave();
        }
    });
    window.addEventListener('pagehide', () => canvasLibrary.flushPendingSave());
    // 保存に失敗した変更など、ページを離れると失われる変更があるときは再読み込み・タブを閉じる前に確認を出す
    window.addEventListener('beforeunload', (event) => {
        if (canvasLibrary.hasUnsavedChanges()) {
            event.preventDefault();
            event.returnValue = true;
        }
    });

    // 7.7. オプションバー（スタイルのまとまり）配線
    // 表示（描き分け・入力値の受け取り）はOptionBarStyleGroup（palette/）が、変更の手順（選択中の図形または
    // 直前に使った値への適用・履歴への記録・色のプレビュー）はShapeStyleEditor（edit/）が持ち、ここは生成・注入・同期のみを行う。
    // 表示の同期はmodel.onChangeのみで行う（機能専用の同期経路は足さない）。
    // まとまりを足すときは、まとまりごとにこのブロックと同じ形のブロックを足す（既存のまとまりの配線は変えない）。
    // コールバックはshapeStyleEditorのメソッドを呼ぶだけで、判定を持たない。
    // inputTracker.isDragging()を見ない理由は開発資料（PROJECT_ARCHITECTURE.md 3章13.）に記載（ここでは判定しない）。
    const shapeStyleEditor = new ShapeStyleEditor({ model, editRecorder: historyManager });
    const optionBarStyleGroup = new OptionBarStyleGroup(document.getElementById('option-style-group'), {
        onStrokeToggle: () => shapeStyleEditor.toggleStrokeEnabled(),
        onFillToggle: () => shapeStyleEditor.toggleFillEnabled(),
        onStrokeWidthChange: (text) => shapeStyleEditor.setStrokeWidth(text),
        onColorInput: (target, color) => shapeStyleEditor.previewColor(target, color),
        onColorChange: (target, color) => shapeStyleEditor.commitColor(target, color),
        onColorEditEnd: () => shapeStyleEditor.finishColorPreview()
    });

    /**
     * オプションバーのスタイルのまとまりの表示を、`shapeStyleEditor.getPanelView()`（選択中の図形、
     * 選択がなければ直前に使った値）に同期する（`optionBarStyleGroup.render`）。
     * model.onChangeのコールバックとして登録し、起動時にも明示的に1回呼び出す。
     * DOMの更新はOptionBarStyleGroupが担い、ここは橋渡しのみ。
     */
    function syncOptionBarStyleGroup() {
        optionBarStyleGroup.render(shapeStyleEditor.getPanelView());
    }

    model.onChange(syncOptionBarStyleGroup);

    // 7.8. オプションバー（重なり順のまとまり）配線
    // 表示（4ボタンの押せる/押せないと押下の通知）はOptionBarOrderGroup（palette/）が、変更の手順（並びを変える1件の
    // 編集操作と各操作で並びが変わるかの照会）はShapeOrderEditor（edit/）が、並べ替えの規則はShapeOrderRules（edit/）が持ち、
    // ここは生成・注入・同期のみを行う。表示の同期はmodel.onChangeのみで行う（機能専用の同期経路は足さない）。
    // まとまりを足すときの形は7.7.と同じ（まとまりごとにUI部品1つとこのブロックと同じ形のブロック1つ。既存のまとまりの配線は変えない）。
    const shapeOrderEditor = new ShapeOrderEditor({ model, editRecorder: historyManager });

    /**
     * 選択中の図形の重なり順を変える。オプションバーの重なり順のボタンとキー（Home/PageUp/PageDown/End）の共通経路
     * （どちらもこの関数のみを呼び、shapeOrderEditor.applyを直接呼ばない）。
     * (1) ドラッグ中（InputTracker.isDragging()が真）なら何もせずfalse（不受理）。ボタンはショートカット以外の
     *     呼び出し元のため、中ボタンのパン中に左クリックで押される場合に備えてここで判定する。
     * (2) それ以外はshapeOrderEditor.apply(operation)の結果を返す。
     * @param {string} operation - ShapeOrderOperationの値
     * @returns {boolean} 並びを変えた場合のみtrue（不受理・並びが変わらない操作ではfalse）
     */
    function performShapeOrder(operation) {
        if (inputTracker.isDragging()) {
            return false;
        }
        return shapeOrderEditor.apply(operation);
    }

    const optionBarOrderGroup = new OptionBarOrderGroup(document.getElementById('option-order-group'), {
        onBringToFront: () => performShapeOrder(ShapeOrderOperation.BRING_TO_FRONT),
        onBringForward: () => performShapeOrder(ShapeOrderOperation.BRING_FORWARD),
        onSendBackward: () => performShapeOrder(ShapeOrderOperation.SEND_BACKWARD),
        onSendToBack: () => performShapeOrder(ShapeOrderOperation.SEND_TO_BACK)
    });

    /**
     * オプションバーの重なり順のまとまりの4ボタンの押せる/押せない状態を、現在の選択と並びで各操作により
     * 並びが変わるか（shapeOrderEditor.getAvailability()）に同期する（optionBarOrderGroup.render）。
     * model.onChangeのコールバックとして登録し、起動時にも明示的に1回呼び出す。DOMの更新はOptionBarOrderGroupが担い、ここは橋渡しのみ。
     */
    function syncOptionBarOrderGroup() {
        optionBarOrderGroup.render(shapeOrderEditor.getAvailability());
    }

    model.onChange(syncOptionBarOrderGroup);

    // 8. キーボードショートカット配線
    /**
     * 表示中キャンバスの中心を基準に、ホイール1刻みと同じ刻み幅（WHEEL_ZOOM_STEP）で拡大・縮小する。
     * ズーム中心はスクリーン座標（キャンバス左上基準のCSSピクセル）で、変換式・クランプは
     * ViewTransform.zoomAtへ委譲する。再描画・倍率表示の更新はviewTransform.onChange経由で行われる。
     * @param {1|-1} direction - 1：拡大、-1：縮小
     */
    function zoomAtCanvasCenter(direction) {
        viewTransform.zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, direction > 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP);
    }

    /**
     * 選択の反転（`Ctrl`+`I`）。`ensureSelectMode()`で選択モードへ切り替えた後、全図形のidと現在の選択から
     * `invertSelection`（SelectionRules）で求めた選択を`model.setSelection`へ渡す。規則の結果をモデルへ渡すだけで
     * 判定を持たない。編集操作として記録しない（選択の変更は履歴の対象外）。InputTrackerへは入れない。
     */
    function performInvertSelection() {
        ensureSelectMode();
        model.setSelection(invertSelection(model.getShapes().map((shape) => shape.id), model.getSelectedIds()));
    }

    // キー→操作の対応表と受理判定はKeyboardShortcutsが担い、操作の実体はここで注入するコールバックが行う。
    // 各コールバックの戻り値はtrue＝受理（KeyboardShortcutsがpreventDefault()する）、false＝受理せず。
    // UI同期は既存経路（applyMode/applyShapeType、viewTransform.onChange、model.onChange）のみを通り、
    // ショートカット専用のUI同期・再描画呼び出しは書かない。
    new KeyboardShortcuts({
        // ドラッグ中（パン・左ドラッグ。閾値以前を含む）か。受理判定専用
        isDragging: () => inputTracker.isDragging(),
        // 操作モード切替（ツールパレットの選択・キャンバス移動のボタンと同一経路）
        setMode: (mode) => {
            applyMode(mode);
            return true;
        },
        // 図形種別切替。図形作成モード以外では先に図形作成モードへ切り替える（ツールパレットの図形のボタンと同一経路）
        setShapeType: (type) => {
            selectShapeTool(type);
            return true;
        },
        // 表示中キャンバスの中心基準で拡大・縮小
        zoomStep: (direction) => {
            zoomAtCanvasCenter(direction);
            return true;
        },
        // ビュー変換のリセット（原点をキャンバス中央へ。リセットボタンと同一。操作モード・選択集合には触れない）
        resetView: () => {
            resetViewToCenter();
            return true;
        },
        // スポイトの待ち受け中は待ち受けだけをやめる（選択は残す。true）。待ち受けでなければ
        // 作成途中の図形の破棄／選択解除（何もしなかった場合はfalse）。判定はstyleEyedropper.cancelPickingが持つ
        cancel: () => styleEyedropper.cancelPicking(() => inputTracker.cancelDraftOrClearSelection()),
        // 全選択。選択モード以外では先に選択モードへ切り替える（ensureSelectMode。共通に使う操作は同関数のJSDoc参照）。
        // 図形0個・非受理でもページ全選択を起こさないよう常にtrueを返す
        selectAll: () => {
            ensureSelectMode();
            inputTracker.selectAll();
            return true;
        },
        // 選択の反転（Ctrl+I）。選択モード以外では先に選択モードへ切り替える（選択は空になるため結果は全選択）。
        // 記録しない。ブラウザ標準の動作（Firefoxのページの情報等）を起こさないよう常にtrueを返す
        invertSelection: () => {
            performInvertSelection();
            return true;
        },
        // 選択集合の削除（削除ボタンと同一経路。受理条件はdeleteSelection()のみが判定する）
        deleteSelection: () => inputTracker.deleteSelection(),
        // 選択中の線の結合（結合ボタンと同一経路。結合した場合のみtrue）
        join: performJoin,
        // 重なり順の変更（ボタンと同一経路。並びを変えた場合のみtrue）
        bringToFront: () => performShapeOrder(ShapeOrderOperation.BRING_TO_FRONT),
        bringForward: () => performShapeOrder(ShapeOrderOperation.BRING_FORWARD),
        sendBackward: () => performShapeOrder(ShapeOrderOperation.SEND_BACKWARD),
        sendToBack: () => performShapeOrder(ShapeOrderOperation.SEND_TO_BACK),
        // 取り消し・やり直し（取り消し・やり直しボタンと同一経路。受理条件はperformUndo/performRedoのみが判定する）
        undo: performUndo,
        redo: performRedo,
        // コピー・切り取り（記録・切り取りした場合のみtrue。何もしなかった場合はページ上の文字の標準のコピー等を妨げない）
        copy: () => clipboardController.copy(),
        cut: () => clipboardController.cut(),
        // 貼り付け。クリップボードが空なら何もしない（モードも切り替えない）。選択モード以外では先に選択モードへ
        // 切り替えてから貼り付ける（作成途中の図形はapplyModeの経路で破棄される）。前処理はperformPaste
        // （同じ位置に貼り付けと共通）。ブラウザ標準の貼り付けを起こさないよう常にtrueを返す
        paste: () => performPaste(() => clipboardController.paste()),
        // 同じ位置に貼り付け（Ctrl+Shift+V）。前処理・戻り値はpasteと同じ（performPaste）。
        // 貼り付けの中身（段数を読まず変えない）はclipboardController.pasteInPlaceが持つ
        pasteInPlace: () => performPaste(() => clipboardController.pasteInPlace()),
        // 複製（選択集合が空でもブラウザ標準のブックマーク追加を起こさないよう常にtrueを返す）
        duplicate: () => {
            clipboardController.duplicate();
            return true;
        },
        // 線を黒・塗りを白にする（D）。選択あり＝選択中の図形へ記録し直前に使った値も更新、選択なし＝直前に使った値だけ。
        // 操作モードは切り替えず、どの状態でも働く。値と判定はshapeStyleEditor.resetColors()が持ち、表示はmodel.onChangeの既存の同期。常にtrue
        resetColors: () => {
            shapeStyleEditor.resetColors();
            return true;
        },
        // 表示の切り替え（ステータスバーの▢◐▦ボタンと同一経路。表示の状態を切り替えるだけで常にtrue。
        // ボタンの押し込みの表示・再描画はdisplayState.onChangeの通知で同期される）
        toggleOutline: () => {
            displayState.toggleOutline();
            return true;
        },
        toggleBackground: () => {
            displayState.toggleBackground();
            return true;
        },
        toggleGrid: () => {
            displayState.toggleGrid();
            return true;
        },
        // フロートウィンドウをまとめて隠す/出す（ツールバーの🧰ボタンと同一経路。常にtrue。
        // bodyのクラス・🧰の押し込みの同期はdisplayState.onChangeの通知で行われる）
        toggleFloatWindows: () => {
            displayState.toggleFloatWindows();
            return true;
        },
        // スポイトの待ち受けを始める（I。ツールパレットのスポイトのボタンと同一経路のstartEyedropper。
        // 選択モード以外では先に選択モードへ切り替える。Ctrl+I（選択の反転）とはctrlの値で別。常にtrue）
        startEyedropper: () => {
            startEyedropper();
            return true;
        },
    });

    // Altキーの単独押下・単独解放でブラウザのメニューへフォーカスが移らないようにする（AltKeyGuardが
    // documentのkeydown・keyupを購読して抑止する）。状態を持たず公開メソッドもないためインスタンスは保持しない。
    // InputTracker・KeyboardShortcutsには入れない（KeyboardShortcutsはkeyupを購読せず、Alt押下中は常に不一致の規則も変えない）
    new AltKeyGuard();

    // 9. 開発者向け確認用ウィンドウ配線（URLに`?dev`がある場合のみ。判定結果はグローバルへ公開しない）
    const isDevMode = new URLSearchParams(window.location.search).has('dev');
    if (isDevMode) {
        const devPanel = new DevPanel(document.getElementById('window-dev-panel'), {
            // 現在の全図形を作業データ形式のJSON文字列へ変換する
            onExport: () => DocumentSerializer.serializeToString(model.getShapes()),
            // JSON文字列から図形一式を復元する。全体の読み込みに失敗した場合はキャンバスを変更しない。
            // 成功時のみ、進行中の入力操作を中断してから図形一式を入れ替える（この順序を厳守すること）。
            // 再描画・削除ボタンの同期はmodel.onChange経路のみで行い、ここでは呼ばない。
            // 復元は1件の編集操作として履歴に記録する（失敗時は記録しない）。中断を先に行うのは、
            // ドラッグ中だった場合にその中断分が先に1件として確定するため（beginEditは必ず中断の後）。
            // 成功時はスポイトの待ち受けもやめる（通常のインポートはapplyModeの経路でやめるが、復元はapplyModeを通らないためここで呼ぶ。
            // 押し込みの同期はstyleEyedropper.onChange経路に任せる）。失敗時は何も変えない
            // 本コールバックから例外を漏らさないこと（DevPanelは捕捉しない）
            // キャンバスの読み込み中（起動時の復元の完了前）は、図形一式・履歴に触れずに失敗として返す
            // （読み込み完了時の切り替え処理で図形一式が入れ替えられ、履歴もリセットされて復元内容が消されるため）
            onImport: (text) => {
                if (canvasLibrary.getState().loading) {
                    return { ok: false, restoredCount: 0, reassignedCount: 0, skipped: [], error: 'キャンバスの読み込み中です' };
                }
                const result = DocumentSerializer.deserializeFromString(text);
                if (!result.ok) {
                    return { ok: false, restoredCount: 0, reassignedCount: 0, skipped: [], error: result.error };
                }
                inputTracker.abortOngoingOperation();
                styleEyedropper.stop();
                historyManager.beginEdit();
                const reassignedCount = model.replaceAllShapes(result.shapes);
                historyManager.commitEdit();
                return { ok: true, restoredCount: result.shapes.length, reassignedCount, skipped: result.skipped, error: null };
            },
        });
        devPanel.show();
    }

    // 起動時初期化：UIの初期表示（ツールパレットの押し込みの表示）を
    // InputTrackerの内部状態に同期させる
    applyMode(OperationMode.SELECT);

    // 起動直後の初回描画を明示的に行う。上記applyModeの経路（setMode → clearSelection）が
    // 無条件にmodel.onChangeを通知するため現状でも描画はされるが、それは副作用への偶然の依存であり、
    // 将来その通知を「値が変化した場合のみ」に最適化すると起動直後に何も描画されなくなる。
    // 初期化の最後に1回描画することで、起動時の表示（背景グリッド等）を通知の有無から独立させる。
    renderCurrentState();

    // 定規も同様に、onChange通知（ビュー変換・カーソル位置）やリサイズに依存させず、起動時に1回描く
    // （カーソル位置は未取得のため印は出ない）
    renderRulers();

    // 倍率表示の初期化も同様に、index.htmlの初期文字列（"100%"）やonChange通知に依存させず、
    // ViewTransformの実値で明示的に1回同期する
    syncZoomDisplay();

    // 座標・大きさ・グリッドの表示も同様に、index.htmlの空の初期状態やonChange通知に依存させず、実値で明示的に1回ずつ同期する
    // （カーソル位置は未取得のため座標は「—」）
    syncCursorReadout();
    syncSelectionSizeReadout();
    syncGridSizeReadout();

    // 表示の切り替えのまとまり（▢◐▦）の押し込みも同様に、index.htmlの初期状態やonChange通知に依存させず、
    // 表示の状態の実値で明示的に1回同期する
    syncViewToggleGroup();

    // スナップのまとまり（🧲・単位のボタン）の押し込み・単位のボタンの文字とtitleも同様に、index.htmlの初期状態
    // （押し込み・文字・titleは書いていない）やonChange通知に依存させず、スナップの設定の実値で明示的に1回同期する
    syncUnitSnapGroup();

    // フロートウィンドウの表示（bodyのクラス・🧰の押し込み）も同様に、index.htmlの初期状態やonChange通知に依存させず、
    // 表示の状態の実値で明示的に1回同期する
    syncFloatWindowVisibility();

    // 削除ボタンの押せる/押せない状態も同様に、index.htmlの初期disabled属性やonChange通知に
    // 依存させず、Modelの選択集合の実値で明示的に1回同期する
    syncDeleteButtonState();

    // 結合ボタンの押せる/押せない状態も削除ボタンと同様に、index.htmlの初期disabled属性やonChange通知に
    // 依存させず、Modelの選択集合の実値で明示的に1回同期する
    syncJoinButtonState();

    // 取り消し・やり直しボタンの押せる/押せない状態も同様に、index.htmlの初期disabled属性やonChange通知に
    // 依存させず、履歴と作成途中の図形の実値で明示的に1回同期する
    syncHistoryButtonState();

    // オプションバーのスタイルのまとまりの表示も同様に、index.htmlの初期状態やonChange通知に依存させず、
    // Modelの選択・直前に使った値の実値で明示的に1回同期する
    syncOptionBarStyleGroup();

    // オプションバーの重なり順のまとまりの4ボタンの押せる/押せない状態も同様に、index.htmlの初期disabled属性や
    // onChange通知に依存させず、選択集合と図形の並びの実値で明示的に1回同期する
    syncOptionBarOrderGroup();

    // キャンバス名の表示・読み込み中の覆い要素・キャンバスパレットも同様に、onChange通知に依存させず
    // 状態の実値で明示的に1回同期する（名前の表示・覆い要素はCanvasLibrary、パレットはCanvasFileOperationsの状態。
    // start()前のloadingは真のため「読み込み中」として表示される）
    syncCanvasNameDisplay();
    syncLoadingCover();
    canvasPalette.render(canvasFileOperations.getState());

    // 最後に開いていたキャンバスを非同期に読み込む（awaitしない。start()はrejectしない）。
    // 読み込み完了時に切り替え処理で図形一式が入り（倍率100%・原点はキャンバス中央・選択モード・履歴は空）、
    // onChange通知で覆い要素が非表示になってキャンバスを操作できるようになる
    canvasLibrary.start();
});
