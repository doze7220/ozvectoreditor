/**
 * 責務：KeyboardShortcutsのkeydownハンドラ経由で、フォルダのキー（Ctrl+G・Ctrl+Shift+G）の一致・不一致・受理判定を検証する。
 * documentとDOMの型の仮の値をglobalThisへ置き、置いた値はafterで元に戻す。
 */
import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardShortcuts } from '../../js/core/KeyboardShortcuts.js';

/** 仮の値を置く前のglobalThisのプロパティの記述子（キー→記述子またはundefined）。 @type {Map<string, PropertyDescriptor|undefined>} */
const savedDescriptors = new Map();

/** KeyboardShortcutsのコンストラクタが登録したkeydownハンドラ（置いた仮のdocumentが受け取る）。 @type {Function|null} */
let keydownHandler = null;

/** 仮のdocument（activeElementをテストごとに差し替える）。 @type {{activeElement: *, addEventListener: Function}|null} */
let fakeDocument = null;

/** 文字の入力欄を表す仮のinput要素のクラス（instanceofの判定用）。 @type {Function} */
class FakeInput {
    /** @param {string} type input要素のtype */
    constructor(type) {
        this.type = type;
    }
}

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
 * 呼び出しを記録する注入コールバック群を作る。
 * @param {{dragging?: boolean, cancelable?: boolean}} [options] dragging：isDraggingの戻り値、cancelable：isCancelableDragの戻り値
 * @returns {{actions: Object, calls: string[]}} コールバック群と呼び出した名前の記録
 */
function createRecordingActions(options = {}) {
    const calls = [];
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
                        return options.cancelable ?? false;
                    }
                    calls.push(name);
                    return true;
                };
            },
        }),
    };
}

/**
 * keydownを送り、ハンドラが呼んだcallsとpreventDefaultの有無を返す。
 * @param {Object} actionsOptions createRecordingActionsのoptions
 * @param {Object} eventInit イベントの値（code・ctrlKey等）
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

describe('KeyboardShortcuts keydown フォルダのキー（Ctrl+G・Ctrl+Shift+G）', () => {
    before(() => {
        installGlobal('HTMLInputElement', FakeInput);
        installGlobal('HTMLTextAreaElement', class HTMLTextAreaElement {});
        installGlobal('HTMLElement', class HTMLElement {});
        fakeDocument = {
            activeElement: null,
            addEventListener(type, handler) {
                if (type === 'keydown') {
                    keydownHandler = handler;
                }
            },
        };
        installGlobal('document', fakeDocument);
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
        fakeDocument = null;
    });

    it('Ctrl+G は group だけを呼び、preventDefault する', () => {
        const result = press({}, { code: 'KeyG', ctrlKey: true });
        assert.deepEqual(result.calls, ['group']);
        assert.equal(result.prevented, true);
    });

    it('Meta（⌘）+G は group だけを呼び、preventDefault する', () => {
        const result = press({}, { code: 'KeyG', metaKey: true });
        assert.deepEqual(result.calls, ['group']);
        assert.equal(result.prevented, true);
    });

    it('Ctrl+Shift+G は ungroup だけを呼び、preventDefault する', () => {
        const result = press({}, { code: 'KeyG', ctrlKey: true, shiftKey: true });
        assert.deepEqual(result.calls, ['ungroup']);
        assert.equal(result.prevented, true);
    });

    it('Meta（⌘）+Shift+G は ungroup だけを呼び、preventDefault する', () => {
        const result = press({}, { code: 'KeyG', metaKey: true, shiftKey: true });
        assert.deepEqual(result.calls, ['ungroup']);
        assert.equal(result.prevented, true);
    });

    it('G 単体・Shift+G・Alt付きは一致せず、何も呼ばず preventDefault もしない', () => {
        for (const init of [
            { code: 'KeyG' },
            { code: 'KeyG', shiftKey: true },
            { code: 'KeyG', ctrlKey: true, altKey: true },
            { code: 'KeyG', ctrlKey: true, shiftKey: true, altKey: true },
        ]) {
            const result = press({}, init);
            assert.deepEqual(result.calls, []);
            assert.equal(result.prevented, false);
        }
    });

    it('キーリピートでは実行せず、preventDefault だけする', () => {
        for (const shiftKey of [false, true]) {
            const result = press({}, { code: 'KeyG', ctrlKey: true, shiftKey, repeat: true });
            assert.deepEqual(result.calls, []);
            assert.equal(result.prevented, true);
        }
    });

    it('ドラッグ中は実行せず、preventDefault だけする', () => {
        for (const shiftKey of [false, true]) {
            const result = press({ dragging: true }, { code: 'KeyG', ctrlKey: true, shiftKey });
            assert.deepEqual(result.calls, []);
            assert.equal(result.prevented, true);
        }
    });

    it('文字の入力欄にフォーカスがあるときは何もせず、preventDefault もしない', () => {
        fakeDocument.activeElement = new FakeInput('text');
        try {
            for (const shiftKey of [false, true]) {
                const result = press({}, { code: 'KeyG', ctrlKey: true, shiftKey });
                assert.deepEqual(result.calls, []);
                assert.equal(result.prevented, false);
            }
        } finally {
            fakeDocument.activeElement = null;
        }
    });
});
