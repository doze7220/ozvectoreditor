/**
 * 責務: 端点への吸い付きの規則（EndpointSnapRules）の対象・距離・候補の選び方・ドラッグ時の除外・
 * 描く図形種別と端点のハンドルの判定を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    SNAP_TOLERANCE_SCREEN_PX,
    isSnapDrawShapeType,
    resolveEndpointHandle,
    findSnapTarget,
    DRAWN_START_SNAP_KIND,
    isDrawnStartSnap,
    findDrawnLineSnapTarget,
} from '../../js/shapes/EndpointSnapRules.js';
import { JOIN_TOLERANCE_SCREEN_PX } from '../../js/shapes/PathJoinRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';

/**
 * 指定の頂点のパスを作る。
 * @param {number[][]} coords - [x, y] の並び
 * @param {boolean} [closed=false] - 閉じたパスか
 * @returns {Path} パス
 */
function makePath(coords, closed = false) {
    return new Path(coords.map(([x, y]) => ({ x, y })), closed, '#000000', 2);
}

/**
 * 図形にidを付ける（公開プロパティへ直接代入）。
 * @param {Object} shape - 図形
 * @param {string} id - 付けるid
 * @returns {Object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

describe('EndpointSnapRules 定数と図形種別', () => {
    it('SNAP_TOLERANCE_SCREEN_PX は8で、JOIN_TOLERANCE_SCREEN_PX とは別の値', () => {
        assert.equal(SNAP_TOLERANCE_SCREEN_PX, 8);
        assert.notEqual(SNAP_TOLERANCE_SCREEN_PX, JOIN_TOLERANCE_SCREEN_PX);
    });

    it('isSnapDrawShapeType は line と curve が真', () => {
        assert.equal(isSnapDrawShapeType('line'), true);
        assert.equal(isSnapDrawShapeType('curve'), true);
        for (const t of ['rect', 'circle', 'arc', 'path', 'unknown', '', null, undefined]) {
            assert.equal(isSnapDrawShapeType(t), false, String(t));
        }
    });
});

describe('EndpointSnapRules resolveEndpointHandle', () => {
    it('直線は start/end が端点、move は null', () => {
        const line = new Line(0, 0, 10, 0);
        assert.equal(resolveEndpointHandle(line, 'start'), 'start');
        assert.equal(resolveEndpointHandle(line, 'end'), 'end');
        assert.equal(resolveEndpointHandle(line, 'move'), null);
    });

    it('開いたパスは先頭と末尾の頂点ハンドルが端点、途中は null', () => {
        const path = makePath([[0, 0], [10, 0], [20, 0], [30, 0]]);
        assert.equal(resolveEndpointHandle(path, 'vertex-0'), 'start');
        assert.equal(resolveEndpointHandle(path, 'vertex-3'), 'end');
        assert.equal(resolveEndpointHandle(path, 'vertex-1'), null);
        assert.equal(resolveEndpointHandle(path, 'vertex-2'), null);
    });

    it('頂点2つのパスは両端が端点', () => {
        const path = makePath([[0, 0], [10, 0]]);
        assert.equal(resolveEndpointHandle(path, 'vertex-0'), 'start');
        assert.equal(resolveEndpointHandle(path, 'vertex-1'), 'end');
    });

    it('閉じたパス・矩形・円・弧は null', () => {
        const closed = makePath([[0, 0], [10, 0], [10, 10]], true);
        assert.equal(resolveEndpointHandle(closed, 'vertex-0'), null);
        assert.equal(resolveEndpointHandle(closed, 'vertex-2'), null);
        const others = [
            new Rect(0, 0, 100, 100),
            new Ellipse(0, 0, 100, 100, 'circle'),
            new Ellipse(0, 0, 100, 100, 'arc'),
        ];
        for (const shape of others) {
            for (const name of ['start', 'end', 'move', 'vertex-0', 'right', 'up']) {
                assert.equal(resolveEndpointHandle(shape, name), null, `${shape.type}:${name}`);
            }
        }
    });

    it('不正なハンドル名は null', () => {
        const line = new Line(0, 0, 10, 0);
        const path = makePath([[0, 0], [10, 0], [20, 0]]);
        for (const name of ['', 'foo', null, undefined, 3]) {
            assert.equal(resolveEndpointHandle(line, name), null, `line:${String(name)}`);
            assert.equal(resolveEndpointHandle(path, name), null, `path:${String(name)}`);
        }
        assert.equal(resolveEndpointHandle(path, 'vertex-9'), null);
        assert.equal(resolveEndpointHandle(path, 'vertex-01'), null);
    });
});

describe('EndpointSnapRules findSnapTarget 対象', () => {
    it('直線の始点・終点に吸い付き、shapeId・end・x・y を返す', () => {
        const line = withId(new Line(0, 0, 100, 50), 'L');
        assert.deepEqual(findSnapTarget([line], { x: 1, y: 1 }, 8), { shapeId: 'L', end: 'start', x: 0, y: 0 });
        assert.deepEqual(findSnapTarget([line], { x: 99, y: 52 }, 8), { shapeId: 'L', end: 'end', x: 100, y: 50 });
    });

    it('開いたパスの両端に吸い付き、途中の頂点には吸い付かない', () => {
        const path = withId(makePath([[0, 0], [50, 0], [100, 0]]), 'P');
        assert.deepEqual(findSnapTarget([path], { x: 0, y: 3 }, 8), { shapeId: 'P', end: 'start', x: 0, y: 0 });
        assert.deepEqual(findSnapTarget([path], { x: 100, y: 3 }, 8), { shapeId: 'P', end: 'end', x: 100, y: 0 });
        assert.equal(findSnapTarget([path], { x: 50, y: 0 }, 8), null);
    });

    it('矩形・円・弧・閉じたパスの点には吸い付かない', () => {
        const shapes = [
            withId(new Rect(0, 0, 100, 100), 'R'),
            withId(new Ellipse(0, 0, 100, 100, 'circle'), 'E'),
            withId(new Ellipse(0, 0, 100, 100, 'arc'), 'A'),
            withId(makePath([[0, 0], [100, 0], [100, 100]], true), 'Z'),
        ];
        for (const s of shapes) {
            const data = s.toJSON();
            for (const p of data.points) {
                assert.equal(findSnapTarget([s], { x: p.x, y: p.y }, 8), null, `${s.type}`);
            }
        }
        assert.equal(findSnapTarget(shapes, { x: 0, y: 0 }, 8), null);
        assert.equal(findSnapTarget(shapes, { x: 100, y: 100 }, 8), null);
    });

    it('図形が0個なら null', () => {
        assert.equal(findSnapTarget([], { x: 0, y: 0 }, 8), null);
    });
});

describe('EndpointSnapRules findSnapTarget 距離', () => {
    it('距離がちょうど tolerance なら吸い付き、僅かに外なら null', () => {
        const line = withId(new Line(0, 0, 100, 0), 'L');
        assert.equal(findSnapTarget([line], { x: 3, y: 4 }, 5).end, 'start');
        assert.equal(findSnapTarget([line], { x: 3, y: 4 }, 4.9999), null);
        assert.equal(findSnapTarget([line], { x: 108, y: 0 }, 8).end, 'end');
        assert.equal(findSnapTarget([line], { x: 108.0001, y: 0 }, 8), null);
    });
});

describe('EndpointSnapRules findSnapTarget 候補の選び方', () => {
    it('いちばん近い端点を選ぶ', () => {
        const a = withId(new Line(0, 0, 100, 0), 'A');
        const b = withId(new Line(4, 0, 100, 50), 'B');
        const r = findSnapTarget([a, b], { x: 3, y: 0 }, 8);
        assert.equal(r.shapeId, 'B');
        assert.equal(r.end, 'start');
        const r2 = findSnapTarget([a, b], { x: 1, y: 0 }, 8);
        assert.equal(r2.shapeId, 'A');
    });

    it('同距離なら前面（配列の末尾側）の図形を選ぶ', () => {
        const back = withId(new Line(0, 0, 100, 0), 'back');
        const front = withId(new Line(0, 0, 100, 50), 'front');
        assert.equal(findSnapTarget([back, front], { x: 0, y: 0 }, 8).shapeId, 'front');
        assert.equal(findSnapTarget([front, back], { x: 0, y: 0 }, 8).shapeId, 'back');
    });

    it('同じ図形の始点と終点が同距離なら始点を選ぶ', () => {
        const line = withId(new Line(0, 0, 10, 0), 'L');
        const r = findSnapTarget([line], { x: 5, y: 0 }, 8);
        assert.equal(r.end, 'start');
        const path = withId(makePath([[0, 0], [5, 5], [10, 0]]), 'P');
        assert.equal(findSnapTarget([path], { x: 5, y: 0 }, 8).end, 'start');
    });
});

describe('EndpointSnapRules findSnapTarget dragged の除外', () => {
    it('ドラッグしている端点そのものは対象にしない', () => {
        const line = withId(new Line(0, 0, 100, 0), 'L');
        const other = withId(new Line(200, 0, 300, 0), 'M');
        const dragged = { shapeId: 'L', end: 'start' };
        assert.equal(findSnapTarget([line, other], { x: 0, y: 0 }, 8, dragged), null);
        assert.equal(findSnapTarget([line, other], { x: 200, y: 0 }, 8, dragged).shapeId, 'M');
    });

    it('自身のもう一方の端点は、直線・頂点2つ・3つのパスでは対象外', () => {
        const shapes = [
            withId(new Line(0, 0, 100, 0), 'L'),
            withId(makePath([[0, 0], [100, 0]]), 'P2'),
            withId(makePath([[0, 0], [50, 50], [100, 0]]), 'P3'),
        ];
        for (const s of shapes) {
            assert.equal(findSnapTarget([s], { x: 100, y: 0 }, 8, { shapeId: s.id, end: 'start' }), null, s.id);
            assert.equal(findSnapTarget([s], { x: 0, y: 0 }, 8, { shapeId: s.id, end: 'end' }), null, s.id);
        }
    });

    it('自身のもう一方の端点は、頂点4つ以上の開いたパスでは対象', () => {
        const path = withId(makePath([[0, 0], [50, 50], [100, 50], [100, 0]]), 'P4');
        const r = findSnapTarget([path], { x: 100, y: 0 }, 8, { shapeId: 'P4', end: 'start' });
        assert.deepEqual(r, { shapeId: 'P4', end: 'end', x: 100, y: 0 });
        const r2 = findSnapTarget([path], { x: 0, y: 0 }, 8, { shapeId: 'P4', end: 'end' });
        assert.deepEqual(r2, { shapeId: 'P4', end: 'start', x: 0, y: 0 });
        assert.equal(findSnapTarget([path], { x: 0, y: 0 }, 8, { shapeId: 'P4', end: 'start' }), null);
    });

    it('他の図形の両端は通常どおり対象', () => {
        const dragging = withId(new Line(0, 0, 100, 0), 'L');
        const other = withId(new Line(200, 0, 300, 0), 'M');
        const dragged = { shapeId: 'L', end: 'end' };
        assert.equal(findSnapTarget([dragging, other], { x: 200, y: 0 }, 8, dragged).end, 'start');
        assert.equal(findSnapTarget([dragging, other], { x: 300, y: 0 }, 8, dragged).end, 'end');
    });
});

describe('EndpointSnapRules 引数の非破壊', () => {
    it('図形のデータと配列を書き換えない', () => {
        const shapes = [
            withId(new Line(0, 0, 100, 0), 'L'),
            withId(makePath([[0, 0], [50, 50], [100, 50], [100, 0]]), 'P'),
        ];
        const before = JSON.stringify(shapes.map((s) => s.toJSON()));
        const ids = shapes.map((s) => s.id);
        const point = { x: 1, y: 1 };
        const dragged = { shapeId: 'P', end: 'start' };
        findSnapTarget(shapes, point, 8);
        findSnapTarget(shapes, point, 8, dragged);
        resolveEndpointHandle(shapes[1], 'vertex-0');
        assert.equal(JSON.stringify(shapes.map((s) => s.toJSON())), before);
        assert.deepEqual(shapes.map((s) => s.id), ids);
        assert.deepEqual(point, { x: 1, y: 1 });
        assert.deepEqual(dragged, { shapeId: 'P', end: 'start' });
    });
});

/**
 * 作成途中の線（開いたパス）を作る。最後の頂点は付いてくる線の先。
 * @param {number[][]} coords - [x, y] の並び（打った点＋付いてくる線の先）
 * @returns {Path} 作成途中の線
 */
