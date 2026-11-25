/**
 * 責務：右端の図形の一覧のパネル（`#item-list-panel`内の`#item-list`）の行の表示（差分の反映）・スクロール・サムネイル用`<canvas>`の提供を担う。
 * 図形・VectorModel・状態の持ち主には関与しない。DOM操作と通知だけ。
 */

/**
 * 一覧の1行の表示内容。
 * @typedef {Object} ItemListRowView
 * @property {string} id アイテムのid（図形は図形のid、フォルダはフォルダのid）
 * @property {string} name 表示する名前
 * @property {boolean} selected 選ばれているか（強い見た目）
 * @property {boolean} insertTarget 描き込む先の印を出すか
 * @property {'shape'|'group'} [kind] 行の種類（省けば`'shape'`）
 * @property {number} [indent] 字下げ（px。省けば0）
 * @property {boolean} [collapsed] フォルダが閉じているか（省けば偽。フォルダの行だけ使う）
 * @property {boolean} [canToggle] 三角を押せるか（省けば偽。偽なら三角は見えない。フォルダの行だけ使う）
 * @property {boolean} [selectedInGroup] 上のフォルダが選ばれているか（弱い見た目。省けば偽）
 * @property {boolean} [hiddenMark] 閉じたフォルダの中に選択・描き込む先の印があるか（省けば偽）
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
 * @property {'shape'|'group'} kind 行の種類
 * @property {HTMLCanvasElement|null} canvas サムネイルの`<canvas>`（フォルダの行は`null`）
 * @property {HTMLSpanElement|null} toggleElement 三角の`<span class="item-row-toggle">`（図形の行は`null`）
 * @property {HTMLSpanElement} nameElement 名前の`<span>`
 * @property {string} name 表示中の名前
 * @property {boolean} selected 表示中の選択
 * @property {boolean} insertTarget 表示中の描き込む先の印
 * @property {boolean} selectedInGroup 表示中の弱い選択
 * @property {boolean} hiddenMark 表示中の見えない行の印
 * @property {number} indent 表示中の字下げ（px）
 * @property {boolean|null} collapsed 表示中の折りたたみ（フォルダの行。`null`は未描画で、最初の`render`で必ず書く）
 * @property {boolean|null} canToggle 表示中の三角の有無（フォルダの行。`null`は未描画で、最初の`render`で必ず書く）
 */

/**
 * 一覧の箱の位置と寸法（行のドラッグのドロップ位置・自動スクロールの計算用。クライアント座標px）。
 * @typedef {Object} ItemListArea
 * @property {number} left 箱の左端
 * @property {number} right 箱の右端
 * @property {number} top 箱の上端
 * @property {number} height 見えている高さ（`clientHeight`）
 * @property {number} scrollTop スクロール位置
 * @property {number} maxScrollTop スクロールできる最大の位置（0以上）
 * @property {number} rowHeight 1行の高さ（行が無ければ0）
 */

/**
 * 編集中の名前の欄の控え。
 * @typedef {Object} ItemListNameEdit
 * @property {string} id 編集中の行のid
 * @property {HTMLInputElement} input 名前の欄
 */

/**
 * コンストラクタの設定。
 * @typedef {Object} ItemListPanelOptions
 * @property {number} thumbnailSize サムネイルのCSS上の大きさ（正方形の一辺、px）
 * @property {() => void} onScroll 一覧がスクロールされたときに呼ばれる
 * @property {(id: string, event: MouseEvent, isEditingRow: boolean) => void} onRowPress 行の上で`mousedown`されるたびに行のid・`MouseEvent`・その行が名前の編集中かで呼ばれる（名前の欄の中・修飾キー付き・左以外のボタンでも呼ぶ。`preventDefault()`しない）
 * @property {(id: string, event: MouseEvent) => void} onRowClick 行がクリックされたときに行のidと`MouseEvent`で呼ばれる（行の無い所のクリックでは呼ばれない）
 * @property {(id: string|null) => void} onRowHover カーソルが行の上を動いたときにその行のid、行の無い所・一覧の外へ出たときに`null`で呼ばれる
 * @property {(id: string, event: MouseEvent) => void} onNameEditRequest 名前の`<span>`がダブルクリックされたときに行のidと`MouseEvent`で呼ばれる
 * @property {(id: string, text: string) => void} onNameCommit 名前の欄が確定されたときに行のidと欄の文字列で呼ばれる
 * @property {(key: string, isComposing: boolean) => ('commit'|'cancel'|null)} resolveNameEditKey 名前の欄のキーを確定・取りやめ・無関係（`null`）に対応づける規則
 */

