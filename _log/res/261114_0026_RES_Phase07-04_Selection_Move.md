# RES: 作業計画・作業レポート (Phase 07-04) : 選択と移動の操作（修飾キーでの選択・複製しながらの移動・方向の限定・選択の反転・同じ位置に貼り付け・色を既定へ戻す・スポイト）
* 参照元REQ: `./_log/req/261114_0009_REQ_Phase07-04_Selection_Move.md`

## 1. 作業目的
選択と移動の操作を足す。`Ctrl`+クリック（選択へ1つずつ追加・解除）、`Ctrl`+範囲選択（選択へ追加）、`Alt`+ドラッグ（複製して動かす）、`Shift`+ドラッグ（移動を縦・横・45°に限定）、`Ctrl`+`I`（選択の反転）、`Ctrl`+`Shift`+`V`（同じ位置に貼り付け）、`D`（線を黒・塗りを白にする）、スポイト（`I`・ツールパレットのボタン）を入れ、`Alt`の単独押下でブラウザのメニューへフォーカスが移らないようにする。
* 「`Ctrl`」はすべてmacOSの`⌘`を含む（マウスの修飾キーは`event.ctrlKey || event.metaKey`）。
* 作業データ形式・書き出し形式は変えない（版はどちらも2）。足す状態（スポイトの待ち受け・ドラッグ中の`Alt`の記憶・移動量の作業用フィールド）は作業データ・履歴・ブラウザの保存先に入れない。
* 修飾キーを押さず、足したキーを使わず、スポイトの待ち受けでないときの操作の結果は今と変えない（変わるのはツールパレットのボタンが1つ増えることと、`Alt`の単独押下でメニューへフォーカスが移らなくなることだけ）。
* 当たり分類の規則（`js/core/PointHitRules.js`）・範囲選択の当たり（`intersectsRect`）・ドラッグの閾値・click抑止の規則は変えない。
* 本計画は要件10の制約（`InputTracker`へは呼び出し・配線・作業用フィールドだけ）の中で作れると判断した（DIR変更提案は不要）。

## 2. アーキテクチャ設計

### 全体の分担（要件10のまとめ）
| 種類 | 置き場所 | 内容 |
| --- | --- | --- |
| 規則（状態なし・importなし・DOMなし） | `core/SelectionRules.js`（新設） | クリック・範囲選択の次の選択、選択の反転 |
| 規則（同上） | `core/MoveDirectionRules.js`（新設） | 移動量を横・縦・斜め45°の直線へ限定 |
| 部品（状態なし・DOMの購読） | `core/AltKeyGuard.js`（新設） | `Alt`キー自身の`keydown`・`keyup`の`preventDefault()` |
| 規則（状態なし） | `edit/StylePanelRules.js`（追加） | `D`の値`RESET_COLORS_STYLE`、手本の図形から取り込む値`sampleStyleFromShape` |
| 手順 | `edit/ShapeInserter.js`（追加） | 記録しない追加の入口`insertDocumentWithinEdit` |
| 手順 | `edit/ClipboardController.js`（追加） | `pasteInPlace`（同じ位置に貼り付け）・`duplicateInPlaceWithinEdit`（`Alt`+ドラッグの記録しない複製） |
| 手順 | `edit/ShapeStyleEditor.js`（追加） | スタイルをまとめて当てる入口`applyStyle`と`D`用の`resetColors` |
| 状態の持ち主＋手順 | `edit/StyleEyedropper.js`（新設） | スポイトの待ち受けの状態と変更の通知、取り込みの手順 |
| 配線 | `core/InputTracker.js` | 修飾キーの読み取り・規則の関数の呼び出し・注入された補助（第7引数）の呼び出し・作業用フィールド |
| 規則（状態なし） | `core/ToolRules.js`（追加） | スポイトのツールの識別子・`resolveActiveTool`の第3引数 |
| 対応表 | `core/KeyboardShortcuts.js`（追加） | `Ctrl`+`I`・`Ctrl`+`Shift`+`V`・`D`・`I`の4エントリ |
| 配線・操作関数 | `main.js` | 注入・操作関数（判定・計算を持たない）・同期の登録 |
| 画面 | `index.html` | スポイトのボタン（💉。仮）とツールパレットのCSSコメント |

依存方向：`core/InputTracker` → `core/SelectionRules`・`core/MoveDirectionRules`（`core/`内。どちらも何もimportしない）。`core/AltKeyGuard` → `core/InputTracker`（`isTextInputElement`のみ。`InputTracker`は`AltKeyGuard`をimportしない）。`edit/StyleEyedropper` → `edit/StylePanelRules`（`edit/`内の例外を1つ足す。`StylePanelRules`は何もimportしない）。`core/`から`edit/`・`io/`・`palette/`へのimportは足さない。`InputTracker`は`edit/`・`io/`をimportせず、`main.js`が注入した関数を呼ぶだけ（`EndpointSnapper`・`editRecorder`と同じ形）。

### 要件1: `Ctrl`+クリック・`Ctrl`+範囲選択（選択へ追加・解除）
* **規則**（`core/SelectionRules.js`。状態なし・importなし・DOMなし。引数を書き換えず、新しい配列を返す）：
  * typedef`SelectionChange`：`{ type: 'set', ids: string[] }`（`setSelection(ids)`へ渡す）・`{ type: 'clear' }`（`clearSelection()`）・`null`（何もしない）。`Ctrl`なしで今と同じ`VectorModel`の呼び出し（回数と引数）を再現するため、「置き換え」と「全解除」を区別して返す。
  * `resolveClickSelection(selectedIds, hitId, additive)`：
    * `additive`偽：`hitId`があれば`set([hitId])`、無ければ`selectedIds`が空でなければ`clear`、空なら`null`（今の`handleClick`と同じ）。
    * `additive`真：`hitId`が無ければ`null`（空白は解除しない）。`hitId`が選択中なら`set(selectedIdsからhitIdを除いたもの)`、未選択なら`set([...selectedIds, hitId])`。
  * `resolveMarqueeSelection(selectedIds, hitIds, additive)`：
    * `additive`偽：`set([...hitIds])`（0件でも`set([])`。今の`#commitMarquee`の`setSelection(ids)`と同じ）。
    * `additive`真：`hitIds`が0件なら`null`。それ以外は`set(selectedIdsの並び＋hitIdsのうち未選択のもの)`（重複しない）。
  * `invertSelection(allIds, selectedIds)`：`allIds`のうち`selectedIds`に含まれないものを`allIds`の並びで返す（要件5）。
* **`InputTracker`の配線**（要件10の範囲）：
  * 非公開のモジュール関数`hasCtrlModifier(event)`（`event.ctrlKey || event.metaKey`。exportしない）を足す。
  * 非公開のメソッド`#applySelectionChange(change)`を足す：`null`なら何もしない、`clear`なら`model.clearSelection()`、`set`なら`model.setSelection(change.ids)`（受け渡しだけ）。
  * `handleClick`の選択モードの分岐：ハンドルの上は今のまま`return`（`Ctrl`の有無によらない）。それ以外は`this.#applySelectionChange(resolveClickSelection(this.model.getSelectedIds(), hit.bodyId, hasCtrlModifier(event)))`。`Ctrl`を見るのは`click`イベント（確定の時点）。
  * `#commitMarquee(event)`：`intersectsRect`で求めた`ids`の求め方・矩形の正規化・`clearSelectionRect()`は今のまま。最後の`setSelection(ids)`を`this.#applySelectionChange(resolveMarqueeSelection(this.model.getSelectedIds(), ids, hasCtrlModifier(event)))`へ替える（`event`は`#onLeftDragEnd`へ渡るイベント＝通常`mouseup`、取りこぼし時`mousemove`）。
  * `handleMouseDown`の押下時の分岐の表は`Ctrl`で変えない（2026-11-14 発注者の決定）。選択中の図形を`Ctrl`で押して閾値以内で離すと、直後の`click`が「選択中なら外す」で処理される。閾値を超えると今どおり移動し、直後の`click`は抑止される（下地：Phase 07-05の`Ctrl`ドラッグ）。
  * ホバー・カーソルは`Ctrl`で変えない（`handleMouseMove`・`#resolveCursor`は要件1では触れない）。
* **`Ctrl`なしの不変**：`resolveClickSelection(…, false)`・`resolveMarqueeSelection(…, false)`の結果は今の呼び出しと1対1で一致する（`setSelection([bodyId])`／`clearSelection()`（選択が空でないときだけ）／何もしない、範囲選択は`setSelection(ids)`）。

### 要件2: `Shift`+ドラッグ（移動を縦・横・45°に限定）
* **規則**（`core/MoveDirectionRules.js`。状態なし・importなし・DOMなし）：
  * `constrainMoveDirection(dx, dy)` → `{ dx, dy }`（新しいオブジェクト）。有限の数値を前提とする。
  * 求め方（正射影。浮動小数の誤差で直線から外れないよう、三角関数を使わず場合分けする）：`ax = |dx|`・`ay = |dy|`・`T = Math.SQRT2 - 1`（tan 22.5°。定数として定義）。
    * `ax === 0 && ay === 0`：`{ dx, dy }`のまま返す（移動量0はそのまま）。
    * `ay <= ax * T`：横の直線へ`{ dx, dy: 0 }`。
    * それ以外で`ax <= ay * T`：縦の直線へ`{ dx: 0, dy }`。
    * それ以外：斜めの直線へ`s = (ax + ay) / 2`として`{ dx: Math.sign(dx) * s, dy: Math.sign(dy) * s }`（右下がり・右上がりのうち近い方。`|dx| === |dy|`が厳密に成り立つ）。
    * 境界（22.5°ちょうど）は`<=`により横・縦の側に決まり、同じ入力に常に同じ結果を返す。
* **`InputTracker`の移動量の求め方の変更**（`MOVING_SELECTION`だけ）：
  * 公開フィールド`lastCursor`（直前のカーソル位置。参照は`InputTracker.js`内だけ）を廃止し、作業用フィールド`#moveOrigin`（押した位置。ワールド座標）と`#appliedMoveDelta`（すでに図形へ反映した移動量`{dx, dy}`）に置き換える。`DRAGGING_HANDLE`は今も`lastCursor`を頂点の更新に使っていないため、押下点を記憶しなくなっても動きは変わらない。
  * `#beginLeftDrag`：今の`this.lastCursor = isMarquee ? null : point;`を、`MOVING_SELECTION`のときだけ`#moveOrigin = point`・`#appliedMoveDelta = { dx: 0, dy: 0 }`（それ以外は`null`）にする形へ替える。
  * `#applyLeftDragUpdate`の`MOVING_SELECTION`：押した位置からの移動量`{ dx: x - origin.x, dy: y - origin.y }`を求め → 非公開のメソッド`#resolveMoveDelta(rawDelta, event)`（**押した位置からの移動量を加工する唯一の箇所**。`event.shiftKey`なら`constrainMoveDirection`、そうでなければそのまま。Phase 07-05の丸めはここへ足す）で加工し → `model.moveShapes(model.getSelectedIds(), target.dx - applied.dx, target.dy - applied.dy)`を毎回1回呼び（差分0でも呼ぶ。今と同じ）→ `#appliedMoveDelta = target`。
  * `Shift`を見るのは追従のたびのイベント（`mousemove`・ドラッグ中の`wheel`の`shiftKey`）。キーの購読は足さない。
  * `#finishLeftDrag`：`lastCursor = null`を`#moveOrigin = null`・`#appliedMoveDelta = null`へ替える（`#resetSnapState()`の位置・`commitEdit()`の後という順は変えない）。
  * `Shift`なしの結果：最終位置は「押した位置からの移動量」で決まり、今の「直前位置との差分の積み上げ」と浮動小数の誤差の範囲で一致する。閾値分は最初の更新でまとめて反映され、ズームでの追従し直し・更新1回につき`moveShapes`の通知1回も今と同じ。
  * 履歴の単位・click抑止・中断の扱いは変えない。

### 要件3: `Alt`+ドラッグ（複製して動かす）
* **記録しない追加の入口**（`edit/ShapeInserter.js`）：`insertDocument`の本体を非公開の`#insert(documentData, dx, dy, record)`へ移し、`insertDocument(documentData, dx = 0, dy = 0)`は`#insert(…, true)`（働き・戻り値・記録の単位は今のまま）、新しい公開メソッド`insertDocumentWithinEdit(documentData, dx = 0, dy = 0)`は`#insert(…, false)`（`beginEdit()`／`commitEdit()`を呼ばない。呼び出し側が開いている編集操作の中で呼ぶ）。戻り値は同じ`InsertResult`。
* **複製の手順**（`edit/ClipboardController.js`）：`duplicateInPlaceWithinEdit()`を足す。選択中の図形を`#serializeSelection()`（描画順。今の`copy`・`cut`・`duplicate`と同じ取り出し。規則を二重に書かない）で作業データにし、`inserter.insertDocumentWithinEdit(documentData, 0, 0)`で同じ位置に新しいidで最前面へ追加して複製だけを選択する。選択が空なら何もせず`false`。クリップボードの内容・段数は変えない。記録しない（開いている編集操作の中で呼ぶ前提）。
  * `ClipboardController`へ置く理由：選択中の図形の取り出しと作業データへの変換（`#serializeSelection`）が既にあり、新しいクラスに分けると同じ取り出しを二重に書くため。責務（「複製の手順」）の範囲内。
