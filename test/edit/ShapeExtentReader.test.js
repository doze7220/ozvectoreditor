/**
 * 責務: ShapeExtentReader（選択中の図形・全図形の外枠の照会）の振る舞いを、実物のVectorModelと図形を使い公開APIのみで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ShapeExtentReader } from '../../js/edit/ShapeExtentReader.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * 3つの図形（Rect・Line・Rect）を入れた実物のVectorModelと照会クラスを作る。
 * @returns {{ model: VectorModel, reader: ShapeExtentReader, ids: Array<string> }} モデル・照会クラス・図形のid（描画順）
 */
function setup() {
    const model = new VectorModel();
    const ids = model.addShapesWithNewIds([
        new Rect(0, 0, 10, 10, '#000000', 2, null),
        new Line(100, 100, 120, 130, '#000000', 2),
        new Rect(-50, -40, -20, -10, '#000000', 2, '#ff0000'),
    ]);
    model.clearSelection();
    return { model, reader: new ShapeExtentReader({ model }), ids };
}

describe('ShapeExtentReader.getSelectedBounds', () => {
    it('選択なしでnull', () => {
        const { reader } = setup();
        assert.equal(reader.getSelectedBounds(), null);
    });

    it('1つ選択すると、その図形だけの外枠（書き出しの外枠と同じ求め方）', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[1]]);
        const selectedShapes = model.getShapes().filter((shape) => shape.id === ids[1]);
        assert.deepEqual(reader.getSelectedBounds(), SpriteSerializer.serialize(selectedShapes).bounds);
    });

    it('複数選択すると、選んだ図形の和の外枠で、選ばない図形は含まない', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[0], ids[1]]);
        const selectedShapes = model.getShapes().filter((shape) => shape.id !== ids[2]);
        const bounds = reader.getSelectedBounds();
        assert.deepEqual(bounds, SpriteSerializer.serialize(selectedShapes).bounds);
        assert.notDeepEqual(bounds, reader.getAllBounds());
    });

    it('選択の変更に追従する', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[0]]);
        const first = reader.getSelectedBounds();
        model.setSelection([ids[2]]);
        const second = reader.getSelectedBounds();
        assert.notDeepEqual(first, second);
        model.clearSelection();
        assert.equal(reader.getSelectedBounds(), null);
    });
});

describe('ShapeExtentReader.getAllBounds', () => {
    it('図形0個でnull', () => {
        const reader = new ShapeExtentReader({ model: new VectorModel() });
        assert.equal(reader.getAllBounds(), null);
    });

    it('全図形の値がSpriteSerializer.serialize(model.getShapes()).boundsと同じ（選択に依らない）', () => {
        const { model, reader, ids } = setup();
        const expected = SpriteSerializer.serialize(model.getShapes()).bounds;
        assert.deepEqual(reader.getAllBounds(), expected);
        model.setSelection([ids[0]]);
        assert.deepEqual(reader.getAllBounds(), expected);
    });
});

describe('ShapeExtentReader の副作用', () => {
    it('図形・選択集合を変えず、onChangeを呼ばない', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[0], ids[2]]);
        const shapesBefore = model.getShapes();
        const jsonBefore = shapesBefore.map((shape) => shape.toJSON());
        const selectedBefore = model.getSelectedIds();
        let changeCount = 0;
        model.onChange(() => { changeCount += 1; });

        reader.getSelectedBounds();
        reader.getAllBounds();

        const shapesAfter = model.getShapes();
        assert.equal(shapesAfter.length, shapesBefore.length);
        shapesAfter.forEach((shape, i) => assert.equal(shape, shapesBefore[i]));
        assert.deepEqual(shapesAfter.map((shape) => shape.toJSON()), jsonBefore);
        assert.deepEqual(model.getSelectedIds(), selectedBefore);
        assert.equal(changeCount, 0);
    });
});
