/**
 * 責務: EndpointSnapper（端点への吸い付きの照会と、描き足し・結合・閉じる操作のモデルへの反映の手順）の振る舞いを検証する。
 * 偽のmodel・editRecorderでの呼び出し順の検証と、実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせたUndo/Redoの往復を含む。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
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
 * 偽のmodel・editRecorder・screenLengthToWorldとEndpointSnapperを作る。
 * @param {Array<Object>} shapes getShapesが返す図形（重なり順）
 * @param {Object|null} draft getDraftShapeが返す作成途中の図形
 * @param {number} [tolerance=0] screenLengthToWorldが返す値
 * @returns {{ snapper: EndpointSnapper, calls: Array<Array<*>>, lengths: Array<number> }} 手順と呼び出し記録
 */
function setupFake(shapes, draft, tolerance = 0) {
    const calls = [];
    const lengths = [];
    const model = {
        getShapes: () => shapes,
        getDraftShape: () => draft,
        cancelDraft: () => { calls.push(['cancelDraft']); },
        replaceShape: (...args) => {
            calls.push(['replaceShape', ...args]);
            return 'placed';
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
    const snapper = new EndpointSnapper({ model, editRecorder, screenLengthToWorld });
    return { snapper, calls, lengths };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・EndpointSnapperを組み合わせる（換算は等倍）。
 * @param {Array<Object>} shapes 入れる図形（重なり順。idは代入済み）
 * @returns {{ model: VectorModel, history: HistoryManager, snapper: EndpointSnapper }} 組み合わせた実物
 */
function setupReal(shapes) {
    const model = new VectorModel();
    model.replaceAllShapes(shapes);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const snapper = new EndpointSnapper({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    return { model, history, snapper };
}

/**
 * モデルの図形一式を図形データ（toJSON）の配列で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<Object>} 図形データの配列（重なり順）
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

/**
 * 実物のモデルで直線を描いた状態（作成途中の図形がある）にする。
 * @param {VectorModel} model モデル
 * @param {number} x1 描き始めx
 * @param {number} y1 描き始めy
 * @param {number} x2 描き終えx
 * @param {number} y2 描き終えy
 */
function drawLine(model, x1, y1, x2, y2) {
    model.startDraft(x1, y1, 'line');
    model.updateDraft(x2, y2);
}

test('findDrawSnap: 直線以外の種別ではnull。screenLengthToWorldもgetShapesも呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, calls, lengths } = setupFake([a], null, 1000);
    for (const type of ['curve', 'rect', 'circle', 'arc', 'path', 'unknown']) {
        assert.equal(snapper.findDrawSnap(type, { x: 0, y: 0 }), null);
    }
    assert.deepEqual(lengths, []);
    assert.deepEqual(calls, []);
});

test('findDrawSnap: 直線では許容距離がscreenLengthToWorld(8)の戻り値になり、SnapTargetを返す', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const near = setupFake([a], null, 20);
    assert.deepEqual(near.snapper.findDrawSnap('line', { x: 115, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
    assert.deepEqual(near.lengths, [8]);
    const far = setupFake([a], null, 10);
    assert.equal(far.snapper.findDrawSnap('line', { x: 115, y: 0 }), null);
    assert.deepEqual(far.lengths, [8]);
});

test('findDrawSnap: 呼び出しのたびに換算する', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, lengths } = setupFake([a], null, 8);
    snapper.findDrawSnap('line', { x: 0, y: 0 });
    snapper.findDrawSnap('line', { x: 0, y: 0 });
    assert.deepEqual(lengths, [8, 8]);
});

test('resolveDragEndpoint: 端点のハンドルは start/end、途中の頂点・moveは null、無いid・曲線は null', () => {
    const line = makeLine('l', 0, 0, 10, 0);
    const path = makePath('p', [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    const curve = makeCurve('k');
    const { snapper, calls, lengths } = setupFake([line, path, curve], null);
    assert.equal(snapper.resolveDragEndpoint('l', 'start'), 'start');
    assert.equal(snapper.resolveDragEndpoint('l', 'end'), 'end');
    assert.equal(snapper.resolveDragEndpoint('l', 'move'), null);
    assert.equal(snapper.resolveDragEndpoint('p', 'vertex-0'), 'start');
    assert.equal(snapper.resolveDragEndpoint('p', 'vertex-1'), null);
    assert.equal(snapper.resolveDragEndpoint('p', 'vertex-2'), 'end');
    assert.equal(snapper.resolveDragEndpoint('k', 'start'), null);
    assert.equal(snapper.resolveDragEndpoint('none', 'start'), null);
    assert.deepEqual(calls, []);
    assert.deepEqual(lengths, []);
});

test('findDragSnap: ドラッグしている端点は対象外。直線のもう一方の端点も対象外。別の線の端点には吸い付く', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 200, 0, 300, 0);
    const { snapper, lengths } = setupFake([a, b], null, 10);
    assert.equal(snapper.findDragSnap({ shapeId: 'a', end: 'end' }, { x: 100, y: 0 }), null);
    assert.equal(snapper.findDragSnap({ shapeId: 'a', end: 'end' }, { x: 0, y: 0 }), null);
    assert.deepEqual(
        snapper.findDragSnap({ shapeId: 'a', end: 'end' }, { x: 205, y: 0 }),
        { shapeId: 'b', end: 'start', x: 200, y: 0 }
    );
    assert.deepEqual(lengths, [8, 8, 8]);
});

test('findDragSnap: 頂点4つ以上の開いたパスではもう一方の端点に吸い付く', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
    const { snapper } = setupFake([p], null, 10);
    assert.deepEqual(
        snapper.findDragSnap({ shapeId: 'p', end: 'start' }, { x: 3, y: 100 }),
        { shapeId: 'p', end: 'end', x: 0, y: 100 }
    );
});

test('commitDrawnLine（両方null）: falseで、モデル・記録先・換算のいずれも呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 200, 0, 300, 0);
    const { snapper, calls, lengths } = setupFake([a], draft, 5);
    assert.equal(snapper.commitDrawnLine(null, null), false);
    assert.deepEqual(calls, []);
    assert.deepEqual(lengths, []);
});

test('commitDrawnLine（描き足し）: cancelDraft→beginEdit→replaceShape→commitEditの順。keepId:true・select:false・換算は5', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 100, 0, 200, 0);
    const { snapper, calls, lengths } = setupFake([a], draft, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, null), true);
    assert.deepEqual(calls.map((c) => c[0]), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    const [, targetId, path, options] = calls[2];
    assert.equal(targetId, 'a');
    assert.deepEqual(path.toJSON().points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]);
    assert.deepEqual(options, { keepId: true, removeIds: [], select: false });
    assert.deepEqual(lengths, [5]);
});

