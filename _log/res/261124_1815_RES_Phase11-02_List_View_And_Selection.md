# RES: 作業計画・作業レポート (Phase 11-02) : 図形の一覧の表示と選択
* 参照元REQ: `./_log/req/261124_1800_REQ_Phase11-02_List_View_And_Selection.md`

## 1. 作業目的
画面の右端に図形の一覧（パネル）を出し、一覧とキャンバスのどちらからでも図形を選べるようにする。一覧で名前を変えられるようにする。

* 表示・ロックの値は効かせない。フォルダの行・並べ替え・目と鍵のアイコンは作らない（REQの「今回やらないこと」）。
* 作業データ・書き出し形式の版は上げない（保存する項目は増えない）。
* 変更しないファイル：`shapes/`・`io/`・`CanvasManager.js`・`InputTracker.js`・`KeyboardShortcuts.js`・`FocusKeyYieldRules.js`・`SelectionRules.js`・`ItemTreeRules.js`・`SpriteFitRules.js`・`DisplayState.js`・`PaletteLauncher.js`・`WindowManager.js`（計画時に実コードを読み、変える必要が無いと確かめた）。
* 計画時点の`node --test`は tests 2650 / pass 2650 / fail 0。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **行**：一覧の1行。図形のアイテム1つ。並びは上が前面（`model.getShapes()`の逆順）。
*   **起点**：`Shift`＋クリックの範囲の始まりの行の図形のid。`wiring/ItemListWiring`だけが持つ一時的な値。保存・履歴・作業データ・書き出しに入れない。
*   **ロック中**：`canvasLibrary.getState()`の`loading`または`busy`が真の間（`loading`は起動時だけ真で、キャンバスの切り替え中は`busy`が真。`CanvasLibrary`の実コードで確かめた）。キャンバスの名前の変更・削除の間も`busy`のため、その短い間も一覧の操作を受け付けない（切り替えと区別する照会が無く、区別を足さない）。
*   **同期**：一覧の表示を今の`model`に合わせること。`ItemListWiring.sync()`。

### モジュールの分担（全体）
| 置き場所 | 役割 |
| --- | --- |
| `core/ItemListRules.js`（新規） | 行の並び、ロック中の判定、行を押したときに何をするか、行にカーソルを置いたとき・外れたときのホバーの扱い、自分が出したホバーかの判定、名前の編集を始めるか、名前の欄のキーの判定 |
| `core/ListSelectionRules.js`（新規） | 行のクリック・`Ctrl`・`Shift`での次の選択と起点 |
| `core/ListScrollRules.js`（新規） | 見えている行の範囲、選択が変わったかの判定、スクロールするかどうかと位置 |
| `core/ThumbnailRules.js`（新規） | サムネイルの収め方、線の太さの下限、描き直すかどうかの判定 |
| `core/ThumbnailRenderer.js`（新規） | 1つの`<canvas>`へ図形1つを描く（状態なし） |
| `core/ItemAttributeRules.js`（更新） | 名前の変更の規則`applyItemRename`を足す |
| `core/VectorModel.js`（更新） | 公開操作`renameItem(id, name)`を1つ足す |
| `edit/ItemRenameEditor.js`（新規） | 名前を変える1件の編集操作の手順（`beginEdit` → `renameItem` → `commitEdit`） |
| `edit/ShapeExtentReader.js`（更新） | 図形1つの外枠の照会`getShapeBounds(shape)`を足す（`core/`は`io/`をimportできないため、外枠は`edit/`の照会で求めて`wiring`が渡す） |
| `palette/ItemListPanel.js`（新規） | 一覧のDOM。表示とコールバックの通知だけ。importなし。図形・`VectorModel`・`InputTracker`・`HistoryManager`を参照しない |
| `wiring/ItemListWiring.js`（新規） | 購読・生成・注入と、規則の結果を`model`・パネルへ渡す橋渡し。一時的な値（起点・描いたサムネイルの鍵・自分が出したホバーのid・最後に見た`openCanvasId`・同期の予約）だけを持つ |
| `main.js`（更新） | 生成と注入のブロック`// 7.15.`、大きさの同期の関数化 |
| `index.html`（更新） | パネルのDOMとCSS |

依存の向き：`main.js → wiring/ItemListWiring → palette/ItemListPanel・core/の規則・core/ThumbnailRenderer`。`edit/ItemRenameEditor → core/ItemAttributeRules`（`edit/ → core/`の規則のimportの例外の8ファイル目）。`core/`内の規則どうしのimport：`ItemListRules → ItemTreeRules`・`InputModes`、`ListSelectionRules → SelectionRules`、`ThumbnailRules → SpriteFitRules`、`ThumbnailRenderer → ThumbnailRules`。いずれも使われる側は使う側をimportせず循環しない。`core/`から`shapes/`へのimport・`import()`型参照は足さない。

### 要件1: 一覧のパネルの場所と大きさ
*   `index.html`の`:root`に`--item-list-width: 240px;`（幅の唯一の定義）を足す。
*   `:root`の`--canvas-area-width`を`body`の規則へ移し、右端の分を引く。**`:root`に置いたままでは動かない**：カスタムプロパティの`var()`は宣言した要素で解決されるため、`body`のクラス（`float-windows-hidden`）で上書きしても`:root`で解決済みの値には届かない。
    ```css
    body { --canvas-area-right: var(--item-list-width);
           --canvas-area-width: calc(100vw - var(--canvas-area-left) - var(--canvas-area-right)); }
    body.float-windows-hidden { --canvas-area-right: 0px; }
    ```
    （使う側の`#editor-canvas`・`.canvas-loading-cover`・`#ruler-horizontal`はすべて`body`の子孫で、今の`var(--canvas-area-width)`のまま追従する。`0px`の単位を省くと`calc`の引き算が無効になるため省かない。）
*   パネル：`<aside id="item-list-panel" class="item-list-panel"><div id="item-list" class="item-list"></div></aside>`を`</header>`の後・`<footer>`の前に静的に置く。`.float-window`にはしない（`WindowManager`の対象外）。`position: fixed; top: var(--toolbar-height); bottom: var(--statusbar-height); right: 0; width: var(--item-list-width); box-sizing: border-box; z-index: 8;`（ツールバー・定規と同じ8。キャンバス1・覆い5より前面、フロートウィンドウ10以上より背面）。
*   隠し方：`body.float-windows-hidden .item-list-panel { visibility: hidden; }`。**`display: none`にしない**（スクロール位置が失われるブラウザがあるため。`visibility: hidden`はマウスの操作も受けない）。クラスの付け外しは今の`DisplayWiring.#syncFloatWindowVisibility`のままで、新しい表示の状態は足さない。`Tab`・🧰・隠している間の📁は、今の`displayState`の経路だけで一覧も一緒に動く。
*   大きさの同期：`main.js`の`window`の`resize`のハンドラの中身（`canvasManager.resize()` → `rulerRenderer.resize()` → `renderCurrentState()` → `renderRulers()`）を関数`resizeAndRenderViews()`に取り出し、`window`の`resize`と、**`new DisplayWiring(...)`の後の**`displayState.onChange`の2か所へ登録する（`DisplayWiring`が`body`のクラスを付け外しした後に大きさを読むため。`onChange`は登録順に呼ばれる）。アウトライン・背景・グリッドの切り替えでも呼ばれるが、キー1回につき描き直しが1回増えるだけで、切り替え前の値を覚える状態を足さない方を選ぶ。ビュー変換の値に触れないため、絵の位置と倍率は動かない（キャンバスの左上は変わらない）。
*   ⛶・`Ctrl`+`0`・🎯・`Ctrl`+`+`/`-`・起動時の初期表示は、今の`canvas.clientWidth / 2`等のまま、せまくなった領域の中央になる（変更不要）。
*   キャンバスパレットの既定の位置：`right: calc(var(--item-list-width) + var(--float-window-margin))`。1280px幅でx 790〜1032（ツールパレット・`?dev`のウィンドウと重ならない）。
*   ロック中に操作を受け付けないのは、行の操作の入口（押す・カーソル・名前の編集の開始）が毎回ロック中かを照会して断る（覆いの要素は足さない）。

### 要件2: 行の並びと中身
*   `ItemListRules.buildItemRows(items)` → `[{ id, name, shape }]`（先頭＝前面）。`listShapeItems(items)`の逆順。フォルダは行にしない。隠れている・ロックの値の図形も含める。作成途中の図形は`getItems()`に入らないため含まれない。
*   **同期の流れ**：`model.onChange` → `ItemListWiring.#requestSync()`（まだ予約していなければ`requestAnimationFrame`で1回だけ予約）→ `sync()`。図形一式が変わるすべての操作が`model.onChange`を通るため、専用の通知の経路は足さない。予約により、1フレームに何回通知が来ても（ホバー・ドラッグの`mousemove`）行の組み立ては1回。`#requestSync`は`getItems()`等を呼ばない（通知のたびに平らにしない）。
*   **`sync({ allowScroll = true } = {})`の順**：
    1.  `rows = buildItemRows(model.getItems())`（平らにするのは1回）。
    2.  `selectedIds = rows`のうち`model.isSelected(id)`のid（上の行から。`getSelectedIds()`を呼ばない）。
    3.  `previousIds = panel.getSelectedRowIds()`（今の表示）。
    4.  `panel.render(rows.map(({ id, name }) => ({ id, name, selected: model.isSelected(id) })))`（図形はパネルへ渡さない）。
    5.  `allowScroll`が真で`hasSelectionChanged(previousIds, selectedIds)`なら、`resolveSelectionScrollTop(...)`を求め、`null`でなければ`panel.setScrollTop(値)`。
    6.  `#drawVisibleThumbnails(rows)`（要件3）。
*   **`panel.render`は差分だけをDOMへ反映する**：idごとの行の要素を持ち回り（作り直さない）、名前・選択の見た目は変わった行だけ書き、並びが同じならDOMの並びに触れない。図形を変えない通知（ホバー等）ではDOMへの書き込みが0になる。行の要素を作り直さないことは、ダブルクリック（2回のクリックの間に同期が走る）が成り立つ前提でもある。
*   行の見た目：高さ36px固定（`box-sizing: border-box`）、左にサムネイルの`<canvas>`、右に名前の`<span class="item-row-name">`（`text-overflow: ellipsis`、`title`に名前全体。書き込みは`textContent`・`title`・`value`だけ）。選ばれた行は`.item-row.selected`（`.tool-btn.active`と同じ`#dbe9ff`）。頂点の選択（`A`）で頂点が出ている図形は選択集合に入っているため、同じ見た目になる。
*   スクロール：`.item-list`が`height: 100%; overflow-x: hidden; overflow-y: auto`。

