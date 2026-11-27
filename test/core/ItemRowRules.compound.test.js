/**
 * 責務：一覧の行・行の見た目の`compound`（複合パスのフォルダの絵の材料）を確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildItemRows, resolveRowViews } from '../../js/core/ItemRowRules.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 図形のアイテムを作る。
 * @param {string} id - 図形のid
 * @returns {Object} 図形のアイテム
 */
function s(id) {
    const shape = new Rect(0, 0, 10, 10, '#000000', 1, '#ff0000');
    shape.id = id;
    return { kind: ITEM_KIND.SHAPE, shape };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Object[]} children - 中身
 * @param {Object} [attrs] - compound・collapsedなど
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, attrs = {}) {
    return { kind: ITEM_KIND.GROUP, id, children, ...attrs };
}

const noSel = () => false;

describe('行のcompound', () => {
    it('複合パスのフォルダだけ真。普通のフォルダと図形は偽', () => {
        const items = [s('a'), g('plain', [s('b')]), g('cp', [s('c')], { compound: true })];
        const byId = new Map(buildItemRows(items).map((row) => [row.id, row]));
        assert.equal(byId.get('cp').compound, true);
        assert.equal(byId.get('plain').compound, false);
        assert.equal(byId.get('a').compound, false);
        assert.equal(byId.get('b').compound, false);
        assert.equal(byId.get('c').compound, false);
    });

    it('内側の複合パスも真。値は外側に左右されない', () => {
        const items = [g('outer', [g('inner', [s('a')], { compound: true })], { compound: true }),
            g('plain', [g('inner2', [s('b')], { compound: true })])];
        const byId = new Map(buildItemRows(items).map((row) => [row.id, row]));
        assert.equal(byId.get('outer').compound, true);
        assert.equal(byId.get('inner').compound, true);
        assert.equal(byId.get('plain').compound, false);
        assert.equal(byId.get('inner2').compound, true);
    });

    it('閉じたフォルダ・空のフォルダの行も値を持つ', () => {
        const items = [g('cp', [s('a')], { compound: true, collapsed: true }), g('empty', [], { compound: true })];
        const byId = new Map(buildItemRows(items).map((row) => [row.id, row]));
        assert.equal(byId.get('cp').compound, true);
        assert.equal(byId.get('empty').compound, true);
    });
});

describe('行の見た目のcompound', () => {
    it('行の値のまま渡し、ほかの項目は今までどおり', () => {
        const items = [s('a'), g('cp', [s('b')], { compound: true }), g('plain', [s('c')])];
        const rows = buildItemRows(items);
        const views = resolveRowViews({ rows, isSelected: noSel, selectedGroupIds: [], insertMark: null });
        assert.deepEqual(views.map((v) => v.compound), rows.map((r) => r.compound));
        const cp = views.find((v) => v.id === 'cp');
        assert.equal(cp.compound, true);
        assert.equal(cp.kind, 'group');
        assert.equal(cp.indent, 0);
        assert.equal(cp.canToggle, true);
        assert.equal(cp.selected, false);
        assert.equal(views.find((v) => v.id === 'plain').compound, false);
        assert.equal(views.find((v) => v.id === 'b').compound, false);
    });

    it('選んでいても閉じていてもcompoundは変わらない', () => {
        const items = [g('cp', [s('a')], { compound: true, collapsed: true })];
        const rows = buildItemRows(items);
        const views = resolveRowViews({ rows, isSelected: noSel, selectedGroupIds: ['cp'], insertMark: null });
        assert.equal(views[0].compound, true);
        assert.equal(views[0].selected, true);
        assert.equal(views[0].collapsed, true);
    });
});
