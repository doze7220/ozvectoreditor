/**
 * 責務: フォルダの基本操作（まとめる・解除・削除・名前・重なり順のキー・結合・複製/コピー/貼り付け/切り取り・描き込む先・作業データの往復）を、実物を組み合わせて公開APIだけで通して検証する。
 * 実物はVectorModel・SnapshotAdapter・HistoryManager・GroupEditor・ShapeOrderEditor・PathJoiner・ShapeInserter・ClipboardController・ItemRenameEditor・DocumentSerializer・SpriteSerializer。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ShapeOrderOperation } from '../../js/edit/ShapeOrderRules.js';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { ItemRenameEditor } from '../../js/edit/ItemRenameEditor.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した水平な直線（y=0）を作る。
 * @param {string} id 代入するid
 * @param {number} x1 始点x
 * @param {number} x2 終点x
 * @returns {Line} 直線
 */
function makeLine(id, x1, x2) {
    const line = new Line(x1, 0, x2, 0, '#112233', 2);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る（水平な直線。xから10の長さ）。
 * @param {string} id 図形のid
 * @param {number} [x] 始点のx。省けば0
 * @param {string} [name] 名前。省けば未定（自動）
 * @returns {Object} 図形のアイテム
 */
function s(id, x = 0, name) {
    return name === undefined
        ? { kind: 'shape', shape: makeLine(id, x, x + 10) }
        : { kind: 'shape', shape: makeLine(id, x, x + 10), name };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] 追加の属性（名前・折りたたみ等）
 * @returns {Object} フォルダのアイテム
 */
function g(id, children, extra = {}) {
    return { kind: 'group', id, children, ...extra };
}

/**
 * 入れ子を、種類とidだけの表現にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<*>} 図形はid、フォルダは[id, 中身]
 */
function tree(items) {
    return items.map((item) => (item.kind === 'group' ? [item.id, tree(item.children)] : item.shape.id));
}

/**
 * 入れ子の中の図形のidを描画順（前順）で返す。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<string>} 図形のid
 */
function shapeIdsOf(items) {
    return items.flatMap((item) => (item.kind === 'group' ? shapeIdsOf(item.children) : [item.shape.id]));
}

/**
 * 今の作業データをJSON文字列にする（取り消し/やり直しの一致の比較用）。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function json(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

/**
 * 実物をすべて組み合わせる。取り消し/やり直しは選択を戻す。切り取りの削除は`GroupEditor.removeSelection`（本番と同じ経路）。
 * @param {Array<Object>} items 初期のアイテムの入れ子
 * @returns {Object} 実物の組（model・history・groupEditor・orderEditor・joiner・inserter・clipboard・renamer）
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
    const orderEditor = new ShapeOrderEditor({ model, editRecorder: history });
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    const clipboard = new ClipboardController({ model, inserter, deleteSelection: () => groupEditor.removeSelection() });
    const renamer = new ItemRenameEditor({ model, editRecorder: history });
    return { model, history, groupEditor, orderEditor, joiner, inserter, clipboard, renamer };
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

describe('まとめる前後の書き出し', () => {
    it('隣り合う図形をまとめても、elementsとboundsは変わらない（フォルダの要素は出ない）', () => {
        const { model, groupEditor } = setup([s('a', 0), s('b', 20), s('c', 40)]);
        const before = SpriteSerializer.serialize(model.getItems());
        const workBefore = DocumentSerializer.serialize(model.getItems());
        model.setSelection(['b', 'c']);

        assert.equal(groupEditor.groupSelection(), true);

        assert.equal(model.getItems().length, 2);
        assert.equal(model.getItems()[1].kind, 'group');
        const after = SpriteSerializer.serialize(model.getItems());
        assert.deepEqual(after.elements, before.elements);
        assert.deepEqual(after.bounds, before.bounds);
        assert.notDeepEqual(DocumentSerializer.serialize(model.getItems()), workBefore, '作業データにはフォルダが出る');
    });
});

describe('別々のフォルダの線の結合', () => {
    it('奥の線の場所・名前になり、除かれた側のフォルダも残る。取り消しで戻る', () => {
        const { model, history, joiner } = setup([
            g('g1', [s('a', 0, '奥の線')]),
            g('g2', [s('b', 10, '手前の線')])
        ]);
        model.setSelection(['a', 'b']);
        const before = json(model);

        assert.equal(joiner.join(), true);

        const items = model.getItems();
        assert.equal(items.length, 2);
        assert.deepEqual(items.map((i) => i.id), ['g1', 'g2'], '両方のフォルダが残る');
        assert.equal(items[0].children.length, 1);
        assert.equal(items[0].children[0].name, '奥の線');
        assert.equal(items[1].children.length, 0, '除かれた側のフォルダは空で残る');
        assertUniqueIds(model);
        assert.equal(history.canUndo(), true);

        assert.equal(history.undo(), true);
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false, '記録は1件だけ');
    });
});

describe('フォルダを選んだ複製・コピー・貼り付け・切り取り', () => {
    /**
     * 外側にフォルダg1（図形a・b）と図形cを置いたアイテムを作る。
     * @returns {Array<Object>} アイテムの入れ子
     */
    const makeItems = () => [g('g1', [s('a', 0), s('b', 20)]), s('c', 40)];

    it('複製: フォルダの形のまま写り、元の図形は消えず、複製が二重にならない', () => {
        const { model, clipboard } = setup(makeItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });

        assert.equal(clipboard.duplicate(), true);

        assert.equal(model.getShapes().length, 5);
        assert.deepEqual(tree(model.getItems()).slice(0, 2), [['g1', ['a', 'b']], 'c'], '元のフォルダ・図形はそのまま');
        const groups = model.getItems().filter((i) => i.kind === 'group');
        assert.equal(groups.length, 2, '複製もフォルダの形のまま入る');
        assert.equal(groups[1].children.length, 2);
        assert.equal(new Set(model.getShapes().map((shape) => shape.id)).size, 5);
        assert.equal(model.getSelectedIds().length, 2, '追加した図形だけが選ばれる');
        assert.deepEqual(model.getSelectedGroupIds(), [groups[1].id], '写ったフォルダが選ばれる');
        assertUniqueIds(model);
    });

    it('コピー→貼り付け: 元の図形・フォルダは変わらず、2つずつ増える', () => {
        const { model, clipboard } = setup(makeItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });

        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);

        assert.equal(model.getShapes().length, 5);
        assert.deepEqual(tree(model.getItems()).slice(0, 2), [['g1', ['a', 'b']], 'c']);
        assertUniqueIds(model);
        assert.equal(clipboard.paste(), true, '続けて貼り付けても壊れない');
        assert.equal(model.getShapes().length, 7);
        assertUniqueIds(model);
    });

    it('切り取り→貼り付け: フォルダごと消え、貼り付けでフォルダの形のまま戻る（二重にならない）', () => {
        const { model, history, clipboard } = setup(makeItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });

        assert.equal(clipboard.cut(), true);

        assert.deepEqual(tree(model.getItems()), ['c'], 'フォルダも消える');
        assert.deepEqual(model.getSelectedGroupIds(), []);
        assert.equal(history.canUndo(), true);

        assert.equal(clipboard.paste(), true);
        assert.equal(model.getShapes().length, 3);
        assert.equal(model.getItems().filter((i) => i.kind === 'group').length, 1, 'フォルダの形のまま戻る');
        assert.equal(model.getItems().find((i) => i.kind === 'group').children.length, 2);
        assert.equal(model.getSelectedGroupIds().length, 1);
        assertUniqueIds(model);
    });

    it('切り取りの取り消し: フォルダと図形が元に戻る', () => {
        const { model, history, clipboard } = setup(makeItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        const before = json(model);

        clipboard.cut();
        assert.equal(history.undo(), true);

        assert.equal(json(model), before);
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
    });

    it('空のフォルダだけを選んだコピー・切り取りができ、貼り付けで空のフォルダが入る', () => {
        const { model, history, clipboard } = setup([g('g1', []), s('c')]);
        model.setSelection([], { groupIds: ['g1'] });

        assert.equal(clipboard.copy(), true);
        assert.deepEqual(tree(model.getItems()), [['g1', []], 'c'], 'コピーでは何も消えない');
        assert.equal(history.canUndo(), false);

        assert.equal(clipboard.cut(), true);
        assert.deepEqual(tree(model.getItems()), ['c'], '切り取りでフォルダが消える');
        assert.equal(history.canUndo(), true);

        assert.equal(clipboard.paste(), true);
        const items = model.getItems();
        assert.equal(items.length, 2);
        assert.equal(items[1].kind, 'group');
        assert.equal(items[1].children.length, 0, '空のフォルダのまま入る');
        assertUniqueIds(model);
    });

    it('記録しない複製（Alt+ドラッグの手順）: 開いた編集操作の中なら1件で記録され、フォルダは壊れない', () => {
        const { model, history, clipboard } = setup(makeItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        const before = json(model);

        history.beginEdit();
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
        assert.equal(history.commitEdit(), true);

        assert.equal(model.getShapes().length, 5);
        assert.deepEqual(tree(model.getItems()).slice(0, 2), [['g1', ['a', 'b']], 'c']);
        assertUniqueIds(model);
        assert.equal(history.undo(), true);
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false);
    });

    it('記録しない複製を編集操作の外で呼ぶと、履歴には載らないが図形は増えフォルダは壊れない', () => {
        const { model, history, clipboard } = setup(makeItems());
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });

        assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);

        assert.equal(history.canUndo(), false);
        assert.equal(model.getShapes().length, 5);
        assert.deepEqual(tree(model.getItems()).slice(0, 2), [['g1', ['a', 'b']], 'c']);
        assertUniqueIds(model);
    });
});

