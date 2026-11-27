/**
 * 責務: CompoundPathRules（複合パスの属性・中身の集め方・描く単位・塗られた所・スタイルの反映先）を、実物の図形と公開APIのみで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    isCompoundGroup, setCompound, resolveCompoundToggle, collectCompoundGroupIds,
    listCompoundPaths, mapCompoundsByShape, buildDrawUnits, findCompoundOf,
    isInsideCompoundFill, hitTestCompoundFill, resolveStyleTargets, DRAW_UNIT_KIND
} from '../../js/core/CompoundPathRules.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';
import { Curve } from '../../js/shapes/Curve.js';

/**
 * 図形のアイテムを作る。
 * @param {Object} shape - 図形
 * @param {Object} [attrs] - visible・lockedなど
 * @returns {Object} 図形のアイテム
 */
function s(shape, attrs = {}) {
    return { kind: ITEM_KIND.SHAPE, shape, ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Object[]} children - 中身
 * @param {Object} [attrs] - compound・visible・lockedなど
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, attrs = {}) {
    return { kind: ITEM_KIND.GROUP, id, children, ...attrs };
}

/**
 * 塗りありの四角を作る。
 * @param {number} a - 左上の座標（x・y共通）
 * @param {number} b - 右下の座標（x・y共通）
 * @param {string} [fill] - 塗りの色
 * @returns {Rect} 四角
 */
function rect(a, b, fill = '#ff0000') {
    return new Rect(a, a, b, b, '#000000', 2, fill);
}

describe('属性の読み書き', () => {
    it('isCompoundGroup: trueのフォルダだけ真', () => {
        assert.equal(isCompoundGroup(g('a', [], { compound: true })), true);
        assert.equal(isCompoundGroup(g('a', [], { compound: 'true' })), false);
        assert.equal(isCompoundGroup(g('a', [], { compound: 1 })), false);
        assert.equal(isCompoundGroup(g('a', [])), false);
        assert.equal(isCompoundGroup(s(rect(0, 1))), false);
    });

    it('setCompound: 付ける・消す・同じ値と無いidと図形は同じ参照・引数を書き換えない', () => {
        const items = [g('a', [g('b', [s(rect(0, 1))])]), s(rect(0, 2))];
        const on = setCompound(items, 'b', true);
        assert.equal(on[0].children[0].compound, true);
        assert.equal(items[0].children[0].compound, undefined);
        assert.equal(on[0].children[0].children[0], items[0].children[0].children[0]);
        assert.equal(on[1], items[1]);
        const off = setCompound(on, 'b', false);
        assert.equal('compound' in off[0].children[0], false);
        assert.equal(setCompound(on, 'b', true), on);
        assert.equal(setCompound(items, 'b', false), items);
        assert.equal(setCompound(items, 'zz', true), items);
        const shape = rect(0, 1);
        shape.id = 'sid';
        const withShape = [s(shape)];
        assert.equal(setCompound(withShape, 'sid', true), withShape);
    });

    it('resolveCompoundToggle・collectCompoundGroupIds', () => {
        const items = [g('a', [g('b', [], { compound: true })], { visible: false }), g('c', [], { compound: true }), s(rect(0, 1))];
        assert.deepEqual(resolveCompoundToggle(items, 'b'), { id: 'b', compound: false });
        assert.deepEqual(resolveCompoundToggle(items, 'a'), { id: 'a', compound: true });
        assert.equal(resolveCompoundToggle(items, 'zz'), null);
        assert.deepEqual([...collectCompoundGroupIds(items)].sort(), ['b', 'c']);
    });
});

