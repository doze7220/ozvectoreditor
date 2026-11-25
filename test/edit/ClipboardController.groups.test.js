/**
 * 責務: ClipboardControllerのコピー・切り取り・貼り付け・複製が、フォルダの形（入れ子・名前・表示・ロック・折りたたみ・中の順番）を保ち、
 * 入る場所（まとまりのすぐ上・描き込む先・自分のコピーの見分け）に従うことを検証する。
 * 実物のVectorModel・ShapeInserter（insertsAtTarget: true）・GroupEditor・SnapshotAdapter・HistoryManager・ClipboardControllerを組み合わせる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * 図形のアイテムを作る（水平な直線。xから10の長さ。名前＝idの目印）。
 * @param {string} id 図形のid
 * @param {number} [x] 始点のx
 * @param {Object} [extra] 追加の属性（visible・locked等）
 * @returns {Object} 図形のアイテム
 */
function s(id, x = 0, extra = {}) {
    const line = new Line(x, 0, x + 10, 0, '#112233', 2);
    line.id = id;
    return { kind: 'shape', shape: line, name: id, ...extra };
}

/**
 * フォルダのアイテムを作る（名前＝idの目印）。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] 追加の属性（visible・locked・collapsed等）
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, extra = {}) {
    return { kind: 'group', id, name: id, children, ...extra };
}

/**
 * 入れ子を、名前だけの表現にする（新しいidになっても比べられる）。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<*>} 図形は名前、フォルダは[名前, 中身]
 */
function layout(items) {
    return items.map((item) => (item.kind === 'group' ? [item.name, layout(item.children)] : item.name));
}

/**
 * 今の作業データをJSON文字列にする。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function json(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

/**
 * 図形・フォルダを合わせたidに重複が無いことを確かめる。
 * @param {VectorModel} model モデル
 */
function assertUniqueIds(model) {
    const ids = [];
    const walk = (items) => items.forEach((item) => {
        if (item.kind === 'group') {
            ids.push(item.id);
            walk(item.children);
        } else {
            ids.push(item.shape.id);
        }
    });
    walk(model.getItems());
    assert.equal(new Set(ids).size, ids.length, `idが重複している: ${ids.join(',')}`);
}

/**
 * 実物を組み合わせる。切り取りの削除は`GroupEditor.removeSelection`、貼り付け・複製の入る場所は描き込む先（insertsAtTarget）。
 * @param {Array<Object>} items 初期のアイテムの入れ子
 * @returns {Object} 実物の組と、キャンバスの識別値を変える`setCanvasId`
 */
function setup(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const groupEditor = new GroupEditor({ model, editRecorder: history, getMode: () => OperationMode.SELECT });
    const inserter = new ShapeInserter({ model, editRecorder: history, insertsAtTarget: true });
    let canvasId = 'canvas-1';
    const clipboard = new ClipboardController({
        model,
        inserter,
        deleteSelection: () => groupEditor.removeSelection(),
        getCanvasId: () => canvasId
    });
    return { model, history, groupEditor, clipboard, setCanvasId: (id) => { canvasId = id; } };
}

/**
 * 外から見た選択（図形のidとフォルダのid）をまとめて設定する。一覧の行で選ぶ操作と同じく、閉じたフォルダを開かない（keepsCollapsed: true）。
 * @param {VectorModel} model モデル
 * @param {Array<string>} shapeIds 選ぶ図形のid
 * @param {Array<string>} groupIds 選ぶフォルダのid
 */
function select(model, shapeIds, groupIds = []) {
    model.setSelection(shapeIds, { groupIds, keepsCollapsed: true });
}

