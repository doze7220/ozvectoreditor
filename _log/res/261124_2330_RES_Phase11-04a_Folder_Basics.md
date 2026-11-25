# RES: 作業計画・作業レポート (Phase 11-04a) : フォルダ（行の表示・折りたたみ・選択・まとめる/解除・削除・名前・キーの範囲）
* 参照元REQ: `./_log/req/261124_2310_REQ_Phase11-04a_Folder_Basics.md`

## 1. 作業目的
図形をフォルダにまとめ、一覧で入れ子の行として見せる。折りたたみ・フォルダを選ぶ・まとめる/解除・フォルダごとの削除・名前・フォルダの中での重なり順のキーを使えるようにする。

* 作業データの版は4のまま（フォルダの要素に、閉じているときだけ`collapsed: true`を1つ足す）。書き出したJSの`elements`・`bounds`は変えない。
* **変更しないファイル**：`shapes/`・`core/CanvasManager.js`・`core/ListDragRules.js`・`core/InsertTargetRules.js`・`core/SelectionRules.js`・`core/ListScrollRules.js`・`core/FocusKeyYieldRules.js`・`core/InputModes.js`・`wiring/ItemListRowDrag.js`・`edit/ShapeOrderRules.js`・`edit/ClipboardController.js`・`edit/ShapeInserter.js`・`edit/ItemRenameEditor.js`・`io/`の`DocumentSerializer`以外。
* **JSDocだけ直すファイル**：`core/HistoryManager.js`（typedef`Snapshot`の2項目）・`core/ItemTreeRules.js`（typedef`GroupItem`の1項目）。
* 計画時点の`node --test`は tests 2912 / pass 2912 / fail 0。
* **行末**：編集の前に`git ls-files --eol <パス>`の`w/`で実測し、保つこと（Git Bashの`grep`で`\r`を数えると誤る）。計画時の実測は、CRLF＝`js/core/`の`InputTracker`・`KeyboardShortcuts`、`js/edit/`の`SnapshotAdapter`・`CanvasLibrary`、`js/main.js`、`PROJECT_ARCHITECTURE.md`、`_doc/arch/`の01・02・03・06・08・13・14・15・16・54・55・56。LF＝`js/core/`の`HistoryManager`・`ItemAttributeRules`・`ItemListRules`・`ItemTreeRules`・`ListSelectionRules`・`VectorModel`、`js/edit/ShapeOrderEditor`、`js/palette/ItemListPanel`、`js/wiring/ItemListWiring`、`js/io/DocumentSerializer`、`index.html`、対象の既存のテスト、`_doc/arch/`の07・27・46・47・48・49・50・53。新しいファイルは`js/`・`test/`・`_doc/arch/`ともCRLF。本RESはLF。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **アイテムのid**：図形は`item.shape.id`、フォルダは`item.id`（合わせて一意）。求めるのは`GroupTreeRules.itemIdOf`。今回の新しいファイルと新しく書くコードは必ずこれを使い、種類で分ける同じ式を書かない（既存の`ItemAttributeRules.applyItemRename`・`VectorModel.replaceAllShapes`にある同じ式は、今回は変えない）。
*   **選んでいるフォルダ（の集合）**：`VectorModel`の`#selectedGroupIds`。**明示して選んだ**フォルダのidだけを持つ（中のフォルダは自動では入れない）。
*   **選んでいるまとまり（units）**：REQの用語のとおり。選んでいるフォルダ（別の選んでいるフォルダの中のものは除く）と、選んでいるフォルダの中に無い選ばれている図形。前順（描画順）のidの配列。互いに含み合わないので、前順で最後のものが一覧で一番上の行。
*   **行の並び**：上が前面。並びの後ろの要素から順に、フォルダなら「フォルダの行 → 中身の行（同じ規則）」。折りたたんだフォルダの中身は行にしない。

### モジュールの分担（全体）
| 置き場所 | 役割 |
| --- | --- |
| `core/GroupTreeRules.js`（新規） | 入れ子を動かす計算（まとめる・解除・除く・兄弟の並びごとの並べ替え・構造の比較）。`itemIdOf`・`hasGroupItem`。importは`ItemTreeRules`のみ |
| `core/GroupSelectionRules.js`（新規） | フォルダを選んでいる状態の規則（候補・不変条件・まとまり・開くべき図形）。importは`ItemTreeRules`・`GroupTreeRules`のみ |
| `core/GroupCollapseRules.js`（新規） | 折りたたみの規則（閉じる/開く・図形の上のフォルダを開く・取り除く・今の状態を引き継ぐ）。importは`ItemTreeRules`・`GroupTreeRules`（`itemIdOf`）のみ |
| `core/GroupCommandRules.js`（新規） | `Ctrl`+`G`等を受け付ける操作モード、作るボタンの動作の判定。importは`InputModes`のみ |
| `core/ItemRowRules.js`（新規） | 行の並び・字下げの量・行の見た目・スクロールの対象。`buildItemRows`を`ItemListRules`から移す。importは`ItemTreeRules`・`GroupTreeRules`（`itemIdOf`）のみ |
| `core/ItemListRules.js`（更新） | 行の並びを手放し、三角を押してよいか`canToggleGroup`と`canStartRowDrag`の`hasGroups`を足す |
| `core/ListSelectionRules.js`（更新） | フォルダの行を含む次の選択`resolveRowClickSelection` |
| `core/ItemAttributeRules.js`（更新） | `resolveItems`で`collapsed`を整える |
| `core/VectorModel.js`（更新） | フォルダを選んでいる状態の唯一の持ち主。`rearrangeItems`（入れ子を動かす唯一の公開操作）・`setGroupCollapsed`・`onCollapsedChange` |
| `core/InputTracker.js`（最小の更新） | 削除の受理、`Ctrl`の有無を`setSelectionByUser`へ渡す |
| `core/KeyboardShortcuts.js`（更新） | 対応表に2件（`group`・`ungroup`） |
| `edit/GroupEditor.js`（新規） | まとめる・解除・空のフォルダ・削除。どれも1件の編集操作（`beginEdit`／`commitEdit`を自分で挟む） |
| `edit/ShapeOrderEditor.js`（更新） | `apply`（キー）を、まとまりの単位・兄弟の並びごとにする。`applyOrder`は変えない |
| `edit/SnapshotAdapter.js`（更新） | スナップショットから折りたたみを外す、フォルダを選んでいる状態と折りたたみの記録・復元 |
| `edit/CanvasLibrary.js`（更新） | 履歴によらない保存の予約`requestSave()` |
| `io/DocumentSerializer.js`（更新） | `collapsed`の読み書き |
| `palette/ItemListPanel.js`・`index.html`（更新） | フォルダの行・三角・見た目・作るボタン |
| `wiring/ItemListWiring.js`（更新） | 上の規則の橋渡し |
| `main.js`（更新） | 生成と注入だけ |

依存の例外（`edit/ → core/`）に加わるのは、`GroupEditor`（`GroupTreeRules`・`GroupSelectionRules`・`GroupCommandRules`・`ItemTreeRules`）・`ShapeOrderEditor`（`GroupTreeRules`・`GroupSelectionRules`）・`SnapshotAdapter`（`GroupCollapseRules`）。どれも状態を持たない規則の関数。循環なし（`ItemTreeRules` ← `GroupTreeRules` ← `GroupSelectionRules`・`GroupCollapseRules`・`ItemRowRules`。この3つは互いにimportせず、`GroupTreeRules`は`ItemTreeRules`のほかをimportしない。`VectorModel`はこれらを使う側）。

### 要件1: フォルダの行
*   **`ItemRowRules.buildItemRows(items)`** → `ItemRow[]`（見えている行だけ。上から）。`ItemRow`＝`{ id, kind: 'shape'|'group', name（未定なら空文字）, depth, ancestorIds（外側から）, shape（フォルダはnull）, shapeIds（図形は[id]、フォルダは中の図形すべて）, groupIds（フォルダの中のフォルダすべて。図形は[]）, collapsed, isEmpty（`children`が空のフォルダ） }`。1回の再帰で作る（図形の数×深さ）。引数を書き換えない。
*   **`resolveRowIndent(depth)`**：1段12px、6段で頭打ち（72px）。名前の幅の見積もり＝240−枠1−スクロールバー約17−左右の余白16−サムネイル28−間8−字下げ72≒98px（図形）、フォルダは三角の分（16＋間4）を引いて約78px。どちらも名前が読める。7段目以降は同じ字下げになる。
*   **`resolveRowViews({ rows, isSelected, selectedGroupIds, insertMarkId })`** → 行ごとの`{ id, kind, name, indent, collapsed, canToggle（空でないフォルダ）, selected, selectedInGroup, insertTarget, hiddenMark }`。`selectedInGroup`＝上のフォルダのどれかが選ばれている（図形・フォルダとも。弱い見た目）。`selected`＝`selectedInGroup`でなく、図形なら`isSelected`、フォルダなら`selectedGroupIds`にある。
*   **`resolveRowHighlight(views)`** → `{ selectedIds, markId, indexes }`：`selectedIds`＝`selected`か`selectedInGroup`の行のid、`markId`＝`insertTarget`か`hiddenMark`の最初の行のid（無ければ`null`）、`indexes`＝スクロールの対象の添字（`selectedIds`の行。1つも無ければ`markId`の行）。既存の`hasHighlightChanged`・`resolveSelectionScrollTop`へ渡す。
*   **重さ**：同期は今までどおり1フレームに1回、行の組み立ては1回。パネルは変わった行だけDOMへ書く。フォルダの行のサムネイルは描かない。
*   **ホバー**：`resolveRowHover`の`queryExists`（図形だけを見る）がフォルダのidで偽になり、今の規則のまま`clear`になる（変更なし）。

