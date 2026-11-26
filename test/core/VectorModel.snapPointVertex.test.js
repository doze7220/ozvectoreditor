/**
 * 責務: VectorModel の吸い付きの表示の点の「吸い付くだけか」の別（setSnapPointの3つ目の引数・isSnapPointVertex・消去・通知）の振る舞いを検証する。
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

test('VectorModel 吸い付きの表示の別: 初期（表示なし）は吸い付くだけではない', () => {
    const { model } = setup();
    assert.equal(model.isSnapPointVertex(), false);
});

test('VectorModel 吸い付きの表示の別: 3つ目の引数がtrueなら吸い付くだけで、getSnapPointは{x,y}だけを返す', () => {
    const { model } = setup();
    model.setSnapPoint(3, 4, true);
    assert.equal(model.isSnapPointVertex(), true);
    assert.deepEqual(model.getSnapPoint(), { x: 3, y: 4 });
});

test('VectorModel 吸い付きの表示の別: 2引数のsetSnapPointは結合する吸い付き（吸い付くだけではない）', () => {
    const { model } = setup();
    model.setSnapPoint(3, 4);
    assert.equal(model.isSnapPointVertex(), false);
    model.setSnapPoint(3, 4, false);
    assert.equal(model.isSnapPointVertex(), false);
    assert.deepEqual(model.getSnapPoint(), { x: 3, y: 4 });
});

test('VectorModel 吸い付きの表示の別: 同じ座標で別だけが変わると通知1回、座標も別も同じなら通知なし', () => {
    const { model, notifyCount } = setup();
    model.setSnapPoint(1, 2, false);
    assert.equal(notifyCount(), 1);
    model.setSnapPoint(1, 2, true);
    assert.equal(notifyCount(), 2);
    assert.equal(model.isSnapPointVertex(), true);
    model.setSnapPoint(1, 2, true);
    assert.equal(notifyCount(), 2);
    model.setSnapPoint(1, 2, false);
    assert.equal(notifyCount(), 3);
    assert.equal(model.isSnapPointVertex(), false);
    model.setSnapPoint(1, 2);
    assert.equal(notifyCount(), 3);
});

test('VectorModel 吸い付きの表示の別: 別が同じで座標だけ変わると通知1回で別は保たれる', () => {
    const { model, notifyCount } = setup();
    model.setSnapPoint(1, 2, true);
    model.setSnapPoint(5, 6, true);
    assert.equal(notifyCount(), 2);
    assert.equal(model.isSnapPointVertex(), true);
    assert.deepEqual(model.getSnapPoint(), { x: 5, y: 6 });
});

test('VectorModel 吸い付きの表示の別: clearSnapPointで偽に戻り、消した後に結合する吸い付きを出しても吸い付くだけが残らない', () => {
    const { model } = setup();
    model.setSnapPoint(1, 2, true);
    model.clearSnapPoint();
    assert.equal(model.isSnapPointVertex(), false);
    assert.equal(model.getSnapPoint(), null);
    model.setSnapPoint(1, 2);
    assert.equal(model.isSnapPointVertex(), false);
});

test('VectorModel 吸い付きの表示の別: replaceAllShapesで偽に戻る', () => {
    const { model } = setup();
    model.setSnapPoint(1, 2, true);
    const line = new Line(0, 0, 10, 0, '#000000', 1);
    line.id = 'a';
    model.replaceAllShapes([line]);
    assert.equal(model.isSnapPointVertex(), false);
    assert.equal(model.getSnapPoint(), null);
});
