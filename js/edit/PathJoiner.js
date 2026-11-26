/**
 * 責務: 選択中で変えられる線（直線・開いたパス・今の曲線・弧）の結合を、結合の規則（`shapes/PathJoinRules`）で作った計画に従ってモデルへ反映する
 * 1件の編集操作（閉じる（開いたパス・弧1本）・2本の結合）と、結合できる選択かの照会を担う。DOMに触れない。
 */
import { JOIN_TOLERANCE_SCREEN_PX, planJoin } from '../shapes/PathJoinRules.js';

/**
 * 選択中の線を結合する1件の編集操作を行うクラス。
 * ボタン（`main.js`の`performJoin`）とキー`J`の共通の手順であり、押せる/押せないの同期（`canJoin`）にも使う。
 * 押せる見た目（`canJoin()`が真）なら必ず`join()`が計画を作って結合し、計画を作れないなら押せない（同じ`planJoin`の入口）。
 *
 * 依存の制約:
 *   - importは`../shapes/PathJoinRules.js`のみ（`edit/`の例外）。VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。
 *   - InputTrackerには依存しない。DOMに触れない。
 *   - 図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない（読むのは共通プロパティ`id`のみ）。
 *   - `try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）:
 *   - ドラッグ中でないこと（`main.js`の`performJoin()`が判定する）。
 *   - 結合の対象は選択中の「変えられる図形」（隠れてもロックされてもいない図形）だけ。変えられない図形が選択に混ざっていても無視する。
 *   - 選択モード以外では選択集合が空のため何もしない（操作モードは知らない）。
 *   本クラスは進行中の入力操作の中断・モード切り替えを行わない
 *   （選択モードで選択集合が空でない状態では作成途中の図形が無い）。
 */
export class PathJoiner {
    /**
     * 図形一式と選択集合を保持するモデル（`getEditableSelectedShapes`・`replaceShape`だけを使う）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はmain.jsが注入するHistoryManager）。
     * @type {import('./ShapeInserter.js').EditRecorder}
     */
    #editRecorder;

    /**
     * 画面上の長さをワールド座標の長さへ換算する注入関数。
     * @type {(length: number) => number}
     */
    #screenLengthToWorld;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式と選択集合を保持するモデル
     * @param {import('./ShapeInserter.js').EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     * @param {(length: number) => number} deps.screenLengthToWorld - 画面上の長さ→ワールド座標の長さの換算関数
     */
    constructor({ model, editRecorder, screenLengthToWorld }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        this.#screenLengthToWorld = screenLengthToWorld;
    }

    /**
     * 現在の選択（のうち変えられる図形）の結合の計画を、表示倍率で換算した許容距離で作れるか。
     * `join()`と同じ`planJoin`の入口（頂点3つ以上の開いたパス・弧の1本、結合できる線2本のとき真。両端が重なってまとめると頂点が2つになるパス・小さな弧は偽）。
     * モデル・履歴を変えない。
     * @returns {boolean} 計画を作れる（`join()`が結合する）なら`true`
     */
    canJoin() {
        return planJoin(
            this.#selectedShapesInOrder(),
            this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)
        ) !== null;
    }

    /**
     * 選択中の線を結合する。
     *
     * 処理順:
     *   1. 選択中で変えられる図形を重なり順（奥が先）で集める。
     *   2. `planJoin`で計画を作る（許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`）。`null`なら何も呼ばず`false`。
     *   3. `editRecorder.beginEdit()` → `model.replaceShape(...)` → `editRecorder.commitEdit()`。
     *   4. `replaceShape`の戻り値が`null`でなければ`true`。
     *
     * @returns {boolean} 結合したか（結合できない選択ではfalse）
     */
    join() {
        const plan = planJoin(
            this.#selectedShapesInOrder(),
            this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)
        );
        if (plan === null) {
            return false;
        }

        this.#editRecorder.beginEdit();
        const placedId = this.#model.replaceShape(plan.targetId, plan.path, {
            keepId: plan.keepId,
            removeIds: plan.removeIds
        });
        this.#editRecorder.commitEdit();

        return placedId !== null;
    }

    /**
     * 選択集合のうち変えられる図形を重なり順（`model.getEditableSelectedShapes()`の並び。奥が先）で返す。
     * @returns {Array<Object>} 選択中で変えられる図形
     * @private
     */
    #selectedShapesInOrder() {
        return this.#model.getEditableSelectedShapes();
    }
}
