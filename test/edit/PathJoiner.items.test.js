/**
 * 責務: PathJoinerと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、結合（閉じる・2本）で名前・表示・ロック・所属のフォルダが引き継がれることを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点x
 * @param {number} x2 終点x
 * @returns {Line} 直線（y=0の水平線）
 */
function makeLine(id, x1, x2) {
    const line = new Line(x1, 0, x2, 0, '#112233', 2);
    line.id = id;
    return line;
}

/**
 * idを直接代入した開いたパスを作る。
 * @param {string} id 代入するid
 * @returns {Path} 頂点3つの開いたパス
 */
function makePath(id) {
    const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], false, '#445566', 3);
    path.id = id;
    return path;
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
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・PathJoinerを組み合わせる（換算は等倍）。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @param {Array<string>} selectedIds 選択する図形のid
 * @returns {{ model: VectorModel, history: HistoryManager, joiner: PathJoiner }} 組み合わせた実物
 */
function setupReal(items, selectedIds) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    return { model, history, joiner };
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
 * 図形のidからアイテムを探す（入れ子の中も探す）。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {string} id 図形のid
 * @returns {Object|null} 図形のアイテム。無ければnull
 */
function findShapeItem(items, id) {
    for (const item of items) {
        if (item.kind === 'group') {
            const found = findShapeItem(item.children, id);
            if (found !== null) return found;
        } else if (item.shape.id === id) {
            return item;
        }
    }
    return null;
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

test('結合（2本）: 奥の線（基準）の名前・表示・ロックを引き継ぎ新しいidになり、同じフォルダの同じ位置に入る。除かれた側の名前は消える', () => {
    const { model, history, joiner } = setupReal([
        groupItem('group-1', '甲組', false, true, [
            shapeItem(makeLine('shape-1', 0, 10), 'A線', false, true),
            shapeItem(makeLine('shape-2', 20, 30), 'B線', true, false)
        ]),
        shapeItem(makeLine('shape-3', 40, 50), 'C線', true, true)
    ], ['shape-1', 'shape-2']);
    const before = json(model);

    assert.equal(joiner.join(), true);
    const result = outline(model.getItems());
    const newId = result[0].children[0].id;
    assert.match(newId, /^shape-\d+$/);
    assert.notEqual(newId, 'shape-1');
    assert.notEqual(newId, 'shape-2');
    assert.deepEqual(result, [
        {
            id: 'group-1', name: '甲組', visible: false, locked: true, children: [
                { id: newId, name: 'A線', visible: false, locked: true }
            ]
        },
        { id: 'shape-3', name: 'C線', visible: true, locked: true }
    ]);
    assert.equal(findShapeItem(model.getItems(), newId).shape.type, 'path');
    assert.equal(findShapeItem(model.getItems(), 'shape-2'), null);
    assert.equal(json(model).includes('B線'), false);
    assertUndoRedo(model, history, before, json(model));
});

test('結合（閉じる）: 元のidのまま名前・表示・ロック・フォルダが保たれ、閉じたパスになる', () => {
    const { model, history, joiner } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makePath('shape-1'), 'P名', false, true)
        ]),
        shapeItem(makeLine('shape-2', 40, 50), '他', true, false)
    ], ['shape-1']);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(joiner.join(), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(findShapeItem(model.getItems(), 'shape-1').shape.toJSON().closed, true);
    assertUndoRedo(model, history, before, json(model));
});

test('結合（2本）: 直線「直線 2」を基準にした結合がパスになっても名前は「直線 2」のまま', () => {
    const { model, history, joiner } = setupReal([
        shapeItem(makeLine('shape-1', 0, 10), '直線 2', true, false),
        shapeItem(makeLine('shape-2', 20, 30), '直線 1', true, false)
    ], ['shape-1', 'shape-2']);
    const before = json(model);

    assert.equal(joiner.join(), true);
    const result = outline(model.getItems());
    assert.equal(result.length, 1);
    assert.equal(result[0].name, '直線 2');
    assert.equal(findShapeItem(model.getItems(), result[0].id).shape.type, 'path');
    assertUndoRedo(model, history, before, json(model));
});

test('結合（2本）: 手前の線が基準側でも、重なり順で奥の線の名前等になる（選択の順に依らない）', () => {
    const { model, joiner } = setupReal([
        shapeItem(makeLine('shape-1', 0, 10), '奥', false, true),
        shapeItem(makeLine('shape-2', 20, 30), '手前', true, false)
    ], ['shape-2', 'shape-1']);

    assert.equal(joiner.join(), true);
    const result = outline(model.getItems());
    assert.equal(result.length, 1);
    assert.equal(result[0].name, '奥');
    assert.equal(result[0].visible, false);
    assert.equal(result[0].locked, true);
});

test('結合（2本）: 除かれた側が別のフォルダにあっても壊れない（両方のフォルダが残り、除かれた側の入っていたフォルダは空になる）', () => {
    const { model, history, joiner } = setupReal([
        groupItem('group-1', '甲組', false, true, [
            shapeItem(makeLine('shape-1', 0, 10), 'A線', false, true)
        ]),
        groupItem('group-2', '乙組', true, false, [
            shapeItem(makeLine('shape-2', 20, 30), 'B線', true, false)
        ])
    ], ['shape-1', 'shape-2']);
    const before = json(model);

    assert.equal(joiner.join(), true);
    const result = outline(model.getItems());
    const newId = result[0].children[0].id;
    assert.deepEqual(result, [
        { id: 'group-1', name: '甲組', visible: false, locked: true, children: [{ id: newId, name: 'A線', visible: false, locked: true }] },
        { id: 'group-2', name: '乙組', visible: true, locked: false, children: [] }
    ]);
    assertUndoRedo(model, history, before, json(model));
});
