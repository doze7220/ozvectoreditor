/**
 * 責務: 線・パスの輪郭の元への読み替え（選んだ点の番号と、両端の点が選ばれている区間の読み方を含む。`PathSegmentKindRules`・`PathSplitRules`・`VertexSnapRules`へ渡す共有の箇所）と、頂点の追加・削除の規則
 * （区間の上の最も近い位置・曲がり方を持つ区間の分割・点を足した／消した新しい図形の組み立て）を、状態を持たない関数として提供する。モデル・履歴・選択・操作モード・表示倍率を知らず、ワールド座標の許容幅を引数で受け取る。
 */
import {
    Path,
    SEGMENT_KIND_LINE,
    SEGMENT_KIND_SMOOTH,
    SEGMENT_KIND_BEZIER,
    SMOOTH_SEGMENT_SAMPLE_COUNT,
    readCornerFlags,
    resolveSegmentControls,
} from './Path.js';
import { Line } from './Line.js';
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
 * 点を足した結果の計画。
 * @typedef {Object} VertexInsertionPlan
 * @property {Path} shape - 点を足した新しいパス（`id`は`null`）
 * @property {number} insertedIndex - 足した点の番号（区間`i`に足したなら`i + 1`。閉じたパスの最後の区間に足したときは末尾）
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
 * 選んだ点の番号（図形の`getVertexIndexForHandle`の番号＝`toJSON()`の`points`の番号）を、輪郭の元（`outlineSourceOf`）の点の番号へ読み替える。「輪郭の番号」への読み替えの唯一の箇所
 * （使う側＝`selectedSegmentIndexesOf`・`PathSplitRules`）。直線・矩形・パスは0以上・`points.length`未満の整数ならそのまま、
 * 今の曲線は始点0→0・終点2→1（制御点1は線の上に無いので`null`）、円・弧ほか・範囲外・整数でない値は`null`。
 * @param {Object} data - 図形の`toJSON()`の値
 * @param {number} vertexIndex - 選んだ点の番号
 * @returns {number|null} 輪郭の元の点の番号。無いときは`null`
 */
export function outlineVertexIndexOf(data, vertexIndex) {
    if (!Number.isInteger(vertexIndex)) {
        return null;
    }
    switch (data.type) {
        case 'line':
        case 'rect':
        case 'path':
            return vertexIndex >= 0 && vertexIndex < data.points.length ? vertexIndex : null;
        case 'curve':
            if (vertexIndex === 0) return 0;
            if (vertexIndex === 2) return 1;
            return null;
        default:
            return null;
    }
}

/**
 * 選んだ点のうち両端の点がどちらも選ばれている区間の番号を求める。「選んでいる区間」の判定の唯一の箇所（使う側＝`PathSegmentKindRules`・`PathSplitRules`）。
 * 輪郭の元（`outlineSourceOf`）の区間`i`（`points[i]`→`points[(i + 1) % n]`。閉じた形の最後の区間を含み、開いた線は折り返さない）のうち、
 * `i`と`(i + 1) % n`がどちらも（`outlineVertexIndexOf`で読み替えた番号として）選ばれているもの。輪郭の元が無い図形（円・弧ほか）は空。同じ点の重複は1つ。引数を書き換えない。
 * @param {Object} data - 図形の`toJSON()`の値
 * @param {Iterable<number>} vertexIndexes - 選んだ点の番号
 * @returns {number[]} 選んでいる区間の番号（昇順）
 */
