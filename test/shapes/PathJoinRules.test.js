/**
 * 責務: 結合の規則（PathJoinRules）の受理条件・閉じる／2本の結合の頂点の並びと属性・端点の重なりの判定・結合の計画を、
 * 公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    JOIN_TOLERANCE_SCREEN_PX,
    isJoinableLine,
    classifyJoin,
    buildClosedPath,
    buildJoinedPath,
    planJoin,
    buildJoinedPathAt,
    buildExtendedPath,
    canCloseByMergingEnds,
    planDrawnLineJoin,
    planEndpointDragJoin,
} from '../../js/shapes/PathJoinRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 頂点の並びを座標の配列 [[x, y], ...] から作る。
 * @param {number[][]} coords - [x, y] の並び
 * @returns {{x: number, y: number}[]} 頂点の並び
 */
function pts(coords) {
    return coords.map(([x, y]) => ({ x, y }));
}

/**
 * 頂点の並びを座標の配列 [[x, y], ...] に戻す（比較用）。
 * @param {{x: number, y: number}[]} points - 頂点の並び
 * @returns {number[][]} [x, y] の並び
 */
function coordsOf(points) {
    return points.map((p) => [p.x, p.y]);
}

/**
 * 指定の頂点のパスを作る。
 * @param {number[][]} coords - [x, y] の並び
 * @param {boolean} [closed=false] - 閉じたパスか
 * @param {string} [color='#000000'] - 線の色
 * @param {number} [width=2] - 線の太さ
 * @returns {Path} パス
 */
function makePath(coords, closed = false, color = '#000000', width = 2) {
    return new Path(pts(coords), closed, color, width);
}

/**
 * 直線を作る。
 * @param {number} x1 - 始点x
 * @param {number} y1 - 始点y
 * @param {number} x2 - 終点x
 * @param {number} y2 - 終点y
 * @param {string} [color='#000000'] - 線の色
 * @param {number} [width=2] - 線の太さ
 * @returns {Line} 直線
 */
function makeLine(x1, y1, x2, y2, color = '#000000', width = 2) {
    return new Line(x1, y1, x2, y2, color, width);
}

/**
 * 結合できない種類の図形を種類名から作る。
 * @param {'curve'|'rect'|'circle'|'arc'|'closedPath'} kind - 図形の種類
 * @returns {Object} 図形
 */
function makeUnjoinable(kind) {
    switch (kind) {
        case 'curve': return new Curve(0, 0, 100, 100);
        case 'rect': return new Rect(0, 0, 100, 100);
        case 'circle': return new Ellipse(0, 0, 100, 100, 'circle');
        case 'arc': return new Ellipse(0, 0, 100, 100, 'arc');
        default: return makePath([[0, 0], [100, 0], [100, 100]], true);
    }
}

const UNJOINABLE_KINDS = ['curve', 'rect', 'circle', 'arc', 'closedPath'];

/**
 * 区間がすべて直線で、要素数が期待どおりか確かめる。
 * @param {Path} path - 検証するパス
 * @param {number} expectedSegments - 期待する区間の数
 * @returns {void}
 */
function assertAllLineSegments(path, expectedSegments) {
    const data = path.toJSON();
    assert.equal(data.segments.length, expectedSegments);
    assert.ok(data.segments.every((s) => s.kind === 'line'));
}

describe('JOIN_TOLERANCE_SCREEN_PX', () => {
    it('画面上5px', () => {
        assert.equal(JOIN_TOLERANCE_SCREEN_PX, 5);
    });
});

describe('classifyJoin', () => {
    it('直線1本はnull', () => {
        assert.equal(classifyJoin([makeLine(0, 0, 10, 0)]), null);
    });

    it('頂点2つのパス1本はnull', () => {
        assert.equal(classifyJoin([makePath([[0, 0], [10, 0]])]), null);
    });

    it('頂点3つ以上の開いたパス1本は close', () => {
        assert.equal(classifyJoin([makePath([[0, 0], [10, 0], [10, 10]])]), 'close');
        assert.equal(classifyJoin([makePath([[0, 0], [10, 0], [10, 10], [0, 10]])]), 'close');
    });

    it('閉じたパス1本はnull', () => {
        assert.equal(classifyJoin([makePath([[0, 0], [10, 0], [10, 10]], true)]), null);
    });

    it('直線2本は join', () => {
        assert.equal(classifyJoin([makeLine(0, 0, 10, 0), makeLine(20, 0, 30, 0)]), 'join');
    });

    it('直線とパスは順を入れ替えても join', () => {
        const line = makeLine(0, 0, 10, 0);
        const path = makePath([[20, 0], [30, 0], [30, 10]]);
        assert.equal(classifyJoin([line, path]), 'join');
        assert.equal(classifyJoin([path, line]), 'join');
    });

    it('パス2本（頂点2つのパスを含む）は join', () => {
        const two = makePath([[0, 0], [10, 0]]);
        const three = makePath([[20, 0], [30, 0], [30, 10]]);
        assert.equal(classifyJoin([two, three]), 'join');
        assert.equal(classifyJoin([two, makePath([[40, 0], [50, 0]])]), 'join');
    });

    it('結合できない図形を1つでも含む2つはnull（順も問わない）', () => {
        for (const kind of UNJOINABLE_KINDS) {
            const line = makeLine(0, 0, 10, 0);
            assert.equal(classifyJoin([line, makeUnjoinable(kind)]), null, `${kind} 後`);
            assert.equal(classifyJoin([makeUnjoinable(kind), line]), null, `${kind} 前`);
        }
    });

    it('曲線・矩形・円・弧の1つはnull', () => {
        for (const kind of ['curve', 'rect', 'circle', 'arc']) {
            assert.equal(classifyJoin([makeUnjoinable(kind)]), null, kind);
        }
    });

    it('3つ以上（直線3本）はnull', () => {
        const lines = [makeLine(0, 0, 1, 0), makeLine(2, 0, 3, 0), makeLine(4, 0, 5, 0)];
        assert.equal(classifyJoin(lines), null);
    });

    it('0個はnull', () => {
        assert.equal(classifyJoin([]), null);
    });
});

