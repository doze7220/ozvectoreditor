/**
 * 責務：ステータスバー・表示の切り替え・スナップ・フロートウィンドウ・全体表示の各ボタンと表示の配線
 * （DOMの取得・購読の登録・同期）を担う。判定・計算の規則は持たず、各規則のモジュールへ渡すだけ。
 */
import { ShapeExtentReader } from '../edit/ShapeExtentReader.js';
import { formatCursorReadout, formatSizeReadout, formatGridReadout } from '../core/StatusReadoutRules.js';
import { computeGridSpacing } from '../core/GridSpacingRules.js';
import { computeFitView } from '../core/ViewFitRules.js';
import { resolveUnitSnapStep, roundPointToUnit } from '../core/UnitSnapRules.js';
import { ViewTransform } from '../core/ViewTransform.js';
import { ViewToggleGroup } from '../palette/ViewToggleGroup.js';
import { UnitSnapGroup } from '../palette/UnitSnapGroup.js';

/**
 * 表示の配線。生成時に要素の取得・部品の生成と注入・購読と`click`の登録を行い、
 * 起動時の同期は`syncAll()`で1回行う。公開するのはコンストラクタと`syncAll()`のみ。
 */
export class DisplayWiring {
    /** @type {import('../core/VectorModel.js').VectorModel} onChange・選択中の図形の外枠の照会元 */
    #model;
    /** @type {ViewTransform} 表示倍率・onChange・setViewの持ち主 */
    #viewTransform;
    /** @type {import('../core/DisplayState.js').DisplayState} 表示の状態・各切り替え */
    #displayState;
    /** @type {import('../core/UnitSnapSettings.js').UnitSnapSettings} スナップの設定・各切り替え */
    #unitSnapSettings;
    /** @type {import('../core/CanvasCursorTracker.js').CanvasCursorTracker} カーソル位置・Ctrlの記録 */
    #cursorTracker;
    /** @type {HTMLCanvasElement} キャンバス要素（全体表示の領域の大きさ） */
    #canvas;
    /** @type {ShapeExtentReader} 選択中の図形の外枠の照会 */
    #shapeExtentReader;
    /** @type {HTMLElement} カーソル位置の座標の表示要素 */
    #cursorReadoutEl;
    /** @type {HTMLElement} 選択中の図形の大きさの表示要素 */
    #selectionSizeReadoutEl;
    /** @type {HTMLElement} グリッド1マスの大きさの表示要素 */
    #gridSizeReadoutEl;
    /** @type {ViewToggleGroup} 表示の切り替えのまとまり（▢◐▦） */
    #viewToggleGroup;
    /** @type {UnitSnapGroup} スナップのまとまり（🧲・単位） */
    #unitSnapGroup;
    /** @type {HTMLButtonElement} フロートウィンドウをまとめて隠す/出すボタン */
    #floatWindowsToggleBtn;

