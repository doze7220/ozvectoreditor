/**
 * 責務：右端の図形の一覧の配線（購読・生成・注入と、規則の結果を`model`・パネルへ渡す橋渡し）を担う。
 * 判定・計算の規則は持たず、各規則のモジュールへ渡すだけ。保存しない一時的な値だけを持つ。
 */
import {
    ROW_HOVER_ACTION,
    ROW_PRESS_ACTION,
    buildItemRows,
    isListLocked,
    isOwnHover,
    resolveRowHover,
    resolveRowPressAction
} from '../core/ItemListRules.js';
import { resolveListClickSelection } from '../core/ListSelectionRules.js';
import { hasSelectionChanged, resolveSelectionScrollTop, resolveVisibleRowRange } from '../core/ListScrollRules.js';
import { THUMBNAIL_SIZE_PX, buildThumbnailKey, needsThumbnailRedraw } from '../core/ThumbnailRules.js';
import { drawThumbnail } from '../core/ThumbnailRenderer.js';
import { ItemListPanel } from '../palette/ItemListPanel.js';

/** サムネイルを描く範囲の、見えている行の前後に足す余裕の行数。 */
const THUMBNAIL_OVERSCAN_ROWS = 4;

/**
 * 図形の一覧の配線。生成時にパネルの生成・購読の登録を行い、公開するのはコンストラクタと`sync()`のみ。
 * 一時的な値として、`Shift`＋クリックの起点・自分が出したホバーのid・最後に見た`openCanvasId`だけを持つ（保存しない）。
 */
export class ItemListWiring {
    /** @type {import('../core/VectorModel.js').VectorModel} 図形一式・選択の持ち主 */
    #model;
    /** @type {import('../edit/ShapeExtentReader.js').ShapeExtentReader} 図形1つの外枠の照会 */
    #shapeExtentReader;
    /** @type {ItemListPanel} 一覧のUI部品 */
    #panel;
    /** @type {boolean} 次のフレームでの同期を予約済みか */
    #isSyncRequested = false;
    /** @type {WeakMap<HTMLCanvasElement, string>} サムネイルの`<canvas>`に最後に描いた鍵 */
    #drawnKeys = new WeakMap();
    /** @type {import('../edit/CanvasLibrary.js').CanvasLibrary} キャンバスの状態の照会（ロック中か・開いているキャンバス） */
    #canvasLibrary;
    /** @type {() => string} 操作モードの照会 */
    #getMode;
    /** @type {() => boolean} ドラッグ中（左ドラッグ・パン）かの照会 */
    #isDragging;
    /** @type {() => boolean} スポイトの待ち受け中かの照会 */
    #isPicking;
    /** @type {() => void} 選択ツールへ切り替える */
    #selectSelectTool;
    /** @type {(event: MouseEvent) => boolean} `Ctrl`（`Meta`）が押されているかの読み取り */
    #readCtrlModifier;
    /** @type {string|null} `Shift`＋クリックの範囲の起点の図形id */
    #anchorId = null;
    /** @type {string|null} 自分が出したホバーとして記録している図形id */
    #hoveredRowId = null;
    /** @type {string|null} 最後に見た`openCanvasId` */
    #lastOpenCanvasId = null;

