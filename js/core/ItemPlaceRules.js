/**
 * 責務：アイテムの入る場所（行の上・行の下・フォルダの中・一番下）の値と、その場所へ入れる・動かす計算、アイテムの位置の照会。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules のみ。図形は id だけを読む。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf, pickItems, removeItems, mapSiblingLists } from './GroupTreeRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * アイテムの入る場所の種類の値。
 * 'above'＝id の行のすぐ上（同じ並びのすぐ後ろ）、'below'＝id の行のすぐ下（同じ並びのすぐ前）、
 * 'inside'＝id のフォルダの中の一番上、'bottom'＝id のフォルダ（null ならいちばん外側）の中の一番下。
 * @type {Readonly<{ABOVE: 'above', BELOW: 'below', INSIDE: 'inside', BOTTOM: 'bottom'}>}
 */
export const PLACE_KIND = Object.freeze({
    ABOVE: 'above',
    BELOW: 'below',
    INSIDE: 'inside',
    BOTTOM: 'bottom'
});

/**
 * アイテムの入る場所。
 * @typedef {Object} ItemPlace
 * @property {'above'|'below'|'inside'|'bottom'} kind - 場所の種類（PLACE_KIND）
 * @property {string|null} id - 基準のアイテムのid（null になるのは 'bottom' のいちばん外側だけ）
 */

/**
 * アイテムの位置。
 * @typedef {Object} ItemLocation
 * @property {string|null} parentId - 入っているフォルダのid（いちばん外側なら null）
 * @property {Item[]} siblings - 入っている並び（引数の配列そのもの）
 * @property {number} index - 並びの中の添字
 * @property {string[]} ancestorIds - 入っているフォルダのid（外側から）
 */

/**
 * id のアイテム（前順で最初に見つかったもの）の位置を返す。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - アイテムのid
 * @returns {ItemLocation|null} 位置。無ければ null
 */
export function findItemLocation(items, id) {
    const visit = (list, ancestorIds) => {
        for (let index = 0; index < list.length; index += 1) {
            const item = list[index];
            if (itemIdOf(item) === id) {
                const parentId = ancestorIds.length > 0 ? ancestorIds[ancestorIds.length - 1] : null;
                return { parentId, siblings: list, index, ancestorIds };
            }
            if (item.kind === ITEM_KIND.GROUP) {
                const found = visit(item.children, [...ancestorIds, item.id]);
                if (found !== null) {
                    return found;
                }
            }
        }
        return null;
    };
    return visit(items, []);
}

/**
 * ancestorIds をたどった先の並びを fn の結果へ置き換えた新しい入れ子を返す（通り道のフォルダだけ新しいオブジェクト）。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string[]} ancestorIds - たどるフォルダのid（外側から）
 * @param {(list: Item[]) => Item[]} fn - 並びを受けて新しい並びを返す関数
 * @returns {Item[]} 新しいアイテムの入れ子
 */
function updateListAt(items, ancestorIds, fn) {
    if (ancestorIds.length === 0) {
        return fn(items);
    }
    const [head, ...rest] = ancestorIds;
    return items.map((item) => (
        item.kind === ITEM_KIND.GROUP && item.id === head
            ? { ...item, children: updateListAt(item.children, rest, fn) }
            : item
    ));
}

/**
 * place の場所へ addedItems を順のまま入れた新しい入れ子を返す。
 * place が null・id のアイテムが無い・'inside'/'bottom' の id がフォルダでないときは、いちばん外側の末尾（一番上）へ入れる。
 * { kind: 'bottom', id: null } はいちばん外側の先頭。引数は書き換えない（通り道のフォルダだけ新しいオブジェクト）。
 * @param {Item[]} items - アイテムの入れ子
 * @param {ItemPlace|null} place - 入る場所
 * @param {Item[]} addedItems - 入れるアイテム（順のまま入る）
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function insertItemsAt(items, place, addedItems) {
    const appendOuter = () => [...items, ...addedItems];
    if (place === null || place === undefined) {
        return appendOuter();
    }
    if (place.kind === PLACE_KIND.BOTTOM && place.id === null) {
        return [...addedItems, ...items];
    }
    if (place.id === null) {
        return appendOuter();
    }
    const location = findItemLocation(items, place.id);
    if (location === null) {
        return appendOuter();
    }
    if (place.kind === PLACE_KIND.ABOVE || place.kind === PLACE_KIND.BELOW) {
        const at = place.kind === PLACE_KIND.ABOVE ? location.index + 1 : location.index;
        return updateListAt(items, location.ancestorIds, (list) => [
            ...list.slice(0, at),
            ...addedItems,
            ...list.slice(at)
        ]);
    }
    const target = location.siblings[location.index];
    if (target.kind !== ITEM_KIND.GROUP) {
        return appendOuter();
    }
    const path = [...location.ancestorIds, target.id];
    return updateListAt(items, path, (list) => (
        place.kind === PLACE_KIND.INSIDE ? [...list, ...addedItems] : [...addedItems, ...list]
    ));
}

/**
 * ids のアイテムを place の場所へ動かせるかを返す。
 * 「自分の中・自分の中のフォルダの中へは入れられない」の唯一の判定箇所。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} ids - 動かすアイテムのid
 * @param {ItemPlace|null} place - 動かす先の場所
 * @returns {boolean} 動かせるなら true
 */
export function canMoveItems(items, ids, place) {
    if (place === null || place === undefined) {
        return false;
    }
    if (place.kind === PLACE_KIND.BOTTOM && place.id === null) {
        return true;
    }
    if (place.id === null) {
        return false;
    }
    const location = findItemLocation(items, place.id);
    if (location === null) {
        return false;
    }
    if (location.ancestorIds.some((ancestorId) => ids.has(ancestorId))) {
        return false;
    }
    if (place.kind === PLACE_KIND.INSIDE || place.kind === PLACE_KIND.BOTTOM) {
        const target = location.siblings[location.index];
        if (ids.has(place.id) || target.kind !== ITEM_KIND.GROUP) {
            return false;
        }
    }
    return true;
}

/**
 * ids のアイテム（まとまり）を前順のまま、place の場所へ動かした新しい入れ子を返す。
 * 動かせない場所・動かすアイテムが1つも無いときは null。引数は書き換えない。
 * 目印を先に置いてから抜くため、動かすまとまり自身の行の上下を指しても位置がずれない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} ids - 動かすアイテムのid
 * @param {ItemPlace|null} place - 動かす先の場所
 * @returns {Item[]|null} 新しいアイテムの入れ子。動かせなければ null
 */
export function moveItems(items, ids, place) {
    if (!canMoveItems(items, ids, place)) {
        return null;
    }
    const units = pickItems(items, ids);
    if (units.length === 0) {
        return null;
    }
    const markerId = Symbol('place');
    const marker = { kind: ITEM_KIND.GROUP, id: markerId, children: [] };
    const marked = insertItemsAt(items, place, [marker]);
    const removed = removeItems(marked, ids);
    return mapSiblingLists(removed, (list) => list.flatMap((item) => (
        itemIdOf(item) === markerId ? units : [item]
    )));
}