describe('フォルダの名前の変更と取り消し', () => {
    it('名前を変えると記録され、取り消しで元の名前、やり直しで新しい名前に戻る', () => {
        const { model, history, renamer } = setup([g('g1', [s('a')], { name: '甲' })]);

        assert.equal(renamer.rename('g1', '乙組'), true);

        assert.equal(model.getItems()[0].name, '乙組');
        assert.equal(history.undo(), true);
        assert.equal(model.getItems()[0].name, '甲');
        assert.equal(history.redo(), true);
        assert.equal(model.getItems()[0].name, '乙組');
    });

    it('同じ名前・空の名前では変わらず、記録もされない', () => {
        const { model, history, renamer } = setup([g('g1', [s('a')], { name: '甲' })]);

        assert.equal(renamer.rename('g1', '甲'), false);
        assert.equal(renamer.rename('g1', '   '), false);

        assert.equal(model.getItems()[0].name, '甲');
        assert.equal(history.canUndo(), false);
    });
});

describe('まとめる→入れ子→キー→解除→削除と、取り消しの往復', () => {
    it('取り消しをすべて往復すると、JSONとフォルダの選択が各段階で一致する', () => {
        const { model, history, groupEditor, orderEditor } = setup([s('a', 0), s('b', 20), s('c', 40), s('d', 60)]);
        /** @type {Array<{ json: string, groups: Array<string> }>} 各操作の前の状態 */
        const states = [];
        const mark = () => states.push({ json: json(model), groups: model.getSelectedGroupIds() });

        // 1. a・bをまとめる
        model.setSelection(['a', 'b']);
        mark();
        assert.equal(groupEditor.groupSelection(), true);
        const inner = model.getSelectedGroupIds();
        assert.equal(inner.length, 1);

        // 2. 内側のフォルダとcをまとめて入れ子にする
        model.setSelection(['a', 'b', 'c'], { groupIds: inner });
        mark();
        assert.equal(groupEditor.groupSelection(), true);
        const outer = model.getSelectedGroupIds();
        assert.equal(outer.length, 1);
        assert.deepEqual(tree(model.getItems()), [[outer[0], [[inner[0], ['a', 'b']], 'c']], 'd']);

        // 3. 外側のフォルダの中でcを背面へ送る（フォルダの中の並びだけが変わる）
        model.setSelection(['c']);
        mark();
        assert.equal(orderEditor.apply(ShapeOrderOperation.SEND_TO_BACK), true);
        assert.deepEqual(tree(model.getItems()), [[outer[0], ['c', [inner[0], ['a', 'b']]]], 'd']);

        // 4. 外側のフォルダを解除する
        model.setSelection(['a', 'b', 'c'], { groupIds: [outer[0]] });
        mark();
        assert.equal(groupEditor.ungroupSelection(), true);
        assert.deepEqual(tree(model.getItems()), ['c', [inner[0], ['a', 'b']], 'd']);

        // 5. 内側のフォルダを選んで削除する
        model.setSelection(['a', 'b'], { groupIds: [inner[0]] });
        mark();
        assert.equal(groupEditor.removeSelection(), true);
        assert.deepEqual(tree(model.getItems()), ['c', 'd']);
        const afterAll = json(model);
        assert.deepEqual(shapeIdsOf(model.getItems()), ['c', 'd']);

        // 取り消しをすべて往復する
        for (let i = states.length - 1; i >= 0; i--) {
            assert.equal(history.undo(), true, `取り消し ${i + 1}`);
            assert.equal(json(model), states[i].json, `取り消し後のJSON ${i + 1}`);
            assert.equal(history.canUndo(), i > 0, `残りの記録 ${i + 1}`);
            assert.deepEqual(model.getSelectedGroupIds(), states[i].groups, `取り消し後のフォルダの選択 ${i + 1}`);
        }

        for (let i = 0; i < states.length; i++) {
            assert.equal(history.redo(), true, `やり直し ${i + 1}`);
            if (i + 1 < states.length) {
                assert.equal(json(model), states[i + 1].json, `やり直し後のJSON ${i + 1}`);
            }
        }
        assert.equal(json(model), afterAll);
        assert.equal(history.canRedo(), false);
        assertUniqueIds(model);
    });
});

