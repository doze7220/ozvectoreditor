/**
 * 責務: 移動・変形・外枠・整列の対象が「変えられる図形」（隠れてもロックされてもいない図形）だけになることを、実物のVectorModelで検証する。
 * NudgeEditor・PositionInputEditor・TransformInputEditor・ShapeExtentReader・ShapeAlignEditorを通して確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NudgeEditor } from '../../js/edit/NudgeEditor.js';
import { PositionInputEditor } from '../../js/edit/PositionInputEditor.js';
import { TransformInputEditor } from '../../js/edit/TransformInputEditor.js';
import { ShapeExtentReader } from '../../js/edit/ShapeExtentReader.js';
import { ShapeAlignEditor } from '../../js/edit/ShapeAlignEditor.js';
import { ShapeAlignOperation } from '../../js/edit/ShapeAlignRules.js';
import { POSITION_AXIS } from '../../js/edit/PositionInputRules.js';
import { SIZE_AXIS, FLIP_AXIS } from '../../js/edit/TransformInputRules.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * idを直接代入した、線なし塗りありの矩形を作る。
 * @param {string} id 代入するid
 * @param {number} x 左
 * @param {number} y 上
 * @param {number} w 幅
 * @param {number} h 高さ
 * @returns {Rect} 矩形
 */
function box(id, x, y, w, h) {
    const rect = new Rect(x, y, x + w, y + h, null, 1, '#112233');
    rect.id = id;
    return rect;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @param {boolean} [visible] 表示
 * @param {boolean} [locked] ロック
 * @returns {Object} 図形のアイテム
 */
function item(shape, visible = true, locked = false) {
    return { kind: 'shape', shape, name: shape.id, visible, locked };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @param {Array<Object>} children 中身
 * @returns {Object} フォルダのアイテム
 */
function folder(id, visible, locked, children) {
    return { kind: 'group', id, name: id, visible, locked, children };
}

/**
 * 実物のモデルと4つのクラス・整列の編集操作を組み合わせる（選択モード）。記録先は呼び出しを数える偽物。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {Array<string>} selectedIds 選択する図形のid
 * @returns {Object} 組み合わせた実物と記録
 */
function setup(items, selectedIds) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds);
    const calls = [];
    const editRecorder = {
        beginEdit: () => calls.push('beginEdit'),
        commitEdit: () => calls.push('commitEdit')
    };
    const getMode = () => OperationMode.SELECT;
    const reader = new ShapeExtentReader({ model });
    const nudge = new NudgeEditor({ model, editRecorder, getMode });
    const position = new PositionInputEditor({ model, getMode, shapeExtentReader: reader, nudgeEditor: nudge });
    const transform = new TransformInputEditor({ model, getMode, shapeExtentReader: reader, editRecorder });
    const align = new ShapeAlignEditor({ model, editRecorder, shapeExtentReader: reader });
    return { model, calls, reader, nudge, position, transform, align };
}

/**
 * 図形の左端のx座標を、idで引けるように返す。
 * @param {VectorModel} model モデル
 * @returns {Object<string, number>} idから左端のxへの対応
 */
function lefts(model) {
    const result = {};
    for (const shape of model.getShapes()) result[shape.id] = shape.toJSON().points[0].x;
    return result;
}

/**
 * 図形の幅を、idで引けるように返す。
 * @param {VectorModel} model モデル
 * @returns {Object<string, number>} idから幅への対応
 */
function widths(model) {
    const result = {};
    for (const shape of model.getShapes()) {
        const points = shape.toJSON().points;
        result[shape.id] = points[1].x - points[0].x;
    }
    return result;
}

/**
 * 変えられる図形A（x=10）・ロックしたB（x=100）・隠したC（x=200）が混ざった入力を作る。
 * @returns {Array<Object>} アイテムの入れ子
 */
function mixedItems() {
    return [
        item(box('A', 10, 10, 20, 20)),
        item(box('B', 100, 10, 20, 20), true, true),
        item(box('C', 200, 10, 20, 20), false, false)
    ];
}

/**
 * 8つの整列・分布がすべて押せないことを返す。
 * @param {ShapeAlignEditor} align 整列の編集操作
 * @returns {boolean} すべて押せないなら`true`
 */
function noneAvailable(align) {
    return Object.values(align.getAvailability()).every((v) => v === false);
}