describe('コピー・貼り付け: フォルダの形で写る', () => {
    it('フォルダの名前・表示・ロック・折りたたみ・入れ子・中の順番が保たれ、idは新しくなる', () => {
        const { model, clipboard } = setup([
            g('g1', [s('a', 0, { visible: false }), g('g2', [s('b', 20), s('c', 40)], { locked: true, collapsed: true }), g('g3', [], { collapsed: true })], { visible: false }),
            s('z', 100)
        ]);
        select(model, ['a', 'b', 'c'], ['g1', 'g2', 'g3']);

        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);

        const items = model.getItems();
        assert.deepEqual(layout(items), [['g1', ['a', ['g2', ['b', 'c']], ['g3', []]]], ['g1', ['a', ['g2', ['b', 'c']], ['g3', []]]], 'z']);
        assert.equal(items.length, 3);
        const pasted = items[1];
        assert.equal(pasted.kind, 'group');
        assert.equal(pasted.name, 'g1');
        assert.equal(pasted.visible, false);
        assert.deepEqual(layout(pasted.children), ['a', ['g2', ['b', 'c']], ['g3', []]]);
        assert.equal(pasted.children[0].visible, false);
        assert.equal(pasted.children[1].locked, true);
        assert.equal(pasted.children[2].collapsed, true, '空の閉じたフォルダは閉じたまま');
        assert.equal(pasted.children[1].collapsed, true, '図形を含む閉じたフォルダは閉じたまま');
        assert.equal(items[0].children[1].collapsed, true, '元のフォルダも閉じたまま');
        assert.notEqual(pasted.id, 'g1');
        assert.notEqual(pasted.children[1].id, 'g2');
        assert.equal(model.getShapes().length, 7);
        assertUniqueIds(model);
    });

    it('入った図形とフォルダが選ばれ、選んでいるフォルダは一番外側の入ったフォルダ', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), g('g2', [s('b', 20)])])]);
        select(model, ['a', 'b'], ['g1', 'g2']);

        clipboard.copy();
        clipboard.paste();

        const pasted = model.getItems()[1];
        assert.deepEqual(model.getSelectedGroupIds(), [pasted.id]);
        assert.equal(model.getSelectedIds().length, 2);
    });

    it('ずらし量（段数）が中の図形に効く（コピー直後の貼り付けは1段）', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0)])]);
        select(model, ['a'], ['g1']);

        clipboard.copy();
        clipboard.paste();

        const original = model.getItems()[0].children[0].shape;
        const pasted = model.getItems()[1].children[0].shape;
        assert.equal(pasted.x1 - original.x1, 20);
    });

    it('フォルダと外の図形の混ざりは、順番を保ってひとかたまりで入る', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0)]), s('b', 20), s('c', 40)]);
        select(model, ['a', 'c'], ['g1']);

        clipboard.copy();
        clipboard.paste();

        assert.deepEqual(layout(model.getItems()), [['g1', ['a']], 'b', 'c', ['g1', ['a']], 'c']);
        assertUniqueIds(model);
    });

    it('選んでいるフォルダの中のフォルダ・図形を二重に写さない', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), g('g2', [s('b', 20)])])]);
        select(model, ['a', 'b'], ['g1', 'g2']);

        clipboard.copy();
        clipboard.paste();

        assert.equal(model.getShapes().length, 4);
        assert.equal(model.getItems().length, 2);
        assert.deepEqual(layout(model.getItems()[1].children), ['a', ['g2', ['b']]]);
    });

    it('フォルダの中の図形だけを選んだときは、図形だけが写る（フォルダは写らない）', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), s('b', 20)]), s('c', 40)]);
        select(model, ['a']);

        clipboard.copy();
        clipboard.paste();

        assert.equal(model.getItems().filter((i) => i.kind === 'group').length, 1, 'フォルダは増えない');
        assert.equal(model.getShapes().length, 4);
        assert.deepEqual(layout(model.getItems()[0].children), ['a', 'a', 'b']);
        assertUniqueIds(model);
    });

    it('空のフォルダだけを選んでも、コピー・貼り付けができる（空のフォルダが入る）', () => {
        const { model, history, clipboard } = setup([g('g1', []), s('c')]);
        select(model, [], ['g1']);

        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', []], ['g1', []], 'c']);
        assert.equal(history.canUndo(), true);
        assertUniqueIds(model);
    });

    it('図形を含む閉じたフォルダ（入れ子のもの・いちばん外側のもの）は、貼り付け・複製・その場の複製・切り取って貼り付けで閉じたまま入り、元も閉じたまま', () => {
        const make = () => setup([g('g1', [s('a', 0), g('g2', [s('b', 20)], { collapsed: true })], { collapsed: true }), s('z', 100)]);
        const pick = (model) => select(model, ['a', 'b'], ['g1', 'g2']);
        const assertClosed = (folder, label) => {
            assert.equal(folder.collapsed, true, `${label}: いちばん外側が閉じたまま`);
            assert.equal(folder.children[1].collapsed, true, `${label}: 入れ子が閉じたまま`);
        };

        const paste = make();
        pick(paste.model);
        paste.clipboard.copy();
        paste.clipboard.paste();
        assertClosed(paste.model.getItems()[1], '貼り付け');
        assertClosed(paste.model.getItems()[0], '貼り付け（元）');

        const dup = make();
        pick(dup.model);
        dup.clipboard.duplicate();
        assertClosed(dup.model.getItems()[1], '複製');
        assertClosed(dup.model.getItems()[0], '複製（元）');

        const inPlace = make();
        pick(inPlace.model);
        inPlace.history.beginEdit();
        assert.equal(inPlace.clipboard.duplicateInPlaceWithinEdit(), true);
        inPlace.history.commitEdit();
        assertClosed(inPlace.model.getItems()[1], 'その場の複製');
        assertClosed(inPlace.model.getItems()[0], 'その場の複製（元）');

        const cut = make();
        pick(cut.model);
        cut.clipboard.cut();
        cut.clipboard.paste();
        assertClosed(cut.model.getItems()[0], '切り取って貼り付け');
    });
});

