/**
 * 責務: VectorModel.moveShapesBy（図形ごとに違う移動量のまとめ移動・存在しないidの無視・通知1回）と、既存のmoveShapesの振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した直線（(0,0)-(10,0)）を作る。
 * @param {string} id 代入するid
 * @returns {Line} 直線
 */
function makeLine(id) {
    const line = new Line(0, 0, 10, 0, '#000000', 1);
    line.id = id;
    return line;
}

/**
 * 直線a・bを入れたモデルと、通知回数のカウンタを作る。
 * @returns {{ model: VectorModel, a: Line, b: Line, notifyCount: () => number }} モデル・図形・通知回数の取得関数
 */
function setup() {
    const model = new VectorModel();
    const a = makeLine('a');
    const b = makeLine('b');
    model.replaceAllShapes([a, b]);
    let count = 0;
    model.onChange(() => { count++; });
    return { model, a, b, notifyCount: () => count };
}

/**
 * 直線の座標を配列で返す。
 * @param {Line} line 直線
 * @returns {number[]} [x1, y1, x2, y2]
 */
function coords(line) {
    return [line.x1, line.y1, line.x2, line.y2];
}

test('moveShapesBy: 図形ごとに違う量で動き、通知は1回', () => {
    const { model, a, b, notifyCount } = setup();
    model.moveShapesBy([
        { id: 'a', dx: 1, dy: 2 },
        { id: 'b', dx: -3, dy: 4 },
    ]);
    assert.deepEqual(coords(a), [1, 2, 11, 2]);
    assert.deepEqual(coords(b), [-3, 4, 7, 4]);
    assert.equal(notifyCount(), 1);
});

test('moveShapesBy: 存在しないidが混在したら、見つかったものだけ動いて通知1回', () => {
    const { model, a, b, notifyCount } = setup();
    model.moveShapesBy([
        { id: 'zzz', dx: 9, dy: 9 },
        { id: 'a', dx: 5, dy: 6 },
    ]);
    assert.deepEqual(coords(a), [5, 6, 15, 6]);
    assert.deepEqual(coords(b), [0, 0, 10, 0]);
    assert.equal(notifyCount(), 1);
});

test('moveShapesBy: 件数が複数でも通知は1回だけ', () => {
    const { model, notifyCount } = setup();
    model.moveShapesBy([
        { id: 'a', dx: 1, dy: 0 },
        { id: 'b', dx: 2, dy: 0 },
        { id: 'a', dx: 3, dy: 0 },
    ]);
    assert.equal(notifyCount(), 1);
});

test('moveShapesBy: 同じidが複数回あれば配列の順にそれぞれ当てる', () => {
    const { model, a } = setup();
    model.moveShapesBy([
        { id: 'a', dx: 1, dy: 1 },
        { id: 'a', dx: 2, dy: 3 },
    ]);
    assert.deepEqual(coords(a), [3, 4, 13, 4]);
});

test('moveShapesBy: 1件も動かなかったとき（全部存在しないid）は通知しない', () => {
    const { model, a, b, notifyCount } = setup();
    model.moveShapesBy([
        { id: 'x', dx: 1, dy: 1 },
        { id: 'y', dx: 2, dy: 2 },
    ]);
    assert.deepEqual(coords(a), [0, 0, 10, 0]);
    assert.deepEqual(coords(b), [0, 0, 10, 0]);
    assert.equal(notifyCount(), 0);
});

test('moveShapesBy: 空配列では何も起きず通知0回', () => {
    const { model, a, b, notifyCount } = setup();
    model.moveShapesBy([]);
    assert.deepEqual(coords(a), [0, 0, 10, 0]);
    assert.deepEqual(coords(b), [0, 0, 10, 0]);
    assert.equal(notifyCount(), 0);
});

test('moveShapesBy: 引数の配列・要素を書き換えない', () => {
    const { model } = setup();
    const moves = [
        { id: 'a', dx: 1, dy: 2 },
        { id: 'zzz', dx: 3, dy: 4 },
    ];
    const snapshot = JSON.parse(JSON.stringify(moves));
    model.moveShapesBy(moves);
    assert.deepEqual(moves, snapshot);
    assert.equal(moves.length, 2);
});

test('moveShapesBy: 選択集合・頂点の選択を変えない', () => {
    const { model } = setup();
    model.setSelection(['a', 'b']);
    model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }]);
    const vertices = model.getSelectedVertices();
    model.moveShapesBy([
        { id: 'a', dx: 1, dy: 1 },
        { id: 'b', dx: 2, dy: 2 },
    ]);
    assert.deepEqual(model.getSelectedIds(), ['a', 'b']);
    assert.deepEqual(model.getSelectedVertices(), vertices);
});

test('moveShapes（既存）: 指定した全図形が同じ量だけ動き、通知は1回', () => {
    const { model, a, b, notifyCount } = setup();
    model.moveShapes(['a', 'b'], 2, 3);
    assert.deepEqual(coords(a), [2, 3, 12, 3]);
    assert.deepEqual(coords(b), [2, 3, 12, 3]);
    assert.equal(notifyCount(), 1);
});

test('moveShapes（既存）: 存在しないidを無視し、動かなければ通知しない', () => {
    const { model, a, notifyCount } = setup();
    model.moveShapes(['a', 'zzz'], 1, 1);
    assert.deepEqual(coords(a), [1, 1, 11, 1]);
    assert.equal(notifyCount(), 1);
    model.moveShapes(['zzz'], 5, 5);
    assert.equal(notifyCount(), 1);
});
