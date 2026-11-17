/**
 * 責務: 選んでいる図形の整列・分布を、規則（`./ShapeAlignRules.js`）で求めた図形ごとの移動量に従って
 * モデルへ反映する1件の編集操作と、各操作で動く図形があるかの照会を担う。DOMに触れない。
 */
import { ShapeAlignOperation, computeAlignMoves, canApplyAlign } from './ShapeAlignRules.js';

/**
 * 8つの操作それぞれについて、動く図形があるか（押せるか）。キーは`ShapeAlignOperation`の値。
 * `palette/OptionBarAlignGroup.js`のtypedef`ShapeAlignAvailability`と同じ内容の二重定義。形を変えるときは両方をそろえること。
 * @typedef {Object} ShapeAlignAvailability
 * @property {boolean} alignLeft 左へそろえる
 * @property {boolean} alignHorizontalCenter 左右中央へそろえる
 * @property {boolean} alignRight 右へそろえる
 * @property {boolean} alignTop 上へそろえる
 * @property {boolean} alignVerticalCenter 上下中央へそろえる
 * @property {boolean} alignBottom 下へそろえる
 * @property {boolean} distributeHorizontal 横方向に均等に並べる
 * @property {boolean} distributeVertical 縦方向に均等に並べる
 */

/**
 * 選んでいる図形の整列・分布を行う1件の編集操作のクラス。
 * ボタン（`main.js`の`performShapeAlign`）の手順であり、押せる/押せないの同期（`getAvailability`）にも使う。
 *
 * 依存の制約:
 *   - importは`./ShapeAlignRules.js`のみ（`edit/`内の例外）。VectorModel・HistoryManager・ShapeExtentReaderはimportせず、インスタンスを注入で受け取る。
 *   - `model`は`moveShapesBy`だけを使う。
 *   - `editRecorder`は`beginEdit`・`commitEdit`だけを使う。
 *   - `shapeExtentReader`は`getSelectedBoundsPerShape`だけを使う。
 *   - InputTrackerには依存しない。DOMに触れない。
 *   - 図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない。
 *   - `try/catch`を持たない。再描画・UI同期を自分で呼ばない（`model.onChange`の経路のみ）。
 *   - ビュー変換（表示倍率・スクロール）・スナップの設定を読まない（値はワールド座標のpx）。
 *
 * 前提（呼び出し側の責務）:
 *   - ドラッグ中でないこと（`main.js`の`performShapeAlign()`が判定する）。
 *   - 選択モード・頂点の選択モード以外・キャンバスの読み込み中は選択集合が空のため何もしない（操作モードは知らない）。
 *   本クラスは進行中の入力操作の中断・モード切り替えを行わない。
 */
export class ShapeAlignEditor {
    /**
     * 図形一式と選択集合を保持するモデル（`moveShapesBy`だけを使う）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はmain.jsが注入するHistoryManager。`beginEdit`・`commitEdit`だけを使う）。
     * @type {import('./ShapeInserter.js').EditRecorder}
     */
    #editRecorder;

    /**
     * 選択中の図形1つずつの外枠の照会（`getSelectedBoundsPerShape`だけを使う）。
     * @type {import('./ShapeExtentReader.js').ShapeExtentReader}
     */
    #shapeExtentReader;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式と選択集合を保持するモデル
     * @param {import('./ShapeInserter.js').EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     * @param {import('./ShapeExtentReader.js').ShapeExtentReader} deps.shapeExtentReader - 外枠の照会
     */
    constructor({ model, editRecorder, shapeExtentReader }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        this.#shapeExtentReader = shapeExtentReader;
    }

    /**
     * 選んでいる図形を整列・分布する。
     *
     * 処理順:
     *   1. 選択中の図形1つずつの外枠を求める。
     *   2. `canApplyAlign`が偽なら、記録先に一切触れずに`false`（履歴も通知も増えない）。
     *      未知の操作はここで規則が`Error`をthrowする（`beginEdit`より前のため対が崩れない）。
     *   3. `computeAlignMoves`で図形ごとの移動量を求める。
     *   4. `editRecorder.beginEdit()` → `model.moveShapesBy(移動量)`（1回） → `editRecorder.commitEdit()`（まとめの鍵は渡さない）。
     *   5. `true`を返す。
     *
     * @param {ShapeAlignOperation} operation 操作
     * @returns {boolean} 図形を動かしたか
     * @throws {Error} 未知の操作のとき
     */
    apply(operation) {
        const items = this.#shapeExtentReader.getSelectedBoundsPerShape();
        if (!canApplyAlign(items, operation)) {
            return false;
        }
        const moves = computeAlignMoves(items, operation);

        this.#editRecorder.beginEdit();
        this.#model.moveShapesBy(moves);
        this.#editRecorder.commitEdit();

        return true;
    }

    /**
     * 8つの操作それぞれで動く図形があるか（ボタンを押せるか）を返す。モデル・選択集合・履歴を変えない。
     * 外枠の照会は1回だけ行い、8操作で使い回す。
     * @returns {ShapeAlignAvailability} 操作ごとの可否（キーは`ShapeAlignOperation`の値）
     */
    getAvailability() {
        const items = this.#shapeExtentReader.getSelectedBoundsPerShape();
        const availability = {};
        for (const operation of Object.values(ShapeAlignOperation)) {
            availability[operation] = canApplyAlign(items, operation);
        }
        return availability;
    }
}
