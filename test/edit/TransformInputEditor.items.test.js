/**
 * 責務: TransformInputEditorと実物のVectorModel・ShapeExtentReader・SnapshotAdapter・HistoryManagerを組み合わせ、幅/高さ/角度の数値入力と反転で名前・表示・ロック・フォルダが保たれることを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { TransformInputEditor } from '../../js/edit/TransformInputEditor.js';
import { ShapeExtentReader } from '../../js/edit/ShapeExtentReader.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { SIZE_AXIS, FLIP_AXIS } from '../../js/edit/TransformInputRules.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @param {number} x1 左上のX
 * @param {number} y1 左上のY
 * @param {number} x2 右下のX
 * @param {number} y2 右下のY
 * @returns {Rect} 矩形
 */
function makeRect(id, x1, y1, x2, y2) {
    const rect = new Rect(x1, y1, x2, y2, '#112233', 4, null);
    rect.id = id;
    return rect;
}

/**
 * idを直接代入した線を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点のX
 * @param {number} y1 始点のY
 * @param {number} x2 終点のX
 * @param {number} y2 終点のY
 * @returns {Line} 線
 */
function makeLine(id, x1, y1, x2, y2) {
    const line = new Line(x1, y1, x2, y2, '#112233', 4, null);
    line.id = id;
    return line;
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
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・TransformInputEditorを組み合わせる（選択モード・基準点は中心）。
 * @param {Array<Object>} items モデルへ入れるアイテム
 * @param {Array<string>} selectedIds 選択する図形のid
 * @returns {{ model: VectorModel, history: HistoryManager, editor: TransformInputEditor }} 組み合わせた実物
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
    const editor = new TransformInputEditor({
        model,
        getMode: () => OperationMode.SELECT,
        shapeExtentReader: new ShapeExtentReader({ model }),
        editRecorder: history
    });
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
 * フォルダの中の矩形（名前・表示あり・ロックなし）と、フォルダの外の線からなる入れ子を作る。
 * @returns {Array<Object>} アイテムの入れ子
 */
function nestedItems() {
    return [
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makeRect('shape-1', 20, 30, 60, 70), '矩形名', true, false)
        ]),
        shapeItem(makeLine('shape-2', 100, 100, 160, 130), '線名', true, false)
    ];
}

test('幅の数値入力: 名前・表示・ロック・フォルダ・idが保たれ、形だけが変わる', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1']);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '80'), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.notDeepEqual(model.getShapes()[0].toJSON().points, [{ x: 20, y: 30 }, { x: 60, y: 70 }]);
    assertUndoRedo(model, history, before, json(model));
});

test('高さの数値入力: 名前・表示・ロック・フォルダ・idが保たれ、形だけが変わる', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1']);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.setSize(SIZE_AXIS.HEIGHT, '10'), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assertUndoRedo(model, history, before, json(model));
});

test('角度の数値入力: 名前・表示・ロック・フォルダ・idが保たれ、形だけが変わる', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1']);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.rotateBy('90'), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assertUndoRedo(model, history, before, json(model));
});

test('反転: フォルダの中の矩形と外の線を一緒に反転しても、それぞれの名前・表示・ロック・フォルダ・idが保たれ記録は1件', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-1', 'shape-2']);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.flip(FLIP_AXIS.HORIZONTAL), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assertUndoRedo(model, history, before, json(model));
});

test('反転（縦）: 外の線でも名前・表示・ロックが保たれる', () => {
    const { model, history, editor } = setupReal(nestedItems(), ['shape-2']);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    assert.equal(editor.flip(FLIP_AXIS.VERTICAL), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assertUndoRedo(model, history, before, json(model));
});
