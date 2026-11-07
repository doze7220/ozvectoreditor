/**
 * 責務: DocumentSerializerのデシリアライズの契約（全体の読み込み失敗・図形単位のスキップ・版の範囲・
 * 引数を書き換えないこと）を、公開APIのみを通して検証する。
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
 * 現行版の作業データ形式の版番号を公開APIの出力から得る。
 * @returns {number} 現行版の版番号
 */
function currentVersion() {
    return DocumentSerializer.serialize([]).version;
}

/**
 * id付きの5種の図形インスタンスを毎回新しく作る。
 * @returns {object[]} line・curve・rect・arc・circle の順の図形インスタンス
 */
function makeValidShapes() {
    const shapes = [
        ShapeFactory.create('line', 10, 20, 110, 70),
        ShapeFactory.create('curve', 0, 0, 100, 40),
        ShapeFactory.create('rect', 10, 10, 90, 60),
        ShapeFactory.create('arc', 50, 50, 80, 20),
        ShapeFactory.create('circle', 50, 50, 80, 20),
    ];
    shapes.forEach((shape, i) => {
        shape.id = `shape-${i + 1}`;
    });
    return shapes;
}

/**
 * 正しい図形データ（5種）を毎回新しく作る。
 * @returns {object[]} 図形データの配列
 */
function makeValidData() {
    return makeValidShapes().map((shape) => shape.toJSON());
}

/**
 * 公開APIの出力を土台に、shapes だけを差し替えた作業データを作る。
 * @param {Array<*>} shapesData - 差し替える shapes
 * @returns {object} 作業データ
 */
function makeDocument(shapesData) {
    return { ...DocumentSerializer.serialize([]), shapes: shapesData };
}

/**
 * 全体の読み込み失敗の結果であることを検証する。
 * @param {object} result - デシリアライズの結果
 * @returns {void}
 */
function assertWholeFailure(result) {
    assert.equal(result.ok, false);
    assert.deepStrictEqual(result.shapes, []);
    assert.deepStrictEqual(result.skipped, []);
    assert.equal(typeof result.error, 'string');
    assert.notEqual(result.error, '');
}

/**
 * 作業データのコピーから指定のプロパティを取り除く。
 * @param {object} doc - 作業データ
 * @param {string} key - 取り除くプロパティ名
 * @returns {object} プロパティを取り除いた新しい作業データ
 */
function without(doc, key) {
    const copy = { ...doc };
    delete copy[key];
    return copy;
}

/**
 * 正しい図形データを元に、1つの項目だけ不正にした図形データを作る。
 * @param {string} type - 元にする図形種別
 * @param {(data: object) => void} mutate - 図形データを不正に書き換える関数
 * @returns {object} 不正な図形データ
 */
function broken(type, mutate) {
    const data = makeValidData().find((d) => d.type === type);
    mutate(data);
    return data;
}

/**
 * 図形単位のスキップのケース表（item=不正な要素、type=期待されるskippedのtype）。
 * @returns {Array<{name: string, item: *, type: (string|null)}>} ケースの配列
 */
function skipCases() {
    return [
        {
            name: '未知の図形種別',
            item: { type: 'triangle', id: 'x', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], strokeColor: '#000000', strokeWidth: 2 },
            type: 'triangle',
        },
        { name: '頂点の不足', item: broken('line', (d) => { d.points = d.points.slice(0, 1); }), type: 'line' },
        { name: '頂点の過多', item: broken('curve', (d) => { d.points.push({ x: 1, y: 1 }); }), type: 'curve' },
        { name: '座標が数値でない', item: broken('rect', (d) => { d.points[2].x = '10'; }), type: 'rect' },
        { name: 'pointsが配列でない', item: broken('arc', (d) => { d.points = {}; }), type: 'arc' },
        { name: '線の太さが不正', item: broken('circle', (d) => { d.strokeWidth = 0; }), type: 'circle' },
        { name: '線の色が文字列でない', item: broken('line', (d) => { d.strokeColor = 123; }), type: 'line' },
        { name: '要素がnull', item: null, type: null },
        { name: '要素が数値', item: 7, type: null },
        { name: '要素が配列', item: ['x'], type: null },
        { name: '種別が文字列でない', item: broken('line', (d) => { d.type = 5; }), type: null },
        { name: '種別が無い', item: broken('line', (d) => { delete d.type; }), type: null },
    ];
}

