/**
 * 責務: VectorModel の新しく描く図形のスタイル（直前に使った値）・startDraftでの適用・updateShapeStylesの振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { SHAPE_TYPES } from '../../js/core/ShapeFactory.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * 通知回数を数えるリスナーを登録した空のモデルを作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function createModel() {
    const model = new VectorModel();
    let count = 0;
    model.onChange(() => {
        count++;
    });
    return { model, notifyCount: () => count };
}

/**
 * 指定したidとスタイルの直線を作る。
 * @param {string} id 図形id
 * @param {string|null} strokeColor 線の色
 * @param {number} strokeWidth 線の太さ
 * @returns {Line} 直線
 */
function createLine(id, strokeColor, strokeWidth) {
    const line = new Line(0, 0, 10, 10, strokeColor, strokeWidth);
    line.id = id;
    return line;
}

/**
 * 図形種別を指定して作成途中の図形を作り、確定する。
 * @param {VectorModel} model 対象のモデル
 * @param {string} type 図形種別
 * @returns {Object} 確定した図形
 */
function drawAndCommit(model, type) {
    model.startDraft(0, 0, type);
    model.updateDraft(20, 20);
    model.commitDraft();
    const shapes = model.getShapes();
    return shapes[shapes.length - 1];
}

test('直前に使った値は既定値で始まり、コピーを返す', () => {
    const { model } = createModel();
    assert.deepEqual(model.getNewShapeStyle(), {
        strokeEnabled: true,
        strokeColor: '#000000',
        strokeWidth: 2,
        fillEnabled: false,
        fillColor: '#ffffff',
    });
    const copy = model.getNewShapeStyle();
    copy.strokeWidth = 99;
    assert.equal(model.getNewShapeStyle().strokeWidth, 2);
});

test('updateNewShapeStyle: 部分更新と通知（変わらなければ通知しない・未知のキーは無視）', () => {
    const { model, notifyCount } = createModel();
    assert.equal(model.updateNewShapeStyle({ strokeWidth: 5 }), true);
    assert.equal(notifyCount(), 1);
    assert.equal(model.getNewShapeStyle().strokeWidth, 5);
    assert.equal(model.getNewShapeStyle().strokeColor, '#000000');

    assert.equal(model.updateNewShapeStyle({ strokeWidth: 5 }), false);
    assert.equal(model.updateNewShapeStyle({ unknown: 1 }), false);
    assert.equal(model.updateNewShapeStyle({}), false);
    assert.equal(notifyCount(), 1);
    assert.equal('unknown' in model.getNewShapeStyle(), false);

    assert.equal(model.updateNewShapeStyle({ strokeColor: '#ff0000', fillEnabled: true, unknown: 1 }), true);
    assert.equal(notifyCount(), 2);
    assert.equal(model.getNewShapeStyle().strokeColor, '#ff0000');
    assert.equal(model.getNewShapeStyle().fillEnabled, true);
});

test('replaceAllShapesは直前に使った値を変えない', () => {
    const { model } = createModel();
    model.updateNewShapeStyle({ strokeWidth: 7, fillEnabled: true, fillColor: '#00ff00' });
    const before = model.getNewShapeStyle();
    model.replaceAllShapes([createLine('a', '#111111', 3)]);
    assert.deepEqual(model.getNewShapeStyle(), before);
});

for (const type of SHAPE_TYPES) {
    test(`startDraft(${type}): 既定のままなら線あり#000000・2px・塗りなし（作成途中・確定後）`, () => {
        const { model } = createModel();
        model.startDraft(0, 0, type);
        const draft = model.getDraftShape();
        assert.equal(draft.strokeColor, '#000000');
        assert.equal(draft.strokeWidth, 2);
        assert.equal(draft.fillColor, null);
        model.updateDraft(20, 20);
        model.commitDraft();
        const shape = model.getShapes()[0];
        assert.equal(shape.strokeColor, '#000000');
        assert.equal(shape.strokeWidth, 2);
        assert.equal(shape.fillColor, null);
    });

    test(`startDraft(${type}): 直前に使った値を変えた後のスタイルが当たる（作成途中・確定後）`, () => {
        const { model } = createModel();
        model.updateNewShapeStyle({ strokeEnabled: false, strokeWidth: 5, fillEnabled: true, fillColor: '#ff0000' });
        model.startDraft(0, 0, type);
        const draft = model.getDraftShape();
        assert.equal(draft.strokeColor, null);
        assert.equal(draft.strokeWidth, 5);
        assert.equal(draft.fillColor, '#ff0000');
        model.updateDraft(20, 20);
        model.commitDraft();
        const shape = model.getShapes()[0];
        assert.equal(shape.strokeColor, null);
        assert.equal(shape.strokeWidth, 5);
        assert.equal(shape.fillColor, '#ff0000');
    });
}

