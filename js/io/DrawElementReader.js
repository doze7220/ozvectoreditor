/**
 * 責務: スプライトデータの描画要素1つを、図形クラスの`toJSON()`の形（図形データ）へ変換する規則を持つ（描画要素→図形データの知識はここだけ。`compoundPath`は輪郭ごとの図形データの並びへ変換する）。
 * 状態・DOMを持たず、図形データの規則（点の数・座標の有限性等）の検証は`ShapeFactory.fromJSON`に任せる。
 */
import { resolveStrokeWidth } from './SpriteSerializer.js';

/**
 * 角度の比較の許容差（ラジアン）。1周・半周・4分の1回転の整数倍の判定に使う。
 * @type {number}
 */
const ANGLE_TOLERANCE = 1e-9;

/**
 * 1周（2π）。
 * @type {number}
 */
const FULL_TURN = 2 * Math.PI;

/**
 * 4分の1回転ごとの余弦の正確な値（0・90・180・270度）。
 * @type {ReadonlyArray<number>}
 */
const QUARTER_COS = Object.freeze([1, 0, -1, 0]);

/**
 * 4分の1回転ごとの正弦の正確な値（0・90・180・270度）。
 * @type {ReadonlyArray<number>}
 */
const QUARTER_SIN = Object.freeze([0, 1, 0, -1]);

/**
 * プレーンなオブジェクト（`null`・配列でない）か。
 * @param {*} value - 調べる値
 * @returns {boolean} プレーンなオブジェクトなら`true`
 */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 有限の数値か。
 * @param {*} value - 調べる値
 * @returns {boolean} 有限の数値なら`true`
 */
function isFiniteNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

/**
 * 点（`{x, y}`）を新しいオブジェクトへ写す。プレーンなオブジェクトでなければそのまま返す（検証は`ShapeFactory.fromJSON`に任せる）。
 * @param {*} point - 点
 * @returns {*} 新しい点、または元の値
 */
function copyPoint(point) {
    return isPlainObject(point) ? { x: point.x, y: point.y } : point;
}

/**
 * 点の並びを新しい配列へ写す。
 * @param {Array} points - 点の並び
 * @returns {Array} 新しい配列
 */
function copyPoints(points) {
    return points.map(copyPoint);
}

/**
 * 角度の余弦・正弦を返す。角度が4分の1回転の整数倍（許容差`ANGLE_TOLERANCE`以内）ならちょうどの値（0・1・−1）を返す。
 * @param {number} angle - 角度（ラジアン）
 * @returns {{cos: number, sin: number}} 余弦・正弦
 */
function exactCosSin(angle) {
    const quarters = angle / (Math.PI / 2);
    const nearest = Math.round(quarters);
    if (Math.abs(quarters - nearest) * (Math.PI / 2) <= ANGLE_TOLERANCE) {
        const index = ((nearest % 4) + 4) % 4;
        return { cos: QUARTER_COS[index], sin: QUARTER_SIN[index] };
    }
    return { cos: Math.cos(angle), sin: Math.sin(angle) };
}

/**
 * スタイル（線の色・太さ・塗りの色）を図形データの項目へ読む（`draw`と同じ読み方）。
 * @param {Object} element - 描画要素
 * @param {boolean} fillable - 塗れる要素か（塗れなければ`fillColor`は`null`）
 * @returns {{strokeColor: (string|null), strokeWidth: number, fillColor: (string|null)}} スタイル
 */
function readStyle(element, fillable) {
    return {
        strokeColor: typeof element.strokeColor === 'string' ? element.strokeColor : null,
        strokeWidth: resolveStrokeWidth(element.strokeWidth),
        fillColor: fillable && typeof element.fillColor === 'string' ? element.fillColor : null,
    };
}

/**
 * `points`が配列であることを確かめる。
 * @param {Object} element - 描画要素
 * @returns {Array} `points`
 * @throws {Error} 配列でないとき
 */
function requirePoints(element) {
    if (!Array.isArray(element.points)) {
        throw new Error(`DrawElementReader: ${element.kind}のpointsが配列ではありません`);
    }
    return element.points;
}

/**
 * `polyline`を図形データへ変換する。閉じていない2点は直線、ほかはすべて直線区間のパス。
 * @param {Object} element - 描画要素
 * @returns {Object} 図形データ
 * @throws {Error} `points`が配列でないとき
 */
