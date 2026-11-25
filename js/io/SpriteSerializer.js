/**
 * 責務: スプライトデータ形式（書き出し形式）の定義と判別（識別子・版）、および図形一式からのスプライトデータ（描画要素・外枠・作業データsource）の組み立て・JSON文字列化、外枠（線を含む・線を含まない）の照会を担う。
 * DOMに依存しない。
 */
import { DocumentSerializer } from './DocumentSerializer.js';
import { toItems } from '../core/ItemTreeRules.js';
import { listVisibleShapes } from '../core/ItemStateRules.js';

/**
 * スプライトデータ形式の識別子。スプライトデータ最上位の`format`に格納する（作業データの識別子とは別の値）。
 * @type {string}
 */
const SPRITE_FORMAT = 'oz-vector-editor-sprite';

/**
 * スプライトデータ形式（書き出し形式）の現行版番号（唯一の定義箇所）。作業データの版（`source.version`）とは別。
 * 版3: 曲線のパスの描画要素`bezierPath`を足した。古い読み手は未知の`kind`として描かず正しく描けないため版を上げた。
 * 版4: 描画要素`ellipse`に回転の角度`rotation`（ラジアン）を足した。版3の読み手は未知のキーとして無視すると回した楕円を正しく描けないため版を上げた（`checkFormat`は版1〜4を受理する）。
 * @type {number}
 */
const SPRITE_FORMAT_VERSION = 4;

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
 * 描画要素（図形1つ分）。共通のキーは`kind`・`id`・`strokeColor`・`strokeWidth`・`fillColor`（`fillColor`は各`kind`のキー列の最後）。
 * `kind`ごとの追加のキー: `polyline`＝`points`・`closed`／`bezierPath`＝`points`・`closed`・`segments`／`quadratic`＝`points`／`ellipse`＝`x`・`y`・`radiusX`・`radiusY`・`rotation`・`startAngle`・`endAngle`・`closed`（`rotation`は`ctx.ellipse`の回転の角度。有限の数値でなければ0として扱う）。
 * `bezierPath`の`segments[i]`は`points[i]`→`points[(i + 1) % points.length]`の区間で、直線は`{kind: 'line'}`、3次ベジェは`{kind: 'cubic', control1: {x, y}, control2: {x, y}}`。
 * キー列: `polyline`＝`kind, id, points, closed, strokeColor, strokeWidth, fillColor`／`bezierPath`＝`kind, id, points, closed, segments, strokeColor, strokeWidth, fillColor`／`quadratic`＝`kind, id, points, strokeColor, strokeWidth, fillColor`（`fillColor`は常に`null`）／`ellipse`＝`kind, id, x, y, radiusX, radiusY, rotation, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor`。
 * @typedef {Object} DrawElement
 * @property {string} kind 描き方の種類（'polyline'|'bezierPath'|'quadratic'|'ellipse'）
 * @property {*} id 図形のID
 * @property {string|null} strokeColor 線の色（nullは線なし）
 * @property {number} strokeWidth 線の太さ
 * @property {string|null} fillColor 塗りの色（nullは塗りなし。塗れない形の図形からはnullが入る）
 */

/**
 * スプライトデータ（書き出し形式・版4）の最上位の形。
 * @typedef {Object} SpriteData
 * @property {string} format 書き出し形式の識別子（'oz-vector-editor-sprite'）
 * @property {number} formatVersion 書き出し形式の版（現行は4。1以上の整数）
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
 * 3次ベジェ曲線の1軸分の最小・最大（始点・終点と、内部の極値）。制御点そのものは含めない。
 * この3次ベジェの計算は`shapes/ShapeGeometry`の`cubicBezierPoint`とは別の定義（`io/`は`shapes/`をimportできない。`quadraticAxisRange`と同じ扱い）。
 * @param {number} p0 - 始点の値
 * @param {number} c1 - 制御点1の値
 * @param {number} c2 - 制御点2の値
 * @param {number} p3 - 終点の値
 * @returns {{min: number, max: number}} 最小・最大
 */
