/**
 * 責務：一覧の行（図形・フォルダ）のクリック・`Ctrl`・`Shift`での次の選択（図形とフォルダ）と、`Shift`の起点の次の値を決める規則。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。引数を書き換えず新しい配列を返す。importは`SelectionRules`だけ。
 */
import { resolveClickSelection } from './SelectionRules.js';

/**
 * 一覧のクリックの結果。
 * @typedef {Object} ListClickSelection
 * @property {string[]} ids - 次の選択の行のid（図形またはフォルダ。新しい配列）
 * @property {string|null} anchorId - 次の`Shift`の起点の行のid
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
 * @param {string[]} params.rowIds - 行のid（図形またはフォルダ）の並び（上の行から。書き換えない）
 * @param {string[]} params.selectedIds - 今の選択の行のid（書き換えない）
 * @param {string} params.hitId - 押した行のid
 * @param {boolean} params.additive - `Ctrl`（または`Meta`）が押されているか
 * @param {boolean} params.range - `Shift`が押されているか
 * @param {string|null} params.anchorId - 今の起点の行のid（無ければ`null`）
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

/**
 * フォルダの行を含む一覧のクリックの結果。
 * @typedef {Object} RowClickSelection
 * @property {string[]} ids - 次の選択の図形id（新しい配列）
 * @property {string[]} groupIds - 次に選ぶフォルダのid（新しい配列）
 * @property {string|null} anchorId - 次の`Shift`の起点の行のid
 */

/**
 * フォルダの行を含む行のクリックから、次の選択（図形とフォルダ）と起点を決める。
 * 行ごとの「選ばれている」を、図形の行＝`selectedIds`にある、フォルダの行＝自分か上のフォルダが`selectedGroupIds`にある、とし、
 * その行のidの並びで`resolveListClickSelection`を呼んで次の行のidと起点を得る（起点・範囲の規則は二重に書かない）。
 * - ふつう・`Shift`：結果の行の`shapeIds`の和（重複なし）が`ids`、結果の行のうちフォルダが`groupIds`。
 * - `Ctrl`で足す：今の`selectedIds`＋押した行の`shapeIds`、今の`selectedGroupIds`＋（フォルダなら）そのid。
 * - `Ctrl`で外す：今の`selectedIds`−押した行の`shapeIds`、`selectedGroupIds`−（押した行のid・中のフォルダ・上のフォルダ）。
 * `hitId`の行が無いときは、今の選択と起点をそのまま返す（防御）。
 * @param {Object} params
 * @param {Array<Object>} params.rows - 見えている行（`ItemRowRules.buildItemRows`の結果。書き換えない）
 * @param {string[]} params.selectedIds - 今の選択の図形すべて（折りたたまれて行の無い図形も含む。書き換えない）
 * @param {Iterable<string>} params.selectedGroupIds - 今選んでいるフォルダのid
 * @param {string} params.hitId - 押した行のid
 * @param {boolean} params.additive - `Ctrl`（または`Meta`）が押されているか
 * @param {boolean} params.range - `Shift`が押されているか
 * @param {string|null} params.anchorId - 今の起点の行のid（無ければ`null`）
 * @returns {RowClickSelection} 次の選択と起点
 */
export function resolveRowClickSelection({ rows, selectedIds, selectedGroupIds, hitId, additive, range, anchorId }) {
    const groupSet = new Set(selectedGroupIds);
    const selectedSet = new Set(selectedIds);
    const rowIds = rows.map((row) => row.id);
    const hitRow = rows.find((row) => row.id === hitId);
    if (hitRow === undefined) {
        return { ids: [...selectedIds], groupIds: [...groupSet], anchorId };
    }
    const selectedRowIds = rows
        .filter((row) => (row.kind === 'group'
            ? groupSet.has(row.id) || row.ancestorIds.some((ancestorId) => groupSet.has(ancestorId))
            : selectedSet.has(row.id)))
        .map((row) => row.id);
    const result = resolveListClickSelection({ rowIds, selectedIds: selectedRowIds, hitId, additive, range, anchorId });

    if (additive && !range) {
        if (result.ids.includes(hitId)) {
            const nextGroupIds = new Set(groupSet);
            if (hitRow.kind === 'group') {
                nextGroupIds.add(hitRow.id);
            }
            return {
                ids: [...new Set([...selectedIds, ...hitRow.shapeIds])],
                groupIds: [...nextGroupIds],
                anchorId: result.anchorId
            };
        }
        const removedShapeIds = new Set(hitRow.shapeIds);
        const removedGroupIds = new Set([hitRow.id, ...hitRow.groupIds, ...hitRow.ancestorIds]);
        return {
            ids: selectedIds.filter((id) => !removedShapeIds.has(id)),
            groupIds: [...groupSet].filter((id) => !removedGroupIds.has(id)),
            anchorId: result.anchorId
        };
    }

    const resultIds = new Set(result.ids);
    const resultRows = rows.filter((row) => resultIds.has(row.id));
    const ids = new Set();
    const groupIds = [];
    for (const row of resultRows) {
        for (const shapeId of row.shapeIds) {
            ids.add(shapeId);
        }
        if (row.kind === 'group') {
            groupIds.push(row.id);
        }
    }
    return { ids: [...ids], groupIds, anchorId: result.anchorId };
}
