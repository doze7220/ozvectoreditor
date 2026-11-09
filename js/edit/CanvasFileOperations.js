/**
 * 責務：作業データファイルの出力と、作業データファイル・スプライトを開く・インポートする手順、スプライト（エンジン用）の出力の組み立て（読み取り→判定→CanvasLibrary／ShapeInserter／SpriteSerializer／CodeExporterの呼び出し→通知の状態の更新）と、
 * キャンバスパレットの表示同期用の状態（CanvasLibraryの状態＋busy・fileNoticeの合成）・変更通知の提供を担う。DOMに触れない。
 */

import { DocumentSerializer } from '../io/DocumentSerializer.js';
import { SpriteSerializer } from '../io/SpriteSerializer.js';
import { CodeExporter } from '../io/CodeExporter.js';
import { FileContentReader } from '../io/FileContentReader.js';

/**
 * ファイル操作の通知（`issue`とは別の状態）。キャンバスパレット内の文言の元になる。
 * `CanvasPalette.js`にも同じ形の定義がある（二重定義のため揃えること）。
 * @typedef {Object} FileNotice
 * @property {'readFailed'|'partialRead'|'noShapes'|'exportFailed'|'spriteExportFailed'} kind 通知の種類
 * @property {string|null} fileName 対象のファイル名（出力の失敗はnull）
 * @property {number} skippedCount 読めなかった図形の数（partialRead以外は0）
 */

/**
 * `getState()`の戻り値（毎回新しいオブジェクト）。`CanvasLibraryState`に`busy`の合成と`fileNotice`を加えたもの。
 * @typedef {Object} CanvasFileOperationsState
 * @property {boolean} busy `canvasLibrary.getState().busy`またはファイル操作の読み取り〜完了までの処理中か
 * @property {FileNotice|null} fileNotice ファイル操作の通知（無ければ`null`）
 * ※ 上記以外のプロパティ（`loading`・`canManage`・`openCanvasId`・`openCanvasName`・`canvases`・`issue`・`hasSaveProblem`）は
 *   `CanvasLibrary.getState()`の値をそのまま含む。
 */

/**
 * 読み込み結果の分類。
 * @typedef {Object} ReadClassification
 * @property {'unreadable'|'empty'|'partial'|'all'} kind 分類（読み込み不可・空・一部・全部）
 * @property {number} skippedCount 読めなかった図形の数
 */

