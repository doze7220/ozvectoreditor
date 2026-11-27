/**
 * 責務: PathVertexEditorと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、点の追加・削除の取り消し/やり直しと、名前・表示・ロック・フォルダ・一覧での位置の引き継ぎを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であること、作業データの往復で形が保たれることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathVertexEditor } from '../../js/edit/PathVertexEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';

/**
 * idを直接代入した頂点4つの開いたパスを作る。
 * @param {string} id 代入するid
 * @returns {Path} パス
 */
function makePath(id) {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
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
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape, name, visible, locked) {
    return { kind: 'shape', shape, name, visible, locked };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {string} name 名前
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @param {Array<Object>} children 中身
 * @returns {Object} フォルダのアイテム
 */
function groupItem(id, name, visible, locked, children) {
    return { kind: 'group', id, name, visible, locked, children };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・PathVertexEditorを組み合わせる。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @param {Array<string>} selectedIds 選択する図形のid
 * @param {Array<{shapeId: string, handle: string}>} vertices 頂点の選択
 * @returns {{ model: VectorModel, history: HistoryManager, editor: PathVertexEditor }} 組み合わせた実物
 */
function setupReal(items, selectedIds, vertices) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds);
    model.setSelectedVertices(vertices);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new PathVertexEditor({ model, editRecorder: history, getMode: () => OperationMode.VERTEX });
    return { model, history, editor };
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
 * アイテムの入れ子を、id・名前・表示・ロックだけの素のオブジェクトに写す。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<Object>} 写した入れ子（フォルダは`children`を持つ）
 */
function outline(items) {
    return items.map((item) => (item.kind === 'group'
        ? { id: item.id, name: item.name, visible: item.visible, locked: item.locked, children: outline(item.children) }
        : { id: item.shape.id, name: item.name, visible: item.visible, locked: item.locked }));
}

/**
 * 取り消しとやり直しで作業データのJSONが一致し、記録が1件だけであることを確かめる。取り消し後は頂点の選択が外れる。
 * @param {VectorModel} model モデル
 * @param {HistoryManager} history 履歴
 * @param {string} before 操作前のJSON
 * @param {string} after 操作後のJSON
 */
function assertUndoRedo(model, history, before, after) {
    assert.notEqual(after, before);
    assert.equal(history.undo(), true);
    assert.equal(json(model), before);
    assert.deepEqual(model.getSelectedVertices(), []);
    assert.equal(history.canUndo(), false, '記録は1件だけ');
    assert.equal(history.redo(), true);
    assert.equal(json(model), after);
}

/**
 * フォルダの中のパス（名前・非表示・ロック無し）と外の矩形からなる入れ子を作る。
 * @param {Path} path フォルダの中に入れるパス
 * @returns {Array<Object>} アイテムの入れ子
 */
function nestedItems(path) {
    return [
        groupItem('group-1', '甲組', true, false, [shapeItem(path, 'P名', true, false)]),
        shapeItem(makeRect('shape-9'), '矩形名', true, false)
    ];
}

test('点の追加: 名前・表示・ロック・フォルダ・idが保たれ、取り消し1回で戻りやり直しで戻る（頂点の選択は外れる）', () => {
    const { model, history, editor } = setupReal(nestedItems(makePath('shape-1')), [], []);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.insertAt('shape-1', { x: 50, y: 0 }, 3), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(model.getShapes()[0].toJSON().points.length, 5);
    assert.equal(model.getSelectedVertices().length, 1);
    assertUndoRedo(model, history, before, json(model));
});

test('点の削除: 名前・表示・ロック・フォルダ・idが保たれ、取り消し1回で戻りやり直しで戻る', () => {
    const { model, history, editor } = setupReal(nestedItems(makePath('shape-1')), ['shape-1'], [{ shapeId: 'shape-1', handle: 'vertex-1' }]);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.removeSelectedVertices(), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(model.getShapes()[0].toJSON().points.length, 3);
    assertUndoRedo(model, history, before, json(model));
});

