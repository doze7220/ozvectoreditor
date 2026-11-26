/**
 * 責務: パスの頂点の追加・削除の規則（PathVertexRules）のうち、点を消した図形の組み立て（planVertexRemoval）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planVertexRemoval } from '../../js/shapes/PathVertexRules.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_BEZIER } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

const P = (x, y) => ({ x, y });
const bez = (c1, c2) => ({ kind: SEGMENT_KIND_BEZIER, control1: c1, control2: c2 });

/**
 * 点の指定を作る。
 * @param {Object} shape - 図形
 * @param {...number} indices - 頂点の番号
 * @returns {Array<{shape: Object, vertexIndex: number}>} 指定の並び
 */
function pick(shape, ...indices) {
    return indices.map((vertexIndex) => ({ shape, vertexIndex }));
}

/**
 * 開いたパス（5点・すべて直線）を作る。
 * @returns {Path} パス
 */
function openLine5() {
    const path = new Path([P(0, 0), P(10, 0), P(20, 0), P(30, 0), P(40, 0)], false, '#111111', 3, '#222222', SEGMENT_KIND_LINE, [false, true, false, true, false]);
    path.id = 'a';
    return path;
}

/**
 * 点と区間の種類と角を取り出す。
 * @param {Path} path - パス
 * @returns {Object} 要約
 */
function summary(path) {
    return { points: path.points, kinds: path.segments.map((s) => s.kind), corners: path.corners, closed: path.closed };
}

describe('planVertexRemoval: 開いたパス', () => {
    it('途中の点1つを消す（区間・角・スタイル・id）', () => {
        const path = openLine5();
        const plan = planVertexRemoval(pick(path, 2));
        assert.equal(plan.length, 1);
        assert.equal(plan[0].targetId, 'a');
        const result = plan[0].shape;
        assert.equal(result.id, null);
        assert.deepEqual(summary(result), {
            points: [P(0, 0), P(10, 0), P(30, 0), P(40, 0)],
            kinds: ['line', 'line', 'line'],
            corners: [false, true, true, false],
            closed: false,
        });
        assert.equal(result.strokeColor, '#111111');
        assert.equal(result.strokeWidth, 3);
        assert.equal(result.fillColor, '#222222');
    });

    it('続いた複数・離れた複数', () => {
        const path = openLine5();
        assert.deepEqual(summary(planVertexRemoval(pick(path, 1, 2))[0].shape).points, [P(0, 0), P(30, 0), P(40, 0)]);
        const apart = planVertexRemoval(pick(path, 1, 3))[0].shape;
        assert.deepEqual(summary(apart).points, [P(0, 0), P(20, 0), P(40, 0)]);
        assert.deepEqual(apart.segments.map((s) => s.kind), ['line', 'line']);
    });

    it('始点・終点・先頭や末尾から続いた複数', () => {
        const path = openLine5();
        assert.deepEqual(planVertexRemoval(pick(path, 0))[0].shape.points, [P(10, 0), P(20, 0), P(30, 0), P(40, 0)]);
        assert.deepEqual(planVertexRemoval(pick(path, 4))[0].shape.points, [P(0, 0), P(10, 0), P(20, 0), P(30, 0)]);
        const head = planVertexRemoval(pick(path, 0, 1))[0].shape;
        assert.deepEqual(head.points, [P(20, 0), P(30, 0), P(40, 0)]);
        assert.equal(head.segments.length, 2);
        const tail = planVertexRemoval(pick(path, 3, 4))[0].shape;
        assert.deepEqual(tail.points, [P(0, 0), P(10, 0), P(20, 0)]);
        assert.equal(tail.segments.length, 2);
    });

    it('残りが2点なら開いた線、1点以下なら図形ごと消える', () => {
        const path = openLine5();
        const two = planVertexRemoval(pick(path, 0, 1, 2))[0].shape;
        assert.deepEqual(two.points, [P(30, 0), P(40, 0)]);
        assert.equal(two.segments.length, 1);
        assert.equal(planVertexRemoval(pick(path, 0, 1, 2, 3))[0].shape, null);
        assert.equal(planVertexRemoval(pick(path, 0, 1, 2, 3, 4))[0].shape, null);
    });
});

