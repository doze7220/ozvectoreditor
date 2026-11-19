/**
 * 責務：フォーカスしている要素が、キー（Space・ショートカット）をその部品に譲るべきものかを判定する。
 * 判定対象の要素は引数で受け、DOMの型は関数の中でだけ参照する（最上位でDOMに触れない）。
 */

/**
 * テキスト入力扱いとするinput要素のtype一覧（isTextInputElementの判定に用いる）。
 * 日付・時刻系（date/datetime-local/month/time/week）は数字キー・Backspaceによる直接入力を受け付けるため含める。
 * 含めないtypeの例：checkbox / radio / range / color / button / submit / reset / file / image / hidden。
 * （checkbox・colorはisSpaceOperatedInputElementで別に扱う。）
 * HTMLInputElement.typeプロパティは小文字に正規化され、type属性なし・未知の値の場合は'text'を返すため、
 * それらもテキスト入力扱いになる。
 * @type {ReadonlyArray<string>}
 */
const TEXT_INPUT_TYPES = Object.freeze([
    'text', 'search', 'email', 'url', 'tel', 'password', 'number',
    'date', 'datetime-local', 'month', 'time', 'week',
]);

/**
 * 要素がテキスト入力中とみなすべき要素かを判定する。
 * スペースパンとショートカット（KeyboardShortcuts）の誤爆防止に用いる。
 * input要素はtype別に判定し、TEXT_INPUT_TYPESに含まれる場合のみテキスト入力扱いとする。
 * textarea・contenteditableはテキスト入力扱い、select要素を含むそれ以外は対象外。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} テキスト入力中とみなすべき要素ならtrue
 */
export function isTextInputElement(element) {
    if (element instanceof HTMLInputElement) {
        return TEXT_INPUT_TYPES.includes(element.type);
    }
    if (element instanceof HTMLTextAreaElement) {
        return true;
    }
    return element instanceof HTMLElement && element.isContentEditable;
}

/**
 * スペースキーで操作するinput要素のtype一覧（isSpaceOperatedInputElementの判定に用いる）。
 * checkbox（Spaceで切り替え）とcolor（Spaceでピッカーを開く）は、スペースパン・ショートカットと
 * Spaceの奪い合いになるため含める。
 * 含めないtypeの例：radio / range / button / submit / reset / file / image / hidden。
 * 現在、これらのtypeのinput要素は、オプションバーのスタイルのまとまりの色の欄（color）と、角のまとまりのチェックボックス（checkbox。`change`の後にフォーカスを外す）だけ。
 * @type {ReadonlyArray<string>}
 */
const SPACE_OPERATED_INPUT_TYPES = Object.freeze(['checkbox', 'color']);

/**
 * 要素がスペースキーで操作するinput要素（checkbox・color）かを判定する。
 * スペースパンとショートカット（KeyboardShortcuts）の誤爆防止に用いる（isTextInputElementとは別に扱う）。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} type が checkbox または color の input 要素ならtrue
 */
export function isSpaceOperatedInputElement(element) {
    return element instanceof HTMLInputElement && SPACE_OPERATED_INPUT_TYPES.includes(element.type);
}

/**
 * 要素がON/OFFのボタン（標準の属性aria-pressedを持つbutton要素）かを判定する。DOMのid・クラス名は見ない。
 * HTMLButtonElementは関数の中でだけ参照する（モジュールの最上位でDOMに触れない）。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} aria-pressed属性を持つbutton要素ならtrue
 */
function isToggleButtonElement(element) {
    return element instanceof HTMLButtonElement && element.hasAttribute('aria-pressed');
}

/**
 * Spaceをスペースパンに使わず、部品自身の操作に譲る要素かを判定する
 * （type が checkbox・color の input（isSpaceOperatedInputElement）と、ON/OFFのボタン（isToggleButtonElement））。
 * Ctrlなしのショートカットを止める判定（KeyboardShortcutsの手順4）には使わない（ON/OFFのボタンではショートカットを働かせるため）。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean} Spaceを部品に譲る要素ならtrue
 */
export function isSpaceYieldedElement(element) {
    return isSpaceOperatedInputElement(element) || isToggleButtonElement(element);
}
