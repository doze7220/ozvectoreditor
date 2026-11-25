/**
 * 責務：GroupTreeRules（入れ子を動かす計算とアイテムのidの照会）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    itemIdOf,
    hasGroupItem,
    wrapUnits,
    unwrapGroups,
    removeItems,
    listSiblingLists,
    mapSiblingLists,
    isSameTree,
    pickItems,
    listGroupIds
} from '../../js/core/GroupTreeRules.js';

const s = (id) => ({ kind: 'shape', shape: { id } });
const g = (id, children = []) => ({ kind: 'group', id, children });
const NEW_GROUP = { kind: 'group', children: [] };

/** 入れ子を id の入れ子（フォルダは [id, 子...]）へ直す。 */
function shape(items) {
    return items.map((item) => (item.kind === 'group' ? { [item.id ?? 'new']: shape(item.children) } : item.shape.id));
}

describe('itemIdOf / hasGroupItem', () => {
    it('図形は shape.id、フォルダは id', () => {
        assert.equal(itemIdOf(s('a')), 'a');
        assert.equal(itemIdOf(g('G1')), 'G1');
    });
    it('hasGroupItem は入れ子にフォルダがあるかを返す', () => {
        assert.equal(hasGroupItem([]), false);
        assert.equal(hasGroupItem([s('a')]), false);
        assert.equal(hasGroupItem([s('a'), g('G1')]), true);
    });
});

describe('wrapUnits', () => {
    it('隣り合うまとまりを1つにまとめる', () => {
        const result = wrapUnits([s('a'), s('b'), s('c')], new Set(['a', 'b']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ new: ['a', 'b'] }, 'c']);
    });
    it('離れたまとまりは前順で最後のまとまりの位置に置く', () => {
        const result = wrapUnits([s('a'), s('b'), s('c'), s('d')], new Set(['a', 'c']), NEW_GROUP);
        assert.deepEqual(shape(result), ['b', { new: ['a', 'c'] }, 'd']);
    });
    it('別々のフォルダの中のまとまりは、最後のまとまりのフォルダの中にできる', () => {
        const items = [g('G1', [s('a'), s('b')]), g('G2', [s('c'), s('d')])];
        const result = wrapUnits(items, new Set(['a', 'c']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ G1: ['b'] }, { G2: [{ new: ['a', 'c'] }, 'd'] }]);
    });
    it('入れ子のフォルダごとまとめる', () => {
        const items = [g('G1', [s('a'), g('G2', [s('b')])]), s('c')];
        const result = wrapUnits(items, new Set(['G1', 'c']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ new: [{ G1: ['a', { G2: ['b'] }] }, 'c'] }]);
    });
    it('図形1つだけをまとめる', () => {
        const result = wrapUnits([s('a'), s('b')], new Set(['b']), NEW_GROUP);
        assert.deepEqual(shape(result), ['a', { new: ['b'] }]);
    });
    it('フォルダ1つだけをまとめる', () => {
        const result = wrapUnits([g('G1', [s('a')]), s('b')], new Set(['G1']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ new: [{ G1: ['a'] }] }, 'b']);
    });
    it('空のフォルダもまとめられる', () => {
        const result = wrapUnits([g('G1'), s('a')], new Set(['G1', 'a']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ new: [{ G1: [] }, 'a'] }]);
    });
    it('一番上のまとまりがフォルダの中なら、そのフォルダの中にできる', () => {
        const items = [s('a'), g('G1', [s('b'), s('c')])];
        const result = wrapUnits(items, new Set(['a', 'b']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ G1: [{ new: ['a', 'b'] }, 'c'] }]);
    });
    it('元のフォルダが空になっても残る', () => {
        const items = [g('G1', [s('a')]), s('b')];
        const result = wrapUnits(items, new Set(['a', 'b']), NEW_GROUP);
        assert.deepEqual(shape(result), [{ G1: [] }, { new: ['a', 'b'] }]);
    });
    it('中の順番は前順のまま', () => {
        const result = wrapUnits([s('a'), s('b'), s('c')], new Set(['c', 'a']), NEW_GROUP);
        assert.deepEqual(shape(result), ['b', { new: ['a', 'c'] }]);
    });
    it('新しいフォルダは group の属性を持つ', () => {
        const result = wrapUnits([s('a')], new Set(['a']), { kind: 'group', name: 'X', children: [] });
        assert.equal(result[0].name, 'X');
    });
    it('引数を書き換えない', () => {
        const items = [s('a'), g('G1', [s('b')]), s('c')];
        const group = { kind: 'group', children: [] };
        const before = JSON.stringify(items);
        wrapUnits(items, new Set(['a', 'b']), group);
        assert.equal(JSON.stringify(items), before);
        assert.deepEqual(group.children, []);
    });
});

