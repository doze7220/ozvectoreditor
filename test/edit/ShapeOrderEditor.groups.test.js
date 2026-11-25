/**
 * 責務: ShapeOrderEditor.applyの重なり順のキーが、まとまり（選んでいるフォルダと図形）を単位に、兄弟の並びごとに動くことを検証する。
 * 実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、入れ子の結果・選択・記録1件・取り消し/やり直しのJSONの一致を確かめる。
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
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';

const { BRING_TO_FRONT, BRING_FORWARD, SEND_BACKWARD, SEND_TO_BACK } = ShapeOrderOperation;

/**
 * 図形のアイテムを作る（図形のidは引数のまま、名前は`名<id>`）。
 * @param {string} id 図形のid
 * @returns {Object} 図形のアイテム
 */
function s(id) {
    const rect = new Rect(0, 0, 10, 10, '#112233', 2, null);
    rect.id = id;
    return { kind: ITEM_KIND.SHAPE, shape: rect, name: `名${id}`, visible: true, locked: false };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @returns {Object} フォルダのアイテム
 */
function g(id, children) {
    return { kind: ITEM_KIND.GROUP, id, name: `名${id}`, visible: true, locked: false, children };
}

/**
 * 実物を組み合わせる。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {Array<string>} selectedIds 選ぶ図形のid
 * @param {Array<string>} [groupIds=[]] 選ぶフォルダのid（中の図形がすべて`selectedIds`にあること）
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ShapeOrderEditor, notifications: () => number }} 組み合わせた実物
 */
function setup(items, selectedIds, groupIds = []) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds, { groupIds });
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({ capture: () => adapter.capture(), restore: (snapshot) => adapter.restore(snapshot) });
    const editor = new ShapeOrderEditor({ model, editRecorder: history });
    let count = 0;
    model.onChange(() => { count += 1; });
    return { model, history, editor, notifications: () => count };
}

/**
 * 入れ子をidだけの形（フォルダは`{ id, children }`、図形は文字列）にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<Object|string>} idの入れ子
 */
function tree(items) {
    return items.map((item) => (item.kind === ITEM_KIND.GROUP ? { id: item.id, children: tree(item.children) } : item.shape.id));
}

/**
 * idの入れ子のフォルダを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object|string>} children 中身
 * @returns {{ id: string, children: Array<Object|string> }} idの入れ子のフォルダ
 */
function t(id, children) {
    return { id, children };
}

