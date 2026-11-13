/**
 * 責務: スポイトの待ち受けの状態（待ち受け中か）の保持と変更の通知、手本の図形からスタイルを取り込んで反映する手順を担う。
 * DOM・操作モード・InputTracker・ボタンを知らない。状態は作業データ・履歴・VectorModelに入れない。
 */
import { sampleStyleFromShape } from './StylePanelRules.js';

/**
 * スポイト（クリックした図形のスタイルを取り込む操作）の待ち受けの持ち主と、取り込みの手順を担うクラス。
 *
 * 知らないこと:
 *   - DOM・ボタン・操作モード・InputTracker（待ち受け中のクリックの受け渡しはmain.jsが注入する関数が仲立ちする）。
 *   - 図形のスタイルの反映の仕方（注入された applyStyle へ取り込んだ値を渡すだけ。実体はShapeStyleEditor.applyStyle）。
 *
 * 状態:
 *   - 「待ち受け中か」の真偽値だけを持つ。作業データ・履歴のスナップショット・VectorModel・ブラウザの保存先には入れない。
 *   - 待ち受けの変化（start・stop・取り込み）のたびに、onChangeで登録された関数へ通知する。
 *
 * 依存の制約:
 *   - importは ./StylePanelRules.js の sampleStyleFromShape のみ（edit/内の例外）。
 *   - modelはgetShapes()だけ使う。
 */
export class StyleEyedropper {
    /**
     * 図形一式の読み取り元（getShapesのみ使用）。
     * @type {{ getShapes: () => Array<Object> }}
     */
    #model;

    /**
     * 取り込んだスタイルを反映する関数（実体はmain.jsが注入するshapeStyleEditor.applyStyleの呼び出し）。
     * @type {(style: Object) => boolean}
     */
    #applyStyle;

    /**
     * 待ち受け中か。
     * @type {boolean}
     */
    #picking = false;

    /**
     * 待ち受けの変化の通知先。
     * @type {Array<() => void>}
     */
    #listeners = [];

    /**
     * @param {Object} deps 依存
     * @param {{ getShapes: () => Array<Object> }} deps.model 図形一式の読み取り元（getShapesのみ使用）
     * @param {(style: Object) => boolean} deps.applyStyle 取り込んだスタイル（StyleApplication）を反映する関数
     * @throws {Error} applyStyleが関数でないとき
     */
    constructor({ model, applyStyle } = {}) {
        if (typeof applyStyle !== 'function') {
            throw new Error('StyleEyedropper: applyStyle は関数である必要があります');
        }
        this.#model = model;
        this.#applyStyle = applyStyle;
    }

    /**
     * 待ち受け中かどうかを返す。
     * @returns {boolean} 待ち受け中ならtrue
     */
    isPicking() {
        return this.#picking;
    }

    /**
     * 待ち受けを始める。すでに待ち受け中なら何もしない。
     * @returns {boolean} 待ち受けを始めたらtrue（すでに待ち受け中ならfalse。通知もしない）
     */
    start() {
        if (this.#picking) {
            return false;
        }
        this.#picking = true;
        this.#notify();
        return true;
    }

    /**
     * 待ち受けをやめる。待ち受け中でなければ何もしない。
     * @returns {boolean} 待ち受けをやめたらtrue（待ち受け中でなければfalse。通知もしない）
     */
    stop() {
        if (!this.#picking) {
            return false;
        }
        this.#picking = false;
        this.#notify();
        return true;
    }

    /**
     * Escキー用。待ち受け中なら待ち受けだけをやめてtrueを返し、そうでなければfallbackを呼んでその戻り値を返す
     * （待ち受けかどうかの判定をmain.jsに置かないため）。
     * @param {() => boolean} fallback 待ち受け中でないときに呼ぶ関数
     * @returns {boolean} 待ち受け中だったときはtrue。そうでなければfallbackの戻り値
     */
    cancelPicking(fallback) {
        if (this.stop()) {
            return true;
        }
        return fallback();
    }

    /**
     * 待ち受け中にクリックされた図形のスタイルを取り込んで反映し、待ち受けをやめる。
     * 待ち受けでなければ何もしない。idの図形が無ければ何もせず待ち受けは続く（通知なし）。
     * @param {string} shapeId 手本にする図形のid
     * @returns {boolean} 取り込んだらtrue（待ち受けでない・図形が無いときはfalse）
     */
    pickFrom(shapeId) {
        if (!this.#picking) {
            return false;
        }
        const shape = this.#model.getShapes().find((s) => s.id === shapeId);
        if (!shape) {
            return false;
        }
        this.#applyStyle(sampleStyleFromShape(shape));
        this.stop();
        return true;
    }

    /**
     * 待ち受けの変化の通知先を登録する。関数でなければ無視する。
     * @param {() => void} callback 待ち受けが変わるたびに呼ばれる関数
     * @returns {void}
     */
    onChange(callback) {
        if (typeof callback !== 'function') {
            return;
        }
        this.#listeners.push(callback);
    }

    /**
     * 登録された通知先を呼ぶ。
     * @returns {void}
     */
    #notify() {
        for (const callback of this.#listeners) {
            callback();
        }
    }
}
