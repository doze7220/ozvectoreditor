/**
 * 責務: 表示・非表示とロックの流れ（隠す・ロック→選ぶ→混ざった操作→取り消し、フォルダの切り替え、許される操作、描き込む先が隠れたフォルダのとき、その行だけの表示、保存と復元、書き出し）を、実物を組み合わせて公開APIだけで通して検証する。
 * 実物はVectorModel・SnapshotAdapter・HistoryManager・ItemStateEditor・GroupEditor・NudgeEditor・ShapeStyleEditor・ShapeOrderEditor・ShapeInserter・ClipboardController・ItemRenameEditor・EndpointSnapper・DocumentSerializer・SpriteSerializer。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { classifyPointHit } from '../../js/core/PointHitRules.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { ItemStateEditor } from '../../js/edit/ItemStateEditor.js';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { NudgeEditor } from '../../js/edit/NudgeEditor.js';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ShapeOrderOperation } from '../../js/edit/ShapeOrderRules.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { ItemRenameEditor } from '../../js/edit/ItemRenameEditor.js';
import { EndpointSnapper } from '../../js/edit/EndpointSnapper.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Line } from '../../js/shapes/Line.js';

/**
 * idを直接代入した塗りつぶしの矩形を作る（幅20・高さ20）。
 * @param {string} id 代入するid
 * @param {number} x 左上のx
 * @returns {Rect} 矩形
 */
function box(id, x = 0) {
    const rect = new Rect(x, 0, x + 20, 20, '#112233', 2, '#ff0000');
    rect.id = id;
    return rect;
}

/**
 * 図形のアイテムを作る（名前はid）。
 * @param {string} id 図形のid
 * @param {Object} [state] 表示・ロック（省けば表示・ロックなし）
 * @param {number} [x] 左上のx
 * @returns {Object} アイテム
 */
function shape(id, { visible = true, locked = false } = {}, x = 0) {
    return { kind: 'shape', shape: box(id, x), name: id, visible, locked };
}

/**
 * フォルダのアイテムを作る（名前はid）。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身
 * @param {Object} [state] 表示・ロック（省けば表示・ロックなし）
 * @returns {Object} アイテム
 */
function folder(id, children, { visible = true, locked = false } = {}) {
    return { kind: 'group', id, name: id, visible, locked, children };
}

/**
 * 実物をすべて組み合わせる（取り消し/やり直しは選択を戻す。ShapeInserterはmain.jsと同じく描き込む先へ入れる）。
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
    const states = new ItemStateEditor({ model, editRecorder: history });
    const groups = new GroupEditor({ model, editRecorder: history, getMode: () => OperationMode.SELECT });
    const nudger = new NudgeEditor({ model, editRecorder: history, getMode: () => OperationMode.SELECT });
    const styler = new ShapeStyleEditor({ model, editRecorder: history });
    const orderer = new ShapeOrderEditor({ model, editRecorder: history });
    const inserter = new ShapeInserter({ model, editRecorder: history, insertsAtTarget: true });
    const deleteSelection = () => (model.hasRemovableSelection() ? groups.removeSelection() : false);
    const clipboard = new ClipboardController({ model, inserter, deleteSelection });
    const renamer = new ItemRenameEditor({ model, editRecorder: history });
    const snapper = new EndpointSnapper({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    return { model, history, states, groups, nudger, styler, orderer, clipboard, renamer, snapper };
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

/**
 * 入れ子を前順に歩き、図形・フォルダのidごとの{visible, locked}を求める。
 * @param {Array<Object>} items アイテムの入れ子
 * @returns {Object<string, {visible: boolean, locked: boolean}>} idごとの値
 */
function stateMap(items) {
    const result = {};
    const walk = (list) => list.forEach((item) => {
        const id = item.kind === 'group' ? item.id : item.shape.id;
        result[id] = { visible: item.visible, locked: item.locked };
        if (item.kind === 'group') walk(item.children);
    });
    walk(items);
    return result;
}

/**
 * 行ごとの表示（自分の値）だけを{id: 真偽}で返す。
 * @param {VectorModel} model モデル
 * @returns {Object<string, boolean>} idごとの表示
 */