describe('isJoinableLine', () => {
    it('直線・開いたパスは true', () => {
        assert.equal(isJoinableLine(makeLine(0, 0, 10, 0)), true);
        assert.equal(isJoinableLine(makePath([[0, 0], [10, 0]])), true);
        assert.equal(isJoinableLine(makePath([[0, 0], [10, 0], [10, 10]])), true);
    });

    it('閉じたパス・曲線・矩形・円・弧は false', () => {
        for (const kind of UNJOINABLE_KINDS) {
            assert.equal(isJoinableLine(makeUnjoinable(kind)), false, kind);
        }
    });
});

describe('buildClosedPath', () => {
    it('開いたパスを同じ並びで閉じ、区間が1つ増え、色・太さを引き継ぐ', () => {
        const source = makePath([[0, 0], [100, 0], [100, 100]], false, '#ff0000', 7);
        assert.equal(source.toJSON().segments.length, 2);
        const result = buildClosedPath(source, 0);
        const data = result.toJSON();
        assert.equal(data.type, 'path');
        assert.equal(data.closed, true);
        assert.deepEqual(coordsOf(data.points), [[0, 0], [100, 0], [100, 100]]);
        assertAllLineSegments(result, 3);
        assert.equal(data.strokeColor, '#ff0000');
        assert.equal(data.strokeWidth, 7);
        assert.equal(result.id, null);
    });

    it('終点が始点から距離ちょうどtoleranceなら終点を除いて閉じる（3-4-5）', () => {
        const source = makePath([[0, 0], [100, 0], [100, 100], [3, 4]]);
        const result = buildClosedPath(source, 5);
        assert.deepEqual(coordsOf(result.toJSON().points), [[0, 0], [100, 0], [100, 100]]);
        assert.equal(result.toJSON().closed, true);
        assertAllLineSegments(result, 3);
    });

    it('toleranceより離れていれば頂点を除かず閉じる', () => {
        const source = makePath([[0, 0], [100, 0], [100, 100], [3, 4]]);
        const result = buildClosedPath(source, 4.9);
        assert.deepEqual(coordsOf(result.toJSON().points), [[0, 0], [100, 0], [100, 100], [3, 4]]);
        assertAllLineSegments(result, 4);
    });

    it('まとめると頂点が3つ未満になるときはnull', () => {
        const source = makePath([[0, 0], [100, 0], [3, 4]]);
        assert.equal(buildClosedPath(source, 5), null);
    });

    it('直線・頂点2つのパス・閉じたパスはnull', () => {
        assert.equal(buildClosedPath(makeLine(0, 0, 10, 0), 5), null);
        assert.equal(buildClosedPath(makePath([[0, 0], [10, 0]]), 5), null);
        assert.equal(buildClosedPath(makePath([[0, 0], [10, 0], [10, 10]], true), 5), null);
    });
});

