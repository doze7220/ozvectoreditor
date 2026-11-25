/**
 * 責務：図形の一覧の行のドラッグ（並べ替え）の規則。動かすもの・ドロップ位置（場所）・線と目立たせる行・自動スクロールの量を求める。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。importは`ItemRowRules`（`resolveRowIndent`）・`ItemPlaceRules`（`PLACE_KIND`）・`ItemTreeRules`（`ITEM_KIND`）だけ。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { resolveRowIndent } from './ItemRowRules.js';
import { PLACE_KIND } from './ItemPlaceRules.js';

/** 自動スクロールの帯（一覧の上端・下端からの幅。px）。 */
const AUTO_SCROLL_BAND = 24;
/** 自動スクロールの最小の速さ（px/秒。帯に入った直後）。 */
const AUTO_SCROLL_MIN_SPEED = 90;
/** 自動スクロールの最大の速さ（px/秒。帯の端、または一覧から外れたとき）。 */
const AUTO_SCROLL_MAX_SPEED = 900;
/** 自動スクロールで量を求める経過時間の上限（ms）。 */
const AUTO_SCROLL_MAX_ELAPSED_MS = 50;
/** フォルダの行の「すぐ上」と「中」の境の、行の中の割合。 */
const GROUP_ABOVE_LIMIT = 0.25;
/** フォルダの行の「中」と「その下」の境の、行の中の割合。 */
const GROUP_INSIDE_LIMIT = 0.75;
/** 図形の行の「すぐ上」と「すぐ下」の境の、行の中の割合。 */
const SHAPE_HALF = 0.5;
/** 一番下まで送り切ったとみなす、`maxScrollTop`との差の余裕（px）。 */
const SCROLL_END_TOLERANCE = 1;

/**
 * 一覧の箱の寸法（クライアント座標px）。
 * @typedef {Object} ListArea
 * @property {number} left - 箱の左端
 * @property {number} right - 箱の右端
 * @property {number} top - 箱の上端
 * @property {number} height - 箱の高さ
 * @property {number} scrollTop - 今のスクロール位置
 * @property {number} maxScrollTop - スクロール位置の最大値
 * @property {number} rowHeight - 1行の高さ
 */

/**
 * 線を出す行と、その見せ方。
 * @typedef {Object} PlaceMark
 * @property {string} id - 線を出す（または目立たせる）行のid
 * @property {('before'|'after'|'inside')} edge - 'before'＝行の上、'after'＝行の下、'inside'＝行を目立たせる（線は出さない）
 * @property {number} indent - 線の字下げ（px）。'inside'は0
 */

/**
 * 行のドラッグで動かすまとまりを決める。押した行が選んでいるまとまりにあればその写し（前順）、無ければ押した行だけ。
 * @param {Object} params - 判定の材料
 * @param {Array<string>} params.unitIds - 選んでいるまとまりのid（前順。折りたたまれて行の無いものも含む）
 * @param {string} params.pressedId - 押した行のid
 * @returns {Array<string>} 動かすもののid。新しい配列
 */
export function resolveDraggedUnitIds({ unitIds, pressedId }) {
    if (unitIds.includes(pressedId)) {
        return [...unitIds];
    }
    return [pressedId];
}

/**
 * 行のドラッグでうすく見せる行のidを求める（動かすものの行と、動かすフォルダの中の行）。
 * @param {Object} params - 判定の材料
 * @param {Array<import('./ItemRowRules.js').ItemRow>} params.rows - 見えている行
 * @param {Iterable<string>} params.draggedIds - 動かすもののid
 * @returns {Array<string>} うすく見せる行のid（行の並びの順）
 */
export function resolveDraggedRowIds({ rows, draggedIds }) {
    const dragged = new Set(draggedIds);
    return rows
        .filter((row) => dragged.has(row.id) || row.ancestorIds.some((id) => dragged.has(id)))
        .map((row) => row.id);
}

/**
 * ポインターの位置から、ドロップ位置（入る場所）を求める。
 * 図形の行は上半分が'above'・下半分が'below'。フォルダの行は上の4分の1が'above'、真ん中が'inside'、下の4分の1は、
 * 開いていて中身があれば'inside'、折りたたみ・空なら'below'。最後の行より下の空いている所、および一番下まで送り切って下へ外れたときは
 * いちばん外側の一番下。上下へ外れたときは（送り切った場合を除き）見えている端として扱う。
 * @param {Object} params - 判定の材料
 * @param {number} params.pointerX - ポインターのクライアントX
 * @param {number} params.pointerY - ポインターのクライアントY
 * @param {import('./ListDragRules.js').ListArea} params.area - 一覧の箱の寸法
 * @param {Array<import('./ItemRowRules.js').ItemRow>} params.rows - 始まった時点の見えている行
 * @returns {?import('./ItemPlaceRules.js').ItemPlace} 場所。左右へ外れている・行が無い・寸法が正でないときは null
 */
