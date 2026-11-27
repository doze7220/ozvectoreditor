/**
 * 責務: CodeExporterが書き出すJSの`draw`の`compoundPath`（複数の輪郭を`evenodd`で塗る1つの要素）の描き方を、
 * 動的importと描画命令を記録する偽のctxで検証し、エディタの`drawCompoundPath`の命令と揃っていることを確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { drawCompoundPath } from '../../js/core/CompoundPathRenderer.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';

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
 * @returns {{ctx: object, log: Array<Array<*>>}} 偽のctxと記録
 */
function createRecordingCtx() {
    const log = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse', 'closePath', 'fill', 'stroke', 'save', 'restore', 'setLineDash']) {
        ctx[name] = (...args) => {
            log.push([name, ...args]);
        };
    }
    for (const name of ['fillStyle', 'strokeStyle', 'lineWidth', 'lineCap', 'lineJoin', 'miterLimit']) {
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
 * 書き出しの`draw`が出すはずの記録（前置きの設定・中身・restore）を作る。
 * @param {Array<Array<*>>} body - 要素の描画の記録
 * @returns {Array<Array<*>>} 期待する記録
 */
function expectedExportLog(body) {
    return [
        ['save'],
        ['set:lineCap', 'butt'],
        ['set:lineJoin', 'miter'],
        ['set:miterLimit', 10],
        ['setLineDash', []],
        ...body,
        ['restore'],
    ];
}

/**
 * 描画要素を書き出したJSの`draw`で描いた記録を返す。
 * @param {object[]} elements - 描画要素
 * @returns {Promise<Array<Array<*>>>} 記録
 */
async function recordExported(elements) {
    const data = SpriteSerializer.serialize([]);
    data.elements = elements;
    const sprite = await importSprite(data);
    const { ctx, log } = createRecordingCtx();
    sprite.draw(ctx);
    return log;
}

/**
 * 図形の`toDrawElement()`からスタイルの3キーを除いた輪郭を作る。
 * @param {object} shape - 図形
 * @returns {object} 輪郭
 */
function outlineOf(shape) {
    const { strokeColor, strokeWidth, fillColor, ...outline } = shape.toDrawElement();
    return outline;
}

/**
 * 同じ複合パスを、エディタの`drawCompoundPath`と書き出したJSの`draw`で描いて記録が一致することを確かめる。
 * @param {object[]} shapes - 中の図形
 * @param {{strokeColor: *, strokeWidth: *, fillColor: *}} style - 複合パスのスタイル
 * @returns {Promise<Array<Array<*>>>} 書き出したJSの`draw`の記録（前置きを除く本体）
 */
async function assertSameAsRenderer(shapes, style) {
    const editor = createRecordingCtx();
    drawCompoundPath(editor.ctx, { shapes, style });
    const element = { kind: 'compoundPath', outlines: shapes.map(outlineOf), ...style };
    const exported = await recordExported([element]);
    assert.deepStrictEqual(exported, expectedExportLog(editor.log));
    return editor.log;
}

const STYLE = { strokeColor: '#112233', strokeWidth: 3, fillColor: '#abcdef' };
const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

describe('CodeExporter: compoundPathの命令の順（エディタのdrawCompoundPathと同じ）', () => {
    it('円と円（同心の穴）', async () => {
        const log = await assertSameAsRenderer([
            new Ellipse(50, 50, 90, 50, 'circle'),
            new Ellipse(50, 50, 70, 50, 'circle'),
        ], STYLE);
        assert.deepStrictEqual(log.map((entry) => entry[0]), [
            'beginPath', 'moveTo', 'ellipse', 'closePath', 'moveTo', 'ellipse', 'closePath',
            'set:fillStyle', 'fill', 'set:strokeStyle', 'set:lineWidth', 'stroke',
        ]);
        assert.deepStrictEqual(log[log.findIndex((entry) => entry[0] === 'fill')], ['fill', 'evenodd']);
    });

    it('弧', async () => {
        await assertSameAsRenderer([new Ellipse(10, 20, 40, 60, 'arc'), new Rect(0, 0, 5, 5)], STYLE);
    });

    it('矩形と矩形', async () => {
        await assertSameAsRenderer([new Rect(0, 0, 100, 100), new Rect(20, 20, 60, 60)], STYLE);
    });

    it('曲線（今の曲線）と直線の組み合わせ', async () => {
        await assertSameAsRenderer([new Curve(0, 0, 100, 50), new Line(0, 0, 50, 50), new Rect(5, 5, 30, 30)], STYLE);
    });

    it('パス（開いた・閉じた・曲線）', async () => {
        const pts = [{ x: 0, y: 0 }, { x: 100, y: 20 }, { x: 80, y: 90 }, { x: 10, y: 60 }];
        await assertSameAsRenderer([
            new Path(square, false),
            new Path(square, true),
            new Path(pts, true, '#000000', 2, null, SEGMENT_KIND_SMOOTH),
            new Path(pts, false, '#000000', 2, null, SEGMENT_KIND_SMOOTH),
        ], STYLE);
    });

    it('塗りなし（線だけ。fillStyleもfillも出ない）', async () => {
        const log = await assertSameAsRenderer([new Rect(0, 0, 10, 10), new Rect(2, 2, 6, 6)], { ...STYLE, fillColor: null });
        assert.equal(log.some((entry) => entry[0] === 'fill' || entry[0] === 'set:fillStyle'), false);
        assert.equal(log.some((entry) => entry[0] === 'stroke'), true);
    });

    it('線なし（塗りだけ。strokeStyle・lineWidth・strokeが出ない）', async () => {
        const log = await assertSameAsRenderer([new Rect(0, 0, 10, 10), new Rect(2, 2, 6, 6)], { ...STYLE, strokeColor: null });
        assert.equal(log.some((entry) => entry[0] === 'stroke' || entry[0] === 'set:strokeStyle'), false);
        assert.equal(log.some((entry) => entry[0] === 'fill'), true);
    });

    it('塗りも線も無ければ何も描かない（beginPathも出ない）', async () => {
        const log = await recordExported([{
            kind: 'compoundPath', outlines: [outlineOf(new Rect(0, 0, 10, 10))], strokeColor: null, strokeWidth: 2, fillColor: null,
        }]);
        assert.deepStrictEqual(log, expectedExportLog([]));
    });

    it('回した楕円の輪郭は始点（回転を掛けた位置）へmoveToしてからellipseを呼ぶ', async () => {
        const rotation = 0.5;
        const outline = {
            kind: 'ellipse', x: 10, y: 20, radiusX: 40, radiusY: 20, rotation, startAngle: 0.3, endAngle: 5, closed: false,
        };
        const log = await recordExported([{ kind: 'compoundPath', outlines: [outline], strokeColor: '#000000', strokeWidth: 2, fillColor: '#ffffff' }]);
        const ex = 40 * Math.cos(0.3);
        const ey = 20 * Math.sin(0.3);
        const startX = 10 + ex * Math.cos(rotation) - ey * Math.sin(rotation);
        const startY = 20 + ex * Math.sin(rotation) + ey * Math.cos(rotation);
        assert.deepStrictEqual(log, expectedExportLog([
            ['beginPath'],
            ['moveTo', startX, startY],
            ['ellipse', 10, 20, 40, 20, rotation, 0.3, 5],
            ['set:fillStyle', '#ffffff'],
            ['fill', 'evenodd'],
            ['set:strokeStyle', '#000000'],
            ['set:lineWidth', 2],
            ['stroke'],
        ]));
    });

    it('rotationが無い楕円の輪郭は0として描く', async () => {
        const outline = { kind: 'ellipse', x: 10, y: 20, radiusX: 40, radiusY: 20, startAngle: 0, endAngle: 6, closed: true };
        const log = await recordExported([{ kind: 'compoundPath', outlines: [outline], strokeColor: '#000000', strokeWidth: 2, fillColor: null }]);
        assert.deepStrictEqual(log.slice(5, 9), [['beginPath'], ['moveTo', 50, 20], ['ellipse', 10, 20, 40, 20, 0, 0, 6], ['closePath']]);
    });

    it('開いた輪郭も（closedによらず）塗る。線は開いたまま', async () => {
        const log = await recordExported([{
            kind: 'compoundPath',
            outlines: [{ kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: false }],
            strokeColor: '#000000', strokeWidth: 2, fillColor: '#ff0000',
        }]);
        const names = log.map((entry) => entry[0]);
        assert.equal(names.includes('closePath'), false);
        assert.deepStrictEqual(log.find((entry) => entry[0] === 'fill'), ['fill', 'evenodd']);
    });

    it('strokeWidthが数値でなければ既定の太さ', async () => {
        const log = await recordExported([{
            kind: 'compoundPath', outlines: [outlineOf(new Rect(0, 0, 10, 10))], strokeColor: '#000000', fillColor: null,
        }]);
        const widths = log.filter((entry) => entry[0] === 'set:lineWidth');
        assert.deepStrictEqual(widths, [['set:lineWidth', 2]]);
    });
});

describe('CodeExporter: compoundPathで何も描かない場合', () => {
    const goodOutline = () => outlineOf(new Rect(0, 0, 10, 10));
    const style = { strokeColor: '#000000', strokeWidth: 2, fillColor: '#ff0000' };

    /**
     * 要素1つを描いても何も記録されない（前置きとrestoreだけ）ことを確かめる。
     * @param {object} element - 描画要素
     * @returns {Promise<void>}
     */
    async function assertDrawsNothing(element) {
        assert.deepStrictEqual(await recordExported([element]), expectedExportLog([]));
    }

    it('outlinesが空', async () => {
        await assertDrawsNothing({ kind: 'compoundPath', outlines: [], ...style });
    });

    it('outlinesが配列でない・無い', async () => {
        await assertDrawsNothing({ kind: 'compoundPath', outlines: 'x', ...style });
        await assertDrawsNothing({ kind: 'compoundPath', ...style });
    });

    it('輪郭の1つが形の項目不足（点1つのpolyline）なら、ほかが正しくても何も描かない', async () => {
        await assertDrawsNothing({
            kind: 'compoundPath', outlines: [goodOutline(), { kind: 'polyline', points: [{ x: 0, y: 0 }], closed: true }], ...style,
        });
    });

    it('輪郭の1つが区間の数の合わないbezierPath', async () => {
        await assertDrawsNothing({
            kind: 'compoundPath',
            outlines: [goodOutline(), { kind: 'bezierPath', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 0 }], segments: [{ kind: 'line' }], closed: true }],
            ...style,
        });
    });

    it('輪郭の1つが半径の負のellipse', async () => {
        await assertDrawsNothing({
            kind: 'compoundPath',
            outlines: [goodOutline(), { kind: 'ellipse', x: 0, y: 0, radiusX: -1, radiusY: 5, rotation: 0, startAngle: 0, endAngle: 6, closed: true }],
            ...style,
        });
    });

    it('未知のkindの輪郭・オブジェクトでない輪郭', async () => {
        await assertDrawsNothing({ kind: 'compoundPath', outlines: [goodOutline(), { kind: 'star' }], ...style });
        await assertDrawsNothing({ kind: 'compoundPath', outlines: [goodOutline(), null], ...style });
    });

    it('入れ子のcompoundPathの輪郭', async () => {
        await assertDrawsNothing({
            kind: 'compoundPath', outlines: [goodOutline(), { kind: 'compoundPath', outlines: [goodOutline()], ...style }], ...style,
        });
    });
});

