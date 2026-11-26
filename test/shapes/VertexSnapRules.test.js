/**
 * 責務: 吸い付くだけの規則（VertexSnapRules）を、実物の図形を使い公開APIのみを通して検証する。
 * 吸い付く先の頂点の読み方・いちばん近い頂点・結合する吸い付きとの選び方・ツールごとに働く点を確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    VERTEX_SNAP_KIND,
    isVertexSnap,
    snapVerticesOf,
    findVertexSnapTarget,
    chooseSnapTarget,
    isVertexSnapDrawStartShapeType,
    isVertexSnapDrawEndShapeType,
} from '../../js/shapes/VertexSnapRules.js';
import { isDrawnStartSnap } from '../../js/shapes/EndpointSnapRules.js';
import { lineEndpointOf } from '../../js/shapes/PathJoinRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path, SEGMENT_KIND_BEZIER } from '../../js/shapes/Path.js';

/** 回転の変換（30度） */
const ROTATE = { a: Math.cos(Math.PI / 6), b: Math.sin(Math.PI / 6), c: -Math.sin(Math.PI / 6), d: Math.cos(Math.PI / 6), e: 0, f: 0 };

/** 指定の頂点のパスを作る */
function makePath(coords, closed = false) {
    return new Path(coords.map(([x, y]) => ({ x, y })), closed, '#000000', 2);
}

/** 図形にidを付ける */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

describe('VertexSnapRules snapVerticesOf', () => {
    it('開いたパスは途中の点を含むすべての点を並びの順に返す', () => {
        const path = makePath([[0, 0], [10, 5], [20, 0], [30, 9]]);
        assert.deepEqual(snapVerticesOf(path), [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 9 }]);
    });
    it('閉じたパスはすべての点を返す', () => {
        const path = makePath([[0, 0], [10, 0], [10, 10]], true);
        assert.deepEqual(snapVerticesOf(path), [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    });
    it('曲がり方を持つ区間のパスでも制御点は入らない', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }],
            false,
            '#000000',
            2,
            null,
            [{ kind: SEGMENT_KIND_BEZIER, control1: { x: 33, y: 77 }, control2: { x: 66, y: 88 } }]
        );
        const vertices = snapVerticesOf(path);
        assert.deepEqual(vertices, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    });
    it('矩形は4つの角を返す', () => {
        const rect = new Rect(0, 0, 40, 20);
        const expected = rect.toJSON().points.map((p) => ({ x: p.x, y: p.y }));
        const vertices = snapVerticesOf(rect);
        assert.equal(vertices.length, 4);
        assert.deepEqual(vertices, expected);
    });
    it('回した矩形でも points の4点を返す', () => {
        let rect = new Rect(0, 0, 40, 20);
        rect = rect.createTransformed(ROTATE);
        const expected = rect.toJSON().points.map((p) => ({ x: p.x, y: p.y }));
        assert.deepEqual(snapVerticesOf(rect), expected);
    });
    it('直線は両端を返す', () => {
        assert.deepEqual(snapVerticesOf(new Line(1, 2, 30, 40)), [{ x: 1, y: 2 }, { x: 30, y: 40 }]);
    });
    it('今の曲線は始点・終点だけで制御点が入らない', () => {
        const curve = new Curve(0, 0, 100, 0);
        const data = curve.toJSON();
        const vertices = snapVerticesOf(curve);
        assert.deepEqual(vertices, [lineEndpointOf(data, 'start'), lineEndpointOf(data, 'end')]);
        assert.deepEqual(vertices, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    });
    it('弧は両端と中心の3点で、頂上・points[1]〜[4]が入らない', () => {
        const arc = new Ellipse(0, 0, 100, 60, 'arc');
        const data = arc.toJSON();
        const vertices = snapVerticesOf(arc);
        assert.equal(vertices.length, 3);
        assert.deepEqual(vertices[0], lineEndpointOf(data, 'start'));
        assert.deepEqual(vertices[1], lineEndpointOf(data, 'end'));
        assert.deepEqual(vertices[2], { x: data.points[0].x, y: data.points[0].y });
    });
    it('回した弧でも両端は lineEndpointOf と同じ値', () => {
        let arc = new Ellipse(0, 0, 100, 60, 'arc');
        arc = arc.createTransformed(ROTATE);
        const data = arc.toJSON();
        const vertices = snapVerticesOf(arc);
        assert.deepEqual(vertices[0], lineEndpointOf(data, 'start'));
        assert.deepEqual(vertices[1], lineEndpointOf(data, 'end'));
    });
    it('円は中心だけを返す', () => {
        const circle = new Ellipse(0, 0, 100, 60, 'circle');
        const c = circle.toJSON().points[0];
        assert.deepEqual(snapVerticesOf(circle), [{ x: c.x, y: c.y }]);
    });
    it('未知の図形は空を返す', () => {
        assert.deepEqual(snapVerticesOf({ toJSON: () => ({ type: 'unknown', points: [{ x: 1, y: 1 }] }) }), []);
    });
    it('戻り値は図形の点と同じオブジェクトでなく、図形を書き換えない', () => {
        const path = makePath([[0, 0], [10, 5]]);
        const before = JSON.stringify(path.toJSON());
        const vertices = snapVerticesOf(path);
        vertices[0].x = 999;
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.notEqual(vertices[0], path.toJSON().points[0]);
    });
});

