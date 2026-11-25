# RES: 作業計画・作業レポート (Phase 11-05) : 表示・非表示とロック
* 参照元REQ: `./_log/req/261125_1901_REQ_Phase11-05_Visibility_And_Lock.md`

## 1. 作業目的
図形・フォルダごとに、隠す・固定（ロック）することができるようにする。一覧のすべての行に目と鍵のアイコンを出し、隠れているもの・ロックされているものを、描画・当たり・変更・吸い付き・書き出しの対象から外す。

* 作業データの版（4）・書き出し形式の版（4）・履歴のエントリの形・キーの割り当ての表は変えない。
* **変更しないファイル**：`shapes/`・`core/CanvasManager.js`・`core/KeyboardShortcuts.js`・`core/HistoryManager.js`・`core/AltKeyGuard.js`・`core/ItemTreeRules.js`・`core/GroupTreeRules.js`・`core/GroupSelectionRules.js`・`core/InsertTargetRules.js`・`core/ItemPlaceRules.js`・`core/ItemAttributeRules.js`・`core/SelectionRules.js`・`core/NudgeTargetRules.js`・`core/VertexHandleRules.js`・`core/CursorShapeRules.js`・`core/PressActionRules.js`・`core/ListDragRules.js`・`io/`のうち`SpriteSerializer.js`以外・`edit/PathCornerEditor.js`・`edit/ShapeOrderEditor.js`・`edit/ShapeAlignEditor.js`・`edit/ShapeInserter.js`・`edit/SnapshotAdapter.js`・`edit/CanvasLibrary.js`・`edit/CanvasFileOperations.js`・`wiring/DisplayWiring.js`・`wiring/ItemListRowDrag.js`。
* **JSDocだけ直すファイル**：`core/PointHitRules.js`（タスク10）。
* 計画時点の`node --test`は tests 3380 / pass 3380 / fail 0。
* **行末**：編集の前に`git ls-files --eol <パス>`の`w/`で実測し、保つこと（Git Bashの`grep`で`\r`を数えると誤る）。計画時の実測は、CRLF＝`js/core/`の`InputTracker`・`ItemRowRules`、`js/edit/`の`GroupEditor`・`ClipboardController`・`NudgeEditor`、`js/io/SpriteSerializer`、`js/main.js`、`test/core/ItemRowRules`、`test/edit/`の`EndpointSnapper`・`GroupEditor`・`ClipboardController.groups`・`NudgeEditor`・`TransformInputEditor`。LF＝`js/core/`の`VectorModel`・`ItemListRules`・`PointHitRules`、`js/edit/`の`EndpointSnapper`・`PathJoiner`・`PositionInputEditor`・`ShapeExtentReader`・`ShapeStyleEditor`・`StyleEyedropper`・`TransformInputEditor`、`js/palette/ItemListPanel`、`js/wiring/ItemListWiring`、`index.html`、`test/core/`の`ItemListRules`・`VectorModel.items`・`VectorModel.selectedVertices`、`test/edit/`の`ClipboardController.items`・`EndpointSnapper.items`・`PathCornerEditor.items`・`PathJoiner.items`・`StyleEyedropper`・`TransformInputEditor.items`、`test/io/SpriteSerializer.items`。**`test/edit/PathJoiner.test.js`は混在（mixed）**：直す行の行末だけを前後の行に合わせ、ほかの行の行末を変えない。新しいファイルは`js/`・`test/`・`_doc/arch/`ともCRLF。本RESはLF。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **隠れている**：自分の表示が切、または上のフォルダのどれかの表示が切。
*   **ロックされている**：自分のロックが入、または上のフォルダのどれかのロックが入。
*   **変えられる**：隠れてもロックされてもいない（図形・フォルダとも）。
*   **自分の値**：アイテムの`visible`（`false`だけが「切」）・`locked`（`true`だけが「入」）。値が無いアイテム・素の図形は、表示・ロックなし。
*   **選んでいるまとまり（units）**：`GroupSelectionRules.resolveSelectedUnitIds`の結果（前順。互いに含み合わない。最後のものが一覧で一番上）。
*   **クリック等が当たる図形は「変えられる図形」と同じ**（隠れているもの・ロックされているものの両方が素通りになるため、別の照会を作らない）。

### モジュールの分担（全体）
| 置き場所 | 役割 |
| --- | --- |
| `core/ItemStateRules.js`（新規） | 表示・ロックの判定（自分の値・上のフォルダから受け継ぐ計算・変えられるか）と、値を変えた入れ子の計算。**`visible`・`locked`の値を見るのはここだけ**（不備を補う`ItemAttributeRules`と、読み書きする`DocumentSerializer`を除く）。importは`ItemTreeRules`・`GroupTreeRules`（`itemIdOf`）のみ |
| `core/RemovalRules.js`（新規） | 選んでいるまとまりから、消えるもの・残すもの・写すものを求める（削除・切り取り・`Alt`＋ドラッグの複製の共通の規則）。importは`ItemTreeRules`・`GroupTreeRules`（`itemIdOf`）・`ItemStateRules`（`collectEditableIds`）のみ |
| `core/SoloVisibilityRules.js`（新規） | その行だけの表示（要件8）の、見分け・次の表示・覚える内容の計算。importは`GroupTreeRules`（`itemIdOf`）・`ItemPlaceRules`（`findItemLocation`）・`ItemStateRules`（`listItemStates`）のみ |
| `core/VectorModel.js`（更新） | 上の規則を使った照会と、値を変える唯一の公開操作`setItemStates`。頂点の選択を変えられる図形に限る |
| `core/ItemRowRules.js`（更新） | 行の見た目に表示・ロックの項目を足す |
| `core/ItemListRules.js`（更新） | アイコンを押したときの動作・アイコンの上の押下で行のドラッグを始めない判定 |
| `edit/ItemStateEditor.js`（新規） | 目・鍵・`Alt`＋目の、それぞれ1件の編集操作。`Alt`＋クリックの前の表示の一時的な記憶 |
| `edit/`の今のクラス（更新） | 照会の置き換え（下の表） |
| `io/SpriteSerializer.js`（更新） | `elements`・`bounds`を見えている図形だけから求める |
| `palette/ItemListPanel.js`・`index.html`（更新） | 目と鍵の要素・クラスの書き換え・クリックの通知（規則を持たない） |
| `wiring/ItemListWiring.js`（更新） | 規則の結果を`ItemStateEditor`へ渡す橋渡し・キャンバスの切り替えで記憶を忘れさせる |
| `core/InputTracker.js`（更新） | 対象の図形を照会へ置き換えるだけ |
| `main.js`（更新） | 渡す図形の一覧・削除ボタンの照会・選択の反転・生成と注入だけ |

循環は無い（`ItemTreeRules ← GroupTreeRules ← ItemStateRules ← RemovalRules・SoloVisibilityRules・ItemRowRules`、`ItemPlaceRules ← SoloVisibilityRules`。`GroupTreeRules`・`ItemPlaceRules`は`ItemStateRules`をimportしない）。新しい依存：`edit/ItemStateEditor → core/ItemStateRules・SoloVisibilityRules`、`edit/GroupEditor・ClipboardController → core/RemovalRules`、`io/SpriteSerializer → core/ItemStateRules`（どれも状態を持たない規則の関数。下向き）。

### 今の使用箇所の洗い出し（`getShapes`・`getSelectedIds`・`isSelected`・`getSelectedGroupIds`）
「見るべきもの」＝**全部**（全部の図形）・**見える**（見えている図形）・**変えられる**（変えられる図形）・**選変**（選んでいる中の変えられる図形）・**選全**（選んでいる図形。変えられないものを含む）。行番号は計画時。

| 箇所 | 今 | 見るべきもの | 変更 |
| --- | --- | --- | --- |
| `main.js` 219 `renderCurrentState`の描く図形 | `getShapes` | 見える | `getVisibleShapes()` |
| `main.js` 224 `collectVertexHandles` | `getShapes`・`getSelectedIds` | 変えられる＋選全 | 図形は`getEditableShapes()`、選択は`getSelectedIds()`のまま |
| `main.js` 335 削除ボタン | `getSelectedIds`・`getSelectedGroupIds` | 消えるものがあるか | `!model.hasRemovableSelection()` |
| `main.js` 983 選択の反転 | `getShapes`・`getSelectedIds` | 変えられる＋選全 | 第1引数を`getEditableShapes()`のidへ（選んでいる変えられないものは外れる） |
| `InputTracker` 653 `deleteSelection`の受理 | `getSelectedIds`・`getSelectedGroupIds` | 消えるものがあるか | `hasRemovableSelection()` |
| `InputTracker` 722 `selectAll` | `getShapes` | 変えられる | `getEditableShapes()` |
| `InputTracker` 1057 押下の判定 | `isSelected` | 選全 | 変えない（当たるidは変えられる図形だけ） |
| `InputTracker` 1164・1184・1188 クリックの次の選択 | `getSelectedIds` | 選全 | 変えない（`Ctrl`＋クリックで、一覧から選んだ変えられない図形の選択を保つ） |
| `InputTracker` 1388 頂点のドラッグの始まり | `getShapes` | 全部 | 変えない（id引き。頂点の選択・当たりは変えられる図形だけ） |
| `InputTracker` 1446・1469 拡大縮小・回転の控え | `getShapes`＋`isSelected` | 選変 | `getEditableSelectedShapes()` |
| `InputTracker` 1553 本体ドラッグの移動 | `getSelectedIds` | 選変 | `getEditableSelectedIds()` |
| `InputTracker` 1558・1709 追従・回転の終わりのid引き | `getShapes` | 全部 | 変えない |
| `InputTracker` 1772・1773 頂点の範囲選択 | `getShapes`・`getSelectedIds` | 変えられる＋選全 | 図形を`getEditableShapes()`へ |
| `InputTracker` 1787 範囲選択の当たり | `getShapes` | 変えられる | `getEditableShapes()` |
| `InputTracker` 1793 範囲選択の今の選択 | `getSelectedIds` | 選全 | 変えない |
| `InputTracker` 1943・1944 当たり分類（クリック・押下・ホバー・カーソル・スポイト） | `getShapes`・`isSelected` | 変えられる＋選全 | 図形を`getEditableShapes()`へ |
| `InputTracker` 2018 カーソルの形 | `isSelected` | 選全 | 変えない |
| `edit/NudgeEditor` 90 対象 | `getSelectedIds` | 選変 | `getEditableSelectedIds()` |
| `edit/NudgeEditor` 135 頂点のid引き | `getShapes` | 全部 | 変えない |
| `edit/PositionInputEditor` 83 対象 | `getSelectedIds` | 選変 | `getEditableSelectedIds()` |
| `edit/PositionInputEditor` 91 頂点の範囲のid引き | `getShapes` | 全部 | 変えない |
| `edit/TransformInputEditor` 134 対象 | `getSelectedIds` | 選変 | `getEditableSelectedIds()` |
| `edit/TransformInputEditor` 149 対象のid引き | `getShapes` | 全部 | 変えない（idは対象＝選変に絞り済み） |
| `edit/PathCornerEditor` 119・165・167 | `getSelectedIds`・`getShapes` | 選んだ頂点だけ | 変えない（選んだ頂点だけを見る。頂点の選択が変えられる図形だけになるため。`SELECT`では図形の対象が空配列になり今も何もしない） |
| `edit/ShapeExtentReader` 38・48・62・63 選択の外枠3つ | `getShapes`＋`isSelected` | 選変 | `getEditableSelectedShapes()` |
| `edit/ShapeExtentReader` 87 全体の外枠（⛶） | `getShapes` | 見える | `getVisibleShapes()` |
| `edit/ShapeAlignEditor`（間接） | 上の外枠 | 選変 | 変えない |
| `wiring/DisplayWiring`（間接。大きさの表示・⛶） | 上の外枠 | 選変・見える | 変えない |
| `edit/PathJoiner` 99 | `getShapes`＋`isSelected` | 選変 | `getEditableSelectedShapes()` |
| `edit/ShapeStyleEditor` 304 | `getShapes`＋`isSelected` | 選変 | `getEditableSelectedShapes()` |
| `edit/ShapeStyleEditor` 332 プレビューした図形が残っているか | `getShapes` | 全部 | 変えない（変えられる間に付けた色を、1件として記録し終えるため） |
| `edit/StyleEyedropper` 118 | `getShapes` | 変えられる | `getEditableShapes()` |
| `edit/EndpointSnapper` 94・108・123・170・216・355 | `getShapes` | 変えられる | `getEditableShapes()`（下の要件6） |
| `edit/GroupEditor` 169・170 選んでいるまとまり | `isSelected`・`getSelectedGroupIds` | 選全 | 変えない（削除だけが、まとまりを`RemovalRules`へ通す） |
| `edit/ClipboardController` 265・266 選んでいるまとまり | `isSelected`・`getSelectedGroupIds` | 選全 | 変えない（切り取り・`Alt`＋ドラッグだけが`RemovalRules`へ通す） |
| `edit/ClipboardController` 300 貼り付いたフォルダ | `getSelectedGroupIds` | 選全 | 変えない |
| `edit/ShapeOrderEditor` 73・74 | `isSelected`・`getSelectedGroupIds` | 選全 | 変えない（並べ替えは許される） |
| `edit/SnapshotAdapter` 68・69 | `getSelectedIds`・`getSelectedGroupIds` | 選全 | 変えない（履歴の記録） |
| `wiring/ItemListWiring` 124・129・130・182〜189・232・233・298・299 | `getSelectedIds`・`isSelected`・`getSelectedGroupIds` | 選全 | 変えない（一覧の選択・まとまり・印・見た目） |
| `wiring/ItemListWiring` 384 行のホバー | `getShapes` | 全部 | 変えない（一覧の行に置いたときの強調は、ロックの行では今のまま出る。隠れている図形は描かれないので出ない） |
| `core/VectorModel`の内部・`getSelectedIds`等の定義 | — | — | 意味を変えない |

