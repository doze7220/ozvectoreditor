/**
 * 責務：ブラウザ内保存先（IndexedDB）へのキャンバス記録と最後に開いていたキャンバスの識別子の読み書きを担う。
 * IndexedDBのAPIを呼ぶ唯一のモジュール。作業データの中身は解釈しない。
 */

/**
 * ブラウザ内保存先（IndexedDB）の設定（唯一の定義箇所。exportしない）。
 *
 * - databaseName: データベース名。
 * - databaseVersion: データベースの版。現時点は版1のみ。
 * - canvasStoreName: キャンバス記録のオブジェクトストア名（`keyPath: 'id'`）。
 * - metaStoreName: 補助情報のオブジェクトストア名（キーは外部指定の文字列）。
 * - lastOpenedKey: metaストア内の「最後に開いていたキャンバスの識別子」のキー。
 *
 * 版を上げる手順:
 *   1. databaseVersionを+1する
 *   2. `#handleUpgrade`に、`event.oldVersion`に応じた旧版からの移行処理（ストアの追加・インデックスの作成等）を追加する
 *      （版1のストア作成は「無ければ作成」のため、旧版から順に適用されるよう条件を書くこと）
 * @type {Readonly<{databaseName: string, databaseVersion: number, canvasStoreName: string, metaStoreName: string, lastOpenedKey: string}>}
 */
const STORAGE_CONFIG = Object.freeze({
    databaseName: 'oz-vector-editor',
    databaseVersion: 1,
    canvasStoreName: 'canvases',
    metaStoreName: 'meta',
    lastOpenedKey: 'lastOpenedCanvasId'
});

/**
 * キャンバス記録：1つのキャンバスの保存単位。
 *
 * 保存しないもの：Undo/Redoの履歴、選択集合・ホバー・作成中の図形・選択矩形、ビュー変換（倍率・表示位置）、
 * クリップボード、操作モード。
 *
 * `document`は本モジュールでは中身を解釈せず、不透明なオブジェクトとしてそのまま保存先と受け渡す
 * （読み込み・旧版のマイグレーションは呼び出し側がDocumentSerializerを通して行う）。
 * `id`も不透明なキーとして扱い、形式を解釈しない（採番は呼び出し側の責務）。
 * @typedef {Object} CanvasRecord
 * @property {string} id キャンバスの識別子
 * @property {string} name キャンバス名
 * @property {number} updatedAt 最終更新日時（`Date.now()`のミリ秒）
 * @property {Object} document 作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値。版番号を含む）
 */

/**
 * ブラウザ内保存先（IndexedDB）への読み書きを行うクラス。
 *
 * 公開APIはいずれもPromiseを返し、失敗時はrejectする（捕捉・利用者への表示は呼び出し側の責務）。
 * `open()`が完了する前の読み書きの呼び出しはrejectする。
 *
 * 書き込み順序の保証:
 *   すべての読み書きは、メソッドの呼び出し時点で同期的にトランザクションを生成する（内部で`await`を挟まない）。
 *   IndexedDBは範囲が重なるreadwriteトランザクションを生成順に実行するため、書き込みは呼び出し順に反映される
 *   （呼び出し側（CanvasLibrary）の保存と切り替え・削除の順序保証はこの性質に依存する）。
 *
 * 依存の制約:
 *   - importを持たない。DOM・図形種別・図形固有のプロパティ名・作業データ形式の知識を持たない。
 */
export class CanvasStorage {
    /**
     * 開いたデータベース。`open()`の成功前は`null`。
     * @type {IDBDatabase|null}
     */
    #db = null;

    /**
     * 進行中または完了済みの`open()`のPromise（2回目以降の呼び出しで同じものを返すため）。失敗時は`null`へ戻す。
     * @type {Promise<void>|null}
     */
    #openPromise = null;