### 要件3: サムネイル
*   **収め方**（`ThumbnailRules`）：枠は正方形`THUMBNAIL_SIZE_PX = 28`、余白2px。`computeThumbnailFit(bounds)` ＝ `computeSpriteFitTransform(bounds, 28, 28, 2)`（既存の規則。拡大も行う・大きさ0の向きは倍率の制約にしない・`null`なら描かない）。`bounds`は`ShapeExtentReader.getShapeBounds(shape)`（線の太さを含む）。
*   **線の太さ**：`resolveThumbnailStrokeWidth(strokeWidth, scale)` ＝ 枠の上で`strokeWidth × scale`が1px未満なら`1 / scale`、それ以外は`strokeWidth`。`scale`が正の有限でない・`1 / scale`が有限でないときは`strokeWidth`。下限で太くした線は外枠より片側0.5pxまで広がるが、余白2pxの内側に収まる。
*   **描き方の写しを作らない・インスタンスを書き換えない**：`shape.createTransformed(恒等変換)`で別のインスタンスを作り、その`strokeWidth`へ下限を当てた太さを入れ、`setTransform`で収める変換を設定して`copy.draw(ctx)`を呼ぶ（`draw`は`lineWidth`に自身の`strokeWidth`を使うため）。図形種別の分岐・図形固有のプロパティ名を持たない（読み書きするのは共通プロパティの`strokeWidth`（書くのは写しだけ）、呼ぶのは共通メソッドの`createTransformed`・`draw`だけ）。線も塗りもない図形は`draw`が何も描かず空の枠になる。
*   **枠の背景**：CSSの`.item-row-thumbnail { background-color: #b0b0b0; }`（`<canvas>`は透明に消して図形だけを描く。キャンバスの背景・アウトライン表示の影響を受けない）。内部バッファは`28 × devicePixelRatio`。
*   **重くならない方法**：
    1.  見えている行だけを描く。`panel.getViewport()`（`{ scrollTop, height, rowHeight }`）と行数から`resolveVisibleRowRange`で範囲を求める（前後に4行の余裕）。
    2.  見えている行だけ、図形の今の内容から鍵`buildThumbnailKey(shape.toJSON(), devicePixelRatio)`（文字列）を作り、その行の`<canvas>`に最後に描いた鍵と違うときだけ描く（`needsThumbnailRedraw`）。図形はドラッグ等でその場で書き換わるため、インスタンスの一致では判定できない。鍵は`WeakMap<HTMLCanvasElement, string>`（行の要素が捨てられれば一緒に消える）。
    3.  スクロール（`panel`の`onScroll`）・ウィンドウの`resize`（`devicePixelRatio`の変化を含む）でも`#requestSync()`。ドラッグ中は1フレームに1回まで追従し、最後の通知の後に必ず1回同期が走るため、離した後は正しくなる。

### 要件4: 一覧で選ぶ
*   **通知**：`.item-list`の`click`1本のイベント委譲 → 行のidと`MouseEvent`を`onRowClick(id, event)`で渡す（修飾キーの読み取りは`wiring`。`Ctrl`は`main.js`が注入する既存の`hasCtrlModifier`）。行の無い所の`click`は通知しない。
*   **何をするか**：`ItemListRules.resolveRowPressAction({ mode, isPicking, isDragging, isLocked })`：

    | 条件（上から） | 結果 |
    | --- | --- |
    | ロック中、または`isDragging` | `none` |
    | `isPicking`（スポイトの待ち受け中。操作モードは選択） | `switchAndSelect` |
    | 選択・頂点の選択 | `select` |
    | キャンバス移動 | `switchAndSelect` |
    | それ以外（図形作成・未知の値） | `none` |

    *   `isDragging`は`inputTracker.isDragging()`（左ドラッグとパンの両方で真。パン中も断る。ほかの操作の入口`performJoin`等と同じ）。
    *   `select`：`ListSelectionRules.resolveListClickSelection`の結果の`ids`を`model.setSelection(ids)`へ、`anchorId`を起点へ。`clearSelectedVertices()`は呼ばない（今の規則どおり、選択から外れた図形の頂点だけを`VectorModel`が落とす）。
    *   `switchAndSelect`：注入された`selectSelectTool()`（実体`selectTool(OperationMode.SELECT)`＝ツールパレットの選択のボタンと同じ経路。スポイトの待ち受けは`applyMode`の中で終わり、選択集合は空になる）の後、修飾キーによらず「ふつうのクリック」として選ぶ。
    *   `none`：何もしない（ツール・選択・引いている途中の線に触れない）。
*   **次の選択**（`resolveListClickSelection({ rowIds, selectedIds, hitId, additive, range, anchorId })` → `{ ids, anchorId }`）：
    *   `range`（`Shift`。`additive`によらず優先）：起点＝`anchorId`が`rowIds`にあり`selectedIds`に含まれるならそれ、そうでなければ`rowIds`の順で最初の選ばれている行、無ければ`hitId`。結果は起点から`hitId`までの`rowIds`の連続した部分（逆向きも可）。返す`anchorId`は**渡されたまま**（起点は、ふつうのクリックか`Ctrl`＋クリックでだけ変わる）。
    *   `additive`（`Ctrl`）：`SelectionRules.resolveClickSelection(selectedIds, hitId, true)`の`ids`。`anchorId = hitId`（外したときも。外した行は選ばれていないため、次の`Shift`では「いちばん上の行」に切り替わる）。
    *   どちらでもない：`ids = [hitId]`、`anchorId = hitId`。
*   選択の後、`sync({ allowScroll: false })`をその場で呼ぶ。表示が先に今の選択へそろうため、予約済みの同期では「選択が変わった」にならず、一覧で押した選択ではスクロールしない（要件5）。
*   押した行のidが今の行に無ければ（同期前に消えた）何もしない。
*   選択の変化は記録しない（`beginEdit`を呼ばない）。
*   **フォーカス**：パネル・行に`tabindex`を付けず、`mousedown`を`preventDefault()`しない（数値の欄などのフォーカスが外れて確定する、今のキャンバスと同じ動き）。文字が選ばれないよう`user-select: none`。スクロールする箱はブラウザによってクリックでフォーカスを受けることがあるため、`.item-list`が`focus`を受けたら自分で`blur()`する。
*   切り替え（キャンバス移動 → 選択）で`setMode`がホバーを消すため、行を押した後に、その行のホバーをもう一度当てる（要件6）。
*   キャンバスの切り替え（`openCanvasId`が変わった）で起点を忘れる（図形のidは別のキャンバスと同じ値になり得るため）。

### 要件5: キャンバスで選ぶ
*   選択の変化は`model.onChange`の同期で行の見た目に反映される（要件2）。選択集合の写しは持たない。「選択が変わったか」は、今の**表示**（`panel.getSelectedRowIds()`）と今の`model`を比べて決める。
*   `hasSelectionChanged(previousIds, nextIds)`：集合として違えば真（並びの違いは同じとみなす）。
*   `resolveSelectionScrollTop({ selectedIndexes, scrollTop, height, rowHeight })` → `number | null`：選ばれている行が無い・`height`か`rowHeight`が正でないなら`null`。**行の中心が見えている範囲にある**行が1つでもあれば`null`。そうでなければ、いちばん上の選ばれている行が全部見える最小の移動（上にあればその行の上端、下にあれば`行の下端 − height`。`rowHeight > height`なら上端）。

### 要件6: 行にカーソルを置いたとき
*   `.item-list`の`mousemove`（行の上ならそのid、行の無い所なら`null`）と`mouseleave`（`null`）を`onRowHover(id)`で通知する。`mouseover`ではなく`mousemove`を使う理由：キーでのモード切り替え・取り消し等でホバーが消えた後も、カーソルが動けば当て直されるため。
*   **判定**：`ItemListRules.resolveRowHover({ id, hoveredRowId, hoveredId, isDragging, queryLocked, queryExists })` → `ROW_HOVER_ACTION`の値。`hoveredRowId`は`wiring`の`#hoveredRowId`（自分が出したホバーとして記録しているid）、`hoveredId`は`model.getHoveredId()`の値。`queryLocked: () => boolean`（ロック中か）と`queryExists: (id) => boolean`（そのidの図形が今あるか）は照会の関数で、次の表の順にその行まで進んだときだけ呼ぶ（同じ行の上の`mousemove`では2.で終わり、キャンバスの一覧の並べ替え（`canvasLibrary.getState()`）も図形を平らにすることもしない。照会を関数で受けるのは`PressActionRules`・`PointHitRules`の`isSelected`と同じ形）。状態を持たず、`model`を参照しない。

    | | 条件（上から。当てはまったらそこで終わる） | 結果 |
    | --- | --- | --- |
    | 1. | `id`が`null` | `clear` |
    | 2. | `id`が`hoveredRowId`とも`hoveredId`とも同じ | `none` |
    | 3. | `isDragging`が真、またはロック中（`queryLocked()`。`isDragging`が真なら照会しない） | `clear` |
    | 4. | `id`が`hoveredId`と同じ（記録だけが違う） | `record` |
    | 5. | そのidの図形が今ある（`queryExists(id)`） | `set` |
    | 6. | それ以外（図形が無い） | `clear` |

    *   2.が3.より先でよい理由：ロック中になったとき・ドラッグを始める前（行から外れたとき）には記録が消えている。
    *   4.で記録する理由：今のアプリはカーソルがキャンバスの外へ出てもホバーを消さないため、キャンバスで出たホバーの図形の行に最初に乗ることがある。その行から外れたときにも消えるようにする。
*   **`wiring`が結果ごとに行うこと**（判定は書かない）：
    *   `none`：何もしない（通知を出さない）。
    *   `record`：`setHovered`を呼ばず（通知を出さず）、`#hoveredRowId = id`とだけ記録する。
    *   `set`：`model.setHovered(id)`を呼び、`#hoveredRowId = id`と記録する。
    *   `clear`：自分が出したホバーを消す。`ItemListRules.isOwnHover(hoveredRowId, hoveredId)`（`hoveredRowId`が`null`でなく`hoveredId`と同じ）が真のときだけ`model.clearHovered()`を呼び、どちらの場合も`#hoveredRowId`は`null`にする（記録していないキャンバス側のホバーは消さない）。下の「消える場面」で`wiring`が消すときも同じメソッドを使う。
*   消える場面：図形が消えた・図形一式が入れ替わった＝`VectorModel`が今の規則で消す。ロック中になった・一覧を隠した＝`canvasLibrary.onChange`・`displayState.onChange`で自分の出したホバーを消す。
*   どのツールでも同じ（`setHovered`は操作モードによらず、`CanvasManager`が今の`drawHover`を描く）。