test('commitDrawnLine（結合）: removeIdsにもう一方、keepId:false', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 200, 0, 300, 0);
    const draft = makeLine(null, 100, 0, 200, 0);
    const { snapper, calls } = setupFake([a, b], draft, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'b', end: 'start' }), true);
    const [, targetId, , options] = calls[2];
    assert.equal(targetId, 'a');
    assert.deepEqual(options, { keepId: false, removeIds: ['b'], select: false });
});

test('commitDrawnLine（何も起きない）: cancelDraftだけを呼びtrue。beginEdit・replaceShape・commitEditを呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 100, 0, 100, 0);
    const { snapper, calls, lengths } = setupFake([a], draft, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'a', end: 'end' }), true);
    assert.deepEqual(calls, [['cancelDraft']]);
    assert.deepEqual(lengths, [5]);
});

test('commitDrawnLine（閉じられない線）: 直線の両端では cancelDraftだけでtrue', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 100, 0, 0, 0);
    const { snapper, calls } = setupFake([a], draft, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'a', end: 'start' }), true);
    assert.deepEqual(calls, [['cancelDraft']]);
});

test('commitDrawnLine（作成途中の図形が無い）: 計画なしとして扱い、cancelDraftだけでtrue', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, calls } = setupFake([a], null, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, null), true);
    assert.deepEqual(calls, [['cancelDraft']]);
});

test('joinDraggedEndpoint（結合）: beginEdit/commitEditを呼ばず、replaceShape（select:true）だけを呼びtrue', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 200, 0, 300, 0);
    a.setVertex(1, 200, 0);
    const { snapper, calls, lengths } = setupFake([a, b], null, 5);
    assert.equal(
        snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'end' }, { shapeId: 'b', end: 'start', x: 200, y: 0 }),
        true
    );
    assert.deepEqual(calls.map((c) => c[0]), ['replaceShape']);
    const [, targetId, , options] = calls[0];
    assert.equal(targetId, 'a');
    assert.deepEqual(options, { keepId: false, removeIds: ['b'], select: true });
    assert.deepEqual(lengths, [5]);
});

test('joinDraggedEndpoint（計画null）: 何も呼ばずfalse（snapなし・同じ端点）', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, calls } = setupFake([a], null, 5);
    assert.equal(snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'end' }, null), false);
    assert.equal(
        snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'end' }, { shapeId: 'a', end: 'end', x: 100, y: 0 }),
        false
    );
    assert.deepEqual(calls, []);
});

