/**
 * 責務: フォルダの行のドラッグ・描き込む先・フォルダごとの複製とコピーの通しの流れを、実物のVectorModel・SnapshotAdapter・HistoryManager・GroupEditor・ShapeOrderEditor・
 * ShapeInserter・ClipboardController・DocumentSerializerと、ListDragRules・ItemRowRulesを組み合わせ、公開APIだけで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { buildItemRows } from '../../js/core/ItemRowRules.js';
import { resolveDropPlace } from '../../js/core/ListDragRules.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Line } from '../../js/shapes/Line.js';

/** 一覧の1行の高さ（テスト用の寸法）。 */
const ROW_HEIGHT = 20;

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
 * @param {number} [x] 始点のx
 * @returns {Object} 図形のアイテム
 */
function s(id, x = 0) {
    return { kind: 'shape', shape: makeLine(id, x, x + 10) };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [extra] 追加の属性
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
 * 入れ子の中のフォルダと図形のidをすべて前順で返す。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Array<string>} id
 */
function allIds(items) {
    return items.flatMap((item) => (item.kind === 'group' ? [item.id, ...allIds(item.children)] : [item.shape.id]));
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
 * 今の入れ子の表現（id）を返す。
 * @param {VectorModel} model モデル
 * @returns {Array<*>} `tree`の結果
 */
function treeOf(model) {
    return tree(model.getItems());
}

/**
 * 実物を組み合わせる（描き込む先を使う`ShapeInserter`・本番と同じ切り取りの削除経路）。
 * @param {Array<Object>} items 初期のアイテムの入れ子
 * @returns {Object} 実物の組
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
    const inserter = new ShapeInserter({ model, editRecorder: history, insertsAtTarget: true });
    const clipboard = new ClipboardController({ model, inserter, deleteSelection: () => groupEditor.removeSelection() });
    return { model, adapter, history, groupEditor, orderEditor, inserter, clipboard };
}

/**
 * 矩形を1つ描いて確定する（InputTrackerの作成の確定と同じ`beginEdit` → `commitDraft({ atInsertTarget: true })` → `commitEdit`）。
 * @param {VectorModel} model モデル
 * @param {HistoryManager} history 履歴
 * @returns {string} 描いた図形のid
 */
function draw(model, history) {
    const before = new Set(model.getShapes().map((shape) => shape.id));
    model.startDraft(0, 0, 'rect');
    model.updateDraft(5, 5);
    history.beginEdit();
    model.commitDraft({ atInsertTarget: true });
    history.commitEdit();
    return model.getShapes().find((shape) => !before.has(shape.id)).id;
}

/**
 * 一覧の行の上の位置（行の番号と行の中の割合）から、ドロップ位置（場所）を求める。
 * @param {VectorModel} model モデル
 * @param {number} index 行の番号（先頭が前面）
 * @param {number} fraction 行の中の位置（0〜1）
 * @returns {?Object} 場所
 */
function placeAt(model, index, fraction) {
    const rows = buildItemRows(model.getItems());
    const area = { left: 0, right: 200, top: 0, height: rows.length * ROW_HEIGHT, scrollTop: 0, maxScrollTop: 0, rowHeight: ROW_HEIGHT };
    return resolveDropPlace({ pointerX: 100, pointerY: (index + fraction) * ROW_HEIGHT, area, rows });
}

/**
 * 一覧の一番下より下の空いている所のドロップ位置を求める。
 * @param {VectorModel} model モデル
 * @returns {?Object} 場所
 */
function placeBelowAll(model) {
    const rows = buildItemRows(model.getItems());
    const area = { left: 0, right: 200, top: 0, height: rows.length * ROW_HEIGHT + 40, scrollTop: 0, maxScrollTop: 0, rowHeight: ROW_HEIGHT };
    return resolveDropPlace({ pointerX: 100, pointerY: area.height - 5, area, rows });
}

/**
 * idの重複が無いことを確かめる。
 * @param {VectorModel} model モデル
 * @returns {void}
 */
function assertUniqueIds(model) {
    const ids = allIds(model.getItems());
    assert.equal(new Set(ids).size, ids.length, `idが重複している: ${ids.join(',')}`);
}

/**
 * 内側にフォルダと図形を持つ、通しのテスト用の絵（背面から a・g1[b,c]・d・g2[e]。一覧は前面から g2・e・d・g1・c・b・a）。
 * @returns {Array<Object>} アイテムの入れ子
 */
function sampleItems() {
    return [s('a', 0), g('g1', [s('b', 20), s('c', 40)]), s('d', 60), g('g2', [s('e', 80)])];
}

describe('座標 → 場所 → moveTo の通し', () => {
    it('図形の行をフォルダの真ん中へ: 中の一番上へ入る。取り消し1回で戻る', () => {
        const { model, history, orderEditor } = setup(sampleItems());
        const place = placeAt(model, 3, 0.5);
        assert.deepEqual(place, { kind: 'inside', id: 'g1' });
        assert.equal(orderEditor.moveTo(['d'], place), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c', 'd']], ['g2', ['e']]]);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c']], 'd', ['g2', ['e']]]);
        assert.equal(history.canUndo(), false);
    });

    it('中の行を外の行の下半分へ: その行のすぐ下へ出る', () => {
        const { model, orderEditor } = setup(sampleItems());
        const place = placeAt(model, 6, 0.75);
        assert.deepEqual(place, { kind: 'below', id: 'a' });
        assert.equal(orderEditor.moveTo(['c'], place), true);
        assert.deepEqual(treeOf(model), ['c', 'a', ['g1', ['b']], 'd', ['g2', ['e']]]);
    });

    it('フォルダごと: 別のフォルダの中へ入る。自分の中へは入れられない', () => {
        const { model, history, orderEditor } = setup(sampleItems());
        assert.equal(orderEditor.moveTo(['g1'], placeAt(model, 0, 0.5)), true);
        assert.deepEqual(treeOf(model), ['a', 'd', ['g2', ['e', ['g1', ['b', 'c']]]]]);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c']], 'd', ['g2', ['e']]]);

        const before = json(model);
        assert.equal(orderEditor.moveTo(['g1'], { kind: 'inside', id: 'g1' }), false);
        assert.equal(orderEditor.moveTo(['g2'], placeAt(model, 1, 0.5)), false, '空でないフォルダ自身の中の行へは入れられない');
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false);
    });

    it('一覧の下の空いている所: いちばん外側の一番下へ入る', () => {
        const { model, orderEditor } = setup(sampleItems());
        const place = placeBelowAll(model);
        assert.deepEqual(place, { kind: 'bottom', id: null });
        assert.equal(orderEditor.moveTo(['e'], place), true);
        assert.deepEqual(treeOf(model), ['e', 'a', ['g1', ['b', 'c']], 'd', ['g2', []]]);
    });

    it('まとめて動かす: 離れた図形とフォルダは順番を保つ', () => {
        const { model, orderEditor } = setup(sampleItems());
        assert.equal(orderEditor.moveTo(['a', 'g2'], placeAt(model, 3, 0.5)), true);
        assert.deepEqual(treeOf(model), [['g1', ['b', 'c', 'a', ['g2', ['e']]]], 'd']);
    });
});