describe('移動・変形・外枠の対象: 混ざったとき', () => {
    it('Nudgeは変えられる図形だけを動かす', () => {
        const { model, nudge } = setup(mixedItems(), ['A', 'B', 'C']);
        assert.equal(nudge.nudge(5, 0), true);
        assert.deepEqual(lefts(model), { A: 15, B: 100, C: 200 });
    });

    it('位置の入力は変えられる図形だけの外枠で決まり、変えられる図形だけが動く', () => {
        const { model, position } = setup(mixedItems(), ['A', 'B', 'C']);
        assert.deepEqual(position.getPositionView(), { x: '20.0', y: '20.0', disabled: false });
        assert.equal(position.setPosition(POSITION_AXIS.X, '40'), true);
        assert.deepEqual(lefts(model), { A: 30, B: 100, C: 200 });
    });

    it('幅・反転・回転は変えられる図形だけに当たる', () => {
        const { model, transform } = setup(mixedItems(), ['A', 'B', 'C']);
        assert.equal(transform.setSize(SIZE_AXIS.WIDTH, '40'), true);
        assert.deepEqual(widths(model), { A: 40, B: 20, C: 20 });
        assert.equal(transform.flip(FLIP_AXIS.HORIZONTAL), true);
        assert.equal(transform.rotateBy('90'), true);
        assert.equal(lefts(model).B, 100);
        assert.equal(lefts(model).C, 200);
        assert.equal(widths(model).B, 20);
        assert.equal(widths(model).C, 20);
    });

    it('整列は変えられる図形が1つだけなら押せない', () => {
        const { align } = setup(mixedItems(), ['A', 'B', 'C']);
        assert.equal(noneAvailable(align), true);
        assert.equal(align.apply(ShapeAlignOperation.ALIGN_LEFT), false);
    });

    it('整列は変えられる図形どうしだけで行われ、ロックした図形は動かない', () => {
        const items = [item(box('A', 10, 10, 20, 20)), item(box('D', 50, 40, 20, 20)), item(box('B', 100, 10, 20, 20), true, true)];
        const { model, align } = setup(items, ['A', 'D', 'B']);
        assert.equal(align.apply(ShapeAlignOperation.ALIGN_LEFT), true);
        assert.deepEqual(lefts(model), { A: 10, D: 10, B: 100 });
    });

    it('外枠・1つずつの外枠は変えられる選択だけで決まる', () => {
        const { reader } = setup(mixedItems(), ['A', 'B', 'C']);
        assert.deepEqual(reader.getSelectedBounds(), { minX: 10, minY: 10, maxX: 30, maxY: 30 });
        assert.deepEqual(reader.getSelectedBoundsPerShape().map((e) => e.id), ['A']);
        assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: 10, minY: 10, maxX: 30, maxY: 30 });
    });
});

describe('移動・変形・外枠の対象: 変えられないものだけのとき', () => {
    it('Nudge・位置・変形は何もせず記録先に触れない', () => {
        const { model, calls, nudge, position, transform } = setup(mixedItems(), ['B', 'C']);
        assert.equal(nudge.nudge(5, 5), false);
        assert.equal(position.setPosition(POSITION_AXIS.X, '40'), false);
        assert.equal(transform.setSize(SIZE_AXIS.WIDTH, '40'), false);
        assert.equal(transform.rotateBy('90'), false);
        assert.equal(transform.flip(FLIP_AXIS.VERTICAL), false);
        assert.deepEqual(calls, []);
        assert.deepEqual(lefts(model), { A: 10, B: 100, C: 200 });
    });

    it('欄は選択なしと同じ、外枠はnull、整列は押せない', () => {
        const locked = setup(mixedItems(), ['B', 'C']);
        const none = setup(mixedItems(), []);
        assert.deepEqual(locked.position.getPositionView(), none.position.getPositionView());
        assert.deepEqual(locked.transform.getSizeView(), none.transform.getSizeView());
        assert.deepEqual(locked.transform.getTransformView(), none.transform.getTransformView());
        assert.equal(locked.reader.getSelectedBounds(), null);
        assert.equal(locked.reader.getSelectedGeometryBounds(), null);
        assert.deepEqual(locked.reader.getSelectedBoundsPerShape(), []);
        assert.equal(noneAvailable(locked.align), true);
        assert.equal(locked.align.apply(ShapeAlignOperation.ALIGN_LEFT), false);
        assert.deepEqual(locked.calls, []);
    });
});

describe('移動・変形・外枠の対象: フォルダから受け継いだとき', () => {
    it('ロックしたフォルダの中の図形は動かず、外の変えられる図形は動く', () => {
        const items = [
            folder('F', true, true, [item(box('B', 100, 10, 20, 20))]),
            item(box('A', 10, 10, 20, 20))
        ];
        const { model, nudge, reader } = setup(items, ['A', 'B']);
        assert.equal(nudge.nudge(5, 0), true);
        assert.deepEqual(lefts(model), { A: 15, B: 100 });
        assert.deepEqual(reader.getSelectedBoundsPerShape().map((e) => e.id), ['A']);
    });

    it('隠したフォルダの中の図形は対象外', () => {
        const items = [folder('F', false, false, [item(box('B', 100, 10, 20, 20))])];
        const { nudge, reader } = setup(items, ['B']);
        assert.equal(nudge.nudge(5, 0), false);
        assert.equal(reader.getSelectedBounds(), null);
    });

    it('自分の値が変えられても、ロックしたフォルダの中なら対象外', () => {
        const items = [folder('F', true, true, [item(box('B', 100, 10, 20, 20), true, false)])];
        const { reader } = setup(items, ['B']);
        assert.equal(reader.getSelectedBounds(), null);
    });
});

describe('getAllBounds: 見えている図形全部', () => {
    it('隠れた図形を含まず、ロックした図形を含む', () => {
        const { reader } = setup(mixedItems(), []);
        assert.deepEqual(reader.getAllBounds(), { minX: 10, minY: 10, maxX: 120, maxY: 30 });
    });

    it('隠したフォルダの中の図形も含まない', () => {
        const items = [item(box('A', 10, 10, 20, 20)), folder('F', false, false, [item(box('C', 300, 10, 20, 20))])];
        const { reader } = setup(items, []);
        assert.deepEqual(reader.getAllBounds(), { minX: 10, minY: 10, maxX: 30, maxY: 30 });
    });

    it('すべて隠れているとnull', () => {
        const { reader } = setup([item(box('A', 10, 10, 20, 20), false, false)], []);
        assert.equal(reader.getAllBounds(), null);
    });

    it('すべて表示・ロックなしなら全図形の外枠と同じ', () => {
        const { reader } = setup([item(box('A', 10, 10, 20, 20)), item(box('B', 100, 10, 20, 20))], []);
        assert.deepEqual(reader.getAllBounds(), { minX: 10, minY: 10, maxX: 120, maxY: 30 });
    });
});