function convertPolyline(element) {
    const points = copyPoints(requirePoints(element));
    const closed = element.closed === true;
    if (!closed && points.length === 2) {
        return { type: 'line', points, ...readStyle(element, false) };
    }
    const segmentCount = Math.max(0, closed ? points.length : points.length - 1);
    return {
        type: 'path',
        points,
        closed,
        segments: Array.from({ length: segmentCount }, () => ({ kind: 'line' })),
        ...readStyle(element, closed),
    };
}

/**
 * `bezierPath`の区間1つを図形データの区間へ変換する（`cubic`→`bezier`）。
 * @param {*} segment - 描画要素の区間
 * @param {number} index - 区間の位置
 * @returns {Object} 図形データの区間
 * @throws {Error} プレーンなオブジェクトでない・知らない`kind`のとき
 */
function convertSegment(segment, index) {
    if (!isPlainObject(segment)) {
        throw new Error(`DrawElementReader: bezierPathのsegments[${index}]がオブジェクトではありません`);
    }
    if (segment.kind === 'line') {
        return { kind: 'line' };
    }
    if (segment.kind === 'cubic') {
        return { kind: 'bezier', control1: copyPoint(segment.control1), control2: copyPoint(segment.control2) };
    }
    throw new Error(`DrawElementReader: bezierPathのsegments[${index}]のkindが'line'・'cubic'ではありません（${String(segment.kind)}）`);
}

/**
 * `bezierPath`を図形データ（パス）へ変換する。
 * @param {Object} element - 描画要素
 * @returns {Object} 図形データ
 * @throws {Error} `points`・`segments`が配列でない・区間が不正なとき
 */
function convertBezierPath(element) {
    const points = copyPoints(requirePoints(element));
    if (!Array.isArray(element.segments)) {
        throw new Error('DrawElementReader: bezierPathのsegmentsが配列ではありません');
    }
    const closed = element.closed === true;
    return {
        type: 'path',
        points,
        closed,
        segments: element.segments.map(convertSegment),
        ...readStyle(element, closed),
    };
}

/**
 * `quadratic`を図形データ（曲線）へ変換する。
 * @param {Object} element - 描画要素
 * @returns {Object} 図形データ
 * @throws {Error} `points`が配列でないとき
 */
function convertQuadratic(element) {
    return { type: 'curve', points: copyPoints(requirePoints(element)), ...readStyle(element, false) };
}

/**
 * `ellipse`を図形データ（円・弧）へ変換する。閉じた1周は円、開いた半周は弧。ほかは断る。
 * @param {Object} element - 描画要素
 * @returns {Object} 図形データ
 * @throws {Error} 項目が有限の数値でない・半径が負・円でも弧でもない角度のとき
 */
function convertEllipse(element) {
    const { x, y, radiusX, radiusY, startAngle, endAngle } = element;
    const required = { x, y, radiusX, radiusY, startAngle, endAngle };
    Object.keys(required).forEach((name) => {
        if (!isFiniteNumber(required[name])) {
            throw new Error(`DrawElementReader: ellipseの${name}が有限の数値ではありません`);
        }
    });
    if (radiusX < 0 || radiusY < 0) {
        throw new Error('DrawElementReader: ellipseの半径が負です');
    }
    const rotation = isFiniteNumber(element.rotation) ? element.rotation : 0;
    const closed = element.closed === true;
    let sweep = endAngle - startAngle;
    if (sweep < 0) {
        sweep += FULL_TURN;
    }
    let type;
    let delta;
    if (closed && Math.abs(sweep - FULL_TURN) <= ANGLE_TOLERANCE) {
        type = 'circle';
        delta = 0;
    } else if (!closed && Math.abs(sweep - Math.PI) <= ANGLE_TOLERANCE) {
        type = 'arc';
        delta = startAngle - Math.PI;
    } else {
        throw new Error('DrawElementReader: ellipseの角度が閉じた1周でも開いた半周でもありません');
    }
    const rot = exactCosSin(rotation);
    const del = exactCosSin(delta);
    const rotate = (a, b) => ({ x: a * rot.cos - b * rot.sin, y: a * rot.sin + b * rot.cos });
    const u = rotate(radiusX * del.cos, radiusY * del.sin);
    const w = rotate(radiusX * del.sin, -radiusY * del.cos);
    const plus = (v) => ({ x: x + v.x, y: y + v.y });
    const startPoint = type === 'circle' ? plus(u) : { x: x - u.x, y: y - u.y };
    return {
        type,
        points: [{ x, y }, plus(u), plus(w), startPoint, plus(u)],
        ...readStyle(element, type === 'circle'),
    };
}

