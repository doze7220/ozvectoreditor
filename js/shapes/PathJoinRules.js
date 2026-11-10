/**
 * 責務: 線（直線・開いたパス）の結合の規則（受理条件・閉じる／2本の結合／端点を指定した結合・描き足し・吸い付いた端点での操作の計画）を、
 * 状態を持たない関数と定数として提供する。表示倍率・モデル・履歴を知らず、ワールド座標の許容距離を引数で受け取る。
 */
import { Path } from './Path.js';

/**
 * 端点が「重なっている」とみなす距離（画面上のpx）。唯一の定義箇所。
 * ワールド座標への換算は呼び出し側が行い、規則の関数へ`tolerance`として渡す（Phase 05-04も使い回す）。
 * @type {number}
 */
export const JOIN_TOLERANCE_SCREEN_PX = 5;

/**
 * 閉じたパスの頂点数の下限。`classifyJoin`・`buildClosedPath`・`canCloseByMergingEnds`が共有する。
 * @type {number}
 */
const CLOSED_MIN_POINTS = 3;

/**
 * 結合できる線の端点の指定。`EndpointSnapRules`のtypedef`SnapTarget`もこの形を満たす。
 * @typedef {Object} EndpointRef
 * @property {*} shapeId 図形のid（不透明な値として扱う）
 * @property {'start'|'end'} end 'start'＝始点（頂点の先頭）／'end'＝終点（頂点の末尾）
 */

/**
 * 結合の計画。
 * @typedef {Object} JoinPlan
 * @property {Path} path 結合の結果のパス（idは未採番）
 * @property {*} targetId 差し替える位置の図形のid（重なり順で奥の図形）
 * @property {boolean} keepId trueなら`targetId`のidを結果が引き継ぐ。falseなら新しいidを採番する
 * @property {Array<*>} removeIds 取り除く図形のid
 */

/**
 * 結合できる線か（`type`が`'line'`、または`type`が`'path'`で`closed`が真でない）。
 * Phase 05-04が吸い付く対象の判定として使い回す。図形を書き換えない。
 * @param {Object} shape 図形（`type`と`toJSON()`を持つ）
 * @returns {boolean}
 */
export function isJoinableLine(shape) {
    if (shape.type === 'line') return true;
    if (shape.type === 'path') return !shape.toJSON().closed;
    return false;
}

/**
 * 選択中の図形から結合の種類を判定する。ボタンの押せる/押せないの同期からも呼ばれる（表示倍率は見ない）。
 * 負荷回避のため、図形の数 → `type` → `toJSON()` の順に判定し、不要な`toJSON()`を呼ばない。
 * @param {Array<Object>} shapes 選択集合の図形を重なり順（`model.getShapes()`の並び。奥が先）で並べた配列
 * @returns {'close'|'join'|null} 'close'＝頂点3つ以上の開いたパス1本を閉じる／'join'＝結合できる線2本／それ以外はnull
 */
export function classifyJoin(shapes) {
    if (shapes.length === 1) {
        const shape = shapes[0];
        if (shape.type !== 'path') return null;
        const data = shape.toJSON();
        if (!data.closed && data.points.length >= CLOSED_MIN_POINTS) return 'close';
        return null;
    }
    if (shapes.length === 2) {
        const [a, b] = shapes;
        const typeOk = (shape) => shape.type === 'line' || shape.type === 'path';
        if (!typeOk(a) || !typeOk(b)) return null;
        return isJoinableLine(a) && isJoinableLine(b) ? 'join' : null;
    }
    return null;
}

/**
 * 頂点3つ以上の開いたパス1本を、閉じたパスにする。
 * 始点と終点の距離が`tolerance`以下なら最後の頂点を除く。残りが3つ未満ならnull。頂点の並び・向きは変えない。
 * @param {Object} shape 図形
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {Path|null} 閉じたパス（idはnull）。頂点3つ以上の開いたパスでない場合、またはまとめると3つ未満になる場合はnull
 */
export function buildClosedPath(shape, tolerance) {
    if (shape.type !== 'path') return null;
    const data = shape.toJSON();
    if (data.closed || data.points.length < CLOSED_MIN_POINTS) return null;
    const points = data.points.slice();
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) <= tolerance) {
        points.pop();
    }
    if (points.length < CLOSED_MIN_POINTS) return null;
    return new Path(points, true, data.strokeColor, data.strokeWidth);
}

