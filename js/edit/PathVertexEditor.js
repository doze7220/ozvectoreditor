/**
 * 責務: 頂点の選択での点の追加（ダブルクリックした区間の上）と、選んだ点の削除を、規則（`shapes/PathVertexRules`）でそれぞれ1件の編集操作として行う手順と、削除できるかの照会を担う。
 * DOM・操作モードの解釈・図形種別の判定・ハンドル名の形式を持たない。
 */
// 依存の向き: `edit/`から`core/`（状態を持たない規則の関数）・`shapes/`（図形をまたぐ規則の関数）への下向きの依存のみ（`main.js → edit → io → core → shapes`の一方向に沿い、どちらも`edit/`を読まないため循環しない）。
import { resolveNudgeTarget } from '../core/NudgeTargetRules.js';
import { planVertexInsertion, planVertexRemoval } from '../shapes/PathVertexRules.js';

/**
 * 点の追加・削除の編集操作クラス。main.jsが1つだけ生成する。
 *
 * - 追加（`insertAt`）：ダブルクリックした位置に最も近い区間の上へ点を足す。足した点だけが選ばれた状態になる。
 * - 削除（`removeSelectedVertices`）：頂点の選択で選んでいる点を消す。図形ごと消える組は`deleteShapes`で図形のアイテムだけを除く（入っていたフォルダは空になっても残る）。
 * - 照会（`canRemoveSelectedVertices`）：消せる点があるか（純粋な照会）。
 * - 足す・消すの計算（形・区間の種類・角・図形ごと消えるか）は`shapes/PathVertexRules`に任せる。
 * - それぞれ`beginEdit`と`commitEdit`で1回だけ挟み、取り消し1件にする（まとめの鍵なし。複数の図形の点を消しても1件）。何も変わらないときは記録先・モデルに触れない。
 * - 置き換えは`keepId: true`なので、図形の`id`・名前・表示・ロック・一覧での位置・フォルダの所属は変わらない。
 *
 * 追加の手順（`insertAt`）:
 *   1. `getEditableShapes()`から図形を探す（無ければ`false`）。
 *   2. `planVertexInsertion`が`null`なら記録先・モデルに触れず`false`。
 *   3. 足した点のハンドル名を、新しい図形の`getVertexHandleNames()`のうち`getVertexIndexForHandle(名前) === insertedIndex`のものとして求める（ハンドル名の形式は解釈しない）。
 *   4. `beginEdit` → `replaceShape(…, { keepId: true, select: true })`（その図形だけが選ばれる） → `setSelectedVertices`（足した点だけ） → `commitEdit`。
 *   `select: true`は頂点の選択から呼ぶ。選択集合の不変条件（選択モード・頂点の選択モード以外では空）を崩さない。
 *
 * 削除の手順（`removeSelectedVertices`）:
 *   1. 計画（`planVertexRemoval`）が空なら記録先・モデルに触れず`false`。
 *   2. `beginEdit` → `clearSelectedVertices`（先に空にして、途中の通知で古いハンドル名が残らないようにする） → 図形ごとの`replaceShape`（`select: false`。選択は保たれる） → 図形ごと消える組を`deleteShapes`（1つ以上のとき） → `commitEdit`。
 *   消した後は頂点の選択が空で、残った図形は選ばれたまま、消えた図形は選択から外れる。
 *
 * 依存の制約:
 *   - importは`core/NudgeTargetRules`の`resolveNudgeTarget`と、`shapes/PathVertexRules`の`planVertexInsertion`・`planVertexRemoval`のみ。
 *   - `model`は`getEditableShapes`・`getShapes`・`getSelectedIds`・`getSelectedVertices`・`replaceShape`・`setSelectedVertices`・`clearSelectedVertices`・`deleteShapes`だけを使う。
 *   - `editRecorder`（実体は`HistoryManager`）は`beginEdit`・`commitEdit`だけを使う。
 *   - 操作モードの値は解釈せず（`getMode`の戻り値を規則へ渡すだけ）、DOMを知らない。
 *   - 図形種別の分岐・図形固有のプロパティ名（ハンドル名の形式を含む）を持たない。
 *   - 再描画・UI同期を自分で呼ばない。`try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）: ドラッグ中でないこと・頂点の選択であること（`core/InputTracker`が判定する）。
 * 本クラスは進行中の入力操作の中断・モード切り替えを行わない。
 */