    /**
     * 表示の配線を生成し、購読と`click`を登録する（登録の順序は通知の呼ばれる順に効くため変えない）。
     * @param {Object} deps 注入する依存
     * @param {Object} deps.model VectorModel（onChange・選択中の図形の外枠の照会元）
     * @param {Object} deps.viewTransform ViewTransform（表示倍率・onChange・setView）
     * @param {Object} deps.displayState DisplayState（表示の状態・onChange・各切り替え）
     * @param {Object} deps.unitSnapSettings UnitSnapSettings（スナップの設定・onChange・各切り替え）
     * @param {Object} deps.cursorTracker CanvasCursorTracker（カーソル位置・Ctrlの記録・onChange）
     * @param {HTMLCanvasElement} deps.canvas キャンバス要素（全体表示の領域の大きさ）
     */
    constructor({ model, viewTransform, displayState, unitSnapSettings, cursorTracker, canvas }) {
        this.#model = model;
        this.#viewTransform = viewTransform;
        this.#displayState = displayState;
        this.#unitSnapSettings = unitSnapSettings;
        this.#cursorTracker = cursorTracker;
        this.#canvas = canvas;

        // 外枠の照会（選択中の図形の大きさに使う）
        this.#shapeExtentReader = new ShapeExtentReader({ model: this.#model });
        this.#cursorReadoutEl = document.getElementById('cursor-readout');
        this.#selectionSizeReadoutEl = document.getElementById('selection-size-readout');
        this.#gridSizeReadoutEl = document.getElementById('grid-size-readout');

        this.#cursorTracker.onChange(() => this.#syncCursorReadout());
        this.#viewTransform.onChange(() => this.#syncCursorReadout());
        this.#unitSnapSettings.onChange(() => this.#syncCursorReadout());
        this.#model.onChange(() => this.#syncSelectionSizeReadout());
        this.#viewTransform.onChange(() => this.#syncGridSizeReadout());

        // 表示の切り替えのまとまり（▢◐▦）。表示（押し込みの付け外しと押下の通知）はViewToggleGroup（palette/）が持ち、
        // ここは生成・注入・同期のみを行う。コールバックはキー（Z・X・C）と同じdisplayStateの操作を呼ぶだけで、判定を持たない
        this.#viewToggleGroup = new ViewToggleGroup(document.getElementById('view-toggle-group'), {
            onToggleOutline: () => this.#displayState.toggleOutline(),
            onToggleBackground: () => this.#displayState.toggleBackground(),
            onToggleGrid: () => this.#displayState.toggleGrid()
        });
        this.#displayState.onChange(() => this.#syncViewToggleGroup());

        // スナップのまとまり（🧲・単位のボタン）。表示（ON/OFFの押し込みと単位のボタンの文字・title、押下の通知）はUnitSnapGroup（palette/）が持ち、
        // ここは生成・注入・同期のみを行う。コールバックはunitSnapSettingsの操作を呼ぶだけで、判定を持たない
        this.#unitSnapGroup = new UnitSnapGroup(document.getElementById('unit-snap-group'), {
            onToggleEnabled: () => this.#unitSnapSettings.toggleEnabled(),
            onToggleUnit: () => this.#unitSnapSettings.toggleUnit()
        });
        this.#unitSnapSettings.onChange(() => this.#syncUnitSnapGroup());

        // フロートウィンドウをまとめて隠す/出す（🧰。キーTabと同じdisplayStateの操作を呼ぶだけで、判定を持たない）
        this.#floatWindowsToggleBtn = document.getElementById('float-windows-toggle');
        this.#floatWindowsToggleBtn.addEventListener('click', () => this.#displayState.toggleFloatWindows());
        this.#displayState.onChange(() => this.#syncFloatWindowVisibility());

        // 全体を画面に収める（⛶。単独のボタン。🎯と同じく判定を持たない）
        document.getElementById('view-fit').addEventListener('click', () => this.#fitViewToShapes());
    }

    /**
     * 起動時の同期を1回で行う。index.htmlの初期状態やonChange通知に依存させず、実値で明示的に同期する
     * （座標→大きさ→グリッド→表示の切り替え→スナップ→フロートウィンドウの順。カーソル位置は未取得のため座標は「—」）。
     * @returns {void}
     */
    syncAll() {
        this.#syncCursorReadout();
        this.#syncSelectionSizeReadout();
        this.#syncGridSizeReadout();
        this.#syncViewToggleGroup();
        this.#syncUnitSnapGroup();
        this.#syncFloatWindowVisibility();
    }

    /**
     * ステータスバーのカーソル位置の座標（`#cursor-readout`）を、最後のカーソル位置から求め直して同期する。
     * cursorTracker.onChange・viewTransform.onChange・unitSnapSettings.onChangeに登録する
     * （ビュー変換・スナップの設定が変わったときも求め直す）。
     * スナップがONで、最後のmousemoveでCtrlが押されていなかったときは、点を打つ位置と同じ規則（resolveUnitSnapStep・roundPointToUnit）で
     * 丸めた値を表示する。丸めるかの判定は規則の関数が持つ（world === nullの分岐は「位置なし」の受け渡し）。
     * 端点への吸い付きの結果は反映しない。定規の印（renderRulers）は丸めないカーソル位置のまま。
     * @returns {void}
     */
    #syncCursorReadout() {
        const world = this.#cursorTracker.getWorldPosition();
        const step = resolveUnitSnapStep(this.#unitSnapSettings.getActiveStep(), this.#cursorTracker.isCtrlPressed());
        this.#cursorReadoutEl.textContent = formatCursorReadout(world === null ? null : roundPointToUnit(world, step));
    }

    /**
     * ステータスバーの選択中の図形の大きさ（`#selection-size-readout`）を同期する。
     * model.onChangeに登録する（ドラッグでの移動・変形の途中も追従する）。
     * @returns {void}
     */
    #syncSelectionSizeReadout() {
        this.#selectionSizeReadoutEl.textContent = formatSizeReadout(this.#shapeExtentReader.getSelectedBounds());
    }

    /**
     * ステータスバーのグリッド1マスの大きさ（`#grid-size-readout`）を、現在の表示倍率から同期する。
     * viewTransform.onChangeに登録する（グリッドを非表示にしている間も表示したまま）。
     * @returns {void}
     */
    #syncGridSizeReadout() {
        this.#gridSizeReadoutEl.textContent = formatGridReadout(computeGridSpacing(this.#viewTransform.getScale()).minor);
    }

    /**
     * ステータスバーの表示の切り替えのまとまり（▢◐▦）の押し込みを、表示の状態（`displayState.getState()`）に同期する
     * （`viewToggleGroup.render`）。displayState.onChangeに登録し、起動時にも`syncAll()`で1回呼び出す
     * （キーで切り替えてもボタンの表示が追従する）。DOMの更新はViewToggleGroupが担い、ここは橋渡しのみ。
     * @returns {void}
     */
    #syncViewToggleGroup() {
        this.#viewToggleGroup.render(this.#displayState.getState());
    }

    /**
     * ステータスバーのスナップのまとまり（🧲・単位のボタン）の表示を、スナップの設定（`unitSnapSettings.getState()`）に同期する
     * （`unitSnapGroup.render`）。unitSnapSettings.onChangeに登録し、起動時にも`syncAll()`で1回呼び出す。
     * DOMの更新はUnitSnapGroupが担い、ここは橋渡しのみ。
     * @returns {void}
     */
    #syncUnitSnapGroup() {
        this.#unitSnapGroup.render(this.#unitSnapSettings.getState());
    }

    /**
     * フロートウィンドウの表示の状態（`displayState.isFloatWindowsVisible()`）を、`body`のクラス`float-windows-hidden`
     * （index.htmlのCSSがすべての`.float-window`と図形の一覧のパネル`.item-list-panel`を隠し、キャンバスの領域の右端を
     * パネルの幅の分だけ右端まで広げる。広がった領域の大きさへの追従はmain.jsの`resizeAndRenderViews`が行う）と🧰の押し込み（表示中＝押し込み）に同期する。
     * displayState.onChangeに登録し、起動時にも`syncAll()`で1回呼び出す（キーで切り替えてもボタンの表示が追従する）。
     * @returns {void}
     */
    #syncFloatWindowVisibility() {
        const visible = this.#displayState.isFloatWindowsVisible();
        document.body.classList.toggle('float-windows-hidden', !visible);
        this.#floatWindowsToggleBtn.classList.toggle('active', visible);
    }

    /**
     * 見えている図形の外枠がキャンバスの領域（キャンバス要素）に余白を空けて収まるよう、表示倍率とオフセットを設定する。
     * 求める規則は`computeFitView`（図形0個のときは表示のリセットと同じ結果）。再描画・倍率表示・定規・座標の表示は
     * viewTransform.onChangeが追従する。⛶（`#view-fit`）のclickからのみ呼ぶ（キーは割り当てない）。
     * @returns {void}
     */
    #fitViewToShapes() {
        const view = computeFitView(
            this.#shapeExtentReader.getAllBounds(),
            this.#canvas.clientWidth,
            this.#canvas.clientHeight,
            { minScale: ViewTransform.MIN_SCALE, maxScale: ViewTransform.MAX_SCALE }
        );
        this.#viewTransform.setView(view.scale, view.offsetX, view.offsetY);
    }
}
