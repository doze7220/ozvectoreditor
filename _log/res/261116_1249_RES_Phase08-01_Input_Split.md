# RES: 作業計画・作業レポート (Phase 08-01) : 下準備（ふるまいを変えない分割し直し：`InputTracker.js`からの判定の切り出しと`main.js`の表示配線の切り出し）
* 参照元REQ: `./_log/req/261116_1217_REQ_Phase08-01_Input_Split.md`

## 1. 作業目的

大きくなった2つのファイル（`js/core/InputTracker.js` 1571行、`js/main.js` 1018行）から、**共有の定数・判定の規則**と**表示の配線**を別ファイルへ出し、後続のサブフェイズで入力の解釈に手を入れる前に「触る場所が小さく、`node --test`で確かめられる」状態を作る。

**本作業はふるまいを一切変えない分割し直し（リファクタリング）である。** 次を満たさない変更は失敗とみなす。

* 画面の見た目と、すべての操作が本作業の前とまったく同じように動く（確認項目は要件6／タスク11）。
* リポジトリのルートの`node --test`が全件通る。既存のテストの期待値は書き換えない（切り出しに伴うimportパスの変更だけは許す）。
* `VectorModel`・`CanvasManager`・履歴・作業データ形式・書き出し形式には一切触れない（版はどちらも2のまま）。
* 改名・整形・「不要に見えるコードの削除」「性能の改善」を行わない。既存の公開メソッド名・フィールド名・DOMのid・クラス名・CSSを変えない。移したコードの中身（判定の順序・比較の条件・戻り値）も変えない。JSDocは移動先に合わせて主語・参照先を直すだけとする。
* **定義箇所を増やさない**：切り出したものを切り出し元に残さない。再exportで二重に見せない。取り込み側のimport元は新しい定義箇所へ一本化する。

**用語**（本計画書・コード・資料で使い分ける）：
* **スナップ**：座標・移動量を単位（1px／グリッド10px）の倍数へ丸めること（`js/core/UnitSnapRules.js`・`UnitSnapSettings.js`）。
* **端点への吸い付き**：直線を描くとき・線の端点のハンドルをドラッグするときに、結合できる線の端点へ吸い付くこと（`js/shapes/EndpointSnapRules.js`・`js/edit/EndpointSnapper.js`）。既存の識別子の`snap`はどちらを指すかが混在しているが、**本作業では識別子を改名しない。**

---

## 2. アーキテクチャ設計

### 要件1: `InputTracker.js`が抱えている共有の定数・判定を外へ出す

#### (a) 操作モードと入力状態の定数 → `js/core/InputModes.js`（新規）

* `js/core/InputModes.js`を新設し、`InputTracker.js`の`export const InputState`（JSDoc込み。現状17行。`IDLE`・`DRAWING`・`DRAGGING_HANDLE`・`MOVING_SELECTION`・`MARQUEE_SELECTING`）と`export const OperationMode`（JSDoc込み。現状14行。`SELECT`・`CREATE`・`PAN`）を**そのまま移す**。
* **値（文字列）を変えない。凍結の有無も変えない**（`InputState`は素のオブジェクト、`OperationMode`は`Object.freeze`のまま。どちらも今の記述をそのまま移す）。
* **importなし・DOMなし・値の定義だけ**を持つ（`core/`の規則のファイルと同じ約束。状態を持たない）。
* 先頭に3行以内の責務定義のJSDocを書く（例：「責務: 入力の状態（`InputState`）と操作モード（`OperationMode`）の値の定義だけを持つ。import・DOM・判定を持たない」）。
* JSDocの本文は移動先に合わせて参照先だけを直す（`setMode()`→`InputTracker.setMode()`のように、別ファイルになったメソッドへの参照を修飾する）。`PointHit`のtypedef（`InputTracker.js`の32〜36行）は**移さない**（`InputTracker.js`に残す）。
* **取り込み側のimport元を`InputModes.js`へ変える**（全文検索（`grep -rn "InputTracker.js'" --include=*.js .`および`\bInputState\b`・`\bOperationMode\b`）で確定済み。REQに挙がっている5ファイルで漏れなし）：
    * `js/core/InputTracker.js`（`InputState`・`OperationMode`の両方を使う）
    * `js/core/ToolRules.js`（`OperationMode`）
    * `js/core/KeyboardShortcuts.js`（`OperationMode`）
    * `js/main.js`（`OperationMode`）
    * `test/core/ToolRules.test.js`（`OperationMode`）
    * ※`InputState`は`InputTracker.js`の外では使われていない（検索結果0件）。
* **`InputTracker.js`からの再exportは残さない。**
* 副作用（意図した改善ではなく、依存の整理の結果）：`ToolRules.js`・`test/core/ToolRules.test.js`は`InputTracker.js`をimportしなくなる。開発資料の「`ToolRules.test.js`は`InputTracker.js`を間接にimportするため、`InputTracker.js`の最上位でDOMに触れる変更をすると壊れる」という記述が実態と合わなくなるため、最終タスクで直す（タスク12）。

#### (b) `SHAPE_TYPES`の再export → 消す

* `InputTracker.js`の`export { SHAPE_TYPES };`とその直前のJSDoc（53〜58行）を消す。`import { SHAPE_TYPES } from './ShapeFactory.js';`は**残す**（`InputTracker`内の`setShapeType`の受理判定・`currentShapeType`の初期値で使っており、使い方は今のまま）。
* 取り込み側（`js/core/KeyboardShortcuts.js`）が`./ShapeFactory.js`から直接取るようにする（正本からの直接import。`main.js`は既に`ShapeFactory.js`から取っている）。

#### (c) フォーカスしている要素の判定 → `js/core/FocusKeyYieldRules.js`（新規）

* `js/core/FocusKeyYieldRules.js`を新設し、`InputTracker.js`の165〜236行（JSDoc込み）を**そのまま移す**：
    * `TEXT_INPUT_TYPES`（モジュール内のみ）・`isTextInputElement`（export）
    * `SPACE_OPERATED_INPUT_TYPES`（モジュール内のみ）・`isSpaceOperatedInputElement`（export）
    * `isToggleButtonElement`（**exportしない**。移動先のモジュール内だけで使う）
    * `isSpaceYieldedElement`（**exportする**。`InputTracker`が使うため、移動に伴い非公開から公開になる。関数の中身は変えない）
* 責務は「フォーカスしている要素が、キー（`Space`・ショートカット）をその部品に譲るべきものかの判定」。先頭に3行以内の責務定義のJSDocを書く。
* **DOMの型（`HTMLInputElement`・`HTMLTextAreaElement`・`HTMLElement`・`HTMLButtonElement`）を参照するのは関数の中だけとし、モジュールの最上位ではDOMに触れない**（今の作りと同じ約束。`node --test`でimportできる状態を保つ）。DOMのid・クラス名は見ない（`aria-pressed`は標準の属性なので今のまま使う）。`document`も参照しない（判定対象の要素は引数で受ける）。
* **取り込み側のimport元を`FocusKeyYieldRules.js`へ変える**（全文検索で確定済み。REQに挙がっている3ファイルで漏れなし）：
    * `js/core/InputTracker.js`：`isTextInputElement`・`isSpaceYieldedElement`（使用箇所は`#handleSpaceKeyDown`相当の1011行と`handleKeyUp`相当の1406行の2か所）
    * `js/core/KeyboardShortcuts.js`：`isTextInputElement`・`isSpaceOperatedInputElement`
    * `js/core/AltKeyGuard.js`：`isTextInputElement`
* **`InputTracker.js`からの再exportは残さない。**
* **自動テストは足さない**（ブラウザのDOMの型に依存する。テストのためにソースを書き換えない）。開発資料の「テストできない箇所」の一覧に1行足す（タスク12）。

#### (d) 移さないもの

* `hasCtrlModifier`（マウスイベントの`Ctrl`／`⌘`の読み取り。`main.js`が`CanvasCursorTracker`へ注入するためのexport）と`WHEEL_ZOOM_STEP`は**`InputTracker.js`に残す**（今のexportと取り込み側をそのままにする）。`DRAG_START_THRESHOLD`・`EditRecorder`・`NO_EDIT_RECORDER`・`EndpointSnapAssist`・`NO_SNAP_ASSIST`・`InputAssist`・`NO_INPUT_ASSIST`・`PointHit`のtypedefも残す。
* **修飾キー（`Ctrl`／`⌘`）の用途は増やさない。`hasCtrlModifier`を呼ぶ場所・回数を変えない。**

---

### 要件2: 「押したときに何を始めるか」の分岐 → `js/core/PressActionRules.js`（新規）

* **置き場所**：`js/core/PressActionRules.js`（`SelectionRules.js`・`MoveDirectionRules.js`・`UnitSnapRules.js`と同じ位置づけ。**状態を持たない・importなし・DOMなし・引数を書き換えない**）。先頭に3行以内の責務定義のJSDocを書く。
* **公開する関数**：`resolvePressAction(hit, isSelected)`
    * 第1引数`hit`：当たり分類の結果（`js/core/PointHitRules.js`の`PointHit`。**型の参照はJSDocの`import('./PointHitRules.js').PointHit`のみで、`import`文は書かない**）。
    * 第2引数`isSelected`：`(id: string) => boolean`。図形が選択集合に入っているかの照会（`PointHitRules.classifyPointHit`が`isSelected`を関数で受けているのと同じ形）。**`VectorModel`そのものは渡さない。**
* **戻り値**：typedef`PressAction`（`SelectionRules.js`の`SelectionChange`と同じ考え方）。
    * `{ type: 'moveSelection' }`：選択集合の平行移動を始める
    * `{ type: 'dragHandle', target: {shapeId, handle} }`：そのハンドルのドラッグを始める（`target`は`hit.handle`をそのまま返す）
    * `{ type: 'marquee' }`：範囲選択を始める
    * `null`：何もしない
    * **`InputState`をimportしない**（戻り値は操作の種類を表す独自の値とし、`InputState`への対応づけは`InputTracker`側で行う）。
* **判定（今の`handleMouseDown`の881〜897行と1対1。順序・比較の条件を変えない）**：
    1. `hit.handle`が真かつ`hit.handle.handle === 'move'` → `{ type: 'moveSelection' }`
    2. `hit.handle`が真（それ以外のハンドル名） → `{ type: 'dragHandle', target: hit.handle }`
    3. `hit.bodyId`が真かつ`isSelected(hit.bodyId)`が真 → `{ type: 'moveSelection' }`
    4. `hit.bodyId === null` → `{ type: 'marquee' }`
    5. それ以外（本体に当たり、選択集合外） → `null`
    * ※4の条件は今のコードのまま`=== null`で書く（`hit.bodyId`が偽でも`null`でない値のときの結果を変えないため）。
    * ※`isSelected`を呼ぶのは3の判定のときだけ（今と同じ条件・同じ回数。`model.isSelected`の呼び出し回数を変えない）。
* **ハンドル名`'move'`の文字列**：このファイルのモジュール内の定数（例：`MOVE_HANDLE_NAME`。exportしない）として持ち、**比較する箇所を1つにする**（REQ要件2の目的）。
    * 本要件で`InputTracker.js`から移すのは、**882行の比較`if (hit.handle.handle === 'move')`の1か所だけ**である。移した後の`InputTracker.js`に`'move'`との**比較**は残らない。
    * `InputTracker.js`に残る`'move'`の**言及（説明文）は消さない・書き換えない**：482行の`#dragHandleName`のJSDoc（「…押下時の各図形の`hitTestHandle`の戻り値。`'move'`以外）。」）はそのまま残す（整形・不要に見える記述の削除は禁止）。
    * 837行の`handleMouseDown`のJSDocの手順(6)の分岐表に出てくる`'move'`は、REQの指示により分岐表ごと`PressActionRules.js`へ移る分である。
    * `#resolveCursor`のJSDocと戻り値の`'move'`（1501・1504・1505・1510・1538・1550・1554行）は**要件3**で`CursorShapeRules.js`へ移る分であり、本要件（タスク4）では触れない。
* **`InputTracker`側**（`handleMouseDown`の末尾の分岐だけを置き換える）：
    ```
    const action = resolvePressAction(hit, (id) => this.model.isSelected(id));
    ```
    の結果を見て、**今と同じ**非公開メソッドを**今と同じ引数・同じ順序**で呼ぶ。
    * `'moveSelection'` → `this.#beginMoveSelection(event, point)`
    * `'dragHandle'` → `this.#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, action.target)`
    * `'marquee'` → `this.#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point)`
    * `null` → 何もしない
    * `#beginMoveSelection`が押下時の`event.altKey`を記憶する動き（`Alt`+ドラッグの複製の判定）、ハンドルのドラッグ・範囲選択では記憶しない動きを変えない。