JSDoc・引数名だけに現れる箇所（`GroupSelectionRules`・`PointHitRules`・`PressActionRules`・`CursorShapeRules`・`InsertTargetRules`・`ItemListRules`・`ItemRowRules`・`ShapeOrderRules`・`shapes/EndpointSnapRules`・`shapes/PathJoinRules`）は、受け取った値を使うだけなので変えない。`edit/CanvasLibrary`・`edit/CanvasFileOperations`・`main.js`の`?dev`は`getItems()`（全部）のまま。

### 共通の計算: `core/ItemStateRules`（要件2〜4の土台）
責務の3行：「アイテムの表示・ロックの規則（自分の値・上のフォルダから受け継ぐ計算・変えられるかの判定・値を変えた入れ子の計算）。状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules のみ。図形は id だけを読む。」
*   typedef`ItemState`＝`{ item, id, visible, locked, hiddenByAncestor, lockedByAncestor, hidden, editable }`（`visible`・`locked`は自分の値、`hidden`＝隠れている、`editable`＝変えられる）。
*   **`listItemStates(items)`** → `ItemState[]`：前順（フォルダ自身→中身）の1回の再帰。`visible = item.visible !== false`、`locked = item.locked === true`、`hidden = hiddenByAncestor || !visible`、`editable = !hidden && !lockedByAncestor && !locked`。**上のフォルダから受け継ぐ計算と「変えられるか」の判定はここだけ**。ほかの関数はこれを使う。
*   **`listVisibleShapes(items)`**・**`listEditableShapes(items)`** → 図形の配列（重なり順）。`listItemStates`から図形のアイテムだけを取る。
*   **`collectEditableIds(items)`** → `Set<string>`（図形・フォルダの変えられるもののid）。
*   **`collectItemStates(items)`** → `Map<string, ItemState>`（id→状態）。
*   **`resolveVisibleToggle(items, id)`**・**`resolveLockToggle(items, id)`** → `{ id, visible }`／`{ id, locked }`（自分の値の反対）。無いidなら`null`。
*   **`applyItemStates(items, changes)`** → 入れ子：`changes`は`Array<{ id, visible?: boolean, locked?: boolean }>`。真偽値でない値・無いidは無視。**変わるものが無ければ引数と同じ参照**を返し、変わるときは通り道と変わるアイテムだけ新しいオブジェクトにする（引数は書き換えない。図形インスタンスは共有。中のものの値は変えない）。

### `VectorModel`（要件2〜5・7）
*   照会（どれも`#items`から毎回求める。キャッシュ・写しを持たない。新しい配列）：
    *   **`getVisibleShapes()`**＝`listVisibleShapes(#items)`
    *   **`getEditableShapes()`**＝`listEditableShapes(#items)`
    *   **`getEditableSelectedShapes()`**＝`getEditableShapes()`のうち選ばれているもの（描画順）
    *   **`getEditableSelectedIds()`**＝上のid
    *   **`hasRemovableSelection()`**＝`resolveRemoval(#items, 選んでいるまとまりのidのSet) !== null`
*   **`setItemStates(changes)`** → boolean：表示・ロックの値を変える唯一の公開操作。`applyItemStates`が同じ参照なら何もせず（通知もせず）`false`。変われば`#applyState({ items })` → `#pruneSelectedVertices()` → `#notifyChange()`（1回）→ `true`。選択・描き込む先・作成途中の図形・折りたたみに触れない。履歴の記録はしない。
*   **頂点の選択**：`setSelectedVertices`が受理するのは、選択集合に含まれ**かつ変えられる**図形の組だけ。`#pruneSelectedVertices`も同じ条件で落とす（`rearrangeItems`・`replaceShape`等の既存の呼び出しで、ロックしたフォルダの中へ動かしたとき等も外れる）。`collectEditableIds`は1回の呼び出しにつき1回だけ求める。
*   `getShapes()`・`getSelectedIds()`・`isSelected()`・`getItems()`・`getSelectedGroupIds()`と、`moveShapes`等の変更操作の意味は変えない。描き込む先の決まり方（要件7）は変えない。

### 共通の計算: `core/RemovalRules`（要件5の削除・切り取り・`Alt`＋ドラッグ）
責務の3行：「選んでいるまとまりのうち消えるもの・残すもの・写すものを求める（削除・切り取り・Alt+ドラッグの複製の共通の規則）。状態を持たず、DOMにも触れない。importするのは ItemTreeRules・GroupTreeRules・ItemStateRules のみ。図形は id だけを読む。」
*   **`resolveRemoval(items, unitIds)`** → `{ nextItems, copies, copyUnitIds }|null`（`unitIds`は`Set`）：
    *   `editable = collectEditableIds(items)`。まとまりとその中のものを再帰で分ける。
        *   図形：変えられるなら消え、写す。変えられないなら残り、写さない。
        *   フォルダ：中身をそれぞれ分ける。**自分が変えられ、残る中身が1つも無い**（空のフォルダを含む）なら消え、中身の写しを入れた形で写す。それ以外は、残る中身を入れた形で残り、写すものが1つ以上あるときだけ、写すものを入れた形（名前等の値はそのまま）で写す。
    *   まとまりの外のアイテムは残る（フォルダは、中のまとまりを分けた結果の中身で残る。空になっても残る）。
    *   `copies`＝まとまりごとの写し（前順。写しの無いまとまりは入らない）、`copyUnitIds`＝`copies`に対応するまとまりのid（前順）、`nextItems`＝消えた後の入れ子。
    *   写すものが1つも無ければ（＝消えるものが1つも無ければ）`null`。引数は書き換えない。
*   `GroupEditor.removeSelection`：まとまりが無い・`resolveRemoval`が`null`なら`beginEdit`も呼ばずに`false`。それ以外は今と同じ呼び順で`rearrangeItems(nextItems, { selectedIds: [], selectedGroupIds: [] })`。`removeItems`のimportはやめる（`GroupTreeRules.removeItems`は`ItemPlaceRules`が使うため残す）。
*   `ClipboardController`：非公開の`#pickRemovable()`を足す（今の`#pickSelection()`の`unitIds`を`resolveRemoval`へ通し、`null`なら`null`、それ以外は`{ unitIds: copyUnitIds, items: copies }`）。`cut`・`duplicateInPlaceWithinEdit`だけが`#pickRemovable()`を使い、`copy`・`duplicate`は今の`#pickSelection()`のまま。`cut`の「自分のコピー」は`copies`の中のフォルダ（元に残ったフォルダと同じidを含む。切り取った直後に、残ったフォルダの中が描き込む先のまま貼り付けると、今のコピーと同じくそのすぐ上へ入る）。
*   `Alt`＋ドラッグの入る場所は`resolveDuplicatePlace(copyUnitIds)`。`copyUnitIds`だけを渡すのは、変えられないまとまりがロックしたフォルダの中にあるとき、複製がその中へ入って動かせなくなるのを防ぐため（写すまとまりの上のフォルダはすべて変えられるので、複製は必ず変えられる）。

### 端点への吸い付き（要件6）: `edit/EndpointSnapper`
*   `model.getShapes()`をすべて`model.getEditableShapes()`へ置き換える（照会・計画とも）。
*   **引き始めた後で、描き始めの線が変えられなくなったとき**（線を引いている途中に、一覧の行のドラッグでロックしたフォルダの中へ動かした場合）に、引いた線が消えないようにする：非公開の`#toUsableSnap(snap)`＝`null`・`undefined`・始点への吸い付き（`isDrawnStartSnap`）はそのまま、`getShapes()`にあるのに`getEditableShapes()`に無い図形の端点なら`null`、それ以外（今ある変えられる図形・もう無い図形）はそのまま。`commitDrawnLine`（`startSnap`・`endSnap`）・`clickDrawnLine`（同）・`finishDrawnLine`・`findDrawnLineSnap`（`startSnap`）の冒頭で通す。結果、端点につながらず、新しい線として残る。もう無い図形の扱いは今のまま。
*   `model`が使う照会に`getShapes`（上の判定）と`getEditableShapes`が並ぶ。クラスJSDocを直す。

