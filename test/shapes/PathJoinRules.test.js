/**
 * 責務: 結合の規則（PathJoinRules）の受理条件・閉じる／2本の結合の頂点の並びと属性・端点の重なりの判定・結合の計画を、
 * 公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    JOIN_TOLERANCE_SCREEN_PX,
    isJoinableLine,
    isDrawnLineShape,
    classifyJoin,
    buildClosedPath,
    buildJoinedPath,
    planJoin,
    buildJoinedPathAt,
    buildExtendedPath,
    canCloseByMergingEnds,
    planDrawnLineJoin,
    planEndpointDragJoin,
    addDrawnPoint,
    removeLastDrawnPoint,
    buildFinishedDrawnLine,
    getLastDrawnPoint,
    isOnLastDrawnPoint,
    canCloseDrawnLine,
    segmentKindsOf,
    segmentSpecsOf,
    lineEndpointOf,
    endpointVertexIndexOf,
} from '../../js/shapes/PathJoinRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';
import { cubicBezierPoint, quadraticBezierPoint } from '../../js/shapes/ShapeGeometry.js';

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
 * @param {string|null} [fill=null] - 塗りの色
 * @returns {Line} 直線
 */
function makeLine(x1, y1, x2, y2, color = '#000000', width = 2, fill = null) {
    return new Line(x1, y1, x2, y2, color, width, fill);
}

/**
 * 続けて引く線の形でない種類の図形を種類名から作る（今の曲線・弧を含む。今の曲線はPhase 09-03a、弧はPhase 09-03bから結合できる線）。
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

/**
 * 続けて引く線の形でない図形の種類名の並び（今の曲線・弧を含む。今の曲線はPhase 09-03a、弧はPhase 09-03bから結合できる線）。
 * @type {string[]}
 */
const UNJOINABLE_KINDS = ['curve', 'rect', 'circle', 'arc', 'closedPath'];

/**
 * 結合できない図形の種類名の並び（`UNJOINABLE_KINDS`から今の曲線・弧を除いたもの）。
 * @type {string[]}
 */
const JOIN_REJECTED_KINDS = UNJOINABLE_KINDS.filter((kind) => kind !== 'curve' && kind !== 'arc');

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
        for (const kind of JOIN_REJECTED_KINDS) {
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

    it('閉じたパス・矩形・円は false', () => {
        for (const kind of JOIN_REJECTED_KINDS) {
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

    it('結合できない線（閉じたパス・矩形）を含むとnull', () => {
        const line = makeLine(0, 0, 10, 0);
        assert.equal(buildJoinedPath(line, makeUnjoinable('closedPath'), 5), null);
        assert.equal(buildJoinedPath(makeUnjoinable('rect'), line, 5), null);
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

    it('受理しない選択（0個・3つ以上・矩形を含む）はnull', () => {
        assert.equal(planJoin([], 5), null);
        const lines = [makeLine(0, 0, 1, 0), makeLine(2, 0, 3, 0), makeLine(4, 0, 5, 0)];
        assert.equal(planJoin(lines, 5), null);
        assert.equal(planJoin([makeLine(0, 0, 1, 0), makeUnjoinable('rect')], 5), null);
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
            assert.equal(buildJoinedPathAt(makeUnjoinable('rect'), 'end', A(), 'start', 1), null);
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

        it('結合できない線（閉じたパス・矩形）で null', () => {
            assert.equal(buildExtendedPath(makeUnjoinable('closedPath'), 'end', { x: 0, y: 0 }, 1), null);
            assert.equal(buildExtendedPath(makeUnjoinable('rect'), 'end', { x: 0, y: 0 }, 1), null);
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

/**
 * 作成途中の線（頂点の並び＋スタイル）を作る。頂点2つは`Line`、3つ以上は開いた`Path`。
 * @param {number[][]} coords - [x, y] の並び（末尾＝付いてくる線の先）
 * @returns {Line|Path} 作成途中の線
 */
function makeDrawn(coords) {
    if (coords.length === 2) {
        return new Line(coords[0][0], coords[0][1], coords[1][0], coords[1][1], '#112233', 5, '#445566');
    }
    return new Path(pts(coords), false, '#112233', 5, '#445566');
}

describe('作成途中の線の点の並びの規則', () => {
    const STYLE = { strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566' };

    /**
     * 結果のスタイルとidを確かめる。
     * @param {Object} shape - 結果の図形
     */
    function assertStyle(shape) {
        const d = shape.toJSON();
        assert.equal(d.strokeColor, STYLE.strokeColor);
        assert.equal(d.strokeWidth, STYLE.strokeWidth);
        assert.equal(d.fillColor, STYLE.fillColor);
        assert.equal(d.id, null);
    }

    describe('addDrawnPoint', () => {
        it('Lineから頂点3つの開いたPathを作り、末尾2つが同じ座標になる', () => {
            const r = addDrawnPoint(makeDrawn([[0, 0], [10, 0]]));
            assert.equal(r.type, 'path');
            assert.equal(r.toJSON().closed, false);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [10, 0]]);
            assertStyle(r);
        });
        it('Pathは頂点が1つ増える', () => {
            const r = addDrawnPoint(makeDrawn([[0, 0], [10, 0], [10, 5]]));
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [10, 5], [10, 5]]);
            assertStyle(r);
        });
        it('閉じたパス・曲線・矩形ではnull', () => {
            assert.equal(addDrawnPoint(makePath([[0, 0], [10, 0], [10, 10]], true)), null);
            assert.equal(addDrawnPoint(new Rect(0, 0, 5, 5)), null);
            assert.equal(addDrawnPoint(new Curve(0, 0, 5, 5)), null);
        });
    });

    describe('removeLastDrawnPoint', () => {
        it('頂点4つのPathは最後の点だけが消え、付いてくる線の先は残る', () => {
            const r = removeLastDrawnPoint(makeDrawn([[0, 0], [10, 0], [10, 5], [20, 5]]));
            assert.equal(r.type, 'path');
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [20, 5]]);
            assertStyle(r);
        });
        it('頂点3つのPathはLine（始点と付いてくる線の先）になる', () => {
            const r = removeLastDrawnPoint(makeDrawn([[0, 0], [10, 0], [20, 5]]));
            assert.equal(r.type, 'line');
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [20, 5]]);
            assertStyle(r);
        });
        it('Line（頂点2つ）・結合できない図形はnull', () => {
            assert.equal(removeLastDrawnPoint(makeDrawn([[0, 0], [10, 0]])), null);
            assert.equal(removeLastDrawnPoint(new Rect(0, 0, 5, 5)), null);
        });
    });

    describe('buildFinishedDrawnLine', () => {
        it('開いたまま：Lineはnull、頂点3つはLine（打った点2つ）、4つ以上は開いたPath', () => {
            assert.equal(buildFinishedDrawnLine(makeDrawn([[0, 0], [10, 0]])), null);
            const a = buildFinishedDrawnLine(makeDrawn([[0, 0], [10, 0], [20, 5]]));
            assert.equal(a.type, 'line');
            assert.deepEqual(coordsOf(a.toJSON().points), [[0, 0], [10, 0]]);
            assertStyle(a);
            const b = buildFinishedDrawnLine(makeDrawn([[0, 0], [10, 0], [10, 5], [20, 5]]), false);
            assert.equal(b.type, 'path');
            assert.equal(b.toJSON().closed, false);
            assert.deepEqual(coordsOf(b.toJSON().points), [[0, 0], [10, 0], [10, 5]]);
            assertStyle(b);
        });
        it('閉じて：打った点2つはnull、3つ以上は閉じたPath', () => {
            assert.equal(buildFinishedDrawnLine(makeDrawn([[0, 0], [10, 0], [20, 5]]), true), null);
            const r = buildFinishedDrawnLine(makeDrawn([[0, 0], [10, 0], [10, 5], [20, 5]]), true);
            assert.equal(r.type, 'path');
            assert.equal(r.toJSON().closed, true);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [10, 5]]);
            assert.equal(r.toJSON().segments.length, 3);
            assert.equal(r.isFillable(), true);
            assertStyle(r);
        });
        it('結合できない図形はnull', () => {
            assert.equal(buildFinishedDrawnLine(new Rect(0, 0, 5, 5)), null);
        });
    });

    describe('getLastDrawnPoint', () => {
        it('頂点の末尾から2番目を返す。Lineのときは始点', () => {
            assert.deepEqual(getLastDrawnPoint(makeDrawn([[0, 0], [10, 0], [20, 5]])), { x: 10, y: 0 });
            assert.deepEqual(getLastDrawnPoint(makeDrawn([[1, 2], [10, 0]])), { x: 1, y: 2 });
        });
        it('結合できない図形はnull', () => {
            assert.equal(getLastDrawnPoint(new Rect(0, 0, 5, 5)), null);
        });
    });

    describe('isOnLastDrawnPoint', () => {
        it('距離ちょうどは真、超えれば偽', () => {
            const drawn = makeDrawn([[0, 0], [10, 0], [13, 4]]);
            assert.equal(isOnLastDrawnPoint(drawn, 5), true);
            assert.equal(isOnLastDrawnPoint(drawn, 4.99), false);
        });
        it('Lineのときは最後の点＝始点との距離で判定する', () => {
            const drawn = makeDrawn([[0, 0], [3, 4]]);
            assert.equal(isOnLastDrawnPoint(drawn, 5), true);
            assert.equal(isOnLastDrawnPoint(drawn, 4), false);
        });
        it('結合できない図形は偽', () => {
            assert.equal(isOnLastDrawnPoint(new Rect(0, 0, 5, 5), 100), false);
        });
    });

    describe('canCloseDrawnLine', () => {
        it('打った点が2つで偽、3つで真', () => {
            assert.equal(canCloseDrawnLine(makeDrawn([[0, 0], [10, 0], [20, 5]])), false);
            assert.equal(canCloseDrawnLine(makeDrawn([[0, 0], [10, 0], [10, 5], [20, 5]])), true);
        });
        it('Lineは偽、結合できない図形も偽', () => {
            assert.equal(canCloseDrawnLine(makeDrawn([[0, 0], [10, 0]])), false);
            assert.equal(canCloseDrawnLine(new Rect(0, 0, 5, 5)), false);
        });
    });

    describe('引数を書き換えず、結果が引数と頂点を共有しない', () => {
        it('各関数が引数の頂点を変えず、結果の頂点を変えても引数に影響しない', () => {
            const coords = [[0, 0], [10, 0], [10, 5], [20, 5]];
            const drawn = makeDrawn(coords);
            const results = [
                addDrawnPoint(drawn),
                removeLastDrawnPoint(drawn),
                buildFinishedDrawnLine(drawn, false),
                buildFinishedDrawnLine(drawn, true),
            ];
            getLastDrawnPoint(drawn);
            isOnLastDrawnPoint(drawn, 1);
            canCloseDrawnLine(drawn);
            for (const r of results) {
                r.translate(100, 100);
            }
            assert.deepEqual(coordsOf(drawn.toJSON().points), coords);
            const line = makeDrawn([[0, 0], [10, 0]]);
            const extended = addDrawnPoint(line);
            extended.translate(7, 7);
            assert.deepEqual(coordsOf(line.toJSON().points), [[0, 0], [10, 0]]);
        });
    });
});

/**
 * 結合の計画を比較用の素のオブジェクトにする（`path`は`toJSON()`にする）。
 * @param {Object|null} plan - 結合の計画
 * @returns {Object|null} 比較用のオブジェクト
 */
function planToPlain(plan) {
    if (plan === null) return null;
    return { ...plan, path: plan.path.toJSON() };
}

describe('planDrawnLineJoin 続けて引いた線（点が複数）への拡張', () => {
    const TOL = 1;
    const A = () => withId(makePath([[0, 0], [10, 0], [20, 0]], false, '#ff0000', 4), 'A');

    describe('描き始めだけ吸い付き', () => {
        it('end側：打った点がすべて元の向きを保って足され、元のidとスタイルを保つ', () => {
            const a = A();
            const drawn = makeDrawn([[20, 0], [30, 10], [40, 10], [50, 10]]);
            const plan = planDrawnLineJoin([a], drawn, ref('A', 'end'), null, TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [20, 0], [30, 10], [40, 10], [50, 10]]);
            assert.equal(plan.targetId, 'A');
            assert.equal(plan.keepId, true);
            assert.deepEqual(plan.removeIds, []);
            assert.equal(plan.path.toJSON().strokeColor, '#ff0000');
            assert.equal(plan.path.toJSON().strokeWidth, 4);
            assertPathInvariant(plan.path);
        });
        it('start側：打った点が先頭へ順に足され、元の向きが保たれる', () => {
            const a = A();
            const drawn = makeDrawn([[0, 0], [-10, 5], [-20, 5], [-30, 5]]);
            const plan = planDrawnLineJoin([a], drawn, ref('A', 'start'), null, TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[-30, 5], [-20, 5], [-10, 5], [0, 0], [10, 0], [20, 0]]);
            assert.equal(plan.keepId, true);
            assertPathInvariant(plan.path);
        });
        it('端点と重なる点は足さない', () => {
            const a = A();
            const drawn = makeDrawn([[20, 0], [20, 0.5], [30, 10], [40, 10]]);
            const plan = planDrawnLineJoin([a], drawn, ref('A', 'end'), null, TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [20, 0], [30, 10], [40, 10]]);
        });
        it('足せる点が1つも無ければnull', () => {
            const a = A();
            const drawn = makeDrawn([[20, 0], [20, 0.5], [20.5, 0]]);
            assert.equal(planDrawnLineJoin([a], drawn, ref('A', 'end'), null, TOL), null);
        });
    });

    describe('描き終えだけ吸い付き', () => {
        it('描き終えの手前から描き始めまでが逆順で足される', () => {
            const a = A();
            const drawn = makeDrawn([[100, 100], [60, 60], [20, 0]]);
            const plan = planDrawnLineJoin([a], drawn, null, ref('A', 'end'), TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [20, 0], [60, 60], [100, 100]]);
            assert.equal(plan.targetId, 'A');
            assert.equal(plan.keepId, true);
            assertPathInvariant(plan.path);
        });
    });

    describe('同じ線の両端', () => {
        it('打った点が加わって閉じ、元のidを保つ', () => {
            const a = withId(makePath([[0, 0], [10, 0], [10, 10]], false, '#ff0000', 4), 'A');
            const drawn = makeDrawn([[10, 10], [20, 20], [0, 0]]);
            const plan = planDrawnLineJoin([a], drawn, ref('A', 'end'), ref('A', 'start'), TOL);
            const d = plan.path.toJSON();
            assert.equal(d.closed, true);
            assert.deepEqual(coordsOf(d.points), [[0, 0], [10, 0], [10, 10], [20, 20]]);
            assert.equal(plan.targetId, 'A');
            assert.equal(plan.keepId, true);
            assert.deepEqual(plan.removeIds, []);
            assert.equal(d.strokeColor, '#ff0000');
            assertPathInvariant(plan.path);
        });
        it('同じ端点ならnull', () => {
            const a = A();
            const drawn = makeDrawn([[20, 0], [30, 10], [20, 0]]);
            assert.equal(planDrawnLineJoin([a], drawn, ref('A', 'end'), ref('A', 'end'), TOL), null);
        });
    });

    describe('別の線の両端', () => {
        const mk = () => [
            withId(makePath([[0, 0], [10, 0]], false, '#ff0000', 4), 'A'),
            withId(makePath([[100, 0], [110, 0]], false, '#00ff00', 6), 'B'),
        ];
        it('基準が描き始めの線（奥）：途中の点が間に入り、基準の線のスタイル・新しいid扱い', () => {
            const [a, b] = mk();
            const drawn = makeDrawn([[10, 0], [40, 5], [70, 5], [100, 0]]);
            const plan = planDrawnLineJoin([a, b], drawn, ref('A', 'end'), ref('B', 'start'), TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [40, 5], [70, 5], [100, 0], [110, 0]]);
            assert.equal(plan.targetId, 'A');
            assert.equal(plan.keepId, false);
            assert.deepEqual(plan.removeIds, ['B']);
            assert.equal(plan.path.toJSON().strokeColor, '#ff0000');
            assert.equal(plan.path.toJSON().strokeWidth, 4);
            assertPathInvariant(plan.path);
        });
        it('基準が描き終えの線（奥）：逆順に足され、基準の線の向き・スタイル', () => {
            const [a, b] = mk();
            const drawn = makeDrawn([[10, 0], [40, 5], [70, 5], [100, 0]]);
            const plan = planDrawnLineJoin([b, a], drawn, ref('A', 'end'), ref('B', 'start'), TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [40, 5], [70, 5], [100, 0], [110, 0]]);
            assert.equal(plan.targetId, 'B');
            assert.equal(plan.keepId, false);
            assert.deepEqual(plan.removeIds, ['A']);
            assert.equal(plan.path.toJSON().strokeColor, '#00ff00');
            assert.equal(plan.path.toJSON().strokeWidth, 6);
            assertPathInvariant(plan.path);
        });
        it('途中の点が基準の端点と重なるときは足さない', () => {
            const [a, b] = mk();
            const drawn = makeDrawn([[10, 0], [10, 0.5], [70, 5], [100, 0]]);
            const plan = planDrawnLineJoin([a, b], drawn, ref('A', 'end'), ref('B', 'start'), TOL);
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[0, 0], [10, 0], [70, 5], [100, 0], [110, 0]]);
        });
    });

    describe('頂点2つのとき今の結果と同じ', () => {
        const mk = () => [
            withId(makePath([[0, 0], [10, 0]], false, '#ff0000', 4), 'A'),
            withId(makePath([[100, 0], [110, 0]], false, '#00ff00', 6), 'B'),
            withId(makePath([[200, 0], [210, 0], [210, 10]], false, '#0000ff', 2), 'C'),
        ];
        it('描き始めだけ・描き終えだけ：buildExtendedPathと同じ', () => {
            const [a] = mk();
            const startOnly = planDrawnLineJoin([a], makeDrawn([[10, 0], [50, 50]]), ref('A', 'end'), null, TOL);
            assert.deepEqual(startOnly.path.toJSON(), buildExtendedPath(a, 'end', { x: 50, y: 50 }, TOL).toJSON());
            const endOnly = planDrawnLineJoin([a], makeDrawn([[50, 50], [0, 0]]), null, ref('A', 'start'), TOL);
            assert.deepEqual(endOnly.path.toJSON(), buildExtendedPath(a, 'start', { x: 50, y: 50 }, TOL).toJSON());
        });
        it('別の線の両端：planEndpointDragJoin（planJoinAt）と同じ', () => {
            const [a, b] = mk();
            const plan = planDrawnLineJoin([a, b], makeDrawn([[10, 0], [100, 0]]), ref('A', 'end'), ref('B', 'start'), TOL);
            assert.deepEqual(planToPlain(plan), planToPlain(planEndpointDragJoin([a, b], ref('A', 'end'), ref('B', 'start'), TOL)));
        });
        it('同じ線の両端：planEndpointDragJoin（planCloseOf）と同じ', () => {
            const [, , c] = mk();
            const plan = planDrawnLineJoin([c], makeDrawn([[210, 10], [200, 0]]), ref('C', 'end'), ref('C', 'start'), TOL);
            assert.deepEqual(planToPlain(plan), planToPlain(planEndpointDragJoin([c], ref('C', 'end'), ref('C', 'start'), TOL)));
        });
        it('両方null・図形が無い場合はnull', () => {
            const [a] = mk();
            assert.equal(planDrawnLineJoin([a], makeDrawn([[0, 0], [5, 5]]), null, null, TOL), null);
            assert.equal(planDrawnLineJoin([a], makeDrawn([[0, 0], [5, 5]]), ref('X', 'end'), null, TOL), null);
        });
    });

    describe('引数を書き換えず、結果が引数と頂点を共有しない', () => {
        it('drawn・shapes・スナップを変えず、結果を変えても引数に影響しない', () => {
            const a = withId(makePath([[0, 0], [10, 0]], false, '#ff0000', 4), 'A');
            const b = withId(makePath([[100, 0], [110, 0]], false, '#00ff00', 6), 'B');
            const drawn = makeDrawn([[10, 0], [40, 5], [70, 5], [100, 0]]);
            const startSnap = ref('A', 'end');
            const endSnap = ref('B', 'start');
            const before = JSON.stringify([a.toJSON(), b.toJSON(), drawn.toJSON(), startSnap, endSnap]);
            const plans = [
                planDrawnLineJoin([a, b], drawn, startSnap, endSnap, TOL),
                planDrawnLineJoin([a, b], drawn, startSnap, null, TOL),
                planDrawnLineJoin([a, b], drawn, null, endSnap, TOL),
                planDrawnLineJoin([a], drawn, startSnap, ref('A', 'start'), TOL),
            ];
            for (const plan of plans) plan.path.translate(1000, 1000);
            assert.equal(JSON.stringify([a.toJSON(), b.toJSON(), drawn.toJSON(), startSnap, endSnap]), before);
        });
    });
});

