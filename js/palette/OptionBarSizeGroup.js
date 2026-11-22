/**
 * 責務：ツールバーのオプションバーの「大きさ」のまとまり（`#option-size-group`）の表示と、幅・高さの数値の欄・比率の鍵の操作のコールバックへの通知を担う。
 * 図形データ・選択状態には関与しない。DOM操作専任。
 */

/**
 * オプションバーの大きさのまとまりに表示する内容。`edit/TransformInputRules.js`のtypedef`SizeInputView`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} SizeInputView
 * @property {string} width 幅の欄に入れる文字列（押せないときは空）
 * @property {string} height 高さの欄に入れる文字列（押せないときは空）
 * @property {boolean} widthDisabled 幅の欄を押せない見た目にするか
 * @property {boolean} heightDisabled 高さの欄を押せない見た目にするか
 * @property {boolean} lockDisabled 比率の鍵を押せない見た目にするか
 * @property {boolean} aspectLocked 比率の鍵が掛かっているか
 */

/**
 * 利用者の操作を受け取るコールバック。
 * @typedef {Object} OptionBarSizeGroupActions
 * @property {(axis: 'width'|'height', value: string) => boolean} onSizeChange 幅・高さの欄の`change`で呼ばれる（引数：軸・欄の文字列）。
 *   戻り値が`false`（受理されなかった）なら、最後に表示した内容で欄の値を書き戻す
 * @property {() => void} onAspectLockToggle 比率の鍵のボタンが押されたとき呼ばれる
 */

/**
 * 軸の値（`edit/TransformInputRules.js`の`SIZE_AXIS`と同じ文字列の二重定義。importを持たない約束のため。形を変える場合は両方を揃える）。
 */
const AXIS_WIDTH = 'width';
const AXIS_HEIGHT = 'height';

/**
 * オプションバーの「大きさ」のまとまりのUI部品。importを持たず、VectorModel・図形データ・選択状態・TransformInputEditorを参照しない。
 * 受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ 表示の規則
 *   - `disabled`・`aria-pressed`は`render`のたびに当てる。欄の値は、その欄にフォーカスがある間は書き換えない（打ち込み途中の値が`model.onChange`で消えないため）。
 *   - 受理されなかったとき・フォーカスが外れたときは最後に表示した内容（`#lastView`）で書き戻す。
 *
 * ■ 操作の通知
 *   - 幅・高さの欄の`change`で`onSizeChange(軸, 欄の文字列)`を呼ぶ。`input`は購読しない（確定は`change`のみ）。
 *   - 比率の鍵の`click`で`onAspectLockToggle()`を呼ぶ。
 */
export class OptionBarSizeGroup {
    /** @type {HTMLInputElement|null} */
    #widthInput = null;
    /** @type {HTMLInputElement|null} */
    #heightInput = null;
    /** @type {HTMLElement|null} */
    #lockButton = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {SizeInputView|null} 最後に表示した内容（書き戻しに使う） */
    #lastView = null;
    /** @type {OptionBarSizeGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 大きさのまとまりのルート要素（`#option-size-group`）
     * @param {OptionBarSizeGroupActions} actions 利用者の操作を受け取るコールバック
     * @throws {Error} `onSizeChange`・`onAspectLockToggle`が関数でないとき
     */
    constructor(groupElement, actions) {
        if (!actions || typeof actions.onSizeChange !== 'function') {
            throw new Error('OptionBarSizeGroup: actions.onSizeChangeは関数である必要があります。');
        }
        if (typeof actions.onAspectLockToggle !== 'function') {
            throw new Error('OptionBarSizeGroup: actions.onAspectLockToggleは関数である必要があります。');
        }
        this.#actions = actions;

        const find = (id) => (groupElement ? groupElement.querySelector(id) : null);
        this.#widthInput = find('#option-size-width');
        this.#heightInput = find('#option-size-height');
        this.#lockButton = find('#option-size-lock');

        if (!this.#widthInput || !this.#heightInput || !this.#lockButton) {
            console.warn('OptionBarSizeGroup: 大きさのまとまりの要素が見つかりません。配線しません。');
            return;
        }
        this.#wire();
        this.#wired = true;
    }

    /**
     * 表示内容を画面へ反映する。配線されていなければ何もしない。
     * @param {SizeInputView} view 表示する内容
     * @returns {void}
     */
    render(view) {
        if (!this.#wired || !view) return;
        this.#lastView = view;
        this.#widthInput.disabled = view.widthDisabled;
        this.#heightInput.disabled = view.heightDisabled;
        this.#lockButton.disabled = view.lockDisabled;
        this.#lockButton.setAttribute('aria-pressed', String(view.aspectLocked));
        if (document.activeElement !== this.#widthInput) {
            this.#writeBack(this.#widthInput, view.width);
        }
        if (document.activeElement !== this.#heightInput) {
            this.#writeBack(this.#heightInput, view.height);
        }
    }

    /**
     * 各要素のイベント（欄の`change`・`blur`、鍵の`click`）を購読する。`input`は購読しない。
     * @returns {void}
     */
    #wire() {
        const entries = [
            { element: this.#widthInput, axis: AXIS_WIDTH },
            { element: this.#heightInput, axis: AXIS_HEIGHT }
        ];
        for (const { element, axis } of entries) {
            element.addEventListener('change', () => {
                const accepted = this.#actions.onSizeChange(axis, element.value);
                if (accepted === false) {
                    this.#writeBackAxis(axis);
                }
            });
            element.addEventListener('blur', () => {
                this.#writeBackAxis(axis);
            });
        }
        this.#lockButton.addEventListener('click', () => {
            this.#actions.onAspectLockToggle();
        });
    }

    /**
     * 最後に表示した内容で、軸に対応する欄の値を書き戻す（フォーカスの有無は見ない）。
     * @param {'width'|'height'} axis 軸
     * @returns {void}
     */
    #writeBackAxis(axis) {
        const view = this.#lastView;
        if (!view) return;
        if (axis === AXIS_WIDTH) {
            this.#writeBack(this.#widthInput, view.width);
        } else {
            this.#writeBack(this.#heightInput, view.height);
        }
    }

    /**
     * 欄の値が違うときだけ代入する。
     * @param {HTMLInputElement} input 対象の欄
     * @param {string} text 入れる文字列
     * @returns {void}
     */
    #writeBack(input, text) {
        if (input.value !== text) {
            input.value = text;
        }
    }
}
