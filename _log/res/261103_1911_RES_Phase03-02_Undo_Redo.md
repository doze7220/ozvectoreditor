# RES: 作業計画・作業レポート (Phase 03-02) : Undo/Redo
* 参照元REQ: `./_log/req/261103_1904_REQ_Phase03-02_Undo_Redo.md`

## 1. 作業目的
現状、図形に対する操作（作成・削除・本体移動・ハンドルによる変形）は取り消すことができない。本作業では、Phase 03-01で確立した`DocumentSerializer`のオブジェクト層（`serialize`／`deserialize`）と`VectorModel.replaceAllShapes`を用い、編集操作の前後の図形一式を丸ごと記録する**スナップショット方式**のUndo/Redoを実装する。取り消し・やり直しは、キーボードショートカット（`Ctrl`+`Z`／`Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`）とコントロールパネルのボタンの両方から、同一の経路で実行できるようにする。

**用語**（REQの定義に従い、本RES・コード内JSDocで統一する）
* **編集操作**: 図形一式（図形の有無・頂点位置・描画順・図形データの内容）を変化させる、利用者の1回の操作。本作業の対象は要件2の一覧表のとおり。
* **履歴**: 編集操作の前後の状態を記録したもの。「取り消し（Undo）」で1つ前の状態へ戻し、「やり直し（Redo）」で取り消した状態を再び適用する。
* **スナップショット**: ある時点の図形一式を、作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）と、その時点の選択集合（図形idの配列）で表したもの。
* **履歴の適用**: 取り消し・やり直しによってスナップショットの状態をキャンバスへ反映すること。
* 作業データ形式・図形データ・シリアライズ／デシリアライズはPhase 03-01、選択集合・ホバー・作成中の図形・選択矩形はPhase 02-03、操作モードはPhase 02-01の定義に従う。座標はすべて「ワールド座標」と表記する。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
履歴の保持・記録・適用の制御は新設の`js/core/HistoryManager.js`（`HistoryManager`クラス）に置く。`HistoryManager`は**何もimportしない**。スナップショットの取得（`DocumentSerializer`・`VectorModel`を使う処理）と適用（`DocumentSerializer`・`VectorModel`・`InputTracker`を使う処理）は、`main.js`が関数として組み立ててコンストラクタへ注入する（`core/`から`io/`をimportしない。既存の依存方向`io → core → shapes`を維持するため）。

| 呼ぶ側 → 呼ばれる側 | 呼び出し内容 | 備考 |
| --- | --- | --- |
| `main.js` → `HistoryManager` | 生成（`capture`・`restore`の注入）、`undo()`／`redo()`／`canUndo()`／`canRedo()`／`onChange()`、`?dev`復元時の`beginEdit()`／`commitEdit()` | `clear()`は本作業では呼び出し元なし（Phase 03-04・03-05で接続） |
| `main.js` → `InputTracker` | 生成時に`HistoryManager`インスタンスを「編集操作の記録先」（`EditRecorder`）として注入、`isDragging()`／`abortOngoingOperation()`／`getMode()` | |
| `InputTracker` → `HistoryManager`（`EditRecorder`として） | `beginEdit()`／`commitEdit()`のみ | `InputTracker`は`HistoryManager.js`をimportしない（注入されたオブジェクトの2メソッドを呼ぶのみ） |
| `HistoryManager` → 注入関数`capture` | 編集操作の開始時・確定時にスナップショットを取得 | 実体は`main.js`：`DocumentSerializer.serialize(model.getShapes())`＋`model.getSelectedIds()` |
| `HistoryManager` → 注入関数`restore` | 取り消し・やり直しでスナップショットを適用 | 実体は`main.js`：`DocumentSerializer.deserialize`→`model.replaceAllShapes`→`model.setSelection` |
| `VectorModel` | 誰も呼ばない（履歴を知らない） | 変更なし |
| `DocumentSerializer` | 誰も呼ばない（履歴を知らない） | 変更なし |

```text
main.js ──生成・注入──▶ HistoryManager ◀──beginEdit/commitEdit── InputTracker
   │                        │ capture()/restore()（main.jsの関数）
   │                        ▼
   └──────────▶ DocumentSerializer ⇔ VectorModel（replaceAllShapes / setSelection）
```

### 要件1: 取り消し・やり直しの基本動作
* `HistoryManager`は履歴を「エントリ（`{ before: Snapshot, after: Snapshot }`）の配列`#entries`」と「適用済みエントリ数`#cursor`」で保持する。
  * 取り消し可能 ⇔ `#cursor > 0`。取り消しは`#entries[#cursor - 1].before`を適用し、成功したら`#cursor`を1減らす。
  * やり直し可能 ⇔ `#cursor < #entries.length`。やり直しは`#entries[#cursor].after`を適用し、成功したら`#cursor`を1増やす。
  * 新しいエントリの記録時は`#entries`を`#cursor`の位置で切り詰めてから追加する（＝やり直しの履歴の破棄）。
  * エントリに前後両方を持たせる理由：エントリ間で「前のafter」と「次のbefore」が一致しない場合（例：適用後に記録されない変化があった場合）でも、取り消し・やり直しがそれぞれ正しい状態へ戻るようにするため。
* **履歴の上限**: モジュール定数`HISTORY_LIMIT = 100`（`HistoryManager.js`のみで定義・export）。記録後に`#entries.length > HISTORY_LIMIT`なら先頭（最古）から捨て、`#cursor`を`#entries.length`に合わせる。
* **リセット**: 公開メソッド`clear()`＝「履歴を空にする」。全エントリ・記録中の編集操作（後述の`#pendingBefore`）を破棄し、取り消し・やり直しとも不可にする。図形一式・選択集合には触れない。変化があった場合のみ変更通知する。本作業では呼び出し元を作らない（要件6で`?dev`の復元は1件の編集操作として記録するため）。
* 履歴はメモリ上にのみ保持し、保存しない。

### 要件2: 編集操作の単位と記録経路
**記録API（トランザクション形式）**
* `beginEdit()`: 編集操作の開始を宣言する。この時点のスナップショットを`capture()`で取得し「前の状態」として`#pendingBefore`に保持する（既に保持中なら`console.warn`して上書き）。
* `commitEdit()`: 編集操作の確定を宣言する。`capture()`で「後の状態」を取得し、前後の**作業データ部分**が同一（`JSON.stringify`の結果が一致）なら記録せず`false`を返す（やり直しの履歴も破棄しない）。異なれば1件のエントリとして記録し、変更通知して`true`を返す。`#pendingBefore`がなければ`console.warn`して`false`。いずれの場合も`#pendingBefore`を破棄する。
  * 比較は作業データ全体の文字列比較のみで行い、図形種別の分岐・図形固有のプロパティ名を持ち込まない（`toJSON`は決定的にキーを並べるため文字列比較で足りる）。選択集合は比較対象に含めない（選択の変更のみは編集操作ではないため）。
* `model.onChange`の通知ごとに記録する方式は採らない。記録は`beginEdit()`／`commitEdit()`の明示呼び出しのみで行う。

**記録される操作と時点（一覧表）**

| 編集操作 | 呼び出し元 | `beginEdit()`の時点（前の状態） | `commitEdit()`の時点（後の状態） | 記録されない場合 |
| --- | --- | --- | --- | --- |
| 図形の作成 | `InputTracker.handleClick`（`DRAWING`状態の2回目のクリック） | `model.commitDraft()`の直前 | `model.commitDraft()`の直後 | 作成途中の開始・破棄（`Esc`・種別切替・モード切替・中断）は記録経路を通らない |
| 削除（削除ボタン・`Delete`・`Backspace`） | `InputTracker.deleteSelection()`（受理時のみ） | `model.deleteShapes(ids)`の直前 | `model.deleteShapes(ids)`の直後 | 非受理（選択集合が空・選択モード以外・ドラッグ中等）は記録経路を通らない |
| 本体ドラッグ・moveハンドルによる移動（`MOVING_SELECTION`） | `InputTracker`の左ドラッグ | 閾値超過時（`#onLeftDragStart`。まだ図形は動いていない） | ドラッグの終了・中断時（`#finishLeftDrag`。終了・中断の共通後始末） | 閾値以内で離した（`onStart`が呼ばれないため開始されない）／結果が開始前と同一（比較で不記録） |
| ハンドルドラッグによる変形（`DRAGGING_HANDLE`） | 同上 | 同上 | 同上 | 同上 |
| `?dev`の「JSONから復元」 | `main.js`の`onImport` | `abortOngoingOperation()`の後、`replaceAllShapes`の直前 | `replaceAllShapes`の直後 | 全体の読み込み失敗（`ok: false`）／復元前と同一内容 |

