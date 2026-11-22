/**
 * 責務: 共通モジュールShapeGeometryのうち多角形の内側の判定（isPointInPolygonNonzero）・3次ベジェの点・曲線の区間の制御点・点へのアフィン変換（applyAffineTransformToPoint）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyAffineTransformToPoint, isPointInPolygonNonzero, cubicBezierPoint, computeSmoothSegmentControls } from '../../js/shapes/ShapeGeometry.js';

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

/**
 * 2つの点が許容誤差内で一致することを検証する。
 * @param {{x: number, y: number}} actual - 実際の点
 * @param {{x: number, y: number}} expected - 期待する点
 */
function assertPointClose(actual, expected) {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `x: ${actual.x} != ${expected.x}`);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-9, `y: ${actual.y} != ${expected.y}`);
}

describe('cubicBezierPoint', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 0, y: 10 };
    const p2 = { x: 10, y: 10 };
    const p3 = { x: 10, y: 0 };

    it('t=0で始点、t=1で終点になる', () => {
        assert.deepEqual(cubicBezierPoint(p0, p1, p2, p3, 0), { x: 0, y: 0 });
        assert.deepEqual(cubicBezierPoint(p0, p1, p2, p3, 1), { x: 10, y: 0 });
    });

    it('t=0.5で式どおりの点になる', () => {
        assertPointClose(cubicBezierPoint(p0, p1, p2, p3, 0.5), { x: 5, y: 7.5 });
    });

    it('呼び出しごとに新しいオブジェクトを返し、引数を書き換えない', () => {
        const a = cubicBezierPoint(p0, p1, p2, p3, 0.3);
        const b = cubicBezierPoint(p0, p1, p2, p3, 0.3);
        assert.notEqual(a, b);
        assert.deepEqual(p1, { x: 0, y: 10 });
    });
});

