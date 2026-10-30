/**
 * 責務：ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・一括削除・パン・ズーム）の解釈と
 * Model・ビュー変換への反映、および入力状態に応じたキャンバスのカーソル形状のフィードバックを担う。
 */

import { DragTracker } from './DragTracker.js';

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
 * handleもbodyIdもnullの場合は「空白」を表す。
 * @typedef {Object} PointHit
 * @property {{shapeId: string, handle: string} | null} handle
 *     選択集合の図形のハンドル（前面優先）。shapeId：ハンドルが属する図形のid（単一）、handle：hitTestHandleの戻り値
 * @property {string | null} bodyId
 *     本体（hitTest）が真の図形のid（単一）。選択集合の図形を優先し、同順位は図形配列の先頭
 */

/**
 * 操作モード。コントロールパネルの各ボタンはこの値に1対1で対応する。
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
 * 図形作成モードで作成可能な図形種別のホワイトリスト。setShapeType()の引数バリデーション
 * （includes()による受理判定）のみに用いる。図形種別ごとの分岐には用いない。
 * ※ShapeFactoryの受理種別と一致させること。
 * @type {ReadonlyArray<'line'|'curve'|'arc'|'rect'|'circle'>}
 */
export const SHAPE_TYPES = Object.freeze(['line', 'curve', 'arc', 'rect', 'circle']);

/**
 * ホイール1刻みあたりのズーム倍率（無次元）。拡大時はこの値を、縮小時はその逆数を
 * ViewTransform.zoomAt()のfactorとして渡す。
 * @type {number}
 */
const WHEEL_ZOOM_STEP = 1.1;

/**
 * クリックとドラッグを区別する移動量の閾値。スクリーン座標のCSSピクセル。
 * 左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）は、押下点からの移動距離がこれを超えた時点で初めて実際の操作を開始する
 * （DragTracker.begin()のthresholdとして渡す。パンには用いない）。
 * @type {number}
 */
const DRAG_START_THRESHOLD = 3;

/**
 * 要素がテキスト入力中とみなすべき要素（input / textarea / contenteditable）かを判定する。
 * キーボードショートカット（スペースパン、将来のDelete/Backspace等）の誤爆防止に用いる。
 * 現状はSpace判定にのみ使用し、Phase 02-04でDelete/Backspaceの誤爆対策に再利用する想定。
 * input要素はtype（button/checkbox等）を問わずテキスト入力扱いとする（保守的な判定）。select要素は含めない。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} テキスト入力中とみなすべき要素ならtrue
 */
export function isTextInputElement(element) {
    if (!(element instanceof HTMLElement)) {
        return false;
    }
    return element.tagName === 'INPUT' || element.tagName === 'TEXTAREA' || element.isContentEditable;
}