function makeDrawn(coords) {
    return makePath(coords);
}

describe('EndpointSnapRules DRAWN_START_SNAP_KIND と isDrawnStartSnap', () => {
    it('DRAWN_START_SNAP_KIND は drawnStart', () => {
        assert.equal(DRAWN_START_SNAP_KIND, 'drawnStart');
    });

    it('null・undefined・SnapTarget は偽、DrawnStartSnap は真', () => {
        assert.equal(isDrawnStartSnap(null), false);
        assert.equal(isDrawnStartSnap(undefined), false);
        assert.equal(isDrawnStartSnap({ shapeId: 'L', end: 'start', x: 0, y: 0 }), false);
        assert.equal(isDrawnStartSnap({ kind: DRAWN_START_SNAP_KIND, x: 0, y: 0 }), true);
    });
});

describe('EndpointSnapRules findDrawnLineSnapTarget 描き始めの端点の除外', () => {
    it('startSnap が null なら findSnapTarget と同じ結果', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L'), withId(new Line(0, 5, 100, 5), 'M')];
        const drawn = makeDrawn([[50, 50], [60, 60]]);
        const point = { x: 2, y: 4 };
        assert.deepEqual(findDrawnLineSnapTarget(shapes, drawn, point, 8, null), findSnapTarget(shapes, point, 8));
    });

    it('描き始めの端点だけを除き、同じ直線のもう一方の端点は対象', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        const drawn = makeDrawn([[0, 0], [30, 30]]);
        const startSnap = { shapeId: 'L', end: 'start' };
        assert.equal(findDrawnLineSnapTarget(shapes, drawn, { x: 0, y: 0 }, 8, startSnap), null);
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 100, y: 0 }, 8, startSnap),
            { shapeId: 'L', end: 'end', x: 100, y: 0 }
        );
    });

    it('別の図形の端点は通常どおり対象', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L'), withId(new Line(0, 3, 100, 3), 'M')];
        const drawn = makeDrawn([[0, 0], [30, 30]]);
        const startSnap = { shapeId: 'L', end: 'start' };
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 0, y: 0 }, 8, startSnap),
            { shapeId: 'M', end: 'start', x: 0, y: 3 }
        );
    });
});