describe('computeSmoothSegmentControls', () => {
    const P4 = pts([[0, 0], [60, 0], [60, 60], [120, 60]]);

    it('開いた2点1区間（曲線）は直線の1/3・2/3の点になる', () => {
        const r = computeSmoothSegmentControls(pts([[0, 0], [30, 60]]), [true], false);
        assert.equal(r.length, 1);
        assertPointClose(r[0].control1, { x: 10, y: 20 });
        assertPointClose(r[0].control2, { x: 20, y: 40 });
    });

    it('開いた4点3区間すべて曲線：中央の区間は前後の実の頂点を使い、両端の区間は仮の点を使う', () => {
        const r = computeSmoothSegmentControls(P4, [true, true, true], false);
        // 区間1: a=P1, b=P2, Q0=P0, Q3=P3
        assertPointClose(r[1].control1, { x: 60 + (60 - 0) / 6, y: 0 + (60 - 0) / 6 });
        assertPointClose(r[1].control2, { x: 60 - (120 - 60) / 6, y: 60 - (60 - 0) / 6 });
        // 区間0: Q0 = 2a - b = (-60, 0), Q3 = P2
        assertPointClose(r[0].control1, { x: 0 + (60 + 60) / 6, y: 0 });
        assertPointClose(r[0].control2, { x: 60 - (60 - 0) / 6, y: 0 - (60 - 0) / 6 });
        // 区間2: Q0 = P1, Q3 = 2b - a = (180, 60)
        assertPointClose(r[2].control1, { x: 60 + (120 - 60) / 6, y: 60 + (60 - 0) / 6 });
        assertPointClose(r[2].control2, { x: 120 - (180 - 60) / 6, y: 60 - 0 });
    });

    it('直線の区間はnull、その隣の曲線の区間は仮の点を使う（連なりの区切り）', () => {
        const r = computeSmoothSegmentControls(P4, [true, false, true], false);
        assert.equal(r[1], null);
        // 区間0: 1区間だけの連なり→直線と同じ形
        assertPointClose(r[0].control1, { x: 20, y: 0 });
        assertPointClose(r[0].control2, { x: 40, y: 0 });
        assertPointClose(r[2].control1, { x: 60 + 20, y: 60 });
        assertPointClose(r[2].control2, { x: 60 + 40, y: 60 });
    });

    it('閉じたパスで全区間が曲線なら番号が一周する', () => {
        const sq = pts([[0, 0], [60, 0], [60, 60], [0, 60]]);
        const r = computeSmoothSegmentControls(sq, [true, true, true, true], true);
        assert.equal(r.length, 4);
        // 区間0: Q0 = P[3], Q3 = P[2]
        assertPointClose(r[0].control1, { x: 0 + (60 - 0) / 6, y: 0 + (0 - 60) / 6 });
        assertPointClose(r[0].control2, { x: 60 - (60 - 0) / 6, y: 0 - (60 - 0) / 6 });
        // 最後の区間3（P3→P0）: Q0 = P[2], Q3 = P[1]
        assertPointClose(r[3].control1, { x: 0 + (0 - 60) / 6, y: 60 + (0 - 60) / 6 });
        assertPointClose(r[3].control2, { x: 0 - (60 - 0) / 6, y: 0 - (0 - 60) / 6 });
    });

    it('閉じたパスで閉じる区間だけが直線なら、区間0のQ0と最後の曲線の区間のQ3が仮の点になる', () => {
        const sq = pts([[0, 0], [60, 0], [60, 60], [0, 60]]);
        const r = computeSmoothSegmentControls(sq, [true, true, true, false], true);
        assert.equal(r[3], null);
        // 区間0: Q0 = 2a - b = (-60, 0), Q3 = P[2]
        assertPointClose(r[0].control1, { x: 0 + (60 + 60) / 6, y: 0 });
        // 区間2（P2→P3）: Q0 = P[1], Q3 = 2b - a = (-60, 60)
        assertPointClose(r[2].control2, { x: 0 - (-60 - 60) / 6, y: 60 - (60 - 60) / 6 });
    });

    it('頂点の拡大縮小（縦横別）・平行移動と制御点の変換が可換（1次式）', () => {
        const flags = [true, true, false, true];
        const src = pts([[0, 0], [60, 10], [70, 70], [10, 90]]);
        const sx = 2;
        const sy = 0.5;
        const dx = 13;
        const dy = -7;
        const tf = (p) => ({ x: p.x * sx + dx, y: p.y * sy + dy });
        const base = computeSmoothSegmentControls(src, flags, true);
        const moved = computeSmoothSegmentControls(src.map(tf), flags, true);
        base.forEach((c, i) => {
            if (c === null) {
                assert.equal(moved[i], null);
                return;
            }
            assertPointClose(moved[i].control1, tf(c.control1));
            assertPointClose(moved[i].control2, tf(c.control2));
        });
    });

    it('引数を書き換えず、毎回新しいオブジェクトを返す', () => {
        const flags = [true, true, true];
        const snapshot = JSON.stringify([P4, flags]);
        const a = computeSmoothSegmentControls(P4, flags, false);
        const b = computeSmoothSegmentControls(P4, flags, false);
        assert.equal(JSON.stringify([P4, flags]), snapshot);
        assert.notEqual(a, b);
        assert.notEqual(a[0], b[0]);
        assert.notEqual(a[0].control1, b[0].control1);
    });
});

describe('computeSmoothSegmentControls 逆順（Phase 09-01b）', () => {
    it('開いたパスで頂点と区間の種類の並びを逆順にすると、区間 m-1-i は元の区間 i の制御点を入れ替えたものと一致する', () => {
        const points = pts([[0, 0], [40, 30], [90, 10], [120, 80], [60, 120]]);
        const flags = [true, true, false, true];
        const forward = computeSmoothSegmentControls(points, flags, false);
        const backward = computeSmoothSegmentControls([...points].reverse(), [...flags].reverse(), false);
        const m = flags.length;
        assert.equal(backward.length, m);
        forward.forEach((c, i) => {
            const r = backward[m - 1 - i];
            if (c === null) {
                assert.equal(r, null, `区間${i}`);
                return;
            }
            assertPointClose(r.control1, c.control2);
            assertPointClose(r.control2, c.control1);
        });
    });
});