* **`InputTracker`の配線**：
  * コンストラクタの第7引数`inputAssist`（typedef`InputAssist`。既定`NO_INPUT_ASSIST`）を足す。既存の6つの引数の意味・省略時の動きは変えない。項目ごとに、関数でなければ既定へ置き換える（省略は正当なため`console.warn`は出さない）。本要件で足す項目：`duplicateSelection(): void`（選択中の図形を同じ位置に複製して複製だけを選択する。開いている編集操作の中で呼ばれ、記録しない。既定は何もしない＝複製しない）。`InputTracker`は図形の複製の仕方・idの採番を知らない。
  * 作業用フィールド`#duplicateOnMove`（真偽値。押した時点の`event.altKey`）。`handleMouseDown`の`MOVING_SELECTION`の2か所（移動用のハンドル・選択中の図形の本体）を、非公開のメソッド`#beginMoveSelection(event, point)`（`#beginLeftDrag(event, MOVING_SELECTION, point)`を呼び、開始できたときだけ`#duplicateOnMove = event.altKey`）の呼び出しへ替える。頂点のハンドル・範囲選択では立てない。
  * `#onLeftDragStart`：今の`beginEdit()`の後に、`MOVING_SELECTION`かつ`#duplicateOnMove`なら`this.#inputAssist.duplicateSelection()`を呼ぶ。以後の追従は`model.getSelectedIds()`＝複製を動かす。
  * `#finishLeftDrag`：`#duplicateOnMove = false`。
  * 閾値以内で離したときは`#onLeftDragStart`が呼ばれないため複製しない（直後の`click`は今の規則）。押した後の`Alt`は見ない（途中で切り替わらない）。
* **履歴**：閾値超過時の`beginEdit()`（元の図形が選択されている状態）→ 複製 → 移動 → `#finishLeftDrag`の`commitEdit()`で1件。入れ子にならない。中断（`blur`等）も今の規則どおり残った変化が1件。
* **`main.js`の注入**：`new InputTracker(…, () => displayState.isOutline(), { duplicateSelection: () => { clipboardController.duplicateInPlaceWithinEdit(); } })`。`clipboardController`は後の「// 7.5.」で`const`宣言されるが、呼ばれるのはドラッグ中（起動完了後）だけで、`InputTracker`のコンストラクタは`duplicateSelection`を呼ばないため問題ない（既存の`inputTracker`の前方参照と同じ扱い。コメントに書く）。

### 要件4: `Alt`を単独で押して離したときの抑止
* `core/AltKeyGuard.js`（新設。クラス`AltKeyGuard`）：コンストラクタで`document`の`keydown`・`keyup`を購読し、ハンドラは「`event.key === 'Alt'`かつ`event.ctrlKey`が偽かつ`isTextInputElement(document.activeElement)`が偽」のときだけ`event.preventDefault()`する。状態を持たない。公開メソッドなし。
  * `AltGr`は`event.key`が`'AltGraph'`のため一致しない。`Ctrl`と同時（`ctrlKey`真）も対象外。`Alt`+ほかのキーは、ほかのキーのイベントの`key`が`'Alt'`でないため奪わない。
  * importは`./InputTracker.js`の`isTextInputElement`のみ。モジュールの最上位でDOMに触れない（`document`の参照はコンストラクタの中だけ）。
* `main.js`の「// 8.」で`new KeyboardShortcuts(…)`の後に`new AltKeyGuard();`（インスタンスを保持しない）。`InputTracker`・`KeyboardShortcuts`には入れない（`KeyboardShortcuts`は`keyup`を購読しないまま、「`Alt`押下中は常に不一致」の規則も変えない）。

### 要件5: 選択の反転（`Ctrl`+`I`）
* 規則は`SelectionRules.invertSelection`（要件1）。
* `main.js`の操作関数`performInvertSelection()`（「// 8.」の`zoomAtCanvasCenter`の近く）：`ensureSelectMode()`（下記）→ `model.setSelection(invertSelection(model.getShapes().map((shape) => shape.id), model.getSelectedIds()))`。規則の結果をモデルへ渡すだけで判定を持たない。編集操作として記録しない。`InputTracker`へは入れない。
* 選択の状態以外では、`ensureSelectMode()`が先に`applyMode(OperationMode.SELECT)`で切り替える（選択は空になるため結果は全選択。作成途中の図形は`setMode`の中断で破棄）。スポイトの待ち受け中は`applyMode`を通らないため待ち受けは続く。
* キー：`{ codes: ['KeyI'], ctrl: true, shift: FORBIDDEN, repeatable: false, action: 'invertSelection' }`。コールバックは`performInvertSelection()`の後に常に`true`。
* **`ensureSelectMode()`**（`main.js`の「// 7.」の`applyMode`の近くに新設）：`if (inputTracker.getMode() !== OperationMode.SELECT) { applyMode(OperationMode.SELECT); }`。全選択・貼り付け・同じ位置に貼り付け・選択の反転・スポイトの開始が共通に使う（同じ前処理を二重に書かない）。既存の`selectAll`のコールバックの同じ3行もこの呼び出しへ替える（働きは同じ）。

### 要件6: 同じ位置に貼り付け（`Ctrl`+`Shift`+`V`）
* `ClipboardController.pasteInPlace()`：クリップボードが空なら`false`。`inserter.insertDocument(documentData, 0, 0)`（追加・id採番・選択・1件の記録は`ShapeInserter`）。段数を読まず、変えない。1件以上追加したら`true`。
* `main.js`：今の`paste`のコールバックの前処理を操作関数`performPaste(pasteDocument)`（「// 7.5.」の`clipboardController`の生成の後）へ移し、`paste`と`pasteInPlace`の両方が使う：`clipboardController.isEmpty()`なら何もせず`true` → `ensureSelectMode()` → `pasteDocument()` → `true`。`paste: () => performPaste(() => clipboardController.paste())`、`pasteInPlace: () => performPaste(() => clipboardController.pasteInPlace())`。今の`paste`の働きは変わらない。
* キー：`{ codes: ['KeyV'], ctrl: true, shift: REQUIRED, repeatable: false, action: 'pasteInPlace' }`（`Ctrl`+`V`（FORBIDDEN）・`V`（`ctrl: false`）と排他的）。

### 要件7: `D`（線を黒・塗りを白にする）と、スタイルをまとめて当てる入口
* **値の定義**（`edit/StylePanelRules.js`）：
  * typedef`StyleApplication`：`{ strokeColor?: (string|null), fillColor?: (string|null), strokeWidth?: number }`。自身のプロパティとして持つ項目だけを当てる。`strokeColor`の`null`＝線なし・文字列＝線ありでその色（塗りも同じ）。
  * 定数`RESET_COLORS_STYLE = Object.freeze({ strokeColor: '#000000', fillColor: '#ffffff' })`（`D`の値。線あり黒・塗りあり白・太さは含めない＝変えない）。唯一の定義箇所。
  * 起動時の既定（`core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE`＝線あり黒・**塗りなし**・塗りの色は白）とは別の値の組として別々に定義する（`edit/`と`core/`の依存方向により`StylePanelRules`は`VectorModel`をimportしない、かつ塗りの有無が違うため）。両方のコメントに互いの存在と「色の値が重なるが別の定義」であることを書く（`VectorModel.js`はコメントのみ）。
* **入口**（`edit/ShapeStyleEditor.js`）：
  * `applyStyle(style)`：(1) `#finishPreview()`。(2) `style`が`strokeColor`・`fillColor`・`strokeWidth`のどれも自身のプロパティとして持たなければ`false`。(3) 選択中の図形があれば、各図形について当てる項目（線の色・太さは全図形、塗りの色は`isFillable()`が真の図形だけ。`COLOR_ITEMS`の`selectTargets`の規則と同じ）を集めた`ShapeStyleChange`の配列を作り、1件以上あれば`#recordEdit(() => model.updateShapeStyles(changes))`の1回だけで反映する（1件の編集操作。変わらなければ`HistoryManager`が記録しない）。(4) 選択の有無によらず、直前に使った値へ`updateNewShapeStyle`の1回で写す：色が`null`なら`[enabledKey]: false`（色は変えない）、文字列なら`[enabledKey]: true`と色、太さはその値。(5) `true`。値の検証・変換はしない（スポイトの「そのまま写す」のため。オプションバー由来の値は既存のメソッドが検証済み）。
  * `resetColors()`：`return this.applyStyle(RESET_COLORS_STYLE)`（`D`用の入口。`main.js`が値を知らずに済む）。
  * 既存の公開メソッドの働きは変えない。既存のメソッドを続けて呼ぶ形にしない。直前に使った値を更新するのは引き続き本クラスだけ。
* **`D`の動き**：選択あり＝選択中の全図形の線を黒・塗れる形の塗りを白にする1件の記録と、直前に使った値を線あり黒・塗りあり白（塗れる形が無い選択でも塗りの直前に使った値は更新）。選択なし＝直前に使った値だけ（記録しない）。太さは変えない。どの状態でも働き、操作モードを切り替えない（作成途中の図形は`updateNewShapeStyle`の既存の規則で追従）。表示は`model.onChange`の既存の同期。
* キー：`{ codes: ['KeyD'], ctrl: false, shift: FORBIDDEN, repeatable: false, action: 'resetColors' }`。コールバックは`shapeStyleEditor.resetColors()`の後に常に`true`。

### 要件8: スポイト（`I`・ツールパレットのボタン）
* **取り込む値の規則**（`edit/StylePanelRules.js`）：`sampleStyleFromShape(shape)` → `StyleApplication`。`{ strokeColor: shape.strokeColor, strokeWidth: shape.strokeWidth }`に、`shape.isFillable()`が真のときだけ`fillColor: shape.fillColor`を足した新しいオブジェクト。検証・丸め・色の形式の変換をしない。図形を書き換えない。
* **待ち受けの持ち主と取り込みの手順**（`edit/StyleEyedropper.js`新設。クラス`StyleEyedropper`。DOM・操作モード・`InputTracker`・ボタンを知らない）：
  * コンストラクタ`({ model, applyStyle })`：`model`は`getShapes()`だけ使う。`applyStyle`は`(style) => boolean`（実体は`main.js`が注入する`shapeStyleEditor.applyStyle`の呼び出し）。`applyStyle`が関数でなければ`Error`をthrow（`ClipboardController`の`deleteSelection`と同じ形）。
  * `isPicking()`、`start()`（待ち受けでなければ待ち受けにして通知1回・`true`。すでに待ち受けなら何もせず`false`）、`stop()`（待ち受けならやめて通知1回・`true`。でなければ`false`）、`cancelPicking(fallback)`（`Esc`用。待ち受け中なら`stop()`して`true`、待ち受けでなければ`fallback()`を呼んでその戻り値を返す。判定を`main.js`に置かないため）、`pickFrom(shapeId)`（待ち受けでなければ`false`。idの図形が無ければ何もせず`false`（待ち受けは続く・通知なし）。あれば`applyStyle(sampleStyleFromShape(shape))` → `stop()` → `true`）、`onChange(callback)`（関数でなければ無視。待ち受けの変化のたびに通知）。
  * 状態は作業データ・履歴のスナップショット・`VectorModel`に入れない。
* **`InputTracker`の配線**（第7引数`InputAssist`へ項目を足す。既定は待ち受けなし＝今と同じ）：`isPickingShape(): boolean`（クリックした図形を外へ渡す待ち受け中か）・`pickShape(shapeId): void`（待ち受け中にクリックした図形を渡す）。`InputTracker`はスポイト・スタイルという言葉を知らず、図形のスタイルのプロパティを読まない。
  * `handleMouseDown`：選択モード・IDLEの分岐の先頭（`#classifyPoint`の前）で`isPickingShape()`なら`return`（左ボタンの押下で何も始めない）。中ボタン・`Space`・キャンバス移動モードのパンはそれより前の判定のため今どおり働く。
  * `handleClick`：選択モードの分岐で`#classifyPoint`の直後、ハンドルの判定より前に`isPickingShape()`なら、`hit.bodyId`があれば`pickShape(hit.bodyId)`を呼び、いずれにしても`return`（選択は変えない。`Ctrl`も見ない。空白では何もせず待ち受けが続く）。当たりは`#classifyPoint`の`bodyId`（アウトライン表示の規則もそのまま）。
  * `#resolveCursor`：「(3)選択モード以外 → `'default'`」の後、「(4)DRAGGING_HANDLE・MOVING_SELECTION」の前に「待ち受け中 → `'cell'`」を足す（パン中・`Space`押下中の`'grabbing'`・`'grab'`は先に判定されるため優先順は今のまま）。
  * `handleMouseMove`は変えない（待ち受け中も選択モードのIDLEのホバーの強調が今どおり働く）。取り込んだ直後・`I`を押した直後のカーソルの形は、次にマウスを動かすまで前のまま（専用の再評価は足さない）。
* **ツールの一覧と押し込み**（`core/ToolRules.js`）：
  * `export const EYEDROPPER_TOOL_ID = 'eyedropper'`（操作モードの値でも図形種別の値でもない独自の識別子。JSDocの「識別子の約束」に書く）。
  * `TOOL_IDS = [OperationMode.SELECT, OperationMode.PAN, EYEDROPPER_TOOL_ID, ...SHAPE_TYPES]`（キャンバス移動の次）。
  * `resolveActiveTool(mode, shapeType, picking = false)`：`picking === true`なら操作モードによらず`EYEDROPPER_TOOL_ID`。省略・偽なら今と同じ結果。
