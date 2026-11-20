import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    SegmentKindSwitch,
    resolveSegmentSwitchAvailability,
    planSegmentKindSwitch,
} from '../../js/shapes/PathSegmentKindRules.js';
import { Path } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { planJoin } from '../../js/shapes/PathJoinRules.js';

const EPS = 1e-9;

/**
 * 座標の配列から頂点の並びを作る。
 * @param {number[][]} coords - [x, y] の並び
 * @returns {{x: number, y: number}[]} 頂点の並び
 */
function pts(coords) {
    return coords.map(([x, y]) => ({ x, y }));
}

/**
 * パスを作る（idは'p1'）。
 * @param {number[][]} coords - [x, y] の並び
 * @param {boolean} closed - 閉じたパスか
 * @param {string[]} kinds - 区間の種類
 * @param {boolean[]} [corners] - 角の情報
 * @param {string|null} [fill] - 塗りの色
 * @returns {Path} パス
 */
function makePath(coords, closed, kinds, corners = [], fill = null) {
    const path = new Path(pts(coords), closed, '#112233', 3, fill, kinds, corners);
    path.id = 'p1';
    return path;
}

/**
 * 今の曲線を作る（制御点を指定する）。
 * @param {number[]} start - 始点 [x, y]
 * @param {number[]} control - 制御点 [x, y]
 * @param {number[]} end - 終点 [x, y]
 * @param {string} [color] - 線の色
 * @param {number} [width] - 線の太さ
 * @returns {Curve} 今の曲線
 */
function makeCurve(start, control, end, color = '#000000', width = 2) {
    const curve = new Curve(start[0], start[1], end[0], end[1], color, width);
    curve.setVertex(1, control[0], control[1]);
    return curve;
}

/**
 * 選んだ点の並びを作る。
 * @param {Object} shape - 図形
 * @param {number[]} indexes - 頂点の番号
 * @returns {{shape: Object, vertexIndex: number}[]} 選んだ点
 */
function pick(shape, indexes) {
    return indexes.map((vertexIndex) => ({ shape, vertexIndex }));
}

/**
 * 値が近いことを確かめる。
 * @param {number} actual - 実際の値
 * @param {number} expected - 期待値
 */
function near(actual, expected) {
    assert.ok(Math.abs(actual - expected) <= EPS, `${actual} != ${expected}`);
}

/**
 * 区間の制御点が両端の1/3・2/3の位置にあるか確かめる。
 * @param {Object} seg - 描画要素の区間
 * @param {{x: number, y: number}} a - 始点
 * @param {{x: number, y: number}} b - 終点
 */
function assertThirds(seg, a, b) {
    assert.equal(seg.kind, 'cubic');
    near(seg.control1.x, a.x + (b.x - a.x) / 3);
    near(seg.control1.y, a.y + (b.y - a.y) / 3);
    near(seg.control2.x, a.x + (2 * (b.x - a.x)) / 3);
    near(seg.control2.y, a.y + (2 * (b.y - a.y)) / 3);
}

/**
 * 2つの区間の制御点が同じか確かめる。
 * @param {Object} actual - 描画要素の区間
 * @param {Object} expected - 描画要素の区間
 */
function assertSameControls(actual, expected) {
    assert.equal(actual.kind, 'cubic');
    near(actual.control1.x, expected.control1.x);
    near(actual.control1.y, expected.control1.y);
    near(actual.control2.x, expected.control2.x);
    near(actual.control2.y, expected.control2.y);
}

const STRAIGHT3 = [[0, 0], [30, 0], [60, 30]];

describe('SegmentKindSwitch', () => {
    it('値を持ち凍結されている', () => {
        assert.equal(SegmentKindSwitch.TO_LINE, 'toLine');
        assert.equal(SegmentKindSwitch.TO_CURVE, 'toCurve');
        assert.ok(Object.isFrozen(SegmentKindSwitch));
    });

    it('未知の操作は targets が空でも Error', () => {
        assert.throws(() => planSegmentKindSwitch([], 'x'), Error);
        assert.throws(() => planSegmentKindSwitch([], undefined), Error);
    });
});