* **分岐表の外は触らない**：`handleMouseDown`の手順(1)〜(5a)（click抑止フラグの解除・中ボタンのパン・ドラッグセッション中の無視・スペース／キャンバス移動モードのパン・左ボタン以外の無視・状態とモードの前提の確認・待ち受け中の打ち切り。847〜876行）は`InputTracker`に残し、順序も変えない。
* **JSDoc**：`handleMouseDown`のJSDocの手順(6)の分岐表は`PressActionRules.js`へ移し、`handleMouseDown`側は「分岐は`PressActionRules.resolvePressAction`が決め、結果を今の非公開メソッドへ振り分ける」という形に書き換える（`SelectionRules`の呼び出しの既存の書き方にそろえる）。`#beginMoveSelection`経由で`event.altKey`を記憶する注記は残す。
* **自動テスト**：`test/core/PressActionRules.test.js`を新規に足す。各分岐と境界を確かめる：
    * ハンドルあり＋ハンドル名`'move'` → `moveSelection`（`isSelected`を呼ばないこと）
    * ハンドルあり＋`'move'`以外（`vertex-0`等） → `dragHandle`で`target`が渡した`hit.handle`と一致すること
    * 本体に当たり選択集合内 → `moveSelection`
    * 本体に当たり選択集合外 → `null`
    * 当たり分類が空（`handle: null, bodyId: null`） → `marquee`
    * ハンドルと本体の両方があるときはハンドルが優先されること
    * 引数（`hit`）を書き換えないこと、同じ入力で同じ結果になること
    * `isSelected`が呼ばれる回数と引数（本体に当たったときだけ1回、`hit.bodyId`で呼ばれる）

---

### 要件3: 「カーソルの形」の判定 → `js/core/CursorShapeRules.js`（新規）

* **置き場所**：`js/core/CursorShapeRules.js`（要件2と同じ位置づけ。状態を持たない・DOMなし・引数を書き換えない）。**要件2とは別のファイル**（責務が違う）。要件1(a)の`InputModes.js`だけはimportしてよい（操作モード・入力状態の値を比べるため）。先頭に3行以内の責務定義のJSDocを書く。
* **公開する関数**：`resolveCursorShape(input)`。引数は1つのオブジェクト（読む値が8つあり、個別の引数では呼び出し側で順序を間違えやすいため）。typedef`CursorShapeInput`の項目は次のとおり（今の`#resolveCursor`が読んでいる値と1対1）：
    | 項目 | 型 | 今の読み取り元 |
    | --- | --- | --- |
    | `isPanning` | `boolean` | `this.#isPanning` |
    | `isSpacePressed` | `boolean` | `this.#isSpacePressed` |
    | `isLeftDragState` | `boolean` | `this.#isLeftDragState()` |
    | `mode` | `string` | `this.currentMode` |
    | `state` | `string` | `this.state` |
    | `isPickingShape` | `() => boolean` | `this.#inputAssist.isPickingShape()` |
    | `hit` | `PointHit \| null` | `#updateCursor`の引数 |
    | `isSelected` | `(id: string) => boolean` | `this.model.isSelected(id)` |
* **`isPickingShape`・`isSelected`は関数で受ける**（値ではなく関数にする理由：今のコードは短絡評価で、`isPickingShape()`は選択モードのときだけ・`model.isSelected()`は本体に当たったときだけ呼ばれる。値で受けると呼び出しの回数が増え、「呼び出しの順序と回数を変えない」という最上位の要件に反する。`main.js`の生成順の制約（`StyleEyedropper`は`InputTracker`より先に生成する。`InputTracker`のコンストラクタが`#updateCursor()`→`isPickingShape()`を呼ぶため）も今のまま保たれる）。`PointHitRules.classifyPointHit`・要件2が`isSelected`を関数で受けるのと同じ形である。**`VectorModel`・`InputTracker`・DOMは渡さない。**
* **`isLeftDragState`は`boolean`で受ける**（`InputTracker`の非公開メソッド`#isLeftDragState()`が唯一の定義。`CursorShapeRules`側で`state`から導出すると同じ規則の二重定義になるため行わない）。
* **判定（今の`#resolveCursor`の1512〜1562行と1対1。判定の順序・結果の文字列を変えない）**：
    1. (0a) `isPanning` → `'grabbing'`
    2. (0b) `isSpacePressed && !isLeftDragState` → `'grab'`
    3. (1) `mode === OperationMode.CREATE` → `'crosshair'`
    4. (2) `mode === OperationMode.PAN` → `'grab'`
    5. (3) `mode !== OperationMode.SELECT` → `'default'`
    6. (3a) `isPickingShape()` → `'cell'`
    7. (4) `state === InputState.DRAGGING_HANDLE || state === InputState.MOVING_SELECTION` → `'move'`
    8. (5) `state === InputState.MARQUEE_SELECTING` → `'default'`
    9. (6) `hit === null` → `'default'`
    10. (7) `hit.handle` → `'move'`
    11. (8) `hit.bodyId && isSelected(hit.bodyId)` → `'move'`
    12. (9) `hit.bodyId` → `'pointer'`
    13. (10) → `'default'`
* **`InputTracker`側**：
    * `#resolveCursor(hit)`を**削除**し、そのJSDocの判定表（(0a)〜(10)）は`CursorShapeRules.js`へ移す。
    * `#updateCursor(hit = null)`は、上の表の値を`resolveCursorShape`へ渡し、結果を`this.canvas.style.cursor`へ入れるだけにする（**DOMに触るのは`InputTracker`側のまま**）。
    * `#updateCursor`を呼ぶ場面・回数・引数（座標が不明なときの`null`）を変えない（現状の呼び出しは12か所。521・557・708・**820**・1016・1056・1125・1161・1348・1385・1394・1417行。このうち**引数に`hit`を渡すのは820行の`this.#updateCursor(hit)`の1か所だけ**で、残る11か所は引数なし＝既定値の`null`。`#resolveCursor`削除後もこの12か所・引数の与え方は同じ）。
    * 区切りコメント`// ---- カーソル形状 ----`はそのまま残す（`#updateCursor`が残るため）。
* **自動テスト**：`test/core/CursorShapeRules.test.js`を新規に足す。(0a)〜(10)の各分岐と優先順位を確かめる：
    * 各分岐が単独で成立するときの結果（13通り）
    * 優先順位：パン中が最優先（図形作成モード・待ち受け中・ドラッグ中でも`'grabbing'`）
    * スペース押下中は左ドラッグ状態（`DRAGGING_HANDLE`・`MOVING_SELECTION`・`MARQUEE_SELECTING`）では効かない（`'move'`・`'default'`になる）
    * 待ち受け中の`'cell'`は、パン中・スペース押下中・図形作成モード・キャンバス移動モードより後（それらが先に成立する）
    * 当たり分類が`null`のとき`'default'`（左ドラッグ状態・待ち受け中は先に成立する）
    * 選択集合内の本体は`'move'`、選択集合外の本体は`'pointer'`、空白は`'default'`
    * ハンドルが本体より優先されること
    * `isPickingShape`・`isSelected`が呼ばれない分岐では呼ばれないこと（短絡評価の保持）、引数を書き換えないこと

---

### 要件4: `main.js`の表示配線 → `js/wiring/DisplayWiring.js`（新規フォルダ・新規ファイル）

* **新しいフォルダ`js/wiring/`**を作り、`js/wiring/DisplayWiring.js`（クラス`DisplayWiring`）を置く。`main.js`から切り出した配線の置き場所である。
* **`core/`・`palette/`・`edit/`・`io/`のいずれにも入れない理由**：
    * `core/`：DOMの要素・idを持つため入れられない（`core/`へDOMのid・クラス名を持ち込まない約束）。
    * `palette/`：`palette/`は他フォルダをimportしない自己完結したUI部品の置き場所であり、`core/`・`edit/`をimportする配線は性質が違う。
    * `edit/`・`io/`：図形の編集・入出力の責務ではない。
    * → **依存方向**：`main.js → wiring → palette / edit / core`（`wiring/`は`main.js`からのみ使われ、`js/`の他のフォルダは`wiring/`をimportしない）。開発資料の1章（フォルダ構造・フォルダ分割の方針・依存方向）に`js/wiring/`の行を足す（タスク12）。
* **切り出す対象**（`js/main.js`の現状の行番号）：
    * 配線ブロック`// 6.5. 表示配線`の中身（355〜468行）：
        * `ShapeExtentReader`の生成（357行）と`#cursor-readout`・`#selection-size-readout`・`#grid-size-readout`の要素の取得
        * 同期関数3つ（`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`）とその購読の登録5つ（392〜396行）
        * 表示の切り替えのまとまり（`ViewToggleGroup`。`▢◐▦`）の生成・注入・`syncViewToggleGroup`・`displayState.onChange`への登録
        * スナップのまとまり（`UnitSnapGroup`。`🧲`・単位のボタン）の生成・注入・`syncUnitSnapGroup`・`unitSnapSettings.onChange`への登録
        * フロートウィンドウを隠す・出すボタン（`🧰`＝`#float-windows-toggle`）の`click`、`syncFloatWindowVisibility`（`body`のクラス`float-windows-hidden`と押し込み）・`displayState.onChange`への登録
        * `fitViewToShapes`と全体を画面に収めるボタン（`⛶`＝`#view-fit`）の`click`
    * 起動時の同期の呼び出し（969〜985行）：`syncCursorReadout()`・`syncSelectionSizeReadout()`・`syncGridSizeReadout()`・`syncViewToggleGroup()`・`syncUnitSnapGroup()`・`syncFloatWindowVisibility()`の6行とそのコメント。
    * ※この6つの関数・`shapeExtentReader`・`viewToggleGroup`・`unitSnapGroup`・3つの要素・`floatWindowsToggleBtn`・`fitViewToShapes`が`main.js`の他の場所から使われていないことを全文検索で確認済み（使用箇所は`// 6.5.`の中と起動時の同期の6行のみ）。`ShapeExtentReader`も`// 6.5.`以外では使われていない。
* **設計**：
    * コンストラクタ：`new DisplayWiring({ model, viewTransform, displayState, unitSnapSettings, cursorTracker, canvas })`（1つのオブジェクトで注入する。`main.js`の他のクラスの注入と同じ形）。コンストラクタの中で、依存の保持 → `ShapeExtentReader`の生成 → DOMの要素の取得（`document.getElementById`・`document.body`） → `ViewToggleGroup`・`UnitSnapGroup`の生成と注入 → 購読の登録・`click`の登録を、**今の`// 6.5.`と同じ順序**で行う。
    * 同期関数は非公開メソッド（`#syncCursorReadout`・`#syncSelectionSizeReadout`・`#syncGridSizeReadout`・`#syncViewToggleGroup`・`#syncUnitSnapGroup`・`#syncFloatWindowVisibility`）と非公開メソッド`#fitViewToShapes`にする。JSDocは`main.js`のものを移し、主語（「ここ」→本クラス）と参照先だけを直す。
    * **購読の登録（`onChange`・`addEventListener`）は切り出し先が行う。登録する関数・登録先・登録の数・登録の順序を変えない**：
        1. `cursorTracker.onChange(() => this.#syncCursorReadout())`
        2. `viewTransform.onChange(() => this.#syncCursorReadout())`
        3. `unitSnapSettings.onChange(() => this.#syncCursorReadout())`
        4. `model.onChange(() => this.#syncSelectionSizeReadout())`
        5. `viewTransform.onChange(() => this.#syncGridSizeReadout())`
        6. `displayState.onChange(() => this.#syncViewToggleGroup())`（`ViewToggleGroup`の生成の後）
        7. `unitSnapSettings.onChange(() => this.#syncUnitSnapGroup())`（`UnitSnapGroup`の生成の後）
        8. `#float-windows-toggle`の`click` → `displayState.toggleFloatWindows()`
        9. `displayState.onChange(() => this.#syncFloatWindowVisibility())`
        10. `#view-fit`の`click` → `#fitViewToShapes()`
        * ※同じ通知元に対する登録の順＝通知の呼ばれる順であるため、この並びを変えない。`main.js`での`DisplayWiring`の生成位置も、`// 6.`の後・`// 7.`の前（今の`// 6.5.`の位置）から動かさない（`model.onChange`・`viewTransform.onChange`・`displayState.onChange`には`// 6.5.`より前と後の両方で登録があるため）。
    * **公開メソッド`syncAll()`**：起動時の同期を`main.js`から1回で行う手段。`#syncCursorReadout()` → `#syncSelectionSizeReadout()` → `#syncGridSizeReadout()` → `#syncViewToggleGroup()` → `#syncUnitSnapGroup()` → `#syncFloatWindowVisibility()`を**今と同じ順序で**呼ぶ。公開するのはコンストラクタと`syncAll()`のみ。
    * import：`palette/ViewToggleGroup.js`・`palette/UnitSnapGroup.js`・`edit/ShapeExtentReader.js`・`core/StatusReadoutRules.js`（`formatCursorReadout`・`formatSizeReadout`・`formatGridReadout`）・`core/GridSpacingRules.js`（`computeGridSpacing`）・`core/ViewFitRules.js`（`computeFitView`）・`core/UnitSnapRules.js`（`resolveUnitSnapStep`・`roundPointToUnit`）・`core/ViewTransform.js`（`MIN_SCALE`・`MAX_SCALE`の参照のみ。今の`main.js`と同じ）。**これらのモジュールは変更しない。**
    * **`index.html`のid・クラス名・CSSは変えない。**
