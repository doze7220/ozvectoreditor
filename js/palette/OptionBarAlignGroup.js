/**
 * 責務：ツールバーのオプションバーの「整列・分布」のまとまり（`#option-align-group`）の8つのボタンの押せる/押せないの表示と、押下のコールバックへの通知を担う。
 * 選択状態・整列・分布の規則には関与しない。DOM操作専任。
 */

/**
 * オプションバーに表示する内容（8つの操作それぞれで1pxでも動くか＝ボタンを押せるか）。キーは操作の文字列。
 * `edit/ShapeAlignEditor.js`のtypedef`ShapeAlignAvailability`と同じ内容（二重定義。形を変える場合は両方を揃える）。
 * @typedef {Object} ShapeAlignAvailability
 * @property {boolean} alignLeft 左へそろえる
 * @property {boolean} alignHorizontalCenter 左右中央へそろえる
 * @property {boolean} alignRight 右へそろえる
 * @property {boolean} alignTop 上へそろえる
 * @property {boolean} alignVerticalCenter 上下中央へそろえる
 * @property {boolean} alignBottom 下へそろえる
 * @property {boolean} distributeHorizontal 横方向に均等に並べる
 * @property {boolean} distributeVertical 縦方向に均等に並べる
 */

/**
 * 利用者の操作を受け取るコールバック。コールバックは1つだけ（8つ分を並べない）。
 * @typedef {Object} OptionBarAlignGroupActions
 * @property {(operation: string) => boolean} onAlign いずれかのボタンの`click`で、押されたボタンの操作の文字列を渡して呼ばれる（戻り値は本部品では使わない）
 */

/**
 * ボタンの対応表（唯一の定義箇所。並び＝ボタンの並び）。
 * `operation`は操作の文字列で、`ShapeAlignAvailability`のキー（表示内容のキー）と`onAlign`へ渡す値を兼ねる。
 * `id`はボタンのセレクタ。
 * `operation`の値は`edit/ShapeAlignRules.js`の`ShapeAlignOperation`と同じ内容の二重定義（本部品はimportを持たない約束のため。
 * 形・値を変える場合は両方を揃える。値がずれると表示側が黙って押せない表示になる）。
 * @type {ReadonlyArray<{operation: keyof ShapeAlignAvailability, id: string}>}
 */
const ALIGN_BUTTONS = Object.freeze([
    Object.freeze({ operation: 'alignLeft', id: '#option-align-left' }),
    Object.freeze({ operation: 'alignHorizontalCenter', id: '#option-align-horizontal-center' }),
    Object.freeze({ operation: 'alignRight', id: '#option-align-right' }),
    Object.freeze({ operation: 'alignTop', id: '#option-align-top' }),
    Object.freeze({ operation: 'alignVerticalCenter', id: '#option-align-vertical-center' }),
    Object.freeze({ operation: 'alignBottom', id: '#option-align-bottom' }),
    Object.freeze({ operation: 'distributeHorizontal', id: '#option-distribute-horizontal' }),
    Object.freeze({ operation: 'distributeVertical', id: '#option-distribute-vertical' })
]);

/**
 * オプションバーの「整列・分布」のまとまりのUI部品。importを持たず、状態・判定を持たず、VectorModel・選択集合・図形データ・ShapeAlignEditor・
 * 整列・分布の規則・操作の値（ShapeAlignOperation）を参照しない。受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。
 *
 * ■ まとまりの構成
 *   - オプションバーはまとまりごとにUI部品を1つ持つ。本クラスのルート要素は自分の`<div id="option-align-group" class="toolbar-group">`。
 *   - 要素はルート要素内の`querySelector('#id')`で解決する。既存のまとまり（スタイル・重なり順・位置）・そのUI部品は変えない。隣に別のまとまりを足せる。
 *   - `disabled`のボタンは`click`が来ないため、押せない判定は`click`側では行わない。
 */
export class OptionBarAlignGroup {
    /** @type {Array<{operation: string, button: HTMLButtonElement}>} 解決済みのボタン（配線済みのときのみ要素を持つ） */
    #buttons = [];
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {OptionBarAlignGroupActions} */
    #actions;

    /**
     * 要素を解決してイベントを配線する。要素が1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。
     * @param {HTMLElement} groupElement 「整列・分布」のまとまりのルート要素（`#option-align-group`）
     * @param {OptionBarAlignGroupActions} actions 利用者の操作を受け取るコールバック
     * @throws {Error} `actions.onAlign`が関数でないとき
     */
    constructor(groupElement, actions) {
        if (!actions || typeof actions.onAlign !== 'function') {
            throw new Error('OptionBarAlignGroup: actions.onAlignは関数である必要があります。');
        }
        this.#actions = actions;

        const resolved = ALIGN_BUTTONS.map((entry) => ({
            entry,
            button: groupElement ? groupElement.querySelector(entry.id) : null
        }));
        if (resolved.some(({ button }) => !button)) {
            console.warn('OptionBarAlignGroup: 整列・分布のまとまりの要素が見つからないため、配線しません。');
            return;
        }

        for (const { entry, button } of resolved) {
            button.addEventListener('click', () => this.#actions.onAlign(entry.operation));
            this.#buttons.push({ operation: entry.operation, button });
        }
        this.#wired = true;
    }

    /**
     * 8つのボタンの押せる/押せないを表示する。配線されていなければ何もしない。
     * @param {ShapeAlignAvailability} view 操作ごとの可否（`true`のときだけ押せる）
     * @returns {void}
     */
    render(view) {
        if (!this.#wired) return;
        for (const { operation, button } of this.#buttons) {
            button.disabled = !(view && view[operation] === true);
        }
    }
}
