/**
 * 責務: CompoundPathEditor（複合パスの切り替え）の呼び出し順を偽の依存で、結果・履歴・取り消し/やり直しを実物（VectorModel・SnapshotAdapter・HistoryManager）で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompoundPathEditor } from '../../js/edit/CompoundPathEditor.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した直線を作る。
 * @param {string} id 代入するid
 * @param {string} [color] 線の色
 * @returns {Line} 直線
 */
function makeLine(id, color = '#000000') {
    const line = new Line(0, 0, 10, 0, color, 1);
    line.id = id;
    return line;
}

/**
 * 図形のアイテムを作る。
 * @param {string} id 図形のid
 * @param {string} [color] 線の色
 * @returns {Object} 図形のアイテム
 */
const s = (id, color) => ({ kind: 'shape', shape: makeLine(id, color) });

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] 追加の属性
 * @returns {Object} フォルダのアイテム
 */
const g = (id, children, extra = {}) => ({ kind: 'group', id, children, ...extra });

/**
 * 実物の組み合わせを作る。
 * @param {Array<Object>} items 初期のアイテムの入れ子
 * @returns {{ model: VectorModel, history: HistoryManager, editor: CompoundPathEditor }} 実物
 */
function setupReal(items) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    return { model, history, editor: new CompoundPathEditor({ model, editRecorder: history }) };
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
 * フォルダのアイテムを探す。
 * @param {VectorModel} model モデル
 * @param {string} id フォルダのid
 * @returns {Object|undefined} フォルダのアイテム
 */
function findGroup(model, id) {
    const walk = (items) => {
        for (const item of items) {
            if (item.kind === 'group') {
                if (item.id === id) {
                    return item;
                }
                const found = walk(item.children);
                if (found) {
                    return found;
                }
            }
        }
        return undefined;
    };
    return walk(model.getItems());
}

describe('CompoundPathEditor: 偽の依存での呼び出し順', () => {
    it('toggle：beginEdit → setGroupCompound → commitEdit が1回ずつ', () => {
        const calls = [];
        const model = {
            getItems: () => [g('g1', [s('a')])],
            setGroupCompound: (id, compound) => {
                calls.push(['setGroupCompound', id, compound]);
                return true;
            }
        };
        const editRecorder = { beginEdit: () => calls.push(['beginEdit']), commitEdit: () => calls.push(['commitEdit']) };
        const editor = new CompoundPathEditor({ model, editRecorder });
        assert.equal(editor.toggle('g1'), true);
        assert.deepEqual(calls, [['beginEdit'], ['setGroupCompound', 'g1', true], ['commitEdit']]);
    });

    it('無いid・図形のidは beginEdit を呼ばず false', () => {
        const calls = [];
        const model = { getItems: () => [g('g1', [s('a')])], setGroupCompound: () => calls.push('set') };
        const editRecorder = { beginEdit: () => calls.push('begin'), commitEdit: () => calls.push('commit') };
        const editor = new CompoundPathEditor({ model, editRecorder });
        assert.equal(editor.toggle('nothing'), false);
        assert.equal(editor.toggle('a'), false);
        assert.deepEqual(calls, []);
    });
});

describe('CompoundPathEditor: 実物での切り替え・履歴', () => {
    it('toggleで複合パスになり、もう一度で戻る。それぞれ履歴1件', () => {
        const { model, history, editor } = setupReal([g('g1', [s('a'), s('b')])]);
        assert.equal(editor.toggle('g1'), true);
        assert.equal(findGroup(model, 'g1').compound, true);
        assert.equal(model.getCompoundPaths().length, 1);
        assert.equal(countUndo(history), 1);
        assert.equal(editor.toggle('g1'), true);
        assert.equal('compound' in findGroup(model, 'g1'), false);
        assert.equal(model.getCompoundPaths().length, 0);
        assert.equal(countUndo(history), 2);
    });

    it('undoで戻りredoで戻る（compound・getCompoundPaths()がその時点のとおり）', () => {
        const { model, history, editor } = setupReal([g('g1', [s('a'), s('b')])]);
        editor.toggle('g1');
        assert.equal(history.undo(), true);
        assert.equal('compound' in findGroup(model, 'g1'), false);
        assert.equal(model.getCompoundPaths().length, 0);
        assert.equal(history.redo(), true);
        assert.equal(findGroup(model, 'g1').compound, true);
        assert.equal(model.getCompoundPaths().length, 1);
        editor.toggle('g1');
        assert.equal(history.undo(), true);
        assert.equal(findGroup(model, 'g1').compound, true);
        assert.equal(model.getCompoundPaths().length, 1);
        assert.equal(history.redo(), true);
        assert.equal('compound' in findGroup(model, 'g1'), false);
        assert.equal(model.getCompoundPaths().length, 0);
    });

    it('無いid・図形のidは false で履歴に積まない', () => {
        const { history, editor } = setupReal([g('g1', [s('a')])]);
        assert.equal(editor.toggle('nothing'), false);
        assert.equal(editor.toggle('a'), false);
        assert.equal(countUndo(history), 0);
    });

    it('中の図形のスタイル・選択・選んでいるフォルダが変わらない', () => {
        const { model, editor } = setupReal([g('g1', [s('a', '#111111'), s('b', '#222222')])]);
        model.setSelection(['a'], { groupIds: ['g1'] });
        const before = {
            colors: model.getShapes().map((shape) => [shape.id, shape.strokeColor, shape.strokeWidth, shape.fillColor]),
            selected: model.getSelectedIds(),
            groups: model.getSelectedGroupIds()
        };
        editor.toggle('g1');
        editor.toggle('g1');
        editor.toggle('g1');
        assert.deepEqual(
            model.getShapes().map((shape) => [shape.id, shape.strokeColor, shape.strokeWidth, shape.fillColor]),
            before.colors
        );
        assert.deepEqual(model.getSelectedIds(), before.selected);
        assert.deepEqual(model.getSelectedGroupIds(), before.groups);
    });

    it('閉じたフォルダの折りたたみが取り消し・やり直しで今の状態のまま', () => {
        const { model, history, editor } = setupReal([g('g1', [s('a'), s('b')], { collapsed: true })]);
        editor.toggle('g1');
        assert.equal(findGroup(model, 'g1').collapsed, true);
        model.setGroupCollapsed('g1', false);
        history.undo();
        assert.equal(findGroup(model, 'g1').collapsed === true, false);
        assert.equal('compound' in findGroup(model, 'g1'), false);
        model.setGroupCollapsed('g1', true);
        history.redo();
        assert.equal(findGroup(model, 'g1').collapsed, true);
        assert.equal(findGroup(model, 'g1').compound, true);
    });
});
