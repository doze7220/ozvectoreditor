/**
 * 責務: VectorModelの複合パスの照会`getCompoundPaths`と、値を変える唯一の公開操作`setGroupCompound`を公開APIで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { listCompoundPaths } from '../../js/core/CompoundPathRules.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @returns {Line} 直線
 */
function makeLine(id) {
    const line = new Line(0, 0, 10, 0, '#123456', 3);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る。
 * @param {string} id 図形のid
 * @param {Object} [states] `visible`など
 * @returns {Object} 図形のアイテム
 */
const s = (id, states = {}) => ({ kind: 'shape', shape: makeLine(id), ...states });

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] `compound`・`collapsed`など
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, extra = {}) => ({ kind: 'group', id, children, ...extra });

/**
 * モデルを作り、通知の記録を付ける。
 * @param {Array<Object>} items 入れるアイテム
 * @returns {{ model: VectorModel, log: Array<string> }} モデルと通知の記録
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

describe('VectorModel setGroupCompound', () => {
    it('複合パスにすると compound: true が付き、戻すとキーが無くなる', () => {
        const { model } = setup([g('g1', [s('a'), s('b')])]);
        assert.equal(model.setGroupCompound('g1', true), true);
        assert.equal(groupOf(model, 'g1').compound, true);
        assert.equal(model.setGroupCompound('g1', false), true);
        assert.equal('compound' in groupOf(model, 'g1'), false);
    });

    it('変わると通知は1回で、onCollapsedChange は呼ばない', () => {
        const { model, log } = setup([g('g1', [s('a')])]);
        model.setGroupCompound('g1', true);
        assert.deepEqual(log, ['change']);
    });

    it('同じ値・無いid・図形のid は false で通知しない', () => {
        const { model, log } = setup([g('g1', [s('a')], { compound: true }), g('g2', [s('b')])]);
        assert.equal(model.setGroupCompound('g1', true), false);
        assert.equal(model.setGroupCompound('g2', false), false);
        assert.equal(model.setGroupCompound('none', true), false);
        assert.equal(model.setGroupCompound('a', true), false);
        assert.deepEqual(log, []);
    });

    it('入れ子の中のフォルダも切り替えられる', () => {
        const { model } = setup([g('outer', [g('inner', [s('a')])])]);
        assert.equal(model.setGroupCompound('inner', true), true);
        assert.equal(groupOf(model, 'outer').children[0].compound, true);
    });

    it('選択・選んでいるフォルダ・描き込む先・頂点の選択・ホバー・作成途中・折りたたみは変わらない', () => {
        const { model, log } = setup([g('g1', [s('a'), s('b')], { collapsed: true }), g('g2', [s('c')])]);
        model.setSelection(['c'], { groupIds: [], keepsCollapsed: true });
        model.setSelectedVertices([{ shapeId: 'c', handle: 'start' }]);
        model.setHovered('b');
        model.startDraft(1, 2);
        const draft = model.getDraftShape();
        const snapshot = () => ({
            selectedIds: model.getSelectedIds(),
            selectedGroupIds: model.getSelectedGroupIds(),
            insertTarget: model.getInsertTarget(),
            vertices: model.getSelectedVertices(),
            hovered: model.getHoveredId(),
        });
        const before = snapshot();
        log.length = 0;
        assert.equal(model.setGroupCompound('g1', true), true);
        assert.deepEqual(snapshot(), before);
        assert.equal(model.getDraftShape(), draft);
        assert.equal(groupOf(model, 'g1').collapsed, true);
        assert.deepEqual(log, ['change']);
    });

    it('選んでいるフォルダを切り替えても選択は残る', () => {
        const { model } = setup([g('g1', [s('a')])]);
        model.setSelection(['a'], { groupIds: ['g1'] });
        model.setGroupCompound('g1', true);
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
        assert.deepEqual(model.getSelectedIds(), ['a']);
    });

    it('図形のスタイルは切り替え・戻しでそのまま', () => {
        const { model } = setup([g('g1', [s('a'), s('b')])]);
        const styles = () => model.getShapes().map((x) => [x.strokeColor, x.strokeWidth, x.fillColor]);
        const before = styles();
        model.setGroupCompound('g1', true);
        assert.deepEqual(styles(), before);
        model.setGroupCompound('g1', false);
        assert.deepEqual(styles(), before);
    });
});

describe('VectorModel getCompoundPaths', () => {
    it('listCompoundPaths(getItems()) と同じ中身を返す', () => {
        const { model } = setup([g('g1', [s('a'), s('b')], { compound: true }), g('g2', [s('c')])]);
        const paths = model.getCompoundPaths();
        const expected = listCompoundPaths(model.getItems());
        assert.equal(paths.length, 1);
        assert.equal(paths.length, expected.length);
        assert.deepEqual(Object.keys(paths[0]), Object.keys(expected[0]));
        assert.deepEqual(paths[0].shapes.map((x) => x.id), expected[0].shapes.map((x) => x.id));
        assert.deepEqual(paths[0].shapes.map((x) => x.id), ['a', 'b']);
    });

    it('複合パスが無ければ空', () => {
        const { model } = setup([g('g1', [s('a')])]);
        assert.deepEqual(model.getCompoundPaths(), []);
    });

    it('setGroupCompound の結果が照会に出る', () => {
        const { model } = setup([g('g1', [s('a')])]);
        model.setGroupCompound('g1', true);
        assert.equal(model.getCompoundPaths().length, 1);
        model.setGroupCompound('g1', false);
        assert.equal(model.getCompoundPaths().length, 0);
    });

    it('setItemStates で一番下を隠すと先頭の図形が変わる', () => {
        const { model } = setup([g('g1', [s('a'), s('b')], { compound: true })]);
        assert.equal(model.getCompoundPaths()[0].shapes[0].id, 'a');
        model.setItemStates([{ id: 'a', visible: false }]);
        assert.equal(model.getCompoundPaths()[0].shapes[0].id, 'b');
    });
});

describe('VectorModel 複合パスの値の保持', () => {
    it('replaceAllShapes で入れた compound: true が保たれる', () => {
        const { model } = setup([g('g1', [s('a')], { compound: true })]);
        assert.equal(groupOf(model, 'g1').compound, true);
    });

    it('addShapesWithNewIds（asUnits）で入れた compound: true が保たれる', () => {
        const model = new VectorModel();
        model.addShapesWithNewIds([g('g1', [s('a'), s('b')], { compound: true })], { asUnits: true });
        const groups = model.getItems().filter((item) => item.kind === 'group');
        assert.equal(groups.length, 1);
        assert.equal(groups[0].compound, true);
    });
});
