/**
 * 責務: CanvasFileOperationsが入れ子の作業データ（名前・表示・ロック・フォルダ）を出力・開く・インポートで保つことと、フォルダだけ・不備のあるファイルの件数の扱いを検証する。
 * 実物のVectorModel・ShapeInserter・HistoryManager・SnapshotAdapterを組み合わせ、ダウンロード・キャンバス管理だけ偽物にする。公開APIだけを通す。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasFileOperations } from '../../js/edit/CanvasFileOperations.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * idを直接代入した矩形を作る。
 * @param {string} id - 代入するid
 * @param {number} x - 左上のx（幅・高さは10）
 * @returns {Rect} 矩形
 */
function makeRect(id, x) {
    const rect = new Rect(x, 0, x + 10, 10, '#112233', 2, null);
    rect.id = id;
    return rect;
}

/**
 * 入れ子（フォルダ1つ＋その中の図形2つ＋外の図形1つ。名前・表示・ロックつき）のアイテムを作る。
 * @returns {object[]} アイテムの入れ子
 */
function nestedItems() {
    return [
        {
            kind: 'group', id: 'group-1', name: '親', visible: false, locked: true, children: [
                { kind: 'shape', shape: makeRect('shape-1', 0), name: '甲', visible: false, locked: true },
                { kind: 'shape', shape: makeRect('shape-2', 20), name: '乙', visible: true, locked: false }
            ]
        },
        { kind: 'shape', shape: makeRect('shape-3', 40), name: '丙', visible: true, locked: true }
    ];
}

/**
 * 実物を組み合わせた手順を作る。`model`にアイテムを入れ、ダウンロードの内容とキャンバスを開く呼び出しを記録する。
 * @returns {object} 手順・実物・記録
 */
function setup() {
    const model = new VectorModel();
    model.replaceAllShapes(nestedItems());
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    const downloads = [];
    const opened = [];
    const fileIO = {
        /**
         * @param {{name: string}} file - ファイルの偽物
         * @returns {string} ファイル名
         */
        getFileName: (file) => file.name,
        /**
         * @param {{text: string}} file - ファイルの偽物
         * @returns {Promise<string>} 中身
         */
        readText: (file) => Promise.resolve(file.text),
        /**
         * @param {string} name - ファイル名
         * @returns {string} キャンバス名
         */
        toCanvasName: (name) => name,
        /**
         * @param {string} text - 中身
         * @param {string} name - 名前
         * @returns {void}
         */
        downloadText: (text, name) => {
            downloads.push({ name, text });
        },
        /**
         * @param {string} text - JSの中身
         * @param {string} name - 名前
         * @returns {void}
         */
        downloadSpriteModule: (text, name) => {
            downloads.push({ name, text });
        }
    };
    const canvasLibrary = {
        /**
         * @returns {object} 状態
         */
        getState: () => ({
            loading: false, busy: false, canManage: true, openCanvasId: 'c', openCanvasName: 'C',
            canvases: [], issue: null, hasSaveProblem: false
        }),
        /**
         * @returns {void}
         */
        onChange: () => {},
        /**
         * @param {string} name - 名前
         * @param {object[]} received - 渡されたアイテム
         * @returns {Promise<boolean>} 常に true
         */
        createCanvasFromShapes: (name, received) => {
            opened.push({ name, items: received });
            return Promise.resolve(true);
        }
    };
    const ops = new CanvasFileOperations({ fileIO, canvasLibrary, inserter, model, prepareInsert: () => {} });
    return { ops, model, history, downloads, opened };
}

/**
 * アイテムの入れ子を、作業データの`shapes`部分のJSON文字列にする（順序・値の比較用）。
 * @param {object[]} items - アイテムの入れ子
 * @returns {string} JSON文字列
 */
function shapesJson(items) {
    return JSON.stringify(DocumentSerializer.serialize(items).shapes);
}

/**
 * 図形の要素（作業データ）を1つ作る。
 * @param {string} id - id
 * @returns {object} 図形の要素
 */
function shapeElement(id) {
    return { ...makeRect(id, 0).toJSON(), name: '', visible: true, locked: false };
}

/**
 * 作業データのJSON文字列を`shapes`の配列から作る。
 * @param {object[]} shapes - 最上位の要素の配列
 * @returns {string} JSON文字列
 */
function textOf(shapes) {
    return JSON.stringify({ ...DocumentSerializer.serialize([]), shapes });
}

