/**
 * 責務: ThumbnailRules（サムネイルの収め方・線の太さの下限・描き直しの判定）の振る舞いを公開APIのみで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    THUMBNAIL_SIZE_PX,
    computeThumbnailFit,
    resolveThumbnailStrokeWidth,
    buildThumbnailKey,
    needsThumbnailRedraw,
} from '../../js/core/ThumbnailRules.js';

describe('THUMBNAIL_SIZE_PX', () => {
    it('28', () => {
        assert.equal(THUMBNAIL_SIZE_PX, 28);
    });
});

describe('computeThumbnailFit', () => {
    it('枠28・余白2の内側(24)へ収めて中央に置く（拡大も行う）', () => {
        const fit = computeThumbnailFit({ minX: 0, minY: 0, maxX: 12, maxY: 12 });
        assert.deepEqual(fit, { scale: 2, offsetX: 2, offsetY: 2 });
    });

    it('縦長は短い方に合わせ、横を中央に置く', () => {
        const fit = computeThumbnailFit({ minX: 0, minY: 0, maxX: 10, maxY: 48 });
        assert.equal(fit.scale, 0.5);
        assert.equal(fit.offsetX, 2 + (24 - 5) / 2);
        assert.equal(fit.offsetY, 2);
    });

    it('幅・高さが0なら倍率1で中央、nullならnull', () => {
        const fit = computeThumbnailFit({ minX: 5, minY: 5, maxX: 5, maxY: 5 });
        assert.equal(fit.scale, 1);
        assert.equal(fit.offsetX, 2 + 12 - 5);
        assert.equal(computeThumbnailFit(null), null);
    });
});

describe('resolveThumbnailStrokeWidth', () => {
    it('枠の上で1px未満なら 1/scale', () => {
        assert.equal(resolveThumbnailStrokeWidth(1, 0.5), 2);
        assert.equal(resolveThumbnailStrokeWidth(0.1, 2), 0.5);
    });

    it('枠の上で1px以上ならそのまま（境目の1pxも）', () => {
        assert.equal(resolveThumbnailStrokeWidth(2, 0.5), 2);
        assert.equal(resolveThumbnailStrokeWidth(5, 1), 5);
    });

    it('scaleが正の有限でないならそのまま', () => {
        assert.equal(resolveThumbnailStrokeWidth(1, 0), 1);
        assert.equal(resolveThumbnailStrokeWidth(1, -2), 1);
        assert.equal(resolveThumbnailStrokeWidth(1, NaN), 1);
        assert.equal(resolveThumbnailStrokeWidth(1, Infinity), 1);
        assert.equal(resolveThumbnailStrokeWidth(1, '2'), 1);
    });

    it('1/scaleが有限でないならそのまま', () => {
        assert.equal(resolveThumbnailStrokeWidth(0, Number.MIN_VALUE), 0);
    });
});

describe('buildThumbnailKey / needsThumbnailRedraw', () => {
    it('同じ内容・倍率は同じ鍵、内容か倍率が違えば別の鍵', () => {
        const data = { type: 'rect', x1: 0 };
        assert.equal(buildThumbnailKey(data, 1), buildThumbnailKey({ type: 'rect', x1: 0 }, 1));
        assert.notEqual(buildThumbnailKey(data, 1), buildThumbnailKey({ type: 'rect', x1: 1 }, 1));
        assert.notEqual(buildThumbnailKey(data, 1), buildThumbnailKey(data, 2));
        assert.equal(typeof buildThumbnailKey(data, 1), 'string');
    });

    it('描いた鍵が無い・違うときだけ真', () => {
        assert.equal(needsThumbnailRedraw(undefined, 'a'), true);
        assert.equal(needsThumbnailRedraw('b', 'a'), true);
        assert.equal(needsThumbnailRedraw('a', 'a'), false);
    });
});
