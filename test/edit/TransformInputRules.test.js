/**
 * 責務: TransformInputRules（幅・高さ・角度・反転の押せる条件・表示内容・入力から変換を求める規則）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    SIZE_AXIS,
    FLIP_AXIS,
    ANGLE_INPUT_IDLE_TEXT,
    canTransformSelection,
    buildSizeInputView,
    buildTransformInputView,
    resolveSizeTransform,
    resolveRotationTransform,
    resolveFlipTransform
} from '../../js/edit/TransformInputRules.js';
import { applyAffineTransformToPoint } from '../../js/shapes/ShapeGeometry.js';

const SHAPES = { type: 'shapes', shapeIds: ['a'] };
const BOUNDS = { minX: 10, minY: 20, maxX: 110, maxY: 70 };
const SIZE_EMPTY = { width: '', height: '', widthDisabled: true, heightDisabled: true, lockDisabled: true, aspectLocked: false };

/**
 * 2つの点がほぼ同じか確かめる。
 * @param {{x: number, y: number}} actual - 実際の点
 * @param {{x: number, y: number}} expected - 期待する点
 */
function assertPointClose(actual, expected) {
    assert.ok(Math.abs(actual.x - expected.x) < 1e-9, `x: ${actual.x} != ${expected.x}`);
    assert.ok(Math.abs(actual.y - expected.y) < 1e-9, `y: ${actual.y} != ${expected.y}`);
}

test('定数は凍結されている', () => {
    assert.deepEqual({ ...SIZE_AXIS }, { WIDTH: 'width', HEIGHT: 'height' });
    assert.deepEqual({ ...FLIP_AXIS }, { HORIZONTAL: 'horizontal', VERTICAL: 'vertical' });
    assert.ok(Object.isFrozen(SIZE_AXIS));
    assert.ok(Object.isFrozen(FLIP_AXIS));
    assert.equal(ANGLE_INPUT_IDLE_TEXT, '0');
});

test('canTransformSelection: 対象なし・頂点の対象・外枠なし・有限でない外枠は偽', () => {
    assert.equal(canTransformSelection(null, BOUNDS), false);
    assert.equal(canTransformSelection(undefined, BOUNDS), false);
    assert.equal(canTransformSelection({ type: 'vertices' }, BOUNDS), false);
    assert.equal(canTransformSelection(SHAPES, null), false);
    assert.equal(canTransformSelection(SHAPES, undefined), false);
    assert.equal(canTransformSelection(SHAPES, { ...BOUNDS, minX: Infinity }), false);
    assert.equal(canTransformSelection(SHAPES, { ...BOUNDS, minY: NaN }), false);
    assert.equal(canTransformSelection(SHAPES, { ...BOUNDS, maxX: -Infinity }), false);
    assert.equal(canTransformSelection(SHAPES, { ...BOUNDS, maxY: NaN }), false);
});

test('canTransformSelection: 図形かつ有限の外枠なら真（幅0・高さ0でも真）', () => {
    assert.equal(canTransformSelection(SHAPES, BOUNDS), true);
    assert.equal(canTransformSelection(SHAPES, { minX: 5, minY: 5, maxX: 5, maxY: 5 }), true);
});

test('buildSizeInputView: 押せないときは空で押せない', () => {
    assert.deepEqual(buildSizeInputView(false, BOUNDS, true), SIZE_EMPTY);
    assert.deepEqual(buildSizeInputView(false, null, false), SIZE_EMPTY);
});

test('buildSizeInputView: 小数第1位の文字列で押せる', () => {
    const view = buildSizeInputView(true, { minX: 0, minY: 0, maxX: 99.96, maxY: 50.04 }, false);
    assert.deepEqual(view, {
        width: '100.0',
        height: '50.0',
        widthDisabled: false,
        heightDisabled: false,
        lockDisabled: false,
        aspectLocked: false
    });
});

test('buildSizeInputView: 幅0・高さ0の向きは0.0を出して押せない', () => {
    const horizontalLine = buildSizeInputView(true, { minX: 0, minY: 5, maxX: 30, maxY: 5 }, false);
    assert.equal(horizontalLine.width, '30.0');
    assert.equal(horizontalLine.height, '0.0');
    assert.equal(horizontalLine.widthDisabled, false);
    assert.equal(horizontalLine.heightDisabled, true);
    assert.equal(horizontalLine.lockDisabled, false);
    const verticalLine = buildSizeInputView(true, { minX: 7, minY: 0, maxX: 7, maxY: 40 }, false);
    assert.equal(verticalLine.width, '0.0');
    assert.equal(verticalLine.widthDisabled, true);
    assert.equal(verticalLine.heightDisabled, false);
});