### 要件7: 名前を変える
*   **規則**：`ItemAttributeRules.applyItemRename(items, id, value)` → 新しいアイテムの入れ子、または`null`（idのアイテムが無い／整えた名前（`normalizeItemName`）が空／今の名前と同じ）。図形は`item.shape.id`、フォルダは`item.id`で探す（`ItemTreeRules`は図形のプロパティを読まない責務のため、ここに置く）。引数を書き換えない。
*   **`VectorModel.renameItem(id, name)`** → `boolean`：`applyItemRename(this.#items, id, name)`が`null`なら何も変えず（通知もせず）`false`。そうでなければ`#items`を入れ替えて通知1回・`true`。選択集合・頂点の選択・ホバー・作成途中の図形・図形インスタンス・並びに触れない。
*   **`ItemRenameEditor.rename(id, text)`** → `boolean`：`applyItemRename(model.getItems(), id, text) === null`なら`beginEdit`も呼ばず`false`。そうでなければ`beginEdit()` → `model.renameItem(id, text)` → `commitEdit()`（鍵なし）。記録されるため自動保存（`historyManager.onChange`）にも乗る。
*   **編集の開始**：名前の`<span>`の`dblclick` → `onNameEditRequest(id, event)` → `canStartNameEdit({ isDragging, isLocked, hasModifier })`が真なら、`sync({ allowScroll: false })`の後`panel.startNameEdit(id, 今の名前)`。操作モードは見ない（どのツールでもできる）。**`Ctrl`・`Shift`を押したままのダブルクリックでは始めない**（2回のクリックが追加・解除／範囲選択の操作であるため。計画での判断）。1回目・2回目のクリックは要件4の経路を通る（修飾キーなしの2回目は同じ結果になるだけ）。
*   **名前の欄**：`<input type="text" class="item-row-name-input">`を行に足し、名前の`<span>`を`hidden`にする。`value`に今の名前を入れて`focus()` → `select()`。`isTextInputElement`（`type`が`text`）が真になるため、編集中はすべてのショートカット・スペースパンが働かない（今の規則のまま。`KeyboardShortcuts`・`FocusKeyYieldRules`を変えない）。
*   **`keydown`**：注入された`resolveNameEditKey(event.key, event.isComposing)`（規則。`'commit'`＝`Enter`、`'cancel'`＝`Escape`、それ以外・変換中は`null`）に従う。`null`なら何もせず通す。それ以外は**`event.preventDefault()`と`event.stopPropagation()`を呼んでから**編集を終える。`stopPropagation()`は必須：欄を消すとフォーカスが`body`へ移り、同じ`keydown`が`document`の`KeyboardShortcuts`へ届いた時点ではテキスト入力中でなくなるため、`Esc`が選択の解除（今の働き）を起こしてしまう。
*   **確定・取りやめの出口は1つ**（`#finishNameEdit(shouldCommit)`）：編集中の控え`{ id, input }`を取り出して**先に`null`にし**、欄を除き、`<span>`を戻し、`shouldCommit`なら`onNameCommit(id, 欄の文字列)`を呼ぶ。欄を除いたときに`blur`が起きるブラウザがあるため、`blur`のハンドラは控えが`null`なら何もしない（二重の確定・取りやめの後の確定が起きない）。
*   `blur`（ほかの所を押す・`Tab`・ウィンドウの切り替え）で確定する。確定は`isDragging()`もロック中も見ない：見ると打った名前が失われる（位置の欄と同じ判断。開発資料3章13.・20.）。キャンバスを押したときは、キャンバスの`mousedown`（閾値以前で編集操作は開いていない）→ `blur` → 記録の順になり、`beginEdit`／`commitEdit`の対は崩れない。切り替えの処理中（`busy`）に確定した変更は、`CanvasLibrary`の確定手順で切り替え前のキャンバスに保存される。
*   **編集中の同期**：`render`は編集中の欄の`value`に触れない。**編集中の行の要素は動かさない**（DOMの中で動かすと`blur`が起きて確定してしまう）。並びを合わせるときは、編集中の行を固定し、ほかの行を前後へ動かす（タスク9に手順）。
*   **捨てる**：編集中の図形が行に無くなった（`render`の中で、行の要素を除く前に控えを`null`にする）・`openCanvasId`が変わった（`canvasLibrary.onChange` → `panel.cancelNameEdit()`）。後者が要る理由：キャンバスを切り替えてもidが同じ図形があり得る。切り替えは`replaceAllShapes`から通知まで`await`を挟まず、同期は次のフレームのため、捨てる方が先になる。
*   名前の欄の中のクリック・ドラッグは行を押したことにしない：`click`の対象が欄の中、または`mousedown`が欄の中で始まった`click`（欄から文字を選ぶドラッグの終わり）は通知しない。

### 要件8: 自動テスト
*   既存のテストの値は変えない。足すテスト：`test/core/ItemListRules.test.js`・`ListSelectionRules.test.js`・`ListScrollRules.test.js`・`ThumbnailRules.test.js`・`ThumbnailRenderer.test.js`・`VectorModel.renameItem.test.js`、`test/edit/ItemRenameEditor.test.js`（新規）、`test/core/ItemAttributeRules.test.js`・`test/edit/ShapeExtentReader.test.js`（末尾へ追加だけ）。内容は各タスク。
*   `ItemListPanel`・`ItemListWiring`・`main.js`・CSSは`node --test`の対象外（DOM）。判定は規則のファイルに出してある。テストプレイで確かめる。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`（規則・状態なしのレンダラー・モデル）、`./js/edit/`（編集操作の手順・外枠の照会）、`./js/palette/`（UI部品）、`./js/wiring/`（配線）、`./js/main.js`、`./index.html`、`./test/core/`・`./test/edit/`
*   **関連する論理クラス**: 新規＝`ItemListRules`・`ListSelectionRules`・`ListScrollRules`・`ThumbnailRules`・`ThumbnailRenderer`・`ItemRenameEditor`・`ItemListPanel`・`ItemListWiring`。更新＝`ItemAttributeRules`・`VectorModel`・`ShapeExtentReader`・`DisplayWiring`（JSDocだけ）・`main.js`・`index.html`。使うだけ＝`SpriteFitRules`・`SelectionRules`・`ItemTreeRules`・`InputModes`・`InputTracker`（`getMode`・`isDragging`・`hasCtrlModifier`）・`StyleEyedropper`（`isPicking`）・`CanvasLibrary`（`getState`・`onChange`）・`DisplayState`・`HistoryManager`

### 参照する責務
*   **`main.js`**：各モジュールの初期化と連携（依存性の注入）。判定・計算・データの中身の解釈を持たない。ブロックはコメント番号の順に置く。`new DisplayWiring`（`// 6.5.`）の位置と`syncAll()`の位置を動かさない（通知の呼ばれる順が登録順に依存するため）。
*   **`VectorModel`**：アイテムの入れ子`#items`だけが状態（平らな並びは毎回求める）。選択集合の唯一の持ち主。名前の規則は`ItemAttributeRules`、入れ子の計算は`ItemTreeRules`へ委譲。状態を変える操作は変更後に通知する。`getItems()`は入れ子の写し（図形インスタンスは共有）を返す。
*   **選択の不変条件**：選択集合は現存する図形のidだけを含み、選択モード・頂点の選択モード以外では空。頂点の選択は選択集合の図形の組だけ（`VectorModel`が落とす）。
*   **`ItemAttributeRules`**：アイテムの名前・表示・ロックの規則（名前の整え方・自動の名前の番号・不備の補い）。状態なし・DOMなし。名前は前後の空白を除いた先頭100文字（サロゲートペアは1文字）、空なら名前なし。重複は許す。
*   **`ItemTreeRules`**：入れ子の計算だけ。図形のプロパティを読まない。importなし。
*   **`SelectionRules`**：クリック・範囲選択の次の選択の規則。`resolveClickSelection(selectedIds, hitId, true)`は、選択中なら外し、未選択なら末尾へ足した`{ type: 'set', ids }`を返す。
*   **`SpriteFitRules`**：外枠を描画先の余白の内側へ収めて中央に置く`{ scale, offsetX, offsetY }`（`スクリーン = ワールド × scale + offset`）。求められなければ`null`。
*   **`ShapeExtentReader`**：外枠の照会だけ。求め方は`SpriteSerializer.computeShapesBounds`に任せる。`main.js`の`// 4.`で生成した`shapeExtentReader`を使い回す。
*   **`HistoryManager`（`EditRecorder`）**：変更を`beginEdit()`／`commitEdit()`で挟む。前後の作業データが同じなら記録しない。選択の変更は記録しない。
*   **`edit/`**：1件の編集操作の手順。操作モードを知らない。DOMに触れない。`VectorModel`・`EditRecorder`は注入で受け取り、規則の関数だけをimportする。
*   **`palette/`**：自己完結するUI部品。何もimportしない。表示とコールバックの通知だけ。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（以後の公開メソッドは何もしない）。名前は`textContent`・`title`・`value`で書き、`innerHTML`を使わない。
*   **`wiring/`**：DOMの取得・購読の登録・同期の配線。判定・計算の規則を持たず規則のモジュールへ渡すだけ。`palette/`・`edit/`・`core/`をimportしてよい（`io/`は不可）。`main.js`だけが使う。
*   **`core/`のレンダラー**：引数だけから描き、アプリケーション状態を持たない。`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`shapes/`を新たにimportしない。図形種別の分岐・図形固有のプロパティ名を持たない。
*   **図形の共通メソッド**：`draw(ctx)`（`lineWidth`に自身の`strokeWidth`を使う。線も塗りもなければ何も呼ばない）・`createTransformed(transform)`（`{ a, b, c, d, e, f }`を当てた新しいインスタンス。自身は変えず、頂点等を共有しない。`type`・`id`・スタイルは同じ）・`toJSON()`。共通プロパティ：`id`・`strokeColor`・`strokeWidth`・`fillColor`。
*   **`InputTracker`の公開の照会**：`getMode()`（`OperationMode`の値）・`isDragging()`（左ドラッグ・パンの最中）。`hasCtrlModifier(event)`（`ctrlKey || metaKey`。export）。`setMode`は選択集合とホバーを無条件にクリアする。
*   **ツールの切り替え**：ツールパレットの選択のボタンは`main.js`の`selectTool(OperationMode.SELECT)` → `selectModeTool` → `applyMode`（`styleEyedropper.stop()`を含む）。
*   **`KeyboardShortcuts`**：`document`の`keydown`を購読し、`isComposing`・テキスト入力中（`isTextInputElement(document.activeElement)`）なら何もしない。
*   **`DisplayWiring`**：`displayState.onChange`で`body`のクラス`float-windows-hidden`を付け外しする。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
※ 反映はタスク10・11で行う。各タスクで影響が判明したら追記する。
*   `PROJECT_ARCHITECTURE.md`
    *   1章：構成図へ新しい8ファイルとテスト7ファイルを足す。`index.html`の説明（右端の一覧のパネル・`--item-list-width`）。フォルダ分割の方針（`core/`の規則・レンダラー、`edit/`の手順`ItemRenameEditor`、`wiring/`の`ItemListWiring`、`palette/`の一覧の部品）。依存方向（`edit/ItemRenameEditor → core/ItemAttributeRules`で例外(3)が8ファイルに、規則どうしのimport、`wiring/`が`core/`のレンダラーをimportすること、`shapeExtentReader`の渡し先が増えること）。「存在しないもの」（図形の一覧・名前の変更が入ったこと。並べ替え・フォルダの行・目/鍵・幅の変更・検索・右クリックのメニュー・`Tab`で次の名前へ移ることは無い）。
    *   2章：「アイテム」の「画面のための公開操作は無い」を`renameItem`が入ったことへ直す。選択状態に、一覧は選択集合の写しを持たないこと・`Shift`＋クリックの起点を保存しないこと。スタイルの読み書きの例外に、サムネイル（写しのインスタンスの`strokeWidth`だけを書く）。表示の状態（パレットを隠すに一覧を含む）。
    *   3章：「同期の経路」に一覧（`model.onChange`を1フレームに1回へまとめる）。2.（`displayState.onChange`での`resizeAndRenderViews`）。4.（キャンバスの領域の幅）。6.（記録する操作に名前の変更、記録しない操作に一覧での選択）。8.（読み込み中・切り替え中は一覧の操作を受け付けない）。15.（パレットをまとめて隠す/出すの対象に一覧、キャンバスの領域の幅、⛶）。16.・18.（一覧での選択の経路）。新しい節「28. 図形の一覧」。
    *   4章：一覧表へ新しい資料のファイルを足す。
*   `_doc/arch/`
    *   更新：`01_index_html.md`・`02_main.md`（ブロック`// 7.15.`・注入・購読・行数）・`03_VectorModel.md`（`renameItem`）・`04_CanvasManager.md`／`23_RulerRenderer.md`（`resize()`が呼ばれる場面）・`11_WindowManager.md`（一覧は対象外）・`12_shapes.md`（`createTransformed`・`draw`・`toJSON`の呼び出し元）・`13_palette.md`・`14_edit.md`（`ItemRenameEditor`・`ShapeExtentReader.getShapeBounds`）・`16_test.md`（件数・テストできない箇所）・`20_DisplayState.md`・`27_SelectionRules.md`（使う側）・`32_InputModes.md`（使う側）・`33_FocusKeyYieldRules.md`（名前の欄）・`36_DisplayWiring.md`・`37_SpriteFitRules.md`（使う側）・`46_ItemTreeRules.md`（使う側）・`47_ItemAttributeRules.md`（`applyItemRename`・使う側）
    *   新規：`48_ItemListRules.md`・`49_ListSelectionRules.md`・`50_ListScrollRules.md`・`51_ThumbnailRules.md`・`52_ThumbnailRenderer.md`・`53_ItemListWiring.md`
    *   計画時にバイト列で実測した行末：CRLF＝`PROJECT_ARCHITECTURE.md`・`01`・`02`・`03`・`04`・`06`・`08`・`09`・`11`〜`17`・`19`・`33`・`41`、LF＝そのほかの`_doc/arch/`のファイル（反映の前にもう一度実測する。この環境では`grep`で`\r`を数える方法は正しく数えられないため、バイト列で確かめる）。

