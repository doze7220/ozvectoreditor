/**
 * 責務: VectorModel.replaceShape（指定図形の位置での差し替え・指定図形の除去・結果だけの選択・通知1回）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

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

/**
 * 新しい（idが未設定の）開いたパスを作る。
 * @returns {Path} パス
 */
function makePath() {
    return new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false, '#000000', 1);
}

/**
 * 直線a・b・c・d（この順）を入れたモデルと、通知回数のカウンタを作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes(['a', 'b', 'c', 'd'].map(makeLine));
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

/**
 * モデルの図形のid配列を返す。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} 重なり順のid配列
 */
function ids(model) {
    return model.getShapes().map((s) => s.id);
}

test('keepId:false・removeIds:[b]: targetIdの位置に入り、bが除かれ、他の前後関係は不変', () => {
    const { model, notifyCount } = setup();
    const path = makePath();
    const result = model.replaceShape('a', path, { keepId: false, removeIds: ['b'] });
    assert.equal(typeof result, 'string');
    assert.equal(path.id, result);
    assert.ok(!['a', 'b', 'c', 'd'].includes(result));
    assert.deepEqual(ids(model), [result, 'c', 'd']);
    assert.deepEqual(model.getSelectedIds(), [result]);
    assert.equal(notifyCount(), 1);
});

test('keepId:false: 中間の位置の差し替えでも位置が保たれる', () => {
    const { model } = setup();
    const path = makePath();
    const result = model.replaceShape('b', path, { removeIds: ['d'] });
    assert.deepEqual(ids(model), ['a', result, 'c']);
});

test('keepId:true・removeIds:[]: idを引き継ぎ、位置・選択集合・通知1回', () => {
    const { model, notifyCount } = setup();
    const path = makePath();
    const result = model.replaceShape('b', path, { keepId: true, removeIds: [] });
    assert.equal(result, 'b');
    assert.equal(path.id, 'b');
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.ok(model.getShapes()[1] === path);
    assert.deepEqual(model.getSelectedIds(), ['b']);
    assert.equal(notifyCount(), 1);
});

test('targetIdが存在しない: null・変化なし・通知なし', () => {
    const { model, notifyCount } = setup();
    model.setSelection(['c']);
    const before = notifyCount();
    assert.equal(model.replaceShape('zzz', makePath(), { removeIds: ['a'] }), null);
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.deepEqual(model.getSelectedIds(), ['c']);
    assert.equal(notifyCount(), before);
});

test('既に含まれるインスタンス: null・console.warn1回・変化なし・通知なし', (t) => {
    const { model, notifyCount } = setup();
    const warn = t.mock.method(console, 'warn', () => {});
    const existing = model.getShapes()[2];
    assert.equal(model.replaceShape('a', existing, { removeIds: ['b'] }), null);
    assert.equal(warn.mock.callCount(), 1);
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.equal(existing.id, 'c');
    assert.equal(notifyCount(), 0);
});

test('removeIdsにtargetId・存在しないidが含まれても、置き換えた位置は残り例外にならない', () => {
    const { model } = setup();
    const path = makePath();
    const result = model.replaceShape('a', path, { removeIds: ['a', 'nothing', 'c'] });
    assert.deepEqual(ids(model), [result, 'b', 'd']);
    const path2 = makePath();
    const result2 = model.replaceShape('b', path2, { keepId: true, removeIds: ['b'] });
    assert.equal(result2, 'b');
    assert.deepEqual(ids(model), [result, 'b', 'd']);
});

test('ホバー: 除いた図形・置き換えた図形(keepId:false)をホバー中なら解除される', () => {
    const { model } = setup();
    model.setHovered('b');
    model.replaceShape('a', makePath(), { removeIds: ['b'] });
    assert.equal(model.getHoveredId(), null);

    const m2 = setup().model;
    m2.setHovered('a');
    m2.replaceShape('a', makePath(), { keepId: false, removeIds: [] });
    assert.equal(m2.getHoveredId(), null);
});

test('ホバー: keepId:trueで置き換えた図形をホバー中ならホバーは残り、無関係な図形のホバーも残る', () => {
    const { model } = setup();
    model.setHovered('a');
    model.replaceShape('a', makePath(), { keepId: true });
    assert.equal(model.getHoveredId(), 'a');

    const m2 = setup().model;
    m2.setHovered('d');
    m2.replaceShape('a', makePath(), { removeIds: ['b'] });
    assert.equal(m2.getHoveredId(), 'd');
});

test('選択矩形に触れない', () => {
    const { model } = setup();
    model.setSelectionRect(1, 2, 3, 4);
    const rect = model.getSelectionRect();
    model.replaceShape('a', makePath(), { removeIds: ['b'] });
    assert.deepEqual(model.getSelectionRect(), rect);
    assert.notEqual(model.getSelectionRect(), null);
});
