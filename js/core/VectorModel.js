/**
 * 責務：図形データ・選択集合・ホバー・作成中図形・選択矩形の状態管理（SSOT：Single Source of Truth）と更新通知を担う。
 */
import { ShapeFactory, SHAPE_TYPES } from './ShapeFactory.js';

/**
 * 図形idの接頭辞。VectorModelが採番するidは `shape-<連番>`（例：'shape-1'）の形式とする。
 * id形式の知識は本ファイル内に閉じる（他モジュールはidを不透明な文字列として扱う）。
 * @type {string}
 */
const ID_PREFIX = 'shape-';

/**
 * 採番形式（`shape-<連番>`）のidに一致し、連番部分（10進数字列）を第1グループに取り出す正規表現。
 * replaceAllShapesでの#nextIdの繰り上げ（保持idの最大連番の算出）にのみ用いる。
 * @type {RegExp}
 */
const ID_PATTERN = new RegExp(`^${ID_PREFIX}(\\d+)$`);

/**
 * 図形の配列（描画順）と、選択集合・ホバー・作成中の図形・選択矩形を保持する単一の真実（SSOT）。
 * 状態を変更するAPIは変更後にonChangeの登録リスナーへ通知する。図形idの採番（`shape-<連番>`）も本クラスが担う。
 * 図形の生成はShapeFactoryへ委譲する（復元は`DocumentSerializer`→`ShapeFactory.fromJSON`が行い、本クラスは復元済みの図形一式を受け取るのみ）。図形固有の頂点構造には依存しない（ポリモーフィック呼び出しのみ）。
 */
export class VectorModel {
    /**
     * @type {Array<Object>} 保持している図形オブジェクトの配列
     * @private
     */
    #shapes;

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
     * （draw/setVertex等の共通インターフェースを持つ図形オブジェクト。ShapeFactory経由で生成される）
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
     * @type {number} 図形id採番用の連番カウンタ（次に#issueId()が発行する連番）。
     * #issueId()による採番（commitDraft・replaceAllShapes・addShapesWithNewIds）で1ずつ増える。
     * 単調増加し、減らさない。replaceAllShapesでは、保持したidのうち採番形式（`shape-<連番>`。
     * 連番がNumber.isSafeIntegerのもの）の最大連番をnとして max(現在値, n + 1) へ繰り上げる
     * （以後に発行するidが保持idと衝突しないため）。
     * @private
     */
    #nextId;

    /**
     * 図形0個・選択なし・ホバーなし・作成中の図形なし・選択矩形なし・リスナーなしの状態で初期化する。
     */
    constructor() {
        this.#shapes = [];
        this.#listeners = [];
        this.#selectedIds = new Set();
        this.#hoveredId = null;
        this.#draftShape = null;
        this.#selectionRect = null;
        this.#nextId = 1;
    }

    /**
     * 新しい図形を追加し、変更を通知する。
     * 使わないこと（id採番を通らず`#shapes`へ追加するだけで、呼び出し元はない。図形の追加は`commitDraft`・`addShapesWithNewIds`を使う）。
     * @param {Object} shape 追加する図形オブジェクト（drawメソッドを持つこと）
     */
    addShape(shape) {
        this.#shapes.push(shape);
        this.#notifyChange();
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
        this.#notifyChange();
    }

