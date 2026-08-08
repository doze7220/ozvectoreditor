/**
 * 責務：Canvas要素への純粋な描画処理のみを担う。
 */
export class CanvasManager {
    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.initCanvasSize();
    }

    /**
     * 高DPIディスプレイ対応のため、キャンバスの内部バッファサイズを調整し、
     * 描画スケールを初期化する。
     */
    initCanvasSize() {
        const dpr = window.devicePixelRatio || 1;
        
        // 現在のレイアウト上の表示サイズ（論理サイズ）を取得
        const logicalWidth = this.canvas.clientWidth;
        const logicalHeight = this.canvas.clientHeight;

        // CSS上の表示サイズを明示的に固定（内部バッファ変更によるレイアウト崩れ防止）
        this.canvas.style.width = `${logicalWidth}px`;
        this.canvas.style.height = `${logicalHeight}px`;

        // 内部バッファのサイズをdpr倍にして鮮明化する
        this.canvas.width = logicalWidth * dpr;
        this.canvas.height = logicalHeight * dpr;
        
        /**
         * ※将来的にキャンバスのズーム機能を追加する際は、本箇所のスケール計算ロジックの修正が必要
         */
        this.ctx.scale(dpr, dpr);
    }

    /**
     * 画面をクリアし、指定された図形リストを全て描画する。
     * @param {Array<Object>} shapes - draw(ctx) メソッドを持つ図形オブジェクトの配列
     */
    render(shapes) {
        // 論理サイズに基づいてキャンバスをクリア
        const logicalWidth = parseFloat(this.canvas.style.width) || this.canvas.clientWidth;
        const logicalHeight = parseFloat(this.canvas.style.height) || this.canvas.clientHeight;
        this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // 各Shapeの描画ロジックを呼び出す
        for (const shape of shapes) {
            shape.draw(this.ctx);
        }
    }
}