function visibleMap(model) {
    return Object.fromEntries(Object.entries(stateMap(model.getItems())).map(([id, value]) => [id, value.visible]));
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
 * 点(x, y)で、変えられる図形に当たる最も手前の図形のid（クリックで選ばれる図形）を返す。
 * @param {VectorModel} model モデル
 * @param {number} x ワールドx
 * @param {number} y ワールドy
 * @returns {string|null} 図形のid。空白ならnull
 */
function clickAt(model, x, y) {
    return classifyPointHit(model.getEditableShapes(), (id) => model.isSelected(id), x, y, 4).bodyId;
}

describe('隠す', () => {
    it('隠した図形はクリックで選べず後ろが選べる。範囲の判定の素材（変えられる図形）にも出ない。戻すと元に戻り、取り消し1回で戻る', () => {
        const { model, history, states } = setup([shape('A', {}, 0), shape('B', {}, 10)]);
        assert.equal(clickAt(model, 15, 10), 'B');
        assert.equal(states.toggleVisible('B'), true);
        assert.equal(clickAt(model, 15, 10), 'A');
        assert.deepEqual(model.getVisibleShapes().map((s) => s.id), ['A']);
        assert.deepEqual(model.getEditableShapes().map((s) => s.id), ['A']);
        assert.deepEqual(model.getShapes().map((s) => s.id), ['A', 'B']);
        history.undo();
        assert.equal(clickAt(model, 15, 10), 'B');
        assert.equal(history.canUndo(), false);
        history.redo();
        assert.equal(model.getVisibleShapes().length, 1);
        assert.equal(states.toggleVisible('B'), true);
        assert.equal(model.getVisibleShapes().length, 2);
    });

    it('すべて隠れていれば何にも当たらず、後ろに何も無ければ空白になる', () => {
        const { model, states } = setup([shape('A')]);
        states.toggleVisible('A');
        assert.equal(clickAt(model, 10, 10), null);
    });
});

describe('ロック', () => {
    it('ロックした図形は素通りで後ろが選べる。一覧から選べるが、変えられる選択には入らず、動かさない・消さない・色を変えない', () => {
        const { model, history, states, nudger, groups, styler } = setup([shape('A', {}, 0), shape('B', {}, 10)]);
        assert.equal(states.toggleLocked('B'), true);
        assert.equal(clickAt(model, 15, 10), 'A');
        model.setSelection(['B']);
        assert.deepEqual(model.getSelectedIds(), ['B']);
        assert.deepEqual(model.getEditableSelectedIds(), []);
        const depth = history.canUndo();
        const before = json(model);
        assert.equal(nudger.nudge(5, 0), false);
        assert.equal(groups.removeSelection(), false);
        assert.equal(model.hasRemovableSelection(), false);
        assert.equal(styler.applyStyle({ strokeColor: '#00ff00' }), true);
        assert.equal(json(model), before);
        assert.equal(model.getNewShapeStyle().strokeColor, '#00ff00');
        assert.equal(history.canUndo(), depth);
    });

    it('ロックを外すと元どおり当たり・動かせる。取り消し1回でロックが戻る', () => {
        const { model, history, states, nudger } = setup([shape('A', {}, 0), shape('B', {}, 10)]);
        states.toggleLocked('B');
        states.toggleLocked('B');
        assert.equal(clickAt(model, 15, 10), 'B');
        model.setSelection(['B']);
        assert.equal(nudger.nudge(5, 0), true);
        history.undo();
        history.undo();
        assert.equal(stateMap(model.getItems()).B.locked, true);
    });
});

describe('フォルダの切り替え', () => {
    it('フォルダを隠すと中のすべてが隠れ、先に隠した1つは、フォルダを戻しても隠れたまま。取り消し1回ずつで戻る', () => {
        const { model, history, states } = setup([folder('G', [shape('A'), shape('B', {}, 30)])]);
        states.toggleVisible('A');
        states.toggleVisible('G');
        assert.deepEqual(model.getVisibleShapes(), []);
        assert.equal(clickAt(model, 40, 10), null);
        states.toggleVisible('G');
        assert.deepEqual(model.getVisibleShapes().map((s) => s.id), ['B']);
        history.undo();
        history.undo();
        assert.deepEqual(model.getVisibleShapes().map((s) => s.id), ['B']);
        assert.equal(stateMap(model.getItems()).A.visible, false);
    });

    it('フォルダをロックすると中のすべてが変えられなくなり、見た目（getVisibleShapes）は変わらない', () => {
        const { model, states } = setup([folder('G', [shape('A'), shape('B', {}, 30)]), shape('C', {}, 60)]);
        states.toggleLocked('G');
        assert.deepEqual(model.getEditableShapes().map((s) => s.id), ['C']);
        assert.deepEqual(model.getVisibleShapes().map((s) => s.id), ['A', 'B', 'C']);
        assert.equal(clickAt(model, 10, 10), null);
    });
});

describe('混ざった操作', () => {
    /**
     * フォルダG（変えられる図形Aとロックした図形L）と図形Cを作り、AとLを選ぶ。
     * @returns {Object} 実物の組
     */
    function mixed() {
        const context = setup([folder('G', [shape('A', {}, 0), shape('L', { locked: true }, 30)]), shape('C', {}, 60)]);
        context.model.setSelection(['A', 'L'], { groupIds: ['G'] });
        return context;
    }

    it('動かす・色を変える: ロックしていない図形だけが変わり、それぞれ取り消し1回で戻る', () => {
        const { model, history, nudger, styler } = mixed();
        const before = json(model);
        assert.equal(nudger.nudge(5, 0), true);
        const moved = model.getShapes().map((s) => s.points[0].x);
        assert.deepEqual(moved, [5, 30, 60]);
        history.undo();
        assert.equal(json(model), before);
        assert.equal(styler.applyStyle({ strokeColor: '#00ff00' }), true);
        const colors = model.getShapes().map((s) => s.strokeColor);
        assert.deepEqual(colors, ['#00ff00', '#112233', '#112233']);
        history.undo();
        assert.equal(json(model), before);
    });

    it('削除: ロックした図形とフォルダが残り、選択は空。取り消し1回で戻る', () => {
        const { model, history, groups } = mixed();
        const before = json(model);
        assert.equal(groups.removeSelection(), true);
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['L'] }, 'C']);
        assert.deepEqual(model.getSelectedIds(), []);
        history.undo();
        assert.equal(json(model), before);
        assert.equal(history.canUndo(), false);
    });

    it('切り取り→貼り付け: 消えた分だけがフォルダの形で貼り付く。取り消し1回ずつで戻る', () => {
        const { model, history, clipboard } = mixed();
        assert.equal(clipboard.cut(), true);
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['L'] }, 'C']);
        assert.equal(clipboard.pasteInPlace(), true);
        const pasted = model.getItems().filter((item) => item.kind === 'group' && item.id !== 'G');
        assert.equal(pasted.length, 1);
        assert.deepEqual(pasted[0].children.map((child) => child.name), ['A']);
        history.undo();
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['L'] }, 'C']);
        history.undo();
        assert.deepEqual(outline(model.getItems()), [{ id: 'G', children: ['A', 'L'] }, 'C']);
    });

    it('Alt+ドラッグの複製: ロックしていない図形だけが写る。取り消し1回で戻る', () => {
        const { model, history, clipboard } = mixed();
        history.beginEdit();
        assert.equal(clipboard.duplicateInPlaceWithinEdit(), true);
        history.commitEdit();
        assert.equal(model.getShapes().length, 4);
        assert.equal(model.getEditableSelectedIds().length, 1);
        history.undo();
        assert.equal(model.getShapes().length, 3);
    });
});

