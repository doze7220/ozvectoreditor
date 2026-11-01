# RES: 作業計画・作業レポート (Phase 02-04) : 削除UI・キーボードショートカット
* 参照元REQ: `./_log/req/261031_0331_REQ_Phase02-04_Delete_UI_And_Shortcuts.md`

## 1. 作業目的
図形の削除が選択モードでの`Delete`/`Backspace`キーでしか行えず発見しにくい現状を改め、コントロールパネルに削除ボタンを追加する。あわせて、操作モード・図形種別の切替、ビュー操作（拡大・縮小・リセット）、`Esc`、全選択、削除をキーボードから実行できるショートカットを導入し、将来のテキスト入力欄で文字入力がショートカット・スペースパンとして誤作動しないための判定を整える。

**用語（REQの定義に従い、本RES・コード内JSDocで統一する）**
* **ショートカット**: 本作業で導入するキー押下による操作（操作モード切替・図形種別切替・ビュー操作・`Esc`・全選択・削除）。スペースパンは含めない。
* **テキスト入力中**: `document.activeElement`が、文字入力を受け付ける要素である状態（判定は`isTextInputElement`、要件4）。
* **ドラッグ中**: `InputTracker`が所有する`DragTracker`のセッション中（パン・左ドラッグ。閾値以前を含む）。
* 選択集合・範囲選択・本体ドラッグはPhase 02-03、ワールド座標・スクリーン座標・ビュー変換はPhase 02-02の定義に従う。

## 2. アーキテクチャ設計

### 全体構成（依存方向）
```text
main.js ──生成・注入──▶ KeyboardShortcuts（新設：キー→操作の対応表と受理判定のみ）
   │                        │  import（定数・ヘルパー関数のみ。インスタンスは持たない）
   │                        ▼
   │                  InputTracker.js の export：OperationMode / SHAPE_TYPES / isTextInputElement
   │
   ├──生成・所有──▶ InputTracker（Spaceキーのみ解釈。公開メソッド：isDragging / deleteSelection /
   │                              cancelDraftOrClearSelection / selectAll を追加）
   │
   └── KeyboardShortcutsへ注入する操作コールバック（main.js内で定義）
        setMode → applyMode / setShapeType → (applyMode) + applyShapeType / zoomStep → viewTransform.zoomAt /
        resetView → viewTransform.reset / cancel・selectAll・deleteSelection → InputTrackerの公開メソッド
```
* 依存方向は`main.js → KeyboardShortcuts`、`main.js → InputTracker`、`KeyboardShortcuts → InputTracker.js（モジュールのexport定数・関数のみ）`の一方向。`InputTracker`は`KeyboardShortcuts`・`applyMode`・`applyShapeType`を知らない。`KeyboardShortcuts`は`VectorModel`・`ViewTransform`・`InputTracker`インスタンス・DOMのボタン要素を参照しない（`document`の`keydown`購読と`document.activeElement`の読み取りのみ）。

### 要件1: 削除ボタン（コントロールパネル）
* **配置**: `index.html`の`#window-control-panel .window-body`内、`#mode-pan`ボタンと`.view-zoom-row`の間に`<button type="button" id="selection-delete" class="tool-btn" title="選択中の図形を削除 (Delete / Backspace)" disabled>🗑 削除</button>`を追加する。初期状態はHTML上も`disabled`とし、起動時の明示同期で実状態に合わせる。
* **見た目**: `.tool-btn:disabled { opacity: 0.4; cursor: default; }`を追加し、既存の`.tool-btn:hover`を`.tool-btn:hover:not(:disabled)`へ変更して、押せない状態でホバー色が変わらないようにする。フロートウィンドウ用の`.disabled`クラスは流用しない。
* **`modeButtons`には含めない**（`.active`の対象外）。`main.js`では倍率表示・リセットボタンと同様に個別の定数`deleteSelectionBtn`として取得する。
* **同期経路**: `main.js`にローカル関数`syncDeleteButtonState()`（`deleteSelectionBtn.disabled = model.getSelectedIds().length === 0;`）を定義し、`model.onChange(syncDeleteButtonState)`で登録する。起動時初期化の最後（`renderCurrentState()`・`syncZoomDisplay()`の並び）に明示的に1回呼ぶ。DOM更新は`main.js`のみが行い、`VectorModel`・`InputTracker`はDOMに触れない。
* **削除処理の一本化**: `InputTracker`に公開メソッド`deleteSelection()`を追加し、受理条件（選択モード・`IDLE`状態・ドラッグ中でない・選択集合が空でない）を**ここ1箇所でのみ**判定する。受理時は`model.deleteShapes(selectedIds)`（変更通知1回）を呼び`true`を、非受理時は何もせず`false`を返す。削除ボタンの`click`とショートカットの`Delete`/`Backspace`は、いずれもこのメソッドを呼ぶのみ（ボタン側・キー側に条件を書かない）。`main.js`から`model.deleteShapes`を直接呼ばない。
* **前提（明記）**: 選択集合は`setMode`（操作モード切替）で無条件にクリアされ、選択集合を作れるのは選択モードのみであるため、図形作成・キャンバス移動モード中は削除ボタンは常に押せない状態になる。モード別の分岐は追加しない。

### 要件2: キーボードショートカット
#### 対応表（`KeyboardShortcuts.js`のモジュール定数`SHORTCUT_BINDINGS`で1箇所に定義）
各エントリは`{ codes: string[], ctrl: boolean, allowShift: boolean, repeatable: boolean, action: string, arg?: any }`のデータ。`ctrl: true`は「`Ctrl`または`Meta`（⌘）が押されている」を意味する。

| キー（`event.code`） | 修飾キー | Shift | リピート | action（arg） | 操作 |
| --- | --- | --- | --- | --- | --- |
| `KeyV` | なし | 不可 | 無視 | `setMode`（`OperationMode.SELECT`） | 選択モードへ切替 |
| `KeyP` | なし | 不可 | 無視 | `setMode`（`OperationMode.CREATE`） | 図形作成モードへ切替（種別は記憶中のもの） |
| `KeyH` | なし | 不可 | 無視 | `setMode`（`OperationMode.PAN`） | キャンバス移動モードへ切替 |
| `Digit1`〜`Digit5`, `Numpad1`〜`Numpad5` | なし | 不可 | 無視 | `setShapeType`（`SHAPE_TYPES[0]`〜`[4]`） | 図形種別を直線／曲線／弧／矩形／円に切替（図形作成モード以外では図形作成モードへも切替） |
| `Digit0`, `Numpad0` | Ctrl/Meta | 不可 | 無視 | `resetView` | ビュー変換のリセット |
| `Equal`, `Semicolon`, `NumpadAdd` | Ctrl/Meta | 可 | **受付** | `zoomStep`（`+1`） | 拡大（表示中キャンバスの中心基準） |
| `Minus`, `NumpadSubtract` | Ctrl/Meta | 可 | **受付** | `zoomStep`（`-1`） | 縮小（同上） |
| `Escape` | なし | 不可 | 無視 | `cancel` | 作成途中の図形の破棄／選択解除 |
| `KeyA` | Ctrl/Meta | 不可 | 無視 | `selectAll` | 全図形を選択（選択モード以外では選択モードへ切替後） |
| `Delete`, `Backspace` | なし | 不可 | 無視 | `deleteSelection` | 選択集合の全図形を削除 |

* **図形種別のエントリは`SHAPE_TYPES`から生成する**（`SHAPE_TYPES.map((type, i) => ({ codes: [`Digit${i + 1}`, `Numpad${i + 1}`], ... arg: type }))`）。図形種別の文字列一覧を新たに持たず、図形種別ごとのif/switch分岐も持ち込まない。`SHAPE_TYPES`の並び（`line, curve, arc, rect, circle`）が図形パレットの並び順と一致していることを前提とする（JSDocに明記）。
* `Space`は対応表に**含めない**（スペースパンは`InputTracker`の担当。JSDocに明記）。
* **キーの識別方法**: `event.code`（物理キー位置）を採用する。理由：(1)`event.key`は大文字小文字（`v`/`V`）・`Shift`併用時の記号化（`Shift`+`1`→`!`）・キーボード配列の影響を受ける、(2)JIS配列の`+`は`Shift`+`;`で`key`が`+`/`;`と揺れるが、`code`は`Semicolon`で一定、(3)IME有効時も`code`は物理キーを返す。テンキーの`1`〜`5`（`Numpad1`〜`Numpad5`）も受け付ける（NumLockの状態によらず`code`は同一）。
* **JIS配列への配慮**: 拡大は`Ctrl`+`Equal`（US配列の`=`。JIS配列では`^`キー）・`Ctrl`+`Semicolon`（JIS配列の`;`/`+`キー。`Shift`併用の`Ctrl`+`Shift`+`;`も`allowShift`で受理）・`Ctrl`+`NumpadAdd`。縮小は`Ctrl`+`Minus`・`Ctrl`+`NumpadSubtract`。リセットは`Ctrl`+`Digit0`・`Ctrl`+`Numpad0`。テンキーの`+`/`-`/`0`は他の拡大・縮小・リセットと同じく`Ctrl`/`Meta`併用を必須とする（修飾キーなしのテンキー`+`/`-`は受け付けない。懸念事項参照）。

#### 受理判定（`KeyboardShortcuts`の`keydown`ハンドラ。判定順序を固定し、操作ごとに重複させない）
1. `event.isComposing`が真（IME変換中）なら何もしない。
2. **テキスト入力中**（`isTextInputElement(document.activeElement)`）なら何もしない。
3. 対応表から一致エントリを1件探す（private`#findBinding(event)`。キー識別・修飾キー判定はここ1箇所のみ）。一致なしなら何もしない。修飾キーの照合規則：
   * `Alt`が押されていれば常に不一致（`AltGr`＝`Ctrl`+`Alt`の文字入力を奪わない）。
   * `ctrl: true`のエントリは`ctrlKey || metaKey`が真であること、`ctrl: false`のエントリは`ctrlKey`・`metaKey`がともに偽であること。
   * **Shiftの規則**: `allowShift: false`のエントリ（拡大・縮小以外すべて）は`shiftKey`が偽であること。`allowShift: true`（拡大・縮小のみ）は`shiftKey`を問わない（JIS配列の`Ctrl`+`Shift`+`;`、US配列の`Ctrl`+`Shift`+`=`（`+`）に対応するため）。`Shift`+`V`等は反応しない（将来のShift併用操作のために予約）。
4. **ドラッグ中**（注入された`isDragging()`が真）なら何もしない。
5. **キーリピート**（`event.repeat`）かつ`repeatable: false`のエントリなら実行しない。ただし`ctrl: true`のエントリ（`Ctrl`+`0`・`Ctrl`+`A`）は、押しっぱなしでブラウザズームのリセット・ページ全選択が起きないよう`preventDefault()`のみ行う（受理しなかったキーを`preventDefault()`しない原則の、唯一の明示的な例外としてJSDocに記載）。修飾キーなしのエントリのリピートは`preventDefault()`もしない。
6. 注入された操作コールバック`actions[binding.action](binding.arg)`を呼ぶ。戻り値が`true`のときのみ`preventDefault()`する（`false`＝受理せず。`Esc`で何もしなかった場合・`deleteSelection()`が受理しなかった場合）。

* 1・2・3・4で終了した場合は`preventDefault()`しない（テキスト入力中・ドラッグ中を含む）。
* コンストラクタで、対応表の全`action`名に対応する関数が注入されていることを検証し、欠けていれば`Error`をthrowする（起動時に配線漏れを検出するため）。

#### 操作の実体（`main.js`で定義し、`KeyboardShortcuts`のコンストラクタへ注入する。いずれも`boolean`を返す）
| action | main.js側の処理 | 戻り値 |
| --- | --- | --- |
| `isDragging`（判定用） | `inputTracker.isDragging()` | ドラッグ中か |
| `setMode(mode)` | `applyMode(mode)` | `true` |
| `setShapeType(type)` | `inputTracker.getMode()`が`OperationMode.CREATE`でなければ先に`applyMode(OperationMode.CREATE)`、その後`applyShapeType(type)` | `true` |
| `zoomStep(direction)` | `zoomAtCanvasCenter(direction)`（下記） | `true` |
| `resetView()` | `viewTransform.reset()`のみ（リセットボタンと同一） | `true` |
| `cancel()` | `inputTracker.cancelDraftOrClearSelection()` | メソッドの戻り値 |
| `selectAll()` | `inputTracker.getMode()`が`OperationMode.SELECT`でなければ先に`applyMode(OperationMode.SELECT)`、その後`inputTracker.selectAll()` | `true`（図形0個でも`preventDefault()`するため常に`true`） |
| `deleteSelection()` | `inputTracker.deleteSelection()`（削除ボタンと同一） | メソッドの戻り値 |

