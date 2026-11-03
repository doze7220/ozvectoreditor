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
    // main.js内で唯一の履歴配線ブロック。スナップショットの取得・適用の実体をここで組み立て、
    // HistoryManagerへ注入する（core/からio/をimportしないため、DocumentSerializerを使う処理はmain.jsが持つ）。
    // HistoryManagerはInputTrackerのコンストラクタへ注入するため、InputTrackerより先に生成する。
    /**
     * 現在の図形一式と選択集合をスナップショットとして取得する（HistoryManagerへ`capture`として注入）。
     * スナップショットは作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）と、
     * その時点の選択集合（図形idの配列）からなる。`serialize`は各図形の`toJSON()`で新しいオブジェクトを作り、
     * `getSelectedIds()`は新しい配列を返すため、図形インスタンス・Modelの内部状態とは共有しない。
     * @returns {{ document: Object, selectedIds: string[] }} スナップショット
     */
    function captureSnapshot() {
        return {
            document: DocumentSerializer.serialize(model.getShapes()),
            selectedIds: model.getSelectedIds()
        };
    }

    /**
     * スナップショットの状態をキャンバスへ適用する（HistoryManagerへ`restore`として注入）。
     * 作業データをデシリアライズし、全体の読み込み失敗またはスキップが1件以上あれば`console.warn`して
     * キャンバスを変更せず`false`を返す（一部の図形だけが戻る中途半端な状態を避けるため）。
     * 成功時は図形一式を入れ替え（idは保持される。選択集合・ホバー・作成中の図形・選択矩形はクリアされる）、
     * 選択モードのときのみ記録時点の選択集合を復元する（存在しないidは`setSelection`が無視する。
     * 選択モード以外では選択集合は空のまま）。
     * 進行中の入力操作の中断は本関数では行わない（呼び出し側＝取り消し・やり直しの操作経路の責務）。
     * 本体で後に`const`宣言される`inputTracker`を参照するが、本関数が呼ばれるのは起動完了後の
     * 取り消し・やり直しの実行時のみで、生成時には呼ばれないため問題ない。
     * @param {{ document: Object, selectedIds: string[] }} snapshot - 適用するスナップショット
     * @returns {boolean} 適用したか（falseならキャンバスは変更されていない）
     */
    function restoreSnapshot(snapshot) {
        const result = DocumentSerializer.deserialize(snapshot.document);
        if (!result.ok || result.skipped.length > 0) {
            console.warn('履歴の適用に失敗したため、キャンバスを変更しません。', result.error, result.skipped);
            return false;
        }
        model.replaceAllShapes(result.shapes);
        if (inputTracker.getMode() === OperationMode.SELECT) {
            model.setSelection(snapshot.selectedIds);
        }
        return true;
    }

    const historyManager = new HistoryManager({ capture: captureSnapshot, restore: restoreSnapshot });

    // 4. Controller (入力管理)
    // 編集操作の記録先（EditRecorder）としてhistoryManagerを注入する
    const inputTracker = new InputTracker(canvas, model, viewTransform, historyManager);

    /**
     * Modelの現在の状態（shapes/selectedIds/hoveredId/draftLine/selectionRect）とビュー変換の現在の状態
     * （`viewTransform.getState()`による倍率・オフセットのスナップショット）をCanvasManagerへ渡し、
     * 再描画を要求するローカル関数。model.onChange・viewTransform.onChangeのコールバックと
     * resizeハンドラの3経路から同一の引数構成で呼び出すことで、再描画トリガーの重複定義を避ける。
     */
    function renderCurrentState() {
        canvasManager.render(model.getShapes(), {
            selectedIds: model.getSelectedIds(),
            hoveredId: model.getHoveredId(),
            draftLine: model.getDraftLine(),
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

    // リセットボタン：ビュー変換を初期状態（倍率1.0・オフセット(0,0)）へ戻すのみ。
    // 操作モード・選択集合には触れない（再描画・倍率表示の更新はviewTransform.onChange経由）
    viewResetBtn.addEventListener('click', () => viewTransform.reset());

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
        // ビュー変換のリセット（リセットボタンと同一。操作モード・選択集合には触れない）
        resetView: () => {
            viewTransform.reset();
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
            onImport: (text) => {
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
});
