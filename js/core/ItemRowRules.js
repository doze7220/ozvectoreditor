/**
 * 責務：図形の一覧の行の並び（フォルダの入れ子・折りたたみ）と、字下げ・行の見た目・スクロールの対象を決める規則。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。importは`ItemTreeRules`・`GroupTreeRules`（`itemIdOf`）・`ItemPlaceRules`（`PLACE_KIND`）・`ItemStateRules`（`collectItemStates`）だけ。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';
import { PLACE_KIND } from './ItemPlaceRules.js';
import { collectItemStates } from './ItemStateRules.js';

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
 * @property {boolean} visible - 自分の表示が入か（`visible !== false`。値が無ければ true）
 * @property {boolean} locked - 自分のロックが入か（`locked === true`。値が無ければ false）
 * @property {boolean} hiddenByAncestor - 上のフォルダのどれかの表示が切か
 * @property {boolean} lockedByAncestor - 上のフォルダのどれかのロックが入か
 * @property {boolean} hidden - 隠れているか（自分の表示が切、または上のフォルダのどれかの表示が切）
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
 * @property {boolean} insertTarget - 描き込む先の印（行の印）か
 * @property {?{edge: ('before'|'after'), indent: number}} insertLine - 描き込む先の線（行の上／下・字下げpx）。無ければ null
 * @property {boolean} hiddenMark - 閉じたフォルダの中に、選択・描き込む先の印があるか
 * @property {boolean} visible - 自分の表示が入か（目の絵）
 * @property {boolean} locked - 自分のロックが入か（鍵の絵）
 * @property {boolean} hiddenByAncestor - 上のフォルダのどれかの表示が切か（目の受け継ぎの見た目）
 * @property {boolean} lockedByAncestor - 上のフォルダのどれかのロックが入か（鍵の受け継ぎの見た目）
 * @property {boolean} hidden - 隠れているか（行の名前・サムネイルをうすくする）
 */

/** 字下げの1段の幅（px）。 */
const INDENT_STEP = 12;
/** 字下げが頭打ちになる段数。 */
const INDENT_MAX_DEPTH = 6;

/**
 * アイテムの入れ子から、一覧の見えている行を作る。先頭が前面（並びの後ろの要素から順。フォルダは行の次に中身の行）。
 * 折りたたんだフォルダの中身は行にしない。隠れている・ロックの図形も含める。引数は書き換えない。
 * 表示・ロックの項目は`collectItemStates`を1回求めてidで引く（受け継ぐ計算はここに書かない）。
 * @param {Array<Object>} items - アイテムの入れ子
 * @returns {ItemRow[]} 見えている行の配列（先頭が前面）
 */
export function buildItemRows(items) {
    const rows = [];
    visitList(items, [], true, rows, collectItemStates(items));
    return rows;
}

/**
 * 並び1つを後ろから順に辿り、行を作る。フォルダの中の図形・フォルダのidを、上のフォルダすべての行へ足す。
 * @param {Array<Object>} list - アイテムの並び
 * @param {ItemRow[]} ancestorRows - 上のフォルダの行（外側から。見えていない行も含む）
 * @param {boolean} visible - この並びの行を結果に入れるか
 * @param {ItemRow[]} rows - 結果の行の配列（追記される）
 * @param {Map<string, import('./ItemStateRules.js').ItemState>} states - アイテムのid→表示・ロックの状態
 * @returns {void}
 */
