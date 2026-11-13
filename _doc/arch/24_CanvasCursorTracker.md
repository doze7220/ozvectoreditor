*   **CanvasCursorTracker.js**：キャンバス上の最後のカーソル位置（スクリーン座標。キャンバスの外なら「なし」）の保持と変更通知のみを担う（Phase 07-03で新設。キャンバスの`mousemove`・`mouseleave`の購読を含むため、`InputTracker`へは入れず分けた）。
    *   **公開メソッド**：`constructor(canvas, { getScreenPoint, screenToWorld })`・`getScreenPosition()`（`{x, y}`のコピーまたは`null`。定規の印に使う）・`getWorldPosition()`（呼んだ時点の`screenToWorld`の結果または`null`。ステータスバーの座標に使う。ビュー変換が変わった後に呼べば、最後のカーソル位置から求め直した値になる）・`onChange(callback)`（関数以外は無視）。
    *   **注入**：`getScreenPoint`・`screenToWorld`が関数でなければ`Error`。`main.js`が`(event) => inputTracker.getScreenCoordinate(event)`と`(x, y) => viewTransform.screenToWorld(x, y)`を渡す（スクリーン座標の求め方・変換を二重に書かない）。
    *   **契約**：`mousemove`で位置を記録し、前と違うときだけ通知する。`mouseleave`で「なし」にし、前が「なし」でなければ通知する。ページを開いた直後（まだ`mousemove`が無い）は「なし」。
    *   **動き（実コードで確認済み）**：ドラッグ中・パン中もキャンバス要素の`mousemove`は発火するため、カーソルがキャンバスの上にある間は追跡が続く（パン中は`DragTracker`のwindowのcaptureの`mousemove`が先、続いてキャンバスの`mousemove`が来るため、1回の移動の後の表示は正しい値になる）。ドラッグのままツールバー・定規・ステータスバー・フロートウィンドウの上へ出るとキャンバスの`mouseleave`で「なし」になり、ドラッグ自体は`DragTracker`が続ける。フロートウィンドウはキャンバスの祖先ではない兄弟要素のため、キャンバスからウィンドウへ移ると`mouseleave`で「なし」になる。読み込み中は覆い要素がキャンバスの上にあり`mousemove`が来ないため「なし」のまま。
    *   **使う側**：`main.js`（`renderRulers`と`syncCursorReadout`を`cursorTracker.onChange`へ登録。座標の表示は`viewTransform.onChange`でも求め直す）。通知はキャンバス全体を再描画せず、更新するのは定規とステータスバーの座標の文字だけ。
    *   **知らないこと**：`VectorModel`・`ViewTransform`・図形・`InputTracker`（importしない。必要な関数は注入）。
    *   **注意**：ホバーの強調がキャンバスの外で残る件（カーソルがキャンバスの外へ出ても`InputTracker`のホバーは解除されない）は変えていない。
    *   **テスト**：対象外（`canvas`を購読するためテストプレイで確かめる）。
