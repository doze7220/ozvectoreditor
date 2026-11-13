/**
 * 責務：ツールバーのオプションバーの「スタイル」のまとまり（`#option-style-group`）の表示と、利用者の操作（線・塗りのON/OFF、太さ、色）のコールバックへの通知を担う。
 * 図形データ・選択状態には関与しない。DOM操作専任。
 */

/**
 * 色の欄に重ねる表示（覆いと斜線、`title`）の種類。
 * @typedef {'' | 'mixed' | 'unsupported'} OptionBarColorNote
 */

/**
 * 線または塗りの表示内容。
 * @typedef {Object} OptionBarColorView
 * @property {boolean|null} enabled 有無（`null`はそろっていない＝ON/OFFのボタンの`aria-pressed="mixed"`）
 * @property {string} color 色の欄にそのまま入れる`#rrggbb`（小文字）
 * @property {OptionBarColorNote} colorNote 色の欄に重ねる表示（覆いと斜線、`title`）の種類
 * @property {boolean} disabled ON/OFFのボタンと色の欄を無効にするか
 */

/**
 * オプションバーのスタイルのまとまりに表示する内容。`edit/StylePanelRules.js`のtypedef`StylePanelView`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} StylePanelView
 * @property {OptionBarColorView} stroke 線の表示内容
 * @property {number|null} strokeWidth 線の太さ（`null`は混在）
 * @property {OptionBarColorView} fill 塗りの表示内容
 */

/**
 * 利用者の操作を受け取るコールバック群。6つとも関数であること。
 * @typedef {Object} OptionBarStyleGroupActions
 * @property {() => void} onStrokeToggle 線のON/OFFのボタンの`click`で呼ばれる（「押された」ことだけを通知する。引数なし）
 * @property {() => void} onFillToggle 塗りのON/OFFのボタンの`click`で呼ばれる（「押された」ことだけを通知する。引数なし）
 * @property {(value: string) => boolean} onStrokeWidthChange 太さの欄の`change`（`Enter`・欄から出たとき・矢印の操作）で呼ばれる（引数：欄の文字列）。
 *   戻り値が`false`（受理されなかった）なら、最後に表示した内容で欄の値を書き戻す
 * @property {(target: 'stroke'|'fill', value: string) => void} onColorInput 色の欄の`input`（ピッカーで色を動かしている間）で呼ばれる
 * @property {(target: 'stroke'|'fill', value: string) => void} onColorChange 色の欄の`change`（ピッカーを閉じて確定）で呼ばれる
 * @property {() => void} onColorEditEnd 色の欄の`blur`・`keydown`で呼ばれる（ピッカー操作中の変更の確定の契機）
 */

/** 色の欄の`title`の文言（`target`→`colorNote`→文字列。唯一の定義箇所）。 */
const COLOR_TITLE_TEXT = Object.freeze({
    stroke: Object.freeze({
        '': '線の色',
        mixed: '線の色（混在）',
        unsupported: '線の色（表示できない色）'
    }),
    fill: Object.freeze({
        '': '塗りの色',
        mixed: '塗りの色（混在）',
        unsupported: '塗りの色（表示できない色）'
    })
});

/** 太さが混在のときの`placeholder`の文言（唯一の定義箇所）。 */
const STROKE_WIDTH_MIXED_PLACEHOLDER = '混在';

/**
 * オプションバーの「スタイル」のまとまりのUI部品。importを持たず、VectorModel・図形データ・選択状態・ShapeStyleEditorを参照しない。
 * 受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ まとまりの構成
 *   - オプションバーはまとまりごとにUI部品を1つ持つ。本クラスのルート要素は自分の`<div id="option-style-group" class="toolbar-group">`。
 *   - 要素はルート要素内の`querySelector('#id')`で解決する。後からまとまりを足しても、本クラスは変えない。
 *   - 塗りのON/OFFのボタンと色の欄の無効表示は、各要素の`disabled`属性で行う。
 *
 * ■ 表示の規則
 *   - ON/OFFのボタンは`aria-pressed`で状態を表す（ON＝`"true"`・OFF＝`"false"`・そろっていない＝`"mixed"`）。見た目はCSSが`aria-pressed`の値で決める。
 *   - 色の欄は値が今の値と違うときだけ`value`へ代入する。色の欄とそれを包む要素の`data-color-note`・`title`を`colorNote`から決める（覆いと斜線の見た目はCSSが`data-color-note`で決める）。
 *   - 太さの欄は、フォーカスがある間は値を書き換えない。受理されなかったとき・フォーカスが外れたときは最後に表示した内容で書き戻す。
 */
