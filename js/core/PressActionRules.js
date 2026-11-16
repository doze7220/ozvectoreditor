/**
 * 責務: 選択モードでマウスを押したとき、当たり分類の結果から「何の操作を始めるか」を決める規則を、状態を持たない関数として提供する。
 * 引数を書き換えない。importなし・DOMなし。
 */

/**
 * 移動ハンドル（選択集合の全図形を平行移動するハンドル）の名前。各図形のhitTestHandleの戻り値と一致させる。
 * @type {string}
 */
const MOVE_HANDLE_NAME = 'move';

/**
 * 押下で始める操作の指示。`InputTracker`が今の非公開メソッドへ振り分けるために使う。
 * - `{ type: 'moveSelection' }`：選択集合の平行移動を始める。
 * - `{ type: 'dragHandle', target }`：そのハンドルのドラッグを始める。`target`は`hit.handle`をそのまま返す。
 * - `{ type: 'marquee' }`：範囲選択を始める。
 * - `null`：何もしない（離した後のclickで判定する）。
 * @typedef {({type: 'moveSelection'} | {type: 'dragHandle', target: {shapeId: string, handle: string}} | {type: 'marquee'} | null)} PressAction
 */

/**
 * 押下点の当たり分類の結果から、始める操作を決める。以下の順に判定する。
 * ・ハンドルあり・'move'            → moveSelection（moveハンドル。選択集合の全図形を平行移動）
 * ・ハンドルあり・それ以外（頂点）   → dragHandle（そのハンドルが属する1図形の頂点のみ変形）
 * ・本体（bodyId）が選択集合内       → moveSelection（本体ドラッグ。単一選択でも有効）
 * ・本体（bodyId）が選択集合外       → null（何も始めない。離した後のclickで判定する）
 * ・空白（bodyIdがnull）             → marquee（範囲選択）
 * isSelectedを呼ぶのは本体の判定のときだけ（ハンドルがあるとき・空白のときは呼ばない）。呼ぶときの引数はhit.bodyId。
 * @param {import('./PointHitRules.js').PointHit} hit 押下点の当たり分類の結果（書き換えない）
 * @param {(id: string) => boolean} isSelected 図形が選択集合に入っているかの照会
 * @returns {PressAction} 始める操作（新しいオブジェクト。dragHandleのtargetだけはhit.handleそのもの）
 */
export function resolvePressAction(hit, isSelected) {
    if (hit.handle) {
        if (hit.handle.handle === MOVE_HANDLE_NAME) {
            return { type: 'moveSelection' };
        }
        return { type: 'dragHandle', target: hit.handle };
    }

    if (hit.bodyId && isSelected(hit.bodyId)) {
        return { type: 'moveSelection' };
    }

    if (hit.bodyId === null) {
        return { type: 'marquee' };
    }

    return null;
}
