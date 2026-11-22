/**
 * 責務: PositionInputEditor（位置の数値入力の手順）の振る舞いを検証する。
 * 位置の欄は図形では線を含まない外枠の基準点（既定は中心）、頂点では選んだ頂点全体の範囲の左上になる。
 * 実物のVectorModel・図形・ShapeExtentReaderを使い、移動の先は実物のNudgeEditor（組み方A）か偽のnudgeEditor（組み方B）で確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PositionInputEditor } from '../../js/edit/PositionInputEditor.js';
import { NudgeEditor } from '../../js/edit/NudgeEditor.js';
import { ShapeExtentReader } from '../../js/edit/ShapeExtentReader.js';
import { POSITION_AXIS } from '../../js/edit/PositionInputRules.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した矩形（10x10、線の太さ2）を作る。
 * @param {string} id 代入するid
 * @param {number} x1 左上のX
 * @param {number} y1 左上のY
 * @returns {Rect} 矩形
 */
function makeRect(id, x1, y1) {
    const rect = new Rect(x1, y1, x1 + 10, y1 + 10, '#112233', 2, null);
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
    const line = new Line(x1, y1, x2, y2, '#112233', 2, null);
    line.id = id;
    return line;
}

/**
 * 組み方A：実物のNudgeEditor（記録先は素のオブジェクトの偽物）を通して組み立てる。図形・頂点が実際に動くことを確かめる用。
 * @param {Array<Object>} shapes モデルへ入れる図形（idは代入済み）
 * @param {string} initialMode 初期の操作モード
 * @param {string} [referencePoint] 基準点の名前（省くと`getReferencePoint`を注入しない＝既定の中心）
 * @returns {{ editor: PositionInputEditor, model: VectorModel, setMode: function(string): void }} 編集操作・モデル・モードの差し替え関数
 */
function setupWithRealNudge(shapes, initialMode, referencePoint) {
    const model = new VectorModel();
    for (const shape of shapes) model.addShape(shape);
    let mode = initialMode;
    const getMode = () => mode;
    const editRecorder = { beginEdit: () => {}, commitEdit: () => {} };
    const nudgeEditor = new NudgeEditor({ model, editRecorder, getMode });
    const shapeExtentReader = new ShapeExtentReader({ model });
    const deps = { model, getMode, shapeExtentReader, nudgeEditor };
    if (referencePoint !== undefined) deps.getReferencePoint = () => referencePoint;
    const editor = new PositionInputEditor(deps);
    return { editor, model, setMode: (m) => { mode = m; } };
}

/**
 * 組み方B：偽のnudgeEditor（呼び出しを記録する素のオブジェクト）で組み立てる。移動先に触れないことと素通しを確かめる用。
 * @param {Array<Object>} shapes モデルへ入れる図形（idは代入済み）
 * @param {string} initialMode 初期の操作モード
 * @param {boolean} [returnValue=true] 偽のnudgeWithoutGroupingの戻り値
 * @param {string} [referencePoint] 基準点の名前（省くと`getReferencePoint`を注入しない＝既定の中心）
 * @returns {{ editor: PositionInputEditor, model: VectorModel, nudgeCalls: Array<Array<number>>, setMode: function(string): void }} 編集操作・モデル・移動の呼び出しの記録・モードの差し替え関数
 */
function setupWithFakeNudge(shapes, initialMode, returnValue = true, referencePoint) {
    const model = new VectorModel();
    for (const shape of shapes) model.addShape(shape);
    let mode = initialMode;
    const nudgeCalls = [];
    const nudgeEditor = { nudgeWithoutGrouping: (...args) => { nudgeCalls.push(args); return returnValue; } };
    const shapeExtentReader = new ShapeExtentReader({ model });
    const deps = { model, getMode: () => mode, shapeExtentReader, nudgeEditor };
    if (referencePoint !== undefined) deps.getReferencePoint = () => referencePoint;
    const editor = new PositionInputEditor(deps);
    return { editor, model, nudgeCalls, setMode: (m) => { mode = m; } };
}

