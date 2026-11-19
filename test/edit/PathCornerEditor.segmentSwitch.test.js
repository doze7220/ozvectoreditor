/**
 * 責務: PathCornerEditor の区間の切り替え（押せるかの照会・直線に・曲線に・選んでいた点の付け替え・履歴の単位）の振る舞いを検証する。
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
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 頂点4つの開いたパスを作る。
 * @param {string} id - 図形のid
 * @param {string|string[]} [kinds] - 区間の種類
 * @returns {Path} パス
 */
function makePath(id, kinds = SEGMENT_KIND_LINE) {
    const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 60, y: 30 }, { x: 90, y: 30 }];
    const path = new Path(points, false, '#123456', 3, '#abcdef', kinds);
    path.id = id;
    return path;
}

/**
 * 閉じた直線のパス（正方形）を作る。
 * @param {string} id - 図形のid
 * @returns {Path} パス
 */
function makeClosedSquare(id) {
    const points = [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }, { x: 0, y: 30 }];
    const path = new Path(points, true, '#123456', 3, '#abcdef', SEGMENT_KIND_LINE);
    path.id = id;
    return path;
}

/**
 * 直線を作る。
 * @param {string} id - 図形のid
 * @returns {Line} 直線
 */
function makeLine(id) {
    const line = new Line(0, 0, 60, 30, '#111111', 4, null);
    line.id = id;
    return line;
}

/**
 * 今の曲線を作る（制御点は公開のsetVertexで置く）。
 * @param {string} id - 図形のid
 * @returns {Curve} 曲線
 */
function makeCurve(id) {
    const curve = new Curve(0, 0, 60, 0, '#222222', 5, null);
    curve.setVertex(1, 30, 20);
    curve.id = id;
    return curve;
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
        commitEdit: (...args) => calls.push(args.length === 0 ? 'commitEdit' : 'commitEdit+args')
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

/**
 * 頂点のハンドル名を頂点の選択の組へ変換する。
 * @param {string} shapeId - 図形のid
 * @param {string[]} handles - ハンドル名
 * @returns {Array<{shapeId: string, handle: string}>} 頂点の選択
 */
function vs(shapeId, handles) {
    return handles.map((handle) => ({ shapeId, handle }));
}

describe('PathCornerEditor.getSegmentSwitchAvailability', () => {
    it('頂点の選択モード以外・点なしでは両方押せない', () => {
        const model = setupModel([makePath('a')], vs('a', ['vertex-0', 'vertex-1']));
        const { editor } = setupFake(model, { mode: OperationMode.SELECT });
        assert.deepEqual(editor.getSegmentSwitchAvailability(), { toLine: false, toCurve: false });
        const empty = setupModel([makePath('a')], []);
        const { editor: editor2 } = setupFake(empty, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor2.getSegmentSwitchAvailability(), { toLine: false, toCurve: false });
    });

    it('隣り合う2点の区間の種類に応じて決まる', () => {
        const straight = setupModel([makePath('a')], vs('a', ['vertex-0', 'vertex-1']));
        const { editor } = setupFake(straight, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor.getSegmentSwitchAvailability(), { toLine: false, toCurve: true });
        const curved = setupModel([makePath('a', SEGMENT_KIND_SMOOTH)], vs('a', ['vertex-0', 'vertex-1']));
        const { editor: editor2 } = setupFake(curved, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor2.getSegmentSwitchAvailability(), { toLine: true, toCurve: false });
    });

    it('並んでいない点は両端が選ばれた区間だけで決まる・1点だけは押せない', () => {
        const kinds = [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_LINE, SEGMENT_KIND_LINE];
        const model = setupModel([makePath('a', kinds)], vs('a', ['vertex-0', 'vertex-1', 'vertex-3']));
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor.getSegmentSwitchAvailability(), { toLine: true, toCurve: false });
        const one = setupModel([makePath('a')], vs('a', ['vertex-1']));
        const { editor: editor2 } = setupFake(one, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor2.getSegmentSwitchAvailability(), { toLine: false, toCurve: false });
    });

    it('照会はモデルと記録先に触れない', () => {
        const model = setupModel([makePath('a')], vs('a', ['vertex-0', 'vertex-1']));
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        const before = dump(model);
        editor.getSegmentSwitchAvailability();
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
        assert.deepEqual(dump(model), before);
    });
});

