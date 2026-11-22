/**
 * 責務: 操作モード・入力状態・当たり分類から、キャンバスに適用すべきCSS cursor値を決める規則を、状態を持たない関数として提供する。
 * 引数を書き換えない。DOMなし。importはInputModes.jsとScaleHandleRules.js（外枠のハンドルのカーソルの向きの表）のみ。
 */

import { InputState, OperationMode } from './InputModes.js';
import { resolveScaleHandleCursor } from './ScaleHandleRules.js';

/**
 * 当たり分類の結果。型の正本はPointHitRules.jsのPointHit（JSDocの型参照のみで、import文は書かない）。
 * @typedef {import('./PointHitRules.js').PointHit} PointHit
 */

/**
 * resolveCursorShapeへ渡す入力。
 * isPickingShape・isSelectedは値ではなく関数で受ける。呼び出し元の短絡評価
 * （isPickingShape()は選択モードのときだけ、isSelected()は本体に当たったときだけ呼ぶ）を保ち、呼び出しの回数を変えないため。
 * @typedef {Object} CursorShapeInput
 * @property {boolean} isPanning パンのドラッグ中か
 * @property {boolean} isSpacePressed スペース押下中か
 * @property {boolean} isLeftDragState 左ドラッグ状態（DRAGGING_HANDLE/MOVING_SELECTION/MARQUEE_SELECTING/SCALING_SELECTION）か
 * @property {string} mode 現在の操作モード（OperationMode）
 * @property {string} state 現在の入力状態（InputState）
 * @property {() => boolean} isPickingShape クリックした図形を外へ渡す待ち受け中かを返す関数
 * @property {PointHit | null} hit カーソル位置の当たり分類。座標が不明なときはnull
 * @property {(id: string) => boolean} isSelected 図形IDが選択集合内かを返す関数
 * @property {string|null} [scaleHandle] カーソル位置（拡大縮小のドラッグ中はドラッグしているハンドル）の外枠のハンドル名。省略・undefined・nullは外枠のハンドルなし（省いたときは従来と同じ結果）
 */

/**
 * 現在の操作モード・入力状態・カーソル位置の当たり分類から、キャンバスに適用すべきCSS cursor値を判定する。
 * DOMには触れない純粋な判定関数。判定順序：
 * (0a)パンのドラッグ中 → 'grabbing'、
 * (0b)スペース押下中かつ左ドラッグ状態（DRAGGING_HANDLE/MOVING_SELECTION/MARQUEE_SELECTING/SCALING_SELECTION）でない → 'grab'
 * （左ドラッグ中はパンを開始しないため除外し、ドラッグ中のカーソルを維持）、
 * (1)図形作成モード → 'crosshair'（作成途中を含む）、
 * (2)キャンバス移動モード → 'grab'、
 * (2a)頂点の選択モード → DRAGGING_HANDLE状態なら'move'、hit === nullなら'default'、hit.handle（頂点のハンドル上）なら'move'、
 * hit.bodyId（図形の本体上。選択中かは見ない）なら'pointer'、それ以外は'default'（isPickingShape・isSelectedは呼ばない）、
 * (3)選択モード・頂点の選択モード以外のモード → 'default'（将来のモード追加時の既定値）、
 * (3a)クリックした図形を外へ渡す待ち受け中（isPickingShape()が真） → 'cell'（パン中・スペース押下中の
 * 'grabbing'・'grab'は先に判定されるため優先順は変わらない）、
 * (3b)stateがIDLEかSCALING_SELECTIONで、scaleHandle（外枠のハンドル名）があり、resolveScaleHandleCursor(scaleHandle)がnullでない
 * → その値（'nwse-resize'・'nesw-resize'・'ew-resize'・'ns-resize'。パン中・スペース押下中・待ち受け中が優先されるのは(0a)(0b)(3a)の順のとおり。
 * 頂点の選択モードでは使わない＝(2a)が先に返る。ツールごとにカーソルを変えない約束は変わらない）、
 * (4)DRAGGING_HANDLE・MOVING_SELECTION状態 → 'move'、
 * (5)MARQUEE_SELECTING状態 → 'default'、
 * (6)当たり分類なし（hit === null。座標不明） → 'default'、
 * (7)選択集合の図形のハンドル上（hit.handle） → 'move'、
 * (8)選択集合内の図形の本体上（hit.bodyIdが選択集合内） → 'move'、
 * (9)それ以外の図形の本体上（hit.bodyId） → 'pointer'、
 * (10)それ以外 → 'default'。
 * @param {CursorShapeInput} input 判定に必要な値（引数は書き換えない）
 * @returns {'grabbing'|'grab'|'crosshair'|'cell'|'move'|'pointer'|'default'|'nwse-resize'|'nesw-resize'|'ew-resize'|'ns-resize'} 適用すべきCSS cursor値
 */
export function resolveCursorShape(input) {
    const { isPanning, isSpacePressed, isLeftDragState, mode, state, isPickingShape, hit, isSelected, scaleHandle } = input;

    if (isPanning) {
        return 'grabbing';
    }

    if (isSpacePressed && !isLeftDragState) {
        return 'grab';
    }

    if (mode === OperationMode.CREATE) {
        return 'crosshair';
    }

    if (mode === OperationMode.PAN) {
        return 'grab';
    }

    if (mode === OperationMode.VERTEX) {
        if (state === InputState.DRAGGING_HANDLE) {
            return 'move';
        }

        if (hit === null) {
            return 'default';
        }

        if (hit.handle) {
            return 'move';
        }

        if (hit.bodyId) {
            return 'pointer';
        }

        return 'default';
    }

    if (mode !== OperationMode.SELECT) {
        return 'default';
    }

    if (isPickingShape()) {
        return 'cell';
    }

    if ((state === InputState.IDLE || state === InputState.SCALING_SELECTION) && typeof scaleHandle === 'string') {
        const scaleCursor = resolveScaleHandleCursor(scaleHandle);
        if (scaleCursor !== null) {
            return scaleCursor;
        }
    }

    if (state === InputState.DRAGGING_HANDLE || state === InputState.MOVING_SELECTION) {
        return 'move';
    }

    if (state === InputState.MARQUEE_SELECTING) {
        return 'default';
    }

    if (hit === null) {
        return 'default';
    }

    if (hit.handle) {
        return 'move';
    }

    if (hit.bodyId && isSelected(hit.bodyId)) {
        return 'move';
    }

    if (hit.bodyId) {
        return 'pointer';
    }

    return 'default';
}