/**
 * 結合できる線2本を、1本の開いたパスにする（つなぐ端点はいちばん近い組から選ぶ。端点を指定する場合は`buildJoinedPathAt`）。
 * 端点の組を次の優先順に調べ、距離が厳密に小さいときだけ更新して最小の組を選ぶ（同距離なら先の組が残る）：
 * (1) Aの終点とBの始点（A＋Bそのまま）、(2) Aの終点とBの終点（A＋Bを逆順）、
 * (3) Aの始点とBの終点（Bそのまま＋A）、(4) Aの始点とBの始点（Bを逆順＋A）。
 * 選んだ組の距離が`tolerance`以下なら、Bの側のつなぐ端点を除く（Aの端点の座標を残す）。
 * 結果は開いたパスで、色と太さはAのもの。
 * @param {Object} a 基準の線A（重なり順で奥）
 * @param {Object} b もう一方の線B
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {Path|null} 開いたパス（idはnull）。a・bのどちらかが結合できる線でなければnull
 */
export function buildJoinedPath(a, b, tolerance) {
    if (!isJoinableLine(a) || !isJoinableLine(b)) return null;
    const dataA = a.toJSON();
    const A = dataA.points;
    const B = b.toJSON().points;
    const aStart = A[0];
    const aEnd = A[A.length - 1];
    const bStart = B[0];
    const bEnd = B[B.length - 1];
    const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
    const bReversed = B.slice().reverse();

    const candidates = [
        { d: dist(aEnd, bStart), seq: B, aFirst: true },
        { d: dist(aEnd, bEnd), seq: bReversed, aFirst: true },
        { d: dist(aStart, bEnd), seq: B, aFirst: false },
        { d: dist(aStart, bStart), seq: bReversed, aFirst: false }
    ];
    let best = candidates[0];
    for (let i = 1; i < candidates.length; i++) {
        if (candidates[i].d < best.d) best = candidates[i];
    }

    return assembleOpenPath(dataA, best.seq, best.aFirst, best.d <= tolerance);
}

/**
 * Aの頂点とBの頂点の列をつないで開いたパスを作る（非公開。`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が共有する）。
 * 頂点の並べ方の規則はここだけに置く。入力の配列は書き換えない。
 * @param {{points: Array<{x: number, y: number}>, strokeColor: *, strokeWidth: *}} dataA 基準の線Aの`toJSON()`（頂点・色・太さの元）
 * @param {Array<{x: number, y: number}>} bSeq 向きを合わせ済みのBの頂点の列
 * @param {boolean} aFirst trueならA＋bSeq、falseならbSeq＋A
 * @param {boolean} merge trueならBのつなぐ端点（Aが先なら`bSeq`の先頭、後なら末尾）を除く（Aの端点の座標を残す）
 * @returns {Path} 開いたパス（idはnull。色と太さはAのもの）
 */
function assembleOpenPath(dataA, bSeq, aFirst, merge) {
    const seq = bSeq.slice();
    if (merge) {
        if (aFirst) seq.shift();
        else seq.pop();
    }
    const points = aFirst ? dataA.points.concat(seq) : seq.concat(dataA.points);
    return new Path(points, false, dataA.strokeColor, dataA.strokeWidth);
}

/**
 * 結合できる線2本を、つなぐ端点を指定して1本の開いたパスにする（いちばん近い組は選ばない）。
 * 並べ方は`buildJoinedPath`と同じ：`aEnd`が'end'ならA＋Bの側の並び、'start'ならBの側の並び＋A。
 * Bは`aEnd`と`bEnd`が同じとき逆順になる。2つの端点の距離が`tolerance`以下ならBの側の端点を除く（Aの端点の座標を残す）。
 * 結果は常に開いたパス（両端が重なっても閉じない）で、色と太さはAのもの。
 * @param {Object} a 基準の線A（向き・色・太さの元。重なり順で奥）
 * @param {'start'|'end'} aEnd Aのつなぐ端点（'start'＝始点／'end'＝終点）
 * @param {Object} b もう一方の線B
 * @param {'start'|'end'} bEnd Bのつなぐ端点
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {Path|null} 開いたパス（idはnull）。a・bのどちらかが結合できる線でなければnull
 */
