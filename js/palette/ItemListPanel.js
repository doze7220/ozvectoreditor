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
 * @property {boolean} insertTarget 描き込む先の印を出すか
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
 * @property {boolean} insertTarget 表示中の描き込む先の印
 */

/**
 * 編集中の名前の欄の控え。
 * @typedef {Object} ItemListNameEdit
 * @property {string} id 編集中の行の図形id
 * @property {HTMLInputElement} input 名前の欄
 */

/**
 * コンストラクタの設定。
 * @typedef {Object} ItemListPanelOptions
 * @property {number} thumbnailSize サムネイルのCSS上の大きさ（正方形の一辺、px）
 * @property {() => void} onScroll 一覧がスクロールされたときに呼ばれる
 * @property {(id: string, event: MouseEvent) => void} onRowClick 行がクリックされたときに行のidと`MouseEvent`で呼ばれる（行の無い所のクリックでは呼ばれない）
 * @property {(id: string|null) => void} onRowHover カーソルが行の上を動いたときにその行のid、行の無い所・一覧の外へ出たときに`null`で呼ばれる
 * @property {(id: string, event: MouseEvent) => void} onNameEditRequest 名前の`<span>`がダブルクリックされたときに行のidと`MouseEvent`で呼ばれる
 * @property {(id: string, text: string) => void} onNameCommit 名前の欄が確定されたときに行のidと欄の文字列で呼ばれる
 * @property {(key: string, isComposing: boolean) => ('commit'|'cancel'|null)} resolveNameEditKey 名前の欄のキーを確定・取りやめ・無関係（`null`）に対応づける規則
 */

