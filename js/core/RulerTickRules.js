/**
 * 責務：定規の目盛りの位置（細線・太線の区別）と数字の文字列を求める規則を、
 * DOM・ctxに触れない状態を持たない関数として提供する。
 */

/**
 * 定規の目盛り1本。
 * @typedef {Object} RulerTick
 * @property {number} value - 目盛りのワールド座標の値（`-0`は含まない）
 * @property {boolean} major - 太線の位置なら`true`
 */

/**
 * 範囲内の定規の目盛りを`value`の昇順で求める。
 * 細線の位置は「整数インデックス`i` × `minorSpacing`」で求める（加算の誤差を累積させない）。
 * 太線は`ratio = Math.round(majorSpacing / minorSpacing)`として`i`が`ratio`の倍数の位置（負の`i`も含む）。
 * `value`の`-0`は`0`へ正規化する。
 * 引数が有限の数でない・間隔が正でない・`ratio < 1`・`minValue > maxValue`のときは空配列を返す（例外を投げない）。
 * @param {number} minValue - 範囲の下端（含む）
 * @param {number} maxValue - 範囲の上端（含む）
 * @param {number} minorSpacing - 細線の間隔（ワールド座標の長さ）
 * @param {number} majorSpacing - 太線の間隔（ワールド座標の長さ）
 * @returns {RulerTick[]} 目盛りの配列（`value`の昇順）
 */
export function computeRulerTicks(minValue, maxValue, minorSpacing, majorSpacing) {
    if (
        !Number.isFinite(minValue) ||
        !Number.isFinite(maxValue) ||
        !Number.isFinite(minorSpacing) ||
        !Number.isFinite(majorSpacing) ||
        minorSpacing <= 0 ||
        majorSpacing <= 0 ||
        minValue > maxValue
    ) {
        return [];
    }
    const ratio = Math.round(majorSpacing / minorSpacing);
    if (!(ratio >= 1)) {
        return [];
    }
    const ticks = [];
    for (let i = Math.ceil(minValue / minorSpacing); i * minorSpacing <= maxValue; i++) {
        ticks.push({
            value: i * minorSpacing + 0,
            major: ((i % ratio) + ratio) % ratio === 0,
        });
    }
    return ticks;
}

/**
 * 定規の数字の文字列を返す（整数に丸める。`-0`は`'0'`）。
 * @param {number} value - 目盛りのワールド座標の値
 * @returns {string} 整数の文字列（例：`-200`→`'-200'`）
 */
export function formatRulerLabel(value) {
    return String(Math.round(value) + 0);
}
