/**
 * 責務: 頂点の選択のダブルクリックで点を足す相手の決め方と、削除の入口（`Delete`・`Backspace`・削除ボタン）を点の削除と図形の削除のどちらへ振り分けるかを、状態を持たない関数と値として提供する。
 * importは`InputModes`のみ。DOM・VectorModel・図形・履歴を知らない。
 */
import { InputState, OperationMode } from './InputModes.js';

/**
 * 削除の入口の振り分け先。
 * - `ITEMS`：図形・アイテムの削除（今の`deleteSelection()`）。
 * - `VERTICES`：選んだ点の削除（頂点の選択のとき）。
 * @readonly
 * @enum {string}
 */
export const DELETE_ROUTE = Object.freeze({
    ITEMS: 'items',
    VERTICES: 'vertices',
});

/**
 * 操作モードから、削除の入口の振り分け先を決める。
 * `VERTEX`なら`VERTICES`、ほか（`SELECT`・`CREATE`・`PAN`・未知の値）は`ITEMS`。
 * @param {string} mode 操作モード（`OperationMode`の値）
 * @returns {string} `DELETE_ROUTE`の値
 */
export function resolveDeleteRoute(mode) {
    return mode === OperationMode.VERTEX ? DELETE_ROUTE.VERTICES : DELETE_ROUTE.ITEMS;
}

/**
 * ダブルクリックで点を足す図形のidを決める。
 * 操作モードが`VERTEX`・入力状態が`IDLE`・ドラッグ中でない・直前のクリックが抑止されていない・当たりが頂点のハンドルでない・本体（`bodyId`）がある、のときだけ`bodyId`を返す。
 * 修飾キーは見ない。引数を書き換えない。
 * @param {Object} params 判定の材料
 * @param {string} params.mode 操作モード（`OperationMode`の値）
 * @param {string} params.state 入力状態（`InputState`の値）
 * @param {boolean} params.isDragging ドラッグ中か
 * @param {boolean} params.clickSuppressed 直前の`click`がドラッグ後として抑止されたか
 * @param {{handle: (Object|null), bodyId: (string|null)}|null} params.hit 当たりの分類結果（`PointHit`の形。`handle`・`bodyId`だけを読む）
 * @returns {string|null} 点を足す図形のid。足さないときはnull
 */
export function resolveDoubleClickInsertTarget({ mode, state, isDragging, clickSuppressed, hit }) {
    if (mode !== OperationMode.VERTEX) return null;
    if (state !== InputState.IDLE) return null;
    if (isDragging || clickSuppressed) return null;
    if (!hit) return null;
    if (hit.handle) return null;
    return hit.bodyId ? hit.bodyId : null;
}
