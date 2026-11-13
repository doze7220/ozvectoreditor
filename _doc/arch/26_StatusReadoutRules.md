*   **StatusReadoutRules.js**：ステータスバーの座標・大きさ・グリッドの表示の文字列の規則を、状態を持たない関数として提供する。文言・記号（`X:`・`Y:`・`W:`・`H:`・`グリッド:`・`—`・項目の間の半角空白2つ）の唯一の定義箇所（Phase 07-03で新設）。
    *   **公開**：`formatReadoutNumber(value)`（有限の数でなければ`—`。それ以外は小数第1位に丸めて固定の小数第1位。`-0`・`-0.04`は`0.0`）・`formatCursorReadout(point)`（`X: 120.5  Y: -40.0`。`null`なら`X: —  Y: —`）・`formatSizeReadout(bounds)`（幅＝`maxX − minX`・高さ＝`maxY − minY`。`W: 120.0  H: 80.0`。`null`なら`W: —  H: —`）・`formatGridReadout(spacing)`（`グリッド: 10px`。整数のまま。有限の数でなければ`グリッド: —`）。文言は非公開の`Object.freeze`した定数。
    *   **読むもの**：なし（何もimportしない）。
    *   **使う側**：`main.js`だけ（`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`。`ToolRules`と同じ「`main.js`から使うUIの表示の規則」の位置づけ）。
    *   **知らないこと**：DOM・座標の求め方・外枠の求め方（値は引数で受け取る）。
    *   **注意**：大きさを座標と同じ固定の小数第1位にしているのは、桁が変わって右側の項目が揺れないため。整数だけで表示したい場合は`formatSizeReadout`の1か所を変える。
    *   **テスト**：`test/core/StatusReadoutRules.test.js`。
