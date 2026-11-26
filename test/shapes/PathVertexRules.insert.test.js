/**
 * 責務: パスの頂点の追加・削除の規則（PathVertexRules）のうち、点を足した図形の組み立て（planVertexInsertion）と「曲線に」の結果が変わらないことを、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planVertexInsertion } from '../../js/shapes/PathVertexRules.js';
import { cubicBezierPoint } from '../../js/shapes/ShapeGeometry.js';
import { planSegmentKindSwitch, SegmentKindSwitch } from '../../js/shapes/PathSegmentKindRules.js';
import {
    Path,
    SEGMENT_KIND_LINE,
    SEGMENT_KIND_SMOOTH,
    SEGMENT_KIND_BEZIER,
    resolveSegmentControls,
} from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

const TOL = 3;

/**
 * 2点間の距離を返す。
 * @param {{x: number, y: number}} a - 点1
 * @param {{x: number, y: number}} b - 点2
 * @returns {number} 距離
 */
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * 区間の種類の並びを返す。
 * @param {Path} path - パス
 * @returns {string[]} 種類の並び
 */
function kindsOf(path) {
    return path.segments.map((segment) => segment.kind);
}

describe('planVertexInsertion: パスの直線の区間', () => {
    it('開いたパスの区間1に足す（点・区間・角・スタイル・id・insertedIndex）', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
            false, '#112233', 4, '#445566',
            [SEGMENT_KIND_LINE, SEGMENT_KIND_LINE],
            [false, true, false],
        );
        path.id = 'p1';
        const plan = planVertexInsertion(path, { x: 101, y: 40 }, TOL);
        assert.equal(plan.insertedIndex, 2);
        const result = plan.shape;
        assert.equal(result.id, null);
        assert.deepEqual(result.points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 40 }, { x: 100, y: 100 }]);
        assert.deepEqual(kindsOf(result), ['line', 'line', 'line']);
        assert.deepEqual(result.corners, [false, true, false, false]);
        assert.equal(result.closed, false);
        assert.equal(result.strokeColor, '#112233');
        assert.equal(result.strokeWidth, 4);
        assert.equal(result.fillColor, '#445566');
    });

    it('閉じたパスの最後の区間に足すと末尾に入る', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
            true, '#000000', 2, '#ff0000', SEGMENT_KIND_LINE,
        );
        const plan = planVertexInsertion(path, { x: 50, y: 51 }, TOL);
        assert.equal(plan.insertedIndex, 3);
        assert.deepEqual(plan.shape.points[3], { x: 50.5, y: 50.5 });
        assert.equal(plan.shape.points.length, 4);
        assert.equal(plan.shape.closed, true);
        assert.deepEqual(kindsOf(plan.shape), ['line', 'line', 'line', 'line']);
        assert.deepEqual(plan.shape.corners, [false, false, false, false]);
        assert.equal(plan.shape.fillColor, '#ff0000');
    });

    it('閉じたパスの途中の区間に足す', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
            true, '#000000', 2, null, SEGMENT_KIND_LINE,
        );
        const plan = planVertexInsertion(path, { x: 25, y: 1 }, TOL);
        assert.equal(plan.insertedIndex, 1);
        assert.deepEqual(plan.shape.points[1], { x: 25, y: 0 });
        assert.equal(plan.shape.points.length, 4);
    });
});