* **UI同期経路**: モード・種別の切替は`applyMode`/`applyShapeType`のみを通る（ボタンの`.active`・パレットの活性/ハイライトはボタン操作時と同じ経路で同期）。ビュー変換の表示同期・再描画は`viewTransform.onChange`、選択集合・削除による再描画と削除ボタン状態は`model.onChange`経由のみ。ショートカット専用のUI同期処理・再描画呼び出しは書かない。
* **拡大・縮小**: `main.js`にローカル関数`zoomAtCanvasCenter(direction)`を定義し、`viewTransform.zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, direction > 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP)`を呼ぶのみとする。中心はスクリーン座標（キャンバス左上基準のCSSピクセル。`getScreenCoordinate`と同じ単位系）で、変換式・クランプは書かない。刻み幅は`InputTracker.js`の既存定数`WHEEL_ZOOM_STEP`を`export`して`main.js`からimportする（定数の重複定義をしない）。
* **作成途中の図形**: モード切替・種別切替による破棄は`setMode`/`setShapeType`の既存挙動のまま（ボタン操作と同一）。

#### `InputTracker`へ追加する公開メソッド（状態依存の操作に限る）
| メソッド | 受理条件と処理 | 戻り値 |
| --- | --- | --- |
| `isDragging()` | `this.#drag.isActive()`を返す（パン・左ドラッグ。閾値以前を含む） | `boolean` |
| `deleteSelection()` | 選択モード かつ `IDLE` かつ ドラッグ中でない かつ 選択集合が空でない → `model.deleteShapes(selectedIds)` | 受理したら`true` |
| `cancelDraftOrClearSelection()` | ドラッグ中なら`false`。`DRAWING`なら`model.cancelDraft()`して`IDLE`へ → `true`。選択モード かつ `IDLE` かつ 選択集合が空でない → `model.clearSelection()` → `true`。それ以外は何もせず`false` | 受理したら`true` |
| `selectAll()` | 選択モード かつ `IDLE` かつ ドラッグ中でない → `model.setSelection(全図形のid)`（変更通知1回。図形0個なら空集合で置き換え） | 受理したら`true` |

* 現行`handleKeyDown`は`state === IDLE`のみで判定しており、選択モードの中ボタンパン中（`state`は`IDLE`のまま）にも削除できてしまう。`deleteSelection()`では「ドラッグ中でない」を条件に加えてREQの定義に揃える（挙動の厳格化。懸念事項に記載）。

### 要件3: ショートカットの責務配置
* キー解釈（対応表と受理判定）は`InputTracker`に追加せず、新設クラス`js/core/KeyboardShortcuts.js`へ置く（REQの第一候補を採用）。`core/`に置く理由：キー入力→`InputTracker`・`ViewTransform`・UI同期の複数層に横断する入力の振り分けであり、自己完結UI部品（`palette/`）ではないため。
* `KeyboardShortcuts`の責務は**キー→操作の対応づけと受理判定のみ**。操作の実体はすべて注入コールバック経由で実行し、`VectorModel`・`ViewTransform`・ボタン要素を直接操作しない。
* **keydownの担当分け（排他）**:

| イベント | キー | 担当 | 備考 |
| --- | --- | --- | --- |
| `document` `keydown` | `Space` | `InputTracker.handleKeyDown` → `#handleSpaceKeyDown` | スペースパン（既存のまま。テキスト入力中は何もしない） |
| `document` `keydown` | `Space`以外の全キー（対応表のキー） | `KeyboardShortcuts` | `Delete`/`Backspace`を含む。`InputTracker.handleKeyDown`からは削除する |
| `document` `keyup` | `Space` | `InputTracker.handleKeyUp` | 既存のまま（ボタンのスペース誤クリック抑止を維持） |
| `document` `keyup` | その他 | なし | `KeyboardShortcuts`は`keyup`を購読しない |

* `InputTracker.handleKeyDown`は`Space`以外を一切解釈しない形（`if (event.code !== 'Space') return;`）へ縮退させる。`Delete`/`Backspace`の移管は、`KeyboardShortcuts`の配線（`main.js`）と**同一タスク**で行い、削除キーが効かない・二重に処理される中間状態を作らない（タスク6）。それまでの間、`handleKeyDown`の`Delete`/`Backspace`分岐は`deleteSelection()`の呼び出しへ置き換えておく（タスク2）。
* 対応表は`SHORTCUT_BINDINGS`の1箇所のみ。新しいショートカットはエントリ追加（＋必要なら注入コールバックの追加）で済む。

### 要件4: テキスト入力中の誤作動防止
* 判定は`InputTracker.js`のexport関数`isTextInputElement(element)`を再利用する。**配置は`InputTracker.js`のまま**とし、`KeyboardShortcuts.js`は`./InputTracker.js`からimportする（ファイルの移動・新設をせず、参照元の追従漏れリスクを避けるため）。
* **`input`要素の`type`別判定を採用する**。`element instanceof HTMLInputElement`の場合、`element.type`（プロパティ。小文字に正規化され、`type`属性なし・未知の値は`'text'`になる）がモジュール定数`TEXT_INPUT_TYPES`に含まれるときのみテキスト入力とする。
  * テキスト入力扱い（`TEXT_INPUT_TYPES`）: `text`（属性なし・未知値を含む）, `search`, `email`, `url`, `tel`, `password`, `number`, `date`, `datetime-local`, `month`, `time`, `week`（日付・時刻系は数字キー・`Backspace`による直接入力を受け付けるため含める）。
  * テキスト入力扱いしない: `checkbox`, `radio`, `range`, `color`, `button`, `submit`, `reset`, `file`, `image`, `hidden`。
  * `textarea`・`contenteditable`はテキスト入力扱い、`select`は対象外（現行どおり）。
* テキスト入力中は、全ショートカット（`KeyboardShortcuts`の判定手順2）とスペースパン（`#handleSpaceKeyDown`の既存判定）がともに動作せず、`preventDefault()`もしない。
* 確認用の入力欄は置かない（発注者決定）。入力欄追加時の確認項目は5章に列挙する。

