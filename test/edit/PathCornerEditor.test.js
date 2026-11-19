/**
 * 責務: PathCornerEditor（角の切り替えの手順・表示内容の照会・履歴の単位）の振る舞いを検証する。
 * 実物のVectorModel・図形クラス・SnapshotAdapter・HistoryManagerと、呼び出しを記録する偽の記録先を扱う。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PathCornerEditor } from '../../js/edit/PathCornerEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 全区間が曲線の開いたパス（5点）を作る。
 * @param {string} id - 図形のid
 * @param {string|string[]} [kinds] - 区間の種類
 * @returns {Path} パス
 */
function makePath(id, kinds = SEGMENT_KIND_SMOOTH) {
    const points = Array.from({ length: 5 }, (_, i) => ({ x: i * 10, y: (i % 2) * 7 }));
    const path = new Path(points, false, '#123456', 3, '#abcdef', kinds);
    path.id = id;
    return path;
}

/**
 * 偽の記録先と、ローカルな呼び出し記録を作る。
 * @param {VectorModel} model - モデル
 * @param {{ mode: string }} state - 現在の操作モードの入れ物
 * @returns {{ editor: PathCornerEditor, calls: string[], notifications: () => number }} 手順と記録
 */
function setupFake(model, state) {
    const calls = [];
    let notified = 0;
    model.onChange(() => { notified += 1; });
    const editRecorder = {
        beginEdit: () => calls.push('beginEdit'),
        commitEdit: () => calls.push('commitEdit')
    };
    const editor = new PathCornerEditor({ model, editRecorder, getMode: () => state.mode });
    return { editor, calls, notifications: () => notified };
}

/**
 * モデルに図形を入れ、選択と頂点の選択を当てる。
 * @param {Object[]} shapes - 図形
 * @param {Array<{shapeId: string, handle: string}>} vertices - 頂点の選択
 * @returns {VectorModel} モデル
 */
function setupModel(shapes, vertices) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    model.setSelection(shapes.map((s) => s.id));
    model.setSelectedVertices(vertices);
    return model;
}

