/**
 * 責務: 直線のデータ保持・Canvasへの描画処理・当たり判定、および図形データとの相互変換と描画要素（スプライトの書き出し用）への変換を担う。
 */

import { distanceToSegment, segmentIntersectsRect } from './ShapeGeometry.js';
import { validateShapeData } from './ShapeDataValidation.js';

/**
 * 直線の図形データ（1図形のJSON表現・現行版）が持つ頂点数。
 * @type {number}
 */
const LINE_POINT_COUNT = 2;

/**
 * 直線の図形クラス（図形種別`'line'`）。頂点は`x1, y1`＝始点、`x2, y2`＝終点として保持する。
 * 共通メソッド契約（17メソッド：draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement・isFillable・hitTestFill・drawOutline・getHandlePosition）を自律実装する。座標はすべてワールド座標。
 */
export class Line {
    /**
     * @param {number} x1 - 始点のX座標
     * @param {number} y1 - 始点のY座標
     * @param {number} x2 - 終点のX座標
     * @param {number} y2 - 終点のY座標
     * @param {string|null} [strokeColor='#000000'] - 線の色。`null`は線なし
     * @param {number} [strokeWidth=2] - 線の太さ
     * @param {string|null} [fillColor=null] - 塗りの色。`null`は塗りなし（直線は塗れない形のため描かれないが保持する）
     */
    constructor(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2, fillColor = null) {
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致） */
        this.type = 'line';
        /** @type {*} 図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）。 */
        this.id = null;
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
        /** @type {string|null} 線の色。`null`は線なし */
        this.strokeColor = strokeColor;
        this.strokeWidth = strokeWidth;
        /** @type {string|null} 塗りの色。nullは塗りなし。塗れない形でも保持する（描かないだけ） */
        this.fillColor = fillColor;
    }

    /**
     * 塗れる形かを返す（共通メソッド契約の第14メソッド）。直線は常に塗れない。データには保存しない。
     * @returns {boolean} 常に`false`
     */
    isFillable() {
        return false;
    }

    /**
     * 点(x, y)が線分本体の許容誤差(tolerance)以内にあるかを判定する当たり判定。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）
     * @returns {boolean} 線分との距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        return distanceToSegment(x, y, this.x1, this.y1, this.x2, this.y2) <= tolerance;
    }

    /**
     * 点(x, y)が塗られた内側にあるかを判定する内側の当たり判定（共通メソッド契約の第15メソッド）。
     * 塗られている条件は`draw`と同じ（`isFillable()`が真で`fillColor`が文字列）。直線は塗れない形
     * （`isFillable()`が常に偽）で、面積を持たないため内側の点は無く、常に`false`を返す。許容誤差は使わない。
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
     * 点(x, y)が始点・終点・移動（中点）のいずれかのハンドルの許容誤差(tolerance)以内にあるかを判定する。
     * 複数のハンドルが同時にtolerance以内となる場合は、start → end → move の優先順位で先着1件を返す。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ。呼び出し側が画面上の許容誤差をワールド換算して渡す）
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
     * ハンドル名（`hitTestHandle`の戻り値）から、そのハンドルの位置を返す（共通メソッド契約の第17メソッド）。
     * 位置は`hitTestHandle`・`drawHandles`と同じ式（`'start'`＝始点、`'end'`＝終点、`'move'`＝中点）で求める。
     * ハンドル名でない値（`null`・`undefined`・未知の文字列・文字列以外・`'constructor'`等の`Object.prototype`のキー名）は`null`。
     * 戻り値は新しいオブジェクトで、書き換えても自身は変わらない。
     * @param {*} handleName - ハンドル名（'start'|'end'|'move'）。任意の値を受け、これ以外は`null`を返す
     * @returns {{x: number, y: number}|null} ハンドルの位置（ワールド座標）。該当なしはnull
     */
    getHandlePosition(handleName) {
        if (handleName === 'start') return { x: this.x1, y: this.y1 };
        if (handleName === 'end') return { x: this.x2, y: this.y2 };
        if (handleName === 'move') return { x: (this.x1 + this.x2) / 2, y: (this.y1 + this.y2) / 2 };
        return null;
    }