* **`main.js`側**：
    * `// 6.5. 表示配線`のブロックを、コメント＋`const displayWiring = new DisplayWiring({ … });`の数行に置き換える（コメントには、配線の実体が`wiring/DisplayWiring`にあること・登録順のためブロックの位置を動かさないことを書く）。**判定・計算を残さない。**
    * 起動時の同期の6行を`displayWiring.syncAll();`の1行＋コメントに置き換える。**位置は今の6行の位置（倍率表示の同期`syncZoomDisplay()`の後、削除ボタンの状態の同期`syncDeleteButtonState()`の前）**に置く。
    * 使われなくなるimportを消す：`ShapeExtentReader`・`formatCursorReadout`/`formatSizeReadout`/`formatGridReadout`・`computeGridSpacing`・`computeFitView`・`resolveUnitSnapStep`/`roundPointToUnit`・`ViewToggleGroup`・`UnitSnapGroup`（7行）。`ViewTransform`は`new ViewTransform()`で使い続けるため残す（`MIN_SCALE`・`MAX_SCALE`の参照だけが移る）。`DisplayWiring`のimportを足す。
    * `main.js`の先頭の責務定義は「各モジュールの初期化と連携(依存性の注入)」のままでよい。配線ブロックの一覧の記述に変更があれば実態に合わせる。
* **自動テスト**：DOMと購読の配線のため**足さない**。開発資料の「テストできない箇所」の一覧に1行足す（タスク12）。

---

### 要件5: 行数と責務定義の整合

* `js/core/InputTracker.js`の**先頭の責務定義（JSDoc。1〜5行と250〜290行のクラスのJSDoc）**から、外へ出した分の記述を削り、「規則は切り出し先の関数へ渡すだけで本クラスは持たない」という既存の書き方（`SelectionRules`・`MoveDirectionRules`・`UnitSnapRules`について書かれている形）にそろえる：
    * 入力状態・操作モードの値の列挙（`IDLE / DRAWING / …`・`'select'/'create'/'pan'`）は「値の定義は`InputModes.js`」と参照に替える（状態として保持すること自体は残す）。
    * フォーカスしている要素の判定（`isTextInputElement`・`isSpaceYieldedElement`）は`FocusKeyYieldRules`の関数を呼ぶだけ、と書く。
    * 押下時に何を始めるかの分岐は`PressActionRules`へ渡すだけ、カーソルの形の判定は`CursorShapeRules`へ渡すだけ（DOMへの適用は本クラス）、と書く。
    * メソッドの区切りコメントの一覧（「公開API（モード・図形種別）」〜「カーソル形状」）は、8つの区切りコメントがすべて残るため実態と一致する（タスク9で再確認する）。
* 新しく作るすべてのファイルの最先頭に、**3行以内**の責務定義のJSDocを書く（ルール3章）。新規のテストファイルも先頭に責務定義のJSDoc（3行以内）を書く（`_doc/arch/16_test.md`の決まり）。
* **作業後の見込みの行数**（開発資料へ実測値を反映するため、タスク12で実測して記録する）：
    | ファイル | 現状 | 見込み |
    | --- | --- | --- |
    | `js/core/InputTracker.js` | 1571行 | 約1380〜1420行（移すのは定数・判定で約106行、押下の分岐表で約12行、カーソルの判定表で約62行、先頭の責務定義の整合で約8行。importの追加で+4行） |
    | `js/main.js` | 1018行 | 約880〜900行（`// 6.5.`で約110行、起動時の同期で約14行、importの差し引きで約6行） |
    | `js/core/InputModes.js` | － | 約45行（新規） |
    | `js/core/FocusKeyYieldRules.js` | － | 約85行（新規） |
    | `js/core/PressActionRules.js` | － | 約60行（新規） |
    | `js/core/CursorShapeRules.js` | － | 約110行（新規） |
    | `js/wiring/DisplayWiring.js` | － | 約190〜210行（新規） |
* **修飾キー（`Ctrl`／`⌘`）の用途は増やさない。`hasCtrlModifier`を呼ぶ場所・回数を変えない。**

---

### 要件6: ふるまいを変えないことの確認（テストプレイの確認項目）

タスク11で発注者へ提示する一覧（項目を減らさない）。先頭に強制再読み込みを必ず入れる。

0. **強制再読み込み（`Ctrl`+`F5`）を行う**（古いJSが読まれて「動かない」ように見える事故を避けるため）。
1. **起動時**：キャンバスが読み込まれ、図形が出る。表示倍率`100%`、ステータスバーの座標が`—`、グリッド1マスの表示、スナップのまとまり（`🧲`が押し込み・単位が`1px`）、表示の切り替えのまとまり（`▢◐▦`）の押し込み、ツールパレットの選択のボタンの押し込み、取り消し／やり直し／削除／結合／重なり順のボタンの押せる・押せないが、いずれも今までと同じ。
2. **選択**：図形のクリックで選べる。空白のクリックで解除。`Ctrl`+クリックで追加・解除。空白からのドラッグで範囲選択。`Ctrl`+範囲選択で追加・解除。`Ctrl`+`A`で全選択、`Ctrl`+`I`で選択の反転、`Esc`で解除。塗った図形の内側のクリックで選べ、重なりでは手前が選ばれる。
3. **移動**：選択中の図形の本体のドラッグで動く。`Shift`+ドラッグで横・縦・斜め45°に限定される。`Alt`+ドラッグで複製してから動く。選択集合の外の図形は「押してそのまま」では動かない。
4. **ハンドル**：選択中の図形のハンドルのドラッグで頂点・半径が変わる。円・弧の中心のハンドル（`move`）のドラッグでは選択集合全体が平行移動する。ハンドルの上のクリックで選択が変わらない。ハンドルの上の`Ctrl`+クリックで何も起きない。
5. **カーソルの形**：空白＝矢印、図形の上＝指、選択中の図形の本体・ハンドルの上＝移動、図形作成モード＝十字、キャンバス移動モード／`Space`押下中＝手、パン中＝握った手、スポイトの待ち受け中＝セル。ドラッグ中・範囲選択中の形も今までと同じ。
6. **図形の作成**：5種（直線・曲線・矩形・円・弧）が、クリック→移動→クリックで作れる。作成中の`Esc`で破棄。キー`1`〜`5`・`P`で図形種別が切り替わる。
7. **スナップ**：`🧲`のON/OFFと単位（`1px`／グリッド`10px`）の切り替えが効く。ONのとき、点を打つ位置・図形と頂点の移動量が単位の倍数になる。ステータスバーの座標が丸めた値になる。`Ctrl`を押している間はスナップも端点への吸い付きも働かない。
8. **端点への吸い付き**：直線の端点の近くで描き始める・描き終えると描き足し・結合・閉じるになり、吸い付きの印が出る。端点のハンドルのドラッグでの結合も同じ。
9. **パン・ズーム**：中ボタンドラッグ、`Space`+左ドラッグ、キャンバス移動モード（`H`）の左ドラッグでパンできる。ホイールでズーム。`Ctrl`+`+`／`-`／`0`。定規の目盛り・数字・カーソル位置の印が追従する。
10. **表示の切り替え**：`▢`（アウトライン）・`◐`（背景の白/黒）・`▦`（グリッド）がボタンとキー（`Z`・`X`・`C`）の両方で切り替わり、**ボタンの押し込みがキーでの切り替えにも追従する**。`🧰`とキー`Tab`でフロートウィンドウがまとめて隠れる・出る（押し込みも追従）。`⛶`で全図形が画面に収まる（図形0個のときは表示のリセットと同じ）。
11. **ステータスバーの表示**：カーソルを動かすと座標が変わる。図形を選ぶと大きさが出て、ドラッグの途中も追従する。選択を解除すると大きさが消える。ズームするとグリッド1マスの値が変わる。1280px幅で右端の項目が切れていない。
12. **スタイル**：オプションバーの線・塗り・太さが選択中の図形に効く。何も選んでいないときは次に描く図形に効く。`D`で色が既定に戻る。`I`または`💉`でスポイトの待ち受けになり、図形のクリックでスタイルを取り込む。
13. **重なり順**：`Home`・`PageUp`・`PageDown`・`End`とオプションバーの4ボタンで並びが変わり、押せる・押せないが追従する。
14. **削除・結合・クリップボード**：`Delete`／`Backspace`と削除ボタン。`J`と結合ボタン。`Ctrl`+`C`／`X`／`V`／`Shift`+`V`／`D`。
15. **取り消し・やり直し**：`Ctrl`+`Z`／`Ctrl`+`Shift`+`Z`／`Ctrl`+`Y`とボタンで、上の各操作が1件ずつ戻る・やり直せる。
16. **キャンバスパレット・ファイル操作**：キャンバスの新規作成・切り替え・名前の変更・削除、ファイルを開く・保存、スプライトの書き出しが今までと同じ。切り替えの直後に表示倍率`100%`・選択モード・履歴が空になる。
17. **入力欄との競合**：オプションバーの色の欄にフォーカスがあるとき、`Space`が欄の操作になりパンしない。`Tab`でフォーカスが移る（フロートウィンドウは隠れない）。ボタンにフォーカスがあるときの`Tab`はフロートウィンドウの隠す・出すになる。`🧲`・単位のボタンにフォーカスがあるときの`Space`はパンする。
18. **`?dev`**：URLに`?dev`を付けて開くと開発者向けウィンドウが出て、保存・復元が今までと同じに動く。

---

### 今回やらないこと（スコープの境界）

* **頂点の選択ツール・矢印キーでの微調整・位置の数値入力・整列と分布**は作らない（後続のサブフェイズ）。操作モード・ツール・ボタン・キー・入力欄を足さない。
* **入力の状態の持ち主を分けない。** 選択モードのジェスチャー解釈をクラスごと別ファイルへ移すこと、`InputState`・パンのフラグ・ドラッグの作業用フィールドの持ち主を変えることは行わない。要件2・要件3は**判定だけ**を出し、状態は`InputTracker`が持ったままにする。
* **カーソルの形を変えない**（ツールごとに形を変えることは行わない。発注者の決定、2026-11-16）。
* **アイコン（`🖊🪣⏫🔼🔽⏬🧰▢◐▦⛶💉🧲`）を差し替えない。**
* **拡大縮小・回転・反転・外枠のハンドル・大きさと角度の数値入力**は作らない（後続のPhase）。
* **端点への吸い付きの対象を広げない**（`js/shapes/EndpointSnapRules.js`・`js/edit/EndpointSnapper.js`は変更しない）。
* **`hitTestHandle`の優先順位**は変えない。**書き出しの際の座標の丸めは行わない。**
* **`main.js`のほかの配線ブロック**（`// 3.5.`・`// 4.`・`// 6.`・`// 7.`・`// 7.5.`・`// 7.6.`・`// 7.7.`・`// 7.8.`・`// 8.`・`// 9.`）は切り出さない。
* **性能の改善を目的とした変更を行わない**（同期の回数・再描画の回数を今のままにする。無条件の`notifyChange()`・`model.onChange`ごとの同期はそのまま）。
* 変更しないファイル：`js/shapes/`配下・`js/io/`配下・`js/core/VectorModel.js`・`CanvasManager.js`・`HistoryManager.js`・`DragTracker.js`・`ViewTransform.js`・`UnitSnapRules.js`・`UnitSnapSettings.js`・`DisplayState.js`・`StatusReadoutRules.js`・`GridSpacingRules.js`・`ViewFitRules.js`・`SelectionRules.js`・`MoveDirectionRules.js`・`PointHitRules.js`・`CanvasCursorTracker.js`・`ShapeFactory.js`・`js/palette/`配下・`js/edit/`配下・`index.html`。

### 関連フォルダと論理クラス

* **対象フォルダ**：
    * `./js/core/` － 横断的な処理と、状態を持たない規則の関数・値の定義
    * `./js/wiring/` － **新設**。`main.js`から切り出した配線（DOMの取得・購読の登録・表示の同期）の置き場所
    * `./js/` － `main.js`（エントリポイント）
    * `./test/core/` － 新しい規則の関数の自動テスト
* **関連する論理クラス・モジュール**：
    * 新規：`InputModes`（値の定義）、`FocusKeyYieldRules`（フォーカスしている要素の判定）、`PressActionRules`（押下で始める操作の規則）、`CursorShapeRules`（カーソルの形の規則）、`DisplayWiring`（表示配線）
    * 変更：`InputTracker`、`KeyboardShortcuts`、`AltKeyGuard`、`ToolRules`、`main.js`、`test/core/ToolRules.test.js`
    * importされる側として使う（変更しない）：`PointHitRules`、`SelectionRules`、`MoveDirectionRules`、`UnitSnapRules`、`UnitSnapSettings`、`DisplayState`、`StatusReadoutRules`、`GridSpacingRules`、`ViewFitRules`、`ViewTransform`、`CanvasCursorTracker`、`ShapeFactory`、`palette/ViewToggleGroup`、`palette/UnitSnapGroup`、`edit/ShapeExtentReader`

