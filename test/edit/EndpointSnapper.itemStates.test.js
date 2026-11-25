/**
 * 責務: EndpointSnapperが、変えられる図形（隠れても固定（ロック）されてもいない図形）だけを吸い付き・結合の対象にすることを、実物のVectorModelで検証する。
 * 引き始めた後で描き始めの線が変えられなくなったとき、引いた線が消えず新しい線として残ることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点x
 * @param {number} y1 始点y
 * @param {number} x2 終点x
 * @param {number} y2 終点y
 * @returns {Line} 直線
 */
function makeLine(id, x1, y1, x2, y2) {
    const line = new Line(x1, y1, x2, y2, '#112233', 2);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @param {boolean} [visible=true] 表示
 * @param {boolean} [locked=false] ロック
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape, visible = true, locked = false) {
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
function groupItem(id, visible, locked, children) {
    return { kind: 'group', id, name: id, visible, locked, children };
}

/**
 * 実物のVectorModelと、記録を数えるだけの記録先でEndpointSnapperを作る（換算は等倍）。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @returns {{ model: VectorModel, snapper: EndpointSnapper, edits: {begin: number, commit: number} }} 実物と記録の回数
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const edits = { begin: 0, commit: 0 };
    const editRecorder = {
        beginEdit: () => { edits.begin += 1; },
        commitEdit: () => { edits.commit += 1; return true; }
    };
    const snapper = new EndpointSnapper({ model, editRecorder, screenLengthToWorld: (length) => length });
    return { model, snapper, edits };
}

test('findDrawSnap: 隠れている図形・ロックされている図形・隠れたフォルダの中の図形の端点には吸い付かず、変えられる図形には吸い付く', () => {
    const { snapper } = setup([
        shapeItem(makeLine('hidden', 0, 0, 100, 0), false, false),
        shapeItem(makeLine('locked', 0, 50, 100, 50), true, true),
        groupItem('g-hidden', false, false, [shapeItem(makeLine('in-hidden', 0, 100, 100, 100))]),
        groupItem('g-locked', true, true, [shapeItem(makeLine('in-locked', 0, 150, 100, 150))]),
        shapeItem(makeLine('ok', 0, 200, 100, 200))
    ]);
    assert.equal(snapper.findDrawSnap('line', { x: 0, y: 0 }), null);
    assert.equal(snapper.findDrawSnap('line', { x: 0, y: 50 }), null);
    assert.equal(snapper.findDrawSnap('line', { x: 0, y: 100 }), null);
    assert.equal(snapper.findDrawSnap('line', { x: 0, y: 150 }), null);
    assert.deepEqual(snapper.findDrawSnap('line', { x: 2, y: 200 }), { shapeId: 'ok', end: 'start', x: 0, y: 200 });
});

test('resolveDragEndpoint・findDragSnap: ロックされた図形は端点として解決されず、吸い付く先にもならない', () => {
    const { snapper } = setup([
        shapeItem(makeLine('locked', 0, 0, 100, 0), true, true),
        shapeItem(makeLine('a', 0, 50, 100, 50)),
        shapeItem(makeLine('b', 200, 50, 300, 50))
    ]);
    assert.equal(snapper.resolveDragEndpoint('locked', 'end'), null);
    assert.equal(snapper.resolveDragEndpoint('a', 'end'), 'end');
    assert.equal(snapper.findDragSnap({ shapeId: 'a', end: 'end' }, { x: 100, y: 1 }), null);
});

test('joinDraggedEndpoint: ドラッグしている線が変えられなければ結合せず、何も変えない', () => {
    const { model, snapper } = setup([
        shapeItem(makeLine('locked', 0, 0, 100, 0), true, true),
        shapeItem(makeLine('b', 100, 0, 200, 0))
    ]);
    const before = JSON.stringify(model.getItems().map((item) => item.shape.toJSON()));
    assert.equal(snapper.joinDraggedEndpoint({ shapeId: 'locked', end: 'end' }, { shapeId: 'b', end: 'start', x: 100, y: 0 }), false);
    assert.equal(JSON.stringify(model.getItems().map((item) => item.shape.toJSON())), before);
});

test('引き始めた後で描き始めの線がロックされた: 吸い付きを外し、引いた線は新しい線として残り、ロックした線は変わらない', () => {
    const { model, snapper, edits } = setup([shapeItem(makeLine('shape-1', 0, 0, 100, 0))]);
    const startSnap = { shapeId: 'shape-1', end: 'end' };
    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 0);
    assert.equal(model.setItemStates([{ id: 'shape-1', locked: true }]), true);

    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(300, 0);
    snapper.finishDrawnLine(startSnap);
    assert.equal(model.getDraftShape(), null);
    const shapes = model.getShapes();
    assert.equal(shapes.length, 2);
    assert.equal(shapes[0].id, 'shape-1');
    assert.equal(shapes[0].type, 'line');
    assert.equal(shapes[1].type, 'line');
    assert.equal(edits.begin, 1);
    assert.equal(edits.commit, 1);
});

test('引き始めた後で描き始めの線がロックされた: commitDrawnLineは両方nullと同じ扱いでfalseを返し、作成途中の線を残す', () => {
    const { model, snapper, edits } = setup([shapeItem(makeLine('shape-1', 0, 0, 100, 0))]);
    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 0);
    model.setItemStates([{ id: 'shape-1', visible: false }]);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'shape-1', end: 'end' }, null), false);
    assert.notEqual(model.getDraftShape(), null);
    assert.equal(edits.begin, 0);
});

test('clickDrawnLine: 終点の吸い付き先が変えられなくなっていれば、結合せず点を打って引き続ける。始点への吸い付きとはそのまま扱う', () => {
    const { model, snapper } = setup([shapeItem(makeLine('shape-2', 200, 0, 300, 0))]);
    model.startDraft(0, 0, 'line');
    model.updateDraft(200, 0);
    model.setItemStates([{ id: 'shape-2', locked: true }]);
    assert.equal(snapper.clickDrawnLine(null, { shapeId: 'shape-2', end: 'start', x: 200, y: 0 }), true);
    assert.equal(model.getShapes().length, 1);
    assert.notEqual(model.getDraftShape(), null);
});

test('もう無い図形の吸い付きはそのまま渡る（変えられなくなった図形だけを外す）', () => {
    const { model, snapper } = setup([shapeItem(makeLine('shape-1', 0, 0, 100, 0))]);
    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'gone', end: 'end' }, null), true);
});
