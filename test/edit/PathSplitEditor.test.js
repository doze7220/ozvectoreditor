/**
 * 責務: PathSplitEditor（分割・区間の削除の手順・押せるかの照会・履歴の単位）の振る舞いを検証する。
 * 実物のVectorModel・図形クラスと、呼び出しを記録する偽の記録先を扱う。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PathSplitEditor } from '../../js/edit/PathSplitEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 直線の区間の開いたパス（5点）を作る。
 * @param {string} id 図形のid
 * @param {boolean} [closed=false] 閉じるか
 * @returns {Path} パス
 */
function makePath(id, closed = false) {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: -50, y: 50 }];
    const path = new Path(points, closed, '#123456', 3, '#abcdef', 'line');
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
 * 図形のアイテムを作る。名前は`名-<id>`。
 * @param {Object} shape 図形
 * @param {boolean} [visible=true] 表示
 * @param {boolean} [locked=false] ロック
 * @returns {Object} 図形のアイテム
 */
function shapeItem(shape, visible = true, locked = false) {
    return { kind: 'shape', shape, name: `名-${shape.id}`, visible, locked };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {boolean} [visible=true] 表示
 * @param {boolean} [locked=false] ロック
 * @returns {Object} フォルダのアイテム
 */
function groupItem(id, children, visible = true, locked = false) {
    return { kind: 'group', id, name: `組-${id}`, visible, locked, children };
}

/**
 * 偽の記録先と、ローカルな呼び出し記録を作る。
 * @param {VectorModel} model モデル
 * @param {{ mode: string }} state 現在の操作モードの入れ物
 * @returns {{ editor: PathSplitEditor, calls: string[], notifications: () => number }} 手順と記録
 */
function setupFake(model, state) {
    const calls = [];
    let notified = 0;
    model.onChange(() => { notified += 1; });
    const editRecorder = {
        beginEdit: () => calls.push('beginEdit'),
        commitEdit: () => calls.push('commitEdit')
    };
    const editor = new PathSplitEditor({ model, editRecorder, getMode: () => state.mode });
    return { editor, calls, notifications: () => notified };
}

/**
 * モデルにアイテムを入れ、選択と頂点の選択（`vertex-<i>`の番号で指定）を当てる。
 * @param {Object[]} items アイテム
 * @param {string[]} selectedIds 選択する図形のid
 * @param {Array<[string, number[]]>} vertices 図形のidと点の番号の組
 * @returns {VectorModel} モデル
 */
function setupModel(items, selectedIds, vertices) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    model.setSelection(selectedIds);
    model.setSelectedVertices(pairsOf(model, vertices));
    return model;
}

/**
 * 図形のidと点の番号から、頂点の選択の組（ハンドル名）を作る。
 * @param {VectorModel} model モデル
 * @param {Array<[string, number[]]>} vertices 図形のidと点の番号の組
 * @returns {Array<{shapeId: string, handle: string}>} 頂点の選択
 */
function pairsOf(model, vertices) {
    const pairs = [];
    for (const [shapeId, indexes] of vertices) {
        const shape = model.getShapes().find((s) => s.id === shapeId);
        const names = shape.getVertexHandleNames();
        for (const index of indexes) {
            pairs.push({ shapeId, handle: names.find((name) => shape.getVertexIndexForHandle(name) === index) });
        }
    }
    return pairs;
}

/**
 * モデルのアイテムの並び（図形のみ）を`{ id, name, visible, locked, json }`の配列にする。
 * @param {VectorModel} model モデル
 * @returns {Object[]} 並び（下から上）
 */
function rows(model) {
    const list = [];
    const walk = (items) => {
        for (const item of items) {
            if (item.kind === 'group') walk(item.children);
            else list.push({ id: item.shape.id, name: item.name, visible: item.visible, locked: item.locked, json: item.shape.toJSON() });
        }
    };
    walk(model.getItems());
    return list;
}

