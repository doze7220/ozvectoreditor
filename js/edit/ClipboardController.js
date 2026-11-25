/**
 * 責務: アプリ内部のクリップボード（コピー・切り取りしたアイテム一式と貼り付けの段数）の保持と、
 * コピー・切り取り・貼り付け・同じ位置に貼り付け・複製（Alt+ドラッグの記録しない複製を含む）の手順を、フォルダの形を保ったまま担う。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';
import { pickItems, listGroupIds } from '../core/GroupTreeRules.js';
import { resolveSelectedUnitIds } from '../core/GroupSelectionRules.js';
import { resolvePastePlace, resolveDuplicatePlace } from '../core/InsertTargetRules.js';

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
 *   - コピー・切り取りしたアイテム一式（選んでいるまとまり。フォルダは名前・表示・ロック・折りたたみ・入れ子・中の順番を保つ）を、作業データ形式のオブジェクト（DocumentSerializer.serializeの戻り値）として保持する。
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
 *   - 複製・同じ位置に貼り付け・Alt+ドラッグの複製・取り消し・やり直しでは変えない。
 *
 * 前提（呼び出し側の責務）:
 *   - 貼り付け・同じ位置に貼り付け・複製は、選択モードであること・ドラッグ中でないことを呼び出し側が保証する
 *     （本クラスは操作モードを知らず、InputTrackerに依存しない）。
 *   - duplicateInPlaceWithinEditはドラッグの編集操作の中で呼ばれる（InputTrackerへmain.jsが注入する。
 *     閾値超過時のbeginEditの後に呼ばれ、確定時に移動とあわせて1件として記録される）。上の「ドラッグ中でないこと」の例外。
 *
 * 自分のコピーの見分け（#copiedGroupIdsByCanvas）:
 *   - コピー・切り取りで、写したまとまりの中のフォルダすべて（入れ子の中も）のidを、その時点のキャンバスの識別値（getCanvasId）へ作り直して入れる。
 *   - 貼り付けでフォルダが入ったら、そのフォルダ（入れ子の中も）のidも今の識別値へ足す（続けて貼り付けても、貼り付けたコピーの中へ入り込まず、すぐ上へ重なるため）。
 *   - 描き込む先がそのうちのフォルダの中（inside）なら、貼り付けは中でなくそのフォルダのすぐ上へ入る（resolvePastePlace）。
 *     識別値の中身は解釈しない（フォルダのidは別のキャンバスと同じ値になり得るため、別のキャンバスでは自分のコピーとみなさない）。
 *
 * 依存の制約:
 *   - DOMに触れない。図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない
 *     （変換はDocumentSerializer、追加・id採番・選択はShapeInserter経由でVectorModelへ委ねる）。
 *   - coreからimportするのは状態を持たない規則の関数だけ（GroupTreeRulesのpickItems・listGroupIds、GroupSelectionRulesのresolveSelectedUnitIds、
 *     InsertTargetRulesのresolvePastePlace・resolveDuplicatePlace）。modelはgetItems・isSelected・getSelectedGroupIds・getInsertTargetだけを使う。
 *   - 貼り付け・複製はまとまりとして（asUnits）、入る場所（place）を指定してShapeInserterへ渡す。
 */
export class ClipboardController {
    /**
     * 選択集合・選んでいるフォルダ・描き込む先・アイテム一式の読み取り元（getItems・isSelected・getSelectedGroupIds・getInsertTargetのみ使用）。
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
     * キャンバスの識別値ごとの「自分のコピー」のフォルダのid（コピー・切り取りで作り直し、貼り付けで入ったフォルダを足す）。
     * @type {Map<*, Set<string>>}
     */
    #copiedGroupIdsByCanvas = new Map();

    /**
     * 今開いているキャンバスの識別値を返す関数（中身は解釈しない。省けば常にnull）。
     * @type {() => *}
     */
    #getCanvasId;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 選択集合と図形一式を読み取るVectorModel
     * @param {import('./ShapeInserter.js').ShapeInserter} deps.inserter - 貼り付け・複製の追加処理を行うShapeInserter
     * @param {() => boolean} deps.deleteSelection - 選択集合を削除する関数（実体はinputTracker.deleteSelection()。受理したらtrue）
     * @param {() => *} [deps.getCanvasId] - 今のキャンバスの識別値を返す関数（自分のコピーの見分け用。省けば常にnull）
     * @throws {Error} deleteSelectionが関数でない場合
     */
    constructor({ model, inserter, deleteSelection, getCanvasId = () => null }) {
        if (typeof deleteSelection !== 'function') {
            throw new Error('ClipboardController: deleteSelectionは関数である必要があります');
        }
        this.#model = model;
        this.#inserter = inserter;
        this.#deleteSelection = deleteSelection;
        this.#getCanvasId = getCanvasId;
    }

