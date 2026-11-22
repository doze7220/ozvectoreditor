/**
 * 責務: オプションバーの幅・高さ・角度・反転の入力の、押せる条件・表示内容・入力値から変換を求める規則を提供する。
 * 状態を持たず、DOM・図形・VectorModel・履歴・操作モードの値を知らない。変換の式は拡大縮小・回転の既存の関数を呼ぶ。
 */
// 依存の向き: `edit/`から`core/`への下向きの依存（`PositionInputRules`と同じ。いずれも`core/`内で`edit/`をimportしないため循環しない）。
import { formatReadoutNumber } from '../core/StatusReadoutRules.js';
import { toScaleTransform } from '../core/ScaleHandleRules.js';
import { toRotationTransform } from '../core/RotationRules.js';

/**
 * 大きさの欄の軸の値（唯一の定義箇所）。
 * @type {Readonly<{WIDTH: string, HEIGHT: string}>}
 */
export const SIZE_AXIS = Object.freeze({ WIDTH: 'width', HEIGHT: 'height' });

/**
 * 反転の軸の値（唯一の定義箇所）。`palette/`の2つの部品は同じ文字列を非公開の定数で持つ二重定義（変えるときはそろえる）。
 * `HORIZONTAL`＝横に反転（左右を入れ替える）、`VERTICAL`＝縦に反転（上下を入れ替える）。
 * @type {Readonly<{HORIZONTAL: string, VERTICAL: string}>}
 */
export const FLIP_AXIS = Object.freeze({ HORIZONTAL: 'horizontal', VERTICAL: 'vertical' });

/**
 * 押せるときの角度の欄の文字列（確定すると書き戻される値）。
 * @type {string}
 */
export const ANGLE_INPUT_IDLE_TEXT = '0';

/**
 * 大きさのまとまりに出す内容。`palette/OptionBarSizeGroup.js`のtypedefと同じ内容の二重定義（形を変えるときは両方を揃える）。
 * @typedef {Object} SizeInputView
 * @property {string} width - 幅の欄の値（空なら`''`）
 * @property {string} height - 高さの欄の値（空なら`''`）
 * @property {boolean} widthDisabled - 幅の欄を押せない見た目にするか
 * @property {boolean} heightDisabled - 高さの欄を押せない見た目にするか
 * @property {boolean} lockDisabled - 比率の鍵を押せない見た目にするか
 * @property {boolean} aspectLocked - 比率の鍵が掛かっているか
 */

/**
 * 変形のまとまりに出す内容。`palette/OptionBarTransformGroup.js`のtypedefと同じ内容の二重定義（形を変えるときは両方を揃える）。
 * @typedef {Object} TransformInputView
 * @property {string} angle - 角度の欄の値（空なら`''`）
 * @property {string|null} referencePoint - 押された見た目にする基準点の名前（無ければ`null`）
 * @property {boolean} disabled - 角度の欄・基準点・反転を押せない見た目にするか
 */

/**
 * 外枠の4つの値が有限か判定する。
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null|undefined} bounds - 外枠
 * @returns {boolean} 4つとも有限の数なら`true`
 */
function hasFiniteBounds(bounds) {
    if (bounds === null || bounds === undefined) {
        return false;
    }
    return Number.isFinite(bounds.minX)
        && Number.isFinite(bounds.minY)
        && Number.isFinite(bounds.maxX)
        && Number.isFinite(bounds.maxY);
}

/**
 * 幅・高さ・角度・反転を押せるか判定する（表示と手順が共有する唯一の判定）。
 * 対象が図形（`type: 'shapes'`）で、線を含まない外枠の4つの値が有限なら`true`。
 * @param {{type: string}|null|undefined} target - `resolveNudgeTarget`の結果
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null|undefined} bounds - 線を含まない外枠
 * @returns {boolean} 押せるなら`true`
 */
export function canTransformSelection(target, bounds) {
    if (target === null || target === undefined || target.type !== 'shapes') {
        return false;
    }
    return hasFiniteBounds(bounds);
}

/**
 * 大きさのまとまりに出す内容を作る。
 * 押せないときは空・押せない見た目。押せるときは幅・高さを小数第1位の文字列にし、長さが0の向きは`0.0`を出したまま押せない見た目にする。
 * @param {boolean} enabled - 押せるか（`canTransformSelection`の結果）
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} bounds - 線を含まない外枠（`enabled`が真のときだけ読む）
 * @param {boolean} aspectLocked - 比率の鍵が掛かっているか
 * @returns {SizeInputView} 表示内容（新しいオブジェクト）
 */
