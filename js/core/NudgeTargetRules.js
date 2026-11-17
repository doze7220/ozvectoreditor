/**
 * 責務: 矢印キーの微調整で動かす対象（図形の組／頂点の組）の決定と、続けた微調整をまとめるための鍵の組み立てを、状態を持たない関数として提供する。
 * importは`InputModes`の`OperationMode`のみ。DOM・VectorModel・図形・履歴を知らない。
 */
import { OperationMode } from './InputModes.js';

/**
 * 微調整で動かす対象。
 * - `{ type: 'shapes', shapeIds }`：選んでいる図形（`moveShapes`で動かす）。
 * - `{ type: 'vertices', vertices }`：選んでいる頂点（`updateVertices`で動かす）。ハンドル名は文字列として扱うだけ。
 * @typedef {({type: 'shapes', shapeIds: string[]} | {type: 'vertices', vertices: Array<{shapeId: string, handle: string}>})} NudgeTarget
 */

/**
 * 操作モードと選択から、微調整で動かす対象を決める。
 * `SELECT`では図形の選択だけを、`VERTEX`では頂点の選択だけを見る。並びは与えられた順のまま。
 * 引数を書き換えず、毎回新しい配列・オブジェクトを返す。
 * @param {string} mode 操作モード（`OperationMode`の値）
 * @param {string[]} selectedIds 選択中の図形id
 * @param {Array<{shapeId: string, handle: string}>} selectedVertices 選択中の頂点
 * @returns {NudgeTarget|null} 動かす対象。対象がなければnull
 */
export function resolveNudgeTarget(mode, selectedIds, selectedVertices) {
    if (mode === OperationMode.SELECT && selectedIds.length > 0) {
        return { type: 'shapes', shapeIds: [...selectedIds] };
    }
    if (mode === OperationMode.VERTEX && selectedVertices.length > 0) {
        return {
            type: 'vertices',
            vertices: selectedVertices.map((v) => ({ shapeId: v.shapeId, handle: v.handle }))
        };
    }
    return null;
}

/**
 * 動かす対象から、続けた微調整を取り消し1件にまとめるための鍵を作る。
 * 同じ対象を続けて動かしたときだけ同じ鍵になり、対象（種類・図形の並び・頂点の並び）が変わると別の鍵になる。
 * 区切り文字を自前で決めず`JSON.stringify`にしているのは、図形のidの形やハンドル名の文字（`-`等）を知らないまま、文字の衝突を起こさないため。
 * @param {NudgeTarget|null} target 動かす対象
 * @returns {string|null} まとめの鍵。対象がnullならnull
 */
export function buildNudgeGroupKey(target) {
    if (target === null) return null;
    return JSON.stringify(target);
}
