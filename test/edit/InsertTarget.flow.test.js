/**
 * 責務: 描き込む先（VectorModelのinsertTargetId）の通しの流れを、実物のVectorModel・SnapshotAdapter・HistoryManager・ShapeInserter・ClipboardController・
 * PathJoiner・PathCornerEditor・ShapeOrderEditor・CanvasLibraryを組み合わせ、公開APIだけを通して検証する（描く・取り消し・貼り付け・結合・並べ替え・キャンバスの切り替え・保存しないこと）。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { PathCornerEditor } from '../../js/edit/PathCornerEditor.js';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { CanvasLibrary } from '../../js/edit/CanvasLibrary.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';
import { Path, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';

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
 * idを直接代入した水平の直線（y=0）を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点x
 * @param {number} x2 終点x
 * @returns {Line} 直線
 */
function makeLine(id, x1, x2) {
    const line = new Line(x1, 0, x2, 0, '#112233', 2);
    line.id = id;
    return line;
}

/**
 * idを直接代入した開いたパス（頂点3つ）を作る。
 * @param {string} id 代入するid
 * @returns {Path} パス
 */
function makePath(id) {
    const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], false, '#445566', 3, null, SEGMENT_KIND_SMOOTH);
    path.id = id;
    return path;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape) {
    return { kind: 'shape', shape, name: shape.id, visible: true, locked: false };
}

/**
 * 矩形a・b・c・d（この順）のアイテムを作る。
 * @returns {Array<Object>} アイテムの配列
 */
function rectItems() {
    return ['a', 'b', 'c', 'd'].map((id) => shapeItem(makeRect(id)));
}

/**
 * 図形のidを描画順で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} idの配列
 */
function ids(model) {
    return model.getShapes().map((shape) => shape.id);
}

/**
 * 実物を組み合わせる。
 * @param {Array<Object>} [items] モデルへ入れるアイテム（省くと矩形a〜d）
 * @param {Object} [options] 設定
 * @param {{ value: boolean }} [options.restore] 取り消し・やり直しで選択を復元するかの入れ物
 * @param {{ mode: string }} [options.modeState] 現在の操作モードの入れ物
 * @returns {Object} 組み合わせた実物
 */
function setup(items = rectItems(), { restore = { value: true }, modeState = { mode: OperationMode.SELECT } } = {}) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => restore.value });
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
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    const corner = new PathCornerEditor({ model, editRecorder: history, getMode: () => modeState.mode });
    const orderEditor = new ShapeOrderEditor({ model, editRecorder: history });
    return { model, history, clipboard, joiner, corner, orderEditor, deleteSelection, restore, modeState };
}

/**
 * 矩形を1つ描いて確定する（InputTrackerの作成の確定と同じ`beginEdit` → `commitDraft({ atInsertTarget: true })` → `commitEdit`）。
 * @param {VectorModel} model モデル
 * @param {HistoryManager} history 履歴
 * @returns {string} 描いた図形のid
 */
function drawRect(model, history) {
    model.startDraft(0, 0, 'rect');
    model.updateDraft(5, 5);
    history.beginEdit();
    model.commitDraft({ atInsertTarget: true });
    history.commitEdit();
    return model.getInsertTargetId();
}

test('描く → 取り消す → 描き直す: 同じ場所へ入る。やり直しでは描き込む先が動かない', () => {
    const { model, history } = setup();
    model.setSelection(['b']);
    model.clearSelection();
    assert.equal(model.getInsertTargetId(), 'b');

    const first = drawRect(model, history);
    assert.deepEqual(ids(model), ['a', 'b', first, 'c', 'd']);
    assert.equal(model.getInsertTargetId(), first);

    assert.equal(history.undo(), true);
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.equal(model.getInsertTargetId(), 'b');

    const second = drawRect(model, history);
    assert.deepEqual(ids(model), ['a', 'b', second, 'c', 'd']);
    assert.equal(history.undo(), true);
    assert.equal(model.getInsertTargetId(), 'b');

    assert.equal(history.redo(), true);
    assert.deepEqual(ids(model), ['a', 'b', second, 'c', 'd']);
    assert.equal(model.getInsertTargetId(), 'b', 'やり直しでは描いた図形に動かない');
});

