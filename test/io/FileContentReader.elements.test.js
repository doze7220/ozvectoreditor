/**
 * 責務: FileContentReaderが、`source`の無いスプライトのJS（新しいJS）を`elements`から組み立て、
 * `source`のあるJS（今までのJS）を今までどおり`source`だけから戻すことを、公開APIだけで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FileContentReader } from '../../js/io/FileContentReader.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック（呼び出し回数の確認に使う）
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 図形一式を書き出し、`source`のキーを（あってもなくても同じ結果になる形で）除いたスプライトデータを作る。
 * @param {Array<object>} values - 図形（またはアイテム）
 * @returns {object} `source`の無いスプライトデータ
 */
function spriteWithoutSource(values) {
    const data = JSON.parse(SpriteSerializer.stringify(SpriteSerializer.serialize(values)));
    delete data.source;
    return data;
}

/**
 * 描画要素から`id`のキーを（あってもなくても同じ結果になる形で）除いたコピーを作る。
 * @param {object} data - スプライトデータ
 * @returns {object} 描画要素から`id`を除いたスプライトデータ
 */
function withoutElementIds(data) {
    const copy = JSON.parse(JSON.stringify(data));
    for (const element of copy.elements) {
        delete element.id;
    }
    return copy;
}

/**
 * 描画要素へ`id`を明示的に足したコピーを作る。
 * @param {object} data - スプライトデータ
 * @returns {object} 描画要素に`id`を足したスプライトデータ
 */
function withElementIds(data) {
    const copy = JSON.parse(JSON.stringify(data));
    copy.elements.forEach((element, index) => {
        element.id = `added-${index + 100}`;
    });
    return copy;
}

/**
 * 今までのJSの形（`source`入り）のスプライトデータを作る（書き出しの戻り値の`source`は読まない）。
 * @param {Array<object>} values - 図形（またはアイテム）
 * @returns {object} `source`を持つスプライトデータ
 */
function withSource(values) {
    return { ...SpriteSerializer.serialize(values), source: DocumentSerializer.serialize(values) };
}

/**
 * スプライトデータをスプライトJSのテキストにする。
 * @param {object} data - スプライトデータ
 * @returns {string} JSのテキスト
 */
function asModule(data) {
    return CodeExporter.toModuleText(data);
}

/**
 * 図形のid以外の`toJSON()`の内容を返す（組み立てた図形のidは未設定のため、idを除いて比べる）。
 * @param {object} shape - 図形
 * @returns {object} idを除いた図形データ
 */
function jsonWithoutId(shape) {
    const json = shape.toJSON();
    delete json.id;
    return json;
}

/**
 * 5種の図形（line・curve・rect・circle・arc）と開いた／閉じたパスを含む図形一式を作る。
 * @returns {Array<object>} 図形
 */
function sampleShapes() {
    const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const shapes = [
        new Line(1, 2, 30, 40, '#ff0000', 5),
        new Curve(0, 0, 100, 50, '#00ff00', 3),
        new Rect(10, 20, 50, 80, '#0000ff', 4, '#ffcc00'),
        new Ellipse(10, 20, 40, 60, 'circle', '#123456', 4, '#00ff00'),
        new Ellipse(10, 20, 40, 60, 'arc', '#abcdef', 1),
        new Path(square, false, '#111111', 3),
        new Path(square, true, '#222222', 2, '#ff00ff'),
    ];
    shapes.forEach((shape, index) => {
        shape.id = `shape-${index}`;
    });
    return shapes;
}

/**
 * 文字どおりの描画要素（開いた2点の折れ線・閉じた3点の折れ線）を並べたスプライトデータ（`source`なし）を作る。
 * @returns {object} スプライトデータ
 */
function literalSprite() {
    return {
        format: 'oz-vector-editor-sprite',
        formatVersion: 4,
        bounds: { x: 0, y: 0, width: 10, height: 10 },
        elements: [
            { kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, strokeColor: '#112233', strokeWidth: 2, fillColor: null },
            { kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true, strokeColor: null, strokeWidth: 1, fillColor: '#445566' },
        ],
    };
}

