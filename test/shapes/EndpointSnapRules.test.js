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
} from '../../js/shapes/EndpointSnapRules.js';
import { JOIN_TOLERANCE_SCREEN_PX } from '../../js/shapes/PathJoinRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

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

    it('isSnapDrawShapeType は line だけ真', () => {
        assert.equal(isSnapDrawShapeType('line'), true);
        for (const t of ['curve', 'rect', 'circle', 'arc', 'path', 'unknown', '', null, undefined]) {
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

    it('閉じたパス・曲線・矩形・円・弧は null', () => {
        const closed = makePath([[0, 0], [10, 0], [10, 10]], true);
        assert.equal(resolveEndpointHandle(closed, 'vertex-0'), null);
        assert.equal(resolveEndpointHandle(closed, 'vertex-2'), null);
        const others = [
            new Curve(0, 0, 100, 100),
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

    it('曲線・矩形・円・弧・閉じたパスの点には吸い付かない', () => {
        const shapes = [
            withId(new Curve(0, 0, 100, 100), 'C'),
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
