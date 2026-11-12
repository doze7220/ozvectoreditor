/**
 * 責務：プロパティパネルの「図形」の段（`#property-shape-section`）の表示と、利用者の操作（線・塗りの有無、太さ、色）のコールバックへの通知を担う。
 * 図形データ・選択状態には関与しない。DOM操作専任。
 */

/**
 * 色の欄の横の表示の種類。
 * @typedef {'' | 'mixed' | 'unsupported'} PropertyColorNote
 */

/**
 * 線または塗りの表示内容。
 * @typedef {Object} PropertyColorView
 * @property {boolean|null} enabled 有無（`null`は中間表示＝混在）
 * @property {string} color 色の欄にそのまま入れる`#rrggbb`（小文字）
 * @property {PropertyColorNote} colorNote 色の欄の横の表示の種類
 * @property {boolean} disabled 欄を無効にするか
 */

/**
 * パネルに表示する内容。`edit/StylePanelRules.js`のtypedef`StylePanelView`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} StylePanelView
 * @property {'selection' | 'newShape'} source 選択中の図形を表示しているか、次に描く図形を表示しているか
 * @property {number} selectedCount 選択中の図形の数（`newShape`では0）
 * @property {PropertyColorView} stroke 線の表示内容
 * @property {number|null} strokeWidth 線の太さ（`null`は混在）
 * @property {PropertyColorView} fill 塗りの表示内容
 */

/**
 * 利用者の操作を受け取るコールバック群。6つとも関数であること。
 * @typedef {Object} PropertyShapeSectionActions
 * @property {(checked: boolean) => void} onStrokeEnabledChange 線のチェックボックスの`change`で呼ばれる（引数：チェック状態）
 * @property {(checked: boolean) => void} onFillEnabledChange 塗りのチェックボックスの`change`で呼ばれる（引数：チェック状態）
 * @property {(value: string) => boolean} onStrokeWidthChange 太さの欄の`change`（`Enter`・欄から出たとき・矢印の操作）で呼ばれる（引数：欄の文字列）。
 *   戻り値が`false`（受理されなかった）なら、最後に表示した内容で欄の値を書き戻す
 * @property {(target: 'stroke'|'fill', value: string) => void} onColorInput 色の欄の`input`（ピッカーで色を動かしている間）で呼ばれる
 * @property {(target: 'stroke'|'fill', value: string) => void} onColorChange 色の欄の`change`（ピッカーを閉じて確定）で呼ばれる
 * @property {() => void} onColorEditEnd 色の欄の`blur`・`keydown`で呼ばれる（ピッカー操作中の変更の確定の契機）
 */

/** 色の欄の横の表示の文言（`colorNote`→表示文字列。唯一の定義箇所）。 */
const COLOR_NOTE_TEXT = Object.freeze({
    '': '',
    mixed: '混在',
    unsupported: '表示できない色'
});

/** 表示の対象の文言（唯一の定義箇所）。 */
const SOURCE_NEW_SHAPE_TEXT = '次に描く図形';

/** 太さが混在のときの`placeholder`の文言（唯一の定義箇所）。 */
const STROKE_WIDTH_MIXED_PLACEHOLDER = '混在';

/**
 * プロパティパネルの「図形」の段のUI部品。importを持たず、VectorModel・図形データ・選択状態・ShapeStyleEditorを参照しない。
 * 受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ 段の構成
 *   - プロパティパネルは段ごとにUI部品を1つ持つ。本クラスのルート要素は自分の`<section id="property-shape-section">`。
 *   - 要素はルート要素内の`querySelector('#id')`で解決する。後から段（例：頂点の段）を足しても、本クラスは変えない。
 *   - ウィンドウ全体の`.disabled`は使わない。塗りの欄の無効表示は各`input`の`disabled`属性で行う。
 *
 * ■ 表示の規則
 *   - 色の欄は値が今の値と違うときだけ`value`へ代入する。
 *   - 太さの欄は、フォーカスがある間は値を書き換えない。受理されなかったとき・フォーカスが外れたときは最後に表示した内容で書き戻す。
 */