describe('CodeExporter: compoundPath以外は今までと同じ', () => {
    it('compoundPathと今のkindの要素が並んでも、今のkindの命令は変わらない', async () => {
        const line = new Line(0, 0, 10, 10);
        const rect = new Rect(0, 0, 20, 20, '#111111', 2, '#222222');
        const separate = createRecordingCtx();
        line.draw(separate.ctx);
        rect.draw(separate.ctx);
        const compoundElement = { kind: 'compoundPath', outlines: [outlineOf(rect)], strokeColor: '#000000', strokeWidth: 1, fillColor: null };
        const log = await recordExported([line.toDrawElement(), compoundElement, rect.toDrawElement()]);
        const compoundLog = createRecordingCtx();
        drawCompoundPath(compoundLog.ctx, { shapes: [rect], style: { strokeColor: '#000000', strokeWidth: 1, fillColor: null } });
        const lineLog = createRecordingCtx();
        line.draw(lineLog.ctx);
        const rectLog = createRecordingCtx();
        rect.draw(rectLog.ctx);
        assert.deepStrictEqual(log, expectedExportLog([...lineLog.log, ...compoundLog.log, ...rectLog.log]));
    });

    it('版1〜4のデータ（formatVersionを書き換えただけ）を渡しても今のkindは同じ', async () => {
        const rect = new Rect(0, 0, 20, 20, '#111111', 2, '#222222');
        const base = SpriteSerializer.serialize([rect]);
        const expected = createRecordingCtx();
        rect.draw(expected.ctx);
        for (const version of [1, 2, 3, 4]) {
            const sprite = await importSprite({ ...base, formatVersion: version });
            const { ctx, log } = createRecordingCtx();
            sprite.draw(ctx);
            assert.deepStrictEqual(log, expectedExportLog(expected.log));
        }
    });

    it('版5のデータの既定のexportからdrawを除いたものはスプライトデータと同じ', async () => {
        const data = SpriteSerializer.serialize([]);
        data.elements = [{ kind: 'compoundPath', outlines: [outlineOf(new Rect(0, 0, 10, 10))], strokeColor: '#000000', strokeWidth: 2, fillColor: null }];
        const sprite = await importSprite(data);
        const { draw, ...rest } = sprite;
        assert.equal(typeof draw, 'function');
        assert.deepStrictEqual(JSON.parse(JSON.stringify(rest)), JSON.parse(SpriteSerializer.stringify(data)));
    });
});
