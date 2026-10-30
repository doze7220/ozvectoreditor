/**
 * 責務：各モジュールの初期化と連携(依存性の注入)を担う。
 */

import { VectorModel } from './core/VectorModel.js';
import { CanvasManager } from './core/CanvasManager.js';
import { InputTracker, OperationMode } from './core/InputTracker.js';
import { WindowManager } from './core/WindowManager.js';
import { ViewTransform } from './core/ViewTransform.js';
import { PaletteController } from './palette/PaletteController.js';

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

    // 4. Controller (入力管理)
    const inputTracker = new InputTracker(canvas, model, viewTransform);

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

    // 7. 図形選択パレット配線
    const shapePaletteEl = document.getElementById('window-shape-palette');
    const paletteController = new PaletteController(shapePaletteEl, applyShapeType);

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
     * として渡され、パレット5ボタンのclick時に呼び出される。操作モードは変更しない。
     * InputTrackerへの図形種別切り替え要求の後、`inputTracker.getShapeType()`で実際の内部状態を
     * 読み返してパレットのハイライトを同期する（未知の値が無視された場合でもUIと内部状態を一致させるため）。
     * @param {'line'|'curve'|'arc'|'rect'|'circle'} type - 切り替え先の図形種別
     */
    function applyShapeType(type) {
        inputTracker.setShapeType(type);
        paletteController.setActiveType(inputTracker.getShapeType());
    }

    Object.entries(modeButtons).forEach(([mode, btn]) => btn.addEventListener('click', () => applyMode(mode)));

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
});
