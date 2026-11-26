/**
 * 責務: 頂点の選択で選んだ点・区間を対象に、線・パスの分割と区間の削除を、規則（`shapes/PathSplitRules`）でそれぞれ1件の編集操作として行う手順と、押せるかの照会を担う。
 * DOM・操作モードの解釈・図形種別の判定・ハンドル名の形式・表示とロックの値を持たない。
 */
// 依存の向き: `edit/`から`core/`（状態を持たない規則の関数）・`shapes/`（図形をまたぐ規則の関数）への下向きの依存のみ（`main.js → edit → io → core → shapes`の一方向に沿い、どちらも`edit/`を読まないため循環しない）。
import { collectVertexTargets } from '../core/VertexTargetRules.js';
import { ITEM_KIND, listShapeItems } from '../core/ItemTreeRules.js';
import { PLACE_KIND } from '../core/ItemPlaceRules.js';
import { resolveSplitAvailability, planSplitAtVertices, planSegmentDeletion } from '../shapes/PathSplitRules.js';

/**
 * 分割・区間の削除の編集操作クラス。main.jsが1つだけ生成する。
 *
 * - 分割（`splitAtSelectedVertices`）：頂点の選択で選んだ切れる点のすべてで線・パスを切り分ける。
 * - 区間の削除（`deleteSelectedSegments`）：頂点の選択で両端の点を選んだ区間をすべて消す。
 * - 照会（`getAvailability`）：「分割」「区間を消す」が押せるか（純粋な照会）。
 * - 切り方・消し方の計算（ピースの組み立て・元の行を引き継ぐ1本の決め方・図形ごと消えるか）は`shapes/PathSplitRules`に任せる。
 * - それぞれ`beginEdit`と`commitEdit`で1回だけ挟み、取り消し1件にする（まとめの鍵なし。複数の図形でも1件）。何も変わらないときは記録先・モデルに触れない。
 *
 * 手順（分割・区間の削除に共通。`#apply`）:
 *   1. 計画が空なら記録先・モデルに触れず`false`。
 *   2. 置き換える前に、元の選択（`getSelectedIds`）・選んでいるフォルダ（`getSelectedGroupIds`）と、図形のアイテムの並び（`listShapeItems(getItems())`）を控える。
 *   3. `beginEdit` → `clearSelectedVertices`（先に空にして、途中の通知で古いハンドル名が残らないようにする） → 計画の図形ごとに、
 *      ピースが空なら消す図形のidへ控える／そうでなければ`replaceShape(targetId, pieces[0], { keepId: true, select: false })`、
 *      ピースが2つ以上なら`addShapesWithNewIds`で`pieces[1..]`を元のアイテムの名前のまま元の行のすぐ上（`PLACE_KIND.ABOVE`）へ入れる
 *      （戻り値の新しいidを控える） → 消す図形があれば`deleteShapes`（図形のアイテムだけを除き、フォルダは空になっても残る） →
 *      `setSelection([...元の選択, ...新しいid], { groupIds: 元の選んでいるフォルダ })`（現存しないidは`VectorModel`が落とす） → `commitEdit`。
 *   4. `true`。
 *   操作の後は、元の選択（消えた図形を除く）に新しくできた線を足したものが選ばれ、頂点の選択は空になる。
 *
 * 表示・ロックの引き継ぎ:
 *   新しいアイテムには`visible`・`locked`を渡さない（`VectorModel`が`true`・`false`を補う）。対象の図形は頂点の選択に入っている＝変えられる図形
 *   （自分も上のフォルダも隠れておらずロックされていない）で、同じフォルダの中に入るため、元の行の値も上のフォルダから受け継ぐ値も同じになる。
 *   このためここでは`visible`・`locked`の値を読まない。
 *
 * 入る場所の順:
 *   `PLACE_KIND.ABOVE`は「その行のすぐ上（同じ並びのすぐ後ろ）」で、渡した順に並ぶため、後のピースほど上（手前）になる。
 *
 * 通知の回数:
 *   `replaceShape`・`addShapesWithNewIds`・`deleteShapes`・`setSelection`がそれぞれ1回ずつ通知する（途中の通知の時点でも状態は正しい）。
 *
 * 依存の制約:
 *   - importは`core/VertexTargetRules`の`collectVertexTargets`、`core/ItemTreeRules`の`ITEM_KIND`・`listShapeItems`、`core/ItemPlaceRules`の`PLACE_KIND`、
 *     `shapes/PathSplitRules`の`resolveSplitAvailability`・`planSplitAtVertices`・`planSegmentDeletion`のみ。
 *   - `model`は`getShapes`・`getSelectedIds`・`getSelectedVertices`・`getSelectedGroupIds`・`getItems`・`clearSelectedVertices`・`replaceShape`・`addShapesWithNewIds`・`deleteShapes`・`setSelection`だけを使う。
 *   - `editRecorder`（実体は`HistoryManager`）は`beginEdit`・`commitEdit`だけを使う。
 *   - 操作モードの値は解釈せず（`getMode`の戻り値を規則へ渡すだけ）、DOMを知らない。
 *   - 図形種別の分岐・図形固有のプロパティ名（ハンドル名の形式を含む）を持たない。
 *   - 再描画・UI同期を自分で呼ばない。`try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）: ドラッグ中でないこと（`main.js`の配線が判定する）。本クラスは進行中の入力操作の中断・モード切り替えを行わない。
 */
