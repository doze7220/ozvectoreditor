/**
 * 責務: 書き出したパーツのJSを、組み立て用のJS（_hero.js）がファイル名でimportして原点基準に配置して描けること（P7のキャラ合成の形）を、一時フォルダの実ファイルで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 組み立て用のJS（開発資料2章の例と同じ形）の固定のテキスト。
 * @type {string}
 */
const HERO_SOURCE = [
    "import body from './body.js';",
    "import head from './head.js';",
    '',
    'export default {',
    '    draw(ctx) {',
    '        body.draw(ctx);',
    '        ctx.save();',
    '        ctx.translate(0, -40);',
    '        head.draw(ctx);',
    '        ctx.restore();',
    '    },',
    '};',
    '',
].join('\n');

/**
 * メソッド呼び出しとプロパティ代入を順に記録する偽のctxを作る（translateも記録する）。
 * @returns {{ctx: object, log: Array<Array<*>>}} 偽のctxと記録（要素は[名前, ...引数]または['set:名前', 値]）
 */
function createRecordingCtx() {
    const log = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'ellipse', 'closePath', 'stroke', 'save', 'restore', 'translate', 'setLineDash']) {
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
 * スプライトの`draw`で描いた記録を返す。
 * @param {object} sprite - 既定のexport
 * @returns {Array<Array<*>>} 記録
 */
function recordSpriteDraw(sprite) {
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
 * 一時フォルダ内のファイルを動的importして既定のexportを返す。
 * @param {string} dir - 一時フォルダ
 * @param {string} fileName - ファイル名
 * @returns {Promise<object>} 既定のexport
 */
async function importFromDir(dir, fileName) {
    const module = await import(pathToFileURL(join(dir, fileName)).href);
    return module.default;
}

/**
 * body（矩形と直線）の図形一式を作る。
 * @returns {Array<object>} 図形
 */
function makeBodyShapes() {
    return [new Rect(-20, -30, 20, 30, '#cc3300', 4), new Line(-20, 30, 20, 60, '#0033cc', 6)];
}

/**
 * head（円）の図形一式を作る。
 * @returns {Array<object>} 図形
 */
function makeHeadShapes() {
    return [new Ellipse(-10, -10, 10, 10, 'circle', '#00aa44', 2)];
}

describe('CodeExporter: 組み立て用のJS（_hero.js）が書き出したパーツをimportして描ける', () => {
    it('_heroはbody → translate付きでhead の順に描き、互いのデータで描かれない', async (t) => {
        const dir = mkdtempSync(join(tmpdir(), 'ozve-assembly-'));
        t.after(() => {
            rmSync(dir, { recursive: true, force: true });
        });
        const bodyShapes = makeBodyShapes();
        const headShapes = makeHeadShapes();
        const bodyData = SpriteSerializer.serialize(bodyShapes);
        const headData = SpriteSerializer.serialize(headShapes);
        writeFileSync(join(dir, 'body.js'), CodeExporter.toModuleText(bodyData));
        writeFileSync(join(dir, 'head.js'), CodeExporter.toModuleText(headData));
        writeFileSync(join(dir, '_hero.js'), HERO_SOURCE);

        const hero = await importFromDir(dir, '_hero.js');
        const body = await importFromDir(dir, 'body.js');
        const head = await importFromDir(dir, 'head.js');

        const bodyLog = recordSpriteDraw(body);
        const headLog = recordSpriteDraw(head);
        assert.deepStrictEqual(bodyLog, expectedExportLog(recordEditorDraw(bodyShapes)));
        assert.deepStrictEqual(headLog, expectedExportLog(recordEditorDraw(headShapes)));
        assert.notDeepStrictEqual(bodyLog, headLog);

        assert.deepStrictEqual(recordSpriteDraw(hero), [
            ...bodyLog,
            ['save'],
            ['translate', 0, -40],
            ...headLog,
            ['restore'],
        ]);

        assert.deepStrictEqual(body.elements, bodyData.elements);
        assert.deepStrictEqual(head.elements, headData.elements);
        assert.notDeepStrictEqual(body.elements, head.elements);
    });
});
