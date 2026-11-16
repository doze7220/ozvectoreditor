/**
 * 責務：ツールパレットの「選択」「頂点の選択」のボタンへ、スプライトJS（asset/sprite/）を描いた`<canvas>`を入れる配線。
 * 判定・計算の規則は持たない（収める計算はSpriteFitRules、絵はスプライトJSのdraw）。
 */
import selectArrow from '../../asset/sprite/select-arrow.js';
import vertexArrow from '../../asset/sprite/vertex-arrow.js';
import { computeSpriteFitTransform } from '../core/SpriteFitRules.js';
import { OperationMode } from '../core/InputModes.js';

/** アイコンの`<canvas>`のCSSピクセルでの一辺の長さ（ボタンは32×32のまま）。 */
const ICON_CANVAS_SIZE = 20;
/** アイコンの外枠と`<canvas>`の縁との余白（CSSピクセル）。 */
const ICON_CANVAS_PADDING = 1;

/**
 * 1つのボタンへスプライトを描いた`<canvas>`を入れる。要素が無ければ`console.warn`して何もしない。
 * @param {string} buttonId ボタンのid。
 * @param {{bounds: object, draw: function(CanvasRenderingContext2D): void}} sprite スプライトJSの既定のexport。
 * @returns {void}
 */
function drawIconInto(buttonId, sprite) {
    const button = document.getElementById(buttonId);
    if (!button) {
        console.warn(`ToolIconWiring: #${buttonId} が見つかりません。アイコンを描きません。`);
        return;
    }
    button.textContent = '';
    const canvas = document.createElement('canvas');
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(ICON_CANVAS_SIZE * dpr);
    canvas.height = Math.round(ICON_CANVAS_SIZE * dpr);
    canvas.style.width = `${ICON_CANVAS_SIZE}px`;
    canvas.style.height = `${ICON_CANVAS_SIZE}px`;
    button.appendChild(canvas);
    const fit = computeSpriteFitTransform(sprite.bounds, ICON_CANVAS_SIZE, ICON_CANVAS_SIZE, ICON_CANVAS_PADDING);
    if (fit === null) return;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr * fit.scale, 0, 0, dpr * fit.scale, dpr * fit.offsetX, dpr * fit.offsetY);
    sprite.draw(ctx);
}

/**
 * ツールパレットの選択・頂点の選択のボタンへアイコンを描く。起動時に1回だけ呼ぶ。
 * @returns {void}
 */
export function drawToolIcons() {
    drawIconInto(`tool-${OperationMode.SELECT}`, selectArrow);
    drawIconInto(`tool-${OperationMode.VERTEX}`, vertexArrow);
}
