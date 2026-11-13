/**
 * 責務：定規（横・縦の2本）の`<canvas>`への純粋な描画（目盛り・数字・カーソル位置の印）のみを担う。
 * ビュー変換値・カーソル位置は引数で受け取り、状態は保持しない。
 */

import { computeGridSpacing } from './GridSpacingRules.js';
import { computeRulerTicks, formatRulerLabel } from './RulerTickRules.js';

/**
 * 目盛りの線の色（背景の白/黒によらず一定）。
 * @type {string}
 */
const TICK_COLOR = '#888888';

/**
 * 数字の色（背景の白/黒によらず一定）。
 * @type {string}
 */
const LABEL_COLOR = '#444444';

/**
 * 数字のフォント。
 * @type {string}
 */
const LABEL_FONT = '10px sans-serif';

/**
 * カーソル位置の印の色。
 * @type {string}
 */
const CURSOR_MARK_COLOR = '#e00000';

/**
 * 細線の位置の短い目盛りの長さ（CSSピクセル。キャンバス側の辺から測る）。
 * @type {number}
 */
const MINOR_TICK_LENGTH = 5;

/**
 * 数字を目盛り線から離す距離（CSSピクセル）。
 * @type {number}
 */
const LABEL_MARGIN = 2;

/**
 * 定規2本を描くレンダラー。render()の引数（ビュー変換値・カーソル位置）のみから毎回描画し、
 * アプリケーション状態は保持しない（保持するのは2つのCanvas要素・2Dコンテキスト・dprのみ）。
 * 地の色は描かない（CSSの背景色に任せ、Canvasは透明に消す）。
 */
export class RulerRenderer {
    /**
     * `resize()`で算出したデバイスピクセル比（dpr）。描画バッファの設定値のみ。
     * @type {number}
     */
    #pixelRatio = 1;

    /**
     * 要素が揃っていて描画できるか。
     * @type {boolean}
     */
    #ready = false;

    /**
     * @param {HTMLCanvasElement} horizontalCanvas - 横の定規の要素
     * @param {HTMLCanvasElement} verticalCanvas - 縦の定規の要素
     */
    constructor(horizontalCanvas, verticalCanvas) {
        if (!horizontalCanvas || !verticalCanvas) {
            console.warn('RulerRenderer: 定規の要素が見つかりません。描画しません。');
            return;
        }
        this.horizontalCanvas = horizontalCanvas;
        this.verticalCanvas = verticalCanvas;
        this.horizontalCtx = horizontalCanvas.getContext('2d');
        this.verticalCtx = verticalCanvas.getContext('2d');
        this.#ready = true;

        this.resize();
    }

