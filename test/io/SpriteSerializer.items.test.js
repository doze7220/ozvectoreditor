/**
 * 責務: SpriteSerializer.serializeがアイテム（名前・表示・ロック・フォルダの入れ子）を受けたときの書き出し（elements・bounds・source）を、公開APIのみを通して検証する。
 * 名前・ロックが描画要素・外枠に効かないこと、sourceの往復、JS書き出しを通した往復も確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 図形へidを代入して返す。
 * @param {object} shape - 図形
 * @param {string} id - 代入するid
 * @returns {object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * 5種類＋パスの図形を描画順（奥から）に作る。
 * @returns {Array<object>} 図形の配列（id: s1〜s6）
 */
function makeShapes() {
    return [
        withId(new Line(0, 0, 10, 10, '#111111', 2), 's1'),
        withId(new Curve(0, 0, 20, 20), 's2'),
        withId(new Rect(5, 5, 25, 15, '#222222', 4), 's3'),
        withId(new Ellipse(10, 20, 40, 60, 'circle'), 's4'),
        withId(new Ellipse(10, 20, 40, 60, 'arc'), 's5'),
        withId(new Path([{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }], true, '#333333', 2, '#444444'), 's6'),
    ];
}

/**
 * 図形のアイテムを作る。
 * @param {object} shape - 図形
 * @param {object} [attrs] - name・visible・locked
 * @returns {object} 図形のアイテム
 */
function shapeItem(shape, attrs = {}) {
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
 * 入れ子・表示なし・ロックあり・長い名前を含むアイテムの並び（平らにすると s1〜s6 の順）を作る。
 * @param {Array<object>} shapes - makeShapes の戻り値
 * @param {boolean} [withHidden=true] - 表示なし（自分・フォルダ）を含めるか（偽なら表示ありにする。ロック・名前は同じ）
 * @returns {Array<object>} アイテムの配列
 */
function makeItems(shapes, withHidden = true) {
    const [s1, s2, s3, s4, s5, s6] = shapes;
    const visible = !withHidden;
    return [
        shapeItem(s1, { name: 'あ'.repeat(150), visible }),
        groupItem('group-1', [
            shapeItem(s2, { locked: true }),
            groupItem('group-2', [shapeItem(s3, { name: '矩形', visible, locked: true }), shapeItem(s4)], { name: 'F', visible }),
            groupItem('group-3', []),
        ], { locked: true }),
        shapeItem(s5),
        shapeItem(s6, { name: 'x', locked: true }),
    ];
}

/** 本作業の前の値を文字どおり固定した期待値（makeShapes の elements）。 */
const EXPECTED_ELEMENTS = [
    { kind: 'polyline', id: 's1', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], closed: false, strokeColor: '#111111', strokeWidth: 2, fillColor: null },
    { kind: 'quadratic', id: 's2', points: [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 20 }], strokeColor: '#000000', strokeWidth: 2, fillColor: null },
    { kind: 'polyline', id: 's3', points: [{ x: 5, y: 5 }, { x: 25, y: 5 }, { x: 25, y: 15 }, { x: 5, y: 15 }], closed: true, strokeColor: '#222222', strokeWidth: 4, fillColor: null },
    { kind: 'ellipse', id: 's4', x: 10, y: 20, radiusX: 30, radiusY: 40, rotation: 0, startAngle: 0, endAngle: 6.283185307179586, closed: true, strokeColor: '#000000', strokeWidth: 2, fillColor: null },
    { kind: 'ellipse', id: 's5', x: 10, y: 20, radiusX: 30, radiusY: 40, rotation: 0, startAngle: 3.141592653589793, endAngle: 6.283185307179586, closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: null },
    { kind: 'polyline', id: 's6', points: [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 30 }], closed: true, strokeColor: '#333333', strokeWidth: 2, fillColor: '#444444' },
];

