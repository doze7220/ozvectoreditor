/**
 * 責務: NudgeEditor（矢印キーの微調整の手順）の振る舞いを検証する。
 * 実物のVectorModel・図形と、呼び出しの記録つきの偽のeditRecorder・getModeを組み合わせて確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { NudgeEditor } from '../../js/edit/NudgeEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した矩形（10x10）を作る。
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
 * 実物のモデルと偽の依存で手順を組み立てる。
 * 偽のeditRecorderの呼び出しとモデルの変更通知は、同じ`calls`へ呼ばれた順に記録する。
 * 引数は渡された分だけ記録する（`commitEdit`の記録の長さ-1が引数の個数。鍵なしは`['commitEdit']`、鍵ありは`['commitEdit', 鍵]`）。
 * @param {Array<Object>} shapes モデルへ入れる図形（idは代入済み）
 * @param {string} initialMode 初期の操作モード
 * @returns {{ editor: NudgeEditor, model: VectorModel, calls: Array<Array<*>>, setMode: function(string): void }} 手順・モデル・呼び出しの記録・モードの差し替え関数
 */
function setup(shapes, initialMode) {
    const model = new VectorModel();
    for (const shape of shapes) {
        model.addShape(shape);
    }
    const calls = [];
    let mode = initialMode;
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: (...args) => calls.push(['commitEdit', ...args])
    };
    const editor = new NudgeEditor({ model, editRecorder, getMode: () => mode });
    model.onChange(() => calls.push(['change']));
    return { editor, model, calls, setMode: (m) => { mode = m; } };
}

/**
 * 呼び出しの記録から、指定した名前の呼び出しだけを取り出す。
 * @param {Array<Array<*>>} calls 呼び出しの記録
 * @param {string} name 呼び出し名
 * @returns {Array<Array<*>>} 該当する呼び出し
 */
function only(calls, name) {
    return calls.filter((c) => c[0] === name);
}

/**
 * 呼び出しの記録を、呼び出し名だけの並びにする。
 * @param {Array<Array<*>>} calls 呼び出しの記録
 * @returns {Array<string>} 呼び出し名の並び
 */
function names(calls) {
    return calls.map((c) => c[0]);
}

test('NudgeEditor: 選択モードで複数の図形が同じだけ動き、位置の関係が保たれ、通知は1回', () => {
    const a = makeRect('a', 0, 0);
    const b = makeRect('b', 100, 50);
    const { editor, model, calls } = setup([a, b], OperationMode.SELECT);
    model.setSelection(['a', 'b']);
    calls.length = 0;

    assert.equal(editor.nudge(1, 0), true);
    assert.deepEqual([a.points[0].x, a.points[0].y], [1, 0]);
    assert.deepEqual([b.points[0].x, b.points[0].y], [101, 50]);
    assert.equal(only(calls, 'change').length, 1);
});

test('NudgeEditor: nudge(0, -10)で上へ10px動く', () => {
    const a = makeRect('a', 5, 20);
    const { editor, model } = setup([a], OperationMode.SELECT);
    model.setSelection(['a']);

    assert.equal(editor.nudge(0, -10), true);
    assert.deepEqual([a.points[0].x, a.points[0].y], [5, 10]);
});

test('NudgeEditor: 座標が小数の図形は小数のまま動く（丸めない）', () => {
    const a = makeRect('a', 0.25, 0.5);
    const { editor, model } = setup([a], OperationMode.SELECT);
    model.setSelection(['a']);

    editor.nudge(1, 1);
    assert.deepEqual([a.points[0].x, a.points[0].y], [1.25, 1.5]);
});