/**
 * 図形の一覧のパネルのUI部品。importを持たず、図形・VectorModel・InputTracker・HistoryManagerを参照しない。
 *
 * ■ 構成
 *   - ルート要素（`#item-list-panel`）の中の`#item-list`に、行（`<div class="item-row" data-item-id>`）を並べる。
 *   - 行は`<canvas class="item-row-thumbnail">`と`<span class="item-row-name">`。名前は`textContent`・`title`だけで書く。
 *   - `render`は差分だけをDOMへ反映する（行の要素はidごとに持ち回り、作り直さない）。
 *   - 名前の編集は行に`<input>`を足して行う。確定・取りやめの出口は`#finishNameEdit`の1つ。編集中の行の要素はDOMの中で動かさない。
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
    /** @type {(id: string, event: MouseEvent) => void} */
    #onRowClick;
    /** @type {(id: string|null) => void} */
    #onRowHover;
    /** @type {(id: string, event: MouseEvent) => void} */
    #onNameEditRequest;
    /** @type {(id: string, text: string) => void} */
    #onNameCommit;
    /** @type {(key: string, isComposing: boolean) => ('commit'|'cancel'|null)} */
    #resolveNameEditKey;
    /** @type {Map<string, ItemListRowEntry>} id→行の控え */
    #rows = new Map();
    /** @type {ItemListNameEdit|null} 編集中の名前の欄の控え（編集中でなければ`null`） */
    #editing = null;
    /** @type {boolean} 直近の`mousedown`が名前の欄の中で始まったか */
    #mouseDownInInput = false;

    /**
     * 要素を解決してイベントを配線する。要素が欠ければ`console.warn`して配線しない（以後の公開メソッドは何もしない）。
     * @param {HTMLElement} rootElement パネルのルート要素（`#item-list-panel`）
     * @param {ItemListPanelOptions} options 設定
     * @throws {Error} `onScroll`・`onRowClick`・`onRowHover`・`onNameEditRequest`・`onNameCommit`・`resolveNameEditKey`のいずれかが関数でないとき
     */
    constructor(rootElement, options) {
        if (!options || typeof options.onScroll !== 'function') {
            throw new Error('ItemListPanel: options.onScrollは関数である必要があります。');
        }
        if (typeof options.onRowClick !== 'function') {
            throw new Error('ItemListPanel: options.onRowClickは関数である必要があります。');
        }
        if (typeof options.onRowHover !== 'function') {
            throw new Error('ItemListPanel: options.onRowHoverは関数である必要があります。');
        }
        if (typeof options.onNameEditRequest !== 'function') {
            throw new Error('ItemListPanel: options.onNameEditRequestは関数である必要があります。');
        }
        if (typeof options.onNameCommit !== 'function') {
            throw new Error('ItemListPanel: options.onNameCommitは関数である必要があります。');
        }
        if (typeof options.resolveNameEditKey !== 'function') {
            throw new Error('ItemListPanel: options.resolveNameEditKeyは関数である必要があります。');
        }
        this.#onScroll = options.onScroll;
        this.#onRowClick = options.onRowClick;
        this.#onRowHover = options.onRowHover;
        this.#onNameEditRequest = options.onNameEditRequest;
        this.#onNameCommit = options.onNameCommit;
        this.#resolveNameEditKey = options.resolveNameEditKey;
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
        // クリック・ホバーは.item-listへのイベント委譲。mousedownはpreventDefaultしない（今のキャンバスと同じ、他の欄の確定を妨げない）
        // 名前の欄の中のクリック・ドラッグ（欄から文字を選ぶドラッグの終わりのclick）は行を押したことにしない
        list.addEventListener('mousedown', (event) => {
            this.#mouseDownInInput = this.#isInNameInput(event.target);
        });
        list.addEventListener('click', (event) => {
            const startedInInput = this.#mouseDownInInput;
            this.#mouseDownInInput = false;
            if (startedInInput || this.#isInNameInput(event.target)) return;
            const id = this.#findRowId(event);
            if (id !== null) this.#onRowClick(id, event);
        });
        list.addEventListener('dblclick', (event) => {
            const target = event.target;
            if (!target || typeof target.closest !== 'function' || !target.closest('.item-row-name')) return;
            const id = this.#findRowId(event);
            if (id !== null) this.#onNameEditRequest(id, event);
        });
        list.addEventListener('mousemove', (event) => this.#onRowHover(this.#findRowId(event)));
        list.addEventListener('mouseleave', () => this.#onRowHover(null));
        this.#wired = true;
    }

    /**
     * 行を差分で反映する。無くなった行を除き、足りない行を作り、変わった名前・選択・印だけ書き、並びが違うときだけ並べ替える。
     * @param {ItemListRowView[]} rows 表示する行（先頭＝いちばん上）
     * @returns {void}
     */
    render(rows) {
        if (!this.#wired) return;
        const list = this.#list;

        const nextIds = new Set(rows.map((row) => row.id));
        for (const [id, entry] of this.#rows) {
            if (!nextIds.has(id)) {
                // 編集中の行が無くなった：要素を除く前に控えを捨てる（除いたときのblurで確定させない）
                if (this.#editing && this.#editing.id === id) this.#editing = null;
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
            if (entry.insertTarget !== row.insertTarget) {
                entry.element.classList.toggle('insert-target', row.insertTarget);
                entry.insertTarget = row.insertTarget;
            }
        }

        // 編集中の行の要素はDOMの中で動かさない（動かすとblurが起きて確定してしまう）
        const editingElement = this.#editing ? this.#rows.get(this.#editing.id).element : null;
        let cursor = list.firstChild;
        for (const row of rows) {
            const element = this.#rows.get(row.id).element;
            if (element === cursor) {
                cursor = cursor.nextSibling;
            } else if (element === editingElement) {
                // 編集中の行を固定し、cursorから手前までの行を末尾へ移す（移した行は後で正しい位置に置かれる）
                while (cursor !== editingElement) {
                    const next = cursor.nextSibling;
                    list.appendChild(cursor);
                    cursor = next;
                }
                cursor = editingElement.nextSibling;
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
     * 今の表示で描き込む先の印を出している行のidを返す。
     * @returns {string|null} 印の行のid（無ければ`null`）
     */
    getInsertMarkId() {
        if (!this.#wired) return null;
        for (const [id, entry] of this.#rows) {
            if (entry.insertTarget) return id;
        }
        return null;
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
     * 行の名前を編集する欄を出し、全体を選んだ状態でフォーカスする。編集中なら先に確定する。行が無ければ何もしない。
     * @param {string} id 図形のid
     * @param {string} name 欄に入れる今の名前
     * @returns {void}
     */
    startNameEdit(id, name) {
        if (!this.#wired) return;
        this.#finishNameEdit(true);
        const entry = this.#rows.get(id);
        if (!entry) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'item-row-name-input';
        input.spellcheck = false;
        input.autocomplete = 'off';
        input.value = name;
        input.addEventListener('keydown', (event) => {
            const action = this.#resolveNameEditKey(event.key, event.isComposing);
            if (action === null) return;
            // 欄を消すとフォーカスがbodyへ移り、同じkeydownがdocumentへ届いた時点でテキスト入力中でなくなるため、伝播を止める
            event.preventDefault();
            event.stopPropagation();
            this.#finishNameEdit(action === 'commit');
        });
        input.addEventListener('blur', () => {
            if (this.#editing && this.#editing.input === input) this.#finishNameEdit(true);
        });
        entry.nameElement.hidden = true;
        entry.element.appendChild(input);
        this.#editing = { id, input };
        input.focus();
        input.select();
    }

    /**
     * 編集中の名前の欄を、確定せずに捨てる（編集中でなければ何もしない）。
     * @returns {void}
     */
    cancelNameEdit() {
        this.#finishNameEdit(false);
    }

    /**
     * 名前の編集の唯一の出口。控えを先に`null`にし（欄を除いたときのblurで二重に確定しない）、欄を除いて`<span>`を戻す。
     * @param {boolean} shouldCommit 真なら欄の文字列で`onNameCommit`を呼ぶ
     * @returns {void}
     */
    #finishNameEdit(shouldCommit) {
        const editing = this.#editing;
        if (!editing) return;
        this.#editing = null;
        const text = editing.input.value;
        editing.input.remove();
        const entry = this.#rows.get(editing.id);
        if (entry) entry.nameElement.hidden = false;
        if (shouldCommit) this.#onNameCommit(editing.id, text);
    }

    /**
     * イベントの対象が名前の欄の中かを返す。
     * @param {EventTarget|null} target イベントの対象
     * @returns {boolean} 名前の欄（`.item-row-name-input`）の中なら true
     */
    #isInNameInput(target) {
        return !!target && typeof target.closest === 'function' && !!target.closest('.item-row-name-input');
    }

    /**
     * イベントの対象が含まれる行のidを返す。
     * @param {MouseEvent} event マウスイベント
     * @returns {string|null} 行のid（行の無い所なら`null`）
     */
    #findRowId(event) {
        const target = event.target;
        if (!target || typeof target.closest !== 'function') return null;
        const row = target.closest('.item-row');
        if (!row || !this.#list.contains(row)) return null;
        return row.dataset.itemId ?? null;
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
        return { element, canvas, nameElement, name: null, selected: false, insertTarget: false };
    }
}