describe('VertexSnapRules findVertexSnapTarget', () => {
    const P = { x: 0, y: 0 };
    it('パスの途中の点に吸い付く', () => {
        const shapes = [withId(makePath([[0, 0], [50, 50], [100, 0]]), 'P')];
        assert.deepEqual(findVertexSnapTarget(shapes, { x: 51, y: 49 }, 5), { kind: 'vertex', x: 50, y: 50 });
    });
    it('閉じたパスの点に吸い付く', () => {
        const shapes = [withId(makePath([[0, 0], [100, 0], [100, 100]], true), 'P')];
        assert.deepEqual(findVertexSnapTarget(shapes, { x: 100, y: 99 }, 5), { kind: 'vertex', x: 100, y: 100 });
    });
    it('矩形の角に吸い付く', () => {
        const rect = withId(new Rect(0, 0, 40, 20), 'R');
        const corner = rect.toJSON().points[2];
        const result = findVertexSnapTarget([rect], { x: corner.x + 1, y: corner.y - 1 }, 5);
        assert.deepEqual(result, { kind: 'vertex', x: corner.x, y: corner.y });
    });
    it('直線の両端に吸い付く', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        assert.deepEqual(findVertexSnapTarget(shapes, { x: 99, y: 1 }, 5), { kind: 'vertex', x: 100, y: 0 });
        assert.deepEqual(findVertexSnapTarget(shapes, { x: 1, y: 1 }, 5), { kind: 'vertex', x: 0, y: 0 });
    });
    it('今の曲線の始点・終点に吸い付き、制御点には吸い付かない', () => {
        const curve = withId(new Curve(0, 0, 100, 0), 'C');
        const data = curve.toJSON();
        const end = lineEndpointOf(data, 'end');
        assert.deepEqual(findVertexSnapTarget([curve], { x: end.x - 1, y: end.y }, 5), { kind: 'vertex', x: end.x, y: end.y });
        const start = lineEndpointOf(data, 'start');
        assert.deepEqual(findVertexSnapTarget([curve], { x: start.x + 1, y: start.y }, 5), { kind: 'vertex', x: start.x, y: start.y });
        const control = data.points[1];
        assert.deepEqual(control, { x: 50, y: 0 });
        assert.equal(findVertexSnapTarget([curve], { x: control.x, y: control.y }, 0.5), null);
    });
    it('引っ張る点（曲がり方を持つ区間の制御点）には吸い付かない', () => {
        const path = withId(
            new Path(
                [{ x: 0, y: 0 }, { x: 100, y: 0 }],
                false,
                '#000000',
                2,
                null,
                [{ kind: SEGMENT_KIND_BEZIER, control1: { x: 33, y: 77 }, control2: { x: 66, y: 88 } }]
            ),
            'B'
        );
        assert.equal(findVertexSnapTarget([path], { x: 33, y: 77 }, 5), null);
        assert.equal(findVertexSnapTarget([path], { x: 66, y: 88 }, 5), null);
    });
    it('弧の両端・中心に吸い付き、頂上には吸い付かない', () => {
        const arc = withId(new Ellipse(0, 0, 100, 60, 'arc'), 'A');
        const data = arc.toJSON();
        const start = lineEndpointOf(data, 'start');
        const center = data.points[0];
        assert.deepEqual(findVertexSnapTarget([arc], { x: start.x, y: start.y }, 1), { kind: 'vertex', x: start.x, y: start.y });
        assert.deepEqual(findVertexSnapTarget([arc], { x: center.x, y: center.y }, 1), { kind: 'vertex', x: center.x, y: center.y });
        const end = lineEndpointOf(data, 'end');
        assert.deepEqual(findVertexSnapTarget([arc], { x: end.x, y: end.y }, 1), { kind: 'vertex', x: end.x, y: end.y });
        // points[1]・[3]・[4]は両端と同じ座標、[2]（頂上）だけが両端・中心のどれとも違う
        assert.deepEqual(data.points[1], { x: end.x, y: end.y });
        assert.deepEqual(data.points[3], { x: start.x, y: start.y });
        assert.deepEqual(data.points[4], { x: end.x, y: end.y });
        const apex = data.points[2];
        assert.deepEqual(apex, { x: 0, y: -60 });
        assert.equal(findVertexSnapTarget([arc], { x: apex.x, y: apex.y }, 1), null);
    });
    it('円の中心に吸い付く', () => {
        const circle = withId(new Ellipse(0, 0, 100, 60, 'circle'), 'E');
        const c = circle.toJSON().points[0];
        assert.deepEqual(findVertexSnapTarget([circle], { x: c.x + 2, y: c.y }, 5), { kind: 'vertex', x: c.x, y: c.y });
    });
    it('許容距離ちょうどは吸い付き、外は吸い付かない', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        assert.notEqual(findVertexSnapTarget(shapes, { x: 5, y: 0 }, 5), null);
        assert.equal(findVertexSnapTarget(shapes, { x: 5.001, y: 0 }, 5), null);
    });
    it('いちばん近い点を選ぶ', () => {
        const shapes = [withId(makePath([[0, 0], [4, 0], [8, 0]]), 'P')];
        assert.deepEqual(findVertexSnapTarget(shapes, { x: 3, y: 0 }, 10), { kind: 'vertex', x: 4, y: 0 });
    });
    it('同じ距離なら前面（配列で後ろ）の図形', () => {
        const back = withId(new Line(0, 0, 100, 0), 'back');
        const front = withId(new Line(0, 0, 100, 0), 'front');
        const shapes = [back, front];
        const result = findVertexSnapTarget(shapes, { x: 0, y: 3 }, 5);
        assert.deepEqual(result, { kind: 'vertex', x: 0, y: 0 });
        const upper = withId(new Line(6, 0, 100, 0), 'upper');
        const lower = withId(new Line(-6, 0, 100, 0), 'lower');
        assert.deepEqual(findVertexSnapTarget([lower, upper], { x: 0, y: 0 }, 10), { kind: 'vertex', x: 6, y: 0 });
    });
    it('excludedShapeIds の図形の点には吸い付かず、ほかの図形には吸い付く', () => {
        const a = withId(new Line(0, 0, 100, 0), 'A');
        const b = withId(new Line(2, 0, 100, 50), 'B');
        assert.deepEqual(findVertexSnapTarget([a, b], { x: 0, y: 0 }, 5, ['B']), { kind: 'vertex', x: 0, y: 0 });
        assert.deepEqual(findVertexSnapTarget([a, b], { x: 0, y: 0 }, 5, ['A']), { kind: 'vertex', x: 2, y: 0 });
        assert.equal(findVertexSnapTarget([a, b], { x: 0, y: 0 }, 5, ['A', 'B']), null);
    });
    it('結果は kind・x・y だけで shapeId・end を持たない', () => {
        const result = findVertexSnapTarget([withId(new Line(0, 0, 10, 0), 'L')], P, 5);
        assert.deepEqual(Object.keys(result).sort(), ['kind', 'x', 'y']);
        assert.equal(result.kind, VERTEX_SNAP_KIND);
    });
    it('図形が無ければ null で、引数を書き換えない', () => {
        assert.equal(findVertexSnapTarget([], P, 5), null);
        const shapes = [withId(new Line(0, 0, 10, 0), 'L')];
        const before = JSON.stringify(shapes[0].toJSON());
        const point = { x: 1, y: 1 };
        const excluded = ['Z'];
        findVertexSnapTarget(shapes, point, 5, excluded);
        assert.equal(JSON.stringify(shapes[0].toJSON()), before);
        assert.deepEqual(point, { x: 1, y: 1 });
        assert.deepEqual(excluded, ['Z']);
    });
});

