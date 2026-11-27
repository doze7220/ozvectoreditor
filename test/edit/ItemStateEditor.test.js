/**
 * 責務: ItemStateEditor（目・鍵・その行だけの表示）の呼び出し順を偽の依存で、結果・記録・取り消し/やり直し・記憶を実物（VectorModel・SnapshotAdapter・HistoryManager）で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ItemStateEditor } from '../../js/edit/ItemStateEditor.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
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
 * @param {Object} [states] `visible`・`locked`
 * @returns {Object} 図形のアイテム
 */
const s = (id, states = {}) => ({ kind: 'shape', shape: makeLine(id), ...states });

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [states] `visible`・`locked`
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, states = {}) => ({ kind: 'group', id, children, ...states });

/**
 * 全アイテムの自分の表示（`visible !== false`）をidごとに集める。
 * @param {Array<Object>} items アイテムの入れ子
 * @param {Object<string, boolean>} [out] 集める先
 * @returns {Object<string, boolean>} id → 表示
 */
function visibleMap(items, out = {}) {
    for (const item of items) {
        const id = item.kind === 'group' ? item.id : item.shape.id;
        out[id] = item.visible !== false;
        if (item.kind === 'group') {
            visibleMap(item.children, out);
        }
    }
    return out;
}

/**
 * 今の作業データをJSON文字列にする。
 * @param {VectorModel} model モデル
 * @returns {string} JSON文字列
 */
function snapshotJson(model) {
    return JSON.stringify(DocumentSerializer.serialize(model.getItems()));
}

/**
 * 実物の組み合わせを作る。
 * @param {Array<Object>} items 初期のアイテムの入れ子
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ItemStateEditor, adapter: SnapshotAdapter }} 実物
 */
function setupReal(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const editor = new ItemStateEditor({ model, editRecorder: history });
    return { model, history, editor, adapter };
}

/**
 * 履歴の段数を数える（全部取り消して数え、やり直して戻す）。
 * @param {HistoryManager} history 履歴
 * @returns {number} 取り消せる段数
 */
function countUndo(history) {
    let count = 0;
    while (history.undo()) {
        count += 1;
    }
    for (let i = 0; i < count; i += 1) {
        history.redo();
    }
    return count;
}

/**
 * 偽の依存で呼び出しの記録を取る。
 * @param {Array<Object>} items getItemsの戻り値
 * @param {boolean} [changed] setItemStatesの戻り値
 * @returns {{ editor: ItemStateEditor, calls: Array<*> }} 偽の依存で作ったエディタと呼び出しの記録
 */
function setupFake(items, changed = true) {
    const calls = [];
    const model = {
        getItems: () => items,
        setItemStates: (changes) => {
            calls.push(['setItemStates', changes]);
            return changed;
        }
    };
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: () => calls.push(['commitEdit'])
    };
    return { editor: new ItemStateEditor({ model, editRecorder }), calls };
}

describe('ItemStateEditor: 偽の依存での呼び出し順', () => {
    it('toggleVisible：beginEdit → setItemStates → commitEdit が1回ずつ（自分の値の反対）', () => {
        const { editor, calls } = setupFake([s('a'), s('b', { visible: false })]);
        assert.equal(editor.toggleVisible('a'), true);
        assert.deepEqual(calls, [['beginEdit'], ['setItemStates', [{ id: 'a', visible: false }]], ['commitEdit']]);
        calls.length = 0;
        assert.equal(editor.toggleVisible('b'), true);
        assert.deepEqual(calls[1], ['setItemStates', [{ id: 'b', visible: true }]]);
    });

    it('toggleLocked：beginEdit → setItemStates → commitEdit が1回ずつ', () => {
        const { editor, calls } = setupFake([s('a'), s('b', { locked: true })]);
        assert.equal(editor.toggleLocked('a'), true);
        assert.deepEqual(calls, [['beginEdit'], ['setItemStates', [{ id: 'a', locked: true }]], ['commitEdit']]);
        calls.length = 0;
        editor.toggleLocked('b');
        assert.deepEqual(calls[1], ['setItemStates', [{ id: 'b', locked: false }]]);
    });

    it('無いidは beginEdit も呼ばずに false', () => {
        const { editor, calls } = setupFake([s('a')]);
        assert.equal(editor.toggleVisible('zzz'), false);
        assert.equal(editor.toggleLocked('zzz'), false);
        assert.equal(editor.toggleSolo('zzz'), false);
        assert.deepEqual(calls, []);
    });

    it('toggleSolo：変更は今の値と違うものだけで、1件の呼び出し', () => {
        const { editor, calls } = setupFake([s('a'), s('b'), s('c', { visible: false })]);
        assert.equal(editor.toggleSolo('a'), true);
        assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'setItemStates', 'commitEdit']);
        assert.deepEqual(calls[1][1], [{ id: 'b', visible: false }]);
    });

    it('toggleSolo：変わるものが無い（行が1つだけ）とき記録先に触れず false', () => {
        const { editor, calls } = setupFake([s('a')]);
        assert.equal(editor.toggleSolo('a'), false);
        assert.deepEqual(calls, []);
    });

    it('setItemStates が false でも commitEdit まで呼び、その戻り値を返す', () => {
        const { editor, calls } = setupFake([s('a')], false);
        assert.equal(editor.toggleVisible('a'), false);
        assert.deepEqual(calls.map((call) => call[0]), ['beginEdit', 'setItemStates', 'commitEdit']);
    });
});

