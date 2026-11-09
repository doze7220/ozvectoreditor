/**
 * 責務: CanvasFileOperationsの開く（ファイル）・インポートでの読み込み結果の分類（作業データファイル・スプライトのJS。スプライトのJSONは読み込み不可）（読み込み不可・空・一部・全部）と通知を、
 * 注入する依存の偽物と公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasFileOperations } from '../../js/edit/CanvasFileOperations.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { ShapeFactory } from '../../js/core/ShapeFactory.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 注入する依存の偽物一式と、呼び出しの記録を新しく作る。
 * @returns {{
 *   ops: CanvasFileOperations,
 *   fileIO: object,
 *   calls: string[],
 *   createCalls: Array<{name: string, shapes: object[]}>,
 *   insertCalls: Array<{documentData: object, dx: number, dy: number}>
 * }} 偽物を注入した CanvasFileOperations と記録
 */
function createHarness() {
    const calls = [];
    const createCalls = [];
    const insertCalls = [];
    const fileIO = {
        /**
         * @param {{name: string}} file - ファイルの偽物
         * @returns {string} ファイル名
         */
        getFileName: (file) => file.name,
        /**
         * @param {{text?: string, readError?: Error}} file - ファイルの偽物
         * @returns {Promise<string>} ファイルの中身（readError があれば reject）
         */
        readText: (file) => (file.readError ? Promise.reject(file.readError) : Promise.resolve(file.text)),
        /**
         * @param {string} name - キャンバス名の元になるファイル名
         * @returns {string} 識別できる変換結果
         */
        toCanvasName: (name) => `canvas:${name}`,
        /**
         * @returns {void}
         */
        downloadText: () => {},
    };
    const canvasLibrary = {
        /**
         * @returns {object} 新しい状態オブジェクト
         */
        getState: () => ({
            loading: false,
            busy: false,
            canManage: true,
            openCanvasId: 'canvas-a',
            openCanvasName: 'A',
            canvases: [],
            issue: null,
            hasSaveProblem: false,
        }),
        /**
         * @returns {void}
         */
        onChange: () => {},
        /**
         * @param {string} name - キャンバス名
         * @param {object[]} shapes - 図形インスタンス
         * @returns {Promise<boolean>} 常に true
         */
        createCanvasFromShapes: (name, shapes) => {
            calls.push('createCanvasFromShapes');
            createCalls.push({ name, shapes });
            return Promise.resolve(true);
        },
    };
    const inserter = {
        /**
         * @param {{shapes: object[]}} documentData - 作業データ
         * @param {number} dx - X方向のずらし量
         * @param {number} dy - Y方向のずらし量
         * @returns {{ok: boolean, insertedIds: string[], skipped: Array, error: null}} 追加結果の偽物
         */
        insertDocument: (documentData, dx, dy) => {
            calls.push('insertDocument');
            insertCalls.push({ documentData, dx, dy });
            return { ok: true, insertedIds: documentData.shapes.map((_, i) => `new-${i}`), skipped: [], error: null };
        },
    };
    const model = {
        /**
         * @returns {object[]} 空配列
         */
        getShapes: () => [],
    };
    /**
     * @returns {void}
     */
    const prepareInsert = () => {
        calls.push('prepareInsert');
    };
    const ops = new CanvasFileOperations({ fileIO, canvasLibrary, inserter, model, prepareInsert });
    return { ops, fileIO, calls, createCalls, insertCalls };
}

/**
 * 中身のテキストを持つファイルの偽物を作る。
 * @param {string} name - ファイル名
 * @param {string} text - ファイルの中身
 * @returns {{name: string, text: string}} ファイルの偽物
 */
function makeFile(name, text) {
    return { name, text };
}

/**
 * 読み取りに失敗するファイルの偽物を作る。
 * @param {string} name - ファイル名
 * @returns {{name: string, readError: Error}} ファイルの偽物
 */