### 要件2: 折りたたみ
*   **持ち方**：フォルダのアイテムの属性`collapsed`。**閉じているときだけ`collapsed: true`のキーを持つ**（開いているときはキー自体が無い。既存の作業データ・テストの形を変えないため）。整えるのは`ItemAttributeRules.resolveItems`：フォルダの`collapsed`が`true`以外ならキーを消す（写しに対して行う）。図形のアイテムには付けない。
*   **作業データ**：キー名`collapsed`。フォルダの要素のキー順は`type, id, name, visible, locked, (collapsed), children`。`DocumentSerializer.#itemToElement`は閉じているときだけ書き、`#readElements`は要素の値のまま持ち`resolveItems`に任せる。版1〜3のフォルダは今までどおり読み飛ばされる（`MIGRATIONS`は変えない）。`SpriteSerializer`の`source`は`serialize`の戻り値のため`collapsed`を含む（`elements`・`bounds`は変わらない）。
*   **変える操作**：`VectorModel.setGroupCollapsed(id, collapsed)`（変わらない・無いidなら`false`で通知なし。変われば`onChange`1回で`true`）。選択・描き込む先・作成途中の図形に触れない。履歴の記録はしない。
*   **自動で開く**（`VectorModel`の中。一覧の同期ではなく選択が変わった時点で行う。理由：一覧は選択集合の写しを持たない約束で、`requestAnimationFrame`の同期からは「一覧で押した」「取り消しで戻った」を区別できないため）：
    *   開く対象の図形は`GroupSelectionRules.resolveRevealIds({ previousIds, nextIds, previousGroupIds, nextGroupIds, additive })`：`additive`が真＝新しく選ばれた図形だけ。偽＝図形の選択かフォルダの選択が集合として変わったときだけ次の選択の全部、変わらなければ空。
    *   開く計算は`GroupCollapseRules.expandGroupsContaining(items, shapeIds, canExpand)`：`shapeIds`を含む閉じたフォルダ（上のすべて）のうち`canExpand(id)`が真のものを開く（変わらなければ同じ参照を返す）。`#applyState`が引数`revealIds`（既定は空）を受け、**変わる前の`#items`にあったフォルダだけ**を開く（インポートしたフォルダの折りたたみを保つため）。
    *   `revealIds`を渡すのは`setSelection`・`setSelectionByUser`（どちらも`keepsCollapsed`が偽のとき）・`replaceShape`（`select`が真）・`addShapesWithNewIds`（足した図形。必ず新しいidなので選択は変わっている）。前の3つが渡すのは**必ず`resolveRevealIds`の結果**（前後の図形の選択と、不変条件を通した前後のフォルダの選択を渡す。`replaceShape`は`additive: false`）で、選択が変わらなければ空。一覧の選択・取り消し/やり直しは`keepsCollapsed: true`で開かない。描き込む先だけの変化・並べ替え・まとめる/解除・削除、選択が変わらない差し替え（選んでいる開いたパス1本を`J`で同じidのまま閉じる等）では開かない。
*   **自動保存**：`VectorModel.onCollapsedChange(callback)`（折りたたみが`setGroupCollapsed`・自動で開くのどちらかで変わったとき、`onChange`の通知の後に1回。`replaceAllShapes`・`rearrangeItems`では呼ばない）。`main.js`が`model.onCollapsedChange(() => canvasLibrary.requestSave())`でつなぐ。`CanvasLibrary.requestSave()`は`#scheduleSave()`を呼ぶだけ（予約しない条件・保留・失敗の扱いは今までどおり）。
*   **取り消しの対象外**：`SnapshotAdapter.capture()`は`GroupCollapseRules.withoutCollapsed(model.getItems())`を`serialize`する（`document`に`collapsed`が出ないため、`HistoryManager`の比較・まとめの鍵の結果は折りたたみで変わらない。`HistoryManager`のコードは変えない）。別に`collapsedGroupIds`（閉じているフォルダのid）を持つ。
*   **今の状態を保つ判定**（`GroupCollapseRules.restoreCollapsed(items, currentItems, recordedIds)`の1か所）：`items`のフォルダごとに、`currentItems`に同じidのフォルダがあればその今の折りたたみ、無ければ`recordedIds`に含まれるか。`SnapshotAdapter.restore`が`replaceAllShapes`へ渡す前に通す。
*   **見えない行の印**：`ItemRowRules.resolveRowViews`が、閉じているフォルダの行（見えている行＝いちばん近い見えている上のフォルダ）について、その中の図形に選ばれているもの・描き込む先の印のid（`resolveInsertMarkId`の値）があるとき、または中のフォルダに選んでいるフォルダがあるときに`hiddenMark: true`にする。自分が選ばれていても出す。

### 要件3: フォルダを選ぶ（状態の持ち方）
*   **持ち主**：`VectorModel`の非公開`#selectedGroupIds`（`Set`）。代入はコンストラクタと`#applyState`だけ。公開の照会は`getSelectedGroupIds()`（前順の新しい配列）。保存・履歴の比較・書き出しに入らない。図形の選択集合`#selectedIds`・その読み手は変えない。
*   **不変条件**（`GroupSelectionRules.resolveSelectedGroupIds({ previousItems, items, selectedIds, candidateIds })`の1か所。`#applyState`が毎回通す。候補が空ならすぐ空を返し、入れ子を見ない）：候補のうち、(1)`items`に今あるフォルダで、(2)`items`での中の図形（入れ子の中も）がすべて`selectedIds`にあり、(3)`previousItems`でそのフォルダの中にあった図形もすべて`selectedIds`にある、ものだけを残す。中が空のフォルダは(2)(3)を満たす。(3)により、中の図形が削除・結合で消えたときも外れる。
*   **選び直した／足しただけの区別**（`GroupSelectionRules.resolveGroupCandidates({ currentIds, requestedIds, additive })`の1か所）：`requestedIds`が渡されていればそれ、無ければ`additive`が真なら今の値、偽なら空。集合の差では「中に図形が1つだけのフォルダを選んでいて、その図形をふつうにクリックした」を見分けられないため、呼び出し側の`Ctrl`を受ける。
*   **`setSelection(ids, { groupIds, keepsCollapsed = false } = {})`**：候補は`resolveGroupCandidates({ requestedIds: groupIds, additive: false, … })`＝省けば空（全選択・反転）。
*   **`setSelectionByUser(ids, { groupIds, additive = false, keepsCollapsed = false } = {})`**：候補は同じ関数。結果の図形の選択もフォルダの選択も空なら、描き込む先を無しにする。図形の選択が空でもフォルダの選択があれば（空のフォルダだけ）描き込む先は今の値のまま。何もせず`false`を返すのは、図形の選択・フォルダの選択が今も結果も空で、描き込む先も無いときだけ（空のフォルダだけを選んでいるときの`Esc`・空いている所のクリックで外れる）。
*   **`clearSelection()`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`（`select`が真で`keepId`が偽）**：候補は空（選び直し）。`addShape`・`commitDraft`・`deleteShapes`・`replaceShape`（`select`が偽、または`keepId`が真＝同じidのまま閉じる。`resolveGroupCandidates`へ`additive: !select || keepId`を渡す）・`replaceShapesKeepingIds`・`reorderShapes`・`renameItem`・`setInsertTarget`：候補は今の値（不変条件で落ちる）。図形1つのフォルダを選んで`J`で閉じても図形の選択は変わらないため、フォルダを選んでいる状態は残り、折りたたみも変わらない。`setMode`は`clearSelection()`を呼ぶため、ほかのモードでは必ず空。
*   **`InputTracker`**：`#applySelectionChange(change, additive)`の第2引数に、今の4つの呼び出しがそれぞれ規則へ渡している`Ctrl`の値（選択モードのクリック・範囲選択＝`hasCtrlModifier(event)`、頂点の選択のクリック＝`true`／`false`）を渡し、`model.setSelectionByUser(ids, { additive })`へ流すだけ。`Esc`は引数なし（選び直し）。
*   **一覧のクリック**（`ListSelectionRules.resolveRowClickSelection({ rows, selectedIds, selectedGroupIds, hitId, additive, range, anchorId })` → `{ ids, groupIds, anchorId }`）：行ごとの「選ばれている」を、図形の行＝`selectedIds`にある、フォルダの行＝自分か上のフォルダが`selectedGroupIds`にある、とし、そのidの並びで既存の`resolveListClickSelection`を呼んで次の行のidと起点を得る（起点・範囲の規則を二重に書かない）。
    *   ふつう・`Shift`：結果の行の`shapeIds`の和（重複なし）を`ids`、結果の行のうちフォルダを`groupIds`にする。
    *   `Ctrl`で足すとき：今の`selectedIds`＋押した行の`shapeIds`、今の`selectedGroupIds`＋（フォルダなら）そのid。
    *   `Ctrl`で外すとき：今の`selectedIds`−押した行の`shapeIds`、`selectedGroupIds`−（押したid・その中のフォルダ`groupIds`・上のフォルダ`ancestorIds`）。ほかの図形は選ばれたまま。
    *   `selectedIds`は、折りたたまれて行の無い図形も含めた今の選択の全体（`model.getSelectedIds()`）。`hitId`の行が無ければ今の選択と起点をそのまま返す（防御）。
*   **一覧から渡す**：`model.setSelectionByUser(ids, { groupIds, keepsCollapsed: true })`。キャンバス移動・スポイトのときは今の`switchAndSelect`のまま（`V`へ切り替えてからふつうのクリック）。図形を描くツールでは、今の経路（`canSetInsertTargetByRow` → `model.setInsertTarget(フォルダのid)`）が`false`で何も起きない。
*   **取り消し/やり直し**：`Snapshot`に`selectedGroupIds`を足し、`restore`で`model.setSelection(selectedIds, { groupIds, keepsCollapsed: true })`（無いフォルダは不変条件で落ちる）。`shouldRestoreSelection()`が偽なら戻さない。