* 範囲選択（`MARQUEE_SELECTING`）・クリック選択・全選択・選択解除・ホバー・パン・ズーム・ビューのリセット・操作モード／図形種別の切り替えは記録経路を一切通らない。
* `InputTracker`の左ドラッグは、`beginEdit()`を呼んだかをprivateフラグ`#isEditOpen`で保持し、`#finishLeftDrag()`でフラグが立っていれば`commitEdit()`を呼んでフラグを下ろす（終了・中断のどちらでも1箇所で確定する）。
* **中断時の扱い（決定）**: ドラッグ中の中断（`window`の`blur`・`setMode`・`abortOngoingOperation`）で「ドラッグ中に反映済みの頂点・位置」が残った場合、**1件の編集操作として記録する**（中断も`#finishLeftDrag()`を通るため自然にそうなる）。理由：記録しないと、残った変化が次の編集操作の「前の状態」に含まれ、どの取り消しでも単独では戻せない変化になるため。懸念事項に記載する。
* 後続Phase（複製・貼り付け等）で編集操作が増えた場合は、変更処理を`beginEdit()`／`commitEdit()`で挟むだけで履歴の対象になる。

**「その時点の選択集合」の定義**
* 前の状態の選択集合＝`beginEdit()`呼び出し時（操作開始時）の選択集合。ドラッグでは閾値超過時点だが、押下からその時点まで選択集合は変化しないため、押下時の選択集合と同じ。
* 後の状態の選択集合＝`commitEdit()`呼び出し時（操作完了時）の選択集合。削除では削除後（空）、移動・変形では操作中の選択集合、`?dev`の復元では空。
* 図形作成モードでの作成は前後とも空（選択集合は選択モード以外で常に空）。

### 要件3: スナップショット方式と履歴の適用
* **スナップショットの型**（`HistoryManager.js`のJSDoc typedef `Snapshot`）: `{ document: DocumentData, selectedIds: string[] }`。`HistoryManager`は`document`の中身を解釈しない（比較のための文字列化のみ）。
* **取得（`main.js`の`captureSnapshot()`）**: `{ document: DocumentSerializer.serialize(model.getShapes()), selectedIds: model.getSelectedIds() }`。`serialize`は各図形の`toJSON()`で新しいオブジェクトを作り、`getSelectedIds()`は新しい配列を返すため、図形インスタンス・Modelの内部状態と共有しない。
* **独立性の保証**: `HistoryManager`は`capture()`の戻り値を、図形固有の知識を持たない汎用の再帰`Object.freeze`（private`#deepFreeze`）で凍結してから保持する。`deserialize`は引数を書き換えない契約であり、適用のたびに新しい図形インスタンスを生成するため、同じスナップショットを何度適用しても書き換わらない。将来マイグレーション関数が契約に反して引数を書き換えた場合は、凍結により（モジュールはstrict mode）例外となり、`deserialize`が全体の読み込み失敗として返す（後述の失敗時の扱いへ流れる）。
* **適用（`main.js`の`restoreSnapshot(snapshot)`。戻り値：適用したか）**:
  1. `DocumentSerializer.deserialize(snapshot.document)`。`ok: false`または`skipped`が1件以上なら、`console.warn`してキャンバスを変更せず`false`を返す。
  2. `model.replaceAllShapes(result.shapes)`（idはそのまま保持される。選択集合・ホバー・作成中の図形・選択矩形はクリアされる）。
  3. `inputTracker.getMode() === OperationMode.SELECT`のときのみ`model.setSelection(snapshot.selectedIds)`（現存しないidは`setSelection`が無視する）。選択モード以外では空のまま（既存の不変条件）。
  4. `true`を返す。
  * 進行中の入力操作の中断（`abortOngoingOperation()`）は`restoreSnapshot`内では行わず、取り消し・やり直しの操作経路（要件4）で適用より前に行う。
* **失敗時**: `HistoryManager.undo()`／`redo()`は`restore()`が`false`を返したら`#cursor`を動かさず、変更通知もせず`false`を返す（履歴・キャンバスとも変化しない）。
* **変更通知**: 1回の適用で`model.onChange`は2回（`replaceAllShapes`・`setSelection`）発火し、その後`HistoryManager`の変更通知が1回発火する。いずれも同期的に連続して実行されるため、途中の状態（選択未復元）がブラウザに描画されて残ることはない。再描画・削除ボタン・取り消し/やり直しボタンの同期はこれらの既存経路＋履歴変化の通知経路のみで行う。
* `VectorModel`は**変更しない**（`replaceAllShapes`＋`setSelection`の組み合わせで要件を満たせるため。選択集合付きの入れ替えAPIを追加すると、`VectorModel`が履歴の都合を知ることになる）。

### 要件4: 進行中の操作がある状態での取り消し・やり直し
`main.js`の履歴配線ブロック（要件7「履歴配線ブロックの位置」。`historyManager`生成行の後）に取り消し・やり直しの操作関数`performUndo()`／`performRedo()`を置き、ショートカットの注入コールバックとボタンのclickの**両方からこの関数を呼ぶ**（同一経路）。

```text
performUndo():
  (1) inputTracker.isDragging() なら何もせず false（ボタン経由でもショートカットと同じ受理条件）
  (2) inputTracker.abortOngoingOperation() が true なら（＝作成途中の図形を破棄した）、ここで終了して true
      （ドラッグ中でないことを(1)で確認済みのため、abortOngoingOperationが中断し得るのは作成途中の図形のみ）
  (3) historyManager.undo() を呼び、true を返す
performRedo():
  (1) 同上
  (2) inputTracker.abortOngoingOperation()（作成途中の図形があれば破棄。戻り値は使わない）
  (3) historyManager.redo() を呼び、true を返す
```
* 作成途中の図形がある場合の取り消しは破棄のみで履歴を変化させない（`Esc`と同じ結果）。もう一度押すと通常の取り消しになる。やり直しは破棄したうえでやり直す（やり直せる履歴がなければ破棄のみ）。
* `InputTracker`に新しい公開操作は追加しない（`abortOngoingOperation()`の再利用で足りる）。履歴の保持・適用は`InputTracker`に入れない。
* ドラッグ中のショートカットは`KeyboardShortcuts`の既存の受理判定（実行せず、`ctrl: true`のため`preventDefault()`のみ）に従う。
* テキスト入力中・IME変換中は既存の受理判定でショートカットが働かず、ブラウザ標準のテキスト入力の取り消しが働く（判定ロジックは変更しない）。
* **戻り値の扱い（決定）**: ドラッグ中でなければ、取り消し・やり直しできる履歴がなくても常に`true`（受理扱い）を返し、`preventDefault()`させる（ブラウザ標準の`Ctrl`+`Z`／`Ctrl`+`Y`等の動作を起こさないため。`selectAll`と同じ扱い）。

### 要件5: キーボードショートカットとボタン
**修飾キー規則の拡張（`KeyboardShortcuts.js`）**
* 対応表エントリの`allowShift: boolean`を、3値の`shift`プロパティへ置き換える。値はファイル内の凍結定数`ShiftRule`（exportしない）で表す。
  * `ShiftRule.FORBIDDEN`（`'forbidden'`）: `shiftKey`が偽であること（旧`allowShift: false`と同じ）
  * `ShiftRule.ANY`（`'any'`）: `shiftKey`を問わない（旧`allowShift: true`と同じ）
  * `ShiftRule.REQUIRED`（`'required'`）: `shiftKey`が真であること（新設）
* 既存エントリは機械的に置き換える（`allowShift: false`→`shift: ShiftRule.FORBIDDEN`、`allowShift: true`（拡大・縮小の2件）→`shift: ShiftRule.ANY`）。一致結果は変わらない（`Shift`+`V`等は引き続き`FORBIDDEN`で不一致＝予約のまま）。
* `#findBinding`のShift判定を3値で行う（`ANY`→常に一致、`REQUIRED`→`shiftKey`、`FORBIDDEN`→`!shiftKey`）。
* `ShortcutBinding` typedef・対応表・`#findBinding`のJSDocを更新する。

**追加エントリ**

