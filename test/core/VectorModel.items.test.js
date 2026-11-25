/**
 * 責務：VectorModel が図形とフォルダのアイテムの入れ子の並びを持つこと（getItems・名前・id・削除・差し替え・並べ替え・追加）を公開APIで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { ShapeFactory } from '../../js/core/ShapeFactory.js';

/**
 * 図形を作る（idは未設定）。
 * @param {string} [type] - 図形の種別
 * @returns {Object} 図形インスタンス
 */
function makeShape(type = 'rect') {
    return ShapeFactory.create(type, 0, 0, 10, 10);
}

/**
 * 図形のアイテムを作る。
 * @param {Object} shape - 図形インスタンス
 * @param {string} [id] - 図形のid（指定すれば図形へ入れる）
 * @param {Object} [attrs] - name・visible・locked
 * @returns {Object} 図形のアイテム
 */
function sItem(shape, id, attrs = {}) {
    if (id !== undefined) {
        shape.id = id;
    }
    return { kind: 'shape', shape, ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {string|undefined} id - フォルダのid
 * @param {Object[]} children - 中身
 * @param {Object} [attrs] - name・visible・locked
 * @returns {Object} フォルダのアイテム
 */
function gItem(id, children, attrs = {}) {
    return { kind: 'group', id, children, ...attrs };
}

/**
 * アイテムの入れ子を、比べやすい形（id・名前・表示・ロック・中身）に直す。
 * @param {Object[]} items - アイテムの入れ子
 * @returns {Object[]} 簡素な形
 */
function brief(items) {
    return items.map((item) => (item.kind === 'group'
        ? { id: item.id, name: item.name, visible: item.visible, locked: item.locked, children: brief(item.children) }
        : { id: item.shape.id, name: item.name, visible: item.visible, locked: item.locked }));
}

/**
 * 描画だけを描いて確定する。
 * @param {VectorModel} model - モデル
 * @param {string} type - 図形の種別
 * @returns {void}
 */
function draw(model, type) {
    model.startDraft(0, 0, type);
    model.updateDraft(5, 5);
    model.commitDraft();
}

describe('VectorModel 入れ子の並び', () => {
    it('初期は空で、getItems は新しい配列を返す', () => {
        const model = new VectorModel();
        assert.deepEqual(model.getItems(), []);
        assert.notEqual(model.getItems(), model.getItems());
    });

    it('commitDraft：種別ごとの名前が付き（曲線のツールはパス）、表示あり・ロックなしで末尾に入る', () => {
        const model = new VectorModel();
        for (const type of ['line', 'curve', 'arc', 'rect', 'circle']) {
            draw(model, type);
        }
        draw(model, 'rect');
        draw(model, 'line');
        const items = model.getItems();
        assert.deepEqual(
            items.map((i) => i.name),
            ['直線 1', 'パス 1', '弧 1', '矩形 1', '円 1', '矩形 2', '直線 2']
        );
        assert.ok(items.every((i) => i.kind === 'shape' && i.visible === true && i.locked === false));
        assert.deepEqual(model.getShapes().map((s) => s.id), items.map((i) => i.shape.id));
    });

    it('続けて引く線：replaceDraft → commitDraft でも確定した図形の種別で名前が付く', () => {
        const model = new VectorModel();
        model.startDraft(0, 0, 'line');
        const replacement = ShapeFactory.create('curve', 0, 0, 5, 5);
        assert.equal(model.replaceDraft(replacement), true);
        model.commitDraft();
        assert.equal(model.getItems()[0].name, 'パス 1');
    });

    it('addShape：名前が付いて末尾に入る', () => {
        const model = new VectorModel();
        const shape = makeShape('circle');
        model.addShape(shape);
        assert.equal(model.getItems()[0].name, '円 1');
        assert.equal(model.getShapes()[0], shape);
    });

    it('replaceAllShapes：入れ子が getItems に出て、getShapes は描画順の平らな並び', () => {
        const model = new VectorModel();
        const a = makeShape();
        const b = makeShape('line');
        const c = makeShape('circle');
        const count = model.replaceAllShapes([
            sItem(a, 'shape-1', { name: 'あ', visible: false, locked: true }),
            gItem('group-2', [sItem(b, 'shape-3', { name: 'い' }), gItem('group-4', [])], { name: 'フォルダA' }),
            sItem(c, 'shape-5', { name: 'う' }),
        ]);
        assert.equal(count, 0);
        assert.deepEqual(brief(model.getItems()), [
            { id: 'shape-1', name: 'あ', visible: false, locked: true },
            {
                id: 'group-2', name: 'フォルダA', visible: true, locked: false, children: [
                    { id: 'shape-3', name: 'い', visible: true, locked: false },
                    { id: 'group-4', name: 'フォルダ 1', visible: true, locked: false, children: [] },
                ],
            },
            { id: 'shape-5', name: 'う', visible: true, locked: false },
        ]);
        assert.deepEqual(model.getShapes(), [a, b, c]);
    });

    it('replaceAllShapes：素の図形も受け、自動の名前が付く', () => {
        const model = new VectorModel();
        model.replaceAllShapes([makeShape('rect'), makeShape('rect')]);
        assert.deepEqual(model.getItems().map((i) => i.name), ['矩形 1', '矩形 2']);
    });

    it('getItems を書き換えてもモデルは変わらない（図形は共有）', () => {
        const model = new VectorModel();
        const a = makeShape();
        model.replaceAllShapes([gItem('group-1', [sItem(a, 'shape-2', { name: 'x' })], { name: 'g' })]);
        const items = model.getItems();
        items[0].name = '書き換え';
        items[0].children[0].name = '書き換え2';
        items[0].children.push(sItem(makeShape(), 'shape-9'));
        items.push(gItem('group-9', []));
        const again = model.getItems();
        assert.equal(again.length, 1);
        assert.equal(again[0].name, 'g');
        assert.equal(again[0].children.length, 1);
        assert.equal(again[0].children[0].name, 'x');
        assert.equal(again[0].children[0].shape, a);
    });

    it('replaceAllShapes：図形とフォルダの id の重複・欠落を合わせて振り直し、連番を繰り上げる', () => {
        const model = new VectorModel();
        const a = makeShape();
        const b = makeShape();
        const c = makeShape();
        const count = model.replaceAllShapes([
            sItem(a, 'shape-1'),
            gItem('shape-1', [sItem(b, 'group-9')]),
            gItem(undefined, [sItem(c, 'group-9')]),
        ]);
        assert.equal(count, 3);
        const items = model.getItems();
        assert.equal(items[0].shape.id, 'shape-1');
        assert.equal(items[1].children[0].shape.id, 'group-9');
        assert.match(items[1].id, /^group-\d+$/);
        assert.match(items[2].id, /^group-\d+$/);
        assert.match(items[2].children[0].shape.id, /^shape-\d+$/);
        const ids = [items[0].shape.id, items[1].id, items[1].children[0].shape.id, items[2].id, items[2].children[0].shape.id];
        assert.equal(new Set(ids).size, 5);
        const serials = [items[1].id, items[2].id, items[2].children[0].shape.id].map((id) => Number(id.split('-')[1]));
        assert.ok(serials.every((n) => n >= 10));
    });

    it('replaceAllShapes：group-9 を保持した後の採番は 10 以上になる', () => {
        const model = new VectorModel();
        model.replaceAllShapes([gItem('group-9', [])]);
        draw(model, 'rect');
        assert.equal(model.getShapes()[0].id, 'shape-10');
    });

    it('replaceAllShapes：通知は1回で、選択等をクリアする', () => {
        const model = new VectorModel();
        const a = makeShape();
        model.replaceAllShapes([sItem(a, 'shape-1')]);
        model.setSelection(['shape-1']);
        let count = 0;
        model.onChange(() => { count++; });
        model.replaceAllShapes([gItem('group-1', [sItem(makeShape(), 'shape-2')])]);
        assert.equal(count, 1);
        assert.deepEqual(model.getSelectedIds(), []);
    });

    it('deleteShapes：空になったフォルダは残り、フォルダの id は無視される', () => {
        const model = new VectorModel();
        const a = makeShape();
        const b = makeShape();
        model.replaceAllShapes([
            gItem('group-1', [sItem(a, 'shape-2', { name: 'a' })], { name: 'g' }),
            sItem(b, 'shape-3', { name: 'b' }),
        ]);
        let count = 0;
        model.onChange(() => { count++; });
        model.deleteShapes(['group-1']);
        assert.equal(count, 0);
        assert.equal(model.getShapes().length, 2);
        model.deleteShapes(['shape-2']);
        assert.equal(count, 1);
        assert.deepEqual(brief(model.getItems()), [
            { id: 'group-1', name: 'g', visible: true, locked: false, children: [] },
            { id: 'shape-3', name: 'b', visible: true, locked: false },
        ]);
    });

    it('replaceShape：位置の名前・表示・ロック・所属を引き継ぎ、種別が変わっても名前は変わらない', () => {
        const model = new VectorModel();
        const a = makeShape('line');
        const b = makeShape('rect');
        model.replaceAllShapes([
            gItem('group-1', [sItem(a, 'shape-2', { name: '直線 2', visible: false, locked: true })], { name: 'G' }),
            sItem(b, 'shape-3', { name: 'b' }),
        ]);
        const path = makeShape('curve');
        const id = model.replaceShape('shape-2', path, { keepId: true });
        assert.equal(id, 'shape-2');
        assert.deepEqual(brief(model.getItems()), [
            { id: 'group-1', name: 'G', visible: true, locked: false, children: [{ id: 'shape-2', name: '直線 2', visible: false, locked: true }] },
            { id: 'shape-3', name: 'b', visible: true, locked: false },
        ]);
        assert.equal(model.getItems()[0].children[0].shape, path);
    });

    it('replaceShape：keepId なしは新しい id になり、別のフォルダの中の removeIds も除く', () => {
        const model = new VectorModel();
        const a = makeShape();
        const b = makeShape();
        const c = makeShape();
        model.replaceAllShapes([
            gItem('group-1', [sItem(a, 'shape-2', { name: 'a' })], { name: 'G1' }),
            gItem('group-3', [sItem(b, 'shape-4', { name: 'b' })], { name: 'G2' }),
            sItem(c, 'shape-5', { name: 'c' }),
        ]);
        const shape = makeShape('curve');
        const id = model.replaceShape('shape-2', shape, { removeIds: ['shape-4', 'shape-2'] });
        assert.notEqual(id, 'shape-2');
        assert.match(id, /^shape-\d+$/);
        assert.deepEqual(brief(model.getItems()), [
            { id: 'group-1', name: 'G1', visible: true, locked: false, children: [{ id, name: 'a', visible: true, locked: false }] },
            { id: 'group-3', name: 'G2', visible: true, locked: false, children: [] },
            { id: 'shape-5', name: 'c', visible: true, locked: false },
        ]);
        assert.deepEqual(model.getSelectedIds(), [id]);
    });

    it('replaceShape：既にある図形インスタンス・存在しない id は何も変えない', (t) => {
        t.mock.method(console, 'warn', () => {});
        const model = new VectorModel();
        const a = makeShape();
        model.replaceAllShapes([sItem(a, 'shape-1')]);
        const before = JSON.stringify(brief(model.getItems()));
        assert.equal(model.replaceShape('shape-1', a), null);
        assert.equal(model.replaceShape('shape-9', makeShape()), null);
        assert.equal(JSON.stringify(brief(model.getItems())), before);
    });

    it('replaceShapesKeepingIds：shape だけを差し替え、名前・表示・ロック・所属は位置のまま。通知は1回', () => {
        const model = new VectorModel();
        const a = makeShape();
        const b = makeShape();
        model.replaceAllShapes([
            gItem('group-1', [sItem(a, 'shape-2', { name: 'a', visible: false })], { name: 'G' }),
            sItem(b, 'shape-3', { name: 'b', locked: true }),
        ]);
        let count = 0;
        model.onChange(() => { count++; });
        const na = makeShape('circle');
        const nb = makeShape('line');
        assert.equal(model.replaceShapesKeepingIds([{ id: 'shape-2', shape: na }, { id: 'shape-3', shape: nb }, { id: 'shape-9', shape: makeShape() }]), 2);
        assert.equal(count, 1);
        assert.deepEqual(brief(model.getItems()), [
            { id: 'group-1', name: 'G', visible: true, locked: false, children: [{ id: 'shape-2', name: 'a', visible: false, locked: false }] },
            { id: 'shape-3', name: 'b', visible: true, locked: true },
        ]);
        assert.deepEqual(model.getShapes(), [na, nb]);
        assert.equal(model.replaceShapesKeepingIds([{ id: 'shape-9', shape: makeShape() }]), 0);
        assert.equal(count, 1);
    });

    it('moveShapes・updateVertices・moveShapesBy・updateShapeStyles は入れ子の中の図形にも効く（通知は各1回）', () => {
        const model = new VectorModel();
        const a = makeShape('line');
        const b = makeShape('line');
        model.replaceAllShapes([gItem('group-1', [sItem(a, 'shape-2'), sItem(b, 'shape-3')])]);
        let count = 0;
        model.onChange(() => { count++; });
        const beforeA = JSON.stringify(a.toJSON().points);
        model.moveShapes(['shape-2', 'shape-3'], 3, 4);
        assert.notEqual(JSON.stringify(a.toJSON().points), beforeA);
        model.moveShapesBy([{ id: 'shape-3', dx: 1, dy: 1 }]);
        model.updateVertices([{ id: 'shape-2', vertexIndex: 0, x: 100, y: 100 }]);
        assert.equal(model.updateShapeStyles([{ id: 'shape-3', style: { strokeWidth: 7 } }]), 1);
        assert.equal(b.strokeWidth, 7);
        assert.equal(count, 4);
    });

    it('addShapesWithNewIds：入れ子ごと外側の末尾へ、新しい id で入り、名前は引き継がれる', () => {
        const model = new VectorModel();
        const existing = makeShape('rect');
        model.replaceAllShapes([sItem(existing, 'shape-1', { name: '矩形 1' })]);
        const a = makeShape('rect');
        const b = makeShape('line');
        const ids = model.addShapesWithNewIds([
            gItem('group-1', [sItem(a, 'shape-1', { name: 'ある名前', visible: false, locked: true }), sItem(b, 'shape-2')], { name: 'フォルダX' }),
        ]);
        assert.equal(ids.length, 2);
        assert.ok(ids.every((id) => /^shape-\d+$/.test(id)));
        assert.notEqual(ids[0], 'shape-1');
        const items = model.getItems();
        assert.equal(items.length, 2);
        assert.equal(items[0].shape, existing);
        assert.match(items[1].id, /^group-\d+$/);
        assert.notEqual(items[1].id, 'group-1');
        assert.deepEqual(items[1].children.map((c) => [c.shape.id, c.name, c.visible, c.locked]), [
            [ids[0], 'ある名前', false, true],
            [ids[1], '直線 1', true, false],
        ]);
        assert.deepEqual(model.getSelectedIds().sort(), [...ids, 'shape-1'].filter((id) => id !== 'shape-1').sort());
    });

    it('addShapesWithNewIds：素の図形は既存の名前と重ならず、通知は1回', () => {
        const model = new VectorModel();
        draw(model, 'rect');
        let count = 0;
        model.onChange(() => { count++; });
        const ids = model.addShapesWithNewIds([makeShape('rect'), makeShape('rect')]);
        assert.equal(count, 1);
        assert.equal(ids.length, 2);
        assert.deepEqual(model.getItems().map((i) => i.name), ['矩形 1', '矩形 2', '矩形 3']);
    });

    it('addShapesWithNewIds：フォルダだけなら何も変えず通知もせず空配列', () => {
        const model = new VectorModel();
        draw(model, 'rect');
        const before = JSON.stringify(brief(model.getItems()));
        let count = 0;
        model.onChange(() => { count++; });
        assert.deepEqual(model.addShapesWithNewIds([gItem('group-1', []), gItem('group-2', [gItem('group-3', [])])]), []);
        assert.equal(count, 0);
        assert.equal(JSON.stringify(brief(model.getItems())), before);
    });

    it('addShapesWithNewIds：重複インスタンスは警告して除き、残りは入る', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const model = new VectorModel();
        const a = makeShape();
        const ids = model.addShapesWithNewIds([a, a, gItem('group-1', [sItem(a)])]);
        assert.equal(ids.length, 1);
        assert.equal(warn.mock.callCount(), 2);
        assert.equal(model.getShapes().length, 1);
        assert.equal(model.getItems().length, 2);
        assert.equal(model.getItems()[1].children.length, 0);
        const none = model.addShapesWithNewIds([a]);
        assert.deepEqual(none, []);
        assert.equal(warn.mock.callCount(), 3);
    });

    it('通知の回数：commitDraft・deleteShapes・rearrangeItems は1回', () => {
        const model = new VectorModel();
        model.startDraft(0, 0, 'rect');
        let count = 0;
        model.onChange(() => { count++; });
        model.commitDraft();
        assert.equal(count, 1);
        draw(model, 'rect');
        count = 0;
        model.rearrangeItems([...model.getItems()].reverse());
        assert.equal(count, 1);
        model.deleteShapes([model.getShapes()[0].id]);
        assert.equal(count, 2);
    });
});