describe('許される操作', () => {
    it('ロック・非表示の図形も、重なり順・まとめる・名前の変更・コピー→貼り付けができ、写したものもロック・非表示のまま', () => {
        const { model, orderer, groups, renamer, clipboard } = setup([
            shape('L', { locked: true }, 0),
            shape('H', { visible: false }, 30),
            shape('C', {}, 60)
        ]);
        model.setSelection(['L']);
        assert.equal(orderer.apply(ShapeOrderOperation.BRING_TO_FRONT), true);
        assert.deepEqual(outline(model.getItems()), ['H', 'C', 'L']);
        assert.equal(renamer.rename('H', '新しい名前'), true);
        model.setSelection(['H', 'L']);
        assert.equal(groups.groupSelection(), true);
        assert.equal(model.getItems().some((item) => item.kind === 'group'), true);
        model.setSelection(['H', 'L']);
        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.pasteInPlace(), true);
        const states = Object.values(stateMap(model.getItems()));
        assert.equal(states.filter((value) => !value.visible).length >= 2, true);
        assert.equal(states.filter((value) => value.locked).length >= 2, true);
    });
});

describe('描き込む先が隠したフォルダの中のとき', () => {
    it('描いた図形はフォルダの中へ入り、入ったとたんに隠れる。描き込む先の印は残る。取り消し1回で消える', () => {
        const { model, history, states } = setup([folder('G', [shape('A')]), shape('C', {}, 60)]);
        model.setSelection([], { groupIds: ['G'] });
        model.setInsertTarget('G');
        states.toggleVisible('G');
        history.beginEdit();
        model.startDraft(100, 100);
        model.updateDraft(120, 120);
        model.commitDraft({ atInsertTarget: true });
        history.commitEdit();
        const group = model.getItems().find((item) => item.kind === 'group');
        assert.equal(group.children.length, 2);
        assert.equal(model.getVisibleShapes().length, 1);
        assert.equal(model.getShapes().length, 3);
        history.undo();
        assert.equal(model.getShapes().length, 2);
    });

    it('貼り付けも描き込む先のフォルダの中へ入り、隠れる。ロックしたフォルダなら変えられない', () => {
        const { model, clipboard, states } = setup([folder('G', [shape('A')], { locked: true }), shape('C', {}, 60)]);
        model.setSelection(['C']);
        assert.equal(clipboard.copy(), true);
        model.clearSelection();
        model.setInsertTarget('G');
        assert.equal(clipboard.paste(), true);
        const group = model.getItems().find((item) => item.kind === 'group');
        assert.equal(group.children.length, 2);
        assert.deepEqual(model.getEditableShapes().map((s) => s.id), ['C']);
        assert.equal(model.getVisibleShapes().length, 3);
        states.toggleVisible('G');
        assert.equal(model.getVisibleShapes().length, 1);
    });
});