* **同期の経路**：`styleEyedropper.onChange(syncToolPalette)`を1つ足す（開発資料3章冒頭「同期の経路」の一覧へ1つ足す通知。登録先はツールパレットの押し込みの`syncToolPalette`だけで、キャンバスの再描画はしない）。理由：取り込みはキャンバスのクリック（`InputTracker` → 補助 → `StyleEyedropper`）で起き、`applyMode`・`applyShapeType`を通らないため、既存の経路では押し込みが追従しない。`I`・ボタン・`Esc`・`applyMode`でのやめる・取り込みのすべてが`start()`／`stop()`の通知を通るため、押し込みは常に追従する。`syncToolPalette`は`resolveActiveTool(inputTracker.getMode(), inputTracker.getShapeType(), styleEyedropper.isPicking())`。
* **`main.js`の配線**：
  * 生成位置：「// 4.」で`inputTracker`より前に`const styleEyedropper = new StyleEyedropper({ model, applyStyle: (style) => shapeStyleEditor.applyStyle(style) })`。`InputTracker`のコンストラクタが`#updateCursor()` → `#resolveCursor` → `isPickingShape()`を呼ぶため、`styleEyedropper`は`inputTracker`より先に生成しておく必要がある（後で宣言すると一時的デッドゾーンで`ReferenceError`）。`shapeStyleEditor`は「// 7.7.」で後に宣言されるが、`applyStyle`が呼ばれるのは取り込み時（起動完了後）だけ。
  * 注入：第7引数へ`isPickingShape: () => styleEyedropper.isPicking()`・`pickShape: (shapeId) => { styleEyedropper.pickFrom(shapeId); }`を足す。
  * 操作関数`startEyedropper()`（「// 7.」）：`ensureSelectMode()` → `styleEyedropper.start()`。キー`I`とボタンの同一経路。すでに待ち受けなら何も変わらない。
  * `toolActions`へ`[EYEDROPPER_TOOL_ID]: () => startEyedropper()`（並びは`TOOL_IDS`と同じ位置）。
  * `applyMode(mode)`：`inputTracker.setMode(mode)` → `styleEyedropper.stop()` → `syncToolPalette()`（`applyMode`を通ったら必ずやめる。`stop()`の通知による`syncToolPalette`と合わせて2回呼ばれ得るが、同じ結果で害はない）。待ち受けに入る操作は`ensureSelectMode()`の後に`start()`するため、切り替えの後に待ち受けになる。
  * `Esc`：`cancel: () => styleEyedropper.cancelPicking(() => inputTracker.cancelDraftOrClearSelection())`（`InputTracker.cancelDraftOrClearSelection`は変えない）。
  * キー：`{ codes: ['KeyI'], ctrl: false, shift: FORBIDDEN, repeatable: false, action: 'startEyedropper' }`。コールバックは`startEyedropper()`の後に常に`true`。
* **待ち受けが続く／やめる**：やめる＝`Esc`（待ち受けだけ。選択は残る）・`V`・`H`・`P`・数字キー・ツールパレットのほかのボタン（いずれも`applyMode`を通る）・`applyMode`を通る操作（インポート・キャンバスの切り替え・選択の状態以外からの貼り付け等）・取り込み。続く＝取り消し・やり直し（`abortOngoingOperation`は`applyMode`ではない）・全選択・選択の反転・削除・`D`・表示の切り替え・複製（`Ctrl`+`D`）・選択の状態での貼り付け（`applyMode`を通らない）。
* **`index.html`**：ツールパレットの最初のまとまりの`#tool-pan`の下に`<button type="button" id="tool-eyedropper" class="tool-btn icon-btn" title="スポイト (I)">💉</button>`（アイコンは仮。記述はこの1か所。`aria-pressed`なし）。ツールパレットのCSSコメントの縦の範囲を実態へ改める（本体約265px→約301px、`y 68〜約374`→`y 68〜約410`。1280×800でステータスバーの上端772pxより上のまま）。
* **直前に使った値への写し方の確認（REQ要件8の指示による実コードの確認結果）**：
  * `VectorModel.updateNewShapeStyle(patch)`は5つのキーを検証せずそのまま代入し、値が変わったときだけ通知1回、作成中の図形があれば`#toShapeStyle()`で追従させる。`strokeEnabled: false`だけを渡せば色は保たれる。小数の太さ（例2.5）・任意の色の文字列（`'red'`等）も受け付け、以後描く図形にそのまま入る。問題なし。
  * `StylePanelRules.buildStylePanelView`：選択なしのとき`newShapeColorView`は`toColorInputValue`で変換できない色（`'red'`・`rgb(...)`等）を「覚えている色」で表示し、`colorNote`は常に`''`（斜線の覆いは出ない）。太さは値をそのまま出す（2.5は欄に2.5と出る）。選択ありのときは選択中の図形から決めるため、変換できない色は斜線の覆い（表示できない色）になる。いずれも例外は起きず停止しない。「選択なしで変換できない色を取り込むと、オプションバーは覚えている色を斜線なしで表示し、次に描く図形は取り込んだ色になる」点は既存の表示の規則どおりで許容（懸念事項に記載）。

### 要件9: キーの対応表と`title`
* 足すエントリ（対応表の末尾に、コメント付きで）：`invertSelection`（`KeyI`・`ctrl: true`・`FORBIDDEN`・`repeatable: false`）、`pasteInPlace`（`KeyV`・`ctrl: true`・`REQUIRED`・`false`）、`resetColors`（`KeyD`・`ctrl: false`・`FORBIDDEN`・`false`）、`startEyedropper`（`KeyI`・`ctrl: false`・`FORBIDDEN`・`false`）。同じcode・修飾キーの組に一致するエントリは各1件（`KeyV`：`ctrl: false`/FORBIDDEN・`ctrl: true`/FORBIDDEN・`ctrl: true`/REQUIRED、`KeyD`：`ctrl: true`/FORBIDDEN・`ctrl: false`/FORBIDDEN、`KeyI`：`ctrl: true`/FORBIDDEN・`ctrl: false`/FORBIDDEN）。
* typedef`ShortcutActions`へ4つの契約を追記。対応表のJSDoc（`KeyV`・`KeyD`・`KeyI`の区別、`Shift`+`V`の予約の記述）、`ShiftRule`のJSDoc（REQUIREDに`Ctrl`+`Shift`+`V`）、`#findBinding`のJSDoc（REQUIREDの例）、`#handleKeyDown`のJSDoc（手順5・6で`preventDefault()`だけ行う`Ctrl`付きのキーの列挙に`I`）を実態へ改める。受理判定の手順・既存のエントリは変えない。
* 注入するコールバックは対応表のエントリと同じタスクで`main.js`へ足す（欠けると起動時に`Error`）。`title`を足すのはスポイトのボタンだけ（`スポイト (I)`）。

### 要件11: `main.js`の配線ブロックの位置と行数
* 配線ブロックの切り出しはしない。番号とコメントの並び（`// 1.`〜`// 9.`）を保つ。足す位置：
  * 「// 4.」：`styleEyedropper`の生成（`inputTracker`より前）、`inputTracker`の第7引数。
  * 「// 7.」：`ensureSelectMode`・`startEyedropper`・`toolActions`のエントリ・`styleEyedropper.onChange(syncToolPalette)`・`syncToolPalette`と`applyMode`の変更。
  * 「// 7.5.」：`performPaste`。
  * 「// 8.」：`performInvertSelection`、`KeyboardShortcuts`の4つの注入と`cancel`・`paste`・`selectAll`の変更、`new AltKeyGuard()`。
* import：`AltKeyGuard`・`StyleEyedropper`・`invertSelection`（`./core/SelectionRules.js`）・`EYEDROPPER_TOOL_ID`（`./core/ToolRules.js`の既存のimportへ足す）。
* 行数の見込み：877行 → 約960〜990行（各タスクで実数をRESに記録する）。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`（入力の解釈・規則の関数・キーの対応表・`Alt`の抑止）、`./js/edit/`（追加・複製・貼り付け・スタイルの反映・スポイトの手順）、`./js/main.js`（配線）、`./index.html`（ボタン）、`./test/core/`・`./test/edit/`（自動テスト）
*   **関連する論理クラス**:
    *   新設：`core/SelectionRules.js`（関数`resolveClickSelection`・`resolveMarqueeSelection`・`invertSelection`、typedef`SelectionChange`）、`core/MoveDirectionRules.js`（関数`constrainMoveDirection`）、`core/AltKeyGuard.js`（クラス`AltKeyGuard`）、`edit/StyleEyedropper.js`（クラス`StyleEyedropper`）。
    *   変更：`InputTracker`（第7引数`InputAssist`・作業用フィールド`#moveOrigin`・`#appliedMoveDelta`・`#duplicateOnMove`、非公開`#applySelectionChange`・`#resolveMoveDelta`・`#beginMoveSelection`、モジュール関数`hasCtrlModifier`。公開メソッドは足さない。公開フィールド`lastCursor`を廃止）、`KeyboardShortcuts`（4エントリ）、`ToolRules`（`EYEDROPPER_TOOL_ID`・`TOOL_IDS`・`resolveActiveTool`の第3引数）、`ShapeInserter`（`insertDocumentWithinEdit`）、`ClipboardController`（`pasteInPlace`・`duplicateInPlaceWithinEdit`）、`ShapeStyleEditor`（`applyStyle`・`resetColors`）、`StylePanelRules`（`RESET_COLORS_STYLE`・`sampleStyleFromShape`・typedef`StyleApplication`）、`VectorModel`（`DEFAULT_NEW_SHAPE_STYLE`のコメントのみ）、`main.js`（`ensureSelectMode`・`performPaste`・`performInvertSelection`・`startEyedropper`）、`index.html`（`#tool-eyedropper`）。
    *   変えない：`PointHitRules`・`DragTracker`・`HistoryManager`・`CanvasManager`・`DisplayState`・`ViewTransform`・`WindowManager`・`ShapeFactory`・`palette/`（`ToolPalette`は一覧とidの照合だけで動く）・`io/`・`shapes/`・`check/`・`sprite-check.html`。