    /**
     * データベースを開く（ストアが無ければ作成する）。2回目以降の呼び出しは何もしない（同じPromiseを返す）。
     * `indexedDB`が使えない環境・開くことに失敗した場合（プライベートブラウズ等）はrejectする。
     * @returns {Promise<void>}
     */
    open() {
        if (this.#openPromise) {
            return this.#openPromise;
        }
        this.#openPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined' || !indexedDB) {
                reject(new Error('このブラウザではIndexedDBを利用できません。'));
                return;
            }
            let request;
            try {
                request = indexedDB.open(STORAGE_CONFIG.databaseName, STORAGE_CONFIG.databaseVersion);
            } catch (error) {
                reject(error);
                return;
            }
            request.onupgradeneeded = (event) => {
                this.#handleUpgrade(request.result, event);
            };
            request.onblocked = () => {
                console.warn('CanvasStorage: 他のタブがデータベースを使用中のため、開く処理が待機しています。');
            };
            request.onsuccess = () => {
                this.#db = request.result;
                resolve();
            };
            request.onerror = () => {
                reject(request.error || new Error('データベースを開けませんでした。'));
            };
        });
        this.#openPromise.catch(() => {
            this.#openPromise = null;
        });
        return this.#openPromise;
    }

    /**
     * 保存されているすべてのキャンバス記録を読み出す（並び順は保証しない。内容の検証は呼び出し側の責務）。
     * @returns {Promise<CanvasRecord[]>}
     */
    getAllRecords() {
        return this.#runTransaction([STORAGE_CONFIG.canvasStoreName], 'readonly', (transaction) => {
            const request = transaction.objectStore(STORAGE_CONFIG.canvasStoreName).getAll();
            return () => (Array.isArray(request.result) ? request.result : []);
        });
    }

    /**
     * 指定した識別子のキャンバス記録を読み出す。
     * @param {string} id キャンバスの識別子
     * @returns {Promise<CanvasRecord|null>} 記録が無ければ`null`
     */
    getRecord(id) {
        return this.#runTransaction([STORAGE_CONFIG.canvasStoreName], 'readonly', (transaction) => {
            const request = transaction.objectStore(STORAGE_CONFIG.canvasStoreName).get(id);
            return () => (request.result === undefined ? null : request.result);
        });
    }

    /**
     * キャンバス記録全体を書き込む（新規・上書き兼用）。
     * @param {CanvasRecord} record 書き込む記録
     * @returns {Promise<void>} トランザクションの完了で解決する
     */
    putRecord(record) {
        return this.#runTransaction([STORAGE_CONFIG.canvasStoreName], 'readwrite', (transaction) => {
            transaction.objectStore(STORAGE_CONFIG.canvasStoreName).put(record);
            return () => undefined;
        });
    }

    /**
     * キャンバス記録の名前のみを変更する（`updatedAt`・`document`は変えない）。
     * 1つのreadwriteトランザクション内で読み出し→名前の変更→書き込みを行う。
     * @param {string} id キャンバスの識別子
     * @param {string} name 新しいキャンバス名（検証は呼び出し側の責務）
     * @returns {Promise<boolean>} 記録が見つかり変更した場合`true`、記録が無ければ`false`
     */
    renameRecord(id, name) {
        return this.#runTransaction([STORAGE_CONFIG.canvasStoreName], 'readwrite', (transaction) => {
            const store = transaction.objectStore(STORAGE_CONFIG.canvasStoreName);
            const request = store.get(id);
            let found = false;
            request.onsuccess = () => {
                const record = request.result;
                if (record === undefined || record === null || typeof record !== 'object') {
                    return;
                }
                found = true;
                store.put({ ...record, name });
            };
            return () => found;
        });
    }

    /**
     * 指定した識別子のキャンバス記録を削除する（記録が無くても成功として解決する）。
     * @param {string} id キャンバスの識別子
     * @returns {Promise<void>} トランザクションの完了で解決する
     */
    deleteRecord(id) {
        return this.#runTransaction([STORAGE_CONFIG.canvasStoreName], 'readwrite', (transaction) => {
            transaction.objectStore(STORAGE_CONFIG.canvasStoreName).delete(id);
            return () => undefined;
        });
    }

    /**
     * 最後に開いていたキャンバスの識別子を読み出す。
     * @returns {Promise<string|null>} 保存されていない（または文字列でない）場合は`null`
     */
    getLastOpenedId() {
        return this.#runTransaction([STORAGE_CONFIG.metaStoreName], 'readonly', (transaction) => {
            const request = transaction.objectStore(STORAGE_CONFIG.metaStoreName).get(STORAGE_CONFIG.lastOpenedKey);
            return () => (typeof request.result === 'string' ? request.result : null);
        });
    }

    /**
     * 最後に開いていたキャンバスの識別子を書き込む。
     * @param {string} id キャンバスの識別子
     * @returns {Promise<void>} トランザクションの完了で解決する
     */
    setLastOpenedId(id) {
        return this.#runTransaction([STORAGE_CONFIG.metaStoreName], 'readwrite', (transaction) => {
            transaction.objectStore(STORAGE_CONFIG.metaStoreName).put(id, STORAGE_CONFIG.lastOpenedKey);
            return () => undefined;
        });
    }

    /**
     * データベースの版の更新時に、無いオブジェクトストアを作成する（現時点は版1のストア作成のみ）。
     * 版を上げる場合は、`event.oldVersion`に応じた移行処理をここへ追加する（STORAGE_CONFIGのJSDoc参照）。
     * @param {IDBDatabase} db 更新中のデータベース
     * @param {IDBVersionChangeEvent} event 版の更新イベント
     * @returns {void}
     */
    #handleUpgrade(db, event) {
        void event;
        if (!db.objectStoreNames.contains(STORAGE_CONFIG.canvasStoreName)) {
            db.createObjectStore(STORAGE_CONFIG.canvasStoreName, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORAGE_CONFIG.metaStoreName)) {
            db.createObjectStore(STORAGE_CONFIG.metaStoreName);
        }
    }

    /**
     * トランザクションを呼び出し時点で同期的に生成して要求を発行し、トランザクションの完了をPromiseへ包む。
     * `operate`は生成したトランザクションへ要求を発行し、完了時に結果を返す関数を返す。
     * 完了（`oncomplete`）で結果を返して解決し、`onerror`/`onabort`でrejectする。
     * `open()`の完了前・トランザクションの生成に失敗した場合はrejectする。
     * @template T
     * @param {string[]} storeNames 対象のオブジェクトストア名
     * @param {IDBTransactionMode} mode `'readonly'`または`'readwrite'`
     * @param {(transaction: IDBTransaction) => (() => T)} operate 要求の発行と結果の取り出し関数の生成
     * @returns {Promise<T>}
     */
    #runTransaction(storeNames, mode, operate) {
        if (!this.#db) {
            return Promise.reject(new Error('CanvasStorage: open()の完了前に読み書きは行えません。'));
        }
        let transaction;
        let readResult;
        try {
            transaction = this.#db.transaction(storeNames, mode);
            readResult = operate(transaction);
        } catch (error) {
            if (transaction) {
                try {
                    transaction.abort();
                } catch (abortError) {
                    void abortError;
                }
            }
            return Promise.reject(error);
        }
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => {
                resolve(readResult());
            };
            transaction.onerror = () => {
                reject(transaction.error || new Error('CanvasStorage: 読み書きに失敗しました。'));
            };
            transaction.onabort = () => {
                reject(transaction.error || new Error('CanvasStorage: 読み書きが中断されました。'));
            };
        });
    }
}
