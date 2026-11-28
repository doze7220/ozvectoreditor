/**
 * 責務：図形とフォルダのアイテムの入れ子の並び・選択集合・ホバー・作成中図形・選択矩形・吸い付きの表示の点（結合する吸い付きか吸い付くだけかの別を含む）・新しく描く図形のスタイル（直前に使った値）の
 * 状態管理（SSOT：Single Source of Truth）と更新通知を担う。頂点の選択（変えられる図形の組だけ。一時的な状態）と、描き込む先（保存しない）も保持する。
 * アイテムの名前・表示・ロックの値の変更を受け付け、表示・ロックの照会（見えている図形・変えられる図形・選んでいる変えられる図形・消えるものがあるか）を規則へ渡して答える。フォルダの複合パスの値の変更と、効いている複合パスの照会も規則へ委ねる。
 */
import { ShapeFactory, SHAPE_TYPES } from './ShapeFactory.js';
import { ITEM_KIND, toItems, listItems, listShapeItems, listShapes, placeShapeItems, filterShapes } from './ItemTreeRules.js';
import { resolveItems, applyItemRename } from './ItemAttributeRules.js';
import { resolveNextInsertTarget, resolveRowInsertTarget, isSameInsertTarget } from './InsertTargetRules.js';
import { PLACE_KIND, insertItemsAt } from './ItemPlaceRules.js';
import { itemIdOf, isSameTree } from './GroupTreeRules.js';
import { resolveGroupCandidates, resolveSelectedGroupIds, resolveRevealIds, resolveSelectedUnitIds } from './GroupSelectionRules.js';
import { listVisibleShapes, listEditableShapes, collectEditableIds, applyItemStates } from './ItemStateRules.js';
import { resolveRemoval } from './RemovalRules.js';
import { setCompound, listCompoundPaths } from './CompoundPathRules.js';
import { setCollapsed, expandGroupsContaining } from './GroupCollapseRules.js';

/**
 * 新しく描く図形のスタイル（直前に使った値）。有無と色を分けて持つ
 * （「なし」にしても色の欄に直前の色を表示し、「あり」に戻すとその色が入るため）。
 * @typedef {Object} NewShapeStyle
 * @property {boolean} strokeEnabled 線を付けるか
 * @property {string} strokeColor 線の色（strokeEnabledが偽でも保持する）
 * @property {number} strokeWidth 線の太さ
 * @property {boolean} fillEnabled 塗りを付けるか
 * @property {string} fillColor 塗りの色（fillEnabledが偽でも保持する）
 */

/**
 * 図形のスタイルの書き換え1件。
 * @typedef {Object} ShapeStyleChange
 * @property {string} id 対象の図形のid
 * @property {{strokeColor?: (string|null), strokeWidth?: number, fillColor?: (string|null)}} style
 *   代入するスタイル（自身のプロパティとして持つキーだけを代入する）
 */

/**
 * 新しく描く図形の既定のスタイル（起動時の直前に使った値。凍結）。
 * 線の太さ2pxの定義の整理：
 * 1. 本定数の`strokeWidth`：新しく描く図形の既定の太さ（起動時の直前に使った値）の唯一の定義。
 * 2. 各図形クラス（`shapes/`）のコンストラクタの既定値`strokeWidth = 2`：引数を省略して生成したときの値。
 *    `startDraft`が生成直後に直前に使った値で上書きするため、新しく描く図形の太さを決めない。
 * 3. `shapes/ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`：読み込みで`strokeWidth`のキーが無いときの値。
 * 4. `io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`：書き出し形式を読む側の既定値（3.と同じ値であるべき）。
 * 既定のまま描いた図形のスタイルは、線あり`#000000`・2px・塗りなし（`fillColor: null`）。
 * `edit/StylePanelRules.js`の`RESET_COLORS_STYLE`（`D`キーの値。線あり黒・塗りあり白）とは色の値が重なるが別の定義
 * （塗りの有無が違い、`edit/`は本ファイルをimportしない）。片方を変えてももう片方は変わらない。
 * @type {Readonly<NewShapeStyle>}
 */
const DEFAULT_NEW_SHAPE_STYLE = Object.freeze({
    strokeEnabled: true,
    strokeColor: '#000000',
    strokeWidth: 2,
    fillEnabled: false,
    fillColor: '#ffffff',
});

/**
 * NewShapeStyleのキー（updateNewShapeStyleが受理するキー）。
 * @type {ReadonlyArray<string>}
 */
const NEW_SHAPE_STYLE_KEYS = Object.freeze(['strokeEnabled', 'strokeColor', 'strokeWidth', 'fillEnabled', 'fillColor']);

/**
 * 図形の共通プロパティのスタイル3つ（図形固有のプロパティではない）。
 * @type {ReadonlyArray<string>}
 */
const SHAPE_STYLE_KEYS = Object.freeze(['strokeColor', 'strokeWidth', 'fillColor']);

/**
 * 図形idの接頭辞。VectorModelが採番するidは `shape-<連番>`（例：'shape-1'）の形式とする。
 * id形式の知識は本ファイル内に閉じる（他モジュールはidを不透明な文字列として扱う）。
 * @type {string}
 */
const ID_PREFIX = 'shape-';

/**
 * フォルダidの接頭辞。VectorModelが採番するフォルダのidは `group-<連番>`（例：'group-2'）の形式とする。
 * 連番は図形idと同じカウンタ（#nextId）から取る。
 * @type {string}
 */
const GROUP_ID_PREFIX = 'group-';

/**
 * 採番形式（`shape-<連番>`・`group-<連番>`）のidに一致し、連番部分（10進数字列）を第1グループに取り出す正規表現。
 * replaceAllShapesでの#nextIdの繰り上げ（保持idの最大連番の算出）にのみ用いる。
 * @type {RegExp}
 */
const ID_PATTERN = new RegExp(`^(?:${ID_PREFIX}|${GROUP_ID_PREFIX})(\\d+)$`);

/**
 * 図形とフォルダのアイテムの入れ子の並び（`#items`だけが状態。平らな図形の配列は毎回求める）と、
 * 選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示の点を保持する単一の真実（SSOT）。
 * 状態を変更するAPIは変更後にonChangeの登録リスナーへ通知する。図形idの採番（`shape-<連番>`）・フォルダidの採番（`group-<連番>`。同じカウンタ）も本クラスが担う。
 * 名前・表示・ロックの規則（名前の変更`renameItem`を含む）は`ItemAttributeRules`、入れ子の計算は`ItemTreeRules`へ委譲する。
 * 図形の生成はShapeFactoryへ委譲する（復元は`DocumentSerializer`→`ShapeFactory.fromJSON`が行い、本クラスは復元済みの図形一式を受け取るのみ）。図形固有の頂点構造には依存しない（ポリモーフィック呼び出しのみ）。
 * フォルダの複合パスの値の変更（`setGroupCollapsed`と違い履歴の対象。記録は`CompoundPathEditor`が挟む）と、効いている複合パスの照会（`CompoundPathRules`へ委譲）も行う。
 * 新しく描く図形のスタイル（直前に使った値）も保持する（作業データ・履歴のスナップショットには含まれない）。
 * 選んでいるフォルダ（`#selectedGroupIds`。明示して選んだフォルダのidだけ。保存・履歴の比較・書き出しに入らず、不変条件は`GroupSelectionRules`）と、
 * フォルダの折りたたみ（フォルダのアイテムの`collapsed`。`setGroupCollapsed`・選択が変わったときの自動で開く。`onCollapsedChange`で通知）も扱う。
 * 描き込む先（`#insertTarget`。場所（`{ kind: 'above'|'inside'|'bottom', id }`）またはnull。新しい図形はその場所へ入る。保存せず、履歴の対象外）の唯一の持ち主でもある。
 * `#items`・選択集合・選んでいるフォルダ・描き込む先への代入は、コンストラクタと非公開メソッド`#applyState`だけが行い、描き込む先の決まり方は`InsertTargetRules`へ委譲する。
 * 図形の差し替えの入口として、既定では新しいidを採番する`replaceShape`・並びを変えない`replaceShapesKeepingIds`（複数・同じidのまま・通知1回）を持つ。
 * 図形のスタイルについては、共通プロパティの`strokeColor`・`strokeWidth`・`fillColor`の3つだけを書く（図形固有のプロパティ名は知らない）。
 */
export class VectorModel {
    /**
     * @type {Array<Object>} 保持しているアイテム（図形のアイテム・フォルダのアイテム）の入れ子の配列。唯一の状態
     * @private
     */
    #items;

    /**
     * @type {Array<Function>} 変更を通知するコールバック関数の配列
     * @private
     */
    #listeners;

    /**
     * @type {Set<string>} 選択集合：選択中の図形idの集合（0個以上）。常に現存図形のidのみを含む
     * @private
     */
    #selectedIds;

    /**
     * @type {Set<string>} 選んでいるフォルダのidの集合（明示して選んだものだけ。中のフォルダは自動では入れない）。
     * 常に`GroupSelectionRules.resolveSelectedGroupIds`の不変条件を満たす。保存・履歴の比較・書き出しに入れない。書き込みは`#applyState`だけが行う。
     * @private
     */
    #selectedGroupIds;

    /**
     * @type {Array<Function>} 折りたたみが変わったことを通知するコールバック関数の配列
     * @private
     */
    #collapsedListeners;

    /**
     * @type {boolean} `#applyState`・`setGroupCollapsed`で折りたたみが変わり、まだ`onCollapsedChange`へ通知していないか
     * @private
     */
    #collapsedChanged;