/**
 * 区間の種類を指定して開いたパスを作る（頂点2つ以上。全区間が同じ種類）。
 * @param {number[][]} coords - [x, y] の並び
 * @param {string} kind - 全区間の種類（`'line'`か`'smooth'`）
 * @param {boolean} [closed=false] - 閉じたパスか
 * @returns {Path} パス
 */
function makeKindPath(coords, kind, closed = false) {
    return new Path(pts(coords), closed, '#112233', 5, '#445566', kind);
}

/**
 * 区間の種類が混ざったパスを作る（`toJSON`→`fromJSON`で区間を差し替える）。
 * @param {number[][]} coords - [x, y] の並び
 * @param {string[]} kinds - 区間ごとの種類（開いたパスは頂点数`- 1`個）
 * @returns {Path} パス
 */
function makeMixedPath(coords, kinds) {
    const data = makePath(coords).toJSON();
    data.segments = kinds.map((kind) => ({ kind }));
    return Path.fromJSON(data);
}

describe('PathJoinRules 曲線のパスと続けて引く線の形（Phase 09-01a）', () => {
    const FOUR = [[0, 0], [10, 0], [10, 10], [0, 10]];

    describe('isJoinableLine', () => {
        it('曲線の区間を持つ開いたパス（全区間・混在・頂点2つ）は真', () => {
            assert.equal(isJoinableLine(makeKindPath(FOUR, 'smooth')), true);
            assert.equal(isJoinableLine(makeMixedPath(FOUR, ['line', 'smooth', 'line'])), true);
            assert.equal(isJoinableLine(makeKindPath([[0, 0], [10, 0]], 'smooth')), true);
        });
        it('直線と、直線の区間だけの開いたパスは真', () => {
            assert.equal(isJoinableLine(makeLine(0, 0, 10, 0)), true);
            assert.equal(isJoinableLine(makeKindPath(FOUR, 'line')), true);
        });
        it('閉じたパス・曲線の閉じたパスは偽', () => {
            assert.equal(isJoinableLine(makeKindPath(FOUR, 'line', true)), false);
            assert.equal(isJoinableLine(makeKindPath(FOUR, 'smooth', true)), false);
        });
    });

    describe('isDrawnLineShape', () => {
        it('直線と開いたパス（区間の種類によらない）は真', () => {
            assert.equal(isDrawnLineShape(makeLine(0, 0, 10, 0)), true);
            assert.equal(isDrawnLineShape(makeKindPath(FOUR, 'line')), true);
            assert.equal(isDrawnLineShape(makeKindPath(FOUR, 'smooth')), true);
            assert.equal(isDrawnLineShape(makeMixedPath(FOUR, ['line', 'smooth', 'line'])), true);
        });
        it('閉じたパス・今の曲線・矩形・円・弧は偽', () => {
            assert.equal(isDrawnLineShape(makeKindPath(FOUR, 'smooth', true)), false);
            for (const kind of UNJOINABLE_KINDS) {
                assert.equal(isDrawnLineShape(makeUnjoinable(kind)), false, kind);
            }
        });
        it('今の曲線・弧のほかはisJoinableLineとisDrawnLineShapeが同じ結果。今の曲線・弧は結合できるが続けて引く線の形ではない', () => {
            const shapes = [
                makeLine(0, 0, 10, 0), makeKindPath(FOUR, 'line'), makeKindPath(FOUR, 'smooth'),
                makeMixedPath(FOUR, ['line', 'smooth', 'line']), makeKindPath(FOUR, 'line', true),
                ...JOIN_REJECTED_KINDS.map(makeUnjoinable),
            ];
            for (const shape of shapes) {
                assert.equal(isJoinableLine(shape), isDrawnLineShape(shape));
            }
            assert.equal(isJoinableLine(makeUnjoinable('curve')), true);
            assert.equal(isDrawnLineShape(makeUnjoinable('curve')), false);
            assert.equal(isJoinableLine(makeUnjoinable('arc')), true);
            assert.equal(isDrawnLineShape(makeUnjoinable('arc')), false);
        });
    });

    describe('結合・閉じる（曲線のパスも対象）', () => {
        it('classifyJoin・planJoin：曲線のパス1本はclose・曲線のパスと直線の2本はjoin（計画はnullでない）', () => {
            const smooth = makeKindPath(FOUR, 'smooth');
            const line = makeLine(0, 0, 10, 0);
            assert.equal(classifyJoin([smooth]), 'close');
            assert.equal(classifyJoin([smooth, line]), 'join');
            assert.equal(classifyJoin([line, smooth]), 'join');
            assert.notEqual(planJoin([smooth], 0.1), null);
            assert.notEqual(planJoin([smooth, line], 0.1), null);
        });
        it('classifyJoin：直線の区間だけのパス1本は今までどおり close', () => {
            assert.equal(classifyJoin([makeKindPath(FOUR, 'line')]), 'close');
        });
        it('buildClosedPath・canCloseByMergingEnds：曲線のパスもnullでない／真', () => {
            const smooth = makeKindPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 'smooth');
            assert.notEqual(buildClosedPath(smooth, 0.1), null);
            assert.equal(canCloseByMergingEnds(smooth), true);
            const line = makeKindPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 'line');
            assert.notEqual(buildClosedPath(line, 0.1), null);
            assert.equal(canCloseByMergingEnds(line), true);
        });
    });

    describe('作成途中の線が曲線のパスのとき', () => {
        const STYLE = { strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566' };

        /**
         * 全区間の種類と区間の数を確かめる。
         * @param {Path} path - 検証するパス
         * @param {string} kind - 期待する種類
         * @param {number} count - 期待する区間の数
         */
        function assertSegments(path, kind, count) {
            const segments = path.toJSON().segments;
            assert.equal(segments.length, count);
            assert.ok(segments.every((s) => s.kind === kind));
        }

        it('addDrawnPointは全区間smoothの開いたパス（スタイルを引き継ぐ）', () => {
            const r = addDrawnPoint(makeKindPath([[0, 0], [10, 0]], 'smooth'));
            assert.equal(r.type, 'path');
            assert.equal(r.toJSON().closed, false);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [10, 0]]);
            assertSegments(r, 'smooth', 2);
            assert.equal(r.toJSON().strokeColor, STYLE.strokeColor);
            assert.equal(r.toJSON().fillColor, STYLE.fillColor);
        });
        it('removeLastDrawnPointは頂点3つ→頂点2つの曲線のパス（Lineにならない）・頂点2つ→null', () => {
            const r = removeLastDrawnPoint(makeKindPath([[0, 0], [10, 0], [20, 5]], 'smooth'));
            assert.equal(r.type, 'path');
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [20, 5]]);
            assertSegments(r, 'smooth', 1);
            assert.equal(removeLastDrawnPoint(makeKindPath([[0, 0], [10, 0]], 'smooth')), null);
        });
        it('buildFinishedDrawnLineは打った点2つでLine・3つで全区間smoothの開いたパス', () => {
            const two = buildFinishedDrawnLine(makeKindPath([[0, 0], [10, 0], [10, 0]], 'smooth'));
            assert.equal(two.type, 'line');
            assert.deepEqual(coordsOf(two.toJSON().points), [[0, 0], [10, 0]]);
            const three = buildFinishedDrawnLine(makeKindPath([[0, 0], [10, 0], [10, 10], [10, 10]], 'smooth'));
            assert.equal(three.type, 'path');
            assert.equal(three.toJSON().closed, false);
            assertSegments(three, 'smooth', 2);
        });
        it('buildFinishedDrawnLineは閉じて3つで全区間smooth（区間3つ）の閉じたパス', () => {
            const r = buildFinishedDrawnLine(makeKindPath([[0, 0], [10, 0], [10, 10], [10, 10]], 'smooth'), true);
            assert.equal(r.type, 'path');
            assert.equal(r.toJSON().closed, true);
            assert.deepEqual(coordsOf(r.toJSON().points), [[0, 0], [10, 0], [10, 10]]);
            assertSegments(r, 'smooth', 3);
        });
        it('getLastDrawnPoint・isOnLastDrawnPoint・canCloseDrawnLineは直線の作成途中の線と同じ規則', () => {
            const drawn = makeKindPath([[0, 0], [10, 0], [10, 10], [10, 10]], 'smooth');
            assert.deepEqual(getLastDrawnPoint(drawn), { x: 10, y: 10 });
            assert.equal(isOnLastDrawnPoint(drawn, 0.1), true);
            assert.equal(canCloseDrawnLine(drawn), true);
            const two = makeKindPath([[0, 0], [10, 0]], 'smooth');
            assert.equal(canCloseDrawnLine(two), false);
            assert.equal(isOnLastDrawnPoint(makeKindPath([[0, 0], [10, 0], [20, 0]], 'smooth'), 0.1), false);
        });
        it('引数を書き換えず、結果と頂点を共有しない', () => {
            const drawn = makeKindPath([[0, 0], [10, 0], [10, 10], [10, 10]], 'smooth');
            const before = JSON.stringify(drawn.toJSON());
            const results = [addDrawnPoint(drawn), removeLastDrawnPoint(drawn), buildFinishedDrawnLine(drawn), buildFinishedDrawnLine(drawn, true)];
            assert.equal(JSON.stringify(drawn.toJSON()), before);
            for (const r of results) r.translate(1000, 1000);
            assert.equal(JSON.stringify(drawn.toJSON()), before);
        });
        it('続けて引く線の形でない図形は受け付けない（addDrawnPointがnull）', () => {
            assert.equal(addDrawnPoint(makeKindPath(FOUR, 'smooth', true)), null);
            assert.equal(addDrawnPoint(new Rect(0, 0, 5, 5)), null);
        });
    });
});