| codes | ctrl | shift | repeatable | action |
| --- | --- | --- | --- | --- |
| `['KeyZ']` | true | `FORBIDDEN` | true | `undo` |
| `['KeyZ']` | true | `REQUIRED` | true | `redo` |
| `['KeyY']` | true | `FORBIDDEN` | true | `redo` |

* `ShortcutActions` typedefに`undo`・`redo`（`() => boolean`）を追加。Meta（⌘）はCtrlと同一視（既存規則）。同一code・修飾キーの組み合わせで重複しない（`KeyZ`はShiftの有無で排他）。

**ボタン（`index.html`）**
* 削除ボタンの直後（倍率表示行の前）に、1行に横並びの2ボタンを置く。
  ```html
  <div class="history-button-row">
      <button type="button" id="history-undo" class="tool-btn" title="取り消し (Ctrl+Z)" disabled>↶ 取り消し</button>
      <button type="button" id="history-redo" class="tool-btn" title="やり直し (Ctrl+Y / Ctrl+Shift+Z)" disabled>↷ やり直し</button>
  </div>
  ```
* `<style>`に`.history-button-row { display: flex; gap: 8px; }`と`.history-button-row .tool-btn { flex: 1; text-align: center; white-space: nowrap; }`を追加（パネル幅220pxの内側196pxに2ボタン＋余白8pxで収める）。押せない状態は既存の`.tool-btn:disabled`を用いる。
* **図形パレットの位置**: コントロールパネルの高さはボタン行1行（ボタン高さ約37px＋`gap`8px）分増え、下端が約296px→約341pxになる。`#window-shape-palette`の`top`を`320px`→`368px`へ下げ、余白を約27px（24px以上）確保する。自動配置はしない。

**押せる/押せない状態の同期（`main.js`）**
* `syncHistoryButtonState()`: 取り消しボタンは`!(historyManager.canUndo() || model.getDraftLine() !== null)`、やり直しボタンは`!historyManager.canRedo()`を`disabled`に設定する。
* `model.onChange`（作成途中の図形の有無の変化を拾う）と`historyManager.onChange`（記録・適用・リセットを拾う）の両方に登録し、起動時の最後に明示的に1回呼ぶ。`HistoryManager`はDOMに触れない。
* ボタンの`click`は`performUndo()`／`performRedo()`を呼ぶのみ（ショートカットと同一の操作関数・受理判定）。
* **置き場所（決定）**: ボタンの要素取得・`syncHistoryButtonState()`の定義・onChange登録・clickリスナー登録は、すべて既存の`// 6. フロートパネル（コントロールパネル）配線`セクション内に置く（削除ボタンと同じ扱い）。具体的な位置はタスク5に記載する。起動時の1回の呼び出しのみ、ファイル末尾の起動時初期化部分（`syncDeleteButtonState();`の直後）に置く。

### 要件6: `?dev`の「JSONから復元」の扱い
* `main.js`の`onImport`で、成功時のみ`inputTracker.abortOngoingOperation()`→`historyManager.beginEdit()`→`model.replaceAllShapes(result.shapes)`→`historyManager.commitEdit()`の順に呼ぶ（中断が先：ドラッグ中だった場合はその中断分が先に1件確定するため、`beginEdit()`は必ず中断の後に置く）。全体の読み込み失敗時は記録しない。`DevPanel.js`は変更しない。
* **例外の扱い（決定）**: `DevPanel.js`はコールバックの例外を捕捉しないため、`onImport`から例外が漏れると結果表示が更新されない。追加する`beginEdit()`／`commitEdit()`は、内部で`captureSnapshot()`（`DocumentSerializer.serialize(model.getShapes())`＝Modelが保持する図形の`toJSON()`のみ）と汎用の凍結・文字列比較を行うだけで、通常動作では例外を投げない想定である。このため`try/catch`は追加せず、`onImport`内に新たに例外を投げる処理（`throw`・独自の検証）も書かない。実装時に通常動作で例外が起こり得る経路を見つけた場合は、推測で`try/catch`を追加せず質問として報告する。

### 要件7: 履歴管理の置き場所（`js/core/HistoryManager.js`）
* 先頭行JSDoc（案）：「責務：編集操作の履歴（スナップショットの前後の組の列・取り消し/やり直しの位置・上限）の保持と、記録・取り消し・やり直し・リセット・可否の照会を担う。スナップショットの取得・適用の実体は注入された関数へ委譲し、DOM・図形種別・作業データの中身を知らない。」
* 公開API: `constructor({ capture, restore })`（関数でなければ`Error`をthrow）、`beginEdit()`、`commitEdit(): boolean`、`undo(): boolean`、`redo(): boolean`、`canUndo(): boolean`、`canRedo(): boolean`、`clear(): void`、`onChange(listener): void`。export：`HistoryManager`・`HISTORY_LIMIT`。
* `undo()`／`redo()`の冒頭で`#pendingBefore`が残っていれば`console.warn`して破棄する（通常は起こらない：ドラッグ中は受理されないため）。
* 変更通知は「履歴の状態（`canUndo`／`canRedo`に影響し得る列・位置）が変化したとき」のみ：記録時・適用成功時・`clear()`で実際に何かを破棄したとき。`beginEdit()`・不記録の`commitEdit()`では通知しない。
* `main.js`は現在約260行で、本作業で`captureSnapshot`・`restoreSnapshot`・`performUndo`・`performRedo`・`syncHistoryButtonState`とその配線（JSDoc込み）で約80〜100行増える見込み。注入オブジェクトはその場で組み立て、関数は1つの配線ブロック（「履歴（取り消し・やり直し）配線」）にまとめる。スコープ上新設ファイルは履歴管理ファイルのみのため、`main.js`の分割は行わず懸念事項に記載する。
* **履歴配線ブロックの位置（決定）**: 履歴配線ブロックは`main.js`内に**1つだけ**置き、位置は「`// 3. ViewTransform`の生成行の直後、`// 4. Controller (入力管理)`（`InputTracker`の生成）の直前」とする。見出しコメントは`// 3.5. 履歴（取り消し・やり直し）配線`とし、既存のセクション番号（4.〜9.）は振り直さない。ブロック内の並びは`captureSnapshot()`→`restoreSnapshot()`→`const historyManager = new HistoryManager(...)`→`performUndo()`→`performRedo()`とする（`performUndo`/`performRedo`はタスク4で**同じブロックの末尾（`historyManager`生成行の後）へ追記**する）。
  * 5関数はいずれも`function`宣言で書くが、**関数宣言の巻き上げには頼らない**：ブロックは利用箇所（6.の取り消し・やり直しボタンのclick登録、8.の`KeyboardShortcuts`への注入）より前にあるため、利用時点で宣言済みである。
  * `restoreSnapshot`・`performUndo`・`performRedo`は後で`const`宣言される`inputTracker`を本体内で参照するが、これらが**呼ばれる**のは起動完了後（取り消し・やり直しの実行時）のみで、宣言・生成時には呼ばれないため問題ない（一時的デッドゾーンに当たらない）。`InputTracker`の生成位置は移動しない。
