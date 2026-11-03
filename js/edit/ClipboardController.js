/**
 * 責務: アプリ内部のクリップボード（コピー・切り取りした図形一式と貼り付けの段数）の保持と、
 * コピー・切り取り・貼り付け・複製の手順を担う。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';

/**
 * 貼り付け・複製した図形を元の位置から右下（x・yとも正の方向）へずらす量の1段分（ワールド座標。倍率100%で画面上20px）。
 * 貼り付け・複製のずらし量の唯一の定義箇所（exportしない）。
 * @type {number}
 */
const PASTE_OFFSET_STEP = 20;

/**
 * アプリ内部のクリップボードを保持し、コピー・切り取り・貼り付け・複製を行うクラス。
 *
 * クリップボードの保持内容:
 *   - コピー・切り取りした図形一式を、作業データ形式のオブジェクト（DocumentSerializer.serializeの戻り値）として保持する。
 *     OSのクリップボード（Clipboard API）は使わない。
 *   - serializeは各図形のtoJSON()で新しいプレーンオブジェクトを生成するため、図形インスタンスを参照しない
 *     （コピー後に元の図形を変形・削除してもクリップボードの内容は変わらない）。
 *   - 保持する作業データは外部へ返さず、書き換えない（ShapeInserter経由でDocumentSerializer.deserializeへ渡すのみ）。
 *   - 履歴（HistoryManager）とは独立しており、取り消し・やり直しではクリップボードの内容・段数は変わらない。
 *   - インスタンスはmain.jsが起動時に1つだけ生成し、ページを開いている間保持する。図形一式の入れ替えや
 *     キャンバスの切り替えでは消えない（ページの再読み込みで空になる）。
 *
 * 段数（次の貼り付けで適用するずらし量の段の数）の規則:
 *   - コピーで1、切り取りで0にリセットする（コピー直後の貼り付けは1段ずれ、切り取り直後の貼り付けは元の位置）。
 *   - 貼り付けで1件以上追加するたびに1増やす。
 *   - 複製・取り消し・やり直しでは変えない。
 *
 * 前提（呼び出し側の責務）:
 *   - 貼り付け・複製は、選択モードであること・ドラッグ中でないことを呼び出し側が保証する
 *     （本クラスは操作モードを知らず、InputTrackerに依存しない）。
 *
 * 依存の制約:
 *   - DOMに触れない。図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない
 *     （変換はDocumentSerializer、追加・id採番・選択はShapeInserter経由でVectorModelへ委ねる）。
 */
export class ClipboardController {
    /**
     * 選択集合と図形一式の読み取り元（getShapes・isSelectedのみ使用）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 貼り付け・複製の追加処理（新しいidでの追加・選択・1件の編集操作の記録）。
     * @type {import('./ShapeInserter.js').ShapeInserter}
     */
    #inserter;

    /**
     * 切り取りの削除処理（実体はmain.jsが注入するinputTracker.deleteSelection()。既存の唯一の削除経路）。
     * @type {() => boolean}
     */
    #deleteSelection;

    /**
     * クリップボードの内容（作業データ形式のオブジェクト。空のときはnull）。
     * 図形インスタンスを参照しない。外部へ返さず、書き換えない。
     * @type {import('../io/DocumentSerializer.js').DocumentData|null}
     */
    #documentData = null;

    /**
     * 次の貼り付けで適用するずらし量の段数（0以上の整数）。コピーで1、切り取りで0にリセットし、貼り付けで追加するたびに+1。
     * @type {number}
     */
    #nextPasteStep = 0;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 選択集合と図形一式を読み取るVectorModel
     * @param {import('./ShapeInserter.js').ShapeInserter} deps.inserter - 貼り付け・複製の追加処理を行うShapeInserter
     * @param {() => boolean} deps.deleteSelection - 選択集合を削除する関数（実体はinputTracker.deleteSelection()。受理したらtrue）
     * @throws {Error} deleteSelectionが関数でない場合
     */
    constructor({ model, inserter, deleteSelection }) {
        if (typeof deleteSelection !== 'function') {
            throw new Error('ClipboardController: deleteSelectionは関数である必要があります');
        }
        this.#model = model;
        this.#inserter = inserter;
        this.#deleteSelection = deleteSelection;
    }

    /**
     * クリップボードが空か（一度もコピー・切り取りしていない）を返す。
     * @returns {boolean} 空ならtrue
     */
    isEmpty() {
        return this.#documentData === null;
    }