describe('computeSmoothSegmentControls 角の点（Phase 09-02a）', () => {
    const P5 = pts([[0, 0], [60, 10], [70, 70], [130, 80], [150, 20]]);
    const ALL5 = [true, true, true, true];
    const SQ = pts([[0, 0], [60, 0], [60, 60], [0, 60]]);

    /**
     * 制御点の結果を比較用の文字列にする。
     * @param {Array<Object|null>} r - computeSmoothSegmentControlsの結果
     * @returns {string} JSON文字列
     */
    const ser = (r) => JSON.stringify(r);

    it('第4引数を省いた結果と[]・すべてfalseを渡した結果が同じ（開いた・閉じた・混在）', () => {
        const cases = [
            [P5, ALL5, false],
            [SQ, [true, true, true, true], true],
            [P5, [true, false, true, true], false],
            [SQ, [true, true, true, false], true],
        ];
        for (const [p, f, c] of cases) {
            const base = ser(computeSmoothSegmentControls(p, f, c));
            assert.equal(ser(computeSmoothSegmentControls(p, f, c, [])), base);
            assert.equal(ser(computeSmoothSegmentControls(p, f, c, p.map(() => false))), base);
        }
    });

    it('開いた全区間曲線の途中の点を角にすると、前の区間のcontrol2と次の区間のcontrol1が仮の点の式になる', () => {
        const r = computeSmoothSegmentControls(P5, ALL5, false, [false, false, true, false, false]);
        // 区間1（P1→P2）: Q3 = 2b - a、Q0 = P0
        const a = P5[1];
        const b = P5[2];
        const q3 = { x: 2 * b.x - a.x, y: 2 * b.y - a.y };
        assertPointClose(r[1].control2, { x: b.x - (q3.x - a.x) / 6, y: b.y - (q3.y - a.y) / 6 });
        // 区間2（P2→P3）: Q0 = 2a - b、Q3 = P4
        const a2 = P5[2];
        const b2 = P5[3];
        const q0 = { x: 2 * a2.x - b2.x, y: 2 * a2.y - b2.y };
        assertPointClose(r[2].control1, { x: a2.x + (b2.x - q0.x) / 6, y: a2.y + (b2.y - q0.y) / 6 });
    });

    it('頂点5つ以上で、角の点の両隣以外の区間の制御点は角なしと同じ', () => {
        const P7 = pts([[0, 0], [50, 20], [90, 70], [140, 60], [180, 10], [230, 30], [260, 90]]);
        const flags = [true, true, true, true, true, true];
        const base = computeSmoothSegmentControls(P7, flags, false);
        const r = computeSmoothSegmentControls(P7, flags, false, [false, false, false, true, false, false, false]);
        // 角は点3。変わるのは区間2・3だけ
        [0, 1, 4, 5].forEach((i) => assert.equal(ser(r[i]), ser(base[i]), `区間${i}`));
        assert.notEqual(ser(r[2]), ser(base[2]));
        assert.notEqual(ser(r[3]), ser(base[3]));
    });

    it('直線の区間との境目の点・開いたパスの端の点の角の情報は結果を変えない', () => {
        const flags = [true, false, true, true];
        const base = computeSmoothSegmentControls(P5, flags, false);
        // 点1・2は直線の区間との境目、点0・4は端
        assert.equal(ser(computeSmoothSegmentControls(P5, flags, false, [true, true, true, false, true])), ser(base));
    });

    it('閉じたパスの始点を角にすると、閉じる区間のcontrol2と区間0のcontrol1が仮の点の式になる', () => {
        const r = computeSmoothSegmentControls(SQ, [true, true, true, true], true, [true, false, false, false]);
        // 区間0: Q0 = 2a - b
        const a = SQ[0];
        const b = SQ[1];
        const q0 = { x: 2 * a.x - b.x, y: 2 * a.y - b.y };
        assertPointClose(r[0].control1, { x: a.x + (b.x - q0.x) / 6, y: a.y + (b.y - q0.y) / 6 });
        // 区間3（P3→P0）: Q3 = 2b - a（b = P0, a = P3）
        const a3 = SQ[3];
        const b3 = SQ[0];
        const q3 = { x: 2 * b3.x - a3.x, y: 2 * b3.y - a3.y };
        assertPointClose(r[3].control2, { x: b3.x - (q3.x - a3.x) / 6, y: b3.y - (q3.y - a3.y) / 6 });
    });

    it('閉じた全区間曲線の全点を角にすると各区間が直線と同じ形になる', () => {
        const r = computeSmoothSegmentControls(SQ, [true, true, true, true], true, [true, true, true, true]);
        r.forEach((c, i) => {
            const a = SQ[i];
            const b = SQ[(i + 1) % 4];
            assertPointClose(c.control1, { x: a.x + (b.x - a.x) / 3, y: a.y + (b.y - a.y) / 3 });
            assertPointClose(c.control2, { x: b.x - (b.x - a.x) / 3, y: b.y - (b.y - a.y) / 3 });
        });
    });

    it('角の点を含めても制御点が頂点の1次式（拡大縮小・回転・平行移動と可換）', () => {
        const flags = [true, true, true, true];
        const corners = [false, true, false, true];
        const src = pts([[0, 0], [60, 10], [70, 70], [10, 90]]);
        const cos = Math.cos(0.7);
        const sin = Math.sin(0.7);
        const tf = (p) => ({ x: (p.x * 2) * cos - (p.y * 0.5) * sin + 13, y: (p.x * 2) * sin + (p.y * 0.5) * cos - 7 });
        const base = computeSmoothSegmentControls(src, flags, true, corners);
        const moved = computeSmoothSegmentControls(src.map(tf), flags, true, corners);
        base.forEach((c, i) => {
            assertPointClose(moved[i].control1, tf(c.control1));
            assertPointClose(moved[i].control2, tf(c.control2));
        });
    });

    it('引数（頂点・区間の種類・角の配列）を書き換えない', () => {
        const flags = [true, true, true, true];
        const corners = [false, true, false, true, false];
        const snapshot = JSON.stringify([P5, flags, corners]);
        computeSmoothSegmentControls(P5, flags, false, corners);
        assert.equal(JSON.stringify([P5, flags, corners]), snapshot);
    });
});

