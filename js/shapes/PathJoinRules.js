/**
 * 責務: 線（直線・開いたパス）の結合の規則（受理条件・閉じる／2本の結合の頂点の並びと属性・端点の重なりの判定の距離）を、
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
        if (!data.closed && data.points.length >= 3) return 'close';
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
    if (data.closed || data.points.length < 3) return null;
    const points = data.points.slice();
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(last.x - first.x, last.y - first.y) <= tolerance) {
        points.pop();
    }
    if (points.length < 3) return null;
    return new Path(points, true, data.strokeColor, data.strokeWidth);
}

/**
 * 結合できる線2本を、1本の開いたパスにする。Phase 05-04が使い回す入口。
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

    let seq = best.seq.slice();
    if (best.d <= tolerance) {
        if (best.aFirst) seq.shift();
        else seq.pop();
    }
    const points = best.aFirst ? A.concat(seq) : seq.concat(A);
    return new Path(points, false, dataA.strokeColor, dataA.strokeWidth);
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
