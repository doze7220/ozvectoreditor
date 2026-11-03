/**
 * 責務: 作業データ形式のオブジェクトの図形を、平行移動したうえで新しいidで現在のキャンバスの最前面へ追加し、追加した図形だけを選択する
 * 1件の編集操作を担う（貼り付け・複製・インポートの共通処理）。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';

/**
 * 編集操作（図形一式を変化させる利用者の1回の操作）の開始・確定を受け取る記録先。
 * 実体はmain.jsが注入するHistoryManager（本ファイルはHistoryManager.jsをimportせず、この2メソッドのみを呼ぶ）。
 * @typedef {Object} EditRecorder
 * @property {() => void} beginEdit 編集操作の開始を宣言する（その時点の状態を「前の状態」として記録する）
 * @property {() => boolean} commitEdit 編集操作の確定を宣言する（前後で図形一式が変化していれば1件として記録しtrue）
 */

/**
 * insertDocumentの結果オブジェクト。
 * ok・skipped・errorはDocumentSerializer.deserializeの結果（DeserializeResult）の値をそのまま返す。
 * @typedef {Object} InsertResult
 * @property {boolean} ok 作業データ全体の読み込みに成功したか（falseなら何も追加していない）
 * @property {Array<string>} insertedIds 追加した図形の新しいid（描画順。追加0件・ok=falseなら空配列）
 * @property {Array<import('../io/DocumentSerializer.js').SkippedShape>} skipped 読み込めずにスキップした図形の記録（ok=falseなら空配列）
 * @property {string|null} error 全体の読み込み失敗の理由（ok=trueならnull）
 */

/**
 * 作業データ形式のオブジェクトの図形を、現在のキャンバスへ新しいidで追加する1件の編集操作を行うクラス。
 * 貼り付け・複製（ClipboardController）と、インポート（Phase 03-05）の共通処理として用いる。
 *
 * 依存の制約:
 *   - VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。InputTrackerには依存しない。
 *   - DOMに触れない。図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない
 *     （図形の生成はDocumentSerializer、平行移動は図形の共通インターフェースtranslate、id採番はVectorModelへ委ねる）。
 *
 * 前提（呼び出し側の責務）:
 *   - 選択モードであること（追加した図形を選択するため。選択集合は選択モード以外では常に空という不変条件を呼び出し側が守る）。
 *   - ドラッグ中でないこと・作成途中の図形がないこと（必要なら呼び出し側が先にapplyMode／InputTracker.abortOngoingOperation()を呼ぶ）。
 *   本クラスは操作モードの切り替え・進行中の入力操作の中断を行わない。
 */
export class ShapeInserter {
    /**
     * 図形の追加先（現在のキャンバスの図形一式と選択集合を保持するVectorModel）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はmain.jsが注入するHistoryManager）。
     * @type {EditRecorder}
     */
    #editRecorder;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形の追加先のVectorModel
     * @param {EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     */
    constructor({ model, editRecorder }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
    }

    /**
     * 作業データ形式のオブジェクトの図形を、(dx, dy)だけ平行移動したうえで新しいidで現在のキャンバスの最前面へ追加し、
     * 追加した図形だけを選択する。
     *
     * 処理順:
     *   1. DocumentSerializer.deserialize(documentData)で図形インスタンスを生成する。ok=falseなら何も変更せず
     *      （履歴にも記録せず）、insertedIds=[]で返す。
     *   2. 復元できた図形が0件なら何も変更せず返す（全図形がスキップされた場合を含む）。
     *   3. 各図形にtranslate(dx, dy)を呼ぶ（dx・dyがともに0なら呼ばない。追加前のインスタンスに対して行うため変更通知は発生しない）。
     *   4. editRecorder.beginEdit() → model.addShapesWithNewIds(shapes) → editRecorder.commitEdit()。
     *   5. { ok: true, insertedIds, skipped, error: null }を返す。
     *
     * 独立性: 呼び出しのたびにdeserializeで新しい図形インスタンスを生成するため、追加した図形は元の図形・documentData・
     * 他の呼び出しで追加した図形と状態を共有しない。同じdocumentDataから何回追加しても毎回別のid（VectorModelが採番）になる。
     * documentDataは書き換えない。
     *
     * スキップの扱い: 一部の図形が読み込めずスキップされた場合も、復元できた図形だけを追加する
     * （スキップはDocumentSerializerがconsole.warn済み。戻り値のskippedで呼び出し側へ伝える）。
     *
     * 履歴への記録単位: 1件以上追加した場合のみ1件の編集操作として記録する（beginEdit/commitEditで1回だけ挟む）。
     * 全体の読み込み失敗・追加0件の場合はbeginEdit/commitEditを呼ばず、記録しない。
     *
     * 前提: 選択モードであること・ドラッグ中/作成途中の図形がないことは呼び出し側の責務（クラスJSDoc参照）。
     * @param {*} documentData - 作業データ形式のオブジェクト（DocumentSerializer.serializeの戻り値や、ファイルをJSON.parseしたもの）
     * @param {number} [dx=0] - 追加する全図形に適用するx方向の平行移動量（ワールド座標。インポートで元の座標のまま追加する場合は0）
     * @param {number} [dy=0] - 追加する全図形に適用するy方向の平行移動量（ワールド座標。インポートで元の座標のまま追加する場合は0）
     * @returns {InsertResult} 結果オブジェクト
     */
    insertDocument(documentData, dx = 0, dy = 0) {
        const result = DocumentSerializer.deserialize(documentData);
        if (!result.ok) {
            return { ok: false, insertedIds: [], skipped: result.skipped, error: result.error };
        }

        const shapes = result.shapes;
        if (shapes.length === 0) {
            return { ok: true, insertedIds: [], skipped: result.skipped, error: null };
        }

        if (dx !== 0 || dy !== 0) {
            shapes.forEach((shape) => shape.translate(dx, dy));
        }

        this.#editRecorder.beginEdit();
        const insertedIds = this.#model.addShapesWithNewIds(shapes);
        this.#editRecorder.commitEdit();

        return { ok: true, insertedIds, skipped: result.skipped, error: null };
    }
}
