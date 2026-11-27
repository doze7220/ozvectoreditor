/**
 * 責務: PointHitRules.classifyPointHitの複合パス対応（塗られた所のクリック・穴の素通り）を、実物のVectorModelと図形で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { classifyPointHit } from '../../js/core/PointHitRules.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

const TOL = 3;

/**
 * idを付けた図形のアイテムを作る。
 * @param {string} id 図形のid
 * @param {Object} shape 図形
 * @param {Object} [states] `visible`・`locked`など
 * @returns {Object} 図形のアイテム
 */
function s(id, shape, states = {}) {
    shape.id = id;
    return { kind: 'shape', shape, ...states };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] `compound`・`locked`など
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, extra = {}) {
    return { kind: 'group', id, children, ...extra };
}

/**
 * 円を作る（中心(cx,cy)・半径r）。
 * @param {number} cx 中心X（中心と、右下の点で作る）
 * @param {number} cy 中心Y
 * @param {number} r 半径
 * @param {string|null} [fill] 塗りの色
 * @returns {Ellipse} 円
 */
function circle(cx, cy, r, fill = '#ff0000') {
    return new Ellipse(cx, cy, cx + r, cy + r, 'circle', '#000000', 2, fill);
}

/**
 * 緑で塗った四角（0,0)-(100,100)のアイテムを作る。
 * @param {string} id 図形のid
 * @returns {Object} 図形のアイテム
 */
function square(id) {
    return s(id, new Rect(0, 0, 100, 100, '#000000', 2, '#00ff00'));
}

/**
 * 実物のモデルで当たり分類を行う（変えられる図形・複合パスを渡す）。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {number} x X座標
 * @param {number} y Y座標
 * @param {Object} [opts] `selected`（選択idの配列）・`includeFill`・`withCompound`（偽なら第8引数を渡さない）
 * @returns {string|null} 本体の図形のid
 */
function bodyAt(items, x, y, opts = {}) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const selected = new Set(opts.selected ?? []);
    const args = [model.getEditableShapes(), (id) => selected.has(id), x, y, TOL, opts.includeFill ?? true, false];
    if (opts.withCompound !== false) {
        args.push(model.getCompoundPaths());
    }
    return classifyPointHit(...args).bodyId;
}

/**
 * ドーナツ（大きな円＋小さな円）の複合パスのフォルダを作る。
 * @param {Object} [extra] フォルダの属性
 * @returns {Object} フォルダのアイテム
 */
function donut(extra = {}) {
    return g('d', [s('big', circle(50, 50, 50)), s('small', circle(50, 50, 10, '#0000ff'))], { compound: true, ...extra });
}

