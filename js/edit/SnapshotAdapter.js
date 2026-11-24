/**
 * 責務：履歴のスナップショット（作業データ＋選択集合＋フォルダの選択・折りたたみの記録）の取得と、キャンバスへの適用を担う（HistoryManagerへ注入するcapture/restoreの実体）。DOMに触れない。
 */
import { DocumentSerializer } from '../io/DocumentSerializer.js';
import { withoutCollapsed, listCollapsedIds, restoreCollapsed } from '../core/GroupCollapseRules.js';

/**
 * スナップショット：ある時点の図形一式と選択集合、フォルダの選択、閉じているフォルダ。
 * `core/HistoryManager.js`のtypedef`Snapshot`と同じ内容である（形を変える場合は両方を揃えること）。
 * @typedef {Object} Snapshot
 * @property {Object} document 作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値。折りたたみ`collapsed`は含まない）
 * @property {string[]} selectedIds その時点の選択集合（図形idの配列）
 * @property {string[]} [selectedGroupIds] その時点で選んでいるフォルダのid（無ければ空として扱う）
 * @property {string[]} [collapsedGroupIds] その時点で閉じているフォルダのid（無ければ空として扱う）
 */

/**
 * 履歴のスナップショットの取得（capture）と適用（restore）を行うクラス。
 * main.jsが生成し、`capture`/`restore`をHistoryManagerへ注入する。
 *
 * 依存の制約:
 *   - importはDocumentSerializerと、状態を持たない規則GroupCollapseRulesのみ。VectorModelはインスタンスを注入で受け取る。
 *   - DOMに触れない。図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない。
 *   - 操作モード（OperationMode・InputTracker）をimport・参照しない。選択集合を復元してよいかの判定は、
 *     注入された`shouldRestoreSelection()`の戻り値にのみ従い、その判定の根拠は知らない（実体は呼び出し側が与える）。
 *
 * 前提（呼び出し側の責務）:
 *   - 進行中の入力操作の中断は本クラスでは行わない（呼び出し側＝取り消し・やり直しの操作経路の責務）。
 */
export class SnapshotAdapter {
    /**
     * スナップショットの取得元・適用先（現在のキャンバスの図形一式と選択集合を保持するVectorModel）。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 選択集合を復元してよいかを返す注入関数。
     * @type {() => boolean}
     */
    #shouldRestoreSelection;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - スナップショットの取得元・適用先のVectorModel
     * @param {() => boolean} deps.shouldRestoreSelection - 選択集合を復元してよいかを返す関数（restore時に呼ばれる）
     * @throws {Error} shouldRestoreSelectionが関数でない場合
     */
    constructor({ model, shouldRestoreSelection }) {
        if (typeof shouldRestoreSelection !== 'function') {
            throw new Error('SnapshotAdapter: shouldRestoreSelection must be a function.');
        }
        this.#model = model;
        this.#shouldRestoreSelection = shouldRestoreSelection;
    }

    /**
     * 現在の図形一式と選択集合をスナップショットとして取得する（HistoryManagerへ`capture`として注入）。
     * スナップショットは作業データ形式のオブジェクト（折りたたみを外した入れ子を`DocumentSerializer.serialize`したもの。入れ子のフォルダ・名前・表示・ロックを含み、
     * `collapsed`を含まないため、履歴の比較・まとめの鍵の結果は折りたたみで変わらない）と、その時点の選択集合（図形idの配列）、
     * 選んでいるフォルダのid、閉じているフォルダのid（`collapsedGroupIds`）からなる。`serialize`は各図形の`toJSON()`で新しいオブジェクトを作り、
     * `getSelectedIds()`・`getSelectedGroupIds()`は新しい配列を返すため、図形インスタンス・Modelの内部状態とは共有しない。
     * @returns {Snapshot} スナップショット
     */
    capture() {
        return {
            document: DocumentSerializer.serialize(withoutCollapsed(this.#model.getItems())),
            selectedIds: this.#model.getSelectedIds(),
            selectedGroupIds: this.#model.getSelectedGroupIds(),
            collapsedGroupIds: listCollapsedIds(this.#model.getItems())
        };
    }

    /**
     * スナップショットの状態をキャンバスへ適用する（HistoryManagerへ`restore`として注入）。
     * 作業データをデシリアライズし、全体の読み込み失敗またはスキップが1件以上あれば`console.warn`して
     * キャンバスを変更せず`false`を返す（一部の図形だけが戻る中途半端な状態を避けるため）。
     * 成功時は入れ子の並び（`result.items`。折りたたみは`restoreCollapsed`で決め直す：今あるフォルダは今の折りたたみを保ち、無いフォルダは記録時の閉じていたかに従う）を入れ替え（図形・フォルダのidは保持される。選択集合・ホバー・作成中の図形・選択矩形はクリアされる）、
     * 描き込む先は今の値を規則に通して残す（`keepInsertTarget: true`。続く`setSelection`で1つ以上選ばれれば選ばれている一番上の図形になる。保存はしない）。
     * `shouldRestoreSelection()`が真のときのみ記録時点の選択集合とフォルダの選択を復元する（存在しないidは`setSelection`が無視・不変条件で落とす。
     * 偽のときは選択集合は空のまま）。復元は`keepsCollapsed: true`で行い、折りたたみを開かない。`selectedGroupIds`・`collapsedGroupIds`が無いスナップショットは空として扱う。
     * 進行中の入力操作の中断は本メソッドでは行わない（呼び出し側の責務）。
     * @param {Snapshot} snapshot - 適用するスナップショット
     * @returns {boolean} 適用したか（falseならキャンバスは変更されていない）
     */
    restore(snapshot) {
        const result = DocumentSerializer.deserialize(snapshot.document);
        if (!result.ok || result.skipped.length > 0) {
            console.warn('履歴の適用に失敗したため、キャンバスを変更しません。', result.error, result.skipped);
            return false;
        }
        const items = restoreCollapsed(result.items, this.#model.getItems(), snapshot.collapsedGroupIds ?? []);
        this.#model.replaceAllShapes(items, { keepInsertTarget: true });
        if (this.#shouldRestoreSelection()) {
            this.#model.setSelection(snapshot.selectedIds, {
                groupIds: snapshot.selectedGroupIds ?? [],
                keepsCollapsed: true
            });
        }
        return true;
    }
}
