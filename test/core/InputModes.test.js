/**
 * 責務: InputModes（入力状態InputStateの値・`Esc`で中断できるドラッグの一覧CANCELABLE_DRAG_STATES）の定義を検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { InputState, CANCELABLE_DRAG_STATES } from '../../js/core/InputModes.js';

describe('InputState', () => {
    test('ROTATING_SELECTIONの値は同名の文字列', () => {
        assert.equal(InputState.ROTATING_SELECTION, 'ROTATING_SELECTION');
    });
});

describe('CANCELABLE_DRAG_STATES', () => {
    test('SCALING_SELECTIONとROTATING_SELECTIONの2つだけ', () => {
        assert.deepEqual([...CANCELABLE_DRAG_STATES], [InputState.SCALING_SELECTION, InputState.ROTATING_SELECTION]);
    });
    test('凍結されている', () => {
        assert.equal(Object.isFrozen(CANCELABLE_DRAG_STATES), true);
    });
    test('回転のドラッグの状態を含み、中断できないドラッグの状態は含まない', () => {
        assert.equal(CANCELABLE_DRAG_STATES.includes(InputState.ROTATING_SELECTION), true);
        assert.equal(CANCELABLE_DRAG_STATES.includes(InputState.MOVING_SELECTION), false);
        assert.equal(CANCELABLE_DRAG_STATES.includes(InputState.IDLE), false);
    });
});
