/**
 * 責務: SpriteSerializer.serializeが、隠れた図形（自分・上のフォルダの表示が切）をelements・boundsから外し、sourceには全部を残すことを、公開APIのみを通して検証する。
 * ロックは書き出しに効かないこと、すべて隠れたときの空の出力、版・キーの並び、JS書き出しを通した往復も確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 図形のアイテムを作る。
 * @param {object} shape - 図形
 * @param {string} id - 図形のid
 * @param {object} [attrs] - name・visible・locked
 * @returns {object} 図形のアイテム
 */
function shapeItem(shape, id, attrs = {}) {
    shape.id = id;
    return { kind: 'shape', shape, ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Array<object>} children - 中身
 * @param {object} [attrs] - name・visible・locked
 * @returns {object} フォルダのアイテム
 */
function groupItem(id, children, attrs = {}) {
    return { kind: 'group', id, children, ...attrs };
}

/**
 * 図形4つ（a・b・c・d）の入れ子を作る。a・bはフォルダg1の中、c・dは外。
 * @param {object} states - 各行の表示・ロックの値（folderVisible・folderLocked・bLocked・cVisible・dVisible）
 * @returns {Array<object>} アイテムの配列
 */
function makeItems(states = {}) {
    const { folderVisible = true, folderLocked = false, bLocked = false, cVisible = true, dVisible = true } = states;
    return [
        groupItem('g1', [
            shapeItem(new Line(0, 0, 10, 10, '#111111', 2), 'a'),
            shapeItem(new Rect(20, 20, 30, 30, '#222222', 2), 'b', { locked: bLocked }),
        ], { visible: folderVisible, locked: folderLocked }),
        shapeItem(new Rect(100, 100, 120, 130, '#333333', 2), 'c', { visible: cVisible }),
        shapeItem(new Line(200, 0, 210, 10, '#444444', 2), 'd', { visible: dVisible }),
    ];
}

/**
 * elementsのidの並びを返す。
 * @param {object} data - スプライトデータ
 * @returns {Array<string>} id
 */
function idsOf(data) {
    return data.elements.map((e) => e.id);
}

describe('SpriteSerializer.serialize: 表示・ロックの書き出し', () => {
    it('すべて表示・ロックなしなら全図形が出る', () => {
        const data = SpriteSerializer.serialize(makeItems());
        assert.deepEqual(idsOf(data), ['a', 'b', 'c', 'd']);
        assert.deepEqual(data.bounds, { minX: -1, minY: -1, maxX: 211, maxY: 131 });
    });

    it('自分の表示が切の図形はelements・boundsに無く、sourceにはある', () => {
        const items = makeItems({ cVisible: false });
        const data = SpriteSerializer.serialize(items);
        assert.deepEqual(idsOf(data), ['a', 'b', 'd']);
        assert.deepEqual(data.bounds, { minX: -1, minY: -1, maxX: 211, maxY: 31 });
        assert.deepEqual(data.source, DocumentSerializer.serialize(items));
        const result = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(data.source)));
        assert.deepEqual(result.shapes.map((s) => s.id), ['a', 'b', 'c', 'd']);
        assert.equal(result.items[1].visible, false);
    });

    it('上のフォルダの表示が切なら、中の図形（自分は表示）も出ない', () => {
        const data = SpriteSerializer.serialize(makeItems({ folderVisible: false }));
        assert.deepEqual(idsOf(data), ['c', 'd']);
        assert.deepEqual(data.bounds, { minX: 99, minY: -1, maxX: 211, maxY: 131 });
        const result = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(data.source)));
        assert.equal(result.items[0].children.length, 2);
        assert.equal(result.items[0].visible, false);
    });

    it('ロックした図形・ロックしたフォルダの中の図形は出る', () => {
        const data = SpriteSerializer.serialize(makeItems({ bLocked: true }));
        assert.deepEqual(idsOf(data), ['a', 'b', 'c', 'd']);
        const locked = SpriteSerializer.serialize(makeItems({ folderLocked: true }));
        assert.deepEqual(idsOf(locked), ['a', 'b', 'c', 'd']);
    });

    it('隠れてロックもされたフォルダの中の図形は出ない', () => {
        const data = SpriteSerializer.serialize(makeItems({ folderVisible: false, folderLocked: true }));
        assert.deepEqual(idsOf(data), ['c', 'd']);
    });

    it('すべて隠れていると elements は空・bounds は null（図形0個と同じ）。sourceは別', () => {
        const items = makeItems({ folderVisible: false, cVisible: false, dVisible: false });
        const data = SpriteSerializer.serialize(items);
        const empty = SpriteSerializer.serialize([]);
        assert.deepEqual(data.elements, []);
        assert.equal(data.bounds, null);
        assert.deepEqual(data.elements, empty.elements);
        assert.equal(data.bounds, empty.bounds);
        assert.deepEqual(data.source, DocumentSerializer.serialize(items));
        assert.notDeepEqual(data.source, empty.source);
    });

    it('版は4で、キーの並びは変わらない', () => {
        const data = SpriteSerializer.serialize(makeItems({ folderVisible: false }));
        assert.equal(data.formatVersion, 4);
        assert.equal(data.source.version, 4);
        assert.deepEqual(Object.keys(data), ['format', 'formatVersion', 'bounds', 'elements', 'source']);
    });

    it('素の図形の配列は今までどおり全部が出る', () => {
        const items = makeItems();
        const shapes = [items[0].children[0].shape, items[0].children[1].shape, items[1].shape, items[2].shape];
        const data = SpriteSerializer.serialize(shapes);
        assert.deepEqual(idsOf(data), ['a', 'b', 'c', 'd']);
        assert.deepEqual(data.elements, shapes.map((shape) => shape.toDrawElement()));
    });

    it('すべて表示・ロックなしの入力は、素の配列と同じelements・boundsになる', () => {
        const items = makeItems();
        const shapes = [items[0].children[0].shape, items[0].children[1].shape, items[1].shape, items[2].shape];
        const fromItems = SpriteSerializer.serialize(items);
        const fromPlain = SpriteSerializer.serialize(shapes);
        assert.deepEqual(fromItems.elements, fromPlain.elements);
        assert.deepEqual(fromItems.bounds, fromPlain.bounds);
    });

    it('引数のアイテムを書き換えない', () => {
        const items = makeItems({ folderVisible: false, dVisible: false });
        const before = JSON.stringify(items);
        SpriteSerializer.serialize(items);
        assert.equal(JSON.stringify(items), before);
    });

    it('JS書き出しを通した往復で、隠した図形と表示・ロックの値がsourceから戻る', () => {
        const data = SpriteSerializer.serialize(makeItems({ folderVisible: false, folderLocked: true, dVisible: false }));
        const moduleText = CodeExporter.toModuleText(data);
        const jsonText = CodeExporter.extractSpriteDataText(moduleText);
        assert.notEqual(jsonText, null);
        const parsed = JSON.parse(jsonText);
        assert.deepEqual(idsOf(parsed), ['c']);
        const result = DocumentSerializer.deserialize(parsed.source);
        assert.equal(result.ok, true);
        assert.deepEqual(result.shapes.map((s) => s.id), ['a', 'b', 'c', 'd']);
        assert.equal(result.items[0].visible, false);
        assert.equal(result.items[0].locked, true);
        assert.equal(result.items[2].visible, false);
    });

    it('作業データの出力（DocumentSerializer.serialize）は隠した図形も全部持つ', () => {
        const items = makeItems({ folderVisible: false, cVisible: false, dVisible: false });
        const doc = DocumentSerializer.serialize(items);
        const result = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(doc)));
        assert.equal(result.ok, true);
        assert.deepEqual(result.shapes.map((s) => s.id), ['a', 'b', 'c', 'd']);
    });
});