export function buildSizeInputView(enabled, bounds, aspectLocked) {
    if (!enabled) {
        return { width: '', height: '', widthDisabled: true, heightDisabled: true, lockDisabled: true, aspectLocked: false };
    }
    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    return {
        width: formatReadoutNumber(w),
        height: formatReadoutNumber(h),
        widthDisabled: w === 0,
        heightDisabled: h === 0,
        lockDisabled: false,
        aspectLocked: aspectLocked === true
    };
}

/**
 * 変形のまとまり（角度・基準点・反転）に出す内容を作る。
 * @param {boolean} enabled - 押せるか（`canTransformSelection`の結果）
 * @param {string|null} referencePoint - 基準点の名前
 * @returns {TransformInputView} 表示内容（新しいオブジェクト）
 */
export function buildTransformInputView(enabled, referencePoint) {
    if (!enabled) {
        return { angle: '', referencePoint: null, disabled: true };
    }
    return { angle: ANGLE_INPUT_IDLE_TEXT, referencePoint, disabled: false };
}

/**
 * 入力の文字列を数値にする。空・数値でない文字列は`null`。
 * `PositionInputRules.resolvePositionDelta`と同じ受理の形（`PositionInputRules`を変えないため、このファイルにも書く）。
 * @param {*} text - 欄の文字列
 * @returns {number|null} 有限の数値、受理しなければ`null`
 */
function parseInputNumber(text) {
    if (typeof text !== 'string' || text.trim() === '') {
        return null;
    }
    const value = Number(text);
    return Number.isFinite(value) ? value : null;
}

/**
 * 幅または高さの入力から、基準点を動かさない拡大縮小の変換を求める。
 * 受理しない（空・数値でない・0以下・軸が未知・その軸の長さが0・実際の長さと等しい）なら`null`。
 * 倍率＝入れた値÷実際の長さ（表示の丸めを持ち込まない）。もう一方の軸は、比率の鍵ありでその軸の長さが0でなければ同じ倍率、そうでなければ1。
 * @param {string} axis - `SIZE_AXIS`の値
 * @param {string} text - 欄の文字列
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bounds - 線を含まない外枠
 * @param {{x: number, y: number}} origin - 動かない点（基準点の位置）
 * @param {boolean} aspectLocked - 比率の鍵が掛かっているか
 * @returns {import('../shapes/ShapeGeometry.js').AffineTransform|null} 変換（新しいオブジェクト）、なければ`null`
 */
export function resolveSizeTransform(axis, text, bounds, origin, aspectLocked) {
    const value = parseInputNumber(text);
    if (value === null || value <= 0) {
        return null;
    }
    if (axis !== SIZE_AXIS.WIDTH && axis !== SIZE_AXIS.HEIGHT) {
        return null;
    }
    const width = bounds.maxX - bounds.minX;
    const height = bounds.maxY - bounds.minY;
    const isWidth = axis === SIZE_AXIS.WIDTH;
    const length = isWidth ? width : height;
    const otherLength = isWidth ? height : width;
    if (length === 0 || value === length) {
        return null;
    }
    const s = value / length;
    const otherScale = aspectLocked === true && otherLength !== 0 ? s : 1;
    return toScaleTransform({
        scaleX: isWidth ? s : otherScale,
        scaleY: isWidth ? otherScale : s,
        originX: origin.x,
        originY: origin.y
    });
}

/**
 * 角度の入力から、基準点の周りの回転の変換を求める。プラスが反時計回り（回転の変換は時計回りが正のため符号を変えて渡す）。
 * 空・数値でない・0は`null`。360°以上・−360°以下もそのまま渡す（刻みは当てない）。
 * @param {string} text - 欄の文字列（度）
 * @param {{x: number, y: number}} origin - 回転の中心（基準点の位置）
 * @returns {import('../shapes/ShapeGeometry.js').AffineTransform|null} 変換（新しいオブジェクト）、なければ`null`
 */
export function resolveRotationTransform(text, origin) {
    const value = parseInputNumber(text);
    if (value === null || value === 0) {
        return null;
    }
    return toRotationTransform(origin, -(value * Math.PI / 180));
}

/**
 * 反転の変換を求める。基準点を通る縦（横）の線を軸にした、倍率−1の拡大縮小。
 * @param {string} axis - `FLIP_AXIS`の値
 * @param {{x: number, y: number}} origin - 動かない点（基準点の位置）
 * @returns {import('../shapes/ShapeGeometry.js').AffineTransform|null} 変換（新しいオブジェクト）、軸が未知なら`null`
 */
export function resolveFlipTransform(axis, origin) {
    if (axis === FLIP_AXIS.HORIZONTAL) {
        return toScaleTransform({ scaleX: -1, scaleY: 1, originX: origin.x, originY: origin.y });
    }
    if (axis === FLIP_AXIS.VERTICAL) {
        return toScaleTransform({ scaleX: 1, scaleY: -1, originX: origin.x, originY: origin.y });
    }
    return null;
}
