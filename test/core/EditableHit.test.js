/**
 * 責務: InputTrackerと同じ受け渡し（モデルの変えられる図形・見えている図形を規則の関数へ渡す）を、実物のVectorModelと規則の関数で検証する。
 * 隠れた・ロックされた・受け継いだ図形が当たり・範囲選択・全選択・選択の反転・外枠から外れること、変えられない図形の選択が残ることを確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { classifyPointHit } from '../../js/core/PointHitRules.js';
import { collectVertexHandles, collectVertexHandlesInRect } from '../../js/core/VertexHandleRules.js';
import { collectScaleFrame } from '../../js/core/ScaleHandleRules.js';
import { invertSelection, resolveMarqueeSelection, resolveUserClickSelection } from '../../js/core/SelectionRules.js';
import { ShapeExtentReader } from '../../js/edit/ShapeExtentReader.js';

/**
 * 同じ位置（x 0〜10、y 0）に重なる直線を作る。
 * @param {string} id 代入するid
 * @returns {Line} 直線
 */
function makeLine(id) {
    const line = new Line(0, 0, 10, 0, '#000000', 1);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る。
 * @param {string} id 図形のid
 * @param {Object} [states] `visible`・`locked`
 * @returns {Object} 図形のアイテム
 */
const s = (id, states = {}) => ({ kind: 'shape', shape: makeLine(id), ...states });

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [states] `visible`・`locked`
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, states = {}) => ({ kind: 'group', id, children, ...states });

/**
 * アイテムを入れたモデルを作る。
 * @param {Array<Object>} items 入れるアイテム
 * @returns {VectorModel} モデル
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    return model;
}

/**
 * InputTrackerの#classifyPointと同じ受け渡しで、点(5, 0)の当たり分類を求める。
 * @param {VectorModel} model モデル
 * @param {boolean} [includeHandles] ハンドルを含めるか
 * @returns {Object} 当たり分類
 */
function classify(model, includeHandles = false) {
    return classifyPointHit(model.getEditableShapes(), (id) => model.isSelected(id), 5, 0, 3, true, includeHandles);
}

describe('当たり分類（変えられる図形だけを渡す）', () => {
    it('手前の隠れた図形・ロックした図形を素通りして後ろの図形に当たる', () => {
        assert.equal(classify(setup([s('a'), s('b', { visible: false })])).bodyId, 'a');
        assert.equal(classify(setup([s('a'), s('b', { locked: true })])).bodyId, 'a');
    });

    it('手前のフォルダから受け継いだ隠れ・ロックも素通りする', () => {
        assert.equal(classify(setup([s('a'), g('x', [s('b')], { visible: false })])).bodyId, 'a');
        assert.equal(classify(setup([s('a'), g('x', [g('y', [s('b')])], { locked: true })])).bodyId, 'a');
    });

    it('選ばれていても、ロックした図形は素通りする', () => {
        const model = setup([s('a'), s('b', { locked: true })]);
        model.setSelection(['b']);
        assert.equal(classify(model).bodyId, 'a');
    });

    it('変えられる図形が無ければ空白になる', () => {
        const model = setup([s('a', { locked: true }), s('b', { visible: false })]);
        assert.deepEqual(classify(model), { handle: null, bodyId: null });
    });

    it('頂点のハンドルは変えられる図形にだけ当たる', () => {
        const model = setup([s('a'), s('b', { locked: true })]);
        model.setSelection(['a', 'b']);
        const hit = classifyPointHit(model.getEditableShapes(), (id) => model.isSelected(id), 0, 0, 3, true, true);
        assert.equal(hit.handle.shapeId, 'a');
    });
});

