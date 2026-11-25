/**
 * 責務: PathCornerEditorと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、角の切り替え・区間の切り替えで名前・表示・ロック・フォルダが保たれることを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathCornerEditor } from '../../js/edit/PathCornerEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * idを直接代入した頂点4つの開いたパスを作る。
 * @param {string} id 代入するid
 * @param {string|string[]} kinds 区間の種類
 * @returns {Path} パス
 */
function makePath(id, kinds) {
    const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 30 }, { x: 90, y: 30 }];
    const path = new Path(points, false, '#123456', 3, '#abcdef', kinds);
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
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・PathCornerEditorを組み合わせ、頂点の選択モードで点を選ぶ。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @param {Array<string>} selectedIds 選択する図形のid
 * @param {Array<{shapeId: string, handle: string}>} vertices 頂点の選択
 * @returns {{ model: VectorModel, history: HistoryManager, editor: PathCornerEditor }} 組み合わせた実物
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
    const editor = new PathCornerEditor({ model, editRecorder: history, getMode: () => OperationMode.VERTEX });
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
 * 取り消しとやり直しで作業データのJSONが一致し、記録が1件だけであることを確かめる。
 * @param {VectorModel} model モデル
 * @param {HistoryManager} history 履歴
 * @param {string} before 操作前のJSON
 * @param {string} after 操作後のJSON
 */
function assertUndoRedo(model, history, before, after) {
    assert.notEqual(after, before);
    assert.equal(history.undo(), true);
    assert.equal(json(model), before);
    assert.equal(history.canUndo(), false, '記録は1件だけ');
    assert.equal(history.redo(), true);
    assert.equal(json(model), after);
}

/**
 * フォルダの中のパス（名前・非表示・ロック）と外の矩形からなる入れ子を作る。
 * @param {Path} path フォルダの中に入れるパス
 * @returns {Array<Object>} アイテムの入れ子
 */
function nestedItems(path) {
    return [
        groupItem('group-1', '甲組', true, false, [shapeItem(path, 'P名', true, false)]),
        shapeItem(makeRect('shape-9'), '矩形名', false, true)
    ];
}

test('角の切り替え: 名前・表示・ロック・フォルダ・idが保たれ、角の値だけが変わる。取り消し/やり直しでJSONが一致し記録は1件', () => {
    const { model, history, editor } = setupReal(
        nestedItems(makePath('shape-1', SEGMENT_KIND_SMOOTH)),
        ['shape-1'],
        [{ shapeId: 'shape-1', handle: 'vertex-2' }]
    );
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.toggle(), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.deepEqual(model.getShapes()[0].toJSON().corners, [false, false, true, false]);
    assertUndoRedo(model, history, before, json(model));
});

test('区間の切り替え（曲線に）: 作り直した図形でも名前・表示・ロック・フォルダ・idが保たれ、点が足される', () => {
    const { model, history, editor } = setupReal(
        nestedItems(makePath('shape-1', SEGMENT_KIND_LINE)),
        ['shape-1'],
        [{ shapeId: 'shape-1', handle: 'vertex-1' }, { shapeId: 'shape-1', handle: 'vertex-2' }]
    );
    const before = json(model);
    const outlineBefore = outline(model.getItems());
    const pointsBefore = model.getShapes()[0].toJSON().points.length;

    assert.equal(editor.switchSegmentsToCurve(), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.ok(model.getShapes()[0].toJSON().points.length > pointsBefore);
    assertUndoRedo(model, history, before, json(model));
});

test('区間の切り替え（直線に）: 作り直した図形でも名前・表示・ロック・フォルダ・idが保たれる', () => {
    const { model, history, editor } = setupReal(
        nestedItems(makePath('shape-1', SEGMENT_KIND_SMOOTH)),
        ['shape-1'],
        [{ shapeId: 'shape-1', handle: 'vertex-1' }, { shapeId: 'shape-1', handle: 'vertex-2' }]
    );
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.switchSegmentsToLine(), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.ok(model.getShapes()[0].toJSON().segments.some((segment) => segment.kind === SEGMENT_KIND_LINE));
    assertUndoRedo(model, history, before, json(model));
});

test('区間の切り替え: 別のフォルダの2つのパスを同時に切り替えても、それぞれの名前・表示・ロックが保たれ記録は1件', () => {
    const { model, history, editor } = setupReal([
        groupItem('group-1', '甲組', true, false, [shapeItem(makePath('shape-1', SEGMENT_KIND_LINE), 'P甲', true, false)]),
        groupItem('group-2', '乙組', true, false, [shapeItem(makePath('shape-2', SEGMENT_KIND_LINE), 'P乙', true, false)])
    ], ['shape-1', 'shape-2'], [
        { shapeId: 'shape-1', handle: 'vertex-0' },
        { shapeId: 'shape-1', handle: 'vertex-1' },
        { shapeId: 'shape-2', handle: 'vertex-2' },
        { shapeId: 'shape-2', handle: 'vertex-3' }
    ]);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.switchSegmentsToCurve(), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assertUndoRedo(model, history, before, json(model));
});
