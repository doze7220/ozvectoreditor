/**
 * 責務: 端点への吸い付きの規則（吸い付く対象の端点・候補の選び方・吸い付く距離・描く図形種別と端点のハンドルの判定）を、
 * 状態を持たない関数と定数として提供する。表示倍率・モデルを知らず、ワールド座標の許容距離を引数で受け取る。
 */
import { isJoinableLine, canCloseByMergingEnds } from './PathJoinRules.js';

/**
 * 端点へ吸い付く距離（画面上のpx）。唯一の定義箇所。
 * `PathJoinRules.JOIN_TOLERANCE_SCREEN_PX`（端点が重なっているとみなす距離）とは別の定数で、どちらを変えても他方は変わらない。
 * ワールド座標への換算は呼び出し側（`EndpointSnapper`）が行い、`findSnapTarget`へ`tolerance`として渡す。
 * @type {number}
 */
export const SNAP_TOLERANCE_SCREEN_PX = 8;

/**
 * 吸い付いた端点。`PathJoinRules`のtypedef`EndpointRef`（`{ shapeId, end }`）を満たす。
 * @typedef {Object} SnapTarget
 * @property {*} shapeId 吸い付いた端点を持つ図形のid（不透明な値として読み写す）
 * @property {'start'|'end'} end 'start'＝始点（頂点の先頭）／'end'＝終点（頂点の末尾）
 * @property {number} x 端点のワールド座標x
 * @property {number} y 端点のワールド座標y
 */

/**
 * 描く図形種別が吸い付く種別か。「直線を描くときだけ吸い付く」の規則の唯一の定義箇所。
 * @param {*} shapeType 描く図形種別
 * @returns {boolean} `'line'`のときだけ真
 */
export function isSnapDrawShapeType(shapeType) {
    return shapeType === 'line';
}

/**
 * ハンドルが結合できる線の端点のハンドルか。
 * 「頂点の番号`i`＝図形データの`points[i]`」に依る：`getVertexIndexForHandle`の番号が0なら始点、`points.length - 1`なら終点。
 * 途中の頂点・番号のないハンドル（直線の`'move'`など）・結合できない線（曲線・矩形・円・弧・閉じたパス）はnull。図形を書き換えない。
 * @param {Object} shape 図形（`type`・`toJSON()`・`getVertexIndexForHandle`を持つ）
 * @param {*} handleName ハンドル名
 * @returns {'start'|'end'|null} 端点のハンドルなら'start'/'end'、それ以外はnull
 */
export function resolveEndpointHandle(shape, handleName) {
    if (!isJoinableLine(shape)) return null;
    const index = shape.getVertexIndexForHandle(handleName);
    if (index === null) return null;
    if (index === 0) return 'start';
    if (index === shape.toJSON().points.length - 1) return 'end';
    return null;
}

/**
 * 吸い付く端点を1つ選ぶ。
 * 対象は`shapes`のうち結合できる線（直線・開いたパス）の始点・終点だけ。距離は`Math.hypot`が`tolerance`以下（ちょうどを含む）。
 * 図形を`shapes`の末尾（前面）から先頭へ、各図形は始点→終点の順に調べ、距離が厳密に小さいときだけ更新する
 * （いちばん近い端点／同距離なら前面の図形／同じ図形の始点と終点が同距離なら始点）。
 * `dragged`を渡したとき、`dragged.shapeId`の図形では`dragged.end`の端点を対象にせず、もう一方の端点は
 * `canCloseByMergingEnds`が真（頂点4つ以上の開いたパス）のときだけ対象にする。他の図形は通常どおり。
 * 引数を書き換えない。
 * @param {Array<Object>} shapes 図形の配列（`model.getShapes()`の並び。奥が先）
 * @param {{x: number, y: number}} point 照会する点（ワールド座標）
 * @param {number} tolerance ワールド座標の許容距離（長さ。表示倍率の換算は呼び出し側）
 * @param {{shapeId: *, end: 'start'|'end'}|null} [dragged=null] ドラッグしている端点（ハンドルのドラッグのときだけ渡す）
 * @returns {SnapTarget|null} 吸い付く端点。無ければnull
 */
export function findSnapTarget(shapes, point, tolerance, dragged = null) {
    let best = null;
    let bestDist = Infinity;
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!isJoinableLine(shape)) continue;
        const points = shape.toJSON().points;
        const isDragged = dragged !== null && shape.id === dragged.shapeId;
        const canCloseSelf = isDragged && canCloseByMergingEnds(shape);
        const ends = [
            { end: 'start', p: points[0] },
            { end: 'end', p: points[points.length - 1] }
        ];
        for (const { end, p } of ends) {
            if (isDragged && (end === dragged.end || !canCloseSelf)) continue;
            const d = Math.hypot(p.x - point.x, p.y - point.y);
            if (d <= tolerance && d < bestDist) {
                best = { shapeId: shape.id, end, x: p.x, y: p.y };
                bestDist = d;
            }
        }
    }
    return best;
}
