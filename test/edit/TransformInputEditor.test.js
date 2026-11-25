/**
 * 責務: TransformInputEditor（幅・高さ・角度・反転の数値入力と反転の手順）の振る舞いを検証する。
 * 実物のVectorModel・図形・ShapeExtentReaderと、呼び出しを記録する偽のeditRecorder（または実物のHistoryManager＋SnapshotAdapter）を使い、保存・書き出しの往復も確かめる。
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
import { REFERENCE_POINT } from '../../js/core/ReferencePointRules.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * idを直接代入した矩形（線の太さ4）を作る。
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
 * 数値を整える（`-0`を`0`にする）。
 * @param {number} n 数値
 * @returns {number} `-0`を`0`にした数値
 */
function norm(n) {
    return n + 0;
}

/**
 * 図形の頂点を`-0`を整えた[x, y]の並びで返す。
 * @param {Object} shape 図形
 * @returns {Array<Array<number>>} 頂点の並び
 */
function pointsOf(shape) {
    return shape.points.map((p) => [norm(p.x), norm(p.y)]);
}

/**
 * 偽のeditRecorderで組み立てる。
 * @param {Array<Object>} shapes モデルへ入れる図形（idは代入済み）
 * @param {string} initialMode 初期の操作モード
 * @param {{referencePoint?: string, aspectLocked?: boolean}} [options] 基準点・比率の鍵（省くと注入しない）
 * @returns {{ editor: TransformInputEditor, model: VectorModel, calls: Array<string>, reader: ShapeExtentReader, setMode: function(string): void, notifyCount: function(): number }} 編集操作ほか
 */
function setup(shapes, initialMode, options = {}) {
    const model = new VectorModel();
    for (const shape of shapes) model.addShape(shape);
    let mode = initialMode;
    const calls = [];
    const editRecorder = { beginEdit: () => calls.push('begin'), commitEdit: () => calls.push('commit') };
    const reader = new ShapeExtentReader({ model });
    let notifies = 0;
    model.onChange(() => { notifies += 1; });
    const deps = { model, getMode: () => mode, shapeExtentReader: reader, editRecorder };
    if (options.referencePoint !== undefined) deps.getReferencePoint = () => options.referencePoint;
    if (options.aspectLocked !== undefined) deps.isAspectLocked = () => options.aspectLocked;
    const editor = new TransformInputEditor(deps);
    return { editor, model, calls, reader, setMode: (m) => { mode = m; }, notifyCount: () => notifies };
}

/**
 * 実物のHistoryManager＋SnapshotAdapterで組み立てる。
 * @param {Array<Object>} shapes モデルへ入れる図形（idは代入済み）
 * @param {string} referencePoint 基準点の名前
 * @returns {{ editor: TransformInputEditor, model: VectorModel, history: HistoryManager }} 編集操作・モデル・履歴
 */
function setupWithHistory(shapes, referencePoint) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new TransformInputEditor({
        model,
        getMode: () => OperationMode.SELECT,
        shapeExtentReader: new ShapeExtentReader({ model }),
        editRecorder: history,
        getReferencePoint: () => referencePoint
    });
    return { editor, model, history };
}

test('押せない：選択なし・VERTEX・CREATE・PANでは表示が空で、操作はfalseで記録先に触れない', () => {
    const cases = [
        [OperationMode.SELECT, []],
        [OperationMode.VERTEX, ['a']],
        [OperationMode.CREATE, ['a']],
        [OperationMode.PAN, ['a']]
    ];
    for (const [mode, selection] of cases) {
        const { editor, model, calls, notifyCount } = setup([makeRect('a', 20, 30, 60, 70)], mode);
        model.setSelection(selection);
        const before = notifyCount();
        assert.deepEqual(editor.getSizeView(), {
            width: '', height: '', widthDisabled: true, heightDisabled: true, lockDisabled: true, aspectLocked: false
        }, mode);
        assert.deepEqual(editor.getTransformView(), { angle: '', referencePoint: null, disabled: true }, mode);
        assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '80'), false, mode);
        assert.equal(editor.rotateBy('90'), false, mode);
        assert.equal(editor.flip(FLIP_AXIS.HORIZONTAL), false, mode);
        assert.deepEqual(calls, [], mode);
        assert.equal(notifyCount(), before, mode);
    }
});

