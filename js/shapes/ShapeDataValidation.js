/**
 * 責務: 図形クラスの`fromJSON`が共通に使う、図形データ（1図形のJSON表現）の共通項目の検証を、
 * 状態を持たない関数として提供する。
 */

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
 * 検査の順序：オブジェクトか → `type` → `points`の要素数 → 各頂点（番号の小さい順） → `strokeColor` → `strokeWidth`。
 * `strokeWidth`の0以下を不正とするのは、Canvasが0以下の`lineWidth`代入を無視して直前の値が残り、
 * 描画結果が前に描いた図形に依存してしまうため。
 * `id`は検証しない。余分なプロパティは見ない。
 * @param {*} data - 検証対象の図形データ
 * @param {string} className - エラー文の先頭に付けるクラス名（例：`'Line'`）
 * @param {string[]} acceptedTypes - 受理する`type`の配列（1つ以上）
 * @param {number} pointCount - 要求する頂点数
 * @returns {void}
 * @throws {Error} `data`がプレーンオブジェクトでない／`type`が`acceptedTypes`にない／
 *     `points`が`pointCount`要素の配列でない／頂点がオブジェクトでないか`x`・`y`が有限の数値でない／
 *     `strokeColor`が文字列でない／`strokeWidth`が有限の数値でないか0以下の場合
 */
export function validateShapeData(data, className, acceptedTypes, pointCount) {
    const fail = (reason) => {
        throw new Error(`${className}.fromJSON: ${reason}`);
    };

    if (!isPlainObject(data)) fail('図形データがオブジェクトではありません');
    if (!acceptedTypes.includes(data.type)) {
        fail(`図形種別が${describeAcceptedTypes(acceptedTypes)}（${String(data.type)}）`);
    }
    if (!Array.isArray(data.points) || data.points.length !== pointCount) {
        fail(`pointsが${pointCount}要素の配列ではありません`);
    }
    data.points.forEach((point, index) => {
        if (!isPlainObject(point) || !Number.isFinite(point.x) || !Number.isFinite(point.y)) {
            fail(`points[${index}]のx・yが有限の数値ではありません`);
        }
    });
    if (typeof data.strokeColor !== 'string') fail('strokeColorが文字列ではありません');
    if (!Number.isFinite(data.strokeWidth) || data.strokeWidth <= 0) {
        fail('strokeWidthが正の有限の数値ではありません');
    }
}
