/**
 * 責務: EndpointSnapperの吸い付くだけ（ほかの図形の頂点への吸い付き）の流れを、実物のVectorModel・SnapshotAdapter・HistoryManagerと組み合わせて検証する。
 * 隠した・ロックした図形に吸い付かないこと、直線・矩形のツールで頂点の座標にちょうど点が打たれること、結合しないこと、取り消し1回で戻ることを確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * idを直接代入した図形を返す補助。
 * @param {Object} shape 図形
 * @param {string} id 代入するid
 * @returns {Object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @param {string} name 名前
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape, name, visible, locked) {
    return { kind: 'shape', shape, name, visible, locked };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {string} name 名前
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @param {Array<Object>} children 中身
 * @returns {Object} フォルダのアイテム
 */
function groupItem(id, name, visible, locked, children) {
    return { kind: 'group', id, name, visible, locked, children };
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・EndpointSnapperを組み合わせる（換算は等倍）。
 * @param {Array<Object>} items モデルへ入れるアイテムまたは図形
 * @returns {{ model: VectorModel, history: HistoryManager, snapper: EndpointSnapper }} 組み合わせた実物
 */
function setupReal(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
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
 * idから図形データ（toJSON）を探す。
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {Object|undefined} 図形データ
 */
function dataOf(model, id) {
    return dump(model).find((d) => d.id === id);
}

/**
 * 円の中心（図形データのpoints[0]）を返す。
 * @param {Object} circle 円
 * @returns {{x: number, y: number}} 中心
 */
function centerOf(circle) {
    const p = circle.toJSON().points[0];
    return { x: p.x, y: p.y };
}

test('隠した図形・ロックした図形（フォルダから受け継いだものを含む）の点には、新しい照会のどれも吸い付かない', () => {
    const hiddenRect = withId(new Rect(100, 100, 200, 200), 'hr');
    const lockedCircle = withId(new Ellipse(400, 400, 500, 500, 'circle'), 'lc');
    const inheritedRect = withId(new Rect(700, 700, 800, 800), 'ir');
    const { model, snapper } = setupReal([
        shapeItem(hiddenRect, 'hidden', false, false),
        shapeItem(lockedCircle, 'locked', true, true),
        groupItem('g', 'g', true, true, [shapeItem(inheritedRect, 'inherited', true, false)])
    ]);
    model.startDraft(900, 900, 'line');
    model.updateDraft(950, 900);
    const cc = centerOf(lockedCircle);
    const spots = [{ x: 101, y: 101 }, { x: cc.x + 1, y: cc.y + 1 }, { x: 701, y: 701 }];
    for (const p of spots) {
        assert.equal(snapper.findDrawStartSnap('line', p), null);
        assert.equal(snapper.findDrawStartSnap('rect', p), null);
        assert.equal(snapper.findDrawEndSnap('rect', p), null);
        assert.equal(snapper.findDrawnLinePointSnap(null, p), null);
        assert.equal(snapper.findVertexDragSnap(null, [], p), null);
    }

    // 対照: 同じ図形・同じ点でも、表示してロックを外せば吸い付く
    const open = setupReal([
        shapeItem(hiddenRect, 'hidden', true, false),
        shapeItem(lockedCircle, 'locked', true, false),
        groupItem('g', 'g', true, false, [shapeItem(inheritedRect, 'inherited', true, false)])
    ]);
    open.model.startDraft(900, 900, 'line');
    open.model.updateDraft(950, 900);
    const expected = [{ x: 100, y: 100 }, cc, { x: 700, y: 700 }];
    spots.forEach((p, i) => {
        const snap = open.snapper.findDrawnLinePointSnap(null, p);
        assert.equal(snap.kind, 'vertex');
        assert.equal(snap.x, expected[i].x);
        assert.equal(snap.y, expected[i].y);
    });
});

test('直線のツールの流れ（点2つ）: 矩形の角から描き始め、円の中心に点を打ち、同じ位置でもう一度クリックして終えると直線が1本増える。矩形・円は変わらない。undo1回で消えredoで戻る', () => {
    const rect = withId(new Rect(100, 100, 200, 200), 'r');
    const circle = withId(new Ellipse(400, 400, 500, 500, 'circle'), 'c');
    const { model, history, snapper } = setupReal([rect, circle]);
    const cc = centerOf(circle);
    const before = dump(model);

    const startSnap = snapper.findDrawStartSnap('line', { x: 103, y: 101 });
    assert.deepEqual(startSnap, { kind: 'vertex', x: 100, y: 100 });
    model.startDraft(startSnap.x, startSnap.y, 'line');
    model.updateDraft(300, 300);

    const mid = snapper.findDrawnLinePointSnap(startSnap, { x: cc.x + 2, y: cc.y - 1 });
    assert.deepEqual(mid, { kind: 'vertex', x: cc.x, y: cc.y });
    model.updateDraft(mid.x, mid.y);
    assert.equal(snapper.clickDrawnLine(startSnap, mid), true);
    assert.equal(model.getShapes().length, 2);
    assert.deepEqual(model.getDraftShape().toJSON().points, [
        { x: 100, y: 100 }, { x: cc.x, y: cc.y }, { x: cc.x, y: cc.y }
    ]);

    const again = snapper.findDrawnLinePointSnap(startSnap, { x: cc.x + 1, y: cc.y + 1 });
    assert.deepEqual(again, { kind: 'vertex', x: cc.x, y: cc.y });
    model.updateDraft(again.x, again.y);
    assert.equal(snapper.clickDrawnLine(startSnap, again), false);

    const after = dump(model);
    assert.equal(after.length, 3);
    assert.equal(after[2].type, 'line');
    assert.deepEqual(after[2].points, [{ x: 100, y: 100 }, { x: cc.x, y: cc.y }]);
    assert.deepEqual(after.slice(0, 2), before);

    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
    assert.equal(history.redo(), true);
    assert.deepEqual(dump(model), after);
});

test('直線のツールの流れ（点3つ以上）: もう1点打つとパスになり、角・円の中心の座標とちょうど同じ。undo1回で消える', () => {
    const rect = withId(new Rect(100, 100, 200, 200), 'r');
    const circle = withId(new Ellipse(400, 400, 500, 500, 'circle'), 'c');
    const { model, history, snapper } = setupReal([rect, circle]);
    const cc = centerOf(circle);
    const before = dump(model);

    const startSnap = snapper.findDrawStartSnap('line', { x: 98, y: 102 });
    assert.deepEqual(startSnap, { kind: 'vertex', x: 100, y: 100 });
    model.startDraft(startSnap.x, startSnap.y, 'line');
    model.updateDraft(300, 300);
    const mid = snapper.findDrawnLinePointSnap(startSnap, { x: cc.x - 2, y: cc.y + 2 });
    model.updateDraft(mid.x, mid.y);
    assert.equal(snapper.clickDrawnLine(startSnap, mid), true);

    model.updateDraft(700, 200);
    const free = snapper.findDrawnLinePointSnap(startSnap, { x: 700, y: 200 });
    assert.equal(free, null);
    assert.equal(snapper.clickDrawnLine(startSnap, free), true);
    assert.equal(snapper.clickDrawnLine(startSnap, snapper.findDrawnLinePointSnap(startSnap, { x: 700, y: 200 })), false);

    const after = dump(model);
    assert.equal(after.length, 3);
    assert.equal(after[2].type, 'path');
    assert.deepEqual(after[2].points, [{ x: 100, y: 100 }, { x: cc.x, y: cc.y }, { x: 700, y: 200 }]);
    assert.deepEqual(after.slice(0, 2), before);
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
});

test('直線のツールでほかの線の途中の点でクリックしても、描き足し・結合にならない（その線のidと点が変わらない）', () => {
    const p = withId(new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], false, '#445566', 3), 'p');
    const { model, snapper } = setupReal([p]);
    const pBefore = dataOf(model, 'p');

    model.startDraft(300, 300, 'line');
    model.updateDraft(150, 150);
    const snap = snapper.findDrawnLinePointSnap(null, { x: 102, y: 1 });
    assert.deepEqual(snap, { kind: 'vertex', x: 100, y: 0 });
    model.updateDraft(snap.x, snap.y);
    assert.equal(snapper.clickDrawnLine(null, snap), true);
    assert.equal(snapper.clickDrawnLine(null, snapper.findDrawnLinePointSnap(null, { x: 100, y: 0 })), false);

    const after = dump(model);
    assert.equal(after.length, 2);
    assert.deepEqual(after[0], pBefore);
    assert.equal(after[0].id, 'p');
    assert.deepEqual(after[1].points, [{ x: 300, y: 300 }, { x: 100, y: 0 }]);
});