/**
 * モデルの今の状態を作業データのJSON文字列にする。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function json(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

test('フォルダの中の図形は、そのフォルダの中だけで動く（外側の並びは変わらない）', () => {
    const { model, editor } = setup([s('x'), g('G', [s('a'), s('b'), s('c')]), s('y')], ['b']);
    assert.equal(editor.apply(BRING_TO_FRONT), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('G', ['a', 'c', 'b']), 'y']);
    assert.equal(editor.apply(SEND_TO_BACK), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('G', ['b', 'a', 'c']), 'y']);
    assert.equal(editor.apply(BRING_FORWARD), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('G', ['a', 'b', 'c']), 'y']);
    assert.equal(editor.apply(SEND_BACKWARD), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('G', ['b', 'a', 'c']), 'y']);
});

test('選んだフォルダは外側の並びで1要素として動き、中身の並びは変わらない', () => {
    const { model, editor } = setup([s('x'), g('G', [s('a'), s('b')]), s('y')], ['a', 'b'], ['G']);
    assert.equal(editor.apply(BRING_TO_FRONT), true);
    assert.deepEqual(tree(model.getItems()), ['x', 'y', t('G', ['a', 'b'])]);
    assert.equal(editor.apply(SEND_TO_BACK), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'b']), 'x', 'y']);
    assert.equal(editor.apply(BRING_FORWARD), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('G', ['a', 'b']), 'y']);
    assert.equal(editor.apply(SEND_BACKWARD), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'b']), 'x', 'y']);
});

test('選んだフォルダの中の並びには選択中が無く、フォルダ1つだけの絵ではどの操作も何もしない', () => {
    const { model, history, editor, notifications } = setup([g('G', [s('a'), s('b')])], ['a', 'b'], ['G']);
    for (const op of Object.values(ShapeOrderOperation)) {
        assert.equal(editor.apply(op), false, op);
    }
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'b'])]);
    assert.equal(history.canUndo(), false);
    assert.equal(notifications(), 0);
});

test('隣のフォルダの中へは入らない（フォルダごとの移動はフォルダの並びのまま、中の図形はフォルダの端で止まる）', () => {
    const folder = setup([g('G1', [s('a')]), g('G2', [s('b')])], ['a'], ['G1']);
    assert.equal(folder.editor.apply(BRING_FORWARD), true);
    assert.deepEqual(tree(folder.model.getItems()), [t('G2', ['b']), t('G1', ['a'])]);

    const inner = setup([g('G1', [s('a')]), g('G2', [s('b')])], ['a']);
    assert.equal(inner.editor.apply(BRING_FORWARD), false);
    assert.equal(inner.editor.apply(BRING_TO_FRONT), false);
    assert.deepEqual(tree(inner.model.getItems()), [t('G1', ['a']), t('G2', ['b'])]);
    assert.equal(inner.history.canUndo(), false);
});

test('入れ子をまたいで選んだとき、並びごとにそれぞれ動く（動けない並びは動かない）', () => {
    const front = setup([g('G', [s('a'), s('b')]), s('c')], ['a', 'c']);
    assert.equal(front.editor.apply(BRING_TO_FRONT), true);
    assert.deepEqual(tree(front.model.getItems()), [t('G', ['b', 'a']), 'c']);

    const back = setup([g('G', [s('a'), s('b')]), s('c')], ['a', 'c']);
    assert.equal(back.editor.apply(SEND_TO_BACK), true);
    assert.deepEqual(tree(back.model.getItems()), ['c', t('G', ['a', 'b'])]);
    assert.equal(back.history.canUndo(), true);
});

test('選んだフォルダと、その外の図形、別のフォルダの中の図形をまとめて動かす', () => {
    const { model, editor } = setup([g('G1', [s('a')]), s('x'), g('G2', [s('b'), s('c')])], ['a', 'x', 'b'], ['G1']);
    assert.equal(editor.apply(BRING_TO_FRONT), true);
    assert.deepEqual(tree(model.getItems()), [t('G2', ['c', 'b']), t('G1', ['a']), 'x']);
});

test('端・選択なしでは何も呼ばず、履歴も通知も変わらない', () => {
    const cases = [
        [[s('a'), s('b')], ['b'], BRING_TO_FRONT],
        [[s('a'), s('b')], ['a'], SEND_TO_BACK],
        [[s('a'), s('b')], [], BRING_FORWARD],
        [[g('G', [s('a'), s('b')]), s('c')], ['b'], BRING_FORWARD],
        [[g('G', [s('a'), s('b')]), s('c')], ['c'], BRING_TO_FRONT]
    ];
    for (const [items, selected, op] of cases) {
        const { model, history, editor, notifications } = setup(items, selected);
        const before = json(model);
        assert.equal(editor.apply(op), false, `${selected}/${op}`);
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false);
        assert.equal(notifications(), 0);
    }
});

test('空のフォルダも選んで動かせ、中身が空のままフォルダごと動く', () => {
    const { model, editor } = setup([g('E', []), s('x')], [], ['E']);
    assert.deepEqual([...model.getSelectedGroupIds()], ['E']);
    assert.equal(editor.apply(BRING_TO_FRONT), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('E', [])]);
    assert.equal(editor.apply(BRING_TO_FRONT), false);
    assert.deepEqual([...model.getSelectedGroupIds()], ['E']);
});

test('全部選んでいるときは何もしない（フォルダごと選んでいても、中の図形だけを選んでいても）', () => {
    const items = () => [g('G', [s('a'), s('b')]), s('c')];
    const withGroup = setup(items(), ['a', 'b', 'c'], ['G']);
    for (const op of [BRING_TO_FRONT, BRING_FORWARD, SEND_BACKWARD, SEND_TO_BACK]) {
        assert.equal(withGroup.editor.apply(op), false, op);
    }
    const shapesOnly = setup(items(), ['a', 'b', 'c']);
    assert.equal(shapesOnly.editor.apply(BRING_TO_FRONT), false);
    assert.equal(shapesOnly.editor.apply(BRING_FORWARD), false);
    assert.equal(withGroup.history.canUndo(), false);
    assert.equal(shapesOnly.history.canUndo(), false);
});

test('記録は1件で、取り消し/やり直しで作業データのJSONが一致し、フォルダを選んでいる状態も戻る', () => {
    const { model, history, editor } = setup([s('x'), g('G', [s('a'), s('b')]), s('y')], ['a', 'b'], ['G']);
    const before = json(model);
    assert.equal(editor.apply(BRING_TO_FRONT), true);
    const after = json(model);
    assert.notEqual(after, before);
    assert.deepEqual([...model.getSelectedGroupIds()], ['G']);
    assert.deepEqual([...model.getSelectedIds()].sort(), ['a', 'b']);

    assert.equal(history.undo(), true);
    assert.equal(json(model), before);
    assert.deepEqual([...model.getSelectedGroupIds()], ['G']);
    assert.equal(history.canUndo(), false, '記録は1件だけ');
    assert.equal(history.redo(), true);
    assert.equal(json(model), after);
    assert.deepEqual([...model.getSelectedGroupIds()], ['G']);
});

test('折りたたんだフォルダごと動かしても、折りたたみは保たれる', () => {
    const { model, editor } = setup([g('G', [s('a')]), s('x')], ['a'], ['G']);
    assert.equal(model.setGroupCollapsed('G', true), true);
    assert.equal(editor.apply(BRING_TO_FRONT), true);
    assert.deepEqual(tree(model.getItems()), ['x', t('G', ['a'])]);
    assert.equal(model.getItems()[1].collapsed, true);
});

test('フォルダの無い絵では、今までと同じ並びになる', () => {
    const expected = {
        [BRING_TO_FRONT]: ['A', 'C', 'E', 'B', 'D'],
        [BRING_FORWARD]: ['A', 'C', 'B', 'E', 'D'],
        [SEND_BACKWARD]: ['B', 'A', 'D', 'C', 'E'],
        [SEND_TO_BACK]: ['B', 'D', 'A', 'C', 'E']
    };
    for (const [op, order] of Object.entries(expected)) {
        const { model, history, editor } = setup(['A', 'B', 'C', 'D', 'E'].map(s), ['B', 'D']);
        assert.equal(editor.apply(op), true, op);
        assert.deepEqual(model.getShapes().map((shape) => shape.id), order, op);
        assert.equal(history.undo(), true);
        assert.equal(history.canUndo(), false);
    }
});

test('未知の操作はErrorで、履歴は増えない', () => {
    const { history, editor } = setup([g('G', [s('a')]), s('x')], ['x']);
    assert.throws(() => editor.apply('unknown'), /未知の重なり順の操作/);
    assert.equal(history.canUndo(), false);
});
