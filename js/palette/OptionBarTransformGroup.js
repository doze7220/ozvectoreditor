/**
 * 責務：ツールバーのオプションバーの「変形」のまとまり（`#option-transform-group`）の表示と、角度の欄・基準点・反転の操作のコールバックへの通知を担う。
 * 図形データ・選択状態には関与しない。DOM操作専任。
 */

/**
 * オプションバーの変形のまとまりに表示する内容。`edit/TransformInputRules.js`のtypedef`TransformInputView`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} TransformInputView
 * @property {string} angle 角度の欄に入れる文字列（押せないときは空）
 * @property {string|null} referencePoint 押された見た目にする基準点の名前（無ければ`null`）
 * @property {boolean} disabled 角度の欄・基準点・反転を押せない見た目にするか
 */

/**
 * 利用者の操作を受け取るコールバック。
 * @typedef {Object} OptionBarTransformGroupActions
 * @property {(value: string) => boolean} onAngleChange 角度の欄の`change`で呼ばれる（引数：欄の文字列）。戻り値によらず欄は最後に表示した内容で書き戻される
 * @property {(referencePoint: string) => void} onReferencePointSelect 基準点のボタンが押されたとき呼ばれる（引数：ボタンの`data-reference-point`の値）
 * @property {(axis: 'horizontal'|'vertical') => boolean} onFlip 反転のボタンが押されたとき呼ばれる（戻り値は使わない）
 */

/**
 * 反転の向きの値（`edit/TransformInputRules.js`の`FLIP_AXIS`と同じ文字列の二重定義。importを持たない約束のため。形を変える場合は両方を揃える）。
 */
const FLIP_HORIZONTAL = 'horizontal';
const FLIP_VERTICAL = 'vertical';

/**
 * オプションバーの「変形」のまとまりのUI部品。importを持たず、VectorModel・図形データ・選択状態・TransformInputEditorを参照しない。
 * 受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。基準点の名前は持たず、ボタンの`dataset.referencePoint`を読んで渡すだけ。
 *
 * ■ 表示の規則
 *   - `disabled`・`aria-pressed`は`render`のたびに当てる。角度の欄の値は、フォーカスがある間は書き換えない。
 *   - 角度の欄の`change`のあとは、戻り値によらず最後に表示した内容（`#lastView.angle`）で書き戻す（受理しても欄は0に戻る）。
 *
 * ■ 操作の通知
 *   - 角度の欄の`change`で`onAngleChange(欄の文字列)`、基準点のボタンの`click`で`onReferencePointSelect(名前)`、反転のボタンの`click`で`onFlip(向き)`を呼ぶ。`input`は購読しない。
 */
export class OptionBarTransformGroup {
    /** @type {HTMLInputElement|null} */
    #angleInput = null;
    /** @type {HTMLElement[]} 基準点のボタン（`[data-reference-point]`） */
    #referenceButtons = [];
    /** @type {HTMLElement|null} */
    #flipHorizontalButton = null;
    /** @type {HTMLElement|null} */
    #flipVerticalButton = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {TransformInputView|null} 最後に表示した内容（書き戻しに使う） */
    #lastView = null;
    /** @type {OptionBarTransformGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 変形のまとまりのルート要素（`#option-transform-group`）
     * @param {OptionBarTransformGroupActions} actions 利用者の操作を受け取るコールバック
     * @throws {Error} `onAngleChange`・`onReferencePointSelect`・`onFlip`が関数でないとき
     */
    constructor(groupElement, actions) {
        if (!actions || typeof actions.onAngleChange !== 'function') {
            throw new Error('OptionBarTransformGroup: actions.onAngleChangeは関数である必要があります。');
        }
        if (typeof actions.onReferencePointSelect !== 'function') {
            throw new Error('OptionBarTransformGroup: actions.onReferencePointSelectは関数である必要があります。');
        }
        if (typeof actions.onFlip !== 'function') {
            throw new Error('OptionBarTransformGroup: actions.onFlipは関数である必要があります。');
        }
        this.#actions = actions;

        const find = (id) => (groupElement ? groupElement.querySelector(id) : null);
        this.#angleInput = find('#option-angle');
        this.#flipHorizontalButton = find('#option-flip-horizontal');
        this.#flipVerticalButton = find('#option-flip-vertical');
        this.#referenceButtons = groupElement
            ? Array.from(groupElement.querySelectorAll('[data-reference-point]'))
            : [];

        if (!this.#angleInput || !this.#flipHorizontalButton || !this.#flipVerticalButton
            || this.#referenceButtons.length === 0) {
            console.warn('OptionBarTransformGroup: 変形のまとまりの要素が見つかりません。配線しません。');
            return;
        }
        this.#wire();
        this.#wired = true;
    }

    /**
     * 表示内容を画面へ反映する。配線されていなければ何もしない。
     * @param {TransformInputView} view 表示する内容
     * @returns {void}
     */
    render(view) {
        if (!this.#wired || !view) return;
        this.#lastView = view;
        this.#angleInput.disabled = view.disabled;
        if (document.activeElement !== this.#angleInput) {
            this.#writeBackAngle();
        }
        for (const button of this.#referenceButtons) {
            button.disabled = view.disabled;
            const pressed = !view.disabled && button.dataset.referencePoint === view.referencePoint;
            button.setAttribute('aria-pressed', String(pressed));
        }
        this.#flipHorizontalButton.disabled = view.disabled;
        this.#flipVerticalButton.disabled = view.disabled;
    }

    /**
     * 各要素のイベント（角度の欄の`change`・`blur`、各ボタンの`click`）を購読する。`input`は購読しない。
     * @returns {void}
     */
    #wire() {
        this.#angleInput.addEventListener('change', () => {
            this.#actions.onAngleChange(this.#angleInput.value);
            this.#writeBackAngle();
        });
        this.#angleInput.addEventListener('blur', () => {
            this.#writeBackAngle();
        });
        for (const button of this.#referenceButtons) {
            button.addEventListener('click', () => {
                this.#actions.onReferencePointSelect(button.dataset.referencePoint);
            });
        }
        this.#flipHorizontalButton.addEventListener('click', () => {
            this.#actions.onFlip(FLIP_HORIZONTAL);
        });
        this.#flipVerticalButton.addEventListener('click', () => {
            this.#actions.onFlip(FLIP_VERTICAL);
        });
    }

    /**
     * 最後に表示した内容で、角度の欄の値を書き戻す（フォーカスの有無は見ない）。値が違うときだけ代入する。
     * @returns {void}
     */
    #writeBackAngle() {
        const view = this.#lastView;
        if (!view) return;
        if (this.#angleInput.value !== view.angle) {
            this.#angleInput.value = view.angle;
        }
    }
}
