# RES: 作業計画・作業レポート (Phase 11-03) : 一覧での並べ替えと、描き込む先
* 参照元REQ: `./_log/req/261124_2100_REQ_Phase11-03_Reorder_And_Insert_Target.md`

## 1. 作業目的
図形の一覧の行をドラッグして重なり順を変えられるようにし、新しい図形がどこに入るか（描き込む先）を一覧で分かるようにする。オプションバーの重なり順の4つのボタンはなくす（キーは残す）。

* 作業データ・書き出し・履歴のエントリの形・版は変えない（保存する項目は増えない）。
* **変更しないファイル**：`shapes/`・`io/`・`CanvasManager.js`・`ItemAttributeRules.js`・`ListSelectionRules.js`・`ThumbnailRules.js`・`ThumbnailRenderer.js`・`HistoryManager.js`・`CanvasLibrary.js`・`PathJoiner.js`・`PathCornerEditor.js`・`FocusKeyYieldRules.js`・`InputModes.js`・`ShapeFactory.js`・`DisplayState.js`。
* **JSDoc・コメントだけ直すファイル**（コードは1行も変えない）：`KeyboardShortcuts.js`（対応表・判定は変えない）・`DragTracker.js`（コードはそのまま使い回す）・`ClipboardController.js`・`CanvasFileOperations.js`・`ShapeOrderRules.js`・`OptionBarAlignGroup.js`・`OptionBarCornerGroup.js`。
* 計画時点の`node --test`は tests 2764 / pass 2764 / fail 0。
* **行末**：既存ファイルはCRLFとLFが混在している。編集の前に`git ls-files --eol <パス>`の`w/`で実測し、行末を保つこと（Git Bashの`grep`で`\r`を数えると誤るため使わない）。計画時の実測は、CRLF＝`js/core/`の`InputTracker`・`KeyboardShortcuts`・`DragTracker`、`js/edit/`の`ShapeInserter`・`SnapshotAdapter`・`ClipboardController`・`CanvasFileOperations`、`js/palette/OptionBarCornerGroup`、`js/main.js`、`PROJECT_ARCHITECTURE.md`、`_doc/arch/`の01・02・03・06・09・13・14・16。LF＝`js/core/`の`VectorModel`・`ItemTreeRules`・`SelectionRules`・`ItemListRules`・`ListScrollRules`、`js/edit/`の`EndpointSnapper`・`ShapeOrderEditor`・`ShapeOrderRules`、`js/palette/`の`ItemListPanel`・`OptionBarAlignGroup`、`js/wiring/ItemListWiring`、`index.html`、対象の既存のテスト6ファイル、`_doc/arch/`の07・27・46・48・50・53。新しいファイルは`js/`・`test/`・`_doc/arch/`ともCRLF。本RESはLF。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **行**：一覧の1行（図形のアイテム1つ）。**行の並び**は上が前面＝`model.getShapes()`（**描画順**。先頭が最も奥）の逆順。
*   **描き込む先**：次に入る図形の位置を決める行（図形のid）。新しい図形はその**すぐ上**＝描画順で**すぐ後ろ**に入る。無し（`null`）なら、いちばん外側の末尾（最前面。今と同じ）。
*   **印**：選ばれている行が無いときに、描き込む先の行に出す見た目（要件4）。
*   **行のドラッグ**：一覧の並べ替えのドラッグ。押下から離す・取りやめまで。閾値を超えて動いたものを「始まった」と呼ぶ。
*   **ロック中**：`canvasLibrary.getState()`の`loading`または`busy`（`ItemListRules.isListLocked`。既存）。

### モジュールの分担（全体）
| 置き場所 | 役割 |
| --- | --- |
| `core/InsertTargetRules.js`（新規） | 描き込む先の決まり方の規則（唯一の定義箇所）と、印を出すidの規則。状態なし・importなし |
| `core/ItemTreeRules.js`（更新） | 入れ子のまま「ある図形のすぐ上」へアイテムを入れる`insertItemsAbove`を足す |
| `core/VectorModel.js`（更新） | 描き込む先の唯一の持ち主。`#items`・選択集合・描き込む先の書き込みを1つの非公開メソッドへまとめる（タスク7では`reorderShapes`のJSDocだけ） |
| `core/SelectionRules.js`（更新） | 利用者のクリックの次の選択`resolveUserClickSelection`を足す。typedef`SelectionChange`の受け渡し先を直す |
| `core/InputTracker.js`（最小の更新） | 利用者の選ぶ・外す操作を`model.setSelectionByUser`へ渡す、`commitDraft`の引数（タスク9では「`Esc`で中断できるドラッグ」のJSDocだけ） |
| `core/ItemListRules.js`（更新） | 描くツールで行を押したときの判定、行のドラッグを始めてよいか・始まったときに行を選ぶか |
| `core/ListScrollRules.js`（更新） | 強調（選択または印）が変わったかの判定 |
| `core/ListDragRules.js`（新規） | 動かす行・ドロップ位置・線を出す行・動かした後の並び・自動スクロールの量の規則。状態なし・importなし |
| `core/KeyboardShortcuts.js`（JSDocだけ） | 受理判定の注入の意味に「一覧の行のドラッグ」を足す |
| `core/DragTracker.js`（JSDocだけ） | 座標の取得関数の説明（今は`InputTracker`だけの書き方）を、使う側が2つの形に直す |
| `edit/ShapeOrderEditor.js`（更新） | 並び全体を指定する1件の編集操作`applyOrder`を足し、`getAvailability`とそれに伴う言及・importを消す |
| `edit/ShapeOrderRules.js`（JSDocだけ） | 消した部品への言及を直す |
| `edit/ClipboardController.js`・`edit/CanvasFileOperations.js`（JSDocだけ） | 入る位置の「最前面へ」を直す |
| `edit/ShapeInserter.js`・`edit/EndpointSnapper.js`・`edit/SnapshotAdapter.js`（更新） | 入る位置の指定・描き込む先を保つ指定を渡す |
| `palette/ItemListPanel.js`（更新） | 印・動かす行・入る場所の線の表示、行の押下の通知、寸法の照会。DOMと通知だけ |
| `palette/OptionBarOrderGroup.js`（削除） | 要件2 |
| `palette/OptionBarAlignGroup.js`・`palette/OptionBarCornerGroup.js`（JSDocだけ） | 消したまとまりへの言及を直す |
| `wiring/ItemListRowDrag.js`（新規） | 行のドラッグの進行（`DragTracker`・自動スクロールの`requestAnimationFrame`・取りやめ）。規則へ渡し結果をパネル・注入された関数へ渡すだけ |
| `wiring/ItemListWiring.js`（更新） | 上の部品の生成・橋渡し |
| `main.js`（更新） | 注入だけ。重なり順のまとまりの配線を消す（行数は減る） |
| `index.html`（更新） | `#option-order-group`を消す・CSSを足す |

依存の向き：`core/VectorModel → core/InsertTargetRules`（状態を持つクラスが規則をimportする向き）、`wiring/ItemListWiring → wiring/ItemListRowDrag → core/DragTracker・core/ListDragRules`（`wiring/ → core/`は既存の向き。**`wiring/`内のimportと、`wiring/`が`core/`の状態を持つ部品を生成して持つのは今回が初めて**）。循環は無い。

### 要件3: 描き込む先の決まり方
**持ち主は`VectorModel`の`#insertTargetId`（`string|null`）だけ。** 新しく描く図形のスタイルと同じく、`model.onChange`の今の経路で通知でき、作業データ・書き出し・スナップショット（`getItems()`・`getSelectedIds()`から作る）に自然に含まれない。

1.  **規則`InsertTargetRules.resolveInsertTarget({ previousIds, ids, selectedIds, targetId })`**（`previousIds`＝変わる前の図形id、`ids`＝変わった後の図形id。どちらも描画順。`selectedIds`＝変わった後の選択集合（`Set`）。`targetId`＝候補）。上から順に、最初に当たったものを返す。
    1.  `ids`のうち`selectedIds`にあるものが1つ以上 → その**最後**（＝一番上の行）。
    2.  `targetId`が`null` → `null`。
    3.  `ids`に`targetId`がある → `targetId`。
    4.  `previousIds`の`targetId`の位置から先頭へ向かって（＝下の行へ）たどり、`ids`に残っている最初のもの。
    5.  無い（`previousIds`にも無い場合を含む） → `null`。
    これにより**選択が1つ以上あれば、描き込む先は必ず「選ばれている一番上の行」**で、選択・図形一式と食い違う状態を作れない。
2.  **書き込みを1か所にする**：`VectorModel`の非公開メソッド`#applyState({ items = this.#items, selectedIds = this.#selectedIds, insertTargetId = this.#insertTargetId })`。`listShapes`で前後のid（描画順）を求めて規則を呼び、`#insertTargetId`・`#items`・`#selectedIds`へ代入する（通知はしない）。**`#items`・`#selectedIds`・`#insertTargetId`へ代入するのはコンストラクタとこのメソッドだけ**にする（今の`this.#selectedIds.clear()`・`.delete(id)`等のその場の書き換えも、新しい`Set`を作って渡す形へ直す）。図形が無くなったときの付け替えを、消す経路ごとに書かない。`#pruneSelectedVertices()`・ホバー等の後始末の順と、通知の回数は今のまま。
3.  **経路ごとの候補**（`#applyState`へ渡すもの）：
    | 経路 | 渡すもの |
    | --- | --- |
    | `setSelection(ids)`・`clearSelection()` | 選択集合だけ（**空になっても描き込む先は残る**＝ツールの切り替え`setMode`・取り消し/やり直しの復元・選択の反転） |
    | `setSelectionByUser(ids)`（新規） | 選択集合。**結果が空なら`insertTargetId: null`** |
    | `setInsertTarget(id)`（新規） | `insertTargetId: id` |
    | `commitDraft` | アイテムと`insertTargetId:`新しいid |
    | `addShapesWithNewIds` | アイテムと選択集合（足した図形が選ばれるので規則1で決まる） |
    | `replaceShape` | アイテムと選択集合。**`select`が偽で、置き換えた後の選択集合が空なら`insertTargetId: shape.id`**（線を引くツールでの描き足し・結合・閉じる）。それ以外は渡さない |
    | `replaceAllShapes(values, { keepInsertTarget = false } = {})` | アイテムと空の選択集合。`keepInsertTarget`が偽なら`insertTargetId: null`（キャンバスの切り替え・開く・新規作成・`?dev`の復元）、真なら今の値（取り消し/やり直し） |
    | `addShape`・`deleteShapes`・`replaceShapesKeepingIds`・`reorderShapes`・`renameItem` | 変わるものだけ（候補は今の値） |
    *   `replaceShape`を引数の追加ではなく選択集合で見分ける理由：`EndpointSnapper`は作成モード（選択集合は必ず空）、角・区間の切り替え（`PathCornerEditor`。`select: false`）は頂点の選択（選んだ頂点の図形が必ず選択集合にあり、`keepId: true`で残る）で、選択の不変条件で確実に分かれる。既存のテスト`EndpointSnapper.test.js`は`replaceShape`の引数を`{ keepId, removeIds, select }`との`deepEqual`で確かめているため、引数は足せない。
