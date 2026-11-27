/**
 * 責務: 2次ベジェ曲線（始点・制御点・終点）のデータ保持・Canvasへの描画処理・当たり判定、
 * 図形データとの相互変換、描画要素（スプライトの書き出し用）への変換、および変形（アフィン変換）を当てた新しい図形の生成を担う。
 */

import { applyAffineTransformToPoint, isPointInPolygonEvenOdd, quadraticBezierPoint, segmentIntersectsRect } from './ShapeGeometry.js';
import { validateShapeData } from './ShapeDataValidation.js';

/**
 * 範囲選択の交差判定（intersectsRect）で用いる輪郭サンプリングの分割数。
 * hitTestの100分割と同程度の計算量。
 * @type {number}
 */
const CURVE_INTERSECT_SEGMENTS = 100;

/**
 * 曲線の図形データ（1図形のJSON表現・現行版）が持つ頂点数。
 * @type {number}
 */
const CURVE_POINT_COUNT = 3;

/**
 * 2次ベジェ曲線の図形クラス（図形種別`'curve'`）。頂点は`points[0]`＝始点、`[1]`＝制御点、`[2]`＝終点。
 * 共通メソッド契約（20メソッド：draw・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement・isFillable・hitTestFill・drawOutline・getHandlePosition・getVertexHandleNames・createTransformed・appendOutline・isInsideOutline）を自律実装する。座標はすべてワールド座標。
 */
export class Curve {
    /**
     * @param {number} x1 - 始点のX座標
     * @param {number} y1 - 始点のY座標
     * @param {number} x2 - 終点のX座標
     * @param {number} y2 - 終点のY座標
     * @param {string|null} [strokeColor='#000000'] - 線の色。`null`は線なし
     * @param {number} [strokeWidth=2] - 線の太さ
     * @param {string|null} [fillColor=null] - 塗りの色。`null`は塗りなし（曲線は塗れない形のため描かれないが保持する）
     */
    constructor(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2, fillColor = null) {
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
        /** @type {string|null} 線の色。`null`は線なし */
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
        /** @type {string|null} 塗りの色。nullは塗りなし。塗れない形でも保持する（描かないだけ） */
        this.fillColor = fillColor;
    }

    /**
     * 塗れる形かを返す（共通メソッド契約の第13メソッド）。曲線は常に塗れない。データには保存しない。
     * @returns {boolean} 常に`false`
     */
    isFillable() {
        return false;
    }

    /**
     * Canvasに2次ベジェ曲線を描画する。塗るのは`isFillable()`が真で`fillColor`が文字列のときだけ（曲線は塗らない）、
     * 線を描くのは`strokeColor`が文字列のときだけ。どちらも偽なら何も呼ばない。
     * 順序は`io/CodeExporter.js`の`DRAW_SOURCE`と同じ（パス → 塗り → 線）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - 将来のモーフィング機能用の予約引数（本Phaseでは未使用）
     */
    draw(ctx, t = 0) {
        const shouldFill = this.isFillable() && typeof this.fillColor === 'string';
        const shouldStroke = typeof this.strokeColor === 'string';
        if (!shouldFill && !shouldStroke) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.quadraticCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y);

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
     * 点(x, y)が塗られた内側にあるかを判定する内側の当たり判定（共通メソッド契約の第14メソッド）。
     * 塗られている条件は`draw`と同じ（`isFillable()`が真で`fillColor`が文字列）。曲線は塗れない形
     * （`isFillable()`が常に偽）で、面積を持たないため内側の点は無く、常に`false`を返す。
     * 曲線と始点・終点を結ぶ弦で囲まれた部分も内側としない。許容誤差は使わない。
     * 引数`x`・`y`は使わない（契約の形を揃えるために受け取る）。
     * @param {number} x - 判定対象点のX座標（ワールド座標。使わない）
     * @param {number} y - 判定対象点のY座標（ワールド座標。使わない）
     * @returns {boolean} 常に`false`
     */
    hitTestFill(x, y) {
        if (!this.isFillable() || typeof this.fillColor !== 'string') {
            return false;
        }
        return false;
    }

