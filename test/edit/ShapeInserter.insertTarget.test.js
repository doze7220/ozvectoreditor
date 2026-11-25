/**
 * 責務: ShapeInserter（insertsAtTarget）とClipboardControllerを実物のVectorModel・SnapshotAdapter・HistoryManagerと組み合わせ、
 * 貼り付け・複製・インポート相当の追加が描き込む先のすぐ上へ入ることを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
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
 * 図形のアイテムを作る。
 * @param {string} id 図形のid（名前も同じ）
 * @returns {Object} 図形のアイテム
 */
function shapeItem(id) {
    return { kind: 'shape', shape: makeRect(id), name: id, visible: true, locked: false };
}

/**
 * 図形a・b・c・d（この順）を入れた実物を組み合わせる。
 * @param {Array<Object>} [items] モデルへ入れるアイテム（省くとa〜d）
 * @returns {{ model: VectorModel, history: HistoryManager, inserter: ShapeInserter, clipboard: ClipboardController }} 組み合わせた実物
 */
function setup(items = ['a', 'b', 'c', 'd'].map(shapeItem)) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const inserter = new ShapeInserter({ model, editRecorder: history, insertsAtTarget: true });
    const deleteSelection = () => {
        history.beginEdit();
        model.deleteShapes(model.getSelectedIds());
        return history.commitEdit();
    };
    const clipboard = new ClipboardController({ model, inserter, deleteSelection });
    return { model, history, inserter, clipboard };
}

/**
 * アイテムの入れ子から、図形の名前を描画順で集める。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<string>} 名前の配列
 */
function flattenNames(items) {
    return items.flatMap((item) => (item.kind === 'group' ? flattenNames(item.children) : [item.name]));
}

/**
 * 図形の名前を描画順で返す（複製は元と同じ名前になるので、名前で位置を見る）。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} 名前の配列
 */
function names(model) {
    return flattenNames(model.getItems());
}

test('貼り付け: 選んだ図形のすぐ上へ入り、追加した図形だけが選ばれ、描き込む先もその図形になる（記録1件・取り消し）', () => {
    const { model, history, clipboard } = setup();
    model.setSelection(['b']);
    clipboard.copy();
    model.setSelection(['c']);
    const before = names(model);
    assert.equal(clipboard.paste(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'b', 'd']);
    const added = model.getSelectedIds();
    assert.equal(added.length, 1);
    assert.equal(model.getShapes()[3].id, added[0]);
    assert.equal(model.getInsertTargetId(), added[0]);
    assert.equal(history.undo(), true);
    assert.deepEqual(names(model), before);
    assert.equal(history.canUndo(), false);
});

test('同じ位置に貼り付け: 選んだ図形のすぐ上へ入る', () => {
    const { model, clipboard } = setup();
    model.setSelection(['a']);
    clipboard.copy();
    model.setSelection(['b']);
    assert.equal(clipboard.pasteInPlace(), true);
    assert.deepEqual(names(model), ['a', 'b', 'a', 'c', 'd']);
});

test('複製: 選んだ図形のすぐ上へ入る。離れた複数を選んだ複製は、選ばれている一番上の図形のすぐ上へまとめて入る（順は元のまま）', () => {
    const { model, history, clipboard } = setup();
    model.setSelection(['b']);
    assert.equal(clipboard.duplicate(), true);
    assert.deepEqual(names(model), ['a', 'b', 'b', 'c', 'd']);
    assert.equal(history.undo(), true);

    model.setSelection(['a', 'c']);
    assert.equal(clipboard.duplicate(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'a', 'c', 'd']);
    assert.equal(model.getSelectedIds().length, 2);
});

test('Alt+ドラッグの複製（duplicateInPlaceWithinEdit）: 選んだ図形のすぐ上へ入り、編集操作の確定で1件として記録される', () => {
    const { model, history, clipboard } = setup();
    model.setSelection(['b']);
    history.beginEdit();
    assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
    assert.equal(history.commitEdit(), true);
    assert.deepEqual(names(model), ['a', 'b', 'b', 'c', 'd']);
    assert.equal(history.undo(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'd']);
    assert.equal(history.canUndo(), false);
});

test('描き込む先なし: 末尾（最前面）へ入る', () => {
    const { model, clipboard } = setup();
    model.setSelection(['b']);
    clipboard.copy();
    model.replaceAllShapes(['a', 'b', 'c', 'd'].map(shapeItem));
    assert.equal(model.getInsertTargetId(), null);
    assert.equal(clipboard.paste(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'd', 'b']);
});

