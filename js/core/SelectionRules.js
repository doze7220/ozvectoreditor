/**
 * 責務: クリック・範囲選択の次の選択と、選択の反転の結果を、状態を持たない関数として提供する。
 * 引数を書き換えず新しい配列を返す。importなし・DOMなし。
 */

/**
 * 選択の変更の指示。`VectorModel`への受け渡しの形を区別するために使う。
 * - `{ type: 'set', ids }`：`setSelection(ids)`へ渡す（置き換え）。
 * - `{ type: 'clear' }`：`clearSelection()`を呼ぶ（全解除）。
 * - `null`：何もしない。
 * @typedef {({type: 'set', ids: string[]} | {type: 'clear'} | null)} SelectionChange
 */

/**
 * クリックで当たった図形から、次の選択の変更を決める。
 * `additive`が偽のときの結果は、従来の`InputTracker`の呼び出し（`setSelection([bodyId])`／選択が空でないときだけ`clearSelection()`／何もしない）と1対1で一致する。
 * `additive`が真のとき、空白は解除しない。当たった図形が選択中なら外し、未選択なら末尾へ追加する。
 * @param {string[]} selectedIds 現在の選択中の図形id（書き換えない）
 * @param {string|null} hitId クリックした位置の図形本体のid（空白ならnull）
 * @param {boolean} additive 追加・解除モードか（`Ctrl`押下）
 * @returns {SelectionChange} 選択の変更（新しい配列を含む）
 */
export function resolveClickSelection(selectedIds, hitId, additive) {
    if (!additive) {
        if (hitId) {
            return { type: 'set', ids: [hitId] };
        }
        return selectedIds.length > 0 ? { type: 'clear' } : null;
    }
    if (!hitId) {
        return null;
    }
    if (selectedIds.includes(hitId)) {
        return { type: 'set', ids: selectedIds.filter((id) => id !== hitId) };
    }
    return { type: 'set', ids: [...selectedIds, hitId] };
}

/**
 * 範囲選択で当たった図形から、次の選択の変更を決める。
 * `additive`が偽のときは当たった図形で置き換える（0件でも`set([])`。従来の`setSelection(ids)`と同じ）。
 * `additive`が真のときは既存の選択へ未選択のものだけを足す（重複しない）。0件なら何もしない。
 * @param {string[]} selectedIds 現在の選択中の図形id（書き換えない）
 * @param {string[]} hitIds 範囲に当たった図形id（書き換えない）
 * @param {boolean} additive 追加モードか（`Ctrl`押下）
 * @returns {SelectionChange} 選択の変更（新しい配列を含む）
 */
export function resolveMarqueeSelection(selectedIds, hitIds, additive) {
    if (!additive) {
        return { type: 'set', ids: [...hitIds] };
    }
    if (hitIds.length === 0) {
        return null;
    }
    const merged = [...selectedIds];
    for (const id of hitIds) {
        if (!merged.includes(id)) {
            merged.push(id);
        }
    }
    return { type: 'set', ids: merged };
}

/**
 * 選択を反転する。全図形のうち選択中でないものを、全図形の並びで返す。
 * @param {string[]} allIds 全図形のid（描画順。書き換えない）
 * @param {string[]} selectedIds 選択中の図形id（書き換えない）
 * @returns {string[]} 反転後の選択（新しい配列）
 */
export function invertSelection(allIds, selectedIds) {
    return allIds.filter((id) => !selectedIds.includes(id));
}