### 参照する責務
*   **依存方向**（1章）：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`をimportしない。`core/InputTracker`は`edit/`をimportせず、`main.js`が注入したもの（`editRecorder`・`EndpointSnapper`）を呼ぶだけ。`edit/`内のimportの例外は`ShapeStyleEditor → StylePanelRules`・`ShapeOrderEditor → ShapeOrderRules`（本作業で`StyleEyedropper → StylePanelRules`を足す）。
*   **`core/`の規則の関数**（1章「フォルダ分割の方針」）：`PointHitRules`は`InputTracker`だけが使う状態を持たない規則で、DOM・状態に触れない形で`node --test`で確かめるために切り出したもの（`InputTracker`の再分離ではない）。`ToolRules`は`main.js`だけが使うUIの表示の規則（操作モードと図形種別の知識を要し、`edit/`は操作モードを知らず・`palette/`はimportを持たず・`main.js`は判定を持たず・`InputTracker`へは入れないため`core/`）。本作業の`SelectionRules`は両方から使う（`InputTracker`・`main.js`）、`MoveDirectionRules`は`InputTracker`だけが使う。
*   **`InputTracker`**（`_doc/arch/06_InputTracker.md`）：入力の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知（注入された記録先）、カーソル形状。図形種別の分岐・図形固有のプロパティ名を持たない。`HistoryManager`をimportしない。`main.js`の関数を呼ばない。ショートカットは解釈しない（キーは`Space`のみ）。当たり分類の規則の正本は`PointHitRules.classifyPointHit`で、結果をホバー・押下・クリック・カーソルの4箇所で共用する。左ドラッグの開始通知の時点で状態が遷移済みであることは「`DragTracker.begin()`が`onStart`を同期的に呼ばない」ことに依存する。吸い付きの作業用フィールドと`#resetSnapState()`は入力状態の遷移と1対1（`#finishLeftDrag`では`commitEdit()`の後に`#resetSnapState()`）。`InputTracker.js`はモジュールの最上位でDOMに触れない（`ToolRules.test.js`が間接にimportする）。
*   **`KeyboardShortcuts`**（`_doc/arch/07_KeyboardShortcuts.md`）：対応表と`keydown`の受理判定のみ。操作の実体は注入されたコールバック。コンストラクタで全action名の注入を検証し欠落時は`Error`。`Alt`押下中は常に不一致。`keyup`は購読しない。手順2（テキスト入力扱いの欄）ではすべて働かず、手順4（色の欄）では`ctrl: false`のエントリだけ働かない。手順5・6で実行しない`ctrl: true`のエントリは`preventDefault()`だけ行う。
*   **3章「同期の経路」**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`・`displayState.onChange`・`cursorTracker.onChange`、モードと図形種別は`applyMode`・`applyShapeType`。ツールパレットの押し込みもこの2つの中で同期）のみ。機能専用の再描画・同期処理を足さない（足す場合は一覧へ足す1つの通知にとどめる）。
*   **3章6. 履歴**：変更処理を`beginEdit()`と`commitEdit()`で挟む（入れ子にしない。`HistoryManager.beginEdit`は入れ子で警告して前の状態を上書きする）。前後の作業データが同じなら記録しない（選択集合は比較しない）。本体ドラッグ・moveハンドル・ハンドルの変形は閾値超過時に開始し、ドラッグの終了・中断の共通後始末で確定（中断で残った変化も1件）。貼り付け・複製・インポートは`ShapeInserter.insertDocument`で`addShapesWithNewIds`の前後（追加0件は記録しない）。記録しない操作：直前に使った値の変更、選択中の図形が無いときのオプションバーの変更、範囲選択・クリック選択・全選択・選択解除、表示の切り替え等。
*   **3章7. コピー・貼り付け・複製**：クリップボードはアプリ内部（作業データ形式）で履歴の対象外。貼り付けはクリップボードの内容を、複製は選択集合の図形を（クリップボードを経由せず）`ShapeInserter.insertDocument`へ渡し、新しいidで最前面へ追加して追加した図形だけを選択。`main.js`の`paste`は空なら何もしない（モードも切り替えない）、選択モード以外なら先に`applyMode(SELECT)`。`insertDocument`は進行中の入力操作の中断・モードの切り替えを行わない（呼び出し側の責務）。
*   **3章13. オプションバー（スタイル）**：手順＝`ShapeStyleEditor`（DOMなし。反映の範囲・履歴・ピッカー操作中の扱い）、規則＝`StylePanelRules`（状態なし・DOMなし・importなし）。反映の範囲：選択中の図形があるとき変えた項目だけ（線は全図形、塗りは塗れる形だけ。塗れない形の`fillColor`は変えない）、あわせて直前に使った値の同じ項目を更新。選択が無いときは直前に使った値だけ（記録しない）。直前に使った値を更新するのは`ShapeStyleEditor`だけ。各変更メソッドは冒頭でピッカー操作中の記録を確定する。表示は`model.onChange` → `syncOptionBarStyleGroup`。スタイル3つ（`strokeColor`・`strokeWidth`・`fillColor`）は共通プロパティとして`StylePanelRules`・`ShapeStyleEditor`が読み、書き換えは`model.updateShapeStyles`へ渡すだけ。「やらないこと」にスポイト（本作業で実態へ改める）。
*   **`edit/`**（1章）：操作モードを知らない。操作モードに依存する判定・処理は中立な注入関数で受け取る。DOMに触れない。
*   **`ToolRules`**（`_doc/arch/19_ToolRules.md`）：`TOOL_IDS`の並び＝ツールパレットのボタンの並び。ボタンのid`tool-${toolId}`は`index.html`側の約束。`TOOL_IDS`・`index.html`のid・`main.js`の`toolActions`の3か所を揃える（不整合は`ToolPalette`が起動時に`console.warn`）。
*   **`palette/`**：UI部品はDOM操作専任でimportを持たない（`ToolPalette`は識別子の一覧・コールバック・識別子のみを受け取る）。
*   **`main.js`**：判定・計算のロジックを持たない。ボタンとショートカットは同じ操作関数を呼ぶ（同一経路の原則）。後で`const`宣言されるものをクロージャで参照するのは、呼ばれるのが起動完了後に限る場合だけ。
*   **不変条件**：選択集合は選択モード以外では空（`setMode`が無条件にクリアし、`addShapesWithNewIds`等の選択を作る操作は選択モードを呼び出し側が保証）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
* **1章**：フォルダ構造に`core/SelectionRules.js`（クリック・範囲選択の次の選択と選択の反転の規則（状態なし）。`InputTracker`・`main.js`から使う）・`core/MoveDirectionRules.js`（移動方向の限定の規則（状態なし）。`InputTracker`から使う）・`core/AltKeyGuard.js`（`Alt`の単独押下の抑止）・`edit/StyleEyedropper.js`（スポイトの待ち受けと取り込み）と、`test/core/SelectionRules.test.js`・`test/core/MoveDirectionRules.test.js`・`test/edit/ClipboardController.test.js`・`test/edit/StyleEyedropper.test.js`を足す。「フォルダ分割の方針」の`core/`へ`SelectionRules`（`PointHitRules`と`ToolRules`の両方の位置づけ）・`MoveDirectionRules`（`PointHitRules`と同じ位置づけ）・`AltKeyGuard`（DOMの購読を含む小さな部品。`InputTracker`・`KeyboardShortcuts`へ入れなかった理由）、`edit/`へスポイトの待ち受けと取り込み・同じ位置に貼り付け・`Alt`+ドラッグの複製。依存方向へ`InputTracker → SelectionRules・MoveDirectionRules`・`AltKeyGuard → InputTracker（isTextInputElement）`・`main.js → SelectionRules`・`StyleEyedropper → StylePanelRules`（`edit/`内の例外）、`InputTracker`は`main.js`が注入した第7引数の関数を呼ぶだけ。「存在しないもの」へ：`Shift`+クリックでの選択の追加、`Ctrl`+範囲選択での解除、選択集合外の図形の押してそのままのドラッグ・`Alt`+ドラッグ、頂点のハンドルのドラッグでの`Shift`の限定、`Shift`での正方形の作成、ドラッグの途中での`Alt`の切り替え、スポイトの連続の取り込み・取り込む項目を選ぶUI・画面の色からの取り込み・一時的なスポイト、`D`での太さの変更。`index.html`の説明にツールパレットのスポイトのボタン。
* **3章冒頭「同期の経路」**：`styleEyedropper.onChange`（スポイトの待ち受けの変化。ツールパレットの押し込み`syncToolPalette`だけ。キャンバスは再描画しない）を1つ足す。「ツールパレットの押し込みの表示も`applyMode`・`applyShapeType`の中で同期する」を「…と`styleEyedropper.onChange`で同期する」へ。
* **3章3.**：当たり分類（`Ctrl`+クリック・`Alt`+ドラッグ・スポイトのクリックも`#classifyPoint`を通る）、クリックの解釈（`Ctrl`の追加・解除・空白で解除しない。`Ctrl`を見るのは`click`）、範囲選択の流れ（`Ctrl`で追加・0件は変えない。`Ctrl`を見るのは終了のイベント）、本体ドラッグの移動量（押した位置からの移動量 → 加工（`Shift`の限定。Phase 07-05の丸めの置き場所）→ 反映済みとの差分）、`Alt`+ドラッグ（押した時点の`Alt`・閾値超過時に複製）、スポイトの待ち受け中の押下・クリック・カーソル、キーボード操作（`Ctrl`+`I`・`Ctrl`+`Shift`+`V`・`D`・`I`、`Alt`の単独押下の抑止は`AltKeyGuard`、`keyup`は`Space`を`InputTracker`・`Alt`を`AltKeyGuard`が購読）。
* **3章6.**：記録する操作に「`Alt`+ドラッグ：閾値超過時の`beginEdit`の後に複製（`insertDocumentWithinEdit`。記録しない入口）→ 移動 → 確定の1件」「同じ位置に貼り付け（`insertDocument`）」「`D`・スポイト（`ShapeStyleEditor.applyStyle`。選択ありのときだけ1件）」。記録しない操作に「選択の反転・`Ctrl`+クリック・`Ctrl`+範囲選択・スポイトの待ち受けの開始/終了」。
* **3章7.**：同じ位置に貼り付け（段数を読まず変えない）、`Alt`+ドラッグの複製はクリップボードを変えない、`performPaste`の共通の前処理。
* **3章13.**：「やらないこと」からスポイトを外し、スタイルをまとめて当てる入口`applyStyle`・`resetColors`（`D`）・`RESET_COLORS_STYLE`と`DEFAULT_NEW_SHAPE_STYLE`の関係、スポイトの取り込み（`sampleStyleFromShape`）と表示の規則（選択なしで変換できない色は覚えている色・斜線なし）を書く。「`setStrokeEnabled`・`setFillEnabled`は公開のまま残す（Phase 07-04の`D`キー・スポイトで使う見込み）」は実態（`D`・スポイトは`applyStyle`を使う）へ改める。
* **3章に選択と移動の操作の節（16.）を新設**：修飾キーを見る時点（`Ctrl`＝確定の時点、`Shift`＝追従のたび、`Alt`＝押した時点）、2026-11-14の発注者の決定（押下時の分岐を`Ctrl`で変えない・`Shift`は移動だけ・`Alt`+ドラッグは選択中の図形だけ・`D`の動き・スポイトの動き）、スポイトの待ち受けの持ち主（`StyleEyedropper`）と経路（`I`・ボタン → `startEyedropper` → `start()`、クリック → `InputTracker` → `pickShape` → `pickFrom` → `applyStyle` → `stop()`、`Esc`は`cancelPicking`、`applyMode`は`stop()`、通知 → `syncToolPalette`）、待ち受けが続く／やめる操作の一覧、「4つ目の操作モードにしない」理由、`Alt`の抑止（対象・対象外）、やらないこと。
* **4章**：一覧へ`SelectionRules.js`（`_doc/arch/27_SelectionRules.md`）・`MoveDirectionRules.js`（`_doc/arch/28_MoveDirectionRules.md`）・`AltKeyGuard.js`（`_doc/arch/29_AltKeyGuard.md`）の3行を足す（`StyleEyedropper`は`edit/`のため`_doc/arch/14_edit.md`）。
* **`_doc/arch/01_index_html.md`**：ツールパレットのスポイトのボタン（`#tool-eyedropper`・💉仮・`title`・`aria-pressed`なし）、ツールパレットの大きさ。
* **`_doc/arch/02_main.md`**：主な関数（`ensureSelectMode`・`performPaste`・`performInvertSelection`・`startEyedropper`、`applyMode`・`syncToolPalette`の変更）、配線ブロック（「// 4.」の`styleEyedropper`、「// 8.」の`AltKeyGuard`）、注入の一覧（`InputTracker`の第7引数、`StyleEyedropper`の`applyStyle`、`KeyboardShortcuts`の4つと`cancel`・`paste`・`selectAll`の変更）、生成順の制約（`styleEyedropper`は`inputTracker`より前）、同期（`styleEyedropper.onChange`）、行数。
* **`_doc/arch/06_InputTracker.md`**：第7引数`inputAssist`（`duplicateSelection`・`isPickingShape`・`pickShape`。項目ごとの既定）、修飾キー（`Ctrl`＝`click`・範囲選択の終了のイベント、`Shift`＝追従のたび、`Alt`＝押下）、選択の規則・方向の限定の規則の呼び出し、本体ドラッグの移動量（`lastCursor`を廃止し`#moveOrigin`・`#appliedMoveDelta`・`#resolveMoveDelta`）、待ち受け中の押下・クリック・カーソル、行数。
* **`_doc/arch/07_KeyboardShortcuts.md`**：4エントリ、`KeyV`・`KeyD`・`KeyI`の区別、`Shift`+`V`の予約の記述の更新、`Alt`の単独押下の抑止は`AltKeyGuard`で`KeyboardShortcuts`は`keyup`を購読しないまま。
* **`_doc/arch/14_edit.md`**：`ShapeInserter.insertDocumentWithinEdit`、`ClipboardController.pasteInPlace`・`duplicateInPlaceWithinEdit`、`ShapeStyleEditor.applyStyle`・`resetColors`、`StylePanelRules.RESET_COLORS_STYLE`・`sampleStyleFromShape`・`StyleApplication`、`StyleEyedropper`の新設（責務・公開メソッド・知らないこと・importの例外）。
* **`_doc/arch/16_test.md`**：追加したテストファイルとケース・件数、実物の組み合わせの例外（`ClipboardController.test.js`：`VectorModel`・`ShapeInserter`・`SnapshotAdapter`・`HistoryManager`・`ClipboardController`、`StyleEyedropper.test.js`：`VectorModel`・`ShapeStyleEditor`（必要なら`SnapshotAdapter`・`HistoryManager`））、書き換えた既存のテスト（`ToolRules.test.js`の`TOOL_IDS`の並びの期待値）、テストできない箇所（`InputTracker`の修飾キー・第7引数の配線、`KeyboardShortcuts`の4エントリ、`AltKeyGuard`、`index.html`、`main.js`の配線）。
* **`_doc/arch/19_ToolRules.md`**：`EYEDROPPER_TOOL_ID`、`TOOL_IDS`の並び、識別子の約束、`resolveActiveTool`の第3引数、使う側（`main.js`の`toolActions`も）。
* **`_doc/arch/27_SelectionRules.md`・`28_MoveDirectionRules.md`・`29_AltKeyGuard.md`**：新設（既存の`18_PointHitRules.md`・`25_ViewFitRules.md`と同じ形式）。
* **`_doc/arch/03_VectorModel.md`**：`DEFAULT_NEW_SHAPE_STYLE`と`RESET_COLORS_STYLE`が別の定義であること（記載があれば）。

## 3. タスクリスト
各タスクの共通事項：完了時にプロジェクトのルートで`node --test`を実行し、`fail 0`と件数（tests・pass）を「4. 詳細作業内容」へ記録する。変更・新設したクラス・メソッド・関数・定数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、注入するコールバックの契約、変更したファイルの先頭の責務定義（3行以内）を、そのタスクの中で実態へ改める。開発資料の更新が必要と分かった点は本RESの「開発資料の更新予定」へ追記する（資料本体は最終タスクまで変えない）。迷った点・目視確認を推奨する点は「5. 懸念事項」へ書く。テストは`_doc/arch/16_test.md`の規則（`node:test`・`node:assert/strict`のみ・公開APIのみ・ソースを書き換えない・`test/`に共有の補助モジュールを置かない・先頭行に責務のJSDoc・`console.warn`は`t.mock.method`で抑止）に従う。既存のテストのケースは、明記したもの以外変えない。

*   [x] タスク1: 選択の規則（要件1・5）とテスト（まだ使わない）
    *   **対象ファイル** :
        *   `./js/core/SelectionRules.js` : 新規
        *   `./test/core/SelectionRules.test.js` : 新規
    *   **作業内容** :
        *   先頭に責務定義（クリック・範囲選択の次の選択と選択の反転の規則を状態を持たない関数として提供。importなし・DOMなし）。
        *   typedef`SelectionChange`、関数`resolveClickSelection(selectedIds, hitId, additive)`・`resolveMarqueeSelection(selectedIds, hitIds, additive)`・`invertSelection(allIds, selectedIds)`を「2. 要件1」のとおりに実装し、JSDocに契約（`additive`偽のときの結果が今の`InputTracker`の呼び出しと1対1であること、引数を書き換えず新しい配列を返すこと）を書く。
        *   テスト：`Ctrl`なしのクリック（本体＝`set([id])`・空白で選択あり＝`clear`・空白で選択なし＝`null`）、`Ctrl`+クリック（未選択＝追加・選択中＝外す・空白＝`null`・ほかの選択が残る・最後の1つを外すと`set([])`）、範囲選択（`Ctrl`なし＝置き換え・0件＝`set([])`、`Ctrl`あり＝追加・重複しない・既存の選択が残る・0件＝`null`）、反転（一部選択・全選択＝空・選択なし＝全部・図形0個＝空・並びは`allIds`の順・`allIds`に無いidが`selectedIds`にあっても結果に出ない）、引数を書き換えないこと・戻り値が引数と別の配列であること。
