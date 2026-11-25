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
import { Path, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

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
        getEditableShapes: () => shapes,
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

test('findDrawSnap: 直線・曲線以外の種別ではnull。screenLengthToWorldもgetShapesも呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, calls, lengths } = setupFake([a], null, 1000);
    for (const type of ['rect', 'circle', 'arc', 'path', 'unknown']) {
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

test('resolveDragEndpoint: 端点のハンドルは start/end、途中の頂点・moveは null、無いid・今の曲線の制御点は null（始点・終点は端点）', () => {
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
    assert.equal(snapper.resolveDragEndpoint('k', 'start'), 'start');
    assert.equal(snapper.resolveDragEndpoint('k', 'end'), 'end');
    assert.equal(snapper.resolveDragEndpoint('k', 'control'), null);
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

/**
 * 線を引く手順の検証用に、replaceDraft・commitDraftも記録する偽のmodel・editRecorder・screenLengthToWorldとEndpointSnapperを作る。
 * @param {Array<Object>} shapes getShapesが返す図形（重なり順）
 * @param {Object|null} draft getDraftShapeが返す作成途中の図形
 * @param {number} [tolerance=0] screenLengthToWorldが返す値
 * @returns {{ snapper: EndpointSnapper, calls: Array<Array<*>>, lengths: Array<number> }} 手順と呼び出し記録
 */
function setupFakeDrawing(shapes, draft, tolerance = 0) {
    const calls = [];
    const lengths = [];
    const model = {
        getShapes: () => shapes,
        getEditableShapes: () => shapes,
        getDraftShape: () => draft,
        cancelDraft: () => { calls.push(['cancelDraft']); },
        replaceDraft: (shape) => { calls.push(['replaceDraft', shape]); return true; },
        commitDraft: () => { calls.push(['commitDraft']); },
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
 * 呼び出し記録から名前の並びだけを取り出す。
 * @param {Array<Array<*>>} calls 呼び出し記録
 * @returns {Array<string>} 呼び出し名の並び
 */
function names(calls) {
    return calls.map((c) => c[0]);
}

test('isDrawingLine: 作成途中が無い・曲線・閉じたパスではfalse、直線・開いたパスではtrue（記録先に触れない）', () => {
    const none = setupFakeDrawing([], null);
    assert.equal(none.snapper.isDrawingLine(), false);
    assert.equal(setupFakeDrawing([], undefined).snapper.isDrawingLine(), false);
    assert.equal(setupFakeDrawing([], makeCurve(null)).snapper.isDrawingLine(), false);
    assert.equal(setupFakeDrawing([], makeLine(null, 0, 0, 10, 0)).snapper.isDrawingLine(), true);
    const open = setupFakeDrawing([], makePath(null, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]));
    assert.equal(open.snapper.isDrawingLine(), true);
    const closed = makePath(null, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true);
    assert.equal(setupFakeDrawing([], closed).snapper.isDrawingLine(), false);
    assert.deepEqual(open.calls, []);
    assert.deepEqual(open.lengths, []);
});

test('findDrawnLineSnap: 作成途中が無ければnullで換算を呼ばない。あれば許容距離はscreenLengthToWorld(8)', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const none = setupFakeDrawing([a], null, 10);
    assert.equal(none.snapper.findDrawnLineSnap(null, { x: 100, y: 0 }), null);
    assert.deepEqual(none.lengths, []);

    const draft = makeLine(null, 200, 0, 300, 0);
    const { snapper, lengths } = setupFakeDrawing([a], draft, 10);
    assert.deepEqual(snapper.findDrawnLineSnap(null, { x: 105, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
    assert.deepEqual(lengths, [8]);
    assert.equal(snapper.findDrawnLineSnap({ shapeId: 'a', end: 'end' }, { x: 105, y: 0 }), null);
});

test('getDrawnLineLastPoint: 作成途中が無ければnull。あれば最後の点（付いてくる線の先の1つ前）', () => {
    assert.equal(setupFakeDrawing([], null).snapper.getDrawnLineLastPoint(), null);
    const draft = makePath(null, [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 30, y: 30 }]);
    assert.deepEqual(setupFakeDrawing([], draft).snapper.getDrawnLineLastPoint(), { x: 10, y: 5 });
});

test('clickDrawnLine: 作成途中が無ければfalseで何も呼ばない', () => {
    const { snapper, calls, lengths } = setupFakeDrawing([], null, 5);
    assert.equal(snapper.clickDrawnLine(null, null), false);
    assert.deepEqual(calls, []);
    assert.deepEqual(lengths, []);
});

test('clickDrawnLine（点を打つ）: replaceDraftだけで記録先に触れない。trueで換算は5', () => {
    const draft = makeLine(null, 0, 0, 100, 0);
    const { snapper, calls, lengths } = setupFakeDrawing([], draft, 5);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    assert.deepEqual(names(calls), ['replaceDraft']);
    assert.deepEqual(calls[0][1].toJSON().points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }]);
    assert.deepEqual(lengths, [5]);
});

test('clickDrawnLine（閉じる）: 始点への吸い付き＋打った点3つ → replaceDraft→beginEdit→commitDraft→commitEdit。閉じたパス', () => {
    const draft = makePath(null, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 5 }]);
    const { snapper, calls, lengths } = setupFakeDrawing([], draft, 5);
    assert.equal(snapper.clickDrawnLine(null, { kind: 'drawnStart', x: 0, y: 0 }), false);
    assert.deepEqual(names(calls), ['replaceDraft', 'beginEdit', 'commitDraft', 'commitEdit']);
    const closed = calls[0][1].toJSON();
    assert.equal(closed.closed, true);
    assert.deepEqual(closed.points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    assert.deepEqual(lengths, []);
});

test('clickDrawnLine（始点への吸い付きでも閉じられない）: 点を打つ', () => {
    const draft = makePath(null, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 5 }]);
    const { snapper, calls } = setupFakeDrawing([], draft, 5);
    assert.equal(snapper.clickDrawnLine(null, { kind: 'drawnStart', x: 0, y: 0 }), true);
    assert.deepEqual(names(calls), ['replaceDraft']);
    assert.equal(calls[0][1].toJSON().points.length, 4);
});

test('clickDrawnLine（開いたまま終える）: 付いてくる線の先が最後の点と重なる → replaceDraft→beginEdit→commitDraft→commitEdit。換算は5', () => {
    const draft = makePath(null, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 103, y: 100 }]);
    const { snapper, calls, lengths } = setupFakeDrawing([], draft, 5);
    assert.equal(snapper.clickDrawnLine(null, null), false);
    assert.deepEqual(names(calls), ['replaceDraft', 'beginEdit', 'commitDraft', 'commitEdit']);
    assert.deepEqual(calls[0][1].toJSON().points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    assert.deepEqual(lengths, [5]);
});

test('clickDrawnLine（始点と重なる）: 打った点が始点だけならcancelDraftだけで何も残さない', () => {
    const draft = makeLine(null, 0, 0, 2, 0);
    const { snapper, calls } = setupFakeDrawing([], draft, 5);
    assert.equal(snapper.clickDrawnLine(null, null), false);
    assert.deepEqual(names(calls), ['cancelDraft']);
});

test('clickDrawnLine（つながる）: 端点への吸い付き → cancelDraft→beginEdit→replaceShape→commitEdit', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makePath(null, [{ x: 200, y: 0 }, { x: 150, y: 50 }, { x: 100, y: 0 }]);
    const { snapper, calls, lengths } = setupFakeDrawing([a], draft, 5);
    const endSnap = { shapeId: 'a', end: 'end', x: 100, y: 0 };
    assert.equal(snapper.clickDrawnLine(null, endSnap), false);
    assert.deepEqual(names(calls), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    assert.equal(calls[2][1], 'a');
    assert.equal(calls[2][3].select, false);
    assert.deepEqual(lengths, [5, 5]);
});

test('finishDrawnLine: 作成途中が無ければ何もしない。始点だけならcancelDraftだけ（記録しない）', () => {
    const none = setupFakeDrawing([], null, 5);
    none.snapper.finishDrawnLine(null);
    assert.deepEqual(none.calls, []);

    const one = setupFakeDrawing([], makeLine(null, 0, 0, 50, 0), 5);
    one.snapper.finishDrawnLine(null);
    assert.deepEqual(names(one.calls), ['cancelDraft']);
});

test('finishDrawnLine: 描き始めが端点でなければreplaceDraft→beginEdit→commitDraft→commitEdit', () => {
    const draft = makePath(null, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { snapper, calls } = setupFakeDrawing([], draft, 5);
    snapper.finishDrawnLine(null);
    assert.deepEqual(names(calls), ['replaceDraft', 'beginEdit', 'commitDraft', 'commitEdit']);
    assert.deepEqual(calls[0][1].toJSON().points, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.equal(calls[0][1].toJSON().type, 'line');
});

test('finishDrawnLine: 描き始めが端点ならcancelDraft→beginEdit→replaceShape(描き足し)→commitEdit', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makePath(null, [{ x: 100, y: 0 }, { x: 150, y: 50 }, { x: 200, y: 50 }]);
    const { snapper, calls } = setupFakeDrawing([a], draft, 5);
    snapper.finishDrawnLine({ shapeId: 'a', end: 'end' });
    assert.deepEqual(names(calls), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    assert.equal(calls[2][1], 'a');
    assert.deepEqual(calls[2][2].toJSON().points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 50 }]);
    assert.deepEqual(calls[2][3], { keepId: true, removeIds: [], select: false });
});

test('removeDrawnLinePoint: 作成途中が無ければfalse。点が複数ならreplaceDraftでtrue。始点だけならcancelDraftでfalse。記録先に触れない', () => {
    assert.equal(setupFakeDrawing([], null).snapper.removeDrawnLinePoint(), false);

    const multi = setupFakeDrawing([], makePath(null, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }]));
    assert.equal(multi.snapper.removeDrawnLinePoint(), true);
    assert.deepEqual(names(multi.calls), ['replaceDraft']);
    assert.deepEqual(multi.calls[0][1].toJSON().points, [{ x: 0, y: 0 }, { x: 20, y: 5 }]);

    const one = setupFakeDrawing([], makeLine(null, 0, 0, 10, 0));
    assert.equal(one.snapper.removeDrawnLinePoint(), false);
    assert.deepEqual(names(one.calls), ['cancelDraft']);
});

