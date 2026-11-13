/**
 * 責務: ShapeStyleEditor（オプションバーでの変更とスタイルをまとめて当てる入口`applyStyle`・`resetColors`の反映・履歴の単位・ピッカー操作中の記録・直前に使った値の更新）の振る舞いを検証する。
 * 実物のVectorModel・SnapshotAdapter・HistoryManagerと組み合わせ、表示の同期をmodel.onChangeでmain.jsと同じ呼び方にして確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @param {string|null} [stroke='#112233'] 線の色
 * @param {number} [width=3] 線の太さ
 * @param {string|null} [fill=null] 塗りの色
 * @returns {Rect} 矩形
 */
function makeRect(id, stroke = '#112233', width = 3, fill = null) {
    const rect = new Rect(0, 0, 10, 10, stroke, width, fill);
    rect.id = id;
    return rect;
}

/**
 * idを直接代入した直線を作る（塗れない形）。
 * @param {string} id 代入するid
 * @param {string|null} [stroke='#445566'] 線の色
 * @param {number} [width=4] 線の太さ
 * @param {string|null} [fill='#abcdef'] 保持している塗りの色
 * @returns {Line} 直線
 */
function makeLine(id, stroke = '#445566', width = 4, fill = '#abcdef') {
    const line = new Line(0, 0, 10, 10, stroke, width, fill);
    line.id = id;
    return line;
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・ShapeStyleEditorを組み合わせる。
 * @param {Array<Object>} shapes 入れる図形（描画順。idは代入済み）
 * @param {Array<string>} [selectedIds=[]] 選択するid
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ShapeStyleEditor }} 組み合わせた実物
 */
function setup(shapes, selectedIds = []) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new ShapeStyleEditor({ model, editRecorder: history });
    model.onChange(() => editor.getPanelView());
    model.setSelection(selectedIds);
    return { model, history, editor };
}

/**
 * モデルの図形一式を図形データ（toJSON）の配列で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<Object>} 図形データの配列（描画順）
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

/**
 * undoできる回数を、undo()を繰り返して数える（履歴は破壊される）。
 * @param {HistoryManager} history 履歴
 * @returns {number} 件数
 */
function countUndo(history) {
    let count = 0;
    while (history.canUndo()) {
        history.undo();
        count += 1;
    }
    return count;
}

test('setStrokeEnabled(false): 選択中の全図形の線がnullになり、1件のUndo/Redoで往復する。直前に使った値は有無だけ変わる', () => {
    const { model, history, editor } = setup([makeRect('a'), makeLine('b'), makeRect('c')], ['a', 'b']);
    const before = dump(model);
    assert.equal(editor.setStrokeEnabled(false), true);
    const after = dump(model);
    assert.equal(after[0].strokeColor, null);
    assert.equal(after[1].strokeColor, null);
    assert.equal(after[2].strokeColor, '#112233');
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: false, strokeColor: '#000000', strokeWidth: 2, fillEnabled: false, fillColor: '#ffffff' });
    history.undo();
    assert.deepEqual(dump(model), before);
    history.redo();
    assert.deepEqual(dump(model), after);
    assert.equal(countUndo(history), 1);
});

test('setStrokeEnabled(true): 表示中の線の色が入り、直前に使った値の色は変わらない。赤に戻る', () => {
    const { model, editor } = setup([makeRect('a', '#ff0000')], ['a']);
    editor.getPanelView();
    editor.setStrokeEnabled(false);
    assert.equal(model.getShapes()[0].strokeColor, null);
    editor.setStrokeEnabled(true);
    assert.equal(model.getShapes()[0].strokeColor, '#ff0000');
    assert.equal(model.getNewShapeStyle().strokeColor, '#000000');
    assert.equal(model.getNewShapeStyle().strokeEnabled, true);
});