### 要件5: 回帰防止
* `InputTracker`のマウス・ホイール系ハンドラ、`setMode`/`setShapeType`、`DragTracker`の利用方法は変更しない。`handleKeyDown`は`Space`分岐のみ残し、`#handleSpaceKeyDown`・`handleKeyUp`は変更しない（フォーカス中ボタンへの`Space`誤クリック抑止を維持）。
* `applyMode`/`applyShapeType`/`syncZoomDisplay`/`renderCurrentState`の本体は変更しない。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./` - `index.html`（削除ボタン・`.tool-btn:disabled`スタイル・`title`属性）
    *   `./js/` - `main.js`（エントリポイント：削除ボタン・ショートカットの配線、削除ボタン状態同期、キャンバス中心ズーム）
    *   `./js/core/` - 横断的な入力処理（`InputTracker.js`の公開メソッド追加・`keydown`担当縮小・`isTextInputElement`判定変更・`WHEEL_ZOOM_STEP`のexport、`KeyboardShortcuts.js`新設）
*   **関連する論理クラス**:
    *   `KeyboardShortcuts`（新設）: キー→操作の対応表（`SHORTCUT_BINDINGS`）と受理判定（IME・テキスト入力中・修飾キー・ドラッグ中・キーリピート・`preventDefault()`条件）。
    *   `InputTracker`（更新）: 公開メソッド`isDragging()`/`deleteSelection()`/`cancelDraftOrClearSelection()`/`selectAll()`の追加、`keydown`は`Space`のみ、`isTextInputElement`の`type`別判定、`WHEEL_ZOOM_STEP`のexport。
    *   `main.js`（更新）: `syncDeleteButtonState()`、`zoomAtCanvasCenter(direction)`、`KeyboardShortcuts`の生成と操作コールバックの注入。
    *   変更しない（参照のみ）: `VectorModel`（`deleteShapes`/`setSelection`/`clearSelection`/`cancelDraft`/`getSelectedIds`/`getShapes`/`onChange`）、`ViewTransform`（`zoomAt`/`reset`/`onChange`）、`DragTracker`（`isActive`）、`PaletteController`、`WindowManager`。

### 参照する責務
*   **main.js** : アプリケーションのエントリポイント。`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`のインスタンス化とイベントバインドを担う。`applyMode(mode)`で操作モード切替を一元管理する（`modeButtons`（キーは`OperationMode`の値）へのエントリ追加のみで新規モードボタンに対応）。`applyMode`は`InputTracker.setMode`呼び出し後に`getMode()`で実状態を読み返して`.active`を同期し、パレットの活性（図形作成モード時のみ）と図形種別ハイライトを`paletteController.setEnabled`/`setActiveType`へ委譲する。図形種別の切替は`applyShapeType(type)`（パレットの`onTypeSelected`コールバック）が担う。起動時に`applyMode(OperationMode.SELECT)`でUI初期表示を同期し、初期化の最後に`renderCurrentState()`と`syncZoomDisplay()`を明示的に1回呼ぶ（通知の副作用に依存させない）。`viewTransform.onChange`に`renderCurrentState`と`syncZoomDisplay`を登録する。リセットボタン`#view-reset`は`viewTransform.reset()`を呼ぶのみ（操作モード・選択集合には触れない）。倍率表示・リセットボタンは`modeButtons`に含めない（`.active`の対象外）。
*   **VectorModel.js** : 描画データ（Shape配列）と選択集合を保持する単一の真実（SSOT）。選択集合API（`setSelection(ids)`＝現存idのみで置き換え/`clearSelection()`/`getSelectedIds()`＝描画順の新しい配列/`isSelected(id)`）、ドラフトAPI（`cancelDraft`等）、`getShapes()`を持つ。`deleteShapes(ids)`は削除した図形のidを選択集合・ホバー状態からも除去し、変更通知は1操作につき1回（対象が1件以上の場合のみ）。DOMには触れない。
*   **ViewTransform.js** : ビュー変換状態（倍率・オフセット）を保持する唯一のクラス。変換式はここにのみ実装する。`zoomAt(sx, sy, factor)`はスクリーン座標中心のズーム（倍率は0.1〜10.0にクランプ、クランプ時も中心のワールド点は不変）、`reset()`は倍率1.0・オフセット(0,0)への復帰。値が変化した場合のみ`onChange`リスナーへ通知する。DOMには依存しない。
*   **InputTracker.js** : ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・一括削除・パン・ズーム）の解釈とModel・ビュー変換への反映、およびカーソル形状のフィードバック。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`の5状態の状態遷移マシン。操作モード（`OperationMode`＝`'select'`/`'create'`/`'pan'`）と図形種別（`SHAPE_TYPES`、初期値`'line'`）を独立に保持し、定数`OperationMode`/`SHAPE_TYPES`をexportする。`setMode(mode)`は選択集合/ホバーのクリアと進行中操作の強制中断（ドラッグセッションの中断・範囲選択の破棄・IDLE復帰、作成途中図形の破棄）を伴い、`setShapeType(type)`は作成途中の図形のみ破棄する（未知の値は`console.warn`して無視）。図形種別のif/switch分岐は行わない。`DragTracker`を生成・所有し、パン・左ドラッグのライフサイクルを委譲する。`document`購読の`keydown`ハンドラを持ち、現状は選択モード・`IDLE`状態で選択集合が空でない状態での`Delete`/`Backspace`押下で`deleteShapes`により一括削除する（本作業で`KeyboardShortcuts`へ移管）。スペース押下状態は`keyup`・`blur`で解除する。ホイールズームは1刻み`WHEEL_ZOOM_STEP`（約1.1倍）でカーソル位置中心に`ViewTransform.zoomAt`へ委譲する。テキスト入力中判定ヘルパー`isTextInputElement(element)`をexportし、スペースキーの誤爆防止に用いる。`InputTracker`は`main.js`の関数を呼ばない（依存方向は`main.js`→`InputTracker`）。
*   **DragTracker.js** : 1回のドラッグ操作のライフサイクルを担う。`isActive()`でセッション中（閾値以前を含む）かを返す。`InputTracker`のみが所有・利用する（本作業で変更しない）。
*   **PaletteController.js** : 図形選択パレット（直線・曲線・弧・矩形・円の5ボタン）の配線を担う自己完結UI部品。`setEnabled(enabled)`/`setActiveType(type)`を持つ。操作モードの知識は持たない（本作業で変更しない）。
*   **WindowManager.js** : `.float-window`のドラッグ移動・最前面化・イベント遮断（mousedown/click/mousemove/mouseupのstopPropagation）を担うDOM統治専任クラス（本作業で変更しない。`keydown`には関与しない）。
*   **index.html** : スタイルはCSSファイル分割せず`<style>`タグに内包する。`.disabled`はフロートウィンドウ全体を非活性化（`pointer-events: none`）するクラスであり、ボタン単体の押せない状態には用いない。
*   **PROJECT_CONSTITUTION.md 3章** : 全`.js`ファイルの先頭行に単一責務のJSDoc（3行以内）を記述し、その責務を逸脱するロジックを追記しない。クラス・関数・メソッド・データ構造にはJSDocを記述する。Vanilla JS（ES Modules）のみ、グローバル汚染禁止。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 フォルダ構造**: `js/core/`配下に`KeyboardShortcuts.js`を追記する（`InputTracker.js`の直後を想定）。
*   **3章 操作フロー**: 「入力監視」の項に**キーボード操作**の小項目を追加する。内容：`document`の`keydown`は`Space`を`InputTracker`（スペースパン）、それ以外を`KeyboardShortcuts`（対応表`SHORTCUT_BINDINGS`と受理判定）が排他的に担当すること。受理判定の順序（IME変換中→テキスト入力中→対応表照合（修飾キー・Shift規則）→ドラッグ中→キーリピート→コールバック実行、戻り値`true`のときのみ`preventDefault()`）。操作の実体は`main.js`の注入コールバック（`applyMode`/`applyShapeType`/`viewTransform`/`InputTracker`の公開メソッド）で実行され、UI同期は既存経路（`applyMode`・`viewTransform.onChange`・`model.onChange`）のみを通ること。
*   **4章 main.js**: 削除ボタン`#selection-delete`（`modeButtons`に含めない。`click`で`inputTracker.deleteSelection()`を呼ぶのみ）、`syncDeleteButtonState()`（`model.onChange`に登録し、起動時初期化の最後に明示的に1回呼ぶ。選択集合が空なら`disabled`）、`zoomAtCanvasCenter(direction)`（キャンバス中心のスクリーン座標と`WHEEL_ZOOM_STEP`で`viewTransform.zoomAt`へ委譲）、`KeyboardShortcuts`の生成と操作コールバック（`isDragging`/`setMode`/`setShapeType`/`zoomStep`/`resetView`/`cancel`/`selectAll`/`deleteSelection`）の注入を追記する。数字キー・全選択時のモード自動切替は`main.js`のコールバックが`applyMode`経由で行うことを明記する。
*   **4章 InputTracker.js**: 「`document`購読の`keydown`ハンドラを持ち、…`Delete`/`Backspace`押下で…一括削除する」の記述を、「`keydown`は`Space`（スペースパン）のみを解釈する。ショートカットの解釈は`KeyboardShortcuts`が担う」に改める。状態依存の公開メソッド`isDragging()`/`deleteSelection()`（受理条件：選択モード・`IDLE`・ドラッグ中でない・選択集合が空でない。削除ボタンとショートカットの唯一の削除経路）/`cancelDraftOrClearSelection()`/`selectAll()`を追記する。`isTextInputElement`の判定を`input`の`type`別（`TEXT_INPUT_TYPES`）に改め、スペースパンとショートカットの両方の誤爆防止に用いることを追記する。`WHEEL_ZOOM_STEP`をexportし、キーボードの拡大・縮小でも共有することを追記する。
*   **4章 KeyboardShortcuts.js（新規項目）**: キー→操作の対応表（`SHORTCUT_BINDINGS`。図形種別のエントリは`SHAPE_TYPES`の並びから生成）と受理判定のみを担う。`event.code`でキーを識別し、`Ctrl`は`Meta`と同一視、`Alt`押下時は常に不一致、Shiftは拡大・縮小のみ許容。テキスト入力中・ドラッグ中は受け付けず`preventDefault()`もしない。キーリピートは拡大・縮小のみ実行（`Ctrl`系の非リピートエントリはリピート時`preventDefault()`のみ）。操作の実体は`main.js`から注入されたコールバックへ委譲し、`VectorModel`・`ViewTransform`・`InputTracker`インスタンス・DOMのボタン要素を参照しない（`InputTracker.js`からは定数`OperationMode`/`SHAPE_TYPES`と関数`isTextInputElement`のみをimport）。`keyup`は購読しない。
*   **（タスク3で追記）4章 index.html**: ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`（半透明・`cursor: default`）で表し、`.tool-btn`のホバー色は`:hover:not(:disabled)`で押せる状態のみに限ること（フロートウィンドウ全体用の`.disabled`クラスとの使い分け）を追記する。各ボタンの`title`属性にショートカットキーを併記しており、`SHORTCUT_BINDINGS`との手動同期が必要であることを追記する。
*   **（タスク5で追記）4章 KeyboardShortcuts.js / 3章 入力監視**: 上記「4章 KeyboardShortcuts.js（新規項目）」の「テキスト入力中・ドラッグ中は受け付けず`preventDefault()`もしない」「`Ctrl`系の非リピートエントリはリピート時`preventDefault()`のみ」の記述は、追加仕様により「テキスト入力中・ドラッグ中は受け付けない。`preventDefault()`は受理したキーのみ行うが、`ctrl: true`のエントリがドラッグ中またはキーリピートで実行されなかった場合は例外として`preventDefault()`のみ行う（ブラウザのズーム・ページ全選択の抑止）」に改めて反映すること。3章の受理判定の順序の記述も同様（ドラッグ中→キーリピートは1つの判定にまとめた）。
*   **（タスク6で追記）4章 InputTracker.js**: ファイル先頭の責務定義を「ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈とModel・ビュー変換への反映、状態依存の操作（一括削除・取消・全選択）の公開、およびカーソル形状のフィードバック」に改めたため、資料の`InputTracker.js`の責務記述（「一括削除」を入力解釈の一部として列挙している箇所）も同趣旨に揃えること。
*   **（タスク6で追記）4章 main.js**: キーボードショートカットの配線は節「8. キーボードショートカット配線」として起動時初期化の直前に置いた。`KeyboardShortcuts`のインスタンスは`WindowManager`と同様に変数へ保持しない。`selectAll`コールバックは`inputTracker.selectAll()`の戻り値によらず常に`true`を返す（図形0個でもページ全選択を防ぐ）。
*   **（タスク7で追記）全体の確認結果**: 上記の各項目以外に、資料へ反映が必要な新たな影響は見つからなかった。タスク8では、「4章 KeyboardShortcuts.js（新規項目）」「3章 入力監視」はタスク5の追記内容（`preventDefault()`の例外の一元化）を優先して反映すること。また、4章`InputTracker.js`の`deleteSelection()`の説明は「削除ボタンと`Delete`/`Backspace`ショートカット（`KeyboardShortcuts`→`main.js`の注入コールバック経由）の唯一の削除経路」と書くこと（`InputTracker`自身はキーを解釈しない）。`main.js`の先頭の責務定義は変更していないため、資料側の`main.js`の責務記述（エントリポイント・インスタンス化とイベントバインド）も追記のみで足りる。
*   ※各タスク実行時に追加の影響が判明した場合は、本欄へ追記する（資料本体への反映はタスク8でのみ行う）。

## 3. タスクリスト
*   [x] タスク1: `isTextInputElement`の`type`別判定化と`WHEEL_ZOOM_STEP`のexport
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   モジュール定数`TEXT_INPUT_TYPES`（`Object.freeze`した配列：`text`, `search`, `email`, `url`, `tel`, `password`, `number`, `date`, `datetime-local`, `month`, `time`, `week`）を`isTextInputElement`の直前に追加し、JSDocで「テキスト入力扱いとする`input`の`type`一覧」「扱わない`type`の例（`checkbox`/`radio`/`range`/`color`/`button`/`submit`/`reset`/`file`/`image`/`hidden`）」「`element.type`プロパティは`type`属性なし・未知の値で`'text'`を返すため、それらもテキスト入力扱いになる」ことを記述する。
        *   `isTextInputElement(element)`を、`HTMLInputElement`なら`TEXT_INPUT_TYPES.includes(element.type)`、`TEXTAREA`なら`true`、`isContentEditable`なら`true`、それ以外（`select`を含む）は`false`を返す実装へ変更する。JSDocを「スペースパンとショートカット（`KeyboardShortcuts`）の誤爆防止に用いる」「`input`は`type`別に判定する」内容へ更新し、「Phase 02-04で再利用する想定」「`type`を問わずテキスト入力扱い（保守的な判定）」の旧記述を削除する。
        *   既存定数`WHEEL_ZOOM_STEP`を`export const`に変更し、JSDocに「キーボードショートカットの拡大・縮小（`main.js`）でも同値を用いる（刻み幅を重複定義しないため共有する）」旨を追記する。値・名称は変更しない。
        *   この時点では呼び出し元（`#handleSpaceKeyDown`・`handleKeyUp`）は変更しない。アプリの挙動に変化がないこと（スペースパンが従来どおり動くこと）を確認する。
*   [x] タスク2: `InputTracker`へ状態依存の公開メソッドを追加し、既存の削除キー処理を`deleteSelection()`へ置き換え
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   「公開API（モード・図形種別）」区切りの後に、新しい区切りコメント「公開API（状態依存の操作：削除・取消・全選択）」を設け、以下の4メソッドを追加する（いずれもJSDoc必須。受理条件・Modelへの変更通知回数・戻り値の意味を明記）。
            *   `isDragging()`: `this.#drag.isActive()`を返す。JSDoc「ドラッグ中＝パン・左ドラッグのセッション中（閾値以前を含む）。ショートカットの受理判定（`KeyboardShortcuts`）に用いる」。
            *   `deleteSelection()`: 受理条件「選択モード かつ `IDLE`状態 かつ ドラッグ中でない かつ 選択集合が空でない」をこのメソッド内でのみ判定し、受理時は`this.model.deleteShapes(selectedIds)`（変更通知1回）を呼んで`true`、非受理時は何もせず`false`を返す。JSDocに「削除ボタン（`main.js`）と`Delete`/`Backspace`ショートカットの唯一の削除経路。呼び出し側で条件を重複判定しないこと」「ドラッグ中は受け付けない（ドラッグ対象の図形が消えたまま追従が続くことを防ぐため）」を記述する。
            *   `cancelDraftOrClearSelection()`: (1)ドラッグ中なら`false`、(2)`DRAWING`状態なら`this.model.cancelDraft()`で作成途中の図形を破棄して`IDLE`へ戻し`true`、(3)選択モード かつ `IDLE` かつ 選択集合が空でなければ`this.model.clearSelection()`して`true`、(4)それ以外は何もせず`false`。JSDocに「`Esc`ショートカットの実体。`false`の場合、呼び出し側は`preventDefault()`しない」を記述する。
            *   `selectAll()`: 受理条件「選択モード かつ `IDLE` かつ ドラッグ中でない」。受理時は`this.model.setSelection(this.model.getShapes().map((shape) => shape.id))`（変更通知1回。図形0個なら空集合で置き換え）を呼び`true`、非受理時は`false`。JSDocに「選択モード以外からの全選択は、呼び出し側（`main.js`）が先に`applyMode`で選択モードへ切り替える（本クラスは`main.js`の関数を呼ばない）」を記述する。
        *   `handleKeyDown`の`Delete`/`Backspace`処理を、`if ((event.key === 'Delete' || event.key === 'Backspace') && this.deleteSelection()) { event.preventDefault(); }`相当へ置き換え、モード・状態・選択集合の判定を`handleKeyDown`から取り除く（`Space`分岐はそのまま先頭に残す）。この時点ではキー処理は引き続き`InputTracker`が担当する（タスク6で移管）。JSDocを実態に合わせて更新する。
        *   `deleteSelection()`の条件に「ドラッグ中でない」が加わることで、選択モードの中ボタンパン中・スペースパン中の削除が受け付けられなくなる（REQの定義への準拠。詳細作業内容に記録する）。
        *   `currentMode`のJSDoc（「`handleKeyDown`の入力解釈を排他的に切り替える」）を実態に合わせて調整する。
*   [x] タスク3: `index.html`へ削除ボタン・`:disabled`スタイル・ショートカットの`title`属性を追加
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   `#mode-pan`ボタンと`.view-zoom-row`の間に`<button type="button" id="selection-delete" class="tool-btn" title="選択中の図形を削除 (Delete / Backspace)" disabled>🗑 削除</button>`を追加する。
        *   `<style>`に`.tool-btn:disabled { opacity: 0.4; cursor: default; }`を追加し、`.tool-btn:hover`を`.tool-btn:hover:not(:disabled)`に変更する（押せないボタンのホバー色変化を防ぐ）。`.disabled`クラスには手を加えない。ルールの直前に用途を示すCSSコメントを付ける。
        *   `title`属性を付与する：`#mode-select`=`選択 (V)`、`#mode-create`=`図形作成 (P)`、`#mode-pan`=`キャンバス移動 (H)`、`#view-reset`=`表示をリセット (Ctrl+0)`、`#palette-line`=`直線 (1)`、`#palette-curve`=`曲線 (2)`、`#palette-arc`=`弧 (3)`、`#palette-rect`=`矩形 (4)`、`#palette-circle`=`円 (5)`。ボタンの表示文字列は変更しない。
        *   この時点で削除ボタンは常に`disabled`（未配線）であり、他の挙動に変化がないことを確認する。コントロールパネルの高さが増えても図形パレット（`top: 320px`）と重ならないことを目視確認し、重なる場合は詳細作業内容・懸念事項に記録する（`#window-shape-palette`の`top`を調整する場合はその値と理由を記録）。
