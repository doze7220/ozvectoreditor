/**
 * 責務：HistoryManager（編集操作の履歴の記録・取り消し・やり直し・まとめの鍵による畳み）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HistoryManager, HISTORY_LIMIT } from '../../js/core/HistoryManager.js';

/**
 * 偽のキャンバス（値1つ）と、それに繋いだHistoryManagerを作る補助。
 * @returns {{ h: HistoryManager, state: {value: number}, notifications: {count: number} }} 偽物一式
 */
function setup() {
    const state = { value: 0 };
    const notifications = { count: 0 };
    const h = new HistoryManager({
        capture: () => ({ document: { value: state.value }, selectedIds: [] }),
        restore: (snap) => {
            state.value = snap.document.value;
            return true;
        }
    });
    h.onChange(() => { notifications.count += 1; });
    return { h, state, notifications };
}

/**
 * 値を変更して1件の編集操作として確定する補助。
 * @param {{h: HistoryManager, state: {value: number}}} env setupの戻り値
 * @param {number} value 変更後の値
 * @param {string} [key] まとめの鍵
 * @returns {boolean} commitEditの戻り値
 */
function edit(env, value, key) {
    env.h.beginEdit();
    env.state.value = value;
    return env.h.commitEdit(key);
}

describe('HistoryManager まとめの鍵', () => {
    it('鍵つきで続けて記録すると1件に畳まれ、取り消しはまとまりの先頭へ、やり直しは最後へ戻る', () => {
        const env = setup();
        assert.equal(edit(env, 1, 'k'), true);
        assert.equal(edit(env, 2, 'k'), true);
        assert.equal(edit(env, 3, 'k'), true);
        assert.equal(env.h.undo(), true);
        assert.equal(env.state.value, 0);
        assert.equal(env.h.canUndo(), false);
        assert.equal(env.h.redo(), true);
        assert.equal(env.state.value, 3);
        assert.equal(env.h.canRedo(), false);
    });
    it('間に鍵なしの記録を挟むと畳まれない', () => {
        const env = setup();
        edit(env, 1, 'k');
        edit(env, 2);
        edit(env, 3, 'k');
        env.h.undo();
        assert.equal(env.state.value, 2);
        env.h.undo();
        assert.equal(env.state.value, 1);
        env.h.undo();
        assert.equal(env.state.value, 0);
        assert.equal(env.h.canUndo(), false);
    });
    it('間に取り消し・やり直しを挟むと畳まれない', () => {
        const env = setup();
        edit(env, 1, 'k');
        edit(env, 2, 'k');
        env.h.undo();
        edit(env, 5, 'k');
        env.h.undo();
        assert.equal(env.state.value, 0);
        assert.equal(env.h.canUndo(), false);

        const env2 = setup();
        edit(env2, 1, 'k');
        env2.h.undo();
        env2.h.redo();
        edit(env2, 2, 'k');
        env2.h.undo();
        assert.equal(env2.state.value, 1);
    });
    it('鍵が変わると畳まれない', () => {
        const env = setup();
        edit(env, 1, 'a');
        edit(env, 2, 'b');
        env.h.undo();
        assert.equal(env.state.value, 1);
        assert.equal(env.h.canUndo(), true);
    });
    it('往復して元へ戻るとエントリが消え、通知が出て、次の同じ鍵は前の無関係なエントリへ畳まれない', () => {
        const env = setup();
        edit(env, 10);
        edit(env, 11, 'k');
        const before = env.notifications.count;
        assert.equal(edit(env, 10, 'k'), false);
        assert.equal(env.notifications.count, before + 1);
        assert.equal(env.h.canRedo(), false);
        assert.equal(edit(env, 20, 'k'), true);
        env.h.undo();
        assert.equal(env.state.value, 10);
        env.h.undo();
        assert.equal(env.state.value, 0);
        assert.equal(env.h.canUndo(), false);
    });
    it('唯一のエントリが往復で消えるとcanUndoが偽に戻る', () => {
        const env = setup();
        edit(env, 1, 'k');
        edit(env, 0, 'k');
        assert.equal(env.h.canUndo(), false);
        assert.equal(env.h.canRedo(), false);
    });
    it('畳んだときは変更通知が出る', () => {
        const env = setup();
        edit(env, 1, 'k');
        const before = env.notifications.count;
        edit(env, 2, 'k');
        assert.equal(env.notifications.count, before + 1);
    });
    it('前後が同じで記録しなかったときは通知が出ず、鍵も変わらない', () => {
        const env = setup();
        edit(env, 1, 'k');
        const before = env.notifications.count;
        assert.equal(edit(env, 1, 'k'), false);
        assert.equal(env.notifications.count, before);
        edit(env, 2, 'k');
        env.h.undo();
        assert.equal(env.state.value, 0);
        assert.equal(env.h.canUndo(), false);
    });
    it('空文字列の鍵は畳まない', () => {
        const env = setup();
        edit(env, 1, '');
        edit(env, 2, '');
        env.h.undo();
        assert.equal(env.state.value, 1);
    });
    it('clear()のあとは畳まれない', () => {
        const env = setup();
        edit(env, 1, 'k');
        env.h.clear();
        edit(env, 2, 'k');
        env.h.undo();
        // clearは図形一式に触れないため、新しいエントリのbeforeは1
        assert.equal(env.state.value, 1);
        assert.equal(env.h.canUndo(), false);
    });
});

describe('HistoryManager 引数なしの既存のふるまい', () => {
    it('記録すると取り消し・やり直しができ、通知が1回ずつ出る', () => {
        const env = setup();
        assert.equal(edit(env, 1), true);
        assert.equal(env.notifications.count, 1);
        assert.equal(env.h.undo(), true);
        assert.equal(env.state.value, 0);
        assert.equal(env.h.redo(), true);
        assert.equal(env.state.value, 1);
        assert.equal(env.notifications.count, 3);
    });
    it('引数なしで続けて記録しても畳まれない', () => {
        const env = setup();
        edit(env, 1);
        edit(env, 2);
        env.h.undo();
        assert.equal(env.state.value, 1);
    });
    it('前後が同じなら記録せず通知もしない', () => {
        const env = setup();
        assert.equal(edit(env, 0), false);
        assert.equal(env.notifications.count, 0);
        assert.equal(env.h.canUndo(), false);
    });
    it('取り消し後の記録でやり直しの履歴を破棄する', () => {
        const env = setup();
        edit(env, 1);
        env.h.undo();
        assert.equal(env.h.canRedo(), true);
        edit(env, 2);
        assert.equal(env.h.canRedo(), false);
    });
    it('clear()で空になり、破棄したときだけ通知する', () => {
        const env = setup();
        env.h.clear();
        assert.equal(env.notifications.count, 0);
        edit(env, 1);
        env.h.clear();
        assert.equal(env.notifications.count, 2);
        assert.equal(env.h.canUndo(), false);
    });
    it('HISTORY_LIMIT件を超えると最古から捨てる', () => {
        const env = setup();
        for (let i = 1; i <= HISTORY_LIMIT + 5; i += 1) {
            edit(env, i);
        }
        let undone = 0;
        while (env.h.undo()) {
            undone += 1;
        }
        assert.equal(undone, HISTORY_LIMIT);
        assert.equal(env.state.value, 5);
    });
    it('beginEditなしのcommitEditは警告してfalse', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const env = setup();
        assert.equal(env.h.commitEdit(), false);
        assert.equal(warn.mock.callCount(), 1);
        assert.equal(env.notifications.count, 0);
    });
});