4.  **公開操作（新規）**
    *   `getInsertTargetId()`：`string|null`。
    *   `setInsertTarget(id)`：今ある図形のidでなければ何もせず通知もしない。規則を通した結果、描き込む先が変わったときだけ通知1回（選択集合があれば規則1により変わらない）。図形・選択・作成途中の図形・履歴に触れない。戻り値は変わったか。
    *   `setSelectionByUser(ids)`：**利用者が選ぶ・外す操作の入口**。`setSelection`と同じく現存しないidを除き、頂点の選択を落とす。結果が空なら描き込む先を無しにする。**何も選んでおらず、描き込む先も無く、結果も空のときだけ**、何もせず通知もせず`false`。それ以外は通知1回で`true`。
5.  **選択が空になった理由の区別**：区別は**どのメソッドを呼ぶか**（`setSelectionByUser`＝利用者が外した／それ以外＝外していない）だけで、判定（空なら無し）は`setSelectionByUser`の1か所。呼ぶのは`InputTracker`の`#applySelectionChange`（クリック・範囲選択・`Ctrl`＋クリック）と`Esc`、`ItemListWiring`の行のクリック・ドラッグ開始時の選択だけ。`setMode`・`deleteSelection`・全選択・選択の反転・復元は今のメソッドのまま。
6.  **何も選んでいないときの空いている所のクリック**：今の`resolveClickSelection`は`null`（何もしない）を返し、既存のテストがこの値を確かめているため変えない。`SelectionRules`に`resolveUserClickSelection(selectedIds, hitId, additive)`を足す：`additive`が偽で`hitId`が無ければ**選択の有無によらず`{ type: 'clear' }`**、それ以外は`resolveClickSelection`の結果。`InputTracker.handleClick`の3か所（選択モード・頂点の選択の`Ctrl`あり/なし）をこれへ差し替える。範囲選択は今の`resolveMarqueeSelection`（`Ctrl`なしの0件は`set([])`）のまま。
7.  **`Esc`**：`InputTracker.cancelDraftOrClearSelection`の(4)を「選択モードまたは頂点の選択モード かつ IDLE なら`return this.model.setSelectionByUser([])`」にする（選択も描き込む先も無ければ偽が返り、今と同じく`preventDefault()`しない）。(1)〜(3)（ドラッグの中断・作成途中・頂点の選択の解除）と、その前の`styleEyedropper.cancelPicking`が先に働く形は変えない。
8.  **描くツールで行を押したとき**：決まるのは行のクリック（離したとき。一覧の選択と同じ。ドラッグになったときは変わらない）。既存のテスト`ItemListRules.test.js`が`resolveRowPressAction`の作成モード＝`none`を確かめているため**その関数は変えず**、別の判定`canSetInsertTargetByRow({ mode, isPicking, isDragging, isLocked })`（作成モードで、スポイト待ち受け中・ドラッグ中・ロック中でないときだけ真）を足す。`ItemListWiring.#handleRowClick`は`none`のときだけこれを見て、真なら`model.setInsertTarget(id)` → `sync({ allowScroll: false })`。`Ctrl`・`Shift`は読まない。名前の欄の中のクリックは今どおり届かない。
9.  **一覧の空いている所のクリック**：今も選択は変わらない（行の無い所のクリックは通知されない）。今までどおり何もしない（5.章の確認ポイント）。

### 要件5: 入る位置
*   `ItemTreeRules.insertItemsAbove(items, isTarget, addedItems)`：`isTarget(shape)`が真になる最初（前順）の図形のアイテムと**同じ並び（同じフォルダの`children`）の、すぐ後ろ**へ`addedItems`を順のまま入れた新しい入れ子を返す。見つからなければいちばん外側の末尾へ足す。図形は不透明に扱う（idは`isTarget`の側で見る）。引数は書き換えない（通り道のフォルダだけ新しいオブジェクト）。
*   `VectorModel.commitDraft({ atInsertTarget = false } = {})`・`addShapesWithNewIds(values, { atInsertTarget = false } = {})`：真なら描き込む先のすぐ上、偽・描き込む先なしなら今と同じ末尾。**省いたときの並びは今と同じ**。位置は、その呼び出しで選択・描き込む先を書き換える前の値で決める。
*   渡す側：
    *   `InputTracker.handleClick`の`commitDraft`・`EndpointSnapper.#commitDrawnShape`の`commitDraft` → `{ atInsertTarget: true }`（既存の偽のモデルは引数を読まないため、テストの値は変わらない）。
    *   `ShapeInserter`：コンストラクタの省ける依存`insertsAtTarget`（既定`false`）を足し、`addShapesWithNewIds(result.items, { atInsertTarget: this.#insertsAtTarget })`。**`main.js`だけが`insertsAtTarget: true`で生成する。** 既定を`false`にする理由：既存のテスト`ClipboardController.test.js`・`ClipboardController.items.test.js`が「下の図形を選んで貼り付け・複製すると末尾に入る」値を確かめており、その値を変えずに要件を満たすため。
    *   貼り付け・複製・`Alt`＋ドラッグ・インポートは、すべて`ShapeInserter`を通る（`ClipboardController`・`CanvasFileOperations`はコードを変えず、入る位置のJSDocだけ直す）。**複製**は選択が1つ以上あり、規則1により描き込む先＝選ばれている一番上の行なので、要件どおりの位置になる（複製専用の位置の引数は持たない）。
    *   貼り付け・インポートの前の`applyMode(SELECT)`は`clearSelection`を通るため、描き込む先は残る。
*   自動の名前（`resolveItems`）・採番・選択・記録の単位・ずらし量は変えない。フォルダの中が描き込む先なら、インポートの入れ子ごとそのフォルダの中へ入る。
*   `SnapshotAdapter.restore`は`replaceAllShapes(result.items, { keepInsertTarget: true })`。続く`setSelection`で1つ以上選ばれれば規則1、空なら規則3・4。

### 要件1: 行のドラッグでの並べ替え
1.  **規則（`core/ItemListRules`に足す。操作モードを知るもの）**
    *   `canStartRowDrag({ button, hasModifier, isEditingRow, isDragging, isLocked })`：左ボタン（`0`）で、`Ctrl`（`⌘`）・`Shift`なし・編集中の行でない（名前の欄は編集中の行にしか無いため、欄の中の押下も含む）・キャンバスの左ドラッグ/パン中でない・ロック中でないときだけ真。操作モードは見ない。
    *   `shouldSelectPressedRow({ mode, isPicking, isSelected })`：選択・頂点の選択モードで、スポイトの待ち受け中でなく、押した行が選ばれていないときだけ真。
2.  **規則（`core/ListDragRules`。新規・importなし）**
    *   `resolveDraggedIds({ rowIds, selectedIds, pressedId })`：押した行が選ばれていれば、選ばれている行すべて（行の並びの順）。そうでなければ`[pressedId]`。
    *   `resolveDropIndex({ pointerX, pointerY, area, rowCount })` → `number|null`。`area`＝`{ left, right, top, height, scrollTop, maxScrollTop, rowHeight }`（クライアント座標px）。`pointerX`が`left`未満・`right`より大きければ`null`。行が無い・`rowHeight`か`height`が正でなければ`null`。高さを`[top, top + height]`へ収め（上下へ外れたときは**見えている端**）、`Math.round((y − top + scrollTop) / rowHeight)`を`0`〜`rowCount`に収めて返す（`0`＝一番上の行の上、`rowCount`＝一番下の行の下）。
    *   `resolveDropMark(rowIds, dropIndex)` → `{ id, edge: 'before'|'after' }|null`。`dropIndex`が`null`・行が無ければ`null`、`rowIds.length`未満ならその行の`'before'`、`rowIds.length`なら最後の行の`'after'`。
    *   `reorderRowsForDrop({ rowIds, draggedIds, dropIndex })`：`dropIndex`より上の動かさない行 ＋ 動かす行（行の並びの順）＋ 残りの動かさない行。新しい配列。
    *   `isSameOrder(a, b)`：2つのidの並びが同じか。`toDrawOrder(rowIds)`：行の並びを描画順へ（逆順の新しい配列）。
    *   `resolveAutoScrollTop({ pointerX, pointerY, area, elapsedMs })` → `number|null`（動かさないなら`null`）。左右へ外れている・寸法が正でない・`maxScrollTop`が正でないなら`null`。上端・下端の帯（24px。`height / 2`を超えない）に入った深さの割合（外れていれば1）に応じて90〜900px/秒、経過時間は50msまでとして量を求め、`0`〜`maxScrollTop`に収めて、今の`scrollTop`と同じなら`null`。値はファイル内の定数（exportしない）。
3.  **編集操作**：`ShapeOrderEditor.applyOrder(orderedIds)`。今の`getShapes()`のidと同じ並びなら`beginEdit`も呼ばず`false`。違えば`beginEdit` → `model.reorderShapes(orderedIds)` → `commitEdit`、戻り値は`reorderShapes`の結果（`apply`の後半と共有する非公開メソッドにする）。並びの正本は`model.reorderShapes`のまま（フォルダの位置と入れ子を保つ今の動き）。選択集合は変えない。
4.  **表示（`palette/ItemListPanel`）**：新しいコールバック`onRowPress(id, event, isEditingRow)`（行の上の`mousedown`のたび。名前の欄の中・修飾キー付き・左以外のボタンでも呼ぶ＝押下のたびにclick抑止の残りを消せるようにするため。`preventDefault()`しない）。メソッド`setDraggedRows(ids)`（その行へ`dragging`、一覧へ`row-dragging`のクラス。空なら消す）・`showDropMark(mark)`（行へ`drop-before`／`drop-after`。`null`で消す）・`getListArea()`（2.の`area`）。**線は行のクラスと`::before`／`::after`の疑似要素で描き、`.item-list`の子に要素を足さない**（`render`の並べ替え・`getSelectedRowIds`が子＝行を前提にしているため）。`render`の差分の反映と「編集中の行の要素を動かさない」前提は変えない。
5.  **進行（`wiring/ItemListRowDrag`。新規）**：`new DragTracker((event) => ({ x: event.clientX, y: event.clientY }))`を1つ持つ（**`DragTracker`はコードを変更せず使い回す**（JSDocだけ直す）：閾値・`mouseup`の取りこぼしの保険・`blur`の中断・click抑止。閾値は3px＝キャンバスと同じ値をファイル内の定数で持つ）。
    *   依存（注入）：`panel`・`getRowIds()`（今の行の並び）・`isSelected(id)`・`shouldSelectPressedRow(id)`・`selectRow(id)`・`applyOrder(orderedIds)`・`onDragStart()`（自分の出したホバーを消す）。`VectorModel`・`InputTracker`・`HistoryManager`・操作モードを知らない。
    *   `press(id, event, canStart)`：必ず先に`clearSuppressedClick()`。`canStart`が真なら`begin`（`suppressClick: 'whenMoved'`）。
    *   `onStart`：行の並びを控える（押した行が無ければ取りやめ）→ `onDragStart()` → `shouldSelectPressedRow(id)`が真なら`selectRow(id)` → `resolveDraggedIds` → `panel.setDraggedRows` → 自動スクロールの`requestAnimationFrame`を始める。
    *   `onMove`・`refresh()`（一覧のスクロール時）・自動スクロールの毎フレーム：最後のポインター位置から`resolveDropIndex` → `resolveDropMark` → `panel.showDropMark`。
    *   `onEnd(event, moved)`：始まっていなければ何もしない（この後の`click`が今までどおり）。始まっていれば、後始末（表示と控えと`requestAnimationFrame`を消す）を**先に**行い、`isSameOrder(控えた並び, 今の並び)`が偽なら何もせず、ドロップ位置が`null`なら何もせず、そうでなければ`applyOrder(toDrawOrder(reorderRowsForDrop(…)))`。
    *   `cancel()`：`DragTracker.cancel({ suppressClick: true })`（`onCancel`で後始末だけ）。押している間（閾値以前を含む）なら真を返す。**始まる前の`Esc`も同じ**（キャンバスの拡大縮小・回転の`Esc`と同じ範囲）。
    *   `cancelIfRowsChanged()`：始まっていて、行の並びが控えと違えば取りやめる。
    *   `isActive()`（押下から。閾値以前を含む）・`isMoving()`（始まった後）・`consumeSuppressedClick()`。
    *   **キャンバスのドラッグと同時に始まらない**：始めるときは`canStartRowDrag`が`inputTracker.isDragging()`を見る。逆向き（行のドラッグ中のキャンバスの中ボタンのパン等）は、`window`のcaptureの`mousedown`で、`isActive()`の間の押下を`preventDefault()`＋`stopPropagation()`して止める（`InputTracker`に状態・照会を足さない）。
