/**
 * 責務: VertexHandleRules（頂点のハンドルの一覧・頂点のハンドルの判定）の振る舞いを実物の図形クラスで検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { collectVertexHandles, isVertexHandle } from '../../js/core/VertexHandleRules.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * idを付けた図形を返す。
 * @param {Object} shape 図形
 * @param {string} id 図形id
 * @returns {Object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

describe('collectVertexHandles', () => {
    const line = withId(new Line(0, 0, 10, 20), 'l');
    const curve = withId(new Curve(0, 0, 10, 20), 'c');
    const rect = withId(new Rect(0, 0, 10, 20), 'r');
    const circle = withId(new Ellipse(0, 0, 10, 20), 'e');
    const path = withId(new Path([{ x: 0, y: 0 }, { x: 5, y: 5 }, { x: 9, y: 1 }]), 'p');
    const shapes = [line, curve, rect, circle, path];
    const all = ['l', 'c', 'r', 'e', 'p'];

    test('頂点の選択モード以外は空配列', () => {
        assert.deepEqual(collectVertexHandles(OperationMode.SELECT, shapes, all, []), []);
        assert.deepEqual(collectVertexHandles(OperationMode.CREATE, shapes, all, []), []);
    });

    test('5種別の一覧と位置（円・弧は含まれない）、描画順', () => {
        const result = collectVertexHandles(OperationMode.VERTEX, shapes, all, []);
        assert.deepEqual(result.map((r) => r.shapeId), ['l', 'c', 'r', 'p']);
        for (const entry of result) {
            const shape = shapes.find((s) => s.id === entry.shapeId);
            const names = shape.getVertexHandleNames();
            assert.equal(entry.handles.length, names.length);
            entry.handles.forEach((h, i) => {
                const pos = shape.getHandlePosition(names[i]);
                assert.deepEqual({ x: h.x, y: h.y }, { x: pos.x, y: pos.y });
                assert.equal(h.selected, false);
            });
        }
        assert.equal(result.find((r) => r.shapeId === 'p').handles.length, 3);
    });

    test('選択中でない図形は含まれない', () => {
        const result = collectVertexHandles(OperationMode.VERTEX, shapes, ['r'], []);
        assert.deepEqual(result.map((r) => r.shapeId), ['r']);
    });

    test('selectedは同じ組だけに付く', () => {
        const result = collectVertexHandles(OperationMode.VERTEX, shapes, ['l', 'r'], [{ shapeId: 'l', handle: 'end' }, { shapeId: 'x', handle: 'start' }]);
        assert.deepEqual(result[0].handles.map((h) => h.selected), [false, true]);
        assert.deepEqual(result[1].handles.map((h) => h.selected), [false, false, false, false]);
    });

    test('引数を書き換えない', () => {
        const ids = ['l'];
        const sel = [{ shapeId: 'l', handle: 'start' }];
        const list = [line];
        const before = JSON.stringify([ids, sel, list.map((s) => s.toJSON())]);
        collectVertexHandles(OperationMode.VERTEX, list, ids, sel);
        assert.equal(JSON.stringify([ids, sel, list.map((s) => s.toJSON())]), before);
    });
});

describe('isVertexHandle', () => {
    const line = new Line(0, 0, 10, 20);
    test('頂点のハンドルは真、moveと未知の名前は偽', () => {
        assert.equal(isVertexHandle(line, 'start'), true);
        assert.equal(isVertexHandle(line, 'move'), false);
        assert.equal(isVertexHandle(line, 'unknown'), false);
    });
    test('円は常に偽', () => {
        assert.equal(isVertexHandle(new Ellipse(0, 0, 10, 20), 'right'), false);
    });
    test('shapeがnull・undefined・一覧を持たないときも例外なく偽', () => {
        assert.equal(isVertexHandle(null, 'start'), false);
        assert.equal(isVertexHandle(undefined, 'start'), false);
        assert.equal(isVertexHandle({}, 'start'), false);
    });
});
