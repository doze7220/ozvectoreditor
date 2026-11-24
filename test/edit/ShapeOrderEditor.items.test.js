/**
 * 責務: ShapeOrderEditorと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、重なり順の4操作でフォルダの位置と入れ子が残り、名前・表示・ロックが図形について動くことを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ShapeOrderOperation } from '../../js/edit/ShapeOrderRules.js';
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
 * 図形のアイテムを作る（名前は`名<id>`、表示・ロックはidごとに異なる値にする）。
 * @param {string} id 図形のid（`shape-<数>`）
 * @returns {Object} 図形のアイテム
 */
function shapeItem(id) {
    const n = Number(id.slice('shape-'.length));
    return { kind: 'shape', shape: makeRect(id), name: `名${id}`, visible: n % 2 === 1, locked: n % 3 === 0 };
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
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・ShapeOrderEditorを組み合わせる。
 * 入れ子は「フォルダ1［図形1, 図形2］・図形3・フォルダ2［図形4］・図形5」（描画順は図形1〜5）。
 * @param {Array<string>} selectedIds 選択する図形のid
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ShapeOrderEditor }} 組み合わせた実物
 */
function setupReal(selectedIds) {
    const model = new VectorModel();
    model.replaceAllShapes([
        groupItem('group-1', '甲組', false, true, [shapeItem('shape-1'), shapeItem('shape-2')]),
        shapeItem('shape-3'),
        groupItem('group-2', '乙組', true, false, [shapeItem('shape-4')]),
        shapeItem('shape-5')
    ]);
    model.setSelection(selectedIds);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new ShapeOrderEditor({ model, editRecorder: history });
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
 * 入れ子の骨組み（フォルダのid・名前・表示・ロックと、図形の位置）だけを写す。図形のアイテムは`'*'`にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<Object|string>} 骨組み
 */
function skeleton(items) {
    return items.map((item) => (item.kind === 'group'
        ? { id: item.id, name: item.name, visible: item.visible, locked: item.locked, children: skeleton(item.children) }
        : '*'));
}

/**
 * 図形のidごとに、名前・表示・ロックを集める（入れ子の中も）。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Object<string, {name: string, visible: boolean, locked: boolean}>} 図形のidから属性への対応
 */
function attributesById(items) {
    const result = {};
    for (const item of items) {
        if (item.kind === 'group') {
            Object.assign(result, attributesById(item.children));
        } else {
            result[item.shape.id] = { name: item.name, visible: item.visible, locked: item.locked };
        }
    }
    return result;
}

const CASES = [
    [ShapeOrderOperation.BRING_TO_FRONT, ['shape-1', 'shape-2', 'shape-4', 'shape-5', 'shape-3']],
    [ShapeOrderOperation.BRING_FORWARD, ['shape-1', 'shape-2', 'shape-4', 'shape-3', 'shape-5']],
    [ShapeOrderOperation.SEND_BACKWARD, ['shape-1', 'shape-3', 'shape-2', 'shape-4', 'shape-5']],
    [ShapeOrderOperation.SEND_TO_BACK, ['shape-3', 'shape-1', 'shape-2', 'shape-4', 'shape-5']]
];

for (const [operation, expectedOrder] of CASES) {
    test(`重なり順（${operation}）: 平らな並びが指定どおりになり、フォルダの位置・入れ子が残り、名前・表示・ロックは図形について動く。記録は1件`, () => {
        const { model, history, editor } = setupReal(['shape-3']);
        const before = json(model);
        const skeletonBefore = skeleton(model.getItems());
        const attributesBefore = attributesById(model.getItems());

        assert.equal(editor.apply(operation), true);
        assert.deepEqual(model.getShapes().map((shape) => shape.id), expectedOrder);
        assert.deepEqual(skeleton(model.getItems()), skeletonBefore);
        assert.deepEqual(attributesById(model.getItems()), attributesBefore);

        const after = json(model);
        assert.notEqual(after, before);
        assert.equal(history.undo(), true);
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false, '記録は1件だけ');
        assert.equal(history.redo(), true);
        assert.equal(json(model), after);
    });
}

test('重なり順: フォルダの中の図形を最前面へ送っても、フォルダは空にならず残り、図形は新しい位置の所属になる', () => {
    const { model, editor } = setupReal(['shape-1']);

    assert.equal(editor.apply(ShapeOrderOperation.BRING_TO_FRONT), true);
    assert.deepEqual(model.getShapes().map((shape) => shape.id), ['shape-2', 'shape-3', 'shape-4', 'shape-5', 'shape-1']);
    const items = model.getItems();
    assert.equal(items[0].kind, 'group');
    assert.equal(items[0].id, 'group-1');
    assert.deepEqual(items[0].children.map((item) => item.shape.id), ['shape-2', 'shape-3']);
    assert.equal(items[1].kind, 'shape');
    assert.equal(items[1].shape.id, 'shape-4');
    assert.equal(items[2].kind, 'group');
    assert.equal(items[2].id, 'group-2');
    assert.deepEqual(items[2].children.map((item) => item.shape.id), ['shape-5']);
    assert.equal(items[3].shape.id, 'shape-1');
    assert.equal(items[3].name, '名shape-1');
});