describe('PathSplitEditor.getAvailability', () => {
    it('選択（V）のモード・点なしは両方押せない', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [1, 2]]]);
        const state = { mode: OperationMode.SELECT };
        const { editor } = setupFake(model, state);
        assert.deepEqual(editor.getAvailability(), { split: false, deleteSegments: false });
        const empty = setupModel([shapeItem(makePath('a'))], ['a'], []);
        const second = setupFake(empty, { mode: OperationMode.VERTEX });
        assert.deepEqual(second.editor.getAvailability(), { split: false, deleteSegments: false });
    });

    it('端の点だけは分割が押せず、途中の点は押せる。隣り合う2点は区間を消せる', () => {
        const state = { mode: OperationMode.VERTEX };
        const ends = setupFake(setupModel([shapeItem(makePath('a'))], ['a'], [['a', [0, 4]]]), state);
        assert.deepEqual(ends.editor.getAvailability(), { split: false, deleteSegments: false });
        const middle = setupFake(setupModel([shapeItem(makePath('a'))], ['a'], [['a', [2]]]), state);
        assert.deepEqual(middle.editor.getAvailability(), { split: true, deleteSegments: false });
        const pair = setupFake(setupModel([shapeItem(makePath('a'))], ['a'], [['a', [1, 2]]]), state);
        assert.deepEqual(pair.editor.getAvailability(), { split: true, deleteSegments: true });
    });

    it('照会は図形・選択・記録先に触れない', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [1, 2]]]);
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        editor.getAvailability();
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
        assert.equal(model.getSelectedVertices().length, 2);
    });
});

describe('PathSplitEditor.splitAtSelectedVertices', () => {
    it('開いたパスの途中の点で2本: 元の行が[0..c]、新しい線は元の行のすぐ上で同じ名前・新しいid', () => {
        const model = setupModel(
            [shapeItem(makeRect('r0')), shapeItem(makePath('a')), shapeItem(makeRect('r2'))],
            ['a'],
            [['a', [2]]]
        );
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const list = rows(model);
        assert.equal(list.length, 4);
        assert.deepEqual(list.map((r) => r.name), ['名-r0', '名-a', '名-a', '名-r2']);
        assert.equal(list[1].id, 'a');
        assert.equal(list[1].json.points.length, 3);
        assert.equal(list[2].json.points.length, 3);
        assert.notEqual(list[2].id, 'a');
        assert.equal(list[2].json.closed, false);
    });

    it('途中の点2つで3本: 後の線ほど上', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [1, 3]]]);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), true);
        const list = rows(model);
        assert.equal(list.length, 3);
        assert.deepEqual(list.map((r) => r.json.points.length), [2, 3, 2]);
        assert.deepEqual(list[0].json.points[0], { x: 0, y: 0 });
        assert.deepEqual(list[1].json.points[0], { x: 100, y: 0 });
        assert.deepEqual(list[2].json.points[0], { x: 0, y: 100 });
    });

    it('閉じたパス・矩形の1点で同じidの開いた線1本（新しい行なし）', () => {
        const model = setupModel([shapeItem(makePath('a', true)), shapeItem(makeRect('r'))], ['a', 'r'], [['a', [2]], ['r', [1]]]);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), true);
        const list = rows(model);
        assert.deepEqual(list.map((r) => r.id), ['a', 'r']);
        assert.equal(list[0].json.type, 'path');
        assert.equal(list[0].json.closed, false);
        assert.equal(list[0].json.points.length, 6);
        assert.equal(list[1].json.type, 'path');
        assert.equal(list[1].json.points.length, 5);
        assert.equal(list[1].name, '名-r');
    });

    it('フォルダの中の図形で、新しい線も同じフォルダに入る', () => {
        const model = setupModel(
            [groupItem('g1', [shapeItem(makePath('a'))]), shapeItem(makeRect('r'))],
            ['a'],
            [['a', [2]]]
        );
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), true);
        const items = model.getItems();
        assert.equal(items.length, 2);
        assert.equal(items[0].kind, 'group');
        assert.equal(items[0].children.length, 2);
        assert.deepEqual(items[0].children.map((c) => c.name), ['名-a', '名-a']);
    });

    it('複数の図形の点をまとめて切る: 記録先は1組、元の選択と新しい線が選ばれ頂点の選択は空', () => {
        const model = setupModel(
            [shapeItem(makePath('a')), shapeItem(makePath('b')), shapeItem(makeRect('r'))],
            ['a', 'b'],
            [['a', [2]], ['b', [3]]]
        );
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const ids = model.getShapes().map((s) => s.id);
        assert.equal(ids.length, 5);
        const selected = model.getSelectedIds();
        assert.equal(selected.length, 4);
        assert.ok(selected.includes('a') && selected.includes('b') && !selected.includes('r'));
        assert.deepEqual(model.getSelectedVertices(), []);
    });

    it('切れる点が無ければfalse・記録先・モデルに触れない（通知0回）', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [0, 4]]]);
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), false);
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
        assert.equal(model.getSelectedVertices().length, 2);
        const select = setupFake(setupModel([shapeItem(makePath('a'))], ['a'], []), { mode: OperationMode.SELECT });
        assert.equal(select.editor.splitAtSelectedVertices(), false);
        assert.deepEqual(select.calls, []);
    });
});

