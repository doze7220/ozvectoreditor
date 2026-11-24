/**
 * 責務: VectorModelの描き込む先（getInsertTargetId・setInsertTarget・setSelectionByUser・各経路での付け替え・入る位置の指定）の振る舞いを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';

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
 * 直線の図形のアイテム（名前付き）を作る。
 * @param {string} id 図形のid
 * @returns {Object} 図形のアイテム
 */
function shapeItem(id) {
    return { kind: ITEM_KIND.SHAPE, name: id, visible: true, locked: false, shape: makeLine(id) };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id フォルダのid
 * @param {Array<Object>} children 中身のアイテム
 * @returns {Object} フォルダのアイテム
 */
function groupItem(id, children) {
    return { kind: ITEM_KIND.GROUP, id, name: id, visible: true, locked: false, children };
}

/**
 * 直線a・b・c・d（この順）を入れたモデルと通知回数の取得関数を作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes(['a', 'b', 'c', 'd'].map(makeLine));
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

/**
 * モデルの図形のid配列（描画順）を返す。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} id配列
 */
function ids(model) {
    return model.getShapes().map((s) => s.id);
}

/**
 * 作成中の図形を作ってコミットし、確定した図形のidを返す。
 * @param {VectorModel} model モデル
 * @param {Object} [options] commitDraftへ渡すオプション
 * @returns {string} 確定した図形のid
 */
function draw(model, options) {
    model.startDraft(0, 0, 'line');
    const draft = model.getDraftShape();
    model.commitDraft(options);
    return draft.id;
}

describe('初期状態・setInsertTarget', () => {
    it('初期は無し', () => {
        assert.equal(new VectorModel().getInsertTargetId(), null);
    });

    it('今ある図形のidへ変える: trueと通知1回、図形・選択は変わらない', () => {
        const { model, notifyCount } = setup();
        assert.equal(model.setInsertTarget('b'), true);
        assert.equal(model.getInsertTargetId(), 'b');
        assert.equal(notifyCount(), 1);
        assert.deepEqual(ids(model), ['a', 'b', 'c', 'd']);
        assert.deepEqual(model.getSelectedIds(), []);
    });

    it('同じ値・存在しないidでは何もせず通知もしない', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('b');
        assert.equal(model.setInsertTarget('b'), false);
        assert.equal(model.setInsertTarget('zzz'), false);
        assert.equal(model.getInsertTargetId(), 'b');
        assert.equal(notifyCount(), 1);
    });

    it('選択集合があれば規則により変わらず、通知もしない', () => {
        const { model, notifyCount } = setup();
        model.setSelection(['c']);
        const before = notifyCount();
        assert.equal(model.getInsertTargetId(), 'c');
        assert.equal(model.setInsertTarget('a'), false);
        assert.equal(model.getInsertTargetId(), 'c');
        assert.equal(notifyCount(), before);
    });
});

