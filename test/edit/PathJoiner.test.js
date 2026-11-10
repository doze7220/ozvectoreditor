/**
 * 責務: PathJoiner（選択中の線の結合の手順：受理判定・許容距離の換算・モデルへの反映と履歴の呼び出し順）の振る舞いを検証する。
 * 偽のmodel・editRecorderでの呼び出しの検証と、実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせたUndo/Redoの往復を含む。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';
import { Curve } from '../../js/shapes/Curve.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点x
 * @param {number} y1 始点y
 * @param {number} x2 終点x
 * @param {number} y2 終点y
 * @returns {Line} 直線
 */
function makeLine(id, x1, y1, x2, y2) {
    const line = new Line(x1, y1, x2, y2, '#112233', 2);
    line.id = id;
    return line;
}

/**
 * idを直接代入したパスを作る。
 * @param {string} id 代入するid
 * @param {Array<{x:number,y:number}>} points 頂点
 * @param {boolean} [closed=false] 閉じているか
 * @returns {Path} パス
 */
function makePath(id, points, closed = false) {
    const path = new Path(points, closed, '#445566', 3);
    path.id = id;
    return path;
}

/**
 * idを直接代入した曲線を作る。
 * @param {string} id 代入するid
 * @returns {Curve} 曲線
 */
function makeCurve(id) {
    const curve = new Curve(0, 0, 10, 10, '#000000', 1);
    curve.id = id;
    return curve;
}

/**
 * 偽のmodel・editRecorder・screenLengthToWorldとPathJoinerを作る。
 * @param {Array<Object>} shapes getShapesが返す図形（重なり順）
 * @param {Array<string>} selectedIds 選択中のid
 * @param {Object} [options] 偽物の設定
 * @param {number} [options.tolerance=0] screenLengthToWorldが返す値
 * @param {*} [options.replaceResult='placed'] replaceShapeが返す値
 * @returns {{ joiner: PathJoiner, calls: Array<Array<*>>, lengths: Array<number> }} 結合器と呼び出し記録
 */
function setupFake(shapes, selectedIds, { tolerance = 0, replaceResult = 'placed' } = {}) {
    const calls = [];
    const lengths = [];
    const model = {
        getShapes: () => shapes,
        isSelected: (id) => selectedIds.includes(id),
        replaceShape: (...args) => {
            calls.push(['replaceShape', ...args]);
            return replaceResult;
        }
    };
    const editRecorder = {
        beginEdit: () => { calls.push(['beginEdit']); },
        commitEdit: () => { calls.push(['commitEdit']); return true; }
    };
    const screenLengthToWorld = (length) => {
        lengths.push(length);
        return tolerance;
    };
    const joiner = new PathJoiner({ model, editRecorder, screenLengthToWorld });
    return { joiner, calls, lengths };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・PathJoinerを組み合わせる。
 * @param {Array<Object>} shapes 入れる図形（重なり順。idは代入済み）
 * @param {boolean} [restoreSelection=true] SnapshotAdapterのshouldRestoreSelectionの値
 * @returns {{ model: VectorModel, history: HistoryManager, joiner: PathJoiner }} 組み合わせた実物
 */
function setupReal(shapes, restoreSelection = true) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => restoreSelection });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    return { model, history, joiner };
}