### 要件4: まとめる・解除／要件5: 削除
*   **`VectorModel.rearrangeItems(nextItems, { selectedIds, selectedGroupIds, selectsNewGroups = false } = {})`** → `boolean`（入れ子を動かす唯一の公開操作。まとめる・解除・フォルダの削除・フォルダの中での並べ替え・空のフォルダの追加・後の作業の行のドラッグが使う）：
    1. 検証：図形はすべて今持っているインスタンスで重複なし、フォルダは`id`が`null`か`undefined`（＝新しいフォルダ）か、今あるフォルダのidで重複なし。外れたら`console.warn`して何も変えず`false`。
    2. 今と構造が同じ（`GroupTreeRules.isSameTree`）なら何も変えず通知もせず`false`。
    3. `resolveItems(nextItems)`（新しいフォルダの名前「フォルダ n」はここで決まる。全体を渡すので今の番号の規則のまま）。
    4. 新しいフォルダに`#issueId(GROUP_ID_PREFIX)`。
    5. `#applyState`：図形の選択＝`selectedIds`（省けば今の値）のうち残った図形、フォルダの候補＝`selectedGroupIds`（省けば今の値）＋`selectsNewGroups`が真なら新しいフォルダ。消えた図形のホバーを消し、頂点の選択を落とし、通知1回で`true`。作成途中の図形・選択矩形・吸い付きの表示の点に触れない。
*   **`GroupTreeRules`の計算**（引数を書き換えない。図形は`id`だけ読む）：`wrapUnits(items, unitIds, group)`（まとまりをすべて抜き、前順で最後のまとまりの位置に、`group`の`children`へまとまりを前順に入れて置く）・`unwrapGroups(items, groupIds)`（フォルダを`children`に置き換える。中のフォルダはそのまま）・`removeItems(items, ids)`（フォルダは中身ごと）・`listSiblingLists(items)`（いちばん外側と各フォルダの`children`）・`mapSiblingLists(items, fn)`（それぞれの並びを`fn`の結果にした新しい入れ子）・`isSameTree(a, b)`・`hasGroupItem(items)`。空のフォルダの追加は既存の`ItemTreeRules.insertItemsAbove`（描き込む先が無ければ末尾）。
*   **`edit/GroupEditor`**（`{ model, editRecorder, getMode }`）。まとまりは毎回`resolveSelectedUnitIds`で求める：
    *   `groupSelection()`：`canEditGroups(getMode())`が偽・まとまりが無いなら`beginEdit`も呼ばず`false`。それ以外は`beginEdit` → `rearrangeItems(wrapUnits(items, unitIds, idと名前の無いフォルダのアイテム), { selectedGroupIds: [], selectsNewGroups: true })` → `commitEdit`。図形の選択は今のまま（まとまりの中の図形と一致する）。
    *   `ungroupSelection()`：`canEditGroups`が偽・まとまりの中のフォルダが無いなら`false`。`beginEdit` → `rearrangeItems(unwrapGroups(items, まとまりのフォルダ), { selectedGroupIds: 解除したフォルダの直下のフォルダ })` → `commitEdit`。図形の選択は今のまま（解除したフォルダの中の図形と、一緒に選んでいた図形が選ばれている）。
    *   `addEmptyGroup({ selects })`：`selects`が真なら`{ selectedIds: [], selectedGroupIds: [], selectsNewGroups: true }`、偽なら選択に触れない。位置は`model.getInsertTargetId()`の図形のすぐ上（無ければいちばん外側の末尾）。操作モードは見ない（呼び出し側が判定の結果で呼ぶ）。
    *   `removeSelection()`：まとまりが無いなら`beginEdit`も呼ばず`false`。それ以外は`beginEdit` → `rearrangeItems(removeItems(items, unitIds), { selectedIds: [], selectedGroupIds: [] })` → `commitEdit`（削除の履歴の記録はここだけ）。描き込む先は今の規則で下の行へ付け替わる。操作モード・ドラッグ中かは見ない（受理の判定は`InputTracker.deleteSelection()`の1か所）。
    *   `hasSelectedUnits()`。
*   **削除の経路**：`InputTracker.deleteSelection()`の受理条件のうち「選択集合が空でない」を「図形の選択かフォルダの選択が1つ以上」にし（ほかの条件は変えない）、受理したら注入された補助`InputAssist.deleteSelectedItems()`（実体は`groupEditor.removeSelection()`。既定は何もしない）を呼んで`true`を返すだけにする（`beginEdit`／`commitEdit`・`deleteShapes`は呼ばない。記録は`GroupEditor`が挟む）。ツールバーの削除のボタンは、どちらの選択も空のときだけ押せない。切り取りは、空のフォルダだけのときは写すものが無いため今までどおり何もしない。
*   **キー**：対応表に`{ codes: ['KeyG'], ctrl: true, shift: FORBIDDEN, repeatable: false, action: 'group' }`と、`shift: REQUIRED`・`action: 'ungroup'`の2件。`KeyG`は今の対応表に無い（計画時に確認）。`main.js`の注入は`performGroupCommand(run)`（キャンバスのドラッグ中は実行しない。`performSegmentKindSwitch`と同じ形）を呼んだ後、**常に`true`**を返す（ブラウザの動作を起こさない）。キーリピート・ドラッグ中は、`ctrl: true`の既存の例外で`preventDefault()`だけされる。
*   **作るボタン**：`GroupCommandRules.resolveFolderButtonAction({ mode, hasUnits, isDragging, isRowDragging, isLocked })`＝ロック中・ドラッグ中・行のドラッグ中は`none`、選択（`V`）でまとまりがあれば`group`、選択・頂点の選択なら`addAndSelect`、それ以外は`add`。判定の結果で`ItemListWiring`が`groupEditor`を呼ぶ。ボタンは押した直後に`blur()`する（`CanvasPalette`のボタンと同じ扱い。`Enter`で再び押されない）。

### 要件6: 名前
*   フォルダの行の名前の`<span>`のダブルクリックは今の経路のまま（`ItemRenameEditor`はフォルダのidを扱える）。三角・アイコンは`.item-row-name`の外なので編集に入らない。

### 要件7: 重なり順のキー
*   `ShapeOrderEditor.apply(operation)`：`model.getItems()`から`listSiblingLists`を作り、まとまりを「選択中」とした`canReorderSelected`がどの並びでも偽なら何も呼ばず`false`（未知の操作の`Error`は`beginEdit`より前）。1つでも真なら`beginEdit` → `model.rearrangeItems(mapSiblingLists(items, (list) => reorderSelected(list, isUnit, operation)))` → `commitEdit`。フォルダは並びの1要素で、選んでいるフォルダの中の並びには「選択中」が無いため動かない。フォルダの無い絵では並びが1つで、結果は今と同じ。
*   `applyOrder`（行のドラッグ）は`model.reorderShapes`のまま。

### 要件8: 今回手を付けない操作
*   `canStartRowDrag({ …, hasGroups })`：`hasGroups`が真なら偽（省けば今までどおり）。複製・コピー・貼り付け・`Alt`＋ドラッグ・描き込む先は変えない（足した図形だけが選ばれるため、フォルダを選んでいる状態は外れる）。

