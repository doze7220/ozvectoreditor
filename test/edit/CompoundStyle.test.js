/**
 * 責務: 複合パスの中の図形へのスタイル変更（ShapeStyleEditor）とスポイト（StyleEyedropper）が一番下の図形へ読み替えられることを、
 * 実物のVectorModel・HistoryManager・SnapshotAdapterで検証する（取り消し後の複合パスの値は確かめない）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { StyleEyedropper } from '../../js/edit/StyleEyedropper.js';
import { buildStylePanelView } from '../../js/edit/StylePanelRules.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * idを付けた図形のアイテムを作る。
 * @param {string} id 図形のid
 * @param {Object} shape 図形
 * @param {Object} [states] `visible`・`locked`
 * @returns {Object} 図形のアイテム
 */
function s(id, shape, states = {}) {
    shape.id = id;
    return { kind: 'shape', shape, ...states };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] `compound`・`locked`など
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, extra = {}) {
    return { kind: 'group', id, children, ...extra };
}

/**
 * 矩形を作る。
 * @param {string|null} stroke 線の色
 * @param {number} width 線の太さ
 * @param {string|null} fill 塗りの色
 * @returns {Rect} 矩形
 */
function rect(stroke = '#111111', width = 2, fill = '#ff0000') {
    return new Rect(0, 0, 10, 10, stroke, width, fill);
}

/**
 * 実物を組み合わせる。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {Array<string>} [selected] 選択する図形のid
 * @returns {Object} モデル・履歴・エディタ・スポイト
 */
function setup(items, selected = []) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new ShapeStyleEditor({ model, editRecorder: history });
    const eyedropper = new StyleEyedropper({
        model,
        applyStyle: (style) => editor.applyStyle(style),
        getCompoundPaths: () => model.getCompoundPaths()
    });
    model.onChange(() => editor.getPanelView());
    model.setSelection(selected);
    return { model, history, editor, eyedropper };
}

/**
 * idで図形を引く。
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {Object} 図形
 */
function shapeOf(model, id) {
    return model.getShapes().find((shape) => shape.id === id);
}

/**
 * 図形のスタイル3つを取り出す。
 * @param {Object} shape 図形
 * @returns {{strokeColor: *, strokeWidth: number, fillColor: *}} スタイル
 */
function styleOf(shape) {
    return { strokeColor: shape.strokeColor, strokeWidth: shape.strokeWidth, fillColor: shape.fillColor };
}

/**
 * 一番下（base）と2つ目（top）を持つ複合パスの入れ子を作る。
 * @param {Object} [baseStates] baseの`visible`・`locked`
 * @returns {Array<Object>} アイテム
 */
function compoundItems(baseStates = {}) {
    return [g('c', [s('base', rect('#111111', 2, '#ff0000'), baseStates), s('top', rect('#222222', 5, '#00ff00'))], { compound: true })];
}