### 参照する責務

以後のタスク実行チャットは、この項目のみを責務情報源とする（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`からの抜粋）。

**フォルダ分割の方針・依存方向（1章）**
* `core/`：横断的な処理（入力→状態→描画の複数層にまたがるもの）と、その処理だけが使う状態を持たない規則の関数（`PointHitRules`。`InputTracker`から使う。DOM・状態に触れない形で`node --test`で確かめるために切り出したもので、`InputTracker`の再分離ではない）。加えて、`main.js`から使うUIの表示の規則（状態なし。`ToolRules`等）。
* `palette/`：自己完結するUI部品。いずれもDOM操作専任で、`VectorModel`・図形データ・選択状態に関与しない。他フォルダをimportしない。
* `edit/`：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。
* **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。循環importを作らない。
* `test/`：依存は`test/ → js/`の一方向。`index.html`・`js/`は`test/`を参照しない。

**`InputTracker.js`（`_doc/arch/06_InputTracker.md`）**
* ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知、カーソル形状のフィードバックを担う。各ハンドラの判定順はJSDocを正とする。
* **公開メソッド**：`setMode`・`setShapeType`・`getMode`・`getShapeType`・`isDragging`・`deleteSelection`・`cancelDraftOrClearSelection`・`selectAll`・`abortOngoingOperation`・`handleMouseMove`・`handleMouseDown`・`handleClick`・`handleKeyDown`・`handleKeyUp`・`handleWheel`・`getScreenCoordinate`・`getWorldCoordinate`（**本作業で変えない**）。
* **export（現状）**：`InputState`・`OperationMode`・`SHAPE_TYPES`（正本は`ShapeFactory.js`からの再export）・`WHEEL_ZOOM_STEP`・`isTextInputElement`・`isSpaceOperatedInputElement`・`hasCtrlModifier`。
* **スペースパンの入力欄の規則**：`#handleSpaceKeyDown`は`isTextInputElement`または`isSpaceYieldedElement`が真なら何もしない（パンしない・`preventDefault()`しない・押下状態にしない）。`handleKeyUp`は両方偽のときだけ`preventDefault()`する。押下状態の解除・カーソルの再評価は常に行う。`isSpaceYieldedElement`は`isSpaceOperatedInputElement`または`isToggleButtonElement`（`aria-pressed`属性を持つ`button`）。`Ctrl`なしのショートカット側の規則は`KeyboardShortcuts`が持つ（ON/OFFのボタンにフォーカスがあってもショートカットは働く）。これらは`HTMLInputElement`・`HTMLButtonElement`に依存し`node --test`で確かめられない。
* **知らないこと**：図形種別（if/switch分岐を一切行わない）、スナップの設定、`HistoryManager.js`、ショートカットの解釈、`main.js`の関数、スポイト・スタイルという言葉。
* **状態**：入力状態`InputState`、操作モード、図形種別を独立に保持する。パン状態は`InputState`と直交する別フラグ。
* **当たり分類**：規則の正本は`core/PointHitRules.classifyPointHit`で、`#classifyPoint`は受け渡しのみ。1つの分類処理の結果をホバー・押下・クリック・カーソルの4箇所で共用する。
* **修飾キー**：`hasCtrlModifier(event)`（`event.ctrlKey || event.metaKey`）が`Ctrl`（`⌘`を含む）の読み取りの唯一の定義。`main.js`が`CanvasCursorTracker`へ注入する。`Alt`＝押した時点（`handleMouseDown`の`event.altKey`。`#beginMoveSelection`の1か所）。`handleMouseDown`の押下時の分岐の表は`Ctrl`で変えない。ホバー・カーソルも`Ctrl`で変えない。
* **選択の規則の呼び出し**：`handleClick`は`SelectionRules.resolveClickSelection(…)`、`#commitMarquee`は`resolveMarqueeSelection(…)`へ渡し、結果を`#applySelectionChange(change)`が`model.setSelection`/`clearSelection`へ受け渡すだけ（判定を持たない）。`InputTracker`は`SelectionRules`・`MoveDirectionRules`をimportする（`core/`内）。
* **`Alt`+ドラッグ**：`handleMouseDown`の`MOVING_SELECTION`の2か所（moveハンドル・選択中の図形の本体）は`#beginMoveSelection(event, point)`を呼ぶ（`#beginLeftDrag`は開始できたかの`boolean`を返し、真のときだけ押した時点の`event.altKey`を記憶する。頂点のハンドル・範囲選択では立てない）。
* **スポイトの待ち受け中**：`handleMouseDown`は選択モード・IDLEの分岐の先頭（`#classifyPoint`の前）で`isPickingShape()`なら何も始めず`return`。`#resolveCursor`は「(3)選択モード以外 → `'default'`」の後、「(4)`DRAGGING_HANDLE`・`MOVING_SELECTION`」の前に「待ち受け中 → `'cell'`」。コンストラクタが`#updateCursor()`で`isPickingShape()`を呼ぶため、注入する`styleEyedropper`は`inputTracker`より先に生成する必要がある。
* **行数**：1571行。

**`main.js`（`_doc/arch/02_main.md`）**
* アプリケーションのエントリポイント。インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶモジュール間の連携を担う。
* **持たないもの**：判定ロジック・作業データの中身の解釈。持たせる必要が生じたら別モジュールへ分離する。
* **行数**：1018行。`// 6.5.`（表示配線）は`applyMode`・`inputTracker`への依存を伴わず（使うのは`displayState`・`viewTransform`・`shapeExtentReader`・`cursorTracker`・`unitSnapSettings`・`model.onChange`・`canvas`）独立しており、**次に切り出すなら第一の候補**。
* **配線ブロック`// 6.5.`**：表示配線（`// 6.`の後・`// 7.`の前。`ShapeExtentReader`の生成、ステータスバーの座標・大きさ・グリッドの表示の同期と登録、`ViewToggleGroup`の生成と`syncViewToggleGroup`・登録、`UnitSnapGroup`の生成と`syncUnitSnapGroup`・登録、`syncCursorReadout`は`unitSnapSettings.onChange`にも登録、🧰と`syncFloatWindowVisibility`・登録、⛶と`fitViewToShapes`）。
* **注入の一覧（本作業に関わる分）**：`ShapeExtentReader`←`model`／`ViewToggleGroup`←`#view-toggle-group`の要素・`onToggleOutline`/`onToggleBackground`/`onToggleGrid`→`displayState`の`toggleOutline`/`toggleBackground`/`toggleGrid`／`UnitSnapGroup`←`#unit-snap-group`の要素・`onToggleEnabled`/`onToggleUnit`→`unitSnapSettings`の`toggleEnabled`/`toggleUnit`（各メソッド呼び出しのみ）。
* **同一経路の原則**：表示の切り替え（▢◐▦・🧰と`Z`・`X`・`C`・`Tab`）は`displayState`の`toggleOutline`・`toggleBackground`・`toggleGrid`・`toggleFloatWindows`を呼ぶのみ（ボタンの表示は操作の中ではなく`displayState.onChange`で同期する）。全体を画面に収めるボタン⛶は`fitViewToShapes()`を呼ぶ（キーなし）。キャンバス要素の大きさを使う計算は`resetViewToCenter`・`zoomAtCanvasCenter`・`fitViewToShapes`に集める。
* **スナップの配線**：ボタンのコールバックは`unitSnapSettings`の`toggleEnabled`・`toggleUnit`を呼ぶのみ。表示は通知で同期する（`unitSnapSettings.onChange` → `syncUnitSnapGroup`・`syncCursorReadout`の2つだけ。キャンバスは再描画しない）。`syncCursorReadout`は`resolveUnitSnapStep(unitSnapSettings.getActiveStep(), cursorTracker.isCtrlPressed())`の刻みで`roundPointToUnit`した値を`formatCursorReadout`へ渡す（丸めるかの判定は規則の関数が持ち、`world === null`の分岐は「位置なし」の受け渡し）。
* **起動時の同期**：初回の描画・表示を`onChange`通知や`index.html`の初期記述に依存させないため、初期化の最後に`applyMode(OperationMode.SELECT)`と各表示の同期関数・パレットの`render`を明示的に1回ずつ呼ぶ（押し込み（`.active`）とスナップの単位のボタンの文字・`title`は`index.html`に書かないため、この明示的な1回が初期表示を決める）。その後に`canvasLibrary.start()`を`await`せずに呼ぶ。
* **生成順の制約**：`UnitSnapSettings`（`// 3.3.`）・`StyleEyedropper`・`EndpointSnapper`・`HistoryManager`は`InputTracker`より先に生成する。

**`ToolRules.js`（`_doc/arch/19_ToolRules.md`）**
* ツールの一覧と押し込みの表示にするツールを求める規則を、状態を持たない関数として提供する。**import**：`OperationMode`（現状`core/InputTracker`）・`SHAPE_TYPES`（`core/ShapeFactory`。正本）のみ。`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない（循環なし）。`InputTracker.js`はモジュールの最上位でDOMに触れないため`node --test`でimportできる。
* **使う側**：`main.js`のみ。**知らないこと**：DOM・`InputTracker`のインスタンス・ボタンのid・`VectorModel`・`StyleEyedropper`。

**`AltKeyGuard.js`（`_doc/arch/29_AltKeyGuard.md`）**
* `Alt`キーの単独押下・単独解放の抑止のみを担う。`event.key === 'Alt'`かつ`event.ctrlKey`が偽かつ`document.activeElement`が`isTextInputElement`でないときだけ`preventDefault()`する。**import**：`core/InputTracker`の`isTextInputElement`のみ（`core/`内）。モジュールの最上位でDOMに触れず、`document`の参照はコンストラクタの中だけ。テストなし。

**`KeyboardShortcuts.js`（現状のimportと使用箇所）**
* `import { OperationMode, SHAPE_TYPES, isTextInputElement, isSpaceOperatedInputElement } from './InputTracker.js';`。手順2でテキスト入力中（`isTextInputElement(document.activeElement)`）なら何もしない、手順4で`ctrl: false`のエントリは`isSpaceOperatedInputElement(document.activeElement)`なら受理しない。図形種別のエントリは`SHAPE_TYPES`の並びから生成する。

**`palette/ViewToggleGroup.js`・`palette/UnitSnapGroup.js`（`_doc/arch/13_palette.md`）**
* `palette/`は自己完結するUI部品。DOM操作専任で、`VectorModel`・図形データ・選択状態に関与しない。コンストラクタでまとまりのルート要素とコールバックを受け取り、`render(state)`で表示を同期する。`UnitSnapGroup`のON/OFFのボタンの押し込みは`.active`で表し、`aria-pressed`は付けない（フォーカス中の`Space`をパンにするため）。**本作業では変更しない。**

**`edit/ShapeExtentReader.js`（`_doc/arch/14_edit.md`）**
* 選択中の図形・全図形の外枠（書き出しの外枠`bounds`と同じ求め方）の照会。注入は`model`のみ。**本作業では変更しない。**

**`test/`（`_doc/arch/16_test.md`）**
* `node:test`・`node:assert/strict`のみで書き、プロジェクトのルートの`node --test`（引数なし）で実行する。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。先頭行に単一責務のJSDoc（3行以内）。補助関数にもJSDoc（`@param`・`@returns`）。対象は相対パスで`import`し、公開APIのみを通す。**テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。** `globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える。
* **件数（Phase 07-05完了時）**：tests 1261 / suites 191 / pass 1261 / fail 0。
* **テストできない箇所（既存。本作業に関わる分）**：`InputTracker.js`の`isSpaceOperatedInputElement`・`isToggleButtonElement`・`isSpaceYieldedElement`と`InputTracker`・`KeyboardShortcuts`の入力欄の規則（`HTMLInputElement`・`HTMLButtonElement`に依存）、`AltKeyGuard`、`ViewToggleGroup`・`UnitSnapGroup`（DOM）、`main.js`の配線（`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`・`syncViewToggleGroup`・`syncUnitSnapGroup`・`syncFloatWindowVisibility`・`fitViewToShapes`・起動時の同期）、`InputTracker`の修飾キーの読み取りと配線（`DragTracker`・DOMに依存）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定

資料本体の修正は**最終タスク（タスク12）でのみ**行う。個別の実装タスクでは資料を書き換えず、判明した影響をこの欄へ追記する。

