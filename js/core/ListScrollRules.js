/**
 * 責務：図形の一覧の、見えている行の範囲・選択が変わったかの判定・選択の行へのスクロール位置を決める規則。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。importなし。
 */

/**
 * 見えている行の範囲（前後に`overscan`行の余裕を足す）。
 * @param {Object} params
 * @param {number} params.scrollTop - スクロール位置（px）
 * @param {number} params.height - 見えている高さ（px）
 * @param {number} params.rowHeight - 1行の高さ（px）
 * @param {number} params.rowCount - 行数
 * @param {number} [params.overscan=0] - 前後に足す行数
 * @returns {{start: number, end: number}} 行の添字の範囲（`end`は含まない。`0`〜`rowCount`に収める）
 */
export function resolveVisibleRowRange({ scrollTop, height, rowHeight, rowCount, overscan = 0 }) {
    if (!(rowCount > 0) || !(height > 0) || !(rowHeight > 0)) {
        return { start: 0, end: 0 };
    }
    const margin = overscan > 0 ? overscan : 0;
    const top = scrollTop > 0 ? scrollTop : 0;
    const first = Math.floor(top / rowHeight) - margin;
    const last = Math.ceil((top + height) / rowHeight) + margin;
    const end = Math.min(rowCount, Math.max(0, last));
    const start = Math.min(end, Math.max(0, first));
    return { start, end };
}

/**
 * 選択の図形idの集合が変わったかを返す（並びの違いは同じとみなす）。
 * @param {string[]} previousIds - 前の選択（書き換えない）
 * @param {string[]} nextIds - 今の選択（書き換えない）
 * @returns {boolean} 集合として違えば真
 */
export function hasSelectionChanged(previousIds, nextIds) {
    const previous = new Set(previousIds);
    const next = new Set(nextIds);
    if (previous.size !== next.size) {
        return true;
    }
    for (const id of next) {
        if (!previous.has(id)) {
            return true;
        }
    }
    return false;
}

/**
 * 選択の行を見せるためのスクロール位置を決める。
 * 行の中心が見えている範囲（`scrollTop`以上`scrollTop + height`未満）にある行が1つでもあれば`null`（動かさない）。
 * そうでなければ、いちばん上の選ばれている行が全部見える最小の移動（上にあればその行の上端、下にあれば`行の下端 − height`。`rowHeight > height`なら上端）。
 * @param {Object} params
 * @param {number[]} params.selectedIndexes - 選ばれている行の添字
 * @param {number} params.scrollTop - 今のスクロール位置（px）
 * @param {number} params.height - 見えている高さ（px）
 * @param {number} params.rowHeight - 1行の高さ（px）
 * @returns {number|null} 新しいスクロール位置。動かさないなら`null`
 */
export function resolveSelectionScrollTop({ selectedIndexes, scrollTop, height, rowHeight }) {
    if (selectedIndexes.length === 0 || !(height > 0) || !(rowHeight > 0)) {
        return null;
    }
    const isCenterVisible = selectedIndexes.some((index) => {
        const center = (index + 0.5) * rowHeight;
        return center >= scrollTop && center < scrollTop + height;
    });
    if (isCenterVisible) {
        return null;
    }
    const topIndex = Math.min(...selectedIndexes);
    const rowTop = topIndex * rowHeight;
    if (rowTop < scrollTop || rowHeight > height) {
        return rowTop;
    }
    return rowTop + rowHeight - height;
}
