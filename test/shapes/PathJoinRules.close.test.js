/**
 * 責務: 結合の規則（PathJoinRules）の「1本で結合（閉じる）」の結果（弧1本を含む）と、押せる見た目（classifyJoin）・計画（planJoin）の一致を、
 * 公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { classifyJoin, buildClosedPath, buildJoinedPath, planJoin, planDrawnLineJoin, chainSourceOf } from '../../js/shapes/PathJoinRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 頂点の並びを座標の配列から作る。
 * @param {number[][]} coords [x, y] の並び
 * @returns {{x: number, y: number}[]} 頂点の並び
 */
function pts(coords) {
    return coords.map(([x, y]) => ({ x, y }));
}

/**
 * パスを作る。
 * @param {number[][]} coords [x, y] の並び
 * @param {boolean} [closed=false] 閉じたパスか
 * @returns {Path} パス
 */
function makePath(coords, closed = false) {
    return new Path(pts(coords), closed, '#112233', 3);
}

/**
 * 弧を作る（中心(100,200)・横の半径60・縦の半径30。始点(40,200)・頂上(100,170)・終点(160,200)）。
 * @param {string|null} [fill=null] 塗りの色
 * @returns {Ellipse} 弧
 */
function makeArc(fill = null) {
    return new Ellipse(100, 200, 160, 230, 'arc', '#112233', 3, fill);
}

/**
 * idを代入した図形を返す。
 * @param {Object} shape 図形
 * @param {string} id id
 * @returns {Object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * 2点が近いか確かめる。
 * @param {{x: number, y: number}} a 実際の点
 * @param {{x: number, y: number}} b 期待する点
 * @returns {void}
 */
function assertNear(a, b) {
    assert.ok(Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9, `${JSON.stringify(a)} != ${JSON.stringify(b)}`);
}

/**
 * 点を値で比べるために座標の配列へ直す。
 * @param {{x: number, y: number}[]} points 頂点の並び
 * @returns {number[][]} [x, y] の並び
 */
function coordsOf(points) {
    return points.map((p) => [p.x, p.y]);
}

/**
 * 吸い付いた端点の指定を作る。
 * @param {string} shapeId 図形のid
 * @param {'start'|'end'} end 端点
 * @returns {{shapeId: string, end: string}} 端点の指定
 */
function ref(shapeId, end) {
    return { shapeId, end };
}

