/**
 * 責務：StatusReadoutRules（ステータスバーの座標・大きさ・グリッドの表示の文字列の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    formatReadoutNumber,
    formatCursorReadout,
    formatSizeReadout,
    formatGridReadout
} from '../../js/core/StatusReadoutRules.js';

describe('formatReadoutNumber', () => {
    it('小数第1位に丸めて固定の桁で表示する', () => {
        assert.equal(formatReadoutNumber(120.5), '120.5');
        assert.equal(formatReadoutNumber(120), '120.0');
        assert.equal(formatReadoutNumber(1.26), '1.3');
        assert.equal(formatReadoutNumber(1.24), '1.2');
    });

    it('負の値もそのまま符号付きで表示する', () => {
        assert.equal(formatReadoutNumber(-40), '-40.0');
        assert.equal(formatReadoutNumber(-12.34), '-12.3');
    });

    it('丸めて0になる負の値は`-0.0`ではなく`0.0`', () => {
        assert.equal(formatReadoutNumber(-0.04), '0.0');
        assert.equal(formatReadoutNumber(-0.01), '0.0');
    });

    it('-0は`0.0`', () => {
        assert.equal(formatReadoutNumber(-0), '0.0');
        assert.equal(formatReadoutNumber(0), '0.0');
    });

    it('有限の数でなければ「—」', () => {
        assert.equal(formatReadoutNumber(NaN), '—');
        assert.equal(formatReadoutNumber(Infinity), '—');
        assert.equal(formatReadoutNumber(-Infinity), '—');
        assert.equal(formatReadoutNumber(undefined), '—');
        assert.equal(formatReadoutNumber(null), '—');
    });
});

describe('formatCursorReadout', () => {
    it('値ありは項目の間を半角空白2つで区切る', () => {
        assert.equal(formatCursorReadout({ x: 120.5, y: -40 }), 'X: 120.5  Y: -40.0');
    });

    it('原点は`-0.0`にならない', () => {
        assert.equal(formatCursorReadout({ x: -0, y: -0.03 }), 'X: 0.0  Y: 0.0');
    });

    it('nullは「—」', () => {
        assert.equal(formatCursorReadout(null), 'X: —  Y: —');
    });
});

describe('formatSizeReadout', () => {
    it('幅は maxX − minX、高さは maxY − minY', () => {
        const bounds = { minX: -10, minY: 20, maxX: 110, maxY: 100 };
        assert.equal(formatSizeReadout(bounds), 'W: 120.0  H: 80.0');
    });

    it('小数の大きさは小数第1位に丸める', () => {
        const bounds = { minX: 0, minY: 0, maxX: 102.04, maxY: 52 };
        assert.equal(formatSizeReadout(bounds), 'W: 102.0  H: 52.0');
    });

    it('nullは「—」', () => {
        assert.equal(formatSizeReadout(null), 'W: —  H: —');
    });
});

describe('formatGridReadout', () => {
    it('整数のまま単位pxを付ける', () => {
        assert.equal(formatGridReadout(10), 'グリッド: 10px');
        assert.equal(formatGridReadout(1000), 'グリッド: 1000px');
    });

    it('有限の数でなければ「—」', () => {
        assert.equal(formatGridReadout(NaN), 'グリッド: —');
        assert.equal(formatGridReadout(Infinity), 'グリッド: —');
        assert.equal(formatGridReadout(undefined), 'グリッド: —');
    });
});
