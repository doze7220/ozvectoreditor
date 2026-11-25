/**
 * 責務：RemovalRules（消えるもの・残すもの・写すものの規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveRemoval } from '../../js/core/RemovalRules.js';
import { pickItems, removeItems } from '../../js/core/GroupTreeRules.js';

const s = (id, extra = {}) => ({ kind: 'shape', shape: { id }, ...extra });
const g = (id, children = [], extra = {}) => ({ kind: 'group', id, children, ...extra });
const outline = (items) => items.map((it) => (it.kind === 'group' ? [it.id, outline(it.children)] : it.shape.id));

describe('resolveRemoval', () => {
    it('すべて変えられる：removeItems・pickItems と同じ結果', () => {
        const items = [s('a'), g('G', [s('b'), s('c')], { name: 'N' }), s('d')];
        const ids = new Set(['a', 'G']);
        const r = resolveRemoval(items, ids);
        assert.deepEqual(r.nextItems, removeItems(items, ids));
        assert.deepEqual(r.copies, pickItems(items, ids));
        assert.deepEqual(r.copyUnitIds, ['a', 'G']);
    });

    it('ロックした図形・隠した図形が混ざるフォルダ：フォルダと残ったものが残り、写しは変えられるものだけ', () => {
        const items = [g('G', [s('a'), s('b', { locked: true }), s('c', { visible: false }), s('d')], { name: 'N', collapsed: true })];
        const r = resolveRemoval(items, new Set(['G']));
        assert.deepEqual(outline(r.nextItems), [['G', ['b', 'c']]]);
        assert.deepEqual(outline(r.copies), [['G', ['a', 'd']]]);
        assert.deepEqual(r.copyUnitIds, ['G']);
        assert.equal(r.nextItems[0].name, 'N');
        assert.equal(r.copies[0].name, 'N');
        assert.equal(r.copies[0].collapsed, true);
    });

    it('入れ子の一部だけ消える', () => {
        const items = [g('G', [s('a'), g('H', [s('b', { locked: true }), s('c')]), g('I', [s('d')])])];
        const r = resolveRemoval(items, new Set(['G']));
        assert.deepEqual(outline(r.nextItems), [['G', [['H', ['b']]]]]);
        assert.deepEqual(outline(r.copies), [['G', ['a', ['H', ['c']], ['I', ['d']]]]]);
    });

    it('ロックしたフォルダ・隠したフォルダ（上から受け継ぐ）は何も消えない', () => {
        const items = [g('L', [s('a'), g('M', [s('b')])], { locked: true }), g('V', [s('c')], { visible: false })];
        assert.equal(resolveRemoval(items, new Set(['L'])), null);
        assert.equal(resolveRemoval(items, new Set(['V'])), null);
        assert.equal(resolveRemoval(items, new Set(['L', 'V'])), null);
        assert.equal(resolveRemoval(items, new Set(['a', 'b', 'c'])), null);
    });

    it('空のフォルダ：変えられるなら消え、変えられないなら残る', () => {
        const items = [g('E', []), g('F', [], { locked: true }), g('H', [], { visible: false })];
        const r = resolveRemoval(items, new Set(['E']));
        assert.deepEqual(outline(r.nextItems), [['F', []], ['H', []]]);
        assert.deepEqual(outline(r.copies), [['E', []]]);
        assert.equal(resolveRemoval(items, new Set(['F'])), null);
        assert.equal(resolveRemoval(items, new Set(['H'])), null);
    });

    it('変えられないものだけのフォルダの中の空のフォルダは残る', () => {
        const items = [g('L', [g('E', [])], { locked: true })];
        assert.equal(resolveRemoval(items, new Set(['L'])), null);
        assert.equal(resolveRemoval(items, new Set(['E'])), null);
    });

    it('変えられる空のフォルダを中に持つフォルダは、外が変えられるなら一緒に消える', () => {
        const items = [g('G', [g('E', [])])];
        const r = resolveRemoval(items, new Set(['G']));
        assert.deepEqual(outline(r.nextItems), []);
        assert.deepEqual(outline(r.copies), [['G', [['E', []]]]]);
    });

    it('写しの無いまとまりが copyUnitIds に入らない', () => {
        const items = [s('a', { locked: true }), s('b'), g('L', [s('c')], { locked: true })];
        const r = resolveRemoval(items, new Set(['a', 'b', 'L']));
        assert.deepEqual(r.copyUnitIds, ['b']);
        assert.deepEqual(outline(r.copies), ['b']);
        assert.deepEqual(outline(r.nextItems), ['a', ['L', ['c']]]);
    });

    it('まとまりの外のフォルダが空になっても残る', () => {
        const items = [g('G', [s('a')]), s('b')];
        const r = resolveRemoval(items, new Set(['a']));
        assert.deepEqual(outline(r.nextItems), [['G', []], 'b']);
        assert.deepEqual(r.copyUnitIds, ['a']);
    });

    it('何も消えないと null・まとまりが空でも null', () => {
        const items = [s('a', { locked: true }), s('b')];
        assert.equal(resolveRemoval(items, new Set(['a'])), null);
        assert.equal(resolveRemoval(items, new Set()), null);
        assert.equal(resolveRemoval([], new Set(['a'])), null);
    });

    it('引数を書き換えない', () => {
        const items = [g('G', [s('a'), s('b', { locked: true })], { name: 'N' }), s('c')];
        const snapshot = JSON.stringify(items);
        const ids = new Set(['G', 'c']);
        resolveRemoval(items, ids);
        assert.equal(JSON.stringify(items), snapshot);
        assert.deepEqual([...ids], ['G', 'c']);
    });
});