function makeUnreadableFile(name) {
    return { name, readError: new Error('read failed') };
}

/**
 * id付きの5種の図形インスタンスを新しく作る。
 * @returns {object[]} line・curve・rect・arc・circle の順の図形
 */
function makeShapes() {
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
 * 不正な図形データ（未知の種別）を作る。
 * @returns {object} 不正な図形データ
 */
function makeBadShapeData() {
    return { type: 'triangle', id: 'x', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], strokeColor: '#000000', strokeWidth: 2 };
}

/**
 * 作業データの shapes を図形データの配列で差し替えた JSON 文字列を作る。
 * @param {object[]} shapesData - 図形データの配列
 * @returns {string} JSON 文字列
 */
function makeTextWithShapesData(shapesData) {
    return JSON.stringify({ ...DocumentSerializer.serialize([]), shapes: shapesData });
}

/**
 * 通知の期待値を作る。
 * @param {string} kind - 通知の種類
 * @param {string} fileName - ファイル名
 * @param {number} skippedCount - 読めなかった図形の数
 * @returns {{kind: string, fileName: string, skippedCount: number}} 通知
 */
function notice(kind, fileName, skippedCount) {
    return { kind, fileName, skippedCount };
}

/**
 * 読み込み不可になるファイルのケース表を作る。
 * @returns {Array<{label: string, make: () => object}>} ケース（ファイルの偽物を作る関数つき）
 */
function unreadableCases() {
    const base = DocumentSerializer.serialize([]);
    return [
        { label: 'ファイルを読み取れない', make: () => makeUnreadableFile('a.json') },
        { label: 'JSONとして解析できない', make: () => makeFile('a.json', 'not json') },
        { label: 'formatが違う', make: () => makeFile('a.json', JSON.stringify({ ...base, format: 'other-format' })) },
        { label: '版が0', make: () => makeFile('a.json', JSON.stringify({ ...base, version: 0 })) },
        { label: '現行版より大きい版', make: () => makeFile('a.json', JSON.stringify({ ...base, version: base.version + 1 })) },
        { label: '図形がすべて読めない', make: () => makeFile('a.json', makeTextWithShapesData([makeBadShapeData(), makeBadShapeData()])) },
    ];
}

describe('CanvasFileOperations: 開く（ファイル）', () => {
    for (const { label, make } of unreadableCases()) {
        it(`読み込み不可（${label}）: false・キャンバスを作らない・readFailed`, async (t) => {
            silenceWarn(t);
            const h = createHarness();
            const result = await h.ops.openFile(make());
            assert.equal(result, false);
            assert.equal(h.createCalls.length, 0);
            assert.deepStrictEqual(h.ops.getState().fileNotice, notice('readFailed', 'a.json', 0));
        });
    }

    it('図形0個の正しいファイル: true・空のキャンバスを1回作る・通知なし', async (t) => {
        silenceWarn(t);
        const h = createHarness();
        const result = await h.ops.openFile(makeFile('empty.json', DocumentSerializer.serializeToString([])));
        assert.equal(result, true);
        assert.equal(h.createCalls.length, 1);
        assert.equal(h.createCalls[0].name, h.fileIO.toCanvasName('empty.json'));
        assert.deepStrictEqual(h.createCalls[0].shapes, []);
        assert.equal(h.ops.getState().fileNotice, null);
    });

    it('一部の図形が読めない: true・読めた図形で開く・partialRead（1件）', async (t) => {
        silenceWarn(t);
        const h = createHarness();
        const good = makeShapes().slice(0, 2).map((shape) => shape.toJSON());
        const text = makeTextWithShapesData([good[0], makeBadShapeData(), good[1]]);
        const result = await h.ops.openFile(makeFile('part.json', text));
        assert.equal(result, true);
        assert.equal(h.createCalls.length, 1);
        assert.equal(h.createCalls[0].name, h.fileIO.toCanvasName('part.json'));
        assert.deepStrictEqual(h.createCalls[0].shapes.map((shape) => shape.toJSON()), good);
        assert.deepStrictEqual(h.ops.getState().fileNotice, notice('partialRead', 'part.json', 1));
    });

    it('すべて読めた（5種の図形）: true・並びも含め一致・通知なし', async (t) => {
        silenceWarn(t);
        const h = createHarness();
        const shapes = makeShapes();
        const result = await h.ops.openFile(makeFile('all.json', DocumentSerializer.serializeToString(shapes)));
        assert.equal(result, true);
        assert.equal(h.createCalls.length, 1);
        assert.equal(h.createCalls[0].name, h.fileIO.toCanvasName('all.json'));
        assert.deepStrictEqual(
            h.createCalls[0].shapes.map((shape) => shape.toJSON()),
            shapes.map((shape) => shape.toJSON())
        );
        assert.equal(h.ops.getState().fileNotice, null);
    });
});