describe('planVertexRemoval: つなぐ区間の種類', () => {
    /**
     * 点4つの開いたパスを区間の指定で作る。
     * @param {Array} segments - 区間3つ
     * @returns {Path} パス
     */
    function open4(segments) {
        const path = new Path([P(0, 0), P(10, 0), P(20, 0), P(30, 0)], false, '#000000', 2, null, segments);
        path.id = 'b';
        return path;
    }

    it('line+line→line', () => {
        const r = planVertexRemoval(pick(open4([{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]), 1))[0].shape;
        assert.deepEqual(r.segments, [{ kind: 'line' }, { kind: 'line' }]);
    });

    it('bezier+bezier→前のcontrol1と後のcontrol2のbezier、消さない区間はそのまま', () => {
        const path = open4([bez(P(1, 1), P(2, 2)), bez(P(3, 3), P(4, 4)), { kind: SEGMENT_KIND_LINE }]);
        const r = planVertexRemoval(pick(path, 1))[0].shape;
        assert.deepEqual(r.segments, [bez(P(1, 1), P(4, 4)), { kind: 'line' }]);
        assert.notEqual(r.segments[0].control1, path.segments[0].control1);
    });

    it('3つ続いたbezier→最初のcontrol1と最後のcontrol2（lineが混ざればsmooth）', () => {
        const path = new Path([P(0, 0), P(10, 0), P(20, 0), P(30, 0), P(40, 0)], false, '#000000', 2, null,
            [bez(P(1, 1), P(2, 2)), bez(P(3, 3), P(4, 4)), bez(P(5, 5), P(6, 6)), { kind: 'line' }]);
        const r = planVertexRemoval(pick(path, 1, 2, 3))[0].shape;
        assert.deepEqual(r.points, [P(0, 0), P(40, 0)]);
        assert.deepEqual(r.segments, [{ kind: SEGMENT_KIND_SMOOTH }]);
        const allBezier = planVertexRemoval(pick(path, 1, 2))[0].shape;
        assert.deepEqual(allBezier.points, [P(0, 0), P(30, 0), P(40, 0)]);
        assert.deepEqual(allBezier.segments, [bez(P(1, 1), P(6, 6)), { kind: 'line' }]);
    });

    it('smoothを含む→smooth、line+bezier→smooth', () => {
        const withSmooth = open4([{ kind: 'smooth' }, { kind: 'line' }, { kind: 'line' }]);
        assert.deepEqual(planVertexRemoval(pick(withSmooth, 1))[0].shape.segments[0], { kind: SEGMENT_KIND_SMOOTH });
        const mixed = open4([{ kind: 'line' }, bez(P(3, 3), P(4, 4)), { kind: 'line' }]);
        assert.deepEqual(planVertexRemoval(pick(mixed, 1))[0].shape.segments[0], { kind: SEGMENT_KIND_SMOOTH });
    });
});

describe('planVertexRemoval: 閉じたパス', () => {
    /**
     * 点5つの閉じたパスを作る。
     * @param {Array|string} [segments] - 区間5つ（文字列なら全区間の種類）
     * @returns {Path} パス
     */
    function closed5(segments = 'line') {
        const path = new Path([P(0, 0), P(10, 0), P(20, 0), P(20, 10), P(0, 10)], true, '#123456', 5, '#abcdef', segments, [true, false, false, false, true]);
        path.id = 'c';
        return path;
    }

    it('残りが3点以上なら閉じたまま（最後の点と始点をまたぐ消し方）', () => {
        const r = planVertexRemoval(pick(closed5(), 4, 0))[0].shape;
        assert.deepEqual(summary(r), {
            points: [P(10, 0), P(20, 0), P(20, 10)],
            kinds: ['line', 'line', 'line'],
            corners: [false, false, false],
            closed: true,
        });
        assert.equal(r.fillColor, '#abcdef');
        assert.equal(r.id, null);
    });

    it('戻る区間にも規則を当てる（最後の点を消すと前後の区間をつなぐ）', () => {
        const segments = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, bez(P(1, 1), P(2, 2)), bez(P(3, 3), P(4, 4))];
        const r = planVertexRemoval(pick(closed5(segments), 4))[0].shape;
        assert.deepEqual(r.segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, bez(P(1, 1), P(4, 4))]);
        assert.equal(r.closed, true);
    });

    it('残りが2点：a→bが1区間ならそれを残す', () => {
        const segments = [bez(P(1, 1), P(2, 2)), { kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'smooth' }];
        const r = planVertexRemoval(pick(closed5(segments), 2, 3, 4))[0].shape;
        assert.deepEqual(r.points, [P(0, 0), P(10, 0)]);
        assert.deepEqual(r.segments, [bez(P(1, 1), P(2, 2))]);
        assert.equal(r.closed, false);
        assert.equal(r.fillColor, '#abcdef');
        assert.deepEqual(r.corners, [true, false]);
    });

    it('残りが2点：折り返しの区間が1つなら[b, a]の向きで残す', () => {
        const segments = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'line' }, bez(P(1, 1), P(2, 2))];
        const r = planVertexRemoval(pick(closed5(segments), 1, 2, 3))[0].shape;
        assert.deepEqual(r.points, [P(0, 10), P(0, 0)]);
        assert.deepEqual(r.segments, [bez(P(1, 1), P(2, 2))]);
        assert.deepEqual(r.corners, [true, true]);
        assert.equal(r.closed, false);
    });

    it('残りが2点：触れていない区間が無ければa→bのrunをつなぐ', () => {
        const segments = [bez(P(1, 1), P(2, 2)), bez(P(3, 3), P(4, 4)), { kind: 'line' }, { kind: 'line' }, { kind: 'line' }];
        const r = planVertexRemoval(pick(closed5(segments), 1, 3, 4))[0].shape;
        assert.deepEqual(r.points, [P(0, 0), P(20, 0)]);
        assert.deepEqual(r.segments, [bez(P(1, 1), P(4, 4))]);
        assert.equal(r.closed, false);
    });

    it('残りが1点以下なら図形ごと消える', () => {
        assert.equal(planVertexRemoval(pick(closed5(), 0, 1, 2, 3))[0].shape, null);
        assert.equal(planVertexRemoval(pick(closed5(), 0, 1, 2, 3, 4))[0].shape, null);
    });
});

