/**
 * 責務: DisplayState（表示の状態の保持・切り替え・変更通知）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { DisplayState } from '../../js/core/DisplayState.js';

/**
 * 4つの状態ごとの set・toggle のメソッド名、状態のキー、初期値の組。
 * @type {Array<{setter: string, toggle: string, key: string, initial: boolean}>}
 */
const SETTERS = [
    { setter: 'setOutline', toggle: 'toggleOutline', key: 'outline', initial: false },
    { setter: 'setDarkBackground', toggle: 'toggleBackground', key: 'darkBackground', initial: false },
    { setter: 'setGridVisible', toggle: 'toggleGrid', key: 'gridVisible', initial: true },
    { setter: 'setFloatWindowsVisible', toggle: 'toggleFloatWindows', key: 'floatWindowsVisible', initial: true },
];

describe('DisplayState 初期値', () => {
    test('getState・isOutline・isFloatWindowsVisible が初期値を返す', () => {
        const state = new DisplayState();
        assert.deepEqual(state.getState(), {
            outline: false,
            darkBackground: false,
            gridVisible: true,
            floatWindowsVisible: true,
        });
        assert.equal(state.isOutline(), false);
        assert.equal(state.isFloatWindowsVisible(), true);
    });
});

describe('DisplayState toggle', () => {
    for (const { toggle, key, initial } of SETTERS) {
        test(`${toggle} は値を反転し通知1回`, () => {
            const state = new DisplayState();
            let count = 0;
            state.onChange(() => { count++; });
            state[toggle]();
            assert.equal(state.getState()[key], !initial);
            assert.equal(count, 1);
            state[toggle]();
            assert.equal(state.getState()[key], initial);
            assert.equal(count, 2);
        });
    }
});

describe('DisplayState set', () => {
    for (const { setter, key, initial } of SETTERS) {
        test(`${setter}: 変わる値で通知1回`, () => {
            const state = new DisplayState();
            let count = 0;
            state.onChange(() => { count++; });
            state[setter](!initial);
            assert.equal(state.getState()[key], !initial);
            assert.equal(count, 1);
        });

        test(`${setter}: 同じ値で通知0回`, () => {
            const state = new DisplayState();
            let count = 0;
            state.onChange(() => { count++; });
            state[setter](initial);
            assert.equal(state.getState()[key], initial);
            assert.equal(count, 0);
        });

        test(`${setter}: 真偽値でない値は警告して変わらず通知0回`, (t) => {
            const warn = t.mock.method(console, 'warn', () => {});
            const state = new DisplayState();
            let count = 0;
            state.onChange(() => { count++; });
            state[setter](1);
            state[setter]('true');
            state[setter](null);
            state[setter](undefined);
            assert.equal(warn.mock.callCount(), 4);
            assert.ok(String(warn.mock.calls[0].arguments[0]).includes(`DisplayState.${setter}`));
            assert.equal(state.getState()[key], initial);
            assert.equal(count, 0);
        });
    }

    test('isOutline・isFloatWindowsVisible が変更に追従する', () => {
        const state = new DisplayState();
        state.setOutline(true);
        state.setFloatWindowsVisible(false);
        assert.equal(state.isOutline(), true);
        assert.equal(state.isFloatWindowsVisible(), false);
    });
});

describe('DisplayState getState / onChange', () => {
    test('getState の戻り値を書き換えても内部は変わらず、呼ぶたびに別のオブジェクト', () => {
        const state = new DisplayState();
        const first = state.getState();
        first.outline = true;
        first.gridVisible = false;
        const second = state.getState();
        assert.notEqual(first, second);
        assert.equal(second.outline, false);
        assert.equal(second.gridVisible, true);
    });

    test('onChange に関数以外を渡しても例外にならず、通知も壊れない', () => {
        const state = new DisplayState();
        let count = 0;
        assert.doesNotThrow(() => {
            state.onChange(null);
            state.onChange('x');
            state.onChange(undefined);
            state.onChange(() => { count++; });
        });
        state.toggleOutline();
        assert.equal(count, 1);
    });
});
