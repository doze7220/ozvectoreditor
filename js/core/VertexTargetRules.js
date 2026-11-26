/**
 * 責務: 頂点の選択から、点を対象にする編集操作へ渡す図形と頂点の番号の組を集める規則を、状態を持たない関数として提供する。
 * importは`NudgeTargetRules`のみ。DOM・VectorModel・履歴・図形種別・ハンドル名の形式を知らない。
 */
import { resolveNudgeTarget } from './NudgeTargetRules.js';

/**
 * 編集操作へ渡す対象（図形と頂点の番号の組）。`shapes/PathVertexRules.VertexTarget`・`shapes/PathCornerRules.CornerTarget`・`shapes/PathSegmentKindRules.SegmentSwitchTarget`と同じ形。
 * `vertexIndex`は図形の`getVertexIndexForHandle`が返す番号（図形データの`points`の番号）。
 * @typedef {Object} VertexTargetPair
 * @property {Object} shape 図形
 * @property {number} vertexIndex 頂点の番号
 */

/**
 * 頂点の選択から、規則へ渡す対象（図形と頂点の番号の組）を集める。
 * `resolveNudgeTarget`が頂点の対象（`'vertices'`）を返すとき（頂点の選択のモードで点が選ばれているとき）だけ、
 * 頂点の選択の順に、`shapes`から`id`で図形を探して`getVertexIndexForHandle(handle)`で番号を得る。
 * 図形が無い組・番号が`null`の組は飛ばす。同じ組が重複していれば重複したまま並べる。それ以外は空配列。
 * 図形は共通プロパティ`id`と共通メソッド`getVertexIndexForHandle`だけを使う。引数を書き換えない。
 * @param {string} mode 操作モード（`OperationMode`の値。解釈は`resolveNudgeTarget`に任せる）
 * @param {string[]} selectedIds 選択中の図形id
 * @param {Array<{shapeId: string, handle: string}>} selectedVertices 選択中の頂点
 * @param {Object[]} shapes 図形一式
 * @returns {VertexTargetPair[]} 対象
 */
export function collectVertexTargets(mode, selectedIds, selectedVertices, shapes) {
    const target = resolveNudgeTarget(mode, selectedIds, selectedVertices);
    if (target === null || target.type !== 'vertices') return [];
    const targets = [];
    for (const { shapeId, handle } of target.vertices) {
        const shape = shapes.find((s) => s.id === shapeId);
        if (!shape) continue;
        const vertexIndex = shape.getVertexIndexForHandle(handle);
        if (vertexIndex === null) continue;
        targets.push({ shape, vertexIndex });
    }
    return targets;
}
