/**
 * 責務: ShapeOrderEditor.moveTo（行のドラッグでの出し入れ・並べ替えの1件の編集操作）の振る舞いを検証する。
 * 偽の依存での呼び出し順と、実物のVectorModel・SnapshotAdapter・HistoryManagerとの組み合わせ（入れ子の結果・選択・記録1件・描き込む先）を扱う。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';
import { PLACE_KIND } from '../../js/core/ItemPlaceRules.js';

const { ABOVE, BELOW, INSIDE, BOTTOM } = PLACE_KIND;

/**
 * 図形のアイテムを作る。
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
 * @param {boolean} [collapsed=false] 折りたたむか
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, collapsed = false) {
    return { kind: ITEM_KIND.GROUP, id, name: `名${id}`, visible: true, locked: false, collapsed, children };
}

/**
 * 入れ子をidだけの形にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<Object|string>} idの入れ子（フォルダは`{ id, children }`）
 */
function tree(items) {
    return items.map((item) => (item.kind === ITEM_KIND.GROUP ? { id: item.id, children: tree(item.children) } : item.shape.id));
}

/**
 * idの入れ子のフォルダを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object|string>} children 中身
 * @returns {{ id: string, children: Array<Object|string> }} フォルダ
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

/**
 * 実物を組み合わせる。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {Array<string>} [selectedIds=[]] 選ぶ図形のid
 * @param {Array<string>} [groupIds=[]] 選ぶフォルダのid
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ShapeOrderEditor, notifications: () => number }} 組み合わせた実物
 */
function setup(items, selectedIds = [], groupIds = []) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    if (selectedIds.length > 0 || groupIds.length > 0) {
        model.setSelection(selectedIds, { groupIds });
    }
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({ capture: () => adapter.capture(), restore: (snapshot) => adapter.restore(snapshot) });
    const editor = new ShapeOrderEditor({ model, editRecorder: history });
    let count = 0;
    model.onChange(() => { count += 1; });
    return { model, history, editor, notifications: () => count };
}

/**
 * 偽のmodelと呼び出しの記録つきの偽のeditRecorderで手順を作る。
 * @param {Array<Object>} items 偽のmodelが返すアイテムの入れ子
 * @param {boolean} [result=true] rearrangeItemsの戻り値
 * @returns {{ editor: ShapeOrderEditor, calls: Array<Array<*>> }} 手順と呼び出しの記録
 */
function setupFake(items, result = true) {
    const calls = [];
    const model = {
        getItems: () => items,
        rearrangeItems: (nextItems) => {
            calls.push(['rearrangeItems', tree(nextItems)]);
            return result;
        }
    };
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: () => calls.push(['commitEdit'])
    };
    return { editor: new ShapeOrderEditor({ model, editRecorder }), calls };
}

test('偽の依存：beginEdit → rearrangeItems → commitEditの順に呼び、rearrangeItemsの戻り値を返す', () => {
    const { editor, calls } = setupFake([s('a'), s('b'), s('c')], true);
    assert.equal(editor.moveTo(['a'], { kind: ABOVE, id: 'c' }), true);
    assert.deepEqual(calls, [['beginEdit'], ['rearrangeItems', ['b', 'c', 'a']], ['commitEdit']]);
    const failing = setupFake([s('a'), s('b'), s('c')], false);
    assert.equal(failing.editor.moveTo(['a'], { kind: ABOVE, id: 'c' }), false);
    assert.deepEqual(failing.calls.map((call) => call[0]), ['beginEdit', 'rearrangeItems', 'commitEdit']);
});

test('偽の依存：同じ場所へ動かすなら何も呼ばない', () => {
    const { editor, calls } = setupFake([s('a'), s('b'), s('c')]);
    assert.equal(editor.moveTo(['b'], { kind: ABOVE, id: 'a' }), false);
    assert.equal(editor.moveTo(['b'], { kind: BELOW, id: 'c' }), false);
    assert.equal(editor.moveTo(['b'], { kind: ABOVE, id: 'b' }), false);
    assert.deepEqual(calls, []);
    assert.equal(editor.moveTo(['c'], { kind: BOTTOM, id: null }), true);
    assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'rearrangeItems', 'commitEdit']);
});