test('A: 図形1つ：外枠の左上（基準点nw）が出て、Xに値を入れるとその位置へ動きYは変わらない', () => {
    const a = makeRect('a', 20, 30);
    const { editor, model } = setupWithRealNudge([a], OperationMode.SELECT, 'nw');
    model.setSelection(['a']);

    assert.deepEqual(editor.getPositionView(), { x: '20.0', y: '30.0', disabled: false });
    assert.equal(editor.setPosition(POSITION_AXIS.X, '100'), true);
    assert.equal(editor.getPositionView().x, '100.0');
    assert.equal(a.points[0].x, 100);
    assert.equal(a.points[0].y, 30);
});

test('A: 図形1つ：Yに値を入れるとYだけ動きXは変わらない', () => {
    const a = makeRect('a', 20, 30);
    const { editor, model } = setupWithRealNudge([a], OperationMode.SELECT, 'nw');
    model.setSelection(['a']);

    assert.equal(editor.setPosition(POSITION_AXIS.Y, '-5.5'), true);
    assert.equal(a.points[0].x, 20);
    assert.equal(a.points[0].y, -5.5);
});

test('A: 図形複数：選択全体の外枠の左上が出て、位置関係を保ったまま動く', () => {
    const a = makeRect('a', 20, 30);
    const b = makeRect('b', 50, 10);
    const { editor, model } = setupWithRealNudge([a, b], OperationMode.SELECT, 'nw');
    model.setSelection(['a', 'b']);

    assert.deepEqual(editor.getPositionView(), { x: '20.0', y: '10.0', disabled: false });
    assert.equal(editor.setPosition(POSITION_AXIS.X, '0'), true);
    assert.equal(a.points[0].x, 0);
    assert.equal(b.points[0].x, 30);
    assert.equal(b.points[0].x - a.points[0].x, 30);
    assert.equal(a.points[0].y, 30);
    assert.equal(b.points[0].y, 10);
});

test('A: 頂点1つ：その頂点の位置が出て、その頂点だけが動く', () => {
    const rect = makeRect('r', 0, 0);
    const { editor, model } = setupWithRealNudge([rect], OperationMode.VERTEX);
    model.setSelection(['r']);
    model.setSelectedVertices([{ shapeId: 'r', handle: 'bottomRight' }]);

    assert.deepEqual(editor.getPositionView(), { x: '10.0', y: '10.0', disabled: false });
    assert.equal(editor.setPosition(POSITION_AXIS.X, '25'), true);
    assert.deepEqual([rect.points[2].x, rect.points[2].y], [25, 10]);
    assert.deepEqual([rect.points[0].x, rect.points[0].y], [0, 0]);
    assert.deepEqual([rect.points[1].x, rect.points[1].y], [10, 0]);
    assert.deepEqual([rect.points[3].x, rect.points[3].y], [0, 10]);
});

test('A: 頂点複数：選んだ頂点全体の範囲の左上が出て、位置関係を保ったまま動く', () => {
    const rect = makeRect('r', 0, 0);
    const line = makeLine('l', 50, 60, 80, 90);
    const { editor, model } = setupWithRealNudge([rect, line], OperationMode.VERTEX);
    model.setSelection(['r', 'l']);
    model.setSelectedVertices([
        { shapeId: 'r', handle: 'bottomRight' },
        { shapeId: 'l', handle: 'start' }
    ]);

    assert.deepEqual(editor.getPositionView(), { x: '10.0', y: '10.0', disabled: false });
    assert.equal(editor.setPosition(POSITION_AXIS.Y, '0'), true);
    assert.deepEqual([rect.points[2].x, rect.points[2].y], [10, 0]);
    assert.deepEqual([line.x1, line.y1], [50, 50]);
    assert.deepEqual([line.x2, line.y2], [80, 90]);
    assert.equal(line.y1 - rect.points[2].y, 50);
});

