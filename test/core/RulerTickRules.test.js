/**
 * 責務：RulerTickRules（定規の目盛りの位置と数字の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeRulerTicks, formatRulerLabel } from '../../js/core/RulerTickRules.js';

/**
 * 目盛りの配列から value だけを取り出す。
 * @param {Array<{value: number, major: boolean}>} ticks 目盛りの配列
 * @returns {number[]} value の配列
 */
function values(ticks) {
    return ticks.map((t) => t.value);
}

/**
 * 目盛りの配列から太線の value だけを取り出す。
 * @param {Array<{value: number, major: boolean}>} ticks 目盛りの配列
 * @returns {number[]} 太線の value の配列
 */
function majorValues(ticks) {
    return ticks.filter((t) => t.major).map((t) => t.value);
}

describe('computeRulerTicks', () => {
    it('正の範囲：細線の位置が昇順で並び、太線が区別される（10/100）', () => {
        const ticks = computeRulerTicks(0, 300, 10, 100);
        assert.equal(ticks.length, 31);
        assert.deepEqual(values(ticks).slice(0, 4), [0, 10, 20, 30]);
        assert.deepEqual(majorValues(ticks), [0, 100, 200, 300]);
    });

    it('負の範囲：太線は負の値でも間隔の倍数の位置', () => {
        const ticks = computeRulerTicks(-300, -100, 10, 100);
        assert.equal(ticks[0].value, -300);
        assert.equal(ticks[ticks.length - 1].value, -100);
        assert.deepEqual(majorValues(ticks), [-300, -200, -100]);
    });

    it('0をまたぐ範囲：0が太線で含まれる', () => {
        const ticks = computeRulerTicks(-25, 25, 10, 100);
        assert.deepEqual(values(ticks), [-20, -10, 0, 10, 20]);
        assert.deepEqual(majorValues(ticks), [0]);
    });

    it('間隔100/1000でも太線と細線を区別する', () => {
        const ticks = computeRulerTicks(-1000, 1000, 100, 1000);
        assert.deepEqual(majorValues(ticks), [-1000, 0, 1000]);
        assert.equal(ticks.length, 21);
        assert.equal(ticks.filter((t) => !t.major).length, 18);
    });

    it('範囲の端ちょうどの位置は含む', () => {
        const ticks = computeRulerTicks(10, 40, 10, 100);
        assert.deepEqual(values(ticks), [10, 20, 30, 40]);
    });

    it('端が間隔の途中のとき、範囲の外の位置は含まない', () => {
        const ticks = computeRulerTicks(11, 39, 10, 100);
        assert.deepEqual(values(ticks), [20, 30]);
    });

    it('範囲内に目盛りが無ければ空配列', () => {
        assert.deepEqual(computeRulerTicks(11, 19, 10, 100), []);
    });

    it('誤差が累積しない：大きなインデックスでも value が i × 間隔と厳密に等しい', () => {
        const ticks = computeRulerTicks(-100000, -99900, 10, 100);
        assert.equal(ticks.length, 11);
        ticks.forEach((t, k) => {
            assert.equal(t.value, (-10000 + k) * 10);
        });
        assert.deepEqual(majorValues(ticks), [-100000, -99900]);
    });

    it('小数の間隔でも value は i × 間隔と厳密に等しい', () => {
        const ticks = computeRulerTicks(0, 1, 0.1, 1);
        ticks.forEach((t, i) => {
            assert.equal(t.value, i * 0.1);
        });
    });

    it('-0 が出ない（範囲が負から0へ入る場合を含む）', () => {
        const ticks = computeRulerTicks(-0.5, 0.5, 0.25, 1);
        assert.ok(ticks.some((t) => t.value === 0));
        for (const t of ticks) {
            assert.equal(Object.is(t.value, -0), false);
        }
        const ticks2 = computeRulerTicks(-5, 5, 10, 100);
        assert.equal(ticks2.length, 1);
        assert.equal(Object.is(ticks2[0].value, -0), false);
        assert.equal(ticks2[0].major, true);
    });

    it('不正な引数では例外を投げず空配列を返す', () => {
        const bad = [
            [NaN, 100, 10, 100],
            [0, NaN, 10, 100],
            [0, Infinity, 10, 100],
            [-Infinity, 100, 10, 100],
            [0, 100, NaN, 100],
            [0, 100, 10, Infinity],
            [0, 100, 0, 100],
            [0, 100, -10, 100],
            [0, 100, 10, 0],
            [0, 100, 10, -100],
            [0, 100, 100, 10], // ratio < 1（太線が細線より細かい。丸めて0になる）
            [100, 0, 10, 100], // minValue > maxValue
            ['0', 100, 10, 100],
        ];
        for (const args of bad) {
            assert.deepEqual(computeRulerTicks(...args), [], `args: ${JSON.stringify(args)}`);
        }
    });
});

describe('formatRulerLabel', () => {
    it('整数の文字列にする', () => {
        assert.equal(formatRulerLabel(-200), '-200');
        assert.equal(formatRulerLabel(0), '0');
        assert.equal(formatRulerLabel(100), '100');
        assert.equal(formatRulerLabel(10000), '10000');
    });

    it('-0 は "0"', () => {
        assert.equal(formatRulerLabel(-0), '0');
    });

    it('小数は整数に丸める（-0.4 も "0"）', () => {
        assert.equal(formatRulerLabel(12.4), '12');
        assert.equal(formatRulerLabel(12.6), '13');
        assert.equal(formatRulerLabel(-0.4), '0');
        assert.equal(formatRulerLabel(-12.6), '-13');
    });
});
