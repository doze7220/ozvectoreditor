/**
 * 責務：一覧の行のドラッグ（並べ替え）の進行（押下・閾値・移動・離す・取りやめ・自動スクロールの毎フレーム）を担う。
 * 判定・計算は`ListDragRules`へ渡し、結果をパネル・注入された関数へ渡すだけ。図形・選択・履歴・操作モードは知らない。
 */
import { DragTracker } from '../core/DragTracker.js';
import {
    isSameOrder,
    reorderRowsForDrop,
    resolveAutoScrollTop,
    resolveDraggedIds,
    resolveDropIndex,
    resolveDropMark,
    toDrawOrder
} from '../core/ListDragRules.js';

/** ドラッグが始まったとみなす移動量（px）。キャンバスのドラッグと同じ値。 */
const DRAG_THRESHOLD_PX = 3;

/**
 * 行のドラッグの進行。`DragTracker`を1つ持ち、始まってから終わる（離す・取りやめ）までの控えだけを持つ（保存しない）。
 */
export class ItemListRowDrag {
    /** @type {import('../palette/ItemListPanel.js').ItemListPanel} 一覧のUI部品（動かす行・線の表示、箱の寸法、スクロール） */
    #panel;
    /** @type {() => string[]} 今の行の並び（上が前面）の照会 */
    #getRowIds;
    /** @type {(id: string) => boolean} 行が選ばれているかの照会 */
    #isSelected;
    /** @type {(id: string) => boolean} 押した行を選ぶべきかの判定 */
    #shouldSelectPressedRow;
    /** @type {(id: string) => void} 押した行を選ぶ */
    #selectRow;
    /** @type {(orderedIds: string[]) => boolean} 並び全体（描画順）を適用する */
    #applyOrder;
    /** @type {() => void} ドラッグが始まったときの後始末（自分の出したホバーを消す） */
    #onDragStart;
    /** @type {DragTracker} クライアント座標で動くドラッグの進行 */
    #drag = new DragTracker((event) => ({ x: event.clientX, y: event.clientY }));
    /** @type {string|null} 押した行のid（押下から終わりまで） */
    #pressedId = null;
    /** @type {string[]|null} ドラッグが始まった時点の行の並び。`null`なら始まっていない */
    #startRowIds = null;
    /** @type {string[]} 動かす行のid（行の並びの順） */
    #draggedIds = [];
    /** @type {{x: number, y: number}|null} 最後のポインター位置（クライアント座標） */
    #pointer = null;
    /** @type {number|null} 自動スクロールの`requestAnimationFrame`のID */
    #frameId = null;
    /** @type {number|null} 前のフレームの時刻（ミリ秒）。まだ無ければ`null` */
    #lastFrameTime = null;