*   [x] タスク4: `main.js`へ削除ボタンの配線と押せる/押せない状態の同期を追加
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   倍率表示・リセットボタンの取得箇所の近くで`const deleteSelectionBtn = document.getElementById('selection-delete');`を取得する（コメントで`modeButtons`に含めない＝`.active`の対象外であることを明記）。
        *   ローカル関数`syncDeleteButtonState()`を追加する：`deleteSelectionBtn.disabled = model.getSelectedIds().length === 0;`。JSDocに「選択集合が空なら押せない状態（HTMLの`disabled`属性）にする」「`model.onChange`へ登録し、起動時にも明示的に1回呼ぶ（通知の有無に依存しない）」「DOM更新は`main.js`が担い、`VectorModel`・`InputTracker`はDOMに触れない」「選択集合は操作モード切替でクリアされるため、図形作成・キャンバス移動モード中は常に押せない状態になる（モード別の分岐は不要）」を記述する。
        *   `model.onChange(syncDeleteButtonState);`を登録する。
        *   `deleteSelectionBtn.addEventListener('click', () => inputTracker.deleteSelection());`を追加する（受理条件は`deleteSelection()`内のみ。コメントで`model.deleteShapes`を直接呼ばないことを明記）。
        *   起動時初期化の最後（`renderCurrentState()`・`syncZoomDisplay()`の後）に`syncDeleteButtonState();`を明示的に1回呼び、既存コメントと同じ趣旨のコメントを付ける。
        *   範囲選択で複数選択→削除ボタン押下で全削除され、再び押せない状態に戻ること、`Delete`/`Backspace`キー（この時点では`InputTracker`担当）でも同様に動作しボタン状態が追従することを確認する。
*   [x] タスク5: `KeyboardShortcuts.js`の新設（対応表と受理判定。この時点では未配線）
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 新規
    *   **作業内容** :
        *   先頭行に責務JSDoc（3行以内）を記述する。例：「責務：キーボードショートカットのキー→操作の対応表と、keydownの受理判定（IME変換中・テキスト入力中・修飾キー・ドラッグ中・キーリピート・preventDefaultの要否）のみを担う。操作の実体はmain.jsから注入されたコールバックへ委譲する。」
        *   `import { OperationMode, SHAPE_TYPES, isTextInputElement } from './InputTracker.js';`（定数・関数のみ。インスタンスは参照しない）。
        *   `@typedef ShortcutBinding`（`codes: string[]`＝`event.code`の一覧、`ctrl: boolean`＝`Ctrl`または`Meta`を要するか、`allowShift: boolean`、`repeatable: boolean`、`action: string`＝注入コールバック名、`arg?: *`）と、`@typedef ShortcutActions`（`isDragging(): boolean`、`setMode(mode): boolean`、`setShapeType(type): boolean`、`zoomStep(direction: 1|-1): boolean`、`resetView(): boolean`、`cancel(): boolean`、`selectAll(): boolean`、`deleteSelection(): boolean`。戻り値`true`＝受理（`preventDefault()`する））をJSDocで定義する。
        *   モジュール定数`SHORTCUT_BINDINGS`（`Object.freeze`）を2章の対応表どおりに定義する。図形種別のエントリは`SHAPE_TYPES.map(...)`で`Digit{n}`/`Numpad{n}`から生成し、JSDocに「`SHAPE_TYPES`の並び＝図形パレットの並び順であることを前提とする」「`Space`は含めない（スペースパンは`InputTracker`の担当で、同一キーの二重解釈を避けるため）」「同一の`code`・修飾キーの組み合わせに一致するエントリが2件以上存在しないこと」「新しいショートカットはエントリ追加で対応する」を記述する。
        *   `export class KeyboardShortcuts`：
            *   `constructor(actions)`：`ShortcutActions`を受け取り、`isDragging`と対応表の全`action`名が関数として存在するか検証し、欠けていれば`Error`をthrowする。`document.addEventListener('keydown', ...)`で購読する（`keyup`は購読しない）。
            *   private`#handleKeyDown(event)`：2章「受理判定」の手順1〜6をこの順で実装する。JSDocに判定順序、`preventDefault()`する条件（コールバックが`true`を返した場合、および`ctrl: true`かつ`repeatable: false`のエントリのキーリピート時のみ）としない条件（IME変換中・テキスト入力中・対応表に一致なし・ドラッグ中・修飾キーなしエントリのキーリピート・コールバックが`false`）を明記する。
            *   private`#findBinding(event)`：対応表を走査し、`codes.includes(event.code)`かつ修飾キー規則（`Alt`押下は常に不一致／`ctrl`の真偽と`ctrlKey || metaKey`の一致／`allowShift: false`なら`shiftKey`が偽）を満たす最初のエントリを返す（なければ`null`）。キー識別・修飾キー判定はこのメソッドのみで行い、操作ごとのif分岐を持たない。JSDocに`event.code`採用の理由（大文字小文字・Shift併用・配列・IMEの影響を受けにくい）、`Meta`を`Ctrl`と同一視すること（macOS対応）、Shift規則を記述する。
        *   図形種別・操作モードごとのif/switch分岐を書かない（`action`名によるコールバック呼び出しのみ）。
        *   この時点では`main.js`から生成しないため、アプリの挙動に変化はない（構文エラーがないことのみ確認）。
*   [x] タスク6: `KeyboardShortcuts`の配線と`Delete`/`Backspace`の移管（同時実施）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `main.js`：`import { KeyboardShortcuts } from './core/KeyboardShortcuts.js';`を追加し、`InputTracker.js`からのimportに`WHEEL_ZOOM_STEP`を追加する。
        *   `main.js`：ローカル関数`zoomAtCanvasCenter(direction)`を追加する（`viewTransform.zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, direction > 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP)`のみ）。JSDocに「ズーム中心は表示中キャンバスの中心（スクリーン座標：キャンバス左上基準のCSSピクセル）」「変換式・クランプは`ViewTransform.zoomAt`へ委譲」「再描画・倍率表示は`viewTransform.onChange`経由」「刻み幅はホイール1刻みと同じ`WHEEL_ZOOM_STEP`」を記述する。
        *   `main.js`：`applyMode`/`applyShapeType`の定義・`modeButtons`のリスナー登録の後、起動時初期化（`applyMode(OperationMode.SELECT)`）の前に`new KeyboardShortcuts({...})`を生成し、2章「操作の実体」の表どおりのコールバックを注入する（`setShapeType`は図形作成モード以外なら先に`applyMode(OperationMode.CREATE)`、`selectAll`は選択モード以外なら先に`applyMode(OperationMode.SELECT)`。いずれも`inputTracker.getMode()`で判定）。各コールバックの戻り値（`true`＝受理）と、UI同期が`applyMode`/`applyShapeType`/`viewTransform.onChange`/`model.onChange`の既存経路のみで行われることをコメント・JSDocで明記する。ショートカット専用のUI同期・再描画呼び出しを書かない。
        *   `InputTracker.js`：`handleKeyDown`を`Space`のみ解釈する形（`if (event.code !== 'Space') { return; }`→`#handleSpaceKeyDown(event)`）へ縮退させ、タスク2で残した`Delete`/`Backspace`分岐を**確実に削除**する。JSDocを「`keydown`は`Space`（スペースパン）のみを解釈する。それ以外のキー（`Delete`/`Backspace`を含む）は`KeyboardShortcuts`が担当し、同一キーを二重に解釈しない」に更新する。
        *   `InputTracker.js`：ファイル先頭の責務JSDoc・クラスJSDocを実態に合わせて確認・更新する（キーボードはスペースパンのみ解釈し、削除・取消・全選択は公開メソッドとして提供する旨。先頭JSDocは3行以内を維持）。`currentMode`のJSDocから`handleKeyDown`への言及を除く。
        *   動作確認：`V`/`P`/`H`/`1`〜`5`/`Ctrl`+`0`/`Ctrl`+`=`・`Ctrl`+`;`・`Ctrl`+`Shift`+`;`・テンキー`+`/`Ctrl`+`-`・テンキー`-`/`Esc`/`Ctrl`+`A`/`Delete`/`Backspace`の各操作と、ボタン操作時と同じUI同期が行われること、削除が1回だけ行われること（二重処理がないこと）、スペースパンが従来どおり動くことを確認する。
*   [x] タスク7: JSDoc・責務定義の確認、および懸念事項・開発資料更新予定の整理
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 確認（必要なら更新）
        *   `./js/core/InputTracker.js` : 確認（必要なら更新）
        *   `./js/main.js` : 確認（必要なら更新）
        *   `./_log/res/261031_2121_RES_Phase02-04_Delete_UI_And_Shortcuts.md` : 更新
    *   **作業内容** :
        *   改修対象の全`.js`ファイルについて、先頭行の単一責務JSDoc（3行以内）が改修後の実態と一致しているか確認し、必要なら更新する（`main.js`は「各モジュールの初期化と連携(依存性の注入)」のままで整合する想定）。
        *   追加・変更したクラス・関数・メソッド・定数・typedefにJSDocの記載漏れがないことを確認する。特に、ショートカットの対応表（`SHORTCUT_BINDINGS`）、受理条件（修飾キー・Shift規則・テキスト入力中・ドラッグ中・キーリピート・IME変換中）、`preventDefault()`する/しない条件、`isTextInputElement`のテキスト入力扱いとする`type`一覧、および`deleteSelection()`の受理条件がJSDocから読み取れることを確認する。
        *   `InputTracker.js`・`main.js`内で本作業により実態と合わなくなった記述（キー処理の担当、Phase 02-04の予告記述等）が残っていないか確認する。
        *   各タスクで判明した`PROJECT_ARCHITECTURE.md`への影響を「開発資料の更新予定」欄へ追記し（資料本体は修正しない）、実装中に判断に迷った点・目視確認推奨箇所・将来の注意点を「懸念事項・要確認ポイント」欄へ追記する。
        *   本RESの「4. 詳細作業内容」の全タスク分が記入済みであることを確認し、作業レポートとして完成させる。
*   [x] タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映（固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   本RESの「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」欄（各タスクで追記された内容を含む）を確認し、資料へ反映する：1章フォルダ構造への`KeyboardShortcuts.js`の追記、3章「入力監視」へのキーボード操作（担当分け・受理判定の順序・UI同期経路）の追記、4章`main.js`（削除ボタン・`syncDeleteButtonState`・`zoomAtCanvasCenter`・`KeyboardShortcuts`の配線）、4章`InputTracker.js`（公開メソッド追加・`keydown`は`Space`のみ・`isTextInputElement`の`type`別判定・`WHEEL_ZOOM_STEP`のexport）の更新、4章`KeyboardShortcuts.js`の新規項目の追加。
        *   資料の記述方針（内部ロジックの詳細は書かず、責務のマップ・索引に留める）に従う。
        *   ※ 実装AIによる開発資料の書き換えは本ワークフローにおいて原則禁止であるが、**この最終タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更で他タスクの前提が動く危険がないため）。タスク1〜7の中で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `isTextInputElement`の`type`別判定化と`WHEEL_ZOOM_STEP`のexport
*   **作業内容** :
    *   `./js/core/InputTracker.js`
        *   既存定数`WHEEL_ZOOM_STEP`を`export const`に変更（値`1.1`・名称は不変）。JSDocに「キーボードショートカットの拡大・縮小（`main.js`）でも同値を用いる（刻み幅を重複定義しないため共有する）」を追記。
        *   `isTextInputElement`の直前にモジュール定数`TEXT_INPUT_TYPES`（`Object.freeze`した配列：`text`, `search`, `email`, `url`, `tel`, `password`, `number`, `date`, `datetime-local`, `month`, `time`, `week`）を追加（exportしない）。JSDocに、テキスト入力扱いとする`type`一覧である旨、日付・時刻系を含める理由、含めない`type`の例（`checkbox`/`radio`/`range`/`color`/`button`/`submit`/`reset`/`file`/`image`/`hidden`）、`element.type`が`type`属性なし・未知の値で`'text'`を返すためそれらもテキスト入力扱いになる旨を記述。
        *   `isTextInputElement(element)`を、`HTMLInputElement`なら`TEXT_INPUT_TYPES.includes(element.type)`、`HTMLTextAreaElement`なら`true`、`HTMLElement`かつ`isContentEditable`なら`true`、それ以外（`select`・`null`を含む）は`false`の実装へ変更。`tagName`比較ではなく`instanceof`で判定した（`input`の`type`プロパティを型安全に読むため。`textarea`も同じ書き方に揃えた）。JSDocを「スペースパンとショートカット（`KeyboardShortcuts`）の誤爆防止に用いる」「`input`は`type`別に判定」へ更新し、「Phase 02-04で再利用する想定」「`type`を問わずテキスト入力扱い（保守的な判定）」の旧記述を削除。
        *   呼び出し元（`#handleSpaceKeyDown`・`handleKeyUp`・ホイール処理）は変更していない。
    *   **確認結果**
        *   `node --check`で構文エラーなし。
        *   ローカルHTTPサーバー（`127.0.0.1`）経由でアプリを起動し、コンソールエラーなし。ブラウザ上で動的importして判定結果を確認：`input`（`type`属性なし／`text`／未知値`foo`／`number`／`date`）→`true`、`checkbox`/`range`/`color`/`button`/`hidden`→`false`、`textarea`→`true`、`select`→`false`、`contenteditable`の`div`→`true`、`null`・`body`→`false`、`WHEEL_ZOOM_STEP`は`1.1`でexportされている。
        *   スペースキーの`keydown`を合成して確認：フォーカスなし（`body`）では従来どおり`preventDefault()`される（スペースパン処理が動作）、`input type="text"`フォーカス中は`preventDefault()`されない（従来どおり）。
        *   **挙動の変化**: `input type="checkbox"`等（非テキスト系）にフォーカス中の`Space`は、旧実装ではテキスト入力扱いでスペースパンが動作しなかったが、新実装ではスペースパンが動作し`preventDefault()`される（チェックボックスを`Space`で切り替えられない）。RES 5章「将来テキスト入力欄を追加した際の確認項目」に記載済みの想定どおりの変化。現状のUIに`input`要素は存在しないため、現行アプリの体感挙動への影響はない。

