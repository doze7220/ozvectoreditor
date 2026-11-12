/**
 * 責務: VectorModel.reorderShapes（id配列による並び全体の置き換え・変わったときだけ通知1回・不正な入力の拒否・他の状態に触れないこと）の振る舞いを検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

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

/**
 * console.warnを抑止し、呼び出し回数を数えられるようにする。
 * @param {import('node:test').TestContext} t テストコンテキスト
 * @returns {import('node:test').Mock} モックされたconsole.warn
 */
function muteWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

test('並びが変わる: trueを返し、順が置き換わり、インスタンスは同じ参照・toJSONも同じ', () => {
    const { model, notifyCount } = setup();
    const before = new Map(model.getShapes().map((s) => [s.id, s]));
    const jsonBefore = new Map(model.getShapes().map((s) => [s.id, JSON.stringify(s.toJSON())]));
    assert.equal(model.reorderShapes(['c', 'a', 'd', 'b']), true);
    assert.deepEqual(ids(model), ['c', 'a', 'd', 'b']);
    for (const shape of model.getShapes()) {
        assert.equal(shape, before.get(shape.id));
        assert.equal(JSON.stringify(shape.toJSON()), jsonBefore.get(shape.id));
    }
    assert.equal(notifyCount(), 1);
});

test('選択集合は同じidのまま、getSelectedIdsは新しい並びの順で返る', () => {
    const { model } = setup();
    model.setSelection(['a', 'c']);
    assert.equal(model.reorderShapes(['d', 'c', 'b', 'a']), true);
    assert.deepEqual(model.getSelectedIds(), ['c', 'a']);
    assert.equal(model.isSelected('a'), true);
    assert.equal(model.isSelected('c'), true);
    assert.equal(model.isSelected('b'), false);
    assert.equal(model.isSelected('d'), false);
});

test('ホバー・作成中の図形・選択矩形・吸い付きの表示の点・直前に使った値は変わらない', () => {
    const { model } = setup();
    model.setHovered('b');
    model.updateNewShapeStyle({ strokeColor: '#ff0000', strokeWidth: 5 });
    const styleBefore = model.getNewShapeStyle();
    model.startDraft(1, 2);
    const draft = model.getDraftShape();
    model.setSelectionRect(1, 2, 3, 4);
    model.setSnapPoint(5, 6);

    assert.equal(model.reorderShapes(['b', 'a', 'c', 'd']), true);

    assert.equal(model.getHoveredId(), 'b');
    assert.equal(model.getDraftShape(), draft);
    assert.deepEqual(model.getSelectionRect(), { x1: 1, y1: 2, x2: 3, y2: 4 });
    assert.deepEqual(model.getSnapPoint(), { x: 5, y: 6 });
    assert.deepEqual(model.getNewShapeStyle(), styleBefore);
});

test('idの採番は変わらない: 並べ替えの後のaddShapesWithNewIdsが並べ替え前と同じ次のidを発行する', () => {
    const base = setup();
    const expected = base.model.addShapesWithNewIds([makeLine('x')]);

    const { model } = setup();
    model.reorderShapes(['d', 'c', 'b', 'a']);
    const actual = model.addShapesWithNewIds([makeLine('x')]);
    assert.deepEqual(actual, expected);
});

test('同じ並び: falseを返し、通知なし・警告なし・並び不変', (t) => {
    const warn = muteWarn(t);
    const { model, notifyCount } = setup();
    assert.equal(model.reorderShapes(['a', 'b', 'c', 'd']), false);
    assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
    assert.equal(notifyCount(), 0);
    assert.equal(warn.mock.callCount(), 0);
});

test('図形0個で[]: falseを返し、通知なし・警告なし', (t) => {
    const warn = muteWarn(t);
    const model = new VectorModel();
    let count = 0;
    model.onChange(() => { count++; });
    assert.equal(model.reorderShapes([]), false);
    assert.equal(count, 0);
    assert.equal(warn.mock.callCount(), 0);
});

/** 不正な入力の一覧（名前と入力）。 */
const INVALID_INPUTS = [
    ['null', null],
    ['文字列', 'abcd'],
    ['要素数が少ない', ['a', 'b', 'c']],
    ['要素数が多い', ['a', 'b', 'c', 'd', 'e']],
    ['現存しないid', ['a', 'b', 'c', 'z']],
    ['重複したid（数は同じ）', ['a', 'b', 'b', 'd']],
];

for (const [name, input] of INVALID_INPUTS) {
    test(`不正な入力（${name}）: falseを返し、並び不変・通知なし・警告1回`, (t) => {
        const warn = muteWarn(t);
        const { model, notifyCount } = setup();
        assert.equal(model.reorderShapes(input), false);
        assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
        assert.equal(notifyCount(), 0);
        assert.equal(warn.mock.callCount(), 1);
    });
}