test('押せない：VERTEXで頂点を選んでいても押せない', () => {
    const { editor, model, calls } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.VERTEX);
    model.setSelectedVertices([{ shapeId: 'a', handle: 'bottomRight' }]);
    assert.equal(editor.getSizeView().widthDisabled, true);
    assert.equal(editor.flip(FLIP_AXIS.VERTICAL), false);
    assert.deepEqual(calls, []);
});

test('表示：線を含まない外枠の幅・高さが出て、既定は中心の基準点・鍵なし', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 90)], OperationMode.SELECT);
    model.setSelection(['a']);
    assert.deepEqual(editor.getSizeView(), {
        width: '40.0', height: '60.0', widthDisabled: false, heightDisabled: false, lockDisabled: false, aspectLocked: false
    });
    assert.deepEqual(editor.getTransformView(), { angle: '0', referencePoint: REFERENCE_POINT.CENTER, disabled: false });
});

test('表示：照会は図形・選択・記録先を変えない', () => {
    const { editor, model, calls, notifyCount } = setup([makeRect('a', 20, 30, 60, 90)], OperationMode.SELECT, { aspectLocked: true });
    model.setSelection(['a']);
    const before = notifyCount();
    const json = JSON.stringify(model.getShapes().map((s) => s.toJSON()));
    assert.equal(editor.getSizeView().aspectLocked, true);
    editor.getTransformView();
    assert.equal(JSON.stringify(model.getShapes().map((s) => s.toJSON())), json);
    assert.deepEqual(model.getSelectedIds(), ['a']);
    assert.deepEqual(calls, []);
    assert.equal(notifyCount(), before);
});

test('幅：基準点ごとに基準点が動かない（20,30〜60,70の矩形の幅を80にする）', () => {
    // 幅40→80（倍率2）。動かない点のxは nw・w・sw=20, n・center・s=40, ne・e・se=60。
    const expectedLeft = {
        [REFERENCE_POINT.NW]: 20, [REFERENCE_POINT.W]: 20, [REFERENCE_POINT.SW]: 20,
        [REFERENCE_POINT.N]: 0, [REFERENCE_POINT.CENTER]: 0, [REFERENCE_POINT.S]: 0,
        [REFERENCE_POINT.NE]: -20, [REFERENCE_POINT.E]: -20, [REFERENCE_POINT.SE]: -20
    };
    for (const [name, left] of Object.entries(expectedLeft)) {
        const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT, { referencePoint: name });
        model.setSelection(['a']);
        assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '80'), true, name);
        const pts = pointsOf(model.getShapes()[0]);
        assert.equal(pts[0][0], left, name);
        assert.equal(pts[1][0], left + 80, name);
        assert.deepEqual([pts[0][1], pts[2][1]], [30, 70], name);
    }
});

test('高さ：左上基準で縮められ、幅は変わらない', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['a']);
    assert.equal(editor.setSize(SIZE_AXIS.HEIGHT, '10'), true);
    assert.deepEqual(pointsOf(model.getShapes()[0]), [[20, 30], [60, 30], [60, 40], [20, 40]]);
});

test('幅：比率の鍵ありで高さも同じ倍率になる', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW, aspectLocked: true });
    model.setSelection(['a']);
    assert.equal(editor.getSizeView().aspectLocked, true);
    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '80'), true);
    assert.deepEqual(pointsOf(model.getShapes()[0]), [[20, 30], [100, 30], [100, 110], [20, 110]]);
});

test('幅：複数選択では選択全体の外枠の比率で、図形どうしの位置関係も拡大される', () => {
    const { editor, model } = setup(
        [makeRect('a', 0, 0, 10, 10), makeRect('b', 30, 0, 40, 10)],
        OperationMode.SELECT,
        { referencePoint: REFERENCE_POINT.NW, aspectLocked: true }
    );
    model.setSelection(['a', 'b']);
    assert.equal(editor.getSizeView().width, '40.0');
    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '80'), true);
    const [a, b] = model.getShapes();
    assert.deepEqual(pointsOf(a), [[0, 0], [20, 0], [20, 20], [0, 20]]);
    assert.deepEqual(pointsOf(b), [[60, 0], [80, 0], [80, 20], [60, 20]]);
});

