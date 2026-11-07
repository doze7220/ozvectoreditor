/**
 * 責務：各モジュールの初期化と連携(依存性の注入)を担う。
 */

import { VectorModel } from './core/VectorModel.js';
import { CanvasManager } from './core/CanvasManager.js';
import { InputTracker, OperationMode, WHEEL_ZOOM_STEP } from './core/InputTracker.js';
import { KeyboardShortcuts } from './core/KeyboardShortcuts.js';
import { WindowManager } from './core/WindowManager.js';
import { ViewTransform } from './core/ViewTransform.js';
import { HistoryManager } from './core/HistoryManager.js';
import { PaletteController } from './palette/PaletteController.js';
import { SHAPE_TYPES } from './core/ShapeFactory.js';
import { DocumentSerializer } from './io/DocumentSerializer.js';
import { DevPanel } from './palette/DevPanel.js';
import { ShapeInserter } from './edit/ShapeInserter.js';
import { ClipboardController } from './edit/ClipboardController.js';
import { SnapshotAdapter } from './edit/SnapshotAdapter.js';
import { CanvasStorage } from './io/CanvasStorage.js';
import { CanvasLibrary } from './edit/CanvasLibrary.js';
import { DocumentFileIO } from './io/DocumentFileIO.js';
import { CanvasFileOperations } from './edit/CanvasFileOperations.js';
import { CanvasPalette } from './palette/CanvasPalette.js';
import { PaletteLauncher } from './palette/PaletteLauncher.js';

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
    
    // 3. ViewTransform (ビュー変換：表示倍率・オフセットの保持とスクリーン⇔ワールド座標変換)
    const viewTransform = new ViewTransform();

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
     * 取り消しの操作関数。キーボードショートカット（Ctrl+Z）とコントロールパネルの取り消しボタンの
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
     * やり直しの操作関数。キーボードショートカット（Ctrl+Y／Ctrl+Shift+Z）とコントロールパネルのやり直しボタンの
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
    // 編集操作の記録先（EditRecorder）としてhistoryManagerを注入する
    const inputTracker = new InputTracker(canvas, model, viewTransform, historyManager);

    /**
     * Modelの現在の状態（shapes/selectedIds/hoveredId/draftShape/selectionRect）とビュー変換の現在の状態
     * （`viewTransform.getState()`による倍率・オフセットのスナップショット）をCanvasManagerへ渡し、
     * 再描画を要求するローカル関数。model.onChange・viewTransform.onChangeのコールバックと
     * resizeハンドラの3経路から同一の引数構成で呼び出すことで、再描画トリガーの重複定義を避ける。
     */
    function renderCurrentState() {
        canvasManager.render(model.getShapes(), {
            selectedIds: model.getSelectedIds(),
            hoveredId: model.getHoveredId(),
            draftShape: model.getDraftShape(),
            selectionRect: model.getSelectionRect(),
            view: viewTransform.getState()
        });
    }

    // 依存性の注入と連携セットアップ:
    // Modelのデータが変更されたら、Viewに描画を要求する
    model.onChange(renderCurrentState);
    // ビュー変換（パン・ズーム・リセット）が変化したら、同一経路で再描画する
    viewTransform.onChange(renderCurrentState);

    // ウィンドウリサイズ時は、まずCanvasManager.resize()でdprの算出と内部バッファサイズの同期を行い
    // （resize()は描画変換を適用しない。dpr × ビュー変換の描画変換はrender()が毎フレーム設定する）、
    // その直後に最新のModel状態・ビュー変換状態で再描画する（この呼び出し順序を厳守すること）
    window.addEventListener('resize', () => {
        canvasManager.resize();
        renderCurrentState();
    });

    // 5. フロートウィンドウ統治（ドラッグ・最前面化・イベント遮断の一元管理）
    new WindowManager();

    // 6. フロートパネル（コントロールパネル）配線
    /**
     * コントロールパネルがownする操作モードボタンを、OperationModeの値でマッピングする汎用テーブル。
     * モード追加時は、index.htmlへのボタン追加・InputTrackerのOperationModeへの値追加・
     * 本テーブルへのエントリ追加のみで対応でき、下記のapplyMode本体・クリックリスナー登録ループの
     * 書き換えは一切不要になる（開閉原則）。
     * @type {Object<string, HTMLElement>} キー: OperationModeの値、値: 対応するボタン要素
     */
    const modeButtons = {
        [OperationMode.SELECT]: document.getElementById('mode-select'),
        [OperationMode.CREATE]: document.getElementById('mode-create'),
        [OperationMode.PAN]: document.getElementById('mode-pan'),
    };

    // コントロールパネルの倍率表示・リセットボタン（modeButtonsには含めない：.activeの対象外）
    const zoomDisplayEl = document.getElementById('view-zoom-display');
    const viewResetBtn = document.getElementById('view-reset');
    // コントロールパネルの削除ボタン（modeButtonsには含めない：.activeの対象外）
    const deleteSelectionBtn = document.getElementById('selection-delete');
    // コントロールパネルの取り消し・やり直しボタン（modeButtonsには含めない：.activeの対象外）
    const historyUndoBtn = document.getElementById('history-undo');
    const historyRedoBtn = document.getElementById('history-redo');

    /**
     * コントロールパネルの倍率表示（`#view-zoom-display`）を、ViewTransformの現在の倍率に同期する。
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
     * ビュー変換を初期表示（倍率1.0・ワールド原点がキャンバス要素全体の中心）へ戻す。
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
     * コントロールパネルの削除ボタン（`#selection-delete`）の押せる/押せない状態を、Modelの選択集合に
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

    /**
     * コントロールパネルの取り消し・やり直しボタン（`#history-undo`／`#history-redo`）の押せる/押せない状態を
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

    // 7. 図形選択パレット配線
    const shapePaletteEl = document.getElementById('window-shape-palette');
    // 図形種別一覧は正本（ShapeFactory.js）から直接渡す。パレットのボタンはid`palette-${type}`で照合される
    const paletteController = new PaletteController(shapePaletteEl, SHAPE_TYPES, applyShapeType);

    /**
     * 操作モードの切り替えを一元的に行う共通関数。コントロールパネル各ボタン（`modeButtons`）の
     * clickリスナー、および起動時の初期化から呼び出される。InputTrackerへのモード切り替え要求の後、
     * `inputTracker.getMode()`で実際の内部状態を読み返してから表示を同期する（未知の値が渡され
     * InputTracker側で無視された場合でも、UI表示と内部状態が乖離しないようにするため）。
     * 表示同期として、`modeButtons`を走査する汎用ループによる`.active`の排他的な付け外し、
     * パレットの活性制御（図形作成モードのときのみ活性）、および記憶中の図形種別のハイライトを
     * PaletteControllerへ委譲する。モードごとのif/else分岐は持たない。
     * @param {'select'|'create'|'pan'} mode - 切り替え先の操作モード（OperationModeの値）
     */
    function applyMode(mode) {
        inputTracker.setMode(mode);
        const currentMode = inputTracker.getMode();
        Object.entries(modeButtons).forEach(([key, btn]) => btn.classList.toggle('active', key === currentMode));
        paletteController.setEnabled(currentMode === OperationMode.CREATE);
        paletteController.setActiveType(inputTracker.getShapeType());
    }

    /**
     * 図形種別の切り替えを一元的に行う共通関数。PaletteControllerへ`onTypeSelected`コールバック
     * として渡され、パレットの各図形種別ボタンのclick時に呼び出される。操作モードは変更しない。
     * InputTrackerへの図形種別切り替え要求の後、`inputTracker.getShapeType()`で実際の内部状態を
     * 読み返してパレットのハイライトを同期する（未知の値が無視された場合でもUIと内部状態を一致させるため）。
     * @param {string} type - 切り替え先の図形種別（`SHAPE_TYPES`のいずれか）
     */
    function applyShapeType(type) {
        inputTracker.setShapeType(type);
        paletteController.setActiveType(inputTracker.getShapeType());
    }

    Object.entries(modeButtons).forEach(([mode, btn]) => btn.addEventListener('click', () => applyMode(mode)));

    // 7.5. クリップボード（コピー・切り取り・貼り付け・複製）配線
    // 処理本体はedit/の新設クラスが持ち、ここは生成と注入のみを行う。
    // 貼り付け・複製は編集操作の記録先（EditRecorder）としてhistoryManagerを注入する
    const shapeInserter = new ShapeInserter({ model, editRecorder: historyManager });
    // 切り取りの削除は、既存の唯一の削除経路inputTracker.deleteSelection()を注入する（Delete/削除ボタンと同一経路）
    const clipboardController = new ClipboardController({ model, inserter: shapeInserter, deleteSelection: () => inputTracker.deleteSelection() });

    // 7.6. キャンバス管理（キャンバス一覧・自動保存・ファイル操作・キャンバスパレット・呼び出し口）配線
    // 処理本体（起動時の復元・開く・新規作成・名前の変更・削除・切り替え処理・自動保存）はCanvasLibrary（edit/）が、
    // ファイル操作（出力（作業ファイル・エンジン用）・開く（ファイル）・インポート）の組み立てはCanvasFileOperations（edit/）が持ち、
    // ここは生成・注入コールバック・表示の同期・イベントの配線のみを行う。
    // applyMode・viewTransform・historyManagerの生成後であること（切り替え処理の前提）。
    /**
     * 呼び出し口のボタンと開閉式パレットの対応表（PaletteLauncherへ渡す。唯一の定義箇所）。
     * 後続のパレットを追加する場合は、index.htmlへ呼び出し口のボタンとパレットのDOM（`hidden`で初期非表示）を
     * 静的に置き、本表へ`{ button, palette }`の1エントリを追加する（PaletteLauncherの変更は不要）。
     * @type {Array<{button: HTMLElement|null, palette: HTMLElement|null}>}
     */
    const paletteLaunchers = [
        { button: document.getElementById('launcher-canvas'), palette: document.getElementById('window-canvas-palette') },
    ];
    new PaletteLauncher(paletteLaunchers);

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

    // キー→操作の対応表と受理判定はKeyboardShortcutsが担い、操作の実体はここで注入するコールバックが行う。
    // 各コールバックの戻り値はtrue＝受理（KeyboardShortcutsがpreventDefault()する）、false＝受理せず。
    // UI同期は既存経路（applyMode/applyShapeType、viewTransform.onChange、model.onChange）のみを通り、
    // ショートカット専用のUI同期・再描画呼び出しは書かない。
    new KeyboardShortcuts({
        // ドラッグ中（パン・左ドラッグ。閾値以前を含む）か。受理判定専用
        isDragging: () => inputTracker.isDragging(),
        // 操作モード切替（モードボタンと同一経路）
        setMode: (mode) => {
            applyMode(mode);
            return true;
        },
        // 図形種別切替。図形作成モード以外では先に図形作成モードへ切り替える（パレットと同一経路）
        setShapeType: (type) => {
            if (inputTracker.getMode() !== OperationMode.CREATE) {
                applyMode(OperationMode.CREATE);
            }
            applyShapeType(type);
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
        // 作成途中の図形の破棄／選択解除（何もしなかった場合はfalse）
        cancel: () => inputTracker.cancelDraftOrClearSelection(),
        // 全選択。選択モード以外では先に選択モードへ切り替える。図形0個・非受理でもページ全選択を
        // 起こさないよう常にtrueを返す
        selectAll: () => {
            if (inputTracker.getMode() !== OperationMode.SELECT) {
                applyMode(OperationMode.SELECT);
            }
            inputTracker.selectAll();
            return true;
        },
        // 選択集合の削除（削除ボタンと同一経路。受理条件はdeleteSelection()のみが判定する）
        deleteSelection: () => inputTracker.deleteSelection(),
        // 取り消し・やり直し（取り消し・やり直しボタンと同一経路。受理条件はperformUndo/performRedoのみが判定する）
        undo: performUndo,
        redo: performRedo,
        // コピー・切り取り（記録・切り取りした場合のみtrue。何もしなかった場合はページ上の文字の標準のコピー等を妨げない）
        copy: () => clipboardController.copy(),
        cut: () => clipboardController.cut(),
        // 貼り付け。クリップボードが空なら何もしない（モードも切り替えない）。選択モード以外では先に選択モードへ
        // 切り替えてから貼り付ける（作成途中の図形はapplyModeの経路で破棄される）。ブラウザ標準の貼り付けを
        // 起こさないよう常にtrueを返す
        paste: () => {
            if (clipboardController.isEmpty()) {
                return true;
            }
            if (inputTracker.getMode() !== OperationMode.SELECT) {
                applyMode(OperationMode.SELECT);
            }
            clipboardController.paste();
            return true;
        },
        // 複製（選択集合が空でもブラウザ標準のブックマーク追加を起こさないよう常にtrueを返す）
        duplicate: () => {
            clipboardController.duplicate();
            return true;
        },
    });

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
                historyManager.beginEdit();
                const reassignedCount = model.replaceAllShapes(result.shapes);
                historyManager.commitEdit();
                return { ok: true, restoredCount: result.shapes.length, reassignedCount, skipped: result.skipped, error: null };
            },
        });
        devPanel.show();
    }

    // 起動時初期化：UIの初期表示（モードボタンの.active・パレットの.disabled・パレット内ハイライト）を
    // InputTrackerの内部状態に同期させる
    applyMode(OperationMode.SELECT);

    // 起動直後の初回描画を明示的に行う。上記applyModeの経路（setMode → clearSelection）が
    // 無条件にmodel.onChangeを通知するため現状でも描画はされるが、それは副作用への偶然の依存であり、
    // 将来その通知を「値が変化した場合のみ」に最適化すると起動直後に何も描画されなくなる。
    // 初期化の最後に1回描画することで、起動時の表示（背景グリッド等）を通知の有無から独立させる。
    renderCurrentState();

    // 倍率表示の初期化も同様に、index.htmlの初期文字列（"100%"）やonChange通知に依存させず、
    // ViewTransformの実値で明示的に1回同期する
    syncZoomDisplay();

    // 削除ボタンの押せる/押せない状態も同様に、index.htmlの初期disabled属性やonChange通知に
    // 依存させず、Modelの選択集合の実値で明示的に1回同期する
    syncDeleteButtonState();

    // 取り消し・やり直しボタンの押せる/押せない状態も同様に、index.htmlの初期disabled属性やonChange通知に
    // 依存させず、履歴と作成途中の図形の実値で明示的に1回同期する
    syncHistoryButtonState();

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
