/**
 * 責務: 頂点の選択で選んだ点から、区間の直線⇔曲線の切り替えで切り替える区間と押せるかを決め、切り替えた新しい図形（パス・直線）と
 * 元の点の番号から新しい点の番号への対応を組み立てる規則を、状態を持たない関数と定数として提供する。
 */
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, readCornerFlags } from './Path.js';
import { Line } from './Line.js';
import { segmentKindsOf, segmentSpecsOf } from './PathJoinRules.js';
import { resolveCornerState, CornerState } from './PathCornerRules.js';

/**
 * 区間の切り替えの操作の値。唯一の定義箇所。
 * @readonly
 * @enum {string}
 */
export const SegmentKindSwitch = Object.freeze({
    /** 直線に（曲線の区間を直線の区間にする） */
    TO_LINE: 'toLine',
    /** 曲線に（直線の区間の中点に点を足し、その2つの区間を曲線の区間にする） */
    TO_CURVE: 'toCurve',
});

/**
 * 選んだ点。`PathCornerRules`のtypedef`CornerTarget`と同じ形（どちらも`PathCornerEditor`が集めた同じ結果を受ける）。
 * @typedef {Object} SegmentSwitchTarget
 * @property {Object} shape - 図形（`type`・`id`・`toJSON()`だけを読む）
 * @property {number} vertexIndex - 頂点の番号
 */

/**
 * 「直線に」「曲線に」のボタンの押せる・押せない。`palette/OptionBarCornerGroup.js`のtypedef`SegmentSwitchAvailability`と同じ内容の二重定義（互いに存在を書く）。
 * @typedef {Object} SegmentSwitchAvailability
 * @property {boolean} toLine - 「直線に」が押せるか
 * @property {boolean} toCurve - 「曲線に」が押せるか
 */

/**
 * 区間の切り替えの計画の1件。
 * @typedef {Object} SegmentSwitchPlanItem
 * @property {*} targetId - 置き換える図形のid（元の図形の`id`）
 * @property {Path|Line} shape - 切り替えた新しい図形（`Path`または`Line`。idは`null`）
 * @property {Array<number|null>} vertexIndexMap - 元の頂点の番号から新しい頂点の番号への対応（要素数＝元の頂点の数。対応先が無い点は`null`）
 */

/**
 * 切り替える区間の集まり（図形ごと）。
 * @typedef {Object} SwitchEntry
 * @property {Object} shape - 図形
 * @property {Object} data - 図形の`toJSON()`の値
 * @property {number[]} segmentIndexes - 切り替える区間の番号（昇順）
 */

/**
 * 図形のデータを`toJSON()`で読む。1回の呼び出しの中で同じ図形インスタンスは1回だけ`toJSON()`する。
 * `type`が`'path'`・`'line'`・`'curve'`以外の図形は`null`を返す（`toJSON()`を呼ばない）。
 * @param {Map<Object, Object|null>} cache - 図形ごとのデータの使い回し先（呼び出しごとに新しく作る）
 * @param {Object} shape - 図形
 * @returns {Object|null} 図形データ。対象外は`null`
 */
function dataOf(cache, shape) {
    if (!cache.has(shape)) {
        const supported = shape && (shape.type === 'path' || shape.type === 'line' || shape.type === 'curve');
        cache.set(shape, supported ? shape.toJSON() : null);
    }
    return cache.get(shape);
}

/**
 * 切り替える区間を図形ごとに集める。切り替える区間の決め方の唯一の箇所。
 * パス・単独の直線は「区間を持つ線」として、区間`i`の両端（`i`と`(i + 1) % n`）がどちらも選ばれていれば切り替える区間
 * （閉じたパスの終点→始点の区間を含む。開いたパスは折り返さない）。今の曲線は始点（番号0）と終点（番号2）が選ばれていれば区間0。
 * 矩形・円・弧ほかは対象外。番号は0以上・頂点の数未満の整数だけを選んだ点とする。同じ点が2回あっても結果は同じ。
 * @param {SegmentSwitchTarget[]} targets - 選んだ点
 * @param {Map<Object, Object|null>} cache - 図形ごとのデータの使い回し先
 * @returns {SwitchEntry[]} 図形ごとの結果（`targets`に最初に現れた順。切り替える区間が無い図形も含む）
 */
function collectSwitchEntries(targets, cache) {
    /** @type {Map<Object, Set<number>>} */
    const selectedByShape = new Map();
    for (const { shape, vertexIndex } of targets) {
        const data = dataOf(cache, shape);
        if (data === null) continue;
        if (!selectedByShape.has(shape)) selectedByShape.set(shape, new Set());
        if (Number.isInteger(vertexIndex) && vertexIndex >= 0 && vertexIndex < data.points.length) {
            selectedByShape.get(shape).add(vertexIndex);
        }
    }
    const entries = [];
    for (const [shape, selected] of selectedByShape) {
        const data = cache.get(shape);
        const segmentIndexes = [];
        if (data.type === 'curve') {
            if (selected.has(0) && selected.has(2)) segmentIndexes.push(0);
        } else {
            const n = data.points.length;
            const count = segmentKindsOf(data).length;
            for (let i = 0; i < count; i++) {
                if (selected.has(i) && selected.has((i + 1) % n)) segmentIndexes.push(i);
            }
        }
        entries.push({ shape, data, segmentIndexes });
    }
    return entries;
}