test('高さ：水平な直線は高さを押せず、幅だけ変わる', () => {
    const { editor, model, calls } = setup([makeLine('l', 0, 10, 100, 10)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['l']);
    const view = editor.getSizeView();
    assert.equal(view.height, '0.0');
    assert.equal(view.heightDisabled, true);
    assert.equal(editor.setSize(SIZE_AXIS.HEIGHT, '50'), false);
    assert.deepEqual(calls, []);
    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '200'), true);
    const line = model.getShapes()[0];
    assert.deepEqual([line.x1, line.y1, line.x2, line.y2].map(norm), [0, 10, 200, 10]);
});

test('幅：受理しない入力・今と同じ値は記録先に触れずfalse', () => {
    const { editor, model, calls } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT);
    model.setSelection(['a']);
    for (const text of ['', 'abc', '0', '-5', '40']) {
        assert.equal(editor.setSize(SIZE_AXIS.WIDTH, text), false, text);
    }
    assert.equal(editor.setSize('unknown', '80'), false);
    assert.deepEqual(calls, []);
});

test('角度：左上基準で90度（プラス＝反時計回り）にすると座標がきれいな値になる', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['a']);
    assert.equal(editor.rotateBy('90'), true);
    assert.deepEqual(pointsOf(model.getShapes()[0]), [[20, 30], [20, -10], [60, -10], [60, 30]]);
});

test('角度：30度で反時計回りに回る（右上の頂点が上へ上がる）', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['a']);
    assert.equal(editor.rotateBy('30'), true);
    const topRight = model.getShapes()[0].points[1];
    assert.ok(Math.abs(topRight.x - (20 + 40 * Math.cos(Math.PI / 6))) < 1e-9);
    assert.ok(Math.abs(topRight.y - (30 - 40 * Math.sin(Math.PI / 6))) < 1e-9);
});

test('角度：受理しない入力・0は記録先に触れずfalse', () => {
    const { editor, model, calls } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT);
    model.setSelection(['a']);
    for (const text of ['', 'abc', '0']) {
        assert.equal(editor.rotateBy(text), false, text);
    }
    assert.deepEqual(calls, []);
});

test('反転：横・縦（中心基準）で左右・上下が入れ替わる', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT);
    model.setSelection(['a']);
    assert.equal(editor.flip(FLIP_AXIS.HORIZONTAL), true);
    assert.deepEqual(pointsOf(model.getShapes()[0]), [[60, 30], [20, 30], [20, 70], [60, 70]]);
    assert.equal(editor.flip(FLIP_AXIS.VERTICAL), true);
    assert.deepEqual(pointsOf(model.getShapes()[0]), [[60, 70], [20, 70], [20, 30], [60, 30]]);
});

test('反転：基準点ごとにその点を通る線が軸になる（左上基準の横の反転）', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['a']);
    assert.equal(editor.flip(FLIP_AXIS.HORIZONTAL), true);
    assert.deepEqual(pointsOf(model.getShapes()[0]), [[20, 30], [-20, 30], [-20, 70], [20, 70]]);
});

test('反転：未知の軸はfalseで記録先に触れない', () => {
    const { editor, model, calls } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT);
    model.setSelection(['a']);
    assert.equal(editor.flip('unknown'), false);
    assert.deepEqual(calls, []);
});

test('反転：弧の縦の反転（左下基準）で下半分の弧になる', () => {
    const arc = new Ellipse(0, 0, 50, 50, 'arc', '#112233', 4, null);
    arc.id = 'e';
    const { editor, model, reader } = setup([arc], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.SW });
    model.setSelection(['e']);
    const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
    const upper = reader.getSelectedGeometryBounds();
    near(upper.minY, -50);
    near(upper.maxY, 0);
    assert.equal(editor.flip(FLIP_AXIS.VERTICAL), true);
    const lower = reader.getSelectedGeometryBounds();
    near(lower.minX, -50);
    near(lower.maxX, 50);
    near(lower.minY, 0);
    near(lower.maxY, 50);
    near(model.getShapes()[0].points[0].y, 0);
});