* **生成順**: `HistoryManager`は`InputTracker`より先に生成する（`InputTracker`のコンストラクタへ注入するため）。`restoreSnapshot`・`performUndo`・`performRedo`は`inputTracker`（後で`const`宣言）を参照するが、呼ばれるのは起動完了後の取り消し・やり直し時のみであり、生成時には呼ばれない（JSDoc・コメントに明記）。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/` - 横断的な処理（履歴管理の新設、ショートカット、入力解釈）／`./js/` - エントリポイント／`./` - `index.html`
*   **関連する論理クラス**:
    *   `HistoryManager`（新設、`js/core/HistoryManager.js`）：履歴の保持・記録・取り消し・やり直し・リセット・可否照会
    *   `InputTracker`（変更）：編集操作の開始・確定を`EditRecorder`（注入）へ伝える
    *   `KeyboardShortcuts`（変更）：修飾キー規則の3値化、取り消し・やり直しのエントリ
    *   `main.js`（変更）：スナップショットの取得・適用関数の組み立て、取り消し/やり直しの操作関数、ボタン同期、`?dev`復元の記録
    *   `VectorModel`・`DocumentSerializer`（変更なし。利用のみ）

### 参照する責務
*   **main.js** : アプリケーションのエントリポイント。各クラスのインスタンス化・依存の注入とイベントバインドを担う。起動時に`applyMode(OperationMode.SELECT)`、初期化の最後に`renderCurrentState()`・`syncZoomDisplay()`・`syncDeleteButtonState()`を明示的に1回ずつ呼ぶ。削除ボタンの`click`は`inputTracker.deleteSelection()`を呼ぶのみ。押せる/押せない状態は`model.onChange`に登録した`syncDeleteButtonState()`が担う。キーボードショートカット配線では`KeyboardShortcuts`を生成し操作コールバック（`isDragging`/`setMode`/`setShapeType`/`zoomStep`/`resetView`/`cancel`/`selectAll`/`deleteSelection`）を注入する。`?dev`時のみ`DevPanel`を生成し、`onImport(text)`＝`DocumentSerializer.deserializeFromString(text)`の結果が成功のときのみ`inputTracker.abortOngoingOperation()`→`model.replaceAllShapes(result.shapes)`を行う。再描画・削除ボタンの同期は`model.onChange`経路に任せる。`window`へ公開しない。
*   **VectorModel.js** : 描画データ（Shape配列）と選択集合を保持する単一の真実（SSOT）。`setSelection(ids)`＝現存idのみで置き換え（通知1回）、`getSelectedIds()`＝描画順の新しい配列、`getDraftLine()`、`commitDraft()`、`deleteShapes(ids)`（通知1回）。`replaceAllShapes(shapes)`は全図形を入れ替え、有効なidは保持（重複・不正は振り直し、`#nextId`は保持idより大きく繰り上げ）、選択集合・ホバー状態・作成中図形・選択矩形をクリアし、変更通知は1回。進行中の入力操作は中断しない（呼び出し側が先に`InputTracker.abortOngoingOperation()`を呼ぶ）。同一インスタンスを配列に重複して渡さないこと。
*   **InputTracker.js** : ユーザー入力の解釈とModel・ビュー変換への反映、状態依存の操作（一括削除・取消・全選択・進行中操作の中断）の公開。図形種別のif/switch分岐は一切行わない。入力状態は`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`。`deleteSelection()`（受理条件：選択モード・`IDLE`・ドラッグ中でない・選択集合が空でない）は削除ボタンと`Delete`/`Backspace`の唯一の削除経路。`abortOngoingOperation()`（常に受理）はドラッグセッションと作成途中の図形を中断して`IDLE`へ戻し、最後にカーソルを再評価する（ドラッグ中に反映済みの頂点・位置は残る）。操作モード・図形種別・選択集合・ホバー状態は変更しない。戻り値は何かを中断したか。Phase 03-02の履歴適用の前処理としても再利用する前提。左ドラッグのライフサイクルは`DragTracker`に委譲し、`onStart`（閾値超過）・`onEnd`・`onCancel`は`#onLeftDragStart`・`#onLeftDragEnd`・`#onLeftDragCancel`が受け、終了・中断の後始末は`#finishLeftDrag()`に共通化されている。
*   **KeyboardShortcuts.js** : キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみを担う。判定順序は「IME変換中 → テキスト入力中 → 対応表照合（修飾キー・Shift規則）→ ドラッグ中またはキーリピート → コールバック実行」。キーは`event.code`、`Ctrl`は`Meta`と同一視、`Alt`押下時は常に不一致。`preventDefault()`はコールバックが`true`を返した場合のみ。例外として`ctrl: true`のエントリがドラッグ中・キーリピートで実行されなかった場合は`preventDefault()`のみ行う。コンストラクタで対応表の全action名の注入を検証し、欠落時は`Error`をthrowする。新しいショートカットは対応表へのエントリ追加（＋注入コールバックの追加）で対応する。
*   **DocumentSerializer.js** : 静的メソッドのみ・DOM非依存。`serialize(shapes)`は各図形の`toJSON()`から新しい作業データを返す。`deserialize(documentData)`は例外をthrowせず`DeserializeResult`（`{ ok, shapes, skipped, error }`）を返し、引数を書き換えない。マイグレーション関数は引数を書き換えてはならない（書き換えるとUndo履歴のスナップショットが壊れる）。依存方向は`io → core → shapes`の一方向。
*   **DevPanel.js** : 開発者向け確認用ウィンドウのDOM操作専任の自己完結UI部品。`onImport(text): ImportSummary`（`{ ok, restoredCount, reassignedCount, skipped: [{ index, type, reason }], error }`）を結果表示欄へ整形して表示する。コールバックの例外は捕捉しないため、`onImport`側の処理を増やす場合は例外を漏らさないこと（漏れると結果表示が更新されない）。
*   **index.html** : スタイルは`<style>`に内包。ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`で表す。各ボタンの`title`属性にショートカットキーを併記し、`SHORTCUT_BINDINGS`と手動で同期する。
*   **アーキテクチャ全般** : `CanvasManager`に状態を持たせない。`VectorModel`・`InputTracker`・`DocumentSerializer`・履歴管理はDOMに触れない。図形種別の対応づけは`ShapeFactory.js`の対応表のみ。`window`への公開禁止。再描画の経路は`model.onChange`・`viewTransform.onChange`・ウィンドウリサイズの3経路から`renderCurrentState()`。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**: フォルダ構造の`core/`に`HistoryManager.js`を追加。
*   **3章**: 1.起動処理のインスタンス化一覧に`HistoryManager`を追加。新項目「6. 履歴（取り消し・やり直し）」を追加：編集操作の確定から記録までの流れ（`InputTracker`／`main.js`が変更処理を`beginEdit()`／`commitEdit()`で挟む。記録される操作と時点の一覧、変化のない操作は作業データの文字列比較で不記録、中断で残った変化も1件として記録）と、適用の流れ（`performUndo`/`performRedo`：ドラッグ中は不受理→`abortOngoingOperation()`（取り消しは作成途中の破棄のみで終了）→`HistoryManager.undo()/redo()`→注入`restore`＝`deserialize`→`replaceAllShapes`→選択モード時のみ`setSelection`）。3.キーボード操作の「Shift規則」に3値化を反映。
*   **4章**:
    *   `HistoryManager.js`の項を新設（責務・公開API・`HISTORY_LIMIT`・エントリ構造・`Snapshot`型・凍結・比較方法・変更通知の条件・importなし・`capture`/`restore`注入）。
    *   `KeyboardShortcuts.js`：「Shift併用は拡大・縮小のみ許容」「キーリピートは拡大・縮小のみ実行」を更新（`shift`の3値規則、`Ctrl`+`Shift`+`Z`の`REQUIRED`、取り消し・やり直しもリピート可）。
    *   `InputTracker.js`：コンストラクタの第4引数`editRecorder`（`EditRecorder`＝`beginEdit`/`commitEdit`）と、編集操作の開始・確定の通知箇所（作成・削除・左ドラッグの閾値超過と`#finishLeftDrag`）、`#isEditOpen`。`abortOngoingOperation()`が履歴適用の前処理として実際に使われるようになったこと。
    *   `main.js`：履歴配線（`captureSnapshot`/`restoreSnapshot`/`performUndo`/`performRedo`/`syncHistoryButtonState`、履歴配線ブロックの位置（`ViewTransform`生成後・`InputTracker`生成前の1ブロック。ボタン関連はコントロールパネル配線内）、生成順の注意、`onImport`から例外を漏らさない方針、起動時の同期に`syncHistoryButtonState()`を追加、注入コールバックに`undo`/`redo`を追加、`onImport`の`beginEdit`/`commitEdit`）。
    *   `index.html`：取り消し・やり直しボタン行（`#history-undo`/`#history-redo`、`.history-button-row`）と図形パレットの`top: 368px`。
    *   `VectorModel.js`：変更なし（記述の変更不要。`replaceAllShapes`の「将来はUndo履歴」等の未来形の表現があれば現在形へ）。
    *   `DocumentSerializer.js`：「将来はUndo履歴のスナップショットが壊れる」の表現を現在形へ（記述のみ）。

