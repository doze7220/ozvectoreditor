/**
 * 責務: VertexDragRules（頂点のまとめ移動の座標の組み立て）の規則と、吸い付く（VertexSnap）流れとの組み合わせを検証する。
 * 実物のVectorModel・HistoryManager・SnapshotAdapter・EndpointSnapperを使う。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildVertexDragUpdates } from '../../js/core/VertexDragRules.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 頂点のドラッグの記憶1つ分を作る補助。
 * @param {string} shapeId 図形のid
 * @param {number} vertexIndex 頂点インデックス
 * @param {number|null} x 押下時のX
 * @param {number|null} y 押下時のY
 * @returns {Object} VertexDragOrigin
 */
function origin(shapeId, vertexIndex, x, y) {
    return { shapeId, handle: { kind: 'vertex', vertexIndex }, vertexIndex, x, y };
}

test('点1つ（アンカーだけ）: アンカーにtargetがそのまま入る（origin + (target - origin)と一致しない値でも）', () => {
    const o = 0.7;
    const t = 0.1;
    // 前提: 足し算を通すと厳密には一致しない値の組であること
    assert.notEqual(o + (t - o), t);
    const anchor = origin('a', 2, o, 0.3);
    const origins = [anchor];
    const result = buildVertexDragUpdates(origins, anchor, { x: t, y: 0.9 }, { x: o, y: 0.3 });
    assert.deepEqual(result, [{ id: 'a', vertexIndex: 2, x: t, y: 0.9 }]);
    assert.equal(result[0].x, t);
    assert.equal(result[0].y, 0.9);
});

test('点3つ（2つの図形）: ほかの点はアンカーと同じ移動量だけ動き、並びはoriginsの順、idとvertexIndexが写る', () => {
    const p1 = origin('a', 1, 10, 20);
    const anchor = origin('b', 3, 100, 200);
    const p3 = origin('a', 0, -5, 7);
    const origins = [p1, anchor, p3];
    const result = buildVertexDragUpdates(origins, anchor, { x: 130, y: 150 }, { x: 100, y: 200 });
    assert.deepEqual(result, [
        { id: 'a', vertexIndex: 1, x: 40, y: -30 },
        { id: 'b', vertexIndex: 3, x: 130, y: 150 },
        { id: 'a', vertexIndex: 0, x: 25, y: -43 }
    ]);
});

test('anchorOriginがnullなら、ほかの点は動かずアンカーはtargetになる', () => {
    const p1 = origin('a', 1, 10, 20);
    const anchor = origin('b', 0, null, null);
    const result = buildVertexDragUpdates([p1, anchor], anchor, { x: 5, y: 6 }, null);
    assert.deepEqual(result, [
        { id: 'a', vertexIndex: 1, x: 10, y: 20 },
        { id: 'b', vertexIndex: 0, x: 5, y: 6 }
    ]);
});

test('anchorが同一性で比べられる（同じ値でも別のオブジェクトならアンカーにならない）', () => {
    const a1 = origin('a', 0, 1, 1);
    const a2 = origin('a', 0, 1, 1);
    const result = buildVertexDragUpdates([a1, a2], a2, { x: 5, y: 5 }, { x: 1, y: 1 });
    assert.deepEqual(result, [
        { id: 'a', vertexIndex: 0, x: 5, y: 5 },
        { id: 'a', vertexIndex: 0, x: 5, y: 5 }
    ]);
    // 対照: アンカーを変えると、アンカーでない方は足し算の結果（ここでは同じ値）で、アンカーはtargetそのもの
    const other = buildVertexDragUpdates([a1, a2], a1, { x: 0.1, y: 0.1 }, { x: 0.7, y: 0.7 });
    assert.equal(other[0].x, 0.1);
    assert.notEqual(other[1].x, 0.1);
});

test('引数を書き換えない・新しい配列とオブジェクトを返す', () => {
    const p1 = origin('a', 1, 10, 20);
    const anchor = origin('b', 0, 100, 200);
    const origins = [p1, anchor];
    const target = { x: 110, y: 210 };
    const anchorOrigin = { x: 100, y: 200 };
    const snapshot = JSON.stringify({ origins, target, anchorOrigin });
    const result = buildVertexDragUpdates(origins, anchor, target, anchorOrigin);
    assert.equal(JSON.stringify({ origins, target, anchorOrigin }), snapshot);
    assert.notEqual(result, origins);
    assert.notEqual(result[0], p1);
    assert.notEqual(result[1], target);
});

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・EndpointSnapperを組み合わせる（換算は等倍）。
 * @param {Array<Object>} shapes 図形
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
 * 図形一式を図形データ（toJSON）の配列で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<Object>} 図形データの配列
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

