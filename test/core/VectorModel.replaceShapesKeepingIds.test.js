/**
 * 責務: VectorModel.replaceShapesKeepingIds（複数図形の同じidのままの差し替え・通知1回・位置とidの保持・選択集合とホバーの不変・
 * 存在しないidの飛ばし・別の位置にあるインスタンスの警告・配列でない引数・0件で通知なし・戻り値）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @param {number} x2 終点のx（図形の見分け用）
 * @returns {Line} 直線
 */
function makeLine(id, x2 = 10) {
    const line = new Line(0, 0, x2, 0, '#000000', 1);
    line.id = id;
    return line;
}

/**
 * 直線a・b・c（この順）を入れたモデルと、通知回数のカウンタを作る。
 * @returns {{model: VectorModel, a: Line, b: Line, c: Line, counter: {count: number}}} モデルと図形と通知カウンタ
 */
function setup() {
    const model = new VectorModel();
    const a = makeLine('a');
    const b = makeLine('b');
    const c = makeLine('c');
    model.replaceAllShapes([a, b, c]);
    const counter = { count: 0 };
    model.onChange(() => {
        counter.count++;
    });
    return { model, a, b, c, counter };
}

/**
 * console.warnを一時的に差し替えて呼び出し回数を数える。
 * @param {Function} fn 実行する関数
 * @returns {number} console.warnが呼ばれた回数
 */
function countWarns(fn) {
    const original = console.warn;
    let warns = 0;
    console.warn = () => {
        warns++;
    };
    try {
        fn();
    } finally {
        console.warn = original;
    }
    return warns;
}

test('複数の図形の差し替えが通知1回で反映され、件数を返す', () => {
    const { model, a, b, c, counter } = setup();
    const newA = makeLine('x', 20);
    const newC = makeLine('y', 30);
    const result = model.replaceShapesKeepingIds([{ id: 'a', shape: newA }, { id: 'c', shape: newC }]);
    assert.equal(result, 2);
    assert.equal(counter.count, 1);
    const shapes = model.getShapes();
    assert.equal(shapes[0], newA);
    assert.equal(shapes[1], b);
    assert.equal(shapes[2], newC);
    assert.notEqual(shapes[0], a);
    assert.notEqual(shapes[2], c);
});

test('差し替えた図形のidは元のidになり、並びの位置は変わらない', () => {
    const { model, b } = setup();
    const newA = makeLine('other', 20);
    model.replaceShapesKeepingIds([{ id: 'a', shape: newA }]);
    assert.equal(newA.id, 'a');
    assert.deepEqual(model.getShapes().map((s) => s.id), ['a', 'b', 'c']);
    assert.equal(model.getShapes()[1], b);
});

test('選択集合・頂点の選択・ホバーは変わらない', () => {
    const { model } = setup();
    model.setSelection(['a', 'b']);
    model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }]);
    model.setHovered('b');
    model.replaceShapesKeepingIds([{ id: 'a', shape: makeLine('z', 40) }, { id: 'b', shape: makeLine('z2', 50) }]);
    assert.deepEqual(model.getSelectedIds(), ['a', 'b']);
    assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'a', handle: 'start' }]);
    assert.equal(model.getHoveredId(), 'b');
});

test('存在しないidの組は飛ばし、ほかの組は差し替える（通知1回）', () => {
    const { model, b, counter } = setup();
    const newA = makeLine('q', 20);
    const result = model.replaceShapesKeepingIds([{ id: 'nothing', shape: makeLine('n') }, { id: 'a', shape: newA }]);
    assert.equal(result, 1);
    assert.equal(counter.count, 1);
    assert.equal(model.getShapes()[0], newA);
    assert.equal(model.getShapes()[1], b);
});

test('存在しないidだけなら0を返し、通知しない', () => {
    const { model, a, b, c, counter } = setup();
    const result = model.replaceShapesKeepingIds([{ id: 'nothing', shape: makeLine('n') }]);
    assert.equal(result, 0);
    assert.equal(counter.count, 0);
    assert.deepEqual(model.getShapes(), [a, b, c]);
});

