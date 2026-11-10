/**
 * 責務: VectorModel の吸い付きの表示の点（setSnapPoint・clearSnapPoint・getSnapPoint・replaceAllShapesでの消去・通知）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * 通知回数を数えるリスナーを登録した空のモデルを作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function setup() {
    const model = new VectorModel();
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @returns {Line} 直線
 */
function makeLine(id) {
    const line = new Line(0, 0, 10, 0, '#000000', 1);
    line.id = id;
    return line;
}

test('初期値はnull', () => {
    const { model } = setup();
    assert.equal(model.getSnapPoint(), null);
});

test('setSnapPointで設定され、通知は1回', () => {
    const { model, notifyCount } = setup();
    model.setSnapPoint(3, 4);
    assert.deepEqual(model.getSnapPoint(), { x: 3, y: 4 });
    assert.equal(notifyCount(), 1);
});

test('同じ座標の再設定は通知しない・別の座標では通知する', () => {
    const { model, notifyCount } = setup();
    model.setSnapPoint(3, 4);
    model.setSnapPoint(3, 4);
    assert.equal(notifyCount(), 1);
    model.setSnapPoint(3, 5);
    assert.equal(notifyCount(), 2);
    model.setSnapPoint(4, 5);
    assert.equal(notifyCount(), 3);
    assert.deepEqual(model.getSnapPoint(), { x: 4, y: 5 });
});

test('getSnapPointはコピーを返す（書き換えても内部は変わらない）', () => {
    const { model } = setup();
    model.setSnapPoint(1, 2);
    const p = model.getSnapPoint();
    p.x = 99;
    assert.deepEqual(model.getSnapPoint(), { x: 1, y: 2 });
});

test('clearSnapPointは表示中のときだけ通知する', () => {
    const { model, notifyCount } = setup();
    model.clearSnapPoint();
    assert.equal(notifyCount(), 0);
    model.setSnapPoint(1, 2);
    model.clearSnapPoint();
    assert.equal(model.getSnapPoint(), null);
    assert.equal(notifyCount(), 2);
    model.clearSnapPoint();
    assert.equal(notifyCount(), 2);
});

test('replaceAllShapesでnullになり、通知は1回のまま', () => {
    const { model, notifyCount } = setup();
    model.setSnapPoint(1, 2);
    const before = notifyCount();
    model.replaceAllShapes([makeLine('a')]);
    assert.equal(model.getSnapPoint(), null);
    assert.equal(notifyCount() - before, 1);
});

test('図形・選択集合・ホバー・作成中の図形・選択矩形に触れない', () => {
    const { model } = setup();
    model.replaceAllShapes([makeLine('a'), makeLine('b')]);
    model.setSelection(['a']);
    model.setHovered('b');
    model.setSelectionRect(0, 0, 5, 5);
    model.startDraft(1, 1);
    const draft = model.getDraftShape();

    model.setSnapPoint(7, 8);
    model.setSnapPoint(9, 9);
    model.clearSnapPoint();

    assert.deepEqual(model.getShapes().map((s) => s.id), ['a', 'b']);
    assert.deepEqual(model.getSelectedIds(), ['a']);
    assert.equal(model.getHoveredId(), 'b');
    assert.deepEqual(model.getSelectionRect(), { x1: 0, y1: 0, x2: 5, y2: 5 });
    assert.equal(model.getDraftShape(), draft);
});
