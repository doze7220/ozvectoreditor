/**
 * 責務: PathSplitEditorと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、分割・区間の削除の取り消し/やり直しと、名前・並び・フォルダ・選択の引き継ぎを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であること、作業データの往復で形が保たれることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathSplitEditor } from '../../js/edit/PathSplitEditor.js';
import { PathVertexEditor } from '../../js/edit/PathVertexEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した頂点5つの開いたパスを作る。
 * @param {string} id 代入するid
 * @returns {Path} パス
 */
function makePath(id) {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: -50, y: 50 }];
    const path = new Path(points, false, '#123456', 3, '#abcdef', 'line');
    path.id = id;
    return path;
}

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @returns {Rect} 矩形
 */
function makeRect(id) {
    const rect = new Rect(0, 0, 10, 10, '#112233', 2, null);
    rect.id = id;
    return rect;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @param {string} name 名前
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape, name) {
    return { kind: 'shape', shape, name, visible: true, locked: false };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {string} name 名前
 * @param {Array<Object>} children 中身
 * @returns {Object} フォルダのアイテム
 */
function groupItem(id, name, children) {
    return { kind: 'group', id, name, visible: true, locked: false, children };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・PathSplitEditor・PathVertexEditorを組み合わせる。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @param {string[]} selectedIds 選択する図形のid
 * @param {Array<[string, number[]]>} vertices 図形のidと点の番号の組
 * @returns {{ model: VectorModel, history: HistoryManager, editor: PathSplitEditor, vertexEditor: PathVertexEditor }} 組み合わせた実物
 */
function setupReal(items, selectedIds, vertices) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds);
    model.setSelectedVertices(pairsOf(model, vertices));
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const getMode = () => OperationMode.VERTEX;
    return {
        model,
        history,
        editor: new PathSplitEditor({ model, editRecorder: history, getMode }),
        vertexEditor: new PathVertexEditor({ model, editRecorder: history, getMode })
    };
}

/**
 * 図形のidと点の番号から、頂点の選択の組（ハンドル名）を作る。
 * @param {VectorModel} model モデル
 * @param {Array<[string, number[]]>} vertices 図形のidと点の番号の組
 * @returns {Array<{shapeId: string, handle: string}>} 頂点の選択
 */
function pairsOf(model, vertices) {
    const pairs = [];
    for (const [shapeId, indexes] of vertices) {
        const shape = model.getShapes().find((s) => s.id === shapeId);
        const names = shape.getVertexHandleNames();
        for (const index of indexes) {
            pairs.push({ shapeId, handle: names.find((name) => shape.getVertexIndexForHandle(name) === index) });
        }
    }
    return pairs;
}

/**
 * モデルの今の状態を作業データのJSON文字列にする。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function json(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

/**
 * 取り消しとやり直しで作業データのJSONと選択が戻り、記録が1件だけであることを確かめる。取り消し後は頂点の選択が外れる。
 * @param {VectorModel} model モデル
 * @param {HistoryManager} history 履歴
 * @param {string} before 操作前のJSON
 * @param {string} after 操作後のJSON
 * @param {string[]} selectedBefore 操作前の選択
 * @param {string[]} selectedAfter 操作後の選択
 */
function assertUndoRedo(model, history, before, after, selectedBefore, selectedAfter) {
    assert.notEqual(after, before);
    assert.equal(history.undo(), true);
    assert.equal(json(model), before);
    assert.deepEqual([...model.getSelectedIds()].sort(), [...selectedBefore].sort());
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(history.canUndo(), false, '記録は1件だけ');
    assert.equal(history.redo(), true);
    assert.equal(json(model), after);
    assert.deepEqual([...model.getSelectedIds()].sort(), [...selectedAfter].sort());
}

/**
 * フォルダの中のパスと、外の矩形からなる入れ子を作る。
 * @returns {Array<Object>} アイテムの入れ子
 */
function nestedItems() {
    return [
        groupItem('group-1', '甲組', [shapeItem(makePath('shape-1'), 'P名')]),
        shapeItem(makeRect('shape-9'), '矩形名')
    ];
}

test('分割: 取り消し1回で元の図形・名前・並び・フォルダ・選択に戻り、やり直しで戻る', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1'], [['shape-1', [2]]]);
    const before = json(model);

    assert.equal(editor.splitAtSelectedVertices(), true);
    const after = json(model);
    assert.equal(model.getItems()[0].children.length, 2);
    assert.deepEqual(model.getItems()[0].children.map((c) => c.name), ['P名', 'P名']);
    assert.equal(model.getSelectedIds().length, 2);
    assertUndoRedo(model, history, before, after, ['shape-1'], model.getSelectedIds());
});