describe('描く → 取り消す → 描き直す', () => {
    /**
     * 描いて取り消し、描き直して、同じ入れ子になること・やり直しで描き込む先が動かないことを確かめる。
     * @param {Object} env `setup`の結果
     * @returns {Array<*>} 描いた後の入れ子の表現
     */
    function drawUndoRedraw({ model, history }) {
        const first = draw(model, history);
        const afterDraw = treeOf(model);
        assert.equal(history.undo(), true);
        const targetAfterUndo = model.getInsertTarget();
        const second = draw(model, history);
        assert.notEqual(first, second);
        assert.deepEqual(treeOf(model).toString().replace(second, first), afterDraw.toString(), '同じ場所へ入る');
        assert.equal(history.undo(), true);
        assert.deepEqual(model.getInsertTarget(), targetAfterUndo);
        assert.equal(history.redo(), true);
        assert.deepEqual(model.getInsertTarget(), targetAfterUndo, 'やり直しでは描き込む先が動かない');
        assertUniqueIds(model);
        return treeOf(model);
    }

    it('フォルダの中の途中の行: そのすぐ上へ入る', () => {
        const env = setup(sampleItems());
        assert.equal(env.model.setInsertTarget('b'), true);
        const result = drawUndoRedraw(env);
        assert.equal(result[1][1].length, 3);
        assert.equal(result[1][1][0], 'b');
        assert.equal(result[1][1][2], 'c');
    });

    it('フォルダの中の一番下（切り取りの後）: 切り取って貼り付けると元の場所へ戻る', () => {
        const { model, history, clipboard } = setup(sampleItems());
        model.setSelection(['b']);
        assert.equal(clipboard.cut(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['c']], 'd', ['g2', ['e']]]);
        assert.deepEqual(model.getInsertTarget(), { kind: 'bottom', id: 'g1' });
        assert.equal(clipboard.paste(), true);
        const pasted = model.getShapes().find((shape) => !['a', 'c', 'd', 'e'].includes(shape.id)).id;
        assert.deepEqual(treeOf(model), ['a', ['g1', [pasted, 'c']], 'd', ['g2', ['e']]]);
        assert.equal(history.undo(), true);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c']], 'd', ['g2', ['e']]]);
        assert.deepEqual(model.getSelectedIds(), ['b']);
    });

    it('フォルダの中の一番下へ描く: 描き込む先が一番下のとき、そのフォルダの一番下へ入る', () => {
        const env = setup(sampleItems());
        env.model.setSelection(['b']);
        assert.equal(env.clipboard.cut(), true);
        env.model.clearSelection();
        const result = drawUndoRedraw(env);
        assert.equal(result[1][1].length, 2);
        assert.equal(result[1][1][1], 'c');
    });

    it('いちばん外側の一番下: 最背面へ入る', () => {
        const env = setup(sampleItems());
        env.model.setSelection(['a']);
        assert.equal(env.clipboard.cut(), true);
        assert.deepEqual(env.model.getInsertTarget(), { kind: 'bottom', id: null });
        env.model.clearSelection();
        const result = drawUndoRedraw(env);
        assert.equal(result.length, 4);
        assert.equal(Array.isArray(result[0]), false);
        assert.equal(result[1][0], 'g1');
    });

    it('空のフォルダ: その中へ入る', () => {
        const env = setup([s('a'), g('g0', [])]);
        assert.equal(env.model.setInsertTarget('g0'), true);
        assert.deepEqual(env.model.getInsertTarget(), { kind: 'inside', id: 'g0' });
        const result = drawUndoRedraw(env);
        assert.equal(result[1][0], 'g0');
        assert.equal(result[1][1].length, 1);
    });

    it('絵が空になった後: いちばん外側へ入り、取り消しで空へ戻る', () => {
        const { model, history, groupEditor } = setup([s('a')]);
        model.setSelection(['a']);
        assert.equal(groupEditor.removeSelection(), true);
        assert.deepEqual(model.getItems(), []);
        const first = draw(model, history);
        assert.deepEqual(treeOf(model), [first]);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), []);
        const second = draw(model, history);
        assert.deepEqual(treeOf(model), [second]);
    });
});