test('複数の図形の点をまとめて消しても取り消し1回で戻る', () => {
    const rect = makeRect('shape-9');
    const { model, history, editor } = setupReal(nestedItems(makePath('shape-1')), ['shape-1', 'shape-9'], []);
    model.setSelectedVertices([
        { shapeId: 'shape-1', handle: 'vertex-0' },
        { shapeId: 'shape-9', handle: model.getShapes()[1].getVertexHandleNames()[0] }
    ]);
    assert.equal(rect.id, 'shape-9');
    const before = json(model);

    assert.equal(editor.removeSelectedVertices(), true);
    assert.equal(model.getShapes()[0].toJSON().points.length, 3);
    assert.equal(model.getShapes()[1].toJSON().points.length, 3);
    assertUndoRedo(model, history, before, json(model));
});

test('図形ごと消えて空になったフォルダは残り、取り消しで図形が戻る', () => {
    const { model, history, editor } = setupReal(
        [groupItem('group-1', '甲組', true, false, [shapeItem(makeRect('shape-1'), '矩形名', true, false)])],
        ['shape-1'],
        []
    );
    const names = model.getShapes()[0].getVertexHandleNames();
    model.setSelectedVertices(names.slice(0, 3).map((handle) => ({ shapeId: 'shape-1', handle })));
    const before = json(model);

    assert.equal(editor.removeSelectedVertices(), true);
    assert.deepEqual(model.getShapes(), []);
    assert.deepEqual(outline(model.getItems()), [{ id: 'group-1', name: '甲組', visible: true, locked: false, children: [] }]);
    assertUndoRedo(model, history, before, json(model));
});

test('一覧での位置が保たれる（前後の図形の間に足す・消す）', () => {
    const items = [
        shapeItem(makeRect('shape-8'), 'R前', true, false),
        shapeItem(makePath('shape-1'), 'P名', true, false),
        shapeItem(makeRect('shape-9'), 'R後', true, false)
    ];
    const { model, editor } = setupReal(items, [], []);
    assert.equal(editor.insertAt('shape-1', { x: 50, y: 0 }, 3), true);
    assert.deepEqual(model.getShapes().map((s) => s.id), ['shape-8', 'shape-1', 'shape-9']);
    model.setSelectedVertices([{ shapeId: 'shape-1', handle: 'vertex-0' }]);
    assert.equal(editor.removeSelectedVertices(), true);
    assert.deepEqual(model.getShapes().map((s) => s.id), ['shape-8', 'shape-1', 'shape-9']);
});

test('何も変わらないときは履歴に入らない', () => {
    const { model, history, editor } = setupReal(nestedItems(makePath('shape-1')), ['shape-1'], []);
    assert.equal(editor.insertAt('shape-1', { x: 50, y: 50 }, 3), false);
    assert.equal(editor.removeSelectedVertices(), false);
    assert.equal(history.canUndo(), false);
    assert.equal(model.getShapes().length, 2);
});

test('作業データの往復で結果のパス・直線が保たれ、版は4のまま', () => {
    const curve = new Curve(0, 0, 40, 20, '#000000', 2, null);
    curve.id = 'shape-2';
    const { model, editor } = setupReal(
        [shapeItem(makePath('shape-1'), 'P', true, false), shapeItem(curve, 'C', true, false)],
        [],
        []
    );
    assert.equal(editor.insertAt('shape-1', { x: 50, y: 0 }, 3), true);
    model.setSelection(['shape-2']);
    model.setSelectedVertices([{ shapeId: 'shape-2', handle: curve.getVertexHandleNames()[0] }]);
    assert.equal(editor.removeSelectedVertices(), true);

    const document = DocumentSerializer.serialize(model.getItems());
    assert.equal(document.version, 5);
    const text = JSON.stringify(document);
    const restored = DocumentSerializer.deserialize(JSON.parse(text));
    assert.equal(JSON.stringify(DocumentSerializer.serialize(restored.items)), text);
    const types = model.getShapes().map((s) => s.toJSON().type);
    assert.deepEqual(types, ['path', 'line']);
});
