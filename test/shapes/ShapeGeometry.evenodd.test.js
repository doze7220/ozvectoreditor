/**
 * 責務: 共通モジュールShapeGeometryの多角形の内側の判定（isPointInPolygonEvenOdd）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPointInPolygonEvenOdd, isPointInPolygonNonzero } from '../../js/shapes/ShapeGeometry.js';

/**
 * 頂点の座標の組から点の配列を作る。
 * @param {Array<[number, number]>} pairs - [x, y]の配列
 * @returns {Array<{x: number, y: number}>} 頂点の配列
 */
function pts(pairs) {
    return pairs.map(([x, y]) => ({ x, y }));
}

const SQUARE = pts([[0, 0], [100, 0], [100, 100], [0, 100]]);
const STAR = pts([[50, 0], [80, 100], [0, 38], [100, 38], [20, 100]]);

describe('isPointInPolygonEvenOdd', () => {
    it('四角形の内側は真・外側は偽', () => {
        assert.equal(isPointInPolygonEvenOdd(50, 50, SQUARE), true);
        assert.equal(isPointInPolygonEvenOdd(150, 50, SQUARE), false);
        assert.equal(isPointInPolygonEvenOdd(-1, 50, SQUARE), false);
        assert.equal(isPointInPolygonEvenOdd(50, 150, SQUARE), false);
    });

    it('境界の上（辺・頂点）は偽', () => {
        assert.equal(isPointInPolygonEvenOdd(50, 0, SQUARE), false);
        assert.equal(isPointInPolygonEvenOdd(100, 50, SQUARE), false);
        assert.equal(isPointInPolygonEvenOdd(0, 0, SQUARE), false);
        assert.equal(isPointInPolygonEvenOdd(100, 100, SQUARE), false);
    });

    it('頂点3未満・面積0は偽', () => {
        assert.equal(isPointInPolygonEvenOdd(1, 1, []), false);
        assert.equal(isPointInPolygonEvenOdd(1, 1, pts([[0, 0], [10, 10]])), false);
        assert.equal(isPointInPolygonEvenOdd(5, 6, pts([[0, 0], [10, 10], [20, 20]])), false);
        assert.equal(isPointInPolygonEvenOdd(1, 1, pts([[3, 3], [3, 3], [3, 3]])), false);
    });

    it('五芒星の中心は交差の数が偶数のため外側（nonzeroでは内側）', () => {
        assert.equal(isPointInPolygonEvenOdd(50, 50, STAR), false);
        assert.equal(isPointInPolygonNonzero(50, 50, STAR), true);
        // 腕の中は内側
        assert.equal(isPointInPolygonEvenOdd(50, 20, STAR), true);
    });

    it('頂点のy座標と同じ高さの点でも二重に数えない', () => {
        const diamond = pts([[50, 0], [100, 50], [50, 100], [0, 50]]);
        assert.equal(isPointInPolygonEvenOdd(30, 50, diamond), true);
        assert.equal(isPointInPolygonEvenOdd(120, 50, diamond), false);
        assert.equal(isPointInPolygonEvenOdd(-20, 50, diamond), false);
    });

    it('引数を書き換えない', () => {
        const copy = JSON.parse(JSON.stringify(SQUARE));
        isPointInPolygonEvenOdd(50, 50, SQUARE);
        assert.deepEqual(SQUARE, copy);
    });
});