    /**
     * 一覧のパネルを生成し、`model.onChange`・`window`の`resize`・パネルのスクロールで同期を予約する。
     * @param {Object} deps
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式・選択の持ち主
     * @param {import('../edit/ShapeExtentReader.js').ShapeExtentReader} deps.shapeExtentReader - 図形1つの外枠の照会
     * @param {{ isFloatWindowsVisible: () => boolean, onChange: (listener: Function) => void }} deps.displayState - 表示の状態
     * @param {import('../edit/CanvasLibrary.js').CanvasLibrary} deps.canvasLibrary - キャンバスの状態の照会
     * @param {() => string} deps.getMode - 操作モードの照会
     * @param {() => boolean} deps.isDragging - ドラッグ中かの照会
     * @param {() => boolean} deps.isPicking - スポイトの待ち受け中かの照会
     * @param {() => void} deps.selectSelectTool - 選択ツールへ切り替える
     * @param {(event: MouseEvent) => boolean} deps.readCtrlModifier - `Ctrl`（`Meta`）が押されているかの読み取り
     */
    constructor({ model, shapeExtentReader, displayState, canvasLibrary, getMode, isDragging, isPicking, selectSelectTool, readCtrlModifier }) {
        this.#model = model;
        this.#shapeExtentReader = shapeExtentReader;
        this.#canvasLibrary = canvasLibrary;
        this.#getMode = getMode;
        this.#isDragging = isDragging;
        this.#isPicking = isPicking;
        this.#selectSelectTool = selectSelectTool;
        this.#readCtrlModifier = readCtrlModifier;
        this.#lastOpenCanvasId = canvasLibrary.getState().openCanvasId;
        this.#panel = new ItemListPanel(document.getElementById('item-list-panel'), {
            thumbnailSize: THUMBNAIL_SIZE_PX,
            onScroll: () => this.#requestSync(),
            onRowClick: (id, event) => this.#handleRowClick(id, event),
            onRowHover: (id) => this.#handleRowHover(id)
        });
        model.onChange(() => this.#requestSync());
        window.addEventListener('resize', () => this.#requestSync());
        canvasLibrary.onChange(() => {
            const state = canvasLibrary.getState();
            if (state.openCanvasId !== this.#lastOpenCanvasId) {
                this.#lastOpenCanvasId = state.openCanvasId;
                // 図形のidは別のキャンバスと同じ値になり得るため、起点を忘れる
                this.#anchorId = null;
            }
            if (isListLocked(state)) this.#clearOwnHover();
        });
        displayState.onChange(() => {
            if (!displayState.isFloatWindowsVisible()) this.#clearOwnHover();
        });
    }

    /**
     * 一覧の表示を今の`model`に合わせる。行の組み立て（平らにするのは1回）・パネルへの反映・
     * 選択が変わったときのスクロール・見えている行のサムネイルの描画を順に行う。
     * @param {Object} [options]
     * @param {boolean} [options.allowScroll=true] - 偽なら、選択が変わってもスクロールしない
     * @returns {void}
     */
    sync({ allowScroll = true } = {}) {
        const model = this.#model;
        const rows = buildItemRows(model.getItems());
        const selectedIds = rows.filter((row) => model.isSelected(row.id)).map((row) => row.id);
        const previousIds = this.#panel.getSelectedRowIds();
        this.#panel.render(rows.map(({ id, name }) => ({ id, name, selected: model.isSelected(id) })));

        if (allowScroll && hasSelectionChanged(previousIds, selectedIds)) {
            const selectedIndexes = [];
            rows.forEach((row, index) => {
                if (model.isSelected(row.id)) selectedIndexes.push(index);
            });
            const { scrollTop, height, rowHeight } = this.#panel.getViewport();
            const top = resolveSelectionScrollTop({ selectedIndexes, scrollTop, height, rowHeight });
            if (top !== null) this.#panel.setScrollTop(top);
        }

        this.#drawVisibleThumbnails(rows);
    }

    /**
     * 行のクリックを処理する。押したときの判定は`resolveRowPressAction`、次の選択は`resolveListClickSelection`に任せ、
     * 結果を`model`へ渡すだけ。選択の変化は記録しない。
     * @param {string} id - 押した行の図形id
     * @param {MouseEvent} event - クリックのイベント
     * @returns {void}
     */
    #handleRowClick(id, event) {
        const action = resolveRowPressAction({
            mode: this.#getMode(),
            isPicking: this.#isPicking(),
            isDragging: this.#isDragging(),
            isLocked: isListLocked(this.#canvasLibrary.getState())
        });
        if (action === ROW_PRESS_ACTION.NONE) return;

        const model = this.#model;
        const rowIds = buildItemRows(model.getItems()).map((row) => row.id);
        if (!rowIds.includes(id)) return;

        let additive = this.#readCtrlModifier(event);
        let range = event.shiftKey === true;
        if (action === ROW_PRESS_ACTION.SWITCH_AND_SELECT) {
            this.#selectSelectTool();
            // 切り替えの後は修飾キーによらず、ふつうのクリックとして選ぶ
            additive = false;
            range = false;
        }
        const selectedIds = rowIds.filter((rowId) => model.isSelected(rowId));
        const result = resolveListClickSelection({ rowIds, selectedIds, hitId: id, additive, range, anchorId: this.#anchorId });
        model.setSelection(result.ids);
        this.#anchorId = result.anchorId;
        // 表示を先に今の選択へそろえ、予約済みの同期で「選択が変わった」とならないようにする（一覧での選択ではスクロールしない）
        this.sync({ allowScroll: false });
        // 切り替え（setMode）がホバーを消すため、その行のホバーを当て直す
        this.#handleRowHover(id);
    }

    /**
     * 行へのカーソルの出入りを処理する。判定は`resolveRowHover`に任せ、返った値に従って`model`へ反映するだけ。
     * @param {string|null} id - カーソルのある行の図形id（行の無い所・外へ出たときは`null`）
     * @returns {void}
     */
    #handleRowHover(id) {
        const model = this.#model;
        const action = resolveRowHover({
            id,
            hoveredRowId: this.#hoveredRowId,
            hoveredId: model.getHoveredId(),
            isDragging: this.#isDragging(),
            queryLocked: () => isListLocked(this.#canvasLibrary.getState()),
            queryExists: (shapeId) => model.getShapes().some((shape) => shape.id === shapeId)
        });
        if (action === ROW_HOVER_ACTION.RECORD) {
            this.#hoveredRowId = id;
        } else if (action === ROW_HOVER_ACTION.SET) {
            model.setHovered(id);
            this.#hoveredRowId = id;
        } else if (action === ROW_HOVER_ACTION.CLEAR) {
            this.#clearOwnHover();
        }
    }

    /**
     * 自分が出したホバーを消す（キャンバス側が出したホバーは消さない）。記録は常に`null`へ戻す。
     * @returns {void}
     */
    #clearOwnHover() {
        if (isOwnHover(this.#hoveredRowId, this.#model.getHoveredId())) {
            this.#model.clearHovered();
        }
        this.#hoveredRowId = null;
    }

    /**
     * 同期を次のフレームへ予約する（予約済みなら何もしない）。通知のたびに行を組み立てない。
     * @returns {void}
     */
    #requestSync() {
        if (this.#isSyncRequested) return;
        this.#isSyncRequested = true;
        requestAnimationFrame(() => {
            this.#isSyncRequested = false;
            this.sync();
        });
    }

    /**
     * 見えている行（前後に余裕を足す）のサムネイルのうち、図形の今の内容が最後に描いたものと違う行だけ描き直す。
     * @param {Array<{id: string, shape: Object}>} rows - 行（先頭＝いちばん上）
     * @returns {void}
     */
    #drawVisibleThumbnails(rows) {
        const { scrollTop, height, rowHeight } = this.#panel.getViewport();
        const { start, end } = resolveVisibleRowRange({
            scrollTop,
            height,
            rowHeight,
            rowCount: rows.length,
            overscan: THUMBNAIL_OVERSCAN_ROWS
        });
        const pixelRatio = window.devicePixelRatio || 1;
        for (let index = start; index < end; index++) {
            const row = rows[index];
            const canvas = this.#panel.getThumbnailCanvas(row.id);
            if (!canvas) continue;
            const key = buildThumbnailKey(row.shape.toJSON(), pixelRatio);
            if (!needsThumbnailRedraw(this.#drawnKeys.get(canvas), key)) continue;
            drawThumbnail(canvas, row.shape, this.#shapeExtentReader.getShapeBounds(row.shape), pixelRatio);
            this.#drawnKeys.set(canvas, key);
        }
    }
}
