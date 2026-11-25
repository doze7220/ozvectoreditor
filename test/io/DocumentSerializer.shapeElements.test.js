/**
 * 責務: DocumentSerializer.deserializeShapeElements（変換関数を受ける図形の並びの読み込み）の契約を、
 * 偽の変換関数と公開APIだけで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { ShapeFactory } from '../../js/core/ShapeFactory.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック（呼び出し回数の確認に使う）
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 要素（文字どおりのデータ）をそのまま図形データとして返す偽の変換関数。
 * @param {Object} element - 要素
 * @returns {Object} 要素の`data`
 */
function takeData(element) {
    return element.data;
}

/**
 * 直線の図形データを作る。
 * @param {number} x - 2点目のx
 * @returns {Object} 直線の図形データ
 */
function lineData(x) {
    return {
        type: 'line',
        points: [{ x: 0, y: 0 }, { x, y: 0 }],
        strokeColor: '#112233',
        strokeWidth: 2,
        fillColor: null,
    };
}

/**
 * 3点の二次曲線の図形データを作る。
 * @returns {Object} 曲線の図形データ
 */
function curveData() {
    return {
        type: 'curve',
        points: [{ x: 0, y: 0 }, { x: 5, y: 8 }, { x: 10, y: 0 }],
        strokeColor: '#445566',
        strokeWidth: 3,
        fillColor: null,
    };
}

describe('DocumentSerializer.deserializeShapeElements', () => {
    it('図形データを返す要素は図形になり、名前は種類ごとの番号で自動に付き、表示・ロックは既定になる', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements(
            [{ data: lineData(10) }, { data: curveData() }, { data: lineData(20) }],
            takeData
        );
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepEqual(result.skipped, []);
        assert.equal(result.shapes.length, 3);
        assert.equal(result.items.length, 3);
        const lineLabel = ShapeFactory.getTypeLabel('line');
        const curveLabel = ShapeFactory.getTypeLabel('curve');
        assert.deepEqual(result.items.map((item) => item.name), [`${lineLabel} 1`, `${curveLabel} 1`, `${lineLabel} 2`]);
        assert.ok(result.items.every((item) => item.visible === true && item.locked === false));
        assert.ok(result.items.every((item, i) => item.shape === result.shapes[i]));
        assert.equal(result.shapes[0].toJSON().points[1].x, 10);
        assert.equal(result.shapes[2].toJSON().points[1].x, 20);
        assert.equal(warn.mock.callCount(), 0);
    });

    it('変換が投げた要素・ShapeFactoryが断った要素だけを飛ばし、index・path・type・reason・警告1回ずつを記録する', (t) => {
        const warn = silenceWarn(t);
        const elements = [
            { data: lineData(10) },
            { fail: '変換できません' },
            { data: { type: 'unknown-type', points: [] } },
            { data: lineData(30) },
        ];
        const result = DocumentSerializer.deserializeShapeElements(elements, (element) => {
            if (element.fail !== undefined) throw new Error(element.fail);
            return element.data;
        });
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 2);
        assert.deepEqual(result.shapes.map((shape) => shape.toJSON().points[1].x), [10, 30]);
        assert.equal(result.skipped.length, 2);
        assert.deepEqual(result.skipped[0], { index: 1, path: [1], type: null, reason: '変換できません' });
        assert.equal(result.skipped[1].index, 2);
        assert.deepEqual(result.skipped[1].path, [2]);
        assert.equal(result.skipped[1].type, null);
        assert.equal(typeof result.skipped[1].reason, 'string');
        assert.notEqual(result.skipped[1].reason, '');
        assert.equal(warn.mock.callCount(), 2);
    });

    it('要素が文字列のtypeを持てば、skippedのtypeにその値が入る', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements(
            [{ type: 'marker', data: { type: 'nothing' } }],
            takeData
        );
        assert.equal(result.skipped.length, 1);
        assert.equal(result.skipped[0].type, 'marker');
    });

    it('すべて飛ばしても ok: true・図形0個になる', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements([{}, {}], () => {
            throw new Error('不可');
        });
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepEqual(result.items, []);
        assert.deepEqual(result.shapes, []);
        assert.equal(result.skipped.length, 2);
        assert.equal(warn.mock.callCount(), 2);
    });

    it('空配列は ok: true・図形0個・警告なし', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements([], takeData);
        assert.deepEqual(result, { ok: true, items: [], shapes: [], skipped: [], error: null });
        assert.equal(warn.mock.callCount(), 0);
    });

    it('elementsが配列でなければ例外を出さず全体失敗になり、警告は1回', (t) => {
        const warn = silenceWarn(t);
        for (const bad of [null, undefined, 'text', 5, { length: 1 }]) {
            warn.mock.resetCalls();
            const result = DocumentSerializer.deserializeShapeElements(bad, takeData);
            assert.equal(result.ok, false);
            assert.equal(typeof result.error, 'string');
            assert.deepEqual(result.items, []);
            assert.deepEqual(result.shapes, []);
            assert.deepEqual(result.skipped, []);
            assert.equal(warn.mock.callCount(), 1);
        }
    });

    it('変換関数がRangeErrorを投げたら全体失敗（図形を1つも返さない）になり、警告は1回', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements([{ data: lineData(1) }, {}], (element) => {
            if (element.data === undefined) throw new RangeError('深すぎ');
            return element.data;
        });
        assert.equal(result.ok, false);
        assert.ok(result.error.includes('深すぎ'));
        assert.deepEqual(result.items, []);
        assert.deepEqual(result.shapes, []);
        assert.deepEqual(result.skipped, []);
        assert.equal(warn.mock.callCount(), 1);
    });

    it('変換関数が関数でなくても例外を出さず、要素ごとの飛ばしになる', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserializeShapeElements([{ data: lineData(1) }], undefined);
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 0);
        assert.equal(result.skipped.length, 1);
    });

    it('引数のelementsと各要素・図形データを書き換えない', (t) => {
        silenceWarn(t);
        const elements = [{ data: lineData(10) }, { data: curveData() }, { data: { type: 'x' } }];
        const before = JSON.stringify(elements);
        const result = DocumentSerializer.deserializeShapeElements(elements, takeData);
        assert.equal(JSON.stringify(elements), before);
        assert.equal(elements.length, 3);
        result.shapes[0].translate(5, 5);
        assert.equal(JSON.stringify(elements), before);
    });
});