*   [x] タスク2: `InputTracker`の要件1（`Ctrl`+クリック・`Ctrl`+範囲選択）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `./SelectionRules.js`から`resolveClickSelection`・`resolveMarqueeSelection`をimport。非公開のモジュール関数`hasCtrlModifier(event)`と非公開メソッド`#applySelectionChange(change)`を足す（JSDoc付き）。
        *   `handleClick`の選択モードの分岐と`#commitMarquee`を「2. 要件1」のとおりに替える（ハンドルの上の`return`・矩形の正規化・`clearSelectionRect()`は今のまま）。
        *   JSDocの更新：`handleClick`（`Ctrl`の扱いと見る時点、閾値以内で離したときの選択中の図形の解除）、`#commitMarquee`（`Ctrl`の追加・0件・見る時点）、`#onLeftDragEnd`の`@param event`の説明（範囲選択の`Ctrl`を見るイベント）、`handleMouseDown`（押下時の分岐は`Ctrl`で変えない旨）、クラスの説明・先頭の責務定義（修飾キーの読み取りは規則の関数へ渡すだけ）。
        *   `#resetSnapState()`の呼び出し箇所・順は変えない。
*   [x] タスク3: 移動方向の限定の規則（要件2）とテスト（まだ使わない）
    *   **対象ファイル** :
        *   `./js/core/MoveDirectionRules.js` : 新規
        *   `./test/core/MoveDirectionRules.test.js` : 新規
    *   **作業内容** :
        *   先頭に責務定義。`constrainMoveDirection(dx, dy)`を「2. 要件2」の場合分けで実装（tan 22.5°の定数はexportしない定数として定義しJSDocを付ける）。JSDocに正射影であること・境界の扱い・有限の数値が前提であることを書く。
        *   テスト：横・縦・斜め4方向の正負（各軸上・各対角線上で入力と同じ値）、各直線に近い向き（例：`(10, 1)`→`(10, 0)`、`(1, -10)`→`(0, -10)`、`(10, 9)`→`(9.5, 9.5)`、`(-10, 8)`→`(-9, 9)`）、境界の近く（22.5°の少し手前・少し先で横と斜めに分かれる）、移動量0、多数の入力で結果が4本の直線のいずれかの上にあること（`dy === 0`・`dx === 0`・`|dx| === |dy|`のいずれかが厳密に成り立つ）、結果が元の移動量の正射影であること（元のベクトルとの差が結果に直交する：内積が誤差の範囲で0）、同じ入力に同じ結果。
*   [x] タスク4: `InputTracker`の要件2（本体ドラッグの移動量と`Shift`の限定）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `./MoveDirectionRules.js`から`constrainMoveDirection`をimport。公開フィールド`lastCursor`を廃止し、作業用フィールド`#moveOrigin`・`#appliedMoveDelta`（JSDoc付き。寿命は`MOVING_SELECTION`の押下から`#finishLeftDrag`まで）と非公開メソッド`#resolveMoveDelta(rawDelta, event)`（押した位置からの移動量を加工する唯一の箇所である旨とPhase 07-05の丸めの置き場所である旨をJSDocに書く）を足す。
        *   `#beginLeftDrag`・`#applyLeftDragUpdate`・`#finishLeftDrag`を「2. 要件2」のとおりに替える。`moveShapes`は更新1回につき1回（差分0でも呼ぶ）。
        *   JSDocの更新：`#applyLeftDragUpdate`（移動量の求め方・`Shift`を見る時点・ホイールの追従）、`#beginLeftDrag`（記憶するもの）、`#finishLeftDrag`（消すフィールド）、`handleWheel`（ドラッグ中のホイールでも`Shift`を見る）、クラスの説明。`lastCursor`を説明するコメントを残さない。
*   [x] タスク5: 記録しない追加の入口（要件3）
    *   **対象ファイル** :
        *   `./js/edit/ShapeInserter.js` : 更新
    *   **作業内容** :
        *   `insertDocument`の本体を非公開`#insert(documentData, dx, dy, record)`へ移し、`insertDocument`は働き・戻り値・記録の単位を変えずに`#insert(…, true)`を呼ぶ形にする。公開メソッド`insertDocumentWithinEdit(documentData, dx = 0, dy = 0)`（`beginEdit()`／`commitEdit()`を呼ばない。開いている編集操作の中で呼ぶ前提。その他の処理順・戻り値は`insertDocument`と同じ）を足す。
        *   JSDoc：両メソッドの処理順・記録の有無・前提（記録しない入口を開いている編集操作の外で呼ぶと記録されない）、先頭の責務定義とクラスの説明（「1件の編集操作」に加えて、開いている編集操作の中で記録せずに追加する入口があること。`Alt`+ドラッグの複製が使う）。
        *   このタスクではテストを足さない（`ShapeInserter`のテストファイルは無く、入口の振る舞いはタスク6の`ClipboardController.test.js`で実物を組み合わせて確かめる）。既存のテストが全件通ること。
*   [x] タスク6: 同じ位置に貼り付け（要件6）と`Alt`+ドラッグの複製の手順（要件3）とテスト
    *   **対象ファイル** :
        *   `./js/edit/ClipboardController.js` : 更新
        *   `./test/edit/ClipboardController.test.js` : 新規
    *   **作業内容** :
        *   `pasteInPlace()`と`duplicateInPlaceWithinEdit()`を「2. 要件3・要件6」のとおりに足す。JSDoc（段数を読まず変えない・クリップボードを変えない・記録の有無・前提）。先頭の責務定義とクラスの説明（段数の規則に「同じ位置に貼り付け・`Alt`+ドラッグの複製では変えない」、前提に「`duplicateInPlaceWithinEdit`はドラッグの編集操作の中で呼ばれる（`InputTracker`へ`main.js`が注入）」）を実態へ改める。既存の`copy`・`cut`・`paste`・`duplicate`は変えない。
        *   テスト（先頭のJSDocに、実物の`VectorModel`・`ShapeInserter`・`SnapshotAdapter`・`HistoryManager`・`ClipboardController`を組み合わせる旨を書く。図形は実物の図形クラス、`deleteSelection`は素の関数の偽物）：
            *   `pasteInPlace`：元と同じ位置（`toJSON`の`points`が元と同じ）・新しいid・最前面に足され貼り付けた図形だけが選択・1件の記録（undoで元に戻る）、段数が変わらないこと（`copy` → `pasteInPlace` → `paste`の位置が、`copy` → `paste`の位置（1段ずれ）と同じ）、クリップボードが空のとき`false`・図形と履歴が変わらない。
            *   `duplicateInPlaceWithinEdit`：複製が元と同じ位置・新しいid・最前面に足され複製だけが選択されること、元の図形が変わらないこと（`toJSON`）、クリップボードが変わらないこと（事前の`copy`の後に呼び、続く`paste`の結果と段数が変わらない）、ドラッグの編集操作の中で呼んだとき（`history.beginEdit()` → `duplicateInPlaceWithinEdit()` → `model.moveShapes(選択中, dx, dy)` → `history.commitEdit()`）に履歴が1件で`console.warn`が出ないこと、undoで複製前（元の図形だけ・元が選択）、redoで複製して動かした後（複製が選択）に戻ること、単独で呼んでも記録されないこと（`canUndo()`が偽のまま）、選択が空のとき`false`で何も変わらないこと。
*   [x] タスク7: `InputTracker`の要件3（`Alt`+ドラッグ）と`main.js`の注入
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2ファイルを同じタスクにする理由：REQの例示どおり、注入の受け口と注入を揃えて`Alt`+ドラッグを動く状態にするため（`InputTracker`だけでも省略時は今と同じで壊れない）。
        *   `InputTracker`：typedef`InputAssist`（この時点の項目は`duplicateSelection`。契約：開いている編集操作の中で呼ばれ記録しない・選択中の図形を同じ位置に複製して複製だけを選択する）と既定`NO_INPUT_ASSIST`、コンストラクタの第7引数`inputAssist`（項目ごとに関数でなければ既定へ置き換える。`console.warn`は出さない）、作業用フィールド`#duplicateOnMove`、非公開メソッド`#beginMoveSelection(event, point)`、`#onLeftDragStart`での呼び出し、`#finishLeftDrag`での消去を「2. 要件3」のとおりに足す。JSDoc：コンストラクタの`@param`、`handleMouseDown`（`Alt`を見る時点）、`#onLeftDragStart`（複製の時点と記録の単位）、`#finishLeftDrag`、クラスの説明（注入の一覧に第7引数）。
        *   `main.js`：「// 4.」の`new InputTracker(…)`へ第7引数`{ duplicateSelection: () => { clipboardController.duplicateInPlaceWithinEdit(); } }`を足し、前方参照の理由のコメントと「// 4.」のコメント（第7引数の説明）を足す。
*   [x] タスク8: `Alt`の単独押下の抑止（要件4）
    *   **対象ファイル** :
        *   `./js/core/AltKeyGuard.js` : 新規
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2ファイルを同じタスクにする理由：新設の部品は`main.js`が生成して初めて働き、生成のない部品を残さないため。
        *   `AltKeyGuard`を「2. 要件4」のとおりに新設（先頭の責務定義、クラス・コンストラクタ・ハンドラのJSDocに対象・対象外・状態を持たないこと・`InputTracker`・`KeyboardShortcuts`へ入れない理由）。
        *   `main.js`：import、「// 8.」の`new KeyboardShortcuts(…)`の後に`new AltKeyGuard();`とコメント。
        *   自動テストは足さない（`document`を購読するため。テストプレイの項目は「5. 懸念事項」）。
*   [x] タスク9: `D`の値と手本から取り込む値の規則（要件7・8）とテスト
    *   **対象ファイル** :
        *   `./js/edit/StylePanelRules.js` : 更新
        *   `./js/core/VectorModel.js` : 更新（コメントのみ）
        *   `./test/edit/StylePanelRules.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   `VectorModel.js`を同じタスクにする理由：`RESET_COLORS_STYLE`と`DEFAULT_NEW_SHAPE_STYLE`が別の定義であることを両方のコメントに同時に書くため（REQ要件7）。`VectorModel.js`はJSDocのコメントの追記だけで、コードは変えない。
        *   `StylePanelRules.js`：typedef`StyleApplication`、定数`RESET_COLORS_STYLE`（凍結）、関数`sampleStyleFromShape(shape)`を「2. 要件7・8」のとおりに足す。先頭の責務定義を「…の規則と、スタイルをまとめて当てるときの値（`D`の色・手本の図形から取り込む値）の規則を担う」へ改める（3行以内）。
        *   テスト（追加）：`RESET_COLORS_STYLE`（凍結・`strokeColor: '#000000'`・`fillColor: '#ffffff'`・`strokeWidth`を持たない）、`sampleStyleFromShape`（線なし（`strokeColor: null`）・塗りなし（`fillColor: null`）・塗れない形（`Line`・開いた`Path`等）は`fillColor`のキーを持たない・塗れる形（`Rect`・円・閉じた`Path`）は持つ・太さ（小数を含む）をそのまま・色の文字列（`'red'`・`'#ABC'`・`'rgb(1,2,3)'`）をそのまま・図形を書き換えない・呼ぶたびに新しいオブジェクト）。既存のケースは変えない。
*   [ ] タスク10: スタイルをまとめて当てる入口と`D`の入口（要件7）とテスト
    *   **対象ファイル** :
        *   `./js/edit/ShapeStyleEditor.js` : 更新
        *   `./test/edit/ShapeStyleEditor.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   `applyStyle(style)`・`resetColors()`を「2. 要件7」のとおりに足す（`RESET_COLORS_STYLE`を`./StylePanelRules.js`の既存のimportへ足す。反映の対象の選び方は`COLOR_ITEMS`の`selectTargets`を使い、項目による分岐を表引きで行う）。JSDoc（既存の変更メソッドと同じ約束、値の検証をしない理由、戻り値）。先頭の責務定義・クラスの説明（スタイルをまとめて当てる入口があり、`D`・スポイトが使う）を改める。既存の公開メソッドの働きは変えない。
        *   テスト（既存の実物の組み合わせの形で追加）：線・塗り・太さの組み合わせ（1項目だけ・3項目）、`null`で線なし・塗りなし（直前に使った値は`enabled: false`で色は保つ）、塗れない形へ塗りを当てないこと（塗れない形の`fillColor`は変わらない）、選択なしで直前に使った値だけが変わり図形・履歴が変わらないこと、選択ありで履歴1件・undoで戻り・redoで再び当たること、前後が同じなら記録されないこと、ピッカー操作中の記録が先に確定されること（`previewColor`の後に`applyStyle` → 履歴2件・`console.warn`なし）、項目を1つも持たない引数は`false`で何も変えない、`resetColors`の値（選択ありで線が黒・塗れる形の塗りが白・太さ不変・直前に使った値が線あり黒・塗りあり白・太さ不変、塗れる形が無い選択でも直前に使った値の塗りがあり白、選択なしで直前に使った値だけ）。既存のケースは変えない。
*   [ ] タスク11: スポイトの待ち受けの持ち主と取り込みの手順（要件8）とテスト（まだ使わない）
    *   **対象ファイル** :
        *   `./js/edit/StyleEyedropper.js` : 新規
        *   `./test/edit/StyleEyedropper.test.js` : 新規
    *   **作業内容** :
        *   `StyleEyedropper`を「2. 要件8」のとおりに新設（先頭の責務定義：スポイトの待ち受けの状態の保持と変更の通知、手本の図形からスタイルを取り込んで反映する手順。クラスのJSDocに、知らないこと（DOM・操作モード・`InputTracker`・ボタン）、状態を作業データ・履歴・`VectorModel`に入れないこと、importは`./StylePanelRules.js`の`sampleStyleFromShape`のみ）。
        *   テスト：偽物の`model`（`getShapes`）・`applyStyle`（呼び出しを記録）で、初期は待ち受けでない、`start`で待ち受け・通知1回・`true`、待ち受け中の`start`は通知なし・`false`、`stop`でやめる・通知1回・`true`、待ち受けでない`stop`は通知なし・`false`、待ち受けでない`pickFrom`は`applyStyle`を呼ばず`false`、存在しないidの`pickFrom`は停止せず`false`・待ち受けが続く・通知なし、存在するidの`pickFrom`は`applyStyle`を`sampleStyleFromShape`の結果で1回呼び・待ち受けが解け・通知1回・`true`、`cancelPicking`（待ち受け中は`true`で`fallback`を呼ばない・待ち受けでなければ`fallback`の戻り値を返す）、`applyStyle`が関数でなければ`Error`、`onChange`に関数以外を渡しても例外にならない。加えて実物の`VectorModel`・`ShapeStyleEditor`（記録先は`SnapshotAdapter`・`HistoryManager`の実物）を組み合わせ、取り込みで選択中の図形と直前に使った値が変わり待ち受けが解けること、選択なしでは直前に使った値だけが変わること、塗れない形を手本にすると塗りが変わらないこと、選択ありで履歴1件。
