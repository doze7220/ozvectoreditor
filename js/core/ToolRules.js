/**
 * 責務: ツール（選択・キャンバス移動・スポイト・図形の種別）の識別子と、操作モード・図形種別・スポイトの待ち受けから
 * 押し込みの表示にするツールを求める規則を、状態を持たない関数として提供する。DOMに触れない。
 */
import { OperationMode } from './InputTracker.js';
import { SHAPE_TYPES } from './ShapeFactory.js';

/**
 * ツールの識別子の一覧（凍結した配列）。並びはツールパレットのボタンの並び。
 * 識別子の約束：選択・キャンバス移動のツールは操作モードの値（`OperationMode.SELECT`・`OperationMode.PAN`）と同じ、
 * 図形のツールは図形種別の値（`SHAPE_TYPES`の各要素）と同じ。
 * ボタンのid`tool-${toolId}`は`index.html`側の約束であり、本ファイルはDOMを知らない。
 * @type {ReadonlyArray<string>}
 */
export const TOOL_IDS = Object.freeze([OperationMode.SELECT, OperationMode.PAN, ...SHAPE_TYPES]);

/**
 * スポイトのツールの識別子。操作モードの値でも図形種別の値でもない独自の識別子（識別子の約束）。
 * ボタンのid`tool-eyedropper`は`index.html`側の約束。なお`TOOL_IDS`への追加は別タスクで行う。
 * @type {string}
 */
export const EYEDROPPER_TOOL_ID = 'eyedropper';

/**
 * 操作モード・図形種別・スポイトの待ち受けから、押し込みの表示にするツールの識別子を求める。
 * `picking`が`true`なら操作モードによらず`EYEDROPPER_TOOL_ID`。そうでなければ、`mode`が選択なら`'select'`、
 * キャンバス移動なら`'pan'`（`shapeType`は見ない）、図形作成なら`shapeType`（`SHAPE_TYPES`に含まれるときのみ）を返す。
 * 引数を書き換えない。
 * @param {string} mode - 操作モード（`OperationMode`の値）
 * @param {string} shapeType - 図形種別（`SHAPE_TYPES`の要素）
 * @param {boolean} [picking=false] - スポイトの待ち受け中か。`true`のときだけスポイトを優先する（省略・偽なら従来どおり）
 * @returns {string|null} ツールの識別子。未知の`mode`、または図形作成モードで`SHAPE_TYPES`外の
 *     `shapeType`のときは`null`（どのボタンも押し込みにしない）。`picking`が`true`のときは常に`EYEDROPPER_TOOL_ID`
 */
export function resolveActiveTool(mode, shapeType, picking = false) {
    if (picking === true) {
        return EYEDROPPER_TOOL_ID;
    }
    if (mode === OperationMode.SELECT) {
        return OperationMode.SELECT;
    }
    if (mode === OperationMode.PAN) {
        return OperationMode.PAN;
    }
    if (mode === OperationMode.CREATE) {
        return SHAPE_TYPES.includes(shapeType) ? shapeType : null;
    }
    return null;
}