describe('描き込む先', () => {
    it('フォルダを選ぶと、描き込む先はそのフォルダの中になる', () => {
        const { model } = setup([g('g1', [s('a', 0), s('b', 20)]), s('c', 40)]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });

        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: 'g1' });
    });

    it('空のフォルダだけを選ぶと、描き込む先はそのフォルダの中になる', () => {
        const { model, groupEditor } = setup([s('a', 0), s('b', 20)]);
        model.setSelection(['a']);
        assert.equal(model.getInsertTargetId(), 'a');

        assert.equal(groupEditor.addEmptyGroup({ selects: true }), true);

        assert.deepEqual(model.getSelectedIds(), []);
        assert.equal(model.getSelectedGroupIds().length, 1);
        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: model.getSelectedGroupIds()[0] });
    });

    it('描き込む先の図形のすぐ上に空のフォルダが入り、選択には触れない', () => {
        const { model, groupEditor } = setup([s('a', 0), s('b', 20), s('c', 40)]);
        model.setSelection(['b']);

        assert.equal(groupEditor.addEmptyGroup({ selects: false }), true);

        const items = model.getItems();
        assert.equal(items.length, 4);
        assert.equal(items[2].kind, 'group', 'bのすぐ上');
        assert.deepEqual(shapeIdsOf(items), ['a', 'b', 'c']);
        assert.deepEqual(model.getSelectedIds(), ['b']);
    });
});

