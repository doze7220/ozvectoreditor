/**
 * 責務: 頂点の選択で選んだ点・区間から、線・パスの分割と区間の削除で切れる点・消える区間を決め、分かれた線（開いたパス）と元の行を引き継ぐ1本を組み立てる規則と押せるかの判定を、状態を持たない関数として提供する。
 * モデル・履歴・選択・操作モード・名前・一覧の位置を知らない。
 */
import { Path, readCornerFlags } from './Path.js';
import { outlineSourceOf, outlineVertexIndexOf, selectedSegmentIndexesOf } from './PathVertexRules.js';
import { endpointVertexIndexOf } from './PathJoinRules.js';

/**
 * 切る点・消す区間の指定（選んだ点）。`PathVertexRules.VertexTarget`と同じ形。
 * @typedef {Object} SplitTarget
 * @property {Object} shape - 図形（`type`・`id`・`toJSON()`を持つ）
 * @property {number} vertexIndex - 頂点の番号（図形の`getVertexIndexForHandle`の番号＝`toJSON()`の`points`の番号）
 */

/**
 * 「分割」「区間を消す」が押せるか。`palette/OptionBarSplitGroup.js`のtypedef`SplitAvailability`と同じ内容の二重定義（互いに存在を書く）。
 * @typedef {Object} SplitAvailability
 * @property {boolean} split - 切れる点を1つ以上持つ図形があるか（`planSplitAtVertices`が1件以上になる）
 * @property {boolean} deleteSegments - 選んでいる区間を1つ以上持つ図形があるか（`planSegmentDeletion`が1件以上になる）
 */

/**
 * 分割・区間の削除の結果の計画の1件。
 * @typedef {Object} SplitPlanItem
 * @property {*} targetId - 元の図形の`id`
 * @property {Path[]} pieces - 分かれた線（開いたパス。`id`は`null`）。`pieces[0]`が元の行を引き継ぐ1本、`pieces[1..]`が新しくできた線（下から上の順）。空配列は図形ごと消える
 */

/**
 * 図形ごとに集めた、計算の入力（非公開）。
 * @typedef {Object} SplitEntry
 * @property {Object} shape - 図形
 * @property {Object} data - 図形の`toJSON()`の値
 * @property {import('./PathVertexRules.js').OutlineSource} source - 輪郭の元
 * @property {number[]} vertexIndexes - 選んだ点の番号（0以上・点の数未満の整数。出現順・重複を含む）
 */

/**
 * ピース（非公開。輪郭の元の点の番号の並びと区間の番号の並びで表す）。
 * @typedef {Object} Piece
 * @property {number[]} indices - 輪郭の元の点の番号の並び（2つ以上）
 * @property {number[]} segmentIndices - 輪郭の元の区間の番号の並び（`indices.length - 1`個）
 * @property {number} start - 最初の点の番号（`indices[0]`）
 */

/**
 * 選んだ点を図形ごとに束ねて、計算の入力を作る（非公開）。図形は`targets`に最初に現れた順（図形のオブジェクトで束ねる）。
 * `type`が`line`・`rect`・`curve`・`path`以外は`toJSON()`を呼ばず飛ばす。点の番号は0以上・点の数未満の整数だけ。
 * @param {SplitTarget[]} targets - 選んだ点
 * @returns {SplitEntry[]} 図形ごとの入力
 */
function collectEntries(targets) {
    const groups = new Map();
    for (const target of targets) {
        if (!groups.has(target.shape)) {
            groups.set(target.shape, []);
        }
        groups.get(target.shape).push(target.vertexIndex);
    }
    const entries = [];
    for (const [shape, indices] of groups) {
        const type = shape.type;
        if (type !== 'line' && type !== 'rect' && type !== 'curve' && type !== 'path') {
            continue;
        }
        const data = shape.toJSON();
        const source = outlineSourceOf(data);
        if (source === null) {
            continue;
        }
        const count = data.points.length;
        const vertexIndexes = indices.filter((i) => Number.isInteger(i) && i >= 0 && i < count);
        entries.push({ shape, data, source, vertexIndexes });
    }
    return entries;
}

