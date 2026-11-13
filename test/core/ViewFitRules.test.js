/**
 * 責務：ViewFitRules（範囲を領域に収める表示倍率とオフセットの計算）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { computeFitView, FIT_VIEW_MARGIN_PX } from '../../js/core/ViewFitRules.js';
import { ViewTransform } from '../../js/core/ViewTransform.js';

/**
 * 倍率の範囲の既定オプション（ViewTransformの公開定数）。
 * @type {{minScale: number, maxScale: number}}
 */
const LIMITS = { minScale: ViewTransform.MIN_SCALE, maxScale: ViewTransform.MAX_SCALE };

/**
 * 範囲オブジェクトを作る。
 * @param {number} minX 最小X
 * @param {number} minY 最小Y
 * @param {number} maxX 最大X
 * @param {number} maxY 最大Y
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 範囲
 */
function b(minX, minY, maxX, maxY) {
    return { minX, minY, maxX, maxY };
}

/**
 * 結果を ViewTransform へ設定して返す。
 * @param {{scale: number, offsetX: number, offsetY: number}} r computeFitView の結果
 * @returns {ViewTransform} 設定済みのビュー変換
 */
function applyToView(r) {
    const v = new ViewTransform();
    v.setView(r.scale, r.offsetX, r.offsetY);
    return v;
}

/**
 * 2つの数が誤差の範囲で等しいことを確かめる。
 * @param {number} actual 実際の値
 * @param {number} expected 期待する値
 */
function near(actual, expected) {
    assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
}

describe('computeFitView', () => {
    it('余白の既定は40', () => {
        assert.equal(FIT_VIEW_MARGIN_PX, 40);
    });

    it('横長の範囲は幅で倍率が決まる', () => {
        const r = computeFitView(b(0, 0, 1000, 100), 1000, 800, LIMITS);
        near(r.scale, (1000 - 80) / 1000);
    });

    it('縦長の範囲は高さで倍率が決まる', () => {
        const r = computeFitView(b(0, 0, 100, 1000), 1000, 800, LIMITS);
        near(r.scale, (800 - 80) / 1000);
    });

    it('領域より小さい範囲は拡大、大きい範囲は縮小される', () => {
        assert.ok(computeFitView(b(0, 0, 100, 100), 1000, 800, LIMITS).scale > 1);
        assert.ok(computeFitView(b(0, 0, 3000, 3000), 1000, 800, LIMITS).scale < 1);
    });

    it('小さな図形は上限に収まる', () => {
        assert.equal(computeFitView(b(0, 0, 1, 1), 1000, 800, LIMITS).scale, ViewTransform.MAX_SCALE);
    });

    it('大きな図形は下限に収まる', () => {
        assert.equal(computeFitView(b(0, 0, 1e6, 1e6), 1000, 800, LIMITS).scale, ViewTransform.MIN_SCALE);
    });

    it('幅が0なら高さだけ、高さが0なら幅だけで決まる', () => {
        near(computeFitView(b(5, 0, 5, 400), 1000, 800, LIMITS).scale, (800 - 80) / 400);
        near(computeFitView(b(0, 5, 500, 5), 1000, 800, LIMITS).scale, (1000 - 80) / 500);
    });

    it('幅も高さも0なら倍率1（上限・下限の範囲内）', () => {
        const r = computeFitView(b(10, 20, 10, 20), 1000, 800, LIMITS);
        assert.equal(r.scale, 1);
        near(r.offsetX, 500 - 10);
        near(r.offsetY, 400 - 20);
    });

    it('領域が余白より小さくても例外を投げず下限になる', () => {
        const r = computeFitView(b(0, 0, 100, 100), 50, 50, LIMITS);
        assert.equal(r.scale, ViewTransform.MIN_SCALE);
        assert.ok(Number.isFinite(r.offsetX) && Number.isFinite(r.offsetY));
    });

    it('nullは倍率1・原点が領域の中心', () => {
        assert.deepEqual(computeFitView(null, 900, 600, LIMITS), { scale: 1, offsetX: 450, offsetY: 300 });
    });

    it('範囲の中心が領域の中心に写る（ViewTransformで確認）', () => {
        const bounds = b(-50, 20, 350, 180);
        const v = applyToView(computeFitView(bounds, 1000, 800, LIMITS));
        const p = v.worldToScreen((bounds.minX + bounds.maxX) / 2, (bounds.minY + bounds.maxY) / 2);
        near(p.x, 500);
        near(p.y, 400);
    });

    it('倍率を収めない場合、範囲の四隅は余白の内側に写る', () => {
        const bounds = b(-100, -50, 400, 250);
        const v = applyToView(computeFitView(bounds, 1000, 800, LIMITS));
        const a = v.worldToScreen(bounds.minX, bounds.minY);
        const c = v.worldToScreen(bounds.maxX, bounds.maxY);
        const m = FIT_VIEW_MARGIN_PX;
        for (const p of [a, c]) {
            assert.ok(p.x >= m - 1e-9 && p.x <= 1000 - m + 1e-9);
            assert.ok(p.y >= m - 1e-9 && p.y <= 800 - m + 1e-9);
        }
    });

    it('margin を指定できる', () => {
        const r = computeFitView(b(0, 0, 1000, 100), 1000, 800, { ...LIMITS, margin: 0 });
        near(r.scale, 1);
    });
});