## 3. タスクリスト
**各タスク共通の作業**（すべてのタスクで行う）
*   JSDoc（ファイル先頭の責務3行以内・クラス・関数・メソッド・データ構造）を書き、コード修正の完了後に記載漏れがないことを確認する。
*   対象ファイルの行末を保つ（計画時の実測：`js/main.js`はCRLF、`index.html`と、更新するほかの`js/`・`test/`のファイルはLF）。新しいファイルはLFにする。行末はバイト列で確かめる（この環境では`grep`で`\r`を数える方法は正しく数えられない）。
*   リポジトリのルートで`node --test`を実行し、全件合格を確かめる（既存のテストの値を変えない）。
*   「4. 詳細作業内容」の該当欄を記入し、タスクを`[x]`にする。
*   開発資料の記載に影響が出る場合は資料本体を直さず、「開発資料の更新予定」へ追記する（タスク10・11を除く）。

*   [x] タスク1: 一覧のパネルの場所と、キャンバスの領域の大きさの同期（要件1）
    *   **対象ファイル** :
        *   `./index.html` :（更新）
        *   `./js/main.js` :（更新）
        *   `./js/wiring/DisplayWiring.js` :（更新。`#syncFloatWindowVisibility`のJSDocだけ）
    *   **作業内容** :
        *   `index.html`：要件1のとおり、`:root`の`--item-list-width`、`body`の`--canvas-area-right`・`--canvas-area-width`（`:root`の`--canvas-area-width`は消す）、`body.float-windows-hidden`の上書き、`.item-list-panel`・`.item-list`のCSS、`body.float-windows-hidden .item-list-panel`、`#window-canvas-palette`の`right`、パネルのDOMを足す。冒頭のコメント・キャンバスパレットの位置のコメント（x 790〜1032）など、ずれる説明を直す。`.item-list-panel`は`background-color: var(--frame-background-color)`・`border-left: 1px solid #ccc`・`font-family: sans-serif`・`user-select: none`。
        *   `main.js`：`window`の`resize`の無名関数を、JSDoc付きの関数`resizeAndRenderViews()`へ取り出して登録する（4つの呼び出しの順は変えない）。`const displayWiring = new DisplayWiring(...)`の直後に`displayState.onChange(resizeAndRenderViews)`を登録する（理由のコメント付き）。`renderCurrentState`・`renderRulers`のJSDocの、呼び出し元の説明を合わせる。`resetViewToCenter`のJSDocの「ツールバー・定規・ステータスバーを除いた領域」へ、図形の一覧のパネル（出ているとき）も除くことを足す。
        *   `DisplayWiring`のJSDoc：クラスが図形の一覧のパネル（`.item-list-panel`）も隠し、キャンバスの領域の右端を変えることを書く。
        *   この時点でパネルは空のまま。
*   [x] タスク2: 行の並びと、行の操作の判定の規則（要件2・4・6・7）
    *   **対象ファイル** :
        *   `./js/core/ItemListRules.js` :（新規）
        *   `./test/core/ItemListRules.test.js` :（新規）
    *   **作業内容** :
        *   importは`./ItemTreeRules.js`（`listShapeItems`）と`./InputModes.js`（`OperationMode`）だけ。export：
            *   typedef `ItemRow`（`id`・`name`・`shape`）、`buildItemRows(items)`。
            *   `ROW_PRESS_ACTION`（凍結。`NONE: 'none'`・`SELECT: 'select'`・`SWITCH_AND_SELECT: 'switchAndSelect'`）、`resolveRowPressAction({ mode, isPicking, isDragging, isLocked })`（要件4の表）。
            *   `isListLocked({ loading, busy })`。
            *   `ROW_HOVER_ACTION`（凍結。`NONE: 'none'`・`RECORD: 'record'`・`SET: 'set'`・`CLEAR: 'clear'`）、`resolveRowHover({ id, hoveredRowId, hoveredId, isDragging, queryLocked, queryExists })`（要件6の表）、`isOwnHover(hoveredRowId, hoveredId)`。
            *   `canStartNameEdit({ isDragging, isLocked, hasModifier })`。
            *   `resolveNameEditKey(key, isComposing)`（`'commit'`／`'cancel'`／`null`）。
        *   テスト：行の並び（前面が上・フォルダの中と外・入れ子・空のフォルダ・0個・隠れている/ロックの図形も含む・引数を書き換えない・図形のインスタンスが同じ）。押したときの判定（4つのモード×待ち受け×ドラッグ×ロックの主な組と、未知のモード）。ロック中の4通り。ホバーの判定（要件6の表の1.〜6.のすべて。順の優先：ドラッグ中・ロック中でも2.が先、ドラッグ中・ロック中は`id`が`hoveredId`と同じでも`clear`、`id`が`hoveredRowId`とだけ同じ（ホバーが外で消えた）なら`set`。照会の回数：1.・2.ではどちらの照会も呼ばれない、3.で終わるとき・4.では`queryExists`が呼ばれない、ドラッグ中は`queryLocked`が呼ばれない）。自分が出したホバーかの判定（`null`どうし・同じid・違うid・片方だけ`null`）。編集の開始の判定の全組。キーの判定（`Enter`・`Escape`・ほかのキー・それぞれ変換中）。
*   [x] タスク3: 一覧のクリックの次の選択と、スクロールの規則（要件2・3・4・5）
    *   **対象ファイル** :
        *   `./js/core/ListSelectionRules.js` :（新規）
        *   `./js/core/ListScrollRules.js` :（新規）
        *   `./test/core/ListSelectionRules.test.js` :（新規）
        *   `./test/core/ListScrollRules.test.js` :（新規）
    *   **作業内容** :
        *   `ListSelectionRules`：importは`./SelectionRules.js`（`resolveClickSelection`）だけ。`resolveListClickSelection(...)`（要件4の規則）。引数を書き換えず新しい配列を返す。`hitId`が`rowIds`に無いときは`{ ids: 今の選択の写し, anchorId: 渡されたまま }`（防御）。
        *   `ListScrollRules`：importなし。
            *   `resolveVisibleRowRange({ scrollTop, height, rowHeight, rowCount, overscan })` → `{ start, end }`（`end`は含まない。前後に`overscan`行を足し`0`〜`rowCount`に収める。`rowCount`が0・`height`か`rowHeight`が正でないなら`{ start: 0, end: 0 }`。スクロール位置が行の総高さを超えていても範囲は`rowCount`以内）。
            *   `hasSelectionChanged(previousIds, nextIds)`、`resolveSelectionScrollTop(...)`（要件5）。
        *   テスト：ふつうのクリック（起点・置き換え）、`Ctrl`（追加・解除・起点）、`Shift`（起点から下・上（逆向き）・同じ行・起点が無い・起点の行が無くなった・起点が選ばれていない・何も選ばれていない・それまでの選択が置き換わる・起点が変わらない）、`Ctrl`+`Shift`は`Shift`と同じ、`Ctrl`で外した後の`Shift`、引数を書き換えない。見えている範囲（先頭・途中・末尾・余裕の頭打ち・0件・高さ0）。選択が変わったか（同じ・並び違い・増減・空）。スクロール（中心が見えている・境目・上へ・下へ・複数のうち1つ見えている・全部見えていないときいちばん上・選択なし・高さ0・表示が行より低い）。
