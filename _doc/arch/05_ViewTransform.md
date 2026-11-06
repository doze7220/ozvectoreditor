*   **ViewTransform.js**：キャンバスのビュー変換状態（倍率`scale`・オフセット`offsetX`/`offsetY`、`スクリーン = ワールド × 倍率 ＋ オフセット`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する。
    *   **公開メソッド**：`getScale`・`getState`・`screenToWorld`・`worldToScreen`・`screenLengthToWorld`・`zoomAt`・`panBy`・`reset`・`onChange`。静的定数`MIN_SCALE`・`MAX_SCALE`。
    *   **契約**：`zoomAt`はクランプ時もカーソル下のワールド点が不変。`panBy`はスクリーン座標。値が実際に変化した場合のみ`onChange`リスナーへ通知する。
    *   **知らないこと**：図形データ・DOM・`VectorModel`・`CanvasManager`。
