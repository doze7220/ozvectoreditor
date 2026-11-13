/**
 * 責務：ステータスバーの座標・大きさ・グリッドの表示の文字列の規則（文言・記号の唯一の定義箇所）を、
 * DOMに触れない状態を持たない関数として提供する。
 */

/**
 * ステータスバーの文言・記号の定数（唯一の定義箇所）。
 * @type {Readonly<{X: string, Y: string, WIDTH: string, HEIGHT: string, GRID: string, NONE: string, SEPARATOR: string}>}
 */
const READOUT_TEXT = Object.freeze({
    X: 'X:',
    Y: 'Y:',
    WIDTH: 'W:',
    HEIGHT: 'H:',
    GRID: 'グリッド:',
    NONE: '—',
    SEPARATOR: '  '
});

/**
 * 数値をステータスバー用の文字列にする（小数第1位まで固定）。
 * 有限の数でなければ「—」。`-0`・丸めて0になる負の値は`0.0`とし、`-0.0`と表示しない。
 * @param {number} value - 表示する数値
 * @returns {string} 例：`120.5`・`-40.0`・`0.0`・`—`
 */
export function formatReadoutNumber(value) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return READOUT_TEXT.NONE;
    }
    const rounded = Math.round(value * 10) / 10 + 0;
    return rounded.toFixed(1);
}

/**
 * カーソル位置（ワールド座標）の表示文字列を返す。
 * @param {{x: number, y: number}|null} point - カーソル位置。キャンバスの外などで無ければ`null`
 * @returns {string} 例：`X: 120.5  Y: -40.0`。`null`なら`X: —  Y: —`
 */
export function formatCursorReadout(point) {
    const x = point ? formatReadoutNumber(point.x) : READOUT_TEXT.NONE;
    const y = point ? formatReadoutNumber(point.y) : READOUT_TEXT.NONE;
    return `${READOUT_TEXT.X} ${x}${READOUT_TEXT.SEPARATOR}${READOUT_TEXT.Y} ${y}`;
}

/**
 * 図形の外枠の大きさ（幅と高さ）の表示文字列を返す。
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} bounds - 外枠。無ければ`null`
 * @returns {string} 例：`W: 120.0  H: 80.0`。`null`なら`W: —  H: —`
 */
export function formatSizeReadout(bounds) {
    const w = bounds ? formatReadoutNumber(bounds.maxX - bounds.minX) : READOUT_TEXT.NONE;
    const h = bounds ? formatReadoutNumber(bounds.maxY - bounds.minY) : READOUT_TEXT.NONE;
    return `${READOUT_TEXT.WIDTH} ${w}${READOUT_TEXT.SEPARATOR}${READOUT_TEXT.HEIGHT} ${h}`;
}

/**
 * グリッド1マス（細線の間隔）の表示文字列を返す。整数のまま表示する。
 * @param {number} spacing - 細線の間隔（整数の想定）
 * @returns {string} 例：`グリッド: 10px`。有限の数でなければ`グリッド: —`
 */
export function formatGridReadout(spacing) {
    if (typeof spacing !== 'number' || !Number.isFinite(spacing)) {
        return `${READOUT_TEXT.GRID} ${READOUT_TEXT.NONE}`;
    }
    return `${READOUT_TEXT.GRID} ${spacing}px`;
}
