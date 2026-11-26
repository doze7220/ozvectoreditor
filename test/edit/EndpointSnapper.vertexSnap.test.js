/**
 * 責務: EndpointSnapperの吸い付くだけ（ほかの図形の頂点への吸い付き）の照会と、吸い付くだけを結合として扱わない関門の振る舞いを、偽のmodel・editRecorderで検証する。
 * 最初の表の場面ごとの欄（描き始め・2つ目の点・線を引いている途中・頂点のドラッグ・Ctrlの列）を、結果の種類と結合への反映で確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';
import { addDrawnPoint } from '../../js/shapes/PathJoinRules.js';

/**
 * idを直接代入した直線を作る。
 * @param {*} id 代入するid
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
 * @param {*} id 代入するid
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
 * idを直接代入した矩形を作る。
 * @param {*} id 代入するid
 * @param {number} x1 角1のx
 * @param {number} y1 角1のy
 * @param {number} x2 角2のx
 * @param {number} y2 角2のy
 * @returns {Rect} 矩形
 */
function makeRect(id, x1, y1, x2, y2) {
    const rect = new Rect(x1, y1, x2, y2, '#000000', 2);
    rect.id = id;
    return rect;
}

/**
 * 偽のmodel・editRecorder・screenLengthToWorldとEndpointSnapperを作る（呼び出しはすべて記録する）。
 * @param {Array<Object>} shapes getShapes・getEditableShapesが返す図形（重なり順。奥が先）
 * @param {Object|null} draft getDraftShapeが返す作成途中の図形
 * @param {number} [tolerance=8] screenLengthToWorldが返す値
 * @returns {{ snapper: EndpointSnapper, calls: Array<Array<*>>, lengths: Array<number> }} 手順と呼び出し記録
 */
function setupFake(shapes, draft, tolerance = 8) {
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

/**
 * 吸い付くだけの結果（VertexSnap）を作る。
 * @param {number} x x
 * @param {number} y y
 * @returns {{kind: string, x: number, y: number}} 吸い付くだけの結果
 */
function vertex(x, y) {
    return { kind: 'vertex', x, y };
}

/**
 * 頂点が(500,0)にある閉じたパスを作る。
 * @param {*} id 代入するid
 * @returns {Path} 閉じたパス
 */
function makeClosedAt500(id) {
    return makePath(id, [{ x: 500, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 100 }], true);
}

// ---- 描き始め（findDrawStartSnap） ----

test('findDrawStartSnap: 直線・曲線のツールで端点だけ近ければSnapTarget', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    for (const type of ['line', 'curve']) {
        const { snapper } = setupFake([a], null);
        assert.deepEqual(snapper.findDrawStartSnap(type, { x: 103, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
    }
});

test('findDrawStartSnap: ほかの頂点（閉じたパスの点・矩形の角）だけ近ければVertexSnap', () => {
    const cp = makeClosedAt500('cp');
    const r = makeRect('r', 200, 200, 300, 300);
    const { snapper } = setupFake([cp, r], null);
    assert.deepEqual(snapper.findDrawStartSnap('line', { x: 503, y: 2 }), vertex(500, 0));
    assert.deepEqual(snapper.findDrawStartSnap('curve', { x: 203, y: 201 }), vertex(200, 200));
});

test('findDrawStartSnap: 端点と頂点の両方が近いとき、近い方。同じ距離ならSnapTarget', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const cp = makePath('cp', [{ x: 110, y: 0 }, { x: 110, y: 50 }, { x: 160, y: 50 }], true);
    const { snapper } = setupFake([a, cp], null);
    assert.deepEqual(snapper.findDrawStartSnap('line', { x: 103, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
    assert.deepEqual(snapper.findDrawStartSnap('line', { x: 107, y: 0 }), vertex(110, 0));
    assert.deepEqual(snapper.findDrawStartSnap('line', { x: 105, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
});

test('findDrawStartSnap: 矩形・円・弧のツールは端点の近くでもVertexSnap（結合する吸い付きを返さない）', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    for (const type of ['rect', 'circle', 'arc']) {
        const { snapper } = setupFake([a], null);
        assert.deepEqual(snapper.findDrawStartSnap(type, { x: 101, y: 0 }), vertex(100, 0));
    }
});

test('findDrawStartSnap: pathと未知の種別はnull。頂点の近くでも・換算も呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    for (const type of ['path', 'unknown', null, undefined]) {
        const { snapper, lengths, calls } = setupFake([a], null);
        assert.equal(snapper.findDrawStartSnap(type, { x: 101, y: 0 }), null);
        assert.deepEqual(lengths, []);
        assert.deepEqual(calls, []);
    }
});

test('findDrawStartSnap: 許容距離はscreenLengthToWorld(8)の戻り値', () => {
    const cp = makeClosedAt500('cp');
    const far = { x: 515, y: 0 };
    const wide = setupFake([cp], null, 20);
    assert.deepEqual(wide.snapper.findDrawStartSnap('rect', far), vertex(500, 0));
    assert.deepEqual([...new Set(wide.lengths)], [8]);
    const narrow = setupFake([cp], null, 10);
    assert.equal(narrow.snapper.findDrawStartSnap('rect', far), null);
    assert.deepEqual([...new Set(narrow.lengths)], [8]);
});

test('findDrawStartSnap: 何も近くになければnull', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper } = setupFake([a], null);
    assert.equal(snapper.findDrawStartSnap('line', { x: 300, y: 300 }), null);
    assert.equal(snapper.findDrawStartSnap('rect', { x: 300, y: 300 }), null);
});

// ---- 2つ目の点（findDrawEndSnap） ----

test('findDrawEndSnap: 矩形は端点の近くでもVertexSnap', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper } = setupFake([a], null);
    assert.deepEqual(snapper.findDrawEndSnap('rect', { x: 101, y: 0 }), vertex(100, 0));
});

test('findDrawEndSnap: 円・弧・直線・曲線・未知はnullで、screenLengthToWorldを呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    for (const type of ['circle', 'arc', 'line', 'curve', 'path', 'unknown']) {
        const { snapper, lengths, calls } = setupFake([a], null);
        assert.equal(snapper.findDrawEndSnap(type, { x: 101, y: 0 }), null);
        assert.deepEqual(lengths, []);
        assert.deepEqual(calls, []);
    }
});