describe('描き込む先とほかの操作', () => {
    it('切り取り → 取り消し → 貼り付け: 取り消しで選択が戻り、貼り付けは選んでいる図形のすぐ上（同じフォルダの中）へ入る', () => {
        const { model, history, clipboard } = setup(sampleItems());
        model.setSelection(['c']);
        assert.equal(clipboard.cut(), true);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c']], 'd', ['g2', ['e']]]);
        assert.equal(clipboard.paste(), true);
        const result = treeOf(model);
        assert.equal(result[1][1].length, 3);
        assert.equal(result[1][1][1], 'c');
        assertUniqueIds(model);
    });

    it('ツールの切り替え（clearSelection）で inside が残り、描くと中の一番上へ入り続けて重なる', () => {
        const { model, history } = setup(sampleItems());
        model.setSelection(['b', 'c'], { groupIds: ['g1'] });
        model.clearSelection();
        assert.deepEqual(model.getInsertTarget(), { kind: 'inside', id: 'g1' });
        const first = draw(model, history);
        model.clearSelection();
        const second = draw(model, history);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c', first, second]], 'd', ['g2', ['e']]]);
    });

    it('作るボタン → 描く: 描き込む先に空のフォルダができ、続けて描くとその中へ入る', () => {
        const { model, history, groupEditor } = setup(sampleItems());
        assert.equal(model.setInsertTarget('b'), true);
        assert.equal(groupEditor.addEmptyGroup(), true);
        const target = model.getInsertTarget();
        assert.equal(target.kind, 'inside');
        const created = model.getItems()[1].children.find((item) => item.kind === 'group');
        assert.equal(created.id, target.id);
        const drawn = draw(model, history);
        const group = model.getItems()[1].children.find((item) => item.kind === 'group');
        assert.deepEqual(tree(group.children), [drawn]);
        assert.equal(history.undo(), true);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c']], 'd', ['g2', ['e']]]);
    });

    it('インポート（引数なしのinsertDocument）: フォルダの中・一番下へ入る', () => {
        const { model, inserter } = setup(sampleItems());
        const doc = DocumentSerializer.serialize([s('x', 100)]);
        assert.equal(model.setInsertTarget('g1'), true);
        assert.equal(inserter.insertDocument(doc).inserted, true);
        const inGroup = model.getItems()[1];
        assert.equal(inGroup.children.length, 3);
        assert.equal(inGroup.children[2].kind, 'shape');
        assert.deepEqual(model.getSelectedIds().length, 1);

        const rest = setup(sampleItems());
        rest.model.setSelection(['a']);
        assert.equal(rest.clipboard.cut(), true);
        rest.model.clearSelection();
        assert.deepEqual(rest.model.getInsertTarget(), { kind: 'bottom', id: null });
        assert.equal(rest.inserter.insertDocument(doc).inserted, true);
        assert.equal(rest.model.getItems()[0].kind, 'shape');
        assert.equal(rest.model.getItems().length, 4);
    });

    it('キャンバスの入れ替え（replaceAllShapes）で描き込む先は無しに戻る', () => {
        const { model } = setup(sampleItems());
        assert.equal(model.setInsertTarget('g1'), true);
        model.replaceAllShapes(sampleItems());
        assert.equal(model.getInsertTarget(), null);
    });

    it('描き込む先を変えても、capture()・作業データ・スプライトのテキスト・履歴は変わらない', () => {
        const { model, adapter, history } = setup(sampleItems());
        let notifications = 0;
        history.onChange(() => { notifications += 1; });
        const captureBefore = JSON.stringify(adapter.capture());
        const documentBefore = json(model);
        const spriteBefore = SpriteSerializer.stringify(SpriteSerializer.serialize(model.getItems()));

        assert.equal(model.setInsertTarget('g1'), true);
        assert.equal(model.setInsertTarget('d'), true);
        assert.equal(model.setInsertTarget('g2'), true);

        assert.equal(JSON.stringify(adapter.capture()), captureBefore);
        assert.equal(json(model), documentBefore);
        assert.equal(SpriteSerializer.stringify(SpriteSerializer.serialize(model.getItems())), spriteBefore);
        assert.equal(notifications, 0);
        assert.equal(history.canUndo(), false);
    });
});