describe('複製: まとまりの一番上のすぐ上', () => {
    it('フォルダの複製は、中ではなく元のフォルダのすぐ上へ入り、写った方が選ばれる', () => {
        const { model, clipboard } = setup([s('x', 0), g('g1', [s('a', 20)]), s('c', 40)]);
        select(model, ['a'], ['g1']);

        assert.equal(clipboard.duplicate(), true);

        assert.deepEqual(layout(model.getItems()), ['x', ['g1', ['a']], ['g1', ['a']], 'c']);
        const copied = model.getItems()[2];
        assert.deepEqual(model.getSelectedGroupIds(), [copied.id]);
        assert.deepEqual(model.getSelectedIds(), [copied.children[0].shape.id]);
        assert.equal(copied.children[0].shape.x1 - model.getItems()[1].children[0].shape.x1, 20);
        assertUniqueIds(model);
    });

    it('離れたまとまりは、一番上のもののすぐ上へひとかたまりで入る', () => {
        const { model, clipboard } = setup([s('a', 0), s('b', 20), g('g1', [s('c', 40)]), s('d', 60)]);
        select(model, ['a', 'c'], ['g1']);

        assert.equal(clipboard.duplicate(), true);

        assert.deepEqual(layout(model.getItems()), ['a', 'b', ['g1', ['c']], 'a', ['g1', ['c']], 'd']);
        assertUniqueIds(model);
    });

    it('フォルダの中の図形だけの複製は、その図形のすぐ上（同じフォルダの中）へ入る', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), s('b', 20)])]);
        select(model, ['a']);

        assert.equal(clipboard.duplicate(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a', 'a', 'b']]]);
    });

    it('クリップボード・段数は変わらない（複製のあとの貼り付けは元のコピーの1段）', () => {
        const { model, clipboard } = setup([s('a', 0), s('b', 20)]);
        select(model, ['a']);
        clipboard.copy();
        select(model, ['b']);

        clipboard.duplicate();
        select(model, []);
        clipboard.paste();

        const pasted = model.getShapes().filter((shape) => shape.x1 === 20);
        assert.equal(pasted.length, 2, 'bの複製（+20＝40）ではなく、aのコピーの貼り付け（x=20）が入る');
    });

    it('空のフォルダだけの複製ができる', () => {
        const { model, clipboard } = setup([g('g1', []), s('c')]);
        select(model, [], ['g1']);

        assert.equal(clipboard.duplicate(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', []], ['g1', []], 'c']);
    });
});