    /**
     * 選択集合の図形をクリップボードへ記録する（コピー）。
     * 選択集合が空なら何もせずfalseを返す（クリップボードの内容・段数を変えない）。
     * 記録した場合は段数を1にリセットする（コピー直後の貼り付けは1段ずれる）。
     * 図形一式・選択集合・履歴は変化させない（編集操作として記録しない）。
     * 何もしなかった場合にfalseを返すのは、呼び出し側がpreventDefault()せず、ページ上で選択した文字の
     * ブラウザ標準のコピーを妨げないため。
     * @returns {boolean} 図形を記録したらtrue
     */
    copy() {
        const documentData = this.#serializeSelection();
        if (documentData === null) {
            return false;
        }
        this.#documentData = documentData;
        this.#nextPasteStep = 1;
        return true;
    }

    /**
     * 選択集合の図形をクリップボードへ記録し、キャンバスから削除する（切り取り）。
     * 選択集合が空なら何もせずfalseを返す（クリップボードの内容・段数を変えない）。
     * 先に選択集合の図形を作業データへ変換して手元に保持し、注入されたdeleteSelection()を呼ぶ。
     * 削除が受理された場合のみクリップボードをその内容で置き換え、段数を0にリセットしてtrueを返す
     * （切り取り直後の貼り付けは元の位置）。非受理ならクリップボードを変えずにfalseを返す。
     * 削除は既存の唯一の削除経路（deleteSelection）を通るため、結果（選択集合が空になる）・履歴への記録
     * （1件の編集操作）ともDeleteキーによる削除と同一になる。
     * 何もしなかった場合にfalseを返す理由はcopy()と同じ（ブラウザ標準の文字の切り取りを妨げないため）。
     * @returns {boolean} 切り取った（削除を受理した）らtrue
     */
    cut() {
        const documentData = this.#serializeSelection();
        if (documentData === null) {
            return false;
        }
        if (!this.#deleteSelection()) {
            return false;
        }
        this.#documentData = documentData;
        this.#nextPasteStep = 0;
        return true;
    }

    /**
     * クリップボードの図形の新しい複製を、新しいidでキャンバスの最前面へ追加する（貼り付け）。
     * クリップボードが空なら何もせずfalseを返す。
     * ずらし量は「段数 × PASTE_OFFSET_STEP」（x・yとも同量、右下方向）。追加した図形だけが選択される。
     * 1件以上追加した場合のみ段数を1増やしてtrueを返す（追加0件なら段数を変えずfalse）。
     * 追加・id採番・選択・1件の編集操作としての記録はShapeInserter.insertDocumentが行う。
     * 前提: 選択モードであること・ドラッグ中でないことは呼び出し側の責務（本クラスは操作モードを知らない）。
     * @returns {boolean} 1件以上貼り付けたらtrue
     */
    paste() {
        if (this.#documentData === null) {
            return false;
        }
        const offset = this.#nextPasteStep * PASTE_OFFSET_STEP;
        const result = this.#inserter.insertDocument(this.#documentData, offset, offset);
        if (result.insertedIds.length === 0) {
            return false;
        }
        this.#nextPasteStep += 1;
        return true;
    }

    /**
     * 選択集合の図形の新しい複製を、クリップボードを経由せずに1段（PASTE_OFFSET_STEP）右下へずらして追加する（複製）。
     * 選択集合が空なら何もせずfalseを返す。追加した図形だけが選択されるため、続けて複製すると階段状に並ぶ。
     * クリップボードの内容・段数は変えない。
     * 追加・id採番・選択・1件の編集操作としての記録はShapeInserter.insertDocumentが行う。
     * 前提: 選択モードであること・ドラッグ中でないことは呼び出し側の責務（本クラスは操作モードを知らない）。
     * @returns {boolean} 1件以上複製したらtrue
     */
    duplicate() {
        const documentData = this.#serializeSelection();
        if (documentData === null) {
            return false;
        }
        const result = this.#inserter.insertDocument(documentData, PASTE_OFFSET_STEP, PASTE_OFFSET_STEP);
        return result.insertedIds.length > 0;
    }

    /**
     * 選択集合の図形を描画順（VectorModelの図形配列の並び）で作業データ形式のオブジェクトへ変換する。
     * @returns {import('../io/DocumentSerializer.js').DocumentData|null} 新しい作業データ（選択集合が空ならnull）
     */
    #serializeSelection() {
        const selectedShapes = this.#model.getShapes().filter((shape) => this.#model.isSelected(shape.id));
        if (selectedShapes.length === 0) {
            return null;
        }
        return DocumentSerializer.serialize(selectedShapes);
    }
}
