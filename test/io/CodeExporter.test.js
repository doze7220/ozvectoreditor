/**
 * 責務: CodeExporterが組み立てるスプライトJSのテキストを、動的importと描画命令を記録する偽のctxを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * スプライトデータからJSのテキストを組み立て、動的importして既定のexportを返す。
 * @param {object} spriteData - スプライトデータ
 * @returns {Promise<object>} 既定のexport
 */
async function importSprite(spriteData) {
    const text = CodeExporter.toModuleText(spriteData);
    const module = await import('data:text/javascript,' + encodeURIComponent(text));
    return module.default;
}

/**
 * メソッド呼び出しとプロパティ代入を順に記録する偽のctxを作る。
 * @returns {{ctx: object, log: Array<Array<*>>}} 偽のctxと記録（要素は[名前, ...引数]または['set:名前', 値]）
 */
function createRecordingCtx() {
    const log = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'ellipse', 'closePath', 'stroke', 'save', 'restore', 'setLineDash']) {
        ctx[name] = (...args) => {
            log.push([name, ...args]);
        };
    }
    for (const name of ['strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit']) {
        Object.defineProperty(ctx, name, {
            set(value) {
                log.push([`set:${name}`, value]);
            },
            get() {
                return undefined;
            },
        });
    }
    return { ctx, log };
}

/**
 * 図形の配列をエディタの`draw`で描いた記録を返す。
 * @param {Array<object>} shapes - 図形
 * @returns {Array<Array<*>>} 記録
 */
function recordEditorDraw(shapes) {
    const { ctx, log } = createRecordingCtx();
    for (const shape of shapes) {
        shape.draw(ctx);
    }
    return log;
}

/**
 * 書き出したJSの`draw`で描いた記録を返す。
 * @param {object} sprite - 既定のexport
 * @returns {Array<Array<*>>} 記録
 */
function recordExportedDraw(sprite) {
    const { ctx, log } = createRecordingCtx();
    sprite.draw(ctx);
    return log;
}

/**
 * 書き出しの`draw`が出すはずの記録（前置きの設定・エディタの記録・restore）を作る。
 * @param {Array<Array<*>>} editorLog - エディタの描画の記録
 * @returns {Array<Array<*>>} 期待する記録
 */
function expectedExportLog(editorLog) {
    return [
        ['save'],
        ['set:lineCap', 'butt'],
        ['set:lineJoin', 'miter'],
        ['set:miterLimit', 10],
        ['setLineDash', []],
        ...editorLog,
        ['restore'],
    ];
}

/**
 * 図形の配列について、エディタの描画と書き出しの描画の一致を確かめる。
 * @param {Array<object>} shapes - 図形
 * @returns {Promise<void>}
 */
async function assertSameAsEditor(shapes) {
    const sprite = await importSprite(SpriteSerializer.serialize(shapes));
    assert.deepStrictEqual(recordExportedDraw(sprite), expectedExportLog(recordEditorDraw(shapes)));
}

/**
 * 空のスプライトデータへ、手で組み立てた描画要素を入れたスプライトデータを作る。
 * @param {Array<object>} elements - 描画要素
 * @returns {object} スプライトデータ
 */
function dataWithElements(elements) {
    const data = SpriteSerializer.serialize([]);
    data.elements = elements;
    return data;
}