/**
 * 切れる点の輪郭の番号の集合を求める（非公開）。輪郭の番号があり、輪郭の元が閉じているか、開いた線の端でない点。
 * 開いた線の端は`endpointVertexIndexOf`（図形の番号）で判定する。
 * @param {SplitEntry} entry - 図形ごとの入力
 * @returns {Set<number>} 切れる点の輪郭の番号
 */
function cutPointsOf(entry) {
    const cuts = new Set();
    const startEnd = endpointVertexIndexOf(entry.data, 'start');
    const lastEnd = endpointVertexIndexOf(entry.data, 'end');
    for (const vertexIndex of entry.vertexIndexes) {
        const outlineIndex = outlineVertexIndexOf(entry.data, vertexIndex);
        if (outlineIndex === null) {
            continue;
        }
        if (!entry.source.closed && (vertexIndex === startEnd || vertexIndex === lastEnd)) {
            continue;
        }
        cuts.add(outlineIndex);
    }
    return cuts;
}

/**
 * 輪郭の元を、切る点と消える区間でピースに分ける（ピースを作る唯一の箇所。分割と区間の削除が共有）。
 * 開いた線は点0から、閉じた形は「切る点」か「直前の区間が消える点」のうち番号の最も小さい点から、区間を1つずつたどる。
 * 消える区間に来たらそこでピースを終えて次の点から新しいピースを始め、切る点に着いたら（開いた線の最後の点を除く）そこでピースを終えて同じ点から新しいピースを始める。
 * 閉じた形は元の点に戻ったら終える。点が1つだけのピースは捨てる。たどる順（`start`の並びは順不同）で返す。
 * @param {import('./PathVertexRules.js').OutlineSource} source - 輪郭の元
 * @param {Set<number>} cutPoints - 切る点の輪郭の番号
 * @param {Set<number>} removedSegments - 消える区間の輪郭の番号
 * @returns {Piece[]} ピース
 */
function buildPieces(source, cutPoints, removedSegments) {
    const n = source.points.length;
    const pieces = [];
    let indices = [];
    let segmentIndices = [];
    const begin = (point) => {
        indices = [point];
        segmentIndices = [];
    };
    const finish = () => {
        if (indices.length >= 2) {
            pieces.push({ indices, segmentIndices, start: indices[0] });
        }
        indices = [];
        segmentIndices = [];
    };
    if (!source.closed) {
        begin(0);
        for (let i = 0; i + 1 < n; i++) {
            if (removedSegments.has(i)) {
                finish();
                begin(i + 1);
                continue;
            }
            indices.push(i + 1);
            segmentIndices.push(i);
            if (cutPoints.has(i + 1) && i + 1 < n - 1) {
                finish();
                begin(i + 1);
            }
        }
        finish();
        return pieces;
    }
    let first = null;
    for (let p = 0; p < n; p++) {
        if (cutPoints.has(p) || removedSegments.has((p - 1 + n) % n)) {
            first = p;
            break;
        }
    }
    if (first === null) {
        return pieces;
    }
    begin(first);
    for (let step = 0; step < n; step++) {
        const segment = (first + step) % n;
        const next = (segment + 1) % n;
        if (removedSegments.has(segment)) {
            finish();
            if (next !== first) {
                begin(next);
            }
            continue;
        }
        indices.push(next);
        segmentIndices.push(segment);
        if (next === first) {
            finish();
        } else if (cutPoints.has(next)) {
            finish();
            begin(next);
        }
    }
    finish();
    return pieces;
}

/**
 * ピースを「元の行を引き継ぐ1本」を先頭にして並べる（唯一の箇所）。引き継ぐ1本は、(a)`start`が0のもの、無ければ(b)点の番号0を含むもの、
 * 無ければ(c)`start`がいちばん小さいもの。残りは`start`の小さい順（新しくできた線の下から上の順）。引数を書き換えない。
 * @param {Piece[]} pieces - ピース
 * @returns {Piece[]} 並べたピース（空なら空）
 */
function orderPieces(pieces) {
    if (pieces.length === 0) {
        return [];
    }
    const sorted = pieces.slice().sort((a, b) => a.start - b.start);
    let keeperIndex = sorted.findIndex((piece) => piece.start === 0);
    if (keeperIndex < 0) {
        keeperIndex = sorted.findIndex((piece) => piece.indices.includes(0));
    }
    if (keeperIndex < 0) {
        keeperIndex = 0;
    }
    const keeper = sorted[keeperIndex];
    return [keeper, ...sorted.filter((_, i) => i !== keeperIndex)];
}