export class OptionBarStyleGroup {
    /** @type {HTMLButtonElement|null} */
    #strokeToggle = null;
    /** @type {HTMLInputElement|null} */
    #strokeColor = null;
    /** @type {HTMLElement|null} 線の色の欄を包む要素 */
    #strokeColorFrame = null;
    /** @type {HTMLButtonElement|null} */
    #fillToggle = null;
    /** @type {HTMLInputElement|null} */
    #fillColor = null;
    /** @type {HTMLElement|null} 塗りの色の欄を包む要素 */
    #fillColorFrame = null;
    /** @type {HTMLInputElement|null} */
    #strokeWidth = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {StylePanelView|null} 最後に表示した内容（太さの欄の書き戻しに使う） */
    #lastView = null;
    /** @type {OptionBarStyleGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement スタイルのまとまりのルート要素（`#option-style-group`）
     * @param {OptionBarStyleGroupActions} actions 利用者の操作を受け取るコールバック群
     * @throws {Error} コールバックのいずれかが関数でないとき
     */
    constructor(groupElement, actions) {
        const names = [
            'onStrokeToggle',
            'onFillToggle',
            'onStrokeWidthChange',
            'onColorInput',
            'onColorChange',
            'onColorEditEnd'
        ];
        for (const name of names) {
            if (!actions || typeof actions[name] !== 'function') {
                throw new Error(`OptionBarStyleGroup: actions.${name}は関数である必要があります。`);
            }
        }
        this.#actions = actions;

        const find = (id) => (groupElement ? groupElement.querySelector(id) : null);
        this.#strokeToggle = find('#option-stroke-toggle');
        this.#strokeColor = find('#option-stroke-color');
        this.#strokeColorFrame = find('#option-stroke-color-frame');
        this.#fillToggle = find('#option-fill-toggle');
        this.#fillColor = find('#option-fill-color');
        this.#fillColorFrame = find('#option-fill-color-frame');
        this.#strokeWidth = find('#option-stroke-width');

        const elements = [
            this.#strokeToggle, this.#strokeColor, this.#strokeColorFrame,
            this.#fillToggle, this.#fillColor, this.#fillColorFrame,
            this.#strokeWidth
        ];
        if (elements.some((element) => !element)) {
            console.warn('OptionBarStyleGroup: スタイルのまとまりの要素が見つかりません。配線しません。');
            return;
        }
        this.#wire();
        this.#wired = true;
    }

    /**
     * 表示内容を画面へ反映する。配線されていなければ何もしない。
     * @param {StylePanelView} view 表示する内容
     * @returns {void}
     */
    render(view) {
        if (!this.#wired || !view) return;
        this.#lastView = view;

        OptionBarStyleGroup.#renderToggle(this.#strokeToggle, view.stroke);
        OptionBarStyleGroup.#renderToggle(this.#fillToggle, view.fill);
        OptionBarStyleGroup.#renderColor(this.#strokeColor, this.#strokeColorFrame, 'stroke', view.stroke);
        OptionBarStyleGroup.#renderColor(this.#fillColor, this.#fillColorFrame, 'fill', view.fill);

        if (document.activeElement !== this.#strokeWidth) {
            this.#writeBackStrokeWidth();
        }
    }

    /**
     * 各要素のイベントを購読する。
     * @returns {void}
     */
    #wire() {
        const actions = this.#actions;
        this.#strokeToggle.addEventListener('click', () => actions.onStrokeToggle());
        this.#fillToggle.addEventListener('click', () => actions.onFillToggle());

        this.#strokeWidth.addEventListener('change', () => {
            const accepted = actions.onStrokeWidthChange(this.#strokeWidth.value);
            if (accepted === false) {
                this.#writeBackStrokeWidth();
            }
        });
        this.#strokeWidth.addEventListener('blur', () => {
            this.#writeBackStrokeWidth();
        });

        const colorInputs = [
            { element: this.#strokeColor, target: 'stroke' },
            { element: this.#fillColor, target: 'fill' }
        ];
        for (const { element, target } of colorInputs) {
            element.addEventListener('input', () => actions.onColorInput(target, element.value));
            element.addEventListener('change', () => actions.onColorChange(target, element.value));
            element.addEventListener('blur', () => actions.onColorEditEnd());
            element.addEventListener('keydown', () => actions.onColorEditEnd());
        }
    }

    /**
     * 最後に表示した内容で太さの欄の値と`placeholder`を書き戻す（フォーカスの有無は見ない）。
     * @returns {void}
     */
    #writeBackStrokeWidth() {
        const view = this.#lastView;
        if (!view) return;
        if (view.strokeWidth === null) {
            this.#strokeWidth.value = '';
            this.#strokeWidth.placeholder = STROKE_WIDTH_MIXED_PLACEHOLDER;
        } else {
            this.#strokeWidth.value = String(view.strokeWidth);
            this.#strokeWidth.placeholder = '';
        }
    }

    /**
     * ON/OFFのボタンの表示を反映する（`aria-pressed`と`disabled`）。
     * @param {HTMLButtonElement} button 対象のボタン
     * @param {OptionBarColorView} colorView 線または塗りの表示内容
     * @returns {void}
     */
    static #renderToggle(button, colorView) {
        let pressed = 'false';
        if (colorView.enabled === true) {
            pressed = 'true';
        } else if (colorView.enabled === null) {
            pressed = 'mixed';
        }
        button.setAttribute('aria-pressed', pressed);
        button.disabled = colorView.disabled;
    }

    /**
     * 色の欄とそれを包む要素の`data-color-note`・`title`を反映する。値は今の値と違うときだけ代入する。
     * @param {HTMLInputElement} input 色の欄
     * @param {HTMLElement} frameElement 色の欄を包む要素（`data-color-note`を持つ）
     * @param {'stroke'|'fill'} target 色の項目
     * @param {OptionBarColorView} colorView 線または塗りの表示内容
     * @returns {void}
     */
    static #renderColor(input, frameElement, target, colorView) {
        if (input.value !== colorView.color) {
            input.value = colorView.color;
        }
        input.disabled = colorView.disabled;
        frameElement.setAttribute('data-color-note', colorView.colorNote);
        const titles = COLOR_TITLE_TEXT[target];
        input.title = titles[colorView.colorNote] ?? titles[''];
    }
}
