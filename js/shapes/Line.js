/**
 * 責務: 直線のデータ保持・Canvasへの描画処理・当たり判定を担う。
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
        /** @type {string|number|null} 図形の一意なID。採番ロジックは持たず、外部（VectorModel）から設定される。 */
        this.id = null;
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
    }

    /**
     * 点(x, y)が線分本体の許容誤差(tolerance)以内にあるかを判定する当たり判定。
     * @param {number} x - 判定対象点のX座標（論理座標系）
     * @param {number} y - 判定対象点のY座標（論理座標系）
     * @param {number} tolerance - 許容誤差（論理座標系のピクセル単位）
     * @returns {boolean} 線分との距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        const dx = this.x2 - this.x1;
        const dy = this.y2 - this.y1;
        const lengthSquared = dx * dx + dy * dy;

        let t = lengthSquared === 0
            ? 0
            : ((x - this.x1) * dx + (y - this.y1) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const closestX = this.x1 + t * dx;
        const closestY = this.y1 + t * dy;
        const distX = x - closestX;
        const distY = y - closestY;

        return Math.sqrt(distX * distX + distY * distY) <= tolerance;
    }

    /**
     * 点(x, y)が始点・終点・移動（中点）のいずれかのハンドルの許容誤差(tolerance)以内にあるかを判定する。
     * 複数のハンドルが同時にtolerance以内となる場合は、start → end → move の優先順位で先着1件を返す。
     * @param {number} x - 判定対象点のX座標（論理座標系）
     * @param {number} y - 判定対象点のY座標（論理座標系）
     * @param {number} tolerance - 許容誤差（論理座標系のピクセル単位）
     * @returns {'start'|'end'|'move'|null} 該当したハンドルの種別。いずれにも該当しなければnull
     */
    hitTestHandle(x, y, tolerance) {
        const distTo = (hx, hy) => Math.hypot(x - hx, y - hy);

        if (distTo(this.x1, this.y1) <= tolerance) return 'start';
        if (distTo(this.x2, this.y2) <= tolerance) return 'end';

        const midX = (this.x1 + this.x2) / 2;
        const midY = (this.y1 + this.y2) / 2;
        if (distTo(midX, midY) <= tolerance) return 'move';

        return null;
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * vertexIndexが0であれば始点(x1, y1)を、1であれば終点(x2, y2)を更新する。
     * それ以外の値が渡された場合は何もしない。
     * @param {number} vertexIndex - 更新する頂点のインデックス（0: 始点, 1: 終点）
     * @param {number} x - 更新後のX座標（論理座標系）
     * @param {number} y - 更新後のY座標（論理座標系）
     */
    setVertex(vertexIndex, x, y) {
        if (vertexIndex === 0) {
            this.x1 = x;
            this.y1 = y;
        } else if (vertexIndex === 1) {
            this.x2 = x;
            this.y2 = y;
        }
    }

    /**
     * 作図中に終点をカーソル位置へ追従させる。setVertex(1, x, y)と同義（終点をそのまま更新する）。
     * @param {number} x - 追従先のX座標（論理座標系）
     * @param {number} y - 追従先のY座標（論理座標系）
     */
    updateDraftEnd(x, y) {
        this.setVertex(1, x, y);
    }

    /**
     * ハンドル名（hitTestHandleの戻り値）から対応する頂点インデックスを自己申告する。
     * @param {string} handleName - ハンドル名（'start'|'end'）
     * @returns {number|null} 対応する頂点インデックス。該当なしはnull
     */
    getVertexIndexForHandle(handleName) {
        return { start: 0, end: 1 }[handleName] ?? null;
    }

    /**
     * 自身の全頂点(x1,y1,x2,y2)を相対差分(dx, dy)だけ平行移動する。
     * @param {number} dx - X方向の移動差分（論理座標系）
     * @param {number} dy - Y方向の移動差分（論理座標系）
     */
    translate(dx, dy) {
        this.x1 += dx;
        this.y1 += dy;
        this.x2 += dx;
        this.y2 += dy;
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

    /**
     * 選択中に始点・終点・移動ハンドルの3種を描き分けて描画する（暫定デザイン）。
     * 始点・終点ハンドルは正方形、移動ハンドル（中点）は円で視覚的に区別する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。ハンドルの大きさ・枠線幅を画面上で一定に保つために用いる。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHandles(ctx, viewScale = 1) {
        const handleSize = 8 / viewScale; // 画面上8px一定（ワールド長へ換算）
        const half = handleSize / 2;
        const midX = (this.x1 + this.x2) / 2;
        const midY = (this.y1 + this.y2) / 2;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1.5 / viewScale;

        // 始点・終点ハンドル（正方形）
        [[this.x1, this.y1], [this.x2, this.y2]].forEach(([hx, hy]) => {
            ctx.beginPath();
            ctx.rect(hx - half, hy - half, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        });

        // 移動ハンドル（円・中点）
        ctx.beginPath();
        ctx.arc(midX, midY, half, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
    }

    /**
     * ホバー時の強調表示を描画する（暫定デザイン）。
     * 本体の線より太い半透明の線を重ねて強調する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。強調の上乗せ幅を画面上で一定に保つために用いる（図形本体の`strokeWidth`部分は倍率に比例して表示される）。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHover(ctx, viewScale = 1) {
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6 / viewScale;
        ctx.stroke();
    }
}