test('矩形のツールの流れ: 1つ目・2つ目の角を頂点に合わせ、commitDrawnLineはfalse。呼び出し側のcommitDraftで矩形が1つ増え、角が頂点の座標とちょうど同じ。undo1回で消える', () => {
    const line = withId(new Line(0, 0, 100, 0, '#112233', 2), 'a');
    const circle = withId(new Ellipse(400, 400, 500, 500, 'circle'), 'c');
    const { model, history, snapper } = setupReal([line, circle]);
    const cc = centerOf(circle);
    const before = dump(model);

    const startSnap = snapper.findDrawStartSnap('rect', { x: 103, y: 2 });
    assert.deepEqual(startSnap, { kind: 'vertex', x: 100, y: 0 });
    model.startDraft(startSnap.x, startSnap.y, 'rect');
    const endSnap = snapper.findDrawEndSnap('rect', { x: cc.x + 2, y: cc.y - 3 });
    assert.deepEqual(endSnap, { kind: 'vertex', x: cc.x, y: cc.y });
    model.updateDraft(endSnap.x, endSnap.y);

    assert.equal(snapper.commitDrawnLine(startSnap, endSnap), false);
    history.beginEdit();
    model.commitDraft({ atInsertTarget: true });
    history.commitEdit();

    const after = dump(model);
    assert.equal(after.length, 3);
    assert.deepEqual(after.slice(0, 2), before);
    assert.equal(after[2].type, 'rect');
    assert.ok(after[2].points.some((q) => q.x === 100 && q.y === 0));
    assert.ok(after[2].points.some((q) => q.x === cc.x && q.y === cc.y));
    assert.equal(history.undo(), true);
    assert.deepEqual(dump(model), before);
    assert.equal(history.canUndo(), false);
});
