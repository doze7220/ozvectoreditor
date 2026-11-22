/**
 * 責務：KeyboardShortcuts（キー→操作の対応表と受理判定）のうち、document非依存で確かめられる起動時の配線漏れの検出と、
 * 拡大縮小のドラッグ中のcancel（Esc）の例外の判定（findCancelableDragBinding）を検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardShortcuts, findCancelableDragBinding } from '../../js/core/KeyboardShortcuts.js';
import { InputState, CANCELABLE_DRAG_STATES } from '../../js/core/InputModes.js';

/**
 * 指定した名前を除く、どのプロパティ名にも関数を返すコールバック群（Proxy）を作る補助。
 * action名の一覧をテスト側へ二重に書かないために、プロパティ参照のたびに関数を返す。
 * @param {string} excludedName 関数を返さない（undefinedにする）プロパティ名
 * @returns {Object} コールバック群として渡せるProxy
 */
function createActionsExcept(excludedName) {
    return new Proxy({}, {
        /**
         * プロパティ参照のトラップ。除外名以外には関数を返す。
         * @param {Object} target 対象（未使用）
         * @param {string|symbol} name 参照されたプロパティ名
         * @returns {Function|undefined} 除外名ならundefined、それ以外は常にtrueを返す関数
         */
        get(target, name) {
            return name === excludedName ? undefined : () => true;
        },
    });
}

/**
 * コンストラクタが投げたErrorの文言から、欠落として列挙された名前の一覧を取り出す補助。
 * @param {Object} actions コンストラクタへ渡すコールバック群
 * @returns {string[]} 文言に列挙された欠落名（Errorが投げられなければテストが失敗する）
 */
function getMissingNames(actions) {
    let message = null;
    try {
        new KeyboardShortcuts(actions);
    } catch (error) {
        assert.ok(error instanceof Error);
        message = error.message;
    }
    assert.notEqual(message, null, 'Errorが投げられること');
    return message.split(': ').pop().split(', ');
}

describe('KeyboardShortcuts コンストラクタの配線検証', () => {
    it('コールバックが空なら Error を投げ、文言に nudgeSelection と isDragging が含まれる', () => {
        assert.throws(() => new KeyboardShortcuts({}), (error) => {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('nudgeSelection'));
            assert.ok(error.message.includes('isDragging'));
            return true;
        });
    });

    it('nudgeSelection だけを欠くと Error を投げ、欠落名が nudgeSelection だけになる', () => {
        assert.deepEqual(getMissingNames(createActionsExcept('nudgeSelection')), ['nudgeSelection']);
    });

    it('isCancelableDrag だけを欠くと Error を投げ、欠落名が isCancelableDrag だけになる', () => {
        assert.deepEqual(getMissingNames(createActionsExcept('isCancelableDrag')), ['isCancelableDrag']);
    });

    it('flipHorizontal だけを欠くと Error を投げ、欠落名が flipHorizontal だけになる', () => {
        assert.deepEqual(getMissingNames(createActionsExcept('flipHorizontal')), ['flipHorizontal']);
    });

    it('flipVertical だけを欠くと Error を投げ、欠落名が flipVertical だけになる', () => {
        assert.deepEqual(getMissingNames(createActionsExcept('flipVertical')), ['flipVertical']);
    });
});

/**
 * Shift・Alt・Ctrl・Metaの押下の全16通りの組み合わせ（keydownイベントのcode付き）を作る補助。
 * @param {string} code event.code
 * @returns {Array<{code: string, shiftKey: boolean, altKey: boolean, ctrlKey: boolean, metaKey: boolean}>} 16件のイベント
 */
function createAllModifierEvents(code) {
    const events = [];
    for (let bits = 0; bits < 16; bits++) {
        events.push({
            code,
            shiftKey: (bits & 1) !== 0,
            altKey: (bits & 2) !== 0,
            ctrlKey: (bits & 4) !== 0,
            metaKey: (bits & 8) !== 0,
        });
    }
    return events;
}

describe('findCancelableDragBinding 拡大縮小のドラッグ中のcancelの例外', () => {
    it('修飾キーの16通りすべてで、照会が true なら cancel のエントリ（凍結済み・repeatable: false）を返す', () => {
        const events = createAllModifierEvents('Escape');
        assert.equal(events.length, 16);
        for (const event of events) {
            const binding = findCancelableDragBinding(event, () => true);
            assert.notEqual(binding, null);
            assert.equal(binding.action, 'cancel');
            assert.equal(binding.repeatable, false);
            assert.deepEqual(binding.codes, ['Escape']);
            assert.ok(Object.isFrozen(binding));
        }
    });

    it('修飾キーの16通りすべてで、照会が false なら null を返す（今の対応表の照合へ進む）', () => {
        for (const event of createAllModifierEvents('Escape')) {
            assert.equal(findCancelableDragBinding(event, () => false), null);
        }
    });

    it('Escape 以外の code は照会が true でも null で、照会を呼ばない', () => {
        for (const code of ['KeyV', 'Space', 'Enter', 'Delete', 'Digit1']) {
            let calls = 0;
            const result = findCancelableDragBinding({ code, shiftKey: false, altKey: false, ctrlKey: false, metaKey: false }, () => {
                calls += 1;
                return true;
            });
            assert.equal(result, null);
            assert.equal(calls, 0);
        }
    });

    it('Escape では照会を1回だけ呼ぶ', () => {
        let calls = 0;
        findCancelableDragBinding({ code: 'Escape', shiftKey: false, altKey: false, ctrlKey: false, metaKey: false }, () => {
            calls += 1;
            return false;
        });
        assert.equal(calls, 1);
    });

    it('回転のドラッグ中（CANCELABLE_DRAG_STATES が ROTATING_SELECTION を含む照会）は、修飾キーの16通りすべてで cancel のエントリを返す', () => {
        const isRotating = () => CANCELABLE_DRAG_STATES.includes(InputState.ROTATING_SELECTION);
        for (const event of createAllModifierEvents('Escape')) {
            const binding = findCancelableDragBinding(event, isRotating);
            assert.notEqual(binding, null);
            assert.equal(binding.action, 'cancel');
            assert.equal(binding.repeatable, false);
        }
    });

    it('event を書き換えない', () => {
        const event = Object.freeze({ code: 'Escape', shiftKey: true, altKey: true, ctrlKey: true, metaKey: false });
        assert.doesNotThrow(() => findCancelableDragBinding(event, () => true));
        assert.deepEqual({ ...event }, { code: 'Escape', shiftKey: true, altKey: true, ctrlKey: true, metaKey: false });
    });
});
