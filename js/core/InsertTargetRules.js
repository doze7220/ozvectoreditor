/**
 * 責務：描き込む先の決まり方と、一覧で印に出す描き込む先・貼り付けと複製の入る場所の規則。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules・GroupSelectionRules・ItemPlaceRules のみ。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';
import { resolveSelectedUnitIds } from './GroupSelectionRules.js';
import { PLACE_KIND, findItemLocation } from './ItemPlaceRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */
/** @typedef {import('./ItemPlaceRules.js').ItemPlace} ItemPlace */

/**
 * 描き込む先。ItemPlace のうち 'above'・'inside'・'bottom' のいずれか（'below' にはならない）。
 * @typedef {ItemPlace} InsertTarget
 */

/**
 * 描き込む先が今の入れ子で有効かを返す。
 * above は id のアイテムがある、inside と bottom（id あり）は id のフォルダがある、
 * bottom（id が null）は items が1つ以上ある場合に有効。
 * @param {Item[]} items - アイテムの入れ子
 * @param {InsertTarget} target - 描き込む先
 * @returns {boolean} 有効なら true
 */
function isValidInsertTarget(items, target) {
    if (target.kind === PLACE_KIND.BOTTOM && target.id === null) {
        return items.length > 0;
    }
    const location = findItemLocation(items, target.id);
    if (location === null) {
        return false;
    }
    if (target.kind === PLACE_KIND.ABOVE) {
        return true;
    }
    return location.siblings[location.index].kind === ITEM_KIND.GROUP;
}

/**
 * 描き込む先が無くなったとき、変わる前の入れ子での元の場所から、残っている近い場所を求める。
 * @param {Item[]} previousItems - 変わる前のアイテムの入れ子
 * @param {Item[]} items - 変わった後のアイテムの入れ子
 * @param {InsertTarget} target - 無くなった描き込む先
 * @returns {InsertTarget|null} 求めた描き込む先。求められなければ null
 */
function resolveVanishedTarget(previousItems, items, target) {
    let location = findItemLocation(previousItems, target.id);
    while (location !== null) {
        const { parentId } = location;
        const parentLocation = parentId === null ? null : findItemLocation(items, parentId);
        const parentRemains = parentId === null
            || (parentLocation !== null && parentLocation.siblings[parentLocation.index].kind === ITEM_KIND.GROUP);
        if (parentRemains) {
            for (let index = location.index - 1; index >= 0; index -= 1) {
                const id = itemIdOf(location.siblings[index]);
                const current = findItemLocation(items, id);
                if (current !== null && current.parentId === parentId) {
                    return { kind: PLACE_KIND.ABOVE, id };
                }
            }
            if (parentId === null) {
                return items.length === 0 ? null : { kind: PLACE_KIND.BOTTOM, id: null };
            }
            return { kind: PLACE_KIND.BOTTOM, id: parentId };
        }
        location = findItemLocation(previousItems, parentId);
    }
    return null;
}

/**
 * 変わった後の描き込む先（場所または null）を決める。上から順に最初に当たったものを返す。
 * 1. 選んでいるまとまりが1つ以上 → 一番上のものが図形なら above、フォルダなら inside
 * 2. target が null → null
 * 3. target が今も有効 → 同じ内容の値
 * 4. 無くなった → previousItems での元の場所から、同じフォルダに残っている近い行の above、無ければそのフォルダの bottom（外側が空なら null）
 * 引数は書き換えない。
 * @param {Object} params - 引数
 * @param {Item[]} params.previousItems - 変わる前のアイテムの入れ子
 * @param {Item[]} params.items - 変わった後のアイテムの入れ子
 * @param {Set<string>} params.selectedIds - 変わった後の図形の選択集合
 * @param {Set<string>} params.selectedGroupIds - 変わった後の選んでいるフォルダ（不変条件を通した後）
 * @param {InsertTarget|null} params.target - 候補の描き込む先
 * @returns {InsertTarget|null} 描き込む先。無ければ null
 */
export function resolveNextInsertTarget({ previousItems, items, selectedIds, selectedGroupIds, target }) {
    const unitIds = resolveSelectedUnitIds({
        items,
        isSelected: (id) => selectedIds.has(id),
        selectedGroupIds
    });
    if (unitIds.length > 0) {
        return resolveRowInsertTarget(items, unitIds[unitIds.length - 1]);
    }
    if (target === null || target === undefined) {
        return null;
    }
    if (isValidInsertTarget(items, target)) {
        return { kind: target.kind, id: target.id };
    }
    return resolveVanishedTarget(previousItems, items, target);
}

/**
 * 行を押したときの描き込む先を返す。図形なら その行の above、フォルダなら その行の inside。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - 行のid
 * @returns {InsertTarget|null} 描き込む先。id のアイテムが無ければ null
 */
export function resolveRowInsertTarget(items, id) {
    const location = findItemLocation(items, id);
    if (location === null) {
        return null;
    }
    const kind = location.siblings[location.index].kind === ITEM_KIND.GROUP
        ? PLACE_KIND.INSIDE
        : PLACE_KIND.ABOVE;
    return { kind, id };
}

/**
 * 2つの描き込む先が同じ内容かを返す。
 * @param {InsertTarget|null} a - 一方
 * @param {InsertTarget|null} b - もう一方
 * @returns {boolean} どちらも null、または kind と id が同じなら true
 */
export function isSameInsertTarget(a, b) {
    if (a === null || a === undefined || b === null || b === undefined) {
        return (a ?? null) === (b ?? null);
    }
    return a.kind === b.kind && a.id === b.id;
}

/**
 * 貼り付けの入る場所を返す。描き込む先が「自分のコピーのフォルダの中」なら、そのフォルダのすぐ上にする。
 * @param {Object} params - 引数
 * @param {InsertTarget|null} params.target - 描き込む先
 * @param {Set<string>} params.copiedGroupIds - 自分のコピーに含まれるフォルダのid
 * @returns {InsertTarget|null} 入る場所。null ならいちばん外側の一番上
 */
export function resolvePastePlace({ target, copiedGroupIds }) {
    if (target !== null && target !== undefined
        && target.kind === PLACE_KIND.INSIDE && copiedGroupIds.has(target.id)) {
        return { kind: PLACE_KIND.ABOVE, id: target.id };
    }
    return target ?? null;
}

/**
 * 複製の入る場所を返す（選んでいるまとまりの一番上のもののすぐ上）。
 * @param {string[]} unitIds - 選んでいるまとまりのid（前順）
 * @returns {InsertTarget|null} 入る場所。まとまりが空なら null
 */
export function resolveDuplicatePlace(unitIds) {
    if (unitIds.length === 0) {
        return null;
    }
    return { kind: PLACE_KIND.ABOVE, id: unitIds[unitIds.length - 1] };
}

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