/**
 * ファイル操作（出力（作業ファイル・エンジン用）・開く（ファイル）・インポート）の組み立てクラス。main.jsが1つだけ生成する。
 * ファイルの読み書きは`DocumentFileIO`、キャンバスの登録と切り替えは`CanvasLibrary`、図形の追加は`ShapeInserter`に任せ、
 * 本クラスはそれらの呼び出し順と通知の状態だけを持つ。
 *
 * ■ 操作と受理条件（パレットの`disabled`を一次、本クラスの判定を二次とする。不受理なら通知を含め何も変えず`false`）
 *   - 出力（作業ファイル）：操作の開始時点（`#isProcessing`を真にする前）の`getState()`（合成後）の`loading`・`busy`が偽。
 *   - 出力（エンジン用）：同上（`'unavailable'`でも受理）。
 *   - インポート：同上。
 *   - 開く（ファイル）：上に加えて`canManage`（`issue`が`'unavailable'`でない）。
 *   - 受理条件は操作の開始時点の判定であり、自身の`#isProcessing`を真にした後の判定には使わない。
 *
 * ■ 出力（作業ファイル）（`exportCanvas`）
 *   - `DocumentSerializer.serializeToString(model.getShapes())`と開いているキャンバスの名前を`fileIO.downloadText`へ渡す。
 *   - 図形一式・選択集合・履歴・ビュー変換・操作モード・作成途中の図形に触れない（`applyMode`・`beginEdit`/`commitEdit`も呼ばない）。
 *   - 準備中の例外は捕捉して`console.warn`＋通知`exportFailed`（アプリを止めない）。
 *
 * ■ 出力（エンジン用）（`exportSprite`）
 *   1. `SpriteSerializer.serialize(model.getShapes())`でスプライトデータを作り、`CodeExporter.toModuleText`でJSのテキストを組み立てる
 *      （ここで例外ならダウンロードしない）。
 *   2. `fileIO.downloadSpriteModule(JSのテキスト, 名前)`を1回だけ呼ぶ。例外なら通知。
 *   - 名前は開いているキャンバスの名前（`openCanvasName ?? ''`）。拡張子・MIMEタイプ・ファイル名の規則は`fileIO`が持つ。
 *   - 図形一式・選択集合・履歴・ビュー変換・操作モード・作成途中の図形に触れない（`prepareInsert`・`beginEdit`/`commitEdit`も呼ばない。自動保存の契機にならない）。
 *   - 失敗は`console.warn`＋通知`spriteExportFailed`（アプリを止めない）。成功時と図形0個のときは通知を出さない。
 *
 * ■ 開く（ファイル）（`openFile`）
 *   - 読み取り→`FileContentReader.deserializeFromText`→判定→読み込めた場合のみ`canvasLibrary.createCanvasFromShapes(fileIO.toCanvasName(ファイル名), 図形)`。
 *   - 通る切り替え処理は`CanvasLibrary`の手順1〜6すべて（`CanvasLibrary`のJSDoc「■ 開く（ファイル）」を参照）。
 *     切り替え前の保存の失敗・確定手順の失敗・新しい記録を書けずに確認の小窓で「いいえ」のいずれで中止しても、
 *     キャンバス一覧に残らない。
 *   - `createCanvasFromShapes`が`false`の場合：`issue`が`'writeFailed'`なら（パレットが表示するため）通知を出さない。
 *     それ以外（不受理・予期しない例外。UI上は到達しない防御）は通知`readFailed`を出す。
 *   - 一部が読めない旨は`issue`の`'partialLoad'`ではなく通知`partialRead`で示す（切り替えの完了後に設定するため消されずに残る）。
 *
 * ■ インポート（`importFile`）
 *   1. 受理条件の確認。開始時点の`openCanvasId`を記憶する。
 *   2. 読み取り→`FileContentReader.deserializeFromText`→判定。読み込み不可・図形0個なら通知を設定して終了
 *      （図形一式・選択集合・履歴・操作モード・作成途中の図形に一切触れない。`prepareInsert`より前のため作成途中の図形も残る）。
 *   3. キャンバスの同一性の確認：`canvasLibrary.getState()`の値で、`openCanvasId`が開始時点と同じ、かつ`loading`・`busy`でないこと。
 *      外れていれば何も追加せず`console.warn`＋通知`readFailed`。
 *      ※ 手順3は`#isProcessing`が真の間に走るため、本クラスの`getState()`の合成後の`busy`で判定してはならない（常に真になる）。
 *   4. `prepareInsert()`（進行中の入力操作の中断と選択モードへの切り替え。実体は注入される）。
 *   5. `inserter.insertDocument(DocumentSerializer.serialize(読めた図形), 0, 0)`（ファイル内の座標のまま。ビュー変換に触れない）。
 *      新しいid・最前面への追加・追加した図形のみの選択・1件の編集操作の記録・自動保存は`insertDocument`の既存の働きに任せる。
 *      読めた図形だけを作業データへ戻して渡すことで、`insertDocument`内の再デシリアライズでスキップの`console.warn`が重複しない。
 *   6. スキップが1件以上なら通知`partialRead`（件数は判定時と`insertDocument`の合計）。
 *   - 手順3の同一性の確認から手順5までは`await`を挟まない同期区間。
 *
 * ■ 読み込みの判定の表（`#classifyRead`。`FileContentReader.deserializeFromText`の結果`result`で判定し、作業データ自体の`shapes`は参照しない）
 *   - 「ファイルの`shapes`が1個以上か」は`result.shapes.length + result.skipped.length`で分かる。
 *   | 場面 | 判定 | 分類 | 開く | インポート | 通知 |
 *   | ファイルを読み取れない・JSONとして解析できない・本アプリのスプライトでない・書き出し形式の版が範囲外・`source`が無い・JSから取り出せない・`ok: false`（形式違い・非対応の版を含む） | `result === null`または`!result.ok` | 読み込み不可 | 何も変えない | 何も変えない | readFailed |
 *   | 図形がすべて読めない | `shapes`が0個かつ`skipped`が1件以上 | 読み込み不可 | 何も変えない（新しいキャンバスを作らない） | 何も変えない | readFailed |
 *   | 図形が0個の正しいファイル | `shapes`・`skipped`とも0件 | 空 | 空のキャンバスとして開く | 何も変えない | 開く：なし／インポート：noShapes |
 *   | 一部の図形が読めない | `shapes`が1個以上かつ`skipped`が1件以上 | 一部 | 読めた図形で開く | 読めた図形を追加する | partialRead |
 *   | すべて読めた | `shapes`が1個以上かつ`skipped`が0件 | 全部 | 開く | 追加する | なし |
 *   - `DocumentSerializer`の`error`の文字列は利用者向けの文言に出さない。JSONの解析は`FileContentReader`に任せる（スプライトの判別・`source`の取り出しも。本クラスはスプライト形式を知らない）。
 *
 * ■ 通知の持ち方と解除条件
 *   - `CanvasLibrary`の`issue`とは別に、本クラスが`#notice`として保持する（`issue`は`'unavailable'`・`'writeFailed'`・`'partialLoad'`で
 *     解除条件が異なるため種類を足さない）。パレットは両方を独立に表示する。
 *   - 解除：(1)次のファイル操作の開始時（出力（2種）は受理時、開く・インポートはファイルが選ばれ受理された時点。小窓のキャンセルでは消えない）。
 *     (2)キャンバスの切り替えの成功時（`canvasLibrary.onChange`の中で`openCanvasId`の変化を検知して消す）。
 *   - 成功時（問題なく完了）には通知を出さない。
 *
 * ■ 読み取り中の扱い
 *   - 読み取りの開始から完了まで`#isProcessing`を真にし、`getState().busy`を真にする（パレットの全操作が押せなくなり、
 *     読み取りの間にキャンバスの切り替え等は始まらない）。図形の編集（キャンバスの操作・ショートカット）は止めない。
 *
 * ■ 失敗で止めない
 *   - `openFile`・`importFile`は`Promise`をrejectしない（予期しない例外は`console.warn`＋通知`readFailed`）。`exportCanvas`・`exportSprite`は例外を投げない。
 *     ただしこの保証は、`#notifyChange`経由で呼ばれるリスナー（表示同期）が例外を投げた場合を除く（リスナーの例外は捕捉しない）。
 *
 * ■ 依存の制約
 *   - importは`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`・`FileContentReader`のみ。`fileIO`・`canvasLibrary`・`inserter`・`model`・`prepareInsert`は注入で受け取る。
 *   - DOMに触れない。操作モードを知らない（`prepareInsert`は中立な注入関数）。図形種別の分岐・図形固有のプロパティ名・図形のid形式・
 *     キャンバスの識別子の形式を持たない。作業データは不透明に扱う。`window`へ公開しない。
 *   - 履歴に記録するのはインポートのみ（`ShapeInserter`の経路で1件）。`HistoryManager`を直接呼ばない。
 */