/**
 * 区間の種類の並びを指定した開いたパスを作る（`Path`コンストラクタの種類の配列を使う）。
 * @param {number[][]} coords - [x, y] の並び
 * @param {string[]} kinds - 区間ごとの種類（頂点数`- 1`個）
 * @returns {Path} 開いたパス
 */
function makeKindsPath(coords, kinds) {
    return new Path(pts(coords), false, '#112233', 5, '#445566', kinds);
}

/**
 * パスの区間の種類の並びを返す（比較用）。
 * @param {Path} path - パス
 * @returns {string[]} 区間の種類の並び
 */
function kindsOf(path) {
    return path.toJSON().segments.map((s) => s.kind);
}

/**
 * 2つの制御点の座標が誤差内で一致するか確かめる。
 * @param {{x: number, y: number}} actual - 実際の点
 * @param {{x: number, y: number}} expected - 期待する点
 * @param {string} [message] - 失敗時のメッセージ
 * @returns {void}
 */
function assertNearPoint(actual, expected, message) {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-9 && Math.abs(actual.y - expected.y) < 1e-9, message);
}

describe('PathJoinRules 区間の種類を保つ組み立て（Phase 09-01b）', () => {
    const A_COORDS = [[0, 0], [10, 0], [10, 10]];
    const A_KINDS = ['line', 'smooth'];
    const B_KINDS = ['smooth', 'smooth', 'line'];
    const TOL = 0.1;

    describe('buildJoinedPath: 4通りの端点の組', () => {
        // 各組：離れているときのBの頂点／重なるときのBの頂点／結果の並べ方
        const cases = [
            {
                name: '(1) A＋B',
                gap: [[50, 50], [60, 50], [60, 60], [70, 60]],
                merge: [[10, 10], [20, 10], [20, 20], [30, 20]],
                order: (a, b, joint) => ({ points: a.points.concat(b.points.slice(joint ? 0 : 1)), kinds: a.kinds.concat(joint ? ['line'] : [], b.kinds) }),
            },
            {
                name: '(2) A＋逆順B',
                gap: [[70, 60], [60, 60], [60, 50], [50, 50]],
                merge: [[30, 20], [20, 20], [20, 10], [10, 10]],
                order: (a, b, joint) => {
                    const r = { points: b.points.slice().reverse(), kinds: b.kinds.slice().reverse() };
                    return { points: a.points.concat(r.points.slice(joint ? 0 : 1)), kinds: a.kinds.concat(joint ? ['line'] : [], r.kinds) };
                },
            },
            {
                name: '(3) B＋A',
                gap: [[-70, -60], [-60, -60], [-60, -50], [-50, -50]],
                merge: [[-30, -20], [-20, -20], [-10, -10], [0, 0]],
                order: (a, b, joint) => ({ points: b.points.slice(0, joint ? undefined : -1).concat(a.points), kinds: b.kinds.concat(joint ? ['line'] : [], a.kinds) }),
            },
            {
                name: '(4) 逆順B＋A',
                gap: [[-50, -50], [-60, -50], [-60, -60], [-70, -60]],
                merge: [[0, 0], [-10, -10], [-20, -20], [-30, -20]],
                order: (a, b, joint) => {
                    const r = { points: b.points.slice().reverse(), kinds: b.kinds.slice().reverse() };
                    return { points: r.points.slice(0, joint ? undefined : -1).concat(a.points), kinds: r.kinds.concat(joint ? ['line'] : [], a.kinds) };
                },
            },
        ];
        for (const c of cases) {
            for (const joint of [true, false]) {
                it(`${c.name}：端点が${joint ? '離れている（間を埋める区間は line）' : '重なる（間を埋める区間なし）'}`, () => {
                    const a = makeKindsPath(A_COORDS, A_KINDS);
                    const bCoords = joint ? c.gap : c.merge;
                    const b = makeKindsPath(bCoords, B_KINDS);
                    const result = buildJoinedPath(a, b, TOL);
                    const expected = c.order(
                        { points: pts(A_COORDS), kinds: A_KINDS },
                        { points: pts(bCoords), kinds: B_KINDS },
                        joint,
                    );
                    assert.deepEqual(coordsOf(result.toJSON().points), coordsOf(expected.points));
                    assert.deepEqual(kindsOf(result), expected.kinds);
                    assert.equal(result.toJSON().closed, false);
                });
            }
        }
    });

    describe('buildJoinedPathAt', () => {
        const a = () => makeKindsPath([[0, 0], [10, 0], [10, 10]], ['smooth', 'smooth']);
        it('第6引数を省くと間を埋める区間は line、smooth を渡すと smooth', () => {
            const b = makeKindsPath([[50, 50], [60, 50]], ['smooth']);
            assert.deepEqual(kindsOf(buildJoinedPathAt(a(), 'end', b, 'start', TOL)), ['smooth', 'smooth', 'line', 'smooth']);
            assert.deepEqual(kindsOf(buildJoinedPathAt(a(), 'end', b, 'start', TOL, 'smooth')), ['smooth', 'smooth', 'smooth', 'smooth']);
        });
        it('端点が重なるときは第6引数によらず間を埋める区間ができない', () => {
            const b = makeKindsPath([[10, 10], [20, 10]], ['smooth']);
            for (const gap of [undefined, 'line', 'smooth']) {
                const result = buildJoinedPathAt(a(), 'end', b, 'start', TOL, gap);
                assert.equal(result.toJSON().points.length, 4);
                assert.deepEqual(kindsOf(result), ['smooth', 'smooth', 'smooth']);
            }
        });
    });

    describe('buildClosedPath', () => {
        it('両端が離れた曲線のパス：閉じる区間は省くと line・smooth を渡すと smooth（元の区間はそのまま）', () => {
            const path = makeKindsPath([[0, 0], [10, 0], [10, 10], [0, 10]], ['line', 'smooth', 'smooth']);
            const byDefault = buildClosedPath(path, TOL);
            assert.equal(byDefault.toJSON().closed, true);
            assert.deepEqual(kindsOf(byDefault), ['line', 'smooth', 'smooth', 'line']);
            assert.deepEqual(kindsOf(buildClosedPath(path, TOL, 'smooth')), ['line', 'smooth', 'smooth', 'smooth']);
        });
        it('両端が重なるパスは最後の頂点を除き、区間の種類の並びは元のまま', () => {
            const mixed = makeKindsPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], ['line', 'smooth', 'line', 'smooth']);
            const closedMixed = buildClosedPath(mixed, TOL, 'line');
            assert.equal(closedMixed.toJSON().points.length, 4);
            assert.deepEqual(kindsOf(closedMixed), ['line', 'smooth', 'line', 'smooth']);
            const smooth = makeKindPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], 'smooth');
            assert.deepEqual(kindsOf(buildClosedPath(smooth, TOL)), ['smooth', 'smooth', 'smooth', 'smooth']);
        });
    });

    describe('buildExtendedPath', () => {
        const path = () => makeKindsPath([[0, 0], [10, 0], [10, 10]], ['line', 'smooth']);
        it('終点側：省くと足す区間は line・smooth を渡すと smooth（[...元, 足す]）', () => {
            assert.deepEqual(kindsOf(buildExtendedPath(path(), 'end', { x: 30, y: 30 }, TOL)), ['line', 'smooth', 'line']);
            assert.deepEqual(kindsOf(buildExtendedPath(path(), 'end', { x: 30, y: 30 }, TOL, 'smooth')), ['line', 'smooth', 'smooth']);
        });
        it('始点側：省くと足す区間は line・smooth を渡すと smooth（[足す, ...元]）', () => {
            assert.deepEqual(kindsOf(buildExtendedPath(path(), 'start', { x: -30, y: 0 }, TOL)), ['line', 'line', 'smooth']);
            assert.deepEqual(kindsOf(buildExtendedPath(path(), 'start', { x: -30, y: 0 }, TOL, 'smooth')), ['smooth', 'line', 'smooth']);
        });
        it('直線（Line）への描き足しは [line, 足す]', () => {
            const line = makeLine(0, 0, 10, 0);
            assert.deepEqual(kindsOf(buildExtendedPath(line, 'end', { x: 20, y: 5 }, TOL)), ['line', 'line']);
            assert.deepEqual(kindsOf(buildExtendedPath(line, 'end', { x: 20, y: 5 }, TOL, 'smooth')), ['line', 'smooth']);
        });
    });

    describe('planJoin', () => {
        it('曲線のパス1本の閉じる（両端が離れている）は閉じる区間 line・元のid', () => {
            const smooth = withId(makeKindPath([[0, 0], [10, 0], [10, 10], [0, 10]], 'smooth'), 'p1');
            const plan = planJoin([smooth], TOL);
            assert.equal(plan.targetId, 'p1');
            assert.equal(plan.keepId, true);
            assert.equal(plan.path.toJSON().closed, true);
            assert.deepEqual(kindsOf(plan.path), ['smooth', 'smooth', 'smooth', 'line']);
        });
        it('曲線のパスどうしの2本：離れていれば間を埋める区間 line・重なれば間を埋める区間なしで全区間 smooth', () => {
            const a = withId(makeKindPath([[0, 0], [10, 0], [20, 10]], 'smooth'), 'a');
            const far = withId(makeKindPath([[50, 50], [60, 50], [70, 60]], 'smooth'), 'b');
            const near = withId(makeKindPath([[20, 10], [30, 10], [40, 20]], 'smooth'), 'c');
            const farPlan = planJoin([a, far], TOL);
            assert.deepEqual(kindsOf(farPlan.path), ['smooth', 'smooth', 'line', 'smooth', 'smooth']);
            assert.deepEqual(farPlan.removeIds, ['b']);
            const nearPlan = planJoin([a, near], TOL);
            assert.deepEqual(kindsOf(nearPlan.path), ['smooth', 'smooth', 'smooth', 'smooth']);
            assert.equal(nearPlan.path.toJSON().points.length, 5);
        });
        it('頂点2つの曲線のパス1本は classifyJoin・planJoin ともに null', () => {
            const two = withId(makeKindPath([[0, 0], [10, 0]], 'smooth'), 'p2');
            assert.equal(classifyJoin([two]), null);
            assert.equal(planJoin([two], TOL), null);
        });
    });

    describe('直線・直線の区間だけのパスの結果は全区間 line', () => {
        it('buildJoinedPath・buildJoinedPathAt・buildClosedPath・buildExtendedPath', () => {
            const a = makeKindPath([[0, 0], [10, 0], [10, 10]], 'line');
            const b = makeLine(50, 50, 60, 50);
            assertAllLineSegments(buildJoinedPath(a, b, TOL), 4);
            assertAllLineSegments(buildJoinedPathAt(a, 'end', b, 'start', TOL), 4);
            assertAllLineSegments(buildClosedPath(a, TOL), 3);
            assertAllLineSegments(buildExtendedPath(a, 'end', { x: 30, y: 30 }, TOL), 3);
            assertAllLineSegments(buildExtendedPath(makeLine(0, 0, 10, 0), 'start', { x: -5, y: 0 }, TOL), 2);
        });
    });

    describe('形（区間ごとの制御点）', () => {
        const FOUR_SMOOTH = [[0, 0], [10, 5], [20, -5], [30, 0]];

        it('(a) 逆順でも形が変わらない：(2)の組ではBの部分がBの制御点を逆順・制御点入れ替えにしたもの、(1)の組ではBの制御点と一致', () => {
            const b = makeKindPath(FOUR_SMOOTH, 'smooth');
            const bSegments = b.toDrawElement().segments;
            // (2) Bを逆順：Aの終点（100, 0）とBの終点（30, 0）の距離が最小。Bの部分は結果の区間2〜4
            const lineA = makeLine(130, 0, 100, 0);
            const r2 = buildJoinedPath(lineA, b, TOL);
            const parts2 = r2.toDrawElement().segments.slice(2);
            const expected2 = bSegments.slice().reverse().map((seg) => ({ kind: seg.kind, control1: seg.control2, control2: seg.control1 }));
            assert.equal(parts2.length, 3);
            parts2.forEach((seg, i) => {
                assert.equal(seg.kind, 'cubic');
                assertNearPoint(seg.control1, expected2[i].control1, `2-c1-${i}`);
                assertNearPoint(seg.control2, expected2[i].control2, `2-c2-${i}`);
            });
            // (1) 逆順なし：Aの終点（-20, 0）とBの始点（0, 0）が最小
            const lineB = makeLine(-50, 0, -20, 0);
            const r1 = buildJoinedPath(lineB, b, TOL);
            const parts1 = r1.toDrawElement().segments.slice(2);
            parts1.forEach((seg, i) => {
                assert.equal(seg.kind, 'cubic');
                assertNearPoint(seg.control1, bSegments[i].control1, `1-c1-${i}`);
                assertNearPoint(seg.control2, bSegments[i].control2, `1-c2-${i}`);
            });
        });

        it('(b) つなぎ目で元の線の形が変わらない（曲線のパスへ line を描き足す）', () => {
            const original = makeKindPath(FOUR_SMOOTH, 'smooth');
            const extended = buildExtendedPath(original, 'end', { x: 50, y: 20 }, TOL, 'line');
            const before = original.toDrawElement().segments;
            const after = extended.toDrawElement().segments;
            before.forEach((seg, i) => {
                assertNearPoint(after[i].control1, seg.control1, `c1-${i}`);
                assertNearPoint(after[i].control2, seg.control2, `c2-${i}`);
            });
            assert.equal(after[3].kind, 'line');
        });

        it('(b) 直線の区間だけのパスへ smooth を描き足すと、元の区間は line のまま・足した区間は直線の1/3・2/3の点', () => {
            const original = makeKindPath([[0, 0], [10, 0], [10, 10]], 'line');
            const extended = buildExtendedPath(original, 'end', { x: 40, y: 40 }, TOL, 'smooth');
            const data = extended.toJSON();
            assert.deepEqual(data.segments.map((s) => s.kind), ['line', 'line', 'smooth']);
            assert.deepEqual(coordsOf(data.points.slice(0, 3)), [[0, 0], [10, 0], [10, 10]]);
            const last = extended.toDrawElement().segments[2];
            assert.equal(last.kind, 'cubic');
            assertNearPoint(last.control1, { x: 10 + 30 / 3, y: 10 + 30 / 3 }, 'c1');
            assertNearPoint(last.control2, { x: 10 + 60 / 3, y: 10 + 60 / 3 }, 'c2');
        });

        it('(c) 曲線の区間どうしがつながるとつなぎ目がなめらかになる', () => {
            const aCoords = [[0, 0], [10, 5], [20, -5], [30, 0]];
            const bCoords = [[30, 0], [40, 25], [50, -5], [60, 0]];
            const a = makeKindPath(aCoords, 'smooth');
            const b = makeKindPath(bCoords, 'smooth');
            const joined = buildJoinedPath(a, b, TOL);
            assert.deepEqual(kindsOf(joined), ['smooth', 'smooth', 'smooth', 'smooth', 'smooth', 'smooth']);
            assert.equal(joined.toJSON().points.length, 7);
            const aSeg = a.toDrawElement().segments;
            const jSeg = joined.toDrawElement().segments;
            const differs = (p, q) => Math.abs(p.x - q.x) > 1e-9 || Math.abs(p.y - q.y) > 1e-9;
            assert.ok(differs(jSeg[2].control1, aSeg[2].control1) || differs(jSeg[2].control2, aSeg[2].control2));
            for (const i of [0, 1]) {
                assertNearPoint(jSeg[i].control1, aSeg[i].control1, `c1-${i}`);
                assertNearPoint(jSeg[i].control2, aSeg[i].control2, `c2-${i}`);
            }
        });
    });

    describe('引数を書き換えず、結果と共有しない（曲線のパスの入力）', () => {
        it('toJSONが呼び出しの前後で変わらず、結果の頂点を動かしても元が変わらない', () => {
            const a = makeKindPath([[0, 0], [10, 0], [10, 10]], 'smooth');
            const b = makeKindPath([[50, 50], [60, 50], [70, 60]], 'smooth');
            const beforeA = JSON.stringify(a.toJSON());
            const beforeB = JSON.stringify(b.toJSON());
            const results = [
                buildJoinedPath(a, b, TOL), buildJoinedPathAt(a, 'end', b, 'start', TOL, 'smooth'),
                buildClosedPath(a, TOL), buildExtendedPath(a, 'end', { x: 30, y: 30 }, TOL, 'smooth'),
            ];
            assert.equal(JSON.stringify(a.toJSON()), beforeA);
            assert.equal(JSON.stringify(b.toJSON()), beforeB);
            for (const r of results) r.translate(1000, 1000);
            assert.equal(JSON.stringify(a.toJSON()), beforeA);
            assert.equal(JSON.stringify(b.toJSON()), beforeB);
        });
    });
});

