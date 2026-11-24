/**
 * 責務：図形とフォルダのアイテムの入れ子の並び・選択集合・ホバー・作成中図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル（直前に使った値）の
 * 状態管理（SSOT：Single Source of Truth）と更新通知を担う。
 * 頂点の選択（選択集合の図形のid＋ハンドル名の組。保存・履歴・書き出しの対象外の一時的な状態）も保持する。
 */
import { ShapeFactory, SHAPE_TYPES } from './ShapeFactory.js';
import { ITEM_KIND, toItems, listItems, listShapeItems, listShapes, placeShapeItems, filterShapes } from './ItemTreeRules.js';
import { resolveItems } from './ItemAttributeRules.js';

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
 * 名前・表示・ロックの規則は`ItemAttributeRules`、入れ子の計算は`ItemTreeRules`へ委譲する。
 * 図形の生成はShapeFactoryへ委譲する（復元は`DocumentSerializer`→`ShapeFactory.fromJSON`が行い、本クラスは復元済みの図形一式を受け取るのみ）。図形固有の頂点構造には依存しない（ポリモーフィック呼び出しのみ）。
 * 新しく描く図形のスタイル（直前に使った値）も保持する（作業データ・履歴のスナップショットには含まれない）。
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
     * @type {Array<{shapeId: string, handle: string}>}
     * 頂点の選択（選んだ順）。表示専用で保存しない（作業データ・履歴・書き出しに入れない）。
     * 常に選択集合に含まれる図形の組だけを含む（#pruneSelectedVerticesで保つ）。
     * @private
     */
    #selectedVertices;

    /**
     * @type {number} 図形id採番用の連番カウンタ（次に#issueId()が発行する連番）。
     * #issueId()による採番（図形・フォルダ共通。commitDraft・replaceAllShapes・addShapesWithNewIds・replaceShape）で1ずつ増える。
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
        this.#hoveredId = null;
        this.#draftShape = null;
        this.#selectionRect = null;
        this.#snapPoint = null;
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
        this.#items = [...this.#items, ...resolveItems([shape], this.#items)];
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
     * 選択集合を指定したidの集合で置き換え、変更を通知する（1回）。
     * 現存しない図形のidは除外する（選択集合は常に現存図形のidのみを含む）。
     * 頂点の選択から、選択中でなくなった図形の組を落とす（通知は増やさない）。
     * 単一選択は setSelection([id]) で表現する。
     * @param {Iterable<string>} ids 新しい選択集合とする図形idの集合
     */
    setSelection(ids) {
        const existingIds = new Set(this.#shapes.map((s) => s.id));
        this.#selectedIds = new Set();
        for (const id of ids) {
            if (existingIds.has(id)) {
                this.#selectedIds.add(id);
            }
        }
        this.#pruneSelectedVertices();
        this.#notifyChange();
    }

    /**
     * 選択集合を空にし、変更を通知する（1回）。頂点の選択も（選択中の図形が無くなるため）空になる。
     */
    clearSelection() {
        this.#selectedIds.clear();
        this.#pruneSelectedVertices();
        this.#notifyChange();
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
     * 受理するのは、`shapeId`が現在の選択集合に含まれ、かつ`handle`が空でない文字列の組だけ（与えられた順。同じ組の重複は除く）。
     * 要素は新しいオブジェクトとして持つ（引数のオブジェクトを保持せず、書き換えない）。
     * 内容（組と順）が変わったときだけ変更を通知する（1回）。
     * @param {Array<{shapeId: string, handle: string}>} pairs 新しい頂点の選択
     */
    setSelectedVertices(pairs) {
        const next = [];
        for (const pair of pairs) {
            if (!pair || typeof pair.handle !== 'string' || pair.handle === '' || !this.#selectedIds.has(pair.shapeId)) {
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
     * 現在の点と同じ座標なら何もしない（mousemoveごとの無駄な再描画を避ける）。
     * @param {number} x 点のX座標（ワールド座標）
     * @param {number} y 点のY座標（ワールド座標）
     */
    setSnapPoint(x, y) {
        if (this.#snapPoint !== null && this.#snapPoint.x === x && this.#snapPoint.y === y) {
            return;
        }
        this.#snapPoint = { x, y };
        this.#notifyChange();
    }

    /**
     * 吸い付きの表示の点を消去する。表示中だった場合のみ変更を通知する（1回）。
     */
    clearSnapPoint() {
        if (this.#snapPoint === null) {
            return;
        }
        this.#snapPoint = null;
        this.#notifyChange();
    }

    /**
     * 吸い付きの表示の点を取得する。
     * @returns {{x: number, y: number}|null} 点のコピー（ワールド座標）、表示していない場合はnull
     */
    getSnapPoint() {
        return this.#snapPoint ? { ...this.#snapPoint } : null;
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
     * 作成中の図形が存在しない場合は何もしない。
     */
    commitDraft() {
        if (!this.#draftShape) {
            return;
        }
        this.#draftShape.id = this.#issueId();
        this.#items = [...this.#items, ...resolveItems([this.#draftShape], this.#items)];
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
     * 存在しないidは無視する。1件以上削除した場合のみ変更を通知する（1回。図形数分は発行しない）。
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
        this.#items = filterShapes(this.#items, (s) => !targetIds.has(s.id));

        for (const id of removedIds) {
            this.#selectedIds.delete(id);
        }
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
     * (5)選択集合・頂点の選択・ホバー状態・作成中の図形・選択矩形・吸い付きの表示の点をクリアする。
     * (6)変更を通知する（1回のみ）。
     * 新しく描く図形のスタイル（直前に使った値）には触れない。
     * 進行中の入力操作（ドラッグ・作成途中の図形）の中断は呼び出し側の責務（`InputTracker.abortOngoingOperation()`、または`CanvasLibrary`では`prepareSwitch()`経由の`setMode`）。
     * 受け取った図形インスタンスの`id`を直接書き換える。idの重複判定は値で行うため、同一インスタンスを配列に重複して渡さない（既存インスタンスを渡す場合は呼び出し側で複製する）。
     * @param {Array<Object>} values 新しいアイテムの入れ子（描画順）。アイテムまたは素の図形インスタンス（共通インターフェースを持つ）の配列
     * @returns {number} idを振り直した図形とフォルダの合計件数
     */
    replaceAllShapes(values) {
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

        this.#items = nextItems;
        this.#selectedIds.clear();
        this.#pruneSelectedVertices();
        this.#hoveredId = null;
        this.#draftShape = null;
        this.#selectionRect = null;
        this.#snapPoint = null;

        this.#notifyChange();
        return reassignTargets.length;
    }

    /**
     * 指定したアイテム（または素の図形）を、新しいidを採番したうえで#itemsの末尾（いちばん外側）へ引数の順に追加し、
     * 追加した図形だけを選択する（貼り付け・複製・インポート等で図形を追加する場合の公開操作）。
     * (1)idの上書き：追加する各図形の`id`・各フォルダの`id`を常に#issueId()で発行した新しいid（図形は`shape-`、フォルダは`group-`）で上書きする
     *    （引数のidは引き継がない）。#nextIdは単調増加で減らさないため、キャンバス上の既存のidとも、過去に発行したidとも衝突しない。
     * (2)重複インスタンスの除外：引数内で2回目以降に現れる図形インスタンス、および既に保持している図形インスタンスは、
     *    同じidを持つ2要素を作らないためconsole.warnのうえ追加しない（判定はインスタンス参照で行う）。フォルダは空になっても残す。
     * (3)図形が1つも残らなければ（フォルダだけの場合を含む）何も変えず（通知もせず）空配列を返す。
     * (4)名前・表示・ロックは`resolveItems`が決める（名前のあるアイテムはそのまま。名前の無い図形・フォルダには今のキャンバスの名前と重ならない自動の名前が付く）。
     * (5)選択集合を、追加した図形のidの集合で置き換える（追加した図形だけが選択される）。
     *    頂点の選択から、選択中でなくなった図形の組を落とす。ホバー状態・作成中の図形・選択矩形には触れない。
     * (6)変更を通知する（1回。図形数分は発行しない）。
     * 受け取った図形インスタンスをそのまま保持して`id`を書き換えるため、呼び出し側は追加後にそのインスタンスを他の用途に流用しない。
     * 図形インスタンスには`id`の代入以外で触れない（頂点・図形固有のプロパティ・図形種別を関知しない）。
     * 前提：呼び出し側が選択モードであることを保証すること（選択集合は選択モード以外では常に空という不変条件を守るため）。
     * @param {Array<Object>} values 追加するアイテムの入れ子（描画順）。アイテムまたは素の図形インスタンス（共通インターフェースを持つ）の配列
     * @returns {Array<string>} 追加した図形の新しいidの配列（描画順。フォルダのidは含まない。追加0件なら空配列）
     */
    addShapesWithNewIds(values) {
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

        if (listShapeItems(accepted).length === 0) {
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
        this.#items = [...this.#items, ...addedItems];

        this.#selectedIds = new Set(addedIds);
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
     * (5)`select`が真なら選択集合を`shape.id`だけにする。偽なら選択集合を新しく作らず、現存しなくなったid
     *    （置き換えで消えた元のid・除いた図形のid）だけを選択集合から外す（作成モードでは空のまま）。
     *    頂点の選択から、選択中でなくなった図形の組を落とす。
     *    ホバー中のidが現存しなくなればホバーを解除する。作成中の図形・選択矩形には触れない。
     * (6)変更を通知する（1回）。
     * 受け取ったインスタンスをそのまま保持して`id`を書き換えるため、呼び出し側は以後そのインスタンスを他の用途に流用しない。
     * 図形インスタンスには`id`の代入以外で触れない（頂点・図形固有のプロパティ・図形種別を関知しない）。
     * 前提：`select`が真のときは、呼び出し側が選択モードであることを保証すること（選択集合は選択モード以外では常に空という不変条件を守るため）。
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
        this.#items = filterShapes(replacedItems, (s) => s === shape || !removeSet.has(s.id));

        if (select) {
            this.#selectedIds = new Set([shape.id]);
        } else {
            const survivingIds = new Set(this.#shapes.map((s) => s.id));
            this.#selectedIds = new Set([...this.#selectedIds].filter((id) => survivingIds.has(id)));
        }
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
        this.#items = placeShapeItems(
            this.#items,
            listShapeItems(this.#items).map((item, i) => (nextShapes[i] === item.shape ? item : { ...item, shape: nextShapes[i] }))
        );
        this.#pruneSelectedVertices();
        this.#notifyChange();
        return count;
    }

    /**
     * 図形の並び（重なり順。先頭＝最も奥、末尾＝最も手前）を、指定したidの並び全体で置き換える。
     * (1)`orderedIds`が配列でない・要素数が今の図形の数と違う・今の図形に無いidを含む・同じidを2回以上含む場合は、
     *    console.warnのうえ何も変えず（通知もせず）falseを返す（並びを壊さない）。
     * (2)idから今の図形インスタンスを引いて新しい配列を作る。今の並びとすべての位置で同じインスタンスなら、
     *    何も変えず（通知もせず・警告もせず）falseを返す（図形0個で`[]`を渡す場合を含む）。
     * (3)フォルダの位置と入れ子を保ったまま、図形のアイテム（名前・表示・ロックごと）を新しい順に図形の位置へ置き直し
     *    （名前は図形について動き、所属は位置のものになる）、変更を通知して（1回）trueを返す。
     * 操作の種類（最前面へ等）は受け取らず、新しい並び全体だけを受け取る（並べ替えの規則を`core/`へ持ち込まず、
     * 任意の並びの設定からも同じ公開操作を使えるようにするため。規則は`edit/ShapeOrderRules.js`が持つ）。
     * 触れないもの：選択集合（同じidの図形が選ばれたまま。`getSelectedIds()`が返す順は新しい並びに従う）・ホバー・
     * 作成中の図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル（直前に使った値）・idの採番（#nextId）・
     * 図形インスタンスの中身（id・頂点・スタイル。インスタンスは並び替えるだけで作り直さない）。
     * 履歴の記録（beginEdit/commitEdit）は呼び出し側の責務。
     * @param {Array<string>} orderedIds 現在の全図形のidをちょうど1回ずつ並べた配列（先頭＝最も奥）
     * @returns {boolean} 並びを変えたか
     */
    reorderShapes(orderedIds) {
        const currentShapes = this.#shapes;
        if (!Array.isArray(orderedIds) || orderedIds.length !== currentShapes.length) {
            console.warn('VectorModel.reorderShapes: 現在の全図形のidをちょうど1回ずつ並べた配列ではないため、並びを変えません。', orderedIds);
            return false;
        }
        const shapeById = new Map(currentShapes.map((s) => [s.id, s]));
        const nextShapes = [];
        const usedIds = new Set();
        for (const id of orderedIds) {
            if (!shapeById.has(id) || usedIds.has(id)) {
                console.warn('VectorModel.reorderShapes: 現在の全図形のidをちょうど1回ずつ並べた配列ではないため、並びを変えません。', orderedIds);
                return false;
            }
            usedIds.add(id);
            nextShapes.push(shapeById.get(id));
        }
        if (nextShapes.every((s, i) => s === currentShapes[i])) {
            return false;
        }
        const itemByShape = new Map(listShapeItems(this.#items).map((item) => [item.shape, item]));
        this.#items = placeShapeItems(this.#items, nextShapes.map((shape) => itemByShape.get(shape)));
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
     * 新しいidを1つ発行する（`<接頭辞><連番>`。発行のたびに#nextIdを1増やす。図形とフォルダで同じカウンタを使う）。
     * 図形idの採番（`shape-<連番>`）・フォルダidの採番（`group-<連番>`）はすべてこのメソッドを経由する（commitDraft・replaceAllShapes・addShapesWithNewIds・replaceShape）。
     * @param {string} [prefix=ID_PREFIX] idの接頭辞（図形は`shape-`、フォルダは`group-`）
     * @returns {string} 発行したid
     * @private
     */
    #issueId(prefix = ID_PREFIX) {
        return `${prefix}${this.#nextId++}`;
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
     * 頂点の選択から、選択集合に含まれない図形の組を落とす（通知はしない。呼び出し側の既存の通知に相乗りする）。
     * @returns {boolean} 1つ以上落としたらtrue
     * @private
     */
    #pruneSelectedVertices() {
        const kept = this.#selectedVertices.filter((p) => this.#selectedIds.has(p.shapeId));
        const pruned = kept.length !== this.#selectedVertices.length;
        this.#selectedVertices = kept;
        return pruned;
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
}
