/**
 * 責務: VectorModel の頂点の選択（setSelectedVertices・clearSelectedVertices・getSelectedVertices・isVertexSelected・選択集合の変化での落とし方・通知）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * 直線2本（shape-a・shape-b）を入れ、通知回数を数えるリスナーを登録したモデルを作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function setup() {
    const model = new VectorModel();
    const a = new Line(0, 0, 10, 0, '#000000', 1);
    const b = new Line(0, 5, 10, 5, '#000000', 1);
    a.id = 'shape-a';
    b.id = 'shape-b';
    model.replaceAllShapes([a, b]);
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

test('初期値は空', () => {
    const { model } = setup();
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(model.isVertexSelected('shape-a', 'start'), false);
});

test('置き換えで通知は1回、同じ内容では通知しない', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    const base = notifyCount();
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'shape-a', handle: 'start' }]);
    assert.equal(notifyCount(), base + 1);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    assert.equal(notifyCount(), base + 1);
    assert.equal(model.isVertexSelected('shape-a', 'start'), true);
    assert.equal(model.isVertexSelected('shape-a', 'end'), false);
});

test('選択集合に無い図形・空のハンドル名の組は受け付けない', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    const base = notifyCount();
    model.setSelectedVertices([
        { shapeId: 'shape-b', handle: 'start' },
        { shapeId: 'shape-a', handle: '' },
        { shapeId: 'shape-a', handle: 5 },
    ]);
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base);
});

test('重複を除き、与えられた順で持つ。引数を保持も変更もしない', () => {
    const { model } = setup();
    model.setSelection(['shape-a', 'shape-b']);
    const input = [
        { shapeId: 'shape-b', handle: 'end' },
        { shapeId: 'shape-a', handle: 'start' },
        { shapeId: 'shape-b', handle: 'end' },
    ];
    model.setSelectedVertices(input);
    assert.equal(input.length, 3);
    input[0].handle = 'changed';
    assert.deepEqual(model.getSelectedVertices(), [
        { shapeId: 'shape-b', handle: 'end' },
        { shapeId: 'shape-a', handle: 'start' },
    ]);
});

test('clearSelectedVertices：空のときは通知せず、あれば1回通知する', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    let base = notifyCount();
    model.clearSelectedVertices();
    assert.equal(notifyCount(), base);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    base = notifyCount();
    model.clearSelectedVertices();
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base + 1);
});

test('getSelectedVerticesはコピーを返す', () => {
    const { model } = setup();
    model.setSelection(['shape-a']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    const got = model.getSelectedVertices();
    got[0].handle = 'x';
    got.push({ shapeId: 'shape-a', handle: 'end' });
    assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'shape-a', handle: 'start' }]);
});

test('setSelectionで選択中でなくなった図形の組が落ち、通知は1回のまま', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a', 'shape-b']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }, { shapeId: 'shape-b', handle: 'end' }]);
    const base = notifyCount();
    model.setSelection(['shape-b']);
    assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'shape-b', handle: 'end' }]);
    assert.equal(notifyCount(), base + 1);
});

test('clearSelectionで落ち、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    const base = notifyCount();
    model.clearSelection();
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base + 1);
});

test('deleteShapesで落ち、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a', 'shape-b']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }, { shapeId: 'shape-b', handle: 'end' }]);
    const base = notifyCount();
    model.deleteShapes(['shape-a']);
    assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'shape-b', handle: 'end' }]);
    assert.equal(notifyCount(), base + 1);
});

test('replaceAllShapesで落ち、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    const base = notifyCount();
    model.replaceAllShapes(model.getShapes());
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base + 1);
});

test('addShapesWithNewIdsで落ち、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    const base = notifyCount();
    model.addShapesWithNewIds([new Line(1, 1, 2, 2, '#000000', 1)]);
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base + 1);
});

test('replaceShape（select偽）で除かれた図形の組が落ち、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a', 'shape-b']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }, { shapeId: 'shape-b', handle: 'end' }]);
    const base = notifyCount();
    model.replaceShape('shape-a', new Line(1, 1, 2, 2, '#000000', 1), { removeIds: ['shape-b'], select: false });
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base + 1);
});

test('replaceShape（select真）で元の組が落ち、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['shape-a']);
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    const base = notifyCount();
    model.replaceShape('shape-a', new Line(3, 3, 4, 4, '#000000', 1), { select: true });
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(notifyCount(), base + 1);
});

test('replaceShape（keepId・select偽）で選択中の図形が残れば組は残る', () => {
    const { model } = setup();
    model.setSelection(['shape-a', 'shape-b']);
    model.setSelectedVertices([{ shapeId: 'shape-b', handle: 'end' }]);
    model.replaceShape('shape-a', new Line(1, 1, 2, 2, '#000000', 1), { keepId: true, select: false });
    assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'shape-b', handle: 'end' }]);
});

test('他の状態（ホバー・選択矩形・吸い付きの点・直前に使った値・図形）に触れない', () => {
    const { model } = setup();
    model.setSelection(['shape-a']);
    model.setHovered('shape-b');
    model.setSelectionRect(0, 0, 1, 1);
    model.setSnapPoint(2, 3);
    const style = model.getNewShapeStyle();
    const shapes = model.getShapes();
    model.setSelectedVertices([{ shapeId: 'shape-a', handle: 'start' }]);
    model.clearSelectedVertices();
    assert.equal(model.getHoveredId(), 'shape-b');
    assert.deepEqual(model.getSelectionRect(), { x1: 0, y1: 0, x2: 1, y2: 1 });
    assert.deepEqual(model.getSnapPoint(), { x: 2, y: 3 });
    assert.deepEqual(model.getNewShapeStyle(), style);
    assert.deepEqual(model.getSelectedIds(), ['shape-a']);
    assert.deepEqual(model.getShapes(), shapes);
});
