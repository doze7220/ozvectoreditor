/**
 * 責務: パスの頂点の追加・削除の規則（PathVertexRules）のうち、区間の制御点の共有・輪郭の元への読み替え・区間の上の最も近い位置・ベジェの分割を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    outlineSourceOf,
    findNearestSegmentLocation,
    splitCubicBezier,
} from '../../js/shapes/PathVertexRules.js';
import { chainSourceOf } from '../../js/shapes/PathJoinRules.js';
import { cubicBezierPoint } from '../../js/shapes/ShapeGeometry.js';
import {
    Path,
    SEGMENT_KIND_LINE,
    SEGMENT_KIND_SMOOTH,
    SEGMENT_KIND_BEZIER,
    SMOOTH_SEGMENT_SAMPLE_COUNT,
    resolveSegmentControls,
} from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 2点間の距離を返す。
 * @param {{x: number, y: number}} a - 点1
 * @param {{x: number, y: number}} b - 点2
 * @returns {number} 距離
 */
function dist(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}

describe('PathVertexRules: SMOOTH_SEGMENT_SAMPLE_COUNT', () => {
    it('Pathが折れ線の近似の分割数をexportしている（100）', () => {
        assert.equal(SMOOTH_SEGMENT_SAMPLE_COUNT, 100);
    });
});

describe('Path.resolveSegmentControls', () => {
    it('toDrawElementのcubicの制御点と同じ値（smooth・bezier・角あり・閉じたパス）', () => {
        const points = [{ x: 0, y: 0 }, { x: 40, y: 30 }, { x: 80, y: 0 }, { x: 60, y: -40 }];
        const segments = [
            SEGMENT_KIND_SMOOTH,
            { kind: SEGMENT_KIND_BEZIER, control1: { x: 50, y: 40 }, control2: { x: 70, y: 20 } },
            SEGMENT_KIND_SMOOTH,
            SEGMENT_KIND_SMOOTH,
        ];
        const path = new Path(points, true, '#000000', 2, '#ff0000', segments, [false, false, true, false]);
        const controls = resolveSegmentControls(path);
        const drawn = path.toDrawElement().segments;
        assert.equal(controls.length, drawn.length);
        controls.forEach((control, i) => {
            assert.deepEqual({ control1: drawn[i].control1, control2: drawn[i].control2 }, control);
        });
        // toJSON()の値でも同じ
        assert.deepEqual(resolveSegmentControls(path.toJSON()), controls);
    });

    it('直線の区間はnull・開いたパスも扱える', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }], false, '#000', 1, null, [SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH]);
        const controls = resolveSegmentControls(path);
        assert.equal(controls.length, 2);
        assert.equal(controls[0], null);
        assert.notEqual(controls[1], null);
    });

    it('引数を書き換えず、bezierの引っ張る点は新しい写し', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }], false, '#000', 1, null, [
            { kind: SEGMENT_KIND_BEZIER, control1: { x: 1, y: 2 }, control2: { x: 3, y: 4 } },
        ]);
        const before = JSON.stringify(path.toJSON());
        const controls = resolveSegmentControls(path);
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.notEqual(controls[0].control1, path.segments[0].control1);
    });
});