describe('planVertexRemoval: 直線・矩形・今の曲線', () => {
    it('直線はどちらか1点でも両方でも図形ごと消える', () => {
        const line = new Line(0, 0, 10, 0);
        line.id = 'l';
        assert.deepEqual(planVertexRemoval(pick(line, 0)), [{ targetId: 'l', shape: null }]);
        assert.deepEqual(planVertexRemoval(pick(line, 1)), [{ targetId: 'l', shape: null }]);
        assert.deepEqual(planVertexRemoval(pick(line, 0, 1)), [{ targetId: 'l', shape: null }]);
    });

    /**
     * 矩形を作る。
     * @returns {Rect} 矩形
     */
    function makeRect() {
        const rect = new Rect(0, 0, 100, 50, '#010203', 4, '#0a0b0c');
        rect.id = 'r';
        return rect;
    }

    it('矩形の1点は三角形（閉じた・直線×3・塗りは保つ）', () => {
        const rect = makeRect();
        const pts = rect.toJSON().points;
        const r = planVertexRemoval(pick(rect, 1))[0].shape;
        assert.deepEqual(r.points, [pts[0], pts[2], pts[3]]);
        assert.deepEqual(r.segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        assert.equal(r.closed, true);
        assert.equal(r.fillColor, '#0a0b0c');
        assert.equal(r.strokeColor, '#010203');
        assert.equal(r.strokeWidth, 4);
    });

    it('矩形の隣り合う2点は開いた線（触れていない辺を残す）', () => {
        const rect = makeRect();
        const pts = rect.toJSON().points;
        const r = planVertexRemoval(pick(rect, 0, 1))[0].shape;
        assert.deepEqual(r.points, [pts[2], pts[3]]);
        assert.deepEqual(r.segments, [{ kind: 'line' }]);
        assert.equal(r.closed, false);
        const wrap = planVertexRemoval(pick(rect, 1, 2))[0].shape;
        assert.deepEqual(wrap.points, [pts[3], pts[0]]);
        assert.equal(wrap.segments.length, 1);
    });

    it('矩形の向かい合う2点は直線1つの開いた線', () => {
        const rect = makeRect();
        const pts = rect.toJSON().points;
        const r = planVertexRemoval(pick(rect, 0, 2))[0].shape;
        assert.deepEqual(r.points, [pts[1], pts[3]]);
        assert.deepEqual(r.segments, [{ kind: 'line' }]);
        assert.equal(r.closed, false);
    });

    it('矩形の3点・4点は図形ごと消える', () => {
        const rect = makeRect();
        assert.equal(planVertexRemoval(pick(rect, 0, 1, 2))[0].shape, null);
        assert.equal(planVertexRemoval(pick(rect, 0, 1, 2, 3))[0].shape, null);
    });

    it('今の曲線の1点は残った順の直線、2点以上は図形ごと消える', () => {
        const curve = new Curve(0, 0, 100, 0, '#aa0000', 6, '#00aa00');
        curve.id = 'cv';
        const pts = curve.toJSON().points;
        for (const [index, keep] of [[0, [1, 2]], [1, [0, 2]], [2, [0, 1]]]) {
            const r = planVertexRemoval(pick(curve, index))[0].shape;
            assert.ok(r instanceof Line);
            assert.deepEqual(r.toJSON().points, [pts[keep[0]], pts[keep[1]]]);
            assert.equal(r.id, null);
            assert.equal(r.strokeColor, '#aa0000');
            assert.equal(r.strokeWidth, 6);
            assert.equal(r.fillColor, '#00aa00');
        }
        assert.equal(planVertexRemoval(pick(curve, 0, 1))[0].shape, null);
        assert.equal(planVertexRemoval(pick(curve, 0, 1, 2))[0].shape, null);
    });
});

describe('planVertexRemoval: 対象外・入力の扱い', () => {
    it('円・弧は飛ばす。範囲外・整数でない番号・重複は無視する', () => {
        const ellipse = new Ellipse(0, 0, 10, 10);
        ellipse.id = 'e';
        assert.deepEqual(planVertexRemoval(pick(ellipse, 0, 1)), []);
        const path = openLine5();
        assert.deepEqual(planVertexRemoval(pick(path, -1, 5, 1.5, NaN)), []);
        const r = planVertexRemoval(pick(path, 2, 2, 2, 9))[0].shape;
        assert.equal(r.points.length, 4);
        assert.deepEqual(planVertexRemoval([]), []);
    });

    it('複数の図形の結果はtargetsに最初に現れた順', () => {
        const a = openLine5();
        const b = new Line(0, 0, 5, 5);
        b.id = 'bb';
        const plan = planVertexRemoval([...pick(b, 0), ...pick(a, 1), ...pick(b, 1)]);
        assert.deepEqual(plan.map((item) => item.targetId), ['bb', 'a']);
        assert.equal(plan[0].shape, null);
        assert.equal(plan[1].shape.points.length, 4);
    });

    it('引数を書き換えず、結果は引数と配列・点を共有しない', () => {
        const path = new Path([P(0, 0), P(10, 0), P(20, 0)], false, '#000000', 2, null, [bez(P(1, 1), P(2, 2)), { kind: 'line' }], [false, false, false]);
        path.id = 'p';
        const before = JSON.stringify(path.toJSON());
        const targets = pick(path, 2);
        const r = planVertexRemoval(targets)[0].shape;
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.deepEqual(targets, pick(path, 2));
        assert.notEqual(r.points, path.points);
        assert.notEqual(r.points[0], path.points[0]);
        assert.notEqual(r.segments[0].control1, path.segments[0].control1);
        assert.notEqual(r.corners, path.corners);
    });
});
