/**
 * 責務: パスの点の角の規則（PathCornerRules）の状態の判定・チェックボックスの表示内容・切り替えの計画を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    CornerState,
    resolveCornerState,
    resolveCornerToggleView,
    planCornerToggle,
} from '../../js/shapes/PathCornerRules.js';
import { planJoin } from '../../js/shapes/PathJoinRules.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 頂点の並びを作る。
 * @param {number} count - 頂点数
 * @returns {{x: number, y: number}[]} 頂点の並び
 */
function makePoints(count) {
    return Array.from({ length: count }, (_, i) => ({ x: i * 10, y: (i % 2) * 7 }));
}

/**
 * idを付けたパスを作る。
 * @param {string} id - 図形のid
 * @param {number} count - 頂点数
 * @param {boolean} closed - 閉じているか
 * @param {string|string[]} kinds - 区間の種類
 * @param {boolean[]} [corners] - 角の点
 * @returns {Path} パス
 */
function makePath(id, count, closed, kinds, corners = []) {
    const path = new Path(makePoints(count), closed, '#123456', 3, '#abcdef', kinds, corners);
    path.id = id;
    return path;
}

/**
 * 全区間が曲線の開いたパス（5点）を作る。
 * @param {string} id - 図形のid
 * @param {boolean[]} [corners] - 角の点
 * @returns {Path} パス
 */
function smoothOpen(id, corners = []) {
    return makePath(id, 5, false, SEGMENT_KIND_SMOOTH, corners);
}

describe('PathCornerRules resolveCornerState', () => {
    it('開いた全曲線の途中の点はSMOOTH、角にした点はCORNER', () => {
        const path = smoothOpen('a', [false, false, true, false, false]);
        assert.equal(resolveCornerState(path, 1), CornerState.SMOOTH);
        assert.equal(resolveCornerState(path, 2), CornerState.CORNER);
        assert.equal(resolveCornerState(path, 3), CornerState.SMOOTH);
    });

    it('開いたパスの端の点はNONE', () => {
        const path = smoothOpen('a', [true, false, false, false, true]);
        assert.equal(resolveCornerState(path, 0), CornerState.NONE);
        assert.equal(resolveCornerState(path, 4), CornerState.NONE);
    });

    it('直線と曲線の境目・全直線の途中の点はLINE_CORNER', () => {
        const mixed = makePath('m', 4, false, [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH]);
        assert.equal(resolveCornerState(mixed, 1), CornerState.LINE_CORNER);
        assert.equal(resolveCornerState(mixed, 2), CornerState.LINE_CORNER);
        const lines = makePath('l', 4, false, SEGMENT_KIND_LINE);
        assert.equal(resolveCornerState(lines, 1), CornerState.LINE_CORNER);
    });

    it('閉じたパスは始点と最後の点も判定できる', () => {
        const closed = makePath('c', 4, true, SEGMENT_KIND_SMOOTH, [true, false, false, false]);
        assert.equal(resolveCornerState(closed, 0), CornerState.CORNER);
        assert.equal(resolveCornerState(closed, 3), CornerState.SMOOTH);
        const closedMixed = makePath('d', 4, true, [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_LINE]);
        assert.equal(resolveCornerState(closedMixed, 0), CornerState.LINE_CORNER);
        assert.equal(resolveCornerState(closedMixed, 3), CornerState.LINE_CORNER);
        assert.equal(resolveCornerState(closedMixed, 1), CornerState.SMOOTH);
    });

    it('範囲外・整数でない番号はNONE', () => {
        const path = smoothOpen('a');
        assert.equal(resolveCornerState(path, -1), CornerState.NONE);
        assert.equal(resolveCornerState(path, 5), CornerState.NONE);
        assert.equal(resolveCornerState(path, 1.5), CornerState.NONE);
        assert.equal(resolveCornerState(path, NaN), CornerState.NONE);
        assert.equal(resolveCornerState(path, '1'), CornerState.NONE);
    });

    it('パス以外の図形はNONE', () => {
        for (const shape of [
            new Line(0, 0, 10, 10),
            new Rect(0, 0, 10, 10),
            new Curve(0, 0, 10, 10),
            new Ellipse(0, 0, 10, 10),
        ]) {
            for (let i = 0; i < 5; i++) {
                assert.equal(resolveCornerState(shape, i), CornerState.NONE);
            }
        }
    });
});