test('選択が戻る取り消し: 描き込む先は選ばれている一番上の行（shouldRestoreSelectionの真偽の両方）', () => {
    const restoreOn = setup(rectItems(), { restore: { value: true } });
    restoreOn.model.setSelection(['a', 'c']);
    assert.equal(restoreOn.model.getInsertTargetId(), 'c');
    assert.equal(restoreOn.deleteSelection(), true);
    assert.deepEqual(ids(restoreOn.model), ['b', 'd']);
    assert.equal(restoreOn.model.getInsertTargetId(), 'b');
    assert.equal(restoreOn.history.undo(), true);
    assert.deepEqual(restoreOn.model.getSelectedIds().sort(), ['a', 'c']);
    assert.equal(restoreOn.model.getInsertTargetId(), 'c', '選択が戻れば一番上の行');

    const restoreOff = setup(rectItems(), { restore: { value: false } });
    restoreOff.model.setSelection(['a', 'c']);
    assert.equal(restoreOff.deleteSelection(), true);
    assert.equal(restoreOff.model.getInsertTargetId(), 'b');
    assert.equal(restoreOff.history.undo(), true);
    assert.deepEqual(restoreOff.model.getSelectedIds(), []);
    assert.equal(restoreOff.model.getInsertTargetId(), 'b', '選択が戻らなければ描き込む先は動かない');
});

test('削除・切り取り → 貼り付け: 下に残った行のすぐ上へ戻る', () => {
    const { model, history, clipboard, deleteSelection } = setup();
    model.setSelection(['c']);
    clipboard.copy();
    assert.equal(deleteSelection(), true);
    assert.deepEqual(ids(model), ['a', 'b', 'd']);
    assert.equal(model.getInsertTargetId(), 'b');
    assert.equal(clipboard.paste(), true);
    assert.deepEqual(model.getItems().map((item) => item.name), ['a', 'b', 'c', 'd']);
    assert.equal(model.getShapes()[2].id, model.getInsertTargetId());

    model.setSelection(['b']);
    assert.equal(clipboard.cut(), true);
    assert.equal(model.getInsertTargetId(), 'a');
    assert.equal(clipboard.paste(), true);
    assert.deepEqual(model.getItems().map((item) => item.name), ['a', 'b', 'c', 'd']);
    assert.equal(history.undo(), true);
    assert.equal(model.getShapes().length, 3);
});

test('結合で除かれたとき: 描き込む先は結合の結果の図形になる（取り消しで選択が戻れば元の一番上の行）', () => {
    const { model, history, joiner } = setup([
        shapeItem(makeLine('l1', 0, 10)),
        shapeItem(makeLine('l2', 10, 20)),
        shapeItem(makeRect('z'))
    ]);
    model.setSelection(['l1', 'l2']);
    assert.equal(model.getInsertTargetId(), 'l2');

    assert.equal(joiner.join(), true);
    assert.equal(model.getShapes().length, 2);
    const joinedId = model.getShapes()[0].id;
    assert.notEqual(joinedId, 'l2');
    assert.equal(model.getInsertTargetId(), joinedId);

    assert.equal(history.undo(), true);
    assert.deepEqual(ids(model), ['l1', 'l2', 'z']);
    assert.equal(model.getInsertTargetId(), 'l2');
});

test('角の切り替えでは描き込む先が変わらない', () => {
    const modeState = { mode: OperationMode.VERTEX };
    const { model, corner } = setup([shapeItem(makeRect('r')), shapeItem(makePath('p'))], { modeState });
    model.setSelection(['p']);
    model.setSelectedVertices([{ shapeId: 'p', handle: 'vertex-1' }]);
    assert.equal(model.getInsertTargetId(), 'p');
    assert.equal(corner.toggle(), true);
    assert.equal(model.getInsertTargetId(), 'p');
    assert.deepEqual(ids(model), ['r', 'p']);
});

test('並べ替え: 記録は1件・取り消し1回で戻り、描き込む先は行と一緒に動く', () => {
    const { model, history, orderEditor } = setup();
    assert.equal(model.setInsertTarget('b'), true);
    assert.equal(orderEditor.moveTo(['a'], { kind: 'below', id: 'b' }), false);
    assert.equal(history.canUndo(), false, '同じ並びでは記録しない');

    assert.equal(orderEditor.moveTo(['d'], { kind: 'below', id: 'a' }), true);
    assert.deepEqual(ids(model), ['d', 'a', 'b', 'c']);
    assert.equal(model.getInsertTargetId(), 'b');
    assert.equal(history.canUndo(), true);

    assert.equal(history.undo(), true);
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.equal(model.getInsertTargetId(), 'b');
    assert.equal(history.canUndo(), false, '取り消し1回で元に戻る（記録は1件）');
    assert.equal(history.redo(), true);
    assert.deepEqual(ids(model), ['d', 'a', 'b', 'c']);
    assert.equal(model.getInsertTargetId(), 'b');
});

