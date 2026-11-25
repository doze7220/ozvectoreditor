/**
 * 責務: 結合・色と線と塗り・スポイトの対象が「変えられる図形」（隠れてもロックされてもいない図形）だけになることを、実物のVectorModelで検証する。
 * PathJoiner・ShapeStyleEditor・StyleEyedropperを通して確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { StyleEyedropper } from '../../js/edit/StyleEyedropper.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した矩形（線あり・塗りなし）を作る。
 * @param {string} id 代入するid
 * @returns {Rect} 矩形
 */
function box(id) {
    const rect = new Rect(0, 0, 10, 10, '#112233', 3, null);
    rect.id = id;
    return rect;
}

/**
 * idを直接代入した水平な直線を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点x
 * @param {number} x2 終点x
 * @returns {Line} 直線
 */
function seg(id, x1, x2) {
    const line = new Line(x1, 0, x2, 0, '#445566', 2);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @param {boolean} [visible] 表示
 * @param {boolean} [locked] ロック
 * @returns {Object} 図形のアイテム
 */
function item(shape, visible = true, locked = false) {
    return { kind: 'shape', shape, name: shape.id, visible, locked };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @param {Array<Object>} children 中身
 * @returns {Object} フォルダのアイテム
 */
function folder(id, visible, locked, children) {
    return { kind: 'group', id, name: id, visible, locked, children };
}

/**
 * 実物のモデル・履歴と3つのクラスを組み合わせる。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {Array<string>} selectedIds 選択する図形のid
 * @returns {Object} 組み合わせた実物
 */
function setup(items, selectedIds) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const style = new ShapeStyleEditor({ model, editRecorder: history });
    model.onChange(() => style.getPanelView());
    model.setSelection(selectedIds);
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    const applied = [];
    const eyedropper = new StyleEyedropper({
        model,
        applyStyle: (value) => { applied.push(value); return style.applyStyle(value); }
    });
    return { model, history, style, joiner, eyedropper, applied };
}

/**
 * 図形のidから図形を引く。
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {Object|undefined} 図形
 */
function shapeOf(model, id) {
    return model.getShapes().find((s) => s.id === id);
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

/**
 * 混ざった入力（a=変えられる・b=ロック・c=隠れ・d=変えられる）のアイテムを作る。
 * @returns {Array<Object>} アイテムの入れ子
 */
function mixedItems() {
    return [
        item(box('a')),
        item(box('b'), true, true),
        item(box('c'), false, false),
        item(box('d'))
    ];
}

describe('色・太さ・有無（ShapeStyleEditor）: 変えられるものだけ', () => {
    it('混ざったとき: 線の色・太さ・有無・Dが変えられる図形だけに反映される', () => {
        const { model, history, style } = setup(mixedItems(), ['a', 'b', 'c', 'd']);
        assert.equal(style.applyStyle({ strokeColor: '#ff0000', strokeWidth: 9 }), true);
        assert.deepEqual(model.getShapes().map((s) => [s.strokeColor, s.strokeWidth]), [
            ['#ff0000', 9], ['#112233', 3], ['#112233', 3], ['#ff0000', 9]
        ]);
        assert.equal(style.setStrokeWidth('5'), true);
        assert.deepEqual(model.getShapes().map((s) => s.strokeWidth), [5, 3, 3, 5]);
        assert.equal(style.setStrokeEnabled(false), true);
        assert.deepEqual(model.getShapes().map((s) => s.strokeColor), [null, '#112233', '#112233', null]);
        assert.equal(style.resetColors(), true);
        assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#000000', '#112233', '#112233', '#000000']);
        assert.deepEqual(model.getShapes().map((s) => s.fillColor), ['#ffffff', null, null, '#ffffff']);
        assert.equal(countUndo(history), 4);
    });

    it('混ざったとき: ピッカーのプレビューと確定が変えられる図形だけに働き、1件で記録される', () => {
        const { model, history, style } = setup(mixedItems(), ['a', 'b', 'c', 'd']);
        assert.equal(style.previewColor('stroke', '#ff0000'), true);
        assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#ff0000', '#112233', '#112233', '#ff0000']);
        assert.equal(style.commitColor('stroke', '#00ff00'), true);
        assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#00ff00', '#112233', '#112233', '#00ff00']);
        assert.equal(countUndo(history), 1);
        assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#112233', '#112233', '#112233', '#112233']);
    });

    it('混ざったとき: 塗りの有無・色も変えられる図形だけに反映される', () => {
        const { model, style } = setup(mixedItems(), ['a', 'b', 'c', 'd']);
        assert.equal(style.setFillEnabled(true), true);
        assert.deepEqual(model.getShapes().map((s) => s.fillColor !== null), [true, false, false, true]);
        assert.equal(style.commitColor('fill', '#abcdef'), true);
        assert.deepEqual(model.getShapes().map((s) => s.fillColor), ['#abcdef', null, null, '#abcdef']);
    });

    it('変えられないものだけのとき: 図形は変わらず記録なし、直前に使った値だけが変わり、表示は選択なしと同じ', () => {
        const locked = setup(mixedItems(), ['b', 'c']);
        const none = setup(mixedItems(), []);
        const before = locked.model.getShapes().map((s) => s.toJSON());
        assert.deepEqual(locked.style.getPanelView(), none.style.getPanelView());

        assert.equal(locked.style.applyStyle({ strokeColor: '#ff0000', strokeWidth: 9 }), true);
        assert.equal(locked.style.setStrokeWidth('7'), true);
        assert.equal(locked.style.setStrokeEnabled(false), true);
        assert.equal(locked.style.commitColor('stroke', '#00ff00'), true);
        assert.deepEqual(locked.model.getShapes().map((s) => s.toJSON()), before);
        assert.equal(locked.history.canUndo(), false);
        assert.equal(locked.model.getNewShapeStyle().strokeWidth, 7);
        assert.equal(locked.model.getNewShapeStyle().strokeColor, '#00ff00');

        none.style.applyStyle({ strokeColor: '#ff0000', strokeWidth: 9 });
        none.style.setStrokeWidth('7');
        none.style.setStrokeEnabled(false);
        none.style.commitColor('stroke', '#00ff00');
        assert.deepEqual(locked.model.getNewShapeStyle(), none.model.getNewShapeStyle());
        assert.deepEqual(locked.style.getPanelView(), none.style.getPanelView());
    });

    it('フォルダから受け継いだとき: 隠れたフォルダ・ロックしたフォルダの中の図形は変わらず、変えられるフォルダの中は変わる', () => {
        const { model, history, style } = setup([
            folder('g1', false, false, [item(box('a'))]),
            folder('g2', true, true, [item(box('b'))]),
            folder('g3', true, false, [item(box('c'))])
        ], ['a', 'b', 'c']);
        assert.equal(style.applyStyle({ strokeColor: '#ff0000' }), true);
        assert.deepEqual(model.getShapes().map((s) => s.strokeColor), ['#112233', '#112233', '#ff0000']);
        assert.equal(countUndo(history), 1);
    });

    it('プレビューの後にロックしても、変えられる間に付けた色を1件として記録し終える', () => {
        const { model, history, style } = setup([item(box('a')), item(box('d'))], ['a']);
        assert.equal(style.previewColor('stroke', '#ff0000'), true);
        assert.equal(model.setItemStates([{ id: 'a', locked: true }]), true);
        style.finishColorPreview();
        assert.equal(shapeOf(model, 'a').strokeColor, '#ff0000');
        assert.equal(countUndo(history), 1);
        assert.equal(shapeOf(model, 'a').strokeColor, '#112233');
    });
});

describe('スポイト（StyleEyedropper）: 変えられない図形を拾わない', () => {
    it('変えられる図形は拾え、手本のスタイルが選択中の変えられる図形へ反映される', () => {
        const sample = new Rect(0, 0, 10, 10, '#abcdef', 8, null);
        sample.id = 's';
        const { model, eyedropper } = setup([item(box('a')), item(sample)], ['a']);
        eyedropper.start();
        assert.equal(eyedropper.pickFrom('s'), true);
        assert.equal(eyedropper.isPicking(), false);
        assert.equal(shapeOf(model, 'a').strokeColor, '#abcdef');
        assert.equal(shapeOf(model, 'a').strokeWidth, 8);
    });

    it('ロックした図形・隠れた図形・フォルダから受け継いだ図形は拾えず、待ち受けは続き何も反映しない', () => {
        const { eyedropper, applied, history } = setup([
            item(box('a')),
            item(box('b'), true, true),
            item(box('c'), false, false),
            folder('g1', false, false, [item(box('d'))]),
            folder('g2', true, true, [item(box('e'))])
        ], ['a']);
        eyedropper.start();
        for (const id of ['b', 'c', 'd', 'e']) {
            assert.equal(eyedropper.pickFrom(id), false);
            assert.equal(eyedropper.isPicking(), true);
        }
        assert.equal(applied.length, 0);
        assert.equal(history.canUndo(), false);
    });
});

describe('結合（PathJoiner）: 変えられる線だけが対象', () => {
    it('変えられる2本＋ロック1本の選択は、変えられる2本の結合になる（ロックした線は残る）', () => {
        const { model, history, joiner } = setup([
            item(seg('a', 0, 10)),
            item(seg('b', 10, 20)),
            item(seg('c', 20, 30), true, true)
        ], ['a', 'b', 'c']);
        assert.equal(joiner.canJoin(), true);
        assert.equal(joiner.join(), true);
        assert.equal(model.getShapes().length, 2);
        assert.ok(shapeOf(model, 'c'));
        assert.equal(shapeOf(model, 'a'), undefined);
        assert.equal(shapeOf(model, 'b'), undefined);
        assert.equal(countUndo(history), 1);
    });

    it('ロックした線と変えられる線の2本では結合できない（canJoinも偽・記録なし）', () => {
        const { model, history, joiner } = setup([
            item(seg('a', 0, 10)),
            item(seg('b', 10, 20), true, true)
        ], ['a', 'b']);
        assert.equal(joiner.canJoin(), false);
        assert.equal(joiner.join(), false);
        assert.equal(model.getShapes().length, 2);
        assert.equal(history.canUndo(), false);
    });

    it('隠れた線・隠れたフォルダの中の線も対象にならない', () => {
        const { model, history, joiner } = setup([
            item(seg('a', 0, 10)),
            item(seg('b', 10, 20), false, false),
            folder('g', false, false, [item(seg('c', 20, 30))])
        ], ['a', 'b', 'c']);
        assert.equal(joiner.canJoin(), false);
        assert.equal(joiner.join(), false);
        assert.equal(model.getShapes().length, 3);
        assert.equal(history.canUndo(), false);
    });
});
