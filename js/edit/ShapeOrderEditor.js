/**
 * 責務: 選択中の図形の重なり順の変更を、並べ替えの規則（`./ShapeOrderRules.js`）で求めた並びに従って
 * モデルへ反映する1件の編集操作と、各操作で並びが変わるかの照会を担う。DOMに触れない。
 */
import { ShapeOrderOperation, canReorderSelected, reorderSelected } from './ShapeOrderRules.js';

/**
 * 4つの操作それぞれについて、並びが変わるか（押せるか）。キーは`ShapeOrderOperation`の値。
 * `palette/PropertyOrderSection.js`のtypedef`ShapeOrderAvailability`と同じ内容の二重定義。形を変えるときは両方を揃えること。
 * @typedef {Object} ShapeOrderAvailability
 * @property {boolean} bringToFront 最前面へ
 * @property {boolean} bringForward 前へ
 * @property {boolean} sendBackward 後ろへ
 * @property {boolean} sendToBack 最背面へ
 */

/**
 * 選択中の図形の重なり順を変える1件の編集操作を行うクラス。
 * ボタン・キー（`main.js`の`performShapeOrder`）の共通の手順であり、押せる/押せないの同期（`getAvailability`）にも使う。
 *
 * 依存の制約:
 *   - importは`./ShapeOrderRules.js`のみ（`edit/`内の例外）。VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。
 *   - `model`は`getShapes`・`isSelected`・`reorderShapes`だけを使う。
 *   - InputTrackerには依存しない。DOMに触れない。
 *   - 図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない（読むのは共通プロパティ`id`のみ）。
 *   - `try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）:
 *   - ドラッグ中でないこと（`main.js`の`performShapeOrder()`が判定する）。
 *   - 選択モード以外・キャンバスの読み込み中は選択集合が空のため何もしない（操作モードは知らない）。
 *   本クラスは進行中の入力操作の中断・モード切り替えを行わない
 *   （選択モードで選択集合が空でない状態では作成途中の図形が無い）。
 */
export class ShapeOrderEditor {
    /**
     * 図形一式と選択集合を保持するモデル（`getShapes`・`isSelected`・`reorderShapes`だけを使う）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はmain.jsが注入するHistoryManager）。
     * @type {import('./ShapeInserter.js').EditRecorder}
     */
    #editRecorder;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式と選択集合を保持するモデル
     * @param {import('./ShapeInserter.js').EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     */
    constructor({ model, editRecorder }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
    }

    /**
     * 選択中の図形の重なり順を変える。
     *
     * 処理順:
     *   1. 現在の図形のidの並びと、選択中かの判定を用意する。
     *   2. `canReorderSelected`が偽なら、何も呼ばずに`false`（`beginEdit`も呼ばないため履歴は増えない）。
     *      未知の操作はここで規則が`Error`をthrowする（`beginEdit`より前のため対が崩れない）。
     *   3. `reorderSelected`で新しいidの並びを求める。
     *   4. `editRecorder.beginEdit()` → `model.reorderShapes(新しい並び)` → `editRecorder.commitEdit()`。
     *   5. `reorderShapes`の戻り値を返す。
     *
     * @param {ShapeOrderOperation} operation 操作
     * @returns {boolean} 並びを変えたか
     * @throws {Error} 未知の操作のとき
     */
    apply(operation) {
        const ids = this.#model.getShapes().map((shape) => shape.id);
        const isSelected = (id) => this.#model.isSelected(id);
        if (!canReorderSelected(ids, isSelected, operation)) {
            return false;
        }
        const nextIds = reorderSelected(ids, isSelected, operation);

        this.#editRecorder.beginEdit();
        const changed = this.#model.reorderShapes(nextIds);
        this.#editRecorder.commitEdit();

        return changed;
    }

    /**
     * 4つの操作それぞれで並びが変わるか（ボタンを押せるか）を返す。モデル・履歴を変えない。
     * @returns {ShapeOrderAvailability} 操作ごとの可否（キーは`ShapeOrderOperation`の値）
     */
    getAvailability() {
        const ids = this.#model.getShapes().map((shape) => shape.id);
        const isSelected = (id) => this.#model.isSelected(id);
        const availability = {};
        for (const operation of Object.values(ShapeOrderOperation)) {
            availability[operation] = canReorderSelected(ids, isSelected, operation);
        }
        return availability;
    }
}
