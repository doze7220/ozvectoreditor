/**
 * 責務: VectorModel.renameItem（名前の変更・変わったときだけ通知1回・他の状態に触れないこと）の振る舞いを公開APIで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';

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
 * 直線a・b・cを入れたモデルと通知回数のカウンタを作る。
 * @returns {{ model: VectorModel, notifyCount: () => number }} モデルと通知回数の取得関数
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes(['a', 'b', 'c'].map(makeLine));
    let count = 0;
    model.onChange(() => { count++; });
    return { model, notifyCount: () => count };
}

/**
 * 図形のアイテムの名前を図形のidで引く。
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {string} 名前
 */
function nameOf(model, id) {
    return model.getItems().find((item) => item.kind === 'shape' && item.shape.id === id).name;
}

describe('VectorModel.renameItem', () => {
    it('名前が変わる: trueを返し、通知は1回', () => {
        const { model, notifyCount } = setup();
        assert.equal(model.renameItem('b', '  新しい名前  '), true);
        assert.equal(nameOf(model, 'b'), '新しい名前');
        assert.equal(notifyCount(), 1);
    });

    it('変わらないとき（同じ名前・空・無いid）はfalseで通知なし', () => {
        const { model, notifyCount } = setup();
        const current = nameOf(model, 'a');
        assert.equal(model.renameItem('a', current), false);
        assert.equal(model.renameItem('a', '   '), false);
        assert.equal(model.renameItem('zzz', '新'), false);
        assert.equal(notifyCount(), 0);
        assert.equal(nameOf(model, 'a'), current);
    });

    it('選択集合・頂点の選択・ホバー・並び・インスタンスを変えない', () => {
        const { model } = setup();
        model.setSelection(['a', 'c']);
        model.setSelectedVertices([{ shapeId: 'a', handle: 'start' }]);
        model.setHovered('b');
        const shapesBefore = model.getShapes();
        const selectedBefore = [...model.getSelectedIds()];
        const verticesBefore = JSON.stringify(model.getSelectedVertices());
        model.renameItem('a', '新');
        assert.deepEqual([...model.getSelectedIds()], selectedBefore);
        assert.equal(JSON.stringify(model.getSelectedVertices()), verticesBefore);
        assert.equal(model.getHoveredId(), 'b');
        const shapesAfter = model.getShapes();
        assert.equal(shapesAfter.length, shapesBefore.length);
        shapesAfter.forEach((shape, i) => assert.equal(shape, shapesBefore[i]));
    });

    it('作成途中の図形に触れない', () => {
        const { model } = setup();
        model.startDraft(0, 0, 'rect');
        const draft = model.getDraftShape();
        model.renameItem('a', '新');
        assert.equal(model.getDraftShape(), draft);
        assert.ok(draft instanceof Rect);
    });

    it('ほかの図形の名前は変わらない', () => {
        const { model } = setup();
        const nameA = nameOf(model, 'a');
        model.renameItem('b', '新');
        assert.equal(nameOf(model, 'a'), nameA);
    });
});
