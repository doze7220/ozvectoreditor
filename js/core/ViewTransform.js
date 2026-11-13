/**
 * 責務：キャンバスのビュー変換状態（表示倍率・オフセット）の保持と、
 * スクリーン座標⇔ワールド座標の相互変換・ズーム・パン・リセット・表示倍率とオフセットの一括設定・変更通知を担う。
 */

/**
 * キャンバスのビュー変換（表示倍率・オフセット）を保持するクラス。
 *
 * 変換式：`スクリーン = ワールド × 倍率 ＋ オフセット`
 * 逆変換：`ワールド = (スクリーン − オフセット) ÷ 倍率`
 *
 * - ワールド座標：図形データ（VectorModel・shapes/）が保持する座標。
 * - スクリーン座標：キャンバス要素の左上を原点とするCSSピクセル座標。
 *
 * スクリーン⇔ワールドの変換式は本クラスにのみ実装し、他ファイルに重複させない。
 * VectorModel・CanvasManager・図形クラス・DOMには依存しない。
 */
export class ViewTransform {
    /**
     * @type {number} 表示倍率の下限（無次元。0.1 = 10%）
     */
    static MIN_SCALE = 0.1;

    /**
     * @type {number} 表示倍率の上限（無次元。10.0 = 1000%）
     */
    static MAX_SCALE = 10.0;

    /**
     * @type {number} 現在の表示倍率（無次元。1 = 100%）
     * @private
     */
    #scale = 1;

    /**
     * @type {number} X方向のオフセット（スクリーン座標のCSSピクセル。ワールド原点の画面上のX位置）
     * @private
     */
    #offsetX = 0;

    /**
     * @type {number} Y方向のオフセット（スクリーン座標のCSSピクセル。ワールド原点の画面上のY位置）
     * @private
     */
    #offsetY = 0;

    /**
     * @type {Array<Function>} ビュー変換の変更を通知するコールバック関数の配列
     * @private
     */
    #listeners = [];

    /**
     * 現在の表示倍率を取得する。
     * @returns {number} 表示倍率（無次元。1 = 100%）
     */
    getScale() {
        return this.#scale;
    }