describe('buildJoinedPath', () => {
    const joinedPoints = [[0, 0], [10, 0], [20, 0], [30, 0]];

    /**
     * A＝(0,0)→(10,0)の直線とBを結合し、頂点の並びを返す。
     * @param {Object} b - 線B
     * @param {number} tolerance - 許容距離
     * @returns {number[][]} 結果の頂点の並び
     */
    function joinWithA(b, tolerance) {
        const result = buildJoinedPath(makeLine(0, 0, 10, 0), b, tolerance);
        return coordsOf(result.toJSON().points);
    }

    it('(1) Aの終点とBの始点', () => {
        assert.deepEqual(joinWithA(makeLine(20, 0, 30, 0), 0), joinedPoints);
    });

    it('(2) Aの終点とBの終点（Bを逆順）', () => {
        assert.deepEqual(joinWithA(makeLine(30, 0, 20, 0), 0), joinedPoints);
    });

    it('(3) Aの始点とBの終点', () => {
        assert.deepEqual(joinWithA(makeLine(-30, 0, -20, 0), 0), [[-30, 0], [-20, 0], [0, 0], [10, 0]]);
    });

    it('(4) Aの始点とBの始点（Bを逆順）', () => {
        assert.deepEqual(joinWithA(makeLine(-20, 0, -30, 0), 0), [[-30, 0], [-20, 0], [0, 0], [10, 0]]);
    });

    it('Aの向きが結果の中で保たれ、開いたパスで区間は頂点数 - 1の直線', () => {
        const cases = [
            makeLine(20, 0, 30, 0),
            makeLine(30, 0, 20, 0),
            makeLine(-30, 0, -20, 0),
            makeLine(-20, 0, -30, 0),
        ];
        for (const b of cases) {
            const result = buildJoinedPath(makeLine(0, 0, 10, 0), b, 0);
            const points = coordsOf(result.toJSON().points);
            const iStart = points.findIndex(([x, y]) => x === 0 && y === 0);
            const iEnd = points.findIndex(([x, y]) => x === 10 && y === 0);
            assert.ok(iStart >= 0 && iEnd === iStart + 1, 'Aの始点→終点の順');
            assert.equal(result.toJSON().closed, false);
            assertAllLineSegments(result, points.length - 1);
        }
    });

    it('優先順：4組すべて等距離なら(1)の並び', () => {
        assert.deepEqual(joinWithA(makeLine(5, 10, 5, -10), 0), [[0, 0], [10, 0], [5, 10], [5, -10]]);
    });

    it('優先順：(2)(3)(4)が等距離で(1)より近いなら(2)の並び', () => {
        // A終点(10,0)とB終点(5,10)：距離>0。B=(-5,10)→(5,10)で終点(5,10)が最も近い組の一つ
        assert.deepEqual(joinWithA(makeLine(-5, 10, 5, 10), 0), [[0, 0], [10, 0], [5, 10], [-5, 10]]);
    });

    it('優先順：(3)(4)が等距離で(1)(2)より近いなら(3)の並び', () => {
        assert.deepEqual(joinWithA(makeLine(-3, 4, -3, -4), 0), [[-3, 4], [-3, -4], [0, 0], [10, 0]]);
    });

    it('重なり：距離ちょうどtoleranceならBの端点を除く（Aの端点が残る）', () => {
        assert.deepEqual(joinWithA(makeLine(13, 4, 30, 0), 5), [[0, 0], [10, 0], [30, 0]]);
    });

    it('重なり：toleranceより離れていればBの端点が残り区間が足される', () => {
        const result = buildJoinedPath(makeLine(0, 0, 10, 0), makeLine(13, 4, 30, 0), 4.9);
        assert.deepEqual(coordsOf(result.toJSON().points), [[0, 0], [10, 0], [13, 4], [30, 0]]);
        assertAllLineSegments(result, 3);
    });

    it('重なり：Aの始点側（(3)）でもまとめ方が正しい', () => {
        // Aの始点(0,0)とBの終点(-3,4)の距離5。Bの末尾を除く
        assert.deepEqual(joinWithA(makeLine(-30, 0, -3, 4), 5), [[-30, 0], [0, 0], [10, 0]]);
        assert.deepEqual(
            coordsOf(buildJoinedPath(makeLine(0, 0, 10, 0), makeLine(-30, 0, -3, 4), 4.9).toJSON().points),
            [[-30, 0], [-3, 4], [0, 0], [10, 0]]
        );
    });

    it('重なり：Aの始点側（(4)）でもまとめ方が正しい', () => {
        // Aの始点(0,0)とBの始点(-3,4)の距離5。Bを逆順にして末尾（Bの始点）を除く
        assert.deepEqual(joinWithA(makeLine(-3, 4, -30, 0), 5), [[-30, 0], [0, 0], [10, 0]]);
    });

    it('属性：結果はAの色・太さ、idはnull', () => {
        const a = makeLine(0, 0, 10, 0, '#ff0000', 5);
        const b = makeLine(20, 0, 30, 0, '#00ff00', 9);
        const data = buildJoinedPath(a, b, 0).toJSON();
        assert.equal(data.strokeColor, '#ff0000');
        assert.equal(data.strokeWidth, 5);
        assert.equal(buildJoinedPath(a, b, 0).id, null);
        const swapped = buildJoinedPath(b, a, 0).toJSON();
        assert.equal(swapped.strokeColor, '#00ff00');
        assert.equal(swapped.strokeWidth, 9);
    });

    it('直線とパス、パスとパス（3頂点以上を含む）でも並びが正しい', () => {
        const path = makePath([[20, 0], [30, 0], [30, 10]]);
        assert.deepEqual(
            coordsOf(buildJoinedPath(makeLine(0, 0, 10, 0), path, 0).toJSON().points),
            [[0, 0], [10, 0], [20, 0], [30, 0], [30, 10]]
        );
        const a = makePath([[0, 10], [0, 0], [10, 0]]);
        const bPath = makePath([[30, 10], [30, 0], [20, 0]]);
        const result = buildJoinedPath(a, bPath, 0);
        assert.deepEqual(
            coordsOf(result.toJSON().points),
            [[0, 10], [0, 0], [10, 0], [20, 0], [30, 0], [30, 10]]
        );
        assertAllLineSegments(result, 5);
    });

    it('結合できない線（閉じたパス・曲線）を含むとnull', () => {
        const line = makeLine(0, 0, 10, 0);
        assert.equal(buildJoinedPath(line, makeUnjoinable('closedPath'), 5), null);
        assert.equal(buildJoinedPath(makeUnjoinable('curve'), line, 5), null);
    });

    it('両端が重なっても閉じない', () => {
        const a = makePath([[0, 0], [10, 0], [10, 10]]);
        const b = makePath([[10, 10], [0, 10], [0, 0]]);
        const result = buildJoinedPath(a, b, 0);
        assert.equal(result.toJSON().closed, false);
        assert.deepEqual(coordsOf(result.toJSON().points), [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
    });
});

describe('planJoin', () => {
    it('閉じる：同じidを保ち、除く図形はなく、pathは buildClosedPath と同じ図形データ', () => {
        const source = makePath([[0, 0], [100, 0], [100, 100]], false, '#123456', 3);
        source.id = 'shape-7';
        const plan = planJoin([source], 5);
        assert.equal(plan.targetId, 'shape-7');
        assert.equal(plan.keepId, true);
        assert.deepEqual(plan.removeIds, []);
        assert.deepEqual(plan.path.toJSON(), buildClosedPath(source, 5).toJSON());
    });

    it('閉じる：まとめると3頂点未満ならnull', () => {
        const source = makePath([[0, 0], [100, 0], [3, 4]]);
        source.id = 'shape-1';
        assert.equal(planJoin([source], 5), null);
    });

    it('2本：shapes[0]がAで、新しいidを採番しBを除く', () => {
        const a = makeLine(0, 0, 10, 0, '#aa0000', 4);
        const b = makeLine(20, 0, 30, 0, '#00bb00', 8);
        a.id = 'shape-1';
        b.id = 'shape-2';
        const plan = planJoin([a, b], 0);
        assert.equal(plan.targetId, 'shape-1');
        assert.equal(plan.keepId, false);
        assert.deepEqual(plan.removeIds, ['shape-2']);
        assert.equal(plan.path.toJSON().strokeColor, '#aa0000');
        assert.equal(plan.path.toJSON().strokeWidth, 4);
        assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [20, 0], [30, 0]]);
    });

    it('2本の並びを入れ替えると基準の線Aが入れ替わる', () => {
        const a = makeLine(0, 0, 10, 0, '#aa0000', 4);
        const b = makeLine(20, 0, 30, 0, '#00bb00', 8);
        a.id = 'shape-1';
        b.id = 'shape-2';
        const plan = planJoin([b, a], 0);
        assert.equal(plan.targetId, 'shape-2');
        assert.deepEqual(plan.removeIds, ['shape-1']);
        assert.equal(plan.path.toJSON().strokeColor, '#00bb00');
        assert.equal(plan.path.toJSON().strokeWidth, 8);
        // 基準の線(20,0→30,0)の始点と、もう一方の終点(10,0)でつなぐ。基準の線の向きが保たれる
        assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [20, 0], [30, 0]]);
    });

    it('受理しない選択（0個・3つ以上・曲線を含む）はnull', () => {
        assert.equal(planJoin([], 5), null);
        const lines = [makeLine(0, 0, 1, 0), makeLine(2, 0, 3, 0), makeLine(4, 0, 5, 0)];
        assert.equal(planJoin(lines, 5), null);
        assert.equal(planJoin([makeLine(0, 0, 1, 0), makeUnjoinable('curve')], 5), null);
        assert.equal(planJoin([makeLine(0, 0, 1, 0)], 5), null);
    });
});

