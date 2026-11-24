/**
 * 責務: 図形の一覧のサムネイルの収め方・線の太さの下限・描き直すかどうかの判定の規則（状態・DOMを持たない）。
 */

import { computeSpriteFitTransform } from './SpriteFitRules.js';

/** サムネイルの枠の1辺（CSSピクセル）。枠の大きさの唯一の定義。 */
export const THUMBNAIL_SIZE_PX = 28;

/** 枠の四辺の余白（CSSピクセル）。 */
const THUMBNAIL_PADDING_PX = 2;

/** 枠の上での線の太さの下限（ピクセル）。 */
const THUMBNAIL_MIN_STROKE_PX = 1;

/**
 * 図形の外枠を、サムネイルの枠へ収める倍率と平行移動を求める。
 * @param {{minX:number, minY:number, maxX:number, maxY:number}|null} bounds 図形の外枠（線の太さを含む）
 * @returns {{scale:number, offsetX:number, offsetY:number}|null} 収める変換。求められなければ null（描かない）
 */
export function computeThumbnailFit(bounds) {
    return computeSpriteFitTransform(bounds, THUMBNAIL_SIZE_PX, THUMBNAIL_SIZE_PX, THUMBNAIL_PADDING_PX);
}

/**
 * 枠の上で細くなりすぎないよう、線の太さへ下限を当てる。
 * 枠の上で `strokeWidth × scale` が1px未満なら `1 / scale`、それ以外は `strokeWidth`。
 * `scale` が正の有限でない、または `1 / scale` が有限でないときは `strokeWidth` のまま。
 * @param {number} strokeWidth 図形の線の太さ
 * @param {number} scale 枠へ収める倍率
 * @returns {number} 描くときの線の太さ
 */
export function resolveThumbnailStrokeWidth(strokeWidth, scale) {
    if (typeof scale !== 'number' || !Number.isFinite(scale) || scale <= 0) return strokeWidth;
    const minWidth = THUMBNAIL_MIN_STROKE_PX / scale;
    if (!Number.isFinite(minWidth)) return strokeWidth;
    if (strokeWidth * scale < THUMBNAIL_MIN_STROKE_PX) return minWidth;
    return strokeWidth;
}

/**
 * サムネイルを描き直すかの判定に使う鍵（文字列）を作る。図形の今の内容と画面の倍率で決まる。
 * @param {Object} shapeData 図形の`toJSON()`の結果
 * @param {number} pixelRatio `devicePixelRatio`
 * @returns {string} 鍵
 */
export function buildThumbnailKey(shapeData, pixelRatio) {
    return `${pixelRatio}|${JSON.stringify(shapeData)}`;
}

/**
 * 描き直すかを返す。最後に描いた鍵が無い（`undefined`）か、今の鍵と違うときに真。
 * @param {string|undefined} drawnKey その`<canvas>`に最後に描いた鍵
 * @param {string} key 今の鍵
 * @returns {boolean} 描き直すなら true
 */
export function needsThumbnailRedraw(drawnKey, key) {
    return drawnKey === undefined || drawnKey !== key;
}