describe('CanvasFileOperations: インポート', () => {
    for (const { label, make } of unreadableCases()) {
        it(`読み込み不可（${label}）: false・prepareInsert/insertDocumentを呼ばない・readFailed`, async (t) => {
            silenceWarn(t);
            const h = createHarness();
            const result = await h.ops.importFile(make());
            assert.equal(result, false);
            assert.deepStrictEqual(h.calls, []);
            assert.deepStrictEqual(h.ops.getState().fileNotice, notice('readFailed', 'a.json', 0));
        });
    }

    it('図形0個の正しいファイル: false・prepareInsert/insertDocumentを呼ばない・noShapes', async (t) => {
        silenceWarn(t);
        const h = createHarness();
        const result = await h.ops.importFile(makeFile('empty.json', DocumentSerializer.serializeToString([])));
        assert.equal(result, false);
        assert.deepStrictEqual(h.calls, []);
        assert.deepStrictEqual(h.ops.getState().fileNotice, notice('noShapes', 'empty.json', 0));
    });

    it('一部の図形が読めない: true・prepareInsert→insertDocument・読めた図形のみ・partialRead（1件）', async (t) => {
        silenceWarn(t);
        const h = createHarness();
        const good = makeShapes().slice(0, 2).map((shape) => shape.toJSON());
        const text = makeTextWithShapesData([good[0], makeBadShapeData(), good[1]]);
        const result = await h.ops.importFile(makeFile('part.json', text));
        assert.equal(result, true);
        assert.deepStrictEqual(h.calls, ['prepareInsert', 'insertDocument']);
        assert.equal(h.insertCalls.length, 1);
        assert.deepStrictEqual(h.insertCalls[0].documentData.shapes, good);
        assert.equal(h.insertCalls[0].dx, 0);
        assert.equal(h.insertCalls[0].dy, 0);
        assert.deepStrictEqual(h.ops.getState().fileNotice, notice('partialRead', 'part.json', 1));
    });

    it('すべて読めた（5種の図形）: true・prepareInsert→insertDocument・5図形一致・通知なし', async (t) => {
        silenceWarn(t);
        const h = createHarness();
        const shapes = makeShapes();
        const result = await h.ops.importFile(makeFile('all.json', DocumentSerializer.serializeToString(shapes)));
        assert.equal(result, true);
        assert.deepStrictEqual(h.calls, ['prepareInsert', 'insertDocument']);
        assert.equal(h.insertCalls.length, 1);
        assert.deepStrictEqual(
            h.insertCalls[0].documentData.shapes,
            shapes.map((shape) => shape.toJSON())
        );
        assert.equal(h.ops.getState().fileNotice, null);
    });
});

/**
 * スプライトデータの `source.shapes` を差し替えたスプライトデータを作る（元のスプライトデータは書き換えない）。
 * @param {object[]} shapes - 元の図形インスタンス
 * @param {object[]} shapesData - `source.shapes` に入れる図形データの配列
 * @returns {object} スプライトデータ
 */