describe('複合パスのスタイル変更', () => {
    it('中の図形（2つ目）を選んで変えると一番下の図形だけが変わる', () => {
        const { model, editor } = setup(compoundItems(), ['top']);
        assert.equal(editor.setStrokeWidth('9'), true);
        assert.equal(shapeOf(model, 'base').strokeWidth, 9);
        assert.equal(shapeOf(model, 'top').strokeWidth, 5);
        editor.commitColor('stroke', '#abcdef');
        editor.commitColor('fill', '#123456');
        assert.equal(shapeOf(model, 'base').strokeColor, '#abcdef');
        assert.equal(shapeOf(model, 'base').fillColor, '#123456');
        assert.equal(shapeOf(model, 'top').strokeColor, '#222222');
        assert.equal(shapeOf(model, 'top').fillColor, '#00ff00');
        editor.setStrokeEnabled(false);
        editor.setFillEnabled(false);
        assert.equal(shapeOf(model, 'base').strokeColor, null);
        assert.equal(shapeOf(model, 'base').fillColor, null);
        assert.equal(shapeOf(model, 'top').strokeColor, '#222222');
    });

    it('getPanelView()は一番下の図形の値を表示する', () => {
        const { editor } = setup(compoundItems(), ['top']);
        const view = editor.getPanelView();
        assert.equal(view.stroke.color, '#111111');
        assert.equal(view.strokeWidth, 2);
        assert.equal(view.fill.color, '#ff0000');
        assert.equal(view.fill.enabled, true);
    });

    it('中の2つを選んでも一番下の1件で、履歴1件・取り消し1回で戻る', () => {
        const { model, history, editor } = setup(compoundItems(), ['base', 'top']);
        editor.setStrokeWidth('9');
        assert.equal(shapeOf(model, 'base').strokeWidth, 9);
        assert.equal(shapeOf(model, 'top').strokeWidth, 5);
        assert.equal(history.canUndo(), true);
        history.undo();
        assert.equal(shapeOf(model, 'base').strokeWidth, 2);
        assert.equal(history.canUndo(), false);
    });

    for (const [name, make] of [
        ['直線', () => new Line(0, 0, 10, 10, '#111111', 2, null)],
        ['開いたパス', () => new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false, '#111111', 2, null)]
    ]) {
        it(`一番下が塗れない形（${name}）でも塗りの欄が有効で fillColor が変わる`, () => {
            const items = [g('c', [s('base', make()), s('top', rect())], { compound: true })];
            const { model, editor } = setup(items, ['top']);
            assert.equal(editor.getPanelView().fill.disabled, false);
            assert.equal(editor.commitColor('fill', '#123456'), true);
            assert.equal(shapeOf(model, 'base').fillColor, '#123456');
        });
    }

    it('一番下がロックされていると変わらず表示も選択なしと同じ', () => {
        const { model, history, editor } = setup(compoundItems({ locked: true }), ['top']);
        const view = editor.getPanelView();
        const expected = buildStylePanelView({
            selectedShapes: [],
            newShapeStyle: model.getNewShapeStyle(),
            rememberedColors: { stroke: view.stroke.color, fill: view.fill.color }
        });
        assert.deepEqual(view, expected);
        editor.setStrokeWidth('9');
        assert.equal(shapeOf(model, 'base').strokeWidth, 2);
        assert.equal(shapeOf(model, 'top').strokeWidth, 5);
        assert.equal(history.canUndo(), false);
    });

    it('フォルダの外の図形と一緒に選ぶと両方に当たる（外は塗れる形だけ塗り）', () => {
        const items = [...compoundItems(), s('outRect', rect('#333333', 3, null)), s('outLine', new Line(0, 0, 5, 5, '#444444', 3, null))];
        const { model, history, editor } = setup(items, ['top', 'outRect', 'outLine']);
        editor.applyStyle({ strokeWidth: 7, fillColor: '#abcdef' });
        assert.equal(shapeOf(model, 'base').strokeWidth, 7);
        assert.equal(shapeOf(model, 'base').fillColor, '#abcdef');
        assert.equal(shapeOf(model, 'top').strokeWidth, 5);
        assert.equal(shapeOf(model, 'outRect').strokeWidth, 7);
        assert.equal(shapeOf(model, 'outRect').fillColor, '#abcdef');
        assert.equal(shapeOf(model, 'outLine').strokeWidth, 7);
        assert.equal(shapeOf(model, 'outLine').fillColor, null);
        history.undo();
        assert.equal(shapeOf(model, 'base').strokeWidth, 2);
        assert.equal(shapeOf(model, 'outRect').strokeWidth, 3);
        assert.equal(history.canUndo(), false);
    });

    it('一番下を隠すと次の図形に当たる', () => {
        const { model, editor } = setup(compoundItems({ visible: false }), ['top']);
        editor.setStrokeWidth('9');
        assert.equal(shapeOf(model, 'top').strokeWidth, 9);
        assert.equal(shapeOf(model, 'base').strokeWidth, 2);
    });

    it('中のフォルダの図形も外側の一番下へ当たる', () => {
        const items = [g('c', [s('base', rect()), g('inner', [s('deep', rect('#222222', 5, '#00ff00'))])], { compound: true })];
        const { model, editor } = setup(items, ['deep']);
        editor.setStrokeWidth('9');
        assert.equal(shapeOf(model, 'base').strokeWidth, 9);
        assert.equal(shapeOf(model, 'deep').strokeWidth, 5);
    });

    it('ピッカーの操作中も一番下の図形に1件で記録される', () => {
        const { model, history, editor } = setup(compoundItems(), ['top']);
        editor.previewColor('fill', '#111111');
        editor.previewColor('fill', '#222222');
        assert.equal(shapeOf(model, 'base').fillColor, '#222222');
        assert.equal(shapeOf(model, 'top').fillColor, '#00ff00');
        editor.commitColor('fill', '#333333');
        assert.equal(shapeOf(model, 'base').fillColor, '#333333');
        history.undo();
        assert.equal(shapeOf(model, 'base').fillColor, '#ff0000');
        assert.equal(history.canUndo(), false);
    });

    it('resetColors() も一番下へ', () => {
        const { model, editor } = setup(compoundItems(), ['top']);
        editor.resetColors();
        assert.equal(shapeOf(model, 'base').strokeColor, '#000000');
        assert.equal(shapeOf(model, 'base').fillColor, '#ffffff');
        assert.equal(shapeOf(model, 'top').strokeColor, '#222222');
        assert.equal(shapeOf(model, 'top').fillColor, '#00ff00');
    });

    it('buildStylePanelViewのfillableShapesを省いた結果は今と同じ', () => {
        const shapes = [rect('#111111', 2, '#ff0000'), new Line(0, 0, 1, 1, '#222222', 2, '#00ff00')];
        const base = {
            newShapeStyle: { strokeEnabled: true, strokeColor: '#000000', strokeWidth: 2, fillEnabled: false, fillColor: '#ffffff' },
            rememberedColors: { stroke: '#000000', fill: '#ffffff' }
        };
        assert.deepEqual(
            buildStylePanelView({ selectedShapes: shapes, ...base }),
            buildStylePanelView({ selectedShapes: shapes, fillableShapes: [shapes[0]], ...base })
        );
    });
});

