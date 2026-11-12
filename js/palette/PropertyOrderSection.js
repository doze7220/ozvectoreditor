/**
 * 責務：プロパティパネルの「重なり順」の段（`#property-order-section`）の4つのボタンの押せる/押せないの表示と、押下のコールバックへの通知を担う。
 * 選択状態・並べ替えの規則には関与しない。DOM操作専任。
 */

/**
 * パネルに表示する内容（4つの操作それぞれで並びが変わるか＝ボタンを押せるか）。
 * `edit/ShapeOrderEditor.js`のtypedef`ShapeOrderAvailability`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} ShapeOrderAvailability
 * @property {boolean} bringToFront 最前面へ
 * @property {boolean} bringForward 前へ
 * @property {boolean} sendBackward 後ろへ
 * @property {boolean} sendToBack 最背面へ
 */

/**
 * 利用者の操作を受け取るコールバック群。4つとも関数であること。
 * @typedef {Object} PropertyOrderSectionActions
 * @property {() => void} onBringToFront 「最前面へ」ボタンの`click`で呼ばれる
 * @property {() => void} onBringForward 「前へ」ボタンの`click`で呼ばれる
 * @property {() => void} onSendBackward 「後ろへ」ボタンの`click`で呼ばれる
 * @property {() => void} onSendToBack 「最背面へ」ボタンの`click`で呼ばれる
 */

/**
 * ボタンの対応表（唯一の定義箇所）。`key`は`ShapeOrderAvailability`のキー、`id`はボタンのセレクタ、`action`はコールバック名。
 * @type {ReadonlyArray<{key: keyof ShapeOrderAvailability, id: string, action: keyof PropertyOrderSectionActions}>}
 */
const ORDER_BUTTONS = Object.freeze([
    Object.freeze({ key: 'bringToFront', id: '#order-bring-to-front', action: 'onBringToFront' }),
    Object.freeze({ key: 'bringForward', id: '#order-bring-forward', action: 'onBringForward' }),
    Object.freeze({ key: 'sendBackward', id: '#order-send-backward', action: 'onSendBackward' }),
    Object.freeze({ key: 'sendToBack', id: '#order-send-to-back', action: 'onSendToBack' })
]);

/**
 * プロパティパネルの「重なり順」の段のUI部品。importを持たず、VectorModel・選択集合・図形データ・ShapeOrderEditor・
 * 並べ替えの規則・操作の値（ShapeOrderOperation）を参照しない。受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ 段の構成
 *   - プロパティパネルは段ごとにUI部品を1つ持つ。本クラスのルート要素は自分の`<section id="property-order-section">`。
 *   - 要素はルート要素内の`querySelector('#id')`で解決する。既存の段（「図形」の段）・そのUI部品は変えない。
 *   - `disabled`のボタンは`click`が来ないため、押せない判定は`click`側では行わない。
 */
export class PropertyOrderSection {
    /** @type {Array<{key: string, button: HTMLButtonElement}>} 解決済みのボタン（配線済みのときのみ要素を持つ） */
    #buttons = [];
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {PropertyOrderSectionActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} sectionElement 「重なり順」の段のルート要素（`#property-order-section`）
     * @param {PropertyOrderSectionActions} actions 利用者の操作を受け取るコールバック群
     * @throws {Error} コールバックのいずれかが関数でないとき
     */
    constructor(sectionElement, actions) {
        for (const { action } of ORDER_BUTTONS) {
            if (!actions || typeof actions[action] !== 'function') {
                throw new Error(`PropertyOrderSection: actions.${action}は関数である必要があります。`);
            }
        }
        this.#actions = actions;

        const resolved = ORDER_BUTTONS.map((entry) => ({
            entry,
            button: sectionElement ? sectionElement.querySelector(entry.id) : null
        }));
        if (resolved.some(({ button }) => !button)) {
            console.warn('PropertyOrderSection: 「重なり順」の段の要素が見つからないため、配線しません。');
            return;
        }

        for (const { entry, button } of resolved) {
            button.addEventListener('click', () => this.#actions[entry.action]());
            this.#buttons.push({ key: entry.key, button });
        }
        this.#wired = true;
    }

    /**
     * 4つのボタンの押せる/押せないを表示する。配線されていなければ何もしない。
     * @param {ShapeOrderAvailability} view 操作ごとの可否（`true`のときだけ押せる）
     * @returns {void}
     */
    render(view) {
        if (!this.#wired) return;
        for (const { key, button } of this.#buttons) {
            button.disabled = !(view && view[key] === true);
        }
    }
}
