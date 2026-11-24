/**
 * 責務：フォルダの折りたたみの規則（閉じる/開く・図形を含む閉じたフォルダを開く・取り除く・今の状態を引き継ぐ）。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules のみ。閉じているときだけ collapsed: true のキーを持つ。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * フォルダのアイテムの折りたたみを変えた写しを返す（閉じるなら collapsed: true、開くならキーを消す）。
 * @param {Object} group - フォルダのアイテム
 * @param {boolean} collapsed - 閉じるなら true
 * @returns {Object} 新しいフォルダのアイテム（children は共有）
 */
function withCollapsed(group, collapsed) {
    if (collapsed) {
        return { ...group, collapsed: true };
    }
    const { collapsed: removed, ...rest } = group;
    return rest;
}

/**
 * 入れ子を再帰で写し、フォルダごとに fn の結果のフォルダへ置き換える。子が変わらず fn も同じ参照を返したら元のアイテムを共有する。
 * @param {Item[]} items - アイテムの入れ子
 * @param {function(Object): Object} fn - 子を写したフォルダのアイテムを受け取り、置き換えたフォルダのアイテムを返す
 * @returns {Item[]} 新しい入れ子（何も変わらなければ引数と同じ参照）
 */
function mapGroups(items, fn) {
    let changed = false;
    const result = items.map((item) => {
        if (item.kind !== ITEM_KIND.GROUP) {
            return item;
        }
        const children = mapGroups(item.children, fn);
        const base = children === item.children ? item : { ...item, children };
        const next = fn(base);
        if (next !== item) {
            changed = true;
        }
        return next;
    });
    return changed ? result : items;
}

/**
 * フォルダを閉じる/開く。変わらない（idのフォルダが無い・すでにその状態）ときは同じ参照を返す。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - フォルダのid
 * @param {boolean} collapsed - 閉じるなら true、開くなら false
 * @returns {Item[]} 新しい入れ子。変わらなければ引数と同じ参照
 */
export function setCollapsed(items, id, collapsed) {
    return mapGroups(items, (group) => (
        group.id === id && (group.collapsed === true) !== collapsed ? withCollapsed(group, collapsed) : group
    ));
}

/**
 * shapeIds の図形を含む閉じたフォルダ（入れ子の上のすべて）のうち、canExpand(id) が真のものを開く。
 * 変わらなければ同じ参照を返す。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Iterable<string>} shapeIds - 見えるようにしたい図形のid
 * @param {function(string): boolean} canExpand - フォルダのidを受け取り、開いてよいなら true を返す
 * @returns {Item[]} 新しい入れ子。変わらなければ引数と同じ参照
 */
export function expandGroupsContaining(items, shapeIds, canExpand) {
    const targets = new Set(shapeIds);
    if (targets.size === 0) {
        return items;
    }
    /**
     * 並びの中に対象の図形があるかを調べ、開くべきフォルダを開いた並びを返す。
     * @param {Item[]} list - アイテムの並び
     * @returns {{ list: Item[], found: boolean }} 開いた並び（変わらなければ同じ参照）と、対象の図形を含むか
     */
    const visit = (list) => {
        let found = false;
        let changed = false;
        const result = list.map((item) => {
            if (item.kind !== ITEM_KIND.GROUP) {
                if (targets.has(itemIdOf(item))) {
                    found = true;
                }
                return item;
            }
            const inner = visit(item.children);
            if (inner.found) {
                found = true;
            }
            let next = inner.list === item.children ? item : { ...item, children: inner.list };
            if (inner.found && next.collapsed === true && canExpand(item.id)) {
                next = withCollapsed(next, false);
            }
            if (next !== item) {
                changed = true;
            }
            return next;
        });
        return { list: changed ? result : list, found };
    };
    return visit(items).list;
}

/**
 * すべてのフォルダから collapsed のキーを取り除いた新しい入れ子を返す（履歴の記録から折りたたみを外すため）。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Item[]} 折りたたみの無い新しい入れ子
 */
export function withoutCollapsed(items) {
    return items.map((item) => {
        if (item.kind !== ITEM_KIND.GROUP) {
            return { ...item };
        }
        return withCollapsed({ ...item, children: withoutCollapsed(item.children) }, false);
    });
}

/**
 * 閉じているフォルダのidを前順で返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {string[]} 閉じているフォルダのid
 */
export function listCollapsedIds(items) {
    const ids = [];
    const visit = (list) => {
        for (const item of list) {
            if (item.kind === ITEM_KIND.GROUP) {
                if (item.collapsed === true) {
                    ids.push(item.id);
                }
                visit(item.children);
            }
        }
    };
    visit(items);
    return ids;
}

/**
 * items のフォルダごとに折りたたみを決める。currentItems に同じidのフォルダがあればその今の折りたたみ、
 * 無ければ recordedIds に含まれるときだけ閉じる。引数は書き換えない。
 * @param {Item[]} items - 折りたたみを決める入れ子
 * @param {Item[]} currentItems - 今のアイテムの入れ子
 * @param {Iterable<string>} recordedIds - 記録していた閉じているフォルダのid
 * @returns {Item[]} 折りたたみを決めた新しい入れ子
 */
export function restoreCollapsed(items, currentItems, recordedIds) {
    const recorded = new Set(recordedIds);
    const current = new Map();
    const collect = (list) => {
        for (const item of list) {
            if (item.kind === ITEM_KIND.GROUP) {
                current.set(item.id, item.collapsed === true);
                collect(item.children);
            }
        }
    };
    collect(currentItems);
    const rebuild = (list) => list.map((item) => {
        if (item.kind !== ITEM_KIND.GROUP) {
            return { ...item };
        }
        const collapsed = current.has(item.id) ? current.get(item.id) : recorded.has(item.id);
        return withCollapsed({ ...item, children: rebuild(item.children) }, collapsed);
    });
    return rebuild(items);
}
