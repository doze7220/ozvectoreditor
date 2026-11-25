# RES: 作業計画・作業レポート (Phase 11-04b) : フォルダ（行のドラッグでの出し入れ・描き込む先・フォルダごとの複製とコピー）
* 参照元REQ: `./_log/req/261125_1000_REQ_Phase11-04b_Folder_Drag_Target_Copy.md`

## 1. 作業目的
フォルダのある絵でも、一覧の行のドラッグで出し入れ・並べ替えができ、新しい図形の入り先（描き込む先）と、コピー・切り取り・貼り付け・複製がフォルダの構成に沿うようにする。

* 作業データの版（4）・書き出し形式の版（4）・履歴のエントリの形・キーの割り当ての表は変えない。描き込む先は保存しない・取り消しの対象にしない。
* **変更しないファイル**：`shapes/`・`io/`・`core/CanvasManager.js`・`core/InputTracker.js`・`core/KeyboardShortcuts.js`・`core/HistoryManager.js`・`core/DragTracker.js`・`core/GroupSelectionRules.js`・`core/GroupCollapseRules.js`・`core/GroupCommandRules.js`・`core/ListSelectionRules.js`・`core/ListScrollRules.js`・`core/ItemAttributeRules.js`・`core/SelectionRules.js`・`edit/ShapeOrderRules.js`・`edit/CanvasLibrary.js`。
* **JSDocだけ直すファイル**（タスク15）：`edit/CanvasFileOperations.js`・`edit/EndpointSnapper.js`・`edit/SnapshotAdapter.js`。
* 計画時点の`node --test`は tests 3192 / pass 3192 / fail 0。
* **行末**：編集の前に`git ls-files --eol <パス>`の`w/`で実測し、保つこと（Git Bashの`grep`で`\r`を数えると誤る）。計画時の実測は、CRLF＝`js/core/`の`GroupTreeRules`・`InsertTargetRules`・`ItemRowRules`・`ListDragRules`、`js/edit/`の`CanvasFileOperations`・`ClipboardController`・`GroupEditor`・`ShapeInserter`・`SnapshotAdapter`、`js/wiring/ItemListRowDrag`、`js/main.js`、`test/core/`の`GroupTreeRules`・`InsertTargetRules`・`ItemRowRules`・`ListDragRules`・`VectorModel.collapse`・`VectorModel.groupSelection`・`VectorModel.rearrangeItems`、`test/edit/`の`GroupEditor`・`GroupEditor.flow`・`InsertTarget.flow`・`ShapeInserter.insertTarget`。LF＝`js/core/`の`VectorModel`・`ItemTreeRules`・`ItemListRules`、`js/edit/`の`ShapeOrderEditor`・`EndpointSnapper`、`js/palette/ItemListPanel`、`js/wiring/ItemListWiring`、`index.html`、`test/core/`の`ItemListRules`・`ItemTreeRules`・`VectorModel.insertTarget`・`VectorModel.items`・`VectorModel.reorderShapes`、`test/edit/`の`ShapeOrderEditor`・`SnapshotAdapter.items`。新しいファイルは`js/`・`test/`・`_doc/arch/`ともCRLF。本RESはLF。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **アイテムのid**：図形は`item.shape.id`、フォルダは`item.id`。求めるのは`GroupTreeRules.itemIdOf`の1か所（種類で分ける同じ式を書かない）。
*   **並び**：いちばん外側、または1つのフォルダの`children`。配列の**後ろが上（前面）**。一覧は上が前面なので、一覧で「すぐ上」＝配列ですぐ後ろ。
*   **選んでいるまとまり（units）**：`GroupSelectionRules.resolveSelectedUnitIds({ items, isSelected, selectedGroupIds })`の結果（前順。互いに含み合わない。**最後のものが一覧で一番上**）。
*   **場所（place）**：アイテムの入る場所を表す1つの値。`{ kind, id }`または`null`（無し＝いちばん外側の一番上）。`kind`は`PLACE_KIND`の4つ：
    *   `'above'`：`id`の行のすぐ上（同じ並びのすぐ後ろ）
    *   `'below'`：`id`の行のすぐ下（同じ並びのすぐ前）。**ドロップ位置だけが使う**
    *   `'inside'`：`id`のフォルダの中の一番上
    *   `'bottom'`：`id`のフォルダ（`id`が`null`ならいちばん外側）の中の一番下
*   **描き込む先**：場所のうち`'above'`（REQの「行の上」）・`'inside'`（「フォルダの中」）・`'bottom'`（「一番下」）、または`null`（無し）。`'below'`にはならない。

### モジュールの分担（全体）
| 置き場所 | 役割 |
| --- | --- |
| `core/ItemPlaceRules.js`（新規） | 場所の値`PLACE_KIND`と、場所へ入れる・場所へ動かす・動かせるかの計算、アイテムの位置の照会。importは`ItemTreeRules`・`GroupTreeRules`のみ |
| `core/GroupTreeRules.js`（更新） | `pickItems`・`listGroupIds`を足す。`wrapUnits`は`pickItems`を使う。`hasGroupItem`を消す |
| `core/InsertTargetRules.js`（書き直し） | 描き込む先の決まり方（3つの形）・行から決まる描き込む先・印に出す描き込む先・貼り付けと複製の入る場所。importは`ItemTreeRules`・`GroupTreeRules`・`GroupSelectionRules`・`ItemPlaceRules`のみ |
| `core/ItemTreeRules.js`（更新） | `insertItemsAbove`を消す（`ItemPlaceRules.insertItemsAt`へ置き換え） |
| `core/ItemRowRules.js`（更新） | 描き込む先の印（行・線・見えない行の印）を行ごとの見た目にする |
| `core/ListDragRules.js`（書き直し。自動スクロールの`resolveAutoScrollTop`は変えない） | 動かすもの・ドロップ位置（場所）・線と目立たせる行・行の並びの比較 |
| `core/ItemListRules.js`（更新） | `canStartRowDrag`の`hasGroups`を消す |
| `core/VectorModel.js`（更新） | 描き込む先を1つの値`#insertTarget`で持つ唯一の持ち主。`addShapesWithNewIds`・`rearrangeItems`の省ける引数を足す。`reorderShapes`を消す |
| `edit/GroupEditor.js`（更新） | `addEmptyGroup`の位置と、できたフォルダを描き込む先にする指定 |
| `edit/ShapeOrderEditor.js`（更新） | `applyOrder`を`moveTo(ids, place)`（行のドラッグの1件の編集操作）へ置き換え |
| `edit/ShapeInserter.js`（更新） | 入る場所の指定と「まとまりとして入れる」の受け渡し |
| `edit/ClipboardController.js`（更新） | まとまりを形のまま写す・「自分のコピー」の見分け |
| `palette/ItemListPanel.js`・`index.html`（更新） | 字下げした線・フォルダの行を目立たせる・描き込む先の線の表示 |
| `wiring/ItemListRowDrag.js`・`wiring/ItemListWiring.js`（更新） | 上の規則の橋渡し |
| `main.js`（更新） | 注入だけ |

循環は無い（`ItemTreeRules` ← `GroupTreeRules` ← `GroupSelectionRules`・`ItemPlaceRules` ← `InsertTargetRules`、`ItemRowRules` → `ItemTreeRules`・`GroupTreeRules`・`ItemPlaceRules`（`PLACE_KIND`）、`ListDragRules` → `ItemRowRules`（`resolveRowIndent`）・`ItemPlaceRules`（`PLACE_KIND`））。`GroupTreeRules`は`ItemTreeRules`のほかをimportしない。依存の例外（`edit/ → core/`）に加わるのは、`ClipboardController`（`GroupTreeRules`の`pickItems`・`listGroupIds`、`GroupSelectionRules`の`resolveSelectedUnitIds`、`InsertTargetRules`の`resolvePastePlace`・`resolveDuplicatePlace`）・`GroupEditor`（`ItemPlaceRules`の`insertItemsAt`）・`ShapeOrderEditor`（`ItemPlaceRules`の`moveItems`、`GroupTreeRules`の`isSameTree`）。どれも状態を持たない規則の関数。

### 共通の計算: `core/ItemPlaceRules`（要件1・2・4の土台）
責務の3行：「アイテムの入る場所（行の上・行の下・フォルダの中・一番下）の値と、その場所へ入れる・動かす計算、アイテムの位置の照会。状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules のみ。図形は id だけを読む。」
*   **`PLACE_KIND`**＝`Object.freeze({ ABOVE: 'above', BELOW: 'below', INSIDE: 'inside', BOTTOM: 'bottom' })`。typedef`ItemPlace`＝`{ kind, id: string|null }`（`id`が`null`になるのは`'bottom'`のいちばん外側だけ）。
*   **`findItemLocation(items, id)`** → `{ parentId: string|null, siblings: Item[], index: number, ancestorIds: string[] }|null`：前順で最初に見つかったアイテムの、入っている並び（引数の配列そのもの）・その中の添字・入っているフォルダのid（外側から）。`parentId`は`ancestorIds`の最後（無ければ`null`）。
*   **`insertItemsAt(items, place, addedItems)`** → 新しい入れ子：`place`の場所へ`addedItems`を順のまま入れる。`place`が`null`・`id`のアイテムが無い・`'inside'`/`'bottom'`の`id`がフォルダでないときは、いちばん外側の末尾（一番上）。`{ kind: 'bottom', id: null }`はいちばん外側の先頭。通り道のフォルダだけ新しいオブジェクトにし、引数を書き換えない。
*   **`canMoveItems(items, ids, place)`** → boolean（`ids`は`Set`）：`place`が`null`なら偽。`{ bottom, null }`は真。`place.id`のアイテムが無ければ偽。そのアイテムの`ancestorIds`に`ids`のものがあれば偽（動かすフォルダの中）。`'inside'`・`'bottom'`で`place.id`が`ids`にあれば偽（自分の中）、またはフォルダでなければ偽。ほかは真。**「自分の中・自分の中のフォルダの中へは入れられない」の唯一の判定箇所**。
*   **`moveItems(items, ids, place)`** → 新しい入れ子または`null`：`canMoveItems`が偽、または`ids`のアイテムが1つも無ければ`null`。手順は(1)`units = pickItems(items, ids)`、(2)`insertItemsAt(items, place, [目印])`（目印＝`{ kind: ITEM_KIND.GROUP, id: Symbol('place'), children: [] }`。モデルへは渡らない一時的な値）、(3)`removeItems(…, ids)`、(4)`mapSiblingLists(…, (list) => list.flatMap((item) => (itemIdOf(item) === 目印のid ? units : [item])))`。目印を先に置くため、動かすまとまり自身の行の上下を指しても位置がずれない。
*   **`GroupTreeRules`へ足すもの**：`pickItems(items, ids)`（`ids`のアイテムを前順で集めた新しい配列。当たったフォルダの中へは進まない。要素は引数のアイテムそのもの。`wrapUnits`の中の`collect`をこれに置き換える＝写しを作らない。`wrapUnits`の結果は変えない）・`listGroupIds(items)`（フォルダのidを前順で、入れ子の中も）。

