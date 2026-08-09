/**
 * 責務: `.float-window`要素群の「ドラッグ移動」「アクティブ最前面化」「子要素からの
 * イベント伝播遮断」を一元的に管理する。図形データ・選択状態・ツール状態など
 * VectorModel/InputTrackerが持つ状態には一切関与しない（DOM操作専任）。
 */

export class WindowManager {
    /**
     * @type {number} 最前面化のためのz-index採番カウンタ。mousedownの度に++してから書き込む。
     * @private
     */
    #currentMaxZIndex;

    /**
     * @type {HTMLElement|null} 現在ドラッグ中の`.float-window`要素。ドラッグ中でなければnull。
     * window単位のmousemove/mouseupはこのフィールドの有無でドラッグ中か否かを判定する。
     * @private
     */
    #draggingWindow;

    /**
     * @type {number} ドラッグ開始時点のマウスX座標（clientX）。以後のdx計算の基準点。
     * @private
     */
    #dragStartMouseX;

    /**
     * @type {number} ドラッグ開始時点のマウスY座標（clientY）。以後のdy計算の基準点。
     * @private
     */
    #dragStartMouseY;

    /**
     * @type {number} ドラッグ開始時点の対象ウィンドウのleft座標（px）。dx加算の基準点。
     * @private
     */
    #dragStartLeft;

    /**
     * @type {number} ドラッグ開始時点の対象ウィンドウのtop座標（px）。dy加算の基準点。
     * @private
     */
    #dragStartTop;

    /**
     * DOM上に存在する`.float-window`要素を自動検知し、各要素へイベント遮断・最前面化・
     * ドラッグ開始の配線を行う。ドラッグ追従・解除はwindowレベルで1本だけ配線する
     * （マウスがウィンドウ外に外れても追従・解除が継続するようにするため）。
     * 動的に後から追加される`.float-window`の再検知（MutationObserver等）は行わない。
     */
    constructor() {
        this.#currentMaxZIndex = 10;
        this.#draggingWindow = null;
        this.#dragStartMouseX = 0;
        this.#dragStartMouseY = 0;
        this.#dragStartLeft = 0;
        this.#dragStartTop = 0;

        const windowElements = document.querySelectorAll('.float-window');
        windowElements.forEach((windowEl) => this.#setupWindow(windowEl));

        window.addEventListener('mousemove', this.#handleWindowMouseMove.bind(this), true);
        window.addEventListener('mouseup', this.#handleWindowMouseUp.bind(this), true);
    }

    /**
     * 1つの`.float-window`要素に対し、イベント遮断・最前面化・ドラッグ開始の配線を行う。
     * mousedownリスナー1本で「イベント伝播遮断」と「最前面化（z-index更新）」の両方を担い、
     * click/mousemove/mouseupの3種は伝播遮断のみを担う。
     * `.window-header`が存在する場合のみ、そこへドラッグ開始用のmousedownリスナーを追加する。
     * @param {Element} windowEl 配線対象の`.float-window`要素
     * @private
     */
    #setupWindow(windowEl) {
        windowEl.addEventListener('mousedown', (event) => {
            event.stopPropagation();
            this.#currentMaxZIndex += 1;
            windowEl.style.zIndex = String(this.#currentMaxZIndex);
        });
        windowEl.addEventListener('click', (event) => event.stopPropagation());
        windowEl.addEventListener('mousemove', (event) => event.stopPropagation());
        windowEl.addEventListener('mouseup', (event) => event.stopPropagation());

        const header = windowEl.querySelector('.window-header');
        if (!header) {
            return;
        }

        header.addEventListener('mousedown', (event) => this.#startDrag(event, windowEl));
    }

    /**
     * `.window-header`上でのmousedownを受けてドラッグ状態を開始する。
     * `getBoundingClientRect()`で現在の表示位置を取得し、`style.right`を`'auto'`へ
     * クリアした上で`style.left`/`style.top`基準へ切り替える（`position: fixed`のため
     * 見た目上の位置は変化しない）。以後のマウス移動量(dx, dy)はこの開始時点の座標を
     * 基準に加算する。
     * @param {MouseEvent} event `.window-header`のmousedownイベント
     * @param {Element} windowEl ドラッグ対象の`.float-window`要素
     * @private
     */
    #startDrag(event, windowEl) {
        const rect = windowEl.getBoundingClientRect();

        windowEl.style.right = 'auto';
        windowEl.style.left = `${rect.left}px`;
        windowEl.style.top = `${rect.top}px`;

        this.#draggingWindow = windowEl;
        this.#dragStartMouseX = event.clientX;
        this.#dragStartMouseY = event.clientY;
        this.#dragStartLeft = rect.left;
        this.#dragStartTop = rect.top;
    }

    /**
     * window全体で1本だけ配線されるmousemoveハンドラ。ドラッグ中（`#draggingWindow`が
     * 非null）の場合のみ、ドラッグ開始時点からのマウス移動量(dx, dy)を開始時点の
     * left/topへ加算して対象ウィンドウの位置を更新する。ドラッグ中でなければ何もしない。
     * @param {MouseEvent} event windowのmousemoveイベント
     * @private
     */
    #handleWindowMouseMove(event) {
        if (!this.#draggingWindow) {
            return;
        }

        const dx = event.clientX - this.#dragStartMouseX;
        const dy = event.clientY - this.#dragStartMouseY;

        this.#draggingWindow.style.left = `${this.#dragStartLeft + dx}px`;
        this.#draggingWindow.style.top = `${this.#dragStartTop + dy}px`;
    }

    /**
     * window全体で1本だけ配線されるmouseupハンドラ。`#draggingWindow`をnullへ戻し、
     * ドラッグ状態を終了する。マウスがウィンドウ外やブラウザ外で放されても、windowレベルの
     * 購読のため確実に解除される。
     * @private
     */
    #handleWindowMouseUp() {
        this.#draggingWindow = null;
    }
}
