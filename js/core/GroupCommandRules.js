/**
 * 責務：フォルダを作る・解除する操作を受け付ける操作モードと、フォルダを作るボタン・複合パスのボタンの動作と状態を判定する。
 * 状態を持たず、DOMにも触れない。importするのは InputModes のみ。
 */
import { OperationMode } from './InputModes.js';

/**
 * フォルダを作るボタンの動作の値。
 * none: 何もしない。group: 選んでいるまとまりをフォルダにまとめる。
 * addAndSelect: 空のフォルダを足して選ぶ。add: 空のフォルダを足すだけ（選択・ツールはそのまま）。
 * @type {Readonly<{NONE: 'none', GROUP: 'group', ADD_AND_SELECT: 'addAndSelect', ADD: 'add'}>}
 */
export const FOLDER_BUTTON_ACTION = Object.freeze({
    NONE: 'none',
    GROUP: 'group',
    ADD_AND_SELECT: 'addAndSelect',
    ADD: 'add'
});

/**
 * まとめる・解除する操作を受け付ける操作モードかを返す（選択モードだけ）。
 * @param {string} mode - 操作モード（OperationMode の値）
 * @returns {boolean} 受け付けるなら true
 */
export function canEditGroups(mode) {
    return mode === OperationMode.SELECT;
}

/**
 * フォルダを作るボタンを押したときの動作を決める。
 * ロック中・ドラッグ中・行のドラッグ中は none、選択モードでまとまりがあれば group、
 * 選択・頂点の選択モードなら addAndSelect、それ以外は add。
 * @param {Object} params - 引数
 * @param {string} params.mode - 操作モード（OperationMode の値）
 * @param {boolean} params.hasUnits - 選んでいるまとまりが1つ以上あるか
 * @param {boolean} params.isDragging - キャンバスのドラッグ中か
 * @param {boolean} params.isRowDragging - 一覧の行のドラッグ中か
 * @param {boolean} params.isLocked - 操作がロックされているか
 * @returns {'none'|'group'|'addAndSelect'|'add'} FOLDER_BUTTON_ACTION の値
 */
export function resolveFolderButtonAction({ mode, hasUnits, isDragging, isRowDragging, isLocked }) {
    if (isLocked || isDragging || isRowDragging) {
        return FOLDER_BUTTON_ACTION.NONE;
    }
    if (mode === OperationMode.SELECT && hasUnits) {
        return FOLDER_BUTTON_ACTION.GROUP;
    }
    if (mode === OperationMode.SELECT || mode === OperationMode.VERTEX) {
        return FOLDER_BUTTON_ACTION.ADD_AND_SELECT;
    }
    return FOLDER_BUTTON_ACTION.ADD;
}

/**
 * フォルダのアイテムのボタン（複合パス）の状態を求める。
 * 選んでいるまとまり（unitIds）がちょうど1つで、それが選んでいるフォルダ（selectedGroupIds）に入っているとき
 * だけ groupId がそのid、ほかは null。pressed は groupId があり複合パスのとき、enabled は groupId があり変えられるとき。
 * 操作モードは見ない（フォルダを選べるのは選択・頂点の選択モードだけで、ほかのモードでは選択が空になり groupId が null になるため）。
 * ドラッグ中・ロック中は見た目に含めない（同期の契機が model.onChange だけで、ドラッグの終わりに描き直されないため）。
 * 押された見た目は、複合パスなら押せないとき（ロック等）も出す。
 * @param {Object} params - 引数
 * @param {Array<string>} params.unitIds - 選んでいるまとまりのid
 * @param {Array<string>} params.selectedGroupIds - 選んでいるフォルダのid
 * @param {function(string): boolean} params.isEditable - フォルダが変えられる（隠れていない・ロックされていない）か
 * @param {function(string): boolean} params.isCompound - フォルダが複合パスか
 * @returns {{groupId: string|null, enabled: boolean, pressed: boolean}} ボタンの状態
 */
export function resolveCompoundButtonState({ unitIds, selectedGroupIds, isEditable, isCompound }) {
    const groupId = unitIds.length === 1 && selectedGroupIds.includes(unitIds[0]) ? unitIds[0] : null;
    if (groupId === null) {
        return { groupId: null, enabled: false, pressed: false };
    }
    return { groupId, enabled: isEditable(groupId), pressed: isCompound(groupId) };
}

/**
 * 複合パスのボタンを押したときに切り替えを行うかを返す。
 * ボタンが押せて、ロック中・ドラッグ中・行のドラッグ中でないときだけ真（フォルダを作るボタンの none の条件と揃える）。
 * @param {Object} params - 引数
 * @param {{enabled: boolean}} params.state - resolveCompoundButtonState の結果
 * @param {boolean} params.isDragging - キャンバスのドラッグ中か
 * @param {boolean} params.isRowDragging - 一覧の行のドラッグ中か
 * @param {boolean} params.isLocked - 操作がロックされているか
 * @returns {boolean} 切り替えるなら true
 */
export function canToggleCompound({ state, isDragging, isRowDragging, isLocked }) {
    return state.enabled && !isLocked && !isDragging && !isRowDragging;
}
