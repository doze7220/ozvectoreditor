*   **SpriteFitRules.js**：スプライトの外枠（`bounds`）と描画先の大きさ・余白から、外枠を余白の内側へ収めて中央に置くための倍率と平行移動を、状態を持たない関数として提供する（Phase 08-02aで新設）。
    *   **公開**：`computeSpriteFitTransform(bounds, width, height, padding = 0)` → `{ scale, offsetX, offsetY }`または`null`。定義は`スクリーン = ワールド × scale + offset`（`ViewTransform`・`ViewFitRules`と同じ向き）。
    *   **規則の要約（正本はJSDoc）**：`bounds`が`null`・オブジェクトでない・4つの値が有限でない・`minX > maxX`／`minY > maxY`なら`null`。`width`・`height`が有限の正の数でない、`padding`が有限の0以上でない、余白を引いた領域が0以下のときも`null`。外枠の幅・高さが0の軸は倍率の制約にせず（両方0＝点なら`scale = 1`）、それ以外は`min(使える幅 / 外枠の幅, 使える高さ / 外枠の高さ)`。拡大も行い、上限・下限は設けない。引数を書き換えず、戻り値は毎回新しいオブジェクト。
    *   **読むもの・知らないこと**：何もimportしない（`asset/`のファイルもimportしない）。DOM・`<canvas>`・スプライトJSの中身・図形・`ViewTransform`を知らない。`bounds`はスプライトデータ（書き出し形式。2章）の`bounds`の形（`SpriteSerializer`が作るワールド座標の外枠）を受け取るだけ。
    *   **使う側**：`wiring/ToolIconWiring`（`_doc/arch/39_ToolIconWiring.md`）と、`core/ThumbnailRules`（`computeThumbnailFit`。図形の一覧のサムネイルの収め方。Phase 11-02。`core/`の規則どうしのimport。`_doc/arch/51_ThumbnailRules.md`）。`core/`の中では`ThumbnailRules`以外から使われない。
    *   **置き場所の理由**：収める計算を`node --test`で確かめるため（`ToolIconWiring`はDOM・Canvasに依存し確かめられない）。`wiring/`は判定・計算の規則を持たない方針のため、`core/`に状態を持たない関数として置いた。`core/`は`asset/`をimportしないため、ここは何もimportしない。
    *   **注意**：`ViewFitRules.computeFitView`とは別の定義（あちらは表示倍率の上限・下限があり、`ViewTransform`のオフセットを返す。こちらは上限・下限がなく拡大もする）。
    *   **テスト**：`test/core/SpriteFitRules.test.js`（16件。`_doc/arch/16_test.md`）。