## 3. タスクリスト
*   [x] タスク1: 履歴管理クラス`HistoryManager`の新設
    *   **対象ファイル** :
        *   `./js/core/HistoryManager.js` :（新規）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内。2章要件7の案）を記載する。importは持たない。
        *   定数`HISTORY_LIMIT = 100`をexportし、JSDocに「取り消せる編集操作の上限件数。超えたら最古から捨てる。唯一の定義箇所」と記載する。
        *   JSDoc typedef：`Snapshot`（`{ document: Object, selectedIds: string[] }`。`document`は作業データ形式のオブジェクトで本クラスは中身を解釈しないこと、`selectedIds`の時点の定義（前の状態＝操作開始時、後の状態＝操作完了時））、`HistoryEntry`（`{ before: Snapshot, after: Snapshot }`）、`HistoryCallbacks`（`capture: () => Snapshot`、`restore: (snapshot: Snapshot) => boolean`。`restore`は適用したら`true`、キャンバスを変更しなかったら`false`）。
        *   クラス`HistoryManager`を2章要件1・2・3・7のとおり実装する：privateフィールド`#capture`/`#restore`/`#entries`/`#cursor`/`#pendingBefore`/`#listeners`、`constructor({ capture, restore })`（関数でなければ`Error`）、`beginEdit()`、`commitEdit()`、`undo()`、`redo()`、`canUndo()`、`canRedo()`、`clear()`、`onChange(listener)`、private`#notifyChange()`、private`#takeSnapshot()`（`capture()`→`#deepFreeze`）、private static`#deepFreeze(value)`（オブジェクト・配列を再帰的に`Object.freeze`する汎用処理。プロパティ名を参照しない）。
        *   各メソッドのJSDocに、効果・受理条件・戻り値・変更通知の条件を記載する（特に：`commitEdit`の「作業データ部分の`JSON.stringify`比較で同一なら記録せずやり直しの履歴も破棄しない」、記録時のやり直しの履歴の破棄と上限超過時の最古の破棄、`undo`/`redo`の「`restore`が`false`なら位置を動かさない」、`clear`の「履歴を空にする。図形一式・選択集合には触れない。キャンバスを開く・新規作成時に呼ぶ前提（Phase 03-04・03-05で接続）」）。
        *   クラスJSDocに「DOMに触れない」「図形種別・図形固有のプロパティ名を持たない」「`model.onChange`ごとの記録は行わず、`beginEdit`/`commitEdit`の明示呼び出しでのみ記録する」「進行中の入力操作の中断は呼び出し側の責務」を明記する。
        *   本タスクでは他ファイルを変更しない（未使用のファイルのためアプリの動作は変わらない）。
*   [x] タスク2: `InputTracker`に編集操作の開始・確定を伝える経路を追加
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   JSDoc typedef`EditRecorder`（`{ beginEdit: () => void, commitEdit: () => boolean }`。編集操作の開始・確定を受け取る記録先。実体は`main.js`が注入する`HistoryManager`）を追加する。`HistoryManager.js`はimportしない。
        *   モジュール定数`NO_EDIT_RECORDER`（`Object.freeze({ beginEdit() {}, commitEdit() { return false; } })`）を追加し、コンストラクタに第4引数`editRecorder = NO_EDIT_RECORDER`を追加してprivateフィールド`#editRecorder`に保持する（省略時は何も記録しない。既存の呼び出しは引き続き動作する）。コンストラクタのJSDoc`@param`を追加する。
        *   privateフィールド`#isEditOpen = false`（左ドラッグで`beginEdit()`を呼んだか）を追加する。
        *   `handleClick`の`DRAWING`分岐：`this.#editRecorder.beginEdit()`→`this.model.commitDraft()`→`this.#editRecorder.commitEdit()`の順にする。
        *   `deleteSelection()`の受理時：`beginEdit()`→`this.model.deleteShapes(selectedIds)`→`commitEdit()`の順にする。
        *   `#onLeftDragStart()`：状態が`MOVING_SELECTION`または`DRAGGING_HANDLE`のときのみ、`beginEdit()`を呼び`#isEditOpen = true`にする（`MARQUEE_SELECTING`では呼ばない）。
            *   **前提の確認（実装前に必ず行う）**: この分岐は「`#onLeftDragStart()`が呼ばれた時点（閾値超過時）で、`this.state`が押下時（`#beginLeftDrag(event, nextState, ...)`）にすでに`MOVING_SELECTION`/`DRAGGING_HANDLE`/`MARQUEE_SELECTING`へ遷移済みであること」を前提とする。実装前に実コード（`#beginLeftDrag`・`#onLeftDragStart`とその呼び出し元）で確認し、作業内容（4章）に確認結果を記録する。前提が成り立たない場合（閾値超過時に初めて状態が決まる等）は、推測で条件を変えず作業を中断し、質問として報告する。
        *   `#finishLeftDrag()`の冒頭：`#isEditOpen`が真なら`commitEdit()`を呼び`#isEditOpen = false`にする（終了・中断の共通の確定箇所）。
        *   上記各メソッド・`abortOngoingOperation()`・`setMode()`のJSDocに、編集操作として記録される時点（2章の一覧表）・中断で残った変化も1件として記録されること・範囲選択は記録しないことを追記する。`abortOngoingOperation()`のJSDocの「Phase 03-02でも再利用する前提」を、取り消し・やり直しの前処理として使われている旨の記述へ更新する。
        *   先頭行の責務JSDoc（3行以内）に「編集操作の開始・確定の通知」を加え、クラスJSDocにも同旨を追記する。図形種別の分岐・図形固有のプロパティ名を追加しないこと。
        *   本タスクでは`main.js`は変更しない（第4引数省略のため記録は行われず、既存の動作は変わらない）。
*   [x] タスク3: `main.js`で履歴管理を生成・注入し、`?dev`の復元を記録する
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `HistoryManager`をimportする。
        *   2章要件7「履歴配線ブロックの位置」のとおり、`// 3. ViewTransform`の生成行（`const viewTransform = new ViewTransform();`）の直後・`// 4. Controller (入力管理)`の直前に、見出しコメント`// 3.5. 履歴（取り消し・やり直し）配線`のブロックを新設し、以下をこの順に置く（既存のセクション番号は振り直さない。`InputTracker`の生成位置は移動しない。本ブロックは`main.js`内で唯一の履歴配線ブロックであり、タスク4の`performUndo`/`performRedo`もこのブロックの末尾へ追記する）：
            *   `captureSnapshot()`：2章要件3の取得処理。JSDocにスナップショットの内容（作業データ形式＋選択集合）と、図形インスタンス・Modelと共有しないことを記載。
            *   `restoreSnapshot(snapshot)`：2章要件3の適用処理（`deserialize`→失敗・スキップ時は`console.warn`して`false`→`replaceAllShapes`→選択モードのときのみ`setSelection`→`true`）。JSDocに適用後の選択集合の規則（記録時点の選択集合／選択モード以外では空／存在しないidは無視）、進行中操作の中断は呼び出し側の責務であること、`inputTracker`を参照するが起動完了後にのみ呼ばれることを記載。
            *   `const historyManager = new HistoryManager({ capture: captureSnapshot, restore: restoreSnapshot });`
        *   `new InputTracker(canvas, model, viewTransform, historyManager)`へ変更する。
        *   `?dev`の`onImport`の成功時を`inputTracker.abortOngoingOperation()`→`historyManager.beginEdit()`→`model.replaceAllShapes(result.shapes)`→`historyManager.commitEdit()`の順にし、コメントに「1件の編集操作として記録する（中断を先に行う理由）」「失敗時は記録しない」を追記する。
            *   **注意（例外を`onImport`の外へ漏らさないこと）**: `DevPanel.js`はコールバックの例外を捕捉しない（漏れると結果表示が更新されない）。2章要件6「例外の扱い」のとおり、追加する`beginEdit()`／`commitEdit()`は通常動作では例外を投げない想定のため`try/catch`は追加せず、`onImport`内に新たに例外を投げる処理も書かない。通常動作で例外が起こり得る経路を見つけた場合は、推測で`try/catch`を追加せず作業を中断し、質問として報告する。`onImport`のコメントにも「本コールバックから例外を漏らさないこと（DevPanelは捕捉しない）」を一言添える。
        *   先頭行の責務JSDocが実態と一致しているか確認する（変更不要の見込み。最終的な照合はタスク6で行う）。
        *   本タスク完了時点で、編集操作は記録されるが取り消し手段はまだない（アプリは従来どおり動作する）。
