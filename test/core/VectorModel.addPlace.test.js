/**
 * 責務: VectorModel.addShapesWithNewIds の入る場所（place・描き込む先）とまとまりとして入れる（asUnits）を公開APIで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';

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
 * 図形のアイテムを作る。
 * @param {string} id 図形のid
 * @returns {Object} 図形のアイテム
 */
const s = (id) => ({ kind: 'shape', shape: makeLine(id) });

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] 追加の属性（name・collapsedなど）
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, extra = {}) => ({ kind: 'group', id, children, ...extra });

/**
 * 入れ子を、種類とidだけの表現にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<*>} 図形はid、フォルダは[id, 中身]
 */
const outline = (items) => items.map((item) => (item.kind === 'group' ? [item.id, outline(item.children)] : item.shape.id));

/**
 * 図形のidだけを列挙する（前順）。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} 図形のid
 */
const shapeIds = (model) => {
    const out = [];
    const walk = (list) => list.forEach((item) => (item.kind === 'group' ? walk(item.children) : out.push(item.shape.id)));
    walk(model.getItems());
    return out;
};

/**
 * モデルを作り、アイテムを入れて通知の記録を付ける。
 * @param {Array<Object>} items 入れるアイテム
 * @returns {{ model: VectorModel, log: Array<string> }} モデルと通知の記録
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const log = [];
    model.onChange(() => { log.push('change'); });
    return { model, log };
}

describe('VectorModel.addShapesWithNewIds: place', () => {
    it('placeはatInsertTargetより優先される', () => {
        const { model } = setup([s('a'), s('b'), s('c')]);
        model.setInsertTarget('a');
        const ids = model.addShapesWithNewIds([makeLine('x')], { atInsertTarget: true, place: { kind: 'above', id: 'c' } });
        assert.equal(ids.length, 1);
        assert.deepEqual(shapeIds(model), ['a', 'b', 'c', ids[0]]);
    });

    it('placeだけ（atInsertTargetが偽）でも使われる', () => {
        const { model } = setup([s('a'), s('b')]);
        const ids = model.addShapesWithNewIds([makeLine('x')], { place: { kind: 'above', id: 'a' } });
        assert.deepEqual(shapeIds(model), ['a', ids[0], 'b']);
    });

    it('atInsertTargetでinside（フォルダの中の一番上）へ入る', () => {
        const { model } = setup([g('g1', [s('a'), s('b')]), s('c')]);
        model.setInsertTarget('g1');
        const ids = model.addShapesWithNewIds([makeLine('x')], { atInsertTarget: true });
        assert.deepEqual(outline(model.getItems()), [['g1', ['a', 'b', ids[0]]], 'c']);
    });

    it('placeのbottom（フォルダの一番下・いちばん外側の一番下）へ入る', () => {
        const { model } = setup([g('g1', [s('a'), s('b')]), s('c')]);
        const i1 = model.addShapesWithNewIds([makeLine('x')], { place: { kind: 'bottom', id: 'g1' } });
        assert.deepEqual(outline(model.getItems()), [['g1', [i1[0], 'a', 'b']], 'c']);
        const i2 = model.addShapesWithNewIds([makeLine('y')], { place: { kind: 'bottom', id: null } });
        assert.deepEqual(outline(model.getItems()), [i2[0], ['g1', [i1[0], 'a', 'b']], 'c']);
    });

    it('フォルダの行のabove（フォルダのすぐ上）へ入る', () => {
        const { model } = setup([s('a'), g('g1', [s('b')]), s('c')]);
        const ids = model.addShapesWithNewIds([makeLine('x')], { place: { kind: 'above', id: 'g1' } });
        assert.deepEqual(outline(model.getItems()), ['a', ['g1', ['b']], ids[0], 'c']);
    });

    it('既定（place・asUnitsを省く）は今までどおり末尾へ入り、通知は1回', () => {
        const { model, log } = setup([s('a'), s('b')]);
        const ids = model.addShapesWithNewIds([makeLine('x'), makeLine('y')]);
        assert.equal(ids.length, 2);
        assert.deepEqual(shapeIds(model), ['a', 'b', ...ids]);
        assert.deepEqual(log, ['change']);
    });

    it('閉じたフォルダのinsideへ入れると、図形を含むので開く', () => {
        const { model } = setup([g('g1', [s('a')], { collapsed: true })]);
        model.setInsertTarget('g1');
        model.addShapesWithNewIds([makeLine('x')], { atInsertTarget: true });
        assert.ok(!model.getItems()[0].collapsed);
    });
});

describe('VectorModel.addShapesWithNewIds: asUnits', () => {
    it('フォルダと図形の混ざり: 新しいidが付き、図形だけが選ばれ、いちばん外側のフォルダが選んでいる状態になる', () => {
        const { model, log } = setup([s('a')]);
        log.length = 0;
        const ids = model.addShapesWithNewIds([g('G', [s('p'), g('H', [s('q')])]), s('r')], { asUnits: true });
        assert.equal(ids.length, 3);
        const items = model.getItems();
        assert.equal(items.length, 3);
        assert.equal(items[1].kind, 'group');
        assert.match(items[1].id, /^group-\d+$/);
        assert.notEqual(items[1].id, 'G');
        assert.notEqual(items[1].children[1].id, 'H');
        assert.deepEqual(shapeIds(model), ['a', ...ids]);
        assert.deepEqual([...model.getSelectedIds()].sort(), [...ids].sort());
        assert.deepEqual(model.getSelectedGroupIds(), [items[1].id]);
        assert.deepEqual(log, ['change']);
    });

    it('入れ子の中のフォルダは選んでいるフォルダにならず、いちばん外側だけが選ばれる', () => {
        const { model } = setup([]);
        model.addShapesWithNewIds([g('G', [g('H', [s('q')])])], { asUnits: true });
        const outer = model.getItems()[0];
        assert.deepEqual(model.getSelectedGroupIds(), [outer.id]);
    });

    it('空のフォルダだけでも入れられ、そのフォルダが選んでいる状態になり、描き込む先は中になる', () => {
        const { model, log } = setup([s('a')]);
        log.length = 0;
        const ids = model.addShapesWithNewIds([g('E', [])], { asUnits: true });
        assert.deepEqual(ids, []);
        const items = model.getItems();
        assert.equal(items.length, 2);
        assert.deepEqual(model.getSelectedGroupIds(), [items[1].id]);
        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: items[1].id });
        assert.deepEqual(log, ['change']);
    });

    it('図形を含むフォルダを入れると、描き込む先は入れたフォルダの中になる', () => {
        const { model } = setup([s('a')]);
        model.addShapesWithNewIds([g('G', [s('p')])], { asUnits: true });
        const items = model.getItems();
        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: items[1].id });
    });

    it('placeと組み合わせると、その場所へまとまりで入る', () => {
        const { model } = setup([g('g1', [s('a')]), s('b')]);
        const ids = model.addShapesWithNewIds([g('G', [s('p')]), s('q')], { asUnits: true, place: { kind: 'inside', id: 'g1' } });
        const g1 = model.getItems()[0];
        assert.equal(g1.id, 'g1');
        assert.equal(g1.children.length, 3);
        assert.equal(g1.children[0].shape.id, 'a');
        assert.equal(g1.children[1].kind, 'group');
        assert.equal(g1.children[2].shape.id, ids[1]);
    });

    it('asUnitsが偽ならフォルダだけでは何もせず、通知もなく、フォルダの選択は空のまま', () => {
        const { model, log } = setup([s('a')]);
        model.setSelection(['a']);
        log.length = 0;
        assert.deepEqual(model.addShapesWithNewIds([g('E', [])]), []);
        assert.deepEqual(outline(model.getItems()), ['a']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        assert.deepEqual(log, []);
    });

    it('asUnitsが真でも、入れるものが何も無ければ何もしない', () => {
        const { model, log } = setup([s('a')]);
        assert.deepEqual(model.addShapesWithNewIds([], { asUnits: true }), []);
        assert.deepEqual(log, []);
    });

    it('asUnitsが偽で図形を含むフォルダを入れると、フォルダの選択は空になる', () => {
        const { model } = setup([s('a')]);
        model.addShapesWithNewIds([g('G', [s('p')])]);
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('名前と折りたたみが保たれる', () => {
        const { model } = setup([]);
        model.addShapesWithNewIds([g('G', [s('p')], { name: '私のフォルダ', collapsed: true })], { asUnits: true });
        const item = model.getItems()[0];
        assert.equal(item.name, '私のフォルダ');
        assert.equal(item.collapsed, true);
    });

    it('既にあった閉じたフォルダの中へ図形を含めて入れると、そのフォルダが開く', () => {
        const { model } = setup([g('g1', [s('a')], { collapsed: true })]);
        model.addShapesWithNewIds([g('G', [s('p')])], { asUnits: true, place: { kind: 'inside', id: 'g1' } });
        assert.ok(!model.getItems()[0].collapsed);
    });

    it('重複インスタンスは入れず、残りだけが入る', () => {
        const { model } = setup([s('a')]);
        const shared = makeLine('p');
        const warn = console.warn;
        console.warn = () => {};
        try {
            const ids = model.addShapesWithNewIds([g('G', [{ kind: 'shape', shape: shared }, { kind: 'shape', shape: shared }])], { asUnits: true });
            assert.equal(ids.length, 1);
        } finally {
            console.warn = warn;
        }
    });
});