describe('planDrawnLineJoin・planEndpointDragJoin の区間の種類（Phase 09-01b）', () => {
    const TOLERANCE = 1;

    /**
     * 曲線のツールの作成途中の線（全区間`'smooth'`の開いたパス）を作る。
     * @param {number[][]} coords - [x, y] の並び（2つ以上）
     * @returns {Path} 作成途中の線
     */
    function makeSmoothDrawn(coords) {
        return makeKindPath(coords, 'smooth');
    }

    /**
     * 全区間が`kind`の開いたパス（頂点は3つ以上。idつき）を作る。
     * @param {string} id - 付ける id
     * @param {number[][]} coords - [x, y] の並び（3つ以上）
     * @param {string} kind - 全区間の種類
     * @returns {Path} パス
     */
    function makeTarget(id, coords, kind) {
        return withId(makeKindPath(coords, kind), id);
    }

    it('曲線のツール：描き始めだけ吸い付くと、足した区間がすべて smooth で元の区間はそのまま・keepId', () => {
        const target = makeTarget('T', [[0, 0], [10, 0], [20, 0]], 'line');
        const drawn = makeSmoothDrawn([[20, 0], [30, 10], [40, 0], [50, 10]]);
        const plan = planDrawnLineJoin([target], drawn, ref('T', 'end'), null, TOLERANCE);
        assert.equal(plan.keepId, true);
        assert.equal(plan.targetId, 'T');
        assert.deepEqual(kindsOf(plan.path), ['line', 'line', 'smooth', 'smooth', 'smooth']);
    });

    it('曲線のツール：描き終えだけ吸い付くと、逆順に足した区間がすべて smooth', () => {
        const target = makeTarget('T', [[0, 0], [10, 0], [20, 0]], 'line');
        const drawn = makeSmoothDrawn([[50, 10], [40, 0], [30, 10], [20, 0]]);
        const plan = planDrawnLineJoin([target], drawn, null, ref('T', 'end'), TOLERANCE);
        assert.equal(plan.keepId, true);
        assert.deepEqual(kindsOf(plan.path), ['line', 'line', 'smooth', 'smooth', 'smooth']);
    });

    it('曲線のツール：同じ線の両端（途中の点なし）は閉じる区間が smooth', () => {
        const target = makeTarget('T', [[0, 0], [20, 0], [20, 20]], 'line');
        const drawn = makeSmoothDrawn([[0, 0], [20, 20]]);
        const plan = planDrawnLineJoin([target], drawn, ref('T', 'start'), ref('T', 'end'), TOLERANCE);
        assert.equal(plan.path.toJSON().closed, true);
        assert.equal(plan.keepId, true);
        assert.deepEqual(kindsOf(plan.path), ['line', 'line', 'smooth']);
    });

    it('曲線のツール：同じ線の両端（途中の点あり）は足した区間と閉じる区間が smooth', () => {
        const target = makeTarget('T', [[0, 0], [20, 0], [20, 20]], 'line');
        const drawn = makeSmoothDrawn([[0, 0], [-10, 10], [20, 20]]);
        const plan = planDrawnLineJoin([target], drawn, ref('T', 'start'), ref('T', 'end'), TOLERANCE);
        assert.equal(plan.path.toJSON().closed, true);
        assert.equal(plan.keepId, true);
        // 始点側へ足すため、足した区間が先頭、元の2区間、最後が閉じる区間
        assert.deepEqual(kindsOf(plan.path), ['smooth', 'line', 'line', 'smooth']);
    });

    it('曲線のツール：別の線の両端（途中の点なし・離れている）は間を埋める区間が smooth', () => {
        const a = makeTarget('A', [[0, 0], [10, 0], [20, 0]], 'line');
        const b = makeTarget('B', [[100, 0], [110, 0], [120, 0]], 'line');
        const drawn = makeSmoothDrawn([[20, 0], [100, 0]]);
        const plan = planDrawnLineJoin([a, b], drawn, ref('A', 'end'), ref('B', 'start'), TOLERANCE);
        assert.equal(plan.keepId, false);
        assert.deepEqual(plan.removeIds, ['B']);
        assert.deepEqual(kindsOf(plan.path), ['line', 'line', 'smooth', 'line', 'line']);
    });

    it('曲線のツール：別の線の両端（途中の点あり）は途中の区間と最後の間を埋める区間が smooth', () => {
        const a = makeTarget('A', [[0, 0], [10, 0], [20, 0]], 'line');
        const b = makeTarget('B', [[100, 0], [110, 0], [120, 0]], 'line');
        const drawn = makeSmoothDrawn([[20, 0], [50, 30], [100, 0]]);
        const plan = planDrawnLineJoin([a, b], drawn, ref('A', 'end'), ref('B', 'start'), TOLERANCE);
        assert.deepEqual(kindsOf(plan.path), ['line', 'line', 'smooth', 'smooth', 'line', 'line']);
    });

    it('直線のツール（Line）：相手が曲線のパスでも足す区間は line で、曲線のパスの区間はそのまま', () => {
        const target = makeTarget('T', [[0, 0], [10, 0], [20, 0]], 'smooth');
        const drawn = new Line(20, 0, 40, 0, '#112233', 5, '#445566');
        const plan = planDrawnLineJoin([target], drawn, ref('T', 'end'), null, TOLERANCE);
        assert.deepEqual(kindsOf(plan.path), ['smooth', 'smooth', 'line']);
    });

    it('直線のツール（直線の区間だけのパス）：曲線のパスどうしの結合で間を埋める区間は line', () => {
        const a = makeTarget('A', [[0, 0], [10, 0], [20, 0]], 'smooth');
        const b = makeTarget('B', [[100, 0], [110, 0], [120, 0]], 'smooth');
        const drawn = makeKindPath([[20, 0], [50, 30], [100, 0]], 'line');
        const plan = planDrawnLineJoin([a, b], drawn, ref('A', 'end'), ref('B', 'start'), TOLERANCE);
        assert.deepEqual(kindsOf(plan.path), ['smooth', 'smooth', 'line', 'line', 'smooth', 'smooth']);
    });

    it('第6引数 drawnKindSource：drawn が点2つの Line でも、作成途中の線の区間の種類（smooth）で描き足す', () => {
        const target = makeTarget('T', [[0, 0], [10, 0], [20, 0]], 'line');
        const drawn = new Line(20, 0, 40, 0, '#112233', 5, '#445566');
        const source = makeSmoothDrawn([[20, 0], [30, 10], [40, 0]]);
        const plan = planDrawnLineJoin([target], drawn, ref('T', 'end'), null, TOLERANCE, source);
        assert.deepEqual(kindsOf(plan.path), ['line', 'line', 'smooth']);
    });

    it('第6引数を省くと drawn（Line）から読み line', () => {
        const target = makeTarget('T', [[0, 0], [10, 0], [20, 0]], 'smooth');
        const drawn = new Line(20, 0, 40, 0, '#112233', 5, '#445566');
        const plan = planDrawnLineJoin([target], drawn, ref('T', 'end'), null, TOLERANCE);
        assert.deepEqual(kindsOf(plan.path), ['smooth', 'smooth', 'line']);
    });

    it('planEndpointDragJoin：両端が重なる曲線のパスを閉じると元の区間の種類を保つ', () => {
        const target = makeTarget('T', [[0, 0], [20, 0], [20, 20], [0, 0]], 'smooth');
        const plan = planEndpointDragJoin([target], ref('T', 'end'), ref('T', 'start'), TOLERANCE);
        assert.equal(plan.keepId, true);
        assert.deepEqual(kindsOf(plan.path), ['smooth', 'smooth', 'smooth']);
    });

    it('planEndpointDragJoin：端点が重なる曲線のパスどうしの結合は間を埋める区間なしで種類を保つ', () => {
        const a = makeTarget('A', [[0, 0], [10, 0], [20, 0]], 'smooth');
        const b = makeTarget('B', [[20, 0], [30, 0], [40, 0]], 'smooth');
        const plan = planEndpointDragJoin([a, b], ref('B', 'start'), ref('A', 'end'), TOLERANCE);
        assert.equal(plan.keepId, false);
        assert.deepEqual(kindsOf(plan.path), ['smooth', 'smooth', 'smooth', 'smooth']);
    });
});