test('実物の組み合わせ: 点を5つ打って開いたまま終える → 開いたパス1つ・選択は空・履歴1件・undo/redo', () => {
    const { model, history, snapper } = setupReal([]);
    model.startDraft(0, 0, 'line');
    const pts = [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: 0, y: 200 }];
    for (const p of pts) {
        model.updateDraft(p.x, p.y);
        assert.equal(snapper.clickDrawnLine(null, null), true);
        assert.equal(history.canUndo(), false);
        assert.deepEqual(dump(model), []);
    }
    model.updateDraft(0, 200);
    assert.equal(snapper.clickDrawnLine(null, null), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].type, 'path');
    assert.equal(shapes[0].closed, false);
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, ...pts]);
    assert.deepEqual(model.getSelectedIds(), []);
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), []);
    assert.equal(history.canUndo(), false);
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), shapes);
});

test('実物の組み合わせ: 点2つで終えるとline', () => {
    const { model, history, snapper } = setupReal([]);
    model.startDraft(0, 0, 'line');
    model.updateDraft(100, 0);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    snapper.finishDrawnLine(null);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].type, 'line');
    assert.equal(history.canUndo(), true);
});

test('実物の組み合わせ: 始点に吸い付いて閉じる → 閉じたパス・履歴1件', () => {
    const { model, history, snapper } = setupReal([]);
    model.startDraft(0, 0, 'line');
    for (const p of [{ x: 100, y: 0 }, { x: 100, y: 100 }]) {
        model.updateDraft(p.x, p.y);
        snapper.clickDrawnLine(null, null);
    }
    model.updateDraft(0, 2);
    const snap = snapper.findDrawnLineSnap(null, { x: 0, y: 2 });
    assert.deepEqual(snap, { kind: 'drawnStart', x: 0, y: 0 });
    assert.equal(snapper.clickDrawnLine(null, snap), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].type, 'path');
    assert.equal(shapes[0].closed, true);
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.equal(history.canUndo(), false);
});