describe('resolveSegmentSwitchAvailability', () => {
    it('0件・1点だけは両方 false', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        assert.deepEqual(resolveSegmentSwitchAvailability([]), { toLine: false, toCurve: false });
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [1])), { toLine: false, toCurve: false });
    });

    it('直線のパスの隣り合う2点は toCurve だけ', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [0, 1])), { toLine: false, toCurve: true });
    });

    it('曲線のパスの隣り合う2点は toLine だけ', () => {
        const p = makePath(STRAIGHT3, false, ['smooth', 'smooth']);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [0, 1])), { toLine: true, toCurve: false });
    });

    it('直線と曲線の区間をまたぐ3点は両方 true', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'smooth']);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [0, 1, 2])), { toLine: true, toCurve: true });
    });

    it('並んでいない点は両端が選ばれた区間だけが対象', () => {
        const p = makePath([[0, 0], [10, 0], [20, 0], [30, 0]], false, ['smooth', 'line', 'line']);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [0, 1, 3])), { toLine: true, toCurve: false });
    });

    it('閉じたパスの終点と始点は終点→始点の区間が対象', () => {
        const p = makePath([[0, 0], [30, 0], [30, 30]], true, ['smooth', 'smooth', 'line']);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [2, 0])), { toLine: false, toCurve: true });
    });

    it('開いたパスの始点と終点だけは区間にならない', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [0, 2])), { toLine: false, toCurve: false });
    });

    it('単独の直線は始点と終点で toCurve だけ、片方だけは両方 false', () => {
        const line = new Line(0, 0, 30, 0);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(line, [0, 1])), { toLine: false, toCurve: true });
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(line, [0])), { toLine: false, toCurve: false });
    });

    it('今の曲線は始点と終点で toLine だけ（制御点の有無は問わない）、始点と制御点だけは両方 false', () => {
        const curve = makeCurve([0, 0], [30, 30], [60, 0]);
        const only = resolveSegmentSwitchAvailability(pick(curve, [0, 2]));
        assert.deepEqual(only, { toLine: true, toCurve: false });
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(curve, [0, 1, 2])), only);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(curve, [0, 1])), { toLine: false, toCurve: false });
    });

    it('矩形・円は両方 false', () => {
        const rect = new Rect(0, 0, 30, 30);
        const ellipse = new Ellipse(0, 0, 30, 30);
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(rect, [0, 1, 2, 3])), { toLine: false, toCurve: false });
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(ellipse, [0, 1])), { toLine: false, toCurve: false });
    });

    it('複数の図形はそれぞれの結果の「または」', () => {
        const a = makePath(STRAIGHT3, false, ['line', 'line']);
        const b = makePath(STRAIGHT3, false, ['smooth', 'smooth']);
        assert.deepEqual(
            resolveSegmentSwitchAvailability([...pick(a, [0, 1]), ...pick(b, [0, 1])]),
            { toLine: true, toCurve: true },
        );
    });
});