describe('PathSplitEditor.deleteSelectedSegments', () => {
    it('2本に分かれる: 引き継ぐ1本と新しい線（元のすぐ上・同じ名前）', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [1, 2]]]);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.deleteSelectedSegments(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const list = rows(model);
        assert.equal(list.length, 2);
        assert.equal(list[0].id, 'a');
        assert.deepEqual(list.map((r) => r.json.points.length), [2, 3]);
        assert.deepEqual(list.map((r) => r.name), ['名-a', '名-a']);
        assert.deepEqual(model.getSelectedVertices(), []);
        assert.equal(model.getSelectedIds().length, 2);
    });

    it('片方が点1つで消える: 先頭の区間を消すと[1..]が残る', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [0, 1]]]);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.deleteSelectedSegments(), true);
        const list = rows(model);
        assert.equal(list.length, 1);
        assert.equal(list[0].id, 'a');
        assert.equal(list[0].json.points.length, 4);
        assert.deepEqual(list[0].json.points[0], { x: 100, y: 0 });
    });

    it('直線の両端で図形ごと消え、入っていたフォルダは空で残る。選択から外れる', () => {
        const line = new Line(0, 0, 50, 50, '#000000', 2);
        line.id = 'l';
        const model = setupModel([groupItem('g1', [shapeItem(line)]), shapeItem(makeRect('r'))], ['l'], [['l', [0, 1]]]);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.deleteSelectedSegments(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        assert.deepEqual(model.getShapes().map((s) => s.id), ['r']);
        assert.equal(model.getItems()[0].kind, 'group');
        assert.deepEqual(model.getItems()[0].children, []);
        assert.deepEqual(model.getSelectedIds(), []);
    });

    it('複数の図形にまたがる（消える図形と分かれる図形）', () => {
        const line = new Line(0, 0, 50, 50, '#000000', 2);
        line.id = 'l';
        const model = setupModel(
            [shapeItem(line), shapeItem(makePath('a'))],
            ['l', 'a'],
            [['l', [0, 1]], ['a', [1, 2]]]
        );
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.deleteSelectedSegments(), true);
        assert.deepEqual(calls, ['beginEdit', 'commitEdit']);
        const list = rows(model);
        assert.equal(list.length, 2);
        assert.equal(list[0].id, 'a');
        const selected = model.getSelectedIds();
        assert.equal(selected.length, 2);
        assert.ok(!selected.includes('l'));
    });

    it('区間が無ければfalse・記録先・モデルに触れない（通知0回）', () => {
        const model = setupModel([shapeItem(makePath('a'))], ['a'], [['a', [0, 2]]]);
        const { editor, calls, notifications } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.deleteSelectedSegments(), false);
        assert.deepEqual(calls, []);
        assert.equal(notifications(), 0);
    });

    it('円・弧の点は選べず対象にならない', () => {
        const ellipse = new Ellipse(0, 0, 40, 40, '#000000', 2, null);
        ellipse.id = 'e';
        const model = setupModel([shapeItem(ellipse)], ['e'], []);
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), false);
        assert.equal(editor.deleteSelectedSegments(), false);
        assert.deepEqual(calls, []);
    });
});

describe('PathSplitEditor 表示・ロック', () => {
    it('ロックした図形・隠した図形（上のフォルダから受け継いだものを含む）の点は対象にならない', () => {
        const model = new VectorModel();
        model.replaceAllShapes([
            shapeItem(makePath('locked'), true, true),
            shapeItem(makePath('hidden'), false, false),
            groupItem('g1', [shapeItem(makePath('inHidden'))], false, false),
            groupItem('g2', [shapeItem(makePath('inLocked'))], true, true)
        ]);
        model.setSelection(['locked', 'hidden', 'inHidden', 'inLocked']);
        model.setSelectedVertices(pairsOf(model, [['locked', [2]], ['hidden', [2]], ['inHidden', [2]], ['inLocked', [2]]]));
        const { editor, calls } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.deepEqual(editor.getAvailability(), { split: false, deleteSegments: false });
        assert.equal(editor.splitAtSelectedVertices(), false);
        assert.deepEqual(calls, []);
        assert.equal(model.getShapes().length, 4);
    });

    it('新しい線は表示・ロックが元と同じ（表示・変えられる）', () => {
        const model = setupModel([groupItem('g1', [shapeItem(makePath('a'))])], ['a'], [['a', [2]]]);
        const { editor } = setupFake(model, { mode: OperationMode.VERTEX });
        assert.equal(editor.splitAtSelectedVertices(), true);
        const list = rows(model);
        assert.equal(list.length, 2);
        assert.deepEqual(list.map((r) => [r.visible, r.locked]), [[true, false], [true, false]]);
    });
});
