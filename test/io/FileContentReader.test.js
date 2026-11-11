/**
 * 責務: FileContentReaderが、作業データのJSON・スプライトのJSを中身で判別して図形を復元する入口として振る舞うことを検証する。
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
 * 5種の図形（line・curve・rect・circle・arc）を含む図形一式を作る（idは文字列を直接代入する）。
 * @returns {Array<object>} 図形
 */
function sampleShapesOfAllKinds() {
    const shapes = [
        new Line(1, 2, 30, 40, '#ff0000', 5),
        new Curve(0, 0, 100, 50, '#00ff00', 3),
        new Rect(10, 20, 50, 80, '#0000ff', 4),
        new Ellipse(10, 20, 40, 60, 'circle', '#123456', 4),
        new Ellipse(10, 20, 40, 60, 'arc', '#abcdef', 1),
    ];
    shapes.forEach((shape, index) => {
        shape.id = `shape-${index}`;
    });
    return shapes;
}

/**
 * 図形配列を`toJSON()`の配列へ変換する。
 * @param {Array<object>} shapes - 図形
 * @returns {Array<object>} 図形データの配列
 */
function toJsonList(shapes) {
    return shapes.map((shape) => shape.toJSON());
}

/**
 * 読み込み成功（全図形・スキップなし）の結果が、元の図形と同じ並び・内容であることを確かめる。
 * @param {import('../../js/io/DocumentSerializer.js').DeserializeResult} result - 読み込み結果
 * @param {Array<object>} original - 元の図形
 * @returns {void}
 */
function assertRestored(result, original) {
    assert.equal(result.ok, true);
    assert.equal(result.error, null);
    assert.deepStrictEqual(result.skipped, []);
    assert.deepStrictEqual(toJsonList(result.shapes), toJsonList(original));
}

/**
 * 読み込み不可の結果であること（ok=false・shapes/skippedが空）と、`console.warn`がちょうど1回であることを確かめる。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @param {string} text - 読み込むテキスト
 * @returns {void}
 */
function assertUnreadable(t, text) {
    const warn = t.mock.method(console, 'warn', () => {});
    const result = FileContentReader.deserializeFromText(text);
    assert.equal(result.ok, false);
    assert.deepStrictEqual(result.shapes, []);
    assert.deepStrictEqual(result.skipped, []);
    assert.equal(typeof result.error, 'string');
    assert.equal(warn.mock.callCount(), 1);
}

/**
 * スプライトデータの`source`を差し替えたコピーを作る。
 * @param {Array<object>} shapes - 元の図形
 * @param {function(object): void} mutate - スプライトデータ（コピー）を書き換える関数
 * @returns {object} 書き換えたスプライトデータ
 */
function mutatedSprite(shapes, mutate) {
    const data = JSON.parse(SpriteSerializer.stringify(SpriteSerializer.serialize(shapes)));
    mutate(data);
    return data;
}

/**
 * スプライトデータをJSONのテキストにする。
 * @param {object} data - スプライトデータ
 * @returns {string} JSONのテキスト
 */
function asJson(data) {
    return SpriteSerializer.stringify(data);
}

/**
 * スプライトデータをスプライトJSのテキストにする。
 * @param {object} data - スプライトデータ
 * @returns {string} JSのテキスト
 */
function asModule(data) {
    return CodeExporter.toModuleText(data);
}

describe('FileContentReader.deserializeFromText: 書き出したスプライトの読み込み', () => {
    it('スプライトのJS・CRLFのJSから元の図形が戻る（5種の図形）', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleShapesOfAllKinds();
        const data = SpriteSerializer.serialize(shapes);
        assertRestored(FileContentReader.deserializeFromText(CodeExporter.toModuleText(data)), shapes);
        assertRestored(FileContentReader.deserializeFromText(CodeExporter.toModuleText(data).replace(/\n/g, '\r\n')), shapes);
    });

    it('図形0個のスプライト（JS・CRLFのJS）はok: trueで図形0個', (t) => {
        t.mock.method(console, 'warn', () => {});
        const data = SpriteSerializer.serialize([]);
        assertRestored(FileContentReader.deserializeFromText(CodeExporter.toModuleText(data)), []);
        assertRestored(FileContentReader.deserializeFromText(CodeExporter.toModuleText(data).replace(/\n/g, '\r\n')), []);
    });
});