### 要件1: 行のドラッグでの出し入れ
*   **始める条件**：`ItemListRules.canStartRowDrag`から`hasGroups`を消す（ほかの条件は同じ）。`GroupTreeRules.hasGroupItem`は使う側が無くなるため消す。
*   **動かすもの**（`ListDragRules`）：
    *   `resolveDraggedUnitIds({ unitIds, pressedId })`：`unitIds`に`pressedId`があれば`unitIds`の写し（前順。折りたたまれて行の無いものも含む）、無ければ`[pressedId]`。選んでいるフォルダの中の行は`unitIds`に無いので「その行だけ」になる。
    *   `resolveDraggedRowIds({ rows, draggedIds })`：うすく見せる行のid（動かすものの行と、動かすフォルダの中の行）。`row.id`か`row.ancestorIds`のどれかが`draggedIds`にある行。
    *   始まったときの選択：`shouldSelectPressedRow`（コードは変えない）の`isSelected`へ渡す値を「押した行のidが選んでいるまとまりにあるか」にする（JSDocを直す）。選ぶときは、既存の`ListSelectionRules.resolveRowClickSelection`を`additive: false, range: false`で呼び、結果を`model.setSelectionByUser(ids, { groupIds, keepsCollapsed: true })`へ渡す（フォルダの行なら中の図形とフォルダを選んでいる状態。`#anchorId`は結果の`anchorId`）。
*   **ドロップ位置**（`ListDragRules.resolveDropPlace({ pointerX, pointerY, area, rows })` → 場所または`null`）。`rows`は始まった時点の見えている行（`ItemRowRules.buildItemRows`の結果）。上から順に：
    1. `pointerX`が`area.left`未満・`area.right`より大きい → `null`（左右へ外れた）。
    2. `rows`が空・`area.rowHeight`か`area.height`が正でない → `null`。
    3. `y` ＝ `pointerY`を`[top, top + height]`へ収め、`− top + scrollTop`。（上下へ外れたときは、4.の送り切った場合を除き、今までどおり見えている端として扱う）
    4. 次のどちらかなら`{ bottom, null }`：(a)`y >= rows.length × rowHeight`（最後の行より下の空いている所）、(b)`pointerY >= top + height`（収める前の値）かつ`scrollTop >= maxScrollTop − 1`（一番下まで送り切って下へ外れた）。(b)が要るのは、`height`（`clientHeight`）は整数へ丸められ、`scrollTop`は小数を取り得て、送り切っても(a)の和が行の総高に1px未満だけ足りないことがあるため（例：見える高さ498.4px・20行 → 498 ＋ 221.6 ＝ 719.6 < 720）。`maxScrollTop`は`ListArea`に既にあるものを使い、`getListArea`は変えない。
    5. `index = floor(y / rowHeight)`、`fraction` ＝ その行の中の割合（0以上1未満）。図形の行：`fraction < 0.5`なら`{ above, row.id }`、そうでなければ`{ below, row.id }`。フォルダの行：`fraction < 0.25`なら`above`、`fraction < 0.75`なら`inside`、それより下は、開いていて中身がある（`!row.collapsed && !row.isEmpty`）なら`inside`、折りたたみ・空なら`below`。
    *   一番上の行（必ずいちばん外側）より上へ外れると`y`が0になり、その行の`above`＝いちばん外側の一番上になる。
    *   割合の境の定数（0.5・0.25・0.75）と、送り切ったとみなす余裕（1px）はファイル内の定数（exportしない）。
*   **見せ方**（`ListDragRules.resolvePlaceMark({ rows, place })` → `{ id, edge: 'before'|'after'|'inside', indent }|null`）：`place`が`null`・行が無い → `null`。`above` → その行の`'before'`・`resolveRowIndent(row.depth)`。`below` → `'after'`・同じ字下げ。`inside` → `'inside'`・字下げ0（線は出さない）。`{ bottom, null }` → 最後の行の`'after'`・字下げ0。`place.id`の行が`rows`に無い・`{ bottom, フォルダ }`（ドロップ位置には現れない） → `null`。
*   **行の並びの比較**（`ListDragRules.isSameRows(a, b)`）：長さと、各位置の`id`・`depth`・`collapsed`・`isEmpty`が同じか（並びのidが同じでも入れ子・折りたたみが変わったら取りやめるため）。
*   **入れられない場所**：`ItemListRowDrag`は、場所を求めたら注入された`canDrop(draggedIds, place)`（実体は`canMoveItems(model.getItems(), new Set(ids), place)`）を見て、偽なら線も目立たせる表示も出さず、離しても何もしない。
*   **1件の編集操作**（`ShapeOrderEditor.moveTo(ids, place)` → boolean）：`nextItems = moveItems(model.getItems(), new Set(ids), place)`。`null`か、`isSameTree(今, nextItems)`が真なら、何も呼ばず`false`（`beginEdit`も呼ばない）。そうでなければ`beginEdit` → `model.rearrangeItems(nextItems)` → `commitEdit`、戻り値は`rearrangeItems`の戻り値。選択・選んでいるフォルダは`rearrangeItems`の既定（今の値を候補に、不変条件で絞る）に任せる。
*   **開かない・空のフォルダが残る**：`rearrangeItems`は折りたたみを変えず、`removeItems`はフォルダを空でも残す（今の規則のまま）。
*   **消すもの**（タスク13）：`ListDragRules`の`resolveDraggedIds`・`resolveDropIndex`・`resolveDropMark`・`reorderRowsForDrop`・`isSameOrder`・`toDrawOrder`とtypedef`RowIds`・`DropMark`（旧）、`ShapeOrderEditor.applyOrder`・`#commitOrder`、`VectorModel.reorderShapes`、`GroupTreeRules.hasGroupItem`。`ItemTreeRules.placeShapeItems`は`replaceShape`・`replaceShapesKeepingIds`が使うため残す。
*   **フォルダの無い絵**：`above(行i)`／`below(行i)`は今の`dropIndex = i`／`i + 1`と同じ並びになる（境目の0.5は下側＝`Math.round`と同じ）。

### 要件2: 描き込む先の決まり方
*   **持ち主**：`VectorModel`の`#insertTarget`（場所または`null`。今の`#insertTargetId`を置き換える）。書き込みはコンストラクタと`#applyState`だけ。
*   **公開の照会**：`getInsertTarget()`＝値の写し（または`null`）。**製品コードはこれだけを使う**。`getInsertTargetId()`は残し、意味を「`'above'`のときの行のid、ほかの形・無しは`null`」とする（既存のテスト約90か所が確かめている値を変えないため。値は`#insertTarget`から毎回求め、別に持たない）。
*   **`InsertTargetRules.resolveNextInsertTarget({ previousItems, items, selectedIds, selectedGroupIds, target })`** → 場所または`null`。`selectedIds`・`selectedGroupIds`は`Set`（`selectedGroupIds`は不変条件を通した後の値）。上から順に最初に当たったもの：
    1. 選んでいるまとまりが1つ以上 → 一番上のもの（`resolveSelectedUnitIds`の最後）が図形なら`{ above, id }`、フォルダなら`{ inside, id }`。
    2. `target`が`null` → `null`。
    3. `target`が今も有効 → 同じ内容の値。有効＝`above`は`id`のアイテムがある、`inside`と`bottom`（`id`あり）は`id`のフォルダがある、`{ bottom, null }`は`items`に1つ以上ある。
    4. 無くなった → `previousItems`での**元の場所**から求める（`inside`・`bottom`はそのフォルダの行が無くなったものとして扱う）：
        *   `location = findItemLocation(previousItems, target.id)`。`null`（`target.id`が`null`の場合を含む）なら`null`。
        *   繰り返し：`location.parentId`が`null`か、`items`にそのフォルダがあるなら、`location.siblings`を`index − 1`から0へたどり、`items`で**同じフォルダ（`parentId`が同じ）に残っている**最初のものの`{ above, そのid }`（フォルダでも`above`）。無ければ、`parentId`が`null`なら`items`が空のとき`null`・そうでなければ`{ bottom, null }`、フォルダなら`{ bottom, parentId }`。
        *   `location.parentId`のフォルダも無ければ、`location = findItemLocation(previousItems, location.parentId)`として繰り返す。
    *   引数を書き換えない。`items`のフォルダかどうかは`kind`で見る。
*   **`resolveRowInsertTarget(items, id)`** → 図形なら`{ above, id }`、フォルダなら`{ inside, id }`、無ければ`null`（描くツールで行を押したとき。まとまりの一番上から決めるのも同じ関数を使い、規則を二重に書かない）。
*   **`isSameInsertTarget(a, b)`**：どちらも`null`、または`kind`と`id`が同じか。
*   **`#applyState`**：引数を`insertTargetId`から`insertTarget`（場所または`null`。省けば今の値）に変え、**選んでいるフォルダを先に不変条件へ通してから**`resolveNextInsertTarget`を呼ぶ。消す経路ごとの付け替えは書かない。
*   **経路ごとの候補**：
    *   `setSelection`・`clearSelection`・`deleteShapes`・`addShape`・`replaceShapesKeepingIds`・`renameItem`・`setGroupCollapsed`・`rearrangeItems`（下の例外を除く）：今の値。
    *   `setSelectionByUser`：結果の図形の選択もフォルダの選択も空なら`null`（今と同じ）。早く返す条件の`#insertTargetId === null`は`#insertTarget === null`になる。空のフォルダだけを選んだときは、規則1により`{ inside, そのフォルダ }`。
    *   `setInsertTarget(id)`：`resolveRowInsertTarget(this.#items, id)`が`null`なら`false`。前後が`isSameInsertTarget`なら`false`（通知なし）、変われば通知1回で`true`。
    *   `commitDraft`：`{ above, 描いた図形のid }`。`replaceShape`（`select`が偽で結果の選択が空）：`{ above, 入れた図形のid }`。
    *   `replaceAllShapes`：`keepInsertTarget`が真なら今の値、偽なら`null`。
    *   `rearrangeItems`の省ける引数`targetsNewGroup`（既定`false`）が真なら、`{ inside, 新しいフォルダのうち前順で最初のid }`（新しいフォルダが無ければ今の値）。図形が選ばれていれば規則1が優先される。
