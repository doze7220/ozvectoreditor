*   **ViewTransform.js**：キャンバスのビュー変換状態（倍率`scale`・オフセット`offsetX`/`offsetY`、`スクリーン = ワールド × 倍率 ＋ オフセット`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する。
    *   **公開メソッド**：`getScale`・`getState`・`screenToWorld`・`worldToScreen`・`screenLengthToWorld`・`zoomAt`・`panBy`・`reset`・`setView`・`onChange`。静的定数`MIN_SCALE`・`MAX_SCALE`。
    *   **契約**：`zoomAt`はクランプ時もカーソル下のワールド点が不変。`panBy`はスクリーン座標。値が実際に変化した場合のみ`onChange`リスナーへ通知する。`setView(scale, offsetX, offsetY)`は倍率とオフセットを一括で設定する（設定だけで変換式は持たない）：倍率は`MIN_SCALE`〜`MAX_SCALE`に収め、収めた後の値が今と同じなら通知しない・変われば通知1回・不正な値（倍率が正の有限の数でない、オフセットが有限の数でない）は`console.warn`して何もしない。呼び出し元は`main.js`の`fitViewToShapes`（全体を画面に収める。3章15.）。
    *   **知らないこと**：図形データ・DOM・`VectorModel`・`CanvasManager`。