export class CanvasFileOperations {
    /**
     * 作業データファイルとスプライトのファイルの読み書き（`downloadText`・`downloadSpriteModule`・`readText`・`getFileName`・`toCanvasName`のみ使用）。
     * @type {{downloadText: Function, downloadSpriteModule: Function, readText: Function, getFileName: Function, toCanvasName: Function}}
     */
    #fileIO;

    /**
     * キャンバス一覧の管理（`createCanvasFromShapes`・`getState`・`onChange`のみ使用）。
     * @type {{createCanvasFromShapes: Function, getState: Function, onChange: Function}}
     */
    #canvasLibrary;

    /**
     * 作業データの図形追加（`insertDocument`のみ使用）。
     * @type {{insertDocument: Function}}
     */
    #inserter;

    /**
     * 図形一式の読み取り元（`getShapes`のみ使用）。
     * @type {{getShapes: Function}}
     */
    #model;

    /**
     * インポートの前提（進行中の入力操作の中断と選択モード）を整える注入関数。
     * @type {Function}
     */
    #prepareInsert;

    /**
     * ファイル操作の通知（無ければnull）。
     * @type {FileNotice|null}
     */
    #notice = null;

    /**
     * 読み取りの開始から完了までの処理中か。
     * @type {boolean}
     */
    #isProcessing = false;

