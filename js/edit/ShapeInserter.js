/**
 * 責務: 作業データ形式のオブジェクトの図形を、平行移動したうえで新しいidで現在のキャンバスの最前面へ追加し、追加した図形だけを選択する
 * 1件の編集操作を担う（貼り付け・複製・インポートの共通処理）。ほかに、開いている編集操作の中で記録せずに追加する入口を持つ（Alt+ドラッグの複製が使う）。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';

/**
 * 編集操作（図形一式を変化させる利用者の1回の操作）の開始・確定を受け取る記録先。
 * 実体はmain.jsが注入するHistoryManager（本ファイルはHistoryManager.jsをimportせず、この2メソッドのみを呼ぶ）。
 * `core/InputTracker.js`に同じ内容の定義がある（二重定義。形を変える場合は両方を揃えること）。
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
 * insertDocumentは1件の編集操作として記録し、insertDocumentWithinEditは呼び出し側が開いている編集操作の中で記録せずに追加する。
 *
 * 依存の制約:
 *   - VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。InputTrackerには依存しない。
 *   - DOMに触れない。図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない
 *     （図形の生成はDocumentSerializer、平行移動は図形の共通インターフェースtranslate、id採番はVectorModelへ委ねる）。
 *
 * 前提（呼び出し側の責務）:
 *   - 選択モードであること（追加した図形を選択するため。選択集合は選択モード以外では常に空という不変条件を呼び出し側が守る）。
 *   - ドラッグ中でないこと・作成途中の図形がないこと（必要なら呼び出し側が先にapplyMode／InputTracker.abortOngoingOperation()を呼ぶ）。
 *     ただし「ドラッグ中でないこと」はinsertDocumentの前提である。insertDocumentWithinEditは例外で、
 *     閾値を超えた後の左ドラッグ中に、呼び出し側が開いている編集操作（ドラッグの編集操作）の中で呼ばれる
 *     （作成途中の図形がないことは同様に前提）。
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
     * @param {*} documentData - 作業データ形式のオブジェクト（DocumentSerializer.serializeの戻り値。インポートも読めた図形をserializeし直して渡す）
     * @param {number} [dx=0] - 追加する全図形に適用するx方向の平行移動量（ワールド座標。インポートで元の座標のまま追加する場合は0）
     * @param {number} [dy=0] - 追加する全図形に適用するy方向の平行移動量（ワールド座標。インポートで元の座標のまま追加する場合は0）
     * @returns {InsertResult} 結果オブジェクト
     */
    insertDocument(documentData, dx = 0, dy = 0) {
        return this.#insert(documentData, dx, dy, true);
    }

    /**
     * insertDocumentと同じ処理順・戻り値で追加するが、editRecorder.beginEdit()／commitEdit()を呼ばず、履歴へ記録しない入口。
     * 呼び出し側が既に開いている編集操作（例: Alt+ドラッグの閾値超過時にbeginEditした編集操作）の中で呼ぶ前提で、
     * 追加は呼び出し側の編集操作に含まれて確定時に1件として記録される。
     * 開いている編集操作の外で呼ぶと、追加は履歴に記録されない（呼び出し側の責務）。
     *
     * 前提: 選択モードであること・作成途中の図形がないことは呼び出し側の責務。ドラッグ中でないことは求めない（クラスJSDoc参照）。
     * @param {*} documentData - 作業データ形式のオブジェクト（insertDocumentと同じ）
     * @param {number} [dx=0] - 追加する全図形に適用するx方向の平行移動量（ワールド座標）
     * @param {number} [dy=0] - 追加する全図形に適用するy方向の平行移動量（ワールド座標）
     * @returns {InsertResult} 結果オブジェクト（insertDocumentと同じ）
     */
    insertDocumentWithinEdit(documentData, dx = 0, dy = 0) {
        return this.#insert(documentData, dx, dy, false);
    }

    /**
     * insertDocument・insertDocumentWithinEditの共通の本体（処理順はinsertDocumentのJSDocのとおり）。
     * @param {*} documentData - 作業データ形式のオブジェクト
     * @param {number} dx - x方向の平行移動量
     * @param {number} dy - y方向の平行移動量
     * @param {boolean} record - trueならbeginEdit/commitEditで1回だけ挟んで記録する。falseなら呼ばない
     * @returns {InsertResult} 結果オブジェクト
     */
    #insert(documentData, dx, dy, record) {
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

        if (record) {
            this.#editRecorder.beginEdit();
        }
        const insertedIds = this.#model.addShapesWithNewIds(shapes);
        if (record) {
            this.#editRecorder.commitEdit();
        }

        return { ok: true, insertedIds, skipped: result.skipped, error: null };
    }
}
