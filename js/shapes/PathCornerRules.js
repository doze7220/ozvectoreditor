/**
 * 責務: パスの点の角の状態（角／なめらか／直線の角／角の考えなし）の判定と、選んだ点から「角」のチェックボックスの表示内容と、
 * 押したときに角の状態を変えた新しいパスを組み立てる規則を、状態を持たない関数と定数として提供する。
 */
import { Path, SEGMENT_KIND_SMOOTH, readCornerFlags } from './Path.js';

/**
 * 点の角の状態の値。唯一の定義箇所。
 * @readonly
 * @enum {string}
 */
export const CornerState = Object.freeze({
    /** 角の点（両側とも打った点の曲線の区間の点で、角を立てると決めた点） */
    CORNER: 'corner',
    /** なめらかな点（両側とも打った点の曲線の区間の点で、角を立てていない点） */
    SMOOTH: 'smooth',
    /** 直線の角の点（片側でも打った点の曲線の区間でない（直線の区間・曲がり方を持つ区間）パスの点。実際に角が立っていて操作できない） */
    LINE_CORNER: 'lineCorner',
    /** 角の考えがない点（開いたパスの端の点・パス以外の図形の点・範囲外の番号） */
    NONE: 'none',
});

/**
 * 選んだ点。
 * @typedef {Object} CornerTarget
 * @property {Object} shape - 図形（`type`・`id`・`toJSON()`だけを読む）
 * @property {number} vertexIndex - 頂点の番号
 */

/**
 * 「角」のチェックボックスの表示内容。`palette/OptionBarCornerGroup.js`のtypedef`CornerToggleView`と同じ内容の二重定義（互いに存在を書く）。
 * @typedef {Object} CornerToggleView
 * @property {boolean} enabled - 押せるか（角を操作できる点が1つ以上あるか）
 * @property {boolean} checked - チェックありの見た目か
 * @property {boolean} mixed - 角とそうでない点が混ざっているか（「−」の見た目）
 */

/**
 * 切り替えの計画の1件。
 * @typedef {Object} CornerTogglePlanItem
 * @property {*} targetId - 置き換える図形のid（元の図形の`id`）
 * @property {Path} path - 角の状態を変えた新しいパス（idは`null`）
 */

/**
 * 図形のデータを`toJSON()`で読む。1回の呼び出しの中で同じ図形インスタンスは1回だけ`toJSON()`する。
 * パス以外の図形は`null`を返す（`toJSON()`を呼ばない）。
 * @param {Map<Object, Object|null>} cache - 図形ごとのデータの使い回し先（呼び出しごとに新しく作る）
 * @param {Object} shape - 図形
 * @returns {Object|null} パスの図形データ。パス以外は`null`
 */
function dataOf(cache, shape) {
    if (!cache.has(shape)) {
        cache.set(shape, shape && shape.type === 'path' ? shape.toJSON() : null);
    }
    return cache.get(shape);
}

/**
 * パスの図形データから、点の角の状態を決める。状態の判定の唯一の箇所。
 * @param {Object} data - パスの図形データ（`toJSON()`の値）
 * @param {number} vertexIndex - 頂点の番号
 * @returns {string} `CornerState`の値
 */
function cornerStateOfData(data, vertexIndex) {
    const n = data.points.length;
    if (!Number.isInteger(vertexIndex) || vertexIndex < 0 || vertexIndex >= n) {
        return CornerState.NONE;
    }
    if (!data.closed && (vertexIndex === 0 || vertexIndex === n - 1)) {
        return CornerState.NONE;
    }
    const prevIndex = data.closed ? (vertexIndex - 1 + n) % n : vertexIndex - 1;
    const prevKind = data.segments[prevIndex].kind;
    const nextKind = data.segments[vertexIndex].kind;
    if (prevKind === SEGMENT_KIND_SMOOTH && nextKind === SEGMENT_KIND_SMOOTH) {
        return readCornerFlags(data)[vertexIndex] ? CornerState.CORNER : CornerState.SMOOTH;
    }
    return CornerState.LINE_CORNER;
}

/**
 * 図形の点の角の状態を返す。判定の唯一の箇所。
 * パス以外の図形・範囲外や整数でない番号・開いたパスの端の点は`NONE`、
 * 両側とも打った点の曲線の区間なら角の情報で`CORNER`／`SMOOTH`、どちらかが打った点の曲線の区間でない（直線の区間・曲がり方を持つ区間）なら`LINE_CORNER`。
 * @param {Object} shape - 図形
 * @param {number} vertexIndex - 頂点の番号
 * @returns {string} `CornerState`の値
 */