describe('フォルダのコピー', () => {
    it('フォルダの複製: 形のまま元のすぐ上へ入り、複製が選ばれる。取り消し1回で戻る', () => {
        const { model, history, clipboard } = setup(sampleItems());
        model.setSelection(['b', 'c'], { groupIds: ['g1'] });
        assert.equal(clipboard.duplicate(), true);
        const result = treeOf(model);
        assert.equal(result.length, 5);
        assert.equal(result[1][0], 'g1');
        assert.notEqual(result[2][0], 'g1');
        assert.equal(result[2][1].length, 2);
        assert.deepEqual(model.getSelectedGroupIds(), [result[2][0]]);
        assertUniqueIds(model);
        assert.equal(history.undo(), true);
        assert.deepEqual(treeOf(model), ['a', ['g1', ['b', 'c']], 'd', ['g2', ['e']]]);
    });

    it('フォルダのコピー → 貼り付けを続ける: コピーの中へ入らず上へ重なる', () => {
        const { model, clipboard } = setup(sampleItems());
        model.setSelection(['b', 'c'], { groupIds: ['g1'] });
        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);
        const first = model.getSelectedGroupIds()[0];
        assert.equal(clipboard.paste(), true);
        const second = model.getSelectedGroupIds()[0];
        const result = treeOf(model);
        assert.equal(result.length, 6);
        assert.deepEqual(result.slice(1, 4).map((entry) => entry[0]), ['g1', first, second]);
        assertUniqueIds(model);
    });

    it('空のフォルダも、複製・コピー・切り取り・貼り付けができる', () => {
        const { model, clipboard } = setup([s('a'), g('g0', [])]);
        model.setSelection([], { groupIds: ['g0'] });
        assert.equal(clipboard.duplicate(), true);
        assert.equal(model.getItems().length, 3);
        assert.equal(clipboard.cut(), true);
        assert.equal(model.getItems().length, 2);
        assert.equal(clipboard.paste(), true);
        assert.equal(model.getItems().length, 3);
        assertUniqueIds(model);
    });
});

