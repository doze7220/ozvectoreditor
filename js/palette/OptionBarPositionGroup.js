/**
 * 責務：ツールバーのオプションバーの「位置」のまとまり（`#option-position-group`）の表示と、X・Yの数値の欄の操作のコールバックへの通知を担う。
 * 図形データ・選択状態には関与しない。DOM操作専任。
 */

/**
 * オプションバーの位置のまとまりに表示する内容。`edit/PositionInputRules.js`のtypedef`PositionInputView`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} PositionInputView
 * @property {string} x Xの欄に入れる文字列（押せないときは空）
 * @property {string} y Yの欄に入れる文字列（押せないときは空）
 * @property {boolean} disabled 欄を押せない見た目にするか
 */

/**
 * 利用者の操作を受け取るコールバック。
 * @typedef {Object} OptionBarPositionGroupActions
 * @property {(axis: 'x'|'y', value: string) => boolean} onPositionChange X・Yの欄の`change`（`Enter`・欄から出たとき・欄の矢印の操作）で呼ばれる（引数：軸・欄の文字列）。
 *   戻り値が`false`（受理されなかった）なら、最後に表示した内容で欄の値を書き戻す
 */

/**
 * 軸の値（`edit/PositionInputRules.js`の`POSITION_AXIS`と同じ文字列の二重定義。importを持たない約束のため。形を変える場合は両方を揃える）。
 */
const AXIS_X = 'x';
const AXIS_Y = 'y';

/**
 * オプションバーの「位置」のまとまりのUI部品。importを持たず、VectorModel・図形データ・選択状態・PositionInputEditorを参照しない。
 * 受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ 表示の規則
 *   - `disabled`は`render`のたびに当てる。欄の値は、その欄にフォーカスがある間は書き換えない（打ち込み途中の値が`model.onChange`で消えないため）。
 *   - 受理されなかったとき・フォーカスが外れたときは最後に表示した内容（`#lastView`）で書き戻す。
 *
 * ■ 操作の通知
 *   - X・Yの欄の`change`で`onPositionChange(軸, 欄の文字列)`を呼ぶ。
 *   - `input`は購読しない。1文字打つごとに図形が動いたり、取り消しの記録が増えたりしないようにするため（確定は`change`のみ）。
 */
export class OptionBarPositionGroup {
    /** @type {HTMLInputElement|null} */
    #xInput = null;
    /** @type {HTMLInputElement|null} */
    #yInput = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {PositionInputView|null} 最後に表示した内容（書き戻しに使う） */
    #lastView = null;
    /** @type {OptionBarPositionGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 位置のまとまりのルート要素（`#option-position-group`）
     * @param {OptionBarPositionGroupActions} actions 利用者の操作を受け取るコールバック
     * @throws {Error} `onPositionChange`が関数でないとき
     */
    constructor(groupElement, actions) {
        if (!actions || typeof actions.onPositionChange !== 'function') {
            throw new Error('OptionBarPositionGroup: actions.onPositionChangeは関数である必要があります。');
        }
        this.#actions = actions;

        const find = (id) => (groupElement ? groupElement.querySelector(id) : null);
        this.#xInput = find('#option-position-x');
        this.#yInput = find('#option-position-y');

        if (!this.#xInput || !this.#yInput) {
            console.warn('OptionBarPositionGroup: 位置のまとまりの要素が見つかりません。配線しません。');
            return;
        }
        this.#wire();
        this.#wired = true;
    }

    /**
     * 表示内容を画面へ反映する。配線されていなければ何もしない。
     * @param {PositionInputView} view 表示する内容
     * @returns {void}
     */
    render(view) {
        if (!this.#wired || !view) return;
        this.#lastView = view;
        this.#xInput.disabled = view.disabled;
        this.#yInput.disabled = view.disabled;
        if (document.activeElement !== this.#xInput) {
            this.#writeBack(this.#xInput, view.x);
        }
        if (document.activeElement !== this.#yInput) {
            this.#writeBack(this.#yInput, view.y);
        }
    }

    /**
     * 各欄のイベント（`change`・`blur`）を購読する。`input`は購読しない。
     * @returns {void}
     */
    #wire() {
        const entries = [
            { element: this.#xInput, axis: AXIS_X },
            { element: this.#yInput, axis: AXIS_Y }
        ];
        for (const { element, axis } of entries) {
            element.addEventListener('change', () => {
                const accepted = this.#actions.onPositionChange(axis, element.value);
                if (accepted === false) {
                    this.#writeBackAxis(axis);
                }
            });
            element.addEventListener('blur', () => {
                this.#writeBackAxis(axis);
            });
        }
    }

    /**
     * 最後に表示した内容で、軸に対応する欄の値を書き戻す（フォーカスの有無は見ない）。
     * @param {'x'|'y'} axis 軸
     * @returns {void}
     */
    #writeBackAxis(axis) {
        const view = this.#lastView;
        if (!view) return;
        if (axis === AXIS_X) {
            this.#writeBack(this.#xInput, view.x);
        } else {
            this.#writeBack(this.#yInput, view.y);
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