describe('planSegmentKindSwitch TO_CURVE', () => {
    it('直線のパス（開いた・頂点3つ）の区間0に中点が足される', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        const plan = planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_CURVE);
        assert.equal(plan.length, 1);
        assert.equal(plan[0].targetId, 'p1');
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 4);
        assert.deepEqual(data.points[1], { x: 15, y: 0 });
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'smooth', 'line']);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 2, 3]);
        assert.equal('corners' in data, false);
        assert.equal(plan[0].shape.id, null);
    });

    it('同じパスの3点すべてで途中の元の点が角の点・足した点がなめらか', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        const plan = planSegmentKindSwitch(pick(p, [0, 1, 2]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 5);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 2, 4]);
        assert.deepEqual(data.corners, [false, false, true, false, false]);
    });

    it('反対側が既に曲線の区間の端の点が角の点になる', () => {
        const p = makePath(STRAIGHT3, false, ['smooth', 'line']);
        const plan = planSegmentKindSwitch(pick(p, [1, 2]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'smooth', 'smooth']);
        assert.equal(data.corners[1], true);
        assert.equal(data.corners[2], false);
        assert.equal(data.corners[3], false);
    });

    it('切り替えに関係しない角の点の角の情報は変わらない', () => {
        const coords = [[0, 0], [30, 0], [60, 0], [90, 0], [120, 0]];
        const p = makePath(coords, false, ['smooth', 'smooth', 'line', 'line'], [false, false, true, false, false]);
        const plan = planSegmentKindSwitch(pick(p, [3, 4]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 6);
        assert.equal(data.corners[2], true);
    });

    it('閉じたパスの終点→始点の区間は足した点が末尾・閉じたまま・塗りが残る', () => {
        const p = makePath([[0, 0], [30, 0], [30, 30], [0, 30]], true, ['line', 'line', 'line', 'line'], [], '#ff0000');
        const plan = planSegmentKindSwitch(pick(p, [3, 0]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 5);
        assert.deepEqual(data.points[4], { x: 0, y: 15 });
        assert.deepEqual(plan[0].vertexIndexMap, [0, 1, 2, 3]);
        assert.equal(data.closed, true);
        assert.equal(data.fillColor, '#ff0000');
        assert.deepEqual(data.segments.map((s) => s.kind), ['line', 'line', 'line', 'smooth', 'smooth']);
    });

    it('閉じたパスの全点ですべての区間に点が足され元の点がすべて角の点', () => {
        const p = makePath([[0, 0], [30, 0], [30, 30], [0, 30]], true, ['line', 'line', 'line', 'line']);
        const plan = planSegmentKindSwitch(pick(p, [0, 1, 2, 3]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 8);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 2, 4, 6]);
        for (const i of plan[0].vertexIndexMap) assert.equal(data.corners[i], true);
        assert.equal(data.corners[1], false);
        assert.equal(data.corners[7], false);
    });

    it('既に曲線の区間だけなら空配列、曲線と直線の区間では直線の区間だけが変わる', () => {
        const p = makePath(STRAIGHT3, false, ['smooth', 'smooth']);
        assert.deepEqual(planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_CURVE), []);
        const q = makePath(STRAIGHT3, false, ['smooth', 'line']);
        const plan = planSegmentKindSwitch(pick(q, [0, 1, 2]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'smooth', 'smooth']);
        assert.equal(data.corners[0], false);
    });

    it('押した直後の形が変わらない（開いたパス）', () => {
        const p = makePath([[0, 0], [30, 0], [60, 30], [90, 30]], false, ['line', 'line', 'line']);
        const el = planSegmentKindSwitch(pick(p, [1, 2]), SegmentKindSwitch.TO_CURVE)[0].shape.toDrawElement();
        assert.equal(el.segments[0].kind, 'line');
        assertThirds(el.segments[1], { x: 30, y: 0 }, { x: 45, y: 15 });
        assertThirds(el.segments[2], { x: 45, y: 15 }, { x: 60, y: 30 });
        assert.equal(el.segments[3].kind, 'line');
    });

    it('押した直後の形が変わらない（閉じたパス・3つ以上続けて選んだ場合）', () => {
        const p = makePath([[0, 0], [30, 0], [30, 30], [0, 30]], true, ['line', 'line', 'line', 'line']);
        const shape = planSegmentKindSwitch(pick(p, [3, 0, 1]), SegmentKindSwitch.TO_CURVE)[0].shape;
        const data = shape.toJSON();
        const el = shape.toDrawElement();
        assert.equal(data.points.length, 6);
        // 新しい並び: (0,0) (15,0) (30,0) (30,30) (0,30) (0,15)
        assert.deepEqual(data.points[1], { x: 15, y: 0 });
        assert.deepEqual(data.points[5], { x: 0, y: 15 });
        assertThirds(el.segments[0], { x: 0, y: 0 }, { x: 15, y: 0 });
        assertThirds(el.segments[1], { x: 15, y: 0 }, { x: 30, y: 0 });
        assert.equal(el.segments[2].kind, 'line');
        assert.equal(el.segments[3].kind, 'line');
        assertThirds(el.segments[4], { x: 0, y: 30 }, { x: 0, y: 15 });
        assertThirds(el.segments[5], { x: 0, y: 15 }, { x: 0, y: 0 });
    });

    it('既に曲線の区間と隣り合っても隣の曲線の区間の制御点が変わらない', () => {
        const p = makePath([[0, 0], [30, 0], [60, 30]], false, ['line', 'smooth']);
        const before = p.toDrawElement().segments[1];
        const el = planSegmentKindSwitch(pick(p, [0, 1, 2]), SegmentKindSwitch.TO_CURVE)[0].shape.toDrawElement();
        assertThirds(el.segments[0], { x: 0, y: 0 }, { x: 15, y: 0 });
        assertThirds(el.segments[1], { x: 15, y: 0 }, { x: 30, y: 0 });
        assertSameControls(el.segments[2], before);
    });

    it('反対側が曲線の区間の端の点で、両側の隣の曲線の区間の制御点が変わらない', () => {
        const p = makePath([[0, 0], [30, 0], [60, 30], [90, 60]], false, ['smooth', 'line', 'smooth']);
        const before = p.toDrawElement().segments;
        const el = planSegmentKindSwitch(pick(p, [1, 2]), SegmentKindSwitch.TO_CURVE)[0].shape.toDrawElement();
        assertSameControls(el.segments[0], before[0]);
        assertThirds(el.segments[1], { x: 30, y: 0 }, { x: 45, y: 15 });
        assertThirds(el.segments[2], { x: 45, y: 15 }, { x: 60, y: 30 });
        assertSameControls(el.segments[3], before[2]);
    });

    it('閉じたパスで番号0をまたいで隣り合う曲線の区間の制御点が変わらない', () => {
        const p = makePath([[0, 0], [30, 0], [30, 30], [0, 30]], true, ['smooth', 'line', 'line', 'line']);
        const before = p.toDrawElement().segments[0];
        const shape = planSegmentKindSwitch(pick(p, [3, 0]), SegmentKindSwitch.TO_CURVE)[0].shape;
        const data = shape.toJSON();
        const el = shape.toDrawElement();
        assert.equal(data.closed, true);
        assert.deepEqual(data.points[4], { x: 0, y: 15 });
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'line', 'line', 'smooth', 'smooth']);
        assertSameControls(el.segments[0], before);
        assertThirds(el.segments[3], { x: 0, y: 30 }, { x: 0, y: 15 });
        assertThirds(el.segments[4], { x: 0, y: 15 }, { x: 0, y: 0 });
    });

    it('単独の直線は点3つの開いたパスになる', () => {
        const line = new Line(0, 0, 60, 30, '#abcdef', 5, '#123456');
        line.id = 'L1';
        const plan = planSegmentKindSwitch(pick(line, [0, 1]), SegmentKindSwitch.TO_CURVE);
        const shape = plan[0].shape;
        const data = shape.toJSON();
        assert.equal(data.type, 'path');
        assert.equal(data.closed, false);
        assert.deepEqual(data.points, [{ x: 0, y: 0 }, { x: 30, y: 15 }, { x: 60, y: 30 }]);
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'smooth']);
        assert.equal('corners' in data, false);
        assert.equal(data.strokeColor, '#abcdef');
        assert.equal(data.strokeWidth, 5);
        assert.equal(data.fillColor, '#123456');
        assert.equal(shape.id, null);
        assert.equal(plan[0].targetId, 'L1');
        assert.deepEqual(plan[0].vertexIndexMap, [0, 2]);
        const el = shape.toDrawElement();
        assertThirds(el.segments[0], { x: 0, y: 0 }, { x: 30, y: 15 });
        assertThirds(el.segments[1], { x: 30, y: 15 }, { x: 60, y: 30 });
    });

    it('今の曲線の「曲線に」・単独の直線の「直線に」は空配列', () => {
        const curve = makeCurve([0, 0], [30, 30], [60, 0]);
        assert.deepEqual(planSegmentKindSwitch(pick(curve, [0, 2]), SegmentKindSwitch.TO_CURVE), []);
        const line = new Line(0, 0, 60, 30);
        assert.deepEqual(planSegmentKindSwitch(pick(line, [0, 1]), SegmentKindSwitch.TO_LINE), []);
    });
});