test('区間の削除: 取り消し1回で元に戻り、やり直しで戻る', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1'], [['shape-1', [1, 2]]]);
    const before = json(model);

    assert.equal(editor.deleteSelectedSegments(), true);
    const after = json(model);
    assert.equal(model.getItems()[0].children.length, 2);
    assertUndoRedo(model, history, before, after, ['shape-1'], model.getSelectedIds());
});

test('複数の図形をまとめて切った・消したときも取り消し1回で戻る', () => {
    const items = [shapeItem(makePath('shape-1'), 'A'), shapeItem(makePath('shape-2'), 'B')];
    const split = setupReal(items, ['shape-1', 'shape-2'], [['shape-1', [2]], ['shape-2', [3]]]);
    const beforeSplit = json(split.model);
    assert.equal(split.editor.splitAtSelectedVertices(), true);
    assert.equal(split.model.getShapes().length, 4);
    assertUndoRedo(split.model, split.history, beforeSplit, json(split.model), ['shape-1', 'shape-2'], split.model.getSelectedIds());

    const del = setupReal(
        [shapeItem(makePath('shape-1'), 'A'), shapeItem(makePath('shape-2'), 'B')],
        ['shape-1', 'shape-2'],
        [['shape-1', [1, 2]], ['shape-2', [2, 3]]]
    );
    const beforeDel = json(del.model);
    assert.equal(del.editor.deleteSelectedSegments(), true);
    assert.equal(del.model.getShapes().length, 4);
    assertUndoRedo(del.model, del.history, beforeDel, json(del.model), ['shape-1', 'shape-2'], del.model.getSelectedIds());
});

test('図形ごと消えて空になったフォルダは残り、取り消しで図形が戻る', () => {
    const line = new Line(0, 0, 50, 50, '#000000', 2);
    line.id = 'shape-1';
    const { model, history, editor } = setupReal([groupItem('group-1', '甲組', [shapeItem(line, '線名')])], ['shape-1'], [['shape-1', [0, 1]]]);
    const before = json(model);

    assert.equal(editor.deleteSelectedSegments(), true);
    assert.deepEqual(model.getShapes(), []);
    assert.equal(model.getItems().length, 1);
    assert.deepEqual(model.getItems()[0].children, []);
    assertUndoRedo(model, history, before, json(model), ['shape-1'], []);
});

test('何も変わらないときは履歴に入らない', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1'], [['shape-1', [0, 4]]]);
    assert.equal(editor.splitAtSelectedVertices(), false);
    assert.equal(editor.deleteSelectedSegments(), false);
    assert.equal(history.canUndo(), false);
    assert.equal(model.getShapes().length, 2);
});

test('作業データの往復で結果のpath・名前・並びが保たれ、版は5のまま', () => {
    const { model, editor } = setupReal(nestedItems(), ['shape-1'], [['shape-1', [2]]]);
    assert.equal(editor.splitAtSelectedVertices(), true);

    const document = DocumentSerializer.serialize(model.getItems());
    assert.equal(document.version, 5);
    const text = JSON.stringify(document);
    const restored = DocumentSerializer.deserialize(JSON.parse(text));
    assert.equal(JSON.stringify(DocumentSerializer.serialize(restored.items)), text);
    assert.deepEqual(model.getShapes().map((s) => s.toJSON().type), ['path', 'path', 'rect']);
    assert.deepEqual(model.getItems()[0].children.map((c) => c.name), ['P名', 'P名']);
});

test('分割した線に、点の追加・削除（PathVertexEditor）を続けて使える', () => {
    const { model, editor, vertexEditor } = setupReal([shapeItem(makePath('shape-1'), 'P')], ['shape-1'], [['shape-1', [2]]]);
    assert.equal(editor.splitAtSelectedVertices(), true);
    assert.equal(model.getShapes().length, 2);
    assert.equal(model.getShapes()[0].toJSON().points.length, 3);

    assert.equal(vertexEditor.insertAt('shape-1', { x: 50, y: 0 }, 3), true);
    assert.equal(model.getShapes()[0].toJSON().points.length, 4);
    model.setSelectedVertices(pairsOf(model, [['shape-1', [1]]]));
    assert.equal(vertexEditor.removeSelectedVertices(), true);
    assert.equal(model.getShapes()[0].toJSON().points.length, 3);
});
