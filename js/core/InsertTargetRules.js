/**
 * 責務：新しい図形が入る位置を決める「描き込む先」の決まり方と、一覧の印を出す行の規則。
 * 状態を持たず、DOMにも触れず、importもしない。
 */

/**
 * 変わった後の描き込む先（図形のid。無ければ null）を決める。上から順に最初に当たったものを返す。
 * 1. ids のうち selectedIds にあるものが1つ以上 → その最後（一番上の行）
 * 2. targetId が null → null
 * 3. ids に targetId がある → targetId
 * 4. previousIds の targetId の位置から先頭へ向かってたどり、ids に残っている最初のもの
 * 5. 無い（previousIds にも無い場合を含む） → null
 * 引数は書き換えない。
 * @param {Object} params - 引数
 * @param {string[]} params.previousIds - 変わる前の図形id（描画順）
 * @param {string[]} params.ids - 変わった後の図形id（描画順）
 * @param {Set<string>} params.selectedIds - 変わった後の選択集合
 * @param {string|null} params.targetId - 候補の描き込む先
 * @returns {string|null} 描き込む先の図形id。無ければ null
 */
export function resolveInsertTarget({ previousIds, ids, selectedIds, targetId }) {
    for (let index = ids.length - 1; index >= 0; index -= 1) {
        if (selectedIds.has(ids[index])) {
            return ids[index];
        }
    }
    if (targetId === null || targetId === undefined) {
        return null;
    }
    if (ids.includes(targetId)) {
        return targetId;
    }
    const remaining = new Set(ids);
    for (let index = previousIds.indexOf(targetId) - 1; index >= 0; index -= 1) {
        if (remaining.has(previousIds[index])) {
            return previousIds[index];
        }
    }
    return null;
}

/**
 * 一覧で印を出す行のid を決める。選択が1つ以上なら出さない（選ばれた行の見た目が優先）。
 * @param {Object} params - 引数
 * @param {number} params.selectedCount - 選択されている図形の数
 * @param {string|null} params.insertTargetId - 描き込む先の図形id
 * @returns {string|null} 印を出す行のid。出さないなら null
 */
export function resolveInsertMarkId({ selectedCount, insertTargetId }) {
    if (selectedCount > 0) {
        return null;
    }
    return insertTargetId ?? null;
}
