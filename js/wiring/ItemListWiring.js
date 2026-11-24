/**
 * 責務：右端の図形の一覧の配線（購読・生成・注入と、規則の結果を`model`・パネルへ渡す橋渡し）を担う。
 * 判定・計算の規則は持たず、各規則のモジュールへ渡すだけ。保存しない一時的な値だけを持つ。
 */
import { buildItemRows } from '../core/ItemListRules.js';
import { hasSelectionChanged, resolveSelectionScrollTop, resolveVisibleRowRange } from '../core/ListScrollRules.js';
import { THUMBNAIL_SIZE_PX, buildThumbnailKey, needsThumbnailRedraw } from '../core/ThumbnailRules.js';
import { drawThumbnail } from '../core/ThumbnailRenderer.js';
import { ItemListPanel } from '../palette/ItemListPanel.js';

/** サムネイルを描く範囲の、見えている行の前後に足す余裕の行数。 */
const THUMBNAIL_OVERSCAN_ROWS = 4;

/**
 * 図形の一覧の配線。生成時にパネルの生成・購読の登録を行い、公開するのはコンストラクタと`sync()`のみ。
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

    /**
     * 一覧のパネルを生成し、`model.onChange`・`window`の`resize`・パネルのスクロールで同期を予約する。
     * @param {Object} deps
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式・選択の持ち主
     * @param {import('../edit/ShapeExtentReader.js').ShapeExtentReader} deps.shapeExtentReader - 図形1つの外枠の照会
     */
    constructor({ model, shapeExtentReader }) {
        this.#model = model;
        this.#shapeExtentReader = shapeExtentReader;
        this.#panel = new ItemListPanel(document.getElementById('item-list-panel'), {
            thumbnailSize: THUMBNAIL_SIZE_PX,
            onScroll: () => this.#requestSync()
        });
        model.onChange(() => this.#requestSync());
        window.addEventListener('resize', () => this.#requestSync());
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
