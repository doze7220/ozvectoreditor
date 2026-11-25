/**
 * 責務：図形の一覧の行の並び（フォルダの入れ子・折りたたみ）と、字下げ・行の見た目・スクロールの対象を決める規則。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。importは`ItemTreeRules`・`GroupTreeRules`（`itemIdOf`）だけ。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';

/**
 * 一覧の1行。
 * @typedef {Object} ItemRow
 * @property {string} id - アイテムのid（図形は shape.id、フォルダは id）
 * @property {('shape'|'group')} kind - 行の種類
 * @property {string} name - 名前（未定なら空文字）
 * @property {number} depth - 入れ子の深さ（いちばん外側が0）
 * @property {string[]} ancestorIds - 上のフォルダのid（外側から）
 * @property {?Object} shape - 図形インスタンス（共有。書き換えない）。フォルダは null
 * @property {string[]} shapeIds - 図形の行は自分のid1つ、フォルダは中の図形すべて（入れ子の中も。行の並びの順）
 * @property {string[]} groupIds - フォルダの中のフォルダすべて（入れ子の中も。行の並びの順）。図形は空
 * @property {boolean} collapsed - 折りたたまれているフォルダか（図形は false）
 * @property {boolean} isEmpty - 中身（children）が空のフォルダか（図形は false）
 */

/**
 * 行の見た目の材料（`resolveRowViews`の結果の1行）。
 * @typedef {Object} RowView
 * @property {string} id - 行のid
 * @property {('shape'|'group')} kind - 行の種類
 * @property {string} name - 名前
 * @property {number} indent - 字下げ（px）
 * @property {boolean} collapsed - 折りたたまれているか
 * @property {boolean} canToggle - 三角を押せるか（空でないフォルダ）
 * @property {boolean} selected - 強い選択の見た目か
 * @property {boolean} selectedInGroup - 上のフォルダが選ばれている弱い選択の見た目か
 * @property {boolean} insertTarget - 描き込む先の印か
 * @property {boolean} hiddenMark - 閉じたフォルダの中に、選択・描き込む先の印があるか
 */

/** 字下げの1段の幅（px）。 */
const INDENT_STEP = 12;
/** 字下げが頭打ちになる段数。 */
const INDENT_MAX_DEPTH = 6;

/**
 * アイテムの入れ子から、一覧の見えている行を作る。先頭が前面（並びの後ろの要素から順。フォルダは行の次に中身の行）。
 * 折りたたんだフォルダの中身は行にしない。隠れている・ロックの図形も含める。引数は書き換えない。
 * @param {Array<Object>} items - アイテムの入れ子
 * @returns {ItemRow[]} 見えている行の配列（先頭が前面）
 */
export function buildItemRows(items) {
    const rows = [];
    visitList(items, [], true, rows);
    return rows;
}

/**
 * 並び1つを後ろから順に辿り、行を作る。フォルダの中の図形・フォルダのidを、上のフォルダすべての行へ足す。
 * @param {Array<Object>} list - アイテムの並び
 * @param {ItemRow[]} ancestorRows - 上のフォルダの行（外側から。見えていない行も含む）
 * @param {boolean} visible - この並びの行を結果に入れるか
 * @param {ItemRow[]} rows - 結果の行の配列（追記される）
 * @returns {void}
 */
function visitList(list, ancestorRows, visible, rows) {
    const depth = ancestorRows.length;
    for (let index = list.length - 1; index >= 0; index--) {
        const item = list[index];
        const id = itemIdOf(item);
        const isGroup = item.kind === ITEM_KIND.GROUP;
        const row = {
            id,
            kind: isGroup ? ITEM_KIND.GROUP : ITEM_KIND.SHAPE,
            name: item.name ?? '',
            depth,
            ancestorIds: ancestorRows.map((ancestor) => ancestor.id),
            shape: isGroup ? null : item.shape,
            shapeIds: isGroup ? [] : [id],
            groupIds: [],
            collapsed: isGroup && item.collapsed === true,
            isEmpty: isGroup && item.children.length === 0
        };
        for (const ancestor of ancestorRows) {
            if (isGroup) {
                ancestor.groupIds.push(id);
            } else {
                ancestor.shapeIds.push(id);
            }
        }
        if (visible) {
            rows.push(row);
        }
        if (isGroup) {
            visitList(item.children, [...ancestorRows, row], visible && !row.collapsed, rows);
        }
    }
}