/**
 * 開いたパス・閉じたパスと既存の5種を混在させた図形一式を作る（idは文字列を直接代入する）。
 * @returns {Array<object>} 図形
 */
function sampleShapesWithPaths() {
    const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    const shapes = [
        new Rect(10, 20, 50, 80, '#0000ff', 4),
        new Path(square, false, '#ff0000', 3),
        new Line(1, 2, 30, 40, '#ff0000', 5),
        new Path(square, true, '#00aa00', 6),
        new Ellipse(10, 20, 40, 60, 'circle', '#123456', 4),
        new Curve(0, 0, 100, 50, '#00ff00', 3),
        new Ellipse(10, 20, 40, 60, 'arc', '#abcdef', 1),
    ];
    shapes.forEach((shape, index) => {
        shape.id = `shape-${index}`;
    });
    return shapes;
}

/**
 * 復元した図形のうちパスが`Path`のインスタンスで、`closed`・`segments`が元と一致することを確かめる。
 * @param {Array<object>} restored - 復元した図形
 * @param {Array<object>} original - 元の図形
 * @returns {void}
 */
function assertPathsRestored(restored, original) {
    assert.equal(restored.length, original.length);
    original.forEach((shape, index) => {
        if (shape.type !== 'path') {
            return;
        }
        const actual = restored[index];
        assert.ok(actual instanceof Path);
        assert.notEqual(actual, shape);
        assert.equal(actual.closed, shape.closed);
        assert.deepStrictEqual(actual.segments, shape.segments);
    });
}

describe('FileContentReader.deserializeFromText: パスを含むスプライト', () => {
    it('開いたパス・閉じたパスと既存の5種を含むJS・CRLFのJSから全図形が元どおりに戻る', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleShapesWithPaths();
        const text = CodeExporter.toModuleText(SpriteSerializer.serialize(shapes));
        for (const source of [text, text.replace(/\n/g, '\r\n')]) {
            const result = FileContentReader.deserializeFromText(source);
            assertRestored(result, shapes);
            assertPathsRestored(result.shapes, shapes);
        }
    });

    it('パスだけのスプライトのJSからも戻り、閉じたパスは閉じたまま・開いたパスは開いたまま', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleShapesWithPaths().filter((shape) => shape.type === 'path');
        assert.deepStrictEqual(shapes.map((shape) => shape.closed), [false, true]);
        const result = FileContentReader.deserializeFromText(CodeExporter.toModuleText(SpriteSerializer.serialize(shapes)));
        assertRestored(result, shapes);
        assertPathsRestored(result.shapes, shapes);
    });
});

describe('FileContentReader.deserializeFromText: 作業データファイル', () => {
    it('従来どおり読め、deserializeFromStringと同じ結果になる', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleShapesOfAllKinds();
        const text = DocumentSerializer.serializeToString(shapes);
        const viaReader = FileContentReader.deserializeFromText(text);
        const viaSerializer = DocumentSerializer.deserializeFromString(text);
        assertRestored(viaReader, shapes);
        assert.deepStrictEqual(toJsonList(viaReader.shapes), toJsonList(viaSerializer.shapes));
        assert.deepStrictEqual(viaReader.skipped, viaSerializer.skipped);
        assert.equal(viaReader.ok, viaSerializer.ok);
    });

    it('図形0個の作業データも読める', (t) => {
        t.mock.method(console, 'warn', () => {});
        assertRestored(FileContentReader.deserializeFromText(DocumentSerializer.serializeToString([])), []);
    });
});

describe('FileContentReader.deserializeFromText: 読めない図形を含むsource', () => {
    it('スプライト（JS）も作業データと同じくok: trueでskipped1件', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleShapesOfAllKinds();
        const data = mutatedSprite(shapes, (d) => {
            d.source.shapes.push({ type: 'unknown-kind' });
        });
        const workDoc = DocumentSerializer.serialize(shapes);
        workDoc.shapes.push({ type: 'unknown-kind' });
        const expected = DocumentSerializer.deserialize(workDoc);
        assert.equal(expected.skipped.length, 1);

        for (const text of [asModule(data)]) {
            const result = FileContentReader.deserializeFromText(text);
            assert.equal(result.ok, true);
            assert.equal(result.skipped.length, 1);
            assert.deepStrictEqual(result.skipped, expected.skipped);
            assert.deepStrictEqual(toJsonList(result.shapes), toJsonList(shapes));
        }
    });
});

