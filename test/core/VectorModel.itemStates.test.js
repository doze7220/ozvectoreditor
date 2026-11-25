/**
 * 責務: VectorModelの表示・ロックの照会（見えている図形・変えられる図形・選んでいる変えられる図形・消えるものがあるか）、
 * 値を変える操作`setItemStates`、頂点の選択が変えられる図形だけになることを、公開APIで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @returns {Line} 直線
 */
function makeLine(id) {
    const line = new Line(0, 0, 10, 0, '#000000', 1);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る（表示・ロックの値は渡したときだけ持つ）。
 * @param {string} id 図形のid
 * @param {Object} [states] `visible`・`locked`
 * @returns {Object} 図形のアイテム
 */
const s = (id, states = {}) => ({ kind: 'shape', shape: makeLine(id), ...states });

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [states] `visible`・`locked`・`collapsed`
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, states = {}) => ({ kind: 'group', id, children, ...states });

/**
 * 図形の配列をidの配列にする。
 * @param {Array<Object>} shapes 図形の配列
 * @returns {Array<string>} id
 */
const ids = (shapes) => shapes.map((shape) => shape.id);

/**
 * モデルを作り、アイテムを入れて通知の回数を数える。
 * @param {Array<Object>} items 入れるアイテム
 * @returns {{ model: VectorModel, count: () => number }} モデルと通知回数
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    let n = 0;
    model.onChange(() => { n++; });
    return { model, count: () => n };
}

/**
 * 隠れた図形・ロックした図形・フォルダから受け継いだ図形が混ざる入れ子を作る。
 * @returns {Array<Object>} 入れ子（重なり順 a, b, c, d, e, f）
 */
function mixedItems() {
    return [
        s('a'),
        s('b', { visible: false }),
        s('c', { locked: true }),
        g('hid', [s('d')], { visible: false }),
        g('lck', [s('e')], { locked: true }),
        s('f')
    ];
}

describe('VectorModel 表示・ロックの照会', () => {
    it('混ざったとき: 見えている図形はロックを含み隠れたものを除く。変えられる図形は両方を除く', () => {
        const { model } = setup(mixedItems());
        assert.deepEqual(ids(model.getVisibleShapes()), ['a', 'c', 'e', 'f']);
        assert.deepEqual(ids(model.getEditableShapes()), ['a', 'f']);
        assert.deepEqual(ids(model.getShapes()), ['a', 'b', 'c', 'd', 'e', 'f']);
    });

    it('すべて表示でロックなしのとき: 照会が getShapes・選択と同じ', () => {
        const { model } = setup([s('a'), g('x', [s('b'), g('y', [s('c')])]), s('d')]);
        assert.deepEqual(ids(model.getVisibleShapes()), ids(model.getShapes()));
        assert.deepEqual(ids(model.getEditableShapes()), ids(model.getShapes()));
        model.setSelection(['a', 'c']);
        assert.deepEqual(model.getEditableSelectedIds(), model.getSelectedIds());
    });

    it('それしか無いとき: 隠れた図形だけなら空・ロックした図形だけなら見えるが変えられない', () => {
        const hidden = setup([s('a', { visible: false })]).model;
        assert.deepEqual(hidden.getVisibleShapes(), []);
        assert.deepEqual(hidden.getEditableShapes(), []);
        const locked = setup([s('a', { locked: true })]).model;
        assert.deepEqual(ids(locked.getVisibleShapes()), ['a']);
        assert.deepEqual(locked.getEditableShapes(), []);
    });

    it('入れ子の受け継ぎ: 深い入れ子でも上のフォルダのロックが効く', () => {
        const { model } = setup([g('o', [g('i', [s('a')], { locked: true }), s('b')]), s('c')]);
        assert.deepEqual(ids(model.getVisibleShapes()), ['a', 'b', 'c']);
        assert.deepEqual(ids(model.getEditableShapes()), ['b', 'c']);
    });

    it('選んでいる変えられる図形: 一覧から選んだロック・隠した図形は含まず、getSelectedIds は全部を返す', () => {
        const { model } = setup(mixedItems());
        model.setSelection(['a', 'b', 'c', 'd', 'e', 'f']);
        assert.deepEqual(model.getEditableSelectedIds(), ['a', 'f']);
        assert.deepEqual(ids(model.getEditableSelectedShapes()), ['a', 'f']);
        assert.deepEqual(model.getSelectedIds(), ['a', 'b', 'c', 'd', 'e', 'f']);
        assert.equal(model.isSelected('c'), true);
    });

    it('返した配列を書き換えてもモデルは変わらない', () => {
        const { model } = setup(mixedItems());
        model.getVisibleShapes().length = 0;
        model.getEditableShapes().length = 0;
        assert.equal(model.getVisibleShapes().length, 4);
        assert.equal(model.getEditableShapes().length, 2);
    });
});