    /**
     * dprの算出と2つの内部バッファサイズの同期のみを行う（`render()`は呼ばない）。
     * 呼ばれた時点の`clientWidth/Height` × dprへ同期する。
     * 要素が無い場合は何もしない。
     */
    resize() {
        if (!this.#ready) return;
        const dpr = window.devicePixelRatio || 1;
        this.#pixelRatio = dpr;
        for (const canvas of [this.horizontalCanvas, this.verticalCanvas]) {
            canvas.width = Math.max(1, Math.round(canvas.clientWidth * dpr));
            canvas.height = Math.max(1, Math.round(canvas.clientHeight * dpr));
        }
    }

    /**
     * 定規2本を描く。2本とも全体を消してから描く。
     * `view.scale`が正の有限値でない（`view`未指定を含む）ときは、例外を投げず目盛り・数字を描かない
     * （カーソル位置の印は`cursor`があれば描く）。
     * @param {Object} params
     * @param {{scale: number, offsetX: number, offsetY: number}} params.view - ビュー変換値（必須。`viewTransform.getState()`）
     * @param {{x: number, y: number}|null} [params.cursor=null] - キャンバス要素左上基準のスクリーン座標、または`null`
     */
    render({ view, cursor = null } = {}) {
        if (!this.#ready) return;

        const dpr = this.#pixelRatio;
        const hCtx = this.horizontalCtx;
        const vCtx = this.verticalCtx;
        const hWidth = this.horizontalCanvas.width / dpr;
        const hHeight = this.horizontalCanvas.height / dpr;
        const vWidth = this.verticalCanvas.width / dpr;
        const vHeight = this.verticalCanvas.height / dpr;

        for (const ctx of [hCtx, vCtx]) {
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        const scale = view ? view.scale : NaN;
        if (Number.isFinite(scale) && scale > 0) {
            this.#drawTicks(view, hWidth, hHeight, vWidth, vHeight);
        }

        if (cursor) {
            hCtx.fillStyle = CURSOR_MARK_COLOR;
            hCtx.fillRect(cursor.x - 0.5, 0, 1, hHeight);
            vCtx.fillStyle = CURSOR_MARK_COLOR;
            vCtx.fillRect(0, cursor.y - 0.5, vWidth, 1);
        }
    }

    /**
     * 目盛り・数字を2本の定規へ描く（描画変換はCSSピクセル単位に設定済みであること）。
     * ワールド⇔定規の位置は、ビュー変換値の行列とその逆行列で写す。
     * @param {{scale: number, offsetX: number, offsetY: number}} view - ビュー変換値（scaleは正の有限値）
     * @param {number} hWidth - 横の定規の幅（CSSピクセル）
     * @param {number} hHeight - 横の定規の高さ（CSSピクセル）
     * @param {number} vWidth - 縦の定規の幅（CSSピクセル）
     * @param {number} vHeight - 縦の定規の高さ（CSSピクセル）
     */
    #drawTicks(view, hWidth, hHeight, vWidth, vHeight) {
        const matrix = new DOMMatrix([view.scale, 0, 0, view.scale, view.offsetX, view.offsetY]);
        const inverse = matrix.inverse();
        const { minor, major } = computeGridSpacing(view.scale);

        // 横の定規：x軸
        {
            const ctx = this.horizontalCtx;
            const minX = inverse.transformPoint({ x: 0, y: 0 }).x;
            const maxX = inverse.transformPoint({ x: hWidth, y: 0 }).x;
            ctx.lineWidth = 1;
            ctx.strokeStyle = TICK_COLOR;
            ctx.fillStyle = LABEL_COLOR;
            ctx.font = LABEL_FONT;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            for (const tick of computeRulerTicks(minX, maxX, minor, major)) {
                const x = matrix.transformPoint({ x: tick.value, y: 0 }).x;
                const length = tick.major ? hHeight : MINOR_TICK_LENGTH;
                ctx.beginPath();
                ctx.moveTo(x, hHeight);
                ctx.lineTo(x, hHeight - length);
                ctx.stroke();
                if (tick.major) {
                    ctx.fillText(formatRulerLabel(tick.value), x + LABEL_MARGIN, 0);
                }
            }
        }

        // 縦の定規：y軸
        {
            const ctx = this.verticalCtx;
            const minY = inverse.transformPoint({ x: 0, y: 0 }).y;
            const maxY = inverse.transformPoint({ x: 0, y: vHeight }).y;
            ctx.lineWidth = 1;
            ctx.strokeStyle = TICK_COLOR;
            ctx.fillStyle = LABEL_COLOR;
            ctx.font = LABEL_FONT;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';
            for (const tick of computeRulerTicks(minY, maxY, minor, major)) {
                const y = matrix.transformPoint({ x: 0, y: tick.value }).y;
                const length = tick.major ? vWidth : MINOR_TICK_LENGTH;
                ctx.beginPath();
                ctx.moveTo(vWidth, y);
                ctx.lineTo(vWidth - length, y);
                ctx.stroke();
                if (tick.major) {
                    // 数字は太線の下側に-90°回転して描く（定規の幅に収まる）
                    ctx.save();
                    ctx.translate(0, y + LABEL_MARGIN);
                    ctx.rotate(-Math.PI / 2);
                    ctx.textAlign = 'right';
                    ctx.fillText(formatRulerLabel(tick.value), 0, 0);
                    ctx.restore();
                }
            }
        }
    }
}