### タスク2: `InputTracker`へ状態依存の公開メソッドを追加し、既存の削除キー処理を`deleteSelection()`へ置き換え
*   **作業内容** :
    *   `./js/core/InputTracker.js`
        *   「公開API（モード・図形種別）」区切りの後（`getShapeType()`の直後）に区切りコメント「公開API（状態依存の操作：削除・取消・全選択）」を新設し、以下4メソッドをJSDoc付きで追加。
            *   `isDragging()`: `this.#drag.isActive()`を返す。JSDocに「ドラッグ中＝パン・左ドラッグのDragTrackerセッション中（閾値以前を含む）。`KeyboardShortcuts`の受理判定に用いる」を記述。
            *   `deleteSelection()`: 受理条件「選択モード かつ `IDLE` かつ ドラッグ中でない かつ 選択集合が空でない」をこのメソッド内のみで判定し、受理時`model.deleteShapes(selectedIds)`（変更通知1回）→`true`、非受理時は何もせず`false`。JSDocに「削除ボタン（`main.js`）と`Delete`/`Backspace`の唯一の削除経路。呼び出し側で条件を重複判定しないこと」「ドラッグ中（パン中を含む）は受け付けない理由」「`true`のときのみ呼び出し側が`preventDefault()`する」を記述。
            *   `cancelDraftOrClearSelection()`: (1)ドラッグ中→`false`、(2)`DRAWING`→`model.cancelDraft()`＋`IDLE`へ→`true`、(3)選択モード・`IDLE`・選択集合非空→`model.clearSelection()`→`true`、(4)それ以外→`false`。JSDocに判定順と「`false`の場合、呼び出し側は`preventDefault()`しない」を記述。
            *   `selectAll()`: 受理条件「選択モード かつ `IDLE` かつ ドラッグ中でない」。受理時`model.setSelection(全図形のid)`（変更通知1回。図形0個なら空集合で置き換え）→`true`、非受理→`false`。JSDocに「選択モード以外からの全選択は呼び出し側（`main.js`）が先に`applyMode`で切り替える（本クラスは`main.js`の関数を呼ばない）」を記述。
        *   `handleKeyDown`の`Delete`/`Backspace`処理を`if ((event.key === 'Delete' || event.key === 'Backspace') && this.deleteSelection()) { event.preventDefault(); }`へ置き換え、モード・状態・選択集合の判定を`handleKeyDown`から除去（`Space`分岐は先頭にそのまま残置）。JSDocを実態（Spaceは`#handleSpaceKeyDown`へ、`Delete`/`Backspace`は`deleteSelection()`へ委譲し`true`時のみ`preventDefault()`。受理条件は`deleteSelection()`のみが判定。`KeyboardShortcuts`への移管までの暫定）に更新。キー判定は従来どおり`event.key`のまま（タスク6で`KeyboardShortcuts`の`event.code`判定へ移管し、本分岐は削除する）。
        *   `currentMode`のJSDocから`handleKeyDown`への言及を除き、「`handleMouseMove`/`handleMouseDown`/`handleClick`の入力解釈、および状態依存の公開操作（`deleteSelection`/`cancelDraftOrClearSelection`/`selectAll`）の受理可否を切り替える」に調整。
        *   クラスJSDocの区切りコメント一覧に「公開API（状態依存の操作：削除・取消・全選択）」を追記（ファイル先頭の責務JSDocはタスク6で見直すため本タスクでは変更していない）。
    *   **確認結果**
        *   `node --check`で構文エラーなし。
        *   ローカルHTTPサーバー（`127.0.0.1`）経由でアプリを起動し、コンソールエラーなし。合成イベントで確認：図形作成モードでの`Delete`→非受理（`preventDefault()`なし）、選択モード・選択集合空での`Delete`→非受理、図形をクリック選択後に中ボタンパンを押下中の`Delete`→非受理（図形は残る）、パン終了後の`Delete`→受理（`preventDefault()`あり、図形が削除されホバー/カーソルが`default`に戻る）、2本目をクリック選択して`Backspace`→受理・削除、`Delete`/`Backspace`以外のキー→何もしない。
        *   スペースキーの`keydown`は従来どおり`preventDefault()`されカーソルが`grab`になり、`keyup`で解除されることを確認（スペースパン経路に変化なし）。
        *   `cancelDraftOrClearSelection()`・`selectAll()`・`isDragging()`はこの時点で呼び出し元がないため、実機での動作確認はタスク6で行う（コードレビューのみ）。
        *   **挙動の変化（計画どおり）**: 選択モードの中ボタンパン中（`state`は`IDLE`のまま）の`Delete`/`Backspace`削除が受け付けられなくなった（スペースパン中も同様）。スペースを押しているだけ（ドラッグしていない）状態は「ドラッグ中」ではないため、削除は受け付けられる。

### タスク3: `index.html`へ削除ボタン・`:disabled`スタイル・ショートカットの`title`属性を追加
*   **作業内容** :
    *   `./index.html`
        *   `#mode-pan`ボタンと`.view-zoom-row`の間に`<button type="button" id="selection-delete" class="tool-btn" title="選択中の図形を削除 (Delete / Backspace)" disabled>🗑 削除</button>`を追加（計画どおりの文字列。HTML上も初期`disabled`）。
        *   `<style>`の`.tool-btn:hover`を`.tool-btn:hover:not(:disabled)`へ変更し、直前にCSSコメント「押せる状態のボタンのみホバー色を変える」を付与。その直後に`.tool-btn:disabled { opacity: 0.4; cursor: default; }`を追加し、CSSコメントで「ボタン単体の押せない状態（HTMLの`disabled`属性）。フロートウィンドウ全体を非活性化する`.disabled`クラスとは別物」と明記。`.disabled`クラスは変更していない。
        *   `title`属性を付与：`#mode-select`=`選択 (V)`、`#mode-create`=`図形作成 (P)`、`#mode-pan`=`キャンバス移動 (H)`、`#view-reset`=`表示をリセット (Ctrl+0)`、`#palette-line`〜`#palette-circle`=`直線 (1)`／`曲線 (2)`／`弧 (3)`／`矩形 (4)`／`円 (5)`。ボタンの表示文字列は変更していない。
        *   `#window-shape-palette`の`top`は変更していない（下記確認結果のとおり重ならないため）。
        *   JSファイルは変更していない（削除ボタンは未配線のまま。配線はタスク4）。
    *   **確認結果**
        *   ローカルHTTPサーバー（`127.0.0.1`）経由でアプリを起動し、コンソールエラーなし。
        *   削除ボタン：`disabled`=`true`、計算後スタイル`opacity: 0.4`・`cursor: default`。ホバー中も背景色が`rgb(250, 250, 250)`（通常色）のままで変化しないことを確認。押せる状態のボタン（`#view-reset`）はホバーで`rgb(238, 238, 238)`へ変化し、従来どおり。
        *   全`.tool-btn`の`title`が計画どおりであることをDOMから確認。
        *   レイアウト：コントロールパネル下端`296px`、図形パレット上端`320px`で、間隔`24px`（重なりなし）。スクリーンショットでも目視確認。
        *   「図形作成」ボタンのクリックで`.active`切替・パレット活性化が従来どおり動作し、削除ボタンは`disabled`のまま（未配線のため想定どおり）。

### タスク4: `main.js`へ削除ボタンの配線と押せる/押せない状態の同期を追加
*   **作業内容** :
    *   `./js/main.js`
        *   倍率表示・リセットボタンの取得箇所の直後で`const deleteSelectionBtn = document.getElementById('selection-delete');`を取得。コメント「modeButtonsには含めない：.activeの対象外」を付与（既存の倍率表示・リセットボタンのコメントと同じ書式）。
        *   リセットボタンのリスナー登録の直後に、ローカル関数`syncDeleteButtonState()`（`deleteSelectionBtn.disabled = model.getSelectedIds().length === 0;`）を追加。JSDocに「選択集合が空なら押せない状態（HTMLの`disabled`属性）」「`model.onChange`へ登録し起動時にも明示的に1回呼ぶ（通知の有無に依存しない）」「DOM更新は`main.js`が担い、`VectorModel`・`InputTracker`はDOMに触れない」「操作モード切替で選択集合がクリアされるため図形作成・キャンバス移動モード中は常に押せない（モード別分岐不要）」を記述。
        *   `model.onChange(syncDeleteButtonState);`を登録（`renderCurrentState`の登録とは別。`VectorModel`は複数リスナーを配列で保持するため両方が呼ばれる）。
        *   `deleteSelectionBtn.addEventListener('click', () => inputTracker.deleteSelection());`を追加。コメントで「受理条件の判定と削除は`deleteSelection()`のみが担う（Delete/Backspaceと同一経路。`model.deleteShapes`を直接呼ばないこと）」を明記。
        *   起動時初期化の最後（`renderCurrentState()`・`syncZoomDisplay()`の後）に`syncDeleteButtonState();`を明示的に1回呼び出し、既存の`syncZoomDisplay()`と同趣旨のコメント（`index.html`の初期`disabled`属性や`onChange`通知に依存させない）を付与。
        *   配置について：`syncDeleteButtonState`・`model.onChange`登録・clickリスナーは「6. フロートパネル（コントロールパネル）配線」節内（リセットボタン配線の直後）に置いた。`inputTracker`は節4で生成済みのため、この位置で参照可能。
        *   `InputTracker.js`・`index.html`・その他のファイルは変更していない（`applyMode`/`applyShapeType`/`syncZoomDisplay`/`renderCurrentState`の本体も不変）。
    *   **確認結果**
        *   `node --check js/main.js`で構文エラーなし。
        *   ローカルHTTPサーバー（`127.0.0.1`）経由でアプリを起動し、コンソールエラーなし。合成マウスイベント・`click()`・合成`keydown`で以下を確認（いずれも期待どおり）：
            *   起動直後：`disabled`＝`true`。図形作成モードで直線3本作成中も`true`。
            *   選択モードで直線をクリック選択→`false`（計算後`opacity: 1`、スクリーンショットで通常表示を目視確認）→削除ボタン押下で削除され`true`に戻る。削除した位置を再クリックしても選択されない（図形が消えている）。
            *   範囲選択で残り2本を複数選択→`false`→削除ボタン押下で全削除され`true`。その後同範囲を範囲選択しても`true`のまま（図形0個）。
            *   `Delete`（この時点では`InputTracker.handleKeyDown`担当）：受理され`preventDefault()`あり、ボタンは`true`へ追従。`Backspace`も同様。選択集合が空での`Delete`は非受理（`preventDefault()`なし）。
            *   選択中に「図形作成」→`true`、「キャンバス移動」→`true`、選択モードで再選択→`false`、空白クリックで選択解除→`true`。
        *   **検証時の注意**: 初回はブラウザのHTTPキャッシュにより旧`main.js`が読み込まれ、ボタンが追従しないように見えた（`encodedBodySize`で旧版と判明）。別ポートで再起動して最新版を読み込み直した上で上記を確認した。また、ブラウザペインが非表示の状態ではキャンバスのサイズが0×0となり当たり判定が効かないため、ビューポートを1200×800に明示して検証した。