describe('SpriteSerializer.serialize: アイテムの入れ子', () => {
    it('elements・boundsが、同じ図形を素の配列で渡したものと一致する', () => {
        const shapes = makeShapes();
        const fromItems = SpriteSerializer.serialize(makeItems(shapes, false));
        const fromPlain = SpriteSerializer.serialize(shapes);
        assert.deepEqual(fromItems.elements, fromPlain.elements);
        assert.deepEqual(fromItems.bounds, fromPlain.bounds);
    });

    it('elementsが各図形のtoDrawElement()の並び（平らにした重なり順）と一致する', () => {
        const shapes = makeShapes();
        const data = SpriteSerializer.serialize(makeItems(shapes, false));
        assert.deepEqual(data.elements, shapes.map((shape) => shape.toDrawElement()));
        assert.deepEqual(data.elements.map((e) => e.id), ['s1', 's2', 's3', 's4', 's5', 's6']);
    });

    it('elementsに名前・表示・ロックのキーが出ない', () => {
        const data = SpriteSerializer.serialize(makeItems(makeShapes()));
        for (const element of data.elements) {
            for (const key of ['name', 'visible', 'locked', 'children']) {
                assert.equal(Object.hasOwn(element, key), false, key);
            }
        }
    });

    it('elements・boundsが本作業の前の値（文字どおりの期待値）と一致する', () => {
        const data = SpriteSerializer.serialize(makeItems(makeShapes(), false));
        assert.deepEqual(data.elements, EXPECTED_ELEMENTS);
        assert.deepEqual(data.bounds, { minX: -21, minY: -21, maxX: 41, maxY: 61 });
        assert.deepEqual(Object.keys(data), ['format', 'formatVersion', 'bounds', 'elements', 'source']);
    });

    it('formatVersionが4で、sourceがDocumentSerializer.serialize(items)と同じ', () => {
        const items = makeItems(makeShapes());
        const data = SpriteSerializer.serialize(items);
        assert.equal(data.formatVersion, 4);
        assert.deepEqual(data.source, DocumentSerializer.serialize(items));
        assert.equal(data.source.version, 4);
    });

    it('sourceをdeserializeすると入れ子・名前・表示・ロックが戻る', () => {
        const data = SpriteSerializer.serialize(makeItems(makeShapes()));
        const result = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(data.source)));
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 4);
        assert.equal(result.items[1].kind, 'group');
        assert.equal(result.items[1].locked, true);
        assert.equal(result.items[1].children[1].children.length, 2);
        assert.equal(result.items[1].children[1].visible, false);
        assert.equal(result.items[1].children[2].children.length, 0);
        assert.equal(result.items[0].name, 'あ'.repeat(100));
        assert.equal(result.items[0].visible, false);
        assert.deepEqual(result.shapes.map((s) => s.id), ['s1', 's2', 's3', 's4', 's5', 's6']);
    });

    it('素の配列を渡した場合も従来どおり書き出せ、名前が自動で付く', () => {
        const data = SpriteSerializer.serialize(makeShapes());
        assert.deepEqual(data.elements, EXPECTED_ELEMENTS);
        assert.deepEqual(data.source.shapes.map((e) => e.name), ['直線 1', '曲線 1', '矩形 1', '円 1', '弧 1', 'パス 1']);
    });

    it('引数のアイテムを書き換えない', () => {
        const items = makeItems(makeShapes());
        const before = JSON.stringify(items);
        SpriteSerializer.serialize(items);
        assert.equal(JSON.stringify(items), before);
    });

    it('改行・;・引用符・const spriteData = を含む名前でも、JS書き出しを通して元に戻る', () => {
        const nasty = 'a\n;"\'\nconst spriteData = {};\r\n`${x}`\\';
        const shapes = makeShapes();
        const items = [
            groupItem('group-1', [shapeItem(shapes[0], { name: nasty })], { name: nasty }),
            shapeItem(shapes[1], { name: ';\nconst spriteData = ' }),
        ];
        const data = SpriteSerializer.serialize(items);
        const moduleText = CodeExporter.toModuleText(data);
        const jsonText = CodeExporter.extractSpriteDataText(moduleText);
        assert.notEqual(jsonText, null);
        const parsed = JSON.parse(jsonText);
        assert.deepEqual(parsed, JSON.parse(JSON.stringify(data)));
        const result = DocumentSerializer.deserialize(parsed.source);
        assert.equal(result.ok, true);
        assert.equal(result.items[0].name, nasty);
        assert.equal(result.items[0].children[0].name, nasty);
        assert.equal(result.items[1].name, ';\nconst spriteData =');
    });
});