describe('往復と独立性', () => {
    it('閉じた結果は toJSON → fromJSON で同じ図形データに戻る', () => {
        const result = buildClosedPath(makePath([[0, 0], [100, 0], [100, 100]], false, '#ff00ff', 6), 0);
        result.id = 'shape-9';
        const data = result.toJSON();
        assert.deepEqual(Path.fromJSON(data).toJSON(), data);
    });

    it('2本の結合の結果は toJSON → fromJSON で同じ図形データに戻る', () => {
        const result = buildJoinedPath(makeLine(0, 0, 10, 0, '#00ffff', 3), makePath([[20, 0], [30, 0], [30, 10]]), 0);
        result.id = 'shape-9';
        const data = result.toJSON();
        assert.deepEqual(Path.fromJSON(data).toJSON(), data);
    });

    it('結果のpoints・頂点は元のパスと共有せず、元を translate しても結果が変わらない', () => {
        const source = makePath([[0, 0], [100, 0], [100, 100]]);
        const result = buildClosedPath(source, 0);
        const sourcePoints = source.toJSON().points;
        assert.notEqual(result.points, source.points);
        for (const rp of result.points) {
            for (const sp of source.points) assert.notEqual(rp, sp);
            for (const sp of sourcePoints) assert.notEqual(rp, sp);
        }
        const before = result.toJSON();
        source.translate(50, 50);
        assert.deepEqual(result.toJSON(), before);

        const a = makePath([[0, 0], [10, 0], [10, 10]]);
        const b = makePath([[20, 10], [30, 10], [30, 20]]);
        const joined = buildJoinedPath(a, b, 0);
        for (const rp of joined.points) {
            for (const sp of [...a.points, ...b.points]) assert.notEqual(rp, sp);
        }
        const joinedBefore = joined.toJSON();
        a.translate(7, 7);
        b.translate(-7, -7);
        assert.deepEqual(joined.toJSON(), joinedBefore);
    });

    it('引数の図形の toJSON() は呼び出しの前後で変わらない', () => {
        const path = makePath([[0, 0], [100, 0], [3, 4]]);
        const line = makeLine(0, 0, 10, 0);
        const other = makePath([[10, 0], [20, 0], [20, 10]]);
        const snapshots = [path, line, other].map((s) => JSON.stringify(s.toJSON()));
        buildClosedPath(path, 5);
        buildJoinedPath(line, other, 5);
        planJoin([path], 5);
        planJoin([line, other], 5);
        classifyJoin([line, other]);
        assert.deepEqual([path, line, other].map((s) => JSON.stringify(s.toJSON())), snapshots);
    });
});

/**
 * id を付けた図形を返す（公開プロパティ id へ直接代入する）。
 * @param {Object} shape - 図形
 * @param {string} id - 付ける id
 * @returns {Object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * 端点の指定 { shapeId, end } を作る。
 * @param {string} shapeId - 図形の id
 * @param {'start'|'end'} end - 端点
 * @returns {{shapeId: string, end: string}} 端点の指定
 */
function ref(shapeId, end) {
    return { shapeId, end };
}

/**
 * 結果のパスの図形データが開いた／閉じたパスの不変条件（区間の要素数と kind）を満たすか確かめる。
 * @param {Path} path - 検証するパス
 * @returns {void}
 */
function assertPathInvariant(path) {
    const data = path.toJSON();
    const expected = data.closed ? data.points.length : data.points.length - 1;
    assert.equal(data.segments.length, expected);
    assert.ok(data.segments.every((s) => s.kind === 'line'));
}

