/**
 * 責務: 幅・高さ・角度・反転の数値入力（オプションバー）の表示内容の照会と、入力された値・押された反転による選択中の図形の変形の手順（1件の編集操作）を担う。
 * 対象と外枠の解決・変換の算出は規則に、基準点の位置は`ReferencePointRules`に任せ、DOM・操作モードの解釈・図形種別の分岐を持たない。
 */
// 依存の向き: `edit/`から`core/`への下向きの依存と同じ層（`edit/`）内の依存（`main.js → edit → io → core → shapes`の一方向に沿い、`core/`側は`edit/`を読まないため循環しない）。
import { resolveNudgeTarget } from '../core/NudgeTargetRules.js';
import { DEFAULT_REFERENCE_POINT, resolveReferencePointPosition } from '../core/ReferencePointRules.js';
import {
    buildSizeInputView,
    buildTransformInputView,
    canTransformSelection,
    resolveFlipTransform,
    resolveRotationTransform,
    resolveSizeTransform
} from './TransformInputRules.js';

/**
 * 幅・高さ・角度・反転の編集操作クラス。main.jsが1つだけ生成する。
 *
 * - 対象（選択（`V`）で選んでいる図形）と、線を含まない外枠を求め、欄に出す内容と入力・反転の反映を担う。
 * - 変換の動かない点は、外枠の上の基準点（`getReferencePoint`の名前。省くと中心）。
 * - 変換は図形の`createTransformed`で作り、`VectorModel.replaceShapesKeepingIds`（`id`・並び・選択を保つ）で差し替え、前後を`editRecorder`の`beginEdit`・`commitEdit`で挟む（まとめの鍵なし＝1回が1件）。
 *
 * 依存の制約:
 *   - `model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`・`replaceShapesKeepingIds`だけを使う。
 *   - 操作モードの値は解釈せず（`getMode`の戻り値を規則へ渡すだけ）、DOM・ビュー変換を知らない。
 *   - ドラッグ中かどうかを見ない（反転を拒むかは`main.js`の`performFlip`が決める。幅・高さ・角度は拒まない）。
 *   - 図形種別の分岐・図形固有のプロパティ名を持たない。スナップ（刻みへの丸め）・端点への吸い付きを通さない。
 *   - 保存しない状態を持たない（基準点・比率の鍵は注入された照会関数で毎回読む）。再描画・UI同期を自分で呼ばない。`try/catch`を持たない。
 */
export class TransformInputEditor {
    /** @type {import('../core/VectorModel.js').VectorModel} */
    #model;

    /** @type {function(): string} */
    #getMode;

    /** @type {{ getSelectedGeometryBounds: function(): ({minX: number, minY: number, maxX: number, maxY: number}|null) }} */
    #shapeExtentReader;

    /** @type {{ beginEdit: function(): void, commitEdit: function(): void }} */
    #editRecorder;

    /** @type {function(): (string|null)} */
    #getReferencePoint;

    /** @type {function(): boolean} */
    #isAspectLocked;

    /**
     * @param {Object} deps 依存
     * @param {import('../core/VectorModel.js').VectorModel} deps.model 図形一式と選択を保持するモデル
     * @param {function(): string} deps.getMode 現在の操作モードを返す関数
     * @param {{ getSelectedGeometryBounds: function(): ({minX: number, minY: number, maxX: number, maxY: number}|null) }} deps.shapeExtentReader 線を含まない外枠の照会
     * @param {{ beginEdit: function(): void, commitEdit: function(): void }} deps.editRecorder 編集の記録先
     * @param {function(): (string|null)} [deps.getReferencePoint] 基準点の名前を返す関数（省く・関数でないときは中心）
     * @param {function(): boolean} [deps.isAspectLocked] 比率の鍵が掛かっているかを返す関数（省く・関数でないときは常に`false`）
     */
    constructor({ model, getMode, shapeExtentReader, editRecorder, getReferencePoint, isAspectLocked }) {
        this.#model = model;
        this.#getMode = getMode;
        this.#shapeExtentReader = shapeExtentReader;
        this.#editRecorder = editRecorder;
        this.#getReferencePoint = typeof getReferencePoint === 'function' ? getReferencePoint : () => DEFAULT_REFERENCE_POINT;
        this.#isAspectLocked = typeof isAspectLocked === 'function' ? isAspectLocked : () => false;
    }

