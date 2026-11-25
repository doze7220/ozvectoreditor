/**
 * 責務: 選んでいるまとまり（図形・フォルダ）の重なり順の変更（規則`./ShapeOrderRules.js`で求めた、兄弟の並びごとの並び）と、
 * 並び全体の指定（一覧の行のドラッグ）を、モデルへ反映する1件の編集操作を担う。DOMに触れない。
 */
import { canReorderSelected, reorderSelected } from './ShapeOrderRules.js';
import { itemIdOf, listSiblingLists, mapSiblingLists } from '../core/GroupTreeRules.js';
import { resolveSelectedUnitIds } from '../core/GroupSelectionRules.js';

/**
 * 選んでいるまとまりの重なり順を変える1件の編集操作と、並び全体を指定する1件の編集操作（`applyOrder`）を行うクラス。
 * `apply`はキー（`main.js`の`performShapeOrder`）の手順、`applyOrder`は一覧の行のドラッグの手順である。
 *
 * 依存の制約:
 *   - importは`./ShapeOrderRules.js`（`edit/`内）と、`core/GroupTreeRules.js`・`core/GroupSelectionRules.js`（状態を持たない規則の関数。
 *     `edit/ → core/`の例外）のみ。VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。
 *   - `model`は`getShapes`・`getItems`・`isSelected`・`getSelectedGroupIds`・`reorderShapes`・`rearrangeItems`だけを使う。
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
     * 選んでいるまとまり（選んでいるフォルダと、選んでいるフォルダの中に無い選ばれている図形）の重なり順を変える。
     * 動くのは兄弟の並び（いちばん外側と各フォルダの`children`）ごとで、隣のフォルダの中へは入らない。
     * フォルダは並びの1要素として動き、選んでいるフォルダの中の並びには「選択中」が無いため動かない。
     *
     * 処理順:
     *   1. `model.getItems()`から兄弟の並びを作り、選んでいるまとまりのidを求める。
     *   2. どの並びでも`canReorderSelected`が偽なら、何も呼ばずに`false`（`beginEdit`も呼ばないため履歴は増えない）。
     *      未知の操作はここで規則が`Error`をthrowする（`beginEdit`より前のため対が崩れない）。
     *   3. `editRecorder.beginEdit()` → `model.rearrangeItems(各並びを`reorderSelected`で並べ替えた入れ子)` → `editRecorder.commitEdit()`。
     *   4. `rearrangeItems`の戻り値を返す。
     *
     * @param {import('./ShapeOrderRules.js').ShapeOrderOperation} operation 操作
     * @returns {boolean} 並びを変えたか
     * @throws {Error} 未知の操作のとき
     */
    apply(operation) {
        const items = this.#model.getItems();
        const unitIds = new Set(resolveSelectedUnitIds({
            items,
            isSelected: (id) => this.#model.isSelected(id),
            selectedGroupIds: new Set(this.#model.getSelectedGroupIds())
        }));
        const isUnit = (item) => unitIds.has(itemIdOf(item));
        const lists = listSiblingLists(items);
        if (!lists.some((list) => canReorderSelected(list, isUnit, operation))) {
            return false;
        }
        const nextItems = mapSiblingLists(items, (list) => reorderSelected(list, isUnit, operation));
        this.#editRecorder.beginEdit();
        const changed = this.#model.rearrangeItems(nextItems);
        this.#editRecorder.commitEdit();
        return changed;
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