test('実物の組み合わせ: 既存の線の端点から引き始めて終える → 元のidの開いたパス・履歴1件・undoで元の直線', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { model, history, snapper } = setupReal([a]);
    const original = dump(model);
    const startSnap = { shapeId: 'a', end: 'end' };
    model.startDraft(100, 0, 'line');
    model.updateDraft(150, 50);
    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(200, 50);
    snapper.finishDrawnLine(startSnap);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'a');
    assert.equal(shapes[0].type, 'path');
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 150, y: 50 }]);
    assert.equal(shapes[0].strokeColor, '#112233');
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false);
});

test('実物の組み合わせ: 別の線の端点に吸い付いて終える → 1本・履歴1件', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 300, 0, 400, 0);
    const { model, history, snapper } = setupReal([a, b]);
    const startSnap = { shapeId: 'a', end: 'end' };
    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 50);
    snapper.clickDrawnLine(startSnap, null);
    model.updateDraft(300, 0);
    const endSnap = snapper.findDrawnLineSnap(startSnap, { x: 303, y: 0 });
    assert.deepEqual(endSnap, { shapeId: 'b', end: 'start', x: 300, y: 0 });
    assert.equal(snapper.clickDrawnLine(startSnap, endSnap), false);
    assert.equal(dump(model).length, 1);
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.equal(dump(model).length, 2);
    assert.equal(history.canUndo(), false);
});

test('実物の組み合わせ: 両端とも別の線 → 3本が1本・もう一方が除かれる', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 300, 0, 400, 0);
    const { model, snapper } = setupReal([a, b]);
    const startSnap = { shapeId: 'a', end: 'end' };
    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 50);
    snapper.clickDrawnLine(startSnap, null);
    model.updateDraft(300, 0);
    snapper.clickDrawnLine(startSnap, { shapeId: 'b', end: 'start', x: 300, y: 0 });
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.deepEqual(
        shapes[0].points,
        [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 50 }, { x: 300, y: 0 }, { x: 400, y: 0 }]
    );
    assert.equal(model.getShapes().some((s) => s.id === 'b'), false);
});

