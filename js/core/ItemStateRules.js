/**
 * 責務：アイテムの表示・ロックの規則（自分の値・上のフォルダから受け継ぐ計算・変えられるかの判定・値を変えた入れ子の計算）。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules のみ。図形は id だけを読む。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * アイテム1つの表示・ロックの状態。
 * @typedef {Object} ItemState
 * @property {Item} item - アイテム（引数の入れ子の中のものそのもの）
 * @property {string} id - アイテムのid
 * @property {boolean} visible - 自分の表示（`visible` が false だけが切）
 * @property {boolean} locked - 自分のロック（`locked` が true だけが入）
 * @property {boolean} hiddenByAncestor - 上のフォルダのどれかの表示が切
 * @property {boolean} lockedByAncestor - 上のフォルダのどれかのロックが入
 * @property {boolean} hidden - 隠れている（自分の表示が切、または hiddenByAncestor）
 * @property {boolean} editable - 変えられる（隠れてもロックされてもいない）
 */

/**
 * 表示・ロックの変更1件。
 * @typedef {Object} ItemStateChange
 * @property {string} id - 変えるアイテムのid
 * @property {boolean} [visible] - 新しい表示
 * @property {boolean} [locked] - 新しいロック
 */

/**
 * アイテムの入れ子を前順（フォルダ自身 → 中身）にたどり、各アイテムの状態を返す。
 * 上のフォルダから受け継ぐ計算と「変えられるか」の判定はここだけで行う。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {ItemState[]} 状態の配列（前順）
 */
export function listItemStates(items) {
    /** @type {ItemState[]} */
    const states = [];
    const walk = (list, hiddenByAncestor, lockedByAncestor) => {
        for (const item of list) {
            const visible = item.visible !== false;
            const locked = item.locked === true;
            const hidden = hiddenByAncestor || !visible;
            states.push({
                item,
                id: itemIdOf(item),
                visible,
                locked,
                hiddenByAncestor,
                lockedByAncestor,
                hidden,
                editable: !hidden && !lockedByAncestor && !locked
            });
            if (item.kind === ITEM_KIND.GROUP) {
                walk(item.children, hidden, lockedByAncestor || locked);
            }
        }
    };
    walk(items, false, false);
    return states;
}

/**
 * 見えている（隠れていない）図形を重なり順で返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Object[]} 図形の配列（重なり順）
 */
export function listVisibleShapes(items) {
    return listItemStates(items)
        .filter((state) => state.item.kind === ITEM_KIND.SHAPE && !state.hidden)
        .map((state) => state.item.shape);
}

/**
 * 変えられる（隠れてもロックされてもいない）図形を重なり順で返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Object[]} 図形の配列（重なり順）
 */
export function listEditableShapes(items) {
    return listItemStates(items)
        .filter((state) => state.item.kind === ITEM_KIND.SHAPE && state.editable)
        .map((state) => state.item.shape);
}

/**
 * 変えられる図形・フォルダのidを集める。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Set<string>} 変えられるアイテムのid
 */
export function collectEditableIds(items) {
    const ids = new Set();
    for (const state of listItemStates(items)) {
        if (state.editable) ids.add(state.id);
    }
    return ids;
}

/**
 * アイテムのid から状態を引く Map を返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Map<string, ItemState>} id → 状態
 */
export function collectItemStates(items) {
    const map = new Map();
    for (const state of listItemStates(items)) {
        map.set(state.id, state);
    }
    return map;
}

/**
 * 目の切り替え（自分の表示の反対）を求める。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - 切り替えるアイテムのid
 * @returns {{id: string, visible: boolean}|null} 変更。無いidなら null
 */
export function resolveVisibleToggle(items, id) {
    const state = collectItemStates(items).get(id);
    return state ? { id, visible: !state.visible } : null;
}

/**
 * 鍵の切り替え（自分のロックの反対）を求める。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - 切り替えるアイテムのid
 * @returns {{id: string, locked: boolean}|null} 変更。無いidなら null
 */
export function resolveLockToggle(items, id) {
    const state = collectItemStates(items).get(id);
    return state ? { id, locked: !state.locked } : null;
}

/**
 * 表示・ロックの値を変えた入れ子を返す。引数は書き換えない。
 * 真偽値でない値・無いidは無視する。変わるものが無ければ引数と同じ参照を返す。
 * 変わるときは通り道と変わるアイテムだけ新しいオブジェクトにする（図形インスタンスは共有。中のものの値は変えない）。
 * @param {Item[]} items - アイテムの入れ子
 * @param {ItemStateChange[]} changes - 変更（同じidが複数あれば後のものが優先）
 * @returns {Item[]} 値を変えた入れ子（変わらなければ items そのもの）
 */
export function applyItemStates(items, changes) {
    const byId = new Map();
    for (const change of changes) {
        if (!change) continue;
        const merged = byId.get(change.id) ?? {};
        if (typeof change.visible === 'boolean') merged.visible = change.visible;
        if (typeof change.locked === 'boolean') merged.locked = change.locked;
        byId.set(change.id, merged);
    }
    if (byId.size === 0) return items;

    const apply = (list) => {
        let nextList = null;
        list.forEach((item, index) => {
            let next = item;
            const change = byId.get(itemIdOf(item));
            if (change) {
                const patch = {};
                if ('visible' in change && (item.visible !== false) !== change.visible) patch.visible = change.visible;
                if ('locked' in change && (item.locked === true) !== change.locked) patch.locked = change.locked;
                if (Object.keys(patch).length > 0) next = { ...next, ...patch };
            }
            if (item.kind === ITEM_KIND.GROUP) {
                const children = apply(item.children);
                if (children !== item.children) next = { ...next, children };
            }
            if (next !== item) {
                if (!nextList) nextList = list.slice();
                nextList[index] = next;
            }
        });
        return nextList ?? list;
    };
    return apply(items);
}
