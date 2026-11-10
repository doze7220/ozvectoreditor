/**
 * 責務: パス（頂点の並びと閉じているか・区間の並びを持つ折れ線）のデータ保持・Canvasへの描画処理・当たり判定、
 * および図形データとの相互変換と描画要素（スプライトの書き出し用）への変換を担う。
 */

import { distanceToSegment, segmentIntersectsRect } from './ShapeGeometry.js';
import { validateShapeData } from './ShapeDataValidation.js';

/**
 * 開いたパスの頂点数の下限。
 * @type {number}
 */
const OPEN_MIN_POINT_COUNT = 2;

/**
 * 閉じたパスの頂点数の下限。
 * @type {number}
 */
const CLOSED_MIN_POINT_COUNT = 3;

/**
 * 直線の区間の種類。
 * @type {string}
 */
const SEGMENT_KIND_LINE = 'line';

/**
 * 受理する区間の種類の並び（本作業では直線のみ）。曲線の区間を足すときは、この並びと`fromJSON`のエラー文・テストを改める。
 * @type {readonly string[]}
 */
const ACCEPTED_SEGMENT_KINDS = Object.freeze([SEGMENT_KIND_LINE]);

/**
 * 頂点のハンドル名の接頭辞。ハンドル名は`'vertex-<i>'`（`<i>`は頂点の番号の10進表記）。
 * @type {string}
 */
const VERTEX_HANDLE_PREFIX = 'vertex-';

/**
 * 頂点のハンドル名から番号を取り出す正規表現（先頭の0・符号・小数を許さない）。
 * @type {RegExp}
 */
const VERTEX_HANDLE_PATTERN = /^vertex-(0|[1-9][0-9]*)$/;

/**
 * 値がプレーンオブジェクト（`null`・配列を除くオブジェクト）かを判定する。
 * @param {*} value - 判定対象
 * @returns {boolean} プレーンオブジェクトなら`true`
 */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * パスの図形クラス（図形種別`'path'`）。頂点の並び`points`（開いたパス2点以上・閉じたパス3点以上）、
 * 閉じているかを表す`closed`、区間の並び`segments`を持つ。`segments[i]`は`points[i]`→`points[i+1]`の区間で、
 * 閉じたパスの最後の要素は`points[n-1]`→`points[0]`の区間（要素数は開いたパス`n - 1`、閉じたパス`n`）。区間の要素は`{ kind }`で、`kind`は現在`'line'`のみ。
 * 共通メソッド契約（13メソッド：draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement）を自律実装する。座標はすべてワールド座標。
 * パスは`ShapeFactory.create`では作られない（読み込み専用。作る操作はPhase 05-03・05-04）。
 */
export class Path {
    /**
     * 引数は検証しない（検証は`fromJSON`のみ。呼び出し側が頂点数・区間の約束を満たす値を渡す）。
     * `points`の各頂点は新しい`{ x, y }`として複製して保持し、`segments`は区間の数だけ`{ kind: 'line' }`を新しく作る。
     * @param {{x: number, y: number}[]} points - 頂点の並び（始点→終点）
     * @param {boolean} [closed=false] - 閉じているか
     * @param {string} [strokeColor='#000000'] - 線の色
     * @param {number} [strokeWidth=2] - 線の太さ
     */
    constructor(points, closed = false, strokeColor = '#000000', strokeWidth = 2) {
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致） */
        this.type = 'path';
        /** @type {*} 図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）。 */
        this.id = null;
        /** @type {{x: number, y: number}[]} 頂点の並び（始点→終点）。頂点数は可変 */
        this.points = points.map((point) => ({ x: point.x, y: point.y }));
        /** @type {boolean} 閉じているか（`true`なら終点→始点の区間を持つ） */
        this.closed = closed;
        /** @type {{kind: string}[]} 区間の並び。要素数は開いたパス`points.length - 1`、閉じたパス`points.length` */
        this.segments = Array.from(
            { length: closed ? this.points.length : this.points.length - 1 },
            () => ({ kind: SEGMENT_KIND_LINE }),
        );
        /** @type {string} 線の色 */
        this.strokeColor = strokeColor;
        /** @type {number} 線の太さ */
        this.strokeWidth = strokeWidth;
    }

