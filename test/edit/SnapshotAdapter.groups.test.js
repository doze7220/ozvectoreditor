/**
 * 責務: SnapshotAdapterと実物のVectorModel・HistoryManagerを組み合わせ、折りたたみが履歴の対象外であること・フォルダの選択が取り消し/やり直しで戻ることを検証する。
 * 公開APIだけを通す。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
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
 * フォルダ2つ（group-1:shape-1,shape-2／group-2:shape-3）と外の図形1つを持つ実物の組み合わせを作る。
 * @param {Object} [options] オプション
 * @param {() => boolean} [options.shouldRestoreSelection] 選択を復元してよいか
 * @returns {{ model: VectorModel, history: HistoryManager, adapter: SnapshotAdapter }} 組み合わせた実物
 */
function setup({ shouldRestoreSelection = () => true } = {}) {
    const model = new VectorModel();
    model.replaceAllShapes([
        {
            kind: 'group', id: 'group-1', children: [
                { kind: 'shape', shape: makeRect('shape-1', 0) },
                { kind: 'shape', shape: makeRect('shape-2', 20) }
            ]
        },
        { kind: 'group', id: 'group-2', children: [{ kind: 'shape', shape: makeRect('shape-3', 40) }] },
        { kind: 'shape', shape: makeRect('shape-4', 60) }
    ]);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    return { model, history, adapter };
}

/**
 * 1件の編集操作として実行する。
 * @param {HistoryManager} history 履歴
 * @param {() => void} fn 編集
 * @param {string} [key] まとめの鍵
 * @returns {boolean} 記録されたか
 */
function edit(history, fn, key) {
    history.beginEdit();
    fn();
    return history.commitEdit(key);
}

/**
 * 閉じているフォルダのidを前順で返す。
 * @param {VectorModel} model モデル
 * @returns {string[]} 閉じているフォルダのid
 */
function collapsedIds(model) {
    return model.getItems().filter((item) => item.kind === 'group' && item.collapsed === true).map((item) => item.id);
}

test('capture: documentにcollapsedが出ず、collapsedGroupIdsとselectedGroupIdsを持つ', () => {
    const { model, adapter } = setup();
    model.setGroupCollapsed('group-2', true);
    model.setSelection(['shape-1', 'shape-2'], { groupIds: ['group-1'] });
    const snapshot = adapter.capture();
    assert.equal(JSON.stringify(snapshot.document).includes('collapsed'), false);
    assert.deepEqual(snapshot.collapsedGroupIds, ['group-2']);
    assert.deepEqual(snapshot.selectedGroupIds, ['group-1']);
    assert.deepEqual(snapshot.selectedIds, ['shape-1', 'shape-2']);
});

test('折りたたみだけの変化は記録されない', () => {
    const { model, history } = setup();
    const recorded = edit(history, () => model.setGroupCollapsed('group-1', true));
    assert.equal(recorded, false);
    assert.equal(history.canUndo(), false);
});

test('まとめの鍵の畳み：折りたたみを挟んでも、挟まない場合と同じ結果になる', () => {
    const { model, history } = setup();
    edit(history, () => model.renameItem('shape-4', 'a'), 'k');
    model.setGroupCollapsed('group-1', true);
    edit(history, () => model.renameItem('shape-4', 'b'), 'k');
    const baseline = setup();
    edit(baseline.history, () => baseline.model.renameItem('shape-4', 'a'), 'k');
    edit(baseline.history, () => baseline.model.renameItem('shape-4', 'b'), 'k');
    assert.equal(history.canUndo(), baseline.history.canUndo());
    history.undo();
    baseline.history.undo();
    assert.equal(history.canUndo(), baseline.history.canUndo());
});