### その行だけの表示（要件8）: `core/SoloVisibilityRules`・`edit/ItemStateEditor`
責務の3行（規則）：「その行だけの表示（Alt+クリック）の見分け・次の表示の値・覚える内容を求める。状態を持たず、DOMにも触れない。importするのは GroupTreeRules・ItemPlaceRules・ItemStateRules のみ。図形は id だけを読む。」
*   typedef`SoloDisplay`＝`{ visibleById: Map<string, boolean>, knownIds: Set<string> }`（1回の「その行だけ」にした直後の控え。`visibleById`＝その時点で覚えている行（今ある行だけ）の、直後の値、`knownIds`＝その時点の全部の行のid）。
*   typedef`SoloMemory`＝`{ visibleById: Map<string, boolean>, displays: SoloDisplay[] }`（`visibleById`＝覚えている行の、はじめの前の値、`displays`＝はじめから今までの控え。古い順）。
*   **行ごとの目標の値**（非公開）：その行と上のフォルダは`true`、その行と上のフォルダそれぞれの兄弟は`false`（`findItemLocation`の`siblings`・`ancestorIds`から）。その行の中のもの・非表示にしたフォルダの中のものは入らない。
*   **今の表示に当たる控え**（非公開）：`displays`のうち、`memory.visibleById`にある今ある行のすべてで、今の値が「控えの`visibleById`の値（控えに無い行は`memory.visibleById`の値）」と同じもの。複数あれば最後のもの。覚えている行が1つも今無い・当たるものが無い・`memory`が無いなら`null`。取り消しで前の「その行だけ」に戻ったときは、その前の控えに当たる。
*   **その行だけの表示か**（非公開）：目標の値が今の値とすべて同じ。当たる控えがあるときは、目標が`false`の行のうちその控えの`knownIds`に無いもの（その後に増えた行）を見ない。
*   **`resolveSoloToggle({ items, id, memory })`** → `{ changes: Array<{ id, visible }>, memory: SoloMemory|null }`。`changes`は今の値と違うものだけ。次の順に決める。
    1. 行が無ければ`{ changes: [], memory }`。
    2. `id`が「その行だけの表示」のとき（`memory`はそのまま返す）：
        *   覚えている表示が使える（当たる控えがある、または`id`の目標の行がすべて`memory.visibleById`にある）なら、`memory.visibleById`のうち今ある行を元の値へ戻す。**戻すものが無ければ`changes`は空**（何も起きない）。
        *   使えない（覚えている表示が無い、または`id`に要る分が無い）なら、全部の行を表示にする。
    3. それ以外：`id`の目標の値にする。当たる控えがあれば記憶を保って継ぎ足し、無ければ（間に目の切り替え・取り消し等で、どの控えとも違う表示になっている）新しく始める。新しい`memory`＝`{ visibleById: (保つなら今までのもの) に、まだ無い目標の行の今の値を足したもの, displays: (保つなら今までのもの) の末尾に今回の控えを足したもの }`。
*   引数（`memory`を含む）は書き換えない。
*   **`edit/ItemStateEditor`**（新規）：責務「アイテムの表示・ロックを切り替える1件の編集操作（目・鍵・その行だけの表示）の手順と、その行だけの表示にする前の表示の一時的な記憶を担う。判定・計算は`core/`の規則に従う。DOMに触れない。」依存は`model`（`getItems`・`setItemStates`だけ）・`editRecorder`。
    *   `toggleVisible(id)`・`toggleLocked(id)`：`resolveVisibleToggle`／`resolveLockToggle`が`null`なら`false`。それ以外は`beginEdit` → `setItemStates([変更])` → `commitEdit()`（鍵なし）。
    *   `toggleSolo(id)`：`resolveSoloToggle`の`changes`が空なら何もせず`false`（記憶も変えない）。それ以外は記憶を置き換えてから同じ手順で1件。
    *   `forgetSolo()`：記憶を忘れる（キャンバスの切り替えで`ItemListWiring`が呼ぶ）。
    *   記憶は保存しない・履歴の対象にしない。取り消し・やり直しでは変わらない（次の`Alt`＋クリックで、今の表示に当たる控えを値から探すため）。
*   **`Alt`の扱い（確かめた結果）**：`AltKeyGuard`が`Alt`の単独の押下・解放の標準動作を抑えている（テキスト入力中を除く）。`KeyboardShortcuts`は`Alt`の間は一致しない。`InputTracker`はキャンバスの上の押下だけを見る。アイコンは`<span>`で、`Alt`＋クリックの標準動作（リンクの保存等）が無いが、`click`で`preventDefault()`も呼ぶ。名前の欄の編集中に`Alt`を押した場合は`AltKeyGuard`が`keydown`を抑えないが、アイコンの`mousedown`で欄が確定されてフォーカスが外れ、`keyup`は抑えられる。

### 一覧の見た目とアイコン（要件1）
*   **`ItemRowRules.buildItemRows`**：行に`visible`・`locked`・`hiddenByAncestor`・`lockedByAncestor`・`hidden`を足す（`collectItemStates(items)`を1回求め、idで引く。受け継ぐ計算を書かない）。**`resolveRowViews`**：同じ5つをそのまま見た目の材料へ渡す。ほかの項目は変えない（既存のテストは項目ごとに比べているため値は変わらない）。
*   **`ItemListRules`**：
    *   `STATE_ICON`＝`Object.freeze({ VISIBLE: 'visible', LOCK: 'lock' })`、`STATE_ICON_ACTION`＝`Object.freeze({ NONE: 'none', TOGGLE_VISIBLE: 'toggleVisible', SOLO: 'solo', TOGGLE_LOCK: 'toggleLock' })`。
    *   `resolveStateIconAction({ icon, hasAlt, isDragging, isRowDragging, isLocked, hasDraft })`：`isDragging`（キャンバスの左ドラッグ・パン）・`isRowDragging`・`isLocked`・`hasDraft`（作成途中の図形がある）のどれかなら`NONE`。`icon`が`VISIBLE`なら`hasAlt`で`SOLO`、なければ`TOGGLE_VISIBLE`。`LOCK`なら（`Alt`によらず）`TOGGLE_LOCK`。未知の`icon`は`NONE`。操作モード・選択は見ない。
    *   `canStartRowDrag`へ省ける引数`isOnStateIcon`（既定`false`）を足し、真なら始めない。
*   **`ItemListPanel`**（規則を持たない。importなしのまま）：
    *   すべての行の末尾に`<span class="item-row-states">`を置き、その中に`<span class="item-row-state item-row-eye" data-state-icon="visible">`・`<span class="item-row-state item-row-lock" data-state-icon="lock">`を作る（行の中の要素。`.item-list`の子には足さない。`tabindex`なし。`title`は目＝「表示/非表示（Alt+クリックでこの行だけ表示）」・鍵＝「ロック」）。
    *   `render`：行の`item-hidden`（`hidden`）、目の`is-off`（`!visible`）・`is-inherited`（`hiddenByAncestor`）、鍵の`is-on`（`locked`）・`is-inherited`（`lockedByAncestor`）を差分で書く。省かれた項目は表示・ロックなしとして扱う。
    *   名前の欄は、行の末尾ではなく名前の`<span>`の直後へ入れる（`entry.nameElement.after(input)`。アイコンが右端のまま崩れないため）。
    *   クリックの通知：設定に`onStateIconClick(id, icon, event)`（必須）を足す。`mousedown`で押したアイコンの要素を控え（無ければ`null`）、`onRowPress(id, event, isEditingRow, isOnStateIcon)`へ第4引数で渡す（通知自体は今までどおり行う。行のドラッグのclick抑止の残りを消すため）。`click`では控えを先に`null`へ戻し、**控えがある（押したのがアイコン）か、`event.target`がアイコンの中なら行のクリックにしない**。控えと`event.target`のアイコンが同じ要素のときだけ`event.preventDefault()`して`onStateIconClick`を呼ぶ（アイコンから引いて同じ行の名前の上で離しても選択が変わらない。このときの`click`の対象は共通の祖先の`.item-row`なので、控えで見分ける）。名前・サムネイル等の上で押して同じ行のアイコンの上で離したときも、`click`の対象は`.item-row`で、控えは無い：アイコンは切り替わらず、**通常の行のクリックとして扱う**（今の、名前の上で押して三角の上で離したときと同じ。行の中で押して離した行のクリックなので問題は無い。3px以上動いて行のドラッグになった場合の`click`は、今までどおり抑止される）。`event.target`がアイコンの中で控えが無いのは、押下を伴わない`click`だけで、何もしない。`mousedown`は今までどおり`preventDefault()`しない。ダブルクリックは名前の`<span>`だけを見る今の判定のまま（アイコンでは始まらない）。
*   **`index.html`のCSS**：絵はデータURIのSVG（`background-image`。外部ファイル・文字・絵文字を使わない）で、4つ（開いた目・閉じた目・**本体を塗りつぶした**閉じた錠・**線だけの**開いた錠。16×16のviewBox、色は濃い灰色1色）。`.item-row-states`は`flex: none; display: flex; align-self: stretch;`、アイコン1つは幅20px・高さは行いっぱい（`position: relative`）・絵は16pxで`::before`に描く（不透明度は`::before`だけに掛ける）。不透明度は、目（開・閉）と閉じた錠＝`1`、**開いた錠＝`.4`**。`is-inherited`は、形は自分の値のまま、目＝`.4`・閉じた錠＝`.5`・開いた錠＝`.2`にし、さらに`::after`で絵の下に短い点線（幅10px・1px・灰色。不透明）を出す。これで、ロックなし（線だけの錠・`.4`・点線なし）、上から受け継いだ自分のロックが切の錠（線だけ・`.2`・点線あり）、上から受け継いだ自分のロックが入の錠（塗りつぶし・`.5`・点線あり）、自分のロックだけの錠（塗りつぶし・`1`・点線なし）が、形・塗り・点線で見分けられる（うすさの差だけに頼らない）。`.item-row.item-hidden`の`.item-row-name`・`.item-row-thumbnail`・`.item-row-folder-icon`は`opacity: .4`。一覧の幅・行の高さは変えない。
*   **`ItemListWiring`**：依存に`itemStateEditor`を足す。`#handleStateIconClick(id, icon, event)`＝`consumeSuppressedClick()`が真なら終わり → 行が今あるか（`buildItemRows`）→ `resolveStateIconAction({ icon, hasAlt: event.altKey === true, isDragging, isRowDragging: this.#rowDrag.isActive(), isLocked, hasDraft: model.getDraftShape() !== null })` → `toggleVisible`／`toggleLocked`／`toggleSolo` → `sync({ allowScroll: false })`。`#anchorId`・選択・描き込む先・ツール・折りたたみ・ホバーに触れない。`canvasLibrary.onChange`の`openCanvasId`が変わった枝で`itemStateEditor.forgetSolo()`を呼ぶ。`canStartRowDrag`へ`isOnStateIcon`を渡す。
*   **`main.js`**：`// 7.15.`で`new ItemStateEditor({ model, editRecorder: historyManager })`を作り渡す。

### 書き出し（要件9）: `io/SpriteSerializer`
*   `serialize(values)`の`elements`を`listVisibleShapes(toItems(values))`から求める（`bounds`はその`elements`から）。`source`は`DocumentSerializer.serialize(values)`のまま。`listShapes`のimportはやめる。版・キーの並びは変えない。すべて隠れているときは`elements: []`・`bounds: null`。
*   `computeShapesBounds`・`computeShapesGeometryBounds`（図形の配列を受ける）は変えない。

### 要件10: 既存のテストで直すもの（これ以外の既存の件は1件も変えない）
計画時に、設計どおりの試作で`node --test`を実行して洗い出した（試作はリポジトリの外。偽のモデルに照会を足した後に落ちたのは下の21件だけ＝`PathCornerEditor.items` 3・`TransformInputEditor.items` 3・`PathJoiner.items` 4・`EndpointSnapper.items` 6・`SpriteSerializer.items` 3・`ClipboardController.items` 2）。どれも「隠れている・ロックされているものを変えられる」ことを前提にした入力で、要件5・6・9により結果が変わる。**理由の無い変更をしない**。
*   **偽のモデルに照会を足すだけ（値は変えない）**：
    *   `test/edit/PathJoiner.test.js`の`setupFake`へ`getEditableSelectedShapes`（`selectedIds`に含まれる`shapes`）。
    *   `test/edit/EndpointSnapper.test.js`の`setupFake`・`setupFakeDrawing`へ`getEditableShapes: () => shapes`。
    *   `test/edit/StyleEyedropper.test.js`の偽のmodel（`setupFake`と、コンストラクタの例外の2か所）へ`getEditableShapes`。