test('setFillEnabled: 塗れる形だけに反映し、塗れない形のfillColorは保持する。直前に使った値は有無だけ', () => {
    const { model, editor } = setup([makeRect('a'), makeLine('b')], ['a', 'b']);
    assert.equal(editor.setFillEnabled(true), true);
    const shapes = dump(model);
    assert.equal(shapes[0].fillColor, '#ffffff');
    assert.equal(shapes[1].fillColor, '#abcdef');
    assert.equal(model.getNewShapeStyle().fillEnabled, true);
    assert.equal(model.getNewShapeStyle().fillColor, '#ffffff');
    assert.equal(editor.setFillEnabled(false), true);
    assert.equal(model.getShapes()[0].fillColor, null);
    assert.equal(model.getShapes()[1].fillColor, '#abcdef');
    assert.equal(model.getNewShapeStyle().fillEnabled, false);
});

test('setFillEnabled: 塗れない形だけの選択ではfalse。図形・履歴・直前に使った値を変えない', () => {
    const { model, history, editor } = setup([makeLine('b')], ['b']);
    const before = dump(model);
    const style = model.getNewShapeStyle();
    assert.equal(editor.setFillEnabled(true), false);
    assert.deepEqual(dump(model), before);
    assert.deepEqual(model.getNewShapeStyle(), style);
    assert.equal(history.canUndo(), false);
});

test('setStrokeWidth: 線なしの図形を含む全図形へ反映し、直前に使った値はstrokeWidthだけ変わる。1件で戻る', () => {
    const { model, history, editor } = setup([makeRect('a', null, 3), makeRect('b', '#000000', 7)], ['a', 'b']);
    assert.equal(editor.setStrokeWidth('5'), true);
    assert.deepEqual(model.getShapes().map((s) => s.strokeWidth), [5, 5]);
    assert.equal(model.getShapes()[0].strokeColor, null);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#000000', strokeWidth: 5, fillEnabled: false, fillColor: '#ffffff' });
    history.undo();
    assert.deepEqual(model.getShapes().map((s) => s.strokeWidth), [3, 7]);
    assert.equal(history.canUndo(), false);
});

test('setStrokeWidth: 不正な入力はfalse。図形・履歴・直前に使った値を変えない', () => {
    const { model, history, editor } = setup([makeRect('a')], ['a']);
    const before = dump(model);
    for (const text of ['', '0', '-1', '2.5', '101', 'abc', null]) {
        assert.equal(editor.setStrokeWidth(text), false, String(text));
    }
    assert.deepEqual(dump(model), before);
    assert.equal(model.getNewShapeStyle().strokeWidth, 2);
    assert.equal(history.canUndo(), false);
});

test('前後が同じ（同じ太さ・同じ色の選び直し）なら履歴に記録されない', () => {
    const { history, editor } = setup([makeRect('a', '#112233', 3)], ['a']);
    editor.setStrokeWidth('3');
    editor.commitColor('stroke', '#112233');
    assert.equal(history.canUndo(), false);
});

test('commitColor(stroke): 線なしの図形にも線が付き、色と有無が直前に使った値に入る。1件', () => {
    const { model, history, editor } = setup([makeRect('a', null)], ['a']);
    assert.equal(editor.commitColor('stroke', '#00ff00'), true);
    assert.equal(model.getShapes()[0].strokeColor, '#00ff00');
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#00ff00', strokeWidth: 2, fillEnabled: false, fillColor: '#ffffff' });
    assert.equal(countUndo(history), 1);
    assert.equal(model.getShapes()[0].strokeColor, null);
});

