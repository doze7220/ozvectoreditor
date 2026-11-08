/**
 * 責務: スプライトデータ形式（書き出し形式）の定義と判別（識別子・版）、および図形一式からのスプライトデータ（描画要素・外枠・作業データsource）の組み立て・JSON文字列化を担う。
 * DOMに依存しない。
 */
import { DocumentSerializer } from './DocumentSerializer.js';

/**
 * スプライトデータ形式の識別子。スプライトデータ最上位の`format`に格納する（作業データの識別子とは別の値）。
 * @type {string}
 */
const SPRITE_FORMAT = 'oz-vector-editor-sprite';

/**
 * スプライトデータ形式（書き出し形式）の現行版番号（唯一の定義箇所）。作業データの版（`source.version`）とは別。
 * @type {number}
 */
const SPRITE_FORMAT_VERSION = 1;

/**
 * 線の太さの既定値（px）。`strokeWidth`が正の有限の数値でない要素はこの値として扱う（唯一の定義箇所。`CodeExporter`が埋め込みに使う）。
 * @type {number}
 */
export const DEFAULT_STROKE_WIDTH = 2;

/**
 * 外枠（ワールド座標の最小・最大。`minX ≤ maxX`・`minY ≤ maxY`）。
 * @typedef {Object} SpriteBounds
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */

/**
 * 描画要素（図形1つ分）。共通のキーは`kind`・`id`・`strokeColor`・`strokeWidth`。
 * `kind`ごとの追加のキー: `polyline`＝`points`・`closed`／`quadratic`＝`points`／`ellipse`＝`x`・`y`・`radiusX`・`radiusY`・`startAngle`・`endAngle`・`closed`。
 * @typedef {Object} DrawElement
 * @property {string} kind 描き方の種類（'polyline'|'quadratic'|'ellipse'）
 * @property {*} id 図形のID
 * @property {string} strokeColor 線の色
 * @property {number} strokeWidth 線の太さ
 */

/**
 * スプライトデータ（書き出し形式・版1）の最上位の形。
 * @typedef {Object} SpriteData
 * @property {string} format 書き出し形式の識別子（'oz-vector-editor-sprite'）
 * @property {number} formatVersion 書き出し形式の版（1以上の整数）
 * @property {SpriteBounds|null} bounds 外枠（図形0個ならnull）
 * @property {Array<DrawElement>} elements 描画データ（描画順）
 * @property {Object} source 作業データ（`DocumentSerializer.serialize`の戻り値）
 */

/**
 * 形の範囲（中心線の外接矩形。線の太さを含まない）。
 * @typedef {Object} ShapeRange
 * @property {number} minX
 * @property {number} minY
 * @property {number} maxX
 * @property {number} maxY
 */

/**
 * `polyline`の形の範囲（全頂点の最小・最大）。
 * @param {DrawElement} element - `kind`が`polyline`の描画要素
 * @returns {ShapeRange} 形の範囲
 */
