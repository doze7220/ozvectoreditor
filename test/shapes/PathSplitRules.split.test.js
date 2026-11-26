/**
 * 責務: PathSplitRules の分割（planSplitAtVertices）の結果を、表Aの図形の種類ごとの行に沿って公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planSplitAtVertices } from '../../js/shapes/PathSplitRules.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_BEZIER, resolveSegmentControls } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { cubicBezierPoint } from '../../js/shapes/ShapeGeometry.js';

const P = (x, y) => ({ x, y });
const STYLE = ['#112233', 5, '#445566'];

/** 点5つの開いたパス（点0〜4）。 */
function open5(kinds = SEGMENT_KIND_LINE, corners = []) {
    return withId(new Path([P(0, 0), P(10, 0), P(20, 5), P(30, 0), P(40, 10)], false, ...STYLE, kinds, corners), 'o');
}
/** 点5つの閉じたパス（点0〜4）。 */
function closed5(kinds = SEGMENT_KIND_LINE, corners = []) {
    return withId(new Path([P(0, 0), P(10, 0), P(20, 5), P(30, 0), P(40, 10)], true, ...STYLE, kinds, corners), 'c');
}
function withId(shape, id) {
    shape.id = id;
    return shape;
}
const targets = (shape, ...indexes) => indexes.map((vertexIndex) => ({ shape, vertexIndex }));
const pointsOf = (path) => path.points.map((p) => [p.x, p.y]);

describe('planSplitAtVertices：切れない図形', () => {
    it('直線・今の曲線（どの点を選んでも）・円・点2つのパスは計画が空', () => {
        const line = withId(new Line(0, 0, 10, 0), 'l');
        assert.deepEqual(planSplitAtVertices(targets(line, 0, 1)), []);
        const curve = withId(new Curve(0, 0, 100, 0), 'k');
        assert.deepEqual(planSplitAtVertices(targets(curve, 0, 1, 2)), []);
        const ellipse = withId(new Ellipse(0, 0, 10, 10), 'e');
        assert.deepEqual(planSplitAtVertices(targets(ellipse, 0, 1)), []);
        const two = withId(new Path([P(0, 0), P(10, 0)], false), 't');
        assert.deepEqual(planSplitAtVertices(targets(two, 0, 1)), []);
    });

    it('開いたパスの端の点だけを選んでも計画が空（端を混ぜても数えない）', () => {
        const path = open5();
        assert.deepEqual(planSplitAtVertices(targets(path, 0, 4)), []);
        const plan = planSplitAtVertices(targets(path, 0, 2, 4));
        assert.equal(plan.length, 1);
        assert.equal(plan[0].pieces.length, 2);
    });

    it('範囲外・整数でない番号・同じ点の重複は無視', () => {
        const path = open5();
        assert.deepEqual(planSplitAtVertices(targets(path, -1, 5, 1.5, NaN)), []);
        const plan = planSplitAtVertices(targets(path, 2, 2, 2));
        assert.equal(plan[0].pieces.length, 2);
    });
});