    /**
     * 大きさのまとまりに出す内容を返す（純粋な照会。図形・選択集合・履歴を変更しない）。
     * @returns {import('./TransformInputRules.js').SizeInputView} 欄に出す内容
     */
    getSizeView() {
        const { enabled, bounds } = this.#resolveFrame();
        return buildSizeInputView(enabled, bounds, enabled && this.#isAspectLocked());
    }

    /**
     * 変形のまとまりに出す内容を返す（純粋な照会。図形・選択集合・履歴を変更しない）。
     * @returns {import('./TransformInputRules.js').TransformInputView} 欄・ボタンに出す内容
     */
    getTransformView() {
        const { enabled } = this.#resolveFrame();
        return buildTransformInputView(enabled, this.#getReferencePoint());
    }

    /**
     * 指定の軸の長さを入力値へ変える（動かない点は基準点）。押せない・受理されない入力・今と同じ値のときは記録先に一切触れず`false`。
     * @param {string} axis 軸（`SIZE_AXIS`の値）
     * @param {string} text 欄に入力された文字列
     * @returns {boolean} 図形の差し替えまで進んだとき`true`
     */
    setSize(axis, text) {
        const frame = this.#resolveFrame();
        if (!frame.enabled) return false;
        const origin = resolveReferencePointPosition(frame.bounds, this.#getReferencePoint());
        const transform = resolveSizeTransform(axis, text, frame.bounds, origin, this.#isAspectLocked());
        if (transform === null) return false;
        return this.#apply(frame.target.shapeIds, transform);
    }

    /**
     * 基準点の周りに入力した角度（度。プラス＝反時計回り）だけ回す。押せない・受理されない入力・0のときは記録先に一切触れず`false`。
     * @param {string} text 欄に入力された文字列
     * @returns {boolean} 図形の差し替えまで進んだとき`true`
     */
    rotateBy(text) {
        const frame = this.#resolveFrame();
        if (!frame.enabled) return false;
        const origin = resolveReferencePointPosition(frame.bounds, this.#getReferencePoint());
        const transform = resolveRotationTransform(text, origin);
        if (transform === null) return false;
        return this.#apply(frame.target.shapeIds, transform);
    }

    /**
     * 基準点を通る縦（横）の線を軸に反転する。押せない・未知の軸のときは記録先に一切触れず`false`。
     * @param {string} axis 軸（`FLIP_AXIS`の値）
     * @returns {boolean} 図形の差し替えまで進んだとき`true`
     */
    flip(axis) {
        const frame = this.#resolveFrame();
        if (!frame.enabled) return false;
        const origin = resolveReferencePointPosition(frame.bounds, this.#getReferencePoint());
        const transform = resolveFlipTransform(axis, origin);
        if (transform === null) return false;
        return this.#apply(frame.target.shapeIds, transform);
    }

    /**
     * 対象・線を含まない外枠・押せるかを求める。
     * @returns {{ target: (Object|null), bounds: ({minX: number, minY: number, maxX: number, maxY: number}|null), enabled: boolean }} 対象・外枠・押せるか
     */
    #resolveFrame() {
        const target = resolveNudgeTarget(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices());
        const bounds = target !== null && target !== undefined && target.type === 'shapes'
            ? this.#shapeExtentReader.getSelectedGeometryBounds()
            : null;
        return { target, bounds, enabled: canTransformSelection(target, bounds) };
    }

    /**
     * 図形へ変換を当てて差し替え、1件の編集として記録する（通知1回）。前後が同じなら記録は`HistoryManager`が省く。
     * @param {Array<string>} shapeIds 変換する図形のid
     * @param {{a: number, b: number, c: number, d: number, e: number, f: number}} transform 当てる変換
     * @returns {boolean} 差し替えたとき`true`（対象が0件なら`false`）
     */
    #apply(shapeIds, transform) {
        const idSet = new Set(shapeIds);
        const shapes = this.#model.getShapes().filter((shape) => idSet.has(shape.id));
        if (shapes.length === 0) return false;
        this.#editRecorder.beginEdit();
        this.#model.replaceShapesKeepingIds(shapes.map((shape) => ({ id: shape.id, shape: shape.createTransformed(transform) })));
        this.#editRecorder.commitEdit();
        return true;
    }
}
