/**
 * 責務: 頂点のハンドルのドラッグ（頂点のまとめ移動）で、押した頂点（アンカー）の行き先から、動かす頂点すべての座標の組を組み立てる規則を、状態を持たない関数として提供する。
 * importなし。DOM・モデル・図形・吸い付き・スナップを知らない。
 */

/**
 * 頂点のドラッグの開始時に記憶する、動かす頂点1つ分の情報（`InputTracker`の`#vertexDragOrigins`の要素）。
 * @typedef {Object} VertexDragOrigin
 * @property {string} shapeId 図形のid
 * @property {*} handle ハンドル（アンカーの特定に使う。この規則は読まない）
 * @property {number} vertexIndex 頂点インデックス
 * @property {number|null} x 押下時のX座標（ワールド座標。アンカーだけ`null`があり得る）
 * @property {number|null} y 押下時のY座標（ワールド座標。アンカーだけ`null`があり得る）
 */

/**
 * `VectorModel.updateVertices`の引数の要素の形（頂点1つ分の絶対座標への更新）。
 * @typedef {Object} VertexDragUpdate
 * @property {string} id 図形のid
 * @property {number} vertexIndex 頂点インデックス
 * @property {number} x 更新後のX座標（ワールド座標）
 * @property {number} y 更新後のY座標（ワールド座標）
 */

/**
 * 動かす頂点すべての更新の組を`origins`の順に組み立てる（引数を書き換えない）。
 * アンカー自身には`target`の座標をそのまま入れる（足し算を通さない）。
 * `origin + (target - origin)`は浮動小数では`target`と厳密に一致しないことがあり、吸い付いた先の頂点の座標からずれて
 * 隣り合う塗りにすき間ができるため、「アンカーの行き先をそのまま渡す」ことが要点である。
 * ほかの頂点は、アンカーの移動量`(target - anchorOrigin)`を各自の押下時の位置へ足す。`anchorOrigin`が`null`なら移動量は0。
 * @param {VertexDragOrigin[]} origins 動かす頂点の一覧（出力の順もこの順）
 * @param {VertexDragOrigin} anchor 押した頂点（`origins`の要素の1つ。同一性（`===`）で比べる）
 * @param {{x: number, y: number}} target アンカーの行き先（ワールド座標）
 * @param {{x: number, y: number}|null} anchorOrigin 押下時のアンカーの位置。無ければ`null`
 * @returns {VertexDragUpdate[]} 更新の組の新しい配列
 */
export function buildVertexDragUpdates(origins, anchor, target, anchorOrigin) {
    const delta = anchorOrigin
        ? { dx: target.x - anchorOrigin.x, dy: target.y - anchorOrigin.y }
        : { dx: 0, dy: 0 };
    return origins.map((o) => {
        if (o === anchor) {
            return { id: o.shapeId, vertexIndex: o.vertexIndex, x: target.x, y: target.y };
        }
        return { id: o.shapeId, vertexIndex: o.vertexIndex, x: o.x + delta.dx, y: o.y + delta.dy };
    });
}