describe('VertexSnapRules chooseSnapTarget', () => {
    const point = { x: 0, y: 0 };
    const join = { shapeId: 'J', end: 'start', x: 3, y: 0 };
    const vertex = { kind: VERTEX_SNAP_KIND, x: 0, y: 2 };
    it('結合する吸い付きだけならそれを返す', () => {
        assert.equal(chooseSnapTarget(point, join, null), join);
    });
    it('吸い付くだけだけならそれを返す', () => {
        assert.equal(chooseSnapTarget(point, null, vertex), vertex);
    });
    it('両方無ければ null', () => {
        assert.equal(chooseSnapTarget(point, null, null), null);
    });
    it('近い方を返す', () => {
        assert.equal(chooseSnapTarget(point, join, vertex), vertex);
        const nearJoin = { shapeId: 'J', end: 'end', x: 1, y: 0 };
        assert.equal(chooseSnapTarget(point, nearJoin, vertex), nearJoin);
    });
    it('同じ距離なら結合する吸い付き（SnapTarget・DrawnStartSnap とも）', () => {
        const sameJoin = { shapeId: 'J', end: 'end', x: 2, y: 0 };
        assert.equal(chooseSnapTarget(point, sameJoin, vertex), sameJoin);
        const drawnStart = { kind: 'drawnStart', x: 0, y: -2 };
        assert.equal(chooseSnapTarget(point, drawnStart, vertex), drawnStart);
    });
});