    /**
     * @type {{kind: string, id: (string|null)}|null} 描き込む先：次に入る図形の入る場所（`above`＝行のすぐ上・`inside`＝フォルダの中の一番上・`bottom`＝フォルダ（idがnullならいちばん外側）の一番下）。無ければnull（いちばん外側の末尾）。
     * 常に今ある行・フォルダを指すかnull。選んでいるまとまりが1つ以上あれば、その一番上のもの（図形は`above`・フォルダは`inside`）になる（`InsertTargetRules.resolveNextInsertTarget`）。
     * 保存せず、履歴の対象外。書き込みはコンストラクタと`#applyState`だけが行う。
     * @private
     */
    #insertTarget;

    /**
     * @type {string|null} ホバー中の図形のid
     * @private
     */
    #hoveredId;

    /**
     * @type {Object|null} 作成中（始点確定・終点未確定）の未コミット図形オブジェクト
     * （draw/setVertex等の共通インターフェースを持つ図形オブジェクト。ShapeFactory経由で生成される）。
     * 直線・曲線のツールで続けて引く線では、打った点＋付いてくる線の先を持つ（`replaceDraft`で組み立て直した図形に置き換わる）。
     * @private
     */
    #draftShape;

    /**
     * @type {{x1: number, y1: number, x2: number, y2: number}|null}
     * 範囲選択中の選択矩形。ワールド座標の対角2点（x1,y1=押下点、x2,y2=現在のカーソル位置）。
     * 正規化しない。描画用（範囲選択中でなければnull）
     * @private
     */
    #selectionRect;

    /**
     * @type {{x: number, y: number}|null}
     * 吸い付きの表示の点（ワールド座標の1点）。表示専用で保存しない（表示していなければnull）。
     * 設定と消去は`InputTracker`が行う。
     * @private
     */
    #snapPoint;

    /**
     * @type {boolean}
     * 吸い付きの表示の点が「吸い付くだけ」（ほかの図形の頂点への吸い付き。結合しない）か。偽は結合する吸い付き。
     * 表示専用で保存しない。表示していないときは偽。
     * @private
     */
    #snapPointVertex;

    /**
     * @type {Array<{shapeId: string, handle: string}>}
     * 頂点の選択（選んだ順）。表示専用で保存しない（作業データ・履歴・書き出しに入れない）。
     * 常に選択集合に含まれ、かつ変えられる図形の組だけを含む（#pruneSelectedVerticesで保つ）。
     * @private
     */
    #selectedVertices;

    /**
     * @type {number} 図形id採番用の連番カウンタ（次に#issueId()が発行する連番）。
     * #issueId()による採番（図形・フォルダ共通。commitDraft・replaceAllShapes・addShapesWithNewIds・replaceShape・rearrangeItems）で1ずつ増える。
     * 単調増加し、減らさない。replaceAllShapesでは、保持したidのうち採番形式（`shape-<連番>`・`group-<連番>`。
     * 連番がNumber.isSafeIntegerのもの）の最大連番をnとして max(現在値, n + 1) へ繰り上げる
     * （以後に発行するidが保持idと衝突しないため）。
     * @private
     */
    #nextId;

    /**
     * @type {NewShapeStyle} 新しく描く図形のスタイル（直前に使った値）。保存せず、履歴の対象外。
     * replaceAllShapesは触れない。
     * @private
     */
    #newShapeStyle;

    /**
     * 図形0個・選択なし・ホバーなし・作成中の図形なし・選択矩形なし・リスナーなし・
     * 新しく描く図形のスタイルは既定値（DEFAULT_NEW_SHAPE_STYLE）の状態で初期化する。
     */
    constructor() {
        this.#items = [];
        this.#listeners = [];
        this.#selectedIds = new Set();
        this.#selectedGroupIds = new Set();
        this.#collapsedListeners = [];
        this.#collapsedChanged = false;
        this.#insertTarget = null;
        this.#hoveredId = null;
        this.#draftShape = null;
        this.#selectionRect = null;
        this.#snapPoint = null;
        this.#snapPointVertex = false;
        this.#selectedVertices = [];
        this.#nextId = 1;
        this.#newShapeStyle = { ...DEFAULT_NEW_SHAPE_STYLE };
    }

    /**
     * 保持しているアイテムの入れ子を平らにした図形の配列（重なり順）。毎回求める（キャッシュしない）。
     * @returns {Array<Object>} 図形オブジェクトの新しい配列
     * @private
     */
    get #shapes() {
        return listShapes(this.#items);
    }

    /**
     * 新しい図形を追加し、変更を通知する。
     * 使わないこと（id採番を通らず`#items`の末尾へ追加するだけで、呼び出し元はない。図形の追加は`commitDraft`・`addShapesWithNewIds`を使う）。
     * 名前は`ItemAttributeRules.resolveItems`が付ける。
     * @param {Object} shape 追加する図形オブジェクト（drawメソッドを持つこと）
     */
    addShape(shape) {
        this.#applyState({ items: [...this.#items, ...resolveItems([shape], this.#items)] });
        this.#notifyChange();
    }