*   **作るボタン**（`GroupEditor.addEmptyGroup`）：位置は`insertItemsAt(items, model.getInsertTarget(), [空のフォルダ])`。`selects`が真なら今の引数のまま（できたフォルダが選ばれ、規則1で`inside`）、偽なら`rearrangeItems(nextItems, { targetsNewGroup: true })`。
*   **取り消し／やり直し**：`SnapshotAdapter.restore`のコードは変えない（`keepInsertTarget: true`のまま）。切り取り → 貼り付け・描いた図形の取り消し → 描き直しで、フォルダの中でも一番下でも元の場所になる。

### 要件3: 描き込む先の見せ方
*   **`InsertTargetRules.resolveInsertMark({ selectedCount, target })`**（今の`resolveInsertMarkId`を置き換える）：`selectedCount > 0`なら`null`、そうでなければ`target ?? null`。`ItemListWiring.sync`が渡す`selectedCount`は、選ばれている図形の数＋選んでいるフォルダの数（空のフォルダだけを選んでいるときも出さない）。
*   **`ItemRowRules.resolveRowViews({ rows, isSelected, selectedGroupIds, insertMark })`**（引数`insertMarkId`を`insertMark`（場所または`null`）に変える）。`RowView`に`insertLine: {edge: 'before'|'after', indent: number}|null`を足す。印の決め方（ファイル内の関数1つにまとめ、行ごとに二重に書かない）：
    *   `above`：`id`の行が見えていて、図形なら`insertTarget: true`、フォルダならその行に`insertLine = { 'before', resolveRowIndent(row.depth) }`。
    *   `inside`：`id`の行が見えていれば`insertTarget: true`（折りたたんでいても同じ）。
    *   `bottom`・`id`が`null`：最後の行に`insertLine = { 'after', 0 }`。
    *   `bottom`・フォルダの行が見えている：中身が空（`isEmpty`）なら`insertTarget: true`。折りたたんでいれば`hiddenMark: true`。開いていて中身があれば、`ancestorIds`に`id`を含む**最後の行**に`insertLine = { 'after', resolveRowIndent(フォルダのdepth + 1) }`。
    *   `id`の行が見えていない：`collapsed`の行のうち`shapeIds`か`groupIds`に`id`を含む行に`hiddenMark: true`（見えている折りたたんだ行は外側の1つだけなので、いちばん近い上のフォルダの行になる）。
    *   選択による`hiddenMark`の条件（中に選ばれている図形・選んでいるフォルダ）は今のまま。
*   **`resolveRowHighlight`**：`markId`・`indexes`の「印」に`insertLine`を持つ行を含める。スクロールの規則（`ListScrollRules`）は変えない。
*   **パネル**：`insertLine`は行のクラス`insert-line-before`／`insert-line-after`とカスタムプロパティ`--insert-line-indent`で表す（`.item-list`の子に要素を足さない）。`getMarkedRowId()`は`insert-target`・`has-hidden-mark`・`insert-line-before`・`insert-line-after`の最初の行を返す。
*   **CSS**：描き込む先の線は**青の破線**（`border-top: 2px dashed #1a73e8`）、ドラッグの線は今の**青の実線**で区別する。描き込む先の線のセレクタは`.item-list:not(.row-dragging) …`とし、行のドラッグ中は描き込む先の線を出さない（疑似要素を取り合わない）。ドラッグの線は`left: var(--drop-indent, 0px)`。フォルダの中へ入るときの行は`.item-row.drop-inside`（背景を濃いめの青、`outline: 2px solid`・`outline-offset: -2px`。`.selected`・`.has-hidden-mark`より後に書く）。

### 要件4: 入る位置
*   **`VectorModel.addShapesWithNewIds(values, { atInsertTarget = false, place = null, asUnits = false })`**：
    *   入る場所：`place ?? (atInsertTarget ? 今の描き込む先 : null)`を`#placeAdded(addedItems, place)`＝`insertItemsAt(this.#items, place, addedItems)`へ渡す（位置は、書き換える前の描き込む先で決める）。`commitDraft`も同じ`#placeAdded`を使う（`atInsertTarget`が偽なら`null`＝末尾）。
    *   `asUnits`が偽（既定）：今までどおり（図形が1つも無ければ何も変えず空配列。選んでいるフォルダは空になる）。
    *   `asUnits`が真：フォルダだけ（空のフォルダを含む）でも入れる（アイテムが1つも残らなければ何も変えず空配列）。選んでいるフォルダの候補を、入れた並びの**いちばん外側のフォルダのid**にする（不変条件は必ず満たす）。
    *   `revealIds`・id の採番・名前（あるものはそのまま）・戻り値（図形のidの配列）・通知1回は今までどおり。
*   **`ShapeInserter.insertDocument(documentData, dx, dy, { place = null, asUnits = false } = {})`・`insertDocumentWithinEdit(同じ)`**：`addShapesWithNewIds(result.items, { atInsertTarget: insertsAtTarget, place: insertsAtTarget ? place : null, asUnits })`。`insertsAtTarget`が偽なら`place`も使わず末尾（既存のテストの値を変えないため）。0件の判定は`asUnits ? result.items.length === 0 : result.shapes.length === 0`。`InsertResult`に`inserted: boolean`（図形かフォルダを1つ以上入れたか）を足す（どの経路でも必ず持つ）。`insertedIds`・`ok`・`skipped`・`error`は今までどおり。
*   **新しく描いた図形・インポート**：コードの追加なし（`commitDraft({ atInsertTarget: true })`・`CanvasFileOperations`の`insertDocument(…, 0, 0)`のまま、描き込む先の3つの形に入る）。インポートの「図形がない」・インポートの後の選択（図形だけ）は今までどおり。
*   **貼り付けの場所**（`InsertTargetRules.resolvePastePlace({ target, copiedGroupIds })`）：`target`が`inside`でその`id`が`copiedGroupIds`（`Set`）にあれば`{ above, その id }`、そうでなければ`target`（`null`もそのまま）。
*   **複製の場所**（`InsertTargetRules.resolveDuplicatePlace(unitIds)`）：まとまりが空なら`null`、そうでなければ`{ above, 最後のid }`（まとまりの一番上のもののすぐ上）。
*   **自分のコピーの見分け**（`ClipboardController`だけが持つ）：`#copiedGroupIdsByCanvas`（`Map<キャンバスの識別値, Set<フォルダのid>>`）。コピー・切り取りで作り直し、写したまとまりの中のフォルダすべて（入れ子の中も）のidを、その時点の識別値へ入れる。**貼り付けでフォルダが入ったら、そのフォルダ（入れ子の中も）のidも今の識別値へ足す**（続けて貼り付けたとき、貼り付けたコピーの中へ入り込まず、すぐ上へ重なるため）。キャンバスの識別値は注入`getCanvasId`（省けば常に`null`。`main.js`は`() => canvasLibrary.getState().openCanvasId`）で照会し、中身を解釈しない（フォルダのidは別のキャンバスと同じ値になり得るため、別のキャンバスでは自分のコピーとみなさない）。

### 要件5: フォルダの形を保ったコピー・切り取り・複製
*   **写し方**（`ClipboardController`）：`unitIds = resolveSelectedUnitIds({ items, isSelected, selectedGroupIds })`が空なら`null`（何もしない）。`DocumentSerializer.serialize(pickItems(items, new Set(unitIds)))`（フォルダは`type: 'group'`の要素のまま、名前・表示・ロック・折りたたみ・入れ子・中の順番を保つ。クリップボードの形は作業データ形式のまま）。空のフォルダだけでも写る。`model`は`getItems`・`isSelected`・`getSelectedGroupIds`・`getInsertTarget`だけを使う。
*   **貼り付け（`paste`・`pasteInPlace`）**：`insertDocument(data, offset, offset, { place: resolvePastePlace(…), asUnits: true })`。`result.inserted`が偽なら`false`。段数の規則は今までどおり（`paste`で1増やす・`pasteInPlace`は変えない）。入った後、`listGroupIds(pickItems(model.getItems(), new Set(model.getSelectedGroupIds())))`を自分のコピーの集合へ足す。
*   **複製（`duplicate`・`duplicateInPlaceWithinEdit`）**：`{ place: resolveDuplicatePlace(unitIds), asUnits: true }`。クリップボード・段数・自分のコピーの集合は変えない。
*   **切り取り**：今の手順のまま（先に写し、`deleteSelection()`が受理されたときだけ置き換える）。フォルダごと消えるのは今の削除の経路（`GroupEditor.removeSelection`）。
*   **`Alt`＋ドラッグ**：`InputTracker`は変えない（閾値を超えたときの補助`duplicateSelection`が`duplicateInPlaceWithinEdit`を呼び、写しが選ばれている状態で`moveShapes`が続く。`moveShapes`は選択に触れないため、フォルダを選んでいる状態のまま動く）。
*   **記録**：貼り付け・複製は`ShapeInserter`の1件、`Alt`＋ドラッグは移動と合わせて1件（今のまま）。

