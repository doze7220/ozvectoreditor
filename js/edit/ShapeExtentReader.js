/**
 * 責務：選択中の図形・全図形の外枠（書き出しの外枠`bounds`と同じ求め方）の照会のみを担う。
 * DOMに触れず、図形・選択集合・履歴を変更しない。
 */

import { SpriteSerializer } from '../io/SpriteSerializer.js';

/**
 * 図形の外枠の照会クラス。main.jsが1つだけ生成する。
 * 外枠の求め方は`SpriteSerializer.computeShapesBounds`に任せ、本クラスは対象の図形の絞り込みだけを持つ。
 */
export class ShapeExtentReader {
    /** @type {{ getShapes: function(): Array<Object>, isSelected: function(string): boolean }} */
    #model;

    /**
     * @param {Object} deps 依存
     * @param {Object} deps.model VectorModel（`getShapes`・`isSelected`を使う）
     */
    constructor({ model }) {
        this.#model = model;
    }

    /**
     * 選択中の図形の外枠を求める（描画順のまま。見えない図形も含む）。
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 外枠。選択なしならnull
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ（未知の`kind`・`toDrawElement`を持たない要素）
     */
    getSelectedBounds() {
        const selectedShapes = this.#model.getShapes().filter((shape) => this.#model.isSelected(shape.id));
        return SpriteSerializer.computeShapesBounds(selectedShapes);
    }

    /**
     * 全図形の外枠を求める（見えない図形も含む。`SpriteSerializer.serialize(model.getShapes()).bounds`と同じ値）。
     * @returns {{minX: number, minY: number, maxX: number, maxY: number}|null} 外枠。図形0個ならnull
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ
     */
    getAllBounds() {
        return SpriteSerializer.computeShapesBounds(this.#model.getShapes());
    }
}
