/**
 * 責務: 矢印キーの微調整として、選んでいる図形または頂点を指定の移動量だけ動かす1件の編集操作を担う。
 * 動かす対象の決定と続けた微調整をまとめる鍵は`core/NudgeTargetRules`に任せ、DOM・操作モードの解釈・スナップを持たない。
 */
// 依存の向き: `edit/`から`core/`への下向きの依存（`main.js → edit → io → core → shapes`の一方向に沿い、`NudgeTargetRules`は`core/InputModes`しか読まないため循環しない）。
import { resolveNudgeTarget, buildNudgeGroupKey } from '../core/NudgeTargetRules.js';

/**
 * 矢印キーの微調整（選んでいる図形・頂点を決まった量だけ動かす）を1件の編集操作として行うクラス。
 *
 * - 移動量`dx`・`dy`は**ワールド座標のpx**として扱う（表示倍率・スクロールは読まない。倍率が変わっても1pxは1px）。
 * - **スナップ（丸め）・端点への吸い付きを通さない**（発注者の決定。座標が小数の図形は小数のまま動く）。
 * - 動かしたときは、モデルの変更通知が1回、取り消しが1件（続けて同じ対象を動かした分は`HistoryManager`が直前の1件へ畳む）。
 * - 動かす対象がない（何も選んでいない・頂点が0件に絞られた等）ときは、`beginEdit`も`commitEdit`も呼ばず記録先に一切触れない。
 *
 * 依存の制約:
 *   - importは`../core/NudgeTargetRules.js`の2関数のみ。VectorModel・HistoryManagerはimportせず、注入で受け取る。
 *   - `model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`・`moveShapes`・`updateVertices`だけを使う。
 *   - 操作モードの値は解釈せず（`OperationMode`をimportせず、比較も分岐もせず）規則へ渡すだけ。
 *   - DOM・InputTracker・CanvasManager・ビュー変換・スナップの設定を受け取らない。再描画・UI同期を自分で呼ばない。
 *   - 図形種別の分岐・図形固有のプロパティ名を持たない。`try/catch`を持たない。
 */
export class NudgeEditor {
    /**
     * 図形一式と選択を保持するモデル。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の記録先（実体は`HistoryManager`。`beginEdit`・`commitEdit`を持つ）。
     * @type {{ beginEdit: function(): void, commitEdit: function(string=): * }}
     */
    #editRecorder;

    /**
     * 現在の操作モードを返す関数（値は解釈せず規則へ渡すだけ）。
     * @type {function(): string}
     */
    #getMode;

    /**
     * @param {Object} deps 依存
     * @param {import('../core/VectorModel.js').VectorModel} deps.model 図形一式と選択を保持するモデル
     * @param {{ beginEdit: function(): void, commitEdit: function(string=): * }} deps.editRecorder 編集操作の記録先
     * @param {function(): string} deps.getMode 現在の操作モードを返す関数
     */
    constructor({ model, editRecorder, getMode }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        this.#getMode = getMode;
    }

    /**
     * 選んでいる図形（または頂点）を`(dx, dy)`だけ動かす。
     * 動かす対象がない場合（頂点が1件も組み立てられない場合を含む）は記録先に一切触れず`false`を返す。
     * 動かしたときは`beginEdit()` → モデルの変更（通知1回） → `commitEdit(まとめの鍵)`の順に呼ぶ（取り消し1件）。
     * 移動量はワールド座標のpx。スナップ・端点への吸い付きは通さない。
     * @param {number} dx X方向の移動量（ワールド座標のpx）
     * @param {number} dy Y方向の移動量（ワールド座標のpx）
     * @returns {boolean} 動かしたらtrue、動かさなかったらfalse（キーを受理したかの判定に使う）
     */
    nudge(dx, dy) {
        const target = resolveNudgeTarget(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices());
        if (target === null) {
            return false;
        }
        const groupKey = buildNudgeGroupKey(target);

        if (target.type === 'shapes') {
            this.#editRecorder.beginEdit();
            this.#model.moveShapes(target.shapeIds, dx, dy);
            this.#editRecorder.commitEdit(groupKey);
            return true;
        }

        const updates = this.#buildVertexUpdates(target.vertices, dx, dy);
        if (updates.length === 0) {
            return false;
        }
        this.#editRecorder.beginEdit();
        this.#model.updateVertices(updates);
        this.#editRecorder.commitEdit(groupKey);
        return true;
    }

    /**
     * 頂点の組から、`updateVertices`へ渡す更新（今の位置＋移動量の絶対座標）を組み立てる。
     * 図形が見つからない組・頂点インデックスまたは位置が求まらない組は飛ばす。
     * @param {Array<{shapeId: string, handle: string}>} vertices 動かす頂点の組
     * @param {number} dx X方向の移動量（ワールド座標のpx）
     * @param {number} dy Y方向の移動量（ワールド座標のpx）
     * @returns {Array<{id: string, vertexIndex: number, x: number, y: number}>} 更新の配列（0件のことがある）
     */
    #buildVertexUpdates(vertices, dx, dy) {
        const shapes = this.#model.getShapes();
        const updates = [];
        for (const { shapeId, handle } of vertices) {
            const shape = shapes.find((s) => s.id === shapeId);
            if (!shape) {
                continue;
            }
            const vertexIndex = shape.getVertexIndexForHandle(handle);
            const position = shape.getHandlePosition(handle);
            if (vertexIndex === null || position === null) {
                continue;
            }
            updates.push({ id: shapeId, vertexIndex, x: position.x + dx, y: position.y + dy });
        }
        return updates;
    }
}
