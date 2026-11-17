/**
 * 責務：選択中の図形・全図形・選択中の図形1つずつの外枠（書き出しの外枠`bounds`と同じ求め方）の照会のみを担う。
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
     * 選択中の図形1つずつの外枠を求める（描画順のまま。見えない図形も含む。選択なしなら空配列）。
     * 各要素の外枠の和（要素ごとの最小・最大）は`getSelectedBounds()`と同じ値になる。
     * `computeShapesBounds`が`null`を返すのは要素0個のときだけで、図形1つを渡す本メソッドでは起きない想定だが、
     * 保険として`null`の図形は結果に含めない。
     * @returns {Array<ShapeBoundsEntry>} 選択中の図形のidと外枠の配列（毎回新しい配列・新しいオブジェクト）
     * @throws {Error} `SpriteSerializer.computeShapesBounds`と同じ
     */
    getSelectedBoundsPerShape() {
        const entries = [];
        for (const shape of this.#model.getShapes()) {
            if (!this.#model.isSelected(shape.id)) continue;
            const bounds = SpriteSerializer.computeShapesBounds([shape]);
            if (bounds === null) continue;
            entries.push({ id: shape.id, bounds });
        }
        return entries;
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