test('偽の依存：入れられない場所・場所なし・動かすものが無いときは何も呼ばずfalse', () => {
    const { editor, calls } = setupFake([s('x'), g('G', [s('a'), g('H', [s('b')])])]);
    assert.equal(editor.moveTo(['G'], { kind: INSIDE, id: 'G' }), false);
    assert.equal(editor.moveTo(['G'], { kind: INSIDE, id: 'H' }), false);
    assert.equal(editor.moveTo(['G'], { kind: ABOVE, id: 'b' }), false);
    assert.equal(editor.moveTo(['x'], null), false);
    assert.equal(editor.moveTo(['x'], { kind: ABOVE, id: 'ない' }), false);
    assert.equal(editor.moveTo(['ない'], { kind: BOTTOM, id: null }), false);
    assert.equal(editor.moveTo([], { kind: BOTTOM, id: null }), false);
    assert.deepEqual(calls, []);
});

test('実物：図形をフォルダの中へ入れ、外へ出し、別のフォルダへ動かす', () => {
    const { model, editor } = setup([s('x'), g('G', [s('a'), s('b')]), g('H', [s('c')]), s('y')]);
    assert.equal(editor.moveTo(['x'], { kind: INSIDE, id: 'G' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'b', 'x']), t('H', ['c']), 'y']);
    assert.equal(editor.moveTo(['a'], { kind: BELOW, id: 'y' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['b', 'x']), t('H', ['c']), 'a', 'y']);
    assert.equal(editor.moveTo(['x'], { kind: ABOVE, id: 'c' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['b']), t('H', ['c', 'x']), 'a', 'y']);
    assert.equal(editor.moveTo(['b'], { kind: BOTTOM, id: 'H' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', []), t('H', ['b', 'c', 'x']), 'a', 'y']);
});

test('実物：フォルダごと動かす（別のフォルダの中へ・外へ）', () => {
    const { model, editor } = setup([g('G', [s('a'), s('b')]), g('H', [s('c')]), s('y')]);
    assert.equal(editor.moveTo(['G'], { kind: INSIDE, id: 'H' }), true);
    assert.deepEqual(tree(model.getItems()), [t('H', ['c', t('G', ['a', 'b'])]), 'y']);
    assert.equal(editor.moveTo(['G'], { kind: BOTTOM, id: null }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'b']), t('H', ['c']), 'y']);
});

test('実物：選んでいる複数のまとまりを順のまま動かし、選択が残る', () => {
    const { model, editor } = setup([s('a'), g('G', [s('b'), s('c')]), s('d'), s('e')], ['a', 'b', 'c', 'e'], ['G']);
    assert.equal(editor.moveTo(['a', 'G', 'e'], { kind: ABOVE, id: 'd' }), true);
    assert.deepEqual(tree(model.getItems()), ['d', 'a', t('G', ['b', 'c']), 'e']);
    assert.deepEqual(model.getSelectedGroupIds(), ['G']);
    assert.equal(['a', 'b', 'c', 'e'].every((id) => model.isSelected(id)), true);
    assert.equal(model.isSelected('d'), false);
});

test('実物：選んでいるフォルダの中の行だけを動かしても、図形の選択は変わらない', () => {
    const { model, editor } = setup([g('G', [s('a'), s('b')]), s('y')], ['a', 'b'], ['G']);
    assert.equal(editor.moveTo(['a'], { kind: ABOVE, id: 'y' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['b']), 'y', 'a']);
    assert.equal(model.isSelected('a'), true);
    assert.equal(model.isSelected('b'), true);
    assert.equal(model.isSelected('y'), false);
});

test('実物：選んでいるフォルダへ選ばれていない図形を入れると、フォルダを選んでいる状態が外れる', () => {
    const { model, editor } = setup([g('G', [s('a'), s('b')]), s('y')], ['a', 'b'], ['G']);
    assert.deepEqual(model.getSelectedGroupIds(), ['G']);
    assert.equal(editor.moveTo(['y'], { kind: INSIDE, id: 'G' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'b', 'y'])]);
    assert.deepEqual(model.getSelectedGroupIds(), []);
    assert.equal(model.isSelected('a'), true);
    assert.equal(model.isSelected('y'), false);
});

