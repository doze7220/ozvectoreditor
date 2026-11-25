/**
 * 責務: EndpointSnapperと実物のVectorModel・SnapshotAdapter・HistoryManagerを組み合わせ、端点での描き足し・閉じる・結合と線を続けて引く手順で、名前・表示・ロック・フォルダが引き継がれる/新しい名前が付くことを検証する。
 * 公開APIだけを通し、取り消し/やり直しで作業データのJSONが一致し、記録が1件であることも確かめる。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

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
 * idを直接代入した開いたパス（頂点4つ）を作る。
 * @param {string} id 代入するid
 * @returns {Path} パス
 */
function makePath(id) {
    const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], false, '#445566', 3);
    path.id = id;
    return path;
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
 * @param {Array<Object>} items モデルへ入れるアイテム
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
 * モデルの今の状態を作業データのJSON文字列にする。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function json(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

/**
 * アイテムの入れ子を、id・名前・表示・ロックだけの素のオブジェクトに写す。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<Object>} 写した入れ子（フォルダは`children`を持つ）
 */
function outline(items) {
    return items.map((item) => (item.kind === 'group'
        ? { id: item.id, name: item.name, visible: item.visible, locked: item.locked, children: outline(item.children) }
        : { id: item.shape.id, name: item.name, visible: item.visible, locked: item.locked }));
}

/**
 * 図形のidからアイテムを探す（入れ子の中も探す）。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {string} id 図形のid
 * @returns {Object|null} 図形のアイテム。無ければnull
 */
function findShapeItem(items, id) {
    for (const item of items) {
        if (item.kind === 'group') {
            const found = findShapeItem(item.children, id);
            if (found !== null) return found;
        } else if (item.shape.id === id) {
            return item;
        }
    }
    return null;
}

/**
 * 取り消しとやり直しで作業データのJSONが一致し、記録が1件だけであることを確かめる。
 * @param {VectorModel} model モデル
 * @param {HistoryManager} history 履歴
 * @param {string} before 操作前のJSON
 * @param {string} after 操作後のJSON
 */
function assertUndoRedo(model, history, before, after) {
    assert.notEqual(after, before);
    assert.equal(history.undo(), true);
    assert.equal(json(model), before);
    assert.equal(history.canUndo(), false, '記録は1件だけ');
    assert.equal(history.redo(), true);
    assert.equal(json(model), after);
}

/**
 * 直線のツールの作成途中の線を、点を打ちながら引く（最後の点は打たず、`updateDraft`で置く）。
 * @param {VectorModel} model モデル
 * @param {EndpointSnapper} snapper 手順
 * @param {Array<{x: number, y: number}>} points 始点と、続けて打つ点（最後の1つは置くだけ）
 */
function drawPoints(model, snapper, points) {
    model.startDraft(points[0].x, points[0].y, 'line');
    for (let i = 1; i < points.length; i += 1) {
        model.updateDraft(points[i].x, points[i].y);
        if (i < points.length - 1) {
            assert.equal(snapper.clickDrawnLine(null, null), true);
        }
    }
}

test('描き足し: 線の端点から描き足すと、元のidのまま名前・表示・ロック・フォルダが保たれ、パスになる', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makeLine('shape-1', 0, 0, 100, 0), 'A線', true, false)
        ]),
        shapeItem(makeLine('shape-2', 0, 50, 10, 50), 'M線', true, true)
    ]);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 0);
    assert.equal(snapper.commitDrawnLine({ shapeId: 'shape-1', end: 'end' }, null), true);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(findShapeItem(model.getItems(), 'shape-1').shape.type, 'path');
    assertUndoRedo(model, history, before, json(model));
});