* **`PROJECT_ARCHITECTURE.md` 1章（フォルダ構造）**：**足す分**と、本作業の切り出しで実態と食い違う**既存の記述を直す分**の両方がある（文面の確定はタスク12で行う。文言は最小限だけ直し、記述の構成と決定事項の内容は変えない）。
    * **足す分**：
        * `js/core/`に`InputModes.js`・`FocusKeyYieldRules.js`・`PressActionRules.js`・`CursorShapeRules.js`の4行を足す（1行コメント付き）。
        * **`js/wiring/`のまとまりを新設**し、`DisplayWiring.js`の行を足す（`main.js`から切り出した配線の置き場所）。
        * `test/core/`に`PressActionRules.test.js`・`CursorShapeRules.test.js`の2行を足す。
        * 「フォルダ分割の方針」に`wiring/`の項を足し、**依存方向**（167行）の記述へ`main.js → wiring → palette / edit / core`（`js/`の他のフォルダは`wiring/`をimportしない）を足す。
    * **直す分(a) フォルダ構造のツリーの1行コメントの「`main.js`から使う」**：要件4で呼び出し元が`wiring/DisplayWiring`へ移るため食い違う。該当は次の4行（全文確認済み）。
        * **32行 `UnitSnapRules.js`**：「`InputTracker`・`main.js`から使う」→ `main.js`での使用（`resolveUnitSnapStep`・`roundPointToUnit`。`syncCursorReadout`の1か所だけ）が移るため、`InputTracker`・`wiring/DisplayWiring`から使う形へ直す。
        * **37行 `GridSpacingRules.js`**：「`CanvasManager`・`RulerRenderer`・`main.js`から使う」→ `main.js`での使用（`computeGridSpacing`。`syncGridSizeReadout`の1か所だけ）が移るため、`CanvasManager`・`RulerRenderer`・`wiring/DisplayWiring`から使う形へ直す。
        * **41行 `ViewFitRules.js`**：「`main.js`から使う」→ `wiring/DisplayWiring`から使う（`computeFitView`は`#fitViewToShapes`へ移る）。
        * **42行 `StatusReadoutRules.js`**：「`main.js`から使う」→ `wiring/DisplayWiring`から使う（3関数とも移る）。
    * **直す分(b) 167行（**依存方向**の項）の中のimportの出どころ**（REQ:156の「importの出どころ」に当たる。1行の中に多数の記述が並ぶため、該当だけを拾って直す。167行の全文を確認して確定した該当は次の4つ）：
        * **`core/InputTracker`の`core/`内のimportの列**：「`core/InputTracker`は`core/PointHitRules`・`core/SelectionRules`・`core/MoveDirectionRules`をimportする（`core/`内。この3つは何もimportしない）」→ 本作業で`core/InputModes`・`core/FocusKeyYieldRules`・`core/PressActionRules`・`core/CursorShapeRules`のimportが増えるため列に足す。あわせて、`InputModes`・`FocusKeyYieldRules`・`PressActionRules`は何もimportせず、`CursorShapeRules`だけが`core/InputModes`をimportすること（要件2・要件3）を書く。
        * **`core/AltKeyGuard`のimport元**：「`core/AltKeyGuard`は`core/InputTracker`の`isTextInputElement`だけをimportする」→ `core/FocusKeyYieldRules`の`isTextInputElement`だけをimportする形へ直す（要件1(c)）。同じ括弧の「`InputTracker`は`AltKeyGuard`をimportしない」は実態のままなので**直さない**。
        * **`core/ToolRules`のimport元**：「`core/ToolRules`は`core/InputTracker`の`OperationMode`と`core/ShapeFactory`の`SHAPE_TYPES`をimportする」→ `OperationMode`の出どころを`core/InputModes`へ直す（要件1(a)。`SHAPE_TYPES`が`core/ShapeFactory`からである記述は変えない）。これにより`ToolRules`は`InputTracker`をimportしなくなる（同じ括弧の「`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない」「`ToolRules`をimportするのは`main.js`とテストだけ」は実態のままで**直さない**）。
        * **`main.js`のimportの列**：「`main.js`は`core/UnitSnapSettings`・`core/UnitSnapRules`（`resolveUnitSnapStep`・`roundPointToUnit`）・`palette/UnitSnapGroup`・`core/InputTracker`の`hasCtrlModifier`をimportする」→ `core/UnitSnapRules`の2関数と`palette/UnitSnapGroup`は`wiring/DisplayWiring`のimportへ移るため、`main.js`の列から外して`DisplayWiring`側の記述に書く（要件4）。`core/UnitSnapSettings`（生成と`getUnitSnapStep`の注入）と`core/InputTracker`の`hasCtrlModifier`（`CanvasCursorTracker`への注入）は`main.js`に残るため**直さない**。
    * **直す分(c) 「フォルダ分割の方針」の`core/`の項（161行）の中の帰属の記述**：
        * `ToolRules`を置く理由の「規則は操作モード（`InputTracker`の`OperationMode`）と図形種別（`ShapeFactory`の`SHAPE_TYPES`）の知識を要し」→ `OperationMode`の置き場所を`InputModes`へ直す（要件1(a)。`SHAPE_TYPES`の側は変えない）。
        * `GridSpacingRules`の「`CanvasManager`・`RulerRenderer`・`main.js`が使う」・`ViewFitRules`／`StatusReadoutRules`の「この2つは`main.js`だけが使い、`ToolRules`と同じ位置づけ」・`UnitSnapRules`の「`main.js`（ステータスバーの座標の表示）」→ 使う側を`wiring/DisplayWiring`へ直す（要件4）。**位置づけの判断の理由は変えない**（`main.js`側の配線から使う表示の規則、という位置づけのまま）。
    * ※1章で**直さない**記述（切り出し後も実態と一致するもの）の線引き：
        * ツリーの`PointHitRules.js`・`MoveDirectionRules.js`の「`InputTracker`から使う」（`PressActionRules`・`CursorShapeRules`は`PointHit`をJSDocの型参照だけで使い`import`文を書かないため、使う側は変わらない）、`SelectionRules.js`の「`InputTracker`・`main.js`から使う」（`invertSelection`は`main.js`に残る）、`ToolRules.js`の「`main.js`から使う」、`UnitSnapSettings.js`・`AltKeyGuard.js`・`DisplayState.js`・`CanvasCursorTracker.js`の各コメント。
        * 167行の残りの記述：`core/InputTracker`は`core/UnitSnapRules`をimportする、`main.js`は`core/SelectionRules`の`invertSelection`をimportする、`core/UnitSnapSettings`・`core/UnitSnapRules`・`palette/UnitSnapGroup`は何もimportしない、`DisplayState`・`ViewFitRules`・`StatusReadoutRules`・`CanvasCursorTracker`・`palette/ViewToggleGroup`は何もimportしない、`core/InputTracker`は`edit/`をimportせず第7引数の補助（`getUnitSnapStep`等）を呼ぶだけ、`core/CanvasManager`・`core/RulerRenderer`・`edit/`・`shapes/`・`check/`の各記述（`hasCtrlModifier`のように`InputTracker.js`に残るexportを指す記述も直さない）。
        * 161行の残りの記述：`SelectionRules`・`CanvasCursorTracker`・`AltKeyGuard`・`UnitSnapSettings`の位置づけと、`UnitSnapSettings`を`DisplayState`へ足さなかった理由・用語の使い分けの記述。
* **`PROJECT_ARCHITECTURE.md` 3章（機能別の記述）**：本作業の切り出しで実態と食い違う**モジュール帰属の記述**を直す（3章＝276〜498行の全文検索で確定した該当箇所。文言は最小限だけ直し、記述の構成と決定事項の内容は変えない。文面の確定は最終タスク（タスク12）で行う）。
    * **(ア) 要件4の切り出しに伴う`main.js`帰属の記述** → `wiring/DisplayWiring`へ直す：
        * **15.「全体を画面に収める」（446行）**：「ステータスバーの⛶（`#view-fit`。キーなし）→ `main.js`の`fitViewToShapes()`」を`wiring/DisplayWiring`の`#fitViewToShapes()`（⛶の`click`の登録も`DisplayWiring`）へ直す。
        * **15.「パレットをまとめて隠す/出す」（445行）**：「クラス名は`index.html`のCSSと`main.js`の`syncFloatWindowVisibility`の2か所だけ」を`wiring/DisplayWiring`の`#syncFloatWindowVisibility`へ直す（🧰の`click`の登録も`DisplayWiring`）。同じ行の`PaletteLauncher`へ`isFloatWindowsVisible`・`showFloatWindows`を注入するのは`main.js`のままで**直さない**。
        * **17.「モジュールの分担」（475行）**：「座標の表示＝`CanvasCursorTracker`（`Ctrl`の記録）と`main.js`の`syncCursorReadout`」「配線＝`main.js`・`index.html`（判定・計算を持たない）」を、座標の表示とステータスバーの部品（`UnitSnapGroup`）の配線は`wiring/DisplayWiring`、残る配線（`UnitSnapSettings`の生成・`InputTracker`への`getUnitSnapStep`の注入・`index.html`）は`main.js`と書き分ける形へ直す。
        * **17.「座標の表示」（489行）**：`syncCursorReadout`の主語を`wiring/DisplayWiring`の`#syncCursorReadout`へ直す（刻みの求め方・表示の形式の記述は変えない）。
        * **17.「ステータスバーの部品」（488行）**：単位のボタンの文字・`title`を「どちらも起動時に`main.js`の同期が付ける」を、`wiring/DisplayWiring`の`syncAll()`（`#syncUnitSnapGroup`）が付ける形へ直す。
        * **15.「表示の状態の持ち主と通知」（439行）・17.「設定の持ち主と同期の経路」（486行）・15.と17.の見出しの経路（438・473行）**：`displayState.onChange`・`unitSnapSettings.onChange`の登録先と「起動時にも各同期関数を明示的に1回呼ぶ」の主語が`main.js`のままになっていないかを確認し、`DisplayWiring`へ移る分（`syncViewToggleGroup`・`syncFloatWindowVisibility`・`syncUnitSnapGroup`・`syncCursorReadout`の登録と起動時の1回）だけ直す。`DisplayState`・`UnitSnapSettings`の生成と`renderCurrentState`は`main.js`のままで**直さない**。
        * ※3章のほかの`main.js`帰属の記述（`renderCurrentState`・`renderRulers`・`selectShapeTool`・`performUndo`／`performRedo`・`performPaste`・`performJoin`・`performInvertSelection`・`startEyedropper`・`ensureSelectMode`・`applyMode`／`applyShapeType`・`shouldRestoreSelection`・`hasCtrlModifier`／`screenLengthToWorld`／`getScreenCoordinate`の注入等）は`main.js`に残るため**直さない**。
    * **(イ) 要件1(c)の切り出しに伴う`InputTracker.js`帰属の記述** → `core/FocusKeyYieldRules.js`へ直す：
        * **2.「キーボード操作」の「入力欄の規則」（295行）**：「判定は`InputTracker.js`の`isTextInputElement`・`isSpaceOperatedInputElement`（部品のidに結びつけず`type`全般に当てる）と、非公開のモジュール関数`isSpaceYieldedElement`（`isSpaceOperatedInputElement`＋`isToggleButtonElement`）。」を、**判定の置き場所が`core/FocusKeyYieldRules.js`になったこと**と、**`isSpaceYieldedElement`が`export`された関数になったこと**（移動に伴い非公開から公開へ。`InputTracker`が呼ぶため。関数の中身・判定の条件は変えていない）、`isToggleButtonElement`は移動先のモジュール内だけの非公開のままであること、が分かる形へ直す。
        * 同じ行の「`KeyboardShortcuts`の手順4は`isSpaceOperatedInputElement`のまま」は、import元だけが`FocusKeyYieldRules.js`へ変わる（判定は変えない）。入力欄の規則の**内容**（どの部品でどのキーが働くか。2026-11-13 発注者の決定）は変えない。
    * **(ウ) 要件1(a)（`InputState`・`OperationMode`の帰属）**：**該当なし**。3章には値の定義の置き場所を`InputTracker.js`と書いた記述がない（`IDLE`・`DRAWING`・`DRAGGING_HANDLE`・`MOVING_SELECTION`（294・397・407・478・479行等）はふるまいの説明の中の状態名、`OperationMode.SELECT`（351行等）は`applyMode(OperationMode.SELECT)`という`main.js`の呼び出しの記述で、いずれもimport元・定義箇所に触れていない）。直さない。
    * **(エ) 要件2（押下時の分岐の表の帰属）**：3章で分岐の表に触れるのは「押下時の分岐の表（`handleMouseDown`）は`Ctrl`で変えない」という**`Ctrl`の決定の記述**（290・463・484行）だけで、表の中身・置き場所は4章・`_doc/arch/06_InputTracker.md`にある。決定の**内容**は本作業で変わらないため内容は直さないが、表の正本が`core/PressActionRules.resolvePressAction`（`handleMouseDown`から呼ぶ）になったことが分かるよう、括弧の表記のみ最小限で見直すかをタスク12で判断する（見直さなくても記述は誤りにならない）。293行の`#beginMoveSelection`が`event.altKey`を記憶する記述・287行の当たり分類の記述は`InputTracker`に残るため直さない。
    * **(オ) 要件3（カーソルの形の判定表の帰属）**：**該当なし**。3章に`#resolveCursor`・判定表の記述はない（294行はスポイトの待ち受け中のカーソル`'cell'`と優先順位の**ふるまい**の説明、469行は`InputTracker`のコンストラクタが`#updateCursor()`を呼ぶ生成順の制約で、どちらも本作業後も実態と一致する）。直さない。
