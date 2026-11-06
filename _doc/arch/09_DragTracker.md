*   **DragTracker.js**：マウスボタン押下から解放までの1回のドラッグ操作のライフサイクル（開始ボタン・移動量閾値の判定、`window`へのcapture購読による追従/終了検知、blur時の中断、終了直後のclick抑止）を担う。
    *   **公開メソッド**：`begin`・`isActive`・`hasMoved`・`cancel`・`consumeSuppressedClick`・`clearSuppressedClick`。
    *   **知らないこと**：ドラッグの意味（パン・範囲選択等）。`InputTracker`・`VectorModel`・`ViewTransform`・canvasをimport/参照しない。依存方向は`InputTracker`→`DragTracker`の一方向。スクリーン座標取得関数のみ注入される。
    *   **契約**：座標はすべてスクリーン座標。`threshold > 0`では初回`onMove`の`prevScreen`は閾値超過直前の`mousemove`の位置で、押下点とは限らない（累積移動量が必要な呼び出し側は押下時点の座標を自前で記憶する）。
