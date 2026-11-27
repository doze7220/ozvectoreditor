/**
 * 責務: パス（頂点の並びと閉じているか・区間の並び・角の点を持つ、直線の区間・点を通るなめらかな曲線の区間・
 * 曲がり方を持つ曲線の区間（引っ張る点を区間に持つ3次ベジェ）からなる線）のデータ保持・Canvasへの描画処理・当たり判定、および図形データとの相互変換・描画要素（スプライトの書き出し用）への変換・変形を当てた新しい図形の生成を担う。
 */

import {
    applyAffineTransformToPoint,
    computeSmoothSegmentControls,
    cubicBezierPoint,
    distanceToSegment,
    isPointInPolygonEvenOdd,
    isPointInPolygonNonzero,
    segmentIntersectsRect,
} from './ShapeGeometry.js';
import { validateShapeData, isPlainObject } from './ShapeDataValidation.js';

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
 * 直線の区間の種類（唯一の定義箇所。`PathJoinRules`・`ShapeFactory`もimportする）。
 * @type {string}
 */
export const SEGMENT_KIND_LINE = 'line';

/**
 * 曲線の区間（両端の頂点と前後の頂点から形が決まる、点を通るなめらかな曲線）の種類（唯一の定義箇所）。
 * @type {string}
 */
export const SEGMENT_KIND_SMOOTH = 'smooth';

/**
 * 曲がり方を持つ区間（区間ごとに3次ベジェの2つの制御点＝引っ張る点を持ち、形が両端の頂点と引っ張る点で決まる曲線）の種類（唯一の定義箇所）。
 * 作業データの語彙で、書き出しの描画要素の`'cubic'`とは別の語。
 * @type {string}
 */
export const SEGMENT_KIND_BEZIER = 'bezier';

/**
 * 曲線の区間（打った点の曲線の区間・曲がり方を持つ区間）1つを折れ線で近似するときの分割数。当たり判定・範囲選択・塗りの内側が共有する唯一の定義。
 * 使う側は`Path`自身と`PathVertexRules`（区間の上の最も近い位置の距離を`hitTest`と同じ測り方にするため）。
 * @type {number}
 */
export const SMOOTH_SEGMENT_SAMPLE_COUNT = 100;

/**
 * 受理する区間の種類の並び（直線・打った点の曲線・曲がり方を持つ区間）。並びの定義の唯一の箇所。
 * `fromJSON`のエラー文はこの並びから`SEGMENT_KIND_BEZIER`を除いたもの（`'line'・'smooth'`）で作る
 * （既存のテストの文面の完全一致を保つため。文面の並びを別の定数にしない）。
 * @type {readonly string[]}
 */
const ACCEPTED_SEGMENT_KINDS = Object.freeze([SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_BEZIER]);

/**
 * 区間の指定。文字列なら区間の種類（`'line'`か`'smooth'`。`'bezier'`は引っ張る点が無いため渡してはならない）、
 * オブジェクトなら区間の値（`toJSON()`の`segments`の要素の形）。`kind`が`'bezier'`の区間の値は`control1`・`control2`を持つこと
 * （呼び出し側の責任。検証しない）。
 * @typedef {string|{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}} SegmentSpec
 */

/**
 * 区間の指定から区間の値の新しい写しを作る唯一の箇所（コンストラクタ・`toJSON`・`fromJSON`が使う）。
 * 文字列なら`{ kind }`、`kind`が`'bezier'`なら`{ kind, control1, control2 }`（座標は新しいオブジェクト）、
 * それ以外は`{ kind }`だけ（余分なキーは捨てる）。引数は書き換えず、結果は引数と何も共有しない。
 * @param {SegmentSpec} spec - 区間の指定
 * @returns {{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}} 新しい区間の値
 */
function copySegment(spec) {
    if (typeof spec === 'string') {
        return { kind: spec };
    }
    if (spec.kind === SEGMENT_KIND_BEZIER) {
        return {
            kind: spec.kind,
            control1: { x: spec.control1.x, y: spec.control1.y },
            control2: { x: spec.control2.x, y: spec.control2.y },
        };
    }
    return { kind: spec.kind };
}

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
 * 図形データ（`toJSON()`の値または検証済みの図形データ）から、頂点ごとの「角の点か」の真偽値の配列を新しく作る。
 * 「`corners`のキーが無ければすべてなめらか」という読み方の唯一の箇所。`points`を持つ直線の`toJSON()`の値にも使える（すべて`false`）。
 * @param {{points: Array, corners?: boolean[]}} data - 図形データ
 * @returns {boolean[]} 頂点と同じ要素数の新しい配列（`corners[i] === true`の要素だけ`true`）
 */
export function readCornerFlags(data) {
    return Array.from({ length: data.points.length }, (_, i) => Array.isArray(data.corners) && data.corners[i] === true);
}

