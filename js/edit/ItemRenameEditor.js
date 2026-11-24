/**
 * 責務: アイテム（図形・フォルダ）の名前を変える1件の編集操作の手順（`beginEdit` → `renameItem` → `commitEdit`）を担う。
 * 変わるかの判定は`core/ItemAttributeRules.js`の規則に従う。DOMに触れない。
 */
import { applyItemRename } from '../core/ItemAttributeRules.js';

/**
 * 名前を変える1件の編集操作を行うクラス。
 *
 * 依存の制約:
 *   - importは`../core/ItemAttributeRules.js`の規則の関数のみ（`edit/`内の例外）。VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。
 *   - `model`は`getItems`・`renameItem`だけを使う。
 *   - 図形種別の分岐・操作モードの知識を持たない。DOMに触れない。`try/catch`を持たない。
 */
export class ItemRenameEditor {
    /**
     * アイテムの入れ子を保持するモデル（`getItems`・`renameItem`だけを使う）。
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
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - アイテムの入れ子を保持するモデル
     * @param {import('./ShapeInserter.js').EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     */
    constructor({ model, editRecorder }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
    }

    /**
     * アイテムの名前を変える。
     * 名前が変わらない場合（idのアイテムが無い・整えた名前が空・今の名前と同じ）は`beginEdit`も呼ばずに`false`を返す。
     * そうでなければ`beginEdit()` → `model.renameItem(id, text)` → `commitEdit()`（鍵なし）。
     * @param {string} id - 名前を変えるアイテムのid（図形のid、またはフォルダのid）
     * @param {string} text - 新しい名前の候補
     * @returns {boolean} 名前を変えたか
     */
    rename(id, text) {
        if (applyItemRename(this.#model.getItems(), id, text) === null) {
            return false;
        }
        this.#editRecorder.beginEdit();
        const changed = this.#model.renameItem(id, text);
        this.#editRecorder.commitEdit();
        return changed;
    }
}
