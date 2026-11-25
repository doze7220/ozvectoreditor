/**
 * 責務: GroupEditor（まとめる・解除・空のフォルダ・削除）の呼び出し順を偽の依存で、結果・選択・記録・取り消し/やり直しを実物（VectorModel・SnapshotAdapter・HistoryManager）で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { OperationMode } from '../../js/core/InputModes.js';
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
 * 入れ子を、種類とidだけの表現にする。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<*>} 図形はid、フォルダは[id, 中身]
 */
function tree(items) {
    return items.map((item) => (item.kind === 'group' ? [item.id, tree(item.children)] : item.shape.id));
}

/**
 * 実物の組み合わせを作る（先頭の要素が最背面）。
 * @param {Array<Object>} items 初期のアイテムの入れ子
 * @param {Object} [options] オプション
 * @param {string} [options.mode] 操作モード
 * @returns {{ model: VectorModel, history: HistoryManager, editor: GroupEditor, setMode: (mode: string) => void }} 実物
 */
function setupReal(items, { mode = OperationMode.SELECT } = {}) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    let currentMode = mode;
    const editor = new GroupEditor({ model, editRecorder: history, getMode: () => currentMode });
    return { model, history, editor, setMode: (next) => { currentMode = next; } };
}

/**
 * 今の作業データをJSON文字列にする（取り消し/やり直しの一致の比較用）。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function snapshotJson(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

/**
 * 偽の依存で呼び出しの記録を取る。
 * @param {Object} [options] オプション
 * @param {Array<Object>} [options.items] getItemsの戻り値
 * @param {string[]} [options.selectedIds] 選ばれている図形のid
 * @param {string[]} [options.selectedGroupIds] 選んでいるフォルダのid
 * @param {string|null} [options.insertTargetId] 描き込む先
 * @param {string} [options.mode] 操作モード
 * @returns {{ editor: GroupEditor, calls: Array<*> }} 偽の依存で作ったエディタと呼び出しの記録
 */
function setupFake({ items = [], selectedIds = [], selectedGroupIds = [], insertTargetId = null, mode = OperationMode.SELECT } = {}) {
    const calls = [];
    const model = {
        getItems: () => items,
        isSelected: (id) => selectedIds.includes(id),
        getSelectedGroupIds: () => selectedGroupIds,
        getInsertTargetId: () => insertTargetId,
        rearrangeItems: (nextItems, options) => {
            calls.push(['rearrangeItems', tree(nextItems), options]);
            return true;
        }
    };
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: () => calls.push(['commitEdit'])
    };
    return { editor: new GroupEditor({ model, editRecorder, getMode: () => mode }), calls };
}