function makeSpriteDataWithSourceShapes(shapes, shapesData) {
    const data = SpriteSerializer.serialize(shapes);
    return { ...data, source: { ...data.source, shapes: shapesData } };
}

/**
 * スプライトのファイルの偽物のケース表を作る（JS・CRLFのJS）。
 * @param {object} spriteData - スプライトデータ
 * @returns {Array<{label: string, make: (name: string) => object}>} ケース（ファイルの偽物を作る関数つき）
 */
function spriteFileCases(spriteData) {
    const moduleText = CodeExporter.toModuleText(spriteData);
    return [
        { label: 'JS', make: (name) => makeFile(name, moduleText) },
        { label: 'CRLFのJS', make: (name) => makeFile(name, moduleText.replace(/\n/g, '\r\n')) },
    ];
}

/**
 * 本アプリのものでないJSのファイルの偽物のケース表を作る。
 * @returns {Array<{label: string, make: () => object}>} ケース（ファイルの偽物を作る関数つき）
 */
function foreignJsCases() {
    return [
        { label: '任意のJS', make: () => makeFile('foreign.js', 'console.log("hello");\n') },
        { label: '空の既定のexport', make: () => makeFile('foreign.js', 'export default {};\n') },
    ];
}

describe('CanvasFileOperations: 開く（スプライトのJS）', () => {
    const cases = [
        { label: '全部', shapes: makeShapes(), shapesData: null, kind: 'all' },
        { label: '一部', shapes: makeShapes().slice(0, 2), shapesData: 'partial', kind: 'partial' },
        { label: '図形0個', shapes: [], shapesData: null, kind: 'empty' },
    ];
    for (const { label, shapes, shapesData, kind } of cases) {
        for (const spriteCase of spriteFileCases(
            shapesData === 'partial'
                ? makeSpriteDataWithSourceShapes(shapes, [shapes[0].toJSON(), makeBadShapeData(), shapes[1].toJSON()])
                : SpriteSerializer.serialize(shapes)
        )) {
            it(`${label}（${spriteCase.label}）: 作業データファイルと同じ図形・同じ通知・名前はtoCanvasName`, async (t) => {
                silenceWarn(t);
                const workText = shapesData === 'partial'
                    ? makeTextWithShapesData([shapes[0].toJSON(), makeBadShapeData(), shapes[1].toJSON()])
                    : DocumentSerializer.serializeToString(shapes);
                const expected = createHarness();
                const expectedResult = await expected.ops.openFile(makeFile('work.json', workText));
                const h = createHarness();
                const result = await h.ops.openFile(spriteCase.make('ship.js'));
                assert.equal(result, expectedResult);
                assert.equal(h.createCalls.length, 1);
                assert.equal(h.createCalls[0].name, h.fileIO.toCanvasName('ship.js'));
                assert.deepStrictEqual(
                    h.createCalls[0].shapes.map((shape) => shape.toJSON()),
                    expected.createCalls[0].shapes.map((shape) => shape.toJSON())
                );
                const expectedNotice = expected.ops.getState().fileNotice;
                assert.deepStrictEqual(
                    h.ops.getState().fileNotice,
                    expectedNotice === null ? null : { ...expectedNotice, fileName: 'ship.js' }
                );
                assert.equal(h.ops.getState().fileNotice?.kind ?? null, kind === 'partial' ? 'partialRead' : null);
            });
        }
    }

    for (const { label, make } of foreignJsCases()) {
        it(`本アプリのものでないJS（${label}）: false・キャンバスを作らない・readFailed`, async (t) => {
            silenceWarn(t);
            const h = createHarness();
            const result = await h.ops.openFile(make());
            assert.equal(result, false);
            assert.equal(h.createCalls.length, 0);
            assert.deepStrictEqual(h.ops.getState().fileNotice, notice('readFailed', 'foreign.js', 0));
        });
    }

    for (const [label, shapes] of [['5種の図形', makeShapes()], ['図形0個', []]]) {
        it(`スプライトのJSON（ship.json、sourceあり・${label}）: false・キャンバスを作らない・readFailed`, async (t) => {
            silenceWarn(t);
            const h = createHarness();
            const result = await h.ops.openFile(makeFile('ship.json', SpriteSerializer.stringify(SpriteSerializer.serialize(shapes))));
            assert.equal(result, false);
            assert.equal(h.createCalls.length, 0);
            assert.deepStrictEqual(h.ops.getState().fileNotice, notice('readFailed', 'ship.json', 0));
        });
    }
});