*   [ ] タスク4: 修飾キー規則の拡張と、取り消し・やり直しのショートカット・操作関数
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `KeyboardShortcuts.js`：
            *   凍結定数`ShiftRule`（`FORBIDDEN`/`ANY`/`REQUIRED`。exportしない）をJSDoc付きで追加する。
            *   `ShortcutBinding` typedefの`allowShift`を`shift`（`ShiftRule`の値）へ置き換え、3値の意味を記載する。
            *   既存エントリを機械的に置き換える（`allowShift: false`→`shift: ShiftRule.FORBIDDEN`、`allowShift: true`→`shift: ShiftRule.ANY`。図形種別の生成部分も含む）。その他のプロパティ・並びは変えない。
            *   2章要件5の3エントリ（`undo`／`redo`×2）を追加する。
            *   `ShortcutActions` typedefに`undo`・`redo`を追加する（「作成途中の図形があれば取り消しは破棄のみ」「ドラッグ中でなければ常に`true`」等の要約）。
            *   `#findBinding`のShift判定を3値化し、JSDocのShift規則を更新する（`ANY`は拡大・縮小、`REQUIRED`は`Ctrl`+`Shift`+`Z`、`Shift`+`V`等は引き続き予約）。対応表のJSDocに修飾キー規則の拡張内容を記載する。
            *   先頭行の責務JSDocが実態と一致しているか確認する。
        *   `main.js`（`KeyboardShortcuts`のエントリ追加と同一タスクで行うこと。注入漏れは起動時`Error`になる）：
            *   タスク3で新設した履歴配線ブロック（`// 3.5. 履歴（取り消し・やり直し）配線`。`InputTracker`生成の直前）の末尾、`const historyManager = ...`の行の後に、`performUndo()`／`performRedo()`を`function`宣言で2章要件4の擬似コードどおり追加する（`inputTracker`生成後の位置へ別ブロックを作らないこと。両関数は本体内で`inputTracker`を参照するが、呼ばれるのは起動完了後のみのため問題ない旨をJSDocまたはコメントに記載する。巻き上げには頼らない：8.の注入より前にあるため）。JSDocに受理条件（ドラッグ中は不受理）・作成途中の図形がある場合の扱い・戻り値の方針（ドラッグ中でなければ常に`true`）・ボタンとショートカットの共通経路であることを記載する。
            *   `new KeyboardShortcuts({...})`に`undo: performUndo`、`redo: performRedo`を追加する（コメント付き）。
        *   本タスク完了時点でショートカットによる取り消し・やり直しが動作する。
*   [ ] タスク5: 取り消し・やり直しボタンと押せる/押せない状態の同期、図形パレットの位置
    *   **対象ファイル** :
        *   `./index.html` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `index.html`：2章要件5のボタン行を削除ボタンの直後に追加し、`<style>`に`.history-button-row`関連のスタイル（コメント付き）を追加、`#window-shape-palette`の`top`を`368px`へ変更する（変更理由のコメントを付す）。他の要素・スタイルは変更しない。
        *   `main.js`（置き場所は以下のとおり固定する。いずれも既存の`// 6. フロートパネル（コントロールパネル）配線`セクション内。最後の1回の呼び出しのみ起動時初期化部分）：
            *   **要素取得**: 6.の要素取得群の末尾、`const deleteSelectionBtn = document.getElementById('selection-delete');`の行の直後に、コメント「コントロールパネルの取り消し・やり直しボタン（modeButtonsには含めない：.activeの対象外）」とともに`const historyUndoBtn = document.getElementById('history-undo');`／`const historyRedoBtn = document.getElementById('history-redo');`を置く（`modeButtons`には含めない）。
            *   **関数定義**: 6.の削除ボタンのclick登録行（`deleteSelectionBtn.addEventListener('click', () => inputTracker.deleteSelection());`）の直後、`// 7. 図形選択パレット配線`の直前に、`syncHistoryButtonState()`を`function`宣言で2章要件5のとおり追加する（JSDocに：取り消せない＝取り消す履歴がなく作成途中の図形もない、やり直せない＝やり直す履歴がない、`HistoryManager`はDOMに触れない）。
            *   **onChange登録**: `syncHistoryButtonState()`の定義の直後に、`model.onChange(syncHistoryButtonState)`と`historyManager.onChange(syncHistoryButtonState)`をコメント付きで登録する。
            *   **click登録**: onChange登録の直後（`// 7.`の直前）に、両ボタンの`click`で`performUndo()`／`performRedo()`を呼ぶのみのリスナーを登録する（コメント：ショートカットと同一経路。ここで`historyManager.undo()`/`redo()`を直接呼ばないこと）。`performUndo`/`performRedo`・`historyManager`は3.5.のブロックで宣言済みのため、この位置から参照できる。
            *   **起動時の同期**: ファイル末尾の起動時初期化部分で、`syncDeleteButtonState();`の直後（`DOMContentLoaded`コールバックの最後）に、既存と同様の説明コメント付きで`syncHistoryButtonState();`を明示的に1回呼ぶ。
*   [ ] タスク6: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   `./js/core/HistoryManager.js`、`./js/core/InputTracker.js`、`./js/core/KeyboardShortcuts.js`、`./js/main.js` :（確認・必要ならJSDocのみ更新）
        *   `./_log/res/261103_1911_RES_Phase03-02_Undo_Redo.md` :（更新）
    *   **作業内容** :
        *   JSDocの記載漏れがないことを確認する。特に次がJSDocから読み取れること：編集操作として記録される操作と記録の時点／変化のない操作を記録しない規則／スナップショットの内容（作業データ形式＋選択集合）／履歴の上限／取り消し・やり直し・リセットの効果と受理条件／作成途中の図形がある場合の取り消しの扱い／適用後の選択集合の規則／ショートカットの修飾キー規則の拡張内容。
        *   改修した全`.js`ファイルの先頭行の責務JSDoc（3行以内）が実態と一致していることを確認する。
            *   特に`main.js`の先頭行（現状「責務：各モジュールの初期化と連携(依存性の注入)を担う。」）を、追加した`restoreSnapshot`（デシリアライズ→図形一式の入れ替え→選択集合の復元）・`performUndo`／`performRedo`（ドラッグ中の不受理判定・作成途中の図形の破棄・履歴の適用呼び出し）の実態と照らし、「初期化と連携」の範囲に収まると言えるかを確認する。収まらないと判断した場合は、3行以内で実態に合う記述へ更新し（JSDocのみ）、判断理由を4章に記録する。タスク3の「変更不要の見込み」はここで最終確認する。
        *   本RESの「4. 詳細作業内容」を全タスク分記載し、「開発資料の更新予定」「懸念事項・要確認ポイント」に実装中の判明事項を追記する。
*   [ ] タスク7: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   本RESの「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」を確認し、1章（`HistoryManager.js`の追加）、3章（起動処理の一覧、編集操作の確定から履歴記録までの流れ、履歴の適用の流れ、キーボード操作のShift規則）、4章（`HistoryManager.js`の新設項、`KeyboardShortcuts.js`の対応表と修飾キー規則の拡張、`InputTracker.js`の第4引数と編集操作の通知、`main.js`の履歴配線とボタン同期・起動時の同期、`index.html`のボタン行と図形パレットの位置、`DocumentSerializer.js`・`VectorModel.js`の未来形表現の更新）へ反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする（REQの固定タスク）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 履歴管理クラス`HistoryManager`の新設
*   **作業内容** :
    *   `js/core/HistoryManager.js`を新規作成した（importなし）。先頭行に2章要件7の案どおりの責務JSDoc（3行以内）を記載。
    *   `export const HISTORY_LIMIT = 100`（JSDoc：取り消せる編集操作の上限件数。超えたら最古から捨てる。唯一の定義箇所）。
    *   typedef`Snapshot`（`document`は中身を解釈しない旨、`selectedIds`の時点の定義）・`HistoryEntry`・`HistoryCallbacks`を記載。
    *   `HistoryManager`クラス：privateフィールド`#capture`/`#restore`/`#entries`/`#cursor`/`#pendingBefore`/`#listeners`。公開API`constructor({ capture, restore })`（関数でなければ`Error`）、`beginEdit()`、`commitEdit()`、`undo()`、`redo()`、`canUndo()`、`canRedo()`、`clear()`、`onChange(listener)`。private`#notifyChange()`、`#takeSnapshot()`、static`#deepFreeze(value)`。
        *   `commitEdit()`：`#pendingBefore`を先に取り出して破棄→なければ`console.warn`して`false`→`document`部分の`JSON.stringify`比較で同一なら`false`（やり直しの履歴は破棄しない・通知なし）→異なれば`#entries.length = #cursor`で切り詰め→エントリ（`Object.freeze({ before, after })`）を追加→上限超過分を先頭から`splice`→`#cursor = #entries.length`→通知して`true`。
        *   `undo()`/`redo()`：冒頭で`#pendingBefore`が残っていれば`console.warn`して破棄（共通処理をprivate`#discardPendingWithWarning(methodName)`として追加。計画に明記のないprivateヘルパーだが、undo/redoの重複を避けるためのみ）。可否が偽なら`false`。`restore`が`false`なら位置を動かさず通知せず`false`。成功時に位置を増減し通知して`true`。
        *   `clear()`：エントリまたは`#pendingBefore`があった場合のみ通知。
        *   `#deepFreeze`：`null`・非オブジェクト・凍結済みはそのまま返し、それ以外は`Object.freeze`→`Object.values`で子を再帰（プロパティ名を参照しない）。
    *   各メソッド・クラスJSDocに、効果・受理条件・戻り値・変更通知の条件、「DOMに触れない」「図形種別・図形固有のプロパティ名を持たない」「`beginEdit`/`commitEdit`の明示呼び出しでのみ記録」「進行中の入力操作の中断は呼び出し側の責務」を記載。
    *   他ファイルは変更していない（未使用のためアプリの動作は不変）。Node.jsでの簡易動作確認（記録・不記録・取り消し・やり直し・上限100件）を一時スクリプトで実施し、スクリプトは削除済み。

