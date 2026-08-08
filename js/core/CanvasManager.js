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
     * 状態の判定は一切行わず、渡された引数（hoveredId / selectedId / draftLine）を
     * そのまま描画に反映するだけの純粋なレンダラーとして振る舞う。
     * @param {Array<Object>} shapes - draw(ctx) / drawHover(ctx) / drawHandles(ctx) メソッドを持つ図形オブジェクトの配列
     * @param {Object} [state] - 描画状態
     * @param {string|null} [state.hoveredId] - ホバー中の図形id。一致する図形の drawHover(ctx) を追加で呼び出す
     * @param {string|null} [state.selectedId] - 選択中の図形id。一致する図形の drawHandles(ctx) を追加で呼び出す
     * @param {Object|null} [state.draftLine] - 作成中の未確定図形。draw(ctx) メソッドを持つ場合、最後に重ねて描画する
     */
    render(shapes, { hoveredId = null, selectedId = null, draftLine = null } = {}) {
        // 論理サイズに基づいてキャンバスをクリア
        const logicalWidth = parseFloat(this.canvas.style.width) || this.canvas.clientWidth;
        const logicalHeight = parseFloat(this.canvas.style.height) || this.canvas.clientHeight;
        this.ctx.clearRect(0, 0, logicalWidth, logicalHeight);

        // 各Shapeの通常描画に加え、ホバー中・選択中の強調描画をポリモーフィックに呼び出す
        for (const shape of shapes) {
            shape.draw(this.ctx);
            if (shape.id === hoveredId) {
                shape.drawHover(this.ctx);
            }
            if (shape.id === selectedId) {
                shape.drawHandles(this.ctx);
            }
        }

        // 作成中のドラフト図形があれば、最後に重ねて描画する
        if (draftLine) {
            draftLine.draw(this.ctx);
        }
    }
}
