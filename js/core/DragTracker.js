/**
 * 責務：マウスボタン押下から解放までの1回のドラッグ操作のライフサイクル（開始ボタン・移動量閾値の判定、
 * windowへのcapture購読による追従/終了検知、blur時の中断、終了直後のclick抑止）を担う。ドラッグの意味は知らない。
 */

/**
 * ドラッグセッションの各段階で呼ばれるコールバック群。いずれも省略可。
 * @typedef {Object} DragHandlers
 * @property {() => void} [onStart] 移動量が閾値を超えた時点で1回だけ呼ばれる（onMoveの直前）
 * @property {(event: MouseEvent, screen: {x: number, y: number}, prevScreen: {x: number, y: number}) => void} [onMove]
 *     閾値超過後のmousemoveごとに呼ばれる。screen：現在のカーソル位置（スクリーン座標）、
 *     prevScreen：直前のmousemove時点のカーソル位置（スクリーン座標）。直前位置は閾値以前のmousemoveでも更新されるため、
 *     threshold > 0のセッションの初回は押下点ではなく「閾値超過直前のmousemove位置」となる
 *     （押下後に閾値以内のmousemoveがなかった場合のみ押下点。threshold = 0のセッションでは初回は押下点）。
 *     押下点からの累積移動量が必要な場合は、呼び出し側で押下時点の座標を記憶して差分を取ること
 * @property {(event: MouseEvent, moved: boolean) => void} [onEnd]
 *     開始ボタンの解放で呼ばれる。moved：閾値を超えて移動したか。呼び出し時点でセッションは終了済み（isActive()はfalse）。
 *     eventは通常は解放のmouseupだが、mouseupを取りこぼして開始ボタンが離れていることをmousemoveのbuttonsで検知した
 *     場合はそのmousemoveとなる（いずれも解放とみなした時点のカーソル位置を持つ）
 * @property {() => void} [onCancel] blur・cancel()による中断時に呼ばれる。呼び出し時点でセッションは終了済み
 */

/**
 * 実行中のドラッグセッション。
 * @typedef {Object} DragSession
 * @property {number} button ドラッグを開始したマウスボタン（0=左 / 1=中）。同じボタンの解放でのみ終了する
 * @property {{x: number, y: number}} startScreen 押下点（スクリーン座標）。閾値判定の基準
 * @property {{x: number, y: number}} lastScreen 直前のmousemove時点のカーソル位置（スクリーン座標）。初期値は押下点で、
 *     閾値以前のmousemoveでも毎回更新する
 * @property {number} threshold 移動量の閾値（スクリーン座標のCSSピクセル）。押下点からの距離がこれを超えたら移動とみなす
 * @property {'whenMoved'|'always'} suppressClick 終了直後のclickを抑止する条件（左ボタンのみ有効）
 * @property {boolean} moved 閾値を超えて移動したか
 * @property {DragHandlers} handlers セッションのコールバック群
 */

/**
 * MouseEvent.button（押下・解放されたボタン）から、MouseEvent.buttons（押下中ボタンのビットマスク）の対応ビットへの対応表。
 * mouseupの取りこぼし検知（mousemove時点で開始ボタンが押されていないことの判定）に用いる。
 * （button：0=左 / 1=中 / 2=右、buttons：1=左 / 4=中 / 2=右。中と右でビットの並びが逆である点に注意）
 * @type {Readonly<Record<number, number>>}
 */
const BUTTON_TO_BUTTONS_BIT = Object.freeze({ 0: 1, 1: 4, 2: 2 });

/**
 * 1回のドラッグ操作（押下〜解放）のライフサイクルを管理するクラス。
 * windowへmousemove/mouseupをcaptureフェーズで購読するため、フロートウィンドウ上（WindowManagerが伝播を止める）や
 * ブラウザ外でボタンを離した場合も追従・終了を検知できる。それでもmouseupを取りこぼした場合は、次のmousemoveの
 * buttonsに開始ボタンが含まれないことで解放とみなして終了する。座標はすべてスクリーン座標で扱い、ドラッグの意味
 * （パン・ハンドルドラッグ等）の解釈は呼び出し側がコールバックで行う。セッションは同時に1つのみ。
 * InputTracker・VectorModel・ViewTransform・canvas要素には依存しない（スクリーン座標取得関数のみ注入される）。
 */