describe('planSplitAtVertices：開いたパス', () => {
    it('途中の点1つで2本（引き継ぐ1本が[0..c]・新しい線が[c..]）', () => {
        const path = open5();
        const plan = planSplitAtVertices(targets(path, 2));
        assert.equal(plan.length, 1);
        assert.equal(plan[0].targetId, 'o');
        const [keeper, added] = plan[0].pieces;
        assert.deepEqual(pointsOf(keeper), [[0, 0], [10, 0], [20, 5]]);
        assert.deepEqual(pointsOf(added), [[20, 5], [30, 0], [40, 10]]);
        for (const piece of plan[0].pieces) {
            assert.equal(piece.type, 'path');
            assert.equal(piece.closed, false);
            assert.equal(piece.id, null);
            assert.equal(piece.strokeColor, '#112233');
            assert.equal(piece.strokeWidth, 5);
            assert.equal(piece.fillColor, '#445566');
            assert.equal(piece.segments.length, piece.points.length - 1);
        }
    });

    it('途中の点2つで3本（start の小さい順）', () => {
        const path = open5();
        const [keeper, a, b] = planSplitAtVertices(targets(path, 3, 1))[0].pieces;
        assert.deepEqual(pointsOf(keeper), [[0, 0], [10, 0]]);
        assert.deepEqual(pointsOf(a), [[10, 0], [20, 5], [30, 0]]);
        assert.deepEqual(pointsOf(b), [[30, 0], [40, 10]]);
    });

    it('続いた2点で切ると間が点2つの線になる', () => {
        const path = open5();
        const pieces = planSplitAtVertices(targets(path, 1, 2))[0].pieces;
        assert.equal(pieces.length, 3);
        assert.deepEqual(pointsOf(pieces[1]), [[10, 0], [20, 5]]);
        assert.equal(pieces[1].type, 'path');
    });

    it('角（端になった点を含む元の値のまま）・区間の種類・bezier の引っ張る点を写す', () => {
        const bez = { kind: SEGMENT_KIND_BEZIER, control1: P(12, 3), control2: P(18, 3) };
        const segments = [{ kind: SEGMENT_KIND_LINE }, bez, { kind: SEGMENT_KIND_SMOOTH }, { kind: SEGMENT_KIND_SMOOTH }];
        const path = open5(segments, [false, false, true, false, false]);
        const [keeper, added] = planSplitAtVertices(targets(path, 2))[0].pieces;
        assert.deepEqual(keeper.segments, [{ kind: SEGMENT_KIND_LINE }, bez]);
        assert.deepEqual(keeper.corners, [false, false, true]);
        assert.deepEqual(added.segments, [{ kind: SEGMENT_KIND_SMOOTH }, { kind: SEGMENT_KIND_SMOOTH }]);
        assert.deepEqual(added.corners, [true, false, false]);
        assert.notEqual(keeper.segments[1], bez);
        assert.notEqual(keeper.segments[1].control1, bez.control1);
    });

    it('bezier・line のピースの形が元の区間と同じ（多数の t で一致）', () => {
        const bez = { kind: SEGMENT_KIND_BEZIER, control1: P(12, 3), control2: P(18, 3) };
        const segments = [bez, { kind: SEGMENT_KIND_LINE }, bez, { kind: SEGMENT_KIND_LINE }];
        const path = open5(segments);
        const originalControls = resolveSegmentControls(path);
        const [keeper, added] = planSplitAtVertices(targets(path, 2))[0].pieces;
        const check = (piece, offset) => {
            const controls = resolveSegmentControls(piece);
            controls.forEach((control, i) => {
                const original = originalControls[offset + i];
                if (original === null) {
                    assert.equal(control, null);
                    return;
                }
                for (let k = 0; k <= 20; k++) {
                    const t = k / 20;
                    const a = cubicBezierPoint(piece.points[i], control.control1, control.control2, piece.points[i + 1], t);
                    const b = cubicBezierPoint(path.points[offset + i], original.control1, original.control2, path.points[offset + i + 1], t);
                    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9);
                }
            });
        };
        check(keeper, 0);
        check(added, 2);
    });

    it('smooth のピースは点・区間の種類が元のまま', () => {
        const path = open5(SEGMENT_KIND_SMOOTH);
        const [keeper, added] = planSplitAtVertices(targets(path, 2))[0].pieces;
        assert.deepEqual(keeper.segments.map((s) => s.kind), [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH]);
        assert.deepEqual(added.segments.map((s) => s.kind), [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH]);
        assert.deepEqual(pointsOf(keeper), [[0, 0], [10, 0], [20, 5]]);
    });
});

describe('planSplitAtVertices：閉じたパス', () => {
    it('1点（点0）で切ると点n+1の1本（始点と終点が同じ座標）・新しい線なし', () => {
        const path = closed5();
        const plan = planSplitAtVertices(targets(path, 0));
        assert.equal(plan[0].pieces.length, 1);
        const piece = plan[0].pieces[0];
        assert.deepEqual(pointsOf(piece), [[0, 0], [10, 0], [20, 5], [30, 0], [40, 10], [0, 0]]);
        assert.equal(piece.closed, false);
        assert.equal(piece.segments.length, 5);
        assert.equal(piece.fillColor, '#445566');
    });

    it('1点（途中の点・最後の点）で切ると、その点から始まりその点で終わる', () => {
        const path = closed5();
        const mid = planSplitAtVertices(targets(path, 2))[0].pieces;
        assert.equal(mid.length, 1);
        assert.deepEqual(pointsOf(mid[0]), [[20, 5], [30, 0], [40, 10], [0, 0], [10, 0], [20, 5]]);
        const last = planSplitAtVertices(targets(path, 4))[0].pieces;
        assert.deepEqual(pointsOf(last[0]), [[40, 10], [0, 0], [10, 0], [20, 5], [30, 0], [40, 10]]);
    });

    it('2点で切る：点0を切れば[0..c2]が引き継ぐ', () => {
        const path = closed5();
        const [keeper, added] = planSplitAtVertices(targets(path, 3, 0))[0].pieces;
        assert.deepEqual(pointsOf(keeper), [[0, 0], [10, 0], [20, 5], [30, 0]]);
        assert.deepEqual(pointsOf(added), [[30, 0], [40, 10], [0, 0]]);
    });

    it('2点で切る：点0を切らないと折り返しのピースが引き継ぐ', () => {
        const path = closed5();
        const [keeper, added] = planSplitAtVertices(targets(path, 1, 3))[0].pieces;
        assert.deepEqual(pointsOf(keeper), [[30, 0], [40, 10], [0, 0], [10, 0]]);
        assert.deepEqual(pointsOf(added), [[10, 0], [20, 5], [30, 0]]);
    });

    it('すべての点で切ると点2つの線がn本', () => {
        const path = closed5();
        const pieces = planSplitAtVertices(targets(path, 0, 1, 2, 3, 4))[0].pieces;
        assert.equal(pieces.length, 5);
        assert.deepEqual(pieces.map((p) => p.points.length), [2, 2, 2, 2, 2]);
        assert.deepEqual(pointsOf(pieces[0]), [[0, 0], [10, 0]]);
        assert.deepEqual(pointsOf(pieces[4]), [[40, 10], [0, 0]]);
        assert.ok(pieces.every((p) => p.type === 'path' && p.closed === false));
    });

    it('角の値は元のまま写す（端になった点の角も）', () => {
        const path = closed5(SEGMENT_KIND_SMOOTH, [true, false, true, false, false]);
        const [keeper] = planSplitAtVertices(targets(path, 2))[0].pieces;
        assert.deepEqual(keeper.corners, [true, false, false, true, false, true]);
    });
});