6.  **橋渡し（`ItemListWiring`）**：`onRowPress` → `canStartRowDrag(…)`の結果とともに`rowDrag.press`。`#handleRowClick`の先頭で`rowDrag.consumeSuppressedClick()`が真なら終わり。`selectRow(id)`は`model.setSelectionByUser([id])`・`#anchorId = id`・`sync({ allowScroll: false })`。ホバーの判定の`isDragging`に`rowDrag.isMoving()`を足す（押しただけでは消さない）。取りやめの契機：`sync()`の先頭（`cancelIfRowsChanged`）、`canvasLibrary.onChange`で`openCanvasId`が変わった・ロック中になった、`displayState.onChange`で一覧を隠した。`onScroll`で`rowDrag.refresh()`も呼ぶ。公開は`sync`に`isRowDragging()`（＝`rowDrag.isActive()`）・`cancelRowDrag()`（＝`rowDrag.cancel()`）を足すだけ。
7.  **ショートカット（`main.js`の注入だけ）**：`isDragging: () => inputTracker.isDragging() || itemListWiring.isRowDragging()`、`isCancelableDrag: () => inputTracker.isScalingSelection() || itemListWiring.isRowDragging()`、`cancel: () => itemListWiring.cancelRowDrag() || styleEyedropper.cancelPicking(…今のまま…)`。今の受理判定（手順3の例外・手順5）がそのまま働き、行のドラッグ中は`Esc`だけが（修飾キーを問わず）通る。対応表・判定の関数は変えない。
8.  **作成途中の線**：行の押下は`VectorModel`の作成途中の図形・`InputTracker`に触れない（`setMode`を呼ばない）ため残る。描くツール・キャンバス移動・スポイト待ち受け中のドラッグでは`selectRow`を呼ばない。

### 要件4: 描き込む先の見せ方
*   `InsertTargetRules.resolveInsertMarkId({ selectedCount, insertTargetId })`：選択が1つ以上なら`null`、そうでなければ`insertTargetId`。
*   `ItemListPanel.render`の行の表示内容に`insertTarget`（真偽値）を足し、変わった行だけ`insert-target`のクラスを書く。`getInsertMarkId()`（今の表示の印の行のid。無ければ`null`）を足す。
*   スクロール：`ListScrollRules.hasHighlightChanged({ previousSelectedIds, selectedIds, previousMarkId, markId })`（`hasSelectionChanged`が真、または印のidが違う）。真なら、選ばれている行（無ければ印の行）の添字を今の`resolveSelectionScrollTop`へ渡す（見えていれば動かない）。一覧で押して変わったときは今どおり`sync({ allowScroll: false })`を先に呼ぶため動かない。
*   CSS：`.item-row.insert-target { background-color: #eef4ff; box-shadow: inset 3px 0 0 #1a73e8; }`（選ばれた行の`#dbe9ff`より薄い）。

### 要件2: 重なり順のボタンをなくす
*   消すもの：`index.html`の`#option-order-group`、`palette/OptionBarOrderGroup.js`、`main.js`のimport・生成・`syncOptionBarOrderGroup`と登録・起動時の呼び出し、`ShapeOrderEditor.getAvailability`とtypedef`ShapeOrderAvailability`。`ShapeOrderEditor.apply`・`ShapeOrderRules`（`canReorderSelected`は`apply`が使う）・`main.js`の`performShapeOrder`・`ShapeOrderOperation`（`ShapeOrderRules`の定義と`main.js`のimport）・キーの4つの注入は残す。`ShapeOrderEditor`の`ShapeOrderOperation`のimportは消す（タスク6）。
*   **消すテスト**：`test/edit/ShapeOrderEditor.test.js`の「`getAvailability: 4つの値が各操作のcanReorderSelectedと一致し、何も呼ばない`」の1件だけ（`OptionBarOrderGroup`のテストは無い）。ほかの既存のテストの値は変えない。
*   `index.html`の1行目の幅の見積もりのコメントを直す（重なり順140pxと区切り17pxの1つを除き、約646px → 約489px）。

### 要件6: 自動テスト
新しいテスト：`test/core/InsertTargetRules.test.js`・`test/core/VectorModel.insertTarget.test.js`・`test/core/ListDragRules.test.js`・`test/edit/ShapeInserter.insertTarget.test.js`・`test/edit/EndpointSnapper.insertTarget.test.js`・`test/edit/InsertTarget.flow.test.js`。足すテスト：`ItemTreeRules`・`SelectionRules`・`ItemListRules`・`ListScrollRules`・`ShapeOrderEditor`・`KeyboardShortcuts.keydown`の各既存ファイルの末尾。`InputTracker`・`ItemListPanel`・`ItemListRowDrag`・`ItemListWiring`・`main.js`・CSSはDOMのため対象外で、判定は規則のファイルに出す。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`・`./js/edit/`・`./js/palette/`・`./js/wiring/`・`./js/main.js`・`./index.html`・`./test/`
*   **関連する論理クラス**:
    *   新規：`core/InsertTargetRules`・`core/ListDragRules`・`wiring/ItemListRowDrag`
    *   更新：`VectorModel`・`ItemTreeRules`・`SelectionRules`・`InputTracker`・`ItemListRules`・`ListScrollRules`・`KeyboardShortcuts`（JSDoc）・`DragTracker`（JSDoc）・`ShapeInserter`・`EndpointSnapper`・`SnapshotAdapter`・`ShapeOrderEditor`・`ShapeOrderRules`（JSDoc）・`ClipboardController`（JSDoc）・`CanvasFileOperations`（JSDoc）・`OptionBarAlignGroup`（JSDoc）・`OptionBarCornerGroup`（JSDoc）・`ItemListPanel`・`ItemListWiring`・`main.js`・`index.html`
    *   削除：`palette/OptionBarOrderGroup`

### 参照する責務
*   **フォルダの規則**：`core/`の規則は状態なし・DOMなしの関数（何もimportしないか規則どうし）。`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`palette/`は何もimportせず、図形・`VectorModel`・`InputTracker`・`HistoryManager`を知らない（表示とコールバックの通知だけ）。`wiring/`は購読・生成・注入・橋渡しで判定・計算を持たない（`main.js`だけが使う）。`edit/`は1件の編集操作の手順で、操作モードを知らない。`main.js`は生成・注入・同期のみ。新しいファイルの先頭には責務のJSDocを3行以内で書く。
*   **`VectorModel`**：図形一式・選択集合・ホバー・作成途中の図形・新しく描く図形のスタイル等のSSOT。状態を変えるAPIは変更後に`onChange`へ通知する（回数は契約でテストが確かめている）。入れ子の計算は`ItemTreeRules`、名前等は`ItemAttributeRules`へ委ねる。図形種別・図形固有のプロパティ名・並べ替えの規則を知らない。履歴の記録は呼び出し側。
*   **選択の不変条件**：選択集合は常に現存する図形のidだけを含み、選択・頂点の選択以外のモードでは空。頂点の選択は選択集合の図形の組だけ。`setMode`は無条件に`clearSelection()`を呼ぶ。描き込む先を選択集合で表さない。
*   **`ItemTreeRules`**：入れ子の計算。importなし。アイテムかの判定で`kind`を見るほかは図形のプロパティを読まない。引数を書き換えず新しい入れ子を返す。
*   **`SelectionRules`**：クリック・範囲選択の次の選択の指示（`set`/`clear`/`null`）。importなし。`resolveClickSelection`は`ListSelectionRules`も使う。
*   **`InputTracker`**：入力の解釈。選択の規則は`SelectionRules`へ渡し、結果を`#applySelectionChange`で受け渡すだけ（`model.setSelection`／`clearSelection`）。作成の確定は`beginEdit` → `commitDraft` → `commitEdit`。`Esc`の実体は`cancelDraftOrClearSelection`（(1)ドラッグの中断 (2)作成途中 (3)頂点の選択の解除 (4)選択の解除 (5)何もしない＝偽）。今回は状態・規則を足さない。
*   **`DragTracker`**：押下から解放まで1回のドラッグの進行だけ（閾値・`window`のcaptureの購読・取りこぼしの保険・`blur`の中断・click抑止）。座標の取得関数だけ注入される。公開は`begin`・`isActive`・`hasMoved`・`cancel({ suppressClick })`・`consumeSuppressedClick`・`clearSuppressedClick`。`onEnd`・`onCancel`の時点でセッションは終了済み。`onStart`の直後に同じイベントで`onMove`が呼ばれる（`onStart`の中で`cancel`しても呼ばれるため、控えが無ければ何もしないこと）。
*   **`KeyboardShortcuts`**：受理判定は手順1〜7の固定。手順3の例外`findCancelableDragBinding`は、`isCancelableDrag()`が真の間だけ`Esc`を修飾キーを問わず通す。手順5は`isDragging()`が真なら実行しない。対応表は変えない。
*   **`ShapeOrderEditor`／`ShapeOrderRules`**：選択中の図形の重なり順の操作（4操作）の手順と規則。`model`は`getShapes`・`isSelected`・`reorderShapes`だけを使う。キーは`main.js`の`performShapeOrder`（ドラッグ中は不受理）を通る。
*   **`model.reorderShapes(orderedIds)`**：今の全図形のidをちょうど1回ずつ並べた配列（描画順）を受け、フォルダの位置と入れ子を保ったまま図形のアイテムを置き直す。選択集合・ホバー・作成途中の図形に触れない。
*   **`ShapeInserter`**：作業データの図形を新しいidで追加する1件の編集操作（貼り付け・複製・インポートの共通処理）と、記録しない入口（`Alt`＋ドラッグ）。`VectorModel`・記録先は注入。`deserialize`の`result.items`を渡す（`getShapes()`を渡すと名前とフォルダが失われる）。
*   **`EndpointSnapper`**：吸い付きと、線の描き終え（`#commitDrawnShape`＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`、`#reflectDrawnJoin`＝`cancelDraft` → `beginEdit` → `replaceShape(…, { keepId, removeIds, select: false })` → `commitEdit`）。
*   **`SnapshotAdapter`**：スナップショット（作業データ＋選択集合）の取得・適用。操作モードを知らない。適用は`replaceAllShapes` → （選択・頂点の選択モードのときだけ）`setSelection`。
*   **`ItemListPanel`**：行の要素をidごとに持ち回り差分だけ書く。**編集中の行の要素はDOMの中で動かさない**。名前の編集の出口は`#finishNameEdit`だけ。クリック・ホバーは`.item-list`への委譲、`mousedown`は`preventDefault()`しない。名前の欄の中の押下・クリックは行を押したことにしない。
*   **`ItemListWiring`**：`model.onChange`を`requestAnimationFrame`で1フレームに1回へまとめて`sync()`。選択集合の写しは持たない。行を押した後は`sync({ allowScroll: false })`をその場で呼ぶ（一覧で押した選択ではスクロールしない）。ホバーは`resolveRowHover`の結果に従う。
*   **テストの規則**：`node --test`。偽の依存は素のオブジェクト、実物を組み合わせるときは公開APIだけを通す。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md`**
    *   1章：構成図（`core/InsertTargetRules.js`・`core/ListDragRules.js`・`wiring/ItemListRowDrag.js`と新しいテスト6ファイルを足す、`palette/OptionBarOrderGroup.js`を消す、`index.html`の説明の「1行目＝…重なり順」、`ItemTreeRules`・`SelectionRules`・`ItemListRules`・`ListScrollRules`・`DragTracker`の使う側）。「存在しないもの」（「ドラッグによる並べ替え」「並べ替え（ドラッグを含む）」を今の形に直す、「離れた選択図形をまとめる重なり順の変更」はキーの話として残す、Phase 11-03でやらないと決めたことを足す）。フォルダ分割の方針（`core/`の規則・`wiring/`の項）と依存方向（`VectorModel → InsertTargetRules`、`wiring/`内のimport、`wiring/ → core/DragTracker`（`wiring/`が`core/`の状態を持つ部品を生成して持つのは初めて）。「`InputTracker`が生成して持つ状態を持つ部品`DragTracker`をimportする1件だけ」は`core/`内の話のまま）。
    *   2章：描き込む先の状態（持ち主・規則・`#applyState`・保存しない）、「アイテム」の追加の位置（いちばん外側の末尾 → 描き込む先のすぐ上）、選択状態、キャンバス記録の「保存しないもの」の列挙。
    *   3章：前文の同期の経路（「重なり順」のまとまりの言及）・1.・3.（選択を外す操作・`Esc`・行のドラッグ中の`Esc`）・6.（記録する操作＝一覧の並べ替え、記録しない操作＝描き込む先の変更、`replaceAllShapes`の引数）・7.・8.・9.（入る位置）・11.・12.・22.（確定した線の位置と描き込む先）・13.（1行目の並び・幅の見積もり）・14.（ボタンをなくした・`applyOrder`・流れ・やらないこと）・16.（一覧での選択・`Alt`＋ドラッグの入る位置）・18.（空いている所のクリック・`Esc`）・25.（`Esc`で中断できるドラッグに一覧の行のドラッグの照会が並ぶ）・27.（重なり順の4ボタンの言及）・28.（並べ替え・印・流れ・発注者の決定・設計判断・確認の状況）。4章の表へ新しい資料の行。
