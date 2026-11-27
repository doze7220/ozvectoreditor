/**
 * 責務: SpriteSerializer.serializeが複合パスのフォルダを描画要素`compoundPath`1つにすること（キー順・輪郭・位置・スタイル・外枠・版5）を、実物の図形と公開APIのみで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Curve } from '../../js/shapes/Curve.js';

/**
 * 図形のアイテムを作る。
 * @param {object} shape - 図形
 * @param {object} [attrs] - visibleなど
 * @returns {object} 図形のアイテム
 */
function s(shape, attrs = {}) {
    return { kind: 'shape', shape, ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Array<object>} children - 中身
 * @param {object} [attrs] - compound・visibleなど
 * @returns {object} フォルダのアイテム
 */
function g(id, children, attrs = {}) {
    return { kind: 'group', id, children, ...attrs };
}

/**
 * 塗りありの四角を作る。
 * @param {number} a - 左上のx・y
 * @param {number} b - 右下のx・y
 * @param {string|null} [fill] - 塗りの色
 * @param {string|null} [stroke] - 線の色
 * @param {number} [width] - 線の太さ
 * @returns {Rect} 四角
 */
function rect(a, b, fill = '#ff0000', stroke = '#000000', width = 2) {
    return new Rect(a, a, b, b, stroke, width, fill);
}

/**
 * 図形の描画要素からスタイル3キーを除いたものを返す。
 * @param {object} shape - 図形
 * @returns {object} 輪郭
 */
function outlineOf(shape) {
    const { strokeColor, strokeWidth, fillColor, ...rest } = shape.toDrawElement();
    return rest;
}

describe('SpriteSerializer 複合パス（compoundPath）', () => {
    it('要素のキー順と、outlinesが図形のtoDrawElementからスタイル3キーを除いたものと同じ', () => {
        const a = rect(0, 100, '#ff0000', '#112233', 4);
        const b = rect(20, 80, '#00ff00', '#445566', 1);
        const data = SpriteSerializer.serialize([g('c', [s(a), s(b)], { compound: true })]);
        assert.equal(data.elements.length, 1);
        const el = data.elements[0];
        assert.deepEqual(Object.keys(el), ['kind', 'outlines', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.equal(el.kind, 'compoundPath');
        assert.deepEqual(el.outlines, [outlineOf(a), outlineOf(b)]);
        for (const outline of el.outlines) {
            assert.deepEqual(Object.keys(outline).filter((k) => ['strokeColor', 'strokeWidth', 'fillColor'].includes(k)), []);
        }
    });

    it('位置は前後の図形の要素の間で、スタイルは一番下の図形（塗れない形のfillColorもそのまま）', () => {
        const before = new Line(0, 0, 5, 5, '#010101', 2);
        const base = new Curve(0, 0, 50, 50, '#aa0000', 6, '#bbbbbb');
        const top = rect(10, 20, '#123456', '#654321', 3);
        const after = new Line(300, 0, 310, 10, '#020202', 2);
        const data = SpriteSerializer.serialize([
            s(before), g('c', [s(base), s(top)], { compound: true }), s(after),
        ]);
        assert.equal(data.elements.length, 3);
        assert.equal(data.elements[0].strokeColor, '#010101');
        assert.equal(data.elements[2].strokeColor, '#020202');
        const el = data.elements[1];
        assert.equal(el.kind, 'compoundPath');
        assert.equal(el.strokeColor, '#aa0000');
        assert.equal(el.strokeWidth, 6);
        assert.equal(el.fillColor, '#bbbbbb');
        assert.equal(el.outlines[0].kind, 'quadratic');
    });

    it('中のフォルダ・内側の複合パスは外側の1要素に入る', () => {
        const a = rect(0, 100);
        const b = rect(10, 90, '#00ff00');
        const c = rect(20, 80, '#0000ff');
        const data = SpriteSerializer.serialize([
            g('outer', [s(a), g('mid', [s(b)]), g('in', [s(c)], { compound: true })], { compound: true }),
        ]);
        assert.equal(data.elements.length, 1);
        assert.equal(data.elements[0].outlines.length, 3);
        assert.equal(data.elements[0].fillColor, '#ff0000');
    });

    it('一番下を隠すと次の図形がスタイルになり、隠した図形はoutlinesに入らない', () => {
        const a = rect(0, 100, '#ff0000', '#111111', 5);
        const b = rect(10, 90, '#00ff00', '#222222', 3);
        const c = rect(20, 80, '#0000ff', '#333333', 1);
        const data = SpriteSerializer.serialize([
            g('c', [s(a, { visible: false }), s(b), s(c, { visible: false })], { compound: true }),
        ]);
        const el = data.elements[0];
        assert.equal(el.outlines.length, 1);
        assert.deepEqual(el.outlines[0], outlineOf(b));
        assert.equal(el.strokeColor, '#222222');
        assert.equal(el.fillColor, '#00ff00');
    });

    it('空・すべて隠れた複合パスは要素を作らず、boundsにも入らない（すべて無ければnull）', () => {
        const withOther = SpriteSerializer.serialize([
            g('e', [], { compound: true }),
            g('h', [s(rect(0, 100), { visible: false })], { compound: true }),
            s(new Line(200, 0, 210, 10, '#444444', 2)),
        ]);
        assert.equal(withOther.elements.length, 1);
        assert.deepEqual(withOther.bounds, SpriteSerializer.serialize([s(new Line(200, 0, 210, 10, '#444444', 2))]).bounds);
        const none = SpriteSerializer.serialize([
            g('e', [], { compound: true }),
            g('h', [s(rect(0, 1), { visible: false })], { compound: true }),
        ]);
        assert.deepEqual(none.elements, []);
        assert.equal(none.bounds, null);
    });

    it('図形1つの複合パスは輪郭1つのcompoundPath', () => {
        const a = rect(0, 100);
        const data = SpriteSerializer.serialize([g('c', [s(a)], { compound: true })]);
        assert.equal(data.elements.length, 1);
        assert.equal(data.elements[0].kind, 'compoundPath');
        assert.deepEqual(data.elements[0].outlines, [outlineOf(a)]);
    });

    it('普通のフォルダの中の図形は今までどおり図形ごとの要素', () => {
        const a = rect(0, 100);
        const b = rect(10, 90, '#00ff00');
        const plain = SpriteSerializer.serialize([g('c', [s(a), s(b)])]);
        assert.deepEqual(plain.elements, [a.toDrawElement(), b.toDrawElement()]);
        assert.deepEqual(plain, SpriteSerializer.serialize([s(a), s(b)]));
    });

    it('boundsは輪郭すべての和に一番下の太さの半分を足す（線なしは広げない）', () => {
        const a = rect(0, 100, '#ff0000', '#000000', 10);
        const b = new Rect(150, 10, 200, 40, '#000000', 2, null);
        const data = SpriteSerializer.serialize([g('c', [s(a), s(b)], { compound: true })]);
        assert.deepEqual(data.bounds, { minX: -5, minY: -5, maxX: 205, maxY: 105 });
        const noStroke = SpriteSerializer.serialize([g('c', [s(rect(0, 100, '#ff0000', null, 10)), s(b)], { compound: true })]);
        assert.deepEqual(noStroke.bounds, { minX: 0, minY: 0, maxX: 200, maxY: 100 });
    });

    it('boundsは回した楕円・曲線の輪郭の極値を含む（各図形単独の外枠の和と同じ）', () => {
        const curve = new Curve(0, 0, 100, 0, '#000000', 2, null);
        const ellipse = new Ellipse(300, 300, 340, 320, 'circle', '#000000', 2, null);
        const data = SpriteSerializer.serialize([g('c', [s(curve), s(ellipse)], { compound: true })]);
        const cb = SpriteSerializer.computeShapesGeometryBounds([curve]);
        const eb = SpriteSerializer.computeShapesGeometryBounds([ellipse]);
        const half = 1;
        assert.deepEqual(data.bounds, {
            minX: Math.min(cb.minX, eb.minX) - half,
            minY: Math.min(cb.minY, eb.minY) - half,
            maxX: Math.max(cb.maxX, eb.maxX) + half,
            maxY: Math.max(cb.maxY, eb.maxY) + half,
        });
    });

    it('formatVersionは5で、checkFormatは1〜5がsupported・6がunsupportedVersion', () => {
        const data = SpriteSerializer.serialize([g('c', [s(rect(0, 10))], { compound: true })]);
        assert.equal(data.formatVersion, 5);
        for (const formatVersion of [1, 2, 3, 4, 5]) {
            assert.equal(SpriteSerializer.checkFormat({ ...data, formatVersion }), 'supported');
        }
        assert.equal(SpriteSerializer.checkFormat({ ...data, formatVersion: 6 }), 'unsupportedVersion');
    });

    it('入れ子のcompoundPathや未知の輪郭のkindは外枠の計算でError', () => {
        const fake = (element) => ({ toDrawElement: () => element });
        const nested = { kind: 'compoundPath', outlines: [], strokeColor: null, strokeWidth: 1, fillColor: null };
        const mixed = { ...nested, outlines: [nested] };
        assert.throws(() => SpriteSerializer.computeShapesBounds([fake(mixed)]), /輪郭のkind/);
        const unknown = { ...nested, outlines: [{ kind: 'zzz' }] };
        assert.throws(() => SpriteSerializer.computeShapesBounds([fake(unknown)]), /輪郭のkind/);
    });
});