*   [x] タスク4: サムネイルの規則と描画（要件3）
    *   **対象ファイル** :
        *   `./js/core/ThumbnailRules.js` :（新規）
        *   `./js/core/ThumbnailRenderer.js` :（新規）
        *   `./js/edit/ShapeExtentReader.js` :（更新）
        *   `./test/core/ThumbnailRules.test.js` :（新規）
        *   `./test/core/ThumbnailRenderer.test.js` :（新規）
        *   `./test/edit/ShapeExtentReader.test.js` :（更新。末尾へ追加だけ）
    *   **作業内容** :
        *   `ThumbnailRules`：importは`./SpriteFitRules.js`だけ。export：`THUMBNAIL_SIZE_PX`（28。枠の大きさの唯一の定義）・`computeThumbnailFit(bounds)`・`resolveThumbnailStrokeWidth(strokeWidth, scale)`・`buildThumbnailKey(shapeData, pixelRatio)`・`needsThumbnailRedraw(drawnKey, key)`（`drawnKey`が`undefined`なら真）。余白2px・線の下限1pxは非公開の定数。
        *   `ThumbnailRenderer`：importは`./ThumbnailRules.js`だけ。`drawThumbnail(canvas, shape, bounds, pixelRatio)`：内部バッファを`Math.max(1, Math.round(THUMBNAIL_SIZE_PX * pixelRatio))`の正方形にする（代入で消える）→ `computeThumbnailFit(bounds)`が`null`なら終わり → `copy = shape.createTransformed(恒等変換の凍結した定数)`、`copy.strokeWidth = resolveThumbnailStrokeWidth(shape.strokeWidth, fit.scale)` → `setTransform(r·scale, 0, 0, r·scale, r·offsetX, r·offsetY)`（`r = canvas.width / THUMBNAIL_SIZE_PX`）→ `copy.draw(ctx)`。状態を持たない。
        *   `ShapeExtentReader`：`getShapeBounds(shape)` → `SpriteSerializer.computeShapesBounds([shape])`。選択によらない。責務の行とクラスJSDocに「渡された図形1つの外枠」を足す。
        *   テスト：収め方（縦長・横長・正方形・小さい図形の拡大・幅0・高さ0・点・`null`）。線の太さ（縮めて1px以上・ちょうど1px・1px未満で下限・拡大では太くなる・`scale`が有限でない/0以下）。鍵（同じ内容で同じ・座標/色/太さ/`pixelRatio`の違いで変わる）と描き直しの判定。描画（偽の`canvas`で、内部バッファの大きさ・`setTransform`の値・`lineWidth`・元の図形の`strokeWidth`と`toJSON()`が変わらない・線も塗りもない図形で何も描かない・外枠`null`で何も描かない。全図形種別）。`getShapeBounds`（線ありで太さの半分広がる・線なし・選択によらない）。
*   [x] タスク5: 名前を変える規則と編集操作（要件7）
    *   **対象ファイル** :
        *   `./js/core/ItemAttributeRules.js` :（更新）
        *   `./js/core/VectorModel.js` :（更新）
        *   `./js/edit/ItemRenameEditor.js` :（新規）
        *   `./test/core/ItemAttributeRules.test.js` :（更新。末尾へ追加だけ）
        *   `./test/core/VectorModel.renameItem.test.js` :（新規）
        *   `./test/edit/ItemRenameEditor.test.js` :（新規）
    *   **作業内容** :
        *   要件7の`applyItemRename`・`renameItem`・`ItemRenameEditor`。`applyItemRename`は`toItems`で写してから`listItems`で探し、写しの`name`だけを書き換えて返す。`VectorModel`のimportへ`applyItemRename`を足し、`renameItem`は`reorderShapes`の後・`onChange`の前に置く。`ItemAttributeRules`・`VectorModel`の責務の行・クラスJSDocを合わせる（責務の行は3行以内を保つ）。`ItemRenameEditor`は`ShapeOrderEditor`と同じ形（`{ model, editRecorder }`を注入。`model`は`getItems`・`renameItem`だけを使う）。
        *   テスト：規則（前後の空白・101文字・サロゲートペア・空/空白だけ・同じ名前・整えると同じ・無いid・フォルダ・フォルダの中の図形・重複した名前・引数を書き換えない・表示/ロック/図形は変わらない）。`renameItem`（通知1回・変わらないときは通知なし・選択/頂点の選択/ホバー/作成途中の図形/並び/インスタンスを変えない）。手順（実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`で、記録1件・取り消し/やり直しで名前が戻る・変わらないときは`beginEdit`も呼ばない・選択が保たれる・`DocumentSerializer.serialize(model.getItems())`に新しい名前が出て`deserialize`で読める）。
*   [x] タスク6: 一覧のUI部品（表示・スクロール）（要件2・5）
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（新規）
        *   `./index.html` :（更新。行のCSS）
    *   **作業内容** :
        *   `new ItemListPanel(rootElement, { thumbnailSize, onScroll })`。`rootElement`は`#item-list-panel`、要素はその中の`#item-list`。importなし。規約（コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない）は`palette/`の他の部品と同じ。
        *   公開：`render(rows)`（`[{ id, name, selected }]`。差分の反映）・`getSelectedRowIds()`（表示中の選ばれた行のid。上から）・`getViewport()`（`{ scrollTop, height, rowHeight }`。`height`は`clientHeight`、`rowHeight`は最初の行の`offsetHeight`（0行なら0））・`setScrollTop(top)`・`getThumbnailCanvas(id)`（無ければ`null`）。
        *   行：`<div class="item-row" data-item-id="...">`に`<canvas class="item-row-thumbnail">`と`<span class="item-row-name">`。`<canvas>`のCSSの大きさは`thumbnailSize`から`style`へ入れる。行ごとの控え（要素・表示中の名前・選択）をid→控えの`Map`で持つ。
        *   `render`：無くなった行を除く → 足りない行を作る → 変わった名前（`textContent`・`title`）・選択（クラス`selected`）だけ書く → 並びが違うときだけ、`cursor = list.firstChild`から順に「行の要素が`cursor`なら`cursor`を次へ、違えば`insertBefore(行, cursor)`」で並べる。
        *   `.item-list`の`scroll` → `onScroll()`。`focus` → 自分で`blur()`（要件4のフォーカス）。
        *   CSS：`.item-row`（`display: flex; align-items: center; gap; height: 36px; box-sizing: border-box; padding; border-bottom`）・`.item-row.selected`・`.item-row-thumbnail`（`flex: none; background-color: #b0b0b0`）・`.item-row-name`（`flex: 1; min-width: 0`と省略表示。`[hidden]`で消えること）。
        *   この時点ではまだどこからも使われない。
*   [x] タスク7: 一覧の配線（表示・サムネイル・スクロール）（要件2・3・5）
    *   **対象ファイル** :
        *   `./js/wiring/ItemListWiring.js` :（新規）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `new ItemListWiring({ model, shapeExtentReader })`。生成時に`ItemListPanel`（`document.getElementById('item-list-panel')`・`THUMBNAIL_SIZE_PX`）を作り、`model.onChange`・`window`の`resize`・パネルの`onScroll`で`#requestSync()`（`requestAnimationFrame`の予約は1つだけ。予約中かを1つのフィールドで持つ）。
        *   公開`sync({ allowScroll = true } = {})`：要件2の順。`#drawVisibleThumbnails(rows)`：`resolveVisibleRowRange`（余裕4行は定数）の行だけ、鍵を比べて`drawThumbnail(canvas, row.shape, shapeExtentReader.getShapeBounds(row.shape), window.devicePixelRatio || 1)`。鍵は`WeakMap`。
        *   `main.js`：`// 7.14.`の後・`// 8.`の前に`// 7.15. 図形の一覧配線`を足す。起動時の同期は、オプションバーの同期の後（`syncOptionBarTransformGroup()`の次）に`itemListWiring.sync()`を明示的に1回（既存の同期と同じコメントの形）。
*   [x] タスク8: 一覧で選ぶ・行にカーソルを置く（要件4・6、要件1の読み込み中）
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/main.js` :（更新。`// 7.15.`の注入）
    *   **作業内容** :
        *   `ItemListPanel`：コールバック`onRowClick(id, event)`・`onRowHover(id | null)`を足す。`click`・`mousemove`・`mouseleave`を`.item-list`のイベント委譲で1本ずつ。行は`event.target.closest('.item-row')`で求める。`mousedown`は`preventDefault()`しない。
        *   `ItemListWiring`：注入を足す（`displayState`・`canvasLibrary`・`getMode`・`isDragging`・`isPicking`・`selectSelectTool`・`readCtrlModifier`）。要件4・6のとおり。起点`#anchorId`・自分の出したホバー`#hoveredRowId`・最後に見た`openCanvasId`を持つ。`canvasLibrary.onChange`：`openCanvasId`が変わったら起点を忘れる／ロック中なら自分のホバーを消す。`displayState.onChange`：隠れたら自分のホバーを消す。ロック中かは`isListLocked(canvasLibrary.getState())`で使うときに照会する（写しを持たない）。行のホバーは`resolveRowHover`へ今の値と照会の関数（`queryLocked: () => isListLocked(canvasLibrary.getState())`・`queryExists: (id) => model.getShapes().some((shape) => shape.id === id)`）を渡し、返った`ROW_HOVER_ACTION`に従って要件6のとおり反映するだけにする（判定を書かない。呼ぶ前に`getState()`・`getShapes()`・`getItems()`を呼ばない。ロック中か・図形があるかの照会は、規則がその段まで進んだときだけ走る）。自分のホバーを消す処理は1つの非公開メソッドにまとめ（`isOwnHover`を使う）、`clear`・`canvasLibrary.onChange`・`displayState.onChange`の3か所から使う。
        *   `main.js`：`getMode: () => inputTracker.getMode()`・`isDragging: () => inputTracker.isDragging()`・`isPicking: () => styleEyedropper.isPicking()`・`selectSelectTool: () => selectTool(OperationMode.SELECT)`・`readCtrlModifier: hasCtrlModifier`を渡すだけ（判定を書かない）。
