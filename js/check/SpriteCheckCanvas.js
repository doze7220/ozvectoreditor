/**
 * 責務: 確認用ページの描画領域の大きさ（ウィンドウ・devicePixelRatio）の調整と、背景・外枠・原点の印・スプライトのdrawの呼び出しによる描画を担う。
 * 表示するスプライトは保持しない。
 */

/**
 * 背景色。
 * @type {string}
 */
const BACKGROUND_COLOR = '#ffffff';

/**
 * 外枠の線の色（青系）。
 * @type {string}
 */
const BOUNDS_COLOR = '#2a7ae2';

/**
 * 外枠の破線パターン（px）。
 * @type {number[]}
 */
const BOUNDS_DASH = [4, 4];

/**
 * 原点の印の線の色（赤系）。
 * @type {string}
 */
const ORIGIN_COLOR = '#e53935';

/**
 * 原点の印（十字）の腕の長さ（px。中心から片側）。
 * @type {number}
 */
const ORIGIN_ARM = 12;

/**
 * 印・外枠の線幅（px。奇数幅のため座標に0.5を足してにじみを防ぐ）。
 * @type {number}
 */
const GUIDE_LINE_WIDTH = 1;

/**
 * 外枠の値（`bounds`をそのまま使う）。
 * @typedef {{minX: number, minY: number, maxX: number, maxY: number}} CheckBounds
 */

/**
 * 確認用ページの描画領域。原点(0, 0)を中央に置き、等倍で描く。
 * 保持する状態は描画領域の大きさ（CSSの幅・高さ・dpr）のみで、スプライト・外枠・ファイルの情報は持たない。
 * DOMは`canvas`と親要素のみ扱う。呼び出し元: `SpriteCheckPage`。
 */
export class SpriteCheckCanvas {
    /** @type {HTMLCanvasElement} */
    #canvas;
    /** @type {HTMLElement} */
    #area;
    /** @type {CanvasRenderingContext2D} */
    #ctx;
    /** @type {number} */
    #cssWidth = 0;
    /** @type {number} */
    #cssHeight = 0;
    /** @type {number} */
    #dpr = 1;

    /**
     * @param {HTMLCanvasElement} canvas - 描画先の`canvas`
     * @param {HTMLElement} area - `canvas`の大きさを決める親要素
     */
    constructor(canvas, area) {
        this.#canvas = canvas;
        this.#area = area;
        this.#ctx = canvas.getContext('2d');
    }

    /**
     * 親要素の大きさに`canvas`を合わせる（内部の大きさはCSSの大きさ×`devicePixelRatio`を丸めた値）。
     * 描き直しは呼び出し元が行う。
     * @returns {void}
     */
    resize() {
        this.#cssWidth = this.#area.clientWidth;
        this.#cssHeight = this.#area.clientHeight;
        this.#dpr = window.devicePixelRatio || 1;
        this.#canvas.style.width = `${this.#cssWidth}px`;
        this.#canvas.style.height = `${this.#cssHeight}px`;
        this.#canvas.width = Math.max(1, Math.round(this.#cssWidth * this.#dpr));
        this.#canvas.height = Math.max(1, Math.round(this.#cssHeight * this.#dpr));
    }

    /**
     * 背景のみを描く（印も外枠も描かない）。
     * @returns {void}
     */
    clear() {
        this.#paintBackground();
    }

    /**
     * 背景 → 外枠 → 原点の印 → スプライトの絵の順に描く。`sprite.draw`の例外は捕捉せず投げる。
     * @param {{draw: function(CanvasRenderingContext2D): void}} sprite - 描くスプライト
     * @param {CheckBounds|null} bounds - 外枠の値（`null`なら外枠を描かない。再計算しない）
     * @returns {void}
     */
    render(sprite, bounds) {
        const ctx = this.#ctx;
        const originX = Math.round(this.#cssWidth / 2);
        const originY = Math.round(this.#cssHeight / 2);
        this.#paintBackground();
        ctx.setTransform(this.#dpr, 0, 0, this.#dpr, originX * this.#dpr, originY * this.#dpr);

        ctx.save();
        ctx.lineWidth = GUIDE_LINE_WIDTH;
        if (bounds) {
            ctx.strokeStyle = BOUNDS_COLOR;
            ctx.setLineDash(BOUNDS_DASH);
            ctx.strokeRect(
                bounds.minX + 0.5,
                bounds.minY + 0.5,
                bounds.maxX - bounds.minX,
                bounds.maxY - bounds.minY
            );
        }
        ctx.setLineDash([]);
        ctx.strokeStyle = ORIGIN_COLOR;
        ctx.beginPath();
        ctx.moveTo(-ORIGIN_ARM, 0.5);
        ctx.lineTo(ORIGIN_ARM + 1, 0.5);
        ctx.moveTo(0.5, -ORIGIN_ARM);
        ctx.lineTo(0.5, ORIGIN_ARM + 1);
        ctx.stroke();
        ctx.restore();

        ctx.save();
        try {
            sprite.draw(ctx);
        } finally {
            ctx.restore();
        }
    }

    /**
     * 変換を初期化して背景を白で塗りつぶす。
     * @returns {void}
     */
    #paintBackground() {
        const ctx = this.#ctx;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = BACKGROUND_COLOR;
        ctx.fillRect(0, 0, this.#canvas.width, this.#canvas.height);
    }
}
