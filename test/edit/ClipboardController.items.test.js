/**
 * 責務: ClipboardControllerのコピー・切り取り・貼り付け・複製が、名前・表示・ロックを元のまま保ち、フォルダ内の図形を外側の末尾へ平らに入れることを検証する。
 * 実物のVectorModel・ShapeInserter・SnapshotAdapter・HistoryManager・ClipboardControllerを組み合わせる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
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
 * 実物を組み合わせる。フォルダ内に図形A・B、外に図形Cを置く。切り取りの削除は、選択集合をmodel.deleteShapesで消す関数にする。
 * @returns {{ model: VectorModel, history: HistoryManager, clipboard: ClipboardController }} 組み合わせた実物
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes([
        {
            kind: 'group', id: 'group-1', name: '親', visible: true, locked: false, children: [
                { kind: 'shape', shape: makeRect('A', 0), name: '甲', visible: false, locked: true },
                { kind: 'shape', shape: makeRect('B', 20), name: '乙', visible: true, locked: false }
            ]
        },
        { kind: 'shape', shape: makeRect('C', 40), name: '丙', visible: true, locked: true }
    ]);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    const deleteSelection = () => {
        history.beginEdit();
        model.deleteShapes(model.getSelectedIds());
        return history.commitEdit();
    };
    const clipboard = new ClipboardController({ model, inserter, deleteSelection });
    return { model, history, clipboard };
}

/**
 * 外側の並びの指定位置以降のアイテムの種類・名前・表示・ロックを返す。
 * @param {VectorModel} model モデル
 * @param {number} from 外側の何番目から
 * @returns {Array<Object>} 属性の配列
 */
function tailAttrs(model, from) {
    return model.getItems().slice(from).map((i) => ({ kind: i.kind, name: i.name, visible: i.visible, locked: i.locked }));
}

test('copy→paste: フォルダ内の図形の名前・表示・ロックが元と同じで、外側の末尾へ平らに入る', () => {
    const { model, clipboard } = setup();
    model.setSelection(['A', 'B']);
    assert.equal(clipboard.copy(), true);
    assert.equal(clipboard.paste(), true);
    const items = model.getItems();
    assert.equal(items.length, 4);
    assert.equal(items[0].kind, 'group');
    assert.equal(items[0].children.length, 2);
    assert.deepEqual(tailAttrs(model, 2), [
        { kind: 'shape', name: '甲', visible: false, locked: true },
        { kind: 'shape', name: '乙', visible: true, locked: false }
    ]);
    assert.equal(model.getShapes().length, 5);
});

test('copy: フォルダは写さない（選んだ図形だけ）', () => {
    const { model, clipboard } = setup();
    model.setSelection(['A']);
    clipboard.copy();
    clipboard.pasteInPlace();
    assert.equal(model.getItems().filter((i) => i.kind === 'group').length, 1);
});

test('duplicate: 名前・表示・ロックが元と同じで、描画順で外側の末尾へ入る', () => {
    const { model, clipboard } = setup();
    model.setSelection(['C', 'A']);
    assert.equal(clipboard.duplicate(), true);
    assert.deepEqual(tailAttrs(model, 2), [
        { kind: 'shape', name: '甲', visible: false, locked: true },
        { kind: 'shape', name: '丙', visible: true, locked: true }
    ]);
});

test('pasteInPlace: 同じ位置・同じ名前で入り、undoで元に戻る', () => {
    const { model, history, clipboard } = setup();
    model.setSelection(['C']);
    clipboard.copy();
    assert.equal(clipboard.pasteInPlace(), true);
    const items = model.getItems();
    assert.equal(items[2].name, '丙');
    assert.equal(items[2].locked, true);
    assert.deepEqual(items[2].shape.toJSON().points, items[1].shape.toJSON().points);
    history.undo();
    assert.equal(model.getItems().length, 2);
});

test('duplicateInPlaceWithinEdit（Alt+ドラッグの複製）: 名前・表示・ロックが元と同じで、編集操作の確定で1件として記録される', () => {
    const { model, history, clipboard } = setup();
    model.setSelection(['B']);
    history.beginEdit();
    assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
    assert.equal(history.canUndo(), false);
    history.commitEdit();
    assert.deepEqual(tailAttrs(model, 2), [{ kind: 'shape', name: '乙', visible: true, locked: false }]);
    assert.equal(history.canUndo(), true);
});

test('cut→paste: 元は消え、貼り付けた図形の名前・表示・ロックが元と同じ（切り取り直後は元の位置）', () => {
    const { model, clipboard } = setup();
    model.setSelection(['B']);
    assert.equal(clipboard.cut(), true);
    assert.equal(model.getShapes().length, 2);
    assert.equal(clipboard.paste(), true);
    const last = model.getItems()[2];
    assert.equal(last.name, '乙');
    assert.equal(last.visible, true);
    assert.equal(last.locked, false);
    assert.equal(last.shape.toJSON().points[0].x, 20);
});

test('選択が空のコピー・複製は何もしない', () => {
    const { model, history, clipboard } = setup();
    assert.equal(clipboard.copy(), false);
    assert.equal(clipboard.duplicate(), false);
    assert.equal(clipboard.isEmpty(), true);
    assert.equal(model.getItems().length, 2);
    assert.equal(history.canUndo(), false);
});
