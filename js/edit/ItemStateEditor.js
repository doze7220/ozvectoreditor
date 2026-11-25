/**
 * 責務: アイテムの表示・ロックを切り替える1件の編集操作（目・鍵・その行だけの表示）の手順と、その行だけの表示にする前の表示の一時的な記憶を担う。
 * 判定・計算は`core/`の規則に従う。DOMに触れない。
 */
import { resolveVisibleToggle, resolveLockToggle } from '../core/ItemStateRules.js';
import { resolveSoloToggle } from '../core/SoloVisibilityRules.js';

/**
 * 表示・ロックの切り替え操作（目・鍵・Alt＋目）を行うクラス。
 *
 * 依存の制約:
 *   - importは`core/`の`ItemStateRules`・`SoloVisibilityRules`のみ（`edit/`内の例外。状態を持たない規則の関数）。
 *   - `model`は`getItems`・`setItemStates`だけを使う。操作モード・選択・ドラッグ中は見ない（受理の判定は呼び出し側が行う）。
 *   - `try/catch`を持たない。
 *
 * 記憶（その行だけの表示にする前の表示）は保存せず、履歴の対象にもしない。取り消し・やり直しでは変わらない
 * （次のAlt＋クリックで、今の表示に当たる控えを値から探すため）。忘れるのは`forgetSolo()`だけ。
 */
export class ItemStateEditor {
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
     * その行だけの表示にする前の表示の記憶。無ければ null。
     * @type {import('../core/SoloVisibilityRules.js').SoloMemory|null}
     */
    #soloMemory = null;

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
     * 行の目（表示・非表示）を切り替える（1件の編集操作）。無いidなら`beginEdit`も呼ばずに`false`。
     * @param {string} id - アイテムのid
     * @returns {boolean} 変更したか
     */
    toggleVisible(id) {
        const change = resolveVisibleToggle(this.#model.getItems(), id);
        if (change === null) {
            return false;
        }
        return this.#commit([change]);
    }

    /**
     * 行の鍵（ロック）を切り替える（1件の編集操作）。無いidなら`beginEdit`も呼ばずに`false`。
     * @param {string} id - アイテムのid
     * @returns {boolean} 変更したか
     */
    toggleLocked(id) {
        const change = resolveLockToggle(this.#model.getItems(), id);
        if (change === null) {
            return false;
        }
        return this.#commit([change]);
    }

    /**
     * その行だけの表示（Alt＋目）にする、またはその前の表示へ戻す（1件の編集操作）。
     * 変えるものが無いときは何もせず（記録先にも触れず、記憶も変えず）`false`。
     * @param {string} id - 押した行のid
     * @returns {boolean} 変更したか
     */
    toggleSolo(id) {
        const result = resolveSoloToggle({
            items: this.#model.getItems(),
            id,
            memory: this.#soloMemory
        });
        if (result.changes.length === 0) {
            return false;
        }
        this.#soloMemory = result.memory;
        return this.#commit(result.changes);
    }

    /**
     * その行だけの表示にする前の表示の記憶を忘れる（キャンバスの切り替えで呼ばれる）。
     * @returns {void}
     */
    forgetSolo() {
        this.#soloMemory = null;
    }

    /**
     * 値の変更を1件の編集操作として反映する。
     * @param {Array<{id: string, visible?: boolean, locked?: boolean}>} changes - 変更
     * @returns {boolean} 変更したか
     */
    #commit(changes) {
        this.#editRecorder.beginEdit();
        const changed = this.#model.setItemStates(changes);
        this.#editRecorder.commitEdit();
        return changed;
    }
}