describe('planVertexInsertion: bezierの区間', () => {
    const control1 = { x: 20, y: 80 };
    const control2 = { x: 80, y: 80 };

    it('分けた2つの区間が元の曲線と同じ形（開いたパス）', () => {
        const a = { x: 0, y: 0 };
        const b = { x: 100, y: 0 };
        const path = new Path([a, b, { x: 200, y: 0 }], false, '#000000', 2, null, [
            { kind: SEGMENT_KIND_BEZIER, control1, control2 },
            SEGMENT_KIND_LINE,
        ]);
        const mid = cubicBezierPoint(a, control1, control2, b, 0.5);
        const plan = planVertexInsertion(path, mid, TOL);
        assert.equal(plan.insertedIndex, 1);
        const result = plan.shape;
        assert.deepEqual(kindsOf(result), ['bezier', 'bezier', 'line']);
        assert.equal(result.points.length, 4);
        const p = result.points;
        const c1 = result.segments[0];
        const c2 = result.segments[1];
        for (let k = 0; k <= 20; k++) {
            const u = k / 20;
            const original = cubicBezierPoint(a, control1, control2, b, u / 2);
            assert.ok(dist(original, cubicBezierPoint(p[0], c1.control1, c1.control2, p[1], u)) < 1e-6);
            const original2 = cubicBezierPoint(a, control1, control2, b, 0.5 + u / 2);
            assert.ok(dist(original2, cubicBezierPoint(p[1], c2.control1, c2.control2, p[2], u)) < 1e-6);
        }
        assert.deepEqual(result.corners, [false, false, false, false]);
    });

    it('閉じたパスの最後の区間（足した点は末尾）', () => {
        const a = { x: 100, y: 0 };
        const b = { x: 0, y: 0 };
        const path = new Path([b, { x: 50, y: -50 }, a], true, '#000000', 2, '#00ff00', [
            SEGMENT_KIND_LINE,
            SEGMENT_KIND_LINE,
            { kind: SEGMENT_KIND_BEZIER, control1: { x: 80, y: 60 }, control2: { x: 20, y: 60 } },
        ]);
        const mid = cubicBezierPoint(a, { x: 80, y: 60 }, { x: 20, y: 60 }, b, 0.5);
        const plan = planVertexInsertion(path, mid, TOL);
        assert.equal(plan.insertedIndex, 3);
        assert.equal(plan.shape.points.length, 4);
        assert.deepEqual(kindsOf(plan.shape), ['line', 'line', 'bezier', 'bezier']);
        assert.ok(dist(plan.shape.points[3], mid) < 1e-6);
        assert.equal(plan.shape.closed, true);
    });
});

describe('planVertexInsertion: smoothの区間', () => {
    it('足した点が元の曲線の上に乗り、離れた区間の制御点は元と同じ', () => {
        const points = [{ x: 0, y: 0 }, { x: 100, y: 60 }, { x: 200, y: 0 }, { x: 300, y: 60 }, { x: 400, y: 0 }, { x: 500, y: 60 }, { x: 600, y: 0 }];
        const segs = Array.from({ length: 6 }, () => SEGMENT_KIND_SMOOTH);
        const path = new Path(points, false, '#000000', 2, null, segs, [false, false, false, false, false, false, false]);
        const before = resolveSegmentControls(path);
        const target = cubicBezierPoint(points[0], before[0].control1, before[0].control2, points[1], 0.5);
        const plan = planVertexInsertion(path, target, TOL);
        assert.equal(plan.insertedIndex, 1);
        const result = plan.shape;
        assert.ok(dist(result.points[1], target) < 0.05);
        assert.deepEqual(kindsOf(result), Array(7).fill('smooth'));
        assert.equal(result.corners[1], false);
        const after = resolveSegmentControls(result);
        // 元の区間3〜5（新しい4〜6）は足した区間から離れているので変わらない
        for (let i = 3; i < 6; i++) {
            assert.deepEqual(after[i + 1], before[i]);
        }
    });

    it('閉じたパスの角はそのまま、足した点は角でない', () => {
        const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
        const path = new Path(points, true, '#000000', 2, null, SEGMENT_KIND_SMOOTH, [true, false, false, true]);
        const controls = resolveSegmentControls(path);
        const target = cubicBezierPoint(points[3], controls[3].control1, controls[3].control2, points[0], 0.5);
        const plan = planVertexInsertion(path, target, TOL);
        assert.equal(plan.insertedIndex, 4);
        assert.deepEqual(plan.shape.corners, [true, false, false, true, false]);
        assert.deepEqual(kindsOf(plan.shape), Array(5).fill('smooth'));
    });
});

