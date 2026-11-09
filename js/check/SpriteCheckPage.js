/**
 * 責務: 確認用ページ（sprite-check.html）の起動と、ファイルの選択から表示まで（読み取り→判定→Blob URLの動的import→描画→情報欄・結果の文言）の流れと、表示中のスプライトの保持を担う。
 * 選んだJSはこのページで実行される。
 */
import { SpriteCheckInspector } from './SpriteCheckInspector.js';
import { SpriteCheckCanvas } from './SpriteCheckCanvas.js';

/**
 * 理由の区分→画面に出す文言の対応表（このファイルが唯一の定義箇所）。
 * @type {Readonly<Record<string, string>>}
 */
const FAILURE_MESSAGES = Object.freeze({
    readFailed: 'ファイルを読み取れませんでした。',
    notSprite: '本アプリが出力したスプライトのJSではありません（JSONのファイル・作業ファイルは表示しません。「出力（エンジン用）」で書き出した.jsを選んでください）。',
    unsupportedVersion: '対応していない書き出し形式の版です。',
    importFailed: 'JSとして読み込めませんでした（壊れたファイル、またはJSの読み込み中のエラー）。',
    drawFailed: '描画中にエラーが起きました。',
});

/**
 * 情報欄で値が無いときの表示。
 * @type {string}
 */
const PLACEHOLDER = '—';

/**
 * 解決した要素の一式。
 * @typedef {Object} PageElements
 * @property {HTMLInputElement} fileInput
 * @property {HTMLElement} fileName
 * @property {HTMLElement} formatVersion
 * @property {HTMLElement} sourceVersion
 * @property {HTMLElement} elementCount
 * @property {HTMLElement} bounds
 * @property {HTMLElement} message
 * @property {HTMLElement} canvasArea
 * @property {HTMLCanvasElement} canvas
 */

/**
 * 読み込みの失敗を表す内部の例外（`reason`が理由の区分）。
 */
class CheckFailure extends Error {
    /**
     * @param {string} reason - 理由の区分（`FAILURE_MESSAGES`のキー）
     * @param {*} [cause] - 元の例外
     */
    constructor(reason, cause) {
        super(reason);
        this.reason = reason;
        this.originalError = cause;
    }
}

/**
 * 確認用ページ。ファイル選択から表示までの流れと、表示中のスプライト（既定のexportと外枠の値）を保持する。
 * 公開は起動（`start`）のみ。エディタ本体とは状態を共有しない。
 */
class SpriteCheckPage {
    /** @type {PageElements} */
    #el;
    /** @type {SpriteCheckCanvas} */
    #canvas;
    /** @type {number} 読み込みの連番（最新でない結果を捨てるため） */
    #sequence = 0;
    /** @type {{draw: function(CanvasRenderingContext2D): void}|null} 表示中のスプライト */
    #sprite = null;
    /** @type {{minX: number, minY: number, maxX: number, maxY: number}|null} 表示中の外枠の値 */
    #bounds = null;

    /**
     * @param {PageElements} elements - 解決済みの要素
     */
    constructor(elements) {
        this.#el = elements;
        this.#canvas = new SpriteCheckCanvas(elements.canvas, elements.canvasArea);
    }