describe('その行だけの表示', () => {
    it('Alt+クリックでその行だけが見え、もう一度で元に戻る。それぞれ取り消し1回で戻る', () => {
        const { model, history, states } = setup([shape('A'), folder('G', [shape('X'), shape('Y')]), shape('C')]);
        const first = visibleMap(model);
        assert.equal(states.toggleSolo('X'), true);
        assert.deepEqual(visibleMap(model), { A: false, G: true, X: true, Y: false, C: false });
        assert.equal(states.toggleSolo('X'), true);
        assert.deepEqual(visibleMap(model), first);
        history.undo();
        assert.deepEqual(visibleMap(model), { A: false, G: true, X: true, Y: false, C: false });
        history.undo();
        assert.deepEqual(visibleMap(model), first);
    });

    it('間にほかの行を押しても、そこでもう一度押せば、はじめの表示に戻る', () => {
        const { model, states } = setup([shape('A'), shape('B'), shape('C')]);
        const first = visibleMap(model);
        states.toggleSolo('A');
        states.toggleSolo('B');
        assert.deepEqual(visibleMap(model), { A: false, B: true, C: false });
        states.toggleSolo('B');
        assert.deepEqual(visibleMap(model), first);
    });

    it('1つめ→2つめと押してから取り消しで1つめだけに戻し、1つめをもう一度押しても、はじめの表示に戻る', () => {
        const { model, history, states } = setup([shape('A'), shape('B'), shape('C')]);
        const first = visibleMap(model);
        states.toggleSolo('A');
        states.toggleSolo('B');
        history.undo();
        assert.deepEqual(visibleMap(model), { A: true, B: false, C: false });
        states.toggleSolo('A');
        assert.deepEqual(visibleMap(model), first);
    });

    it('いちばん外側の1つだけが表示のとき、ほかの外側の行を押した後でその行を押し、もう一度押しても何も変わらず履歴にも入らない', () => {
        const { model, history, states } = setup([
            shape('A', { visible: true }),
            shape('B', { visible: false }),
            shape('C', { visible: false })
        ]);
        states.forgetSolo();
        states.toggleSolo('B');
        assert.deepEqual(visibleMap(model), { A: false, B: true, C: false });
        states.toggleSolo('A');
        assert.deepEqual(visibleMap(model), { A: true, B: false, C: false });
        const json1 = json(model);
        history.undo();
        history.redo();
        assert.equal(json(model), json1);
        let count = 0;
        while (history.canUndo()) {
            history.undo();
            count += 1;
        }
        assert.equal(count, 2);
        while (history.canRedo()) history.redo();
        assert.equal(states.toggleSolo('A'), false);
        assert.equal(json(model), json1);
        history.undo();
        assert.equal(visibleMap(model).B, true);
    });

    it('フォルダの中のほかの行を押した場合は、その兄弟のはじめの値も覚えているため、もう一度押すとその行が戻り、履歴に1件入る', () => {
        const { model, history, states } = setup([
            shape('A', { visible: true }),
            folder('G', [shape('X'), shape('Y')], { visible: false })
        ]);
        states.toggleSolo('X');
        assert.deepEqual(visibleMap(model), { A: false, G: true, X: true, Y: false });
        states.toggleSolo('A');
        assert.deepEqual(visibleMap(model), { A: true, G: false, X: true, Y: false });
        assert.equal(history.canUndo(), true);
        assert.equal(states.toggleSolo('A'), true);
        assert.deepEqual(visibleMap(model), { A: true, G: false, X: true, Y: true });
    });

    it('フォルダの行でも同じ。キャンバスの切り替えで覚えている表示を忘れると、その行だけの表示のまま押したときは全部が表示になる', () => {
        const { model, history, states } = setup([shape('A'), folder('G', [shape('X')]), shape('C')]);
        states.toggleSolo('G');
        assert.deepEqual(visibleMap(model), { A: false, G: true, X: true, C: false });
        states.forgetSolo();
        assert.equal(states.toggleSolo('G'), true);
        assert.deepEqual(visibleMap(model), { A: true, G: true, X: true, C: true });
        history.undo();
        assert.deepEqual(visibleMap(model), { A: false, G: true, X: true, C: false });
    });
});

