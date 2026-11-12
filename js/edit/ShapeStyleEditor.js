/**
 * 責務: プロパティパネルの変更を、選択中の図形（塗りは塗れる形だけ）と直前に使った値へ反映する編集操作と、
 * 色の欄のピッカー操作中の記録の確定、パネルが覚えている色の保持を担う。DOMに触れない。
 */
import { buildStylePanelView, parseStrokeWidthInput, toColorInputValue } from './StylePanelRules.js';

/**
 * 色の項目（線・塗り）ごとの対応表。項目による分岐はこの表引きで行う。
 * `shapeKey`は図形の共通プロパティ名（直前に使った値の色のキーも同じ名前）、`enabledKey`は直前に使った値の有無のキー、
 * `selectTargets`は選択中の図形（描画順）から反映の対象を選ぶ関数（塗りは`isFillable()`が真の図形だけ）。
 * @type {Readonly<Record<string, {shapeKey: string, enabledKey: string, selectTargets: (shapes: object[]) => object[]}>>}
 */
const COLOR_ITEMS = Object.freeze({
    stroke: Object.freeze({
        shapeKey: 'strokeColor',
        enabledKey: 'strokeEnabled',
        selectTargets: (shapes) => shapes
    }),
    fill: Object.freeze({
        shapeKey: 'fillColor',
        enabledKey: 'fillEnabled',
        selectTargets: (shapes) => shapes.filter((shape) => shape.isFillable())
    })
});

/**
 * ピッカー操作中の記録（確定するまで履歴に記録せず、図形へ反映した色と開始時の色を保持する）。
 * @typedef {Object} ColorPreview
 * @property {string} target - 色の項目（`'stroke'`・`'fill'`）
 * @property {Array<{shape: object, original: (string|null)}>} entries - 反映した図形のインスタンスと開始時の色
 * @property {string} color - 最後に反映した色（`#rrggbb`）
 */

/**
 * プロパティパネルの変更を反映する編集操作のクラス。
 * 依存の制約：importは`./StylePanelRules.js`のみ。`model`（`getShapes`・`isSelected`・`getNewShapeStyle`・`updateNewShapeStyle`・`updateShapeStyles`だけを使う）と
 * `editRecorder`（`beginEdit()`・`commitEdit()`）は注入で受け取る。知らないこと：DOM・図形種別の分岐・操作モード・`InputTracker`。
 * 図形の共通プロパティのスタイル3つ（`strokeColor`・`strokeWidth`・`fillColor`）は読むが、書き換えは`model.updateShapeStyles`へ渡すだけ。
 * 前提：ドラッグ中（`isDragging()`）を判定しない。判定すると太さの欄に打ち込んで`Enter`を押さずにキャンバスを押したときに入力が失われるため
 * （閾値以前・パン中は編集操作が開いていないので対は崩れない。詳細はRES 5章）。
 * ピッカー操作中の記録の方式：`input`の間は編集操作を開かずに図形へ反映し、確定のときに開始時の色へ戻して
 * `beginEdit()` → 最後の色 → `commitEdit()`の1件として記録する（編集操作を開いたままにしないため、他の操作と対が崩れない）。
 * 確定の契機は`commitColor`・`finishColorPreview`、および他の変更メソッドの冒頭。反映した図形が入れ替わっていれば記録せず捨てる。
 * `getPanelView()`はパネルが覚えている色を更新するため、表示の同期とこのクラスの内部からだけ呼ぶ。
 */
export class ShapeStyleEditor {
    /** @type {object} */
    #model;
    /** @type {{beginEdit: function(): void, commitEdit: function(): boolean}} */
    #editRecorder;
    /** @type {{stroke: string, fill: string}} パネルが覚えている色（色の欄に最後に表示した色） */
    #rememberedColors;
    /** @type {ColorPreview|null} ピッカー操作中の記録 */
    #preview = null;

