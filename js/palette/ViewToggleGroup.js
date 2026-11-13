/**
 * 責務：ステータスバーの「表示の切り替え」のまとまり（`#view-toggle-group`）の3つのボタンの押し込み（`.active`）の表示と、押下のコールバックへの通知を担う。
 * 表示の状態の持ち主・描画の規則には関与しない。DOM操作専任。
 */

/**
 * ステータスバーに表示する内容（3つの切り替えがそれぞれONか）。
 * `core/DisplayState.js`のtypedef`DisplayStateSnapshot`の一部の写し（二重定義。キー名を変える場合は両方を揃える）。
 * @typedef {Object} ViewToggleView
 * @property {boolean} outline アウトライン表示がONか
 * @property {boolean} darkBackground 背景が黒か
 * @property {boolean} gridVisible グリッドを表示しているか
 */

/**
 * 利用者の操作を受け取るコールバック群。3つとも関数であること。
 * @typedef {Object} ViewToggleGroupActions
 * @property {() => void} onToggleOutline 「アウトライン表示」ボタンの`click`で呼ばれる
 * @property {() => void} onToggleBackground 「背景の白／黒」ボタンの`click`で呼ばれる
 * @property {() => void} onToggleGrid 「グリッドの表示」ボタンの`click`で呼ばれる
 */

/**
 * ボタンの対応表（唯一の定義箇所）。`key`は`ViewToggleView`のキー、`id`はボタンのセレクタ、`action`はコールバック名。
 * @type {ReadonlyArray<{key: keyof ViewToggleView, id: string, action: keyof ViewToggleGroupActions}>}
 */
const TOGGLE_BUTTONS = Object.freeze([
    Object.freeze({ key: 'outline', id: '#view-outline-toggle', action: 'onToggleOutline' }),
    Object.freeze({ key: 'darkBackground', id: '#view-background-toggle', action: 'onToggleBackground' }),
    Object.freeze({ key: 'gridVisible', id: '#view-grid-toggle', action: 'onToggleGrid' })
]);

/**
 * ステータスバーの「表示の切り替え」のまとまりのUI部品。importを持たず、VectorModel・図形データ・DisplayState（持ち主）・
 * 描画の規則を参照しない。受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ まとまりの構成
 *   - 本クラスのルート要素は自分の`<div id="view-toggle-group" class="status-bar-group">`。
 *   - 要素はルート要素内の`querySelector('#id')`で解決する。表示倍率のまとまり等、他のまとまりには触れない。
 *   - 押し込みは`.active`のみで表す（`aria-pressed`は付けない）。
 */
export class ViewToggleGroup {
    /** @type {Array<{key: string, button: HTMLButtonElement}>} 解決済みのボタン（配線済みのときのみ要素を持つ） */
    #buttons = [];
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {ViewToggleGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 表示の切り替えのまとまりのルート要素（`#view-toggle-group`）
     * @param {ViewToggleGroupActions} actions 利用者の操作を受け取るコールバック群
     * @throws {Error} コールバックのいずれかが関数でないとき
     */
    constructor(groupElement, actions) {
        for (const { action } of TOGGLE_BUTTONS) {
            if (!actions || typeof actions[action] !== 'function') {
                throw new Error(`ViewToggleGroup: actions.${action}は関数である必要があります。`);
            }
        }
        this.#actions = actions;

        const resolved = TOGGLE_BUTTONS.map((entry) => ({
            entry,
            button: groupElement ? groupElement.querySelector(entry.id) : null
        }));
        if (resolved.some(({ button }) => !button)) {
            console.warn('ViewToggleGroup: 表示の切り替えのまとまりの要素が見つからないため、配線しません。');
            return;
        }

        for (const { entry, button } of resolved) {
            button.addEventListener('click', () => this.#actions[entry.action]());
            this.#buttons.push({ key: entry.key, button });
        }
        this.#wired = true;
    }

    /**
     * 3つのボタンの押し込み（`.active`）を表示する。配線されていなければ何もしない。
     * @param {ViewToggleView} view 切り替えごとのON/OFF（`true`のときだけ押し込み）
     * @returns {void}
     */
    render(view) {
        if (!this.#wired) return;
        for (const { key, button } of this.#buttons) {
            button.classList.toggle('active', !!view && view[key] === true);
        }
    }
}
