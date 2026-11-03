/**
 * 責務：編集操作の履歴（スナップショットの前後の組の列・取り消し/やり直しの位置・上限）の保持と、記録・取り消し・やり直し・リセット・可否の照会を担う。
 * スナップショットの取得・適用の実体は注入された関数へ委譲し、DOM・図形種別・作業データの中身を知らない。
 */

/**
 * 取り消せる編集操作の上限件数。超えたら最古から捨てる。唯一の定義箇所。
 * @type {number}
 */
export const HISTORY_LIMIT = 100;

/**
 * スナップショット：ある時点の図形一式と選択集合。
 * @typedef {Object} Snapshot
 * @property {Object} document 作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）。
 *     本クラスは中身を解釈しない（記録時の比較のための文字列化のみ行う）。
 * @property {string[]} selectedIds その時点の選択集合（図形idの配列）。
 *     前の状態＝編集操作の開始時（`beginEdit()`呼び出し時）、後の状態＝編集操作の完了時（`commitEdit()`呼び出し時）の選択集合。
 */

/**
 * 履歴のエントリ：1件の編集操作の前後の状態の組。
 * 前後両方を持つことで、エントリ間で「前のafter」と「次のbefore」が一致しない場合でも、
 * 取り消し・やり直しがそれぞれ正しい状態へ戻る。
 * @typedef {Object} HistoryEntry
 * @property {Snapshot} before 編集操作の前の状態（取り消しで適用する）
 * @property {Snapshot} after 編集操作の後の状態（やり直しで適用する）
 */

/**
 * HistoryManagerへ注入する、スナップショットの取得・適用の関数。
 * @typedef {Object} HistoryCallbacks
 * @property {() => Snapshot} capture 現在の図形一式と選択集合のスナップショットを取得する
 * @property {(snapshot: Snapshot) => boolean} restore スナップショットをキャンバスへ適用する。
 *     適用したら`true`、キャンバスを変更しなかったら（失敗時）`false`を返す
 */

/**
 * 編集操作の履歴を保持し、記録・取り消し・やり直し・リセット・可否の照会を行うクラス（スナップショット方式）。
 *
 * - 履歴は「エントリ（`{ before, after }`）の配列」と「適用済みエントリ数（位置）」で保持する。
 *   取り消し可能 ⇔ 位置 > 0、やり直し可能 ⇔ 位置 < エントリ数。
 * - `model.onChange`ごとの記録は行わず、`beginEdit()`／`commitEdit()`の明示呼び出しでのみ記録する。
 * - スナップショットの取得・適用は注入された`capture`／`restore`へ委譲する。
 * - DOMに触れない。図形種別・図形固有のプロパティ名を持たない（作業データの中身を解釈しない）。
 * - 進行中の入力操作の中断は呼び出し側の責務（本クラスは行わない）。
 * - 履歴はメモリ上にのみ保持し、保存しない。
 */
export class HistoryManager {
    /**
     * @type {() => Snapshot} 注入されたスナップショットの取得関数
     * @private
     */
    #capture;

    /**
     * @type {(snapshot: Snapshot) => boolean} 注入されたスナップショットの適用関数
     * @private
     */
    #restore;

    /**
     * @type {Array<HistoryEntry>} 履歴のエントリ列（古い順。最大HISTORY_LIMIT件）
     * @private
     */
    #entries = [];

    /**
     * @type {number} 適用済みエントリ数（取り消し/やり直しの位置。0〜#entries.length）
     * @private
     */
    #cursor = 0;

    /**
     * @type {Snapshot|null} 記録中の編集操作の「前の状態」（beginEdit〜commitEditの間のみ保持。それ以外はnull）
     * @private
     */
    #pendingBefore = null;

    /**
     * @type {Array<Function>} 履歴の状態変化時に呼び出すリスナーの配列
     * @private
     */
    #listeners = [];

    /**
     * @param {HistoryCallbacks} callbacks スナップショットの取得・適用の関数
     * @throws {Error} `capture`または`restore`が関数でない場合
     */
    constructor({ capture, restore } = {}) {
        if (typeof capture !== 'function' || typeof restore !== 'function') {
            throw new Error('HistoryManager: capture と restore には関数を指定してください。');
        }
        this.#capture = capture;
        this.#restore = restore;
    }

    /**
     * 編集操作の開始を宣言する。
     * この時点のスナップショットを取得・凍結し「前の状態」として保持する。
     * 既に記録中の編集操作がある場合は`console.warn`して上書きする。
     * 変更通知は行わない。
     */
    beginEdit() {
        if (this.#pendingBefore !== null) {
            console.warn('HistoryManager.beginEdit: 確定されていない編集操作があったため、前の状態を上書きします。');
        }
        this.#pendingBefore = this.#takeSnapshot();
    }

    /**
     * 編集操作の確定を宣言する。
     * この時点のスナップショットを「後の状態」として取得し、前後の作業データ部分（`document`）を
     * `JSON.stringify`の結果で比較する（選択集合は比較しない：選択の変更のみは編集操作ではないため）。
     * - 同一なら記録せず`false`を返す（やり直しの履歴も破棄しない。変更通知もしない）。
     * - 異なれば、やり直しの履歴（位置より後のエントリ）を破棄してから1件のエントリとして記録し、
     *   上限（HISTORY_LIMIT）を超えた分を最古から破棄して、変更通知し`true`を返す。
     * - 記録中の編集操作がない（beginEditが呼ばれていない）場合は`console.warn`して`false`を返す。
     * いずれの場合も、記録中の「前の状態」を破棄する。
     * @returns {boolean} 1件のエントリとして記録したか
     */
    commitEdit() {
        const before = this.#pendingBefore;
        this.#pendingBefore = null;
        if (before === null) {
            console.warn('HistoryManager.commitEdit: beginEdit が呼ばれていないため記録しません。');
            return false;
        }

        const after = this.#takeSnapshot();
        if (JSON.stringify(before.document) === JSON.stringify(after.document)) {
            return false;
        }

        // やり直しの履歴を破棄してから追加する
        this.#entries.length = this.#cursor;
        this.#entries.push(Object.freeze({ before, after }));
        // 上限を超えた分を最古から捨てる
        if (this.#entries.length > HISTORY_LIMIT) {
            this.#entries.splice(0, this.#entries.length - HISTORY_LIMIT);
        }
        this.#cursor = this.#entries.length;

        this.#notifyChange();
        return true;
    }