describe('EndpointSnapRules findDrawnLineSnapTarget 始点', () => {
    const start = { x: 200, y: 200 };

    it('打った点が3つ以上（頂点4つ）で近ければ始点を返す', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        assert.deepEqual(
            findDrawnLineSnapTarget([], drawn, { x: 203, y: 204 }, 8, null),
            { kind: DRAWN_START_SNAP_KIND, x: start.x, y: start.y }
        );
    });

    it('打った点が2つ（頂点3つ）では候補にならない', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [250, 250]]);
        assert.equal(findDrawnLineSnapTarget([], drawn, { x: 200, y: 200 }, 8, null), null);
    });

    it('startSnap があれば始点は候補にならない', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        const startSnap = { shapeId: 'X', end: 'start' };
        assert.equal(findDrawnLineSnapTarget([], drawn, { x: 200, y: 200 }, 8, startSnap), null);
    });

    it('距離の境界：ちょうど8を含み、超えると対象外', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        assert.notEqual(findDrawnLineSnapTarget([], drawn, { x: 208, y: 200 }, 8, null), null);
        assert.equal(findDrawnLineSnapTarget([], drawn, { x: 208.01, y: 200 }, 8, null), null);
    });

    it('端点と始点では距離が厳密に小さい方を選ぶ', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        const nearEnd = [withId(new Line(204, 200, 400, 400), 'E')];
        assert.deepEqual(
            findDrawnLineSnapTarget(nearEnd, drawn, { x: 203, y: 200 }, 8, null),
            { shapeId: 'E', end: 'start', x: 204, y: 200 }
        );
        const farEnd = [withId(new Line(207, 200, 400, 400), 'E')];
        assert.deepEqual(
            findDrawnLineSnapTarget(farEnd, drawn, { x: 203, y: 200 }, 8, null),
            { kind: DRAWN_START_SNAP_KIND, x: 200, y: 200 }
        );
    });

    it('同距離なら端点が残る', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        const shapes = [withId(new Line(206, 200, 400, 400), 'E')];
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 203, y: 200 }, 8, null),
            { shapeId: 'E', end: 'start', x: 206, y: 200 }
        );
    });
});