describe('選択の経路', () => {
    it('setSelection: 選ばれている一番上の図形になる', () => {
        const { model } = setup();
        model.setSelection(['b', 'a']);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('clearSelection・setSelection([])で空になっても描き込む先は残る', () => {
        const { model } = setup();
        model.setSelection(['c']);
        model.clearSelection();
        assert.equal(model.getInsertTargetId(), 'c');
        model.setSelection(['b']);
        model.setSelection([]);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('setSelectionByUser: 選ぶと一番上、空にすると無し。戻り値はtrueで通知1回', () => {
        const { model, notifyCount } = setup();
        assert.equal(model.setSelectionByUser(['a', 'c']), true);
        assert.equal(model.getInsertTargetId(), 'c');
        assert.equal(notifyCount(), 1);
        assert.equal(model.setSelectionByUser([]), true);
        assert.equal(model.getInsertTargetId(), null);
        assert.deepEqual(model.getSelectedIds(), []);
        assert.equal(notifyCount(), 2);
    });

    it('setSelectionByUser: 現存しないidは除く', () => {
        const { model } = setup();
        model.setSelectionByUser(['zzz', 'b']);
        assert.deepEqual(model.getSelectedIds(), ['b']);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('setSelectionByUser: 描き込む先だけがあるときの空の選択で無しになる（trueと通知）', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('b');
        assert.equal(model.setSelectionByUser([]), true);
        assert.equal(model.getInsertTargetId(), null);
        assert.equal(notifyCount(), 2);
    });

    it('setSelectionByUser: 何も選んでおらず描き込む先も無く結果も空ならfalseで通知しない', () => {
        const { model, notifyCount } = setup();
        assert.equal(model.setSelectionByUser([]), false);
        assert.equal(notifyCount(), 0);
        assert.equal(model.setSelectionByUser(['zzz']), false);
        assert.equal(notifyCount(), 0);
    });

    it('setSelectionByUser: 頂点の選択から外れた図形の組を落とす', () => {
        const { model } = setup();
        model.setSelection(['a']);
        model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }]);
        model.setSelectionByUser([]);
        assert.deepEqual(model.getSelectedVertices(), []);
    });
});

describe('図形の追加・削除', () => {
    it('commitDraft: 確定した図形が描き込む先になる（省いたときの並びは末尾）', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('b');
        const id = draw(model);
        assert.deepEqual(ids(model), ['a', 'b', 'c', 'd', id]);
        assert.equal(model.getInsertTargetId(), id);
        assert.equal(notifyCount(), 3);
    });

    it('commitDraft({ atInsertTarget: true }): 描き込む先のすぐ上へ入る', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        const id = draw(model, { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', 'b', id, 'c', 'd']);
        assert.equal(model.getInsertTargetId(), id);
    });

    it('commitDraft({ atInsertTarget: true }): 描き込む先なしなら末尾', () => {
        const { model } = setup();
        const id = draw(model, { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', 'b', 'c', 'd', id]);
    });

    it('commitDraft({ atInsertTarget: true }): 続けて描くと、前の図形のすぐ上へ重ねて入る', () => {
        const { model } = setup();
        model.setInsertTarget('a');
        const first = draw(model, { atInsertTarget: true });
        const second = draw(model, { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', first, second, 'b', 'c', 'd']);
    });

    it('commitDraft({ atInsertTarget: true }): フォルダの中の図形が描き込む先なら、そのフォルダの中へ入る', () => {
        const model = new VectorModel();
        model.replaceAllShapes([shapeItem('a'), groupItem('g1', [shapeItem('b'), shapeItem('c')]), shapeItem('d')]);
        model.setInsertTarget('b');
        const id = draw(model, { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', 'b', id, 'c', 'd']);
        const items = model.getItems();
        assert.equal(items[1].kind, ITEM_KIND.GROUP);
        assert.deepEqual(items[1].children.map((i) => i.shape.id), ['b', id, 'c']);
    });

    it('addShapesWithNewIds: 省いたときは末尾。足した図形が選ばれ、描き込む先は足した一番上', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        const added = model.addShapesWithNewIds([makeLine('x'), makeLine('y')]);
        assert.deepEqual(ids(model), ['a', 'b', 'c', 'd', ...added]);
        assert.deepEqual(model.getSelectedIds(), added);
        assert.equal(model.getInsertTargetId(), added[1]);
    });

    it('addShapesWithNewIds({ atInsertTarget: true }): 描き込む先のすぐ上へ順のまま入る', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        const added = model.addShapesWithNewIds([makeLine('x'), makeLine('y')], { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', 'b', added[0], added[1], 'c', 'd']);
        assert.deepEqual(model.getSelectedIds(), added);
        assert.equal(model.getInsertTargetId(), added[1]);
    });

    it('addShapesWithNewIds({ atInsertTarget: true }): 描き込む先なしなら末尾、入れ子のアイテムはフォルダごと入る', () => {
        const model = new VectorModel();
        model.replaceAllShapes([shapeItem('a'), shapeItem('b')]);
        const none = model.addShapesWithNewIds([makeLine('x')], { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', 'b', none[0]]);

        model.setSelectionByUser([]);
        model.setInsertTarget('a');
        const nested = model.addShapesWithNewIds([groupItem('g', [shapeItem('p'), shapeItem('q')])], { atInsertTarget: true });
        assert.deepEqual(ids(model), ['a', nested[0], nested[1], 'b', none[0]]);
        const items = model.getItems();
        assert.equal(items[1].kind, ITEM_KIND.GROUP);
        assert.equal(items[1].children.length, 2);
    });

    it('addShapesWithNewIds: 追加0件なら描き込む先を変えない', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('b');
        const before = notifyCount();
        assert.deepEqual(model.addShapesWithNewIds([]), []);
        assert.equal(model.getInsertTargetId(), 'b');
        assert.equal(notifyCount(), before);
    });

    it('deleteShapes: 描き込む先を消すと下の行（前の並びで近い図形）へ、下に無ければ無し', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('c');
        const before = notifyCount();
        model.deleteShapes(['c']);
        assert.equal(model.getInsertTargetId(), 'b');
        assert.equal(notifyCount(), before + 1);
        model.deleteShapes(['b']);
        assert.equal(model.getInsertTargetId(), 'a');
        model.deleteShapes(['a']);
        assert.equal(model.getInsertTargetId(), null);
    });

    it('deleteShapes: 下の行も一緒に消えると、さらに下の残っている行へ', () => {
        const { model } = setup();
        model.setInsertTarget('c');
        model.deleteShapes(['c', 'b']);
        assert.equal(model.getInsertTargetId(), 'a');
    });

    it('deleteShapes: 描き込む先でない図形を消しても変わらない', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        model.deleteShapes(['d']);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('deleteShapes: 選択している図形を消すと、残った選択の一番上になる', () => {
        const { model } = setup();
        model.setSelection(['a', 'c']);
        model.deleteShapes(['c']);
        assert.deepEqual(model.getSelectedIds(), ['a']);
        assert.equal(model.getInsertTargetId(), 'a');
    });

    it('addShape: 描き込む先は変わらない', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        model.addShape(makeLine('z'));
        assert.equal(model.getInsertTargetId(), 'b');
    });
});

describe('replaceShape', () => {
    it('select: false・選択なし: 結果の図形が描き込む先になる（keepIdの真偽どちらも）', () => {
        const { model } = setup();
        const newId = model.replaceShape('b', makeLine('tmp'));
        assert.equal(model.getInsertTargetId(), newId);
        assert.notEqual(newId, 'b');

        const { model: model2 } = setup();
        const kept = model2.replaceShape('b', makeLine('tmp'), { keepId: true, select: false });
        assert.equal(kept, 'b');
        assert.equal(model2.getInsertTargetId(), 'b');

        const { model: model3 } = setup();
        model3.setInsertTarget('a');
        const id3 = model3.replaceShape('c', makeLine('tmp'), { select: false, removeIds: ['d'] });
        assert.equal(model3.getInsertTargetId(), id3);
        assert.deepEqual(ids(model3), ['a', 'b', id3]);
    });

    it('select: false・選択あり: 選択が残るなら選ばれている一番上のまま変わらない', () => {
        const { model } = setup();
        model.setSelection(['a']);
        model.replaceShape('c', makeLine('tmp'), { keepId: true, select: false });
        assert.deepEqual(model.getSelectedIds(), ['a']);
        assert.equal(model.getInsertTargetId(), 'a');
    });

    it('select: false・選択ありで、その選択が消えて空になったら、結果の図形になる', () => {
        const { model } = setup();
        model.setSelection(['b']);
        const id = model.replaceShape('c', makeLine('tmp'), { select: false, removeIds: ['b'] });
        assert.deepEqual(model.getSelectedIds(), []);
        assert.equal(model.getInsertTargetId(), id);
    });

    it('select: true: 結果の図形が選ばれ、描き込む先もその図形', () => {
        const { model } = setup();
        model.setInsertTarget('a');
        const id = model.replaceShape('c', makeLine('tmp'));
        assert.deepEqual(model.getSelectedIds(), [id]);
        assert.equal(model.getInsertTargetId(), id);
    });

    it('置き換えない（対象なし）ときは何も変えず通知もしない', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('a');
        const before = notifyCount();
        assert.equal(model.replaceShape('zzz', makeLine('tmp')), null);
        assert.equal(model.getInsertTargetId(), 'a');
        assert.equal(notifyCount(), before);
    });
});

describe('変わらない経路', () => {
    it('reorderShapes: 選択が無ければ描き込む先は変わらない', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        assert.equal(model.reorderShapes(['d', 'c', 'b', 'a']), true);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('reorderShapes: 選択があれば新しい並びでの選ばれている一番上になる', () => {
        const { model } = setup();
        model.setSelection(['a', 'b']);
        assert.equal(model.getInsertTargetId(), 'b');
        model.reorderShapes(['b', 'a', 'c', 'd']);
        assert.equal(model.getInsertTargetId(), 'a');
    });

    it('replaceShapesKeepingIds・renameItem: 変わらない', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        assert.equal(model.replaceShapesKeepingIds([{ id: 'b', shape: makeLine('tmp') }]), 1);
        assert.equal(model.getInsertTargetId(), 'b');
        assert.equal(model.renameItem('b', '新しい名前'), true);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('updateNewShapeStyle・setHovered・moveShapesでは変わらない', () => {
        const { model } = setup();
        model.setInsertTarget('b');
        model.setHovered('a');
        model.moveShapes(['a'], 1, 1);
        model.updateNewShapeStyle({ strokeWidth: 5 });
        assert.equal(model.getInsertTargetId(), 'b');
    });
});

describe('replaceAllShapes', () => {
    it('既定: 描き込む先は無しになる（通知1回）', () => {
        const { model, notifyCount } = setup();
        model.setInsertTarget('b');
        const before = notifyCount();
        model.replaceAllShapes(['a', 'b'].map(makeLine));
        assert.equal(model.getInsertTargetId(), null);
        assert.equal(notifyCount(), before + 1);
    });

    it('keepInsertTarget: 真: 今の値を残す（残っていない図形なら下の行へ・無ければ無し）', () => {
        const { model } = setup();
        model.setInsertTarget('c');
        model.replaceAllShapes(['a', 'b', 'c', 'd'].map(makeLine), { keepInsertTarget: true });
        assert.equal(model.getInsertTargetId(), 'c');
        model.replaceAllShapes(['a', 'b', 'd'].map(makeLine), { keepInsertTarget: true });
        assert.equal(model.getInsertTargetId(), 'b');
        model.replaceAllShapes(['x', 'y'].map(makeLine), { keepInsertTarget: true });
        assert.equal(model.getInsertTargetId(), null);
    });

    it('keepInsertTarget: 真でも選択は空になる', () => {
        const { model } = setup();
        model.setSelection(['b']);
        model.replaceAllShapes(['a', 'b', 'c', 'd'].map(makeLine), { keepInsertTarget: true });
        assert.deepEqual(model.getSelectedIds(), []);
        assert.equal(model.getInsertTargetId(), 'b');
    });

    it('keepInsertTarget: 真の後にsetSelectionで選べば選ばれている一番上になる', () => {
        const { model } = setup();
        model.setInsertTarget('a');
        model.replaceAllShapes(['a', 'b', 'c', 'd'].map(makeLine), { keepInsertTarget: true });
        model.setSelection(['c']);
        assert.equal(model.getInsertTargetId(), 'c');
    });
});