### タスク5: `KeyboardShortcuts.js`の新設（対応表と受理判定。この時点では未配線）
*   **作業内容** :
    *   `./js/core/KeyboardShortcuts.js`（新規）
        *   先頭行に責務JSDoc（2行）：「キーボードショートカットのキー→操作の対応表と、keydownの受理判定（IME変換中・テキスト入力中・修飾キー・ドラッグ中・キーリピート・preventDefaultの要否）のみを担う。操作の実体はmain.jsから注入されたコールバックへ委譲する。」
        *   `import { OperationMode, SHAPE_TYPES, isTextInputElement } from './InputTracker.js';`（定数・関数のみ。インスタンスは参照しない）。
        *   `@typedef ShortcutBinding`（`codes`/`ctrl`/`allowShift`/`repeatable`/`action`/`arg?`）と`@typedef ShortcutActions`（`isDragging`＋7操作。戻り値`true`＝受理）をJSDocで定義。
        *   モジュール定数`SHORTCUT_BINDINGS`（exportしない）を2章の対応表どおりに定義。配列・各エントリとも`Object.freeze`。図形種別のエントリは`SHAPE_TYPES.map((type, i) => ...)`で`Digit{n}`/`Numpad{n}`から生成。JSDocに「`SHAPE_TYPES`の並び＝図形パレットの並び順が前提」「`Space`は含めない（理由）」「同一の`code`・修飾キーの組み合わせに一致するエントリを2件以上作らない（`#findBinding`は最初の一致を返す）」「新しいショートカットはエントリ追加で対応」「`index.html`の`title`属性と手動で一致させている」を記述。
        *   `export class KeyboardShortcuts`：
            *   `constructor(actions)`：`isDragging`と対応表の全`action`名（`Set`で重複除去）が関数かを検証し、欠けていれば欠落名を列挙した`Error`をthrow。検証後にprivate`#actions`へ保持し、`document`の`keydown`を購読（`keyup`は購読しない）。
            *   private`#handleKeyDown(event)`：手順1（`isComposing`）→2（`isTextInputElement(document.activeElement)`）→3（`#findBinding`、一致なしで終了）→4・5→6（`actions[binding.action](binding.arg)`が`true`のときのみ`preventDefault()`）の順で実装。
            *   **【追加仕様】手順4・5の一元化**：ドラッグ中（`isDragging()`）とリピート不可エントリのキーリピート（`event.repeat && !binding.repeatable`）を**1つの条件式**で判定し、該当時は`binding.ctrl`が`true`の場合のみ`preventDefault()`して終了（操作は実行しない）。`ctrl: false`のエントリは`preventDefault()`もしない。手順4・5で同じ判定を重複させていない。
            *   `#handleKeyDown`のJSDocに判定順序、`preventDefault()`の原則（受理したキーのみ）と、例外を「`ctrl: true`のエントリが、ドラッグ中（手順4）またはキーリピート（手順5）で実行されなかった場合」の1つにまとめて記載（`ctrl: false`のエントリは`preventDefault()`もしないことも明記）。
            *   private`#findBinding(event)`：`altKey`なら`null`。`ctrlKey || metaKey`とエントリの`ctrl`の一致、`allowShift || !shiftKey`、`codes.includes(event.code)`を満たす最初のエントリを返す（なければ`null`）。JSDocに`event.code`採用の理由、`Alt`常時不一致の理由、`Meta`＝`Ctrl`同一視、Shift規則を記述。
        *   図形種別・操作モードごとのif/switch分岐は書いていない（`action`名によるコールバック呼び出しのみ）。
        *   `main.js`・`InputTracker.js`・`index.html`は変更していない（未配線。配線はタスク6）。
    *   **確認結果**
        *   `node --check`で構文エラーなし。
        *   Node上で`document`・`HTMLElement`系をモックし、モジュールを読み込んで合成イベントで受理判定を確認（いずれも期待どおり）：
            *   コールバック欠落時：欠落名を列挙した`Error`がthrowされる。
            *   `V`→`setMode('select')`・`preventDefault()`あり／`Shift`+`V`・`Ctrl`+`V`→一致なし・`preventDefault()`なし／`Digit3`→`setShapeType('arc')`、`Numpad5`→`'circle'`。
            *   `Ctrl`+`0`→`resetView`／`Ctrl`+`Shift`+`;`→`zoomStep(1)`／`Meta`+`-`のリピート→`zoomStep(-1)`（リピートでも実行）。
            *   `Ctrl`+`A`のリピート→実行せず`preventDefault()`のみ／`V`のリピート→実行せず`preventDefault()`なし。
            *   `Esc`（コールバックが`false`）→`preventDefault()`なし／`Ctrl`+`Alt`+`A`→一致なし。
            *   ドラッグ中：`Ctrl`+`=`・`Ctrl`+`A`・`Ctrl`+`0`→実行せず`preventDefault()`のみ／`Delete`・`V`→実行せず`preventDefault()`なし。
            *   `textarea`フォーカス中の`V`・`Ctrl`+`A`、IME変換中の`V`→何もしない（`preventDefault()`なし）。
        *   ブラウザ上での実機確認は配線後（タスク6）に行う。

### タスク6: `KeyboardShortcuts`の配線と`Delete`/`Backspace`の移管（同時実施）
*   **作業内容** :
    *   `./js/main.js`
        *   `import { KeyboardShortcuts } from './core/KeyboardShortcuts.js';`を追加し、`InputTracker.js`からのimportに`WHEEL_ZOOM_STEP`を追加。
        *   `modeButtons`のリスナー登録の後、起動時初期化（`applyMode(OperationMode.SELECT)`）の前に新しい節「8. キーボードショートカット配線」を設けた。
        *   ローカル関数`zoomAtCanvasCenter(direction)`を追加（`viewTransform.zoomAt(canvas.clientWidth / 2, canvas.clientHeight / 2, direction > 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP)`のみ）。JSDocにズーム中心＝表示中キャンバスの中心（スクリーン座標：キャンバス左上基準のCSSピクセル）、変換式・クランプは`ViewTransform.zoomAt`へ委譲、再描画・倍率表示は`viewTransform.onChange`経由、刻み幅はホイール1刻みと同じ`WHEEL_ZOOM_STEP`、を記述。
        *   `new KeyboardShortcuts({...})`を生成し、2章「操作の実体」の表どおりに`isDragging`/`setMode`/`setShapeType`/`zoomStep`/`resetView`/`cancel`/`selectAll`/`deleteSelection`を注入（インスタンスは変数に保持していない。購読はコンストラクタ内で完結し、以後参照しないため）。`setShapeType`は`inputTracker.getMode()`が図形作成モードでなければ先に`applyMode(OperationMode.CREATE)`、`selectAll`は選択モードでなければ先に`applyMode(OperationMode.SELECT)`し`inputTracker.selectAll()`の戻り値によらず常に`true`。`cancel`/`deleteSelection`は`InputTracker`のメソッドの戻り値をそのまま返す。節冒頭のコメントで戻り値の意味（`true`＝受理）と、UI同期が`applyMode`/`applyShapeType`/`viewTransform.onChange`/`model.onChange`の既存経路のみであること（ショートカット専用のUI同期・再描画を書かない）を明記し、各コールバックにも1行コメント（どのボタン操作と同一経路か）を付与。
        *   引数なしエントリ（`resetView`/`cancel`/`selectAll`/`deleteSelection`）のコールバックは引数を受け取らない形で実装（タスク5の懸念事項どおり）。
        *   `applyMode`/`applyShapeType`/`syncZoomDisplay`/`renderCurrentState`/`syncDeleteButtonState`の本体は変更していない。
    *   `./js/core/InputTracker.js`
        *   `handleKeyDown`を`if (event.code !== 'Space') { return; }`→`this.#handleSpaceKeyDown(event);`へ縮退させ、タスク2で残した`Delete`/`Backspace`分岐（`event.key`判定）を削除。`InputTracker.js`内に`Delete`/`Backspace`/`event.key`を判定するコードが残っていないことをgrepで確認。JSDocを「keydownは`Space`（スペースパン）のみを解釈する。それ以外のキー（`Delete`/`Backspace`を含む）は`KeyboardShortcuts`が担当し、同一キーを二重に解釈しない」に更新。
        *   ファイル先頭の責務JSDoc（2行を維持）を「ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈とModel・ビュー変換への反映、状態依存の操作（一括削除・取消・全選択）の公開、および入力状態に応じたカーソル形状のフィードバック」に更新。
        *   クラスJSDocの「マウス・キーボード入力を解釈し」を「マウス入力とスペースキー（スペースパン）を解釈し」に改め、「Space以外のキー（ショートカット）は解釈しない。削除・取消・全選択は状態依存の公開メソッドとして提供し、削除ボタン・ショートカット（`KeyboardShortcuts`）からは`main.js`経由で呼び出される」の2行を追記。
        *   `currentMode`のJSDocはタスク2で`handleKeyDown`への言及を除去済みのため変更なし（確認のみ）。
    *   `index.html`・`KeyboardShortcuts.js`は変更していない。
*   **確認結果**
    *   `node --check`（`main.js`・`InputTracker.js`）で構文エラーなし。
    *   ローカルHTTPサーバー（`127.0.0.1`、新規ポートでキャッシュの影響を排除。`KeyboardShortcuts.js`がリソースとして読み込まれていることを確認）経由でアプリを起動し、コンソールエラーなし。ビューポート1200×800で、合成`keydown`・マウスイベントにより以下を確認（いずれも期待どおり）：
        *   起動直後：選択モード`.active`・パレット非活性・ハイライト`line`・`100%`・削除ボタン`disabled`。
        *   `P`→図形作成モード（パレット活性、記憶中の`line`）／`4`→矩形ハイライト／`H`→キャンバス移動モード（パレット非活性）／キャンバス移動モードで`3`→図形作成モード＋弧（モードボタン・パレットともに追従）／`V`→選択モード／選択モードで`Numpad5`→図形作成モード＋円。いずれも`preventDefault()`あり。
        *   `Shift`+`V`・`Ctrl`+`V`・`Alt`+`V`・`Shift`+`1`→何も起きず`preventDefault()`なし。
        *   `Ctrl`+`=`（110%）・`Ctrl`+`;`・`Ctrl`+`Shift`+`;`・`Ctrl`+テンキー`+`で拡大、`Ctrl`+`=`のリピートでも拡大、修飾キーなしのテンキー`+`→変化なし・`preventDefault()`なし。`Ctrl`+`-`・`Ctrl`+テンキー`-`・`Meta`+`-`で縮小。リピート連打で上限`1000%`にクランプ。倍率表示はすべて追従。
        *   `Ctrl`+`0`・`Ctrl`+テンキー`0`→`100%`（操作モードは選択モードのまま）。`Ctrl`+`0`のリピート→`preventDefault()`のみ。
        *   作成途中（`DRAWING`）の`Esc`→受理（`preventDefault()`あり）し、その位置に図形は残らない（後でクリック選択できない）。直後のクリックで新規作成を開始でき、作成した図形は選択可能。図形作成モード`IDLE`での`Esc`・選択集合が空の`Esc`→非受理（`preventDefault()`なし）。選択中の`Esc`→選択解除・削除ボタン`disabled`。
        *   図形作成モードから`Ctrl`+`A`→選択モードへ切替（`.active`・パレット非活性が追従）し全選択、削除ボタンが押せる状態に。`Ctrl`+`A`のリピート→`preventDefault()`のみ。図形0個での`Ctrl`+`A`→`preventDefault()`あり（ページ全選択なし）・削除ボタン`disabled`のまま。
        *   クリック選択した1本に`Delete`→その1本のみ削除され、他の図形は残る（二重処理なし）。`Ctrl`+`A`の後`Backspace`→全削除・削除ボタン`disabled`。選択集合が空の`Delete`・`Ctrl`+`Delete`→非受理・`preventDefault()`なし。
        *   **移管の確認**：全選択状態で`textarea`にフォーカスして`Delete`→削除されない（選択集合が残る）。`InputTracker`側に削除処理が残っていればここで削除されるため、`Delete`/`Backspace`の解釈が`KeyboardShortcuts`のみになったことを確認できた。同じく`textarea`フォーカス中の`P`・`Ctrl`+`A`→何も起きず`preventDefault()`なし。
        *   中ボタンパンのドラッグ中：`Delete`・`P`・`3`・`Esc`→何も起きず`preventDefault()`なし。`Ctrl`+`=`→倍率不変で`preventDefault()`のみ、`Ctrl`+`A`→`preventDefault()`のみ。ドラッグ終了後の`Backspace`→受理・削除。
        *   スペースパン：`Space`の`keydown`→`preventDefault()`ありカーソル`grab`、`keyup`で`default`に戻る（従来どおり）。スペース＋左ドラッグ中の`Delete`→非受理（選択集合は残る）。
    *   **未確認（目視推奨）**：ブラウザペインのスクリーンショットがタイムアウトしたため、画面描画の目視確認はできていない（判定は削除ボタンの状態・クリック選択の可否・DOMのクラス・倍率表示で行った）。また合成イベントのため、実キー入力でのブラウザズーム（`Ctrl`+`=`/`-`/`0`）・ページ全選択の抑止、IME変換中の挙動は未確認（5章テストプレイ項目参照）。

