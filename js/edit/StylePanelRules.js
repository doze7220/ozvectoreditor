/**
 * 責務: プロパティパネルの「図形」の段に出す値の算出（そろっている値・混在・無効・表示する色）と、色の文字列の表示用の変換・線の太さの入力の受理を担う。
 * 状態を持たずDOMに触れない。importを持たない。
 */

/** @type {number} 線の太さの下限（整数。パネルの太さの入力の受理範囲） */
export const STROKE_WIDTH_MIN = 1;

/** @type {number} 線の太さの上限（整数。パネルの太さの入力の受理範囲） */
export const STROKE_WIDTH_MAX = 100;

/** 色の文字列（16進6桁）の形 */
const HEX6_PATTERN = /^#[0-9a-fA-F]{6}$/;

/** 色の文字列（16進3桁）の形 */
const HEX3_PATTERN = /^#[0-9a-fA-F]{3}$/;

/**
 * 色の欄の表示の補足。`''`＝なし、`'mixed'`＝混在、`'unsupported'`＝表示できない色。
 * @typedef {'' | 'mixed' | 'unsupported'} ColorNote
 */

/**
 * 線・塗りの1項目の表示内容。
 * `enabled`の`null`は中間表示（`indeterminate`）、`color`は色の欄にそのまま入れる`#rrggbb`（小文字）、
 * `disabled`は欄を無効にするか（線は常に`false`。塗りは塗れる形が選択中に1つも無いとき`true`）。
 * @typedef {Object} StylePanelColorView
 * @property {boolean|null} enabled - 有無（`null`＝混在）
 * @property {string} color - 色の欄に入れる`#rrggbb`
 * @property {ColorNote} colorNote - 色の欄の横の表示
 * @property {boolean} disabled - 欄を無効にするか
 */

/**
 * パネルに出す内容（`palette/PropertyShapeSection.js`の同名typedefと同じ内容の二重定義。形を変えるときは両方を揃える）。
 * @typedef {Object} StylePanelView
 * @property {'selection'|'newShape'} source - 選択中の図形を表示しているか・次に描く図形を表示しているか
 * @property {number} selectedCount - 選択中の図形の数（`'newShape'`では0）
 * @property {StylePanelColorView} stroke - 線の表示
 * @property {number|null} strokeWidth - 線の太さ（`null`＝混在）
 * @property {StylePanelColorView} fill - 塗りの表示
 */

/**
 * パネルが覚えている色（色の欄に最後に表示した色）。
 * @typedef {Object} RememberedColors
 * @property {string} stroke - 線の色（`#rrggbb`）
 * @property {string} fill - 塗りの色（`#rrggbb`）
 */

/**
 * 直前に使った値（`core/VectorModel.js`の`NewShapeStyle`と同じ形。本モジュールはimportしないため必要な形だけ再掲する）。
 * @typedef {Object} PanelNewShapeStyle
 * @property {boolean} strokeEnabled - 線ありか
 * @property {string} strokeColor - 線の色
 * @property {number} strokeWidth - 線の太さ
 * @property {boolean} fillEnabled - 塗りありか
 * @property {string} fillColor - 塗りの色
 */

/**
 * 色の文字列を`<input type="color">`に入れられる`#rrggbb`（小文字）へ変換する。
 * `#rrggbb`は小文字化、`#rgb`は各桁を2回並べて展開する。それ以外（色名・`rgb(...)`・`#rrggbbaa`・`#rgba`・空文字・文字列でない値）は
 * DOMなしでは解釈できないため変換しない。
 * @param {*} color - 色の値
 * @returns {string|null} `#rrggbb`（小文字）。変換できなければ`null`
 */
export function toColorInputValue(color) {
    if (typeof color !== 'string') {
        return null;
    }
    if (HEX6_PATTERN.test(color)) {
        return color.toLowerCase();
    }
    if (HEX3_PATTERN.test(color)) {
        const [, r, g, b] = color.toLowerCase();
        return `#${r}${r}${g}${g}${b}${b}`;
    }
    return null;
}

/**
 * 線の太さの入力（`<input type="number">`の`value`の形の文字列）を受理する。
 * 前後の空白を除いて空でなく、`Number`で整数になり、`STROKE_WIDTH_MIN`以上`STROKE_WIDTH_MAX`以下なら受理する（`'1.0'`・`'1e1'`は整数として受理）。
 * @param {*} text - 入力の値
 * @returns {number|null} 受理した太さ。受理しなければ`null`
 */
export function parseStrokeWidthInput(text) {
    if (typeof text !== 'string') {
        return null;
    }
    const trimmed = text.trim();
    if (trimmed === '') {
        return null;
    }
    const value = Number(trimmed);
    if (!Number.isInteger(value) || value < STROKE_WIDTH_MIN || value > STROKE_WIDTH_MAX) {
        return null;
    }
    return value;
}

