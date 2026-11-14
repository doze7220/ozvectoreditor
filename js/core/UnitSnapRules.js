/**
 * 責務: スナップ（座標・移動量を刻みの倍数へ丸めること。端点への吸い付きとは別）の規則を、状態を持たない関数として提供する。
 * 引数を書き換えず新しいオブジェクトを返す。importなし・DOMなし（図形・VectorModel・表示倍率・修飾キーを知らない）。
 */

/**
 * 刻みが丸めに使える値か（正の有限の数値か）を判定する。モジュール内だけで使う（exportしない）。
 * `null`（スナップOFF・`Ctrl`を押している間）やその他の値は丸めない刻みとして扱う。
 * @param {*} step 刻み
 * @returns {boolean} 正の有限の数値なら true
 */
function isRoundingStep(step) {
    return typeof step === 'number' && Number.isFinite(step) && step > 0;
}

/**
 * 1つの値を刻みの倍数へ丸める。モジュール内だけで使う（exportしない）。
 * ちょうど中間の値は0から遠い側へ丸める（`2.5`→`3`、`-2.5`→`-3`。符号について対称で、同じ入力には常に同じ結果）。
 * 結果が0（`-0`を含む）のときは`0`を返す（`-0`を返さない）。有限の数値と正の有限の刻みを前提とする（NaN・Infinityは扱わない）。
 * @param {number} value 丸める値
 * @param {number} step 刻み（正の有限の数値）
 * @returns {number} 刻みの倍数
 */
function roundScalarToUnit(value, step) {
    const rounded = Math.sign(value) * Math.round(Math.abs(value) / step) * step;
    return rounded === 0 ? 0 : rounded;
}

/**
 * 今効いている刻みと「一時無効か」を組み合わせて、実際に丸めに使う刻みを返す（この組み合わせを行う唯一の箇所）。
 * `suppressed`は呼び出し側が読んだ`Ctrl`（`⌘`を含む）の有無。
 * @param {number|null} activeStep 今効いている刻み（`null`＝スナップOFF）
 * @param {boolean} suppressed 一時無効か（真なら丸めない）
 * @returns {number|null} 一時無効なら`null`、そうでなければ`activeStep`をそのまま返す
 */
export function resolveUnitSnapStep(activeStep, suppressed) {
    return suppressed ? null : activeStep;
}

/**
 * (a) 点の座標を軸ごとに独立に刻みの倍数へ丸める。
 * 刻みが正の有限の数値でないとき（`null`等）は丸めず、入力と同じ値（`-0`もそのまま）を新しいオブジェクトで返す。
 * 丸めた結果に`-0`は含めない。引数を書き換えない。
 * @param {{x: number, y: number}} point 点（ワールド座標）
 * @param {number|null} step 刻み
 * @returns {{x: number, y: number}} 丸めた点（新しいオブジェクト）
 */
export function roundPointToUnit(point, step) {
    if (!isRoundingStep(step)) {
        return { x: point.x, y: point.y };
    }
    return { x: roundScalarToUnit(point.x, step), y: roundScalarToUnit(point.y, step) };
}

/**
 * (b) 移動量を軸ごとに独立に刻みの倍数へ丸める。
 * 刻みが正の有限の数値でないときは丸めず、入力と同じ値を新しいオブジェクトで返す。
 * 丸めた結果に`-0`は含めない。引数を書き換えない。
 * @param {{dx: number, dy: number}} delta 移動量
 * @param {number|null} step 刻み
 * @returns {{dx: number, dy: number}} 丸めた移動量（新しいオブジェクト）
 */
export function roundDeltaToUnit(delta, step) {
    if (!isRoundingStep(step)) {
        return { dx: delta.dx, dy: delta.dy };
    }
    return { dx: roundScalarToUnit(delta.dx, step), dy: roundScalarToUnit(delta.dy, step) };
}

/**
 * (c) `MoveDirectionRules.constrainMoveDirection`の結果（横・縦・斜め45°に限定した移動量）を、限定した直線の上に保ったまま丸める。
 * `|dx| === |dy|`が厳密に成り立つ入力（`constrainMoveDirection`の結果）なら、(b)でも45°は崩れず、本関数と同じ結果になる。
 * (b)とは別の規則を持つ理由：`|dx|`と`|dy|`が厳密には等しくない斜めの入力でも、結果を必ず45°（`|dx| === |dy|`）にするため
 * （例：刻み1で`{ dx: 2.4, dy: 2.6 }` → (b)は`{ dx: 2, dy: 3 }`、本関数は`{ dx: 3, dy: 3 }`）。
 * - 刻みが正の有限の数値でないとき：丸めず入力と同じ値を返す。
 * - `dx`・`dy`とも0：`{ dx: 0, dy: 0 }`。
 * - `dy === 0`（横）：`dx`だけを丸め、`dy`は0。
 * - `dx === 0`（縦）：`dy`だけを丸め、`dx`は0。
 * - それ以外（斜め）：`s = round((|dx| + |dy|) / 2)`として`{ sign(dx) * s, sign(dy) * s }`（`|dx| === |dy|`が厳密に成り立つ）。
 * `MoveDirectionRules`をimportしない（入力の形だけを前提にする）。結果に`-0`は含めない。引数を書き換えない。
 * @param {{dx: number, dy: number}} delta 方向を限定した移動量
 * @param {number|null} step 刻み
 * @returns {{dx: number, dy: number}} 丸めた移動量（新しいオブジェクト）
 */
export function roundConstrainedDeltaToUnit(delta, step) {
    if (!isRoundingStep(step)) {
        return { dx: delta.dx, dy: delta.dy };
    }
    const { dx, dy } = delta;
    if (dx === 0 && dy === 0) {
        return { dx: 0, dy: 0 };
    }
    if (dy === 0) {
        return { dx: roundScalarToUnit(dx, step), dy: 0 };
    }
    if (dx === 0) {
        return { dx: 0, dy: roundScalarToUnit(dy, step) };
    }
    const s = roundScalarToUnit((Math.abs(dx) + Math.abs(dy)) / 2, step);
    const rx = Math.sign(dx) * s;
    const ry = Math.sign(dy) * s;
    return { dx: rx === 0 ? 0 : rx, dy: ry === 0 ? 0 : ry };
}

/**
 * (d) 基準点`origin`からの移動量を丸めた位置を返す（頂点のハンドルのドラッグが使う）。
 * 基準点が小数の座標でも小数の部分が保たれる（`origin + 丸めた移動量`）。
 * 刻みが正の有限の数値でないときは`{ x: target.x, y: target.y }`をそのまま返し、`origin + (target − origin)`は計算しない
 * （浮動小数の誤差で今の値と変わってしまうため）。結果に`-0`は含めない。引数を書き換えない。
 * @param {{x: number, y: number}} origin 基準点（ドラッグ開始時のハンドルの位置）
 * @param {{x: number, y: number}} target 目標の点（カーソル位置）
 * @param {number|null} step 刻み
 * @returns {{x: number, y: number}} 丸めた位置（新しいオブジェクト）
 */
export function roundPointFromOriginToUnit(origin, target, step) {
    if (!isRoundingStep(step)) {
        return { x: target.x, y: target.y };
    }
    const d = roundDeltaToUnit({ dx: target.x - origin.x, dy: target.y - origin.y }, step);
    const x = origin.x + d.dx;
    const y = origin.y + d.dy;
    return { x: x === 0 ? 0 : x, y: y === 0 ? 0 : y };
}
