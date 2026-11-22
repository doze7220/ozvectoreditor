/**
 * 責務: ShapeExtentReader（選択中の図形・全図形の外枠と、選択中の図形の線を含まない外枠の照会）の振る舞いを、実物のVectorModelと図形を使い公開APIのみで検証する。
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

describe('ShapeExtentReader.getSelectedBoundsPerShape', () => {
    it('選択なしで空配列', () => {
        const { reader } = setup();
        assert.deepEqual(reader.getSelectedBoundsPerShape(), []);
    });

    it('1つ選択すると要素1件で、idが一致しboundsがgetSelectedBounds()と同じ', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[1]]);
        const entries = reader.getSelectedBoundsPerShape();
        assert.equal(entries.length, 1);
        assert.equal(entries[0].id, ids[1]);
        assert.deepEqual(entries[0].bounds, reader.getSelectedBounds());
    });

    it('複数選択すると描画順のまま、各要素の外枠が正本（図形1つのcomputeShapesBounds）と同じ', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[2], ids[0], ids[1]]);
        const entries = reader.getSelectedBoundsPerShape();
        assert.deepEqual(entries.map((entry) => entry.id), ids);
        model.getShapes().forEach((shape, i) => {
            assert.deepEqual(entries[i].bounds, SpriteSerializer.computeShapesBounds([shape]));
        });
        assert.notDeepEqual(entries[0].bounds, entries[1].bounds);
        assert.notDeepEqual(entries[1].bounds, entries[2].bounds);
    });

    it('線を描く図形は線の太さの半分だけ外側へ広がり、線なしは形の範囲のまま', () => {
        const model = new VectorModel();
        const ids = model.addShapesWithNewIds([
            new Rect(0, 0, 10, 10, '#000000', 4, null),
            new Rect(0, 0, 10, 10, null, 4, '#ff0000'),
        ]);
        model.setSelection(ids);
        const reader = new ShapeExtentReader({ model });
        const entries = reader.getSelectedBoundsPerShape();
        assert.equal(entries[0].bounds.minX, -2);
        assert.equal(entries[0].bounds.maxX, 12);
        assert.equal(entries[1].bounds.minX, 0);
        assert.equal(entries[1].bounds.maxX, 10);
    });

    it('選択中でない図形は含まない', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[0], ids[2]]);
        assert.deepEqual(reader.getSelectedBoundsPerShape().map((entry) => entry.id), [ids[0], ids[2]]);
    });

    it('モデルを変えず、onChangeを呼ばない', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[0], ids[2]]);
        const shapesBefore = model.getShapes();
        const jsonBefore = shapesBefore.map((shape) => shape.toJSON());
        const selectedBefore = model.getSelectedIds();
        let changeCount = 0;
        model.onChange(() => { changeCount += 1; });

        reader.getSelectedBoundsPerShape();

        const shapesAfter = model.getShapes();
        shapesAfter.forEach((shape, i) => assert.equal(shape, shapesBefore[i]));
        assert.deepEqual(shapesAfter.map((shape) => shape.toJSON()), jsonBefore);
        assert.deepEqual(model.getSelectedIds(), selectedBefore);
        assert.equal(changeCount, 0);
    });
});

describe('ShapeExtentReader.getSelectedGeometryBounds', () => {
    it('選択なしでnull', () => {
        const { reader } = setup();
        assert.equal(reader.getSelectedGeometryBounds(), null);
    });

    it('選択中の図形だけの線を含まない外枠（Line(100,100,120,130)・Rect(0,0,10,10)の和）', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[1]]);
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: 100, minY: 100, maxX: 120, maxY: 130 });
        model.setSelection([ids[0], ids[1]]);
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: 0, minY: 0, maxX: 120, maxY: 130 });
    });

    it('線の太さの半分だけ線を含む外枠より内側で、getSelectedBoundsの値は変わらない', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[1]]);
        assert.deepEqual(reader.getSelectedBounds(), { minX: 99, minY: 99, maxX: 121, maxY: 131 });
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: 100, minY: 100, maxX: 120, maxY: 130 });
    });

    it('線なし・塗りなしで見えない図形も含める', () => {
        const model = new VectorModel();
        const ids = model.addShapesWithNewIds([
            new Rect(0, 0, 10, 10, '#000000', 2, null),
            new Rect(50, 60, 70, 90, null, 2, null),
        ]);
        model.setSelection(ids);
        const reader = new ShapeExtentReader({ model });
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: 0, minY: 0, maxX: 70, maxY: 90 });
    });

    it('選択の変更に追従し、モデルを変えず、onChangeを呼ばない', () => {
        const { model, reader, ids } = setup();
        model.setSelection([ids[0]]);
        const jsonBefore = model.getShapes().map((shape) => shape.toJSON());
        let changeCount = 0;
        model.onChange(() => { changeCount += 1; });
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: 0, minY: 0, maxX: 10, maxY: 10 });
        model.setSelection([ids[2]]);
        const afterSelect = changeCount;
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: -50, minY: -40, maxX: -20, maxY: -10 });
        assert.equal(changeCount, afterSelect);
        assert.deepEqual(model.getShapes().map((shape) => shape.toJSON()), jsonBefore);
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