describe('EndpointSnapRules findDrawnLineSnapTarget 結果の形と非破壊', () => {
    it('端点の結果は SnapTarget と同じキーだけ（kind を持たない）', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        const drawn = makeDrawn([[50, 50], [60, 60]]);
        const result = findDrawnLineSnapTarget(shapes, drawn, { x: 1, y: 1 }, 8, null);
        assert.deepEqual(Object.keys(result).sort(), ['end', 'shapeId', 'x', 'y']);
    });

    it('始点の結果は kind・x・y だけ', () => {
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        const result = findDrawnLineSnapTarget([], drawn, { x: 200, y: 200 }, 8, null);
        assert.deepEqual(Object.keys(result).sort(), ['kind', 'x', 'y']);
    });

    it('引数を書き換えない', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        const drawn = makeDrawn([[200, 200], [300, 200], [300, 300], [250, 250]]);
        const before = JSON.stringify([...shapes.map((s) => s.toJSON()), drawn.toJSON()]);
        const point = { x: 1, y: 1 };
        const startSnap = { shapeId: 'L', end: 'start' };
        findDrawnLineSnapTarget(shapes, drawn, point, 8, startSnap);
        findDrawnLineSnapTarget(shapes, drawn, point, 8, null);
        assert.equal(JSON.stringify([...shapes.map((s) => s.toJSON()), drawn.toJSON()]), before);
        assert.deepEqual(point, { x: 1, y: 1 });
        assert.deepEqual(startSnap, { shapeId: 'L', end: 'start' });
    });
});

