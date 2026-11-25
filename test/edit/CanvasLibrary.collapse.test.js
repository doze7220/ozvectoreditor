/**
 * 責務: CanvasLibrary.requestSave()による折りたたみの自動保存（記録のcollapsed・履歴が増えないこと・切り替えと開く（ファイル）での保持）を検証する。
 * 実物のVectorModel・HistoryManager・SnapshotAdapterとメモリ上の偽の保存先を組み合わせ、公開APIだけを通す。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasLibrary } from '../../js/edit/CanvasLibrary.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
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
 * フォルダ1つ（中に図形2つ）と外の図形1つのアイテムを作る。
 * @param {boolean} collapsed - フォルダを閉じて作るか
 * @returns {object[]} アイテムの入れ子
 */
function folderItems(collapsed) {
    const group = {
        kind: 'group', id: 'group-1', name: '親', visible: true, locked: false, children: [
            { kind: 'shape', shape: makeRect('shape-1', 0), name: '甲', visible: true, locked: false },
            { kind: 'shape', shape: makeRect('shape-2', 20), name: '乙', visible: true, locked: false }
        ]
    };
    if (collapsed) {
        group.collapsed = true;
    }
    return [group, { kind: 'shape', shape: makeRect('shape-3', 40), name: '丙', visible: true, locked: false }];
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
 * 実物を組み合わせた`CanvasLibrary`を作り、折りたたみの通知を`requestSave()`へつなぐ。
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
    model.onCollapsedChange(() => library.requestSave());
    return { library, model, history, storage };
}

/**
 * 記録の最初のフォルダ要素を返す。
 * @param {object} storage - 偽の保存先
 * @param {string} id - キャンバスの識別子
 * @returns {object} フォルダの要素
 */
function groupElement(storage, id) {
    return storage.records.get(id).document.shapes[0];
}

describe('CanvasLibrary.requestSave: 折りたたみの自動保存', () => {
    it('setGroupCollapsed→flushPendingSave: 記録にcollapsedが出る。開くと消える。履歴は増えない', async (t) => {
        silenceWarn(t);
        const { library, model, history, storage } = setup();
        await library.start();
        await library.createCanvasFromShapes('f', folderItems(false));
        const id = library.getState().openCanvasId;
        assert.equal(await library.flushPendingSave(), true);
        assert.equal('collapsed' in groupElement(storage, id), false);
        assert.equal(history.canUndo(), false);

        assert.equal(model.setGroupCollapsed('group-1', true), true);
        assert.equal(await library.flushPendingSave(), true);
        assert.equal(groupElement(storage, id).collapsed, true);
        assert.equal(history.canUndo(), false);

        assert.equal(model.setGroupCollapsed('group-1', false), true);
        assert.equal(await library.flushPendingSave(), true);
        assert.equal('collapsed' in groupElement(storage, id), false);
        assert.equal(history.canUndo(), false);
    });

    it('選択で閉じたフォルダが自動で開く: 記録のcollapsedが消える', async (t) => {
        silenceWarn(t);
        const { library, model, storage } = setup();
        await library.start();
        await library.createCanvasFromShapes('f', folderItems(true));
        const id = library.getState().openCanvasId;
        assert.equal(await library.flushPendingSave(), true);
        assert.equal(groupElement(storage, id).collapsed, true);

        model.setSelection(['shape-1']);
        assert.equal(await library.flushPendingSave(), true);
        assert.equal('collapsed' in groupElement(storage, id), false);
    });

    it('キャンバスを切り替えて戻る: 折りたたみが保たれる', async (t) => {
        silenceWarn(t);
        const { library, model, storage } = setup();
        await library.start();
        await library.createCanvasFromShapes('f', folderItems(false));
        const id = library.getState().openCanvasId;
        model.setGroupCollapsed('group-1', true);
        assert.equal(await library.createCanvas(), true);
        assert.equal(groupElement(storage, id).collapsed, true);
        assert.equal(await library.openCanvas(id), true);
        assert.equal(model.getItems()[0].collapsed, true);
        assert.equal(await library.flushPendingSave(), true);
    });

    it('開く（ファイル）: 閉じたフォルダを持つ図形が閉じたまま記録・復元される', async (t) => {
        silenceWarn(t);
        const { library, model, storage } = setup();
        await library.start();
        assert.equal(await library.createCanvasFromShapes('f', folderItems(true)), true);
        const id = library.getState().openCanvasId;
        assert.equal(groupElement(storage, id).collapsed, true);
        assert.equal(model.getItems()[0].collapsed, true);
        assert.equal(await library.flushPendingSave(), true);
    });

    it('切り替えだけでは折りたたみの通知が起きない', async (t) => {
        silenceWarn(t);
        const { library, model } = setup();
        await library.start();
        await library.createCanvasFromShapes('f', folderItems(true));
        const id = library.getState().openCanvasId;
        await library.flushPendingSave();
        let count = 0;
        model.onCollapsedChange(() => {
            count += 1;
        });
        await library.createCanvas();
        await library.openCanvas(id);
        assert.equal(count, 0);
        assert.equal(await library.flushPendingSave(), true);
    });

    it('読み込み完了前のrequestSave(): 何もしない（保留も未保存も生じない）', async () => {
        const { library, storage } = setup();
        library.requestSave();
        assert.equal(await library.flushPendingSave(), true);
        assert.equal(storage.records.size, 0);
        assert.equal(library.hasUnsavedChanges(), false);
    });
});