// ---- 線を引いている途中（findDrawnLinePointSnap） ----

test('findDrawnLinePointSnap: 作成途中の図形が無ければnullで換算も呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const { snapper, lengths } = setupFake([a], null);
    assert.equal(snapper.findDrawnLinePointSnap(null, { x: 100, y: 0 }), null);
    assert.deepEqual(lengths, []);
});

test('findDrawnLinePointSnap: 端点＝SnapTarget', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 500, 500, 510, 500);
    const { snapper } = setupFake([a], draft);
    assert.deepEqual(snapper.findDrawnLinePointSnap(null, { x: 103, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
});

test('findDrawnLinePointSnap: 自分の始点（打った点3つ以上・描き始めの吸い付きなし）＝DrawnStartSnap', () => {
    const draft = addDrawnPoint(addDrawnPoint(makeLine(null, 300, 300, 400, 300)));
    const { snapper } = setupFake([], draft);
    assert.deepEqual(snapper.findDrawnLinePointSnap(null, { x: 303, y: 300 }), { kind: 'drawnStart', x: 300, y: 300 });
});

test('findDrawnLinePointSnap: ほかの頂点＝VertexSnap', () => {
    const cp = makeClosedAt500('cp');
    const draft = makeLine(null, 900, 900, 910, 900);
    const { snapper } = setupFake([cp], draft);
    assert.deepEqual(snapper.findDrawnLinePointSnap(null, { x: 503, y: 2 }), vertex(500, 0));
});

test('findDrawnLinePointSnap: 端点と頂点が同じ距離なら端点（SnapTarget）。始点と頂点が同じ距離なら始点（DrawnStartSnap）', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const cp = makePath('cp', [{ x: 110, y: 0 }, { x: 110, y: 50 }, { x: 160, y: 50 }], true);
    const near = setupFake([a, cp], makeLine(null, 900, 900, 910, 900));
    assert.deepEqual(near.snapper.findDrawnLinePointSnap(null, { x: 105, y: 0 }), { shapeId: 'a', end: 'end', x: 100, y: 0 });
    assert.deepEqual(near.snapper.findDrawnLinePointSnap(null, { x: 107, y: 0 }), vertex(110, 0));

    const cp3 = makePath('cp3', [{ x: 310, y: 300 }, { x: 310, y: 400 }, { x: 360, y: 400 }], true);
    const draft = addDrawnPoint(addDrawnPoint(makeLine(null, 300, 300, 400, 300)));
    const start = setupFake([cp3], draft);
    assert.deepEqual(start.snapper.findDrawnLinePointSnap(null, { x: 305, y: 300 }), { kind: 'drawnStart', x: 300, y: 300 });
});