function polylineRange(element) {
    const xs = element.points.map((p) => p.x);
    const ys = element.points.map((p) => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * 2次ベジェ曲線の1軸分の最小・最大（始点・終点と、内部の極値）。制御点そのものは含めない。
 * @param {number} p0 - 始点の値
 * @param {number} p1 - 制御点の値
 * @param {number} p2 - 終点の値
 * @returns {{min: number, max: number}} 最小・最大
 */
function quadraticAxisRange(p0, p1, p2) {
    let min = Math.min(p0, p2);
    let max = Math.max(p0, p2);
    const denominator = p0 - 2 * p1 + p2;
    if (denominator !== 0) {
        const t = (p0 - p1) / denominator;
        if (t > 0 && t < 1) {
            const u = 1 - t;
            const value = u * u * p0 + 2 * u * t * p1 + t * t * p2;
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }
    return { min, max };
}

/**
 * `quadratic`の形の範囲（始点・終点と各軸の極値）。
 * @param {DrawElement} element - `kind`が`quadratic`の描画要素
 * @returns {ShapeRange} 形の範囲
 */
function quadraticRange(element) {
    const [a, b, c] = element.points;
    const xr = quadraticAxisRange(a.x, b.x, c.x);
    const yr = quadraticAxisRange(a.y, b.y, c.y);
    return { minX: xr.min, minY: yr.min, maxX: xr.max, maxY: yr.max };
}

/**
 * `ellipse`の形の範囲（弧の両端の点と、弧が通る軸上の端の点の最小・最大。弦は範囲に影響しない）。
 * @param {DrawElement} element - `kind`が`ellipse`の描画要素
 * @returns {ShapeRange} 形の範囲
 */
function ellipseRange(element) {
    const { x, y, radiusX, radiusY, startAngle } = element;
    let endAngle = element.endAngle;
    const fullTurn = 2 * Math.PI;
    if (endAngle < startAngle) {
        endAngle += fullTurn;
    }
    if (endAngle - startAngle >= fullTurn) {
        return { minX: x - radiusX, minY: y - radiusY, maxX: x + radiusX, maxY: y + radiusY };
    }
    /** @type {Array<{x: number, y: number}>} */
    const points = [
        { x: x + radiusX * Math.cos(startAngle), y: y + radiusY * Math.sin(startAngle) },
        { x: x + radiusX * Math.cos(endAngle), y: y + radiusY * Math.sin(endAngle) },
    ];
    const quarter = Math.PI / 2;
    const kFirst = Math.ceil(startAngle / quarter);
    const kLast = Math.floor(endAngle / quarter);
    for (let k = kFirst; k <= kLast; k++) {
        switch (((k % 4) + 4) % 4) {
            case 0: points.push({ x: x + radiusX, y }); break;
            case 1: points.push({ x, y: y + radiusY }); break;
            case 2: points.push({ x: x - radiusX, y }); break;
            default: points.push({ x, y: y - radiusY }); break;
        }
    }
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/**
 * `kind`→形の範囲を求める関数の対応表。`kind`を足すときはここへ追加する。
 * @type {Readonly<Object<string, (element: DrawElement) => ShapeRange>>}
 */
const SHAPE_RANGE_BY_KIND = Object.freeze({
    polyline: polylineRange,
    quadratic: quadraticRange,
    ellipse: ellipseRange,
});

/**
 * 線の太さを解決する（正の有限の数値でなければ既定値）。
 * @param {*} strokeWidth - 描画要素の`strokeWidth`
 * @returns {number} 外枠の計算に使う線の太さ
 */
function resolveStrokeWidth(strokeWidth) {
    return typeof strokeWidth === 'number' && Number.isFinite(strokeWidth) && strokeWidth > 0
        ? strokeWidth
        : DEFAULT_STROKE_WIDTH;
}

/**
 * 識別子・版の判別結果。
 * `'supported'`＝本アプリのスプライトデータで、版が1以上・現行版以下の整数／`'notSprite'`＝プレーンなオブジェクトでない、または`format`が識別子と一致しない／`'unsupportedVersion'`＝`format`は一致するが版が範囲外・整数でない・キーが無い。
 * @typedef {'supported'|'notSprite'|'unsupportedVersion'} SpriteFormatCheck
 */

/**
 * スプライトデータ形式の判別（識別子・版）・組み立て・JSON文字列化を行う静的メソッド群。インスタンス状態を持たず、DOMにも依存しない。
 */
export class SpriteSerializer {
    /**
     * 値が本アプリのスプライトデータ（書き出し形式）かを、識別子`format`と版`formatVersion`だけで判別する。
     * `bounds`・`elements`・`source`の形は見ない（必要な側が見る）。例外を投げず、警告も出さない。
     * 呼び出し元: `FileContentReader`・確認用ページの`SpriteCheckInspector`。
     * @param {*} value - 判別する値（JSON.parseの結果など。任意）
     * @returns {SpriteFormatCheck} `'notSprite'`（プレーンなオブジェクトでない／`format`不一致）、`'unsupportedVersion'`（`format`一致だが`formatVersion`が整数でない・1未満・現行版より大きい・キーが無い）、`'supported'`（上記以外）
     */
    static checkFormat(value) {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
            return 'notSprite';
        }
        if (value.format !== SPRITE_FORMAT) {
            return 'notSprite';
        }
        const version = value.formatVersion;
        if (!Number.isInteger(version) || version < 1 || version > SPRITE_FORMAT_VERSION) {
            return 'unsupportedVersion';
        }
        return 'supported';
    }

    /**
     * 図形の配列をスプライトデータ（現行版）へ変換する。入力を検証しない（`toDrawElement`を持たない要素が混ざると例外）。
     * @param {Array<Object>} shapes - 図形インスタンスの配列（描画順）
     * @returns {SpriteData} 新しいスプライトデータ（図形インスタンスと配列・頂点を共有しない。引数は書き換えない）
     * @throws {Error} 未知の`kind`の描画要素が得られた場合、または`toDrawElement`を持たない要素が混ざった場合
     */
    static serialize(shapes) {
        const elements = shapes.map((shape) => shape.toDrawElement());
        return {
            format: SPRITE_FORMAT,
            formatVersion: SPRITE_FORMAT_VERSION,
            bounds: SpriteSerializer.#computeBounds(elements),
            elements,
            source: DocumentSerializer.serialize(shapes),
        };
    }

    /**
     * スプライトデータをJSON文字列へ変換する（字下げ2。作業データファイルと同じ）。
     * @param {SpriteData} spriteData - スプライトデータ
     * @returns {string} JSON文字列
     */
    static stringify(spriteData) {
        return JSON.stringify(spriteData, null, 2);
    }

    /**
     * 描画要素の配列から外枠を求める（各要素の形の範囲を線の太さの半分だけ広げた和）。
     * @param {Array<DrawElement>} elements - 描画要素の配列
     * @returns {SpriteBounds|null} 外枠（要素0個ならnull）
     * @throws {Error} 未知の`kind`の要素がある場合
     */
    static #computeBounds(elements) {
        if (elements.length === 0) {
            return null;
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const element of elements) {
            const rangeOf = Object.prototype.hasOwnProperty.call(SHAPE_RANGE_BY_KIND, element.kind)
                ? SHAPE_RANGE_BY_KIND[element.kind]
                : undefined;
            if (typeof rangeOf !== 'function') {
                throw new Error(`SpriteSerializer: 未知の描画要素のkindです: ${String(element.kind)}`);
            }
            const range = rangeOf(element);
            const half = resolveStrokeWidth(element.strokeWidth) / 2;
            minX = Math.min(minX, range.minX - half);
            minY = Math.min(minY, range.minY - half);
            maxX = Math.max(maxX, range.maxX + half);
            maxY = Math.max(maxY, range.maxY + half);
        }
        return { minX, minY, maxX, maxY };
    }
}
