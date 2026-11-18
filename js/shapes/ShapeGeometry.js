/**
 * 責務: 図形クラスが当たり判定・範囲選択で共通に使う幾何の計算（点と線分の距離・線分と軸平行矩形の交差・2次ベジェ曲線の点・
 * 3次ベジェ曲線の点・多角形の内側の判定（nonzero））と、パスの曲線の区間（点を通るなめらかな曲線）の形の決め方（制御点）を、
 * 状態を持たない関数として提供する。
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
 * 3次ベジェ曲線 B(t) = (1−t)^3 P0 + 3(1−t)^2 t P1 + 3(1−t) t^2 P2 + t^3 P3 上の点を求める。
 * tは0〜1を想定するが、範囲外も式どおりに計算し検査しない。例外は投げない。
 * @param {{x: number, y: number}} p0 - 始点
 * @param {{x: number, y: number}} p1 - 制御点1
 * @param {{x: number, y: number}} p2 - 制御点2
 * @param {{x: number, y: number}} p3 - 終点
 * @param {number} t - 曲線上の位置（0〜1を想定）
 * @returns {{x: number, y: number}} 曲線上の点（呼び出しごとに新しいオブジェクト）
 */
export function cubicBezierPoint(p0, p1, p2, p3, t) {
    const u = 1 - t;
    const w0 = u * u * u;
    const w1 = 3 * u * u * t;
    const w2 = 3 * u * t * t;
    const w3 = t * t * t;
    return {
        x: w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x,
        y: w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y,
    };
}

/**
 * パスの曲線の区間（頂点を通るなめらかな曲線。一様なCatmull-Romを3次ベジェに直したもの）の、区間ごとの制御点2つを求める。
 * 区間iは points[i] → points[(i+1) % n]。曲線の区間iの a = P[i]、b = P[(i+1) % n] について、
 * 前の区間（閉じたパスは (i−1+m) % m、開いたパスは i−1 で i=0 なら無い）が存在し、iと別の区間で、かつ曲線の区間なら
 * Q0 = その区間の始点の頂点、そうでなければ Q0 = 2a − b（折り返した仮の点）。
 * 次の区間（閉じたパスは (i+1) % m、開いたパスは i+1 で m に達すれば無い）が存在し、iと別の区間で、かつ曲線の区間なら
 * Q3 = その区間の終点の頂点、そうでなければ Q3 = 2b − a。
 * control1 = a + (b − Q0) / 6、control2 = b − (Q3 − a) / 6。
 * 性質：制御点は頂点の座標の1次式（頂点を拡大縮小（縦横別を含む）・回転・平行移動すると制御点も同じ変換を受ける）。
 * 連なり（曲線の区間が途切れず続く部分）の区間が1つだけなら両側が仮の点で、制御点は a + (b−a)/3・b − (b−a)/3（直線と同じ形）。
 * 直線の区間との境目は曲線の側を連なりの端として扱う（角が立つ）。閉じたパスで全区間が曲線なら1周がひとつの連なり。
 * 打った点の間隔が大きく違うと膨らむ・小さな輪ができることがあるのは式の性質（許容）。
 * 引数を書き換えず、戻り値は呼び出しごとに新しいオブジェクト。例外は投げない。
 * @param {Array<{x: number, y: number}>} points - 頂点の並び（n個）
 * @param {boolean[]} smoothFlags - 区間ごとの「曲線の区間か」（開いたパスn−1・閉じたパスn個）
 * @param {boolean} closed - 閉じたパスか
 * @returns {Array<{control1: {x: number, y: number}, control2: {x: number, y: number}}|null>}
 *   区間ごとの制御点（要素数は smoothFlags と同じ。曲線の区間でない区間は null）
 */
export function computeSmoothSegmentControls(points, smoothFlags, closed) {
    const n = points.length;
    const m = smoothFlags.length;
    return smoothFlags.map((isSmooth, i) => {
        if (!isSmooth) return null;
        const a = points[i];
        const b = points[(i + 1) % n];

        const prevIndex = closed ? (i - 1 + m) % m : i - 1;
        const hasPrev = prevIndex >= 0 && prevIndex !== i && smoothFlags[prevIndex];
        const q0 = hasPrev
            ? points[prevIndex]
            : { x: 2 * a.x - b.x, y: 2 * a.y - b.y };

        const nextIndex = closed ? (i + 1) % m : i + 1;
        const hasNext = nextIndex < m && nextIndex !== i && smoothFlags[nextIndex];
        const q3 = hasNext
            ? points[(nextIndex + 1) % n]
            : { x: 2 * b.x - a.x, y: 2 * b.y - a.y };

        return {
            control1: { x: a.x + (b.x - q0.x) / 6, y: a.y + (b.y - q0.y) / 6 },
            control2: { x: b.x - (q3.x - a.x) / 6, y: b.y - (q3.y - a.y) / 6 },
        };
    });
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
