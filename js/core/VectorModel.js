/**
 * 責務：図形データの状態管理（SSOT：Single Source of Truth）と更新通知を担う。
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

    constructor() {
        this.#shapes = [];
        this.#listeners = [];
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