### 要件9: 既存のテストで直すもの（これ以外の既存の件は1件も変えない）
| ファイル | 直す内容 | 理由 |
| --- | --- | --- |
| `test/core/ItemListRules.test.js`の`describe('buildItemRows')`7件 | `test/core/ItemRowRules.test.js`へ移す。値が変わるのは3件：「フォルダは行にならず…」→フォルダの行を含む並び、「空のフォルダだけなら空」→行1つ、「図形のインスタンスは同じで…」→フォルダの行の分だけ添字がずれる。ほか4件は値を変えない | 要件1（フォルダが行になる）と、関数の置き場所の移動 |
| `test/edit/ShapeOrderEditor.items.test.js`の5件すべて | 期待する並び・入れ子を、フォルダの中だけで動く結果に直す（`skeleton`の不変の確認は、フォルダの位置が並びの中で動き得るため、入れ子の期待値の比較に替える）。記録が1件・取り消し/やり直しのJSONの一致・名前等が図形について動くことの確認は残す | 要件7（フォルダのある並びでの重なり順のキー） |
| `test/edit/ShapeOrderEditor.test.js`の「偽の依存」の`apply`5件が使う`setupFake`と、その記録の名前 | 偽のmodelに`getItems`・`getSelectedGroupIds`・`rearrangeItems`を足し、`apply`の記録の名前を`rearrangeItems`（値はidの並び）に替える。**期待する並び・呼び出し順・戻り値は変えない**。`applyOrder`と「実物」の件は変えない | `apply`の渡し先が、フォルダを1要素として動かせる`rearrangeItems`になるため |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`・`./js/edit/`・`./js/io/`・`./js/palette/`・`./js/wiring/`・`./js/main.js`・`./index.html`・`./test/`
*   **新しい論理クラス・規則**: `core/GroupTreeRules`・`core/GroupSelectionRules`・`core/GroupCollapseRules`・`core/GroupCommandRules`・`core/ItemRowRules`・`edit/GroupEditor`
*   **関連する論理クラス**: `VectorModel`・`InputTracker`・`KeyboardShortcuts`・`HistoryManager`・`ItemTreeRules`・`ItemAttributeRules`・`ItemListRules`・`ListSelectionRules`・`ListScrollRules`・`InsertTargetRules`・`SnapshotAdapter`・`CanvasLibrary`・`ShapeOrderEditor`・`DocumentSerializer`・`ItemListPanel`・`ItemListWiring`・`ItemListRowDrag`

### 参照する責務
*   **フォルダの規則**：`core/`の規則は状態なし・DOMなしの関数で、`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`palette/`は何もimportせず、図形・`VectorModel`・`InputTracker`・`HistoryManager`を知らない（表示とコールバックの通知だけ）。`wiring/`は購読・生成・注入・橋渡しで判定・計算を持たない（`main.js`だけが使う）。`edit/`は1件の編集操作の手順で、`VectorModel`・記録先は注入で受け、操作モードは解釈せず規則へ渡す。`main.js`は生成・注入だけ。
*   **`VectorModel`**：アイテムの入れ子・選択集合・描き込む先等のSSOT。`#items`・`#selectedIds`・`#insertTargetId`へ代入するのはコンストラクタと`#applyState`だけ（通知はしない）。状態を変えるAPIは変更後に`onChange`へ通知する（回数は契約でテストが確かめている）。入れ子の計算は`ItemTreeRules`等の規則、名前等は`ItemAttributeRules`へ委ねる。図形種別・図形固有のプロパティ名を知らない。履歴の記録は呼び出し側。
*   **選択の不変条件**：選択集合は現存する図形のidだけを含み、選択・頂点の選択以外のモードでは空。`setMode`は無条件に`clearSelection()`を呼ぶ。描き込む先は、選択が1つ以上なら選ばれている一番上の図形（`InsertTargetRules`。変えない）。
*   **`ItemTreeRules`**：入れ子の計算。importなし。`kind`のほかは図形のプロパティを読まない（だから`id`を読む計算は`GroupTreeRules`に置く）。`toItems`・`listItems`・`listShapeItems`・`listShapes`・`insertItemsAbove`・`ITEM_KIND`。
*   **`ItemAttributeRules.resolveItems`**：毎回新しいアイテムを返し、2回通しても値が変わらない。名前・表示・ロックの補いの1か所。
*   **`HistoryManager`**：`beginEdit`／`commitEdit`で挟み、前後の`document`の`JSON.stringify`が同じなら記録しない。作業データの中身を解釈しない。`EditRecorder`として注入される。
*   **`SnapshotAdapter`**：スナップショットの取得（`capture`）と適用（`restore`。`deserialize`の失敗・読み飛ばし1件以上なら適用しない）。操作モードを知らない。
*   **`CanvasLibrary`**：自動保存の予約は`#scheduleSave()`（開いているキャンバスが無い・`#isSwitching`・`'unavailable'`では予約しない）。保存は`serialize(model.getItems())`。
*   **`InputTracker`**：入力の解釈。次の選択は`SelectionRules`へ渡し、`#applySelectionChange`は受け渡しだけ。削除の受理は`deleteSelection()`の1か所（削除ボタン・`Delete`・切り取りの唯一の経路）。補助は`InputAssist`（項目ごとに、関数でなければ既定へ置き換える）。今回は状態・規則を足さない。
*   **`KeyboardShortcuts`**：対応表と受理判定だけ。`ctrl: true`のエントリは、ドラッグ中・キーリピートで実行しないときも`preventDefault()`する。コンストラクタは対応表の全action名が関数でないと`Error`（対応表と`main.js`の注入は同じタスクで足す）。
*   **`ItemListPanel`**：行の要素はidごとに持ち回り、変わった分だけ書く。名前の編集の出口は`#finishNameEdit`の1つ。編集中の行の要素をDOMの中で動かさない。`.item-list`の子に行以外の要素を足さない。`mousedown`を`preventDefault()`しない。
*   **`ItemListWiring`**：`model.onChange`を1フレームに1回の`sync`へまとめる。一覧で押した選択の直後に`sync({ allowScroll: false })`を呼ぶ（一覧での選択ではスクロールしない）。選択集合の写しを持たない。
*   **`ItemListRowDrag`**：行のドラッグの進行。始まった時点の行の並びと変われば取りやめる（変えない）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   1章：構成図（新しい6ファイルと新しいテスト、`ItemListRules`・`ListSelectionRules`・`index.html`・`ItemListPanel`・`ItemListWiring`・`ShapeOrderEditor`の一言）、フォルダ分割の方針（`core/`の規則・`edit/`の手順）、依存方向の`edit/ → core/`の例外の列挙（`GroupEditor`・`ShapeOrderEditor`・`SnapshotAdapter`）と`core/`の規則どうしのimport（`GroupSelectionRules`・`GroupCollapseRules`・`ItemRowRules`が`GroupTreeRules`を使う）、「存在しないもの」（グループ化・フォルダの項＝今回入ったものを除き、REQの「今回やらないこと」を足す）。
*   2章：「アイテム」（`collapsed`・フォルダを作る操作・`rearrangeItems`・自動で開く）、作業データ形式（`collapsed`。版4のまま）、選択状態（フォルダを選んでいる状態とその不変条件・`setSelection`/`setSelectionByUser`の引数・描き込む先の例外）、保存しないものの列挙（フォルダを選んでいる状態）、スナップショット。
*   3章：3.（キーボード・`InputAssist.deleteSelectedItems`（削除の記録は`InputTracker`でなく`GroupEditor`が挟む）・選び直し/足すの区別）・5.・6.（スナップショットの2項目・記録する操作・記録しない操作＝折りたたみ）・7.（切り取り・複製）・8.（折りたたみの自動保存）・9.（インポートで保たれる折りたたみ）・11.（フォルダをまたぐ結合・同じidのまま閉じるときの折りたたみとフォルダの選択）・14.（まとまり・兄弟の並び）・16.・18.・28.（フォルダの行・折りたたみ・選択・作るボタン・行のドラッグの条件・確認の状況）、キーの割り当て（`Ctrl`+`G`・`Ctrl`+`Shift`+`G`）。
*   4章の一覧と`_doc/arch/`：01・02（行数）・03・06（行数）・07・08・13・14・15・16・46・47・48・49・53・56（始める条件）、新規57〜61（`GroupTreeRules`・`GroupSelectionRules`・`GroupCollapseRules`・`GroupCommandRules`・`ItemRowRules`）。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・引数・戻り値・typedef、意味が変わった既存のJSDoc）が無いことを確認する。(b) `node --test`が全件合格することを確認する。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』へ追記する。(e) 行末を保つ。

*   [x] タスク1: 入れ子を動かす計算の規則
    *   **対象ファイル** :
        *   `./js/core/GroupTreeRules.js` :（新規）
        *   `./test/core/GroupTreeRules.test.js` :（新規）
    *   **作業内容** :
        *   「要件4」の`GroupTreeRules`の計算と`itemIdOf`・`hasGroupItem`をJSDoc付きで作る。責務は「図形とフォルダのアイテムの入れ子を、まとめる・解除する・除く・並びごとに置き換える計算と、アイテムのidの照会」。図形は`id`だけを読む。`unitIds`・`groupIds`・`ids`は`Set`で受ける。`mapSiblingLists`の`fn`はいちばん外側 → 各フォルダの順に、空の並びでも1回呼ぶ。
        *   テスト：まとめる（隣り合う・離れた・別々のフォルダ・入れ子のフォルダごと・図形1つだけ・フォルダ1つだけ・空のフォルダ・一番上のまとまりがフォルダの中＝そのフォルダの中にできる・元のフォルダが空になっても残る・中の順番）、解除（1段・入れ子は中のフォルダを残す・空・複数・別々のフォルダの中）、除く（図形・フォルダごと・空・混ざり・図形だけ除いたフォルダは残る）、並びの列挙と置き換え（入れ子・空のフォルダ）、`isSameTree`（順・入れ子・id違い）、引数を書き換えない。

*   [x] タスク2: フォルダを選んでいる状態の規則
    *   **対象ファイル** :
        *   `./js/core/GroupSelectionRules.js` :（新規）
        *   `./test/core/GroupSelectionRules.test.js` :（新規）
    *   **作業内容** :
        *   `resolveGroupCandidates`・`resolveSelectedGroupIds`・`resolveSelectedUnitIds({ items, isSelected, selectedGroupIds })`（前順のid。選んでいるフォルダに当たったら中へは進まない）・`resolveRevealIds`をJSDoc付きで作る。`resolveSelectedGroupIds`は候補が空なら入れ子を見ずに空の`Set`を返す。
        *   テスト：候補（指定あり・足すだけ・選び直し）、不変条件（全部選ばれている・1つ外れた・空のフォルダ・無いフォルダ・入れ子の中の図形・前に中にあった図形が消えた・空になった）、まとまり（図形だけ・フォルダ・入れ子のフォルダも選んでいる・フォルダと外の図形・フォルダの中の一部だけ・空のフォルダだけ・何も無い）、開く図形（足す・置き換え・変わらない・フォルダの選択だけが変わった）。

*   [x] タスク3: 折りたたみの属性と作業データ
    *   **対象ファイル** :
        *   `./js/core/GroupCollapseRules.js` :（新規）
        *   `./js/core/ItemTreeRules.js` :（更新。typedef`GroupItem`に`[collapsed]`を足すだけ。コードは変えない）
        *   `./js/core/ItemAttributeRules.js` :（更新）
        *   `./js/io/DocumentSerializer.js` :（更新。折りたたみの項目とJSDocだけ）
        *   `./test/core/GroupCollapseRules.test.js` :（新規）
        *   `./test/core/ItemAttributeRules.test.js` :（追加のみ）
        *   `./test/io/DocumentSerializer.collapsed.test.js` :（新規）
    *   **作業内容** :
        *   `GroupCollapseRules`：`setCollapsed(items, id, collapsed)`（変わらない・無いなら同じ参照）・`expandGroupsContaining`・`withoutCollapsed(items)`・`listCollapsedIds(items)`・`restoreCollapsed`をJSDoc付きで作る。閉じているときだけ`collapsed: true`のキーを持ち、開くときはキーを消した新しいオブジェクトにする。アイテムのidは`GroupTreeRules.itemIdOf`で求める（種類で分ける同じ式を書かない）。図形は`id`だけ読む。
        *   `resolveItems`でフォルダの`collapsed`を整える（責務のJSDocに折りたたみを足す）。`DocumentSerializer`の書き・読み（typedef`DocumentData`のJSDocも）。版の定数・`MIGRATIONS`は変えない。
        *   テスト：規則の各関数（入れ子の上のフォルダがすべて開く・`canExpand`が偽なら開かない・今あるフォルダは今の状態/消えていたフォルダは記録の状態・引数を書き換えない）、作業データ（閉じているときだけキーがある・開いている絵のJSONは今と同じ・キー順・往復・キーが無い/文字列/`1`/`null`/`false`は開いている・図形の要素の`collapsed`は無視・版1〜3・`version`が4のまま・文字列層・スプライトの`elements`・`bounds`が折りたたみで変わらない）。

