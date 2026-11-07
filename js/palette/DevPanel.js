/**
 * 責務: 開発者向け確認用ウィンドウ（`#window-dev-panel`）のDOM操作専任。ボタンのclickで注入されたコールバック（変換・復元）を呼び、
 * その結果をテキスト欄・結果表示欄へ表示する。VectorModel・InputTracker・DocumentSerializer・図形データには一切関与しない。
 */

/**
 * 復元（`onImport`）の結果の要約。呼び出し側（`main.js`）が組み立て、DevPanelは表示のみを行う。
 * @typedef {Object} ImportSummary
 * @property {boolean} ok 全体の読み込みに成功したか（falseならキャンバスは変更されていない）
 * @property {number} restoredCount 復元した図形の数（ok=falseなら0）
 * @property {number} reassignedCount idを振り直した図形の数（ok=falseなら0）
 * @property {Array<{index: number, type: string|null, reason: string}>} skipped スキップした図形（ok=falseなら空配列）
 * @property {string|null} error 全体の読み込み失敗の理由（ok=trueならnull）
 */

/**
 * 確認用ウィンドウのコールバック群。
 * @typedef {Object} DevPanelActions
 * @property {() => string} onExport 作業データ形式のJSON文字列を返す
 * @property {(text: string) => ImportSummary} onImport JSON文字列から図形一式を復元し、結果の要約を返す
 */

/**
 * 開発者向け確認用ウィンドウの自己完結UI部品。「JSONへ変換」「JSONから復元」の2ボタンと、×ボタンによる閉じ操作（ルート要素へ`hidden`を付与）を配線し、
 * 変換・復元の実体は注入されたコールバックへ委譲する。受け取るのは文字列と要約オブジェクトのみで、
 * 作業データの中身（図形数等）は解釈しない。
 */
export class DevPanel {
    /**
     * @type {HTMLElement} 確認用ウィンドウのルート要素（`#window-dev-panel`）。show時の`hidden`解除対象、および×で閉じるときの`hidden`付与対象。
     * @private
     */
    #rootElement;

    /**
     * @type {HTMLTextAreaElement|null} JSONの表示・入力欄（`#dev-json`）。見つからなければnull。
     * @private
     */
    #jsonTextArea;

    /**
     * @type {HTMLElement|null} 結果表示欄（`#dev-result`）。見つからなければnull。
     * @private
     */
    #resultElement;

    /**
     * @type {DevPanelActions} 変換・復元のコールバック群。
     * @private
     */
    #actions;

    /**
     * ルート要素内の`#dev-export`・`#dev-import`・`#dev-json`・`#dev-result`を解決し、2ボタンのclickを配線する。
     * いずれかの要素が見つからない場合は`console.warn`で報告し、2ボタンの配線は行わない。
     * 見出しの×ボタン（`.window-close-btn`）のclickでルート要素を閉じる（`hidden`を付ける）配線も行う。
     * ×ボタンが見つからなくても他の配線は行う（`console.warn`のみ）。開き直す手段は設けない。
     * @param {HTMLElement} rootElement 確認用ウィンドウのルート要素（`#window-dev-panel`）
     * @param {DevPanelActions} actions 変換・復元のコールバック群
     */
    constructor(rootElement, actions) {
        this.#rootElement = rootElement;
        this.#actions = actions;
        this.#jsonTextArea = rootElement.querySelector('#dev-json');
        this.#resultElement = rootElement.querySelector('#dev-result');
        const exportBtn = rootElement.querySelector('#dev-export');
        const importBtn = rootElement.querySelector('#dev-import');

        const closeBtn = rootElement.querySelector('.window-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                this.#rootElement.hidden = true;
            });
        } else {
            console.warn('DevPanel: 確認用ウィンドウの×ボタン（.window-close-btn）が見つかりません。');
        }

        if (!this.#jsonTextArea || !this.#resultElement || !exportBtn || !importBtn) {
            console.warn('DevPanel: 確認用ウィンドウの要素（#dev-export / #dev-import / #dev-json / #dev-result）が見つかりません。配線しません。');
            return;
        }

        exportBtn.addEventListener('click', () => this.#handleExport());
        importBtn.addEventListener('click', () => this.#handleImport());
    }

    /**
     * 確認用ウィンドウを表示する（ルート要素の`hidden`属性を解除する）。
     */
    show() {
        this.#rootElement.hidden = false;
    }

    /**
     * 「JSONへ変換」：`onExport()`の戻り値をテキスト欄へ表示し、結果表示欄に完了を表示する。
     * @private
     */
    #handleExport() {
        this.#jsonTextArea.value = this.#actions.onExport();
        this.#resultElement.textContent = 'JSONへ変換しました';
    }

    /**
     * 「JSONから復元」：テキスト欄の文字列を`onImport(text)`へ渡し、返された要約を結果表示欄へ表示する。
     * @private
     */
    #handleImport() {
        const summary = this.#actions.onImport(this.#jsonTextArea.value);
        this.#resultElement.textContent = DevPanel.#formatImportSummary(summary);
    }

    /**
     * 復元の要約を結果表示欄用の文字列へ整形する。
     * 成功：復元した図形数・振り直したid数・スキップ件数と、スキップ1件ごとの行「#index type: reason」。
     * 失敗：「読み込み失敗：理由（キャンバスは変更していません）」。
     * @param {ImportSummary} summary 復元の要約
     * @returns {string} 結果表示欄に表示する文字列
     * @private
     */
    static #formatImportSummary(summary) {
        if (!summary.ok) {
            return `読み込み失敗：${summary.error}（キャンバスは変更していません）`;
        }
        const lines = [
            `復元した図形：${summary.restoredCount}個`,
            `振り直したid：${summary.reassignedCount}件`,
            `スキップ：${summary.skipped.length}件`,
            ...summary.skipped.map(({ index, type, reason }) => `  #${index} ${type ?? '(種別なし)'}: ${reason}`),
        ];
        return lines.join('\n');
    }
}
