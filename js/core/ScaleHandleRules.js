/**
 * 責務: 選択（V）の外枠と外枠のハンドルの出し方・位置・当たり・カーソルの向きと、引いたときの倍率・動かない点・スナップの当て方・変換の組み立てを、状態を持たない関数として提供する。
 * 引数を書き換えず新しいオブジェクトを返す。丸めは`UnitSnapRules`を呼ぶだけ（丸め方を持たない）。DOM・図形・VectorModel・修飾キーの読み取りを持たない。
 */
import { OperationMode } from './InputModes.js';
import { roundPointToUnit } from './UnitSnapRules.js';

/**
 * 外枠のハンドル名の唯一の定義。角は`nw`・`ne`・`se`・`sw`、辺は`n`・`e`・`s`・`w`。
 * 名前に`'w'`を含めば横の動く辺は左、`'e'`なら右、`'n'`なら縦の動く辺は上、`'s'`なら下（`computeBoundsScale`の手順1）。
 * @type {Readonly<{NW: string, N: string, NE: string, E: string, SE: string, S: string, SW: string, W: string}>}
 */
export const SCALE_HANDLE_NAMES = Object.freeze({
    NW: 'nw',
    N: 'n',
    NE: 'ne',
    E: 'e',
    SE: 'se',
    S: 's',
    SW: 'sw',
    W: 'w'
});

/**
 * ハンドルの当たりの正方形の一辺の半分（画面上px）。ワールド座標では`この値 / 表示倍率`。
 * @type {number}
 */
export const SCALE_HANDLE_HIT_SCREEN_PX = 6;

/**
 * 辺のハンドルを出す外枠の辺の長さの下限（画面上px。ハンドル3つ分）。辺の長さ（ワールド）×表示倍率がこの値以上のときだけ出す。
 * @type {number}
 */
export const SCALE_EDGE_HANDLE_MIN_SCREEN_PX = 24;

/**
 * 外枠のハンドル1つ。
 * @typedef {Object} ScaleHandle
 * @property {string} name ハンドル名（`SCALE_HANDLE_NAMES`の値）
 * @property {number} x ワールドのx座標
 * @property {number} y ワールドのy座標
 */

/**
 * 出す外枠とハンドル。`handles`は後ろほど優先（描画は前から、当たりは後ろから探す）。
 * @typedef {Object} ScaleFrame
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds 外枠（新しいオブジェクト）
 * @property {ScaleHandle[]} handles ハンドルの並び（辺のハンドル→角のハンドル。角が後ろ＝優先）
 */

/**
 * 縦横の倍率と動かない点。
 * @typedef {Object} BoundsScale
 * @property {number} scaleX 横の倍率（負なら横に裏返る）
 * @property {number} scaleY 縦の倍率（負なら縦に裏返る）
 * @property {number} originX 横の動かない点（ワールド）
 * @property {number} originY 縦の動かない点（ワールド）
 */

/**
 * `computeBoundsScale`の引数。
 * @typedef {Object} BoundsScaleInput
 * @property {string} handle 引いているハンドル名
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds 引き始めの外枠
 * @property {{x: number, y: number}} pointer 丸めていないカーソル位置（ワールド）
 * @property {boolean} keepAspect `Shift`（比率を保つ）
 * @property {boolean} fromCenter `Alt`（外枠の中心を動かさない）
 * @property {number|null} step 刻み（`resolveUnitSnapStep`の結果。`null`なら丸めない）
 * @property {{scaleX: number, scaleY: number}} previous 直前に当てた倍率（引き始めは`{ scaleX: 1, scaleY: 1 }`）
 */

/**
 * 値が正の有限の数値か。モジュール内だけで使う（exportしない）。
 * @param {*} value 値
 * @returns {boolean} 正の有限の数値なら true
 */
function isPositiveFinite(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * 外枠の4つの値がすべて有限の数値か。モジュール内だけで使う（exportしない）。
 * @param {*} bounds 外枠
 * @returns {boolean} すべて有限の数値なら true
 */
function isFiniteBounds(bounds) {
    return Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY)
        && Number.isFinite(bounds.maxX) && Number.isFinite(bounds.maxY);
}

/**
 * 外枠の4つの角の位置の唯一の求め方。並びは`nw (minX, minY)`・`ne (maxX, minY)`・`se (maxX, maxY)`・`sw (minX, maxY)`。
 * 幅・高さが0でも4つ返す。検証はしない。引数を書き換えず、毎回新しいオブジェクトを返す。
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bounds 外枠
 * @returns {ScaleHandle[]} 角のハンドル4つ（`nw`・`ne`・`se`・`sw`の順）
 */
