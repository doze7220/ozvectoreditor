/**
 * 責務: 頂点の選択モードで描く頂点のハンドルの一覧と、ハンドル名が頂点のハンドルかの判定を、
 * 図形の共通メソッドだけを使う状態を持たない関数として提供する。DOMに触れない。
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