describe('PathJoinRules 端点を指定した結合・描き足し・吸い付いた端点での計画（Phase 05-04）', () => {
    describe('buildJoinedPathAt', () => {
        const A = () => makePath([[0, 0], [10, 0], [20, 0]], false, '#ff0000', 4);
        const B = () => makePath([[100, 0], [110, 0], [120, 0]], false, '#00ff00', 6);

        it('A終点-B始点：A＋B', () => {
            const r = buildJoinedPathAt(A(), 'end', B(), 'start', 1);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [20, 0], [100, 0], [110, 0], [120, 0]]);
        });

        it('A終点-B終点：A＋Bの逆順', () => {
            const r = buildJoinedPathAt(A(), 'end', B(), 'end', 1);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [20, 0], [120, 0], [110, 0], [100, 0]]);
        });

        it('A始点-B終点：B＋A', () => {
            const r = buildJoinedPathAt(A(), 'start', B(), 'end', 1);
            assert.deepEqual(coordsOf(r.toJSON().points), [[100, 0], [110, 0], [120, 0], [0, 0], [10, 0], [20, 0]]);
        });

        it('A始点-B始点：Bの逆順＋A', () => {
            const r = buildJoinedPathAt(A(), 'start', B(), 'start', 1);
            assert.deepEqual(coordsOf(r.toJSON().points), [[120, 0], [110, 0], [100, 0], [0, 0], [10, 0], [20, 0]]);
        });

        it('いちばん近い組でなくても指定した組でつながる', () => {
            const a = makePath([[0, 0], [10, 0]]);
            const b = makePath([[11, 0], [200, 0]]);
            const r = buildJoinedPathAt(a, 'start', b, 'end', 1);
            assert.deepEqual(coordsOf(r.toJSON().points), [[11, 0], [200, 0], [0, 0], [10, 0]]);
        });

        it('距離ちょうど tolerance でBの端点を除き、僅かに外では区間が足される', () => {
            const a = makePath([[0, 0], [10, 0]]);
            const b = makePath([[13, 4], [50, 4]]);
            const exact = buildJoinedPathAt(a, 'end', b, 'start', 5);
            assert.deepEqual(coordsOf(exact.toJSON().points), [[0, 0], [10, 0], [50, 4]]);
            const outside = buildJoinedPathAt(a, 'end', b, 'start', 4.9);
            assert.deepEqual(coordsOf(outside.toJSON().points), [[0, 0], [10, 0], [13, 4], [50, 4]]);
        });

        it('始点側でまとめる場合もAの端点の座標が残る', () => {
            const a = makePath([[0, 0], [10, 0]]);
            const b = makePath([[0, 3], [-50, 3]]);
            const r = buildJoinedPathAt(a, 'start', b, 'start', 5);
            assert.deepEqual(coordsOf(r.toJSON().points), [[-50, 3], [0, 0], [10, 0]]);
        });

        it('属性はAの色・太さで id は null、両端が重なっても閉じない', () => {
            const a = makePath([[0, 0], [10, 0], [20, 0]], false, '#ff0000', 4);
            const b = makePath([[20, 0], [10, 5], [0, 0]], false, '#00ff00', 6);
            const r = buildJoinedPathAt(a, 'end', b, 'start', 1);
            const data = r.toJSON();
            assert.equal(data.strokeColor, '#ff0000');
            assert.equal(data.strokeWidth, 4);
            assert.equal(data.id, null);
            assert.equal(data.closed, false);
            assertPathInvariant(r);
        });

        it('直線とパスの組み合わせでつながる', () => {
            const r = buildJoinedPathAt(makeLine(0, 0, 10, 0), 'end', makePath([[10, 0], [20, 0], [20, 10]]), 'start', 1);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [20, 0], [20, 10]]);
        });

        it('結合できない線で null', () => {
            assert.equal(buildJoinedPathAt(makeUnjoinable('curve'), 'end', A(), 'start', 1), null);
            assert.equal(buildJoinedPathAt(A(), 'end', makeUnjoinable('closedPath'), 'start', 1), null);
        });
    });

    describe('buildExtendedPath', () => {
        it('直線の終点側・始点側に描き足す（向き・色・太さを保つ）', () => {
            const line = makeLine(0, 0, 10, 0, '#123456', 3);
            const e = buildExtendedPath(line, 'end', { x: 10, y: 20 }, 1);
            assert.deepEqual(coordsOf(e.toJSON().points), [[0, 0], [10, 0], [10, 20]]);
            const s = buildExtendedPath(line, 'start', { x: 0, y: 20 }, 1);
            assert.deepEqual(coordsOf(s.toJSON().points), [[0, 20], [0, 0], [10, 0]]);
            assert.equal(e.toJSON().strokeColor, '#123456');
            assert.equal(e.toJSON().strokeWidth, 3);
            assert.equal(e.toJSON().closed, false);
        });

        it('パスの終点側・始点側に描き足し、区間は頂点数 - 1', () => {
            const path = makePath([[0, 0], [10, 0], [10, 10]], false, '#abcdef', 5);
            const e = buildExtendedPath(path, 'end', { x: 30, y: 10 }, 1);
            assert.deepEqual(coordsOf(e.toJSON().points), [[0, 0], [10, 0], [10, 10], [30, 10]]);
            assertPathInvariant(e);
            const s = buildExtendedPath(path, 'start', { x: -5, y: 0 }, 1);
            assert.deepEqual(coordsOf(s.toJSON().points), [[-5, 0], [0, 0], [10, 0], [10, 10]]);
            assertPathInvariant(s);
            assert.equal(s.toJSON().strokeColor, '#abcdef');
            assert.equal(s.toJSON().strokeWidth, 5);
        });

        it('重なり：距離ちょうど tolerance で null、僅かに外で足す', () => {
            const line = makeLine(0, 0, 10, 0);
            assert.equal(buildExtendedPath(line, 'end', { x: 13, y: 4 }, 5), null);
            const r = buildExtendedPath(line, 'end', { x: 13, y: 4 }, 4.9);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [13, 4]]);
        });

        it('結合できない線（閉じたパス・曲線）で null', () => {
            assert.equal(buildExtendedPath(makeUnjoinable('closedPath'), 'end', { x: 0, y: 0 }, 1), null);
            assert.equal(buildExtendedPath(makeUnjoinable('curve'), 'end', { x: 0, y: 0 }, 1), null);
        });
    });

    describe('canCloseByMergingEnds', () => {
        it('頂点4つ以上の開いたパスで真', () => {
            assert.equal(canCloseByMergingEnds(makePath([[0, 0], [1, 0], [1, 1], [0, 1]])), true);
            assert.equal(canCloseByMergingEnds(makePath([[0, 0], [1, 0], [1, 1], [0, 1], [5, 5]])), true);
        });

        it('頂点3つ・2つのパス・直線・閉じたパス・曲線で偽', () => {
            assert.equal(canCloseByMergingEnds(makePath([[0, 0], [1, 0], [1, 1]])), false);
            assert.equal(canCloseByMergingEnds(makePath([[0, 0], [1, 0]])), false);
            assert.equal(canCloseByMergingEnds(makeLine(0, 0, 1, 1)), false);
            assert.equal(canCloseByMergingEnds(makePath([[0, 0], [1, 0], [1, 1], [0, 1]], true)), false);
            assert.equal(canCloseByMergingEnds(makeUnjoinable('curve')), false);
        });
    });

    describe('planDrawnLineJoin', () => {
        it('なし-なし で null', () => {
            const shapes = [withId(makeLine(0, 0, 10, 0), 'L')];
            assert.equal(planDrawnLineJoin(shapes, makeLine(0, 0, 50, 50), null, null, 1), null);
        });

        it('描き足し：始点側のみ（直線から・終点側）', () => {
            const L = withId(makeLine(0, 0, 10, 0), 'L');
            const plan = planDrawnLineJoin([L], makeLine(10, 0, 10, 30), ref('L', 'end'), null, 1);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [10, 30]]);
            assert.equal(plan.targetId, 'L');
            assert.equal(plan.keepId, true);
            assert.deepEqual(plan.removeIds, []);
        });

        it('描き足し：始点側のみ（パスから・始点側）', () => {
            const P = withId(makePath([[0, 0], [10, 0], [10, 10]]), 'P');
            const plan = planDrawnLineJoin([P], makeLine(0, 0, -20, 0), ref('P', 'start'), null, 1);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[-20, 0], [0, 0], [10, 0], [10, 10]]);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'P');
        });

        it('描き足し：終点側のみ（描き始めの点を足す）', () => {
            const P = withId(makePath([[0, 0], [10, 0], [10, 10]]), 'P');
            const plan = planDrawnLineJoin([P], makeLine(40, 40, 10, 10), null, ref('P', 'end'), 1);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [10, 10], [40, 40]]);
            assert.equal(plan.keepId, true);
            assert.deepEqual(plan.removeIds, []);
            const plan2 = planDrawnLineJoin([P], makeLine(40, 40, 0, 0), null, ref('P', 'start'), 1);
            assert.deepEqual(coordsOf(plan2.path.toJSON().points), [[40, 40], [0, 0], [10, 0], [10, 10]]);
        });

        it('描き足しの足す頂点が端点と重なれば null', () => {
            const L = withId(makeLine(0, 0, 10, 0), 'L');
            assert.equal(planDrawnLineJoin([L], makeLine(10, 0, 13, 4), ref('L', 'end'), null, 5), null);
        });

        it('閉じる：頂点3つ以上のパスで閉じたパス、直線・頂点2つのパスで null', () => {
            const P = withId(makePath([[0, 0], [10, 0], [10, 10], [0, 10]]), 'P');
            const plan = planDrawnLineJoin([P], makeLine(0, 10, 0, 0), ref('P', 'end'), ref('P', 'start'), 1);
            assert.equal(plan.path.toJSON().closed, true);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [10, 10], [0, 10]]);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'P');
            assert.deepEqual(plan.removeIds, []);
            const L = withId(makeLine(0, 0, 10, 0), 'L');
            assert.equal(planDrawnLineJoin([L], makeLine(0, 0, 10, 0), ref('L', 'start'), ref('L', 'end'), 1), null);
            const P2 = withId(makePath([[0, 0], [10, 0]]), 'P2');
            assert.equal(planDrawnLineJoin([P2], makeLine(0, 0, 10, 0), ref('P2', 'start'), ref('P2', 'end'), 1), null);
        });

        it('同じ端点で null', () => {
            const L = withId(makeLine(0, 0, 10, 0), 'L');
            assert.equal(planDrawnLineJoin([L], makeLine(10, 0, 10, 0), ref('L', 'end'), ref('L', 'end'), 1), null);
        });

        it('結合：基準は shapes で奥、並びを入れ替えると基準も入れ替わる', () => {
            const L = withId(makePath([[0, 0], [10, 0]], false, '#ff0000', 4), 'L');
            const M = withId(makePath([[100, 0], [110, 0]], false, '#00ff00', 6), 'M');
            const drawn = makeLine(10, 0, 100, 0);
            const p1 = planDrawnLineJoin([L, M], drawn, ref('L', 'end'), ref('M', 'start'), 1);
            assert.deepEqual(coordsOf(p1.path.toJSON().points), [[0, 0], [10, 0], [100, 0], [110, 0]]);
            assert.equal(p1.targetId, 'L');
            assert.equal(p1.keepId, false);
            assert.deepEqual(p1.removeIds, ['M']);
            assert.equal(p1.path.toJSON().strokeColor, '#ff0000');
            const p2 = planDrawnLineJoin([M, L], drawn, ref('L', 'end'), ref('M', 'start'), 1);
            assert.equal(p2.targetId, 'M');
            assert.deepEqual(p2.removeIds, ['L']);
            assert.equal(p2.path.toJSON().strokeColor, '#00ff00');
            assert.deepEqual(coordsOf(p2.path.toJSON().points), [[0, 0], [10, 0], [100, 0], [110, 0]]);
        });

        it('結合：吸い付いた端点でつながる（いちばん近い組でなくても）／重なっていれば1つにまとまる', () => {
            const L = withId(makePath([[0, 0], [10, 0]]), 'L');
            const M = withId(makePath([[11, 0], [200, 0]]), 'M');
            const far = planDrawnLineJoin([L, M], makeLine(0, 0, 200, 0), ref('L', 'start'), ref('M', 'end'), 1);
            assert.deepEqual(coordsOf(far.path.toJSON().points), [[11, 0], [200, 0], [0, 0], [10, 0]]);
            const M2 = withId(makePath([[10, 0], [200, 0]]), 'M2');
            const merged = planDrawnLineJoin([L, M2], makeLine(10, 0, 10, 0), ref('L', 'end'), ref('M2', 'start'), 1);
            assert.deepEqual(coordsOf(merged.path.toJSON().points), [[0, 0], [10, 0], [200, 0]]);
        });

        it('図形が無い id・結合できない線で null', () => {
            const L = withId(makeLine(0, 0, 10, 0), 'L');
            const drawn = makeLine(0, 0, 5, 5);
            assert.equal(planDrawnLineJoin([L], drawn, ref('X', 'end'), null, 1), null);
            assert.equal(planDrawnLineJoin([L], drawn, null, ref('X', 'end'), 1), null);
            assert.equal(planDrawnLineJoin([L], drawn, ref('L', 'end'), ref('X', 'start'), 1), null);
            assert.equal(planDrawnLineJoin([L], drawn, ref('X', 'end'), ref('X', 'start'), 1), null);
            const C = withId(makeUnjoinable('closedPath'), 'C');
            assert.equal(planDrawnLineJoin([C], drawn, ref('C', 'end'), null, 1), null);
            assert.equal(planDrawnLineJoin([L, C], drawn, ref('L', 'end'), ref('C', 'start'), 1), null);
        });
    });

    describe('planEndpointDragJoin', () => {
        it('別の線との結合：基準は奥で、同じ座標の端点が1つにまとまる', () => {
            const L = withId(makePath([[0, 0], [10, 0]]), 'L');
            const M = withId(makePath([[10, 0], [50, 0]]), 'M');
            const plan = planEndpointDragJoin([L, M], ref('M', 'start'), ref('L', 'end'), 1);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [50, 0]]);
            assert.equal(plan.targetId, 'L');
            assert.equal(plan.keepId, false);
            assert.deepEqual(plan.removeIds, ['M']);
        });

        it('自身のもう一方の端点で閉じる（頂点が1つ減る・keepId true）', () => {
            const P = withId(makePath([[0, 0], [10, 0], [10, 10], [0, 0]]), 'P');
            const plan = planEndpointDragJoin([P], ref('P', 'end'), ref('P', 'start'), 1);
            assert.equal(plan.path.toJSON().closed, true);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [10, 10]]);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'P');
            assert.deepEqual(plan.removeIds, []);
        });

        it('同じ端点・snap なし・図形なしで null', () => {
            const L = withId(makeLine(0, 0, 10, 0), 'L');
            assert.equal(planEndpointDragJoin([L], ref('L', 'end'), ref('L', 'end'), 1), null);
            assert.equal(planEndpointDragJoin([L], ref('L', 'end'), null, 1), null);
            assert.equal(planEndpointDragJoin([L], ref('X', 'end'), ref('L', 'start'), 1), null);
        });
    });

    describe('不変条件と往復', () => {
        it('描き足し・閉じる・結合の結果が不変条件を満たし、toJSON と fromJSON で往復する', () => {
            const P = withId(makePath([[0, 0], [10, 0], [10, 10], [0, 10]]), 'P');
            const M = withId(makePath([[0, 20], [10, 20]]), 'M');
            const results = [
                buildExtendedPath(P, 'end', { x: 50, y: 50 }, 1),
                buildClosedPath(P, 1),
                buildJoinedPathAt(P, 'end', M, 'start', 1),
            ];
            for (const r of results) {
                assertPathInvariant(r);
                const data = r.toJSON();
                assert.deepEqual(Path.fromJSON(data).toJSON(), data);
            }
        });

        it('結果は元の図形と頂点を共有しない', () => {
            const a = makePath([[0, 0], [10, 0]]);
            const b = makePath([[20, 0], [30, 0]]);
            const joined = buildJoinedPathAt(a, 'end', b, 'start', 1);
            const extended = buildExtendedPath(a, 'end', { x: 40, y: 40 }, 1);
            const beforeJ = JSON.stringify(joined.toJSON());
            const beforeE = JSON.stringify(extended.toJSON());
            a.translate(7, 7);
            b.translate(-7, -7);
            assert.equal(JSON.stringify(joined.toJSON()), beforeJ);
            assert.equal(JSON.stringify(extended.toJSON()), beforeE);
        });

        it('引数の図形の toJSON() は呼び出しの前後で変わらない', () => {
            const L = withId(makePath([[0, 0], [10, 0], [10, 10], [0, 10]]), 'L');
            const M = withId(makeLine(0, 20, 10, 20), 'M');
            const drawn = makeLine(0, 10, 0, 0);
            const shapes = [L, M, drawn];
            const snapshots = shapes.map((s) => JSON.stringify(s.toJSON()));
            buildJoinedPathAt(L, 'end', M, 'start', 1);
            buildExtendedPath(L, 'end', { x: 5, y: 5 }, 1);
            canCloseByMergingEnds(L);
            planDrawnLineJoin([L, M], drawn, ref('L', 'end'), ref('M', 'start'), 1);
            planDrawnLineJoin([L, M], drawn, ref('L', 'end'), null, 1);
            planEndpointDragJoin([L, M], ref('L', 'end'), ref('M', 'start'), 1);
            assert.deepEqual(shapes.map((s) => JSON.stringify(s.toJSON())), snapshots);
        });
    });
});

