/**
 * 責務：スナップ（座標・移動量を単位の倍数へ丸めること。端点への吸い付きとは別）の設定（ON/OFF・単位）の保持・切り替え・変更通知のみを担う。
 * DOM・VectorModel・InputTracker・図形に依存しない（importなし。DisplayStateと同じ位置づけ）。
 */

/**
 * スナップの単位の識別子。
 * @readonly
 * @enum {string}
 */
export const UnitSnapUnit = Object.freeze({
    PIXEL: 'pixel',
    GRID: 'grid',
});

/**
 * 単位ごとの刻み（ワールド座標の長さ）。単位の値の唯一の定義箇所。
 * グリッドの10は表示倍率で変わらない固定値で、画面のグリッドの線の間隔の規則（GridSpacingRules.js の computeGridSpacing）とは別の定義。
 * 表示倍率80%未満では画面の細線は100px間隔になり一致しない。GridSpacingRules.js はimportしない。
 * @type {Readonly<{pixel: number, grid: number}>}
 */
export const UNIT_SNAP_STEPS = Object.freeze({
    pixel: 1,
    grid: 10,
});

/**
 * @typedef {Object} UnitSnapSettingsSnapshot
 * @property {boolean} enabled - スナップがONか
 * @property {'pixel'|'grid'} unit - 今の単位
 * @property {number} unitStep - 今の単位の値（OFFでも入る。部品の文字に使う）
 */

/**
 * スナップの設定を保持するクラス。作業データ・履歴・ブラウザの保存先には含まれず、取り消し/やり直しの対象でもない
 * （ページを開き直すと初期値（ON・1px）に戻る）。main.js だけが1つ生成する。
 */
export class UnitSnapSettings {
    /**
     * @type {boolean} スナップがONか（ページを開いたときはON）
     * @private
     */
    #enabled = true;

    /**
     * @type {string} 今の単位（UnitSnapUnit の値。初期値は1px）
     * @private
     */
    #unit = UnitSnapUnit.PIXEL;

    /**
     * @type {Array<Function>} 変更を通知するコールバック関数の配列
     * @private
     */
    #listeners = [];

    /**
     * 設定のスナップショットを取得する（呼び出しごとに新しいプレーンオブジェクトを返す）。
     * @returns {UnitSnapSettingsSnapshot}
     */
    getState() {
        return {
            enabled: this.#enabled,
            unit: this.#unit,
            unitStep: UNIT_SNAP_STEPS[this.#unit],
        };
    }

    /**
     * 今効いている刻みを返す。UnitSnapRules の関数へそのまま渡せる。
     * @returns {number|null} ONなら今の単位の値、OFFなら null（丸めない）
     */
    getActiveStep() {
        return this.#enabled ? UNIT_SNAP_STEPS[this.#unit] : null;
    }

    /**
     * スナップのON/OFFを設定する。真偽値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {boolean} value - ONならtrue
     * @returns {void}
     */
    setEnabled(value) {
        if (typeof value !== 'boolean') {
            console.warn(`UnitSnapSettings.setEnabled: 真偽値ではない値が指定されました: ${value}`);
            return;
        }
        if (value === this.#enabled) return;
        this.#enabled = value;
        this.#notifyChange();
    }

    /**
     * スナップのON/OFFを反転する（通知1回）。
     * @returns {void}
     */
    toggleEnabled() {
        this.setEnabled(!this.#enabled);
    }

    /**
     * スナップの単位を設定する。UnitSnapUnit の値でなければ警告して何もしない。値が変わらなければ通知しない。
     * @param {string} unit - UnitSnapUnit の値
     * @returns {void}
     */
    setUnit(unit) {
        if (unit !== UnitSnapUnit.PIXEL && unit !== UnitSnapUnit.GRID) {
            console.warn(`UnitSnapSettings.setUnit: 未知の単位が指定されました: ${unit}`);
            return;
        }
        if (unit === this.#unit) return;
        this.#unit = unit;
        this.#notifyChange();
    }

    /**
     * 単位を1px⇄グリッドで入れ替える（通知1回）。ON/OFFは変えない。
     * @returns {void}
     */
    toggleUnit() {
        this.setUnit(this.#unit === UnitSnapUnit.PIXEL ? UnitSnapUnit.GRID : UnitSnapUnit.PIXEL);
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
