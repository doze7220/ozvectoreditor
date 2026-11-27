/**
 * 責務: フォルダの複合パスの切り替え（複合パス⇔普通のフォルダ）を1件の編集操作として行う手順を担う。
 * 判定・計算は`core/`の規則に従う。DOMに触れない。
 */
import { resolveCompoundToggle } from '../core/CompoundPathRules.js';

/**
 * 複合パスの切り替え操作を行うクラス。
 *
 * 依存の制約:
 *   - importは`core/`の`CompoundPathRules`のみ（`edit/`内の例外。状態を持たない規則の関数）。
 *   - `model`は`getItems`・`setGroupCompound`だけを使う。操作モード・選択・ドラッグ中は見ない（受理の判定は呼び出し側が行う）。
 *   - `try/catch`を持たない。
 *
 * `GroupEditor`に置かない理由：`GroupEditor`の責務は入れ子を変える操作で、属性の切り替えは別の責務のため。
 */
export class CompoundPathEditor {
    /**
     * アイテムの入れ子を保持するモデル。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はHistoryManager）。
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
     * フォルダの複合パスの値を反対にする（1件の編集操作）。
     * 無いid・フォルダでないidなら`beginEdit`も呼ばずに`false`。
     * @param {string} groupId - フォルダのid
     * @returns {boolean} 変更したか
     */
    toggle(groupId) {
        const change = resolveCompoundToggle(this.#model.getItems(), groupId);
        if (change === null) {
            return false;
        }
        this.#editRecorder.beginEdit();
        const changed = this.#model.setGroupCompound(change.id, change.compound);
        this.#editRecorder.commitEdit();
        return changed;
    }
}