export function collectFrameCorners(bounds) {
    const { minX, minY, maxX, maxY } = bounds;
    return [
        { name: SCALE_HANDLE_NAMES.NW, x: minX, y: minY },
        { name: SCALE_HANDLE_NAMES.NE, x: maxX, y: minY },
        { name: SCALE_HANDLE_NAMES.SE, x: maxX, y: maxY },
        { name: SCALE_HANDLE_NAMES.SW, x: minX, y: maxY }
    ];
}

/**
 * 外枠の中心の唯一の求め方（`(min + max) / 2`）。検証はしない。引数を書き換えず、毎回新しいオブジェクトを返す。
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bounds 外枠
 * @returns {{x: number, y: number}} 中心（ワールド）
 */
export function computeFrameCenter(bounds) {
    return { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
}

/**
 * 出す外枠とハンドルを組み立てる（描画と当たりが共有する唯一の組み立て）。
 * - `mode`が選択（`OperationMode.SELECT`）以外・`bounds`が`null`・`viewScale`が正の有限でない・`bounds`の値が有限でない → `null`。
 * - 幅・高さがともに0 → `null`（外枠もハンドルも出さない）。
 * - 幅が0（高さ>0）→ `n`・`s`だけ。高さが0（幅>0）→ `w`・`e`だけ。
 * - それ以外 → 角の4つは常に出す。`n`・`s`は`幅 × viewScale ≥ SCALE_EDGE_HANDLE_MIN_SCREEN_PX`のとき、`e`・`w`は`高さ × viewScale ≥ …`のときだけ出す。
 * - 並び：辺（`n`・`e`・`s`・`w`の順で出すものだけ）→ 角（`nw`・`ne`・`se`・`sw`）。後ろほど優先（角が優先）。
 * 引数を書き換えない。`bounds`は新しいオブジェクトに写して返す。
 * @param {string} mode 操作モード（`OperationMode`の値）
 * @param {{minX: number, minY: number, maxX: number, maxY: number}|null} bounds 選んでいる図形全体の線を含まない外枠
 * @param {number} viewScale 表示倍率
 * @returns {ScaleFrame|null} 外枠とハンドル。出さないなら`null`
 */
export function collectScaleFrame(mode, bounds, viewScale) {
    if (mode !== OperationMode.SELECT || !bounds || !isPositiveFinite(viewScale) || !isFiniteBounds(bounds)) {
        return null;
    }
    const { minX, minY, maxX, maxY } = bounds;
    const width = maxX - minX;
    const height = maxY - minY;
    if (width === 0 && height === 0) {
        return null;
    }
    const center = computeFrameCenter({ minX, minY, maxX, maxY });
    const cx = center.x;
    const cy = center.y;
    const showTopBottom = width === 0 ? true : (height === 0 ? false : width * viewScale >= SCALE_EDGE_HANDLE_MIN_SCREEN_PX);
    const showLeftRight = height === 0 ? true : (width === 0 ? false : height * viewScale >= SCALE_EDGE_HANDLE_MIN_SCREEN_PX);
    /** @type {ScaleHandle[]} */
    const handles = [];
    if (showTopBottom) {
        handles.push({ name: SCALE_HANDLE_NAMES.N, x: cx, y: minY });
    }
    if (showLeftRight) {
        handles.push({ name: SCALE_HANDLE_NAMES.E, x: maxX, y: cy });
    }
    if (showTopBottom) {
        handles.push({ name: SCALE_HANDLE_NAMES.S, x: cx, y: maxY });
    }
    if (showLeftRight) {
        handles.push({ name: SCALE_HANDLE_NAMES.W, x: minX, y: cy });
    }
    if (width !== 0 && height !== 0) {
        handles.push(...collectFrameCorners({ minX, minY, maxX, maxY }));
    }
    return { bounds: { minX, minY, maxX, maxY }, handles };
}

/**
 * カーソル位置の下にあるハンドルを返す。`handles`を末尾から見て、中心から縦横とも`SCALE_HANDLE_HIT_SCREEN_PX / viewScale`以内（境界を含む）の最初のもの（角が辺より優先）。
 * @param {ScaleFrame|null} frame `collectScaleFrame`の結果
 * @param {{x: number, y: number}} point カーソル位置（ワールド）
 * @param {number} viewScale 表示倍率
 * @returns {string|null} ハンドル名。`frame`が`null`・`viewScale`が正の有限でない・当たらないなら`null`
 */
export function hitTestScaleHandle(frame, point, viewScale) {
    if (!frame || !isPositiveFinite(viewScale)) {
        return null;
    }
    const r = SCALE_HANDLE_HIT_SCREEN_PX / viewScale;
    for (let i = frame.handles.length - 1; i >= 0; i--) {
        const h = frame.handles[i];
        if (Math.abs(point.x - h.x) <= r && Math.abs(point.y - h.y) <= r) {
            return h.name;
        }
    }
    return null;
}

/**
 * ハンドル名からCSSの`cursor`値を返す（カーソルの向きの表の唯一の箇所）。
 * `nw`・`se`→`'nwse-resize'`、`ne`・`sw`→`'nesw-resize'`、`e`・`w`→`'ew-resize'`、`n`・`s`→`'ns-resize'`。
 * @param {string|null} name ハンドル名
 * @returns {string|null} `cursor`値。`null`・未知の値は`null`
 */
export function resolveScaleHandleCursor(name) {
    switch (name) {
        case SCALE_HANDLE_NAMES.NW:
        case SCALE_HANDLE_NAMES.SE:
            return 'nwse-resize';
        case SCALE_HANDLE_NAMES.NE:
        case SCALE_HANDLE_NAMES.SW:
            return 'nesw-resize';
        case SCALE_HANDLE_NAMES.E:
        case SCALE_HANDLE_NAMES.W:
            return 'ew-resize';
        case SCALE_HANDLE_NAMES.N:
        case SCALE_HANDLE_NAMES.S:
            return 'ns-resize';
        default:
            return null;
    }
}

/**
 * 1つの軸の計算結果（`computeBoundsScale`の内部）。モジュール内だけで使う。
 * @typedef {Object} AxisState
 * @property {boolean} pulled 引く軸か
 * @property {number} origin 動かない点
 * @property {number} raw 丸めない倍率（引かない軸は1）
 * @property {number} target 動く辺の元の位置と動かない点の差（引かない軸は0）
 * @property {number} pointer カーソル位置のこの軸の値
 */

/**
 * 1つの軸の動かない点・丸めない倍率を求める（`computeBoundsScale`の手順1〜3）。モジュール内だけで使う。
 * @param {number} dir ハンドルが引く向き（−1＝最小側の辺、+1＝最大側の辺、0＝引かない）
 * @param {number} min 外枠の最小値
 * @param {number} max 外枠の最大値
 * @param {number} pointerValue カーソル位置のこの軸の値
 * @param {boolean} fromCenter 中心を動かさないか
 * @param {number} center 外枠の中心のこの軸の値（`computeFrameCenter`の結果）
 * @returns {AxisState} 軸の状態
 */
function readAxis(dir, min, max, pointerValue, fromCenter, center) {
    if (dir === 0 || max - min === 0) {
        return { pulled: false, origin: center, raw: 1, target: 0, pointer: pointerValue };
    }
    const edge = dir > 0 ? max : min;
    const origin = fromCenter ? center : (dir > 0 ? min : max);
    return { pulled: true, origin, raw: (pointerValue - origin) / (edge - origin), target: edge - origin, pointer: pointerValue };
}

/**
 * 丸めた目標位置から倍率を求め、ちょうど0なら直前の倍率にする（`computeBoundsScale`の手順5・6）。モジュール内だけで使う。
 * @param {AxisState} axis 軸の状態
 * @param {number} snapped 丸めたカーソル位置のこの軸の値
 * @param {number} previousScale 直前の倍率
 * @returns {number} 倍率
 */
function snapAxisScale(axis, snapped, previousScale) {
    const s = (snapped - axis.origin) / axis.target;
    return s === 0 ? previousScale : s;
}

/**
 * 倍率と動かない点を求める（倍率と動かない点の計算とスナップの当て方の唯一の箇所）。引数を書き換えない。
 * 手順（`x`で書く。`y`も同じ。引く＝そのハンドルが動かす軸、角＝名前が2文字）：
 * 1. 軸の役割：`'w'`を含めば横の動く辺は`minX`、`'e'`なら`maxX`、どちらも含まなければ横は引かない。縦は`'n'`→`minY`、`'s'`→`maxY`。長さが0の軸は引かない軸と同じ（倍率1）。
 * 2. 動かない点：引く軸は`fromCenter`なら外枠の中心、そうでなければ反対側の辺。引かない軸は中心。
 * 3. 丸めない倍率：`raw = (pointer − 動かない点) / (動く辺の元の位置 − 動かない点)`。
 * 4. 倍率を決める向き（角で`keepAspect`かつ両方の軸を引くときだけ）：`|rawX − 1| ≥ |rawY − 1|`なら横、そうでなければ縦（同じなら横）。
 * 5. 丸め：丸める軸＝角で`keepAspect`でない→引く軸すべて、角で`keepAspect`→倍率を決めた向きだけ、辺→その軸だけ。目標の位置`roundPointToUnit(pointer, step)`を使い`s = (目標 − 動かない点) / (動く辺の元の位置 − 動かない点)`（刻みの目への絶対位置の丸め）。丸めない軸は`s = raw`。`step`が`null`なら丸めない。
 * 6. ちょうど0の位置：引く軸の`s`が0なら`previous`の倍率のまま。角で`keepAspect`は、倍率を決めた向きが0なら両方とも`previous`のまま。
 * 7. 組み合わせ：辺・`keepAspect`なし→引く軸＝`s`・もう一方＝1。辺・`keepAspect`→引く軸＝`s`・もう一方（長さが0でなければ）＝`|s|`（裏返らない。動かない点は中心）・長さ0なら1。
 *    角・`keepAspect`なし→`sX`・`sY`。角・`keepAspect`→`m = |倍率を決めた向きのs|`、倍率を決めた向きの符号は丸めた後の`s`の符号、もう一方の向きの符号はその向きの`raw`の符号（ちょうど0なら`previous`の符号）、`scale = 符号 · m`。長さ0の軸は常に1。
 * 8. 戻り値`{ scaleX, scaleY, originX, originY }`。
 * 精度の注意：倍率は割り算で求めるため、ちょうど表せない値では引いた辺の位置が刻みの目から浮動小数の誤差（`1e-12`程度以下）だけずれることがある（許容）。
 * @param {BoundsScaleInput} input 引数
 * @returns {BoundsScale} 倍率と動かない点（新しいオブジェクト）
 * @throws {Error} 未知の`handle`のとき
 */
export function computeBoundsScale(input) {
    const { handle, bounds, pointer, keepAspect, fromCenter, step, previous } = input;
    if (!Object.values(SCALE_HANDLE_NAMES).includes(handle)) {
        throw new Error(`computeBoundsScale: 未知のハンドル名です: ${handle}`);
    }
    const isCorner = handle.length === 2;
    const dirX = handle.includes('w') ? -1 : (handle.includes('e') ? 1 : 0);
    const dirY = handle.includes('n') ? -1 : (handle.includes('s') ? 1 : 0);
    const center = computeFrameCenter(bounds);
    const axisX = readAxis(dirX, bounds.minX, bounds.maxX, pointer.x, fromCenter, center.x);
    const axisY = readAxis(dirY, bounds.minY, bounds.maxY, pointer.y, fromCenter, center.y);
    const snapped = roundPointToUnit({ x: pointer.x, y: pointer.y }, step);

    const bothPulled = axisX.pulled && axisY.pulled;
    if (isCorner && keepAspect && bothPulled) {
        const dominantIsX = Math.abs(axisX.raw - 1) >= Math.abs(axisY.raw - 1);
        const dominant = dominantIsX ? axisX : axisY;
        const dominantSnapped = dominantIsX ? snapped.x : snapped.y;
        const s = (dominantSnapped - dominant.origin) / dominant.target;
        if (s === 0) {
            return { scaleX: previous.scaleX, scaleY: previous.scaleY, originX: axisX.origin, originY: axisY.origin };
        }
        const m = Math.abs(s);
        const signS = s < 0 ? -1 : 1;
        const rawSignX = axisX.raw === 0 ? (previous.scaleX < 0 ? -1 : 1) : (axisX.raw < 0 ? -1 : 1);
        const rawSignY = axisY.raw === 0 ? (previous.scaleY < 0 ? -1 : 1) : (axisY.raw < 0 ? -1 : 1);
        const signX = dominantIsX ? signS : rawSignX;
        const signY = dominantIsX ? rawSignY : signS;
        return { scaleX: signX * m, scaleY: signY * m, originX: axisX.origin, originY: axisY.origin };
    }

    const sX = axisX.pulled ? snapAxisScale(axisX, snapped.x, previous.scaleX) : 1;
    const sY = axisY.pulled ? snapAxisScale(axisY, snapped.y, previous.scaleY) : 1;
    let scaleX = sX;
    let scaleY = sY;
    if (!isCorner && keepAspect) {
        if (axisX.pulled) {
            scaleY = bounds.maxY - bounds.minY !== 0 ? Math.abs(sX) : 1;
        } else if (axisY.pulled) {
            scaleX = bounds.maxX - bounds.minX !== 0 ? Math.abs(sY) : 1;
        }
    }
    return { scaleX, scaleY, originX: axisX.origin, originY: axisY.origin };
}

/**
 * 倍率と動かない点から、動かない点を固定した縦横の拡大縮小・裏返しの変換を組み立てる。
 * `{ a: scaleX, b: 0, c: 0, d: scaleY, e: originX − scaleX · originX, f: originY − scaleY · originY }`。
 * @param {BoundsScale} scale `computeBoundsScale`の結果
 * @returns {import('../shapes/ShapeGeometry.js').AffineTransform} 変換（新しいオブジェクト）
 */
export function toScaleTransform(scale) {
    return {
        a: scale.scaleX,
        b: 0,
        c: 0,
        d: scale.scaleY,
        e: scale.originX - scale.scaleX * scale.originX,
        f: scale.originY - scale.scaleY * scale.originY
    };
}
