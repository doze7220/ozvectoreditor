/**
 * 責務：フォルダを選んでいる状態の規則（候補・不変条件・選んでいるまとまり・自動で開く図形）を計算する。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules のみ。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * 次に選んでいるフォルダの候補を決める。
 * requestedIds が渡されていればそれ、無ければ additive が真なら今の値、偽なら空（選び直し）。
 * @param {Object} params - 引数
 * @param {Iterable<string>} params.currentIds - 今選んでいるフォルダのid
 * @param {Iterable<string>} [params.requestedIds] - 呼び出し側が指定したフォルダのid
 * @param {boolean} params.additive - 今の値を引き継ぐ（足しただけ）なら true
 * @returns {Set<string>} 候補のフォルダのid
 */
export function resolveGroupCandidates({ currentIds, requestedIds, additive }) {
    if (requestedIds !== undefined && requestedIds !== null) {
        return new Set(requestedIds);
    }
    return additive ? new Set(currentIds) : new Set();
}

/**
 * 候補のうち不変条件を満たすフォルダだけを残す。
 * 条件：(1) items に今あるフォルダ、(2) items での中の図形（入れ子の中も）がすべて selectedIds にある、
 * (3) previousItems でそのフォルダの中にあった図形もすべて selectedIds にある。中が空のフォルダは(2)(3)を満たす。
 * 候補が空なら入れ子を見ずに空を返す。引数は書き換えない。
 * @param {Object} params - 引数
 * @param {Item[]} params.previousItems - 変わる前のアイテムの入れ子
 * @param {Item[]} params.items - 変わった後のアイテムの入れ子
 * @param {Set<string>} params.selectedIds - 変わった後の図形の選択
 * @param {Set<string>} params.candidateIds - 候補のフォルダのid
 * @returns {Set<string>} 選んでいるフォルダのid
 */
export function resolveSelectedGroupIds({ previousItems, items, selectedIds, candidateIds }) {
    const result = new Set();
    if (candidateIds.size === 0) {
        return result;
    }
    const previousShapeIds = collectShapeIdsByGroup(previousItems);
    const currentShapeIds = collectShapeIdsByGroup(items);
    for (const id of candidateIds) {
        const current = currentShapeIds.get(id);
        if (current === undefined) {
            continue;
        }
        const previous = previousShapeIds.get(id) ?? [];
        if (current.every((shapeId) => selectedIds.has(shapeId))
            && previous.every((shapeId) => selectedIds.has(shapeId))) {
            result.add(id);
        }
    }
    return result;
}

/**
 * フォルダのidごとに、その中の図形のid（入れ子の中も）を集める。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Map<string, string[]>} フォルダのid → 中の図形のidの配列
 */
function collectShapeIdsByGroup(items) {
    const map = new Map();
    const visit = (list) => {
        const ids = [];
        for (const item of list) {
            if (item.kind === ITEM_KIND.GROUP) {
                const inner = visit(item.children);
                map.set(item.id, inner);
                ids.push(...inner);
            } else {
                ids.push(item.shape.id);
            }
        }
        return ids;
    };
    visit(items);
    return map;
}

/**
 * 選んでいるまとまり（選んでいるフォルダと、選んでいるフォルダの中に無い選ばれている図形）のidを前順で返す。
 * 選んでいるフォルダに当たったら中へは進まない。
 * @param {Object} params - 引数
 * @param {Item[]} params.items - アイテムの入れ子
 * @param {(id: string) => boolean} params.isSelected - 図形が選ばれているかを返す関数
 * @param {Set<string>} params.selectedGroupIds - 選んでいるフォルダのid
 * @returns {string[]} まとまりのidの配列（前順）
 */
export function resolveSelectedUnitIds({ items, isSelected, selectedGroupIds }) {
    const result = [];
    const visit = (list) => {
        for (const item of list) {
            const id = itemIdOf(item);
            if (item.kind === ITEM_KIND.GROUP) {
                if (selectedGroupIds.has(id)) {
                    result.push(id);
                } else {
                    visit(item.children);
                }
            } else if (isSelected(id)) {
                result.push(id);
            }
        }
    };
    visit(items);
    return result;
}

/**
 * 選択が変わったときに、折りたたんだフォルダを開くために見る図形のidを返す。
 * additive が真なら新しく選ばれた図形だけ。偽なら、図形の選択かフォルダの選択が集合として変わったときだけ
 * 次の選択の全部、変わらなければ空。
 * @param {Object} params - 引数
 * @param {Iterable<string>} params.previousIds - 前の図形の選択
 * @param {Iterable<string>} params.nextIds - 次の図形の選択
 * @param {Iterable<string>} params.previousGroupIds - 前のフォルダの選択
 * @param {Iterable<string>} params.nextGroupIds - 次のフォルダの選択
 * @param {boolean} params.additive - 足しただけ（Ctrl）なら true
 * @returns {string[]} 開く対象の図形のid
 */
export function resolveRevealIds({ previousIds, nextIds, previousGroupIds, nextGroupIds, additive }) {
    const previous = new Set(previousIds);
    const next = [...new Set(nextIds)];
    if (additive) {
        return next.filter((id) => !previous.has(id));
    }
    const changed = !isSameSet(previous, new Set(next))
        || !isSameSet(new Set(previousGroupIds), new Set(nextGroupIds));
    return changed ? next : [];
}

/**
 * 2つの集合が同じ要素かを返す。
 * @param {Set<string>} a - 集合
 * @param {Set<string>} b - 集合
 * @returns {boolean} 同じなら true
 */
function isSameSet(a, b) {
    if (a.size !== b.size) {
        return false;
    }
    for (const value of a) {
        if (!b.has(value)) {
            return false;
        }
    }
    return true;
}
