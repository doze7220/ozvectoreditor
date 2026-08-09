/**
 * 責務: 図形選択パレット（`#window-shape-palette`）内5ボタンのclick購読による
 * ツール切り替え要求（コールバック経由）、および`setActiveTool(tool)`によるパレット本体の
 * 活性/非活性・各ボタンのアクティブ表示制御を担う。VectorModel・図形データ・選択状態には一切関与しない。
 */

export class PaletteController {
    /**
     * @type {Array<{id: string, type: string}>} パレット内5ボタンのDOM id と、対応する図形種別typeの対応表。
     * @private
     */
    static #BUTTON_DEFS = [
        { id: 'palette-line', type: 'line' },
        { id: 'palette-curve', type: 'curve' },
        { id: 'palette-arc', type: 'arc' },
        { id: 'palette-rect', type: 'rect' },
        { id: 'palette-circle', type: 'circle' },
    ];

    /**
     * @type {Element} パレットのルート要素（`#window-shape-palette`）。setActiveTool時の.disabled制御対象。
     * @private
     */
    #rootElement;

    /**
     * @type {Function} ツール切り替え要求時に呼び出す汎用コールバック（例: `applyTool(type)`）。
     * @private
     */
    #onToolSelected;

    /**
     * @type {Array<{el: Element, type: string}>} パレット内5ボタンのDOM要素と対応typeの対応表。
     * setActiveTool時のアクティブ表示の排他制御に用いる。
     * @private
     */
    #buttons;

    /**
     * パレットルート要素内の5ボタンへclickリスナーを登録し、クリック時に
     * `onToolSelected(type)`コールバックを呼び出す配線を行う。
     * @param {Element} paletteRootElement パレットのルート要素（`#window-shape-palette`）
     * @param {Function} onToolSelected ツール選択時に呼び出す汎用コールバック（例: `applyTool(type)`）
     */
    constructor(paletteRootElement, onToolSelected) {
        this.#rootElement = paletteRootElement;
        this.#onToolSelected = onToolSelected;

        this.#buttons = PaletteController.#BUTTON_DEFS
            .map(({ id, type }) => ({ el: this.#rootElement.querySelector(`#${id}`), type }))
            .filter(({ el }) => el !== null);

        this.#buttons.forEach(({ el, type }) => {
            el.addEventListener('click', () => this.#onToolSelected(type));
        });
    }

    /**
     * 現在のツール種別に応じて、パレット本体の活性/非活性とパレット内5ボタンの
     * アクティブ表示を更新する。`tool === 'select'`の場合はパレット本体に`.disabled`を
     * 付与し、それ以外は除去する。パレット内5ボタンのうち`tool`と一致するもの1つにのみ
     * `.active`を付与し、他は除去する（`tool`がパレット外由来の値等でいずれとも一致しない
     * 場合は、5ボタンすべて`.active`なしの状態になる）。
     * @param {string} tool 現在アクティブなツール種別（'select' | 'line' | 'curve' | 'arc' | 'rect' | 'circle'）
     */
    setActiveTool(tool) {
        if (tool === 'select') {
            this.#rootElement.classList.add('disabled');
        } else {
            this.#rootElement.classList.remove('disabled');
        }

        this.#buttons.forEach(({ el, type }) => {
            el.classList.toggle('active', type === tool);
        });
    }
}