export class PropertyShapeSection {
    /** @type {HTMLElement|null} 表示の対象の要素 */
    #sourceElement = null;
    /** @type {HTMLInputElement|null} */
    #strokeEnabled = null;
    /** @type {HTMLInputElement|null} */
    #strokeColor = null;
    /** @type {HTMLElement|null} */
    #strokeColorNote = null;
    /** @type {HTMLInputElement|null} */
    #strokeWidth = null;
    /** @type {HTMLInputElement|null} */
    #fillEnabled = null;
    /** @type {HTMLInputElement|null} */
    #fillColor = null;
    /** @type {HTMLElement|null} */
    #fillColorNote = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {StylePanelView|null} 最後に表示した内容（太さの欄の書き戻しに使う） */
    #lastView = null;
    /** @type {PropertyShapeSectionActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} sectionElement 「図形」の段のルート要素（`#property-shape-section`）
     * @param {PropertyShapeSectionActions} actions 利用者の操作を受け取るコールバック群
     * @throws {Error} コールバックのいずれかが関数でないとき
     */
    constructor(sectionElement, actions) {
        const names = [
            'onStrokeEnabledChange',
            'onFillEnabledChange',
            'onStrokeWidthChange',
            'onColorInput',
            'onColorChange',
            'onColorEditEnd'
        ];
        for (const name of names) {
            if (!actions || typeof actions[name] !== 'function') {
                throw new Error(`PropertyShapeSection: actions.${name}は関数である必要があります。`);
            }
        }
        this.#actions = actions;

        const find = (id) => (sectionElement ? sectionElement.querySelector(id) : null);
        this.#sourceElement = find('#property-shape-source');
        this.#strokeEnabled = find('#property-stroke-enabled');
        this.#strokeColor = find('#property-stroke-color');
        this.#strokeColorNote = find('#property-stroke-color-note');
        this.#strokeWidth = find('#property-stroke-width');
        this.#fillEnabled = find('#property-fill-enabled');
        this.#fillColor = find('#property-fill-color');
        this.#fillColorNote = find('#property-fill-color-note');

        const elements = [
            this.#sourceElement, this.#strokeEnabled, this.#strokeColor, this.#strokeColorNote,
            this.#strokeWidth, this.#fillEnabled, this.#fillColor, this.#fillColorNote
        ];
        if (elements.some((element) => !element)) {
            console.warn('PropertyShapeSection: 「図形」の段の要素が見つかりません。配線しません。');
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

        this.#sourceElement.textContent = view.source === 'selection'
            ? `選択中：${view.selectedCount}個`
            : SOURCE_NEW_SHAPE_TEXT;

        PropertyShapeSection.#renderToggle(this.#strokeEnabled, view.stroke);
        PropertyShapeSection.#renderToggle(this.#fillEnabled, view.fill);
        PropertyShapeSection.#renderColor(this.#strokeColor, this.#strokeColorNote, view.stroke);
        PropertyShapeSection.#renderColor(this.#fillColor, this.#fillColorNote, view.fill);

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
        this.#strokeEnabled.addEventListener('change', () => {
            actions.onStrokeEnabledChange(this.#strokeEnabled.checked);
        });
        this.#fillEnabled.addEventListener('change', () => {
            actions.onFillEnabledChange(this.#fillEnabled.checked);
        });

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
     * チェックボックスの表示を反映する。
     * @param {HTMLInputElement} checkbox 対象のチェックボックス
     * @param {PropertyColorView} colorView 線または塗りの表示内容
     * @returns {void}
     */
    static #renderToggle(checkbox, colorView) {
        checkbox.checked = colorView.enabled === true;
        checkbox.indeterminate = colorView.enabled === null;
        checkbox.disabled = colorView.disabled;
    }

    /**
     * 色の欄とその横の表示を反映する。値は今の値と違うときだけ代入する。
     * @param {HTMLInputElement} input 色の欄
     * @param {HTMLElement} noteElement 色の欄の横の表示
     * @param {PropertyColorView} colorView 線または塗りの表示内容
     * @returns {void}
     */
    static #renderColor(input, noteElement, colorView) {
        if (input.value !== colorView.color) {
            input.value = colorView.color;
        }
        input.disabled = colorView.disabled;
        noteElement.textContent = COLOR_NOTE_TEXT[colorView.colorNote] ?? '';
    }
}