    /**
     * 直前に確認した開いているキャンバスの識別子（切り替えの検知用）。
     * @type {string|null}
     */
    #lastOpenCanvasId;

    /**
     * 状態の変化時に呼び出されるリスナー群。
     * @type {Function[]}
     */
    #listeners = [];

    /**
     * @param {Object} deps 依存
     * @param {Object} deps.fileIO 作業データファイル・スプライトのファイルの読み書き（`DocumentFileIO`）
     * @param {Object} deps.canvasLibrary キャンバス一覧の管理（`CanvasLibrary`）
     * @param {Object} deps.inserter 作業データの図形追加（`ShapeInserter`）
     * @param {Object} deps.model 図形一式の読み取り元（`VectorModel`。`getShapes`のみ使用）
     * @param {Function} deps.prepareInsert インポートの前提を整える関数（実体は選択モードへの切り替え。本クラスは操作モードを知らない）
     * @throws {Error} `prepareInsert`が関数でない場合
     */
    constructor({ fileIO, canvasLibrary, inserter, model, prepareInsert }) {
        if (typeof prepareInsert !== 'function') {
            throw new Error('CanvasFileOperations: prepareInsertは関数である必要があります');
        }
        this.#fileIO = fileIO;
        this.#canvasLibrary = canvasLibrary;
        this.#inserter = inserter;
        this.#model = model;
        this.#prepareInsert = prepareInsert;
        this.#lastOpenCanvasId = canvasLibrary.getState().openCanvasId;
        canvasLibrary.onChange(() => this.#handleLibraryChange());
    }

    /**
     * 出力（作業ファイル）：開いているキャンバスの図形一式を作業データファイルとしてダウンロードする（同期。例外は投げない。ただしリスナー（表示同期）の例外を除く）。
     * 受理条件を満たさなければ何も変えず`false`。受理時にファイル操作の通知を消す。
     * @returns {boolean} 出力したか
     */
    exportCanvas() {
        const state = this.getState();
        if (state.loading || state.busy) {
            return false;
        }
        if (this.#notice !== null) {
            this.#notice = null;
            this.#notifyChange();
        }
        try {
            const text = DocumentSerializer.serializeToString(this.#model.getShapes());
            this.#fileIO.downloadText(text, state.openCanvasName ?? '');
            return true;
        } catch (error) {
            console.warn('CanvasFileOperations: 出力（作業ファイル）に失敗しました', error);
            this.#notice = { kind: 'exportFailed', fileName: null, skippedCount: 0 };
            this.#notifyChange();
            return false;
        }
    }

    /**
     * 出力（エンジン用）：開いているキャンバスをスプライトのJS（`<名前>.js`）としてダウンロードする
     * （同期。例外は投げない。ただしリスナー（表示同期）の例外を除く）。
     * 受理条件を満たさなければ何も変えず`false`。受理時にファイル操作の通知を消す。
     * JSのテキストを組み立ててからダウンロードする。失敗時は通知`spriteExportFailed`。
     * @returns {boolean} JSをダウンロードしたか
     */
    exportSprite() {
        const state = this.getState();
        if (state.loading || state.busy) {
            return false;
        }
        if (this.#notice !== null) {
            this.#notice = null;
            this.#notifyChange();
        }
        try {
            const spriteData = SpriteSerializer.serialize(this.#model.getShapes());
            const moduleText = CodeExporter.toModuleText(spriteData);
            const canvasName = state.openCanvasName ?? '';
            this.#fileIO.downloadSpriteModule(moduleText, canvasName);
            return true;
        } catch (error) {
            console.warn('CanvasFileOperations: 出力（エンジン用）に失敗しました', error);
            this.#notice = { kind: 'spriteExportFailed', fileName: null, skippedCount: 0 };
            this.#notifyChange();
            return false;
        }
    }

    /**
     * ファイルを新しいキャンバスとして開く（キャンバス一覧へ登録して開いているキャンバスと入れ替える）。rejectしない（リスナーの例外を除く）。
     * @param {File} file 開くファイル（不透明に扱い、`fileIO`へ渡すのみ）
     * @returns {Promise<boolean>} 新しいキャンバスとして開いたか
     */
    async openFile(file) {
        return this.#runReadOperation(
            file,
            (state) => state.canManage,
            async (result, fileName) => {
                const classification = CanvasFileOperations.#classifyRead(result);
                if (classification.kind === 'unreadable') {
                    this.#notice = { kind: 'readFailed', fileName, skippedCount: 0 };
                    return false;
                }
                const opened = await this.#canvasLibrary.createCanvasFromShapes(
                    this.#fileIO.toCanvasName(fileName),
                    result.shapes
                );
                if (!opened) {
                    if (this.#canvasLibrary.getState().issue !== 'writeFailed') {
                        this.#notice = { kind: 'readFailed', fileName, skippedCount: 0 };
                    }
                    return false;
                }
                if (classification.kind === 'partial') {
                    this.#notice = { kind: 'partialRead', fileName, skippedCount: classification.skippedCount };
                }
                return true;
            }
        );
    }

    /**
     * ファイルの図形を開いているキャンバスへ追加する（ファイル内の座標のまま）。rejectしない（リスナーの例外を除く）。
     * @param {File} file インポートするファイル（不透明に扱い、`fileIO`へ渡すのみ）
     * @returns {Promise<boolean>} 図形を追加したか
     */
    async importFile(file) {
        const startCanvasId = this.#canvasLibrary.getState().openCanvasId;
        return this.#runReadOperation(
            file,
            () => true,
            async (result, fileName) => {
                const classification = CanvasFileOperations.#classifyRead(result);
                if (classification.kind === 'unreadable') {
                    this.#notice = { kind: 'readFailed', fileName, skippedCount: 0 };
                    return false;
                }
                if (classification.kind === 'empty') {
                    this.#notice = { kind: 'noShapes', fileName, skippedCount: 0 };
                    return false;
                }
                // キャンバスの同一性の確認（canvasLibrary.getState()の値で判定。合成後のbusyは使わない）
                const libraryState = this.#canvasLibrary.getState();
                if (libraryState.openCanvasId !== startCanvasId || libraryState.loading || libraryState.busy) {
                    console.warn('CanvasFileOperations: 読み取り中にキャンバスが変わったためインポートを中止しました');
                    this.#notice = { kind: 'readFailed', fileName, skippedCount: 0 };
                    return false;
                }
                this.#prepareInsert();
                const inserted = this.#inserter.insertDocument(DocumentSerializer.serialize(result.shapes), 0, 0);
                if (!inserted || !inserted.ok || !Array.isArray(inserted.insertedIds) || inserted.insertedIds.length === 0) {
                    console.warn('CanvasFileOperations: 図形を追加できませんでした', inserted);
                    this.#notice = { kind: 'readFailed', fileName, skippedCount: 0 };
                    return false;
                }
                const skippedCount = result.skipped.length + (Array.isArray(inserted.skipped) ? inserted.skipped.length : 0);
                if (skippedCount > 0) {
                    this.#notice = { kind: 'partialRead', fileName, skippedCount };
                }
                return true;
            }
        );
    }

