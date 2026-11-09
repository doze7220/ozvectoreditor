/**
 * 責務: 図形クラスが当たり判定・範囲選択で共通に使う幾何の計算（点と線分の距離・線分と軸平行矩形の交差・2次ベジェ曲線の点）を、状態を持たない関数として提供する。
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