test('buildSizeInputView: aspectLockedは真偽値の真のときだけ真', () => {
    assert.equal(buildSizeInputView(true, BOUNDS, true).aspectLocked, true);
    assert.equal(buildSizeInputView(true, BOUNDS, false).aspectLocked, false);
    assert.equal(buildSizeInputView(true, BOUNDS, 1).aspectLocked, false);
});

test('buildTransformInputView: 押せないときと押せるとき', () => {
    assert.deepEqual(buildTransformInputView(false, 'nw'), { angle: '', referencePoint: null, disabled: true });
    assert.deepEqual(buildTransformInputView(true, 'nw'), { angle: '0', referencePoint: 'nw', disabled: false });
    assert.deepEqual(buildTransformInputView(true, 'center'), { angle: '0', referencePoint: 'center', disabled: false });
});

test('resolveSizeTransform: 受理しない入力は null', () => {
    const origin = { x: 60, y: 45 };
    for (const text of ['', '   ', 'abc', '0', '-10', 'Infinity', null, undefined, 5]) {
        assert.equal(resolveSizeTransform(SIZE_AXIS.WIDTH, text, BOUNDS, origin, false), null, String(text));
    }
});

test('resolveSizeTransform: 未知の軸・長さ0の軸・今と同じ値は null', () => {
    const origin = { x: 60, y: 45 };
    assert.equal(resolveSizeTransform('depth', '200', BOUNDS, origin, false), null);
    assert.equal(resolveSizeTransform(undefined, '200', BOUNDS, origin, false), null);
    const flat = { minX: 0, minY: 5, maxX: 100, maxY: 5 };
    assert.equal(resolveSizeTransform(SIZE_AXIS.HEIGHT, '20', flat, origin, false), null);
    assert.equal(resolveSizeTransform(SIZE_AXIS.WIDTH, '100', BOUNDS, origin, false), null);
    assert.equal(resolveSizeTransform(SIZE_AXIS.HEIGHT, '50', BOUNDS, origin, false), null);
});

test('resolveSizeTransform: 鍵なしは入れた軸だけ倍率が掛かる（外枠 0,0-100,50・基準点の位置 (50, 25)）', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const origin = { x: 50, y: 25 };
    assert.deepEqual(
        resolveSizeTransform(SIZE_AXIS.WIDTH, '200', bounds, origin, false),
        { a: 2, b: 0, c: 0, d: 1, e: -50, f: 0 }
    );
    assert.deepEqual(
        resolveSizeTransform(SIZE_AXIS.HEIGHT, '25', bounds, origin, false),
        { a: 1, b: 0, c: 0, d: 0.5, e: 0, f: 12.5 }
    );
});

test('resolveSizeTransform: 鍵ありはもう一方も同じ倍率', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
    const origin = { x: 50, y: 25 };
    assert.deepEqual(
        resolveSizeTransform(SIZE_AXIS.WIDTH, '200', bounds, origin, true),
        { a: 2, b: 0, c: 0, d: 2, e: -50, f: -25 }
    );
    assert.deepEqual(
        resolveSizeTransform(SIZE_AXIS.HEIGHT, '25', bounds, origin, true),
        { a: 0.5, b: 0, c: 0, d: 0.5, e: 25, f: 12.5 }
    );
});

test('resolveSizeTransform: 鍵ありでもう一方の長さが0なら、もう一方は倍率1', () => {
    const flat = { minX: 0, minY: 5, maxX: 100, maxY: 5 };
    assert.deepEqual(
        resolveSizeTransform(SIZE_AXIS.WIDTH, '200', flat, { x: 0, y: 5 }, true),
        { a: 2, b: 0, c: 0, d: 1, e: 0, f: 0 }
    );
    const vertical = { minX: 5, minY: 0, maxX: 5, maxY: 100 };
    assert.deepEqual(
        resolveSizeTransform(SIZE_AXIS.HEIGHT, '50', vertical, { x: 5, y: 0 }, true),
        { a: 1, b: 0, c: 0, d: 0.5, e: 0, f: 0 }
    );
});

test('resolveSizeTransform: 倍率は表示の丸めでなく実際の長さで求める（99.99の幅に100）', () => {
    const bounds = { minX: 0, minY: 0, maxX: 99.99, maxY: 10 };
    const transform = resolveSizeTransform(SIZE_AXIS.WIDTH, '100', bounds, { x: 0, y: 0 }, false);
    assert.equal(transform.a, 100 / 99.99);
    assert.equal(transform.d, 1);
});

