/**
 * 責務: ItemRenameEditor（名前を変える1件の編集操作の手順・履歴の単位・保存形式への追従）の振る舞いを検証する。
 * 偽の依存での呼び出し順の確認と、実物のVectorModel・SnapshotAdapter・HistoryManager・DocumentSerializerとの組み合わせを扱う。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ItemRenameEditor } from '../../js/edit/ItemRenameEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';

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
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・ItemRenameEditorを組み合わせる。
 * @param {Array<string>} ids 図形のid
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ItemRenameEditor, historyNotifications: () => number }} 組み合わせた実物
 */
function setupReal(ids) {
    const model = new VectorModel();
    model.replaceAllShapes(ids.map(makeRect));
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    let notifications = 0;
    history.onChange(() => { notifications += 1; });
    const editor = new ItemRenameEditor({ model, editRecorder: history });
    return { model, history, editor, historyNotifications: () => notifications };
}

/**
 * 図形のアイテムの名前を図形のidで引く。
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {string} 名前
 */
function nameOf(model, id) {
    return model.getItems().find((item) => item.kind === 'shape' && item.shape.id === id).name;
}

test('偽の依存: 変わるときはbeginEdit → renameItem → commitEditの順で呼ぶ', () => {
    const calls = [];
    const model = {
        getItems: () => [{ kind: 'shape', shape: { id: 'a' }, name: '旧' }],
        renameItem: (id, name) => { calls.push(['renameItem', id, name]); return true; }
    };
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: () => calls.push(['commitEdit'])
    };
    const editor = new ItemRenameEditor({ model, editRecorder });
    assert.equal(editor.rename('a', '新'), true);
    assert.deepEqual(calls, [['beginEdit'], ['renameItem', 'a', '新'], ['commitEdit']]);
});

test('偽の依存: 変わらないときはbeginEditも呼ばずfalse', () => {
    const calls = [];
    const model = {
        getItems: () => [{ kind: 'shape', shape: { id: 'a' }, name: '旧' }],
        renameItem: () => { calls.push(['renameItem']); return true; }
    };
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: () => calls.push(['commitEdit'])
    };
    const editor = new ItemRenameEditor({ model, editRecorder });
    assert.equal(editor.rename('a', '旧'), false);
    assert.equal(editor.rename('a', '  '), false);
    assert.equal(editor.rename('zzz', '新'), false);
    assert.deepEqual(calls, []);
});

test('実物: 履歴が1件、undoで名前が戻りredoで新しい名前になる', () => {
    const { model, history, editor } = setupReal(['A', 'B']);
    const original = nameOf(model, 'A');
    assert.equal(history.canUndo(), false);
    assert.equal(editor.rename('A', '新しい名前'), true);
    assert.equal(nameOf(model, 'A'), '新しい名前');
    assert.equal(history.canUndo(), true);
    history.undo();
    assert.equal(nameOf(model, 'A'), original);
    assert.equal(history.canUndo(), false, 'undo1回で履歴が空');
    history.redo();
    assert.equal(nameOf(model, 'A'), '新しい名前');
});

test('実物: 変わらないときは履歴・通知が増えない', () => {
    const { model, history, editor, historyNotifications } = setupReal(['A']);
    const before = historyNotifications();
    assert.equal(editor.rename('A', nameOf(model, 'A')), false);
    assert.equal(editor.rename('A', ''), false);
    assert.equal(editor.rename('none', 'x'), false);
    assert.equal(history.canUndo(), false);
    assert.equal(historyNotifications(), before);
});

test('実物: 名前を変えても選択集合が保たれる', () => {
    const { model, history, editor } = setupReal(['A', 'B', 'C']);
    model.setSelection(['A', 'C']);
    editor.rename('B', '新');
    assert.deepEqual([...model.getSelectedIds()].sort(), ['A', 'C']);
    history.undo();
    assert.deepEqual([...model.getSelectedIds()].sort(), ['A', 'C']);
});

test('実物: serializeに新しい名前が出てdeserializeで読める', () => {
    const { model, editor } = setupReal(['A', 'B']);
    editor.rename('A', '名前A');
    const data = DocumentSerializer.serialize(model.getItems());
    assert.ok(JSON.stringify(data).includes('名前A'));
    const restored = DocumentSerializer.deserialize(data);
    const found = restored.items.find((item) => item.kind === 'shape' && item.shape.id === 'A');
    assert.equal(found.name, '名前A');
});
