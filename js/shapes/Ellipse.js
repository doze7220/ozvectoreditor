/**
 * 責務: 円・楕円・弧のデータ保持・Canvasへの描画処理・当たり判定、
 * および図形データとの相互変換と描画要素（スプライトの書き出し用）への変換を担う。
 */

import { segmentIntersectsRect } from './ShapeGeometry.js';
import { validateShapeData } from './ShapeDataValidation.js';

/**
 * 範囲選択の交差判定（`intersectsRect`）と、縮退時の当たり判定（`hitTest`）で用いる輪郭サンプリングの分割数。
 * @type {number}
 */
const ELLIPSE_INTERSECT_SEGMENTS = 100;

/**
 * 円・弧の図形データ（1図形のJSON表現・現行版）が持つ頂点数。
 * @type {number}
 */
const ELLIPSE_POINT_COUNT = 5;

/**
 * 本クラスが扱う図形種別（`fromJSON`の`type`検証に用いる）。
 * 種別を増やす場合に揃える箇所：本一覧・種別で分岐する全箇所（コンストラクタ、`draw`、`drawHover`、`#updatePointsFromRadii`、
 * `hitTest`、`toDrawElement`、`isFillable`。`!== 'circle'`の分岐は弧として扱われる）・`ShapeFactory`の対応表・`index.html`のボタン。
 * @type {ReadonlyArray<string>}
 */
const ELLIPSE_TYPES = Object.freeze(['circle', 'arc']);

/**
 * 円・弧の図形クラス（図形種別`'circle'`|`'arc'`。`type`で振る舞いを分岐する）。頂点は`points[0]`＝中心、`[1]`＝右端制御点、
 * `[2]`＝上端制御点、`[3]`＝開始角制御点、`[4]`＝終了角制御点。開始角・終了角は`type`から決まり、図形データには保存しない。
 * 共通メソッド契約（14メソッド：draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement・isFillable）を自律実装する。座標はすべてワールド座標。
 */
export class Ellipse {
    /**
     * @param {number} x1 - 中心のX座標（1回目クリック地点）
     * @param {number} y1 - 中心のY座標（1回目クリック地点）
     * @param {number} x2 - 終点のX座標（ドラッグ位置）
     * @param {number} y2 - 終点のY座標（ドラッグ位置）
     * @param {string} [shapeType='circle'] - 図形種別（'circle'|'arc'）
     * @param {string|null} [strokeColor='#000000'] - 線の色。`null`は線なし
     * @param {number} [strokeWidth=2] - 線の太さ
     * @param {string|null} [fillColor=null] - 塗りの色。`null`は塗りなし
     */
    constructor(x1, y1, x2, y2, shapeType = 'circle', strokeColor = '#000000', strokeWidth = 2, fillColor = null) {
        /** @type {*} 図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）。 */
        this.id = null;
        
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致）。'circle'|'arc'で振る舞いも分岐する。 */
        this.type = shapeType;
        
        /** @type {number} 描画開始角度（円の場合は0、弧の場合はπ固定。ctx.ellipseは時計回りのため弧はπ→2πで画面の上半分を描く） */
        this.startAngle = (this.type === 'circle') ? 0 : Math.PI;

        /** @type {number} 描画終了角度（常に2π固定） */
        this.endAngle = Math.PI * 2;

        const rx = Math.abs(x2 - x1);
        const ry = Math.abs(y2 - y1);

        /** @type {{x: number, y: number}[]} 頂点配列（長さ5固定）。points[0]=中心, [1]=右端, [2]=上端, [3]=開始角点（弧は左端・円は右端）, [4]=終了角点（右端） */
        this.points = [
            { x: x1, y: y1 },
            { x: x1 + rx, y: y1 },
            { x: x1, y: y1 - ry },
            { x: (this.type === 'circle') ? x1 + rx : x1 - rx, y: y1 },
            { x: x1 + rx, y: y1 }
        ];

        /** @type {string|null} 線の色。nullは線なし */
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
        /** @type {string|null} 塗りの色。nullは塗りなし。塗れない形（弧）でも保持する（描かないだけ） */
        this.fillColor = fillColor;
    }

    /**
     * 塗れる形かを返す（共通メソッド契約の第14メソッド）。円は塗れ、弧は塗れない（`type`で分岐）。データには保存しない。
     * @returns {boolean} `type`が`'circle'`ならtrue、弧ならfalse
     */
    isFillable() {
        return this.type === 'circle';
    }

