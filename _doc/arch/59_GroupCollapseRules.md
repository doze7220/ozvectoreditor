*   **GroupCollapseRules.js**：フォルダの折りたたみの規則（閉じる/開く・図形を含む閉じたフォルダを開く・取り除く・今の状態を引き継ぐ）を、状態を持たない関数として提供する（Phase 11-04aで新設。持ち方は2章「アイテム」、流れは`PROJECT_ARCHITECTURE.md`3章6.・9.・28.）。
    *   **持ち方**：フォルダのアイテムの属性`collapsed`。**閉じているときだけ`collapsed: true`のキーを持つ**（開いているときはキー自体が無い。既存の作業データ・テストの形を変えないため）。図形のアイテムには付けない。整えるのは`ItemAttributeRules.resolveItems`。
    *   **公開**：`setCollapsed(items, id, collapsed)`・`expandGroupsContaining(items, shapeIds, canExpand)`・`withoutCollapsed(items)`・`listCollapsedIds(items)`・`restoreCollapsed(items, currentItems, recordedIds)`。
    *   **`setCollapsed(items, id, collapsed)`**：idのフォルダを閉じる（`collapsed: true`）／開く（キーを消す）。変わらない（idのフォルダが無い・すでにその状態）ときは**同じ参照**を返す（`VectorModel.setGroupCollapsed`が「変わらない」の判定に使う）。
    *   **`expandGroupsContaining(items, shapeIds, canExpand)`**：`shapeIds`の図形を含む閉じたフォルダ（入れ子の上のすべて）のうち、`canExpand(id)`が真のものを開く。`canExpand`が偽のフォルダの上のフォルダも、対象の図形を含んでいれば開く。変わらなければ同じ参照。`VectorModel.#applyState`が「変わる前の`#items`にあったフォルダだけ」を`canExpand`で渡す（インポートしたフォルダの折りたたみを保つため）。
    *   **`withoutCollapsed(items)`・`listCollapsedIds(items)`**：すべてのフォルダから`collapsed`のキーを取り除いた新しい入れ子（図形のアイテムも写す）と、閉じているフォルダのidを前順で返す。`SnapshotAdapter.capture`が、履歴の記録から折りたたみを外して別に`collapsedGroupIds`として持つために使う（折りたたみは取り消しの対象外）。
    *   **`restoreCollapsed(items, currentItems, recordedIds)`**（今の状態を保つ判定の1か所）：`items`のフォルダ（入れ子の中も含む）ごとに、`currentItems`に同じidのフォルダがあればその今の折りたたみ、無ければ`recordedIds`に含まれるときだけ閉じる。`items`側の`collapsed`は使わない。`SnapshotAdapter.restore`が`replaceAllShapes`へ渡す前に通す（取り消し/やり直しをしても今の折りたたみが保たれ、取り消しで復活したフォルダだけ記録のとおりになる）。
    *   **契約**：引数を書き換えず、新しい入れ子を返す（変わらない関数は同じ参照を返すことがある）。図形のアイテムは共有または写し。
    *   **読むもの**：渡された入れ子の`kind`・フォルダの`id`・`collapsed`・`children`と図形の`shape.id`（`itemIdOf`）だけ。
    *   **知らないこと**：DOM・`VectorModel`・選択・図形種別・作業データ形式・履歴。importは`core/ItemTreeRules`（`ITEM_KIND`）・`core/GroupTreeRules`（`itemIdOf`）のみ。
    *   **使う側**：`core/VectorModel`（`setCollapsed`・`expandGroupsContaining`）・`edit/SnapshotAdapter`（`withoutCollapsed`・`listCollapsedIds`・`restoreCollapsed`）。
    *   **テスト**：`test/core/GroupCollapseRules.test.js`（16件。`_doc/arch/16_test.md`）。
