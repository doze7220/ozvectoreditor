/**
 * 責務: CanvasFileOperationsの出力（作業ファイル：exportCanvas／エンジン用：exportSprite）の手順（受理条件・ダウンロードの順序と引数・失敗時の通知）を、
 * 注入する依存の偽物と公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasFileOperations } from '../../js/edit/CanvasFileOperations.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { ShapeFactory } from '../../js/core/ShapeFactory.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 図形を1つ作る（id は文字列を直接代入する）。
 * @param {string} type - 図形種別
 * @param {string} id - 図形のid
 * @returns {object} 図形インスタンス
 */
function makeShape(type, id) {
    const shape = ShapeFactory.create(type, 10, 20, 60, 80);
    shape.updateDraftEnd(60, 80);
    shape.id = id;
    return shape;
}

/**
 * 注入する依存の偽物一式と、呼び出しの記録を新しく作る。
 * @param {object} [options] - 偽物の設定
 * @param {object[]} [options.shapes] - model.getShapes が返す図形
 * @param {object} [options.libraryState] - getState の上書き値
 * @param {string} [options.failOn] - 例外を投げるダウンロードのメソッド名
 * @returns {{
 *   ops: CanvasFileOperations,
 *   calls: Array<{method: string, text?: string, name?: string}>,
 *   other: string[],
 *   libraryState: object,
 *   fireChange: Function
 * }} 偽物を注入した CanvasFileOperations と記録
 */
function createHarness({ shapes = [], libraryState = {}, failOn = null } = {}) {
    const calls = [];
    const other = [];
    const state = {
        loading: false,
        busy: false,
        canManage: true,
        openCanvasId: 'canvas-a',
        openCanvasName: 'ship',
        canvases: [],
        issue: null,
        hasSaveProblem: false,
        ...libraryState,
    };
    let changeListener = () => {};
    /**
     * ダウンロードの偽物を作る。
     * @param {string} method - メソッド名
     * @returns {Function} 呼び出しを記録し、指定時は例外を投げる関数
     */
    const makeDownload = (method) => (text, name) => {
        calls.push({ method, text, name });
        if (failOn === method) {
            throw new Error(`${method} failed`);
        }
    };
    const fileIO = {
        downloadText: makeDownload('downloadText'),
        downloadSpriteModule: makeDownload('downloadSpriteModule'),
        downloadSpriteJson: makeDownload('downloadSpriteJson'),
        /**
         * @param {{name: string}} file - ファイルの偽物
         * @returns {string} ファイル名
         */
        getFileName: (file) => file.name,
        /**
         * @returns {Promise<string>} 不正な中身
         */
        readText: () => Promise.resolve('not json'),
        /**
         * @param {string} name - ファイル名
         * @returns {string} キャンバス名
         */
        toCanvasName: (name) => name,
    };
    const canvasLibrary = {
        /**
         * @returns {object} 新しい状態オブジェクト
         */
        getState: () => ({ ...state }),
        /**
         * @param {Function} listener - リスナー
         * @returns {void}
         */
        onChange: (listener) => {
            changeListener = listener;
        },
        /**
         * @returns {Promise<boolean>} 常に true
         */
        createCanvasFromShapes: () => {
            other.push('createCanvasFromShapes');
            return Promise.resolve(true);
        },
    };
    const inserter = {
        /**
         * @returns {object} 追加結果の偽物
         */
        insertDocument: () => {
            other.push('insertDocument');
            return { ok: true, insertedIds: [], skipped: [], error: null };
        },
    };
    const model = {
        /**
         * @returns {object[]} 図形一式
         */
        getShapes: () => shapes,
    };
    /**
     * @returns {void}
     */
    const prepareInsert = () => {
        other.push('prepareInsert');
    };
    const ops = new CanvasFileOperations({ fileIO, canvasLibrary, inserter, model, prepareInsert });
    return { ops, calls, other, libraryState: state, fireChange: () => changeListener() };
}