describe('PathCornerRules resolveCornerToggleView', () => {
    it('0件・NONEだけは押せずチェックなし', () => {
        assert.deepEqual(resolveCornerToggleView([]), { enabled: false, checked: false, mixed: false });
        const targets = [
            { shape: new Rect(0, 0, 10, 10), vertexIndex: 0 },
            { shape: smoothOpen('a'), vertexIndex: 0 },
        ];
        assert.deepEqual(resolveCornerToggleView(targets), { enabled: false, checked: false, mixed: false });
    });

    it('LINE_CORNERを含み操作できる点が無いと押せずチェックあり', () => {
        const lines = makePath('l', 4, false, SEGMENT_KIND_LINE);
        const targets = [
            { shape: lines, vertexIndex: 1 },
            { shape: smoothOpen('a'), vertexIndex: 0 },
        ];
        assert.deepEqual(resolveCornerToggleView(targets), { enabled: false, checked: true, mixed: false });
    });

    it('すべてなめらかならチェックなし、すべて角ならチェックあり', () => {
        const path = smoothOpen('a', [false, true, true, false, false]);
        assert.deepEqual(
            resolveCornerToggleView([{ shape: path, vertexIndex: 3 }, { shape: path, vertexIndex: 0 }]),
            { enabled: true, checked: false, mixed: false },
        );
        assert.deepEqual(
            resolveCornerToggleView([{ shape: path, vertexIndex: 1 }, { shape: path, vertexIndex: 2 }]),
            { enabled: true, checked: true, mixed: false },
        );
    });

    it('混ざっているとmixed（チェックなし）', () => {
        const path = smoothOpen('a', [false, true, false, false, false]);
        assert.deepEqual(
            resolveCornerToggleView([{ shape: path, vertexIndex: 1 }, { shape: path, vertexIndex: 2 }]),
            { enabled: true, checked: false, mixed: true },
        );
    });

    it('操作できない点が混ざっても操作できる点だけで決まる', () => {
        const path = smoothOpen('a', [false, true, false, false, false]);
        const lines = makePath('l', 4, false, SEGMENT_KIND_LINE);
        const targets = [
            { shape: path, vertexIndex: 1 },
            { shape: path, vertexIndex: 0 },
            { shape: lines, vertexIndex: 1 },
            { shape: new Line(0, 0, 5, 5), vertexIndex: 0 },
        ];
        assert.deepEqual(resolveCornerToggleView(targets), { enabled: true, checked: true, mixed: false });
    });
});

describe('PathCornerRules planCornerToggle', () => {
    it('すべてなめらか→すべて角、混ざり→すべて角、すべて角→すべてなめらか', () => {
        const smooth = smoothOpen('a');
        const planA = planCornerToggle([{ shape: smooth, vertexIndex: 1 }, { shape: smooth, vertexIndex: 2 }]);
        assert.equal(planA.length, 1);
        assert.deepEqual(planA[0].path.corners, [false, true, true, false, false]);

        const mixed = smoothOpen('b', [false, true, false, false, false]);
        const planB = planCornerToggle([{ shape: mixed, vertexIndex: 1 }, { shape: mixed, vertexIndex: 2 }]);
        assert.deepEqual(planB[0].path.corners, [false, true, true, false, false]);

        const corner = smoothOpen('c', [false, true, true, false, false]);
        const planC = planCornerToggle([{ shape: corner, vertexIndex: 1 }, { shape: corner, vertexIndex: 2 }]);
        assert.deepEqual(planC[0].path.corners, [false, false, false, false, false]);
    });

    it('操作できない点は変えない', () => {
        const mixedKinds = makePath('m', 5, false, [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH], [false, false, true, false, false]);
        const plan = planCornerToggle([
            { shape: mixedKinds, vertexIndex: 0 },
            { shape: mixedKinds, vertexIndex: 1 },
            { shape: mixedKinds, vertexIndex: 2 },
            { shape: mixedKinds, vertexIndex: 3 },
        ]);
        assert.equal(plan.length, 1);
        assert.deepEqual(plan[0].path.corners, [false, true, true, false, false]);
    });

    it('複数の図形は最初に現れた順で、それぞれ計画に入る', () => {
        const a = smoothOpen('a');
        const b = smoothOpen('b');
        const plan = planCornerToggle([
            { shape: b, vertexIndex: 2 },
            { shape: a, vertexIndex: 1 },
            { shape: b, vertexIndex: 3 },
        ]);
        assert.deepEqual(plan.map((p) => p.targetId), ['b', 'a']);
        assert.deepEqual(plan[0].path.corners, [false, false, true, true, false]);
        assert.deepEqual(plan[1].path.corners, [false, true, false, false, false]);
    });

    it('変わらないとき・操作できる点が無いときは空配列', () => {
        assert.deepEqual(planCornerToggle([]), []);
        assert.deepEqual(planCornerToggle([{ shape: smoothOpen('a'), vertexIndex: 0 }]), []);
        assert.deepEqual(planCornerToggle([{ shape: new Rect(0, 0, 5, 5), vertexIndex: 1 }]), []);
        assert.deepEqual(planCornerToggle([{ shape: makePath('l', 4, false, SEGMENT_KIND_LINE), vertexIndex: 1 }]), []);
    });

    it('同じ点が2回あっても結果は同じ', () => {
        const path = smoothOpen('a');
        const once = planCornerToggle([{ shape: path, vertexIndex: 2 }]);
        const twice = planCornerToggle([{ shape: path, vertexIndex: 2 }, { shape: path, vertexIndex: 2 }]);
        assert.deepEqual(twice.map((p) => p.path.toJSON()), once.map((p) => p.path.toJSON()));
        assert.deepEqual(twice.map((p) => p.targetId), once.map((p) => p.targetId));
    });

    it('結果のパスは頂点・閉じているか・区間の種類・スタイルが元のままでidはnull、targetIdは元のid', () => {
        const closed = makePath('c', 4, true, [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_LINE]);
        const plan = planCornerToggle([{ shape: closed, vertexIndex: 1 }]);
        assert.equal(plan.length, 1);
        const { path, targetId } = plan[0];
        assert.equal(targetId, 'c');
        assert.equal(path.id, null);
        assert.equal(path.closed, true);
        assert.deepEqual(path.points, closed.points);
        assert.deepEqual(path.segments, closed.segments);
        assert.equal(path.strokeColor, '#123456');
        assert.equal(path.strokeWidth, 3);
        assert.equal(path.fillColor, '#abcdef');
        assert.deepEqual(path.corners, [false, true, false, false]);
    });

    it('閉じたパスの始点も切り替えられる', () => {
        const closed = makePath('c', 4, true, SEGMENT_KIND_SMOOTH);
        const plan = planCornerToggle([{ shape: closed, vertexIndex: 0 }]);
        assert.deepEqual(plan[0].path.corners, [true, false, false, false]);
    });

    it('引数の図形を書き換えず、結果は引数と頂点を共有しない', () => {
        const path = smoothOpen('a');
        const before = JSON.stringify(path.toJSON());
        const plan = planCornerToggle([{ shape: path, vertexIndex: 1 }]);
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.notEqual(plan[0].path, path);
        assert.notEqual(plan[0].path.points, path.points);
        assert.notEqual(plan[0].path.points[0], path.points[0]);
        assert.notEqual(plan[0].path.segments, path.segments);
        plan[0].path.points[0].x = 999;
        assert.notEqual(path.points[0].x, 999);
    });
});