describe('作業データの往復・インポート', () => {
    /**
     * 入れ子・名前・折りたたみのあるモデルを作る（g1「外側」の中に図形aと、折りたたんだg2「内側」。外にc）。
     * @returns {VectorModel} モデル
     */
    const makeModel = () => {
        const { model } = setup([
            g('g1', [s('a', 0, '甲線'), g('g2', [s('b', 20)], { name: '内側' })], { name: '外側' }),
            s('c', 40)
        ]);
        model.setGroupCollapsed('g2', true);
        return model;
    };

    it('serialize→deserialize→replaceAllShapesで、入れ子・名前・折りたたみが戻る', () => {
        const model = makeModel();
        const data = DocumentSerializer.serialize(model.getItems());
        const result = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(data)));
        assert.equal(result.ok, true);
        assert.equal(result.skipped.length, 0);
        const restored = new VectorModel();
        restored.replaceAllShapes(result.items);

        assert.deepEqual(tree(restored.getItems()), tree(model.getItems()));
        const outer = restored.getItems()[0];
        assert.equal(outer.name, '外側');
        assert.equal('collapsed' in outer, false, '開いたフォルダにcollapsedのキーは無い');
        assert.equal(outer.children[0].name, '甲線');
        assert.equal(outer.children[1].name, '内側');
        assert.equal(outer.children[1].collapsed, true);
        assert.equal(json(restored), json(model));
    });

    it('今までのJS（source入り）のsourceからも入れ子・名前・折りたたみが戻り、elementsにフォルダは出ない', () => {
        const model = makeModel();
        const sprite = { ...SpriteSerializer.serialize(model.getItems()), source: DocumentSerializer.serialize(model.getItems()) };

        assert.equal(sprite.elements.length, 3);
        const result = DocumentSerializer.deserialize(sprite.source);
        assert.equal(result.ok, true);
        assert.equal(JSON.stringify(DocumentSerializer.serialize(result.items)), json(model));
    });

    it('インポート（ShapeInserter）: 入れ子・名前・折りたたみを保って入り、取り消しで消える', () => {
        const source = makeModel();
        const data = DocumentSerializer.serialize(source.getItems());
        const { model: target, history, inserter } = setup([s('z', 100)]);
        const before = json(target);

        const result = inserter.insertDocument(data);

        assert.equal(result.ok, true);
        assert.equal(result.insertedIds.length, 3);
        const items = target.getItems();
        assert.equal(items.length, 3);
        const imported = items.find((item) => item.kind === 'group');
        assert.equal(imported.name, '外側');
        assert.equal(imported.children[0].name, '甲線');
        assert.equal(imported.children[1].name, '内側');
        assert.equal(imported.children[1].collapsed, true, 'インポートしたフォルダの折りたたみは保たれる');
        assertUniqueIds(target);
        assert.equal(history.undo(), true);
        assert.equal(json(target), before);
    });
});