### タスク7: JSDoc・責務定義の確認、および懸念事項・開発資料更新予定の整理
*   **作業内容** :
    *   **先頭行の責務JSDoc（3行以内）の確認**
        *   `./js/core/KeyboardShortcuts.js`（2行）：対応表と受理判定のみ・操作の実体は注入コールバックへ委譲、で実装と一致。変更なし。
        *   `./js/core/InputTracker.js`（2行）：タスク6で更新済みの「キーはスペースパンのみ」「状態依存の操作（一括削除・取消・全選択）の公開」で実装と一致。変更なし。
        *   `./js/main.js`（1行）：「各モジュールの初期化と連携(依存性の注入)」のまま整合（削除ボタン配線・`KeyboardShortcuts`へのコールバック注入はいずれも連携・注入の範囲）。変更なし。
    *   **JSDocの記載漏れ確認**（いずれも記載あり。漏れなし）
        *   `KeyboardShortcuts.js`：`ShortcutBinding`/`ShortcutActions`のtypedef、`SHORTCUT_BINDINGS`（前提・`Space`除外・重複禁止・`title`との手動同期）、クラス、`#actions`、`constructor`（`@throws`）、`#handleKeyDown`（判定順序1〜6、`preventDefault()`の原則と唯一の例外、`ctrl: false`の扱い）、`#findBinding`（`event.code`採用理由・`Alt`不一致・`Meta`同一視・Shift規則）。IME変換中・テキスト入力中・ドラッグ中・キーリピートの受理条件がJSDocから読み取れることを確認。
        *   `InputTracker.js`：`WHEEL_ZOOM_STEP`（キーボードと共有）、`TEXT_INPUT_TYPES`（テキスト入力扱いの`type`一覧・扱わない例・`'text'`へのフォールバック）、`isTextInputElement`、`isDragging()`/`deleteSelection()`（受理条件4つ・変更通知1回・戻り値）/`cancelDraftOrClearSelection()`/`selectAll()`、`handleKeyDown`（`Space`のみ）、クラスJSDoc（区切りコメント一覧に新区切りを含む）、`currentMode`。
        *   `main.js`：`deleteSelectionBtn`のコメント、`syncDeleteButtonState`、`zoomAtCanvasCenter`、`KeyboardShortcuts`への注入（節冒頭コメント＋各コールバックの1行コメント）。
    *   **実態と合わない記述の確認**：`js/`配下を`02-04`/`Phase 02`/`Delete`/`Backspace`/`keydown`/`ショートカット`/`キー`でgrepし、旧来の「`InputTracker`が`Delete`/`Backspace`で削除する」旨やPhase 02-04の予告記述が残っていないことを確認（`KeyboardShortcuts.js`・`InputTracker.js`・`main.js`以外のファイルにはヒットなし）。`OperationMode.SELECT`のJSDocの「一括削除」は選択モードで可能な操作の列挙として現在も正しいため変更しない。
    *   **更新（1箇所）**：`./js/core/InputTracker.js`の`deleteSelection()`のJSDoc「削除ボタン（main.js）とDelete/Backspaceキーの唯一の削除経路」を「削除ボタン（main.js）とDelete/Backspaceショートカット（KeyboardShortcuts→main.jsの注入コールバック）の唯一の削除経路」へ改めた（キーを`InputTracker`自身が解釈していると誤読されないよう、経路を明示）。ロジックの変更なし。
    *   RESの整理：「4. 詳細作業内容」のタスク1〜7が記入済みであることを確認（タスク8は固定タスクのため未実施のまま）。「開発資料の更新予定」欄・「懸念事項・要確認ポイント」欄へタスク7の確認結果を追記。
*   **確認結果**
    *   `node --check`（`InputTracker.js`・`KeyboardShortcuts.js`・`main.js`）で構文エラーなし。JSDocコメントのみの変更のため、ブラウザでの動作確認は省略した（タスク6の確認結果から挙動は不変）。

### タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映（固定タスク）
*   **作業内容** :
    *   `./PROJECT_ARCHITECTURE.md`（「開発資料の更新予定」欄の全項目を反映。タスク5・7の追記内容を優先）
        *   **1章 フォルダ構造**: `js/core/`の`InputTracker.js`の直後に`KeyboardShortcuts.js`を追記。
        *   **3章 入力監視**: 見出しを「`InputTracker.js`・`KeyboardShortcuts.js` → `VectorModel.js`」とし、一括削除の手段（削除ボタン・`Delete`/`Backspace`）とキーボードショートカットを列挙に追加。小項目「キーボード操作」を新設し、`keydown`の担当分け（`Space`＝`InputTracker`／それ以外＝`KeyboardShortcuts`、`keyup`は`Space`のみ）、受理判定の順序（ドラッグ中とキーリピートは1つの判定として記載）、`preventDefault()`の原則と唯一の例外（`ctrl: true`エントリがドラッグ中・キーリピートで実行されなかった場合）、注入コールバック経由の実行と既存UI同期経路のみを通ることを記述。
        *   **4章 index.html（新規項目）**: 4章に`index.html`の項目が存在しなかったため、`main.js`の直前に新設。`<style>`内包、`.disabled`（フロートウィンドウ全体）と`disabled`属性＋`.tool-btn:disabled`（ボタン単体）の使い分け、`:hover:not(:disabled)`、`title`属性のショートカット併記と`SHORTCUT_BINDINGS`との手動同期の必要性を記述。
        *   **4章 main.js**: 既存段落の末尾に小項目「削除ボタン」（`#selection-delete`・`modeButtons`対象外・`inputTracker.deleteSelection()`のみ呼ぶ・`syncDeleteButtonState()`の登録と起動時の明示呼び出し・モード別分岐不要）と「キーボードショートカット配線」（節8の位置・注入する8コールバック・インスタンス非保持・数字キー/全選択のモード自動切替は`applyMode`経由・`selectAll`は常に`true`・`zoomAtCanvasCenter`・`resetView`）を追加。既存段落の本文は変更していない。
        *   **4章 InputTracker.js**: 冒頭の責務記述をコード先頭の責務定義（キーはスペースパンのみ・状態依存の操作の公開）と同趣旨に改めた。`keydown`の記述を「`Space`のみを解釈。ショートカットの解釈は`KeyboardShortcuts`が担う」に置き換え、小項目「状態依存の公開メソッド」（`isDragging`/`deleteSelection`（受理条件・唯一の削除経路をタスク7の指定文言で記載）/`cancelDraftOrClearSelection`/`selectAll`）を追加。「ズーム」に`WHEEL_ZOOM_STEP`のexportとキーボードとの共有を、`isTextInputElement`の項に`type`別判定（`TEXT_INPUT_TYPES`）とショートカットでの利用を追記。
        *   **4章 KeyboardShortcuts.js（新規項目）**: `InputTracker.js`の直後に新設。対応表と受理判定のみの責務、`event.code`・`Ctrl`/`Meta`同一視・`Alt`不一致・Shift規則、`SHAPE_TYPES`からの生成、`Space`除外、`preventDefault()`の例外（タスク5の内容）、コールバック注入と欠落時のthrow、参照しないもの・importするもの、`keyup`非購読、拡張方法を記述。内部ロジック（判定式・対応表の全キー）は書かず、JSDocを正とする方針に従った。
    *   ソースコード（`.js`・`index.html`）は変更していない。記述前に`main.js`・`KeyboardShortcuts.js`・`InputTracker.js`の識別子（`syncDeleteButtonState`・`zoomAtCanvasCenter`・`SHORTCUT_BINDINGS`・公開メソッド4つ・`WHEEL_ZOOM_STEP`のexport等）が実在することをgrepで確認した。
*   **確認結果**
    *   「開発資料の更新予定」欄の全項目（タスク3・5・6・7の追記分を含む）が資料に反映されていることを照合した。資料内に旧記述（「`InputTracker`が`Delete`/`Backspace`押下で一括削除する」、`isTextInputElement`の「input/textarea/contenteditable」一律判定）が残っていないことを確認。

## 5. 懸念事項・要確認ポイント
* **計画時の判断事項（REQで計画時に決めてよいとされた項目）**
    * Shift：修飾キーなしのショートカットと`Ctrl`+`0`/`Ctrl`+`A`は`Shift`押下時に反応しない。拡大・縮小のみ`Shift`を問わない（JIS配列の`Ctrl`+`Shift`+`;`対応のため）。
    * キー識別：`event.code`を採用。テンキーの`1`〜`5`（`Numpad1`〜`5`）・`Ctrl`+テンキー`0`も受け付ける。
    * キーリピート：拡大・縮小のみ実行。`Ctrl`+`0`・`Ctrl`+`A`のリピートは実行せず`preventDefault()`のみ行う（押しっぱなしでブラウザのズームリセット・ページ全選択が起きないため）。
    * **（タスク5で更新）`preventDefault()`原則の例外**：「受理しなかったキーは`preventDefault()`しない」原則の例外は、「`ctrl: true`のエントリが、ドラッグ中（手順4）またはキーリピート（手順5）で実行されなかった場合」の1つのみとし、このとき操作は実行せず`preventDefault()`のみ行う（ドラッグ中の`Ctrl`+`=`/`-`/`0`/`A`、押しっぱなしの`Ctrl`+`0`/`A`でブラウザのズーム・ページ全選択が起きないようにするため）。`ctrl: false`のエントリは手順4・5で実行されなかった場合も`preventDefault()`しない。判定は`#handleKeyDown`内の1箇所の条件式にまとめている。2章「受理判定」手順4・5および直下の「1・2・3・4で終了した場合は`preventDefault()`しない」の記述は、本項目の内容が優先する（追加仕様による変更）。
    * テンキーの`+`/`-`は`Ctrl`/`Meta`併用時のみ受け付ける（REQの「テンキーの`+`」を`Ctrl`+テンキー`+`と解釈）。修飾キーなしでのテンキー`+`/`-`による拡大・縮小が必要であれば、対応表へのエントリ追加で対応可能。
    * `isTextInputElement`の配置は`InputTracker.js`のまま（`KeyboardShortcuts.js`からimport）。`input`の`type`別判定を採用（一覧は2章要件4）。
    * 刻み幅は`InputTracker.js`の`WHEEL_ZOOM_STEP`をexportして共有する（名称は「ホイール」だがキーボードでも用いる。名称変更は本作業では行わない）。
* **挙動の変化（意図的）**
    * `deleteSelection()`に「ドラッグ中でない」条件が加わるため、選択モードで中ボタンパン・スペースパンをしながらの`Delete`/`Backspace`削除が受け付けられなくなる（現行は`state === IDLE`のみの判定でパン中も削除できた）。REQの「ドラッグ中」の定義への準拠。
    * `Delete`/`Backspace`は修飾キー（`Ctrl`/`Meta`/`Alt`/`Shift`）併用時に反応しなくなる（現行は修飾キーを問わず削除していた）。
    * `JIS`配列で`Ctrl`+`^`（`code`は`Equal`）でも拡大する。