*   **入力だけを変える（確かめている値・式は変えない）**：
    *   `test/edit/PathCornerEditor.items.test.js`：`nestedItems`のフォルダ・パスを表示あり・ロックなし（`true, false`）、外の矩形を`false, true`へ入れ替える（落ちる3件：角の切り替え、区間の切り替え（曲線に）、区間の切り替え（直線に））。「別のフォルダの2つのパス」の件も、甲組・P甲を`true, false`へ（落ちないが、2つとも切り替わることを確かめ続けるため）。
    *   `test/edit/TransformInputEditor.items.test.js`：`nestedItems`のフォルダ・矩形を`true, false`、外の線はそのまま（落ちる3件：幅・高さ・角度。反転の2件も同じ入力を使う）。
    *   `test/edit/PathJoiner.items.test.js`：「結合（閉じる）」のP名を`true, false`。
    *   `test/edit/EndpointSnapper.items.test.js`：「描き足し」「描き足し（続けて引いて終える）」のA線を`true, false`、「閉じる」「端点のドラッグでの閉じる」の甲組・P名を`true, false`。
    *   `test/io/SpriteSerializer.items.test.js`：`makeItems`に表示なしを含めるかの引数を足し、`elements`・`bounds`の3件（素の配列との一致・`toDrawElement()`の並び・文字どおりの期待値）だけ、表示なしを含めない入力にする。ほかの件は今の入力のまま。先頭の責務の「表示…が効かないこと」を「名前・ロックが効かないこと」へ直す。
*   **値を変えざるを得ないもの（入力の変更に合わせて、`visible`・`locked`等の期待値が変わる）**：
    *   `test/edit/PathJoiner.items.test.js`：「結合（2本）：奥の線（基準）の…」「結合（2本）：手前の線が…」「結合（2本）：除かれた側が別のフォルダ…」の3件＝甲組・A線・奥を`true, false`へ（C線の`true, true`はそのまま）。期待値の`visible: false, locked: true`が`visible: true, locked: false`になる。
    *   `test/edit/EndpointSnapper.items.test.js`：「描いた線での2本の結合」「端点のドラッグでの結合」の2件＝甲組・A線を`true, false`へ。期待値の同じ箇所が変わる。
    *   `test/edit/ClipboardController.items.test.js`：「duplicateInPlaceWithinEdit（Alt+ドラッグの複製）」＝選ぶ図形を`A`から`B`（表示あり・ロックなし）へ。期待値の名前等が`乙`・`true`・`false`になる。「cut→paste」＝同じく`B`へ。期待値が`乙`・`true`・`false`・x座標`20`になる。
    *   件名の言葉が入力と合わなくなる件（`TransformInputEditor.items`の「反転（縦）: 非表示・ロックの図形でも…」等）は、件名だけを合わせてよい。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`・`./js/edit/`・`./js/io/`・`./js/palette/`・`./js/wiring/`・`./js/`（`main.js`）・`./index.html`・`./test/`
*   **関連する論理クラス**: 新規＝`core/ItemStateRules`・`core/RemovalRules`・`core/SoloVisibilityRules`・`edit/ItemStateEditor`。更新＝`core/VectorModel`・`core/ItemRowRules`・`core/ItemListRules`・`core/InputTracker`・`edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/TransformInputEditor`・`edit/ShapeExtentReader`・`edit/PathJoiner`・`edit/ShapeStyleEditor`・`edit/StyleEyedropper`・`edit/GroupEditor`・`edit/ClipboardController`・`edit/EndpointSnapper`・`io/SpriteSerializer`・`palette/ItemListPanel`・`wiring/ItemListWiring`・`main.js`

### 参照する責務
*   **依存方向**：`main.js → wiring → palette / edit / core`、`main.js → edit → io → core → shapes`の一方向。`core/`は`edit/`・`io/`・`palette/`・`wiring/`をimportしない。`palette/`は何もimportしない。`edit/`から`core/`へは状態を持たない規則の関数だけをimportし、`VectorModel`・`HistoryManager`は注入で受け取る。`io/`がimportするのは`io/`内と`core/`の状態を持たない規則だけ。循環importは無い。
*   **`VectorModel`**：アイテムの入れ子`#items`・選択・描き込む先等の唯一の持ち主と更新通知。計算は規則のファイルへ渡す。平らな図形はキャッシュしない。入れ子を変える公開操作は`rearrangeItems`の1つのまま。
*   **`core/`の規則のファイル**：状態・DOMを持たない関数。引数を書き換えない。図形は不透明に扱い`id`だけを読む（`GroupTreeRules.itemIdOf`が種類で分ける唯一の箇所）。
*   **`InputTracker`**：入力の解釈とModelへの反映。規則・計算・新しい状態を持ち込まない。記録先へは`beginEdit`・`commitEdit`だけ。削除の受理は`deleteSelection()`の1か所で、戻り値の`true`は「受理して削除を呼んだ」。
*   **`edit/`のクラス**：1件の編集操作の手順（`beginEdit` → 変更 → `commitEdit`）。何も変えないときは記録先に一切触れない。操作モードを解釈しない。DOMに触れない。`try/catch`を持たない。
*   **`ShapeExtentReader`**：外枠の照会だけ（対象の図形の絞り込みだけを持つ）。`main.js`の`// 4.`と`DisplayWiring`の2か所で生成される。
*   **`ItemListPanel`**：行のDOMの差分の反映と通知だけ。図形・`VectorModel`・`InputTracker`・`HistoryManager`を知らない。行の要素はidごとに持ち回る。編集中の行の要素をDOMの中で動かさない。`.item-list`の子は行だけ。`mousedown`を`preventDefault()`しない。
*   **`ItemListWiring`**：購読・生成・注入と、規則の結果を渡す橋渡し。判定・計算を書かない。
*   **`main.js`**：生成・注入・同期の配線。判定・計算を書かない。
*   **`CanvasManager`**：渡された図形の配列を描くだけ（隠れた図形を渡さなければ、アウトライン表示・ホバーの強調も出ない。`hoveredId`が配列に無い図形なら何も描かない）。
*   **`SpriteSerializer`**：`elements`・`bounds`・`source`の組み立て。`source`は`DocumentSerializer.serialize(values)`の戻り値そのもの。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**：構成図に`core/ItemStateRules.js`・`core/RemovalRules.js`・`core/SoloVisibilityRules.js`・`edit/ItemStateEditor.js`と対応するテスト。`index.html`の行にアイコンのCSS。「存在しないもの」の表示・ロックの項（Phase 11-01・11-02・11-04a・11-04bの「値を持つだけ」「目・鍵のアイコンと表示・ロックの値を効かせること」）を、Phase 11-05で入ったこと・やらないと決めたこと（REQの「今回やらないこと」）へ直す。「フォルダ分割の方針」「依存方向」（規則どうしのimport・`edit/ → core/`の例外に`ItemStateEditor`・`GroupEditor`・`ClipboardController → RemovalRules`・`io/SpriteSerializer → core/ItemStateRules`を足し、ファイルの数を直す。`GroupEditor`から`removeItems`を外す）。
*   **2章**：「アイテム（item）」の表示・ロック（受け継ぎ・変えられる・持ち主・`setItemStates`・見る場所）。書き出し形式の`elements`・`bounds`（見えている図形だけ）と`source`（全部）の関係（`source`の項・描画要素の項・外枠`bounds`の項）。選択状態（変えられないものも選べる・頂点の選択は変えられる図形だけ）。保存しないもの（その行だけの表示の記憶）。
*   **3章**：2.（描く図形・頂点のハンドル・外枠）・3.（当たり分類・範囲選択・本体ドラッグ・`Alt`＋ドラッグ・削除の受理・スポイト）・6.（削除・表示とロックの切り替えの記録）・7.（切り取り・`Alt`＋ドラッグの写すもの）・9.（書き出し）・11.・12.（変えられる図形だけ・`#toUsableSnap`）・13.・15.（⛶・大きさの表示）・16.（全選択・反転・スポイト・複製）・18.・19.・20.・21.・25.・26.・27.（対象が変えられるものだけ）・28.（アイコン・行の見た目・押下の扱い・その行だけの表示）。
*   **4章の一覧と`_doc/arch/`**：新規`63_ItemStateRules.md`・`64_RemovalRules.md`・`65_SoloVisibilityRules.md`（`ItemStateEditor`は`14_edit.md`）。更新`01`・`02`・`03`・`06`・`13`・`14`・`15`・`16`・`18`・`36`・`38`・`46`・`47`・`48`・`53`・`57`（`removeItems`の使う側）・`58`（使う側）・`61`・`62`（`findItemLocation`の使う側に`SoloVisibilityRules`）。`main.js`・`InputTracker.js`の行数、テストの件数を実測して直す。
*   **既知の言葉の残り**：`shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`のJSDocの「`model.getShapes()`の並び」は、`shapes/`を変えないため残る（渡るのは変えられる図形の並び）。資料の側に書く。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・引数・戻り値・typedef、意味が変わった既存のJSDocと先頭の責務・importの記述・「`model`は…だけを使う」の記述）が無いことを確認する。(b) `node --test`が全件合格することを確認する。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』欄へ追記する。(e) 行末を実測して保つ。(f) 既存のテストは「要件10」に挙げた箇所だけを直す。

*   [x] タスク1: 表示・ロックの規則
    *   **対象ファイル** :
        *   `./js/core/ItemStateRules.js` :（新規）
        *   `./test/core/ItemStateRules.test.js` :（新規）
    *   **作業内容** :
        *   「共通の計算: `core/ItemStateRules`」のとおり、typedef`ItemState`・`listItemStates`・`listVisibleShapes`・`listEditableShapes`・`collectEditableIds`・`collectItemStates`・`resolveVisibleToggle`・`resolveLockToggle`・`applyItemStates`をJSDoc付きで作る。
        *   テスト：自分だけ・親だけ・両方・深い入れ子・兄弟に効かない・空のフォルダ・値が無いアイテム・隠すとロックの組み合わせ、中のものの値が書き換わらないこと、並びが重なり順のまま、切り替え（図形・フォルダ・無いid・値が無いアイテム）、`applyItemStates`（複数・片方だけ・変わらなければ同じ参照・無いid・真偽値でない値・通り道でないフォルダは同じ参照・引数を書き換えない・図形インスタンスの共有・`collapsed`等のほかのキーが残る）。

*   [x] タスク2: 消えるもの・残すもの・写すものの規則
    *   **対象ファイル** :
        *   `./js/core/RemovalRules.js` :（新規）
        *   `./test/core/RemovalRules.test.js` :（新規）
    *   **作業内容** :
        *   「共通の計算: `core/RemovalRules`」のとおり、`resolveRemoval`をJSDoc付きで作る。
        *   テスト：すべて変えられる（今の`removeItems`・`pickItems`と同じ結果）、ロックした図形・隠した図形が混ざるフォルダ（フォルダと残ったものが残る・写しは変えられるものだけ）、入れ子の一部だけ消える、ロックしたフォルダ・隠したフォルダ（上から受け継ぐ）は何も消えない、空のフォルダ（変えられる＝消える・変えられない＝残る）、変えられないものだけのフォルダの中の空のフォルダ、写しの無いまとまりが`copyUnitIds`に入らない、まとまりの外のフォルダが空になっても残る、何も消えないと`null`、まとまりが空で`null`、写しの名前・折りたたみ等が元と同じ、引数を書き換えない。

