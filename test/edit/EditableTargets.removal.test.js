/**
 * 責務: 削除・切り取り・Alt+ドラッグの複製が「変えられる図形」（隠れてもロックされてもいないもの）だけを対象にし、コピー・複製・並べ替え・まとめる・名前の変更が変えられないものにも働くことを、実物のVectorModelで検証する。
 * GroupEditor・ClipboardController・ShapeOrderEditor・ItemRenameEditorを通して確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ItemRenameEditor } from '../../js/edit/ItemRenameEditor.js';
import { ShapeOrderOperation } from '../../js/edit/ShapeOrderRules.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @param {number} x 左上のx（幅・高さは10）
 * @returns {Rect} 矩形
 */
function box(id, x = 0) {
    const rect = new Rect(x, 0, x + 10, 10, '#112233', 2, null);
    rect.id = id;
    return rect;
}

/**
 * 図形のアイテムを作る。
 * @param {string} id 図形のid
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @returns {Object} アイテム
 */
function shape(id, visible = true, locked = false) {
    return { kind: 'shape', shape: box(id), name: id, visible, locked };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {boolean} visible 表示
 * @param {boolean} locked ロック
 * @returns {Object} アイテム
 */
function folder(id, children, visible = true, locked = false) {
    return { kind: 'group', id, name: id, visible, locked, children };
}

/**
 * 実物を組み合わせる。削除はInputTrackerと同じく、消えるものがあるときだけGroupEditor.removeSelectionを呼ぶ。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Object} 組み合わせた実物
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const groups = new GroupEditor({ model, editRecorder: history, getMode: () => OperationMode.SELECT });
    const deleteSelection = () => (model.hasRemovableSelection() ? groups.removeSelection() : false);
    const inserter = new ShapeInserter({ model, editRecorder: history, insertsAtTarget: true });
    const clipboard = new ClipboardController({ model, inserter, deleteSelection });
    return { model, history, groups, clipboard, deleteSelection };
}

/**
 * 外側の並びのアイテムを、図形はid・フォルダは{id, children}で簡単に表す。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array} 簡易表現
 */
function outline(items) {
    return items.map((item) => (item.kind === 'group'
        ? { id: item.id, children: outline(item.children) }
        : item.shape.id));
}

describe('削除の残り方', () => {
    it('混ざり: 変えられる図形だけが消え、ロックした図形・隠した図形は残る。選択は空になり、取り消し1回で戻る', () => {
        const { model, history, groups } = setup([shape('A'), shape('L', true, true), shape('H', false, false), shape('C')]);
        model.setSelection(['A', 'L', 'H', 'C']);
        assert.equal(groups.removeSelection(), true);
        assert.deepEqual(outline(model.getItems()), ['L', 'H']);
        assert.deepEqual(model.getSelectedIds(), []);
        assert.equal(history.canUndo(), true);
        history.undo();
        assert.deepEqual(outline(model.getItems()), ['A', 'L', 'H', 'C']);
        assert.equal(history.canUndo(), false);
    });

    it('入れ子の一部だけ消える: フォルダは残り、中の変えられるものだけが消える', () => {
        const { model, groups } = setup([folder('G', [shape('A'), shape('L', true, true)]), shape('C')]);
        model.setSelection(['A', 'L'], { groupIds: ['G'] });
        assert.equal(groups.removeSelection(), true);
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['L'] }, 'C']);
    });

    it('変えられるフォルダは中身が全部消えるなら消え、空のフォルダも消える', () => {
        const { model, groups } = setup([folder('G', [shape('A')]), folder('E', []), shape('C')]);
        model.setSelection(['A'], { groupIds: ['G', 'E'] });
        assert.equal(groups.removeSelection(), true);
        assert.deepEqual(outline(model.getItems()), ['C']);
    });

    it('ロックしたフォルダの中は上から受け継いで何も消えない: 記録なし・選択そのまま', () => {
        const { model, history, groups } = setup([folder('G', [shape('A')], true, true), shape('C')]);
        model.setSelection(['A'], { groupIds: ['G'] });
        assert.equal(groups.removeSelection(), false);
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['A'] }, 'C']);
        assert.deepEqual(model.getSelectedIds(), ['A']);
        assert.deepEqual(model.getSelectedGroupIds(), ['G']);
        assert.equal(history.canUndo(), false);
    });

    it('隠したフォルダの中も何も消えない', () => {
        const { model, history, groups } = setup([folder('G', [shape('A')], false, false)]);
        model.setSelection(['A']);
        assert.equal(groups.removeSelection(), false);
        assert.equal(model.getShapes().length, 1);
        assert.equal(history.canUndo(), false);
    });

    it('変えられないものだけを選ぶと何も消えず、hasRemovableSelectionも偽', () => {
        const { model, history, groups } = setup([shape('L', true, true), shape('C')]);
        model.setSelection(['L']);
        assert.equal(model.hasRemovableSelection(), false);
        assert.equal(groups.removeSelection(), false);
        assert.deepEqual(model.getSelectedIds(), ['L']);
        assert.equal(history.canUndo(), false);
    });

    it('すべて表示・ロックなしなら今までどおり全部消える', () => {
        const { model, groups } = setup([folder('G', [shape('A'), shape('B')]), shape('C')]);
        model.setSelection(['A', 'B', 'C'], { groupIds: ['G'] });
        assert.equal(groups.removeSelection(), true);
        assert.deepEqual(model.getItems(), []);
    });
});

