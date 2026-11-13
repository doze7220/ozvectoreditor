/**
 * 責務: GridSpacingRules（computeGridSpacing）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeGridSpacing } from '../../js/core/GridSpacingRules.js';
import { ViewTransform } from '../../js/core/ViewTransform.js';

/**
 * 切り出し前の`CanvasManager.#drawGrid`の式の書き写し（参照用）。
 * @param {number} scale - 表示倍率
 * @returns {{minor: number, major: number}}
 */
function legacyGridSpacing(scale) {
    let minor = 10;
    for (let i = 0; i < 10 && minor * scale < 8; i++) {
        minor *= 10;
    }
    return { minor, major: minor * 10 };
}

describe('computeGridSpacing', () => {
    test('100%で細線10・太線100', () => {
        assert.deepEqual(computeGridSpacing(1), { minor: 10, major: 100 });
    });

    test('80%は10のまま、79%で100へ繰り上がる', () => {
        assert.deepEqual(computeGridSpacing(0.8), { minor: 10, major: 100 });
        assert.deepEqual(computeGridSpacing(0.79), { minor: 100, major: 1000 });
    });

    test('10%で細線100・太線1000', () => {
        assert.deepEqual(computeGridSpacing(0.1), { minor: 100, major: 1000 });
    });

    test('1000%で細線10・太線100', () => {
        assert.deepEqual(computeGridSpacing(10), { minor: 10, major: 100 });
    });

    test('不正な倍率でも例外を投げず、JSDocの値を返す', () => {
        assert.deepEqual(computeGridSpacing(0), { minor: 10 * 1e10, major: 10 * 1e10 * 10 });
        assert.deepEqual(computeGridSpacing(-1), { minor: 10 * 1e10, major: 10 * 1e10 * 10 });
        assert.deepEqual(computeGridSpacing(NaN), { minor: 10, major: 100 });
        assert.deepEqual(computeGridSpacing(Infinity), { minor: 10, major: 100 });
    });

    test('切り出し前の式と多数の倍率で同じ結果', () => {
        for (let s = ViewTransform.MIN_SCALE; s <= ViewTransform.MAX_SCALE; s *= 1.1) {
            assert.deepEqual(computeGridSpacing(s), legacyGridSpacing(s));
        }
    });
});