/**
 * 区間ごとの曲線の制御点を求める（曲線の区間・曲がり方を持つ区間は`{ control1, control2 }`、直線の区間は`null`）。
 * 区間の種類による制御点の分岐の唯一の箇所（`Path`の描画・当たり判定・範囲選択・塗りの内側・書き出しと`PathVertexRules`が共有）。
 * 角の点（`corners`）は`readCornerFlags(data)`で読み、`computeSmoothSegmentControls`の第4引数へ渡す（両側とも打った点の曲線の区間の角の点で連なりが切れる）。
 * 曲がり方を持つ区間は`computeSmoothSegmentControls`へは打った点の曲線の区間として渡さず（偽）、結果のその区間を区間の値の引っ張る点（新しい写し）に置き換える。
 * 引数を書き換えず、結果は引数と何も共有しない。
 * @param {{points: Array<{x: number, y: number}>, closed?: boolean, segments: Array<{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}>, corners?: boolean[]}} data - `Path`のインスタンスか`toJSON()`の値
 * @returns {Array<{control1: {x: number, y: number}, control2: {x: number, y: number}}|null>} 区間ごとの制御点
 */
export function resolveSegmentControls(data) {
    const controls = computeSmoothSegmentControls(
        data.points,
        data.segments.map((segment) => segment.kind === SEGMENT_KIND_SMOOTH),
        data.closed === true,
        readCornerFlags(data),
    );
    return controls.map((control, i) => {
        const segment = data.segments[i];
        if (segment.kind !== SEGMENT_KIND_BEZIER) {
            return control;
        }
        return {
            control1: { x: segment.control1.x, y: segment.control1.y },
            control2: { x: segment.control2.x, y: segment.control2.y },
        };
    });
}

/**
 * パスの図形クラス（図形種別`'path'`）。頂点の並び`points`（開いたパス2点以上・閉じたパス3点以上）、
 * 閉じているかを表す`closed`、区間の並び`segments`を持つ。`segments[i]`は`points[i]`→`points[i+1]`の区間で、
 * 閉じたパスの最後の要素は`points[n-1]`→`points[0]`の区間（要素数は開いたパス`n - 1`、閉じたパス`n`）。区間の種類は3つ：
 * `{ kind: 'line' }`（直線の区間）・`{ kind: 'smooth' }`（打った点の曲線の区間）・`{ kind: 'bezier', control1, control2 }`（曲がり方を持つ区間）。
 * 打った点の曲線の区間の形は両端の頂点と前後の頂点から`computeSmoothSegmentControls`で決まり、制御点は作業データにも図形にも持たない（描くたび・判定するたびに求める）。
 * 曲がり方を持つ区間は引っ張る点`control1`（始点側）・`control2`（終点側）をワールド座標の絶対座標で区間に持ち、形は両端の頂点と引っ張る点の3次ベジェで決まる。
 * 引っ張る点は頂点ではない（ハンドルにならない。`getVertexHandleNames`・`hitTestHandle`は`points`だけを扱う）。
 * 曲がり方を持つ区間とのつなぎ目は常に角（隣の打った点の曲線の区間は、隣を打った点の曲線の区間として数えず仮の点を使う）。
 * 頂点を動かす（`setVertex`）と、その頂点につながる曲がり方を持つ区間の、その頂点の側の引っ張る点が同じだけついていく（反対側は動かない）。`translate`は引っ張る点もすべて動かす。
 * 区間ごとに種類を指定して作るのは、コンストラクタへ区間の指定の配列を渡す場合（`PathJoinRules`の結合・描き足し・閉じる。結果は元の区間を保つ）と`fromJSON`（`segments`を作り直す）。
 * 角の点：公開プロパティ`corners`（頂点と同じ並びの真偽値の配列）で、曲線の連なりの途中の点を、なめらかにつなぐか角を立てるかを点ごとに持つ。
 * 角が形に効くのは両側とも曲線の区間の点だけ（直線の区間との境目・開いたパスの端はもともと角）。図形データでは角の点が1つ以上あるときだけ`corners`を`segments`の直後に出す。
 * 共通メソッド契約（20メソッド：draw・drawHover・hitTest・hitTestHandle・setVertex・translate・
 * updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement・isFillable・hitTestFill・drawOutline・getHandlePosition・getVertexHandleNames・createTransformed・appendOutline・isInsideOutline）を自律実装する。座標はすべてワールド座標。
 * パスは`ShapeFactory.create`の曲線のツールの描き始めでも作られる（頂点2つ・区間1つの曲線）。
 * 直線・曲線のツールで続けて引く線（点が3つ以上）も`PathJoinRules`が作り、作成途中の図形にもなる。
 */
