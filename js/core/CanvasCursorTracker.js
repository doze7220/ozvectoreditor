/**
 * 責務：キャンバス上の最後のカーソル位置（スクリーン座標。キャンバスの外なら「なし」）の保持と変更通知のみを担う。
 * VectorModel・ViewTransform・図形に依存しない。
 */

/**
 * キャンバス上の最後のカーソル位置を追跡するクラス。
 * スクリーン座標の求め方とワールド座標への変換は注入された関数に任せ、二重に実装しない。
 *
 * 実コードで確かめた動き：
 * - ドラッグ中：キャンバス要素のmousemove自体は発火するため、カーソルがキャンバスの上にある間は追跡が続く。
 *   ドラッグのままツールバー・定規・ステータスバー・フロートウィンドウの上へ出るとmouseleaveで「なし」になる。
 * - パン中：DragTrackerのwindow captureのmousemove（パン→ビュー変換の通知）が先、続いてキャンバスのmousemove
 *   （位置の更新→通知）が来るため、1回の移動の後の表示は正しい値になる。
 * - フロートウィンドウの上：キャンバスの祖先ではない兄弟要素のため、キャンバスからウィンドウへ移るとmouseleaveで「なし」になる。
 * - 読み込み中：覆い要素がキャンバスの上にありmousemoveが来ないため「なし」のまま。
 * - ページを開いた直後（まだmousemoveが無い）も「なし」。
 */
export class CanvasCursorTracker {
    /**
     * @param {HTMLCanvasElement} canvas カーソルを追跡するキャンバス要素
     * @param {Object} deps 注入する関数
     * @param {(event: MouseEvent) => {x: number, y: number}} deps.getScreenPoint マウスイベントからスクリーン座標を求める関数
     * @param {(x: number, y: number) => {x: number, y: number}} deps.screenToWorld スクリーン座標をワールド座標へ変換する関数
     * @throws {Error} getScreenPoint・screenToWorld が関数でないとき
     */
    constructor(canvas, { getScreenPoint, screenToWorld } = {}) {
        if (typeof getScreenPoint !== 'function' || typeof screenToWorld !== 'function') {
            throw new Error('CanvasCursorTracker: getScreenPoint・screenToWorld は関数で指定してください');
        }
        /** @type {(event: MouseEvent) => {x: number, y: number}} */
        this._getScreenPoint = getScreenPoint;
        /** @type {(x: number, y: number) => {x: number, y: number}} */
        this._screenToWorld = screenToWorld;
        /** 最後のカーソル位置（スクリーン座標）。キャンバスの外・未取得なら null
         * @type {{x: number, y: number}|null} */
        this._screenPosition = null;
        /** @type {Array<() => void>} */
        this._listeners = [];

        canvas.addEventListener('mousemove', (event) => this._handleMouseMove(event));
        canvas.addEventListener('mouseleave', () => this._handleMouseLeave());
    }

    /**
     * 最後のカーソル位置（スクリーン座標）のコピーを返す。
     * @returns {{x: number, y: number}|null} 位置。キャンバスの外・未取得なら null
     */
    getScreenPosition() {
        return this._screenPosition ? { x: this._screenPosition.x, y: this._screenPosition.y } : null;
    }

    /**
     * 最後のカーソル位置を、呼んだ時点のビュー変換でワールド座標へ変換して返す。
     * @returns {{x: number, y: number}|null} ワールド座標。カーソル位置が無ければ null
     */
    getWorldPosition() {
        if (!this._screenPosition) return null;
        return this._screenToWorld(this._screenPosition.x, this._screenPosition.y);
    }

    /**
     * カーソル位置の変更通知のコールバックを登録する。
     * @param {() => void} callback 位置が変わったとき（「なし」への変化を含む）に呼ばれる。関数以外は無視する
     * @returns {void}
     */
    onChange(callback) {
        if (typeof callback === 'function') this._listeners.push(callback);
    }

    /**
     * mousemoveで位置を記録し、前と違うときだけ通知する。
     * @param {MouseEvent} event
     * @returns {void}
     */
    _handleMouseMove(event) {
        const point = this._getScreenPoint(event);
        const prev = this._screenPosition;
        if (prev && prev.x === point.x && prev.y === point.y) return;
        this._screenPosition = { x: point.x, y: point.y };
        this._notify();
    }

    /**
     * mouseleaveで位置を「なし」にし、前が「なし」でなければ通知する。
     * @returns {void}
     */
    _handleMouseLeave() {
        if (this._screenPosition === null) return;
        this._screenPosition = null;
        this._notify();
    }

    /**
     * 登録済みのコールバックをすべて呼ぶ。
     * @returns {void}
     */
    _notify() {
        for (const listener of this._listeners) listener();
    }
}
