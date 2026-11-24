/**
 * 責務: EndpointSnapperと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、描き終えた線が描き込む先のすぐ上へ入ること、
 * 描き足し・つなげる・閉じるでは位置が元のままで結果の図形が描き込む先になることを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

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
 * idを直接代入した開いたパス（頂点4つ）を作る。
 * @param {string} id 代入するid
 * @returns {Path} パス
 */
function makePath(id) {
    const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], false, '#445566', 3);
    path.id = id;
    return path;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape) {
    return { kind: 'shape', shape, name: shape.id, visible: true, locked: false };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・EndpointSnapperを組み合わせる（換算は等倍）。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @returns {{ model: VectorModel, history: HistoryManager, snapper: EndpointSnapper }} 組み合わせた実物
 */
function setupReal(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const snapper = new EndpointSnapper({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    return { model, history, snapper };
}

/**
 * 離れた3本の直線a・b・c（この順）を入れた実物を組み合わせる。
 * @returns {{ model: VectorModel, history: HistoryManager, snapper: EndpointSnapper }} 組み合わせた実物
 */
function setupThree() {
    return setupReal([
        shapeItem(makeLine('a', 0, 0, 10, 0)),
        shapeItem(makeLine('b', 0, 500, 10, 500)),
        shapeItem(makeLine('c', 0, 900, 10, 900))
    ]);
}

/**
 * 図形のid（描画順）を返す。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} idの配列
 */
function ids(model) {
    return model.getShapes().map((shape) => shape.id);
}

/**
 * 直線のツールで2点の線を引いて開いたまま終える（点を1つ打ち、付いてくる線の先を置いてから終える）。
 * @param {VectorModel} model モデル
 * @param {EndpointSnapper} snapper 手順
 * @param {number} x 始点x
 * @param {number} y 始点y
 */
function drawLine(model, snapper, x, y) {
    model.startDraft(x, y, 'line');
    model.updateDraft(x + 50, y);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    model.updateDraft(x + 100, y);
    snapper.finishDrawnLine(null);
}

test('線を引いて終える: 描き込む先のすぐ上へ入り、その線が描き込む先になる（記録1件）', () => {
    const { model, history, snapper } = setupThree();
    model.setInsertTarget('b');
    drawLine(model, snapper, 100, 100);
    const list = ids(model);
    assert.equal(list.length, 4);
    assert.deepEqual([list[0], list[1], list[3]], ['a', 'b', 'c']);
    assert.equal(model.getInsertTargetId(), list[2]);
    assert.equal(history.undo(), true);
    assert.deepEqual(ids(model), ['a', 'b', 'c']);
    assert.equal(history.canUndo(), false);
});

test('描き込む先なし: 終えた線は末尾（最前面）へ入る', () => {
    const { model, snapper } = setupThree();
    drawLine(model, snapper, 100, 100);
    const list = ids(model);
    assert.deepEqual(list.slice(0, 3), ['a', 'b', 'c']);
    assert.equal(model.getInsertTargetId(), list[3]);
});

test('続けて描く: 1本目のすぐ上へ2本目が入る（描き込む先が1本目へ移るため）', () => {
    const { model, snapper } = setupThree();
    model.setInsertTarget('a');
    drawLine(model, snapper, 100, 100);
    const first = model.getInsertTargetId();
    drawLine(model, snapper, 100, 200);
    const second = model.getInsertTargetId();
    assert.deepEqual(ids(model), ['a', first, second, 'b', 'c']);
});

test('閉じて終える: 描き込む先のすぐ上へ入る', () => {
    const { model, snapper } = setupThree();
    model.setInsertTarget('a');
    model.startDraft(100, 100, 'line');
    model.updateDraft(200, 100);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    model.updateDraft(200, 200);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    model.updateDraft(100, 100);
    assert.equal(snapper.clickDrawnLine(null, { kind: 'drawnStart' }), false);
    const list = ids(model);
    assert.equal(list.length, 4);
    assert.deepEqual([list[0], list[2], list[3]], ['a', 'b', 'c']);
    assert.equal(model.getInsertTargetId(), list[1]);
});

test('描き足し（keepId: 真）: 位置は元のままで、結果の図形が描き込む先になる', () => {
    const { model, snapper } = setupThree();
    model.setInsertTarget('c');
    model.startDraft(10, 500, 'line');
    model.updateDraft(100, 500);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'b', end: 'end' }, null), true);
    assert.deepEqual(ids(model), ['a', 'b', 'c']);
    assert.equal(model.getShapes()[1].type, 'path');
    assert.equal(model.getInsertTargetId(), 'b');
});

test('つなげる（keepId: 偽）: 2本が1本になり、結果の図形が描き込む先になる', () => {
    const { model, snapper } = setupReal([
        shapeItem(makeLine('a', 0, 0, 100, 0)),
        shapeItem(makeLine('b', 300, 0, 400, 0)),
        shapeItem(makeLine('c', 0, 900, 10, 900))
    ]);
    model.setInsertTarget('c');
    model.startDraft(100, 0, 'line');
    model.updateDraft(300, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'b', end: 'start' }), true);
    const list = ids(model);
    assert.equal(list.length, 2);
    assert.equal(list[1], 'c');
    assert.equal(model.getInsertTargetId(), list[0]);
});

test('閉じる（開いたパスの両端）: 位置は元のままで、結果の図形が描き込む先になる', () => {
    const { model, snapper } = setupReal([
        shapeItem(makePath('p')),
        shapeItem(makeLine('c', 0, 900, 10, 900))
    ]);
    model.setInsertTarget('c');
    model.startDraft(0, 100, 'line');
    model.updateDraft(0, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'p', end: 'end' }, { shapeId: 'p', end: 'start' }), true);
    assert.deepEqual(ids(model), ['p', 'c']);
    assert.equal(model.getInsertTargetId(), 'p');
});

test('何も残らない終わり方（打った点が始点だけ）では、図形も描き込む先も変わらない', () => {
    const { model, snapper } = setupThree();
    model.setInsertTarget('b');
    model.startDraft(100, 100, 'line');
    snapper.finishDrawnLine(null);
    assert.deepEqual(ids(model), ['a', 'b', 'c']);
    assert.equal(model.getInsertTargetId(), 'b');
});
