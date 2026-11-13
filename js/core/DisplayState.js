/**
 * 責務：表示の状態（アウトライン表示・背景の白/黒・グリッドの表示・フロートウィンドウの表示）の保持・切り替え・変更通知のみを担う。
 * DOM・VectorModel・CanvasManager・図形に依存しない（表示専用の状態。ViewTransformと同じ位置づけ）。
 */

/**
 * @typedef {Object} DisplayStateSnapshot
 * @property {boolean} outline - アウトライン表示がONか
 * @property {boolean} darkBackground - 背景が黒か
 * @property {boolean} gridVisible - グリッドを表示しているか
 * @property {boolean} floatWindowsVisible - フロートウィンドウを表示しているか
 */

/**
 * 表示の状態を保持するクラス。作業データ・履歴・保存先には含まれない（ページを開き直すと初期値に戻る）。
 */
export class DisplayState {
    /**
     * @type {boolean} アウトライン表示がONか
     * @private
     */
    #outline = false;

    /**
     * @type {boolean} 背景が黒か
     * @private
     */
    #darkBackground = false;

    /**
     * @type {boolean} グリッドを表示しているか
     * @private
     */
    #gridVisible = true;

    /**
     * @type {boolean} フロートウィンドウを表示しているか
     * @private
     */
    #floatWindowsVisible = true;

    /**
     * @type {Array<Function>} 変更を通知するコールバック関数の配列
     * @private
     */
    #listeners = [];

    /**
     * 表示の状態のスナップショットを取得する（呼び出しごとに新しいプレーンオブジェクトを返す）。
     * @returns {DisplayStateSnapshot}
     */
    getState() {
        return {
            outline: this.#outline,
            darkBackground: this.#darkBackground,
            gridVisible: this.#gridVisible,
            floatWindowsVisible: this.#floatWindowsVisible,
        };
    }

    /**
     * アウトライン表示がONかを返す。
     * @returns {boolean}
     */
    isOutline() {
        return this.#outline;
    }

    /**
     * フロートウィンドウを表示しているかを返す。
     * @returns {boolean}
     */
    isFloatWindowsVisible() {
        return this.#floatWindowsVisible;
    }

    /**
     * アウトライン表示を設定する。真偽値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {boolean} value - ONならtrue
     * @returns {void}
     */
    setOutline(value) {
        if (typeof value !== 'boolean') {
            console.warn(`DisplayState.setOutline: 真偽値ではない値が指定されました: ${value}`);
            return;
        }
        if (value === this.#outline) return;
        this.#outline = value;
        this.#notifyChange();
    }

    /**
     * 背景の白/黒を設定する。真偽値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {boolean} value - 黒ならtrue
     * @returns {void}
     */
    setDarkBackground(value) {
        if (typeof value !== 'boolean') {
            console.warn(`DisplayState.setDarkBackground: 真偽値ではない値が指定されました: ${value}`);
            return;
        }
        if (value === this.#darkBackground) return;
        this.#darkBackground = value;
        this.#notifyChange();
    }

    /**
     * グリッドの表示を設定する。真偽値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {boolean} value - 表示ならtrue
     * @returns {void}
     */
    setGridVisible(value) {
        if (typeof value !== 'boolean') {
            console.warn(`DisplayState.setGridVisible: 真偽値ではない値が指定されました: ${value}`);
            return;
        }
        if (value === this.#gridVisible) return;
        this.#gridVisible = value;
        this.#notifyChange();
    }

    /**
     * フロートウィンドウの表示を設定する。真偽値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {boolean} value - 表示ならtrue
     * @returns {void}
     */
    setFloatWindowsVisible(value) {
        if (typeof value !== 'boolean') {
            console.warn(`DisplayState.setFloatWindowsVisible: 真偽値ではない値が指定されました: ${value}`);
            return;
        }
        if (value === this.#floatWindowsVisible) return;
        this.#floatWindowsVisible = value;
        this.#notifyChange();
    }

    /**
     * アウトライン表示を反転する（通知1回）。
     * @returns {void}
     */
    toggleOutline() {
        this.setOutline(!this.#outline);
    }

    /**
     * 背景の白/黒を反転する（通知1回）。
     * @returns {void}
     */
    toggleBackground() {
        this.setDarkBackground(!this.#darkBackground);
    }

    /**
     * グリッドの表示を反転する（通知1回）。
     * @returns {void}
     */
    toggleGrid() {
        this.setGridVisible(!this.#gridVisible);
    }

    /**
     * フロートウィンドウの表示を反転する（通知1回）。
     * @returns {void}
     */
    toggleFloatWindows() {
        this.setFloatWindowsVisible(!this.#floatWindowsVisible);
    }

    /**
     * 変更通知のコールバックを登録する。関数以外は無視する。
     * @param {Function} callback - 変更のたびに引数なしで呼ばれる関数
     * @returns {void}
     */
    onChange(callback) {
        if (typeof callback !== 'function') return;
        this.#listeners.push(callback);
    }

    /**
     * 登録済みのコールバックをすべて呼ぶ。
     * @returns {void}
     * @private
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}
