/**
 * 責務: 選択モードの当たり分類の規則（ある点が選択集合の図形のハンドル・図形の本体・空白のどれに当たるか）を、
 * 図形の公開メソッドと選択中かの照会だけで判定する、状態を持たない関数として提供する。
 */

/**
 * 当たり分類の結果。ホバー・押下・クリック・カーソル形状の判定で共通に用いる（正本。`InputTracker`はこれを参照する）。
 * handleもbodyIdもnullの場合は「空白」を表す。
 * @typedef {Object} PointHit
 * @property {{shapeId: string, handle: string} | null} handle
 *     選択集合の図形のハンドル（前面優先）。shapeId：ハンドルが属する図形のid（単一）、handle：hitTestHandleの戻り値
 * @property {string | null} bodyId
 *     本体の図形のid（単一）。選択集合の図形の輪郭を優先し、それ以外は手前（図形配列の後ろ）から輪郭または塗った内側
 */

/**
 * ハンドルの当たりを判定する。選択集合の図形だけを対象に、図形配列の後ろ（描画順で前面）から
 * `shape.hitTestHandle`を呼び、最初に非nullとなった図形とハンドル名を返す
 * （`CanvasManager`がハンドルを図形配列の順に描くため、重なり順と一致する）。
 * `shapes`は読むだけで書き換えず、`isSelected`は呼ぶだけ。
 * @param {Array<{id: string, hitTestHandle: function(number, number, number): (string|null)}>} shapes - 図形の配列（描画順。後ろが手前）
 * @param {function(string): boolean} isSelected - 選択集合に含まれるかの照会
 * @param {number} x - 判定する点のX座標（ワールド座標）
 * @param {number} y - 判定する点のY座標（ワールド座標）
 * @param {number} tolerance - ハンドルの当たりの許容誤差（ワールドの長さ）
 * @returns {{shapeId: string, handle: string} | null} 当たったハンドル。なければnull
 */
function findHandleHit(shapes, isSelected, x, y, tolerance) {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (!isSelected(shape.id)) {
            continue;
        }
        const handleName = shape.hitTestHandle(x, y, tolerance);
        if (handleName) {
            return { shapeId: shape.id, handle: handleName };
        }
    }
    return null;
}

/**
 * 本体の当たりを判定する。
 * 規則：
 * 1. 選択集合の図形のうち、図形配列の後ろ（手前）から見て`hitTest`（輪郭の当たり）が真の最初の図形を採る。
 * 2. 1で決まらなければ、図形配列の後ろ（手前）から順に`hitTest || hitTestFill`（輪郭または塗った内側）が真の最初の図形を採る。
 *    選択集合の図形の内側もこの順番の中で扱い、選択集合だからといって内側を優先しない。
 * 図形種別の分岐・`isFillable()`・`fillColor`の読み取りは持たず、`hitTest`・`hitTestFill`のポリモーフィック呼び出しのみで判定する。
 * `shapes`は読むだけで書き換えず、`isSelected`は呼ぶだけ。
 * @param {Array<{id: string, hitTest: function(number, number, number): boolean, hitTestFill: function(number, number): boolean}>} shapes - 図形の配列（描画順。後ろが手前）
 * @param {function(string): boolean} isSelected - 選択集合に含まれるかの照会
 * @param {number} x - 判定する点のX座標（ワールド座標）
 * @param {number} y - 判定する点のY座標（ワールド座標）
 * @param {number} tolerance - 輪郭の当たりの許容誤差（ワールドの長さ）
 * @returns {string | null} 本体の図形のid。どれにも当たらなければnull
 */
function findBodyHit(shapes, isSelected, x, y, tolerance) {
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (isSelected(shape.id) && shape.hitTest(x, y, tolerance)) {
            return shape.id;
        }
    }
    for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (shape.hitTest(x, y, tolerance) || shape.hitTestFill(x, y)) {
            return shape.id;
        }
    }
    return null;
}

/**
 * 指定した点の当たり分類を行う。`handle`と`bodyId`は独立に求める（ハンドルが当たっても`bodyId`を求める）。
 * 規則：ハンドル（選択集合・手前優先）→ 本体（選択集合の図形の輪郭・手前優先 → 手前から輪郭または塗った内側）。
 * 使う図形のメンバーは`id`・`hitTestHandle`・`hitTest`・`hitTestFill`のみ。
 * `shapes`は読むだけで書き換えず、`isSelected`は呼ぶだけ。例外を投げない（図形が契約を満たす前提）。
 * @param {Array<Object>} shapes - 図形の配列（描画順。後ろが手前。`model.getShapes()`の戻り値）
 * @param {function(string): boolean} isSelected - 選択集合に含まれるかの照会
 * @param {number} x - 判定する点のX座標（ワールド座標）
 * @param {number} y - 判定する点のY座標（ワールド座標）
 * @param {number} tolerance - 輪郭・ハンドルの当たりの許容誤差（ワールドの長さ）
 * @returns {PointHit} 当たり分類の結果（handle・bodyIdともnullなら空白）
 */
export function classifyPointHit(shapes, isSelected, x, y, tolerance) {
    return {
        handle: findHandleHit(shapes, isSelected, x, y, tolerance),
        bodyId: findBodyHit(shapes, isSelected, x, y, tolerance),
    };
}