/**
 * キャンバスのマウス・キーボード入力を解釈し、VectorModelの対応APIを呼び出す状態遷移マシン
 * （IDLE / DRAWING / DRAGGING_HANDLE / MOVING_SELECTION / MARQUEE_SELECTING）。操作モード（currentMode）と
 * 図形種別（currentShapeType）を独立した状態として保持し、操作モード・入力状態・当たり分類（#classifyPoint）に応じて
 * キャンバスのカーソル形状を更新する。当たり分類はホバー・押下・クリック・カーソル形状の判定で共用する。
 * パン（中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モードの左ドラッグ）は、DRAWINGを保持したまま
 * 行えるよう、InputStateとは直交するprivateフラグ（パン中：#isPanning、スペース押下中：#isSpacePressed）で表現する。
 * パンと左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）のライフサイクル（開始ボタン・移動量閾値・直前位置・
 * window capture購読による追従/終了・blur時の中断・終了直後のclick抑止）は、本クラスが生成・所有するDragTracker（#drag）へ
 * 委譲し、本クラスはドラッグの意味の解釈（パン量、頂点変形・選択集合の平行移動・範囲選択のModel反映）のみを行う。
 * ズーム・パンによる表示の変更はViewTransformへ委譲する。
 * メソッドは区切りコメントで「公開API（モード・図形種別）」「イベントハンドラ」「左ドラッグ」「パン」「当たり分類」
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
     * ドラッグのライフサイクル管理（コンストラクタで生成・所有）。パンと左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）が利用する。
     * セッションは同時に1つのみ。
     * click抑止フラグの所有者もこのインスタンスである。
     * @type {DragTracker}
     */
    #drag;

    /**
     * @param {HTMLCanvasElement} canvas - イベントをリッスンするキャンバス
     * @param {Object} model - 図形データを管理するVectorModelインスタンス
     * @param {ViewTransform} viewTransform - スクリーン⇔ワールド変換とズーム・パンを担うビュー変換
     */
    constructor(canvas, model, viewTransform) {
        this.canvas = canvas;
        this.model = model;

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
         * handleClick/handleKeyDownの入力解釈を排他的に切り替える。setMode()経由でのみ更新する。
         * @type {'select'|'create'|'pan'}
         */
        this.currentMode = OperationMode.SELECT;

        /**
         * 図形作成モードで作成する図形種別（SHAPE_TYPESのいずれか）。setShapeType()経由でのみ更新する。
         * 操作モードの切り替えではリセットされないため、図形作成モードへ戻った際は前回の種別へ復帰する。
         * @type {'line'|'curve'|'arc'|'rect'|'circle'}
         */
        this.currentShapeType = 'line';

        /**
         * MOVING_SELECTION状態中、選択集合の差分移動計算に用いる直前のカーソル位置（ワールド座標）。
         * 押下時に押下点で初期化し、移動を反映するたびに更新する（閾値分の移動量は閾値超過時の最初の更新でまとめて反映される）。
         * DRAGGING_HANDLE状態でも押下点を記憶するが、頂点の更新には用いない。
         * IDLE/DRAWING/MARQUEE_SELECTING状態では未使用（null。範囲選択の押下点は#marqueeAnchorが保持する）。
         * @type {{x: number, y: number} | null}
         */
        this.lastCursor = null;

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
     * 有効な値の場合は常に（同じモードの再指定でも）、(1)currentModeの更新、(2)選択集合・
     * ホバー状態の無条件クリア、(3)IDLE以外の状態（進行中の作成/ドラッグ操作）であれば
     * cancelDraft()で作成途中の図形を破棄したうえでIDLE状態へ強制リセット、(4)カーソル形状の再評価、
     * の4処理を行う（モード切り替え時に前モードの状態が残留することを防ぐため）。
     * 安全策として、ドラッグセッション（パン・左ドラッグ。閾値以前を含む）中であれば先にDragTracker.cancel()で中断する
     * （onCancel経由で、パンは#finishPan()、左ドラッグは#onLeftDragCancel()によりIDLEへ戻る。頂点・位置の変更は確定済みのまま残り、
     * 範囲選択は選択矩形を破棄して確定しない）。
     * 図形種別（currentShapeType）は変更しない。
     * @param {'select'|'create'|'pan'} mode 切り替え先の操作モード（OperationModeの値）
     */
    setMode(mode) {
        if (!Object.values(OperationMode).includes(mode)) {
            console.warn(`InputTracker.setMode: 未知の操作モードのため無視します: ${mode}`);
            return;
        }

        if (this.#drag.isActive()) {
            this.#drag.cancel();
        }

        this.currentMode = mode;

        this.model.clearSelection();
        this.model.clearHovered();

        if (this.state !== InputState.IDLE) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
        }

        this.#updateCursor();
    }

    /**
     * 図形作成モードで作成する図形種別を切り替える。
     * SHAPE_TYPESに含まれない値が渡された場合はconsole.warnを出して何もしない。
     * 有効な値の場合はcurrentShapeTypeを更新し、作成途中の図形（DRAWING状態）があれば
     * cancelDraft()で破棄してIDLE状態へ戻す。
     * 操作モード・選択集合・ホバー状態・カーソル形状は変更しない（図形作成モード中に呼ばれても
     * モードは'create'のまま維持される）。
     * @param {'line'|'curve'|'arc'|'rect'|'circle'} type 切り替え先の図形種別（SHAPE_TYPESのいずれか）
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
     * @returns {'line'|'curve'|'arc'|'rect'|'circle'} 現在の図形種別（SHAPE_TYPESのいずれか）
     */
    getShapeType() {
        return this.currentShapeType;
    }

    // ---- イベントハンドラ（キャンバス・document・windowの購読先） ----

    /**
     * mousemoveイベントのハンドラ。
     * IDLE状態かつ選択モード中のみ、カーソル位置を#classifyPointで1回だけ当たり分類し、その結果を
     * ホバー更新（bodyIdがあればModelへホバー登録、なければホバー解除）とカーソル形状の更新で共用する
     * （選択モード以外のIDLE状態では何もしない）。
     * DRAWING状態では、作成中の図形の終点をカーソル位置に追従させる。
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
            this.model.updateDraft(x, y);
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
     * (6)IDLE状態かつ選択モード中のみ、押下点（ワールド座標）を#classifyPointで当たり分類し、以下の表で分岐する
     * （左ドラッグは#beginLeftDragで開始し、閾値以内で離した場合は離した後のclickで判定する）：
     * ・ハンドルあり・'move'            → MOVING_SELECTION（moveハンドル。選択集合の全図形を平行移動）
     * ・ハンドルあり・それ以外（頂点）   → DRAGGING_HANDLE（そのハンドルが属する1図形の頂点のみ変形）
     * ・本体（bodyId）が選択集合内       → MOVING_SELECTION（本体ドラッグ。単一選択でも有効）
     * ・本体（bodyId）が選択集合外       → 遷移しない（セッションも開始しない。離した後のclickで判定する）
     * ・空白                             → MARQUEE_SELECTING（範囲選択。押下点を#marqueeAnchorに記憶）
     * スペース押下中・中ボタン・キャンバス移動モードは(2)(4)のパン判定が先に成立するため、範囲選択は起きない。
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

        const point = this.getWorldCoordinate(event);
        const hit = this.#classifyPoint(point);

        if (hit.handle) {
            if (hit.handle.handle === 'move') {
                this.#beginLeftDrag(event, InputState.MOVING_SELECTION, point);
            } else {
                this.#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, hit.handle);
            }
            return;
        }

        if (hit.bodyId && this.model.isSelected(hit.bodyId)) {
            this.#beginLeftDrag(event, InputState.MOVING_SELECTION, point);
            return;
        }

        if (hit.bodyId === null) {
            this.#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point);
        }
    }

    /**
     * clickイベントのハンドラ。
     * DRAWING状態では、作成中の図形を確定登録してIDLE状態へ遷移する。
     * IDLE状態かつ選択モード中では、クリック位置を#classifyPointで当たり分類し（ホバー状態は参照しない）、
     * 選択集合の図形のハンドル上なら何もしない（選択集合を維持）、図形の本体上ならその図形のみの単一選択
     * （setSelection([bodyId])）、空白なら選択集合が空でなければ全解除（clearSelection()）する。
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
            this.model.commitDraft();
            this.state = InputState.IDLE;
            return;
        }

        if (this.state !== InputState.IDLE) {
            return;
        }

        const { x, y } = this.getWorldCoordinate(event);

        if (this.currentMode === OperationMode.SELECT) {
            const hit = this.#classifyPoint({ x, y });
            if (hit.handle) {
                return;
            }
            if (hit.bodyId) {
                this.model.setSelection([hit.bodyId]);
            } else if (this.model.getSelectedIds().length > 0) {
                this.model.clearSelection();
            }
            return;
        }

        if (this.currentMode === OperationMode.CREATE) {
            this.model.startDraft(x, y, this.currentShapeType);
            this.state = InputState.DRAWING;
        }
    }

    /**
     * keydownイベントのハンドラ。documentへ購読する（<canvas>要素はデフォルトでフォーカスを
     * 持てずキーボードイベントを受け取れないため）。
     * 選択モード中かつIDLE状態で、選択集合が空でない状態でDelete/Backspaceが押下された場合のみ、
     * ブラウザのデフォルト動作（Backspaceでの戻る操作等）をpreventDefault()で抑止した上で、
     * 選択集合の全図形をModelから一括削除する（deleteShapes。変更通知は1回）。
     * 左ドラッグ中（DRAGGING_HANDLE/MOVING_SELECTION/MARQUEE_SELECTING。閾値以前を含む）は削除を受け付けない
     * （ドラッグ対象の図形が消えたままドラッグの追従が続くことを防ぐため）。
     * Spaceキーは操作モードによらず、上記の判定より先に#handleSpaceKeyDownへ委譲する（スペースパン）。
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (event.code === 'Space') {
            this.#handleSpaceKeyDown(event);
            return;
        }

        if (this.currentMode !== OperationMode.SELECT) {
            return;
        }

        if (this.state !== InputState.IDLE) {
            return;
        }

        const selectedIds = this.model.getSelectedIds();
        if (selectedIds.length === 0) {
            return;
        }

        if (event.key !== 'Delete' && event.key !== 'Backspace') {
            return;
        }

        event.preventDefault();
        this.model.deleteShapes(selectedIds);
    }

    /**
     * keyupイベントのハンドラ。documentへ購読する。
     * Spaceキーの解放時のみ、スペース押下状態を解除してカーソル形状を再評価する。
     * テキスト入力中（isTextInputElement）でなければpreventDefault()する（フォーカス中のボタンの
     * スペース解放による誤クリックの抑止）。テキスト入力中でも押下状態の解除は行う（残留防止）。
     * 解放時点でパンのドラッグ中だった場合、そのドラッグはマウスボタンを離すまで継続する
     * （ドラッグ途中で選択・作成の挙動に切り替わる不整合を避けるため）。
     * @param {KeyboardEvent} event
     */
    handleKeyUp(event) {
        if (event.code !== 'Space') {
            return;
        }

        if (!isTextInputElement(document.activeElement)) {
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
     * ドラッグ対象をズーム後のカーソル位置へ追従し直す（パン中・閾値以前は何もしない）。範囲選択中は、押下点のワールド位置を
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
     * 直後のclickを抑止）で開始し、成功した場合のみ押下点を記憶して（MARQUEE_SELECTINGなら#marqueeAnchor、それ以外なら
     * 直前カーソル座標lastCursor）、DRAGGING_HANDLEなら操作対象のハンドル名・図形idも記憶してnextStateへ遷移し、
     * カーソル形状を更新する。閾値以内では図形・選択矩形は変化しない。
     * 追従（onMove）は#applyLeftDragUpdate、開始（onStart）は#onLeftDragStart、
     * 終了（onEnd：左ボタンの解放）は#onLeftDragEnd、中断（onCancel：blur・setMode）は#onLeftDragCancelが担う。
     * @param {MouseEvent} event ドラッグを開始したmousedownイベント
     * @param {'DRAGGING_HANDLE'|'MOVING_SELECTION'|'MARQUEE_SELECTING'} nextState 遷移先の状態（InputStateの値）
     * @param {{x: number, y: number}} point 押下点（ワールド座標）
     * @param {{shapeId: string, handle: string} | null} [target=null] DRAGGING_HANDLEの操作対象（頂点ハンドルが属する図形のid（単一）と
     *     ハンドル名）。MOVING_SELECTION（選択集合の全図形が対象）・MARQUEE_SELECTINGでは不要
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
            return;
        }

        const isMarquee = nextState === InputState.MARQUEE_SELECTING;
        this.activeHandle = target?.handle ?? null;
        this.activeShapeId = target?.shapeId ?? null;
        this.lastCursor = isMarquee ? null : point;
        this.#marqueeAnchor = isMarquee ? point : null;
        this.state = nextState;
        this.#updateCursor();
    }

    /**
     * 左ドラッグの移動量が閾値を超えた時点の処理（DragTrackerのonStart）。
     * 押下前のホバー表示が古いまま残らないようホバー状態をクリアし、カーソル形状を更新する。
     */
    #onLeftDragStart() {
        this.model.clearHovered();
        this.#updateCursor();
    }

    /**
     * 左ドラッグの追従処理（DragTrackerのonMove、およびドラッグ中のhandleWheelから呼ばれる）。
     * InputStateで処理を振り分けるディスパッチャ（図形種別の分岐ではない）：
     * MOVING_SELECTIONなら直前カーソル座標（lastCursor）との差分（ワールド座標）を選択集合の全図形へ一括で渡し
     * （moveShapes。変更通知は1回）、直前カーソル座標を更新する。
     * MARQUEE_SELECTINGなら押下点（#marqueeAnchor）と現在のカーソル位置（いずれもワールド座標）を対角2点として
     * 選択矩形をModelへ設定する（正規化しない。選択集合は確定時まで変更しない）。
     * DRAGGING_HANDLEならshape.getVertexIndexForHandle()で頂点インデックスを解決して現在のワールド座標をModelへ渡す
     * （その1図形のみ。選択集合は変更しない）。対象図形が存在しない場合は何もしない。
     * @param {MouseEvent} event カーソル位置を持つイベント（window captureのmousemove、またはwheel）
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
            const dx = x - this.lastCursor.x;
            const dy = y - this.lastCursor.y;
            this.model.moveShapes(this.model.getSelectedIds(), dx, dy);
            this.lastCursor = { x, y };
            return;
        }

        const shape = this.model.getShapes().find((s) => s.id === this.activeShapeId);
        if (!shape) {
            return;
        }
        const vertexIndex = shape.getVertexIndexForHandle(this.activeHandle);
        this.model.updateVertex(this.activeShapeId, vertexIndex, x, y);
    }

    /**
     * 左ドラッグの終了処理（DragTrackerのonEnd：開始ボタン（左）の解放、またはbuttonsによる解放の検知）。
     * MARQUEE_SELECTINGかつ閾値を超えて動かしていた場合のみ#commitMarqueeで範囲選択を確定し、その後#finishLeftDragで後始末する。
     * 閾値以内で離した範囲選択は何も確定しない（直後のclickが通常の空白クリック＝全解除として処理される）。
     * @param {MouseEvent} event 終了のきっかけとなったイベント（通常はmouseup。buttons検知時はmousemove）
     * @param {boolean} moved 閾値を超えて動かしたか
     */
    #onLeftDragEnd(event, moved) {
        if (this.state === InputState.MARQUEE_SELECTING && moved) {
            this.#commitMarquee(event);
        }
        this.#finishLeftDrag();
    }

    /**
     * 左ドラッグの中断処理（DragTrackerのonCancel：window blur・setModeによる強制中断）。
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
     * 輪郭線が矩形に掛かる図形のidで選択集合を置き換える（0件なら全解除）。図形種別の分岐は持たない。
     * Modelへの変更通知は選択矩形の破棄と選択集合の置き換えの2回（図形数に比例しない）。
     * @param {MouseEvent} event 範囲選択を終了したイベント（通常はmouseup）
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
        this.model.setSelection(ids);
    }

    /**
     * 左ドラッグの終了・中断時の後始末（#onLeftDragEnd・#onLeftDragCancelから呼ばれる）。
     * IDLE状態へ戻し、作業用フィールド（activeHandle・activeShapeId・lastCursor・#marqueeAnchor）をnullにして、
     * カーソル形状を再評価する。ドラッグ中に反映した変更（頂点・位置）は取り消さない。
     * 範囲選択の確定・選択矩形の破棄は呼び出し前に済ませること。click抑止フラグの管理はDragTrackerが担う。
     */
    #finishLeftDrag() {
        this.state = InputState.IDLE;
        this.activeHandle = null;
        this.activeShapeId = null;
        this.lastCursor = null;
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
     * blur/setModeによる中断（onCancel）で#finishPan()する。
     * InputState（DRAWING状態）・作成途中図形には触れない。
     * DragTrackerがセッション中で開始できなかった場合は何もしない。
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
        this.#updateCursor();
    }

    /**
     * パンの終了処理。DragTrackerのonEnd（開始ボタンの解放）・onCancel（blur・setModeによる中断）から呼ばれる。
     * パン中フラグを解除し、カーソル形状を再評価する（click抑止フラグの管理はDragTrackerが担う）。
     */
    #finishPan() {
        this.#isPanning = false;
        this.#updateCursor();
    }

    /**
     * handleKeyDownから委譲されるSpaceキー押下の処理。
     * テキスト入力中（isTextInputElement）なら文字入力を妨げないため何もしない（preventDefaultもしない）。
     * それ以外はpreventDefault()（ページスクロール、およびフォーカス中のボタンのスペース押下による誤クリックの抑止）し、
     * 初回押下時のみスペース押下状態にしてカーソル形状を再評価する（キーリピートでは状態を二重に変えない）。
     * @param {KeyboardEvent} event
     */
    #handleSpaceKeyDown(event) {
        if (isTextInputElement(document.activeElement)) {
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
     * 規則：
     * ・ハンドル：選択集合の全図形を対象に、図形配列の後ろ（描画順で前面）からshape.hitTestHandle(...)を呼び、
     *   最初に非nullとなった図形・ハンドルを採用する（前面優先。CanvasManagerがハンドルを図形配列順に描くため、重なり順と一致する）。
     * ・本体：図形配列を先頭から1回だけ走査し、shape.hitTest(...)が真の最初の図形を記録しつつ、
     *   選択集合の図形で真になった時点でそれを採用して打ち切る（選択集合の図形を優先、同順位は図形配列の先頭）。
     * 図形種別の分岐は持たず、isSelected・hitTestHandle・hitTestのポリモーフィック呼び出しのみで判定する。
     * 許容誤差は#getWorldHitTolerance()（画面上hitTolerance pxのワールド換算値）。
     * @param {{x: number, y: number}} point 判定位置（ワールド座標）
     * @returns {PointHit} 当たり分類の結果（handle・bodyIdともnullなら空白）
     */
    #classifyPoint(point) {
        const shapes = this.model.getShapes();
        const tolerance = this.#getWorldHitTolerance();

        let handle = null;
        for (let i = shapes.length - 1; i >= 0; i--) {
            const shape = shapes[i];
            if (!this.model.isSelected(shape.id)) {
                continue;
            }
            const handleName = shape.hitTestHandle(point.x, point.y, tolerance);
            if (handleName) {
                handle = { shapeId: shape.id, handle: handleName };
                break;
            }
        }

        let bodyId = null;
        for (const shape of shapes) {
            if (!shape.hitTest(point.x, point.y, tolerance)) {
                continue;
            }
            if (this.model.isSelected(shape.id)) {
                bodyId = shape.id;
                break;
            }
            if (bodyId === null) {
                bodyId = shape.id;
            }
        }

        return { handle, bodyId };
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
     * (4)DRAGGING_HANDLE・MOVING_SELECTION状態 → 'move'、
     * (5)MARQUEE_SELECTING状態 → 'default'、
     * (6)当たり分類なし（hit === null。座標不明） → 'default'、
     * (7)選択集合の図形のハンドル上（hit.handle） → 'move'、
     * (8)選択集合内の図形の本体上（hit.bodyIdが選択集合内） → 'move'、
     * (9)それ以外の図形の本体上（hit.bodyId） → 'pointer'、
     * (10)それ以外 → 'default'。
     * @param {PointHit | null} hit カーソル位置の当たり分類（#classifyPointの結果）。座標が不明なとき
     *     （setMode直後・パン開始/終了・左ドラッグ開始/終了・スペース押下/解放等）はnull
     * @returns {'grabbing'|'grab'|'crosshair'|'move'|'pointer'|'default'} 適用すべきCSS cursor値
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