test('実物の組み合わせ: 両端とも別の線（前後に別の図形がある） → 新しいidの線が奥（基準の線）の位置に入る', () => {
    const back = makeLine('back', 0, 200, 50, 200);
    const a = makeLine('a', 0, 0, 100, 0);
    const mid = makeLine('mid', 0, 300, 50, 300);
    const b = makeLine('b', 300, 0, 400, 0);
    const front = makeLine('front', 0, 400, 50, 400);
    const { model, snapper } = setupReal([back, a, mid, b, front]);
    const startSnap = { shapeId: 'a', end: 'end' };
    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 50);
    snapper.clickDrawnLine(startSnap, null);
    model.updateDraft(300, 0);
    snapper.clickDrawnLine(startSnap, { shapeId: 'b', end: 'start', x: 300, y: 0 });
    const ids = model.getShapes().map((s) => s.id);
    assert.equal(ids.length, 4);
    assert.equal(ids[0], 'back');
    assert.notEqual(ids[1], 'a');
    assert.notEqual(ids[1], 'b');
    assert.equal(model.getShapes()[1].toJSON().type, 'path');
    assert.deepEqual(ids.slice(2), ['mid', 'front']);
});

test('実物の組み合わせ: 描き始めが端点でなく、描き終えだけ別の線の端点 → 1本の開いたパス・元のid・履歴1件・undoで元に戻る', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 300, 0, 400, 0);
    const { model, history, snapper } = setupReal([a, b]);
    const original = dump(model);
    model.startDraft(200, 50, 'line');
    model.updateDraft(250, 80);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    model.updateDraft(300, 0);
    const endSnap = snapper.findDrawnLineSnap(null, { x: 303, y: 0 });
    assert.deepEqual(endSnap, { shapeId: 'b', end: 'start', x: 300, y: 0 });
    assert.equal(snapper.clickDrawnLine(null, endSnap), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 2);
    assert.equal(shapes[1].id, 'b');
    assert.equal(shapes[1].type, 'path');
    assert.deepEqual(
        shapes[1].points,
        [{ x: 200, y: 50 }, { x: 250, y: 80 }, { x: 300, y: 0 }, { x: 400, y: 0 }]
    );
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false);
});

test('実物の組み合わせ: 既存の線の端点から引き始め、そのもう一方の端点で閉じる → 元のidの閉じたパス', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { model, history, snapper } = setupReal([a]);
    const startSnap = { shapeId: 'a', end: 'end' };
    model.startDraft(100, 0, 'line');
    model.updateDraft(50, 100);
    snapper.clickDrawnLine(startSnap, null);
    model.updateDraft(0, 0);
    assert.equal(snapper.clickDrawnLine(startSnap, { shapeId: 'a', end: 'start', x: 0, y: 0 }), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'a');
    assert.equal(shapes[0].closed, true);
    assert.equal(history.canUndo(), true);
});

test('実物の組み合わせ: 点を打つ・最後の点を消すの間は履歴・図形一式が変わらない', () => {
    const { model, history, snapper } = setupReal([]);
    model.startDraft(0, 0, 'line');
    model.updateDraft(100, 0);
    snapper.clickDrawnLine(null, null);
    model.updateDraft(100, 100);
    snapper.clickDrawnLine(null, null);
    assert.equal(model.getDraftShape().toJSON().points.length, 4);
    assert.equal(snapper.removeDrawnLinePoint(), true);
    assert.equal(model.getDraftShape().toJSON().points.length, 3);
    assert.equal(snapper.removeDrawnLinePoint(), true);
    assert.equal(model.getDraftShape().toJSON().type, 'line');
    assert.equal(snapper.removeDrawnLinePoint(), false);
    assert.equal(model.getDraftShape(), null);
    assert.equal(history.canUndo(), false);
    assert.deepEqual(dump(model), []);
});

test('実物の組み合わせ: 新しく引いた線のスタイルは直前に使った値（updateNewShapeStyleで変えた値）', () => {
    const { model, snapper } = setupReal([]);
    model.startDraft(0, 0, 'line');
    model.updateDraft(100, 0);
    snapper.clickDrawnLine(null, null);
    model.updateDraft(100, 100);
    model.updateNewShapeStyle({ strokeColor: '#abcdef', strokeWidth: 7 });
    snapper.finishDrawnLine(null);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].strokeColor, '#abcdef');
    assert.equal(shapes[0].strokeWidth, 7);
});

/**
 * 区間がすべて曲線のパス（曲線のツールの作成途中の線の形）を作る。idは代入しない。
 * @param {Array<{x:number,y:number}>} points 頂点（付いてくる線の先を含む）
 * @returns {Path} 曲線の区間の開いたパス
 */
