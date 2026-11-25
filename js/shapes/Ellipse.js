/**
 * 責務: 円・楕円・弧（傾いた楕円・楕円の弧を含む）のデータ保持・Canvasへの描画処理・当たり判定、
 * および図形データとの相互変換・描画要素（スプライトの書き出し用）への変換・変形を当てた新しい図形の生成を担う。
 */

import { applyAffineTransformToPoint, segmentIntersectsRect } from './ShapeGeometry.js';
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
 * 種別を増やす場合に揃える箇所：本一覧・種別で分岐する全箇所（コンストラクタ、`#readGeometry`、`draw`、`drawHover`、`drawOutline`、`#updatePointsFromRadii`、
 * `hitTest`、`toDrawElement`、`isFillable`。`!== 'circle'`の分岐は弧として扱われる。`createTransformed`は種別で分岐せず5つの点を写すだけ）・`ShapeFactory`の対応表・`index.html`のボタン。
 * `hitTestFill`は種別の分岐を持たない（塗れるかを`isFillable()`に通すだけ）が、塗れる種別（扇形など）を増やすときは式の見直しが要る。
 * @type {ReadonlyArray<string>}
 */
const ELLIPSE_TYPES = Object.freeze(['circle', 'arc']);

/**
 * 円・弧の形（`#readGeometry`の結果。非公開）。`ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle)`
 * （時計回り。`anticlockwise`は渡さない）にそのまま渡せる値と、縦横に沿った枝で求めたかを持つ。
 * @typedef {Object} EllipseGeometry
 * @property {number} x - 中心のX座標（ワールド座標）
 * @property {number} y - 中心のY座標（ワールド座標）
 * @property {number} radiusX - 主軸（回転後のX軸側）の半径（0以上）
 * @property {number} radiusY - もう一方の半径（0以上）
 * @property {number} rotation - 傾き（ラジアン。画面の時計回りが正）。縦横に沿った枝は0
 * @property {number} startAngle - 描画開始角（媒介変数の角度。弧は`[0, 2π)`）
 * @property {number} endAngle - 描画終了角（媒介変数の角度）
 * @property {boolean} axisAligned - 縦横に沿った枝（`u`が横向き・`w`が縦向き）で求めたらtrue（今の式そのもので読む）
 */

