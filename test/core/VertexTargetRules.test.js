/**
 * 責務：VertexTargetRules（頂点の選択から図形と頂点の番号の組を集める規則）の公開APIを検証する。
 * 図形は実物の`Path`・`Line`・`Curve`・`Ellipse`で作る。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { collectVertexTargets } from '../../js/core/VertexTargetRules.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Path } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * idを付けた図形を作る補助。
 * @param {Object} shape 図形
 * @param {string} id 図形id
 * @returns {Object} idを付けた図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * テスト用の図形一式を作る。
 * @returns {{ path: Path, line: Line, curve: Curve, circle: Ellipse, shapes: Object[] }} 図形
 */
function makeShapes() {
    const path = withId(new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false), 'P');
    const line = withId(new Line(0, 0, 5, 5), 'L');
    const curve = withId(new Curve(0, 0, 10, 0), 'C');
    const circle = withId(new Ellipse(0, 0, 10, 10, 'circle'), 'E');
    return { path, line, curve, circle, shapes: [path, line, curve, circle] };
}

describe('collectVertexTargets', () => {
    it('VERTEXでは頂点の選択の順に { shape, vertexIndex } が並ぶ', () => {
        const { path, line, curve, shapes } = makeShapes();
        const selected = [
            { shapeId: 'C', handle: 'control' },
            { shapeId: 'P', handle: 'vertex-2' },
            { shapeId: 'L', handle: 'end' },
            { shapeId: 'P', handle: 'vertex-0' }
        ];
        const result = collectVertexTargets(OperationMode.VERTEX, [], selected, shapes);
        assert.equal(result.length, 4);
        assert.deepEqual(result.map((t) => t.vertexIndex), [1, 2, 1, 0]);
        assert.equal(result[0].shape, curve);
        assert.equal(result[1].shape, path);
        assert.equal(result[2].shape, line);
        assert.equal(result[3].shape, path);
    });

    it('SELECT・CREATE・PANでは空', () => {
        const { shapes } = makeShapes();
        const selected = [{ shapeId: 'P', handle: 'vertex-0' }];
        for (const mode of [OperationMode.SELECT, OperationMode.CREATE, OperationMode.PAN]) {
            assert.deepEqual(collectVertexTargets(mode, ['P'], selected, shapes), []);
        }
    });

    it('VERTEXで頂点の選択が空なら空', () => {
        const { shapes } = makeShapes();
        assert.deepEqual(collectVertexTargets(OperationMode.VERTEX, ['P'], [], shapes), []);
    });

    it('図形が無い組・番号が null の組（円のハンドル名・知らない名前）は飛ばす', () => {
        const { path, shapes } = makeShapes();
        const selected = [
            { shapeId: 'none', handle: 'vertex-0' },
            { shapeId: 'E', handle: 'start' },
            { shapeId: 'P', handle: 'unknown' },
            { shapeId: 'P', handle: 'vertex-1' }
        ];
        const result = collectVertexTargets(OperationMode.VERTEX, [], selected, shapes);
        assert.equal(result.length, 1);
        assert.equal(result[0].shape, path);
        assert.equal(result[0].vertexIndex, 1);
    });

    it('同じ組が2回あれば2回並ぶ', () => {
        const { shapes } = makeShapes();
        const selected = [{ shapeId: 'P', handle: 'vertex-1' }, { shapeId: 'P', handle: 'vertex-1' }];
        const result = collectVertexTargets(OperationMode.VERTEX, [], selected, shapes);
        assert.deepEqual(result.map((t) => t.vertexIndex), [1, 1]);
    });

    it('引数の配列を書き換えない', () => {
        const { shapes } = makeShapes();
        const selected = [{ shapeId: 'P', handle: 'vertex-1' }, { shapeId: 'L', handle: 'start' }];
        const ids = ['P'];
        const selectedCopy = JSON.parse(JSON.stringify(selected));
        const shapesCopy = [...shapes];
        collectVertexTargets(OperationMode.VERTEX, ids, selected, shapes);
        assert.deepEqual(selected, selectedCopy);
        assert.deepEqual(ids, ['P']);
        assert.deepEqual(shapes, shapesCopy);
    });
});
