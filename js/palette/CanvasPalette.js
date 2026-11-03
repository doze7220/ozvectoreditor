/**
 * 責務：キャンバスパレット（キャンバス一覧・新規作成・名前の変更・削除・保存状態の表示）のDOM操作を担う自己完結UI部品。
 * 操作の実行は注入されたコールバックへ委譲する。
 */

/**
 * 保存・読み込みの問題（`issue`）ごとの、パレット内の状態表示（`#canvas-notice`）の文言。
 * 対応表はこのファイルにのみ持つ（`CanvasLibrary`は種類のみを返し、文言を知らない）。
 * @type {Readonly<Record<string, string>>}
 */
const ISSUE_MESSAGES = Object.freeze({
    unavailable: 'このブラウザでは保存できません。再読み込みすると編集内容は失われます。',
    writeFailed: '保存に失敗しました。最新の変更は保存されていない可能性があります。',
    loadFailed: 'キャンバスを読み込めませんでした。',
    partialLoad: '一部の図形を読み込めませんでした。編集すると、その図形は保存から失われます。'
});

/** 読み込み中に一覧の代わりに表示する文言。 */
const LOADING_TEXT = '読み込み中…';

/**
 * パレットが受け取る状態（`CanvasLibrary.getState()`の戻り値）。
 * `js/edit/CanvasLibrary.js`のtypedef`CanvasLibraryState`と同じ内容であり、形を変える場合は両方を揃えること。
 * 本クラスが参照するのは`loading`・`busy`・`canManage`・`canvases`・`issue`のみ。
 * @typedef {Object} CanvasLibraryState
 * @property {boolean} loading 起動時の読み込み中か
 * @property {boolean} busy 開く・新規作成・名前の変更・削除・起動時の復元の処理中か
 * @property {boolean} canManage キャンバスの管理操作ができるか（`'unavailable'`でない）
 * @property {string|null} openCanvasId 開いているキャンバスの識別子（読み込み完了前は`null`）
 * @property {string|null} openCanvasName 開いているキャンバスの名前（読み込み完了前は`null`）
 * @property {Array<{id: string, name: string, updatedAt: number, isOpen: boolean}>} canvases
 *     キャンバス一覧（最終更新日時の新しい順。本クラスはこの順のまま表示する）
 * @property {null|'unavailable'|'writeFailed'|'loadFailed'|'partialLoad'} issue 保存・読み込みの問題（無ければ`null`）
 * @property {boolean} hasSaveProblem 保存の問題があるか（本クラスでは使わない）
 */

/**
 * キャンバスパレットの操作コールバック群（`main.js`から注入される）。戻り値（`Promise`）は待たない。
 * @typedef {Object} CanvasPaletteActions
 * @property {(id: string) => *} onOpen 一覧の行の名前が押されたとき、そのキャンバスを開く
 * @property {() => *} onCreate 「＋ 新規作成」が押されたとき、新しいキャンバスを作成して開く
 * @property {(id: string, name: string) => *} onRename 名前の変更の小窓で確定した文字列（未加工）を渡す
 * @property {(id: string) => *} onDelete 削除の確認の小窓で「OK」が押されたとき、そのキャンバスを削除する
 */

/**
 * キャンバスパレット（`#window-canvas-palette`）の自己完結UI部品。importを持たず、
 * `CanvasLibrary`・`VectorModel`・図形データ・IndexedDBを参照しない（受け取るのは`render(state)`の状態とコールバックのみ）。
 *
 * ■ 操作
 *   - 「＋ 新規作成」（`#canvas-create`）の`click`で`onCreate()`。
 *   - 一覧（`#canvas-list`）のクリックは1本のイベント委譲で扱う。行の要素に`data-canvas-id`、
 *     行内のボタンに`data-action`（`'open'`＝名前部分・`'rename'`＝✎・`'delete'`＝🗑）を持たせる。
 *   - 名前の変更：`window.prompt('キャンバス名を入力してください', 現在の名前)`を表示し、キャンセル（`null`）なら何も呼ばない。
 *     それ以外の文字列は加工せず`onRename(id, text)`へ渡す（空文字・空白のみ・最大文字数の判定は`CanvasLibrary`側）。
 *   - 削除：`window.confirm('キャンバス「<名前>」を削除しますか？この操作は取り消せません。')`で「OK」の場合のみ`onDelete(id)`。
 *   - 押されたボタンにフォーカスが残ると`Enter`で再度押されるため、操作の処理前に押されたボタンの`blur()`を呼ぶ。
 *
 * ■ 表示の規則（`render(state)`）
 *   - `loading`：一覧の代わりに「読み込み中…」を表示する。
 *   - `busy || !canManage || loading`：新規作成・各行のボタンを`disabled`属性で押せない状態にする
 *     （見た目は既存の`.tool-btn:disabled`。`.disabled`クラスは使わない）。
 *   - 開いているキャンバス（`isOpen`）の行に`.current`を付ける。行の名前ボタンの`title`に名前全体を設定する。
 *   - 名前は`textContent`のみで設定し、`innerHTML`は使わない（利用者の入力した名前をHTMLとして解釈しないため）。
 *   - `issue`に応じた文言（`ISSUE_MESSAGES`）を`#canvas-notice`へ表示し、`null`（または未知の値）なら`hidden`にする。
 */