describe('classifyPointHit 複合パス', () => {
    it('普通のフォルダは複合パスなしの結果と同じ', () => {
        const items = [g('d', [s('big', circle(50, 50, 50)), s('small', circle(50, 50, 10, '#0000ff'))])];
        for (const [x, y] of [[50, 50], [10, 50], [500, 500], [60, 50]]) {
            assert.equal(bodyAt(items, x, y), bodyAt(items, x, y, { withCompound: false }));
        }
        assert.equal(bodyAt(items, 50, 50), 'small');
    });

    it('輪＝大きな円、穴＝後ろの図形、後ろが無ければnull', () => {
        assert.equal(bodyAt([square('back'), donut()], 25, 50), 'big');
        assert.equal(bodyAt([square('back'), donut()], 50, 50), 'back');
        assert.equal(bodyAt([donut()], 50, 50), null);
    });

    it('輪郭の上はその図形（小さな円の輪郭の上は小さな円）', () => {
        assert.equal(bodyAt([donut()], 60, 50), 'small');
        assert.equal(bodyAt([donut()], 100, 50), 'big');
    });

    it('選択集合の輪郭の優先は今と同じ', () => {
        const items = [square('back'), donut()];
        assert.equal(bodyAt(items, 100, 50, { selected: ['back'] }), 'back');
        assert.equal(bodyAt(items, 100, 50), 'big');
        assert.equal(bodyAt(items, 100, 50, { selected: ['back'] }), bodyAt(items, 100, 50, { selected: ['back'], withCompound: false }));
    });

    it('塗りなしの複合パスは内側で当たらない（輪郭だけ）', () => {
        const noFill = g('d', [s('big', circle(50, 50, 50, null)), s('small', circle(50, 50, 10, null))], { compound: true });
        assert.equal(bodyAt([noFill], 25, 50), null);
        assert.equal(bodyAt([noFill], 100, 50), 'big');
    });

    it('includeFillが偽なら塗られた所でも当たらない', () => {
        assert.equal(bodyAt([donut()], 25, 50, { includeFill: false }), null);
        assert.equal(bodyAt([donut()], 100, 50, { includeFill: false }), 'big');
    });

    it('中の図形のhitTestFillを使わない（中の小さな円が塗りありでも穴では当たらない）', () => {
        assert.equal(bodyAt([donut()], 50, 50), null);
        assert.equal(bodyAt([donut()], 50, 50, { withCompound: false }), 'small');
    });

    it('一番下を隠すと次の図形が一番下になり、そのスタイルで塗られる', () => {
        const visibleBase = [g('d', [s('big', circle(50, 50, 50, null)), s('small', circle(50, 50, 10, '#0000ff'))], { compound: true })];
        assert.equal(bodyAt(visibleBase, 50, 50), null);
        const hiddenBase = [g('d', [s('big', circle(50, 50, 50, null), { visible: false }), s('small', circle(50, 50, 10, '#0000ff'))], { compound: true })];
        assert.equal(bodyAt(hiddenBase, 50, 50), 'small');
    });

    it('フォルダの中のフォルダ・内側の複合パスは外側で判定する', () => {
        const outerCompound = g('outer', [
            s('big', circle(50, 50, 50)),
            g('inner', [s('mid', circle(50, 50, 30, '#0000ff')), s('tiny', circle(50, 50, 10, '#0000ff'))], { compound: true }),
        ], { compound: true });
        // 3つの円が1つの複合パス：輪(30〜50)＝big、(10〜30)の穴＝null、中心(0〜10)は3重で奇数＝tiny
        assert.equal(bodyAt([outerCompound], 15, 50), 'big');
        assert.equal(bodyAt([outerCompound], 30, 50), null);
        assert.equal(bodyAt([outerCompound], 50, 50), 'tiny');
        const plainOuter = g('outer', [g('inner', [s('big', circle(50, 50, 50)), s('small', circle(50, 50, 10, '#0000ff'))], { compound: true })]);
        assert.equal(bodyAt([plainOuter], 25, 50), 'big');
        assert.equal(bodyAt([plainOuter], 50, 50), null);
    });

    it('一番下が開いたパス・弧でもfillColorが文字列なら弦の内側で当たる', () => {
        const open = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], false, '#000000', 2, '#ff0000');
        const arc = new Ellipse(50, 50, 100, 100, 'arc', '#000000', 2, '#ff0000');
        assert.equal(bodyAt([g('d', [s('p', open), s('c', circle(500, 500, 5))], { compound: true })], 90, 10), 'p');
        assert.equal(bodyAt([g('d', [s('a', arc), s('c', circle(500, 500, 5))], { compound: true })], 50, 30), 'a');
    });

    it('図形1つの複合パス（塗れない形）でも塗られた所で当たる', () => {
        const open = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], false, '#000000', 2, '#ff0000');
        assert.equal(bodyAt([g('d', [s('p', open)], { compound: true })], 90, 10), 'p');
        assert.equal(bodyAt([g('d', [s('p', open)], { compound: true })], 10, 90), null);
    });

    it('囲む図形がロックされていると素通りになる（奥で囲む変えられる図形、無ければ後ろ）', () => {
        const locked = g('d', [s('big', circle(50, 50, 50), { locked: true }), s('small', circle(50, 50, 10, '#0000ff'))], { compound: true });
        const mid = s('mid', new Rect(20, 20, 80, 80, '#000000', 2, '#00ff00'));
        assert.equal(bodyAt([square('back'), locked], 25, 50), 'back');
        assert.equal(bodyAt([locked], 25, 50), null);
        assert.equal(bodyAt([square('back'), mid, locked], 25, 50), 'mid');
    });

    it('手前の普通の図形が先に当たる', () => {
        assert.equal(bodyAt([donut(), square('front')], 25, 50), 'front');
        assert.equal(bodyAt([donut(), square('front')], 50, 50), 'front');
    });
});
