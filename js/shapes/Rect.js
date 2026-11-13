/**
 * 責務: 矩形（4頂点独立構造）のデータ保持・Canvasへの描画処理・当たり判定、
 * および図形データとの相互変換と描画要素（スプライトの書き出し用）への変換を担う。
 */

import { distanceToSegment, segmentIntersectsRect, isPointInPolygonNonzero } from './ShapeGeometry.js';
import { validateShapeData } from './ShapeDataValidation.js';

/**
 * 矩形の図形データ（1図形のJSON表現・現行版）が持つ頂点数。
 * @type {number}
 */
const RECT_POINT_COUNT = 4;

/**
 * 矩形の図形クラス（図形種別`'rect'`）。頂点は`points[0]`＝topLeft、`[1]`＝topRight、`[2]`＝bottomRight、`[3]`＝bottomLeft（4頂点独立）。
 * 共通メソッド契約（16メソッド：draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement・isFillable・hitTestFill・drawOutline）を自律実装する。座標はすべてワールド座標。
 */
export class Rect {
    /**
     * @param {number} x1 - 対角座標1のX座標
     * @param {number} y1 - 対角座標1のY座標
     * @param {number} x2 - 対角座標2のX座標
     * @param {number} y2 - 対角座標2のY座標
     * @param {string|null} [strokeColor='#000000'] - 線の色。`null`は線なし
     * @param {number} [strokeWidth=2] - 線の太さ
     * @param {string|null} [fillColor=null] - 塗りの色。`null`は塗りなし
     */
    constructor(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2, fillColor = null) {
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致） */
        this.type = 'rect';
        /** @type {*} 図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）。 */
        this.id = null;
        /** @type {{x: number, y: number}[]} 頂点配列（長さ4固定）。points[0]=topLeft, points[1]=topRight, points[2]=bottomRight, points[3]=bottomLeft */
        this.points = [
            { x: x1, y: y1 },
            { x: x2, y: y1 },
            { x: x2, y: y2 },
            { x: x1, y: y2 },
        ];
        /** @type {string|null} 線の色。`null`は線なし */
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
        /** @type {string|null} 塗りの色。nullは塗りなし。塗れない形でも保持する（描かないだけ） */
        this.fillColor = fillColor;
    }

    /**
     * 塗れる形かを返す（共通メソッド契約の第14メソッド）。矩形は常に塗れる。データには保存しない。
     * @returns {boolean} 常に`true`
     */
    isFillable() {
        return true;
    }

    /**
     * Canvasに矩形を描画する。points[0]→[1]→[2]→[3]の順に結び閉じたパスを組み立てる。
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

        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.lineTo(this.points[3].x, this.points[3].y);
        ctx.closePath();

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
     * 選択中に4隅のハンドルを描き分けて描画する。
     * Line/Curveと同一配色（白塗り／青枠）・同一サイズ（画面上で一辺8pxの正方形）で4頂点すべてに描画する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。ハンドルの大きさ・枠線幅を画面上で一定に保つために用いる。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHandles(ctx, viewScale = 1) {
        const handleSize = 8 / viewScale; // 画面上8px一定（ワールド長へ換算）
        const half = handleSize / 2;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#4a90e2';
        ctx.lineWidth = 1.5 / viewScale;

        this.points.forEach(({ x: hx, y: hy }) => {
            ctx.beginPath();
            ctx.rect(hx - half, hy - half, handleSize, handleSize);
            ctx.fill();
            ctx.stroke();
        });
    }

    /**
     * 点(x, y)が矩形本体の許容誤差(tolerance)以内にあるかを判定する当たり判定。
     * 4辺（[0,1],[1,2],[2,3],[3,0]）それぞれについて点-線分距離を求め、
     * いずれか1辺でもtolerance以内であればtrueを返す。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）
     * @returns {boolean} 矩形との距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
        return edges.some(([a, b]) => {
            const pa = this.points[a];
            const pb = this.points[b];
            return distanceToSegment(x, y, pa.x, pa.y, pb.x, pb.y) <= tolerance;
        });
    }

    /**
     * 点(x, y)が塗られた矩形の内側にあるかを判定する内側の当たり判定（共通メソッド契約の第15メソッド）。
     * 塗られている（`draw`が塗りを描く条件と同じ`isFillable()`が真で`fillColor`が文字列）ときだけ判定し、塗られていなければ常に`false`。
     * 許容誤差は使わない。境界（辺の上・頂点の上）は内側に含めない（輪郭の`hitTest`が受け持つ）。
     * `points[0]`→`[1]`→`[2]`→`[3]`（閉じる辺`[3]`→`[0]`を含む）の4頂点の多角形としてnonzeroで判定し、
     * `setVertex`で頂点を動かせるため軸に平行・凸・自己交差なしを前提にしない。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @returns {boolean} 塗られた矩形の内側（境界を除く）であれば`true`
     */
    hitTestFill(x, y) {
        if (!this.isFillable() || typeof this.fillColor !== 'string') {
            return false;
        }
        return isPointInPolygonNonzero(x, y, this.points);
    }