test('findDrawnLinePointSnap: 描き始めが端点（SnapTarget）ならその線の途中の点にVertexSnapしない。ほかの図形の頂点にはする。その線のもう一方の端点にはSnapTarget', () => {
    const p = makePath('p', [{ x: 0, y: 600 }, { x: 50, y: 600 }, { x: 50, y: 650 }, { x: 0, y: 650 }]);
    const cp = makeClosedAt500('cp');
    const draft = makeLine(null, 0, 600, 200, 600);
    const { snapper } = setupFake([p, cp], draft);
    const startSnap = { shapeId: 'p', end: 'start' };
    assert.equal(snapper.findDrawnLinePointSnap(startSnap, { x: 52, y: 601 }), null);
    assert.equal(snapper.findDrawnLinePointSnap(startSnap, { x: 2, y: 600 }), null);
    assert.deepEqual(snapper.findDrawnLinePointSnap(startSnap, { x: 2, y: 650 }), { shapeId: 'p', end: 'end', x: 0, y: 650 });
    assert.deepEqual(snapper.findDrawnLinePointSnap(startSnap, { x: 503, y: 2 }), vertex(500, 0));

    // 対照: 描き始めが端点でなければ、同じ線の途中の点に吸い付く
    assert.deepEqual(snapper.findDrawnLinePointSnap(null, { x: 52, y: 601 }), vertex(50, 600));
    assert.deepEqual(snapper.findDrawnLinePointSnap({ shapeId: 'cp', end: 'start' }, { x: 52, y: 601 }), vertex(50, 600));
});

test('findDrawnLinePointSnap: 描き始めがVertexSnapなら描き始めの吸い付きが無い線と同じ（その図形の頂点にも・自分の始点にも吸い付く）', () => {
    const cp = makeClosedAt500('cp');
    const startSnap = vertex(500, 0);
    const first = setupFake([cp], makeLine(null, 500, 0, 700, 0));
    assert.deepEqual(first.snapper.findDrawnLinePointSnap(startSnap, { x: 503, y: 2 }), vertex(500, 0));

    const draft = addDrawnPoint(addDrawnPoint(makeLine(null, 300, 300, 400, 300)));
    const second = setupFake([], draft);
    assert.deepEqual(second.snapper.findDrawnLinePointSnap(startSnap, { x: 303, y: 300 }), { kind: 'drawnStart', x: 300, y: 300 });
});

// ---- 頂点のドラッグ（findVertexDragSnap） ----

test('findVertexDragSnap: draggedありで別の線の端点＝SnapTarget', () => {
    const p = makePath('p', [{ x: 0, y: 600 }, { x: 50, y: 600 }, { x: 50, y: 650 }, { x: 0, y: 650 }]);
    const b = makeLine('b', 300, 600, 400, 600);
    const { snapper } = setupFake([p, b], null);
    assert.deepEqual(
        snapper.findVertexDragSnap({ shapeId: 'p', end: 'start' }, ['p'], { x: 402, y: 600 }),
        { shapeId: 'b', end: 'end', x: 400, y: 600 }
    );
});

test('findVertexDragSnap: 自分のもう一方の端点（頂点4つ以上の開いたパス）＝SnapTarget', () => {
    const p = makePath('p', [{ x: 0, y: 600 }, { x: 50, y: 600 }, { x: 50, y: 650 }, { x: 0, y: 650 }]);
    const { snapper } = setupFake([p], null);
    assert.deepEqual(
        snapper.findVertexDragSnap({ shapeId: 'p', end: 'start' }, ['p'], { x: 2, y: 650 }),
        { shapeId: 'p', end: 'end', x: 0, y: 650 }
    );
});

test('findVertexDragSnap: 頂点2つの直線のもう一方の端点＝null（自分の図形の頂点も候補にしない）', () => {
    const l2 = makeLine('l2', 0, 0, 100, 0);
    const { snapper } = setupFake([l2], null);
    assert.equal(snapper.findVertexDragSnap({ shapeId: 'l2', end: 'start' }, ['l2'], { x: 102, y: 0 }), null);
});

