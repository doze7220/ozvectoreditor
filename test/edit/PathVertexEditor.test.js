/**
 * 責務: PathVertexEditor（点の追加・削除の手順・削除できるかの照会・履歴の単位）の振る舞いを検証する。
 * 実物のVectorModel・図形クラスと、呼び出しを記録する偽の記録先を扱う。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PathVertexEditor } from '../../js/edit/PathVertexEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Path } from '../../js/shapes/Path.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 直線の区間の開いたパス（4点）を作る。
 * @param {string} id 図形のid
 * @returns {Path} パス
 */
function makePath(id) {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const path = new Path(points, false, '#123456', 3, '#abcdef', 'line');
    path.id = id;
    return path;
}

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 図形のid
 * @returns {Rect} 矩形
 */
function makeRect(id) {
    const rect = new Rect(0, 0, 10, 10, '#112233', 2, null);
    rect.id = id;
    return rect;
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape 図形
 * @param {boolean} [visible=true] 表示
 * @param {boolean} [locked=false] ロック
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape, visible = true, locked = false) {
    return { kind: 'shape', shape, name: `名-${shape.id}`, visible, locked };
}

/**
 * 偽の記録先と、ローカルな呼び出し記録を作る。
 * @param {VectorModel} model モデル
 * @param {{ mode: string }} state 現在の操作モードの入れ物
 * @returns {{ editor: PathVertexEditor, calls: string[], notifications: () => number }} 手順と記録
 */
function setupFake(model, state) {
    const calls = [];
    let notified = 0;
    model.onChange(() => { notified += 1; });
    const editRecorder = {
        beginEdit: () => calls.push('beginEdit'),
        commitEdit: () => calls.push('commitEdit')
    };
    const editor = new PathVertexEditor({ model, editRecorder, getMode: () => state.mode });
    return { editor, calls, notifications: () => notified };
}

/**
 * モデルにアイテムを入れ、選択と頂点の選択を当てる。
 * @param {Object[]} items アイテム
 * @param {string[]} selectedIds 選択する図形のid
 * @param {Array<{shapeId: string, handle: string}>} vertices 頂点の選択
 * @returns {VectorModel} モデル
 */
function setupModel(items, selectedIds, vertices) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds);
    model.setSelectedVertices(vertices);
    return model;
}

/**
 * 図形のtoJSON()の値の配列を返す。
 * @param {VectorModel} model モデル
 * @returns {Object[]} 作業データ
 */
function dump(model) {
    return model.getShapes().map((s) => s.toJSON());
}

describe('PathVertexEditor.insertAt', () => {
    it('パスの区間の上に足す: 記録は1組・その図形だけが選ばれ足した点だけが選ばれる・idが同じ', () => {
        const model = setupModel([shapeItem(makePath('a'))], [], []);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.insertAt('a', { x: 50, y: 1 }, 3), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const json = dump(model)[0];
        assert.equal(json.points.length, 5);
        assert.deepEqual(json.points[1], { x: 50, y: 0 });
        assert.equal(model.getShapes()[0].id, 'a');
        assert.deepEqual(model.getSelectedIds(), ['a']);
        const vertices = model.getSelectedVertices();
        assert.equal(vertices.length, 1);
        assert.equal(vertices[0].shapeId, 'a');
        assert.equal(model.getShapes()[0].getVertexIndexForHandle(vertices[0].handle), 1);
    });

    it('選んでいない図形・別の図形を選んでいる状態でも足せ、前の選択・頂点の選択が置き換わる', () => {
        const model = setupModel(
            [shapeItem(makePath('a')), shapeItem(makeRect('r'))],
            ['r'],
            [{ shapeId: 'r', handle: 'vertex-0' }]
        );
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.insertAt('a', { x: 100, y: 50 }, 3), true);
        assert.deepEqual(model.getSelectedIds(), ['a']);
        assert.equal(model.getSelectedVertices().length, 1);
        assert.equal(model.getSelectedVertices()[0].shapeId, 'a');
    });

    it('矩形の辺の上に足すと点5つの閉じたパスになり、idが引き継がれる', () => {
        const model = setupModel([shapeItem(makeRect('r'))], [], []);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.insertAt('r', { x: 5, y: 0 }, 2), true);
        const json = dump(model)[0];
        assert.equal(json.type, 'path');
        assert.equal(json.closed, true);
        assert.equal(json.points.length, 5);
        assert.equal(model.getShapes()[0].id, 'r');
    });

    const untouched = [
        ['塗りの内側（許容幅の外）', 'a', { x: 50, y: 50 }, false, false],
        ['頂点と同じ位置（t=0）', 'a', { x: 0, y: 0 }, false, false],
        ['存在しないid', 'zzz', { x: 50, y: 0 }, false, false],
        ['隠れた図形', 'a', { x: 50, y: 0 }, true, false],
        ['ロックされた図形', 'a', { x: 50, y: 0 }, false, true]
    ];
    for (const [label, id, point, hidden, locked] of untouched) {
        it(`足せない（${label}）: false・記録先・モデルに触れない`, () => {
            const model = setupModel([shapeItem(makePath('a'), !hidden, locked)], [], []);
            const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
            const before = JSON.stringify(dump(model));
            assert.equal(editor.insertAt(id, point, 3), false);
            assert.deepEqual(calls, []);
            assert.equal(notifications(), 0);
            assert.equal(JSON.stringify(dump(model)), before);
        });
    }

    it('上のフォルダから受け継いだロックの図形・円は足せず、触れない', () => {
        const group = { kind: 'group', id: 'group-1', name: 'G', visible: true, locked: true, children: [shapeItem(makePath('a'))] };
        const circle = new Ellipse(0, 200, 100, 300, 'circle');
        circle.id = 'c';
        const model = setupModel([group, shapeItem(circle)], [], []);
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.insertAt('a', { x: 50, y: 0 }, 3), false);
        assert.equal(editor.insertAt('c', { x: 100, y: 250 }, 3), false);
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
    });
});