/**
 * 図形の配列から、色の項目（線または塗り）の有無・表示する色・補足を決める（線と塗りで共有する）。
 * 有無は、全図形が文字列なら`true`・全図形が文字列でなければ`false`・混在なら`null`。
 * 色は文字列の図形だけで決め、1つも無ければ`remembered`、あれば最も手前（配列の最後）の図形の色の変換結果（変換できなければ`remembered`）。
 * 補足は、色の文字列の種類（完全一致）が2つ以上なら`'mixed'`、1つで変換できなければ`'unsupported'`、それ以外は`''`。
 * 図形は書き換えない。
 * @param {object[]} shapes - 対象の図形（描画順。1個以上）
 * @param {'strokeColor'|'fillColor'} key - 読む図形のプロパティ名
 * @param {string} remembered - パネルが覚えている色（`#rrggbb`）
 * @returns {{enabled: boolean|null, color: string, colorNote: ColorNote}} 決めた内容
 */
function resolveColorView(shapes, key, remembered) {
    const colors = shapes.map((shape) => shape[key]).filter((color) => typeof color === 'string');
    let enabled = null;
    if (colors.length === shapes.length) {
        enabled = true;
    } else if (colors.length === 0) {
        enabled = false;
    }
    if (colors.length === 0) {
        return { enabled, color: remembered, colorNote: '' };
    }
    const converted = toColorInputValue(colors[colors.length - 1]);
    let colorNote = '';
    if (new Set(colors).size >= 2) {
        colorNote = 'mixed';
    } else if (converted === null) {
        colorNote = 'unsupported';
    }
    return { enabled, color: converted ?? remembered, colorNote };
}

/**
 * 直前に使った値の1項目（有無と色）を、そのままパネルの表示内容にする。
 * @param {boolean} enabled - 有無
 * @param {string} color - 色の文字列
 * @param {string} remembered - 変換できないときに表示する、パネルが覚えている色
 * @returns {StylePanelColorView} 表示内容
 */
function newShapeColorView(enabled, color, remembered) {
    return { enabled, color: toColorInputValue(color) ?? remembered, colorNote: '', disabled: false };
}

/**
 * パネルに出す内容を求める（DOMに触れない純粋な関数。引数を書き換えない）。
 * 図形を1個以上選んでいるとき（`source: 'selection'`）は選択中の図形から、選んでいないとき（`'newShape'`）は直前に使った値から決める。
 * 太さは線の有無にかかわらず全図形の`strokeWidth`が`===`でそろえばその値、違えば`null`。
 * 塗りは`isFillable()`が真の図形だけで決め、1つも無ければ無効（`disabled: true`・`enabled: false`・`color: rememberedColors.fill`）。
 * 読むのは図形の共通プロパティ`strokeColor`・`strokeWidth`・`fillColor`と`isFillable()`だけ。
 * @param {Object} params - 引数
 * @param {object[]} params.selectedShapes - 選択中の図形（描画順＝重なり順で最も手前が最後）
 * @param {PanelNewShapeStyle} params.newShapeStyle - 直前に使った値
 * @param {RememberedColors} params.rememberedColors - パネルが覚えている色
 * @returns {StylePanelView} パネルに出す内容
 */
export function buildStylePanelView({ selectedShapes, newShapeStyle, rememberedColors }) {
    if (selectedShapes.length === 0) {
        return {
            source: 'newShape',
            selectedCount: 0,
            stroke: newShapeColorView(newShapeStyle.strokeEnabled, newShapeStyle.strokeColor, rememberedColors.stroke),
            strokeWidth: newShapeStyle.strokeWidth,
            fill: newShapeColorView(newShapeStyle.fillEnabled, newShapeStyle.fillColor, rememberedColors.fill),
        };
    }
    const firstWidth = selectedShapes[0].strokeWidth;
    const strokeWidth = selectedShapes.every((shape) => shape.strokeWidth === firstWidth) ? firstWidth : null;
    const fillableShapes = selectedShapes.filter((shape) => shape.isFillable());
    const fill = fillableShapes.length === 0
        ? { enabled: false, color: rememberedColors.fill, colorNote: '', disabled: true }
        : { ...resolveColorView(fillableShapes, 'fillColor', rememberedColors.fill), disabled: false };
    return {
        source: 'selection',
        selectedCount: selectedShapes.length,
        stroke: { ...resolveColorView(selectedShapes, 'strokeColor', rememberedColors.stroke), disabled: false },
        strokeWidth,
        fill,
    };
}