### 要件6: 既存のテストで直すもの（これ以外の既存の件は1件も変えない）
| ファイル | 直す内容 | 理由 | タスク |
| --- | --- | --- | --- |
| `test/core/InsertTargetRules.test.js`の`resolveInsertTarget`の9件 | 新しい関数の引数・戻り値の形へ書き直す（選択・そのまま・下の行へ・引数を書き換えない、の意味は同じ）。「下が全部消えたらnull」だけは`{ bottom, null }`へ変わる | 描き込む先の3つの形・要件2の5. | 2・3 |
| 同`resolveInsertMarkId`の3件 | `resolveInsertMark`へ（意味は同じ） | 関数の置き換え | 8 |
| `test/core/VectorModel.groupSelection.test.js`「図形の選択が空でもフォルダの選択があれば描き込む先は今のまま」 | `{ inside, 'e' }`になる | 要件2の1. | 3 |
| `test/core/VectorModel.collapse.test.js`「選択・描き込む先・フォルダの選択には触れない」 | 描き込む先の期待値を`{ inside, 'g1' }`にする（開閉で変わらないことの確認は同じ） | 要件2の1. | 3 |
| `test/edit/GroupEditor.flow.test.js`の`描き込む先`の1・2件目 | フォルダを選ぶ＝`{ inside, 'g1' }`、空のフォルダだけを選ぶ＝`{ inside, そのフォルダ }` | 要件2の1.・作るボタン | 3 |
| `test/edit/ShapeInserter.insertTarget.test.js`「切り取って貼り付けると元の位置へ戻る。いちばん下の行…（仕様）」 | 一番下の行を切り取った後の描き込む先は`{ bottom, null }`、貼り付けの結果は`['a','b','c','d']` | 要件2の5. | 3 |
| `test/edit/GroupEditor.test.js`の`setupFake`と「空のフォルダ」の偽の依存の件 | 偽のmodelの`getInsertTargetId`を`getInsertTarget`（場所）へ、`selects`が偽のときの`rearrangeItems`の引数を`{ targetsNewGroup: true }`へ。並び・呼び出し順は変えない | 要件2の作るボタン | 4 |
| `test/core/ItemTreeRules.test.js`の`insertItemsAbove`の9件 | 消す（同じ値の確認を`test/core/ItemPlaceRules.test.js`の`insertItemsAt`の`above`へ移す） | 関数の置き換え | 1・4 |
| `test/edit/GroupEditor.flow.test.js`の`フォルダを選んだ複製・コピー・貼り付け・切り取り`の3件（「複製」「切り取り→貼り付け」「空のフォルダだけを選んだ切り取り・コピー」） | フォルダの形で写る結果へ（フォルダの数・入れ子・選んでいるフォルダ・空のフォルダのコピー/切り取りができること）。図形の数・idの重複なしの確認は残す。ほかの4件（コピー→貼り付け・切り取りの取り消し・記録しない複製2件）は変えない | 要件5 | 7 |
| `test/core/ItemRowRules.test.js`の`resolveRowViews`・`resolveRowHighlight`の`insertMarkId` | 引数を`insertMark`（`null`か`{ kind: 'above', id }`）へ替えるだけ。**期待する値は変えない** | 引数の形 | 8 |
| `test/core/ListDragRules.test.js`の`resolveDraggedIds`・`resolveDropIndex`・`resolveDropMark`・`reorderRowsForDrop`・`toDrawOrder`/`isSameOrder`の件 | 消す（`resolveAutoScrollTop`の件は変えない） | 消した規則 | 13 |
| `test/core/ItemListRules.test.js`の`canStartRowDrag（フォルダ）`1件 | 消す | 消した条件 | 12 |
| `test/core/GroupTreeRules.test.js`の`hasGroupItem`1件 | 消す | 消した関数 | 13 |
| `test/edit/ShapeOrderEditor.test.js`の`applyOrder`の6件と、`setupFake`の`reorderShapes` | 消す（`moveTo`の件をタスク11で足す） | 消した操作 | 13 |
| `test/core/VectorModel.reorderShapes.test.js` | ファイルごと消す | 消した操作 | 13 |
| `test/core/VectorModel.items.test.js`の`reorderShapes`1件と「通知の回数」 | 前者は消す。後者は`reorderShapes`の代わりに`rearrangeItems([...getItems()].reverse())`で同じ回数を確かめる | 消した操作 | 13 |
| `test/core/VectorModel.insertTarget.test.js`の`reorderShapes`2件 | 同じ並びを`rearrangeItems`で作り、同じ値を確かめる | 消した操作 | 13 |
| `test/core/VectorModel.groupSelection.test.js`・`VectorModel.collapse.test.js`の`reorderShapes`を含む各1件 | `rearrangeItems`で並びを替えて、同じ値を確かめる | 消した操作 | 13 |
| `test/edit/SnapshotAdapter.items.test.js`の「重なり順」 | `rearrangeItems`で並びを替える操作にする（JSONの一致の確認は同じ） | 消した操作 | 13 |
| `test/edit/InsertTarget.flow.test.js`の`applyOrder`を使う2件 | `orderEditor.moveTo`へ替える（記録1件・取り消し1回・描き込む先が行と一緒に動く、の確認は同じ。並びの期待値は操作に合わせる） | 消した操作 | 13 |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`・`./js/edit/`・`./js/palette/`・`./js/wiring/`・`./js/main.js`・`./index.html`・`./test/`
*   **新しい規則**: `core/ItemPlaceRules`
*   **関連する論理クラス・規則**: `VectorModel`・`InsertTargetRules`・`GroupTreeRules`・`GroupSelectionRules`・`ItemTreeRules`・`ItemRowRules`・`ItemListRules`・`ListDragRules`・`ListSelectionRules`・`GroupEditor`・`ShapeOrderEditor`・`ShapeInserter`・`ClipboardController`・`ItemListPanel`・`ItemListWiring`・`ItemListRowDrag`

### 参照する責務
*   **層の規則**：`core/`の規則は状態なし・DOMなしの関数で、`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`palette/`は何もimportせず、図形・`VectorModel`・`InputTracker`・`HistoryManager`・選択状態・入れ子の規則を知らない（表示とコールバックの通知だけ）。`wiring/`は購読・生成・注入・橋渡しで判定・計算を持たない（`main.js`だけが使う）。`edit/`は1件の編集操作の手順で、`VectorModel`・記録先は注入で受け、操作モードは解釈しない。`main.js`は生成・注入だけ。
*   **`VectorModel`**：アイテムの入れ子・選択集合・選んでいるフォルダ・描き込む先等のSSOT。`#items`・選択・選んでいるフォルダ・描き込む先へ代入するのはコンストラクタと`#applyState`だけ（通知はしない）。状態を変えるAPIは変更後に`onChange`へ通知する（回数は契約でテストが確かめている）。入れ子の計算は規則へ委ねる。図形種別・図形固有のプロパティ名を知らない。履歴の記録は呼び出し側。**入れ子を動かす公開操作は`rearrangeItems`の1つ**（今ある図形インスタンス・今あるフォルダか新しいフォルダだけを重複なく受け、同じ構造なら何もしない。折りたたみは変えず`onCollapsedChange`を呼ばない）。追加は`commitDraft`・`addShapesWithNewIds`。
*   **選んでいるフォルダの不変条件**（`GroupSelectionRules.resolveSelectedGroupIds`。変えない）：今あるフォルダで、今と前の中の図形がすべて選ばれているものだけ。選択・頂点の選択以外のモードでは選択集合・選んでいるフォルダは空（`setMode`が`clearSelection()`を呼ぶ）。
*   **折りたたみ**：取り消しの対象外。自動で開くのは選択が変わったとき（`revealIds`）で、変わる前にあったフォルダだけ。描き込む先・並べ替え・削除では開かない。
*   **`ItemTreeRules`**：入れ子の計算。importなし。図形のプロパティを読まない（だから`id`を読む計算は`GroupTreeRules`・`ItemPlaceRules`に置く）。
*   **`GroupTreeRules`**：`itemIdOf`（種類で分ける式の唯一の箇所）・`wrapUnits`・`unwrapGroups`・`removeItems`・`listSiblingLists`・`mapSiblingLists`（`fn`は新しい配列を返す）・`isSameTree`。引数を書き換えない。
*   **`ItemRowRules.buildItemRows`**：見えている行だけを上から（`id`・`kind`・`depth`・`ancestorIds`・`shapeIds`・`groupIds`・`collapsed`・`isEmpty`）。
*   **`ListSelectionRules.resolveRowClickSelection`**：行のクリックの次の選択（図形・フォルダ・起点）。変えない。
*   **`HistoryManager`**：`beginEdit`／`commitEdit`で挟み、前後の作業データが同じなら記録しない。`EditRecorder`として注入される。
*   **`ShapeInserter`**：作業データの図形を新しいidで追加する1件の編集操作（貼り付け・複製・インポートの共通）。記録しない入口`insertDocumentWithinEdit`を持つ。**`ClipboardController`**：クリップボード（作業データ形式。図形インスタンスを持たない）と段数を持つ唯一のクラス。操作モードを知らない。
*   **`ItemListPanel`**：行の要素はidごとに持ち回り、変わった分だけ書く。編集中の行の要素をDOMの中で動かさない。`.item-list`の子に行以外の要素を足さない。`mousedown`を`preventDefault()`しない。
*   **`ItemListRowDrag`**：行のドラッグの進行（閾値3px・`suppressClick: 'whenMoved'`・自動スクロールの毎フレーム・`Esc`・行の並びが変わったら取りやめ）。図形・選択・履歴・操作モードを知らない。離したときは後始末を先に行う。
*   **`ItemListWiring`**：`model.onChange`を1フレームに1回の`sync`へまとめる。選択集合の写しを持たない。一覧での操作の直後に`sync({ allowScroll: false })`を呼ぶ。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   1章：構成図（`core/ItemPlaceRules.js`と新しいテスト、消したテスト`VectorModel.reorderShapes.test.js`、`InsertTargetRules`・`ListDragRules`・`ItemRowRules`・`GroupTreeRules`・`ItemListPanel`・`ItemListWiring`の一言）、フォルダ分割の方針（`edit/`の`applyOrder`・`ClipboardController`の記述）、依存方向の`edit/ → core/`の例外（`ClipboardController`・`GroupEditor`・`ShapeOrderEditor`）と`core/`の規則どうしのimport（`ItemPlaceRules`・`InsertTargetRules`・`ItemRowRules`・`ListDragRules`）、「存在しないもの」（Phase 11-01・11-03・11-04aの「やらない」のうち今回入ったもの＝行のドラッグでの出し入れ・フォルダを描き込む先にすること・フォルダの形を保ったコピー。REQの「今回やらないこと」を足す）。
*   2章：「アイテム」「フォルダ」（`rearrangeItems`の引数・追加の位置）、「選んでいるフォルダ」（`addShapesWithNewIds`の`asUnits`・空のフォルダを選んだときの描き込む先）、「描き込む先」（3つの形・`#insertTarget`・`getInsertTarget`・`resolveNextInsertTarget`・元の場所・経路ごとの候補）、コピーの写り方、保存しないものの列挙（言葉だけ）。
*   3章：3.・6.（行のドラッグの記録＝`moveTo`・描き込む先の復元・作成の入る位置）・7.（形を保った写し・入る場所・自分のコピー）・8.・9.（インポートの入る位置・`asUnits`を使わないこと）・14.（`reorderShapes`・`applyOrder`を消したこと・`moveTo`・`ItemPlaceRules`）・16.（`Alt`＋ドラッグ）・22.（線を終えたときの入る位置の言葉）・28.（行のドラッグ・描き込む先の見せ方・作るボタン・確認の状況・ふるまいの注意の(a)(c)(i)）。
*   4章の一覧と`_doc/arch/`：01（CSS）・02（行数・`ClipboardController`／`ItemListWiring`の注入）・03・13（`ItemListPanel`）・14（`ShapeOrderEditor`・`ShapeInserter`・`ClipboardController`・`GroupEditor`・`SnapshotAdapter`）・16（件数と新しい/消したテスト）・46（`insertItemsAbove`を消す）・48（`hasGroups`を消す）・53・54・55・56・57・58（使う側）・61、新規62（`ItemPlaceRules`）。`InputTracker.js`のJSDocの「描き込む先のすぐ上へ入り、無ければ末尾」は変えない（コードを変えないファイルのため）ので、06に正しい記述（描き込む先の3つの形へ入る）を残す。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・引数・戻り値・typedef、意味が変わった既存のJSDocと先頭の責務・importの記述）が無いことを確認する。(b) `node --test`が全件合格することを確認する。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』へ追記する。(e) 行末を保つ。(f) 既存のテストは「要件6」の表にある件だけを、その理由の範囲で直す。