describe('複合パスのスポイト', () => {
    it('中の図形から拾うと一番下の図形のスタイル（塗れない形の fillColor も）を拾う', () => {
        const base = new Line(0, 0, 10, 10, '#111111', 4, '#abcdef');
        const items = [g('c', [s('base', base), s('top', rect())], { compound: true }), s('target', rect('#555555', 1, null))];
        const { model, eyedropper } = setup(items, ['target']);
        eyedropper.start();
        assert.equal(eyedropper.pickFrom('top'), true);
        assert.deepEqual(styleOf(shapeOf(model, 'target')), { strokeColor: '#111111', strokeWidth: 4, fillColor: '#abcdef' });
    });

    it('当てる先に中の図形があれば一番下に当たる', () => {
        const items = [...compoundItems(), s('src', rect('#555555', 8, '#777777'))];
        const { model, eyedropper } = setup(items, ['top']);
        eyedropper.start();
        eyedropper.pickFrom('src');
        assert.deepEqual(styleOf(shapeOf(model, 'base')), { strokeColor: '#555555', strokeWidth: 8, fillColor: '#777777' });
        assert.deepEqual(styleOf(shapeOf(model, 'top')), { strokeColor: '#222222', strokeWidth: 5, fillColor: '#00ff00' });
    });

    it('複合パスでない図形から拾う結果は今と同じ', () => {
        const line = new Line(0, 0, 10, 10, '#111111', 4, '#abcdef');
        const items = [s('line', line), s('target', rect('#555555', 1, '#999999'))];
        const { model, eyedropper } = setup(items, ['target']);
        eyedropper.start();
        eyedropper.pickFrom('line');
        assert.deepEqual(styleOf(shapeOf(model, 'target')), { strokeColor: '#111111', strokeWidth: 4, fillColor: '#999999' });
    });
});