* **（タスク1）非テキスト系`input`での`Space`**: `isTextInputElement`の`type`別判定化により、`checkbox`/`radio`/`range`/`color`/`button`等の`input`にフォーカス中の`Space`はスペースパン側で`preventDefault()`されるようになった（旧実装は全`input`をテキスト入力扱いしていたため何もしなかった）。現状`input`要素はUIに存在しないため影響はないが、将来チェックボックス等を追加した際は、キーボードでの切替可否を目視確認すること。
* **（タスク1）`TEXT_INPUT_TYPES`の保守**: HTML仕様に新しいテキスト系`type`が追加された場合でも、ブラウザ未対応の間は`element.type`が`'text'`を返すため安全側（テキスト入力扱い）に倒れる。ブラウザが新`type`を認識した時点で一覧に無いと非テキスト扱いになるため、その際は一覧への追加を検討すること。
* **（タスク2）スペース押下のみの状態での削除**: 「ドラッグ中」は`DragTracker`のセッション中のみを指すため、スペースを押しているだけ（左ドラッグ未開始）の状態では`Delete`/`Backspace`・`Esc`・`Ctrl`+`A`は受け付けられる。REQの「ドラッグ中」の定義どおりだが、スペース押下中も禁止したい場合は`isDragging()`の定義ではなく受理条件側で検討すること。
* **（タスク2）`cancelDraftOrClearSelection()`の`DRAWING`判定はモードを問わない**: `DRAWING`状態は図形作成モードでしか生じない前提（`setMode`で`IDLE`へリセットされる）のため、モード判定は加えていない。将来他モードで`DRAWING`相当の状態を持たせる場合は見直すこと。また、作成途中にパン（`DRAWING`保持のまま）している間の`Esc`は(1)のドラッグ中判定で拒否される（パン終了後に再度`Esc`が必要）。
* **（タスク2）暫定の`event.key`判定**: タスク2〜5の間、`InputTracker.handleKeyDown`の削除キー判定は旧来の`event.key`（修飾キーを問わない）のまま。タスク6で`KeyboardShortcuts`（`event.code`・修飾キー規則あり）へ移管する際、この分岐を確実に削除すること（二重削除は`deleteSelection()`の選択集合空判定で実害は出ないが、`preventDefault()`の二重化・責務の重複になる）。
* **（タスク5）ドラッグ中の`Ctrl`系の抑止範囲**: ドラッグ中に`preventDefault()`するのは対応表の`ctrl: true`エントリ（`Ctrl`/`Meta`+`=`・`;`・テンキー`+`・`-`・テンキー`-`・`0`・テンキー`0`・`A`）に一致したキーのみ。`Alt`併用（`#findBinding`で不一致）や対応表にない`Ctrl`系キー（`Ctrl`+`S`等）はドラッグ中もブラウザ既定動作のまま。また、ブラウザ・OSによっては`keydown`の`preventDefault()`でズームを抑止できない組み合わせがありうる点は既存項目「ブラウザズームの抑止」と同じ（目視確認推奨）。
* **（タスク5）`SHORTCUT_BINDINGS`はexportしていない**: 対応表は`KeyboardShortcuts.js`内部でのみ参照するためexportしていない。将来`title`属性の自動生成などで外部から参照する場合はexportを検討すること。
* **（タスク5）`arg`なしエントリの呼び出し**: `resetView`/`cancel`/`selectAll`/`deleteSelection`は`arg`を持たず、`actions[binding.action](undefined)`として呼ばれる。注入側（`main.js`、タスク6）のコールバックが引数を受け取る実装にしないこと（`deleteSelection`等へ`undefined`が渡っても現実装では無害）。
* **（タスク6）`selectAll`コールバックは常に`true`**: 選択モード以外からの`Ctrl`+`A`は、`applyMode(SELECT)`でモード切替を確定させた上で`inputTracker.selectAll()`を呼ぶ。`setMode`が進行中操作を強制中断し`IDLE`へ戻すため、`selectAll()`が非受理になるのはドラッグ中のみだが、ドラッグ中は`KeyboardShortcuts`の手順4で先に弾かれるため、実際にはモード切替後に非受理となる経路はない想定。仮に非受理でもモード切替だけが起き`preventDefault()`される（計画どおり。ページ全選択を防ぐため）。
* **（タスク6）`setShapeType`/`selectAll`のモード切替の副作用**: 数字キー・`Ctrl`+`A`によるモード自動切替は`applyMode`経由のため、ボタン操作と同じく選択集合のクリア・作成途中図形の破棄を伴う。図形作成モード中の数字キーはモード切替を伴わず`applyShapeType`のみ（作成途中図形のみ破棄。パレットと同一）。
* **（タスク6）`KeyboardShortcuts`のインスタンスを保持していない**: `main.js`は`new KeyboardShortcuts({...})`の戻り値を変数に保持していない（`WindowManager`と同じ扱い）。購読解除APIもないため、将来ショートカットの一時無効化（モーダル表示中など）が必要になった場合は、インスタンスの保持と有効/無効APIの追加を検討すること。
* **（タスク6）`zoomAtCanvasCenter`の中心座標**: `canvas.clientWidth / 2`・`clientHeight / 2`はキャンバス全体の中心であり、フロートウィンドウに隠れた領域を除いた「見えている領域」の中心ではない。キャンバスがブラウザペイン非表示等で0×0の場合は(0,0)中心になる（実害なし）。
* **図形種別一覧の多重管理について**: 数字キーの対応は`SHAPE_TYPES`の並びから生成するため、図形種別の文字列一覧の管理箇所は増やさない。ただし「`SHAPE_TYPES`の並び＝図形パレットのボタン順＝`index.html`の`title`属性の数字」という**並び順の暗黙の一致**に新たに依存する。図形種別の追加・並べ替え時は、`SHAPE_TYPES`・パレットのHTML・`title`属性の3箇所の並びを揃えること。
* **`title`属性と対応表の二重記載**: ボタンの`title`（例：`選択 (V)`）は`SHORTCUT_BINDINGS`と手動で一致させており、キー割り当ての変更時は`index.html`も更新が必要（対応表からの自動生成は本作業のスコープ外）。
* **`InputTracker.js`の行数**: 公開メソッド4つの追加でおよそ60〜80行増える一方、`handleKeyDown`の削除処理（約25行）が減る。いずれも`InputState`・ドラッグ・作成途中図形に依存する操作であり、REQ要件3の許容範囲とした。
* **カーソル形状**: `selectAll()`・`deleteSelection()`・`cancelDraftOrClearSelection()`の実行後、カーソル形状（`pointer`/`move`）は次の`mousemove`まで更新されない（キーボード操作ではカーソル位置が不明なため`#updateCursor()`を呼ばない方針。現行の`Delete`削除と同じ）。気になる場合は将来、最後のカーソル位置を保持して再評価する改修を検討。
* **フロートウィンドウのヘッダードラッグ中**: `WindowManager`のウィンドウ移動は`DragTracker`のセッションではないため「ドラッグ中」に含まれず、ショートカットは受け付けられる（状態の不整合は生じない想定）。
* **ブラウザズームの抑止**: `Ctrl`+`0`/`=`/`-`/`;`のブラウザズームは`keydown`の`preventDefault()`で抑止できる想定だが、ブラウザ・OSにより抑止できない組み合わせがありうる（特にmacOSの⌘系、`Ctrl`+テンキー）。目視確認を推奨。
* **コントロールパネルの高さ**: 削除ボタン追加でコントロールパネルが約41px高くなる。図形パレット（`top: 320px`）と重ならない見込みだが、タスク3で目視確認する。
    * **（タスク3）確認結果**: 追加後のコントロールパネル下端は`296px`、図形パレット上端`320px`との間隔は`24px`で重ならない（`top`の調整は不要と判断）。ただし余白は24pxしかなく、コントロールパネルにボタンをもう1つ（約41px）追加すると重なる。将来の追加時は`#window-shape-palette`の`top`の調整、またはパレット位置の自動配置を検討すること。なお計測はブラウザ既定のフォントで行ったため、フォント・OSのスケーリング設定により多少前後しうる。
* **（タスク3）`:disabled`とフォーカス**: `disabled`のボタンはクリック・フォーカスを受け付けないため、削除で選択集合が空になりボタンが`disabled`へ変わった時点でフォーカスはボタンから外れる想定（タスク4の配線後、テストプレイ項目「削除ボタンをクリックした直後の`Space`・`Enter`」で目視確認すること）。
* **（タスク4）削除ボタン押下後のフォーカス**: Chromeで削除ボタンにフォーカスした状態で押下すると、ボタンが`disabled`になった後も`document.activeElement`は削除ボタンのまま残ることを確認した（タスク3の「フォーカスは外れる想定」とは異なる）。`disabled`のボタンは`Enter`/`Space`でクリックされないため再削除は起きない想定だが、`Delete`/`Backspace`等のキー入力は`document`で受けるため影響なし。テストプレイ項目「削除ボタンをクリックした直後の`Space`・`Enter`」は実機の目視確認を推奨（合成イベントでは実クリック由来のフォーカス挙動を完全には再現できないため）。
* **（タスク4）`model.onChange`の通知頻度**: `syncDeleteButtonState`はホバー・ドラフト更新・範囲選択矩形の更新など選択集合と無関係な通知でも呼ばれる（`disabled`の代入のみで軽量なため最適化はしていない）。将来`onChange`に種類別通知を導入する場合は、選択集合の変化時のみ呼ぶ形へ寄せられる。
* **（タスク3）`title`属性の`Ctrl+0`表記**: macOSでは⌘+`0`でも動作する予定だが、`title`は`Ctrl+0`のみの表記とした（計画どおり）。OS別表記が必要になった場合は`title`の動的生成を検討すること。
* **（タスク7）責務定義の境界について**: `InputTracker.js`の先頭の責務定義は「状態依存の操作（一括削除・取消・全選択）の公開」を含む形になった。今後、状態（`InputState`・ドラッグ・作成途中図形）に依存しない操作（例：ビュー操作や図形の整列など）をショートカット用に追加する場合は、`InputTracker`へ公開メソッドを足さず、`main.js`の注入コールバック側か別クラスへ置くこと（`InputTracker`の肥大化防止）。
* **（タスク7）`main.js`の行数と節構成**: `main.js`は節「8. キーボードショートカット配線」の追加で約230行になった。ショートカットのコールバックが今後さらに増える場合は、注入オブジェクトの組み立てを別ファイルへ分離するかどうかを検討すること（現時点では先頭の責務「初期化と連携(依存性の注入)」の範囲内と判断し、分離していない）。
* **（タスク7）未実施の実機目視確認**: タスク6で記録したとおり、画面描画の目視確認と実キー入力（ブラウザズーム・ページ全選択の抑止、IME変換中、macOSの⌘系）による確認は未実施。下記「テストプレイでの目視確認項目」での確認を推奨する。
* **（タスク8）資料4章への`index.html`項目の新設**: 「開発資料の更新予定」には「4章 index.html」への追記とあったが、資料の4章には`index.html`の項目が存在しなかった（1章のフォルダ構造のコメントのみ）。そのため4章の先頭（`main.js`の直前）に`index.html`の項目を新設した。1章のコメント（`<style>`タグに内包）と内容が一部重複しているが、1章は「責務は4章をSSOTとする」方針のため、1章側は変更していない。配置位置・粒度が意図と異なる場合は調整すること。
* **（タスク8）資料3章「起動処理」の記述**: 3章1.の起動処理は従来から`VectorModel`/`CanvasManager`/`InputTracker`のみを列挙しており（`PaletteController`・`WindowManager`も未記載）、`KeyboardShortcuts`も追記していない（本作業の更新予定に含まれず、4章`main.js`に生成を記載済みのため）。3章の列挙を網羅的にする場合は別途整理すること。
* **テストプレイでの目視確認項目**
    * 起動直後、削除ボタンが押せない（半透明・ホバーで色が変わらない）。
    * 図形をクリック選択→削除ボタンが押せる→押すと削除され、再び押せない状態に戻る。
    * 範囲選択で複数選択→削除ボタンで全削除され、再び押せない状態に戻る。
    * 図形作成・キャンバス移動モードでは削除ボタンが常に押せない。
    * 削除ボタンをクリックした直後に`Space`・`Enter`を押しても、誤クリック・再削除が起きない（ボタンは`disabled`になりフォーカスが外れる想定。`Space`は`#handleSpaceKeyDown`の`preventDefault()`でクリックされない）。モードボタンをクリックした直後の`Space`も誤クリックが起きない。
    * `V`/`P`/`H`でモードが切り替わり、コントロールパネルの`.active`・パレットの活性/非活性がボタン操作時と同じく追従する。
    * `P`→`4`で矩形作成になり、パレットのハイライトが矩形へ追従する。
    * 選択モード（またはキャンバス移動モード）で`3`を押すと、図形作成モード＋弧になり、モードボタンとパレットのハイライトがともに追従する。テンキーの`1`〜`5`でも同様。
    * `Shift`+`V`・`Ctrl`+`V`・`Alt`+`V`、`Shift`+`1`等では何も起きない（`Ctrl`+`V`等のブラウザ動作も妨げない）。
    * `Ctrl`+`=`・JIS配列の`+`キー（`Ctrl`+`;`／`Ctrl`+`Shift`+`;`）・`Ctrl`+テンキー`+`で、ブラウザのズームではなくキャンバスのズームが変わり（表示中キャンバスの中心基準）、倍率表示が追従する。押しっぱなしで連続ズームする。
    * `Ctrl`+`-`・`Ctrl`+テンキー`-`で同様に縮小する。倍率の上限・下限（10%〜1000%）でクランプされる。
    * `Ctrl`+`0`（テンキー`0`含む）で倍率100%・初期表示位置に戻り、操作モード・選択集合は変わらない。押しっぱなしでもブラウザのズームリセットが起きない。
    * macOSで⌘+`=`/`-`/`0`/`A`が`Ctrl`と同じく動作する（環境があれば）。
    * 曲線（および他4種）の作成途中で`Esc`を押すと作成途中の図形が消え、次のクリックで新規作成を開始できる。
    * 選択モードで選択中に`Esc`を押すと選択がすべて解除され、削除ボタンが押せない状態になる。
    * `Ctrl`+`A`で全図形が選択され、ページが青く全選択されない。図形0個でもページ全選択が起きない。図形作成・キャンバス移動モードから`Ctrl`+`A`を押すと選択モードへ切り替わり（`.active`・パレット非活性が追従）、全図形が選択される。
    * `Delete`/`Backspace`で選択集合の全図形が1回だけ削除される（二重処理なし）。
    * ドラッグ中（本体ドラッグ・ハンドルドラッグ・範囲選択・中ボタンパン・スペースパン・キャンバス移動モードの左ドラッグ。閾値以前を含む）に`V`・`3`・`Esc`・`Ctrl`+`A`・`Delete`を押しても何も起きない。
    * ドラッグ中に`Ctrl`+`=`/`-`/`0`/`A`を押しても、ブラウザのズーム・ページ全選択が起きず、キャンバスも変化しない。
    * スペースパン・中ボタンパン・キャンバス移動モードのパン・ホイールズーム・リセットボタン・モードボタン・図形パレット・クリック選択・範囲選択・本体ドラッグ・ハンドル操作・図形作成5種が従来どおり動作する。
* **将来テキスト入力欄を追加した際の確認項目**（本作業では入力欄を置かないため未確認）
    * `input type="text"`（および`textarea`・`contenteditable`）にフォーカス中、`V`・`P`・`H`・数字（テンキー含む）・`Space`・`Delete`・`Backspace`・`Esc`が文字入力・文字削除として働き、ショートカット・スペースパンが発動しない。
    * 同じく、`Ctrl`+`A`が入力欄内の全選択として働き、`Ctrl`+`0`/`=`/`-`がブラウザ標準の動作（ブラウザズーム）になる（キャンバスのズームは変わらない）。
    * IME（日本語入力）で変換中の`Esc`・`Backspace`・数字キーが変換操作として働く（`isComposing`判定）。
    * `input type="number"`・日付系でも上記と同様に文字入力が妨げられない。
    * `input type="checkbox"`/`range`/`color`にフォーカス中はショートカットが効く（テキスト入力扱いしない）。ただし`Space`はスペースパン側で`preventDefault()`されるため、チェックボックスを`Space`で切り替えられない（現行のボタン誤クリック抑止と同じ扱い。問題になる場合は将来検討）。
    * `select`要素にフォーカス中は、ショートカットが効く一方で選択肢のキー移動とも競合しうる（現行どおり`select`はテキスト入力扱いしない）。
    * 入力欄からフォーカスを外した後、ショートカット・スペースパンが再び効く。スペースを押したまま入力欄へフォーカスを移した場合に、スペース押下状態が残留しない（`keyup`で解除される）。