    /**
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド
     * （共通メソッド契約の第10メソッド）。塗り内部は判定しない（選択矩形が矩形の内側に収まり辺と交差しない場合はfalse）。
     * 4辺（[0,1],[1,2],[2,3],[3,0]。hitTestと同じ辺の組）のいずれかが交差すればtrueを返す。矩形の境界上も交差とみなす。
     * @param {number} minX - 判定矩形の左端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} minY - 判定矩形の上端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @param {number} maxX - 判定矩形の右端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} maxY - 判定矩形の下端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @returns {boolean} 輪郭線の一部でも矩形に掛かればtrue
     */
    intersectsRect(minX, minY, maxX, maxY) {
        const edges = [[0, 1], [1, 2], [2, 3], [3, 0]];
        return edges.some(([a, b]) => {
            const pa = this.points[a];
            const pb = this.points[b];
            return segmentIntersectsRect(pa.x, pa.y, pb.x, pb.y, minX, minY, maxX, maxY);
        });
    }

    /**
     * 点(x, y)が4隅のハンドルいずれかの許容誤差(tolerance)以内にあるかを判定する。
     * 複数のハンドルが同時にtolerance以内となる場合は、topLeft → topRight → bottomRight → bottomLeftの優先順位で先着1件を返す。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）
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
     * vertexIndexが0〜3の整数であれば対応するpoints要素を直接上書きする（矩形維持のための連動再計算は行わない）。
     * 0〜3の整数以外（null・文字列・小数・範囲外）は何もしない。
     * @param {number} vertexIndex - 更新する頂点のインデックス（0: topLeft, 1: topRight, 2: bottomRight, 3: bottomLeft）
     * @param {number} x - 更新後のX座標（ワールド座標）
     * @param {number} y - 更新後のY座標（ワールド座標）
     */
    setVertex(vertexIndex, x, y) {
        if (Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex <= 3) {
            this.points[vertexIndex] = { x, y };
        }
    }

