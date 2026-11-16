/**
 * 責務: スプライトの外枠を描画先の余白の内側へ収めて中央に置くための倍率と平行移動を求める（状態・DOMを持たない規則）。
 */

/**
 * 値が有限の数かを返す。
 * @param {*} v 検査する値
 * @returns {boolean} 有限の数ならtrue
 */
function isFiniteNumber(v) {
    return typeof v === 'number' && Number.isFinite(v);
}

/**
 * スプライトの外枠を、余白の内側へ収めて中央に置くための倍率と平行移動を求める。
 * スクリーン = ワールド × scale + offset（ViewTransform・ViewFitRulesと同じ向き）。
 * 拡大も行い、倍率の上限・下限は設けない。外枠の幅・高さが0の軸は倍率の制約にしない（両方0なら scale = 1）。
 * bounds が null・オブジェクトでない・値が有限でない・最小が最大を超える場合、
 * width/height が有限の正の数でない場合、padding が有限の0以上でない場合、
 * 余白を引いた領域が0以下の場合は null を返す。
 * 引数は書き換えず、戻り値は毎回新しいオブジェクトである。
 * @param {{minX:number, minY:number, maxX:number, maxY:number}|null} bounds スプライトの外枠
 * @param {number} width 描画先の幅
 * @param {number} height 描画先の高さ
 * @param {number} [padding=0] 四辺の余白
 * @returns {{scale:number, offsetX:number, offsetY:number}|null} 倍率と平行移動。求められなければ null
 */
export function computeSpriteFitTransform(bounds, width, height, padding = 0) {
    if (bounds === null || typeof bounds !== 'object') return null;
    const { minX, minY, maxX, maxY } = bounds;
    if (!isFiniteNumber(minX) || !isFiniteNumber(minY) || !isFiniteNumber(maxX) || !isFiniteNumber(maxY)) return null;
    if (minX > maxX || minY > maxY) return null;
    if (!isFiniteNumber(width) || width <= 0 || !isFiniteNumber(height) || height <= 0) return null;
    if (!isFiniteNumber(padding) || padding < 0) return null;
    const availW = width - padding * 2;
    const availH = height - padding * 2;
    if (!(availW > 0) || !(availH > 0)) return null;

    const bw = maxX - minX;
    const bh = maxY - minY;
    let scale = 1;
    if (bw > 0 && bh > 0) {
        scale = Math.min(availW / bw, availH / bh);
    } else if (bw > 0) {
        scale = availW / bw;
    } else if (bh > 0) {
        scale = availH / bh;
    }
    const offsetX = padding + (availW - bw * scale) / 2 - minX * scale;
    const offsetY = padding + (availH - bh * scale) / 2 - minY * scale;
    return { scale, offsetX, offsetY };
}
