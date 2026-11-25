/**
 * 責務：図形とフォルダのアイテムの入れ子を、まとめる・解除する・除く・並びごとに置き換える計算と、アイテムのidの照会。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules のみ。図形は id だけを読む。
 */
import { ITEM_KIND } from './ItemTreeRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * アイテムのid（図形は shape.id、フォルダは id）を返す。種類で分ける唯一の箇所。
 * @param {Item} item - アイテム
 * @returns {string} アイテムのid
 */
export function itemIdOf(item) {
    return item.kind === ITEM_KIND.GROUP ? item.id : item.shape.id;
}

/**
 * アイテムの入れ子にフォルダが1つでもあるかを返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {boolean} フォルダがあれば true
 */
export function hasGroupItem(items) {
    return items.some((item) => item.kind === ITEM_KIND.GROUP);
}

/**
 * ids のアイテムを前順で集めた新しい配列を返す。当たったフォルダの中へは進まない。
 * 要素は引数のアイテムそのもの（写しを作らない）。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} ids - 集めるアイテムのid
 * @returns {Item[]} 集めたアイテム（前順）
 */
export function pickItems(items, ids) {
    const picked = [];
    const collect = (list) => {
        for (const item of list) {
            if (ids.has(itemIdOf(item))) {
                picked.push(item);
            } else if (item.kind === ITEM_KIND.GROUP) {
                collect(item.children);
            }
        }
    };
    collect(items);
    return picked;
}

/**
 * フォルダのidを前順で（入れ子の中も）列挙した新しい配列を返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {string[]} フォルダのid（前順）
 */
export function listGroupIds(items) {
    const ids = [];
    const visit = (list) => {
        for (const item of list) {
            if (item.kind === ITEM_KIND.GROUP) {
                ids.push(item.id);
                visit(item.children);
            }
        }
    };
    visit(items);
    return ids;
}

/**
 * まとまり（unitIds のアイテム）をすべて抜き、前順で最後のまとまりの位置へ、
 * group の children にまとまりを前順で入れたフォルダを置いた新しい入れ子を返す。
 * まとまりが1つも無ければ並びは変えない。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} unitIds - まとめるアイテムのid（互いに含み合わない）
 * @param {Object} group - 新しいフォルダのアイテム（kind が 'group'。children は上書きされる）
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function wrapUnits(items, unitIds, group) {
    const units = pickItems(items, unitIds);
    if (units.length === 0) {
        return mapSiblingLists(items, (list) => list.slice());
    }
    const lastId = itemIdOf(units[units.length - 1]);
    const rebuild = (list) => {
        const result = [];
        for (const item of list) {
            const id = itemIdOf(item);
            if (unitIds.has(id)) {
                if (id === lastId) {
                    result.push({ ...group, children: units });
                }
            } else if (item.kind === ITEM_KIND.GROUP) {
                result.push({ ...item, children: rebuild(item.children) });
            } else {
                result.push(item);
            }
        }
        return result;
    };
    return rebuild(items);
}

/**
 * groupIds のフォルダを、その中身（children）へ置き換えた新しい入れ子を返す。
 * 中のフォルダは groupIds に無ければそのまま残る。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} groupIds - 解除するフォルダのid
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function unwrapGroups(items, groupIds) {
    const result = [];
    for (const item of items) {
        if (item.kind !== ITEM_KIND.GROUP) {
            result.push(item);
            continue;
        }
        const children = unwrapGroups(item.children, groupIds);
        if (groupIds.has(item.id)) {
            result.push(...children);
        } else {
            result.push({ ...item, children });
        }
    }
    return result;
}

/**
 * ids のアイテムを除いた新しい入れ子を返す。フォルダは中身ごと除く。
 * 図形だけを除いたフォルダは、空になっても残す。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} ids - 除くアイテムのid
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function removeItems(items, ids) {
    const result = [];
    for (const item of items) {
        if (ids.has(itemIdOf(item))) {
            continue;
        }
        if (item.kind === ITEM_KIND.GROUP) {
            result.push({ ...item, children: removeItems(item.children, ids) });
        } else {
            result.push(item);
        }
    }
    return result;
}

/**
 * 兄弟の並び（いちばん外側と、各フォルダの children）を、いちばん外側 → 前順のフォルダの順で列挙する。
 * 空のフォルダの並び（空の配列）も含む。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Item[][]} 並びの配列（要素は引数の配列そのもの）
 */
export function listSiblingLists(items) {
    const lists = [];
    const visit = (list) => {
        lists.push(list);
        for (const item of list) {
            if (item.kind === ITEM_KIND.GROUP) {
                visit(item.children);
            }
        }
    };
    visit(items);
    return lists;
}

/**
 * 兄弟の並びのそれぞれを fn の結果にした新しい入れ子を返す。
 * fn はいちばん外側 → 各フォルダ（fn の結果の中の前順）の順に、空の並びでも1回ずつ呼ぶ。
 * fn は並びを書き換えず、新しい配列を返すこと。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {(list: Item[]) => Item[]} fn - 並び1つを受けて、置き換える並びを返す関数
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function mapSiblingLists(items, fn) {
    return fn(items).map((item) => (
        item.kind === ITEM_KIND.GROUP
            ? { ...item, children: mapSiblingLists(item.children, fn) }
            : item
    ));
}

/**
 * 2つの入れ子の構造（並び順・入れ子・アイテムのid・種類）が同じかを返す。名前等の属性は見ない。
 * @param {Item[]} a - アイテムの入れ子
 * @param {Item[]} b - アイテムの入れ子
 * @returns {boolean} 構造が同じなら true
 */
export function isSameTree(a, b) {
    if (a.length !== b.length) {
        return false;
    }
    for (let index = 0; index < a.length; index += 1) {
        const left = a[index];
        const right = b[index];
        if (left.kind !== right.kind || itemIdOf(left) !== itemIdOf(right)) {
            return false;
        }
        if (left.kind === ITEM_KIND.GROUP && !isSameTree(left.children, right.children)) {
            return false;
        }
    }
    return true;
}