    /**
     * 作図中にカーソル位置へ追従させる。points[0]（1回目クリック地点）は固定したまま、
     * points[2]をカーソル座標へ、points[1]/[3]を対角線上の交点として動的に再計算する。
     * @param {number} x - 追従先のX座標（ワールド座標）
     * @param {number} y - 追従先のY座標（ワールド座標）
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
     * draw()と同じ4頂点パス（closePath含む）に対し、Line/Curveと同一仕様
     * （半透明の太線）を重ねて強調する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。強調の上乗せ幅を画面上で一定に保つために用いる（図形本体の`strokeWidth`部分は倍率に比例して表示される）。省略時は倍率1.0として現行と同じ見た目になる
     */
    drawHover(ctx, viewScale = 1) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.lineTo(this.points[3].x, this.points[3].y);
        ctx.closePath();

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6 / viewScale;
        ctx.stroke();
    }

    /**
     * アウトライン表示として、輪郭だけを画面上1pxの細線で描画する（共通メソッド契約の第16メソッド）。
     * 輪郭のパスは`draw`と同じ（`points[0]`→`[1]`→`[2]`→`[3]`を結んで閉じる）。
     * 塗らず（`fill`を呼ばない）、図形のスタイル（`strokeColor`・`strokeWidth`・`fillColor`）は読まないため、線なしの図形でも描く。
     * `draw`は変えない（`io/CodeExporter.js`の`DRAW_SOURCE`と手で揃えているため、本メソッドを別に持つ）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。線の太さを画面上1pxに保つために用いる（`lineWidth = 1 / viewScale`）
     * @param {string} color - 輪郭線の色（`strokeStyle`へそのまま渡す）
     */
    drawOutline(ctx, viewScale = 1, color) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        ctx.lineTo(this.points[1].x, this.points[1].y);
        ctx.lineTo(this.points[2].x, this.points[2].y);
        ctx.lineTo(this.points[3].x, this.points[3].y);
        ctx.closePath();

        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / viewScale;
        ctx.stroke();
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第13メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順）: `{ kind: 'polyline', id, points: [topLeft, topRight, bottomRight, bottomLeft]（各{x, y}）, closed: true, strokeColor, strokeWidth, fillColor }`。
     * `draw`と同じ式（`points[0]`→`[1]`→`[2]`→`[3]`を結んで閉じる）で求め、`id`・`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる（`strokeColor`の`null`も）。
     * `fillColor`は塗れる形のときだけ図形の値（矩形は常に図形の値）、塗れない形は`null`。
     * `points`は並びのまま各頂点を新規オブジェクトとして複製するため、戻り値と自身は配列・頂点を共有しない。
     * @returns {{kind: string, id: *, points: {x: number, y: number}[], closed: boolean, strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい描画要素
     */
    toDrawElement() {
        return {
            kind: 'polyline',
            id: this.id,
            points: this.points.slice(0, 4).map((point) => ({ x: point.x, y: point.y })),
            closed: true,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.isFillable() ? this.fillColor : null,
        };
    }

    /**
     * 自身を図形データ（1図形のJSON表現・現行版）へ変換する（共通メソッド契約の第11メソッド）。
     * 形（キー順もこの順）: `{ type: 'rect', id, points: [topLeft{x, y}, topRight{x, y}, bottomRight{x, y}, bottomLeft{x, y}], strokeColor, strokeWidth, fillColor }`。
     * `fillColor`は塗れない形でも保持している値をそのまま出力する。
     * 座標はワールド座標。`points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は内部配列・頂点を共有しない。
     * `id`が`null`（作成中の図形など）の場合もそのまま出力する。
     * `JSON.stringify(rect)`でも本メソッドの戻り値が出力される。
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
     * 図形データ（`toJSON()`の形）から矩形を復元する（共通メソッド契約の第12メソッド）。
     * topLeft・bottomRightでコンストラクタを仮生成した後、4頂点を`data`の座標値から新規オブジェクトとして設定し直す
     * （4頂点は独立して編集され得るため、軸平行な矩形としての再計算は行わない）。
     * 座標・色・太さ・種別を`data`の値どおりに復元するため、`toJSON()`の出力から復元した図形は
     * 描画・当たり判定・頂点操作・`toJSON()`の結果が元の図形と一致する（往復の一致）。
     * `id`は検証せず`data.id`をそのまま保持する（欠落なら`undefined`）。idの正規化・振り直しは
     * 図形一式を管理する`VectorModel`の責務であり、図形クラスはidの規則を知らないため。
     * `data`内の配列・頂点オブジェクトは流用しない。余分なプロパティは無視する。
     * 例外の捕捉は行わない（呼び出し側の`DocumentSerializer`が図形単位で捕捉する）。
     * @param {Object} data - 図形データ（プレーンオブジェクト）
     * @returns {Rect} 復元した矩形
     * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`'rect'`でない／`points`が4要素の配列でない／
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でも`null`でもない／
     *     `strokeWidth`が`undefined`以外で有限の数値でないか0以下／`fillColor`が`undefined`・文字列・`null`以外の場合
     *     （`strokeWidth`のキーなしは2px、`fillColor`のキーなしは`null`として読む）
     */
    static fromJSON(data) {
        const style = validateShapeData(data, 'Rect', ['rect'], RECT_POINT_COUNT);
        const [topLeft, , bottomRight] = data.points;
        const rect = new Rect(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y, style.strokeColor, style.strokeWidth, style.fillColor);
        rect.points = data.points.map((point) => ({ x: point.x, y: point.y }));
        rect.id = data.id;
        return rect;
    }
}