describe('FileContentReader.deserializeFromText: 読み込み不可（警告1回・例外なし）', () => {
    it('本アプリのものではないJS・任意のテキスト・空文字列', (t) => {
        assertUnreadable(t, 'export default {};\n');
        assertUnreadable(t, 'hello world');
        assertUnreadable(t, '');
    });

    it('他のformatのJSON・壊れたJSON', (t) => {
        assertUnreadable(t, JSON.stringify({ format: 'other', version: 1, shapes: [] }));
        assertUnreadable(t, '{"format": "oz-vector-editor-sprite", ');
    });

    it('sourceが無いスプライト（JSON・JS。JSONは作業データの形式違い）', (t) => {
        const data = mutatedSprite(sampleShapesOfAllKinds(), (d) => {
            delete d.source;
        });
        assertUnreadable(t, asJson(data));
        t.mock.restoreAll();
        assertUnreadable(t, asModule(data));
    });

    it('書き出し形式の版が0・現行版+1・1.5のスプライト（JSON・JS。JSONは作業データの形式違い）', (t) => {
        const current = SpriteSerializer.serialize([]).formatVersion;
        for (const version of [0, current + 1, 1.5]) {
            const data = mutatedSprite(sampleShapesOfAllKinds(), (d) => {
                d.formatVersion = version;
            });
            assertUnreadable(t, asJson(data));
            t.mock.restoreAll();
            assertUnreadable(t, asModule(data));
            t.mock.restoreAll();
        }
    });

    it('スプライトのJSON（sourceあり。5種の図形・図形0個・CRLFのJSON）は作業データとして判定され読み込み不可', (t) => {
        const withShapes = SpriteSerializer.serialize(sampleShapesOfAllKinds());
        assertUnreadable(t, asJson(withShapes));
        t.mock.restoreAll();
        assertUnreadable(t, asJson(withShapes).replace(/\n/g, '\r\n'));
        t.mock.restoreAll();
        assertUnreadable(t, asJson(SpriteSerializer.serialize([])));
    });

    it('JSの宣言の中身がJSONでないもの（実行されない）', (t) => {
        assertUnreadable(t, "const spriteData = (() => { throw new Error('x'); })();\nexport default {};\n");
    });

    it('JSに埋め込まれたのが作業データ（スプライトでない）', (t) => {
        const work = DocumentSerializer.serialize(sampleShapesOfAllKinds());
        assertUnreadable(t, 'const spriteData = ' + JSON.stringify(work, null, 2) + ';\nexport default {};\n');
    });

    it('sourceの版が範囲外（DocumentSerializerの全体失敗・警告1回）', (t) => {
        const data = mutatedSprite(sampleShapesOfAllKinds(), (d) => {
            d.source.version = 999;
        });
        assertUnreadable(t, asJson(data));
        t.mock.restoreAll();
        assertUnreadable(t, asModule(data));
    });
});