    /**
     * 配線の登録（`window`のcaptureの`mousedown`）を行う。
     * @param {Object} deps
     * @param {import('../palette/ItemListPanel.js').ItemListPanel} deps.panel - 一覧のUI部品
     * @param {() => string[]} deps.getRowIds - 今の行の並び（上が前面）の照会
     * @param {(id: string) => boolean} deps.isSelected - 行が選ばれているかの照会
     * @param {(id: string) => boolean} deps.shouldSelectPressedRow - 押した行を選ぶべきかの判定
     * @param {(id: string) => void} deps.selectRow - 押した行を選ぶ
     * @param {(orderedIds: string[]) => boolean} deps.applyOrder - 並び全体（描画順）を適用する
     * @param {() => void} deps.onDragStart - ドラッグが始まったときの後始末
     */
    constructor({ panel, getRowIds, isSelected, shouldSelectPressedRow, selectRow, applyOrder, onDragStart }) {
        this.#panel = panel;
        this.#getRowIds = getRowIds;
        this.#isSelected = isSelected;
        this.#shouldSelectPressedRow = shouldSelectPressedRow;
        this.#selectRow = selectRow;
        this.#applyOrder = applyOrder;
        this.#onDragStart = onDragStart;
        // 行のドラッグ中は、キャンバスの中ボタンのパン等を始めさせない（InputTrackerへ状態を足さないため、ここで止める）
        window.addEventListener('mousedown', (event) => {
            if (!this.#drag.isActive()) return;
            event.preventDefault();
            event.stopPropagation();
        }, true);
    }

    /**
     * 行の押下を受ける。先にclick抑止の残りを消し、始めてよければドラッグの待ち受けを始める。
     * @param {string} id - 押した行のid
     * @param {MouseEvent} event - `mousedown`のイベント
     * @param {boolean} canStart - ドラッグを始めてよいか（規則の結果）
     * @returns {void}
     */
    press(id, event, canStart) {
        this.#drag.clearSuppressedClick();
        if (!canStart) return;
        this.#pressedId = id;
        const began = this.#drag.begin(event, {
            onStart: () => this.#handleStart(),
            onMove: (moveEvent) => this.#handleMove(moveEvent),
            onEnd: (endEvent) => this.#handleEnd(endEvent),
            onCancel: () => this.#cleanup()
        }, { threshold: DRAG_THRESHOLD_PX, suppressClick: 'whenMoved' });
        if (!began) this.#pressedId = null;
    }

    /**
     * ドラッグを取りやめる（始まる前の押下中を含む）。離したときのclickは1回無視する。
     * @returns {boolean} 取りやめる対象があったら真
     */
    cancel() {
        const wasActive = this.#drag.isActive();
        this.#drag.cancel({ suppressClick: true });
        return wasActive;
    }

    /**
     * ドラッグが始まっていて、行の並びが始まった時点と違っていれば取りやめる。
     * @returns {void}
     */
    cancelIfRowsChanged() {
        if (this.#startRowIds === null) return;
        if (!isSameOrder(this.#startRowIds, this.#getRowIds())) this.cancel();
    }

    /**
     * 押下から（閾値以前を含む）ドラッグ中か。
     * @returns {boolean}
     */
    isActive() {
        return this.#drag.isActive();
    }

    /**
     * 閾値を超えて動き始めた後か。
     * @returns {boolean}
     */
    isMoving() {
        return this.#startRowIds !== null && this.#drag.isActive();
    }

    /**
     * 終わった直後のclickを無視すべきなら、抑止を解いて真を返す。
     * @returns {boolean}
     */
    consumeSuppressedClick() {
        return this.#drag.consumeSuppressedClick();
    }

    /**
     * 一覧がスクロールしたときに、線の位置を今のポインター位置で引き直す。
     * @returns {void}
     */
    refresh() {
        if (this.#startRowIds !== null) this.#updateDropMark();
    }

    /**
     * 閾値を超えたときの処理。行の並びを控え、押した行を選び、動かす行を表示し、自動スクロールを始める。
     * @returns {void}
     */
    #handleStart() {
        const pressedId = this.#pressedId;
        const rowIds = this.#getRowIds();
        if (pressedId === null || !rowIds.includes(pressedId)) {
            this.#drag.cancel();
            return;
        }
        this.#startRowIds = rowIds;
        this.#onDragStart();
        if (this.#shouldSelectPressedRow(pressedId)) this.#selectRow(pressedId);
        const selectedIds = rowIds.filter((rowId) => this.#isSelected(rowId));
        this.#draggedIds = resolveDraggedIds({ rowIds, selectedIds, pressedId });
        this.#panel.setDraggedRows(this.#draggedIds);
        this.#lastFrameTime = null;
        this.#frameId = requestAnimationFrame((time) => this.#handleFrame(time));
    }

    /**
     * 動くたびの処理。ポインター位置を控え、線を引き直す。
     * @param {MouseEvent} event - `mousemove`のイベント
     * @returns {void}
     */
    #handleMove(event) {
        if (this.#startRowIds === null) return;
        this.#pointer = { x: event.clientX, y: event.clientY };
        this.#updateDropMark();
    }

    /**
     * 離したときの処理。始まっていなければ何もしない（続くclickは今までどおり）。
     * 後始末を先に行い、並びが変わっていず、ドロップ位置があれば並びを適用する。
     * @param {MouseEvent} event - 解放とみなしたイベント
     * @returns {void}
     */
    #handleEnd(event) {
        const startRowIds = this.#startRowIds;
        if (startRowIds === null) {
            this.#cleanup();
            return;
        }
        const draggedIds = this.#draggedIds;
        const dropIndex = resolveDropIndex({
            pointerX: event.clientX,
            pointerY: event.clientY,
            area: this.#panel.getListArea(),
            rowCount: startRowIds.length
        });
        this.#cleanup();
        if (!isSameOrder(startRowIds, this.#getRowIds())) return;
        if (dropIndex === null) return;
        this.#applyOrder(toDrawOrder(reorderRowsForDrop({ rowIds: startRowIds, draggedIds, dropIndex })));
    }

    /**
     * 自動スクロールの毎フレーム。経過時間から量を求めてスクロールし、線を引き直して次のフレームを予約する。
     * @param {number} time - フレームの時刻（ミリ秒）
     * @returns {void}
     */
    #handleFrame(time) {
        if (this.#startRowIds === null) return;
        const elapsedMs = this.#lastFrameTime === null ? 0 : time - this.#lastFrameTime;
        this.#lastFrameTime = time;
        if (this.#pointer !== null) {
            const top = resolveAutoScrollTop({
                pointerX: this.#pointer.x,
                pointerY: this.#pointer.y,
                area: this.#panel.getListArea(),
                elapsedMs
            });
            if (top !== null) this.#panel.setScrollTop(top);
            this.#updateDropMark();
        }
        this.#frameId = requestAnimationFrame((nextTime) => this.#handleFrame(nextTime));
    }

    /**
     * 最後のポインター位置からドロップ位置・線を求めてパネルへ表示する。
     * @returns {void}
     */
    #updateDropMark() {
        const rowIds = this.#startRowIds;
        if (rowIds === null || this.#pointer === null) return;
        const dropIndex = resolveDropIndex({
            pointerX: this.#pointer.x,
            pointerY: this.#pointer.y,
            area: this.#panel.getListArea(),
            rowCount: rowIds.length
        });
        this.#panel.showDropMark(resolveDropMark(rowIds, dropIndex));
    }

    /**
     * 表示・控え・`requestAnimationFrame`を消す。
     * @returns {void}
     */
    #cleanup() {
        if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
        this.#frameId = null;
        this.#lastFrameTime = null;
        const wasStarted = this.#startRowIds !== null;
        this.#startRowIds = null;
        this.#pressedId = null;
        this.#draggedIds = [];
        this.#pointer = null;
        if (wasStarted) {
            this.#panel.setDraggedRows([]);
            this.#panel.showDropMark(null);
        }
    }
}