    /**
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド
     * （共通メソッド契約の第10メソッド）。塗り内部は判定しない。
     * 直線では線分(x1, y1)-(x2, y2)を1本判定する。矩形の境界上も交差とみなす。
     * @param {number} minX - 判定矩形の左端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} minY - 判定矩形の上端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @param {number} maxX - 判定矩形の右端X座標（ワールド座標。呼び出し側で正規化済み（minX ≤ maxX））
     * @param {number} maxY - 判定矩形の下端Y座標（ワールド座標。呼び出し側で正規化済み（minY ≤ maxY））
     * @returns {boolean} 輪郭線の一部でも矩形に掛かればtrue
     */
    intersectsRect(minX, minY, maxX, maxY) {
        return segmentIntersectsRect(this.x1, this.y1, this.x2, this.y2, minX, minY, maxX, maxY);
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * vertexIndexが0であれば始点(x1, y1)を、1であれば終点(x2, y2)を更新する。
     * それ以外の値が渡された場合は何もしない。
     * @param {number} vertexIndex - 更新する頂点のインデックス（0: 始点, 1: 終点）
     * @param {number} x - 更新後のX座標（ワールド座標）
     * @param {number} y - 更新後のY座標（ワールド座標）
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
     * @param {number} x - 追従先のX座標（ワールド座標）
     * @param {number} y - 追従先のY座標（ワールド座標）
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
     * @param {number} dx - X方向の移動差分（ワールド座標）
     * @param {number} dy - Y方向の移動差分（ワールド座標）
     */
    translate(dx, dy) {
        this.x1 += dx;
        this.y1 += dy;
        this.x2 += dx;
        this.y2 += dy;
    }

    /**
     * Canvasに直線を描画する。塗るのは`isFillable()`が真で`fillColor`が文字列のときだけ（直線は塗らない）、
     * 線を描くのは`strokeColor`が文字列のときだけ。どちらも偽なら何も呼ばない。
     * 順序は`io/CodeExporter.js`の`DRAW_SOURCE`と同じ（パス → 塗り → 線）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    draw(ctx) {
        const shouldFill = this.isFillable() && typeof this.fillColor === 'string';
        const shouldStroke = typeof this.strokeColor === 'string';
        if (!shouldFill && !shouldStroke) {
            return;
        }

        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);

        if (shouldFill) {
            ctx.fillStyle = this.fillColor;
            ctx.fill();
        }
        // 自身のプロパティとして保持するスタイルを適用
        if (shouldStroke) {
            ctx.strokeStyle = this.strokeColor;
            ctx.lineWidth = this.strokeWidth;
            ctx.stroke();
        }
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

    /**
     * アウトライン表示として、輪郭だけを画面上1pxの細線で描画する（共通メソッド契約の第16メソッド）。
     * 輪郭のパスは`draw`と同じ（始点→終点の線分）。塗らず（`fill`を呼ばない）、図形のスタイル
     * （`strokeColor`・`strokeWidth`・`fillColor`）は読まないため、線なし・塗りなしの図形でも描く。
     * `draw`は変えない（`io/CodeExporter.js`の`DRAW_SOURCE`と手で揃えているため、本メソッドを別に持つ）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。線の太さを画面上1pxに保つために用いる（`lineWidth = 1 / viewScale`）
     * @param {string} color - 輪郭線の色（`strokeStyle`へそのまま渡す）
     */
    drawOutline(ctx, viewScale = 1, color) {
        ctx.beginPath();
        ctx.moveTo(this.x1, this.y1);
        ctx.lineTo(this.x2, this.y2);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / viewScale;
        ctx.stroke();
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第13メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順）: `{ kind: 'polyline', id, points: [始点{x, y}, 終点{x, y}], closed: false, strokeColor, strokeWidth, fillColor }`。
     * `draw`と同じ式（始点→終点の線分）で求め、`id`・`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる（`strokeColor`の`null`も）。
     * `fillColor`は塗れる形のときだけ図形の値、塗れない形（直線）は常に`null`。
     * `points`は新規に組み立てるため、戻り値と自身は配列・頂点を共有しない。
     * @returns {{kind: string, id: *, points: {x: number, y: number}[], closed: boolean, strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい描画要素
     */
    toDrawElement() {
        return {
            kind: 'polyline',
            id: this.id,
            points: [
                { x: this.x1, y: this.y1 },
                { x: this.x2, y: this.y2 },
            ],
            closed: false,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.isFillable() ? this.fillColor : null,
        };
    }

    /**
     * 自身を図形データ（1図形のJSON表現・現行版）へ変換する（共通メソッド契約の第11メソッド）。
     * 形（キー順もこの順）: `{ type: 'line', id, points: [始点{x, y}, 終点{x, y}], strokeColor, strokeWidth, fillColor }`。
     * `fillColor`は塗れない形でも保持している値をそのまま出力する。
     * 座標はワールド座標。`points`は内部表現（x1, y1, x2, y2）から新規に組み立てるため、戻り値と自身は状態を共有しない。
     * `id`が`null`（作成中の図形など）の場合もそのまま出力する。
     * `JSON.stringify(line)`でも本メソッドの戻り値が出力される。
     * @returns {{type: string, id: *, points: {x: number, y: number}[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい図形データ
     */
    toJSON() {
        return {
            type: this.type,
            id: this.id,
            points: [
                { x: this.x1, y: this.y1 },
                { x: this.x2, y: this.y2 },
            ],
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.fillColor,
        };
    }

    /**
     * 図形データ（`toJSON()`の形）から直線を復元する（共通メソッド契約の第12メソッド）。
     * 座標・色・太さ・種別を`data`の値どおりに復元するため、`toJSON()`の出力から復元した図形は
     * 描画・当たり判定・頂点操作・`toJSON()`の結果が元の図形と一致する（往復の一致）。
     * `id`は検証せず`data.id`をそのまま保持する（欠落なら`undefined`）。idの正規化・振り直しは
     * 図形一式を管理する`VectorModel`の責務であり、図形クラスはidの規則を知らないため。
     * `data`内の配列・頂点オブジェクトは流用せず、座標値をコピーした新しい状態を持つ。余分なプロパティは無視する。
     * 例外の捕捉は行わない（呼び出し側の`DocumentSerializer`が図形単位で捕捉する）。
     * @param {Object} data - 図形データ（プレーンオブジェクト）
     * @returns {Line} 復元した直線
     * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`'line'`でない／`points`が2要素の配列でない／
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でも`null`でもない／
     *     `strokeWidth`が`undefined`以外で有限の数値でないか0以下／`fillColor`が`undefined`・文字列・`null`以外の場合
     *     （`strokeWidth`のキーなしは2px、`fillColor`のキーなしは`null`として読む）
     */
    static fromJSON(data) {
        const style = validateShapeData(data, 'Line', ['line'], LINE_POINT_COUNT);
        const [start, end] = data.points;
        const line = new Line(start.x, start.y, end.x, end.y, style.strokeColor, style.strokeWidth, style.fillColor);
        line.id = data.id;
        return line;
    }
}
