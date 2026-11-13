/**
 * 責務：Canvas要素への純粋な描画処理（背景の塗り・グリッド・原点表示・アウトライン表示・選択矩形・吸い付きの表示を含む）のみを担う。
 * 描画変換は引数で受け取った値から、配色は引数で選ばれた配色の組（モジュール定数）から毎フレーム設定し、状態は保持しない。
 */
import { computeGridSpacing } from './GridSpacingRules.js';

/**
 * `render()`の`view`省略時に用いるビュー変換値（倍率1.0・オフセット(0,0)）。
 * オフセットはスクリーン座標（CSSピクセル）。
 * @type {Readonly<{scale: number, offsetX: number, offsetY: number}>}
 */
const DEFAULT_VIEW = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });

/**
 * 配色の組（背景の白/黒に対応する2組）。各組は背景・グリッドの細線・太線・軸線・原点マーク・アウトラインの色を持つ。
 * - `light`：白の背景用（従来の見た目と同じ値）。
 * - `dark`：黒の背景用（白系は黒の上で薄く見えやすいため透明度を少し上げている）。
 * 軸線（`originAxis`）はグリッドの太線（`gridMajor`）より濃くして区別する。
 * @type {Readonly<{light: Readonly<ColorScheme>, dark: Readonly<ColorScheme>}>}
 */
const COLOR_SCHEMES = Object.freeze({
    light: Object.freeze({
        background: '#ffffff',
        gridMinor: 'rgba(0, 0, 0, 0.06)',
        gridMajor: 'rgba(0, 0, 0, 0.14)',
        originAxis: 'rgba(0, 0, 0, 0.32)',
        originMark: 'rgba(0, 0, 0, 0.6)',
        outline: '#000000'
    }),
    dark: Object.freeze({
        background: '#000000',
        gridMinor: 'rgba(255, 255, 255, 0.10)',
        gridMajor: 'rgba(255, 255, 255, 0.22)',
        originAxis: 'rgba(255, 255, 255, 0.45)',
        originMark: 'rgba(255, 255, 255, 0.75)',
        outline: '#ffffff'
    })
});

/**
 * 配色の組の1組分。
 * @typedef {Object} ColorScheme
 * @property {string} background - 背景の塗りの色
 * @property {string} gridMinor - グリッドの細線の色
 * @property {string} gridMajor - グリッドの太線（細線間隔の10倍ごと）の色
 * @property {string} originAxis - 軸線（`x = 0`・`y = 0`の直線）の色
 * @property {string} originMark - 原点マーク（(0, 0)の十字と円）の色
 * @property {string} outline - アウトライン表示の線の色
 */

/**
 * 原点マークの十字の全長（スクリーン座標のCSSピクセル）。描画時に`÷ view.scale`して画面上一定にする。
 * @type {number}
 */
const ORIGIN_MARK_SIZE = 12;

/**
 * 原点マークの円の半径（スクリーン座標のCSSピクセル）。描画時に`÷ view.scale`して画面上一定にする。
 * @type {number}
 */
const ORIGIN_MARK_RADIUS = 3;

/**
 * 選択矩形（範囲選択中の表示）の線の色。
 * @type {string}
 */
const SELECTION_RECT_STROKE_COLOR = '#4a90e2';

/**
 * 選択矩形の塗りの色（薄い半透明）。
 * @type {string}
 */
const SELECTION_RECT_FILL_COLOR = 'rgba(74, 144, 226, 0.08)';

/**
 * 選択矩形の線幅（スクリーン座標のCSSピクセル）。描画時に`÷ view.scale`して画面上一定にする。
 * @type {number}
 */
const SELECTION_RECT_LINE_WIDTH = 1;

/**
 * 選択矩形の破線パターン（スクリーン座標のCSSピクセル）。描画時に各値を`÷ view.scale`して画面上一定にする。
 * @type {ReadonlyArray<number>}
 */
const SELECTION_RECT_DASH = Object.freeze([4, 3]);

/**
 * 吸い付きの表示（正方形）の一辺（スクリーン座標のCSSピクセル）。描画時に`÷ view.scale`して画面上一定にする。
 * @type {number}
 */
const SNAP_INDICATOR_SIZE = 8;

/**
 * 吸い付きの表示の塗りの色。
 * @type {string}
 */
const SNAP_INDICATOR_FILL_COLOR = '#4a90e2';

