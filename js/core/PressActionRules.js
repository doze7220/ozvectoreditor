/**
 * 責務: 選択モードと頂点の選択のモードのそれぞれで、マウスを押したときの当たり分類の結果から「何の操作を始めるか」を決める判定表を、
 * 状態を持たない関数として提供する。
 * 外枠のハンドル（選択モードの拡大縮小）の押下は第3引数、回転の範囲（外枠の角の外側）の押下は第4引数で受け、判定表の先頭の行として扱う。
 * 引数を書き換えない。importなし・DOMなし。
 */

/**
 * 押下で始める操作の指示。`InputTracker`が今の非公開メソッドへ振り分けるために使う。
 * - `{ type: 'scaleSelection', handle }`：外枠のハンドルでの拡大縮小を始める。`handle`は外枠のハンドル名（`scaleHandle`をそのまま返す）。
 * - `{ type: 'rotateSelection', corner }`：回転の範囲での回転を始める。`corner`は押した角の名前（`rotationCorner`をそのまま返す）。
 * - `{ type: 'moveSelection' }`：選択集合の平行移動を始める。
 * - `{ type: 'marquee' }`：範囲選択を始める。
 * - `null`：何もしない（離した後のclickで判定する）。
 * @typedef {({type: 'scaleSelection', handle: string} | {type: 'rotateSelection', corner: string} | {type: 'moveSelection'} | {type: 'marquee'} | null)} PressAction
 */

/**
 * 押下点の当たり分類の結果から、始める操作を決める。以下の順に判定する。
 * ・外枠のハンドルあり（scaleHandleが空でない文字列） → scaleSelection（図形の本体より優先。hit・isSelectedは見ない）
 * ・回転の範囲あり（rotationCornerが空でない文字列） → rotateSelection（外枠のハンドルの次。図形の本体より優先。hit・isSelectedは見ない）
 * ・本体（bodyId）が選択集合内       → moveSelection（本体ドラッグ。単一選択でも有効）
 * ・本体（bodyId）が選択集合外       → null（何も始めない。離した後のclickで判定する）
 * ・空白（bodyIdがnull）             → marquee（範囲選択）
 * isSelectedを呼ぶのは本体の判定のときだけ（外枠のハンドルがあるとき・回転の範囲があるとき・空白のときは呼ばない）。isSelectedを呼ぶときの引数はhit.bodyId。
 * scaleHandle・rotationCornerを省いた（またはnull・空文字の）ときは、これまでと同じ結果・同じisSelectedの呼び出しになる（以下の順のうち回転の範囲を除く）。
 * 注：この関数は選択モード用で、頂点の選択モードの外枠のハンドルは呼び出し側が渡さない（規則が出さない）。
 * hit.handleは読まない（選択モードの当たり分類はハンドルを調べないため、常にnull）。
 * @param {import('./PointHitRules.js').PointHit} hit 押下点の当たり分類の結果（書き換えない）
 * @param {(id: string) => boolean} isSelected 図形が選択集合に入っているかの照会
 * @param {string|null} [scaleHandle] 押下点の外枠のハンドル名（ScaleHandleRulesのhitTestScaleHandleの結果）。省略・nullは外枠のハンドルなし
 * @param {string|null} [rotationCorner] 押下点の回転の範囲の角の名前（RotationRulesのhitTestRotationZoneの結果）。省略・nullは回転の範囲なし
 * @returns {PressAction} 始める操作（新しいオブジェクト）
 */
export function resolvePressAction(hit, isSelected, scaleHandle = null, rotationCorner = null) {
    if (typeof scaleHandle === 'string' && scaleHandle !== '') {
        return { type: 'scaleSelection', handle: scaleHandle };
    }

    if (typeof rotationCorner === 'string' && rotationCorner !== '') {
        return { type: 'rotateSelection', corner: rotationCorner };
    }

    if (hit.bodyId && isSelected(hit.bodyId)) {
        return { type: 'moveSelection' };
    }

    if (hit.bodyId === null) {
        return { type: 'marquee' };
    }

    return null;
}

/**
 * 頂点の選択モードで押下したときに始める操作の指示。`InputTracker`が今の非公開メソッドへ振り分けるために使う。
 * - `{ type: 'dragSelectedVertices', target }`：選んでいる頂点すべてのドラッグを始める。`target`は`hit.handle`そのもの。
 * - `{ type: 'selectVertexAndDrag', target }`：その頂点だけを選び直してドラッグを始める。`target`は`hit.handle`そのもの。
 * - `{ type: 'marquee' }`：範囲選択を始める。
 * - `null`：何もしない（離した後のclickで選択へ追加・解除する）。
 * @typedef {({type: 'dragSelectedVertices', target: {shapeId: string, handle: string}} | {type: 'selectVertexAndDrag', target: {shapeId: string, handle: string}} | {type: 'marquee'} | null)} VertexPressAction
 */

/**
 * 頂点の選択モードで、押下点の当たり分類の結果から、始める操作を決める。以下の順に判定する。
 * ・ハンドルあり・その頂点が選ばれている                 → dragSelectedVertices（選んでいる頂点すべてのドラッグ）
 * ・ハンドルあり・選ばれていない・additiveが偽            → selectVertexAndDrag（その頂点だけを選び直してドラッグ）
 * ・ハンドルあり・選ばれていない・additiveが真            → null（何も始めない。離した後のclickで追加・解除する）
 * ・ハンドルなし（本体の上・空白のどちらでも）            → marquee（範囲選択）
 * isVertexSelectedを呼ぶのはhit.handleがあるときだけで1回（引数はhit.handle.shapeId・hit.handle.handle）。
 * 頂点のハンドルだけに絞り込むのはPointHitRules（hit.handleは頂点のハンドルだけ）。
 * @param {import('./PointHitRules.js').PointHit} hit 押下点の当たり分類の結果（書き換えない）
 * @param {(shapeId: string, handle: string) => boolean} isVertexSelected その頂点が選ばれているかの照会
 * @param {boolean} additive Ctrl（⌘）が押されているか（真偽値として読むだけ）
 * @returns {VertexPressAction} 始める操作（新しいオブジェクト。targetだけはhit.handleそのもの）
 */
export function resolveVertexPressAction(hit, isVertexSelected, additive) {
    if (hit.handle) {
        if (isVertexSelected(hit.handle.shapeId, hit.handle.handle)) {
            return { type: 'dragSelectedVertices', target: hit.handle };
        }
        if (!additive) {
            return { type: 'selectVertexAndDrag', target: hit.handle };
        }
        return null;
    }

    return { type: 'marquee' };
}
