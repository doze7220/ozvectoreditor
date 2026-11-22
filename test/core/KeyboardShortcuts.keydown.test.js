/**
 * 責務：KeyboardShortcutsのkeydownハンドラ経由で、反転のキー（Shift+H・Shift+V）の一致・不一致・受理判定を検証する。
 * documentとDOMの型の仮の値をglobalThisへ置き、置いた値はafterで元に戻す。
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardShortcuts } from '../../js/core/KeyboardShortcuts.js';

/** 仮の値を置く前のglobalThisのプロパティの記述子（キー→記述子またはundefined）。 @type {Map<string, PropertyDescriptor|undefined>} */
const savedDescriptors = new Map();

/** KeyboardShortcutsのコンストラクタが登録したkeydownハンドラ（置いた仮のdocumentが受け取る）。 @type {Function|null} */
let keydownHandler = null;

/**
 * globalThisへ値を置く（元の記述子を控える）。
 * @param {string} name プロパティ名
 * @param {*} value 置く値
 */
function installGlobal(name, value) {
    savedDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

/**
 * 呼び出しを記録する注入コールバック群を作る。反転の2つは戻り値を指定できる。
 * @param {{flip?: boolean, dragging?: boolean}} [options] flip：反転のコールバックの戻り値、dragging：isDraggingの戻り値
 * @returns {{actions: Object, calls: string[]}} コールバック群と呼び出した名前の記録
 */
function createRecordingActions(options = {}) {
    const calls = [];
    const flipResult = options.flip ?? true;
    return {
        calls,
        actions: new Proxy({}, {
            /**
             * プロパティ参照のトラップ。名前を記録する関数を返す。
             * @param {Object} target 対象（未使用）
             * @param {string|symbol} name 参照されたプロパティ名
             * @returns {Function} コールバック
             */
            get(target, name) {
                return () => {
                    if (name === 'isDragging') {
                        return options.dragging ?? false;
                    }
                    if (name === 'isCancelableDrag') {
                        return false;
                    }
                    calls.push(name);
                    return name === 'flipHorizontal' || name === 'flipVertical' ? flipResult : true;
                };
            },
        }),
    };
}

/**
 * keydownを送り、ハンドラが呼んだcallsとpreventDefaultの有無を返す。
 * @param {Object} actionsOptions createRecordingActionsのoptions
 * @param {Object} eventInit イベントの値（code・shiftKey等）
 * @returns {{calls: string[], prevented: boolean}} 結果
 */
function press(actionsOptions, eventInit) {
    const { actions, calls } = createRecordingActions(actionsOptions);
    new KeyboardShortcuts(actions);
    let prevented = false;
    keydownHandler({
        isComposing: false,
        repeat: false,
        altKey: false,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        ...eventInit,
        preventDefault() {
            prevented = true;
        },
    });
    return { calls, prevented };
}

describe('KeyboardShortcuts keydown 反転のキー（Shift+H・Shift+V）', () => {
    before(() => {
        installGlobal('HTMLInputElement', class HTMLInputElement {});
        installGlobal('HTMLTextAreaElement', class HTMLTextAreaElement {});
        installGlobal('HTMLElement', class HTMLElement {});
        installGlobal('document', {
            activeElement: null,
            addEventListener(type, handler) {
                if (type === 'keydown') {
                    keydownHandler = handler;
                }
            },
        });
    });

    after(() => {
        for (const [name, descriptor] of savedDescriptors) {
            if (descriptor === undefined) {
                delete globalThis[name];
            } else {
                Object.defineProperty(globalThis, name, descriptor);
            }
        }
        savedDescriptors.clear();
        keydownHandler = null;
    });

    it('Shift+H は flipHorizontal だけを呼び、true なら preventDefault する', () => {
        const result = press({}, { code: 'KeyH', shiftKey: true });
        assert.deepEqual(result.calls, ['flipHorizontal']);
        assert.equal(result.prevented, true);
    });

    it('Shift+V は flipVertical だけを呼び、true なら preventDefault する', () => {
        const result = press({}, { code: 'KeyV', shiftKey: true });
        assert.deepEqual(result.calls, ['flipVertical']);
        assert.equal(result.prevented, true);
    });

    it('反転が false（図形を選んでいない等）なら呼ぶが preventDefault しない', () => {
        for (const code of ['KeyH', 'KeyV']) {
            const result = press({ flip: false }, { code, shiftKey: true });
            assert.equal(result.calls.length, 1);
            assert.equal(result.prevented, false);
        }
    });

    it('H・V 単体は今までどおり setMode（キャンバス移動・選択）で、反転は呼ばない', () => {
        for (const code of ['KeyH', 'KeyV']) {
            const result = press({}, { code });
            assert.deepEqual(result.calls, ['setMode']);
        }
    });

    it('Ctrl+V は paste、Ctrl+Shift+V は pasteInPlace のままで、反転は呼ばない', () => {
        assert.deepEqual(press({}, { code: 'KeyV', ctrlKey: true }).calls, ['paste']);
        assert.deepEqual(press({}, { code: 'KeyV', ctrlKey: true, shiftKey: true }).calls, ['pasteInPlace']);
    });

    it('Ctrl+Shift+H・Meta+Shift+H・Alt+Shift+H・Alt+Shift+V は一致せず何も呼ばない', () => {
        for (const init of [
            { code: 'KeyH', ctrlKey: true, shiftKey: true },
            { code: 'KeyH', metaKey: true, shiftKey: true },
            { code: 'KeyH', altKey: true, shiftKey: true },
            { code: 'KeyV', altKey: true, shiftKey: true },
        ]) {
            const result = press({}, init);
            assert.deepEqual(result.calls, []);
            assert.equal(result.prevented, false);
        }
    });

    it('キーリピートでは反転を実行せず、ctrl: false なので preventDefault もしない', () => {
        for (const code of ['KeyH', 'KeyV']) {
            const result = press({}, { code, shiftKey: true, repeat: true });
            assert.deepEqual(result.calls, []);
            assert.equal(result.prevented, false);
        }
    });

    it('ドラッグ中は反転を実行せず、preventDefault もしない', () => {
        for (const code of ['KeyH', 'KeyV']) {
            const result = press({ dragging: true }, { code, shiftKey: true });
            assert.deepEqual(result.calls, []);
            assert.equal(result.prevented, false);
        }
    });

    it('IME変換中は反転を実行しない', () => {
        const result = press({}, { code: 'KeyH', shiftKey: true, isComposing: true });
        assert.deepEqual(result.calls, []);
    });
});
