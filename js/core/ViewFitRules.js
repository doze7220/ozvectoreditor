/**
 * 責務：ワールド座標の範囲を、指定した大きさの領域に余白を空けて収める表示倍率とオフセットの計算（純粋な規則。DOM・状態を持たない）。
 */

/**
 * 画面上の余白（CSSピクセル。領域の各辺）。
 * @type {number}
 */
export const FIT_VIEW_MARGIN_PX = 40;

/**
 * ワールド座標の範囲。
 * @typedef {Object} FitBounds
 * @property {number} minX 最小X
 * @property {number} minY 最小Y
 * @property {number} maxX 最大X
 * @property {number} maxY 最大Y
 */

/**
 * 範囲を領域に収める表示倍率とオフセットを求める。
 * 範囲の中心が領域の中心に写り、倍率は`minScale`〜`maxScale`に収める。
 * 範囲が`null`（図形0個）なら、倍率1・原点が領域の中心になる値を返す。
 * 領域が余白より小さい場合も例外を投げず、倍率は`minScale`になる。
 * @param {FitBounds|null} bounds ワールド座標の範囲（図形0個なら`null`）
 * @param {number} viewportWidth 領域の幅（CSSピクセル）
 * @param {number} viewportHeight 領域の高さ（CSSピクセル）
 * @param {Object} options オプション
 * @param {number} options.minScale 表示倍率の下限
 * @param {number} options.maxScale 表示倍率の上限
 * @param {number} [options.margin=FIT_VIEW_MARGIN_PX] 画面上の余白（CSSピクセル。各辺）
 * @returns {{scale: number, offsetX: number, offsetY: number}} 表示倍率とオフセット（CSSピクセル）
 */
export function computeFitView(bounds, viewportWidth, viewportHeight, { minScale, maxScale, margin = FIT_VIEW_MARGIN_PX }) {
    if (bounds === null) {
        return { scale: 1, offsetX: viewportWidth / 2, offsetY: viewportHeight / 2 };
    }

    const w = bounds.maxX - bounds.minX;
    const h = bounds.maxY - bounds.minY;
    const availW = viewportWidth - 2 * margin;
    const availH = viewportHeight - 2 * margin;

    const candidates = [];
    if (w > 0) {
        candidates.push(availW / w);
    }
    if (h > 0) {
        candidates.push(availH / h);
    }
    let scale = candidates.length > 0 ? Math.min(...candidates) : 1;
    if (!Number.isFinite(scale)) {
        scale = 1;
    }
    scale = Math.min(Math.max(scale, minScale), maxScale);

    const cx = (bounds.minX + bounds.maxX) / 2;
    const cy = (bounds.minY + bounds.maxY) / 2;
    return {
        scale,
        offsetX: viewportWidth / 2 - cx * scale,
        offsetY: viewportHeight / 2 - cy * scale
    };
}