describe('planSplitAtVertices：矩形', () => {
    const rect = () => withId(new Rect(0, 0, 40, 20, ...STYLE), 'r');

    it('1点で点5つ・line×4の開いたパス（開始が切った角）', () => {
        const base = rect();
        const corners = base.toJSON().points;
        for (let i = 0; i < 4; i++) {
            const plan = planSplitAtVertices(targets(base, i));
            assert.equal(plan[0].pieces.length, 1);
            const piece = plan[0].pieces[0];
            assert.equal(piece.points.length, 5);
            assert.deepEqual(pointsOf(piece), [0, 1, 2, 3, 4].map((k) => [corners[(i + k) % 4].x, corners[(i + k) % 4].y]));
            assert.deepEqual(piece.segments, Array.from({ length: 4 }, () => ({ kind: SEGMENT_KIND_LINE })));
            assert.equal(piece.closed, false);
            assert.equal(piece.fillColor, '#445566');
        }
    });

    it('2点・4点：閉じたパスの行と同じ', () => {
        const base = rect();
        const two = planSplitAtVertices(targets(base, 0, 2))[0].pieces;
        assert.equal(two.length, 2);
        assert.equal(two[0].points.length, 3);
        assert.equal(two[1].points.length, 3);
        const four = planSplitAtVertices(targets(base, 0, 1, 2, 3))[0].pieces;
        assert.equal(four.length, 4);
        assert.ok(four.every((p) => p.points.length === 2));
    });

    it('回した矩形でも点の並びのまま読む', () => {
        const base = withId(new Rect(0, 0, 40, 20, ...STYLE), 'rr');
        const rotated = base.createTransformed
            ? base.createTransformed({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 })
            : base;
        const data = rotated.toJSON();
        const plan = planSplitAtVertices(targets(rotated, 1));
        assert.equal(plan[0].pieces[0].points.length, 5);
        assert.deepEqual(plan[0].pieces[0].points[0], data.points[1]);
    });
});

describe('planSplitAtVertices：複数の図形・引数', () => {
    it('図形は最初に現れた順に束ねる（切れない図形は結果に入れない）', () => {
        const a = open5();
        const b = closed5();
        const line = withId(new Line(0, 0, 10, 0), 'l');
        const plan = planSplitAtVertices([
            ...targets(b, 1),
            ...targets(line, 0),
            ...targets(a, 2),
            ...targets(b, 3),
        ]);
        assert.deepEqual(plan.map((item) => item.targetId), ['c', 'o']);
        assert.equal(plan[0].pieces.length, 2);
        assert.equal(plan[1].pieces.length, 2);
    });

    it('引数を書き換えず、結果は元の配列・点を共有しない・fromJSON で読める', () => {
        const path = open5(SEGMENT_KIND_SMOOTH, [false, true, false, false, false]);
        const before = JSON.stringify(path.toJSON());
        const list = targets(path, 2);
        const listBefore = JSON.stringify(list.map((t) => t.vertexIndex));
        const plan = planSplitAtVertices(list);
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.equal(JSON.stringify(list.map((t) => t.vertexIndex)), listBefore);
        for (const piece of plan[0].pieces) {
            for (const point of piece.points) {
                assert.ok(!path.points.includes(point));
            }
            assert.ok(piece.segments !== path.segments);
            const restored = Path.fromJSON({ ...piece.toJSON(), id: 'x' });
            assert.deepEqual(restored.toJSON(), { ...piece.toJSON(), id: 'x' });
        }
    });
});