test('作成途中に直前に使った値を変えると、作成途中の図形も変わり、確定した図形は確定時点の値になる', () => {
    const { model } = createModel();
    model.startDraft(0, 0, SHAPE_TYPES[0]);
    model.updateNewShapeStyle({ strokeColor: '#123456', strokeWidth: 9 });
    const draft = model.getDraftShape();
    assert.equal(draft.strokeColor, '#123456');
    assert.equal(draft.strokeWidth, 9);
    model.commitDraft();
    assert.equal(model.getShapes()[0].strokeColor, '#123456');
    assert.equal(model.getShapes()[0].strokeWidth, 9);
});

test('以前に確定した図形は直前に使った値を変えても変わらない', () => {
    const { model } = createModel();
    const shape = drawAndCommit(model, SHAPE_TYPES[0]);
    model.updateNewShapeStyle({ strokeWidth: 8 });
    assert.equal(shape.strokeWidth, 2);
});

test('updateShapeStyles: 指定したキーだけ・指定した図形だけに代入し、通知は1回', () => {
    const { model, notifyCount } = createModel();
    model.replaceAllShapes([createLine('a', '#111111', 3), createLine('b', '#222222', 4), createLine('c', '#333333', 5)]);
    const base = notifyCount();
    const count = model.updateShapeStyles([
        { id: 'a', style: { strokeColor: '#ff0000' } },
        { id: 'b', style: { strokeWidth: 9, fillColor: '#00ff00' } },
    ]);
    assert.equal(count, 2);
    assert.equal(notifyCount() - base, 1);
    const [a, b, c] = model.getShapes();
    assert.equal(a.strokeColor, '#ff0000');
    assert.equal(a.strokeWidth, 3);
    assert.equal(a.fillColor, null);
    assert.equal(b.strokeColor, '#222222');
    assert.equal(b.strokeWidth, 9);
    assert.equal(b.fillColor, '#00ff00');
    assert.equal(c.strokeColor, '#333333');
    assert.equal(c.strokeWidth, 5);
});

test('updateShapeStyles: nullの代入・存在しないidの無視・0件なら通知しない・スタイル以外のキーを無視', () => {
    const { model, notifyCount } = createModel();
    model.replaceAllShapes([createLine('a', '#111111', 3)]);
    const base = notifyCount();

    assert.equal(model.updateShapeStyles([{ id: 'zzz', style: { strokeWidth: 9 } }]), 0);
    assert.equal(model.updateShapeStyles([]), 0);
    assert.equal(notifyCount() - base, 0);

    assert.equal(model.updateShapeStyles([
        { id: 'a', style: { strokeColor: null, id: 'hacked', x1: 999 } },
        { id: 'zzz', style: { strokeWidth: 9 } },
    ]), 1);
    assert.equal(notifyCount() - base, 1);
    const a = model.getShapes()[0];
    assert.equal(a.strokeColor, null);
    assert.equal(a.id, 'a');
    assert.equal(a.x1, 0);
});

test('updateShapeStyles: 選択集合・ホバー・直前に使った値・作成途中の図形に触れない', () => {
    const { model } = createModel();
    model.replaceAllShapes([createLine('a', '#111111', 3), createLine('b', '#222222', 4)]);
    model.setSelection(['a']);
    model.setHovered('b');
    const style = model.getNewShapeStyle();
    model.startDraft(0, 0, SHAPE_TYPES[0]);
    const draft = model.getDraftShape();
    model.updateShapeStyles([{ id: 'a', style: { strokeColor: '#ff0000', strokeWidth: 9 } }]);
    assert.deepEqual(model.getSelectedIds(), ['a']);
    assert.equal(model.getHoveredId(), 'b');
    assert.deepEqual(model.getNewShapeStyle(), style);
    assert.equal(model.getDraftShape(), draft);
    assert.equal(draft.strokeColor, '#000000');
    assert.equal(draft.strokeWidth, 2);
});
