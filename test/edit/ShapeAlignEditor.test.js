/**
 * 責務: ShapeAlignEditor（整列・分布の手順・押せる/押せないの照会・履歴の呼び出し・通知）の振る舞いを検証する。
 * 実物のVectorModel・図形クラス・ShapeExtentReaderと、呼び出しを記録する偽の記録先の組み合わせを扱う。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ShapeAlignEditor } from '../../js/edit/ShapeAlignEditor.js';
import { ShapeAlignOperation } from '../../js/edit/ShapeAlignRules.js';
import { ShapeExtentReader } from '../../js/edit/ShapeExtentReader.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 実物のモデル・外枠の照会と、呼び出しを記録する偽の記録先でエディタを組む。
 * @param {Array<Rect>} shapes 追加する図形（描画順）
 * @param {number[]} selectedIndexes 選択する図形の添字
 * @returns {{ model: VectorModel, editor: ShapeAlignEditor, calls: Array<Array<*>>, ids: string[], reader: ShapeExtentReader, notifications: () => number }} 組み合わせた実物と記録
 */
function setup(shapes, selectedIndexes) {
    const model = new VectorModel();
    const ids = model.addShapesWithNewIds(shapes);
    model.setSelection(selectedIndexes.map((i) => ids[i]));
    let count = 0;
    model.onChange(() => { count += 1; });
    const calls = [];
    const editRecorder = {
        beginEdit: (...args) => calls.push(['beginEdit', ...args]),
        commitEdit: (...args) => calls.push(['commitEdit', ...args])
    };
    const reader = new ShapeExtentReader({ model });
    const editor = new ShapeAlignEditor({ model, editRecorder, shapeExtentReader: reader });
    return { model, editor, calls, ids, reader, notifications: () => count };
}

/**
 * 図形1つの外枠を実物の照会で求める（その図形だけを選択し直す）。
 * @param {ShapeExtentReader} reader 外枠の照会
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 外枠
 */
function boundsOf(reader, model, id) {
    model.setSelection([id]);
    return reader.getSelectedBoundsPerShape()[0].bounds;
}

/**
 * 線なしの矩形を作る。
 * @param {number} x 左
 * @param {number} y 上
 * @param {number} w 幅
 * @param {number} h 高さ
 * @returns {Rect} 矩形
 */
function box(x, y, w, h) {
    return new Rect(x, y, x + w, y + h, null, 1, '#112233');
}