function makeSmoothDraft(points) {
    return new Path(points, false, undefined, undefined, undefined, SEGMENT_KIND_SMOOTH);
}

/**
 * 実物のモデルで曲線のツールの作成途中の線（頂点2つの曲線のパス）がある状態にする。
 * @param {VectorModel} model モデル
 * @param {Array<{x:number,y:number}>} points 作成途中の線の頂点
 */
function startSmoothDraft(model, points) {
    model.startDraft(points[0].x, points[0].y, 'line');
    model.replaceDraft(makeSmoothDraft(points));
}

test('isDrawingLine（曲線のツール）: 曲線の区間の開いたパスでtrue、今の曲線（Curve）・閉じた曲線のパスでfalse。記録先に触れない', () => {
    const open = setupFakeDrawing([], makeSmoothDraft([{ x: 0, y: 0 }, { x: 10, y: 0 }]));
    assert.equal(open.snapper.isDrawingLine(), true);
    assert.deepEqual(open.calls, []);
    assert.deepEqual(open.lengths, []);
    assert.equal(setupFakeDrawing([], makeCurve(null)).snapper.isDrawingLine(), false);
    const closed = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], true, undefined, undefined, undefined, SEGMENT_KIND_SMOOTH);
    assert.equal(setupFakeDrawing([], closed).snapper.isDrawingLine(), false);
});

test('clickDrawnLine（曲線のツール・点を打つ）: 全区間smoothのままreplaceDraftだけ。記録先に触れない', () => {
    const draft = makeSmoothDraft([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const { snapper, calls } = setupFakeDrawing([], draft, 5);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    assert.deepEqual(names(calls), ['replaceDraft']);
    const data = calls[0][1].toJSON();
    assert.equal(data.type, 'path');
    assert.equal(data.points.length, 3);
    assert.deepEqual(data.segments, [{ kind: 'smooth' }, { kind: 'smooth' }]);
});

test('実物の組み合わせ（曲線のツール）: 点2つで終える → line1件・履歴1件', () => {
    const { model, history, snapper } = setupReal([]);
    startSmoothDraft(model, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    assert.equal(history.canUndo(), false);
    snapper.finishDrawnLine(null);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].type, 'line');
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), []);
});

test('実物の組み合わせ（曲線のツール）: 点3つで終える → 全区間smoothの開いた曲線のパス・履歴1件', () => {
    const { model, history, snapper } = setupReal([]);
    startSmoothDraft(model, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    model.updateDraft(100, 100);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    assert.equal(history.canUndo(), false);
    model.updateDraft(100, 100);
    assert.equal(snapper.clickDrawnLine(null, null), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].type, 'path');
    assert.equal(shapes[0].closed, false);
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    assert.deepEqual(shapes[0].segments, [{ kind: 'smooth' }, { kind: 'smooth' }]);
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.equal(history.canUndo(), false);
});

test('実物の組み合わせ（曲線のツール）: 始点へ吸い付いて閉じる → 全区間smoothの閉じた曲線のパス・履歴1件', () => {
    const { model, history, snapper } = setupReal([]);
    startSmoothDraft(model, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    for (const p of [{ x: 100, y: 0 }, { x: 100, y: 100 }]) {
        model.updateDraft(p.x, p.y);
        snapper.clickDrawnLine(null, null);
    }
    model.updateDraft(0, 2);
    const snap = snapper.findDrawnLineSnap(null, { x: 0, y: 2 });
    assert.deepEqual(snap, { kind: 'drawnStart', x: 0, y: 0 });
    assert.equal(snapper.clickDrawnLine(null, snap), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].type, 'path');
    assert.equal(shapes[0].closed, true);
    assert.deepEqual(shapes[0].segments, shapes[0].points.map(() => ({ kind: 'smooth' })));
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.equal(history.canUndo(), false);
});

test('removeDrawnLinePoint（曲線のツール）: 曲線のパスのまま点が減り、始点だけならやめる。記録先に触れない', () => {
    const multi = setupFakeDrawing([], makeSmoothDraft([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }]));
    assert.equal(multi.snapper.removeDrawnLinePoint(), true);
    assert.deepEqual(names(multi.calls), ['replaceDraft']);
    const data = multi.calls[0][1].toJSON();
    assert.deepEqual(data.points, [{ x: 0, y: 0 }, { x: 20, y: 5 }]);
    assert.deepEqual(data.segments, [{ kind: 'smooth' }]);

    const one = setupFakeDrawing([], makeSmoothDraft([{ x: 0, y: 0 }, { x: 10, y: 0 }]));
    assert.equal(one.snapper.removeDrawnLinePoint(), false);
    assert.deepEqual(names(one.calls), ['cancelDraft']);
});

