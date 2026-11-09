/**
 * 責務: 2次ベジェ曲線（始点・制御点・終点）のデータ保持・Canvasへの描画処理・当たり判定、
 * および図形データとの相互変換と描画要素（スプライトの書き出し用）への変換を担う。
 */

import { quadraticBezierPoint, segmentIntersectsRect } from './ShapeGeometry.js';
import { validateShapeData } from './ShapeDataValidation.js';

/**
 * 範囲選択の交差判定（intersectsRect）で用いる輪郭サンプリングの分割数。
 * hitTestの100分割と同程度の計算量。
 * @type {number}
 */
const CURVE_INTERSECT_SEGMENTS = 100;

/**
 * 曲線の図形データ（1図形のJSON表現・バージョン1）が持つ頂点数。
 * @type {number}
 */
const CURVE_POINT_COUNT = 3;

/**
 * 2次ベジェ曲線の図形クラス（図形種別`'curve'`）。頂点は`points[0]`＝始点、`[1]`＝制御点、`[2]`＝終点。
 * 共通メソッド契約（13メソッド：draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement）を自律実装する。座標はすべてワールド座標。
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
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致） */
        this.type = 'curve';
        /** @type {*} 図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）。 */
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
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）
     * @returns {boolean} 曲線との距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        const [p0, p1, p2] = this.points;
        const segments = 100;
        let minDistance = Infinity;

        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const { x: bx, y: by } = quadraticBezierPoint(p0, p1, p2, t);
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
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）
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
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド
     * （共通メソッド契約の第10メソッド）。塗り内部は判定しない。矩形の境界上も交差とみなす。
     * 早期棄却として制御多角形（points[0..2]）の外接矩形が判定矩形と重ならなければfalseを返す
     * （ベジェ曲線は制御点の凸包内にあるため正しい）。重なる場合はB(t)をt = i / N（i = 0..N、N = CURVE_INTERSECT_SEGMENTS）で
     * サンプリングし、隣接点を結ぶN本の線分のいずれかが交差すればtrueを返す。
     * 折れ線近似のため、真の輪郭とのずれがわずかに生じる。
     * @param {number} minX - 判定矩形の左端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} minY - 判定矩形の上端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @param {number} maxX - 判定矩形の右端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} maxY - 判定矩形の下端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @returns {boolean} 輪郭線の一部でも矩形に掛かればtrue
     */
    intersectsRect(minX, minY, maxX, maxY) {
        const [p0, p1, p2] = this.points;

        // 早期棄却：制御多角形の外接矩形と判定矩形が重ならなければ交差しない
        const boundMinX = Math.min(p0.x, p1.x, p2.x);
        const boundMaxX = Math.max(p0.x, p1.x, p2.x);
        const boundMinY = Math.min(p0.y, p1.y, p2.y);
        const boundMaxY = Math.max(p0.y, p1.y, p2.y);
        if (boundMaxX < minX || boundMinX > maxX || boundMaxY < minY || boundMinY > maxY) {
            return false;
        }

        const segments = CURVE_INTERSECT_SEGMENTS;
        let prevX = p0.x;
        let prevY = p0.y;
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const { x: bx, y: by } = quadraticBezierPoint(p0, p1, p2, t);
            if (segmentIntersectsRect(prevX, prevY, bx, by, minX, minY, maxX, maxY)) {
                return true;
            }
            prevX = bx;
            prevY = by;
        }
        return false;
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * vertexIndexが0であれば始点を、1であれば制御点を、2であれば終点を更新する。
     * それ以外の値が渡された場合は何もしない。
     * @param {number} vertexIndex - 更新する頂点のインデックス（0: 始点, 1: 制御点, 2: 終点）
     * @param {number} x - 更新後のX座標（ワールド座標）
     * @param {number} y - 更新後のY座標（ワールド座標）
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
     * @param {number} x - 追従先のX座標（ワールド座標）
     * @param {number} y - 追従先のY座標（ワールド座標）
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
     * @param {number} dx - X方向の移動差分（ワールド座標）
     * @param {number} dy - Y方向の移動差分（ワールド座標）
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

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第13メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順）: `{ kind: 'quadratic', id, points: [始点{x, y}, 制御点{x, y}, 終点{x, y}], strokeColor, strokeWidth }`。
     * `draw`と同じ式（`points[0]`から`points[1]`を制御点に`points[2]`への2次ベジェ）で求め、`id`・`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる。
     * `points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は配列・頂点を共有しない。
     * @returns {{kind: string, id: *, points: {x: number, y: number}[], strokeColor: string, strokeWidth: number}} 新しい描画要素
     */
    toDrawElement() {
        return {
            kind: 'quadratic',
            id: this.id,
            points: this.points.slice(0, 3).map((point) => ({ x: point.x, y: point.y })),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
        };
    }

    /**
     * 自身を図形データ（1図形のJSON表現・バージョン1）へ変換する（共通メソッド契約の第11メソッド）。
     * 形（キー順もこの順）: `{ type: 'curve', id, points: [始点{x, y}, 制御点{x, y}, 終点{x, y}], strokeColor, strokeWidth }`。
     * 座標はワールド座標。`points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は内部配列・頂点を共有しない。
     * `id`が`null`（作成中の図形など）の場合もそのまま出力する。
     * `JSON.stringify(curve)`でも本メソッドの戻り値が出力される。
     * @returns {{type: string, id: *, points: {x: number, y: number}[], strokeColor: string, strokeWidth: number}} 新しい図形データ
     */
    toJSON() {
        return {
            type: this.type,
            id: this.id,
            points: this.points.map((point) => ({ x: point.x, y: point.y })),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
        };
    }

    /**
     * 図形データ（`toJSON()`の形）から曲線を復元する（共通メソッド契約の第12メソッド）。
     * 始点・終点でコンストラクタを仮生成した後、3頂点（制御点を含む）を`data`の座標値から新規オブジェクトとして設定し直す。
     * 座標・色・太さ・種別を`data`の値どおりに復元するため、`toJSON()`の出力から復元した図形は
     * 描画・当たり判定・頂点操作・`toJSON()`の結果が元の図形と一致する（往復の一致）。
     * `id`は検証せず`data.id`をそのまま保持する（欠落なら`undefined`）。idの正規化・振り直しは
     * 図形一式を管理する`VectorModel`の責務であり、図形クラスはidの規則を知らないため。
     * `data`内の配列・頂点オブジェクトは流用しない。余分なプロパティは無視する。
     * 例外の捕捉は行わない（呼び出し側の`DocumentSerializer`が図形単位で捕捉する）。
     * @param {Object} data - 図形データ（プレーンオブジェクト）
     * @returns {Curve} 復元した曲線
     * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`'curve'`でない／`points`が3要素の配列でない／
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でない／
     *     `strokeWidth`が有限の数値でないか0以下の場合
     */
    static fromJSON(data) {
        validateShapeData(data, 'Curve', ['curve'], CURVE_POINT_COUNT);
        const [start, , end] = data.points;
        const curve = new Curve(start.x, start.y, end.x, end.y, data.strokeColor, data.strokeWidth);
        curve.points = data.points.map((point) => ({ x: point.x, y: point.y }));
        curve.id = data.id;
        return curve;
    }
}
