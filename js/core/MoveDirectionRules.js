/**
 * 責務: 移動量を横・縦・斜め45°の4本の直線のうち最も近いものへ限定する規則を、状態を持たない関数として提供する。
 * 引数を書き換えず新しいオブジェクトを返す。importなし・DOMなし。
 */

/**
 * tan(22.5°) = √2 − 1。横・縦・斜めの境界の傾き。モジュール内だけで使う（exportしない）。
 * 三角関数を使わずに場合分けするための定数で、同じ入力に常に同じ結果を返す。
 * @type {number}
 */
const TAN_HALF_DIAGONAL = Math.SQRT2 - 1;

/**
 * 移動量`(dx, dy)`を、原点を通る横・縦・斜め45°（右下がり・右上がり）の4本の直線のうち最も近いものへ正射影した移動量を返す。
 * 有限の数値を前提とする（NaN・Infinityは扱わない）。
 * - 移動量0（`dx`・`dy`とも0）：そのまま返す。
 * - 横（`|dy| <= |dx| * T`）：`{ dx, dy: 0 }`。
 * - 縦（`|dx| <= |dy| * T`）：`{ dx: 0, dy }`。
 * - それ以外：斜め。`s = (|dx| + |dy|) / 2`として`{ sign(dx) * s, sign(dy) * s }`（`|dx| === |dy|`が厳密に成り立つ）。
 * 境界（22.5°ちょうど）は`<=`により横・縦の側へ決まる。
 * @param {number} dx 横方向の移動量
 * @param {number} dy 縦方向の移動量
 * @returns {{dx: number, dy: number}} 限定した移動量（新しいオブジェクト）
 */
export function constrainMoveDirection(dx, dy) {
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (ax === 0 && ay === 0) {
        return { dx, dy };
    }
    if (ay <= ax * TAN_HALF_DIAGONAL) {
        return { dx, dy: 0 };
    }
    if (ax <= ay * TAN_HALF_DIAGONAL) {
        return { dx: 0, dy };
    }
    const s = (ax + ay) / 2;
    return { dx: Math.sign(dx) * s, dy: Math.sign(dy) * s };
}