describe('FileContentReader: sourceの無いJS（新しいJS）の組み立て', () => {
    it('種類ごとに図形が組み立てられ、書き出し直すと同じ描画要素になる（idの有無に依らない）', (t) => {
        silenceWarn(t);
        const shapes = sampleShapes();
        const data = withoutElementIds(spriteWithoutSource(shapes));
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepStrictEqual(result.skipped, []);
        assert.deepStrictEqual(result.shapes.map((s) => s.type), ['line', 'curve', 'path', 'circle', 'arc', 'path', 'path']);
        for (const index of [0, 1, 5, 6]) {
            assert.deepStrictEqual(jsonWithoutId(result.shapes[index]), jsonWithoutId(shapes[index]));
        }
        const again = withoutElementIds(SpriteSerializer.serialize(result.shapes));
        assert.deepStrictEqual(again.bounds, data.bounds);
        assert.equal(again.elements.length, data.elements.length);
        for (const index of [0, 1, 2, 5, 6]) {
            assert.deepStrictEqual(again.elements[index], data.elements[index]);
        }
    });

    it('描画要素にidを足しても同じ図形になり、足したidは図形へ移らない', (t) => {
        silenceWarn(t);
        const base = withoutElementIds(spriteWithoutSource(sampleShapes()));
        const plain = FileContentReader.deserializeFromText(asModule(base));
        const withIds = FileContentReader.deserializeFromText(asModule(withElementIds(base)));
        assert.equal(withIds.ok, true);
        assert.deepStrictEqual(withIds.shapes.map(jsonWithoutId), plain.shapes.map(jsonWithoutId));
        assert.ok(withIds.shapes.every((shape) => shape.id === undefined || !String(shape.id).startsWith('added-')));
    });

    it('名前は自動・表示は表示・ロックは外れ、フォルダは戻らない', (t) => {
        silenceWarn(t);
        const inner = new Line(0, 0, 10, 10);
        inner.id = 'shape-1';
        const outer = new Rect(0, 0, 10, 10);
        outer.id = 'shape-2';
        const items = [
            { kind: 'group', id: 'group-1', name: '親', visible: true, locked: true, children: [
                { kind: 'shape', shape: inner, name: '中', visible: true, locked: true },
            ] },
            { kind: 'shape', shape: outer, name: '外', visible: true, locked: true },
        ];
        const data = withoutElementIds(spriteWithoutSource(items));
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.equal(result.items.length, 2);
        assert.ok(result.items.every((item) => item.kind === 'shape'));
        assert.deepStrictEqual(result.items.map((item) => [item.visible, item.locked]), [[true, false], [true, false]]);
        assert.ok(result.items.every((item) => typeof item.name === 'string' && item.name !== '中' && item.name !== '外' && item.name !== ''));
        assert.equal(new Set(result.items.map((item) => item.name)).size, 2);
    });

    it('CRLFのJSも読める', (t) => {
        silenceWarn(t);
        const text = asModule(literalSprite()).replace(/\n/g, '\r\n');
        const result = FileContentReader.deserializeFromText(text);
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 2);
        assert.deepStrictEqual(result.skipped, []);
    });

    it('版1〜3の形（formatVersionが1〜3・fillColor／rotationのキーが無い）のsourceの無いJS', (t) => {
        silenceWarn(t);
        for (const version of [1, 2, 3]) {
            const data = literalSprite();
            data.formatVersion = version;
            for (const element of data.elements) {
                delete element.fillColor;
            }
            data.elements.push({ kind: 'ellipse', x: 5, y: 5, radiusX: 4, radiusY: 4, startAngle: 0, endAngle: 2 * Math.PI, closed: true, strokeColor: '#000000', strokeWidth: 1 });
            const result = FileContentReader.deserializeFromText(asModule(data));
            assert.equal(result.ok, true, `版${version}`);
            assert.deepStrictEqual(result.skipped, []);
            assert.deepStrictEqual(result.shapes.map((s) => s.type), ['line', 'path', 'circle']);
            assert.equal(result.shapes[1].fillColor, null);
            assert.equal(result.shapes[2].fillColor, null);
        }
    });

    it('線なし・塗りなし・太さの不正が描画と同じ読み方になる', (t) => {
        silenceWarn(t);
        const data = literalSprite();
        data.elements[0].strokeColor = null;
        data.elements[0].strokeWidth = -3;
        data.elements[1].fillColor = 5;
        data.elements[1].strokeWidth = 0;
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes[0].strokeColor, null);
        assert.equal(result.shapes[1].fillColor, null);
        assert.ok(result.shapes[0].strokeWidth > 0);
        assert.equal(result.shapes[0].strokeWidth, result.shapes[1].strokeWidth);
    });
});

