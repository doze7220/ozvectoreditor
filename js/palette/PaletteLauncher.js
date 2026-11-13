/**
 * 責務：ツールバーの呼び出し口のボタンと、開閉式のフロートウィンドウ（パレット）の対応づけと開閉（表示切り替え・ボタンの押された見た目・パレットの×ボタン）を担う。DOM操作専任。
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
 *   - 対応表に含まれないウィンドウのうち、ツールパレットには×が無い。
 *     `?dev`の確認用ウィンドウの×は`DevPanel`が配線する。
 */
export class PaletteLauncher {
    /**
     * 対応表の各エントリについて、呼び出し口のボタンとパレットの×を配線する。
     * ボタンまたはパレットが欠けるエントリは`console.warn`で報告し、配線しない（他のエントリは配線する）。
     * @param {PaletteLauncherBinding[]} bindings 呼び出し口とパレットの対応表
     */
    constructor(bindings) {
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
            PaletteLauncher.#bind(button, palette);
        });
    }

    /**
     * 1組の呼び出し口とパレットを配線する。起動時の`.active`をパレットの現在の表示状態に合わせ、
     * ボタンの`click`で開閉を反転、パレット内の`.window-close-btn`の`click`で閉じる。
     * パレット内に`.window-close-btn`が無い場合は、ボタンでの開閉のみを配線する。
     * @param {HTMLElement} button 呼び出し口のボタン
     * @param {HTMLElement} palette 開閉するパレットのルート要素
     * @private
     */
    static #bind(button, palette) {
        PaletteLauncher.#setOpen(button, palette, !palette.hidden);

        button.addEventListener('click', () => {
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