/**
 * 円・弧の図形クラス（図形種別`'circle'`|`'arc'`。`type`で振る舞いを分岐する）。頂点は`points[0]`＝中心、`[1]`＝右端制御点、
 * `[2]`＝上端制御点、`[3]`＝開始角制御点、`[4]`＝終了角制御点。開始角・終了角は`type`から決まり、図形データには保存しない。
 * 形は`u = points[1] − points[0]`・`w = points[2] − points[0]`を共役な半径として読み（輪郭＝中心＋`u`·cos t − `w`·sin t）、
 * 傾いた楕円・楕円の弧・上下に裏返った弧を表せる（今の約束の位置では`u`が横向き・`w`が上向きで、縦横に沿った楕円）。
 * 共通メソッド契約（18メソッド：draw・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement・isFillable・hitTestFill・drawOutline・getHandlePosition・getVertexHandleNames・createTransformed）を自律実装する。座標はすべてワールド座標。
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

        /** @type {{x: number, y: number}[]} 頂点配列（長さ5固定）。points[0]=中心, [1]=右端, [2]=上端, [3]=開始角点（弧は左端・円は右端）, [4]=終了角点（右端）。以上は今の約束の位置。形は`u = points[1] − points[0]`・`w = points[2] − points[0]`を共役な半径として読む（`points[3]`・`[4]`は形に効かない） */
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
     * 塗れる形かを返す（共通メソッド契約の第13メソッド）。円は塗れ、弧は塗れない（`type`で分岐）。データには保存しない。
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

        const g = this.#readGeometry();

        ctx.beginPath();
        ctx.ellipse(g.x, g.y, g.radiusX, g.radiusY, g.rotation, g.startAngle, g.endAngle);
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
        const g = this.#readGeometry();

        ctx.beginPath();
        ctx.ellipse(g.x, g.y, g.radiusX, g.radiusY, g.rotation, g.startAngle, g.endAngle);
        if (this.type === 'circle') {
            ctx.closePath();
        }

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6 / viewScale;
        ctx.stroke();
    }

    /**
     * アウトライン表示として、輪郭だけを画面上1pxの細線で描画する（共通メソッド契約の第15メソッド）。
     * 輪郭のパスは`draw`と同じ（`#readGeometry`の形を`ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle)`へ渡す。円のみ`closePath`、弧は閉じない）。
     * 塗らず（`fill`を呼ばない）、図形のスタイル（`strokeColor`・`strokeWidth`・`fillColor`）は読まないため、線なしの図形でも描く。
     * `draw`は変えない（`io/CodeExporter.js`の`DRAW_SOURCE`と手で揃えているため、本メソッドを別に持つ）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。線の太さを画面上1pxに保つために用いる（`lineWidth = 1 / viewScale`）
     * @param {string} color - 輪郭線の色（`strokeStyle`へそのまま渡す）
     */
    drawOutline(ctx, viewScale = 1, color) {
        const g = this.#readGeometry();

        ctx.beginPath();
        ctx.ellipse(g.x, g.y, g.radiusX, g.radiusY, g.rotation, g.startAngle, g.endAngle);
        if (this.type === 'circle') {
            ctx.closePath();
        }

        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / viewScale;
        ctx.stroke();
    }

    /**
     * 座標(x, y)にあるハンドルを判定する（共通メソッド契約の第4メソッド）。
     * 円・弧は頂点のハンドルを持たないため常に`null`（当たらない）。引数は契約の形を揃えるために受け取り、使わない。
     * @param {number} x - 判定するX座標（使わない）
     * @param {number} y - 判定するY座標（使わない）
     * @param {number} tolerance - 当たり判定の許容誤差（使わない）
     * @returns {null} 常にnull
     */
    hitTestHandle(x, y, tolerance) {
        return null;
    }

    /**
     * ハンドル名から、そのハンドルの位置を返す（共通メソッド契約の第16メソッド）。
     * 円・弧は頂点のハンドルを持たないため常に`null`（位置なし）。引数は契約の形を揃えるために受け取り、使わない。
     * @param {*} handleName - ハンドル名（使わない）
     * @returns {null} 常にnull
     */
    getHandlePosition(handleName) {
        return null;
    }

    /**
     * 頂点として扱えるハンドル名の一覧を返す（共通メソッド契約の第17メソッド）。
     * 円・弧は頂点として扱えるハンドルを持たないため常に空配列（`hitTestHandle`・`getHandlePosition`・`getVertexIndexForHandle`も常に`null`）。
     * 戻り値は毎回新しい配列で、書き換えても自身は変わらない。
     * @returns {string[]} 頂点のハンドル名の配列
     */
    getVertexHandleNames() {
        return [];
    }

    /**
     * ハンドル名から対応する頂点インデックス（this.pointsのインデックス）を返す。
     * 円・弧は頂点のハンドルを持たないため常に`null`（番号なし）。引数は契約の形を揃えるために受け取り、使わない。
     * @param {string} handleName - ハンドル名（使わない）
     * @returns {null} 常にnull
     */
    getVertexIndexForHandle(handleName) {
        return null;
    }

    /**
     * 円・弧の形（描画に使う中心・2つの半径・傾き・開始角・終了角）を求める唯一の箇所。
     * `u = points[1] − points[0]`・`w = points[2] − points[0]`を共役な半径として読む（輪郭＝中心＋`u`·cos t − `w`·sin t、
     * `t`は`startAngle`〜`endAngle`）。`points[3]`・`[4]`は読まない。
     * 1. 縦横に沿った枝（`uy === 0 && wx === 0`）：今の式（`radiusX = |points[1].x − xc|`・`radiusY = |points[2].y − yc|`）のまま、`rotation`は0。
     *    円は`this.startAngle`・`this.endAngle`。弧は`flipX = ux < 0`・`flipY = wy > 0`で範囲を取り直す（どちらも偽なら今の値そのもの）。
     * 2. 一般の枝：2×2行列`[[ux, −wx], [uy, −wy]]`を`R(φ)·diag(sx, sy)·R(θ)`に分解し、`radiusX = sx`・`radiusY = |sy|`・`rotation = φ`。
     *    弧は`sy ≥ 0`なら`[start + θ, end + θ]`、`sy < 0`（裏返った形）なら`[−(end + θ), −(start + θ)]`。
     * 弧の開始角は最後に`[0, 2π)`へ正規化する（差は保つ）。今の約束の位置の弧は`[π, 2π]`のまま。
     * 分解の取り方により、同じ形に対して`rotation`・半径の並び・開始角が別の等価な値になることがある。
     * @returns {EllipseGeometry} 描画・書き出しに使う形
     * @private
     */
    #readGeometry() {
        const TWO_PI = Math.PI * 2;
        const c = this.points[0];
        const ux = this.points[1].x - c.x;
        const uy = this.points[1].y - c.y;
        const wx = this.points[2].x - c.x;
        const wy = this.points[2].y - c.y;
        const isArc = this.type !== 'circle';
        const start = this.startAngle;
        const end = this.endAngle;

        let radiusX;
        let radiusY;
        let rotation;
        let axisAligned;
        let startAngle = start;
        let endAngle = end;

        if (uy === 0 && wx === 0) {
            radiusX = Math.abs(this.points[1].x - c.x);
            radiusY = Math.abs(this.points[2].y - c.y);
            rotation = 0;
            axisAligned = true;
            if (isArc) {
                const flipX = ux < 0;
                const flipY = wy > 0;
                if (flipX && flipY) {
                    startAngle = start - Math.PI;
                    endAngle = end - Math.PI;
                } else if (flipX) {
                    startAngle = Math.PI - end;
                    endAngle = Math.PI - start;
                } else if (flipY) {
                    startAngle = -end;
                    endAngle = -start;
                }
            }
        } else {
            const e = (ux - wy) / 2;
            const f = (ux + wy) / 2;
            const g = (uy - wx) / 2;
            const h = (uy + wx) / 2;
            const q = Math.hypot(e, h);
            const r = Math.hypot(f, g);
            const sx = q + r;
            const sy = q - r;
            const a1 = Math.atan2(g, f);
            const a2 = Math.atan2(h, e);
            const theta = (a2 - a1) / 2;
            radiusX = sx;
            radiusY = Math.abs(sy);
            rotation = (a2 + a1) / 2;
            axisAligned = false;
            if (isArc) {
                if (sy >= 0) {
                    startAngle = start + theta;
                    endAngle = end + theta;
                } else {
                    startAngle = -(end + theta);
                    endAngle = -(start + theta);
                }
            }
        }

        if (isArc) {
            while (startAngle < 0) {
                startAngle += TWO_PI;
                endAngle += TWO_PI;
            }
            while (startAngle >= TWO_PI) {
                startAngle -= TWO_PI;
                endAngle -= TWO_PI;
            }
        }

        return { x: c.x, y: c.y, radiusX, radiusY, rotation, startAngle, endAngle, axisAligned };
    }

    /**
     * ワールド座標の点を楕円の局所座標（中心を原点とし、`rotation`だけ逆に回した座標）へ写す。
     * 縦横に沿った枝は`{ x − 中心x, y − 中心y }`（今の`dx`・`dy`そのもの）、そうでなければ`rotation`の逆回転を当てる。
     * @param {EllipseGeometry} g - `#readGeometry`の結果
     * @param {number} x - 点のX座標（ワールド座標）
     * @param {number} y - 点のY座標（ワールド座標）
     * @returns {{x: number, y: number}} 局所座標の点（新しいオブジェクト）
     * @private
     */
    #toLocalPoint(g, x, y) {
        const dx = x - g.x;
        const dy = y - g.y;
        if (g.axisAligned) {
            return { x: dx, y: dy };
        }
        const cos = Math.cos(g.rotation);
        const sin = Math.sin(g.rotation);
        return { x: dx * cos + dy * sin, y: -dx * sin + dy * cos };
    }

    /**
     * 輪郭上の媒介変数`theta`の点（ワールド座標）を返す。縦横に沿った枝は今の式そのもの
     * （`x + radiusX·cosθ`・`y + radiusY·sinθ`）、そうでなければ`rotation`だけ回した楕円の点。
     * @param {EllipseGeometry} g - `#readGeometry`の結果
     * @param {number} theta - 媒介変数の角度（ラジアン）
     * @returns {{x: number, y: number}} 輪郭上の点（新しいオブジェクト）
     * @private
     */
    #pointOnOutline(g, theta) {
        if (g.axisAligned) {
            return { x: g.x + g.radiusX * Math.cos(theta), y: g.y + g.radiusY * Math.sin(theta) };
        }
        const ex = g.radiusX * Math.cos(theta);
        const ey = g.radiusY * Math.sin(theta);
        const cosR = Math.cos(g.rotation);
        const sinR = Math.sin(g.rotation);
        return { x: g.x + ex * cosR - ey * sinR, y: g.y + ex * sinR + ey * cosR };
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
     * 注意：円・弧は頂点のハンドルを持たないため画面の操作からは番号が渡らない。`VectorModel.updateVertices`が種別を分けず呼ぶ契約のメソッドで、
     * テストの図形の組み立てが使うため残す。今の約束の位置（`points[1]`が中心の右の同じ高さ・`points[2]`が中心の上の同じ横位置）を前提にした式で、回した・裏返した円・弧では正しくない。
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
            // 頂点の番号1（中心の右）の移動: x座標から新しいrxを計算
            const rx = Math.abs(x - this.points[0].x);
            const ry = Math.abs(this.points[2].y - this.points[0].y);
            this.#updatePointsFromRadii(rx, ry);
        } else if (vertexIndex === 2) {
            // 頂点の番号2（中心の上）の移動: y座標から新しいryを計算
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
     * `#readGeometry`の形を読み、点を楕円の局所座標（中心を原点に`rotation`だけ逆に回した座標。縦横に沿った枝は今の`dx`・`dy`そのもの）へ写して判定する。
     * 通常は距離比率r = sqrt((lx/rx)^2 + (ly/ry)^2)が1に近いかで判定し、許容幅は`tolerance + strokeWidth / 2`を
     * 平均半径（主軸の半径`rx`ともう一方の半径`ry`の平均）で割った比率とする。`rx < 1 || ry < 1`（つぶれた円・弧）では比率の式を使わず、
     * `#distanceToOutline`による輪郭の折れ線までの距離が`tolerance + strokeWidth / 2`以下かで判定する。
     * 弧は角度（縦横に沿った枝は`atan2(ly, lx)`、一般の枝は媒介変数の角度`atan2(ly / ry, lx / rx)`）を`(endAngle − 2π, endAngle]`へ写し、
     * `startAngle`より小さければ範囲外（空隙）として除外する（今の約束の位置の弧では右端のatan2=0は2πとして当たる）。
     * @param {number} x - 判定するX座標
     * @param {number} y - 判定するY座標
     * @param {number} tolerance - 当たり判定の許容誤差
     * @returns {boolean} 当たっている場合はtrue、そうでない場合はfalse
     */
    hitTest(x, y, tolerance) {
        const g = this.#readGeometry();
        const rx = g.radiusX;
        const ry = g.radiusY;

        // 最優先ガード: 0除算によるNaN/Infinity暴走や画面全域での誤爆を防止（縮退時は折れ線への距離で判定）
        if (rx < 1 || ry < 1) {
            return this.#distanceToOutline(x, y, g) <= tolerance + this.strokeWidth / 2;
        }

        const local = this.#toLocalPoint(g, x, y);
        const lx = local.x;
        const ly = local.y;

        // 楕円の境界線判定：距離比率 r = sqrt((lx/rx)^2 + (ly/ry)^2) が 1 に近いかどうか
        const value = (lx * lx) / (rx * rx) + (ly * ly) / (ry * ry);
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
            const TWO_PI = Math.PI * 2;
            let angle = g.axisAligned ? Math.atan2(ly, lx) : Math.atan2(ly / ry, lx / rx);
            while (angle <= g.endAngle - TWO_PI) {
                angle += TWO_PI;
            }
            while (angle > g.endAngle) {
                angle -= TWO_PI;
            }
            if (angle < g.startAngle) {
                return false;
            }
        }

        return true;
    }

    /**
     * 指定された座標(x, y)が塗られた内側にあるかを判定する（共通メソッド契約の第14メソッド）。
     * 塗られている（`isFillable()`が真で`fillColor`が文字列。`draw`の塗る条件と同じ）ときだけ判定し、そうでなければ常にfalse（弧は`fillColor`が文字列でもfalse）。
     * 許容誤差は使わない。`rx`・`ry`は`#readGeometry`の主軸・もう一方の半径で、`rx * rx > 0 && ry * ry > 0`でなければ（半径0、および2乗が0へ丸められる半径）
     * 面積0としてfalse（以後の除算の分母は0にならず、NaN・Infinityは生じない）。半径が正なら`rx < 1 || ry < 1`でも楕円の式で厳密に判定する。
     * 式は局所座標（中心を原点に`rotation`だけ逆に回した座標。縦横に沿った枝は今の`dx`・`dy`そのもの）での`(lx² / rx²) + (ly² / ry²) < 1`で、`hitTest`の`value`と同じ式（境目で丸めの差が出ないため）。境界上の点は含めない
     * （境界は輪郭の当たり`hitTest`が受け持つ）。通常の分岐では内側（`value < 1`）と輪郭（`|r − 1| ≤ allowedDiff`、`allowedDiff > 0`）の和が
     * `r ≤ 1 + allowedDiff`を隙間なく覆うため、`hitTest`の平均半径の近似は見直していない（`hitTest`の式を変えるときは和に隙間ができないか確かめ直すこと）。
     * 回した・裏返した円も局所座標で判定するため、傾いた楕円の内側で正しく働く。注意：弧の塗り（弓形・扇形）を入れるときは、`isFillable()`の判定と本メソッドの式を見直すこと。
     * @param {number} x - 判定するX座標（ワールド座標）
     * @param {number} y - 判定するY座標（ワールド座標）
     * @returns {boolean} 塗られていて、かつ楕円の内側（境界を除く）ならtrue
     */
    hitTestFill(x, y) {
        if (!this.isFillable() || typeof this.fillColor !== 'string') {
            return false;
        }

        const g = this.#readGeometry();
        const rx = g.radiusX;
        const ry = g.radiusY;

        if (!(rx * rx > 0 && ry * ry > 0)) {
            return false;
        }

        const local = this.#toLocalPoint(g, x, y);
        return (local.x * local.x) / (rx * rx) + (local.y * local.y) / (ry * ry) < 1;
    }

    /**
     * 点(x, y)から輪郭（中心線）の折れ線までの最短距離を返す。縮退時（rx/ryが1未満）の当たり判定用。
     * `intersectsRect`と同じパラメータ化（θ = g.startAngle + (g.endAngle − g.startAngle) × i / N、i = 0..N、
     * N = ELLIPSE_INTERSECT_SEGMENTS）で点を`#pointOnOutline`によりサンプリングし、隣接点を結ぶ各線分への距離の最小値を返す。
     * 弧は描画されている部分のみが対象となる。長さ0の線分は点までの距離として扱い、0除算しない。
     * @param {number} x - 判定するX座標（ワールド座標）
     * @param {number} y - 判定するY座標（ワールド座標）
     * @param {EllipseGeometry} g - `#readGeometry`の結果
     * @returns {number} 折れ線までの最短距離（ワールド座標の長さ）
     * @private
     */
    #distanceToOutline(x, y, g) {
        const segments = ELLIPSE_INTERSECT_SEGMENTS;
        const angleSpan = g.endAngle - g.startAngle;
        const first = this.#pointOnOutline(g, g.startAngle);
        let prevX = first.x;
        let prevY = first.y;
        let minDistance = Math.hypot(x - prevX, y - prevY);
        for (let i = 1; i <= segments; i++) {
            const theta = g.startAngle + angleSpan * i / segments;
            const point = this.#pointOnOutline(g, theta);
            const px = point.x;
            const py = point.y;
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
     * （共通メソッド契約の第9メソッド）。塗り内部は判定しない。矩形の境界上も交差とみなす。
     * 形は`draw()`と同じ`#readGeometry`の値で読む。縦横に沿った枝は外接矩形[xc − rx, xc + rx] × [yc − ry, yc + ry]、回した形は
     * 回した楕円を必ず含む保守的な正方形（半分の幅・高さが`max(rx, ry)`）が判定矩形と重ならなければfalseを返す（早期棄却。結果は変えない）。
     * 重なる場合はθ = startAngle + (endAngle − startAngle) × i / N（i = 0..N、N = ELLIPSE_INTERSECT_SEGMENTS）で
     * 輪郭上の点（`#pointOnOutline`。縦横に沿った枝は(xc + rx·cosθ, yc + ry·sinθ)）をサンプリングし、隣接点を結ぶN本の線分のいずれかが交差すればtrueを返す。
     * draw()のctx.ellipse(xc, yc, rx, ry, rotation, startAngle, endAngle)と同じパラメータ化のため、円・弧をtypeで分岐せず同一処理で扱い、
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
        const g = this.#readGeometry();
        const xc = g.x;
        const yc = g.y;
        // 早期棄却の外接矩形の半分の幅・高さ：縦横に沿った枝は半径そのもの、回した形は必ず含む保守的な値（max(rx, ry)）
        const halfW = g.axisAligned ? g.radiusX : Math.max(g.radiusX, g.radiusY);
        const halfH = g.axisAligned ? g.radiusY : Math.max(g.radiusX, g.radiusY);

        // 早期棄却：外接矩形と判定矩形が重ならなければ交差しない
        if (xc + halfW < minX || xc - halfW > maxX || yc + halfH < minY || yc - halfH > maxY) {
            return false;
        }

        const segments = ELLIPSE_INTERSECT_SEGMENTS;
        const angleSpan = g.endAngle - g.startAngle;
        const first = this.#pointOnOutline(g, g.startAngle);
        let prevX = first.x;
        let prevY = first.y;
        for (let i = 1; i <= segments; i++) {
            const theta = g.startAngle + angleSpan * i / segments;
            const point = this.#pointOnOutline(g, theta);
            const px = point.x;
            const py = point.y;
            if (segmentIntersectsRect(prevX, prevY, px, py, minX, minY, maxX, maxY)) {
                return true;
            }
            prevX = px;
            prevY = py;
        }
        return false;
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第12メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順。`rotation`は`ctx.ellipse`の引数の順で`radiusY`の後）:
     * `{ kind: 'ellipse', x, y, radiusX, radiusY, rotation, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor }`。
     * `x`・`y`・`radiusX`・`radiusY`・`rotation`・`startAngle`・`endAngle`は`draw`と同じ`#readGeometry`の形（今の約束の位置では`rotation`は0で、
     * ほかの値は従来と同じ）、`closed`は`type === 'circle'`。回した・裏返した円・弧では分解の取り方により等価な別の値になることがある。
     * `strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる（`strokeColor`の`null`も）。
     * `fillColor`は塗れる形（円）のときだけ図形の値、塗れない形（弧）は`null`。値はすべてプリミティブのため、戻り値と自身は状態を共有しない。
     * @returns {{kind: string, x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, closed: boolean, strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい描画要素
     */
    toDrawElement() {
        const g = this.#readGeometry();

        return {
            kind: 'ellipse',
            x: g.x,
            y: g.y,
            radiusX: g.radiusX,
            radiusY: g.radiusY,
            rotation: g.rotation,
            startAngle: g.startAngle,
            endAngle: g.endAngle,
            closed: this.type === 'circle',
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.isFillable() ? this.fillColor : null,
        };
    }

    /**
     * 自身を図形データ（1図形のJSON表現・現行版）へ変換する（共通メソッド契約の第10メソッド）。
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
     * 図形データ（`toJSON()`の形）から円・弧を復元する（共通メソッド契約の第11メソッド）。
     * 中心と`type`でコンストラクタを仮生成して`startAngle`/`endAngle`を`type`から求めた後、
     * 5頂点を`data`の座標値から新規オブジェクトとして設定し直す。
     * `points[3]`/`[4]`（開始角・終了角制御点）も再計算せず`data`の値をそのまま採用する
     * （往復で`toJSON()`の内容を一致させるため。描画・当たり判定は`points[0..2]`と角度のみに依存し、
     * 不整合な値でも形は`points[0..2]`だけから読まれ、`[3]`・`[4]`は変形・平行移動で一緒に写るだけ）。
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

    /**
     * アフィン変換を当てた新しいEllipse（円・弧）を返す（共通メソッド契約の第18メソッド）。自身は変えない。
     * 戻り値は自身と配列・頂点のオブジェクトを共有しない。`type`・`id`（そのまま）・`strokeColor`・`strokeWidth`・`fillColor`は自身と同じ（線の太さは変えない）。
     * 5つの点（`points[0]`〜`[4]`）をそのまま`applyAffineTransformToPoint`で写すだけ（`Rect`と同じ形）。拡大縮小・回転・傾き・裏返しの組み合わせを同じ入口で表せる
     * （回した円・弧は傾いた楕円・楕円の弧になり、弧の上下の裏返しは下半分の弧になる）。`Error`は投げない。
     * 点は約束の位置にそろえ直さない（裏返した円・弧の`points[1]`〜`[4]`は写した位置のまま。形は`#readGeometry`が読む）。種別で分岐しない。
     * `transform`の検証はしない（呼び出し側の責任）。
     * @param {import('./ShapeGeometry.js').AffineTransform} transform - 当てる変換（点`(x, y)`→`(a·x + c·y + e, b·x + d·y + f)`）
     * @returns {Ellipse} 変換を当てた新しい図形
     */
    createTransformed(transform) {
        const center = applyAffineTransformToPoint(transform, this.points[0]);
        const transformed = new Ellipse(center.x, center.y, center.x, center.y, this.type, this.strokeColor, this.strokeWidth, this.fillColor);
        transformed.points = this.points.map((point) => applyAffineTransformToPoint(transform, point));
        transformed.id = this.id;
        return transformed;
    }
}