/**
 * 曲がり方を持つ区間の指定を作る。
 * @param {number} x1 - 始点側の引っ張る点のx
 * @param {number} y1 - 始点側の引っ張る点のy
 * @param {number} x2 - 終点側の引っ張る点のx
 * @param {number} y2 - 終点側の引っ張る点のy
 * @returns {{kind: string, control1: {x: number, y: number}, control2: {x: number, y: number}}} 区間の指定
 */
function bezSpec(x1, y1, x2, y2) {
    return { kind: 'bezier', control1: { x: x1, y: y1 }, control2: { x: x2, y: y2 } };
}

describe('PathCornerRules と曲がり方を持つ区間（Phase 09-03a）', () => {
    /**
     * 点0〜4の開いたパス。区間は [なめらか, なめらか, 曲がり方を持つ, 直線]。
     * @returns {Path} パス（idは'b'）
     */
    function makeBezierPath() {
        const pts = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 30 }, { x: 90, y: 30 }, { x: 120, y: 0 }];
        const path = new Path(pts, false, '#123456', 3, null,
            [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, bezSpec(70, 30, 80, 30), SEGMENT_KIND_LINE]);
        path.id = 'b';
        return path;
    }

    it('曲がり方を持つ区間に接する点は LINE_CORNER、両側とも打った点の曲線の区間の点は SMOOTH', () => {
        const path = makeBezierPath();
        assert.equal(resolveCornerState(path, 1), CornerState.SMOOTH);
        assert.equal(resolveCornerState(path, 2), CornerState.LINE_CORNER);
        assert.equal(resolveCornerState(path, 3), CornerState.LINE_CORNER);
    });

    it('曲がり方を持つ区間に接する点だけを選ぶと押せず、チェックありの見た目', () => {
        const path = makeBezierPath();
        assert.deepEqual(
            resolveCornerToggleView([{ shape: path, vertexIndex: 2 }]),
            { enabled: false, checked: true, mixed: false },
        );
    });

    it('ほかの点を切り替えても、曲がり方を持つ区間は引っ張る点ごと元のまま', () => {
        const path = makeBezierPath();
        const plan = planCornerToggle([{ shape: path, vertexIndex: 1 }]);
        assert.equal(plan.length, 1);
        assert.deepEqual(plan[0].path.corners, [false, true, false, false, false]);
        assert.deepEqual(plan[0].path.toJSON().segments, path.toJSON().segments);
        assert.deepEqual(plan[0].path.toJSON().segments[2], bezSpec(70, 30, 80, 30));
    });
});

describe('PathCornerRules と弧の結合（Phase 09-03b）', () => {
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

    it('頂上（番号1）・弧の右端だった点（番号2）は LINE_CORNER', () => {
        const path = makeJoinedArcPath();
        assert.equal(resolveCornerState(path, 1), CornerState.LINE_CORNER);
        assert.equal(resolveCornerState(path, 2), CornerState.LINE_CORNER);
    });

    it('頂上・弧の右端だった点を選ぶと、押せず、チェックありの見た目', () => {
        const path = makeJoinedArcPath();
        const view = { enabled: false, checked: true, mixed: false };
        assert.deepEqual(resolveCornerToggleView([{ shape: path, vertexIndex: 1 }]), view);
        assert.deepEqual(resolveCornerToggleView([{ shape: path, vertexIndex: 2 }]), view);
        assert.deepEqual(
            resolveCornerToggleView([{ shape: path, vertexIndex: 1 }, { shape: path, vertexIndex: 2 }]),
            view,
        );
    });
});
