/**
 * 責務：ユーザー入力（パン・ズームを含む）の解釈とModel・ビュー変換への反映、
 * および入力状態に応じたキャンバスのカーソル形状のフィードバックを担う。
 */

/**
 * InputTrackerが取りうる内部状態。
 * IDLE: 待機状態（ホバー判定・クリックによる新規作成/選択待ち）。
 * DRAWING: 新規Line作成中（始点確定済み、終点をカーソルに追従させている）。
 * DRAGGING_HANDLE: 選択中図形のハンドル（start/end/move）をドラッグ中。
 * @readonly
 * @enum {string}
 */
export const InputState = {
    IDLE: 'IDLE',
    DRAWING: 'DRAWING',
    DRAGGING_HANDLE: 'DRAGGING_HANDLE',
};

/**
 * 操作モード。コントロールパネルの各ボタンはこの値に1対1で対応する。
 * SELECT: 選択モード（ホバー判定・選択・ハンドルドラッグ・削除）。
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
 * （IDLE / DRAWING / DRAGGING_HANDLE）。操作モード（currentMode）と図形種別（currentShapeType）を
 * 独立した状態として保持し、操作モード・入力状態・当たり判定に応じてキャンバスのカーソル形状を更新する。
 * パン（中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モードの左ドラッグ）は、DRAWINGを保持したまま
 * 行えるよう、InputStateとは直交するprivateフラグ（#panDrag / #isSpacePressed / #suppressNextClick）で表現する。
 * ズーム・パンによる表示の変更はViewTransformへ委譲する。
 */
export class InputTracker {
    /**
     * パンのドラッグ状態。非nullがパン中を表す。
     * button: パンを開始したマウスボタン（0=左 / 1=中）。終了判定（同じボタンのmouseup）に用いる。
     * lastScreen: 直前のカーソル位置（スクリーン座標）。パン量（スクリーン座標の差分）の計算に用いる。
     * @type {{button: number, lastScreen: {x: number, y: number}} | null}
     */
    #panDrag = null;

    /**
     * スペースキー押下中か。押下中は左ドラッグでパンする。keyup・window blurで解除する。
     * @type {boolean}
     */
    #isSpacePressed = false;

    /**
     * 左ボタンのパン終了直後に発火するclickを1回だけ無視するためのフラグ。
     * #endPan()で立て、handleClickで消費する。clickを伴わずにパンが終わった場合の残留は、
     * 次のhandleMouseDownで必ず解除する。
     * @type {boolean}
     */
    #suppressNextClick = false;

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
         * 現在の内部状態（IDLE / DRAWING / DRAGGING_HANDLE）。状態遷移マシンの起点。
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
         * DRAGGING_HANDLE状態中、moveハンドルの差分移動計算に用いる直前のカーソル位置（ワールド座標）。
         * IDLE/DRAWING状態では未使用（null）。
         * @type {{x: number, y: number} | null}
         */
        this.lastCursor = null;

        /**
         * DRAGGING_HANDLE状態中に操作しているハンドルの種別。mousedown時にhitTestHandleの
         * 戻り値を記憶しておき、mousemove/mouseupから参照する。
         * IDLE/DRAWING状態では未使用（null）。
         * @type {'start'|'end'|'move'|null}
         */
        this.activeHandle = null;

        /**
         * DRAGGING_HANDLE状態中に操作している図形のid。
         * IDLE/DRAWING状態では未使用（null）。
         * @type {string|null}
         */
        this.activeShapeId = null;

