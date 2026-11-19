/**
 * 責務: 端点への吸い付きの規則（吸い付く対象の端点・候補の選び方・吸い付く距離・描く図形種別と端点のハンドルの判定、
 * 線を引いている途中の吸い付き＝描き始めの端点を除く端点と作成途中の線の始点）を、状態を持たない関数と定数として提供する。表示倍率・モデルを知らない。
 */
import { isJoinableLine, canCloseByMergingEnds, canCloseDrawnLine } from './PathJoinRules.js';

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
 * 始点への吸い付き（作成途中の線の自分の始点へ吸い付くこと）の結果の種類の値。唯一の定義箇所。
 * @type {string}
 */
export const DRAWN_START_SNAP_KIND = 'drawnStart';

/**
 * 始点へ吸い付いた結果。`shapeId`・`end`を持たないため`PathJoinRules`のtypedef`EndpointRef`を満たさない。
 * `planDrawnLineJoin`・`planEndpointDragJoin`へ渡してはならない（呼び出し側が`isDrawnStartSnap`で先に区別する）。
 * `SnapTarget`とは`kind`の有無で区別する（`SnapTarget`には`kind`を足さない）。
 * @typedef {Object} DrawnStartSnap
 * @property {'drawnStart'} kind 結果の種類（`DRAWN_START_SNAP_KIND`）
 * @property {number} x 始点のワールド座標x
 * @property {number} y 始点のワールド座標y
 */

/**
 * 描く図形種別が吸い付く種別か。「直線・曲線のツールで描くときだけ吸い付く」の規則の唯一の定義箇所。
 * `'curve'`は曲線のツールの図形種別（`ShapeFactory`の`curve`。作成途中の図形は曲線のパスで、今の曲線を作るわけではない）。弧・矩形・円は偽。
 * @param {*} shapeType 描く図形種別
 * @returns {boolean} `'line'`・`'curve'`のときだけ真
 */
export function isSnapDrawShapeType(shapeType) {
    return shapeType === 'line' || shapeType === 'curve';
}

/**
 * ハンドルが結合できる線の端点のハンドルか。
 * 「頂点の番号`i`＝図形データの`points[i]`」に依る：`getVertexIndexForHandle`の番号が0なら始点、`points.length - 1`なら終点。
 * 途中の頂点・番号のないハンドル（直線の`'move'`など）・結合できない線（矩形・円・弧・閉じたパス）はnull。結合できる線は直線・開いたパス（曲線のパスを含む）・今の曲線（始点・終点が端点。制御点は端点でないためnull）。図形を書き換えない。
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
 * 対象は`shapes`のうち結合できる線（直線・開いたパス（曲線のパスを含む）・今の曲線）の始点・終点だけ（今の曲線の制御点は対象にならない）。距離は`Math.hypot`が`tolerance`以下（ちょうどを含む）。
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
    return findNearestEndpoint(shapes, point, tolerance, (shape, end) => {
        if (dragged === null || shape.id !== dragged.shapeId) return false;
        return end === dragged.end || !canCloseByMergingEnds(shape);
    }).target;
}

/**
 * 結合できる線の端点のうち、`point`にいちばん近い端点を選ぶ走査。`findSnapTarget`と`findDrawnLineSnapTarget`が共有する（候補の選び方の唯一の箇所）。
 * 図形を`shapes`の末尾（前面）から先頭へ、各図形は始点→終点の順に調べ、距離が`tolerance`以下で、かつ厳密に小さいときだけ更新する。
 * `isExcluded`が真を返す端点は対象にしない。引数を書き換えない。
 * @param {Array<Object>} shapes 図形の配列（奥が先）
 * @param {{x: number, y: number}} point 照会する点（ワールド座標）
 * @param {number} tolerance ワールド座標の許容距離
 * @param {function(Object, 'start'|'end'): boolean} isExcluded 図形と端点を受け取り、対象から除くなら真を返す関数
 * @returns {{target: SnapTarget|null, distance: number}} 選んだ端点とその距離。無ければ`target`はnullで`distance`は`Infinity`
 */