*   [x] タスク3: その行だけの表示の規則
    *   **対象ファイル** :
        *   `./js/core/SoloVisibilityRules.js` :（新規）
        *   `./test/core/SoloVisibilityRules.test.js` :（新規）
    *   **作業内容** :
        *   「その行だけの表示（要件8）」の規則の部分のとおり、typedef`SoloDisplay`・`SoloMemory`・`resolveSoloToggle`をJSDoc付きで作る。
        *   テスト（`applyItemStates`で変更を当てながら確かめる）：いちばん外側の図形・フォルダの中の図形・フォルダの行・入れ子のフォルダ、上のフォルダが隠れていた行、中のものの値を変えない、もう一度で戻る、間にほかの行（兄弟・親のフォルダ・別のフォルダの中）を挟んでもはじめの前へ戻る、間に目の切り替えがあると新しく始まる、取り消しに当たる値の戻し（はじめの前へ）の後に目を切り替えると新しく始まる、戻した後に取り消した（＝その行だけに戻った）ときもう一度で戻る、A→Bの後に取り消してAだけに戻ったとき（Aをもう一度＝全部表示ではなくはじめの前へ戻る・Bをもう一度＝Bだけになり、次のBではじめの前へ戻る・間に増えた行があっても同じ・目を切り替えてどの控えとも違う表示なら新しく始まる）、フォルダ→その中の行と移った後に中の目だけを切り替えてから外の行を押すと新しく始まる、当たる控えは無いが押した行がその行だけの表示で要る分を覚えている（手で作った表示・記憶が置き換わった後の取り消し。はじめの前へ戻る）、その行だけにしたフォルダの中ではじめからその行だけだった行（はじめの前へ戻る）、増えた行（兄弟・行の中）がそのまま、消えた行があっても戻る、行が別のフォルダへ動いた、記憶なしでその行だけの表示（全部表示になる。入れ子の中の非表示も表示になる）、行が1つだけで変わるものが無い、覚えている表示はあるが戻すものが無いとき変更なし（A表示・B非表示で始め、B→A→もう一度A＝`changes`が空で`memory`も変わらない）、覚えている表示に要る分が無い（その行だけの表示だが、当たる控えが無く、別のフォルダの中の覚えていない行）とき全部表示、無いid、引数・`memory`を書き換えない。

*   [x] タスク4: VectorModelの照会と値を変える操作・頂点の選択
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./test/core/VectorModel.itemStates.test.js` :（新規）
        *   `./test/edit/PathCornerEditor.items.test.js` :（更新。「要件10」の入力だけ）
    *   **作業内容** :
        *   「`VectorModel`」のとおり、照会5つ・`setItemStates`・頂点の選択の絞り込みを足す。先頭の責務（3行以内）に表示・ロックの値の変更を含める。
        *   テスト：照会（入れ子・受け継ぎ・混ざったとき・それしか無いとき・すべて表示でロックなしのとき`getShapes`・選択と同じ）、`hasRemovableSelection`（混ざり・変えられないものだけ・空のフォルダ・選択なし）、`setItemStates`（通知1回・変わらなければ通知なし`false`・選択/選んでいるフォルダ/描き込む先/折りたたみ/作成途中の図形が変わらない・ホバーが変わらない）、頂点の選択（受理しない・隠す/ロックで外れる・フォルダで外れる・ロックしたフォルダの中へ`rearrangeItems`で外れる・ほかの図形の組は残る・解除しても戻らない）、`getShapes`・`getSelectedIds`・`isSelected`・`getItems`が全部を返す、`moveShapes`等が対象を減らさない、保存と復元（`replaceAllShapes(getItems())`）で値が保たれる。

*   [x] タスク5: 表示・ロックを切り替える編集操作
    *   **対象ファイル** :
        *   `./js/edit/ItemStateEditor.js` :（新規）
        *   `./test/edit/ItemStateEditor.test.js` :（新規）
    *   **作業内容** :
        *   「その行だけの表示（要件8）」の`ItemStateEditor`のとおり、`toggleVisible`・`toggleLocked`・`toggleSolo`・`forgetSolo`をJSDoc付きで作る（配線はタスク13）。
        *   テスト：偽の依存での呼び順、実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`で、切り替えが1件・取り消し/やり直しのJSONの一致・選択が残る・無いidで記録なし、`DocumentSerializer`の往復で保たれる（版4）、フォルダの切り替えで中の値が変わらない、`toggleSolo`の1件・もう一度で戻る・取り消しの後（A→Bと移って取り消し、Aをもう一度ではじめの前へ戻る）・`forgetSolo`の後（全部表示になる）・変わるものが無いとき記録なし（覚えている表示はあるが戻すものが無いときを含む。履歴の段数・記憶が変わらない）、スナップショットに記憶が入らない。

*   [x] タスク6: 移動・変形・外枠の対象
    *   **対象ファイル** :
        *   `./js/edit/NudgeEditor.js`・`./js/edit/PositionInputEditor.js`・`./js/edit/TransformInputEditor.js`・`./js/edit/ShapeExtentReader.js` :（更新）
        *   `./test/edit/EditableTargets.move.test.js` :（新規）
        *   `./test/edit/TransformInputEditor.items.test.js` :（更新。「要件10」の入力だけ）
    *   **作業内容** :
        *   洗い出しの表のとおり照会へ置き換える。`ShapeExtentReader`のJSDocの「見えない図形も含む」は意味を整理する（線も塗りも無い図形は今までどおり含む。隠れている図形は含まない）。
        *   テスト（新しいファイルに、4つのクラスと`ShapeAlignEditor`を通して）：変えられないものが混ざったとき変えられるものだけが動く・変形する・整列する、変えられないものだけのとき選んでいないときと同じ（`false`・記録なし・欄は空・外枠は`null`・整列は押せない）、フォルダから受け継いだとき、`getAllBounds`が隠れた図形を含まずロックした図形を含む・すべて隠れると`null`、外枠・大きさ・位置の値が変えられるものだけで決まる。

*   [x] タスク7: 結合・色と線と塗り・スポイトの対象
    *   **対象ファイル** :
        *   `./js/edit/PathJoiner.js`・`./js/edit/ShapeStyleEditor.js`・`./js/edit/StyleEyedropper.js` :（更新）
        *   `./test/edit/EditableTargets.style.test.js` :（新規）
        *   `./test/edit/PathJoiner.test.js`・`./test/edit/StyleEyedropper.test.js` :（更新。偽のモデルへ照会を足すだけ）
        *   `./test/edit/PathJoiner.items.test.js` :（更新。「要件10」の入力と値だけ）
    *   **作業内容** :
        *   洗い出しの表のとおり照会へ置き換える。`ShapeStyleEditor`の`#finishPreview`の`getShapes`は変えない（理由をJSDocに書く）。
        *   テスト：混ざったとき（色・太さ・有無・`D`・スポイトの反映・ピッカーのプレビューと確定が変えられるものだけ）、変えられないものだけのとき（直前に使った値だけが変わる・記録なし・パネルの表示が選択なしと同じ）、フォルダから受け継いだとき、プレビューの後にロックしても1件で記録し終える、スポイトが変えられない図形を拾わない、結合（変えられる2本＋ロック1本の選択は2本の結合になる・ロックした線と変えられる線の2本では結合できない・`canJoin`）。

*   [x] タスク8: 削除・切り取り・`Alt`＋ドラッグの複製
    *   **対象ファイル** :
        *   `./js/edit/GroupEditor.js`・`./js/edit/ClipboardController.js` :（更新）
        *   `./test/edit/EditableTargets.removal.test.js` :（新規）
        *   `./test/edit/ClipboardController.items.test.js` :（更新。「要件10」の入力と値だけ）
    *   **作業内容** :
        *   「共通の計算: `core/RemovalRules`」の使う側のとおりに直す。
        *   テスト：削除の残り方（混ざり・入れ子・空のフォルダ・受け継ぎ・何も消えない＝選択そのまま・記録なし）、1つでも消えると選択が空・取り消し1回で戻る、切り取り（写るもの・元に残るもの・何も消えないとき`false`でクリップボードと段数が変わらない・貼り付けで形が戻る・残ったフォルダの中が描き込む先のときの貼り付け先）、`Alt`＋ドラッグ（変えられるものだけ写る・入る場所が写すまとまりの一番上のすぐ上・ロックしたフォルダの中のまとまりが一番上でもその中へ入らない・写ったものが`getEditableSelectedIds`に全部入る・変えられないものだけなら`false`）、コピー・複製（`Ctrl`+`D`）・並べ替え（`ShapeOrderEditor`）・まとめる・解除・行のドラッグの`moveTo`・名前の変更が変えられないものにも働き、写したものの表示・ロックが同じこと。

*   [x] タスク9: 端点への吸い付き
    *   **対象ファイル** :
        *   `./js/edit/EndpointSnapper.js` :（更新）
        *   `./test/edit/EndpointSnapper.itemStates.test.js` :（新規）
        *   `./test/edit/EndpointSnapper.test.js` :（更新。偽のモデルへ照会を足すだけ）
        *   `./test/edit/EndpointSnapper.items.test.js` :（更新。「要件10」の入力と値だけ）
    *   **作業内容** :
        *   「端点への吸い付き（要件6）」のとおりに直す。
        *   テスト：隠れた線・ロックした線・フォルダから受け継いだ線の端点に、描き始め・引いている途中・ドラッグのどれでも吸い付かない、奥の変えられる線の端点には吸い付く、`resolveDragEndpoint`が`null`、引き始めた線が途中で変えられなくなったとき`clickDrawnLine`・`finishDrawnLine`・`commitDrawnLine`で線が消えず新しい線として残る（`commitDrawnLine`は両方使えなければ`false`）、終わりの端点が変えられなくなったとき、始点への吸い付きは今のまま。

*   [x] タスク10: 入力・描画・削除ボタン・全選択・選択の反転
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新。洗い出しの表の置き換えと、その箇所のJSDocだけ）
        *   `./js/core/PointHitRules.js` :（更新。`shapes`の引数のJSDocだけ）
        *   `./js/main.js` :（更新。`renderCurrentState`・`syncDeleteButtonState`・`performInvertSelection`と、その箇所のJSDoc）
        *   `./test/core/EditableHit.test.js` :（新規）
    *   **作業内容** :
        *   洗い出しの表のとおり置き換える。`InputTracker`へ規則・状態・importを足さない。
        *   テスト（`InputTracker`と同じ受け渡しを、実物の`VectorModel`と規則の関数で行う。既存の`SelectionRules.test.js`の書き方）：`classifyPointHit`（隠れた・ロックした・受け継いだ図形を素通りして後ろに当たる・選ばれていても素通り・頂点のハンドルが当たらない）、`collectVertexHandles`・`collectVertexHandlesInRect`、範囲選択（`intersectsRect`）、全選択・選択の反転（一覧から選んだ変えられない図形が外れる）、`Ctrl`＋クリックで変えられない図形の選択が残る、描く図形（`getVisibleShapes`）、`collectScaleFrame`（変えられるものが無ければ出ない）、すべて表示・ロックなしの絵で今までと同じ。

