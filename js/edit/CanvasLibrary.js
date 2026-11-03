/**
 * 責務：キャンバス一覧の管理（起動時の復元・開く・新規作成・切り替え処理・開いているキャンバスの自動保存・保存失敗の状態）を担う。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';

/**
 * 自動保存の待ち時間（ミリ秒）。最後の変更通知（historyManager.onChange）からこの時間が経ったら1回保存する。
 * 唯一の定義箇所（exportしない）。
 * @type {number}
 */
const AUTOSAVE_DELAY_MS = 500;

/**
 * 新規キャンバスの名前の接頭辞。新しい名前は`'無題 ' + n`（半角スペース1つ。nは一覧の名前と一致しない最小の正の整数）。
 * 唯一の定義箇所（exportしない）。
 * @type {string}
 */
const UNTITLED_NAME_PREFIX = '無題 ';

/**
 * キャンバスの要約：キャンバス一覧（メモリ上）の1件。作業データは保持しない。
 * @typedef {Object} CanvasSummary
 * @property {string} id キャンバスの識別子（`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`。形式は本クラスに閉じる）
 * @property {string} name キャンバス名（メモリ上の現在名）
 * @property {number} updatedAt 最終更新日時（`Date.now()`のミリ秒）
 */

/**
 * 利用者に示す保存・読み込みの問題（最後に起きたものを1つだけ保持する）。
 *   - `'unavailable'`: 起動時に保存先を開けない・一覧を読み出せない。メモリ上だけのキャンバスで編集を続ける。
 *     開く・新規作成（・名前の変更・削除）を受け付けず、自動保存も行わない。解除しない。
 *   - `'writeFailed'`: 自動保存・新規作成の記録・最後に開いていたキャンバスの識別子の書き込みに失敗した。
 *     次に自動保存が成功した時点で解除する。
 *   - `'loadFailed'`: 開こうとしたキャンバスの作業データが全体として読み込めない・記録が見つからない。
 *     次の切り替えの成功で解除する（読み込みに失敗して別のキャンバスを開いた場合は残す）。
 *   - `'partialLoad'`: 一部の図形をスキップして開いた。編集すると、その図形は保存から失われる。次の切り替えの成功で解除する。
 * @typedef {null|'unavailable'|'writeFailed'|'loadFailed'|'partialLoad'} CanvasIssue
 */

/**
 * `getState()`の戻り値（毎回新しいオブジェクト）。CanvasPalette・main.jsの表示同期が読み取る。
 * @typedef {Object} CanvasLibraryState
 * @property {boolean} loading 起動時の読み込み中か（`start()`の完了まで真。`start()`の呼び出し前も真）
 * @property {boolean} busy 開く・新規作成・起動時の復元などの処理中か（処理中は新たな操作を受け付けない）
 * @property {boolean} canManage キャンバスの管理操作ができるか（`'unavailable'`でない）
 * @property {string|null} openCanvasId 開いているキャンバスの識別子（読み込み完了前は`null`）
 * @property {string|null} openCanvasName 開いているキャンバスの名前（読み込み完了前は`null`）
 * @property {Array<{id: string, name: string, updatedAt: number, isOpen: boolean}>} canvases
 *     キャンバス一覧（最終更新日時の新しい順。同値はid順）
 * @property {CanvasIssue} issue 保存・読み込みの問題（無ければ`null`）
 * @property {boolean} hasSaveProblem 保存の問題（`'unavailable'`・`'writeFailed'`）があるか
 */