describe('貼り付けの入る場所と自分のコピー', () => {
    it('コピー→貼り付けは元のフォルダのすぐ上。続けて貼り付けてもコピーの中へ入り込まず、すぐ上へ重なる', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0)]), s('c', 40)]);
        select(model, ['a'], ['g1']);
        clipboard.copy();

        clipboard.paste();
        clipboard.paste();
        clipboard.paste();

        assert.deepEqual(layout(model.getItems()), [['g1', ['a']], ['g1', ['a']], ['g1', ['a']], ['g1', ['a']], 'c']);
        assert.equal(model.getShapes().length, 5);
        assertUniqueIds(model);
    });

    it('入れ子のフォルダを選んで貼り付けると、そのフォルダのすぐ上（外のフォルダの中）へ入る', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), g('g2', [s('b', 20)])])]);
        select(model, ['a', 'b'], ['g1', 'g2']);
        clipboard.copy();
        select(model, ['b'], ['g2']);

        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a', ['g2', ['b']], ['g1', ['a', ['g2', ['b']]]]]]]);
    });

    it('自分のコピーでないフォルダを選んで貼り付けると、そのフォルダの中の一番上へ入る', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0)]), g('g2', [s('b', 20)])]);
        select(model, ['a'], ['g1']);
        clipboard.copy();
        select(model, ['b'], ['g2']);

        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a']], ['g2', ['b', ['g1', ['a']]]]]);
        assertUniqueIds(model);
    });

    it('図形をコピーして、フォルダを選んで貼り付けると、フォルダの中の一番上へ入る', () => {
        const { model, clipboard } = setup([s('x', 0), g('g1', [s('a', 20)])]);
        select(model, ['x']);
        clipboard.copy();
        select(model, [], ['g1']);
        select(model, ['a'], ['g1']);

        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), ['x', ['g1', ['a', 'x']]]);
    });

    it('別のキャンバス（識別値が違う）の同じidのフォルダは、自分のコピーとみなさず中へ入る', () => {
        const { model, clipboard, setCanvasId } = setup([g('g1', [s('a', 0)])]);
        select(model, ['a'], ['g1']);
        clipboard.copy();
        setCanvasId('canvas-2');
        select(model, ['a'], ['g1']);

        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a', ['g1', ['a']]]]]);
    });

    it('同じ位置に貼り付け（pasteInPlace）もフォルダの形で入り、段数は変えない', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0)])]);
        select(model, ['a'], ['g1']);
        clipboard.copy();

        assert.equal(clipboard.pasteInPlace(), true);
        assert.equal(clipboard.pasteInPlace(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a']], ['g1', ['a']], ['g1', ['a']]]);
        assert.equal(model.getItems()[1].children[0].shape.x1, 0);
        select(model, []);
        clipboard.paste();
        assert.equal(model.getItems().at(-1).children[0].shape.x1, 20, '段数はコピーの1のまま');
    });
});

describe('切り取り→貼り付け: 元の場所へ戻る', () => {
    it('フォルダの中の途中の図形（元のすぐ上の図形の上）へ戻る', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), s('b', 20), s('c', 40)])]);
        select(model, ['b']);

        assert.equal(clipboard.cut(), true);
        assert.deepEqual(layout(model.getItems()), [['g1', ['a', 'c']]]);
        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a', 'b', 'c']]]);
    });

    it('フォルダの中の一番下の図形は、中の一番下へ戻る', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0), s('b', 20)]), s('c', 40)]);
        select(model, ['a']);

        clipboard.cut();
        clipboard.paste();

        assert.deepEqual(layout(model.getItems()), [['g1', ['a', 'b']], 'c']);
    });

    it('いちばん外側の一番下は、いちばん外側の一番下へ戻る', () => {
        const { model, clipboard } = setup([s('a', 0), s('b', 20)]);
        select(model, ['a']);

        clipboard.cut();
        clipboard.paste();

        assert.deepEqual(layout(model.getItems()), ['a', 'b']);
    });

    it('フォルダごと切り取って貼り付けると、フォルダの形で元の場所へ戻る', () => {
        const { model, clipboard } = setup([s('x', 0), g('g1', [s('a', 20)]), s('c', 40)]);
        select(model, ['a'], ['g1']);

        assert.equal(clipboard.cut(), true);
        assert.deepEqual(layout(model.getItems()), ['x', 'c']);
        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), ['x', ['g1', ['a']], 'c']);
        assertUniqueIds(model);
    });

    it('空のフォルダを切り取って貼り付けると、空のフォルダが元の場所へ戻る', () => {
        const { model, clipboard } = setup([s('x', 0), g('g1', []), s('c', 40)]);
        select(model, [], ['g1']);

        assert.equal(clipboard.cut(), true);
        assert.deepEqual(layout(model.getItems()), ['x', 'c']);
        assert.equal(clipboard.paste(), true);

        assert.deepEqual(layout(model.getItems()), ['x', ['g1', []], 'c']);
    });

    it('切り取り直後の貼り付けは元の位置（段数0）', () => {
        const { model, clipboard } = setup([g('g1', [s('a', 0)]), s('c', 40)]);
        select(model, ['a'], ['g1']);

        clipboard.cut();
        clipboard.paste();

        assert.equal(model.getItems()[0].children[0].shape.x1, 0);
    });
});