test('ツールの切り替え（clearSelection）で選択が空になった後の貼り付けも、描き込む先のすぐ上へ入る', () => {
    const { model, clipboard } = setup();
    model.setSelection(['a']);
    clipboard.copy();
    model.setSelection(['c']);
    model.clearSelection();
    assert.equal(model.getInsertTargetId(), 'c');
    assert.equal(clipboard.paste(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'a', 'd']);
});

test('フォルダの中が描き込む先なら、そのフォルダの中へ入る', () => {
    const { model, clipboard } = setup([
        shapeItem('a'),
        { kind: 'group', id: 'group-1', name: 'G', visible: true, locked: false, children: [shapeItem('b'), shapeItem('c')] },
        shapeItem('d')
    ]);
    model.setSelection(['a']);
    clipboard.copy();
    model.setSelection(['b']);
    assert.equal(clipboard.paste(), true);
    const items = model.getItems();
    assert.equal(items.length, 3);
    assert.equal(items[1].kind, 'group');
    assert.deepEqual(items[1].children.map((item) => item.name), ['b', 'a', 'c']);
});

test('インポート相当（入れ子の作業データ）: 入れ子のまま描き込む先のすぐ上へ入る', () => {
    const { model, history, inserter } = setup();
    const source = new VectorModel();
    source.replaceAllShapes([
        { kind: 'group', id: 'g', name: 'F', visible: true, locked: false, children: [shapeItem('x'), shapeItem('y')] }
    ]);
    const documentData = DocumentSerializer.serialize(source.getItems());
    model.setSelection(['b']);
    model.clearSelection();
    const result = inserter.insertDocument(documentData);
    assert.equal(result.ok, true);
    assert.equal(result.insertedIds.length, 2);
    const items = model.getItems();
    assert.equal(items.length, 5);
    assert.equal(items[2].kind, 'group');
    assert.deepEqual(items[2].children.map((item) => item.name), ['x', 'y']);
    assert.deepEqual(names(model), ['a', 'b', 'x', 'y', 'c', 'd']);
    assert.equal(history.undo(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'd']);
    assert.equal(history.canUndo(), false);
});

test('切り取って貼り付けると元の位置へ戻る。いちばん下の行を切り取ったときは描き込む先がいちばん外側の一番下になり、そこへ戻る（仕様）', () => {
    const { model, clipboard } = setup();
    model.setSelection(['b']);
    assert.equal(clipboard.cut(), true);
    assert.deepEqual(names(model), ['a', 'c', 'd']);
    assert.equal(clipboard.paste(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'd']);

    const second = setup();
    second.model.setSelection(['a']);
    assert.equal(second.clipboard.cut(), true);
    assert.deepEqual(second.model.getInsertTarget(), { kind: 'bottom', id: null });
    assert.equal(second.clipboard.paste(), true);
    assert.deepEqual(names(second.model), ['a', 'b', 'c', 'd']);
});

test('insertsAtTargetを省くと、選んだ図形があっても末尾（最前面）へ入る', () => {
    const model = new VectorModel();
    model.replaceAllShapes(['a', 'b', 'c'].map(shapeItem));
    const recorder = { beginEdit() {}, commitEdit() { return true; } };
    const inserter = new ShapeInserter({ model, editRecorder: recorder });
    const clipboard = new ClipboardController({ model, inserter, deleteSelection: () => false });
    model.setSelection(['a']);
    assert.equal(clipboard.duplicate(), true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'a']);
});

/**
 * アイテムの入れ子を作業データ形式へ直す。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {*} 作業データ
 */