describe('VectorModel.hasRemovableSelection', () => {
    it('選択なしはfalse', () => {
        assert.equal(setup(mixedItems()).model.hasRemovableSelection(), false);
    });

    it('変えられる図形が混ざればtrue、変えられないものだけならfalse', () => {
        const { model } = setup(mixedItems());
        model.setSelection(['a', 'c']);
        assert.equal(model.hasRemovableSelection(), true);
        model.setSelection(['b', 'c', 'd', 'e']);
        assert.equal(model.hasRemovableSelection(), false);
    });

    it('空のフォルダ: 変えられるなら消せる、ロックしていれば消せない', () => {
        const { model } = setup([g('x', []), g('y', [], { locked: true })]);
        model.setSelection([], { groupIds: ['x'] });
        assert.equal(model.hasRemovableSelection(), true);
        model.setSelection([], { groupIds: ['y'] });
        assert.equal(model.hasRemovableSelection(), false);
    });

    it('選んだフォルダの中に変えられるものがあればtrue', () => {
        const { model } = setup([g('x', [s('a', { locked: true }), s('b')])]);
        model.setSelection(['a', 'b'], { groupIds: ['x'] });
        assert.equal(model.hasRemovableSelection(), true);
    });
});

describe('VectorModel.setItemStates', () => {
    it('変わるとき: 通知は1回でtrue。照会が変わる', () => {
        const { model, count } = setup([s('a'), s('b')]);
        assert.equal(model.setItemStates([{ id: 'a', visible: false }]), true);
        assert.equal(count(), 1);
        assert.deepEqual(ids(model.getVisibleShapes()), ['b']);
        assert.equal(model.setItemStates([{ id: 'b', locked: true }]), true);
        assert.deepEqual(ids(model.getEditableShapes()), []);
    });

    it('変わらないとき: falseで通知しない（同じ値・無いid・真偽値でない値・空）', () => {
        const { model, count } = setup([s('a'), s('b', { visible: false })]);
        assert.equal(model.setItemStates([{ id: 'a', visible: true }, { id: 'b', visible: false }]), false);
        assert.equal(model.setItemStates([{ id: 'zzz', visible: false }]), false);
        assert.equal(model.setItemStates([{ id: 'a', visible: 'no' }]), false);
        assert.equal(model.setItemStates([]), false);
        assert.equal(count(), 0);
    });

    it('選択・選んでいるフォルダ・描き込む先・折りたたみ・作成途中の図形・ホバーが変わらない', () => {
        const { model } = setup([g('x', [s('a'), s('b')], { collapsed: true }), s('c')]);
        model.setSelection(['c']);
        model.setHovered('c');
        model.startDraft(1, 2);
        const insertTarget = model.getInsertTarget();
        const selectedIds = model.getSelectedIds();
        const groupIds = model.getSelectedGroupIds();
        const draft = model.getDraftShape();
        assert.equal(model.setItemStates([{ id: 'x', visible: false, locked: true }, { id: 'c', visible: false }]), true);
        assert.deepEqual(model.getSelectedIds(), selectedIds);
        assert.deepEqual(model.getSelectedGroupIds(), groupIds);
        assert.deepEqual(model.getInsertTarget(), insertTarget);
        assert.equal(model.getHoveredId(), 'c');
        assert.equal(model.getDraftShape(), draft);
        assert.equal(model.getItems()[0].collapsed, true);
    });

    it('フォルダの切り替えで中の値が変わらない', () => {
        const { model } = setup([g('x', [s('a', { visible: false }), s('b')])]);
        model.setItemStates([{ id: 'x', visible: false }]);
        model.setItemStates([{ id: 'x', visible: true }]);
        const children = model.getItems()[0].children;
        assert.equal(children[0].visible, false);
        assert.notEqual(children[1].visible, false);
        assert.deepEqual(ids(model.getVisibleShapes()), ['b']);
    });
});