test('ツールの切り替え（clearSelection）では残り、利用者が外す操作（setSelectionByUser([])）で無しになる', () => {
    const { model } = setup();
    model.setSelection(['c']);
    model.clearSelection();
    assert.equal(model.getInsertTargetId(), 'c');
    assert.equal(model.setSelectionByUser([]), true);
    assert.equal(model.getInsertTargetId(), null);
    assert.equal(model.setSelectionByUser([]), false);
});

test('キャンバスの切り替え・新規作成では、同じidの図形があっても無しになる', async (t) => {
    t.mock.method(console, 'warn', () => {});
    const records = new Map();
    let lastOpenedId = null;
    const storage = {
        open: () => Promise.resolve(),
        getAllRecords: () => Promise.resolve([...records.values()]),
        getLastOpenedId: () => Promise.resolve(lastOpenedId),
        getRecord: (id) => Promise.resolve(records.get(id)),
        putRecord: (record) => {
            records.set(record.id, JSON.parse(JSON.stringify(record)));
            return Promise.resolve();
        },
        renameRecord: () => Promise.resolve(),
        deleteRecord: (id) => {
            records.delete(id);
            return Promise.resolve();
        },
        setLastOpenedId: (id) => {
            lastOpenedId = id;
            return Promise.resolve();
        }
    };
    const model = new VectorModel();
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const library = new CanvasLibrary({
        storage,
        model,
        historyManager: history,
        prepareSwitch: () => {},
        resetView: () => {},
        confirmOpenUnsaved: () => true
    });
    await library.start();

    assert.equal(await library.createCanvasFromShapes('A', rectItems()), true);
    const idA = library.getState().openCanvasId;
    assert.equal(model.getInsertTargetId(), null);
    assert.equal(model.setInsertTarget('b'), true);

    assert.equal(await library.createCanvasFromShapes('B', rectItems()), true);
    assert.equal(model.getInsertTargetId(), null, '開く（ファイル）で無しになる（同じidの図形があっても）');
    assert.equal(model.setInsertTarget('c'), true);

    assert.equal(await library.openCanvas(idA), true);
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.equal(model.getInsertTargetId(), null, '切り替えで無しになる（同じidの図形があっても）');

    assert.equal(model.setInsertTarget('d'), true);
    assert.equal(await library.createCanvas(), true);
    assert.equal(model.getInsertTargetId(), null, '新規作成で無しになる');
    await library.flushPendingSave();
});

test('描き込む先を変えても、capture()・作業データ・スプライトのテキスト・履歴は変わらず、記録もされない', () => {
    const model = new VectorModel();
    model.replaceAllShapes(rectItems());
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const orderEditor = new ShapeOrderEditor({ model, editRecorder: history });
    assert.equal(orderEditor.moveTo(['a'], { kind: 'above', id: 'b' }), true);
    let historyNotifications = 0;
    history.onChange(() => { historyNotifications += 1; });

    const captureBefore = JSON.stringify(adapter.capture());
    const documentBefore = JSON.stringify(DocumentSerializer.serialize(model.getItems()));
    const spriteBefore = SpriteSerializer.stringify(SpriteSerializer.serialize(model.getItems()));

    assert.equal(model.setInsertTarget('c'), true);
    assert.equal(model.setInsertTarget('a'), true);
    assert.equal(model.getInsertTargetId(), 'a');
    assert.equal(model.setInsertTarget('nothing'), false);

    assert.equal(JSON.stringify(adapter.capture()), captureBefore);
    assert.equal(JSON.stringify(DocumentSerializer.serialize(model.getItems())), documentBefore);
    assert.equal(SpriteSerializer.stringify(SpriteSerializer.serialize(model.getItems())), spriteBefore);
    assert.equal(historyNotifications, 0, '履歴へ記録も通知もされない');
    assert.equal(history.canRedo(), false);
    assert.equal(history.undo(), true);
    assert.equal(history.canUndo(), false, '履歴は並べ替えの1件のまま');
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
});