*   **`_doc/arch/`**：`01_index_html`・`02_main`（7.5.・7.8.・7.15.・8.・起動時・行数）・`03_VectorModel`・`06_InputTracker`（行数）・`07_KeyboardShortcuts`・`09_DragTracker`（使う側が2つ）・`13_palette`（`OptionBarOrderGroup`の項を消す・`ItemListPanel`）・`14_edit`（`ShapeOrderEditor`・`ShapeInserter`・`EndpointSnapper`・`SnapshotAdapter`。`ClipboardController`・`CanvasFileOperations`は入る位置の言及があれば）・`16_test`・`27_SelectionRules`・`46_ItemTreeRules`・`48_ItemListRules`・`50_ListScrollRules`・`53_ItemListWiring`。新規：`54_InsertTargetRules`・`55_ListDragRules`・`56_ItemListRowDrag`。
*   各タスクで判明した影響はここへ追記する。

## 3. タスクリスト
※ 全タスク共通：コード修正の後、(1) 足した・変えたクラス・関数・データ構造のJSDoc（ファイル先頭の責務を含む）の漏れが無いことを確かめる、(2) `node --test`の全件合格を確かめる、(3) 本RESの該当タスクを`[x]`にし、4章の詳細作業内容を書く、(4) 開発資料に影響が出る場合は資料本体を直さず「開発資料の更新予定」へ追記する。対象ファイルに無いファイルは変えない。

*   [x] タスク1: 描き込む先の規則と、入れ子のまま入れる計算
    *   **対象ファイル** :
        *   `./js/core/InsertTargetRules.js` :（新規）
        *   `./js/core/ItemTreeRules.js` :（更新）
        *   `./test/core/InsertTargetRules.test.js` :（新規）
        *   `./test/core/ItemTreeRules.test.js` :（更新。末尾へ追加）
    *   **作業内容** :
        *   `InsertTargetRules`に`resolveInsertTarget`（要件3の1.）と`resolveInsertMarkId`（要件4）を書く。importなし・状態なし・引数を書き換えない。JSDocを書く。
        *   `ItemTreeRules`に`insertItemsAbove(items, isTarget, addedItems)`（要件5）を足す。JSDocを書く。
        *   テスト：規則1〜5のすべて（選択があれば一番上・候補が残る・消えたら下の近い行・下が全部消えた・候補なし・前の並びに無い候補・引数を変えない）、印のid。`insertItemsAbove`（外側・フォルダの中・深い入れ子・見つからない＝末尾・複数・フォルダを含む追加・元を変えない・通り道でないフォルダは同じ参照）。

*   [x] タスク2: VectorModelが描き込む先を持つ
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./js/edit/SnapshotAdapter.js` :（更新）
        *   `./test/core/VectorModel.insertTarget.test.js` :（新規）
    *   **作業内容** :
        *   `#insertTargetId`と`#applyState`を足し、`#items`・`#selectedIds`へ代入している全経路（`addShape`・`setSelection`・`clearSelection`・`commitDraft`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`・`replaceShapesKeepingIds`・`reorderShapes`・`renameItem`）を`#applyState`経由へ直す（要件3の2.・3.の表）。通知の回数・順、戻り値、警告は変えない。
        *   `getInsertTargetId`・`setInsertTarget`・`setSelectionByUser`（要件3の4.）、`commitDraft`・`addShapesWithNewIds`の`atInsertTarget`、`replaceAllShapes`の`keepInsertTarget`を足す。ファイル先頭の責務（3行以内）・クラスとメソッドのJSDocを直す。
        *   `SnapshotAdapter.restore`で`{ keepInsertTarget: true }`を渡す（JSDocも）。
        *   テスト：要件3の表の全経路、省いたときの並びが今と同じこと、`atInsertTarget`（描き込む先なし・外側・フォルダの中・複数・入れ子の追加）、足した後の選択と描き込む先、`setSelectionByUser`の戻り値と通知、`clearSelection`で残る、`replaceShape`の`select: false`（選択あり＝変わらない／なし＝結果の図形／`keepId`の真偽）、`replaceShape`の`select: true`、削除で下の行へ・下に無ければ無し、`reorderShapes`・`replaceShapesKeepingIds`・`renameItem`で変わらない、`replaceAllShapes`の2通り、通知1回。

*   [x] タスク3: 入る位置（描く・貼り付け・複製・インポート）
    *   **対象ファイル** :
        *   `./js/edit/ShapeInserter.js` :（更新）
        *   `./js/edit/ClipboardController.js` :（更新。JSDocだけ）
        *   `./js/edit/CanvasFileOperations.js` :（更新。JSDocだけ）
        *   `./js/edit/EndpointSnapper.js` :（更新。`#commitDrawnShape`とそのJSDocだけ）
        *   `./js/core/InputTracker.js` :（更新。`handleClick`の`commitDraft`の引数とJSDocだけ）
        *   `./js/main.js` :（更新。`// 7.5.`の`ShapeInserter`の生成だけ）
        *   `./test/edit/ShapeInserter.insertTarget.test.js` :（新規）
        *   `./test/edit/EndpointSnapper.insertTarget.test.js` :（新規）
    *   **作業内容** :
        *   要件5のとおり。`ShapeInserter`の責務・`insertDocument`のJSDocの「最前面へ」と、処理順4.の「いちばん外側の末尾へ追加する」を直す（`insertsAtTarget`が真なら描き込む先のすぐ上、偽・描き込む先なしなら末尾＝最前面）。
        *   `ClipboardController`の`paste`・`pasteInPlace`・`duplicateInPlaceWithinEdit`のJSDocの「最前面へ」（3か所）と、`CanvasFileOperations`のクラスJSDocの`importFile`の手順5の「最前面への追加」（1か所）を直す。入る位置は`ShapeInserter`が決める（描き込む先のすぐ上、無ければ最前面）という書き方にし、コードは変えない。
        *   テスト（実物の組み合わせ。`insertsAtTarget: true`）：貼り付け・同じ位置に貼り付け（`ClipboardController`経由）・複製・`Alt`＋ドラッグの複製・インポート相当（入れ子の作業データ）の位置・順番・選択・記録1件・取り消し、描き込む先なし＝末尾、フォルダの中、離れた複数を選んだ複製、切り取って貼り付けると元の位置（いちばん下の行を切り取ったときは最前面＝仕様）、選択を`clearSelection`で空にした後の貼り付け（ツールの切り替え）でも描き込む先のすぐ上。`insertsAtTarget`を省くと末尾。`EndpointSnapper`（実物の`VectorModel`）：続けて引いて終えた線の位置、続けて描く、閉じる、描き足し・つなげる（`keepId`の真偽）で結果の図形が描き込む先になり位置は元のまま、何も残らない終わり方では変わらない。