/**
 * キャンバス一覧の管理クラス。ブラウザ内に保存された複数のキャンバスのうち1枚を開き、
 * 開く・新規作成・切り替え・自動保存を行う。main.jsが1つだけ生成する。
 *
 * ■ キャンバス記録と保存しないもの
 *   - 保存単位は記録`{ id, name, updatedAt, document }`（typedefは`io/CanvasStorage.js`の`CanvasRecord`）。
 *     `document`は`DocumentSerializer.serialize(model.getShapes())`の戻り値で、本クラスは中身を解釈しない
 *     （読み込みは`DocumentSerializer.deserialize`を通し、旧版のマイグレーションはその仕組みに任せる）。
 *   - 保存しないもの：Undo/Redoの履歴、選択集合・ホバー・作成中の図形・選択矩形、ビュー変換（倍率・表示位置）、
 *     クリップボード、操作モード。
 *   - キャンバスの識別子は`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`（`#issueCanvasId()`に閉じる。
 *     一覧に同じidがあれば採り直す）。図形のid（`shape-<連番>`）とは別体系で、他のモジュールは形式を解釈しない。
 *
 * ■ 自動保存
 *   - 契機は`historyManager.onChange`のみ（編集操作の記録・取り消し・やり直しの適用成功・`clear()`での破棄）。
 *     選択の変更・ホバー・パン・ズーム・作成途中の図形の開始/破棄・ドラッグ中の途中経過では通知されないため保存しない。
 *     `model.onChange`は使わない。
 *   - 通知のたびに保留中のタイマーを張り直し、最後の通知から`AUTOSAVE_DELAY_MS`後に1回保存する。
 *   - 予約しない条件：開いているキャンバスが無い（読み込み完了前）／`'unavailable'`／`#isSwitching`が真。
 *   - ページ非表示時の確定：main.jsが`visibilitychange`（hidden）・`pagehide`で`flushPendingSave()`を呼ぶ
 *     （本クラスは`document`・`window`のイベントを購読しない）。
 *
 * ■ 非同期保存と切り替えの順序の保証
 *   1. 保存の作業データは呼び出し時点で同期的に取得し、予約時点のキャンバスidと一致する場合のみ、そのidの記録へ書く。
 *   2. 切り替え処理は図形一式を入れ替える前に保留中の保存を確定させる（手順2・手順4）。入れ替えの直前
 *      （`await`を挟まない同期区間）にも保留の有無を再確認するため、`await`中に行われた編集も切り替え前のキャンバスへ書かれる。
 *   3. CanvasStorageはトランザクションを呼び出し時点で同期的に生成し、IndexedDBは生成順に実行するため、
 *      切り替え前のキャンバスへの書き込みが後発の書き込みより後に反映されることはない。
 *   4. 例：Aの保留中の保存がBへ切り替えた後にBの内容でAを上書きすることはない（入れ替え前に確定済み、
 *      または`#pendingSaveCanvasId`の不一致で破棄）。Bの記録へAの内容を書くこともない（Aの作業データはAのidと組で同期的に取得）。
 *
 * ■ 切り替え処理（開く・新規作成・起動時の復元が共通して通る手順）
 *   1. `prepareSwitch()`（実体は選択モードへの切り替え。進行中の入力操作を中断し、作成途中の図形は破棄。
 *      本体ドラッグ・ハンドル操作で動かした分は1件の編集操作として記録され、自動保存が予約される）。
 *   2. 切り替え前のキャンバスの保留中の保存を`await flushPendingSave()`で確定する。失敗したら切り替えを中止する
 *      （開いているキャンバスのまま。`'writeFailed'`。保存できていない変更を画面から消さないため）。
 *   3. 切り替え先の読み込み（開く：記録の取得→`deserialize`。記録が無い・全体失敗なら中止して`'loadFailed'`。
 *      新規作成：記録を作成して書き込む。失敗しても中止せず`'writeFailed'`として開く（次の自動保存で記録が作られる））。
 *   4. 同期区間の開始（ここから手順6まで`await`を挟まない）：もう一度`prepareSwitch()`を呼び、保留中の保存があれば
 *      `#saveOpenCanvasNow()`で切り替え前のキャンバスへ書く（完了は待たない）。続けて`#isSwitching = true`とし、
 *      図形一式を`model.replaceAllShapes(shapes)`で入れ替える（図形のidは記録されたものを保持）。
 *      手順2との違い：手順4は失敗しても切り替えを続ける。手順4は`await`を挟まない同期区間のため完了を待てず
 *      （待つと区間が途切れ、`await`中の編集の取りこぼしを防ぐ目的が崩れる）、手順4で書くのは手順2〜3の`await`中に
 *      行われた編集のみである（それ以前の変更は手順2で書き込み済み）。失敗時は`console.warn`＋`'writeFailed'`で示す
 *      （その分の変更は切り替え前のキャンバスに保存されない可能性がある）。
 *   5. 履歴のリセット`historyManager.clear()`（切り替えは編集操作として記録しない。`beginEdit`/`commitEdit`を呼ばない）
 *      → ビュー変換を初期表示へ`resetView()` → `#isSwitching = false`。
 *   6. 開いているキャンバスを更新し、最後に開いていたキャンバスの識別子を書き込み（完了は待たない）、`issue`を更新して変更通知する。
 *   - 再描画・ボタン同期は`replaceAllShapes`・`clear()`・`reset()`の既存の通知経路のみで行う（本クラスは描画しない）。
 *   - クリップボードには触れない（切り替えで消えず、貼り付けの段数もリセットしない）。
 *
 * ■ `#isSwitching`（自動保存の予約を止める区間。唯一の仕組み）
 *   - 真の間は`historyManager.onChange`の通知を受けても自動保存を予約しない（手順5の`clear()`による通知を無視するため等）。
 *   - 真にするのは (a)切り替え処理の同期区間（手順4〜5）と (b)開いているキャンバスの削除の開始から、削除後の切り替え処理の
 *     手順5の終わり（`#enterCanvas`内）または削除の中止まで、の2箇所のみ。
 *   - 偽へ戻すのは切り替え処理の手順5の終わり（`#enterCanvas`内）と削除の中止時のみ。
 *
 * ■ 起動時の復元（`start()`）
 *   - 開くキャンバスの決定規則：候補を「最後に開いていたキャンバス（一覧にあれば）→ 残りを最終更新日時の新しい順」に並べ、
 *     先頭から`deserialize`を試し、全体として読めた最初の1枚を開く。読めない記録は`console.warn`して次へ（記録は消さず一覧に残し、
 *     `'loadFailed'`を立てる）。候補が無い・すべて読めない場合は新しい空のキャンバスを作成して開く（初回起動を含む）。
 *   - 保存先を開けない・一覧を読み出せない場合は`'unavailable'`とし、メモリ上だけの空のキャンバス「無題 1」を開く
 *     （保存先への書き込みを一切行わない）。
 *   - 読み込み完了前の操作の扱い：`loading`の間は、main.jsが覆い要素でキャンバスへのマウス入力を止める前提
 *     （読み込み完了時の切り替えで利用者の操作が消されないため）。本クラスも読み込み中の開く・新規作成等を受理しない。
 *     読み込み完了前は開いているキャンバスが無いため自動保存も予約されない。
 *
 * ■ 壊れた作業データ
 *   - 全体が読み込めない（`ok: false`）キャンバスは開かない（起動時は次の候補へ、開く操作では開いているキャンバスのまま）。
 *     `console.warn`と`'loadFailed'`。記録は削除しない。
 *   - 一部の図形がスキップされた場合は読めた図形で開き、`console.warn`（スキップ一覧）と`'partialLoad'`を残す。
 *     開いただけでは記録を書き換えない（自動保存は編集操作でのみ予約される）。編集するとスキップした図形は記録から消える。
 *
 * ■ 新規キャンバスの命名規則
 *   - 「無題 1」「無題 2」…のうち、キャンバス一覧の名前と一致しない最小の番号。`'unavailable'`時のメモリ上のキャンバスも同じ規則。
 *
 * ■ 処理中の直列化
 *   - 開く・新規作成・起動時の復元は`#isBusy`で直列化し、処理中・読み込み中・`'unavailable'`では新たな操作を受け付けない
 *     （`false`で解決）。処理中もキャンバスの編集は止めない（手順4で整合を取る）。
 *
 * ■ 公開メソッドのPromise
 *   - rejectしない（内部で捕捉して`console.warn`＋`issue`）。
 *
 * 依存の制約:
 *   - importはDocumentSerializerのみ。CanvasStorage・VectorModel・HistoryManagerは注入で受け取る。
 *   - DOMに触れない。`setTimeout`/`clearTimeout`/`Date.now`/`Math.random`以外のブラウザAPIを使わない。
 *   - 図形種別の分岐・図形固有のプロパティ名・図形のid形式の知識を持たない（作業データは不透明に扱う）。
 *   - InputTrackerに依存せず操作モードを知らない（進行中の入力操作の中断は注入された`prepareSwitch()`へ委ねる）。
 */