describe('planSegmentKindSwitch TO_LINE', () => {
    it('曲線のパスの区間は点の数が変わらず、その区間だけ line・角の情報と対応は元のまま', () => {
        const p = makePath(
            [[0, 0], [30, 0], [60, 30], [90, 30]],
            false,
            ['smooth', 'smooth', 'smooth'],
            [false, true, false, false],
        );
        const plan = planSegmentKindSwitch(pick(p, [1, 2]), SegmentKindSwitch.TO_LINE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 4);
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'line', 'smooth']);
        assert.deepEqual(data.corners, [false, true, false, false]);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 1, 2, 3]);
    });

    it('既に直線の区間だけは空配列', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        assert.deepEqual(planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_LINE), []);
    });

    it('閉じた曲線のパスの終点→始点の区間は閉じたまま塗りが残る', () => {
        const p = makePath([[0, 0], [30, 0], [30, 30]], true, ['smooth', 'smooth', 'smooth'], [], '#00ff00');
        const data = planSegmentKindSwitch(pick(p, [2, 0]), SegmentKindSwitch.TO_LINE)[0].shape.toJSON();
        assert.equal(data.closed, true);
        assert.equal(data.fillColor, '#00ff00');
        assert.deepEqual(data.segments.map((s) => s.kind), ['smooth', 'smooth', 'line']);
    });

    it('今の曲線は line になり [始点, 終点]・スタイルが元のまま', () => {
        const curve = makeCurve([0, 0], [30, 30], [60, 0], '#aa0000', 4);
        curve.id = 'c1';
        const plan = planSegmentKindSwitch(pick(curve, [0, 1, 2]), SegmentKindSwitch.TO_LINE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.type, 'line');
        assert.deepEqual(data.points, [{ x: 0, y: 0 }, { x: 60, y: 0 }]);
        assert.equal(data.strokeColor, '#aa0000');
        assert.equal(data.strokeWidth, 4);
        assert.equal(plan[0].shape.id, null);
        assert.equal(plan[0].targetId, 'c1');
        assert.deepEqual(plan[0].vertexIndexMap, [0, null, 1]);
    });
});