*   [ ] タスク12: `resolveActiveTool`の第3引数（要件8）とテスト
    *   **対象ファイル** :
        *   `./js/core/ToolRules.js` : 更新
        *   `./test/core/ToolRules.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   `export const EYEDROPPER_TOOL_ID = 'eyedropper'`（JSDocに独自の識別子である旨）と`resolveActiveTool(mode, shapeType, picking = false)`を「2. 要件8」のとおりに足す。`TOOL_IDS`はこのタスクでは変えない（ボタンとの照合が要るためタスク16）。JSDoc・先頭の責務定義を改める。
        *   テスト（追加）：`picking`が`true`なら全操作モード×図形種別で`EYEDROPPER_TOOL_ID`、省略時・`false`のとき全操作モード×図形種別で今と同じ結果（第3引数なしの結果と一致）、`EYEDROPPER_TOOL_ID`が`OperationMode`の値・`SHAPE_TYPES`のどれとも違うこと。既存のケースは変えない。
*   [ ] タスク13: `InputTracker`の要件8（スポイトの待ち受けの照会と受け渡し）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   typedef`InputAssist`と`NO_INPUT_ASSIST`へ`isPickingShape`（既定は常に偽）・`pickShape`（既定は何もしない）を足し、コンストラクタの項目ごとの既定の置き換えに含める。
        *   `handleMouseDown`・`handleClick`・`#resolveCursor`を「2. 要件8」のとおりに替える（`handleMouseMove`は変えない）。JSDoc：3か所の判定順の記述、`#resolveCursor`の`@returns`に`'cell'`、クラスの説明（「クリックした図形を外へ渡す待ち受け」としてだけ扱い、スポイト・スタイルを知らない）。
        *   `main.js`はこのタスクでは変えない（省略時は待ち受けなし＝今と同じ）。
*   [ ] タスク14: 選択の反転（`Ctrl`+`I`）と同じ位置に貼り付け（`Ctrl`+`Shift`+`V`）のキーと操作関数
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2ファイルを同じタスクにする理由：対応表のエントリに対応するコールバックが注入されないと起動時に`Error`になるため。
        *   `KeyboardShortcuts`：`invertSelection`・`pasteInPlace`の2エントリ、typedef`ShortcutActions`の2つの契約、`ShiftRule`・対応表・`#findBinding`・`#handleKeyDown`のJSDoc（`KeyV`の3通りの区別、`KeyI`の`Ctrl`付き、`Shift`+`V`は引き続き予約、REQUIREDの例に`Ctrl`+`Shift`+`V`）。
        *   `main.js`：`invertSelection`のimport、`ensureSelectMode()`（「// 7.」）、`performPaste(pasteDocument)`（「// 7.5.」）、`performInvertSelection()`（「// 8.」）を足し、`paste`を`performPaste`経由へ、`selectAll`の前処理を`ensureSelectMode()`へ替え、`invertSelection`・`pasteInPlace`のコールバック（常に`true`）を足す。各関数・コールバックのコメント（契約・同一経路・判定を持たないこと）。
*   [ ] タスク15: `D`のキー
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2ファイルを同じタスクにする理由：タスク14と同じ。
        *   `KeyboardShortcuts`：`resetColors`のエントリ、契約、対応表のJSDoc（`KeyD`は`ctrl`の値で`D`と`Ctrl`+`D`（複製）に分かれる）。
        *   `main.js`：`resetColors: () => { shapeStyleEditor.resetColors(); return true; }`とコメント（操作モードを切り替えない・どの状態でも働く・表示は`model.onChange`）。
*   [ ] タスク16: スポイトのボタンと待ち受けの配線
    *   **対象ファイル** :
        *   `./js/core/ToolRules.js` : 更新
        *   `./test/core/ToolRules.test.js` : 更新（`TOOL_IDS`の並びの期待値の更新とケースの追加）
        *   `./index.html` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   4ファイルを同じタスクにする理由：`TOOL_IDS`・`index.html`のボタンのid・`main.js`の`toolActions`の3か所が揃わないと`ToolPalette`が起動時に`console.warn`を出し、待ち受けの配線（生成・注入・`applyMode`・`Esc`・押し込みの同期）は揃って初めて正しく動くため。キー`I`はタスク17で足す（このタスクの完了時点ではボタンからだけ待ち受けに入れる）。
        *   `ToolRules.js`：`TOOL_IDS`へ`EYEDROPPER_TOOL_ID`をキャンバス移動の次に足し、`TOOL_IDS`のJSDoc（並び・識別子の約束）を改める。
        *   `ToolRules.test.js`：既存の「並びが select, pan, ...SHAPE_TYPES である」の期待値を`['select', 'pan', 'eyedropper', ...SHAPE_TYPES]`へ更新し（テスト名もそれに合わせる）、「`EYEDROPPER_TOOL_ID`が`TOOL_IDS`に含まれる（3番目）」「`picking`が真のときの結果が`TOOL_IDS`にちょうど1回現れる」を足す。
        *   `index.html`：`#tool-eyedropper`のボタンと、ツールパレットのCSSコメントの位置・大きさの数値（「2. 要件8」）。
        *   `main.js`：`StyleEyedropper`のimportと「// 4.」での生成（`inputTracker`より前。前方参照と生成順のコメント）、`inputTracker`の第7引数へ`isPickingShape`・`pickShape`、`EYEDROPPER_TOOL_ID`のimport、`startEyedropper()`、`toolActions`のエントリ、`syncToolPalette`（第3引数）と`styleEyedropper.onChange(syncToolPalette)`の登録、`applyMode`の`styleEyedropper.stop()`、`cancel`のコールバックを`styleEyedropper.cancelPicking(…)`へ。コメントの更新：`syncToolPalette`（呼ばれる経路に`styleEyedropper.onChange`）、`applyMode`（待ち受けをやめる）、`toolActions`（スポイトは`startEyedropper`）、`cancel`。
*   [ ] タスク17: スポイトのキー（`I`）
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2ファイルを同じタスクにする理由：タスク14と同じ。
        *   `KeyboardShortcuts`：`startEyedropper`のエントリ、契約、対応表のJSDoc（`KeyI`は`ctrl`の値で`I`と`Ctrl`+`I`に分かれる）。
        *   `main.js`：`startEyedropper: () => { startEyedropper(); return true; }`とコメント（ボタンと同一経路）。`index.html`の`title`「スポイト (I)」と対応表が一致していることを確かめる。
*   [ ] タスク18: コメントの整理とJSDocの確認
    *   **対象ファイル** :
        *   本作業で変更・新設した`.js`・`index.html`（変更が要る箇所が残っている場合のみ更新）
    *   **作業内容** :
        *   「5. 懸念事項」の後の一覧「コメントの洗い出し」の各項目が実態どおりかを確かめ、残っている食い違いだけを直す（コードは変えない）。使われなくなったコメント・JSDoc（`lastCursor`への言及、「`applyMode`・`applyShapeType`の中からだけ呼ぶ」、「`Shift`+`V`等は将来の予約」で実態と合わない箇所、「スポイトはやらない」等）が残っていないことを`Grep`で確かめる。
        *   新設・変更したクラス・メソッド・関数・定数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、注入するコールバックの契約、変更したファイルの先頭の責務定義（3行以内）の漏れを確かめる。
        *   `main.js`の行数を記録する。
*   [ ] タスク19: 開発資料への反映（固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・3章・4章）
        *   `./_doc/arch/01_index_html.md`・`02_main.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`14_edit.md`・`16_test.md`・`19_ToolRules.md` : 更新
        *   `./_doc/arch/27_SelectionRules.md`・`28_MoveDirectionRules.md`・`29_AltKeyGuard.md` : 新規
        *   `./_doc/arch/03_VectorModel.md` : 更新（`DEFAULT_NEW_SHAPE_STYLE`の記載がある場合のみ）
    *   **作業内容** :
        *   本RESの「開発資料の更新予定」（各タスクで追記したものを含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準（1つのファイルのJSDocを読めば分かることは書かない。境界・依存方向・モジュールをまたぐ流れ・注入・設計判断の理由・やらないと決めたこと・公開メソッド名の一覧を残す）に従って反映する。新設の`_doc/arch/`のファイルは既存（`18_PointHitRules.md`・`25_ViewFitRules.md`）と同じ形式で作り、4章の一覧へ1行ずつ足す。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、この最終タスクのみ明示的な例外とする（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 選択の規則（要件1・5）とテスト
*   **作業内容** :
    *   `js/core/SelectionRules.js`を新設（責務定義3行以内・importなし）。typedef`SelectionChange`、`resolveClickSelection`・`resolveMarqueeSelection`・`invertSelection`を「2. 要件1・5」のとおり実装。引数は書き換えず新しい配列を返す。
    *   `test/core/SelectionRules.test.js`を新設（Ctrlなし／ありのクリック・範囲選択、反転、引数の非破壊）。まだどこからも使っていない。
    *   `node --test`：tests 1126・pass 1126・fail 0。

### タスク2: `InputTracker`の要件1（`Ctrl`+クリック・`Ctrl`+範囲選択）
*   **作業内容** :
    *   `js/core/InputTracker.js`：`SelectionRules.js`から`resolveClickSelection`・`resolveMarqueeSelection`をimport。非公開のモジュール関数`hasCtrlModifier(event)`・非公開メソッド`#applySelectionChange(change)`を足した。
    *   `handleClick`の選択モード：ハンドル上は今のまま`return`、それ以外は`#applySelectionChange(resolveClickSelection(getSelectedIds(), hit.bodyId, hasCtrlModifier(event)))`。`#commitMarquee`：最後の`setSelection(ids)`を`#applySelectionChange(resolveMarqueeSelection(…))`へ替えた（矩形の正規化・`clearSelectionRect()`は今のまま）。
    *   JSDoc更新：`handleClick`・`#commitMarquee`・`#onLeftDragEnd`の`@param event`・`handleMouseDown`（押下時の分岐は`Ctrl`で変えない旨）・クラスの説明・先頭の責務定義（修飾キーの読み取りは規則の関数へ渡すだけ）。
    *   `node --test`：tests 1126・pass 1126・fail 0。

### タスク3: 移動方向の限定の規則（要件2）とテスト
*   **作業内容** :
    *   `js/core/MoveDirectionRules.js`を新設（責務定義3行以内・importなし）。`constrainMoveDirection(dx, dy)`を「2. 要件2」の場合分け（0→そのまま、横、縦、斜め）で実装。tan 22.5°は非exportの定数`TAN_HALF_DIAGONAL`。JSDocに正射影・境界は`<=`で横・縦側・有限の数値が前提を記載。
    *   `test/core/MoveDirectionRules.test.js`を新設（軸上・対角線上、近い向き、境界の近く、移動量0、4本の直線上・正射影（内積≒0）・同じ入力に同じ結果）。まだどこからも使っていない。
    *   `node --test`：tests 1138・pass 1138・fail 0。

### タスク4: `InputTracker`の要件2（本体ドラッグの移動量と`Shift`の限定）
*   **作業内容** :
    *   `js/core/InputTracker.js`：`MoveDirectionRules.js`から`constrainMoveDirection`をimport。公開フィールド`lastCursor`を廃止（`js/`内に残参照なし）し、非公開の作業用フィールド`#moveOrigin`・`#appliedMoveDelta`（JSDoc付き）と非公開メソッド`#resolveMoveDelta(rawDelta, event)`（`event.shiftKey`なら`constrainMoveDirection`。押した位置からの移動量を加工する唯一の箇所・Phase 07-05の丸めの置き場所をJSDocに記載）を足した。
    *   `#beginLeftDrag`：`MOVING_SELECTION`のときだけ`#moveOrigin = point`・`#appliedMoveDelta = {dx:0, dy:0}`（それ以外はnull）。`#applyLeftDragUpdate`：押した位置からの移動量 → `#resolveMoveDelta` → 反映済みとの差分で`moveShapes`を毎回1回（差分0でも）→ `#appliedMoveDelta`更新。`#finishLeftDrag`：`#moveOrigin`・`#appliedMoveDelta`をnullへ（`#resetSnapState()`の位置・順は不変）。
    *   JSDoc更新：`#beginLeftDrag`・`#applyLeftDragUpdate`・`#finishLeftDrag`・`handleWheel`・先頭の責務定義。
    *   監査の指摘による修正：`class InputTracker`のJSDoc（クラスの説明）へ、`MOVING_SELECTION`で`shiftKey`を読み取り限定は`MoveDirectionRules`へ渡すだけであること・移動量は押した位置からの移動量と反映済みの移動量の差分で求めることを追記。`#applyLeftDragUpdate`の`@param`も`shiftKey`を読むことが分かる説明へ更新（コードは不変）。
    *   `node --test`：tests 1138・pass 1138・fail 0。

