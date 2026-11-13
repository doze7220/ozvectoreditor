/**
 * 責務: StyleEyedropper（スポイトの待ち受けの状態・通知・取り込みの手順）の振る舞いを検証する。
 * 偽物のmodel・applyStyleでの単体の確認と、実物のVectorModel・ShapeStyleEditor・SnapshotAdapter・HistoryManagerとの組み合わせを確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { StyleEyedropper } from '../../js/edit/StyleEyedropper.js';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { sampleStyleFromShape } from '../../js/edit/StylePanelRules.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @param {string|null} stroke 線の色
 * @param {number} width 線の太さ
 * @param {string|null} fill 塗りの色
 * @returns {Rect} 矩形
 */
function makeRect(id, stroke, width, fill) {
    const rect = new Rect(0, 0, 10, 10, stroke, width, fill);
    rect.id = id;
    return rect;
}

/**
 * idを直接代入した直線（塗れない形）を作る。
 * @param {string} id 代入するid
 * @param {string|null} stroke 線の色
 * @param {number} width 線の太さ
 * @param {string|null} fill 保持している塗りの色
 * @returns {Line} 直線
 */
function makeLine(id, stroke, width, fill) {
    const line = new Line(0, 0, 10, 10, stroke, width, fill);
    line.id = id;
    return line;
}

/**
 * 偽物のmodel・applyStyleでStyleEyedropperを作る。
 * @param {Array<Object>} shapes 偽物のmodelが返す図形一式
 * @returns {{ eyedropper: StyleEyedropper, applied: Array<Object>, notified: { count: number } }} 組み合わせ
 */
function setupFake(shapes) {
    const applied = [];
    const notified = { count: 0 };
    const eyedropper = new StyleEyedropper({
        model: { getShapes: () => shapes },
        applyStyle: (style) => { applied.push(style); return true; }
    });
    eyedropper.onChange(() => { notified.count += 1; });
    return { eyedropper, applied, notified };
}

/**
 * 実物のVectorModel・ShapeStyleEditor・SnapshotAdapter・HistoryManager・StyleEyedropperを組み合わせる。
 * @param {Array<Object>} shapes 入れる図形（描画順。idは代入済み）
 * @param {Array<string>} selectedIds 選択するid
 * @returns {{ model: VectorModel, history: HistoryManager, eyedropper: StyleEyedropper }} 組み合わせた実物
 */
function setupReal(shapes, selectedIds) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new ShapeStyleEditor({ model, editRecorder: history });
    const eyedropper = new StyleEyedropper({ model, applyStyle: (style) => editor.applyStyle(style) });
    model.setSelection(selectedIds);
    return { model, history, eyedropper };
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

test('コンストラクタ: applyStyleが関数でなければErrorをthrowする', () => {
    assert.throws(() => new StyleEyedropper({ model: { getShapes: () => [] } }), Error);
    assert.throws(() => new StyleEyedropper({ model: { getShapes: () => [] }, applyStyle: 1 }), Error);
});

test('初期状態は待ち受けでない', () => {
    const { eyedropper, notified } = setupFake([]);
    assert.equal(eyedropper.isPicking(), false);
    assert.equal(notified.count, 0);
});

test('start: 待ち受けになり通知1回でtrue。待ち受け中のstartは通知なしでfalse', () => {
    const { eyedropper, notified } = setupFake([]);
    assert.equal(eyedropper.start(), true);
    assert.equal(eyedropper.isPicking(), true);
    assert.equal(notified.count, 1);
    assert.equal(eyedropper.start(), false);
    assert.equal(eyedropper.isPicking(), true);
    assert.equal(notified.count, 1);
});

test('stop: 待ち受けをやめ通知1回でtrue。待ち受けでないstopは通知なしでfalse', () => {
    const { eyedropper, notified } = setupFake([]);
    assert.equal(eyedropper.stop(), false);
    assert.equal(notified.count, 0);
    eyedropper.start();
    assert.equal(eyedropper.stop(), true);
    assert.equal(eyedropper.isPicking(), false);
    assert.equal(notified.count, 2);
});

test('pickFrom: 待ち受けでなければapplyStyleを呼ばずfalse', () => {
    const { eyedropper, applied, notified } = setupFake([makeRect('a', '#111111', 2, '#222222')]);
    assert.equal(eyedropper.pickFrom('a'), false);
    assert.equal(applied.length, 0);
    assert.equal(notified.count, 0);
});

test('pickFrom: 存在しないidは例外にならずfalse。待ち受けは続き通知もしない', () => {
    const { eyedropper, applied, notified } = setupFake([makeRect('a', '#111111', 2, '#222222')]);
    eyedropper.start();
    assert.equal(eyedropper.pickFrom('zzz'), false);
    assert.equal(eyedropper.isPicking(), true);
    assert.equal(applied.length, 0);
    assert.equal(notified.count, 1);
});