test('commitColor(fill): 塗れる形だけに塗りが付く。塗れる形が無ければfalse', () => {
    const both = setup([makeRect('a'), makeLine('b')], ['a', 'b']);
    assert.equal(both.editor.commitColor('fill', '#ff0000'), true);
    assert.equal(both.model.getShapes()[0].fillColor, '#ff0000');
    assert.equal(both.model.getShapes()[1].fillColor, '#abcdef');
    assert.deepEqual(both.model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#000000', strokeWidth: 2, fillEnabled: true, fillColor: '#ff0000' });
    const lineOnly = setup([makeLine('b')], ['b']);
    assert.equal(lineOnly.editor.commitColor('fill', '#ff0000'), false);
    assert.equal(lineOnly.history.canUndo(), false);
    assert.equal(lineOnly.model.getNewShapeStyle().fillColor, '#ffffff');
});

test('previewColor: 表に無いtarget・変換できない色はfalse', () => {
    const { model, history, editor } = setup([makeRect('a')], ['a']);
    assert.equal(editor.previewColor('width', '#ff0000'), false);
    assert.equal(editor.previewColor('stroke', 'red'), false);
    assert.equal(editor.commitColor('stroke', 'nope'), false);
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(history.canUndo(), false);
});

test('previewColor: inputの連続は図形へすぐ反映され、履歴は開かず、確定でUndo1回で開く前の色に戻る', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233')], ['a']);
    editor.previewColor('stroke', '#aa0000');
    editor.previewColor('stroke', '#bb0000');
    editor.previewColor('stroke', '#cc0000');
    assert.equal(model.getShapes()[0].strokeColor, '#cc0000');
    assert.equal(history.canUndo(), false);
    editor.commitColor('stroke', '#cc0000');
    assert.equal(model.getShapes()[0].strokeColor, '#cc0000');
    history.undo();
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(history.canUndo(), false);
    history.redo();
    assert.equal(model.getShapes()[0].strokeColor, '#cc0000');
    assert.equal(warn.mock.calls.length, 0);
});

test('finishColorPreview: 確定して1件記録する。記録が無ければ何もしない', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233')], ['a']);
    editor.finishColorPreview();
    assert.equal(history.canUndo(), false);
    editor.previewColor('stroke', '#aa0000');
    editor.finishColorPreview();
    editor.finishColorPreview();
    assert.equal(countUndo(history), 1);
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(warn.mock.calls.length, 0);
});

test('ピッカー操作中に別の変更メソッドが呼ばれると、先に確定されて2件になる', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233', 3)], ['a']);
    editor.previewColor('stroke', '#aa0000');
    editor.setStrokeWidth('9');
    assert.equal(model.getShapes()[0].strokeColor, '#aa0000');
    assert.equal(model.getShapes()[0].strokeWidth, 9);
    assert.equal(countUndo(history), 2);
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(model.getShapes()[0].strokeWidth, 3);
    assert.equal(warn.mock.calls.length, 0);
});

test('ピッカー操作中に別の項目のpreviewColorが来ると、先の項目が確定される', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a')], ['a']);
    editor.previewColor('stroke', '#aa0000');
    editor.previewColor('fill', '#00bb00');
    editor.finishColorPreview();
    assert.equal(model.getShapes()[0].strokeColor, '#aa0000');
    assert.equal(model.getShapes()[0].fillColor, '#00bb00');
    assert.equal(countUndo(history), 2);
    assert.equal(warn.mock.calls.length, 0);
});

test('ピッカー操作中に選択が変わると、先の図形の分を確定してから作り直す', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233'), makeRect('b', '#112233')], ['a']);
    editor.previewColor('stroke', '#aa0000');
    model.setSelection(['b']);
    editor.previewColor('stroke', '#bb0000');
    editor.finishColorPreview();
    assert.equal(model.getShapes()[0].strokeColor, '#aa0000');
    assert.equal(model.getShapes()[1].strokeColor, '#bb0000');
    assert.equal(countUndo(history), 2);
    assert.equal(warn.mock.calls.length, 0);
});

test('ピッカー操作中に図形が入れ替わる（replaceAllShapes）と、確定は記録せず捨てる。console.warnは出ない', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233')], ['a']);
    editor.previewColor('stroke', '#aa0000');
    const replaced = makeRect('a', '#778899');
    model.replaceAllShapes([replaced]);
    editor.finishColorPreview();
    assert.equal(model.getShapes()[0].strokeColor, '#778899');
    assert.equal(history.canUndo(), false);
    assert.equal(warn.mock.calls.length, 0);
});

