/**
 * 責務: 選んでいる図形の整列（6種）・分布（2種）の移動量の規則を、状態を持たずDOMに触れない関数として担う。
 * 図形は`id`と外枠の数値だけで扱う（importなし）。
 */

/**
 * 整列・分布の対象1件（図形の`id`と外枠）。
 * `ShapeExtentReader.js`の`ShapeBoundsEntry`と同じ形の二重定義。形を変えるときは両方をそろえること。
 * @typedef {Object} AlignItem
 * @property {string} id 図形のid（不透明に扱う）
 * @property {{minX: number, minY: number, maxX: number, maxY: number}} bounds 外枠
 */

/**
 * 図形1つの移動量。
 * @typedef {Object} AlignMove
 * @property {string} id 図形のid
 * @property {number} dx X方向の移動量
 * @property {number} dy Y方向の移動量
 */

/**
 * 整列・分布の操作の種類。操作の値の唯一の定義（宣言順＝ボタンの並び）。
 * 値（文字列）は、`ShapeAlignEditor.getAvailability`が返す`ShapeAlignAvailability`のキーと、
 * `OptionBarAlignGroup`の対応表の操作の文字列にも同じ文字列として使われる。
 * 値を変えると表示側が黙って押せない表示になるため、変えるときは両方をそろえること。
 * @readonly
 * @enum {string}
 */
export const ShapeAlignOperation = Object.freeze({
    ALIGN_LEFT: 'alignLeft',
    ALIGN_HORIZONTAL_CENTER: 'alignHorizontalCenter',
    ALIGN_RIGHT: 'alignRight',
    ALIGN_TOP: 'alignTop',
    ALIGN_VERTICAL_CENTER: 'alignVerticalCenter',
    ALIGN_BOTTOM: 'alignBottom',
    DISTRIBUTE_HORIZONTAL: 'distributeHorizontal',
    DISTRIBUTE_VERTICAL: 'distributeVertical',
});

/**
 * 移動量が0かの判定の許容量。
 * 分布は割り算・累積の足し算を使うため、すでに均等な図形でも計算の誤差で極小の移動量が出ることがある。
 * そのままでは「押せるのに押しても見た目が変わらない」ボタンが残ってしまうため、この値未満を0として扱う。
 * 判定にだけ使い、座標そのものは丸めない。
 */
const ZERO_MOVE_EPSILON = 1e-9;

/** 整列に必要な図形の数の下限。 */
const MIN_ITEMS_FOR_ALIGN = 2;

/** 分布に必要な図形の数の下限。 */
const MIN_ITEMS_FOR_DISTRIBUTE = 3;

/**
 * 操作ごとの定義の表（本ファイル1か所の定義）。
 * - `kind`: `'align'`（整列）または`'distribute'`（分布）
 * - `axis`: 動かす軸（`'x'`または`'y'`）
 * - `anchor`: 整列の基準（`'min'`＝最小端・`'center'`＝中央・`'max'`＝最大端）。分布は`null`
 * @type {Readonly<Record<string, {kind: string, axis: string, anchor: (string|null)}>>}
 */
const OPERATION_DEFS = Object.freeze({
    [ShapeAlignOperation.ALIGN_LEFT]: Object.freeze({ kind: 'align', axis: 'x', anchor: 'min' }),
    [ShapeAlignOperation.ALIGN_HORIZONTAL_CENTER]: Object.freeze({ kind: 'align', axis: 'x', anchor: 'center' }),
    [ShapeAlignOperation.ALIGN_RIGHT]: Object.freeze({ kind: 'align', axis: 'x', anchor: 'max' }),
    [ShapeAlignOperation.ALIGN_TOP]: Object.freeze({ kind: 'align', axis: 'y', anchor: 'min' }),
    [ShapeAlignOperation.ALIGN_VERTICAL_CENTER]: Object.freeze({ kind: 'align', axis: 'y', anchor: 'center' }),
    [ShapeAlignOperation.ALIGN_BOTTOM]: Object.freeze({ kind: 'align', axis: 'y', anchor: 'max' }),
    [ShapeAlignOperation.DISTRIBUTE_HORIZONTAL]: Object.freeze({ kind: 'distribute', axis: 'x', anchor: null }),
    [ShapeAlignOperation.DISTRIBUTE_VERTICAL]: Object.freeze({ kind: 'distribute', axis: 'y', anchor: null }),
});

/**
 * 軸ごとの外枠のキー（X軸＝`minX`・`maxX`、Y軸＝`minY`・`maxY`）と、移動量のキー。
 * @type {Readonly<Record<string, {minKey: string, maxKey: string, moveKey: string}>>}
 */
const AXIS_KEYS = Object.freeze({
    x: Object.freeze({ minKey: 'minX', maxKey: 'maxX', moveKey: 'dx' }),
    y: Object.freeze({ minKey: 'minY', maxKey: 'maxY', moveKey: 'dy' }),
});

/**
 * 操作が既知か確かめる。未知なら配線の誤りを早く見つけるためにthrowする。
 * @param {string} operation 操作
 * @returns {void}
 * @throws {Error} 未知の操作のとき
 */
