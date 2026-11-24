/**
 * 責務: 1つの`<canvas>`へ図形1つをサムネイルとして描く（引数だけから描き、状態を持たない）。
 */

import { THUMBNAIL_SIZE_PX, computeThumbnailFit, resolveThumbnailStrokeWidth } from './ThumbnailRules.js';

/** 恒等変換（写しを作るためだけに使う。凍結した定数）。 */
const IDENTITY_TRANSFORM = Object.freeze({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });

/**
 * 図形1つをサムネイルとして`<canvas>`へ描く。元の図形は書き換えず、`createTransformed`の写しへ線の太さの下限を当てて描く。
 * 内部バッファは `THUMBNAIL_SIZE_PX × pixelRatio` の正方形にし直す（代入で内容も消える）。外枠が求められなければ空のまま。
 * @param {HTMLCanvasElement} canvas 描画先
 * @param {{ strokeWidth: number, createTransformed: function(Object): Object }} shape 図形（共通メソッド`createTransformed`・`draw`を持つ）
 * @param {{minX:number, minY:number, maxX:number, maxY:number}|null} bounds 図形の外枠（線の太さを含む）
 * @param {number} pixelRatio `devicePixelRatio`
 * @returns {void}
 */
export function drawThumbnail(canvas, shape, bounds, pixelRatio) {
    const size = Math.max(1, Math.round(THUMBNAIL_SIZE_PX * pixelRatio));
    canvas.width = size;
    canvas.height = size;
    const fit = computeThumbnailFit(bounds);
    if (fit === null) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const copy = shape.createTransformed(IDENTITY_TRANSFORM);
    copy.strokeWidth = resolveThumbnailStrokeWidth(shape.strokeWidth, fit.scale);
    const r = canvas.width / THUMBNAIL_SIZE_PX;
    ctx.setTransform(r * fit.scale, 0, 0, r * fit.scale, r * fit.offsetX, r * fit.offsetY);
    copy.draw(ctx);
}
