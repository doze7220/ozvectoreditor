/**
 * 責務: CanvasLibraryが入れ子のアイテム（名前・表示・ロック・フォルダ）を、開く（ファイル）・自動保存・切り替えで記録の作業データとモデルに保つことを検証する。
 * 実物のVectorModel・HistoryManager・SnapshotAdapterとメモリ上の偽の保存先を組み合わせ、公開APIだけを通す。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasLibrary } from '../../js/edit/CanvasLibrary.js';
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
 * メモリ上の偽の保存先を作る（`CanvasStorage`と同じ公開操作）。
 * @returns {object} 偽の保存先（`records`に記録を持つ）
 */
function createFakeStorage() {
    const records = new Map();
    let lastOpenedId = null;
    return {
        records,
        /**
         * @returns {Promise<void>} 即時に解決
         */
        open: () => Promise.resolve(),
        /**
         * @returns {Promise<object[]>} 記録の配列
         */
        getAllRecords: () => Promise.resolve([...records.values()]),
        /**
         * @returns {Promise<string|null>} 最後に開いたキャンバスの識別子
         */
        getLastOpenedId: () => Promise.resolve(lastOpenedId),
        /**
         * @param {string} id - 識別子
         * @returns {Promise<object|undefined>} 記録
         */
        getRecord: (id) => Promise.resolve(records.get(id)),
        /**
         * @param {object} record - 記録
         * @returns {Promise<void>} 即時に解決
         */
        putRecord: (record) => {
            records.set(record.id, JSON.parse(JSON.stringify(record)));
            return Promise.resolve();
        },
        /**
         * @returns {Promise<void>} 即時に解決
         */
        renameRecord: () => Promise.resolve(),
        /**
         * @param {string} id - 識別子
         * @returns {Promise<void>} 即時に解決
         */
        deleteRecord: (id) => {
            records.delete(id);
            return Promise.resolve();
        },
        /**
         * @param {string} id - 識別子
         * @returns {Promise<void>} 即時に解決
         */
        setLastOpenedId: (id) => {
            lastOpenedId = id;
            return Promise.resolve();
        }
    };
}

/**
 * 実物を組み合わせた`CanvasLibrary`を作る。
 * @returns {object} ライブラリ・モデル・履歴・保存先
 */
function setup() {
    const model = new VectorModel();
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const storage = createFakeStorage();
    const library = new CanvasLibrary({
        storage,
        model,
        historyManager: history,
        prepareSwitch: () => {},
        resetView: () => {},
        confirmOpenUnsaved: () => true
    });
    return { library, model, history, storage };
}

/**
 * アイテムの入れ子を、作業データのJSON文字列にする（比較用）。
 * @param {object[]} items - アイテムの入れ子
 * @returns {string} JSON文字列
 */
function documentJson(items) {
    return JSON.stringify(DocumentSerializer.serialize(items));
}

describe('CanvasLibrary: 入れ子のアイテムの保存と復元', () => {
    it('開く（ファイル）→編集→flushPendingSave→別のキャンバス→戻る: 記録のdocumentとgetItems()が保たれる', async (t) => {
        silenceWarn(t);
        const { library, model, history, storage } = setup();
        await library.start();
        assert.equal(await library.createCanvasFromShapes('ファイル由来', nestedItems()), true);
        const fileCanvasId = library.getState().openCanvasId;
        assert.equal(documentJson(model.getItems()), documentJson(nestedItems()));

        history.beginEdit();
        model.moveShapes(['shape-2'], 5, 7);
        assert.equal(history.commitEdit(), true);
        assert.equal(await library.flushPendingSave(), true);

        const expected = documentJson(model.getItems());
        const record = storage.records.get(fileCanvasId);
        assert.equal(JSON.stringify(record.document), expected);
        assert.equal(record.document.shapes[0].type, 'group');
        assert.equal(record.document.shapes[0].children[0].name, '甲');
        assert.equal(record.document.shapes[0].children[0].visible, false);
        assert.equal(record.document.shapes[0].children[0].locked, true);

        assert.equal(await library.createCanvas(), true);
        assert.deepStrictEqual(model.getItems(), []);
        assert.equal(await library.openCanvas(fileCanvasId), true);
        assert.equal(documentJson(model.getItems()), expected);
        assert.equal(model.getItems()[0].kind, 'group');
        assert.equal(model.getItems()[0].children[1].name, '乙');
        assert.equal(await library.flushPendingSave(), true);
    });

    it('開く（ファイル）直後の記録: フォルダの入れ子・フォルダのid・名前・表示・ロックを含む', async (t) => {
        silenceWarn(t);
        const { library, storage } = setup();
        await library.start();
        await library.createCanvasFromShapes('f', nestedItems());
        const record = storage.records.get(library.getState().openCanvasId);
        assert.equal(JSON.stringify(record.document), documentJson(nestedItems()));
        assert.equal(record.document.shapes[0].id, 'group-1');
        assert.equal(record.document.shapes[0].name, '親');
        assert.equal(await library.flushPendingSave(), true);
    });

    it('起動時の復元: 最後に開いていた記録の入れ子がモデルに入る', async (t) => {
        silenceWarn(t);
        const first = setup();
        await first.library.start();
        await first.library.createCanvasFromShapes('f', nestedItems());
        const id = first.library.getState().openCanvasId;
        const doc = JSON.parse(JSON.stringify(first.storage.records.get(id).document));
        await first.library.flushPendingSave();

        const second = setup();
        second.storage.records.set(id, { id, name: 'f', updatedAt: 1, document: doc });
        await second.library.start();
        assert.equal(second.library.getState().openCanvasId, id);
        assert.equal(documentJson(second.model.getItems()), documentJson(nestedItems()));
        assert.equal(second.model.getItems()[0].children.length, 2);
        await second.library.flushPendingSave();
    });
});
