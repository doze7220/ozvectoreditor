/**
 * 責務：ツールバーのオプションバーの「分割」のまとまり（`#option-split-group`）の「分割」「区間を消す」のボタンの押せる・押せないの表示と、
 * 操作のコールバックへの通知を担う。判定・選択状態には関与しない。DOM操作専任。
 */

/**
 * 「分割」のまとまりのボタンの押せる・押せない。
 * `shapes/PathSplitRules.js`のtypedef`SplitAvailability`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} SplitAvailability
 * @property {boolean} split 「分割」を押せるか
 * @property {boolean} deleteSegments 「区間を消す」を押せるか
 */

/**
 * 利用者の操作を受け取るコールバック。
 * @typedef {Object} OptionBarSplitGroupActions
 * @property {() => boolean} onSplit 「分割」ボタンの`click`で呼ばれる（戻り値は本部品では使わない）
 * @property {() => boolean} onDeleteSegments 「区間を消す」ボタンの`click`で呼ばれる（戻り値は本部品では使わない）
 */

/**
 * オプションバーの「分割」のまとまり（「分割」「区間を消す」の2つのボタン）のUI部品。importを持たず、判定・選択状態を持たず、
 * VectorModel・図形・PathSplitEditor・分割の規則を参照しない。持つ状態は配線済みかどうかとボタンの参照だけ。
 *
 * ■ まとまりの構成
 *   - ルート要素は自分の`<div id="option-split-group" class="toolbar-group">`。要素はルート要素内の`querySelector('#id')`で解決する。
 *   - 要素は`#option-split-at-vertices`（「分割」）・`#option-delete-segments`（「区間を消す」）。1つでも欠ければ配線しない。
 *
 * ■ ボタン
 *   - `click`でコールバックを呼ぶだけ（押せない判定は持たない。`disabled`のボタンは`click`が来ない）。押せる・押せないは`render`で当てる。
 *   - `blur`しない・`aria-pressed`を付けない（`core/FocusKeyYieldRules`が`Space`をパンに、`Ctrl`なしのショートカットを今どおりにするため。「直線に」「曲線に」・整列のボタンと同じ）。
 */
export class OptionBarSplitGroup {
    /** @type {HTMLButtonElement|null} 解決済みの「分割」ボタン（配線済みのときのみ） */
    #splitButton = null;
    /** @type {HTMLButtonElement|null} 解決済みの「区間を消す」ボタン（配線済みのときのみ） */
    #deleteButton = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {OptionBarSplitGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。2つのボタンのどちらかが欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 「分割」のまとまりのルート要素（`#option-split-group`）
     * @param {OptionBarSplitGroupActions} actions 利用者の操作を受け取るコールバック
     * @throws {Error} `actions.onSplit`・`actions.onDeleteSegments`のどちらかが関数でないとき
     */
    constructor(groupElement, actions) {
        if (!actions || typeof actions.onSplit !== 'function') {
            throw new Error('OptionBarSplitGroup: actions.onSplitは関数である必要があります。');
        }
        if (typeof actions.onDeleteSegments !== 'function') {
            throw new Error('OptionBarSplitGroup: actions.onDeleteSegmentsは関数である必要があります。');
        }
        this.#actions = actions;

        const splitButton = groupElement ? groupElement.querySelector('#option-split-at-vertices') : null;
        const deleteButton = groupElement ? groupElement.querySelector('#option-delete-segments') : null;
        if (!splitButton || !deleteButton) {
            console.warn('OptionBarSplitGroup: 分割のまとまりの要素が見つからないため、配線しません。');
            return;
        }
        this.#splitButton = splitButton;
        this.#deleteButton = deleteButton;
        splitButton.addEventListener('click', () => {
            this.#actions.onSplit();
        });
        deleteButton.addEventListener('click', () => {
            this.#actions.onDeleteSegments();
        });
        this.#wired = true;
    }

    /**
     * 2つのボタンの押せる・押せないを当てる。配線されていなければ何もしない。
     * @param {SplitAvailability|null|undefined} availability 押せるか（無ければ両方押せない）
     * @returns {void}
     */
    render(availability) {
        if (!this.#wired) return;
        this.#splitButton.disabled = !(availability && availability.split === true);
        this.#deleteButton.disabled = !(availability && availability.deleteSegments === true);
    }
}