/**
 * 区間の種類と角の点を指定したパスを作る（Phase 09-02a）。
 * @param {number[][]} coords - [x, y] の並び
 * @param {string[]} kinds - 区間ごとの種類
 * @param {number[]} cornerIdx - 角の点にする頂点の番号
 * @param {boolean} [closed=false] - 閉じたパスか
 * @returns {Path} パス
 */
function makeCornerPath(coords, kinds, cornerIdx, closed = false) {
    const corners = coords.map((_, i) => cornerIdx.includes(i));
    return new Path(pts(coords), closed, '#112233', 5, '#445566', kinds, corners);
}

/**
 * パスの頂点ごとの角の点かの並びを返す（`corners`のキーが無ければすべて偽）。
 * @param {Path} path - パス
 * @returns {boolean[]} 角の点かの並び
 */
function cornersOf(path) {
    const data = path.toJSON();
    return data.points.map((_, i) => Array.isArray(data.corners) && data.corners[i] === true);
}

describe('角の点を保つ（Phase 09-02a）', () => {
    const T = true;
    const F = false;
    const TOL = 0.1;
    const S4 = ['smooth', 'smooth', 'smooth', 'smooth'];
    const S3 = ['smooth', 'smooth', 'smooth'];
    const A_COORDS = [[0, 0], [10, 0], [20, 0], [30, 0], [40, 0]];

    it('buildJoinedPath：Aの途中の角の点・Bの途中の角の点が結果でも角（離れている）', () => {
        const a = makeCornerPath(A_COORDS, S4, [2]);
        const b = makeCornerPath([[60, 0], [70, 0], [80, 0], [90, 0]], S3, [1]);
        const path = buildJoinedPath(a, b, TOL);
        assert.deepEqual(cornersOf(path), [F, F, T, F, F, F, T, F, F]);
        assert.equal(path.points.length, path.corners.length);
    });

    it('buildJoinedPath：Bを逆順にする組では角の番号が逆順の位置へ移る', () => {
        const a = makeCornerPath(A_COORDS, S4, [2]);
        const b = makeCornerPath([[90, 0], [80, 0], [70, 0], [60, 0]], S3, [2]);
        const path = buildJoinedPath(a, b, TOL);
        assert.deepEqual(cornersOf(path), [F, F, T, F, F, F, T, F, F]);
    });

    it('buildJoinedPath：端点をまとめた点はなめらか、Bの端の点の角の情報は結果に残らない（重なる）', () => {
        const a = makeCornerPath(A_COORDS, S4, [2, 4]);
        const b = makeCornerPath([[40, 0], [50, 0], [60, 0], [70, 0]], S3, [0, 1]);
        const path = buildJoinedPath(a, b, TOL);
        assert.deepEqual(cornersOf(path), [F, F, T, F, F, T, F, F]);
    });

    it('buildJoinedPath：間を埋める区間の両端はなめらか（元の端の点に角の情報があっても）', () => {
        const a = makeCornerPath(A_COORDS, S4, [0, 4]);
        const b = makeCornerPath([[60, 0], [70, 0], [80, 0], [90, 0]], S3, [0, 3]);
        const path = buildJoinedPath(a, b, TOL);
        assert.deepEqual(cornersOf(path), [F, F, F, F, F, F, F, F, F]);
    });

    it('buildJoinedPath：Bの始点側へつなぐ組（B＋A）でも角の点が保たれる', () => {
        const a = makeCornerPath([[60, 0], [70, 0], [80, 0], [90, 0]], S3, [2]);
        const b = makeCornerPath(A_COORDS, S4, [1]);
        const path = buildJoinedPath(a, b, TOL);
        assert.deepEqual(cornersOf(path), [F, T, F, F, F, F, F, T, F]);
    });

    it('buildJoinedPathAt：端点を指定した結合でも角の点が保たれ、同じ端点どうしはBが逆順になる', () => {
        const a = makeCornerPath(A_COORDS, S4, [2]);
        const b = makeCornerPath([[60, 0], [70, 0], [80, 0], [90, 0]], S3, [1]);
        const path = buildJoinedPathAt(a, 'end', b, 'end', TOL);
        assert.deepEqual(cornersOf(path), [F, F, T, F, F, F, F, T, F]);
        const merged = buildJoinedPathAt(a, 'end', makeCornerPath([[40, 0], [50, 0], [60, 0], [70, 0]], S3, [1]), 'start', TOL);
        assert.deepEqual(cornersOf(merged), [F, F, T, F, F, T, F, F]);
    });

    it('buildClosedPath：重なるとき途中の角の点が残り、閉じたときの始点はなめらか', () => {
        const shape = makeCornerPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], S4, [0, 2]);
        const path = buildClosedPath(shape, TOL);
        assert.equal(path.closed, true);
        assert.deepEqual(cornersOf(path), [F, F, T, F]);
    });

    it('buildClosedPath：離れるとき途中の角の点が残り、間を埋める区間の両端はなめらか', () => {
        const shape = makeCornerPath([[0, 0], [10, 0], [10, 10], [0, 10]], ['smooth', 'smooth', 'smooth'], [0, 1, 3]);
        const path = buildClosedPath(shape, TOL);
        assert.deepEqual(cornersOf(path), [F, T, F, F]);
        assert.equal(path.points.length, path.corners.length);
    });

    it('buildExtendedPath：角の点が残り、足した点・元の端の点はなめらか', () => {
        const a = makeCornerPath(A_COORDS, S4, [2, 4]);
        assert.deepEqual(cornersOf(buildExtendedPath(a, 'end', { x: 60, y: 0 }, TOL)), [F, F, T, F, F, F]);
        assert.deepEqual(cornersOf(buildExtendedPath(a, 'start', { x: -20, y: 0 }, TOL)), [F, F, F, T, F, F]);
    });

    it('planDrawnLineJoin：描き足し・閉じる・つながるでも角の点が残る', () => {
        const t = withId(makeCornerPath(A_COORDS, S4, [2]), 'T');
        const extend = planDrawnLineJoin([t], new Line(40, 0, 60, 0, '#000000', 2, null), ref('T', 'end'), null, TOL);
        assert.deepEqual(cornersOf(extend.path), [F, F, T, F, F, F]);

        const close = planDrawnLineJoin([t], new Line(40, 0, 0, 0, '#000000', 2, null), ref('T', 'end'), ref('T', 'start'), TOL);
        assert.equal(close.path.closed, true);
        assert.deepEqual(cornersOf(close.path), [F, F, T, F, F]);

        const u = withId(makeCornerPath([[60, 0], [70, 0], [80, 0], [90, 0]], S3, [1]), 'U');
        const join = planDrawnLineJoin([t, u], new Line(40, 0, 60, 0, '#000000', 2, null), ref('T', 'end'), ref('U', 'start'), TOL);
        assert.deepEqual(cornersOf(join.path), [F, F, T, F, F, F, T, F, F]);
    });

    it('planEndpointDragJoin：閉じる・結合でも角の点が残る', () => {
        const t = withId(makeCornerPath([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]], S4, [2]), 'T');
        const close = planEndpointDragJoin([t], ref('T', 'end'), ref('T', 'start'), TOL);
        assert.deepEqual(cornersOf(close.path), [F, F, T, F]);

        const a = withId(makeCornerPath(A_COORDS, S4, [2]), 'A');
        const b = withId(makeCornerPath([[40, 0], [50, 0], [60, 0], [70, 0]], S3, [1]), 'B');
        const join = planEndpointDragJoin([a, b], ref('B', 'start'), ref('A', 'end'), TOL);
        assert.deepEqual(cornersOf(join.path), [F, F, T, F, F, T, F, F]);
    });

    it('角の点が無い入力の結果の toJSON() に corners が無い（今と同じ）', () => {
        const a = makeKindsPath(A_COORDS, ['line', 'smooth', 'smooth', 'line']);
        const b = makeKindsPath([[40, 0], [50, 0], [60, 0]], ['smooth', 'smooth']);
        assert.equal('corners' in buildJoinedPath(a, b, TOL).toJSON(), false);
        assert.equal('corners' in buildClosedPath(a, TOL).toJSON(), false);
        assert.equal('corners' in buildExtendedPath(a, 'end', { x: 60, y: 0 }, TOL).toJSON(), false);
        assert.equal('corners' in buildJoinedPath(makeLine(0, 0, 10, 0), makeLine(10, 0, 20, 0), TOL).toJSON(), false);
    });

    it('入力の図形を書き換えない', () => {
        const a = makeCornerPath(A_COORDS, S4, [2]);
        const before = JSON.stringify(a.toJSON());
        buildJoinedPath(a, makeCornerPath([[40, 0], [50, 0], [60, 0], [70, 0]], S3, [1]), TOL);
        buildClosedPath(a, TOL);
        buildExtendedPath(a, 'start', { x: -20, y: 0 }, TOL);
        assert.equal(JSON.stringify(a.toJSON()), before);
    });
});

describe('segmentKindsOf（Phase 09-02b で公開）', () => {
    it('直線の値は [line] になる', () => {
        assert.deepEqual(segmentKindsOf(new Line(0, 0, 10, 0).toJSON()), ['line']);
    });

    it('開いたパス・閉じたパスは segments の各 kind の新しい配列になる', () => {
        const open = new Path(pts([[0, 0], [10, 0], [20, 0]]), false, '#000000', 2, null, ['line', 'smooth']);
        const closed = new Path(pts([[0, 0], [10, 0], [10, 10]]), true, '#000000', 2, null, ['smooth', 'line', 'smooth']);
        const openData = open.toJSON();
        assert.deepEqual(segmentKindsOf(openData), ['line', 'smooth']);
        assert.deepEqual(segmentKindsOf(closed.toJSON()), ['smooth', 'line', 'smooth']);
        assert.notEqual(segmentKindsOf(openData), segmentKindsOf(openData));
    });

    it('引数を書き換えない', () => {
        const data = new Path(pts([[0, 0], [10, 0], [20, 0]]), false, '#000000', 2, null, ['line', 'smooth']).toJSON();
        const before = JSON.stringify(data);
        const result = segmentKindsOf(data);
        result[0] = 'x';
        assert.equal(JSON.stringify(data), before);
    });
});

/**
 * 今の曲線を作る（始点・制御点・終点）。
 * @param {number[]} start - 始点 [x, y]
 * @param {number[]} control - 制御点 [x, y]
 * @param {number[]} end - 終点 [x, y]
 * @param {string} [color='#000000'] - 線の色
 * @param {number} [width=2] - 線の太さ
 * @param {string|null} [fill=null] - 塗りの色
 * @returns {Curve} 今の曲線
 */
function makeCurve(start, control, end, color = '#000000', width = 2, fill = null) {
    const curve = new Curve(start[0], start[1], end[0], end[1], color, width, fill);
    curve.points[1] = { x: control[0], y: control[1] };
    return curve;
}

/**
 * 図形にidを付けて返す。
 * @param {Object} shape - 図形
 * @param {string} id - id
 * @returns {Object} 同じ図形
 */