test('findDrawnLineSnap（曲線のツール）: 既存の線の端点の近くなら既存の線の端点を返す', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeSmoothDraft([{ x: 200, y: 0 }, { x: 105, y: 0 }]);
    const { snapper } = setupFakeDrawing([a], draft, 10);
    assert.deepEqual(snapper.findDrawnLineSnap(null, { x: 105, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
});

/**
 * idを直接代入した、区間がすべて曲線のパスを作る。
 * @param {string} id 代入するid
 * @param {Array<{x:number,y:number}>} points 頂点
 * @returns {Path} 曲線の区間の開いたパス
 */
function makeSmoothPath(id, points) {
    const path = makeSmoothDraft(points);
    path.id = id;
    return path;
}

test('findDrawSnap（曲線のツール）: curveでSnapTargetを返し、screenLengthToWorldを8で呼ぶ', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, lengths } = setupFake([a], null, 8);
    assert.deepEqual(snapper.findDrawSnap('curve', { x: 3, y: 0 }), { shapeId: 'a', end: 'start', x: 0, y: 0 });
    assert.deepEqual(lengths, [8]);
});

test('finishDrawnLine（曲線のツール・偽物の依存）: 描き始めが端点のとき、呼び出しの順は変わらず足した区間がsmooth', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeSmoothDraft([{ x: 100, y: 0 }, { x: 150, y: 50 }, { x: 160, y: 60 }]);
    const { snapper, calls } = setupFakeDrawing([a], draft, 5);
    snapper.finishDrawnLine({ shapeId: 'a', end: 'end' });
    assert.deepEqual(names(calls), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    const [, targetId, path] = calls[2];
    assert.equal(targetId, 'a');
    assert.deepEqual(path.toJSON().segments, [{ kind: 'line' }, { kind: 'smooth' }]);
});

test('実物の組み合わせ（曲線のツール）: 直線のパスの終点から描き始めて点2つで終える → 元のid・区間[line, line, smooth]・履歴1件・undo/redo', () => {
    const p = makePath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { model, history, snapper } = setupReal([p]);
    const original = dump(model);
    const startSnap = { shapeId: 'p', end: 'end' };
    startSmoothDraft(model, [{ x: 100, y: 100 }, { x: 150, y: 150 }]);
    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(200, 150);
    snapper.finishDrawnLine(startSnap);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'p');
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 150, y: 150 }]);
    assert.deepEqual(shapes[0].segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'smooth' }]);
    const extended = dump(model);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(history.canUndo(), false);
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), extended);
});

test('実物の組み合わせ（曲線のツール）: 曲線のパスの終点から点3つで終える → 足した区間がすべてsmooth', () => {
    const p = makeSmoothPath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    const { model, snapper } = setupReal([p]);
    const startSnap = { shapeId: 'p', end: 'end' };
    startSmoothDraft(model, [{ x: 100, y: 0 }, { x: 100, y: 50 }]);
    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(150, 100);
    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(150, 100);
    assert.equal(snapper.clickDrawnLine(startSnap, null), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'p');
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 150, y: 100 }]);
    assert.deepEqual(shapes[0].segments, shapes[0].points.slice(1).map(() => ({ kind: 'smooth' })));
});

test('実物の組み合わせ（曲線のツール）: 引いている途中に別の線の端点へ吸い付いてクリック → 1本の開いたパス・基準の線の位置・もう一方を除く・区間の種類', () => {
    const back = makeLine('back', 0, 200, 50, 200);
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 300, 0, 400, 0);
    const { model, history, snapper } = setupReal([back, a, b]);
    const original = dump(model);
    const startSnap = { shapeId: 'a', end: 'end' };
    startSmoothDraft(model, [{ x: 100, y: 0 }, { x: 200, y: 50 }]);
    snapper.clickDrawnLine(startSnap, null);
    model.updateDraft(300, 0);
    const endSnap = snapper.findDrawnLineSnap(startSnap, { x: 303, y: 0 });
    assert.deepEqual(endSnap, { shapeId: 'b', end: 'start', x: 300, y: 0 });
    assert.equal(snapper.clickDrawnLine(startSnap, endSnap), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 2);
    assert.equal(shapes[0].id, 'back');
    assert.equal(model.getShapes().some((s) => s.id === 'b'), false);
    assert.equal(shapes[1].type, 'path');
    assert.notEqual(shapes[1].id, 'a');
    assert.notEqual(shapes[1].id, 'b');
    assert.deepEqual(
        shapes[1].points,
        [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 50 }, { x: 300, y: 0 }, { x: 400, y: 0 }]
    );
    assert.deepEqual(shapes[1].segments.map((s) => s.kind), ['line', 'smooth', 'smooth', 'line']);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
});

