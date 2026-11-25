/**
 * 責務: VectorModelが持つ「選んでいるフォルダ」（getSelectedGroupIds・setSelection/setSelectionByUserの引数・不変条件・各操作での扱い）を公開APIで検証する。
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
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children) => ({ kind: 'group', id, children });

/**
 * モデルを作り、アイテムを入れて通知回数のカウンタを付ける。
 * @param {Array<Object>} items 入れるアイテム
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

/**
 * 標準の絵：フォルダg1（a・b）、g2（図形cだけ）、外の図形d、空のフォルダe。
 * @returns {Array<Object>} アイテムの入れ子
 */
function standardItems() {
    return [g('g1', [s('a'), s('b')]), g('g2', [s('c')]), s('d'), g('e', [])];
}

describe('VectorModel 選んでいるフォルダ', () => {
    it('初期状態は空', () => {
        assert.deepEqual(new VectorModel().getSelectedGroupIds(), []);
    });

    it('setSelectionでgroupIdsを渡し、中の図形がすべて選ばれていれば選べる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
        assert.deepEqual(model.getSelectedIds(), ['a', 'b']);
    });

    it('中の図形が1つ外れているフォルダは不変条件で落ちる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a'], { groupIds: ['g1'] });
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('空のフォルダは図形の選択が空でも選べる', () => {
        const { model } = setup(standardItems());
        model.setSelection([], { groupIds: ['e'] });
        assert.deepEqual(model.getSelectedGroupIds(), ['e']);
    });

    it('無いidやフォルダでないidは選べない', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['nothing', 'a'] });
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('setSelectionでgroupIdsを省くと空になる（選び直し）', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        model.setSelection(['a', 'b']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('getSelectedGroupIdsは前順で、新しい配列を返す', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b', 'c'], { groupIds: ['g2', 'g1'] });
        const result = model.getSelectedGroupIds();
        assert.deepEqual(result, ['g1', 'g2']);
        result.push('x');
        assert.deepEqual(model.getSelectedGroupIds(), ['g1', 'g2']);
    });

    it('入れ子の外側のフォルダを明示すれば選べ、中のフォルダは自動では入らない', () => {
        const { model } = setup([g('outer', [g('inner', [s('a')]), s('b')])]);
        model.setSelection(['a', 'b'], { groupIds: ['outer'] });
        assert.deepEqual(model.getSelectedGroupIds(), ['outer']);
    });

    it('setSelectionByUser: groupIdsなし・additiveなしは空へ選び直す', () => {
        const { model } = setup(standardItems());
        model.setSelection(['c'], { groupIds: ['g2'] });
        model.setSelectionByUser(['c']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        assert.deepEqual(model.getSelectedIds(), ['c']);
    });

    it('setSelectionByUser: additiveが真なら今のフォルダの選択を引き継ぐ', () => {
        const { model } = setup(standardItems());
        model.setSelection(['c'], { groupIds: ['g2'] });
        model.setSelectionByUser(['c', 'd'], { additive: true });
        assert.deepEqual(model.getSelectedGroupIds(), ['g2']);
    });

    it('setSelectionByUser: groupIdsがあればそれを使う', () => {
        const { model } = setup(standardItems());
        model.setSelectionByUser(['a', 'b'], { groupIds: ['g1'] });
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
    });

    it('setSelectionByUser: 図形の選択が空でもフォルダの選択があれば描き込む先は今のまま', () => {
        const { model } = setup(standardItems());
        model.setSelection(['d']);
        assert.equal(model.getInsertTargetId(), 'd');
        assert.equal(model.setSelectionByUser([], { groupIds: ['e'] }), true);
        assert.deepEqual(model.getSelectedGroupIds(), ['e']);
        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: 'e' });
    });

    it('setSelectionByUser: 図形もフォルダも空になれば描き込む先は無しになる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['d']);
        assert.equal(model.setSelectionByUser([]), true);
        assert.equal(model.getInsertTargetId(), null);
    });

    it('setSelectionByUser: 空のフォルダだけを選んでいるとき、空へ選び直すとtrueでフォルダの選択が外れる', () => {
        const { model, notifyCount } = setup(standardItems());
        model.setSelectionByUser([], { groupIds: ['e'] });
        const before = notifyCount();
        assert.equal(model.setSelectionByUser([]), true);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        assert.equal(notifyCount(), before + 1);
    });

    it('setSelectionByUser: 何も無い状態から空へはfalseで通知しない', () => {
        const { model, notifyCount } = setup(standardItems());
        assert.equal(model.setSelectionByUser([]), false);
        assert.equal(notifyCount(), 0);
    });

    it('clearSelectionでフォルダの選択も空になる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        model.clearSelection();
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('図形が削除されるとそのフォルダの選択は外れ、ほかは残る', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b', 'c'], { groupIds: ['g1', 'g2'] });
        model.deleteShapes(['a']);
        assert.deepEqual(model.getSelectedGroupIds(), ['g2']);
    });

    it('replaceAllShapesでフォルダの選択は空になる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        model.replaceAllShapes(standardItems());
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('addShapesWithNewIdsでフォルダの選択は空になる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        model.addShapesWithNewIds([makeLine('x')]);
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('replaceShapeのkeepIdが真なら、図形1つのフォルダの選択は残る', () => {
        const { model } = setup(standardItems());
        model.setSelection(['c'], { groupIds: ['g2'] });
        model.replaceShape('c', makeLine('tmp'), { keepId: true });
        assert.deepEqual(model.getSelectedGroupIds(), ['g2']);
        assert.deepEqual(model.getSelectedIds(), ['c']);
    });

    it('replaceShapeで新しいidにすると図形の選択が変わりフォルダの選択は外れる', () => {
        const { model } = setup(standardItems());
        model.setSelection(['c'], { groupIds: ['g2'] });
        model.replaceShape('c', makeLine('tmp'));
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('replaceShapeのselectが偽なら、図形1つのフォルダの選択は残る', () => {
        const { model } = setup(standardItems());
        model.setSelection(['c'], { groupIds: ['g2'] });
        model.replaceShape('d', makeLine('tmp'), { select: false });
        assert.deepEqual(model.getSelectedGroupIds(), ['g2']);
    });

    it('renameItem・rearrangeItemsではフォルダの選択は残る', () => {
        const { model } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        model.renameItem('g1', '名前');
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
        model.rearrangeItems([...model.getItems()].reverse());
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
    });

    it('選択を変えると通知は1回', () => {
        const { model, notifyCount } = setup(standardItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        assert.equal(notifyCount(), 1);
    });
});