export class PathVertexEditor {
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
     * 図形の輪郭の上の点に最も近い区間へ、点を1つ足す。
     * 足せないとき（図形が無い・変えられない図形・円・弧・許容幅の外・頂点と同じ位置）は、記録先・モデルに一切触れず`false`。
     * 足せるときは`beginEdit`→`replaceShape`→`setSelectedVertices`→`commitEdit`の順で、取り消し1件になる。
     * @param {string} shapeId 足す相手の図形のid
     * @param {{x: number, y: number}} point ダブルクリックしたワールド座標
     * @param {number} tolerance 輪郭からの許容幅（ワールド座標）
     * @returns {boolean} 足したとき`true`
     */
    insertAt(shapeId, point, tolerance) {
        const shape = this.#model.getEditableShapes().find((s) => s.id === shapeId);
        if (!shape) return false;
        const plan = planVertexInsertion(shape, point, tolerance);
        if (plan === null) return false;
        const handle = plan.shape.getVertexHandleNames().find((name) => plan.shape.getVertexIndexForHandle(name) === plan.insertedIndex);
        this.#editRecorder.beginEdit();
        this.#model.replaceShape(shapeId, plan.shape, { keepId: true, select: true });
        this.#model.setSelectedVertices(handle === undefined ? [] : [{ shapeId, handle }]);
        this.#editRecorder.commitEdit();
        return true;
    }

    /**
     * 選んでいる点を消せるかを返す（純粋な照会。図形・選択・履歴を変更しない）。
     * @returns {boolean} 消せる点があるとき`true`（頂点の選択以外のモード・点なしでは`false`）
     */
    canRemoveSelectedVertices() {
        return planVertexRemoval(this.#collectTargets()).length > 0;
    }

    /**
     * 選んでいる点を消す。
     * 消せる点が無いときは、記録先・モデルに一切触れず`false`。
     * 消せるときは`beginEdit`→`clearSelectedVertices`→図形ごとの`replaceShape`→（図形ごと消える組があれば）`deleteShapes`→`commitEdit`の順で、取り消し1件になる。
     * @returns {boolean} 消したとき`true`
     */
    removeSelectedVertices() {
        const plan = planVertexRemoval(this.#collectTargets());
        if (plan.length === 0) return false;
        this.#editRecorder.beginEdit();
        this.#model.clearSelectedVertices();
        const removedIds = [];
        for (const { targetId, shape } of plan) {
            if (shape === null) {
                removedIds.push(targetId);
                continue;
            }
            this.#model.replaceShape(targetId, shape, { keepId: true, select: false });
        }
        if (removedIds.length > 0) this.#model.deleteShapes(removedIds);
        this.#editRecorder.commitEdit();
        return true;
    }

    /**
     * 頂点の選択から、規則へ渡す対象（図形と頂点の番号の組）を集める。
     * 頂点の選択以外のモード・点なしなら空配列。図形が見つからない組・番号が得られない組は飛ばす。
     * @returns {Array<{ shape: Object, vertexIndex: number }>} 対象
     */
    #collectTargets() {
        const target = resolveNudgeTarget(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices());
        if (target === null || target.type !== 'vertices') return [];
        const shapes = this.#model.getShapes();
        const targets = [];
        for (const { shapeId, handle } of target.vertices) {
            const shape = shapes.find((s) => s.id === shapeId);
            if (!shape) continue;
            const vertexIndex = shape.getVertexIndexForHandle(handle);
            if (vertexIndex === null) continue;
            targets.push({ shape, vertexIndex });
        }
        return targets;
    }
}