describe('VertexSnapRules isVertexSnap', () => {
    it('VertexSnap で真', () => {
        assert.equal(isVertexSnap({ kind: 'vertex', x: 0, y: 0 }), true);
    });
    it('SnapTarget・DrawnStartSnap・null・undefined で偽', () => {
        assert.equal(isVertexSnap({ shapeId: 'L', end: 'start', x: 0, y: 0 }), false);
        assert.equal(isVertexSnap({ kind: 'drawnStart', x: 0, y: 0 }), false);
        assert.equal(isVertexSnap(null), false);
        assert.equal(isVertexSnap(undefined), false);
    });
    it('isDrawnStartSnap は VertexSnap で偽', () => {
        assert.equal(isDrawnStartSnap({ kind: 'vertex', x: 0, y: 0 }), false);
    });
});

describe('VertexSnapRules ツールごとに働く点', () => {
    it('描き始めは line・curve・rect・arc・circle で真', () => {
        for (const t of ['line', 'curve', 'rect', 'arc', 'circle']) assert.equal(isVertexSnapDrawStartShapeType(t), true, t);
    });
    it('描き始めは path・未知・null で偽', () => {
        for (const t of ['path', 'unknown', null, undefined]) assert.equal(isVertexSnapDrawStartShapeType(t), false, String(t));
    });
    it('2つ目の点は rect だけ真', () => {
        assert.equal(isVertexSnapDrawEndShapeType('rect'), true);
        for (const t of ['line', 'curve', 'arc', 'circle', 'path', 'unknown', null]) {
            assert.equal(isVertexSnapDrawEndShapeType(t), false, String(t));
        }
    });
});