test('A: 線の太さを変えても外枠の左上の表示は変わらない（線を含まない外枠。図形も動かない）', () => {
    const a = makeRect('a', 20, 30);
    const { editor, model } = setupWithRealNudge([a], OperationMode.SELECT, 'nw');
    model.setSelection(['a']);
    assert.equal(editor.getPositionView().x, '20.0');

    a.strokeWidth = 10;
    assert.deepEqual(editor.getPositionView(), { x: '20.0', y: '30.0', disabled: false });
    assert.equal(a.points[0].x, 20);
});

test('A: getPositionViewのdisabledが対象の有無で切り替わる', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, setMode } = setupWithRealNudge([a], OperationMode.SELECT);

    assert.deepEqual(editor.getPositionView(), { x: '', y: '', disabled: true });
    model.setSelection(['a']);
    assert.equal(editor.getPositionView().disabled, false);
    setMode(OperationMode.VERTEX);
    assert.equal(editor.getPositionView().disabled, true);
    model.setSelectedVertices([{ shapeId: 'a', handle: 'topLeft' }]);
    assert.equal(editor.getPositionView().disabled, false);
    setMode(OperationMode.CREATE);
    assert.equal(editor.getPositionView().disabled, true);
    setMode(OperationMode.PAN);
    assert.equal(editor.getPositionView().disabled, true);
});

test('A: getPositionViewは図形・選択集合を変えない（中身まで比較）', () => {
    const a = makeRect('a', 20, 30);
    const b = makeLine('b', 1, 2, 3, 4);
    const { editor, model } = setupWithRealNudge([a, b], OperationMode.VERTEX);
    model.setSelection(['a', 'b']);
    model.setSelectedVertices([{ shapeId: 'a', handle: 'topLeft' }, { shapeId: 'b', handle: 'end' }]);
    const shapesBefore = JSON.stringify(model.getShapes().map((s) => s.toJSON()));
    const idsBefore = model.getSelectedIds();
    const verticesBefore = JSON.stringify(model.getSelectedVertices());

    editor.getPositionView();
    editor.getPositionView();

    assert.equal(JSON.stringify(model.getShapes().map((s) => s.toJSON())), shapesBefore);
    assert.deepEqual(model.getSelectedIds(), idsBefore);
    assert.equal(JSON.stringify(model.getSelectedVertices()), verticesBefore);
});

test('B: 対象なし（選択なし・頂点0件・CREATE・PAN）はfalseでnudgeWithoutGroupingを呼ばない', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, nudgeCalls, setMode } = setupWithFakeNudge([a], OperationMode.SELECT);

    assert.equal(editor.setPosition(POSITION_AXIS.X, '5'), false);
    model.setSelection(['a']);
    setMode(OperationMode.VERTEX);
    assert.equal(editor.setPosition(POSITION_AXIS.X, '5'), false);
    setMode(OperationMode.CREATE);
    assert.equal(editor.setPosition(POSITION_AXIS.X, '5'), false);
    setMode(OperationMode.PAN);
    assert.equal(editor.setPosition(POSITION_AXIS.X, '5'), false);
    assert.deepEqual(nudgeCalls, []);
});

test('B: 受理しない入力（空文字・数値でない文字列・同じ値・未知の軸）はfalseでnudgeWithoutGroupingを呼ばない', () => {
    const a = makeRect('a', 20, 30);
    const { editor, model, nudgeCalls } = setupWithFakeNudge([a], OperationMode.SELECT, true, 'nw');
    model.setSelection(['a']);

    assert.equal(editor.setPosition(POSITION_AXIS.X, ''), false);
    assert.equal(editor.setPosition(POSITION_AXIS.X, 'abc'), false);
    assert.equal(editor.setPosition(POSITION_AXIS.X, '20'), false);
    assert.equal(editor.setPosition(POSITION_AXIS.Y, '30'), false);
    assert.equal(editor.setPosition('z', '5'), false);
    assert.deepEqual(nudgeCalls, []);
});