*   [x] タスク4: 選択を外す操作の区別
    *   **対象ファイル** :
        *   `./js/core/SelectionRules.js` :（更新）
        *   `./js/core/InputTracker.js` :（更新。import・`handleClick`の3か所・`#applySelectionChange`・`cancelDraftOrClearSelection`の(4)と、それぞれのJSDocだけ）
        *   `./test/core/SelectionRules.test.js` :（更新。末尾へ追加）
    *   **作業内容** :
        *   `resolveUserClickSelection`（要件3の6.）を足す。`resolveClickSelection`は変えない（JSDocの「従来の`InputTracker`の呼び出し」もそのまま）。
        *   typedef`SelectionChange`の説明の受け渡し先を直す：`set`＝`setSelectionByUser(ids)`、`clear`＝`setSelectionByUser([])`。`VertexSelectionChange`の受け渡し先は変わらないので直さない（「同じ約束」は`set`／`clear`／`null`の形の話として残す）。
        *   `InputTracker`：`handleClick`の`resolveClickSelection`の3か所を差し替える。`#applySelectionChange`は`this.model.setSelectionByUser(change.type === 'clear' ? [] : change.ids)`にする。`Esc`の(4)を要件3の7.のとおりにする。JSDocは、`handleClick`（`resolveClickSelection`・`setSelection`・`clearSelection`への言及と「空白なら選択集合が空でなければ全解除」。選択モードと頂点の選択の両方）・`#applySelectionChange`の`@param`・`cancelDraftOrClearSelection`の(4)を直す。`setMode`・`selectAll`・`deleteSelection`は変えない。状態・規則を足さない。
        *   テスト：`Ctrl`なしの空白（選択あり・なし）＝`clear`、`Ctrl`ありの空白＝`null`、当たりありは`resolveClickSelection`と同じ、引数を変えない。規則＋`VectorModel`の組み合わせ（空いている所のクリック・空の範囲選択・`Ctrl`＋クリックで最後の1つ・何も選んでいないときのクリックで無しになる）。

*   [x] タスク5: 一覧の印と、描くツールで行を押したとき
    *   **対象ファイル** :
        *   `./js/core/ItemListRules.js` :（更新）
        *   `./js/core/ListScrollRules.js` :（更新）
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./index.html` :（更新。CSSだけ）
        *   `./test/core/ItemListRules.test.js` :（更新。末尾へ追加）
        *   `./test/core/ListScrollRules.test.js` :（更新。末尾へ追加）
    *   **作業内容** :
        *   `canSetInsertTargetByRow`（要件3の8.）・`hasHighlightChanged`（要件4）を足す。`resolveRowPressAction`は変えない。
        *   `ItemListPanel`：`render`の`insertTarget`・`getInsertMarkId()`（要件4）。
        *   `ItemListWiring`：`sync`で`resolveInsertMarkId`・`hasHighlightChanged`を使う。`#handleRowClick`の`none`の枝で`canSetInsertTargetByRow` → `model.setInsertTarget(id)` → `sync({ allowScroll: false })`（行が今あるかは`setInsertTarget`が見る）。選択の反映を`model.setSelectionByUser`へ替える（`Ctrl`＋クリックで最後の1つを外すと無しになる）。
        *   CSS：`.item-row.insert-target`。
        *   テスト：追加した2つの規則の全分岐。

*   [x] タスク6: オプションバーの重なり順のまとまりを消す
    *   **対象ファイル** :
        *   `./index.html` :（更新。`#option-order-group`と1行目の幅の見積もりのコメント）
        *   `./js/palette/OptionBarOrderGroup.js` :（削除）
        *   `./js/main.js` :（更新）
        *   `./js/edit/ShapeOrderEditor.js` :（更新）
        *   `./js/edit/ShapeOrderRules.js` :（更新。JSDocだけ）
        *   `./js/palette/OptionBarAlignGroup.js` :（更新。JSDocだけ）
        *   `./js/palette/OptionBarCornerGroup.js` :（更新。JSDocだけ）
        *   `./test/edit/ShapeOrderEditor.test.js` :（更新。`getAvailability`のテスト1件と、それだけが使う`canReorderSelected`のimportを消し、先頭の責務コメントを直す。`OPS`・`ShapeOrderOperation`はほかのテストが使うので残す）
    *   **作業内容** :
        *   要件2のとおり。`main.js`の`// 7.8.`は「重なり順（キー）配線」として`shapeOrderEditor`・`performShapeOrder`を残し、コメント・JSDocの「ボタン」を直す（`// 8.`の注入のコメント「ボタンと同一経路」も）。`performShapeOrder`の`isDragging()`の判定は残し、JSDocの「ボタンはショートカット以外の呼び出し元のため」の理由を直す。`ShapeOrderEditor`の責務・クラスJSDocから照会・ボタンを除く。ほかのまとまりの並びと見た目は変えない。
        *   `ShapeOrderEditor`の`ShapeOrderOperation`のimport：コードで使うのは`getAvailability`だけで、消した後は`apply`のJSDocの`@param`の型にしか現れないため、**importから除き**、`@param`を`{import('./ShapeOrderRules.js').ShapeOrderOperation}`（`edit/`の既存の書き方）にする。`canReorderSelected`・`reorderSelected`のimportは残す。
        *   `ShapeOrderRules`：`ShapeOrderOperation`のJSDocの`getAvailability`・`ShapeOrderAvailability`・`OptionBarOrderGroup`・「表示側が黙って押せない表示になる」と、`canReorderSelected`のJSDocの「押せる/押せないの判定と、」を直す。
        *   `OptionBarAlignGroup`のクラスJSDoc「既存のまとまり（スタイル・重なり順・位置）」から重なり順を除き、`OptionBarCornerGroup`のクラスJSDoc「重なり順・整列のボタンと同じ」を「整列のボタンと同じ」にする。
        *   `test/edit/ShapeOrderEditor.test.js`の先頭の責務コメントの「押せる/押せないの照会」を除く。
        *   確かめ方：`js/`・`index.html`・`test/`に`OptionBarOrderGroup`（先頭が小文字の変数名も）・`option-order-group`・`option-bring-`・`option-send-`・`getAvailability`（`ShapeAlignEditor`・`ShapeAlignRules`・`main.js`の`shapeAlignEditor`のものを除く）・`ShapeOrderAvailability`の言及が残らない。さらに`重なり順`・`最前面へ`・`ボタンと同一経路`・`4ボタン`で検索し、残る当たりがどれも消したボタン・まとまりに言及していない（キー・並びの規則・図形の並び、または別のボタンの話だけである）ことを1件ずつ確かめる。`ShapeOrderEditor`・`ShapeOrderRules`とそのテストは`押せる`・`ボタン`でも検索する。

*   [x] タスク7: 行のドラッグの規則と、並び全体を指定する編集操作
    *   **対象ファイル** :
        *   `./js/core/ListDragRules.js` :（新規）
        *   `./js/core/ItemListRules.js` :（更新）
        *   `./js/edit/ShapeOrderEditor.js` :（更新）
        *   `./js/core/VectorModel.js` :（更新。`reorderShapes`のJSDocだけ）
        *   `./test/core/ListDragRules.test.js` :（新規）
        *   `./test/core/ItemListRules.test.js` :（更新。末尾へ追加）
        *   `./test/edit/ShapeOrderEditor.test.js` :（更新。末尾へ追加）
    *   **作業内容** :
        *   要件1の1.〜3.のとおり。`ShapeOrderEditor`の責務（3行以内）とクラスJSDoc（1行目の説明・前提。`applyOrder`は選択が空でも働き、ドラッグ中でないことは呼び出し側の一覧の行のドラッグの配線が守る）に「並び全体の指定」を足す。`test/edit/ShapeOrderEditor.test.js`の先頭の責務コメントにも足す。`apply`の結果は変えない。
        *   `VectorModel.reorderShapes`のJSDocの「並べ替えの規則を`core/`へ持ち込まず…規則は`edit/ShapeOrderRules.js`が持つ」は、`core/ListDragRules`ができて事実と食い違うため、「並べ替えの規則を`VectorModel`へ持ち込まず…規則は`edit/ShapeOrderRules.js`と`core/ListDragRules.js`が持つ」という内容に直す。
        *   テスト：ドロップ位置（各行の上半分・下半分・一番上・一番下・上下へ外れた（スクロール中の見えている端）・左右へ外れた・行0・寸法0）、線を出す行、動かした後の並び（1行・連続・離れた複数行・同じ位置・先頭・末尾・全行）、`toDrawOrder`・`isSameOrder`、自動スクロールの量（帯の外・帯の中の深さ・外れた・左右へ外れた・端で止まる・経過時間の上限・低い一覧）、`canStartRowDrag`・`shouldSelectPressedRow`の全分岐、`applyOrder`（偽の依存：順・同じ並びでは何も呼ばない。実物：記録1件・取り消し/やり直し・選択が残る・フォルダの位置と入れ子が残る・名前が図形について動く）。

*   [x] タスク8: 一覧のパネルのドラッグの表示と通知
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新。必須になるコールバック`onRowPress`へ、何もしない関数を渡すだけ）
        *   `./index.html` :（更新。CSSだけ）
    *   **作業内容** :
        *   要件1の4.のとおり。`onRowPress`はほかのコールバックと同じく関数でなければ`Error`（typedef`ItemListPanelOptions`とコンストラクタの`@throws`にも足す）。`render`で行が除かれたとき、動かす行・線の控えに残ったidで失敗しないこと。
        *   CSS：`.item-row { position: relative; }`、`.item-row.dragging`（半透明）、`.item-row.drop-before::before`（上端の2pxの青い線）・`.item-row.drop-after::after`（下端の2pxの青い線）。どちらも`position: absolute; left: 0; right: 0; pointer-events: none`で、行の高さ36pxを変えない。

*   [x] タスク9: 行のドラッグの進行と配線
    *   **対象ファイル** :
        *   `./js/wiring/ItemListRowDrag.js` :（新規）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/main.js` :（更新。`// 7.15.`の注入に`applyRowOrder: (orderedIds) => shapeOrderEditor.applyOrder(orderedIds)`を足す、`// 8.`の`isDragging`・`isCancelableDrag`・`cancel`の3つと、それぞれの直前のコメント）
        *   `./js/core/KeyboardShortcuts.js` :（更新。JSDocだけ＝責務・`ShortcutActions`の`isDragging`・`isCancelableDrag`・`cancel`・`CANCEL_BINDING`・`findCancelableDragBinding`・クラス・`#handleKeyDown`・`#findBinding`の説明に一覧の行のドラッグを足す）
        *   `./js/core/DragTracker.js` :（更新。JSDocだけ＝`#getScreenPoint`の「キャンバス左上基準…`InputTracker.getScreenCoordinate`を注入」を、使う側が注入する座標（`InputTracker`はキャンバス左上基準、`ItemListRowDrag`はクライアント座標）に直す）
        *   `./js/core/InputTracker.js` :（更新。JSDocだけ＝クラスJSDocと`isScalingSelection`の「『Escで中断できるドラッグか』の判定は1か所」を、キャンバスのドラッグについての話に限り、`isCancelableDrag`には一覧の行のドラッグの照会が並ぶことを書く。コードは変えない）
        *   `./test/core/KeyboardShortcuts.keydown.test.js` :（更新。末尾へ追加）
    *   **作業内容** :
        *   要件1の5.〜8.のとおり。`ItemListRowDrag`は規則の結果に従うだけで、判定・計算を書かない。`ItemListWiring`に書くのは橋渡しだけ（ドラッグの控え・座標を持たない）。公開は`sync`・`isRowDragging`・`cancelRowDrag`。
        *   テスト：`isDragging`・`isCancelableDrag`がともに真のとき、`Delete`・`Ctrl`+`Z`・`V`・`Home`・矢印は実行されず、`Esc`（修飾キーなし・`Shift`・`Alt`・`Ctrl`）は`cancel`が1回呼ばれ`preventDefault()`される（既にある検証は重ねて書かない）。