export function buildJoinedPathAt(a, aEnd, b, bEnd, tolerance) {
    if (!isJoinableLine(a) || !isJoinableLine(b)) return null;
    const dataA = a.toJSON();
    const A = dataA.points;
    const B = b.toJSON().points;
    const pa = aEnd === 'end' ? A[A.length - 1] : A[0];
    const pb = bEnd === 'end' ? B[B.length - 1] : B[0];
    const bSeq = aEnd === bEnd ? B.slice().reverse() : B;
    return assembleOpenPath(dataA, bSeq, aEnd === 'end', Math.hypot(pa.x - pb.x, pa.y - pb.y) <= tolerance);
}

/**
 * 結合できる線の指定した端点に、頂点を1つ描き足した開いたパスを作る（元の線の向きを保つ）。
 * `end`が'end'なら末尾、'start'なら先頭に`point`を加える。色と太さは元の線のもの。
 * `point`と指定した端点の距離が`tolerance`以下（重なる）なら何も起きない（null）。
 * @param {Object} shape 元の線
 * @param {'start'|'end'} end 描き足す端点
 * @param {{x: number, y: number}} point 足す頂点（ワールド座標）
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {Path|null} 開いたパス（idはnull）。結合できる線でない場合、または`point`が端点と重なる場合はnull
 */
export function buildExtendedPath(shape, end, point, tolerance) {
    if (!isJoinableLine(shape)) return null;
    const dataA = shape.toJSON();
    const A = dataA.points;
    const p = end === 'end' ? A[A.length - 1] : A[0];
    if (Math.hypot(point.x - p.x, point.y - p.y) <= tolerance) return null;
    return assembleOpenPath(dataA, [{ x: point.x, y: point.y }], end === 'end', false);
}

/**
 * 開いたパスの両端を1つにまとめて閉じても、頂点が3つ以上残るか（頂点4つ以上の開いたパスか）。
 * 端点のハンドルのドラッグで「吸い付く＝閉じられる」を判定するために使う。図形を書き換えない。
 * @param {Object} shape 図形
 * @returns {boolean} `type`が'path'・`closed`が偽・頂点数`- 1`が閉じたパスの下限以上なら真
 */
export function canCloseByMergingEnds(shape) {
    if (shape.type !== 'path') return false;
    const data = shape.toJSON();
    return !data.closed && data.points.length - 1 >= CLOSED_MIN_POINTS;
}

/**
 * `shapes`からidで図形を探す（非公開）。
 * @param {Array<Object>} shapes 図形の配列
 * @param {*} id 図形のid
 * @returns {number} 添字。無ければ-1
 */
function indexOfShape(shapes, id) {
    return shapes.findIndex((shape) => shape.id === id);
}

/**
 * 別々の2本の線の指定した端点同士を結合する計画を作る（非公開）。
 * 基準の線＝`shapes`で先（奥）の方。基準の位置に新しいidで結果を置き、もう一方を除く。
 * @param {Array<Object>} shapes 重なり順（奥が先）の図形の配列
 * @param {EndpointRef} first 一方の端点
 * @param {EndpointRef} second もう一方の端点（`shapeId`は`first`と異なる）
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {JoinPlan|null} 図形が無い・結合できる線でない・結果が作れない場合はnull
 */
function planJoinAt(shapes, first, second, tolerance) {
    const i = indexOfShape(shapes, first.shapeId);
    const j = indexOfShape(shapes, second.shapeId);
    if (i < 0 || j < 0 || i === j) return null;
    const [base, other] = i < j ? [first, second] : [second, first];
    const baseShape = shapes[Math.min(i, j)];
    const otherShape = shapes[Math.max(i, j)];
    const path = buildJoinedPathAt(baseShape, base.end, otherShape, other.end, tolerance);
    if (path === null) return null;
    return { path, targetId: baseShape.id, keepId: false, removeIds: [otherShape.id] };
}

/**
 * 同じ線を閉じる計画を作る（非公開）。元のidと位置を保つ。
 * @param {Array<Object>} shapes 重なり順の図形の配列
 * @param {*} shapeId 閉じる線のid
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {JoinPlan|null} 図形が無い・閉じられない場合はnull
 */
function planCloseOf(shapes, shapeId, tolerance) {
    const i = indexOfShape(shapes, shapeId);
    if (i < 0 || !isJoinableLine(shapes[i])) return null;
    const path = buildClosedPath(shapes[i], tolerance);
    if (path === null) return null;
    return { path, targetId: shapes[i].id, keepId: true, removeIds: [] };
}

