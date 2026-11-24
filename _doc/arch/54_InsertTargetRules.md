*   **InsertTargetRules.js**：新しい図形が入る位置を決める「描き込む先」の決まり方と、一覧で印を出す行の規則を、状態を持たない関数として提供する（Phase 11-03で新設。流れは`PROJECT_ARCHITECTURE.md`2章・3章28.）。
    *   **公開**：`resolveInsertTarget({ previousIds, ids, selectedIds, targetId })`・`resolveInsertMarkId({ selectedCount, insertTargetId })`のみ。
    *   **`resolveInsertTarget`**：変わった後の描き込む先（図形のid。無ければ`null`）を決める。`previousIds`＝変わる前の図形id（描画順）、`ids`＝変わった後の図形id（描画順）、`selectedIds`＝変わった後の選択集合（`Set`）、`targetId`＝候補。上から順に、最初に当たったものを返す。(1) `ids`のうち`selectedIds`にあるものが1つ以上 → その最後（＝一番上の行）／(2) `targetId`が`null` → `null`／(3) `ids`に`targetId`がある → `targetId`／(4) `previousIds`の`targetId`の位置から先頭へ向かって（＝下の行へ）たどり、`ids`に残っている最初のもの／(5) 無い（`previousIds`にも無い場合を含む） → `null`。これにより選択が1つ以上あれば、描き込む先は必ず「選ばれている一番上の行」で、選択・図形一式と食い違う状態を作れない。引数を書き換えない。
    *   **`resolveInsertMarkId`**：一覧で印を出す行のid。選択が1つ以上（`selectedCount > 0`）なら`null`（選ばれた行の見た目が優先）、そうでなければ`insertTargetId`（無ければ`null`）。
    *   **読むもの**：渡された配列・`Set`・id だけ。importなし。
    *   **知らないこと**：DOM・`VectorModel`・図形・操作モード・履歴。状態を持たない。保存しない。
    *   **使う側**：`core/VectorModel`（`#applyState`が書き込みのたびに`resolveInsertTarget`を呼ぶ。状態を持つクラスが規則をimportする向き）、`wiring/ItemListWiring`（`sync`が`resolveInsertMarkId`で印の行を決める）。
    *   **置き場所の理由**：描き込む先の決まり方の唯一の定義箇所にするため、また`node --test`で確かめるため、状態を持たない関数として`core/`に置いた（`VectorModel`は規則を知らず持ち主であるだけ）。
    *   **テスト**：`test/core/InsertTargetRules.test.js`（12件。`_doc/arch/16_test.md`）。