describe('listCompoundPaths', () => {
    it('普通のフォルダは返さない', () => {
        assert.deepEqual(listCompoundPaths([g('a', [s(rect(0, 1))])]), []);
    });

    it('複合パス: 中の図形が描画順・一番下の図形のスタイル', () => {
        const a = rect(0, 10, '#111111');
        const b = rect(2, 8, '#222222');
        const list = listCompoundPaths([g('g', [s(a), s(b)], { compound: true })]);
        assert.equal(list.length, 1);
        assert.equal(list[0].groupId, 'g');
        assert.deepEqual(list[0].shapes, [a, b]);
        assert.deepEqual(list[0].style, { strokeColor: '#000000', strokeWidth: 2, fillColor: '#111111' });
        assert.equal(list[0].baseEditable, true);
    });

    it('中のフォルダの図形も外側に入り、内側の複合パスは別に返さない', () => {
        const a = rect(0, 10);
        const b = rect(2, 8);
        const c = rect(3, 5);
        const items = [g('o', [s(a), g('m', [s(b)]), g('i', [s(c)], { compound: true })], { compound: true })];
        const list = listCompoundPaths(items);
        assert.equal(list.length, 1);
        assert.deepEqual(list[0].shapes, [a, b, c]);
    });

    it('外側が普通で内側が複合パスなら内側を返す', () => {
        const a = rect(0, 10);
        const list = listCompoundPaths([g('o', [g('i', [s(a)], { compound: true })])]);
        assert.equal(list.length, 1);
        assert.equal(list[0].groupId, 'i');
    });

    it('一番下を隠すと次の図形が先頭・スタイルも次', () => {
        const a = rect(0, 10, '#111111');
        const b = rect(2, 8, '#222222');
        const list = listCompoundPaths([g('g', [s(a, { visible: false }), s(b)], { compound: true })]);
        assert.deepEqual(list[0].shapes, [b]);
        assert.equal(list[0].style.fillColor, '#222222');
    });

    it('フォルダごと隠す・空・すべて隠れは返さない・1つは1件', () => {
        assert.deepEqual(listCompoundPaths([g('g', [s(rect(0, 1))], { compound: true, visible: false })]), []);
        assert.deepEqual(listCompoundPaths([g('g', [], { compound: true })]), []);
        assert.deepEqual(listCompoundPaths([g('g', [s(rect(0, 1), { visible: false })], { compound: true })]), []);
        assert.equal(listCompoundPaths([g('g', [s(rect(0, 1))], { compound: true })]).length, 1);
    });

    it('ロック: 中の図形は入る・一番下がロックなら baseEditable が偽・フォルダごとロックも偽', () => {
        const a = rect(0, 10);
        const b = rect(2, 8);
        const l1 = listCompoundPaths([g('g', [s(a, { locked: true }), s(b)], { compound: true })]);
        assert.deepEqual(l1[0].shapes, [a, b]);
        assert.equal(l1[0].baseEditable, false);
        const l2 = listCompoundPaths([g('g', [s(a), s(b)], { compound: true, locked: true })]);
        assert.equal(l2[0].baseEditable, false);
    });

    it('塗れない形が一番下でも style.fillColor はその値・図形を書き換えない', () => {
        const line = new Line(0, 0, 5, 5, '#000000', 2, '#abcdef');
        const before = JSON.stringify(line.toJSON());
        const list = listCompoundPaths([g('g', [s(line)], { compound: true })]);
        assert.equal(list[0].style.fillColor, '#abcdef');
        assert.equal(JSON.stringify(line.toJSON()), before);
    });
});

describe('mapCompoundsByShape・buildDrawUnits・findCompoundOf', () => {
    it('空は空のMap・中の図形が自分の複合パスに引ける・外と隠れた図形は無い', () => {
        assert.equal(mapCompoundsByShape([]).size, 0);
        const a = rect(0, 10);
        const b = rect(2, 8);
        const c = rect(20, 30);
        const hidden = rect(1, 2);
        const d = rect(40, 50);
        const items = [
            g('x', [s(a), g('m', [s(b)]), s(hidden, { visible: false })], { compound: true }),
            s(c),
            g('y', [s(d)], { compound: true })
        ];
        const list = listCompoundPaths(items);
        const map = mapCompoundsByShape(list);
        assert.equal(map.get(a), list[0]);
        assert.equal(map.get(b), list[0]);
        assert.equal(map.get(d), list[1]);
        assert.equal(map.has(c), false);
        assert.equal(map.has(hidden), false);
        assert.equal(findCompoundOf(list, b), list[0]);
        assert.equal(findCompoundOf(list, c), null);
    });

    it('buildDrawUnits: 複合パスなしは図形1つずつ・複合パスは先頭の位置に1つ', () => {
        const a = rect(0, 10);
        const b = rect(2, 8);
        const c = rect(20, 30);
        const d = rect(40, 50);
        const plain = buildDrawUnits([a, b], []);
        assert.deepEqual(plain.map((u) => u.kind), ['shape', 'shape']);
        assert.deepEqual(plain.map((u) => u.shapes[0]), [a, b]);
        const items = [s(c), g('x', [s(a), s(b)], { compound: true }), s(d)];
        const list = listCompoundPaths(items);
        const units = buildDrawUnits([c, a, b, d], list);
        assert.equal(units.length, 3);
        assert.deepEqual(units.map((u) => u.kind), [DRAW_UNIT_KIND.SHAPE, DRAW_UNIT_KIND.COMPOUND, DRAW_UNIT_KIND.SHAPE]);
        assert.equal(units[1].groupId, 'x');
        assert.deepEqual(units[1].shapes, [a, b]);
        assert.equal(units[1].style, list[0].style);
        assert.equal(units[1].baseEditable, true);
        assert.equal(units[2].shapes[0], d);
    });

    it('buildDrawUnits: 2つの複合パス', () => {
        const a = rect(0, 10);
        const b = rect(2, 8);
        const c = rect(20, 30);
        const d = rect(22, 28);
        const list = listCompoundPaths([g('x', [s(a), s(c)], { compound: true }), g('y', [s(b), s(d)], { compound: true })]);
        const units = buildDrawUnits([a, b, c, d], list);
        assert.deepEqual(units.map((u) => u.groupId), ['x', 'y']);
    });
});