export class Path {
    /**
     * 引数は検証しない（検証は`fromJSON`のみ。呼び出し側が頂点数・区間の約束を満たす値を渡す）。
     * `points`の各頂点は新しい`{ x, y }`として複製して保持し、`segments`は区間の数だけ区間の値を新しく作る。
     * `segmentKind`が文字列なら全区間をその種類で作る。配列なら区間ごとの区間の指定（`SegmentSpec`）の並びとして`copySegment`で写して作り、渡された配列・要素・座標は保持しない（要素数・種類も検証しない）。
     * 区間ごとに指定して作るのは、配列を渡す場合（`PathJoinRules`の結合・描き足し・閉じる）と`fromJSON`（`segments`を作り直す）。
     * @param {{x: number, y: number}[]} points - 頂点の並び（始点→終点）
     * @param {boolean} [closed=false] - 閉じているか
     * @param {string|null} [strokeColor='#000000'] - 線の色。nullは線なし
     * @param {number} [strokeWidth=2] - 線の太さ
     * @param {string|null} [fillColor=null] - 塗りの色。nullは塗りなし
     * @param {string|SegmentSpec[]} [segmentKind='line'] - 文字列なら全区間の種類（`'line'`か`'smooth'`。引っ張る点が無いため`'bezier'`は渡さない）。省くと全区間が直線。
     *   配列なら区間ごとの区間の指定（`SegmentSpec`）の並び（要素数は開いたパス`points.length - 1`・閉じたパス`points.length`であること。呼び出し側の責任で、検証しない）
     * @param {boolean[]} [corners=[]] - 頂点ごとの「角の点か」。保持せず写す（`true`以外は`false`、要素数は常に`points`にそろえる。検証しない）
     */
    constructor(points, closed = false, strokeColor = '#000000', strokeWidth = 2, fillColor = null, segmentKind = SEGMENT_KIND_LINE, corners = []) {
        /** @type {string} 図形種別（`ShapeFactory`が受理する文字列と一致） */
        this.type = 'path';
        /** @type {*} 図形の一意なID。作成中は`null`。`VectorModel`の採番・正規化の後は文字列。`fromJSON`直後は`data.id`のまま（欠落なら`undefined`、任意の型を取り得る）。 */
        this.id = null;
        /** @type {{x: number, y: number}[]} 頂点の並び（始点→終点）。頂点数は可変 */
        this.points = points.map((point) => ({ x: point.x, y: point.y }));
        /** @type {boolean} 閉じているか（`true`なら終点→始点の区間を持つ） */
        this.closed = closed;
        /** @type {{kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}[]} 区間の並び（`'bezier'`の区間だけ引っ張る点`control1`・`control2`を持つ）。要素数は開いたパス`points.length - 1`、閉じたパス`points.length` */
        this.segments = Array.isArray(segmentKind)
            ? segmentKind.map(copySegment)
            : Array.from(
                { length: closed ? this.points.length : this.points.length - 1 },
                () => ({ kind: segmentKind }),
            );
        /** @type {boolean[]} 頂点と同じ並びの「角の点か」。常に`points`と同じ要素数（初めはすべて`false`）。角が効くのは両側とも曲線の区間の点だけ */
        this.corners = this.points.map((_, i) => Array.isArray(corners) && corners[i] === true);
        /** @type {string|null} 線の色。nullは線なし */
        this.strokeColor = strokeColor;
        /** @type {number} 線の太さ */
        this.strokeWidth = strokeWidth;
        /** @type {string|null} 塗りの色。nullは塗りなし。塗れない形でも保持する（描かないだけ） */
        this.fillColor = fillColor;
    }

    /**
     * 塗れる形か（共通メソッド契約の第13メソッド）。閉じたパスのみ`true`。データには保存しない。
     * @returns {boolean} 閉じたパスなら`true`
     */
    isFillable() {
        return this.closed === true;
    }