describe('保存と復元・書き出し', () => {
    /**
     * 隠した図形・ロックした図形・隠したフォルダを含む作業データを作る。
     * @returns {Object} 実物の組
     */
    function stated() {
        return setup([
            shape('A', {}, 0),
            shape('H', { visible: false }, 30),
            shape('L', { locked: true }, 60),
            folder('G', [shape('I', {}, 90)], { visible: false, locked: true })
        ]);
    }

    it('作業データの往復で、表示・ロックの値がすべて戻る', () => {
        const { model } = stated();
        const result = DocumentSerializer.deserializeFromString(DocumentSerializer.serializeToString(model.getItems()));
        assert.equal(result.ok, true);
        const restored = new VectorModel();
        restored.replaceAllShapes(result.items);
        assert.deepEqual(stateMap(restored.getItems()), stateMap(model.getItems()));
        assert.equal(json(restored), json(model));
    });

    it('書き出しは隠した図形（隠れたフォルダの中を含む）を描画要素に出さず、ロックした図形は出す。sourceには全部が残り、開くと値が戻る', () => {
        const { model } = stated();
        const sprite = SpriteSerializer.serialize(model.getItems());
        assert.equal(sprite.elements.length, 2);
        assert.equal(sprite.source.shapes.length, 4);
        const result = DocumentSerializer.deserialize(JSON.parse(SpriteSerializer.stringify(sprite)).source);
        assert.equal(result.ok, true);
        assert.deepEqual(stateMap(result.items), stateMap(model.getItems()));
    });

    it('すべて隠すと、描画要素は空・外枠はnullになる', () => {
        const { model, states } = setup([shape('A'), shape('B', {}, 30)]);
        states.toggleVisible('A');
        states.toggleVisible('B');
        const sprite = SpriteSerializer.serialize(model.getItems());
        assert.deepEqual(sprite.elements, []);
        assert.equal(sprite.bounds, null);
    });

    it('外枠（⛶の元）は見えている図形（ロックしたものを含む）に合う', () => {
        const { model } = stated();
        const sprite = SpriteSerializer.serialize(model.getItems());
        const visibleOnly = SpriteSerializer.computeShapesBounds(model.getVisibleShapes());
        assert.deepEqual(sprite.bounds, visibleOnly);
        assert.equal(sprite.bounds.maxX >= 80, true);
    });
});

describe('端点の吸い付き', () => {
    it('ロックした線・隠した線の端点には吸い付かず、変えられる線には吸い付く', () => {
        const line = (id, y) => {
            const value = new Line(0, y, 100, y, '#112233', 2);
            value.id = id;
            return { kind: 'shape', shape: value, name: id, visible: true, locked: false };
        };
        const { snapper, states } = setup([line('P', 0), line('Q', 50), line('R', 100)]);
        states.toggleLocked('P');
        states.toggleVisible('Q');
        assert.equal(snapper.findDrawSnap('line', { x: 0, y: 0 }), null);
        assert.equal(snapper.findDrawSnap('line', { x: 0, y: 50 }), null);
        assert.equal(snapper.findDrawSnap('line', { x: 0, y: 100 }).shapeId, 'R');
    });
});

describe('表示・ロックなしの絵', () => {
    it('変えられる図形・見えている図形が全図形と同じで、削除・並べ替え・書き出しが今までどおり', () => {
        const { model, groups, orderer } = setup([shape('A'), folder('G', [shape('B', {}, 30)]), shape('C', {}, 60)]);
        assert.deepEqual(model.getEditableShapes().map((s) => s.id), ['A', 'B', 'C']);
        assert.deepEqual(model.getVisibleShapes().map((s) => s.id), ['A', 'B', 'C']);
        assert.equal(SpriteSerializer.serialize(model.getItems()).elements.length, 3);
        model.setSelection(['A']);
        assert.equal(orderer.apply(ShapeOrderOperation.BRING_TO_FRONT), true);
        model.setSelection(['A', 'B', 'C'], { groupIds: ['G'] });
        assert.equal(groups.removeSelection(), true);
        assert.deepEqual(model.getItems(), []);
    });
});