### タスク2: `InputTracker`に編集操作の開始・確定を伝える経路を追加
*   **作業内容** :
    *   **前提の確認（実装前）**: 前提は成り立つ。`#beginLeftDrag(event, nextState, ...)`は`this.#drag.begin(...)`の戻り値が真のとき、同じ同期処理の中で`this.state = nextState`に遷移させる。`DragTracker.begin()`はセッションを登録して`true`を返すだけで、`onStart`を同期的に呼ばない。`onStart`を呼ぶのは`DragTracker`の`#handleWindowMouseMove`だけで、押下点からの距離が`threshold`（3px）を超えた最初の`mousemove`のときである。したがって`#onLeftDragStart()`が呼ばれる時点では、`this.state`は必ず`MOVING_SELECTION`／`DRAGGING_HANDLE`／`MARQUEE_SELECTING`のいずれかになっている。
    *   typedef`EditRecorder`（`beginEdit: () => void`／`commitEdit: () => boolean`。実体は`main.js`が注入する`HistoryManager`。importはしない）と、モジュール定数`NO_EDIT_RECORDER`（凍結。何もしない／`false`）を`DRAG_START_THRESHOLD`の直後に追加した。
    *   コンストラクタに第4引数`editRecorder = NO_EDIT_RECORDER`を追加し、private`#editRecorder`に保持した（`@param`も追加）。private`#isEditOpen = false`を追加した。
    *   `handleClick`の`DRAWING`分岐：`beginEdit()`→`commitDraft()`→`commitEdit()`→`state = IDLE`の順に変更した。
    *   `deleteSelection()`の受理時：`beginEdit()`→`deleteShapes(selectedIds)`→`commitEdit()`の順に変更した。
    *   `#onLeftDragStart()`：`MOVING_SELECTION`か`DRAGGING_HANDLE`のときだけ、`beginEdit()`を呼んで`#isEditOpen = true`にする。続けて、既存のホバークリア・カーソル更新を行う。
    *   `#finishLeftDrag()`の冒頭：`#isEditOpen`が真なら、`commitEdit()`を呼んでフラグを下ろす。
    *   JSDocの更新：先頭行の責務（3行以内）に「編集操作の開始・確定の通知（注入された記録先へ）」を追加した。クラスJSDoc（編集操作の通知、記録しない操作、図形種別の分岐を持たない）も更新した。加えて`setMode`・`deleteSelection`・`abortOngoingOperation`（「Phase 03-02でも再利用する前提」を「取り消し・やり直しの前処理として呼ばれる」へ更新）・`handleClick`・`#onLeftDragStart`・`#finishLeftDrag`に、記録の時点・中断で残った変化も1件として記録すること・範囲選択を記録しないことを追記した。
    *   図形種別の分岐・図形固有のプロパティ名は追加していない。`main.js`は変更していない（第4引数を省略しているため記録は行われず、動作は従来どおり）。`node --check`で構文を確認した。

### タスク3: `main.js`で履歴管理を生成・注入し、`?dev`の復元を記録する
*   **作業内容** :
    *   `HistoryManager`のimportを`ViewTransform`のimportの直後に追加した。
    *   `const viewTransform = new ViewTransform();`の直後、`// 4. Controller (入力管理)`の直前に、見出し`// 3.5. 履歴（取り消し・やり直し）配線`のブロックを新設した。ブロック冒頭には、唯一の履歴配線ブロックであること・`core/`から`io/`をimportしない理由・`InputTracker`より先に生成する理由をコメントで書いた。中身は次の順に置いた。
        *   `captureSnapshot()`：`{ document: DocumentSerializer.serialize(model.getShapes()), selectedIds: model.getSelectedIds() }`を返す。JSDocに、スナップショットの内容と、図形インスタンス・Modelと共有しないことを書いた。
        *   `restoreSnapshot(snapshot)`：`deserialize`の結果が`!ok`または`skipped.length > 0`なら`console.warn`して`false`を返す。成功時は`replaceAllShapes`を呼び、`inputTracker.getMode() === OperationMode.SELECT`のときだけ`setSelection(snapshot.selectedIds)`を呼んで`true`を返す。JSDocには次を書いた：適用後の選択集合の規則、中断は呼び出し側の責務であること、`inputTracker`を参照するが呼ばれるのは起動完了後だけであること。
        *   `const historyManager = new HistoryManager({ capture: captureSnapshot, restore: restoreSnapshot });`
    *   `new InputTracker(canvas, model, viewTransform, historyManager)`へ変更した（EditRecorderとして注入する旨のコメント付き）。`InputTracker`の生成位置は動かしていない。既存のセクション番号は振り直していない。
    *   `onImport`の成功時を`abortOngoingOperation()`→`historyManager.beginEdit()`→`replaceAllShapes`→`historyManager.commitEdit()`の順にした。コメントには次を追記した：1件の編集操作として記録すること、失敗時は記録しないこと、中断を先に行う理由、例外を漏らさないこと（DevPanelは捕捉しない）。`try/catch`は追加していない。`beginEdit`/`commitEdit`の内部は`serialize`（`toJSON()`）・汎用の凍結・`JSON.stringify`比較だけで、通常動作で例外が起きる経路は見つからなかった。
    *   先頭行の責務JSDoc（「各モジュールの初期化と連携(依存性の注入)を担う。」）は、本タスク時点では変更していない（最終照合はタスク6）。`node --check`で構文を確認した。

### タスク4: 修飾キー規則の拡張と、取り消し・やり直しのショートカット・操作関数
*   **作業内容** :
    *   (未実施)

### タスク5: 取り消し・やり直しボタンと押せる/押せない状態の同期、図形パレットの位置
*   **作業内容** :
    *   (未実施)

### タスク6: JSDocの確認とRESの完成
*   **作業内容** :
    *   (未実施)

### タスク7: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   (未実施)

