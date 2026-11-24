/**
 * 責務: ShapeOrderEditor（重なり順の変更・並び全体の指定の手順・履歴の単位・保存と書き出しへの追従）の振る舞いを検証する。
 * 偽の依存での呼び出し順の確認と、実物のVectorModel・SnapshotAdapter・HistoryManager・DocumentSerializer・SpriteSerializerとの組み合わせを扱う。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ShapeOrderOperation } from '../../js/edit/ShapeOrderRules.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';

const OPS = Object.values(ShapeOrderOperation);

/**
 * 偽のmodelと、呼び出しの記録つきの偽のeditRecorderを作る。
 * @param {Array<string>} ids 図形のid（描画順）
 * @param {Array<string>} selected 選択中のid
 * @param {boolean} [reorderResult=true] reorderShapesの戻り値
 * @returns {{ editor: ShapeOrderEditor, calls: Array<Array<*>> }} 手順と呼び出しの記録
 */
function setupFake(ids, selected, reorderResult = true) {
    const calls = [];
    const model = {
        getShapes: () => ids.map((id) => ({ id })),
        isSelected: (id) => selected.includes(id),
        reorderShapes: (orderedIds) => {
            calls.push(['reorderShapes', orderedIds]);
            return reorderResult;
        }
    };
    const editRecorder = {
        beginEdit: () => calls.push(['beginEdit']),
        commitEdit: () => calls.push(['commitEdit'])
    };
    return { editor: new ShapeOrderEditor({ model, editRecorder }), calls };
}

/**
 * idを直接代入した矩形を作る。
 * @param {string} id 代入するid
 * @returns {Rect} 矩形
 */
function makeRect(id) {
    const rect = new Rect(0, 0, 10, 10, '#112233', 2, null);
    rect.id = id;
    return rect;
}

/**
 * 実物のVectorModel・SnapshotAdapter・HistoryManager・ShapeOrderEditorを組み合わせる。
 * @param {Array<string>} ids 図形のid（描画順）
 * @param {Array<string>} selectedIds 選択するid
 * @param {boolean} [restoreSelection=true] undo/redo時に選択集合を復元するか
 * @returns {{ model: VectorModel, history: HistoryManager, editor: ShapeOrderEditor, historyNotifications: () => number }} 組み合わせた実物
 */
function setupReal(ids, selectedIds, restoreSelection = true) {
    const model = new VectorModel();
    model.replaceAllShapes(ids.map(makeRect));
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => restoreSelection });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    let notifications = 0;
    history.onChange(() => { notifications += 1; });
    const editor = new ShapeOrderEditor({ model, editRecorder: history });
    model.setSelection(selectedIds);
    return { model, history, editor, historyNotifications: () => notifications };
}

/**
 * モデルの図形のidを描画順で返す。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} idの配列
 */
function order(model) {
    return model.getShapes().map((s) => s.id);
}

test('偽の依存: 並びが変わる操作は beginEdit → reorderShapes(新しい並び) → commitEdit の順で、戻り値はreorderShapesの戻り値', () => {
    const { editor, calls } = setupFake(['A', 'B', 'C', 'D', 'E'], ['B', 'D']);
    assert.equal(editor.apply(ShapeOrderOperation.BRING_FORWARD), true);
    assert.deepEqual(calls, [['beginEdit'], ['reorderShapes', ['A', 'C', 'B', 'E', 'D']], ['commitEdit']]);
});

test('偽の依存: reorderShapesがfalseを返せばapplyもfalse（commitEditは呼ぶ）', () => {
    const { editor, calls } = setupFake(['A', 'B', 'C'], ['B'], false);
    assert.equal(editor.apply(ShapeOrderOperation.SEND_TO_BACK), false);
    assert.deepEqual(calls.map((c) => c[0]), ['beginEdit', 'reorderShapes', 'commitEdit']);
});

test('偽の依存: 4操作それぞれの引数が規則どおり', () => {
    const expected = {
        bringToFront: ['A', 'C', 'E', 'B', 'D'],
        bringForward: ['A', 'C', 'B', 'E', 'D'],
        sendBackward: ['B', 'A', 'D', 'C', 'E'],
        sendToBack: ['B', 'D', 'A', 'C', 'E']
    };
    for (const op of OPS) {
        const { editor, calls } = setupFake(['A', 'B', 'C', 'D', 'E'], ['B', 'D']);
        editor.apply(op);
        assert.deepEqual(calls[1], ['reorderShapes', expected[op]], op);
    }
});