test('NudgeEditor: 頂点の選択モードで選んだ頂点だけが動き、別の図形の頂点も含めて通知は1回', () => {
    const rect = makeRect('r', 0, 0);
    const line = makeLine('l', 50, 50, 80, 90);
    const { editor, model, calls } = setup([rect, line], OperationMode.VERTEX);
    model.setSelection(['r', 'l']);
    model.setSelectedVertices([
        { shapeId: 'r', handle: 'bottomRight' },
        { shapeId: 'l', handle: 'start' }
    ]);
    calls.length = 0;

    assert.equal(editor.nudge(3, -2), true);
    assert.deepEqual([rect.points[2].x, rect.points[2].y], [13, 8]);
    assert.deepEqual([rect.points[0].x, rect.points[0].y], [0, 0]);
    assert.deepEqual([rect.points[1].x, rect.points[1].y], [10, 0]);
    assert.deepEqual([rect.points[3].x, rect.points[3].y], [0, 10]);
    assert.deepEqual([line.x1, line.y1], [53, 48]);
    assert.deepEqual([line.x2, line.y2], [80, 90]);
    assert.equal(only(calls, 'change').length, 1);
});

test('NudgeEditor: 対象なし（何も選んでいない・頂点0件・CREATE・PAN）はfalseで記録先に触れず、図形も通知も変わらない', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, calls, setMode } = setup([a], OperationMode.SELECT);

    assert.equal(editor.nudge(1, 0), false);
    setMode(OperationMode.VERTEX);
    assert.equal(editor.nudge(1, 0), false);

    // 頂点の選択モードで図形だけを選び、頂点が0件
    model.setSelection(['a']);
    calls.length = 0;
    assert.equal(editor.nudge(1, 0), false);

    // 作成・パン（図形を選んでいても動かさない）
    setMode(OperationMode.CREATE);
    assert.equal(editor.nudge(1, 0), false);
    setMode(OperationMode.PAN);
    assert.equal(editor.nudge(1, 0), false);

    assert.deepEqual(calls, []);
    assert.deepEqual([a.points[0].x, a.points[0].y], [0, 0]);
});

test('NudgeEditor: 位置が求まらないハンドル名だけが選ばれているとfalseで記録先に触れない', () => {
    const rect = makeRect('r', 0, 0);
    const { editor, model, calls } = setup([rect], OperationMode.VERTEX);
    model.setSelection(['r']);
    model.setSelectedVertices([{ shapeId: 'r', handle: 'noSuchHandle' }]);
    calls.length = 0;

    assert.equal(editor.nudge(1, 0), false);
    assert.deepEqual(calls, []);
    assert.deepEqual([rect.points[0].x, rect.points[0].y], [0, 0]);
});

test('NudgeEditor: 頂点インデックスの無いハンドル（線の中点）の組は飛ばし、他の組は動かす', () => {
    const line = makeLine('l', 0, 0, 10, 10);
    const { editor, model } = setup([line], OperationMode.VERTEX);
    model.setSelection(['l']);
    model.setSelectedVertices([
        { shapeId: 'l', handle: 'move' },
        { shapeId: 'l', handle: 'end' }
    ]);

    assert.equal(editor.nudge(2, 0), true);
    assert.deepEqual([line.x1, line.y1, line.x2, line.y2], [0, 0, 12, 10]);
});

test('NudgeEditor: 記録先へ同じ対象なら同じ鍵、対象を変えると別の鍵が渡る', () => {
    const a = makeRect('a', 0, 0);
    const b = makeRect('b', 30, 30);
    const { editor, model, calls } = setup([a, b], OperationMode.SELECT);
    model.setSelection(['a']);
    calls.length = 0;

    editor.nudge(1, 0);
    editor.nudge(0, 1);
    model.setSelection(['a', 'b']);
    editor.nudge(1, 0);

    const keys = only(calls, 'commitEdit').map((c) => c[1]);
    assert.equal(keys.length, 3);
    assert.equal(typeof keys[0], 'string');
    assert.equal(keys[0], keys[1]);
    assert.notEqual(keys[1], keys[2]);
});

test('NudgeEditor: 図形の移動はbeginEdit → モデルの変更 → commitEditの順で1回ずつ対で呼ばれる', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, calls } = setup([a], OperationMode.SELECT);
    model.setSelection(['a']);
    calls.length = 0;

    editor.nudge(1, 0);
    assert.deepEqual(names(calls), ['beginEdit', 'change', 'commitEdit']);
});