test('図形種別：円・パスにも同じ手順で当たる', () => {
    const circle = new Ellipse(0, 0, 50, 50, 'circle', '#112233', 4, null);
    circle.id = 'c';
    const path = new Path([{ x: 100, y: 0 }, { x: 140, y: 0 }, { x: 140, y: 40 }], true, '#112233', 4, null);
    path.id = 'p';
    const { editor, model, reader } = setup([circle, path], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['c', 'p']);
    assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: -50, minY: -50, maxX: 140, maxY: 50 });
    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '380'), true);
    assert.deepEqual(reader.getSelectedGeometryBounds(), { minX: -50, minY: -50, maxX: 330, maxY: 50 });
});

test('記録：確定1回でbeginEdit・commitEditが1回ずつ、通知は1回', () => {
    const { editor, model, calls, notifyCount } = setup([makeRect('a', 20, 30, 60, 70)], OperationMode.SELECT);
    model.setSelection(['a']);
    const before = notifyCount();
    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '80'), true);
    assert.deepEqual(calls, ['begin', 'commit']);
    assert.equal(notifyCount() - before, 1);
});

test('選択・id・並び・線の太さ・スタイルが変わらない', () => {
    const a = makeRect('a', 0, 0, 10, 10);
    const b = makeRect('b', 30, 0, 40, 10);
    const c = makeRect('c', 60, 0, 70, 10);
    const { editor, model } = setup([a, b, c], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['a', 'c']);
    assert.equal(editor.rotateBy('45'), true);
    assert.deepEqual(model.getShapes().map((s) => s.id), ['a', 'b', 'c']);
    assert.deepEqual(model.getSelectedIds(), ['a', 'c']);
    for (const s of model.getShapes()) {
        assert.equal(s.strokeWidth, 4);
        assert.equal(s.strokeColor, '#112233');
        assert.equal(s.fillColor, null);
    }
    assert.deepEqual(pointsOf(model.getShapes()[1]), [[30, 0], [40, 0], [40, 10], [30, 10]]);
});

test('履歴：反転1回が取り消し1件で、取り消すと元の形と選択に戻る', () => {
    const { editor, model, history } = setupWithHistory([makeRect('a', 20, 30, 60, 70), makeRect('b', 100, 0, 110, 10)], REFERENCE_POINT.CENTER);
    model.setSelection(['a']);
    const before = pointsOf(model.getShapes()[0]);
    assert.equal(history.canUndo(), false);
    assert.equal(editor.flip(FLIP_AXIS.HORIZONTAL), true);
    assert.equal(history.canUndo(), true);
    assert.notDeepEqual(pointsOf(model.getShapes()[0]), before);
    history.undo();
    assert.deepEqual(pointsOf(model.getShapes()[0]), before);
    assert.deepEqual(model.getSelectedIds(), ['a']);
    assert.equal(history.canUndo(), false);
});

test('履歴：前後が同じ変形（360度）は記録されない', () => {
    const { editor, model, history } = setupWithHistory([makeRect('a', 20, 30, 60, 70)], REFERENCE_POINT.CENTER);
    model.setSelection(['a']);
    assert.equal(editor.rotateBy('360'), true);
    assert.equal(history.canUndo(), false);
});

test('保存・書き出し：変形した図形が作業データで往復し、書き出しの形が今のまま', () => {
    const { editor, model } = setup([makeRect('a', 20, 30, 60, 70), makeLine('l', 0, 0, 10, 10)], OperationMode.SELECT, { referencePoint: REFERENCE_POINT.NW });
    model.setSelection(['a', 'l']);
    assert.equal(editor.rotateBy('30'), true);
    assert.equal(editor.setSize(SIZE_AXIS.WIDTH, '77'), true);
    assert.equal(editor.flip(FLIP_AXIS.VERTICAL), true);
    const shapes = model.getShapes();

    const restored = DocumentSerializer.deserializeFromString(DocumentSerializer.serializeToString(shapes));
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.shapes.map((s) => s.toJSON()), shapes.map((s) => s.toJSON()));

    const sprite = SpriteSerializer.serialize(shapes);
    assert.deepEqual(Object.keys(sprite).sort(), ['bounds', 'elements', 'format', 'formatVersion']);
    assert.equal(sprite.formatVersion, 4);
    const work = DocumentSerializer.serialize(shapes);
    assert.equal(work.version, 4);
    assert.deepEqual(Object.keys(work).sort(), ['format', 'shapes', 'version']);
    const text = JSON.stringify(sprite);
    assert.equal(/referencePoint|aspectLock/i.test(text), false);
});