describe('ItemStateEditor: 実物での切り替え', () => {
    it('目の切り替えが1件の記録になり、取り消し/やり直しのJSONが一致する', () => {
        const { model, history, editor } = setupReal([s('a'), s('b')]);
        const before = snapshotJson(model);
        assert.equal(editor.toggleVisible('a'), true);
        const after = snapshotJson(model);
        assert.notEqual(after, before);
        assert.deepEqual(visibleMap(model.getItems()), { a: false, b: true });
        assert.equal(history.undo(), true);
        assert.equal(history.canUndo(), false);
        assert.equal(snapshotJson(model), before);
        assert.equal(history.redo(), true);
        assert.equal(snapshotJson(model), after);
    });

    it('鍵の切り替えが1件の記録になり、取り消し/やり直しで戻る', () => {
        const { model, history, editor } = setupReal([s('a'), g('f', [s('b')])]);
        const before = snapshotJson(model);
        assert.equal(editor.toggleLocked('f'), true);
        assert.equal(model.getItems()[1].locked, true);
        assert.deepEqual(model.getEditableShapes().map((shape) => shape.id), ['a']);
        assert.equal(history.undo(), true);
        assert.equal(history.canUndo(), false);
        assert.equal(snapshotJson(model), before);
        history.redo();
        assert.equal(model.getItems()[1].locked, true);
    });

    it('選択は切り替えても残り、取り消しでも保たれる', () => {
        const { model, history, editor } = setupReal([s('a'), s('b')]);
        model.setSelection(['a']);
        editor.toggleVisible('a');
        assert.deepEqual(model.getSelectedIds(), ['a']);
        history.undo();
        assert.deepEqual(model.getSelectedIds(), ['a']);
    });

    it('無いidは記録なし（段数が増えない）', () => {
        const { history, editor } = setupReal([s('a')]);
        assert.equal(editor.toggleVisible('zzz'), false);
        assert.equal(editor.toggleLocked('zzz'), false);
        assert.equal(history.canUndo(), false);
    });

    it('フォルダの切り替えで中の値は変わらない', () => {
        const { model, editor } = setupReal([g('f', [s('a', { visible: false, locked: true }), s('b')])]);
        editor.toggleVisible('f');
        editor.toggleLocked('f');
        const folder = model.getItems()[0];
        assert.equal(folder.visible, false);
        assert.equal(folder.locked, true);
        assert.equal(folder.children[0].visible, false);
        assert.equal(folder.children[0].locked, true);
        assert.equal(folder.children[1].visible !== false, true);
        assert.equal(folder.children[1].locked === true, false);
    });

    it('DocumentSerializer の往復で値が保たれる（版5）', () => {
        const { model, editor } = setupReal([s('a'), g('f', [s('b')])]);
        editor.toggleVisible('a');
        editor.toggleLocked('f');
        const values = DocumentSerializer.serialize(model.getItems());
        assert.equal(values.version, 5);
        const restored = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(values)));
        const items = restored.items ?? restored;
        assert.equal(items[0].visible, false);
        assert.equal(items[1].locked, true);
    });
});

describe('ItemStateEditor: その行だけの表示', () => {
    it('toggleSolo は1件で、もう一度でもとへ戻る', () => {
        const { model, history, editor } = setupReal([s('a'), s('b'), s('c')]);
        assert.equal(editor.toggleSolo('a'), true);
        assert.deepEqual(visibleMap(model.getItems()), { a: true, b: false, c: false });
        assert.equal(history.undo(), true);
        assert.equal(history.canUndo(), false);
        history.redo();
        assert.equal(editor.toggleSolo('a'), true);
        assert.deepEqual(visibleMap(model.getItems()), { a: true, b: true, c: true });
    });

    it('A→Bと移って取り消し、Aをもう一度ではじめの前へ戻る', () => {
        const { model, history, editor } = setupReal([s('a', { visible: false }), s('b'), s('c')]);
        editor.toggleSolo('a');
        editor.toggleSolo('b');
        assert.deepEqual(visibleMap(model.getItems()), { a: false, b: true, c: false });
        history.undo();
        assert.deepEqual(visibleMap(model.getItems()), { a: true, b: false, c: false });
        assert.equal(editor.toggleSolo('a'), true);
        assert.deepEqual(visibleMap(model.getItems()), { a: false, b: true, c: true });
    });

    it('forgetSolo の後は記憶が無く、もう一度で全部表示になる', () => {
        const { model, editor } = setupReal([s('a', { visible: false }), s('b'), s('c')]);
        editor.toggleSolo('b');
        assert.deepEqual(visibleMap(model.getItems()), { a: false, b: true, c: false });
        editor.forgetSolo();
        assert.equal(editor.toggleSolo('b'), true);
        assert.deepEqual(visibleMap(model.getItems()), { a: true, b: true, c: true });
    });

    it('覚えている表示はあるが戻すものが無いとき記録なし（段数・記憶が変わらない）', () => {
        const { model, history, editor } = setupReal([s('a'), s('b', { visible: false })]);
        editor.toggleSolo('b');
        editor.toggleSolo('a');
        assert.deepEqual(visibleMap(model.getItems()), { a: true, b: false });
        const before = snapshotJson(model);
        assert.equal(editor.toggleSolo('a'), false);
        assert.equal(snapshotJson(model), before);
        assert.equal(history.undo(), true);
        assert.equal(history.undo(), true);
        assert.equal(history.undo(), false);
    });

    it('変わるものが無いとき記録なし', () => {
        const { history, editor } = setupReal([s('a')]);
        assert.equal(editor.toggleSolo('a'), false);
        assert.equal(history.canUndo(), false);
    });

    it('記憶はスナップショットに入らない', () => {
        const { adapter, editor } = setupReal([s('a'), s('b')]);
        const before = JSON.stringify(adapter.capture());
        editor.toggleSolo('a');
        editor.toggleSolo('a');
        assert.equal(JSON.stringify(adapter.capture()), before);
        assert.equal(JSON.stringify(adapter.capture()).includes('memory'), false);
    });
});
