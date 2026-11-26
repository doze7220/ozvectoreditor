/**
 * 責務: PathSplitRules の区間の削除（planSegmentDeletion）と押せるかの判定（resolveSplitAvailability）の結果を、表Bの行に沿って公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { planSplitAtVertices, planSegmentDeletion, resolveSplitAvailability } from '../../js/shapes/PathSplitRules.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_BEZIER } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

const P = (x, y) => ({ x, y });
const STYLE = ['#112233', 5, '#445566'];
const PTS = [P(0, 0), P(10, 0), P(20, 5), P(30, 0), P(40, 10)];

function withId(shape, id) {
    shape.id = id;
    return shape;
}
function open5(kinds = SEGMENT_KIND_LINE, corners = []) {
    return withId(new Path(PTS, false, ...STYLE, kinds, corners), 'o');
}
function closed5(kinds = SEGMENT_KIND_LINE, corners = []) {
    return withId(new Path(PTS, true, ...STYLE, kinds, corners), 'c');
}
const rect = () => withId(new Rect(0, 0, 40, 20, ...STYLE), 'r');
const targets = (shape, ...indexes) => indexes.map((vertexIndex) => ({ shape, vertexIndex }));
const pointsOf = (path) => path.points.map((p) => [p.x, p.y]);
const xy = (...ids) => ids.map((i) => [PTS[i].x, PTS[i].y]);

describe('planSegmentDeletion：直線・曲線・点2つのパス・円', () => {
    it('直線・今の曲線・点2つのパスの区間は pieces が空（図形ごと消える）', () => {
        const line = withId(new Line(0, 0, 10, 0), 'l');
        assert.deepEqual(planSegmentDeletion(targets(line, 0, 1)), [{ targetId: 'l', pieces: [] }]);
        const curve = withId(new Curve(0, 0, 100, 0), 'k');
        assert.deepEqual(planSegmentDeletion(targets(curve, 0, 2)), [{ targetId: 'k', pieces: [] }]);
        const two = withId(new Path([P(0, 0), P(10, 0)], false), 't');
        assert.deepEqual(planSegmentDeletion(targets(two, 0, 1)), [{ targetId: 't', pieces: [] }]);
    });

    it('片方の点だけ・曲線の制御点・円は計画が空', () => {
        const line = withId(new Line(0, 0, 10, 0), 'l');
        assert.deepEqual(planSegmentDeletion(targets(line, 0)), []);
        const curve = withId(new Curve(0, 0, 100, 0), 'k');
        assert.deepEqual(planSegmentDeletion(targets(curve, 0, 1)), []);
        const ellipse = withId(new Ellipse(0, 0, 10, 10), 'e');
        assert.deepEqual(planSegmentDeletion(targets(ellipse, 0, 1)), []);
        assert.deepEqual(planSegmentDeletion([]), []);
    });
});

describe('planSegmentDeletion：開いたパス（点5つ）', () => {
    it('最初の区間：点0が消えて[1..4]が引き継ぐ', () => {
        const plan = planSegmentDeletion(targets(open5(), 0, 1));
        assert.equal(plan.length, 1);
        assert.equal(plan[0].targetId, 'o');
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), xy(1, 2, 3, 4));
    });

    it('最後の区間：最後の点が消えて[0..3]が引き継ぐ', () => {
        const plan = planSegmentDeletion(targets(open5(), 3, 4));
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), xy(0, 1, 2, 3));
    });

    it('途中の区間：2本（[0..s]が引き継ぎ、[s+1..]が新しい線）', () => {
        const plan = planSegmentDeletion(targets(open5(), 1, 2));
        const [keeper, added] = plan[0].pieces;
        assert.equal(plan[0].pieces.length, 2);
        assert.deepEqual(pointsOf(keeper), xy(0, 1));
        assert.deepEqual(pointsOf(added), xy(2, 3, 4));
    });

    it('続いた2区間：間の点が消える', () => {
        const plan = planSegmentDeletion(targets(open5(), 1, 2, 3));
        const [keeper, added] = plan[0].pieces;
        assert.equal(plan[0].pieces.length, 2);
        assert.deepEqual(pointsOf(keeper), xy(0, 1));
        assert.deepEqual(pointsOf(added), xy(3, 4));
    });

    it('離れた2区間（点6つ）：端の点1つは消える（2本）', () => {
        const path = withId(new Path([...PTS, P(50, 0)], false, ...STYLE), 'o6');
        const plan = planSegmentDeletion(targets(path, 1, 2, 4, 5));
        const [keeper, added] = plan[0].pieces;
        assert.equal(plan[0].pieces.length, 2);
        assert.deepEqual(pointsOf(keeper), xy(0, 1));
        assert.deepEqual(pointsOf(added), xy(2, 3, 4));
    });

    it('離れた2区間（最初と最後）：真ん中の1本だけ残る', () => {
        const plan = planSegmentDeletion(targets(open5(), 0, 1, 3, 4));
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), xy(1, 2, 3));
    });

    it('すべての区間：図形ごと消える', () => {
        assert.deepEqual(planSegmentDeletion(targets(open5(), 0, 1, 2, 3, 4)), [{ targetId: 'o', pieces: [] }]);
    });
});

describe('planSegmentDeletion：閉じたパス（点5つ）', () => {
    it('途中の1区間：点5つの開いた線1本（消した区間のすぐ後の点から）', () => {
        const plan = planSegmentDeletion(targets(closed5(), 1, 2));
        assert.equal(plan[0].pieces.length, 1);
        const piece = plan[0].pieces[0];
        assert.equal(piece.closed, false);
        assert.deepEqual(pointsOf(piece), xy(2, 3, 4, 0, 1));
        assert.equal(piece.segments.length, 4);
    });

    it('最後の区間（点4→点0）：[0..4]の開いた線', () => {
        const plan = planSegmentDeletion(targets(closed5(), 4, 0));
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), xy(0, 1, 2, 3, 4));
    });

    it('隣り合う2区間：間の点が消える', () => {
        const plan = planSegmentDeletion(targets(closed5(), 1, 2, 3));
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), xy(3, 4, 0, 1));
    });

    it('離れた2区間（点6つ）：点0を含む線が引き継ぎ、残りが新しい線', () => {
        const path = withId(new Path([...PTS, P(50, 0)], true, ...STYLE), 'c6');
        const plan = planSegmentDeletion(targets(path, 1, 2, 4, 5));
        const [keeper, added] = plan[0].pieces;
        assert.equal(plan[0].pieces.length, 2);
        assert.deepEqual(pointsOf(keeper), [[50, 0], [0, 0], [10, 0]]);
        assert.deepEqual(pointsOf(added), xy(2, 3, 4));
    });

    it('点0を挟む2区間：点0が消え、残った1本が引き継ぐ', () => {
        const plan = planSegmentDeletion(targets(closed5(), 4, 0, 1));
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), xy(1, 2, 3, 4));
    });

    it('すべての区間：図形ごと消える', () => {
        assert.deepEqual(planSegmentDeletion(targets(closed5(), 0, 1, 2, 3, 4)), [{ targetId: 'c', pieces: [] }]);
    });
});

describe('planSegmentDeletion：矩形', () => {
    const corners = () => rect().toJSON().points.map((p) => [p.x, p.y]);

    it('1辺：点4つ・line×3', () => {
        const c = corners();
        const plan = planSegmentDeletion(targets(rect(), 0, 1));
        assert.equal(plan[0].pieces.length, 1);
        const piece = plan[0].pieces[0];
        assert.deepEqual(pointsOf(piece), [c[1], c[2], c[3], c[0]]);
        assert.deepEqual(piece.segments, Array.from({ length: 3 }, () => ({ kind: SEGMENT_KIND_LINE })));
        assert.equal(piece.closed, false);
    });

    it('隣り合う2辺（角1を挟む）：点3つの1本、角1は消える', () => {
        const c = corners();
        const plan = planSegmentDeletion(targets(rect(), 0, 1, 2));
        assert.equal(plan[0].pieces.length, 1);
        assert.deepEqual(pointsOf(plan[0].pieces[0]), [c[2], c[3], c[0]]);
    });

    it('4辺（4つの角すべて）：図形ごと消える', () => {
        assert.deepEqual(planSegmentDeletion(targets(rect(), 0, 1, 2, 3)), [{ targetId: 'r', pieces: [] }]);
    });

    it('対角の2つの角だけ：計画が空', () => {
        assert.deepEqual(planSegmentDeletion(targets(rect(), 0, 2)), []);
        assert.deepEqual(planSegmentDeletion(targets(rect(), 1, 3)), []);
    });

    it('向かい合う2辺・3辺は画面では起きない（公開APIでは4つの角を選ぶと4辺すべて）', () => {
        const plan = planSegmentDeletion(targets(rect(), 0, 1, 2, 3));
        assert.deepEqual(plan[0].pieces, []);
    });
});

describe('planSegmentDeletion：複数の図形・値の保ち方', () => {
    it('図形ごとに最初に現れた順で計画（区間が無い図形は含めない）', () => {
        const a = open5();
        const b = withId(new Path(PTS, true, ...STYLE), 'b');
        const none = withId(new Path(PTS, false, ...STYLE), 'n');
        const plan = planSegmentDeletion([...targets(b, 1, 2), ...targets(none, 0, 2), ...targets(a, 1, 2)]);
        assert.deepEqual(plan.map((item) => item.targetId), ['b', 'o']);
    });

    it('区間の種類・引っ張る点・角・スタイル3つを元のまま写し、id は null', () => {
        const bez = { kind: SEGMENT_KIND_BEZIER, control1: P(12, 3), control2: P(18, 3) };
        const segments = [{ kind: SEGMENT_KIND_LINE }, bez, { kind: SEGMENT_KIND_SMOOTH }, { kind: SEGMENT_KIND_SMOOTH }];
        const path = open5(segments, [true, false, true, false, false]);
        const plan = planSegmentDeletion(targets(path, 2, 3));
        const [keeper, added] = plan[0].pieces;
        assert.deepEqual(pointsOf(keeper), xy(0, 1, 2));
        assert.deepEqual(keeper.segments, [{ kind: SEGMENT_KIND_LINE }, bez]);
        assert.deepEqual(keeper.corners, [true, false, true]);
        assert.deepEqual(pointsOf(added), xy(3, 4));
        assert.deepEqual(added.segments, [{ kind: SEGMENT_KIND_SMOOTH }]);
        assert.deepEqual(added.corners, [false, false]);
        for (const piece of plan[0].pieces) {
            assert.equal(piece.type, 'path');
            assert.equal(piece.id, null);
            assert.equal(piece.strokeColor, STYLE[0]);
            assert.equal(piece.strokeWidth, STYLE[1]);
            assert.equal(piece.fillColor, STYLE[2]);
        }
    });

    it('引数を書き換えず、結果は点・配列を共有しない', () => {
        const path = open5(SEGMENT_KIND_SMOOTH, [false, true, false, false, false]);
        const before = JSON.stringify(path.toJSON());
        const input = targets(path, 1, 2);
        const inputBefore = JSON.stringify(input.map((t) => t.vertexIndex));
        const plan = planSegmentDeletion(input);
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.equal(JSON.stringify(input.map((t) => t.vertexIndex)), inputBefore);
        plan[0].pieces[0].points[0].x = 999;
        assert.equal(JSON.stringify(path.toJSON()), before);
    });
});

describe('resolveSplitAvailability', () => {
    it('選択なし・切れる点なし・区間なしは両方 false', () => {
        assert.deepEqual(resolveSplitAvailability([]), { split: false, deleteSegments: false });
        assert.deepEqual(resolveSplitAvailability(targets(open5(), 0)), { split: false, deleteSegments: false });
        assert.deepEqual(resolveSplitAvailability(targets(open5(), 0, 4)), { split: false, deleteSegments: false });
        const ellipse = withId(new Ellipse(0, 0, 10, 10), 'e');
        assert.deepEqual(resolveSplitAvailability(targets(ellipse, 0, 1)), { split: false, deleteSegments: false });
    });

    it('表A・表Bの各行の押せる・押せない', () => {
        const line = withId(new Line(0, 0, 10, 0), 'l');
        assert.deepEqual(resolveSplitAvailability(targets(line, 0, 1)), { split: false, deleteSegments: true });
        const curve = withId(new Curve(0, 0, 100, 0), 'k');
        assert.deepEqual(resolveSplitAvailability(targets(curve, 0, 1, 2)), { split: false, deleteSegments: true });
        assert.deepEqual(resolveSplitAvailability(targets(curve, 1)), { split: false, deleteSegments: false });
        assert.deepEqual(resolveSplitAvailability(targets(open5(), 2)), { split: true, deleteSegments: false });
        assert.deepEqual(resolveSplitAvailability(targets(open5(), 2, 3)), { split: true, deleteSegments: true });
        assert.deepEqual(resolveSplitAvailability(targets(closed5(), 0)), { split: true, deleteSegments: false });
        assert.deepEqual(resolveSplitAvailability(targets(rect(), 0, 2)), { split: true, deleteSegments: false });
        assert.deepEqual(resolveSplitAvailability(targets(rect(), 0, 1)), { split: true, deleteSegments: true });
        const two = withId(new Path([P(0, 0), P(10, 0)], false), 't');
        assert.deepEqual(resolveSplitAvailability(targets(two, 0, 1)), { split: false, deleteSegments: true });
    });

    it('複数の図形：どれか1つでも該当すれば押せる', () => {
        const line = withId(new Line(0, 0, 10, 0), 'l');
        const mixed = [...targets(line, 0), ...targets(open5(), 2)];
        assert.deepEqual(resolveSplitAvailability(mixed), { split: true, deleteSegments: false });
        const mixed2 = [...targets(line, 0, 1), ...targets(open5(), 2)];
        assert.deepEqual(resolveSplitAvailability(mixed2), { split: true, deleteSegments: true });
    });

    it('押せるときは必ず計画が1件以上、押せないときは空（多数の選択の組）', () => {
        const makers = [
            () => open5(),
            () => closed5(),
            () => rect(),
            () => withId(new Line(0, 0, 10, 0), 'l'),
            () => withId(new Curve(0, 0, 100, 0), 'k'),
            () => withId(new Ellipse(0, 0, 10, 10), 'e'),
            () => withId(new Path([P(0, 0), P(10, 0)], false), 't'),
            () => withId(new Path([P(0, 0), P(10, 0), P(5, 8)], true), 'tri'),
        ];
        for (const make of makers) {
            for (let mask = 0; mask < 32; mask++) {
                const shape = make();
                const indexes = [0, 1, 2, 3, 4].filter((i) => (mask >> i) & 1);
                const t = targets(shape, ...indexes);
                const availability = resolveSplitAvailability(t);
                assert.equal(planSplitAtVertices(t).length > 0, availability.split);
                assert.equal(planSegmentDeletion(t).length > 0, availability.deleteSegments);
            }
        }
    });

    it('引数を書き換えない', () => {
        const input = targets(open5(), 1, 2);
        const before = JSON.stringify(input.map((t) => t.vertexIndex));
        resolveSplitAvailability(input);
        assert.equal(JSON.stringify(input.map((t) => t.vertexIndex)), before);
    });
});
