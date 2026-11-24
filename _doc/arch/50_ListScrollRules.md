*   **ListScrollRules.js**：図形の一覧の、見えている行の範囲・選択が変わったかの判定・強調（選択または描き込む先の印）が変わったかの判定・強調の行へのスクロール位置を、状態を持たない関数として提供する（Phase 11-02で新設。流れは`PROJECT_ARCHITECTURE.md`3章28.）。
    *   **公開**：`resolveVisibleRowRange`・`hasSelectionChanged`・`hasHighlightChanged`（Phase 11-03）・`resolveSelectionScrollTop`。
    *   **`resolveVisibleRowRange({ scrollTop, height, rowHeight, rowCount, overscan = 0 })`** → `{ start, end }`：見えている行の添字の範囲（`end`は含まない）。前後に`overscan`行の余裕を足し、`0`〜`rowCount`に収める。行数・高さ・行の高さのどれかが正でなければ`{ start: 0, end: 0 }`。サムネイルを描く行の範囲に使う（`wiring/ItemListWiring`が余裕4行で呼ぶ）。
    *   **`hasSelectionChanged(previousIds, nextIds)`**：集合として違えば真（並びの違いは同じとみなす）。「前」は選択集合の写しではなく、今の**表示**（`panel.getSelectedRowIds()`）を渡す（一覧は選択集合の写しを持たない。2章）。
    *   **`hasHighlightChanged({ previousSelectedIds, selectedIds, previousMarkId, markId })`**（Phase 11-03）：強調が変わったか。`hasSelectionChanged(previousSelectedIds, selectedIds)`が真、または印のidが違えば真。`wiring/ItemListWiring.sync`が、真なら選ばれている行（無ければ印の行）の添字を`resolveSelectionScrollTop`へ渡してスクロールする（見えていれば動かない）。一覧で押して変わったときは`sync({ allowScroll: false })`を先に呼ぶため動かない。
    *   **`resolveSelectionScrollTop({ selectedIndexes, scrollTop, height, rowHeight })`** → `number | null`：選ばれている行が無い・`height`か`rowHeight`が正でないなら`null`。**行の中心が見えている範囲（`scrollTop`以上`scrollTop + height`未満）にある**行が1つでもあれば`null`（動かさない）。そうでなければ、いちばん上の選ばれている行が全部見える最小の移動（上にあればその行の上端、下にあれば`行の下端 − height`。`rowHeight > height`なら上端）。「行が見えている」を行の中心で決めるのは計画での判断。
    *   **読むもの・知らないこと**：渡された数値と配列だけ。何もimportしない。DOM・`VectorModel`・図形を知らない。引数を書き換えない。
    *   **使う側**：`wiring/ItemListWiring`だけ（`sync`・`#drawVisibleThumbnails`）。
    *   **テスト**：`test/core/ListScrollRules.test.js`（27件。22件＋Phase 11-03の`hasHighlightChanged`の5件。`_doc/arch/16_test.md`）。