test('B: 受理する入力では求めた移動量が渡り、戻り値がそのままsetPositionの戻り値になる', () => {
    const a = makeRect('a', 20, 30);
    const t = setupWithFakeNudge([a], OperationMode.SELECT, true, 'nw');
    t.model.setSelection(['a']);
    assert.equal(t.editor.setPosition(POSITION_AXIS.X, '10.5'), true);
    assert.equal(t.editor.setPosition(POSITION_AXIS.Y, '-1'), true);
    assert.deepEqual(t.nudgeCalls, [[-9.5, 0], [0, -31]]);

    const f = setupWithFakeNudge([makeRect('a', 20, 30)], OperationMode.SELECT, false, 'nw');
    f.model.setSelection(['a']);
    assert.equal(f.editor.setPosition(POSITION_AXIS.X, '0'), false);
    assert.deepEqual(f.nudgeCalls, [[-20, 0]]);
});

test('C: 基準点を渡さない（既定）と図形の位置は外枠の中心', () => {
    const a = makeRect('a', 20, 30);
    const { editor, model } = setupWithRealNudge([a], OperationMode.SELECT);
    model.setSelection(['a']);

    assert.deepEqual(editor.getPositionView(), { x: '25.0', y: '35.0', disabled: false });
});

test('C: 9か所の基準点ごとに表示が線を含まない外枠の上の位置になり、入力でその点が入力値へ動く', () => {
    // 矩形 (20,30)-(30,40)。線の太さ2は外枠に含まれない。
    const expected = {
        nw: [20, 30], n: [25, 30], ne: [30, 30],
        w: [20, 35], center: [25, 35], e: [30, 35],
        sw: [20, 40], s: [25, 40], se: [30, 40]
    };
    for (const [name, [x, y]] of Object.entries(expected)) {
        const a = makeRect('a', 20, 30);
        const { editor, model } = setupWithRealNudge([a], OperationMode.SELECT, name);
        model.setSelection(['a']);
        assert.deepEqual(editor.getPositionView(), { x: x.toFixed(1), y: y.toFixed(1), disabled: false }, name);
        assert.equal(editor.setPosition(POSITION_AXIS.X, '100'), true, name);
        assert.equal(a.points[0].x, 20 + (100 - x), name);
        assert.equal(a.points[0].y, 30, name);
    }
    for (const [name, [, y]] of Object.entries(expected)) {
        const t = setupWithFakeNudge([makeRect('a', 20, 30)], OperationMode.SELECT, true, name);
        t.model.setSelection(['a']);
        assert.equal(t.editor.setPosition(POSITION_AXIS.Y, '0'), true, name);
        assert.deepEqual(t.nudgeCalls, [[0, -y]], name);
    }
});

test('C: 基準点を変えると表示だけが変わり、図形は変わらない', () => {
    const a = makeRect('a', 20, 30);
    let reference = 'nw';
    const model = new VectorModel();
    model.addShape(a);
    model.setSelection(['a']);
    const shapeExtentReader = new ShapeExtentReader({ model });
    const nudgeEditor = { nudgeWithoutGrouping: () => { throw new Error('呼ばれてはならない'); } };
    const editor = new PositionInputEditor({ model, getMode: () => OperationMode.SELECT, shapeExtentReader, nudgeEditor, getReferencePoint: () => reference });
    const before = JSON.stringify(a.toJSON());

    assert.deepEqual(editor.getPositionView(), { x: '20.0', y: '30.0', disabled: false });
    reference = 'se';
    assert.deepEqual(editor.getPositionView(), { x: '30.0', y: '40.0', disabled: false });
    assert.equal(JSON.stringify(a.toJSON()), before);
});

test('C: 頂点（VERTEX）は基準点によらず選んだ頂点全体の範囲の左上のまま', () => {
    const rect = makeRect('r', 0, 0);
    const { editor, model } = setupWithRealNudge([rect], OperationMode.VERTEX, 'se');
    model.setSelection(['r']);
    model.setSelectedVertices([{ shapeId: 'r', handle: 'bottomRight' }]);

    assert.deepEqual(editor.getPositionView(), { x: '10.0', y: '10.0', disabled: false });
    assert.equal(editor.setPosition(POSITION_AXIS.X, '25'), true);
    assert.deepEqual([rect.points[2].x, rect.points[2].y], [25, 10]);
});