describe('CanvasFileOperations.exportSprite', () => {
    it('JS→JSONの順に、キャンバス名とともにダウンロードし、true を返す', () => {
        const shapes = [makeShape('line', 'a'), makeShape('circle', 'b')];
        const { ops, calls } = createHarness({ shapes });
        assert.equal(ops.exportSprite(), true);
        const spriteData = SpriteSerializer.serialize(shapes);
        assert.deepEqual(calls, [
            { method: 'downloadSpriteModule', text: CodeExporter.toModuleText(spriteData), name: 'ship' },
            { method: 'downloadSpriteJson', text: SpriteSerializer.stringify(spriteData), name: 'ship' },
        ]);
        assert.equal(ops.getState().fileNotice, null);
    });

    it('openCanvasName が null のときは空文字列を渡す', () => {
        const { ops, calls } = createHarness({ libraryState: { openCanvasName: null } });
        assert.equal(ops.exportSprite(), true);
        assert.deepEqual(calls.map((c) => c.name), ['', '']);
    });

    it('loading のとき不受理で、何も呼ばず通知も変えない', () => {
        const { ops, calls } = createHarness({ libraryState: { loading: true } });
        assert.equal(ops.exportSprite(), false);
        assert.deepEqual(calls, []);
        assert.equal(ops.getState().fileNotice, null);
    });

    it('busy のとき不受理で、何も呼ばない', () => {
        const { ops, calls } = createHarness({ libraryState: { busy: true } });
        assert.equal(ops.exportSprite(), false);
        assert.deepEqual(calls, []);
    });

    it("issue が 'unavailable'（canManage が偽）でも受理する", () => {
        const { ops, calls } = createHarness({ libraryState: { canManage: false, issue: 'unavailable' } });
        assert.equal(ops.exportSprite(), true);
        assert.equal(calls.length, 2);
    });

    it('図形が0個でも2つともダウンロードし、通知を出さない', () => {
        const { ops, calls } = createHarness({ shapes: [] });
        assert.equal(ops.exportSprite(), true);
        assert.deepEqual(calls.map((c) => c.method), ['downloadSpriteModule', 'downloadSpriteJson']);
        assert.equal(ops.getState().fileNotice, null);
        assert.equal(JSON.parse(calls[1].text).bounds, null);
    });

    it('組み立ての失敗ではどちらもダウンロードせず、通知 spriteExportFailed を出す', (t) => {
        const warn = silenceWarn(t);
        const { ops, calls } = createHarness({ shapes: [{}] });
        assert.equal(ops.exportSprite(), false);
        assert.deepEqual(calls, []);
        assert.deepEqual(ops.getState().fileNotice, { kind: 'spriteExportFailed', fileName: null, skippedCount: 0 });
        assert.equal(warn.mock.callCount(), 1);
    });

    it('JSのダウンロードが失敗したらJSONは呼ばず、通知を出す', (t) => {
        silenceWarn(t);
        const { ops, calls } = createHarness({ shapes: [makeShape('rect', 'a')], failOn: 'downloadSpriteModule' });
        assert.equal(ops.exportSprite(), false);
        assert.deepEqual(calls.map((c) => c.method), ['downloadSpriteModule']);
        assert.equal(ops.getState().fileNotice.kind, 'spriteExportFailed');
    });

    it('JSONのダウンロードが失敗したら通知を出す（JSは既に呼ばれている）', (t) => {
        silenceWarn(t);
        const { ops, calls } = createHarness({ shapes: [makeShape('rect', 'a')], failOn: 'downloadSpriteJson' });
        assert.equal(ops.exportSprite(), false);
        assert.deepEqual(calls.map((c) => c.method), ['downloadSpriteModule', 'downloadSpriteJson']);
        assert.deepEqual(ops.getState().fileNotice, { kind: 'spriteExportFailed', fileName: null, skippedCount: 0 });
    });

    it('受理時に既存の通知を消し、変更を通知する', async (t) => {
        silenceWarn(t);
        const { ops } = createHarness();
        await ops.openFile({ name: 'bad.json' });
        assert.equal(ops.getState().fileNotice.kind, 'readFailed');
        let notified = 0;
        ops.onChange(() => {
            notified += 1;
        });
        assert.equal(ops.exportSprite(), true);
        assert.equal(ops.getState().fileNotice, null);
        assert.ok(notified >= 1);
    });

    it('不受理のときは既存の通知を消さない', async (t) => {
        silenceWarn(t);
        const { ops, libraryState } = createHarness();
        await ops.openFile({ name: 'bad.json' });
        libraryState.busy = true;
        assert.equal(ops.exportSprite(), false);
        assert.equal(ops.getState().fileNotice.kind, 'readFailed');
    });

    it('prepareInsert・insertDocument・createCanvasFromShapes を呼ばず、図形を書き換えない', () => {
        const shapes = [makeShape('curve', 'a'), makeShape('arc', 'b')];
        const before = JSON.stringify(DocumentSerializer.serialize(shapes));
        const { ops, other } = createHarness({ shapes });
        ops.exportSprite();
        assert.deepEqual(other, []);
        assert.equal(JSON.stringify(DocumentSerializer.serialize(shapes)), before);
    });
});

describe('CanvasFileOperations.exportCanvas', () => {
    it('作業データのテキストとキャンバス名を downloadText へ渡し、true を返す', () => {
        const shapes = [makeShape('line', 'a')];
        const { ops, calls } = createHarness({ shapes });
        assert.equal(ops.exportCanvas(), true);
        assert.deepEqual(calls, [
            { method: 'downloadText', text: DocumentSerializer.serializeToString(shapes), name: 'ship' },
        ]);
    });

    it('loading・busy のとき不受理で何も呼ばない', () => {
        const a = createHarness({ libraryState: { loading: true } });
        assert.equal(a.ops.exportCanvas(), false);
        assert.deepEqual(a.calls, []);
        const b = createHarness({ libraryState: { busy: true } });
        assert.equal(b.ops.exportCanvas(), false);
        assert.deepEqual(b.calls, []);
    });

    it("issue が 'unavailable' でも受理する", () => {
        const { ops, calls } = createHarness({ libraryState: { canManage: false, issue: 'unavailable' } });
        assert.equal(ops.exportCanvas(), true);
        assert.equal(calls.length, 1);
    });

    it('ダウンロードの失敗では通知 exportFailed を出し、false を返す', (t) => {
        silenceWarn(t);
        const { ops } = createHarness({ failOn: 'downloadText' });
        assert.equal(ops.exportCanvas(), false);
        assert.deepEqual(ops.getState().fileNotice, { kind: 'exportFailed', fileName: null, skippedCount: 0 });
    });

    it('スプライト用のダウンロードを呼ばず、prepareInsert 等も呼ばない', () => {
        const { ops, calls, other } = createHarness();
        ops.exportCanvas();
        assert.deepEqual(calls.map((c) => c.method), ['downloadText']);
        assert.deepEqual(other, []);
    });
});
