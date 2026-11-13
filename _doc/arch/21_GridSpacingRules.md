*   **GridSpacingRules.js**：表示倍率からグリッドの細線・太線の間隔（ワールド座標の長さ）を求める規則を、状態を持たない関数として提供する（Phase 07-03で`CanvasManager`から切り出した）。
    *   **公開**：`computeGridSpacing(scale)` → `{ minor, major }`。定数（基準の間隔・画面上の最小の間隔・繰り上げの最大回数）は非公開。細線の間隔は10から始め、画面上の間隔が8px未満の間は10倍ずつ繰り上げ、太線は細線の10倍。
    *   **契約**：不正な倍率でも例外を投げず停止する（`0`・負の値は上限まで繰り上げて細線`1e11`、`NaN`・`Infinity`は細線`10`）。呼び出し側は正の有限の倍率だけを描画に使う（倍率の検査は`CanvasManager`に残る）。切り出し前の式と同じ結果で、グリッドの見た目は変わらない。
    *   **読むもの**：なし（何もimportしない）。
    *   **使う側**：`core/CanvasManager`（`#drawGrid`）・`core/RulerRenderer`（定規の目盛りの間隔）・`main.js`（`syncGridSizeReadout`のグリッド1マスの表示）。同じ関数を3か所が使う（間隔の規則を二重に書かない。ズームで繰り上がるとグリッド・定規・ステータスバーが同時に変わる）。
    *   **知らないこと**：DOM・描画・ビュー変換の状態・表示の状態。
    *   **置き場所の理由**：`CanvasManager`の中の定数と繰り上げの処理を、`RulerRenderer`と`main.js`も使えるように状態を持たない規則として切り出した（`CanvasManager`は`RulerRenderer`・`main.js`から規則だけを取り出せないため）。
    *   **テスト**：`test/core/GridSpacingRules.test.js`（切り出し前の式を参照用の補助関数として多数の倍率で比べる）。