export class CanvasPalette {
    /**
     * @type {HTMLButtonElement|null} 新規作成ボタン（`#canvas-create`）。見つからなければnull。
     * @private
     */
    #createButton = null;

    /**
     * @type {HTMLElement|null} 一覧の表示先（`#canvas-list`）。見つからなければnull。
     * @private
     */
    #listElement = null;

    /**
     * @type {HTMLElement|null} 状態表示（`#canvas-notice`）。見つからなければnull。
     * @private
     */
    #noticeElement = null;

    /**
     * @type {CanvasPaletteActions} 操作コールバック群。
     * @private
     */
    #actions;

    /**
     * @type {boolean} 必要な要素がすべて見つかり配線したか（falseなら`render`は何もしない）。
     * @private
     */
    #isWired = false;

    /**
     * @type {Map<string, string>} 直近の`render`で表示したキャンバスの識別子→名前（小窓の文言・初期値に使う）。
     * @private
     */
    #namesById = new Map();

    /**
     * ルート要素内の`#canvas-create`・`#canvas-list`・`#canvas-notice`を解決し、新規作成ボタンと一覧のクリックを配線する。
     * コールバックが関数でなければ`Error`を投げる。要素が1つでも欠ける場合は`console.warn`で報告し、配線しない。
     * @param {HTMLElement|null} rootElement キャンバスパレットのルート要素（`#window-canvas-palette`）
     * @param {CanvasPaletteActions} actions 操作コールバック群
     * @throws {Error} `onOpen`・`onCreate`・`onRename`・`onDelete`のいずれかが関数でない場合
     */
    constructor(rootElement, actions) {
        const { onOpen, onCreate, onRename, onDelete } = actions || {};
        if (typeof onOpen !== 'function' || typeof onCreate !== 'function'
            || typeof onRename !== 'function' || typeof onDelete !== 'function') {
            throw new Error('CanvasPalette: onOpen / onCreate / onRename / onDelete には関数を指定してください。');
        }
        this.#actions = { onOpen, onCreate, onRename, onDelete };

        if (rootElement) {
            this.#createButton = rootElement.querySelector('#canvas-create');
            this.#listElement = rootElement.querySelector('#canvas-list');
            this.#noticeElement = rootElement.querySelector('#canvas-notice');
        }
        if (!this.#createButton || !this.#listElement || !this.#noticeElement) {
            console.warn('CanvasPalette: キャンバスパレットの要素（#canvas-create / #canvas-list / #canvas-notice）が見つかりません。配線しません。');
            return;
        }

        this.#createButton.addEventListener('click', () => this.#handleCreate());
        this.#listElement.addEventListener('click', (event) => this.#handleListClick(event));
        this.#isWired = true;
    }