    /**
     * 現在の状態を返す（毎回新しいオブジェクト）。`canvasLibrary.getState()`に`busy`の合成と`fileNotice`を加える。
     * @returns {CanvasFileOperationsState}
     */
    getState() {
        const libraryState = this.#canvasLibrary.getState();
        return {
            ...libraryState,
            busy: libraryState.busy || this.#isProcessing,
            fileNotice: this.#notice
        };
    }

    /**
     * 状態の変化時（`canvasLibrary.onChange`の転送を含む）に呼び出されるリスナーを登録する。
     * @param {Function} listener 登録するリスナー（関数以外は無視する）
     */
    onChange(listener) {
        if (typeof listener === 'function') {
            this.#listeners.push(listener);
        }
    }

    /**
     * 開く（ファイル）・インポートの共通の流れ。
     * 受理判定 → 処理中にして通知を消す → 読み取り＋デシリアライズ → `apply` → 完了。rejectしない（リスナーの例外を除く）。
     * @param {File} file 対象のファイル
     * @param {(state: CanvasFileOperationsState) => boolean} canAccept 操作固有の受理条件（共通の`loading`・`busy`の判定に加えて評価）
     * @param {(result: (Object|null), fileName: string) => Promise<boolean>} apply 読み取り結果（読み取り失敗は`null`）を受けて実行する処理
     * @returns {Promise<boolean>} `apply`の結果（不受理・例外は`false`）
     */
    async #runReadOperation(file, canAccept, apply) {
        const state = this.getState();
        if (state.loading || state.busy || !canAccept(state)) {
            return false;
        }
        this.#isProcessing = true;
        this.#notice = null;
        this.#notifyChange();
        let fileName = '';
        try {
            fileName = this.#fileIO.getFileName(file);
            let result = null;
            try {
                const text = await this.#fileIO.readText(file);
                result = FileContentReader.deserializeFromText(text);
            } catch (error) {
                console.warn('CanvasFileOperations: ファイルを読み取れませんでした', error);
                result = null;
            }
            return await apply(result, fileName);
        } catch (error) {
            console.warn('CanvasFileOperations: ファイル操作中に予期しないエラーが発生しました', error);
            this.#notice = { kind: 'readFailed', fileName, skippedCount: 0 };
            return false;
        } finally {
            this.#isProcessing = false;
            this.#notifyChange();
        }
    }

    /**
     * 読み込み結果を分類する（判定の表は本クラスのJSDocを参照）。作業データ自体の`shapes`は参照しない。
     * @param {({ok: boolean, shapes: Array, skipped: Array}|null)} result `FileContentReader.deserializeFromText`の結果（読み取り失敗は`null`）
     * @returns {ReadClassification}
     */
    static #classifyRead(result) {
        if (result === null || !result.ok) {
            return { kind: 'unreadable', skippedCount: 0 };
        }
        const readCount = result.shapes.length;
        const skippedCount = result.skipped.length;
        if (readCount === 0 && skippedCount > 0) {
            return { kind: 'unreadable', skippedCount };
        }
        if (readCount === 0) {
            return { kind: 'empty', skippedCount: 0 };
        }
        if (skippedCount > 0) {
            return { kind: 'partial', skippedCount };
        }
        return { kind: 'all', skippedCount: 0 };
    }

    /**
     * `canvasLibrary.onChange`の処理。開いているキャンバスが変わっていればファイル操作の通知を消し、リスナーへ転送する。
     * @returns {void}
     */
    #handleLibraryChange() {
        const openCanvasId = this.#canvasLibrary.getState().openCanvasId;
        if (openCanvasId !== this.#lastOpenCanvasId) {
            this.#lastOpenCanvasId = openCanvasId;
            this.#notice = null;
        }
        this.#notifyChange();
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
}
