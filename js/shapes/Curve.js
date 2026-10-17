/**
 * 責務: 2次ベジェ曲線（始点・制御点・終点）のデータ保持・Canvasへの描画処理・当たり判定を担う。
 */
export class Curve {
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
        /** @type {{x: number, y: number}[]} 頂点配列。points[0]=始点, points[1]=制御点, points[2]=終点 */
        this.points = [
            { x: x1, y: y1 },
            { x: (x1 + x2) / 2, y: (y1 + y2) / 2 },
            { x: x2, y: y2 },
        ];
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
    }

    /**
     * Canvasに2次ベジェ曲線を描画する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - 将来のモーフィング機能用の予約引数（本Phaseでは未使用）
     */
    draw(ctx, t = 0) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.quadraticCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y);

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
    }

    /**
     * 選択中に始点・制御点・終点の3ハンドルを描き分けて描画する。
     * 始点・終点は正方形、制御点はひし形で視覚的に区別し、
     * 始点⇔制御点・終点⇔制御点を結ぶ点線ヘルパーを併せて描画する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。ハンドルの大きさ・枠線幅、および点線ヘルパーの線幅・破線間隔を画面上で一定に保つために用いる。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHandles(ctx, viewScale = 1) {
        const handleSize = 8 / viewScale; // 画面上8px一定（ワールド長へ換算）
        const half = handleSize / 2;
        const [start, control, end] = this.points;

        // 始点⇔制御点・終点⇔制御点を結ぶ点線ヘルパー
        ctx.setLineDash([2 / viewScale, 2 / viewScale]);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.lineWidth = 1 / viewScale;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(control.x, control.y);
        ctx.moveTo(end.x, end.y);
        ctx.lineTo(control.x, control.y);
        ctx.stroke();
        ctx.setLineDash([]); // 他図形の描画に影響を残さないため必ずクリアする

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1.5 / viewScale;

        // 始点・終点ハンドル（正方形）
        [start, end].forEach(({ x: hx, y: hy }) => {
            ctx.beginPath();
            ctx.rect(hx - half, hy - half, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        });

        // 制御点ハンドル（ひし形）
        ctx.beginPath();
        ctx.moveTo(control.x, control.y - half);
        ctx.lineTo(control.x + half, control.y);
        ctx.lineTo(control.x, control.y + half);
        ctx.lineTo(control.x - half, control.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    /**
     * 点(x, y)がベジェ曲線本体の許容誤差(tolerance)以内にあるかを判定する当たり判定。
     * B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2 をt=0〜1の範囲で100分割し、
     * 各分割点と入力点との最短距離がtolerance以内であればtrueを返す。
     * @param {number} x - 判定対象点のX座標（論理座標系）
     * @param {number} y - 判定対象点のY座標（論理座標系）
     * @param {number} tolerance - 許容誤差（論理座標系のピクセル単位）
     * @returns {boolean} 曲線との距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        const [p0, p1, p2] = this.points;
        const segments = 100;
        let minDistance = Infinity;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const oneMinusT = 1 - t;
            const bx = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
            const by = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
            const distance = Math.hypot(x - bx, y - by);
            if (distance < minDistance) {
                minDistance = distance;
            }
        }

        return minDistance <= tolerance;
    }

    /**
     * 点(x, y)が始点・制御点・終点のいずれかのハンドルの許容誤差(tolerance)以内にあるかを判定する。
     * 複数のハンドルが同時にtolerance以内となる場合は、start → end → control の優先順位で先着1件を返す。
     * @param {number} x - 判定対象点のX座標（論理座標系）
     * @param {number} y - 判定対象点のY座標（論理座標系）
     * @param {number} tolerance - 許容誤差（論理座標系のピクセル単位）
     * @returns {'start'|'end'|'control'|null} 該当したハンドルの種別。いずれにも該当しなければnull
     */
    hitTestHandle(x, y, tolerance) {
        const [start, control, end] = this.points;
        const distTo = (hx, hy) => Math.hypot(x - hx, y - hy);

        if (distTo(start.x, start.y) <= tolerance) return 'start';
        if (distTo(end.x, end.y) <= tolerance) return 'end';
        if (distTo(control.x, control.y) <= tolerance) return 'control';

        return null;
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * vertexIndexが0であれば始点を、1であれば制御点を、2であれば終点を更新する。
     * それ以外の値が渡された場合は何もしない。
     * @param {number} vertexIndex - 更新する頂点のインデックス（0: 始点, 1: 制御点, 2: 終点）
     * @param {number} x - 更新後のX座標（論理座標系）
     * @param {number} y - 更新後のY座標（論理座標系）
     */
    setVertex(vertexIndex, x, y) {
        if (vertexIndex === 0 || vertexIndex === 1 || vertexIndex === 2) {
            this.points[vertexIndex] = { x, y };
        }
    }

    /**
     * 作図中に終点をカーソル位置へ追従させる。終点を(x, y)に更新し、制御点を
     * 「始点と新しい終点の中点」として再計算する（コンストラクタの初期配置ロジックと同一の考え方）。
     * これにより作図プレビュー中は常に直線に見える状態を保つ。
     * @param {number} x - 追従先のX座標（論理座標系）
     * @param {number} y - 追従先のY座標（論理座標系）
     */
    updateDraftEnd(x, y) {
        this.points[2] = { x, y };
        this.points[1] = {
            x: (this.points[0].x + x) / 2,
            y: (this.points[0].y + y) / 2,
        };
    }

    /**
     * ハンドル名（hitTestHandleの戻り値）から対応する頂点インデックスを自己申告する。
     * @param {string} handleName - ハンドル名（'start'|'control'|'end'）
     * @returns {number|null} 対応する頂点インデックス。該当なしはnull
     */
    getVertexIndexForHandle(handleName) {
        return { start: 0, control: 1, end: 2 }[handleName] ?? null;
    }

    /**
     * 自身の全頂点（始点・制御点・終点）を相対差分(dx, dy)だけ平行移動する。
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
     * 本体のベジェ曲線パスより太い半透明の線を重ねて強調する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。強調の上乗せ幅を画面上で一定に保つために用いる（図形本体の`strokeWidth`部分は倍率に比例して表示される）。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHover(ctx, viewScale = 1) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.quadraticCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y);

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6 / viewScale;
        ctx.stroke();
    }
}
