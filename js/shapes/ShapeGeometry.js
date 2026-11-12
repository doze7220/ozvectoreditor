/**
 * 責務: 図形クラスが当たり判定・範囲選択で共通に使う幾何の計算（点と線分の距離・線分と軸平行矩形の交差・2次ベジェ曲線の点・
 * 多角形の内側の判定（nonzero））を、状態を持たない関数として提供する。
 */

/**
 * 線分（ワールド座標）と軸平行矩形（ワールド座標・正規化済み・境界含む）の交差判定（Liang–Barsky法）。
 * 矩形は正規化済み（minX ≤ maxX かつ minY ≤ maxY）が前提。
 * 長さ0の線分は点の内包判定となる（全組でp === 0となり除算しないため0除算は起きない）。
 * 例外は投げない。
 * @param {number} ax - 線分始点のX座標（ワールド座標）
 * @param {number} ay - 線分始点のY座標（ワールド座標）
 * @param {number} bx - 線分終点のX座標（ワールド座標）
 * @param {number} by - 線分終点のY座標（ワールド座標）
 * @param {number} minX - 矩形の左端X座標（ワールド座標）
 * @param {number} minY - 矩形の上端Y座標（ワールド座標）
 * @param {number} maxX - 矩形の右端X座標（ワールド座標）
 * @param {number} maxY - 矩形の下端Y座標（ワールド座標）
 * @returns {boolean} 線分の一部でも矩形（境界含む）内にあればtrue
 */
export function segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY) {
    const dx = bx - ax;
    const dy = by - ay;
    let t0 = 0;
    let t1 = 1;
    const pairs = [
        [-dx, ax - minX],
        [dx, maxX - ax],
        [-dy, ay - minY],
        [dy, maxY - ay],
    ];

    for (const [p, q] of pairs) {
        if (p === 0) {
            if (q < 0) return false; // 平行かつ外側
            continue; // 除算しない
        }
        const r = q / p;
        if (p < 0) {
            if (r > t1) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0) return false;
            if (r < t1) t1 = r;
        }
    }
    return true;
}

/**
 * 点(px, py)と線分(ax, ay)-(bx, by)との最短距離を求める。
 * 長さ0の線分は点(ax, ay)までの距離となる（0除算しない）。例外は投げない。
 * @param {number} px - 判定対象点のX座標
 * @param {number} py - 判定対象点のY座標
 * @param {number} ax - 線分始点のX座標
 * @param {number} ay - 線分始点のY座標
 * @param {number} bx - 線分終点のX座標
 * @param {number} by - 線分終点のY座標
 * @returns {number} 点と線分の最短距離
 */
export function distanceToSegment(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSquared = dx * dx + dy * dy;

    let t = lengthSquared === 0
        ? 0
        : ((px - ax) * dx + (py - ay) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const closestX = ax + t * dx;
    const closestY = ay + t * dy;
    const distX = px - closestX;
    const distY = py - closestY;

    return Math.sqrt(distX * distX + distY * distY);
}

/**
 * 2次ベジェ曲線 B(t) = (1−t)^2 P0 + 2(1−t)t P1 + t^2 P2 上の点を求める。
 * tは0〜1を想定するが、範囲外も式どおりに計算し検査しない。例外は投げない。
 * @param {{x: number, y: number}} p0 - 始点
 * @param {{x: number, y: number}} p1 - 制御点
 * @param {{x: number, y: number}} p2 - 終点
 * @param {number} t - 曲線上の位置（0〜1を想定）
 * @returns {{x: number, y: number}} 曲線上の点（呼び出しごとに新しいオブジェクト）
 */
export function quadraticBezierPoint(p0, p1, p2, t) {
    const oneMinusT = 1 - t;
    return {
        x: oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x,
        y: oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y,
    };
}

/**
 * 点(px, py)が多角形の内側にあるかを、nonzero規則（巻き数が0でなければ内側。Canvasの引数なしfill()と同じ）で判定する。
 * pointsは「最後の頂点から最初の頂点へ戻る辺を常に含む閉じた多角形」として扱う（呼び出し側は始点を重複させない）。
 * 自己交差する多角形（五芒星など）の中心は内側、逆向きに回った内側の穴（巻き数0）は外側になる。
 * 境界上の点（辺の上・頂点の上）は内側に含めない（偽）。境界は輪郭の当たりが受け持つ。
 * 頂点数3未満、または面積0の多角形（全頂点が一直線上、または全頂点が同じ点）は常に偽。
 * 長さ0の辺（連続する重複頂点）を含んでいても、面積のある多角形なら内側の判定は通常どおり行う。除算をしないため0除算は起きない。
 * 浮動小数の注意：「辺の上」は外積がちょうど0の点に限る。小数の座標で辺のごく近く（ちょうど上ではない）にある点は、
 * 丸めによりどちら側にも判定され得る。
 * 引数を書き換えず、例外は投げない。
 * @param {number} px - 判定する点のX座標（ワールド座標）
 * @param {number} py - 判定する点のY座標（ワールド座標）
 * @param {Array<{x: number, y: number}>} points - 多角形の頂点の並び（閉じる辺を含む。始点を重複させない）
 * @returns {boolean} 内側（境界を除く）ならtrue
 */
export function isPointInPolygonNonzero(px, py, points) {
    const n = points.length;
    if (n < 3) return false;

    // 境界上の点は偽
    for (let i = 0; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
        if (
            cross === 0 &&
            px >= Math.min(a.x, b.x) && px <= Math.max(a.x, b.x) &&
            py >= Math.min(a.y, b.y) && py <= Math.max(a.y, b.y)
        ) {
            return false;
        }
    }

    // 巻き数（Sundayの方法）
    let winding = 0;
    for (let i = 0; i < n; i++) {
        const a = points[i];
        const b = points[(i + 1) % n];
        const cross = (b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x);
        if (a.y <= py && b.y > py) {
            if (cross > 0) winding += 1;
        } else if (a.y > py && b.y <= py) {
            if (cross < 0) winding -= 1;
        }
    }
    return winding !== 0;
}
