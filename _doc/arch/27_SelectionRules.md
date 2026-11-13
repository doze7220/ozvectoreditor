*   **SelectionRules.js**：クリック・範囲選択の次の選択の指示と、選択の反転の結果を、状態を持たない関数として提供する（Phase 07-04で新設）。
    *   **公開**：`resolveClickSelection(selectedIds, hitId, additive)`・`resolveMarqueeSelection(selectedIds, hitIds, additive)`・`invertSelection(allIds, selectedIds)`と、typedef`SelectionChange`（`{ type: 'set', ids }`＝`setSelection(ids)`へ渡す置き換え／`{ type: 'clear' }`＝`clearSelection()`＝全解除／`null`＝何もしない。**正本はこのファイル**）。
    *   **契約**：`additive`（`Ctrl`押下）が偽のときの結果は、従来の`InputTracker`の`VectorModel`の呼び出し（回数と引数）と1対1で一致する（クリック：当たれば`set([bodyId])`・空白で選択があれば`clear`・なければ`null`、範囲選択：0件でも`set([])`）。真のとき、クリックは空白で`null`（解除しない）・選択中の図形は外す・未選択は末尾へ追加、範囲選択は既存の選択へ未選択のものだけ足し（重複しない）0件なら`null`。「置き換え」と「全解除」を区別して返すのは、`Ctrl`なしで従来と同じ`VectorModel`の呼び出しを再現するため。`invertSelection`は`allIds`のうち選択中でないものを`allIds`の並びで返す。引数を書き換えず、新しい配列を返す。
    *   **読むもの・知らないこと**：なし（何もimportしない。DOM・`VectorModel`・図形・修飾キーのイベントを知らない。`Ctrl`の読み取りは呼び出し側）。
    *   **使う側**：`core/InputTracker`（`handleClick`・`#commitMarquee`が`resolve…`の結果を非公開の`#applySelectionChange`で`model`へ受け渡す。`Ctrl`を見るのは`click`・範囲選択の終了のイベント）と、`main.js`（`performInvertSelection`が`invertSelection`の結果を`model.setSelection`へ渡す）。
    *   **置き場所の理由**：`InputTracker`と`main.js`の両方から使うため（`PointHitRules`は`InputTracker`だけ、`ToolRules`は`main.js`だけが使う。1章「フォルダ分割の方針」）。規則を`node --test`で確かめるためでもある。`InputTracker`の再分離ではない。
    *   **注意**：`Ctrl`なしの結果を変えると、クリック選択・範囲選択の従来の動きが変わる（選択のない空白のクリックで`clearSelection()`を呼ばない点など）。テストで確かめる。
    *   **テスト**：`test/core/SelectionRules.test.js`（`_doc/arch/16_test.md`）。