describe('頂点のハンドル・範囲選択', () => {
    it('collectVertexHandles: 選んでいても変えられない図形のハンドルは出ない', () => {
        const model = setup([s('a'), s('b', { locked: true }), s('c', { visible: false })]);
        model.setSelection(['a', 'b', 'c']);
        const handles = collectVertexHandles(OperationMode.VERTEX, model.getEditableShapes(), model.getSelectedIds(), model.getSelectedVertices());
        assert.deepEqual(handles.map((h) => h.shapeId), ['a']);
    });

    it('collectVertexHandlesInRect: 変えられない図形の頂点は集まらない', () => {
        const model = setup([s('a'), s('b', { locked: true }), g('x', [s('c')], { visible: false })]);
        model.setSelection(['a', 'b', 'c']);
        const pairs = collectVertexHandlesInRect(model.getEditableShapes(), model.getSelectedIds(), -1, -1, 11, 1);
        assert.ok(pairs.length > 0);
        assert.ok(pairs.every((pair) => pair.shapeId === 'a'));
    });

    it('範囲選択（intersectsRect）: 変えられる図形だけが選ばれる', () => {
        const model = setup([s('a'), s('b', { locked: true }), s('c', { visible: false }), g('x', [s('d')], { locked: true }), s('e')]);
        const ids = model.getEditableShapes().filter((shape) => shape.intersectsRect(-1, -1, 11, 1)).map((shape) => shape.id);
        assert.deepEqual(ids, ['a', 'e']);
        assert.deepEqual(resolveMarqueeSelection([], ids, false), { type: 'set', ids: ['a', 'e'] });
    });
});

describe('全選択・選択の反転・クリック', () => {
    it('全選択: 変えられる図形のidだけが選ばれる', () => {
        const model = setup([s('a'), s('b', { locked: true }), s('c', { visible: false }), s('d')]);
        model.setSelection(model.getEditableShapes().map((shape) => shape.id));
        assert.deepEqual(model.getSelectedIds(), ['a', 'd']);
    });

    it('選択の反転: 一覧から選んだ変えられない図形は外れ、変えられる図形だけが反転する', () => {
        const model = setup([s('a'), s('b', { locked: true }), s('c', { visible: false }), s('d')]);
        model.setSelection(['b', 'a']);
        model.setSelection(invertSelection(model.getEditableShapes().map((shape) => shape.id), model.getSelectedIds()));
        assert.deepEqual(model.getSelectedIds(), ['d']);
    });

    it('すべて表示・ロックなしなら、反転・全選択は今までと同じ', () => {
        const model = setup([s('a'), g('x', [s('b'), s('c')]), s('d')]);
        assert.deepEqual(model.getEditableShapes().map((shape) => shape.id), model.getShapes().map((shape) => shape.id));
        model.setSelection(['b']);
        model.setSelection(invertSelection(model.getEditableShapes().map((shape) => shape.id), model.getSelectedIds()));
        assert.deepEqual(model.getSelectedIds(), ['a', 'c', 'd']);
    });

    it('Ctrl+クリック: 一覧から選んだ変えられない図形の選択が残る', () => {
        const model = setup([s('a'), s('b', { locked: true })]);
        model.setSelection(['b']);
        const hit = classify(model);
        assert.equal(hit.bodyId, 'a');
        const change = resolveUserClickSelection(model.getSelectedIds(), hit.bodyId, true);
        assert.deepEqual(change.ids.slice().sort(), ['a', 'b']);
    });
});

describe('描く図形と外枠', () => {
    it('描く図形（getVisibleShapes）: 隠れた図形は除き、ロックした図形は含む', () => {
        const model = setup([s('a'), s('b', { visible: false }), s('c', { locked: true }), g('x', [s('d')], { visible: false })]);
        assert.deepEqual(model.getVisibleShapes().map((shape) => shape.id), ['a', 'c']);
    });

    it('collectScaleFrame: 選んでいるのが変えられない図形だけなら外枠が出ない', () => {
        const model = setup([s('a', { locked: true }), s('b', { visible: false })]);
        model.setSelection(['a', 'b']);
        const reader = new ShapeExtentReader({ model });
        assert.equal(collectScaleFrame(OperationMode.SELECT, reader.getSelectedGeometryBounds(), 1), null);
    });

    it('collectScaleFrame: 変えられる図形が混ざれば出る', () => {
        const model = setup([s('a', { locked: true }), s('b')]);
        model.setSelection(['a', 'b']);
        const reader = new ShapeExtentReader({ model });
        assert.notEqual(collectScaleFrame(OperationMode.SELECT, reader.getSelectedGeometryBounds(), 1), null);
    });
});
