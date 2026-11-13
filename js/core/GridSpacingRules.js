/**
 * 責務：表示倍率から背景グリッドの細線・太線の間隔（ワールド座標の長さ）を求める規則を、
 * 状態を持たない関数として提供する（グリッド・定規・ステータスバーで共有）。
 */

/**
 * 背景グリッドの細線の基本間隔（ワールド座標の長さ）。
 * 画面上の間隔が`GRID_MIN_SCREEN_SPACING`未満になる場合は10倍ずつ繰り上げる。
 * @type {number}
 */
const GRID_BASE_SPACING = 10;

/**
 * 背景グリッドの細線の画面上の最小間隔（スクリーン座標のCSSピクセル）。
 * これより細かくなる倍率では、細線の間隔を10倍に繰り上げる（間引き）。
 * @type {number}
 */
const GRID_MIN_SCREEN_SPACING = 8;

/**
 * 間隔の繰り上げループの最大回数（無限ループ防止の上限ガード）。
 * @type {number}
 */
const GRID_MAX_SPACING_STEPS = 10;

/**
 * 表示倍率からグリッドの細線・太線の間隔（ワールド座標の長さ）を求める。
 * 細線間隔は10から開始し、画面上の間隔が8px未満の間は10倍ずつ繰り上げる（最大10回）。太線間隔は細線間隔の10倍。
 * 不正な倍率でも例外を投げず、停止する（`0`・負の値は10回繰り上げて細線`1e11`、`NaN`・`Infinity`は細線`10`）。
 * 呼び出し側は正の有限の倍率だけを描画に使うこと。
 * @param {number} scale - 表示倍率
 * @returns {{minor: number, major: number}} 細線・太線の間隔（ワールド座標の長さ）
 */
export function computeGridSpacing(scale) {
    let minor = GRID_BASE_SPACING;
    for (let i = 0; i < GRID_MAX_SPACING_STEPS && minor * scale < GRID_MIN_SCREEN_SPACING; i++) {
        minor *= 10;
    }
    return { minor, major: minor * 10 };
}