describe('切り取り', () => {
    it('混ざり: 変えられるものだけがクリップボードへ入り、変えられないものは元に残る。貼り付けで形が戻る', () => {
        const { model, history, clipboard } = setup([folder('G', [shape('A'), shape('L', true, true)]), shape('C')]);
        model.setSelection(['A', 'L'], { groupIds: ['G'] });
        assert.equal(clipboard.cut(), true);
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['L'] }, 'C']);
        assert.equal(history.canUndo(), true);
        assert.equal(clipboard.paste(), true);
        const items = model.getItems();
        assert.equal(items.length, 3);
        const pasted = items.filter((item) => item.kind === 'group' && item.id !== 'G');
        assert.equal(pasted.length, 1);
        assert.deepEqual(pasted[0].children.map((child) => child.name), ['A']);
    });

    it('何も消えないとき: falseでクリップボードも履歴の段数も変わらない', () => {
        const { model, history, clipboard } = setup([shape('L', true, true), shape('C')]);
        model.setSelection(['C']);
        assert.equal(clipboard.copy(), true);
        model.setSelection(['L']);
        assert.equal(clipboard.cut(), false);
        assert.equal(history.canUndo(), false);
        assert.equal(clipboard.paste(), true);
        assert.equal(model.getItems()[2].name, 'C');
    });

    it('変えられるフォルダの中が空になって消えるとき、フォルダごと写って貼り付けで戻る', () => {
        const { model, clipboard } = setup([folder('G', [shape('A')]), shape('C')]);
        model.setSelection(['A'], { groupIds: ['G'] });
        assert.equal(clipboard.cut(), true);
        assert.deepEqual(outline(model.getItems()), ['C']);
        assert.equal(clipboard.pasteInPlace(), true);
        const items = model.getItems();
        assert.equal(items.length, 2);
        const pasted = items.filter((item) => item.kind === 'group');
        assert.equal(pasted.length, 1);
        assert.deepEqual(pasted[0].children.map((child) => child.name), ['A']);
    });

    it('残ったフォルダの中が描き込む先のとき、貼り付けは中でなくそのフォルダのすぐ上へ入る', () => {
        const { model, clipboard } = setup([folder('G', [shape('A'), shape('L', true, true)])]);
        model.setSelection(['A', 'L'], { groupIds: ['G'] });
        assert.equal(clipboard.cut(), true);
        model.setInsertTarget('G');
        assert.equal(clipboard.paste(), true);
        const items = model.getItems();
        assert.equal(items.length, 2);
        assert.equal(items[0].id, 'G');
        assert.equal(items[0].children.length, 1);
        assert.equal(items[1].kind, 'group');
    });
});