export function resolveCornerState(shape, vertexIndex) {
    const data = dataOf(new Map(), shape);
    return data === null ? CornerState.NONE : cornerStateOfData(data, vertexIndex);
}

/**
 * 選んだ点の角の状態の一覧を、1回の呼び出しの中で図形ごとに1回だけ`toJSON()`して求める。
 * @param {CornerTarget[]} targets - 選んだ点
 * @param {Map<Object, Object|null>} cache - 図形ごとのデータの使い回し先
 * @returns {string[]} `targets`と同じ並びの`CornerState`の値
 */
function statesOf(targets, cache) {
    return targets.map(({ shape, vertexIndex }) => {
        const data = dataOf(cache, shape);
        return data === null ? CornerState.NONE : cornerStateOfData(data, vertexIndex);
    });
}

/**
 * 選んだ点から、「角」のチェックボックスの表示内容を決める。見た目の決め方の唯一の箇所。
 * 角を操作できる点（`CORNER`・`SMOOTH`）が0件なら押せず、`LINE_CORNER`が1件以上あればチェックあり。
 * 操作できる点がすべて`CORNER`ならチェックあり、すべて`SMOOTH`ならチェックなし、混ざっていれば`mixed`（チェックなし）。
 * 同じ点が2回あっても結果は変わらない。引数を書き換えない。
 * @param {CornerTarget[]} targets - 選んだ点（0件可）
 * @returns {CornerToggleView} 表示内容（`palette/OptionBarCornerGroup.js`の`CornerToggleView`と同じ内容）
 */
export function resolveCornerToggleView(targets) {
    const states = statesOf(targets, new Map());
    const cornerCount = states.filter((s) => s === CornerState.CORNER).length;
    const smoothCount = states.filter((s) => s === CornerState.SMOOTH).length;
    if (cornerCount + smoothCount === 0) {
        return { enabled: false, checked: states.includes(CornerState.LINE_CORNER), mixed: false };
    }
    if (smoothCount === 0) {
        return { enabled: true, checked: true, mixed: false };
    }
    if (cornerCount === 0) {
        return { enabled: true, checked: false, mixed: false };
    }
    return { enabled: true, checked: false, mixed: true };
}

/**
 * 「角」のチェックボックスを押したときの結果を決める。結果の決め方の唯一の箇所。
 * 次の値は、`resolveCornerToggleView(targets)`が押せなければ計画なし（空配列）、チェックありなら`false`（すべてなめらか）、
 * そうでなければ`true`（すべて角。`mixed`も角になる）。角を操作できる点（`CORNER`・`SMOOTH`）の番号だけを次の値にし、
 * 直線の角の点・角の考えがない点は変えない。図形ごと（`targets`に最初に現れた順。同じ図形インスタンスは1つにまとめる）に、
 * 角の状態が1つでも変わる図形だけを結果に入れる。新しいパスは頂点・閉じているか・区間（曲がり方を持つ区間の引っ張る点を含む）・スタイルを元のままにし、idは`null`。
 * 結果は引数と配列・頂点を共有せず、引数を書き換えない。同じ点が2回あっても結果は変わらない。
 * @param {CornerTarget[]} targets - 選んだ点（0件可）
 * @returns {CornerTogglePlanItem[]} 角の状態が変わる図形ごとの計画（変わる図形が無ければ空配列）
 */
export function planCornerToggle(targets) {
    const view = resolveCornerToggleView(targets);
    if (!view.enabled) {
        return [];
    }
    const nextValue = !view.checked;
    const cache = new Map();
    /** @type {Map<Object, number[]>} */
    const indexesByShape = new Map();
    for (const { shape, vertexIndex } of targets) {
        const data = dataOf(cache, shape);
        if (data === null) {
            continue;
        }
        if (!indexesByShape.has(shape)) {
            indexesByShape.set(shape, []);
        }
        const state = cornerStateOfData(data, vertexIndex);
        if (state === CornerState.CORNER || state === CornerState.SMOOTH) {
            indexesByShape.get(shape).push(vertexIndex);
        }
    }
    const plan = [];
    for (const [shape, indexes] of indexesByShape) {
        const data = cache.get(shape);
        const oldCorners = readCornerFlags(data);
        const newCorners = oldCorners.slice();
        for (const index of indexes) {
            newCorners[index] = nextValue;
        }
        if (newCorners.every((flag, i) => flag === oldCorners[i])) {
            continue;
        }
        const path = new Path(
            data.points,
            data.closed,
            data.strokeColor,
            data.strokeWidth,
            data.fillColor,
            data.segments,
            newCorners,
        );
        plan.push({ targetId: shape.id, path });
    }
    return plan;
}