function findNearestEndpoint(shapes, point, tolerance, isExcluded) {
    let best = null;
    let bestDist = Infinity;
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!isJoinableLine(shape)) continue;
        const points = shape.toJSON().points;
        const ends = [
            { end: 'start', p: points[0] },
            { end: 'end', p: points[points.length - 1] }
        ];
        for (const { end, p } of ends) {
            if (isExcluded(shape, end)) continue;
            const d = Math.hypot(p.x - point.x, p.y - point.y);
            if (d <= tolerance && d < bestDist) {
                best = { shapeId: shape.id, end, x: p.x, y: p.y };
                bestDist = d;
            }
        }
    }
    return { target: best, distance: bestDist };
}

/**
 * 結果が始点への吸い付き（`DrawnStartSnap`）か。照会の結果と反映の取り違えを防ぐ判定の唯一の箇所。
 * @param {*} snap 吸い付きの結果（`SnapTarget`・`DrawnStartSnap`・null・undefined）
 * @returns {boolean} `null`・`undefined`でなく`snap.kind === DRAWN_START_SNAP_KIND`なら真
 */
export function isDrawnStartSnap(snap) {
    return snap !== null && snap !== undefined && snap.kind === DRAWN_START_SNAP_KIND;
}

/**
 * 線を引いている途中の吸い付く先を1つ選ぶ。
 * 1. 端点：作成途中の線は続けて引く線の形で常に結合できる線（`isJoinableLine(drawn)`が真）のため、直線・曲線のツールのどちらでも既存の端点を候補にする
 *    （偽なら端点を走査せず結果なし・距離`Infinity`とする分岐はコードに残る）。
 *    `findSnapTarget`と同じ対象・走査順・選び方。ただし`startSnap`が`null`でなければ、その図形のその端点だけを対象にしない
 *    （同じ図形のもう一方の端点は頂点の数によらず対象。`canCloseByMergingEnds`は使わない）。
 * 2. 始点：`startSnap`が`null`で`canCloseDrawnLine(drawn)`（打った点が3つ以上）のときだけ、`drawn`の始点（`toJSON().points[0]`）を候補にする。
 *    距離が`tolerance`以下で、かつ1.の結果が無いか1.の距離より厳密に小さいときだけ選ぶ（同距離なら端点が残る）。
 * 結果の`DrawnStartSnap`は`PathJoinRules`の計画へ渡してはならない（`isDrawnStartSnap`で先に区別する）。引数を書き換えない。
 * @param {Array<Object>} shapes 図形の配列（`model.getShapes()`の並び。奥が先。作成途中の図形は含まない）
 * @param {Object} drawn 作成途中の線
 * @param {{x: number, y: number}} point 照会する点（ワールド座標）
 * @param {number} tolerance ワールド座標の許容距離（長さ）
 * @param {{shapeId: *, end: 'start'|'end'}|null} startSnap 描き始めに吸い付いた端点。無ければnull
 * @returns {SnapTarget|DrawnStartSnap|null} 端点なら`SnapTarget`、始点なら`DrawnStartSnap`、無ければnull
 */
export function findDrawnLineSnapTarget(shapes, drawn, point, tolerance, startSnap) {
    const nearest = isJoinableLine(drawn)
        ? findNearestEndpoint(shapes, point, tolerance, (shape, end) =>
            startSnap !== null && shape.id === startSnap.shapeId && end === startSnap.end
        )
        : { target: null, distance: Infinity };
    if (startSnap === null && canCloseDrawnLine(drawn)) {
        const start = drawn.toJSON().points[0];
        const d = Math.hypot(start.x - point.x, start.y - point.y);
        if (d <= tolerance && (nearest.target === null || d < nearest.distance)) {
            return { kind: DRAWN_START_SNAP_KIND, x: start.x, y: start.y };
        }
    }
    return nearest.target;
}