*   [x] タスク4: VectorModelがフォルダを選んでいる状態と折りたたみを持つ
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./test/core/VectorModel.groupSelection.test.js` :（新規）
        *   `./test/core/VectorModel.collapse.test.js` :（新規）
    *   **作業内容** :
        *   「要件3」「要件2」のとおり、`#selectedGroupIds`・`getSelectedGroupIds()`・`setSelection`/`setSelectionByUser`の引数・`clearSelection`等の候補・`#applyState`の引数（`selectedGroupIds`・`revealIds`）・`setGroupCollapsed`・`onCollapsedChange`を足す。`onCollapsedChange`は、`#applyState`で折りたたみが変わったことを覚え、`#notifyChange`の最後に1回だけ呼んで消す。既存の通知の回数を変えない。責務のJSDocに2つの状態を足す。
        *   テスト：要件3の外れる/残るすべての場合（選び直し・別の指定・足すだけ・中の図形が外れた・中に図形1つのフォルダ・全選択相当・反転相当・`clearSelection`・移動/スタイル/名前/並び/同じidの差し替え/同じidのまま閉じる結合では残る・削除/新しいidになる結合/追加/`replaceAllShapes`では外れる・同じidのまま閉じる結合でもほかの図形が選択から外れればそのフォルダは外れる・図形と食い違う指定は受け付けない）、空のフォルダだけ（図形の選択は空・描き込む先はそのまま・外すと描き込む先も無し・`false`を返す条件）、頂点の選択との関係、通知の回数。折りたたみ：変える/変わらない/無いid、自動で開く（置き換え・足す・変わらない選択では閉じたまま・フォルダの選択だけが変わったとき・多段・`keepsCollapsed`・貼り付け・新しいidになる結合（開く）・選んだまま折りたたんだ後の、同じidのまま閉じる結合（`replaceShape`の`keepId: true`・`removeIds: []`）では、図形だけを選んでいるときも図形1つのフォルダを選んでいるときも開かず`onCollapsedChange`も呼ばない・インポートしたフォルダは閉じたまま・描き込む先だけの変化や作図では開かない）、`onCollapsedChange`の回数。

*   [x] タスク5: 入れ子を動かす公開操作
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./test/core/VectorModel.rearrangeItems.test.js` :（新規）
    *   **作業内容** :
        *   「要件4」の`rearrangeItems`をJSDoc付きで足す。`deleteShapes`のJSDocに、フォルダごとの削除は`rearrangeItems`で行う旨を足す（コードは変えない）。
        *   テスト：まとめる・解除・除く・並べ替え・空のフォルダの結果と選択・フォルダの選択・描き込む先・頂点の選択・ホバー、新しいフォルダのidと名前（番号の規則）、同じ構造なら通知なし`false`、不正（知らない図形・重複・知らないフォルダのid）は警告して不変、作成途中の図形に触れない、通知1回、引数を書き換えない、折りたたみが保たれ`onCollapsedChange`を呼ばない。

*   [x] タスク6: 取り消し/やり直し
    *   **対象ファイル** :
        *   `./js/edit/SnapshotAdapter.js` :（更新）
        *   `./js/core/HistoryManager.js` :（更新。typedef`Snapshot`のJSDocに`selectedGroupIds`・`collapsedGroupIds`を足すだけ。コードは変えない）
        *   `./test/edit/SnapshotAdapter.groups.test.js` :（新規）
    *   **作業内容** :
        *   「要件2」「要件3」の取り消しの設計のとおり`capture`・`restore`を変える（2項目が無いスナップショットは空として扱う）。`SnapshotAdapter`のtypedefと依存の制約のJSDocも直す。通知の回数は変えない。
        *   テスト：折りたたみだけの変化は記録されない・まとめの鍵の畳みと往復の結果が変わらない・編集の間や後に折りたたみを変えても今の状態が保たれる・取り消しで戻ったフォルダは記録時の状態・フォルダを選んでいる状態が戻る（まだあるフォルダだけ・`shouldRestoreSelection`が偽なら戻らない）・復元で閉じたフォルダが開かない。

*   [x] タスク7: 折りたたみの自動保存
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js` :（更新）
        *   `./test/edit/CanvasLibrary.collapse.test.js` :（新規）
    *   **作業内容** :
        *   `requestSave()`をJSDoc付きで足し、クラスJSDocの「契機は`historyManager.onChange`のみ」を直す。
        *   テスト（`CanvasLibrary.items.test.js`と同じ偽の保存先）：`model.onCollapsedChange(() => library.requestSave())`をつなぎ、`setGroupCollapsed`・自動で開くの後の`flushPendingSave()`で記録に`collapsed`が出る/消える、履歴は増えない、キャンバスを切り替えて戻ると保たれる、開く（ファイル）で保たれる、切り替えだけでは折りたたみの通知が起きない、読み込み完了前の`requestSave()`は何もしない。

*   [x] タスク8: まとめる・解除・空のフォルダ・削除の編集操作
    *   **対象ファイル** :
        *   `./js/core/GroupCommandRules.js` :（新規）
        *   `./js/edit/GroupEditor.js` :（新規）
        *   `./test/core/GroupCommandRules.test.js` :（新規）
        *   `./test/edit/GroupEditor.test.js` :（新規）
    *   **作業内容** :
        *   `canEditGroups(mode)`・`FOLDER_BUTTON_ACTION`（凍結）・`resolveFolderButtonAction`と、「要件4」の`GroupEditor`をJSDoc付きで作る。
        *   テスト：規則の表（操作モード・まとまり・ドラッグ・ロックの組み合わせ）、偽の記録先での呼び出し順（まとめる・解除・空のフォルダ・削除のそれぞれで`beginEdit` → `rearrangeItems` → `commitEdit`が1回ずつ。何もしないとき（まとまりの無い削除を含む）は`beginEdit`も呼ばない）、実物（`VectorModel`・`SnapshotAdapter`・`HistoryManager`）でのまとめる/解除/空のフォルダ/削除の結果・選択・名前・記録1件・取り消し/やり直しのJSONの一致とフォルダを選んでいる状態、頂点の選択モードではまとめる・解除を受け付けない、図形だけの選択の解除は何もしない。

*   [ ] タスク9: 重なり順のキーの範囲
    *   **対象ファイル** :
        *   `./js/edit/ShapeOrderEditor.js` :（更新。`apply`と依存の制約のJSDoc）
        *   `./test/edit/ShapeOrderEditor.test.js` :（更新。要件9の表の範囲だけ）
        *   `./test/edit/ShapeOrderEditor.items.test.js` :（更新。要件9の表の範囲だけ）
        *   `./test/edit/ShapeOrderEditor.groups.test.js` :（新規）
    *   **作業内容** :
        *   「要件7」のとおり`apply`を変える。`applyOrder`のふるまいは変えない。JSDocを今の動きに直す。
        *   新しいテスト：入れ子の中だけで動く・フォルダごと動く・隣のフォルダの中へ入らない・またがった選択・端・空のフォルダ・全部選択・記録1件・何も変わらなければ記録しない・フォルダの無い絵で今と同じ。

*   [ ] タスク10: 削除の受理と、選び直し/足すの区別
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `InputTracker`：`InputAssist.deleteSelectedItems`（typedef・`NO_INPUT_ASSIST`・コンストラクタの写し・JSDoc）、`deleteSelection`の受理条件と、受理した後の処理（`beginEdit` → `deleteShapes` → `commitEdit`を、補助`deleteSelectedItems()`を呼ぶだけに替える。記録は補助の実体が行う旨をJSDocに書く）、`#applySelectionChange(change, additive)`と4つの呼び出し。関係するJSDocを直す。それ以外のコードは変えない。
        *   `main.js`：`GroupEditor`の生成（`shapeOrderEditor`の近く）、`inputTracker`への注入`deleteSelectedItems`（実体は`groupEditor.removeSelection()`。`clipboardController`と同じ前方参照）、`syncDeleteButtonState`の条件、`model.onCollapsedChange(() => canvasLibrary.requestSave())`（`canvasLibrary`の生成の後）。判定・計算を書かない。