describe('planVertexInsertion: 直線・矩形・今の曲線', () => {
    it('直線は点3つの開いたパス（line×2）になる', () => {
        const line = new Line(0, 0, 100, 0, '#010203', 5, '#0a0b0c');
        const plan = planVertexInsertion(line, { x: 40, y: 2 }, TOL);
        assert.equal(plan.insertedIndex, 1);
        assert.equal(plan.shape.type, 'path');
        assert.deepEqual(plan.shape.points, [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 100, y: 0 }]);
        assert.deepEqual(kindsOf(plan.shape), ['line', 'line']);
        assert.equal(plan.shape.closed, false);
        assert.equal(plan.shape.strokeColor, '#010203');
        assert.equal(plan.shape.strokeWidth, 5);
        assert.equal(plan.shape.fillColor, '#0a0b0c');
        assert.equal(plan.shape.id, null);
    });

    it('矩形は点5つの閉じたパス（line×5）。辺0に足した点は番号1', () => {
        const rect = new Rect(0, 0, 100, 50, '#000000', 2, '#abcdef');
        const plan = planVertexInsertion(rect, { x: 30, y: -1 }, TOL);
        assert.equal(plan.insertedIndex, 1);
        assert.equal(plan.shape.points.length, 5);
        assert.deepEqual(plan.shape.points[1], { x: 30, y: 0 });
        assert.equal(plan.shape.closed, true);
        assert.deepEqual(kindsOf(plan.shape), Array(5).fill('line'));
        assert.deepEqual(plan.shape.corners, Array(5).fill(false));
        assert.equal(plan.shape.fillColor, '#abcdef');
    });

    it('矩形の左辺（bottomLeft→topLeft）に足すと末尾', () => {
        const rect = new Rect(0, 0, 100, 50);
        const plan = planVertexInsertion(rect, { x: 1, y: 20 }, TOL);
        assert.equal(plan.insertedIndex, 4);
        assert.deepEqual(plan.shape.points[4], { x: 0, y: 20 });
    });

    it('回した矩形（斜めの辺）にも足せる', () => {
        const rect = new Rect(0, 0, 100, 50);
        const data = rect.toJSON();
        const rotated = Rect.fromJSON({
            ...data,
            points: [{ x: 50, y: 0 }, { x: 100, y: 50 }, { x: 50, y: 100 }, { x: 0, y: 50 }],
        });
        const plan = planVertexInsertion(rotated, { x: 75, y: 25 }, TOL);
        assert.equal(plan.insertedIndex, 1);
        assert.equal(plan.shape.points.length, 5);
        assert.ok(dist(plan.shape.points[1], { x: 75, y: 25 }) < 1e-9);
    });

    it('今の曲線は点3つの開いたパス（bezier×2）で形が変わらない', () => {
        const base = new Curve(0, 0, 100, 0, '#000000', 2, '#00ff00');
        const curve = Curve.fromJSON({
            ...base.toJSON(),
            points: [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }],
        });
        const [s, c, e] = curve.toJSON().points;
        const c1 = { x: s.x + (c.x - s.x) * 2 / 3, y: s.y + (c.y - s.y) * 2 / 3 };
        const c2 = { x: e.x + (c.x - e.x) * 2 / 3, y: e.y + (c.y - e.y) * 2 / 3 };
        const mid = cubicBezierPoint(s, c1, c2, e, 0.5);
        const plan = planVertexInsertion(curve, mid, TOL);
        assert.equal(plan.insertedIndex, 1);
        const result = plan.shape;
        assert.equal(result.points.length, 3);
        assert.equal(result.closed, false);
        assert.deepEqual(kindsOf(result), ['bezier', 'bezier']);
        assert.equal(result.fillColor, '#00ff00');
        for (let k = 0; k <= 10; k++) {
            const u = k / 10;
            const first = result.segments[0];
            assert.ok(dist(cubicBezierPoint(s, c1, c2, e, u / 2),
                cubicBezierPoint(result.points[0], first.control1, first.control2, result.points[1], u)) < 1e-6);
        }
    });
});

