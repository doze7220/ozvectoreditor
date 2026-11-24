/**
 * 責務：図形の一覧の行のクリック・`Ctrl`・`Shift`での次の選択と、`Shift`の起点の次の値を決める規則。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。引数を書き換えず新しい配列を返す。importは`SelectionRules`だけ。
 */
import { resolveClickSelection } from './SelectionRules.js';

/**
 * 一覧のクリックの結果。
 * @typedef {Object} ListClickSelection
 * @property {string[]} ids - 次の選択の図形id（新しい配列）
 * @property {string|null} anchorId - 次の`Shift`の起点の図形id
 */

/**
 * 行のクリックから、次の選択と起点を決める。
 * - `range`（`Shift`。`additive`によらず優先）：起点（`anchorId`が`rowIds`にあり`selectedIds`に含まれるならそれ、
 *   そうでなければ`rowIds`の順で最初の選ばれている行、無ければ`hitId`）から`hitId`までの`rowIds`の連続した部分（`rowIds`の並びで返す）。
 *   返す`anchorId`は渡されたまま。
 * - `additive`（`Ctrl`）：`resolveClickSelection(selectedIds, hitId, true)`の結果。`anchorId`は`hitId`。
 * - どちらでもない：`[hitId]`、`anchorId`は`hitId`。
 * `hitId`が`rowIds`に無いときは、選択の写しと渡された`anchorId`をそのまま返す（防御）。
 * @param {Object} params
 * @param {string[]} params.rowIds - 行の図形idの並び（上の行から。書き換えない）
 * @param {string[]} params.selectedIds - 今の選択の図形id（書き換えない）
 * @param {string} params.hitId - 押した行の図形id
 * @param {boolean} params.additive - `Ctrl`（または`Meta`）が押されているか
 * @param {boolean} params.range - `Shift`が押されているか
 * @param {string|null} params.anchorId - 今の起点の図形id（無ければ`null`）
 * @returns {ListClickSelection} 次の選択と起点
 */
export function resolveListClickSelection({ rowIds, selectedIds, hitId, additive, range, anchorId }) {
    const hitIndex = rowIds.indexOf(hitId);
    if (hitIndex < 0) {
        return { ids: [...selectedIds], anchorId };
    }
    if (range) {
        let startId = hitId;
        if (anchorId !== null && anchorId !== undefined && rowIds.includes(anchorId) && selectedIds.includes(anchorId)) {
            startId = anchorId;
        } else {
            const firstSelected = rowIds.find((id) => selectedIds.includes(id));
            if (firstSelected !== undefined) {
                startId = firstSelected;
            }
        }
        const startIndex = rowIds.indexOf(startId);
        const low = Math.min(startIndex, hitIndex);
        const high = Math.max(startIndex, hitIndex);
        return { ids: rowIds.slice(low, high + 1), anchorId };
    }
    if (additive) {
        const change = resolveClickSelection(selectedIds, hitId, true);
        const ids = change && change.type === 'set' ? change.ids : [...selectedIds];
        return { ids, anchorId: hitId };
    }
    return { ids: [hitId], anchorId: hitId };
}
