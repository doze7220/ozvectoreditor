/**
 * 責務: 矩形（4頂点独立構造）のデータ保持・Canvasへの描画処理・当たり判定、
 * および図形データとの相互変換を担う。
 */

/**
 * 矩形の図形データ（1図形のJSON表現・バージョン1）が持つ頂点数。
 * @type {number}
 */
const RECT_POINT_COUNT = 4;

/**
 * 矩形の図形クラス（図形種別`'rect'`）。頂点は`points[0]`＝topLeft、`[1]`＝topRight、`[2]`＝bottomRight、`[3]`＝bottomLeft（4頂点独立）。
 * 共通メソッド契約（12メソッド：draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON）を自律実装する。座標はすべてワールド座標。
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
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致） */
        this.type = 'rect';
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
            return this.#segmentIntersectsRect(pa.x, pa.y, pb.x, pb.y, minX, minY, maxX, maxY);
        });
    }

    /**
     * 線分（ワールド座標）と軸平行矩形（ワールド座標・正規化済み・境界含む）の交差判定（Liang–Barsky法）。
     * 長さ0の線分は点の内包判定となる（全組でp === 0となり除算しないため0除算は起きない）。
     * 契約メソッドではない内部ヘルパー（同一ロジックをshapes/の各図形クラスが個別に持つ）。
     * @param {number} ax - 線分始点のX座標（ワールド座標）
     * @param {number} ay - 線分始点のY座標（ワールド座標）
     * @param {number} bx - 線分終点のX座標（ワールド座標）
     * @param {number} by - 線分終点のY座標（ワールド座標）
     * @param {number} minX - 矩形の左端X座標（ワールド座標）
     * @param {number} minY - 矩形の上端Y座標（ワールド座標）
     * @param {number} maxX - 矩形の右端X座標（ワールド座標）
     * @param {number} maxY - 矩形の下端Y座標（ワールド座標）
     * @returns {boolean} 線分の一部でも矩形（境界含む）内にあればtrue
     */
    #segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY) {
        const dx = bx - ax;
        const dy = by - ay;
        let t0 = 0;
        let t1 = 1;
        const pairs = [
            [-dx, ax - minX],
            [dx, maxX - ax],
            [-dy, ay - minY],
            [dy, maxY - ay],
        ];

        for (const [p, q] of pairs) {
            if (p === 0) {
                if (q < 0) return false; // 平行かつ外側
                continue; // 除算しない
            }
            const r = q / p;
            if (p < 0) {
                if (r > t1) return false;
                if (r > t0) t0 = r;
            } else {
                if (r < t0) return false;
                if (r < t1) t1 = r;
            }
        }
        return true;
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
     * 自身を図形データ（1図形のJSON表現・バージョン1）へ変換する（共通メソッド契約の第11メソッド）。
     * 形（キー順もこの順）: `{ type: 'rect', id, points: [topLeft{x, y}, topRight{x, y}, bottomRight{x, y}, bottomLeft{x, y}], strokeColor, strokeWidth }`。
     * 座標はワールド座標。`points`は各頂点を新規オブジェクトとして複製するため、戻り値と自身は内部配列・頂点を共有しない。
     * `id`が`null`（作成中の図形など）の場合もそのまま出力する。
     * `JSON.stringify(rect)`でも本メソッドの戻り値が出力される。
     * @returns {{type: string, id: (string|number|null), points: {x: number, y: number}[], strokeColor: string, strokeWidth: number}} 新しい図形データ
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
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でない／
     *     `strokeWidth`が有限の数値でないか0以下の場合
     */
    static fromJSON(data) {
        Rect.#validateData(data);
        const [topLeft, , bottomRight] = data.points;
        const rect = new Rect(topLeft.x, topLeft.y, bottomRight.x, bottomRight.y, data.strokeColor, data.strokeWidth);
        rect.points = data.points.map((point) => ({ x: point.x, y: point.y }));
        rect.id = data.id;
        return rect;
    }

    /**
     * `fromJSON`の入力検証を行う。違反があれば「`Rect.fromJSON: 理由`」形式のメッセージで`Error`をthrowする。
     * `strokeWidth`の0以下を不正とするのは、Canvasが0以下の`lineWidth`代入を無視して直前の値が残り、
     * 描画結果が前に描いた図形に依存してしまうため。
     * 契約メソッドではない内部ヘルパー（同等のロジックをshapes/の各図形クラスが個別に持つ）。
     * @param {*} data - 検証対象の図形データ
     * @throws {Error} 図形データとして不正な場合（条件は`fromJSON`を参照）
     */
    static #validateData(data) {
        const fail = (reason) => {
            throw new Error(`Rect.fromJSON: ${reason}`);
        };
        const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

        if (!isPlainObject(data)) fail('図形データがオブジェクトではありません');
        if (data.type !== 'rect') fail(`図形種別が'rect'ではありません（${String(data.type)}）`);
        if (!Array.isArray(data.points) || data.points.length !== RECT_POINT_COUNT) {
            fail(`pointsが${RECT_POINT_COUNT}要素の配列ではありません`);
        }
        data.points.forEach((point, index) => {
            if (!isPlainObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
                fail(`points[${index}]のx・yが有限の数値ではありません`);
            }
        });
        if (typeof data.strokeColor !== 'string') fail('strokeColorが文字列ではありません');
        if (!Number.isFinite(data.strokeWidth) || data.strokeWidth <= 0) {
            fail('strokeWidthが正の有限の数値ではありません');
        }
    }
}