/**
 * モデルの図形一式を図形データ（toJSON）の配列で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<Object>} 図形データの配列（重なり順）
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

test('canJoin: 受理する選択（開いたパス1本・直線2本）でtrue', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const one = setupFake([p], ['p']);
    assert.equal(one.joiner.canJoin(), true);
    assert.deepEqual(one.calls, []);
    const a = makeLine('a', 0, 0, 10, 0);
    const b = makeLine('b', 20, 0, 30, 0);
    const two = setupFake([a, b], ['a', 'b']);
    assert.equal(two.joiner.canJoin(), true);
    assert.deepEqual(two.calls, []);
});

test('canJoin: 受理しない選択（0個・直線1本・3本・曲線を含む）でfalse。記録先・replaceShapeを呼ばない', () => {
    const a = makeLine('a', 0, 0, 10, 0);
    const b = makeLine('b', 20, 0, 30, 0);
    const c = makeLine('c', 40, 0, 50, 0);
    const k = makeCurve('k');
    const cases = [
        [[a, b], []],
        [[a, b], ['a']],
        [[a, b, c], ['a', 'b', 'c']],
        [[a, k], ['a', 'k']]
    ];
    for (const [shapes, selected] of cases) {
        const { joiner, calls } = setupFake(shapes, selected);
        assert.equal(joiner.canJoin(), false);
        assert.deepEqual(calls, []);
    }
});

test('join（受理しない選択）: falseで、beginEdit・replaceShape・commitEditを呼ばない', () => {
    const a = makeLine('a', 0, 0, 10, 0);
    const { joiner, calls, lengths } = setupFake([a], ['a']);
    assert.equal(joiner.join(), false);
    assert.deepEqual(calls, []);
    assert.deepEqual(lengths, [5]);
});

test('join（閉じる）: beginEdit→replaceShape→commitEditの順に1回ずつ。引数は(元のid, 閉じたPath, keepId:true)', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { joiner, calls } = setupFake([p], ['p']);
    assert.equal(joiner.join(), true);
    assert.deepEqual(calls.map((c) => c[0]), ['beginEdit', 'replaceShape', 'commitEdit']);
    const [, targetId, path, options] = calls[1];
    assert.equal(targetId, 'p');
    assert.equal(path.toJSON().closed, true);
    assert.deepEqual(options, { keepId: true, removeIds: [] });
});

test('join（2本）: getShapesの並びで奥の図形がA。並びを入れ替えるとtargetId・removeIdsが入れ替わる', () => {
    const a = makeLine('a', 0, 0, 10, 0);
    const b = makeLine('b', 20, 0, 30, 0);
    const first = setupFake([a, b], ['a', 'b']);
    assert.equal(first.joiner.join(), true);
    const [, t1, path1, o1] = first.calls[1];
    assert.equal(t1, 'a');
    assert.equal(path1.toJSON().closed, false);
    assert.deepEqual(o1, { keepId: false, removeIds: ['b'] });

    const second = setupFake([b, a], ['a', 'b']);
    assert.equal(second.joiner.join(), true);
    const [, t2, , o2] = second.calls[1];
    assert.equal(t2, 'b');
    assert.deepEqual(o2, { keepId: false, removeIds: ['a'] });
});

test('許容距離の換算: screenLengthToWorldが5で呼ばれ、戻り値が重なりの判定に使われる', () => {
    // 端点の距離8の2本（Aの終点(10,0)とBの始点(18,0)）
    const make = () => [makeLine('a', 0, 0, 10, 0), makeLine('b', 18, 0, 30, 0)];
    const merged = setupFake(make(), ['a', 'b'], { tolerance: 10 });
    merged.joiner.join();
    assert.deepEqual(merged.lengths, [5]);
    assert.equal(merged.calls[1][2].toJSON().points.length, 3);

    const apart = setupFake(make(), ['a', 'b'], { tolerance: 5 });
    apart.joiner.join();
    assert.deepEqual(apart.lengths, [5]);
    assert.equal(apart.calls[1][2].toJSON().points.length, 4);
});

test('選択されていない図形は結合の対象にならない', () => {
    const a = makeLine('a', 0, 0, 10, 0);
    const b = makeLine('b', 20, 0, 30, 0);
    const c = makeLine('c', 40, 0, 50, 0);
    const { joiner, calls } = setupFake([a, b, c], ['a', 'c']);
    assert.equal(joiner.join(), true);
    const [, targetId, , options] = calls[1];
    assert.equal(targetId, 'a');
    assert.deepEqual(options.removeIds, ['c']);
});

test('replaceShapeがnullを返したらjoinはfalse（beginEdit・commitEditは1回ずつ）', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { joiner, calls } = setupFake([p], ['p'], { replaceResult: null });
    assert.equal(joiner.join(), false);
    assert.deepEqual(calls.map((c) => c[0]), ['beginEdit', 'replaceShape', 'commitEdit']);
});

test('実物の組み合わせ: 2本の結合（間に別の図形）→ undo 1回で元に戻り → redo 1回で結合後に戻る', () => {
    const a = makeLine('a', 0, 0, 10, 0);
    const m = makeLine('m', 0, 50, 10, 50);
    const b = makeLine('b', 100, 0, 110, 0);
    const { model, history, joiner } = setupReal([a, m, b]);
    const original = dump(model);
    model.setSelection(['a', 'b']);

    assert.equal(history.canUndo(), false);
    assert.equal(joiner.join(), true);
    const joined = dump(model);
    assert.equal(joined.length, 2);
    assert.equal(joined[0].type, 'path');
    assert.equal(joined[0].closed, false);
    assert.equal(joined[0].points.length, 4);
    assert.equal(joined[1].id, 'm');
    assert.equal(history.canUndo(), true);
    assert.equal(history.canRedo(), false);

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false, '履歴は1件だけ');
    assert.equal(history.canRedo(), true);

    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), joined);
    assert.equal(history.canRedo(), false);
    assert.equal(history.canUndo(), true);
});

test('実物の組み合わせ: 開いたパス1本を閉じる → undo で同じidの開いたパス → redo で閉じたパス', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { model, history, joiner } = setupReal([p]);
    const original = dump(model);
    model.setSelection(['p']);

    assert.equal(joiner.join(), true);
    const closed = dump(model);
    assert.equal(closed.length, 1);
    assert.equal(closed[0].id, 'p');
    assert.equal(closed[0].closed, true);

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(model.getShapes()[0].toJSON().closed, false);
    assert.equal(history.canUndo(), false);

    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), closed);
});

test('実物の組み合わせ: 選択集合は与えたshouldRestoreSelectionに従って復元される', () => {
    const make = () => [makeLine('a', 0, 0, 10, 0), makeLine('b', 100, 0, 110, 0)];
    const restored = setupReal(make(), true);
    restored.model.setSelection(['a', 'b']);
    restored.joiner.join();
    restored.history.undo();
    assert.deepEqual([...restored.model.getSelectedIds()].sort(), ['a', 'b']);

    const notRestored = setupReal(make(), false);
    notRestored.model.setSelection(['a', 'b']);
    notRestored.joiner.join();
    notRestored.history.undo();
    assert.deepEqual(notRestored.model.getSelectedIds(), []);
});

test('実物の組み合わせ: 結合できない選択でjoinしても履歴が増えない', () => {
    const a = makeLine('a', 0, 0, 10, 0);
    const b = makeLine('b', 20, 0, 30, 0);
    const c = makeLine('c', 40, 0, 50, 0);
    const { model, history, joiner } = setupReal([a, b, c]);
    const original = dump(model);

    model.setSelection(['a']);
    assert.equal(joiner.join(), false);
    model.setSelection(['a', 'b', 'c']);
    assert.equal(joiner.join(), false);
    model.setSelection([]);
    assert.equal(joiner.join(), false);

    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), false);
    assert.deepEqual(dump(model), original);
});