* **`PROJECT_ARCHITECTURE.md` 4章の一覧**：`InputModes.js`・`FocusKeyYieldRules.js`・`PressActionRules.js`・`CursorShapeRules.js`・`wiring/DisplayWiring.js`の行（モジュール→`_doc/arch/`のファイル）を足す。
* **`_doc/arch/`の新規ファイル**（4章の一覧の採番に続けて作る。1モジュール1ファイル）：`InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`・`DisplayWiring`の5つ（責務・公開・判定の表・import・使う側・置き場所の理由・テストの有無を書く）。
* **`_doc/arch/06_InputTracker.md`**：exportの一覧から`InputState`・`OperationMode`・`SHAPE_TYPES`・`isTextInputElement`・`isSpaceOperatedInputElement`を外し（残るのは`WHEEL_ZOOM_STEP`・`hasCtrlModifier`）、「`OperationMode`のimport元」の項を`InputModes.js`の記述へ置き換える。押下時の分岐の表は`PressActionRules`、カーソルの形の判定表は`CursorShapeRules`、入力欄の判定は`FocusKeyYieldRules`へ委ねる旨に書き換える（`#resolveCursor`が無くなり`#updateCursor`がDOMへの適用だけを担うこと、`isPickingShape`・`isSelected`を関数で渡して呼び出し回数を変えていないことを明記）。**行数**を実測値へ更新する。
* **`_doc/arch/02_main.md`**：**行数**を実測値へ更新し、配線ブロックの表の`// 6.5.`の行を「`wiring/DisplayWiring`の生成と注入のみ（登録順のため位置を動かさない）」へ書き換える。「主な関数」の一覧から`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`・`syncViewToggleGroup`・`syncUnitSnapGroup`・`syncFloatWindowVisibility`・`fitViewToShapes`を外す。「注入の一覧」の`ShapeExtentReader`・`ViewToggleGroup`・`UnitSnapGroup`の行を`DisplayWiring`が注入する旨へ移し、`DisplayWiring`の行（`model`・`viewTransform`・`displayState`・`unitSnapSettings`・`cursorTracker`・`canvas`）を足す。「起動時の同期」の記述を`displayWiring.syncAll()`へ直す。「スナップの配線」「同一経路の原則」の該当箇所の主語を`DisplayWiring`へ直す。
* **`_doc/arch/07_KeyboardShortcuts.md`**：importの出どころを`InputModes`（`OperationMode`）・`ShapeFactory`（`SHAPE_TYPES`。正本から直接）・`FocusKeyYieldRules`（`isTextInputElement`・`isSpaceOperatedInputElement`）へ直す。
* **`_doc/arch/29_AltKeyGuard.md`**：importの出どころを`FocusKeyYieldRules`の`isTextInputElement`へ直す。
* **`_doc/arch/19_ToolRules.md`**：importの出どころを`InputModes`（`OperationMode`）へ直し、「`InputTracker.js`はモジュールの最上位でDOMに触れないため`node --test`でimportできる」の注記を実態（`ToolRules`は`InputTracker.js`をimportしなくなった）に合わせて直す。
* **`_doc/arch/16_test.md`**：Phase 08-01の新設分（`test/core/PressActionRules.test.js`・`test/core/CursorShapeRules.test.js`の件数と検証範囲）を足し、**テストできない箇所（08-01の追加）**として次の2行を足す — ①`FocusKeyYieldRules`（`HTMLInputElement`・`HTMLButtonElement`・`HTMLElement`に依存し`node --test`で確かめられない。テストのためにソースを書き換えない）、②`wiring/DisplayWiring`（DOMの取得と購読の配線。`main.js`の配線として挙げていた同期関数の記述もここへ移す）。既存の「テストできない箇所」のうち`InputTracker.js`の`isSpaceOperatedInputElement`・`isToggleButtonElement`・`isSpaceYieldedElement`・`main.js`の`// 6.5.`の配線の記述は、移動先（`FocusKeyYieldRules`・`DisplayWiring`）を指すように直す。`ToolRules.test.js`が`InputTracker.js`を間接にimportする旨の記述（07-01の追加の末尾）も実態に合わせて直す。**件数**（`node --test`の`tests`/`suites`/`pass`/`fail`）を実測値へ更新する。
* **`_doc/arch/13_palette.md`・`14_edit.md`・`20_DisplayState.md`・`21_GridSpacingRules.md`・`24_CanvasCursorTracker.md`・`25_ViewFitRules.md`・`26_StatusReadoutRules.md`・`30_UnitSnapRules.md`・`31_UnitSnapSettings.md`**：「使う側」「注入」に`main.js`と書かれている箇所のうち、実際の呼び出し元が`wiring/DisplayWiring`へ移るもの（`ViewToggleGroup`・`UnitSnapGroup`・`ShapeExtentReader`・`syncGridSizeReadout`・`fitViewToShapes`・`StatusReadoutRules`の3関数・`UnitSnapRules`の2関数・`cursorTracker.onChange`・`displayState.onChange`の同期）を`wiring/DisplayWiring`へ直す（`main.js`が持つ配線はそのまま`main.js`と書く）。
* ※タスク実行中に上記以外の影響が判明した場合も、この欄へ追記する。

---

## 3. タスクリスト