describe('ShapeAlignEditor.apply', () => {
    it('左へそろえると各図形のminXが選択全体の左端にそろう', () => {
        const { model, editor, ids, reader } = setup([box(10, 0, 5, 5), box(30, 10, 8, 8), box(50, 20, 4, 4)], [0, 1, 2]);
        assert.equal(editor.apply(ShapeAlignOperation.ALIGN_LEFT), true);
        model.clearSelection();
        for (const id of ids) {
            assert.equal(boundsOf(reader, model, id).minX, 10);
        }
    });

    it('右・上下中央へそろう', () => {
        const a = setup([box(0, 0, 10, 10), box(20, 5, 4, 4)], [0, 1]);
        a.editor.apply(ShapeAlignOperation.ALIGN_RIGHT);
        assert.equal(boundsOf(a.reader, a.model, a.ids[0]).maxX, 24);
        assert.equal(boundsOf(a.reader, a.model, a.ids[1]).maxX, 24);

        const b = setup([box(0, 0, 10, 10), box(20, 20, 4, 4)], [0, 1]);
        b.editor.apply(ShapeAlignOperation.ALIGN_VERTICAL_CENTER);
        const b0 = boundsOf(b.reader, b.model, b.ids[0]);
        const b1 = boundsOf(b.reader, b.model, b.ids[1]);
        assert.equal((b0.minY + b0.maxY) / 2, 12);
        assert.equal((b1.minY + b1.maxY) / 2, 12);
    });

    it('横・縦の分布で外枠どうしのすき間が等しくなり、両端は動かない', () => {
        const h = setup([box(0, 0, 10, 10), box(12, 0, 20, 10), box(100, 0, 10, 10)], [0, 1, 2]);
        assert.equal(h.editor.apply(ShapeAlignOperation.DISTRIBUTE_HORIZONTAL), true);
        const b = h.ids.map((id) => boundsOf(h.reader, h.model, id));
        assert.equal(b[0].minX, 0);
        assert.equal(b[2].maxX, 110);
        assert.ok(Math.abs((b[1].minX - b[0].maxX) - (b[2].minX - b[1].maxX)) < 1e-9);

        const v = setup([box(0, 0, 10, 10), box(0, 12, 10, 20), box(0, 100, 10, 10)], [0, 1, 2]);
        assert.equal(v.editor.apply(ShapeAlignOperation.DISTRIBUTE_VERTICAL), true);
        const c = v.ids.map((id) => boundsOf(v.reader, v.model, id));
        assert.equal(c[0].minY, 0);
        assert.equal(c[2].maxY, 110);
        assert.ok(Math.abs((c[1].minY - c[0].maxY) - (c[2].minY - c[1].maxY)) < 1e-9);
    });

    it('線の太さを含む外枠でそろう（中心線の座標は太さの分だけずれる）', () => {
        const thin = new Rect(10, 0, 20, 10, '#000000', 2, null);
        const thick = new Rect(30, 0, 40, 10, '#000000', 10, null);
        const { model, editor, ids, reader } = setup([thin, thick], [0, 1]);
        assert.equal(editor.apply(ShapeAlignOperation.ALIGN_LEFT), true);
        const b0 = boundsOf(reader, model, ids[0]);
        const b1 = boundsOf(reader, model, ids[1]);
        assert.equal(b0.minX, 9);
        assert.equal(b1.minX, 9);
        // 太い図形の中心線は外枠の左端より5px内側（細い図形は1px内側）。
        assert.equal(JSON.parse(JSON.stringify(thin)).points[0].x, 10);
        assert.equal(JSON.parse(JSON.stringify(thick)).points[0].x, 14);
    });

    it('押せないとき（0個・1個・分布で2個・すでにそろっている）はfalseで記録先もモデルも動かない', () => {
        const cases = [
            [[box(0, 0, 5, 5)], [], ShapeAlignOperation.ALIGN_LEFT],
            [[box(0, 0, 5, 5)], [0], ShapeAlignOperation.ALIGN_LEFT],
            [[box(0, 0, 5, 5), box(10, 0, 5, 5)], [0, 1], ShapeAlignOperation.DISTRIBUTE_HORIZONTAL],
            [[box(0, 0, 5, 5), box(0, 10, 8, 5)], [0, 1], ShapeAlignOperation.ALIGN_LEFT],
        ];
        for (const [shapes, selected, operation] of cases) {
            const { editor, calls, notifications } = setup(shapes, selected);
            assert.equal(editor.apply(operation), false);
            assert.deepEqual(calls, []);
            assert.equal(notifications(), 0);
        }
    });

    it('動いたときはbeginEdit→commitEditが1回ずつで鍵が渡らず、通知は1回', () => {
        const { editor, calls, notifications } = setup([box(0, 0, 5, 5), box(10, 3, 5, 5)], [0, 1]);
        assert.equal(editor.apply(ShapeAlignOperation.ALIGN_TOP), true);
        assert.deepEqual(calls, [['beginEdit'], ['commitEdit']]);
        assert.equal(calls[0].length, 1);
        assert.equal(calls[1].length, 1);
        assert.equal(notifications(), 1);
    });

    it('選択中でない図形は動かない', () => {
        const { model, editor, ids, reader } = setup([box(0, 0, 5, 5), box(10, 0, 5, 5), box(40, 0, 5, 5)], [0, 1]);
        const before = JSON.stringify(model.getShapes()[2]);
        editor.apply(ShapeAlignOperation.ALIGN_RIGHT);
        assert.equal(JSON.stringify(model.getShapes()[2]), before);
        assert.equal(boundsOf(reader, model, ids[2]).minX, 40);
    });

    it('未知の操作でErrorを投げ、記録先を呼ばない', () => {
        const { editor, calls } = setup([box(0, 0, 5, 5), box(10, 0, 5, 5)], [0, 1]);
        assert.throws(() => editor.apply('unknown'), Error);
        assert.deepEqual(calls, []);
    });
});

describe('ShapeAlignEditor.getAvailability', () => {
    it('8操作分のキーを返し、2個では整列だけ・3個では分布も可否が分かれる', () => {
        const two = setup([box(0, 0, 5, 5), box(10, 3, 8, 8)], [0, 1]);
        const a2 = two.editor.getAvailability();
        assert.deepEqual(Object.keys(a2).sort(), Object.values(ShapeAlignOperation).sort());
        assert.equal(a2.alignLeft, true);
        assert.equal(a2.distributeHorizontal, false);
        assert.equal(a2.distributeVertical, false);

        const three = setup([box(0, 0, 5, 5), box(8, 3, 8, 8), box(40, 30, 5, 5)], [0, 1, 2]);
        const a3 = three.editor.getAvailability();
        assert.equal(a3.distributeHorizontal, true);
        assert.equal(a3.distributeVertical, true);
    });

    it('モデル・選択集合を変えず、通知0回・記録先を呼ばない', () => {
        const { model, editor, calls, notifications, ids } = setup([box(0, 0, 5, 5), box(10, 3, 8, 8)], [0, 1]);
        const before = JSON.stringify(model.getShapes());
        editor.getAvailability();
        assert.equal(JSON.stringify(model.getShapes()), before);
        assert.equal(model.isSelected(ids[0]), true);
        assert.equal(model.isSelected(ids[1]), true);
        assert.equal(notifications(), 0);
        assert.deepEqual(calls, []);
    });

    it('外枠の照会は1回だけ呼ばれる', () => {
        const model = new VectorModel();
        const ids = model.addShapesWithNewIds([box(0, 0, 5, 5), box(10, 3, 8, 8)]);
        model.setSelection(ids);
        const real = new ShapeExtentReader({ model });
        let count = 0;
        const counting = {
            getSelectedBoundsPerShape: () => {
                count += 1;
                return real.getSelectedBoundsPerShape();
            }
        };
        const editor = new ShapeAlignEditor({
            model,
            editRecorder: { beginEdit: () => {}, commitEdit: () => {} },
            shapeExtentReader: counting
        });
        editor.getAvailability();
        assert.equal(count, 1);
    });
});