test('ピッカー操作中に外部のbeginEdit/commitEdit（図形インスタンスはそのまま）が挟まっても、後の確定は1件として記録される。console.warnは出ない', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233', 3)], ['a']);
    editor.previewColor('stroke', '#aa0000');
    history.beginEdit();
    model.getShapes()[0].strokeWidth = 8;
    history.commitEdit();
    editor.finishColorPreview();
    assert.equal(model.getShapes()[0].strokeColor, '#aa0000');
    assert.equal(model.getShapes()[0].strokeWidth, 8);
    assert.equal(countUndo(history), 2);
    assert.equal(warn.mock.calls.length, 0);
});

test('ピッカー操作中にundoが起きても対が崩れない。console.warnは出ない', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233', 3)], ['a']);
    editor.setStrokeWidth('8');
    editor.previewColor('stroke', '#aa0000');
    history.undo();
    editor.finishColorPreview();
    assert.equal(model.getShapes()[0].strokeWidth, 3);
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(warn.mock.calls.length, 0);
});

test('選択なし：直前に使った値だけが変わり、図形・履歴は変わらない（setFillEnabledも受理）', () => {
    const { model, history, editor } = setup([makeRect('a'), makeLine('b')], []);
    const before = dump(model);
    assert.equal(editor.setStrokeEnabled(false), true);
    assert.equal(editor.setFillEnabled(true), true);
    assert.equal(editor.setStrokeWidth('6'), true);
    assert.equal(editor.commitColor('fill', '#123456'), true);
    assert.equal(editor.previewColor('stroke', '#654321'), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#654321', strokeWidth: 6, fillEnabled: true, fillColor: '#123456' });
});

test('直前に使った値：選択中にパネルで変えたとき、変えた項目だけが入る', () => {
    const { model, editor } = setup([makeRect('a', '#ff0000', 3, '#00ff00')], ['a']);
    const initial = model.getNewShapeStyle();
    editor.setStrokeEnabled(true);
    assert.deepEqual(model.getNewShapeStyle(), { ...initial, strokeEnabled: true });
    editor.setStrokeEnabled(false);
    assert.deepEqual(model.getNewShapeStyle(), { ...initial, strokeEnabled: false });
    editor.setFillEnabled(true);
    assert.deepEqual(model.getNewShapeStyle(), { ...initial, strokeEnabled: false, fillEnabled: true });
    editor.setStrokeWidth('9');
    assert.deepEqual(model.getNewShapeStyle(), { ...initial, strokeEnabled: false, fillEnabled: true, strokeWidth: 9 });
    editor.commitColor('stroke', '#0000ff');
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#0000ff', strokeWidth: 9, fillEnabled: true, fillColor: '#ffffff' });
    editor.commitColor('fill', '#ff00ff');
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#0000ff', strokeWidth: 9, fillEnabled: true, fillColor: '#ff00ff' });
});

test('直前に使った値：選ぶだけ・getPanelView()だけでは変わらない', () => {
    const shapes = [makeRect('a', '#ff0000', 9, '#00ff00'), makeEllipse('c')];
    const { model, editor } = setup(shapes, []);
    const initial = model.getNewShapeStyle();
    model.setSelection(['a']);
    editor.getPanelView();
    model.setSelection(['a', 'c']);
    editor.getPanelView();
    editor.getPanelView();
    assert.deepEqual(model.getNewShapeStyle(), initial);
    assert.equal(initial.strokeColor, '#000000');
    assert.equal(initial.strokeWidth, 2);
});

/**
 * idを直接代入した円を作る。
 * @param {string} id 代入するid
 * @returns {Ellipse} 円
 */
function makeEllipse(id) {
    const ellipse = new Ellipse(0, 0, 10, 10, 'circle', '#778899', 5, null);
    ellipse.id = id;
    return ellipse;
}

test('getPanelView: パネルが覚えている色を更新する。線なしにしても色の欄は直前の色のまま', () => {
    const { editor } = setup([makeRect('a', '#ff0000')], ['a']);
    assert.equal(editor.getPanelView().stroke.color, '#ff0000');
    editor.setStrokeEnabled(false);
    const view = editor.getPanelView();
    assert.equal(view.stroke.enabled, false);
    assert.equal(view.stroke.color, '#ff0000');
});

test('選択中の図形は描画順で扱われ、選択以外の図形は変わらない', () => {
    const { model, editor } = setup([makeRect('a', '#111111'), makeRect('b', '#222222'), makeRect('c', '#333333')], ['c', 'a']);
    editor.commitColor('stroke', '#abcdef');
    assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#abcdef', '#222222', '#abcdef']);
});

test('toggleStrokeEnabled・toggleFillEnabled（選択なし）：直前に使った値の有無だけが切り替わり、図形・履歴は変わらない', () => {
    const { model, history, editor } = setup([makeRect('a'), makeLine('b')], []);
    const before = dump(model);
    assert.equal(model.getNewShapeStyle().strokeEnabled, true);
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.equal(model.getNewShapeStyle().strokeEnabled, false);
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.equal(model.getNewShapeStyle().strokeEnabled, true);
    assert.equal(model.getNewShapeStyle().fillEnabled, false);
    assert.equal(editor.toggleFillEnabled(), true);
    assert.equal(model.getNewShapeStyle().fillEnabled, true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
});

test('toggleStrokeEnabled（単一選択）：線がnullになり1件で戻る。もう一度で表示中の色が入る', () => {
    const { model, history, editor } = setup([makeRect('a', '#ff0000')], ['a']);
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.equal(model.getShapes()[0].strokeColor, null);
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.equal(model.getShapes()[0].strokeColor, '#ff0000');
    assert.equal(countUndo(history), 2);
    const second = setup([makeRect('a', '#ff0000')], ['a']);
    second.editor.toggleStrokeEnabled();
    assert.equal(second.history.canUndo(), true);
    second.history.undo();
    assert.equal(second.model.getShapes()[0].strokeColor, '#ff0000');
    assert.equal(second.history.canUndo(), false);
    second.history.redo();
    assert.equal(second.model.getShapes()[0].strokeColor, null);
});

test('toggleStrokeEnabled（複数選択・そろっている）：両方nullになり1件', () => {
    const { model, history, editor } = setup([makeRect('a', '#111111'), makeRect('b', '#222222')], ['a', 'b']);
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.deepEqual(model.getShapes().map((s) => s.strokeColor), [null, null]);
    assert.equal(countUndo(history), 1);
});

test('toggleStrokeEnabled（複数選択・そろっていない）：両方線ありになり、色は表示中の色。1件', () => {
    const { model, history, editor } = setup([makeRect('a', null), makeRect('b', '#0000ff')], ['a', 'b']);
    assert.equal(editor.getPanelView().stroke.enabled, null);
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#0000ff', '#0000ff']);
    assert.equal(model.getNewShapeStyle().strokeEnabled, true);
    assert.equal(countUndo(history), 1);
});

test('toggleFillEnabled（塗れる形が無い選択）：false。図形・履歴・直前に使った値を変えない', () => {
    const { model, history, editor } = setup([makeLine('b')], ['b']);
    const before = dump(model);
    const style = model.getNewShapeStyle();
    assert.equal(editor.toggleFillEnabled(), false);
    assert.deepEqual(dump(model), before);
    assert.deepEqual(model.getNewShapeStyle(), style);
    assert.equal(history.canUndo(), false);
});

test('toggleFillEnabled（塗れる形と塗れない形が混ざった選択）(a)：塗りは塗れる形だけで決まり、OFFならONへ。塗れない形のfillColorは保持', () => {
    const { model, history, editor } = setup([makeRect('a', '#112233', 3, null), makeLine('b', '#445566', 4, '#abcdef')], ['a', 'b']);
    const shown = editor.getPanelView().fill;
    assert.equal(shown.enabled, false);
    assert.equal(editor.toggleFillEnabled(), true);
    const shapes = dump(model);
    assert.equal(shapes[0].fillColor, shown.color);
    assert.equal(shapes[1].fillColor, '#abcdef');
    assert.equal(countUndo(history), 1);
});

test('toggleFillEnabled（塗れる形と塗れない形が混ざった選択）(b)：ONと判定され、塗れる形がnullになる。塗れない形はnullのまま', () => {
    const { model, history, editor } = setup([makeRect('a', '#112233', 3, '#00ff00'), makeLine('b', '#445566', 4, null)], ['a', 'b']);
    assert.equal(editor.getPanelView().fill.enabled, true);
    assert.equal(editor.toggleFillEnabled(), true);
    const shapes = dump(model);
    assert.equal(shapes[0].fillColor, null);
    assert.equal(shapes[1].fillColor, null);
    assert.equal(countUndo(history), 1);
});

test('toggleStrokeEnabled：ピッカー操作中は先にピッカーの分が確定され、履歴は2件になる', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233')], ['a']);
    editor.previewColor('stroke', '#123456');
    assert.equal(editor.toggleStrokeEnabled(), true);
    assert.equal(model.getShapes()[0].strokeColor, null);
    history.undo();
    assert.equal(model.getShapes()[0].strokeColor, '#123456');
    history.undo();
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(history.canUndo(), false);
    assert.equal(warn.mock.calls.length, 0);
});

test('applyStyle: 線・塗り・太さの3項目を選択中の図形へ1件で当てる。塗れない形の塗りは変わらず、直前に使った値へも写る。undo/redoで往復する', () => {
    const { model, history, editor } = setup([makeRect('a'), makeLine('b'), makeRect('c')], ['a', 'b']);
    const before = dump(model);
    assert.equal(editor.applyStyle({ strokeColor: '#ff0000', fillColor: '#00ff00', strokeWidth: 9 }), true);
    const after = dump(model);
    assert.deepEqual([after[0].strokeColor, after[0].fillColor, after[0].strokeWidth], ['#ff0000', '#00ff00', 9]);
    assert.deepEqual([after[1].strokeColor, after[1].fillColor, after[1].strokeWidth], ['#ff0000', '#abcdef', 9]);
    assert.deepEqual(after[2], before[2]);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#ff0000', strokeWidth: 9, fillEnabled: true, fillColor: '#00ff00' });
    history.undo();
    assert.deepEqual(dump(model), before);
    history.redo();
    assert.deepEqual(dump(model), after);
    assert.equal(countUndo(history), 1);
});

test('applyStyle: 1項目だけ当てると、ほかの項目は図形も直前に使った値も変わらない', () => {
    const { model, editor } = setup([makeRect('a', '#112233', 3, '#445566')], ['a']);
    assert.equal(editor.applyStyle({ strokeWidth: 6 }), true);
    assert.deepEqual([model.getShapes()[0].strokeColor, model.getShapes()[0].fillColor, model.getShapes()[0].strokeWidth], ['#112233', '#445566', 6]);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#000000', strokeWidth: 6, fillEnabled: false, fillColor: '#ffffff' });
    assert.equal(editor.applyStyle({ fillColor: '#abcdef' }), true);
    assert.equal(model.getShapes()[0].fillColor, '#abcdef');
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(model.getNewShapeStyle().strokeWidth, 6);
    assert.equal(model.getNewShapeStyle().strokeColor, '#000000');
});

test('applyStyle: nullは線なし・塗りなし。直前に使った値は有無がfalseで色は保たれる', () => {
    const { model, editor } = setup([makeRect('a', '#112233', 3, '#445566')], ['a']);
    assert.equal(editor.applyStyle({ strokeColor: null, fillColor: null }), true);
    assert.equal(model.getShapes()[0].strokeColor, null);
    assert.equal(model.getShapes()[0].fillColor, null);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: false, strokeColor: '#000000', strokeWidth: 2, fillEnabled: false, fillColor: '#ffffff' });
});