*   [x] タスク1: 要件1(a) 操作モードと入力状態の定数を`js/core/InputModes.js`へ移す
    *   **対象ファイル** :
        *   `./js/core/InputModes.js` :（新規）
        *   `./js/core/InputTracker.js` :（更新）
        *   `./js/core/ToolRules.js` :（更新）
        *   `./js/core/KeyboardShortcuts.js` :（更新）
        *   `./js/main.js` :（更新）
        *   `./test/core/ToolRules.test.js` :（更新）
    *   **作業内容** :
        *   `InputModes.js`を新設し、先頭に3行以内の責務定義のJSDocを書く（import・DOM・判定を持たず、値の定義だけを持つ）。
        *   `InputTracker.js`の`InputState`（JSDoc込み）・`OperationMode`（JSDoc込み）を**そのまま移す**（値・凍結の有無・JSDocの中身を変えない。別ファイルになったメソッドへの参照だけ`InputTracker.setMode()`のように修飾する）。`PointHit`のtypedefは`InputTracker.js`に残す。
        *   `InputTracker.js`に`import { InputState, OperationMode } from './InputModes.js';`を足し、元の定義と`export`を消す（**再exportは残さない**）。
        *   `ToolRules.js`・`KeyboardShortcuts.js`・`main.js`・`test/core/ToolRules.test.js`の`OperationMode`のimport元を`InputModes.js`へ変える（`KeyboardShortcuts.js`・`main.js`は同じ`import`文の他の名前を今のまま残す）。
        *   `grep -rn "InputState\|OperationMode" --include=*.js .`で取り込み側の漏れがないことを確認する。
        *   `node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク1: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク2: 要件1(b) `SHAPE_TYPES`の再exportを消す
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
        *   `./js/core/KeyboardShortcuts.js` :（更新）
    *   **作業内容** :
        *   `InputTracker.js`の**53〜58行（再exportの理由を書いたJSDoc 5行（53〜57行）＋`export { SHAPE_TYPES };`の1行（58行）の計6行）を消す**（2章要件1(b)と同じ範囲。消すのはこの6行だけ）。`import { SHAPE_TYPES } from './ShapeFactory.js';`と`InputTracker`内の使用（`setShapeType`の受理判定・`currentShapeType`の初期値）は今のまま残す。
        *   `KeyboardShortcuts.js`の`SHAPE_TYPES`のimport元を`./ShapeFactory.js`（正本）へ変える（`import`文の分割に伴いJSDoc・コメントの記述は変えない）。
        *   `grep -rn "SHAPE_TYPES" --include=*.js .`で`InputTracker.js`から取っている箇所が無くなったことを確認する。
        *   `node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク2: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク3: 要件1(c) フォーカスしている要素の判定を`js/core/FocusKeyYieldRules.js`へ移す
    *   **対象ファイル** :
        *   `./js/core/FocusKeyYieldRules.js` :（新規）
        *   `./js/core/InputTracker.js` :（更新）
        *   `./js/core/KeyboardShortcuts.js` :（更新）
        *   `./js/core/AltKeyGuard.js` :（更新）
    *   **作業内容** :
        *   `FocusKeyYieldRules.js`を新設し、先頭に3行以内の責務定義のJSDoc（フォーカスしている要素が、キー（`Space`・ショートカット）をその部品に譲るべきものかの判定）を書く。
        *   `InputTracker.js`の`TEXT_INPUT_TYPES`・`isTextInputElement`・`SPACE_OPERATED_INPUT_TYPES`・`isSpaceOperatedInputElement`・`isToggleButtonElement`・`isSpaceYieldedElement`を、JSDoc込みで**そのまま移す**（関数の中身・判定の条件を変えない）。`isTextInputElement`・`isSpaceOperatedInputElement`・`isSpaceYieldedElement`を`export`し、`isToggleButtonElement`はexportしない。
        *   DOMの型を参照するのは関数の中だけとし、モジュールの最上位ではDOMに触れない（`document`も参照しない）。JSDocは参照先（`KeyboardShortcuts`・`InputTracker`）の書き方だけ移動先に合わせて直す。
        *   `InputTracker.js`に`import { isTextInputElement, isSpaceYieldedElement } from './FocusKeyYieldRules.js';`を足し、元の定義・`export`を消す（**再exportは残さない**）。`KeyboardShortcuts.js`・`AltKeyGuard.js`のimport元を`FocusKeyYieldRules.js`へ変える。
        *   `grep -rn "isTextInputElement\|isSpaceOperatedInputElement\|isSpaceYieldedElement\|isToggleButtonElement\|TEXT_INPUT_TYPES\|SPACE_OPERATED_INPUT_TYPES" --include=*.js .`で漏れと残置がないことを確認する。
        *   自動テストは足さない（開発資料の「テストできない箇所」への追記はタスク12）。`node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク3: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク4: 要件2 押下で始める操作の規則を`js/core/PressActionRules.js`へ切り出す
    *   **対象ファイル** :
        *   `./js/core/PressActionRules.js` :（新規）
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `PressActionRules.js`を新設し、先頭に3行以内の責務定義のJSDocを書く（状態なし・importなし・DOMなし・引数を書き換えない）。
        *   typedef`PressAction`（`{type:'moveSelection'}`／`{type:'dragHandle', target}`／`{type:'marquee'}`／`null`）と`resolvePressAction(hit, isSelected)`を書く。判定は2章要件2の1〜5のとおり（今の`handleMouseDown`の881〜897行と1対1。`hit.bodyId === null`の書き方も変えない）。ハンドル名`'move'`はこのファイルのモジュール内の定数として持つ（exportしない）。`PointHit`の型の参照はJSDocのみ（`import`文を書かない）。
        *   JSDocに各引数・戻り値・判定の表と、`isSelected`を呼ぶのは本体の判定のときだけであることを書く。
        *   `InputTracker.js`：`handleMouseDown`の末尾の分岐（881〜897行）を`resolvePressAction`の呼び出しと振り分け（`#beginMoveSelection(event, point)`／`#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, action.target)`／`#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point)`／何もしない）に置き換える。手順(1)〜(5a)は変えない。`'move'`との**比較**（882行の`hit.handle.handle === 'move'`の1か所）を`PressActionRules.js`へ移し、`InputTracker.js`に比較を残さない。**482行の`#dragHandleName`のJSDocの`'move'`の説明文は消さない・書き換えない。**`#resolveCursor`のJSDoc・戻り値の`'move'`はタスク6（要件3）の範囲で触らない。
        *   `handleMouseDown`のJSDocの手順(6)の分岐表を`PressActionRules.js`へ移し、`handleMouseDown`側は規則へ渡して振り分けるだけの記述に直す（`#beginMoveSelection`経由で`event.altKey`を記憶する注記は残す）。
        *   `node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク4: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク5: 要件2 `PressActionRules`の自動テストを足す
    *   **対象ファイル** :
        *   `./test/core/PressActionRules.test.js` :（新規）
    *   **作業内容** :
        *   先頭に3行以内の責務定義のJSDocを書き、`node:test`・`node:assert/strict`のみを使う。補助関数を作る場合はJSDoc（`@param`・`@returns`）を書く。
        *   2章要件2の自動テストの一覧（各分岐・境界・ハンドル優先・引数不変・`isSelected`の呼び出し回数と引数）を確かめるケースを書く。`hit`は素のオブジェクト、`isSelected`は`Set`による素の関数で作る（ソースは書き換えない）。
        *   `node --test`で全件通ることを確認し、増えた件数を記録する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク5: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク6: 要件3 カーソルの形の規則を`js/core/CursorShapeRules.js`へ切り出す
    *   **対象ファイル** :
        *   `./js/core/CursorShapeRules.js` :（新規）
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `CursorShapeRules.js`を新設し、先頭に3行以内の責務定義のJSDocを書く（状態なし・DOMなし・引数を書き換えない。importは`InputModes.js`のみ）。
        *   typedef`CursorShapeInput`（2章要件3の8項目）と`resolveCursorShape(input)`を書く。判定は2章要件3の1〜13のとおり（今の`#resolveCursor`の1512〜1562行と1対1。順序・比較の条件・結果の文字列を変えない）。`#resolveCursor`のJSDocの判定表（(0a)〜(10)）をこのファイルへ移す。
        *   JSDocに、`isPickingShape`・`isSelected`を関数で受ける理由（短絡評価を保ち、呼び出しの回数を変えないため）を書く。
        *   `InputTracker.js`：`#resolveCursor`を削除し、`#updateCursor(hit = null)`が`resolveCursorShape({ isPanning, isSpacePressed, isLeftDragState, mode, state, isPickingShape, hit, isSelected })`の結果を`this.canvas.style.cursor`へ入れるだけにする。`#updateCursor`を呼ぶ場面・回数・引数を変えない。`#isLeftDragState()`は`InputTracker`に残す（他の2か所でも使う）。区切りコメント`// ---- カーソル形状 ----`は残す。
        *   `node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク6: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク7: 要件3 `CursorShapeRules`の自動テストを足す
    *   **対象ファイル** :
        *   `./test/core/CursorShapeRules.test.js` :（新規）
    *   **作業内容** :
        *   先頭に3行以内の責務定義のJSDocを書き、`node:test`・`node:assert/strict`のみを使う。補助関数（既定の入力を作るもの等）にはJSDoc（`@param`・`@returns`）を書く。
        *   2章要件3の自動テストの一覧（(0a)〜(10)の各分岐・優先順位（パン中が最優先、スペース押下中は左ドラッグ状態では効かない、待ち受け中の`'cell'`の位置、当たり分類が`null`のとき`'default'`）・短絡評価の保持・引数不変）を確かめるケースを書く。`InputState`・`OperationMode`は`js/core/InputModes.js`からimportして使う。
        *   `node --test`で全件通ることを確認し、増えた件数を記録する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク7: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク8: 要件4 `main.js`の表示配線を`js/wiring/DisplayWiring.js`へ切り出す
    *   **対象ファイル** :
        *   `./js/wiring/DisplayWiring.js` :（新規。フォルダ`js/wiring/`も新規）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `js/wiring/`フォルダと`DisplayWiring.js`を新設し、先頭に3行以内の責務定義のJSDocを書く。クラス`DisplayWiring`・コンストラクタ・公開メソッド`syncAll()`・非公開メソッドのすべてにJSDoc（`@param`・`@returns`・責務）を書く。
        *   `main.js`の`// 6.5.`の中身（355〜468行）を**そのまま移す**：`ShapeExtentReader`の生成、3つの要素の取得、同期関数3つ、購読の登録5つ、`ViewToggleGroup`の生成・注入・`syncViewToggleGroup`・登録、`UnitSnapGroup`の生成・注入・`syncUnitSnapGroup`・登録、`🧰`の`click`と`syncFloatWindowVisibility`・登録、`fitViewToShapes`と`⛶`の`click`。**登録する関数・登録先・登録の数・登録の順序を変えない**（2章要件4の1〜10の並び）。同期関数・`fitViewToShapes`は非公開メソッドにし、JSDocは主語と参照先だけ直す。
        *   `syncAll()`は6つの同期を今と同じ順序（座標→大きさ→グリッド→表示の切り替え→スナップ→フロートウィンドウ）で呼ぶ。公開するのはコンストラクタと`syncAll()`のみ。
        *   `main.js`：`// 6.5.`を`new DisplayWiring({ model, viewTransform, displayState, unitSnapSettings, cursorTracker, canvas })`の生成に置き換える（位置を動かさない。ブロックのコメントは実態に合わせて書き直す）。起動時の同期の6行を`displayWiring.syncAll();`に置き換える（`syncZoomDisplay()`の後・`syncDeleteButtonState()`の前）。使われなくなったimport7行を消し、`DisplayWiring`のimportを足す。**`main.js`に判定・計算を残さない。**
        *   `index.html`・`palette/`・`edit/`・`core/`の各モジュールは変更しない。`grep`で`main.js`に移した識別子が残っていないこと、`ViewTransform`のimportが`new ViewTransform()`のために必要であることを確認する。
        *   自動テストは足さない（開発資料への追記はタスク12）。`node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク8: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [x] タスク9: 要件5 `InputTracker.js`・`main.js`の責務定義と区切りコメントを実態に合わせる
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `InputTracker.js`の先頭の責務定義のJSDoc（1〜5行）とクラスのJSDoc（250〜290行相当）から、外へ出した分（入力状態・操作モードの値の定義、フォーカスしている要素の判定、押下時の分岐表、カーソルの形の判定表）の記述を削り、「規則は切り出し先の関数へ渡すだけで本クラスは持たない」という既存の書き方（`SelectionRules`・`MoveDirectionRules`・`UnitSnapRules`の形）にそろえる。カーソルの形はDOMへの適用だけを本クラスが行う旨を書く。
        *   メソッドの区切りコメントの一覧（「公開API（モード・図形種別）」〜「カーソル形状」）が実態と一致していることを確認し、食い違いがあれば直す。
        *   `main.js`の先頭の責務定義は「各モジュールの初期化と連携(依存性の注入)」のままとし、配線ブロックの一覧の記述に変更があれば実態に合わせる。
        *   削る以外の改名・整形を行わない。`node --test`で全件通ることを確認する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク9: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [ ] タスク10: 仕上げの確認（JSDoc・テスト・残置）
    *   **対象ファイル** :
        *   （確認のみ。必要な修正が見つかった場合のみ該当ファイルを更新）
    *   **作業内容** :
        *   コード修正完了後、JSDocコメントの記載漏れがないことを確認する（新規の全ファイルの先頭の3行以内の責務定義、クラス・関数・メソッド・typedefの`@param`・`@returns`・責務）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`tests`・`suites`・`pass`・`fail 0`の件数を記録する）。
        *   移動元（`InputTracker.js`・`main.js`）に、使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（`grep`で移した識別子を全文検索する）。再exportが残っていないこと、同じ規則・定数の二重定義がないこと、循環importがないこと（`js/wiring/`が`core/`・`palette/`・`edit/`からimportされていないこと）を確認する。
        *   `js/core/InputTracker.js`・`js/main.js`の行数を実測し記録する（タスク12で資料へ反映する）。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク10: …」の欄へ実際の作業内容（変更したファイル・移した範囲・確認した結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [ ] タスク11: 要件6のテストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （提示のみ。ファイルの変更なし）
    *   **作業内容** :
        *   2章「要件6」の一覧（0.強制再読み込みを先頭に含む19項目）をチャットで発注者へ提示する。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク11: …」の欄へ実際の作業内容（提示した確認項目と、発注者のテストプレイの結果）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る点が判明した場合は、資料本体は修正せず『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄へ追記する（資料本体の修正はタスク12のみ）。
*   [ ] タスク12: 各タスクの『開発資料の更新予定』を開発資料へ反映する（最終固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/02_main.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`13_palette.md`・`14_edit.md`・`16_test.md`・`19_ToolRules.md`・`20_DisplayState.md`・`21_GridSpacingRules.md`・`24_CanvasCursorTracker.md`・`25_ViewFitRules.md`・`26_StatusReadoutRules.md`・`29_AltKeyGuard.md`・`30_UnitSnapRules.md`・`31_UnitSnapSettings.md` :（更新）
        *   `./_doc/arch/`の新規5ファイル（`InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`・`DisplayWiring`） :（新規）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄と、各タスクで追記された内容をすべて確認し、資料へ反映する。
        *   少なくとも次を反映する：1章のフォルダ構造（新しい4ファイル・`js/wiring/`・新しいテスト2ファイル）とフォルダ分割の方針・依存方向、**1章の既存の記述のうち実態と食い違う分**（ツリーの1行コメントの「`main.js`から使う」4行＝`UnitSnapRules`・`GridSpacingRules`・`ViewFitRules`・`StatusReadoutRules`（32・37・41・42行）、167行の**依存方向**のimportの出どころ4つ＝`InputTracker`の`core/`内のimportの列・`AltKeyGuard`・`ToolRules`・`main.js`の列、161行の`core/`の項の`InputTracker`の`OperationMode`と`main.js`が使う規則の帰属）、**3章（機能別の記述）の`main.js`帰属の記述のうち`wiring/DisplayWiring`へ移る分**（15.の⛶＝`fitViewToShapes`・🧰＝`syncFloatWindowVisibility`、17.のモジュールの分担・座標の表示・ステータスバーの部品、15.・17.の通知の登録先と起動時の1回）、**3章の`InputTracker.js`帰属の記述**（2.の入力欄の規則の判定＝`FocusKeyYieldRules`への移動と`isSpaceYieldedElement`の公開への変化）、4章の一覧（新しいモジュールの5行）、新しいモジュールごとの`_doc/arch/`のファイル、`InputTracker.js`・`main.js`・`KeyboardShortcuts.js`・`AltKeyGuard.js`・`ToolRules.js`の記載（行数・責務・importの出どころ）、`test/`の規則のファイルの新設分・「テストできない箇所」の一覧・件数、`palette/`・`edit/`・各規則のファイルの「使う側」の`main.js`→`wiring/DisplayWiring`の書き換え。
        *   行数・テスト件数は実測値を書く（タスク10の記録）。
        *   ※実装AIによる開発資料の書き換えは原則禁止だが、**この最終タスクのみ明示的な例外**である（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。
        *   **タスク完了後の記録**：本計画書の『4. 詳細作業内容』の「タスク12: …」の欄へ実際の作業内容（反映した資料の箇所・実測した行数・テスト件数）を記載して完成させ、「3. タスクリスト」の該当タスクを`[x]`にする。
---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1(a) 操作モードと入力状態の定数を`js/core/InputModes.js`へ移す
*   **作業内容** :
    *   `js/core/InputModes.js`を新規作成（責務定義3行のJSDoc。import・DOMなし）。`InputTracker.js`の`InputState`（素のオブジェクト）・`OperationMode`（`Object.freeze`）をJSDoc込みでそのまま移した。JSDocは`setMode()`→`InputTracker.setMode()`の1箇所のみ修飾。`PointHit`のtypedefは`InputTracker.js`に残した。
    *   `InputTracker.js`：元の定義とexportを削除し、`import { InputState, OperationMode } from './InputModes.js';`を追加（再exportなし）。
    *   import元を`InputModes.js`へ変更：`ToolRules.js`、`test/core/ToolRules.test.js`、`KeyboardShortcuts.js`（`OperationMode`のみ分離。`SHAPE_TYPES`・`isTextInputElement`・`isSpaceOperatedInputElement`は従来どおり`InputTracker.js`から。タスク2・3の対象）、`main.js`（`OperationMode`のみ分離。`InputTracker`・`WHEEL_ZOOM_STEP`・`hasCtrlModifier`は`InputTracker.js`のまま）。
    *   grepで取り込み側に漏れがないことを確認（`InputState`は`InputTracker.js`のみ）。`node --test`：tests 1261 / pass 1261 / fail 0。

### タスク2: 要件1(b) `SHAPE_TYPES`の再exportを消す
*   **作業内容** :
    *   `InputTracker.js`：`export { SHAPE_TYPES };`と直前のJSDoc（計6行）、およびその後ろの空行1行を削除。`import { SHAPE_TYPES } from './ShapeFactory.js';`と`setShapeType`・`currentShapeType`での使用は残した。
    *   `KeyboardShortcuts.js`：`SHAPE_TYPES`を`./ShapeFactory.js`から取るようimportを分割（`isTextInputElement`・`isSpaceOperatedInputElement`は`InputTracker.js`のまま。タスク3の対象）。
    *   grepで`InputTracker.js`から`SHAPE_TYPES`をimportする箇所が無いことを確認。`node --test`全件合格。

### タスク3: 要件1(c) フォーカスしている要素の判定を`js/core/FocusKeyYieldRules.js`へ移す
*   **作業内容** :
    *   `js/core/FocusKeyYieldRules.js`を新規作成（責務定義3行のJSDoc。importなし・最上位でDOMに触れない）。`InputTracker.js`の`TEXT_INPUT_TYPES`・`isTextInputElement`・`SPACE_OPERATED_INPUT_TYPES`・`isSpaceOperatedInputElement`・`isToggleButtonElement`・`isSpaceYieldedElement`をJSDoc込みでそのまま移した（中身・判定の条件は不変）。`isToggleButtonElement`は非公開のまま、`isSpaceYieldedElement`は`export`に変更。JSDocの本文は参照先が同ファイル内・`KeyboardShortcuts`・`InputTracker`のままで直す箇所がなかった。
    *   `InputTracker.js`：元の定義を削除し`import { isTextInputElement, isSpaceYieldedElement } from './FocusKeyYieldRules.js';`を追加（再exportなし）。`KeyboardShortcuts.js`（`isTextInputElement`・`isSpaceOperatedInputElement`）・`AltKeyGuard.js`（`isTextInputElement`）のimport元を`FocusKeyYieldRules.js`へ変更。
    *   grepで該当識別子のimportが`FocusKeyYieldRules.js`のみであることを確認。`node --test`：tests 1261 / pass 1261 / fail 0。

### タスク4: 要件2 押下で始める操作の規則を`js/core/PressActionRules.js`へ切り出す
*   **作業内容** :
    *   `js/core/PressActionRules.js`を新規作成（責務定義3行のJSDoc。importなし・DOMなし・引数を書き換えない）。typedef`PressAction`と`resolvePressAction(hit, isSelected)`を、2章要件2の判定1〜5の順で実装（`hit.bodyId === null`の書き方も同じ）。`'move'`はモジュール内の定数`MOVE_HANDLE_NAME`（非export）で比較1か所。`PointHit`の型参照はJSDocの`import('./PointHitRules.js').PointHit`のみ。
    *   `InputTracker.js`：`handleMouseDown`末尾の分岐を`resolvePressAction(hit, (id) => this.model.isSelected(id))`の呼び出しと振り分け（`#beginMoveSelection(event, point)`／`#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, action.target)`／`#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point)`／null・他は何もしない）に置換。`PressActionRules.js`のimportを追加。手順(1)〜(5a)は不変。JSDoc手順(6)の分岐表は`PressActionRules.js`へ移し、`handleMouseDown`側は規則へ委ねて振り分ける記述に直した（`event.altKey`を記憶する注記は残した）。
    *   `InputTracker.js`に`'move'`との比較は残っていない。`#dragHandleName`のJSDoc（「'move'以外」）と`#resolveCursor`のJSDoc・戻り値の`'move'`は触っていない。
    *   `node --test`：tests 1261 / pass 1261 / fail 0。

