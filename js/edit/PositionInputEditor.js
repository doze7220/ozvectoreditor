/**
 * 責務: 位置の数値入力（オプションバーのX・Yの欄）の表示内容の照会と、入力された値への移動の手順を担う。
 * 対象と範囲の解決・移動量の算出は規則に、実際の移動と記録は`NudgeEditor`に任せ、DOM・図形種別の分岐を持たない。
 */
// 依存の向き: `edit/`から`core/`への下向きの依存と同じ層（`edit/`）内の依存（`main.js → edit → io → core → shapes`の一方向に沿い、`core/`側は`edit/`を読まず、`PositionInputRules`は`StatusReadoutRules`しか読まないため循環しない）。
import { resolveNudgeTarget } from '../core/NudgeTargetRules.js';
import { computeVertexHandlesBounds } from '../core/VertexHandleRules.js';
import { buildPositionInputView, resolvePositionDelta } from './PositionInputRules.js';

/**
 * 位置の数値入力の編集操作クラス。main.jsが1つだけ生成する。
 *
 * - 対象（選んでいる図形または頂点）と、その範囲の左上を求め、欄に出す内容と入力の反映を担う。
 * - 図形は外枠（線の太さを含む）、頂点は選んだ頂点全体の範囲の左上を位置とする。
 * - 記録（`beginEdit`・`commitEdit`）は`NudgeEditor.nudgeWithoutGrouping`に任せ、このクラスは`HistoryManager`を持たない。
 *
 * 依存の制約:
 *   - `model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`だけを使う（読むだけ。書き換えない）。
 *   - 操作モードの値は解釈せず（`getMode`の戻り値を規則へ渡すだけ）、DOM・ビュー変換を知らない。
 *   - 図形固有のプロパティ名を持たない。スナップ（刻みへの丸め）・端点への吸い付きを通さない。
 *   - 再描画・UI同期を自分で呼ばない。`try/catch`を持たない。
 */
export class PositionInputEditor {
    /** @type {import('../core/VectorModel.js').VectorModel} */
    #model;

    /** @type {function(): string} */
    #getMode;

    /** @type {{ getSelectedBounds: function(): ({minX: number, minY: number, maxX: number, maxY: number}|null) }} */
    #shapeExtentReader;

    /** @type {{ nudgeWithoutGrouping: function(number, number): boolean }} */
    #nudgeEditor;

    /**
     * @param {Object} deps 依存
     * @param {import('../core/VectorModel.js').VectorModel} deps.model 図形一式と選択を保持するモデル
     * @param {function(): string} deps.getMode 現在の操作モードを返す関数
     * @param {{ getSelectedBounds: function(): ({minX: number, minY: number, maxX: number, maxY: number}|null) }} deps.shapeExtentReader 外枠の照会
     * @param {{ nudgeWithoutGrouping: function(number, number): boolean }} deps.nudgeEditor 移動量を当てる編集操作
     */
    constructor({ model, getMode, shapeExtentReader, nudgeEditor }) {
        this.#model = model;
        this.#getMode = getMode;
        this.#shapeExtentReader = shapeExtentReader;
        this.#nudgeEditor = nudgeEditor;
    }

    /**
     * 位置の欄に出す内容を返す（純粋な照会。図形・選択集合・履歴を変更しない）。
     * @returns {{ x: string, y: string, disabled: boolean }} 欄に出す内容
     */
    getPositionView() {
        const { target, bounds } = this.#resolveTargetAndBounds();
        return buildPositionInputView(target, bounds);
    }

    /**
     * 指定の軸の位置を入力値へ動かす。受理されない入力・動かす対象がない・移動量0のときは記録先に一切触れず`false`。
     * @param {string} axis 軸（`POSITION_AXIS`の値）
     * @param {string} text 欄に入力された文字列
     * @returns {boolean} 動かしたとき`true`（`NudgeEditor.nudgeWithoutGrouping`の戻り値）
     */
    setPosition(axis, text) {
        const { bounds } = this.#resolveTargetAndBounds();
        const delta = resolvePositionDelta(axis, text, bounds);
        if (delta === null) return false;
        return this.#nudgeEditor.nudgeWithoutGrouping(delta.dx, delta.dy);
    }

    /**
     * 対象と、その範囲（図形は外枠、頂点は頂点全体の範囲）を求める。
     * @returns {{ target: (Object|null), bounds: ({minX: number, minY: number, maxX: number, maxY: number}|null) }} 対象と範囲（対象なしなら両方`null`）
     */
    #resolveTargetAndBounds() {
        const target = resolveNudgeTarget(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices());
        if (target === null) return { target: null, bounds: null };
        if (target.type === 'shapes') {
            return { target, bounds: this.#shapeExtentReader.getSelectedBounds() };
        }
        return { target, bounds: computeVertexHandlesBounds(this.#model.getShapes(), target.vertices) };
    }
}