*   [x] タスク1: 入る場所の計算の規則
    *   **対象ファイル** :
        *   `./js/core/ItemPlaceRules.js` :（新規）
        *   `./js/core/GroupTreeRules.js` :（更新。`pickItems`・`listGroupIds`を足し、`wrapUnits`が`pickItems`を使う）
        *   `./test/core/ItemPlaceRules.test.js` :（新規）
        *   `./test/core/GroupTreeRules.test.js` :（追加のみ）
    *   **作業内容** :
        *   「共通の計算」のとおり、`PLACE_KIND`・typedef`ItemPlace`・`findItemLocation`・`insertItemsAt`・`canMoveItems`・`moveItems`をJSDoc付きで作る。`hasGroupItem`・`ItemTreeRules.insertItemsAbove`はこのタスクでは消さない。
        *   テスト：`findItemLocation`（外側・入れ子・無い・フォルダ）、`insertItemsAt`（4つの形×外側/フォルダの中/深い入れ子・`null`・無いid・図形のidへの`inside`・空のフォルダの`inside`/`bottom`・`{ bottom, null }`・複数とフォルダを含む追加の順・通り道でないフォルダは同じ参照・引数を書き換えない。`above`の値は`ItemTreeRules.test.js`の`insertItemsAbove`の9件と同じ値も確かめる）、`canMoveItems`（自分の中・自分の中のフォルダの中・中の図形の上下・自分自身の上下は真・ほかのフォルダの中は真・無いid・`null`・`{ bottom, null }`）、`moveItems`（図形1つ・離れた複数がひとかたまり・フォルダごと・フォルダと図形の混ざり・フォルダの中から外／外から中／別のフォルダへ・まとまり自身の上下（位置がずれない）・同じ場所なら同じ構造・空になったフォルダが残る・空のフォルダ・折りたたみの属性が保たれる・入れられない場所と無いidは`null`・引数を書き換えない）、`pickItems`（前順・当たったフォルダの中へ進まない）・`listGroupIds`。

*   [x] タスク2: 描き込む先の決まり方と、貼り付け・複製の場所の規則
    *   **対象ファイル** :
        *   `./js/core/InsertTargetRules.js` :（更新。今の`resolveInsertTarget`・`resolveInsertMarkId`はこのタスクでは残す）
        *   `./test/core/InsertTargetRules.test.js` :（追加のみ）
    *   **作業内容** :
        *   「要件2」の`resolveNextInsertTarget`・`resolveRowInsertTarget`・`isSameInsertTarget`と、「要件4」の`resolvePastePlace`・`resolveDuplicatePlace`をJSDoc付きで足す。先頭の責務を「描き込む先の決まり方と、一覧で印に出す描き込む先・貼り付けと複製の入る場所の規則」に直し、importの記述も直す。typedef`InsertTarget`（`ItemPlace`のうち`above`・`inside`・`bottom`）を書く。
        *   テスト：今の`resolveInsertTarget`の9件と同じ場面を新しい関数で（下が全部消えたときは`{ bottom, null }`）、まとまりの一番上が図形／フォルダ／空のフォルダ／フォルダと外の図形の混ざり、`inside`・`bottom`がそのまま残る、行が動いた（別のフォルダへ移っても同じid）、元の場所（フォルダの中の途中・一番下・入れ子の中・下の行がフォルダ＝そのフォルダの`above`・下の行も消えた・下の行が別のフォルダへ移った＝数えない・フォルダごと無くなった・外側のフォルダも無くなった・`inside`/`bottom`のフォルダが無くなった・いちばん外側が空＝`null`・`{ bottom, null }`で空になった）、前の入れ子にも無い＝`null`、引数を書き換えない、`resolveRowInsertTarget`、`isSameInsertTarget`、`resolvePastePlace`（自分のコピー・違うフォルダ・`above`/`bottom`/`null`）、`resolveDuplicatePlace`。

*   [x] タスク3: VectorModelが描き込む先を1つの値で持つ
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./js/core/InsertTargetRules.js` :（更新。古い`resolveInsertTarget`を消す）
        *   `./test/core/InsertTargetRules.test.js` :（更新。古い`resolveInsertTarget`の9件を消す）
        *   `./test/core/VectorModel.insertTarget.test.js` :（追加のみ）
        *   `./test/core/VectorModel.groupSelection.test.js` :（更新。要件6の表の1件）
        *   `./test/core/VectorModel.collapse.test.js` :（更新。要件6の表の1件）
        *   `./test/edit/GroupEditor.flow.test.js` :（更新。要件6の表の`描き込む先`の2件）
        *   `./test/edit/ShapeInserter.insertTarget.test.js` :（更新。要件6の表の1件）
    *   **作業内容** :
        *   `#insertTargetId` → `#insertTarget`、`#applyState`の引数`insertTarget`（選んでいるフォルダを先に求める）、`getInsertTarget()`（写し）・`getInsertTargetId()`（`above`のidだけ）、`setInsertTarget`・`setSelectionByUser`・`commitDraft`・`replaceShape`・`replaceAllShapes`を「要件2」のとおりにする。`#placeAdded(addedItems, place)`を`insertItemsAt`で書き直す（呼び出しは`atInsertTarget`が真なら今の`#insertTarget`、偽なら`null`）。`insertItemsAbove`のimportを外す。クラスJSDoc・先頭の責務・各メソッドのJSDocの「図形のid」「描き込む先のすぐ上」を3つの形へ直す。
        *   テスト（追加）：フォルダを選ぶ＝`inside`、空のフォルダだけ、フォルダの選択を外す＝無し、`clearSelection`で`inside`が残る、`setInsertTarget`（フォルダの行・同じ値で通知なし・図形→フォルダの切り替え）、`commitDraft({ atInsertTarget: true })`が`inside`・`bottom`（フォルダ・外側）・フォルダの`above`・閉じたフォルダの`inside`（開かない）へ入る、元の場所（フォルダの中の一番下を消す・フォルダごと消す・外側が空・`keepInsertTarget`での復元）、`rearrangeItems`で行が動いたら一緒に動く、まとめる・解除、`getInsertTarget`が写しであること、`getInsertTargetId`が`above`以外で`null`。

*   [ ] タスク4: 作るボタンの空のフォルダと描き込む先
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`rearrangeItems`の`targetsNewGroup`）
        *   `./js/edit/GroupEditor.js` :（更新。`addEmptyGroup`とクラスJSDocだけ）
        *   `./js/core/ItemTreeRules.js` :（更新。`insertItemsAbove`を消す）
        *   `./test/core/ItemTreeRules.test.js` :（更新。`insertItemsAbove`の9件とimportを消す）
        *   `./test/core/VectorModel.rearrangeItems.test.js` :（追加のみ）
        *   `./test/edit/GroupEditor.test.js` :（更新。要件6の表の件＋追加）
    *   **作業内容** :
        *   「要件2」の`rearrangeItems`の`targetsNewGroup`と、`addEmptyGroup`（`insertItemsAt(items, model.getInsertTarget(), …)`、`selects`が偽なら`{ targetsNewGroup: true }`）。`GroupEditor`のimport・使うmodelのメソッドのJSDocを直す。
        *   テスト：`targetsNewGroup`（選択なし＝`inside`・選択あり＝選択が優先・新しいフォルダなし＝今のまま）、`addEmptyGroup`が`inside`（中の一番上）・`bottom`・フォルダの`above`・無しの各場所に入る、`selects`が偽で続けて描くとその中に入る（実物）、記録1件と取り消し。

*   [ ] タスク5: 追加の入口（入る場所・まとまりとして入れる）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`addShapesWithNewIds`だけ）
        *   `./test/core/VectorModel.addPlace.test.js` :（新規）
    *   **作業内容** :
        *   「要件4」の`place`・`asUnits`を足す。既定（省いたとき）の結果・通知は変えない。
        *   テスト：`place`が`atInsertTarget`より優先、`atInsertTarget`で`inside`・`bottom`・フォルダの`above`、`asUnits`（フォルダと図形・入れ子・空のフォルダだけ・混ざり）で入った後の選択といちばん外側のフォルダの選択・描き込む先、`asUnits`が偽ならフォルダだけでは何もしない・フォルダの選択は空、idの採番（図形・フォルダとも新しい）・名前が保たれる・折りたたみが保たれる・既にあった閉じたフォルダの中へ入れると開く（図形を含むとき）、通知1回、重複インスタンス。