describe('VectorModel 頂点の選択は変えられる図形だけ', () => {
    it('ロック・隠した図形・フォルダから受け継いだ図形の組は受理しない', () => {
        const { model } = setup(mixedItems());
        model.setSelection(['a', 'b', 'c', 'd', 'e', 'f']);
        model.setSelectedVertices([
            { shapeId: 'a', handle: 'start' }, { shapeId: 'b', handle: 'start' }, { shapeId: 'c', handle: 'start' },
            { shapeId: 'd', handle: 'start' }, { shapeId: 'e', handle: 'start' }, { shapeId: 'f', handle: 'end' }
        ]);
        assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'a', handle: 'start' }, { shapeId: 'f', handle: 'end' }]);
    });

    it('隠す・ロックする・フォルダを隠すで外れ、ほかの図形の組は残り、戻しても復活しない', () => {
        const { model, count } = setup([s('a'), s('b'), g('x', [s('c')])]);
        model.setSelection(['a', 'b', 'c']);
        model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }, { shapeId: 'b', handle: 'start' }, { shapeId: 'c', handle: 'start' }]);
        const before = count();
        model.setItemStates([{ id: 'a', locked: true }, { id: 'x', visible: false }]);
        assert.equal(count(), before + 1);
        assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'b', handle: 'start' }]);
        model.setItemStates([{ id: 'a', locked: false }, { id: 'x', visible: true }]);
        assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'b', handle: 'start' }]);
        model.setItemStates([{ id: 'b', visible: false }]);
        assert.deepEqual(model.getSelectedVertices(), []);
    });

    it('rearrangeItems でロックしたフォルダの中へ動かすと外れる', () => {
        const { model } = setup([s('a'), s('b'), g('x', [], { locked: true })]);
        model.setSelection(['a', 'b']);
        model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }, { shapeId: 'b', handle: 'start' }]);
        const [a, b, x] = model.getItems();
        assert.equal(model.rearrangeItems([b, { ...x, children: [a] }]), true);
        assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'b', handle: 'start' }]);
    });
});

describe('VectorModel 変えられないものを含む操作・保存と復元', () => {
    it('getShapes・getItems が全部を返し、moveShapes が対象を減らさない', () => {
        const { model } = setup(mixedItems());
        assert.equal(model.getShapes().length, 6);
        assert.equal(model.getItems().length, 6);
        model.moveShapes(['b', 'c'], 5, 0);
        const byId = new Map(model.getShapes().map((shape) => [shape.id, shape]));
        assert.equal(byId.get('b').x1, 5);
        assert.equal(byId.get('c').x1, 5);
    });

    it('保存と復元: replaceAllShapes(getItems()) と DocumentSerializer の往復で値が保たれる', () => {
        const { model } = setup(mixedItems());
        model.setItemStates([{ id: 'a', visible: false, locked: true }]);
        const restored = new VectorModel();
        restored.replaceAllShapes(model.getItems());
        assert.deepEqual(ids(restored.getVisibleShapes()), ids(model.getVisibleShapes()));
        assert.deepEqual(ids(restored.getEditableShapes()), ids(model.getEditableShapes()));
        const result = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(DocumentSerializer.serialize(model.getItems()))));
        const again = new VectorModel();
        again.replaceAllShapes(result.items);
        assert.deepEqual(ids(again.getEditableShapes()), ['f']);
        assert.deepEqual(ids(again.getVisibleShapes()), ['c', 'e', 'f']);
    });
});