*   [x] タスク9: 名前を変える画面（要件7）
    *   **対象ファイル** :
        *   `./js/palette/ItemListPanel.js` :（更新）
        *   `./js/wiring/ItemListWiring.js` :（更新）
        *   `./js/main.js` :（更新。`ItemRenameEditor`の生成と注入）
        *   `./index.html` :（更新。名前の欄のCSS。`user-select: text`）
    *   **作業内容** :
        *   `ItemListPanel`：コールバック`onNameEditRequest(id, event)`・`onNameCommit(id, text)`・`resolveNameEditKey(key, isComposing)`、公開`startNameEdit(id, name)`・`cancelNameEdit()`を足す。要件7のとおり（`#finishNameEdit`の1つの出口・控えを先に`null`・`stopPropagation`・欄の中のクリックとドラッグの除外）。欄は`spellcheck = false`・`autocomplete = 'off'`。`maxlength`は付けない（長さは規則が整える）。`startNameEdit`は編集中なら先に確定する。行が無ければ何もしない。
        *   `render`の並べ替えへ編集中の行の固定を足す：順に並べていき、次に置く行が編集中の行で`cursor`と違うときは、その行を動かさず、`cursor`から編集中の行の手前までの要素を末尾へ移して`cursor`を編集中の行に合わせる（移した行は後の手順で正しい位置に置かれる）。編集中の行は`insertBefore`・`appendChild`の対象にならない。無くなった行が編集中の行なら、要素を除く前に控えを`null`にして捨てる。
        *   `ItemListWiring`：`itemRenameEditor`の注入。編集の開始（`canStartNameEdit`。`hasModifier`は`readCtrlModifier(event) || event.shiftKey`）、確定は`itemRenameEditor.rename(id, text)`を呼ぶだけ、`openCanvasId`が変わったら`panel.cancelNameEdit()`。
        *   `main.js`：`new ItemRenameEditor({ model, editRecorder: historyManager })`を`// 7.15.`で生成して渡す。
        *   コードの最後のタスクとして、全新規・更新ファイルのJSDocの記載漏れ、未使用のimport・未使用の公開メソッドが無いことを確認する。
*   [x] タスク10: 開発資料の反映その1（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。本タスクのみ例外として許可）
    *   **作業内容** :
        *   「開発資料の更新予定」の`PROJECT_ARCHITECTURE.md`の項を、実コードを確かめながら1章・2章・3章・4章の一覧表へ反映する。**書き換える前に行末を実測し、保つ**。記載基準（冒頭）に従い、1ファイルのJSDocで分かることは書かない。3章の新しい節「28. 図形の一覧」には、モジュールの分担・同期の流れ・選択と起点・スクロール・ホバー・名前の編集（`stopPropagation`・控えを先に`null`にする・行を動かさない理由）・大きさの同期・発注者の決定・判断した点・やらないこと・確認の状況を書く。
*   [x] タスク11: 開発資料の反映その2（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の「開発資料の更新予定」に挙げたファイル :（更新・新規6ファイル。本タスクのみ例外として許可）
    *   **作業内容** :
        *   「開発資料の更新予定」の`_doc/arch/`の項を反映する。**書き換える前に各ファイルの行末を実測し、保つ**（新規はLF）。`02_main.md`の行数を`wc -l`の実測で直す（`InputTracker.js`は変えないため2020行のまま）。`16_test.md`へ件数（`node --test`の実測）を書く。`PROJECT_ARCHITECTURE.md`との食い違いが無いことを確かめる。

## 4. 詳細作業内容
※ タスク実行時にそれぞれ記入する。

### タスク1: 一覧のパネルの場所と、キャンバスの領域の大きさの同期
*   **作業内容** :
    *   `index.html`：`:root`へ`--item-list-width: 240px`を足し、`:root`の`--canvas-area-width`を消して`body`へ`--canvas-area-right`・`--canvas-area-width`を置いた。`body.float-windows-hidden`で`--canvas-area-right: 0px`。`.item-list-panel`・`.item-list`・`body.float-windows-hidden .item-list-panel { visibility: hidden }`のCSSを足し、`</header>`の後・`<footer>`の前へ`<aside id="item-list-panel">`を置いた。`#window-canvas-palette`の`right`を`calc(var(--item-list-width) + var(--float-window-margin))`にし、x 790〜1032のコメントと冒頭のコメントを直した。
    *   `main.js`：`resize`の無名関数をJSDoc付きの`resizeAndRenderViews()`へ取り出して登録（4つの呼び出しの順はそのまま）。`new DisplayWiring(...)`の直後に`displayState.onChange(resizeAndRenderViews)`を登録（理由のコメント付き）。`renderCurrentState`・`renderRulers`・`resetViewToCenter`のJSDocを合わせた。
    *   `DisplayWiring.js`：`#syncFloatWindowVisibility`のJSDocだけ変更（一覧のパネルも隠し、領域の右端を変えること）。
    *   `node --test`：tests 2650 / pass 2650 / fail 0。行末：`main.js`はCRLFのまま、`index.html`はLFのまま（バイト列で確認）。

### タスク2: 行の並びと、行の操作の判定の規則
*   **作業内容** :
    *   `js/core/ItemListRules.js`（新規・LF）：`buildItemRows`・`ROW_PRESS_ACTION`・`resolveRowPressAction`・`isListLocked`・`ROW_HOVER_ACTION`・`resolveRowHover`・`isOwnHover`・`canStartNameEdit`・`resolveNameEditKey`を実装。importは`ItemTreeRules`・`InputModes`だけ。
    *   `test/core/ItemListRules.test.js`（新規・LF）：計画のテスト項目（並び・押したときの判定・ロック4通り・ホバー表1.〜6.と照会の回数・`isOwnHover`・`canStartNameEdit`全8通り・キー判定）を追加。
    *   `node --test`：tests 2681 / pass 2681 / fail 0。
    *   判断：`buildItemRows`の`name`は、アイテムに名前が無ければ空文字（`item.name ?? ''`）にした（typedefの`name: string`に合わせるため）。

### タスク3: 一覧のクリックの次の選択と、スクロールの規則
*   **作業内容** :
    *   `js/core/ListSelectionRules.js`（新規・LF）：`resolveListClickSelection`を実装。importは`SelectionRules`だけ。
    *   `js/core/ListScrollRules.js`（新規・LF）：`resolveVisibleRowRange`・`hasSelectionChanged`・`resolveSelectionScrollTop`を実装。importなし。
    *   `test/core/ListSelectionRules.test.js`・`test/core/ListScrollRules.test.js`（新規・LF）：計画のテスト項目を追加。
    *   `node --test`：tests 2719 / pass 2719 / fail 0。
    *   判断：`Shift`の結果の`ids`は`rowIds`の並び（上から）で返す（逆向きでも）。`resolveVisibleRowRange`の`overscan`は省略時0。中心の可視判定は`scrollTop <= 中心 < scrollTop + height`（下端ちょうどは見えない扱い）。`resolveSelectionScrollTop`は、中心が見えている範囲より上でも下でも、`rowHeight > height`なら上端を返す。

### タスク4: サムネイルの規則と描画
*   **作業内容** :
    *   `js/core/ThumbnailRules.js`（新規・LF）：`THUMBNAIL_SIZE_PX`・`computeThumbnailFit`・`resolveThumbnailStrokeWidth`・`buildThumbnailKey`・`needsThumbnailRedraw`を実装。importは`SpriteFitRules`だけ。余白2px・線の下限1pxは非公開の定数。
    *   `js/core/ThumbnailRenderer.js`（新規・LF）：`drawThumbnail(canvas, shape, bounds, pixelRatio)`を実装。importは`ThumbnailRules`だけ。
    *   `js/edit/ShapeExtentReader.js`：`getShapeBounds(shape)`を足した（`computeShapesBounds([shape])`）。
    *   `test/core/ThumbnailRules.test.js`・`ThumbnailRenderer.test.js`（新規・LF）、`test/edit/ShapeExtentReader.test.js`（末尾へ追加だけ）。
    *   `node --test`：tests 2742 / pass 2742 / fail 0。
    *   判断：`buildThumbnailKey`は`${pixelRatio}|${JSON.stringify(shapeData)}`。`drawThumbnail`は`getContext('2d')`が偽（null）なら描かずに終える（防御）。`ShapeExtentReader`の先頭の責務の行（3行以内）とクラスJSDocに「渡された図形1つの外枠」を足した。`ThumbnailRenderer.test.js`に実際の図形（Rect・Line・Ellipse・Curve・Path）での描画・線も塗りもない図形で何も描かないこと・描画前後の`toJSON()`不変を足し、`ShapeExtentReader.test.js`の`getShapeBounds`に線なしのテストを足した。

### タスク5: 名前を変える規則と編集操作
*   **作業内容** :
    *   `js/core/ItemAttributeRules.js`：`applyItemRename(items, id, value)`を足した（`toItems`で写し→`listItems`で探し→写しの`name`だけ書き換え。図形は`item.shape.id`、フォルダは`item.id`）。責務の行へ「名前の変更」を足した（3行以内）。
    *   `js/core/VectorModel.js`：importへ`applyItemRename`を足し、`renameItem(id, name)`を`reorderShapes`の後・`onChange`の前に置いた。責務の行・クラスJSDocを合わせた。
    *   `js/edit/ItemRenameEditor.js`（新規・LF）：`rename(id, text)`（`ShapeOrderEditor`と同じ形。変わらないときは`beginEdit`も呼ばない）。
    *   `test/core/ItemAttributeRules.test.js`（import1行の追加と末尾へ追加）、`test/core/VectorModel.renameItem.test.js`・`test/edit/ItemRenameEditor.test.js`（新規・LF）に計画のテスト項目を追加。
    *   `node --test`：tests 2764 / pass 2764 / fail 0。行末はすべてLF（バイト列で確認）。
    *   判断：`ItemRenameEditor`のテストの`deserialize`の結果は`.items`から読む。

### タスク6: 一覧のUI部品（表示・スクロール）
*   **作業内容** :
    *   `js/palette/ItemListPanel.js`（新規・LF・importなし）：`render`（差分反映・並びが違うときだけ`insertBefore`）・`getSelectedRowIds`・`getViewport`・`setScrollTop`・`getThumbnailCanvas`を実装。`scroll`→`onScroll`、`focus`→`blur()`。行は`.item-row[data-item-id]`＋`canvas.item-row-thumbnail`＋`span.item-row-name`。`onScroll`が関数でなければ`Error`、`#item-list`が無ければ`console.warn`して配線しない。
    *   `index.html`（LFのまま）：`.item-row`・`.item-row.selected`・`.item-row-thumbnail`・`.item-row-name`（`[hidden]`で消す）のCSSを足した。
    *   `node --test`：tests 2764 / pass 2764 / fail 0。
    *   判断：行の控えの`name`は初期値`null`（最初の`render`で必ず名前を書くため）。名前が空文字の行でも`textContent`・`title`は書かれる。`getSelectedRowIds`はDOMの並び（上から）の`selected`クラスから読む。`render`は編集中の行の扱いを持たない（タスク9で追加）。