/**
 * 操作で変わる区間の番号を決める。変わる区間の決め方の唯一の箇所（押せるかと押したときの結果が共有する）。
 * 区間を持つ線は、「曲線に」なら直線の区間、「直線に」なら直線の区間でない区間（打った点の曲線の区間と曲がり方を持つ区間。曲がり方を持つ区間は「曲線に」では変わらない）。今の曲線は「直線に」なら切り替える区間そのまま、「曲線に」は空（何もしない）。
 * @param {SwitchEntry} entry - 図形ごとの切り替える区間
 * @param {string} operation - `SegmentKindSwitch`の値
 * @returns {number[]} 変わる区間の番号（昇順）
 */
function changedSegmentIndexes(entry, operation) {
    if (entry.data.type === 'curve') {
        return operation === SegmentKindSwitch.TO_LINE ? entry.segmentIndexes.slice() : [];
    }
    const kinds = segmentKindsOf(entry.data);
    if (operation === SegmentKindSwitch.TO_CURVE) {
        return entry.segmentIndexes.filter((i) => kinds[i] === SEGMENT_KIND_LINE);
    }
    return entry.segmentIndexes.filter((i) => kinds[i] !== SEGMENT_KIND_LINE);
}

/**
 * 2点の中点を返す。
 * @param {{x: number, y: number}} a - 点
 * @param {{x: number, y: number}} b - 点
 * @returns {{x: number, y: number}} 中点（新しい座標）
 */
function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/**
 * 「曲線に」で、変わる区間の中点に点を足した新しいパスを組み立てる。頂点・区間の種類・角の情報を一緒に並べる唯一の箇所。
 * 元の頂点を順に並べ、区間があれば続けて区間を並べる。変わる区間は「`'smooth'` → 足した点（両端の中点。なめらかな点）→ `'smooth'`」、
 * そうでなければ元の区間の指定のまま（曲がり方を持つ区間は引っ張る点ごと残る。区間の指定は`segmentSpecsOf`で読む）。
 * このため足した点は区間の始点の直後に入り、閉じたパスの終点→始点の区間に足した点は末尾に置かれる。
 * 変わる区間の両端の点は、いったん元の角の情報で作った仮のパスで`resolveCornerState`が`CORNER`か`SMOOTH`（切り替えの後に角を操作できる点）なら角の点にする
 * （隣の曲線の区間の形を変えないため）。それ以外（片側がまだ直線の区間の点・曲がり方を持つ区間に接する点・端の点）は元の値のまま。
 * 直線の区間の中点`M`に足すと、2つの区間の制御点が区間の1/3・2/3の位置に乗り、直線と同じ形になる。単独の直線は点3つの開いたパスになる。
 * @param {Object} data - 区間を持つ線（パスか単独の直線）の`toJSON()`の値
 * @param {number[]} changedIndexes - 変わる区間の番号
 * @returns {{shape: Path, vertexIndexMap: number[]}} 新しいパス（idは`null`）と元の頂点の番号から新しい番号への対応
 */
function buildCurvedPath(data, changedIndexes) {
    const points = data.points;
    const kinds = segmentSpecsOf(data);
    const corners = readCornerFlags(data);
    const n = points.length;
    const closed = data.closed === true;
    const changed = new Set(changedIndexes);
    const newPoints = [];
    const newKinds = [];
    const newCorners = [];
    const vertexIndexMap = [];
    for (let i = 0; i < n; i++) {
        vertexIndexMap.push(newPoints.length);
        newPoints.push({ x: points[i].x, y: points[i].y });
        newCorners.push(corners[i]);
        if (i < kinds.length) {
            if (changed.has(i)) {
                newKinds.push(SEGMENT_KIND_SMOOTH);
                newPoints.push(midpoint(points[i], points[(i + 1) % n]));
                newCorners.push(false);
                newKinds.push(SEGMENT_KIND_SMOOTH);
            } else {
                newKinds.push(kinds[i]);
            }
        }
    }
    const make = () => new Path(newPoints, closed, data.strokeColor, data.strokeWidth, data.fillColor, newKinds, newCorners);
    const provisional = make();
    for (const i of changedIndexes) {
        for (const newIndex of [vertexIndexMap[i], vertexIndexMap[(i + 1) % n]]) {
            const state = resolveCornerState(provisional, newIndex);
            if (state === CornerState.CORNER || state === CornerState.SMOOTH) newCorners[newIndex] = true;
        }
    }
    return { shape: make(), vertexIndexMap };
}