    /**
     * 取り消し：1つ前の状態（位置の直前のエントリの`before`）を適用する。
     * 受理条件：取り消し可能（位置 > 0）であること。不可なら何もせず`false`。
     * `restore`が`false`を返した（適用に失敗した）場合は位置を動かさず、変更通知もせず`false`を返す。
     * 成功したら位置を1減らし、変更通知して`true`を返す。
     * 冒頭で記録中の編集操作が残っていれば`console.warn`して破棄する（通常は起こらない）。
     * 進行中の入力操作の中断は呼び出し側が本メソッドより前に行うこと。
     * @returns {boolean} 取り消しを適用したか
     */
    undo() {
        this.#discardPendingWithWarning('undo');
        if (!this.canUndo()) {
            return false;
        }
        if (!this.#restore(this.#entries[this.#cursor - 1].before)) {
            return false;
        }
        this.#cursor -= 1;
        this.#notifyChange();
        return true;
    }

    /**
     * やり直し：取り消した状態（位置のエントリの`after`）を再び適用する。
     * 受理条件：やり直し可能（位置 < エントリ数）であること。不可なら何もせず`false`。
     * `restore`が`false`を返した（適用に失敗した）場合は位置を動かさず、変更通知もせず`false`を返す。
     * 成功したら位置を1増やし、変更通知して`true`を返す。
     * 冒頭で記録中の編集操作が残っていれば`console.warn`して破棄する（通常は起こらない）。
     * 進行中の入力操作の中断は呼び出し側が本メソッドより前に行うこと。
     * @returns {boolean} やり直しを適用したか
     */
    redo() {
        this.#discardPendingWithWarning('redo');
        if (!this.canRedo()) {
            return false;
        }
        if (!this.#restore(this.#entries[this.#cursor].after)) {
            return false;
        }
        this.#cursor += 1;
        this.#notifyChange();
        return true;
    }

    /**
     * 取り消し可能か（取り消せる履歴があるか）を返す。
     * @returns {boolean} 位置 > 0 なら`true`
     */
    canUndo() {
        return this.#cursor > 0;
    }

    /**
     * やり直し可能か（やり直せる履歴があるか）を返す。
     * @returns {boolean} 位置 < エントリ数 なら`true`
     */
    canRedo() {
        return this.#cursor < this.#entries.length;
    }

    /**
     * 履歴を空にする。全エントリと記録中の編集操作（前の状態）を破棄し、取り消し・やり直しとも不可にする。
     * 図形一式・選択集合には触れない。
     * 実際に何かを破棄した（エントリまたは記録中の編集操作があった）場合のみ変更通知する。
     * キャンバスを開く・新規作成時に呼ぶ前提（Phase 03-04・03-05で接続）。
     */
    clear() {
        const hadAnything = this.#entries.length > 0 || this.#pendingBefore !== null;
        this.#entries = [];
        this.#cursor = 0;
        this.#pendingBefore = null;
        if (hadAnything) {
            this.#notifyChange();
        }
    }

    /**
     * 履歴の状態（canUndo／canRedoに影響し得るエントリ列・位置）の変化時に呼び出されるリスナーを登録する。
     * 通知されるのは、記録時・取り消し/やり直しの適用成功時・clear()で実際に破棄したときのみ。
     * beginEdit()・記録しなかったcommitEdit()・適用に失敗したundo()/redo()では通知しない。
     * @param {Function} listener 登録するリスナー（関数以外は無視する）
     */
    onChange(listener) {
        if (typeof listener === 'function') {
            this.#listeners.push(listener);
        }
    }

    /**
     * 登録されたすべてのリスナーに変更を通知する。
     * @private
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
    }

    /**
     * 記録中の編集操作が残っていれば`console.warn`して破棄する（undo/redoの冒頭で使用）。
     * @param {string} methodName 警告文に含める呼び出し元メソッド名
     * @private
     */
    #discardPendingWithWarning(methodName) {
        if (this.#pendingBefore !== null) {
            console.warn(`HistoryManager.${methodName}: 確定されていない編集操作を破棄します。`);
            this.#pendingBefore = null;
        }
    }

    /**
     * 注入された`capture()`でスナップショットを取得し、再帰的に凍結して返す。
     * 凍結により、保持後のスナップショットが書き換えられないことを保証する（書き換えはstrict modeで例外になる）。
     * @returns {Snapshot} 凍結済みのスナップショット
     * @private
     */
    #takeSnapshot() {
        return HistoryManager.#deepFreeze(this.#capture());
    }

    /**
     * オブジェクト・配列を再帰的に`Object.freeze`する汎用処理。
     * プロパティ名を参照せず、すべての値を一律に辿る（図形固有の知識を持たない）。
     * プリミティブ値・凍結済みの値はそのまま返す。
     * @param {*} value 凍結する値
     * @returns {*} 引数と同じ値（凍結済み）
     * @private
     */
    static #deepFreeze(value) {
        if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
            return value;
        }
        Object.freeze(value);
        for (const child of Object.values(value)) {
            HistoryManager.#deepFreeze(child);
        }
        return value;
    }
}
