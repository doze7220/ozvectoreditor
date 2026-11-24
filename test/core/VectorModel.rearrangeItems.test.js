/**
 * 責務: VectorModel.rearrangeItems（入れ子を動かす唯一の公開操作）の結果・選択・通知・検証を公開APIで検証する。
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
 * フォルダのアイテムを作る（idがnullなら新しいフォルダ）。
 * @param {string|null} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {boolean} [collapsed=false] 閉じているか
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, collapsed = false) => (collapsed ? { kind: 'group', id, collapsed: true, children } : { kind: 'group', id, children });

/**
 * 入れ子を、種類とidだけの表現にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<*>} 図形はid、フォルダは[id, 中身]
 */
const outline = (items) => items.map((item) => (item.kind === 'group' ? [item.id, outline(item.children)] : item.shape.id));

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
    model.onCollapsedChange(() => { log.push('collapsed'); });
    return { model, log };
}

describe('VectorModel.rearrangeItems', () => {
    it('まとめる: 新しいフォルダにgroup-のidと「フォルダ 1」が付き、selectsNewGroupsで選ばれる', () => {
        const { model, log } = setup([s('a'), s('b'), s('c')]);
        model.setSelection(['a', 'b']);
        log.length = 0;
        const items = model.getItems();
        const next = [g(null, [items[0], items[1]]), items[2]];
        assert.equal(model.rearrangeItems(next, { selectedGroupIds: [], selectsNewGroups: true }), true);
        const after = model.getItems();
        assert.equal(after[0].kind, 'group');
        assert.match(after[0].id, /^group-\d+$/);
        assert.equal(after[0].name, 'フォルダ 1');
        assert.deepEqual(outline(after), [[after[0].id, ['a', 'b']], 'c']);
        assert.deepEqual(model.getSelectedGroupIds(), [after[0].id]);
        assert.deepEqual([...model.getSelectedIds()].sort(), ['a', 'b']);
        assert.deepEqual(log, ['change']);
    });

    it('2つ目の新しいフォルダの名前は番号が進み、idは重ならない', () => {
        const { model } = setup([s('a'), s('b')]);
        const items = model.getItems();
        model.rearrangeItems([g(null, [items[0]]), g(null, [items[1]])]);
        assert.deepEqual(model.getItems().map((i) => i.name), ['フォルダ 1', 'フォルダ 2']);
        const ids = model.getItems().map((i) => i.id);
        assert.notEqual(ids[0], ids[1]);
    });

    it('既存のフォルダがあれば名前の番号は続きになる', () => {
        const folder = { ...g('g1', [s('a')]), name: 'フォルダ 3' };
        const { model } = setup([folder, s('b')]);
        const items = model.getItems();
        model.rearrangeItems([items[0], g(null, [items[1]])]);
        assert.equal(model.getItems()[1].name, 'フォルダ 4');
    });

    it('解除: フォルダの中身が外へ出て、図形の選択はそのまま', () => {
        const { model } = setup([g('g1', [s('a'), s('b')]), s('c')]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        const items = model.getItems();
        assert.equal(model.rearrangeItems([...items[0].children, items[1]]), true);
        assert.deepEqual(outline(model.getItems()), ['a', 'b', 'c']);
        assert.deepEqual([...model.getSelectedIds()].sort(), ['a', 'b']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('除く: 図形が消え、選択・描き込む先・ホバー・頂点の選択からも外れる', () => {
        const { model, log } = setup([g('g1', [s('a'), s('b')]), s('c')]);
        model.setSelection(['a']);
        model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }]);
        model.setHovered('a');
        log.length = 0;
        assert.equal(model.rearrangeItems([model.getItems()[1]], { selectedIds: [], selectedGroupIds: [] }), true);
        assert.deepEqual(outline(model.getItems()), ['c']);
        assert.deepEqual([...model.getSelectedIds()], []);
        assert.equal(model.getInsertTargetId(), null);
        assert.equal(model.getHoveredId(), null);
        assert.deepEqual(model.getSelectedVertices(), []);
        assert.deepEqual(log, ['change']);
    });

    it('selectedIdsを省くと、残った図形の選択だけが残り、描き込む先は規則で決まる', () => {
        const { model } = setup([s('a'), s('b'), s('c')]);
        model.setSelection(['a', 'b']);
        model.rearrangeItems([model.getItems()[1], model.getItems()[2]]);
        assert.deepEqual([...model.getSelectedIds()], ['b']);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('消えていない図形のホバーと頂点の選択は保たれる', () => {
        const { model } = setup([s('a'), s('b')]);
        model.setSelection(['a']);
        model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }]);
        model.setHovered('b');
        const items = model.getItems();
        model.rearrangeItems([g(null, [items[1]]), items[0]]);
        assert.equal(model.getHoveredId(), 'b');
        assert.deepEqual(model.getSelectedVertices(), [{ shapeId: 'a', handle: 'start' }]);
    });

    it('並べ替え: フォルダの中だけを入れ替える', () => {
        const { model } = setup([g('g1', [s('a'), s('b')]), s('c')]);
        const items = model.getItems();
        const folder = items[0];
        const next = [{ ...folder, children: [folder.children[1], folder.children[0]] }, items[1]];
        assert.equal(model.rearrangeItems(next), true);
        assert.deepEqual(outline(model.getItems()), [['g1', ['b', 'a']], 'c']);
    });

    it('空のフォルダの追加: 選んでいるものを外して新しいフォルダを選ぶ', () => {
        const { model } = setup([s('a'), s('b')]);
        model.setSelection(['a']);
        const items = model.getItems();
        assert.equal(model.rearrangeItems([items[0], g(null, []), items[1]], { selectedIds: [], selectedGroupIds: [], selectsNewGroups: true }), true);
        const after = model.getItems();
        assert.equal(after[1].kind, 'group');
        assert.deepEqual(after[1].children, []);
        assert.deepEqual(model.getSelectedGroupIds(), [after[1].id]);
        assert.deepEqual([...model.getSelectedIds()], []);
    });

    it('空のフォルダを追加しても、selectsNewGroupsが偽なら選択に触れない', () => {
        const { model } = setup([s('a')]);
        model.setSelection(['a']);
        model.rearrangeItems([model.getItems()[0], g(null, [])]);
        assert.deepEqual([...model.getSelectedIds()], ['a']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
    });

    it('フォルダの選択: selectedGroupIdsの候補は不変条件で絞られる', () => {
        const { model } = setup([g('g1', [s('a')]), g('g2', [s('b')])]);
        model.setSelection(['a'], { groupIds: ['g1'] });
        model.rearrangeItems([model.getItems()[1], model.getItems()[0]], { selectedGroupIds: ['g1', 'g2'] });
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
    });

    it('フォルダを丸ごと除くと、そのフォルダの選択も外れる', () => {
        const { model } = setup([g('g1', [s('a')]), s('b')]);
        model.setSelection(['a'], { groupIds: ['g1'] });
        model.rearrangeItems([model.getItems()[1]]);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        assert.deepEqual([...model.getSelectedIds()], []);
    });

    it('同じ構造なら何も変えず、通知もせずfalse', () => {
        const { model, log } = setup([g('g1', [s('a')]), s('b')]);
        assert.equal(model.rearrangeItems(model.getItems()), false);
        assert.deepEqual(log, []);
        assert.deepEqual(outline(model.getItems()), [['g1', ['a']], 'b']);
    });

    it('知らない図形は警告して不変', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const { model, log } = setup([s('a')]);
        assert.equal(model.rearrangeItems([model.getItems()[0], s('zz')]), false);
        assert.equal(warn.mock.callCount(), 1);
        assert.deepEqual(outline(model.getItems()), ['a']);
        assert.deepEqual(log, []);
    });

    it('図形の重複は警告して不変', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const { model, log } = setup([s('a'), s('b')]);
        const first = model.getItems()[0];
        assert.equal(model.rearrangeItems([first, first]), false);
        assert.equal(warn.mock.callCount(), 1);
        assert.deepEqual(outline(model.getItems()), ['a', 'b']);
        assert.deepEqual(log, []);
    });

    it('知らないフォルダのid・フォルダのidの重複は警告して不変', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const { model, log } = setup([g('g1', [s('a')]), s('b')]);
        const items = model.getItems();
        assert.equal(model.rearrangeItems([g('nothing', [items[0].children[0]]), items[1]]), false);
        assert.equal(model.rearrangeItems([g('g1', [items[0].children[0]]), g('g1', [items[1]])]), false);
        assert.equal(warn.mock.callCount(), 2);
        assert.deepEqual(outline(model.getItems()), [['g1', ['a']], 'b']);
        assert.deepEqual(log, []);
    });

    it('配列でない引数は警告して不変', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const { model } = setup([s('a')]);
        assert.equal(model.rearrangeItems(null), false);
        assert.equal(warn.mock.callCount(), 1);
    });

    it('作成途中の図形・選択矩形・吸い付きの表示の点に触れない', () => {
        const { model } = setup([s('a'), s('b')]);
        model.startDraft(1, 2, 'line');
        model.updateDraft(5, 6);
        model.setSelectionRect(0, 0, 3, 3);
        model.setSnapPoint(7, 8);
        const draft = model.getDraftShape();
        const items = model.getItems();
        model.rearrangeItems([g(null, [items[0]]), items[1]]);
        assert.equal(model.getDraftShape(), draft);
        assert.notEqual(model.getSelectionRect(), null);
        assert.notEqual(model.getSnapPoint(), null);
    });

    it('引数を書き換えず、図形インスタンスは共有する', () => {
        const { model } = setup([s('a'), s('b')]);
        const items = model.getItems();
        const group = g(null, [items[0], items[1]]);
        const next = [group];
        model.rearrangeItems(next);
        assert.equal(group.id, null);
        assert.equal('name' in group, false);
        assert.equal(next.length, 1);
        assert.equal(model.getShapes()[0], items[0].shape);
    });

    it('折りたたみは保たれ、onCollapsedChangeは呼ばれない', () => {
        const { model, log } = setup([g('g1', [s('a')], true), g('g2', [s('b')]), s('c')]);
        model.setSelection(['c']);
        log.length = 0;
        const items = model.getItems();
        assert.equal(model.rearrangeItems([items[1], items[0], items[2]]), true);
        const after = model.getItems();
        assert.equal(after[1].collapsed, true);
        assert.equal('collapsed' in after[0], false);
        assert.deepEqual(log, ['change']);
    });

    it('閉じたフォルダの中の図形を選んでいても、動かして開かない', () => {
        const { model, log } = setup([g('g1', [s('a')]), s('b')]);
        model.setSelection(['a']);
        model.setGroupCollapsed('g1', true);
        log.length = 0;
        const items = model.getItems();
        model.rearrangeItems([items[1], items[0]]);
        assert.equal(model.getItems()[1].collapsed, true);
        assert.deepEqual(log, ['change']);
    });
});
