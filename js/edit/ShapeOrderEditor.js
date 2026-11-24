/**
 * 責務: 選択中の図形の重なり順の変更（規則`./ShapeOrderRules.js`で求めた並び）と、並び全体の指定
 * （一覧の行のドラッグ）を、モデルへ反映する1件の編集操作を担う。DOMに触れない。
 */
import { canReorderSelected, reorderSelected } from './ShapeOrderRules.js';

/**
 * 選択中の図形の重なり順を変える1件の編集操作と、並び全体を指定する1件の編集操作（`applyOrder`）を行うクラス。
 * `apply`はキー（`main.js`の`performShapeOrder`）の手順、`applyOrder`は一覧の行のドラッグの手順である。
 *
 * 依存の制約:
 *   - importは`./ShapeOrderRules.js`のみ（`edit/`内の例外）。VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。
 *   - `model`は`getShapes`・`isSelected`・`reorderShapes`だけを使う。
 *   - InputTrackerには依存しない。DOMに触れない。
 *   - 図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない（読むのは共通プロパティ`id`のみ）。
 *   - `try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）:
 *   - ドラッグ中でないこと（`apply`は`main.js`の`performShapeOrder()`が判定する。`applyOrder`は一覧の行のドラッグの配線が、
 *     ドラッグの終わりにだけ呼ぶことで守る）。
 *   - `apply`は選択モード以外・キャンバスの読み込み中は選択集合が空のため何もしない（操作モードは知らない）。
 *     `applyOrder`は選択が空でも働く。
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
     * @param {import('./ShapeOrderRules.js').ShapeOrderOperation} operation 操作
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
        return this.#commitOrder(nextIds);
    }

    /**
     * 並び全体を指定して図形の重なり順を変える（一覧の行のドラッグの結果）。選択集合は変えない（選択が空でも働く）。
     *
     * 処理順:
     *   1. 今の図形のidの並びと同じなら、何も呼ばずに`false`（`beginEdit`も呼ばないため履歴は増えない）。
     *   2. `editRecorder.beginEdit()` → `model.reorderShapes(orderedIds)` → `editRecorder.commitEdit()`。
     *   3. `reorderShapes`の戻り値を返す（並びの正本は`model.reorderShapes`。フォルダの位置と入れ子を保つ）。
     *
     * @param {Array<string>} orderedIds 今の全図形のidをちょうど1回ずつ並べた配列（描画順。先頭＝最も奥）
     * @returns {boolean} 並びを変えたか
     */
    applyOrder(orderedIds) {
        const ids = this.#model.getShapes().map((shape) => shape.id);
        if (ids.length === orderedIds.length && ids.every((id, i) => id === orderedIds[i])) {
            return false;
        }
        return this.#commitOrder(orderedIds);
    }

    /**
     * 並びを1件の編集操作としてモデルへ反映する（`apply`と`applyOrder`で共有する）。
     * `editRecorder.beginEdit()` → `model.reorderShapes(orderedIds)` → `editRecorder.commitEdit()`の順に呼ぶ。
     * @param {Array<string>} orderedIds 新しい並び（描画順）
     * @returns {boolean} `reorderShapes`の戻り値（並びを変えたか）
     */
    #commitOrder(orderedIds) {
        this.#editRecorder.beginEdit();
        const changed = this.#model.reorderShapes(orderedIds);
        this.#editRecorder.commitEdit();
        return changed;
    }
}