export class CanvasLibrary {
    /**
     * ブラウザ内保存先への読み書き。
     * @type {import('../io/CanvasStorage.js').CanvasStorage}
     */
    #storage;

    /**
     * 開いているキャンバスの図形一式を保持するVectorModel（getShapes・replaceAllShapesのみ使用）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の履歴（onChange・clearのみ使用）。
     * @type {import('../core/HistoryManager.js').HistoryManager}
     */
    #historyManager;

    /**
     * 進行中の入力操作を中断して選択モードへ切り替える注入関数（実体はmain.jsの`applyMode(OperationMode.SELECT)`）。
     * @type {() => void}
     */
    #prepareSwitch;

    /**
     * ビュー変換を初期表示へ戻す注入関数（実体はmain.jsの`viewTransform.reset()`）。
     * @type {() => void}
     */
    #resetView;

    /**
     * キャンバス一覧（メモリ上の要約。作業データは保持しない）。キーはキャンバスの識別子。
     * @type {Map<string, CanvasSummary>}
     */
    #summaries = new Map();

    /**
     * 開いているキャンバスの識別子（読み込み完了前は`null`）。
     * @type {string|null}
     */
    #openCanvasId = null;

    /**
     * 起動時の読み込み中か。`start()`前も真（起動直後の初回の表示同期から読み込み中として扱うため）。
     * @type {boolean}
     */
    #isLoading = true;

