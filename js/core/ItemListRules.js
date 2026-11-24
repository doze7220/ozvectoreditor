/**
 * 責務：図形の一覧の行の並び、行の操作（押す・カーソルを置く・名前の編集・行のドラッグ）の判定の規則。
 * 状態を持たず、DOMにも`VectorModel`にも触れない。importは`ItemTreeRules`・`InputModes`だけ。
 */
import { listShapeItems } from './ItemTreeRules.js';
import { OperationMode } from './InputModes.js';

/**
 * 一覧の1行。
 * @typedef {Object} ItemRow
 * @property {string} id - 図形の id
 * @property {string} name - 名前（未定なら空文字）
 * @property {Object} shape - 図形インスタンス（共有。書き換えない）
 */

/**
 * アイテムの入れ子から、一覧の行を作る。先頭が前面（図形のアイテムの前順の逆順）。フォルダは行にしない。
 * 隠れている・ロックの図形も含める。引数は書き換えない。
 * @param {Array<Object>} items - アイテムの入れ子
 * @returns {ItemRow[]} 行の配列（先頭が前面）
 */
export function buildItemRows(items) {
    return listShapeItems(items)
        .reverse()
        .map((item) => ({ id: item.shape.id, name: item.name ?? '', shape: item.shape }));
}

/**
 * 行を押したときの動作の値。
 * @readonly
 * @enum {string}
 */
export const ROW_PRESS_ACTION = Object.freeze({
    NONE: 'none',
    SELECT: 'select',
    SWITCH_AND_SELECT: 'switchAndSelect'
});

/**
 * 行を押したときに何をするかを決める。
 * @param {Object} params - 判定の材料
 * @param {string} params.mode - 操作モード（OperationMode の値）
 * @param {boolean} params.isPicking - スポイトの待ち受け中か
 * @param {boolean} params.isDragging - ドラッグ・パンの最中か
 * @param {boolean} params.isLocked - 一覧がロック中か
 * @returns {string} ROW_PRESS_ACTION の値
 */
export function resolveRowPressAction({ mode, isPicking, isDragging, isLocked }) {
    if (isLocked || isDragging) {
        return ROW_PRESS_ACTION.NONE;
    }
    if (isPicking) {
        return ROW_PRESS_ACTION.SWITCH_AND_SELECT;
    }
    if (mode === OperationMode.SELECT || mode === OperationMode.VERTEX) {
        return ROW_PRESS_ACTION.SELECT;
    }
    if (mode === OperationMode.PAN) {
        return ROW_PRESS_ACTION.SWITCH_AND_SELECT;
    }
    return ROW_PRESS_ACTION.NONE;
}

/**
 * 描くツール等（行を押しても選択・ツールが変わらない操作モード）で、行のクリックを「描き込む先」の指定にするかを判定する。
 * 作成モードで、スポイトの待ち受け中・ドラッグ中・ロック中のどれでもないときだけ真。
 * @param {Object} params - 判定の材料
 * @param {string} params.mode - 操作モード（OperationMode の値）
 * @param {boolean} params.isPicking - スポイトの待ち受け中か
 * @param {boolean} params.isDragging - ドラッグ・パンの最中か
 * @param {boolean} params.isLocked - 一覧がロック中か
 * @returns {boolean} 描き込む先にするなら true
 */
export function canSetInsertTargetByRow({ mode, isPicking, isDragging, isLocked }) {
    return mode === OperationMode.CREATE && !isPicking && !isDragging && !isLocked;
}

/**
 * 行のドラッグ（並べ替え）を始めてよいかを判定する。操作モードは見ない。
 * 左ボタンで、修飾キーなし・編集中の行でない（名前の欄の中の押下を含む）・キャンバスのドラッグ/パン中でない・ロック中でないときだけ真。
 * @param {Object} params - 判定の材料
 * @param {number} params.button - `MouseEvent.button`
 * @param {boolean} params.hasModifier - `Ctrl`（`⌘`）・`Shift`を押しているか
 * @param {boolean} params.isEditingRow - 押した行が名前の編集中か
 * @param {boolean} params.isDragging - キャンバスの左ドラッグ・パンの最中か
 * @param {boolean} params.isLocked - 一覧がロック中か
 * @returns {boolean} 始めてよいなら true
 */
export function canStartRowDrag({ button, hasModifier, isEditingRow, isDragging, isLocked }) {
    return button === 0 && !hasModifier && !isEditingRow && !isDragging && !isLocked;
}

