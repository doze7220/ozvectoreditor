/**
 * 責務: 確認用ページの判定・要約（SpriteCheckInspector）が、JSの既定のexportの判定、JSONかの見分け、情報欄の要約を正しく行うことを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteCheckInspector } from '../../js/check/SpriteCheckInspector.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 図形2つ（直線・矩形）からスプライトデータを作る。
 * @returns {Object} スプライトデータ
 */
function makeSpriteData() {
    const line = new Line(0, 0, 10, 20, '#112233', 2);
    line.id = 'line-1';
    const rect = new Rect(-5, -5, 15, 25, '#445566', 3);
    rect.id = 'rect-1';
    return SpriteSerializer.serialize([line, rect]);
}

/**
 * スプライトデータの一部のキーを変えた複製を作る（元は書き換えない）。
 * @param {Object} spriteData - 元のスプライトデータ
 * @param {Object} changes - 上書きするキーと値
 * @returns {Object} 複製
 */
function mutated(spriteData, changes) {
    return { ...spriteData, ...changes };
}

describe('SpriteCheckInspector.parseText', () => {
    it('JSONのテキストは kind json と値を返し、JSのテキスト・壊れたJSONは kind module を返す', () => {
        const data = makeSpriteData();
        const parsed = SpriteCheckInspector.parseText(SpriteSerializer.stringify(data));
        assert.equal(parsed.kind, 'json');
        assert.deepStrictEqual(parsed.value, JSON.parse(JSON.stringify(data)));
        assert.deepStrictEqual(SpriteCheckInspector.parseText('export default {};'), { kind: 'module' });
        assert.deepStrictEqual(SpriteCheckInspector.parseText('{ "a": '), { kind: 'module' });
        assert.deepStrictEqual(SpriteCheckInspector.parseText(''), { kind: 'module' });
    });
});

describe('SpriteCheckInspector.inspectModuleExport', () => {
    it('スプライトデータ＋draw関数のオブジェクトは ok', () => {
        const exported = { ...makeSpriteData(), draw() {} };
        assert.deepStrictEqual(SpriteCheckInspector.inspectModuleExport(exported), { ok: true });
    });

    it('drawが無い・関数でない場合、およびオブジェクトでない値（null・関数そのもの・文字列）は notSprite', () => {
        const data = makeSpriteData();
        const notSprite = { ok: false, reason: 'notSprite' };
        for (const value of [
            data,
            { ...data, draw: 'draw' },
            { ...data, draw: null },
            null,
            undefined,
            () => {},
            'text',
            42,
            {},
        ]) {
            assert.deepStrictEqual(SpriteCheckInspector.inspectModuleExport(value), notSprite);
        }
    });

    it('formatが違う・版が範囲外のオブジェクトは理由を区別する', () => {
        const data = makeSpriteData();
        assert.deepStrictEqual(
            SpriteCheckInspector.inspectModuleExport({ ...data, format: 'other', draw() {} }),
            { ok: false, reason: 'notSprite' },
        );
        assert.deepStrictEqual(
            SpriteCheckInspector.inspectModuleExport({ ...data, formatVersion: data.formatVersion + 1, draw() {} }),
            { ok: false, reason: 'unsupportedVersion' },
        );
    });
});

describe('SpriteCheckInspector.summarize', () => {
    it('版・作業データの版・要素数・外枠と幅・高さを返す（丸めない）', () => {
        const data = makeSpriteData();
        const summary = SpriteCheckInspector.summarize(data);
        assert.equal(summary.formatVersion, data.formatVersion);
        assert.equal(summary.sourceVersion, data.source.version);
        assert.equal(summary.elementCount, 2);
        assert.deepStrictEqual(summary.bounds, {
            state: 'ok',
            minX: data.bounds.minX,
            minY: data.bounds.minY,
            maxX: data.bounds.maxX,
            maxY: data.bounds.maxY,
            width: data.bounds.maxX - data.bounds.minX,
            height: data.bounds.maxY - data.bounds.minY,
        });
        const fractional = mutated(data, { bounds: { minX: -0.25, minY: 1.125, maxX: 10.5, maxY: 3.0625 } });
        assert.deepStrictEqual(SpriteCheckInspector.summarize(fractional).bounds, {
            state: 'ok', minX: -0.25, minY: 1.125, maxX: 10.5, maxY: 3.0625, width: 10.75, height: 1.9375,
        });
    });

    it('図形0個は bounds が none・要素数0、sourceが無い／versionが無い場合は sourceVersion が null', () => {
        const empty = SpriteCheckInspector.summarize(SpriteSerializer.serialize([]));
        assert.deepStrictEqual(empty.bounds, { state: 'none' });
        assert.equal(empty.elementCount, 0);
        const data = makeSpriteData();
        assert.equal(SpriteCheckInspector.summarize(mutated(data, { source: undefined })).sourceVersion, null);
        assert.equal(SpriteCheckInspector.summarize(mutated(data, { source: [] })).sourceVersion, null);
        assert.equal(SpriteCheckInspector.summarize(mutated(data, { source: { shapes: [] } })).sourceVersion, null);
    });

    it('elementsが配列でなければ要素数は null（不明）、形が不正な外枠は invalid', () => {
        const data = makeSpriteData();
        assert.equal(SpriteCheckInspector.summarize(mutated(data, { elements: 'x' })).elementCount, null);
        assert.equal(SpriteCheckInspector.summarize(mutated(data, { elements: undefined })).elementCount, null);
        for (const bounds of [
            undefined,
            'x',
            [],
            {},
            { minX: 0, minY: 0, maxX: 1 },
            { minX: 0, minY: 0, maxX: 1, maxY: '2' },
            { minX: 0, minY: 0, maxX: Infinity, maxY: 2 },
            { minX: NaN, minY: 0, maxX: 1, maxY: 2 },
        ]) {
            assert.deepStrictEqual(SpriteCheckInspector.summarize(mutated(data, { bounds })).bounds, { state: 'invalid' });
        }
    });
});