describe('操作の往復', () => {
    it('フォルダの操作・ドラッグ・コピーを続けた後の取り消し/やり直しで、JSONと選んでいるフォルダが各段階で一致し、idの重複が無い', () => {
        const { model, history, groupEditor, orderEditor, clipboard } = setup(sampleItems());
        /** @type {Array<{json: string, groups: string[]}>} */
        const states = [];
        const record = () => {
            states.push({ json: json(model), groups: [...model.getSelectedGroupIds()].sort() });
            assertUniqueIds(model);
        };
        record();

        model.setSelection(['a', 'd']);
        assert.equal(groupEditor.groupSelection(), true);
        record();
        assert.equal(orderEditor.moveTo(['g2'], placeAt(model, 0, 0.1)), false, '同じ並びは記録しない');
        const newGroup = model.getSelectedGroupIds()[0];
        assert.equal(orderEditor.moveTo([newGroup], { kind: 'inside', id: 'g1' }), true);
        record();
        assert.equal(clipboard.duplicate(), true);
        record();
        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);
        record();
        assert.equal(clipboard.paste(), true);
        record();
        assert.equal(clipboard.cut(), true);
        record();
        assert.equal(clipboard.paste(), true);
        record();

        for (let i = states.length - 2; i >= 0; i--) {
            assert.equal(history.undo(), true);
            assert.equal(json(model), states[i].json, `取り消し ${i}`);
            assert.deepEqual([...model.getSelectedGroupIds()].sort(), states[i].groups);
            assertUniqueIds(model);
        }
        assert.equal(history.canUndo(), false);
        for (let i = 1; i < states.length; i++) {
            assert.equal(history.redo(), true);
            assert.equal(json(model), states[i].json, `やり直し ${i}`);
            assert.deepEqual([...model.getSelectedGroupIds()].sort(), states[i].groups);
            assertUniqueIds(model);
        }
    });
});

describe('フォルダの無い絵', () => {
    /**
     * 図形だけの絵（背面から a・b・c・d）。
     * @returns {Array<Object>} アイテム
     */
    function flatItems() {
        return [s('a', 0), s('b', 20), s('c', 40), s('d', 60)];
    }

    it('ドラッグ: 行のすぐ上・すぐ下・一番下への動きが今までと同じ', () => {
        const { model, orderEditor } = setup(flatItems());
        assert.equal(orderEditor.moveTo(['a'], placeAt(model, 0, 0.25)), true);
        assert.deepEqual(treeOf(model), ['b', 'c', 'd', 'a']);
        assert.equal(orderEditor.moveTo(['a'], placeBelowAll(model)), true);
        assert.deepEqual(treeOf(model), ['a', 'b', 'c', 'd']);
        assert.equal(orderEditor.moveTo(['d'], placeAt(model, 3, 0.75)), true);
        assert.deepEqual(treeOf(model), ['d', 'a', 'b', 'c']);
    });

    it('複製・コピー・貼り付け: 元のすぐ上へ入る', () => {
        const { model, clipboard } = setup(flatItems());
        model.setSelection(['b']);
        assert.equal(clipboard.duplicate(), true);
        const dup = model.getSelectedIds()[0];
        assert.deepEqual(treeOf(model), ['a', 'b', dup, 'c', 'd']);
        model.setSelection(['c']);
        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);
        const pasted = model.getSelectedIds()[0];
        assert.deepEqual(treeOf(model), ['a', 'b', dup, 'c', pasted, 'd']);
    });

    it('切り取り → 貼り付け: 一番下の行だけ元の場所へ戻り、ほかも今までと同じ', () => {
        const { model, clipboard } = setup(flatItems());
        model.setSelection(['a']);
        assert.equal(clipboard.cut(), true);
        assert.equal(clipboard.paste(), true);
        assert.deepEqual(treeOf(model).slice(1), ['b', 'c', 'd']);
        assert.equal(model.getShapes()[0].id, model.getSelectedIds()[0]);

        model.setSelection(['c']);
        assert.equal(clipboard.cut(), true);
        assert.equal(clipboard.paste(), true);
        assert.equal(model.getShapes().length, 4);
        assert.equal(model.getShapes()[2].id, model.getSelectedIds()[0]);
    });
});
