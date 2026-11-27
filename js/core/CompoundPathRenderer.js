/**
 * 責務：複合パス（中の図形の輪郭を1つのパスにまとめ、一番下の図形のスタイルで`evenodd`の塗りと線を描く）のCanvas描画のみ。
 * 命令の順は書き出したJSの`compoundPath`の描き方と同じ。状態を持たない。
 */

/**
 * 複合パス1つを描く。`style`の塗りも線も無い（`fillColor`・`strokeColor`が文字列でない）、または`shapes`が空なら何も呼ばない。
 * そうでなければ`beginPath` → 中の図形ごとに`appendOutline` → 塗るなら`fillStyle`・`fill('evenodd')` → 線なら`strokeStyle`・`lineWidth`・`stroke`の順に呼ぶ。
 * 塗りは`isFillable()`を問わず、`fillColor`が文字列なら塗る。図形の`draw`は呼ばず、図形を書き換えない。
 * @param {CanvasRenderingContext2D} ctx - 描画先の2Dコンテキスト
 * @param {{shapes: Object[], style: {strokeColor: *, strokeWidth: *, fillColor: *}}} compound - 効いている複合パス（`CompoundPathRules`の`CompoundPath`・複合パスの描く単位）
 * @returns {void}
 */
export function drawCompoundPath(ctx, compound) {
    const { shapes, style } = compound;
    const hasFill = typeof style.fillColor === 'string';
    const hasStroke = typeof style.strokeColor === 'string';
    if ((!hasFill && !hasStroke) || shapes.length === 0) {
        return;
    }
    ctx.beginPath();
    for (const shape of shapes) {
        shape.appendOutline(ctx);
    }
    if (hasFill) {
        ctx.fillStyle = style.fillColor;
        ctx.fill('evenodd');
    }
    if (hasStroke) {
        ctx.strokeStyle = style.strokeColor;
        ctx.lineWidth = style.strokeWidth;
        ctx.stroke();
    }
}