export class PathSplitEditor {
    /** @type {import('../core/VectorModel.js').VectorModel} */
    #model;

    /** @type {{ beginEdit: function(): void, commitEdit: function(): void }} */
    #editRecorder;

    /** @type {function(): string} */
    #getMode;

    /**
     * @param {Object} deps 依存
     * @param {import('../core/VectorModel.js').VectorModel} deps.model 図形一式と選択を保持するモデル
     * @param {{ beginEdit: function(): void, commitEdit: function(): void }} deps.editRecorder 履歴の記録先（`HistoryManager`）
     * @param {function(): string} deps.getMode 現在の操作モードを返す関数（値は解釈しない）
     */
    constructor({ model, editRecorder, getMode }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        this.#getMode = getMode;
    }

    /**
     * 「分割」「区間を消す」が押せるかを返す（純粋な照会。図形・選択・履歴を変更しない）。
     * @returns {{ split: boolean, deleteSegments: boolean }} 押せるか（頂点の選択以外のモード・点なしでは両方`false`）
     */
    getAvailability() {
        return resolveSplitAvailability(this.#collectTargets());
    }

    /**
     * 選んでいる切れる点のすべてで、線・パスを切り分ける。
     * 切れる点が無いときは、記録先・モデルに一切触れず`false`。
     * @returns {boolean} 切ったとき`true`
     */
    splitAtSelectedVertices() {
        return this.#apply(planSplitAtVertices(this.#collectTargets()));
    }

    /**
     * 両端の点を選んでいる区間をすべて消す。
     * 選んでいる区間が無いときは、記録先・モデルに一切触れず`false`。
     * @returns {boolean} 消したとき`true`
     */
    deleteSelectedSegments() {
        return this.#apply(planSegmentDeletion(this.#collectTargets()));
    }

    /**
     * 頂点の選択から、規則へ渡す対象（図形と頂点の番号の組）を集める。
     * 頂点の選択以外のモード・点なしなら空配列。図形が見つからない組・番号が得られない組は飛ばす。
     * @returns {Array<{ shape: Object, vertexIndex: number }>} 対象
     */
    #collectTargets() {
        return collectVertexTargets(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices(), this.#model.getShapes());
    }

    /**
     * 計画を1件の編集操作として適用する。クラスのJSDocの手順のとおり。
     * @param {Array<{ targetId: string, pieces: Object[] }>} plan 計画（`pieces[0]`が元の行を引き継ぐ1本、`pieces[1..]`が新しくできた線、空は図形ごと消える）
     * @returns {boolean} 適用したとき`true`（計画が空なら`false`）
     */
    #apply(plan) {
        if (plan.length === 0) return false;
        const selectedIds = this.#model.getSelectedIds();
        const selectedGroupIds = this.#model.getSelectedGroupIds();
        const shapeItems = listShapeItems(this.#model.getItems());

        this.#editRecorder.beginEdit();
        this.#model.clearSelectedVertices();
        const removedIds = [];
        const addedIds = [];
        for (const { targetId, pieces } of plan) {
            if (pieces.length === 0) {
                removedIds.push(targetId);
                continue;
            }
            this.#model.replaceShape(targetId, pieces[0], { keepId: true, select: false });
            if (pieces.length > 1) {
                const original = shapeItems.find((item) => item.shape.id === targetId);
                const values = pieces.slice(1).map((shape) => ({ kind: ITEM_KIND.SHAPE, shape, name: original ? original.name : '' }));
                addedIds.push(...this.#model.addShapesWithNewIds(values, { place: { kind: PLACE_KIND.ABOVE, id: targetId } }));
            }
        }
        if (removedIds.length > 0) this.#model.deleteShapes(removedIds);
        this.#model.setSelection([...selectedIds, ...addedIds], { groupIds: selectedGroupIds });
        this.#editRecorder.commitEdit();
        return true;
    }
}