test('NudgeEditor: 頂点の移動もbeginEdit → モデルの変更 → commitEditの順で1回ずつ対で呼ばれる', () => {
    const rect = makeRect('r', 0, 0);
    const { editor, model, calls } = setup([rect], OperationMode.VERTEX);
    model.setSelection(['r']);
    model.setSelectedVertices([{ shapeId: 'r', handle: 'topLeft' }]);
    calls.length = 0;

    editor.nudge(1, 1);
    assert.deepEqual(names(calls), ['beginEdit', 'change', 'commitEdit']);
});

test('NudgeEditor: 移動量はワールド座標のpxで、受け取る依存はmodel・editRecorder・getModeのみ（ビュー変換なし）', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model } = setup([a], OperationMode.SELECT);
    model.setSelection(['a']);

    editor.nudge(10, 0);
    editor.nudge(10, 0);
    assert.equal(a.points[0].x, 20);
});

test('NudgeEditor.nudgeWithoutGrouping: 図形が動き、trueを返し、通知は1回', () => {
    const a = makeRect('a', 0, 0);
    const b = makeRect('b', 50, 50);
    const { editor, model, calls } = setup([a, b], OperationMode.SELECT);
    model.setSelection(['a']);
    calls.length = 0;

    assert.equal(editor.nudgeWithoutGrouping(3, 4), true);
    assert.equal(a.points[0].x, 3);
    assert.equal(a.points[0].y, 4);
    assert.equal(b.points[0].x, 50);
    assert.equal(only(calls, 'change').length, 1);
});

test('NudgeEditor.nudgeWithoutGrouping: 頂点の選択モードで選んだ頂点が動く', () => {
    const rect = makeRect('r', 0, 0);
    const { editor, model } = setup([rect], OperationMode.VERTEX);
    model.setSelection(['r']);
    model.setSelectedVertices([{ shapeId: 'r', handle: 'topLeft' }]);

    assert.equal(editor.nudgeWithoutGrouping(5, 6), true);
    assert.deepEqual(rect.getHandlePosition('topLeft'), { x: 5, y: 6 });
    assert.deepEqual(rect.getHandlePosition('bottomRight'), { x: 10, y: 10 });
});

test('NudgeEditor.nudgeWithoutGrouping: commitEditへ鍵（引数）が渡らない。nudgeは鍵を渡し続ける', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, calls } = setup([a], OperationMode.SELECT);
    model.setSelection(['a']);
    calls.length = 0;

    editor.nudgeWithoutGrouping(1, 0);
    const commits = only(calls, 'commitEdit');
    assert.equal(commits.length, 1);
    assert.equal(commits[0].length - 1, 0);

    calls.length = 0;
    editor.nudge(1, 0);
    const grouped = only(calls, 'commitEdit');
    assert.equal(grouped[0].length - 1, 1);
    assert.equal(typeof grouped[0][1], 'string');
});

test('NudgeEditor.nudgeWithoutGrouping: 続けて2回呼ぶとbeginEdit・commitEditの対が2回記録される', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, calls } = setup([a], OperationMode.SELECT);
    model.setSelection(['a']);
    calls.length = 0;

    editor.nudgeWithoutGrouping(1, 0);
    editor.nudgeWithoutGrouping(1, 0);
    assert.deepEqual(names(calls), ['beginEdit', 'change', 'commitEdit', 'beginEdit', 'change', 'commitEdit']);
    assert.equal(a.points[0].x, 2);
});

test('NudgeEditor.nudgeWithoutGrouping: 対象なし（選択なし・CREATE・PAN・頂点0件）はfalseで記録先に触れない', () => {
    const a = makeRect('a', 0, 0);
    const { editor, model, calls, setMode } = setup([a], OperationMode.SELECT);

    assert.equal(editor.nudgeWithoutGrouping(1, 1), false);
    model.setSelection(['a']);
    calls.length = 0;
    for (const mode of [OperationMode.CREATE, OperationMode.PAN]) {
        setMode(mode);
        assert.equal(editor.nudgeWithoutGrouping(1, 1), false);
    }
    setMode(OperationMode.VERTEX);
    model.setSelectedVertices([{ shapeId: 'a', handle: 'noSuchHandle' }]);
    calls.length = 0;
    assert.equal(editor.nudgeWithoutGrouping(1, 1), false);
    assert.deepEqual(calls, []);
    assert.equal(a.points[0].x, 0);
});
