/**
 * 責務：ListScrollRules（見えている行の範囲・選択の変化の判定・スクロール位置）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveVisibleRowRange,
    hasSelectionChanged,
    resolveSelectionScrollTop
} from '../../js/core/ListScrollRules.js';

describe('resolveVisibleRowRange', () => {
    const base = { scrollTop: 0, height: 360, rowHeight: 36, rowCount: 100, overscan: 0 };
    it('先頭：0行目から見えている行の終わりまで', () => {
        assert.deepEqual(resolveVisibleRowRange(base), { start: 0, end: 10 });
    });
    it('途中：行の途中まで見えている行も含む', () => {
        assert.deepEqual(resolveVisibleRowRange({ ...base, scrollTop: 50 }), { start: 1, end: 12 });
    });
    it('余裕を前後へ足す', () => {
        assert.deepEqual(resolveVisibleRowRange({ ...base, scrollTop: 360, overscan: 4 }), { start: 6, end: 24 });
    });
    it('余裕は先頭で頭打ち', () => {
        assert.deepEqual(resolveVisibleRowRange({ ...base, overscan: 4 }), { start: 0, end: 14 });
    });
    it('末尾：行数で頭打ち', () => {
        assert.deepEqual(resolveVisibleRowRange({ ...base, scrollTop: 3240, overscan: 4 }), { start: 86, end: 100 });
    });
    it('スクロール位置が総高さを超えても、範囲は行数以内', () => {
        const range = resolveVisibleRowRange({ ...base, scrollTop: 99999, overscan: 4 });
        assert.ok(range.start <= range.end && range.end <= 100 && range.start >= 0);
    });
    it('0件・高さ0・行の高さ0は空の範囲', () => {
        assert.deepEqual(resolveVisibleRowRange({ ...base, rowCount: 0 }), { start: 0, end: 0 });
        assert.deepEqual(resolveVisibleRowRange({ ...base, height: 0 }), { start: 0, end: 0 });
        assert.deepEqual(resolveVisibleRowRange({ ...base, rowHeight: 0 }), { start: 0, end: 0 });
    });
    it('行数が見える数より少ないときは行数まで', () => {
        assert.deepEqual(resolveVisibleRowRange({ ...base, rowCount: 3, overscan: 4 }), { start: 0, end: 3 });
    });
});

describe('hasSelectionChanged', () => {
    it('同じ集合は偽', () => {
        assert.equal(hasSelectionChanged(['a', 'b'], ['a', 'b']), false);
    });
    it('並びの違いは同じとみなす', () => {
        assert.equal(hasSelectionChanged(['a', 'b'], ['b', 'a']), false);
    });
    it('増減は真', () => {
        assert.equal(hasSelectionChanged(['a'], ['a', 'b']), true);
        assert.equal(hasSelectionChanged(['a', 'b'], ['a']), true);
    });
    it('同じ数で中身が違えば真', () => {
        assert.equal(hasSelectionChanged(['a'], ['b']), true);
    });
    it('空どうしは偽、空と空でないは真', () => {
        assert.equal(hasSelectionChanged([], []), false);
        assert.equal(hasSelectionChanged([], ['a']), true);
        assert.equal(hasSelectionChanged(['a'], []), true);
    });
});

describe('resolveSelectionScrollTop', () => {
    const base = { selectedIndexes: [5], scrollTop: 0, height: 360, rowHeight: 36 };
    it('中心が見えているなら動かさない', () => {
        assert.equal(resolveSelectionScrollTop(base), null);
    });
    it('境目：中心が下端ちょうどなら見えていない、上端ちょうどなら見えている', () => {
        // 行9の中心 = 342 (見える), 行10の中心 = 378 (見えない)
        assert.equal(resolveSelectionScrollTop({ ...base, selectedIndexes: [9] }), null);
        assert.equal(resolveSelectionScrollTop({ ...base, selectedIndexes: [10] }), 360 + 36 - 360);
        // 中心がちょうど下端: scrollTop=0, height=342 → 行9の中心342は見えない
        assert.equal(resolveSelectionScrollTop({ ...base, height: 342, selectedIndexes: [9] }), 360 - 342);
        // 中心がちょうど上端: 行2の中心90、scrollTop=90 → 見える
        assert.equal(resolveSelectionScrollTop({ ...base, scrollTop: 90, selectedIndexes: [2] }), null);
    });
    it('上にあるなら、その行の上端へ', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, scrollTop: 720, selectedIndexes: [3] }), 108);
    });
    it('下にあるなら、行の下端が見える下端に合う位置へ', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, selectedIndexes: [20] }), 21 * 36 - 360);
    });
    it('複数のうち1つでも中心が見えていれば動かさない', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, selectedIndexes: [50, 3, 80] }), null);
    });
    it('全部見えていないときは、いちばん上の選ばれている行へ', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, scrollTop: 1800, selectedIndexes: [10, 3, 80] }), 108);
    });
    it('選択なしは null', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, selectedIndexes: [] }), null);
    });
    it('高さ0・行の高さ0は null', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, height: 0 }), null);
        assert.equal(resolveSelectionScrollTop({ ...base, rowHeight: 0 }), null);
    });
    it('表示が行より低いときは、下にあっても行の上端へ', () => {
        assert.equal(resolveSelectionScrollTop({ ...base, height: 20, selectedIndexes: [5] }), 180);
    });
});
