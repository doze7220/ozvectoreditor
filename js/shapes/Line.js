/**
 * 責務: 直線のデータ保持とCanvasへの描画処理を担う。
 */
export class Line {
    /**
     * @param {number} x1 - 始点のX座標
     * @param {number} y1 - 始点のY座標
     * @param {number} x2 - 終点のX座標
     * @param {number} y2 - 終点のY座標
     * @param {string} [strokeColor='#000000'] - 線の色
     * @param {number} [strokeWidth=2] - 線の太さ
     */
    constructor(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
    }

    /**
     * Canvasに直線を描画する
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    draw(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);
        
        // 自身のプロパティとして保持するスタイルを適用
        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
    }
}
