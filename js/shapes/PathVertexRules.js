/**
 * 責務: 線・パスの頂点の追加と削除の規則（輪郭の元への読み替え・区間の上の最も近い位置・曲がり方を持つ区間の分割・点を足した／消した新しい図形の組み立て）を、
 * 状態を持たない関数として提供する。モデル・履歴・選択・操作モード・表示倍率を知らず、ワールド座標の許容幅を引数で受け取る。
 */
import { SEGMENT_KIND_LINE, SMOOTH_SEGMENT_SAMPLE_COUNT, resolveSegmentControls } from './Path.js';
import { segmentSpecsOf, chainSourceOf } from './PathJoinRules.js';
import { cubicBezierPoint } from './ShapeGeometry.js';

/**
 * 曲線の区間の上の最も近い位置を精密にするときの三分探索の反復回数。唯一の定義箇所。
 * @type {number}
 */
const NEAREST_REFINE_ITERATIONS = 40;

/**
 * 輪郭の元（点を足す・消す計算のために、直線・矩形・今の曲線・パスの`toJSON()`の値を「パスの図形データの形」に読み替えたもの）。
 * @typedef {Object} OutlineSource
 * @property {string} type 常に`'path'`
 * @property {Array<{x: number, y: number}>} points 頂点の並び
 * @property {boolean} closed 閉じているか
 * @property {Array<{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}>} segments 区間の並び（開いた`n - 1`・閉じた`n`）
 * @property {boolean[]} [corners] 頂点ごとの角の点か（パスで角が1つ以上あるときだけ）
 * @property {string|null} strokeColor 線の色
 * @property {number} strokeWidth 線の太さ
 * @property {string|null} fillColor 塗りの色
 */

/**
 * 区間の上の位置。
 * @typedef {Object} SegmentLocation
 * @property {number} segmentIndex 区間の番号（`points[i]`→`points[(i+1) % n]`）
 * @property {number} t 区間の上の割合（0〜1）
 * @property {{x: number, y: number}} point 区間の上の点
 * @property {number} distance 検索した点との距離（曲線の区間は折れ線の近似での距離。`Path.hitTest`と同じ測り方）
 */

/**
 * 3次ベジェを2つに分けた結果（de Casteljau）。前半＝始点・`first.control1`・`first.control2`・`point`、後半＝`point`・`second.control1`・`second.control2`・終点。
 * @typedef {Object} CubicSplit
 * @property {{control1: {x: number, y: number}, control2: {x: number, y: number}}} first 前半の制御点
 * @property {{x: number, y: number}} point 分けた点
 * @property {{control1: {x: number, y: number}, control2: {x: number, y: number}}} second 後半の制御点
 */

/**
 * 区間の値の新しい写しを作る（座標は新しいオブジェクト）。
 * @param {{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}|string} spec - 区間の指定（文字列なら種類）
 * @returns {{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}} 新しい区間の値
 */
function copySegmentValue(spec) {
    if (typeof spec === 'string') {
        return { kind: spec };
    }
    if (spec.control1 !== undefined && spec.control2 !== undefined) {
        return {
            kind: spec.kind,
            control1: { x: spec.control1.x, y: spec.control1.y },
            control2: { x: spec.control2.x, y: spec.control2.y },
        };
    }
    return { kind: spec.kind };
}

/**
 * 直線・矩形・今の曲線・パスの`toJSON()`の値を、点を足す・消す計算のための「輪郭の元」（パスの図形データの形）に読み替える。
 * 直線＝点2つ・開いた・直線の区間1つ（`segmentSpecsOf`の結果）、矩形＝点4つ・閉じた・直線の区間4つ（「矩形は閉じた4つの直線の区間」の唯一の定義箇所）、
 * 今の曲線＝`chainSourceOf`の結果（2次→3次の式はそこの1か所）、パス＝`toJSON()`の値の写し。円・弧など上記以外は`null`。
 * 引数を書き換えず、結果は引数と配列・点を共有しない。
 * @param {Object} data - 図形の`toJSON()`の値
 * @returns {OutlineSource|null} 輪郭の元。対象外は`null`
 */
export function outlineSourceOf(data) {
    const copyPoints = (points) => points.map((point) => ({ x: point.x, y: point.y }));
    switch (data.type) {
        case 'line':
            return {
                type: 'path',
                points: copyPoints(data.points),
                closed: false,
                segments: segmentSpecsOf(data).map(copySegmentValue),
                strokeColor: data.strokeColor,
                strokeWidth: data.strokeWidth,
                fillColor: data.fillColor,
            };
        case 'rect':
            return {
                type: 'path',
                points: copyPoints(data.points),
                closed: true,
                segments: Array.from({ length: 4 }, () => ({ kind: SEGMENT_KIND_LINE })),
                strokeColor: data.strokeColor,
                strokeWidth: data.strokeWidth,
                fillColor: data.fillColor,
            };
        case 'curve': {
            const source = chainSourceOf(data);
            return {
                ...source,
                points: copyPoints(source.points),
                segments: source.segments.map(copySegmentValue),
            };
        }
        case 'path':
            return {
                ...data,
                points: copyPoints(data.points),
                segments: data.segments.map(copySegmentValue),
                ...(Array.isArray(data.corners) ? { corners: data.corners.slice() } : {}),
            };
        default:
            return null;
    }
}

/**
 * 線分`a`→`b`の上の、`point`に最も近い位置を求める。長さ0の線分は`t = 0`。
 * @param {{x: number, y: number}} a - 線分の始点
 * @param {{x: number, y: number}} b - 線分の終点
 * @param {{x: number, y: number}} point - 検索する点
 * @returns {{t: number, point: {x: number, y: number}, distance: number}} 割合・線分の上の点・距離
 */