/**
 * 描画要素の`kind`→変換関数の対応表。
 * @type {Readonly<Record<string, (element: Object) => Object>>}
 */
const CONVERTER_BY_KIND = Object.freeze({
    polyline: convertPolyline,
    bezierPath: convertBezierPath,
    quadratic: convertQuadratic,
    ellipse: convertEllipse,
});

/**
 * 描画要素から図形データへの変換器（静的メソッドのみ）。
 */
export class DrawElementReader {
    /**
     * 描画要素1つを図形データ（新しいオブジェクト。`id`・名前・表示・ロックのキーは持たない）へ変換する。
     * 図形データの規則（点の数・座標の有限性・区間の数等）は検証しない（`ShapeFactory.fromJSON`に任せる）。引数を書き換えず、警告を出さない。知らないキー（`id`等）は読まない。
     * @param {Object} element - 描画要素（`polyline`・`bezierPath`・`quadratic`・`ellipse`）
     * @returns {Object} 図形データ（`ShapeFactory.fromJSON`が受ける形）
     * @throws {Error} 要素がプレーンなオブジェクトでない・`kind`が未知・変換に要る項目が無い・表に当てはまらない円弧のとき
     */
    static toShapeData(element) {
        if (!isPlainObject(element)) {
            throw new Error('DrawElementReader: 描画要素がオブジェクトではありません');
        }
        const kind = element.kind;
        if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(CONVERTER_BY_KIND, kind)) {
            throw new Error(`DrawElementReader: 描画要素のkindが未知です（${String(kind)}）`);
        }
        return CONVERTER_BY_KIND[kind](element);
    }
    /**
     * 描画要素`compoundPath`を、輪郭ごとの図形データ（`ShapeFactory.fromJSON`が受ける形）の配列にして返す。
     * 輪郭に要素のスタイル（線の色・太さ・塗りの色）を足したものを`toShapeData`と同じ変換関数で図形データにし、
     * 塗りの色だけを要素の値（文字列ならその値、でなければ`null`。塗れない形でも保つ）で上書きする。
     * 図形データの並びを返すだけで、それをどう組み立てて読むかは呼び出し側が決める（作業データの語彙はここでは扱わない）。
     * 引数を書き換えず、警告を出さない。
     * @param {*} element - 描画要素
     * @returns {Array<Object>|null} 輪郭ごとの図形データの配列。`compoundPath`でない要素（オブジェクトでない・`kind`が`compoundPath`でない）は`null`（対象外）
     * @throws {Error} `outlines`が配列でない・空、輪郭がオブジェクトでない・`kind`が変換表に無い、または輪郭の変換に失敗したとき
     */
    static toCompoundPathShapeData(element) {
        if (!isPlainObject(element) || element.kind !== 'compoundPath') {
            return null;
        }
        if (!Array.isArray(element.outlines) || element.outlines.length === 0) {
            throw new Error('DrawElementReader: compoundPathのoutlinesが空でない配列ではありません');
        }
        const fillColor = typeof element.fillColor === 'string' ? element.fillColor : null;
        return element.outlines.map((outline, index) => {
            if (!isPlainObject(outline)) {
                throw new Error(`DrawElementReader: compoundPathのoutlines[${index}]がオブジェクトではありません`);
            }
            const kind = outline.kind;
            if (typeof kind !== 'string' || !Object.prototype.hasOwnProperty.call(CONVERTER_BY_KIND, kind)) {
                throw new Error(`DrawElementReader: compoundPathのoutlines[${index}]のkindが未知です（${String(kind)}）`);
            }
            const data = CONVERTER_BY_KIND[kind]({
                ...outline,
                strokeColor: element.strokeColor,
                strokeWidth: element.strokeWidth,
                fillColor: element.fillColor,
            });
            return { ...data, fillColor };
        });
    }
}