*   [ ] タスク11: `Ctrl`+`G`・`Ctrl`+`Shift`+`G`
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` :（更新）
        *   `./js/main.js` :（更新）
        *   `./test/core/KeyboardShortcuts.group.test.js` :（新規。`KeyboardShortcuts.keydown.test.js`と同じ仮の`document`の置き方・戻し方）
    *   **作業内容** :
        *   対応表の2件・typedef`ShortcutActions`（`group`・`ungroup`。常に`true`）・対応表のJSDoc（`ShiftRule`・`KeyG`の項・`preventDefault()`の例外の列挙）を足す。`main.js`に`performGroupCommand`と2つの注入を足す。
        *   テスト：`Ctrl`+`G`／`⌘`+`G`／`Ctrl`+`Shift`+`G`がそれぞれ1つだけ呼ばれ`preventDefault`される、`G`単体・`Shift`+`G`・`Alt`付きは一致しない、キーリピート・ドラッグ中は呼ばれず`preventDefault`される、文字の入力欄にフォーカスがあるときは何もしない。

*   [ ] タスク12: 行の並びの規則と、一覧の判定
    *   **対象ファイル** :
        *   `./js/core/ItemRowRules.js` :（新規）
        *   `./js/core/ItemListRules.js` :（更新。`canToggleGroup({ isDragging, isLocked })`と`canStartRowDrag`の`hasGroups`を足すだけ。`buildItemRows`はタスク14で移すため、ここでは残す）
        *   `./js/core/ListSelectionRules.js` :（更新。`resolveRowClickSelection`を足し責務のJSDocを直す。既存の関数は変えない）
        *   `./test/core/ItemRowRules.test.js` :（新規）
        *   `./test/core/ItemListRules.test.js` :（追加のみ）
        *   `./test/core/ListSelectionRules.test.js` :（追加のみ）
    *   **作業内容** :
        *   「要件1」「要件2」「要件3」「要件8」の規則をJSDoc付きで作る。`ItemRowRules`の行のidは`GroupTreeRules.itemIdOf`で求める（種類で分ける同じ式を書かない）。
        *   テスト：行の並び（字下げの深さ・空・多段・折りたたみ・折りたたんだ中の折りたたみ・`shapeIds`/`groupIds`/`ancestorIds`）、字下げの頭打ち、見た目（強い/弱い・入れ子のフォルダ・描き込む先・見えない行の印の3種・多段では見えている外側のフォルダだけ）、スクロールの対象、次の選択（ふつう・`Ctrl`で足す/外す・選んでいるフォルダの中の図形を外す・中の空のフォルダを外す・`Shift`の範囲に開いた/閉じたフォルダ・起点がフォルダ・折りたたまれて行の無い選択が残る・行が無いid）、行のドラッグの条件、三角の条件。

*   [ ] タスク13: 一覧のパネルのフォルダの行
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./index.html` :（更新。行のCSSだけ）
    *   **作業内容** :
        *   行の表示内容に`kind`・`indent`・`collapsed`・`canToggle`・`selectedInGroup`・`hiddenMark`を足す（省かれたら図形の行・0・偽。この時点の`ItemListWiring`のまま今と同じに動く）。フォルダの行は`<span class="item-row-toggle">`（`▸`／`▾`。空のフォルダは`visibility: hidden`）＋`<span class="item-row-folder-icon">`（CSSで描くフォルダの絵）＋名前。字下げはカスタムプロパティ`--row-indent`で行の左の余白に足す。同じidで`kind`が変わったら要素を作り直す（編集中なら先に控えを捨てる）。`getThumbnailCanvas`はフォルダの行で`null`。`getSelectedRowIds()`は`selected`・`selected-in-group`の両方を返す。`getMarkedRowId()`（上から最初の、描き込む先か見えない行の印の行）を足す（`getInsertMarkId()`はタスク14まで残す）。typedef・クラスのJSDocを直す。
        *   CSS：`.selected-in-group`（`.selected`より薄い背景）・`.has-hidden-mark`（破線の枠。`.selected`・`.insert-target`と重なっても見分けられる）・三角・フォルダの絵・字下げ。線を描く疑似要素（`drop-before`・`drop-after`）は変えない。図形の行の見た目は字下げ0で今と同じ。

*   [ ] タスク14: 一覧の配線（行・選択・行のドラッグの条件）
    *   **対象ファイル** :
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/palette/ItemListPanel.js` :（更新。`getInsertMarkId()`を消すだけ）
        *   `./js/core/ItemListRules.js` :（更新。`buildItemRows`・typedef`ItemRow`・`ItemTreeRules`のimportを消し、責務のJSDocを直す）
        *   `./test/core/ItemListRules.test.js` :（更新。`buildItemRows`の7件とimportを除く。要件9の表）
        *   `./test/core/ItemRowRules.test.js` :（更新。7件を移す。要件9の表）
    *   **作業内容** :
        *   `sync`を`ItemRowRules`（`buildItemRows` → `resolveRowViews` → `panel.render` → `resolveRowHighlight`）へ差し替える。`#handleRowClick`は`resolveRowClickSelection` → `model.setSelectionByUser(ids, { groupIds, keepsCollapsed: true })`。`#handleRowPress`は`canStartRowDrag`へ`hasGroups: hasGroupItem(model.getItems())`を渡す。サムネイルはフォルダの行を飛ばす。`getRowIds`・名前の編集・ホバーは`buildItemRows`の置き場所の変更だけ。判定を書かない。JSDocを直す。

*   [ ] タスク15: 折りたたみの三角と、作るボタン
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/main.js` :（更新。`groupEditor`の注入だけ）
        *   `./index.html` :（更新。ボタンとCSS）
    *   **作業内容** :
        *   パネル：`.item-row-toggle`の中のクリックは`onGroupToggle(id)`だけを呼び`onRowClick`を呼ばない。ボタン`#item-list-add-group`（`.item-list`の外、パネルの下端の`.item-list-footer`の中）の`click`は`blur()`してから`onAddGroup()`。どちらのコールバックも関数でなければ`Error`（今の引数の検査と同じ）。JSDocを足す。
        *   配線：三角は`canToggleGroup`が真なら`model.setGroupCollapsed(id, !今の値)` → `sync({ allowScroll: false })`（選択に触れない）。ボタンは`resolveFolderButtonAction`の結果で`groupEditor.groupSelection()`／`addEmptyGroup({ selects: true })`／`addEmptyGroup({ selects: false })`／何もしない。`setMode`等を呼ばない（ツール・引いている途中の線はそのまま）。
        *   `index.html`：パネルを縦の並び（一覧が伸び、下端にボタン）にする。`.item-list`の子に行以外を足さない。`title`は「フォルダを作る (Ctrl+G)」。記号は「＋」とCSSのフォルダの絵（📁は使わない）。

*   [ ] タスク16: 通しのテスト
    *   **対象ファイル** :
        *   `./test/edit/GroupEditor.flow.test.js` :（新規）
    *   **作業内容** :
        *   実物（`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`GroupEditor`・`ShapeOrderEditor`・`PathJoiner`・`ShapeInserter`・`ClipboardController`・`ItemRenameEditor`・`DocumentSerializer`・`SpriteSerializer`）で、公開APIだけを通して確かめる（補助関数にもJSDoc）：隣り合う図形をまとめる前後で`elements`・`bounds`が同じ／別々のフォルダの線の結合の結果が、奥の線の場所・名前になり両方のフォルダが残る／フォルダを選んだ複製・コピー・貼り付け・切り取り・記録しない複製で、フォルダが壊れず図形が消えず二重にならない／フォルダの名前の変更と取り消し／まとめる→入れ子→キー→解除→削除を続けて、取り消しをすべて往復するとJSONとフォルダの選択が一致する／描き込む先（フォルダを選ぶ＝中の一番上、空のフォルダだけ＝今の値）／作業データの往復・インポートで入れ子・名前・折りたたみが戻る。

*   [ ] タスク17: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   『開発資料の更新予定』（各タスクの追記を含む）を、1章・2章・3章（6.・7.・8.・14.・16.・28.・キーの割り当てほか）・4章の一覧へ、実コードを確かめて反映する。行末を実測して保つ。

*   [ ] タスク18: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の01・02・03・06・07・08・13・14・15・16・46・47・48・49・53・56 :（更新）
        *   `./_doc/arch/57_GroupTreeRules.md`・`./_doc/arch/58_GroupSelectionRules.md`・`./_doc/arch/59_GroupCollapseRules.md`・`./_doc/arch/60_GroupCommandRules.md`・`./_doc/arch/61_ItemRowRules.md` :（新規）
    *   **作業内容** :
        *   『開発資料の更新予定』を反映する。書き換える前に各ファイルの行末を実測し保つ。`main.js`・`InputTracker.js`の行数、テストの件数も実測で直す。

## 4. 詳細作業内容
※ タスク実行時にそれぞれ記入する。

### タスク1: 入れ子を動かす計算の規則
*   **作業内容** :
    *   `js/core/GroupTreeRules.js`（新規・CRLF）：`itemIdOf`・`hasGroupItem`・`wrapUnits`・`unwrapGroups`・`removeItems`・`listSiblingLists`・`mapSiblingLists`・`isSameTree`をJSDoc付きで作成。importは`ItemTreeRules`の`ITEM_KIND`のみ。
    *   `test/core/GroupTreeRules.test.js`（新規・CRLF）：指定の観点で38件。`node --test`は tests 2950 / pass 2950 / fail 0。
    *   `wrapUnits`：`group`は`{...group, children: まとまり(前順)}`で置き、まとまりが無ければ並びは変えない（写しを返す）。`unwrapGroups`：`groupIds`に入れ子の中のフォルダが含まれても解除できる（中から先に解除）。`mapSiblingLists`：`fn`の結果の中のフォルダの`children`へ再帰する（`fn`は外側 → 結果の前順のフォルダの順に、空の並びでも1回）。`isSameTree`は種類とidと並びだけを見る。

### タスク2: フォルダを選んでいる状態の規則
*   **作業内容** :
    *   `js/core/GroupSelectionRules.js`（新規・CRLF）：`resolveGroupCandidates`・`resolveSelectedGroupIds`・`resolveSelectedUnitIds`・`resolveRevealIds`をJSDoc付きで作成。importは`ItemTreeRules`（`ITEM_KIND`）・`GroupTreeRules`（`itemIdOf`）のみ。
    *   `test/core/GroupSelectionRules.test.js`（新規・CRLF）：指定の観点で26件。`node --test`は tests 2976 / pass 2976 / fail 0。
    *   戻り値：`resolveGroupCandidates`・`resolveSelectedGroupIds`は`Set<string>`、`resolveSelectedUnitIds`・`resolveRevealIds`は`string[]`。`requestedIds`は`undefined`／`null`のとき「渡されていない」とし、空配列は指定として扱う。入力のid群は`Iterable`で受ける（`resolveSelectedGroupIds`の`selectedIds`・`candidateIds`は`Set`）。`resolveRevealIds`の非additiveは「図形の選択かフォルダの選択が集合として変わったとき」の判定を集合の比較で行う。

### タスク3: 折りたたみの属性と作業データ
*   **作業内容** :
    *   `js/core/GroupCollapseRules.js`（新規・CRLF）：`setCollapsed`・`expandGroupsContaining`・`withoutCollapsed`・`listCollapsedIds`・`restoreCollapsed`をJSDoc付きで作成。importは`ItemTreeRules`（`ITEM_KIND`）・`GroupTreeRules`（`itemIdOf`）のみ。
    *   `js/core/ItemTreeRules.js`（LF）：typedef`GroupItem`に`[collapsed]`を足しただけ。`js/core/ItemAttributeRules.js`（LF）：`resolveItems`でフォルダの`collapsed`が`true`以外ならキーを消す（責務・JSDocも更新）。`js/io/DocumentSerializer.js`（LF）：`#itemToElement`が閉じているときだけ`collapsed`をtype,id,name,visible,locked,collapsed,childrenの順に書き、`#readElements`が要素の値のまま持つ（JSDoc更新。版・`MIGRATIONS`は不変）。
    *   テスト：`test/core/GroupCollapseRules.test.js`（新規・CRLF）、`test/io/DocumentSerializer.collapsed.test.js`（新規・CRLF）、`test/core/ItemAttributeRules.test.js`（末尾に追加のみ）。計31件。`node --test`は tests 3007 / pass 3007 / fail 0。
    *   戻り値：`setCollapsed`・`expandGroupsContaining`は変わらないとき引数と同じ参照、変わるときは変わったフォルダの祖先だけ新しいオブジェクト（図形のアイテム・変わらない枝は共有）。`withoutCollapsed`・`restoreCollapsed`は常に新しい入れ子（図形のアイテムも写す）。`listCollapsedIds`は前順の`string[]`。`shapeIds`・`recordedIds`は`Iterable`で受ける。

