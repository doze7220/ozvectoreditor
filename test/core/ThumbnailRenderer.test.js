/**
 * 責務: ThumbnailRenderer（図形1つのサムネイル描画）の振る舞いを、偽のcanvas・図形を使い公開APIのみで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawThumbnail } from '../../js/core/ThumbnailRenderer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 呼び出しを記録する偽のcanvasを作る。
 * @param {Array<Array>} log 記録先
 * @returns {Object} 偽のcanvas
 */
function createFakeCanvas(log) {
    const ctx = {
        setTransform: (...args) => log.push(['setTransform', ...args]),
    };
    return {
        width: 0,
        height: 0,
        getContext: (kind) => {
            log.push(['getContext', kind]);
            return ctx;
        },
        ctx,
    };
}

/**
 * 偽の図形を作る（createTransformedで写しを返し、写しのdrawで記録する）。
 * @param {Array<Array>} log 記録先
 * @param {number} strokeWidth 線の太さ
 * @returns {Object} 偽の図形（`copies`に作った写しが入る）
 */
function createFakeShape(log, strokeWidth) {
    const shape = {
        strokeWidth,
        copies: [],
        transforms: [],
        createTransformed(transform) {
            shape.transforms.push(transform);
            const copy = {
                strokeWidth,
                draw(ctx) { log.push(['draw', copy.strokeWidth, ctx]); },
            };
            shape.copies.push(copy);
            return copy;
        },
        draw() { throw new Error('元の図形は描かない'); },
    };
    return shape;
}

describe('drawThumbnail', () => {
    it('内部バッファを28×pixelRatioの正方形にし、収める変換を設定して写しを描く', () => {
        const log = [];
        const canvas = createFakeCanvas(log);
        const shape = createFakeShape(log, 4);
        drawThumbnail(canvas, shape, { minX: 0, minY: 0, maxX: 12, maxY: 12 }, 2);
        assert.equal(canvas.width, 56);
        assert.equal(canvas.height, 56);
        assert.deepEqual(log[1], ['setTransform', 4, 0, 0, 4, 4, 4]);
        assert.equal(log[2][0], 'draw');
        assert.equal(log[2][1], 4);
        assert.equal(log[2][2], canvas.ctx);
    });

    it('写しは恒等変換で作り、元の図形のstrokeWidthは書き換えない', () => {
        const log = [];
        const canvas = createFakeCanvas(log);
        const shape = createFakeShape(log, 0.1);
        drawThumbnail(canvas, shape, { minX: 0, minY: 0, maxX: 48, maxY: 48 }, 1);
        assert.deepEqual(shape.transforms[0], { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        assert.equal(Object.isFrozen(shape.transforms[0]), true);
        assert.equal(shape.strokeWidth, 0.1);
        // scale = 0.5、枠上で0.05pxなので 1/scale = 2
        assert.equal(shape.copies[0].strokeWidth, 2);
    });

    it('外枠が求められなければ描かずバッファだけ作り直す', () => {
        const log = [];
        const canvas = createFakeCanvas(log);
        const shape = createFakeShape(log, 1);
        drawThumbnail(canvas, shape, null, 1);
        assert.equal(canvas.width, 28);
        assert.equal(shape.copies.length, 0);
        assert.deepEqual(log, []);
    });

    it('pixelRatioが極端に小さくてもバッファは1以上', () => {
        const log = [];
        const canvas = createFakeCanvas(log);
        drawThumbnail(canvas, createFakeShape(log, 1), null, 0.001);
        assert.equal(canvas.width, 1);
        assert.equal(canvas.height, 1);
    });
});

/**
 * 2Dコンテキストのメソッド呼び出しを名前順に記録する偽のcanvasを作る（プロパティの代入は受け流す）。
 * @param {Array<string>} calls 呼び出したメソッド名の記録先
 * @returns {Object} 偽のcanvas
 */
function createRecordingCanvas(calls) {
    const ctx = new Proxy({}, {
        get: (_target, name) => (...args) => { calls.push(String(name)); return args; },
        set: () => true,
    });
    return { width: 0, height: 0, getContext: () => ctx };
}

describe('drawThumbnail: 実際の図形', () => {
    const shapes = {
        rect: () => new Rect(0, 0, 40, 30, '#000000', 2, '#ff0000'),
        line: () => new Line(0, 0, 40, 30, '#000000', 2),
        circle: () => new Ellipse(0, 0, 40, 40, 'circle', '#000000', 2, '#00ff00'),
        curve: () => new Curve(0, 0, 40, 30, '#000000', 2),
        path: () => new Path([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 20, y: 30 }], true, '#000000', 2, '#0000ff'),
    };

    for (const [name, create] of Object.entries(shapes)) {
        it(`${name}を描き、元の図形のtoJSON()は変わらない`, () => {
            const calls = [];
            const canvas = createRecordingCanvas(calls);
            const shape = create();
            const before = JSON.stringify(shape.toJSON());
            const bounds = SpriteSerializer.computeShapesBounds([shape]);
            drawThumbnail(canvas, shape, bounds, 1);
            assert.equal(canvas.width, 28);
            assert.equal(calls[0], 'setTransform');
            assert.ok(calls.includes('stroke') || calls.includes('fill'));
            assert.equal(JSON.stringify(shape.toJSON()), before);
        });
    }

    it('線も塗りもない図形では何も描かない', () => {
        const calls = [];
        const canvas = createRecordingCanvas(calls);
        const shape = new Rect(0, 0, 40, 30, null, 2, null);
        const bounds = SpriteSerializer.computeShapesBounds([shape]);
        drawThumbnail(canvas, shape, bounds, 1);
        assert.equal(calls.includes('stroke'), false);
        assert.equal(calls.includes('fill'), false);
        assert.equal(calls.includes('beginPath'), false);
    });
});