describe('planVertexInsertion: 足さない場合・引数を書き換えない', () => {
    it('円・弧はnull（toJSONも呼ばない）', () => {
        const ellipse = new Ellipse(0, 0, 100, 100);
        let called = false;
        ellipse.toJSON = () => { called = true; return {}; };
        assert.equal(planVertexInsertion(ellipse, { x: 50, y: 0 }, 100), null);
        assert.equal(called, false);
    });

    it('許容幅の外はnull', () => {
        const line = new Line(0, 0, 100, 0);
        assert.equal(planVertexInsertion(line, { x: 50, y: 10 }, TOL), null);
    });

    it('頂点の上・開いた線の端の外側（tが0か1）はnull', () => {
        const line = new Line(0, 0, 100, 0);
        assert.equal(planVertexInsertion(line, { x: 0, y: 0 }, TOL), null);
        assert.equal(planVertexInsertion(line, { x: 101, y: 0 }, TOL), null);
        assert.equal(planVertexInsertion(line, { x: -2, y: 0 }, TOL), null);
    });

    it('塗りの内側だけで輪郭から遠い位置はnull', () => {
        const rect = new Rect(0, 0, 100, 100, '#000000', 2, '#ff0000');
        assert.equal(planVertexInsertion(rect, { x: 50, y: 50 }, TOL), null);
    });

    it('引数の図形とtoJSON()の値を書き換えない', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
            false, '#000000', 2, null,
            [{ kind: SEGMENT_KIND_BEZIER, control1: { x: 20, y: 30 }, control2: { x: 80, y: 30 } }, SEGMENT_KIND_SMOOTH],
            [false, true, false],
        );
        const snapshot = JSON.stringify(path.toJSON());
        const plan = planVertexInsertion(path, { x: 50, y: 22 }, 30);
        assert.notEqual(plan, null);
        assert.equal(JSON.stringify(path.toJSON()), snapshot);
        assert.notEqual(plan.shape, path);
        assert.notEqual(plan.shape.points[0], path.points[0]);
    });
});

describe('「曲線に」の結果が今の値のまま', () => {
    /**
     * 選んだ点の組を作る。
     * @param {Object} shape - 図形
     * @param {number[]} indexes - 点の番号
     * @returns {Array<{shape: Object, vertexIndex: number}>} 選んだ点
     */
    function pick(shape, indexes) {
        return indexes.map((vertexIndex) => ({ shape, vertexIndex }));
    }

    it('直線', () => {
        const line = new Line(0, 0, 100, 0);
        line.id = 'l1';
        const plan = planSegmentKindSwitch(pick(line, [0, 1]), SegmentKindSwitch.TO_CURVE);
        assert.equal(plan.length, 1);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.points, [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]);
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'smooth']);
        assert.equal('corners' in data, false);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 2]);
    });

    it('開いたパス', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 20 }], false, '#000000', 2, null, [SEGMENT_KIND_LINE, SEGMENT_KIND_LINE]);
        path.id = 'p1';
        const plan = planSegmentKindSwitch(pick(path, [1, 2]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.points, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 20 }]);
        assert.deepEqual(data.segments.map((s) => s.kind), ['line', 'smooth', 'smooth']);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 1, 3]);
    });

    it('閉じたパスの終点→始点の区間', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }], true, '#000000', 2, null, SEGMENT_KIND_LINE);
        path.id = 'p2';
        const plan = planSegmentKindSwitch(pick(path, [2, 0]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.points, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 20 }, { x: 10, y: 10 }]);
        assert.deepEqual(data.segments.map((s) => s.kind), ['line', 'line', 'smooth', 'smooth']);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 1, 2]);
    });
});