    /**
     * 選択集合を空にし、変更を通知する（1回）。
     */
    clearSelection() {
        this.#selectedIds.clear();
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
     * 始点を確定し、始点・終点が同一座標の仮図形を作成中データとして生成する。
     * 生成した時点ではidを持たず、#shapesにも登録しない（コミットはcommitDraftで行う）。
     * @param {number} x 始点のX座標（ワールド座標）
     * @param {number} y 始点のY座標（ワールド座標）
     * @param {string} [type=SHAPE_TYPES[0]] 生成する図形の種別（SHAPE_TYPESのいずれか。ShapeFactory.createへ渡される）
     */
    startDraft(x, y, type = SHAPE_TYPES[0]) {
        this.#draftShape = ShapeFactory.create(type, x, y, x, y);
        this.#notifyChange();
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
     * 作成中の図形に一意なidを採番（#issueId()。`shape-<連番>`）して#shapesへ確定登録し、作成中データを破棄する。
     * 作成中の図形が存在しない場合は何もしない。
     */
    commitDraft() {
        if (!this.#draftShape) {
            return;
        }
        this.#draftShape.id = this.#issueId();
        this.#shapes.push(this.#draftShape);
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
     * 作成中（未コミット）の図形オブジェクトを取得する。
     * @returns {Object|null} 作成中の図形オブジェクト（存在しない場合はnull）
     */
    getDraftShape() {
        return this.#draftShape;
    }

    /**
     * 指定したidの図形の、指定した頂点インデックスの座標を絶対座標で更新する。
     * 該当図形が存在しない場合は何もしない。頂点インデックスと図形固有プロパティとの
     * 対応関係は関知せず、更新処理自体はshape.setVertex(vertexIndex, x, y)へポリモー
     * フィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。
     * @param {string} id 対象図形のid（単一）
     * @param {number} vertexIndex 更新する頂点のインデックス（各図形のgetVertexIndexForHandleの規約に従う頂点インデックス）
     * @param {number} x 更新後のX座標（ワールド座標）
     * @param {number} y 更新後のY座標（ワールド座標）
     */
    updateVertex(id, vertexIndex, x, y) {
        const shape = this.#shapes.find((s) => s.id === id);
        if (!shape) {
            return;
        }

        shape.setVertex(vertexIndex, x, y);

        this.#notifyChange();
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
     * 指定したidの集合に含まれる全図形を#shapesから除去する。
     * 除去した図形のidは選択集合・ホバー状態からも除去する（存在しない図形のidが残留することを防ぐため）。
     * 存在しないidは無視する。1件以上削除した場合のみ変更を通知する（1回。図形数分は発行しない）。
     * @param {Iterable<string>} ids 削除する図形idの集合
     */
    deleteShapes(ids) {
        const targetIds = new Set(ids);
        const remaining = this.#shapes.filter((s) => !targetIds.has(s.id));
        if (remaining.length === this.#shapes.length) {
            return;
        }

        const removedIds = this.#shapes
            .filter((s) => targetIds.has(s.id))
            .map((s) => s.id);
        this.#shapes = remaining;

        for (const id of removedIds) {
            this.#selectedIds.delete(id);
        }
        if (this.#hoveredId !== null && removedIds.includes(this.#hoveredId)) {
            this.#hoveredId = null;
        }

        this.#notifyChange();
    }

    /**
     * 保持している全図形を、指定した図形の配列で一括して入れ替える（用途：`?dev`の復元・取り消し/やり直し・キャンバスの切り替え）。以下の順に処理する。
     * (1)引数の配列をコピーして新しい内部配列とする（引数の配列自体は流用しない。図形インスタンスは受け取ったものを保持する）。
     * (2)idの正規化：先頭から順に、idが空でない文字列で、それまでに出現していなければそのまま保持する（保持id）。
     *    それ以外（欠落・文字列でない・空文字・重複の後出し）は振り直し対象とする（重複時は後に出現した方を振り直す）。
     * (3)保持idのうち採番形式（`shape-<連番>`。連番がNumber.isSafeIntegerのもの）の最大連番をnとし、
     *    #nextIdを max(現在値, n + 1) へ繰り上げる（減らさない）。
     * (4)振り直し対象に#issueId()で新しいidを採番する（(3)により保持idとは衝突しない）。
     * (5)選択集合・ホバー状態・作成中の図形・選択矩形をクリアする。
     * (6)変更を通知する（1回のみ）。
     * 進行中の入力操作（ドラッグ・作成途中の図形）の中断は呼び出し側の責務（`InputTracker.abortOngoingOperation()`、または`CanvasLibrary`では`prepareSwitch()`経由の`setMode`）。
     * 受け取ったインスタンスの`id`を直接書き換える。idの重複判定は値で行うため、同一インスタンスを配列に重複して渡さない（既存インスタンスを渡す場合は呼び出し側で複製する）。
     * @param {Array<Object>} shapes 新しい図形の配列（描画順。共通インターフェースを持つ図形インスタンス）
     * @returns {number} idを振り直した図形の件数
     */
    replaceAllShapes(shapes) {
        const nextShapes = [...shapes];

        const keptIds = new Set();
        const reassignTargets = [];
        let maxSerial = 0;
        for (const shape of nextShapes) {
            const id = shape.id;
            if (typeof id !== 'string' || id === '' || keptIds.has(id)) {
                reassignTargets.push(shape);
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
        for (const shape of reassignTargets) {
            shape.id = this.#issueId();
        }

        this.#shapes = nextShapes;
        this.#selectedIds.clear();
        this.#hoveredId = null;
        this.#draftShape = null;
        this.#selectionRect = null;

        this.#notifyChange();
        return reassignTargets.length;
    }

    /**
     * 指定した図形を、新しいidを採番したうえで#shapesの末尾（最前面）へ引数の順に追加し、
     * 追加した図形だけを選択する（貼り付け・複製・インポート等で図形を追加する場合の公開操作）。
     * (1)idの上書き：追加する各図形の`id`を常に#issueId()で発行した新しいidで上書きする（引数の図形のidは引き継がない）。
     *    #nextIdは単調増加で減らさないため、キャンバス上の既存図形のidとも、過去に発行したidとも衝突しない。
     * (2)重複インスタンスの除外：引数内で2回目以降に現れるインスタンス、および既に#shapesに含まれるインスタンスは、
     *    同じidを持つ2要素を作らないためconsole.warnのうえ追加しない（判定はインスタンス参照で行う）。
     * (3)選択集合を、追加した図形のidの集合で置き換える（追加した図形だけが選択される）。
     *    ホバー状態・作成中の図形・選択矩形には触れない。
     * (4)1件以上追加した場合のみ変更を通知する（1回。図形数分は発行しない）。0件なら何も変更しない。
     * 受け取ったインスタンスをそのまま保持して`id`を書き換えるため、呼び出し側は追加後にそのインスタンスを他の用途に流用しない。
     * 図形インスタンスには`id`の代入以外で触れない（頂点・図形固有のプロパティ・図形種別を関知しない）。
     * 前提：呼び出し側が選択モードであることを保証すること（選択集合は選択モード以外では常に空という不変条件を守るため）。
     * @param {Array<Object>} shapes 追加する図形の配列（描画順。共通インターフェースを持つ図形インスタンス）
     * @returns {Array<string>} 追加した図形の新しいidの配列（描画順。追加0件なら空配列）
     */
    addShapesWithNewIds(shapes) {
        const existingShapes = new Set(this.#shapes);
        const processedShapes = new Set();
        const addedIds = [];
        for (const shape of shapes) {
            if (existingShapes.has(shape) || processedShapes.has(shape)) {
                console.warn('VectorModel.addShapesWithNewIds: 既に追加済みの図形インスタンスのため追加しません。', shape);
                continue;
            }
            processedShapes.add(shape);
            shape.id = this.#issueId();
            this.#shapes.push(shape);
            addedIds.push(shape.id);
        }

        if (addedIds.length === 0) {
            return addedIds;
        }

        this.#selectedIds = new Set(addedIds);
        this.#notifyChange();
        return addedIds;
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
     * 新しい図形idを1つ発行する（`shape-<連番>`。発行のたびに#nextIdを1増やす）。
     * 図形idの採番はすべてこのメソッドを経由する（commitDraft・replaceAllShapes・addShapesWithNewIds）。
     * @returns {string} 発行した図形id
     * @private
     */
    #issueId() {
        return `${ID_PREFIX}${this.#nextId++}`;
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