### タスク4: VectorModelがフォルダを選んでいる状態と折りたたみを持つ
*   **作業内容** :
    *   `js/core/VectorModel.js`（LF）：`#selectedGroupIds`・`getSelectedGroupIds()`・`setGroupCollapsed`・`onCollapsedChange`を追加。`setSelection(ids, { groupIds, keepsCollapsed })`・`setSelectionByUser(ids, { groupIds, additive, keepsCollapsed })`の引数、`clearSelection`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`の候補（要件3のとおり）、`#applyState`の引数`selectedGroupIds`（候補。省けば今の値）・`revealIds`を実装。責務のJSDocに2つの状態を追記。`rearrangeItems`は未実装（タスク5）。
    *   `test/core/VectorModel.groupSelection.test.js`（新規・CRLF）25件、`test/core/VectorModel.collapse.test.js`（新規・CRLF）18件。`node --test`は tests 3050 / pass 3050 / fail 0。
    *   `#applyState`は、`revealIds`があれば変わる前の`#items`にあったフォルダだけを`expandGroupsContaining`で開き（開いたら折りたたみの変化を覚える）、その後フォルダの選択を`resolveSelectedGroupIds`で絞る。`#notifyChange`は`onChange`のリスナーの後に、覚えていれば`onCollapsedChange`のリスナーを1回呼んで覚えを消す。開く対象は非公開の`#resolveReveal`が`resolveRevealIds`で求める（前後のフォルダの選択は不変条件を通した値）。`addShapesWithNewIds`は足した図形のidを`revealIds`に渡す。

### タスク5: 入れ子を動かす公開操作
*   **作業内容** :
    *   `js/core/VectorModel.js`（LF）：`rearrangeItems(nextItems, { selectedIds, selectedGroupIds, selectsNewGroups })`と非公開の検証`#isValidRearrangement`をJSDoc付きで追加。`GroupTreeRules`から`isSameTree`をimport。`deleteShapes`のJSDocにフォルダごとの削除は`rearrangeItems`で行う旨を追記（コード不変）。
    *   `test/core/VectorModel.rearrangeItems.test.js`（新規・CRLF）21件。`node --test`は tests 3071 / pass 3071 / fail 0。
    *   順序：検証（配列・図形のインスタンス・フォルダのid。外れたら`console.warn`して`false`）→`isSameTree`で同じなら`false`→`resolveItems(nextItems)`→新しいフォルダ（idが`null`／`undefined`）に前順で`group-`のidを採番→`#applyState`（図形の選択は残った図形だけ、フォルダの候補は`selectedGroupIds`（省けば今の値）＋`selectsNewGroups`なら新しいフォルダ）→消えた図形のホバーを消し`#pruneSelectedVertices()`→通知1回。`revealIds`は渡さず折りたたみの変化も覚えないため`onCollapsedChange`は呼ばれない。

### タスク6: 取り消し/やり直し
*   **作業内容** :
    *   `js/edit/SnapshotAdapter.js`（CRLF）：`capture`は`serialize(withoutCollapsed(getItems()))`・`selectedIds`・`selectedGroupIds`・`collapsedGroupIds`（`listCollapsedIds`）を返す。`restore`は`restoreCollapsed(result.items, model.getItems(), collapsedGroupIds ?? [])`を通して`replaceAllShapes`へ渡し、`shouldRestoreSelection()`が真のとき`setSelection(selectedIds, { groupIds: selectedGroupIds ?? [], keepsCollapsed: true })`。typedef・依存の制約・責務のJSDocを更新（importに`GroupCollapseRules`を追加）。
    *   `js/core/HistoryManager.js`（LF）：typedef`Snapshot`に`[selectedGroupIds]`・`[collapsedGroupIds]`を足しただけ。
    *   `test/edit/SnapshotAdapter.groups.test.js`（新規・CRLF）11件。`node --test`は tests 3082 / pass 3082 / fail 0。

### タスク7: 折りたたみの自動保存
*   **作業内容** :
    *   `js/edit/CanvasLibrary.js`（CRLF）：`requestSave()`（`#scheduleSave()`を呼ぶだけ）をJSDoc付きで追加。クラスJSDocの自動保存の契機に`requestSave()`（履歴によらない。折りたたみの変化）を追記。
    *   `test/edit/CanvasLibrary.collapse.test.js`（新規・CRLF）6件：`setGroupCollapsed`で記録に`collapsed`が出る/消える（履歴は増えない）・選択による自動で開くで消える・切り替えて戻ると保たれる・開く（ファイル）で閉じたまま記録/復元・切り替えだけでは`onCollapsedChange`が起きない・読み込み完了前の`requestSave()`は何もしない。`node --test`は tests 3088 / pass 3088 / fail 0。

### タスク8: まとめる・解除・空のフォルダ・削除の編集操作
*   **作業内容** :
    *   `js/core/GroupCommandRules.js`（新規・CRLF）：`canEditGroups`（選択モードだけ真）・`FOLDER_BUTTON_ACTION`（凍結。`NONE`・`GROUP`・`ADD_AND_SELECT`・`ADD`）・`resolveFolderButtonAction`をJSDoc付きで作成。importは`InputModes`のみ。
    *   `js/edit/GroupEditor.js`（新規・CRLF）：`groupSelection`・`ungroupSelection`・`addEmptyGroup({ selects })`・`removeSelection`・`hasSelectedUnits`をJSDoc付きで作成。`{ model, editRecorder, getMode }`を注入で受け、`model`は`getItems`・`isSelected`・`getSelectedGroupIds`・`getInsertTargetId`・`rearrangeItems`だけを使う。何もしないとき（モード不可・まとまり無し・解除でまとまりにフォルダ無し）は`beginEdit`も呼ばず`false`。
    *   テスト：`test/core/GroupCommandRules.test.js`（新規・CRLF）8件、`test/edit/GroupEditor.test.js`（新規・CRLF）21件（偽の依存10件・実物11件）。`node --test`は tests 3117 / pass 3117 / fail 0。
    *   `groupSelection`は新しいフォルダを`{ kind: 'group', children: [] }`（idなし）で`wrapUnits`へ渡す。`ungroupSelection`の`selectedGroupIds`は、解除したフォルダの直下のフォルダのid（まとまりの中のフォルダ＝まとまりのidのうちフォルダのもの。入れ子の中のフォルダは対象外）。`addEmptyGroup`は`getInsertTargetId()`が`null`なら`isTarget`がどれにも当たらず末尾へ入る。

### タスク9: 重なり順のキーの範囲
*   **作業内容** :
    *   （未実施）

### タスク10: 削除の受理と、選び直し/足すの区別
*   **作業内容** :
    *   （未実施）

### タスク11: `Ctrl`+`G`・`Ctrl`+`Shift`+`G`
*   **作業内容** :
    *   （未実施）

### タスク12: 行の並びの規則と、一覧の判定
*   **作業内容** :
    *   （未実施）

### タスク13: 一覧のパネルのフォルダの行
*   **作業内容** :
    *   （未実施）

### タスク14: 一覧の配線（行・選択・行のドラッグの条件）
*   **作業内容** :
    *   （未実施）

### タスク15: 折りたたみの三角と、作るボタン
*   **作業内容** :
    *   （未実施）

### タスク16: 通しのテスト
*   **作業内容** :
    *   （未実施）

### タスク17: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   （未実施）