    /**
     * 自分の輪郭を、呼び出し側が`beginPath`した今のパスへ新しいサブパスとして足す（共通メソッド契約の第19メソッド）。
     * `beginPath`は呼ばない。命令は`draw`のパスの部分と同じ（`moveTo(points[0])`→`quadraticCurveTo(points[1], points[2])`。開いた形のため`closePath`しない）。
     * 塗り・線・スタイルは呼ばない・読まない。
     * @param {CanvasRenderingContext2D} ctx - 輪郭を足す先の2Dコンテキスト
     */
    appendOutline(ctx) {
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.quadraticCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y);
    }

    /**
     * 点(x, y)が自分の輪郭（開いた形は始点と終点を結んで閉じたもの）の内側にあるかを`evenodd`で判定する（共通メソッド契約の第20メソッド）。
     * `CURVE_INTERSECT_SEGMENTS`（100）分割の点（`t=0〜1`の101点）の多角形（曲線と弦で囲まれた部分）として判定する。
     * スタイル・`isFillable()`は読まない。境界の上は`false`。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @returns {boolean} 輪郭の内側（境界を除く）なら`true`
     */
    isInsideOutline(x, y) {
        const [p0, p1, p2] = this.points;
        const polygon = [];
        for (let i = 0; i <= CURVE_INTERSECT_SEGMENTS; i++) {
            polygon.push(quadraticBezierPoint(p0, p1, p2, i / CURVE_INTERSECT_SEGMENTS));
        }
        return isPointInPolygonEvenOdd(x, y, polygon);
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
     * ハンドル名（`hitTestHandle`の戻り値）から、そのハンドルの位置を返す（共通メソッド契約の第16メソッド）。
     * 位置は`hitTestHandle`と同じ頂点（`'start'`＝`points[0]`、`'control'`＝`points[1]`、`'end'`＝`points[2]`）の写し。
     * ハンドル名でない値（`null`・`undefined`・未知の文字列・文字列以外・`'move'`・`'constructor'`等の`Object.prototype`のキー名）は`null`。
     * 戻り値は新しいオブジェクトで、書き換えても自身は変わらない。
     * @param {*} handleName - ハンドル名（'start'|'control'|'end'）。任意の値を受け、これ以外は`null`を返す
     * @returns {{x: number, y: number}|null} ハンドルの位置（ワールド座標）。該当なしはnull
     */
    getHandlePosition(handleName) {
        let index;
        if (handleName === 'start') index = 0;
        else if (handleName === 'control') index = 1;
        else if (handleName === 'end') index = 2;
        else return null;
        return { x: this.points[index].x, y: this.points[index].y };
    }

    /**
     * 頂点として扱えるハンドル名の一覧を返す（共通メソッド契約の第17メソッド）。
     * 始点・制御点・終点の3つ。
     * 並びは`getVertexIndexForHandle`が返す頂点の番号の昇順。一覧の各名前は`hitTestHandle`が返しうる名前で、
     * `getVertexIndexForHandle`が番号を、`getHandlePosition`が位置を返す。
     * 戻り値は毎回新しい配列で、書き換えても自身は変わらない。
     * @returns {string[]} 頂点のハンドル名の配列
     */
    getVertexHandleNames() {
        return ['start', 'control', 'end'];
    }

    /**
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド
     * （共通メソッド契約の第9メソッド）。塗り内部は判定しない。矩形の境界上も交差とみなす。
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
     * アウトライン表示として、輪郭だけを画面上1pxの細線で描画する（共通メソッド契約の第15メソッド）。
     * 輪郭のパスは`draw`と同じ（`points[0]`から`points[1]`を制御点に`points[2]`への2次ベジェ。閉じない）。
     * 塗らず（`fill`を呼ばない）、図形のスタイル（`strokeColor`・`strokeWidth`・`fillColor`）は読まないため、線なしの図形でも描く。
     * `draw`は変えない（`io/CodeExporter.js`の`DRAW_SOURCE`と手で揃えているため、本メソッドを別に持つ）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。線の太さを画面上1pxに保つために用いる（`lineWidth = 1 / viewScale`）
     * @param {string} color - 輪郭線の色（`strokeStyle`へそのまま渡す）
     */
    drawOutline(ctx, viewScale = 1, color) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.quadraticCurveTo(this.points[1].x, this.points[1].y, this.points[2].x, this.points[2].y);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / viewScale;
        ctx.stroke();
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第12メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順）: `{ kind: 'quadratic', points: [始点{x, y}, 制御点{x, y}, 終点{x, y}], strokeColor, strokeWidth, fillColor }`。
     * `draw`と同じ式（`points[0]`から`points[1]`を制御点に`points[2]`への2次ベジェ）で求め、`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる（`strokeColor`の`null`も）。
     * `fillColor`は塗れる形のときだけ図形の値、塗れない形（曲線）は常に`null`。
     * `points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は配列・頂点を共有しない。
     * @returns {{kind: string, points: {x: number, y: number}[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい描画要素
     */
    toDrawElement() {
        return {
            kind: 'quadratic',
            points: this.points.slice(0, 3).map((point) => ({ x: point.x, y: point.y })),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.isFillable() ? this.fillColor : null,
        };
    }

    /**
     * 自身を図形データ（1図形のJSON表現・現行版）へ変換する（共通メソッド契約の第10メソッド）。
     * 形（キー順もこの順）: `{ type: 'curve', id, points: [始点{x, y}, 制御点{x, y}, 終点{x, y}], strokeColor, strokeWidth, fillColor }`。
     * `fillColor`は塗れない形でも保持している値をそのまま出力する。
     * 座標はワールド座標。`points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は内部配列・頂点を共有しない。
     * `id`が`null`（作成中の図形など）の場合もそのまま出力する。
     * `JSON.stringify(curve)`でも本メソッドの戻り値が出力される。
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
     * 図形データ（`toJSON()`の形）から曲線を復元する（共通メソッド契約の第11メソッド）。
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
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でも`null`でもない／
     *     `strokeWidth`が`undefined`以外で有限の数値でないか0以下／`fillColor`が`undefined`・文字列・`null`以外の場合
     *     （`strokeWidth`のキーなしは2px、`fillColor`のキーなしは`null`として読む）
     */
    static fromJSON(data) {
        const style = validateShapeData(data, 'Curve', ['curve'], CURVE_POINT_COUNT);
        const [start, , end] = data.points;
        const curve = new Curve(start.x, start.y, end.x, end.y, style.strokeColor, style.strokeWidth, style.fillColor);
        curve.points = data.points.map((point) => ({ x: point.x, y: point.y }));
        curve.id = data.id;
        return curve;
    }

    /**
     * アフィン変換を当てた新しいCurveを返す（共通メソッド契約の第18メソッド）。自身は変えない。
     * 戻り値は自身と配列・頂点のオブジェクトを共有しない。`type`・`id`（そのまま）・`strokeColor`・`strokeWidth`・`fillColor`は自身と同じ
     * （線の太さは変えない）。`transform`の検証はしない（呼び出し側の責任）。
     * @param {import('./ShapeGeometry.js').AffineTransform} transform - 当てる変換（点`(x, y)`→`(a·x + c·y + e, b·x + d·y + f)`）
     * @returns {Curve} 変換を当てた新しい図形
     */
    createTransformed(transform) {
        const transformed = new Curve(this.points[0].x, this.points[0].y, this.points[2].x, this.points[2].y, this.strokeColor, this.strokeWidth, this.fillColor);
        transformed.points = this.points.map((point) => applyAffineTransformToPoint(transform, point));
        transformed.id = this.id;
        return transformed;
    }
}