test('findVertexDragSnap: ほかの図形の頂点＝VertexSnap。端点と頂点が同じ距離ならSnapTarget', () => {
    const p = makePath('p', [{ x: 0, y: 600 }, { x: 50, y: 600 }, { x: 50, y: 650 }, { x: 0, y: 650 }]);
    const cp = makeClosedAt500('cp');
    const b = makeLine('b', 300, 600, 400, 600);
    const cp4 = makePath('cp4', [{ x: 410, y: 600 }, { x: 410, y: 700 }, { x: 460, y: 700 }], true);
    const { snapper } = setupFake([p, cp, b, cp4], null);
    const dragged = { shapeId: 'p', end: 'start' };
    assert.deepEqual(snapper.findVertexDragSnap(dragged, ['p'], { x: 503, y: 2 }), vertex(500, 0));
    assert.deepEqual(snapper.findVertexDragSnap(dragged, ['p'], { x: 405, y: 600 }), { shapeId: 'b', end: 'end', x: 400, y: 600 });
    assert.deepEqual(snapper.findVertexDragSnap(dragged, ['p'], { x: 407, y: 600 }), vertex(410, 600));
});

test('findVertexDragSnap: draggedがnull（端点でない点・2つ以上）なら別の線の端点の近くでもVertexSnap', () => {
    const b = makeLine('b', 300, 600, 400, 600);
    const { snapper } = setupFake([b], null);
    assert.deepEqual(snapper.findVertexDragSnap(null, [], { x: 402, y: 600 }), vertex(400, 600));
});

test('findVertexDragSnap: movingShapeIdsの図形（2つ以上の図形）の点には吸い付かず、ほかの図形の点には吸い付く', () => {
    const b = makeLine('b', 300, 600, 400, 600);
    const cp = makeClosedAt500('cp');
    const cp5 = makePath('cp5', [{ x: 700, y: 700 }, { x: 800, y: 700 }, { x: 800, y: 800 }], true);
    const { snapper } = setupFake([b, cp, cp5], null);
    assert.equal(snapper.findVertexDragSnap(null, ['b', 'cp'], { x: 402, y: 600 }), null);
    assert.equal(snapper.findVertexDragSnap(null, ['b', 'cp'], { x: 503, y: 2 }), null);
    assert.deepEqual(snapper.findVertexDragSnap(null, ['b', 'cp'], { x: 703, y: 701 }), vertex(700, 700));
});

// ---- isVertexSnap ----

test('isVertexSnap: VertexSnapで真。SnapTarget・DrawnStartSnap・null・undefinedで偽', () => {
    const { snapper, calls } = setupFake([], null);
    assert.equal(snapper.isVertexSnap(vertex(1, 2)), true);
    assert.equal(snapper.isVertexSnap({ shapeId: 'a', end: 'end', x: 0, y: 0 }), false);
    assert.equal(snapper.isVertexSnap({ kind: 'drawnStart', x: 0, y: 0 }), false);
    assert.equal(snapper.isVertexSnap(null), false);
    assert.equal(snapper.isVertexSnap(undefined), false);
    assert.deepEqual(calls, []);
});

// ---- 関門（吸い付くだけを結合として扱わない） ----

test('関門 commitDrawnLine: VertexSnapだけならfalseでモデル・記録先・換算を呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 200, 0, 300, 0);
    for (const [start, end] of [[vertex(1, 1), vertex(2, 2)], [null, vertex(2, 2)], [vertex(1, 1), null]]) {
        const { snapper, calls, lengths } = setupFake([a], draft, 5);
        assert.equal(snapper.commitDrawnLine(start, end), false);
        assert.deepEqual(calls, []);
        assert.deepEqual(lengths, []);
    }
});

test('関門 commitDrawnLine: (VertexSnap, SnapTarget)は(null, SnapTarget)と同じ呼び出し（描き足し）', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 200, 0, 100, 0);
    const endSnap = { shapeId: 'a', end: 'end', x: 100, y: 0 };
    const withVertex = setupFake([a], draft, 5);
    const withNull = setupFake([a], draft, 5);
    assert.equal(withVertex.snapper.commitDrawnLine(vertex(200, 0), endSnap), true);
    assert.equal(withNull.snapper.commitDrawnLine(null, endSnap), true);
    assert.deepEqual(names(withVertex.calls), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    assert.deepEqual(names(withVertex.calls), names(withNull.calls));
    assert.equal(withVertex.calls[2][1], withNull.calls[2][1]);
    assert.deepEqual(withVertex.calls[2][2].toJSON(), withNull.calls[2][2].toJSON());
    assert.deepEqual(withVertex.calls[2][3], withNull.calls[2][3]);
});