export function selectedSegmentIndexesOf(data, vertexIndexes) {
    const source = outlineSourceOf(data);
    if (source === null) {
        return [];
    }
    const selected = new Set();
    for (const vertexIndex of vertexIndexes) {
        const outlineIndex = outlineVertexIndexOf(data, vertexIndex);
        if (outlineIndex !== null) {
            selected.add(outlineIndex);
        }
    }
    const n = source.points.length;
    const result = [];
    for (let i = 0; i < source.segments.length; i++) {
        if (selected.has(i) && selected.has((i + 1) % n)) {
            result.push(i);
        }
    }
    return result;
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

/**
 * 線・パスの区間の上に点を足した新しいパスを組み立てる。
 * 足す位置は`point`に最も近い区間の上の位置。`t`が0か1（頂点と同じ位置）・許容幅の外・円・弧などの対象外の図形は`null`。
 * 足した点の角は`false`、ほかの点の角・ほかの区間・スタイル3つは元のまま。直線の区間は`line`×2、曲がり方を持つ区間（`bezier`）はde Casteljauで分けた`bezier`×2（形は同じ）、
 * 打った点の曲線の区間（`smooth`）は`smooth`×2（足した点は元の曲線の上に乗る。足した区間と隣の曲線の区間の曲がり方は少し変わる）。
 * 直線・矩形・今の曲線はパス（点が1つ増えた開いたパス・閉じたパス）になる。`shape`の`type`・`toJSON()`だけを読み、引数を書き換えない。
 * @param {Object} shape - 図形（`type`・`toJSON()`を持つ。`type`が対象外なら`toJSON()`を呼ばない）
 * @param {{x: number, y: number}} point - ダブルクリックしたワールド座標
 * @param {number} tolerance - 許容幅（ワールド座標の長さ）
 * @returns {VertexInsertionPlan|null} 点を足した新しいパスと足した点の番号。足さないときは`null`
 */
export function planVertexInsertion(shape, point, tolerance) {
    if (shape.type !== 'line' && shape.type !== 'rect' && shape.type !== 'curve' && shape.type !== 'path') {
        return null;
    }
    const source = outlineSourceOf(shape.toJSON());
    if (source === null) {
        return null;
    }
    const location = findNearestSegmentLocation(source, point, tolerance);
    if (location === null || location.t <= 0 || location.t >= 1) {
        return null;
    }
    const index = location.segmentIndex;
    const n = source.points.length;
    const segment = source.segments[index];
    let newPoint;
    let replacement;
    if (segment.kind === SEGMENT_KIND_LINE) {
        newPoint = { x: location.point.x, y: location.point.y };
        replacement = [{ kind: SEGMENT_KIND_LINE }, { kind: SEGMENT_KIND_LINE }];
    } else if (segment.kind === SEGMENT_KIND_BEZIER) {
        const a = source.points[index];
        const b = source.points[(index + 1) % n];
        const split = splitCubicBezier(a, segment.control1, segment.control2, b, location.t);
        newPoint = split.point;
        replacement = [
            { kind: SEGMENT_KIND_BEZIER, control1: split.first.control1, control2: split.first.control2 },
            { kind: SEGMENT_KIND_BEZIER, control1: split.second.control1, control2: split.second.control2 },
        ];
    } else {
        newPoint = { x: location.point.x, y: location.point.y };
        replacement = [{ kind: segment.kind }, { kind: segment.kind }];
    }
    const insertedIndex = index + 1;
    const points = source.points.slice();
    points.splice(insertedIndex, 0, newPoint);
    const segments = source.segments.slice();
    segments.splice(index, 1, ...replacement);
    const corners = readCornerFlags(source);
    corners.splice(insertedIndex, 0, false);
    const built = new Path(points, source.closed, source.strokeColor, source.strokeWidth, source.fillColor, segments, corners);
    return { shape: built, insertedIndex };
}

/**
 * 消す点の指定（選んだ点）。`PathCornerRules.CornerTarget`と同じ形。
 * @typedef {Object} VertexTarget
 * @property {Object} shape - 図形（`type`・`id`・`toJSON()`を持つ）
 * @property {number} vertexIndex - 頂点の番号（0以上・頂点の数未満の整数）
 */

/**
 * 点を消した結果の計画の1件。
 * @typedef {Object} VertexRemovalPlanItem
 * @property {*} targetId - 元の図形の`id`
 * @property {Path|Line|null} shape - 点を消した新しい図形（`id`は`null`）。`null`は図形ごと消える
 */

/**
 * 消した点にかかる区間の並び`run`を、残る前後の点をつなぐ1つの区間にする。
 * 「つなぐ区間の種類」の規則の唯一の箇所：すべて`line`なら`line`、すべて`bezier`なら最初の`control1`と最後の`control2`の`bezier`、それ以外は`smooth`。
 * 区間が1つなら（消した点にかからない区間）その区間の写し。引数を書き換えず、結果は新しい値。
 * @param {Array<{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}>} run - 区間の並び（1つ以上）
 * @returns {{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}} つないだ区間
 */
function connectRun(run) {
    if (run.length === 1) {
        return copySegmentValue(run[0]);
    }
    if (run.every((segment) => segment.kind === SEGMENT_KIND_LINE)) {
        return { kind: SEGMENT_KIND_LINE };
    }
    if (run.every((segment) => segment.kind === SEGMENT_KIND_BEZIER)) {
        return copySegmentValue({
            kind: SEGMENT_KIND_BEZIER,
            control1: run[0].control1,
            control2: run[run.length - 1].control2,
        });
    }
    return { kind: SEGMENT_KIND_SMOOTH };
}

/**
 * 輪郭の元から、消す点の集合を除いた新しいパスを組み立てる。残りが1点以下なら`null`。
 * 開いたパスは残る点の間を`run`の規則でつなぐ。閉じたパスは残りが3点以上なら閉じたまま（最後の残る点から最初の残る点へ戻る区間も同じ規則）、
 * 残りが2点なら開いた線（`a`→`b`が1区間ならそれ、折り返しが1区間なら`[b, a]`でそれ、どちらでもなければ`a`→`b`の`run`をつなぐ）。
 * @param {OutlineSource} source - 輪郭の元
 * @param {Set<number>} removed - 消す点の番号の集合
 * @returns {Path|null} 新しいパス。図形ごと消えるときは`null`
 */
function buildRemovedPath(source, removed) {
    const n = source.points.length;
    const kept = [];
    for (let i = 0; i < n; i++) {
        if (!removed.has(i)) {
            kept.push(i);
        }
    }
    if (kept.length <= 1) {
        return null;
    }
    const flags = readCornerFlags(source);
    const runBetween = (from, to) => {
        const run = [];
        for (let i = from; i !== to; i = (i + 1) % n) {
            run.push(source.segments[i]);
        }
        return run;
    };
    const build = (indices, closed, segments) => new Path(
        indices.map((i) => source.points[i]),
        closed,
        source.strokeColor,
        source.strokeWidth,
        source.fillColor,
        segments,
        indices.map((i) => flags[i]),
    );
    if (!source.closed) {
        const segments = [];
        for (let j = 0; j + 1 < kept.length; j++) {
            segments.push(connectRun(source.segments.slice(kept[j], kept[j + 1])));
        }
        return build(kept, false, segments);
    }
    if (kept.length >= 3) {
        const segments = kept.map((from, j) => connectRun(runBetween(from, kept[(j + 1) % kept.length])));
        return build(kept, true, segments);
    }
    const [a, b] = kept;
    if (b === a + 1) {
        return build([a, b], false, [connectRun([source.segments[a]])]);
    }
    if (a === 0 && b === n - 1) {
        return build([b, a], false, [connectRun([source.segments[n - 1]])]);
    }
    return build([a, b], false, [connectRun(runBetween(a, b))]);
}

/**
 * 今の曲線（始点・制御点・終点）から1点を消した結果を作る。残った2点を結ぶ直線（残った順）。残りが1点以下なら`null`。
 * @param {Object} data - 曲線の`toJSON()`の値（`points`は3点）
 * @param {Set<number>} removed - 消す点の番号の集合
 * @returns {Line|null} 残った2点を結ぶ直線。図形ごと消えるときは`null`
 */
function buildRemovedCurve(data, removed) {
    const kept = data.points.filter((_, i) => !removed.has(i));
    if (kept.length !== 2) {
        return null;
    }
    return new Line(kept[0].x, kept[0].y, kept[1].x, kept[1].y, data.strokeColor, data.strokeWidth, data.fillColor);
}

/**
 * 選んだ点を消した新しい図形の組み立てを、図形ごとに計画する。
 * 図形は`targets`に最初に現れた順。消す点は0以上・頂点の数未満の整数だけ（重複は1つ）。消す点が1つ以上ある図形だけを結果に入れる。
 * `type`が`curve`なら残った2点を結ぶ直線（2点以上消すと図形ごと消える）、`line`・`rect`・`path`は輪郭の元に「消したらどうなるか」の規則を当てる
 * （つなぐ区間の種類・閉じたパスが2点になったときの扱い・残りが1点以下で図形ごと消える）。それ以外の図形は飛ばす。
 * 引数を書き換えず、結果は引数と配列・点を共有しない。新しい図形の`id`は`null`。
 * @param {VertexTarget[]} targets - 選んだ点
 * @returns {VertexRemovalPlanItem[]} 図形ごとの結果（`shape`が`null`のものは図形ごと消える）
 */
export function planVertexRemoval(targets) {
    const groups = new Map();
    for (const target of targets) {
        if (!groups.has(target.shape)) {
            groups.set(target.shape, []);
        }
        groups.get(target.shape).push(target.vertexIndex);
    }
    const plan = [];
    for (const [shape, indices] of groups) {
        const type = shape.type;
        if (type !== 'line' && type !== 'rect' && type !== 'curve' && type !== 'path') {
            continue;
        }
        const data = shape.toJSON();
        const count = data.points.length;
        const removed = new Set(indices.filter((i) => Number.isInteger(i) && i >= 0 && i < count));
        if (removed.size === 0) {
            continue;
        }
        let built;
        if (type === 'curve') {
            built = buildRemovedCurve(data, removed);
        } else {
            const source = outlineSourceOf(data);
            built = source === null ? null : buildRemovedPath(source, removed);
        }
        plan.push({ targetId: shape.id, shape: built });
    }
    return plan;
}