*   [ ] タスク6: ShapeInserterの受け渡し
    *   **対象ファイル** :
        *   `./js/edit/ShapeInserter.js` :（更新）
        *   `./test/edit/ShapeInserter.insertTarget.test.js` :（追加のみ）
    *   **作業内容** :
        *   「要件4」の第4引数`{ place, asUnits }`（両方の入口）と`InsertResult.inserted`。先頭の責務・クラスJSDoc・処理順のJSDocを直す。
        *   テスト：`place`の指定、`insertsAtTarget`が偽なら`place`を使わない、`asUnits`でフォルダだけの作業データが入り1件の記録になる（取り消しで消える）、`asUnits`が偽なら今までどおり何も起きない（`inserted`は偽）、`inserted`の真偽（図形あり・全体の失敗・0件）、記録しない入口、インポート相当（引数なし）が`inside`・`bottom`の描き込む先に入る。

*   [ ] タスク7: フォルダの形を保ったコピー・切り取り・貼り付け・複製
    *   **対象ファイル** :
        *   `./js/edit/ClipboardController.js` :（更新）
        *   `./js/main.js` :（更新。`// 7.5.`の`ClipboardController`の生成に`getCanvasId: () => canvasLibrary.getState().openCanvasId`を足すだけ。`canvasLibrary`は後で宣言されるが、呼ばれるのは操作のとき（起動完了後）だけである旨をコメントに書く）
        *   `./test/edit/ClipboardController.groups.test.js` :（新規）
        *   `./test/edit/GroupEditor.flow.test.js` :（更新。要件6の表の3件）
    *   **作業内容** :
        *   「要件5」「要件4」のとおり、`#serializeSelection`をまとまりの写しへ、`paste`・`pasteInPlace`・`duplicate`・`duplicateInPlaceWithinEdit`の入る場所と`asUnits`、`#copiedGroupIdsByCanvas`、省ける依存`getCanvasId`。先頭の責務・クラスJSDoc（フォルダを写す・自分のコピーの見分け・importの制約）を直す。`listShapeItems`のimportを外す。
        *   テスト（実物。`ShapeInserter`は`insertsAtTarget: true`、切り取りの削除は`GroupEditor.removeSelection`）：フォルダ・入れ子・空のフォルダ・フォルダと外の図形の混ざり・選んでいるフォルダの中のフォルダを二重に写さない・フォルダの中の図形だけ（図形だけ写る）・折りたたみ・表示・ロック・名前・中の順番・idの採番、ずらし量（段数）が中の図形に効く、複製（まとまりの一番上のすぐ上・フォルダの複製は中でなくすぐ上・離れたまとまり）、コピー→貼り付けの自分のコピー（すぐ上・続けて貼り付けても入り込まずすぐ上・入れ子のフォルダを選んで貼り付け）、違うフォルダを選んで貼り付け＝中の一番上、別のキャンバスの同じid（`getCanvasId`が変わる）では中、切り取って貼り付け＝元の場所（フォルダの中の途中・一番下・いちばん外側の一番下・フォルダごと・空のフォルダ）、`Alt`＋ドラッグの手順（`beginEdit` → 複製 → `moveShapes` → `commitEdit`）で1件・フォルダを選んでいる状態のまま動く・取り消し1回、どれも記録1件で取り消しとやり直しのJSONが一致、フォルダの無い絵での結果が今までと同じ、空のフォルダだけのコピー・切り取り・貼り付け・複製。

*   [ ] タスク8: 描き込む先の印の規則と一覧の同期
    *   **対象ファイル** :
        *   `./js/core/InsertTargetRules.js` :（更新。`resolveInsertMarkId` → `resolveInsertMark`）
        *   `./js/core/ItemRowRules.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新。`sync`とimportだけ）
        *   `./test/core/InsertTargetRules.test.js` :（更新。要件6の表の3件）
        *   `./test/core/ItemRowRules.test.js` :（更新。要件6の表の引数の形＋追加）
    *   **作業内容** :
        *   「要件3」の`resolveInsertMark`・`resolveRowViews`の`insertMark`と`insertLine`・`resolveRowHighlight`。`sync`は`resolveInsertMark({ selectedCount: 図形の数 + フォルダの数, target: model.getInsertTarget() })`の結果を`insertMark`へ渡す。
        *   テスト：図形の`above`・フォルダの`above`（線・字下げ）・`inside`（開いた/閉じた/空）・`bottom`（外側・開いたフォルダの最後の見えている行が入れ子の中・空・閉じた）・見えない行（`above`/`inside`/`bottom`が閉じたフォルダの中、多段）・行が無い、`resolveRowHighlight`の印とスクロールの対象、選択があれば印が出ない、空のフォルダだけを選んでいるときも出ない。

*   [ ] タスク9: 一覧のパネルの線と目立たせる行
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./index.html` :（更新。一覧の行のCSSだけ）
    *   **作業内容** :
        *   「要件3」「要件1」の見た目：`render`の`insertLine`（クラスと`--insert-line-indent`。変わった行だけ書く）、`getMarkedRowId`、`showDropMark({ id, edge: 'before'|'after'|'inside', indent })`（クラス`drop-before`／`drop-after`／`drop-inside`と`--drop-indent`。`indent`が無ければ0。消すときはクラスもカスタムプロパティも消す）、CSS。typedef（`ItemListRowView`・`ItemListRowEntry`）・クラスJSDocを直す。行の要素をDOMの中で動かさない・`.item-list`の子に要素を足さない。

*   [ ] タスク10: 行のドラッグの規則
    *   **対象ファイル** :
        *   `./js/core/ListDragRules.js` :（更新。古い関数はこのタスクでは残す）
        *   `./test/core/ListDragRules.test.js` :（追加のみ）
    *   **作業内容** :
        *   「要件1」の`resolveDraggedUnitIds`・`resolveDraggedRowIds`・`resolveDropPlace`・`resolvePlaceMark`・`isSameRows`をJSDoc付きで足す（typedef`PlaceMark`）。`resolveAutoScrollTop`は変えない。
        *   テスト：動かすもの（まとまり・押した行だけ・選んでいるフォルダの中の行・折りたたまれて行の無いもの）、うすく見せる行、ドロップ位置（図形の行の上半分/下半分と境目・開いた/閉じた/空のフォルダの行の上/真ん中/下と境目・一番上より上・最後の行より下の空いている所・下へ外れた・深い入れ子・スクロール中・左右へ外れた（端は内側）・行0個・寸法0。**小数のスクロール位置**：20行・行の高さ36・`height` 498・`maxScrollTop` 222で、最後の行が開いたフォルダの中のとき、`scrollTop` 221.6なら`pointerY`が`top + height`ちょうどでもずっと下でも`{ bottom, null }`、`top + height`より少し上なら最後の行の`below`。`scrollTop` 221（余裕の境）は`{ bottom, null }`、220.9は最後の行の`below`。途中までしか送っていないときに下へ外れたら見えている端の行の場所。既存の`makeArea`の既定は`maxScrollTop: 0`なので、スクロールする件では`maxScrollTop`を必ず渡す）、線と目立たせる行（4つの形・字下げ・6段で頭打ち・最後の行・`null`）、`isSameRows`、フォルダの無い並びで`resolveDropPlace` → `ItemPlaceRules.moveItems`の結果が「ドロップ位置より上の動かさない行＋動かす行＋残り」と全位置で一致すること（期待値はテストの中で組み立てる）。

*   [ ] タスク11: 行のドラッグの編集操作
    *   **対象ファイル** :
        *   `./js/edit/ShapeOrderEditor.js` :（更新。`moveTo`を足す。`applyOrder`はこのタスクでは残す）
        *   `./test/edit/ShapeOrderEditor.move.test.js` :（新規）
    *   **作業内容** :
        *   「要件1」の`moveTo(ids, place)`。先頭の責務（重なり順と、行のドラッグでの出し入れ・並べ替え）・クラスJSDoc（import・使うmodelのメソッド）を直す。
        *   テスト：偽の依存で呼び出し順・同じ場所と入れられない場所では何も呼ばない、実物で出し入れ（中へ・外へ・別のフォルダへ・フォルダごと・まとまり・選んでいるフォルダの中の行だけ・空になったフォルダ・折りたたんだフォルダへ入れても開かない・自分の中/自分の中のフォルダの中は不変）、記録1件と取り消し/やり直しのJSONの一致、選択が残る、選んでいるフォルダへ選ばれていない図形を入れると選んでいる状態が外れる、描くツール相当（選択なし）で描き込む先が行と一緒に動く、フォルダの無い絵で今までと同じ並び。

*   [ ] タスク12: 行のドラッグの切り替え（進行・配線）
    *   **対象ファイル** :
        *   `./js/wiring/ItemListRowDrag.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/core/ItemListRules.js` :（更新。`canStartRowDrag`から`hasGroups`を消す・`shouldSelectPressedRow`のJSDoc）
        *   `./js/main.js` :（更新。`// 7.15.`の`applyRowOrder`を`applyRowDrop: (ids, place) => shapeOrderEditor.moveTo(ids, place)`へ替え、その直上のコメント「行のドラッグで決まった並び全体（描画順）の適用」を、行のドラッグで決まった場所へ動かす編集操作（動かすもののidと場所を渡す）の説明へ直すだけ）
        *   `./test/core/ItemListRules.test.js` :（更新。`canStartRowDrag（フォルダ）`1件を消す）
    *   **作業内容** :
        *   `ItemListRowDrag`の注入を`{ panel, getRows, getUnitIds, shouldSelectPressedRow, selectRow, canDrop, applyDrop, onDragStart }`へ（`getRowIds`・`isSelected`・`applyOrder`を置き換え）。始まった時点の行`#startRows`（`buildItemRows`の結果）を控え、`cancelIfRowsChanged`・離したときは`isSameRows`で比べる。動くたび・毎フレーム・スクロールは`resolveDropPlace` → `canDrop`が偽なら`showDropMark(null)`、真なら`resolvePlaceMark` → `showDropMark`。離したときは後始末を先に行い、行が変わっていず、場所があれば`applyDrop(draggedIds, place)`。選んでから`getUnitIds()`を照会し直して`resolveDraggedUnitIds`、`setDraggedRows(resolveDraggedRowIds(…))`。閾値・自動スクロール・`Esc`・click抑止は変えない。
        *   `ItemListWiring`の注入：`getRows`＝`buildItemRows(model.getItems())`、`getUnitIds`＝`resolveSelectedUnitIds({ … })`、`shouldSelectPressedRow`＝`isSelected`にまとまりの判定を渡す、`selectRow`＝`resolveRowClickSelection`の結果を`setSelectionByUser`へ（起点の更新・`sync({ allowScroll: false })`）、`canDrop`＝`canMoveItems(model.getItems(), new Set(ids), place)`、`applyDrop`＝注入された`applyRowDrop`。`#handleRowPress`の`hasGroups`と`hasGroupItem`のimportを外す。`#handleRowClick`の描くツールの枝のコメントをフォルダの行も受けることに合わせる（コードは`setInsertTarget(id)`のまま）。
        *   確認：`node --input-type=module -e "await import('./js/wiring/ItemListWiring.js')"`で、importの名前の誤りが無いこと。