*   [x] タスク10: 描き込む先の通しのテスト
    *   **対象ファイル** :
        *   `./test/edit/InsertTarget.flow.test.js` :（新規）
    *   **作業内容** :
        *   実物（`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeInserter`・`ClipboardController`・`PathJoiner`・`PathCornerEditor`・`ShapeOrderEditor`・`CanvasLibrary`。`CanvasLibrary`の組み立て方は`test/edit/CanvasLibrary.items.test.js`に合わせる）で通して確かめる：描く → 取り消す → 描き直すと同じ場所／やり直しでは描き込む先が動かない／選択が戻る取り消しでは一番上の行（`shouldRestoreSelection`の真偽の両方）／削除・切り取り → 貼り付け／結合で除かれたとき結果の図形になる／角の切り替えで変わらない／並べ替えの記録1件と取り消し1回・行と一緒に動く／ツールの切り替え（`clearSelection`）で残り`setSelectionByUser([])`で外れる／キャンバスの切り替え・新規作成で無しになる（同じidの図形があっても）／描き込む先を変えても`capture()`・作業データ・スプライトのテキスト・履歴の件数が変わらず、記録もされない。
        *   js/は変えない。テストが通らない誤りを見つけたときは、直さず作業を中断して質問する。

*   [x] タスク11: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   「開発資料の更新予定」の`PROJECT_ARCHITECTURE.md`の分と、各タスクの追記を反映する（REQの例外により資料を書き換えてよい）。書き換える前に行末を実測して保つ。「確認の状況」はテストプレイ未実施と書く。

*   [ ] タスク12: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の「開発資料の更新予定」に挙げたファイル :（更新）
        *   `./_doc/arch/54_InsertTargetRules.md`・`./_doc/arch/55_ListDragRules.md`・`./_doc/arch/56_ItemListRowDrag.md` :（新規）
    *   **作業内容** :
        *   「開発資料の更新予定」の`_doc/arch/`の分と、各タスクの追記を反映する。書き換える前に**各ファイルの行末を実測して保つ**。`main.js`・`InputTracker.js`の行数、テストの件数は実測して直す。新しいファイルの書き方は既存の`48_ItemListRules.md`・`53_ItemListWiring.md`に合わせる。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 描き込む先の規則と、入れ子のまま入れる計算
*   **作業内容** :
    *   `js/core/InsertTargetRules.js`（新規・CRLF）：`resolveInsertTarget`（規則1〜5）と`resolveInsertMarkId`を実装。importなし・状態なし・引数を書き換えない。
    *   `js/core/ItemTreeRules.js`（LFのまま）：`insertItemsAbove(items, isTarget, addedItems)`を末尾へ追加。通り道のフォルダだけ新しいオブジェクト、通らないフォルダは同じ参照。
    *   テスト：`test/core/InsertTargetRules.test.js`（新規・CRLF）、`test/core/ItemTreeRules.test.js`末尾へ`insertItemsAbove`のdescribeを追加（importにも追記）。
    *   `node --test`：tests 2785 / pass 2785 / fail 0。

### タスク2: VectorModelが描き込む先を持つ
*   **作業内容** :
    *   `js/core/VectorModel.js`（LFのまま）：`#insertTargetId`・非公開`#applyState`（`#items`・`#selectedIds`・`#insertTargetId`への唯一の書き込み。コンストラクタを除く）・`#placeAdded`（`insertItemsAbove`か末尾）・`#filterExistingIds`を足した。`addShape`・`setSelection`・`clearSelection`・`commitDraft`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`・`replaceShapesKeepingIds`・`reorderShapes`・`renameItem`を`#applyState`経由へ直した（その場の`clear`・`delete`も新しい`Set`へ）。通知の回数・順・戻り値・警告は変えていない。
    *   公開の追加：`getInsertTargetId`・`setInsertTarget`・`setSelectionByUser`、`commitDraft({ atInsertTarget })`・`addShapesWithNewIds(values, { atInsertTarget })`・`replaceAllShapes(values, { keepInsertTarget })`。ファイル先頭の責務（3行以内）とクラス・各メソッドのJSDocを直した。
    *   `js/edit/SnapshotAdapter.js`（CRLFのまま）：`restore`が`replaceAllShapes(result.items, { keepInsertTarget: true })`を呼ぶ。JSDocも直した。
    *   `test/core/VectorModel.insertTarget.test.js`（新規・CRLF）：38件。
    *   `node --test`：tests 2823 / pass 2823 / fail 0。

### タスク3: 入る位置（描く・貼り付け・複製・インポート）
*   **作業内容** :
    *   `js/edit/ShapeInserter.js`（CRLFのまま）：省ける依存`insertsAtTarget`（既定`false`）を足し、`addShapesWithNewIds(result.items, { atInsertTarget })`を呼ぶ。責務・クラス・`insertDocument`・コンストラクタのJSDocの「最前面」「末尾」を直した。
    *   `js/main.js`（CRLFのまま）：`// 7.5.`の`ShapeInserter`の生成だけ`insertsAtTarget: true`を足した。
    *   `js/edit/EndpointSnapper.js`（LFのまま）：`#commitDrawnShape`の`commitDraft({ atInsertTarget: true })`とそのJSDoc。`js/core/InputTracker.js`（CRLFのまま）：`handleClick`の`commitDraft({ atInsertTarget: true })`とそのJSDoc。
    *   `js/edit/ClipboardController.js`（3か所）・`js/edit/CanvasFileOperations.js`（1か所）：JSDocの「最前面」を「入る位置は`ShapeInserter`が決める（描き込む先のすぐ上、無ければ最前面）」へ直した（コードは変えていない）。
    *   テスト：`test/edit/ShapeInserter.insertTarget.test.js`（新規・CRLF・10件）、`test/edit/EndpointSnapper.insertTarget.test.js`（新規・CRLF・8件）。
    *   `node --test`：tests 2841 / pass 2841 / fail 0。

### タスク4: 選択を外す操作の区別
*   **作業内容** :
    *   `js/core/SelectionRules.js`（LFのまま）：`resolveUserClickSelection`を足し、typedef`SelectionChange`の受け渡し先を`setSelectionByUser`へ直した。`resolveClickSelection`は変えていない。
    *   `js/core/InputTracker.js`（CRLFのまま）：importを`resolveUserClickSelection`へ差し替え（`resolveClickSelection`はもう使わない）、`handleClick`の3か所を差し替え、`#applySelectionChange`は`model.setSelectionByUser(change.type === 'clear' ? [] : change.ids)`、`Esc`の(4)は`return this.model.setSelectionByUser([])`にした。それぞれのJSDocも直した。
    *   `test/core/SelectionRules.test.js`（LFのまま）：末尾へ`resolveUserClickSelection`の4件と、規則＋`VectorModel`の5件を追加（importに`VectorModel`・`Line`を追記）。
    *   `node --test`：tests 2850 / pass 2850 / fail 0。

### タスク5: 一覧の印と、描くツールで行を押したとき
*   **作業内容** :
    *   `js/core/ItemListRules.js`（LFのまま）：`canSetInsertTargetByRow`を足した（作成モードで、スポイト待ち受け中・ドラッグ中・ロック中でないときだけ真）。`resolveRowPressAction`は変えていない。
    *   `js/core/ListScrollRules.js`（LFのまま）：`hasHighlightChanged`を足し、ファイル先頭の責務を直した。
    *   `js/palette/ItemListPanel.js`（LFのまま）：`render`の行の表示内容に`insertTarget`を足し、変わった行だけ`insert-target`のクラスを書く。`getInsertMarkId()`を足した。
    *   `js/wiring/ItemListWiring.js`（LFのまま）：`sync`で`resolveInsertMarkId`・`hasHighlightChanged`を使い、選ばれている行（無ければ印の行）の添字でスクロール。`#handleRowClick`の`none`の枝で`canSetInsertTargetByRow` → `model.setInsertTarget(id)` → `sync({ allowScroll: false })`。選択の反映を`setSelectionByUser`へ替えた。
    *   `index.html`（LFのまま）：`.item-row.insert-target`のCSSだけ足した（`.item-row.selected`の後ろ）。
    *   テスト：`ItemListRules.test.js`に`canSetInsertTargetByRow`の3件、`ListScrollRules.test.js`に`hasHighlightChanged`の5件を末尾へ追加。
    *   `node --test`：tests 2858 / pass 2858 / fail 0。

### タスク6: オプションバーの重なり順のまとまりを消す
*   **作業内容** :
    *   `index.html`（LFのまま）：`#option-order-group`を消し、1行目の幅の見積もりを約489pxへ直した。
    *   `js/palette/OptionBarOrderGroup.js`：削除（`git rm`）。
    *   `js/main.js`（CRLFのまま）：import・生成・`syncOptionBarOrderGroup`と登録・起動時の呼び出しを消した。`// 7.8.`は「重なり順（キー）配線」にし、`performShapeOrder`のJSDoc（ボタンの言及・`isDragging()`の理由）と`// 8.`の注入のコメントを直した。`performShapeOrder`の判定・キーの4つの注入は残した。
    *   `js/edit/ShapeOrderEditor.js`：`getAvailability`・typedef`ShapeOrderAvailability`を消し、`ShapeOrderOperation`のimportを除いて`@param`を`import('./ShapeOrderRules.js').ShapeOrderOperation`にした。責務・クラスJSDocから照会・ボタンを除いた。
    *   `js/edit/ShapeOrderRules.js`・`OptionBarAlignGroup.js`・`OptionBarCornerGroup.js`：JSDoc・コメントだけ直した。
    *   `test/edit/ShapeOrderEditor.test.js`：`getAvailability`のテスト1件と`canReorderSelected`のimportを消し、先頭の責務コメントを直した。
    *   `node --test`：tests 2857 / pass 2857 / fail 0。