describe('GroupEditor: 偽の依存での呼び出し順', () => {
    it('まとめる：beginEdit → rearrangeItems → commitEdit が1回ずつ', () => {
        const { editor, calls } = setupFake({ items: [s('a'), s('b'), s('c')], selectedIds: ['a', 'c'] });
        assert.equal(editor.groupSelection(), true);
        assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'rearrangeItems', 'commitEdit']);
        assert.deepEqual(calls[1][1], ['b', [undefined, ['a', 'c']]]);
        assert.deepEqual(calls[1][2], { selectedGroupIds: [], selectsNewGroups: true });
    });

    it('まとめる：まとまりが無い・頂点の選択モードでは beginEdit も呼ばない', () => {
        const none = setupFake({ items: [s('a')] });
        assert.equal(none.editor.groupSelection(), false);
        assert.deepEqual(none.calls, []);
        const vertex = setupFake({ items: [s('a')], selectedIds: ['a'], mode: OperationMode.VERTEX });
        assert.equal(vertex.editor.groupSelection(), false);
        assert.deepEqual(vertex.calls, []);
    });

    it('解除：beginEdit → rearrangeItems → commitEdit が1回ずつで、直下のフォルダを選ぶ', () => {
        const items = [g('g1', [s('a'), g('g2', [s('b')])]), s('c')];
        const { editor, calls } = setupFake({ items, selectedIds: ['a', 'b'], selectedGroupIds: ['g1'] });
        assert.equal(editor.ungroupSelection(), true);
        assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'rearrangeItems', 'commitEdit']);
        assert.deepEqual(calls[1][1], ['a', ['g2', ['b']], 'c']);
        assert.deepEqual(calls[1][2], { selectedGroupIds: ['g2'] });
    });

    it('解除：フォルダが無い・頂点の選択モードでは beginEdit も呼ばない', () => {
        const noGroup = setupFake({ items: [s('a')], selectedIds: ['a'] });
        assert.equal(noGroup.editor.ungroupSelection(), false);
        assert.deepEqual(noGroup.calls, []);
        const vertex = setupFake({ items: [g('g1', [s('a')])], selectedIds: ['a'], selectedGroupIds: ['g1'], mode: OperationMode.VERTEX });
        assert.equal(vertex.editor.ungroupSelection(), false);
        assert.deepEqual(vertex.calls, []);
    });

    it('空のフォルダ：描き込む先のすぐ上へ、beginEdit → rearrangeItems → commitEdit', () => {
        const { editor, calls } = setupFake({ items: [s('a'), s('b')], insertTargetId: 'a' });
        assert.equal(editor.addEmptyGroup({ selects: true }), true);
        assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'rearrangeItems', 'commitEdit']);
        assert.deepEqual(calls[1][1], ['a', [undefined, []], 'b']);
        assert.deepEqual(calls[1][2], { selectedIds: [], selectedGroupIds: [], selectsNewGroups: true });
    });

    it('空のフォルダ：selectsが偽なら選択に触れず、描き込む先が無ければ末尾', () => {
        const { editor, calls } = setupFake({ items: [s('a')] });
        editor.addEmptyGroup();
        assert.deepEqual(calls[1][1], ['a', [undefined, []]]);
        assert.deepEqual(calls[1][2], {});
    });

    it('空のフォルダ：操作モードを見ない', () => {
        const { editor, calls } = setupFake({ items: [s('a')], mode: OperationMode.CREATE });
        assert.equal(editor.addEmptyGroup(), true);
        assert.equal(calls.length, 3);
    });

    it('削除：beginEdit → rearrangeItems → commitEdit が1回ずつ', () => {
        const items = [g('g1', [s('a')]), s('b'), s('c')];
        const { editor, calls } = setupFake({ items, selectedIds: ['a', 'c'], selectedGroupIds: ['g1'] });
        assert.equal(editor.removeSelection(), true);
        assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'rearrangeItems', 'commitEdit']);
        assert.deepEqual(calls[1][1], ['b']);
        assert.deepEqual(calls[1][2], { selectedIds: [], selectedGroupIds: [] });
    });

    it('削除：まとまりが無ければ beginEdit も呼ばない。操作モードは見ない', () => {
        const none = setupFake({ items: [s('a')] });
        assert.equal(none.editor.removeSelection(), false);
        assert.deepEqual(none.calls, []);
        const create = setupFake({ items: [s('a')], selectedIds: ['a'], mode: OperationMode.CREATE });
        assert.equal(create.editor.removeSelection(), true);
        assert.equal(create.calls.length, 3);
    });

    it('hasSelectedUnits：図形かフォルダを選んでいれば真', () => {
        assert.equal(setupFake({ items: [s('a')] }).editor.hasSelectedUnits(), false);
        assert.equal(setupFake({ items: [s('a')], selectedIds: ['a'] }).editor.hasSelectedUnits(), true);
        assert.equal(setupFake({ items: [g('g1', [])], selectedGroupIds: ['g1'] }).editor.hasSelectedUnits(), true);
    });
});