function idOf(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * 曲がり方を持つ区間を含む開いたパスを作る。
 * @param {number[][]} coords - 頂点
 * @param {Array<string|Object>} specs - 区間の指定
 * @returns {Path} パス
 */
function makeSpecPath(coords, specs) {
    return new Path(pts(coords), false, '#000000', 2, null, specs);
}

describe('PathJoinRules 今の曲線の結合（Phase 09-03a）', () => {
    // 始点(0,0)・制御点(30,60)・終点(60,0)の2次は、control1 (20,40)・control2 (40,40)の3次に等しい
    const CURVE = () => makeCurve([0, 0], [30, 60], [60, 0]);
    const BEZ = { kind: 'bezier', control1: { x: 20, y: 40 }, control2: { x: 40, y: 40 } };
    const BEZ_REV = { kind: 'bezier', control1: { x: 40, y: 40 }, control2: { x: 20, y: 40 } };

    describe('結合できる線の判定', () => {
        it('isJoinableLineは今の曲線で真、isDrawnLineShapeは偽', () => {
            assert.equal(isJoinableLine(CURVE()), true);
            assert.equal(isDrawnLineShape(CURVE()), false);
        });

        it('classifyJoin：今の曲線と直線・開いたパス・今の曲線は join（順も問わない）', () => {
            const line = makeLine(60, 0, 100, 0);
            const straightPath = makePath([[60, 0], [70, 0], [80, 0]]);
            const smoothPath = makeKindPath([[60, 0], [70, 10], [80, 0], [90, 10]], 'smooth');
            for (const other of [line, straightPath, smoothPath, CURVE()]) {
                assert.equal(classifyJoin([CURVE(), other]), 'join');
                assert.equal(classifyJoin([other, CURVE()]), 'join');
            }
        });

        it('classifyJoin：今の曲線と矩形・閉じたパスは null、今の曲線1本は null', () => {
            assert.equal(classifyJoin([CURVE(), makeUnjoinable('rect')]), null);
            assert.equal(classifyJoin([CURVE(), makeUnjoinable('closedPath')]), null);
            assert.equal(classifyJoin([CURVE()]), null);
        });
    });

    describe('今の曲線の変換（形が誤差なく同じ）', () => {
        it('結合した結果の区間0は3次の引っ張る点で、すべてのtで元の2次と同じ点を通る', () => {
            const curve = CURVE();
            const result = buildJoinedPath(curve, makeLine(60, 0, 100, 0), 0);
            const seg = result.toJSON().segments[0];
            assert.deepEqual(seg, BEZ);
            const [p0, p1, p2] = curve.toJSON().points;
            for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                const q = quadraticBezierPoint(p0, p1, p2, t);
                const c = cubicBezierPoint(p0, seg.control1, seg.control2, p2, t);
                assert.ok(Math.abs(q.x - c.x) < 1e-9 && Math.abs(q.y - c.y) < 1e-9, `t=${t}`);
            }
        });
    });

    describe('planJoin／buildJoinedPath', () => {
        it('今の曲線＋直線（端点が重なる）：頂点3つ・区間 bezier, line', () => {
            const a = idOf(CURVE(), 'A');
            const b = idOf(makeLine(60, 0, 100, 0), 'B');
            const plan = planJoin([a, b], 0);
            const data = plan.path.toJSON();
            assert.deepEqual(coordsOf(data.points), [[0, 0], [60, 0], [100, 0]]);
            assert.deepEqual(data.segments, [BEZ, { kind: 'line' }]);
            assert.equal(plan.keepId, false);
            assert.equal(plan.targetId, 'A');
            assert.deepEqual(plan.removeIds, ['B']);
            assert.equal('corners' in data, false);
        });

        it('今の曲線＋直線（離れている）：間に直線の区間', () => {
            const result = buildJoinedPath(CURVE(), makeLine(70, 0, 100, 0), 0);
            const data = result.toJSON();
            assert.deepEqual(coordsOf(data.points), [[0, 0], [60, 0], [70, 0], [100, 0]]);
            assert.deepEqual(data.segments, [BEZ, { kind: 'line' }, { kind: 'line' }]);
        });

        it('直線＋今の曲線：Bの今の曲線を逆順にして引っ張る点を入れ替える（形は逆向きにたどって同じ）', () => {
            const result = buildJoinedPath(makeLine(100, 0, 60, 0), CURVE(), 0);
            const data = result.toJSON();
            assert.deepEqual(coordsOf(data.points), [[100, 0], [60, 0], [0, 0]]);
            assert.deepEqual(data.segments, [{ kind: 'line' }, BEZ_REV]);
            const [p0, p1, p2] = CURVE().toJSON().points;
            const seg = data.segments[1];
            for (const t of [0, 0.25, 0.5, 0.75, 1]) {
                const q = quadraticBezierPoint(p0, p1, p2, 1 - t);
                const c = cubicBezierPoint({ x: 60, y: 0 }, seg.control1, seg.control2, { x: 0, y: 0 }, t);
                assert.ok(Math.abs(q.x - c.x) < 1e-9 && Math.abs(q.y - c.y) < 1e-9, `t=${t}`);
            }
        });

        it('今の曲線＋開いたパス：打った点の曲線の区間が残り、今の曲線の区間は引っ張る点を保つ', () => {
            const smooth = makeKindPath([[60, 0], [80, 20], [100, 0], [120, 20]], 'smooth');
            const result = buildJoinedPath(CURVE(), smooth, 0);
            const data = result.toJSON();
            assert.deepEqual(data.segments.map((s) => s.kind), ['bezier', 'smooth', 'smooth', 'smooth']);
            const after = result.toDrawElement().segments;
            assert.equal(after.length, 4);
            assert.deepEqual(after[0].control1, BEZ.control1);
            assert.deepEqual(after[0].control2, BEZ.control2);
            const smoothBefore = smooth.toDrawElement().segments;
            for (let i = 0; i < smoothBefore.length; i++) {
                assert.deepEqual(after[i + 1].control1, smoothBefore[i].control1, `区間${i + 1} control1`);
                assert.deepEqual(after[i + 1].control2, smoothBefore[i].control2, `区間${i + 1} control2`);
            }
        });

        it('今の曲線＋開いた直線のパス：区間 bezier, line, line', () => {
            const straight = makePath([[60, 0], [80, 20], [100, 0]]);
            const result = buildJoinedPath(CURVE(), straight, 0);
            const data = result.toJSON();
            assert.deepEqual(coordsOf(data.points), [[0, 0], [60, 0], [80, 20], [100, 0]]);
            assert.deepEqual(data.segments, [BEZ, { kind: 'line' }, { kind: 'line' }]);
            const plan = planJoin([idOf(CURVE(), 'A'), idOf(makePath([[60, 0], [80, 20], [100, 0]]), 'B')], 0);
            assert.equal(plan.targetId, 'A');
            assert.deepEqual(plan.removeIds, ['B']);
        });

        it('今の曲線＋今の曲線：区間は bezier を2つ', () => {
            const b = makeCurve([60, 0], [90, -60], [120, 0]);
            const result = buildJoinedPath(CURVE(), b, 0);
            const data = result.toJSON();
            assert.deepEqual(coordsOf(data.points), [[0, 0], [60, 0], [120, 0]]);
            assert.deepEqual(data.segments.map((s) => s.kind), ['bezier', 'bezier']);
        });

        it('スタイルは基準の線Aのもの（今の曲線がAなら今の曲線のもの）', () => {
            const a = makeCurve([0, 0], [30, 60], [60, 0], '#aa0000', 7, '#a1a1a1');
            const b = makeLine(60, 0, 100, 0, '#00bb00', 3, '#b2b2b2');
            const d1 = buildJoinedPath(a, b, 0).toJSON();
            assert.equal(d1.strokeColor, '#aa0000');
            assert.equal(d1.strokeWidth, 7);
            assert.equal(d1.fillColor, '#a1a1a1');
            const d2 = buildJoinedPath(b, a, 0).toJSON();
            assert.equal(d2.strokeColor, '#00bb00');
            assert.equal(d2.strokeWidth, 3);
            assert.equal(d2.fillColor, '#b2b2b2');
        });

        it('引数を書き換えず、結果は引数と共有しない', () => {
            const a = CURVE();
            const b = makeLine(60, 0, 100, 0);
            const beforeA = JSON.stringify(a.toJSON());
            const beforeB = JSON.stringify(b.toJSON());
            const result = buildJoinedPath(a, b, 0);
            result.setVertex(0, 5, 5);
            assert.equal(JSON.stringify(a.toJSON()), beforeA);
            assert.equal(JSON.stringify(b.toJSON()), beforeB);
        });
    });

    describe('閉じる', () => {
        it('(a) 両端が離れている：閉じる区間に直線が足され、曲がり方を持つ区間はそのまま', () => {
            const path = makeSpecPath([[0, 0], [60, 0], [60, 60]], [BEZ, 'line']);
            const result = buildClosedPath(path, 0);
            const data = result.toJSON();
            assert.equal(data.closed, true);
            assert.deepEqual(data.segments, [BEZ, { kind: 'line' }, { kind: 'line' }]);
            assert.deepEqual(result.toDrawElement().segments[0].control1, BEZ.control1);
            assert.deepEqual(result.toDrawElement().segments[0].control2, BEZ.control2);
        });

        it('(b) 最後の区間が曲がり方を持つ区間で始点と終点が重なる：control2は元の値のまま', () => {
            const last = { kind: 'bezier', control1: { x: 10, y: 20 }, control2: { x: 5, y: 10 } };
            const path = makeSpecPath([[0, 0], [60, 0], [60, 60], [0, 0]], ['line', 'line', last]);
            const before = path.toDrawElement().segments[2];
            const planned = planJoin([idOf(path, 'P')], 0);
            const data = planned.path.toJSON();
            assert.equal(planned.keepId, true);
            assert.equal(data.points.length, 3);
            assert.deepEqual(data.segments[2], last);
            assert.deepEqual(planned.path.toDrawElement().segments[2].control1, before.control1);
            assert.deepEqual(planned.path.toDrawElement().segments[2].control2, before.control2);
        });
    });

    describe('buildJoinedPathAt・buildExtendedPath', () => {
        it('buildJoinedPathAt：今の曲線の終点側・始点側（向きを保つ）', () => {
            const end = buildJoinedPathAt(CURVE(), 'end', makeLine(60, 0, 100, 0), 'start', 0).toJSON();
            assert.deepEqual(end.segments, [BEZ, { kind: 'line' }]);
            const start = buildJoinedPathAt(CURVE(), 'start', makeLine(-40, 0, 0, 0), 'end', 0).toJSON();
            assert.deepEqual(coordsOf(start.points), [[-40, 0], [0, 0], [60, 0]]);
            assert.deepEqual(start.segments, [{ kind: 'line' }, BEZ]);
        });

        it('buildExtendedPath：今の曲線の終点側・始点側に描き足す。端点と重なれば null', () => {
            const e = buildExtendedPath(CURVE(), 'end', { x: 60, y: 40 }, 1).toJSON();
            assert.deepEqual(coordsOf(e.points), [[0, 0], [60, 0], [60, 40]]);
            assert.deepEqual(e.segments, [BEZ, { kind: 'line' }]);
            const s = buildExtendedPath(CURVE(), 'start', { x: -40, y: 0 }, 1).toJSON();
            assert.deepEqual(s.segments, [{ kind: 'line' }, BEZ]);
            assert.equal(buildExtendedPath(CURVE(), 'end', { x: 60, y: 0 }, 1), null);
        });
    });

    describe('planDrawnLineJoin', () => {
        const TOL = 1;
        it('描き始めだけ今の曲線の端点：今の曲線のidを保ち、足した区間は描いた区間の種類', () => {
            const curve = idOf(CURVE(), 'C');
            const drawnLine = makeLine(60, 0, 60, 40);
            const plan = planDrawnLineJoin([curve], drawnLine, ref('C', 'end'), null, TOL);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'C');
            assert.deepEqual(plan.path.toJSON().segments, [BEZ, { kind: 'line' }]);
            const drawnSmooth = makeKindPath([[60, 0], [60, 40]], 'smooth');
            const plan2 = planDrawnLineJoin([curve], drawnLine, ref('C', 'end'), null, TOL, drawnSmooth);
            assert.deepEqual(plan2.path.toJSON().segments, [BEZ, { kind: 'smooth' }]);
        });

        it('描き終えだけ今の曲線の端点', () => {
            const curve = idOf(CURVE(), 'C');
            const drawnLine = makeLine(0, 40, 0, 0);
            const plan = planDrawnLineJoin([curve], drawnLine, null, ref('C', 'start'), TOL);
            assert.equal(plan.keepId, true);
            assert.deepEqual(plan.path.toJSON().segments, [{ kind: 'line' }, BEZ]);
        });

        it('今の曲線の始点から引き始め途中の点を打って終点で終える：閉じたパス', () => {
            const curve = idOf(CURVE(), 'C');
            const drawn = makeKindPath([[0, 0], [30, -40], [60, 0]], 'line');
            const plan = planDrawnLineJoin([curve], drawn, ref('C', 'start'), ref('C', 'end'), TOL);
            const data = plan.path.toJSON();
            assert.equal(data.closed, true);
            assert.ok(data.points.length >= 3);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'C');
            assert.equal(plan.path.isFillable(), true);
        });

        it('途中の点なしで同じ今の曲線の両端は null', () => {
            const curve = idOf(CURVE(), 'C');
            const drawn = makeLine(0, 0, 60, 0);
            assert.equal(planDrawnLineJoin([curve], drawn, ref('C', 'start'), ref('C', 'end'), TOL), null);
        });

        it('今の曲線と直線の端点の間は結合', () => {
            const curve = idOf(CURVE(), 'C');
            const line = idOf(makeLine(100, 0, 140, 0), 'L');
            const drawn = makeLine(60, 0, 100, 0);
            const plan = planDrawnLineJoin([curve, line], drawn, ref('C', 'end'), ref('L', 'start'), TOL);
            assert.equal(plan.keepId, false);
            assert.deepEqual(plan.path.toJSON().segments.map((s) => s.kind), ['bezier', 'line', 'line']);
        });
    });

    describe('planEndpointDragJoin', () => {
        it('今の曲線の終点を直線の始点へ（同じ座標）：結合（形は元のまま）', () => {
            const curve = idOf(CURVE(), 'C');
            const line = idOf(makeLine(60, 0, 100, 0), 'L');
            const plan = planEndpointDragJoin([curve, line], ref('C', 'end'), ref('L', 'start'), 1);
            assert.deepEqual(plan.path.toJSON().segments, [BEZ, { kind: 'line' }]);
        });

        it('直線の終点を今の曲線の始点へ：結合', () => {
            const line = idOf(makeLine(-40, 0, 0, 0), 'L');
            const curve = idOf(CURVE(), 'C');
            const plan = planEndpointDragJoin([line, curve], ref('L', 'end'), ref('C', 'start'), 1);
            assert.deepEqual(plan.path.toJSON().segments, [{ kind: 'line' }, BEZ]);
        });

        it('今の曲線の自分のもう一方の端点は null', () => {
            const curve = idOf(CURVE(), 'C');
            assert.equal(planEndpointDragJoin([curve], ref('C', 'start'), ref('C', 'end'), 1), null);
        });
    });

    describe('segmentSpecsOf', () => {
        it('直線は [line]', () => {
            assert.deepEqual(segmentSpecsOf(makeLine(0, 0, 10, 0).toJSON()), ['line']);
        });

        it('パスは segments の各要素（引っ張る点を含む）の新しい配列。引数を書き換えない', () => {
            const data = makeSpecPath([[0, 0], [60, 0], [100, 0]], [BEZ, 'line']).toJSON();
            const before = JSON.stringify(data);
            const result = segmentSpecsOf(data);
            assert.deepEqual(result, [BEZ, { kind: 'line' }]);
            assert.notEqual(result, data.segments);
            result[0] = 'x';
            assert.equal(JSON.stringify(data), before);
        });
    });
});

/**
 * 弧の結合のテストで使う、楕円の4分の1を3次ベジェ1つで表す係数（ソースの非公開の定数と同じ式をここに書く）。
 * @type {number}
 */
const ARC_K = 4 * (Math.SQRT2 - 1) / 3;

/**
 * 共通の弧を作る（中心(100,200)・横の半径60・縦の半径30。左端L(40,200)・頂上T(100,170)・右端R(160,200)）。
 * @param {string|null} [color='#000000'] - 線の色
 * @param {number} [width=2] - 線の太さ
 * @param {string|null} [fill=null] - 塗りの色
 * @returns {Ellipse} 弧
 */
