/**
 * 責務: ShapeInserterが入れ子の作業データを入れ子ごと外側の末尾へ新しいidで追加することを、実物のVectorModel・HistoryManagerと組み合わせて検証する。
 * 公開APIだけを通す。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
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
 * 実物を組み合わせる。キャンバスには名前付きの図形1つを置く。
 * @returns {{ model: VectorModel, history: HistoryManager, inserter: ShapeInserter }} 組み合わせた実物
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes([{ kind: 'shape', shape: makeRect('shape-1', 0), name: '既存', visible: true, locked: false }]);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    return { model, history, inserter };
}

/**
 * 入れ子の作業データ（フォルダ1つ＋その中の図形2つ＋外の図形1つ）を作る。
 * @returns {Object} 作業データ
 */
function nestedDocument() {
    return DocumentSerializer.serialize([
        {
            kind: 'group', id: 'group-7', name: '親', visible: false, locked: true, children: [
                { kind: 'shape', shape: makeRect('shape-7', 0), name: '同名', visible: false, locked: true },
                { kind: 'shape', shape: makeRect('shape-8', 20), name: '同名', visible: true, locked: false }
            ]
        },
        { kind: 'shape', shape: makeRect('shape-9', 40), name: '外', visible: true, locked: true }
    ]);
}

test('insertDocument: 入れ子ごと外側の末尾へ入り、新しいidになる（フォルダのidも）', () => {
    const { model, inserter } = setup();
    const result = inserter.insertDocument(nestedDocument());
    assert.equal(result.ok, true);
    assert.equal(result.insertedIds.length, 3);
    const items = model.getItems();
    assert.equal(items.length, 3);
    assert.equal(items[1].kind, 'group');
    assert.notEqual(items[1].id, 'group-7');
    assert.equal(items[1].name, '親');
    assert.equal(items[1].visible, false);
    assert.equal(items[1].locked, true);
    assert.equal(items[1].children.length, 2);
    assert.deepEqual(items[1].children.map((c) => c.name), ['同名', '同名']);
    assert.equal(items[2].name, '外');
    const ids = model.getShapes().map((s) => s.id);
    assert.equal(new Set(ids).size, 4);
    assert.deepEqual(result.insertedIds, ids.slice(1));
    assert.deepEqual(model.getSelectedIds(), result.insertedIds);
});

test('insertDocument: 名前の重複が許される（既存と同じ名前の図形が入る）', () => {
    const { model, inserter } = setup();
    inserter.insertDocument(DocumentSerializer.serialize([{ kind: 'shape', shape: makeRect('a', 0), name: '既存', visible: true, locked: false }]));
    assert.deepEqual(model.getItems().map((i) => i.name), ['既存', '既存']);
});

test('insertDocument: 1件の記録になり、undoで追加前のJSONに戻る', () => {
    const { model, history, inserter } = setup();
    const before = JSON.stringify(DocumentSerializer.serialize(model.getItems()));
    inserter.insertDocument(nestedDocument());
    assert.equal(history.canUndo(), true);
    history.undo();
    assert.equal(JSON.stringify(DocumentSerializer.serialize(model.getItems())), before);
    assert.equal(history.canUndo(), false);
});

test('insertDocument: dx・dyが入れ子の中の図形にも効く', () => {
    const { model, inserter } = setup();
    inserter.insertDocument(nestedDocument(), 5, 7);
    const children = model.getItems()[1].children;
    assert.deepEqual(children.map((c) => c.shape.toJSON().points[0].x), [5, 25]);
    assert.equal(children[0].shape.toJSON().points[0].y, 7);
});

test('insertDocument: フォルダだけの作業データでは何も起きず記録されない', () => {
    const { model, history, inserter } = setup();
    const doc = DocumentSerializer.serialize([
        { kind: 'group', id: 'group-1', name: '空', visible: true, locked: false, children: [] }
    ]);
    const result = inserter.insertDocument(doc);
    assert.equal(result.ok, true);
    assert.deepEqual(result.insertedIds, []);
    assert.equal(model.getItems().length, 1);
    assert.equal(history.canUndo(), false);
});

test('insertDocumentWithinEdit: 記録せず入れ子ごと追加し、呼び出し側の編集操作で1件になる', () => {
    const { model, history, inserter } = setup();
    history.beginEdit();
    const result = inserter.insertDocumentWithinEdit(nestedDocument());
    assert.equal(result.insertedIds.length, 3);
    assert.equal(history.canUndo(), false);
    assert.equal(history.commitEdit(), true);
    assert.equal(model.getItems().length, 3);
    history.undo();
    assert.equal(model.getItems().length, 1);
});

test('insertDocument: 全体が読めない作業データは何も変えない', (t) => {
    t.mock.method(console, 'warn', () => {});
    const { model, history, inserter } = setup();
    const result = inserter.insertDocument({ format: 'x' });
    assert.equal(result.ok, false);
    assert.equal(model.getItems().length, 1);
    assert.equal(history.canUndo(), false);
});