    /**
     * イベントを配線し、描画領域を初期化する。
     * @returns {void}
     */
    start() {
        this.#el.fileInput.addEventListener('change', () => {
            this.#handleChange().catch((error) => {
                console.warn('SpriteCheckPage: 予期しないエラー', error);
            });
        });
        window.addEventListener('resize', () => this.#handleResize());
        this.#canvas.resize();
        this.#canvas.clear();
    }

    /**
     * ファイル選択から表示までの流れ。
     * @returns {Promise<void>}
     */
    async #handleChange() {
        const input = this.#el.fileInput;
        const file = input.files && input.files[0];
        if (!file) {
            return;
        }
        input.value = '';
        const seq = ++this.#sequence;
        this.#resetDisplay(file.name);
        this.#el.message.textContent = '読み込み中…';

        try {
            let text;
            try {
                text = await file.text();
            } catch (error) {
                throw new CheckFailure('readFailed', error);
            }
            if (seq !== this.#sequence) {
                return;
            }

            const parsed = SpriteCheckInspector.parseText(text);
            if (parsed.kind === 'json') {
                throw new CheckFailure('notSprite');
            }

            let exported;
            try {
                exported = await this.#importModule(text);
            } catch (error) {
                throw new CheckFailure('importFailed', error);
            }
            if (seq !== this.#sequence) {
                return;
            }

            const inspected = SpriteCheckInspector.inspectModuleExport(exported);
            if (!inspected.ok) {
                throw new CheckFailure(inspected.reason);
            }
            const summary = SpriteCheckInspector.summarize(exported);
            this.#sprite = exported;
            this.#bounds = summary.bounds.state === 'ok'
                ? { minX: summary.bounds.minX, minY: summary.bounds.minY, maxX: summary.bounds.maxX, maxY: summary.bounds.maxY }
                : null;
            try {
                this.#canvas.render(this.#sprite, this.#bounds);
            } catch (error) {
                throw new CheckFailure('drawFailed', error);
            }
            this.#showSummary(summary);
            this.#el.message.textContent = '表示しました';
        } catch (error) {
            if (seq !== this.#sequence) {
                return;
            }
            this.#showFailure(error);
        }
    }

    /**
     * テキストをBlob URLの動的`import`で読み込み、既定のexportを返す（URLは成否にかかわらず解放する）。
     * @param {string} moduleText - JSのテキスト
     * @returns {Promise<*>} 既定のexport
     */
    async #importModule(moduleText) {
        const blob = new Blob([moduleText], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        try {
            const module = await import(url);
            return module.default;
        } finally {
            URL.revokeObjectURL(url);
        }
    }

    /**
     * ウィンドウの大きさの変化に合わせて描画領域を調整し、表示中のスプライトを描き直す。
     * @returns {void}
     */
    #handleResize() {
        this.#canvas.resize();
        if (!this.#sprite) {
            this.#canvas.clear();
            return;
        }
        try {
            this.#canvas.render(this.#sprite, this.#bounds);
        } catch (error) {
            this.#showFailure(new CheckFailure('drawFailed', error));
        }
    }

    /**
     * 前の表示を消して、ファイル名だけを表示する。
     * @param {string} fileName - 選ばれたファイル名
     * @returns {void}
     */
    #resetDisplay(fileName) {
        this.#sprite = null;
        this.#bounds = null;
        this.#canvas.clear();
        this.#el.fileName.textContent = fileName;
        this.#el.formatVersion.textContent = PLACEHOLDER;
        this.#el.sourceVersion.textContent = PLACEHOLDER;
        this.#el.elementCount.textContent = PLACEHOLDER;
        this.#el.bounds.textContent = PLACEHOLDER;
        this.#el.message.textContent = '';
    }

    /**
     * 失敗時の表示（絵・情報欄を消し、理由の文言を出す）。例外の詳細は`console.warn`へ出す。
     * @param {*} error - `CheckFailure`、またはそれ以外の例外
     * @returns {void}
     */
    #showFailure(error) {
        const reason = error instanceof CheckFailure ? error.reason : 'importFailed';
        console.warn('SpriteCheckPage: 読み込めませんでした:', reason, error instanceof CheckFailure ? error.originalError : error);
        this.#sprite = null;
        this.#bounds = null;
        this.#canvas.clear();
        this.#el.formatVersion.textContent = PLACEHOLDER;
        this.#el.sourceVersion.textContent = PLACEHOLDER;
        this.#el.elementCount.textContent = PLACEHOLDER;
        this.#el.bounds.textContent = PLACEHOLDER;
        this.#el.message.textContent = `読み込めませんでした：${FAILURE_MESSAGES[reason]}`;
    }

    /**
     * 情報欄へ要約を表示する（値は丸めず`String()`のまま。`textContent`のみ使う）。
     * @param {import('./SpriteCheckInspector.js').SpriteSummary} summary - 要約
     * @returns {void}
     */
    #showSummary(summary) {
        this.#el.formatVersion.textContent = String(summary.formatVersion);
        this.#el.sourceVersion.textContent = summary.sourceVersion === null ? 'なし' : String(summary.sourceVersion);
        this.#el.elementCount.textContent = summary.elementCount === null ? '不明' : String(summary.elementCount);
        const b = summary.bounds;
        if (b.state === 'none') {
            this.#el.bounds.textContent = '外枠なし（図形0個）';
        } else if (b.state === 'invalid') {
            this.#el.bounds.textContent = '外枠の値を読めません';
        } else {
            this.#el.bounds.textContent =
                `minX ${String(b.minX)} / minY ${String(b.minY)} / maxX ${String(b.maxX)} / maxY ${String(b.maxY)}`
                + `（幅 ${String(b.width)} × 高さ ${String(b.height)}）`;
        }
    }
}

/**
 * 必要な要素を解決する。1つでも欠けたら`null`。
 * @returns {PageElements|null} 解決した要素の一式、または`null`
 */
function resolveElements() {
    const ids = {
        fileInput: 'check-file-input',
        fileName: 'check-file-name',
        formatVersion: 'check-format-version',
        sourceVersion: 'check-source-version',
        elementCount: 'check-element-count',
        bounds: 'check-bounds',
        message: 'check-message',
        canvasArea: 'check-canvas-area',
        canvas: 'check-canvas',
    };
    const elements = {};
    for (const [key, id] of Object.entries(ids)) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`SpriteCheckPage: 要素 #${id} が見つかりません。`);
            return null;
        }
        elements[key] = element;
    }
    return elements;
}

document.addEventListener('DOMContentLoaded', () => {
    const elements = resolveElements();
    if (!elements) {
        return;
    }
    new SpriteCheckPage(elements).start();
});
