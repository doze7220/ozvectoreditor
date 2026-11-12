/**
 * 責務: 共通モジュールShapeGeometryのうち多角形の内側の判定（isPointInPolygonNonzero）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isPointInPolygonNonzero } from '../../js/shapes/ShapeGeometry.js';

/**
 * 頂点の座標の組から点の配列を作る。
 * @param {Array<[number, number]>} pairs - [x, y]の配列
 * @returns {Array<{x: number, y: number}>} 頂点の配列
 */
function pts(pairs) {
    return pairs.map(([x, y]) => ({ x, y }));
}

const SQUARE = pts([[0, 0], [100, 0], [100, 100], [0, 100]]);
const TRIANGLE = pts([[0, 0], [100, 0], [50, 100]]);
const ARROW = pts([[20, 0], [-10, -10], [-4, 0], [-10, 10]]);

/**
 * 正五角形の頂点を1つおきに結んだ五芒星（外周半径100・中心原点）。
 * @returns {Array<{x: number, y: number}>} 五芒星の頂点
 */
function makeStar() {
    const result = [];
    for (let i = 0; i < 5; i++) {
        const angle = -Math.PI / 2 + (i * 2 * 2 * Math.PI) / 5;
        result.push({ x: 100 * Math.cos(angle), y: 100 * Math.sin(angle) });
    }
    return result;
}

describe('isPointInPolygonNonzero', () => {
    it('凸（正方形）の内側は真・外側は偽', () => {
        assert.equal(isPointInPolygonNonzero(50, 50, SQUARE), true);
        assert.equal(isPointInPolygonNonzero(150, 50, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(-1, 50, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(50, 101, SQUARE), false);
    });

    it('凸（三角形）の内側は真・外側は偽', () => {
        assert.equal(isPointInPolygonNonzero(50, 30, TRIANGLE), true);
        assert.equal(isPointInPolygonNonzero(5, 80, TRIANGLE), false);
        assert.equal(isPointInPolygonNonzero(50, 120, TRIANGLE), false);
    });

    it('凹（矢じり形）の本体は真・くぼみは偽', () => {
        assert.equal(isPointInPolygonNonzero(0, 0, ARROW), true);
        assert.equal(isPointInPolygonNonzero(-7, 0, ARROW), false);
        assert.equal(isPointInPolygonNonzero(-5, 5, ARROW), true);
        assert.equal(isPointInPolygonNonzero(30, 0, ARROW), false);
    });

    it('境界上（辺の上・頂点の上・閉じる辺の上）は偽', () => {
        assert.equal(isPointInPolygonNonzero(50, 0, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(100, 50, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(0, 50, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(0, 0, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(100, 100, SQUARE), false);
        assert.equal(isPointInPolygonNonzero(25, 50, TRIANGLE), false);
    });

    it('五芒星の中心（巻き数2）と先端の三角形の内側は真', () => {
        const star = makeStar();
        assert.equal(isPointInPolygonNonzero(0, 0, star), true);
        // 先端（上: (0,-100)）付近の三角形の内側
        assert.equal(isPointInPolygonNonzero(0, -85, star), true);
        // 先端の外側
        assert.equal(isPointInPolygonNonzero(0, -105, star), false);
    });

    it('巻き数0の穴は偽・外側の帯は真', () => {
        // 外側（0,0)-(100,0)-(100,100)-(0,100)を時計回り、橋(0,100)->(25,75)、内側を逆回り、橋で戻る
        const donut = pts([
            [0, 0], [100, 0], [100, 100], [0, 100],
            [25, 75], [75, 75], [75, 25], [25, 25], [25, 75],
            [0, 100],
        ]);
        // 最後の[0,100]は閉じる辺(0,100)->(0,0)の前の頂点。穴の中心は偽
        assert.equal(isPointInPolygonNonzero(50, 50, donut), false);
        // 外側の帯は真
        assert.equal(isPointInPolygonNonzero(10, 50, donut), true);
        assert.equal(isPointInPolygonNonzero(50, 10, donut), true);
        assert.equal(isPointInPolygonNonzero(90, 90, donut), true);
    });

    it('頂点0・1・2個は偽', () => {
        assert.equal(isPointInPolygonNonzero(0, 0, []), false);
        assert.equal(isPointInPolygonNonzero(0, 0, pts([[0, 0]])), false);
        assert.equal(isPointInPolygonNonzero(5, 0, pts([[0, 0], [10, 0]])), false);
        assert.equal(isPointInPolygonNonzero(5, 5, pts([[0, 0], [10, 0]])), false);
    });

    it('面積0（一直線上・すべて同じ点）は辺の上も外も偽で例外を投げない', () => {
        const line = pts([[0, 0], [50, 0], [100, 0]]);
        assert.equal(isPointInPolygonNonzero(25, 0, line), false);
        assert.equal(isPointInPolygonNonzero(25, 1, line), false);
        assert.equal(isPointInPolygonNonzero(150, 0, line), false);
        const same = pts([[5, 5], [5, 5], [5, 5]]);
        assert.equal(isPointInPolygonNonzero(5, 5, same), false);
        assert.equal(isPointInPolygonNonzero(6, 5, same), false);
        const zeroEdge = pts([[0, 0], [0, 0], [100, 0]]);
        assert.doesNotThrow(() => isPointInPolygonNonzero(50, 10, zeroEdge));
        assert.equal(isPointInPolygonNonzero(50, 10, zeroEdge), false);
    });

    it('頂点の向き（時計回り・反時計回り）によらず同じ結果', () => {
        const reversedSquare = [...SQUARE].reverse();
        const reversedArrow = [...ARROW].reverse();
        const probes = [[50, 50], [150, 50], [50, 0], [0, 0], [-7, 0], [-5, 5]];
        for (const [x, y] of probes) {
            assert.equal(
                isPointInPolygonNonzero(x, y, reversedSquare),
                isPointInPolygonNonzero(x, y, SQUARE),
            );
            assert.equal(
                isPointInPolygonNonzero(x, y, reversedArrow),
                isPointInPolygonNonzero(x, y, ARROW),
            );
        }
    });

    it('引数の配列・頂点を書き換えない', () => {
        const input = pts([[0, 0], [100, 0], [100, 100], [0, 100]]);
        const snapshot = JSON.stringify(input);
        isPointInPolygonNonzero(50, 50, input);
        isPointInPolygonNonzero(0, 0, input);
        assert.equal(JSON.stringify(input), snapshot);
        assert.equal(input.length, 4);
    });
});