describe('PathVertexRules.outlineSourceOf', () => {
    it('直線は点2つ・開いた・直線の区間1つ', () => {
        const line = new Line(1, 2, 31, 42, '#112233', 3, '#445566');
        const data = line.toJSON();
        const source = outlineSourceOf(data);
        assert.equal(source.type, 'path');
        assert.deepEqual(source.points, [{ x: 1, y: 2 }, { x: 31, y: 42 }]);
        assert.equal(source.closed, false);
        assert.deepEqual(source.segments, [{ kind: 'line' }]);
        assert.equal(source.strokeColor, '#112233');
        assert.equal(source.strokeWidth, 3);
        assert.equal(source.fillColor, '#445566');
        assert.notEqual(source.points, data.points);
    });

    it('矩形は点4つ（topLeft→topRight→bottomRight→bottomLeft）・閉じた・直線の区間4つ', () => {
        const rect = new Rect(0, 0, 20, 10, '#000000', 2, '#abcdef');
        const source = outlineSourceOf(rect.toJSON());
        assert.deepEqual(source.points, [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }, { x: 0, y: 10 }]);
        assert.equal(source.closed, true);
        assert.deepEqual(source.segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        assert.equal(source.fillColor, '#abcdef');
    });

    it('回した矩形は頂点の並びのまま読む', () => {
        const rect = new Rect(0, 0, 20, 10);
        rect.points = [{ x: 10, y: 0 }, { x: 20, y: 10 }, { x: 10, y: 20 }, { x: 0, y: 10 }];
        const source = outlineSourceOf(rect.toJSON());
        assert.deepEqual(source.points, rect.points);
        assert.equal(source.closed, true);
        assert.equal(source.segments.length, 4);
    });

    it('今の曲線はchainSourceOfと同じ値', () => {
        const curve = new Curve(0, 0, 30, 60, 60, 0, '#000000', 2, '#00ff00');
        const data = curve.toJSON();
        const source = outlineSourceOf(data);
        assert.deepEqual(source, chainSourceOf(data));
        assert.equal(source.segments[0].kind, SEGMENT_KIND_BEZIER);
        assert.equal(source.points.length, 2);
        assert.equal(source.closed, false);
    });

    it('パスはtoJSON()の値と同じ内容（角あり・fillColorの値を含む）', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }],
            false,
            '#000',
            2,
            '#123456',
            [SEGMENT_KIND_SMOOTH, { kind: SEGMENT_KIND_BEZIER, control1: { x: 12, y: 12 }, control2: { x: 18, y: 4 } }],
            [false, true, false],
        );
        const data = path.toJSON();
        const source = outlineSourceOf(data);
        assert.deepEqual(source, data);
        assert.notEqual(source.points, data.points);
        assert.notEqual(source.segments[1].control1, data.segments[1].control1);
        assert.notEqual(source.corners, data.corners);
    });

    it('円と弧・未知の種類はnull', () => {
        assert.equal(outlineSourceOf(new Ellipse(0, 0, 10, 10).toJSON()), null);
        assert.equal(outlineSourceOf({ type: 'arc', points: [] }), null);
        assert.equal(outlineSourceOf({ type: 'unknown' }), null);
    });

    it('引数を書き換えない', () => {
        const data = new Rect(0, 0, 20, 10).toJSON();
        const before = JSON.stringify(data);
        outlineSourceOf(data);
        assert.equal(JSON.stringify(data), before);
        const curveData = new Curve(0, 0, 30, 60, 60, 0).toJSON();
        const beforeCurve = JSON.stringify(curveData);
        outlineSourceOf(curveData);
        assert.equal(JSON.stringify(curveData), beforeCurve);
    });
});

describe('PathVertexRules.findNearestSegmentLocation: 直線の区間', () => {
    const open = outlineSourceOf(new Line(0, 0, 100, 0).toJSON());

    it('途中の位置', () => {
        const location = findNearestSegmentLocation(open, { x: 30, y: 4 }, 5);
        assert.equal(location.segmentIndex, 0);
        assert.equal(location.t, 0.3);
        assert.deepEqual(location.point, { x: 30, y: 0 });
        assert.equal(location.distance, 4);
    });

    it('端の外側ではtが0・1に収まる', () => {
        const before = findNearestSegmentLocation(open, { x: -2, y: 1 }, 5);
        assert.equal(before.t, 0);
        assert.deepEqual(before.point, { x: 0, y: 0 });
        const after = findNearestSegmentLocation(open, { x: 103, y: 0 }, 5);
        assert.equal(after.t, 1);
        assert.deepEqual(after.point, { x: 100, y: 0 });
    });

    it('長さ0の区間はt = 0', () => {
        const zero = {
            type: 'path',
            points: [{ x: 5, y: 5 }, { x: 5, y: 5 }],
            closed: false,
            segments: [{ kind: 'line' }],
        };
        const location = findNearestSegmentLocation(zero, { x: 6, y: 5 }, 5);
        assert.equal(location.t, 0);
        assert.deepEqual(location.point, { x: 5, y: 5 });
        assert.equal(location.distance, 1);
    });

    it('許容幅の外はnull・ちょうどは当たり', () => {
        assert.equal(findNearestSegmentLocation(open, { x: 50, y: 5.001 }, 5), null);
        assert.notEqual(findNearestSegmentLocation(open, { x: 50, y: 5 }, 5), null);
    });

    it('点が1つの元は null', () => {
        const single = { type: 'path', points: [{ x: 0, y: 0 }], closed: false, segments: [] };
        assert.equal(findNearestSegmentLocation(single, { x: 0, y: 0 }, 100), null);
    });

    it('引数を書き換えない', () => {
        const point = { x: 30, y: 4 };
        const before = JSON.stringify([open, point]);
        findNearestSegmentLocation(open, point, 5);
        assert.equal(JSON.stringify([open, point]), before);
    });
});