test('applyStyle: 塗れない形だけの選択に塗りを当てても図形・履歴は変わらず、直前に使った値の塗りは更新される', () => {
    const { model, history, editor } = setup([makeLine('b')], ['b']);
    const before = dump(model);
    assert.equal(editor.applyStyle({ fillColor: '#123456' }), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
    assert.equal(model.getNewShapeStyle().fillEnabled, true);
    assert.equal(model.getNewShapeStyle().fillColor, '#123456');
});

test('applyStyle: 選択なしでは直前に使った値だけが変わり、図形・履歴は変わらない', () => {
    const { model, history, editor } = setup([makeRect('a')], []);
    const before = dump(model);
    assert.equal(editor.applyStyle({ strokeColor: '#ff0000', strokeWidth: 4 }), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#ff0000', strokeWidth: 4, fillEnabled: false, fillColor: '#ffffff' });
});

test('applyStyle: 前後が同じ値なら履歴に記録されない', () => {
    const { history, editor } = setup([makeRect('a', '#112233', 3, '#445566')], ['a']);
    assert.equal(editor.applyStyle({ strokeColor: '#112233', fillColor: '#445566', strokeWidth: 3 }), true);
    assert.equal(history.canUndo(), false);
});

test('applyStyle: 3項目のどれも持たない引数はfalseで、図形・履歴・直前に使った値を変えない', () => {
    const { model, history, editor } = setup([makeRect('a')], ['a']);
    const before = dump(model);
    const style = model.getNewShapeStyle();
    assert.equal(editor.applyStyle({}), false);
    assert.equal(editor.applyStyle({ other: 1 }), false);
    assert.deepEqual(dump(model), before);
    assert.deepEqual(model.getNewShapeStyle(), style);
    assert.equal(history.canUndo(), false);
});

test('applyStyle: ピッカー操作中の記録が先に確定され、履歴は2件になる。console.warnは出ない', (t) => {
    const warn = t.mock.method(console, 'warn', () => {});
    const { model, history, editor } = setup([makeRect('a', '#112233')], ['a']);
    editor.previewColor('stroke', '#123456');
    assert.equal(editor.applyStyle({ strokeColor: '#abcdef' }), true);
    assert.equal(model.getShapes()[0].strokeColor, '#abcdef');
    history.undo();
    assert.equal(model.getShapes()[0].strokeColor, '#123456');
    history.undo();
    assert.equal(model.getShapes()[0].strokeColor, '#112233');
    assert.equal(history.canUndo(), false);
    assert.equal(warn.mock.calls.length, 0);
});

test('resetColors: 選択中の線が黒・塗れる形の塗りが白になり、太さは不変。直前に使った値は線あり黒・塗りあり白で1件のundoで戻る', () => {
    const { model, history, editor } = setup([makeRect('a', '#ff0000', 7, '#00ff00'), makeLine('b', '#445566', 5, '#abcdef')], ['a', 'b']);
    const before = dump(model);
    assert.equal(editor.resetColors(), true);
    const after = dump(model);
    assert.deepEqual([after[0].strokeColor, after[0].fillColor, after[0].strokeWidth], ['#000000', '#ffffff', 7]);
    assert.deepEqual([after[1].strokeColor, after[1].fillColor, after[1].strokeWidth], ['#000000', '#abcdef', 5]);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#000000', strokeWidth: 2, fillEnabled: true, fillColor: '#ffffff' });
    history.undo();
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
});

test('resetColors: 塗れる形が無い選択でも、直前に使った値の塗りは塗りあり白になる', () => {
    const { model, editor } = setup([makeLine('b', '#445566', 5, '#abcdef')], ['b']);
    assert.equal(editor.resetColors(), true);
    assert.equal(model.getShapes()[0].strokeColor, '#000000');
    assert.equal(model.getShapes()[0].fillColor, '#abcdef');
    assert.equal(model.getNewShapeStyle().fillEnabled, true);
    assert.equal(model.getNewShapeStyle().fillColor, '#ffffff');
});

test('resetColors: 選択なしでは直前に使った値だけが変わり、図形・履歴は変わらない', () => {
    const { model, history, editor } = setup([makeRect('a', '#ff0000', 7, '#00ff00')], []);
    editor.setStrokeWidth('6');
    const before = dump(model);
    assert.equal(editor.resetColors(), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
    assert.deepEqual(model.getNewShapeStyle(), { strokeEnabled: true, strokeColor: '#000000', strokeWidth: 6, fillEnabled: true, fillColor: '#ffffff' });
});