describe('CanvasFileOperations: 入れ子の出力→開く・インポート', () => {
    it('出力（作業ファイル）→開く: 入れ子・名前・表示・ロックが保たれる', async (t) => {
        silenceWarn(t);
        const h = setup();
        h.ops.exportCanvas();
        assert.equal(h.downloads.length, 1);
        const result = await h.ops.openFile({ name: 'n.json', text: h.downloads[0].text });
        assert.equal(result, true);
        assert.equal(h.opened.length, 1);
        assert.equal(shapesJson(h.opened[0].items), shapesJson(h.model.getItems()));
        assert.equal(h.ops.getState().fileNotice, null);
    });

    it('出力（作業ファイル）→インポート: 入れ子ごと追加され名前・表示・ロックが保たれる', async (t) => {
        silenceWarn(t);
        const h = setup();
        h.ops.exportCanvas();
        const before = h.model.getItems().length;
        const result = await h.ops.importFile({ name: 'n.json', text: h.downloads[0].text });
        assert.equal(result, true);
        const items = h.model.getItems();
        assert.equal(items.length, before + 2);
        const group = items[2];
        assert.equal(group.kind, 'group');
        assert.equal(group.name, '親');
        assert.equal(group.visible, false);
        assert.equal(group.locked, true);
        assert.deepStrictEqual(group.children.map((c) => [c.name, c.visible, c.locked]), [['甲', false, true], ['乙', true, false]]);
        assert.equal(items[3].name, '丙');
        assert.equal(h.model.getShapes().length, 6);
    });

    it('出力（エンジン用）のJS→開く・インポートも同じ', async (t) => {
        silenceWarn(t);
        const h = setup();
        h.ops.exportSprite();
        assert.equal(h.downloads.length, 1);
        const text = h.downloads[0].text;
        const opened = await h.ops.openFile({ name: 's.js', text });
        assert.equal(opened, true);
        assert.equal(shapesJson(h.opened[0].items), shapesJson(h.model.getItems()));
        const imported = await h.ops.importFile({ name: 's.js', text });
        assert.equal(imported, true);
        const items = h.model.getItems();
        assert.equal(items.length, 4);
        assert.equal(items[2].kind, 'group');
        assert.equal(items[2].name, '親');
        assert.equal(items[3].name, '丙');
    });

    it('インポートの取り消し: 入れ子ごと元へ戻り、やり直しで再び入る', async (t) => {
        silenceWarn(t);
        const h = setup();
        h.ops.exportCanvas();
        const original = shapesJson(h.model.getItems());
        await h.ops.importFile({ name: 'n.json', text: h.downloads[0].text });
        const imported = shapesJson(h.model.getItems());
        assert.notEqual(imported, original);
        assert.equal(h.history.undo(), true);
        assert.equal(shapesJson(h.model.getItems()), original);
        assert.equal(h.history.redo(), true);
        assert.equal(shapesJson(h.model.getItems()), imported);
    });
});

describe('CanvasFileOperations: フォルダだけ・不備のあるファイル', () => {
    const emptyGroup = { type: 'group', id: 'group-9', name: 'から', visible: true, locked: false, children: [] };

    it('フォルダだけのファイル: 開く＝フォルダごと開く・通知なし', async (t) => {
        silenceWarn(t);
        const h = setup();
        const result = await h.ops.openFile({ name: 'f.json', text: textOf([emptyGroup]) });
        assert.equal(result, true);
        assert.equal(h.opened.length, 1);
        assert.equal(h.opened[0].items.length, 1);
        assert.equal(h.opened[0].items[0].kind, 'group');
        assert.equal(h.ops.getState().fileNotice, null);
    });

    it('フォルダだけのファイル: インポート＝noShapes・何も変えず記録しない', async (t) => {
        silenceWarn(t);
        const h = setup();
        const before = shapesJson(h.model.getItems());
        const result = await h.ops.importFile({ name: 'f.json', text: textOf([emptyGroup]) });
        assert.equal(result, false);
        assert.deepStrictEqual(h.ops.getState().fileNotice, { kind: 'noShapes', fileName: 'f.json', skippedCount: 0 });
        assert.equal(shapesJson(h.model.getItems()), before);
        assert.equal(h.history.canUndo(), false);
    });

    it('childrenが不備のフォルダと入れ子の中の読めない図形: partialReadの件数は読み飛ばした合計', async (t) => {
        silenceWarn(t);
        const h = setup();
        const badGroup = { type: 'group', id: 'group-8', name: '', visible: true, locked: false, children: 'x' };
        const nested = {
            type: 'group', id: 'group-7', name: '', visible: true, locked: false,
            children: [shapeElement('shape-1'), { type: 'triangle', id: 'x', points: [] }]
        };
        const result = await h.ops.openFile({ name: 'p.json', text: textOf([badGroup, nested, shapeElement('shape-2')]) });
        assert.equal(result, true);
        assert.equal(h.opened[0].items.length, 2);
        assert.deepStrictEqual(h.ops.getState().fileNotice, { kind: 'partialRead', fileName: 'p.json', skippedCount: 2 });
    });

    it('図形がすべて読めないフォルダ: readFailed・キャンバスを作らない', async (t) => {
        silenceWarn(t);
        const h = setup();
        const badGroup = { type: 'group', id: 'group-8', name: '', visible: true, locked: false, children: 'x' };
        const nested = {
            type: 'group', id: 'group-7', name: '', visible: true, locked: false,
            children: [{ type: 'triangle', id: 'x', points: [] }]
        };
        const result = await h.ops.openFile({ name: 'b.json', text: textOf([badGroup, nested]) });
        assert.equal(result, false);
        assert.equal(h.opened.length, 0);
        assert.deepStrictEqual(h.ops.getState().fileNotice, { kind: 'readFailed', fileName: 'b.json', skippedCount: 0 });
    });
});
