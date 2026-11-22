/**
 * 責務：基準点（外枠の四隅・辺の中央・中心の9か所）の名前の定義と、外枠の上の基準点の位置の唯一の求め方を担う（状態なし）。
 * DOM・図形・VectorModelを知らない（ScaleHandleRulesの名前と中心の式だけを使う）。
 */
import { SCALE_HANDLE_NAMES, computeFrameCenter } from './ScaleHandleRules.js';

/**
 * 基準点の名前の唯一の定義。四隅・辺の中央は外枠のハンドルの名前と同じ文字列、中心は`'center'`。
 * `index.html`の`data-reference-point`はこの値と同じ文字列（二重定義。変えるときはそろえる）。
 */
export const REFERENCE_POINT = Object.freeze({
    NW: SCALE_HANDLE_NAMES.NW,
    N: SCALE_HANDLE_NAMES.N,
    NE: SCALE_HANDLE_NAMES.NE,
    W: SCALE_HANDLE_NAMES.W,
    CENTER: 'center',
    E: SCALE_HANDLE_NAMES.E,
    SW: SCALE_HANDLE_NAMES.SW,
    S: SCALE_HANDLE_NAMES.S,
    SE: SCALE_HANDLE_NAMES.SE
});

/** 基準点の初期値（中心）。 */
export const DEFAULT_REFERENCE_POINT = REFERENCE_POINT.CENTER;

/**
 * 基準点の名前 → 各軸の側（-1＝最小側・0＝中心・+1＝最大側）。名前の文字を読まず、この表で引く。
 * @type {Readonly<Record<string, {h: number, v: number}>>}
 */
const REFERENCE_POINT_AXES = Object.freeze({
    [REFERENCE_POINT.NW]: { h: -1, v: -1 },
    [REFERENCE_POINT.N]: { h: 0, v: -1 },
    [REFERENCE_POINT.NE]: { h: 1, v: -1 },
    [REFERENCE_POINT.W]: { h: -1, v: 0 },
    [REFERENCE_POINT.CENTER]: { h: 0, v: 0 },
    [REFERENCE_POINT.E]: { h: 1, v: 0 },
    [REFERENCE_POINT.SW]: { h: -1, v: 1 },
    [REFERENCE_POINT.S]: { h: 0, v: 1 },
    [REFERENCE_POINT.SE]: { h: 1, v: 1 }
});

/**
 * 値が基準点の名前（`REFERENCE_POINT`の値）かを判定する。
 * @param {*} value 判定する値
 * @returns {boolean} 基準点の名前なら`true`
 */
export function isReferencePoint(value) {
    return typeof value === 'string' && Object.values(REFERENCE_POINT).includes(value);
}

/**
 * 外枠の上の基準点の位置を求める。基準点が名前でない（`null`・`undefined`・未知の文字列）なら中心として扱う。
 * 検証はしない（`bounds`は有限の値を持つ前提）。引数を書き換えず、毎回新しいオブジェクトを返す。
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bounds 外枠
 * @param {string|null|undefined} referencePoint 基準点の名前（`REFERENCE_POINT`の値）
 * @returns {{x: number, y: number}} 基準点の位置（ワールド）
 */
export function resolveReferencePointPosition(bounds, referencePoint) {
    const center = computeFrameCenter(bounds);
    const axes = isReferencePoint(referencePoint) ? REFERENCE_POINT_AXES[referencePoint] : REFERENCE_POINT_AXES[REFERENCE_POINT.CENTER];
    return {
        x: axes.h < 0 ? bounds.minX : (axes.h > 0 ? bounds.maxX : center.x),
        y: axes.v < 0 ? bounds.minY : (axes.v > 0 ? bounds.maxY : center.y)
    };
}