function makeArc(color = '#000000', width = 2, fill = null) {
    return new Ellipse(100, 200, 160, 230, 'arc', color, width, fill);
}

/**
 * 共通の弧を結合したときの2つの曲がり方を持つ区間（`'bezier'`）の期待値を返す。
 * @returns {{kind: string, control1: {x: number, y: number}, control2: {x: number, y: number}}[]} 区間0（左端→頂上）と区間1（頂上→右端）
 */
function arcBeziers() {
    return [
        { kind: 'bezier', control1: { x: 40, y: 200 - 30 * ARC_K }, control2: { x: 100 - 60 * ARC_K, y: 170 } },
        { kind: 'bezier', control1: { x: 100 + 60 * ARC_K, y: 170 }, control2: { x: 160, y: 200 - 30 * ARC_K } },
    ];
}

/**
 * 区間の指定が期待どおり（種類と、あれば引っ張る点が1e-9以内で一致）か確かめる。
 * @param {Object[]} actual - 実際の区間の並び
 * @param {Object[]} expected - 期待する区間の並び
 * @returns {void}
 */
function assertSegmentsNear(actual, expected) {
    assert.equal(actual.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
        assert.equal(actual[i].kind, expected[i].kind, `区間${i}の種類`);
        if (expected[i].kind === 'bezier') {
            assertNearPoint(actual[i].control1, expected[i].control1, `区間${i} control1`);
            assertNearPoint(actual[i].control2, expected[i].control2, `区間${i} control2`);
        }
    }
}

/**
 * 結合した結果の先頭2区間（弧の部分）の上の点がすべて元の楕円の上（半径で割った距離が1から3e-4以内）かつ上半分にあるか確かめる。
 * @param {Object} data - 結合した結果の図形データ（先頭3頂点・先頭2区間が弧の部分）
 * @param {number} xc - 中心x
 * @param {number} yc - 中心y
 * @param {number} rx - 横の半径
 * @param {number} ry - 縦の半径
 * @returns {void}
 */
function assertArcPartOnEllipse(data, xc, yc, rx, ry) {
    for (let i = 0; i < 2; i++) {
        const seg = data.segments[i];
        assert.equal(seg.kind, 'bezier');
        for (let step = 0; step <= 20; step++) {
            const t = step / 20;
            const q = cubicBezierPoint(data.points[i], seg.control1, seg.control2, data.points[i + 1], t);
            const d = Math.hypot((q.x - xc) / rx, (q.y - yc) / ry);
            assert.ok(Math.abs(d - 1) <= 3e-4, `区間${i} t=${t} のずれ ${d}`);
            assert.ok(q.y <= yc + 1e-9, `区間${i} t=${t} は上半分`);
        }
    }
}

/**
 * 結合した結果の先頭2区間（縮んだ弧の部分）の上の点が有限で、指定の条件を満たすか確かめる。
 * @param {Object} data - 結合した結果の図形データ
 * @param {function({x: number, y: number}): boolean} onShape - 縮んだ形の上にあるかの判定
 * @returns {void}
 */
function assertDegenerateArcPart(data, onShape) {
    assert.deepEqual(data.segments.slice(0, 2).map((s) => s.kind), ['bezier', 'bezier']);
    for (let i = 0; i < 2; i++) {
        const seg = data.segments[i];
        for (let step = 0; step <= 10; step++) {
            const q = cubicBezierPoint(data.points[i], seg.control1, seg.control2, data.points[i + 1], step / 10);
            assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), 'NaNを含まない');
            assert.ok(onShape(q), `区間${i} step=${step} (${q.x}, ${q.y})`);
        }
    }
}

