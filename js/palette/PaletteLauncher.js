/**
 * 責務：ツールバーの呼び出し口のボタンと、開閉式のフロートウィンドウ（パレット）の対応づけと開閉（表示切り替え・ボタンの押された見た目・パレットの×ボタン）を担う。
 * フロートウィンドウをまとめて隠している間の呼び出し口の規則（出して必ず開く）も含む。DOM操作専任。
 */

/**
 * コンストラクタの第2引数。いずれも省略でき、省略時は「常に表示中」として今までと同じ動きになる。
 * @typedef {Object} PaletteLauncherOptions
 * @property {() => boolean} [isFloatWindowsVisible] フロートウィンドウを表示中かの照会（既定：常にtrue）
 * @property {() => void} [showFloatWindows] フロートウィンドウを出す通知（既定：何もしない）
 */

/**
 * 呼び出し口の対応表の1エントリ。
 * @typedef {Object} PaletteLauncherBinding
 * @property {HTMLElement|null} button 呼び出し口のボタン（例：`#launcher-canvas`）。見つからなければnull
 * @property {HTMLElement|null} palette 開閉するパレットのルート要素（`.float-window`。例：`#window-canvas-palette`）。見つからなければnull
 */

/**
 * 呼び出し口（ツールバー上の、他のパレットを開閉するボタン）とパレットの開閉を配線する自己完結UI部品。
 * importを持たず、VectorModel・図形データ・保存先・キャンバス一覧の管理には関与しない。
 *
 * ■ 開閉の規則
 *   - 呼び出し口のボタンの`click`で開閉を反転し、パレット内の`.window-close-btn`（×）の`click`で閉じる。
 *   - フロートウィンドウをまとめて隠している間（照会`isFloatWindowsVisible()`が偽）の`click`は、
 *     `showFloatWindows()`で出したうえでパレットを必ず開く（隠す前に開いていた場合も閉じない）。隠している間、ボタンの`.active`は各パレットの開閉の状態のまま。
 *   - 開閉は`palette.hidden`の切り替えと、ボタンの`.active`（押された見た目。開いている間のみ付ける）の同期のみで表す。
 *   - 起動時は`palette.hidden`の現状（`index.html`で`hidden`を付けて初期非表示）にボタンの`.active`を合わせる。
 *
 * ■ 後続のパレットの追加方法
 *   1. `index.html`に呼び出し口のボタン（ツールバーの`.toolbar-group`に置く）と、パレットのDOM（`.float-window`。ヘッダーに`.window-close-btn`）を静的に置き、
 *      パレットには`hidden`を付けて初期非表示にする。
 *   2. `main.js`の対応表（定数`paletteLaunchers`）へ`{ button, palette }`の1エントリを追加する。
 *
 * ■ 他のモジュール・ウィンドウとの関係
 *   - `WindowManager`は開閉に関与しない（起動時にDOMにある`.float-window`を非表示のものも含めて配線するため、
 *     表示へ切り替えた後もドラッグ移動・最前面化が働く）。
 *   - まとめて隠す仕組み（CSSの`display: none`と表示の状態の同期）は`index.html`と`main.js`にあり、
 *     本クラスは表示中かの照会と「出す」の通知を注入で受け取るだけで、表示の状態の持ち主を知らない。
 *   - 対応表に含まれないウィンドウのうち、ツールパレットには×が無い。
 *     `?dev`の確認用ウィンドウの×は`DevPanel`が配線する。
 */
export class PaletteLauncher {
    /**
     * 対応表の各エントリについて、呼び出し口のボタンとパレットの×を配線する。
     * ボタンまたはパレットが欠けるエントリは`console.warn`で報告し、配線しない（他のエントリは配線する）。
     *
     * 第2引数`options`は省略できる引数のため、`palette/`のUI部品の規約（コールバックが関数でなければ`Error`）の例外とする。
     * 指定された値が関数でなければ`Error`にせず`console.warn`して既定を使う（省略時は今までと同じ動きにするための既定値を持つ。
     * 対応表の不正も従来から`Error`ではなく`console.warn`で扱っている）。
     * @param {PaletteLauncherBinding[]} bindings 呼び出し口とパレットの対応表
     * @param {PaletteLauncherOptions} [options] 隠している間の規則のための注入（省略可。関数でない値は`console.warn`して既定を使う）
     */
    constructor(bindings, options = {}) {
        const opts = options || {};
        let isFloatWindowsVisible = () => true;
        let showFloatWindows = () => {};
        if (opts.isFloatWindowsVisible !== undefined) {
            if (typeof opts.isFloatWindowsVisible === 'function') {
                isFloatWindowsVisible = opts.isFloatWindowsVisible;
            } else {
                console.warn('PaletteLauncher: isFloatWindowsVisibleが関数ではありません。既定（常に表示中）を使います。');
            }
        }
        if (opts.showFloatWindows !== undefined) {
            if (typeof opts.showFloatWindows === 'function') {
                showFloatWindows = opts.showFloatWindows;
            } else {
                console.warn('PaletteLauncher: showFloatWindowsが関数ではありません。既定（何もしない）を使います。');
            }
        }
        if (!Array.isArray(bindings)) {
            console.warn('PaletteLauncher: 対応表が配列ではありません。配線しません。');
            return;
        }
        bindings.forEach((binding, index) => {
            const button = binding ? binding.button : null;
            const palette = binding ? binding.palette : null;
            if (!button || !palette) {
                console.warn(`PaletteLauncher: 対応表の${index}番目の呼び出し口またはパレットが見つかりません。配線しません。`);
                return;
            }
            PaletteLauncher.#bind(button, palette, isFloatWindowsVisible, showFloatWindows);
        });
    }

    /**
     * 1組の呼び出し口とパレットを配線する。起動時の`.active`をパレットの現在の表示状態に合わせ、
     * ボタンの`click`で開閉を反転（フロートウィンドウを隠している間は、出してから必ず開く）、
     * パレット内の`.window-close-btn`の`click`で閉じる。
     * パレット内に`.window-close-btn`が無い場合は、ボタンでの開閉のみを配線する。
     * @param {HTMLElement} button 呼び出し口のボタン
     * @param {HTMLElement} palette 開閉するパレットのルート要素
     * @param {() => boolean} isFloatWindowsVisible フロートウィンドウを表示中かの照会
     * @param {() => void} showFloatWindows フロートウィンドウを出す通知
     * @private
     */
    static #bind(button, palette, isFloatWindowsVisible, showFloatWindows) {
        PaletteLauncher.#setOpen(button, palette, !palette.hidden);

        button.addEventListener('click', () => {
            if (!isFloatWindowsVisible()) {
                showFloatWindows();
                PaletteLauncher.#setOpen(button, palette, true);
                return;
            }
            PaletteLauncher.#setOpen(button, palette, palette.hidden);
        });

        const closeButton = palette.querySelector('.window-close-btn');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                PaletteLauncher.#setOpen(button, palette, false);
            });
        }
    }

    /**
     * パレットの表示状態を設定し、呼び出し口のボタンの`.active`を同期する。
     * @param {HTMLElement} button 呼び出し口のボタン
     * @param {HTMLElement} palette 開閉するパレットのルート要素
     * @param {boolean} isOpen 開くならtrue、閉じるならfalse
     * @private
     */
    static #setOpen(button, palette, isOpen) {
        palette.hidden = !isOpen;
        button.classList.toggle('active', isOpen);
    }
}
