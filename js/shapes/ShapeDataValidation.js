/**
 * 責務: 図形クラスの`fromJSON`が共通に使う、図形データ（1図形のJSON表現）の共通項目の検証と、
 * キーが無い項目の既定値の解決を、状態を持たない関数として提供する。
 */

/**
 * 図形データの描画の属性（既定値を解決した値）。
 * @typedef {Object} ShapeStyle
 * @property {string|null} strokeColor - 線の色。`null`は線なし
 * @property {number} strokeWidth - 線の太さ（キーなしなら`DEFAULT_STROKE_WIDTH`）
 * @property {string|null} fillColor - 塗りの色。`null`は塗りなし（キーなしも`null`）
 */

/**
 * `strokeWidth`のキーが無い図形データを読み込むときの太さ（px）。`shapes/`内の唯一の定義。
 * `io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`（書き出し形式の読む側の既定値）と同じ値であるべき。
 * `shapes/`は`io/`をimportできないため別に定義する。
 * 図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義。
 * @type {number}
 */
const DEFAULT_STROKE_WIDTH = 2;

/**
 * 値がプレーンオブジェクト（`null`・配列を除くオブジェクト）かを判定する。
 * @param {*} value - 判定対象
 * @returns {boolean} プレーンオブジェクトなら`true`
 */
function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 受理する種別の並びから、種別不一致のエラー文の種別の箇所を作る。
 * 各種別を`'`で囲んで`・`でつなぎ、1つなら`ではありません`、2つ以上なら`のいずれでもありません`を続ける。
 * @param {string[]} acceptedTypes - 受理する`type`の配列（1つ以上）
 * @returns {string} 例：`'line'ではありません`、`'circle'・'arc'のいずれでもありません`
 */
function describeAcceptedTypes(acceptedTypes) {
    const quoted = acceptedTypes.map((type) => `'${type}'`).join('・');
    return acceptedTypes.length === 1 ? `${quoted}ではありません` : `${quoted}のいずれでもありません`;
}

/**
 * 図形データの共通項目を検証する。違反があれば最初の1件だけを
 * 「`<className>.fromJSON: <理由>`」形式のメッセージで`Error`をthrowする。
 * 頂点数は固定（数値）または下限のみ（`{ min }`）で指定できる。
 * 検査の順序：オブジェクトか → `type` → `points`の要素数 → 各頂点（番号の小さい順） → `strokeColor` → `strokeWidth` → `fillColor`。
 * `strokeColor`は文字列または`null`（線なし）を受理する。`strokeWidth`は`undefined`（キーなし）なら
 * `DEFAULT_STROKE_WIDTH`として読み、値があれば有限で正の数値でなければ不正。
 * `fillColor`は`undefined`（キーなし）なら`null`として読み、文字列・`null`以外は不正。
 * `strokeWidth`の0以下を不正とするのは、Canvasが0以下の`lineWidth`代入を無視して直前の値が残り、
 * 描画結果が前に描いた図形に依存してしまうため。
 * `id`は検証しない。余分なプロパティは見ない。
 * @param {*} data - 検証対象の図形データ
 * @param {string} className - エラー文の先頭に付けるクラス名（例：`'Line'`）
 * @param {string[]} acceptedTypes - 受理する`type`の配列（1つ以上）
 * @param {number | { min: number }} pointCount - 要求する頂点数。数値なら「ちょうどその要素数」、
 *     `{ min }`なら「`min`要素以上」（頂点数が可変の図形用）。判定は引数の形（`typeof`）で見分ける
 * @returns {ShapeStyle} 検証に通った描画の属性（既定値解決済み）。毎回新しいオブジェクトで、`data`は書き換えない
 * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`acceptedTypes`にない／
 *     `points`が`pointCount`要素の配列でない（`{ min }`のときは`min`要素未満）／頂点がオブジェクトでないか`x`・`y`が有限の数値でない／
 *     `strokeColor`が文字列でも`null`でもない／`strokeWidth`が`undefined`以外で有限の数値でないか0以下／
 *     `fillColor`が`undefined`・文字列・`null`のいずれでもない場合
 */
export function validateShapeData(data, className, acceptedTypes, pointCount) {
    const fail = (reason) => {
        throw new Error(`${className}.fromJSON: ${reason}`);
    };

    if (!isPlainObject(data)) fail('図形データがオブジェクトではありません');
    if (!acceptedTypes.includes(data.type)) {
        fail(`図形種別が${describeAcceptedTypes(acceptedTypes)}（${String(data.type)}）`);
    }
    if (typeof pointCount === 'number') {
        if (!Array.isArray(data.points) || data.points.length !== pointCount) {
            fail(`pointsが${pointCount}要素の配列ではありません`);
        }
    } else if (!Array.isArray(data.points) || data.points.length < pointCount.min) {
        fail(`pointsが${pointCount.min}要素以上の配列ではありません`);
    }
    data.points.forEach((point, index) => {
        if (!isPlainObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            fail(`points[${index}]のx・yが有限の数値ではありません`);
        }
    });
    if (typeof data.strokeColor !== 'string' && data.strokeColor !== null) {
        fail('strokeColorが文字列またはnullではありません');
    }
    const strokeWidth = data.strokeWidth === undefined ? DEFAULT_STROKE_WIDTH : data.strokeWidth;
    if (!Number.isFinite(strokeWidth) || strokeWidth <= 0) {
        fail('strokeWidthが正の有限の数値ではありません');
    }
    const fillColor = data.fillColor === undefined ? null : data.fillColor;
    if (typeof fillColor !== 'string' && fillColor !== null) {
        fail('fillColorが文字列またはnullではありません');
    }
    return { strokeColor: data.strokeColor, strokeWidth, fillColor };
}
