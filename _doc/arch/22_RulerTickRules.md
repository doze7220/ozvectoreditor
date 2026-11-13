*   **RulerTickRules.js**：定規の目盛りの位置（ワールド座標と太線か）と数字の文字列の規則を、状態を持たない関数として提供する（Phase 07-03で新設）。
    *   **公開**：`computeRulerTicks(minValue, maxValue, minorSpacing, majorSpacing)` → `Array<{ value, major }>`（`value`の昇順。typedef`RulerTick`）、`formatRulerLabel(value)` → 整数の文字列。
    *   **契約**：`minValue`〜`maxValue`（両端を含む）にある細線の位置を「整数インデックス × `minorSpacing`」で求める（加算の誤差を累積させない）。`major`は`majorSpacing / minorSpacing`の倍数のインデックス。`value`の`-0`は`0`へ正規化する。引数が有限の数でない・間隔が正でない・太線が細線より細かい・`minValue > maxValue`のときは空配列を返し、例外を投げない。`formatRulerLabel`は`Math.round`した整数で、`-0`は`'0'`。
    *   **読むもの**：なし（何もimportしない。DOM・`ctx`に触れない）。
    *   **使う側**：`core/RulerRenderer`のみ。
    *   **知らないこと**：描画・ビュー変換・表示倍率（間隔は呼び出し側が`GridSpacingRules`で求めて渡す）。
    *   **テスト**：`test/core/RulerTickRules.test.js`。