test('実物の組み合わせ（曲線のツール）: 同じ線の両端の間を描く → 元のidの閉じたパス・閉じる区間がsmooth', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { model, snapper } = setupReal([a]);
    const startSnap = { shapeId: 'a', end: 'end' };
    startSmoothDraft(model, [{ x: 100, y: 0 }, { x: 50, y: 100 }]);
    snapper.clickDrawnLine(startSnap, null);
    model.updateDraft(0, 0);
    assert.equal(snapper.clickDrawnLine(startSnap, { shapeId: 'a', end: 'start', x: 0, y: 0 }), false);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'a');
    assert.equal(shapes[0].closed, true);
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }]);
    assert.deepEqual(shapes[0].segments, [{ kind: 'line' }, { kind: 'smooth' }, { kind: 'smooth' }]);
});

test('実物の組み合わせ（直線のツール）: 曲線のパスの終点から描き足す → 区間[...元のsmooth, line]', () => {
    const p = makeSmoothPath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const { model, snapper } = setupReal([p]);
    drawLine(model, 100, 100, 200, 100);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'p', end: 'end' }, null), true);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'p');
    assert.deepEqual(shapes[0].points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }]);
    assert.deepEqual(shapes[0].segments, [{ kind: 'smooth' }, { kind: 'smooth' }, { kind: 'line' }]);
});

test('実物の組み合わせ（曲線のパスの端点のドラッグ）: 曲線のパスどうしの結合 → 結果だけが選択・全区間smooth', () => {
    const s1 = makeSmoothPath('s1', [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }]);
    const s2 = makeSmoothPath('s2', [{ x: 200, y: 0 }, { x: 250, y: 0 }, { x: 300, y: 0 }]);
    const { model, history, snapper } = setupReal([s1, s2]);
    const dragged = { shapeId: 's1', end: 'end' };
    history.beginEdit();
    const snap = snapper.findDragSnap(dragged, { x: 197, y: 0 });
    assert.deepEqual(snap, { shapeId: 's2', end: 'start', x: 200, y: 0 });
    model.updateVertex('s1', 2, snap.x, snap.y);
    assert.equal(snapper.joinDraggedEndpoint(dragged, snap), true);
    history.commitEdit();
    const joined = dump(model);
    assert.equal(joined.length, 1);
    assert.equal(joined[0].points.length, 5);
    assert.deepEqual(joined[0].segments, [{ kind: 'smooth' }, { kind: 'smooth' }, { kind: 'smooth' }, { kind: 'smooth' }]);
    assert.deepEqual(model.getSelectedIds(), [joined[0].id]);
});

test('実物の組み合わせ（曲線のパスの端点のドラッグ）: 頂点4つの曲線のパスを閉じる → 閉じたパス・全区間smooth', () => {
    const p = makeSmoothPath('p', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }]);
    const { model, history, snapper } = setupReal([p]);
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
    assert.deepEqual(shapes[0].segments, shapes[0].points.map(() => ({ kind: 'smooth' })));
});

test('joinDraggedEndpoint（今の曲線の端点のドラッグ。Phase 09-03a）: 曲がり方を持つ区間を含むパスでreplaceShape（select:true）を呼ぶ', () => {
    const k = makeCurve('k');
    const b = makeLine('b', 20, 0, 30, 0);
    k.setVertex(2, 20, 0);
    const { snapper, calls } = setupFake([k, b], null, 5);
    assert.equal(snapper.resolveDragEndpoint('k', 'end'), 'end');
    assert.equal(
        snapper.joinDraggedEndpoint({ shapeId: 'k', end: 'end' }, { shapeId: 'b', end: 'start', x: 20, y: 0 }),
        true
    );
    assert.deepEqual(calls.map((c) => c[0]), ['replaceShape']);
    const [, targetId, path, options] = calls[0];
    assert.equal(targetId, 'k');
    assert.deepEqual(options, { keepId: false, removeIds: ['b'], select: true });
    assert.equal(path.toJSON().segments.some((s) => s.kind === 'bezier'), true);
});

test('commitDrawnLine（描き始めが今の曲線の端点。Phase 09-03a）: 今の曲線のidを保つ（keepId:true）', () => {
    const k = makeCurve('k');
    const draft = makeLine(null, 10, 10, 50, 10);
    const { snapper, calls } = setupFake([k], draft, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'k', end: 'end' }, null), true);
    assert.deepEqual(calls.map((c) => c[0]), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    const [, targetId, path, options] = calls[2];
    assert.equal(targetId, 'k');
    assert.deepEqual(options, { keepId: true, removeIds: [], select: false });
    assert.deepEqual(path.toJSON().segments.map((s) => s.kind), ['bezier', 'line']);
});

/**
 * idを直接代入した弧（中心(100,200)・横の半径60・縦の半径30。左端(40,200)・右端(160,200)）を作る。
 * @param {string} id 代入するid
 * @returns {Ellipse} 弧
 */