/**
 * 吸い付きの表示の枠の色。
 * @type {string}
 */
const SNAP_INDICATOR_STROKE_COLOR = '#1f4e8c';

/**
 * 吸い付きの表示の枠の太さ（スクリーン座標のCSSピクセル）。描画時に`÷ view.scale`して画面上一定にする。
 * @type {number}
 */
const SNAP_INDICATOR_LINE_WIDTH = 1.5;

/**
 * Canvasへの描画を行うクラス。render()の引数（図形の配列・表示状態・ビュー変換値・アウトライン/背景/グリッドの表示指定）のみから毎回描画し、
 * 図形データ・選択状態などのアプリケーション状態は保持しない（保持するのはCanvas要素・2Dコンテキスト・dprのみ）。
 */
export class CanvasManager {
    /**
     * `resize()`で算出したデバイスピクセル比（dpr）。
     * 描画バッファの設定値（`canvas.width`と同種の情報）であり、図形データ・選択集合・
     * ビュー変換状態は含まない。`render()`がビュー変換と合成して描画変換を設定する際に用いる。
     * @type {number}
     */
    #pixelRatio = 1;

    /**
     * @param {HTMLCanvasElement} canvas
     */
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        this.resize();
    }

    /**
     * 高DPIディスプレイ対応のため、dprの算出とキャンバスの内部バッファサイズの同期のみを行う。
     * 描画変換（dpr × ビュー変換）の適用は`render()`が毎フレーム行う。
     * 表示サイズはCSSに任せて固定せず、呼ばれた時点の`clientWidth/Height`へ内部バッファを同期する。
     * コンストラクタからの初期化と、ウィンドウリサイズ時の再同期（呼び出し元は`main.js`）の
     * 両方から呼ばれる公開メソッドである。
     * shapes/Modelへの参照は持たず、render()の呼び出しも行わない（純粋なレンダラーの責務維持）。
     */
    resize() {
        const dpr = window.devicePixelRatio || 1;

        // 変換を恒等へ戻す（変換の設定自体はrender()が毎フレーム明示的に行う）
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);

        // 現在のレイアウト上の表示サイズ（スクリーン座標のCSSピクセル）を取得
        const cssWidth = this.canvas.clientWidth;
        const cssHeight = this.canvas.clientHeight;

        // 内部バッファのサイズをdpr倍にして鮮明化する
        this.canvas.width = cssWidth * dpr;
        this.canvas.height = cssHeight * dpr;

        this.#pixelRatio = dpr;
    }

    /**
     * 背景を配色の組の背景色で塗り、背景グリッド・原点表示と指定された図形リストを全て描画する。
     * 状態の判定は一切行わず、渡された引数（hoveredId / selectedIds / draftShape / selectionRect / view /
     * outline / darkBackground / showGrid）をそのまま描画に反映するだけの純粋なレンダラーとして振る舞う。
     * 描画変換は毎フレーム`setTransform`で「dpr × ビュー変換」を明示設定する（累積させない）。
     * 図形・選択矩形はワールド座標で描画される。
     * 新しい引数（outline・darkBackground・showGrid）の省略時の値では、従来（白の背景・グリッドあり・通常描画）と同じ見た目になる。
     * 描画順：背景の塗り → 背景グリッド（showGridが偽なら省略） → 軸線・原点マーク
     * → (1)全図形の draw（outlineが真なら drawOutline。＋ホバー中図形の drawHover）
     * → (2)選択集合に含まれる図形の drawHandles（図形配列の順。後ろの図形ほど前面）
     * → (3)作成中の図形 → (3-2)吸い付きの表示 → (4)選択矩形。
     * ハンドルを全図形の描画後にまとめて描くのは、複数選択時に前面の図形が背面図形のハンドルを覆い隠さないためである。
     * @param {Array<Object>} shapes - draw(ctx) / drawOutline(ctx, viewScale, color) / drawHover(ctx, viewScale) / drawHandles(ctx, viewScale) メソッドを持つ図形オブジェクトの配列
     * @param {Object} [state] - 描画状態
     * @param {string|null} [state.hoveredId] - ホバー中の図形id（単一）。一致する図形の drawHover(ctx, viewScale) を追加で呼び出す
     * @param {Array<string>} [state.selectedIds] - 選択集合（選択中の図形idの配列。0個以上）。
     *     含まれる図形の drawHandles(ctx, viewScale) を全図形の描画後に呼び出す。省略時は空配列
     * @param {Object|null} [state.draftShape] - 作成中の未確定図形。draw(ctx) メソッドを持つ場合、全図形・ハンドルの後に重ねて描画する
     * @param {{x1: number, y1: number, x2: number, y2: number}|null} [state.selectionRect] - 範囲選択中の選択矩形。
     *     ワールド座標の対角2点（正規化不要。幅・高さが負でもよい）。非nullの場合、最前面に描画する
     * @param {{scale: number, offsetX: number, offsetY: number}} [state.view] - ビュー変換値
     *     （`スクリーン = ワールド × scale ＋ offset`。offsetX/offsetYはスクリーン座標のCSSピクセル）。
     *     省略時は倍率1.0・オフセット(0,0)
     * @param {{x: number, y: number}|null} [state.snapPoint] - 端点への吸い付きの表示の点（ワールド座標）。
     *     非nullの場合、作成中の図形の後・選択矩形の前に、画面上一定の大きさの正方形で描画する
     * @param {boolean} [state.outline] - 真ならアウトライン表示（図形・作成中の図形を drawOutline で描く）。省略時は偽（通常描画）
     * @param {boolean} [state.darkBackground] - 真なら黒の背景用の配色の組、偽なら白の背景用の配色の組を使う。省略時は偽
     * @param {boolean} [state.showGrid] - 偽なら背景グリッド（細線・太線）のみ描かない（軸線・原点マークは常に描く）。省略時は真
     */
    render(shapes, { hoveredId = null, selectedIds = [], draftShape = null, selectionRect = null, view = DEFAULT_VIEW, snapPoint = null, outline = false, darkBackground = false, showGrid = true } = {}) {
        const dpr = this.#pixelRatio;
        const scheme = darkBackground ? COLOR_SCHEMES.dark : COLOR_SCHEMES.light;

        // 1. 変換の影響を受けずに内部バッファ全体を背景色で塗る（fillStyleを後続へ残さない）
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.fillStyle = scheme.background;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        // 2. dprとビュー変換を合成した描画変換を明示設定する（以降の描画はワールド座標）
        this.ctx.setTransform(
            dpr * view.scale, 0,
            0, dpr * view.scale,
            dpr * view.offsetX, dpr * view.offsetY
        );

        // 3. 背景グリッド（図形の背面）
        if (showGrid) {
            this.#drawGrid(view, scheme);
        }

        // 3-2. 軸線・原点マーク（グリッドの前面・図形の背面。グリッドを隠していても描く）
        this.#drawOrigin(view, scheme);

        // 4. 各Shapeの通常描画（アウトライン表示ならアウトライン描画）に加え、ホバー中の強調描画をポリモーフィックに呼び出す
        for (const shape of shapes) {
            if (outline) {
                shape.drawOutline(this.ctx, view.scale, scheme.outline);
            } else {
                shape.draw(this.ctx);
            }
            if (shape.id === hoveredId) {
                shape.drawHover(this.ctx, view.scale);
            }
        }

        // 5. 選択集合に含まれる図形のハンドルを、全図形の描画後に図形配列の順で描画する
        //    （所属判定用のSetはこのフレーム内の一時値であり、インスタンスには保持しない）
        const selectedSet = new Set(selectedIds);
        if (selectedSet.size > 0) {
            for (const shape of shapes) {
                if (selectedSet.has(shape.id)) {
                    shape.drawHandles(this.ctx, view.scale);
                }
            }
        }

        // 6. 作成中のドラフト図形があれば、図形・ハンドルの上に重ねて描画する
        if (draftShape) {
            if (outline) {
                draftShape.drawOutline(this.ctx, view.scale, scheme.outline);
            } else {
                draftShape.draw(this.ctx);
            }
        }

        // 6-2. 吸い付きの表示があれば、作成中の図形の上・選択矩形の下に描画する
        if (snapPoint) {
            this.#drawSnapIndicator(snapPoint, view.scale);
        }

        // 7. 範囲選択中の選択矩形があれば、最前面に描画する
        if (selectionRect) {
            this.#drawSelectionRect(selectionRect, view.scale);
        }
    }

    /**
     * 端点への吸い付きの表示（画面上一定の大きさの正方形。中心が渡された点）を描画する。
     * 呼び出し時点でワールド座標の描画変換が設定済みであることを前提とする。
     * - 大きさ・線幅は`÷ scale`し、画面上で一定（`SNAP_INDICATOR_SIZE`px・`SNAP_INDICATOR_LINE_WIDTH`px）にする。
     * - 倍率が正の有限値でなければ描かない。
     * - スタイルは`save()`/`restore()`で後続の描画へ残さない。
     * @param {{x: number, y: number}} point - 表示する点（ワールド座標。正方形の中心）
     * @param {number} scale - ビュー変換の倍率（ワールド長 → スクリーン長の係数）
     */
    #drawSnapIndicator(point, scale) {
        if (!(scale > 0) || !Number.isFinite(scale)) {
            return;
        }
        const size = SNAP_INDICATOR_SIZE / scale;

        this.ctx.save();
        this.ctx.lineWidth = SNAP_INDICATOR_LINE_WIDTH / scale;
        this.ctx.fillStyle = SNAP_INDICATOR_FILL_COLOR;
        this.ctx.strokeStyle = SNAP_INDICATOR_STROKE_COLOR;
        this.ctx.beginPath();
        this.ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * 範囲選択中の選択矩形（画面上1pxの破線＋薄い半透明塗り）を描画する。
     * 呼び出し時点でワールド座標の描画変換が設定済みであることを前提とする。
     * - 線幅・破線パターンは`÷ scale`し、画面上で一定（`SELECTION_RECT_LINE_WIDTH`px・`SELECTION_RECT_DASH`px）にする。
     * - 対角2点は正規化しない（幅・高さが負でもCanvasは正しく描画する）。
     * - スタイル（線幅・破線・色）は`save()`/`restore()`で後続の描画へ残さない。
     * @param {{x1: number, y1: number, x2: number, y2: number}} rect - 選択矩形（ワールド座標の対角2点。正規化不要）
     * @param {number} scale - ビュー変換の倍率（ワールド長 → スクリーン長の係数）
     */
    #drawSelectionRect(rect, scale) {
        if (!(scale > 0) || !Number.isFinite(scale)) {
            return;
        }
        const { x1, y1, x2, y2 } = rect;

        this.ctx.save();
        this.ctx.lineWidth = SELECTION_RECT_LINE_WIDTH / scale;
        this.ctx.setLineDash(SELECTION_RECT_DASH.map(v => v / scale));
        this.ctx.strokeStyle = SELECTION_RECT_STROKE_COLOR;
        this.ctx.fillStyle = SELECTION_RECT_FILL_COLOR;
        this.ctx.beginPath();
        this.ctx.rect(x1, y1, x2 - x1, y2 - y1);
        this.ctx.fill();
        this.ctx.stroke();
        this.ctx.restore();
    }

    /**
     * ワールド座標上の背景グリッド（細線・太線）を、画面に見えている範囲のみ描画する。
     * 呼び出し時点でワールド座標の描画変換が設定済みであることを前提とする。
     * - 線幅は`1 / view.scale`（ワールド長）とし、画面上で常に1px相当にする。
     * - 間隔は`GridSpacingRules.computeGridSpacing`で求める（定規・ステータスバーと共有）。
     * - 可視範囲は`#getVisibleWorldBounds()`で求める（原点表示と共用）。
     * - スタイル（線幅・色）は`save()`/`restore()`で後続の描画へ残さない。
     * - 色は配色の組（`scheme.gridMinor`・`scheme.gridMajor`）を使う。
     * @param {{scale: number, offsetX: number, offsetY: number}} view - ビュー変換値（offsetはスクリーン座標）
     * @param {ColorScheme} scheme - 使う配色の組
     */
    #drawGrid(view, scheme) {
        const scale = view.scale;
        if (!(scale > 0) || !Number.isFinite(scale)) {
            return;
        }

        const { minor, major } = computeGridSpacing(scale);

        const bounds = this.#getVisibleWorldBounds();

        this.ctx.save();
        this.ctx.lineWidth = 1 / scale;
        this.#strokeGridLines(minor, bounds, scheme.gridMinor);
        this.#strokeGridLines(major, bounds, scheme.gridMajor);
        this.ctx.restore();
    }

    /**
     * ワールド座標の軸線（`x = 0`・`y = 0`）と原点マーク（(0, 0)の十字＋円）を描画する。
     * 呼び出し時点でワールド座標の描画変換が設定済みであることを前提とする。
     * - 軸線：`x = 0`が可視範囲内ならY軸、`y = 0`が可視範囲内ならX軸を、可視範囲の端から端まで描く。
     * - 原点マーク：十字（全長`ORIGIN_MARK_SIZE`px）と円（半径`ORIGIN_MARK_RADIUS`px）。
     *   可視範囲外でも描画命令は発行する（数本のパスのみで、はみ出し分はCanvasが切り捨てる）。
     * - 線幅・十字の長さ・円の半径は`÷ view.scale`し、画面上で一定（線幅1px）にする。
     * - スタイル（線幅・色）は`save()`/`restore()`で後続の描画へ残さない。
     * - 色は配色の組（`scheme.originAxis`・`scheme.originMark`）を使う。
     * @param {{scale: number, offsetX: number, offsetY: number}} view - ビュー変換値（offsetはスクリーン座標）
     * @param {ColorScheme} scheme - 使う配色の組
     */
    #drawOrigin(view, scheme) {
        const scale = view.scale;
        if (!(scale > 0) || !Number.isFinite(scale)) {
            return;
        }
        const { minX, maxX, minY, maxY } = this.#getVisibleWorldBounds();

        this.ctx.save();
        this.ctx.lineWidth = 1 / scale;

        // 軸線（可視範囲に入っている軸のみ）
        this.ctx.beginPath();
        if (minX <= 0 && 0 <= maxX) {
            this.ctx.moveTo(0, minY);
            this.ctx.lineTo(0, maxY);
        }
        if (minY <= 0 && 0 <= maxY) {
            this.ctx.moveTo(minX, 0);
            this.ctx.lineTo(maxX, 0);
        }
        this.ctx.strokeStyle = scheme.originAxis;
        this.ctx.stroke();

        // 原点マーク（十字＋円。サイズは画面上一定）
        const half = ORIGIN_MARK_SIZE / 2 / scale;
        const radius = ORIGIN_MARK_RADIUS / scale;
        this.ctx.beginPath();
        this.ctx.moveTo(-half, 0);
        this.ctx.lineTo(half, 0);
        this.ctx.moveTo(0, -half);
        this.ctx.lineTo(0, half);
        this.ctx.moveTo(radius, 0);
        this.ctx.arc(0, 0, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = scheme.originMark;
        this.ctx.stroke();

        this.ctx.restore();
    }

    /**
     * 画面に見えている範囲（描画バッファ全体）をワールド座標の軸平行矩形として返す。
     * 現在の描画変換の逆行列でバッファの対角2隅をワールド座標へ写して求める
     * （スクリーン⇔ワールドの変換式を重複させないため。描画変換は拡大縮小＋平行移動のみのため対角2隅で足りる）。
     * 呼び出し時点でワールド座標の描画変換が設定済みであることを前提とする。状態は持たない。
     * @returns {{minX: number, maxX: number, minY: number, maxY: number}} 可視範囲（ワールド座標）
     */
    #getVisibleWorldBounds() {
        const inverse = this.ctx.getTransform().inverse();
        const p0 = inverse.transformPoint(new DOMPoint(0, 0));
        const p1 = inverse.transformPoint(new DOMPoint(this.canvas.width, this.canvas.height));
        return {
            minX: Math.min(p0.x, p1.x),
            maxX: Math.max(p0.x, p1.x),
            minY: Math.min(p0.y, p1.y),
            maxY: Math.max(p0.y, p1.y)
        };
    }

    /**
     * 指定間隔の縦横の格子線を、可視範囲内について1本のパスにまとめて描画する。
     * 線位置は整数インデックス × 間隔で求め、加算による浮動小数誤差の累積を避ける。
     * @param {number} spacing - 格子線の間隔（ワールド長）
     * @param {{minX: number, maxX: number, minY: number, maxY: number}} bounds - 可視範囲（ワールド座標）
     * @param {string} color - 線の色
     */
    #strokeGridLines(spacing, bounds, color) {
        const { minX, maxX, minY, maxY } = bounds;
        this.ctx.beginPath();
        for (let i = Math.floor(minX / spacing); i * spacing <= maxX; i++) {
            const x = i * spacing;
            this.ctx.moveTo(x, minY);
            this.ctx.lineTo(x, maxY);
        }
        for (let i = Math.floor(minY / spacing); i * spacing <= maxY; i++) {
            const y = i * spacing;
            this.ctx.moveTo(minX, y);
            this.ctx.lineTo(maxX, y);
        }
        this.ctx.strokeStyle = color;
        this.ctx.stroke();
    }
}