    /**
     * 区間ごとの曲線の制御点を求める（`#tracePath`・`#someSegment`・`#fillPolygon`・`toDrawElement`が共有）。
     * 中身は区間の種類による分岐の唯一の箇所の`resolveSegmentControls`（自身を渡すだけ）。
     * @returns {Array<{control1: {x: number, y: number}, control2: {x: number, y: number}}|null>} 区間ごとの制御点
     */
    #segmentControls() {
        return resolveSegmentControls(this);
    }

    /**
     * パスの輪郭をCanvasのパスとして組み立てる（`draw`・`drawHover`・`drawOutline`が共有）。
     * `beginPath` → `#traceSubpath`（輪郭の命令）。命令の並びは従来のまま変わらない。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     */
    #tracePath(ctx) {
        ctx.beginPath();
        this.#traceSubpath(ctx);
    }

    /**
     * パスの輪郭を、`beginPath`を呼ばずに今のパスへ新しいサブパスとして足す（`#tracePath`・`appendOutline`が共有）。
     * `moveTo(points[0])` → 区間`i`ごとに終点`points[(i+1) % n]`へ、
     * 曲線の区間（打った点の曲線の区間・曲がり方を持つ区間）なら`bezierCurveTo`、直線の区間なら`lineTo` → `closed`なら`closePath`。
     * ただし閉じたパスの閉じる区間（最後の区間）が直線なら`lineTo`を呼ばず`closePath`で結ぶ。閉じる区間が曲線ならその曲線を描いてから`closePath`。
     * 区間がすべて直線のパスの命令は`lineTo`（i=1…n-1）→`closePath`のまま。
     * @param {CanvasRenderingContext2D} ctx - 輪郭を足す先の2Dコンテキスト
     */
    #traceSubpath(ctx) {
        const n = this.points.length;
        const controls = this.#segmentControls();
        ctx.moveTo(this.points[0].x, this.points[0].y);
        for (let i = 0; i < controls.length; i++) {
            const b = this.points[(i + 1) % n];
            const control = controls[i];
            if (control !== null) {
                ctx.bezierCurveTo(control.control1.x, control.control1.y, control.control2.x, control.control2.y, b.x, b.y);
            } else if (!(this.closed && i === n - 1)) {
                ctx.lineTo(b.x, b.y);
            }
        }
        if (this.closed) {
            ctx.closePath();
        }
    }

    /**
     * いずれかの区間で述語が真になるかを返す（`hitTest`・`intersectsRect`が共有）。
     * 区間`i`（`0 ≤ i < 区間の数`。区間の数は閉じたパス`n`、開いたパス`n - 1`）の両端は`points[i]`と`points[(i + 1) % n]`。`draw`と同じ区間を対象にする。
     * 直線の区間は両端で述語を1回呼ぶ。曲線の区間（曲がり方を持つ区間を含む）は`SMOOTH_SEGMENT_SAMPLE_COUNT`個の小区間（折れ線の近似。最後の点は終点そのもの）について順に述語を呼ぶ。
     * @param {(ax: number, ay: number, bx: number, by: number) => boolean} predicate - 区間（または曲線の小区間）の両端の座標を受け取る述語
     * @returns {boolean} いずれかの区間で述語が真なら`true`
     */
    #someSegment(predicate) {
        const n = this.points.length;
        const controls = this.#segmentControls();
        for (let i = 0; i < controls.length; i++) {
            const a = this.points[i];
            const b = this.points[(i + 1) % n];
            const control = controls[i];
            if (control === null) {
                if (predicate(a.x, a.y, b.x, b.y)) {
                    return true;
                }
                continue;
            }
            let prev = a;
            for (let k = 1; k <= SMOOTH_SEGMENT_SAMPLE_COUNT; k++) {
                const next = k === SMOOTH_SEGMENT_SAMPLE_COUNT
                    ? b
                    : cubicBezierPoint(a, control.control1, control.control2, b, k / SMOOTH_SEGMENT_SAMPLE_COUNT);
                if (predicate(prev.x, prev.y, next.x, next.y)) {
                    return true;
                }
                prev = next;
            }
        }
        return false;
    }

    /**
     * 塗りの内側の判定に使う頂点の並びを作る。区間ごとに始点の頂点を並べ、曲線の区間（曲がり方を持つ区間を含む）ならその後に近似点（`k = 1…N-1`）を足す
     * （閉じる区間の近似点は末尾）。区間がすべて直線なら`points`と同じ並び。
     * 開いたパスだけは、区間の始点の頂点が最後の頂点を含まないため、末尾に最後の頂点`points[n-1]`を足す
     * （`isInsideOutline`が始点と終点を結んだ形を判定するため。閉じたパスの並びは変わらない。
     * `hitTestFill`は開いたパスで先に偽を返すため、この追加で`hitTestFill`の結果は変わらない）。
     * @returns {{x: number, y: number}[]} 多角形の頂点の並び
     */
    #fillPolygon() {
        const controls = this.#segmentControls();
        const n = this.points.length;
        const polygon = [];
        for (let i = 0; i < controls.length; i++) {
            const a = this.points[i];
            polygon.push(a);
            const control = controls[i];
            if (control !== null) {
                const b = this.points[(i + 1) % n];
                for (let k = 1; k < SMOOTH_SEGMENT_SAMPLE_COUNT; k++) {
                    polygon.push(cubicBezierPoint(a, control.control1, control.control2, b, k / SMOOTH_SEGMENT_SAMPLE_COUNT));
                }
            }
        }
        if (!this.closed) {
            polygon.push(this.points[n - 1]);
        }
        return polygon;
    }

    /**
     * Canvasにパスを描画する。曲線の区間は曲線で描き、`closed`なら終点→始点を結ぶ（閉じる区間が直線なら`closePath`）。
     * 塗る（`isFillable()`かつ`fillColor`が文字列）・線を描く（`strokeColor`が文字列）のどちらも偽なら何も呼ばない。
     * 順序は パス → 塗り（`fillStyle`→`fill()`引数なし） → 線（`strokeStyle`→`lineWidth`→`stroke()`）。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [t=0] - 将来のモーフィング機能用の予約引数（未使用）
     */
    draw(ctx, t = 0) {
        const shouldFill = this.isFillable() && typeof this.fillColor === 'string';
        const shouldStroke = typeof this.strokeColor === 'string';
        if (!shouldFill && !shouldStroke) {
            return;
        }

        this.#tracePath(ctx);

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
     * アウトライン表示用に、`draw`と同じパスを細い1色の線だけで描画する（共通メソッド契約の第15メソッド）。
     * `fill`を呼ばず、`strokeColor`・`strokeWidth`・`fillColor`を読まない（線なし・塗りなしの図形でも輪郭を描く）。
     * 順序は パス（閉じたパスは`closePath`を含む） → `strokeStyle` → `lineWidth` → `stroke()`。
     * @param {CanvasRenderingContext2D} ctx - 描画対象の2Dコンテキスト
     * @param {number} [viewScale=1] - 現在の表示倍率。線の太さを画面上で1pxに保つために用いる（`lineWidth = 1 / viewScale`）
     * @param {string} color - 輪郭の線の色
     */
    drawOutline(ctx, viewScale = 1, color) {
        this.#tracePath(ctx);

        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / viewScale;
        ctx.stroke();
    }

    /**
     * 点(x, y)がパスの輪郭の許容誤差(tolerance)以内にあるかを判定する。
     * 全区間（閉じたパスは終点→始点を含む。曲線の区間は折れ線の近似）のいずれかで点-線分距離がtolerance以内ならtrue。`strokeWidth`は許容誤差に足さない。塗り内部は判定しない。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @param {number} tolerance - 許容誤差（ワールド座標の長さ）
     * @returns {boolean} パスとの距離がtolerance以内であればtrue
     */
    hitTest(x, y, tolerance) {
        return this.#someSegment((ax, ay, bx, by) => distanceToSegment(x, y, ax, ay, bx, by) <= tolerance);
    }

    /**
     * 点(x, y)が塗られたパスの内側にあるかを判定する（共通メソッド契約の第14メソッド）。許容誤差は使わない。
     * 塗られている（`draw`が塗りを描く条件と同じ`isFillable()`かつ`fillColor`が文字列）ときだけ内側を判定し、塗られていなければ常に`false`
     * （開いたパスは`fillColor`が文字列でも`false`）。
     * 内側は、`#fillPolygon`の頂点の並び（区間がすべて直線なら`points`と同じ。曲線の区間は折れ線で近似）の多角形を
     * nonzero（Canvasの`fill()`引数なしと同じ規則）で判定する。自己交差の中心は内側、逆向きの穴は外側。
     * 境界（輪郭線の中心線）上の点は内側に含めない（輪郭の当たり`hitTest`が受け持つ）。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @returns {boolean} 塗られたパスの内側（境界を除く）であれば`true`
     */
    hitTestFill(x, y) {
        if (!this.isFillable() || typeof this.fillColor !== 'string') {
            return false;
        }
        return isPointInPolygonNonzero(x, y, this.#fillPolygon());
    }

    /**
     * 自分の輪郭を、呼び出し側が`beginPath`した今のパスへ新しいサブパスとして足す（共通メソッド契約の第19メソッド）。
     * `beginPath`は呼ばない。命令は`draw`のパスの部分と同じ（`#traceSubpath`。閉じたパスは`closePath`で終わり、開いたパスは閉じない）。
     * 塗り・線・スタイルは呼ばない・読まない。
     * @param {CanvasRenderingContext2D} ctx - 輪郭を足す先の2Dコンテキスト
     */
    appendOutline(ctx) {
        this.#traceSubpath(ctx);
    }

    /**
     * 点(x, y)が自分の輪郭（開いたパスは始点と終点を結んで閉じたもの）の内側にあるかを`evenodd`で判定する（共通メソッド契約の第20メソッド）。
     * `#fillPolygon`の頂点の並び（開いたパスは末尾に最後の頂点を足したもの）の多角形の交差の数の偶奇で判定する。
     * スタイル・`isFillable()`は読まない。境界の上は`false`。
     * @param {number} x - 判定対象点のX座標（ワールド座標）
     * @param {number} y - 判定対象点のY座標（ワールド座標）
     * @returns {boolean} 輪郭の内側（境界を除く）なら`true`
     */
    isInsideOutline(x, y) {
        return isPointInPolygonEvenOdd(x, y, this.#fillPolygon());
    }

    /**
     * 選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用メソッド。
     * 全区間（閉じたパスは終点→始点を含む。曲線の区間は折れ線の近似）のいずれかが交差すればtrue（境界を含む）。塗り内部は判定しない。
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
     * ハンドル名（`hitTestHandle`の戻り値）から、そのハンドルの位置を返す（共通メソッド契約の第16メソッド）。
     * 位置は`hitTestHandle`と同じ頂点の写し（`getVertexIndexForHandle`で得た番号の`points[番号]`）。
     * 番号が範囲内の整数であることを確かめてから写し、ハンドル名でない値（`null`・`undefined`・未知の文字列・文字列以外・
     * `'move'`・範囲外の番号・`Object.prototype`のキー名）は例外にせず`null`を返す。
     * 戻り値は新しいオブジェクトで、書き換えても自身は変わらない。
     * @param {*} handleName - ハンドル名（`'vertex-<i>'`、`<i>`は範囲内の頂点の番号）。任意の値を受け、これ以外は`null`を返す
     * @returns {{x: number, y: number}|null} ハンドルの位置（ワールド座標）。該当なしはnull
     */
    getHandlePosition(handleName) {
        const index = this.getVertexIndexForHandle(handleName);
        if (!Number.isInteger(index) || index < 0 || index >= this.points.length) {
            return null;
        }
        return { x: this.points[index].x, y: this.points[index].y };
    }

    /**
     * 頂点として扱えるハンドル名の一覧を返す（共通メソッド契約の第17メソッド）。
     * `points`の頂点の数だけ`'vertex-<i>'`（頂点が0個なら空配列）。
     * 並びは`getVertexIndexForHandle`が返す頂点の番号の昇順。一覧の各名前は`hitTestHandle`が返しうる名前で、
     * `getVertexIndexForHandle`が番号を、`getHandlePosition`が位置を返す。
     * 戻り値は毎回新しい配列で、書き換えても自身は変わらない。
     * @returns {string[]} 頂点のハンドル名の配列
     */
    getVertexHandleNames() {
        return Array.from({ length: this.points.length }, (_, i) => `${VERTEX_HANDLE_PREFIX}${i}`);
    }

    /**
     * 指定した頂点インデックスの座標を絶対座標で更新する。
     * 0以上`points.length`未満の整数以外（null・文字列・小数・負・範囲外・NaN）は何もしない。
     * 動かした差分だけ、その頂点につながる曲がり方を持つ区間の、その頂点の側の引っ張る点もついていく（`#shiftControlsAt`）。
     * @param {number} vertexIndex - 更新する頂点のインデックス
     * @param {number} x - 更新後のX座標（ワールド座標）
     * @param {number} y - 更新後のY座標（ワールド座標）
     */
    setVertex(vertexIndex, x, y) {
        if (Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex < this.points.length) {
            const dx = x - this.points[vertexIndex].x;
            const dy = y - this.points[vertexIndex].y;
            this.points[vertexIndex] = { x, y };
            this.#shiftControlsAt(vertexIndex, dx, dy);
        }
    }

    /**
     * 頂点を動かしたとき、その頂点につながる曲がり方を持つ区間の引っ張る点を同じだけ動かす（`setVertex`が呼ぶ。反対側の引っ張る点は動かさない）。
     * その頂点を始点とする区間（番号`vertexIndex`。区間の数未満のとき）が`'bezier'`なら`control1`、
     * その頂点を終点とする区間（開いたパスは`vertexIndex - 1`で0以上のとき、閉じたパスは`(vertexIndex - 1 + n) % n`）が`'bezier'`なら`control2`を、`(dx, dy)`だけ動かした新しい`{ x, y }`で置き換える。
     * @param {number} vertexIndex - 動かした頂点のインデックス（範囲内の整数）
     * @param {number} dx - X方向の移動差分（ワールド座標）
     * @param {number} dy - Y方向の移動差分（ワールド座標）
     */
    #shiftControlsAt(vertexIndex, dx, dy) {
        const startSegment = this.segments[vertexIndex];
        if (vertexIndex < this.segments.length && startSegment.kind === SEGMENT_KIND_BEZIER) {
            startSegment.control1 = { x: startSegment.control1.x + dx, y: startSegment.control1.y + dy };
        }
        const n = this.points.length;
        const endIndex = this.closed ? (vertexIndex - 1 + n) % n : vertexIndex - 1;
        if (endIndex >= 0 && endIndex < this.segments.length) {
            const endSegment = this.segments[endIndex];
            if (endSegment.kind === SEGMENT_KIND_BEZIER) {
                endSegment.control2 = { x: endSegment.control2.x + dx, y: endSegment.control2.y + dy };
            }
        }
    }

    /**
     * 自身の全頂点と、曲がり方を持つ区間の引っ張る点を相対差分(dx, dy)だけ平行移動する。
     * @param {number} dx - X方向の移動差分（ワールド座標）
     * @param {number} dy - Y方向の移動差分（ワールド座標）
     */
    translate(dx, dy) {
        this.points.forEach((point) => {
            point.x += dx;
            point.y += dy;
        });
        this.segments.forEach((segment) => {
            if (segment.kind === SEGMENT_KIND_BEZIER) {
                segment.control1 = { x: segment.control1.x + dx, y: segment.control1.y + dy };
                segment.control2 = { x: segment.control2.x + dx, y: segment.control2.y + dy };
            }
        });
    }

    /**
     * 作図中にカーソル位置へ追従させる。直線・曲線のツールで続けて引く作成途中の線（開いたパス）の
     * 付いてくる線の先（最後の頂点）を動かす。呼ぶのは`VectorModel.updateDraft`。
     * @param {number} x - 追従先のX座標（ワールド座標）
     * @param {number} y - 追従先のY座標（ワールド座標）
     */
    updateDraftEnd(x, y) {
        this.setVertex(this.points.length - 1, x, y);
    }

    /**
     * 自身をスプライトの描画要素へ変換する（共通メソッド契約の第12メソッド。呼び出し元は`SpriteSerializer`のみ）。
     * 区間がすべて直線なら`polyline`、曲線の区間（曲がり方を持つ区間を含む）を1つ以上持つなら`bezierPath`（曲がり方を持つ区間の`cubic`の制御点は引っ張る点）。
     * `polyline`の形（キー順もこの順）: `{ kind: 'polyline', points: 各頂点{x, y}, closed, strokeColor, strokeWidth, fillColor }`。
     * `bezierPath`の形（キー順もこの順）: `{ kind: 'bezierPath', points: 各頂点{x, y}, closed, segments, strokeColor, strokeWidth, fillColor }`。
     * `segments[i]`は`points[i]`→`points[(i+1) % n]`の区間で、直線は`{ kind: 'line' }`、曲線の区間は`{ kind: 'cubic', control1: {x, y}, control2: {x, y} }`
     * （3次ベジェの制御点。描画要素の区間の語は作業データの`'smooth'`とは別の`'cubic'`）。
     * 閉じたパスでも頂点は`n`個で始点を重複させない。
     * `strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる。`fillColor`は塗れる形（閉じたパス）なら図形の値、塗れない形（開いたパス）なら`null`。戻り値と自身は配列・頂点を共有しない。
     * @returns {{kind: string, points: {x: number, y: number}[], closed: boolean, segments?: Object[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい描画要素
     */
    toDrawElement() {
        const points = this.points.map((point) => ({ x: point.x, y: point.y }));
        const fillColor = this.isFillable() ? this.fillColor : null;
        const controls = this.#segmentControls();
        if (controls.every((control) => control === null)) {
            return {
                kind: 'polyline',
                points,
                closed: this.closed,
                strokeColor: this.strokeColor,
                strokeWidth: this.strokeWidth,
                fillColor,
            };
        }
        return {
            kind: 'bezierPath',
            points,
            closed: this.closed,
            segments: controls.map((control) => (control === null
                ? { kind: 'line' }
                : {
                    kind: 'cubic',
                    control1: { x: control.control1.x, y: control.control1.y },
                    control2: { x: control.control2.x, y: control.control2.y },
                })),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor,
        };
    }

    /**
     * 自身を図形データへ変換する（共通メソッド契約の第10メソッド）。
     * 形（キー順もこの順）: `{ type: 'path', id, points: [{x, y}, ...], closed, segments: [{ kind }, ...], strokeColor, strokeWidth, fillColor }`。
     * `segments`の要素は`'line'`・`'smooth'`なら`{ kind }`、`'bezier'`なら`{ kind, control1: {x, y}, control2: {x, y} }`（絶対座標の引っ張る点）。
     * `fillColor`は塗れない形でも保持している値をそのまま出力する。
     * 角の点が1つ以上あるときだけ、`segments`の直後・`strokeColor`の前に`corners`（頂点と同じ並びの真偽値の配列。新しい配列）を出す。角の点が1つもなければキーを出さない（今までと同じ）。
     * 戻り値と自身は配列・頂点・区間の要素を共有しない。`id`が`null`の場合もそのまま出力する。
     * `JSON.stringify(path)`でも本メソッドの戻り値が出力される。
     * @returns {{type: string, id: *, points: {x: number, y: number}[], closed: boolean, segments: {kind: string, control1?: {x: number, y: number}, control2?: {x: number, y: number}}[], corners?: boolean[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 新しい図形データ
     */
    toJSON() {
        return {
            type: this.type,
            id: this.id,
            points: this.points.map((point) => ({ x: point.x, y: point.y })),
            closed: this.closed,
            segments: this.segments.map(copySegment),
            ...(this.corners.some((corner) => corner === true) ? { corners: this.corners.slice() } : {}),
            strokeColor: this.strokeColor,
            strokeWidth: this.strokeWidth,
            fillColor: this.fillColor,
        };
    }

    /**
     * 図形データ（`toJSON()`の形）からパスを復元する（共通メソッド契約の第11メソッド）。
     * 共通項目は`validateShapeData`（頂点数は`{ min: 2 }`。戻り値は既定値を解決した`{ strokeColor, strokeWidth, fillColor }`）で検証し、その後にパス固有の項目（`closed`・閉じたパスの頂点数・`segments`）を検証する。
     * コンストラクタが`data`の頂点を複製して生成し、`segments`は`data.segments`の区間（`'line'`・`'smooth'`・`'bezier'`。混ざってよい。`'bezier'`は引っ張る点も写す）から`copySegment`で作り直す。`data`内の配列・オブジェクトは流用しない。
     * `id`は検証せず`data.id`をそのまま保持する。余分なプロパティ（最上位・区間の要素とも）は無視する。
     * 例外の捕捉は行わない（呼び出し側の`DocumentSerializer`が図形単位で捕捉する）。
     * 往復（`toJSON`→`fromJSON`）で図形データの内容と描画・当たり判定の結果が一致する。
     * @param {Object} data - 図形データ（プレーンオブジェクト）
     * @returns {Path} 復元したパス
     * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`'path'`でない／`points`が2要素以上の配列でない／
     *     頂点がオブジェクトでないか`x`・`y`が有限の数値でない／`strokeColor`が文字列でもnullでもない／`strokeWidth`が`undefined`以外で有限の数値でないか0以下／
     *     `fillColor`が`undefined`以外で文字列でもnullでもない／`closed`が真偽値でない／閉じたパスで`points`が3要素未満／`segments`が配列でない／
     *     `segments`の要素数が期待値（開いたパス`n - 1`、閉じたパス`n`）と違う／`segments[i]`がオブジェクトでない／
     *     `segments[i].kind`が受理する種類（`'line'`・`'smooth'`・`'bezier'`。エラー文は既存の文面を保つため`'line'・'smooth'`だけを並べる）でない／
     *     `kind`が`'bezier'`の`segments[i]`の`control1`・`control2`がx・yを有限の数値で持つオブジェクトでない／
     *     `corners`が`undefined`以外で配列でない（`null`を含む）／`corners`の要素数が`points`の要素数と違う／`corners[i]`が真偽値でない場合
     *     （`corners`の検査は`segments`の検査の後）。キーが無ければ角の点なし。すべて`false`の`corners`は受理し、`toJSON()`では出さない
     */
    static fromJSON(data) {
        const style = validateShapeData(data, 'Path', ['path'], { min: OPEN_MIN_POINT_COUNT });
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
                // 既存のテストの文面（'line'・'smooth'）を保つため、曲がり方を持つ区間を除いた並びで文を作る
                const accepted = ACCEPTED_SEGMENT_KINDS
                    .filter((kind) => kind !== SEGMENT_KIND_BEZIER)
                    .map((kind) => `'${kind}'`)
                    .join('・');
                fail(`segments[${index}]のkindが${accepted}ではありません（${String(segment.kind)}）`);
            }
            if (segment.kind === SEGMENT_KIND_BEZIER) {
                ['control1', 'control2'].forEach((key) => {
                    const control = segment[key];
                    if (!isPlainObject(control) || !Number.isFinite(control.x) || !Number.isFinite(control.y)) {
                        fail(`segments[${index}]の${key}がx・yを有限の数値で持つオブジェクトではありません`);
                    }
                });
            }
        });

        if (data.corners !== undefined) {
            if (!Array.isArray(data.corners)) fail('cornersが配列ではありません');
            if (data.corners.length !== data.points.length) {
                fail(`cornersが${data.points.length}要素の配列ではありません`);
            }
            data.corners.forEach((corner, index) => {
                if (typeof corner !== 'boolean') fail(`corners[${index}]が真偽値ではありません`);
            });
        }

        const path = new Path(data.points, data.closed, style.strokeColor, style.strokeWidth, style.fillColor, SEGMENT_KIND_LINE, readCornerFlags(data));
        path.segments = data.segments.map(copySegment);
        path.id = data.id;
        return path;
    }

    /**
     * アフィン変換を当てた新しいPathを返す（共通メソッド契約の第18メソッド）。自身は変えない。
     * `points`をすべて写し、`'bezier'`の区間は引っ張る点`control1`・`control2`も写す（`'line'`・`'smooth'`は`{ kind }`のまま。
     * `'smooth'`の制御点は頂点の1次式のため、同じ変換に追従する）。`closed`・区間の種類・`corners`・`type`・`id`（そのまま）・
     * `strokeColor`・`strokeWidth`・`fillColor`は自身と同じ（線の太さは変えない）。
     * 戻り値は自身と配列・頂点・区間・引っ張る点のオブジェクトを共有しない。`transform`の検証はしない（呼び出し側の責任）。
     * @param {import('./ShapeGeometry.js').AffineTransform} transform - 当てる変換（点`(x, y)`→`(a·x + c·y + e, b·x + d·y + f)`）
     * @returns {Path} 変換を当てた新しい図形
     */
    createTransformed(transform) {
        const points = this.points.map((point) => applyAffineTransformToPoint(transform, point));
        const segments = this.segments.map((segment) => {
            if (segment.kind !== SEGMENT_KIND_BEZIER) {
                return { kind: segment.kind };
            }
            return {
                kind: segment.kind,
                control1: applyAffineTransformToPoint(transform, segment.control1),
                control2: applyAffineTransformToPoint(transform, segment.control2),
            };
        });
        const transformed = new Path(points, this.closed, this.strokeColor, this.strokeWidth, this.fillColor, segments, this.corners);
        transformed.id = this.id;
        return transformed;
    }
}