### タスク7: 行のドラッグの規則と、並び全体を指定する編集操作
*   **作業内容** :
    *   `js/core/ListDragRules.js`（新規・CRLF）：`resolveDraggedIds`・`resolveDropIndex`・`resolveDropMark`・`reorderRowsForDrop`・`isSameOrder`・`toDrawOrder`・`resolveAutoScrollTop`。定数（帯24px・90〜900px/秒・経過50ms）はファイル内で持ち、exportしない。importなし。`selectedIds`は`Set`・配列のどちらも受ける。
    *   `js/core/ItemListRules.js`（LFのまま）：`canStartRowDrag`・`shouldSelectPressedRow`を足し、ファイル先頭の責務に「行のドラッグ」を足した。
    *   `js/edit/ShapeOrderEditor.js`（LFのまま）：`applyOrder(orderedIds)`と、`apply`と共有する非公開`#commitOrder`を足した（`apply`の結果・呼び出し順は変えていない）。責務・クラスJSDoc・前提を直した。
    *   `js/core/VectorModel.js`（LFのまま）：`reorderShapes`のJSDocだけ直した。
    *   テスト：`test/core/ListDragRules.test.js`（新規・CRLF）、`test/core/ItemListRules.test.js`・`test/edit/ShapeOrderEditor.test.js`の末尾へ追加（前者はimportにも追記、後者はimportに`ITEM_KIND`を追記し責務コメントに「並び全体の指定」を足した）。
    *   `node --test`：tests 2901 / pass 2901 / fail 0。

### タスク8: 一覧のパネルのドラッグの表示と通知
*   **作業内容** :
    *   `js/palette/ItemListPanel.js`（LFのまま）：必須コールバック`onRowPress(id, event, isEditingRow)`（関数でなければ`Error`。typedef・`@throws`にも追記）、`list`の`mousedown`で行の上なら毎回呼ぶ（`preventDefault()`なし。名前の欄・修飾キー・左以外でも呼ぶ）。`setDraggedRows(ids)`・`showDropMark(mark)`・`getListArea()`（typedef`ItemListArea`）を足した。線・動かす行はクラスだけで、`.item-list`の子は足していない。控えに残ったidの行が除かれていても`#rows`に無ければ飛ばす。クラスJSDocに追記。
    *   `js/wiring/ItemListWiring.js`（LFのまま）：`onRowPress: () => {}`を渡しただけ（タスク9で差し替え）。
    *   `index.html`（LFのまま）：`.item-row { position: relative; }`、`.item-row.dragging`（opacity 0.4）、`.drop-before::before`・`.drop-after::after`（2pxの青い線、absolute・`pointer-events: none`）。行の高さは変えない。
    *   テストは追加していない（DOM。計画どおり対象外）。

### タスク9: 行のドラッグの進行と配線
*   **作業内容** :
    *   `js/wiring/ItemListRowDrag.js`（新規・CRLF）：`DragTracker`を1つ持ち（閾値3px・`suppressClick: 'whenMoved'`）、`press`・`cancel`・`cancelIfRowsChanged`・`isActive`・`isMoving`・`consumeSuppressedClick`・`refresh`を公開。始まり（行の並びの控え→`onDragStart`→必要なら`selectRow`→`resolveDraggedIds`→`setDraggedRows`→自動スクロールの`requestAnimationFrame`）、移動（`resolveDropIndex`→`resolveDropMark`→`showDropMark`）、離す（後始末を先に行い、並びが控えと同じでドロップ位置があれば`applyOrder(toDrawOrder(reorderRowsForDrop(…)))`）。`window`のcaptureの`mousedown`は押下中だけ`preventDefault`＋`stopPropagation`で止める。
    *   `js/wiring/ItemListWiring.js`（LFのまま）：依存`applyRowOrder`を足し、`onRowPress`を`#handleRowPress`（`canStartRowDrag`の結果とともに`rowDrag.press`）へ差し替え、`onScroll`で`rowDrag.refresh()`、`#handleRowClick`の先頭で`consumeSuppressedClick`、ホバーの`isDragging`へ`rowDrag.isMoving()`を足した。取りやめは`sync()`の先頭（`cancelIfRowsChanged`）・`openCanvasId`が変わったとき・ロック中・一覧を隠したとき。公開は`sync`・`isRowDragging`・`cancelRowDrag`。
    *   `js/main.js`（CRLFのまま）：`applyRowOrder`の注入、`// 8.`の`isDragging`・`isCancelableDrag`・`cancel`の3つとコメント。
    *   `KeyboardShortcuts.js`・`DragTracker.js`・`InputTracker.js`（いずれもCRLFのまま）：JSDoc・コメントだけ直した（コードは変えていない）。
    *   テスト：`test/core/KeyboardShortcuts.keydown.test.js`（LFのまま）の注入の記録に`cancelable`を足し、末尾へ2件追加（行のドラッグ中は`Delete`等を実行しない／`Esc`は修飾キーを問わず`cancel`1回＋`preventDefault`）。
    *   `node --test`：tests 2903 / pass 2903 / fail 0。

### タスク10: 描き込む先の通しのテスト
*   **作業内容** :
    *   `test/edit/InsertTarget.flow.test.js`（新規・CRLF・9件）：実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeInserter`（`insertsAtTarget: true`）・`ClipboardController`・`PathJoiner`・`PathCornerEditor`・`ShapeOrderEditor`・`CanvasLibrary`（偽の保存先。`CanvasLibrary.items.test.js`と同じ組み立て）で、描く→取り消す→描き直す／やり直し／選択が戻る取り消し（`shouldRestoreSelection`の真偽）／削除・切り取り→貼り付け／結合／角の切り替え／並べ替え（記録1件・取り消し1回）／`clearSelection`と`setSelectionByUser([])`／キャンバスの切り替え・新規作成（同じidの図形があっても無し）／保存しないこと（`capture()`・作業データ・スプライトのテキスト・履歴の通知と件数）を確かめた。js/は変えていない。
    *   `node --test`：tests 2912 / pass 2912 / fail 0。

### タスク11: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`（CRLFのまま。改行は全行CRLF）を実コードの名前（`InsertTargetRules`・`ListDragRules`・`ItemListRowDrag`・各公開メソッド）と照らして更新した。
    *   1章：構成図（`InsertTargetRules`・`ListDragRules`・`ItemListRowDrag`・新しいテスト6ファイルを追加、`OptionBarOrderGroup`を削除、`index.html`の1行目の説明、`ItemTreeRules`・`SelectionRules`・`ItemListRules`・`ListScrollRules`・`KeyboardShortcuts`・`DragTracker`・`ItemListPanel`・`ItemListWiring`の説明）、「存在しないもの」（並べ替えの2か所を今の形に、Phase 11-03で入った・なくした・やらないと決めたことを追記）、フォルダ分割の方針（`core/`・`edit/`・`palette/`・`wiring/`）、依存方向（Phase 11-03の例外を追記。`wiring/`内のimportと`wiring/`が`DragTracker`を生成して持つ初めての例）。
    *   2章：アイテムの追加位置、保存対象・保存しないものに描き込む先、選択状態の下に「描き込む先」の項を追加。
    *   3章：前文・3.・5.・6.・7.・8.・9.・11.・12.・13.・14.・16.・18.・20〜23.の言及・25.・26.・28.を更新（28.に「行のドラッグでの並べ替え」「ドラッグの始まりと取りやめ」「描き込む先の見せ方と変え方」「Phase 11-03のふるまいの注意」「確認の状況（Phase 11-03）」を追加。テストプレイ未実施と書いた）。4章の表に54〜56の行を追加。
    *   コード・`_doc/arch/`・テストは変えていない。
    *   （監査指摘の修正）22.に「描き込む先」の項を追加：確定した線は`EndpointSnapper.#commitDrawnShape`の`commitDraft({ atInsertTarget: true })`で描き込む先のすぐ上（無ければ最前面）へ入る・描き終え／描き足し／結合／閉じるの後の描き込む先（終えた線または結果の図形。`replaceShape`は元の位置のまま）・点を打つ／消す／`Esc`は描き込む先に触れない・線を引いている途中の行の押下（`setInsertTarget`）とドラッグ（`applyOrder`）で作成途中の線が残ること。22.に古い「末尾」「最前面」の記述は無かった（`末尾＝付いてくる線の先`は頂点の話で別）。
    *   （監査指摘の修正）1.：図形の一覧の行の操作の受け付けない条件に、行のドラッグ・描き込む先の指定も同じ判定と追記。27.：幅・高さ・角度の欄は変わらないが、行のドラッグ中は`KeyboardShortcuts`の`isDragging`が真になり反転のキーも受理されない旨を追記。
    *   （監査指摘の確認）差分と照合し、3章の前文・3.・6.・7.・8.・9.・11.・12.・13.・14.・16.・18.・25.・28.・2章・4章の表は反映済みであることを確かめた。27.のほかの記述（基準点・大きさ・角度・取り消し1件・位置の欄との関係）は、Phase 11-03で`replaceShapesKeepingIds`が描き込む先の候補を今のままにするだけで変わらないため、上記の1行以外は反映不要。

### タスク12: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   (未実施)

## 5. 懸念事項・要確認ポイント
**計画での判断（REQに書かれていない細部）**
*   要件3の4.の「（キャンバスと一覧の両方）」のうち、**一覧の空いている所のクリック**は、今も選択を外さないため、今までどおり何も起きない（描き込む先も変わらない）とした。一覧で外せるのは`Ctrl`＋クリックで最後の1つを外す操作。
*   **いちばん下の行を切り取って貼り付けると最前面に入る**（下に残る行が無く、描き込む先が無しになるため。いちばん下に描いた図形を取り消して描き直すときも同じ）。REQの要件3の5.「下に残っている行が無ければ、無しになる」に従った。
*   描くツールで行を押して描き込む先が変わるのは、離したとき（クリック）。行のドラッグになったときは変わらない（行と一緒に動くだけ）。
*   選択（`V`）で何も選んでいないときの空の範囲選択も、描き込む先を無しにする。頂点の選択（`A`）の範囲選択は図形の選択を変えないため、描き込む先も変わらない。
*   `Ctrl`+`I`（選択の反転）・`Ctrl`+`A`で選択が空になっても、描き込む先は残る（REQの「選択を外す操作」の列挙に無いため）。`?dev`の「JSONから復元」では無しにする（図形一式の入れ替え）。
*   やり直しでは、図形の選択が戻らない限り描き込む先は動かない（描いた図形をやり直しても、その図形にはならない）。REQの要件3のとおり。
*   `A`（頂点の選択）で頂点を選んでいるときの`Esc`は、1回目で頂点の選択だけが外れ、2回目で図形の選択と描き込む先が外れる。
*   スポイトの待ち受け中の行のドラッグは、「ほかのツール」と同じく選択を変えない（待ち受けも続く）。`Alt`を押しながらの押下からは始まる（REQの除外に無い）。
*   選ばれていない行をドラッグして`Esc`で取りやめたとき、並びは変わらないが、`V`・`A`では始まった時点でその行が選ばれているため、選択はその行になったまま。
*   押しただけ（動かす前）の`Esc`も取りやめとし、その後に離してもクリックにならない（キャンバスの拡大縮小・回転の`Esc`と同じ）。
*   左右へ外れている間は自動スクロールもしない。「左右」は一覧の箱（スクロールバーを含む）の左端・右端。
*   ロック中になった・一覧を隠した・行の並びが変わったときも取りやめる。
*   ドラッグ中にカーソルがキャンバスの上へ出たときの、キャンバス側のホバーと引いている途中の線の先の追従は今までどおり（止めない）。ドラッグ中の`Space`はカーソルの形だけが変わる（パンは始まらない）。
*   フォルダを含む絵での並べ替えは、`reorderShapes`の今の動き（フォルダの位置と入れ子を保ち、図形だけを置き直す）のまま。

