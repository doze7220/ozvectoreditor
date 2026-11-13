/**
 * 責務: ツールパレット（`#window-tool-palette`）内のツールのボタンのclick購読によるツールの選択要求（コールバック経由）と、`setActiveTool(toolId)`による押し込み（`.active`）表示の排他制御を担う。
 * DOM操作専任であり、操作モード・VectorModel・図形データ・選択状態・InputTrackerには一切関与しない（受け取るのはツールの識別子の一覧・コールバック・識別子のみ）。
 */

/**
 * ツールのボタンのDOM idの接頭辞。ツール`toolId`のボタンは`${TOOL_BUTTON_ID_PREFIX}${toolId}`のidで解決する。
 * @type {string}
 */
const TOOL_BUTTON_ID_PREFIX = 'tool-';

/**
 * ツールパレットの自己完結UI部品。ツールの識別子の一覧（コンストラクタ引数）に対応するボタンのclickを
 * ツールの選択要求としてコールバックへ通知し、各ボタンの押し込み表示を外部からの指示に従って切り替える。
 * ウィンドウ全体を非活性にするクラスは無く、ツールパレットは常に押せる。`Tab`・ツールバーのパレットの表示・非表示のボタンでは、
 * 他のフロートウィンドウとまとめて隠される（隠す仕組みは`index.html`のCSSと`main.js`。本クラスは関与しない）。
 */
export class ToolPalette {
    /**
     * @type {Function} ツールの選択要求時に呼び出すコールバック。契約: `onToolSelected(toolId)`（`toolId`は注入された識別子の一覧のいずれか）。
     * @private
     */
    #onToolSelected;

    /**
     * @type {Array<{el: Element, toolId: string}>} 配線済みボタンのDOM要素と対応するツールの識別子の対応表
     * （識別子一覧の並び順。ボタンが見つからなかった識別子は含まない）。setActiveTool時の押し込み表示の排他制御に用いる。
     * @private
     */
    #buttons;

    /**
     * 識別子一覧の各toolIdについて、ルート要素内のid`tool-${toolId}`のボタンを解決してclickリスナーを登録し、
     * クリック時に`onToolSelected(toolId)`を呼び出す配線を行う。照合はこのコンストラクタの1回のみ。
     * ルート要素が無い場合は`console.warn`して何も配線しない（`setActiveTool`は何もしない）。
     * 識別子一覧とDOMの不整合は次の2点を`console.warn`で報告する（いずれも配線はしない）。
     * - 識別子一覧にあるのに、対応するボタンがルート要素内に見つからない識別子
     * - ルート要素内にある`tool-`で始まるidの要素のうち、識別子一覧にないもの
     * @param {Element|null} rootElement ツールパレットのルート要素（`#window-tool-palette`）
     * @param {ReadonlyArray<string>} toolIds ツールの識別子の一覧（正本は`ToolRules.js`の`TOOL_IDS`）
     * @param {Function} onToolSelected ツール選択時に呼び出すコールバック。`onToolSelected(toolId)`の形で呼ばれる
     */
    constructor(rootElement, toolIds, onToolSelected) {
        this.#onToolSelected = onToolSelected;
        this.#buttons = [];

        if (!rootElement) {
            console.warn('ToolPalette: ルート要素が見つかりません。配線しません。');
            return;
        }

        // ルート要素内の`tool-`で始まるid要素をidで引けるようにする（CSSセレクタ文字列を組み立てない）
        const candidates = new Map(
            Array.from(rootElement.querySelectorAll(`[id^="${TOOL_BUTTON_ID_PREFIX}"]`), (el) => [el.id, el])
        );

        toolIds.forEach((toolId) => {
            const id = `${TOOL_BUTTON_ID_PREFIX}${toolId}`;
            const el = candidates.get(id);
            if (el === undefined) {
                console.warn(`ToolPalette: ツール "${toolId}" のボタン（#${id}）が見つかりません。このツールは配線しません。`);
                return;
            }
            candidates.delete(id);
            this.#buttons.push({ el, toolId });
        });

        // 識別子一覧で消費されずに残った要素は、一覧にない`tool-`要素
        candidates.forEach((el, id) => {
            console.warn(`ToolPalette: 要素 #${id} はツールの一覧にありません。配線しません。`);
        });

        this.#buttons.forEach(({ el, toolId }) => {
            el.addEventListener('click', () => this.#onToolSelected(toolId));
        });
    }

    /**
     * 配線済みボタンのうち`toolId`と一致するもの1つにのみ`.active`を付与し、他は除去する。
     * 一致するボタンが無い場合（`null`を含む）は、すべてのボタンが`.active`なしの状態になる。
     * @param {string|null} toolId 押し込みにするツールの識別子（どれも押し込みにしない場合は`null`）
     */
    setActiveTool(toolId) {
        this.#buttons.forEach(({ el, toolId: buttonToolId }) => {
            el.classList.toggle('active', buttonToolId === toolId);
        });
    }
}