function projectOntoLine(a, b, point) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;
    let t = lengthSquared === 0 ? 0 : ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));
    const closest = { x: a.x + t * dx, y: a.y + t * dy };
    return { t, point: closest, distance: Math.hypot(point.x - closest.x, point.y - closest.y) };
}

/**
 * 曲線の区間（3次ベジェ）の上の、`point`に最も近い位置を求める。
 * `Path.hitTest`と同じ折れ線の近似（`SMOOTH_SEGMENT_SAMPLE_COUNT`個の小区間）で最も近い小区間を選び（同じ距離なら番号の小さい小区間）、
 * その距離を`distance`とする。その近くの範囲で三分探索して、真の曲線の上で最も近い`t`と点を求める。
 * @param {{x: number, y: number}} a - 区間の始点
 * @param {{x: number, y: number}} control1 - 引っ張る点1
 * @param {{x: number, y: number}} control2 - 引っ張る点2
 * @param {{x: number, y: number}} b - 区間の終点
 * @param {{x: number, y: number}} point - 検索する点
 * @returns {{t: number, point: {x: number, y: number}, distance: number}} 割合・曲線の上の点・折れ線の近似での距離
 */
function projectOntoCurve(a, control1, control2, b, point) {
    const count = SMOOTH_SEGMENT_SAMPLE_COUNT;
    let prev = a;
    let best = null;
    for (let k = 1; k <= count; k++) {
        const next = k === count ? b : cubicBezierPoint(a, control1, control2, b, k / count);
        const hit = projectOntoLine(prev, next, point);
        if (best === null || hit.distance < best.distance) {
            best = { k, s: hit.t, distance: hit.distance };
        }
        prev = next;
    }
    const distanceAt = (t) => {
        const p = cubicBezierPoint(a, control1, control2, b, t);
        return Math.hypot(point.x - p.x, point.y - p.y);
    };
    let low = Math.max(0, (best.k - 2) / count);
    let high = Math.min(1, (best.k + 1) / count);
    for (let i = 0; i < NEAREST_REFINE_ITERATIONS; i++) {
        const m1 = low + (high - low) / 3;
        const m2 = high - (high - low) / 3;
        if (distanceAt(m1) <= distanceAt(m2)) {
            high = m2;
        } else {
            low = m1;
        }
    }
    const t0 = (best.k - 1 + best.s) / count;
    const refined = (low + high) / 2;
    // 探索の結果が折れ線上の位置より遠くなる場合（探索範囲が単峰でないとき）は折れ線上の位置の割合を使う
    const t = distanceAt(refined) <= distanceAt(t0) ? refined : t0;
    return { t, point: cubicBezierPoint(a, control1, control2, b, t), distance: best.distance };
}

/**
 * 輪郭の元の区間の上で、`point`に最も近い位置を求める。
 * 区間`i`（`points[i]`→`points[(i+1) % n]`。閉じたパスの最後の区間を含む）ごとに、直線の区間は線分への射影、曲線の区間（打った点の曲線・曲がり方を持つ区間）は
 * `Path.hitTest`と同じ折れ線の近似で最も近い小区間を求め、その近くで真の曲線の上の位置を探す（`point`は曲線の上にちょうど乗る）。
 * 区間の間では`distance`が最も小さいもの（同じなら番号の小さい区間）。最小の`distance`が`tolerance`より大きければ`null`（ちょうどは当たり）。
 * 点が1つ以下・区間が無ければ`null`。引数を書き換えない。
 * @param {OutlineSource} source - 輪郭の元（`outlineSourceOf`の結果。パスの`toJSON()`の値でもよい）
 * @param {{x: number, y: number}} point - 検索する点（ワールド座標）
 * @param {number} tolerance - 許容幅（ワールド座標の長さ）
 * @returns {SegmentLocation|null} 最も近い区間の上の位置。許容幅の外・対象なしは`null`
 */
export function findNearestSegmentLocation(source, point, tolerance) {
    const points = source.points;
    const n = points.length;
    if (n <= 1) {
        return null;
    }
    const controls = resolveSegmentControls(source);
    let best = null;
    for (let i = 0; i < controls.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const control = controls[i];
        const hit = control === null
            ? projectOntoLine(a, b, point)
            : projectOntoCurve(a, control.control1, control.control2, b, point);
        if (best === null || hit.distance < best.distance) {
            best = { segmentIndex: i, t: hit.t, point: hit.point, distance: hit.distance };
        }
    }
    if (best === null || best.distance > tolerance) {
        return null;
    }
    return best;
}

/**
 * 3次ベジェをde Casteljauの方法で`t`の位置で2つに分ける。元と同じ曲線をたどる。引数を書き換えず、結果は新しい座標。
 * @param {{x: number, y: number}} p0 - 始点
 * @param {{x: number, y: number}} p1 - 引っ張る点1
 * @param {{x: number, y: number}} p2 - 引っ張る点2
 * @param {{x: number, y: number}} p3 - 終点
 * @param {number} t - 分ける位置（0〜1）
 * @returns {CubicSplit} 前半の制御点・分けた点・後半の制御点
 */
export function splitCubicBezier(p0, p1, p2, p3, t) {
    const lerp = (a, b) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    const p01 = lerp(p0, p1);
    const p12 = lerp(p1, p2);
    const p23 = lerp(p2, p3);
    const p012 = lerp(p01, p12);
    const p123 = lerp(p12, p23);
    const p0123 = lerp(p012, p123);
    return {
        first: { control1: p01, control2: p012 },
        point: p0123,
        second: { control1: p123, control2: p23 },
    };
}