test('描き足し（線を続けて引いて終える）: 描き始めが端点なら元のidのまま名前等が保たれる', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makeLine('shape-1', 0, 0, 100, 0), 'A線', true, false)
        ])
    ]);
    const before = json(model);
    const outlineBefore = outline(model.getItems());
    const startSnap = { shapeId: 'shape-1', end: 'end' };

    model.startDraft(100, 0, 'line');
    model.updateDraft(150, 50);
    assert.equal(snapper.clickDrawnLine(startSnap, null), true);
    model.updateDraft(200, 50);
    snapper.finishDrawnLine(startSnap);
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(findShapeItem(model.getItems(), 'shape-1').shape.type, 'path');
    assertUndoRedo(model, history, before, json(model));
});

test('閉じる: 開いたパスの両端で描いて閉じると、元のidのまま名前・表示・ロック・フォルダが保たれ、閉じたパスになる', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makePath('shape-1'), 'P名', true, false)
        ])
    ]);
    const before = json(model);
    const outlineBefore = outline(model.getItems());

    model.startDraft(0, 100, 'line');
    model.updateDraft(0, 0);
    assert.equal(
        snapper.commitDrawnLine({ shapeId: 'shape-1', end: 'end' }, { shapeId: 'shape-1', end: 'start' }),
        true
    );
    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(findShapeItem(model.getItems(), 'shape-1').shape.toJSON().closed, true);
    assertUndoRedo(model, history, before, json(model));
});

test('描いた線での2本の結合: 奥の線の名前等を引き継ぎ新しいidになり、別のフォルダの除かれた側の名前は消える', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makeLine('shape-1', 0, 0, 100, 0), 'A線', true, false)
        ]),
        groupItem('group-2', '乙組', true, false, [
            shapeItem(makeLine('shape-2', 200, 0, 300, 0), 'B線', true, false)
        ])
    ]);
    const before = json(model);

    model.startDraft(100, 0, 'line');
    model.updateDraft(200, 0);
    assert.equal(
        snapper.commitDrawnLine({ shapeId: 'shape-1', end: 'end' }, { shapeId: 'shape-2', end: 'start' }),
        true
    );
    const result = outline(model.getItems());
    const newId = result[0].children[0].id;
    assert.notEqual(newId, 'shape-1');
    assert.notEqual(newId, 'shape-2');
    assert.deepEqual(result, [
        { id: 'group-1', name: '甲組', visible: true, locked: false, children: [{ id: newId, name: 'A線', visible: true, locked: false }] },
        { id: 'group-2', name: '乙組', visible: true, locked: false, children: [] }
    ]);
    assert.equal(json(model).includes('B線'), false);
    assertUndoRedo(model, history, before, json(model));
});

test('端点のドラッグでの結合: 奥の線の名前等を引き継ぎ新しいidになり、結果だけが選択される', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makeLine('shape-1', 0, 0, 100, 0), 'A線', true, false)
        ]),
        groupItem('group-2', '乙組', true, false, [
            shapeItem(makeLine('shape-2', 200, 0, 300, 0), 'B線', true, false)
        ])
    ]);
    const before = json(model);
    model.setSelection(['shape-1']);

    const dragged = { shapeId: 'shape-1', end: 'end' };
    history.beginEdit();
    const snap = snapper.findDragSnap(dragged, { x: 197, y: 0 });
    assert.deepEqual(snap, { shapeId: 'shape-2', end: 'start', x: 200, y: 0 });
    model.updateVertex('shape-1', 1, snap.x, snap.y);
    assert.equal(snapper.joinDraggedEndpoint(dragged, snap), true);
    history.commitEdit();

    const result = outline(model.getItems());
    const newId = result[0].children[0].id;
    assert.notEqual(newId, 'shape-1');
    assert.notEqual(newId, 'shape-2');
    assert.deepEqual(result, [
        { id: 'group-1', name: '甲組', visible: true, locked: false, children: [{ id: newId, name: 'A線', visible: true, locked: false }] },
        { id: 'group-2', name: '乙組', visible: true, locked: false, children: [] }
    ]);
    assert.deepEqual(model.getSelectedIds(), [newId]);
    assertUndoRedo(model, history, before, json(model));
});