test('pickFrom: 存在するidはsampleStyleFromShapeの結果でapplyStyleを1回呼び、待ち受けが解け、通知1回でtrue', () => {
    const rect = makeRect('a', '#111111', 2.5, '#222222');
    const { eyedropper, applied, notified } = setupFake([rect]);
    eyedropper.start();
    assert.equal(eyedropper.pickFrom('a'), true);
    assert.equal(applied.length, 1);
    assert.deepEqual(applied[0], sampleStyleFromShape(rect));
    assert.equal(eyedropper.isPicking(), false);
    assert.equal(notified.count, 2);
});

test('cancelPicking: 待ち受け中はtrueでfallbackを呼ばず待ち受けをやめる', () => {
    const { eyedropper } = setupFake([]);
    eyedropper.start();
    let called = 0;
    assert.equal(eyedropper.cancelPicking(() => { called += 1; return false; }), true);
    assert.equal(called, 0);
    assert.equal(eyedropper.isPicking(), false);
});

test('cancelPicking: 待ち受けでなければfallbackを呼びその戻り値を返す', () => {
    const { eyedropper } = setupFake([]);
    let called = 0;
    assert.equal(eyedropper.cancelPicking(() => { called += 1; return true; }), true);
    assert.equal(eyedropper.cancelPicking(() => { called += 1; return false; }), false);
    assert.equal(called, 2);
});

test('onChange: 関数以外を渡しても例外にならず、通知にも影響しない', () => {
    const { eyedropper, notified } = setupFake([]);
    assert.doesNotThrow(() => eyedropper.onChange(null));
    assert.doesNotThrow(() => eyedropper.onChange('x'));
    eyedropper.start();
    assert.equal(notified.count, 1);
});

test('実物: 選択ありで取り込むと選択中の図形と直前に使った値が変わり、待ち受けが解け、履歴1件でundoで戻る', () => {
    const { model, history, eyedropper } = setupReal([
        makeRect('a', '#111111', 2, null),
        makeRect('b', '#aa0000', 7, '#00bb00'),
        makeRect('c', '#333333', 1, null)
    ], ['a', 'c']);
    eyedropper.start();
    assert.equal(eyedropper.pickFrom('b'), true);
    assert.equal(eyedropper.isPicking(), false);
    for (const id of ['a', 'c']) {
        const shape = model.getShapes().find((s) => s.id === id);
        assert.equal(shape.strokeColor, '#aa0000');
        assert.equal(shape.strokeWidth, 7);
        assert.equal(shape.fillColor, '#00bb00');
    }
    const style = model.getNewShapeStyle();
    assert.equal(style.strokeColor, '#aa0000');
    assert.equal(style.strokeWidth, 7);
    assert.equal(style.fillEnabled, true);
    assert.equal(style.fillColor, '#00bb00');
    assert.equal(countUndo(history), 1);
    assert.equal(model.getShapes().find((s) => s.id === 'a').strokeColor, '#111111');
});

test('実物: 選択なしで取り込むと直前に使った値だけが変わり、図形・履歴は変わらない', () => {
    const { model, history, eyedropper } = setupReal([
        makeRect('a', '#111111', 2, null),
        makeRect('b', '#aa0000', 7, '#00bb00')
    ], []);
    eyedropper.start();
    assert.equal(eyedropper.pickFrom('b'), true);
    assert.equal(model.getShapes().find((s) => s.id === 'a').strokeColor, '#111111');
    assert.equal(model.getNewShapeStyle().strokeColor, '#aa0000');
    assert.equal(model.getNewShapeStyle().strokeWidth, 7);
    assert.equal(history.canUndo(), false);
});

test('実物: 塗れない形を手本にすると塗りは変わらない（線・太さは変わる）', () => {
    const { model, eyedropper } = setupReal([
        makeRect('a', '#111111', 2, '#222222'),
        makeLine('l', '#00aa00', 9, '#abcdef')
    ], ['a']);
    const before = model.getNewShapeStyle();
    eyedropper.start();
    assert.equal(eyedropper.pickFrom('l'), true);
    const rect = model.getShapes().find((s) => s.id === 'a');
    assert.equal(rect.strokeColor, '#00aa00');
    assert.equal(rect.strokeWidth, 9);
    assert.equal(rect.fillColor, '#222222');
    const after = model.getNewShapeStyle();
    assert.equal(after.fillEnabled, before.fillEnabled);
    assert.equal(after.fillColor, before.fillColor);
});