describe('Alt+ドラッグの複製（duplicateInPlaceWithinEdit）', () => {
    it('変えられるものだけが写り、写ったものが全部getEditableSelectedIdsに入る。入る場所は写したまとまりの一番上のすぐ上', () => {
        const { model, history, clipboard } = setup([shape('A'), shape('L', true, true), shape('C')]);
        model.setSelection(['A', 'L', 'C']);
        history.beginEdit();
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
        history.commitEdit();
        const items = model.getItems();
        assert.deepEqual(items.map((item) => item.name), ['A', 'L', 'C', 'A', 'C']);
        assert.equal(model.getEditableSelectedIds().length, 2);
        assert.equal(model.getSelectedIds().length, 2);
        assert.equal(history.canUndo(), true);
    });

    it('ロックしたフォルダの中のまとまりが一番上でも、複製はその中へ入らない', () => {
        const { model, history, clipboard } = setup([shape('A'), folder('G', [shape('L')], true, true)]);
        model.setSelection(['A', 'L']);
        history.beginEdit();
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
        history.commitEdit();
        const items = model.getItems();
        assert.equal(items.length, 3);
        assert.equal(items[1].name, 'A');
        assert.equal(items[2].kind, 'group');
        assert.equal(items[2].children.length, 1);
    });

    it('変えられないものだけなら何もせずfalse', () => {
        const { model, history, clipboard } = setup([shape('L', true, true), shape('C')]);
        model.setSelection(['L']);
        history.beginEdit();
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), false);
        history.commitEdit();
        assert.equal(model.getItems().length, 2);
        assert.equal(history.canUndo(), false);
    });
});

describe('変えられないものにも働く操作', () => {
    it('コピー・複製（Ctrl+D）: ロック・隠した図形も写り、表示・ロックが同じ', () => {
        const { model, clipboard } = setup([shape('L', true, true), shape('H', false, false)]);
        model.setSelection(['L', 'H']);
        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.duplicate(), true);
        const items = model.getItems();
        assert.equal(items.length, 4);
        const copies = items.slice(2).map((item) => ({ visible: item.visible, locked: item.locked }));
        assert.deepEqual(copies, [{ visible: true, locked: true }, { visible: false, locked: false }]);
    });

    it('並べ替え: ロックした図形も重なり順を変えられる', () => {
        const { model, history } = setup([shape('L', true, true), shape('C')]);
        const order = new ShapeOrderEditor({ model, editRecorder: history });
        model.setSelection(['L']);
        assert.equal(order.apply(ShapeOrderOperation.BRING_TO_FRONT), true);
        assert.deepEqual(outline(model.getItems()), ['C', 'L']);
    });

    it('行のドラッグのmoveTo: ロックした図形も動かせる', () => {
        const { model, history } = setup([shape('L', true, true), shape('C')]);
        const order = new ShapeOrderEditor({ model, editRecorder: history });
        assert.equal(order.moveTo(['L'], { kind: 'above', id: 'C' }), true);
        assert.deepEqual(outline(model.getItems()), ['C', 'L']);
        assert.equal(model.getItems()[1].locked, true);
    });

    it('まとめる・解除: ロックした図形も1件でまとまり、解除で戻る', () => {
        const { model, groups } = setup([shape('L', true, true), shape('C')]);
        model.setSelection(['L']);
        assert.equal(groups.groupSelection(), true);
        assert.equal(model.getItems()[0].kind, 'group');
        assert.equal(groups.ungroupSelection(), true);
        assert.equal(model.getItems()[0].kind, 'shape');
        assert.equal(model.getItems()[0].locked, true);
    });

    it('名前の変更: 隠した図形・ロックした図形の名前も変えられる', () => {
        const { model, history } = setup([shape('L', true, true), shape('H', false, false)]);
        const renamer = new ItemRenameEditor({ model, editRecorder: history });
        assert.equal(renamer.rename('L', '新L'), true);
        assert.equal(renamer.rename('H', '新H'), true);
        assert.deepEqual(model.getItems().map((item) => item.name), ['新L', '新H']);
        assert.equal(model.getItems()[0].locked, true);
        assert.equal(model.getItems()[1].visible, false);
    });
});
