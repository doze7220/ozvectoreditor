/**
 * 責務：ViewTransform.setView（表示倍率とオフセットの一括設定）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ViewTransform } from '../../js/core/ViewTransform.js';

/**
 * 変更通知の回数を数える ViewTransform を作る。
 * @returns {{view: ViewTransform, count: () => number}} ビュー変換と通知回数の取得関数
 */
function makeCountedView() {
    const view = new ViewTransform();
    let n = 0;
    view.onChange(() => { n++; });
    return { view, count: () => n };
}

describe('ViewTransform.setView', () => {
    it('3つの値を設定し通知を1回行う', () => {
        const { view, count } = makeCountedView();
        view.setView(2, 30, -40);
        assert.deepEqual(view.getState(), { scale: 2, offsetX: 30, offsetY: -40 });
        assert.equal(count(), 1);
    });

    it('倍率を上限・下限に収める', () => {
        const { view, count } = makeCountedView();
        view.setView(100, 1, 2);
        assert.deepEqual(view.getState(), { scale: ViewTransform.MAX_SCALE, offsetX: 1, offsetY: 2 });
        view.setView(0.0001, 3, 4);
        assert.deepEqual(view.getState(), { scale: ViewTransform.MIN_SCALE, offsetX: 3, offsetY: 4 });
        assert.equal(count(), 2);
    });

    it('不正な値ではconsole.warnして変わらず通知しない', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const { view, count } = makeCountedView();
        view.setView(2, 5, 6);
        const bad = [
            [0, 0, 0], [-1, 0, 0], [NaN, 0, 0], [Infinity, 0, 0],
            [1, NaN, 0], [1, Infinity, 0], [1, 0, NaN], [1, 0, -Infinity]
        ];
        for (const [s, x, y] of bad) {
            view.setView(s, x, y);
        }
        assert.deepEqual(view.getState(), { scale: 2, offsetX: 5, offsetY: 6 });
        assert.equal(count(), 1);
        assert.equal(warn.mock.callCount(), bad.length);
    });

    it('同じ値では通知しない', () => {
        const { view, count } = makeCountedView();
        view.setView(2, 5, 6);
        view.setView(2, 5, 6);
        assert.equal(count(), 1);
    });

    it('収めた結果が今と同じなら通知しない', () => {
        const { view, count } = makeCountedView();
        view.setView(ViewTransform.MAX_SCALE, 5, 6);
        view.setView(ViewTransform.MAX_SCALE * 3, 5, 6);
        assert.equal(count(), 1);
        assert.deepEqual(view.getState(), { scale: ViewTransform.MAX_SCALE, offsetX: 5, offsetY: 6 });
    });

    it('オフセットだけ変わっても通知する', () => {
        const { view, count } = makeCountedView();
        view.setView(2, 5, 6);
        view.setView(2, 7, 6);
        assert.equal(count(), 2);
    });
});