describe('DocumentSerializer.deserialize: 全体の読み込み失敗（オブジェクト層）', () => {
    const validData = makeValidData();
    const cases = [
        ['最上位がnull', () => null],
        ['最上位がundefined', () => undefined],
        ['最上位が空配列', () => []],
        ['最上位が図形データの配列', () => makeValidData()],
        ['最上位が0', () => 0],
        ['最上位が42', () => 42],
        ['最上位が文字列', () => 'text'],
        ['最上位がtrue', () => true],
        ['formatが無い', () => without(makeDocument(validData), 'format')],
        ['formatが別の値', () => ({ ...makeDocument(validData), format: 'other-format' })],
        ['formatの大文字小文字違い', () => ({ ...makeDocument(validData), format: 'OZ-VECTOR-EDITOR' })],
        ['formatがnull', () => ({ ...makeDocument(validData), format: null })],
        ['versionが無い', () => without(makeDocument(validData), 'version')],
        ['versionが文字列', () => ({ ...makeDocument(validData), version: String(currentVersion()) })],
        ['versionが小数', () => ({ ...makeDocument(validData), version: currentVersion() + 0.5 })],
        ['versionが0', () => ({ ...makeDocument(validData), version: 0 })],
        ['versionが-1', () => ({ ...makeDocument(validData), version: -1 })],
        ['versionが現行版より大きい', () => ({ ...makeDocument(validData), version: currentVersion() + 1 })],
        ['versionがNaN', () => ({ ...makeDocument(validData), version: NaN })],
        ['versionがnull', () => ({ ...makeDocument(validData), version: null })],
        ['shapesが無い', () => without(makeDocument(validData), 'shapes')],
        ['shapesがnull', () => makeDocument(null)],
        ['shapesが{}', () => makeDocument({})],
        ['shapesが文字列', () => makeDocument('shapes')],
        ['shapesが数値', () => makeDocument(3)],
    ];
    for (const [name, make] of cases) {
        it(`${name}は全体の失敗になり、警告が1回出る`, (t) => {
            const warn = silenceWarn(t);
            assertWholeFailure(DocumentSerializer.deserialize(make()));
            assert.equal(warn.mock.callCount(), 1);
        });
    }
});

describe('DocumentSerializer.deserializeFromString: 全体の読み込み失敗（文字列層）', () => {
    const cases = [
        ['空文字列', () => ''],
        ['JSONでない文字列', () => 'not json'],
        ['途中で切れたJSON', () => '{"format":'],
        ['正しい作業データの末尾1文字を削ったもの', () => DocumentSerializer.serializeToString(makeValidShapes()).slice(0, -1)],
        ['null', () => 'null'],
        ['空配列', () => '[]'],
        ['数値', () => '42'],
        ['文字列のJSON', () => '"text"'],
        ['版0の作業データ', () => JSON.stringify({ ...makeDocument(makeValidData()), version: 0 })],
    ];
    for (const [name, make] of cases) {
        it(`${name}は全体の失敗になり、警告が1回出る`, (t) => {
            const warn = silenceWarn(t);
            assertWholeFailure(DocumentSerializer.deserializeFromString(make()));
            assert.equal(warn.mock.callCount(), 1);
        });
    }
});

describe('DocumentSerializer: 版の範囲', () => {
    it('現行版は1以上の整数である', () => {
        assert.ok(Number.isInteger(currentVersion()));
        assert.ok(currentVersion() >= 1);
    });

    it('現行版の作業データはオブジェクト層で5図形とも復元される', (t) => {
        const warn = silenceWarn(t);
        const data = makeValidData();
        const result = DocumentSerializer.deserialize(makeDocument(data));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepStrictEqual(result.skipped, []);
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), data);
        assert.equal(warn.mock.callCount(), 0);
    });

    it('現行版の作業データは文字列層で5図形とも復元される', (t) => {
        const warn = silenceWarn(t);
        const data = makeValidData();
        const result = DocumentSerializer.deserializeFromString(JSON.stringify(makeDocument(data)));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepStrictEqual(result.skipped, []);
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), data);
        assert.equal(warn.mock.callCount(), 0);
    });

    it('版0は全体の失敗になる', (t) => {
        silenceWarn(t);
        assertWholeFailure(DocumentSerializer.deserialize({ ...makeDocument(makeValidData()), version: 0 }));
    });

    it('現行版より大きい版は全体の失敗になる', (t) => {
        silenceWarn(t);
        assertWholeFailure(DocumentSerializer.deserialize({ ...makeDocument(makeValidData()), version: currentVersion() + 1 }));
    });
});