/**
 * 図形の一覧のパネルのUI部品。importを持たず、図形・VectorModel・InputTracker・HistoryManagerを参照しない。
 *
 * ■ 行のドラッグの表示
 *   - `setDraggedRows`（行の`dragging`・一覧の`row-dragging`）・`showDropMark`（行の`drop-before`／`drop-after`）はクラスだけを書く。線はCSSの疑似要素で描き、`.item-list`の子に要素を足さない。
 *   - 控えに残ったidの行が`render`で除かれていても失敗しない（行が無ければ飛ばす）。
 *
 * ■ 構成
 *   - ルート要素（`#item-list-panel`）の中の`#item-list`に、行（`<div class="item-row" data-item-id>`）を並べる。
 *   - 図形の行は`<canvas class="item-row-thumbnail">`と`<span class="item-row-name">`。名前は`textContent`・`title`だけで書く。
 *   - フォルダの行は`<span class="item-row-toggle">`（`▸`／`▾`。押せないときは`visibility: hidden`）・`<span class="item-row-folder-icon">`（CSSで描く絵）・`<span class="item-row-name">`（サムネイルは無い）。
 *   - 字下げはカスタムプロパティ`--row-indent`で行の左の余白に足す。弱い選択は`selected-in-group`、見えない行の印は`has-hidden-mark`のクラスで書く。
 *   - `render`は差分だけをDOMへ反映する（行の要素はidごとに持ち回る。同じidで種類が変わったときだけ作り直す）。
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
    /** @type {(id: string, event: MouseEvent, isEditingRow: boolean) => void} */
    #onRowPress;
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
    /** @type {Set<string>} `dragging`を書いている行のid */
    #draggedIds = new Set();
    /** @type {{id: string, edge: 'before'|'after'}|null} 線を出している行と側 */
    #dropMark = null;

    /**
     * 要素を解決してイベントを配線する。要素が欠ければ`console.warn`して配線しない（以後の公開メソッドは何もしない）。
     * @param {HTMLElement} rootElement パネルのルート要素（`#item-list-panel`）
     * @param {ItemListPanelOptions} options 設定
     * @throws {Error} `onScroll`・`onRowPress`・`onRowClick`・`onRowHover`・`onNameEditRequest`・`onNameCommit`・`resolveNameEditKey`のいずれかが関数でないとき
     */
    constructor(rootElement, options) {
        if (!options || typeof options.onScroll !== 'function') {
            throw new Error('ItemListPanel: options.onScrollは関数である必要があります。');
        }
        if (typeof options.onRowPress !== 'function') {
            throw new Error('ItemListPanel: options.onRowPressは関数である必要があります。');
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
        this.#onRowPress = options.onRowPress;
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
            const id = this.#findRowId(event);
            if (id !== null) this.#onRowPress(id, event, this.#editing !== null && this.#editing.id === id);
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
     * 行を差分で反映する。無くなった行を除き、足りない行を作り（種類が変わった行は作り直し）、変わった名前・選択・印・字下げ・三角だけ書き、並びが違うときだけ並べ替える。
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
            const kind = row.kind === 'group' ? 'group' : 'shape';
            let entry = this.#rows.get(row.id);
            if (entry && entry.kind !== kind) {
                // 同じidで種類が変わった：編集中なら先に控えを捨ててから（除いたときのblurで確定させない）作り直す
                if (this.#editing && this.#editing.id === row.id) this.#editing = null;
                entry.element.remove();
                this.#rows.delete(row.id);
                entry = undefined;
            }
            if (!entry) {
                entry = this.#createRow(row.id, kind);
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
            const selectedInGroup = row.selectedInGroup === true;
            if (entry.selectedInGroup !== selectedInGroup) {
                entry.element.classList.toggle('selected-in-group', selectedInGroup);
                entry.selectedInGroup = selectedInGroup;
            }
            const hiddenMark = row.hiddenMark === true;
            if (entry.hiddenMark !== hiddenMark) {
                entry.element.classList.toggle('has-hidden-mark', hiddenMark);
                entry.hiddenMark = hiddenMark;
            }
            const indent = typeof row.indent === 'number' ? row.indent : 0;
            if (entry.indent !== indent) {
                entry.element.style.setProperty('--row-indent', `${indent}px`);
                entry.indent = indent;
            }
            if (kind === 'group') {
                const collapsed = row.collapsed === true;
                if (entry.collapsed !== collapsed) {
                    entry.toggleElement.textContent = collapsed ? '▸' : '▾';
                    entry.collapsed = collapsed;
                }
                const canToggle = row.canToggle === true;
                if (entry.canToggle !== canToggle) {
                    entry.toggleElement.style.visibility = canToggle ? '' : 'hidden';
                    entry.canToggle = canToggle;
                }
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
     * 表示中の選ばれた行（強い・弱いの両方）のidを上から返す。
     * @returns {string[]} `selected`か`selected-in-group`の行のid
     */
    getSelectedRowIds() {
        if (!this.#wired) return [];
        const ids = [];
        for (const element of this.#list.children) {
            if (element.classList.contains('selected') || element.classList.contains('selected-in-group')) {
                ids.push(element.dataset.itemId);
            }
        }
        return ids;
    }

    /**
     * 今の表示で、描き込む先の印か見えない行の印を出している最初の（上から）行のidを返す。
     * @returns {string|null} 印の行のid（無ければ`null`）
     */
    getMarkedRowId() {
        if (!this.#wired) return null;
        for (const element of this.#list.children) {
            if (element.classList.contains('insert-target') || element.classList.contains('has-hidden-mark')) {
                return element.dataset.itemId;
            }
        }
        return null;
    }

    /**
     * 動かしている行のクラスを書き換える（今までの分は消す）。一覧には`row-dragging`を付ける。空なら全部消す。一覧に無い行のidは飛ばす。
     * @param {string[]} ids 動かしている行のid
     * @returns {void}
     */
    setDraggedRows(ids) {
        if (!this.#wired) return;
        for (const id of this.#draggedIds) {
            const entry = this.#rows.get(id);
            if (entry) entry.element.classList.remove('dragging');
        }
        this.#draggedIds = new Set();
        for (const id of ids) {
            const entry = this.#rows.get(id);
            if (!entry) continue;
            entry.element.classList.add('dragging');
            this.#draggedIds.add(id);
        }
        this.#list.classList.toggle('row-dragging', this.#draggedIds.size > 0);
    }

    /**
     * 入る場所の線を出す行を切り替える（今までの線は消す）。`null`・一覧に無い行なら消すだけ。
     * @param {{id: string, edge: 'before'|'after'}|null} mark 線を出す行と側（`before`＝行の上端、`after`＝行の下端）
     * @returns {void}
     */
    showDropMark(mark) {
        if (!this.#wired) return;
        if (this.#dropMark) {
            const previous = this.#rows.get(this.#dropMark.id);
            if (previous) previous.element.classList.remove('drop-before', 'drop-after');
            this.#dropMark = null;
        }
        if (!mark) return;
        const entry = this.#rows.get(mark.id);
        if (!entry) return;
        entry.element.classList.add(mark.edge === 'before' ? 'drop-before' : 'drop-after');
        this.#dropMark = { id: mark.id, edge: mark.edge };
    }

    /**
     * 一覧の箱の位置と寸法を返す（クライアント座標px）。
     * @returns {ItemListArea} 配線されていなければ全て0
     */
    getListArea() {
        if (!this.#wired) {
            return { left: 0, right: 0, top: 0, height: 0, scrollTop: 0, maxScrollTop: 0, rowHeight: 0 };
        }
        const list = this.#list;
        const rect = list.getBoundingClientRect();
        const first = list.firstElementChild;
        return {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            height: list.clientHeight,
            scrollTop: list.scrollTop,
            maxScrollTop: Math.max(0, list.scrollHeight - list.clientHeight),
            rowHeight: first ? first.offsetHeight : 0
        };
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
     * @param {string} id アイテムのid
     * @returns {HTMLCanvasElement|null} 行が無い・フォルダの行なら`null`
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
     * 1行の要素を作る（名前・選択等は未設定。`render`が書く）。
     * @param {string} id アイテムのid
     * @param {'shape'|'group'} kind 行の種類
     * @returns {ItemListRowEntry} 行の控え
     */
    #createRow(id, kind) {
        const element = document.createElement('div');
        element.className = kind === 'group' ? 'item-row item-row-group' : 'item-row';
        element.dataset.itemId = id;

        const nameElement = document.createElement('span');
        nameElement.className = 'item-row-name';

        let canvas = null;
        let toggleElement = null;
        if (kind === 'group') {
            toggleElement = document.createElement('span');
            toggleElement.className = 'item-row-toggle';
            const icon = document.createElement('span');
            icon.className = 'item-row-folder-icon';
            element.append(toggleElement, icon, nameElement);
        } else {
            canvas = document.createElement('canvas');
            canvas.className = 'item-row-thumbnail';
            canvas.style.width = `${this.#thumbnailSize}px`;
            canvas.style.height = `${this.#thumbnailSize}px`;
            element.append(canvas, nameElement);
        }
        return {
            element,
            kind,
            canvas,
            toggleElement,
            nameElement,
            name: null,
            selected: false,
            insertTarget: false,
            selectedInGroup: false,
            hiddenMark: false,
            indent: 0,
            collapsed: null,
            canToggle: null
        };
    }
}
