/**
 * 責務: オプションバーの位置の欄（X・Y）に出す内容と、入力された値から動かす量を求める規則を提供する。
 * 状態を持たず、DOM・VectorModel・図形・履歴・イベントを知らない。
 */
// 依存の向き: `edit/`から`core/`への下向きの依存（`NudgeEditor`と同じ。`StatusReadoutRules`はimportを持たないため循環しない）。
import { formatReadoutNumber } from '../core/StatusReadoutRules.js';

/**
 * 位置の欄の軸の値（唯一の定義箇所）。
 * @type {Readonly<{X: string, Y: string}>}
 */
export const POSITION_AXIS = Object.freeze({ X: 'x', Y: 'y' });

/**
 * 位置の欄に出す内容。`palette/OptionBarPositionGroup.js`のtypedefと同じ内容の二重定義（形を変えるときは両方を揃える）。
 * @typedef {Object} PositionInputView
 * @property {string} x - Xの欄の値（空なら`''`）
 * @property {string} y - Yの欄の値（空なら`''`）
 * @property {boolean} disabled - 欄を押せない見た目にするか
 */

/**
 * 位置の欄に出す内容を返す。対象の種類では分岐せず、「対象なしか」と「範囲が使えるか」だけを見る。
 * 有限でない値は`formatReadoutNumber`が`—`を返すが、数値の欄には入れられないため、ここで先に弾いて空＋押せないにする。
 * 丸めは`formatReadoutNumber`に任せ、本関数では書かない。
 * @param {object|null|undefined} target - 動かす対象（無ければ`null`／`undefined`）
 * @param {{minX: number, minY: number}|null|undefined} bounds - 対象の範囲（外枠または頂点の範囲）
 * @returns {PositionInputView} 欄に出す内容
 */
export function buildPositionInputView(target, bounds) {
    if (target === null || target === undefined || bounds === null || bounds === undefined
        || !Number.isFinite(bounds.minX) || !Number.isFinite(bounds.minY)) {
        return { x: '', y: '', disabled: true };
    }
    return { x: formatReadoutNumber(bounds.minX), y: formatReadoutNumber(bounds.minY), disabled: false };
}

/**
 * 入力された値から、範囲の左上をその値へ動かす移動量を求める。
 * 指定した軸だけ動かし（もう一方は0）、スナップ（刻みへの丸め）・端点への吸い付きは行わない（入れた値そのものへ動かす）。
 * 欄の表示は小数第1位へ丸めるが、移動量は丸めない（表示の丸めを位置の値へ持ち込まない）。
 * @param {string} axis - `POSITION_AXIS`の値
 * @param {*} text - 欄の文字列（`<input type="number">`の`value`の形）
 * @param {{minX: number, minY: number}|null|undefined} bounds - 対象の範囲
 * @returns {{dx: number, dy: number}|null} 移動量。受理しない・未知の軸・動かさない（移動量0）ときは`null`
 */
export function resolvePositionDelta(axis, text, bounds) {
    if (typeof text !== 'string' || text.trim() === '') {
        return null;
    }
    const value = Number(text);
    if (!Number.isFinite(value) || bounds === null || bounds === undefined) {
        return null;
    }
    let delta;
    if (axis === POSITION_AXIS.X) {
        if (!Number.isFinite(bounds.minX)) {
            return null;
        }
        delta = { dx: value - bounds.minX, dy: 0 };
    } else if (axis === POSITION_AXIS.Y) {
        if (!Number.isFinite(bounds.minY)) {
            return null;
        }
        delta = { dx: 0, dy: value - bounds.minY };
    } else {
        return null;
    }
    return delta.dx === 0 && delta.dy === 0 ? null : delta;
}