## 5. 懸念事項・要確認ポイント
* **ドラッグの中断で残った変化の記録（要件2）**: `window`の`blur`等でドラッグが中断された場合、反映済みの頂点・位置は残り、**1件の編集操作として記録する**（決定）。記録しない場合、その変化が次の編集操作の「前の状態」に含まれ、単独では取り消せなくなるため。中断も`#finishLeftDrag()`を通るので、記録の確定箇所は1箇所に保たれる。
* **取り消しの前処理と`abortOngoingOperation()`の戻り値**: `performUndo()`は「ドラッグ中でないことを確認した後」の`abortOngoingOperation()`の戻り値で作成途中の図形の有無を判定する（その時点で中断し得るのは作成途中の図形のみ）。将来`abortOngoingOperation()`が中断する対象を増やす場合は、この判定を見直すこと。
* **生成順と`restoreSnapshot`の`inputTracker`参照**: `HistoryManager`は`InputTracker`より先に生成し、`restoreSnapshot`・`performUndo`・`performRedo`は後で宣言される`inputTracker`を実行時に参照する。取り消し・やり直しは起動完了後にしか呼ばれないため問題ないが、将来起動処理中に`undo()`／`redo()`を呼ぶ変更をする場合は注意すること。
* **`onImport`からの例外**: `DevPanel.js`はコールバックの例外を捕捉しないため、`onImport`から例外が漏れると結果表示が更新されない。追加する`beginEdit()`／`commitEdit()`は通常動作で例外を投げない想定のため`try/catch`は追加しない（要件6）。将来`captureSnapshot`や`HistoryManager`の記録処理に例外を投げ得る処理を加える場合は、`onImport`側の扱いを見直すこと。
* **`main.js`の肥大化**: 約260行→約340〜360行の見込み。今回のスコープでは新設ファイルが履歴管理のみのため分割しない。後続Phase（03-03の複製・貼り付け、03-04のキャンバス管理）で配線がさらに増える場合は、スナップショットの取得・適用関数を別モジュール（例：`io/`配下の小さなアダプタ）へ切り出すことを検討する。
* **メモリと処理量**: スナップショットは編集操作1件につき前後2つ（最大100件×2）を作業データ形式で保持し、記録時に`JSON.stringify`で2回比較する。ゲーム用パーツ規模（図形数十〜数百）では問題ない想定だが、図形数が極端に多い場合は記録時の遅延・メモリを確認すること。
* **スナップショットの凍結**: 保持するスナップショットは再帰的に`Object.freeze`する。マイグレーション関数が契約に反して引数を書き換えると例外→全体の読み込み失敗→取り消し・やり直しが`console.warn`のうえ無効（履歴・キャンバスとも不変）になる。`DocumentSerializer`のマイグレーション追加時に注意すること。
* **適用失敗時の扱い**: 自分で記録したスナップショットのデシリアライズ失敗・スキップは起こらない想定だが、起きた場合はキャンバスを変更せず、`console.warn`を出し、履歴の位置も動かさない（スキップ1件以上も失敗扱い。一部の図形だけが戻る中途半端な状態を避けるため）。
* **適用後のカーソル・ホバー**: `replaceAllShapes`がホバー状態をクリアするため、取り消し直後はカーソル下の図形のホバー表示・カーソル形状が次の`mousemove`まで更新されない場合がある（既存の`?dev`復元と同じ挙動）。
* **`event.code`による識別**: `KeyZ`／`KeyY`は物理キー位置で識別する（既存方針）。QWERTZ（独）・AZERTY（仏）配列では、刻印上のZ/Yと位置が異なるため、刻印どおりのキーで動かない。現行の対象は日本語・US配列のため既存方針を踏襲する。
* **ボタンのフォーカス**: 取り消し・やり直しボタンをクリックした後、フォーカスがボタンに残ったまま`Enter`を押すとボタンが再度押される（削除ボタンと同じ既存の挙動を踏襲。`Space`は`InputTracker`がスペースパンのため`preventDefault()`するが、`keyup`での誤クリック抑止はテキスト入力中以外で既存どおり）。
* **ボタン行の幅**: パネル内側196pxに2ボタンを並べるため、`white-space: nowrap`・中央揃えで収める。フォント環境によっては文字が詰まって見える可能性があるため目視確認すること。
* **図形パレットの位置**: `top`を320px→368pxへ下げる。コントロールパネル下端との余白は計算上約27px。フォント環境で高さが変わる場合は目視確認すること。
* **`#deepFreeze`の凍結済み判定（タスク1）**: 循環参照で無限再帰しないよう、凍結済みの値は辿らずに返す。このため`capture()`が「凍結済みだが子が未凍結」のオブジェクトを含むスナップショットを返した場合、その子は凍結されない。現行の`captureSnapshot`（`serialize`＝`toJSON()`の新しいオブジェクト＋新しい配列）では起こらない想定だが、`toJSON()`が凍結済みの共有オブジェクトを返すよう変更する場合は注意すること。
* **`#onLeftDragStart`の前提（タスク2）**: 移動・変形の`beginEdit()`は、「`DragTracker.begin()`が`onStart`を同期的に呼ばない」こと、つまり「閾値超過時には状態が遷移済みである」ことを前提にしている。将来`DragTracker`を変更して`begin()`内で`onStart`を呼ぶようにする場合（閾値0のセッションで即時開始させる等）は、`#beginLeftDrag`の中で状態を遷移させる順序と合わせて見直すこと。
* **`setMode`中断時の記録順（タスク2）**: `setMode`では`#abortOngoingOperation()`、つまりドラッグの中断から`#finishLeftDrag()`の`commitEdit()`までが、`clearSelection()`より前に実行される。このため、中断で記録される後の状態の選択集合は操作中のもの（クリア前）になる。`setMode`の処理順を変える場合は注意すること。
* **タスク3完了時点の中間状態（タスク3）**: この時点では作成・削除・移動・変形・`?dev`復元が履歴に記録されるが、取り消し・やり直しの手段（ショートカット・ボタン）はまだない（タスク4・5で接続）。記録処理が加わるため、編集操作ごとに`serialize`と`JSON.stringify`が2回ずつ走るが、従来の動作は変わらない想定である。テストプレイでは回帰（作成・削除・移動・変形・`?dev`復元）がないかを確認すること。
* **変更しないファイル**: `CanvasManager.js`／`ShapeFactory.js`／`ViewTransform.js`／`DragTracker.js`／`WindowManager.js`／`DocumentSerializer.js`／`PaletteController.js`／`DevPanel.js`／`shapes/`・`VectorModel.js`は変更不要と判断した。
* **テストプレイでの目視確認項目**:
    1. 5種の図形（直線・曲線・弧・矩形・円）を作成→`Ctrl`+`Z`で新しい順に1つずつ消え、`Ctrl`+`Y`で順に戻る。
    2. `Ctrl`+`Shift`+`Z`でもやり直せる。`Shift`+`V`等の既存の予約キー、`Ctrl`+`Shift`+`=`（拡大）等の既存ショートカットが従来どおり動く。
    3. 複数選択の一括移動・一括削除が、それぞれ1回の`Ctrl`+`Z`で取り消せる。
    4. ハンドル変形を取り消すと元の形に戻る。1回のドラッグが途中経過を含めて1回で取り消せる。
    5. 削除を取り消すと、削除した図形が選択された状態で戻る。移動を取り消すと、移動した図形が選択されたまま元の位置へ戻る。
    6. クリック選択・範囲選択・全選択・選択解除・パン（3通り）・ズーム・リセット・モード切替は取り消しの対象にならない（`Ctrl`+`Z`で直前の図形操作が取り消される）。
    7. ドラッグを閾値以内で離した（クリック扱い）・ドラッグして元の位置に戻した場合は、履歴が増えない（やり直しも消えない）。
    8. 取り消し後に新しい図形を作ると、やり直しできなくなる（やり直しボタンが押せない状態になる）。
    9. 作成途中（1回目のクリックの後）に`Ctrl`+`Z`を押すと作成途中の図形だけが消え、もう一度押すと前の図形が消える。作成途中の`Ctrl`+`Y`は作成途中の図形を消してやり直す。
    10. 押しっぱなしで連続して取り消し・やり直しができる。
    11. 取り消せない・やり直せないときにボタンが押せない状態になり、作成途中の図形があるときは取り消しボタンが押せる。起動直後は両方押せない。
    12. ボタンでもショートカットと同じ動作になる。
    13. 図形パレットとコントロールパネルが重ならない（余白24px以上）。2つのボタンが1行に収まっている。
    14. 取り消し後に新しい図形を作成・削除・移動しても、idの衝突による異常（選択・移動が別の図形に効く等）がない。
    15. ドラッグ中（本体・ハンドル・範囲選択・パン）に`Ctrl`+`Z`を押しても何も起きず、ブラウザの動作も起きない。
    16. `?dev`のテキスト入力欄では`Ctrl`+`Z`が文字入力の取り消しになる。`?dev`の「JSONから復元」を`Ctrl`+`Z`で取り消すと復元前の図形に戻る（読み込み失敗時は履歴が増えない）。
    17. 101回以上編集操作を行うと、最古の操作は取り消せない（100回で取り消しボタンが押せない状態になる）。
    18. 図形作成モード・キャンバス移動モードで取り消した場合、選択ハンドルが表示されない（選択集合が空）。
    19. ドラッグ中にウィンドウを切り替える（`Alt`+`Tab`等）と、それまでの移動が1件の操作として取り消せる。
    20. 回帰：図形作成5種・クリック選択・範囲選択・本体ドラッグ・ハンドル操作・削除ボタン・全ショートカット・パン3通り・ホイールズーム・倍率表示・リセット・モードボタン・図形パレットのハイライトと活性/非活性・`?dev`の確認用ウィンドウ・原点表示が従来どおり動く。