describe('1本の結合（閉じる）の結果と押せる見た目', () => {
    it('直線・今の曲線・点2つのパスは classifyJoin・planJoin・buildClosedPath とも null', () => {
        for (const shape of [new Line(0, 0, 10, 0), new Curve(0, 0, 100, 100), makePath([[0, 0], [10, 0]])]) {
            assert.equal(classifyJoin([shape]), null);
            assert.equal(planJoin([shape], 5), null);
            assert.equal(buildClosedPath(shape, 5), null);
        }
    });

    it('点3つで両端が重なる開いたパス：classifyJoin は close のまま、planJoin・buildClosedPath は null', () => {
        const path = makePath([[0, 0], [50, 50], [2, 1]]);
        assert.equal(classifyJoin([path]), 'close');
        assert.equal(buildClosedPath(path, 5), null);
        assert.equal(planJoin([path], 5), null);
        assert.notEqual(planJoin([path], 1), null);
    });

    it('点3つ以上で両端が離れている／点4つ以上で重なるパスは今の値のまま', () => {
        const far = planJoin([withId(makePath([[0, 0], [50, 50], [100, 0]]), 'A')], 5);
        assert.equal(far.keepId, true);
        assert.equal(far.targetId, 'A');
        const farData = far.path.toJSON();
        assert.equal(farData.closed, true);
        assert.deepEqual(coordsOf(farData.points), [[0, 0], [50, 50], [100, 0]]);
        assert.deepEqual(farData.segments.map((s) => s.kind), ['line', 'line', 'line']);
        const near = buildClosedPath(makePath([[0, 0], [50, 50], [100, 0], [1, 1]]), 5).toJSON();
        assert.equal(near.closed, true);
        assert.deepEqual(coordsOf(near.points), [[0, 0], [50, 50], [100, 0]]);
    });

    it('弧1本：点[始点, 頂上, 終点]・区間 bezier, bezier, line・引っ張る点は chainSourceOf と同じ・スタイル・塗り', () => {
        const arc = makeArc('#ff0000');
        const chain = chainSourceOf(arc.toJSON());
        assert.equal(classifyJoin([arc]), 'close');
        const plan = planJoin([withId(arc, 'A')], 5);
        assert.equal(plan.keepId, true);
        assert.equal(plan.targetId, 'A');
        assert.deepEqual(plan.removeIds, []);
        const data = plan.path.toJSON();
        assert.equal(data.closed, true);
        assert.deepEqual(coordsOf(data.points), [[40, 200], [100, 170], [160, 200]]);
        assert.deepEqual(data.segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
        for (let i = 0; i < 2; i++) {
            assertNear(data.segments[i].control1, chain.segments[i].control1);
            assertNear(data.segments[i].control2, chain.segments[i].control2);
        }
        assert.ok(data.corners === undefined || data.corners.every((c) => c === false));
        assert.equal(data.strokeColor, '#112233');
        assert.equal(data.strokeWidth, 3);
        assert.equal(data.fillColor, '#ff0000');
        assert.equal(plan.path.isFillable(), true);
    });

    it('左右に裏返した弧・縦に長い弧も閉じる（点は chainSourceOf の始点・頂上・終点）', () => {
        for (const arc of [new Ellipse(100, 200, 40, 230, 'arc'), new Ellipse(100, 200, 130, 300, 'arc')]) {
            const chain = chainSourceOf(arc.toJSON());
            const closed = buildClosedPath(arc, 0.001).toJSON();
            assert.equal(closed.closed, true);
            assert.equal(closed.points.length, 3);
            for (let i = 0; i < 3; i++) assertNear(closed.points[i], chain.points[i]);
        }
    });

    it('両端の距離が許容距離以内の小さな弧は buildClosedPath・planJoin とも null', () => {
        const tiny = new Ellipse(100, 200, 102, 201, 'arc');
        assert.equal(buildClosedPath(tiny, 5), null);
        assert.equal(planJoin([tiny], 5), null);
        assert.notEqual(planJoin([tiny], 0.5), null);
    });

    it('閉じたパス・矩形・円は null', () => {
        for (const shape of [makePath([[0, 0], [50, 0], [50, 50]], true), new Rect(0, 0, 100, 100), new Ellipse(0, 0, 100, 100, 'circle')]) {
            assert.equal(classifyJoin([shape]), null);
            assert.equal(planJoin([shape], 5), null);
            assert.equal(buildClosedPath(shape, 5), null);
        }
    });

    it('planJoin が null でないとき classifyJoin も null でない（多数の図形・許容距離）', () => {
        const shapes = [
            new Line(0, 0, 10, 0), new Curve(0, 0, 100, 100), makeArc(), new Ellipse(100, 200, 102, 201, 'arc'),
            new Rect(0, 0, 10, 10), new Ellipse(0, 0, 10, 10, 'circle'),
            makePath([[0, 0], [10, 0]]), makePath([[0, 0], [50, 50], [2, 1]]), makePath([[0, 0], [50, 50], [100, 0]]),
            makePath([[0, 0], [50, 50], [100, 0], [1, 1]]), makePath([[0, 0], [50, 0], [50, 50]], true)
        ];
        for (const tolerance of [0, 0.5, 5, 1000]) {
            for (const shape of shapes) {
                if (planJoin([shape], tolerance) !== null) assert.notEqual(classifyJoin([shape]), null);
            }
        }
    });

    it('2本の結合は今のまま（直線2本・弧と直線）', () => {
        const a = withId(new Line(0, 0, 10, 0), 'A');
        const b = withId(new Line(10, 0, 20, 0), 'B');
        const plan = planJoin([a, b], 0);
        assert.equal(plan.keepId, false);
        assert.deepEqual(plan.removeIds, ['B']);
        assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [20, 0]]);
        const arcPlan = planJoin([withId(makeArc(), 'R'), withId(new Line(160, 200, 200, 200), 'L')], 0);
        assert.deepEqual(arcPlan.path.toJSON().segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
        assert.deepEqual(coordsOf(buildJoinedPath(new Line(0, 0, 10, 0), new Line(10, 0, 20, 0), 0).toJSON().points), [[0, 0], [10, 0], [20, 0]]);
    });
});

describe('planDrawnLineJoin：同じ弧の両端の間を途中の点なしで引く', () => {
    it('直線のツール＝閉じる区間 line', () => {
        const arc = withId(makeArc(), 'A');
        const plan = planDrawnLineJoin([arc], new Line(40, 200, 160, 200), ref('A', 'start'), ref('A', 'end'), 1);
        assert.equal(plan.keepId, true);
        assert.equal(plan.targetId, 'A');
        assert.deepEqual(plan.path.toJSON().segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
        assert.equal(plan.path.toJSON().closed, true);
    });

    it('曲線のツール（smooth のパス）＝閉じる区間 smooth', () => {
        const arc = withId(makeArc(), 'A');
        const drawn = new Path(pts([[40, 200], [160, 200]]), false, '#000000', 2, null, 'smooth');
        const plan = planDrawnLineJoin([arc], drawn, ref('A', 'end'), ref('A', 'start'), 1, drawn);
        assert.deepEqual(plan.path.toJSON().segments.map((s) => s.kind), ['bezier', 'bezier', 'smooth']);
    });

    it('途中の点ありは今のまま（閉じたパス）、同じ端点は null のまま', () => {
        const arc = withId(makeArc(), 'A');
        const drawn = new Path(pts([[40, 200], [100, 260], [160, 200]]), false, '#000000', 2, null, 'line');
        assert.equal(planDrawnLineJoin([arc], drawn, ref('A', 'start'), ref('A', 'end'), 1).path.toJSON().closed, true);
        assert.equal(planDrawnLineJoin([arc], new Line(40, 200, 40, 200), ref('A', 'start'), ref('A', 'start'), 1), null);
    });
});