*   [x] タスク11: 書き出し
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` :（更新。import・`serialize`とそのJSDoc）
        *   `./test/io/SpriteSerializer.visibility.test.js` :（新規）
        *   `./test/io/SpriteSerializer.items.test.js` :（更新。「要件10」の入力だけ）
    *   **作業内容** :
        *   「書き出し（要件9）」のとおりに直す。
        *   テスト：隠れた図形（自分・フォルダから）が`elements`・`bounds`に無く`source`にある、ロックした図形は含む、すべて隠れていると`elements: []`・`bounds: null`（図形0個と同じ。`source`は別）、版4・キーの並び、`CodeExporter`を通した往復で隠した図形と値が戻る、素の図形の配列は今までどおり、すべて表示の入力で今までと同じ、作業データの出力・コピーが全部を持つこと。

*   [x] タスク12: 行の見た目とアイコンの判定
    *   **対象ファイル** :
        *   `./js/core/ItemRowRules.js`・`./js/core/ItemListRules.js` :（更新）
        *   `./test/core/ItemRowRules.test.js`・`./test/core/ItemListRules.test.js` :（追加のみ）
    *   **作業内容** :
        *   「一覧の見た目とアイコン（要件1）」の規則の部分のとおりに足す（先頭の責務・importの記述も直す）。
        *   テスト：行と見た目の5つの項目（自分・フォルダから・深い入れ子・折りたたんだ中・空のフォルダ・値が無い）、`resolveStateIconAction`の全部の組み合わせの代表、`canStartRowDrag`の`isOnStateIcon`（省いたとき今のまま）。

*   [x] タスク13: 一覧のアイコン（部品・CSS・配線）
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./index.html` :（更新。一覧の行のCSSだけ）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/main.js` :（更新。`// 7.15.`の生成と注入だけ）
    *   **作業内容** :
        *   「一覧の見た目とアイコン（要件1）」の部品・CSS・配線の部分のとおりに作る。パネルは必須の設定が増えるため、配線と同じタスクで行う。
        *   DOMのテストは足さない（判定はタスク12でテスト済み）。

*   [ ] タスク14: 通しのテスト
    *   **対象ファイル** :
        *   `./test/edit/VisibilityAndLock.flow.test.js` :（新規）
    *   **作業内容** :
        *   実物の`VectorModel`・`HistoryManager`・`SnapshotAdapter`・各編集操作・`DocumentSerializer`・`SpriteSerializer`を組み合わせ、REQの確認項目2〜12に当たる流れ（隠す/ロック→選ぶ→混ざった操作→取り消し、フォルダの切り替えと戻し、許される操作、描き込む先が隠したフォルダの中のときに描く・貼り付ける＝入ったとたんに隠れる、その行だけの表示と取り消し、保存と復元、書き出し）と、すべて表示・ロックなしの絵での操作の結果が今までと同じことを確かめる。不具合が見つかったら直さず、5章へ書いて「質問:」で終える。

*   [ ] タスク15: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   『開発資料の更新予定』を確認し、1章・2章・3章・4章の一覧へ反映する。書く内容は実コードで確かめる。「表示・ロックは値を持つだけ」「効かない」という古い記述を残さない。行末を実測して保つ。

*   [ ] タスク16: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の`01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`13_palette.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`18_PointHitRules.md`・`36_DisplayWiring.md`・`38_VertexHandleRules.md`・`46_ItemTreeRules.md`・`47_ItemAttributeRules.md`・`48_ItemListRules.md`・`53_ItemListWiring.md`・`57_GroupTreeRules.md`・`58_GroupSelectionRules.md`・`61_ItemRowRules.md`・`62_ItemPlaceRules.md` :（更新）
        *   `./_doc/arch/63_ItemStateRules.md`・`64_RemovalRules.md`・`65_SoloVisibilityRules.md` :（新規）
    *   **作業内容** :
        *   『開発資料の更新予定』を確認して反映する。`main.js`・`InputTracker.js`の行数（02・06）とテストの件数（16）は実測して直す。書き換える前に各ファイルの行末（CRLF／LF）を実測し、保つ（ファイルごとに混在している）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 表示・ロックの規則
*   **作業内容** :
    *   `js/core/ItemStateRules.js`（新規・CRLF）に、typedef`ItemState`・`ItemStateChange`と、`listItemStates`・`listVisibleShapes`・`listEditableShapes`・`collectEditableIds`・`collectItemStates`・`resolveVisibleToggle`・`resolveLockToggle`・`applyItemStates`をJSDoc付きで作成。importは`ItemTreeRules`（`ITEM_KIND`）・`GroupTreeRules`（`itemIdOf`）のみ。
    *   `applyItemStates`：同じidの変更は後の値を優先して統合。現在の有効な値（`visible !== false`／`locked === true`）と同じ値への変更は「変わらない」とみなし、キーを足さず同じ参照を返す。
    *   `test/core/ItemStateRules.test.js`（新規・CRLF）に計画どおりの観点のテストを作成。`node --test`は tests 3408 / pass 3408 / fail 0。

### タスク2: 消えるもの・残すもの・写すものの規則
*   **作業内容** :
    *   `js/core/RemovalRules.js`（新規・CRLF）に typedef`RemovalResult`・`resolveRemoval(items, unitIds)`をJSDoc付きで作成。importは`ItemTreeRules`（`ITEM_KIND`）・`GroupTreeRules`（`itemIdOf`）・`ItemStateRules`（`collectEditableIds`）のみ。まとまり1つを分ける非公開`splitUnit`（図形：変えられれば消えて写す／フォルダ：自分が変えられ残る中身が無ければ消えて写す、それ以外は残る中身で残り写すものがあれば写す）と、まとまりの外のフォルダを再構築する処理。写しが1つも無ければ`null`。
    *   `test/core/RemovalRules.test.js`（新規・CRLF）に計画どおりの観点のテストを作成（`removeItems`・`pickItems`との一致を含む）。`node --test`は tests 3419 / pass 3419 / fail 0。

### タスク3: その行だけの表示の規則
*   **作業内容** :
    *   `js/core/SoloVisibilityRules.js`（新規・CRLF）に typedef`SoloDisplay`・`SoloMemory`と`resolveSoloToggle({ items, id, memory })`をJSDoc付きで作成。importは`GroupTreeRules`（`itemIdOf`）・`ItemPlaceRules`（`findItemLocation`）・`ItemStateRules`（`listItemStates`）のみ（先頭の責務の文言も実際のimportに合わせてある）。非公開の`buildTargets`（目標の値）・`findMatchingDisplay`（当たる控え）・`isSoloDisplay`（その行だけの表示か）。
    *   `resolveSoloToggle`：`memory`省略時は`null`。その行だけの表示で記憶が使えないときの「全部表示」は、記憶なしなら今ある行のうち非表示のもの全部を表示にする。変えるものが無い場合（行が1つだけ等）は`changes`が空で`memory`はそのまま（記憶なしなら`null`のまま）。
    *   `test/core/SoloVisibilityRules.test.js`（新規・CRLF）に計画どおりの観点のテスト29件（`applyItemStates`で変更を当てる）。`node --test`は tests 3448 / pass 3448 / fail 0。

### タスク4: VectorModelの照会と値を変える操作・頂点の選択
*   **作業内容** :
    *   `js/core/VectorModel.js`（LF）：`getVisibleShapes`・`getEditableShapes`・`getEditableSelectedShapes`・`getEditableSelectedIds`・`hasRemovableSelection`・`setItemStates`を追加（照会は`#items`から毎回求める）。`setSelectedVertices`・`#pruneSelectedVertices`は`collectEditableIds`を1回求めて、変えられる図形の組だけを受理・保持する。import（`ItemStateRules`・`RemovalRules`・`GroupSelectionRules.resolveSelectedUnitIds`）と先頭の責務（3行）・関連JSDocを更新。
    *   `test/core/VectorModel.itemStates.test.js`（新規・CRLF）：19件。照会・`hasRemovableSelection`・`setItemStates`・頂点の選択・全部を返す操作・保存と復元。
    *   `test/edit/PathCornerEditor.items.test.js`（LF）：「要件10」のとおり`nestedItems`のフォルダ・パスを`true, false`、外の矩形を`false, true`、「別のフォルダの2つのパス」の甲組・P甲を`true, false`へ。
    *   `node --test`は tests 3467 / pass 3467 / fail 0。

### タスク5: 表示・ロックを切り替える編集操作
*   **作業内容** :
    *   `js/edit/ItemStateEditor.js`（新規・CRLF）に`toggleVisible`・`toggleLocked`・`toggleSolo`・`forgetSolo`をJSDoc付きで作成。importは`ItemStateRules`（`resolveVisibleToggle`・`resolveLockToggle`）・`SoloVisibilityRules`（`resolveSoloToggle`）のみ。`model`は`getItems`・`setItemStates`だけ。非公開`#commit(changes)`＝`beginEdit` → `setItemStates` → `commitEdit`（鍵なし。戻り値は`setItemStates`の結果）。`toggleSolo`は`changes`が空なら何もせず`false`（記憶も変えない）、それ以外は`#soloMemory`を置き換えてから1件。
    *   `test/edit/ItemStateEditor.test.js`（新規・CRLF）：18件（偽の依存での呼び順6・実物での切り替え6・その行だけの表示6）。`node --test`は tests 3485 / pass 3485 / fail 0。

### タスク6: 移動・変形・外枠の対象
*   **作業内容** :
    *   `js/edit/NudgeEditor.js`（CRLF）・`PositionInputEditor.js`・`TransformInputEditor.js`（LF）：対象の取得を`getSelectedIds()`から`getEditableSelectedIds()`へ。JSDocの「`model`は…だけを使う」を直した（頂点のid引きの`getShapes`は変えず）。
    *   `js/edit/ShapeExtentReader.js`（LF）：選択の外枠3つを`getEditableSelectedShapes()`へ、`getAllBounds`を`getVisibleShapes()`へ。先頭の責務（3行）・クラスJSDoc・型・各メソッドのJSDocの「見えない図形も含む」を「線も塗りも無い図形は含む。隠れている・ロックされている図形は含まない（`getAllBounds`はロックされた図形を含み隠れた図形を含まない）」へ整理。
    *   `test/edit/EditableTargets.move.test.js`（新規・CRLF）：15件（混ざったとき・変えられないものだけ・フォルダから受け継いだとき・`getAllBounds`）。
    *   `test/edit/TransformInputEditor.items.test.js`（LF）：「要件10」のとおり`nestedItems`のフォルダ・矩形を`true, false`へ。件名「反転（縦）」と`nestedItems`のJSDocの言葉を入力に合わせた。
    *   `node --test`は tests 3500 / pass 3500 / fail 0。