/**
 * 曲線の区間だけの開いたパスを作る。
 * @param {number[][]} coords - [x, y] の並び
 * @returns {Path} 曲線のパス
 */
function makeSmoothPath(coords) {
    return new Path(coords.map(([x, y]) => ({ x, y })), false, '#000000', 2, undefined, SEGMENT_KIND_SMOOTH);
}

describe('EndpointSnapRules 曲線のパスと曲線のツールの作成途中の線', () => {
    it('findSnapTarget は曲線のパスの端点を（より近ければ）候補にする', () => {
        const shapes = [
            withId(makeSmoothPath([[0, 0], [50, 50], [100, 0]]), 'S'),
            withId(new Line(0, 5, 100, 5), 'L'),
        ];
        assert.deepEqual(
            findSnapTarget(shapes, { x: 0, y: 0 }, 8),
            { shapeId: 'S', end: 'start', x: 0, y: 0 }
        );
        assert.deepEqual(
            findSnapTarget([shapes[0]], { x: 0, y: 0 }, 8),
            { shapeId: 'S', end: 'start', x: 0, y: 0 }
        );
    });

    it('resolveEndpointHandle は曲線のパスの端点のハンドルで start/end', () => {
        const path = makeSmoothPath([[0, 0], [50, 50], [100, 0]]);
        assert.equal(resolveEndpointHandle(path, 'vertex-0'), 'start');
        assert.equal(resolveEndpointHandle(path, 'vertex-2'), 'end');
    });

    it('作成途中の線が曲線のパス（打った点2つ）なら近くの直線の端点を返す', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        const drawn = makeSmoothPath([[200, 200], [250, 250]]);
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 1, y: 1 }, 8, null),
            { shapeId: 'L', end: 'start', x: 0, y: 0 }
        );
    });

    it('作成途中の線が曲線のパス（打った点3つ以上）なら近い方（既存の端点／始点）を返す', () => {
        const shapes = [withId(new Line(204, 200, 400, 400), 'E')];
        const drawn = makeSmoothPath([[200, 200], [300, 200], [300, 300], [250, 250]]);
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 201, y: 200 }, 8, null),
            { kind: DRAWN_START_SNAP_KIND, x: 200, y: 200 }
        );
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 203, y: 200 }, 8, null),
            { shapeId: 'E', end: 'start', x: 204, y: 200 }
        );
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 400, y: 400 }, 8, null),
            { shapeId: 'E', end: 'end', x: 400, y: 400 }
        );
    });

    it('作成途中の線が直線のパスなら今までどおり既存の端点を返す', () => {
        const shapes = [withId(new Line(0, 0, 100, 0), 'L')];
        const drawn = makeDrawn([[200, 200], [250, 250]]);
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 1, y: 1 }, 8, null),
            { shapeId: 'L', end: 'start', x: 0, y: 0 }
        );
    });
});

