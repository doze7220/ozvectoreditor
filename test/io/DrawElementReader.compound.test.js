/**
 * 責務: `compoundPath`の描画要素を、DrawElementReader.toCompoundPathShapeData（輪郭ごとの図形データ）と、
 * DocumentSerializer.deserializeShapeElementsの第3引数・FileContentReaderを通した複合パスのフォルダとして、公開APIだけで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DrawElementReader } from '../../js/io/DrawElementReader.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { FileContentReader } from '../../js/io/FileContentReader.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { ShapeFactory } from '../../js/core/ShapeFactory.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 図形のアイテムを作る。
 * @param {object} shape - 図形
 * @param {object} [attrs] - visibleなど
 * @returns {object} 図形のアイテム
 */
function s(shape, attrs = {}) {
    return { kind: 'shape', shape, ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Array<object>} children - 中身
 * @param {object} [attrs] - compound・visibleなど
 * @returns {object} フォルダのアイテム
 */
function g(id, children, attrs = {}) {
    return { kind: 'group', id, children, ...attrs };
}

/**
 * 4点の閉じた輪郭（polyline）を作る。
 * @param {number} a - 左上のx・y
 * @param {number} b - 右下のx・y
 * @returns {object} 輪郭（スタイルなし）
 */
function squareOutline(a, b) {
    return {
        kind: 'polyline',
        closed: true,
        points: [{ x: a, y: a }, { x: b, y: a }, { x: b, y: b }, { x: a, y: b }],
    };
}

/**
 * 複合パスの描画要素を作る。
 * @param {Array<object>} outlines - 輪郭
 * @param {object} [style] - スタイルの上書き
 * @returns {object} 描画要素
 */
function compoundElement(outlines, style = {}) {
    return { kind: 'compoundPath', outlines, strokeColor: '#112233', strokeWidth: 4, fillColor: '#ff0000', ...style };
}

/**
 * 図形一式を書き出し、`source`を除いたスプライトデータのJSのテキストにする。
 * @param {Array<object>} values - アイテム
 * @returns {{data: object, text: string}} スプライトデータとJSのテキスト
 */
function exportModule(values) {
    const data = JSON.parse(SpriteSerializer.stringify(SpriteSerializer.serialize(values)));
    delete data.source;
    return { data, text: CodeExporter.toModuleText(data) };
}

describe('DrawElementReader.toCompoundPathShapeData', () => {
    it('輪郭ごとの図形データの配列になり、図形になって線・塗り・太さが要素の値', () => {
        const element = compoundElement([
            squareOutline(0, 100),
            { kind: 'ellipse', x: 50, y: 50, radiusX: 10, radiusY: 10, startAngle: 0, endAngle: Math.PI * 2, closed: true },
        ]);
        const result = DrawElementReader.toCompoundPathShapeData(element);
        assert.equal(result.length, 2);
        for (const data of result) {
            const shape = ShapeFactory.fromJSON(data);
            assert.equal(shape.strokeColor, '#112233');
            assert.equal(shape.strokeWidth, 4);
            assert.equal(shape.fillColor, '#ff0000');
        }
    });

    it('塗れない形（直線・弧・今の曲線）も fillColor が要素の値', () => {
        const element = compoundElement([
            { kind: 'polyline', closed: false, points: [{ x: 0, y: 0 }, { x: 10, y: 10 }] },
            { kind: 'quadratic', points: [{ x: 0, y: 0 }, { x: 5, y: 9 }, { x: 10, y: 0 }] },
            { kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 5, startAngle: 0, endAngle: Math.PI, closed: false },
        ]);
        const result = DrawElementReader.toCompoundPathShapeData(element);
        assert.deepEqual(result.map((d) => d.fillColor), ['#ff0000', '#ff0000', '#ff0000']);
        assert.deepEqual(result.map((d) => ShapeFactory.fromJSON(d).fillColor), ['#ff0000', '#ff0000', '#ff0000']);
    });

    it('strokeColorが文字列でなければnull・strokeWidthが不正なら2・fillColorが文字列でなければnull', () => {
        const element = compoundElement([squareOutline(0, 10)], { strokeColor: 5, strokeWidth: 'x', fillColor: undefined });
        const [data] = DrawElementReader.toCompoundPathShapeData(element);
        assert.equal(data.strokeColor, null);
        assert.equal(data.strokeWidth, 2);
        assert.equal(data.fillColor, null);
    });

    it('結果の配列の要素に type 以外の作業データの語彙（compound・children）のキーが無い', () => {
        const result = DrawElementReader.toCompoundPathShapeData(compoundElement([squareOutline(0, 10)]));
        for (const data of result) {
            assert.notEqual(data.type, 'group');
            assert.equal(Object.hasOwn(data, 'compound'), false);
            assert.equal(Object.hasOwn(data, 'children'), false);
        }
    });

    it('compoundPathでない要素は null（今の kind・未知の kind・オブジェクトでない）', () => {
        assert.equal(DrawElementReader.toCompoundPathShapeData({ kind: 'polyline', points: [] }), null);
        assert.equal(DrawElementReader.toCompoundPathShapeData({ kind: 'unknown' }), null);
        assert.equal(DrawElementReader.toCompoundPathShapeData(null), null);
        assert.equal(DrawElementReader.toCompoundPathShapeData('x'), null);
        assert.equal(DrawElementReader.toCompoundPathShapeData([]), null);
    });

    it('outlinesが配列でない・空、輪郭が未知の kind・オブジェクトでない、入れ子の compoundPath は Error', () => {
        assert.throws(() => DrawElementReader.toCompoundPathShapeData({ kind: 'compoundPath' }), Error);
        assert.throws(() => DrawElementReader.toCompoundPathShapeData(compoundElement('x')), Error);
        assert.throws(() => DrawElementReader.toCompoundPathShapeData(compoundElement([])), Error);
        assert.throws(() => DrawElementReader.toCompoundPathShapeData(compoundElement([{ kind: 'unknown' }])), Error);
        assert.throws(() => DrawElementReader.toCompoundPathShapeData(compoundElement([null])), Error);
        assert.throws(() => DrawElementReader.toCompoundPathShapeData(compoundElement([compoundElement([squareOutline(0, 1)])])), Error);
    });

    it('toShapeData に compoundPath を渡すと今までどおり未知の kind の Error', () => {
        assert.throws(() => DrawElementReader.toShapeData(compoundElement([squareOutline(0, 10)])), Error);
    });

    it('引数を書き換えない', () => {
        const element = compoundElement([squareOutline(0, 100)]);
        const before = JSON.stringify(element);
        DrawElementReader.toCompoundPathShapeData(element);
        assert.equal(JSON.stringify(element), before);
    });
});

describe('DocumentSerializer.deserializeShapeElements の第3引数（複合パスのフォルダ）', () => {
    const toShape = (e) => DrawElementReader.toShapeData(e);
    const toCompound = (e) => DrawElementReader.toCompoundPathShapeData(e);
    const lineElement = { kind: 'polyline', closed: false, points: [{ x: 0, y: 0 }, { x: 9, y: 9 }], strokeColor: '#000000', strokeWidth: 2 };

    it('複合パスのフォルダ1つ（自動の名前・表示・ロックなし・compound: true）と前後の図形の並び', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements(
            [lineElement, compoundElement([squareOutline(0, 100), squareOutline(20, 80)]), lineElement], toShape, toCompound
        );
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 3);
        assert.equal(result.items[0].kind, 'shape');
        assert.equal(result.items[2].kind, 'shape');
        const folder = result.items[1];
        assert.equal(folder.kind, 'group');
        assert.equal(folder.compound, true);
        assert.equal(folder.name, 'フォルダ 1');
        assert.equal(folder.visible, true);
        assert.equal(folder.locked, false);
        assert.equal(folder.children.length, 2);
        assert.equal(folder.children.every((c) => c.kind === 'shape' && c.visible === true && c.locked === false), true);
        assert.equal(new Set(folder.children.map((c) => c.name)).size, 2);
        assert.equal(result.shapes.length, 4);
        assert.deepEqual(result.skipped, []);
    });

    it('輪郭の変換ができない要素は [position] の1件の読み飛ばし', (t) => {
        silenceWarn(t);
        const bad = compoundElement([squareOutline(0, 10), { kind: 'unknown' }]);
        const result = DocumentSerializer.deserializeShapeElements([lineElement, bad], toShape, toCompound);
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 1);
        assert.equal(result.skipped.length, 1);
        assert.deepEqual(result.skipped[0].path, [1]);
        assert.equal(result.skipped[0].index, 1);
    });

    it('図形データとして不正な輪郭はその図形だけ [position, j] の1件で読み飛ばし、残りは入る', (t) => {
        silenceWarn(t);
        const broken = { kind: 'polyline', closed: true, points: [{ x: 0, y: 0 }] };
        const element = compoundElement([squareOutline(0, 10), broken, squareOutline(2, 8)]);
        const result = DocumentSerializer.deserializeShapeElements([element], toShape, toCompound);
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].children.length, 2);
        assert.equal(result.skipped.length, 1);
        assert.deepEqual(result.skipped[0].path, [0, 1]);
    });

    it('第3引数が配列でも null でもない値を返すと [position] の1件の読み飛ばし', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements([lineElement, lineElement], toShape, (e) => (e === lineElement ? {} : null));
        assert.equal(result.items.length, 0);
        assert.deepEqual(result.skipped.map((x) => x.path), [[0], [1]]);
    });

    it('第3引数を省いた結果・読み飛ばしの記録が今と同じ（compoundPath は未知の kind で1件の読み飛ばし）', (t) => {
        silenceWarn(t);
        const withNull = DocumentSerializer.deserializeShapeElements([lineElement, compoundElement([squareOutline(0, 5)])], toShape, null);
        const omitted = DocumentSerializer.deserializeShapeElements([lineElement, compoundElement([squareOutline(0, 5)])], toShape);
        for (const result of [withNull, omitted]) {
            assert.equal(result.ok, true);
            assert.equal(result.items.length, 1);
            assert.equal(result.items[0].kind, 'shape');
            assert.deepEqual(result.skipped.map((x) => x.path), [[1]]);
        }
    });

    it('第3引数が null を返す要素は今までどおり toShapeData で読む', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements([lineElement], toShape, toCompound);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].kind, 'shape');
    });
});

