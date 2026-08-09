/**
 * 責務: 矩形（4頂点独立構造）のデータ保持・Canvasへの描画処理・当たり判定を担う。
 */
export class Rect {
    /**
     * @param {number} x1 - 対角座標1のX座標
     * @param {number} y1 - 対角座標1のY座標
     * @param {number} x2 - 対角座標2のX座標
     * @param {number} y2 - 対角座標2のY座標
     * @param {string} [strokeColor='#000000'] - 線の色
     * @param {number} [strokeWidth=2] - 線の太さ
     */
    constructor(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2) {
        /** @type {string|number|null} 図形の一意なID。採番ロジックは持たず、外部（VectorModel）から設定される。 */
        this.id = null;
        /** @type {{x: number, y: number}[]} 頂点配列（長さ4固定）。points[0]=topLeft, points[1]=topRight, points[2]=bottomRight, points[3]=bottomLeft */
        this.points = [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
        ];
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
    }

    /**
     * Canvasに矩形を描画する。points[0]→[1]→[2]→[3]の順に結び閉じたパスをstrokeする。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - Curve.drawとのシグネチャ統一のためだけに存在する予約引数（本Phaseでは未使用）
     */
    draw(ctx, t = 0) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.lineTo(this.points[3].x, this.points[3].y);
        ctx.closePath();

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
    }

    /**
     * 選択中に4隅のハンドルを描き分けて描画する。
     * Line/Curveと同一配色（白塗り／青枠）・同一サイズ（一辺8pxの正方形）で4頂点すべてに描画する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    drawHandles(ctx) {
        const handleSize = 8;
        const half = handleSize / 2;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1.5;

        this.points.forEach(({ x: hx, y: hy }) => {
            ctx.beginPath();
            ctx.rect(hx - half, hy - half, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        });
    }

    /**
     * 点(px, py)と線分(ax, ay)-(bx, by)との最短距離を求める内部ヘルパー。
     * hitTest内で4辺分ループして呼び出す実装詳細であり、9メソッド契約には含まれない。
     * @param {number} px - 判定対象点のX座標
     * @param {number} py - 判定対象点のY座標
     * @param {number} ax - 線分始点のX座標
     * @param {number} ay - 線分始点のY座標
     * @param {number} bx - 線分終点のX座標
     * @param {number} by - 線分終点のY座標
     * @returns {number} 点と線分の最短距離
     */
    #distanceToSegment(px, py, ax, ay, bx, by) {
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;

        let t = lengthSquared === 0
            ? 0
            : ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
        t = Math.max(0, Math.min(1, t));

        const closestX = ax + t * dx;
        const closestY = ay + t * dy;
        const distX = px - closestX;
        const distY = py - closestY;

        return Math.sqrt(distX * distX + distY * distY);
    }

    /**
     * 点(x, y)が矩形本体の許容誤差(tolerance)以内にあるかを判定する当たり判定。
     * 4辺（[0,1],[1,2],[2,3],[3,0]）それぞれについて点-線分距離を求め、
     * いずれか1辺でもtolerance以内であればtrueを返す。
     * @param {number} x - 判定対象点のX座標（論理座標系）
     * @param {number} y - 判定対象点のY座標（論理座標系）
     * @param {number} tolerance - 許容誤差（論理座標系のピクセル単位）
     * @returns {boolean} 矩形との距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
        return edges.some(([a, b]) => {
            const pa = this.points[a];
            const pb = this.points[b];
            return this.#distanceToSegment(x, y, pa.x, pa.y, pb.x, pb.y) <= tolerance;
        });
    }

    /**
     * 点(x, y)が4隅のハンドルいずれかの許容誤差(tolerance)以内にあるかを判定する。
     * 複数のハンドルが同時にtolerance以内となる場合は、topLeft → topRight → bottomRight → bottomLeftの優先順位で先着1件を返す。
     * @param {number} x - 判定対象点のX座標（論理座標系）
     * @param {number} y - 判定対象点のY座標（論理座標系）
     * @param {number} tolerance - 許容誤差（論理座標系のピクセル単位）
     * @returns {'topLeft'|'topRight'|'bottomRight'|'bottomLeft'|null} 該当したハンドルの種別。いずれにも該当しなければnull
     */
    hitTestHandle(x, y, tolerance) {
        const names = ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'];
        const distTo = (hx, hy) => Math.hypot(x - hx, y - hy);

        for (let i = 0; i < this.points.length; i++) {
            if (distTo(this.points[i].x, this.points[i].y) <= tolerance) {
                return names[i];
            }
        }
        return null;
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * vertexIndexが0〜3であれば対応するpoints要素を直接上書きする（矩形維持のための連動再計算は行わない）。
     * @param {number} vertexIndex - 更新する頂点のインデックス（0: topLeft, 1: topRight, 2: bottomRight, 3: bottomLeft）
     * @param {number} x - 更新後のX座標（論理座標系）
     * @param {number} y - 更新後のY座標（論理座標系）
     */
    setVertex(vertexIndex, x, y) {
        if (vertexIndex >= 0 && vertexIndex <= 3) {
            this.points[vertexIndex] = { x, y };
        }
    }

    /**
     * 作図中にカーソル位置へ追従させる。points[0]（1回目クリック地点）は固定したまま、
     * points[2]をカーソル座標へ、points[1]/[3]を対角線上の交点として動的に再計算する。
     * @param {number} x - 追従先のX座標（論理座標系）
     * @param {number} y - 追従先のY座標（論理座標系）
     */
    updateDraftEnd(x, y) {
        this.points[2] = { x, y };
        this.points[1] = { x, y: this.points[0].y };
        this.points[3] = { x: this.points[0].x, y };
    }

    /**
     * ハンドル名（hitTestHandleの戻り値）から対応する頂点インデックスを自己申告する。
     * @param {string} handleName - ハンドル名（'topLeft'|'topRight'|'bottomRight'|'bottomLeft'）
     * @returns {number|null} 対応する頂点インデックス。該当なしはnull
     */
    getVertexIndexForHandle(handleName) {
        return { topLeft: 0, topRight: 1, bottomRight: 2, bottomLeft: 3 }[handleName] ?? null;
    }

    /**
     * 自身の全頂点(points)を相対差分(dx, dy)だけ平行移動する。
     * @param {number} dx - X方向の移動差分（論理座標系）
     * @param {number} dy - Y方向の移動差分（論理座標系）
     */
    translate(dx, dy) {
        this.points.forEach((point) => {
            point.x += dx;
            point.y += dy;
        });
    }

    /**
     * ホバー時の強調表示を描画する。
     * draw()と同じ4頂点パス（closePath含む）に対し、Line/Curveと同一仕様
     * （半透明の太線）を重ねて強調する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    drawHover(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.lineTo(this.points[3].x, this.points[3].y);
        ctx.closePath();

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6;
        ctx.stroke();
    }
}