    /**
     * 現在保持しているアイテム（図形・フォルダ）の入れ子の写しを取得する。
     * 作業データへ入れ子ごと書き出すには`DocumentSerializer.serialize(model.getItems())`へ渡す。
     * @returns {Array<Object>} 新しいアイテムの入れ子（入れ子まで新しいオブジェクト。図形インスタンスは共有する）
     */
    getItems() {
        return toItems(this.#items);
    }

    /**
     * 現在保持している全図形の配列を取得する。
     * @returns {Array<Object>} 図形オブジェクトの配列（変更防止のためシャローコピーを返す）
     */
    getShapes() {
        return [...this.#shapes];
    }

    /**
     * 見えている（隠れていない）図形の配列を取得する。値は`#items`から毎回求める。ロックされた図形は含む。
     * @returns {Array<Object>} 図形オブジェクトの新しい配列（重なり順）
     */
    getVisibleShapes() {
        return listVisibleShapes(this.#items);
    }

    /**
     * 変えられる（隠れてもロックされてもいない）図形の配列を取得する。値は`#items`から毎回求める。
     * @returns {Array<Object>} 図形オブジェクトの新しい配列（重なり順）
     */
    getEditableShapes() {
        return listEditableShapes(this.#items);
    }

    /**
     * 選ばれている図形のうち変えられるものの配列を取得する。
     * @returns {Array<Object>} 図形オブジェクトの新しい配列（描画順）
     */
    getEditableSelectedShapes() {
        return this.getEditableShapes().filter((s) => this.#selectedIds.has(s.id));
    }

    /**
     * 選ばれている図形のうち変えられるもののidを取得する。
     * @returns {Array<string>} 図形idの新しい配列（描画順）
     */
    getEditableSelectedIds() {
        return this.getEditableSelectedShapes().map((s) => s.id);
    }

    /**
     * 選んでいるまとまりに、削除・切り取りで消えるものが1つ以上あるかを返す（`RemovalRules.resolveRemoval`が`null`でないか）。
     * @returns {boolean} 消えるものがあればtrue
     */
    hasRemovableSelection() {
        const unitIds = new Set(resolveSelectedUnitIds({
            items: this.#items,
            isSelected: (id) => this.#selectedIds.has(id),
            selectedGroupIds: this.#selectedGroupIds
        }));
        return resolveRemoval(this.#items, unitIds) !== null;
    }

    /**
     * アイテムの表示・ロックの値を変える唯一の公開操作。変わらなければ何もせず（通知もせず）falseを返す。
     * 変われば入れ子を差し替え、頂点の選択から変えられなくなった図形の組を落とし、変更を通知して（1回）trueを返す。
     * 選択・選んでいるフォルダ・描き込む先・作成途中の図形・折りたたみには触れない。履歴の記録はしない。
     * @param {Array<{id: string, visible?: boolean, locked?: boolean}>} changes 変更（真偽値でない値・無いidは無視）
     * @returns {boolean} 値が変わったか
     */
    setItemStates(changes) {
        const nextItems = applyItemStates(this.#items, changes);
        if (nextItems === this.#items) {
            return false;
        }
        this.#applyState({ items: nextItems });
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return true;
    }

    /**
     * 効いている複合パス（上のフォルダのどれも複合パスでないもの）を前順で返す照会。毎回`#items`から求める（キャッシュしない）。
     * @returns {Array<Object>} 効いている複合パス（`CompoundPathRules.listCompoundPaths`の結果）
     */
    getCompoundPaths() {
        return listCompoundPaths(this.#items);
    }

    /**
     * フォルダの複合パスの値を変える唯一の公開操作。変わらない（同じ値・無いid・図形のid）なら何もせず（通知もせず）falseを返す。
     * 変われば入れ子を差し替え、変更を通知して（1回）trueを返す。
     * 選択・選んでいるフォルダ・描き込む先・頂点の選択・ホバー・作成途中の図形・折りたたみ（`onCollapsedChange`）には触れない。
     * 履歴の記録はしない（記録は`CompoundPathEditor`が`beginEdit`・`commitEdit`で挟む）。
     * @param {string} id フォルダのid
     * @param {boolean} compound 複合パスにするならtrue、普通のフォルダへ戻すならfalse
     * @returns {boolean} 値が変わったか
     */
    setGroupCompound(id, compound) {
        const nextItems = setCompound(this.#items, id, compound);
        if (nextItems === this.#items) {
            return false;
        }
        this.#applyState({ items: nextItems });
        this.#notifyChange();
        return true;
    }

    /**
     * 選択集合を指定したidの集合で置き換え、変更を通知する（1回）。
     * 現存しない図形のidは除外する（選択集合は常に現存図形のidのみを含む）。
     * 頂点の選択から、選択中でなくなった図形の組を落とす（通知は増やさない）。
     * 単一選択は setSelection([id]) で表現する。
     * 選んでいるフォルダは`groupIds`で指定したものになる（省けば空。不変条件を通り、中の図形がすべて選ばれているものだけ残る）。
     * `keepsCollapsed`が偽なら、選択が変わったとき新しく選ばれた図形を含む閉じたフォルダを開く（`GroupSelectionRules.resolveRevealIds`。変わる前にあったフォルダだけ）。
     * 描き込む先は、結果の選択（図形・フォルダ）が1つ以上ならその一番上のまとまり（図形は行の上・フォルダはその中）になり、空になっても残る（利用者が外す操作は`setSelectionByUser`）。
     * @param {Iterable<string>} ids 新しい選択集合とする図形idの集合
     * @param {Object} [options] オプション
     * @param {Iterable<string>} [options.groupIds] 選ぶフォルダのid（省けば空）
     * @param {boolean} [options.keepsCollapsed=false] 真なら閉じたフォルダを開かない（一覧の選択・取り消し/やり直し）
     */
    setSelection(ids, { groupIds, keepsCollapsed = false } = {}) {
        const selectedIds = this.#filterExistingIds(ids);
        const candidateIds = resolveGroupCandidates({ currentIds: this.#selectedGroupIds, requestedIds: groupIds, additive: false });
        this.#applyState({
            selectedIds,
            selectedGroupIds: candidateIds,
            revealIds: keepsCollapsed ? [] : this.#resolveReveal({ items: this.#items, nextIds: selectedIds, candidateIds, additive: false }),
        });
        this.#pruneSelectedVertices();
        this.#notifyChange();
    }

    /**
     * 利用者が選ぶ・外す操作の入口。`setSelection`と同じく現存しないidを除き、頂点の選択から選択中でなくなった図形の組を落とす。
     * 選んでいるフォルダは、`groupIds`が渡されていればそれ、無ければ`additive`が真なら今の値、偽なら空になる（`GroupSelectionRules.resolveGroupCandidates`。不変条件を通る）。
     * 結果の図形の選択もフォルダの選択も空なら、描き込む先も無しにする（空にならなければ描き込む先は規則どおり選んでいる一番上のまとまり。図形なら行の上・フォルダならその中）。
     * 図形の選択・フォルダの選択が今も結果も空で、描き込む先も無いときだけ、何もせず（通知もせず）falseを返す。それ以外は変更を通知して（1回）trueを返す。
     * `keepsCollapsed`が偽なら、選択が変わったとき新しく選ばれた図形を含む閉じたフォルダを開く（`additive`が真なら新しく選ばれた図形だけ）。
     * @param {Iterable<string>} ids 新しい選択集合とする図形idの集合
     * @param {Object} [options] オプション
     * @param {Iterable<string>} [options.groupIds] 選ぶフォルダのid
     * @param {boolean} [options.additive=false] 足しただけ（`Ctrl`）か。`groupIds`が無いとき今のフォルダの選択を引き継ぐかを決める
     * @param {boolean} [options.keepsCollapsed=false] 真なら閉じたフォルダを開かない（一覧の選択）
     * @returns {boolean} 通知したか（状態を書き換えたか）
     */
    setSelectionByUser(ids, { groupIds, additive = false, keepsCollapsed = false } = {}) {
        const selectedIds = this.#filterExistingIds(ids);
        const candidateIds = resolveGroupCandidates({ currentIds: this.#selectedGroupIds, requestedIds: groupIds, additive });
        const nextGroupIds = resolveSelectedGroupIds({ previousItems: this.#items, items: this.#items, selectedIds, candidateIds });
        const isEmptyResult = selectedIds.size === 0 && nextGroupIds.size === 0;
        if (isEmptyResult && this.#selectedIds.size === 0 && this.#selectedGroupIds.size === 0 && this.#insertTarget === null) {
            return false;
        }
        const revealIds = keepsCollapsed ? [] : this.#resolveReveal({ items: this.#items, nextIds: selectedIds, candidateIds, additive });
        this.#applyState(isEmptyResult
            ? { selectedIds, selectedGroupIds: candidateIds, insertTarget: null, revealIds }
            : { selectedIds, selectedGroupIds: candidateIds, revealIds });
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return true;
    }

    /**
     * 選択集合を空にし、変更を通知する（1回）。頂点の選択も（選択中の図形が無くなるため）空になる。選んでいるフォルダも空になる。描き込む先は残る。
     */
    clearSelection() {
        this.#applyState({ selectedIds: new Set(), selectedGroupIds: new Set() });
        this.#pruneSelectedVertices();
        this.#notifyChange();
    }

    /**
     * 選んでいるフォルダのidを取得する（明示して選んだフォルダだけ）。
     * @returns {Array<string>} 選んでいるフォルダのidの新しい配列（前順。未選択時は空配列）
     */
    getSelectedGroupIds() {
        return listItems(this.#items)
            .filter((item) => item.kind === ITEM_KIND.GROUP && this.#selectedGroupIds.has(item.id))
            .map((item) => item.id);
    }

    /**
     * フォルダを閉じる・開く。変わらない（今と同じ折りたたみ・フォルダでないid・無いid）なら何も変えず（通知もせず）falseを返す。
     * 変われば変更を通知して（1回）`onCollapsedChange`のコールバックを1回呼び、trueを返す。
     * 選択・描き込む先・作成途中の図形には触れない。履歴の記録はしない（折りたたみは取り消しの対象外）。
     * @param {string} id フォルダのid
     * @param {boolean} collapsed 閉じるならtrue、開くならfalse
     * @returns {boolean} 折りたたみが変わったか
     */
    setGroupCollapsed(id, collapsed) {
        const nextItems = setCollapsed(this.#items, id, collapsed);
        if (nextItems === this.#items) {
            return false;
        }
        this.#applyState({ items: nextItems });
        this.#collapsedChanged = true;
        this.#notifyChange();
        return true;
    }

    /**
     * 描き込む先（新しい図形の入る場所）を取得する。製品コードはこちらを使う。
     * @returns {{kind: string, id: (string|null)}|null} 描き込む先の写し。無ければnull（いちばん外側の末尾へ入る）
     */
    getInsertTarget() {
        return this.#insertTarget === null ? null : { ...this.#insertTarget };
    }

    /**
     * 描き込む先が`above`（行のすぐ上）のときの行のidを取得する。ほかの形・無しはnull（値は`#insertTarget`から毎回求める）。
     * @returns {string|null} `above`のときの行のid。それ以外はnull
     */
    getInsertTargetId() {
        const target = this.#insertTarget;
        return target !== null && target.kind === PLACE_KIND.ABOVE ? target.id : null;
    }

    /**
     * 描き込む先を、今ある行へ変える（図形なら行の上・フォルダならその中）。今あるアイテムのidでなければ何もしない（通知もしない）。
     * 規則（`InsertTargetRules`）を通した結果、描き込む先が変わったときだけ変更を通知する（1回。選んでいるまとまりが1つ以上あれば規則により変わらない）。
     * 図形・選択・作成中の図形・履歴には触れない。
     * @param {string} id 描き込む先にする行（図形またはフォルダ）のid
     * @returns {boolean} 描き込む先が変わったか
     */
    setInsertTarget(id) {
        const target = resolveRowInsertTarget(this.#items, id);
        if (target === null) {
            return false;
        }
        const previous = this.#insertTarget;
        this.#applyState({ insertTarget: target });
        if (isSameInsertTarget(previous, this.#insertTarget)) {
            return false;
        }
        this.#notifyChange();
        return true;
    }

    /**
     * 選択集合の図形idを取得する。
     * @returns {Array<string>} 選択中の図形idの新しい配列（#shapesの並び順＝描画順。未選択時は空配列）
     */
    getSelectedIds() {
        return this.#shapes
            .filter((s) => this.#selectedIds.has(s.id))
            .map((s) => s.id);
    }

    /**
     * 指定したidの図形が選択集合に含まれるかを判定する。
     * @param {string} id 判定する図形のid
     * @returns {boolean} 選択集合に含まれる場合true
     */
    isSelected(id) {
        return this.#selectedIds.has(id);
    }

    /**
     * 頂点の選択を、指定した「図形のid＋ハンドル名」の組の配列で置き換える。
     * 受理するのは、`shapeId`が現在の選択集合に含まれ、かつ変えられる図形で、かつ`handle`が空でない文字列の組だけ（与えられた順。同じ組の重複は除く）。
     * 要素は新しいオブジェクトとして持つ（引数のオブジェクトを保持せず、書き換えない）。
     * 内容（組と順）が変わったときだけ変更を通知する（1回）。
     * @param {Array<{shapeId: string, handle: string}>} pairs 新しい頂点の選択
     */
    setSelectedVertices(pairs) {
        const next = [];
        const editableIds = collectEditableIds(this.#items);
        for (const pair of pairs) {
            if (!pair || typeof pair.handle !== 'string' || pair.handle === '' || !this.#selectedIds.has(pair.shapeId) || !editableIds.has(pair.shapeId)) {
                continue;
            }
            if (next.some((p) => p.shapeId === pair.shapeId && p.handle === pair.handle)) {
                continue;
            }
            next.push({ shapeId: pair.shapeId, handle: pair.handle });
        }
        const unchanged = next.length === this.#selectedVertices.length
            && next.every((p, i) => p.shapeId === this.#selectedVertices[i].shapeId && p.handle === this.#selectedVertices[i].handle);
        if (unchanged) {
            return;
        }
        this.#selectedVertices = next;
        this.#notifyChange();
    }

    /**
     * 頂点の選択を全解除する。1つ以上あったときだけ変更を通知する（1回）。
     */
    clearSelectedVertices() {
        if (this.#selectedVertices.length === 0) {
            return;
        }
        this.#selectedVertices = [];
        this.#notifyChange();
    }

    /**
     * 頂点の選択を取得する。
     * @returns {Array<{shapeId: string, handle: string}>} 新しい配列・新しいオブジェクトのコピー（選んだ順。未選択時は空配列）
     */
    getSelectedVertices() {
        return this.#selectedVertices.map((p) => ({ shapeId: p.shapeId, handle: p.handle }));
    }

    /**
     * 指定した頂点が選ばれているかを判定する。
     * @param {string} shapeId 図形のid
     * @param {string} handle ハンドル名
     * @returns {boolean} 頂点の選択に含まれる場合true
     */
    isVertexSelected(shapeId, handle) {
        return this.#selectedVertices.some((p) => p.shapeId === shapeId && p.handle === handle);
    }

    /**
     * 指定したidの図形をホバー状態にし、変更を通知する。
     * @param {string} id ホバー中の図形のid
     */
    setHovered(id) {
        this.#hoveredId = id;
        this.#notifyChange();
    }

    /**
     * ホバー状態を解除し、変更を通知する。
     */
    clearHovered() {
        this.#hoveredId = null;
        this.#notifyChange();
    }

    /**
     * 現在ホバー中の図形のidを取得する。
     * @returns {string|null} ホバー中の図形のid（非ホバー時はnull）
     */
    getHoveredId() {
        return this.#hoveredId;
    }

    /**
     * 選択矩形を設定し、変更を通知する（1回）。座標は正規化せずそのまま保持する。
     * @param {number} x1 押下点のX座標（ワールド座標）
     * @param {number} y1 押下点のY座標（ワールド座標）
     * @param {number} x2 現在のカーソル位置のX座標（ワールド座標）
     * @param {number} y2 現在のカーソル位置のY座標（ワールド座標）
     */
    setSelectionRect(x1, y1, x2, y2) {
        this.#selectionRect = { x1, y1, x2, y2 };
        this.#notifyChange();
    }

    /**
     * 選択矩形を破棄する。選択矩形が存在した場合のみ変更を通知する。
     */
    clearSelectionRect() {
        if (this.#selectionRect === null) {
            return;
        }
        this.#selectionRect = null;
        this.#notifyChange();
    }

    /**
     * 選択矩形を取得する。
     * @returns {{x1: number, y1: number, x2: number, y2: number}|null}
     * 選択矩形のコピー（ワールド座標の対角2点。正規化されていない）、存在しない場合はnull
     */
    getSelectionRect() {
        return this.#selectionRect ? { ...this.#selectionRect } : null;
    }

    /**
     * 吸い付きの表示の点を設定し、値が変わったときだけ変更を通知する（1回）。
     * 現在の点と座標も「吸い付くだけか」の別も同じなら何もしない（mousemoveごとの無駄な再描画を避ける）。
     * @param {number} x 点のX座標（ワールド座標）
     * @param {number} y 点のY座標（ワールド座標）
     * @param {boolean} [vertex=false] 真なら吸い付くだけ（ほかの図形の頂点への吸い付き。結合しない）の表示、偽・省略は結合する吸い付きの表示
     */
    setSnapPoint(x, y, vertex = false) {
        const isVertex = vertex === true;
        if (this.#snapPoint !== null && this.#snapPoint.x === x && this.#snapPoint.y === y && this.#snapPointVertex === isVertex) {
            return;
        }
        this.#snapPoint = { x, y };
        this.#snapPointVertex = isVertex;
        this.#notifyChange();
    }

    /**
     * 吸い付きの表示の点（と「吸い付くだけか」の別）を消去する。表示中だった場合のみ変更を通知する（1回）。
     */
    clearSnapPoint() {
        if (this.#snapPoint === null) {
            return;
        }
        this.#snapPoint = null;
        this.#snapPointVertex = false;
        this.#notifyChange();
    }

    /**
     * 吸い付きの表示の点を取得する（「吸い付くだけか」の別は含まない。別は`isSnapPointVertex`で問い合わせる）。
     * @returns {{x: number, y: number}|null} 点のコピー（ワールド座標）、表示していない場合はnull
     */
    getSnapPoint() {
        return this.#snapPoint ? { ...this.#snapPoint } : null;
    }

    /**
     * 表示中の吸い付きの表示の点が「吸い付くだけ」（ほかの図形の頂点への吸い付き。結合しない）かを返す。
     * @returns {boolean} 表示中で吸い付くだけなら真。表示していない・結合する吸い付きなら偽
     */
    isSnapPointVertex() {
        return this.#snapPoint !== null && this.#snapPointVertex;
    }

    /**
     * 始点を確定し、始点・終点が同一座標の仮図形を作成中データとして生成する。
     * 生成した時点ではidを持たず、#shapesにも登録しない（コミットはcommitDraftで行う）。
     * 生成直後に、直前に使った値（新しく描く図形のスタイル）を作成中の図形へ当てる（ShapeFactory.createの呼び方は変えない）。
     * 作成中の図形を作る・置き換えるのは、このメソッドと`replaceDraft`だけである。
     * @param {number} x 始点のX座標（ワールド座標）
     * @param {number} y 始点のY座標（ワールド座標）
     * @param {string} [type=SHAPE_TYPES[0]] 生成する図形の種別（SHAPE_TYPESのいずれか。ShapeFactory.createへ渡される）
     */
    startDraft(x, y, type = SHAPE_TYPES[0]) {
        const draft = ShapeFactory.create(type, x, y, x, y);
        this.#assignShapeStyle(draft, this.#toShapeStyle());
        this.#draftShape = draft;
        this.#notifyChange();
    }

    /**
     * 新しく描く図形のスタイル（直前に使った値）のコピーを取得する。
     * @returns {NewShapeStyle} 直前に使った値のコピー
     */
    getNewShapeStyle() {
        return { ...this.#newShapeStyle };
    }

    /**
     * 新しく描く図形のスタイル（直前に使った値）を部分的に更新する。
     * `patch`のうちNewShapeStyleの5つのキー（自身のプロパティとして持つもの）だけを上書きし、他のキーは無視する。
     * 値の検証はしない（呼び出し側の責務）。値が1つでも変わった場合のみ、作成中の図形があればそのスタイルも
     * 新しい値にしたうえで、変更を通知する（1回）。選択集合・ホバー・図形一式には触れない。
     * @param {Partial<NewShapeStyle>} patch 上書きする項目
     * @returns {boolean} 値が変わったか
     */
    updateNewShapeStyle(patch) {
        let changed = false;
        for (const key of NEW_SHAPE_STYLE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(patch, key) && this.#newShapeStyle[key] !== patch[key]) {
                this.#newShapeStyle[key] = patch[key];
                changed = true;
            }
        }
        if (!changed) {
            return false;
        }
        if (this.#draftShape) {
            this.#assignShapeStyle(this.#draftShape, this.#toShapeStyle());
        }
        this.#notifyChange();
        return true;
    }

    /**
     * 指定した図形のスタイルを書き換える。各idの図形へ、`style`が自身のプロパティとして持つ
     * `strokeColor`・`strokeWidth`・`fillColor`だけを代入する（他のキーは無視。値の検証はしない）。
     * 存在しないidは無視する。1件以上の図形に代入した場合のみ変更を通知する（1回）。
     * 選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示の点・直前に使った値には触れない。
     * @param {Array<ShapeStyleChange>} changes 書き換えの配列
     * @returns {number} 代入した図形の数
     */
    updateShapeStyles(changes) {
        let count = 0;
        const shapes = this.#shapes;
        for (const change of changes) {
            const shape = shapes.find((s) => s.id === change.id);
            if (!shape) {
                continue;
            }
            this.#assignShapeStyle(shape, change.style);
            count++;
        }
        if (count > 0) {
            this.#notifyChange();
        }
        return count;
    }

    /**
     * 作成中の図形の終点をカーソル位置に追従させる。作成中の図形が存在しない場合は何もしない。
     * 追従処理自体はshape.updateDraftEnd(x, y)へポリモーフィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。
     * @param {number} x 終点のX座標（ワールド座標）
     * @param {number} y 終点のY座標（ワールド座標）
     */
    updateDraft(x, y) {
        if (!this.#draftShape) {
            return;
        }
        this.#draftShape.updateDraftEnd(x, y);
        this.#notifyChange();
    }

    /**
     * 作成中の図形に一意なidを採番（#issueId()。`shape-<連番>`）して#itemsの末尾（いちばん外側）へ確定登録し、作成中データを破棄する。
     * 名前・表示・ロックは`ItemAttributeRules.resolveItems`が決める（名前は確定した図形の種別の呼び名＋番号）。
     * `atInsertTarget`が真で描き込む先があれば、末尾ではなく描き込む先の場所（行のすぐ上・フォルダの中の一番上・一番下）へ入れる（位置は、この呼び出しで描き込む先を書き換える前の値で決める）。
     * 確定した図形のすぐ上が新しい描き込む先になる（選んでいるまとまりが1つ以上ある場合は規則によりその一番上のまとまり）。
     * 作成中の図形が存在しない場合は何もしない。
     * @param {Object} [options] オプション
     * @param {boolean} [options.atInsertTarget=false] 真なら描き込む先の場所へ入れる。偽（既定）なら末尾（いちばん外側）
     */
    commitDraft({ atInsertTarget = false } = {}) {
        if (!this.#draftShape) {
            return;
        }
        const draft = this.#draftShape;
        draft.id = this.#issueId();
        const addedItems = resolveItems([draft], this.#items);
        this.#applyState({
            items: this.#placeAdded(addedItems, atInsertTarget ? this.#insertTarget : null),
            insertTarget: { kind: PLACE_KIND.ABOVE, id: draft.id },
        });
        this.#draftShape = null;
        this.#notifyChange();
    }

    /**
     * 作成中の図形を確定せずに破棄する（作成中断用）。作成中の図形が存在しない場合は何もしない。
     */
    cancelDraft() {
        if (!this.#draftShape) {
            return;
        }
        this.#draftShape = null;
        this.#notifyChange();
    }

    /**
     * 作成中の図形を、渡された図形に置き換える（直線・曲線のツールで続けて引く線の、点を打つ・最後の点を消す・
     * 終えた線の組み立て直しで、edit/EndpointSnapperが呼ぶ）。
     * (1)作成中の図形が無ければ、何もせず（通知もせず）falseを返す。
     * (2)`shape`のインスタンスが#shapesに含まれていれば、console.warnのうえ何もせずfalseを返す（`replaceShape`と同じ防御）。
     * (3)`shape.id`をnull（作成中の図形はidを持たない）にし、直前に使った値（新しく描く図形のスタイル）を当てる
     *    （`startDraft`と同じ）。`shape`を作成中の図形として保持する。#shapesには入れない。
     * (4)変更を通知して（1回）trueを返す。
     * 選択集合・頂点の選択・ホバー・選択矩形・吸い付きの表示の点・直前に使った値・idの採番には触れない。
     * 図形の種別・頂点を関知しない。受け取ったインスタンスをそのまま保持して書き換えるため、
     * 呼び出し側は以後そのインスタンスを他の用途に流用しないこと。
     * @param {Object} shape 新しい作成中の図形（共通インターフェースを持つ図形オブジェクト）
     * @returns {boolean} 置き換えたか
     */
    replaceDraft(shape) {
        if (!this.#draftShape) {
            return false;
        }
        if (this.#shapes.includes(shape)) {
            console.warn('VectorModel.replaceDraft: 既に追加済みの図形インスタンスのため置き換えません。', shape);
            return false;
        }
        shape.id = null;
        this.#assignShapeStyle(shape, this.#toShapeStyle());
        this.#draftShape = shape;
        this.#notifyChange();
        return true;
    }

    /**
     * 作成中（未コミット）の図形オブジェクトを取得する。
     * @returns {Object|null} 作成中の図形オブジェクト（存在しない場合はnull）
     */
    getDraftShape() {
        return this.#draftShape;
    }

    /**
     * 指定したidの図形の、指定した頂点インデックスの座標を絶対座標で更新する。
     * 実処理は updateVertices へ委譲する（shape.setVertexを呼ぶ箇所はupdateVerticesの1か所のみ）。
     * 該当図形が存在しない場合は何もしない（通知もしない）。
     * @param {string} id 対象図形のid（単一）
     * @param {number} vertexIndex 更新する頂点のインデックス（各図形のgetVertexIndexForHandleの規約に従う頂点インデックス）
     * @param {number} x 更新後のX座標（ワールド座標）
     * @param {number} y 更新後のY座標（ワールド座標）
     */
    updateVertex(id, vertexIndex, x, y) {
        this.updateVertices([{ id, vertexIndex, x, y }]);
    }

    /**
     * 複数の頂点の座標を絶対座標でまとめて更新する。各組を配列の順にshape.setVertex(vertexIndex, x, y)へ
     * ポリモーフィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。頂点インデックスと図形固有プロパティとの
     * 対応関係は関知しない。存在しないidの組は無視する。1件以上更新した場合のみ変更を通知する（1回。組の数分は発行しない）。
     * 空の配列では何もしない。引数の配列・要素は書き換えない。
     * @param {Array<{ id: string, vertexIndex: number, x: number, y: number }>} updates 更新する頂点の組（ワールド座標の絶対値）
     */
    updateVertices(updates) {
        let updated = false;
        const shapes = this.#shapes;
        for (const { id, vertexIndex, x, y } of updates) {
            const shape = shapes.find((s) => s.id === id);
            if (!shape) {
                continue;
            }
            shape.setVertex(vertexIndex, x, y);
            updated = true;
        }

        if (updated) {
            this.#notifyChange();
        }
    }

    /**
     * 指定したidの集合に含まれる全図形を、相対差分(dx, dy)だけ平行移動する。
     * 移動処理自体はshape.translate(dx, dy)へポリモーフィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。
     * 存在しないidは無視する。1件以上移動した場合のみ変更を通知する（1回。図形数分は発行しない）。
     * @param {Iterable<string>} ids 移動する図形idの集合
     * @param {number} dx X方向の移動差分（ワールド座標）
     * @param {number} dy Y方向の移動差分（ワールド座標）
     */
    moveShapes(ids, dx, dy) {
        const targetIds = new Set(ids);
        let moved = false;
        for (const shape of this.#shapes) {
            if (targetIds.has(shape.id)) {
                shape.translate(dx, dy);
                moved = true;
            }
        }

        if (moved) {
            this.#notifyChange();
        }
    }

    /**
     * 図形ごとに違う相対差分(dx, dy)で、複数の図形をまとめて平行移動する（用途：整列・分布）。
     * moveShapes は指定した図形すべてを同じ量だけ動かすのに対し、moveShapesBy は図形ごとに違う量で動かす。
     * updateVertices が頂点の絶対座標の更新であるのに対し、moveShapesBy は図形の相対移動である。
     * 各組を配列の順にshape.translate(dx, dy)へポリモーフィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。
     * 同じidが複数回現れた場合は配列の順にそれぞれ当てる。存在しないidの組は無視する。
     * 1件以上移動した場合のみ変更を通知する（1回。組の数分は発行しない）。空の配列では何もしない。
     * 引数の配列・要素は書き換えない。選択集合・ホバー・頂点の選択・並びには触れない。
     * @param {Array<{ id: string, dx: number, dy: number }>} moves 移動する図形idと移動量の組（ワールド座標の差分）
     */
    moveShapesBy(moves) {
        let moved = false;
        const shapes = this.#shapes;
        for (const { id, dx, dy } of moves) {
            const shape = shapes.find((s) => s.id === id);
            if (!shape) {
                continue;
            }
            shape.translate(dx, dy);
            moved = true;
        }

        if (moved) {
            this.#notifyChange();
        }
    }

    /**
     * 指定したidの集合に含まれる全図形を#itemsから除去する（フォルダは中身が空になっても残す。フォルダのidが渡されても無視する）。
     * 除去した図形のidは選択集合・ホバー状態・頂点の選択（その図形の組）からも除去する（存在しない図形のidが残留することを防ぐため）。
     * 描き込む先の図形を除去したときは、下の行（前の並びで近い、残っている図形）へ付け替える（無ければ無し）。
     * 存在しないidは無視する。1件以上削除した場合のみ変更を通知する（1回。図形数分は発行しない）。
     * フォルダごとの削除（フォルダと中身をまとめて取り除く操作）は、このメソッドではなく`rearrangeItems`で行う。
     * @param {Iterable<string>} ids 削除する図形idの集合
     */
    deleteShapes(ids) {
        const targetIds = new Set(ids);
        const removedIds = this.#shapes
            .filter((s) => targetIds.has(s.id))
            .map((s) => s.id);
        if (removedIds.length === 0) {
            return;
        }
        this.#applyState({
            items: filterShapes(this.#items, (s) => !targetIds.has(s.id)),
            selectedIds: new Set([...this.#selectedIds].filter((id) => !removedIds.includes(id))),
        });
        if (this.#hoveredId !== null && removedIds.includes(this.#hoveredId)) {
            this.#hoveredId = null;
        }
        this.#pruneSelectedVertices();

        this.#notifyChange();
    }

    /**
     * 保持している全アイテムを、指定したアイテム（または素の図形）の配列で一括して入れ替える（用途：`?dev`の復元・取り消し/やり直し・キャンバスの切り替え）。以下の順に処理する。
     * (1)`resolveItems(values)`で新しいアイテムの入れ子を作る（引数の配列・アイテムは流用せず書き換えない。図形インスタンスは受け取ったものを保持する。
     *    素の図形は名前の無い図形のアイテムとして扱われ自動の名前が付く。名前・フォルダを保つには`getItems()`や`deserialize`の`items`を渡す）。
     * (2)idの正規化：前順（フォルダ → その中身）に、図形（`item.shape.id`）とフォルダ（`item.id`）のidを合わせて、
     *    空でない文字列で、それまでに出現していなければそのまま保持する（保持id）。
     *    それ以外（欠落・文字列でない・空文字・重複の後出し）は振り直し対象とする（重複時は後に出現した方を振り直す）。
     * (3)保持idのうち採番形式（`shape-<連番>`・`group-<連番>`。連番がNumber.isSafeIntegerのもの）の最大連番をnとし、
     *    #nextIdを max(現在値, n + 1) へ繰り上げる（減らさない）。
     * (4)振り直し対象に#issueId()で新しいidを採番する（図形は`shape-`、フォルダは`group-`。(3)により保持idとは衝突しない）。
     * (5)選択集合・選んでいるフォルダ・頂点の選択・ホバー状態・作成中の図形・選択矩形・吸い付きの表示の点をクリアする。
     * (6)変更を通知する（1回のみ）。
     * 描き込む先は、`keepInsertTarget`が偽（既定）なら無しにし、真なら今の値を規則（`InsertTargetRules`）に通して残す（取り消し/やり直しの復元用）。
     * 新しく描く図形のスタイル（直前に使った値）には触れない。
     * 進行中の入力操作（ドラッグ・作成途中の図形）の中断は呼び出し側の責務（`InputTracker.abortOngoingOperation()`、または`CanvasLibrary`では`prepareSwitch()`経由の`setMode`）。
     * 受け取った図形インスタンスの`id`を直接書き換える。idの重複判定は値で行うため、同一インスタンスを配列に重複して渡さない（既存インスタンスを渡す場合は呼び出し側で複製する）。
     * @param {Array<Object>} values 新しいアイテムの入れ子（描画順）。アイテムまたは素の図形インスタンス（共通インターフェースを持つ）の配列
     * @param {Object} [options] オプション
     * @param {boolean} [options.keepInsertTarget=false] 真なら描き込む先を今の値から規則で引き継ぐ。偽なら無しにする
     * @returns {number} idを振り直した図形とフォルダの合計件数
     */
    replaceAllShapes(values, { keepInsertTarget = false } = {}) {
        const nextItems = resolveItems(values);

        const keptIds = new Set();
        const reassignTargets = [];
        let maxSerial = 0;
        for (const item of listItems(nextItems)) {
            const id = item.kind === ITEM_KIND.GROUP ? item.id : item.shape.id;
            if (typeof id !== 'string' || id === '' || keptIds.has(id)) {
                reassignTargets.push(item);
                continue;
            }
            keptIds.add(id);

            const match = ID_PATTERN.exec(id);
            if (match) {
                const serial = Number(match[1]);
                if (Number.isSafeInteger(serial) && serial > maxSerial) {
                    maxSerial = serial;
                }
            }
        }

        this.#nextId = Math.max(this.#nextId, maxSerial + 1);
        for (const item of reassignTargets) {
            if (item.kind === ITEM_KIND.GROUP) {
                item.id = this.#issueId(GROUP_ID_PREFIX);
            } else {
                item.shape.id = this.#issueId();
            }
        }

        this.#applyState({
            items: nextItems,
            selectedIds: new Set(),
            selectedGroupIds: new Set(),
            insertTarget: keepInsertTarget ? this.#insertTarget : null,
        });
        this.#pruneSelectedVertices();
        this.#hoveredId = null;
        this.#draftShape = null;
        this.#selectionRect = null;
        this.#snapPoint = null;
        this.#snapPointVertex = false;

        this.#notifyChange();
        return reassignTargets.length;
    }

    /**
     * 指定したアイテム（または素の図形）を、新しいidを採番したうえで#itemsの末尾（いちばん外側。`atInsertTarget`が真で描き込む先があれば、その場所）へ引数の順に追加し、
     * 追加した図形だけを選択する（貼り付け・複製・インポート等で図形を追加する場合の公開操作）。
     * (1)idの上書き：追加する各図形の`id`・各フォルダの`id`を常に#issueId()で発行した新しいid（図形は`shape-`、フォルダは`group-`）で上書きする
     *    （引数のidは引き継がない）。#nextIdは単調増加で減らさないため、キャンバス上の既存のidとも、過去に発行したidとも衝突しない。
     * (2)重複インスタンスの除外：引数内で2回目以降に現れる図形インスタンス、および既に保持している図形インスタンスは、
     *    同じidを持つ2要素を作らないためconsole.warnのうえ追加しない（判定はインスタンス参照で行う）。フォルダは空になっても残す。
     * (3)`asUnits`が偽（既定）：図形が1つも残らなければ（フォルダだけの場合を含む）何も変えず（通知もせず）空配列を返す。
     *    `asUnits`が真：アイテムが1つも残らなければ何も変えず空配列を返す（フォルダだけ・空のフォルダだけでも入れる）。
     * (4)名前・表示・ロックは`resolveItems`が決める（名前のあるアイテムはそのまま。名前の無い図形・フォルダには今のキャンバスの名前と重ならない自動の名前が付く）。
     * (5)選択集合を、追加した図形のidの集合で置き換える（追加した図形だけが選択される。選んでいるフォルダは、`asUnits`が偽なら空になり、真なら入れた並びのいちばん外側のフォルダ（不変条件を満たすもの）になる。追加した図形を含む、変わる前にあった閉じたフォルダは開く。描き込む先は規則（`InsertTargetRules`）により、選んでいるまとまりの一番上のもので決まる：`asUnits`が偽なら追加した図形の一番上のすぐ上、`asUnits`が真で一番上が図形ならその図形のすぐ上、フォルダならそのフォルダの中（一番上）になる）。
     *    頂点の選択から、選択中でなくなった図形の組を落とす。ホバー状態・作成中の図形・選択矩形には触れない。
     * (6)変更を通知する（1回。図形数分は発行しない）。
     * 受け取った図形インスタンスをそのまま保持して`id`を書き換えるため、呼び出し側は追加後にそのインスタンスを他の用途に流用しない。
     * 図形インスタンスには`id`の代入以外で触れない（頂点・図形固有のプロパティ・図形種別を関知しない）。
     * 前提：呼び出し側が選択モードまたは頂点の選択モードであることを保証すること（選択集合は選択モード・頂点の選択モード以外では常に空という不変条件を守るため）。
     * @param {Array<Object>} values 追加するアイテムの入れ子（描画順）。アイテムまたは素の図形インスタンス（共通インターフェースを持つ）の配列
     * @param {Object} [options] オプション
     * @param {boolean} [options.atInsertTarget=false] 真なら描き込む先の場所（行のすぐ上・フォルダの中の一番上・一番下）へ入れる。偽（既定）・描き込む先なしなら末尾（いちばん外側）。位置は書き換える前の描き込む先で決める
     * @param {{kind: string, id: (string|null)}|null} [options.place=null] 入れる場所（場所の値）。指定があれば`atInsertTarget`より優先する。省く（null）と`atInsertTarget`に従う
     * @param {boolean} [options.asUnits=false] 真ならフォルダごとのまとまりとして入れる（フォルダだけでも入れ、入れたいちばん外側のフォルダを選んでいる状態にする）
     * @returns {Array<string>} 追加した図形の新しいidの配列（描画順。フォルダのidは含まない。追加0件なら空配列）
     */
    addShapesWithNewIds(values, { atInsertTarget = false, place = null, asUnits = false } = {}) {
        const existingShapes = new Set(this.#shapes);
        const processedShapes = new Set();
        const accepted = filterShapes(toItems(values), (shape) => {
            if (existingShapes.has(shape) || processedShapes.has(shape)) {
                console.warn('VectorModel.addShapesWithNewIds: 既に追加済みの図形インスタンスのため追加しません。', shape);
                return false;
            }
            processedShapes.add(shape);
            return true;
        });

        if (asUnits ? accepted.length === 0 : listShapeItems(accepted).length === 0) {
            return [];
        }

        const addedItems = resolveItems(accepted, this.#items);
        const addedIds = [];
        for (const item of listItems(addedItems)) {
            if (item.kind === ITEM_KIND.GROUP) {
                item.id = this.#issueId(GROUP_ID_PREFIX);
            } else {
                item.shape.id = this.#issueId();
                addedIds.push(item.shape.id);
            }
        }
        this.#applyState({
            items: this.#placeAdded(addedItems, place ?? (atInsertTarget ? this.#insertTarget : null)),
            selectedIds: new Set(addedIds),
            selectedGroupIds: asUnits
                ? new Set(addedItems.filter((item) => item.kind === ITEM_KIND.GROUP).map(itemIdOf))
                : new Set(),
            revealIds: addedIds,
        });
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return addedIds;
    }

    /**
     * 指定idの図形の位置へ新しい図形を入れ、指定idの図形を除き、結果の図形だけを選択する（`select`が偽なら選択を作らない。結合等の公開操作）。
     * (1)`targetId`の図形の位置を平らにした図形の並びから探す。無ければ何もせず（通知もせず）nullを返す。
     * (2)`shape`のインスタンスが既に#shapesに含まれていれば、同じidの2要素を作らないためconsole.warnのうえ何もせずnullを返す。
     * (3)`shape.id`を、`keepId`が真なら`targetId`、偽なら#issueId()で発行した新しいidにする。
     * (4)`targetId`の位置の図形のアイテムの`shape`だけを`shape`に置き換え（名前・表示・ロック・所属は位置のまま引き継ぐ）、
     *    `removeIds`に含まれるidの図形を除く（別のフォルダの中の図形でも除く。フォルダは空になっても残す。
     *    `targetId`自身が含まれていても置き換えた位置は除かない。存在しないidは無視。他の図形の前後関係は変えない）。
     * (5)`select`が真なら選択集合を`shape.id`だけにする（選んでいるフォルダは、`keepId`が偽なら空、真なら今の値から不変条件で残るもの。
     *    選択が変わったときは、`shape`を含む変わる前にあった閉じたフォルダを開く）。偽なら選択集合を新しく作らず、現存しなくなったid
     *    （置き換えで消えた元のid・除いた図形のid）だけを選択集合から外す（作成モードでは空のまま）。
     *    頂点の選択から、選択中でなくなった図形の組を落とす。
     *    ホバー中のidが現存しなくなればホバーを解除する。作成中の図形・選択矩形には触れない。
     *    描き込む先は、`select`が偽で置き換えた後の選択集合が空なら結果の図形のすぐ上になる（線を引くツールでの描き足し・結合・閉じる）。それ以外は規則（`InsertTargetRules`）に任せる。
     * (6)変更を通知する（1回）。
     * 受け取ったインスタンスをそのまま保持して`id`を書き換えるため、呼び出し側は以後そのインスタンスを他の用途に流用しない。
     * 図形インスタンスには`id`の代入以外で触れない（頂点・図形固有のプロパティ・図形種別を関知しない）。
     * 前提：`select`が真のときは、呼び出し側が選択モードまたは頂点の選択モードであることを保証すること（選択集合は選択モード・頂点の選択モード以外では常に空という不変条件を守るため）。
     *       作成モードでは`select: false`で呼ぶ。
     * @param {string} targetId 置き換える位置の図形のid
     * @param {Object} shape 入れる図形（共通インターフェースを持つ図形インスタンス）
     * @param {Object} [options] オプション
     * @param {boolean} [options.keepId=false] 真なら`shape`が`targetId`を引き継ぐ。偽なら新しいidを採番する
     * @param {Array<string>} [options.removeIds=[]] 除く図形のidの配列
     * @param {boolean} [options.select=true] 真なら結果の図形だけを選択する。偽なら選択集合を作り直さず、現存しないidだけ外す
     * @returns {string|null} 入れた図形のid。置き換えなかった場合はnull
     */
    replaceShape(targetId, shape, { keepId = false, removeIds = [], select = true } = {}) {
        const targetIndex = this.#shapes.findIndex((s) => s.id === targetId);
        if (targetIndex === -1) {
            return null;
        }
        if (this.#shapes.includes(shape)) {
            console.warn('VectorModel.replaceShape: 既に追加済みの図形インスタンスのため置き換えません。', shape);
            return null;
        }

        shape.id = keepId ? targetId : this.#issueId();
        const removeSet = new Set(removeIds);
        const shapeItems = listShapeItems(this.#items);
        const targetItem = shapeItems[targetIndex];
        const replacedItems = placeShapeItems(
            this.#items,
            shapeItems.map((item) => (item === targetItem ? { ...item, shape } : item))
        );
        const nextItems = filterShapes(replacedItems, (s) => s === shape || !removeSet.has(s.id));

        let nextSelectedIds;
        if (select) {
            nextSelectedIds = new Set([shape.id]);
        } else {
            const survivingIds = new Set(listShapes(nextItems).map((s) => s.id));
            nextSelectedIds = new Set([...this.#selectedIds].filter((id) => survivingIds.has(id)));
        }
        const candidateIds = resolveGroupCandidates({
            currentIds: this.#selectedGroupIds,
            requestedIds: undefined,
            additive: !select || keepId,
        });
        const revealIds = select
            ? this.#resolveReveal({ items: nextItems, nextIds: nextSelectedIds, candidateIds, additive: false })
            : [];
        this.#applyState(nextSelectedIds.size === 0 && !select
            ? { items: nextItems, selectedIds: nextSelectedIds, selectedGroupIds: candidateIds, insertTarget: { kind: PLACE_KIND.ABOVE, id: shape.id }, revealIds }
            : { items: nextItems, selectedIds: nextSelectedIds, selectedGroupIds: candidateIds, revealIds });
        if (this.#hoveredId !== null && !this.#shapes.some((s) => s.id === this.#hoveredId)) {
            this.#hoveredId = null;
        }
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return shape.id;
    }

    /**
     * 複数の図形を、同じidのまま、それぞれの位置へ新しい図形インスタンスで差し替える（拡大縮小・回転のドラッグの追従と中断、回転を離したときの外枠の再描画の通知で呼ぶ）。
     * (1)`replacements`が配列でなければ、console.warnのうえ何もせず（通知もせず）0を返す。
     * (2)配列の順に、各組の`id`の図形の位置へ`shape`を入れ、`shape.id`を`id`にする。
     *    `id`の図形が無い組は飛ばす。`shape`が`id`の図形とは別の位置に既にあるインスタンスなら、
     *    同じidの2要素を作らないためconsole.warnのうえ飛ばす（同じ位置の同じインスタンスは差し替えた扱いで件数に数える）。
     * (3)1件以上差し替えたら、頂点の選択から選択中でなくなった図形の組を落とし（idが同じため通常は何も落ちない）、
     *    変更を通知する（1回。組の数分は発行しない）。0件なら通知しない。
     * 差し替えるのはアイテムの`shape`だけで、名前・表示・ロック・所属は位置のまま引き継ぐ。
     * 触れないもの：選択集合・ホバー（idが同じため）・作成中の図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル
     * （直前に使った値）・idの採番（#nextId）・図形の並び。履歴の記録（beginEdit/commitEdit）は呼び出し側の責務。
     * 図形インスタンスには`id`の代入以外で触れない（図形種別・頂点・図形固有のプロパティを関知しない）。
     * 受け取ったインスタンスをそのまま保持するため、呼び出し側は差し替え後にそのインスタンスを他の用途に流用しない。
     * 引数の配列・要素は書き換えない。
     * @param {Array<{ id: string, shape: Object }>} replacements 差し替える図形のidと、入れる図形（共通インターフェースを持つ図形インスタンス）の組
     * @returns {number} 差し替えた図形の件数
     */
    replaceShapesKeepingIds(replacements) {
        if (!Array.isArray(replacements)) {
            console.warn('VectorModel.replaceShapesKeepingIds: 配列ではない引数のため、何も差し替えません。', replacements);
            return 0;
        }
        const nextShapes = [...this.#shapes];
        let count = 0;
        for (const { id, shape } of replacements) {
            const index = nextShapes.findIndex((s) => s.id === id);
            if (index === -1) {
                continue;
            }
            const existingIndex = nextShapes.indexOf(shape);
            if (existingIndex !== -1 && existingIndex !== index) {
                console.warn('VectorModel.replaceShapesKeepingIds: 別の位置に既にある図形インスタンスのため差し替えません。', shape);
                continue;
            }
            shape.id = id;
            nextShapes[index] = shape;
            count++;
        }
        if (count === 0) {
            return 0;
        }
        this.#applyState({
            items: placeShapeItems(
                this.#items,
                listShapeItems(this.#items).map((item, i) => (nextShapes[i] === item.shape ? item : { ...item, shape: nextShapes[i] }))
            ),
        });
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return count;
    }

    /**
     * 入れ子を新しい形へ動かす唯一の公開操作（まとめる・解除・フォルダの削除・フォルダの中での並べ替え・空のフォルダの追加・行のドラッグでの移動（フォルダへの出し入れ））。以下の順に処理する。
     * (1)検証：図形のアイテムはすべて今持っている図形インスタンスで重複なし、フォルダは`id`が`null`か`undefined`（新しいフォルダ）か、今あるフォルダのidで重複なし。
     *    外れたら`console.warn`して何も変えず`false`を返す。
     * (2)今と構造（種類・id・並び）が同じ（`GroupTreeRules.isSameTree`）なら、何も変えず通知もせず`false`を返す。
     * (3)`resolveItems`で整える（新しいフォルダの名前「フォルダ n」はここで決まる）。引数のアイテムは書き換えない。
     * (4)新しいフォルダに`#issueId`で`group-<連番>`を採番する。
     * (5)`#applyState`で反映する：図形の選択は`selectedIds`（省けば今の値）のうち残った図形、選んでいるフォルダの候補は`selectedGroupIds`（省けば今の値）に
     *    `selectsNewGroups`が真なら新しいフォルダを足したもの（不変条件で絞られる）。消えた図形のホバーと頂点の選択を落とし、変更を通知する（1回）。
     * 折りたたみは入れたアイテムの値のまま保ち、`onCollapsedChange`は呼ばない（折りたたみの変化を覚えない）。
     * 触れないもの：作成中の図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル・図形インスタンスの中身。描き込む先は規則（`InsertTargetRules`）で決まる。
     * 履歴の記録（beginEdit/commitEdit）は呼び出し側の責務。
     * @param {Array<Object>} nextItems 新しいアイテムの入れ子（図形のアイテムとフォルダのアイテム。新しいフォルダは`id`を持たない）
     * @param {Object} [options] オプション
     * @param {Iterable<string>} [options.selectedIds] 新しい図形の選択（省けば今の値。残った図形だけが選ばれる）
     * @param {Iterable<string>} [options.selectedGroupIds] 選んでいるフォルダの候補（省けば今の値）
     * @param {boolean} [options.selectsNewGroups=false] 真なら新しいフォルダを選んでいるフォルダの候補に足す
     * @param {boolean} [options.targetsNewGroup=false] 真なら描き込む先の候補を、新しいフォルダのうち前順で最初のものの中（`inside`）にする（新しいフォルダが無ければ今の値。図形が選ばれていれば選択が優先される）
     * @returns {boolean} 入れ子を変えたか
     */
    rearrangeItems(nextItems, { selectedIds, selectedGroupIds, selectsNewGroups = false, targetsNewGroup = false } = {}) {
        if (!this.#isValidRearrangement(nextItems)) {
            console.warn('VectorModel.rearrangeItems: 今ある図形・フォルダだけ（重複なし）で作った入れ子ではないため、何も変えません。', nextItems);
            return false;
        }
        if (isSameTree(this.#items, nextItems)) {
            return false;
        }
        const resolved = resolveItems(nextItems);
        const newGroupIds = [];
        for (const item of listItems(resolved)) {
            if (item.kind === ITEM_KIND.GROUP && (item.id === null || item.id === undefined)) {
                item.id = this.#issueId(GROUP_ID_PREFIX);
                newGroupIds.push(item.id);
            }
        }
        const remainingIds = new Set(listShapes(resolved).map((s) => s.id));
        const baseIds = selectedIds === undefined ? this.#selectedIds : selectedIds;
        const nextSelectedIds = new Set([...baseIds].filter((id) => remainingIds.has(id)));
        const baseGroupIds = selectedGroupIds === undefined ? this.#selectedGroupIds : selectedGroupIds;
        const candidateIds = new Set(baseGroupIds);
        if (selectsNewGroups) {
            for (const id of newGroupIds) {
                candidateIds.add(id);
            }
        }
        const nextState = { items: resolved, selectedIds: nextSelectedIds, selectedGroupIds: candidateIds };
        if (targetsNewGroup && newGroupIds.length > 0) {
            nextState.insertTarget = { kind: PLACE_KIND.INSIDE, id: newGroupIds[0] };
        }
        this.#applyState(nextState);
        if (this.#hoveredId !== null && !remainingIds.has(this.#hoveredId)) {
            this.#hoveredId = null;
        }
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return true;
    }

    /**
     * アイテム（図形・フォルダ）の名前を変える。
     * `applyItemRename`が`null`（idのアイテムが無い・整えた名前が空・今の名前と同じ）なら、何も変えず（通知もせず）falseを返す。
     * そうでなければ入れ子を入れ替え、変更を通知して（1回）trueを返す。
     * 触れないもの：選択集合・頂点の選択・描き込む先・ホバー・作成中の図形・図形インスタンス・並び。
     * 履歴の記録（beginEdit/commitEdit）は呼び出し側の責務。
     * @param {string} id 名前を変えるアイテムのid（図形のid、またはフォルダのid）
     * @param {string} name 新しい名前の候補（整えて使う）
     * @returns {boolean} 名前を変えたか
     */
    renameItem(id, name) {
        const nextItems = applyItemRename(this.#items, id, name);
        if (nextItems === null) {
            return false;
        }
        this.#applyState({ items: nextItems });
        this.#notifyChange();
        return true;
    }

    /**
     * データ変更時に呼び出されるコールバック関数を登録する。
     * @param {Function} callback 登録するコールバック関数
     */
    onChange(callback) {
        if (typeof callback === 'function') {
            this.#listeners.push(callback);
        }
    }

    /**
     * 折りたたみが変わったときに呼び出されるコールバック関数を登録する。
     * `setGroupCollapsed`・選択が変わったときの自動で開くのどちらかで折りたたみが変わったとき、`onChange`の通知の後に1回呼ぶ
     * （`replaceAllShapes`・`rearrangeItems`では呼ばない）。
     * @param {Function} callback 登録するコールバック関数
     */
    onCollapsedChange(callback) {
        if (typeof callback === 'function') {
            this.#collapsedListeners.push(callback);
        }
    }

    /**
     * 新しいidを1つ発行する（`<接頭辞><連番>`。発行のたびに#nextIdを1増やす。図形とフォルダで同じカウンタを使う）。
     * 図形idの採番（`shape-<連番>`）・フォルダidの採番（`group-<連番>`）はすべてこのメソッドを経由する（commitDraft・replaceAllShapes・addShapesWithNewIds・replaceShape・rearrangeItems）。
     * @param {string} [prefix=ID_PREFIX] idの接頭辞（図形は`shape-`、フォルダは`group-`）
     * @returns {string} 発行したid
     * @private
     */
    #issueId(prefix = ID_PREFIX) {
        return `${prefix}${this.#nextId++}`;
    }

    /**
     * `#items`・選択集合・選んでいるフォルダ・描き込む先への唯一の書き込み口（コンストラクタを除く）。省いた引数は今の値のまま。
     * `revealIds`の図形を含む閉じたフォルダ（変わる前の`#items`にあったものだけ）を開く。開いたら折りたたみが変わったことを覚える。
     * 選んでいるフォルダは候補を`GroupSelectionRules.resolveSelectedGroupIds`の不変条件に通した結果になる。
     * 描き込む先は、選んでいるフォルダを先に求めてから`InsertTargetRules.resolveNextInsertTarget`で決めて代入する。通知はしない。
     * @param {Object} [state] 書き込む値
     * @param {Array<Object>} [state.items] 新しいアイテムの入れ子
     * @param {Set<string>} [state.selectedIds] 新しい選択集合
     * @param {Set<string>} [state.selectedGroupIds] 選んでいるフォルダの候補（不変条件で絞る）
     * @param {{kind: string, id: (string|null)}|null} [state.insertTarget] 描き込む先の候補（場所またはnull。規則で最終的に決まる）
     * @param {Iterable<string>} [state.revealIds] 見えるようにする（上の閉じたフォルダを開く）図形のid
     * @private
     */
    #applyState({
        items = this.#items,
        selectedIds = this.#selectedIds,
        selectedGroupIds = this.#selectedGroupIds,
        insertTarget = this.#insertTarget,
        revealIds = [],
    } = {}) {
        const previousItems = this.#items;
        let nextItems = items;
        const reveal = [...revealIds];
        if (reveal.length > 0) {
            const previousGroupIds = new Set(listItems(previousItems).filter((item) => item.kind === ITEM_KIND.GROUP).map(itemIdOf));
            const expanded = expandGroupsContaining(items, reveal, (id) => previousGroupIds.has(id));
            if (expanded !== items) {
                nextItems = expanded;
                this.#collapsedChanged = true;
            }
        }
        const nextGroupIds = resolveSelectedGroupIds({ previousItems, items: nextItems, selectedIds, candidateIds: selectedGroupIds });
        this.#insertTarget = resolveNextInsertTarget({
            previousItems,
            items: nextItems,
            selectedIds,
            selectedGroupIds: nextGroupIds,
            target: insertTarget,
        });
        this.#items = nextItems;
        this.#selectedIds = selectedIds;
        this.#selectedGroupIds = nextGroupIds;
    }

    /**
     * 選択が変わったときに開く対象の図形のidを求める（`GroupSelectionRules.resolveRevealIds`。前後のフォルダの選択は不変条件を通した値で比べる）。
     * @param {Object} params 引数
     * @param {Array<Object>} params.items 変わった後のアイテムの入れ子
     * @param {Set<string>} params.nextIds 次の図形の選択
     * @param {Set<string>} params.candidateIds 次のフォルダの選択の候補
     * @param {boolean} params.additive 足しただけ（`Ctrl`）か
     * @returns {Array<string>} 開く対象の図形のid
     * @private
     */
    #resolveReveal({ items, nextIds, candidateIds, additive }) {
        const nextGroupIds = resolveSelectedGroupIds({ previousItems: this.#items, items, selectedIds: nextIds, candidateIds });
        return resolveRevealIds({
            previousIds: this.#selectedIds,
            nextIds,
            previousGroupIds: this.#selectedGroupIds,
            nextGroupIds,
            additive,
        });
    }

    /**
     * `rearrangeItems`へ渡された入れ子が、今ある図形インスタンス（重複なし）と、新しい（idが`null`／`undefined`）または今あるフォルダ（重複なし）だけでできているかを調べる。
     * @param {*} nextItems 検証する入れ子
     * @returns {boolean} 受け付けられるか
     * @private
     */
    #isValidRearrangement(nextItems) {
        if (!Array.isArray(nextItems)) {
            return false;
        }
        const currentShapes = new Set(this.#shapes);
        const currentGroupIds = new Set(listItems(this.#items).filter((item) => item.kind === ITEM_KIND.GROUP).map(itemIdOf));
        const usedShapes = new Set();
        const usedGroupIds = new Set();
        const visit = (list) => {
            if (!Array.isArray(list)) {
                return false;
            }
            for (const item of list) {
                if (item === null || typeof item !== 'object') {
                    return false;
                }
                if (item.kind === ITEM_KIND.GROUP) {
                    if (item.id !== null && item.id !== undefined) {
                        if (!currentGroupIds.has(item.id) || usedGroupIds.has(item.id)) {
                            return false;
                        }
                        usedGroupIds.add(item.id);
                    }
                    if (!visit(item.children)) {
                        return false;
                    }
                } else if (item.kind === ITEM_KIND.SHAPE) {
                    if (!currentShapes.has(item.shape) || usedShapes.has(item.shape)) {
                        return false;
                    }
                    usedShapes.add(item.shape);
                } else {
                    return false;
                }
            }
            return true;
        };
        return visit(nextItems);
    }

    /**
     * 追加するアイテムを入れた新しい入れ子を返す（`ItemPlaceRules.insertItemsAt`）。`place`が無し（null）ならいちばん外側の末尾へ入れる。
     * @param {Array<Object>} addedItems 追加するアイテム（順のまま入る）
     * @param {{kind: string, id: (string|null)}|null} place 入る場所（描き込む先の値。無しならnull）
     * @returns {Array<Object>} 新しい入れ子
     * @private
     */
    #placeAdded(addedItems, place) {
        return insertItemsAt(this.#items, place, addedItems);
    }

    /**
     * 渡されたidのうち、現存する図形のidだけを集めた新しい集合を返す。
     * @param {Iterable<string>} ids 図形idの集合
     * @returns {Set<string>} 現存する図形のidの集合
     * @private
     */
    #filterExistingIds(ids) {
        const existingIds = new Set(this.#shapes.map((s) => s.id));
        const result = new Set();
        for (const id of ids) {
            if (existingIds.has(id)) {
                result.add(id);
            }
        }
        return result;
    }

    /**
     * 直前に使った値から、図形へ代入するスタイル（共通プロパティ3つ）を求める。
     * @returns {{strokeColor: (string|null), strokeWidth: number, fillColor: (string|null)}} 無効の項目はnull
     * @private
     */
    #toShapeStyle() {
        const s = this.#newShapeStyle;
        return {
            strokeColor: s.strokeEnabled ? s.strokeColor : null,
            strokeWidth: s.strokeWidth,
            fillColor: s.fillEnabled ? s.fillColor : null,
        };
    }

    /**
     * 図形へスタイルを代入する。`style`が自身のプロパティとして持つSHAPE_STYLE_KEYSのキーだけを代入する。
     * @param {Object} shape 代入先の図形
     * @param {Object} style 代入するスタイル
     * @private
     */
    #assignShapeStyle(shape, style) {
        for (const key of SHAPE_STYLE_KEYS) {
            if (Object.prototype.hasOwnProperty.call(style, key)) {
                shape[key] = style[key];
            }
        }
    }

    /**
     * 頂点の選択から、選択集合に含まれない図形・変えられない図形の組を落とす（通知はしない。呼び出し側の既存の通知に相乗りする）。
     * @returns {boolean} 1つ以上落としたらtrue
     * @private
     */
    #pruneSelectedVertices() {
        const editableIds = collectEditableIds(this.#items);
        const kept = this.#selectedVertices.filter((p) => this.#selectedIds.has(p.shapeId) && editableIds.has(p.shapeId));
        const pruned = kept.length !== this.#selectedVertices.length;
        this.#selectedVertices = kept;
        return pruned;
    }

    /**
     * 登録されたすべてのリスナーに変更を通知する。折りたたみが変わっていれば、その後に`onCollapsedChange`のリスナーを1回だけ呼ぶ。
     * @private
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
        if (this.#collapsedChanged) {
            this.#collapsedChanged = false;
            for (const listener of this.#collapsedListeners) {
                listener();
            }
        }
    }
}