describe('CodeExporter.toModuleText: テキストとexport', () => {
    it('末尾が改行で、import文を含まない', () => {
        const text = CodeExporter.toModuleText(SpriteSerializer.serialize([new Line(0, 0, 10, 10)]));
        assert.ok(text.endsWith('\n'));
        assert.equal(/^\s*import[\s{*("']/m.test(text), false);
    });

    it('既定のexportのみを持つ', async () => {
        const text = CodeExporter.toModuleText(SpriteSerializer.serialize([new Line(0, 0, 10, 10)]));
        const module = await import('data:text/javascript,' + encodeURIComponent(text));
        assert.deepEqual(Object.keys(module), ['default']);
        assert.equal(typeof module.default.draw, 'function');
    });

    it('既定のexportからdrawを除いたものがスプライトデータのJSONと同じ', async () => {
        const data = SpriteSerializer.serialize([
            new Line(0, 0, 10, 10),
            new Ellipse(10, 20, 40, 60, 'arc'),
        ]);
        const sprite = await importSprite(data);
        const { draw, ...rest } = sprite;
        assert.equal(typeof draw, 'function');
        assert.deepStrictEqual(JSON.parse(JSON.stringify(rest)), JSON.parse(SpriteSerializer.stringify(data)));
        assert.deepEqual(Object.keys(rest), ['format', 'formatVersion', 'bounds', 'elements', 'source']);
    });

    it('drawはthisを使わず、取り出して呼んでも動く', async () => {
        const sprite = await importSprite(SpriteSerializer.serialize([new Line(0, 0, 10, 10)]));
        const { draw } = sprite;
        const { ctx, log } = createRecordingCtx();
        draw(ctx);
        assert.equal(log[0][0], 'save');
        assert.equal(log[log.length - 1][0], 'restore');
    });
});

describe('CodeExporter.toModuleText: 見た目の一致（描画命令の記録の比較）', () => {
    it('line', async () => {
        await assertSameAsEditor([new Line(1, 2, 30, 40, '#ff0000', 5)]);
    });

    it('curve', async () => {
        await assertSameAsEditor([new Curve(0, 0, 100, 50, '#00ff00', 3)]);
    });

    it('rect', async () => {
        await assertSameAsEditor([new Rect(10, 20, 50, 80, '#0000ff', 4)]);
    });

    it('circle', async () => {
        await assertSameAsEditor([new Ellipse(10, 20, 40, 60, 'circle', '#123456', 4)]);
    });

    it('arc', async () => {
        await assertSameAsEditor([new Ellipse(10, 20, 40, 60, 'arc', '#abcdef', 1)]);
    });

    it('混在（描画順を保つ）', async () => {
        await assertSameAsEditor([
            new Rect(0, 0, 5, 5, '#111111', 1),
            new Ellipse(10, 20, 40, 60, 'circle'),
            new Line(0, 0, 10, 10, '#222222', 7),
            new Curve(0, 0, 30, 30),
            new Ellipse(5, 5, 25, 15, 'arc', '#333333', 3),
        ]);
    });

    it('頂点を動かした図形', async () => {
        const curve = new Curve(0, 0, 100, 50);
        curve.setVertex(1, 70, -30);
        const rect = new Rect(0, 0, 40, 40);
        rect.setVertex(2, 90, 70);
        const circle = new Ellipse(10, 20, 40, 60, 'circle');
        circle.setVertex(1, 80, 20);
        const arc = new Ellipse(10, 20, 40, 60, 'arc');
        arc.setVertex(2, 10, -50);
        await assertSameAsEditor([curve, rect, circle, arc]);
    });
});

describe('CodeExporter.toModuleText: 図形0個・規則', () => {
    it('図形0個ではsave・設定・restoreのみで、パスもstrokeも呼ばない', async () => {
        const sprite = await importSprite(SpriteSerializer.serialize([]));
        const log = recordExportedDraw(sprite);
        assert.deepStrictEqual(log, expectedExportLog([]));
        assert.equal(sprite.bounds, null);
        assert.deepEqual(sprite.elements, []);
    });

    it('strokeWidthの無い要素をlineWidth = 2で描く', async () => {
        const line = new Line(0, 0, 10, 10, '#000000', 2);
        line.strokeWidth = undefined;
        const sprite = await importSprite(SpriteSerializer.serialize([line]));
        const log = recordExportedDraw(sprite);
        assert.deepEqual(log.filter((entry) => entry[0] === 'set:lineWidth'), [['set:lineWidth', 2]]);
    });

    it('strokeWidthが正の有限の数値でない要素は2で描く', async () => {
        const base = { kind: 'polyline', id: 'x', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false, strokeColor: '#000000' };
        const sprite = await importSprite(dataWithElements([
            { ...base, strokeWidth: 0 },
            { ...base, strokeWidth: -3 },
            { ...base, strokeWidth: Number.NaN },
            { ...base, strokeWidth: '5' },
            { ...base, strokeWidth: 6 },
        ]));
        const widths = recordExportedDraw(sprite).filter((e) => e[0] === 'set:lineWidth').map((e) => e[1]);
        assert.deepEqual(widths, [2, 2, 2, 2, 6]);
    });

    it('未知のkindの要素を描かない', async () => {
        const sprite = await importSprite(dataWithElements([
            { kind: 'unknown-kind', id: 'u', strokeColor: '#000000', strokeWidth: 2 },
        ]));
        assert.deepStrictEqual(recordExportedDraw(sprite), expectedExportLog([]));
    });

    it('strokeColorが文字列でない要素は線を描かない（線のパスとstroke()を呼ばない）', async () => {
        const sprite = await importSprite(dataWithElements([
            { kind: 'polyline', id: 'p', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false, strokeColor: 5, strokeWidth: 2 },
            { kind: 'quadratic', id: 'q', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }], strokeWidth: 2 },
            { kind: 'ellipse', id: 'e', x: 0, y: 0, radiusX: 1, radiusY: 1, startAngle: 0, endAngle: 6, closed: true, strokeColor: null, strokeWidth: 2 },
        ]));
        assert.deepStrictEqual(recordExportedDraw(sprite), expectedExportLog([]));
    });

    it('形の項目が足りない要素は描かない', async () => {
        const color = { strokeColor: '#000000', strokeWidth: 2 };
        const sprite = await importSprite(dataWithElements([
            { kind: 'polyline', id: 'a', points: [{ x: 0, y: 0 }], closed: false, ...color },
            { kind: 'polyline', id: 'b', closed: false, ...color },
            { kind: 'quadratic', id: 'c', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], ...color },
            { kind: 'ellipse', id: 'd', x: 0, y: 0, radiusX: -1, radiusY: 1, startAngle: 0, endAngle: 1, closed: false, ...color },
            { kind: 'ellipse', id: 'e', x: 0, y: 0, radiusX: Number.NaN, radiusY: 1, startAngle: 0, endAngle: 1, closed: false, ...color },
            { kind: 'ellipse', id: 'f', x: 0, y: 0, radiusX: 1, startAngle: 0, endAngle: 1, closed: false, ...color },
        ]));
        assert.deepStrictEqual(recordExportedDraw(sprite), expectedExportLog([]));
    });

    it('未知のキーは無視して描く', async () => {
        const sprite = await importSprite({
            ...dataWithElements([
                { kind: 'polyline', id: 'a', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], closed: false, strokeColor: '#000000', strokeWidth: 2, extra: 1 },
            ]),
            futureKey: 'x',
        });
        const log = recordExportedDraw(sprite);
        assert.deepStrictEqual(log.filter((e) => e[0] === 'stroke').length, 1);
    });

    it('drawの途中で例外が出てもrestoreを呼ぶ', async () => {
        const sprite = await importSprite(SpriteSerializer.serialize([new Line(0, 0, 10, 10)]));
        const { ctx, log } = createRecordingCtx();
        ctx.moveTo = () => {
            throw new Error('boom');
        };
        assert.throws(() => sprite.draw(ctx), /boom/);
        assert.equal(log[log.length - 1][0], 'restore');
    });
});

describe('CodeExporter.toModuleText: 利用者の入力の埋め込み', () => {
    it('strokeColorに引用符・</script>・改行・U+2028等を含めてもコードとして解釈されず、値がそのまま戻る', async () => {
        const nasty = '"\'`${1+1}\\</script>\n\r  */ };globalThis.__pwned = 1; //';
        const line = new Line(0, 0, 10, 10, nasty, 2);
        const sprite = await importSprite(SpriteSerializer.serialize([line]));
        assert.equal(sprite.elements[0].strokeColor, nasty);
        assert.equal(sprite.source.shapes[0].strokeColor, nasty);
        assert.equal(globalThis.__pwned, undefined);
        const strokeStyles = recordExportedDraw(sprite).filter((e) => e[0] === 'set:strokeStyle');
        assert.deepEqual(strokeStyles, [['set:strokeStyle', nasty]]);
    });
});