export function resolveDropPlace({ pointerX, pointerY, area, rows }) {
    if (pointerX < area.left || pointerX > area.right) {
        return null;
    }
    if (rows.length === 0 || !(area.rowHeight > 0) || !(area.height > 0)) {
        return null;
    }
    const bottom = area.top + area.height;
    const clampedY = Math.min(Math.max(pointerY, area.top), bottom);
    const y = clampedY - area.top + area.scrollTop;
    const outsideBottom = { kind: PLACE_KIND.BOTTOM, id: null };
    if (y >= rows.length * area.rowHeight) {
        return outsideBottom;
    }
    if (pointerY >= bottom && area.scrollTop >= area.maxScrollTop - SCROLL_END_TOLERANCE) {
        return outsideBottom;
    }
    const index = Math.floor(y / area.rowHeight);
    const row = rows[index];
    const fraction = y / area.rowHeight - index;
    if (row.kind !== ITEM_KIND.GROUP) {
        return { kind: fraction < SHAPE_HALF ? PLACE_KIND.ABOVE : PLACE_KIND.BELOW, id: row.id };
    }
    if (fraction < GROUP_ABOVE_LIMIT) {
        return { kind: PLACE_KIND.ABOVE, id: row.id };
    }
    if (fraction < GROUP_INSIDE_LIMIT) {
        return { kind: PLACE_KIND.INSIDE, id: row.id };
    }
    const opensDown = !row.collapsed && !row.isEmpty;
    return { kind: opensDown ? PLACE_KIND.INSIDE : PLACE_KIND.BELOW, id: row.id };
}

/**
 * 場所から、線を出す行（または目立たせる行）と見せ方を求める。
 * 'above'＝その行の上の線、'below'＝その行の下の線、'inside'＝その行を目立たせる（字下げ0）、
 * いちばん外側の一番下＝最後の行の下の線（字下げ0）。
 * @param {Object} params - 材料
 * @param {Array<import('./ItemRowRules.js').ItemRow>} params.rows - 見えている行
 * @param {?import('./ItemPlaceRules.js').ItemPlace} params.place - 場所
 * @returns {?PlaceMark} 見せ方。場所が null・行が無い・場所の行が見えていない・フォルダの一番下のときは null
 */
export function resolvePlaceMark({ rows, place }) {
    if (!place || rows.length === 0) {
        return null;
    }
    if (place.kind === PLACE_KIND.BOTTOM) {
        return place.id === null ? { id: rows[rows.length - 1].id, edge: 'after', indent: 0 } : null;
    }
    const row = rows.find((candidate) => candidate.id === place.id);
    if (!row) {
        return null;
    }
    if (place.kind === PLACE_KIND.INSIDE) {
        return { id: row.id, edge: 'inside', indent: 0 };
    }
    const edge = place.kind === PLACE_KIND.ABOVE ? 'before' : 'after';
    return { id: row.id, edge, indent: resolveRowIndent(row.depth) };
}

/**
 * 2つの行の並びが同じかを判定する（並びのidが同じでも、入れ子・折りたたみが変わったら違うとする）。
 * @param {Array<import('./ItemRowRules.js').ItemRow>} a - 行の並び
 * @param {Array<import('./ItemRowRules.js').ItemRow>} b - 行の並び
 * @returns {boolean} 長さも各位置のid・depth・collapsed・isEmptyも同じなら true
 */
export function isSameRows(a, b) {
    return a.length === b.length && a.every((row, i) => {
        const other = b[i];
        return row.id === other.id
            && row.depth === other.depth
            && row.collapsed === other.collapsed
            && row.isEmpty === other.isEmpty;
    });
}

/**
 * 行のドラッグ中の自動スクロールの、新しいスクロール位置を求める。
 * 上端・下端の帯（24px。高さの半分を超えない）に入った深さに応じて90〜900px/秒（外れていれば最大）、経過時間は50msまで。
 * @param {Object} params - 材料
 * @param {number} params.pointerX - ポインターのクライアントX
 * @param {number} params.pointerY - ポインターのクライアントY
 * @param {ListArea} params.area - 一覧の箱の寸法
 * @param {number} params.elapsedMs - 前のフレームからの経過時間（ms）
 * @returns {?number} 新しいスクロール位置。動かさないとき（帯の外・左右へ外れた・寸法が正でない・端で止まる）は null
 */
export function resolveAutoScrollTop({ pointerX, pointerY, area, elapsedMs }) {
    if (pointerX < area.left || pointerX > area.right) {
        return null;
    }
    if (!(area.height > 0) || !(area.maxScrollTop > 0)) {
        return null;
    }
    const band = Math.min(AUTO_SCROLL_BAND, area.height / 2);
    const topEdge = area.top + band;
    const bottomEdge = area.top + area.height - band;
    let direction = 0;
    let depth = 0;
    if (pointerY < topEdge) {
        direction = -1;
        depth = (topEdge - pointerY) / band;
    } else if (pointerY > bottomEdge) {
        direction = 1;
        depth = (pointerY - bottomEdge) / band;
    } else {
        return null;
    }
    depth = Math.min(depth, 1);
    const speed = AUTO_SCROLL_MIN_SPEED + (AUTO_SCROLL_MAX_SPEED - AUTO_SCROLL_MIN_SPEED) * depth;
    const seconds = Math.min(Math.max(elapsedMs, 0), AUTO_SCROLL_MAX_ELAPSED_MS) / 1000;
    const next = Math.min(Math.max(area.scrollTop + direction * speed * seconds, 0), area.maxScrollTop);
    return next === area.scrollTop ? null : next;
}
