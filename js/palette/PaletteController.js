/**
 * 責務: 図形選択パレット（`#window-shape-palette`）内5ボタンのclick購読による図形種別の選択要求（コールバック経由）、
 * および`setEnabled(enabled)`によるパレット本体の活性/非活性制御・`setActiveType(type)`による各ボタンのアクティブ表示制御を担う。
 * 操作モード・VectorModel・図形データ・選択状態には一切関与しない。
 */

/**
 * 図形選択パレットの自己完結UI部品。ボタンclickを図形種別の選択要求としてコールバックへ通知し、
 * パレット本体の活性/非活性と各ボタンのアクティブ表示を外部からの指示に従って切り替える。
 * InputTrackerへは直接依存しない。
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
     * @type {Element} パレットのルート要素（`#window-shape-palette`）。setEnabled時の.disabled制御対象。
     * @private
     */
    #rootElement;

    /**
     * @type {Function} 図形種別の選択要求時に呼び出す汎用コールバック（例: `applyShapeType(type)`）。
     * @private
     */
    #onTypeSelected;

    /**
     * @type {Array<{el: Element, type: string}>} パレット内5ボタンのDOM要素と対応typeの対応表。
     * setActiveType時のアクティブ表示の排他制御に用いる。
     * @private
     */
    #buttons;

    /**
     * パレットルート要素内の5ボタンへclickリスナーを登録し、クリック時に
     * `onTypeSelected(type)`コールバックを呼び出す配線を行う。
     * @param {Element} paletteRootElement パレットのルート要素（`#window-shape-palette`）
     * @param {Function} onTypeSelected 図形種別選択時に呼び出す汎用コールバック（例: `applyShapeType(type)`）
     */
    constructor(paletteRootElement, onTypeSelected) {
        this.#rootElement = paletteRootElement;
        this.#onTypeSelected = onTypeSelected;

        this.#buttons = PaletteController.#BUTTON_DEFS
            .map(({ id, type }) => ({ el: this.#rootElement.querySelector(`#${id}`), type }))
            .filter(({ el }) => el !== null);

        this.#buttons.forEach(({ el, type }) => {
            el.addEventListener('click', () => this.#onTypeSelected(type));
        });
    }

    /**
     * パレット本体の活性/非活性を切り替える。`enabled === false`の場合はパレットのルート要素に
     * `.disabled`を付与し、`true`の場合は除去する。パレット内ボタンの`.active`には触れない。
     * 活性/非活性の判断（どの操作モードで活性とするか）は呼び出し側（`main.js`）の責務である。
     * @param {boolean} enabled パレットを活性にする場合は`true`、非活性にする場合は`false`
     */
    setEnabled(enabled) {
        this.#rootElement.classList.toggle('disabled', !enabled);
    }

    /**
     * パレット内5ボタンのうち`type`と一致するもの1つにのみ`.active`を付与し、他は除去する。
     * パレットの活性/非活性に関係なくハイライトを更新する（非活性中も記憶中の図形種別を表示し続ける）。
     * `type`がいずれのボタンとも一致しない値の場合は、5ボタンすべて`.active`なしの状態になる。
     * @param {'line'|'curve'|'arc'|'rect'|'circle'} type ハイライトする図形種別
     */
    setActiveType(type) {
        this.#buttons.forEach(({ el, type: buttonType }) => {
            el.classList.toggle('active', buttonType === type);
        });
    }
}
