/**
 * 責務: ClipboardControllerの同じ位置に貼り付け（pasteInPlace）とAlt+ドラッグの記録しない複製（duplicateInPlaceWithinEdit）の振る舞いを検証する。
 * 実物のVectorModel・ShapeInserter・SnapshotAdapter・HistoryManager・ClipboardControllerを組み合わせる（deleteSelectionだけ素の関数の偽物）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @param {number} x 左上のx（幅・高さは10）
 * @returns {Rect} 矩形
 */
function makeRect(id, x) {
    const rect = new Rect(x, 0, x + 10, 10, '#112233', 2, null);
    rect.id = id;
    return rect;
}

/**
 * 実物を組み合わせる。図形A・Bを置き、Aを選択した状態にする。
 * @returns {{ model: VectorModel, history: HistoryManager, clipboard: ClipboardController }} 組み合わせた実物
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes([makeRect('A', 0), makeRect('B', 100)]);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    const clipboard = new ClipboardController({ model, inserter, deleteSelection: () => true });
    model.setSelection(['A']);
    return { model, history, clipboard };
}

/**
 * 図形の先頭頂点のx座標を描画順で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<number>} x座標の配列
 */
function firstXs(model) {
    return model.getShapes().map((s) => s.toJSON().points[0].x);
}

test('pasteInPlace: 元と同じ位置・新しいid・最前面に足され、貼り付けた図形だけが選択される', () => {
    const { model, clipboard } = setup();
    clipboard.copy();
    assert.equal(clipboard.pasteInPlace(), true);
    const shapes = model.getShapes();
    assert.equal(shapes.length, 3);
    const pasted = shapes[2];
    assert.notEqual(pasted.id, 'A');
    assert.notEqual(pasted.id, 'B');
    assert.deepEqual(pasted.toJSON().points, shapes[0].toJSON().points);
    assert.deepEqual(model.getSelectedIds(), [pasted.id]);
});

test('pasteInPlace: 1件の記録になり、undoで貼り付け前に戻る', () => {
    const { model, history, clipboard } = setup();
    clipboard.copy();
    assert.equal(history.canUndo(), false);
    clipboard.pasteInPlace();
    assert.equal(history.canUndo(), true);
    history.undo();
    assert.equal(model.getShapes().length, 2);
    assert.equal(history.canUndo(), false);
});

test('pasteInPlace: 段数を読まず変えない（copy→pasteInPlace→paste の位置は copy→paste と同じ1段ずれ）', () => {
    const withInPlace = setup();
    withInPlace.clipboard.copy();
    withInPlace.clipboard.pasteInPlace();
    withInPlace.clipboard.paste();
    const xsWith = firstXs(withInPlace.model);

    const without = setup();
    without.clipboard.copy();
    without.clipboard.paste();
    const xsWithout = firstXs(without.model);

    assert.equal(xsWith[3], 20);
    assert.equal(xsWithout[2], 20);
    assert.equal(xsWith[3], xsWithout[2]);
});

test('pasteInPlace: クリップボードが空ならfalseで、図形と履歴が変わらない', () => {
    const { model, history, clipboard } = setup();
    assert.equal(clipboard.pasteInPlace(), false);
    assert.equal(model.getShapes().length, 2);
    assert.deepEqual(model.getSelectedIds(), ['A']);
    assert.equal(history.canUndo(), false);
});

test('duplicateInPlaceWithinEdit: 複製が元と同じ位置・新しいid・最前面に足され、複製だけが選択され、元の図形は変わらない', () => {
    const { model, clipboard } = setup();
    const before = model.getShapes().map((s) => s.toJSON());
    assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
    const shapes = model.getShapes();
    assert.equal(shapes.length, 3);
    const copy = shapes[2];
    assert.notEqual(copy.id, 'A');
    assert.notEqual(copy.id, 'B');
    assert.deepEqual(copy.toJSON().points, before[0].points);
    assert.deepEqual(model.getSelectedIds(), [copy.id]);
    assert.deepEqual(shapes[0].toJSON(), before[0]);
    assert.deepEqual(shapes[1].toJSON(), before[1]);
});

test('duplicateInPlaceWithinEdit: クリップボードを変えない（copyの後に呼んでもpasteの段数は1段のまま）', () => {
    const { model, clipboard } = setup();
    clipboard.copy();
    clipboard.duplicateInPlaceWithinEdit();
    model.setSelection(['B']);
    clipboard.paste();
    const shapes = model.getShapes();
    assert.equal(shapes.length, 4);
    assert.equal(shapes[3].toJSON().points[0].x, 20);
});

test('duplicateInPlaceWithinEdit: コピー前に呼んでもクリップボードは空のまま', () => {
    const { clipboard } = setup();
    clipboard.duplicateInPlaceWithinEdit();
    assert.equal(clipboard.isEmpty(), true);
});

test('duplicateInPlaceWithinEdit: ドラッグの編集操作の中で呼ぶと履歴1件・警告なし、undoで複製前、redoで複製して動かした後', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, clipboard } = setup();

    history.beginEdit();
    clipboard.duplicateInPlaceWithinEdit();
    const duplicateId = model.getSelectedIds()[0];
    model.moveShapes(model.getSelectedIds(), 30, 0);
    history.commitEdit();

    assert.equal(warn.mock.callCount(), 0);
    assert.equal(history.canUndo(), true);
    assert.equal(model.getShapes().length, 3);

    history.undo();
    assert.deepEqual(model.getShapes().map((s) => s.id), ['A', 'B']);
    assert.deepEqual(model.getSelectedIds(), ['A']);
    assert.equal(history.canUndo(), false);

    history.redo();
    const shapes = model.getShapes();
    assert.equal(shapes.length, 3);
    assert.equal(shapes[2].toJSON().points[0].x, 30);
    assert.equal(shapes[0].toJSON().points[0].x, 0);
    assert.deepEqual(model.getSelectedIds(), [shapes[2].id]);
    assert.equal(typeof duplicateId, 'string');
});

test('duplicateInPlaceWithinEdit: 単独で呼んでも記録されない', () => {
    const { model, history, clipboard } = setup();
    clipboard.duplicateInPlaceWithinEdit();
    assert.equal(model.getShapes().length, 3);
    assert.equal(history.canUndo(), false);
});

test('duplicateInPlaceWithinEdit: 選択が空ならfalseで何も変わらない', () => {
    const { model, history, clipboard } = setup();
    model.clearSelection();
    assert.equal(clipboard.duplicateInPlaceWithinEdit(), false);
    assert.equal(model.getShapes().length, 2);
    assert.deepEqual(model.getSelectedIds(), []);
    assert.equal(history.canUndo(), false);
});
