/**
 * 責務：GroupCollapseRules（フォルダの折りたたみの規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    setCollapsed,
    expandGroupsContaining,
    withoutCollapsed,
    listCollapsedIds,
    restoreCollapsed
} from '../../js/core/GroupCollapseRules.js';

const s = (id) => ({ kind: 'shape', shape: { id } });
const g = (id, children = [], collapsed = false) => (
    collapsed ? { kind: 'group', id, collapsed: true, children } : { kind: 'group', id, children }
);

/** 入れ子を図形はid、フォルダは { id, collapsed, children } の形へ直す。 */
function outline(items) {
    return items.map((item) => (item.kind === 'group'
        ? { id: item.id, collapsed: item.collapsed === true, children: outline(item.children) }
        : item.shape.id));
}

describe('setCollapsed', () => {
    it('開いたフォルダを閉じる（collapsed: true）', () => {
        const items = [g('G1', [s('a')])];
        const result = setCollapsed(items, 'G1', true);
        assert.equal(result[0].collapsed, true);
        assert.notEqual(result, items);
    });

    it('閉じたフォルダを開くとキー自体が消える', () => {
        const items = [g('G1', [s('a')], true)];
        const result = setCollapsed(items, 'G1', false);
        assert.equal(Object.hasOwn(result[0], 'collapsed'), false);
        assert.notEqual(result[0], items[0]);
    });

    it('すでにその状態・無いidなら同じ参照を返す', () => {
        const items = [g('G1', [s('a')]), g('G2', [], true)];
        assert.equal(setCollapsed(items, 'G1', false), items);
        assert.equal(setCollapsed(items, 'G2', true), items);
        assert.equal(setCollapsed(items, 'none', true), items);
    });

    it('入れ子の中のフォルダも変えられ、図形のidには反応しない', () => {
        const items = [g('G1', [g('G2', [s('a')])])];
        const result = setCollapsed(items, 'G2', true);
        assert.equal(result[0].children[0].collapsed, true);
        assert.equal(Object.hasOwn(result[0], 'collapsed'), false);
        assert.equal(setCollapsed(items, 'a', true), items);
    });

    it('引数を書き換えない・図形のアイテムは共有する', () => {
        const items = [g('G1', [s('a')]), s('b')];
        const before = JSON.stringify(items);
        const result = setCollapsed(items, 'G1', true);
        assert.equal(JSON.stringify(items), before);
        assert.equal(result[1], items[1]);
    });
});

describe('expandGroupsContaining', () => {
    it('図形を含む閉じたフォルダを、入れ子の上のすべて開く', () => {
        const items = [g('G1', [g('G2', [s('a')], true), s('b')], true)];
        const result = expandGroupsContaining(items, ['a'], () => true);
        assert.deepEqual(outline(result), [
            { id: 'G1', collapsed: false, children: [{ id: 'G2', collapsed: false, children: ['a'] }, 'b'] }
        ]);
    });

    it('図形を含まないフォルダ・ほかの閉じたフォルダは閉じたまま', () => {
        const items = [g('G1', [s('a')], true), g('G2', [s('b')], true)];
        const result = expandGroupsContaining(items, ['b'], () => true);
        assert.deepEqual(outline(result).map((x) => x.collapsed), [true, false]);
    });

    it('canExpandが偽のフォルダは開かない（上のフォルダは開く）', () => {
        const items = [g('G1', [g('G2', [s('a')], true)], true)];
        const result = expandGroupsContaining(items, ['a'], (id) => id === 'G1');
        assert.deepEqual(outline(result), [
            { id: 'G1', collapsed: false, children: [{ id: 'G2', collapsed: true, children: ['a'] }] }
        ]);
    });

    it('変わらなければ同じ参照を返す（空・開いている・対象外・canExpandが全部偽）', () => {
        const items = [g('G1', [s('a')]), g('G2', [s('b')], true)];
        assert.equal(expandGroupsContaining(items, [], () => true), items);
        assert.equal(expandGroupsContaining(items, ['a'], () => true), items);
        assert.equal(expandGroupsContaining(items, ['none'], () => true), items);
        assert.equal(expandGroupsContaining(items, ['b'], () => false), items);
    });

    it('Setを受けられ、引数を書き換えない', () => {
        const items = [g('G1', [s('a')], true)];
        const before = JSON.stringify(items);
        const result = expandGroupsContaining(items, new Set(['a']), () => true);
        assert.equal(JSON.stringify(items), before);
        assert.equal(Object.hasOwn(result[0], 'collapsed'), false);
    });
});

describe('withoutCollapsed / listCollapsedIds', () => {
    it('withoutCollapsedはすべてのフォルダからキーを消した新しい入れ子を返す', () => {
        const items = [g('G1', [g('G2', [s('a')], true)], true), s('b')];
        const before = JSON.stringify(items);
        const result = withoutCollapsed(items);
        assert.equal(JSON.stringify(items), before);
        assert.equal(JSON.stringify(result).includes('collapsed'), false);
        assert.deepEqual(outline(result), [
            { id: 'G1', collapsed: false, children: [{ id: 'G2', collapsed: false, children: ['a'] }] },
            'b'
        ]);
        assert.notEqual(result[1], items[1]);
        assert.equal(result[1].shape, items[1].shape);
    });

    it('listCollapsedIdsは閉じているフォルダのidを前順で返す', () => {
        const items = [g('G1', [g('G2', [], true), g('G3')], true), g('G4'), g('G5', [], true)];
        assert.deepEqual(listCollapsedIds(items), ['G1', 'G2', 'G5']);
        assert.deepEqual(listCollapsedIds([s('a')]), []);
    });
});

describe('restoreCollapsed', () => {
    it('今あるフォルダは今の折りたたみ、無いフォルダは記録の状態', () => {
        const items = [g('G1', [s('a')]), g('G2', [s('b')], true), g('G3', [g('G4')]), g('G5')];
        const current = [g('G1', [], true), g('G2')];
        const result = restoreCollapsed(items, current, ['G3', 'G1', 'G2']);
        assert.deepEqual(outline(result).map((x) => x.collapsed), [true, false, true, false]);
        assert.equal(outline(result)[2].children[0].collapsed, false);
    });

    it('入れ子の中のフォルダも決め、記録のidが入れ子の中でも効く', () => {
        const items = [g('G1', [g('G2', [s('a')])])];
        const result = restoreCollapsed(items, [], ['G2']);
        assert.deepEqual(outline(result), [
            { id: 'G1', collapsed: false, children: [{ id: 'G2', collapsed: true, children: ['a'] }] }
        ]);
    });

    it('開いているときはキーを持たない', () => {
        const result = restoreCollapsed([g('G1', [], true)], [g('G1')], []);
        assert.equal(Object.hasOwn(result[0], 'collapsed'), false);
    });

    it('引数を書き換えない', () => {
        const items = [g('G1', [s('a')], true)];
        const current = [g('G1')];
        const before = JSON.stringify([items, current]);
        restoreCollapsed(items, current, ['G1']);
        assert.equal(JSON.stringify([items, current]), before);
    });
});