describe('unwrapGroups', () => {
    it('1段のフォルダを中身へ置き換える', () => {
        const result = unwrapGroups([s('a'), g('G1', [s('b'), s('c')]), s('d')], new Set(['G1']));
        assert.deepEqual(shape(result), ['a', 'b', 'c', 'd']);
    });
    it('入れ子の中のフォルダは残る', () => {
        const result = unwrapGroups([g('G1', [s('a'), g('G2', [s('b')])])], new Set(['G1']));
        assert.deepEqual(shape(result), ['a', { G2: ['b'] }]);
    });
    it('空のフォルダは消える', () => {
        const result = unwrapGroups([s('a'), g('G1')], new Set(['G1']));
        assert.deepEqual(shape(result), ['a']);
    });
    it('複数のフォルダを解除する', () => {
        const result = unwrapGroups([g('G1', [s('a')]), g('G2', [s('b')])], new Set(['G1', 'G2']));
        assert.deepEqual(shape(result), ['a', 'b']);
    });
    it('別々のフォルダの中のフォルダを解除する', () => {
        const items = [g('G1', [g('G3', [s('a')])]), g('G2', [g('G4', [s('b')])])];
        const result = unwrapGroups(items, new Set(['G3', 'G4']));
        assert.deepEqual(shape(result), [{ G1: ['a'] }, { G2: ['b'] }]);
    });
    it('引数を書き換えない', () => {
        const items = [g('G1', [s('a')])];
        const before = JSON.stringify(items);
        unwrapGroups(items, new Set(['G1']));
        assert.equal(JSON.stringify(items), before);
    });
});

describe('removeItems', () => {
    it('図形を除く', () => {
        assert.deepEqual(shape(removeItems([s('a'), s('b')], new Set(['a']))), ['b']);
    });
    it('フォルダは中身ごと除く', () => {
        const result = removeItems([s('a'), g('G1', [s('b')])], new Set(['G1']));
        assert.deepEqual(shape(result), ['a']);
    });
    it('空のフォルダも除く', () => {
        assert.deepEqual(shape(removeItems([g('G1'), s('a')], new Set(['G1']))), ['a']);
    });
    it('図形とフォルダが混ざっていても除く', () => {
        const result = removeItems([s('a'), g('G1', [s('b')]), s('c')], new Set(['a', 'G1']));
        assert.deepEqual(shape(result), ['c']);
    });
    it('図形だけを除いたフォルダは空になっても残る', () => {
        const result = removeItems([g('G1', [s('a')])], new Set(['a']));
        assert.deepEqual(shape(result), [{ G1: [] }]);
    });
    it('何も除かなければ同じ構造', () => {
        const items = [s('a'), g('G1', [s('b')])];
        assert.deepEqual(shape(removeItems(items, new Set())), shape(items));
    });
    it('引数を書き換えない', () => {
        const items = [g('G1', [s('a'), s('b')])];
        const before = JSON.stringify(items);
        removeItems(items, new Set(['a']));
        assert.equal(JSON.stringify(items), before);
    });
});