test('ほかの位置に既にあるインスタンスは警告して飛ばす（その位置は変わらない）', () => {
    const { model, a, b, c, counter } = setup();
    let result;
    const warns = countWarns(() => {
        result = model.replaceShapesKeepingIds([{ id: 'a', shape: b }]);
    });
    assert.equal(warns, 1);
    assert.equal(result, 0);
    assert.equal(counter.count, 0);
    assert.deepEqual(model.getShapes(), [a, b, c]);
    assert.equal(b.id, 'b');
});

test('ほかの位置にあるインスタンスの組だけを飛ばし、ほかの組は差し替える', () => {
    const { model, a, b, c, counter } = setup();
    const newC = makeLine('t', 60);
    let result;
    const warns = countWarns(() => {
        result = model.replaceShapesKeepingIds([{ id: 'a', shape: b }, { id: 'c', shape: newC }]);
    });
    assert.equal(warns, 1);
    assert.equal(result, 1);
    assert.equal(counter.count, 1);
    assert.deepEqual(model.getShapes(), [a, b, newC]);
});

test('同じ位置の同じインスタンスは差し替えた扱いで、警告せず件数に数え通知する', () => {
    const { model, a, b, c, counter } = setup();
    let result;
    const warns = countWarns(() => {
        result = model.replaceShapesKeepingIds([{ id: 'b', shape: b }]);
    });
    assert.equal(warns, 0);
    assert.equal(result, 1);
    assert.equal(counter.count, 1);
    assert.deepEqual(model.getShapes(), [a, b, c]);
});

test('配列でない引数は警告して0を返し、何も変えず通知しない', () => {
    const { model, a, b, c, counter } = setup();
    const results = [];
    const warns = countWarns(() => {
        results.push(model.replaceShapesKeepingIds(null));
        results.push(model.replaceShapesKeepingIds({ id: 'a', shape: makeLine('n') }));
    });
    assert.equal(warns, 2);
    assert.deepEqual(results, [0, 0]);
    assert.equal(counter.count, 0);
    assert.deepEqual(model.getShapes(), [a, b, c]);
});

test('空の配列は0を返し、警告も通知もしない', () => {
    const { model, a, b, c, counter } = setup();
    let result;
    const warns = countWarns(() => {
        result = model.replaceShapesKeepingIds([]);
    });
    assert.equal(warns, 0);
    assert.equal(result, 0);
    assert.equal(counter.count, 0);
    assert.deepEqual(model.getShapes(), [a, b, c]);
});

test('引き始めのインスタンスへ同じ入口で戻せる（元のインスタンスそのものが戻る）', () => {
    const { model, a, b, c, counter } = setup();
    model.replaceShapesKeepingIds([{ id: 'a', shape: makeLine('x', 20) }, { id: 'b', shape: makeLine('y', 30) }]);
    counter.count = 0;
    const result = model.replaceShapesKeepingIds([{ id: 'a', shape: a }, { id: 'b', shape: b }]);
    assert.equal(result, 2);
    assert.equal(counter.count, 1);
    assert.deepEqual(model.getShapes(), [a, b, c]);
    assert.equal(a.id, 'a');
    assert.equal(b.id, 'b');
});

test('図形のidの採番（#nextId）に触れない（次に採番するidは変わらない）', () => {
    const model = new VectorModel();
    model.replaceAllShapes([makeLine('shape-1'), makeLine('shape-2')]);
    model.replaceShapesKeepingIds([{ id: 'shape-1', shape: makeLine('zzz') }]);
    model.startDraft(0, 0);
    model.commitDraft();
    assert.equal(model.getShapes()[2].id, 'shape-3');
});

test('引数の配列・要素は書き換えない', () => {
    const { model } = setup();
    const newA = makeLine('keep', 20);
    const replacements = [{ id: 'a', shape: newA }];
    model.replaceShapesKeepingIds(replacements);
    assert.equal(replacements.length, 1);
    assert.deepEqual(Object.keys(replacements[0]), ['id', 'shape']);
    assert.equal(replacements[0].id, 'a');
    assert.equal(replacements[0].shape, newA);
});
