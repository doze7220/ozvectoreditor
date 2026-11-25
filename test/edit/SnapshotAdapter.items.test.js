/**
 * 責務: SnapshotAdapterと実物のVectorModel・HistoryManagerを組み合わせ、入れ子・フォルダのid・名前・表示・ロックが取り消し/やり直しで保たれることを検証する。
 * 公開APIだけを通す。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
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
 * 入れ子（フォルダ内に図形2つ・外に図形1つ）を持つ実物の組み合わせを作る。
 * @returns {{ model: VectorModel, history: HistoryManager, adapter: SnapshotAdapter }} 組み合わせた実物
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes([
        {
            kind: 'group', id: 'group-1', name: '親', visible: false, locked: true, children: [
                { kind: 'shape', shape: makeRect('shape-1', 0), name: '甲', visible: false, locked: true },
                { kind: 'shape', shape: makeRect('shape-2', 20), name: '乙', visible: true, locked: false }
            ]
        },
        { kind: 'shape', shape: makeRect('shape-3', 40), name: '丙', visible: true, locked: true }
    ]);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    return { model, history, adapter };
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

test('capture: 入れ子・フォルダのid・名前・表示・ロックを含む作業データになる', () => {
    const { adapter } = setup();
    const doc = adapter.capture().document;
    assert.equal(doc.shapes.length, 2);
    assert.equal(doc.shapes[0].type, 'group');
    assert.equal(doc.shapes[0].id, 'group-1');
    assert.equal(doc.shapes[0].name, '親');
    assert.equal(doc.shapes[0].visible, false);
    assert.equal(doc.shapes[0].locked, true);
    assert.equal(doc.shapes[0].children.length, 2);
    assert.equal(doc.shapes[0].children[0].name, '甲');
});

for (const [label, op] of [
    ['削除', (model) => model.deleteShapes(['shape-2'])],
    ['重なり順', (model) => model.rearrangeItems([...model.getItems()].reverse())],
    ['結合（作り直し）', (model) => model.replaceShape('shape-1', makeRect('shape-9', 5), { removeIds: ['shape-3'] })],
    ['追加', (model) => model.addShapesWithNewIds([makeRect('x', 100)])]
]) {
    test(`undo/redo: ${label}で入れ子・id・名前・表示・ロックがJSONの一致で戻る`, () => {
        const { model, history } = setup();
        const before = json(model);
        assert.equal(edit(history, () => op(model)), true);
        const after = json(model);
        assert.notEqual(after, before);
        assert.equal(history.undo(), true);
        assert.equal(json(model), before);
        assert.equal(history.redo(), true);
        assert.equal(json(model), after);
    });
}

test('変化が無い編集は記録されない（前後のJSONが一致）', () => {
    const { model, history } = setup();
    assert.equal(edit(history, () => model.moveShapes(['shape-1'], 0, 0)), false);
    assert.equal(history.canUndo(), false);
});

test('まとめの鍵: 同じ鍵の続けた編集は1件に畳まれ、1回の取り消しで先頭の前に戻る', () => {
    const { model, history } = setup();
    const before = json(model);
    assert.equal(edit(history, () => model.moveShapes(['shape-1'], 1, 0), 'k'), true);
    assert.equal(edit(history, () => model.moveShapes(['shape-1'], 1, 0), 'k'), true);
    assert.equal(history.undo(), true);
    assert.equal(json(model), before);
    assert.equal(history.canUndo(), false);
});

test('まとめの鍵: 往復して元へ戻ると記録が取り除かれる', () => {
    const { model, history } = setup();
    assert.equal(edit(history, () => model.moveShapes(['shape-1'], 5, 0), 'k'), true);
    assert.equal(edit(history, () => model.moveShapes(['shape-1'], -5, 0), 'k'), false);
    assert.equal(history.canUndo(), false);
});

test('restore: 入れ子の中の1件の読み飛ばしでも適用せずfalse（キャンバスは変わらない）', (t) => {
    t.mock.method(console, 'warn', () => {});
    const { model, adapter } = setup();
    const snapshot = adapter.capture();
    snapshot.document.shapes[0].children[1] = { type: 'unknown-type', id: 'z' };
    model.deleteShapes(['shape-3']);
    const before = json(model);
    assert.equal(adapter.restore(snapshot), false);
    assert.equal(json(model), before);
});

test('restore: shouldRestoreSelectionが真なら選択集合も戻る', () => {
    const { model, adapter } = setup();
    model.setSelection(['shape-2']);
    const snapshot = adapter.capture();
    model.clearSelection();
    assert.equal(adapter.restore(snapshot), true);
    assert.deepEqual(model.getSelectedIds(), ['shape-2']);
});
