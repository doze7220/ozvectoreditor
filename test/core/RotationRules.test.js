/**
 * 責務: RotationRules（回転の範囲の当たり・カーソル・回した角度・回転の変換・回している間の外枠）の規則を検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    ROTATION_ZONE_SCREEN_PX,
    ROTATION_SNAP_STEP,
    hitTestRotationZone,
    resolveRotationCursor,
    computeRotationCenter,
    computeRotationAngle,
    toRotationTransform,
    rotateScaleFrame,
    resolveDisplayedScaleFrame
} from '../../js/core/RotationRules.js';
import { collectScaleFrame } from '../../js/core/ScaleHandleRules.js';
import { OperationMode } from '../../js/core/InputModes.js';

const frameOf = (minX, minY, maxX, maxY, scale = 1) => collectScaleFrame(OperationMode.SELECT, { minX, minY, maxX, maxY }, scale);
const close = (actual, expected, eps = 1e-9) => assert.ok(Math.abs(actual - expected) <= eps, `${actual} != ${expected}`);
const DEG = Math.PI / 180;

describe('hitTestRotationZone', () => {
    const frame = frameOf(0, 0, 100, 100);
    test('4つの角の外側で各角の名前', () => {
        assert.equal(hitTestRotationZone(frame, { x: -10, y: -10 }, 1), 'nw');
        assert.equal(hitTestRotationZone(frame, { x: 110, y: -10 }, 1), 'ne');
        assert.equal(hitTestRotationZone(frame, { x: 110, y: 110 }, 1), 'se');
        assert.equal(hitTestRotationZone(frame, { x: -10, y: 110 }, 1), 'sw');
    });
    test('外枠の内側・境界は null', () => {
        assert.equal(hitTestRotationZone(frame, { x: 50, y: 50 }, 1), null);
        assert.equal(hitTestRotationZone(frame, { x: 100, y: 50 }, 1), null);
        assert.equal(hitTestRotationZone(frame, { x: 50, y: 0 }, 1), null);
    });
    test('角のハンドルの上(6px以内)・辺のハンドルの上は null', () => {
        assert.equal(hitTestRotationZone(frame, { x: -6, y: -6 }, 1), null);
        assert.equal(hitTestRotationZone(frame, { x: 50, y: -6 }, 1), null);
        assert.equal(hitTestRotationZone(frame, { x: 106, y: 50 }, 1), null);
    });
    test('20pxちょうどは当たり・超えると null', () => {
        assert.equal(hitTestRotationZone(frame, { x: -20, y: 0 }, 1), 'nw');
        assert.equal(hitTestRotationZone(frame, { x: -20.001, y: 0 }, 1), null);
        assert.equal(ROTATION_ZONE_SCREEN_PX, 20);
    });
    test('範囲が重なる小さい外枠では近い角', () => {
        const small = frameOf(0, 0, 10, 10);
        assert.equal(hitTestRotationZone(small, { x: 20, y: 4 }, 1), 'ne');
        assert.equal(hitTestRotationZone(small, { x: 20, y: 6 }, 1), 'se');
        assert.equal(hitTestRotationZone(small, { x: 4, y: -12 }, 1), 'nw');
    });
    test('幅0・高さ0の外枠の両端の外側(線分の上は null)', () => {
        const vertical = frameOf(0, 0, 0, 100);
        assert.equal(hitTestRotationZone(vertical, { x: 0, y: -10 }, 1), 'nw');
        assert.equal(hitTestRotationZone(vertical, { x: 0, y: 110 }, 1), 'se');
        assert.equal(hitTestRotationZone(vertical, { x: 0, y: 50 }, 1), null);
        const horizontal = frameOf(0, 0, 100, 0);
        assert.equal(hitTestRotationZone(horizontal, { x: -10, y: 0 }, 1), 'nw');
        assert.equal(hitTestRotationZone(horizontal, { x: 110, y: 0 }, 1), 'ne');
        assert.equal(hitTestRotationZone(horizontal, { x: 50, y: 0 }, 1), null);
    });
    test('表示倍率で範囲の広さがワールドで変わる', () => {
        const f2 = frameOf(0, 0, 100, 100, 2);
        assert.equal(hitTestRotationZone(f2, { x: -10, y: 0 }, 2), 'nw');
        assert.equal(hitTestRotationZone(f2, { x: -10.5, y: 0 }, 2), null);
        const f05 = frameOf(0, 0, 100, 100, 0.5);
        assert.equal(hitTestRotationZone(f05, { x: -40, y: 0 }, 0.5), 'nw');
        assert.equal(hitTestRotationZone(f05, { x: -41, y: 0 }, 0.5), null);
    });
    test('frame が null・viewScale が不正なら null', () => {
        assert.equal(hitTestRotationZone(null, { x: -10, y: -10 }, 1), null);
        for (const bad of [0, -1, NaN, Infinity, undefined, '1']) {
            assert.equal(hitTestRotationZone(frame, { x: -10, y: -10 }, bad), null);
        }
    });
    test('引数を書き換えない', () => {
        const snapshot = JSON.stringify(frame);
        hitTestRotationZone(frame, { x: -10, y: -10 }, 1);
        assert.equal(JSON.stringify(frame), snapshot);
    });
});

describe('resolveRotationCursor', () => {
    const corners = ['nw', 'ne', 'se', 'sw'];
    test('4つの角で別の値・形式', () => {
        const values = corners.map(resolveRotationCursor);
        assert.equal(new Set(values).size, 4);
        for (const v of values) {
            assert.ok(v.startsWith('url("data:image/svg+xml,'));
            assert.ok(v.endsWith('") 12 12, auto'));
        }
    });
    test('各値に rotate(0・90・180・270 のどれかが入る', () => {
        const expected = { ne: 'rotate(0 ', se: 'rotate(90 ', sw: 'rotate(180 ', nw: 'rotate(270 ' };
        for (const corner of corners) {
            const decoded = decodeURIComponent(resolveRotationCursor(corner));
            assert.ok(decoded.includes(expected[corner]), corner);
        }
    });
    test('未知の名前・null・constructor は null', () => {
        for (const name of ['n', 'e', '', 'x', 'constructor', 'toString', '__proto__', null, undefined, 1]) {
            assert.equal(resolveRotationCursor(name), null);
        }
    });
});

describe('computeRotationCenter', () => {
    test('外枠の中心・新しいオブジェクト', () => {
        const frame = frameOf(10, 20, 50, 100);
        const c = computeRotationCenter(frame);
        assert.deepEqual(c, { x: 30, y: 60 });
        assert.notEqual(c, computeRotationCenter(frame));
    });
});

describe('computeRotationAngle', () => {
    const center = { x: 0, y: 0 };
    const origin = { x: 10, y: 0 };
    const run = (pointer, previousRaw = 0, snapToStep = false) => computeRotationAngle({ center, origin, pointer, previousRaw, snapToStep });
    const at = (deg) => ({ x: 10 * Math.cos(deg * DEG), y: 10 * Math.sin(deg * DEG) });
    test('時計回り(画面の下へ)は正', () => {
        const r = run({ x: 0, y: 10 });
        close(r.raw, Math.PI / 2);
        close(r.angle, Math.PI / 2);
    });
    test('反時計回りは負', () => {
        close(run({ x: 0, y: -10 }).raw, -Math.PI / 2);
    });
    test('動かさなければ 0', () => {
        assert.equal(run({ x: 10, y: 0 }).raw, 0);
    });
    test('±180°の境目をまたいでも跳ねない', () => {
        let raw = 0;
        for (const deg of [30, 90, 150, 179, 181, 210]) {
            raw = run(at(deg), raw).raw;
            close(raw, deg * DEG);
        }
        for (const deg of [179, 150]) {
            raw = run(at(deg), raw).raw;
            close(raw, deg * DEG);
        }
    });
    test('3周回す', () => {
        let raw = 0;
        for (let deg = 10; deg <= 1080; deg += 10) {
            raw = run(at(deg), raw).raw;
        }
        close(raw, 1080 * DEG);
    });
    test('Shift の15°刻み', () => {
        const r = run(at(22), 0, true);
        close(r.raw, 22 * DEG);
        close(r.angle, 15 * DEG);
        close(run(at(-38), 0, true).angle, -45 * DEG);
        assert.equal(ROTATION_SNAP_STEP, Math.PI / 12);
    });
    test('Shift の中間は0から遠い側・-0は0', () => {
        close(run(at(7.5 + 1e-6), 0, true).angle, 15 * DEG);
        close(run(at(-(7.5 + 1e-6)), 0, true).angle, -15 * DEG);
        const small = run(at(3), 0, true);
        assert.equal(Object.is(small.angle, 0), true);
        const negSmall = run(at(-3), 0, true);
        assert.equal(Object.is(negSmall.angle, 0), true);
    });
    test('カーソルが中心に重なるときは previousRaw のまま', () => {
        const r = run({ x: 0, y: 0 }, 1.234);
        assert.equal(r.raw, 1.234);
        assert.equal(r.angle, 1.234);
        const s = run({ x: 0, y: 0 }, 1.234, true);
        assert.equal(s.raw, 1.234);
        close(s.angle, 15 * DEG * Math.round(1.234 / (15 * DEG)));
    });
    test('raw と angle の別', () => {
        const r = run(at(50), 0, true);
        close(r.raw, 50 * DEG);
        close(r.angle, 45 * DEG);
    });
    test('引数を書き換えない', () => {
        const input = { center: { x: 1, y: 2 }, origin: { x: 5, y: 2 }, pointer: { x: 1, y: 8 }, previousRaw: 0, snapToStep: false };
        const snapshot = JSON.stringify(input);
        computeRotationAngle(input);
        assert.equal(JSON.stringify(input), snapshot);
    });
});

describe('toRotationTransform', () => {
    const center = { x: 10, y: 20 };
    const origin = { x: 0, y: 0 };
    test('90°・180°・270°でちょうどの値', () => {
        const t90 = toRotationTransform(origin, Math.PI / 2);
        assert.deepEqual([t90.a, t90.b, t90.c, t90.d, t90.e, t90.f], [0, 1, -1, 0, 0, 0]);
        const t180 = toRotationTransform(origin, Math.PI);
        assert.deepEqual([t180.a, t180.b, t180.c, t180.d], [-1, 0, 0, -1]);
        const t270 = toRotationTransform(origin, (3 * Math.PI) / 2);
        assert.deepEqual([t270.a, t270.b, t270.c, t270.d], [0, -1, 1, 0]);
        const tNeg = toRotationTransform(origin, -Math.PI / 2);
        assert.deepEqual([tNeg.a, tNeg.b, tNeg.c, tNeg.d], [0, -1, 1, 0]);
        const tFull = toRotationTransform(origin, 4 * Math.PI);
        assert.deepEqual([tFull.a, tFull.b, tFull.c, tFull.d], [1, 0, 0, 1]);
    });
    test('90°の倍数の許容量内はちょうどの値・外は三角関数', () => {
        const near = toRotationTransform(origin, Math.PI + 1e-10);
        assert.deepEqual([near.a, near.b], [-1, 0]);
        const far = toRotationTransform(origin, Math.PI + 1e-7);
        assert.equal(far.b, Math.sin(Math.PI + 1e-7));
    });
    test('90°で座標に誤差が入らない', () => {
        const t = toRotationTransform(center, Math.PI / 2);
        const p = { x: 20, y: 20 };
        assert.equal(t.a * p.x + t.c * p.y + t.e, 10);
        assert.equal(t.b * p.x + t.d * p.y + t.f, 30);
    });
    test('中心が動かない', () => {
        for (const angle of [0.3, 1, 2.5, -1.7, Math.PI / 2, Math.PI]) {
            const t = toRotationTransform(center, angle);
            close(t.a * center.x + t.c * center.y + t.e, center.x);
            close(t.b * center.x + t.d * center.y + t.f, center.y);
        }
    });
    test('一般の角度は時計回り(画面)', () => {
        const t = toRotationTransform(origin, 30 * DEG);
        close(t.a, Math.cos(30 * DEG));
        close(t.b, Math.sin(30 * DEG));
        close(t.c, -Math.sin(30 * DEG));
        close(t.d, Math.cos(30 * DEG));
    });
    test('0° で恒等・-0 が出ない', () => {
        const t = toRotationTransform(center, 0);
        assert.deepEqual(t, { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        for (const angle of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
            for (const v of Object.values(toRotationTransform(origin, angle))) {
                assert.equal(Object.is(v, -0), false);
            }
        }
    });
});

describe('rotateScaleFrame', () => {
    const frame = frameOf(0, 0, 100, 60);
    test('90°で corners と handles の位置が回る', () => {
        const rotated = rotateScaleFrame(frame, toRotationTransform({ x: 50, y: 30 }, Math.PI / 2));
        assert.deepEqual(rotated.corners, [
            { x: 80, y: -20 },
            { x: 80, y: 80 },
            { x: 20, y: 80 },
            { x: 20, y: -20 }
        ]);
        assert.equal(rotated.handles.length, frame.handles.length);
        for (let i = 0; i < frame.handles.length; i++) {
            assert.equal(rotated.handles[i].name, frame.handles[i].name);
        }
        const n = rotated.handles.find((h) => h.name === 'n');
        assert.deepEqual({ x: n.x, y: n.y }, { x: 80, y: 30 });
    });
    test('bounds は写し・引数を書き換えない', () => {
        const snapshot = JSON.stringify(frame);
        const rotated = rotateScaleFrame(frame, toRotationTransform({ x: 50, y: 30 }, 1));
        assert.deepEqual(rotated.bounds, frame.bounds);
        assert.notEqual(rotated.bounds, frame.bounds);
        assert.equal(JSON.stringify(frame), snapshot);
    });
    test('恒等の変換では位置が同じ', () => {
        const rotated = rotateScaleFrame(frame, toRotationTransform({ x: 5, y: 5 }, 0));
        assert.deepEqual(rotated.handles, frame.handles);
        assert.deepEqual(rotated.corners.map((c) => [c.x, c.y]), [[0, 0], [100, 0], [100, 60], [0, 60]]);
    });
});

describe('resolveDisplayedScaleFrame', () => {
    const frame = frameOf(0, 0, 100, 60);
    test('rotationView が null なら同じオブジェクト', () => {
        assert.equal(resolveDisplayedScaleFrame(frame, null), frame);
        assert.equal(resolveDisplayedScaleFrame(null, null), null);
    });
    test('あれば引き始めの外枠を回した外枠', () => {
        const other = frameOf(500, 500, 600, 600);
        const view = { frame, center: { x: 50, y: 30 }, angle: Math.PI / 2 };
        const shown = resolveDisplayedScaleFrame(other, view);
        assert.deepEqual(shown, rotateScaleFrame(frame, toRotationTransform(view.center, view.angle)));
        assert.equal(shown.corners.length, 4);
    });
});
