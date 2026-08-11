/**
 * 責務: 円・楕円・弧のデータ保持・Canvasへの描画処理・当たり判定を担う。
 */
export class Ellipse {
    /**
     * @param {number} x1 - 中心のX座標（1回目クリック地点）
     * @param {number} y1 - 中心のY座標（1回目クリック地点）
     * @param {number} x2 - 終点のX座標（ドラッグ位置）
     * @param {number} y2 - 終点のY座標（ドラッグ位置）
     * @param {string} [shapeType='circle'] - 図形種別（'circle'|'arc'）
     * @param {string} [strokeColor='#000000'] - 線の色
     * @param {number} [strokeWidth=2] - 線の太さ
     */
    constructor(x1, y1, x2, y2, shapeType = 'circle', strokeColor = '#000000', strokeWidth = 2) {
        /** @type {string|number|null} 図形の一意なID。外部（VectorModel）から設定される。 */
        this.id = null;
        
        /** @type {string} 図形の種別（'circle' または 'arc'）。内部判定でのみ用いる。 */
        this.type = shapeType;
        
        /** @type {number} 描画開始角度（常に0固定） */
        this.startAngle = 0;
        
        /** @type {number} 描画終了角度（円の場合は2π、弧の場合はπ固定） */
        this.endAngle = (this.type === 'circle') ? Math.PI * 2 : Math.PI;

        const rx = Math.abs(x2 - x1);
        const ry = Math.abs(y2 - y1);

        /** @type {{x: number, y: number}[]} 頂点配列（長さ5固定）。points[0]=中心, [1]=右端, [2]=上端, [3]=開始角点, [4]=終了角点 */
        this.points = [
            { x: x1, y: y1 },
            { x: x1 + rx, y: y1 },
            { x: x1, y: y1 - ry },
            { x: x1 + rx, y: y1 },
            { x: (this.type === 'circle') ? x1 + rx : x1 - rx, y: y1 }
        ];

        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
    }