### タスク5: 記録しない追加の入口（要件3）
*   **作業内容** :
    *   `js/edit/ShapeInserter.js`：`insertDocument`の本体を非公開`#insert(documentData, dx, dy, record)`へ移し、`insertDocument`は`#insert(…, true)`を呼ぶだけにした（働き・戻り値・記録の単位は不変）。公開メソッド`insertDocumentWithinEdit(documentData, dx = 0, dy = 0)`（`#insert(…, false)`。`beginEdit()`／`commitEdit()`を呼ばない）を足した。`#insert`は`record`が真のときだけ`beginEdit()`／`commitEdit()`で`addShapesWithNewIds`を挟む。
    *   JSDoc：両メソッドと`#insert`、ファイル先頭の責務定義（開いている編集操作の中で記録せずに追加する入口がある旨）、クラスの説明を更新。
    *   追加仕様（監査の指摘）：クラスJSDocの前提で、「ドラッグ中でないこと」は`insertDocument`の前提であり、`insertDocumentWithinEdit`は閾値超過後の左ドラッグ中に呼び出し側が開いている編集操作（ドラッグの編集操作）の中で呼ばれる例外である旨を記述した。
    *   テストは足していない。`node --test`：tests 1138・pass 1138・fail 0。
    *   開発資料への影響：`_doc/arch/14_edit.md`の`ShapeInserter.insertDocumentWithinEdit`の記載（計画の「開発資料の更新予定」に既出）。資料本体は未変更。

### タスク6: 同じ位置に貼り付け（要件6）と`Alt`+ドラッグの複製の手順（要件3）とテスト
*   **作業内容** :
    *   `js/edit/ClipboardController.js`：`pasteInPlace()`（空なら`false`。`insertDocument(data, 0, 0)`。段数を読まず変えない）と`duplicateInPlaceWithinEdit()`（`#serializeSelection()` → `insertDocumentWithinEdit(data, 0, 0)`。クリップボード・段数不変・記録しない・選択が空なら`false`）を足した。JSDoc・先頭の責務定義・クラスの説明（段数の規則・前提にドラッグの編集操作の中で呼ばれる旨）を更新。既存メソッドは不変。
    *   `test/edit/ClipboardController.test.js`を新設（実物の`VectorModel`・`ShapeInserter`・`SnapshotAdapter`・`HistoryManager`・`ClipboardController`。`deleteSelection`は素の関数の偽物）。10ケース（`pasteInPlace`4・`duplicateInPlaceWithinEdit`6）。
    *   `node --test`：tests 1148・pass 1148・fail 0。

### タスク7: `InputTracker`の要件3（`Alt`+ドラッグ）と`main.js`の注入
*   **作業内容** :
    *   `js/core/InputTracker.js`：typedef`InputAssist`（項目は`duplicateSelection`のみ）・既定`NO_INPUT_ASSIST`・コンストラクタ第7引数`inputAssist`（項目ごとに関数でなければ既定へ。`console.warn`なし）・非公開フィールド`#inputAssist`・`#duplicateOnMove`を足した。非公開メソッド`#beginMoveSelection(event, point)`を足し、`handleMouseDown`の`MOVING_SELECTION`の2か所（moveハンドル・選択中の図形の本体）をその呼び出しへ替えた。`#onLeftDragStart`は`beginEdit()`の後に、`MOVING_SELECTION`かつ`#duplicateOnMove`なら`duplicateSelection()`を呼ぶ。`#finishLeftDrag`で`#duplicateOnMove = false`（`#resetSnapState()`の位置・順は不変）。
    *   追加仕様：`#beginLeftDrag`が開始できたかの`boolean`を返すようにし（開始できなければ`false`、できれば末尾で`true`。既存の処理は不変）、JSDocへ`@returns`を足した。`#beginMoveSelection`はその戻り値が真のときだけ`#duplicateOnMove = event.altKey`とする。ほかの呼び出し元（頂点のハンドル・範囲選択）は戻り値を使わない。
    *   `js/main.js`：`new InputTracker(…)`の第7引数に`{ duplicateSelection: () => { clipboardController.duplicateInPlaceWithinEdit(); } }`を足した（`clipboardController`の前方参照の理由をコメントに記載）。`main.js`は877行 → 882行（監査指摘のコメント追記後。追記前は881行）。
    *   JSDoc・コメントの更新（監査の指摘による修正）：`handleMouseDown`（`MOVING_SELECTION`の2か所が`#beginMoveSelection`経由・押した時点の`event.altKey`を記憶する旨）、`class InputTracker`の説明（第7引数`InputAssist`・`Alt`+ドラッグで閾値超過時に注入された複製を呼ぶだけの旨）、`main.js`の「// 4.」のコメント（第7引数の説明）を追記。コンストラクタの`@param`・`#onLeftDragStart`・`#finishLeftDrag`は実装時に更新済みであることを実ファイルで確認した。
    *   `node --test`：tests 1148・pass 1148・fail 0。
    *   開発資料への影響：`_doc/arch/06_InputTracker.md`（第7引数・`#beginLeftDrag`の戻り値・`#beginMoveSelection`）、`_doc/arch/02_main.md`（注入の一覧）。計画の「開発資料の更新予定」に既出。資料本体は未変更。
    *   目視確認推奨：`Alt`+ドラッグで複製が動き元が残ること、`Alt`を押して閾値以内で離すと複製されないこと、元に戻す1回で複製前へ戻ること。

### タスク8: `Alt`の単独押下の抑止（要件4）
*   **作業内容** :
    *   `js/core/AltKeyGuard.js`を新設（クラス`AltKeyGuard`）。コンストラクタで`document`の`keydown`・`keyup`を購読し、`event.key === 'Alt'`かつ`event.ctrlKey`が偽かつ`isTextInputElement(document.activeElement)`が偽のときだけ`event.preventDefault()`。状態なし・公開メソッドなし。importは`./InputTracker.js`の`isTextInputElement`のみ。`document`の参照はコンストラクタ内だけ。
    *   `js/main.js`：`AltKeyGuard`をimport（`KeyboardShortcuts`のimportの次の行）。「// 8.」の`new KeyboardShortcuts(…)`の後に`new AltKeyGuard();`（インスタンス非保持）とコメントを追加。`main.js`は882行 → 888行。
    *   JSDoc・コメントの更新（実ファイルで確認済み）：
        *   `AltKeyGuard.js`先頭の責務定義（3行以内：Altキー単独押下・解放の標準動作をpreventDefaultで抑止することのみ・状態なし）。
        *   クラス`AltKeyGuard`のJSDoc（対象・対象外（AltGr・Ctrl同時・テキスト入力中・Alt+ほかのキー）・状態なし・公開メソッドなし・`InputTracker`／`KeyboardShortcuts`へ入れない理由）。
        *   コンストラクタのJSDoc（購読の内容・最上位でDOMに触れない旨）と、ハンドラ`handleAltKey`のJSDoc（`@param event`・`@returns`・対象条件）。
        *   `main.js`の`new AltKeyGuard();`直前のコメント（目的・インスタンス非保持の理由・`InputTracker`／`KeyboardShortcuts`へ入れない理由）。
    *   自動テストは足していない（計画どおり）。`node --test`：tests 1148・pass 1148・fail 0。
    *   開発資料への影響：`_doc/arch`のAltKeyGuardの新設・`main.js`の「// 8.」の記載（計画の「開発資料の更新予定」に既出のはず）。資料本体は未変更。
    *   目視確認推奨：`Alt`を単独で押して離してもブラウザのメニューへフォーカスが移らないこと、テキスト入力中は抑止されないこと、`Alt`+ドラッグが従来どおり動くこと。

### タスク9: `D`の値と手本から取り込む値の規則（要件7・8）とテスト
*   **作業内容** :
    *   `js/edit/StylePanelRules.js`：typedef`StyleApplication`、凍結定数`RESET_COLORS_STYLE`（`{ strokeColor: '#000000', fillColor: '#ffffff' }`）、関数`sampleStyleFromShape(shape)`（線の色・太さは常に、`fillColor`は`isFillable()`が真のときだけ。新しいオブジェクト）を足した。importは増やしていない。
    *   `js/core/VectorModel.js`：コメントのみ（コードは不変）。`DEFAULT_NEW_SHAPE_STYLE`のJSDocへ、`RESET_COLORS_STYLE`と色の値が重なるが別の定義であること・塗りの有無が違うこと・`edit/`は本ファイルをimportしないことを追記。
    *   `test/edit/StylePanelRules.test.js`：import・先頭の責務に`RESET_COLORS_STYLE`・`sampleStyleFromShape`を追記し、`describe`を2つ追加（6ケース。既存のケースは不変）。`RESET_COLORS_STYLE`（値・`strokeWidth`を持たない・凍結）、`sampleStyleFromShape`（塗れる形（`Rect`・円・閉じた`Path`）は`fillColor`あり、`Line`・開いた`Path`はキーなし、線なし・塗りなしは`null`、小数の太さ・`'red'`・`'#ABC'`・`'rgb(1,2,3)'`をそのまま、図形を書き換えない・毎回新しいオブジェクト）。
    *   JSDoc・コメントの更新（実ファイルで確認済み）：
        *   `StylePanelRules.js`先頭の責務定義（3行以内。スタイルをまとめて当てるときの値の規則を追記）。
        *   typedef`StyleApplication`のJSDoc（項目・`null`の意味・値の検証をしないこと）。
        *   `RESET_COLORS_STYLE`のJSDoc（`D`の値・唯一の定義・`DEFAULT_NEW_SHAPE_STYLE`とは別の定義であること）。
        *   `sampleStyleFromShape`のJSDoc（`@param`・`@returns`・検証しないこと・読むプロパティ）。
        *   `VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE`のJSDoc（上記）。
        *   テストファイル先頭の責務定義。
    *   `node --test`：tests 1154・pass 1154・fail 0。
    *   開発資料への影響：`_doc/arch/14_edit.md`（`RESET_COLORS_STYLE`・`sampleStyleFromShape`・`StyleApplication`）、`_doc/arch/03_VectorModel.md`（別定義の記載）、`_doc/arch/16_test.md`（件数）。計画の「開発資料の更新予定」に既出。資料本体は未変更。

### タスク10: スタイルをまとめて当てる入口と`D`の入口（要件7）とテスト
*   **作業内容** :
    *   （未実施）

### タスク11: スポイトの待ち受けの持ち主と取り込みの手順（要件8）とテスト
*   **作業内容** :
    *   （未実施）

### タスク12: `resolveActiveTool`の第3引数（要件8）とテスト
*   **作業内容** :
    *   （未実施）

### タスク13: `InputTracker`の要件8（スポイトの待ち受けの照会と受け渡し）
*   **作業内容** :
    *   （未実施）

### タスク14: 選択の反転（`Ctrl`+`I`）と同じ位置に貼り付け（`Ctrl`+`Shift`+`V`）のキーと操作関数
*   **作業内容** :
    *   （未実施）

### タスク15: `D`のキー
*   **作業内容** :
    *   （未実施）

### タスク16: スポイトのボタンと待ち受けの配線
*   **作業内容** :
    *   （未実施）

### タスク17: スポイトのキー（`I`）
*   **作業内容** :
    *   （未実施）

### タスク18: コメントの整理とJSDocの確認
*   **作業内容** :
    *   （未実施）

### タスク19: 開発資料への反映（固定タスク）
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント

### 計画時の判断（実装・監査で確認してほしい点）
* **`lastCursor`の廃止**：`InputTracker`の公開フィールド`lastCursor`は`InputTracker.js`の中でしか参照されていない（`Grep`で確認）。押した位置からの移動量へ改めると「直前のカーソル位置」の意味が無くなるため、名前と意味の食い違いを残さないよう廃止し、非公開の`#moveOrigin`・`#appliedMoveDelta`に置き換える（REQ要件10「そのための作業用フィールド」の範囲と判断）。
* **`ClipboardController`へのメソッド2つ**：REQのスコープの見込みは「同じ位置に貼り付けのメソッドの追加」だが、`Alt`+ドラッグの複製の手順（`duplicateInPlaceWithinEdit`）も同じクラスへ置く。選択中の図形の取り出しと作業データへの変換（`#serializeSelection`）を二重に書かないため（新しいクラスに分けると同じ取り出しを再定義することになる）。責務の「複製の手順」の範囲内。
* **`main.js`の`selectAll`の変更**：`ensureSelectMode()`を足すにあたり、既存の`selectAll`のコールバックの同じ前処理もこの呼び出しへ替える（同じ処理を3か所以上に書かないため。働きは同じ）。
* **`Esc`の判定の置き場所**：`StyleEyedropper.cancelPicking(fallback)`（待ち受け中なら待ち受けだけをやめ、でなければ`fallback`の結果）にして、`main.js`に分岐を置かない。
* **`applyMode`での`syncToolPalette`の2回の呼び出し**：待ち受け中に`applyMode`を通ると、`stop()`の通知と`applyMode`の末尾で2回呼ばれる。同じ結果を2回設定するだけで害はない（通知の順序に依存させないため、`applyMode`の末尾の呼び出しは残す）。
* **選択の状態での貼り付けと待ち受け**：選択の状態での`Ctrl`+`V`・`Ctrl`+`Shift`+`V`・`Ctrl`+`D`は`applyMode`を通らないため、待ち受けが続く（REQの「`applyMode`を通ったら必ずやめる」の規則どおり。REQの「続く」の列挙には無いが、規則から導かれる結果）。
* **`StyleEyedropper`の生成位置**：`InputTracker`のコンストラクタの`#updateCursor()`が`#resolveCursor` → `isPickingShape()`を呼ぶため、`styleEyedropper`は`inputTracker`より前に生成する必要がある（後に置くと起動時に`ReferenceError`）。
* **取り込んだ直後のカーソル**：`handleClick`での取り込みの後にカーソルを再評価しない（REQ要件8で`InputTracker`へ足す箇所を照会と受け渡しに限ったため）。取り込んだ後は、次にマウスを動かすまで`cell`のまま。
* **選択なしで変換できない色を取り込んだときの表示**：オプションバーは覚えている色を斜線なしで表示し、次に描く図形には取り込んだ色（例`'red'`）がそのまま入る（既存の`newShapeColorView`の規則。2章の確認結果）。表示と実際の色が食い違って見えるため、目視で確認してほしい。
* **`Shift`+ホイール**：ブラウザ・OSによっては`Shift`+ホイールが横スクロール（`deltaY`が0）になり、`handleWheel`の既存の規則でズームしない。ドラッグ中の`Shift`の限定はホイールの追従でも働く設計だが、この場合はズーム自体が起きない（既存の振る舞い）。
* **`Ctrl`+`I`のブラウザの標準動作**：Firefoxでは`Ctrl`+`I`がページの情報を開くことがある。`preventDefault()`で抑止できるかは実際のブラウザで確かめる。

