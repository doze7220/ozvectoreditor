/**
 * 責務：変形の数値入力の設定（基準点・縦横比の鍵）の保持・切り替え・変更通知のみを担う。
 * DOM・VectorModel・InputTracker・図形に依存しない（基準点の名前の判定のため ReferencePointRules だけをimportする）。
 */
import { DEFAULT_REFERENCE_POINT, isReferencePoint } from './ReferencePointRules.js';

/**
 * @typedef {Object} TransformInputSettingsSnapshot
 * @property {string} referencePoint - 基準点の名前（REFERENCE_POINT の値）
 * @property {boolean} aspectLocked - 縦横比の鍵がかかっているか
 */

/**
 * 基準点と縦横比の鍵を保持するクラス。作業データ・履歴・書き出し・ブラウザの保存先には含まれず、
 * VectorModel に持たせない。取り消し/やり直しの対象でもない。アプリ全体で1つ（main.js だけが生成する）で、
 * キャンバスの切り替え・選択の変更・取り消し/やり直しでは触れない。ページを開き直すと初期値（中心・鍵は外れている）に戻る。
 */
export class TransformInputSettings {
    /**
     * @type {string} 基準点の名前（初期値は中心）
     * @private
     */
    #referencePoint = DEFAULT_REFERENCE_POINT;

    /**
     * @type {boolean} 縦横比の鍵がかかっているか（初期値は外れている）
     * @private
     */
    #aspectLocked = false;

    /**
     * @type {Array<Function>} 変更を通知するコールバック関数の配列
     * @private
     */
    #listeners = [];

    /**
     * 設定のスナップショットを取得する（呼び出しごとに新しいプレーンオブジェクトを返す）。
     * @returns {TransformInputSettingsSnapshot}
     */
    getState() {
        return {
            referencePoint: this.#referencePoint,
            aspectLocked: this.#aspectLocked,
        };
    }

    /**
     * 今の基準点の名前を返す。
     * @returns {string} REFERENCE_POINT の値
     */
    getReferencePoint() {
        return this.#referencePoint;
    }

    /**
     * 縦横比の鍵がかかっているかを返す。
     * @returns {boolean}
     */
    isAspectLocked() {
        return this.#aspectLocked;
    }

    /**
     * 基準点を設定する。基準点の名前でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {string} value - REFERENCE_POINT の値
     * @returns {void}
     */
    setReferencePoint(value) {
        if (!isReferencePoint(value)) {
            console.warn(`TransformInputSettings.setReferencePoint: 未知の基準点が指定されました: ${value}`);
            return;
        }
        if (value === this.#referencePoint) return;
        this.#referencePoint = value;
        this.#notifyChange();
    }

    /**
     * 縦横比の鍵を設定する。真偽値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {boolean} value - かけるならtrue
     * @returns {void}
     */
    setAspectLocked(value) {
        if (typeof value !== 'boolean') {
            console.warn(`TransformInputSettings.setAspectLocked: 真偽値ではない値が指定されました: ${value}`);
            return;
        }
        if (value === this.#aspectLocked) return;
        this.#aspectLocked = value;
        this.#notifyChange();
    }

    /**
     * 縦横比の鍵を反転する（通知1回）。
     * @returns {void}
     */
    toggleAspectLock() {
        this.setAspectLocked(!this.#aspectLocked);
    }

    /**
     * 変更通知のコールバックを登録する。関数以外は無視する。
     * @param {Function} callback - 変更のたびに引数なしで呼ばれる関数
     * @returns {void}
     */
    onChange(callback) {
        if (typeof callback !== 'function') return;
        this.#listeners.push(callback);
    }

    /**
     * 登録済みのコールバックをすべて呼ぶ。
     * @returns {void}
     * @private
     */
    #notifyChange() {
        for (const listener of this.#listeners) {
            listener();
        }
    }
}