test('実物の組み合わせ: 直線からの描き足し → 同じidの開いたパス・選択は空・履歴1件。undoで元の直線・redoで描き足し後', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const m = makeLine('m', 0, 50, 10, 50);
    const { model, history, snapper } = setupReal([a, m]);
    const original = dump(model);

    drawLine(model, 100, 0, 200, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, null), true);
    const extended = dump(model);
    assert.equal(model.getDraftShape(), null);
    assert.deepEqual(model.getSelectedIds(), []);
    assert.equal(extended.length, 2);
    assert.equal(extended[0].id, 'a');
    assert.equal(extended[0].type, 'path');
    assert.equal(extended[0].closed, false);
    assert.deepEqual(extended[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }]);
    assert.equal(extended[1].id, 'm');
    assert.equal(history.canUndo(), true);

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false, '履歴は1件だけ');
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), extended);
});

test('実物の組み合わせ: 結合（間に別の図形）→ 新しいidが奥の位置に入りもう一方が除かれる。undo/redoで往復', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const m = makeLine('m', 0, 50, 10, 50);
    const b = makeLine('b', 200, 0, 300, 0);
    const { model, history, snapper } = setupReal([a, m, b]);
    const original = dump(model);

    drawLine(model, 100, 0, 200, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'b', end: 'start' }), true);
    const joined = dump(model);
    assert.equal(joined.length, 2);
    assert.equal(joined[0].type, 'path');
    assert.notEqual(joined[0].id, 'a');
    assert.deepEqual(joined[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }]);
    assert.equal(joined[1].id, 'm');
    assert.deepEqual(model.getSelectedIds(), []);

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false);
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), joined);
});

test('実物の組み合わせ: 開いたパスの両端で描いて閉じる → 元のidの閉じたパス', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { model, history, snapper } = setupReal([p]);

    drawLine(model, 100, 100, 0, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'p', end: 'end' }, { shapeId: 'p', end: 'start' }), true);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'p');
    assert.equal(shapes[0].closed, true);
    assert.equal(history.canUndo(), true);
    history.undo();
    assert.equal(dump(model)[0].closed, false);
});

test('実物の組み合わせ: 何も起きない場合（同じ端点・頂点2つの線を閉じる）は図形一式が変わらず履歴が増えない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { model, history, snapper } = setupReal([a]);
    const original = dump(model);

    drawLine(model, 100, 0, 100, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'a', end: 'end' }), true);
    assert.deepEqual(dump(model), original);
    assert.equal(model.getDraftShape(), null);
    assert.equal(history.canUndo(), false);

    drawLine(model, 100, 0, 0, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'a', end: 'end' }, { shapeId: 'a', end: 'start' }), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false);
});

test('実物の組み合わせ: ハンドルのドラッグで結合 → 履歴1件・結果だけが選択・undoでドラッグ前の位置と図形一式に戻る', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 200, 0, 300, 0);
    const { model, history, snapper } = setupReal([a, b]);
    const original = dump(model);
    model.setSelection(['a']);

    const dragged = { shapeId: 'a', end: 'end' };
    history.beginEdit();
    const snap = snapper.findDragSnap(dragged, { x: 197, y: 0 });
    assert.deepEqual(snap, { shapeId: 'b', end: 'start', x: 200, y: 0 });
    model.updateVertex('a', 1, snap.x, snap.y);
    assert.equal(snapper.joinDraggedEndpoint(dragged, snap), true);
    history.commitEdit();

    const joined = dump(model);
    assert.equal(joined.length, 1);
    assert.equal(joined[0].type, 'path');
    assert.deepEqual(joined[0].points, [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 300, y: 0 }]);
    assert.deepEqual(model.getSelectedIds(), [joined[0].id]);
    assert.equal(history.canUndo(), true);

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false, '履歴は1件だけ');
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), joined);
});

test('実物の組み合わせ: ハンドルのドラッグで自身のもう一方の端点に重ねて閉じる（頂点が1つ減る・元のid）', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
    const { model, history, snapper } = setupReal([p]);
    model.setSelection(['p']);

    const dragged = { shapeId: 'p', end: 'end' };
    history.beginEdit();
    const snap = snapper.findDragSnap(dragged, { x: 3, y: 0 });
    assert.deepEqual(snap, { shapeId: 'p', end: 'start', x: 0, y: 0 });
    model.updateVertex('p', 3, snap.x, snap.y);
    assert.equal(snapper.joinDraggedEndpoint(dragged, snap), true);
    history.commitEdit();

    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'p');
    assert.equal(shapes[0].closed, true);
    assert.equal(shapes[0].points.length, 3);
    assert.deepEqual(model.getSelectedIds(), ['p']);
    assert.equal(history.undo(), true);
    assert.equal(dump(model)[0].points.length, 4);
    assert.equal(dump(model)[0].closed, false);
});