test('実物：中身を全部出しても空のフォルダが残る', () => {
    const { model, editor } = setup([g('G', [s('a')]), s('y')]);
    assert.equal(editor.moveTo(['a'], { kind: BOTTOM, id: null }), true);
    assert.deepEqual(tree(model.getItems()), ['a', t('G', []), 'y']);
});

test('実物：折りたたんだフォルダへ入れても開かず、折りたたみの変化も通知されない', () => {
    const { model, editor } = setup([g('G', [s('a')], true), s('y')]);
    let collapsedNotifications = 0;
    model.onCollapsedChange(() => { collapsedNotifications += 1; });
    assert.equal(editor.moveTo(['y'], { kind: INSIDE, id: 'G' }), true);
    assert.deepEqual(tree(model.getItems()), [t('G', ['a', 'y'])]);
    assert.equal(model.getItems()[0].collapsed, true);
    assert.equal(collapsedNotifications, 0);
});

test('実物：自分の中・自分の中のフォルダの中へは入れられず、何も変わらない', () => {
    const { model, history, editor, notifications } = setup([g('G', [s('a'), g('H', [s('b')])]), s('y')]);
    const before = json(model);
    const count = notifications();
    assert.equal(editor.moveTo(['G'], { kind: INSIDE, id: 'G' }), false);
    assert.equal(editor.moveTo(['G'], { kind: INSIDE, id: 'H' }), false);
    assert.equal(editor.moveTo(['G'], { kind: BOTTOM, id: 'H' }), false);
    assert.equal(editor.moveTo(['G'], { kind: ABOVE, id: 'b' }), false);
    assert.equal(json(model), before);
    assert.equal(notifications(), count);
    assert.equal(history.canUndo(), false);
});

test('実物：記録は1件で、取り消し・やり直しでJSONが一致する', () => {
    const { model, history, editor } = setup([s('x'), g('G', [s('a'), s('b')]), s('y')]);
    const before = json(model);
    assert.equal(editor.moveTo(['x'], { kind: INSIDE, id: 'G' }), true);
    const after = json(model);
    assert.notEqual(after, before);
    history.undo();
    assert.equal(json(model), before);
    assert.equal(history.canUndo(), false);
    history.redo();
    assert.equal(json(model), after);
});

test('実物：同じ場所への移動は記録も通知もしない', () => {
    const { history, editor, notifications } = setup([s('a'), s('b'), s('c')]);
    const count = notifications();
    assert.equal(editor.moveTo(['b'], { kind: ABOVE, id: 'a' }), false);
    assert.equal(notifications(), count);
    assert.equal(history.canUndo(), false);
});

test('実物：描き込む先は行と一緒に動き、選択が無くても動かせる（描くツール相当）', () => {
    const { model, editor } = setup([s('a'), s('b'), s('c')]);
    model.setInsertTarget('b');
    assert.deepEqual(model.getInsertTarget(), { kind: ABOVE, id: 'b' });
    assert.equal(editor.moveTo(['b'], { kind: BOTTOM, id: null }), true);
    assert.deepEqual(tree(model.getItems()), ['b', 'a', 'c']);
    assert.deepEqual(model.getInsertTarget(), { kind: ABOVE, id: 'b' });
});

test('実物：フォルダの無い絵では、ドロップ位置の動かさない行と動かす行が今までの並びと同じになる', () => {
    const { model, editor } = setup([s('a'), s('b'), s('c'), s('d')]);
    assert.equal(editor.moveTo(['a', 'c'], { kind: ABOVE, id: 'd' }), true);
    assert.deepEqual(tree(model.getItems()), ['b', 'd', 'a', 'c']);
    assert.equal(editor.moveTo(['d'], { kind: BELOW, id: 'b' }), true);
    assert.deepEqual(tree(model.getItems()), ['d', 'b', 'a', 'c']);
});
