*   **RulerRenderer.js**：定規（横・縦の2本）の`<canvas>`への純粋な描画（目盛り・数字・カーソル位置の印）のみを担う、`CanvasManager`と同じ「引数だけから毎回描く、状態を持たないレンダラー」（Phase 07-03で新設）。
    *   **公開メソッド**：`constructor(horizontalCanvas, verticalCanvas)`・`resize()`・`render({ view, cursor = null })`。呼び出し元は`main.js`（`renderRulers()`・ウィンドウの`resize`）。
    *   **契約**：保持するのは2つの`<canvas>`要素・2Dコンテキスト・dprのみ。どちらかの要素が無いと`console.warn`して以後`resize`・`render`は何もしない。`resize()`は`CanvasManager.resize()`と同じ考え方で内部バッファを要素の大きさ×dprへ合わせ、`render`は呼ばない（要素が表示されて大きさを持ってから呼ぶ。大きさが0だと内部バッファは1pxになる）。**`render`の`view`（`{ scale, offsetX, offsetY }`。`viewTransform.getState()`）は必須で、`DEFAULT_VIEW`は持たない**（`CanvasManager`と同じ値の定数を2ファイルに持たないため）。`cursor`はキャンバス要素左上基準のスクリーン座標`{x, y}`または`null`。2本とも毎回全体を消してから描く。`view`が渡されない・倍率が正の有限値でなければ、例外を投げず目盛り・数字を描かない（2本を消すだけ。カーソル位置の印は`cursor`があれば描く）。
    *   **読むもの**：`GridSpacingRules.computeGridSpacing`（グリッドと同じ間隔）・`RulerTickRules`（目盛りの位置と数字）のみをimportする。`ViewTransform`・`DisplayState`・`VectorModel`はimportしない。
    *   **位置の写し方**：横の定規の左端・縦の定規の上端はCSSでキャンバスの領域の左端・上端にそろえてあるため、定規の位置＝キャンバスのスクリーン座標の同じ軸の値。ビュー変換値を`DOMMatrix`として組み、逆行列で定規の両端のワールドの範囲を求め、行列で各目盛りを写す（`CanvasManager`の可視範囲と同じ考え方で、変換式を手で書かない。ビューに回転を足す場合は見直す）。
    *   **描き方**：CSSピクセルで描き（位置を画素に丸めない＝グリッドの線と同じ位置に出る）、細線は短い目盛り、太線は定規の太さいっぱいの目盛りと数字。縦の定規の数字は`-90°`回転して太線の下側に描く。カーソル位置の印は1pxの線（`cursor`が`null`なら描かない）。目盛り・数字・印の色とフォントはファイル内の定数で、背景の白/黒によらず一定。**地の色は描かず**（`<canvas>`は透明に消し）、CSSの`.ruler`の背景（`--frame-background-color`。ツールバー・ステータスバー・角と共有）が見える。
    *   **知らないこと**：図形・選択・表示の状態・ビュー変換の状態（値は引数で受け取る）。
    *   **テスト**：対象外（テストプレイで確かめる。規則は`RulerTickRules`・`GridSpacingRules`のテスト）。