    /**
     * 描画用のスナップショットを取得する（呼び出しごとに新しいプレーンオブジェクトを返す）。
     * CanvasManager.render() へ渡す用途。
     * @returns {{scale: number, offsetX: number, offsetY: number}}
     *   scale：表示倍率（無次元）、offsetX/offsetY：オフセット（スクリーン座標のCSSピクセル）
     */
    getState() {
        return { scale: this.#scale, offsetX: this.#offsetX, offsetY: this.#offsetY };
    }

    /**
     * スクリーン座標をワールド座標へ変換する（`(スクリーン − オフセット) ÷ 倍率`）。
     * @param {number} sx スクリーン座標のX（CSSピクセル）
     * @param {number} sy スクリーン座標のY（CSSピクセル）
     * @returns {{x: number, y: number}} ワールド座標
     */
    screenToWorld(sx, sy) {
        return {
            x: (sx - this.#offsetX) / this.#scale,
            y: (sy - this.#offsetY) / this.#scale
        };
    }

    /**
     * ワールド座標をスクリーン座標へ変換する（`ワールド × 倍率 ＋ オフセット`）。
     * @param {number} wx ワールド座標のX
     * @param {number} wy ワールド座標のY
     * @returns {{x: number, y: number}} スクリーン座標（CSSピクセル）
     */
    worldToScreen(wx, wy) {
        return {
            x: wx * this.#scale + this.#offsetX,
            y: wy * this.#scale + this.#offsetY
        };
    }

    /**
     * スクリーン上の長さをワールド上の長さへ換算する（`長さ ÷ 倍率`）。
     * 当たり判定の許容誤差（画面上のピクセル数）をワールド換算する用途。
     * @param {number} length スクリーン上の長さ（CSSピクセル）
     * @returns {number} ワールド上の長さ
     */
    screenLengthToWorld(length) {
        return length / this.#scale;
    }

    /**
     * 指定したスクリーン座標を中心に、倍率を factor 倍してズームする。
     * 倍率は MIN_SCALE〜MAX_SCALE にクランプする。クランプ後の倍率でオフセットを再計算するため、
     * クランプ時もカーソル下（中心点）のワールド点は不変。
     * 倍率が変化しない場合（既に上限/下限に張り付いている場合）は何もせず、通知もしない。
     * @param {number} sx ズーム中心のスクリーン座標X（CSSピクセル）
     * @param {number} sy ズーム中心のスクリーン座標Y（CSSピクセル）
     * @param {number} factor 倍率の乗数（正の有限数。1より大きいと拡大、小さいと縮小）
     */
    zoomAt(sx, sy, factor) {
        if (!Number.isFinite(factor) || factor <= 0) {
            console.warn(`ViewTransform.zoomAt: 不正な factor が指定されました: ${factor}`);
            return;
        }

        const world = this.screenToWorld(sx, sy);
        const newScale = Math.min(
            Math.max(this.#scale * factor, ViewTransform.MIN_SCALE),
            ViewTransform.MAX_SCALE
        );
        if (newScale === this.#scale) {
            return;
        }

        this.#scale = newScale;
        this.#offsetX = sx - world.x * newScale;
        this.#offsetY = sy - world.y * newScale;
        this.#notifyChange();
    }

    /**
     * ビューを平行移動（パン）する。移動量が0の場合は何もせず、通知もしない。
     * @param {number} dx X方向の移動量（スクリーン座標のCSSピクセル）
     * @param {number} dy Y方向の移動量（スクリーン座標のCSSピクセル）
     */
    panBy(dx, dy) {
        if (dx === 0 && dy === 0) {
            return;
        }
        this.#offsetX += dx;
        this.#offsetY += dy;
        this.#notifyChange();
    }

    /**
     * ビュー変換を初期状態（倍率1.0・ワールド原点が指定したスクリーン座標に来るオフセット）へ戻す。
     * 既に同じ状態の場合は何もせず、通知もしない。キャンバスの大きさは知らず、原点を置く位置は呼び出し側が渡す。
     * 引数が有限の数でなければ`console.warn`して`0`として扱う。
     * @param {number} [originX=0] ワールド原点を置くスクリーン座標のX（CSSピクセル）
     * @param {number} [originY=0] ワールド原点を置くスクリーン座標のY（CSSピクセル）
     */
    reset(originX = 0, originY = 0) {
        if (!Number.isFinite(originX)) {
            console.warn(`ViewTransform.reset: 不正な originX が指定されました: ${originX}`);
            originX = 0;
        }
        if (!Number.isFinite(originY)) {
            console.warn(`ViewTransform.reset: 不正な originY が指定されました: ${originY}`);
            originY = 0;
        }
        if (this.#scale === 1 && this.#offsetX === originX && this.#offsetY === originY) {
            return;
        }
        this.#scale = 1;
        this.#offsetX = originX;
        this.#offsetY = originY;
        this.#notifyChange();
    }

    /**
     * 表示倍率とオフセットを一括で設定する（設定だけ。変換式は持たない）。
     * 倍率は MIN_SCALE〜MAX_SCALE に収める。収めた後の値が今と同じなら何もせず、通知もしない。
     * `scale`が正の有限の数でない、または`offsetX`・`offsetY`が有限の数でなければ`console.warn`して何もしない。
     * @param {number} scale 表示倍率（正の有限数。無次元。1 = 100%）
     * @param {number} offsetX X方向のオフセット（スクリーン座標のCSSピクセル。有限の数）
     * @param {number} offsetY Y方向のオフセット（スクリーン座標のCSSピクセル。有限の数）
     */
    setView(scale, offsetX, offsetY) {
        if (!Number.isFinite(scale) || scale <= 0 || !Number.isFinite(offsetX) || !Number.isFinite(offsetY)) {
            console.warn(`ViewTransform.setView: 不正な値が指定されました: scale=${scale}, offsetX=${offsetX}, offsetY=${offsetY}`);
            return;
        }
        const newScale = Math.min(
            Math.max(scale, ViewTransform.MIN_SCALE),
            ViewTransform.MAX_SCALE
        );
        if (newScale === this.#scale && offsetX === this.#offsetX && offsetY === this.#offsetY) {
            return;
        }
        this.#scale = newScale;
        this.#offsetX = offsetX;
        this.#offsetY = offsetY;
        this.#notifyChange();
    }

    /**
     * ビュー変換の変更時に呼び出されるコールバック関数を登録する。
     * @param {Function} callback 登録するコールバック関数（関数以外は無視する）
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this.#listeners.push(callback);
        }
    }

    /**
     * 登録されたすべてのリスナーに変更を通知する。
     * @private
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}
