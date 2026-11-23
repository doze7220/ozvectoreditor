/**
 * 責務：入力の状態（InputState）と操作モード（OperationMode）の値の定義だけを持つ。
 * import・DOM・判定を持たない。
 */

/**
 * InputTrackerが取りうる内部状態。
 * IDLE: 待機状態（ホバー判定・クリックによる新規作成/選択待ち）。
 * DRAWING: 作成中の図形の終点をカーソルに追従させている（始点確定済み）。
 * DRAGGING_HANDLE: 選択集合内の1図形の頂点ハンドルを押下・ドラッグ中（閾値以前を含む。閾値を超えたかはDragTrackerが保持する）。
 * MOVING_SELECTION: 選択集合の全図形を平行移動するドラッグを押下・ドラッグ中（本体ドラッグ。閾値以前を含む）。
 * MARQUEE_SELECTING: 範囲選択を押下・ドラッグ中（閾値以前を含む）。
 * SCALING_SELECTION: 選択モードで外枠のハンドルを押下・ドラッグし、選んでいる図形をまとめて拡大縮小している状態（閾値以前を含む）。
 * ROTATING_SELECTION: 選択モードで外枠の角の外側の回転の範囲を押下・ドラッグし、選んでいる図形をまとめて回転している状態（閾値以前を含む）。
 * @readonly
 * @enum {string}
 */
export const InputState = {
    IDLE: 'IDLE',
    DRAWING: 'DRAWING',
    DRAGGING_HANDLE: 'DRAGGING_HANDLE',
    MOVING_SELECTION: 'MOVING_SELECTION',
    MARQUEE_SELECTING: 'MARQUEE_SELECTING',
    SCALING_SELECTION: 'SCALING_SELECTION',
    ROTATING_SELECTION: 'ROTATING_SELECTION',
};

/**
 * `Esc`で中断して引き始めの形に戻すドラッグの入力状態の一覧（値の定義。判定は`InputTracker.isScalingSelection()`が行う）。
 * @type {ReadonlyArray<string>}
 */
export const CANCELABLE_DRAG_STATES = Object.freeze([InputState.SCALING_SELECTION, InputState.ROTATING_SELECTION]);

/**
 * 操作モード。ツールパレットの「選択」「頂点の選択」「キャンバス移動」のボタンはSELECT・VERTEX・PANに、図形のボタンはCREATE（と図形種別）に対応する（対応の規則は`ToolRules.js`）。
 * SELECT: 選択モード（ホバー判定・選択・範囲選択・本体ドラッグ・外枠のハンドルでの拡大縮小・外枠の角の外側での回転・一括削除）。
 * CREATE: 図形作成モード（currentShapeTypeの図形を新規作成）。
 * PAN: キャンバス移動モード（左ドラッグでパン）。
 * VERTEX: 頂点の選択モード（選択中の図形の頂点を選んで動かす）。
 * モードを追加する際は、ここへ1エントリを追加する（InputTracker.setMode()のバリデーションは本定義の値を正とする）。
 * @readonly
 * @enum {string}
 */
export const OperationMode = Object.freeze({
    SELECT: 'select',
    CREATE: 'create',
    PAN: 'pan',
    VERTEX: 'vertex',
});