describe('EndpointSnapRules 曲線のパスの吸い付き（Phase 09-01b）', () => {
    it('findSnapTarget: dragged が曲線のパスの端点なら、もう一方の端点は頂点4つ以上のときだけ候補', () => {
        const four = [withId(makeSmoothPath([[0, 0], [50, 50], [100, 50], [100, 0]]), 'S')];
        const draggedStart = { shapeId: 'S', end: 'start' };
        assert.equal(findSnapTarget(four, { x: 0, y: 0 }, 8, draggedStart), null);
        assert.deepEqual(
            findSnapTarget(four, { x: 100, y: 0 }, 8, draggedStart),
            { shapeId: 'S', end: 'end', x: 100, y: 0 }
        );
        const three = [withId(makeSmoothPath([[0, 0], [50, 50], [100, 0]]), 'T')];
        assert.equal(findSnapTarget(three, { x: 100, y: 0 }, 8, { shapeId: 'T', end: 'start' }), null);
        assert.equal(findSnapTarget(three, { x: 0, y: 0 }, 8, { shapeId: 'T', end: 'end' }), null);
    });

    it('resolveEndpointHandle: 曲線のパスの途中の頂点は null、頂点の番号のないハンドルも null', () => {
        const path = makeSmoothPath([[0, 0], [50, 50], [100, 50], [100, 0]]);
        assert.equal(resolveEndpointHandle(path, 'vertex-0'), 'start');
        assert.equal(resolveEndpointHandle(path, 'vertex-3'), 'end');
        assert.equal(resolveEndpointHandle(path, 'vertex-1'), null);
        assert.equal(resolveEndpointHandle(path, 'vertex-2'), null);
        assert.equal(resolveEndpointHandle(path, 'move'), null);
    });

    it('findDrawnLineSnapTarget: 曲線のツールの線でも既存の端点（直線・直線のパス・曲線のパス）を返す', () => {
        const shapes = [
            withId(new Line(0, 0, 100, 0), 'L'),
            withId(makePath([[0, 100], [100, 100], [100, 200]]), 'P'),
            withId(makeSmoothPath([[0, 300], [50, 350], [100, 300]]), 'S'),
        ];
        const drawn = makeSmoothPath([[500, 500], [550, 550]]);
        assert.deepEqual(findDrawnLineSnapTarget(shapes, drawn, { x: 1, y: 1 }, 8, null), { shapeId: 'L', end: 'start', x: 0, y: 0 });
        assert.deepEqual(findDrawnLineSnapTarget(shapes, drawn, { x: 100, y: 201 }, 8, null), { shapeId: 'P', end: 'end', x: 100, y: 200 });
        assert.deepEqual(findDrawnLineSnapTarget(shapes, drawn, { x: 100, y: 299 }, 8, null), { shapeId: 'S', end: 'end', x: 100, y: 300 });
    });

    it('findDrawnLineSnapTarget: startSnap の端点だけを除き、同じ曲線のパスのもう一方の端点は返す', () => {
        const shapes = [withId(makeSmoothPath([[0, 0], [50, 50], [100, 0]]), 'S')];
        const drawn = makeSmoothPath([[0, 0], [30, 30]]);
        const startSnap = { shapeId: 'S', end: 'start' };
        assert.equal(findDrawnLineSnapTarget(shapes, drawn, { x: 0, y: 0 }, 8, startSnap), null);
        assert.deepEqual(
            findDrawnLineSnapTarget(shapes, drawn, { x: 100, y: 0 }, 8, startSnap),
            { shapeId: 'S', end: 'end', x: 100, y: 0 }
        );
    });

    it('findDrawnLineSnapTarget: 打った点が3つ以上のとき、厳密に近い方を選び、同距離なら端点が残る（直線のツールの線と同じ）', () => {
        const coords = [[200, 200], [300, 200], [300, 300], [250, 250]];
        const smooth = makeSmoothPath(coords);
        const line = makeDrawn(coords);
        const near = [withId(new Line(204, 200, 400, 400), 'E')];
        const far = [withId(new Line(207, 200, 400, 400), 'E')];
        const tie = [withId(new Line(206, 200, 400, 400), 'E')];
        const point = { x: 203, y: 200 };
        for (const drawn of [smooth, line]) {
            assert.deepEqual(findDrawnLineSnapTarget(near, drawn, point, 8, null), { shapeId: 'E', end: 'start', x: 204, y: 200 });
            assert.deepEqual(findDrawnLineSnapTarget(far, drawn, point, 8, null), { kind: DRAWN_START_SNAP_KIND, x: 200, y: 200 });
            assert.deepEqual(findDrawnLineSnapTarget(tie, drawn, point, 8, null), { shapeId: 'E', end: 'start', x: 206, y: 200 });
        }
    });
});