    /**
     * パスの輪郭をCanvasのパスとして組み立てる（`draw`と`drawHover`が共有）。
     * `beginPath` → `moveTo(points[0])` → `lineTo(points[1]…points[n-1])` → `closed`なら`closePath`。
     * 区間の種類（`segments[i].kind`）による分岐の置き場所はここ。本作業の区間はすべて直線のため分岐しない。
     * 曲線の区間を足すときは、ここで`kind`により`lineTo`と曲線の命令を分ける。閉じる区間が曲線の場合は`closePath`だけでは描けないことに注意する。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    #tracePath(ctx) {
        ctx.beginPath();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 1; i < this.points.length; i++) {
            ctx.lineTo(this.points[i].x, this.points[i].y);
        }
        if (this.closed) {
            ctx.closePath();
        }
    }

    /**
     * いずれかの区間で述語が真になるかを返す（`hitTest`・`intersectsRect`が共有）。
     * 区間`i`（`0 ≤ i < 区間の数`。区間の数は閉じたパス`n`、開いたパス`n - 1`）の両端は`points[i]`と`points[(i + 1) % n]`。`draw`と同じ区間を対象にする。
     * @param {(ax: number, ay: number, bx: number, by: number) => boolean} predicate - 区間の両端の座標を受け取る述語
     * @returns {boolean} いずれかの区間で述語が真なら`true`
     */
    #someSegment(predicate) {
        const n = this.points.length;
        const segmentCount = this.closed ? n : n - 1;
        for (let i = 0; i < segmentCount; i++) {
            const a = this.points[i];
            const b = this.points[(i + 1) % n];
            if (predicate(a.x, a.y, b.x, b.y)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Canvasにパスを描画する。`closed`なら終点→始点を`closePath`で結ぶ。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - 将来のモーフィング機能用の予約引数（未使用）
     */
    draw(ctx, t = 0) {
        this.#tracePath(ctx);

        ctx.strokeStyle = this.strokeColor;
        ctx.lineWidth = this.strokeWidth;
        ctx.stroke();
    }

    /**
     * 選択中に全頂点のハンドルを描画する。`Rect`と同一配色（白塗り／青枠）・同一サイズ（画面上で一辺8pxの正方形）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。ハンドルの大きさ・枠線幅を画面上で一定に保つために用いる
     */
    drawHandles(ctx, viewScale = 1) {
        const handleSize = 8 / viewScale;
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
     * ホバー時の強調表示を描画する。`draw`と同じパスに半透明の太線を重ねる。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。強調の上乗せ幅を画面上で一定に保つために用いる
     */
    drawHover(ctx, viewScale = 1) {
        this.#tracePath(ctx);

        ctx.strokeStyle = 'rgba(74, 144, 226, 0.4)';
        ctx.lineWidth = this.strokeWidth + 6 / viewScale;
        ctx.stroke();
    }

    /**
     * 点(x, y)がパスの輪郭の許容誤差(tolerance)以内にあるかを判定する。
     * 全区間（閉じたパスは終点→始点を含む）のいずれかで点-線分距離がtolerance以内ならtrue。`strokeWidth`は許容誤差に足さない。塗り内部は判定しない。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ）
     * @returns {boolean} パスとの距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        return this.#someSegment((ax, ay, bx, by) => distanceToSegment(x, y, ax, ay, bx, by) <= tolerance);
    }

    /**
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用メソッド。
     * 全区間（閉じたパスは終点→始点を含む）のいずれかが交差すればtrue（境界を含む）。塗り内部は判定しない。
     * @param {number} minX - 判定矩形の左端X座標（ワールド座標。正規化済み）
     * @param {number} minY - 判定矩形の上端Y座標（ワールド座標。正規化済み）
     * @param {number} maxX - 判定矩形の右端X座標（ワールド座標。正規化済み）
     * @param {number} maxY - 判定矩形の下端Y座標（ワールド座標。正規化済み）
     * @returns {boolean} 輪郭線の一部でも矩形に掛かればtrue
     */
    intersectsRect(minX, minY, maxX, maxY) {
        return this.#someSegment((ax, ay, bx, by) => segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY));
    }

    /**
     * 点(x, y)がいずれかの頂点のハンドルの許容誤差(tolerance)以内にあるかを判定する。
     * 頂点を番号の小さい順に調べ、最初に該当した頂点のハンドル名`'vertex-<i>'`を返す。`'move'`は返さない（本体のドラッグで移動する）。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ）
     * @returns {string|null} 該当した頂点のハンドル名（`'vertex-<i>'`）。該当なしはnull
     */
    hitTestHandle(x, y, tolerance) {
        for (let i = 0; i < this.points.length; i++) {
            if (Math.hypot(x - this.points[i].x, y - this.points[i].y) <= tolerance) {
                return `${VERTEX_HANDLE_PREFIX}${i}`;
            }
        }
        return null;
    }

    /**
     * ハンドル名（hitTestHandleの戻り値）から対応する頂点インデックスを自己申告する。
     * `'vertex-<i>'`（`<i>`は先頭の0なしの10進表記）で番号が範囲内ならその番号、それ以外はnull。例外を投げない。
     * @param {*} handleName - ハンドル名
     * @returns {number|null} 対応する頂点インデックス。該当なしはnull
     */
    getVertexIndexForHandle(handleName) {
        if (typeof handleName !== 'string') {
            return null;
        }
        const match = VERTEX_HANDLE_PATTERN.exec(handleName);
        if (match === null) {
            return null;
        }
        const index = Number(match[1]);
        return index < this.points.length ? index : null;
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * 0以上`points.length`未満の整数以外（null・文字列・小数・負・範囲外・NaN）は何もしない。
     * @param {number} vertexIndex - 更新する頂点のインデックス
     * @param {number} x - 更新後のX座標（ワールド座標）
     * @param {number} y - 更新後のY座標（ワールド座標）
     */
    setVertex(vertexIndex, x, y) {
        if (Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex < this.points.length) {
            this.points[vertexIndex] = { x, y };
        }
    }

    /**
     * 自身の全頂点を相対差分(dx, dy)だけ平行移動する。
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
     * 作図中にカーソル位置へ追従させる（終点を動かす）。共通メソッド契約のため実装するが、
     * パスは作成中の図形にならないため本サブフェイズでは呼ばれない。
     * @param {number} x - 追従先のX座標（ワールド座標）
     * @param {number} y - 追従先のY座標（ワールド座標）
     */
    updateDraftEnd(x, y) {
        this.setVertex(this.points.length - 1, x, y);
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第13メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 形（キー順もこの順）: `{ kind: 'polyline', id, points: 各頂点{x, y}, closed, strokeColor, strokeWidth }`。
     * 閉じたパスでも頂点は`n`個で始点を重複させない。区間の種類は出さない（区間がすべて直線の間のみ`polyline`で表せる）。
     * `id`・`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる。戻り値と自身は配列・頂点を共有しない。
     * @returns {{kind: string, id: *, points: {x: number, y: number}[], closed: boolean, strokeColor: string, strokeWidth: number}} 新しい描画要素
     */
    toDrawElement() {
        return {
            kind: 'polyline',
            id: this.id,
            points: this.points.map((point) => ({ x: point.x, y: point.y })),
            closed: this.closed,
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
        };
    }

    /**
     * 自身を図形データへ変換する（共通メソッド契約の第11メソッド）。
     * 形（キー順もこの順）: `{ type: 'path', id, points: [{x, y}, ...], closed, segments: [{ kind }, ...], strokeColor, strokeWidth }`。
     * 戻り値と自身は配列・頂点・区間の要素を共有しない。`id`が`null`の場合もそのまま出力する。
     * `JSON.stringify(path)`でも本メソッドの戻り値が出力される。
     * @returns {{type: string, id: *, points: {x: number, y: number}[], closed: boolean, segments: {kind: string}[], strokeColor: string, strokeWidth: number}} 新しい図形データ
     */
    toJSON() {
        return {
            type: this.type,
            id: this.id,
            points: this.points.map((point) => ({ x: point.x, y: point.y })),
            closed: this.closed,
            segments: this.segments.map((segment) => ({ kind: segment.kind })),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
        };
    }

    /**
     * 図形データ（`toJSON()`の形）からパスを復元する（共通メソッド契約の第12メソッド）。
     * 共通項目は`validateShapeData`（頂点数は`{ min: 2 }`）で検証し、その後にパス固有の項目（`closed`・閉じたパスの頂点数・`segments`）を検証する。
     * コンストラクタが`data`の頂点を複製して生成し、`segments`は`data.segments`の`kind`から作り直す。`data`内の配列・オブジェクトは流用しない。
     * `id`は検証せず`data.id`をそのまま保持する。余分なプロパティ（最上位・区間の要素とも）は無視する。
     * 例外の捕捉は行わない（呼び出し側の`DocumentSerializer`が図形単位で捕捉する）。
     * 往復（`toJSON`→`fromJSON`）で図形データの内容と描画・当たり判定の結果が一致する。
     * @param {Object} data - 図形データ（プレーンオブジェクト）
     * @returns {Path} 復元したパス
     * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`'path'`でない／`points`が2要素以上の配列でない／
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でない／`strokeWidth`が有限の数値でないか0以下／
     *     `closed`が真偽値でない／閉じたパスで`points`が3要素未満／`segments`が配列でない／
     *     `segments`の要素数が期待値（開いたパス`n - 1`、閉じたパス`n`）と違う／`segments[i]`がオブジェクトでない／
     *     `segments[i].kind`が受理する種類（`'line'`）でない場合
     */
    static fromJSON(data) {
        validateShapeData(data, 'Path', ['path'], { min: OPEN_MIN_POINT_COUNT });
        const fail = (reason) => {
            throw new Error(`Path.fromJSON: ${reason}`);
        };

        if (typeof data.closed !== 'boolean') fail('closedが真偽値ではありません');
        if (data.closed && data.points.length < CLOSED_MIN_POINT_COUNT) {
            fail(`閉じたパスのpointsが${CLOSED_MIN_POINT_COUNT}要素以上の配列ではありません`);
        }
        if (!Array.isArray(data.segments)) fail('segmentsが配列ではありません');
        const expectedCount = data.closed ? data.points.length : data.points.length - 1;
        if (data.segments.length !== expectedCount) {
            fail(`segmentsが${expectedCount}要素の配列ではありません`);
        }
        data.segments.forEach((segment, index) => {
            if (!isPlainObject(segment)) fail(`segments[${index}]がオブジェクトではありません`);
            if (!ACCEPTED_SEGMENT_KINDS.includes(segment.kind)) {
                const accepted = ACCEPTED_SEGMENT_KINDS.map((kind) => `'${kind}'`).join('・');
                fail(`segments[${index}]のkindが${accepted}ではありません（${String(segment.kind)}）`);
            }
        });

        const path = new Path(data.points, data.closed, data.strokeColor, data.strokeWidth);
        path.segments = data.segments.map((segment) => ({ kind: segment.kind }));
        path.id = data.id;
        return path;
    }
}
