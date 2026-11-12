/**
 * 責務: 選択中の要素の重なり順（並び）の変更の規則（最前面へ・前へ・後ろへ・最背面へ）を、
 * 状態を持たずDOMに触れない関数として担う。要素は不透明に扱う（importなし）。
 */

/**
 * 重なり順の操作の種類。操作の値の唯一の定義。
 * 値（文字列）は、`ShapeOrderEditor.getAvailability`が返す`ShapeOrderAvailability`のキーと、
 * `PropertyOrderSection`の対応表のキーにも同じ文字列として使われる。
 * 値を変えると表示側が黙って押せない表示になるため、変えるときは両方を揃えること。
 * @readonly
 * @enum {string}
 */
export const ShapeOrderOperation = Object.freeze({
    BRING_TO_FRONT: 'bringToFront',
    BRING_FORWARD: 'bringForward',
    SEND_BACKWARD: 'sendBackward',
    SEND_TO_BACK: 'sendToBack',
});

/**
 * 操作が既知か確かめる。未知なら配線の誤りを早く見つけるためにthrowする。
 * @param {string} operation 操作
 * @returns {void}
 * @throws {Error} 未知の操作のとき
 */
function assertKnownOperation(operation) {
    if (!Object.values(ShapeOrderOperation).includes(operation)) {
        throw new Error(`ShapeOrderRules: 未知の重なり順の操作です: ${String(operation)}`);
    }
}

/**
 * 選択中の要素の重なり順を変えた、新しい並びを求める。
 *
 * 規則（`sel[i]`＝`items[i]`が選択中か。先頭＝最も奥、末尾＝最も手前）:
 * - bringToFront: [選択されていない要素（元の順）..., 選択中の要素（元の順）...]
 * - sendToBack: [選択中の要素（元の順）..., 選択されていない要素（元の順）...]
 * - bringForward: 結果と`sel`のコピーに対し、i = n-2 から 0 へ（手前側から奥側へ）走査し、
 *   sel[i]が真かつsel[i+1]が偽なら、要素とselの両方のiとi+1を入れ替える。
 * - sendBackward: 同様に i = 1 から n-1 へ（奥側から手前側へ）走査し、
 *   sel[i]が真かつsel[i-1]が偽なら、iとi-1を入れ替える。
 * 選択中の各要素は並びの上で隣の1つ分だけ動き（重なっているかは見ない）、離れた選択中の要素はまとまらず
 * それぞれ1つずつ動き、連続した選択中の要素は一緒に動く（動けなければ動かない）。
 * 選択中どうし・選択されていないどうしの相対的な順は4操作とも保たれる。
 * 空の並び・選択なし・全要素が選択中のときは並びが変わらない。
 *
 * 例（*は選択中）:
 * - 前へ: [A,B*,C,D*,E]→[A,C,B*,E,D*] / [A,B*,C*]→不変 / [A*,B,C*]→[B,A*,C*] / [A*,B*,C]→[C,A*,B*]
 * - 後ろへ: [A,B*,C,D*,E]→[B*,A,D*,C,E] / [A*,B*,C]→不変 / [A*,B,C*]→[A*,C*,B]
 *
 * @template T
 * @param {ReadonlyArray<T>} items 並び（先頭＝最も奥）。要素は`===`でのみ比べる。書き換えない。
 * @param {(item: T) => boolean} isSelected 選択中か。冒頭で各要素について1回ずつだけ呼ぶ。
 * @param {ShapeOrderOperation} operation 操作
 * @returns {T[]} 新しい並び（変わらない場合も新しい配列）
 * @throws {Error} 未知の操作のとき（`items`が空でも）
 */
export function reorderSelected(items, isSelected, operation) {
    assertKnownOperation(operation);
    const sel = items.map((item) => Boolean(isSelected(item)));
    const n = items.length;

    if (operation === ShapeOrderOperation.BRING_TO_FRONT) {
        return [
            ...items.filter((_, i) => !sel[i]),
            ...items.filter((_, i) => sel[i]),
        ];
    }
    if (operation === ShapeOrderOperation.SEND_TO_BACK) {
        return [
            ...items.filter((_, i) => sel[i]),
            ...items.filter((_, i) => !sel[i]),
        ];
    }

    const result = items.slice();
    if (operation === ShapeOrderOperation.BRING_FORWARD) {
        for (let i = n - 2; i >= 0; i--) {
            if (sel[i] && !sel[i + 1]) {
                [result[i], result[i + 1]] = [result[i + 1], result[i]];
                [sel[i], sel[i + 1]] = [sel[i + 1], sel[i]];
            }
        }
    } else {
        for (let i = 1; i < n; i++) {
            if (sel[i] && !sel[i - 1]) {
                [result[i], result[i - 1]] = [result[i - 1], result[i]];
                [sel[i], sel[i - 1]] = [sel[i - 1], sel[i]];
            }
        }
    }
    return result;
}

/**
 * 操作で並びが変わるかを返す。`reorderSelected`の結果が`items`と1か所でも違う（`!==`）とき真。
 * 押せる/押せないの判定と、手順の「何もしない」の判定はこの関数だけで行う（規則を二重に書かない）。
 * @template T
 * @param {ReadonlyArray<T>} items 並び（先頭＝最も奥）
 * @param {(item: T) => boolean} isSelected 選択中か
 * @param {ShapeOrderOperation} operation 操作
 * @returns {boolean} 並びが変わるなら`true`
 * @throws {Error} 未知の操作のとき
 */
export function canReorderSelected(items, isSelected, operation) {
    const result = reorderSelected(items, isSelected, operation);
    return result.some((item, i) => item !== items[i]);
}
