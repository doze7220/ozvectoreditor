/**
 * 責務：選択中で変えられる図形・見えている図形全部・選択中で変えられる図形1つずつ・渡された図形1つの外枠（書き出しの外枠`bounds`と同じ求め方）と、選択中で変えられる図形の線を含まない外枠の照会のみを担う。
 * DOMに触れず、図形・選択集合・履歴を変更しない。
 */

import { SpriteSerializer } from '../io/SpriteSerializer.js';

/**
 * 図形1つの外枠の照会結果。`edit/ShapeAlignRules.js`のtypedef`AlignItem`と同じ形の二重定義
 * （形を変えるときは両方をそろえる）。
 * @typedef {Object} ShapeBoundsEntry
 * @property {string} id 図形のid
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds その図形の外枠（線の太さの半分を含む）
 */

/**
 * 図形の外枠（選択中で変えられる図形・見えている図形全部・選択中で変えられる図形1つずつ・渡された図形1つ）の照会クラス。main.jsの`// 4.`とwiring/DisplayWiringの内部の2か所で生成する。
 * 外枠の求め方は`SpriteSerializer.computeShapesBounds`（線を含む）・`computeShapesGeometryBounds`（線を含まない）に任せ、本クラスは対象の図形の絞り込みだけを持つ。
 */
export class ShapeExtentReader {
    /** @type {{ getVisibleShapes: function(): Array<Object>, getEditableSelectedShapes: function(): Array<Object> }} */
    #model;

    /**
     * @param {Object} deps 依存
     * @param {Object} deps.model VectorModel（`getVisibleShapes`・`getEditableSelectedShapes`を使う）
     */
    constructor({ model }) {
        this.#model = model;
    }

    /**
     * 選択中で変えられる図形の外枠を求める（描画順のまま。線も塗りも無い図形は含む。隠れている・ロックされている図形は含まない）。
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 外枠。変えられる選択なしならnull
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ（未知の`kind`・`toDrawElement`を持たない要素）
     */
    getSelectedBounds() {
        const selectedShapes = this.#model.getEditableSelectedShapes();
        return SpriteSerializer.computeShapesBounds(selectedShapes);
    }

    /**
     * 選択中で変えられる図形の線を含まない外枠を求める（描画順のまま。線も塗りも無い図形は含む。隠れている・ロックされている図形は含まない。線の太さの半分を広げない形の範囲の和）。
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 線を含まない外枠。変えられる選択なしならnull
     * @throws {Error} `SpriteSerializer.computeShapesGeometryBounds`と同じ（未知の`kind`・`toDrawElement`を持たない要素）
     */
    getSelectedGeometryBounds() {
        const selectedShapes = this.#model.getEditableSelectedShapes();
        return SpriteSerializer.computeShapesGeometryBounds(selectedShapes);
    }

    /**
     * 選択中で変えられる図形1つずつの外枠を求める（描画順のまま。線も塗りも無い図形は含む。隠れている・ロックされている図形は含まない。変えられる選択なしなら空配列）。
     * 各要素の外枠の和（要素ごとの最小・最大）は`getSelectedBounds()`と同じ値になる。
     * `computeShapesBounds`が`null`を返すのは要素0個のときだけで、図形1つを渡す本メソッドでは起きない想定だが、
     * 保険として`null`の図形は結果に含めない。
     * @returns {Array<ShapeBoundsEntry>} 選択中の図形のidと外枠の配列（毎回新しい配列・新しいオブジェクト）
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ
     */
    getSelectedBoundsPerShape() {
        const entries = [];
        for (const shape of this.#model.getEditableSelectedShapes()) {
            const bounds = SpriteSerializer.computeShapesBounds([shape]);
            if (bounds === null) continue;
            entries.push({ id: shape.id, bounds });
        }
        return entries;
    }

    /**
     * 図形1つの外枠を求める（線の太さの半分を含む。選択に依らない。図形の一覧のサムネイルの収め方に使う）。
     * @param {Object} shape 図形
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 外枠
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ
     */
    getShapeBounds(shape) {
        return SpriteSerializer.computeShapesBounds([shape]);
    }

    /**
     * 見えている図形全部の外枠を求める（線も塗りも無い図形は含む。隠れている図形は含まず、ロックされている図形は含む。選択に依らない）。
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 外枠。見えている図形が0個ならnull
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ
     */
    getAllBounds() {
        return SpriteSerializer.computeShapesBounds(this.#model.getVisibleShapes());
    }
}