/**
 * 入れ子の深さから字下げ（px）を決める。1段12px、6段で頭打ち（7段目以降は同じ）。
 * @param {number} depth - 入れ子の深さ（いちばん外側が0）
 * @returns {number} 字下げ（px）
 */
export function resolveRowIndent(depth) {
    const steps = Math.min(Math.max(depth, 0), INDENT_MAX_DEPTH);
    return steps * INDENT_STEP;
}

/**
 * 行ごとの見た目の材料を決める。
 * - `selectedInGroup`：上のフォルダのどれかが選ばれている（図形・フォルダとも。弱い見た目）。
 * - `selected`：`selectedInGroup`でなく、図形は`isSelected`、フォルダは`selectedGroupIds`にある。
 * - `hiddenMark`：閉じているフォルダの行で、中の図形に選ばれているもの・`insertMarkId`の図形がある、
 *   または中のフォルダに選んでいるフォルダがある（自分が選ばれていても出す）。
 * @param {Object} params
 * @param {ItemRow[]} params.rows - `buildItemRows`の結果（書き換えない）
 * @param {function(string): boolean} params.isSelected - 図形のidが選ばれているか
 * @param {Iterable<string>} params.selectedGroupIds - 選んでいるフォルダのid
 * @param {?string} params.insertMarkId - 描き込む先の印の図形id（無ければ null）
 * @returns {RowView[]} 行ごとの見た目の材料
 */
export function resolveRowViews({ rows, isSelected, selectedGroupIds, insertMarkId }) {
    const groupSet = new Set(selectedGroupIds);
    return rows.map((row) => {
        const isGroup = row.kind === ITEM_KIND.GROUP;
        const selectedInGroup = row.ancestorIds.some((ancestorId) => groupSet.has(ancestorId));
        const selected = !selectedInGroup && (isGroup ? groupSet.has(row.id) : isSelected(row.id));
        const hiddenMark = isGroup && row.collapsed && (
            row.shapeIds.some((shapeId) => isSelected(shapeId) || shapeId === insertMarkId)
            || row.groupIds.some((groupId) => groupSet.has(groupId))
        );
        return {
            id: row.id,
            kind: row.kind,
            name: row.name,
            indent: resolveRowIndent(row.depth),
            collapsed: row.collapsed,
            canToggle: isGroup && !row.isEmpty,
            selected,
            selectedInGroup,
            insertTarget: insertMarkId !== null && insertMarkId !== undefined && row.id === insertMarkId,
            hiddenMark
        };
    });
}

/**
 * 行の見た目から、強調の行のid・印の行のid・スクロールの対象の添字を求める。
 * `hasHighlightChanged`・`resolveSelectionScrollTop`へ渡す値。
 * @param {RowView[]} views - `resolveRowViews`の結果（書き換えない）
 * @returns {{selectedIds: string[], markId: ?string, indexes: number[]}}
 *   `selectedIds`＝`selected`か`selectedInGroup`の行のid、`markId`＝`insertTarget`か`hiddenMark`の最初の行のid（無ければ null）、
 *   `indexes`＝スクロールの対象の添字（選ばれている行。1つも無ければ印の行）
 */
export function resolveRowHighlight(views) {
    const selectedIds = [];
    const selectedIndexes = [];
    let markId = null;
    let markIndex = -1;
    views.forEach((view, index) => {
        if (view.selected || view.selectedInGroup) {
            selectedIds.push(view.id);
            selectedIndexes.push(index);
        }
        if (markId === null && (view.insertTarget || view.hiddenMark)) {
            markId = view.id;
            markIndex = index;
        }
    });
    let indexes = selectedIndexes;
    if (selectedIndexes.length === 0 && markIndex >= 0) {
        indexes = [markIndex];
    }
    return { selectedIds, markId, indexes };
}