describe('CanvasFileOperations: インポート（スプライトのJS）', () => {
    const cases = [
        { label: '全部', shapes: makeShapes(), spriteData: SpriteSerializer.serialize(makeShapes()), workShapesData: makeShapes().map((s) => s.toJSON()) },
        { label: '一部', shapes: makeShapes().slice(0, 2), spriteData: makeSpriteDataWithSourceShapes(makeShapes().slice(0, 2), [makeShapes()[0].toJSON(), makeBadShapeData(), makeShapes()[1].toJSON()]), workShapesData: 'partial' },
        { label: '図形0個', shapes: [], spriteData: SpriteSerializer.serialize([]), workShapesData: [] },
    ];
    for (const { label, shapes, spriteData, workShapesData } of cases) {
        for (const spriteCase of spriteFileCases(spriteData)) {
            it(`${label}（${spriteCase.label}）: 作業データファイルと同じ呼び出し・同じshapes・同じ通知`, async (t) => {
                silenceWarn(t);
                const workText = workShapesData === 'partial'
                    ? makeTextWithShapesData([shapes[0].toJSON(), makeBadShapeData(), shapes[1].toJSON()])
                    : makeTextWithShapesData(workShapesData);
                const expected = createHarness();
                const expectedResult = await expected.ops.importFile(makeFile('work.json', workText));
                const h = createHarness();
                const result = await h.ops.importFile(spriteCase.make('ship.js'));
                assert.equal(result, expectedResult);
                assert.deepStrictEqual(h.calls, expected.calls);
                assert.deepStrictEqual(
                    h.insertCalls.map((call) => ({ shapes: call.documentData.shapes, dx: call.dx, dy: call.dy })),
                    expected.insertCalls.map((call) => ({ shapes: call.documentData.shapes, dx: call.dx, dy: call.dy }))
                );
                const expectedNotice = expected.ops.getState().fileNotice;
                assert.deepStrictEqual(
                    h.ops.getState().fileNotice,
                    expectedNotice === null ? null : { ...expectedNotice, fileName: 'ship.js' }
                );
            });
        }
    }

    for (const { label, make } of foreignJsCases()) {
        it(`本アプリのものでないJS（${label}）: false・何も呼ばない・readFailed`, async (t) => {
            silenceWarn(t);
            const h = createHarness();
            const result = await h.ops.importFile(make());
            assert.equal(result, false);
            assert.deepStrictEqual(h.calls, []);
            assert.deepStrictEqual(h.ops.getState().fileNotice, notice('readFailed', 'foreign.js', 0));
        });
    }

    for (const [label, shapes] of [['5種の図形', makeShapes()], ['図形0個', []]]) {
        it(`スプライトのJSON（ship.json、sourceあり・${label}）: false・何も呼ばない・readFailed`, async (t) => {
            silenceWarn(t);
            const h = createHarness();
            const result = await h.ops.importFile(makeFile('ship.json', SpriteSerializer.stringify(SpriteSerializer.serialize(shapes))));
            assert.equal(result, false);
            assert.deepStrictEqual(h.calls, []);
            assert.deepStrictEqual(h.ops.getState().fileNotice, notice('readFailed', 'ship.json', 0));
        });
    }
});