describe('EndpointSnapRules 今の曲線の吸い付き（Phase 09-03a）', () => {
    /**
     * 始点(0, 0)・制御点(50, 100)・終点(100, 0)の今の曲線を作る。
     * @param {string} id - 付けるid
     * @returns {Curve} 今の曲線
     */
    function makeCurve(id) {
        const curve = new Curve(0, 0, 100, 0);
        curve.points[1] = { x: 50, y: 100 };
        return withId(curve, id);
    }

    it('resolveEndpointHandle は今の曲線の start が start・end が end・control が null', () => {
        const curve = makeCurve('C');
        assert.equal(resolveEndpointHandle(curve, 'start'), 'start');
        assert.equal(resolveEndpointHandle(curve, 'end'), 'end');
        assert.equal(resolveEndpointHandle(curve, 'control'), null);
    });

    it('findSnapTarget は今の曲線の始点・終点に吸い付き、制御点の位置には吸い付かない', () => {
        const curve = makeCurve('C');
        assert.deepEqual(findSnapTarget([curve], { x: 2, y: 1 }, 8), { shapeId: 'C', end: 'start', x: 0, y: 0 });
        assert.deepEqual(findSnapTarget([curve], { x: 99, y: 2 }, 8), { shapeId: 'C', end: 'end', x: 100, y: 0 });
        assert.equal(findSnapTarget([curve], { x: 50, y: 100 }, 8), null);
    });

    it('findSnapTarget: ドラッグ中の今の曲線の端点は自分のもう一方の端点に吸い付かない', () => {
        const curve = makeCurve('C');
        const dragged = { shapeId: 'C', end: 'start' };
        assert.equal(findSnapTarget([curve], { x: 100, y: 0 }, 8, dragged), null);
        assert.equal(findSnapTarget([curve], { x: 0, y: 0 }, 8, dragged), null);
    });

    it('findDrawnLineSnapTarget は今の曲線の端点を候補にする', () => {
        const curve = makeCurve('C');
        const drawn = new Line(300, 0, 400, 0);
        assert.deepEqual(
            findDrawnLineSnapTarget([curve], drawn, { x: 100, y: 3 }, 8, null),
            { shapeId: 'C', end: 'end', x: 100, y: 0 }
        );
    });
});