    /**
     * Canvasに円または弧を描画する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - 将来のモーフィング機能用の予約引数（本Phaseでは未使用）
     */
    draw(ctx, t = 0) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        ctx.beginPath();
        ctx.ellipse(xc, yc, rx, ry, 0, this.startAngle, this.endAngle);
        if (this.type === 'circle') {
            ctx.closePath();
        }

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
    }

    /**
     * ホバー時の強調表示を描画する。
     * draw()と同じパスに対し、半透明の太線を重ねて強調する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    drawHover(ctx) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        ctx.beginPath();
        ctx.ellipse(xc, yc, rx, ry, 0, this.startAngle, this.endAngle);
        if (this.type === 'circle') {
            ctx.closePath();
        }

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6;
        ctx.stroke();
    }

    /**
     * 選択時のハンドル（操作点）を描画する。
     * 中心（円形: move）、右端・上端（正方形: points[1], points[2]）、左端・下端（正方形: 計算値ダミー）の計5個を描画。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    drawHandles(ctx) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1.5;
        
        const half = 4;

        // 中心（moveハンドル: 円形）
        ctx.beginPath();
        ctx.arc(xc, yc, half, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        const handlePositions = [
            { x: xc + rx, y: yc },     // 右端
            { x: xc, y: yc - ry },     // 上端
            { x: xc - rx, y: yc },     // 左端 (ダミー)
            { x: xc, y: yc + ry }      // 下端 (ダミー)
        ];

        // 各端点（正方形）
        handlePositions.forEach(pos => {
            ctx.beginPath();
            ctx.rect(pos.x - half, pos.y - half, half * 2, half * 2);
            ctx.fill();
            ctx.stroke();
        });
    }

    /**
     * 座標(x, y)にあるハンドルを判定してその名前を返す。
     * 優先順位: 中心('move') -> 右端('right') -> 上端('up') -> 左端('left') -> 下端('down')
     * @param {number} x - 判定するX座標
     * @param {number} y - 判定するY座標
     * @param {number} tolerance - 当たり判定の許容誤差
     * @returns {string|null} ヒットしたハンドル名。該当なしの場合はnull
     */
    hitTestHandle(x, y, tolerance) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        const checkHit = (hx, hy) => Math.hypot(x - hx, y - hy) <= tolerance;

        // 中心 ('move')
        if (checkHit(xc, yc)) return 'move';
        // 右端 ('right')
        if (checkHit(xc + rx, yc)) return 'right';
        // 上端 ('up')
        if (checkHit(xc, yc - ry)) return 'up';
        // 左端 ('left')
        if (checkHit(xc - rx, yc)) return 'left';
        // 下端 ('down')
        if (checkHit(xc, yc + ry)) return 'down';

        return null;
    }

    /**
     * ハンドル名から対応する頂点インデックス（this.pointsのインデックス）を返す。
     * 'move' は InputTracker 側で処理されるため含まない。
     * 左端('left')・下端('down')は、計算によって対称位置にあるダミーハンドルであり、
     * ドラッグ時には右端('right')・上端('up')と同じインデックス(1, 2)を返し、setVertex 側で中心からの距離として正規化させる設計意図を持つ。
     * @param {string} handleName - ハンドル名
     * @returns {number|null} 頂点インデックス。該当しない場合はnull
     */
    getVertexIndexForHandle(handleName) {
        const lookup = { right: 1, up: 2, left: 1, down: 2 };
        return lookup[handleName] ?? null;
    }

    /**
     * 中心座標を維持したまま、指定されたrx, ryに基づいてpoints[1]〜points[4]を再計算・再配置する共通ヘルパー。
     * setVertex と updateDraftEnd で計算式が重複し、修正時に挙動が食い違うのを防ぐために用いる。
     * @param {number} rx - X軸方向の半径（絶対値）
     * @param {number} ry - Y軸方向の半径（絶対値）
     * @private
     */
    #updatePointsFromRadii(rx, ry) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        
        this.points[1].x = xc + rx;
        this.points[1].y = yc;
        
        this.points[2].x = xc;
        this.points[2].y = yc - ry;
        
        this.points[3].x = xc + rx;
        this.points[3].y = yc;
        
        this.points[4].x = (this.type === 'circle') ? xc + rx : xc - rx;
        this.points[4].y = yc;
    }

    /**
     * 指定された頂点（0:中心, 1:右端, 2:上端）の座標を更新する。
     * 1（右端・左端ドラッグ時）、2（上端・下端ドラッグ時）のケースでは、
     * 単純な座標代入を行わず、中心からの絶対距離(rx, ry)を再計算して
     * 正準位置（右端・上端）へ再配置する正規化を行う。
     * これにより、左端や下端をドラッグしても図形が反転ワープする不具合を防止する。
     * @param {number} vertexIndex - 更新する頂点のインデックス (0, 1, 2)
     * @param {number} x - 新しいX座標
     * @param {number} y - 新しいY座標
     */
    setVertex(vertexIndex, x, y) {
        if (vertexIndex === 0) {
            // 中心移動: 現在のrx, ryを維持したまま全点を再計算する
            const rx = Math.abs(this.points[1].x - this.points[0].x);
            const ry = Math.abs(this.points[2].y - this.points[0].y);
            this.points[0].x = x;
            this.points[0].y = y;
            this.#updatePointsFromRadii(rx, ry);
        } else if (vertexIndex === 1) {
            // 右端（または左端）ハンドルの移動: x座標から新しいrxを計算
            const rx = Math.abs(x - this.points[0].x);
            const ry = Math.abs(this.points[2].y - this.points[0].y);
            this.#updatePointsFromRadii(rx, ry);
        } else if (vertexIndex === 2) {
            // 上端（または下端）ハンドルの移動: y座標から新しいryを計算
            const rx = Math.abs(this.points[1].x - this.points[0].x);
            const ry = Math.abs(y - this.points[0].y);
            this.#updatePointsFromRadii(rx, ry);
        }
    }

    /**
     * 図形全体を相対移動させる。
     * @param {number} dx - X軸方向の移動量
     * @param {number} dy - Y軸方向の移動量
     */
    translate(dx, dy) {
        this.points.forEach(p => {
            p.x += dx;
            p.y += dy;
        });
    }

    /**
     * 作図中のドラッグに追従して図形の終端座標を更新する。
     * 1回目クリック地点(中心)は固定し、rx, ryを動的算出して全点を同期再計算する。
     * @param {number} x - 現在のマウスX座標
     * @param {number} y - 現在のマウスY座標
     */
    updateDraftEnd(x, y) {
        const rx = Math.abs(x - this.points[0].x);
        const ry = Math.abs(y - this.points[0].y);
        this.#updatePointsFromRadii(rx, ry);
    }

    /**
     * 指定された座標(x, y)が図形の境界線上にあるかを判定する。
     * @param {number} x - 判定するX座標
     * @param {number} y - 判定するY座標
     * @param {number} tolerance - 当たり判定の許容誤差
     * @returns {boolean} 当たっている場合はtrue、そうでない場合はfalse
     */
    hitTest(x, y, tolerance) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        // 最優先ガード: 0除算によるNaN/Infinity暴走や画面全域での誤爆を防止
        if (rx < 1 || ry < 1) {
            return false;
        }

        const dx = x - xc;
        const dy = y - yc;
        
        // 楕円の境界線判定：距離比率 r = sqrt((dx/rx)^2 + (dy/ry)^2) が 1 に近いかどうか
        const value = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
        const r = Math.sqrt(value);
        
        // tolerance と strokeWidth を加味した許容誤差の近似
        // 楕円の平均半径 r_avg に対する比率として許容幅を設定
        const r_avg = (rx + ry) / 2.0;
        const allowedDiff = (tolerance + this.strokeWidth / 2) / r_avg;

        if (Math.abs(r - 1) > allowedDiff) {
            return false;
        }

        // 弧の場合の角度フィルタ：空隙部分での誤爆を防止
        if (this.type !== 'circle') {
            let angle = Math.atan2(dy, dx);
            if (angle < 0) {
                angle += Math.PI * 2;
            }
            if (angle < this.startAngle || angle > this.endAngle) {
                return false;
            }
        }

        return true;
    }
}
