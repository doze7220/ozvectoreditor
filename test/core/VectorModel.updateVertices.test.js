/**
 * 責務: VectorModel.updateVertices（複数の頂点の座標のまとめ更新・存在しないidの無視・通知1回）と、updateVertexの従来の振る舞いを検証する。
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

test('複数の図形にまたがる頂点を更新し、通知は1回', () => {
    const { model, a, b, notifyCount } = setup();
    model.updateVertices([
        { id: 'a', vertexIndex: 0, x: 1, y: 2 },
        { id: 'b', vertexIndex: 1, x: 3, y: 4 },
    ]);
    assert.deepEqual([a.x1, a.y1, a.x2, a.y2], [1, 2, 10, 0]);
    assert.deepEqual([b.x1, b.y1, b.x2, b.y2], [0, 0, 3, 4]);
    assert.equal(notifyCount(), 1);
});

test('同じ図形の複数の頂点を更新できる', () => {
    const { model, a, notifyCount } = setup();
    model.updateVertices([
        { id: 'a', vertexIndex: 0, x: 5, y: 6 },
        { id: 'a', vertexIndex: 1, x: 7, y: 8 },
    ]);
    assert.deepEqual([a.x1, a.y1, a.x2, a.y2], [5, 6, 7, 8]);
    assert.equal(notifyCount(), 1);
});

test('存在しないidが混在したら、見つかったものだけ更新して通知1回', () => {
    const { model, a, notifyCount } = setup();
    model.updateVertices([
        { id: 'zzz', vertexIndex: 0, x: 9, y: 9 },
        { id: 'a', vertexIndex: 0, x: 1, y: 1 },
    ]);
    assert.deepEqual([a.x1, a.y1], [1, 1]);
    assert.equal(notifyCount(), 1);
});

test('全部が存在しないidなら通知0回', () => {
    const { model, a, notifyCount } = setup();
    model.updateVertices([{ id: 'zzz', vertexIndex: 0, x: 9, y: 9 }]);
    assert.deepEqual([a.x1, a.y1, a.x2, a.y2], [0, 0, 10, 0]);
    assert.equal(notifyCount(), 0);
});

test('空の配列では何もせず通知0回', () => {
    const { model, notifyCount } = setup();
    model.updateVertices([]);
    assert.equal(notifyCount(), 0);
});

test('引数の配列と要素を書き換えない', () => {
    const { model } = setup();
    const updates = [{ id: 'a', vertexIndex: 0, x: 1, y: 2 }];
    const snapshot = JSON.parse(JSON.stringify(updates));
    model.updateVertices(updates);
    assert.equal(updates.length, 1);
    assert.deepEqual(updates, snapshot);
});

test('updateVertexは従来どおり1頂点を更新し通知1回', () => {
    const { model, a, notifyCount } = setup();
    model.updateVertex('a', 1, 20, 30);
    assert.deepEqual([a.x1, a.y1, a.x2, a.y2], [0, 0, 20, 30]);
    assert.equal(notifyCount(), 1);
});

test('updateVertexは存在しないidで通知0回', () => {
    const { model, notifyCount } = setup();
    model.updateVertex('zzz', 0, 1, 1);
    assert.equal(notifyCount(), 0);
});
