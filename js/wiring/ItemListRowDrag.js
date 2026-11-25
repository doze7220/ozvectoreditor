/**
 * 責務：一覧の行のドラッグ（出し入れ・並べ替え）の進行（押下・閾値・移動・離す・取りやめ・自動スクロールの毎フレーム）を担う。
 * 判定・計算は`ListDragRules`へ渡し、結果をパネル・注入された関数へ渡すだけ。図形・選択・履歴・操作モードは知らない。
 */
import { DragTracker } from '../core/DragTracker.js';
import {
    isSameRows,
    resolveAutoScrollTop,
    resolveDraggedRowIds,
    resolveDraggedUnitIds,
    resolveDropPlace,
    resolvePlaceMark
} from '../core/ListDragRules.js';

/** ドラッグが始まったとみなす移動量（px）。キャンバスのドラッグと同じ値。 */
const DRAG_THRESHOLD_PX = 3;

/**
 * 行のドラッグの進行。`DragTracker`を1つ持ち、始まってから終わる（離す・取りやめ）までの控えだけを持つ（保存しない）。
 */
export class ItemListRowDrag {
    /** @type {import('../palette/ItemListPanel.js').ItemListPanel} 一覧のUI部品（動かす行・線の表示、箱の寸法、スクロール） */
    #panel;
    /** @type {() => Array<import('../core/ItemRowRules.js').ItemRow>} 今の見えている行の照会 */
    #getRows;
    /** @type {() => Array<string>} 選んでいるまとまりのid（前順）の照会 */
    #getUnitIds;
    /** @type {(id: string) => boolean} 押した行を選ぶべきかの判定 */
    #shouldSelectPressedRow;
    /** @type {(id: string) => void} 押した行を選ぶ */
    #selectRow;
    /** @type {(draggedIds: Array<string>, place: import('../core/ItemPlaceRules.js').ItemPlace) => boolean} 場所へ入れてよいかの照会 */
    #canDrop;
    /** @type {(draggedIds: Array<string>, place: import('../core/ItemPlaceRules.js').ItemPlace) => boolean} 動かすものを場所へ動かす */
    #applyDrop;
    /** @type {() => void} ドラッグが始まったときの後始末（自分の出したホバーを消す） */
    #onDragStart;
    /** @type {DragTracker} クライアント座標で動くドラッグの進行 */
    #drag = new DragTracker((event) => ({ x: event.clientX, y: event.clientY }));
    /** @type {string|null} 押した行のid（押下から終わりまで） */
    #pressedId = null;
    /** @type {Array<import('../core/ItemRowRules.js').ItemRow>|null} ドラッグが始まった時点の見えている行。`null`なら始まっていない */
    #startRows = null;
    /** @type {string[]} 動かすもののid（選んでいるまとまりの順） */
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
     * @param {() => Array<import('../core/ItemRowRules.js').ItemRow>} deps.getRows - 今の見えている行の照会
     * @param {() => Array<string>} deps.getUnitIds - 選んでいるまとまりのid（前順）の照会
     * @param {(id: string) => boolean} deps.shouldSelectPressedRow - 押した行を選ぶべきかの判定
     * @param {(id: string) => void} deps.selectRow - 押した行を選ぶ
     * @param {(draggedIds: Array<string>, place: import('../core/ItemPlaceRules.js').ItemPlace) => boolean} deps.canDrop - 場所へ入れてよいかの照会
     * @param {(draggedIds: Array<string>, place: import('../core/ItemPlaceRules.js').ItemPlace) => boolean} deps.applyDrop - 動かすものを場所へ動かす
     * @param {() => void} deps.onDragStart - ドラッグが始まったときの後始末
     */
    constructor({ panel, getRows, getUnitIds, shouldSelectPressedRow, selectRow, canDrop, applyDrop, onDragStart }) {
        this.#panel = panel;
        this.#getRows = getRows;
        this.#getUnitIds = getUnitIds;
        this.#shouldSelectPressedRow = shouldSelectPressedRow;
        this.#selectRow = selectRow;
        this.#canDrop = canDrop;
        this.#applyDrop = applyDrop;
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
     * ドラッグが始まっていて、見えている行が始まった時点と違っていれば取りやめる。
     * @returns {void}
     */
    cancelIfRowsChanged() {
        if (this.#startRows === null) return;
        if (!isSameRows(this.#startRows, this.#getRows())) this.cancel();
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
        return this.#startRows !== null && this.#drag.isActive();
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
        if (this.#startRows !== null) this.#updateDropMark();
    }

    /**
     * 閾値を超えたときの処理。見えている行を控え、押した行を選び、動かすものを決めて行を表示し、自動スクロールを始める。
     * @returns {void}
     */
    #handleStart() {
        const pressedId = this.#pressedId;
        const rows = this.#getRows();
        if (pressedId === null || !rows.some((row) => row.id === pressedId)) {
            this.#drag.cancel();
            return;
        }
        this.#startRows = rows;
        this.#onDragStart();
        if (this.#shouldSelectPressedRow(pressedId)) this.#selectRow(pressedId);
        // 選んだ後の選択で、動かすまとまりを決める
        this.#draggedIds = resolveDraggedUnitIds({ unitIds: this.#getUnitIds(), pressedId });
        this.#panel.setDraggedRows(resolveDraggedRowIds({ rows, draggedIds: this.#draggedIds }));
        this.#lastFrameTime = null;
        this.#frameId = requestAnimationFrame((time) => this.#handleFrame(time));
    }

    /**
     * 動くたびの処理。ポインター位置を控え、線を引き直す。
     * @param {MouseEvent} event - `mousemove`のイベント
     * @returns {void}
     */
    #handleMove(event) {
        if (this.#startRows === null) return;
        this.#pointer = { x: event.clientX, y: event.clientY };
        this.#updateDropMark();
    }

    /**
     * 離したときの処理。始まっていなければ何もしない（続くclickは今までどおり）。
     * 後始末を先に行い、行が変わっていず、入れられる場所があれば動かす。
     * @param {MouseEvent} event - 解放とみなしたイベント
     * @returns {void}
     */
    #handleEnd(event) {
        const startRows = this.#startRows;
        if (startRows === null) {
            this.#cleanup();
            return;
        }
        const draggedIds = this.#draggedIds;
        const place = resolveDropPlace({
            pointerX: event.clientX,
            pointerY: event.clientY,
            area: this.#panel.getListArea(),
            rows: startRows
        });
        this.#cleanup();
        if (!isSameRows(startRows, this.#getRows())) return;
        if (place === null || !this.#canDrop(draggedIds, place)) return;
        this.#applyDrop(draggedIds, place);
    }

    /**
     * 自動スクロールの毎フレーム。経過時間から量を求めてスクロールし、線を引き直して次のフレームを予約する。
     * @param {number} time - フレームの時刻（ミリ秒）
     * @returns {void}
     */
    #handleFrame(time) {
        if (this.#startRows === null) return;
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
     * 最後のポインター位置から場所・線を求め、入れられる場所ならパネルへ表示する（入れられないなら消す）。
     * @returns {void}
     */
    #updateDropMark() {
        const rows = this.#startRows;
        if (rows === null || this.#pointer === null) return;
        const place = resolveDropPlace({
            pointerX: this.#pointer.x,
            pointerY: this.#pointer.y,
            area: this.#panel.getListArea(),
            rows
        });
        if (place === null || !this.#canDrop(this.#draggedIds, place)) {
            this.#panel.showDropMark(null);
            return;
        }
        this.#panel.showDropMark(resolvePlaceMark({ rows, place }));
    }

    /**
     * 表示・控え・`requestAnimationFrame`を消す。
     * @returns {void}
     */
    #cleanup() {
        if (this.#frameId !== null) cancelAnimationFrame(this.#frameId);
        this.#frameId = null;
        this.#lastFrameTime = null;
        const wasStarted = this.#startRows !== null;
        this.#startRows = null;
        this.#pressedId = null;
        this.#draggedIds = [];
        this.#pointer = null;
        if (wasStarted) {
            this.#panel.setDraggedRows([]);
            this.#panel.showDropMark(null);
        }
    }
}