describe('applyAffineTransformToPoint', () => {
    it('拡大・裏返し・平行移動を当てる（動かない点は固定）', () => {
        const t = { a: 2, b: 0, c: 0, d: -1, e: 10, f: 20 };
        assert.deepEqual(applyAffineTransformToPoint(t, { x: 3, y: 4 }), { x: 16, y: 16 });
        // 動かない点(5, 5)を固定した横2倍・縦裏返し
        const fixed = { a: 2, b: 0, c: 0, d: -1, e: 5 - 2 * 5, f: 5 + 5 };
        assert.deepEqual(applyAffineTransformToPoint(fixed, { x: 5, y: 5 }), { x: 5, y: 5 });
    });
    it('回転を含む一般の変換（90度）を当てる', () => {
        const t = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
        assert.deepEqual(applyAffineTransformToPoint(t, { x: 1, y: 0 }), { x: 0, y: 1 });
        assert.deepEqual(applyAffineTransformToPoint(t, { x: 0, y: 1 }), { x: -1, y: 0 });
    });
    it('新しいオブジェクトを返し、引数を書き換えない', () => {
        const t = { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1 };
        const p = { x: 2, y: 3 };
        const r = applyAffineTransformToPoint(t, p);
        assert.notEqual(r, p);
        assert.deepEqual(p, { x: 2, y: 3 });
        assert.deepEqual(t, { a: 1, b: 0, c: 0, d: 1, e: 1, f: 1 });
    });
});
