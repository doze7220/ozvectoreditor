/**
 * 責務: 頂点の選択で選んでいる点の角・なめらかを規則（`shapes/PathCornerRules`）で切り替える1件の編集操作と、「角」のチェックボックスの表示内容の照会を担う。
 * DOM・操作モードの解釈・図形種別の判定を持たない。
 */
// 依存の向き: `edit/`から`core/`（状態を持たない規則の関数）・`shapes/`（図形をまたぐ規則の関数）への下向きの依存のみ（`main.js → edit → io → core → shapes`の一方向に沿い、どちらも`edit/`を読まないため循環しない）。
import { resolveNudgeTarget } from '../core/NudgeTargetRules.js';
import { resolveCornerToggleView, planCornerToggle } from '../shapes/PathCornerRules.js';

/**
 * 角の切り替えの編集操作クラス。main.jsが1つだけ生成する。
 *
 * - 頂点の選択（`A`）で選んでいる点を対象に、表示内容（`getView`）と切り替え（`toggle`）を担う。
 * - 角・なめらかの判定、表示内容の決め方、切り替え後のパスの組み立ては`shapes/PathCornerRules`に任せる。
 * - 切り替えは`beginEdit`と`commitEdit`で1回だけ挟み、取り消し1件にする（まとめの鍵なし）。変わる図形が`k`個なら`replaceShape`の通知が`k`回出る。
 * - 置き換えは`keepId: true`・`select: false`なので、図形の選択・頂点の選択・重なり順・スタイル・頂点の位置は変わらない。
 *
 * 依存の制約:
 *   - importは`core/NudgeTargetRules`の`resolveNudgeTarget`と、`shapes/PathCornerRules`の`resolveCornerToggleView`・`planCornerToggle`のみ。
 *   - `model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`・`replaceShape`だけを使う。
 *   - `editRecorder`（実体は`HistoryManager`）は`beginEdit`・`commitEdit`だけを使う。
 *   - 操作モードの値は解釈せず（`getMode`の戻り値を規則へ渡すだけ）、DOMを知らない。
 *   - 図形種別の分岐・図形固有のプロパティ名（ハンドル名の形式を含む）を持たない。
 *   - 再描画・UI同期を自分で呼ばない。`try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）: ドラッグ中でないこと（`main.js`の`performCornerToggle`が判定する）。
 * 本クラスは進行中の入力操作の中断・モード切り替えを行わない。
 */
export class PathCornerEditor {
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
     * 「角」のチェックボックスに出す内容を返す（純粋な照会。図形・選択・履歴を変更しない）。
     * @returns {{ enabled: boolean, checked: boolean, mixed: boolean }} 表示内容（`PathCornerRules.resolveCornerToggleView`の結果）
     */
    getView() {
        return resolveCornerToggleView(this.#collectTargets());
    }

    /**
     * 選んでいる点の角・なめらかを切り替える。
     * 変わる図形が無いとき（頂点の選択以外のモード・点なし・角を操作できる点なし）は、記録先・モデルに一切触れず`false`。
     * 変わるときは`beginEdit`→図形ごとの`replaceShape`→`commitEdit`の順で、取り消し1件になる。
     * @returns {boolean} 切り替えたとき`true`
     */
    toggle() {
        const plan = planCornerToggle(this.#collectTargets());
        if (plan.length === 0) return false;
        this.#editRecorder.beginEdit();
        for (const { targetId, path } of plan) {
            this.#model.replaceShape(targetId, path, { keepId: true, select: false });
        }
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