/**
 * 行のドラッグが始まったとき、押した行を選ぶかを判定する。
 * 選択・頂点の選択モードで、スポイトの待ち受け中でなく、押した行が選ばれていないときだけ真。
 * @param {Object} params - 判定の材料
 * @param {string} params.mode - 操作モード（OperationMode の値）
 * @param {boolean} params.isPicking - スポイトの待ち受け中か
 * @param {boolean} params.isSelected - 押した行が選ばれているか
 * @returns {boolean} 選ぶなら true
 */
export function shouldSelectPressedRow({ mode, isPicking, isSelected }) {
    return (mode === OperationMode.SELECT || mode === OperationMode.VERTEX) && !isPicking && !isSelected;
}

/**
 * 一覧の操作をロックする状態かを判定する（読み込み中・キャンバスの切り替え中など）。
 * @param {Object} state - キャンバスの一覧の状態
 * @param {boolean} [state.loading] - 起動時の読み込み中か
 * @param {boolean} [state.busy] - 切り替え等の処理中か
 * @returns {boolean} ロック中なら true
 */
export function isListLocked({ loading, busy }) {
    return Boolean(loading) || Boolean(busy);
}

/**
 * 行にカーソルを置いたとき・外れたときの動作の値。
 * @readonly
 * @enum {string}
 */
export const ROW_HOVER_ACTION = Object.freeze({
    NONE: 'none',
    RECORD: 'record',
    SET: 'set',
    CLEAR: 'clear'
});

/**
 * 行へのカーソルの動きに対する、ホバーの扱いを決める。照会の関数は、表の順にその行まで進んだときだけ呼ぶ。
 * @param {Object} params - 判定の材料
 * @param {?string} params.id - カーソルの下の行の図形 id（行が無ければ null）
 * @param {?string} params.hoveredRowId - 一覧が出したホバーとして記録している id
 * @param {?string} params.hoveredId - モデルの今のホバーの id
 * @param {boolean} params.isDragging - ドラッグ・パンの最中か
 * @param {function(): boolean} params.queryLocked - ロック中かの照会
 * @param {function(string): boolean} params.queryExists - その id の図形が今あるかの照会
 * @returns {string} ROW_HOVER_ACTION の値
 */
export function resolveRowHover({ id, hoveredRowId, hoveredId, isDragging, queryLocked, queryExists }) {
    if (id === null) {
        return ROW_HOVER_ACTION.CLEAR;
    }
    if (id === hoveredRowId && id === hoveredId) {
        return ROW_HOVER_ACTION.NONE;
    }
    if (isDragging || queryLocked()) {
        return ROW_HOVER_ACTION.CLEAR;
    }
    if (id === hoveredId) {
        return ROW_HOVER_ACTION.RECORD;
    }
    if (queryExists(id)) {
        return ROW_HOVER_ACTION.SET;
    }
    return ROW_HOVER_ACTION.CLEAR;
}

/**
 * 今のホバーが、一覧が出したものかを判定する。
 * @param {?string} hoveredRowId - 一覧が出したホバーとして記録している id
 * @param {?string} hoveredId - モデルの今のホバーの id
 * @returns {boolean} 一覧が出したホバーなら true
 */
export function isOwnHover(hoveredRowId, hoveredId) {
    return hoveredRowId !== null && hoveredRowId === hoveredId;
}

/**
 * 名前の編集を始めるかを判定する。
 * @param {Object} params - 判定の材料
 * @param {boolean} params.isDragging - ドラッグ・パンの最中か
 * @param {boolean} params.isLocked - 一覧がロック中か
 * @param {boolean} params.hasModifier - `Ctrl`・`Shift`等の修飾キーを押しているか
 * @returns {boolean} 始めるなら true
 */
export function canStartNameEdit({ isDragging, isLocked, hasModifier }) {
    return !isDragging && !isLocked && !hasModifier;
}

/**
 * 名前の欄のキー入力を、確定・取りやめに対応づける。
 * @param {string} key - `KeyboardEvent.key`
 * @param {boolean} isComposing - 文字の変換中か
 * @returns {('commit'|'cancel'|null)} 確定・取りやめ、それ以外・変換中は null
 */
export function resolveNameEditKey(key, isComposing) {
    if (isComposing) {
        return null;
    }
    if (key === 'Enter') {
        return 'commit';
    }
    if (key === 'Escape') {
        return 'cancel';
    }
    return null;
}
