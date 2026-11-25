/**
 * 責務: フォルダをまとめる・解除する・空のフォルダを足す・選んでいるまとまりを削除する、をそれぞれ1件の編集操作としてモデルへ反映する。
 * DOMに触れない。入れ子の計算は`core/`の規則へ委ね、記録の`beginEdit`／`commitEdit`を自分で挟む。
 */
import { ITEM_KIND } from '../core/ItemTreeRules.js';
import { wrapUnits, unwrapGroups } from '../core/GroupTreeRules.js';
import { resolveRemoval } from '../core/RemovalRules.js';
import { insertItemsAt } from '../core/ItemPlaceRules.js';
import { resolveSelectedUnitIds } from '../core/GroupSelectionRules.js';
import { canEditGroups } from '../core/GroupCommandRules.js';

/**
 * フォルダの編集操作（まとめる・解除・空のフォルダ・削除）を行うクラス。
 *
 * 依存の制約:
 *   - importは`core/`の`GroupTreeRules`・`GroupSelectionRules`・`GroupCommandRules`・`ItemTreeRules`・`ItemPlaceRules`・`RemovalRules`のみ（`edit/`内の例外。状態を持たない規則の関数）。
 *   - `model`は`getItems`・`isSelected`・`getSelectedGroupIds`・`getInsertTarget`・`rearrangeItems`だけを使う。
 *   - 操作モードは解釈せず`canEditGroups(getMode())`へ渡す（まとめる・解除のみ）。図形種別・図形固有のプロパティ名を知らない。
 *   - `try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）:
 *   - ドラッグ中でないこと。`removeSelection`・`addEmptyGroup`は操作モード・ドラッグ中を見ない
 *     （受理の判定は`InputTracker.deleteSelection()`・作るボタンの`resolveFolderButtonAction`が行う）。
 */
export class GroupEditor {
    /**
     * アイテムの入れ子と選択を保持するモデル。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はHistoryManager）。
     * @type {import('./ShapeInserter.js').EditRecorder}
     */
    #editRecorder;

    /**
     * 今の操作モードを返す関数。
     * @type {() => string}
     */
    #getMode;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - アイテムの入れ子と選択を保持するモデル
     * @param {import('./ShapeInserter.js').EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     * @param {() => string} deps.getMode - 今の操作モード（OperationMode の値）を返す関数
     */
    constructor({ model, editRecorder, getMode }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        this.#getMode = getMode;
    }

    /**
     * 選んでいるまとまりが1つ以上あるかを返す。
     * @returns {boolean} あれば true
     */
    hasSelectedUnits() {
        return this.#resolveUnitIds().length > 0;
    }

    /**
     * 選んでいるまとまりを新しいフォルダにまとめる（1件の編集操作）。
     * 操作モードが受け付けない・まとまりが無いときは、`beginEdit`も呼ばずに`false`。
     * 新しいフォルダが選ばれた状態になる（図形の選択は今のまま）。
     * @returns {boolean} 変更したか
     */
    groupSelection() {
        if (!canEditGroups(this.#getMode())) {
            return false;
        }
        const unitIds = this.#resolveUnitIds();
        if (unitIds.length === 0) {
            return false;
        }
        const nextItems = wrapUnits(
            this.#model.getItems(),
            new Set(unitIds),
            { kind: ITEM_KIND.GROUP, children: [] }
        );
        return this.#commit(() => this.#model.rearrangeItems(nextItems, {
            selectedGroupIds: [],
            selectsNewGroups: true
        }));
    }

    /**
     * 選んでいるフォルダ（まとまりのフォルダ）を解除して中身を外へ出す（1件の編集操作）。
     * 操作モードが受け付けない・まとまりにフォルダが無いときは、`beginEdit`も呼ばずに`false`。
     * 解除したフォルダの直下のフォルダが選ばれた状態になる（図形の選択は今のまま）。
     * @returns {boolean} 変更したか
     */
    ungroupSelection() {
        if (!canEditGroups(this.#getMode())) {
            return false;
        }
        const unitIds = new Set(this.#resolveUnitIds());
        const items = this.#model.getItems();
        const groups = [];
        const collect = (list) => {
            for (const item of list) {
                if (item.kind !== ITEM_KIND.GROUP) {
                    continue;
                }
                if (unitIds.has(item.id)) {
                    groups.push(item);
                } else {
                    collect(item.children);
                }
            }
        };
        collect(items);
        if (groups.length === 0) {
            return false;
        }
        const childGroupIds = [];
        for (const group of groups) {
            for (const child of group.children) {
                if (child.kind === ITEM_KIND.GROUP) {
                    childGroupIds.push(child.id);
                }
            }
        }
        const nextItems = unwrapGroups(items, new Set(groups.map((group) => group.id)));
        return this.#commit(() => this.#model.rearrangeItems(nextItems, { selectedGroupIds: childGroupIds }));
    }

    /**
     * 空のフォルダを足す（1件の編集操作）。位置は描き込む先の場所（行のすぐ上・フォルダの中の一番上・フォルダの一番下。無ければいちばん外側の末尾）。
     * 操作モードは見ない（呼び出し側が判定の結果で呼ぶ）。
     * @param {Object} [options] - オプション
     * @param {boolean} [options.selects=false] - 真なら選択を空にして新しいフォルダだけを選ぶ。偽なら選択に触れず、新しいフォルダを描き込む先（その中）にする
     * @returns {boolean} 変更したか
     */
    addEmptyGroup({ selects = false } = {}) {
        const nextItems = insertItemsAt(
            this.#model.getItems(),
            this.#model.getInsertTarget(),
            [{ kind: ITEM_KIND.GROUP, children: [] }]
        );
        const options = selects
            ? { selectedIds: [], selectedGroupIds: [], selectsNewGroups: true }
            : { targetsNewGroup: true };
        return this.#commit(() => this.#model.rearrangeItems(nextItems, options));
    }

    /**
     * 選んでいるまとまり（フォルダは中身ごと）を削除する（1件の編集操作。削除の履歴の記録はここだけ）。
     * 消えるのは変えられるもの（隠れても、ロックされてもいないもの）だけで、変えられないものは残る（`resolveRemoval`）。
     * まとまりが無い・何も消えないときは`beginEdit`も呼ばずに`false`（選択も変えない）。1つでも消えると選択は空になる。
     * 操作モード・ドラッグ中かは見ない。
     * @returns {boolean} 変更したか
     */
    removeSelection() {
        const unitIds = this.#resolveUnitIds();
        if (unitIds.length === 0) {
            return false;
        }
        const removal = resolveRemoval(this.#model.getItems(), new Set(unitIds));
        if (removal === null) {
            return false;
        }
        return this.#commit(() => this.#model.rearrangeItems(removal.nextItems, { selectedIds: [], selectedGroupIds: [] }));
    }

    /**
     * 選んでいるまとまりのidを前順で求める。
     * @returns {string[]} まとまりのid
     */
    #resolveUnitIds() {
        return resolveSelectedUnitIds({
            items: this.#model.getItems(),
            isSelected: (id) => this.#model.isSelected(id),
            selectedGroupIds: new Set(this.#model.getSelectedGroupIds())
        });
    }

    /**
     * `beginEdit` → 変更 → `commitEdit`の順に呼び、変更の戻り値を返す。
     * @param {() => boolean} change - モデルを変える関数
     * @returns {boolean} 変更の戻り値
     */
    #commit(change) {
        this.#editRecorder.beginEdit();
        const changed = change();
        this.#editRecorder.commitEdit();
        return changed;
    }
}