**REQの制約どうしの調整**
*   「既存のテストの値を変えない」と要件5・要件3が重なる3か所（`ClipboardController`の2つのテストの末尾に入る値、`resolveRowPressAction`の作成モード＝`none`、`EndpointSnapper`の`replaceShape`の引数）は、既定値・別の判定関数・選択集合での見分けで、どちらも満たす形にした（2章）。

**実装時・確認時の注意**
*   `#applyState`で書き込みを1か所にするとき、通知の回数・順（テストが確かめている）を変えないこと。
*   （タスク2）`#applyState`は`previousIds`を呼び出し時の`#items`から求めるため、`replaceAllShapes`のように受け取った図形インスタンスの`id`を先に書き換える経路で、前の並びと同じインスタンスが渡されると前のidが現在のidになる。実際の呼び出し（`SnapshotAdapter`は`deserialize`で新しいインスタンスを作る）では起きない。
*   （タスク2）`reorderShapes`は選択が1つ以上あれば、規則1により描き込む先が新しい並びでの選ばれている一番上へ動く（要件3の「選択があれば必ず選ばれている一番上」の帰結。RESの経路表の「変わらない」は選択が無い場合）。
*   （タスク2）`setSelectionByUser`は図形の選択を直接書くため、頂点の選択の`pruneSelectedVertices`を呼ぶ（`setSelection`と同じ）。
*   `.item-list`の子に行以外の要素を足さないこと（`render`・`getSelectedRowIds`・`getViewport`が子＝行を前提にしている）。
*   `DragTracker`の取りこぼしの保険では、ボタンが離れたことを次の`mousemove`で知り、その位置で離したものとして扱う。
*   （タスク3）`EndpointSnapper`の終え方のテストは、2点の線を終えるには点を1つ打って（`clickDrawnLine`）から`finishDrawnLine`を呼ぶ必要がある（始点だけだと何も残らない）。
*   `ItemListRowDrag`の`window`のcaptureの`mousedown`は、行のドラッグ中だけ止める（それ以外では何もしない）。
*   （タスク9）`ItemListRowDrag`・`ItemListWiring`はDOM・`requestAnimationFrame`を使うためテスト対象外（目視確認を推奨：ドラッグでの並べ替え・`Esc`での取りやめ・端での自動スクロール・複数選択のまとめ移動・描くツールでの行の押下）。`ItemListWiring.#handleRowClick`は`cancel`後に抑止されたclickがあれば何もせず終わる。
*   （タスク5）`ItemListWiring.sync`のスクロール対象は、選択が1つ以上なら選ばれている行、無ければ印の行。`#handleRowClick`の描くツールの枝では`#handleRowHover`を呼ばない（ツールが変わらずホバーが消えないため）。

*   （タスク7）`applyOrder`の「今と同じ並び」判定は`ShapeOrderEditor`内で`getShapes()`のidと比べる（`ListDragRules.isSameOrder`は`edit/`から使わない。`edit/`が`core/`の規則をimportしないため）。`resolveAutoScrollTop`は、帯の境目ちょうど（`y === top + band`）は帯の外（`null`）。`canStartRowDrag`の`hasModifier`は呼び出し側が`Ctrl`（`⌘`）・`Shift`から求める。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0. **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。**絵A**：矩形（`4`）・円（`5`）などを5つ以上、少しずつ重ねて描く。`V`で1つずつ選び、オプションバーの塗りのボタン（🪣）を入れて塗りの色を変え、色の違う塗った図形にする。**絵B（行の多い絵）**：📁で別の新しいキャンバスを作り、8個ほど描いて`Ctrl`+`A` → `Ctrl`+`D`を4回繰り返すと128個になる（`Ctrl`+`D`のたびに複製だけが選ばれるので、毎回`Ctrl`+`A`から行う）。行が一覧に収まらなければよい。
1. **並べ替え**：絵Aで`V`にし、一覧の行を押したまま上下へ動かす（少し動かすまでは始まらない）。動かしている行が薄くなり、入る場所が行と行の間（一番上・一番下を含む）の青い線で分かる。離すとキャンバスの重なりも変わる。`Ctrl`+`Z` 1回で戻り、`Ctrl`+`Y`でやり直せる。選択はそのまま。元と同じ場所で離したときは何も変わらず、取り消しの件数も増えない。押してすぐ離すと、今までどおり行が選ばれる。
2. **まとめて並べ替え**：`V`で`Ctrl`＋クリックで離れた行をいくつか選び、そのうちの1つを（`Ctrl`を離してから）ドラッグすると、順番を保ってひとかたまりで動く。選ばれていない行をドラッグすると、その行だけが選ばれ、その行だけが動く。`A`でも同じ。図形を描くツール・`H`でドラッグすると、ツールも選択も変わらず、その行だけが動く。`Ctrl`・`Shift`を押しながらのドラッグ、名前の編集中の行のドラッグは始まらない。
3. **取りやめ**：選ばれている行のドラッグの途中で`Esc`を押すと、線が消えて並びは変わらず、そのままボタンを離しても選択は変わらない（外れない）。一覧の左（キャンバスの側）・右（ウィンドウの外）へ外すと線が消え、そこで離しても何も変わらない。（選ばれていない行を`V`・`A`でドラッグしたときは、始まった時点でその行が選ばれる。）ドラッグの間に`Delete`・`Ctrl`+`Z`・`V`などを押しても何も起きない。
4. **長い一覧**：絵Bで、行を一覧の上端・下端の近くへ持っていくと、自動でスクロールして離れた場所へ動かせる（端に近いほど速い）。一覧より上・下へ外れてもスクロールが続き、離すと見えている一番上・一番下に入る。ドラッグ中にホイールで一覧をスクロールしても線の位置が合う。
5. **ボタンとキー**：オプションバー1行目の右にあった重なり順の4つのボタンがなくなり、ほかのボタンの並びと見た目はそのまま（2行目も）。`V`で図形を選び、`Home`（一番上へ）・`PageUp`（1つ上へ）・`PageDown`（1つ下へ）・`End`（一番下へ）を押すと、一覧の並びと重なりが変わる。`PageUp`・`PageDown`は押しっぱなしで続く。
6. **描き込む先**：`V`で途中の図形を選んでから`4`（矩形）に持ち替えると、その行に印（左端の青い縦線と薄い青の背景）が出る（行が見えていなければ、見えるまでスクロールする）。描くと、そのすぐ上の行に入り（キャンバスでもすぐ手前）、印が描いた図形に移る。続けて描くと、さらにその上に入る。`Ctrl`+`Z`で取り消すと印がすぐ下の行（元の図形）へ移り、描き直すと同じ場所に入る。直線・曲線のツールで続けて引いて終えた線も同じ（線を引いている途中の`Ctrl`+`Z`は、今までどおり最後の点を消す）。
7. **描くツールで行を押す**：図形を描くツールのまま行を押して離すと、印がその行に移り（一覧はスクロールしない）、次に描いた図形がその上に入る。ツール・選択は変わらない。直線のツールで線を引いている途中に押しても線は消えず、キャンバスへ戻って続きを打てる（終えた線は、押した行のすぐ上に入る）。`Ctrl`・`Shift`を押していても同じ。
8. **`V`に戻ったとき**：描いたあと`V`に戻っても印は残る（何も選ばれていない）。キャンバスの空いている所をクリックする、または`Esc`を押すと印が消え、次に描くと一番上に入る。図形を選んでいるときに空いている所をクリックする・`Esc`・空の範囲選択・`Ctrl`＋クリックで最後の1つを外す、でも同じ。（線を引いている途中の`Esc`は線を終えるだけ、スポイトの待ち受け中の`Esc`は待ち受けをやめるだけ、`A`で頂点を選んでいるときの`Esc`は1回目が頂点の選択だけ。図形を描くツール・`H`での`Esc`では印は消えない。一覧の空いている所を押しても変わらない。）
9. **貼り付け・複製・インポート**：`V`で途中の行を選んで`Ctrl`+`C` → `Ctrl`+`V`（右下へずれる）・`Ctrl`+`Shift`+`V`（同じ位置）をすると、選んでいた一番上の行のすぐ上に入る。離れた行をいくつか選んで`Ctrl`+`D`、または選んだ図形を`Alt`を押しながらドラッグすると、選んだ中の一番上の行のすぐ上に、順番のままひとかたまりで入る。📁のインポートも、印（または選ばれている一番上の行）のすぐ上に入る。途中の行を`Ctrl`+`X`で切り取って`Ctrl`+`V`で貼り付けると、元の場所に入る（いちばん下の行だけは、下に行が無いため一番上に入る）。どれも`Ctrl`+`Z` 1回で戻る。
10. **結合**：直線・曲線のツールで、既存の線の端点から描き足す・別の線の端点へつなげて終えると、元の線の位置のままで、その行に印が出る。`V`で線を選んで`J`で結合すると、結果の図形が選ばれ、描くツールに持ち替えるとその行に印が出る。
11. **切り替え**：📁でキャンバスを切り替える・新しく作る・開くと、印は消える（戻ってきても消えたまま）。ページを開き直しても、並べ替えた順番は残る（印は残らない）。
12. **ほかが今までどおり**：一覧での選択（クリック・`Ctrl`＋クリック・`Shift`＋クリック）・名前の変更（ダブルクリック）・サムネイル・カーソルを置いたときの見た目、描く・動かす・変形・頂点・角・色・整列・保存・書き出し・開くが今までどおり動く。何も選ばず印も無いときに描く・貼り付けると、今までどおり一番上に入る。
*   （タスク10）通しのテストの「選択が戻る取り消し」は、選択が変わる操作（`a`・`c`を選んで削除）で確かめた。描き込む先が選択の一番上と違う状態は、削除で下の行へ付け替わるときに作れる。結合は`PathJoiner`（選択が残る経路）で確かめ、選択が空で`select: false`の経路（`EndpointSnapper`）は`EndpointSnapper.insertTarget.test.js`が受け持つ。
*   （タスク11）`PROJECT_ARCHITECTURE.md`は1文が長い行が多いため、追記は該当する行の中の文を直す形にした（特に3章28.は「行のドラッグでの並べ替え」「ドラッグの始まりと取りやめ」「描き込む先の見せ方と変え方」「Phase 11-03のふるまいの注意」を新しい項として足した）。`ItemListRules`・`ListScrollRules`・`ItemListPanel`・`ItemListWiring`の関数名・メソッド名はRESとコードのexportの照合で書いたが、`ItemListPanel`・`ItemListWiring`の細部（`getInsertMarkId`・`onRowPress`・`isRowDragging`等）は実ブラウザでの確認と合わせて読み返すとよい。「確認の状況（Phase 11-03）」は**テストプレイ未実施**と書いてあり、発注者のテストプレイの後に書き直すこと。
