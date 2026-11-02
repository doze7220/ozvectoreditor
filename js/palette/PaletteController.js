/**
 * 責務: 図形選択パレット（`#window-shape-palette`）内の、図形種別一覧に対応するボタンのclick購読による図形種別の選択要求（コールバック経由）、
 * および`setEnabled(enabled)`によるパレット本体の活性/非活性制御・`setActiveType(type)`による各ボタンのアクティブ表示制御を担う。
 * 操作モード・VectorModel・図形データ・選択状態には一切関与しない。
 */

/**
 * パレットボタンのDOM idの接頭辞。図形種別`type`のボタンは`${PALETTE_BUTTON_ID_PREFIX}${type}`のidで解決する。
 * @type {string}
 */
const PALETTE_BUTTON_ID_PREFIX = 'palette-';

/**
 * 図形選択パレットの自己完結UI部品。図形種別一覧（コンストラクタ引数）に対応するボタンのclickを
 * 図形種別の選択要求としてコールバックへ通知し、パレット本体の活性/非活性と各ボタンのアクティブ表示を
 * 外部からの指示に従って切り替える。InputTracker・ShapeFactoryへは直接依存しない（種別一覧は注入される）。
 */
export class PaletteController {
    /**
     * @type {Element} パレットのルート要素（`#window-shape-palette`）。setEnabled時の.disabled制御対象。
     * @private
     */
    #rootElement;

    /**
     * @type {Function} 図形種別の選択要求時に呼び出す汎用コールバック（例: `applyShapeType(type)`）。
     * @private
     */
    #onTypeSelected;

    /**
     * @type {Array<{el: Element, type: string}>} 配線済みボタンのDOM要素と対応typeの対応表
     * （図形種別一覧の並び順。ボタンが見つからなかった種別は含まない）。
     * setActiveType時のアクティブ表示の排他制御に用いる。
     * @private
     */
    #buttons;

    /**
     * 図形種別一覧の各typeについて、パレットルート要素内のid`palette-${type}`のボタンを解決して
     * clickリスナーを登録し、クリック時に`onTypeSelected(type)`コールバックを呼び出す配線を行う。
     * 初期化時に、種別一覧とDOMの不整合を次の2点について`console.warn`で報告する（いずれも配線はしない）。
     * - 種別一覧にあるのに、対応するボタンがルート要素内に見つからない種別
     * - ルート要素内にある`palette-`で始まるidの要素のうち、種別一覧にないもの
     * @param {Element} paletteRootElement パレットのルート要素（`#window-shape-palette`）
     * @param {ReadonlyArray<string>} shapeTypes 図形種別一覧（正本は`ShapeFactory.js`の`SHAPE_TYPES`）
     * @param {Function} onTypeSelected 図形種別選択時に呼び出す汎用コールバック（例: `applyShapeType(type)`）
     */
    constructor(paletteRootElement, shapeTypes, onTypeSelected) {
        this.#rootElement = paletteRootElement;
        this.#onTypeSelected = onTypeSelected;

        // ルート要素内の`palette-`で始まるid要素をidで引けるようにする（CSSセレクタ文字列を組み立てない）
        const candidates = new Map(
            Array.from(this.#rootElement.querySelectorAll(`[id^="${PALETTE_BUTTON_ID_PREFIX}"]`), (el) => [el.id, el])
        );

        this.#buttons = [];
        shapeTypes.forEach((type) => {
            const id = `${PALETTE_BUTTON_ID_PREFIX}${type}`;
            const el = candidates.get(id);
            if (el === undefined) {
                console.warn(`PaletteController: 図形種別 "${type}" のボタン（#${id}）が見つかりません。この種別は配線しません。`);
                return;
            }
            candidates.delete(id);
            this.#buttons.push({ el, type });
        });

        // 種別一覧で消費されずに残った要素は、種別一覧にない`palette-`要素
        candidates.forEach((el, id) => {
            console.warn(`PaletteController: 要素 #${id} は図形種別一覧にありません。配線しません。`);
        });

        this.#buttons.forEach(({ el, type }) => {
            el.addEventListener('click', () => this.#onTypeSelected(type));
        });
    }

    /**
     * パレット本体の活性/非活性を切り替える。`enabled === false`の場合はパレットのルート要素に
     * `.disabled`を付与し、`true`の場合は除去する。パレット内ボタンの`.active`には触れない。
     * 活性/非活性の判断（どの操作モードで活性とするか）は呼び出し側（`main.js`）の責務である。
     * @param {boolean} enabled パレットを活性にする場合は`true`、非活性にする場合は`false`
     */
    setEnabled(enabled) {
        this.#rootElement.classList.toggle('disabled', !enabled);
    }

    /**
     * 配線済みボタンのうち`type`と一致するもの1つにのみ`.active`を付与し、他は除去する。
     * パレットの活性/非活性に関係なくハイライトを更新する（非活性中も記憶中の図形種別を表示し続ける）。
     * `type`がいずれのボタンとも一致しない値の場合は、すべてのボタンが`.active`なしの状態になる。
     * @param {string} type ハイライトする図形種別（`SHAPE_TYPES`のいずれか）
     */
    setActiveType(type) {
        this.#buttons.forEach(({ el, type: buttonType }) => {
            el.classList.toggle('active', buttonType === type);
        });
    }
}
