/**
 * 責務：ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈と
 * Model・ビュー変換への反映（修飾キーの読み取りは選択・移動方向の限定・スナップの規則の関数へ渡すだけ。待ち受け中のクリックは図形のidを外へ渡すだけ）、状態依存の操作（一括削除・取消・全選択・進行中操作の中断）の公開、編集操作の開始・確定の通知（注入された記録先へ）、
 * および入力状態に応じたカーソル形状のフィードバックを担う。
 */

import { DragTracker } from './DragTracker.js';
import { SHAPE_TYPES } from './ShapeFactory.js';
import { classifyPointHit } from './PointHitRules.js';
import { resolveClickSelection, resolveMarqueeSelection } from './SelectionRules.js';
import { constrainMoveDirection } from './MoveDirectionRules.js';
import { resolveUnitSnapStep, roundDeltaToUnit, roundConstrainedDeltaToUnit } from './UnitSnapRules.js';

/**
 * InputTrackerが取りうる内部状態。
 * IDLE: 待機状態（ホバー判定・クリックによる新規作成/選択待ち）。
 * DRAWING: 作成中の図形の終点をカーソルに追従させている（始点確定済み）。
 * DRAGGING_HANDLE: 選択集合内の1図形の頂点ハンドルを押下・ドラッグ中（閾値以前を含む。閾値を超えたかはDragTrackerが保持する）。
 * MOVING_SELECTION: 選択集合の全図形を平行移動するドラッグを押下・ドラッグ中（moveハンドル・本体ドラッグ。閾値以前を含む）。
 * MARQUEE_SELECTING: 範囲選択を押下・ドラッグ中（閾値以前を含む）。
 * @readonly
 * @enum {string}
 */
export const InputState = {
    IDLE: 'IDLE',
    DRAWING: 'DRAWING',
    DRAGGING_HANDLE: 'DRAGGING_HANDLE',
    MOVING_SELECTION: 'MOVING_SELECTION',
    MARQUEE_SELECTING: 'MARQUEE_SELECTING',
};

/**
 * 当たり分類（#classifyPoint）の結果。ホバー・押下・クリック・カーソル形状の判定で共通に用いる。
 * 型の正本はPointHitRules.jsのPointHit（handleもbodyIdもnullなら空白）。ここでは同じ名前の型の別名を定義し、本ファイルのJSDocから参照できるようにする。
 * @typedef {import('./PointHitRules.js').PointHit} PointHit
 */

/**
 * 操作モード。ツールパレットの「選択」「キャンバス移動」のボタンはSELECT・PANに、図形のボタンはCREATE（と図形種別）に対応する（対応の規則は`ToolRules.js`）。
 * SELECT: 選択モード（ホバー判定・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・一括削除）。
 * CREATE: 図形作成モード（currentShapeTypeの図形を新規作成）。
 * PAN: キャンバス移動モード（左ドラッグでパン）。
 * モードを追加する際は、ここへ1エントリを追加する（setMode()のバリデーションは本定義の値を正とする）。
 * @readonly
 * @enum {string}
 */
export const OperationMode = Object.freeze({
    SELECT: 'select',
    CREATE: 'create',
    PAN: 'pan',
});

/**
 * 図形作成モードで作成可能な図形種別の一覧（ReadonlyArray<string>）。正本はShapeFactory.js（SHAPE_REGISTRYから導出）。
 * 既存のimport元（KeyboardShortcuts.js）を変えないための再export。本ファイルでは setShapeType() の引数バリデーション
 * （includes()による受理判定）と currentShapeType の初期値（先頭要素）にのみ用い、図形種別ごとの分岐には用いない。
 */
export { SHAPE_TYPES };

/**
 * ホイール1刻みあたりのズーム倍率（無次元）。拡大時はこの値を、縮小時はその逆数を
 * ViewTransform.zoomAt()のfactorとして渡す。
 * キーボードショートカットの拡大・縮小（main.js）でも同値を用いる（刻み幅を重複定義しないため共有する）。
 * @type {number}
 */
export const WHEEL_ZOOM_STEP = 1.1;

/**
 * クリックとドラッグを区別する移動量の閾値。スクリーン座標のCSSピクセル。
 * 左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）は、押下点からの移動距離がこれを超えた時点で初めて実際の操作を開始する
 * （DragTracker.begin()のthresholdとして渡す。パンには用いない）。
 * @type {number}
 */
const DRAG_START_THRESHOLD = 3;

/**
 * 編集操作（図形一式を変化させる利用者の1回の操作）の開始・確定を受け取る記録先。
 * 実体はmain.jsが注入するHistoryManager（本ファイルはHistoryManager.jsをimportせず、この2メソッドのみを呼ぶ）。
 * `edit/ShapeInserter.js`に同じ内容の定義がある（二重定義。形を変える場合は両方を揃えること）。
 * @typedef {Object} EditRecorder
 * @property {() => void} beginEdit 編集操作の開始を宣言する（その時点の状態を「前の状態」として記録する）
 * @property {() => boolean} commitEdit 編集操作の確定を宣言する（前後で図形一式が変化していれば1件として記録しtrue）
 */

/**
 * 記録先が注入されなかった場合の既定値（何も記録しない）。InputTrackerのコンストラクタ第4引数の省略時に用いる。
 * @type {EditRecorder}
 */
const NO_EDIT_RECORDER = Object.freeze({
    beginEdit() {},
    commitEdit() {
        return false;
    },
});

/**
 * 端点への吸い付きの照会と反映を委ねる補助（実体はmain.jsが注入するedit/EndpointSnapper。本ファイルはedit/をimportしない）。
 * 吸い付き結果（SnapTarget）は`x`・`y`（ワールド座標）だけを読み、他のプロパティは解釈せずそのまま補助へ返す。
 * @typedef {Object} EndpointSnapAssist
 * @property {(shapeType: string, point: {x: number, y: number}) => ({x: number, y: number}|null)} findDrawSnap
 *     描く図形種別とワールド座標で吸い付く端点を照会する（吸い付かない種別・範囲外はnull）
 * @property {(shapeId: string, handleName: string) => ('start'|'end'|null)} resolveDragEndpoint
 *     ハンドルが結合できる線の端点のハンドルなら'start'/'end'、それ以外はnull
 * @property {(dragged: {shapeId: string, end: string}, point: {x: number, y: number}) => ({x: number, y: number}|null)} findDragSnap
 *     端点のハンドルのドラッグ中に吸い付く端点を照会する
 * @property {(startSnap: Object|null, endSnap: Object|null) => boolean} commitDrawnLine
 *     描き終えを反映する（両方nullなら何もせずfalse。それ以外は作成途中の図形を破棄して反映しtrue）
 * @property {(dragged: {shapeId: string, end: string}, snap: Object) => boolean} joinDraggedEndpoint
 *     ドラッグした端点の結合・閉じるを反映する（開いている編集操作の中で行い、記録は呼び出し側）
 */

/**
 * 吸い付きの補助が注入されなかった場合の既定値（吸い付かない）。InputTrackerのコンストラクタ第5引数の省略時に用いる。
 * 照会は常にnull、commitDrawnLine・joinDraggedEndpointは常にfalse。
 * @type {EndpointSnapAssist}
 */
const NO_SNAP_ASSIST = Object.freeze({
    findDrawSnap() {
        return null;
    },
    resolveDragEndpoint() {
        return null;
    },
    findDragSnap() {
        return null;
    },
    commitDrawnLine() {
        return false;
    },
    joinDraggedEndpoint() {
        return false;
    },
});

/**
 * 入力の解釈の外へ委ねる補助の束（実体はmain.jsが注入する。本ファイルはedit/をimportしない）。
 * 項目ごとに、関数でなければ既定へ置き換える（省略は正当なためconsole.warnは出さない）。
 * @typedef {Object} InputAssist
 * @property {() => void} duplicateSelection 選択中の図形を同じ位置に複製して複製だけを選択する。
 *     Alt+ドラッグの閾値超過時、ドラッグの編集操作（beginEdit済み）の中で呼ばれ、記録しない。既定は何もしない（複製しない）
 * @property {() => boolean} isPickingShape クリックした図形を外へ渡す待ち受け中か。真の間、選択モード・IDLEの左ボタンの押下は何も始めず、
 *     クリックは当たった図形のidを pickShape へ渡すだけで選択を変えず、カーソルは'cell'になる。既定は常に偽（待ち受けなし）
 * @property {(shapeId: string) => void} pickShape 待ち受け中にクリックした図形のidを外へ渡す（handleClickが当たった本体がある場合だけ呼ぶ）。
 *     既定は何もしない。渡した先で何をするか（待ち受けの終了を含む）は本クラスは知らない
 * @property {() => (number|null)} getUnitSnapStep スナップ（座標・移動量を刻みの倍数へ丸めること。端点への吸い付きとは別）の今効いている刻みの照会
 *     （`null`＝丸めない）。追従・クリックのたびに呼ぶ。戻り値は検証せずUnitSnapRulesの関数へ渡す（正の有限の数値以外は丸めない扱い）。
 *     既定は常に`null`（丸めない）
 */

/**
 * 第7引数の補助が注入されなかった場合の既定値（複製しない・待ち受けなし・図形を渡さない・丸めない）。
 * @type {InputAssist}
 */
const NO_INPUT_ASSIST = Object.freeze({
    duplicateSelection() {},
    isPickingShape() {
        return false;
    },
    pickShape() {},
    getUnitSnapStep() {
        return null;
    },
});

/**
 * テキスト入力扱いとするinput要素のtype一覧（isTextInputElementの判定に用いる）。
 * 日付・時刻系（date/datetime-local/month/time/week）は数字キー・Backspaceによる直接入力を受け付けるため含める。
 * 含めないtypeの例：checkbox / radio / range / color / button / submit / reset / file / image / hidden。
 * （checkbox・colorはisSpaceOperatedInputElementで別に扱う。）
 * HTMLInputElement.typeプロパティは小文字に正規化され、type属性なし・未知の値の場合は'text'を返すため、
 * それらもテキスト入力扱いになる。
 * @type {ReadonlyArray<string>}
 */
const TEXT_INPUT_TYPES = Object.freeze([
    'text', 'search', 'email', 'url', 'tel', 'password', 'number',
    'date', 'datetime-local', 'month', 'time', 'week',
]);

/**
 * 要素がテキスト入力中とみなすべき要素かを判定する。
 * スペースパンとショートカット（KeyboardShortcuts）の誤爆防止に用いる。
 * input要素はtype別に判定し、TEXT_INPUT_TYPESに含まれる場合のみテキスト入力扱いとする。
 * textarea・contenteditableはテキスト入力扱い、select要素を含むそれ以外は対象外。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} テキスト入力中とみなすべき要素ならtrue
 */