describe('FileContentReader.deserializeFromText: 塗り・線なしを含むスプライト（書き出し形式の版2）と版1のJS', () => {
    /**
     * 塗り・線なしを含む図形一式を作る（塗れない形の`fillColor`・線なし・塗りなしを含む。idは文字列を直接代入する）。
     * @returns {Array<object>} 図形
     */
    function sampleFilledShapes() {
        const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
        const star = [{ x: 50, y: 0 }, { x: 80, y: 100 }, { x: 0, y: 40 }, { x: 100, y: 40 }, { x: 20, y: 100 }];
        const shapes = [
            new Rect(10, 20, 50, 80, '#0000ff', 4, '#ffcc00'),
            new Ellipse(10, 20, 40, 60, 'circle', null, 2, '#00ff00'),
            new Path(square, true, null, 3, '#ff00ff'),
            new Path(star, true, '#111111', 2, '#22aa22'),
            new Line(1, 2, 30, 40, '#ff0000', 5, '#abcdef'),
            new Curve(0, 0, 100, 50, '#00ff00', 3, '#fedcba'),
            new Ellipse(10, 20, 40, 60, 'arc', '#abcdef', 1, '#123456'),
            new Path(square, false, '#00aa00', 6, '#654321'),
            new Line(5, 6, 70, 80, null, 2, null),
        ];
        shapes.forEach((shape, index) => {
            shape.id = `shape-${index}`;
        });
        return shapes;
    }

    /**
     * 復元した図形の`fillColor`・`strokeColor`が元と一致することを明示的に確かめる。
     * @param {Array<object>} restored - 復元した図形
     * @param {Array<object>} original - 元の図形
     * @returns {void}
     */
    function assertStyles(restored, original) {
        assert.equal(restored.length, original.length);
        original.forEach((shape, index) => {
            assert.equal(restored[index].fillColor, shape.fillColor);
            assert.equal(restored[index].strokeColor, shape.strokeColor);
        });
    }

    /**
     * 版1の書き出し形式のスプライトデータを作る（`formatVersion`・`source.version`を1にし、`source.shapes`の`fillColor`を除く／残す）。
     * @param {Array<object>} shapes - 元の図形
     * @param {boolean} keepFillColor - `fillColor`を残すか
     * @returns {object} 版1のスプライトデータ
     */
    function makeVersion1Sprite(shapes, keepFillColor) {
        return mutatedSprite(shapes, (d) => {
            d.formatVersion = 1;
            d.source.version = 1;
            if (!keepFillColor) {
                d.source.shapes.forEach((item) => {
                    delete item.fillColor;
                });
            }
        });
    }

    it('版2のJS・CRLFのJSから、fillColor・strokeColorを含め元の図形が戻る', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleFilledShapes();
        const text = CodeExporter.toModuleText(SpriteSerializer.serialize(shapes));
        for (const source of [text, text.replace(/\n/g, '\r\n')]) {
            const result = FileContentReader.deserializeFromText(source);
            assertRestored(result, shapes);
            assertStyles(result.shapes, shapes);
            assertPathsRestored(result.shapes, shapes);
        }
    });

    it('塗れない形（直線・曲線・弧・開いたパス）のfillColorも保持して戻る', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleFilledShapes();
        const result = FileContentReader.deserializeFromText(CodeExporter.toModuleText(SpriteSerializer.serialize(shapes)));
        assert.equal(result.ok, true);
        for (const index of [4, 5, 6, 7]) {
            assert.equal(result.shapes[index].isFillable(), false);
            assert.equal(result.shapes[index].fillColor, shapes[index].fillColor);
            assert.notEqual(result.shapes[index].fillColor, null);
        }
    });

    it('版1のJS（fillColorを除いたsource）が読め、全図形がfillColor: nullになる', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleFilledShapes();
        const expected = shapes.map((shape) => ({ ...shape.toJSON(), fillColor: null }));
        const text = asModule(makeVersion1Sprite(shapes, false));
        for (const source of [text, text.replace(/\n/g, '\r\n')]) {
            const result = FileContentReader.deserializeFromText(source);
            assert.equal(result.ok, true);
            assert.equal(result.error, null);
            assert.deepStrictEqual(result.skipped, []);
            assert.deepStrictEqual(toJsonList(result.shapes), expected);
            result.shapes.forEach((shape) => assert.equal(shape.fillColor, null));
        }
    });

    it('版1のJS（fillColorを残したsource）も、全図形がfillColor: nullになる', (t) => {
        t.mock.method(console, 'warn', () => {});
        const shapes = sampleFilledShapes();
        const expected = shapes.map((shape) => ({ ...shape.toJSON(), fillColor: null }));
        const result = FileContentReader.deserializeFromText(asModule(makeVersion1Sprite(shapes, true)));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.skipped, []);
        assert.deepStrictEqual(toJsonList(result.shapes), expected);
        result.shapes.forEach((shape) => assert.equal(shape.fillColor, null));
    });
});