/**
 * ピースから開いたパスを作る（非公開）。区間は元の区間の値をそのまま渡し、角は元の値を点と同じ並びで写す。点2つでも`path`のまま。`id`は`null`。
 * @param {import('./PathVertexRules.js').OutlineSource} source - 輪郭の元
 * @param {Piece} piece - ピース
 * @returns {Path} 開いたパス
 */
function pieceToPath(source, piece) {
    const flags = readCornerFlags(source);
    return new Path(
        piece.indices.map((i) => source.points[i]),
        false,
        source.strokeColor,
        source.strokeWidth,
        source.fillColor,
        piece.segmentIndices.map((i) => source.segments[i]),
        piece.indices.map((i) => flags[i]),
    );
}

/**
 * 選んだ切れる点のすべてで線・パスを切った結果を、図形ごとに計画する。
 * 図形は`targets`に最初に現れた順。切れる点を1つ以上持つ図形だけを結果に入れる（切れる点＝輪郭の番号があり、輪郭の元が閉じているか開いた線の端でない点）。
 * `type`が`line`・`rect`・`curve`・`path`以外の図形は飛ばす。範囲外・整数でない番号・同じ点の重複は無視する。
 * 分かれた線はすべて開いたパス（区間の種類・引っ張る点・角・スタイル3つは元のまま）。`pieces[0]`が元の行を引き継ぐ1本、`pieces[1..]`が新しくできた線（下から上の順）。
 * 引数を書き換えず、結果は引数と配列・点を共有しない。
 * @param {SplitTarget[]} targets - 選んだ点
 * @returns {SplitPlanItem[]} 図形ごとの結果
 */
export function planSplitAtVertices(targets) {
    const plan = [];
    for (const entry of collectEntries(targets)) {
        const cuts = cutPointsOf(entry);
        if (cuts.size === 0) {
            continue;
        }
        const pieces = orderPieces(buildPieces(entry.source, cuts, new Set()));
        plan.push({ targetId: entry.shape.id, pieces: pieces.map((piece) => pieceToPath(entry.source, piece)) });
    }
    return plan;
}

/**
 * 選んでいる区間（両端の点が選ばれている区間）をすべて消した結果を、図形ごとに計画する。
 * 図形は`targets`に最初に現れた順。選んでいる区間を1つ以上持つ図形だけを結果に入れる。ピースが残らないときは`pieces: []`（図形ごと消える）。
 * `pieces[0]`が元の行を引き継ぐ1本、`pieces[1..]`が新しくできた線（下から上の順）。分かれた線はすべて開いたパス（区間の種類・引っ張る点・角・スタイル3つは元のまま）。
 * 引数を書き換えず、結果は引数と配列・点を共有しない。
 * @param {SplitTarget[]} targets - 選んだ点
 * @returns {SplitPlanItem[]} 図形ごとの結果
 */
export function planSegmentDeletion(targets) {
    const plan = [];
    for (const entry of collectEntries(targets)) {
        const removed = new Set(selectedSegmentIndexesOf(entry.data, entry.vertexIndexes));
        if (removed.size === 0) {
            continue;
        }
        const pieces = orderPieces(buildPieces(entry.source, new Set(), removed));
        plan.push({ targetId: entry.shape.id, pieces: pieces.map((piece) => pieceToPath(entry.source, piece)) });
    }
    return plan;
}

/**
 * 「分割」「区間を消す」が押せるかを求める。計画の関数と同じ非公開の判定を使う（押せるとき必ず計画が1件以上になる）。
 * @param {SplitTarget[]} targets - 選んだ点
 * @returns {SplitAvailability} 押せるか
 */
export function resolveSplitAvailability(targets) {
    let split = false;
    let deleteSegments = false;
    for (const entry of collectEntries(targets)) {
        if (!split && cutPointsOf(entry).size > 0) {
            split = true;
        }
        if (!deleteSegments && selectedSegmentIndexesOf(entry.data, entry.vertexIndexes).length > 0) {
            deleteSegments = true;
        }
    }
    return { split, deleteSegments };
}
