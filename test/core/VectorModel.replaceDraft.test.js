/**
 * 責務: VectorModel.replaceDraft（作成途中の図形の置き換え・idのnull化・直前に使った値の当て込み・通知1回・触れない状態）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 新しい（idが未設定の）直線を作る。
 * @returns {Line} 直線
 */
function makeLine() {
    return new Line(0, 0, 10, 0, '#123456', 9);
}

/**
 * 新しい（idが未設定の）開いたパスを作る。
 * @returns {Path} パス
 */
function makePath() {
    return new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false, '#123456', 9);
}

/**
 * 作成途中の直線を1本持つモデルと、通知回数のカウンタを作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function setupWithDraft() {
    const model = new VectorModel();
    model.startDraft(0, 0, 'line');
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

test('作成途中の図形が無いとき: false・通知0・getDraftShapeはnullのまま', () => {
    const model = new VectorModel();
    let count = 0;
    model.onChange(() => { count++; });
    assert.equal(model.replaceDraft(makeLine()), false);
    assert.equal(count, 0);
    assert.equal(model.getDraftShape(), null);
});

test('作成途中の図形があるとき: true・通知1回・渡した図形になり、getShapesには入らない', () => {
    const { model, notifyCount } = setupWithDraft();
    const path = makePath();
    assert.equal(model.replaceDraft(path), true);
    assert.equal(notifyCount(), 1);
    assert.equal(model.getDraftShape(), path);
    assert.equal(model.getShapes().length, 0);
});

test('idを持つ図形を渡してもidがnullになる', () => {
    const { model } = setupWithDraft();
    const line = makeLine();
    line.id = 'shape-99';
    model.replaceDraft(line);
    assert.equal(line.id, null);
});

test('スタイルが直前に使った値になる（既定値）', () => {
    const { model } = setupWithDraft();
    const expected = model.getNewShapeStyle();
    const path = makePath();
    model.replaceDraft(path);
    assert.equal(path.strokeColor, expected.strokeColor);
    assert.equal(path.strokeWidth, expected.strokeWidth);
    assert.equal(path.fillColor, expected.fillEnabled ? expected.fillColor : null);
});

test('スタイルが直前に使った値になる（updateNewShapeStyleで変えた後・線なし・塗りあり）', () => {
    const { model } = setupWithDraft();
    model.updateNewShapeStyle({ strokeEnabled: false, strokeWidth: 7, fillEnabled: true, fillColor: '#00ff00' });
    const path = makePath();
    model.replaceDraft(path);
    assert.equal(path.strokeColor, null);
    assert.equal(path.strokeWidth, 7);
    assert.equal(path.fillColor, '#00ff00');
});

test('スタイルが直前に使った値になる（線あり・塗りなし）', () => {
    const { model } = setupWithDraft();
    model.updateNewShapeStyle({ strokeEnabled: true, strokeColor: '#ff0000', strokeWidth: 3, fillEnabled: false });
    const line = makeLine();
    model.replaceDraft(line);
    assert.equal(line.strokeColor, '#ff0000');
    assert.equal(line.strokeWidth, 3);
    assert.equal(line.fillColor, null);
});

test('#shapesに含まれる図形を渡すとconsole.warnしてfalse・通知0・状態は変わらない', (t) => {
    const model = new VectorModel();
    const committed = makeLine();
    model.replaceAllShapes([committed]);
    model.startDraft(0, 0, 'line');
    const draft = model.getDraftShape();
    model.setSelection([committed.id]);
    model.setHovered(committed.id);
    model.setSnapPoint(3, 4);
    const styleBefore = model.getNewShapeStyle();
    const committedStyle = { c: committed.strokeColor, w: committed.strokeWidth, f: committed.fillColor };
    let count = 0;
    model.onChange(() => { count++; });
    const warn = t.mock.method(console, 'warn', () => {});
    assert.equal(model.replaceDraft(committed), false);
    assert.equal(warn.mock.callCount(), 1);
    assert.equal(count, 0);
    assert.equal(model.getDraftShape(), draft);
    assert.equal(committed.id, model.getSelectedIds()[0]);
    assert.deepEqual(committedStyle, { c: committed.strokeColor, w: committed.strokeWidth, f: committed.fillColor });
    assert.deepEqual(model.getNewShapeStyle(), styleBefore);
});

test('選択集合・ホバー・吸い付きの表示の点・直前に使った値は変わらない', () => {
    const model = new VectorModel();
    const other = makeLine();
    model.replaceAllShapes([other]);
    model.startDraft(0, 0, 'line');
    model.setSelection([other.id]);
    model.setHovered(other.id);
    model.setSnapPoint(3, 4);
    const styleBefore = model.getNewShapeStyle();
    model.replaceDraft(makePath());
    assert.deepEqual(model.getSelectedIds(), [other.id]);
    assert.equal(model.getHoveredId(), other.id);
    assert.deepEqual(model.getSnapPoint(), { x: 3, y: 4 });
    assert.deepEqual(model.getNewShapeStyle(), styleBefore);
});

test('置き換えた後のcommitDraftで、置き換えた図形が新しいidで確定する', () => {
    const { model } = setupWithDraft();
    const path = makePath();
    model.replaceDraft(path);
    model.commitDraft();
    assert.equal(model.getShapes().length, 1);
    assert.equal(model.getShapes()[0], path);
    assert.equal(typeof path.id, 'string');
    assert.equal(model.getDraftShape(), null);
});

test('置き換えた後のcancelDraftで捨てられる', () => {
    const { model } = setupWithDraft();
    model.replaceDraft(makePath());
    model.cancelDraft();
    assert.equal(model.getDraftShape(), null);
    assert.equal(model.getShapes().length, 0);
});

test('置き換えた後のupdateDraftが、置き換えた図形のupdateDraftEndへ委譲される（Pathの最後の頂点が動く）', () => {
    const { model } = setupWithDraft();
    const path = makePath();
    model.replaceDraft(path);
    model.updateDraft(50, 60);
    assert.deepEqual(path.points[path.points.length - 1], { x: 50, y: 60 });
    assert.deepEqual(path.points[0], { x: 0, y: 0 });
});