### テストプレイで確認すべき項目（操作手順と期待する結果）
※【実ブラウザ】は、実装AIの確認が合成イベントのみのため、実際のブラウザでの確認が要る項目。
1. **`Ctrl`+クリック**【実ブラウザ】：図形Aをクリックして選択 → `Ctrl`を押しながら図形Bをクリック → AとBの両方にハンドルが出る。もう一度`Ctrl`+Bのクリック → Bだけ外れ、Aは選択のまま。
2. **`Ctrl`+空白のクリック**【実ブラウザ】：図形を選択 → `Ctrl`を押しながら空白をクリック → 選択は解除されない。`Ctrl`なしで空白をクリック → 解除される。
3. **`Ctrl`+範囲選択**【実ブラウザ】：図形Aを選択 → `Ctrl`を押しながら空白からドラッグして図形B・Cの輪郭に矩形をかけて離す → A・B・Cが選択。図形の無い所で`Ctrl`+範囲選択 → 選択は変わらない。`Ctrl`なしの範囲選択 → かかった図形だけ（0件なら全解除）。範囲選択の途中で`Ctrl`を押す／離す → 離した時点の`Ctrl`で決まる。
4. **`Ctrl`を押したまま選択中の図形**【実ブラウザ】：選択中の図形を`Ctrl`を押しながら押して動かさずに離す → その図形が選択から外れる。`Ctrl`を押しながら押して動かす → 移動し、選択は変わらない（Undo 1回で移動前）。
5. **`Ctrl`+クリックとハンドル**：選択中の図形のハンドル（頂点・移動用）の上で`Ctrl`+クリック → 何も起きない。選択集合の図形のハンドルが別の図形の本体と重なる位置で`Ctrl`+クリック → ハンドルが優先され何も起きない。図形の輪郭から5px以内で`Ctrl`を押してドラッグ → 範囲選択にならない（`Ctrl`なしと同じ）。
6. **選択していない図形の`Ctrl`ドラッグ・`Alt`ドラッグ**：選択していない図形を`Ctrl`または`Alt`を押しながらドラッグ → 何も動かない（今の仕様のまま）。
7. **`Alt`+ドラッグ**【実ブラウザ】：図形を選択 → `Alt`を押しながら本体をドラッグ → 元の図形は元の位置に残り、複製が動く。離した後は複製だけが選択。Undo 1回 → 複製が消え元が選択された状態。Redo 1回 → 複製して動かした後の状態。閾値以内で離す → 複製されない。
8. **`Alt`+ドラッグ（移動用ハンドル）**：移動用のハンドルを`Alt`+ドラッグ → 7と同じ。頂点のハンドルを`Alt`+ドラッグ → 複製されず頂点が動くだけ。
9. **`Alt`の押す時点**【実ブラウザ】：`Alt`なしで押してからドラッグの途中で`Alt`を押す → 複製にならない。`Alt`を押して押下しドラッグの途中で`Alt`を離す → 複製のまま。
10. **`Alt`+ドラッグとクリップボード**：図形Xをコピー → 別の図形Yを`Alt`+ドラッグで複製 → `Ctrl`+`V` → Xの複製が貼り付けられる（ずらし量はコピー直後と同じ1段）。
11. **`Alt`+ドラッグの中断**：`Alt`+ドラッグの途中でウィンドウの外をクリックする等で`blur` → 残った複製と途中までの移動が1件として記録され、Undo 1回で複製前に戻る。
12. **`Shift`+ドラッグ**【実ブラウザ】：選択中の図形を`Shift`を押しながらドラッグ → 横・縦・斜め45°のうちカーソルの向きに近い直線の上だけを動く。途中で`Shift`を離してマウスを動かす → カーソルの位置へ戻る。`Shift`なしで動かし始めて途中で`Shift`を押してマウスを動かす → その時点から限定される。キーだけ押して／離してマウスを動かさない → 変わらない。移動用ハンドルでも同じ。頂点のハンドル・範囲選択・図形の作成・パンでは`Shift`は何もしない。
13. **`Shift`と`Alt`の同時**：`Alt`+`Shift`で選択中の図形をドラッグ → 複製が方向を限定されて動く。
14. **ドラッグ中のホイール**：選択中の図形をドラッグしたままホイールでズーム → 図形がカーソルへ追従し直す（`Shift`を押している間は限定されたまま）。
15. **`Ctrl`+`I`**【実ブラウザ】：図形を一部選択 → `Ctrl`+`I` → 選択が反転。全選択で`Ctrl`+`I` → 何も選択されない。図形0個 → 何も起きない。図形作成モード・キャンバス移動モードで`Ctrl`+`I` → 選択の状態へ切り替わって全選択になる（作成途中の図形は破棄）。Undoの履歴は増えない。Firefoxでページの情報が開かないこと。
16. **`Ctrl`+`Shift`+`V`と`Ctrl`+`V`**【実ブラウザ】：図形をコピー → `Ctrl`+`Shift`+`V` → 元と同じ位置に重なって貼り付けられ、貼り付けた図形だけが選択。続けて`Ctrl`+`V` → 1段ずれて貼り付け（`Ctrl`+`Shift`+`V`が段数に影響しない）。押しっぱなしで同じ位置に重ならない（キーリピートで実行しない）。クリップボードが空なら何も起きずモードも変わらない。図形作成モードで押す → 選択の状態へ切り替わって貼り付け。Undo 1回で貼り付け前。太さの欄にフォーカスがある間は働かない（入力欄への「書式なしで貼り付け」を妨げない）。
17. **`D`**【実ブラウザ】：図形を選んで`D` → 線が黒・塗れる形の塗りが白（塗りあり）になり、オプションバーの表示も変わる。太さは変わらない。Undo 1回で`D`の前に戻る。何も選ばずに`D` → オプションバーが線あり黒・塗りあり白になり、次に描く図形がそのスタイル（履歴は増えない）。塗れない形（直線・曲線・弧・開いたパス）だけを選んで`D` → 線だけ黒（塗りの欄は無効のまま）、選択を外すとオプションバーの塗りはあり白。図形を描いている途中に`D` → 作成途中の図形も変わる。操作モードは変わらない。色の欄にフォーカスがある間は働かない。
18. **スポイト（`I`）**【実ブラウザ】：図形Aを選択 → `I` → ツールパレットのスポイトのボタンが押し込み・選択のボタンは押し込みでなくなる、マウスを動かすとカーソルが`cell` → 図形Bをクリック → Aの線・塗り・太さがBと同じになり、選択の押し込みに戻る、Aは選択のまま。Undo 1回でAが元に戻る。
19. **スポイト（選択なし）**：何も選ばずに`I` → 図形をクリック → オプションバー（次に描く図形）がその図形のスタイルになる。履歴は増えない。
20. **スポイト（塗れない形を手本）**：塗った矩形を選択 → `I` → 直線をクリック → 矩形の線と太さだけが変わり、塗りは変わらない。
21. **スポイト（何もない所）**：`I` → 空白をクリック → 何も起きず待ち受けが続く（スポイトの押し込みのまま）。
22. **スポイトの`Esc`**：図形を選択 → `I` → `Esc` → 待ち受けだけがやめ（選択の押し込みに戻る）、選択は残る。もう一度`Esc` → 選択が解除される。
23. **待ち受け中の押下**：`I` → 選択中の図形をドラッグ／ハンドルをドラッグ／空白からドラッグ → 何も始まらない（移動・変形・範囲選択しない）。中ボタンのドラッグ・`Space`+ドラッグでパン、ホイールでズームは働く。パン中・`Space`を押している間のカーソルは今のまま（`grabbing`・`grab`）。
24. **待ち受け中のホバー**：`I`の後にマウスを図形の上へ動かす → その図形が強調される。
25. **ボタンからのスポイト**：ツールパレットの💉を押す → 18と同じ。待ち受け中にもう一度💉・`I` → 何も変わらない。待ち受け中に🖱・✋・図形のボタン・`V`・`H`・`P`・数字キー → 待ち受けがやめて、そのツールの押し込み。図形作成モードで`I` → 選択の状態に切り替わり（選択は空）、取り込むと選択の状態のまま（元の図形のツールへ戻らない）。
26. **待ち受けが続く操作**：`I`の後に`Ctrl`+`Z`・`Ctrl`+`Y`・`Ctrl`+`A`・`Ctrl`+`I`・`Delete`・`D`・`Z`・`X`・`C`・`Tab` → スポイトの押し込みのまま。キャンバスの切り替え・インポート → 待ち受けがやめる。
27. **パレットを隠している間**：`Tab`でパレットを隠す → `I`・`V`・数字キーを押す → `Tab`で出したときに押し込みの表示が最後の状態と一致する。
28. **アウトライン表示（`Z`）の間**：`Ctrl`+クリック・`Alt`+ドラッグの押下・スポイトのクリックで、塗った図形の内側（輪郭から離れた所）が当たりにならない（空白の扱い）。
29. **`Alt`の単独押下**【実ブラウザ】：Windowsのブラウザ（Chrome・Edge・Firefox）で`Alt`を押して離す → メニューへフォーカスが移らず、続けて`V`・`I`等のキーとマウスの操作が効く。`Alt`+ドラッグの後も同じ。
30. **`Alt`+ほかのキーを奪わない**【実ブラウザ】：`Alt`+`←`（戻る）・`Alt`+`D`（アドレスバー）・`Alt`+`F4`・`Alt`+`Tab`がブラウザ・OSのとおりに働く。`AltGr`（右`Alt`。ドイツ語配列等）での文字入力が太さの欄・ページで妨げられない。
31. **入力欄**：太さの欄にフォーカスがある間、`D`・`I`・`Ctrl`+`I`・`Ctrl`+`Shift`+`V`が働かない。色の欄にフォーカスがある間、`D`・`I`は働かず、`Ctrl`+`I`・`Ctrl`+`Shift`+`V`は働く。
32. **修飾キーの組み合わせ**【実ブラウザ】：`Ctrl`+`Shift`+`I`（開発者ツール）・`Shift`+`D`・`Shift`+`I`・`Ctrl`+`Alt`+`I`・`Alt`+`I`等を押しても停止せず、コンソールにエラーが出ない（`Shift`+`D`・`Shift`+`I`・`Alt`付きは何もしない）。
33. **IME**【実ブラウザ】：IMEをオンにした状態で`D`・`I`を押す → 変換中は働かない。
34. **macOS**【実ブラウザ】：`⌘`+クリック・`⌘`+範囲選択が`Ctrl`と同じに働く。`⌘`+`I`・`⌘`+`Shift`+`V`。`Option`+ドラッグで複製（macOSの`Ctrl`+クリックは右クリックの扱いになるため`⌘`を使う）。
35. **💉の見え方**【実ブラウザ】：ツールパレットのボタンが崩れず、パレットが1つ分縦に伸び、ステータスバーと重ならない。`title`が「スポイト (I)」。
36. **既存の操作の不変**：修飾キーを押さずに、図形の作成・選択（クリック・範囲選択）・移動（本体・移動用ハンドル）・変形・削除・結合・端点への吸い付き・スタイル（オプションバー）・重なり順・取り消し/やり直し（件数と内容）・コピー/切り取り/貼り付け/複製・表示の切り替え・キャンバスパレット・自動保存が今までと同じに動き、ホバーの強調・カーソルの形も同じ。コンソールにエラー・警告が出ない（起動時の`ToolPalette`の警告が無いこと）。

### コメントの洗い出し（タスク18で確認する対象）
* `js/core/InputTracker.js`：先頭の責務定義、クラスの説明（修飾キー・第7引数・待ち受け）、`InputAssist`・`NO_INPUT_ASSIST`、コンストラクタの`@param`、`handleMouseDown`・`handleClick`・`handleWheel`・`#beginLeftDrag`・`#onLeftDragStart`・`#applyLeftDragUpdate`・`#onLeftDragEnd`・`#commitMarquee`・`#finishLeftDrag`・`#resolveCursor`のJSDoc、`lastCursor`への言及の削除。
* `js/core/KeyboardShortcuts.js`：`ShiftRule`、`ShortcutActions`、`SHORTCUT_BINDINGS`の説明、`#handleKeyDown`・`#findBinding`のJSDoc。
* `js/core/ToolRules.js`：先頭の責務定義、`TOOL_IDS`（識別子の約束・並び）、`EYEDROPPER_TOOL_ID`、`resolveActiveTool`。
* `js/core/VectorModel.js`：`DEFAULT_NEW_SHAPE_STYLE`のコメント（`RESET_COLORS_STYLE`との関係）。
* `js/edit/ShapeInserter.js`・`ClipboardController.js`・`ShapeStyleEditor.js`・`StylePanelRules.js`：先頭の責務定義とクラスの説明。
* `js/main.js`：「// 4.」（`styleEyedropper`・第7引数）、`syncToolPalette`、`applyMode`、`ensureSelectMode`、`toolActions`、`startEyedropper`、「// 7.5.」（`performPaste`）、「// 8.」（貼り付け・`selectAll`・`cancel`・足した4つのコールバック・`AltKeyGuard`）。
* `index.html`：ツールパレットのCSSコメント（位置・大きさの数値）、「選択・キャンバス移動」のまとまりの説明（スポイトを含む）。