*   [ ] タスク13: 使われなくなった並べ替えの規則・操作を消す
    *   **対象ファイル** :
        *   `./js/core/ListDragRules.js`・`./js/core/GroupTreeRules.js`・`./js/core/VectorModel.js`・`./js/edit/ShapeOrderEditor.js` :（更新。「要件1」の「消すもの」）
        *   `./test/core/ListDragRules.test.js`・`./test/core/GroupTreeRules.test.js`・`./test/core/VectorModel.items.test.js`・`./test/core/VectorModel.insertTarget.test.js`・`./test/core/VectorModel.groupSelection.test.js`・`./test/core/VectorModel.collapse.test.js`・`./test/edit/ShapeOrderEditor.test.js`・`./test/edit/SnapshotAdapter.items.test.js`・`./test/edit/InsertTarget.flow.test.js` :（更新。要件6の表のタスク13の件）
        *   `./test/core/VectorModel.reorderShapes.test.js` :（削除）
    *   **作業内容** :
        *   消す前に、製品コード（`js/`・`index.html`）に呼び出しが残っていないことを`Grep`で確かめる。消した後、`js/`のコメントに消した名前（`reorderShapes`・`applyOrder`・`applyRowOrder`・`hasGroupItem`・`hasGroups`・`insertItemsAbove`・`resolveInsertTarget`・`resolveInsertMarkId`・`insertMarkId`・`resolveDraggedIds`・`resolveDropIndex`・`resolveDropMark`・`reorderRowsForDrop`・`isSameOrder`・`toDrawOrder`）が残っていないことも確かめる（残っていて、このタスクの対象ファイル以外なら、直さず5章へ書く）。`ListDragRules`・`ShapeOrderEditor`・`VectorModel`の先頭の責務・クラスJSDocを直す。

*   [ ] タスク14: 通しのテスト
    *   **対象ファイル** :
        *   `./test/edit/FolderDragTargetCopy.flow.test.js` :（新規）
    *   **作業内容** :
        *   実物（`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`GroupEditor`・`ShapeOrderEditor`・`ShapeInserter`（`insertsAtTarget: true`）・`ClipboardController`・`DocumentSerializer`と、`ListDragRules`・`ItemRowRules`）を組み合わせ、公開APIだけで確かめる：座標 → 場所 → `moveTo`の通し（入れる・出す・フォルダごと・一番下）、描く → 取り消す → 描き直す（フォルダの中の途中・一番下・いちばん外側の一番下・空のフォルダ・絵が空になる）とやり直しで描き込む先が動かないこと、切り取り → 取り消し → 貼り付け、ツールの切り替え相当（`clearSelection`）で`inside`が残り描くと中の一番上へ入り続けて重なる、作るボタン → 描く、インポート（引数なしの`insertDocument`）がフォルダの中・一番下へ入る、キャンバスの入れ替え（`replaceAllShapes`）で無しに戻る、描き込む先を変えても`capture()`・作業データ・スプライトのテキストが変わらない、フォルダの操作とドラッグとコピーを続けて行った後の取り消し/やり直しの往復でJSONと選んでいるフォルダが各段階で一致しidの重複が無いこと、フォルダの無い絵での複製・コピー・切り取り・ドラッグの結果が今までと同じこと（一番下の切り取りと貼り付けだけ元の場所）。
        *   不具合を見つけた場合は製品コードを直さず、5章へ書いて報告する。

*   [ ] タスク15: 周りのJSDocの言葉合わせ
    *   **対象ファイル** :
        *   `./js/edit/CanvasFileOperations.js`・`./js/edit/EndpointSnapper.js`・`./js/edit/SnapshotAdapter.js` :（更新。コメントだけ）
    *   **作業内容** :
        *   「描き込む先のすぐ上（無ければ最前面／末尾）」を「描き込む先（行の上・フォルダの中・一番下。無ければ最前面）」の意味へ、`SnapshotAdapter`の「選ばれている一番上の図形になる」を「選んでいるまとまりの一番上のもので決まる」へ直す。コードは1文字も変えない。

*   [ ] タスク16: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   『開発資料の更新予定』を確認し、1章・2章・3章・4章の一覧へ反映する。書く内容は実コードで確かめる。古い記述（`reorderShapes`・`applyOrder`・平らな写し・図形のidだけの描き込む先・フォルダのある絵で行のドラッグを始めないこと）を残さない。行末を保つ。

*   [ ] タスク17: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`13_palette.md`・`14_edit.md`・`16_test.md`・`46_ItemTreeRules.md`・`48_ItemListRules.md`・`53_ItemListWiring.md`・`54_InsertTargetRules.md`・`55_ListDragRules.md`・`56_ItemListRowDrag.md`・`57_GroupTreeRules.md`・`58_GroupSelectionRules.md`・`61_ItemRowRules.md` :（更新）
        *   `./_doc/arch/62_ItemPlaceRules.md` :（新規）
    *   **作業内容** :
        *   『開発資料の更新予定』を確認して反映する。消した規則の項は消す。`main.js`の行数（02）とテストの件数（16）は実測して直す（`InputTracker.js`は変えていないため行数は変わらない）。書き換える前に各ファイルの行末を実測し、保つ（ファイルごとに混在している）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 入る場所の計算の規則
*   **作業内容** :
    *   `js/core/ItemPlaceRules.js`を新規作成（CRLF）：`PLACE_KIND`・typedef`ItemPlace`・`ItemLocation`・`findItemLocation`・`insertItemsAt`・`canMoveItems`・`moveItems`。内部関数`updateListAt`（`ancestorIds`の通り道だけ新しいオブジェクトにして並びを置き換える）を非公開で持つ。importは`ItemTreeRules`・`GroupTreeRules`のみ。
    *   `GroupTreeRules.js`：`pickItems`・`listGroupIds`を追加し、`wrapUnits`は`pickItems`を使う（結果は同じ）。`hasGroupItem`は残した。先頭の責務・importの記述は変更不要のため触れていない。
    *   `ItemTreeRules.insertItemsAbove`は残した。
    *   テスト：`test/core/ItemPlaceRules.test.js`を新規（CRLF）、`GroupTreeRules.test.js`へ`pickItems`・`listGroupIds`を追加のみ。`node --test`は tests 3235 / pass 3235 / fail 0。

### タスク2: 描き込む先の決まり方と、貼り付け・複製の場所の規則
*   **作業内容** :
    *   `js/core/InsertTargetRules.js`（CRLF）：先頭の責務とimportの記述を直し、typedef`InsertTarget`・`resolveNextInsertTarget`・`resolveRowInsertTarget`・`isSameInsertTarget`・`resolvePastePlace`・`resolveDuplicatePlace`を追加。内部関数`isValidInsertTarget`・`resolveVanishedTarget`（元の場所のたどり）を非公開で持つ。今の`resolveInsertTarget`・`resolveInsertMarkId`は残した。
    *   `test/core/InsertTargetRules.test.js`（CRLF）：新しい5関数のテストを追加（importの行は新しい関数の分だけ足した）。`node --test`は tests 3278 / pass 3278 / fail 0。

### タスク3: VectorModelが描き込む先を1つの値で持つ
*   **作業内容** :
    *   `js/core/VectorModel.js`（LF）：`#insertTargetId`を`#insertTarget`（場所またはnull）へ。`#applyState`は引数`insertTarget`とし、選んでいるフォルダを先に不変条件へ通してから`resolveNextInsertTarget`を呼ぶ。`getInsertTarget()`（写し）を追加、`getInsertTargetId()`は`above`のときのidだけ（値は毎回求める）。`setInsertTarget(id)`は`resolveRowInsertTarget`・`isSameInsertTarget`で判定（フォルダの行も可）。`commitDraft`・`replaceShape`（select偽で選択空）は`{ above, 図形のid }`、`replaceAllShapes`は`keepInsertTarget`で今の値か`null`。`#placeAdded(addedItems, place)`は`insertItemsAt`で書き直し、呼び出し（`commitDraft`・`addShapesWithNewIds`）は`atInsertTarget`が真なら`#insertTarget`、偽なら`null`を渡す。`insertItemsAbove`のimportを外し、`resolveNextInsertTarget`・`resolveRowInsertTarget`・`isSameInsertTarget`・`PLACE_KIND`・`insertItemsAt`をimport。クラスJSDoc・先頭の責務・各JSDocを3つの形へ直した。
    *   `js/core/InsertTargetRules.js`（CRLF）：古い`resolveInsertTarget`を消した（`resolveInsertMarkId`はタスク8まで残す）。
    *   テスト：`InsertTargetRules.test.js`の旧9件とimportを消した。要件6の表の既存5件（`VectorModel.groupSelection`・`VectorModel.collapse`・`GroupEditor.flow`の`描き込む先`の2件・`ShapeInserter.insertTarget`の切り取り→貼り付け）を新しい期待値へ。`VectorModel.insertTarget.test.js`へ`描き込む先の3つの形（フォルダ）`の11件を追加のみ。`node --test`は tests 3281 / pass 3281 / fail 0。