describe('塗られた所', () => {
    const big = new Ellipse(-50, -50, 50, 50, 'circle', '#000000', 2, '#ff0000');
    const small = new Ellipse(-20, -20, 20, 20, 'circle', '#000000', 2, '#00ff00');
    const list = listCompoundPaths([g('g', [s(big), s(small)], { compound: true })]);
    const compound = list[0];

    it('輪の所で真・穴で偽・外で偽', () => {
        assert.equal(isInsideCompoundFill(compound, 35, 0), true);
        assert.equal(isInsideCompoundFill(compound, 0, 0), false);
        assert.equal(isInsideCompoundFill(compound, 80, 0), false);
    });

    it('塗りなしは偽', () => {
        const none = new Ellipse(-50, -50, 50, 50, 'circle', '#000000', 2, null);
        const l = listCompoundPaths([g('g', [s(none)], { compound: true })]);
        assert.equal(isInsideCompoundFill(l[0], 0, 0), false);
    });

    it('開いたパスの弦の内側も数に入る', () => {
        const open = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false, '#000000', 2, '#ff0000');
        const l = listCompoundPaths([g('g', [s(open)], { compound: true })]);
        assert.equal(isInsideCompoundFill(l[0], 8, 4), true);
        assert.equal(isInsideCompoundFill(l[0], 2, 8), false);
    });

    it('hitTestCompoundFill: 囲む図形だけが真', () => {
        assert.equal(hitTestCompoundFill(compound, small, 35, 0), false);
        assert.equal(hitTestCompoundFill(compound, big, 35, 0), true);
        assert.equal(hitTestCompoundFill(compound, big, 0, 0), false);
    });
});

describe('resolveStyleTargets', () => {
    it('複合パスなしは同じ並び・fillShapes は isFillable', () => {
        const r = rect(0, 10);
        const line = new Line(0, 0, 5, 5);
        const out = resolveStyleTargets([r, line], []);
        assert.deepEqual(out.shapes, [r, line]);
        assert.deepEqual(out.fillShapes, [r]);
    });

    it('中の図形は一番下へ・同じ複合パスは1回・塗れない形が一番下でも fillShapes に入る', () => {
        const base = new Curve(0, 0, 10, 10, 20, 0);
        const top = rect(2, 8);
        const outside = rect(30, 40);
        const line = new Line(0, 0, 5, 5);
        const items = [g('x', [s(base), s(top)], { compound: true }), s(outside), s(line)];
        const list = listCompoundPaths(items);
        const out = resolveStyleTargets([top, base, outside, line], list);
        assert.deepEqual(out.shapes, [base, outside, line]);
        assert.deepEqual(out.fillShapes, [base, outside]);
    });

    it('一番下がロックの複合パスは外れる', () => {
        const a = rect(0, 10);
        const b = rect(2, 8);
        const list = listCompoundPaths([g('x', [s(a, { locked: true }), s(b)], { compound: true })]);
        const out = resolveStyleTargets([b], list);
        assert.deepEqual(out.shapes, []);
        assert.deepEqual(out.fillShapes, []);
    });
});