test('偽の依存: 選択なし・すでに端・全選択・図形0個では何も呼ばずfalse', () => {
    const cases = [
        [['A', 'B', 'C'], [], OPS],
        [['A', 'B', 'C'], ['C'], [ShapeOrderOperation.BRING_TO_FRONT, ShapeOrderOperation.BRING_FORWARD]],
        [['A', 'B', 'C'], ['A'], [ShapeOrderOperation.SEND_TO_BACK, ShapeOrderOperation.SEND_BACKWARD]],
        [['A', 'B', 'C'], ['A', 'B', 'C'], OPS],
        [[], [], OPS]
    ];
    for (const [ids, selected, ops] of cases) {
        for (const op of ops) {
            const { editor, calls } = setupFake(ids, selected);
            assert.equal(editor.apply(op), false, `${ids}/${selected}/${op}`);
            assert.deepEqual(calls, []);
        }
    }
});

test('偽の依存: 未知の操作はErrorで、beginEditを呼ばない', () => {
    const { editor, calls } = setupFake(['A', 'B'], ['A']);
    assert.throws(() => editor.apply('unknown'), /未知の重なり順の操作/);
    assert.deepEqual(calls, []);
});

test('実物: 4操作それぞれで履歴が1件、undoで元の並び・redoで変えた並び', () => {
    const expected = {
        bringToFront: ['A', 'C', 'E', 'B', 'D'],
        bringForward: ['A', 'C', 'B', 'E', 'D'],
        sendBackward: ['B', 'A', 'D', 'C', 'E'],
        sendToBack: ['B', 'D', 'A', 'C', 'E']
    };
    for (const op of OPS) {
        const { model, history, editor } = setupReal(['A', 'B', 'C', 'D', 'E'], ['B', 'D']);
        assert.equal(history.canUndo(), false);
        assert.equal(editor.apply(op), true, op);
        assert.deepEqual(order(model), expected[op], op);
        assert.equal(history.canUndo(), true);
        history.undo();
        assert.deepEqual(order(model), ['A', 'B', 'C', 'D', 'E'], op);
        assert.equal(history.canUndo(), false, `${op}: undo1回で履歴が空`);
        history.redo();
        assert.deepEqual(order(model), expected[op], op);
    }
});

test('実物: 並べ替えの直後と、undo/redo後（復元ありのとき）も同じ図形が選ばれている', () => {
    const { model, history, editor } = setupReal(['A', 'B', 'C', 'D'], ['B', 'C']);
    editor.apply(ShapeOrderOperation.SEND_TO_BACK);
    assert.deepEqual([...model.getSelectedIds()].sort(), ['B', 'C']);
    history.undo();
    assert.deepEqual([...model.getSelectedIds()].sort(), ['B', 'C']);
    history.redo();
    assert.deepEqual([...model.getSelectedIds()].sort(), ['B', 'C']);
});

test('実物: 何もしない場合は並び・選択集合・履歴（canUndo・通知回数）が変わらない', () => {
    const cases = [
        [['A', 'B', 'C'], [], ShapeOrderOperation.BRING_TO_FRONT],
        [['A', 'B', 'C'], ['C'], ShapeOrderOperation.BRING_TO_FRONT],
        [['A', 'B', 'C'], ['C'], ShapeOrderOperation.BRING_FORWARD],
        [['A', 'B', 'C'], ['A'], ShapeOrderOperation.SEND_TO_BACK],
        [['A', 'B', 'C'], ['A'], ShapeOrderOperation.SEND_BACKWARD],
        [['A', 'B', 'C'], ['A', 'B', 'C'], ShapeOrderOperation.BRING_FORWARD]
    ];
    for (const [ids, selected, op] of cases) {
        const { model, history, editor, historyNotifications } = setupReal(ids, selected);
        let modelNotifications = 0;
        model.onChange(() => { modelNotifications += 1; });
        const selectedBefore = [...model.getSelectedIds()];
        assert.equal(editor.apply(op), false, `${selected}/${op}`);
        assert.deepEqual(order(model), ids);
        assert.deepEqual([...model.getSelectedIds()], selectedBefore);
        assert.equal(history.canUndo(), false);
        assert.equal(historyNotifications(), 0);
        assert.equal(modelNotifications, 0);
    }
});

test('実物: 並べ替えた後のモデルの並びが、保存（作業データ）と書き出し（スプライト）の並びに追従する', () => {
    const { model, editor } = setupReal(['A', 'B', 'C', 'D'], ['A']);
    editor.apply(ShapeOrderOperation.BRING_TO_FRONT);
    const expected = ['B', 'C', 'D', 'A'];
    assert.deepEqual(order(model), expected);

    const restored = DocumentSerializer.deserialize(DocumentSerializer.serialize(model.getShapes()));
    assert.equal(restored.ok, true);
    assert.deepEqual(restored.shapes.map((s) => s.id), expected);

    assert.deepEqual(SpriteSerializer.serialize(model.getShapes()).elements.map((e) => e.id), expected);
});

