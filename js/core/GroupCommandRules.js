/**
 * 責務：フォルダを作る・解除する操作を受け付ける操作モードと、フォルダを作るボタンの動作を判定する。
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