    /**
     * クリップボードが空か（一度もコピー・切り取りしていない）を返す。
     * @returns {boolean} 空ならtrue
     */
    isEmpty() {
        return this.#documentData === null;
    }

    /**
     * 選んでいるまとまり（フォルダを含む。形のまま）をクリップボードへ記録する（コピー）。
     * 選んでいるまとまりが空なら何もせずfalseを返す（クリップボードの内容・段数を変えない）。
     * 記録した場合は段数を1にリセットする（コピー直後の貼り付けは1段ずれる）。
     * 図形一式・選択集合・履歴は変化させない（編集操作として記録しない）。
     * 何もしなかった場合にfalseを返すのは、呼び出し側がpreventDefault()せず、ページ上で選択した文字の
     * ブラウザ標準のコピーを妨げないため。
     * @returns {boolean} 図形を記録したらtrue
     */
    copy() {
        const picked = this.#pickSelection();
        if (picked === null) {
            return false;
        }
        this.#documentData = DocumentSerializer.serialize(picked.items);
        this.#resetCopiedGroupIds(picked.items);
        this.#nextPasteStep = 1;
        return true;
    }

    /**
     * 選んでいるまとまり（フォルダを含む。形のまま）をクリップボードへ記録し、キャンバスから削除する（切り取り）。
     * 選んでいるまとまりが空なら何もせずfalseを返す（クリップボードの内容・段数を変えない）。
     * 先に選択集合の図形を作業データへ変換して手元に保持し、注入されたdeleteSelection()を呼ぶ。
     * 削除が受理された場合のみクリップボードをその内容で置き換え、段数を0にリセットしてtrueを返す
     * （切り取り直後の貼り付けは元の位置）。非受理ならクリップボードを変えずにfalseを返す。
     * 削除は既存の唯一の削除経路（deleteSelection）を通るため、結果（選択集合が空になる）・履歴への記録
     * （1件の編集操作）ともDeleteキーによる削除と同一になる。
     * 何もしなかった場合にfalseを返す理由はcopy()と同じ（ブラウザ標準の文字の切り取りを妨げないため）。
     * @returns {boolean} 切り取った（削除を受理した）らtrue
     */
    cut() {
        const picked = this.#pickSelection();
        if (picked === null) {
            return false;
        }
        const documentData = DocumentSerializer.serialize(picked.items);
        if (!this.#deleteSelection()) {
            return false;
        }
        this.#documentData = documentData;
        this.#resetCopiedGroupIds(picked.items);
        this.#nextPasteStep = 0;
        return true;
    }

    /**
     * クリップボードのアイテムの新しい複製を、フォルダの形のまま新しいidでキャンバスへ追加する（貼り付け）。
     * 入る場所は描き込む先（resolvePastePlace。自分のコピーのフォルダの中が描き込む先ならそのフォルダのすぐ上、無ければ最前面）。
     * クリップボードが空なら何もせずfalseを返す。
     * ずらし量は「段数 × PASTE_OFFSET_STEP」（x・yとも同量、右下方向）。追加した図形・フォルダだけが選択される。
     * 1件以上追加した場合のみ段数を1増やし、入ったフォルダのidを自分のコピーへ足してtrueを返す（追加0件なら段数を変えずfalse）。
     * 追加・id採番・選択・1件の編集操作としての記録はShapeInserter.insertDocumentが行う。
     * 前提: 選択モードであること・ドラッグ中でないことは呼び出し側の責務（本クラスは操作モードを知らない）。
     * @returns {boolean} 1件以上貼り付けたらtrue
     */
    paste() {
        if (this.#documentData === null) {
            return false;
        }
        const offset = this.#nextPasteStep * PASTE_OFFSET_STEP;
        const result = this.#inserter.insertDocument(this.#documentData, offset, offset, { place: this.#resolvePastePlace(), asUnits: true });
        if (!result.inserted) {
            return false;
        }
        this.#nextPasteStep += 1;
        this.#addPastedGroupIds();
        return true;
    }

