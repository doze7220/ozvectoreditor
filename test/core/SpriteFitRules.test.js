/**
 * 責務: SpriteFitRules（スプライトの外枠を描画先へ収める倍率と平行移動を求める規則）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeSpriteFitTransform } from '../../js/core/SpriteFitRules.js';

/**
 * 外枠（bounds）を組み立てる。
 * @param {number} minX 最小X
 * @param {number} minY 最小Y
 * @param {number} maxX 最大X
 * @param {number} maxY 最大Y
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 外枠
 */
const b = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });

describe('computeSpriteFitTransform', () => {
    test('横長の外枠は幅で倍率が決まり縦に中央寄せされる', () => {
        const r = computeSpriteFitTransform(b(0, 0, 20, 10), 40, 40);
        assert.deepEqual(r, { scale: 2, offsetX: 0, offsetY: 10 });
    });

    test('縦長の外枠は高さで倍率が決まり横に中央寄せされる', () => {
        const r = computeSpriteFitTransform(b(0, 0, 10, 20), 40, 40);
        assert.deepEqual(r, { scale: 2, offsetX: 10, offsetY: 0 });
    });

    test('正方形の外枠は領域いっぱいに収まる', () => {
        const r = computeSpriteFitTransform(b(0, 0, 10, 10), 20, 20);
        assert.deepEqual(r, { scale: 2, offsetX: 0, offsetY: 0 });
    });

    test('余白ありは余白を引いた領域へ収まる', () => {
        const r = computeSpriteFitTransform(b(0, 0, 10, 10), 24, 24, 2);
        assert.deepEqual(r, { scale: 2, offsetX: 2, offsetY: 2 });
    });

    test('余白を省略すると0と同じ', () => {
        assert.deepEqual(
            computeSpriteFitTransform(b(0, 0, 10, 10), 20, 20),
            computeSpriteFitTransform(b(0, 0, 10, 10), 20, 20, 0)
        );
    });

    test('外枠の最小が0でないとき最小を原点側へ寄せる', () => {
        const r = computeSpriteFitTransform(b(5, 5, 15, 15), 20, 20);
        assert.deepEqual(r, { scale: 2, offsetX: -10, offsetY: -10 });
    });

    test('幅が0の外枠は高さだけで倍率を決める', () => {
        const r = computeSpriteFitTransform(b(3, 0, 3, 10), 40, 20);
        assert.deepEqual(r, { scale: 2, offsetX: 20 - 6, offsetY: 0 });
    });

    test('高さが0の外枠は幅だけで倍率を決める', () => {
        const r = computeSpriteFitTransform(b(0, 3, 10, 3), 20, 40);
        assert.deepEqual(r, { scale: 2, offsetX: 0, offsetY: 20 - 6 });
    });

    test('点は scale 1 で中央に置く', () => {
        const r = computeSpriteFitTransform(b(4, 6, 4, 6), 20, 10);
        assert.deepEqual(r, { scale: 1, offsetX: 10 - 4, offsetY: 5 - 6 });
    });

    test('縮小する場合も倍率を求める', () => {
        const r = computeSpriteFitTransform(b(0, 0, 100, 100), 10, 10);
        assert.equal(r.scale, 0.1);
    });

    test('bounds が null・オブジェクトでない・不正なら null', () => {
        assert.equal(computeSpriteFitTransform(null, 10, 10), null);
        assert.equal(computeSpriteFitTransform(undefined, 10, 10), null);
        assert.equal(computeSpriteFitTransform(5, 10, 10), null);
        assert.equal(computeSpriteFitTransform('x', 10, 10), null);
        assert.equal(computeSpriteFitTransform(b(0, 0, NaN, 1), 10, 10), null);
        assert.equal(computeSpriteFitTransform(b(0, 0, Infinity, 1), 10, 10), null);
        assert.equal(computeSpriteFitTransform(b('0', 0, 1, 1), 10, 10), null);
        assert.equal(computeSpriteFitTransform({ minX: 0, minY: 0, maxX: 1 }, 10, 10), null);
        assert.equal(computeSpriteFitTransform(b(5, 0, 1, 1), 10, 10), null);
        assert.equal(computeSpriteFitTransform(b(0, 5, 1, 1), 10, 10), null);
    });

    test('width / height が不正なら null', () => {
        for (const v of [0, -1, NaN, Infinity, '10', null, undefined]) {
            assert.equal(computeSpriteFitTransform(b(0, 0, 1, 1), v, 10), null);
            assert.equal(computeSpriteFitTransform(b(0, 0, 1, 1), 10, v), null);
        }
    });

    test('padding が不正なら null', () => {
        for (const v of [-1, NaN, Infinity, '1', null]) {
            assert.equal(computeSpriteFitTransform(b(0, 0, 1, 1), 10, 10, v), null);
        }
    });

    test('余白が領域以上なら null', () => {
        assert.equal(computeSpriteFitTransform(b(0, 0, 1, 1), 10, 10, 5), null);
        assert.equal(computeSpriteFitTransform(b(0, 0, 1, 1), 10, 20, 6), null);
        assert.equal(computeSpriteFitTransform(b(0, 0, 1, 1), 20, 10, 6), null);
    });

    test('引数を書き換えない', () => {
        const bounds = Object.freeze(b(0, 0, 10, 20));
        assert.doesNotThrow(() => computeSpriteFitTransform(bounds, 40, 40, 1));
        assert.deepEqual(bounds, b(0, 0, 10, 20));
    });

    test('戻り値は毎回新しいオブジェクト', () => {
        const a = computeSpriteFitTransform(b(0, 0, 10, 10), 20, 20);
        const c = computeSpriteFitTransform(b(0, 0, 10, 10), 20, 20);
        assert.notEqual(a, c);
        a.scale = 99;
        assert.equal(c.scale, 2);
    });
});
