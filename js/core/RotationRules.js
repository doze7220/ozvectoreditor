/**
 * 責務: 選択（V）の外枠の角の外側の回転の範囲の当たり・回転のカーソルの絵と向きと、回した角度・回転の変換・回している間の外枠の位置の規則を、状態を持たない関数として提供する。
 * `ScaleHandleRules`（外枠の角・ハンドルの当たり）・`ReferencePointRules`（基準点の位置）と`shapes/ShapeGeometry`（点への変換）だけをimportする。DOM・図形・VectorModel・修飾キーの読み取り・座標のスナップを知らない。
 */
import { SCALE_HANDLE_NAMES, hitTestScaleHandle, collectFrameCorners } from './ScaleHandleRules.js';
import { resolveReferencePointPosition } from './ReferencePointRules.js';
import { applyAffineTransformToPoint } from '../shapes/ShapeGeometry.js';

/**
 * 回転の範囲の広さ（角からの画面上px）。ワールド座標では`この値 / 表示倍率`。
 * @type {number}
 */
export const ROTATION_ZONE_SCREEN_PX = 20;

/**
 * `Shift`を押したときの回転の刻み（15°。ラジアン）。
 * @type {number}
 */
export const ROTATION_SNAP_STEP = Math.PI / 12;

/**
 * 回転のカーソルのホットスポット（カーソル画像の中の位置。px）。
 * @type {Readonly<{x: number, y: number}>}
 */
export const ROTATION_CURSOR_HOTSPOT = Object.freeze({ x: 12, y: 12 });

/**
 * 変換の角度が90°の倍数とみなす許容量（ラジアン）。この範囲内ならちょうどの`cos`・`sin`を使う。
 * @type {number}
 */
const RIGHT_ANGLE_EPSILON = 1e-9;

/**
 * 回転のカーソルの絵の基準（右上`ne`の向き）。`DEG`を角ごとの角度に置き換えて使う。
 * 24×24。白い縁取りの上に黒の線（白黒どちらの背景でも見える）。
 * @type {string}
 */
const ROTATION_CURSOR_SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">'
    + '<g transform="rotate(DEG 12 12)">'
    + '<path d="M4 8A12 12 0 0 1 16 20" fill="none" stroke="#ffffff" stroke-width="4"/>'
    + '<path d="M1 8L5 4.5L5 11.5ZM16 23L12.5 19L19.5 19Z" fill="#000000" stroke="#ffffff" stroke-width="1"/>'
    + '<path d="M4 8A12 12 0 0 1 16 20" fill="none" stroke="#000000" stroke-width="1.5"/>'
    + '</g></svg>';

/**
 * 角の名前と、基準の絵からの傾き（度）の対応。
 * @type {Readonly<Record<string, number>>}
 */
const ROTATION_CURSOR_DEGREES = Object.freeze({
    [SCALE_HANDLE_NAMES.NE]: 0,
    [SCALE_HANDLE_NAMES.SE]: 90,
    [SCALE_HANDLE_NAMES.SW]: 180,
    [SCALE_HANDLE_NAMES.NW]: 270
});

/**
 * 角の名前ごとのCSSの`cursor`値の表（モジュールの読み込み時に1回組み立てる）。
 * @type {Readonly<Record<string, string>>}
 */
const ROTATION_CURSORS = Object.freeze(Object.fromEntries(
    Object.entries(ROTATION_CURSOR_DEGREES).map(([corner, degrees]) => {
        const svg = ROTATION_CURSOR_SVG.replace('DEG', String(degrees));
        return [corner, `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${ROTATION_CURSOR_HOTSPOT.x} ${ROTATION_CURSOR_HOTSPOT.y}, auto`];
    })
));

/**
 * 回した角度の入力。
 * @typedef {Object} RotationAngleInput
 * @property {{x: number, y: number}} center 回転の中心（ワールド）
 * @property {{x: number, y: number}} origin 押した位置（ワールド）
 * @property {{x: number, y: number}} pointer 今のカーソル位置（ワールド）
 * @property {number} previousRaw 直前の丸めない角度（ラジアン。引き始めは0）
 * @property {boolean} snapToStep `Shift`が押されているか（15°刻みにするか）
 */

/**
 * 回した角度。画面の時計回りが正。
 * @typedef {Object} RotationAngle
 * @property {number} raw 丸めない角度（ラジアン。何周でも続く値。次の呼び出しの`previousRaw`に渡す）
 * @property {number} angle 当てる角度（ラジアン。`Shift`なら`raw`を最も近い15°の倍数にした値）
 */

/**
 * 回している間の外枠の控え（`InputTracker.getRotationDragView()`の戻り値）。
 * @typedef {Object} RotationDragView
 * @property {import('./ScaleHandleRules.js').ScaleFrame} frame 押下時の外枠
 * @property {{x: number, y: number}} center 回転の中心（ワールド）
 * @property {number} angle 今当てている角度（ラジアン。時計回りが正）
 */

