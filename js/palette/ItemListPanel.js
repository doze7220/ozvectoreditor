/**
 * 責務：右端の図形の一覧のパネル（`#item-list-panel`内の`#item-list`）の行の表示（差分の反映）・スクロール・サムネイル用`<canvas>`の提供を担う。
 * 図形・VectorModel・状態の持ち主には関与しない。DOM操作と通知だけ。
 */

/**
 * 一覧の1行の表示内容。
 * @typedef {Object} ItemListRowView
 * @property {string} id 図形のid
 * @property {string} name 表示する名前
 * @property {boolean} selected 選ばれているか
 */

/**
 * 一覧の見えている範囲の情報。
 * @typedef {Object} ItemListViewport
 * @property {number} scrollTop スクロール位置（px）
 * @property {number} height 一覧の見えている高さ（`clientHeight`）
 * @property {number} rowHeight 1行の高さ（最初の行の`offsetHeight`。0行なら0）
 */

/**
 * 行ごとの控え。
 * @typedef {Object} ItemListRowEntry
 * @property {HTMLDivElement} element 行の要素
 * @property {HTMLCanvasElement} canvas サムネイルの`<canvas>`
 * @property {HTMLSpanElement} nameElement 名前の`<span>`
 * @property {string} name 表示中の名前
 * @property {boolean} selected 表示中の選択
 */

/**
 * コンストラクタの設定。
 * @typedef {Object} ItemListPanelOptions
 * @property {number} thumbnailSize サムネイルのCSS上の大きさ（正方形の一辺、px）
 * @property {() => void} onScroll 一覧がスクロールされたときに呼ばれる
 */

/**
 * 図形の一覧のパネルのUI部品。importを持たず、図形・VectorModel・InputTracker・HistoryManagerを参照しない。
 *
 * ■ 構成
 *   - ルート要素（`#item-list-panel`）の中の`#item-list`に、行（`<div class="item-row" data-item-id>`）を並べる。
 *   - 行は`<canvas class="item-row-thumbnail">`と`<span class="item-row-name">`。名前は`textContent`・`title`だけで書く。
 *   - `render`は差分だけをDOMへ反映する（行の要素はidごとに持ち回り、作り直さない）。
 */
export class ItemListPanel {
    /** @type {HTMLElement|null} スクロールする一覧の要素（配線済みのときのみ） */
    #list = null;
    /** @type {boolean} 要素がそろい、配線済みか */
    #wired = false;
    /** @type {number} サムネイルのCSS上の大きさ */
    #thumbnailSize;
    /** @type {() => void} */
    #onScroll;
    /** @type {Map<string, ItemListRowEntry>} id→行の控え */
    #rows = new Map();

    /**
     * 要素を解決してイベントを配線する。要素が欠ければ`console.warn`して配線しない（以後の公開メソッドは何もしない）。
     * @param {HTMLElement} rootElement パネルのルート要素（`#item-list-panel`）
     * @param {ItemListPanelOptions} options 設定
     * @throws {Error} `onScroll`が関数でないとき
     */
    constructor(rootElement, options) {
        if (!options || typeof options.onScroll !== 'function') {
            throw new Error('ItemListPanel: options.onScrollは関数である必要があります。');
        }
        this.#onScroll = options.onScroll;
        this.#thumbnailSize = options.thumbnailSize;

        const list = rootElement ? rootElement.querySelector('#item-list') : null;
        if (!list) {
            console.warn('ItemListPanel: 図形の一覧の要素が見つからないため、配線しません。');
            return;
        }
        this.#list = list;
        list.addEventListener('scroll', () => this.#onScroll());
        // スクロールする箱はクリックでフォーカスを受けることがある。キー操作をキャンバス側に残すため自分で手放す
        list.addEventListener('focus', () => list.blur());
        this.#wired = true;
    }

    /**
     * 行を差分で反映する。無くなった行を除き、足りない行を作り、変わった名前・選択だけ書き、並びが違うときだけ並べ替える。
     * @param {ItemListRowView[]} rows 表示する行（先頭＝いちばん上）
     * @returns {void}
     */
    render(rows) {
        if (!this.#wired) return;
        const list = this.#list;

        const nextIds = new Set(rows.map((row) => row.id));
        for (const [id, entry] of this.#rows) {
            if (!nextIds.has(id)) {
                entry.element.remove();
                this.#rows.delete(id);
            }
        }

        for (const row of rows) {
            let entry = this.#rows.get(row.id);
            if (!entry) {
                entry = this.#createRow(row.id);
                this.#rows.set(row.id, entry);
            }
            if (entry.name !== row.name) {
                entry.nameElement.textContent = row.name;
                entry.nameElement.title = row.name;
                entry.name = row.name;
            }
            if (entry.selected !== row.selected) {
                entry.element.classList.toggle('selected', row.selected);
                entry.selected = row.selected;
            }
        }

        let cursor = list.firstChild;
        for (const row of rows) {
            const element = this.#rows.get(row.id).element;
            if (element === cursor) {
                cursor = cursor.nextSibling;
            } else {
                list.insertBefore(element, cursor);
            }
        }
    }

    /**
     * 表示中の選ばれた行のidを上から返す。
     * @returns {string[]} 選ばれた行のid
     */
    getSelectedRowIds() {
        if (!this.#wired) return [];
        const ids = [];
        for (const element of this.#list.children) {
            if (element.classList.contains('selected')) ids.push(element.dataset.itemId);
        }
        return ids;
    }

    /**
     * 見えている範囲の情報を返す。
     * @returns {ItemListViewport} スクロール位置・見えている高さ・1行の高さ
     */
    getViewport() {
        if (!this.#wired) return { scrollTop: 0, height: 0, rowHeight: 0 };
        const first = this.#list.firstElementChild;
        return {
            scrollTop: this.#list.scrollTop,
            height: this.#list.clientHeight,
            rowHeight: first ? first.offsetHeight : 0
        };
    }

    /**
     * スクロール位置を設定する。
     * @param {number} top 設定するスクロール位置（px）
     * @returns {void}
     */
    setScrollTop(top) {
        if (!this.#wired) return;
        this.#list.scrollTop = top;
    }

    /**
     * 行のサムネイルの`<canvas>`を返す。
     * @param {string} id 図形のid
     * @returns {HTMLCanvasElement|null} 無ければ`null`
     */
    getThumbnailCanvas(id) {
        const entry = this.#rows.get(id);
        return entry ? entry.canvas : null;
    }

    /**
     * 1行の要素を作る（名前・選択は未設定。`render`が書く）。
     * @param {string} id 図形のid
     * @returns {ItemListRowEntry} 行の控え
     */
    #createRow(id) {
        const element = document.createElement('div');
        element.className = 'item-row';
        element.dataset.itemId = id;

        const canvas = document.createElement('canvas');
        canvas.className = 'item-row-thumbnail';
        canvas.style.width = `${this.#thumbnailSize}px`;
        canvas.style.height = `${this.#thumbnailSize}px`;

        const nameElement = document.createElement('span');
        nameElement.className = 'item-row-name';

        element.append(canvas, nameElement);
        return { element, canvas, nameElement, name: null, selected: false };
    }
}