describe('PathVertexEditor 削除', () => {
    it('頂点の選択で点ありなら真、点なし・選択ツール（V）のモードは偽', () => {
        const withPoint = setupModel([shapeItem(makePath('a'))], ['a'], [{ shapeId: 'a', handle: 'vertex-1' }]);
        assert.equal(setupFake(withPoint, { mode: OperationMode.VERTEX }).editor.canRemoveSelectedVertices(), true);
        assert.equal(setupFake(withPoint, { mode: OperationMode.SELECT }).editor.canRemoveSelectedVertices(), false);
        const empty = setupModel([shapeItem(makePath('a'))], ['a'], []);
        assert.equal(setupFake(empty, { mode: OperationMode.VERTEX }).editor.canRemoveSelectedVertices(), false);
    });

    it('点を消す: 記録は1組・頂点の選択が空・図形は選ばれたまま・idが同じ', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [{ shapeId: 'a', handle: 'vertex-1' }]);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.removeSelectedVertices(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.equal(dump(model)[0].points.length, 3);
        assert.deepEqual(model.getSelectedVertices(), []);
        assert.deepEqual(model.getSelectedIds(), ['a']);
        assert.equal(model.getShapes()[0].id, 'a');
    });

    it('複数の図形をまとめて消す（図形ごと消える図形と残る図形の混在）: 記録は1組・消えた図形は選択から外れる', () => {
        const rect = makeRect('r');
        const model = setupModel([shapeItem(makePath('a')), shapeItem(rect)], ['a', 'r'], []);
        const pairs = rect.getVertexHandleNames().slice(0, 3).map((handle) => ({ shapeId: 'r', handle }));
        model.setSelectedVertices([{ shapeId: 'a', handle: 'vertex-0' }, ...pairs]);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.removeSelectedVertices(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.deepEqual(model.getShapes().map((s) => s.id), ['a']);
        assert.equal(dump(model)[0].points.length, 3);
        assert.deepEqual(model.getSelectedIds(), ['a']);
        assert.deepEqual(model.getSelectedVertices(), []);
    });

    it('今の曲線の点を1つ消すと直線になる', () => {
        const curve = new Curve(0, 0, 20, 10, '#000000', 2, null);
        curve.id = 'a';
        const model = setupModel([shapeItem(curve)], ['a'], []);
        model.setSelectedVertices([{ shapeId: 'a', handle: curve.getVertexHandleNames()[0] }]);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.removeSelectedVertices(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.equal(model.getShapes()[0].id, 'a');
        assert.equal(model.getShapes()[0].toJSON().type, 'line');
    });

    it('消す点が無いとき・選択ツール（V）のときは false で記録先・モデルに触れない', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], []);
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.removeSelectedVertices(), false);
        const selectModel = setupModel([shapeItem(makePath('a'))], ['a'], [{ shapeId: 'a', handle: 'vertex-1' }]);
        const fake = setupFake(selectModel, { mode: OperationMode.SELECT });
        assert.equal(fake.editor.removeSelectedVertices(), false);
        assert.deepEqual(calls, []);
        assert.deepEqual(fake.calls, []);
        assert.equal(notifications(), 0);
        assert.equal(fake.notifications(), 0);
    });

    it('ロックした図形の点は頂点の選択に入らず、対象にならない', () => {
        const model = setupModel([shapeItem(makePath('a'), true, true)], ['a'], [{ shapeId: 'a', handle: 'vertex-1' }]);
        assert.deepEqual(model.getSelectedVertices(), []);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.canRemoveSelectedVertices(), false);
        assert.equal(editor.removeSelectedVertices(), false);
        assert.deepEqual(calls, []);
    });
});