    /**
     * 選んでいるまとまりの新しい複製を、クリップボードを経由せずフォルダの形のまま1段（PASTE_OFFSET_STEP）右下へずらして、
     * まとまりの一番上のもののすぐ上へ追加する（複製）。
     * 選んでいるまとまりが空なら何もせずfalseを返す。追加したものだけが選択されるため、続けて複製すると階段状に並ぶ。
     * クリップボードの内容・段数・自分のコピーは変えない。
     * 追加・id採番・選択・1件の編集操作としての記録はShapeInserter.insertDocumentが行う。
     * 前提: 選択モードであること・ドラッグ中でないことは呼び出し側の責務（本クラスは操作モードを知らない）。
     * @returns {boolean} 1件以上複製したらtrue
     */
    duplicate() {
        const picked = this.#pickSelection();
        if (picked === null) {
            return false;
        }
        const result = this.#inserter.insertDocument(
            DocumentSerializer.serialize(picked.items), PASTE_OFFSET_STEP, PASTE_OFFSET_STEP,
            { place: resolveDuplicatePlace(picked.unitIds), asUnits: true }
        );
        return result.inserted;
    }

    /**
     * クリップボードのアイテムの新しい複製を、元と同じ位置（ずらし量0）に、フォルダの形のまま新しいidでキャンバスへ追加する（同じ位置に貼り付け。入る場所はpaste()と同じ）。
     * クリップボードが空なら何もせずfalseを返す。追加したものだけが選択される。
     * 段数は読まず、変えない（続けてpaste()すると、pasteInPlace()が無かった場合と同じ段数でずれる）。入ったフォルダは自分のコピーへ足す。
     * 追加・id採番・選択・1件の編集操作としての記録はShapeInserter.insertDocumentが行う。
     * 前提: 選択モードであること・ドラッグ中でないことは呼び出し側の責務（本クラスは操作モードを知らない）。
     * @returns {boolean} 1件以上貼り付けたらtrue
     */
    pasteInPlace() {
        if (this.#documentData === null) {
            return false;
        }
        const result = this.#inserter.insertDocument(this.#documentData, 0, 0, { place: this.#resolvePastePlace(), asUnits: true });
        if (!result.inserted) {
            return false;
        }
        this.#addPastedGroupIds();
        return true;
    }

    /**
     * 選んでいるまとまりの新しい複製を、クリップボードを経由せずに同じ位置へフォルダの形のまま新しいidで、まとまりの一番上のもののすぐ上へ追加し、複製だけを選択する
     * （Alt+ドラッグの複製の手順）。選んでいるまとまりが空なら何もせずfalseを返す。
     * クリップボードの内容・段数は変えない。
     * 履歴へは記録しない（ShapeInserter.insertDocumentWithinEditを使う）。呼び出し側が開いている編集操作
     * （ドラッグの編集操作。main.jsがInputTrackerへ注入して閾値超過時のbeginEditの後に呼ばせる）の中で呼ぶ前提で、
     * 開いている編集操作の外で呼ぶと記録されない。
     * 前提: 選択モードであること・作成途中の図形がないことは呼び出し側の責務（本クラスは操作モードを知らない）。
     * @returns {boolean} 1件以上複製したらtrue
     */
    duplicateInPlaceWithinEdit() {
        const picked = this.#pickSelection();
        if (picked === null) {
            return false;
        }
        const result = this.#inserter.insertDocumentWithinEdit(
            DocumentSerializer.serialize(picked.items), 0, 0,
            { place: resolveDuplicatePlace(picked.unitIds), asUnits: true }
        );
        return result.inserted;
    }

    /**
     * 選んでいるまとまり（互いに含み合わない。前順）と、そのアイテム（引数の入れ子のアイテムそのもの）を求める。
     * @returns {{ unitIds: string[], items: Array<Object> }|null} まとまりのidとアイテム（選んでいるまとまりが空ならnull）
     */
    #pickSelection() {
        const items = this.#model.getItems();
        const unitIds = resolveSelectedUnitIds({
            items,
            isSelected: (id) => this.#model.isSelected(id),
            selectedGroupIds: new Set(this.#model.getSelectedGroupIds())
        });
        if (unitIds.length === 0) {
            return null;
        }
        return { unitIds, items: pickItems(items, new Set(unitIds)) };
    }

    /**
     * 自分のコピーのフォルダのidを、今のキャンバスの識別値へ作り直す（写したアイテムの中のフォルダすべて。入れ子の中も）。
     * @param {Array<Object>} items 写したアイテム
     * @returns {void}
     */
    #resetCopiedGroupIds(items) {
        this.#copiedGroupIdsByCanvas = new Map([[this.#getCanvasId(), new Set(listGroupIds(items))]]);
    }

    /**
     * 貼り付けの入る場所を求める（描き込む先。自分のコピーのフォルダの中ならそのフォルダのすぐ上）。
     * @returns {import('../core/ItemPlaceRules.js').ItemPlace|null} 入る場所（無ければnull）
     */
    #resolvePastePlace() {
        return resolvePastePlace({
            target: this.#model.getInsertTarget(),
            copiedGroupIds: this.#copiedGroupIdsByCanvas.get(this.#getCanvasId()) ?? new Set()
        });
    }

    /**
     * 貼り付けで入ったフォルダ（選んでいるフォルダ。入れ子の中も）のidを、今の識別値の自分のコピーへ足す。
     * @returns {void}
     */
    #addPastedGroupIds() {
        const canvasId = this.#getCanvasId();
        const ids = listGroupIds(pickItems(this.#model.getItems(), new Set(this.#model.getSelectedGroupIds())));
        const copied = this.#copiedGroupIdsByCanvas.get(canvasId) ?? new Set();
        ids.forEach((id) => copied.add(id));
        this.#copiedGroupIdsByCanvas.set(canvasId, copied);
    }
}