/**
 * 「直線に」（パス）で、変わる区間（打った点の曲線の区間・曲がり方を持つ区間）だけ`'line'`にした新しいパスを組み立てる。点は足さない・消さない。
 * 変わらない曲がり方を持つ区間は引っ張る点ごと残り、変わる曲がり方を持つ区間の引っ張る点は捨てる（区間の指定は`segmentSpecsOf`で読む）。
 * 頂点・閉じているか・スタイル・角の情報は元のまま（両端の点は片側が直線の区間になり角を操作できない点になるため、形に効かない）。
 * @param {Object} data - パスの`toJSON()`の値
 * @param {number[]} changedIndexes - 変わる区間の番号
 * @returns {{shape: Path, vertexIndexMap: number[]}} 新しいパス（idは`null`）と恒等の対応
 */
function buildStraightenedPath(data, changedIndexes) {
    const kinds = segmentSpecsOf(data);
    for (const i of changedIndexes) kinds[i] = SEGMENT_KIND_LINE;
    const shape = new Path(data.points, data.closed === true, data.strokeColor, data.strokeWidth, data.fillColor, kinds, readCornerFlags(data));
    return { shape, vertexIndexMap: data.points.map((_, i) => i) };
}

/**
 * 「直線に」（今の曲線）で、始点と終点を結ぶ直線を組み立てる。制御点は捨てる。
 * @param {Object} data - 今の曲線の`toJSON()`の値（`points[0]`＝始点・`[1]`＝制御点・`[2]`＝終点）
 * @returns {{shape: Line, vertexIndexMap: Array<number|null>}} 新しい直線（idは`null`）と対応（`[0, null, 1]`）
 */
function buildLineFromCurve(data) {
    const [start, , end] = data.points;
    const shape = new Line(start.x, start.y, end.x, end.y, data.strokeColor, data.strokeWidth, data.fillColor);
    return { shape, vertexIndexMap: [0, null, 1] };
}

/**
 * 「直線に」「曲線に」のボタンの押せる・押せないを決める。押せるかの決め方の唯一の入口。
 * 変わる区間が1つ以上ある図形が1つでもあれば、その操作が押せる。0件なら両方`false`。引数を書き換えない。
 * @param {SegmentSwitchTarget[]} targets - 選んだ点（0件可）
 * @returns {SegmentSwitchAvailability} 押せる・押せない（`palette/OptionBarCornerGroup.js`の同名typedefと同じ内容）
 */
export function resolveSegmentSwitchAvailability(targets) {
    const entries = collectSwitchEntries(targets, new Map());
    return {
        toLine: entries.some((entry) => changedSegmentIndexes(entry, SegmentKindSwitch.TO_LINE).length > 0),
        toCurve: entries.some((entry) => changedSegmentIndexes(entry, SegmentKindSwitch.TO_CURVE).length > 0),
    };
}

/**
 * 区間の切り替えを押したときの結果を決める。結果の唯一の入口。
 * 図形ごと（`targets`に最初に現れた順）に、変わる区間があるものだけを結果に入れる。変わる区間が1つも無ければ空配列
 * （既に曲線の区間の「曲線に」・既に直線の区間の「直線に」・単独の直線の「直線に」・今の曲線の「曲線に」は何も変えない）。
 * 結果は引数と配列・頂点を共有せず、引数を書き換えない。同じ点が2回あっても結果は同じ。
 * @param {SegmentSwitchTarget[]} targets - 選んだ点（0件可）
 * @param {string} operation - `SegmentKindSwitch`の値。違う値なら`targets`が空でも計算の前に`Error`
 * @returns {SegmentSwitchPlanItem[]} 変わる図形ごとの計画
 * @throws {Error} `operation`が`SegmentKindSwitch`の値でないとき
 */
export function planSegmentKindSwitch(targets, operation) {
    if (operation !== SegmentKindSwitch.TO_LINE && operation !== SegmentKindSwitch.TO_CURVE) {
        throw new Error(`planSegmentKindSwitch: 未知の操作です: ${operation}`);
    }
    const plan = [];
    for (const entry of collectSwitchEntries(targets, new Map())) {
        const changed = changedSegmentIndexes(entry, operation);
        if (changed.length === 0) continue;
        let built;
        if (entry.data.type === 'curve') {
            built = buildLineFromCurve(entry.data);
        } else if (operation === SegmentKindSwitch.TO_CURVE) {
            built = buildCurvedPath(entry.data, changed);
        } else {
            built = buildStraightenedPath(entry.data, changed);
        }
        plan.push({ targetId: entry.shape.id, shape: built.shape, vertexIndexMap: built.vertexIndexMap });
    }
    return plan;
}