test('端点のドラッグでの閉じる: 自身のもう一方の端点に重ねると、元のidのまま名前・表示・ロック・フォルダが保たれる', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makePath('shape-1'), 'P名', true, false)
        ])
    ]);
    const before = json(model);
    const outlineBefore = outline(model.getItems());
    model.setSelection(['shape-1']);

    const dragged = { shapeId: 'shape-1', end: 'end' };
    history.beginEdit();
    const snap = snapper.findDragSnap(dragged, { x: 3, y: 0 });
    assert.deepEqual(snap, { shapeId: 'shape-1', end: 'start', x: 0, y: 0 });
    model.updateVertex('shape-1', 3, snap.x, snap.y);
    assert.equal(snapper.joinDraggedEndpoint(dragged, snap), true);
    history.commitEdit();

    assert.deepEqual(outline(model.getItems()), outlineBefore);
    assert.equal(findShapeItem(model.getItems(), 'shape-1').shape.toJSON().closed, true);
    assertUndoRedo(model, history, before, json(model));
});

test('線を続けて引いて終える（点2つ）: 新しい直線は「直線 <最大番号+1>」・表示・ロックなしで最外の末尾に入る', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makeLine('shape-1', 0, 500, 10, 500), '直線 3', false, true)
        ])
    ]);
    const before = json(model);

    drawPoints(model, snapper, [{ x: 0, y: 0 }, { x: 100, y: 0 }]);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    snapper.finishDrawnLine(null);

    const result = outline(model.getItems());
    assert.equal(result.length, 2);
    assert.equal(result[0].children.length, 1);
    assert.equal(result[1].name, '直線 4');
    assert.equal(result[1].visible, true);
    assert.equal(result[1].locked, false);
    assert.equal(findShapeItem(model.getItems(), result[1].id).shape.type, 'line');
    assertUndoRedo(model, history, before, json(model));
});

test('線を続けて引いて終える（点4つ）: 新しいパスは「パス <最大番号+1>」で、フォルダの中の「パス 5」も数える', () => {
    const { model, history, snapper } = setupReal([
        groupItem('group-1', '甲組', true, false, [
            shapeItem(makePath('shape-1'), 'パス 5', true, false)
        ])
    ]);
    const before = json(model);

    drawPoints(model, snapper, [{ x: 300, y: 300 }, { x: 400, y: 300 }, { x: 400, y: 400 }, { x: 300, y: 400 }]);
    assert.equal(snapper.clickDrawnLine(null, null), true);
    assert.equal(snapper.clickDrawnLine(null, null), false);

    const result = outline(model.getItems());
    assert.equal(result.length, 2);
    assert.equal(result[1].name, 'パス 6');
    assert.equal(findShapeItem(model.getItems(), result[1].id).shape.type, 'path');
    assertUndoRedo(model, history, before, json(model));
});

test('始点に吸い付いて閉じる: 新しい閉じたパスは「パス <最大番号+1>」になる', () => {
    const { model, history, snapper } = setupReal([
        shapeItem(makePath('shape-1'), 'パス 2', true, false)
    ]);
    const before = json(model);

    model.startDraft(300, 300, 'line');
    for (const p of [{ x: 400, y: 300 }, { x: 400, y: 400 }]) {
        model.updateDraft(p.x, p.y);
        snapper.clickDrawnLine(null, null);
    }
    model.updateDraft(300, 302);
    const snap = snapper.findDrawnLineSnap(null, { x: 300, y: 302 });
    assert.deepEqual(snap, { kind: 'drawnStart', x: 300, y: 300 });
    assert.equal(snapper.clickDrawnLine(null, snap), false);

    const result = outline(model.getItems());
    assert.equal(result.length, 2);
    assert.equal(result[1].name, 'パス 3');
    assert.equal(findShapeItem(model.getItems(), result[1].id).shape.toJSON().closed, true);
    assertUndoRedo(model, history, before, json(model));
});