describe('listSiblingLists / mapSiblingLists', () => {
    it('いちばん外側 → 前順のフォルダの順に並びを列挙する（空のフォルダも）', () => {
        const g2 = g('G2', [s('b')]);
        const g1 = g('G1', [g2, s('a')]);
        const g3 = g('G3');
        const items = [g1, g3];
        const lists = listSiblingLists(items);
        assert.equal(lists.length, 4);
        assert.equal(lists[0], items);
        assert.equal(lists[1], g1.children);
        assert.equal(lists[2], g2.children);
        assert.equal(lists[3], g3.children);
    });
    it('フォルダの無い絵では並びが1つ', () => {
        assert.equal(listSiblingLists([s('a')]).length, 1);
    });
    it('mapSiblingLists は各並びを fn の結果に置き換え、空の並びでも1回呼ぶ', () => {
        const items = [g('G1', [s('a'), s('b')]), g('G2'), s('c')];
        let calls = 0;
        const result = mapSiblingLists(items, (list) => {
            calls += 1;
            return list.slice().reverse();
        });
        assert.equal(calls, 3);
        assert.deepEqual(shape(result), ['c', { G2: [] }, { G1: ['b', 'a'] }]);
    });
    it('mapSiblingLists は外側 → フォルダの順に呼ぶ', () => {
        const items = [g('G1', [s('a')]), s('b')];
        const sizes = [];
        mapSiblingLists(items, (list) => {
            sizes.push(list.length);
            return list;
        });
        assert.deepEqual(sizes, [2, 1]);
    });
    it('引数を書き換えない', () => {
        const items = [g('G1', [s('a'), s('b')])];
        const before = JSON.stringify(items);
        mapSiblingLists(items, (list) => list.slice().reverse());
        assert.equal(JSON.stringify(items), before);
    });
});

describe('isSameTree', () => {
    it('同じ構造なら true（別のオブジェクトでも）', () => {
        assert.equal(isSameTree([s('a'), g('G1', [s('b')])], [s('a'), g('G1', [s('b')])]), true);
        assert.equal(isSameTree([], []), true);
    });
    it('順が違えば false', () => {
        assert.equal(isSameTree([s('a'), s('b')], [s('b'), s('a')]), false);
    });
    it('入れ子が違えば false', () => {
        assert.equal(isSameTree([g('G1', [s('a')]), s('b')], [g('G1', [s('a'), s('b')])]), false);
        assert.equal(isSameTree([g('G1', [s('a')])], [g('G1', [])]), false);
    });
    it('idが違えば false', () => {
        assert.equal(isSameTree([g('G1')], [g('G2')]), false);
        assert.equal(isSameTree([s('a')], [s('b')]), false);
    });
    it('同じidでも種類が違えば false', () => {
        assert.equal(isSameTree([s('a')], [g('a')]), false);
    });
    it('名前等の属性は見ない', () => {
        assert.equal(isSameTree([{ ...g('G1'), name: 'x' }], [{ ...g('G1'), name: 'y' }]), true);
    });
});

describe('pickItems / listGroupIds', () => {
    it('pickItems は前順で集め、当たったフォルダの中へは進まない（要素は同じ参照）', () => {
        const inner = s('b');
        const group = g('G1', [inner, s('c')]);
        const items = [s('a'), group, g('G2', [s('d')])];
        const picked = pickItems(items, new Set(['G1', 'b', 'd']));
        assert.equal(picked.length, 2);
        assert.equal(picked[0], group);
        assert.equal(picked[1], items[2].children[0]);
    });
    it('pickItems は当たらなければ空・引数を書き換えない', () => {
        const items = [s('a'), g('G1', [s('b')])];
        const before = JSON.stringify(items);
        assert.deepEqual(pickItems(items, new Set(['zzz'])), []);
        assert.equal(JSON.stringify(items), before);
    });
    it('listGroupIds は入れ子の中も前順で列挙する', () => {
        const items = [g('G1', [g('G2', [s('a')]), s('b')]), s('c'), g('G3')];
        assert.deepEqual(listGroupIds(items), ['G1', 'G2', 'G3']);
        assert.deepEqual(listGroupIds([s('a')]), []);
    });
});