describe('planSegmentKindSwitch 共通', () => {
    it('複数の図形は最初に現れた順の計画', () => {
        const a = makePath(STRAIGHT3, false, ['line', 'line']);
        a.id = 'a';
        const b = makePath(STRAIGHT3, false, ['line', 'line']);
        b.id = 'b';
        const plan = planSegmentKindSwitch([...pick(b, [0, 1]), ...pick(a, [0, 1])], SegmentKindSwitch.TO_CURVE);
        assert.deepEqual(plan.map((item) => item.targetId), ['b', 'a']);
    });

    it('同じ点が2回でも同じ結果', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        const once = planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_CURVE);
        const twice = planSegmentKindSwitch(pick(p, [0, 1, 0, 1]), SegmentKindSwitch.TO_CURVE);
        assert.deepEqual(twice[0].shape.toJSON(), once[0].shape.toJSON());
        assert.deepEqual(twice[0].vertexIndexMap, once[0].vertexIndexMap);
    });

    it('引数の図形の toJSON() が変わらず、結果と頂点を共有しない', () => {
        const p = makePath(STRAIGHT3, false, ['line', 'line']);
        const before = JSON.stringify(p.toJSON());
        const plan = planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_CURVE);
        plan[0].shape.points[0].x = 999;
        assert.equal(JSON.stringify(p.toJSON()), before);
        const q = makePath(STRAIGHT3, false, ['smooth', 'smooth']);
        const planLine = planSegmentKindSwitch(pick(q, [0, 1]), SegmentKindSwitch.TO_LINE);
        planLine[0].shape.points[0].x = 999;
        assert.equal(q.points[0].x, 0);
    });
});