/**
 * 図形のtoJSON()の値の配列を返す。
 * @param {VectorModel} model - モデル
 * @returns {Object[]} 作業データ
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

describe('PathCornerEditor 対象の集め方と getView', () => {
    it('頂点の選択モード以外・点なしでは押せない・チェックなし', () => {
        const model = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-2' }]);
        const state = { mode: OperationMode.SELECT };
        const { editor } = setupFake(model, state);
        assert.deepEqual(editor.getView(), { enabled: false, checked: false, mixed: false });
        const empty = setupModel([makePath('a')], []);
        const { editor: editor2 } = setupFake(empty, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor2.getView(), { enabled: false, checked: false, mixed: false });
    });

    it('なめらかな点を選ぶと押せる・チェックなし、角の点だけならチェックあり', () => {
        const smooth = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-2' }]);
        const { editor } = setupFake(smooth, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor.getView(), { enabled: true, checked: false, mixed: false });
        assert.equal(editor.toggle(), true);
        assert.deepEqual(editor.getView(), { enabled: true, checked: true, mixed: false });
    });

    it('角となめらかが混ざると mixed', () => {
        const path = new Path(makePath('a').points, false, '#123456', 3, '#abcdef', SEGMENT_KIND_SMOOTH, [false, false, true, false, false]);
        path.id = 'a';
        const model = setupModel([path], [{ shapeId: 'a', handle: 'vertex-1' }, { shapeId: 'a', handle: 'vertex-2' }]);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor.getView(), { enabled: true, checked: false, mixed: true });
    });

    it('図形が無い組・番号が得られない組は飛ばす', () => {
        const model = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-2' }]);
        // 選択集合に含まれるが図形が無い組と、頂点のハンドル名でない組を、偽のmodelで再現する
        const fakeModel = {
            getSelectedIds: () => ['a', 'ghost'],
            getSelectedVertices: () => [
                { shapeId: 'ghost', handle: 'vertex-1' },
                { shapeId: 'a', handle: 'move' },
                { shapeId: 'a', handle: 'vertex-2' }
            ],
            getShapes: () => model.getShapes()
        };
        const editor = new PathCornerEditor({ model: fakeModel, editRecorder: {}, getMode: () => OperationMode.VERTEX });
        assert.deepEqual(editor.getView(), { enabled: true, checked: false, mixed: false });
    });

    it('getView はモデル・履歴を変えない', () => {
        const model = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-2' }]);
        const before = dump(model);
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        editor.getView();
        assert.deepEqual(dump(model), before);
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
    });
});

describe('PathCornerEditor toggle', () => {
    it('角になり beginEdit → commitEdit が1組、もう一度でなめらかに戻る', () => {
        const model = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-2' }]);
        const before = dump(model);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.toggle(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.deepEqual(model.getShapes()[0].toJSON().corners, [false, false, true, false, false]);
        assert.equal(editor.toggle(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit', 'beginEdit', 'commitEdit']);
        assert.deepEqual(dump(model), before);
    });

    it('複数の図形の点を選んでも beginEdit/commitEdit は1組で、両方の図形が変わる', () => {
        const model = setupModel(
            [makePath('a'), makePath('b')],
            [{ shapeId: 'a', handle: 'vertex-1' }, { shapeId: 'b', handle: 'vertex-3' }]
        );
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        const base = notifications();
        assert.equal(editor.toggle(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.deepEqual(model.getShapes()[0].toJSON().corners, [false, true, false, false, false]);
        assert.deepEqual(model.getShapes()[1].toJSON().corners, [false, false, false, true, false]);
        assert.equal(notifications() - base, 2);
    });

    it('操作できる点が無いとき・頂点の選択モード以外は false で記録先・通知に触れない', () => {
        const line = new Line(0, 0, 10, 10, '#000000', 2);
        line.id = 'l';
        const rect = new Rect(0, 0, 10, 10, '#112233', 2, null);
        rect.id = 'r';
        const edge = setupModel([makePath('a'), line, rect], [
            { shapeId: 'a', handle: 'vertex-0' },
            { shapeId: 'l', handle: 'vertex-0' }
        ]);
        const first = setupFake(edge, { mode: OperationMode.VERTEX });
        const before = dump(edge);
        const base = first.notifications();
        assert.equal(first.editor.toggle(), false);
        assert.deepEqual(first.calls, []);
        assert.equal(first.notifications(), base);
        assert.deepEqual(dump(edge), before);

        const other = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-2' }]);
        const second = setupFake(other, { mode: OperationMode.SELECT });
        assert.equal(second.editor.toggle(), false);
        assert.deepEqual(second.calls, []);
        assert.equal(second.notifications(), 0);
    });

    it('直線の角の点は変わらず、操作できる点だけが変わる', () => {
        const path = makePath('a', [SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_SMOOTH]);
        const model = setupModel([path], [
            { shapeId: 'a', handle: 'vertex-1' },
            { shapeId: 'a', handle: 'vertex-2' }
        ]);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.toggle(), true);
        assert.deepEqual(model.getShapes()[0].toJSON().corners, [false, false, true, false, false]);
    });

    it('図形の選択・頂点の選択・id・重なり順・スタイル・頂点の位置が変わらない', () => {
        const model = setupModel(
            [makePath('a'), makePath('b')],
            [{ shapeId: 'b', handle: 'vertex-2' }]
        );
        const before = dump(model);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        editor.toggle();
        assert.deepEqual(model.getSelectedIds(), ['a', 'b']);
        assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'b', handle: 'vertex-2' }]);
        assert.deepEqual(model.getShapes().map((s) => s.id), ['a', 'b']);
        const after = dump(model);
        assert.deepEqual(after[0], before[0]);
        const { corners, ...rest } = after[1];
        assert.deepEqual(corners, [false, false, true, false, false]);
        assert.deepEqual(rest, before[1]);
    });
});

describe('PathCornerEditor と HistoryManager・SnapshotAdapter（実物）', () => {
    it('取り消し1回で戻り、やり直しで切り替え後に戻る（複数の図形でも1件）', () => {
        const model = setupModel(
            [makePath('a'), makePath('b')],
            [{ shapeId: 'a', handle: 'vertex-1' }, { shapeId: 'b', handle: 'vertex-3' }]
        );
        const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
        const history = new HistoryManager({
            capture: () => adapter.capture(),
            restore: (snapshot) => adapter.restore(snapshot)
        });
        const editor = new PathCornerEditor({ model, editRecorder: history, getMode: () => OperationMode.VERTEX });
        const before = dump(model);
        assert.equal(editor.toggle(), true);
        const after = dump(model);
        assert.notDeepEqual(after, before);
        history.undo();
        assert.deepEqual(dump(model), before);
        history.redo();
        assert.deepEqual(dump(model), after);
        history.undo();
        assert.deepEqual(dump(model), before);
        assert.equal(history.canUndo(), false);
    });

    it('変わらないときは履歴が増えない', () => {
        const model = setupModel([makePath('a')], [{ shapeId: 'a', handle: 'vertex-0' }]);
        const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
        const history = new HistoryManager({
            capture: () => adapter.capture(),
            restore: (snapshot) => adapter.restore(snapshot)
        });
        const editor = new PathCornerEditor({ model, editRecorder: history, getMode: () => OperationMode.VERTEX });
        assert.equal(editor.toggle(), false);
        assert.equal(history.canUndo(), false);
    });
});
