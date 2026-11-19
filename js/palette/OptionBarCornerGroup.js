/**
 * 責務：ツールバーのオプションバーの「角」のまとまり（`#option-corner-group`）のチェックボックスの表示（チェックあり・なし・「−」・押せない）と、切り替えのコールバックへの通知を担う。
 * 角の判定・選択状態には関与しない。DOM操作専任。
 */

/**
 * 「角」のチェックボックスの表示内容。
 * `shapes/PathCornerRules.js`のtypedef`CornerToggleView`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} CornerToggleView
 * @property {boolean} enabled 押せるか
 * @property {boolean} checked チェックありか（`mixed`が真のときは見た目に使わない）
 * @property {boolean} mixed 角となめらかが混ざっているか（「−」の見た目）
 */

/**
 * 利用者の操作を受け取るコールバック。
 * @typedef {Object} OptionBarCornerGroupActions
 * @property {() => boolean} onCornerToggle チェックボックスの`change`で呼ばれる（戻り値は本部品では使わない）
 */

/**
 * オプションバーの「角」のまとまりのUI部品。importを持たず、判定・選択状態を持たず、VectorModel・図形・PathCornerEditor・角の規則を参照しない。
 * 持つ状態は最後に表示した内容（`#lastView`）だけ。
 *
 * ■ まとまりの構成
 *   - ルート要素は自分の`<div id="option-corner-group" class="toolbar-group">`。要素はルート要素内の`querySelector('#id')`で解決する。
 *
 * ■ `change`のあとの処理
 *   - ブラウザは`change`の前に`checked`を反転し`indeterminate`を外す。受理されれば`model.onChange`の経路で`render`が先に呼ばれて正しい内容になるが、
 *     受理されない（ドラッグ中・変わる点が無い）と`render`が来ず反転した見た目が残るため、コールバックの後に最後の表示内容を当て直す。
 *   - 続けて`blur()`する。フォーカスが残ると、`core/FocusKeyYieldRules`が`Space`をチェックボックスに譲り（パンできず、意図せず切り替わる）、
 *     `Ctrl`なしのショートカット（`V`・`A`・矢印の微調整等）を止めてしまうため。
 */
export class OptionBarCornerGroup {
    /** @type {HTMLInputElement|null} 解決済みのチェックボックス（配線済みのときのみ） */
    #checkbox = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {OptionBarCornerGroupActions} */
    #actions;
    /** @type {CornerToggleView|null|undefined} 最後に表示した内容 */
    #lastView = null;

    /**
     * 要素を解決してイベントを配線する。要素が無ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 「角」のまとまりのルート要素（`#option-corner-group`）
     * @param {OptionBarCornerGroupActions} actions 利用者の操作を受け取るコールバック
     * @throws {Error} `actions.onCornerToggle`が関数でないとき
     */
    constructor(groupElement, actions) {
        if (!actions || typeof actions.onCornerToggle !== 'function') {
            throw new Error('OptionBarCornerGroup: actions.onCornerToggleは関数である必要があります。');
        }
        this.#actions = actions;

        const checkbox = groupElement ? groupElement.querySelector('#option-corner-toggle') : null;
        if (!checkbox) {
            console.warn('OptionBarCornerGroup: 角のまとまりの要素が見つからないため、配線しません。');
            return;
        }
        this.#checkbox = checkbox;
        checkbox.addEventListener('change', () => {
            this.#actions.onCornerToggle();
            this.#applyView(this.#lastView);
            checkbox.blur();
        });
        this.#wired = true;
    }

    /**
     * チェックボックスの表示（押せる/押せない・チェック・「−」）を当てる。配線されていなければ何もしない。
     * @param {CornerToggleView|null|undefined} view 表示内容（無ければ押せない・チェックなし）
     * @returns {void}
     */
    render(view) {
        if (!this.#wired) return;
        this.#lastView = view;
        this.#applyView(view);
    }

    /**
     * 表示内容をチェックボックスへ当てる。
     * @param {CornerToggleView|null|undefined} view 表示内容
     * @returns {void}
     */
    #applyView(view) {
        if (!this.#wired) return;
        const checkbox = this.#checkbox;
        checkbox.disabled = !(view && view.enabled === true);
        checkbox.indeterminate = view?.mixed === true;
        checkbox.checked = view?.checked === true && view?.mixed !== true;
    }
}