describe('PathCornerEditor.switchSegmentsToCurve', () => {
    it('点が足され、選んでいた点が選ばれたまま付け替わる（足した点は選ばれない）', () => {
        const rect = new Rect(200, 200, 20, 20, '#000000', 1, null);
        rect.id = 'r';
        const model = setupModel([rect, makePath('a')], vs('a', ['vertex-1', 'vertex-2']));
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        const beforeIds = model.getShapes().map((s) => s.id);
        const beforePoints = model.getShapes()[1].toJSON().points;
        assert.equal(editor.switchSegmentsToCurve(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const path = model.getShapes()[1];
        const json = path.toJSON();
        assert.equal(json.points.length, 5);
        assert.deepEqual(json.points[2], { x: 45, y: 15 });
        // 選んでいた点の位置は変わらない
        assert.deepEqual(json.points[1], beforePoints[1]);
        assert.deepEqual(json.points[3], beforePoints[2]);
        assert.deepEqual(model.getSelectedVertices(), vs('a', ['vertex-1', 'vertex-3']));
        assert.deepEqual(model.getSelectedIds(), ['r', 'a']);
        assert.deepEqual(model.getShapes().map((s) => s.id), beforeIds);
        assert.equal(json.strokeColor, '#123456');
        assert.equal(json.strokeWidth, 3);
        assert.equal(json.fillColor, '#abcdef');
    });

    it('選んだ順を保つ', () => {
        const model = setupModel([makePath('a')], vs('a', ['vertex-2', 'vertex-1']));
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.switchSegmentsToCurve(), true);
        assert.deepEqual(model.getSelectedVertices(), vs('a', ['vertex-3', 'vertex-1']));
    });

    it('単独の直線はパスになり、start・end が vertex-0・vertex-2 になる', () => {
        const model = setupModel([makeLine('l')], vs('l', ['start', 'end']));
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.switchSegmentsToCurve(), true);
        const shape = model.getShapes()[0];
        assert.equal(shape.type, 'path');
        assert.equal(shape.id, 'l');
        assert.equal(shape.toJSON().points.length, 3);
        assert.deepEqual(model.getSelectedVertices(), vs('l', ['vertex-0', 'vertex-2']));
    });

    it('複数の図形の点を選んで切り替えても beginEdit/commitEdit は1組で両方変わる', () => {
        const model = setupModel(
            [makePath('a'), makeClosedSquare('b')],
            [...vs('a', ['vertex-0', 'vertex-1']), ...vs('b', ['vertex-0', 'vertex-1'])]
        );
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.switchSegmentsToCurve(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const [a, b] = dump(model);
        assert.equal(a.points.length, 5);
        assert.equal(b.points.length, 5);
        assert.equal(b.closed, true);
    });

    it('変わらないとき（既に曲線の区間・点が1つ・頂点の選択モード以外）は false で何も触れない', () => {
        const cases = [
            [makePath('a', SEGMENT_KIND_SMOOTH), vs('a', ['vertex-0', 'vertex-1']), OperationMode.VERTEX],
            [makePath('a'), vs('a', ['vertex-1']), OperationMode.VERTEX],
            [makePath('a'), vs('a', ['vertex-0', 'vertex-1']), OperationMode.SELECT]
        ];
        for (const [shape, vertices, mode] of cases) {
            const model = setupModel([shape], vertices);
            const { editor, calls, notifications } = setupFake(model, { mode });
            const before = dump(model);
            assert.equal(editor.switchSegmentsToCurve(), false);
            assert.deepEqual(calls, []);
            assert.equal(notifications(), 0);
            assert.deepEqual(dump(model), before);
        }
    });

    it('通知の回数：番号がずれる＝2回、閉じたパスの終点→始点だけ＝1回', () => {
        const model = setupModel([makePath('a')], vs('a', ['vertex-1', 'vertex-2']));
        const { editor, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        editor.switchSegmentsToCurve();
        assert.equal(notifications(), 2);

        const closed = setupModel([makeClosedSquare('b')], vs('b', ['vertex-3', 'vertex-0']));
        const { editor: editor2, notifications: notifications2 } = setupFake(closed, { mode: OperationMode.VERTEX });
        assert.equal(editor2.switchSegmentsToCurve(), true);
        assert.equal(notifications2(), 1);
        assert.equal(closed.getShapes()[0].toJSON().points.length, 5);
        assert.deepEqual(closed.getSelectedVertices(), vs('b', ['vertex-3', 'vertex-0']));
    });
});

describe('PathCornerEditor.switchSegmentsToLine', () => {
    it('パスの区間を直線にする（通知1回・選択は変わらない）', () => {
        const model = setupModel([makePath('a', SEGMENT_KIND_SMOOTH)], vs('a', ['vertex-1', 'vertex-2']));
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.switchSegmentsToLine(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.equal(notifications(), 1);
        const json = model.getShapes()[0].toJSON();
        assert.deepEqual(json.segments.map((s) => s.kind), [SEGMENT_KIND_SMOOTH, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH]);
        assert.deepEqual(model.getSelectedVertices(), vs('a', ['vertex-1', 'vertex-2']));
    });

    it('今の曲線は直線になり、制御点の選択は外れる', () => {
        const model = setupModel([makeCurve('c')], vs('c', ['start', 'control', 'end']));
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.switchSegmentsToLine(), true);
        const shape = model.getShapes()[0];
        assert.equal(shape.type, 'line');
        assert.equal(shape.id, 'c');
        assert.deepEqual(model.getSelectedVertices(), vs('c', ['start', 'end']));
    });

    it('既に直線の区間だけなら false で何も触れない', () => {
        const model = setupModel([makePath('a')], vs('a', ['vertex-0', 'vertex-1']));
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.switchSegmentsToLine(), false);
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
    });
});

describe('PathCornerEditor 区間の切り替えと HistoryManager・SnapshotAdapter（実物）', () => {
    /**
     * 実物の履歴付きの手順を作る。
     * @param {VectorModel} model - モデル
     * @returns {{ editor: PathCornerEditor, history: HistoryManager }} 手順と履歴
     */
    function setupHistory(model) {
        const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
        const history = new HistoryManager({
            capture: () => adapter.capture(),
            restore: (snapshot) => adapter.restore(snapshot)
        });
        const editor = new PathCornerEditor({ model, editRecorder: history, getMode: () => OperationMode.VERTEX });
        return { editor, history };
    }

    it('取り消し1回で戻り、やり直しで切り替え後に戻る（複数の図形でも1件）', () => {
        const model = setupModel(
            [makePath('a'), makeLine('l')],
            [...vs('a', ['vertex-0', 'vertex-1']), ...vs('l', ['start', 'end'])]
        );
        const { editor, history } = setupHistory(model);
        const before = dump(model);
        assert.equal(editor.switchSegmentsToCurve(), true);
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
        const model = setupModel([makePath('a')], vs('a', ['vertex-1']));
        const { editor, history } = setupHistory(model);
        assert.equal(editor.switchSegmentsToCurve(), false);
        assert.equal(editor.switchSegmentsToLine(), false);
        assert.equal(history.canUndo(), false);
    });
});
