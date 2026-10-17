/**
 * 責務：Canvas要素への純粋な描画処理（背景グリッドを含む）のみを担う。
 * 描画変換は引数で受け取ったビュー変換値から毎フレーム設定し、状態は保持しない。
 */

/**
 * `render()`の`view`省略時に用いるビュー変換値（倍率1.0・オフセット(0,0)）。
 * オフセットはスクリーン座標（CSSピクセル）。
 * @type {Readonly<{scale: number, offsetX: number, offsetY: number}>}
 */
const DEFAULT_VIEW = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 });

/**
 * 背景グリッドの細線の基本間隔（ワールド座標の長さ）。
 * 画面上の間隔が`GRID_MIN_SCREEN_SPACING`未満になる場合は10倍ずつ繰り上げる。
 * @type {number}
 */
const GRID_BASE_SPACING = 10;

/**
 * 背景グリッドの細線の画面上の最小間隔（スクリーン座標のCSSピクセル）。
 * これより細かくなる倍率では、細線の間隔を10倍に繰り上げる（間引き）。
 * @type {number}
 */
const GRID_MIN_SCREEN_SPACING = 8;

/**
 * 間隔の繰り上げループの最大回数（無限ループ防止の上限ガード）。
 * @type {number}
 */
const GRID_MAX_SPACING_STEPS = 10;

/**
 * 背景グリッドの細線の色。
 * @type {string}
 */
const GRID_MINOR_COLOR = 'rgba(0, 0, 0, 0.06)';

/**
 * 背景グリッドの太線（細線間隔の10倍ごと）の色。
 * @type {string}
 */
const GRID_MAJOR_COLOR = 'rgba(0, 0, 0, 0.14)';

export class CanvasManager {
    /**
     * `resize()`で算出したデバイスピクセル比（dpr）。
     * 描画バッファの設定値（`canvas.width`と同種の情報）であり、図形データ・選択状態・
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

        // CSS上の表示サイズを明示的に固定（内部バッファ変更によるレイアウト崩れ防止）
        this.canvas.style.width = `${cssWidth}px`;
        this.canvas.style.height = `${cssHeight}px`;

        // 内部バッファのサイズをdpr倍にして鮮明化する
        this.canvas.width = cssWidth * dpr;
        this.canvas.height = cssHeight * dpr;

        this.#pixelRatio = dpr;
    }

    /**
     * 画面をクリアし、背景グリッドと指定された図形リストを全て描画する。
     * 状態の判定は一切行わず、渡された引数（hoveredId / selectedId / draftLine / view）を
     * そのまま描画に反映するだけの純粋なレンダラーとして振る舞う。
     * 描画変換は毎フレーム`setTransform`で「dpr × ビュー変換」を明示設定する（累積させない）。
     * 図形はワールド座標で描画される。
     * @param {Array<Object>} shapes - draw(ctx) / drawHover(ctx, viewScale) / drawHandles(ctx, viewScale) メソッドを持つ図形オブジェクトの配列
     * @param {Object} [state] - 描画状態
     * @param {string|null} [state.hoveredId] - ホバー中の図形id。一致する図形の drawHover(ctx, viewScale) を追加で呼び出す
     * @param {string|null} [state.selectedId] - 選択中の図形id。一致する図形の drawHandles(ctx, viewScale) を追加で呼び出す
     * @param {Object|null} [state.draftLine] - 作成中の未確定図形。draw(ctx) メソッドを持つ場合、最後に重ねて描画する
     * @param {{scale: number, offsetX: number, offsetY: number}} [state.view] - ビュー変換値
     *     （`スクリーン = ワールド × scale ＋ offset`。offsetX/offsetYはスクリーン座標のCSSピクセル）。
     *     省略時は倍率1.0・オフセット(0,0)
     */
    render(shapes, { hoveredId = null, selectedId = null, draftLine = null, view = DEFAULT_VIEW } = {}) {
        const dpr = this.#pixelRatio;

        // 1. 変換の影響を受けずに内部バッファ全体をクリアする
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 2. dprとビュー変換を合成した描画変換を明示設定する（以降の描画はワールド座標）
        this.ctx.setTransform(
            dpr * view.scale, 0,
            0, dpr * view.scale,
            dpr * view.offsetX, dpr * view.offsetY
        );

        // 3. 背景グリッド（図形の背面）
        this.#drawGrid(view);

        // 4. 各Shapeの通常描画に加え、ホバー中・選択中の強調描画をポリモーフィックに呼び出す
        for (const shape of shapes) {
            shape.draw(this.ctx);
            if (shape.id === hoveredId) {
                shape.drawHover(this.ctx, view.scale);
            }
            if (shape.id === selectedId) {
                shape.drawHandles(this.ctx, view.scale);
            }
        }

        // 5. 作成中のドラフト図形があれば、最後に重ねて描画する
        if (draftLine) {
            draftLine.draw(this.ctx);
        }
    }

    /**
     * ワールド座標上の背景グリッド（細線・太線）を、画面に見えている範囲のみ描画する。
     * 呼び出し時点でワールド座標の描画変換が設定済みであることを前提とする。
     * - 線幅は`1 / view.scale`（ワールド長）とし、画面上で常に1px相当にする。
     * - 間引き規則：細線間隔は`GRID_BASE_SPACING`（ワールド長10）から開始し、画面上の間隔が
     *   `GRID_MIN_SCREEN_SPACING`（8px）未満の間は10倍ずつ繰り上げる。太線間隔は細線間隔の10倍。
     * - 可視範囲は現在の描画変換の逆行列でバッファ四隅をワールド座標へ写して求める
     *   （スクリーン⇔ワールドの変換式をここに重複させないため）。
     * - スタイル（線幅・色）は`save()`/`restore()`で後続の描画へ残さない。
     * @param {{scale: number, offsetX: number, offsetY: number}} view - ビュー変換値（offsetはスクリーン座標）
     */
    #drawGrid(view) {
        const scale = view.scale;
        if (!(scale > 0) || !Number.isFinite(scale)) {
            return;
        }

        // 細線の間隔を決定（画面上で詰まりすぎる場合は10倍ずつ繰り上げる）
        let minor = GRID_BASE_SPACING;
        for (let i = 0; i < GRID_MAX_SPACING_STEPS && minor * scale < GRID_MIN_SCREEN_SPACING; i++) {
            minor *= 10;
        }
        const major = minor * 10;

        // 可視範囲（ワールド座標）：バッファ四隅を描画変換の逆行列で写す
        const inverse = this.ctx.getTransform().inverse();
        const p0 = inverse.transformPoint(new DOMPoint(0, 0));
        const p1 = inverse.transformPoint(new DOMPoint(this.canvas.width, this.canvas.height));
        const bounds = {
            minX: Math.min(p0.x, p1.x),
            maxX: Math.max(p0.x, p1.x),
            minY: Math.min(p0.y, p1.y),
            maxY: Math.max(p0.y, p1.y)
        };

        this.ctx.save();
        this.ctx.lineWidth = 1 / scale;
        this.#strokeGridLines(minor, bounds, GRID_MINOR_COLOR);
        this.#strokeGridLines(major, bounds, GRID_MAJOR_COLOR);
        this.ctx.restore();
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