### タスク5: 要件2 `PressActionRules`の自動テストを足す
*   **作業内容** :
    *   `test/core/PressActionRules.test.js`を新規作成（責務定義のJSDoc、`node:test`・`node:assert/strict`のみ）。`hit`は素のオブジェクト、`isSelected`は`Set`を引き呼び出し引数を記録する補助関数`makeIsSelected`（JSDoc付き）で作った。ソース・既存テストは未変更。
    *   ケース（12件）：moveハンドル→moveSelection／頂点ハンドル→dragHandle（targetは`hit.handle`と同一参照）／ハンドルは本体が選択内でも優先／ハンドルあり（move・頂点）で`isSelected`を呼ばない／ハンドルありで`bodyId`がnullでもハンドル優先／本体が選択内→moveSelection／選択外→null／空白→marquee／本体判定で`isSelected`を`hit.bodyId`で1回だけ呼ぶ／空白で呼ばない／`hit`不変・moveSelection・marqueeが毎回新しいオブジェクト。
    *   `node --test`：tests 1273 / pass 1273 / fail 0（1261から12件増）。

### タスク6: 要件3 カーソルの形の規則を`js/core/CursorShapeRules.js`へ切り出す
*   **作業内容** :
    *   `js/core/CursorShapeRules.js`を新規作成（責務定義3行、importは`InputModes.js`のみ）。typedef`CursorShapeInput`（8項目）と`resolveCursorShape(input)`を置き、`#resolveCursor`の判定（(0a)〜(10)）を順序・比較条件・結果の文字列を変えずに移した。判定表のJSDocも移し、`isPickingShape`・`isSelected`を関数で受ける理由（短絡評価と呼び出し回数を保つ）を追記した。
    *   `js/core/InputTracker.js`：`#resolveCursor`を削除し、`#updateCursor(hit = null)`が`resolveCursorShape({...})`の結果を`this.canvas.style.cursor`へ入れるだけにした（`isPickingShape`・`isSelected`はアロー関数で渡す）。`resolveCursorShape`のimportを追加。`#isLeftDragState()`と区切りコメントは残した。`#updateCursor`の呼び出し12か所・引数は変更なし。別メソッドのJSDoc中の`#resolveCursor`への言及1か所を`#updateCursor`へ直した。
    *   `node --test`：tests 1273 / suites 194 / pass 1273 / fail 0。

### タスク7: 要件3 `CursorShapeRules`の自動テストを足す
*   **作業内容** :
    *   `test/core/CursorShapeRules.test.js`を新規作成（`node:test`・`node:assert/strict`のみ、`InputState`・`OperationMode`をimport）。補助関数`makeInput`（既定の入力を作る。JSDoc付き）。4つのdescribe・28ケース：パン・スペース（パン中が最優先、スペース押下中の'grab'、左ドラッグ状態では効かない）、モード（CREATE・DRAWING中は'crosshair'、PANは'grab'、未知モードは'default'）、選択モード（待ち受け中の'cell'とその優先位置、DRAGGING_HANDLE・MOVING_SELECTIONは'move'、MARQUEE_SELECTINGは'default'、hitがnullは'default'、ハンドル上・選択内本体は'move'、選択外本体は'pointer'、それ以外は'default'）、短絡評価（isPickingShape・isSelectedを呼ぶ場面と回数）と引数不変。
    *   `js/`配下・既存テストは変更していない。
    *   `node --test`：tests 1301 / pass 1301 / fail 0（タスク6時点の1273から28件増）。

### タスク8: 要件4 `main.js`の表示配線を`js/wiring/DisplayWiring.js`へ切り出す
*   **作業内容** :
    *   `js/wiring/DisplayWiring.js`を新規作成（クラス`DisplayWiring`）。コンストラクタ（`{ model, viewTransform, displayState, unitSnapSettings, cursorTracker, canvas }`）で`ShapeExtentReader`の生成・3要素の取得・購読5つの登録・`ViewToggleGroup`／`UnitSnapGroup`の生成と登録・🧰の`click`と登録・⛶の`click`を、元の`// 6.5.`と同じ順序（要件4の1〜10）で行う。同期関数6つと`fitViewToShapes`は非公開メソッド、公開は`syncAll()`（座標→大きさ→グリッド→表示の切り替え→スナップ→フロートウィンドウ）のみ。
    *   `js/main.js`：`// 6.5.`のブロックを`new DisplayWiring({...})`に置換（位置は不動）、起動時の同期6行を`displayWiring.syncAll();`に置換（`syncZoomDisplay()`の後・`syncDeleteButtonState()`の前）。import6行（`ShapeExtentReader`・`StatusReadoutRules`・`GridSpacingRules`・`ViewFitRules`・`UnitSnapRules`・`ViewToggleGroup`）を削除し、`UnitSnapGroup`のimport行を`DisplayWiring`のimportへ置換。`ViewTransform`のimportは`new ViewTransform()`のため残した。
    *   `grep`で`main.js`に`ShapeExtentReader`・`syncCursorReadout`・`UnitSnapGroup`・`computeFitView`・`MIN_SCALE`が残っていないことを確認。`index.html`・`palette/`・`edit/`・`core/`は未変更。
    *   `node --test`：tests 1301 / pass 1301 / fail 0（テストは足していない）。
    *   （監査指摘の修正）`DisplayWiring.js`の非公開フィールド12個に`@type`のJSDoc（1行形式）を追記した（コメントのみ。コードのふるまいは不変）。

### タスク9: 要件5 `InputTracker.js`・`main.js`の責務定義と区切りコメントを実態に合わせる
*   **作業内容** :
    *   `js/core/InputTracker.js`：先頭の責務定義の末尾を「カーソル形状のキャンバスへの適用（形の判定は規則の関数へ渡すだけで本クラスは持たない）」に変更。クラスのJSDocは、状態名に「値の定義はInputModes.js」を添え、カーソル形状を「CursorShapeRules.resolveCursorShapeへ渡して得た形を適用する（判定表は持たない）」に直し、押下時の分岐（PressActionRules.resolvePressAction）・フォーカスしている要素の判定（FocusKeyYieldRules）を「関数へ渡すだけで本クラスは持たない」形で追記。区切りコメント8つは実態と一致しており変更なし。
    *   `js/main.js`：生成順の制約のコメントの「#updateCursor() → #resolveCursor → isPickingShape()」を「#updateCursor()でisPickingShape()を呼ぶ（resolveCursorShapeへ渡す）」へ修正（制約の説明は残した）。先頭の責務定義・配線ブロックの一覧は変更不要。
    *   コメントのみの変更（実行されるコードは不変）。`node --test`：1301件全件合格。

### タスク10: 仕上げの確認（JSDoc・テスト・残置）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク11: 要件6のテストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク12: 各タスクの『開発資料の更新予定』を開発資料へ反映する（最終固定タスク）
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント

* **登録順と`main.js`でのブロックの位置**：`model.onChange`・`viewTransform.onChange`・`displayState.onChange`には`// 6.5.`より前と後の両方で登録がある。`DisplayWiring`の生成位置を動かすと通知の呼ばれる順が変わるため、位置は今の`// 6.5.`のまま（`// 6.`の後・`// 7.`の前）とする。起動時の`syncAll()`も今の6行の位置（`syncZoomDisplay()`の後・`syncDeleteButtonState()`の前）に置く。再描画・同期の回数は変えない。
* **`isPickingShape`・`isSelected`を関数で渡す判断**：要件3の引数を値（`boolean`）で受けると、今は短絡評価で呼ばれない場面でも`styleEyedropper.isPicking()`・`model.isSelected()`が呼ばれ、呼び出しの回数が変わる（どちらも副作用のない照会だが、「呼び出しの順序と回数を変えない」という最上位の要件に反し、`main.js`の生成順の制約の説明とも食い違う）。このため本計画では関数で受ける形とする（`PointHitRules`・要件2と同じ形）。値で受ける形が望ましい場合は指示を請う。
* **`isSpaceYieldedElement`の公開**：移動に伴い、`InputTracker`から呼ぶために非公開から`export`になる（REQの指示どおり）。関数の中身・判定の条件は変えない。開発資料の「非公開でテストのためにexportしない」という既存の記述は、公開になっても`node --test`で確かめられない（DOMの型に依存する）ことを明記して直す。
* **`ToolRules`・`KeyboardShortcuts`・`AltKeyGuard`が`InputTracker.js`をimportしなくなること**：本作業の切り出しの結果であり、意図した改善ではない。`ToolRules.test.js`が`InputTracker.js`を間接にimportしなくなるため、開発資料の該当の注記（最上位でDOMに触れる変更をするとテストが壊れる）を実態に合わせて直す必要がある。
* **ふるまいの確認はテストプレイに依る**：`InputTracker`の配線（`DragTracker`・DOMに依存）と`DisplayWiring`（DOMと購読）は自動テストにできないため、要件2・要件3の規則の関数のテストで判定の中身を機械的に確かめ、残りはタスク11のテストプレイで確かめる。特に、カーソルの形（確認項目5）・押下時の分岐（3・4）・起動時の各表示（1）・キーとボタンの押し込みの追従（10）・ステータスバーの追従（11）を重点的に見ていただきたい。

* **タスク6の確認（目視推奨）**：`#updateCursor`が毎回アロー関数2つを生成するようになった（`mousemove`ごとに呼ばれる）が、判定の呼び出し回数は変わらない。カーソルの形（パン中・スペース押下・各モード・ホバー・図形ピック待ち）を実機で確認するのが望ましい。
* **開発資料の更新予定（タスク6）**：`#resolveCursor`が無くなり`#updateCursor`がDOMへの適用だけを担うこと、判定表が`CursorShapeRules`へ移ったことは、既存の要件3・タスク12の記載に含まれる。追加の影響なし。

* **タスク8の確認（目視推奨）**：`onChange`の登録が関数の直接渡しからアロー関数経由（`() => this.#sync...()`）になった（同期関数は引数を使わないため挙動は同じ）。起動時の各表示・🧰・⛶・▢◐▦・🧲・単位のボタン・ステータスバーの座標／大きさ／グリッドの追従を実機で確認するのが望ましい。
* **開発資料の更新予定（タスク8）**：`DisplayWiring`の新設・`main.js`の`// 6.5.`の縮小は既存のタスク12の記載に含まれる。追加の影響なし。

* **タスク9の確認**：コメントのみの変更で目視確認は不要。
* **開発資料の更新予定（タスク9）**：追加の影響なし（既存のタスク12の記載に含まれる）。
