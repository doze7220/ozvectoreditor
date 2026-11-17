/**
 * 責務: PositionInputRules（位置の欄の表示内容と入力から移動量を求める規則）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { POSITION_AXIS, buildPositionInputView, resolvePositionDelta } from '../../js/edit/PositionInputRules.js';

const TARGET = { kind: 'shapes', shapeIds: ['a'] };
const EMPTY = { x: '', y: '', disabled: true };

test('POSITION_AXISはxとyで凍結されている', () => {
    assert.deepEqual({ ...POSITION_AXIS }, { X: 'x', Y: 'y' });
    assert.ok(Object.isFrozen(POSITION_AXIS));
});

test('buildPositionInputView: 対象なし・範囲なしは空で押せない', () => {
    const bounds = { minX: 1, minY: 2 };
    assert.deepEqual(buildPositionInputView(null, bounds), EMPTY);
    assert.deepEqual(buildPositionInputView(undefined, bounds), EMPTY);
    assert.deepEqual(buildPositionInputView(TARGET, null), EMPTY);
    assert.deepEqual(buildPositionInputView(TARGET, undefined), EMPTY);
});

test('buildPositionInputView: 範囲の値が有限でないと空で押せない', () => {
    assert.deepEqual(buildPositionInputView(TARGET, { minX: Infinity, minY: 0 }), EMPTY);
    assert.deepEqual(buildPositionInputView(TARGET, { minX: 0, minY: NaN }), EMPTY);
    assert.deepEqual(buildPositionInputView(TARGET, { minX: 0, minY: -Infinity }), EMPTY);
});

test('buildPositionInputView: 小数第1位の文字列で押せる', () => {
    assert.deepEqual(buildPositionInputView(TARGET, { minX: 120.45, minY: -40 }), { x: '120.5', y: '-40.0', disabled: false });
});

test('buildPositionInputView: -0と-0.04は0.0になる', () => {
    assert.deepEqual(buildPositionInputView(TARGET, { minX: -0, minY: -0.04 }), { x: '0.0', y: '0.0', disabled: false });
});

test('buildPositionInputView: 対象の種類で結果が変わらない', () => {
    const bounds = { minX: 3, minY: 4 };
    assert.deepEqual(
        buildPositionInputView({ kind: 'vertices' }, bounds),
        buildPositionInputView({ kind: 'shapes' }, bounds)
    );
});

test('buildPositionInputView: 引数を書き換えない', () => {
    const target = { kind: 'shapes', shapeIds: ['a', 'b'] };
    const bounds = { minX: 1.25, minY: 2.5, maxX: 9, maxY: 8 };
    buildPositionInputView(target, bounds);
    assert.deepEqual(target, { kind: 'shapes', shapeIds: ['a', 'b'] });
    assert.deepEqual(bounds, { minX: 1.25, minY: 2.5, maxX: 9, maxY: 8 });
});

test('resolvePositionDelta: 受理しない入力はnull', () => {
    const bounds = { minX: 10, minY: 20 };
    for (const text of ['', '   ', 'abc', '1e999', 'NaN', 'Infinity', '-Infinity', null, undefined, 5]) {
        assert.equal(resolvePositionDelta(POSITION_AXIS.X, text, bounds), null, String(text));
    }
});

test('resolvePositionDelta: 範囲なし・軸の最小値が有限でないとnull', () => {
    assert.equal(resolvePositionDelta(POSITION_AXIS.X, '5', null), null);
    assert.equal(resolvePositionDelta(POSITION_AXIS.X, '5', undefined), null);
    assert.equal(resolvePositionDelta(POSITION_AXIS.X, '5', { minX: NaN, minY: 0 }), null);
    assert.equal(resolvePositionDelta(POSITION_AXIS.Y, '5', { minX: 0, minY: Infinity }), null);
});

test('resolvePositionDelta: X軸はdyが0、Y軸はdxが0', () => {
    const bounds = { minX: 10, minY: 20 };
    assert.deepEqual(resolvePositionDelta(POSITION_AXIS.X, '25', bounds), { dx: 15, dy: 0 });
    assert.deepEqual(resolvePositionDelta(POSITION_AXIS.Y, '5', bounds), { dx: 0, dy: -15 });
});

test('resolvePositionDelta: 他方の軸の最小値が有限でなくても指定軸は求まる', () => {
    assert.deepEqual(resolvePositionDelta(POSITION_AXIS.X, '5', { minX: 1, minY: NaN }), { dx: 4, dy: 0 });
});

test('resolvePositionDelta: 移動量が0ならnull', () => {
    const bounds = { minX: 10, minY: 20 };
    assert.equal(resolvePositionDelta(POSITION_AXIS.X, '10', bounds), null);
    assert.equal(resolvePositionDelta(POSITION_AXIS.Y, '20.0', bounds), null);
});

test('resolvePositionDelta: 未知の軸はnull', () => {
    const bounds = { minX: 10, minY: 20 };
    assert.equal(resolvePositionDelta('z', '5', bounds), null);
    assert.equal(resolvePositionDelta(undefined, '5', bounds), null);
    assert.equal(resolvePositionDelta('X', '5', bounds), null);
});
test('resolvePositionDelta: 小数・負の値を丸めずに移動量にする', () => {
    assert.equal(resolvePositionDelta(POSITION_AXIS.X, '20', { minX: 10.04, minY: 0 }).dx, 20 - 10.04);
    assert.deepEqual(resolvePositionDelta(POSITION_AXIS.Y, '-7.25', { minX: 0, minY: 2.5 }), { dx: 0, dy: -9.75 });
    assert.deepEqual(resolvePositionDelta(POSITION_AXIS.X, ' 3 ', { minX: 1, minY: 0 }), { dx: 2, dy: 0 });
});

test('resolvePositionDelta: 引数を書き換えず毎回新しいオブジェクトを返す', () => {
    const bounds = { minX: 10, minY: 20, maxX: 30, maxY: 40 };
    const first = resolvePositionDelta(POSITION_AXIS.X, '25', bounds);
    const second = resolvePositionDelta(POSITION_AXIS.X, '25', bounds);
    assert.deepEqual(bounds, { minX: 10, minY: 20, maxX: 30, maxY: 40 });
    assert.notEqual(first, second);
    assert.deepEqual(first, second);
});