function makeArc(id) {
    const arc = new Ellipse(100, 200, 160, 230, 'arc', '#abcdef', 4);
    arc.id = id;
    return arc;
}

test('resolveDragEndpoint（弧のハンドル。Phase 09-03b）: left・right・up・down・moveのどれも端点として解決せずnull', () => {
    const { snapper, calls, lengths } = setupFake([makeArc('r')], null);
    for (const name of ['left', 'right', 'up', 'down', 'move']) {
        assert.equal(snapper.resolveDragEndpoint('r', name), null);
    }
    assert.deepEqual(calls, []);
    assert.deepEqual(lengths, []);
});

test('findDrawSnap（弧の端点。Phase 09-03b）: 直線・曲線のツールで弧の左端の近くは弧の始点のSnapTarget', () => {
    const { snapper, lengths } = setupFake([makeArc('r')], null, 10);
    const expected = { shapeId: 'r', end: 'start', x: 40, y: 200 };
    assert.deepEqual(snapper.findDrawSnap('line', { x: 44, y: 203 }), expected);
    assert.deepEqual(snapper.findDrawSnap('curve', { x: 44, y: 203 }), expected);
    assert.deepEqual(lengths, [8, 8]);
});

test('findDragSnap（弧の端点。Phase 09-03b）: ほかの線の端点のドラッグが弧の右端に吸い付く', () => {
    const a = makeLine('a', 300, 200, 400, 200);
    const { snapper } = setupFake([makeArc('r'), a], null, 10);
    assert.deepEqual(
        snapper.findDragSnap({ shapeId: 'a', end: 'start' }, { x: 163, y: 198 }),
        { shapeId: 'r', end: 'end', x: 160, y: 200 }
    );
});

test('joinDraggedEndpoint（弧の端点へのドラッグ。Phase 09-03b）: 直線の端点を弧の端点へ。replaceShape（select:true）でbezier2つを含むパスを渡す', () => {
    const arc = makeArc('r');
    const line = makeLine('a', 300, 200, 400, 200);
    line.setVertex(0, 160, 200);
    const { snapper, calls } = setupFake([arc, line], null, 5);
    assert.equal(
        snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'start' }, { shapeId: 'r', end: 'end', x: 160, y: 200 }),
        true
    );
    assert.deepEqual(calls.map((c) => c[0]), ['replaceShape']);
    const [, targetId, path, options] = calls[0];
    assert.equal(targetId, 'r');
    assert.deepEqual(options, { keepId: false, removeIds: ['a'], select: true });
    const kinds = path.toJSON().segments.map((s) => s.kind);
    assert.equal(kinds.filter((k) => k === 'bezier').length, 2);
});

test('commitDrawnLine（描き始めが弧の端点。Phase 09-03b）: 弧のidを保つ（keepId:true）・区間はbezier・bezier・line', () => {
    const arc = makeArc('r');
    const draft = makeLine(null, 160, 200, 200, 230);
    const { snapper, calls } = setupFake([arc], draft, 5);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'r', end: 'end' }, null), true);
    assert.deepEqual(calls.map((c) => c[0]), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    const [, targetId, path, options] = calls[2];
    assert.equal(targetId, 'r');
    assert.deepEqual(options, { keepId: true, removeIds: [], select: false });
    assert.deepEqual(path.toJSON().segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
});

test('実物の組み合わせ（弧の端点から描き足す。Phase 09-03b）: 直線のツールで弧の右端から引き始めて終える → 弧のidで弧の色・太さの開いたパス・履歴1件・取り消しで弧に戻る', () => {
    const arc = makeArc('r');
    const { model, history, snapper } = setupReal([arc]);
    const original = dump(model);
    const startSnap = snapper.findDrawSnap('line', { x: 162, y: 201 });
    assert.deepEqual(startSnap, { shapeId: 'r', end: 'end', x: 160, y: 200 });
    model.startDraft(160, 200, 'line');
    model.updateDraft(220, 240);
    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(260, 240);
    snapper.finishDrawnLine(startSnap);
    const shapes = dump(model);
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].id, 'r');
    assert.equal(shapes[0].type, 'path');
    assert.equal(shapes[0].closed, false);
    assert.equal(shapes[0].strokeColor, '#abcdef');
    assert.equal(shapes[0].strokeWidth, 4);
    assert.deepEqual(shapes[0].segments.map((s) => s.kind), ['bezier', 'bezier', 'line']);
    assert.deepEqual(shapes[0].points[3], { x: 220, y: 240 });
    assert.equal(history.canUndo(), true);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), original);
    assert.equal(model.getShapes()[0].toJSON().type, 'arc');
    assert.equal(history.canUndo(), false);
});
