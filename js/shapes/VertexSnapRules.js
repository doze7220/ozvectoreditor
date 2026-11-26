/**
 * 責務: 吸い付くだけ（ほかの図形の頂点への吸い付き。結合しない）の規則（図形から吸い付く先の頂点を読むこと・いちばん近い頂点・描くツールごとに働く点・結合する吸い付きとの選び方）を、
 * 状態を持たない関数と定数として提供する。表示倍率・モデル・操作モードを知らない。
 */
import { findNearestSnapPoint, snapDistance } from './EndpointSnapRules.js';
import { lineEndpointOf } from './PathJoinRules.js';
import { outlineSourceOf } from './PathVertexRules.js';

/**
 * 吸い付くだけの結果の種類の値。唯一の定義箇所。
 * @type {string}
 */
export const VERTEX_SNAP_KIND = 'vertex';

/**
 * 吸い付くだけの結果（ほかの図形の頂点への吸い付き。離しても・クリックしても結合しない）。
 * `shapeId`・`end`を持たないため`PathJoinRules`のtypedef`EndpointRef`を満たさない。
 * `planDrawnLineJoin`・`planEndpointDragJoin`・`EndpointSnapper`の結合の反映（`commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`joinDraggedEndpoint`）へ
 * 結合として渡してはならない（呼び出し側の`EndpointSnapper`が`isVertexSnap`で先に外す）。
 * `SnapTarget`・`DrawnStartSnap`とは`kind`の有無と値で区別する（`SnapTarget`には`kind`を足さない）。
 * @typedef {Object} VertexSnap
 * @property {'vertex'} kind 結果の種類（`VERTEX_SNAP_KIND`）
 * @property {number} x 吸い付いた頂点のワールド座標x
 * @property {number} y 吸い付いた頂点のワールド座標y
 */

/**
 * 結果が吸い付くだけ（`VertexSnap`）か。判定の唯一の箇所。
 * @param {*} snap 吸い付きの結果（`SnapTarget`・`DrawnStartSnap`・`VertexSnap`・null・undefined）
 * @returns {boolean} `null`・`undefined`でなく`snap.kind === VERTEX_SNAP_KIND`なら真（`SnapTarget`・`DrawnStartSnap`は偽）
 */
export function isVertexSnap(snap) {
    return snap !== null && snap !== undefined && snap.kind === VERTEX_SNAP_KIND;
}

/**
 * 吸い付く先の頂点を図形から読む唯一の箇所（図形の種類ごとの分岐はここだけ）。`shape.toJSON()`を1回読む。
 * 直線＝両端、矩形＝4つの角、今の曲線＝始点・終点（制御点は入らない）、パス＝`points`のすべて（引っ張る点は`segments`側にあり入らない）、
 * 弧＝`lineEndpointOf`の始点・終点と中心（`points[0]`。頂上・`points[1]`〜`[4]`は入らない）、円＝中心（`points[0]`）、それ以外は空。
 * 使う側は`findVertexSnapTarget`。引数を書き換えず、戻り値は図形の点と共有しない新しい配列・オブジェクト。
 * @param {Object} shape 図形（`toJSON()`を持つ）
 * @returns {Array<{x: number, y: number}>} 吸い付く先の頂点（並びの順）
 */
export function snapVerticesOf(shape) {
    const data = shape.toJSON();
    const outline = outlineSourceOf(data);
    if (outline !== null) return outline.points.map((p) => ({ x: p.x, y: p.y }));
    const center = () => ({ x: data.points[0].x, y: data.points[0].y });
    if (data.type === 'arc') {
        return [lineEndpointOf(data, 'start'), lineEndpointOf(data, 'end'), center()];
    }
    if (data.type === 'circle') return [center()];
    return [];
}

/**
 * 吸い付くだけの先（ほかの図形の頂点）をいちばん近い1つ選ぶ。
 * 走査は`findNearestSnapPoint`（末尾＝前面の図形から、図形の中は`snapVerticesOf`の並びの順。ちょうどの距離を含み、同距離なら先に見た方）。
 * `excludedShapeIds`に含まれるidの図形の点は候補にしない。引数を書き換えない。
 * @param {Array<Object>} shapes 図形の配列（`model.getEditableShapes()`の並び。奥が先）
 * @param {{x: number, y: number}} point 照会する点（ワールド座標。丸めていないカーソル位置）
 * @param {number} tolerance ワールド座標の許容距離（長さ。表示倍率の換算は呼び出し側）
 * @param {Array<*>} [excludedShapeIds=[]] 候補にしない図形のid（動かしている点を持つ図形など）
 * @returns {VertexSnap|null} 吸い付く頂点（新しいオブジェクト）。無ければnull
 */
export function findVertexSnapTarget(shapes, point, tolerance, excludedShapeIds = []) {
    const found = findNearestSnapPoint(shapes, point, tolerance, (shape) =>
        excludedShapeIds.includes(shape.id) ? [] : snapVerticesOf(shape)
    );
    if (found.candidate === null) return null;
    return { kind: VERTEX_SNAP_KIND, x: found.candidate.x, y: found.candidate.y };
}

/**
 * 結合する吸い付きと吸い付くだけの選び方の唯一の箇所。照会した点に近い方を選び、同じ距離なら結合する吸い付きを選ぶ。
 * どちらの距離も照会の段階で許容距離以内のため、ここでは許容距離を見ない。引数をそのまま返す（写さない）。
 * @param {{x: number, y: number}} point 照会した点（ワールド座標）
 * @param {Object|null} joinSnap 結合する吸い付き（`SnapTarget`・`DrawnStartSnap`・null）
 * @param {VertexSnap|null} vertexSnap 吸い付くだけ（無ければnull）
 * @returns {Object|null} 選んだ吸い付き。どちらも無ければnull
 */
export function chooseSnapTarget(point, joinSnap, vertexSnap) {
    if (joinSnap === null || joinSnap === undefined) return vertexSnap === undefined ? null : vertexSnap;
    if (vertexSnap === null || vertexSnap === undefined) return joinSnap;
    return snapDistance(joinSnap, point) <= snapDistance(vertexSnap, point) ? joinSnap : vertexSnap;
}

/**
 * 描き始め（1点目）で吸い付くだけが働く描く図形種別か。
 * @param {*} shapeType 描く図形種別
 * @returns {boolean} `'line'`・`'curve'`・`'rect'`・`'arc'`・`'circle'`で真、それ以外（`'path'`・未知の値）は偽
 */
export function isVertexSnapDrawStartShapeType(shapeType) {
    return shapeType === 'line' || shapeType === 'curve' || shapeType === 'rect' || shapeType === 'arc' || shapeType === 'circle';
}

/**
 * 弧・矩形・円のツールの2つ目の点（`DRAWING`の`mousemove`）で吸い付くだけが働く図形種別か。
 * `'rect'`だけ真。円・弧の2つ目の点は外接する四角の角に当たり、頂点に合わせても円がその頂点を通らないため吸い付かせない（発注者の決定 2026-11-27）。
 * 直線・曲線のツールの2点目以降は作成途中の線の照会で扱うためここでは偽。
 * @param {*} shapeType 描く図形種別
 * @returns {boolean} `'rect'`のときだけ真
 */
export function isVertexSnapDrawEndShapeType(shapeType) {
    return shapeType === 'rect';
}