describe('PathSegmentKindRules と曲がり方を持つ区間（Phase 09-03a）', () => {
    const COORDS = [[0, 0], [30, 0], [60, 30], [90, 30]];
    const BEZ = { kind: 'bezier', control1: { x: 40, y: 0 }, control2: { x: 50, y: 30 } };

    /**
     * 区間は [直線, 曲がり方を持つ区間, 直線]の開いたパスを作る。
     * @returns {Path} パス（idは'p1'）
     */
    function makeBezierPath() {
        return makePath(COORDS, false, ['line', BEZ, 'line']);
    }

    it('曲がり方を持つ区間の両端を選ぶと「直線に」だけ押せる', () => {
        const p = makeBezierPath();
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [1, 2])), { toLine: true, toCurve: false });
    });

    it('「直線に」で曲がり方を持つ区間が直線になり、点の数・corners は変わらない', () => {
        const p = makeBezierPath();
        const plan = planSegmentKindSwitch(pick(p, [1, 2]), SegmentKindSwitch.TO_LINE);
        assert.equal(plan.length, 1);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.segments[1], { kind: 'line' });
        assert.equal(data.points.length, 4);
        assert.deepEqual(plan[0].shape.corners, p.corners);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 1, 2, 3]);
    });

    it('「曲線に」は曲がり方を持つ区間だけを選んだとき空配列', () => {
        const p = makeBezierPath();
        assert.deepEqual(planSegmentKindSwitch(pick(p, [1, 2]), SegmentKindSwitch.TO_CURVE), []);
    });

    it('隣の直線の区間を「曲線に」しても、曲がり方を持つ区間の引っ張る点は変わらない', () => {
        const p = makePath(COORDS, false, ['line', BEZ, 'line'], [false, false, true, false]);
        const plan = planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_CURVE);
        const data = plan[0].shape.toJSON();
        assert.equal(data.points.length, 5);
        assert.deepEqual(data.segments[2], BEZ);
        const el = plan[0].shape.toDrawElement();
        assertThirds(el.segments[0], { x: 0, y: 0 }, { x: 15, y: 0 });
        assertThirds(el.segments[1], { x: 15, y: 0 }, { x: 30, y: 0 });
        assertSameControls(el.segments[2], p.toDrawElement().segments[1]);
        assert.deepEqual(plan[0].shape.corners, [false, false, false, true, false]);
    });

    it('別の打った点の曲線の区間を「直線に」しても、曲がり方を持つ区間が残る', () => {
        const p = makePath([[0, 0], [30, 0], [60, 30], [90, 30], [120, 0]], false, ['smooth', BEZ, 'line', 'line']);
        const plan = planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_LINE);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.segments[0], { kind: 'line' });
        assert.deepEqual(data.segments[1], BEZ);
    });
});

describe('PathSegmentKindRules と弧の結合（Phase 09-03b）', () => {
    /**
     * 弧（中心(100,200)・横の半径60・縦の半径30）と直線（右端→(200,200)）を結合したパスを作る。
     * 頂点は [左端, 頂上, 右端, (200,200)]、区間は [曲がり方を持つ, 曲がり方を持つ, 直線]。
     * @returns {Path} 結合したパス
     */
    function makeJoinedArcPath() {
        const arc = new Ellipse(100, 200, 160, 230, 'arc');
        arc.id = 'A';
        const line = new Line(160, 200, 200, 200);
        line.id = 'B';
        return planJoin([arc, line], 0).path;
    }

    it('左端と頂上を選ぶと「直線に」だけ押せる', () => {
        const p = makeJoinedArcPath();
        assert.deepEqual(resolveSegmentSwitchAvailability(pick(p, [0, 1])), { toLine: true, toCurve: false });
    });

    it('「直線に」で区間0だけが直線になり、区間1の曲がり方を持つ区間は引っ張る点ごと残る', () => {
        const p = makeJoinedArcPath();
        const before = p.toJSON().segments;
        assert.equal(before[0].kind, 'bezier');
        assert.equal(before[1].kind, 'bezier');
        const plan = planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_LINE);
        assert.equal(plan.length, 1);
        const data = plan[0].shape.toJSON();
        assert.deepEqual(data.segments[0], { kind: 'line' });
        assert.deepEqual(data.segments[1], before[1]);
        assert.deepEqual(data.segments[2], before[2]);
        assert.equal(data.points.length, 4);
    });

    it('「曲線に」では変わる区間が無く、空配列', () => {
        const p = makeJoinedArcPath();
        assert.deepEqual(planSegmentKindSwitch(pick(p, [0, 1]), SegmentKindSwitch.TO_CURVE), []);
    });
});
