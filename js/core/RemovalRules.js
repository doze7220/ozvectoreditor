/**
 * 責務：選んでいるまとまりのうち消えるもの・残すもの・写すものを求める（削除・切り取り・Alt+ドラッグの複製の共通の規則）。
 * 状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules・ItemStateRules のみ。図形は id だけを読む。
 */
import { ITEM_KIND } from './ItemTreeRules.js';
import { itemIdOf } from './GroupTreeRules.js';
import { collectEditableIds } from './ItemStateRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * 消えた後の入れ子・写すもの・写すまとまりのid。
 * @typedef {Object} RemovalResult
 * @property {Item[]} nextItems - 消えた後の入れ子
 * @property {Item[]} copies - まとまりごとの写し（前順。写しの無いまとまりは入らない）
 * @property {string[]} copyUnitIds - copies に対応するまとまりのid（前順）
 */

/**
 * まとまり1つを、残るものと写すものへ分ける（再帰）。
 * 図形は、変えられるなら消えて写され、変えられないなら残る。
 * フォルダは、自分が変えられ残る中身が1つも無ければ消えて（中身の写しを入れた形で）写され、
 * それ以外は残る中身を入れた形で残り、写すものがあるときだけ写すものを入れた形で写される。
 * @param {Item} item - まとまり（またはその中のアイテム）
 * @param {Set<string>} editable - 変えられるアイテムのid
 * @returns {{keep: Item|null, copy: Item|null}} 残るアイテム・写すアイテム（無ければ null）
 */
function splitUnit(item, editable) {
    if (item.kind !== ITEM_KIND.GROUP) {
        return editable.has(itemIdOf(item))
            ? { keep: null, copy: item }
            : { keep: item, copy: null };
    }
    const keptChildren = [];
    const copiedChildren = [];
    for (const child of item.children) {
        const part = splitUnit(child, editable);
        if (part.keep) keptChildren.push(part.keep);
        if (part.copy) copiedChildren.push(part.copy);
    }
    if (editable.has(item.id) && keptChildren.length === 0) {
        return { keep: null, copy: { ...item, children: copiedChildren } };
    }
    return {
        keep: { ...item, children: keptChildren },
        copy: copiedChildren.length > 0 ? { ...item, children: copiedChildren } : null
    };
}

/**
 * 選んでいるまとまりから、消えるもの・残すもの・写すものを求める。
 * 何も消えない（写すものが1つも無い）ときは null。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {Set<string>} unitIds - 選んでいるまとまりのid（互いに含み合わない）
 * @returns {RemovalResult|null} 結果。何も消えなければ null
 */
export function resolveRemoval(items, unitIds) {
    const editable = collectEditableIds(items);
    const copies = [];
    const copyUnitIds = [];
    const rebuild = (list) => {
        const result = [];
        for (const item of list) {
            const id = itemIdOf(item);
            if (unitIds.has(id)) {
                const part = splitUnit(item, editable);
                if (part.keep) result.push(part.keep);
                if (part.copy) {
                    copies.push(part.copy);
                    copyUnitIds.push(id);
                }
            } else if (item.kind === ITEM_KIND.GROUP) {
                result.push({ ...item, children: rebuild(item.children) });
            } else {
                result.push(item);
            }
        }
        return result;
    };
    const nextItems = rebuild(items);
    if (copies.length === 0) return null;
    return { nextItems, copies, copyUnitIds };
}