/**
 * 直線を描いた結果の計画を作る（吸い付いた端点での描き足し・閉じる・結合）。
 * 描き足しは元のid・重なり順の位置を保つ計画になる（`keepId: true`）。両方nullなら計画はnullで、呼び出し側が従来の確定を行う。
 * 始点側のみ吸い付き→描き終えの点を描き足す／終点側のみ→描き始めの点を描き足す／同じ線の別の端点→閉じる／
 * 同じ端点→何も起きない（null）／別の線の端点→結合（基準＝`shapes`で奥の方）。足す頂点が端点と重なる場合も何も起きない。
 * @param {Array<Object>} shapes 重なり順（奥が先）の図形の配列
 * @param {Object} drawn 作成途中の直線（`toJSON().points`の先頭＝描き始めの点、末尾＝描き終えの点）
 * @param {EndpointRef|null} startSnap 描き始めの点が吸い付いた端点。吸い付いていなければnull
 * @param {EndpointRef|null} endSnap 描き終えの点が吸い付いた端点。吸い付いていなければnull
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {JoinPlan|null} 両方nullの場合、図形が無い・結合できる線でない場合、何も起きない場合はnull
 */
export function planDrawnLineJoin(shapes, drawn, startSnap, endSnap, tolerance) {
    if (startSnap === null && endSnap === null) return null;
    if (startSnap !== null && endSnap !== null) {
        if (startSnap.shapeId === endSnap.shapeId) {
            if (startSnap.end === endSnap.end) return null;
            return planCloseOf(shapes, startSnap.shapeId, tolerance);
        }
        return planJoinAt(shapes, startSnap, endSnap, tolerance);
    }
    const snap = startSnap !== null ? startSnap : endSnap;
    const i = indexOfShape(shapes, snap.shapeId);
    if (i < 0) return null;
    const drawnPoints = drawn.toJSON().points;
    const point = startSnap !== null ? drawnPoints[drawnPoints.length - 1] : drawnPoints[0];
    const path = buildExtendedPath(shapes[i], snap.end, point, tolerance);
    if (path === null) return null;
    return { path, targetId: shapes[i].id, keepId: true, removeIds: [] };
}

/**
 * 端点のハンドルをドラッグして別の端点に吸い付いたまま離したときの計画を作る。
 * ドラッグした頂点はもう一方の端点（`snap`）の座標に置かれている前提で、
 * 同じ線の別の端点なら`buildClosedPath`が距離0でまとめて閉じる（元のidと位置を保つ）。
 * 別の線なら基準＝`shapes`で奥の方として結合する（新しいid）。同じ端点・`snap`なしは何も起きない。
 * @param {Array<Object>} shapes 重なり順（奥が先）の図形の配列
 * @param {EndpointRef} dragged ドラッグしていた端点
 * @param {EndpointRef|null} snap 吸い付いた端点。無ければnull
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {JoinPlan|null} 図形が無い・結合できる線でない・結果が作れない場合、何も起きない場合はnull
 */
export function planEndpointDragJoin(shapes, dragged, snap, tolerance) {
    if (snap === null || snap === undefined) return null;
    if (snap.shapeId === dragged.shapeId) {
        if (snap.end === dragged.end) return null;
        return planCloseOf(shapes, dragged.shapeId, tolerance);
    }
    return planJoinAt(shapes, dragged, snap, tolerance);
}

/**
 * 選択中の図形から結合の計画を作る。
 * 'close'は`shapes[0]`を閉じて同じidを保つ。'join'は`shapes[0]`（奥＝A）の位置に新しいidで結果を置き、`shapes[1]`を除く。
 * idは不透明な値として読み写すだけで、形式を解釈しない。
 * @param {Array<Object>} shapes 選択集合の図形を重なり順（奥が先）で並べた配列
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @returns {JoinPlan|null} 結合できない、または結果が作れない場合はnull
 */
export function planJoin(shapes, tolerance) {
    const kind = classifyJoin(shapes);
    if (kind === 'close') {
        const path = buildClosedPath(shapes[0], tolerance);
        if (path === null) return null;
        return { path, targetId: shapes[0].id, keepId: true, removeIds: [] };
    }
    if (kind === 'join') {
        const path = buildJoinedPath(shapes[0], shapes[1], tolerance);
        if (path === null) return null;
        return { path, targetId: shapes[0].id, keepId: false, removeIds: [shapes[1].id] };
    }
    return null;
}