    /**
     * @param {Object} deps - 依存
     * @param {object} deps.model - `getShapes`・`isSelected`・`getNewShapeStyle`・`updateNewShapeStyle`・`updateShapeStyles`を持つモデル（`VectorModel`）
     * @param {{beginEdit: function(): void, commitEdit: function(): boolean}} deps.editRecorder - 編集操作の記録先（`HistoryManager`）
     */
    constructor({ model, editRecorder }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        const style = model.getNewShapeStyle();
        this.#rememberedColors = { stroke: style.strokeColor, fill: style.fillColor };
    }

    /**
     * パネルに出す内容を求め、色の欄に表示する色（`stroke.color`・`fill.color`）をパネルが覚えている色にする。
     * 表示の同期（`model.onChange`）とこのクラスの内部からだけ呼ぶこと。直前に使った値・図形は変えない。
     * @returns {import('./StylePanelRules.js').StylePanelView} パネルに出す内容
     */
    getPanelView() {
        const view = buildStylePanelView({
            selectedShapes: this.#selectedShapes(),
            newShapeStyle: this.#model.getNewShapeStyle(),
            rememberedColors: { ...this.#rememberedColors }
        });
        this.#rememberedColors = { stroke: view.stroke.color, fill: view.fill.color };
        return view;
    }

    /**
     * 線の有無を変える。
     * @param {boolean} enabled - 線ありか
     * @returns {boolean} 受理したか
     */
    setStrokeEnabled(enabled) {
        return this.#setEnabled('stroke', enabled);
    }

    /**
     * 塗りの有無を変える。選択中の図形があるのに塗れる形が1つも無ければ何もせず`false`。
     * @param {boolean} enabled - 塗りありか
     * @returns {boolean} 受理したか
     */
    setFillEnabled(enabled) {
        return this.#setEnabled('fill', enabled);
    }

    /**
     * 線の太さを変える（線なしの図形を含む選択中の全図形、図形が無ければ直前に使った値だけ）。
     * @param {string} text - 太さの入力（`<input type="number">`の`value`の形）
     * @returns {boolean} 受理したか（`parseStrokeWidthInput`が`null`なら`false`）
     */
    setStrokeWidth(text) {
        this.#finishPreview();
        const width = parseStrokeWidthInput(text);
        if (width === null) {
            return false;
        }
        const shapes = this.#selectedShapes();
        if (shapes.length > 0) {
            this.#recordEdit(() => {
                this.#model.updateShapeStyles(shapes.map((shape) => ({ id: shape.id, style: { strokeWidth: width } })));
            });
        }
        this.#model.updateNewShapeStyle({ strokeWidth: width });
        return true;
    }

    /**
     * ピッカーで色を動かしている間の反映（履歴には記録しない。確定は`commitColor`・`finishColorPreview`・他の変更メソッドの冒頭）。
     * 対象は線＝選択中の全図形、塗り＝その中の塗れる形。図形が無ければ直前に使った値だけを変える。
     * 別の項目、または対象の図形の組が違うピッカー操作中の記録があれば、先に確定してから作り直す。
     * @param {string} target - 色の項目（`'stroke'`・`'fill'`。表に無ければ`false`）
     * @param {string} color - 色（`toColorInputValue`で変換できなければ`false`）
     * @returns {boolean} 受理したか
     */
    previewColor(target, color) {
        if (!Object.hasOwn(COLOR_ITEMS, target)) {
            return false;
        }
        const item = COLOR_ITEMS[target];
        const converted = toColorInputValue(color);
        if (converted === null) {
            return false;
        }
        const shapes = this.#selectedShapes();
        const targets = item.selectTargets(shapes);
        if (this.#preview !== null && !this.#isSamePreview(target, targets)) {
            this.#finishPreview();
        }
        if (shapes.length === 0) {
            this.#model.updateNewShapeStyle({ [item.shapeKey]: converted, [item.enabledKey]: true });
            return true;
        }
        if (targets.length === 0) {
            return false;
        }
        if (this.#preview === null) {
            this.#preview = {
                target,
                entries: targets.map((shape) => ({ shape, original: shape[item.shapeKey] })),
                color: converted
            };
        }
        this.#preview.color = converted;
        this.#model.updateShapeStyles(targets.map((shape) => ({ id: shape.id, style: { [item.shapeKey]: converted } })));
        this.#model.updateNewShapeStyle({ [item.shapeKey]: converted, [item.enabledKey]: true });
        return true;
    }

    /**
     * ピッカーを閉じたときの確定（`previewColor`の後にピッカー操作中の記録を確定する）。
     * @param {string} target - 色の項目（`'stroke'`・`'fill'`）
     * @param {string} color - 色
     * @returns {boolean} 受理したか
     */
    commitColor(target, color) {
        const accepted = this.previewColor(target, color);
        this.#finishPreview();
        return accepted;
    }

    /**
     * ピッカー操作中の記録があれば確定する（色の欄の`blur`・`keydown`の契機。無ければ何もしない）。
     */
    finishColorPreview() {
        this.#finishPreview();
    }

    /**
     * 線・塗りの有無を変える共通の処理。
     * @param {string} target - 色の項目（`'stroke'`・`'fill'`）
     * @param {boolean} enabled - 有無
     * @returns {boolean} 受理したか
     */
    #setEnabled(target, enabled) {
        this.#finishPreview();
        const item = COLOR_ITEMS[target];
        const shapes = this.#selectedShapes();
        if (shapes.length > 0) {
            const targets = item.selectTargets(shapes);
            if (targets.length === 0) {
                return false;
            }
            const color = enabled ? this.getPanelView()[target].color : null;
            this.#recordEdit(() => {
                this.#model.updateShapeStyles(targets.map((shape) => ({ id: shape.id, style: { [item.shapeKey]: color } })));
            });
        }
        this.#model.updateNewShapeStyle({ [item.enabledKey]: enabled });
        return true;
    }

    /**
     * 選択中の図形を描画順で返す。
     * @returns {object[]} 選択中の図形
     */
    #selectedShapes() {
        return this.#model.getShapes().filter((shape) => this.#model.isSelected(shape.id));
    }

    /**
     * ピッカー操作中の記録が、指定の項目・対象の図形の組と同じか。
     * @param {string} target - 色の項目
     * @param {object[]} targets - 今の対象の図形
     * @returns {boolean} 同じならtrue
     */
    #isSamePreview(target, targets) {
        const preview = this.#preview;
        return preview.target === target
            && preview.entries.length === targets.length
            && preview.entries.every((entry, index) => entry.shape === targets[index]);
    }

    /**
     * ピッカー操作中の記録を確定する。無ければ何もしない。
     * 記録した図形が1つでも現在の図形に無ければ（入れ替わった）記録せず捨てる。
     * 残っていれば、開始時の色へ戻し、`beginEdit()` → 最後の色 → `commitEdit()`の1件として記録する。
     */
    #finishPreview() {
        const preview = this.#preview;
        if (preview === null) {
            return;
        }
        this.#preview = null;
        const { shapeKey } = COLOR_ITEMS[preview.target];
        const current = new Set(this.#model.getShapes());
        if (!preview.entries.every((entry) => current.has(entry.shape))) {
            return;
        }
        this.#model.updateShapeStyles(preview.entries.map((entry) => ({ id: entry.shape.id, style: { [shapeKey]: entry.original } })));
        this.#recordEdit(() => {
            this.#model.updateShapeStyles(preview.entries.map((entry) => ({ id: entry.shape.id, style: { [shapeKey]: preview.color } })));
        });
    }

    /**
     * 変更を`beginEdit()`と`commitEdit()`で挟んで1件として記録する。
     * @param {function(): void} apply - 図形へ反映する処理
     */
    #recordEdit(apply) {
        this.#editRecorder.beginEdit();
        apply();
        this.#editRecorder.commitEdit();
    }
}
