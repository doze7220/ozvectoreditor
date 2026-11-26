/**
 * 責務: PathJoiner の「1本で結合（閉じる）」で、canJoin（押せる見た目）と join（結果）が一致することを、
 * 偽の依存と実物の VectorModel・HistoryManager・EndpointSnapper の組み合わせで検証する。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { listShapeItems } from '../../js/core/ItemTreeRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * idを代入した図形を返す。
 * @param {Object} shape 図形
 * @param {string} id id
 * @returns {Object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * パスを作る。
 * @param {string} id id
 * @param {number[][]} coords [x, y] の並び
 * @param {boolean} [closed=false] 閉じたパスか
 * @returns {Path} パス
 */
function makePath(id, coords, closed = false) {
    return withId(new Path(coords.map(([x, y]) => ({ x, y })), closed, '#445566', 3), id);
}

/**
 * 弧を作る（始点(40,200)・頂上(100,170)・終点(160,200)）。
 * @param {string} id id
 * @returns {Ellipse} 弧
 */
function makeArc(id) {
    return withId(new Ellipse(100, 200, 160, 230, 'arc', '#abcdef', 4), id);
}

/**
 * 偽のmodel・editRecorderとPathJoinerを作る。
 * @param {Array<Object>} shapes 図形
 * @param {string[]} selectedIds 選択中のid
 * @param {number} tolerance screenLengthToWorldが返す値
 * @returns {{ joiner: PathJoiner, calls: Array<Array<*>> }} 結合器と呼び出し記録
 */
function setupFake(shapes, selectedIds, tolerance) {
    const calls = [];
    const model = {
        getEditableSelectedShapes: () => shapes.filter((shape) => selectedIds.includes(shape.id)),
        replaceShape: (...args) => { calls.push(['replaceShape', ...args]); return 'placed'; }
    };
    const editRecorder = {
        beginEdit: () => { calls.push(['beginEdit']); },
        commitEdit: () => { calls.push(['commitEdit']); return true; }
    };
    return { joiner: new PathJoiner({ model, editRecorder, screenLengthToWorld: () => tolerance }), calls };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせる。
 * @param {Array<Object>} shapes 入れる図形（idは代入済み）
 * @returns {{ model: VectorModel, history: HistoryManager }} 組み合わせた実物
 */
function setupReal(shapes) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    return { model, history };
}

/**
 * モデルの図形一式を図形データの配列で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<Object>} 図形データ（重なり順）
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

test('点3つの開いたパス（両端の距離4）：許容距離5では canJoin・join とも false で記録先に触れない、許容距離3では両方 true', () => {
    const path = makePath('p', [[0, 0], [50, 50], [4, 0]]);
    const tight = setupFake([path], ['p'], 5);
    assert.equal(tight.joiner.canJoin(), false);
    assert.equal(tight.joiner.join(), false);
    assert.deepEqual(tight.calls, []);
    const loose = setupFake([path], ['p'], 3);
    assert.equal(loose.joiner.canJoin(), true);
    assert.equal(loose.joiner.join(), true);
    assert.deepEqual(loose.calls.map((c) => c[0]), ['beginEdit', 'replaceShape', 'commitEdit']);
});

test('いくつもの選択で canJoin が真なら join も真、偽なら join は偽で記録先に触れない', () => {
    const all = [
        withId(new Line(0, 0, 10, 0), 'line'),
        withId(new Curve(0, 0, 10, 10), 'curve'),
        makePath('two', [[0, 0], [10, 0]]),
        makePath('overlap', [[0, 0], [50, 50], [2, 1]]),
        makePath('open3', [[0, 0], [50, 50], [100, 0]]),
        makeArc('arc'),
        makePath('closed', [[0, 0], [50, 0], [50, 50]], true),
        withId(new Rect(0, 0, 10, 10), 'rect'),
        withId(new Ellipse(0, 0, 10, 10, 'circle'), 'circle'),
        withId(new Line(20, 0, 30, 0), 'l2'),
        withId(new Line(40, 0, 50, 0), 'l3')
    ];
    const selections = [[], ['line'], ['curve'], ['two'], ['overlap'], ['open3'], ['arc'], ['closed'], ['rect'], ['circle'], ['line', 'l2'], ['arc', 'line'], ['line', 'l2', 'l3']];
    let trueCount = 0;
    for (const tolerance of [0, 5]) {
        for (const ids of selections) {
            const { joiner, calls } = setupFake(all, ids, tolerance);
            const can = joiner.canJoin();
            assert.deepEqual(calls, []);
            assert.equal(joiner.join(), can, `${ids.join(',')} tol=${tolerance}`);
            if (can) trueCount++;
            else assert.deepEqual(calls, []);
        }
    }
    assert.ok(trueCount > 0);
});

test('実物：弧1本の join が id・名前・位置を保った閉じたパスにし、取り消し1回で弧・やり直しで閉じたパスに戻る', () => {
    const { model, history } = setupReal([withId(new Line(0, 0, 10, 0), 'a'), makeArc('r'), withId(new Line(0, 50, 10, 50), 'b')]);
    const namesOf = () => listShapeItems(model.getItems()).map((item) => [item.shape.id, item.name]);
    const nameBefore = namesOf();
    model.setSelection(['r']);
    const original = dump(model);
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    assert.equal(joiner.canJoin(), true);
    assert.equal(joiner.join(), true);
    const closed = dump(model);
    assert.deepEqual(closed.map((d) => d.id), ['a', 'r', 'b']);
    assert.equal(closed[1].type, 'path');
    assert.equal(closed[1].closed, true);
    assert.equal(closed[1].points.length, 3);
    assert.deepEqual(closed[1].segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
    assert.deepEqual(namesOf(), nameBefore);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(dump(model)[1].type, 'arc');
    assert.equal(history.canUndo(), false);
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), closed);
});

test('実物の EndpointSnapper：弧の始点から終点へ描いた直線の commitDrawnLine が弧の id の閉じたパスにし、取り消し1回で弧に戻る', () => {
    const { model, history } = setupReal([makeArc('r')]);
    const snapper = new EndpointSnapper({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    model.startDraft(40, 200, 'line');
    model.updateDraft(160, 200);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'r', end: 'start' }, { shapeId: 'r', end: 'end' }), true);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'r');
    assert.equal(shapes[0].type, 'path');
    assert.equal(shapes[0].closed, true);
    assert.deepEqual(shapes[0].segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.equal(dump(model)[0].type, 'arc');
    assert.equal(history.canUndo(), false);
});