test('applyOrder 偽の依存: 違う並びは beginEdit → reorderShapes(その並び) → commitEdit の順で、戻り値はreorderShapesの戻り値', () => {
    const { editor, calls } = setupFake(['A', 'B', 'C'], []);
    assert.equal(editor.applyOrder(['C', 'A', 'B']), true);
    assert.deepEqual(calls, [['beginEdit'], ['reorderShapes', ['C', 'A', 'B']], ['commitEdit']]);

    const failing = setupFake(['A', 'B', 'C'], [], false);
    assert.equal(failing.editor.applyOrder(['B', 'A', 'C']), false);
    assert.deepEqual(failing.calls.map((c) => c[0]), ['beginEdit', 'reorderShapes', 'commitEdit']);
});

test('applyOrder 偽の依存: 今と同じ並び（図形0個を含む）では何も呼ばずfalse', () => {
    const same = setupFake(['A', 'B', 'C'], ['B']);
    assert.equal(same.editor.applyOrder(['A', 'B', 'C']), false);
    assert.deepEqual(same.calls, []);

    const empty = setupFake([], []);
    assert.equal(empty.editor.applyOrder([]), false);
    assert.deepEqual(empty.calls, []);
});

test('applyOrder 実物: 選択が空でも並びが変わり、履歴が1件・undoで戻りredoで再適用', () => {
    const { model, history, editor } = setupReal(['A', 'B', 'C', 'D'], []);
    assert.equal(editor.applyOrder(['D', 'B', 'A', 'C']), true);
    assert.deepEqual(order(model), ['D', 'B', 'A', 'C']);
    assert.equal(history.canUndo(), true);
    history.undo();
    assert.deepEqual(order(model), ['A', 'B', 'C', 'D']);
    assert.equal(history.canUndo(), false, 'undo1回で履歴が空');
    history.redo();
    assert.deepEqual(order(model), ['D', 'B', 'A', 'C']);
});

test('applyOrder 実物: 同じ並びでは並び・履歴・通知が変わらない', () => {
    const { model, history, editor, historyNotifications } = setupReal(['A', 'B', 'C'], ['B']);
    let modelNotifications = 0;
    model.onChange(() => { modelNotifications += 1; });
    assert.equal(editor.applyOrder(['A', 'B', 'C']), false);
    assert.deepEqual(order(model), ['A', 'B', 'C']);
    assert.equal(history.canUndo(), false);
    assert.equal(historyNotifications(), 0);
    assert.equal(modelNotifications, 0);
});

test('applyOrder 実物: 選択集合が残る（並べ替えの前後・undo/redo後）', () => {
    const { model, history, editor } = setupReal(['A', 'B', 'C', 'D'], ['B', 'C']);
    editor.applyOrder(['C', 'D', 'A', 'B']);
    assert.deepEqual([...model.getSelectedIds()].sort(), ['B', 'C']);
    history.undo();
    assert.deepEqual([...model.getSelectedIds()].sort(), ['B', 'C']);
    history.redo();
    assert.deepEqual([...model.getSelectedIds()].sort(), ['B', 'C']);
});

test('applyOrder 実物: フォルダの位置と入れ子が残り、名前は図形について動く', () => {
    const model = new VectorModel();
    const named = (id, name) => ({ kind: ITEM_KIND.SHAPE, shape: makeRect(id), name, visible: true, locked: false });
    model.replaceAllShapes([
        named('A', 'na'),
        { kind: ITEM_KIND.GROUP, id: 'G', name: 'g', visible: true, locked: false, children: [named('B', 'nb'), named('C', 'nc')] },
        named('D', 'nd')
    ]);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({ capture: () => adapter.capture(), restore: (s) => adapter.restore(s) });
    const editor = new ShapeOrderEditor({ model, editRecorder: history });

    assert.equal(editor.applyOrder(['D', 'C', 'B', 'A']), true);
    assert.deepEqual(order(model), ['D', 'C', 'B', 'A']);
    const items = model.getItems();
    assert.equal(items.length, 3);
    assert.deepEqual([items[0].shape.id, items[0].name], ['D', 'nd']);
    assert.equal(items[1].kind, ITEM_KIND.GROUP);
    assert.equal(items[1].id, 'G');
    assert.deepEqual(items[1].children.map((c) => [c.shape.id, c.name]), [['C', 'nc'], ['B', 'nb']]);
    assert.deepEqual([items[2].shape.id, items[2].name], ['A', 'na']);
});