export function isTextInputElement(element) {
    if (element instanceof HTMLInputElement) {
        return TEXT_INPUT_TYPES.includes(element.type);
    }
    if (element instanceof HTMLTextAreaElement) {
        return true;
    }
    return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * スペースキーで操作するinput要素のtype一覧（isSpaceOperatedInputElementの判定に用いる）。
 * checkbox（Spaceで切り替え）とcolor（Spaceでピッカーを開く）は、スペースパン・ショートカットと
 * Spaceの奪い合いになるため含める。
 * 含めないtypeの例：radio / range / button / submit / reset / file / image / hidden。
 * 現在、これらのtypeのinput要素はオプションバーのスタイルのまとまりの色の欄（color）以外に存在しない。
 * @type {ReadonlyArray<string>}
 */
const SPACE_OPERATED_INPUT_TYPES = Object.freeze(['checkbox', 'color']);

/**
 * 要素がスペースキーで操作するinput要素（checkbox・color）かを判定する。
 * スペースパンとショートカット（KeyboardShortcuts）の誤爆防止に用いる（isTextInputElementとは別に扱う）。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} type が checkbox または color の input 要素ならtrue
 */
export function isSpaceOperatedInputElement(element) {
    return element instanceof HTMLInputElement && SPACE_OPERATED_INPUT_TYPES.includes(element.type);
}

/**
 * 要素がON/OFFのボタン（標準の属性aria-pressedを持つbutton要素）かを判定する。DOMのid・クラス名は見ない。
 * HTMLButtonElementは関数の中でだけ参照する（モジュールの最上位でDOMに触れない）。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} aria-pressed属性を持つbutton要素ならtrue
 */
function isToggleButtonElement(element) {
    return element instanceof HTMLButtonElement && element.hasAttribute('aria-pressed');
}

/**
 * Spaceをスペースパンに使わず、部品自身の操作に譲る要素かを判定する
 * （type が checkbox・color の input（isSpaceOperatedInputElement）と、ON/OFFのボタン（isToggleButtonElement））。
 * Ctrlなしのショートカットを止める判定（KeyboardShortcutsの手順4）には使わない（ON/OFFのボタンではショートカットを働かせるため）。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} Spaceを部品に譲る要素ならtrue
 */
function isSpaceYieldedElement(element) {
    return isSpaceOperatedInputElement(element) || isToggleButtonElement(element);
}

/**
 * マウスイベントでCtrl（macOSの⌘を含む）が押されているかを読み取る（選択の規則の関数へ渡す値。判定そのものは規則側）。
 * @param {MouseEvent} event
 * @returns {boolean} ctrlKeyまたはmetaKeyが真ならtrue
 */
function hasCtrlModifier(event) {
    return Boolean(event.ctrlKey || event.metaKey);
}

/**
 * キャンバスのマウス入力とスペースキー（スペースパン）を解釈し、VectorModelの対応APIを呼び出す状態遷移マシン
 * （IDLE / DRAWING / DRAGGING_HANDLE / MOVING_SELECTION / MARQUEE_SELECTING）。操作モード（currentMode）と
 * 図形種別（currentShapeType）を独立した状態として保持し、操作モード・入力状態・当たり分類（#classifyPoint）に応じて
 * キャンバスのカーソル形状を更新する。当たり分類はホバー・押下・クリック・カーソル形状の判定で共用する。
 * パン（中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モードの左ドラッグ）は、DRAWINGを保持したまま
 * 行えるよう、InputStateとは直交するprivateフラグ（パン中：#isPanning、スペース押下中：#isSpacePressed）で表現する。
 * パンと左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）のライフサイクル（開始ボタン・移動量閾値・直前位置・
 * window capture購読による追従/終了・blur時の中断・終了直後のclick抑止）は、本クラスが生成・所有するDragTracker（#drag）へ
 * 委譲し、本クラスはドラッグの意味の解釈（パン量、頂点変形・選択集合の平行移動・範囲選択のModel反映）のみを行う。
 * ズーム・パンによる表示の変更はViewTransformへ委譲する。
 * 修飾キー（Ctrl＝ctrlKey||metaKey）の読み取りは行うが、クリック・範囲選択の次の選択の決定はSelectionRulesの関数へ渡すだけで本クラスは持たない
 * （結果の反映は#applySelectionChangeが受け渡す）。
 * 本体ドラッグ・移動用ハンドルのドラッグ（MOVING_SELECTION）では、追従のたびのイベントのshiftKeyとCtrl（hasCtrlModifier）も読み取るが、
 * 移動方向の限定はMoveDirectionRules、移動量の丸め（スナップ。Ctrlの間は丸めない）はUnitSnapRulesの関数へ渡すだけで本クラスは持たない。
 * 移動量は、押した位置からの移動量（限定・丸めの適用後）と反映済みの移動量の差分で求める。
 * Space以外のキー（ショートカット）は解釈しない。削除・取消・全選択・進行中操作の中断は状態依存の公開メソッドとして提供し、
 * 削除ボタン・ショートカット（KeyboardShortcuts）・切り取り（`ClipboardController.cut()`へ`main.js`が注入）・作業データの復元・取り消し/やり直しの前処理からはmain.js経由で呼び出される。
 * 編集操作（図形の作成・一括削除・選択集合の平行移動・ハンドルによる変形）は、変更処理を注入された記録先（EditRecorder）の
 * beginEdit()／commitEdit()で挟んで開始・確定を伝える（履歴の保持・適用は行わない。記録先はコンストラクタ第4引数）。
 * 範囲選択・クリック選択・全選択・選択解除・ホバー・パン・ズーム・モード/図形種別の切り替えは編集操作として伝えない。
 * 端点への吸い付きの照会と反映（直線を描くときの描き足し・結合・閉じる）は、注入された補助（EndpointSnapAssist。コンストラクタ第5引数）へ
 * 委ね、本クラスは呼ぶ場面の配線と吸い付きの表示（model.setSnapPoint/clearSnapPoint）の設定・消去のみを行う。
 * 吸い付きの規則（探索・距離・候補の選び方）・結果の組み立て・描く図形種別の判定は持たない。
 * 図形種別の分岐・図形固有のプロパティ名は持たない。
 * 当たり分類の規則（ハンドル・本体の優先順位）はPointHitRules.classifyPointHitに委ね、#classifyPointは受け渡しのみ行う
 * （塗った内側を当たりに含めるかは、コンストラクタ第6引数で注入された照会に従う）。
 * 入力の解釈の外へ委ねる補助（InputAssist。コンストラクタ第7引数。項目はduplicateSelection・isPickingShape・pickShape・getUnitSnapStep）も注入される。
 * Altを押して始めた本体ドラッグ・移動用ハンドルのドラッグで移動量が閾値を超えた時点（beginEdit()の後）に、
 * 注入された複製を呼ぶだけで、複製の仕方・idの採番は知らない。
 * 「クリックした図形を外へ渡す待ち受け」（isPickingShape）の間は、選択モード・IDLEの左ボタンの押下で何も始めず、
 * クリックは当たった図形のidをpickShapeへ渡すだけ（選択は変えない。Ctrlも見ない）で、カーソルは'cell'になる。
 * 渡した図形を何に使うか・待ち受けの開始と終了は知らない（図形のスタイルのプロパティも読まない）。
 * メソッドは区切りコメントで「公開API（モード・図形種別）」「公開API（状態依存の操作：削除・取消・全選択・中断）」「イベントハンドラ」「左ドラッグ」「パン」「当たり分類」
 * 「座標取得」「カーソル形状」の順に整理している。
 */
export class InputTracker {
    /**
     * パン中か。パンの開始時に立て、DragTrackerのセッション終了（onEnd）・中断（onCancel）時に#finishPan()で解除する。
     * パンを開始したボタン・直前のカーソル位置（スクリーン座標）はDragTrackerのセッションが保持する。
     * @type {boolean}
     */
    #isPanning = false;

    /**
     * スペースキー押下中か。押下中は左ドラッグでパンする。keyup・window blurで解除する。
     * @type {boolean}
     */
    #isSpacePressed = false;

    /**
     * 範囲選択の押下点。ワールド座標。選択矩形の固定側の頂点。
     * MARQUEE_SELECTING状態への遷移時に記憶し、#finishLeftDrag()でnullに戻す。
     * VectorModelの選択矩形（描画用の派生値）は、毎回この値と現在のカーソル位置から再設定する（Model側の値を読み返さない）。
     * @type {{x: number, y: number} | null}
     */
    #marqueeAnchor = null;

    /**
     * 本体ドラッグ（MOVING_SELECTION）の押下点。ワールド座標。移動量（押した位置からの移動量）の基準。
     * 寿命はMOVING_SELECTIONの押下（#beginLeftDrag）から#finishLeftDrag()まで（それ以外の状態ではnull）。
     * @type {{x: number, y: number} | null}
     */
    #moveOrigin = null;

    /**
     * 本体ドラッグ（MOVING_SELECTION）で、すでに図形へ反映した移動量（ワールド座標。押した位置からの移動量を加工した後の値）。
     * 押下時は{ dx: 0, dy: 0 }。更新のたびに「新しい目標の移動量 − この値」の差分だけをmoveShapesへ渡し、目標の移動量で置き換える。
     * 寿命はMOVING_SELECTIONの押下（#beginLeftDrag）から#finishLeftDrag()まで（それ以外の状態ではnull）。
     * @type {{dx: number, dy: number} | null}
     */
    #appliedMoveDelta = null;

    /**
     * ドラッグのライフサイクル管理（コンストラクタで生成・所有）。パンと左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）が利用する。
     * セッションは同時に1つのみ。
     * click抑止フラグの所有者もこのインスタンスである。
     * @type {DragTracker}
     */
    #drag;

    /**
     * 編集操作の開始・確定の記録先（コンストラクタ第4引数。省略時はNO_EDIT_RECORDER＝何も記録しない）。
     * @type {EditRecorder}
     */
    #editRecorder;

    /**
     * 左ドラッグ（MOVING_SELECTION・DRAGGING_HANDLE）で、閾値超過時（#onLeftDragStart）に記録先のbeginEdit()を呼んだか。
     * 立っていれば#finishLeftDrag()（終了・中断の共通の後始末）でcommitEdit()を呼んで下ろす。範囲選択では立てない。
     * @type {boolean}
     */
    #isEditOpen = false;

    /**
     * 端点への吸い付きの照会と反映を委ねる補助（コンストラクタ第5引数。省略時はNO_SNAP_ASSIST＝吸い付かない）。
     * @type {EndpointSnapAssist}
     */
    #snapAssist;

    /**
     * 塗った内側を当たりに含めないかの照会（コンストラクタ第6引数。真なら含めない。省略時は常に含める）。
     * #classifyPointがclassifyPointHitへ渡す直前に呼ぶ。
     * @type {() => boolean}
     */
    #isFillHitExcluded;

    /**
     * 入力の解釈の外へ委ねる補助（コンストラクタ第7引数。項目ごとに関数でなければNO_INPUT_ASSISTの項目）。
     * @type {InputAssist}
     */
    #inputAssist;

    /**
     * 本体ドラッグ（MOVING_SELECTION）を押した時点のAltキーの状態（event.altKey）。真なら閾値超過時（#onLeftDragStart）に
     * 選択中の図形を複製してから動かす。押した後のAltは見ない（途中で切り替わらない）。#beginMoveSelectionで立て、#finishLeftDrag()で下ろす。
     * @type {boolean}
     */
    #duplicateOnMove = false;

    /**
     * 直線を描き始めたときに吸い付いていた端点（handleClickのIDLE・図形作成モードで照会した結果。吸い付いていなければnull）。
     * 描き終えのcommitDrawnLineへ渡す。#resetSnapState()でnullに戻す。
     * @type {Object|null}
     */
    #drawStartSnap = null;

    /**
     * 直線を描いている途中の直前のmousemoveで吸い付いていた端点（吸い付いていなければnull）。
     * 描き終えの端点として使う（クリック位置で取り直さない）。#resetSnapState()でnullに戻す。
     * @type {Object|null}
     */
    #drawEndSnap = null;

    /**
     * 端点のハンドルのドラッグ中の、ドラッグしている端点（{ shapeId, end }。#beginLeftDragのDRAGGING_HANDLE開始時に
     * 注入された補助のresolveDragEndpointで解決した結果。端点のハンドルでなければnull）。#resetSnapState()でnullに戻す。
     * @type {Object|null}
     */
    #dragEndpoint = null;

    /**
     * 端点のハンドルのドラッグ中の直前の更新で吸い付いていた端点（吸い付いていなければnull）。
     * 離したときのjoinDraggedEndpointへ渡す。#resetSnapState()でnullに戻す。
     * @type {Object|null}
     */
    #dragSnap = null;

    /**
     * @param {HTMLCanvasElement} canvas - イベントをリッスンするキャンバス
     * @param {Object} model - 図形データを管理するVectorModelインスタンス
     * @param {ViewTransform} viewTransform - スクリーン⇔ワールド変換とズーム・パンを担うビュー変換
     * @param {EditRecorder} [editRecorder=NO_EDIT_RECORDER] - 編集操作の開始・確定を受け取る記録先（実体はmain.jsが注入する
     *     HistoryManager）。省略時は何も記録しない（既存の呼び出しは従来どおり動作する）
     * @param {EndpointSnapAssist} [snapAssist=NO_SNAP_ASSIST] - 端点への吸い付きの照会と反映を委ねる補助（実体はmain.jsが注入する
     *     EndpointSnapper）。省略時は吸い付かない（従来どおり動作する）
     * @param {() => boolean} [isFillHitExcluded=() => false] - 塗った内側を当たりに含めないかの照会（真なら含めない。
     *     当たり分類のたびに呼ぶ）。省略時は常に含める（従来どおり動作する）。関数でなければ`console.warn`して既定（常に含める）を使う
     * @param {InputAssist} [inputAssist=NO_INPUT_ASSIST] - 入力の解釈の外へ委ねる補助（実体はmain.jsが注入する）。
     *     項目（duplicateSelection・isPickingShape・pickShape・getUnitSnapStep）ごとに、関数でなければ既定へ置き換える（`console.warn`は出さない）。
     *     省略時は従来どおり動作する（複製しない・図形を渡す待ち受けなし・丸めない）
     */
    constructor(canvas, model, viewTransform, editRecorder = NO_EDIT_RECORDER, snapAssist = NO_SNAP_ASSIST, isFillHitExcluded = () => false, inputAssist = NO_INPUT_ASSIST) {
        this.canvas = canvas;
        this.model = model;
        this.#editRecorder = editRecorder;
        this.#snapAssist = snapAssist;
        if (typeof isFillHitExcluded === 'function') {
            this.#isFillHitExcluded = isFillHitExcluded;
        } else {
            console.warn('InputTracker: isFillHitExcluded が関数ではないため、塗った内側を常に当たりに含めます');
            this.#isFillHitExcluded = () => false;
        }
        this.#inputAssist = {
            duplicateSelection: typeof inputAssist?.duplicateSelection === 'function'
                ? () => inputAssist.duplicateSelection()
                : NO_INPUT_ASSIST.duplicateSelection,
            isPickingShape: typeof inputAssist?.isPickingShape === 'function'
                ? () => inputAssist.isPickingShape()
                : NO_INPUT_ASSIST.isPickingShape,
            pickShape: typeof inputAssist?.pickShape === 'function'
                ? (shapeId) => inputAssist.pickShape(shapeId)
                : NO_INPUT_ASSIST.pickShape,
            getUnitSnapStep: typeof inputAssist?.getUnitSnapStep === 'function'
                ? () => inputAssist.getUnitSnapStep()
                : NO_INPUT_ASSIST.getUnitSnapStep,
        };

        /**
         * スクリーン⇔ワールド座標変換とズーム・パンを担うビュー変換（main.jsが生成・注入）。
         * 変換式は本クラスに持たず、すべてこのインスタンスへ委譲する。
         * @type {ViewTransform}
         */
        this.viewTransform = viewTransform;

        /**
         * 現在の内部状態（InputStateの値：IDLE / DRAWING / DRAGGING_HANDLE / MOVING_SELECTION / MARQUEE_SELECTING）。状態遷移マシンの起点。
         * @type {string}
         */
        this.state = InputState.IDLE;

        /**
         * 現在の操作モード（OperationModeの値）。モードに応じてhandleMouseMove/handleMouseDown/
         * handleClickの入力解釈、および状態依存の公開操作（deleteSelection/cancelDraftOrClearSelection/selectAll）の
         * 受理可否を切り替える。setMode()経由でのみ更新する。
         * @type {'select'|'create'|'pan'}
         */
        this.currentMode = OperationMode.SELECT;

        /**
         * 図形作成モードで作成する図形種別（SHAPE_TYPESのいずれか）。setShapeType()経由でのみ更新する。
         * 操作モードの切り替えではリセットされないため、図形作成モードへ戻った際は前回の種別へ復帰する。
         * 初期値はSHAPE_TYPESの先頭要素（ツールパレットの最初の図形のボタン）。
         * @type {string}
         */
        this.currentShapeType = SHAPE_TYPES[0];

        /**
         * DRAGGING_HANDLE状態中に操作している頂点ハンドルの名前（押下時の各図形のhitTestHandleの戻り値。'move'以外）。
         * 押下時に記憶し、ドラッグの追従（#applyLeftDragUpdate）でshape.getVertexIndexForHandle()により頂点インデックスへ解決する。
         * moveハンドルの押下はMOVING_SELECTIONへ遷移するため、ここには記憶しない。
         * IDLE/DRAWING/MOVING_SELECTION/MARQUEE_SELECTING状態では未使用（null）。
         * @type {string|null}
         */
        this.activeHandle = null;

        /**
         * DRAGGING_HANDLE状態中に操作している図形のid（単一。頂点ハンドルが属する図形）。
         * IDLE/DRAWING/MOVING_SELECTION/MARQUEE_SELECTING状態では未使用（null）。
         * @type {string|null}
         */
        this.activeShapeId = null;

        /**
         * 当たり判定（図形本体のhitTest・ハンドルのhitTestHandle共通）の許容誤差。
         * 画面上（スクリーン座標）のピクセル単位。当たり判定時は#getWorldHitTolerance()で
         * ワールド換算して渡す（表示倍率によらず画面上で一定の判定幅になる）。
         * @type {number}
         */
        this.hitTolerance = 5;

        // パン・左ドラッグの追従・終了検知（windowへのcapture購読）とblur時の中断はDragTrackerが担う
        // （キャンバスのmouseupは購読しない）。DragTrackerへはスクリーン座標の取得関数のみを渡す（一方向の依存）。
        this.#drag = new DragTracker((event) => this.getScreenCoordinate(event));

        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        // preventDefault()でページスクロール・ブラウザズームを抑止するため、passive: falseで購読する
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // タブ切替等でkeyupを取りこぼした場合に、スペース押下状態を残留させない
        // （ドラッグ（パン・左ドラッグ）の中断はDragTracker自身のblur購読が担う）
        window.addEventListener('blur', this.#handleWindowBlur.bind(this));

        this.#updateCursor();
    }

    // ---- 公開API（モード・図形種別） ----

    /**
     * 操作モードを切り替える。
     * OperationModeに定義されていない値が渡された場合はconsole.warnを出して何もしない
     * （内部状態・選択集合・カーソルは一切変更しない）。
     * 有効な値の場合は常に（同じモードの再指定でも）、以下の順に処理する（モード切り替え時に前モードの状態が残留することを防ぐため）。
     * (1)進行中操作の中断（#abortOngoingOperation()。abortOngoingOperation()と同一の処理）：ドラッグセッション
     * （パン・左ドラッグ。閾値以前を含む）中であればDragTracker.cancel()で中断し（onCancel経由で、パンは#finishPan()、
     * 左ドラッグは#onLeftDragCancel()によりIDLEへ戻る。頂点・位置の変更は確定済みのまま残り、範囲選択は選択矩形を破棄して
     * 確定しない）、なおIDLE以外の状態（作成途中）であればcancelDraft()で作成途中の図形を破棄してIDLE状態へ戻す。
     * 中断した左ドラッグ（本体ドラッグ・moveハンドル・ハンドル変形）で頂点・位置の変化が残った場合は、#finishLeftDrag()で
     * 1件の編集操作として記録先へ確定する（選択集合のクリアより前のため、記録される選択集合は操作中のもの）。
     * 作成途中の図形の破棄・範囲選択の中断は編集操作として伝えない。
     * (2)currentModeの更新、(3)選択集合・ホバー状態の無条件クリア、(4)カーソル形状の再評価。
     * 中断処理の共通化に伴い、作成途中の図形の破棄（cancelDraftの変更通知）は選択集合・ホバーのクリアより前に行われる
     * （従来はクリアの後。最終状態は同一）。
     * 図形種別（currentShapeType）は変更しない。
     * @param {'select'|'create'|'pan'} mode 切り替え先の操作モード（OperationModeの値）
     */
    setMode(mode) {
        if (!Object.values(OperationMode).includes(mode)) {
            console.warn(`InputTracker.setMode: 未知の操作モードのため無視します: ${mode}`);
            return;
        }

        this.#abortOngoingOperation();

        this.currentMode = mode;

        this.model.clearSelection();
        this.model.clearHovered();

        this.#updateCursor();
    }

    /**
     * 図形作成モードで作成する図形種別を切り替える。
     * SHAPE_TYPESに含まれない値が渡された場合はconsole.warnを出して何もしない。
     * 有効な値の場合はcurrentShapeTypeを更新し、作成途中の図形（DRAWING状態）があれば
     * cancelDraft()で破棄してIDLE状態へ戻す。最後に、描いていなくても常に#resetSnapState()で
     * 吸い付きの状態と表示を消す（種別が変わると前の種別の照会結果が残るため）。
     * 操作モード・選択集合・ホバー状態・カーソル形状は変更しない（図形作成モード中に呼ばれても
     * モードは'create'のまま維持される）。
     * @param {string} type 切り替え先の図形種別（SHAPE_TYPESのいずれか）
     */
    setShapeType(type) {
        if (!SHAPE_TYPES.includes(type)) {
            console.warn(`InputTracker.setShapeType: 未知の図形種別のため無視します: ${type}`);
            return;
        }

        this.currentShapeType = type;

        if (this.state === InputState.DRAWING) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
        }

        this.#resetSnapState();
    }

    /**
     * 現在の操作モードを返す。UI側がバリデーション後の実際の内部状態を読み返して表示を同期するために用いる。
     * @returns {'select'|'create'|'pan'} 現在の操作モード（OperationModeの値）
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * 現在記憶している図形種別を返す。UI側がバリデーション後の実際の内部状態を読み返して表示を同期するために用いる。
     * @returns {string} 現在の図形種別（SHAPE_TYPESのいずれか）
     */
    getShapeType() {
        return this.currentShapeType;
    }

    // ---- 公開API（状態依存の操作：削除・取消・全選択・中断） ----

    /**
     * ドラッグ中かを返す。ドラッグ中＝パン・左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）の
     * DragTrackerセッション中（閾値以前を含む）。ショートカットの受理判定（KeyboardShortcuts）に用いる。
     * @returns {boolean} ドラッグ中ならtrue
     */
    isDragging() {
        return this.#drag.isActive();
    }

    /**
     * 選択集合の全図形を一括削除する。
     * 受理条件「選択モード かつ IDLE状態 かつ ドラッグ中でない かつ 選択集合が空でない」はこのメソッド内でのみ判定する。
     * 受理時はModelのdeleteShapes(selectedIds)を呼ぶ（変更通知1回）。非受理時は何もしない。
     * 受理時のみ、deleteShapesの直前に記録先のbeginEdit()、直後にcommitEdit()を呼び、1件の編集操作として伝える
     * （前の状態の選択集合＝削除した図形、後の状態の選択集合＝空）。非受理時は記録経路を通らない。
     * 削除ボタン（main.js）・Delete/Backspaceショートカット（KeyboardShortcuts→main.jsの注入コールバック）・
     * 切り取り（`ClipboardController.cut()`へ`main.js`が注入）の唯一の削除経路であり、呼び出し側で条件を重複判定しないこと。
     * ドラッグ中（パン中を含む）は受け付けない（ドラッグ対象の図形が消えたまま追従が続くことを防ぐため）。
     * @returns {boolean} 削除を受理したらtrue（呼び出し側はtrueのときのみpreventDefault()する）
     */
    deleteSelection() {
        if (this.currentMode !== OperationMode.SELECT || this.state !== InputState.IDLE || this.#drag.isActive()) {
            return false;
        }

        const selectedIds = this.model.getSelectedIds();
        if (selectedIds.length === 0) {
            return false;
        }

        this.#editRecorder.beginEdit();
        this.model.deleteShapes(selectedIds);
        this.#editRecorder.commitEdit();
        return true;
    }

    /**
     * 作成途中の図形の破棄、または選択解除を行う。Escショートカットの実体。以下の順に判定する。
     * (1)ドラッグ中（パン・左ドラッグ。閾値以前を含む）なら何もしない。
     * (2)DRAWING状態なら、cancelDraft()で作成途中の図形を破棄してIDLE状態へ戻し、#resetSnapState()で吸い付きの状態と表示を消す
     * （変更通知はcancelDraftに従う）。
     * (3)選択モード かつ IDLE状態 かつ 選択集合が空でなければ、clearSelection()で全解除する（変更通知1回）。
     * (4)それ以外は何もしない。
     * @returns {boolean} (2)(3)を実行したらtrue。falseの場合、呼び出し側はpreventDefault()しない
     */
    cancelDraftOrClearSelection() {
        if (this.#drag.isActive()) {
            return false;
        }

        if (this.state === InputState.DRAWING) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
            this.#resetSnapState();
            return true;
        }

        if (
            this.currentMode === OperationMode.SELECT &&
            this.state === InputState.IDLE &&
            this.model.getSelectedIds().length > 0
        ) {
            this.model.clearSelection();
            return true;
        }

        return false;
    }

    /**
     * 全図形を選択する。受理条件「選択モード かつ IDLE状態 かつ ドラッグ中でない」。
     * 受理時は全図形のidで選択集合を置き換える（setSelection。変更通知1回。図形0個なら空集合で置き換え）。
     * 選択モード以外からの全選択は、呼び出し側（main.js）が先にapplyModeで選択モードへ切り替える
     * （本クラスはmain.jsの関数を呼ばない）。
     * @returns {boolean} 受理したらtrue
     */
    selectAll() {
        if (this.currentMode !== OperationMode.SELECT || this.state !== InputState.IDLE || this.#drag.isActive()) {
            return false;
        }

        this.model.setSelection(this.model.getShapes().map((shape) => shape.id));
        return true;
    }

    /**
     * 進行中の入力操作を強制中断する。図形一式の入れ替え（VectorModel.replaceAllShapes）の前処理として、
     * 作業データの復元時、および取り消し・やり直し（履歴の適用）の前処理としてmain.jsから呼ばれる。
     * 中断した左ドラッグ（本体ドラッグ・moveハンドル・ハンドル変形）で頂点・位置の変化が残った場合は、#finishLeftDrag()で
     * 1件の編集操作として記録先へ確定する（中断で残った変化も単独で取り消せるようにするため）。
     * 作成途中の図形の破棄・範囲選択の中断は編集操作として伝えない。
     * 受理条件：常に受け付ける（どの操作モード・入力状態からでも呼べる。何も進行していなければ何もしない）。
     * 中断するもの（setModeの中断処理と同一。#abortOngoingOperation()）：
     * ・パン・左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択。閾値以前を含む）のドラッグセッション。
     *   範囲選択は選択矩形を破棄して確定しない。ドラッグ中に反映済みの頂点・位置は取り消さず残る。
     * ・作成途中の図形（cancelDraft()で破棄してIDLE状態へ戻す）。
     * 変更しないもの：操作モード・図形種別・選択集合・ホバー状態（これらのクリアは呼び出し側・replaceAllShapesの責務）、
     * スペース押下状態（キーの物理状態であり進行中操作ではないため）。
     * 最後にカーソル形状を再評価する。
     * `performUndo`（`main.js`）がこの戻り値で作成途中の図形の破棄を判定している。中断する対象を増やす場合は`performUndo`の判定を見直す。
     * @returns {boolean} 何かを中断したらtrue（何も進行していなければfalse）
     */
    abortOngoingOperation() {
        const aborted = this.#abortOngoingOperation();
        this.#updateCursor();
        return aborted;
    }

    /**
     * 進行中の入力操作の中断処理の本体（setMode・abortOngoingOperationが共用する）。以下の順に処理する。
     * (1)ドラッグセッション（パン・左ドラッグ。閾値以前を含む）中であればDragTracker.cancel()で中断する
     * （onCancel経由で、パンは#finishPan()、左ドラッグは#onLeftDragCancel()によりIDLEへ戻る）。
     * (2)なおIDLE以外の状態（DRAWING。作成途中のままパンしていた場合を含む）であれば、cancelDraft()で作成途中の図形を
     * 破棄してIDLE状態へ戻す。
     * (3)最後に、何も進行していなくても常に#resetSnapState()で吸い付きの状態と表示を消す（戻り値には影響させない）。
     * カーソル形状の再評価は呼び出し側で行う（setModeはモード更新後に1回だけ評価するため）。
     * @returns {boolean} 何かを中断したらtrue
     */
    #abortOngoingOperation() {
        let aborted = false;

        if (this.#drag.isActive()) {
            this.#drag.cancel();
            aborted = true;
        }

        if (this.state !== InputState.IDLE) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
            aborted = true;
        }

        this.#resetSnapState();

        return aborted;
    }

    /**
     * 吸い付きの結果を表示に反映する。snapがあればmodel.setSnapPoint(snap.x, snap.y)、なければmodel.clearSnapPoint()。
     * SnapTargetはx・yだけを読み、他のプロパティは解釈しない。
     * @param {{x: number, y: number}|null} snap 吸い付いた端点（吸い付いていなければnull）
     */
    #showSnap(snap) {
        if (snap) {
            this.model.setSnapPoint(snap.x, snap.y);
        } else {
            this.model.clearSnapPoint();
        }
    }

    /**
     * 吸い付きの作業用フィールド（#drawStartSnap・#drawEndSnap・#dragEndpoint・#dragSnap）をnullに戻し、
     * 表示もmodel.clearSnapPoint()で消す。
     */
    #resetSnapState() {
        this.#drawStartSnap = null;
        this.#drawEndSnap = null;
        this.#dragEndpoint = null;
        this.#dragSnap = null;
        this.model.clearSnapPoint();
    }

    // ---- イベントハンドラ（キャンバス・document・windowの購読先） ----

    /**
     * mousemoveイベントのハンドラ。
     * IDLE状態かつ選択モード中のみ、カーソル位置を#classifyPointで1回だけ当たり分類し、その結果を
     * ホバー更新（bodyIdがあればModelへホバー登録、なければホバー解除）とカーソル形状の更新で共用する
     * （選択モード以外のIDLE状態では何もしない）。
     * DRAWING状態では、カーソル位置で吸い付きを照会して#drawEndSnapに保持・表示し、作成中の図形の終点を
     * 吸い付いていれば端点の座標、いなければカーソル位置に追従させる。
     * IDLE状態かつ図形作成モード中は、描く図形種別で吸い付きを照会して表示だけを更新する（直線以外では常に表示されない）。
     * Modelへ渡す座標・当たり判定に用いる座標はすべてワールド座標（getWorldCoordinate由来）。
     * ドラッグセッション中（パン・左ドラッグ。閾値以前を含む）は何もしない。追従はDragTrackerのonMoveが担い
     * （パンは#beginPan、左ドラッグは#applyLeftDragUpdate）、ホバー判定・作成途中図形の更新は走らせない。
     * パン中はカーソル下のワールド点がカーソルに追従するため、パン終了後の次のmousemoveから作成途中図形の終点は
     * 従来どおりカーソルに追従する。
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (this.#drag.isActive()) {
            return;
        }

        if (this.state === InputState.DRAWING) {
            const { x, y } = this.getWorldCoordinate(event);
            const snap = this.#snapAssist.findDrawSnap(this.currentShapeType, { x, y });
            this.#drawEndSnap = snap;
            this.#showSnap(snap);
            this.model.updateDraft(snap ? snap.x : x, snap ? snap.y : y);
            return;
        }

        if (this.state === InputState.IDLE && this.currentMode === OperationMode.CREATE) {
            this.#showSnap(this.#snapAssist.findDrawSnap(this.currentShapeType, this.getWorldCoordinate(event)));
            return;
        }

        if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) {
            return;
        }

        const hit = this.#classifyPoint(this.getWorldCoordinate(event));

        if (hit.bodyId) {
            this.model.setHovered(hit.bodyId);
        } else {
            this.model.clearHovered();
        }

        this.#updateCursor(hit);
    }

    /**
     * mousedownイベントのハンドラ。以下の順に判定する。
     * (1)前回のドラッグのclick抑止フラグの残留をDragTracker.clearSuppressedClick()で解除する。
     * (2)中ボタンはpreventDefault()（オートスクロール抑止）したうえで、ドラッグセッション中でなければパンを開始して終了する
     * （セッション中＝パン中・左ドラッグ中はパンせず終了）。
     * (3)ドラッグセッション中（パン・左ドラッグ。閾値以前を含む）なら何もしない（セッションは同時に1つのみ）。
     * (4)左ボタンでスペース押下中またはキャンバス移動モードならパンを開始する。パンはDRAWING状態・作成途中図形を保持したまま行う。
     * (5)左ボタン以外（右ボタン等）なら何もしない（右ボタンで左ドラッグを開始しない）。
     * (5a)IDLE状態かつ選択モード中で、注入された補助のisPickingShape()が真（クリックした図形を外へ渡す待ち受け中）なら、
     * 当たり分類の前に何もせず終了する（左ボタンの押下で何も始めない。(2)(4)のパンは先に判定済みのため働く）。
     * (6)IDLE状態かつ選択モード中のみ、押下点（ワールド座標）を#classifyPointで当たり分類し、以下の表で分岐する
     * （左ドラッグは#beginLeftDragで開始し、閾値以内で離した場合は離した後のclickで判定する。
     * MOVING_SELECTIONの2か所は#beginMoveSelection経由で開始し、開始できたときに押した時点のevent.altKeyを記憶する
     * （Alt+ドラッグの複製の判定。Altを見るのは押した時点だけで、頂点のハンドル・範囲選択では記憶しない））：
     * ・ハンドルあり・'move'            → MOVING_SELECTION（moveハンドル。選択集合の全図形を平行移動。#beginMoveSelection経由）
     * ・ハンドルあり・それ以外（頂点）   → DRAGGING_HANDLE（そのハンドルが属する1図形の頂点のみ変形）
     * ・本体（bodyId）が選択集合内       → MOVING_SELECTION（本体ドラッグ。単一選択でも有効。#beginMoveSelection経由）
     * ・本体（bodyId）が選択集合外       → 遷移しない（セッションも開始しない。離した後のclickで判定する）
     * ・空白                             → MARQUEE_SELECTING（範囲選択。押下点を#marqueeAnchorに記憶）
     * スペース押下中・中ボタン・キャンバス移動モードは(2)(4)のパン判定が先に成立するため、範囲選択は起きない。
     * この分岐の表はCtrlで変えない（Ctrlは閾値以内で離した後のclickと範囲選択の確定でのみ見る）。
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        this.#drag.clearSuppressedClick();

        if (event.button === 1) {
            event.preventDefault();
            if (!this.#drag.isActive()) {
                this.#beginPan(event);
            }
            return;
        }

        if (this.#drag.isActive()) {
            return;
        }

        if (event.button === 0 && (this.#isSpacePressed || this.currentMode === OperationMode.PAN)) {
            this.#beginPan(event);
            return;
        }

        if (event.button !== 0) {
            return;
        }

        if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) {
            return;
        }

        if (this.#inputAssist.isPickingShape()) {
            return;
        }

        const point = this.getWorldCoordinate(event);
        const hit = this.#classifyPoint(point);

        if (hit.handle) {
            if (hit.handle.handle === 'move') {
                this.#beginMoveSelection(event, point);
            } else {
                this.#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, hit.handle);
            }
            return;
        }

        if (hit.bodyId && this.model.isSelected(hit.bodyId)) {
            this.#beginMoveSelection(event, point);
            return;
        }

        if (hit.bodyId === null) {
            this.#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point);
        }
    }

    /**
     * clickイベントのハンドラ。
     * DRAWING状態では、まず注入された吸い付きの補助のcommitDrawnLine(#drawStartSnap, #drawEndSnap)を呼ぶ
     * （描き終えの端点は、クリック位置で取り直さず直前のmousemoveで照会した#drawEndSnapを使う）。
     * trueなら補助が反映済み（記録も補助側）。falseのときだけ従来どおり、作成中の図形を確定登録する。
     * 確定登録（commitDraft）の直前に記録先のbeginEdit()、直後にcommitEdit()を呼び、図形の作成を1件の編集操作として伝える
     * （作成の開始・作成途中の破棄は伝えない）。その後IDLE状態へ遷移し、#resetSnapState()で吸い付きの状態と表示を消す。
     * IDLE状態かつ図形作成モード中の描き始めは、クリック位置で吸い付きを照会し（ホバー状態は参照しない）、
     * 結果を#drawStartSnapに保持・表示し、吸い付いていれば端点の座標、いなければクリック位置でstartDraftする。
     * IDLE状態かつ選択モード中では、クリック位置を#classifyPointで当たり分類し（ホバー状態は参照しない）、
     * 当たり分類の直後・ハンドルの判定より前に、注入された補助のisPickingShape()が真（クリックした図形を外へ渡す待ち受け中）なら、
     * 当たった本体のid（hit.bodyId）があればpickShape(bodyId)を呼び、いずれにしても終了する（選択は変えない。Ctrlも見ない。
     * 空白では何もしない）。待ち受けでなければ、
     * 選択集合の図形のハンドル上なら何もしない（選択集合を維持。Ctrlの有無によらない）。それ以外は、選択集合・当たった本体のid・
     * Ctrlの有無（hasCtrlModifier。見るのはclickイベント＝確定の時点）をSelectionRulesのresolveClickSelectionへ渡し、結果を#applySelectionChangeで反映する。
     * Ctrlなし：図形の本体上ならその図形のみの単一選択（setSelection([bodyId])）、空白なら選択集合が空でなければ全解除（clearSelection()）。
     * Ctrlあり：本体上なら選択集合へ1つ追加、選択中の図形なら外す（ほかの選択は残る）。空白では何もしない（解除しない）。
     * 押下時の分岐（handleMouseDown）はCtrlで変えないため、選択中の図形をCtrlで押して閾値以内で離すと、このclickで「選択中なら外す」になる
     * （閾値を超えて動かした場合は移動し、直後のclickは抑止される）。
     * IDLE状態かつ図形作成モード中では、Modelへ新規図形作成の開始を指示してDRAWING状態へ遷移する。
     * 作成する図形のtypeには、現在記憶している図形種別（currentShapeType）をそのまま使用し、
     * 作成開始位置はクリック位置のワールド座標とする。
     * 選択モード・図形作成モード以外のモードでは、IDLE状態のクリックを無視する。
     * 左ボタンのパン（スペース＋左ドラッグ・キャンバス移動モード）終了直後、および閾値を超えて動かした左ドラッグの
     * 終了直後のclickは、DragTrackerのclick抑止フラグをconsumeSuppressedClick()で消費したうえで1回だけ無視する
     * （作成開始・確定・選択・選択解除を起こさない）。左ドラッグを閾値以内で離した場合のclickは抑止せず、上記の通常処理を行う
     * （ハンドル上で離した場合は選択集合を維持し、選択集合内の図形の本体上で離した場合はその図形のみの単一選択になる）。
     * @param {MouseEvent} event
     */
    handleClick(event) {
        if (this.#drag.consumeSuppressedClick()) {
            return;
        }

        if (this.state === InputState.DRAWING) {
            if (!this.#snapAssist.commitDrawnLine(this.#drawStartSnap, this.#drawEndSnap)) {
                this.#editRecorder.beginEdit();
                this.model.commitDraft();
                this.#editRecorder.commitEdit();
            }
            this.state = InputState.IDLE;
            this.#resetSnapState();
            return;
        }

        if (this.state !== InputState.IDLE) {
            return;
        }

        const { x, y } = this.getWorldCoordinate(event);

        if (this.currentMode === OperationMode.SELECT) {
            const hit = this.#classifyPoint({ x, y });
            if (this.#inputAssist.isPickingShape()) {
                if (hit.bodyId) {
                    this.#inputAssist.pickShape(hit.bodyId);
                }
                return;
            }
            if (hit.handle) {
                return;
            }
            this.#applySelectionChange(
                resolveClickSelection(this.model.getSelectedIds(), hit.bodyId, hasCtrlModifier(event)),
            );
            return;
        }

        if (this.currentMode === OperationMode.CREATE) {
            const snap = this.#snapAssist.findDrawSnap(this.currentShapeType, { x, y });
            this.#drawStartSnap = snap;
            this.#showSnap(snap);
            this.model.startDraft(snap ? snap.x : x, snap ? snap.y : y, this.currentShapeType);
            this.state = InputState.DRAWING;
        }
    }

    /**
     * keydownイベントのハンドラ。documentへ購読する（<canvas>要素はデフォルトでフォーカスを
     * 持てずキーボードイベントを受け取れないため）。
     * keydownはSpace（スペースパン）のみを解釈し、操作モードによらず#handleSpaceKeyDownへ委譲する。
     * それ以外のキー（Delete/Backspaceを含む）はKeyboardShortcutsが担当し、同一キーを二重に解釈しない。
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (event.code !== 'Space') {
            return;
        }
        this.#handleSpaceKeyDown(event);
    }

    /**
     * keyupイベントのハンドラ。documentへ購読する。
     * Spaceキーの解放時のみ、スペース押下状態を解除してカーソル形状を再評価する。
     * テキスト入力中（isTextInputElement）でもSpaceを部品に譲る要素（isSpaceYieldedElement。
     * checkbox・colorのinputとON/OFFのボタン）でもなければ
     * preventDefault()する（フォーカス中のボタンのスペース解放による誤クリックの抑止。部品の操作は妨げない）。
     * 欄にフォーカスがあっても押下状態の解除・カーソルの再評価は常に行う（残留防止）。
     * 解放時点でパンのドラッグ中だった場合、そのドラッグはマウスボタンを離すまで継続する
     * （ドラッグ途中で選択・作成の挙動に切り替わる不整合を避けるため）。
     * @param {KeyboardEvent} event
     */
    handleKeyUp(event) {
        if (event.code !== 'Space') {
            return;
        }

        if (!isTextInputElement(document.activeElement) && !isSpaceYieldedElement(document.activeElement)) {
            event.preventDefault();
        }

        this.#isSpacePressed = false;
        this.#updateCursor();
    }

    /**
     * wheelイベントのハンドラ。キャンバスへ{ passive: false }で購読する。
     * ページスクロール・Ctrl+ホイールのブラウザズームをpreventDefault()で抑止したうえで、
     * カーソル位置を中心にズームする（ViewTransform.zoomAt()へ委譲。倍率のクランプ・再描画通知も同クラスが担う）。
     * 操作モード・入力状態によらず常に有効（DRAWING・左ドラッグ中も、カーソル下のワールド点は不変）。
     * ズーム方向はdeltaYの符号のみで決め（負：拡大、正：縮小）、大きさは用いない。deltaYが0（横スクロールのみ）なら何もしない。
     * ズーム中心はスクリーン座標（getScreenCoordinate由来）。ズーム後のホバー・カーソル形状は次のmousemoveで再評価する。
     * 左ドラッグ中（閾値超過後）は、ズーム直後にホイールイベントの座標で#applyLeftDragUpdateを呼び、
     * ドラッグ対象をズーム後のカーソル位置へ追従し直す（パン中・閾値以前は何もしない。本体ドラッグではホイールイベントの
     * shiftKeyでも移動方向を限定し、ctrlKey・metaKeyでも丸めを省く）。範囲選択中は、押下点のワールド位置を
     * 固定したまま選択矩形をズーム後のカーソル位置まで伸ばし直す。
     * @param {WheelEvent} event
     */
    handleWheel(event) {
        event.preventDefault();

        if (event.deltaY === 0) {
            return;
        }

        const factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP;
        const { x, y } = this.getScreenCoordinate(event);
        this.viewTransform.zoomAt(x, y, factor);

        if (this.#drag.hasMoved() && this.#isLeftDragState()) {
            this.#applyLeftDragUpdate(event);
        }
    }

    /**
     * windowのblurイベントのハンドラ（タブ切替・ウィンドウ非アクティブ化）。
     * keyupを取りこぼしても状態が残らないよう、スペース押下状態を解除してカーソル形状を再評価する。
     * ドラッグ（パン・左ドラッグ）の中断（とclick抑止フラグの解除）はDragTracker自身のblur購読が担うため、ここでは扱わない。
     */
    #handleWindowBlur() {
        this.#isSpacePressed = false;
        this.#updateCursor();
    }

    // ---- 左ドラッグ（ハンドルドラッグ・選択集合の平行移動・範囲選択） ----

    /**
     * 現在のInputStateが左ドラッグ（DragTrackerのセッションで追従する選択モードのドラッグ）の状態かを返す。
     * DRAGGING_HANDLE・MOVING_SELECTION・MARQUEE_SELECTING。パン（InputStateと直交する）は含まない。
     * @returns {boolean}
     */
    #isLeftDragState() {
        return (
            this.state === InputState.DRAGGING_HANDLE ||
            this.state === InputState.MOVING_SELECTION ||
            this.state === InputState.MARQUEE_SELECTING
        );
    }

    /**
     * 左ドラッグ（頂点ハンドルのドラッグ、選択集合の平行移動、または範囲選択）を開始する。handleMouseDownから左ボタン押下時に呼ばれる。
     * DragTrackerのセッションを閾値DRAG_START_THRESHOLD（スクリーンpx）・click抑止'whenMoved'（閾値を超えて動かした場合のみ
     * 直後のclickを抑止）で開始し、成功した場合のみ次を記憶してnextStateへ遷移し、カーソル形状を更新する。
     * MARQUEE_SELECTINGなら押下点#marqueeAnchor、MOVING_SELECTIONなら押下点#moveOriginと反映済みの移動量#appliedMoveDelta（{ dx: 0, dy: 0 }）、
     * DRAGGING_HANDLEなら操作対象のハンドル名・図形id。閾値以内では図形・選択矩形は変化しない。
     * 追従（onMove）は#applyLeftDragUpdate、開始（onStart）は#onLeftDragStart、
     * 終了（onEnd：左ボタンの解放）は#onLeftDragEnd、中断（onCancel：blur・setMode・abortOngoingOperation）は#onLeftDragCancelが担う。
     * DRAGGING_HANDLEで開始できたときは、注入された補助のresolveDragEndpoint(図形id, ハンドル名)で端点のハンドルかを解決し、
     * 端点なら#dragEndpoint（{ shapeId, end }）に、そうでなければnullにする（頂点の番号の規約は補助側が持つ）。
     * @param {MouseEvent} event ドラッグを開始したmousedownイベント
     * @param {'DRAGGING_HANDLE'|'MOVING_SELECTION'|'MARQUEE_SELECTING'} nextState 遷移先の状態（InputStateの値）
     * @param {{x: number, y: number}} point 押下点（ワールド座標）
     * @param {{shapeId: string, handle: string} | null} [target=null] DRAGGING_HANDLEの操作対象（頂点ハンドルが属する図形のid（単一）と
     *     ハンドル名）。MOVING_SELECTION（選択集合の全図形が対象）・MARQUEE_SELECTINGでは不要
     * @returns {boolean} 開始できたか（DragTrackerがセッション中で開始できなかった場合はfalseで、何も記憶・遷移しない）
     */
    #beginLeftDrag(event, nextState, point, target = null) {
        const started = this.#drag.begin(
            event,
            {
                onStart: () => this.#onLeftDragStart(),
                onMove: (e) => this.#applyLeftDragUpdate(e),
                onEnd: (e, moved) => this.#onLeftDragEnd(e, moved),
                onCancel: () => this.#onLeftDragCancel(),
            },
            { threshold: DRAG_START_THRESHOLD, suppressClick: 'whenMoved' },
        );
        if (!started) {
            return false;
        }

        const isMarquee = nextState === InputState.MARQUEE_SELECTING;
        this.activeHandle = target?.handle ?? null;
        this.activeShapeId = target?.shapeId ?? null;
        const isMoving = nextState === InputState.MOVING_SELECTION;
        this.#moveOrigin = isMoving ? point : null;
        this.#appliedMoveDelta = isMoving ? { dx: 0, dy: 0 } : null;
        this.#marqueeAnchor = isMarquee ? point : null;
        this.#dragEndpoint = null;
        this.#dragSnap = null;
        if (nextState === InputState.DRAGGING_HANDLE && target) {
            const end = this.#snapAssist.resolveDragEndpoint(target.shapeId, target.handle);
            this.#dragEndpoint = end ? { shapeId: target.shapeId, end } : null;
        }
        this.state = nextState;
        this.#updateCursor();
        return true;
    }

    /**
     * 選択集合の平行移動のドラッグ（MOVING_SELECTION。moveハンドル・選択中の図形の本体）を開始する。handleMouseDownから呼ばれる。
     * #beginLeftDragの戻り値（開始できたか）が真のときだけ、押した時点のevent.altKeyを#duplicateOnMoveへ記憶する
     * （閾値超過時に#onLeftDragStartが複製を呼ぶ。押した後のAltは見ない）。
     * @param {MouseEvent} event ドラッグを開始したmousedownイベント
     * @param {{x: number, y: number}} point 押下点（ワールド座標）
     */
    #beginMoveSelection(event, point) {
        if (this.#beginLeftDrag(event, InputState.MOVING_SELECTION, point)) {
            this.#duplicateOnMove = Boolean(event.altKey);
        }
    }

    /**
     * 左ドラッグの移動量が閾値を超えた時点の処理（DragTrackerのonStart）。
     * 状態がMOVING_SELECTION（本体ドラッグ・moveハンドル）またはDRAGGING_HANDLE（ハンドル変形）のときのみ、記録先の
     * beginEdit()を呼んで#isEditOpenを立てる（まだ図形は動いていない時点の状態が「前の状態」になる。確定は#finishLeftDrag()）。
     * その後、MOVING_SELECTIONかつ#duplicateOnMove（Alt+ドラッグ）なら注入された補助のduplicateSelection()を呼ぶ
     * （開いた編集操作の中で複製し、以後の追従は複製を動かす。閾値以内で離したときは本メソッドが呼ばれないため複製しない）。
     * MARQUEE_SELECTING（範囲選択）では呼ばない（編集操作ではないため）。閾値以内で離した場合は本メソッドが呼ばれないため記録しない。
     * 状態は押下時（#beginLeftDrag）に遷移済みである（DragTracker.begin()はonStartを同期的に呼ばず、閾値超過時のmousemoveで呼ぶ）。
     * あわせて、押下前のホバー表示が古いまま残らないようホバー状態をクリアし、カーソル形状を更新する。
     */
    #onLeftDragStart() {
        if (this.state === InputState.MOVING_SELECTION || this.state === InputState.DRAGGING_HANDLE) {
            this.#editRecorder.beginEdit();
            this.#isEditOpen = true;
            if (this.state === InputState.MOVING_SELECTION && this.#duplicateOnMove) {
                this.#inputAssist.duplicateSelection();
            }
        }
        this.model.clearHovered();
        this.#updateCursor();
    }

    /**
     * 左ドラッグの追従処理（DragTrackerのonMove、およびドラッグ中のhandleWheelから呼ばれる）。
     * InputStateで処理を振り分けるディスパッチャ（図形種別の分岐ではない）：
     * MOVING_SELECTIONなら押した位置（#moveOrigin）からの移動量（ワールド座標）を求め、#resolveMoveDeltaで加工した目標の移動量と
     * 反映済みの移動量（#appliedMoveDelta）との差分を選択集合の全図形へ一括で渡し（moveShapes。更新1回につき1回で、差分0でも呼ぶ。
     * 変更通知は1回）、反映済みの移動量を目標の移動量へ更新する。閾値分の移動量は閾値超過時の最初の更新でまとめて反映される。
     * Shiftを見るのは追従のたびの本イベント（mousemove・ドラッグ中のwheelのshiftKey。キーの購読はしない）。
     * Ctrlも同じイベントで見る（#resolveMoveDeltaが丸めを省く）。
     * ズーム直後のwheelでも同じ式で、ズーム後のカーソル位置へ追従し直す（Shiftを押している間は限定されたまま）。
     * MARQUEE_SELECTINGなら押下点（#marqueeAnchor）と現在のカーソル位置（いずれもワールド座標）を対角2点として
     * 選択矩形をModelへ設定する（正規化しない。選択集合は確定時まで変更しない）。
     * DRAGGING_HANDLEならshape.getVertexIndexForHandle()で頂点インデックスを解決して現在のワールド座標をModelへ渡す
     * （その1図形のみ。選択集合は変更しない）。対象図形が存在しない場合は何もしない。
     * 端点のハンドル（#dragEndpointあり）なら、頂点を渡す前に注入された補助のfindDragSnap(#dragEndpoint, カーソル位置)で
     * 吸い付きを照会して#dragSnapに保持・表示し、吸い付いていればその端点の座標、いなければカーソル位置を頂点の座標にする。
     * @param {MouseEvent} event カーソル位置とshiftKeyを持つイベント（window captureのmousemove、またはwheel。shiftKey・Ctrlの有無はMOVING_SELECTIONの移動方向の限定・丸めにのみ使う）
     */
    #applyLeftDragUpdate(event) {
        if (!this.#isLeftDragState()) {
            return;
        }

        const { x, y } = this.getWorldCoordinate(event);

        if (this.state === InputState.MARQUEE_SELECTING) {
            this.model.setSelectionRect(this.#marqueeAnchor.x, this.#marqueeAnchor.y, x, y);
            return;
        }

        if (this.state === InputState.MOVING_SELECTION) {
            const target = this.#resolveMoveDelta({ dx: x - this.#moveOrigin.x, dy: y - this.#moveOrigin.y }, event);
            const applied = this.#appliedMoveDelta;
            this.model.moveShapes(this.model.getSelectedIds(), target.dx - applied.dx, target.dy - applied.dy);
            this.#appliedMoveDelta = target;
            return;
        }

        const shape = this.model.getShapes().find((s) => s.id === this.activeShapeId);
        if (!shape) {
            return;
        }
        const vertexIndex = shape.getVertexIndexForHandle(this.activeHandle);
        let target = { x, y };
        if (this.#dragEndpoint) {
            const snap = this.#snapAssist.findDragSnap(this.#dragEndpoint, target);
            this.#dragSnap = snap;
            this.#showSnap(snap);
            if (snap) {
                target = snap;
            }
        }
        this.model.updateVertex(this.activeShapeId, vertexIndex, target.x, target.y);
    }

    /**
     * 本体ドラッグの「押した位置からの移動量」を加工して目標の移動量にする（**押した位置からの移動量を加工する唯一の箇所**）。
     * 順序は 移動量 → Shiftなら横・縦・斜め45°の直線へ限定（MoveDirectionRulesのconstrainMoveDirection）→ スナップの丸め。
     * 丸めの刻みは注入された補助のgetUnitSnapStep()を、Ctrl（hasCtrlModifier。追従のイベントで見る）と組み合わせて
     * UnitSnapRulesのresolveUnitSnapStepで決める（Ctrlの間は丸めない。Shiftの限定は効く）。
     * Shift時は限定した直線の上に保つ丸め（roundConstrainedDeltaToUnit）、そうでなければ軸ごとの丸め（roundDeltaToUnit）。
     * @param {{dx: number, dy: number}} rawDelta 押した位置からの移動量（ワールド座標）
     * @param {MouseEvent} event カーソル位置とshiftKey・ctrlKey・metaKeyを持つ追従のイベント（mousemoveまたはwheel）
     * @returns {{dx: number, dy: number}} 加工後の目標の移動量
     */
    #resolveMoveDelta(rawDelta, event) {
        const step = resolveUnitSnapStep(this.#inputAssist.getUnitSnapStep(), hasCtrlModifier(event));
        if (event.shiftKey) {
            return roundConstrainedDeltaToUnit(constrainMoveDirection(rawDelta.dx, rawDelta.dy), step);
        }
        return roundDeltaToUnit(rawDelta, step);
    }

    /**
     * 左ドラッグの終了処理（DragTrackerのonEnd：開始ボタン（左）の解放、またはbuttonsによる解放の検知）。
     * MARQUEE_SELECTINGかつ閾値を超えて動かしていた場合のみ#commitMarqueeで範囲選択を確定し、その後#finishLeftDragで後始末する。
     * 閾値以内で離した範囲選択は何も確定しない（直後のclickが通常の空白クリック＝全解除として処理される）。
     * DRAGGING_HANDLEで閾値を超えて動かし、#dragEndpointと#dragSnap（離す直前に吸い付いていた端点）がともにあるときは、
     * #finishLeftDragの前に注入された補助のjoinDraggedEndpoint(#dragEndpoint, #dragSnap)を呼ぶ（結合・閉じる）。
     * この反映は閾値超過時にbeginEdit()済みの編集操作の中で行われ、#finishLeftDragのcommitEdit()で頂点の移動とあわせて1件になる。
     * 吸い付いていなければ従来どおり頂点を動かしただけで終わる（中断の#onLeftDragCancelでは結合しない）。
     * @param {MouseEvent} event 終了のきっかけとなったイベント（通常はmouseup。buttons検知時はmousemove）。範囲選択のCtrlはこのイベントから読む
     * @param {boolean} moved 閾値を超えて動かしたか
     */
    #onLeftDragEnd(event, moved) {
        if (this.state === InputState.MARQUEE_SELECTING && moved) {
            this.#commitMarquee(event);
        }
        if (this.state === InputState.DRAGGING_HANDLE && moved && this.#dragEndpoint && this.#dragSnap) {
            this.#snapAssist.joinDraggedEndpoint(this.#dragEndpoint, this.#dragSnap);
        }
        this.#finishLeftDrag();
    }

    /**
     * 左ドラッグの中断処理（DragTrackerのonCancel：window blur・setMode・abortOngoingOperationによる強制中断）。
     * MARQUEE_SELECTINGなら選択矩形を破棄するのみで選択集合は変更しない（確定しない）。その後#finishLeftDragで後始末する。
     */
    #onLeftDragCancel() {
        if (this.state === InputState.MARQUEE_SELECTING) {
            this.model.clearSelectionRect();
        }
        this.#finishLeftDrag();
    }

    /**
     * 範囲選択を確定する。#onLeftDragEndから、閾値を超えて動かした範囲選択の終了時にのみ呼ばれる。
     * 押下点（#marqueeAnchor）と終了位置（イベントのワールド座標。キャンバス外で離してもキャンバス左上基準で求まる）から
     * 選択矩形を正規化し（**矩形の正規化を行う唯一の箇所**。Modelの選択矩形・描画側では正規化しない）、
     * 全図形のshape.intersectsRect(minX, minY, maxX, maxY)（ワールド座標・正規化済み）をポリモーフィックに呼んで、
     * 輪郭線が矩形に掛かる図形のidを求め、選択集合・求めたid・Ctrlの有無（hasCtrlModifier。見るのは終了のイベント＝確定の時点）を
     * SelectionRulesのresolveMarqueeSelectionへ渡し、結果を#applySelectionChangeで反映する。図形種別の分岐は持たない。
     * Ctrlなし：選択集合を置き換える（0件なら空集合）。Ctrlあり：選択集合へ追加する（重複しない。0件なら選択を変えない）。
     * Modelへの変更通知は選択矩形の破棄と選択集合の置き換えの2回（図形数に比例しない。Ctrlありで0件のときは選択の通知なし）。
     * @param {MouseEvent} event 範囲選択を終了したイベント（通常はmouseup。buttons検知による終了時はmousemove）。Ctrlはこのイベントから読む
     */
    #commitMarquee(event) {
        const anchor = this.#marqueeAnchor;
        const end = this.getWorldCoordinate(event);

        const minX = Math.min(anchor.x, end.x);
        const maxX = Math.max(anchor.x, end.x);
        const minY = Math.min(anchor.y, end.y);
        const maxY = Math.max(anchor.y, end.y);

        const ids = this.model
            .getShapes()
            .filter((shape) => shape.intersectsRect(minX, minY, maxX, maxY))
            .map((shape) => shape.id);

        this.model.clearSelectionRect();
        this.#applySelectionChange(
            resolveMarqueeSelection(this.model.getSelectedIds(), ids, hasCtrlModifier(event)),
        );
    }

    /**
     * 選択の規則（SelectionRules）が返した結果をModelへ反映する（受け渡しのみ。判定は持たない）。
     * @param {import('./SelectionRules.js').SelectionChange|null} change nullなら何もしない、'clear'ならclearSelection()、'set'ならsetSelection(change.ids)
     */
    #applySelectionChange(change) {
        if (change === null) {
            return;
        }
        if (change.type === 'clear') {
            this.model.clearSelection();
            return;
        }
        this.model.setSelection(change.ids);
    }

    /**
     * 左ドラッグの終了・中断時の後始末（#onLeftDragEnd・#onLeftDragCancelから呼ばれる）。
     * IDLE状態へ戻し、作業用フィールド（activeHandle・activeShapeId・#moveOrigin・#appliedMoveDelta・#marqueeAnchor）をnullに、#duplicateOnMoveをfalseにして、
     * カーソル形状を再評価する。ドラッグ中に反映した変更（頂点・位置）は取り消さない。
     * 範囲選択の確定・選択矩形の破棄は呼び出し前に済ませること。click抑止フラグの管理はDragTrackerが担う。
     * 冒頭で、#isEditOpenが立っていれば（閾値超過時にbeginEdit()済みの移動・変形）記録先のcommitEdit()を呼んで下ろす
     * （編集操作の終了・中断の共通の確定箇所。中断で残った変化も1件として記録される。結果が開始前と同一なら記録先が記録しない）。
     * 確定の後、#resetSnapState()で吸い付きの作業用フィールド（#dragEndpoint・#dragSnapを含む）と表示を消す。
     */
    #finishLeftDrag() {
        if (this.#isEditOpen) {
            this.#editRecorder.commitEdit();
            this.#isEditOpen = false;
        }
        this.#resetSnapState();
        this.state = InputState.IDLE;
        this.activeHandle = null;
        this.activeShapeId = null;
        this.#moveOrigin = null;
        this.#appliedMoveDelta = null;
        this.#duplicateOnMove = false;
        this.#marqueeAnchor = null;
        this.#updateCursor();
    }

    // ---- パン（中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モード） ----

    /**
     * パンのドラッグを開始する。handleMouseDownから呼ばれる。
     * DragTrackerのセッションを閾値0・click抑止'always'（左ボタンのパン後のclickは移動の有無によらず抑止。
     * 中ボタンはDragTracker側の規則によりclick抑止しない）で開始し、パン中フラグを立て、
     * 選択モード中のホバー表示が古いまま残らないようホバー状態をクリアして、カーソルをgrabbingにする。
     * 追従（onMove）では現在位置と直前位置の差分（スクリーン座標。キャンバス外でもキャンバス左上基準）を
     * ViewTransform.panBy()へ渡す（再描画通知は同クラスが担う）。開始ボタンの解放（onEnd）・
     * blur/setMode/abortOngoingOperationによる中断（onCancel）で#finishPan()する。
     * InputState（DRAWING状態）・作成途中図形には触れない。
     * DragTrackerがセッション中で開始できなかった場合は何もしない。
     * 開始できたときは吸い付きの表示の点もmodel.clearSnapPoint()で消す（パン中は表示が古くなるため）。
     * DRAWINGの#drawEndSnapは作成途中の図形の終点と対応させるため残す（表示だけを消す）。
     * @param {MouseEvent} event パンを開始したmousedownイベント
     */
    #beginPan(event) {
        const started = this.#drag.begin(
            event,
            {
                onMove: (e, screen, prevScreen) =>
                    this.viewTransform.panBy(screen.x - prevScreen.x, screen.y - prevScreen.y),
                onEnd: () => this.#finishPan(),
                onCancel: () => this.#finishPan(),
            },
            { threshold: 0, suppressClick: 'always' },
        );
        if (!started) {
            return;
        }

        this.#isPanning = true;
        this.model.clearHovered();
        this.model.clearSnapPoint();
        this.#updateCursor();
    }

    /**
     * パンの終了処理。DragTrackerのonEnd（開始ボタンの解放）・onCancel（blur・setMode・abortOngoingOperationによる中断）から呼ばれる。
     * パン中フラグを解除し、カーソル形状を再評価する（click抑止フラグの管理はDragTrackerが担う）。
     */
    #finishPan() {
        this.#isPanning = false;
        this.#updateCursor();
    }

    /**
     * handleKeyDownから委譲されるSpaceキー押下の処理。
     * テキスト入力中（isTextInputElement）、またはSpaceを部品に譲る要素（isSpaceYieldedElement。
     * checkbox・colorのinputとON/OFFのボタン）にフォーカスがあるなら、文字入力・部品の操作を妨げないため何もしない（preventDefaultもしない）。
     * それ以外はpreventDefault()（ページスクロール、およびフォーカス中のボタンのスペース押下による誤クリックの抑止）し、
     * 初回押下時のみスペース押下状態にしてカーソル形状を再評価する（キーリピートでは状態を二重に変えない）。
     * @param {KeyboardEvent} event
     */
    #handleSpaceKeyDown(event) {
        if (isTextInputElement(document.activeElement) || isSpaceYieldedElement(document.activeElement)) {
            return;
        }

        event.preventDefault();

        if (this.#isSpacePressed) {
            return;
        }

        this.#isSpacePressed = true;
        this.#updateCursor();
    }

    // ---- 当たり分類 ----

    /**
     * 指定位置の当たり分類を行う。ホバー（handleMouseMove）・押下（handleMouseDown）・クリック（handleClick）・
     * カーソル形状（#resolveCursor）で共通に用いる（クリック時に古いホバー状態へ依存しないため）。
     * 規則の正本はPointHitRules.classifyPointHit。本メソッドはモデルの図形配列・選択中かの照会・座標・許容誤差を渡して結果を返すだけで、
     * 図形のメソッド（hitTest・hitTestHandle・hitTestFill）を直接呼ばない。規則の要約：
     * ・ハンドル（今のまま）：選択集合の図形を対象に、図形配列の後ろ（前面）から最初に当たったハンドル。
     * ・本体：選択集合の図形の輪郭を手前優先で優先し、なければ手前から輪郭または塗った内側（選択集合の内側を優先しない）。
     *   塗った内側を当たりに含めるかは、注入された照会（#isFillHitExcluded）の否定をそのまま渡して決める（含めないときは輪郭だけ）。
     * 許容誤差は#getWorldHitTolerance()（画面上hitTolerance pxのワールド換算値）。
     * @param {{x: number, y: number}} point 判定位置（ワールド座標）
     * @returns {PointHit} 当たり分類の結果（handle・bodyIdともnullなら空白）
     */
    #classifyPoint(point) {
        return classifyPointHit(
            this.model.getShapes(),
            (id) => this.model.isSelected(id),
            point.x,
            point.y,
            this.#getWorldHitTolerance(),
            !this.#isFillHitExcluded()
        );
    }

    // ---- 座標取得 ----

    /**
     * マウスイベントから、キャンバス左上基準のスクリーン座標（CSSピクセル）を取得する。
     * CSSズームによる表示位置のずれを吸収する。ワールド座標が必要な場合はgetWorldCoordinateを用いる。
     * キャンバス外のイベントに対しても、キャンバス左上基準の座標を返す。
     * @param {MouseEvent} event
     * @returns {{x: number, y: number}} スクリーン座標
     */
    getScreenCoordinate(event) {
        const rect = this.canvas.getBoundingClientRect();

        // CSSでの表示サイズ（スクリーン座標のCSSピクセル）と実際のDOM要素サイズ（rect）の比率から
        // CSSのズーム等による表示位置ズレを完全に吸収してスクリーン座標へ逆換算する
        const scaleX = this.canvas.clientWidth / rect.width;
        const scaleY = this.canvas.clientHeight / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        return { x, y };
    }

    /**
     * マウスイベントから、図形データが扱うワールド座標を取得する。
     * getScreenCoordinateで得たスクリーン座標をViewTransform.screenToWorldで逆変換するのみ（変換式は持たない）。
     * @param {MouseEvent} event
     * @returns {{x: number, y: number}} ワールド座標
     */
    getWorldCoordinate(event) {
        const { x, y } = this.getScreenCoordinate(event);
        return this.viewTransform.screenToWorld(x, y);
    }

    /**
     * 当たり判定の許容誤差（画面上hitTolerance px）を、現在の表示倍率でワールド長へ換算して返す。
     * hitTest/hitTestHandleの第3引数に用いる。
     * @returns {number} ワールド座標系での許容誤差
     */
    #getWorldHitTolerance() {
        return this.viewTransform.screenLengthToWorld(this.hitTolerance);
    }

    // ---- カーソル形状 ----

    /**
     * 現在の操作モード・入力状態・カーソル位置の当たり分類から、キャンバスに適用すべきCSS cursor値を判定する。
     * DOMには触れない純粋な判定関数。判定順序：
     * (0a)パンのドラッグ中 → 'grabbing'、
     * (0b)スペース押下中かつ左ドラッグ状態（DRAGGING_HANDLE/MOVING_SELECTION/MARQUEE_SELECTING）でない → 'grab'
     * （左ドラッグ中はパンを開始しないため除外し、ドラッグ中のカーソルを維持）、
     * (1)図形作成モード → 'crosshair'（作成途中を含む）、
     * (2)キャンバス移動モード → 'grab'、
     * (3)選択モード以外のモード → 'default'（将来のモード追加時の既定値）、
     * (3a)クリックした図形を外へ渡す待ち受け中（注入された補助のisPickingShape()が真） → 'cell'（パン中・スペース押下中の
     * 'grabbing'・'grab'は先に判定されるため優先順は変わらない）、
     * (4)DRAGGING_HANDLE・MOVING_SELECTION状態 → 'move'、
     * (5)MARQUEE_SELECTING状態 → 'default'、
     * (6)当たり分類なし（hit === null。座標不明） → 'default'、
     * (7)選択集合の図形のハンドル上（hit.handle） → 'move'、
     * (8)選択集合内の図形の本体上（hit.bodyIdが選択集合内） → 'move'、
     * (9)それ以外の図形の本体上（hit.bodyId） → 'pointer'、
     * (10)それ以外 → 'default'。
     * @param {PointHit | null} hit カーソル位置の当たり分類（#classifyPointの結果）。座標が不明なとき
     *     （setMode直後・パン開始/終了・左ドラッグ開始/終了・スペース押下/解放等）はnull
     * @returns {'grabbing'|'grab'|'crosshair'|'cell'|'move'|'pointer'|'default'} 適用すべきCSS cursor値
     */
    #resolveCursor(hit) {
        if (this.#isPanning) {
            return 'grabbing';
        }

        if (this.#isSpacePressed && !this.#isLeftDragState()) {
            return 'grab';
        }

        if (this.currentMode === OperationMode.CREATE) {
            return 'crosshair';
        }

        if (this.currentMode === OperationMode.PAN) {
            return 'grab';
        }

        if (this.currentMode !== OperationMode.SELECT) {
            return 'default';
        }

        if (this.#inputAssist.isPickingShape()) {
            return 'cell';
        }

        if (this.state === InputState.DRAGGING_HANDLE || this.state === InputState.MOVING_SELECTION) {
            return 'move';
        }

        if (this.state === InputState.MARQUEE_SELECTING) {
            return 'default';
        }

        if (hit === null) {
            return 'default';
        }

        if (hit.handle) {
            return 'move';
        }

        if (hit.bodyId && this.model.isSelected(hit.bodyId)) {
            return 'move';
        }

        if (hit.bodyId) {
            return 'pointer';
        }

        return 'default';
    }

    /**
     * #resolveCursor(hit)の判定結果をキャンバス要素のCSS cursorへ適用する。
     * @param {PointHit | null} [hit=null] カーソル位置の当たり分類（#classifyPointの結果）。座標が不明なときはnull
     */
    #updateCursor(hit = null) {
        this.canvas.style.cursor = this.#resolveCursor(hit);
    }
}