/**
 * 流れのテスト用の図形一式を作る。
 * a・b＝閉じたパス（端点を持たない）、c＝別の線の端点を持つ直線、d＝矩形（吸い付く先）。
 * @returns {Array<Object>} 図形（id代入済み）
 */
function makeShapes() {
    const a = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], true);
    a.id = 'a';
    const b = new Path([{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 400 }], true);
    b.id = 'b';
    const c = new Line(700, 700, 800, 700);
    c.id = 'c';
    const d = new Rect(1000, 1000, 1100, 1100);
    d.id = 'd';
    return [a, b, c, d];
}

/**
 * 2つの図形の点（a[1]とb[1]）を選んでa[1]を押した状態の記憶を作る。
 * @returns {{ origins: Object[], anchor: Object, anchorOrigin: {x: number, y: number} }} 記憶・アンカー・押下時のアンカーの位置
 */
function pressTwoVertices() {
    const anchor = origin('a', 1, 100, 0);
    const origins = [anchor, origin('b', 1, 400, 300)];
    return { origins, anchor, anchorOrigin: { x: 100, y: 0 } };
}

test('流れ: 2つの図形の点をまとめて動かし、押した点がほかの図形の頂点にちょうど合い、ほかの点は同じ量だけ動く。取り消し1回で戻る', () => {
    const { model, history, snapper } = setupReal(makeShapes());
    const before = dump(model);
    const { origins, anchor, anchorOrigin } = pressTwoVertices();

    const snap = snapper.findVertexDragSnap(null, origins.map((o) => o.shapeId), { x: 1003, y: 998 });
    assert.deepEqual(snap, { kind: 'vertex', x: 1000, y: 1000 });
    assert.equal(snapper.isVertexSnap(snap), true);

    const updates = buildVertexDragUpdates(origins, anchor, snap, anchorOrigin);
    history.beginEdit();
    model.updateVertices(updates);
    assert.equal(history.commitEdit(), true);

    const after = dump(model);
    const byId = (id) => after.find((s) => s.id === id);
    assert.deepEqual(byId('a').points[1], { x: 1000, y: 1000 });
    assert.deepEqual(byId('b').points[1], { x: 1300, y: 1300 });
    // 動かしていない点・吸い付いた先の図形は変わらない
    assert.deepEqual(byId('a').points[0], { x: 0, y: 0 });
    assert.deepEqual(byId('a').points[2], { x: 100, y: 100 });
    assert.deepEqual(byId('b').points[0], { x: 300, y: 300 });
    assert.deepEqual(byId('d'), before.find((s) => s.id === 'd'));
    assert.deepEqual(byId('c'), before.find((s) => s.id === 'c'));

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
});

test('流れ: 押した点を別の線の端点に近づけても結果はVertexSnapで、joinDraggedEndpointへ渡しても結合しない', () => {
    const { model, snapper } = setupReal(makeShapes());
    const before = dump(model);
    const { origins } = pressTwoVertices();

    const snap = snapper.findVertexDragSnap(null, origins.map((o) => o.shapeId), { x: 702, y: 701 });
    assert.deepEqual(snap, { kind: 'vertex', x: 700, y: 700 });
    assert.equal(snapper.joinDraggedEndpoint({ shapeId: 'a', end: 'start' }, snap), false);
    assert.deepEqual(dump(model), before);

    // 対照: 結合する吸い付き（SnapTarget）として照会すると、同じ端点の近くで端点の結果が返る（動かす点が端点のとき）
    const joinSnap = snapper.findVertexDragSnap({ shapeId: 'b', end: 'start' }, ['b'], { x: 702, y: 701 });
    assert.equal(joinSnap.shapeId, 'c');
    assert.equal(snapper.isVertexSnap(joinSnap), false);
});

test('流れ: 動かしている図形自身の頂点には吸い付かない（対照: 動かしていない図形の頂点には吸い付く）', () => {
    const { snapper } = setupReal(makeShapes());
    const near = { x: 301, y: 301 };
    assert.equal(snapper.findVertexDragSnap(null, ['a', 'b'], near), null);
    assert.deepEqual(snapper.findVertexDragSnap(null, ['a'], near), { kind: 'vertex', x: 300, y: 300 });
});