export class DragTracker {
    /**
     * マウスイベントからスクリーン座標（キャンバス左上基準のCSSピクセル）を返す関数（InputTracker.getScreenCoordinateを注入）。
     * @type {(event: MouseEvent) => {x: number, y: number}}
     */
    #getScreenPoint;

    /**
     * 実行中のドラッグセッション。nullはセッションなし。
     * @type {DragSession | null}
     */
    #session = null;

    /**
     * 終了直後に発火するclickを1回だけ無視するためのフラグ（パン・左ドラッグ共通）。
     * 左ボタンのセッション終了時に条件に応じて立て、consumeSuppressedClick()で消費する。
     * clickを伴わずに終わった場合の残留は、呼び出し側が次の押下時にclearSuppressedClick()で解除する。
     * @type {boolean}
     */
    #suppressNextClick = false;

    /**
     * @param {(event: MouseEvent) => {x: number, y: number}} getScreenPoint マウスイベントからスクリーン座標を返す関数
     */
    constructor(getScreenPoint) {
        this.#getScreenPoint = getScreenPoint;

        // captureフェーズ（第3引数true）は対象要素のstopPropagationより先に到達するため、
        // フロートウィンドウ上・ブラウザ外での移動・解放も検知できる。常設し、セッション中以外は何もしない。
        window.addEventListener('mousemove', this.#handleWindowMouseMove.bind(this), true);
        window.addEventListener('mouseup', this.#handleWindowMouseUp.bind(this), true);
        // タブ切替等でmouseupを取りこぼした場合に、セッションを残留させない
        window.addEventListener('blur', this.#handleWindowBlur.bind(this));
    }

    /**
     * ドラッグセッションを開始する（mousedownイベントのハンドラから呼ぶ）。
     * 既にセッション中の場合はconsole.warnを出して何もせずfalseを返す。
     * @param {MouseEvent} event ドラッグを開始したmousedownイベント（開始ボタン・押下点の取得に用いる）
     * @param {DragHandlers} handlers セッションのコールバック群
     * @param {Object} [options]
     * @param {number} [options.threshold=0] 移動量の閾値（スクリーン座標のCSSピクセル）。押下点からの距離がこれを超えた時点でonStart→onMoveを呼ぶ
     * @param {'whenMoved'|'always'} [options.suppressClick='whenMoved'] 左ボタンの解放直後のclickを抑止する条件
     *     （'whenMoved'：閾値を超えて移動した場合のみ／'always'：移動の有無によらず）。左ボタン以外では抑止しない
     * @returns {boolean} セッションを開始した場合true
     */
    begin(event, handlers, { threshold = 0, suppressClick = 'whenMoved' } = {}) {
        if (this.#session !== null) {
            console.warn('DragTracker.begin: ドラッグセッション中のため新しいセッションを開始しません');
            return false;
        }

        const start = this.#getScreenPoint(event);
        this.#session = {
            button: event.button,
            startScreen: start,
            lastScreen: start,
            threshold,
            suppressClick,
            moved: false,
            handlers,
        };
        return true;
    }

    /**
     * ドラッグセッション中か（閾値以前を含む）。
     * @returns {boolean}
     */
    isActive() {
        return this.#session !== null;
    }

    /**
     * 実行中のセッションで移動量が閾値を超えたか。セッションなしの場合はfalse。
     * @returns {boolean}
     */
    hasMoved() {
        return this.#session !== null && this.#session.moved;
    }

    /**
     * 実行中のセッションを中断する。セッションを破棄してclick抑止フラグを解除したうえでonCancelを呼ぶ。
     * セッションがない場合は何もしない（click抑止フラグにも触れない）。
     */
    cancel() {
        if (this.#session === null) {
            return;
        }

        const { handlers } = this.#session;
        this.#session = null;
        this.#suppressNextClick = false;
        handlers.onCancel?.();
    }

    /**
     * click抑止フラグが立っていれば解除してtrueを返す。clickイベントのハンドラ冒頭で呼ぶ。
     * @returns {boolean} このclickを無視すべき場合true
     */
    consumeSuppressedClick() {
        if (!this.#suppressNextClick) {
            return false;
        }
        this.#suppressNextClick = false;
        return true;
    }

    /**
     * click抑止フラグの残留（clickを伴わずに終わった場合）を解除する。mousedownイベントのハンドラ冒頭で呼ぶ。
     */
    clearSuppressedClick() {
        this.#suppressNextClick = false;
    }

    /**
     * windowへcaptureで購読するmousemoveのハンドラ。セッション中以外は何もしない。
     * 取りこぼし保険として、event.buttonsに開始ボタンのビットが含まれていない（mouseupを取りこぼしたまま
     * 開始ボタンが既に離れている）場合は、このmousemoveを解放とみなして#endSessionで終了処理を行い、onMoveは呼ばない。
     * それ以外は、未移動の間は押下点からのスクリーン距離が閾値を超えた時点で移動とみなしてonStart→onMoveを呼び、
     * 以降は毎回onMoveを呼ぶ。直前位置（スクリーン座標）は閾値以前も含め毎回更新する。
     * @param {MouseEvent} event
     */
    #handleWindowMouseMove(event) {
        const session = this.#session;
        if (session === null) {
            return;
        }

        const buttonBit = BUTTON_TO_BUTTONS_BIT[session.button] ?? 0;
        if ((event.buttons & buttonBit) === 0) {
            this.#endSession(event);
            return;
        }

        const screen = this.#getScreenPoint(event);
        const prevScreen = session.lastScreen;
        session.lastScreen = screen;

        if (!session.moved) {
            const distance = Math.hypot(screen.x - session.startScreen.x, screen.y - session.startScreen.y);
            if (distance <= session.threshold) {
                return;
            }
            session.moved = true;
            session.handlers.onStart?.();
        }

        session.handlers.onMove?.(event, screen, prevScreen);
    }

    /**
     * windowへcaptureで購読するmouseupのハンドラ。セッション中かつ開始ボタンが離された場合のみ#endSessionで終了する
     * （開始ボタン以外のボタンの解放では終了しない）。
     * @param {MouseEvent} event
     */
    #handleWindowMouseUp(event) {
        const session = this.#session;
        if (session === null || event.button !== session.button) {
            return;
        }

        this.#endSession(event);
    }

    /**
     * 開始ボタンの解放によるセッションの終了処理（mouseup、またはbuttonsによる取りこぼし検知のmousemoveから呼ばれる）。
     * セッションを先に破棄し（コールバック内のisActive()がfalseを返すように）、左ボタンかつ抑止条件を満たせば
     * click抑止フラグを立ててからonEndを呼ぶ。セッションがない場合は何もしない。
     * @param {MouseEvent} event 解放とみなしたイベント（onEndへそのまま渡す）
     */
    #endSession(event) {
        const session = this.#session;
        if (session === null) {
            return;
        }

        this.#session = null;
        if (session.button === 0 && (session.suppressClick === 'always' || session.moved)) {
            this.#suppressNextClick = true;
        }
        session.handlers.onEnd?.(event, session.moved);
    }

    /**
     * windowのblurイベントのハンドラ（タブ切替・ウィンドウ非アクティブ化）。
     * mouseupを取りこぼしてもセッションが残らないよう、セッション中であればcancel()で中断する
     * （blur後にclickは来ないため、click抑止フラグもcancel()内で解除される）。
     */
    #handleWindowBlur() {
        this.cancel();
    }
}