describe('PathVertexRules.findNearestSegmentLocation: 曲線の区間', () => {
    /**
     * 折れ線の近似（Path.hitTestと同じ小区間）での点との最短距離を求める。
     * @param {{x: number, y: number}[]} cubic - 始点・引っ張る点1・引っ張る点2・終点
     * @param {{x: number, y: number}} point - 点
     * @returns {number} 距離
     */
    function polylineDistance(cubic, point) {
        const [a, c1, c2, b] = cubic;
        const n = SMOOTH_SEGMENT_SAMPLE_COUNT;
        let prev = a;
        let min = Infinity;
        for (let k = 1; k <= n; k++) {
            const next = k === n ? b : cubicBezierPoint(a, c1, c2, b, k / n);
            const dx = next.x - prev.x;
            const dy = next.y - prev.y;
            const len2 = dx * dx + dy * dy;
            const s = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - prev.x) * dx + (point.y - prev.y) * dy) / len2));
            min = Math.min(min, Math.hypot(point.x - (prev.x + s * dx), point.y - (prev.y + s * dy)));
            prev = next;
        }
        return min;
    }

    it('smoothの区間：点が曲線の上に乗り、距離は折れ線の近似の距離', () => {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 50, y: 40 }, { x: 100, y: 0 }],
            false,
            '#000',
            2,
            null,
            [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH],
        );
        const source = path.toJSON();
        const controls = resolveSegmentControls(source);
        const query = { x: 20, y: 30 };
        const location = findNearestSegmentLocation(source, query, 100);
        assert.ok(location.segmentIndex === 0 || location.segmentIndex === 1);
        const i = location.segmentIndex;
        const a = source.points[i];
        const b = source.points[i + 1];
        const onCurve = cubicBezierPoint(a, controls[i].control1, controls[i].control2, b, location.t);
        assert.ok(dist(onCurve, location.point) < 1e-9);
        assert.ok(Math.abs(location.distance - polylineDistance([a, controls[i].control1, controls[i].control2, b], query)) < 1e-9);
        // 真の曲線の上で最も近い点：近くのtより遠くない
        const d = dist(query, location.point);
        for (const dt of [-0.01, -0.001, 0.001, 0.01]) {
            const t = Math.max(0, Math.min(1, location.t + dt));
            assert.ok(d <= dist(query, cubicBezierPoint(a, controls[i].control1, controls[i].control2, b, t)) + 1e-9);
        }
    });

    it('bezierの区間：曲線の上の最も近い点を返す', () => {
        const c1 = { x: 0, y: 60 };
        const c2 = { x: 100, y: 60 };
        const source = {
            type: 'path',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
            closed: false,
            segments: [{ kind: 'bezier', control1: c1, control2: c2 }],
        };
        const target = cubicBezierPoint(source.points[0], c1, c2, source.points[1], 0.4);
        const location = findNearestSegmentLocation(source, { x: target.x, y: target.y + 2 }, 10);
        assert.equal(location.segmentIndex, 0);
        assert.ok(Math.abs(location.t - 0.4) < 0.05);
        assert.ok(dist(location.point, cubicBezierPoint(source.points[0], c1, c2, source.points[1], location.t)) < 1e-9);
    });

    it('曲線の上の点そのものを渡すとtが一致する', () => {
        const c1 = { x: 10, y: 50 };
        const c2 = { x: 80, y: -30 };
        const source = {
            type: 'path',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
            closed: false,
            segments: [{ kind: 'bezier', control1: c1, control2: c2 }],
        };
        const query = cubicBezierPoint(source.points[0], c1, c2, source.points[1], 0.62);
        const location = findNearestSegmentLocation(source, query, 1);
        assert.ok(Math.abs(location.t - 0.62) < 1e-6);
        assert.ok(location.distance < 1e-6);
    });
});