### タスク7: 結合・色と線と塗り・スポイトの対象
*   **作業内容** :
    *   `js/edit/PathJoiner.js`（LF）：`#selectedShapesInOrder`を`model.getEditableSelectedShapes()`へ。先頭の責務・クラスJSDoc（「`model`は`getEditableSelectedShapes`・`replaceShape`だけ」・前提に「変えられない図形は無視」）・`canJoin`・`join`のJSDocを直した。
    *   `js/edit/ShapeStyleEditor.js`（LF）：`#selectedShapes`を`getEditableSelectedShapes()`へ。先頭の責務・クラスJSDoc（`model`の照会の列挙・対象は選択中で変えられる図形・変えられないものだけのときは選択なしと同じ）・`COLOR_ITEMS`・各メソッドのJSDocの「選択中の図形」を直した。`#finishPreview`の`getShapes()`は変えず、理由（プレビューの後に隠れた・ロックされても、変えられる間に付けた色を1件として記録し終える）をJSDocへ書いた。
    *   `js/edit/StyleEyedropper.js`（LF）：`pickFrom`を`getEditableShapes()`へ（変えられない図形なら`false`・待ち受けは続く）。`model`の型・クラスJSDoc・コンストラクタのJSDocを`getEditableShapes`へ直した。
    *   `test/edit/EditableTargets.style.test.js`（新規・CRLF）：11件（色・太さ・有無・`D`・ピッカー・塗り・変えられないものだけ（直前に使った値だけ変わる・記録なし・表示が選択なしと同じ）・フォルダから受け継ぎ・プレビュー後のロック・スポイト2件・結合3件）。
    *   `test/edit/PathJoiner.test.js`（mixed。直した行はLF/CRLFの周りに合わせてCRLF）・`StyleEyedropper.test.js`（LF）：偽のモデルへ`getEditableSelectedShapes`・`getEditableShapes`を足しただけ。`test/edit/PathJoiner.items.test.js`（LF）：「要件10」のとおり、甲組・A線・奥・P名を`true, false`へ、期待値の`visible`・`locked`を合わせた。
    *   `node --test`は tests 3511 / pass 3511 / fail 0。

### タスク8: 削除・切り取り・`Alt`＋ドラッグの複製
*   **作業内容** :
    *   `js/edit/GroupEditor.js`（CRLF）：`removeSelection`を`resolveRemoval`へ（まとまりが無い・`null`なら`beginEdit`も呼ばず`false`。それ以外は`rearrangeItems(nextItems, { selectedIds: [], selectedGroupIds: [] })`）。`removeItems`のimportをやめ`RemovalRules`を足した。importの記述・`removeSelection`のJSDocを直した。
    *   `js/edit/ClipboardController.js`（CRLF）：非公開`#pickRemovable()`を足し、`cut`・`duplicateInPlaceWithinEdit`だけがこれを使う（`copy`・`duplicate`は`#pickSelection()`のまま）。importの記述・`cut`・`duplicateInPlaceWithinEdit`のJSDocを直した。
    *   `test/edit/ClipboardController.items.test.js`（LF）：「要件10」のとおり、`duplicateInPlaceWithinEdit`と`cut→paste`の2件の選ぶ図形を`A`から`B`へ、期待値を`乙`・`true`・`false`（x座標`20`）へ。
    *   `test/edit/EditableTargets.removal.test.js`（新規・CRLF）：19件（削除7・切り取り4・`Alt`＋ドラッグ3・変えられないものにも働く操作5）。
    *   `node --test`は tests 3530 / pass 3530 / fail 0。

### タスク9: 端点への吸い付き
*   **作業内容** :
    *   `js/edit/EndpointSnapper.js`（LF）：`model.getShapes()`をすべて`getEditableShapes()`へ（照会・計画とも6か所）。非公開`#toUsableSnap(snap)`を足し、`commitDrawnLine`（`startSnap`・`endSnap`）・`clickDrawnLine`（同）・`finishDrawnLine`・`findDrawnLineSnap`（`startSnap`）の冒頭で通す。クラスJSDoc（`model`が使う照会に`getShapes`（判定だけ）・`getEditableShapes`が並ぶ記述・変えられる図形だけが対象の記述）・`findDrawSnap`・`resolveDragEndpoint`・`findDrawnLineSnap`のJSDocを直した。先頭の責務は変えていない。
    *   `test/edit/EndpointSnapper.test.js`（CRLF）：`setupFake`・`setupFakeDrawing`へ`getEditableShapes: () => shapes`を足しただけ。
    *   `test/edit/EndpointSnapper.items.test.js`（LF）：「要件10」のとおり、A線・P名・甲組を`true, false`へ、期待値の`visible`・`locked`を合わせた。
    *   `test/edit/EndpointSnapper.itemStates.test.js`（新規・CRLF）：6件（隠れ・ロック・フォルダ越しの吸い付き、ドラッグの解決・結合、引き始めた後でロックされたときの`finishDrawnLine`・`commitDrawnLine`・`clickDrawnLine`、もう無い図形はそのまま）。
    *   `node --test`は tests 3537 / pass 3537 / fail 0。

### タスク10: 入力・描画・削除ボタン・全選択・選択の反転
*   **作業内容** :
    *   `js/core/InputTracker.js`（CRLF）：洗い出しの表のとおり置き換えた。`deleteSelection`の受理＝`hasRemovableSelection()`、`selectAll`＝`getEditableShapes()`、拡大縮小・回転の控え＝`getEditableSelectedShapes()`（2か所）、本体ドラッグの移動＝`getEditableSelectedIds()`、頂点の範囲選択の図形・範囲選択の当たり・`#classifyPoint`の図形＝`getEditableShapes()`。ほかの箇所（`isSelected`・クリックの次の選択・id引き）は変えていない。規則・状態・importは足していない。該当のJSDoc（`deleteSelection`・`selectAll`・`#classifyPoint`・`#commitMarquee`・拡大縮小・回転の控え・本体ドラッグ）を直した。
    *   `js/core/PointHitRules.js`（LF）：`classifyPointHit`のJSDocだけ（`shapes`は`model.getEditableShapes()`の戻り値で、隠れた・ロックされた図形は渡されず素通りになる）。
    *   `js/main.js`（CRLF）：`renderCurrentState`の描く図形＝`getVisibleShapes()`、`collectVertexHandles`の図形＝`getEditableShapes()`（選択は`getSelectedIds()`のまま）、`syncDeleteButtonState`＝`!model.hasRemovableSelection()`、`performInvertSelection`の第1引数＝`getEditableShapes()`のid。3関数のJSDocを直した。
    *   `test/core/EditableHit.test.js`（新規・CRLF）：15件（当たり分類5・頂点のハンドルと範囲選択3・全選択／反転／Ctrl＋クリック4・描く図形と外枠3）。
    *   `node --test`は tests 3552 / pass 3552 / fail 0。

### タスク11: 書き出し
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`（CRLF）：`serialize`の`elements`を`listVisibleShapes(toItems(values))`から求め、`bounds`はその`elements`から（`source`は`DocumentSerializer.serialize(values)`のまま）。importは`listShapes`をやめ`ItemStateRules`の`listVisibleShapes`へ。`serialize`のJSDocを直した（見えている図形だけ・すべて隠れていれば空と`null`・`source`は全部）。先頭の責務は変えていない。
    *   `test/io/SpriteSerializer.visibility.test.js`（新規・CRLF）：12件（自分・フォルダから隠れた図形が`elements`・`bounds`に無く`source`にある、ロックは含む、すべて隠れると`elements: []`・`bounds: null`、版4・キーの並び、素の配列・すべて表示の入力で同じ、引数を書き換えない、`CodeExporter`を通した往復、作業データの出力が全部を持つ）。
    *   `test/io/SpriteSerializer.items.test.js`（LF）：要件10のとおり、`makeItems(shapes, withHidden = true)`を足し、`elements`・`bounds`の3件だけ`false`（表示ありの入力）にした。先頭の責務の「表示…が効かない」を「名前・ロックが効かない」へ直した。
    *   `node --test`は tests 3564 / pass 3564 / fail 0。

### タスク12: 行の見た目とアイコンの判定
*   **作業内容** :
    *   `js/core/ItemRowRules.js`（CRLF）：`ItemRow`・`RowView`のtypedefへ`visible`・`locked`・`hiddenByAncestor`・`lockedByAncestor`・`hidden`を足した。`buildItemRows`が`collectItemStates(items)`を1回求め、非公開`visitList`へ渡してidで引く（受け継ぐ計算は書かない）。`resolveRowViews`は5つをそのまま渡す。先頭の責務のimportの記述・JSDocを直した。
    *   `js/core/ItemListRules.js`（LF）：`STATE_ICON`・`STATE_ICON_ACTION`・`resolveStateIconAction`を追加。`canStartRowDrag`へ省ける`isOnStateIcon`（既定`false`）を足した。先頭の責務へ「目と鍵のアイコン」を足した。importは変えていない。
    *   `test/core/ItemRowRules.test.js`（CRLF）：11件追加（自分の切・入、フォルダから受け継ぎ、深い入れ子、折りたたんだフォルダ、空のフォルダ、値が無い、`resolveRowViews`、ほかの項目が変わらないこと）。`test/core/ItemListRules.test.js`（LF）：`canStartRowDrag`の`isOnStateIcon`2件・`resolveStateIconAction`5件を追加。
    *   `node --test`は tests 3582 / pass 3582 / fail 0。

### タスク13: 一覧のアイコン（部品・CSS・配線）
*   **作業内容** :
    *   `js/palette/ItemListPanel.js`（LF）：すべての行の末尾に`.item-row-states`（目`data-state-icon="visible"`・鍵`data-state-icon="lock"`、`title`付き）を足し、`render`が`item-hidden`・目の`is-off`・`is-inherited`・鍵の`is-on`・`is-inherited`を差分で書く（省かれた項目は表示・ロックなし）。設定に必須の`onStateIconClick(id, icon, event)`を足し（関数でなければ例外）、`mousedown`でアイコンの要素を控えて`onRowPress`の第4引数`isOnStateIcon`で渡す。`click`は控えを先に戻し、控えがある・`event.target`がアイコンの中なら行のクリックにせず、控えと同じ要素のときだけ`preventDefault()`して`onStateIconClick`を呼ぶ。名前の欄は`nameElement.after(input)`へ。先頭の責務・typedef・クラスJSDocを直した（importは無いまま）。
    *   `index.html`：一覧の行のCSSだけ。データURIのSVG4つ（開いた目・閉じた目・塗りつぶした閉じた錠・線だけの開いた錠。色`#444`）、`.item-row-states`・`.item-row-state`（幅20px・`::before`に16pxの絵）、不透明度（目＝1、閉じた錠＝1、開いた錠＝.4、`is-inherited`は目.4・閉じた錠.5・開いた錠.2）、`is-inherited`の`::after`の点線（幅10px・1px・`#888`）、`.item-row.item-hidden`の名前・サムネイル・フォルダの絵の`opacity: .4`。
    *   `js/wiring/ItemListWiring.js`（LF）：依存に`itemStateEditor`を足し、`#handleStateIconClick`（`consumeSuppressedClick`→行の有無→`resolveStateIconAction`→`toggleVisible`／`toggleSolo`／`toggleLocked`→`sync({ allowScroll: false })`。選択等に触れない）、`canStartRowDrag`へ`isOnStateIcon`、`openCanvasId`が変わった枝で`forgetSolo()`。責務・コンストラクタのJSDocを直した。
    *   `js/main.js`（CRLF）：`ItemStateEditor`のimportと、`// 7.15.`で`new ItemStateEditor({ model, editRecorder: historyManager })`を作って渡すだけ。
    *   `node --test`は tests 3582 / pass 3582 / fail 0（DOMのテストは足していない）。

### タスク14: 通しのテスト
*   **作業内容** :

### タスク15: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :

### タスク16: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :

## 5. 懸念事項・要確認ポイント
*   **タスク13の目視確認**：目・鍵のアイコンの絵（開閉の目・塗りつぶし／線だけの錠・上から受け継いだ点線・隠れた行のうすさ）がブラウザで意図どおり見えること、アイコンの上で押してもドラッグが始まらず行の選択が変わらないこと、`Alt`＋クリックでその行だけの表示になること、名前の編集中（欄が名前の直後）でもアイコンが右端のままであること。SVGの絵は計画の記述から作った案で、見た目の調整は発注者の目視が要る。
*   **タスク7の目視確認**：ロックしたフォルダの図形を選んだままオプションバーで色・太さを変えても図形が変わらず、次に描く図形の初期値だけが変わること。ピッカーを開いたまま一覧でロックしても、閉じたときに1件で記録されること（`ShapeStyleEditor#finishPreview`だけ`getShapes()`＝全部を見る。将来`getEditableShapes()`へ寄せると、プレビュー中にロックした色が戻らなくなる）。
*   **その行だけの表示の「覚えている行」**（計画の判断）：覚えるのは、「その行だけ」にしたことで変わり得る行（その行・上のフォルダ・それぞれの兄弟）のはじめの前の値。その間に、その行の中のもの・非表示にしたフォルダの中のものの目を切り替えた場合、それが覚えている行でなければ、戻したときもその切り替えは残る（「その行だけの表示」かどうかの見分けにも入らないため）。
*   **その後に増えた行**（計画の判断）：「その行だけ」にした後に描いた図形は、兄弟でも「間に表示が変わった」とみなさない（REQの「その後に増えた行はそのまま」を成り立たせるため）。増えた行を`Alt`＋クリックすると、その行だけの表示に移り、もう一度ではじめの前の表示に戻る。
*   **戻した後の記憶**（計画の判断）：戻しても記憶は消さない（戻すのを取り消してから、もう一度`Alt`＋クリックしたときに戻れるようにするため）。忘れるのはキャンバスの切り替えだけ。古い記憶は、次のとおり今の表示の値から使うかを決め、使わなければ次の`Alt`＋クリックで置き換わる。
*   **覚えている表示を使う条件**（計画の判断。REQの「今の表示の値から見分ける」による）：記憶に「その行だけ」にした直後の表示の控えを、はじめから並べて持つ。
    *   押した行が「その行だけの表示」なら、今の表示が控えのどれかに当たるか、押した行に要る分（目標の行すべて）を覚えていれば、はじめの前へ戻す。A→Bと移った後に取り消してAだけになったときも、Aをもう一度ではじめの前へ戻る。要る分を覚えていないときは「覚えている表示が無い」とみなし、全部の行を表示にする。
    *   押した行が「その行だけの表示」でなければ、今の表示が控えのどれかに当たるとき（取り消しで前の控えに戻ったときを含む）は記憶を保ち、当たらないときは今の表示を「はじめの前」として新しく始める。A→Bの後に取り消してからBを押したときは保つ（Aだけにした後でBを押したのと同じ表示のため）。はじめの前まで取り消したときは新しく始める（覚える値は同じ）。
    *   手で目を切り替えて控えと同じ表示に戻したときも、値からは区別できないため、控えに当たるとみなす。
*   **戻すものが無いとき**（REQの文言どおり）：はじめの前の表示が今の表示と同じとき（はじめからその行だけの表示だった行へ、ほかの行を経て移ったとき等）は、もう一度`Alt`＋クリックしても何も起きず、履歴にも入らない。全部の行を表示にするのは、覚えている表示が無いときだけ。
*   **兄弟の無い行**（REQの文言どおり）：いちばん外側に行が1つだけのとき等、はじめから「その行だけの表示」になっている行を、覚えている表示が無いまま`Alt`＋クリックすると、全部の行が表示になる（中の非表示も表示になる）。取り消し1回で戻る。
*   **親のフォルダの`Alt`＋クリック**：フォルダの中の行を「その行だけ」にした直後は、上のフォルダも「その行だけの表示」に当たるため、上のフォルダを`Alt`＋クリックすると、はじめの前の表示に戻る。
*   **選択の反転**：一覧から選んだ変えられない図形は、`Ctrl`+`I`・`Ctrl`+`A`で選択から外れる（選ばれるのは変えられる図形だけのため）。
*   **結合の後の選択**：変えられない図形を一緒に選んで結合すると、今までどおり結果だけが選ばれる（変えられない図形の選択は外れる）。
*   **一覧の行のホバー**：ロックされた図形の行にカーソルを置くと、今までどおりキャンバスで強調される（キャンバスの上では強調されない）。隠れている図形は描かれないので出ない。
*   **引き始めの線が途中で変えられなくなったとき**（線を引いている途中の行のドラッグ）は、つながらず新しい線として残す（捨てない。計画の判断）。
*   **`is-inherited`等の不透明度・点線の印・アイコンの絵（閉じた錠は塗りつぶし・開いた錠は線だけ）**は計画で決めた値（発注者の目視で調整する）。
*   `test/edit/PathJoiner.test.js`は行末が混在している（計画前から）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。塗りのボタン（🪣）をONにし、色の違う塗った図形を8つほど、少しずつ重ねて描く。描き終えたら`V`（選択）にし、いくつか選んで`Ctrl`+`G`でフォルダを2つ作る（1つは、フォルダの行を押し、`Ctrl`を押しながら図形の行を押して`Ctrl`+`G`＝入れ子）。
1.  **アイコン**：どの行にも目と鍵が右端に縦に揃って出る（ロックなしの鍵はうすい開いた鍵）。深い行・長い名前（省略される）・名前の編集中（名前のダブルクリック）でも崩れない。押しても（ダブルクリックしても）選択・ツール・折りたたみが変わらず、行のドラッグも名前の編集も始まらない。アイコンを押したまま動かしても行のドラッグにならず、アイコンの外で離すと何も起きない（アイコンの外で押してアイコンの上で離しても、アイコンは切り替わらない）。描くツールでも押せる（描き込む先の印は変わらない）。直線を引いている途中は、押しても何も起きない。
2.  **隠す**：目を押すと図形が消え、行の名前とサムネイルがうすくなり、目が閉じた形になる。`V`でキャンバスのその場所をクリック・範囲選択しても選べず、後ろの図形が選べる。アウトライン表示（`Z`）でも出ない。もう一度押すと戻る。隠した直後に`Ctrl`+`Z` 1回でも戻る。
3.  **ロック**：鍵を押すと、はっきりした閉じた鍵になる。`V`でその図形のクリック・範囲選択は素通りし、後ろの図形が選べる（後ろに何も無ければ、今までどおり選択が外れる）。一覧の行からは選べるが、外枠が出ず、矢印キーで動かない・位置と大きさの欄は空・`Delete`で消えない・ツールバーの削除ボタンは押せない。色を変えると、その図形は変わらず、次に描く図形の色だけが変わる。
4.  **フォルダ**：フォルダの行の目・鍵を押すと、中のすべてが隠れる・ロックされる。中の行のアイコンは自分の形のまま、うすくなって下に短い点線が付く（フォルダをロックしたとき、中の行の鍵は、ただのロックなしの鍵とも、自分でロックした鍵とも見分けが付く）。中の1つを先に隠してからフォルダを隠し、フォルダを戻すと、その1つは隠れたまま。
5.  **混ざった操作**：フォルダの中の図形を1つロックし、`V`でフォルダの行を押して選ぶ。外枠はロックしていない図形だけを囲む。ロックしていない図形の本体を引いて動かす・外枠のハンドルで拡大縮小する・色を変えると、ロックしていない図形だけが変わる。`Delete`で消すと、ロックした図形とフォルダが残り、選択は空になる。`Ctrl`+`Z`で戻して`Ctrl`+`X`でも同じ（その後`Ctrl`+`V`で、消えた分がフォルダの形で貼り付く）。それぞれ`Ctrl`+`Z` 1回で戻る。`Alt`＋ドラッグでは、ロックしていない図形だけが写って動く。
6.  **許される操作**：`V`で一覧からロックした図形・隠した図形を選び、並べ替え（`Home`・`PageUp`等、行のドラッグでの出し入れ）・`Ctrl`+`G`・`Ctrl`+`Shift`+`G`・名前の変更・`Ctrl`+`C`→`Ctrl`+`V`・`Ctrl`+`D`ができる。写したものも、ロック・非表示のまま（隠したものはキャンバスには見えず、一覧に行が増える）。
7.  **全選択など**：`V`で`Ctrl`+`A`・`Ctrl`+`I`を押しても、隠した図形・ロックした図形は選ばれない（一覧で選んでいたロックした図形は、`Ctrl`+`I`で選択から外れる）。
8.  **端点**：直線を2本引き、1本をロックする（もう一度は隠す）。直線のツールでその端に近づけても吸い付きの四角が出ず、つながらない。もう1本の端には今までどおり吸い付く。`A`（頂点の選択）で、もう1本の端の頂点を引いて近づけても吸い付かない。
9.  **頂点**：`A`で図形を選び、頂点を1つ選んでから、一覧でその図形をロックすると、頂点のハンドルが消える。ロックを外すと、ハンドルは出るが、頂点は選ばれていない。
10. **その行だけ**：目を`Alt`＋クリックすると、その行だけが見える（その行の上のフォルダは表示、ほかの行は非表示）。もう一度`Alt`＋クリックすると元に戻る。間にほかの行を`Alt`＋クリックしても、そこでもう一度押せば、はじめの表示に戻る。1つめの行→2つめの行と`Alt`＋クリックしてから`Ctrl`+`Z`で1つめだけの表示に戻し、1つめをもう一度`Alt`＋クリックしても、はじめの表示に戻る。いちばん外側の1つの図形だけを目で表示にして（ほかはすべて非表示）から、キャンバスを切り替えて戻ると（覚えている表示を忘れさせるため）、ほかの行を`Alt`＋クリックした後でその図形の行を`Alt`＋クリックし、もう一度`Alt`＋クリックしても何も変わらない。フォルダの中の行でも、フォルダの行でも同じ。それぞれ`Ctrl`+`Z` 1回で戻る。`Alt`を離しても、ブラウザのメニューへ移らない。キャンバスを切り替えて戻ってくると、はじめの表示は忘れている（その行だけの表示のまま`Alt`＋クリックすると、全部が表示になる）。
11. **描き込む先**：`V`でフォルダの行を押して選び、そのフォルダの目を押して隠してから、描くツールに持ち替えて描く（描き込む先の印はフォルダの行に出たまま）。描き終えると、図形はフォルダの中に入って隠れる（一覧に行が増える）。ロックしたフォルダでも同じ（描いた図形は見えるが、クリックで選べない）。
12. **保存と書き出し**：少し待ってからページを開き直しても、表示・ロックが保たれる。出力（エンジン用）のJSを確認用ページ（`sprite-check.html`）で見ると、隠した図形は出ず、ロックした図形は出る。そのJSを開く（ファイル）で開くと、隠した図形も、表示・ロックの値も戻る。⛶は見えている図形（ロックしたものを含む）に合う。すべて隠すと⛶は最初の表示に戻るのと同じになる。
13. **ほかが今までどおり**：何も隠さず・ロックしない絵で、描く・選ぶ・動かす・変形・色・整列・一覧・コピー・保存・書き出しが今までどおり動く。
*   **タスク8の注意**：テストの組み立てで`ShapeInserter`に`insertsAtTarget: true`（main.jsと同じ）を渡さないと、`Alt`＋ドラッグの複製の`place`（写したまとまりのすぐ上）が効かず末尾へ入る。貼り付けは描き込む先（残ったフォルダの中なら、そのフォルダのすぐ上）へ入るため、切り取り直後の貼り付けの位置は、元の末尾とは限らない。