### タスク4: 作るボタンの空のフォルダと描き込む先
*   **作業内容** :
    *   （未記入）

### タスク5: 追加の入口（入る場所・まとまりとして入れる）
*   **作業内容** :
    *   （未記入）

### タスク6: ShapeInserterの受け渡し
*   **作業内容** :
    *   （未記入）

### タスク7: フォルダの形を保ったコピー・切り取り・貼り付け・複製
*   **作業内容** :
    *   （未記入）

### タスク8: 描き込む先の印の規則と一覧の同期
*   **作業内容** :
    *   （未記入）

### タスク9: 一覧のパネルの線と目立たせる行
*   **作業内容** :
    *   （未記入）

### タスク10: 行のドラッグの規則
*   **作業内容** :
    *   （未記入）

### タスク11: 行のドラッグの編集操作
*   **作業内容** :
    *   （未記入）

### タスク12: 行のドラッグの切り替え（進行・配線）
*   **作業内容** :
    *   （未記入）

### タスク13: 使われなくなった並べ替えの規則・操作を消す
*   **作業内容** :
    *   （未記入）

### タスク14: 通しのテスト
*   **作業内容** :
    *   （未記入）

### タスク15: 周りのJSDocの言葉合わせ
*   **作業内容** :
    *   （未記入）

### タスク16: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   （未記入）

### タスク17: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント
*   **自分のコピーの判定は「描き込む先がそのフォルダの中」で行い、貼り付けの時点でフォルダが選ばれているかは見ない**（計画の判断）。フォルダをコピーして描くツールへ持ち替えて貼り付けると、選択は外れているが描き込む先はそのフォルダの中のままで、このときも中ではなくすぐ上に入る。
*   **貼り付けで入ったフォルダも「自分のコピー」に数える**（計画の判断）。数えないと、`Ctrl`+`V`を続けたとき2つ目が1つ目のコピーの中へ入り込むため。`Ctrl`+`D`で作ったフォルダは数えない（選んで貼り付けると、その中に入る）。
*   **インポートの後の選択は今までどおり図形だけ**（REQの要件5が「貼り付け・複製の後」としているため）。入ったフォルダは選んでいる状態にならない。
*   **元の場所の「同じフォルダの中で残っている行」は、今も同じフォルダの中にある行だけ**を数える（同時に別のフォルダへ移った行は数えない）。
*   **`VectorModel.getInsertTargetId()`は製品コードからの呼び出し元が無くなる**（既存のテスト約90か所の値を変えないために残す。値は別に持たず`#insertTarget`から求める。`deleteShapes`と同じ扱い）。
*   **折りたたんだフォルダの中へ図形を貼り付け・複製すると、入った図形が選ばれるためフォルダは開く**（今の「一覧以外で選んだら開く」の規則）。描く・行のドラッグ・空のフォルダだけの貼り付け・作るボタンでは開かず、フォルダの行に印が出る。
*   **行のドラッグ中は、描き込む先の線（破線）を隠す**（ドラッグの線と疑似要素を取り合わないため。描き込む先の行の印はそのまま）。
*   **フォルダの行の三角の上から押して動かしても、行のドラッグになる**（動かさずに離せば開閉）。
*   **自動スクロールで見えている範囲の端の行に入るときの場所は、その端の行の位置で決まる**（上下へ外れたときは見えている端として扱う、今の規則のまま）。一番下まで送り切ってから下へ外れると、いちばん外側の一番下になる（送り切ったかは`maxScrollTop`との差が1px以内で見る。表示倍率が125%等でスクロール位置が小数になっても届くようにするため）。
*   **頂点の選択（`A`）でも、行のドラッグ・フォルダの選択はできる**（今の一覧の規則）。まとめる（`Ctrl`+`G`）・削除・切り取りは選択（`V`）だけ（今の規則）。
*   タスク3〜7の途中では、描き込む先の線の印が出ない（タスク8・9で出る）。タスク12までは、フォルダのある絵で行のドラッグは始まらない。
*   （タスク1）`insertItemsAt`の`above`は、基準がフォルダでも「そのフォルダ行のすぐ上」（同じ並びのすぐ後ろ）へ入る（`insertItemsAbove`は図形だけが基準だった）。`moveItems`の目印は`Symbol`のidを持つ一時のフォルダで、結果には残らない。開発資料への影響はタスク16・17で反映する予定の範囲内。

*   （タスク2）「すぐ下の行が別のフォルダへ移った」場合は、その行を数えず、さらに下（配列で前）の同じ並びの行へたどる（テストは、たどった先がフォルダ行なら`above`・無ければ`bottom`）。`resolveNextInsertTarget`の規則1は、まとまりの種類を`resolveRowInsertTarget`で決める（規則の二重化なし）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。塗りのボタン（🪣）をONにし、色の違う塗った図形を8つほど、少しずつ重ねて描く。描き終えたら`V`（選択）にし、いくつか選んで`Ctrl`+`G`でフォルダを2つ作る（1つは、フォルダの行を押し、`Ctrl`を押しながら図形の行を押して`Ctrl`+`G`＝入れ子）。
1.  **入れる・出す**：図形の行をフォルダの行の真ん中へドラッグすると、フォルダの行が目立ち（線は出ない）、離すと中の一番上に入る。中の行を外の行の上半分・下半分へドラッグすると、その行のすぐ上・すぐ下へ出る。線の字下げで深さが分かる。キャンバスの重なりも変わる。`Ctrl`+`Z` 1回で戻る。一覧の左右へ外れると線が消え、離しても何も起きない。`Esc`で取りやめられる。
2.  **フォルダの中の一番下**：フォルダの中の一番下の行の下半分へドラッグすると中に、次の外の行の上半分へドラッグすると外に入る。一覧の一番下の空いている所へドラッグすると、いちばん外側の一番下に入る（行が多くて空いている所が無いときは、一番下まで送ってから一覧の下へ外す）。一番上の行より上へ外すと、いちばん外側の一番上に入る。
3.  **フォルダごと**：フォルダの行をドラッグすると、中身ごと動く（中の行もうすくなる）。フォルダの行の上の端・真ん中・下の端で、すぐ上・中の一番上・中の一番上（折りたたんだフォルダ・空のフォルダならすぐ下）に入る。別のフォルダの中へも入れられる。自分の中や、自分の中のフォルダの中では線も出ず、離しても何も起きない。
4.  **まとめて**：離れた図形とフォルダを、一覧で`Ctrl`＋クリックで選び、選ばれている行をドラッグすると、順番を保ってひとかたまりで動き、選ばれたまま。選んでいるフォルダの中の行をドラッグすると、その行だけが選ばれて動く。選ばれていないフォルダの行をドラッグすると、そのフォルダが選ばれて動く。
5.  **折りたたんだフォルダ**：折りたたんだフォルダの行の真ん中へドラッグすると中に入り、開かない（選ばれている図形が中にある印＝破線の枠が出る）。中身を全部出しても、空のフォルダが残る。
6.  **描き込む先**：`V`でフォルダの行を押して選び、図形を描くツールに持ち替えると、フォルダの行に印（左端の青い線とうすい青の背景）が出て、描いた図形が中の一番上に入る（印は描いた図形の行へ移る）。描くツールのままフォルダの行（三角以外）を押しても同じ印が出る。中の図形の行を押すと、そのすぐ上に入る。折りたたんだフォルダの中へ描くと、開かずに破線の枠が出る。
7.  **元の場所**：`V`でフォルダの中の一番下の図形を選んで`Ctrl`+`X`で切り取ると、入る場所が青い破線（フォルダの最後の行の下。フォルダが空になったときはフォルダの行の印）で分かり、`Ctrl`+`V`で貼り付けるとフォルダの中の一番下に戻る。いちばん外側の一番下の行でも同じ（一番下に破線）。描くツールのまま、描いた図形を`Ctrl`+`Z`で取り消すと、入る場所が線か印で分かり、描き直すと同じ場所に入る。すぐ下の行がフォルダのときは、そのフォルダの行の上の端に破線が出る。
8.  **フォルダのコピー**：`V`でフォルダの行を押して選び、`Ctrl`+`D`・`Ctrl`+`C`→`Ctrl`+`V`・`Alt`＋ドラッグ（選ばれている図形の本体の上から。外枠のハンドルの上を除く）をすると、フォルダの形のまま、元のフォルダのすぐ上に写り、写った方が選ばれている。名前は元と同じ。`Ctrl`+`V`を続けると、コピーの中へ入らず上へ重なっていく。`Ctrl`+`Z` 1回で戻る。空のフォルダも、`Ctrl`+`D`・`Ctrl`+`C`・`Ctrl`+`X`・`Ctrl`+`V`ができる（キャンバスに形が無いので`Alt`＋ドラッグはできない）。
9.  **ほかのものを貼り付ける**：図形をコピーし、`V`でフォルダの行を押して選んで貼り付けると、フォルダの中の一番上に入る（折りたたんでいれば開く）。フォルダを選んだ状態でインポートしても、中の一番上に入る。別のフォルダを選んで、コピーしたフォルダを貼り付けると、その中に入る。
10. **作るボタン**：図形を描くツールのまま作るボタン（一覧の下端）を押すと、描き込む先に空のフォルダができ、そのフォルダの行に印が出て、続けて描くとその中に入る（ツール・引いている途中の線はそのまま）。`V`で何かを選んでいるときは、今までどおりまとめるボタンとして働く。
11. **フォルダの無い絵**：新しいキャンバスで図形だけを描き、並べ替え・描き込む先・複製・コピー・切り取りが今までどおり（一番下の行の切り取りと貼り付けは、元の場所に戻るようになった）。
12. **ほかが今までどおり**：一覧での選択・折りたたみ・名前の変更（名前の編集中にほかの操作をしても欄が壊れない）・`Ctrl`+`G`・`Home`等のキー、描く・動かす・変形・色・整列・保存・書き出し・開くが今までどおり動く。

*   （タスク3）`ShapeInserter.insertTarget.test.js`の切り取り→貼り付けの件は、表のとおり名前も「…描き込む先がいちばん外側の一番下になり、そこへ戻る（仕様）」へ直した。`VectorModel.js`の`listShapes`・`ITEM_KIND`等のimportはほかで使うため残した。