    /**
     * Canvasに円または弧を描画する。
     * 塗るのは`isFillable()`が真で`fillColor`が文字列のときだけ、線を描くのは`strokeColor`が文字列のときだけ。
     * どちらも偽なら何も呼ばない。順序は`io/CodeExporter.js`の`DRAW_SOURCE`と同じ（パス → 塗り → 線）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - 将来のモーフィング機能用の予約引数（本Phaseでは未使用）
     */
    draw(ctx, t = 0) {
        const shouldFill = this.isFillable() && typeof this.fillColor === 'string';
        const shouldStroke = typeof this.strokeColor === 'string';
        if (!shouldFill && !shouldStroke) {
            return;
        }

        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        ctx.beginPath();
        ctx.ellipse(xc, yc, rx, ry, 0, this.startAngle, this.endAngle);
        if (this.type === 'circle') {
            ctx.closePath();
        }

        if (shouldFill) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        if (shouldStroke) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
    }

    /**
     * ホバー時の強調表示を描画する。
     * draw()と同じパスに対し、半透明の太線を重ねて強調する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。強調の上乗せ幅を画面上で一定に保つために用いる（図形本体の`strokeWidth`部分は倍率に比例して表示される）。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHover(ctx, viewScale = 1) {
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
        ctx.lineWidth = this.strokeWidth + 6 / viewScale;
        ctx.stroke();
    }

    /**
     * 選択時のハンドル（操作点）を描画する。
     * 中心（円形: move）、右端・上端（正方形: points[1], points[2]）、左端・下端（正方形: 計算値ダミー）の計5個を描画。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。ハンドルの大きさ・枠線幅を画面上で一定に保つために用いる。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHandles(ctx, viewScale = 1) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1.5 / viewScale;
        
        const half = 4 / viewScale; // 画面上4px一定（ワールド長へ換算）

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
     * points[3]（開始角制御点）は弧では左端・円では右端、points[4]（終了角制御点）は右端へ置く。
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
        
        this.points[3].x = (this.type === 'circle') ? xc + rx : xc - rx;
        this.points[3].y = yc;

        this.points[4].x = xc + rx;
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
     * 通常は距離比率r = sqrt((dx/rx)^2 + (dy/ry)^2)が1に近いかで判定し、許容幅は`tolerance + strokeWidth / 2`を
     * 平均半径で割った比率とする。`rx < 1 || ry < 1`（つぶれた円・弧）では比率の式を使わず、
     * `#distanceToOutline`による輪郭の折れ線までの距離が`tolerance + strokeWidth / 2`以下かで判定する。
     * 弧は角度を(0, 2π]へ写して`startAngle`〜`endAngle`の範囲外（空隙）を除外する（右端のatan2=0は2πとして当たる）。
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

        // 最優先ガード: 0除算によるNaN/Infinity暴走や画面全域での誤爆を防止（縮退時は折れ線への距離で判定）
        if (rx < 1 || ry < 1) {
            return this.#distanceToOutline(x, y, xc, yc, rx, ry) <= tolerance + this.strokeWidth / 2;
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
            if (angle <= 0) {
                angle += Math.PI * 2;
            }
            if (angle < this.startAngle || angle > this.endAngle) {
                return false;
            }
        }

        return true;
    }

    /**
     * 点(x, y)から輪郭（中心線）の折れ線までの最短距離を返す。縮退時（rx/ryが1未満）の当たり判定用。
     * `intersectsRect`と同じパラメータ化（θ = startAngle + (endAngle − startAngle) × i / N、i = 0..N、
     * N = ELLIPSE_INTERSECT_SEGMENTS）で点をサンプリングし、隣接点を結ぶ各線分への距離の最小値を返す。
     * 弧は描画されている部分のみが対象となる。長さ0の線分は点までの距離として扱い、0除算しない。
     * @param {number} x - 判定するX座標（ワールド座標）
     * @param {number} y - 判定するY座標（ワールド座標）
     * @param {number} xc - 中心のX座標（ワールド座標）
     * @param {number} yc - 中心のY座標（ワールド座標）
     * @param {number} rx - X軸方向の半径（絶対値）
     * @param {number} ry - Y軸方向の半径（絶対値）
     * @returns {number} 折れ線までの最短距離（ワールド座標の長さ）
     * @private
     */
    #distanceToOutline(x, y, xc, yc, rx, ry) {
        const segments = ELLIPSE_INTERSECT_SEGMENTS;
        const angleSpan = this.endAngle - this.startAngle;
        let prevX = xc + rx * Math.cos(this.startAngle);
        let prevY = yc + ry * Math.sin(this.startAngle);
        let minDistance = Math.hypot(x - prevX, y - prevY);
        for (let i = 1; i <= segments; i++) {
            const theta = this.startAngle + angleSpan * i / segments;
            const px = xc + rx * Math.cos(theta);
            const py = yc + ry * Math.sin(theta);
            const abx = px - prevX;
            const aby = py - prevY;
            const lengthSquared = abx * abx + aby * aby;
            let t = 0;
            if (lengthSquared > 0) {
                t = ((x - prevX) * abx + (y - prevY) * aby) / lengthSquared;
                t = Math.max(0, Math.min(1, t));
            }
            const distance = Math.hypot(x - (prevX + abx * t), y - (prevY + aby * t));
            if (distance < minDistance) {
                minDistance = distance;
            }
            prevX = px;
            prevY = py;
        }
        return minDistance;
    }

    /**
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド
     * （共通メソッド契約の第10メソッド）。塗り内部は判定しない。矩形の境界上も交差とみなす。
     * rx/ryはdraw()と同じ式で求め、外接矩形[xc − rx, xc + rx] × [yc − ry, yc + ry]が判定矩形と重ならなければfalseを返す（早期棄却）。
     * 重なる場合はθ = startAngle + (endAngle − startAngle) × i / N（i = 0..N、N = ELLIPSE_INTERSECT_SEGMENTS）で
     * 点(xc + rx·cosθ, yc + ry·sinθ)をサンプリングし、隣接点を結ぶN本の線分のいずれかが交差すればtrueを返す。
     * draw()のctx.ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)と同じパラメータ化のため、円・弧をtypeで分岐せず同一処理で扱い、
     * 弧は描画されている弧部分のみが判定対象となる（弦は含めない）。
     * 縮退した楕円（rx/ryが0）でもサンプル点が線分状・点状に並ぶだけで0除算を起こさず、輪郭が掛かればtrueを返す。
     * 折れ線近似のため、真の輪郭とのずれ（最大で半径×(1−cos(π/N))程度）がある。
     * @param {number} minX - 判定矩形の左端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} minY - 判定矩形の上端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @param {number} maxX - 判定矩形の右端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} maxY - 判定矩形の下端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @returns {boolean} 輪郭線の一部でも矩形に掛かればtrue
     */
    intersectsRect(minX, minY, maxX, maxY) {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        // 早期棄却：外接矩形と判定矩形が重ならなければ交差しない
        if (xc + rx < minX || xc - rx > maxX || yc + ry < minY || yc - ry > maxY) {
            return false;
        }

        const segments = ELLIPSE_INTERSECT_SEGMENTS;
        const angleSpan = this.endAngle - this.startAngle;
        let prevX = xc + rx * Math.cos(this.startAngle);
        let prevY = yc + ry * Math.sin(this.startAngle);
        for (let i = 1; i <= segments; i++) {
            const theta = this.startAngle + angleSpan * i / segments;
            const px = xc + rx * Math.cos(theta);
            const py = yc + ry * Math.sin(theta);
            if (segmentIntersectsRect(prevX, prevY, px, py, minX, minY, maxX, maxY)) {
                return true;
            }
            prevX = px;
            prevY = py;
        }
        return false;
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第13メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順）: `{ kind: 'ellipse', id, x, y, radiusX, radiusY, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor }`。
     * `draw`と同じ式（`x`・`y`＝`points[0]`、`radiusX`＝`|points[1].x − x|`、`radiusY`＝`|points[2].y − y|`、
     * `startAngle`・`endAngle`は自身の同名プロパティ、`closed`は`type === 'circle'`）で求める。回転は常に0のためキーを持たない。
     * `id`・`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる（`strokeColor`の`null`も）。
     * `fillColor`は塗れる形（円）のときだけ図形の値、塗れない形（弧）は`null`。値はすべてプリミティブのため、戻り値と自身は状態を共有しない。
     * @returns {{kind: string, id: *, x: number, y: number, radiusX: number, radiusY: number, startAngle: number, endAngle: number, closed: boolean, strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい描画要素
     */
    toDrawElement() {
        const xc = this.points[0].x;
        const yc = this.points[0].y;
        const rx = Math.abs(this.points[1].x - xc);
        const ry = Math.abs(this.points[2].y - yc);

        return {
            kind: 'ellipse',
            id: this.id,
            x: xc,
            y: yc,
            radiusX: rx,
            radiusY: ry,
            startAngle: this.startAngle,
            endAngle: this.endAngle,
            closed: this.type === 'circle',
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.isFillable() ? this.fillColor : null,
        };
    }

    /**
     * 自身を図形データ（1図形のJSON表現・現行版）へ変換する（共通メソッド契約の第11メソッド）。
     * 形（キー順もこの順）: `{ type: 'circle'|'arc', id, points: [中心{x, y}, 右端制御点{x, y}, 上端制御点{x, y}, 開始角制御点{x, y}, 終了角制御点{x, y}], strokeColor, strokeWidth, fillColor }`。
     * `fillColor`は塗れない形（弧）でも保持している値をそのまま出力する。
     * 座標はワールド座標。`points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は内部配列・頂点を共有しない。
     * `startAngle`/`endAngle`は出力しない（現状は`type`から一意に決まる固定値のため。
     * 弧の角度編集を実装する際に保存対象へ加え、作業データ形式の版番号を上げること）。
     * `id`が`null`（作成中の図形など）の場合もそのまま出力する。
     * `JSON.stringify(ellipse)`でも本メソッドの戻り値が出力される。
     * @returns {{type: string, id: *, points: {x: number, y: number}[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい図形データ
     */
    toJSON() {
        return {
            type: this.type,
            id: this.id,
            points: this.points.map((point) => ({ x: point.x, y: point.y })),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.fillColor,
        };
    }

    /**
     * 図形データ（`toJSON()`の形）から円・弧を復元する（共通メソッド契約の第12メソッド）。
     * 中心と`type`でコンストラクタを仮生成して`startAngle`/`endAngle`を`type`から求めた後、
     * 5頂点を`data`の座標値から新規オブジェクトとして設定し直す。
     * `points[3]`/`[4]`（開始角・終了角制御点）も再計算せず`data`の値をそのまま採用する
     * （往復で`toJSON()`の内容を一致させるため。描画・当たり判定は`points[0..2]`と角度のみに依存し、
     * 不整合な値でも`right`/`up`/`left`/`down`のハンドル操作で正準位置へ再計算され、`move`では平行移動されるだけ）。
     * 座標・色・太さ・種別を`data`の値どおりに復元し、角度は`type`から同一値に決まるため、`toJSON()`の出力から
     * 復元した図形は描画・当たり判定・頂点操作・`toJSON()`の結果が元の図形と一致する（往復の一致）。
     * `id`は検証せず`data.id`をそのまま保持する（欠落なら`undefined`）。idの正規化・振り直しは
     * 図形一式を管理する`VectorModel`の責務であり、図形クラスはidの規則を知らないため。
     * `data`内の配列・頂点オブジェクトは流用しない。余分なプロパティ（`startAngle`等を含む）は無視する。
     * 例外の捕捉は行わない（呼び出し側の`DocumentSerializer`が図形単位で捕捉する）。
     * @param {Object} data - 図形データ（プレーンオブジェクト）
     * @returns {Ellipse} 復元した円・弧
     * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`'circle'`・`'arc'`のいずれでもない／
     *     `points`が5要素の配列でない／頂点がオブジェクトでないか`x`・`y`が有限の数値でない／
     *     `strokeColor`が文字列でも`null`でもない／`strokeWidth`が`undefined`以外で有限の数値でないか0以下／
     *     `fillColor`が`undefined`・文字列・`null`以外の場合
     *     （`strokeWidth`のキーなしは2px、`fillColor`のキーなしは`null`として読む）
     */
    static fromJSON(data) {
        const style = validateShapeData(data, 'Ellipse', ELLIPSE_TYPES, ELLIPSE_POINT_COUNT);
        const center = data.points[0];
        const ellipse = new Ellipse(center.x, center.y, center.x, center.y, data.type, style.strokeColor, style.strokeWidth, style.fillColor);
        ellipse.points = data.points.map((point) => ({ x: point.x, y: point.y }));
        ellipse.id = data.id;
        return ellipse;
    }
}