function visitList(list, ancestorRows, visible, rows, states) {
    const depth = ancestorRows.length;
    for (let index = list.length - 1; index >= 0; index--) {
        const item = list[index];
        const id = itemIdOf(item);
        const isGroup = item.kind === ITEM_KIND.GROUP;
        const state = states.get(id);
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
            isEmpty: isGroup && item.children.length === 0,
            visible: state.visible,
            locked: state.locked,
            hiddenByAncestor: state.hiddenByAncestor,
            lockedByAncestor: state.lockedByAncestor,
            hidden: state.hidden
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
            visitList(item.children, [...ancestorRows, row], visible && !row.collapsed, rows, states);
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
 * 描き込む先の印を、行ごとの見た目へ割り当てる（行ごとに規則を二重に書かないための1か所）。
 * - above：行が見えていれば、図形は`insertTarget`、フォルダはその行の上の線。
 * - inside：行が見えていれば`insertTarget`（折りたたんでいても同じ）。
 * - bottom（idなし）：最後の行の下の線（字下げ0）。
 * - bottom（フォルダ）：行が見えていれば、空なら`insertTarget`、折りたたんでいれば`hiddenMark`、
 *   開いていて中身があれば、そのフォルダの中の最後の行の下の線（字下げは1段深い）。
 * - 行が見えていない：その行を含む折りたたんだ行に`hiddenMark`。
 * @param {ItemRow[]} rows - `buildItemRows`の結果（書き換えない）
 * @param {?import('./InsertTargetRules.js').InsertTarget} insertMark - 描き込む先の印（無ければ null）
 * @returns {{targetId: ?string, lines: Map<string, {edge: ('before'|'after'), indent: number}>, hiddenIds: Set<string>}}
 *   `targetId`＝`insertTarget`にする行のid、`lines`＝行のid→線、`hiddenIds`＝`hiddenMark`にする行のid
 */
function resolveInsertMarkEffects(rows, insertMark) {
    const effects = { targetId: null, lines: new Map(), hiddenIds: new Set() };
    if (insertMark === null || insertMark === undefined || rows.length === 0) {
        return effects;
    }
    const { kind, id } = insertMark;
    if (kind === PLACE_KIND.BOTTOM && id === null) {
        effects.lines.set(rows[rows.length - 1].id, { edge: 'after', indent: 0 });
        return effects;
    }
    const row = rows.find((candidate) => candidate.id === id);
    if (row === undefined) {
        for (const candidate of rows) {
            if (candidate.collapsed && (candidate.shapeIds.includes(id) || candidate.groupIds.includes(id))) {
                effects.hiddenIds.add(candidate.id);
            }
        }
        return effects;
    }
    const isGroup = row.kind === ITEM_KIND.GROUP;
    if (kind === PLACE_KIND.ABOVE) {
        if (isGroup) {
            effects.lines.set(row.id, { edge: 'before', indent: resolveRowIndent(row.depth) });
        } else {
            effects.targetId = row.id;
        }
    } else if (kind === PLACE_KIND.INSIDE) {
        effects.targetId = row.id;
    } else if (kind === PLACE_KIND.BOTTOM && isGroup) {
        if (row.isEmpty) {
            effects.targetId = row.id;
        } else if (row.collapsed) {
            effects.hiddenIds.add(row.id);
        } else {
            let last = null;
            for (const candidate of rows) {
                if (candidate.ancestorIds.includes(id)) {
                    last = candidate;
                }
            }
            if (last !== null) {
                effects.lines.set(last.id, { edge: 'after', indent: resolveRowIndent(row.depth + 1) });
            }
        }
    }
    return effects;
}

/**
 * 行ごとの見た目の材料を決める。
 * - `selectedInGroup`：上のフォルダのどれかが選ばれている（図形・フォルダとも。弱い見た目）。
 * - `selected`：`selectedInGroup`でなく、図形は`isSelected`、フォルダは`selectedGroupIds`にある。
 * - `hiddenMark`：閉じているフォルダの行で、中の図形に選ばれているものがある、
 *   または中のフォルダに選んでいるフォルダがある（自分が選ばれていても出す）。
 *   描き込む先が見えない行（閉じたフォルダの中）・閉じたフォルダの一番下のときも出す。
 * - `insertTarget`・`insertLine`：描き込む先の印（`insertMark`）の割り当て。
 * - `visible`・`locked`・`hiddenByAncestor`・`lockedByAncestor`・`hidden`：行の値をそのまま渡す（目・鍵・行の見た目の材料）。
 * @param {Object} params
 * @param {ItemRow[]} params.rows - `buildItemRows`の結果（書き換えない）
 * @param {function(string): boolean} params.isSelected - 図形のidが選ばれているか
 * @param {Iterable<string>} params.selectedGroupIds - 選んでいるフォルダのid
 * @param {?import('./InsertTargetRules.js').InsertTarget} params.insertMark - 描き込む先の印（場所または null）
 * @returns {RowView[]} 行ごとの見た目の材料
 */
export function resolveRowViews({ rows, isSelected, selectedGroupIds, insertMark }) {
    const groupSet = new Set(selectedGroupIds);
    const effects = resolveInsertMarkEffects(rows, insertMark);
    return rows.map((row) => {
        const isGroup = row.kind === ITEM_KIND.GROUP;
        const selectedInGroup = row.ancestorIds.some((ancestorId) => groupSet.has(ancestorId));
        const selected = !selectedInGroup && (isGroup ? groupSet.has(row.id) : isSelected(row.id));
        const hiddenMark = isGroup && row.collapsed && (
            row.shapeIds.some((shapeId) => isSelected(shapeId))
            || row.groupIds.some((groupId) => groupSet.has(groupId))
            || effects.hiddenIds.has(row.id)
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
            insertTarget: effects.targetId === row.id,
            insertLine: effects.lines.get(row.id) ?? null,
            hiddenMark,
            visible: row.visible,
            locked: row.locked,
            hiddenByAncestor: row.hiddenByAncestor,
            lockedByAncestor: row.lockedByAncestor,
            hidden: row.hidden
        };
    });
}

/**
 * 行の見た目から、強調の行のid・印の行のid・スクロールの対象の添字を求める。
 * `hasHighlightChanged`・`resolveSelectionScrollTop`へ渡す値。
 * @param {RowView[]} views - `resolveRowViews`の結果（書き換えない）
 * @returns {{selectedIds: string[], markId: ?string, indexes: number[]}}
 *   `selectedIds`＝`selected`か`selectedInGroup`の行のid、`markId`＝`insertTarget`・`insertLine`・`hiddenMark`のいずれかを持つ最初の行のid（無ければ null）、
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
        if (markId === null && (view.insertTarget || view.insertLine !== null || view.hiddenMark)) {
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