describe('記録と取り消し・やり直し', () => {
    it('貼り付け・複製・切り取りは、それぞれ記録1件で、取り消しとやり直しのJSONが一致する', () => {
        const { model, history, clipboard } = setup([g('g1', [s('a', 0), g('g2', [s('b', 20)])]), s('c', 40)]);
        select(model, ['a', 'b'], ['g1', 'g2']);
        const initial = json(model);

        clipboard.copy();
        assert.equal(history.canUndo(), false, 'コピーは記録しない');

        clipboard.paste();
        const afterPaste = json(model);
        clipboard.duplicate();
        const afterDuplicate = json(model);
        clipboard.cut();
        const afterCut = json(model);

        assert.equal(history.undo(), true);
        assert.equal(json(model), afterDuplicate);
        assert.equal(history.undo(), true);
        assert.equal(json(model), afterPaste);
        assert.equal(history.undo(), true);
        assert.equal(json(model), initial);
        assert.equal(history.canUndo(), false);

        assert.equal(history.redo(), true);
        assert.equal(json(model), afterPaste);
        assert.equal(history.redo(), true);
        assert.equal(json(model), afterDuplicate);
        assert.equal(history.redo(), true);
        assert.equal(json(model), afterCut);
        assertUniqueIds(model);
    });

    it('Alt+ドラッグの手順（beginEdit→複製→移動→commitEdit）は1件で、フォルダを選んだ状態のまま動き、取り消し1回で戻る', () => {
        const { model, history, clipboard } = setup([g('g1', [s('a', 0), s('b', 20)]), s('c', 40)]);
        select(model, ['a', 'b'], ['g1']);
        const before = json(model);

        history.beginEdit();
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
        const copied = model.getItems()[1];
        assert.deepEqual(model.getSelectedGroupIds(), [copied.id], '写したフォルダが選ばれている');
        model.moveShapes(model.getSelectedIds(), 5, 7);
        assert.equal(history.commitEdit(), true);

        assert.deepEqual(layout(model.getItems()), [['g1', ['a', 'b']], ['g1', ['a', 'b']], 'c']);
        assert.equal(model.getItems()[0].children[0].shape.x1, 0, '元は動かない');
        assert.equal(model.getItems()[1].children[0].shape.x1, 5, '写しが動く');
        assert.deepEqual(model.getSelectedGroupIds(), [copied.id]);
        assertUniqueIds(model);

        assert.equal(history.undo(), true);
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false, '記録は1件だけ');
    });
});

describe('フォルダの無い絵', () => {
    it('複製は選んだ図形の一番上のすぐ上へ、コピー→貼り付けは描き込む先（選んだ図形）のすぐ上へ入る', () => {
        const { model, clipboard } = setup([s('a', 0), s('b', 20), s('c', 40)]);
        select(model, ['a']);

        clipboard.duplicate();
        assert.deepEqual(layout(model.getItems()), ['a', 'a', 'b', 'c']);

        select(model, ['c']);
        clipboard.copy();
        clipboard.paste();
        assert.deepEqual(layout(model.getItems()), ['a', 'a', 'b', 'c', 'c']);
        assert.equal(model.getShapes().length, 5);
        assertUniqueIds(model);
    });

    it('切り取り→貼り付けは元の場所（一番下も）へ戻る', () => {
        const { model, clipboard } = setup([s('a', 0), s('b', 20), s('c', 40)]);
        select(model, ['b']);

        clipboard.cut();
        clipboard.paste();

        assert.deepEqual(layout(model.getItems()), ['a', 'b', 'c']);
    });

    it('選択が空なら、コピー・切り取り・複製は何もしない', () => {
        const { model, history, clipboard } = setup([s('a', 0)]);
        select(model, []);

        assert.equal(clipboard.copy(), false);
        assert.equal(clipboard.cut(), false);
        assert.equal(clipboard.duplicate(), false);
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), false);
        assert.equal(clipboard.isEmpty(), true);
        assert.equal(history.canUndo(), false);
    });
});
