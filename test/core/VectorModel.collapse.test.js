/**
 * 責務: VectorModelの折りたたみ（setGroupCollapsed・選択が変わったときの自動で開く・onCollapsedChangeの通知）を公開APIで検証する。
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
 * @param {boolean} [collapsed=false] 閉じているか
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, collapsed = false) => (collapsed ? { kind: 'group', id, collapsed: true, children } : { kind: 'group', id, children });

/**
 * モデルを作り、アイテムを入れて通知の記録を付ける。
 * @param {Array<Object>} items 入れるアイテム
 * @returns {{ model: VectorModel, log: Array<string> }} モデルと、通知の順にchange・collapsedを並べた記録
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const log = [];
    model.onChange(() => { log.push('change'); });
    model.onCollapsedChange(() => { log.push('collapsed'); });
    return { model, log };
}

/**
 * いちばん外側のフォルダのアイテムを、idで引く。
 * @param {VectorModel} model モデル
 * @param {string} id フォルダのid
 * @returns {Object} フォルダのアイテム
 */
function groupOf(model, id) {
    return model.getItems().find((item) => item.kind === 'group' && item.id === id);
}

describe('VectorModel 折りたたみ', () => {
    it('閉じる: trueを返し、collapsed: trueのキーを持ち、onChangeの後にonCollapsedChangeが1回', () => {
        const { model, log } = setup([g('g1', [s('a')])]);
        assert.equal(model.setGroupCollapsed('g1', true), true);
        assert.equal(groupOf(model, 'g1').collapsed, true);
        assert.deepEqual(log, ['change', 'collapsed']);
    });

    it('開く: キー自体が無くなる', () => {
        const { model, log } = setup([g('g1', [s('a')], true)]);
        assert.equal(model.setGroupCollapsed('g1', false), true);
        assert.equal('collapsed' in groupOf(model, 'g1'), false);
        assert.deepEqual(log, ['change', 'collapsed']);
    });

    it('変わらない・無いid・図形のidはfalseで通知しない', () => {
        const { model, log } = setup([g('g1', [s('a')], true), g('g2', [s('b')])]);
        assert.equal(model.setGroupCollapsed('g1', true), false);
        assert.equal(model.setGroupCollapsed('g2', false), false);
        assert.equal(model.setGroupCollapsed('nothing', true), false);
        assert.equal(model.setGroupCollapsed('a', true), false);
        assert.deepEqual(log, []);
    });

    it('選択・描き込む先・フォルダの選択には触れない', () => {
        const { model } = setup([g('g1', [s('a'), s('b')]), s('c')]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        model.setGroupCollapsed('g1', true);
        assert.deepEqual(model.getSelectedIds(), ['a', 'b']);
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: 'g1' });
    });

    it('setSelectionで選んだ図形の上の閉じたフォルダ（入れ子の上すべて）が開き、通知は1回ずつ', () => {
        const { model, log } = setup([g('outer', [g('inner', [s('a')], true), s('b')], true), s('c')]);
        model.setSelection(['a']);
        const outer = groupOf(model, 'outer');
        assert.equal('collapsed' in outer, false);
        assert.equal('collapsed' in outer.children[0], false);
        assert.deepEqual(log, ['change', 'collapsed']);
    });

    it('setSelectionのkeepsCollapsedが真なら開かない', () => {
        const { model, log } = setup([g('g1', [s('a')], true)]);
        model.setSelection(['a'], { keepsCollapsed: true });
        assert.equal(groupOf(model, 'g1').collapsed, true);
        assert.deepEqual(log, ['change']);
    });

    it('setSelectionByUserで開き、keepsCollapsedが真なら開かない', () => {
        const { model } = setup([g('g1', [s('a')], true), g('g2', [s('b')], true)]);
        model.setSelectionByUser(['a']);
        assert.equal('collapsed' in groupOf(model, 'g1'), false);
        model.setSelectionByUser(['b'], { keepsCollapsed: true });
        assert.equal(groupOf(model, 'g2').collapsed, true);
    });

    it('additiveが真なら新しく選ばれた図形のフォルダだけ開く', () => {
        const { model } = setup([g('g1', [s('a')]), g('g2', [s('b')])]);
        model.setSelection(['b']);
        model.setGroupCollapsed('g1', true);
        model.setGroupCollapsed('g2', true);
        model.setSelectionByUser(['a', 'b'], { additive: true });
        assert.equal('collapsed' in groupOf(model, 'g1'), false);
        assert.equal(groupOf(model, 'g2').collapsed, true);
    });

    it('選択が変わらない選び直しでは開かない', () => {
        const { model, log } = setup([g('g1', [s('a')])]);
        model.setSelection(['a']);
        model.setGroupCollapsed('g1', true);
        log.length = 0;
        model.setSelectionByUser(['a']);
        assert.equal(groupOf(model, 'g1').collapsed, true);
        assert.deepEqual(log, ['change']);
    });

    it('図形の選択が同じでもフォルダの選択が変われば開く', () => {
        const { model } = setup([g('g1', [s('a')])]);
        model.setSelection(['a']);
        model.setGroupCollapsed('g1', true);
        model.setSelectionByUser(['a'], { groupIds: ['g1'] });
        assert.equal('collapsed' in groupOf(model, 'g1'), false);
    });

    it('折りたたみが変わらない選択の変更ではonCollapsedChangeを呼ばない', () => {
        const { model, log } = setup([g('g1', [s('a')]), s('b')]);
        model.setSelection(['a']);
        model.setSelection(['b']);
        assert.deepEqual(log, ['change', 'change']);
    });

    it('replaceAllShapesは閉じた状態のまま入れ、onCollapsedChangeを呼ばない', () => {
        const { model, log } = setup([s('x')]);
        model.replaceAllShapes([g('g1', [s('a')], true)]);
        assert.equal(groupOf(model, 'g1').collapsed, true);
        assert.deepEqual(log, ['change']);
    });

    it('addShapesWithNewIdsで足したフォルダは、閉じたまま保たれる', () => {
        const { model, log } = setup([s('x')]);
        model.addShapesWithNewIds([g('imported', [s('a')], true)]);
        const imported = model.getItems().find((item) => item.kind === 'group');
        assert.equal(imported.collapsed, true);
        assert.deepEqual(log, ['change']);
    });

    it('addShapesWithNewIdsを描き込む先へ足すと、すでにあった閉じたフォルダの中の図形なら開く', () => {
        const { model, log } = setup([g('g1', [s('a')]), s('b')]);
        model.setSelection(['a']);
        model.setGroupCollapsed('g1', true);
        log.length = 0;
        model.addShapesWithNewIds([makeLine('n')], { atInsertTarget: true });
        assert.equal('collapsed' in groupOf(model, 'g1'), false);
        assert.deepEqual(log, ['change', 'collapsed']);
    });

    it('replaceShape（select）で結果の図形の上の閉じたフォルダが開く', () => {
        const { model, log } = setup([g('g1', [s('a')]), s('b')]);
        model.setGroupCollapsed('g1', true);
        log.length = 0;
        model.replaceShape('a', makeLine('tmp'));
        assert.equal('collapsed' in groupOf(model, 'g1'), false);
        assert.deepEqual(log, ['change', 'collapsed']);
    });

    it('replaceShapeのkeepIdで選択が変わらなければ開かない', () => {
        const { model, log } = setup([g('g1', [s('a')])]);
        model.setSelection(['a']);
        model.setGroupCollapsed('g1', true);
        log.length = 0;
        model.replaceShape('a', makeLine('tmp'), { keepId: true });
        assert.equal(groupOf(model, 'g1').collapsed, true);
        assert.deepEqual(log, ['change']);
    });

    it('replaceShapeのselectが偽なら開かない', () => {
        const { model } = setup([g('g1', [s('a')]), s('b')]);
        model.setGroupCollapsed('g1', true);
        model.replaceShape('a', makeLine('tmp'), { select: false });
        assert.equal(groupOf(model, 'g1').collapsed, true);
    });

    it('並べ替え・名前の変更・削除では開かない', () => {
        const { model } = setup([g('g1', [s('a')], true), s('b')]);
        model.rearrangeItems([...model.getItems()].reverse());
        model.renameItem('g1', '名前');
        model.deleteShapes(['b']);
        assert.equal(groupOf(model, 'g1').collapsed, true);
    });

    it('onCollapsedChangeは関数でない引数を無視する', () => {
        const model = new VectorModel();
        assert.doesNotThrow(() => model.onCollapsedChange(null));
    });
});