    /**
     * 状態からキャンバスパレットの表示（一覧・ボタンの押せる/押せない・状態表示）を作り直す。
     * 規則はクラスJSDocの「表示の規則」を参照。配線していない場合は何もしない。
     * @param {CanvasLibraryState} state キャンバス一覧の管理の状態（`CanvasLibrary.getState()`の戻り値）
     */
    render(state) {
        if (!this.#isWired || !state) {
            return;
        }
        const isLocked = Boolean(state.busy || !state.canManage || state.loading);
        this.#createButton.disabled = isLocked;

        this.#namesById = new Map();
        const fragment = document.createDocumentFragment();
        if (state.loading) {
            const loadingElement = document.createElement('div');
            loadingElement.textContent = LOADING_TEXT;
            fragment.appendChild(loadingElement);
        } else {
            const canvases = Array.isArray(state.canvases) ? state.canvases : [];
            for (const canvas of canvases) {
                this.#namesById.set(canvas.id, canvas.name);
                fragment.appendChild(CanvasPalette.#createRow(canvas, isLocked));
            }
        }
        this.#listElement.replaceChildren(fragment);

        const message = state.issue != null && Object.hasOwn(ISSUE_MESSAGES, state.issue)
            ? ISSUE_MESSAGES[state.issue]
            : null;
        this.#noticeElement.textContent = message ?? '';
        this.#noticeElement.hidden = message === null;
    }

    /**
     * 一覧の1行（名前ボタン・✎・🗑）を作る。名前は`textContent`と`title`で設定する。
     * @param {{id: string, name: string, isOpen: boolean}} canvas 一覧の1件
     * @param {boolean} isLocked 行のボタンを押せない状態にするか
     * @returns {HTMLElement} 行の要素（`.canvas-row`。開いているキャンバスなら`.current`）
     * @private
     */
    static #createRow(canvas, isLocked) {
        const row = document.createElement('div');
        row.className = 'canvas-row';
        row.classList.toggle('current', Boolean(canvas.isOpen));
        row.dataset.canvasId = canvas.id;

        const openButton = CanvasPalette.#createButtonElement('tool-btn canvas-row-open', 'open', canvas.name, canvas.name, isLocked);
        const renameButton = CanvasPalette.#createButtonElement('tool-btn canvas-row-btn', 'rename', '✎', '名前の変更', isLocked);
        const deleteButton = CanvasPalette.#createButtonElement('tool-btn canvas-row-btn', 'delete', '🗑', '削除', isLocked);
        row.append(openButton, renameButton, deleteButton);
        return row;
    }

    /**
     * 一覧の行に置くボタンを作る。
     * @param {string} className 付けるクラス（空白区切り）
     * @param {'open'|'rename'|'delete'} action `data-action`に設定する操作の種類
     * @param {string} text ボタンの表示文字列（`textContent`で設定）
     * @param {string} title ボタンの`title`
     * @param {boolean} isDisabled 押せない状態にするか
     * @returns {HTMLButtonElement}
     * @private
     */
    static #createButtonElement(className, action, text, title, isDisabled) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.dataset.action = action;
        button.textContent = text;
        button.title = title;
        button.disabled = isDisabled;
        return button;
    }

    /**
     * 「＋ 新規作成」：押されたボタンのフォーカスを外してから`onCreate()`を呼ぶ（戻り値は待たない）。
     * @private
     */
    #handleCreate() {
        this.#createButton.blur();
        void this.#actions.onCreate();
    }

    /**
     * 一覧のクリックのイベント委譲。押されたボタンの`data-action`と行の`data-canvas-id`から操作を決め、
     * 押されたボタンのフォーカスを外してから処理する。名前の変更・削除は小窓で確定した場合のみコールバックを呼ぶ。
     * @param {MouseEvent} event 一覧で発生したclickイベント
     * @private
     */
    #handleListClick(event) {
        const target = event.target instanceof Element ? event.target : null;
        const button = target ? target.closest('button[data-action]') : null;
        if (!button || !this.#listElement.contains(button) || button.disabled) {
            return;
        }
        const row = button.closest('[data-canvas-id]');
        const id = row ? row.dataset.canvasId : undefined;
        if (typeof id !== 'string' || id === '') {
            return;
        }
        button.blur();

        const name = this.#namesById.get(id) ?? '';
        switch (button.dataset.action) {
            case 'open':
                void this.#actions.onOpen(id);
                break;
            case 'rename': {
                const text = window.prompt('キャンバス名を入力してください', name);
                if (text !== null) {
                    void this.#actions.onRename(id, text);
                }
                break;
            }
            case 'delete':
                if (window.confirm(`キャンバス「${name}」を削除しますか？この操作は取り消せません。`)) {
                    void this.#actions.onDelete(id);
                }
                break;
            default:
                break;
        }
    }
}
