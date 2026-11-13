*   **ViewFitRules.js**：全体を画面に収める表示倍率とオフセットの計算を、状態を持たない関数として提供する（Phase 07-03で新設）。
    *   **公開**：定数`FIT_VIEW_MARGIN_PX`（40。画面上の余白。各辺）・`computeFitView(bounds, viewportWidth, viewportHeight, { minScale, maxScale, margin })` → `{ scale, offsetX, offsetY }`。
    *   **契約**：`bounds`が`null`（図形0個）なら倍率1・原点が領域の中心（表示のリセットと同じ結果）。それ以外は範囲の幅・高さが正の軸だけで「使える大きさ ÷ 長さ」の最小を倍率とし（両方0なら1）、`minScale`〜`maxScale`に収める（領域が余白より小さくても例外を投げず停止せず、倍率は下限になる）。範囲の中心が領域の中心に写るオフセットを返す。
    *   **読むもの**：なし（何もimportしない。DOMに触れない）。`ViewTransform`の変換の定義を「範囲の中心を領域の中心に置く」向きに解いた配置の計算で、スクリーン⇔ワールドの変換の関数（`screenToWorld`・`worldToScreen`）はここに書かない。
    *   **使う側**：`main.js`の`fitViewToShapes()`のみ（`ShapeExtentReader.getAllBounds()`の結果とキャンバス要素の大きさ、`ViewTransform`の下限・上限を渡し、結果を`viewTransform.setView`へ渡す）。
    *   **知らないこと**：DOM・ビュー変換の状態・フロートウィンドウ（隠れる部分は考慮しない）・ウィンドウの大きさの変化（押した時点の大きさで求める）。
    *   **注意**：`ViewTransform`の変換の定義を変えると、この計算のオフセットの式と食い違う。テストは結果を実物の`ViewTransform`へ設定して`worldToScreen`が領域の中心になることで確かめ、食い違いを検出する。
    *   **テスト**：`test/core/ViewFitRules.test.js`。
