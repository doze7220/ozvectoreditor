/**
 * 責務：図形データの状態管理（SSOT：Single Source of Truth）と更新通知を担う。
 */
import { ShapeFactory } from './ShapeFactory.js';

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
     * @type {string|null} 選択中の図形のid
     * @private
     */
    #selectedId;

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
    #draftLine;

    /**
     * @type {number} 図形id採番用の連番カウンタ
     * @private
     */
    #nextId;

    constructor() {
        this.#shapes = [];
        this.#listeners = [];
        this.#selectedId = null;
        this.#hoveredId = null;
        this.#draftLine = null;
        this.#nextId = 1;
    }

    /**
     * 新しい図形を追加し、変更を通知する。
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
     * 指定したidの図形を選択状態にし、変更を通知する。
     * @param {string} id 選択する図形のid
     */
    selectShape(id) {
        this.#selectedId = id;
        this.#notifyChange();
    }

    /**
     * 選択状態を解除し、変更を通知する。
     */
    clearSelection() {
        this.#selectedId = null;
        this.#notifyChange();
    }

    /**
     * 現在選択中の図形のidを取得する。
     * @returns {string|null} 選択中の図形のid（未選択時はnull）
     */
    getSelectedId() {
        return this.#selectedId;
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
     * 始点を確定し、始点・終点が同一座標の仮図形を作成中データとして生成する。
     * 生成した時点ではidを持たず、#shapesにも登録しない（コミットはcommitDraftで行う）。
     * @param {number} x 始点のX座標（論理座標系）
     * @param {number} y 始点のY座標（論理座標系）
     * @param {string} [type='line'] 生成する図形の種別（ShapeFactory.createへ渡される）
     */
    startDraft(x, y, type = 'line') {
        this.#draftLine = ShapeFactory.create(type, x, y, x, y);
        this.#notifyChange();
    }

    /**
     * 作成中Lineの終点をカーソル位置に追従させる。作成中Lineが存在しない場合は何もしない。
     * @param {number} x 終点のX座標（論理座標系）
     * @param {number} y 終点のY座標（論理座標系）
     */
    updateDraft(x, y) {
        if (!this.#draftLine) {
            return;
        }
        this.#draftLine.setVertex(1, x, y);
        this.#notifyChange();
    }

    /**
     * 作成中Lineに一意なidを採番して#shapesへ確定登録し、作成中データを破棄する。
     * 作成中Lineが存在しない場合は何もしない。
     */
    commitDraft() {
        if (!this.#draftLine) {
            return;
        }
        this.#draftLine.id = `shape-${this.#nextId++}`;
        this.#shapes.push(this.#draftLine);
        this.#draftLine = null;
        this.#notifyChange();
    }

    /**
     * 作成中Lineを確定せずに破棄する（作成中断用）。作成中Lineが存在しない場合は何もしない。
     */
    cancelDraft() {
        if (!this.#draftLine) {
            return;
        }
        this.#draftLine = null;
        this.#notifyChange();
    }

    /**
     * 作成中（未コミット）の図形オブジェクトを取得する。
     * @returns {Object|null} 作成中の図形オブジェクト（存在しない場合はnull）
     */
    getDraftLine() {
        return this.#draftLine;
    }

    /**
     * 指定したidの図形の、指定した頂点インデックスの座標を絶対座標で更新する。
     * 該当図形が存在しない場合は何もしない。頂点インデックスと図形固有プロパティとの
     * 対応関係は関知せず、更新処理自体はshape.setVertex(vertexIndex, x, y)へポリモー
     * フィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。
     * @param {string} id 対象図形のid
     * @param {number} vertexIndex 更新する頂点のインデックス（0: 始点, 1: 終点）
     * @param {number} x 更新後のX座標（論理座標系）
     * @param {number} y 更新後のY座標（論理座標系）
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
     * 指定したidの図形全体を、相対差分(dx, dy)だけ平行移動する。
     * 該当図形が存在しない場合は何もしない。移動処理自体はshape.translate(dx, dy)へ
     * ポリモーフィックに委譲する（図形種別を問わず同一の呼び出しで動作する）。
     * @param {string} id 対象図形のid
     * @param {number} dx X方向の移動差分（論理座標系）
     * @param {number} dy Y方向の移動差分（論理座標系）
     */
    moveShape(id, dx, dy) {
        const shape = this.#shapes.find((s) => s.id === id);
        if (!shape) {
            return;
        }

        shape.translate(dx, dy);

        this.#notifyChange();
    }

    /**
     * 指定したidの図形を#shapesから除去し、変更を通知する。
     * 除去対象が選択中またはホバー中であった場合は、それらの状態も同時にクリアする
     * （存在しない図形のidが選択/ホバー状態に残留することを防ぐため）。
     * 該当図形が存在しない場合は何もしない。
     * @param {string} id 削除する図形のid
     */
    deleteShape(id) {
        const index = this.#shapes.findIndex((s) => s.id === id);
        if (index === -1) {
            return;
        }

        this.#shapes.splice(index, 1);

        if (this.#selectedId === id) {
            this.#selectedId = null;
        }
        if (this.#hoveredId === id) {
            this.#hoveredId = null;
        }

        this.#notifyChange();
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
     * 登録されたすべてのリスナーに変更を通知する。
     * @private
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}