describe('PathJoinRules 弧の結合（Phase 09-03b）', () => {
    const L = [40, 200];
    const T = [100, 170];
    const R = [160, 200];

    describe('結合できる線の判定', () => {
        it('isJoinableLineは弧で真、isDrawnLineShapeは偽、円は偽', () => {
            assert.equal(isJoinableLine(makeArc()), true);
            assert.equal(isDrawnLineShape(makeArc()), false);
            assert.equal(isJoinableLine(makeUnjoinable('circle')), false);
        });

        it('classifyJoin：弧と直線・開いたパス・今の曲線・別の弧は join（順も問わない）', () => {
            const others = [
                makeLine(160, 200, 200, 200),
                makePath([[160, 200], [180, 220], [200, 200]]),
                makeKindPath([[160, 200], [180, 180], [200, 200], [220, 180]], 'smooth'),
                makeCurve([160, 200], [190, 160], [220, 200]),
                new Ellipse(220, 200, 280, 230, 'arc'),
            ];
            for (const other of others) {
                assert.equal(classifyJoin([makeArc(), other]), 'join');
                assert.equal(classifyJoin([other, makeArc()]), 'join');
            }
        });

        it('classifyJoin：弧と円・矩形・閉じたパスは null、弧1本は null', () => {
            for (const kind of ['circle', 'rect', 'closedPath']) {
                assert.equal(classifyJoin([makeArc(), makeUnjoinable(kind)]), null);
                assert.equal(classifyJoin([makeUnjoinable(kind), makeArc()]), null);
            }
            assert.equal(classifyJoin([makeArc()]), null);
        });

        it('作成途中の線の関数は弧を受け付けない', () => {
            assert.equal(addDrawnPoint(makeArc()), null);
            assert.equal(buildFinishedDrawnLine(makeArc()), null);
            assert.equal(canCloseDrawnLine(makeArc()), false);
        });
    });

    describe('弧の変換（形のずれは半径の約0.03%以内）', () => {
        it('buildJoinedPath(弧, 直線)：頂点[L,T,R,直線の先]・区間[bezier2つ, line]・corners無し', () => {
            const result = buildJoinedPath(makeArc(), makeLine(160, 200, 200, 200), 0);
            const data = result.toJSON();
            assert.deepEqual(coordsOf(data.points), [L, T, R, [200, 200]]);
            assertSegmentsNear(data.segments, [...arcBeziers(), { kind: 'line' }]);
            assert.equal('corners' in data, false);
        });

        it('区間の上の点が楕円の上（上半分）にあり、両端と頂上は弧の上にちょうど乗る', () => {
            const data = buildJoinedPath(makeArc(), makeLine(160, 200, 200, 200), 0).toJSON();
            assertArcPartOnEllipse(data, 100, 200, 60, 30);
            assert.deepEqual(coordsOf(data.points).slice(0, 3), [L, T, R]);
        });

        it('接線の向き：左端・右端は縦、頂上は横', () => {
            const segs = buildJoinedPath(makeArc(), makeLine(160, 200, 200, 200), 0).toJSON().segments;
            assert.equal(segs[0].control1.x, 40);
            assert.equal(segs[0].control2.y, 170);
            assert.equal(segs[1].control1.y, 170);
            assert.equal(segs[1].control2.x, 160);
        });

        it('横と縦の半径が同じ弧（円の上半分）でも同じ許容量', () => {
            const arc = new Ellipse(100, 200, 150, 250, 'arc');
            const data = buildJoinedPath(arc, makeLine(150, 200, 200, 200), 0).toJSON();
            assert.deepEqual(coordsOf(data.points).slice(0, 3), [[50, 200], [100, 150], [150, 200]]);
            assertArcPartOnEllipse(data, 100, 200, 50, 50);
        });

        it('半径0の弧（点）も直線と結合でき、縮んだ形（NaNなし）になる', () => {
            const arc = new Ellipse(10, 10, 10, 10, 'arc');
            const data = buildJoinedPath(arc, makeLine(10, 10, 50, 10), 0).toJSON();
            assert.deepEqual(coordsOf(data.points).slice(0, 3), [[10, 10], [10, 10], [10, 10]]);
            assertDegenerateArcPart(data, (q) => Math.abs(q.x - 10) < 1e-9 && Math.abs(q.y - 10) < 1e-9);
        });

        it('半径0の弧（横の半径0・縦の半径20の線分）も直線と結合でき、線分の上に乗る', () => {
            const arc = new Ellipse(10, 30, 10, 10, 'arc');
            const data = buildJoinedPath(arc, makeLine(10, 30, 50, 30), 0).toJSON();
            assert.deepEqual(coordsOf(data.points).slice(0, 3), [[10, 30], [10, 10], [10, 30]]);
            assertDegenerateArcPart(data, (q) => Math.abs(q.x - 10) < 1e-9 && q.y >= 10 - 1e-9 && q.y <= 30 + 1e-9);
        });
    });

    describe('planJoin／buildJoinedPath', () => {
        it('弧＋直線（端点が重なる）：頂点4つ・区間 bezier, bezier, line。idの扱い', () => {
            const plan = planJoin([withId(makeArc(), 'A'), withId(makeLine(160, 200, 200, 200), 'B')], 0);
            const data = plan.path.toJSON();
            assert.deepEqual(coordsOf(data.points), [L, T, R, [200, 200]]);
            assertSegmentsNear(data.segments, [...arcBeziers(), { kind: 'line' }]);
            assert.equal(plan.keepId, false);
            assert.equal(plan.targetId, 'A');
            assert.deepEqual(plan.removeIds, ['B']);
        });

        it('弧＋直線（離れている）：間に直線の区間', () => {
            const data = buildJoinedPath(makeArc(), makeLine(170, 200, 200, 200), 0).toJSON();
            assert.deepEqual(coordsOf(data.points), [L, T, R, [170, 200], [200, 200]]);
            assertSegmentsNear(data.segments, [...arcBeziers(), { kind: 'line' }, { kind: 'line' }]);
        });

        it('直線＋弧：Bの弧を逆順にして区間は[line, B1の逆, B0の逆]（引っ張る点を入れ替える）', () => {
            const data = buildJoinedPath(makeLine(200, 200, 160, 200), makeArc(), 0).toJSON();
            assert.deepEqual(coordsOf(data.points), [[200, 200], R, T, L]);
            const [b0, b1] = arcBeziers();
            assertSegmentsNear(data.segments, [
                { kind: 'line' },
                { kind: 'bezier', control1: b1.control2, control2: b1.control1 },
                { kind: 'bezier', control1: b0.control2, control2: b0.control1 },
            ]);
        });

        it('弧＋直線の開いたパス：頂点5つ・区間 bezier, bezier, line, line', () => {
            const data = buildJoinedPath(makeArc(), makePath([[160, 200], [180, 220], [200, 200]]), 0).toJSON();
            assert.deepEqual(coordsOf(data.points), [L, T, R, [180, 220], [200, 200]]);
            assertSegmentsNear(data.segments, [...arcBeziers(), { kind: 'line' }, { kind: 'line' }]);
        });

        it('弧＋曲線の開いたパス：曲線の区間を保つ', () => {
            const smooth = makeKindPath([[160, 200], [180, 180], [200, 200], [220, 180]], 'smooth');
            const data = buildJoinedPath(makeArc(), smooth, 0).toJSON();
            assert.deepEqual(data.segments.map((s) => s.kind), ['bezier', 'bezier', 'smooth', 'smooth', 'smooth']);
            assert.equal(data.points.length, 6);
        });

        it('弧＋今の曲線：区間 bezier が3つ', () => {
            const data = buildJoinedPath(makeArc(), makeCurve([160, 200], [190, 160], [220, 200]), 0).toJSON();
            assert.deepEqual(coordsOf(data.points), [L, T, R, [220, 200]]);
            assert.deepEqual(data.segments.map((s) => s.kind), ['bezier', 'bezier', 'bezier']);
        });

        it('弧＋別の弧：頂点5つ・bezier 4つ', () => {
            const data = buildJoinedPath(makeArc(), new Ellipse(220, 200, 280, 230, 'arc'), 0).toJSON();
            assert.deepEqual(coordsOf(data.points), [L, T, R, [220, 170], [280, 200]]);
            assert.deepEqual(data.segments.map((s) => s.kind), ['bezier', 'bezier', 'bezier', 'bezier']);
        });

        it('スタイルは基準の線Aのもの（弧がAなら弧の線の色・太さ・塗り。直線がAなら直線のもの）', () => {
            const arc = makeArc('#aa0000', 7, '#a1a1a1');
            const line = makeLine(160, 200, 200, 200, '#00bb00', 3, '#b2b2b2');
            const d1 = buildJoinedPath(arc, line, 0).toJSON();
            assert.equal(d1.strokeColor, '#aa0000');
            assert.equal(d1.strokeWidth, 7);
            assert.equal(d1.fillColor, '#a1a1a1');
            const line2 = makeLine(200, 200, 160, 200, '#00bb00', 3, '#b2b2b2');
            const d2 = buildJoinedPath(line2, arc, 0).toJSON();
            assert.equal(d2.strokeColor, '#00bb00');
            assert.equal(d2.strokeWidth, 3);
            assert.equal(d2.fillColor, '#b2b2b2');
        });

        it('引数（弧のtoJSON）を書き換えず、結果は引数と頂点を共有しない', () => {
            const arc = makeArc();
            const line = makeLine(160, 200, 200, 200);
            const beforeArc = JSON.stringify(arc.toJSON());
            const beforeLine = JSON.stringify(line.toJSON());
            const result = buildJoinedPath(arc, line, 0);
            result.setVertex(0, 5, 5);
            result.translate(10, 10);
            assert.equal(JSON.stringify(arc.toJSON()), beforeArc);
            assert.equal(JSON.stringify(line.toJSON()), beforeLine);
        });
    });

    describe('閉じる（半月形）', () => {
        it('弧と直線(R→L)を結合し、もう一度結合すると頂点3つの閉じた塗れるパスになる', () => {
            const arc = withId(makeArc('#112233', 3, '#ff0000'), 'A');
            const line = withId(makeLine(160, 200, 40, 200), 'B');
            const first = planJoin([arc, line], 0);
            const open = first.path.toJSON();
            assert.deepEqual(coordsOf(open.points), [L, T, R, L]);
            assertSegmentsNear(open.segments, [...arcBeziers(), { kind: 'line' }]);
            first.path.id = 'P';
            const second = planJoin([first.path], 5);
            const closed = second.path.toJSON();
            assert.equal(second.keepId, true);
            assert.equal(closed.closed, true);
            assert.deepEqual(coordsOf(closed.points), [L, T, R]);
            assertSegmentsNear(closed.segments, [...arcBeziers(), { kind: 'line' }]);
            assert.equal(second.path.isFillable(), true);
            assert.equal(second.path.hitTestFill(100, 190), true);
        });

        it('弧1本は buildClosedPath が null、planJoin も null', () => {
            assert.equal(buildClosedPath(makeArc(), 0), null);
            assert.equal(planJoin([withId(makeArc(), 'A')], 0), null);
        });
    });

    describe('buildJoinedPathAt・buildExtendedPath', () => {
        it('buildJoinedPathAt：弧の終点側・始点側（向きを保つ）', () => {
            const end = buildJoinedPathAt(makeArc(), 'end', makeLine(160, 200, 200, 200), 'start', 0).toJSON();
            assert.deepEqual(coordsOf(end.points), [L, T, R, [200, 200]]);
            assertSegmentsNear(end.segments, [...arcBeziers(), { kind: 'line' }]);
            const start = buildJoinedPathAt(makeArc(), 'start', makeLine(0, 200, 40, 200), 'end', 0).toJSON();
            assert.deepEqual(coordsOf(start.points), [[0, 200], L, T, R]);
            assertSegmentsNear(start.segments, [{ kind: 'line' }, ...arcBeziers()]);
        });

        it('buildExtendedPath：弧の終点側・始点側に描き足す。区間の種類は引数のもの。端点と重なれば null', () => {
            const e = buildExtendedPath(makeArc(), 'end', { x: 160, y: 240 }, 1).toJSON();
            assert.deepEqual(coordsOf(e.points), [L, T, R, [160, 240]]);
            assertSegmentsNear(e.segments, [...arcBeziers(), { kind: 'line' }]);
            const s = buildExtendedPath(makeArc(), 'start', { x: 40, y: 240 }, 1).toJSON();
            assert.deepEqual(coordsOf(s.points), [[40, 240], L, T, R]);
            assertSegmentsNear(s.segments, [{ kind: 'line' }, ...arcBeziers()]);
            const k = buildExtendedPath(makeArc(), 'end', { x: 160, y: 240 }, 1, 'smooth').toJSON();
            assert.deepEqual(k.segments.map((seg) => seg.kind), ['bezier', 'bezier', 'smooth']);
            assert.equal(buildExtendedPath(makeArc(), 'end', { x: 160, y: 200 }, 1), null);
            assert.equal(buildExtendedPath(makeArc(), 'start', { x: 40, y: 200 }, 1), null);
        });
    });

    describe('planDrawnLineJoin', () => {
        const TOL = 1;

        it('描き始めだけ弧の端点：弧のidを保ち、足した区間は描いた区間の種類', () => {
            const arc = withId(makeArc(), 'A');
            const drawn = makeLine(160, 200, 160, 240);
            const plan = planDrawnLineJoin([arc], drawn, ref('A', 'end'), null, TOL);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'A');
            assertSegmentsNear(plan.path.toJSON().segments, [...arcBeziers(), { kind: 'line' }]);
            const drawnSmooth = makeKindPath([[160, 200], [160, 240]], 'smooth');
            const plan2 = planDrawnLineJoin([arc], drawn, ref('A', 'end'), null, TOL, drawnSmooth);
            assert.deepEqual(plan2.path.toJSON().segments.map((s) => s.kind), ['bezier', 'bezier', 'smooth']);
        });

        it('描き終えだけ弧の端点', () => {
            const arc = withId(makeArc(), 'A');
            const drawn = makeLine(40, 240, 40, 200);
            const plan = planDrawnLineJoin([arc], drawn, null, ref('A', 'start'), TOL);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'A');
            assert.deepEqual(coordsOf(plan.path.toJSON().points), [[40, 240], L, T, R]);
            assertSegmentsNear(plan.path.toJSON().segments, [{ kind: 'line' }, ...arcBeziers()]);
        });

        it('同じ弧の両端で途中の点なしは null', () => {
            const arc = withId(makeArc(), 'A');
            const drawn = makeLine(40, 200, 160, 200);
            assert.equal(planDrawnLineJoin([arc], drawn, ref('A', 'start'), ref('A', 'end'), TOL), null);
        });

        it('途中の点ありで同じ弧の両端：閉じたパス（弧のid）', () => {
            const arc = withId(makeArc(), 'A');
            const drawn = makeKindPath([[40, 200], [100, 260], [160, 200]], 'line');
            const plan = planDrawnLineJoin([arc], drawn, ref('A', 'start'), ref('A', 'end'), TOL);
            const data = plan.path.toJSON();
            assert.equal(data.closed, true);
            assert.equal(plan.keepId, true);
            assert.equal(plan.targetId, 'A');
            assert.equal(plan.path.isFillable(), true);
        });

        it('弧の端と直線の端の間は結合', () => {
            const arc = withId(makeArc(), 'A');
            const line = withId(makeLine(200, 200, 240, 200), 'B');
            const drawn = makeLine(160, 200, 200, 200);
            const plan = planDrawnLineJoin([arc, line], drawn, ref('A', 'end'), ref('B', 'start'), TOL);
            assert.equal(plan.keepId, false);
            assert.deepEqual(plan.path.toJSON().segments.map((s) => s.kind), ['bezier', 'bezier', 'line', 'line']);
        });
    });

    describe('planEndpointDragJoin', () => {
        it('直線の終点を弧の始点Lへ（同じ座標）：結合。弧が奥でも手前でも頂点の並びは同じ', () => {
            const line = withId(makeLine(0, 200, 40, 200), 'N');
            const arc = withId(makeArc(), 'A');
            for (const shapes of [[arc, line], [line, arc]]) {
                const plan = planEndpointDragJoin(shapes, ref('N', 'end'), ref('A', 'start'), 1);
                const data = plan.path.toJSON();
                assert.deepEqual(coordsOf(data.points), [[0, 200], L, T, R]);
                assertSegmentsNear(data.segments, [{ kind: 'line' }, ...arcBeziers()]);
            }
        });

        it('弧のもう一方の端点への自分のドラッグは null（弧1本は閉じない）', () => {
            const arc = withId(makeArc(), 'A');
            assert.equal(planEndpointDragJoin([arc], ref('A', 'start'), ref('A', 'end'), 1), null);
            assert.equal(planEndpointDragJoin([arc], ref('A', 'end'), ref('A', 'start'), 1), null);
        });
    });

    describe('結合した後の頂点の操作（Path の公開API）', () => {
        const joined = () => buildJoinedPath(makeArc(), makeLine(160, 200, 200, 200), 0);

        it('頂上を動かすと両側の引っ張る点が同じ差だけ動き、頂上でなめらかなまま', () => {
            const path = joined();
            const before = arcBeziers();
            path.setVertex(1, 105, 163);
            const segs = path.toJSON().segments;
            assertNearPoint(segs[0].control1, before[0].control1);
            assertNearPoint(segs[0].control2, { x: before[0].control2.x + 5, y: before[0].control2.y - 7 });
            assertNearPoint(segs[1].control1, { x: before[1].control1.x + 5, y: before[1].control1.y - 7 });
            assertNearPoint(segs[1].control2, before[1].control2);
            assert.equal(segs[0].control2.y, 163);
            assert.equal(segs[1].control1.y, 163);
            assert.equal(segs[2].kind, 'line');
        });

        it('左端を動かすと区間0の control1 だけが動く', () => {
            const path = joined();
            const before = arcBeziers();
            path.setVertex(0, 45, 205);
            const segs = path.toJSON().segments;
            assertNearPoint(segs[0].control1, { x: before[0].control1.x + 5, y: before[0].control1.y + 5 });
            assertNearPoint(segs[0].control2, before[0].control2);
            assertNearPoint(segs[1].control1, before[1].control1);
            assertNearPoint(segs[1].control2, before[1].control2);
        });

        it('translate ですべての引っ張る点が動く', () => {
            const path = joined();
            const before = arcBeziers();
            path.translate(10, 20);
            const segs = path.toJSON().segments;
            for (let i = 0; i < 2; i++) {
                assertNearPoint(segs[i].control1, { x: before[i].control1.x + 10, y: before[i].control1.y + 20 });
                assertNearPoint(segs[i].control2, { x: before[i].control2.x + 10, y: before[i].control2.y + 20 });
            }
        });
    });

    describe('端点の読み方', () => {
        it('lineEndpointOf：直線・開いたパス・今の曲線・弧の端点を新しいオブジェクトで返し、引数を書き換えない', () => {
            const cases = [
                [makeLine(0, 0, 10, 5), { x: 0, y: 0 }, { x: 10, y: 5 }],
                [makePath([[0, 0], [5, 5], [8, 1], [10, 9]]), { x: 0, y: 0 }, { x: 10, y: 9 }],
                [makeCurve([0, 0], [30, 60], [60, 0]), { x: 0, y: 0 }, { x: 60, y: 0 }],
                [makeArc(), { x: 40, y: 200 }, { x: 160, y: 200 }],
            ];
            for (const [shape, start, end] of cases) {
                const data = shape.toJSON();
                const before = JSON.stringify(data);
                const s = lineEndpointOf(data, 'start');
                const e = lineEndpointOf(data, 'end');
                assert.deepEqual(s, start);
                assert.deepEqual(e, end);
                assert.equal(JSON.stringify(data), before);
                s.x = 999;
                e.y = 999;
                assert.equal(JSON.stringify(data), before);
            }
        });

        it('fromJSONで[3]・[4]が正準でない弧・[1]が中心より左・[2]が中心より下の弧は点のとおり裏返った弧（始点が右側・終点が左側。[3]・[4]を読まない）', () => {
            const data = makeArc().toJSON();
            data.points = [
                { x: 100, y: 200 }, { x: 40, y: 200 }, { x: 100, y: 230 },
                { x: 999, y: 999 }, { x: -5, y: -5 },
            ];
            const arc = Ellipse.fromJSON(data);
            assert.deepEqual(lineEndpointOf(arc.toJSON(), 'start'), { x: 160, y: 200 });
            assert.deepEqual(lineEndpointOf(arc.toJSON(), 'end'), { x: 40, y: 200 });
        });

        it('回した弧（u=(0,60)・w=(30,0)）：始点＝中心−u・頂上＝中心+w・終点＝中心+u（端点と区間の引っ張る点を点のとおりに読む）', () => {
            const data = makeArc().toJSON();
            data.points = [
                { x: 100, y: 200 }, { x: 100, y: 260 }, { x: 130, y: 200 },
                { x: 0, y: 0 }, { x: 0, y: 0 },
            ];
            const arc = Ellipse.fromJSON(data);
            assert.deepEqual(lineEndpointOf(arc.toJSON(), 'start'), { x: 100, y: 140 });
            assert.deepEqual(lineEndpointOf(arc.toJSON(), 'end'), { x: 100, y: 260 });
            const path = buildJoinedPath(arc, makeLine(100, 260, 150, 260), 0).toJSON();
            assert.deepEqual(coordsOf(path.points).slice(0, 3), [[100, 140], [130, 200], [100, 260]]);
            const k = 4 * (Math.SQRT2 - 1) / 3;
            assertNearPoint(path.segments[0].control1, { x: 100 + 30 * k, y: 140 });
            assertNearPoint(path.segments[0].control2, { x: 130, y: 200 - 60 * k });
            assertNearPoint(path.segments[1].control1, { x: 130, y: 200 + 60 * k });
            assertNearPoint(path.segments[1].control2, { x: 100 + 30 * k, y: 260 });
        });

        it('上下に裏返した弧（w が中心より下）：頂上が下側の下半分の弧として読み、端点は左端・右端のまま', () => {
            const data = makeArc().toJSON();
            data.points = [
                { x: 100, y: 200 }, { x: 160, y: 200 }, { x: 100, y: 230 },
                { x: 0, y: 0 }, { x: 0, y: 0 },
            ];
            const arc = Ellipse.fromJSON(data);
            assert.deepEqual(lineEndpointOf(arc.toJSON(), 'start'), { x: 40, y: 200 });
            assert.deepEqual(lineEndpointOf(arc.toJSON(), 'end'), { x: 160, y: 200 });
            const path = buildJoinedPath(arc, makeLine(160, 200, 200, 200), 0).toJSON();
            assert.deepEqual(coordsOf(path.points).slice(0, 3), [[40, 200], [100, 230], [160, 200]]);
            const k = 4 * (Math.SQRT2 - 1) / 3;
            assertNearPoint(path.segments[0].control1, { x: 40, y: 200 + 30 * k });
            assertNearPoint(path.segments[1].control2, { x: 160, y: 200 + 30 * k });
        });

        it('endpointVertexIndexOf：直線0／1、頂点4つのパス0／3、今の曲線0／2、弧は null／null', () => {
            const line = makeLine(0, 0, 10, 0).toJSON();
            assert.equal(endpointVertexIndexOf(line, 'start'), 0);
            assert.equal(endpointVertexIndexOf(line, 'end'), 1);
            const path = makePath([[0, 0], [5, 5], [8, 1], [10, 9]]).toJSON();
            assert.equal(endpointVertexIndexOf(path, 'start'), 0);
            assert.equal(endpointVertexIndexOf(path, 'end'), 3);
            const curve = makeCurve([0, 0], [30, 60], [60, 0]).toJSON();
            assert.equal(endpointVertexIndexOf(curve, 'start'), 0);
            assert.equal(endpointVertexIndexOf(curve, 'end'), 2);
            const arc = makeArc().toJSON();
            assert.equal(endpointVertexIndexOf(arc, 'start'), null);
            assert.equal(endpointVertexIndexOf(arc, 'end'), null);
        });
    });
});
