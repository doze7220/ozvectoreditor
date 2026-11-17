/**
 * 責務: 頂点の選択モードで描く頂点のハンドルの一覧、ハンドル名が頂点のハンドルかの判定、範囲に入る頂点を集めること、
 * 選んでいる頂点の範囲を求めることを、図形の共通メソッドだけを使う状態を持たない関数として提供する。DOMに触れない。
 */
import { OperationMode } from './InputModes.js';

/**
 * 頂点の選択モードで描く頂点のハンドルを、図形ごとに集める。引数は書き換えず、例外も投げない前提で共通メソッドを呼ぶ。
 * `mode`が`OperationMode.VERTEX`でなければ空配列。そうでなければ`shapes`の並び（描画順）のうち`selectedIds`に含まれる図形について、
 * `getVertexHandleNames()`の順に`getHandlePosition(name)`で位置を求め（`null`は飛ばす）、`selectedVertices`に同じ組があれば`selected: true`にする。
 * ハンドルが0個の図形は結果に含めない。
 * @param {string} mode 操作モード
 * @param {Array<Object>} shapes 図形の並び（描画順）
 * @param {Iterable<string>|Array<string>} selectedIds 選択中の図形のid
 * @param {Array<{shapeId: string, handle: string}>} selectedVertices 選ばれている頂点の組
 * @returns {Array<{shapeId: string, handles: Array<{x: number, y: number, selected: boolean}>}>} 新しい配列
 */
export function collectVertexHandles(mode, shapes, selectedIds, selectedVertices) {
    if (mode !== OperationMode.VERTEX) return [];
    const idSet = new Set(selectedIds);
    const result = [];
    for (const shape of shapes) {
        if (!idSet.has(shape.id)) continue;
        const handles = [];
        for (const name of shape.getVertexHandleNames()) {
            const position = shape.getHandlePosition(name);
            if (!position) continue;
            const selected = selectedVertices.some((pair) => pair.shapeId === shape.id && pair.handle === name);
            handles.push({ x: position.x, y: position.y, selected });
        }
        if (handles.length > 0) result.push({ shapeId: shape.id, handles });
    }
    return result;
}

/**
 * ハンドル名が、その図形の頂点のハンドルかを返す。`shape`が`null`・`undefined`でも例外を投げない。
 * @param {Object|null|undefined} shape 図形
 * @param {string} handleName ハンドル名
 * @returns {boolean} `shape`が`getVertexHandleNames`を持ち、その一覧に`handleName`が含まれるときだけ`true`
 */
export function isVertexHandle(shape, handleName) {
    if (!shape || typeof shape.getVertexHandleNames !== 'function') return false;
    return shape.getVertexHandleNames().includes(handleName);
}

/**
 * 矩形の中にある頂点を、選択中の図形から集める。対象は`selectedIds`に含まれる図形だけ（頂点が出ている図形）。
 * `shapes`の並び（描画順）→ その図形の`getVertexHandleNames()`の順に`getHandlePosition(name)`で位置を求め（`null`は飛ばす）、
 * 境界の上も含めて`minX <= x <= maxX`かつ`minY <= y <= maxY`なら集める。
 * 図形の当たり（`intersectsRect`）ではなく頂点の位置で判定するため、`intersectsRect`は使わない。
 * 矩形の正規化はここでは行わない。正規化済み（`min <= max`）の値を受け取る前提（正規化は`InputTracker`の範囲選択の確定が行う）。
 * 引数は書き換えず、例外も投げない前提で共通メソッドを呼ぶ。
 * @param {Array<Object>} shapes 図形の並び（描画順）
 * @param {Iterable<string>|Array<string>} selectedIds 選択中の図形のid
 * @param {number} minX 矩形の左端（正規化済み）
 * @param {number} minY 矩形の上端（正規化済み）
 * @param {number} maxX 矩形の右端（正規化済み）
 * @param {number} maxY 矩形の下端（正規化済み）
 * @returns {Array<{shapeId: string, handle: string}>} 矩形に入った頂点の組（新しい配列）
 */
export function collectVertexHandlesInRect(shapes, selectedIds, minX, minY, maxX, maxY) {
    const idSet = new Set(selectedIds);
    const result = [];
    for (const shape of shapes) {
        if (!idSet.has(shape.id)) continue;
        for (const name of shape.getVertexHandleNames()) {
            const position = shape.getHandlePosition(name);
            if (!position) continue;
            if (position.x >= minX && position.x <= maxX && position.y >= minY && position.y <= maxY) {
                result.push({ shapeId: shape.id, handle: name });
            }
        }
    }
    return result;
}

/**
 * 選んでいる頂点（図形idとハンドル名の組）の位置の範囲（最小・最大のX・Y）を求める。
 * 各組について`shapes`から`id`が一致する図形を引き（無ければ飛ばす）、`getHandlePosition(handle)`で位置を求め（`null`は飛ばす）、
 * 位置が求まった組だけから最小・最大を求める。線の太さは見ない（頂点の位置だけ）。頂点1つなら最小と最大が同じ値になる。
 * ハンドルが頂点として扱えるかの判定はしない（選択の時点で済んでいる前提）。
 * `collectVertexHandles`・`collectVertexHandlesInRect`とは集める条件と戻り値の形が違うため、走査を共有しない。
 * 引数は書き換えない。
 * @param {Array<Object>} shapes 図形の配列（並びは結果に影響しない）
 * @param {Array<{shapeId: string, handle: string}>} vertices 選んでいる頂点の組
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 範囲。位置が求まる組が1つも無ければ`null`
 */
export function computeVertexHandlesBounds(shapes, vertices) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let found = false;
    for (const pair of vertices) {
        const shape = shapes.find((s) => s.id === pair.shapeId);
        if (!shape) continue;
        const position = shape.getHandlePosition(pair.handle);
        if (!position) continue;
        found = true;
        minX = Math.min(minX, position.x);
        minY = Math.min(minY, position.y);
        maxX = Math.max(maxX, position.x);
        maxY = Math.max(maxY, position.y);
    }
    return found ? { minX, minY, maxX, maxY } : null;
}