test('編集の間に折りたたみを変えても、取り消し/やり直しの往復で今の状態が保たれる', () => {
    const { model, history } = setup();
    edit(history, () => { model.renameItem('shape-4', 'x'); model.setSelection(['shape-4']); });
    model.setGroupCollapsed('group-1', true);
    history.undo();
    assert.deepEqual(collapsedIds(model), ['group-1']);
    model.setGroupCollapsed('group-2', true);
    history.redo();
    assert.deepEqual(collapsedIds(model), ['group-1', 'group-2']);
});

test('編集の後に折りたたみを開いても、取り消しで閉じ直されない', () => {
    const { model, history } = setup();
    model.setGroupCollapsed('group-1', true);
    edit(history, () => { model.renameItem('shape-4', 'x'); model.setSelection(['shape-4']); });
    model.setGroupCollapsed('group-1', false);
    history.undo();
    assert.deepEqual(collapsedIds(model), []);
});

test('取り消しで戻ったフォルダは、記録時の折りたたみになる', () => {
    const { model, history } = setup();
    model.setGroupCollapsed('group-2', true);
    edit(history, () => model.rearrangeItems(model.getItems().filter((item) => item.id !== 'group-2')));
    assert.equal(model.getItems().some((item) => item.id === 'group-2'), false);
    history.undo();
    assert.deepEqual(collapsedIds(model), ['group-2']);
});

test('取り消し/やり直しでフォルダを選んでいる状態が戻る', () => {
    const { model, history } = setup();
    model.setSelection(['shape-1', 'shape-2'], { groupIds: ['group-1'] });
    edit(history, () => { model.renameItem('shape-4', 'x'); model.setSelection(['shape-4']); });
    assert.deepEqual(model.getSelectedGroupIds(), []);
    history.undo();
    assert.deepEqual(model.getSelectedIds(), ['shape-1', 'shape-2']);
    assert.deepEqual(model.getSelectedGroupIds(), ['group-1']);
    history.redo();
    assert.deepEqual(model.getSelectedGroupIds(), []);
});

test('まだあるフォルダだけが戻る', () => {
    const { model, history, adapter } = setup();
    const snapshot = adapter.capture();
    snapshot.selectedIds = ['shape-1', 'shape-2', 'shape-3'];
    snapshot.selectedGroupIds = ['group-1', 'group-2', 'group-missing'];
    assert.equal(adapter.restore(snapshot), true);
    assert.deepEqual(model.getSelectedGroupIds(), ['group-1', 'group-2']);
    assert.equal(history.canUndo(), false);
});

test('shouldRestoreSelectionが偽ならフォルダの選択も戻らない', () => {
    const { model, history } = setup({ shouldRestoreSelection: () => false });
    model.setSelection(['shape-1', 'shape-2'], { groupIds: ['group-1'] });
    edit(history, () => { model.renameItem('shape-4', 'x'); model.setSelection(['shape-4']); });
    history.undo();
    assert.deepEqual(model.getSelectedIds(), []);
    assert.deepEqual(model.getSelectedGroupIds(), []);
});

test('復元で、閉じたフォルダの中の図形の選択が戻っても開かない', () => {
    const { model, history } = setup();
    model.setSelection(['shape-3'], { groupIds: [] });
    edit(history, () => { model.renameItem('shape-4', 'x'); model.setSelection(['shape-4']); });
    model.setGroupCollapsed('group-2', true);
    history.undo();
    assert.deepEqual(model.getSelectedIds(), ['shape-3']);
    assert.deepEqual(collapsedIds(model), ['group-2']);
});

test('restore: selectedGroupIds・collapsedGroupIdsが無いスナップショットは空として扱う', () => {
    const { adapter } = setup();
    const { document } = adapter.capture();
    const other = setup();
    other.model.setGroupCollapsed('group-1', true);
    assert.equal(other.adapter.restore({ document, selectedIds: [] }), true);
    assert.deepEqual(collapsedIds(other.model), ['group-1']);
    assert.deepEqual(other.model.getSelectedGroupIds(), []);
});
