*   **DisplayState.js**：表示の状態（アウトライン表示・背景の白/黒・グリッドの表示・フロートウィンドウの表示）の保持・切り替え・変更通知のみを担う、表示専用の状態（`ViewTransform`と同じ位置づけ。Phase 07-03で新設）。
    *   **公開**：`getState()`（呼ぶたびに新しいプレーンオブジェクト`DisplayStateSnapshot`＝`outline`・`darkBackground`・`gridVisible`・`floatWindowsVisible`を返す。書き換えても内部は変わらない）・`isOutline()`・`isFloatWindowsVisible()`（`InputTracker`・`PaletteLauncher`へ注入する照会に使い、`main.js`で否定を書かないため）・`setOutline`・`setDarkBackground`・`setGridVisible`・`setFloatWindowsVisible`・`toggleOutline`・`toggleBackground`・`toggleGrid`・`toggleFloatWindows`・`onChange`。初期値はアウトラインOFF・背景は白・グリッド表示・ウィンドウ表示。
    *   **契約**：`set…`は真偽値でない値なら`console.warn`して何もしない。値が変わらなければ通知しない、変われば1回通知する。`toggle…`は反転して1回通知する（中身は`set…`を`!現在値`で呼ぶ）。`onChange`は関数以外を無視する。
    *   **読むもの**：なし（何もimportしない。DOM・`VectorModel`・`CanvasManager`・図形を知らない）。
    *   **使う側**：`main.js`だけが1つ生成して持つ。通知`displayState.onChange` → `renderCurrentState`・`syncViewToggleGroup`・`syncFloatWindowVisibility`（3章15.）。ボタン（▢◐▦・🧰）とキー（`Z`・`X`・`C`・`Tab`）は同じ`toggle…`を呼び、`InputTracker`には`isOutline()`、`PaletteLauncher`には`isFloatWindowsVisible()`・`setFloatWindowsVisible(true)`が注入される。
    *   **知らないこと／知られないこと**：`VectorModel`・`InputTracker`・`CanvasManager`・`CanvasLibrary`・`SnapshotAdapter`・`HistoryManager`・`DocumentSerializer`は表示の状態を知らない。作業データ・スナップショット・書き出し・保存先に含まれず、履歴の対象でもない。
    *   **置き場所の理由**：表示専用の状態で、`ViewTransform`と同じく`core/`に置く。キャンバスの切り替え（開く・新規作成・開く（ファイル）・削除後・取り消し/やり直し・`?dev`の復元）では触れないため保たれ、ページを開き直すと初期値に戻る。
    *   **注意**：項目を足すときは`DisplayStateSnapshot`と`palette/ViewToggleGroup.js`のtypedef`ViewToggleView`（一部の写し）を揃える。
    *   **テスト**：`test/core/DisplayState.test.js`。