### タスク7: 一覧の配線（表示・サムネイル・スクロール）
*   **作業内容** :
    *   `js/wiring/ItemListWiring.js`（新規・LF）：`new ItemListWiring({ model, shapeExtentReader })`。`ItemListPanel`を生成し、`model.onChange`・`window`の`resize`・パネルの`onScroll`で`#requestSync()`（`requestAnimationFrame`・予約中かは`#isSyncRequested`の1つ）。公開`sync({ allowScroll = true } = {})`を要件2の順で実装。`#drawVisibleThumbnails`は余裕4行（定数）・鍵`WeakMap`で`drawThumbnail`。
    *   `js/main.js`（CRLFのまま）：import・`// 7.15. 図形の一覧配線`（`// 7.14.`の後・`// 8.`の前）・`syncOptionBarTransformGroup()`の次に`itemListWiring.sync()`を明示的に1回。
    *   `node --test`：tests 2764 / pass 2764 / fail 0。
    *   判断：選ばれている行の添字は`rows`から`model.isSelected`で求めた（`getSelectedIds()`は呼ばない）。`ItemListWiring`は`onScroll`のコールバック内で`this`を使うため、`#panel`の生成前に`onScroll`が呼ばれない前提（生成中は呼ばれない）。

### タスク8: 一覧で選ぶ・行にカーソルを置く
*   **作業内容** :
    *   `js/palette/ItemListPanel.js`：コールバック`onRowClick(id, event)`・`onRowHover(id | null)`を必須で足した（関数でなければ`Error`）。`.item-list`の`click`・`mousemove`・`mouseleave`のイベント委譲（`#findRowId`が`closest('.item-row')`で行を求める。`mousedown`は`preventDefault`しない）。
    *   `js/wiring/ItemListWiring.js`：注入（`displayState`・`canvasLibrary`・`getMode`・`isDragging`・`isPicking`・`selectSelectTool`・`readCtrlModifier`）と、一時的な値`#anchorId`・`#hoveredRowId`・`#lastOpenCanvasId`を足した。`#handleRowClick`（`resolveRowPressAction`→`switchAndSelect`なら`selectSelectTool()`の後ふつうのクリック→`resolveListClickSelection`→`model.setSelection`→`sync({ allowScroll: false })`→行のホバーの当て直し）、`#handleRowHover`（`resolveRowHover`の結果に従うだけ）、`#clearOwnHover`（`clear`・`canvasLibrary.onChange`・`displayState.onChange`の3か所から使う）。`canvasLibrary.onChange`で`openCanvasId`が変われば起点を忘れ、ロック中なら自分のホバーを消す。`displayState.onChange`で隠れたら自分のホバーを消す。
    *   `js/main.js`（CRLFのまま）：`// 7.15.`の生成へ注入を足した（判定は書かない）。
    *   `node --test`：tests 2764 / pass 2764 / fail 0。行末：`main.js`はCRLF、`ItemListPanel.js`・`ItemListWiring.js`はLFのまま（バイト列で確認）。
    *   判断：`event.shiftKey`が真のときだけ`range`とした（`=== true`）。ホバーの当て直しは`#handleRowHover(id)`を呼ぶ形にし、切り替えで消えたホバーは`set`で戻る。`#lastOpenCanvasId`は生成時に`getState().openCanvasId`で初期化した。

### タスク9: 名前を変える画面
*   **作業内容** :
    *   `js/palette/ItemListPanel.js`：コールバック`onNameEditRequest`・`onNameCommit`・`resolveNameEditKey`（関数でなければ`Error`）、公開`startNameEdit(id, name)`・`cancelNameEdit()`を足した。`dblclick`（`.item-row-name`の上）で通知。出口は`#finishNameEdit(shouldCommit)`の1つ（控え`#editing`を先に`null`→値を読む→欄を除く→`<span>`を戻す→確定なら`onNameCommit`）。`keydown`は`resolveNameEditKey`の結果が`null`でなければ`preventDefault`・`stopPropagation`の後に終える。`blur`は控えが自分の欄のときだけ確定。欄は`spellcheck=false`・`autocomplete='off'`・`maxlength`なし。`mousedown`が欄の中で始まった`click`・欄の中の`click`は通知しない。`render`：無くなった行が編集中なら要素を除く前に控えを`null`、並べ替えは編集中の行を固定し`cursor`から手前の要素を末尾へ移す。
    *   `js/wiring/ItemListWiring.js`：`itemRenameEditor`の注入。`#handleNameEditRequest`（`canStartNameEdit`、`hasModifier = readCtrlModifier(event) || event.shiftKey === true`、通ったら`sync({ allowScroll: false })`の後`startNameEdit`）。確定は`itemRenameEditor.rename`を呼ぶだけ。`openCanvasId`が変わったら`panel.cancelNameEdit()`。
    *   `js/main.js`（CRLFのまま）：`ItemRenameEditor`のimportと、`// 7.15.`での生成・注入。`index.html`（LFのまま）：`.item-row-name-input`のCSS（`user-select: text`）。
    *   `node --test`：tests 2764 / pass 2764 / fail 0。行末：`main.js`はCRLF、ほかはLF（バイト列で確認）。全ファイルのJSDoc・未使用のimport・未使用の公開メソッドが無いことを確認した（`getThumbnailCanvas`等の公開メソッドはすべて`ItemListWiring`が使用）。
    *   判断：`#handleNameEditRequest`は`buildItemRows`で今の名前を求めて渡した（行が無ければ何もしない）。ダブルクリックの`dblclick`の対象は名前の`<span>`（`.item-row-name`）の上のみ。

### タスク10: 開発資料の反映その1
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`（CRLFのまま。バイト列で`\r\n`と`\n`の数が一致することを確認）を実コード（`ItemListWiring`・`ItemListPanel`・`main.js`・`index.html`・`ThumbnailRenderer`等）と照らして反映した。
    *   1章：構成図へ新しい8ファイル（`ItemListRules`・`ListSelectionRules`・`ListScrollRules`・`ThumbnailRules`・`ThumbnailRenderer`・`ItemRenameEditor`・`ItemListPanel`・`ItemListWiring`）とテスト7ファイル、`index.html`の説明（パネル・`--item-list-width`・`--canvas-area-width`が`body`の規則）、既存行の使う側・`getShapeBounds`、フォルダ分割の方針（core・edit・palette・wiring）、依存方向（例外(3)が8ファイル、規則どうしのimport、`wiring/`が`core/`のレンダラーをimport、`shapeExtentReader`の共有先）、「存在しないもの」（Phase 11-02で入ったものとやらないこと）。
    *   2章：「アイテム」の公開操作を`renameItem`へ、名前の項の追記、スタイルの読み書きの例外（サムネイルの写しの`strokeWidth`）、選択状態へ「一覧の選択の表示と`Shift`の起点」。
    *   3章：同期の経路・2.（`resizeAndRenderViews`）・4.（領域の幅）・1.（読み込み完了前）・6.（名前の変更を記録する／一覧の選択は記録しない）・8.（一覧の操作の受け付け）・15.（隠す対象に一覧・`visibility: hidden`・`displayState.onChange`の登録順）・16.（一覧での選択）・18.（頂点の選択での一覧の行）を直し、新しい節「28. 図形の一覧」を足した。4章：一覧表へ48〜53（`_doc/arch/`の新規6ファイル。タスク11で作る）を足した。
    *   `node --test`：tests 2764 / pass 2764 / fail 0。
    *   判断：節28の「発注者の決定」はRES・REQの「今回やらないこと」から読めた分だけを書いた。「確認の状況」は、実ブラウザでの確認が未実施である旨を書いた（テストプレイ後に直す）。3章14.の「図形の一覧のPhaseで…並べ替え」の古いやらないことの記述は、履歴の記述のため触れていない。
    *   （実装統括AIによる反映漏れの補正）3章28.の「発注者の決定」を、REQに「発注者の決定」と書かれた3点（幅の固定・枠いっぱいのサムネイル・図形を描くツールでは何も起きない）に直した。

### タスク11: 開発資料の反映その2
*   **作業内容** :
    *   `_doc/arch/`を実コード（`ItemListWiring`・`ItemListPanel`・`ItemListRules`等・`main.js`・`index.html`・テスト）と照らして反映した。**行末**は書き換える前にバイト列で実測し、保った：CRLF＝`01`・`02`・`03`・`04`・`11`・`12`・`13`・`14`・`16`・`33`、LF＝`20`・`23`・`27`・`32`・`36`・`37`・`46`・`47`と新規6ファイル（計画時の実測と一致。混在なし。反映後も同じことをバイト列で確認）。
    *   新規（LF）：`48_ItemListRules.md`・`49_ListSelectionRules.md`・`50_ListScrollRules.md`・`51_ThumbnailRules.md`・`52_ThumbnailRenderer.md`・`53_ItemListWiring.md`（書き方は`46`・`47`・`37`・`36`に合わせた）。
    *   更新：`01`（パネルの節・`--item-list-width`・`--canvas-area-width`が`body`の規則・z-index・隠し方・キャンバスパレットの位置・`resizeAndRenderViews`）・`02`（行数を`wc -l`の実測1216行へ、`// 7.15.`の行、注入の一覧、`resizeAndRenderViews`、起動時の`itemListWiring.sync()`、一覧の配線の項）・`03`（`renameItem`）・`04`・`23`（`resize()`が呼ばれる場面）・`11`（一覧は管理対象外）・`12`（サムネイルでの`createTransformed`・`draw`・`toJSON`の呼び出し元）・`13`（`ItemListPanel`の項）・`14`（`ItemRenameEditor`の項、`edit → core`の例外が8つ、`ShapeExtentReader.getShapeBounds`）・`16`（Phase 11-02の件数・テストできない箇所・件数）・`20`・`27`・`32`・`37`・`46`（使う側）・`33`（名前の欄・`stopPropagation`の理由）・`36`（一覧との関係・登録位置）・`47`（`applyItemRename`・使う側・件数を40件）。
    *   `16_test.md`の件数は`node --test`の実測：tests 2764 / suites 449 / pass 2764 / fail 0（作業前は 2650 / 426。差は新設7ファイル96件＋追加14件＝114）。各テストファイルの件数は`it`・`test`の数と、実測の差の合計が一致することで確かめた。`47`の`ItemAttributeRules.test.js`は29件から40件へ。
    *   `PROJECT_ARCHITECTURE.md`との食い違いの確認：4章の一覧表の48〜53のパス・ファイル名が実在する新規6ファイルと一致する。1章・3章28.の記載（モジュールの分担・同期の流れ・サムネイル・名前の編集・領域の大きさの同期・やらないこと）と、`_doc/arch/`の新しい記載に矛盾が無いことを読み比べた（`PROJECT_ARCHITECTURE.md`自体は変えていない）。
    *   判断：`ItemListPanel`・`ItemRenameEditor`の項は、既存の部品と同じく`13_palette.md`・`14_edit.md`の中の項として書いた（新規ファイルを足さない）。`02_main.md`の行数の履歴の文は、前の値（1183行）を残して今の値を先頭に足した。

