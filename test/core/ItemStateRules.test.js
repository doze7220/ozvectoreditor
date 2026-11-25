/**
 * 責務：ItemStateRules（表示・ロックの規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    listItemStates,
    listVisibleShapes,
    listEditableShapes,
    collectEditableIds,
    collectItemStates,
    resolveVisibleToggle,
    resolveLockToggle,
    applyItemStates
} from '../../js/core/ItemStateRules.js';

const s = (id, extra = {}) => ({ kind: 'shape', shape: { id }, ...extra });
const g = (id, children = [], extra = {}) => ({ kind: 'group', id, children, ...extra });
const ids = (shapes) => shapes.map((x) => x.id);

describe('listItemStates', () => {
    it('値が無いアイテムは表示あり・ロックなし・変えられる', () => {
        const [st] = listItemStates([s('a')]);
        assert.equal(st.id, 'a');
        assert.equal(st.visible, true);
        assert.equal(st.locked, false);
        assert.equal(st.hidden, false);
        assert.equal(st.editable, true);
        assert.equal(st.hiddenByAncestor, false);
        assert.equal(st.lockedByAncestor, false);
    });

    it('自分だけ隠す・自分だけロック', () => {
        const states = collectItemStates([s('a', { visible: false }), s('b', { locked: true }), s('c')]);
        assert.equal(states.get('a').hidden, true);
        assert.equal(states.get('a').editable, false);
        assert.equal(states.get('b').hidden, false);
        assert.equal(states.get('b').editable, false);
        assert.equal(states.get('c').editable, true);
    });

    it('親が隠れていると中も隠れる（自分の値は変わらない）', () => {
        const states = collectItemStates([g('G', [s('a')], { visible: false })]);
        assert.equal(states.get('G').hidden, true);
        assert.equal(states.get('a').visible, true);
        assert.equal(states.get('a').hiddenByAncestor, true);
        assert.equal(states.get('a').hidden, true);
        assert.equal(states.get('a').editable, false);
    });

    it('親がロックされていると中は変えられない（隠れてはいない）', () => {
        const states = collectItemStates([g('G', [s('a')], { locked: true })]);
        assert.equal(states.get('a').lockedByAncestor, true);
        assert.equal(states.get('a').locked, false);
        assert.equal(states.get('a').hidden, false);
        assert.equal(states.get('a').editable, false);
        assert.equal(states.get('G').editable, false);
    });

    it('自分と親の両方', () => {
        const states = collectItemStates([g('G', [s('a', { visible: false, locked: true })], { locked: true })]);
        const a = states.get('a');
        assert.equal(a.hidden, true);
        assert.equal(a.lockedByAncestor, true);
        assert.equal(a.locked, true);
        assert.equal(a.editable, false);
    });

    it('深い入れ子へ受け継ぐ', () => {
        const states = collectItemStates([g('A', [g('B', [g('C', [s('x')])])], { visible: false })]);
        assert.equal(states.get('x').hiddenByAncestor, true);
        assert.equal(states.get('C').hiddenByAncestor, true);
        const st2 = collectItemStates([g('A', [g('B', [g('C', [s('x')])], { locked: true })])]);
        assert.equal(st2.get('A').lockedByAncestor, false);
        assert.equal(st2.get('B').lockedByAncestor, false);
        assert.equal(st2.get('C').lockedByAncestor, true);
        assert.equal(st2.get('x').lockedByAncestor, true);
    });

    it('兄弟には効かない', () => {
        const states = collectItemStates([g('G', [s('a')], { visible: false, locked: true }), s('b'), g('H', [s('c')])]);
        assert.equal(states.get('b').editable, true);
        assert.equal(states.get('c').editable, true);
        assert.equal(states.get('H').editable, true);
    });

    it('空のフォルダ', () => {
        const states = collectItemStates([g('E'), g('F', [], { locked: true })]);
        assert.equal(states.get('E').editable, true);
        assert.equal(states.get('F').editable, false);
    });

    it('前順（フォルダ自身→中身）で返し、itemは引数のものそのもの', () => {
        const a = s('a');
        const G = g('G', [a]);
        const list = listItemStates([G, s('b')]);
        assert.deepEqual(list.map((x) => x.id), ['G', 'a', 'b']);
        assert.equal(list[0].item, G);
        assert.equal(list[1].item, a);
    });

    it('visible が false 以外・locked が true 以外は既定として扱う', () => {
        const [st] = listItemStates([s('a', { visible: undefined, locked: false })]);
        assert.equal(st.visible, true);
        assert.equal(st.locked, false);
    });
});

describe('listVisibleShapes / listEditableShapes / collectEditableIds', () => {
    const items = [
        s('a'),
        g('H', [s('b'), s('c', { locked: true })], { visible: false }),
        g('L', [s('d'), g('M', [s('e')])], { locked: true }),
        s('f', { visible: false }),
        s('g'),
        g('E')
    ];

    it('見える図形は隠れていないものだけ（ロックは含む）・重なり順', () => {
        assert.deepEqual(ids(listVisibleShapes(items)), ['a', 'd', 'e', 'g']);
    });

    it('変えられる図形は隠れてもロックされてもいないものだけ・重なり順', () => {
        assert.deepEqual(ids(listEditableShapes(items)), ['a', 'g']);
    });

    it('変えられるid（図形とフォルダ）', () => {
        assert.deepEqual([...collectEditableIds(items)].sort(), ['E', 'a', 'g']);
    });

    it('すべて隠れていれば空', () => {
        assert.deepEqual(listVisibleShapes([s('a', { visible: false })]), []);
        assert.deepEqual(listEditableShapes([]), []);
    });

    it('図形は引数のインスタンスそのもの', () => {
        const shape = { id: 'z' };
        const [out] = listVisibleShapes([{ kind: 'shape', shape }]);
        assert.equal(out, shape);
    });
});

describe('resolveVisibleToggle / resolveLockToggle', () => {
    const items = [s('a'), s('b', { visible: false, locked: true }), g('G', [s('c')], { visible: false })];

    it('自分の値の反対', () => {
        assert.deepEqual(resolveVisibleToggle(items, 'a'), { id: 'a', visible: false });
        assert.deepEqual(resolveVisibleToggle(items, 'b'), { id: 'b', visible: true });
        assert.deepEqual(resolveLockToggle(items, 'a'), { id: 'a', locked: true });
        assert.deepEqual(resolveLockToggle(items, 'b'), { id: 'b', locked: false });
    });

    it('フォルダ・上から隠れた図形でも自分の値の反対', () => {
        assert.deepEqual(resolveVisibleToggle(items, 'G'), { id: 'G', visible: true });
        assert.deepEqual(resolveVisibleToggle(items, 'c'), { id: 'c', visible: false });
    });

    it('無いidは null', () => {
        assert.equal(resolveVisibleToggle(items, 'zz'), null);
        assert.equal(resolveLockToggle(items, 'zz'), null);
    });
});

describe('applyItemStates', () => {
    it('図形の表示とロックを変える', () => {
        const items = [s('a'), s('b')];
        const out = applyItemStates(items, [{ id: 'a', visible: false, locked: true }]);
        assert.equal(out[0].visible, false);
        assert.equal(out[0].locked, true);
        assert.equal(out[1], items[1]);
        assert.notEqual(out, items);
    });

    it('複数の変更', () => {
        const out = applyItemStates([s('a'), s('b')], [{ id: 'a', visible: false }, { id: 'b', locked: true }]);
        assert.equal(out[0].visible, false);
        assert.equal(out[1].locked, true);
    });

    it('片方だけ変えると、もう片方のキーは足さない', () => {
        const [a] = applyItemStates([s('a')], [{ id: 'a', visible: false }]);
        assert.equal(a.visible, false);
        assert.equal('locked' in a, false);
    });

    it('変わらなければ同じ参照', () => {
        const items = [s('a', { visible: false }), g('G', [s('b')])];
        assert.equal(applyItemStates(items, [{ id: 'a', visible: false }]), items);
        assert.equal(applyItemStates(items, [{ id: 'b', visible: true, locked: false }]), items);
        assert.equal(applyItemStates(items, []), items);
    });

    it('無いid・真偽値でない値は無視（同じ参照）', () => {
        const items = [s('a')];
        assert.equal(applyItemStates(items, [{ id: 'zz', visible: false }]), items);
        assert.equal(applyItemStates(items, [{ id: 'a', visible: 'no', locked: 1 }]), items);
        assert.equal(applyItemStates(items, [{ id: 'a' }]), items);
    });

    it('入れ子の中を変えると通り道だけ新しくなり、通り道でないフォルダは同じ参照', () => {
        const inner = g('I', [s('x'), s('y')]);
        const other = g('O', [s('z')]);
        const items = [g('G', [inner]), other];
        const out = applyItemStates(items, [{ id: 'x', locked: true }]);
        assert.notEqual(out, items);
        assert.notEqual(out[0], items[0]);
        assert.notEqual(out[0].children[0], inner);
        assert.equal(out[1], other);
        assert.equal(out[0].children[0].children[0].locked, true);
        assert.equal(out[0].children[0].children[1], inner.children[1]);
    });

    it('フォルダの値を変えても中のものの値は変わらない', () => {
        const items = [g('G', [s('a', { visible: true, locked: false })])];
        const out = applyItemStates(items, [{ id: 'G', visible: false, locked: true }]);
        assert.equal(out[0].visible, false);
        assert.equal(out[0].locked, true);
        assert.equal(out[0].children, items[0].children);
    });

    it('引数を書き換えない・図形インスタンスは共有', () => {
        const shape = { id: 'a' };
        const items = [{ kind: 'shape', shape }];
        const snapshot = JSON.stringify(items);
        const out = applyItemStates(items, [{ id: 'a', visible: false }]);
        assert.equal(JSON.stringify(items), snapshot);
        assert.equal('visible' in items[0], false);
        assert.equal(out[0].shape, shape);
    });

    it('collapsed 等のほかのキーが残る', () => {
        const items = [g('G', [s('a', { name: '名' })], { collapsed: true, name: 'F' })];
        const out = applyItemStates(items, [{ id: 'G', visible: false }, { id: 'a', locked: true }]);
        assert.equal(out[0].collapsed, true);
        assert.equal(out[0].name, 'F');
        assert.equal(out[0].children[0].name, '名');
    });

    it('同じidの変更は後のものが優先', () => {
        const [a] = applyItemStates([s('a')], [{ id: 'a', visible: false }, { id: 'a', visible: true }, { id: 'a', locked: true }]);
        assert.equal('visible' in a, false);
        assert.equal(a.locked, true);
    });
});