test('関門 clickDrawnLine: (null, VertexSnap)・(VertexSnap, VertexSnap)は点を打つだけ（true・replaceDraftだけ・記録先に触れない）', () => {
    const draft = makeLine(null, 0, 0, 100, 0);
    for (const [start, end] of [[null, vertex(100, 0)], [vertex(0, 0), vertex(100, 0)]]) {
        const { snapper, calls } = setupFake([], draft, 5);
        assert.equal(snapper.clickDrawnLine(start, end), true);
        assert.deepEqual(names(calls), ['replaceDraft']);
        assert.deepEqual(calls[0][1].toJSON().points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }]);
    }
});

test('関門 clickDrawnLine: (VertexSnap, SnapTarget)は(null, SnapTarget)と同じ', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makePath(null, [{ x: 200, y: 0 }, { x: 150, y: 50 }, { x: 100, y: 0 }]);
    const endSnap = { shapeId: 'a', end: 'end', x: 100, y: 0 };
    const withVertex = setupFake([a], draft, 5);
    const withNull = setupFake([a], draft, 5);
    assert.equal(withVertex.snapper.clickDrawnLine(vertex(200, 0), endSnap), false);
    assert.equal(withNull.snapper.clickDrawnLine(null, endSnap), false);
    assert.deepEqual(names(withVertex.calls), ['cancelDraft', 'beginEdit', 'replaceShape', 'commitEdit']);
    assert.deepEqual(names(withVertex.calls), names(withNull.calls));
    assert.deepEqual(withVertex.calls[2][2].toJSON(), withNull.calls[2][2].toJSON());
    assert.deepEqual(withVertex.calls[2][3], withNull.calls[2][3]);
});

test('関門 finishDrawnLine: VertexSnapは新しい線として確定する（null と同じ。replaceDraft・beginEdit・commitDraft・commitEdit）', () => {
    const draft = makePath(null, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
    const withVertex = setupFake([], draft, 5);
    const withNull = setupFake([], draft, 5);
    withVertex.snapper.finishDrawnLine(vertex(0, 0));
    withNull.snapper.finishDrawnLine(null);
    assert.deepEqual(names(withVertex.calls), ['replaceDraft', 'beginEdit', 'commitDraft', 'commitEdit']);
    assert.deepEqual(names(withVertex.calls), names(withNull.calls));
    assert.deepEqual(withVertex.calls[0][1].toJSON(), withNull.calls[0][1].toJSON());
});

test('関門 joinDraggedEndpoint: VertexSnapはfalseでreplaceShapeを呼ばない', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const b = makeLine('b', 300, 0, 400, 0);
    const { snapper, calls } = setupFake([a, b], null, 5);
    assert.equal(snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'end' }, vertex(300, 0)), false);
    assert.deepEqual(calls, []);
});

test('関門 Ctrlの列: nullを渡したときの結果が今のまま（commitDrawnLine(null, null)=false・何も呼ばない・joinDraggedEndpointはfalse）', () => {
    const a = makeLine('a', 0, 0, 100, 0);
    const draft = makeLine(null, 200, 0, 300, 0);
    const { snapper, calls } = setupFake([a], draft, 5);
    assert.equal(snapper.commitDrawnLine(null, null), false);
    assert.equal(snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'end' }, null), false);
    assert.deepEqual(calls, []);
});

test('今の照会（findDrawSnap・findDragSnap・findDrawnLineSnap）は頂点の近くでも今までどおりnull（吸い付くだけを返さない）', () => {
    const cp = makeClosedAt500('cp');
    const r = makeRect('r', 200, 200, 300, 300);
    const draft = makeLine(null, 900, 900, 910, 900);
    const { snapper } = setupFake([cp, r], draft);
    assert.equal(snapper.findDrawSnap('line', { x: 503, y: 2 }), null);
    assert.equal(snapper.findDrawSnap('rect', { x: 203, y: 201 }), null);
    assert.equal(snapper.findDragSnap({ shapeId: 'zzz', end: 'start' }, { x: 503, y: 2 }), null);
    assert.equal(snapper.findDrawnLineSnap(null, { x: 503, y: 2 }), null);
    assert.equal(snapper.findDrawnLineSnap(null, { x: 203, y: 201 }), null);
});