## 5. 懸念事項・要確認ポイント
**計画での判断（REQに書かれていない細部）**
*   「読み込み中（キャンバスの切り替え中）」は`canvasLibrary.getState()`の`loading`または`busy`とした。`loading`は起動時にしか真にならないため。キャンバスパレットでの名前の変更・削除の処理の間（通常ごく短い）も一覧の操作を受け付けない。
*   「行が見えている」は、行の中心が見えている範囲にあることとした。
*   `Ctrl`・`Shift`を押したままのダブルクリックでは、名前の編集を始めない。
*   パン中（中ボタン・`Space`）も、行を押す・ホバー・編集の開始を受け付けない（`isDragging()`が左ドラッグと区別しないため。ほかのボタンと同じ）。
*   編集中の名前の確定は、ドラッグ中・切り替えの処理中でも受け付ける（打った名前を失わないため。位置の欄と同じ）。実際にキャンバスが切り替わったときは捨てる。
*   行の高さ36px・サムネイル28px・枠の灰色`#b0b0b0`は計画で決めた値。同じ灰色の図形は枠の上で見えない。
*   `Z`・`X`・`C`（アウトライン・背景・グリッドの切り替え）でも大きさの同期と再描画が1回余分に走る（キー1回につき1回）。

**実際の描画結果・操作で確かめてほしい箇所**
*   スクロールする箱（`.item-list`）をクリックした後のキーの働き（ブラウザによりフォーカスを受けることがあるため`blur()`で戻す）。選択が無い・並びが変わらない等でショートカットが受理されなかった矢印・`PageUp`・`PageDown`・`Home`・`End`は、ブラウザの既定で一覧がスクロールすることがある。
*   macOSの`Ctrl`＋クリックはブラウザの右クリックの扱いになる（追加・解除は`⌘`＋クリック）。
*   （タスク1）パネルを出す・隠す（Tab・🧰）と、キャンバスの領域の右端が変わるため、絵の位置は変えずに描き直しが走る。隠したとき・出したときに絵が跳ばないか、キャンバスパレット（x 790〜1032）と一覧が重ならないかを目視で確かめたい。`#ruler-horizontal`の幅が追従するかも確かめたい。
*   （タスク1・修正時の注意）`--canvas-area-width`は`body`の規則にある。`:root`へ戻すと`body.float-windows-hidden`の上書きが効かなくなる。`displayState.onChange(resizeAndRenderViews)`は`new DisplayWiring`の直後に置く順序が必要。
*   500個の絵での重さ（下の10.）。
*   （タスク9）名前の編集は、実ブラウザで確かめたい：`Enter`・`Esc`・`blur`の各出口で二重の確定が起きないか、`Esc`で選択が外れないか、編集中に重なり順の変更等で行の並びが変わっても欄が閉じないか、名前の欄の中のドラッグで行が押されないか。DOMのため自動テストは無い。
*   （タスク10）`PROJECT_ARCHITECTURE.md`の4章の表へ`_doc/arch/48`〜`53`を足した。ファイルはタスク11で作る（それまで表のパスは未存在）。節28の「確認の状況」は未実施と書いたため、テストプレイの後に直すこと。
*   （タスク11）`PROJECT_ARCHITECTURE.md`4章の一覧表の資料の置き場所は、既存の部品と同じ扱いで食い違いは無かった。`ItemListPanel`（`palette/`）・`ItemRenameEditor`（`edit/`）は、既存の`OptionBar…`・`ShapeStyleEditor`等と同じく表に個別の行を持たず、フォルダの行（`palette/`＝`13_palette.md`・`edit/`＝`14_edit.md`）に含まれる。個別の行があるのは`ItemListRules`・`ListSelectionRules`・`ListScrollRules`・`ThumbnailRules`・`ThumbnailRenderer`・`wiring/ItemListWiring`（48〜53。`core/`の規則・レンダラー・`wiring/`の既存の扱いと同じ）。1章の構成図には`ItemListPanel.js`・`ItemRenameEditor.js`の行がある。
*   （タスク11）`16_test.md`・`PROJECT_ARCHITECTURE.md`3章28.の「確認の状況」は、実ブラウザでの確認が未実施である旨を書いた。テストプレイの後に両方を直すこと。`02_main.md`の行数（1216行）は、`main.js`を変えるたびに`wc -l`で直す。
*   （タスク11）`16_test.md`冒頭近くの「注入される依存は素のオブジェクトの偽物。例外は12ファイル」の数は、`ItemRenameEditor.test.js`（実物の組み合わせ）が加わっても書き換えていない（Phase 11-01も同様に件数を直さず、新しい節の中で「数え方に加わる」と書いたため合わせた）。
*   （タスク9・修正時の注意）`ItemListPanel.render`の並べ替えは編集中の行の要素を動かさない前提（動かすと`blur`で確定する）。`#finishNameEdit`以外から欄を除かない。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0. **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。**絵A**：新しいキャンバスに、直線（`1`）・曲線（`2`）・弧（`3`）・矩形（`4`）・円（`5`）を1つずつと、直線のツールで3点以上打った線（「パス」になる）、黒い線だけの図形、白い塗りの図形（矩形を描いて`V`で選び`D`を押す＝線が黒・塗りが白）を描く。**絵B（図形の多い絵）**：別の新しいキャンバスに8個ほど描き、「`Ctrl`+`A`（全選択）→ `Ctrl`+`D`（複製）」を6回繰り返すと512個になる（複製は前面に入り、複製した図形だけが選ばれるため、毎回`Ctrl`+`A`をし直すと倍になる）。
1. **場所**：右端に一覧（幅240px）が出て、キャンバスと横の定規がその分せまくなる。カーソルの座標・定規の印・クリックの位置がずれない。⛶・`Ctrl`+`0`・🎯・`Ctrl`+`+`/`-`が、せまくなった領域の中央を基準に働く。📁を押すと、キャンバスパレットが一覧に重ならずに開く（見出しをドラッグすれば一覧の上へも動かせ、一覧より前面に出る）。ウィンドウの大きさを変えても崩れない。
2. **`Tab`**：`Tab`で一覧もほかのパレットと一緒に隠れ、キャンバスと横の定規が右端まで広がる。絵の位置と倍率は動かない。もう一度`Tab`で戻る。🧰でも同じ。隠している間に📁を押すと、一覧も一緒に出てキャンバスパレットが開く。（入力欄・色の欄にカーソルがある間の`Tab`は、今までどおりフォーカスの移動。）
3. **並び**：上の行が前面になっている。描く・消す（`V`で`Delete`）・重なり順を変える（`Home`/`PageUp`/`PageDown`/`End`）・結合する（`J`）・取り消す/やり直す・キャンバスを切り替えると、一覧も合う。描いている途中の図形は行にならず、確定すると増える。図形が多いとスクロールできる。
4. **サムネイルと名前**：各行に図形の絵と名前が出る。黒い線も白い塗りも見える。小さい図形も枠いっぱいに出る。色・形・太さを変えるとサムネイルも変わる（ドラッグ中も追従し、離した後に正しい）。新しく描くと「パス 4」のような名前の行がいちばん上に増える（名前は確定した種類による。直線のツールで2点なら「直線 n」、3点以上なら「パス n」。既存の線の端点につなげて終えたときは、行は増えず元の線が伸びる）。長い名前は「…」で省かれ、カーソルを置くと全体が出る。背景の白/黒（`X`）・アウトライン（`Z`）でサムネイルは変わらない。
5. **一覧で選ぶ**：`V`で行を押すとキャンバスで選ばれる（外枠とハンドルが出る。決まるのは離したとき）。`Ctrl`＋クリックで追加・解除、`Shift`＋クリックで起点からの範囲が選ばれる（それまでの選択は置き換わる。上向きもできる）。そのまま`Delete`・矢印キー・`Ctrl`+`C`・`Ctrl`+`D`・`V`・`A`・`Tab`が働く。一覧の空いている所を押しても選択は変わらない。線の太さや位置の欄に打って`Enter`を押さずに行を押すと、その入力が確定する（確定の対象は、行を押す前に選んでいた図形）。
6. **キャンバスで選ぶ**：キャンバスでクリック・`Ctrl`＋クリック・範囲選択・`Ctrl`+`A`・`Ctrl`+`I`・貼り付け・複製をすると行も選ばれ、選ばれた行が1つも見えていなければ、いちばん上の選ばれた行までスクロールする。1つでも見えていればスクロールは動かない。一覧で押したときは動かない。
7. **ほかのツール**：`A`で行を押すと、`A`のままその図形の頂点が出る（円・弧には頂点のハンドルが無いため、行だけが選ばれた見た目になる。`A`で`Delete`は今までどおり何もしない）。`Ctrl`・`Shift`も`V`と同じ。`H`・スポイト（`I`）の待ち受け中に行を押すと`V`に切り替わって選ばれ、待ち受けは終わる（色は取り込まれない）。図形を描くツール（`1`〜`5`）で行を押しても何も起きず、線を引いている途中でも線が消えない（キャンバスへ戻って続きを打てる）。
8. **カーソル**：行にカーソルを置くと、キャンバスの図形が、カーソルを置いたときの見た目（青い半透明の太線）になる。外すと消える。どのツールでも同じ。キャンバスでドラッグしている間に一覧の上を通ってもならない。
9. **名前を変える**：行の名前の所をダブルクリックすると欄になり、名前が全部選ばれている。`Enter`・ほかの所を押すで確定、`Esc`で取りやめ（選択は外れない）、空・空白だけにすると元に戻る。日本語の変換中の`Enter`・`Esc`では確定・取りやめをしない。編集中は`Delete`・`V`・`Space`等がキャンバスに効かない。`Ctrl`+`Z`1回で戻る（欄から出た後。欄の中の`Ctrl`+`Z`は文字の取り消し）。ページを開き直しても残る。図形を描くツールでもでき、ツール・選択・引いている途中の線は変わらない（線を引いている途中の`Ctrl`+`Z`は、今までどおり先に最後の点を消す）。
10. **重さ**：絵Bで、ドラッグ・範囲選択・カーソルの移動・一覧のスクロールが引っかからない。`Ctrl`+`A`で全部選んでドラッグしたときの重さが、本作業の前からある分を超えて増えていない。
11. **ほかが今までどおり**：描く・選ぶ・動かす・変形・頂点・角・結合・色・整列・重なり順・コピー・複製・保存・書き出し・開く・インポートが今までどおり動く。起動時・キャンバスの切り替え中に一覧を押しても何も起きない。