describe('PathVertexRules.findNearestSegmentLocation: 区間の選び方', () => {
    it('閉じたパスの最後の区間（points[n-1]→points[0]）はsegmentIndexがn-1', () => {
        const source = outlineSourceOf(new Rect(0, 0, 100, 100).toJSON());
        const location = findNearestSegmentLocation(source, { x: -2, y: 40 }, 5);
        assert.equal(location.segmentIndex, 3);
        assert.equal(location.t, 0.6);
        assert.deepEqual(location.point, { x: 0, y: 40 });
    });

    it('複数の区間では最も近いものを選ぶ', () => {
        const source = outlineSourceOf(new Rect(0, 0, 100, 100).toJSON());
        const location = findNearestSegmentLocation(source, { x: 60, y: 97 }, 10);
        assert.equal(location.segmentIndex, 2);
        assert.equal(location.distance, 3);
    });

    it('同じ距離なら番号の小さい区間', () => {
        const source = {
            type: 'path',
            points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }],
            closed: false,
            segments: [{ kind: 'line' }, { kind: 'line' }],
        };
        // 頂点(10, 0)から区間0・区間1までの距離がどちらも0
        const location = findNearestSegmentLocation(source, { x: 10, y: 0 }, 5);
        assert.equal(location.segmentIndex, 0);
        assert.equal(location.t, 1);
    });
});

describe('PathVertexRules.splitCubicBezier', () => {
    const p0 = { x: 0, y: 0 };
    const p1 = { x: 10, y: 60 };
    const p2 = { x: 90, y: -20 };
    const p3 = { x: 100, y: 30 };

    it('分けた点はcubicBezierPointのtの点と一致する', () => {
        for (const t of [0.1, 0.25, 0.5, 0.8]) {
            const split = splitCubicBezier(p0, p1, p2, p3, t);
            assert.ok(dist(split.point, cubicBezierPoint(p0, p1, p2, p3, t)) < 1e-9);
        }
    });

    it('前半・後半は元の曲線と同じ形（多数のtで1e-9以内）', () => {
        const t = 0.37;
        const split = splitCubicBezier(p0, p1, p2, p3, t);
        for (let k = 0; k <= 50; k++) {
            const u = k / 50;
            const first = cubicBezierPoint(p0, split.first.control1, split.first.control2, split.point, u);
            assert.ok(dist(first, cubicBezierPoint(p0, p1, p2, p3, u * t)) < 1e-9);
            const second = cubicBezierPoint(split.point, split.second.control1, split.second.control2, p3, u);
            assert.ok(dist(second, cubicBezierPoint(p0, p1, p2, p3, t + u * (1 - t))) < 1e-9);
        }
    });

    it('引数を書き換えず、結果は引数と座標を共有しない', () => {
        const input = [p0, p1, p2, p3].map((p) => ({ x: p.x, y: p.y }));
        const before = JSON.stringify(input);
        const split = splitCubicBezier(input[0], input[1], input[2], input[3], 0.5);
        assert.equal(JSON.stringify(input), before);
        for (const p of [split.first.control1, split.first.control2, split.point, split.second.control1, split.second.control2]) {
            assert.ok(!input.includes(p));
        }
    });
});