        /**
         * 当たり判定（線分本体のhitTest・ハンドルのhitTestHandle共通）の許容誤差。
         * 画面上（スクリーン座標）のピクセル単位。当たり判定時は#getWorldHitTolerance()で
         * ワールド換算して渡す（表示倍率によらず画面上で一定の判定幅になる）。
         * @type {number}
         */
        this.hitTolerance = 5;

        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        // preventDefault()でページスクロール・ブラウザズームを抑止するため、passive: falseで購読する
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this), { passive: false });
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        document.addEventListener('keyup', this.handleKeyUp.bind(this));

        // パンの追従・終了はwindowへcaptureフェーズ（第3引数true）で購読する。
        // WindowManagerが.float-window上のmousemove/mouseupの伝播を止めるため、キャンバスへの購読だけでは
        // フロートウィンドウ上・ブラウザ外でボタンを離した場合を検知できない（captureは対象要素のstopPropagationより先に到達する）。
        // 常設し、パン中（#panDrag !== null）以外は何もしない。
        window.addEventListener('mousemove', this.#handleWindowMouseMove.bind(this), true);
        window.addEventListener('mouseup', this.#handleWindowMouseUp.bind(this), true);
        // タブ切替等でkeyup/mouseupを取りこぼした場合に、スペース押下状態・パン状態を残留させない
        window.addEventListener('blur', this.#handleWindowBlur.bind(this));

        this.#updateCursor();
    }

    /**
     * 操作モードを切り替える。
     * OperationModeに定義されていない値が渡された場合はconsole.warnを出して何もしない
     * （内部状態・選択状態・カーソルは一切変更しない）。
     * 有効な値の場合は常に（同じモードの再指定でも）、(1)currentModeの更新、(2)選択状態・
     * ホバー状態の無条件クリア、(3)進行中の作成/ドラッグ操作（DRAWING/DRAGGING_HANDLE状態）が
     * あればcancelDraft()で破棄したうえでIDLE状態へ強制リセット、(4)カーソル形状の再評価、
     * の4処理を行う（モード切り替え時に前モードの状態が残留することを防ぐため）。
     * 安全策として、パンのドラッグ中であれば先に#endPan()でパンを終了する。
     * 図形種別（currentShapeType）は変更しない。
     * @param {'select'|'create'|'pan'} mode 切り替え先の操作モード（OperationModeの値）
     */
    setMode(mode) {
        if (!Object.values(OperationMode).includes(mode)) {
            console.warn(`InputTracker.setMode: 未知の操作モードのため無視します: ${mode}`);
            return;
        }

        if (this.#panDrag !== null) {
            this.#endPan();
        }

        this.currentMode = mode;

        this.model.clearSelection();
        this.model.clearHovered();

        if (this.state === InputState.DRAWING || this.state === InputState.DRAGGING_HANDLE) {
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
     * 操作モード・選択状態・ホバー状態・カーソル形状は変更しない（図形作成モード中に呼ばれても
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

    /**
     * mousemoveイベントのハンドラ。
     * IDLE状態かつ選択モード中のみ、図形配列に対し shape.hitTest(...) をポリモーフィックに呼び出して
     * ホバー判定を行い、該当図形があればModelへホバー登録、なければホバー解除した上で、
     * カーソル位置に応じてカーソル形状を更新する（選択モード以外のIDLE状態では何もしない）。
     * DRAWING状態では、作成中Lineの終点をカーソル位置に追従させる。
     * DRAGGING_HANDLE状態では、start/endハンドルなら現在のワールド座標をそのままModelへ、
     * moveハンドルなら直前カーソル座標との差分をModelへ渡し、直前カーソル座標を更新する。
     * Modelへ渡す座標・当たり判定に用いる座標はすべてワールド座標（getWorldCoordinate由来）、
     * 当たり判定の許容誤差は画面上一定値のワールド換算値とする。
     * パンのドラッグ中は何もしない（パンの追従は#handleWindowMouseMoveが担い、ホバー判定・作成途中図形の更新・
     * ハンドルドラッグは走らせない。パン中はカーソル下のワールド点がカーソルに追従するため、パン終了後の
     * 次のmousemoveから作成途中図形の終点は従来どおりカーソルに追従する）。
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (this.#panDrag !== null) {
            return;
        }

        if (this.state === InputState.DRAWING) {
            const { x, y } = this.getWorldCoordinate(event);
            this.model.updateDraft(x, y);
            return;
        }

        if (this.state === InputState.DRAGGING_HANDLE) {
            const { x, y } = this.getWorldCoordinate(event);

            if (this.activeHandle === 'move') {
                const dx = x - this.lastCursor.x;
                const dy = y - this.lastCursor.y;
                this.model.moveShape(this.activeShapeId, dx, dy);
                this.lastCursor = { x, y };
            } else {
                const shape = this.model.getShapes().find((s) => s.id === this.activeShapeId);
                const vertexIndex = shape.getVertexIndexForHandle(this.activeHandle);
                this.model.updateVertex(this.activeShapeId, vertexIndex, x, y);
            }
            return;
        }

        if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) {
            return;
        }

        const { x, y } = this.getWorldCoordinate(event);
        const hitShape = this.model.getShapes().find((shape) => shape.hitTest(x, y, this.#getWorldHitTolerance()));

        if (hitShape) {
            this.model.setHovered(hitShape.id);
        } else {
            this.model.clearHovered();
        }

        this.#updateCursor({ x, y });
    }

    /**
     * mousedownイベントのハンドラ。
     * IDLE状態かつ選択モード中で、選択中図形が存在する場合のみ、その図形へ shape.hitTestHandle(...) を
     * ポリモーフィックに呼び出してハンドル上での押下かを判定する。該当すれば操作対象の
     * ハンドル種別・図形id・直前カーソル座標（ワールド座標）を記憶し、DRAGGING_HANDLE状態へ遷移して
     * カーソル形状を更新する。
     * 上記より先に、パン開始の判定を行う：(1)前回のパンのclick抑止フラグの残留を解除、(2)既にパン中なら何もしない、
     * (3)中ボタンはpreventDefault()（オートスクロール抑止）したうえで、DRAGGING_HANDLE状態でなければパンを開始する
     * （DRAGGING_HANDLE中はパンせず終了）、(4)左ボタンでスペース押下中またはキャンバス移動モードなら、
     * DRAGGING_HANDLE状態でなければパンを開始する。パンはDRAWING状態・作成途中図形を保持したまま行う。
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        this.#suppressNextClick = false;

        if (this.#panDrag !== null) {
            return;
        }

        if (event.button === 1) {
            event.preventDefault();
            if (this.state !== InputState.DRAGGING_HANDLE) {
                this.#beginPan(event);
            }
            return;
        }

        if (
            event.button === 0 &&
            (this.#isSpacePressed || this.currentMode === OperationMode.PAN) &&
            this.state !== InputState.DRAGGING_HANDLE
        ) {
            this.#beginPan(event);
            return;
        }

        if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) {
            return;
        }

        const selectedId = this.model.getSelectedId();
        if (!selectedId) {
            return;
        }

        const selectedShape = this.model.getShapes().find((shape) => shape.id === selectedId);
        if (!selectedShape) {
            return;
        }

        const { x, y } = this.getWorldCoordinate(event);
        const handle = selectedShape.hitTestHandle(x, y, this.#getWorldHitTolerance());
        if (!handle) {
            return;
        }

        this.activeHandle = handle;
        this.activeShapeId = selectedId;
        this.lastCursor = { x, y };
        this.state = InputState.DRAGGING_HANDLE;
        this.#updateCursor();
    }

    /**
     * mouseupイベントのハンドラ。
     * DRAGGING_HANDLE状態でのハンドルドラッグを終了し、IDLE状態へ遷移する。
     * @param {MouseEvent} event
     */
    handleMouseUp(event) {
        if (this.state !== InputState.DRAGGING_HANDLE) {
            return;
        }

        this.state = InputState.IDLE;
    }

    /**
     * clickイベントのハンドラ。
     * DRAWING状態では、作成中Lineを確定登録してIDLE状態へ遷移する。
     * IDLE状態かつ選択モード中では、ホバー中の図形があればそれを選択状態にし、
     * ホバー中の図形がない（空白部分のクリック）場合は、選択中であれば選択解除する。
     * IDLE状態かつ図形作成モード中では、Modelへ新規図形作成の開始を指示してDRAWING状態へ遷移する。
     * 作成する図形のtypeには、現在記憶している図形種別（currentShapeType）をそのまま使用し、
     * 作成開始位置はクリック位置のワールド座標とする。
     * 選択モード・図形作成モード以外のモードでは、IDLE状態のクリックを無視する。
     * 左ボタンのパン（スペース＋左ドラッグ・キャンバス移動モード）終了直後のclickは、#suppressNextClickを
     * 解除したうえで1回だけ無視する（作成開始・確定・選択・選択解除を起こさない）。
     * @param {MouseEvent} event
     */
    handleClick(event) {
        if (this.#suppressNextClick) {
            this.#suppressNextClick = false;
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
            const hoveredId = this.model.getHoveredId();
            if (hoveredId) {
                this.model.selectShape(hoveredId);
            } else if (this.model.getSelectedId()) {
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
     * 選択モード中に選択中図形が存在する状態でDelete/Backspaceが押下された場合のみ、
     * ブラウザのデフォルト動作（Backspaceでの戻る操作等）をpreventDefault()で抑止した上で、
     * その図形をModelから削除する。
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

        const selectedId = this.model.getSelectedId();
        if (!selectedId) {
            return;
        }

        if (event.key !== 'Delete' && event.key !== 'Backspace') {
            return;
        }

        event.preventDefault();
        this.model.deleteShape(selectedId);
    }

    /**
     * wheelイベントのハンドラ。キャンバスへ{ passive: false }で購読する。
     * ページスクロール・Ctrl+ホイールのブラウザズームをpreventDefault()で抑止したうえで、
     * カーソル位置を中心にズームする（ViewTransform.zoomAt()へ委譲。倍率のクランプ・再描画通知も同クラスが担う）。
     * 操作モード・入力状態によらず常に有効（DRAWING/DRAGGING_HANDLE中も、カーソル下のワールド点は不変）。
     * ズーム方向はdeltaYの符号のみで決め（負：拡大、正：縮小）、大きさは用いない。deltaYが0（横スクロールのみ）なら何もしない。
     * ズーム中心はスクリーン座標（getScreenCoordinate由来）。ズーム後のホバー・カーソル形状は次のmousemoveで再評価する。
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
    }

    // ---- パン（中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モード） ----

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
     * パンのドラッグを開始する。handleMouseDownから呼ばれる。
     * 開始したマウスボタンと現在のカーソル位置（スクリーン座標）を#panDragへ記憶し、
     * 選択モード中のホバー表示が古いまま残らないようホバー状態をクリアして、カーソルをgrabbingにする。
     * InputState（DRAWING状態）・作成途中図形には触れない。
     * @param {MouseEvent} event パンを開始したmousedownイベント
     */
    #beginPan(event) {
        this.#panDrag = { button: event.button, lastScreen: this.getScreenCoordinate(event) };
        this.model.clearHovered();
        this.#updateCursor();
    }

    /**
     * パンのドラッグを終了する。#handleWindowMouseUp・#handleWindowBlur・setModeから呼ばれる。
     * 開始ボタンが左（0）だった場合は、直後に発火するclickを無視するため#suppressNextClickを立てる
     * （中ボタンではclickは発火しないため立てない）。その後#panDragを解除し、カーソル形状を再評価する。
     */
    #endPan() {
        if (this.#panDrag === null) {
            return;
        }

        if (this.#panDrag.button === 0) {
            this.#suppressNextClick = true;
        }
        this.#panDrag = null;
        this.#updateCursor();
    }

    /**
     * windowへcaptureで購読するmousemoveのハンドラ。パン中以外は何もしない。
     * 現在のカーソル位置（スクリーン座標。キャンバス外でもキャンバス左上基準）と直前位置の差分を
     * ViewTransform.panBy()へ渡し（再描画通知は同クラスが担う）、直前位置を更新する。
     * @param {MouseEvent} event
     */
    #handleWindowMouseMove(event) {
        if (this.#panDrag === null) {
            return;
        }

        const current = this.getScreenCoordinate(event);
        const dx = current.x - this.#panDrag.lastScreen.x;
        const dy = current.y - this.#panDrag.lastScreen.y;
        this.#panDrag.lastScreen = current;
        this.viewTransform.panBy(dx, dy);
    }

    /**
     * windowへcaptureで購読するmouseupのハンドラ。パン中かつパンを開始したボタンが離された場合のみ#endPan()する
     * （フロートウィンドウ上・ブラウザ外でボタンを離した場合も検知できる）。
     * @param {MouseEvent} event
     */
    #handleWindowMouseUp(event) {
        if (this.#panDrag === null || event.button !== this.#panDrag.button) {
            return;
        }

        this.#endPan();
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

    /**
     * windowのblurイベントのハンドラ（タブ切替・ウィンドウ非アクティブ化）。
     * keyup/mouseupを取りこぼしても状態が残らないよう、スペース押下状態を解除し、パン中であれば終了する。
     * blur後にclickは来ないため、#endPan()が立てたclick抑止フラグは解除する。最後にカーソル形状を再評価する。
     */
    #handleWindowBlur() {
        this.#isSpacePressed = false;

        if (this.#panDrag !== null) {
            this.#endPan();
            this.#suppressNextClick = false;
        }

        this.#updateCursor();
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

    /**
     * 現在の操作モード・入力状態・カーソル位置から、キャンバスに適用すべきCSS cursor値を判定する。
     * DOMには触れない純粋な判定関数。判定順序：
     * (0a)パンのドラッグ中 → 'grabbing'、
     * (0b)スペース押下中かつDRAGGING_HANDLE状態でない → 'grab'（ハンドルドラッグ中はパンを開始しないため除外し'move'を維持）、
     * (1)図形作成モード → 'crosshair'（作成途中を含む）、
     * (2)キャンバス移動モード → 'grab'、
     * (3)選択モード以外のモード → 'default'（将来のモード追加時の既定値）、
     * (4)DRAGGING_HANDLE状態 → 'move'、
     * (5)座標不明（point === null） → 'default'、
     * (6)選択中図形のハンドル上（shape.hitTestHandle(...)のポリモーフィック呼び出し。許容誤差はワールド換算値） → 'move'、
     * (7)ホバー中の図形あり（直前のhandleMouseMoveで更新されたホバー状態を再利用） → 'pointer'、
     * (8)それ以外 → 'default'。
     * @param {{x: number, y: number} | null} point カーソル位置（ワールド座標）。座標が不明なとき（setMode直後・パン開始/終了・スペース押下/解放等）はnull
     * @returns {'grabbing'|'grab'|'crosshair'|'move'|'pointer'|'default'} 適用すべきCSS cursor値
     */
    #resolveCursor(point) {
        if (this.#panDrag !== null) {
            return 'grabbing';
        }

        if (this.#isSpacePressed && this.state !== InputState.DRAGGING_HANDLE) {
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

        if (this.state === InputState.DRAGGING_HANDLE) {
            return 'move';
        }

        if (point === null) {
            return 'default';
        }

        const selectedId = this.model.getSelectedId();
        const selectedShape = selectedId
            ? this.model.getShapes().find((shape) => shape.id === selectedId)
            : null;
        if (selectedShape && selectedShape.hitTestHandle(point.x, point.y, this.#getWorldHitTolerance())) {
            return 'move';
        }

        if (this.model.getHoveredId()) {
            return 'pointer';
        }

        return 'default';
    }

    /**
     * #resolveCursor(point)の判定結果をキャンバス要素のCSS cursorへ適用する。
     * @param {{x: number, y: number} | null} [point=null] カーソル位置（ワールド座標）。座標が不明なときはnull
     */
    #updateCursor(point = null) {
        this.canvas.style.cursor = this.#resolveCursor(point);
    }
}
