/**
 * 責務: DocumentSerializerの版1→版2のマイグレーション（全図形をfillColor: nullにする）の契約を、
 * 公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック（呼び出し回数の確認に使う）
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 版1の図形データ（fillColorを持たない。5種＋開いた／閉じたパス）を毎回新しく作る。
 * @returns {object[]} 版1の図形データの配列
 */
function makeVersion1Shapes() {
    const two = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const five = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 }, { x: 10, y: 0 }, { x: 10, y: 0 }];
    return [
        { type: 'line', id: 'l', points: two.map((p) => ({ ...p })), strokeColor: '#111111', strokeWidth: 3 },
        { type: 'curve', id: 'c', points: [{ x: 0, y: 0 }, { x: 5, y: 9 }, { x: 10, y: 0 }], strokeColor: '#222222', strokeWidth: 4 },
        { type: 'rect', id: 'r', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], strokeColor: '#333333', strokeWidth: 5 },
        { type: 'circle', id: 'ci', points: five.map((p) => ({ ...p })), strokeColor: '#444444', strokeWidth: 6 },
        { type: 'arc', id: 'a', points: five.map((p) => ({ ...p })), strokeColor: '#555555', strokeWidth: 7 },
        {
            type: 'path', id: 'po', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: false,
            segments: [{ kind: 'line' }, { kind: 'line' }], strokeColor: '#666666', strokeWidth: 1,
        },
        {
            type: 'path', id: 'pc', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true,
            segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }], strokeColor: '#777777', strokeWidth: 2,
        },
    ];
}

/**
 * 版1の作業データを作る。
 * @param {*} shapes - shapesに入れる値
 * @returns {object} 版1の作業データ
 */
function makeVersion1Doc(shapes) {
    return { format: 'oz-vector-editor', version: 1, shapes };
}

describe('DocumentSerializer: 版1→版2のマイグレーション', () => {
    it('オブジェクト層で全図形がfillColor: nullで読め、他の項目は元のとおり', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes();
        const result = DocumentSerializer.deserialize(makeVersion1Doc(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        assert.deepEqual(result.skipped, []);
        result.shapes.forEach((shape, i) => {
            const json = shape.toJSON();
            assert.equal(json.fillColor, null);
            const { fillColor, ...rest } = json;
            assert.deepEqual(rest, data[i]);
        });
    });

    it('文字列層でも全図形がfillColor: nullで読め、他の項目は元のとおり', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes();
        const result = DocumentSerializer.deserializeFromString(JSON.stringify(makeVersion1Doc(data)));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        result.shapes.forEach((shape, i) => {
            const json = shape.toJSON();
            assert.equal(json.fillColor, null);
            const { fillColor, ...rest } = json;
            assert.deepEqual(rest, data[i]);
        });
    });

    it('版1の要素がfillColor（文字列）を持っていてもnullになる', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes().map((item) => ({ ...item, fillColor: '#ff0000' }));
        const result = DocumentSerializer.deserialize(makeVersion1Doc(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        result.shapes.forEach((shape) => {
            assert.equal(shape.toJSON().fillColor, null);
        });
    });

    it('版1でstrokeWidthの無い図形は2pxで読める', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes().map((item) => {
            const { strokeWidth, ...rest } = item;
            return rest;
        });
        const result = DocumentSerializer.deserialize(makeVersion1Doc(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        result.shapes.forEach((shape) => {
            assert.equal(shape.toJSON().strokeWidth, 2);
        });
    });

    it('版1のshapesのプレーンオブジェクトでない要素はスキップされ、残りが読める', (t) => {
        const warn = silenceWarn(t);
        const valid = makeVersion1Shapes();
        const shapes = [null, valid[0], 42, valid[1], [1, 2], 'text', valid[2]];
        const result = DocumentSerializer.deserialize(makeVersion1Doc(shapes));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 3);
        assert.deepEqual(result.shapes.map((s) => s.type), ['line', 'curve', 'rect']);
        assert.deepEqual(result.skipped.map((s) => ({ index: s.index, type: s.type })), [
            { index: 0, type: null },
            { index: 2, type: null },
            { index: 4, type: null },
            { index: 5, type: null },
        ]);
        assert.equal(warn.mock.calls.length, 4);
    });

    it('版1でshapesが配列でない場合は全体失敗（警告1回）', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserialize(makeVersion1Doc({ not: 'array' }));
        assert.equal(result.ok, false);
        assert.deepEqual(result.shapes, []);
        assert.deepEqual(result.skipped, []);
        assert.match(result.error, /shapesが配列ではありません/);
        assert.equal(warn.mock.calls.length, 1);
    });

    it('引数の作業データ（shapes・各要素を含む）を書き換えない', (t) => {
        silenceWarn(t);
        const doc = makeVersion1Doc([...makeVersion1Shapes(), null]);
        const snapshot = structuredClone(doc);
        DocumentSerializer.deserialize(doc);
        assert.deepEqual(doc, snapshot);
    });
});