describe('FileContentReader: sourceの無いJSの読み飛ばしと読み込み不可', () => {
    it('読めない要素だけを飛ばす（未知のkind・項目の不足・表に当てはまらない円弧・点の数の不足・オブジェクトでない）', (t) => {
        const warn = silenceWarn(t);
        const data = literalSprite();
        data.elements.push(
            { kind: 'star', points: [], strokeColor: '#000000', strokeWidth: 1 },
            { kind: 'polyline', closed: false, strokeColor: '#000000', strokeWidth: 1, fillColor: null },
            { kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 5, rotation: 0, startAngle: 0, endAngle: 1, closed: false, strokeColor: '#000000', strokeWidth: 1, fillColor: null },
            { kind: 'polyline', points: [{ x: 0, y: 0 }], closed: false, strokeColor: '#000000', strokeWidth: 1, fillColor: null },
            'not-an-object',
        );
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.equal(result.shapes.length, 2);
        assert.equal(result.skipped.length, 5);
        assert.deepStrictEqual(result.skipped.map((s) => s.index), [2, 3, 4, 5, 6]);
        assert.equal(warn.mock.callCount(), 5);
    });

    it('すべて読めなくてもok: trueで図形0個・件数どおりの読み飛ばし', (t) => {
        const warn = silenceWarn(t);
        const data = literalSprite();
        data.elements = [{ kind: 'unknown' }, 1, null];
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.shapes, []);
        assert.equal(result.skipped.length, 3);
        assert.equal(warn.mock.callCount(), 3);
    });

    it('elementsが配列でない（無い・null・オブジェクト）は読み込み不可・警告1回', (t) => {
        for (const mutate of [(d) => { delete d.elements; }, (d) => { d.elements = null; }, (d) => { d.elements = {}; }]) {
            const warn = silenceWarn(t);
            const data = literalSprite();
            mutate(data);
            const result = FileContentReader.deserializeFromText(asModule(data));
            assert.equal(result.ok, false);
            assert.deepStrictEqual(result.items, []);
            assert.deepStrictEqual(result.shapes, []);
            assert.deepStrictEqual(result.skipped, []);
            assert.equal(typeof result.error, 'string');
            assert.equal(warn.mock.callCount(), 1);
            t.mock.restoreAll();
        }
    });

    it('elementsが空ならok: trueで図形0個', (t) => {
        const warn = silenceWarn(t);
        const data = literalSprite();
        data.elements = [];
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.shapes, []);
        assert.deepStrictEqual(result.items, []);
        assert.deepStrictEqual(result.skipped, []);
        assert.equal(warn.mock.callCount(), 0);
    });
});

describe('FileContentReader: sourceのあるJS（今までのJS）', () => {
    it('sourceがあればelementsを空・別の形にしてもsourceから戻る', (t) => {
        silenceWarn(t);
        const shapes = sampleShapes();
        for (const elements of [[], 'broken', null, [{ kind: 'unknown' }]]) {
            const data = withSource(shapes);
            data.elements = elements;
            const result = FileContentReader.deserializeFromText(asModule(data));
            assert.equal(result.ok, true);
            assert.deepStrictEqual(result.skipped, []);
            assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), shapes.map((s) => s.toJSON()));
        }
    });

    it('sourceがnull・文字列・版違い・shapesなしなら読み込み不可（elementsから組み立てない）', (t) => {
        const badSources = [null, 'text', { format: 'oz-vector-editor', version: 999, shapes: [] }, { format: 'oz-vector-editor', version: 4 }];
        for (const source of badSources) {
            const warn = silenceWarn(t);
            const data = { ...literalSprite(), source };
            const result = FileContentReader.deserializeFromText(asModule(data));
            assert.equal(result.ok, false);
            assert.deepStrictEqual(result.shapes, []);
            assert.deepStrictEqual(result.skipped, []);
            assert.equal(warn.mock.callCount(), 1);
            t.mock.restoreAll();
        }
    });

    it('文字どおりの今までのJS（版2。idとsourceを持つ）はsourceから戻る', (t) => {
        silenceWarn(t);
        const data = {
            format: 'oz-vector-editor-sprite',
            formatVersion: 2,
            bounds: { x: 0, y: 0, width: 10, height: 0 },
            elements: [
                { kind: 'polyline', id: 'shape-1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], closed: false, strokeColor: '#112233', strokeWidth: 2, fillColor: null },
            ],
            source: {
                format: 'oz-vector-editor',
                version: 2,
                shapes: [
                    { type: 'line', id: 'shape-1', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }], strokeColor: '#112233', strokeWidth: 2, fillColor: null },
                    { type: 'line', id: 'shape-2', points: [{ x: 0, y: 5 }, { x: 10, y: 5 }], strokeColor: '#445566', strokeWidth: 3, fillColor: null },
                ],
            },
        };
        const result = FileContentReader.deserializeFromText(asModule(data));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.skipped, []);
        assert.equal(result.shapes.length, 2);
        assert.deepStrictEqual(result.shapes.map((s) => s.id), ['shape-1', 'shape-2']);
        assert.equal(result.shapes[1].strokeColor, '#445566');
    });
});