describe('GroupEditor: 実物での結果', () => {
    it('まとめる：前順で最後のまとまりの位置に、名前つきのフォルダができて選ばれ、記録は1件。取り消し/やり直しでJSONが戻る', () => {
        const { model, history, editor } = setupReal([s('a'), s('b'), s('c'), s('d')]);
        model.setSelection(['a', 'c']);
        const before = snapshotJson(model);
        assert.equal(editor.groupSelection(), true);
        const items = model.getItems();
        assert.equal(items[1].kind, 'group');
        assert.deepEqual(tree(items), ['b', [items[1].id, ['a', 'c']], 'd']);
        assert.match(items[1].name, /^フォルダ/);
        assert.deepEqual(model.getSelectedGroupIds(), [items[1].id]);
        assert.deepEqual(model.getSelectedIds().sort(), ['a', 'c']);
        const after = snapshotJson(model);
        assert.notEqual(after, before);
        assert.equal(history.canUndo(), true);
        history.undo();
        assert.equal(snapshotJson(model), before);
        assert.equal(history.canUndo(), false);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        history.redo();
        assert.equal(snapshotJson(model), after);
        assert.deepEqual(model.getSelectedGroupIds(), [model.getItems()[1].id]);
    });

    it('まとめる：フォルダと図形をまとめると入れ子になる', () => {
        const { model, editor } = setupReal([g('g1', [s('a')]), s('b'), s('c')]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        assert.equal(editor.groupSelection(), true);
        const items = model.getItems();
        assert.deepEqual(tree(items), [[items[0].id, [['g1', ['a']], 'b']], 'c']);
        assert.deepEqual(model.getSelectedGroupIds(), [items[0].id]);
    });

    it('解除：中身が外へ出て、中身が選ばれたまま。記録は1件で取り消し/やり直しが戻る', () => {
        const { model, history, editor } = setupReal([g('g1', [s('a'), s('b')]), s('c')]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        const before = snapshotJson(model);
        assert.equal(editor.ungroupSelection(), true);
        assert.deepEqual(tree(model.getItems()), ['a', 'b', 'c']);
        assert.deepEqual(model.getSelectedIds().sort(), ['a', 'b']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        const after = snapshotJson(model);
        history.undo();
        assert.equal(snapshotJson(model), before);
        assert.deepEqual(model.getSelectedGroupIds(), ['g1']);
        assert.equal(history.canUndo(), false);
        history.redo();
        assert.equal(snapshotJson(model), after);
    });

    it('解除：中のフォルダはそのまま残り、選んでいるフォルダになる', () => {
        const { model, editor } = setupReal([g('g1', [g('g2', [s('a')]), s('b')])]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        assert.equal(editor.ungroupSelection(), true);
        assert.deepEqual(tree(model.getItems()), [['g2', ['a']], 'b']);
        assert.deepEqual(model.getSelectedGroupIds(), ['g2']);
    });

    it('解除：図形だけの選択では何もしない（記録も増えない）', () => {
        const { model, history, editor } = setupReal([g('g1', [s('a')]), s('b')]);
        model.setSelection(['a']);
        assert.equal(editor.ungroupSelection(), false);
        assert.deepEqual(tree(model.getItems()), [['g1', ['a']], 'b']);
        assert.equal(history.canUndo(), false);
    });

    it('頂点の選択モードではまとめる・解除を受け付けない', () => {
        const { model, history, editor, setMode } = setupReal([g('g1', [s('a')]), s('b')]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        setMode(OperationMode.VERTEX);
        assert.equal(editor.groupSelection(), false);
        assert.equal(editor.ungroupSelection(), false);
        assert.deepEqual(tree(model.getItems()), [['g1', ['a']], 'b']);
        assert.equal(history.canUndo(), false);
    });

    it('空のフォルダ：selectsが真なら選択を外して新しいフォルダだけが選ばれる。記録は1件', () => {
        const { model, history, editor } = setupReal([s('a'), s('b')]);
        model.setSelection(['a']);
        const before = snapshotJson(model);
        assert.equal(editor.addEmptyGroup({ selects: true }), true);
        const items = model.getItems();
        assert.deepEqual(tree(items), ['a', [items[1].id, []], 'b']);
        assert.match(items[1].name, /^フォルダ/);
        assert.deepEqual(model.getSelectedGroupIds(), [items[1].id]);
        assert.deepEqual(model.getSelectedIds(), []);
        history.undo();
        assert.equal(snapshotJson(model), before);
        assert.equal(history.canUndo(), false);
    });

    it('空のフォルダ：selectsが偽なら選択はそのまま', () => {
        const { model, editor } = setupReal([s('a'), s('b')]);
        model.setSelection(['b']);
        assert.equal(editor.addEmptyGroup(), true);
        assert.deepEqual(model.getSelectedIds(), ['b']);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        assert.equal(model.getItems().length, 3);
    });

    it('空のフォルダ：描き込む先が無ければいちばん外側の末尾へ入る', () => {
        const { model, editor } = setupReal([s('a')]);
        model.setSelection([]);
        assert.equal(editor.addEmptyGroup({ selects: true }), true);
        const items = model.getItems();
        assert.deepEqual(tree(items), ['a', [items[1].id, []]]);
    });

    it('削除：フォルダは中身ごと消え、図形だけの削除では空のフォルダが残る。記録は1件ずつで取り消し/やり直しが戻る', () => {
        const { model, history, editor } = setupReal([g('g1', [s('a'), s('b')]), g('g2', [s('c')]), s('d')]);
        model.setSelection(['a', 'b'], { groupIds: ['g1'] });
        const before = snapshotJson(model);
        assert.equal(editor.removeSelection(), true);
        assert.deepEqual(tree(model.getItems()), [['g2', ['c']], 'd']);
        assert.deepEqual(model.getSelectedIds(), []);
        assert.deepEqual(model.getSelectedGroupIds(), []);
        const after = snapshotJson(model);
        history.undo();
        assert.equal(snapshotJson(model), before);
        assert.equal(history.canUndo(), false);
        history.redo();
        assert.equal(snapshotJson(model), after);

        model.setSelection(['c']);
        assert.equal(editor.removeSelection(), true);
        assert.deepEqual(tree(model.getItems()), [['g2', []], 'd']);
    });

    it('削除：空のフォルダだけを選んでいても消せる。まとまりが無ければ何もしない', () => {
        const { model, history, editor } = setupReal([g('g1', []), s('a')]);
        model.setSelection([], { groupIds: ['g1'] });
        assert.equal(model.getSelectedGroupIds().length, 1);
        assert.equal(editor.removeSelection(), true);
        assert.deepEqual(tree(model.getItems()), ['a']);
        history.undo();
        assert.deepEqual(tree(model.getItems()), [['g1', []], 'a']);
        model.setSelection([]);
        const canUndoBefore = history.canUndo();
        assert.equal(editor.removeSelection(), false);
        assert.equal(history.canUndo(), canUndoBefore);
    });
});