function assertKnownOperation(operation) {
    if (!Object.values(ShapeAlignOperation).includes(operation)) {
        throw new Error(`ShapeAlignRules: 未知の整列・分布の操作です: ${String(operation)}`);
    }
}

/**
 * 1つの軸について、各図形の移動量（`items`と同じ順）を求める。XとYで同じ手順を使うため軸のキーで扱う。
 * @param {ReadonlyArray<AlignItem>} items 対象（件数は下限以上）。書き換えない。
 * @param {{kind: string, axis: string, anchor: (string|null)}} def 操作の定義
 * @returns {number[]} 各図形の、その軸の移動量
 */
function computeAxisMoves(items, def) {
    const { minKey, maxKey } = AXIS_KEYS[def.axis];

    // 全体の範囲（各図形の外枠の和）。選択全体の外枠と同じ値になる。
    let totalMin = Infinity;
    let totalMax = -Infinity;
    for (const item of items) {
        totalMin = Math.min(totalMin, item.bounds[minKey]);
        totalMax = Math.max(totalMax, item.bounds[maxKey]);
    }

    if (def.kind === 'align') {
        return items.map((item) => {
            const min = item.bounds[minKey];
            const max = item.bounds[maxKey];
            if (def.anchor === 'min') return totalMin - min;
            if (def.anchor === 'max') return totalMax - max;
            return (totalMin + totalMax) / 2 - (min + max) / 2;
        });
    }

    // 分布: コピーを軸のminの昇順に並べる（安定な並べ替え。同じ値は元の順）。
    const order = items.map((_, index) => index);
    order.sort((a, b) => items[a].bounds[minKey] - items[b].bounds[minKey]);

    let lengthSum = 0;
    for (const item of items) {
        lengthSum += item.bounds[maxKey] - item.bounds[minKey];
    }
    const gap = (totalMax - totalMin - lengthSum) / (items.length - 1);

    const moves = new Array(items.length).fill(0);
    let position = totalMin;
    for (const index of order) {
        const min = items[index].bounds[minKey];
        const length = items[index].bounds[maxKey] - min;
        moves[index] = position - min;
        position = position + length + gap;
    }
    return moves;
}

/**
 * 整列・分布で図形ごとに動かす量を求める。動かない図形は結果に含めない。
 *
 * 規則:
 * - 件数が下限（整列は2件・分布は3件）未満なら空配列。
 * - 全体の範囲は`items`の外枠の和として本関数の中で求める（選択全体の外枠と同じ値）。
 * - 整列: 最小端＝全体.min − 図形.min／最大端＝全体.max − 図形.max／中央＝全体の中央 − 図形の中央。
 * - 分布: 軸のminの昇順（同じ値は元の順）に並べ、すき間＝（全体の長さ − 各図形の長さの合計）÷（件数 − 1）。
 *   先頭は全体.minに置き、以降は直前の図形の置いた後のmax＋すき間に置く。すき間が負（重なり）でも特別扱いしない。
 * - 移動量の絶対値が両成分とも許容量（1e-9）未満の図形は含めない。含める値は計算した値のまま。
 *
 * 座標は丸めない（刻みへの丸め・小数の切り捨てをしない）。引数は書き換えない。
 * 外枠の値が有限であることは呼び出し側（`ShapeExtentReader`の値）の前提とし、検証しない。
 *
 * @param {ReadonlyArray<AlignItem>} items 対象（描画順）。書き換えない。
 * @param {ShapeAlignOperation} operation 操作
 * @returns {AlignMove[]} `items`の元の順の、動く図形だけの移動量（毎回新しい配列・新しいオブジェクト）
 * @throws {Error} 未知の操作のとき（計算の前に投げる。`items`が空でも）
 */
export function computeAlignMoves(items, operation) {
    assertKnownOperation(operation);
    const def = OPERATION_DEFS[operation];
    const minCount = def.kind === 'align' ? MIN_ITEMS_FOR_ALIGN : MIN_ITEMS_FOR_DISTRIBUTE;
    if (items.length < minCount) return [];

    const axisMoves = computeAxisMoves(items, def);
    const { moveKey } = AXIS_KEYS[def.axis];

    const result = [];
    items.forEach((item, index) => {
        const amount = axisMoves[index];
        if (Math.abs(amount) < ZERO_MOVE_EPSILON) return;
        const move = { id: item.id, dx: 0, dy: 0 };
        move[moveKey] = amount;
        result.push(move);
    });
    return result;
}

/**
 * 操作が1pxでも図形を動かすかを返す。
 * 押せる・押せないの判定と、手順の「何もしない」の判定はこの関数だけで行う（規則を二重に書かない）。
 * @param {ReadonlyArray<AlignItem>} items 対象（描画順）。書き換えない。
 * @param {ShapeAlignOperation} operation 操作
 * @returns {boolean} 動く図形があれば`true`
 * @throws {Error} 未知の操作のとき（`items`が空でも）
 */
export function canApplyAlign(items, operation) {
    return computeAlignMoves(items, operation).length > 0;
}