function toDocument(items) {
    const source = new VectorModel();
    source.replaceAllShapes(items);
    return DocumentSerializer.serialize(source.getItems());
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中のアイテム
 * @returns {Object} フォルダのアイテム
 */
function groupItem(id, children) {
    return { kind: 'group', id, name: id, visible: true, locked: false, children };
}

test('ShapeInserter place: insertsAtTargetが真なら指定した場所へ入る（描き込む先より優先）', () => {
    const { model, inserter } = setup();
    model.setSelection(['d']);
    model.clearSelection();
    const result = inserter.insertDocument(toDocument([shapeItem('x')]), 0, 0, { place: { kind: 'above', id: 'b' } });
    assert.equal(result.inserted, true);
    assert.deepEqual(names(model), ['a', 'b', 'x', 'c', 'd']);
});

test('ShapeInserter place: insertsAtTargetが偽ならplaceを使わず末尾へ入る', () => {
    const model = new VectorModel();
    model.replaceAllShapes(['a', 'b', 'c'].map(shapeItem));
    const recorder = { beginEdit() {}, commitEdit() { return true; } };
    const inserter = new ShapeInserter({ model, editRecorder: recorder });
    const result = inserter.insertDocument(toDocument([shapeItem('x')]), 0, 0, { place: { kind: 'above', id: 'a' } });
    assert.equal(result.inserted, true);
    assert.deepEqual(names(model), ['a', 'b', 'c', 'x']);
});

test('ShapeInserter asUnits: フォルダだけ（空のフォルダ）の作業データが入り、1件の記録になり、取り消しで消える', () => {
    const { model, history, inserter } = setup();
    const documentData = toDocument([groupItem('g', [])]);
    const result = inserter.insertDocument(documentData, 0, 0, { asUnits: true });
    assert.equal(result.ok, true);
    assert.equal(result.inserted, true);
    assert.deepEqual(result.insertedIds, []);
    const items = model.getItems();
    assert.equal(items.length, 5);
    assert.equal(items[4].kind, 'group');
    assert.equal(items[4].children.length, 0);
    assert.equal(history.undo(), true);
    assert.equal(model.getItems().length, 4);
    assert.equal(history.canUndo(), false);
});

test('ShapeInserter asUnits: 偽ならフォルダだけの作業データでは何も起きない（inserted偽・記録なし）', () => {
    const { model, history, inserter } = setup();
    const documentData = toDocument([groupItem('g', [])]);
    const result = inserter.insertDocument(documentData);
    assert.equal(result.ok, true);
    assert.equal(result.inserted, false);
    assert.deepEqual(result.insertedIds, []);
    assert.equal(model.getItems().length, 4);
    assert.equal(history.canUndo(), false);
});

test('ShapeInserter inserted: 図形あり・全体の失敗・0件の真偽', () => {
    const { inserter } = setup();
    assert.equal(inserter.insertDocument(toDocument([shapeItem('x')])).inserted, true);
    const failed = inserter.insertDocument(null);
    assert.equal(failed.ok, false);
    assert.equal(failed.inserted, false);
    const empty = inserter.insertDocument(toDocument([]));
    assert.equal(empty.ok, true);
    assert.equal(empty.inserted, false);
    assert.equal(inserter.insertDocument(toDocument([]), 0, 0, { asUnits: true }).inserted, false);
});

test('ShapeInserter 記録しない入口: placeとasUnitsを受け、beginEdit/commitEditを呼ばない', () => {
    const { model, history, inserter } = setup();
    const calls = [];
    const recorder = { beginEdit() { calls.push('begin'); }, commitEdit() { calls.push('commit'); return true; } };
    const plain = new ShapeInserter({ model, editRecorder: recorder, insertsAtTarget: true });
    const result = plain.insertDocumentWithinEdit(toDocument([groupItem('g', [])]), 0, 0, {
        place: { kind: 'above', id: 'a' },
        asUnits: true
    });
    assert.equal(result.inserted, true);
    assert.deepEqual(calls, []);
    assert.equal(model.getItems()[1].kind, 'group');
    assert.equal(history.canUndo(), false);
    assert.ok(inserter);
});

test('ShapeInserter インポート相当（引数なし）: 描き込む先がフォルダの中・一番下ならそこへ入る', () => {
    const { model, inserter } = setup([shapeItem('a'), groupItem('g', [shapeItem('b'), shapeItem('c')]), shapeItem('d')]);
    model.setInsertTarget('g');
    assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: 'g' });
    assert.equal(inserter.insertDocument(toDocument([shapeItem('x')])).inserted, true);
    assert.deepEqual(model.getItems()[1].children.map((item) => item.name), ['b', 'c', 'x']);

    model.replaceAllShapes([shapeItem('a'), groupItem('g', [shapeItem('b'), shapeItem('c')]), shapeItem('d')]);
    model.setSelection(['a']);
    model.deleteShapes(['a']);
    assert.deepEqual(model.getInsertTarget(), { kind: 'bottom', id: null });
    assert.equal(inserter.insertDocument(toDocument([shapeItem('y')])).inserted, true);
    assert.deepEqual(names(model), ['y', 'b', 'c', 'd']);
});