describe('DocumentSerializer.deserialize: 図形単位のスキップ', () => {
    /**
     * 正しい要素2つの間に不正な要素1つを挟んだ作業データで結果を検証する。
     * @param {import('node:test').TestContext} t - テストコンテキスト
     * @param {(doc: object) => object} run - 作業データを受け取りデシリアライズする関数
     * @param {{item: *, type: (string|null)}} testCase - ケース
     * @returns {void}
     */
    function assertSkipped(t, run, testCase) {
        const warn = silenceWarn(t);
        const [good1, good2] = makeValidData();
        const result = run(makeDocument([good1, testCase.item, good2]));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), [good1, good2]);
        assert.deepStrictEqual(result.skipped.map(({ index, type }) => ({ index, type })), [{ index: 1, type: testCase.type }]);
        result.skipped.forEach((s) => {
            assert.equal(typeof s.reason, 'string');
            assert.notEqual(s.reason, '');
        });
        assert.equal(warn.mock.callCount(), result.skipped.length);
    }

    for (const testCase of skipCases()) {
        it(`オブジェクト層: ${testCase.name}はスキップされ、残りが復元される`, (t) => {
            assertSkipped(t, (doc) => DocumentSerializer.deserialize(doc), testCase);
        });
        it(`文字列層: ${testCase.name}はスキップされ、残りが復元される`, (t) => {
            assertSkipped(t, (doc) => DocumentSerializer.deserializeFromString(JSON.stringify(doc)), testCase);
        });
    }

    it('不正な要素が複数あっても、それぞれが位置と種別つきで記録され、正しい要素は元の順で復元される', (t) => {
        const warn = silenceWarn(t);
        const cases = skipCases();
        const good = makeValidData();
        const items = [];
        const expectedSkipped = [];
        cases.forEach((c, i) => {
            items.push(good[i % good.length]);
            expectedSkipped.push({ index: items.length, type: c.type });
            items.push(c.item);
        });
        const result = DocumentSerializer.deserialize(makeDocument(items));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), cases.map((_, i) => good[i % good.length]));
        assert.deepStrictEqual(result.skipped.map(({ index, type }) => ({ index, type })), expectedSkipped);
        assert.equal(warn.mock.callCount(), cases.length);
    });

    it('余分なプロパティは無視され、スキップされず復元される（オブジェクト層）', (t) => {
        const warn = silenceWarn(t);
        const circle = makeValidData().find((d) => d.type === 'circle');
        const result = DocumentSerializer.deserialize(makeDocument([{ ...circle, startAngle: 1, foo: 'bar' }]));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.skipped, []);
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), [circle]);
        assert.equal(warn.mock.callCount(), 0);
    });

    it('余分なプロパティは無視され、スキップされず復元される（文字列層）', (t) => {
        const warn = silenceWarn(t);
        const circle = makeValidData().find((d) => d.type === 'circle');
        const text = JSON.stringify(makeDocument([{ ...circle, startAngle: 1, foo: 'bar' }]));
        const result = DocumentSerializer.deserializeFromString(text);
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.skipped, []);
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), [circle]);
        assert.equal(warn.mock.callCount(), 0);
    });
});

describe('DocumentSerializer.deserialize: 全図形のスキップ', () => {
    it('不正な要素だけの作業データは成功で、図形0個・全件スキップになる（オブジェクト層）', (t) => {
        const warn = silenceWarn(t);
        const items = skipCases().map((c) => c.item);
        const result = DocumentSerializer.deserialize(makeDocument(items));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepStrictEqual(result.shapes, []);
        assert.equal(result.skipped.length, items.length);
        assert.equal(warn.mock.callCount(), items.length);
    });

    it('不正な要素だけの作業データは成功で、図形0個・全件スキップになる（文字列層）', (t) => {
        const warn = silenceWarn(t);
        const items = skipCases().map((c) => c.item);
        const result = DocumentSerializer.deserializeFromString(JSON.stringify(makeDocument(items)));
        assert.equal(result.ok, true);
        assert.equal(result.error, null);
        assert.deepStrictEqual(result.shapes, []);
        assert.equal(result.skipped.length, items.length);
        assert.equal(warn.mock.callCount(), items.length);
    });
});

describe('DocumentSerializer: 引数を書き換えない', () => {
    it('deserializeは正しい要素と不正な要素を混ぜた作業データを書き換えない', (t) => {
        silenceWarn(t);
        const [good1, good2] = makeValidData();
        const doc = makeDocument([good1, ...skipCases().map((c) => c.item), good2]);
        const copy = structuredClone(doc);
        DocumentSerializer.deserialize(doc);
        assert.deepStrictEqual(doc, copy);
    });

    it('deserializeは全体の失敗になる作業データ（版0）を書き換えない', (t) => {
        silenceWarn(t);
        const doc = { ...makeDocument(makeValidData()), version: 0 };
        const copy = structuredClone(doc);
        assertWholeFailure(DocumentSerializer.deserialize(doc));
        assert.deepStrictEqual(doc, copy);
    });

    it('serializeは渡した配列と図形を書き換えない', () => {
        const shapes = makeValidShapes();
        const before = [...shapes];
        const jsonBefore = shapes.map((s) => structuredClone(s.toJSON()));
        DocumentSerializer.serialize(shapes);
        assert.equal(shapes.length, before.length);
        shapes.forEach((shape, i) => assert.equal(shape, before[i]));
        assert.deepStrictEqual(shapes.map((s) => s.toJSON()), jsonBefore);
    });
});