test('resolveSizeTransform: 小数の入力・基準点が動かない', () => {
    const origins = [
        { x: 10, y: 20 },
        { x: 110, y: 70 },
        { x: 60, y: 45 },
        { x: 10, y: 70 }
    ];
    for (const origin of origins) {
        const transform = resolveSizeTransform(SIZE_AXIS.WIDTH, '12.5', BOUNDS, origin, true);
        assert.ok(Math.abs(transform.a - 0.125) < 1e-12);
        assert.ok(Math.abs(transform.d - 0.125) < 1e-12);
        assertPointClose(applyAffineTransformToPoint(transform, origin), origin);
    }
});

test('resolveRotationTransform: 受理しない入力・0は null', () => {
    const origin = { x: 0, y: 0 };
    for (const text of ['', '  ', 'abc', '0', '0.0', '-0', null, undefined, 30]) {
        assert.equal(resolveRotationTransform(text, origin), null, String(text));
    }
});

test('resolveRotationTransform: プラスは画面で反時計回り（中心(0,0)・点(10,0)）', () => {
    const origin = { x: 0, y: 0 };
    assert.deepEqual(applyAffineTransformToPoint(resolveRotationTransform('90', origin), { x: 10, y: 0 }), { x: 0, y: -10 });
    assert.deepEqual(applyAffineTransformToPoint(resolveRotationTransform('-90', origin), { x: 10, y: 0 }), { x: 0, y: 10 });
});

test('resolveRotationTransform: 90・180・-90・450 は係数がちょうどの 0・±1', () => {
    const origin = { x: 0, y: 0 };
    assert.deepEqual(resolveRotationTransform('90', origin), { a: 0, b: -1, c: 1, d: 0, e: 0, f: 0 });
    assert.deepEqual(resolveRotationTransform('180', origin), { a: -1, b: 0, c: 0, d: -1, e: 0, f: 0 });
    assert.deepEqual(resolveRotationTransform('-90', origin), { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
    assert.deepEqual(resolveRotationTransform('450', origin), { a: 0, b: -1, c: 1, d: 0, e: 0, f: 0 });
});

test('resolveRotationTransform: 30° は b が負（反時計回り）', () => {
    const transform = resolveRotationTransform('30', { x: 0, y: 0 });
    assert.ok(transform.b < 0);
    assert.ok(Math.abs(transform.a - Math.cos(Math.PI / 6)) < 1e-12);
    assert.ok(Math.abs(transform.b + 0.5) < 1e-12);
});

test('resolveRotationTransform: 基準点の周りに回る（中心(10, 20)・90°で(20, 20)→(10, 10)）', () => {
    const origin = { x: 10, y: 20 };
    const transform = resolveRotationTransform('90', origin);
    assert.deepEqual(applyAffineTransformToPoint(transform, origin), origin);
    assert.deepEqual(applyAffineTransformToPoint(transform, { x: 20, y: 20 }), { x: 10, y: 10 });
});

test('resolveFlipTransform: 横・縦・基準点ごと', () => {
    assert.deepEqual(
        resolveFlipTransform(FLIP_AXIS.HORIZONTAL, { x: 10, y: 20 }),
        { a: -1, b: 0, c: 0, d: 1, e: 20, f: 0 }
    );
    assert.deepEqual(
        resolveFlipTransform(FLIP_AXIS.VERTICAL, { x: 10, y: 20 }),
        { a: 1, b: 0, c: 0, d: -1, e: 0, f: 40 }
    );
    assert.deepEqual(
        resolveFlipTransform(FLIP_AXIS.HORIZONTAL, { x: 50, y: 5 }),
        { a: -1, b: 0, c: 0, d: 1, e: 100, f: 0 }
    );
});

test('resolveFlipTransform: 基準点は動かない・未知の軸は null', () => {
    const origin = { x: 33, y: 44 };
    assert.deepEqual(applyAffineTransformToPoint(resolveFlipTransform(FLIP_AXIS.HORIZONTAL, origin), origin), origin);
    assert.deepEqual(applyAffineTransformToPoint(resolveFlipTransform(FLIP_AXIS.VERTICAL, origin), origin), origin);
    assert.equal(resolveFlipTransform('diagonal', origin), null);
    assert.equal(resolveFlipTransform(undefined, origin), null);
});

test('引数を書き換えない', () => {
    const bounds = { ...BOUNDS };
    const origin = { x: 60, y: 45 };
    resolveSizeTransform(SIZE_AXIS.WIDTH, '200', bounds, origin, true);
    resolveRotationTransform('30', origin);
    resolveFlipTransform(FLIP_AXIS.HORIZONTAL, origin);
    assert.deepEqual(bounds, BOUNDS);
    assert.deepEqual(origin, { x: 60, y: 45 });
});