### タスク18: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
*   **取り消し/やり直しで、折りたたんだフォルダの中の図形の選択が戻っても、フォルダは開かない**（要件2の「取り消し/やり直しをしても、今の折りたたみが保たれる」を優先した計画の判断。フォルダの行に印が出る）。
*   **`Ctrl`+`A`・`Ctrl`+`I`・結合・貼り付け・複製は「一覧以外で選ぶ」**とし、選択が変わったときは中の図形のある折りたたんだフォルダが開く（選んでいる開いたパス1本を`J`で閉じるときは、同じidのままで選択が変わらないため開かず、フォルダを選んでいる状態も残る）。`Ctrl`＋クリック・`Ctrl`＋範囲選択では、新しく足した図形の上のフォルダだけが開く。インポートしたフォルダ自身の折りたたみは保つ。
*   **まとめたとき、一番上の行が折りたたんだフォルダの中なら、できたフォルダはその中に隠れる**（選ばれている図形は変わらないため開かない。閉じたフォルダに印が出る）。
*   **見えない行の印は、閉じたフォルダ自身が選ばれているときも出る**（REQの文言どおり。中の図形が選ばれているため）。
*   **`Ctrl`＋クリックで「選んでいるフォルダの中のフォルダ」を押すと、その中のフォルダが外れ、外側のフォルダも選んでいる状態から外れる**（中の図形の行と同じ扱い）。
*   **空のフォルダだけを選んだ切り取り**は、写す図形が無いため何もしない（フォルダも消えない）。
*   **字下げは6段で頭打ち**（7段目以降は同じ字下げになり、深さは行の並びだけで分かる）。
*   **`ShapeOrderEditor.test.js`の偽のmodelの受け口を替える**（要件9の表の3行目）。期待する並び・呼び出し順・戻り値は変えない。
*   **`VectorModel.deleteShapes`は製品コードからの呼び出し元が無くなる**（削除は`rearrangeItems`へ一本化。既存のテストが使うため残す）。
*   **`?dev`の復元で、違いが折りたたみだけのとき**は履歴に記録されず自動保存の契機にもならない（開発用の画面だけ。次の編集で保存される）。
*   （タスク1）`mapSiblingLists`の`fn`は、並びを書き換えず新しい配列を返すこと（`wrapUnits`の無いときの写しもこれで作る）。`unwrapGroups`は`groupIds`が入れ子の中のフォルダを含んでも解除する（`GroupEditor`が渡すのは選んでいるまとまりのフォルダ）。
*   （タスク1）`git add -N`で新しいファイル2件を意図的追加の状態にした（`git ls-files --eol`の実測のため。内容のステージはしていない）。
*   （タスク2）`resolveSelectedGroupIds`の(3)は`previousItems`のフォルダ内の図形が`selectedIds`に全部あることを見るため、フォルダの中身が増えた（新しい図形が入った）だけでも、増えた図形が選ばれていなければ落ちる（(2)）。`resolveRevealIds`の`additive`では前の選択に無い図形だけを返す（フォルダの選択の変化は見ない）。
*   （タスク3）`restoreCollapsed`は入れ子の中のフォルダも含め、`items`のフォルダすべてを今の状態/記録で決め直す（`items`側の`collapsed`は使わない）。`expandGroupsContaining`は、`canExpand`が偽のフォルダの上のフォルダも、対象の図形を含んでいれば開く。`DocumentSerializer`は`element.collapsed`を無加工で持ち`resolveItems`が`true`以外を消すため、読み込み結果のフォルダに`collapsed: undefined`のキーは残らない。開発資料への影響：新しいファイル`GroupCollapseRules`が増える点は既存の更新予定（57〜61）に含まれており、追記は無い。
*   （タスク4）`setSelectionByUser`の「何もしない」判定は、結果のフォルダの選択（不変条件を通した値）が空かで見ている。`setGroupCollapsed`は`#applyState({ items })`を通すため、折りたたみの変更でもフォルダの選択の不変条件が再評価されるが値は変わらない。`#resolveReveal`と`#applyState`で不変条件を2回計算するが、候補が空なら入れ子を見ずに返る。
*   （タスク5）`rearrangeItems`の検証は、図形のアイテムの`shape`が今の図形インスタンスであること・フォルダの`id`が`null`／`undefined`か今あるフォルダであること・どの要素も`kind`が`shape`／`group`であることまで見る（図形が減るのは許す＝除く操作のため）。`selectedIds`・`selectedGroupIds`は`Iterable`で受け、`undefined`だけを「省く」と扱う（空の配列は指定）。新しいフォルダの採番は前順。呼び出し側（`GroupEditor`・`ShapeOrderEditor`）は、新しいフォルダのアイテムを`id`なしで渡すこと。
*   （タスク6）履歴は`document`が同じだと記録しないため、選択だけの変化は記録されない（テストの編集は`renameItem`を伴わせている）。`SnapshotAdapter`の2項目はtypedefでは省略可（任意）とし、無いスナップショットは空として扱う。開発資料への影響：既存の更新予定（スナップショット・3章6.）に含まれており、追記は無い。
*   （タスク8）`ungroupSelection`は、選択中のフォルダが複数ある場合、解除しないフォルダの選択は引き継がない（`selectedGroupIds`は解除したフォルダの直下のフォルダだけ。解除するのはまとまりのフォルダすべてなので、実際に外れるフォルダは無い）。`GroupEditor`は新しいフォルダの名前・idを付けず`rearrangeItems`に任せる。開発資料への影響：既存の更新予定（`GroupEditor`・`GroupCommandRules`＝60）に含まれており、追記は無い。
*   DOM（`ItemListPanel`・`ItemListWiring`・`main.js`・CSS）と`InputTracker`は自動テストの対象外で、下のテストプレイで確かめる。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。塗りのボタン（🪣）をONにし、色の違う塗った図形を8つほど、少しずつ重ねて描く。描き終えたら`V`（選択）にする。
1.  **まとめる**：1つをクリックし、`Ctrl`＋クリックでいくつか足して（キャンバスでも一覧でもよい。空いている所からのドラッグでの範囲選択もできるが、選ばれるのは輪郭が枠にかかった図形）`Ctrl`+`G`を押すと、一番上の行の位置にフォルダができ、中に字下げされて並び、フォルダが選ばれている。ブラウザの検索は出ない（何も選んでいないときに押しても出ない）。離れた図形をまとめると重なり順が変わる。`Ctrl`+`Z` 1回で、並びと選択が戻る。
2.  **入れ子**：一覧でフォルダの行を押し、`Ctrl`を押しながら図形の行を押して`Ctrl`+`G`を押すと、フォルダの中にフォルダができる。
3.  **解除**：フォルダの行を押して`Ctrl`+`Shift`+`G`で、中身が外へ出て、中身が選ばれている。順番は変わらない。図形だけを選んで押しても何も起きない。
4.  **作るボタン**：キャンバスの空いている所をクリックして何も選んでいない状態にし、一覧の下のボタンを押すと、一番上に空のフォルダができて選ばれる。図形を選んでから押すと、まとめられる。図形を描くツールのまま押すと、描き込む先の図形のすぐ上（無ければ一番上）に空のフォルダができ、ツールと引いている途中の線はそのまま。
5.  **折りたたみ**：三角で折りたたむ・開く（選択は変わらない）。キャンバスの空いている所をクリックしてからフォルダを折りたたみ、キャンバスで中の図形をクリックすると、開いて行が見える（その図形だけがすでに選ばれているときは、選択が変わらないので開かない）。選んだまま折りたたむと閉じたままで、フォルダの行に破線の印が出る。ページを開き直しても・キャンバスを切り替えて戻っても、折りたたみは保たれる。`Ctrl`+`Z`では折りたたみは変わらない。
6.  **フォルダを選ぶ**：`V`でフォルダの行を押すと、中の図形がすべて選ばれ（中の行は弱い見た目）、まとめて移動・変形・色の変更ができ、終わってもフォルダは選ばれたまま。キャンバスで中の図形をクリックすると（外枠のハンドルの上を除く）、その図形だけが選ばれる。`Ctrl`＋クリックで足す・外す、`Shift`＋クリックで見えている行の範囲を選べる。選んでいるフォルダの中の図形の行を`Ctrl`＋クリックすると、その図形だけ外れる。`A`にしてからフォルダの行を押すと頂点が出る（円・弧には出ない）。
7.  **削除**：`V`でフォルダを選んで`Delete`（またはツールバーの🗑）を押すと、中身ごと消える。`Ctrl`+`Z`で戻る。空のフォルダも消せる。図形だけを選んで消すと、空になったフォルダは残る。
8.  **キー**：フォルダの中の図形を選んで`Home`（一番上）・`PageUp`（1つ上）・`PageDown`（1つ下）・`End`（一番下）を押すと、そのフォルダの中だけで動く。フォルダを選んで押すとフォルダごと動き、隣のフォルダの中へは入らない。端にあって動かないときは、一覧がスクロールすることがある（今までどおり）。
9.  **名前**：フォルダの名前をダブルクリックで変えられる（`Enter`・欄の外を押すと確定、`Esc`で取りやめ、`Ctrl`+`Z`で戻る）。三角を素早く2回押しても編集に入らない。
10. **保存と書き出し**：フォルダのある絵を、作業データファイルに出力して開く・インポートする・ページを開き直すと、フォルダと名前・折りたたみが戻る（インポートは描き込む先のすぐ上、無ければ一番上へ入り、入った図形が選ばれる）。隣り合う図形をフォルダにまとめる前と後に書き出したJSを確認用ページ（`sprite-check.html`）で開くと、同じに描かれる。
11. **結合**：別々のフォルダの線（直線・曲線・開いたパス・弧）を`V`で2本選んで`J`で結合すると、**奥の線（一覧で下の行）** のあった場所に入り、その名前・色・太さを引き継ぐ。手前の線の入っていたフォルダは、空になっても残る。
12. **ほかが今までどおり**：フォルダの無い絵での一覧・行のドラッグでの並べ替え・描き込む先・複製・コピー、描く・動かす・変形・色・整列・保存・書き出し・開くが今までどおり動く。フォルダが1つでもある絵では、行のドラッグは始まらない。複製・コピー・貼り付けは図形だけを写す（写した後はフォルダを選んでいる状態ではない）。