describe('FileContentReader.deserializeFromText の複合パスの往復', () => {
    it('書き出して開くと複合パスのフォルダに戻り、もう一度書き出すと同じ elements・bounds', (t) => {
        silenceWarn(t);
        const a = new Rect(0, 0, 100, 100, '#111111', 3, '#ff0000');
        const b = new Ellipse(50, 50, 70, 50, 'circle', '#222222', 1, '#00ff00');
        const c = new Curve(10, 10, 60, 60, '#333333', 1, null);
        const before = new Line(200, 0, 210, 10, '#444444', 2);
        const { data, text } = exportModule([s(before), g('f', [s(a), s(b), s(c)], { compound: true })]);
        const result = FileContentReader.deserializeFromText(text);
        assert.equal(result.ok, true);
        assert.deepEqual(result.skipped, []);
        assert.equal(result.items.length, 2);
        const folder = result.items[1];
        assert.equal(folder.kind, 'group');
        assert.equal(folder.compound, true);
        assert.equal(folder.children.length, 3);
        const again = JSON.parse(SpriteSerializer.stringify(SpriteSerializer.serialize(result.items)));
        assert.deepEqual(again.elements, data.elements);
        assert.deepEqual(again.bounds, data.bounds);
    });

    it('中のフォルダは平らになり、一番下を隠して書き出すと隠した図形は戻らない', (t) => {
        silenceWarn(t);
        const a = new Rect(0, 0, 100, 100, '#111111', 3, '#ff0000');
        const b = new Rect(10, 10, 90, 90, '#222222', 1, '#00ff00');
        const c = new Rect(20, 20, 80, 80, '#333333', 1, '#0000ff');
        const { text } = exportModule([g('f', [s(a, { visible: false }), g('in', [s(b), s(c)])], { compound: true })]);
        const result = FileContentReader.deserializeFromText(text);
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 1);
        const folder = result.items[0];
        assert.equal(folder.compound, true);
        assert.equal(folder.children.length, 2);
        assert.equal(folder.children.every((child) => child.kind === 'shape'), true);
        for (const child of folder.children) {
            assert.equal(child.shape.strokeColor, '#222222');
            assert.equal(child.shape.fillColor, '#00ff00');
        }
    });

    it('普通のフォルダの図形は今までどおり平らな図形になりフォルダは戻らない', (t) => {
        silenceWarn(t);
        const a = new Rect(0, 0, 100, 100, '#111111', 3, '#ff0000');
        const { text } = exportModule([g('f', [s(a)])]);
        const result = FileContentReader.deserializeFromText(text);
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].kind, 'shape');
    });
});