/**
 * 回した外枠。`ScaleFrame`に、回した4つの角を足した形。
 * @typedef {Object} RotatedScaleFrame
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds 回す前の外枠（写し）
 * @property {{x: number, y: number}[]} corners 回した角の4点（`nw`・`ne`・`se`・`sw`の順）
 * @property {import('./ScaleHandleRules.js').ScaleHandle[]} handles 回した位置のハンドル（名前・並びは変わらない）
 */

/**
 * 正の有限の数値か。
 * @param {*} value 判定する値
 * @returns {boolean} 正の有限の数値なら`true`
 */
function isPositiveFinite(value) {
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * `-0`を0にする。
 * @param {number} value 数値
 * @returns {number} `-0`なら0、それ以外はそのまま
 */
function normalizeZero(value) {
    return value === 0 ? 0 : value;
}

/**
 * カーソル位置が当たる回転の範囲の角を返す。
 * - `frame`が`null`・`viewScale`が正の有限でない → `null`。
 * - 外枠のハンドルの当たりの上（`hitTestScaleHandle`）→ `null`（拡大縮小が優先）。
 * - 外枠の矩形の内側・境界上（幅か高さが0なら線分の上）→ `null`。
 * - それ以外は、角から`ROTATION_ZONE_SCREEN_PX / viewScale`以内（境界を含む）のうち最も近い角の名前（同じ距離なら並びの先）。
 * @param {import('./ScaleHandleRules.js').ScaleFrame|null} frame `collectScaleFrame`の結果
 * @param {{x: number, y: number}} point カーソル位置（ワールド）
 * @param {number} viewScale 表示倍率
 * @returns {string|null} 角の名前（`'nw'`・`'ne'`・`'se'`・`'sw'`）。当たらないなら`null`
 */
export function hitTestRotationZone(frame, point, viewScale) {
    if (!frame || !isPositiveFinite(viewScale)) {
        return null;
    }
    if (hitTestScaleHandle(frame, point, viewScale) !== null) {
        return null;
    }
    const { minX, minY, maxX, maxY } = frame.bounds;
    if (point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY) {
        return null;
    }
    const radius = ROTATION_ZONE_SCREEN_PX / viewScale;
    let bestName = null;
    let bestDistance = Infinity;
    for (const corner of collectFrameCorners(frame.bounds)) {
        const distance = Math.hypot(point.x - corner.x, point.y - corner.y);
        if (distance <= radius && distance < bestDistance) {
            bestName = corner.name;
            bestDistance = distance;
        }
    }
    return bestName;
}

/**
 * 角の名前から回転のカーソルのCSSの`cursor`値を返す（絵と向きの表の唯一の箇所）。
 * @param {string|null} corner 角の名前
 * @returns {string|null} `url("data:image/svg+xml,…") 12 12, auto`の形の値。`nw`・`ne`・`se`・`sw`以外・`null`は`null`
 */
export function resolveRotationCursor(corner) {
    if (typeof corner !== 'string' || !Object.hasOwn(ROTATION_CURSORS, corner)) {
        return null;
    }
    return ROTATION_CURSORS[corner];
}

/**
 * 回転の中心（引き始めの外枠の上の基準点）を返す。位置の求め方は`ReferencePointRules.resolveReferencePointPosition`の1か所（写さない）。
 * 基準点を省く・`null`・基準点の名前でない値は外枠の中心（`computeFrameCenter(frame.bounds)`と同じ値）。
 * @param {import('./ScaleHandleRules.js').ScaleFrame} frame 押下時の外枠
 * @param {string|null} [referencePoint] 基準点の名前（`REFERENCE_POINT`の値）
 * @returns {{x: number, y: number}} 回転の中心（ワールド。新しいオブジェクト）
 */
export function computeRotationCenter(frame, referencePoint) {
    return resolveReferencePointPosition(frame.bounds, referencePoint);
}

/**
 * 回した角度を求める（唯一の箇所）。画面はy軸が下向きのため、`atan2`が増える向き＝カーソルを時計回りに動かす向きで、`angle`が正なら時計回り。
 * 手順：
 * 1. カーソルが中心に重なる（`dx === 0 && dy === 0`）なら`raw = previousRaw`（直前の角度のまま）。
 * 2. それ以外は`target = atan2(pointer − center) − atan2(origin − center)`、`delta = target − previousRaw`を`[−π, π]`へ寄せ（`delta − 2π·round(delta / 2π)`）、`raw = previousRaw + delta`（±180°の境目で跳ねず、何周でも追従する）。
 * 3. `snapToStep`なら`angle`は`raw`を最も近い15°の倍数にした値（ちょうど中間は0から遠い側。`-0`は0）。そうでなければ`angle = raw`。
 * 座標のスナップは使わない（回転にはスナップを当てない）。引数を書き換えない。
 * @param {RotationAngleInput} input 入力
 * @returns {RotationAngle} 丸めない角度と、当てる角度（ラジアン）
 */
export function computeRotationAngle(input) {
    const { center, origin, pointer, previousRaw, snapToStep } = input;
    const dx = pointer.x - center.x;
    const dy = pointer.y - center.y;
    let raw = previousRaw;
    if (!(dx === 0 && dy === 0)) {
        const target = Math.atan2(dy, dx) - Math.atan2(origin.y - center.y, origin.x - center.x);
        const rawDelta = target - previousRaw;
        const delta = rawDelta - 2 * Math.PI * Math.round(rawDelta / (2 * Math.PI));
        raw = previousRaw + delta;
    }
    let angle = raw;
    if (snapToStep) {
        angle = Math.sign(raw) * Math.round(Math.abs(raw) / ROTATION_SNAP_STEP) * ROTATION_SNAP_STEP;
    }
    return { raw: normalizeZero(raw), angle: normalizeZero(angle) };
}

/**
 * 中心の周りに`angle`だけ回すアフィン変換を組み立てる。画面の見た目で時計回りが正（y軸下向き）。
 * 点`(x, y)`→`(cos·x − sin·y + e, sin·x + cos·y + f)`、`e = center.x − (cos·center.x − sin·center.y)`、`f = center.y − (sin·center.x + cos·center.y)`。
 * `angle`が90°の倍数から`1e-9`ラジアン以内なら、ちょうどの`cos`・`sin`（0・±1）を使う（`Shift`の90°・180°で座標に誤差を入れないため）。`angle`が0なら恒等の変換。
 * `-0`は0にする。引数を書き換えず、新しいオブジェクトを返す。
 * @param {{x: number, y: number}} center 回転の中心（ワールド）
 * @param {number} angle 回す角度（ラジアン。時計回りが正）
 * @returns {import('../shapes/ShapeGeometry.js').AffineTransform} 回転の変換
 */
export function toRotationTransform(center, angle) {
    let cos = Math.cos(angle);
    let sin = Math.sin(angle);
    const quarter = Math.round(angle / (Math.PI / 2));
    if (Math.abs(angle - quarter * (Math.PI / 2)) <= RIGHT_ANGLE_EPSILON) {
        const q = ((quarter % 4) + 4) % 4;
        cos = [1, 0, -1, 0][q];
        sin = [0, 1, 0, -1][q];
    }
    return {
        a: normalizeZero(cos),
        b: normalizeZero(sin),
        c: normalizeZero(-sin),
        d: normalizeZero(cos),
        e: normalizeZero(center.x - (cos * center.x - sin * center.y)),
        f: normalizeZero(center.y - (sin * center.x + cos * center.y))
    };
}

/**
 * 外枠を変換で回した形を返す。`bounds`は写し、`corners`は外枠の4つの角（`nw`・`ne`・`se`・`sw`の順）を写した点、`handles`は各ハンドルの位置だけを写す（名前・並びは同じ）。
 * 点の写しは`applyAffineTransformToPoint`。引数を書き換えない。
 * @param {import('./ScaleHandleRules.js').ScaleFrame} frame 回す前の外枠
 * @param {import('../shapes/ShapeGeometry.js').AffineTransform} transform 回転の変換
 * @returns {RotatedScaleFrame} 回した外枠
 */
export function rotateScaleFrame(frame, transform) {
    const { minX, minY, maxX, maxY } = frame.bounds;
    return {
        bounds: { minX, minY, maxX, maxY },
        corners: collectFrameCorners(frame.bounds).map((corner) => applyAffineTransformToPoint(transform, corner)),
        handles: frame.handles.map((handle) => {
            const p = applyAffineTransformToPoint(transform, handle);
            return { name: handle.name, x: p.x, y: p.y };
        })
    };
}

/**
 * 表示する外枠を選ぶ。`rotationView`が`null`なら`frame`をそのまま返し、あれば引き始めの外枠を回した形を返す（回している間は図形から求め直さない）。
 * @param {import('./ScaleHandleRules.js').ScaleFrame|null} frame 今の図形から求めた外枠
 * @param {RotationDragView|null} rotationView 回している間の控え。回していなければ`null`
 * @returns {import('./ScaleHandleRules.js').ScaleFrame|RotatedScaleFrame|null} 表示する外枠
 */
export function resolveDisplayedScaleFrame(frame, rotationView) {
    if (!rotationView) {
        return frame;
    }
    return rotateScaleFrame(rotationView.frame, toRotationTransform(rotationView.center, rotationView.angle));
}