/**
 * 塗りを指定したパスを作る。
 * @param {number[][]} coords - [x, y] の並び
 * @param {boolean} closed - 閉じたパスか
 * @param {string|null} fill - 塗りの色（nullは塗りなし）
 * @returns {Path} パス
 */
function makeFilledPath(coords, closed, fill) {
    return new Path(pts(coords), closed, '#112233', 3, fill);
}

/**
 * 塗りを指定した直線を作る。
 * @param {number} x1 - 始点x
 * @param {number} y1 - 始点y
 * @param {number} x2 - 終点x
 * @param {number} y2 - 終点y
 * @param {string|null} fill - 塗りの色（nullは塗りなし）
 * @returns {Line} 直線
 */
function makeFilledLine(x1, y1, x2, y2, fill) {
    return new Line(x1, y1, x2, y2, '#112233', 3, fill);
}

describe('PathJoinRules 塗り（fillColor）の引き継ぎ（Phase 06-01）', () => {
    it('buildJoinedPath：結果はAのfillColorを持つ（BのfillColorは使わない）', () => {
        const a = makeFilledPath([[0, 0], [10, 0], [20, 0]], false, '#ff0000');
        const b = makeFilledPath([[20, 0], [30, 0]], false, '#00ff00');
        assert.equal(buildJoinedPath(a, b, 1).toJSON().fillColor, '#ff0000');
    });

    it('buildJoinedPath：BだけがfillColorを持つ場合、結果はnull', () => {
        const a = makeFilledPath([[0, 0], [10, 0], [20, 0]], false, null);
        const b = makeFilledPath([[20, 0], [30, 0]], false, '#00ff00');
        assert.equal(buildJoinedPath(a, b, 1).toJSON().fillColor, null);
    });

    it('buildJoinedPath：直線AのfillColorも結果のパスに引き継ぐ', () => {
        const a = makeFilledLine(0, 0, 10, 0, '#ff0000');
        const b = makeFilledLine(10, 0, 20, 0, '#00ff00');
        assert.equal(buildJoinedPath(a, b, 1).toJSON().fillColor, '#ff0000');
    });

    it('buildClosedPath：元のfillColorを保ち、結果は塗れる形で、描画要素のfillColorが元の値', () => {
        const source = makeFilledPath([[0, 0], [100, 0], [100, 100]], false, '#abcdef');
        const result = buildClosedPath(source, 1);
        assert.equal(result.toJSON().fillColor, '#abcdef');
        assert.equal(result.isFillable(), true);
        assert.equal(result.toDrawElement().fillColor, '#abcdef');
    });

    it('buildClosedPath：元が塗りなしなら結果もnull', () => {
        const source = makeFilledPath([[0, 0], [100, 0], [100, 100]], false, null);
        assert.equal(buildClosedPath(source, 1).toJSON().fillColor, null);
    });

    it('buildJoinedPathAt：AのfillColorを持つ（BのfillColorは使わない）', () => {
        const a = makeFilledPath([[0, 0], [10, 0]], false, '#ff0000');
        const b = makeFilledPath([[10, 0], [20, 0]], false, '#00ff00');
        assert.equal(buildJoinedPathAt(a, 'end', b, 'start', 1).toJSON().fillColor, '#ff0000');
        assert.equal(buildJoinedPathAt(a, 'start', b, 'end', 1).toJSON().fillColor, '#ff0000');
    });

    it('buildExtendedPath：元の線のfillColorを持つ（直線・パス）', () => {
        const path = makeFilledPath([[0, 0], [10, 0]], false, '#ff0000');
        const line = makeFilledLine(0, 0, 10, 0, '#00ff00');
        assert.equal(buildExtendedPath(path, 'end', { x: 20, y: 0 }, 1).toJSON().fillColor, '#ff0000');
        assert.equal(buildExtendedPath(line, 'start', { x: -10, y: 0 }, 1).toJSON().fillColor, '#00ff00');
    });

    it('planJoin：閉じるは元のfillColor、結合は基準の線AのfillColor', () => {
        const source = makeFilledPath([[0, 0], [100, 0], [100, 100]], false, '#abcdef');
        assert.equal(planJoin([source], 1).path.toJSON().fillColor, '#abcdef');
        const a = makeFilledPath([[0, 0], [10, 0]], false, '#ff0000');
        const b = makeFilledPath([[10, 0], [20, 0]], false, '#00ff00');
        assert.equal(planJoin([a, b], 1).path.toJSON().fillColor, '#ff0000');
    });

    it('planDrawnLineJoin：描き足しは元の線・閉じるは元のパス・結合は奥の線のfillColor', () => {
        const L = withId(makeFilledPath([[0, 0], [10, 0], [10, 10], [0, 10]], false, '#ff0000'), 'L');
        const M = withId(makeFilledLine(0, 20, 10, 20, '#00ff00'), 'M');
        const drawn = makeLine(0, 10, 0, 0);
        const extended = planDrawnLineJoin([L, M], drawn, ref('L', 'end'), null, 1);
        assert.equal(extended.path.toJSON().fillColor, '#ff0000');
        const closed = planDrawnLineJoin([L, M], drawn, ref('L', 'end'), ref('L', 'start'), 1);
        assert.equal(closed.path.toJSON().fillColor, '#ff0000');
        const joined = planDrawnLineJoin([L, M], drawn, ref('L', 'end'), ref('M', 'start'), 1);
        assert.equal(joined.path.toJSON().fillColor, '#ff0000');
        const joinedReversed = planDrawnLineJoin([L, M], drawn, ref('M', 'start'), ref('L', 'end'), 1);
        assert.equal(joinedReversed.path.toJSON().fillColor, '#ff0000');
    });

    it('planEndpointDragJoin：閉じるは元のパス・結合は奥の線のfillColor', () => {
        const L = withId(makeFilledPath([[0, 0], [10, 0], [10, 10], [0, 10]], false, '#ff0000'), 'L');
        const M = withId(makeFilledLine(0, 20, 10, 20, '#00ff00'), 'M');
        const closed = planEndpointDragJoin([L, M], ref('L', 'end'), ref('L', 'start'), 1);
        assert.equal(closed.path.toJSON().fillColor, '#ff0000');
        const joined = planEndpointDragJoin([L, M], ref('M', 'start'), ref('L', 'end'), 1);
        assert.equal(joined.path.toJSON().fillColor, '#ff0000');
    });
});