function cubicAxisRange(p0, c1, c2, p3) {
    let min = Math.min(p0, p3);
    let max = Math.max(p0, p3);
    const a = -p0 + 3 * c1 - 3 * c2 + p3;
    const b = 2 * (p0 - 2 * c1 + c2);
    const c = c1 - p0;
    /** @type {Array<number>} */
    const roots = [];
    if (a === 0) {
        if (b !== 0) {
            roots.push(-c / b);
        }
    } else {
        const discriminant = b * b - 4 * a * c;
        if (discriminant >= 0) {
            const root = Math.sqrt(discriminant);
            roots.push((-b + root) / (2 * a), (-b - root) / (2 * a));
        }
    }
    for (const t of roots) {
        if (t > 0 && t < 1) {
            const u = 1 - t;
            const value = u * u * u * p0 + 3 * u * u * t * c1 + 3 * u * t * t * c2 + t * t * t * p3;
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
    }
    return { min, max };
}

/**
 * `bezierPath`の形の範囲（全頂点の最小・最大と、`kind`が`'cubic'`の区間ごとの各軸の極値の和。制御点そのものは含めない）。
 * 区間`i`の始点は`points[i]`、終点は`points[(i + 1) % points.length]`。
 * @param {DrawElement} element - `kind`が`bezierPath`の描画要素
 * @returns {ShapeRange} 形の範囲
 */
function bezierPathRange(element) {
    const { points, segments } = element;
    const range = polylineRange(element);
    let { minX, minY, maxX, maxY } = range;
    segments.forEach((segment, i) => {
        if (segment.kind !== 'cubic') {
            return;
        }
        const a = points[i];
        const b = points[(i + 1) % points.length];
        const xr = cubicAxisRange(a.x, segment.control1.x, segment.control2.x, b.x);
        const yr = cubicAxisRange(a.y, segment.control1.y, segment.control2.y, b.y);
        minX = Math.min(minX, xr.min);
        maxX = Math.max(maxX, xr.max);
        minY = Math.min(minY, yr.min);
        maxY = Math.max(maxY, yr.max);
    });
    return { minX, minY, maxX, maxY };
}

/**
 * `ellipse`の形の範囲（弧の両端の点と、弧が通る軸上の端の点の最小・最大。弦は範囲に影響しない）。
 * `rotation`が有限の数値で0でないときは、回した楕円として両端の点と、x・yそれぞれの極値の角度（範囲内のもの）の点の最小・最大を返す。
 * `rotation`が0・キーが無い・数値でないときは回していない楕円の手順（値も従来と同じ）。
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
    const rotation = element.rotation;
    if (typeof rotation === 'number' && Number.isFinite(rotation) && rotation !== 0) {
        const cosR = Math.cos(rotation);
        const sinR = Math.sin(rotation);
        const pointAt = (t) => {
            const ex = radiusX * Math.cos(t);
            const ey = radiusY * Math.sin(t);
            return { x: x + ex * cosR - ey * sinR, y: y + ex * sinR + ey * cosR };
        };
        /** @type {Array<{x: number, y: number}>} */
        const candidates = [pointAt(startAngle), pointAt(endAngle)];
        const tx = Math.atan2(-radiusY * sinR, radiusX * cosR);
        const ty = Math.atan2(radiusY * cosR, radiusX * sinR);
        for (const base of [tx, tx + Math.PI, ty, ty + Math.PI]) {
            for (let k = Math.ceil((startAngle - base) / fullTurn); base + fullTurn * k <= endAngle; k++) {
                candidates.push(pointAt(base + fullTurn * k));
            }
        }
        const rxs = candidates.map((p) => p.x);
        const rys = candidates.map((p) => p.y);
        return { minX: Math.min(...rxs), minY: Math.min(...rys), maxX: Math.max(...rxs), maxY: Math.max(...rys) };
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
    bezierPath: bezierPathRange,
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
     * アイテムまたは素の図形インスタンスの配列をスプライトデータ（現行版）へ変換する。入力を検証しない（`toDrawElement`を持たない図形が混ざると例外）。
     * `elements`・`bounds`は入れ子を描画順（深さ優先・前順）に平らにした図形のうち、見えている図形（自分の表示が切でなく、上のフォルダのどれも表示が切でないもの。ロックは効かない）だけから求める（名前・ロックは効かない）。すべて隠れていれば`elements`は空・`bounds`は`null`。`source`は隠れた図形も含む全部で、`DocumentSerializer.serialize(values)`の戻り値そのもの。
     * 名前・表示・ロック・フォルダを保つには`model.getItems()`または`DocumentSerializer.deserialize`の`items`を渡す（素の図形を渡すと名前が振り直され、フォルダは無い）。
     * @param {Array<Object>} values - アイテムまたは素の図形インスタンスの配列（描画順）
     * @returns {SpriteData} 新しいスプライトデータ（図形インスタンスと配列・頂点を共有しない。引数は書き換えない）
     * @throws {Error} 未知の`kind`の描画要素が得られた場合、または`toDrawElement`を持たない要素が混ざった場合
     */
    static serialize(values) {
        const elements = listVisibleShapes(toItems(values)).map((shape) => shape.toDrawElement());
        return {
            format: SPRITE_FORMAT,
            formatVersion: SPRITE_FORMAT_VERSION,
            bounds: SpriteSerializer.#computeBounds(elements),
            elements,
            source: DocumentSerializer.serialize(values),
        };
    }

    /**
     * 図形の配列から外枠を求める（`serialize(shapes).bounds`と同じ値。`serialize`の外枠の計算をそのまま使う）。
     * @param {Array<Object>} shapes - 図形インスタンスの配列（描画順。引数は書き換えない）
     * @returns {SpriteBounds|null} 外枠（図形0個ならnull）
     * @throws {Error} `serialize`の外枠の計算と同じ（未知の`kind`の描画要素が得られた場合、または`toDrawElement`を持たない要素が混ざった場合）
     */
    static computeShapesBounds(shapes) {
        return SpriteSerializer.#computeBounds(shapes.map((shape) => shape.toDrawElement()));
    }

    /**
     * 図形の配列から線を含まない外枠を求める（描画要素ごとの形の範囲＝中心線の外接矩形の和。線の太さの半分は広げない）。
     * `polyline`は全頂点、`quadratic`・`bezierPath`は端点と各軸の極値（制御点そのものは含めない）、`ellipse`は弧の両端と軸上の端点の範囲。線なしの要素も和に含める。
     * 線を含む外枠（`computeShapesBounds`）より、線を描く図形の分だけ線の太さの半分ずつ内側になる。
     * @param {Array<Object>} shapes - 図形インスタンスの配列（描画順。引数は書き換えない）
     * @returns {SpriteBounds|null} 線を含まない外枠（図形0個ならnull。毎回新しいオブジェクト）
     * @throws {Error} `computeShapesBounds`と同じ（未知の`kind`の描画要素が得られた場合、または`toDrawElement`を持たない要素が混ざった場合）
     */
    static computeShapesGeometryBounds(shapes) {
        return SpriteSerializer.#computeBounds(shapes.map((shape) => shape.toDrawElement()), false);
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
     * 描画要素の配列から外枠を求める（各要素の形の範囲の和。`strokeColor`が文字列の要素は形の範囲を線の太さの半分だけ広げ、線を描かない要素は形の範囲のまま。線なしで塗れない要素も和に含める）。
     * `includeStroke`が偽なら線の太さの半分を広げない（線を含まない外枠。形の範囲の和そのもの）。
     * @param {Array<DrawElement>} elements - 描画要素の配列
     * @param {boolean} [includeStroke=true] - 線の太さの半分を広げるか（省略時は広げる）
     * @returns {SpriteBounds|null} 外枠（要素0個ならnull）
     * @throws {Error} 未知の`kind`の要素がある場合
     */
    static #computeBounds(elements, includeStroke = true) {
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
            const half = includeStroke && typeof element.strokeColor === 'string'
                ? resolveStrokeWidth(element.strokeWidth) / 2
                : 0;
            minX = Math.min(minX, range.minX - half);
            minY = Math.min(minY, range.minY - half);
            maxX = Math.max(maxX, range.maxX + half);
            maxY = Math.max(maxY, range.maxY + half);
        }
        return { minX, minY, maxX, maxY };
    }
}
