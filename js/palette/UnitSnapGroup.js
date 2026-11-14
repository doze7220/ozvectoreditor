/**
 * 責務：ステータスバーの「スナップ」のまとまり（`#unit-snap-group`）の2つのボタン（ON/OFFの押し込み（`.active`）と、単位のボタンの文字・`title`）の表示と、押下のコールバックへの通知を担う。
 * スナップの設定の持ち主・丸めの規則には関与しない。DOM操作専任。
 */

/**
 * ステータスバーに表示する内容（スナップがONか・今の単位）。
 * `core/UnitSnapSettings.js`のtypedef`UnitSnapSettingsSnapshot`の写し（二重定義。キー名を変える場合は両方を揃える）。
 * @typedef {Object} UnitSnapView
 * @property {boolean} enabled スナップがONか
 * @property {string} unit 今の単位（`'pixel'`または`'grid'`。`UnitSnapUnit`の値の写し）
 * @property {number} unitStep 今の単位の値（OFFでも入る。単位のボタンの文字・`title`に使う）
 */

/**
 * 利用者の操作を受け取るコールバック群。2つとも関数であること。
 * @typedef {Object} UnitSnapGroupActions
 * @property {() => void} onToggleEnabled スナップのON/OFFのボタンの`click`で呼ばれる
 * @property {() => void} onToggleUnit 単位のボタンの`click`で呼ばれる
 */

/**
 * 単位ごとの単位のボタンの`title`の作り方（唯一の定義箇所）。キーは`UnitSnapUnit`の値の写し。
 * 数値は`view.unitStep`から作るため、ここには単位の値を書かない。
 * @type {Readonly<Record<string, (step: number) => string>>}
 */
const UNIT_TITLE_FORMATS = Object.freeze({
    pixel: (step) => `スナップの単位: ${step}px`,
    grid: (step) => `スナップの単位: グリッド (${step}px)`
});

/**
 * ステータスバーの「スナップ」のまとまりのUI部品。importを持たず、スナップの設定の持ち主・丸めの規則・
 * VectorModel・図形データを参照しない。受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ まとまりの構成
 *   - 本クラスのルート要素は自分の`<div id="unit-snap-group" class="status-bar-group">`。
 *   - 要素はルート要素内の`querySelector('#id')`で解決する。他のまとまりには触れない。
 *   - ON/OFFのボタンの押し込みは`.active`のみで表す（`aria-pressed`は付けない）。
 *   - 単位のボタンは押し込みにせず、文字（今の単位の数字）と`title`で状態を表す。
 */
export class UnitSnapGroup {
    /** @type {HTMLButtonElement|null} ON/OFFのボタン（配線済みのときのみ要素を持つ） */
    #enabledButton = null;
    /** @type {HTMLButtonElement|null} 単位のボタン（配線済みのときのみ要素を持つ） */
    #unitButton = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {UnitSnapGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement スナップのまとまりのルート要素（`#unit-snap-group`）
     * @param {UnitSnapGroupActions} actions 利用者の操作を受け取るコールバック群
     * @throws {Error} コールバックのいずれかが関数でないとき
     */
    constructor(groupElement, actions) {
        for (const name of ['onToggleEnabled', 'onToggleUnit']) {
            if (!actions || typeof actions[name] !== 'function') {
                throw new Error(`UnitSnapGroup: actions.${name}は関数である必要があります。`);
            }
        }
        this.#actions = actions;

        const enabledButton = groupElement ? groupElement.querySelector('#unit-snap-toggle') : null;
        const unitButton = groupElement ? groupElement.querySelector('#unit-snap-unit-toggle') : null;
        if (!enabledButton || !unitButton) {
            console.warn('UnitSnapGroup: スナップのまとまりの要素が見つからないため、配線しません。');
            return;
        }

        enabledButton.addEventListener('click', () => this.#actions.onToggleEnabled());
        unitButton.addEventListener('click', () => this.#actions.onToggleUnit());
        this.#enabledButton = enabledButton;
        this.#unitButton = unitButton;
        this.#wired = true;
    }

    /**
     * ON/OFFのボタンの押し込み（`.active`）と、単位のボタンの文字・`title`を表示する。配線されていなければ何もしない。
     * `view`が無いときは押し込みを外すだけで、単位のボタンの文字・`title`は変えない。
     * @param {UnitSnapView} view スナップの設定の表示内容
     * @returns {void}
     */
    render(view) {
        if (!this.#wired) return;
        this.#enabledButton.classList.toggle('active', !!view && view.enabled === true);
        if (!view) return;
        this.#unitButton.textContent = String(view.unitStep);
        this.#unitButton.title = (UNIT_TITLE_FORMATS[view.unit] ?? UNIT_TITLE_FORMATS.pixel)(view.unitStep);
    }
}