    /**
     * 開く・新規作成・起動時の復元などの処理中か（直列化のため）。
     * @type {boolean}
     */
    #isBusy = false;

    /**
     * 自動保存の予約を止める区間か（クラスJSDocの「#isSwitching」参照）。
     * @type {boolean}
     */
    #isSwitching = false;

    /**
     * `start()`を呼んだか（2回目以降の呼び出しを無視するため）。
     * @type {boolean}
     */
    #hasStarted = false;

    /**
     * 保存・読み込みの問題（最後に起きたもの1つ）。
     * @type {CanvasIssue}
     */
    #issue = null;

    /**
     * 保留中の自動保存のタイマーid（保留が無ければ`null`）。
     * @type {ReturnType<typeof setTimeout>|null}
     */
    #pendingSaveTimer = null;

    /**
     * 保留中の自動保存を予約した時点の、開いているキャンバスの識別子（保留が無ければ`null`）。
     * @type {string|null}
     */
    #pendingSaveCanvasId = null;

    /**
     * 状態の変化時に呼び出すリスナーの配列。
     * @type {Array<Function>}
     */
    #listeners = [];

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../io/CanvasStorage.js').CanvasStorage} deps.storage - ブラウザ内保存先への読み書き
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 開いているキャンバスの図形一式を保持するVectorModel
     * @param {import('../core/HistoryManager.js').HistoryManager} deps.historyManager - 編集操作の履歴（自動保存の契機・切り替え時のリセット）
     * @param {() => void} deps.prepareSwitch - 進行中の入力操作を中断して選択モードへ切り替える関数
     * @param {() => void} deps.resetView - ビュー変換を初期表示へ戻す関数
     * @throws {Error} prepareSwitchまたはresetViewが関数でない場合
     */
    constructor({ storage, model, historyManager, prepareSwitch, resetView }) {
        if (typeof prepareSwitch !== 'function' || typeof resetView !== 'function') {
            throw new Error('CanvasLibrary: prepareSwitch と resetView には関数を指定してください。');
        }
        this.#storage = storage;
        this.#model = model;
        this.#historyManager = historyManager;
        this.#prepareSwitch = prepareSwitch;
        this.#resetView = resetView;
        this.#historyManager.onChange(() => {
            this.#scheduleSave();
        });
    }

    /**
     * 起動時の復元：保存先を開き、キャンバス一覧を作り、開くキャンバスの決定規則（クラスJSDoc参照）に従って1枚を開く。
     * 2回目以降の呼び出しは何もしない。rejectしない。
     * 手順：読み込み中として通知 → `open`・`getAllRecords`・`getLastOpenedId`（失敗なら`'unavailable'`でメモリ上の
     * 「無題 1」を開く）→ 記録の検証（`id`・`name`が文字列、`updatedAt`が有限の数値。外れた記録は`console.warn`して一覧から除外。
     * 保存先からは消さない）→ 候補を順に読み込み、読めた最初の1枚を切り替え処理の手順4以降で開く → 読み込み完了として通知。
     * @returns {Promise<void>}
     */
    async start() {
        if (this.#hasStarted) {
            return;
        }
        this.#hasStarted = true;
        this.#isLoading = true;
        this.#isBusy = true;
        this.#notifyChange();
        try {
            let records;
            let lastOpenedId;
            try {
                await this.#storage.open();
                records = await this.#storage.getAllRecords();
                lastOpenedId = await this.#storage.getLastOpenedId();
            } catch (error) {
                console.warn('CanvasLibrary: ブラウザ内の保存先を利用できないため、保存せずに編集を続けます。', error);
                this.#issue = 'unavailable';
                const summary = { id: this.#issueCanvasId(), name: this.#nextUntitledName(), updatedAt: Date.now() };
                this.#summaries.set(summary.id, summary);
                this.#enterCanvas(summary, []);
                return;
            }

            /** @type {Map<string, Object>} 検証を通った記録（キーはキャンバスの識別子） */
            const recordsById = new Map();
            for (const record of Array.isArray(records) ? records : []) {
                if (!CanvasLibrary.#isValidRecord(record)) {
                    console.warn('CanvasLibrary: 形式が正しくないキャンバス記録を一覧から除外します。', record);
                    continue;
                }
                recordsById.set(record.id, record);
                this.#summaries.set(record.id, { id: record.id, name: record.name, updatedAt: record.updatedAt });
            }

            const sorted = this.#sortedSummaries();
            const lastOpened = typeof lastOpenedId === 'string' ? this.#summaries.get(lastOpenedId) : undefined;
            const candidates = lastOpened
                ? [lastOpened, ...sorted.filter((summary) => summary.id !== lastOpened.id)]
                : sorted;
            await this.#openFirstLoadable(candidates, (summary) => {
                const record = recordsById.get(summary.id);
                return record ? record.document : null;
            });
        } catch (error) {
            console.warn('CanvasLibrary: 起動時の読み込み中に予期しないエラーが発生しました。', error);
        } finally {
            this.#isBusy = false;
            this.#isLoading = false;
            this.#notifyChange();
        }
    }

    /**
     * キャンバス一覧から指定したキャンバスを開く（切り替え処理の手順1〜6）。
     * 受理条件：読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある、開いているキャンバス自身でない。
     * 受理しなければ何もせず`false`。切り替え前のキャンバスの保存に失敗した（`'writeFailed'`）・記録が無い・
     * 全体として読み込めない（`'loadFailed'`）場合は中止し、開いているキャンバスのまま`false`。rejectしない。
     * @param {string} id 開くキャンバスの識別子
     * @returns {Promise<boolean>} 開いたか
     */
    async openCanvas(id) {
        if (!this.#canAcceptOperation() || !this.#summaries.has(id) || id === this.#openCanvasId) {
            return false;
        }
        this.#isBusy = true;
        this.#notifyChange();
        try {
            if (!(await this.#prepareLeave())) {
                return false;
            }
            let record;
            try {
                record = await this.#storage.getRecord(id);
            } catch (error) {
                console.warn('CanvasLibrary: キャンバスの記録を読み出せませんでした。', id, error);
                this.#setIssue('loadFailed');
                return false;
            }
            if (!record) {
                console.warn('CanvasLibrary: キャンバスの記録が見つかりません。', id);
                this.#setIssue('loadFailed');
                return false;
            }
            const result = DocumentSerializer.deserialize(record.document);
            if (!result.ok) {
                console.warn('CanvasLibrary: キャンバスの作業データを読み込めませんでした。', id, result.error);
                this.#setIssue('loadFailed');
                return false;
            }
            const summary = this.#summaries.get(id);
            if (!summary) {
                return false;
            }
            if (result.skipped.length > 0) {
                console.warn('CanvasLibrary: 一部の図形を読み込めませんでした。', id, result.skipped);
            }
            this.#enterCanvas(summary, result.shapes, result.skipped.length > 0 ? 'partialLoad' : null);
            return true;
        } catch (error) {
            console.warn('CanvasLibrary: キャンバスを開く処理で予期しないエラーが発生しました。', error);
            return false;
        } finally {
            this.#isBusy = false;
            this.#notifyChange();
        }
    }

    /**
     * 新しい空のキャンバスを作成して開く（切り替え処理の手順1〜6）。名前は新規キャンバスの命名規則に従う。
     * 受理条件：読み込み中・処理中・`'unavailable'`でない。受理しなければ何もせず`false`。
     * 切り替え前のキャンバスの保存に失敗した場合は中止して`false`。新しい記録の書き込みに失敗しても中止せず
     * `'writeFailed'`として開く（次の自動保存で記録が作られる）。rejectしない。
     * @returns {Promise<boolean>} 作成して開いたか
     */
    async createCanvas() {
        if (!this.#canAcceptOperation()) {
            return false;
        }
        this.#isBusy = true;
        this.#notifyChange();
        try {
            if (!(await this.#prepareLeave())) {
                return false;
            }
            await this.#createAndEnter(null);
            return true;
        } catch (error) {
            console.warn('CanvasLibrary: キャンバスの新規作成で予期しないエラーが発生しました。', error);
            return false;
        } finally {
            this.#isBusy = false;
            this.#notifyChange();
        }
    }

    /**
     * 保留中の自動保存があれば直ちに確定する（main.jsがページ非表示時に呼ぶ。切り替え処理の手順2でも使う）。
     * 作業データの取得と書き込みの呼び出しは本メソッド内で同期的に行われる。保留が無ければ`true`で解決する。rejectしない。
     * @returns {Promise<boolean>} 保存が成功した（または保存すべきものが無かった）か
     */
    flushPendingSave() {
        if (this.#pendingSaveTimer === null) {
            return Promise.resolve(true);
        }
        return this.#saveOpenCanvasNow();
    }

    /**
     * 現在の状態を返す（毎回新しいオブジェクト）。
     * @returns {CanvasLibraryState}
     */
    getState() {
        const openSummary = this.#openCanvasId !== null ? this.#summaries.get(this.#openCanvasId) : undefined;
        return {
            loading: this.#isLoading,
            busy: this.#isBusy,
            canManage: this.#issue !== 'unavailable',
            openCanvasId: this.#openCanvasId,
            openCanvasName: openSummary ? openSummary.name : null,
            canvases: this.#sortedSummaries().map((summary) => ({
                id: summary.id,
                name: summary.name,
                updatedAt: summary.updatedAt,
                isOpen: summary.id === this.#openCanvasId
            })),
            issue: this.#issue,
            hasSaveProblem: this.#issue === 'unavailable' || this.#issue === 'writeFailed'
        };
    }

    /**
     * 状態（一覧・開いているキャンバス・読み込み中・処理中・issue）の変化時に呼び出されるリスナーを登録する。
     * @param {Function} listener 登録するリスナー（関数以外は無視する）
     */
    onChange(listener) {
        if (typeof listener === 'function') {
            this.#listeners.push(listener);
        }
    }

    /**
     * 開く・新規作成などの操作を受理できるか（読み込み中・処理中・`'unavailable'`でない）。
     * @returns {boolean}
     */
    #canAcceptOperation() {
        return !this.#isLoading && !this.#isBusy && this.#issue !== 'unavailable';
    }

    /**
     * 新しいキャンバスの識別子を採番する（`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`）。
     * キャンバス一覧に同じidがあれば採り直す。形式の知識は本メソッドに閉じる。
     * @returns {string}
     */
    #issueCanvasId() {
        let id;
        do {
            const randomPart = Math.random().toString(36).slice(2).padEnd(8, '0').slice(0, 8);
            id = `canvas-${Date.now().toString(36)}-${randomPart}`;
        } while (this.#summaries.has(id));
        return id;
    }

    /**
     * 新規キャンバスの名前を返す：「無題 1」「無題 2」…のうち、キャンバス一覧の名前と一致しない最小の番号。
     * @returns {string}
     */
    #nextUntitledName() {
        const names = new Set(Array.from(this.#summaries.values(), (summary) => summary.name));
        let n = 1;
        while (names.has(UNTITLED_NAME_PREFIX + n)) {
            n += 1;
        }
        return UNTITLED_NAME_PREFIX + n;
    }

    /**
     * 自動保存を予約する（`historyManager.onChange`の通知ごとに呼ばれる）。保留中のタイマーを解除して張り直す。
     * 予約しない条件：開いているキャンバスが無い／`'unavailable'`／`#isSwitching`が真。
     * @returns {void}
     */
    #scheduleSave() {
        if (this.#openCanvasId === null || this.#issue === 'unavailable' || this.#isSwitching) {
            return;
        }
        if (this.#pendingSaveTimer !== null) {
            clearTimeout(this.#pendingSaveTimer);
        }
        this.#pendingSaveCanvasId = this.#openCanvasId;
        this.#pendingSaveTimer = setTimeout(() => {
            void this.#saveOpenCanvasNow();
        }, AUTOSAVE_DELAY_MS);
    }

    /**
     * 保留中の自動保存を直ちに実行する。タイマーを解除し、予約時点のキャンバスidが開いているキャンバスと一致しなければ
     * 破棄して`true`（別のキャンバスの記録へ書かない防御）。一致すれば同期的に記録を組み立てて書き込みを呼び
     * （トランザクションはこの時点で生成される）、要約の最終更新日時を更新して通知する。
     * 書き込み成功で`'writeFailed'`を解除して通知、失敗で`console.warn`＋`'writeFailed'`＋通知。rejectしない。
     * @returns {Promise<boolean>} 書き込みに成功した（または書くべきものが無かった）か
     */
    #saveOpenCanvasNow() {
        if (this.#pendingSaveTimer !== null) {
            clearTimeout(this.#pendingSaveTimer);
            this.#pendingSaveTimer = null;
        }
        const canvasId = this.#pendingSaveCanvasId;
        this.#pendingSaveCanvasId = null;
        if (canvasId === null || canvasId !== this.#openCanvasId) {
            return Promise.resolve(true);
        }
        const summary = this.#summaries.get(canvasId);
        if (!summary) {
            return Promise.resolve(true);
        }

        const updatedAt = Date.now();
        const record = {
            id: canvasId,
            name: summary.name,
            updatedAt,
            document: DocumentSerializer.serialize(this.#model.getShapes())
        };
        let writing;
        try {
            writing = this.#storage.putRecord(record);
        } catch (error) {
            writing = Promise.reject(error);
        }
        this.#summaries.set(canvasId, { ...summary, updatedAt });
        this.#notifyChange();

        return writing.then(
            () => {
                if (this.#issue === 'writeFailed') {
                    this.#setIssue(null);
                    this.#notifyChange();
                }
                return true;
            },
            (error) => {
                console.warn('CanvasLibrary: キャンバスの自動保存に失敗しました。', canvasId, error);
                this.#setIssue('writeFailed');
                this.#notifyChange();
                return false;
            }
        );
    }

    /**
     * 切り替え処理の手順1〜2：進行中の入力操作を中断して選択モードへ切り替え、切り替え前のキャンバスの保留中の保存を確定する。
     * 保存に失敗した場合は`false`（呼び出し側は切り替えを中止する。`'writeFailed'`は`#saveOpenCanvasNow()`が設定済み）。
     * @returns {Promise<boolean>} 切り替えを続けてよいか
     */
    async #prepareLeave() {
        this.#prepareSwitch();
        return this.flushPendingSave();
    }

    /**
     * 切り替え処理の手順4〜6（`await`を挟まない同期区間）。
     * 手順4：もう一度`prepareSwitch()`を呼び、保留中の保存があれば切り替え前のキャンバスへ書き（完了は待たず、失敗しても続ける）、
     * `#isSwitching = true`として図形一式を入れ替える。手順5：履歴のリセット → ビュー変換の初期化 → `#isSwitching = false`。
     * 手順6：開いているキャンバスを更新し、最後に開いていたキャンバスの識別子を書き込み（`'unavailable'`では書かない。完了は待たない）、
     * `'loadFailed'`/`'partialLoad'`を解除したうえで`loadIssue`があれば設定し、変更通知する。
     * @param {CanvasSummary} summary 開くキャンバスの要約（キャンバス一覧に登録済みであること）
     * @param {Array<Object>} shapes 開くキャンバスの図形インスタンス（`deserialize`の結果。新規作成なら空配列）
     * @param {CanvasIssue} [loadIssue=null] 開いた後に残す読み込みの問題（`'loadFailed'`/`'partialLoad'`。無ければ`null`）
     * @returns {void}
     */
    #enterCanvas(summary, shapes, loadIssue = null) {
        // 手順4
        this.#prepareSwitch();
        if (this.#pendingSaveTimer !== null) {
            void this.#saveOpenCanvasNow();
        }
        this.#isSwitching = true;
        try {
            this.#model.replaceAllShapes(shapes);
            // 手順5
            this.#historyManager.clear();
            this.#resetView();
        } finally {
            this.#isSwitching = false;
        }

        // 手順6
        this.#openCanvasId = summary.id;
        if (this.#issue !== 'unavailable') {
            let writing;
            try {
                writing = this.#storage.setLastOpenedId(summary.id);
            } catch (error) {
                writing = Promise.reject(error);
            }
            writing.catch((error) => {
                console.warn('CanvasLibrary: 最後に開いていたキャンバスの記録に失敗しました。', error);
                this.#setIssue('writeFailed');
                this.#notifyChange();
            });
        }
        if (this.#issue === 'loadFailed' || this.#issue === 'partialLoad') {
            this.#setIssue(null);
        }
        if (loadIssue !== null) {
            this.#setIssue(loadIssue);
        }
        this.#notifyChange();
    }

    /**
     * 候補を先頭から順に読み込み、全体として読めた最初の1枚を開く（切り替え処理の手順3〜6。起動時・削除後の共通）。
     * 作業データの取得失敗・`null`・`ok: false`は`console.warn`して次の候補へ進み、開いた後に`'loadFailed'`を残す。
     * 一部の図形がスキップされた場合は読めた図形で開き`'partialLoad'`を残す。読めた候補が無ければ新しい空のキャンバスを作成して開く。
     * @param {CanvasSummary[]} candidates 開く候補（試す順）
     * @param {(summary: CanvasSummary) => (Object|null|Promise<Object|null>)} loadDocument
     *     候補の作業データを取得する関数（起動時は読み出し済みの記録から、削除後は保存先から取得。記録が無ければ`null`）
     * @returns {Promise<void>}
     */
    async #openFirstLoadable(candidates, loadDocument) {
        let hadFailure = false;
        for (const summary of candidates) {
            let documentData;
            try {
                documentData = await loadDocument(summary);
            } catch (error) {
                console.warn('CanvasLibrary: キャンバスの記録を読み出せませんでした。', summary.id, error);
                hadFailure = true;
                continue;
            }
            if (documentData === null || documentData === undefined) {
                console.warn('CanvasLibrary: キャンバスの記録が見つかりません。', summary.id);
                hadFailure = true;
                continue;
            }
            const result = DocumentSerializer.deserialize(documentData);
            if (!result.ok) {
                console.warn('CanvasLibrary: キャンバスの作業データを読み込めませんでした。', summary.id, result.error);
                hadFailure = true;
                continue;
            }
            const current = this.#summaries.get(summary.id);
            if (!current) {
                continue;
            }
            let loadIssue = hadFailure ? 'loadFailed' : null;
            if (result.skipped.length > 0) {
                console.warn('CanvasLibrary: 一部の図形を読み込めませんでした。', summary.id, result.skipped);
                loadIssue = 'partialLoad';
            }
            this.#enterCanvas(current, result.shapes, loadIssue);
            return;
        }
        await this.#createAndEnter(hadFailure ? 'loadFailed' : null);
    }

    /**
     * 新しい空のキャンバスを作成して開く（切り替え処理の手順3〜6）。記録を一覧へ加えて書き込み、空の図形一式で切り替える。
     * 書き込みに失敗しても中止せず`'writeFailed'`として開く（このとき`loadIssue`より後に起きた問題として`'writeFailed'`を残す）。
     * @param {CanvasIssue} loadIssue 開いた後に残す読み込みの問題（無ければ`null`）
     * @returns {Promise<void>}
     */
    async #createAndEnter(loadIssue) {
        const summary = { id: this.#issueCanvasId(), name: this.#nextUntitledName(), updatedAt: Date.now() };
        this.#summaries.set(summary.id, summary);
        let issueAfterEnter = loadIssue;
        try {
            await this.#storage.putRecord({
                id: summary.id,
                name: summary.name,
                updatedAt: summary.updatedAt,
                document: DocumentSerializer.serialize([])
            });
        } catch (error) {
            console.warn('CanvasLibrary: 新しいキャンバスの記録に失敗しました。', summary.id, error);
            this.#setIssue('writeFailed');
            issueAfterEnter = null;
        }
        this.#enterCanvas(summary, [], issueAfterEnter);
    }

    /**
     * 保存・読み込みの問題を設定する（最後に起きたもの1つを保持）。`'unavailable'`は解除・上書きしない。
     * 変更通知は呼び出し側が行う。
     * @param {CanvasIssue} issue 設定する問題（解除は`null`）
     * @returns {void}
     */
    #setIssue(issue) {
        if (this.#issue === 'unavailable') {
            return;
        }
        this.#issue = issue;
    }

    /**
     * キャンバス一覧を最終更新日時の新しい順（同値はid順）に並べた配列を返す。
     * @returns {CanvasSummary[]}
     */
    #sortedSummaries() {
        return Array.from(this.#summaries.values()).sort((a, b) => {
            if (a.updatedAt !== b.updatedAt) {
                return b.updatedAt - a.updatedAt;
            }
            return a.id < b.id ? -1 : (a.id > b.id ? 1 : 0);
        });
    }

    /**
     * 登録されたすべてのリスナーに変更を通知する。
     * @returns {void}
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
    }

    /**
     * キャンバス記録の形式を検証する（`id`・`name`が文字列、`updatedAt`が有限の数値）。作業データの中身は検証しない。
     * @param {*} record 検証する値
     * @returns {boolean} 一覧に含めてよい記録か
     */
    static #isValidRecord(record) {
        return record !== null
            && typeof record === 'object'
            && typeof record.id === 'string'
            && typeof record.name === 'string'
            && Number.isFinite(record.updatedAt);
    }
}
