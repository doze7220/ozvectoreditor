# RES: 作業計画・作業レポート (Phase 03-03) : 複製・コピー＆ペースト
* 参照元REQ: `./_log/req/261103_2355_REQ_Phase03-03_Copy_Paste.md`

## 1. 作業目的
現状、図形を複製する手段がない。本作業では、選択中の図形をアプリ内部のクリップボードへコピー・切り取りし、同じキャンバスへ貼り付ける操作と、選択中の図形をその場で複製する操作を、キーボードショートカット（`Ctrl`+`C`／`X`／`V`／`D`）で実行できるようにする。貼り付け・切り取り・複製はPhase 03-02の履歴（`HistoryManager`）に1件の編集操作として記録する。あわせて、「作業データ形式のオブジェクトから図形を生成し、新しいidで追加し、追加した図形だけを選択する」処理を、Phase 03-05のインポートで再利用できる独立した部品として用意する。

**用語**（REQの定義に従い、本RES・コード内JSDocで統一する）
* **クリップボード**: コピー・切り取りした図形一式を保持する、アプリ内部（メモリ上）の領域。OSのクリップボードではない。
* **コピー**: 選択集合の図形を、図形一式は変えずにクリップボードへ記録すること。
* **切り取り**: 選択集合の図形をクリップボードへ記録し、キャンバスから削除すること。
* **貼り付け**: クリップボードの図形の新しい複製を、新しいidでキャンバスへ追加すること。
* **複製**: 選択集合の図形の新しい複製を、クリップボードを経由せずにキャンバスへ追加すること（コピー＋貼り付けを1操作で行う）。
* **ずらし量**: 貼り付け・複製した図形を、元の位置から右下（x・yとも正の方向）へ平行移動する量。1段＝ワールド座標で`20`。
* **段数**: 次の貼り付けで適用するずらし量の段の数（0以上の整数）。
* 編集操作・履歴・スナップショットはPhase 03-02、作業データ形式・図形データ・シリアライズ／デシリアライズはPhase 03-01、選択集合・作成中の図形はPhase 02-03、操作モードはPhase 02-01の定義に従う。座標はすべて「ワールド座標」と表記する。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
新設フォルダ`js/edit/`に、次の2クラスを新設する（いずれもDOMに触れず、図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない）。

| ファイル | クラス | 責務 |
| --- | --- | --- |
| `js/edit/ShapeInserter.js` | `ShapeInserter` | 作業データ形式のオブジェクトの図形を、指定量だけ平行移動したうえで新しいidで現在のキャンバスの最前面へ追加し、追加した図形だけを選択する**1件の編集操作**（貼り付け・複製の共通処理。Phase 03-05のインポートでも再利用する） |
| `js/edit/ClipboardController.js` | `ClipboardController` | アプリ内部のクリップボード（内容・段数）の保持と、コピー・切り取り・貼り付け・複製の手順 |

**置き場所の判断理由**
* 両クラスは`DocumentSerializer`（`io/`）を使う。`core/`から`io/`をimportしない既存方針（依存方向`io → core → shapes`）を守るため、`core/`には置けない。
* `io/`は作業データ形式の変換（シリアライズ・コード書き出し等）の置き場であり、「キャンバスへの追加・選択・履歴記録」という編集手順を持ち込むと責務が混ざる。
* そのため、`io/`・`core/`の機能を組み合わせて図形一式を編集する手順の置き場として`js/edit/`を新設する。依存方向は`main.js → edit → io → core → shapes`の一方向となり、循環しない（`core/`・`io/`は`edit/`をimportしない）。
* 貼り付け・複製の処理本体を`main.js`に置かない（REQ要件7）。`InputTracker`にも置かない（状態に依存しない操作を`InputTracker`へ入れない方針。REQ要件6）。

| 呼ぶ側 → 呼ばれる側 | 呼び出し内容 | 備考 |
| --- | --- | --- |
| `main.js` → `ShapeInserter` | 生成（`model`・`editRecorder`＝`historyManager`の注入） | |
| `main.js` → `ClipboardController` | 生成（`model`・`inserter`・`deleteSelection`の注入）、`copy()`／`cut()`／`paste()`／`duplicate()`／`isEmpty()` | ショートカットの注入コールバックから呼ぶ |
| `ClipboardController` → `VectorModel` | `getShapes()`／`isSelected(id)`（読み取りのみ） | 選択集合の図形を描画順で得るため |
| `ClipboardController` → `DocumentSerializer` | `serialize(shapes)` | コピー・切り取り・複製時に図形を作業データ形式へ変換 |
| `ClipboardController` → 注入関数`deleteSelection` | 切り取りの削除 | 実体は`inputTracker.deleteSelection()`（既存の唯一の削除経路。履歴記録込み） |
| `ClipboardController` → `ShapeInserter` | `insertDocument(documentData, dx, dy)` | 貼り付け・複製 |
| `ShapeInserter` → `DocumentSerializer` | `deserialize(documentData)` | 毎回新しい図形インスタンスを生成 |
| `ShapeInserter` → 図形インスタンス | `translate(dx, dy)` | 共通インターフェースのみ |
| `ShapeInserter` → `EditRecorder`（`historyManager`） | `beginEdit()`／`commitEdit()` | `HistoryManager.js`はimportしない |
| `ShapeInserter` → `VectorModel` | `addShapesWithNewIds(shapes)`（新設） | id採番・追加・選択の置き換えを1回の通知で行う |

```text
main.js ──生成・注入──▶ ClipboardController ──insertDocument──▶ ShapeInserter
   │                        │ serialize                          │ deserialize / translate
   │                        │ getShapes/isSelected               │ beginEdit/commitEdit（historyManager）
   │                        │ deleteSelection（注入）             ▼
   │                        ▼                              VectorModel.addShapesWithNewIds
   │                 DocumentSerializer / VectorModel
   └── KeyboardShortcuts（copy / cut / paste / duplicate の注入コールバック）
```

### 要件1: クリップボード
* クリップボードは`ClipboardController`のprivateフィールド`#documentData`（作業データ形式のオブジェクト＝`DocumentSerializer.serialize`の戻り値。空のときは`null`）に保持する。OSのクリップボード（Clipboard API）は使わない。
  * `serialize`は各図形の`toJSON()`で新しいプレーンオブジェクトを生成するため、図形インスタンスへの参照を保持しない（コピー後に元の図形を変形・削除してもクリップボードの内容は変化しない）。
  * `#documentData`は外部へ返さず、`ShapeInserter`経由で`DocumentSerializer.deserialize`（引数を書き換えない既存仕様）へ渡すのみのため、凍結は行わない（JSDocに「外部へ返さない・書き換えない」を明記する）。
* `ClipboardController`のインスタンスは`main.js`が起動時に1つだけ生成し、ページを開いている間保持する。履歴（`HistoryManager`）・図形一式の入れ替え（`replaceAllShapes`）とは独立しているため、取り消し・やり直しではクリップボードの内容・段数は変わらない。Phase 03-04以降でキャンバスを切り替えても同じインスタンスが残るため、別キャンバスへの貼り付けが可能な設計になる（本作業での確認はなし）。ページの再読み込みで空になる（仕様）。

### 要件2: コピー・切り取り
* **選択集合の図形の取得**: `model.getShapes().filter((shape) => model.isSelected(shape.id))`（`#shapes`の並び＝描画順を保つ）。クリップボード内の並び順はこれに従う。
* **`copy(): boolean`**: 選択集合が空なら何もせず`false`（クリップボードの内容・段数を変えない）。空でなければ`#documentData = DocumentSerializer.serialize(選択集合の図形)`、`#nextPasteStep = 1`（コピー直後の1回目の貼り付けは1段）として`true`。図形一式・選択集合・履歴は変化させない（`beginEdit`/`commitEdit`を呼ばない）。
* **`cut(): boolean`**: 選択集合が空なら何もせず`false`。空でなければ、先に選択集合の図形を`serialize`して手元に保持し、注入された`deleteSelection()`（実体`inputTracker.deleteSelection()`）を呼ぶ。`true`が返った（削除を受理した）場合のみ`#documentData`をその内容で置き換え、`#nextPasteStep = 0`（切り取り直後の1回目の貼り付けは元の位置）として`true`。`false`なら（受理条件を満たさない）クリップボードを変えずに`false`。
  * 削除は既存の`deleteSelection()`をそのまま通るため、結果（選択集合が空になる）・履歴の記録（`beginEdit`→`deleteShapes`→`commitEdit`の1件）とも`Delete`キーと同一になる。
* **選択集合が空の場合の`preventDefault()`（決定）**: コピー・切り取りとも、何もしなかった場合は`false`を返し`preventDefault()`しない。理由：`?dev`の結果表示欄（`user-select: text`）等でページ上の文字を選択している場合に、ブラウザ標準の文字のコピーを妨げないため。図形を記録した場合（受理）のみ`true`で`preventDefault()`する。テキスト入力中・IME変換中は`KeyboardShortcuts`の既存の受理判定でコールバック自体が呼ばれない（判定ロジックは変更しない）。
* 選択モード以外では選択集合が常に空のため、コピー・切り取りは何もしない（モード判定は持たない）。

### 要件3: 貼り付け
* **`paste(): boolean`**: クリップボードが空（`#documentData === null`）なら何もせず`false`。空でなければ、ずらし量`d = #nextPasteStep × PASTE_OFFSET_STEP`で`inserter.insertDocument(#documentData, d, d)`を呼び、1件以上追加した場合のみ`#nextPasteStep`を1増やして`true`（追加0件なら段数を変えず`false`）。
  * **前提（呼び出し側の責務）**: 選択モードであること・ドラッグ中でないこと。`ClipboardController`は操作モードを知らない（`InputTracker`に依存しない）。`main.js`のコールバックが先に選択モードへ切り替え、ドラッグ中は`KeyboardShortcuts`の受理判定で呼ばれない。
* **選択モード以外での貼り付け（決定）**: `main.js`の`paste`コールバックで、`clipboardController.isEmpty()`が真なら何もしない（**モードも切り替えない**。REQ「クリップボードが空の場合は何もしない」に合わせ、空振りのキー操作で操作モードが変わらないようにするため）。空でなければ、選択モード以外のとき`applyMode(OperationMode.SELECT)`で選択モードへ切り替えてから`clipboardController.paste()`を呼ぶ（`Ctrl`+`A`の全選択と同じ形。選択集合は選択モード以外では常に空という不変条件を守る）。コールバックの戻り値は常に`true`（ドラッグ中でなければ`preventDefault()`する。テキスト入力中でないページ上の`Ctrl`+`V`にブラウザ標準の意味のある動作はなく、取り消し・全選択と同じ方針とする）。
* **作成途中の図形がある場合（決定）**: 図形作成モードで作成途中の図形がある状態で`Ctrl`+`V`を押すと、`applyMode(SELECT)`→`InputTracker.setMode`の既存処理（進行中操作の強制中断）により作成途中の図形は**破棄**され（記録されない）、その後に貼り付ける。クリップボードが空の場合はモードを切り替えないため、作成途中の図形はそのまま残る。
* **id（決定）**: `VectorModel`に公開操作`addShapesWithNewIds(shapes)`を新設し、追加する全図形に`#issueId()`で新しいidを採番する（受け取ったインスタンスの`id`を常に上書きする。クリップボード内の図形データのidは引き継がない）。`#nextId`は単調増加で減らさないため、キャンバス上の既存図形（`commitDraft`・`replaceAllShapes`の繰り上げ後のid）と衝突せず、同じクリップボードから何回貼り付けても毎回別のidになる。id形式の知識は`VectorModel`内に閉じたまま。
  * **追加方式の採用理由**: `replaceAllShapes`による全体置換ではなく追加とする。全体置換は既存図形のidの正規化・選択集合のクリアを伴い、既存図形のidを保つ保証を呼び出し側の工夫に頼ることになるため。追加なら既存図形には一切触れない。
  * **インスタンスの独立性**: `ShapeInserter`は貼り付け・複製のたびに`DocumentSerializer.deserialize`で新しい図形インスタンスを生成する（`fromJSON`は内部配列・頂点オブジェクトを共有しない既存仕様）。同一インスタンスを2回渡す問題（C-38・C-40）は構造的に起きない。念のため`addShapesWithNewIds`は、引数内で2回目以降に現れるインスタンスと、既に`#shapes`にあるインスタンスを`console.warn`のうえ追加しない（同じidを持つ2要素を作らないための防御）。
* **独立性**: 貼り付けた図形は毎回新しいインスタンスであり、元の図形・クリップボード（プレーンオブジェクト）・他の貼り付けた図形と状態を共有しない。
* **ずらし量・段数（決定）**:
  * 定数`PASTE_OFFSET_STEP = 20`（1段のずらし量。ワールド座標）を`ClipboardController.js`に1箇所だけ定義する（複製も同じ定数を使う。exportはしない）。
  * 段数は`ClipboardController`のprivateフィールド`#nextPasteStep`に保持する。コピー時に`1`、切り取り時に`0`へリセットし、貼り付けで1件以上追加するたびに1増やす。取り消し・やり直し・複製では変えない。
  * 平行移動は`ShapeInserter`が各図形インスタンスの`translate(dx, dy)`（共通インターフェース）で行う（追加前のインスタンスに対して行うため、変更通知は発生しない）。

### 要件4: 複製
* **`duplicate(): boolean`**: 選択集合が空なら何もせず`false`。空でなければ選択集合の図形を`serialize`し、`inserter.insertDocument(その作業データ, PASTE_OFFSET_STEP, PASTE_OFFSET_STEP)`（1段）を呼んで、1件以上追加したら`true`。`#documentData`・`#nextPasteStep`は変えない。
  * 複製後は複製した図形だけが選択されるため、続けて`Ctrl`+`D`を押すとさらに1段ずれた複製ができる（階段状）。
* **`preventDefault()`（決定）**: `main.js`の`duplicate`コールバックは、`clipboardController.duplicate()`の結果によらず常に`true`を返す（ブックマーク追加の抑止）。ドラッグ中は既存の`ctrl: true`エントリの例外処理で`preventDefault()`のみ行われる。テキスト入力中・IME変換中は既存の受理判定によりコールバックが呼ばれず、`preventDefault()`もされない（REQのとおり）。
* **共通化**: 貼り付け・複製とも、複製の生成（`deserialize`）・ずらし（`translate`）・id採番・追加・選択（`addShapesWithNewIds`）・履歴記録を`ShapeInserter.insertDocument`の1経路で行う。

### `ShapeInserter.insertDocument`の仕様（Phase 03-05のインポートでの再利用を想定）
* シグネチャ：`insertDocument(documentData, dx = 0, dy = 0): InsertResult`
  * `documentData`：作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値や、ファイルを`JSON.parse`したもの）。書き換えない。
  * `dx`／`dy`：追加する全図形に適用する平行移動量（ワールド座標。インポートで元の座標のまま追加する場合は省略＝0）。
  * 戻り値typedef`InsertResult`＝`{ ok: boolean, insertedIds: string[], skipped: SkippedShape[], error: string|null }`（`ok`・`skipped`・`error`は`DeserializeResult`の値をそのまま、`insertedIds`は追加した図形の新しいid（描画順））。
* 処理順：
  1. `DocumentSerializer.deserialize(documentData)`。`ok: false`なら何も変更せず（履歴にも記録せず）、`insertedIds: []`で返す。
  2. 復元できた図形が0件なら何も変更せず返す（スキップのみの場合を含む）。
  3. 各図形に`translate(dx, dy)`を呼ぶ（`dx`・`dy`がともに0なら呼ばない）。
  4. `editRecorder.beginEdit()` → `model.addShapesWithNewIds(shapes)` → `editRecorder.commitEdit()`。
  5. `{ ok: true, insertedIds, skipped, error: null }`を返す。
* **スキップの扱い（決定）**: 一部の図形がスキップされた場合も、復元できた図形だけを追加する（`?dev`の復元と同じく、読めた分は読む方針。スキップは`DocumentSerializer`が`console.warn`済みで、戻り値の`skipped`で呼び出し側へ伝える）。貼り付け・複製の作業データは自前の`serialize`で作るため、通常スキップは起きない（起きた場合は実装不具合を疑う）。
* **前提（呼び出し側の責務）**: 選択モードであること（追加した図形を選択するため、選択集合は選択モード以外では空という不変条件を呼び出し側が守る）、ドラッグ中・作成途中の図形がないこと（必要なら呼び出し側が先に`applyMode`／`InputTracker.abortOngoingOperation()`を呼ぶ）。
* 進行中の入力操作の中断・操作モードの切り替えは行わない（`InputTracker`に依存しないため）。

### `VectorModel.addShapesWithNewIds(shapes)`の仕様（新設）
* 引数の配列の順に、各図形インスタンスの`id`を`#issueId()`で新しいidに上書きして`#shapes`の末尾（最前面）へ追加する。
* 引数内で2回目以降に現れるインスタンス、および既に`#shapes`に含まれるインスタンスは、`console.warn`のうえ追加しない（idの重複を作らないため）。
* 追加した図形のidの集合で選択集合を置き換える（追加した図形だけが選択される）。ホバー状態・作成中の図形・選択矩形には触れない。
* 1件以上追加した場合のみ変更通知を1回行う。戻り値は追加した図形の新しいidの配列（描画順。0件なら空配列）。
* 図形インスタンスの中身（頂点・プロパティ名）・図形種別には触れない（`id`の代入のみ。`commitDraft`・`replaceAllShapes`と同じ扱い）。
* `#issueId()`・`#nextId`のJSDocの「採番を行う箇所」の列挙へ`addShapesWithNewIds`を加える。

### 要件5: 履歴との接続
| 編集操作 | 呼び出し元 | `beginEdit()`の時点（前の状態） | `commitEdit()`の時点（後の状態） | 記録されない場合 |
| --- | --- | --- | --- | --- |
| 切り取り | `ClipboardController.cut()`→`InputTracker.deleteSelection()` | `model.deleteShapes(ids)`の直前（既存の削除と同一） | `model.deleteShapes(ids)`の直後 | 選択集合が空（`deleteSelection`を呼ばない）／非受理 |
| 貼り付け | `ClipboardController.paste()`→`ShapeInserter.insertDocument` | `model.addShapesWithNewIds`の直前 | `model.addShapesWithNewIds`の直後 | クリップボードが空／追加0件 |
| 複製 | `ClipboardController.duplicate()`→`ShapeInserter.insertDocument` | 同上 | 同上 | 選択集合が空／追加0件 |

* コピーは記録しない（`beginEdit`/`commitEdit`を呼ばない）。
* **取り消し・やり直しの結果**: 前の状態の選択集合＝操作開始時（貼り付け・複製では操作前の選択、切り取りでは切り取った図形）、後の状態の選択集合＝操作完了時（貼り付け・複製では追加した図形、切り取りでは空）。したがって貼り付けを取り消すと貼り付けた図形が消えて貼り付け前の選択に戻り、切り取りを取り消すと図形が選択状態で戻り、やり直すと貼り付けた図形が選択された状態になる（既存の`restoreSnapshot`の仕様。選択モードのときのみ選択を復元）。
* **取り消し・やり直しの前後でidが変わらないこと**: スナップショットの作業データにidが含まれ、`restoreSnapshot`→`replaceAllShapes`は空でない一意な文字列idを保持する既存仕様のため、同じ図形は同じidになる。
* **取り消し後の新しい貼り付けとidの衝突（確認結果）**: `#nextId`は単調増加で、取り消し（`replaceAllShapes`）でも`max(現在値, 保持idの最大連番 + 1)`へ繰り上げるのみで減らない。そのため取り消し後に貼り付けた図形には、やり直しの履歴に残る図形のidより大きな連番が採番され、そもそも衝突しない。加えて、貼り付けは必ず図形一式を変化させる（作業データの比較で不一致）ため`commitEdit()`で記録され、その時点で既存仕様によりやり直しの履歴は破棄される。したがって二重の理由で問題は起きない。
* 再描画・削除ボタン・取り消し/やり直しボタンの同期は、`addShapesWithNewIds`の`model.onChange`（1回）と`commitEdit`の`historyManager.onChange`の既存経路のみで行う。ショートカット専用の再描画・同期は書かない。

### 要件6: キーボードショートカット
`SHORTCUT_BINDINGS`の末尾（`redo`エントリの後）に、コメント付きで次の4エントリを追加する。

| キー | エントリ | `repeatable`（決定） | 注入コールバック（`main.js`） |
| --- | --- | --- | --- |
| `Ctrl`+`C` | `{ codes: ['KeyC'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'copy' }` | `false` | `copy: () => clipboardController.copy()`（記録したら`true`） |
| `Ctrl`+`X` | `{ codes: ['KeyX'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'cut' }` | `false` | `cut: () => clipboardController.cut()`（切り取ったら`true`） |
| `Ctrl`+`V` | `{ codes: ['KeyV'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'paste' }` | `true`（押しっぱなしで連続して貼り付け、毎回1段ずつずれる） | 空なら何もせず`true`／選択モード以外なら`applyMode(SELECT)`→`clipboardController.paste()`→`true` |
| `Ctrl`+`D` | `{ codes: ['KeyD'], ctrl: true, shift: ShiftRule.FORBIDDEN, repeatable: true, action: 'duplicate' }` | `true`（押しっぱなしで連続して複製） | `clipboardController.duplicate()`→常に`true` |

* `Ctrl`+`C`／`X`のキーリピートは実行しない（`ctrl: true`の既存例外により`preventDefault()`のみ行われる。結果、押しっぱなしの2回目以降はブラウザ標準のコピーも起きない）。
* `Ctrl`+`Shift`+`C`／`X`／`V`／`D`はいずれも`FORBIDDEN`により不一致（将来のShift併用操作のために予約）。
* `V`キー単体（`ctrl: false`のモード切替）と`Ctrl`+`V`（`ctrl: true`）は既存の`#findBinding`の修飾キー照合で排他的に区別される（同一code・同一修飾キーのエントリは重複しない）。
* Meta（⌘）はCtrlと同一視する既存規則に従う。テキスト入力中・IME変換中は既存の受理判定により働かず、ブラウザ標準の文字のコピー・切り取り・貼り付けが働く（判定ロジックは変更しない）。
* `ShortcutActions` typedefに`copy`／`cut`／`paste`／`duplicate`を追加する。`#handleKeyDown`のJSDocの例外の説明（「Ctrl+=/-/0/A/Z/Yで…」）に`C/X/V/D`（ブラウザ標準のコピー・切り取り・貼り付け・ブックマーク追加）を加える。
* `index.html`は変更しない（ボタンは追加しない。REQ）。

### 要件7: `main.js`の肥大化への配慮
* `main.js`に追加するのは、importの2行、新設クラスの生成（新見出し`// 7.5. クリップボード（コピー・切り取り・貼り付け・複製）配線`。`Object.entries(modeButtons)...`のクリック登録行の後・`// 8.`の前）、`KeyboardShortcuts`への4コールバックの注入のみとする。
  * `// 7.5.`には`const shapeInserter = new ShapeInserter({ model, editRecorder: historyManager });`と`const clipboardController = new ClipboardController({ model, inserter: shapeInserter, deleteSelection: () => inputTracker.deleteSelection() });`をコメント付きで置く（`inputTracker`・`historyManager`は宣言済み）。
* 増加行数の見込み：import 2行＋生成ブロック約8行＋コールバック約18行（コメント含む）＝**約28行**（388行→約416行）。処理本体（モード判定以外の判断）は持たない。

### 要件8: 回帰防止
* 既存ファイルの変更は`VectorModel.js`（公開操作の追加とJSDoc）、`KeyboardShortcuts.js`（エントリ・typedef・JSDocの追加）、`main.js`（import・生成・注入）のみで、既存の処理の書き換えは行わない。
* `InputTracker.js`は変更しない（選択モードへの切り替えは`main.js`の`applyMode`、削除は既存の`deleteSelection()`、ドラッグ中の判定は既存の`KeyboardShortcuts`の受理判定で実現できるため）。
* 目視確認項目は5章に列挙する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/edit/` - 図形一式の編集手順（新設。`io/`・`core/`を組み合わせ、DOMに触れない）
    *   `./js/core/` - `VectorModel`（公開操作の追加）、`KeyboardShortcuts`（対応表の拡張）
    *   `./js/` - `main.js`（生成・注入の配線）
*   **関連する論理クラス**:
    *   `ShapeInserter`（新設。作業データ形式の図形の新しいidでの追加＋選択＋1件の編集操作の記録）
    *   `ClipboardController`（新設。クリップボードの保持とコピー・切り取り・貼り付け・複製の手順）
    *   `VectorModel`（`addShapesWithNewIds`の追加）
    *   `KeyboardShortcuts`（`copy`／`cut`／`paste`／`duplicate`のエントリ追加）
    *   `HistoryManager`（`EditRecorder`として注入。変更なし）、`InputTracker`（`deleteSelection`・`getMode`・`isDragging`の利用のみ。変更なし）、`DocumentSerializer`（利用のみ。変更なし）

### 参照する責務
*   **フォルダ分割の方針（1章）**: 横断的な処理（入力→状態→描画の複数層にまたがるもの）は`core/`に置く。自己完結する機能は、それぞれ専用フォルダにまとめる。
*   **2章**: 図形の共通プロパティは`type`・`id`（`VectorModel`が採番）・`strokeColor`・`strokeWidth`。図形データは全図形共通で`{ type, id, points, strokeColor, strokeWidth }`、`toJSON()`/`static fromJSON(data)`で相互変換する。`fromJSON`直後の図形の`id`は未検証・未正規化。作業データ形式は`{ format, version, shapes }`（`shapes`は描画順）で`io/DocumentSerializer.js`が変換を担う。選択集合は選択中の図形idの集合で、常に現存図形のidのみを含み、`VectorModel`が保持する。
*   **3章3.キーボード操作**: `KeyboardShortcuts`の受理判定順序は「IME変換中 → テキスト入力中（`isTextInputElement`）→ 対応表照合（修飾キー・Shift規則）→ ドラッグ中またはキーリピート → コールバック実行」。`preventDefault()`はコールバックが`true`を返した場合のみ。唯一の例外として、`ctrl: true`のエントリがドラッグ中またはキーリピートで実行されなかった場合は`preventDefault()`のみ行う。UI同期は既存経路（`applyMode`・`model.onChange`・`historyManager.onChange`等）のみ。
*   **3章6.履歴**: 変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録は行わない。前後の作業データ部分の`JSON.stringify`が一致する場合は記録しない。新たに記録するとやり直しの履歴は破棄される。後続の編集操作（複製・貼り付け等）は、変更処理を`beginEdit()`／`commitEdit()`で挟むだけで履歴の対象になる。適用は`restoreSnapshot()`：`deserialize`→`model.replaceAllShapes`→選択モードのときのみ`model.setSelection(snapshot.selectedIds)`。
*   **main.js**: 各クラスのインスタンス化・依存の注入とイベントバインドを担う。`core/`から`io/`をimportしないため、`DocumentSerializer`を使う処理は`main.js`が持つ（本作業では`edit/`の新設クラスが持つ）。モード自動切替を伴う操作（全選択→選択モード）は、コールバック内で先に`applyMode`を呼ぶ。`selectAll`は常に`true`を返す。
*   **VectorModel.js**: 描画データ（Shape配列）と選択集合を保持する単一の真実（SSOT）。図形idの採番（形式`shape-<連番>`）はprivate`#issueId()`に一本化し、連番カウンタ`#nextId`は単調増加で減らさない。id形式の知識は`VectorModel`内に閉じる。図形固有の頂点構造を意識せず`translate`等へポリモーフィックに委譲する。`VectorModel`は図形データ・作業データ形式・`DocumentSerializer`を知らない。`replaceAllShapes`はidの重複を値で判定するため、同一インスタンスを配列に重複して渡さないこと。既存の公開メソッド`addShape(shape)`は、id採番（`#issueId()`）を通さず`#shapes`へ追加するだけの操作で、現在呼び出し元はない（本作業では変更しない）。
*   **InputTracker.js**: `deleteSelection()`（受理条件：選択モード・`IDLE`・ドラッグ中でない・選択集合が空でない。受理時`beginEdit()`→`deleteShapes(ids)`→`commitEdit()`。唯一の削除経路で、呼び出し側は条件を重複判定しない）。`setMode(mode)`は「進行中操作の強制中断 → モード更新 → 選択集合/ホバー状態のクリア → カーソル再評価」。選択モード以外からの全選択は呼び出し側（`main.js`）が先にモードを切り替える。`isDragging()`はドラッグ中か。
*   **KeyboardShortcuts.js**: キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみを担う。キーは`event.code`、`Ctrl`は`Meta`と同一視、`Alt`押下時は常に不一致。Shiftは`ShiftRule`の3値で指定し、エントリ追加時は必ず値を指定する。操作の実体は`main.js`から注入されたコールバックへ委譲し（対応表の全action名の注入をコンストラクタで検証し、欠落時は`Error`をthrow）、`VectorModel`・`InputTracker`インスタンス・DOMのボタン要素を参照しない。新しいショートカットは対応表へのエントリ追加（＋注入コールバックの追加）で対応する。
*   **HistoryManager.js**: importを持たず、DOM・図形種別・作業データの中身を知らない。`beginEdit()`／`commitEdit(): boolean`。進行中の入力操作の中断は呼び出し側の責務。
*   **DocumentSerializer.js**: 静的メソッドのみ・DOM非依存。`serialize(shapes)`は新しい作業データ（図形インスタンスを共有しない）、`deserialize(documentData)`は例外をthrowせず`DeserializeResult`（`{ ok, shapes, skipped, error }`）を返し、引数を書き換えない。
*   **shapes/**: `translate(dx, dy)`・`toJSON()`・`static fromJSON(data)`を含む12メソッド契約。`fromJSON`/`toJSON`は内部配列・頂点オブジェクトを共有しない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**: フォルダ構造に`js/edit/`（`ShapeInserter.js`・`ClipboardController.js`）を追加。フォルダ分割の方針に「`io/`・`core/`を組み合わせて図形一式を編集する手順は`edit/`に置く（依存方向`main.js → edit → io → core → shapes`）」を追記。
*   **3章1.**: 起動処理のインスタンス化一覧に`ShapeInserter`・`ClipboardController`を追加。
*   **3章3.キーボード操作**: 注入コールバックの列挙に`copy`/`cut`/`paste`/`duplicate`（`ClipboardController`経由）を追加し、`ctrl: true`の例外による`preventDefault()`の例にブラウザ標準のコピー・切り取り・貼り付け・ブックマーク追加を加える。
*   **3章に新項目「7. コピー・貼り付け・複製の流れ」**: クリップボードの保持内容（作業データ形式のオブジェクト、図形インスタンスを参照しない、履歴の対象外、キャンバス切り替えで消えない）、コピー・切り取り・貼り付け・複製の流れ、ずらし量（`PASTE_OFFSET_STEP`＝20）と段数の規則、選択モード以外での貼り付け、`ShapeInserter.insertDocument`の処理順。
*   **3章6.履歴の「記録の流れ」**: 編集操作の一覧に、切り取り（`deleteSelection`経由で削除と同一）・貼り付け・複製（`ShapeInserter.insertDocument`：`addShapesWithNewIds`の前後）を追加。「後続の編集操作（複製・貼り付け等）は…」の未来形の記述を、インポート（Phase 03-05。`ShapeInserter`再利用）等の記述へ更新。
*   **4章`main.js`**: `// 7.5.`のクリップボード配線（生成・注入）と、キーボードショートカット配線の注入コールバック一覧に`copy`/`cut`/`paste`/`duplicate`（`paste`は空なら何もしない・選択モード以外では先に`applyMode`、`paste`/`duplicate`は常に`true`）を追加。あわせて「`core/`から`io/`をimportしないため、`DocumentSerializer`を使う処理は`main.js`が持つ」の文を、「`DocumentSerializer`を使う処理は`main.js`と`edit/`が持つ」旨へ修正する。
*   **4章`VectorModel.js`**: 公開操作`addShapesWithNewIds(shapes)`（新しいidでの末尾追加・追加図形のみの選択・重複インスタンスの除外・通知1回）を追加し、`#issueId()`の利用箇所の列挙に加える。
*   **4章`KeyboardShortcuts.js`**: 対応表に`Ctrl`+`C`/`X`/`V`/`D`を追加、キーリピートの実行対象に貼り付け・複製を追加、`V`と`Ctrl`+`V`の区別。（タスク5追記）`paste`/`duplicate`のコールバックはドラッグ中を自ら判定せず、ドラッグ中は受理判定で呼ばれないこと（`undo`/`redo`がコールバック内で判定するのとの違い）を記載する。
*   **4章`HistoryManager.js`・`InputTracker.js`**: 編集操作の一覧（`InputTracker.js`の「編集操作の通知」には切り取りが`deleteSelection()`経由で記録されることを、`HistoryManager.js`の項には記録元として`ShapeInserter`を）追記。
*   **4章に新項目`edit/`**: `ShapeInserter.js`・`ClipboardController.js`の責務・公開API・前提（選択モード・ドラッグ中でない）・依存の制約（DOM・図形種別・id形式を知らない、`InputTracker`に依存しない）。

## 3. タスクリスト
*   [x] タスク1: `VectorModel`に新しいidで図形を追加する公開操作を追加
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
    *   **作業内容** :
        *   公開メソッド`addShapesWithNewIds(shapes)`を2章「`VectorModel.addShapesWithNewIds(shapes)`の仕様」のとおり追加する（`replaceAllShapes`の直前または直後に配置）。
            *   重複インスタンスの判定は、既存の`#shapes`のインスタンスと処理済みインスタンスの`Set`（インスタンス参照）で行い、該当要素は`console.warn`のうえ追加しない。
            *   id採番は`#issueId()`のみを用い、id形式を組み立てる処理を新たに書かない。
            *   選択集合は追加した図形のidで置き換える（`#selectedIds`を新しい`Set`にする）。ホバー・作成中の図形・選択矩形には触れない。
            *   1件以上追加した場合のみ`#notifyChange()`を1回呼ぶ。戻り値は追加した図形の新しいidの配列。
        *   JSDocに、効果（末尾＝最前面へ引数の順で追加）・idの上書き（引数の図形のidは引き継がない。既存図形と衝突しない理由＝`#nextId`の単調増加）・追加した図形だけを選択する規則・重複インスタンスの除外・通知回数・戻り値・前提（呼び出し側が選択モードであることを保証する。選択集合は選択モード以外では空という不変条件のため）・図形インスタンスは`id`の代入以外で触れないことを記載する。
        *   `#issueId()`と`#nextId`のJSDocの採番箇所の列挙（「commitDraft・replaceAllShapes」）に`addShapesWithNewIds`を加える。
        *   先頭行の責務JSDoc・クラスJSDocが実態と一致していることを確認する（変更不要の見込み）。図形種別の分岐・図形固有のプロパティ名を持ち込まないこと。
        *   本タスクでは他ファイルを変更しない（呼び出し元がないためアプリの動作は変わらない）。
*   [x] タスク2: `ShapeInserter`の新設
    *   **対象ファイル** :
        *   `./js/edit/ShapeInserter.js` :（新規。フォルダ`js/edit/`も新設）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）を記載する。案：「責務：作業データ形式のオブジェクトの図形を、平行移動したうえで新しいidで現在のキャンバスの最前面へ追加し、追加した図形だけを選択する1件の編集操作を担う（貼り付け・複製・インポートの共通処理）。DOMに触れない。」
        *   importは`../io/DocumentSerializer.js`の`DocumentSerializer`のみ（`VectorModel`・`HistoryManager`はimportせず、インスタンスを注入で受け取る）。
        *   JSDoc typedef：`EditRecorder`（`{ beginEdit(): void, commitEdit(): boolean }`。実体は`main.js`が注入する`HistoryManager`）、`InsertResult`（`{ ok, insertedIds, skipped, error }`。各項目の意味を記載）。
        *   クラス`ShapeInserter`：`constructor({ model, editRecorder })`（privateフィールド`#model`・`#editRecorder`に保持）、`insertDocument(documentData, dx = 0, dy = 0)`を2章「`ShapeInserter.insertDocument`の仕様」の処理順で実装する。
        *   JSDocに、処理順・ずらし量の引数の意味（ワールド座標。インポートでは0）・毎回新しい図形インスタンスを生成すること（独立性）・スキップの扱い・履歴への記録単位（追加1件以上で1件の編集操作。0件・全体失敗では記録しない）・前提（選択モード・ドラッグ中/作成途中の図形がないことは呼び出し側の責務。モード切替・中断は行わない）・図形種別の分岐・図形固有のプロパティ名・id形式を持たないことを記載する。
        *   本タスクでは他ファイルを変更しない（未使用のファイルのためアプリの動作は変わらない）。
*   [x] タスク3: `ClipboardController`の新設
    *   **対象ファイル** :
        *   `./js/edit/ClipboardController.js` :（新規）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）を記載する。案：「責務：アプリ内部のクリップボード（コピー・切り取りした図形一式と貼り付けの段数）の保持と、コピー・切り取り・貼り付け・複製の手順を担う。DOMに触れない。」
        *   importは`../io/DocumentSerializer.js`の`DocumentSerializer`のみ（`ShapeInserter`はインスタンスを注入で受け取る。`InputTracker`はimportしない）。
        *   モジュール定数`PASTE_OFFSET_STEP = 20`（exportしない）をJSDoc付きで定義する（1段のずらし量。ワールド座標＝倍率100%で画面上20px。貼り付け・複製の唯一の定義箇所）。
        *   クラス`ClipboardController`：
            *   `constructor({ model, inserter, deleteSelection })`（`deleteSelection`が関数でなければ`Error`をthrow）。privateフィールド`#model`・`#inserter`・`#deleteSelection`・`#documentData = null`・`#nextPasteStep = 0`。
            *   private`#serializeSelection()`：選択集合の図形を描画順で`DocumentSerializer.serialize`した作業データを返す（選択集合が空なら`null`）。
            *   `copy()`・`cut()`・`paste()`・`duplicate()`・`isEmpty()`を2章要件2〜4のとおり実装する。
        *   JSDocに次を記載する：クリップボードの保持内容（作業データ形式のオブジェクト・図形インスタンスを参照しない・外部へ返さず書き換えない・履歴の対象外で取り消し/やり直しで変わらない・インスタンスはページを開いている間保持され、キャンバスを切り替えても消えない）／各操作の効果と受理条件・戻り値（コピー・切り取りで何もしなかった場合は`false`＝`preventDefault()`しない理由）／段数の規則（コピーで1・切り取りで0にリセット、貼り付けで追加するたびに+1、複製・取り消し・やり直しでは不変）／切り取りの削除が既存の削除経路（`deleteSelection`）を通り、削除と同じ結果・1件の編集操作になること／貼り付け・複製の前提（選択モード・ドラッグ中でないことは呼び出し側の責務。本クラスは操作モードを知らない）／図形種別の分岐・図形固有のプロパティ名・id形式を持たないこと。
        *   本タスクでは他ファイルを変更しない（未使用のファイルのためアプリの動作は変わらない）。
*   [x] タスク4: ショートカットの追加と`main.js`の配線
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `KeyboardShortcuts.js`：
            *   `SHORTCUT_BINDINGS`の末尾（`redo`の`KeyY`エントリの後）に、コメント（「コピー・切り取り（キーリピートでは実行しない）・貼り付け・複製（押しっぱなしで連続実行できるようrepeatable: true）」）とともに2章要件6の4エントリを追加する。既存エントリは変更しない。
            *   `ShortcutActions` typedefに`copy`／`cut`／`paste`／`duplicate`を追加する（要約：コピー・切り取りは記録・切り取りした場合のみ`true`／貼り付けは空なら何もしない・選択モード以外では選択モードへ切り替えてから貼り付け・ドラッグ中でなければ常に`true`／複製はブックマーク追加の抑止のため常に`true`）。
            *   `SHORTCUT_BINDINGS`のJSDocの修飾キー規則に「`V`単体（モード切替）と`Ctrl`+`V`（貼り付け）は`ctrl`で排他的に区別される」を、`#handleKeyDown`のJSDocの例外の説明に`Ctrl`+`C`/`X`/`V`/`D`（ブラウザ標準のコピー・切り取り・貼り付け・ブックマーク追加）を追記する。判定ロジック（`#handleKeyDown`・`#findBinding`・`#matchesShiftRule`）は変更しない。
            *   先頭行の責務JSDocが実態と一致していることを確認する（変更不要の見込み）。
        *   `main.js`（`KeyboardShortcuts`のエントリ追加と同一タスクで行うこと。注入漏れは起動時`Error`になる）：
            *   `import { ShapeInserter } from './edit/ShapeInserter.js';`と`import { ClipboardController } from './edit/ClipboardController.js';`を追加する。
            *   `Object.entries(modeButtons).forEach(...)`の行の後・`// 8. キーボードショートカット配線`の前に、見出し`// 7.5. クリップボード（コピー・切り取り・貼り付け・複製）配線`と、2章要件7の生成2行をコメント付きで置く（コメント：処理本体は`edit/`の新設クラスが持ち、ここは生成と注入のみ／切り取りの削除は既存の唯一の削除経路`inputTracker.deleteSelection()`を注入する）。
            *   `new KeyboardShortcuts({...})`の末尾（`redo: performRedo,`の後）に、2章要件6の4コールバックをコメント付きで追加する（`paste`は「空なら何もしない（モードも切り替えない）→選択モード以外なら`applyMode(OperationMode.SELECT)`→`clipboardController.paste()`→常に`true`」、`duplicate`は「`clipboardController.duplicate()`→常に`true`（ブックマーク追加の抑止）」）。
            *   再描画・ボタン同期の呼び出しを追加しない（`model.onChange`・`historyManager.onChange`経路に任せる）。`window`への公開を行わない。
            *   先頭行の責務JSDoc（「各モジュールの初期化と連携(依存性の注入)を担う」）が実態と一致していることを確認する（変更不要の見込み）。
        *   本タスク完了時点でコピー・切り取り・貼り付け・複製が動作する。
*   [x] タスク5: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js`、`./js/edit/ShapeInserter.js`、`./js/edit/ClipboardController.js`、`./js/core/KeyboardShortcuts.js`、`./js/main.js` :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261103_2359_RES_Phase03-03_Copy_Paste.md` :（更新）
    *   **作業内容** :
        *   JSDocの記載漏れがないことを確認する。特に次がJSDocから読み取れること：クリップボードの保持内容と独立性／コピー・切り取り・貼り付け・複製の効果と受理条件／ずらし量と段数の規則／貼り付け時のidの採番／追加した図形だけを選択する規則／選択モード以外での貼り付けの扱い／履歴への記録単位／ショートカットの修飾キーとキーリピートの扱い。
        *   改修・新設した全`.js`ファイルの先頭行の責務JSDoc（3行以内）が実態と一致していることを確認する。
        *   `main.js`の行数を数え、2章要件7の見込み（約416行）との差を4章に記録する。
        *   本RESの「4. 詳細作業内容」を全タスク分記載し、「開発資料の更新予定」「懸念事項・要確認ポイント」に実装中の判明事項を追記する。
*   [x] タスク6: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   本RESの「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」を確認し、1章（`js/edit/`の新設ファイルとフォルダ分割の方針）、3章（起動処理の一覧、キーボード操作の注入コールバック、コピー・貼り付け・複製の流れ（新項目）、編集操作の一覧（3章6.））、4章（`edit/`の新設クラスの責務、`VectorModel.js`の`addShapesWithNewIds`、`KeyboardShortcuts.js`の対応表、`HistoryManager.js`・`InputTracker.js`の編集操作の一覧、`main.js`の配線）へ反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする（REQの固定タスク）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `VectorModel`に新しいidで図形を追加する公開操作を追加
*   **作業内容** :
    *   `./js/core/VectorModel.js`：`replaceAllShapes`の直後に公開メソッド`addShapesWithNewIds(shapes)`を追加した。
        *   既存の`#shapes`のインスタンスを入れた`Set`と、処理済みインスタンスの`Set`（いずれもインスタンス参照）で重複を判定し、該当要素は`console.warn`のうえスキップする。
        *   それ以外は引数の順に`shape.id = this.#issueId()`で上書きして`#shapes`の末尾へ`push`し、新しいidを戻り値の配列へ積む（id形式を組み立てる処理は新たに書いていない）。
        *   追加0件なら何も変更せず（通知もせず）空配列を返す。1件以上なら`#selectedIds = new Set(追加したid)`で選択集合を置き換え、`#notifyChange()`を1回呼んで追加したidの配列（描画順）を返す。ホバー・作成中の図形・選択矩形には触れない。
        *   JSDocに、効果（末尾＝最前面へ引数の順で追加）・idの上書きと衝突しない理由（`#nextId`の単調増加）・重複インスタンスの除外・追加した図形だけを選択する規則・通知回数・戻り値・前提（呼び出し側が選択モードを保証）・`id`の代入以外で図形に触れないことを記載した。
    *   `#issueId()`のJSDocの採番箇所の列挙を「commitDraft・replaceAllShapes・addShapesWithNewIds」に更新した。`#nextId`のJSDocには採番箇所の列挙が元々なかったため、「#issueId()による採番（commitDraft・replaceAllShapes・addShapesWithNewIds）で1ずつ増える」の1行を追記した。
    *   先頭行の責務JSDoc・クラスJSDocは実態と一致しているため変更していない。図形種別の分岐・図形固有のプロパティ名は持ち込んでいない。`node --check`で構文エラーがないことを確認した。他ファイルは変更していない。

### タスク2: `ShapeInserter`の新設
*   **作業内容** :
    *   フォルダ`js/edit/`を新設し、`./js/edit/ShapeInserter.js`を新規作成した。
        *   先頭に責務JSDoc（本文2行）を記載した。importは`../io/DocumentSerializer.js`の`DocumentSerializer`のみ（`VectorModel`・`HistoryManager`は型注釈の`import()`型参照のみで、実行時のimportはしていない）。
        *   typedef`EditRecorder`（`InputTracker.js`の同名typedefと同じ内容で本ファイルにも定義）と`InsertResult`（`ok`・`insertedIds`・`skipped`・`error`。`skipped`の要素型は`DocumentSerializer.js`の`SkippedShape`を参照）を定義した。
        *   クラス`ShapeInserter`：`constructor({ model, editRecorder })`でprivateフィールド`#model`・`#editRecorder`に保持。`insertDocument(documentData, dx = 0, dy = 0)`を2章の処理順（deserialize→`ok: false`なら`insertedIds: []`で返す→0件なら何もせず返す→`dx`/`dy`がともに0でなければ各図形に`translate`→`beginEdit`→`addShapesWithNewIds`→`commitEdit`→結果を返す）で実装した。
        *   `ok: false`の場合も`skipped`・`error`は`DeserializeResult`の値（`skipped`は空配列）をそのまま返す。
        *   JSDocに、処理順・ずらし量の引数の意味（ワールド座標。インポートでは0）・独立性（毎回新しいインスタンス、`documentData`を書き換えない）・スキップの扱い・履歴への記録単位（1件以上追加で1件、失敗・0件では`beginEdit`/`commitEdit`を呼ばない）・前提（選択モード・ドラッグ中/作成途中の図形がないことは呼び出し側の責務、モード切替・中断は行わない）・依存の制約（DOM・図形種別・図形固有のプロパティ名・id形式を持たない、`InputTracker`に依存しない）を記載した。
    *   `node --check`で構文エラーがないことを確認した。他ファイルは変更していない（未使用ファイルのためアプリの動作は変わらない）。

### タスク3: `ClipboardController`の新設
*   **作業内容** :
    *   `./js/edit/ClipboardController.js`を新規作成した。
        *   先頭に責務JSDoc（本文2行）を記載した。importは`../io/DocumentSerializer.js`の`DocumentSerializer`のみ（`VectorModel`・`ShapeInserter`・`DocumentData`は型注釈の`import()`型参照のみ。`InputTracker`は参照しない）。
        *   モジュール定数`PASTE_OFFSET_STEP = 20`（exportしない）をJSDoc付きで定義した。
        *   クラス`ClipboardController`：`constructor({ model, inserter, deleteSelection })`（`deleteSelection`が関数でなければ`Error`をthrow）、privateフィールド`#model`・`#inserter`・`#deleteSelection`・`#documentData = null`・`#nextPasteStep = 0`。
        *   private`#serializeSelection()`：`getShapes().filter(isSelected)`で描画順の選択図形を得て、空なら`null`、それ以外は`DocumentSerializer.serialize`の結果を返す。
        *   `isEmpty()`：`#documentData === null`。
        *   `copy()`：選択集合が空なら`false`。それ以外は`#documentData`を置き換え、`#nextPasteStep = 1`で`true`。
        *   `cut()`：選択集合が空なら`false`。先にserializeして手元に保持し、`#deleteSelection()`が`true`の場合のみ`#documentData`を置き換え`#nextPasteStep = 0`で`true`、非受理なら`false`（クリップボード不変）。
        *   `paste()`：空なら`false`。`offset = #nextPasteStep × PASTE_OFFSET_STEP`で`inserter.insertDocument(#documentData, offset, offset)`を呼び、`insertedIds`が1件以上なら段数を+1して`true`、0件なら段数を変えず`false`。
        *   `duplicate()`：選択集合が空なら`false`。それ以外はserializeした作業データを`insertDocument(…, PASTE_OFFSET_STEP, PASTE_OFFSET_STEP)`へ渡し、1件以上追加で`true`。`#documentData`・`#nextPasteStep`は変えない。
        *   JSDocに、クリップボードの保持内容（作業データ形式・図形インスタンス非参照・外部へ返さず書き換えない・履歴の対象外・ページを開いている間保持されキャンバス切り替えで消えない）、各操作の効果・受理条件・戻り値（コピー・切り取りで何もしなかった場合に`false`を返す理由）、段数の規則、切り取りが既存の削除経路を通ること、貼り付け・複製の前提（呼び出し側の責務）、依存の制約を記載した。
    *   `node --check`で構文エラーがないことを確認した。他ファイルは変更していない（未使用ファイルのためアプリの動作は変わらない）。

### タスク4: ショートカットの追加と`main.js`の配線
*   **作業内容** :
    *   `./js/core/KeyboardShortcuts.js`：
        *   `SHORTCUT_BINDINGS`の末尾（`KeyY`の`redo`エントリの後）に、コメント付きで`copy`（`KeyC`・`repeatable: false`）／`cut`（`KeyX`・`false`）／`paste`（`KeyV`・`true`）／`duplicate`（`KeyD`・`true`）の4エントリ（いずれも`ctrl: true`・`ShiftRule.FORBIDDEN`）を追加した。既存エントリは変更していない。
        *   `ShortcutActions` typedefに`copy`／`cut`／`paste`／`duplicate`の説明を追加した。
        *   `SHORTCUT_BINDINGS`のJSDocの修飾キー規則に「KeyVは`ctrl`の値でV単体（選択モード）と`Ctrl`+`V`（貼り付け）に排他的に区別される」を、`#handleKeyDown`のJSDocの例外の説明に`C/X/V/D`（標準のコピー・切り取り・貼り付け・ブックマーク追加）を追記した。判定ロジック（`#handleKeyDown`・`#findBinding`・`#matchesShiftRule`）は変更していない。先頭行の責務JSDocは実態と一致しているため変更していない。
    *   `./js/main.js`：
        *   `ShapeInserter`・`ClipboardController`のimport 2行を`DevPanel`のimportの後に追加した。
        *   モードボタンのクリック登録行の後・`// 8.`の前に、見出し`// 7.5. クリップボード（コピー・切り取り・貼り付け・複製）配線`とコメント付きで`shapeInserter`・`clipboardController`の生成を置いた（`deleteSelection`には`() => inputTracker.deleteSelection()`を注入）。
        *   `new KeyboardShortcuts({...})`の`redo: performRedo,`の後に、コメント付きで4コールバックを追加した：`copy`／`cut`は`clipboardController.copy()`／`cut()`の戻り値をそのまま返す。`paste`は`isEmpty()`なら何もせず`true`、選択モード以外なら`applyMode(OperationMode.SELECT)`の後に`clipboardController.paste()`を呼び常に`true`。`duplicate`は`clipboardController.duplicate()`を呼び常に`true`。
        *   再描画・ボタン同期の呼び出し、`window`への公開は追加していない。先頭行の責務JSDocは実態と一致しているため変更していない。
    *   `node --check`で両ファイルに構文エラーがないことを確認した。`main.js`は418行（見込み約416行に対し+2行。生成ブロックのコメントを3行としたため）。

### タスク5: JSDocの確認とRESの完成
*   **作業内容** :
    *   改修・新設した5ファイル（`VectorModel.js`・`ShapeInserter.js`・`ClipboardController.js`・`KeyboardShortcuts.js`・`main.js`）のJSDocを確認し、次の項目がJSDocから読み取れることを確認した。
        *   クリップボードの保持内容と独立性：`ClipboardController`のクラスJSDoc・`#documentData`。
        *   コピー・切り取り・貼り付け・複製の効果と受理条件：`ClipboardController`の各メソッドJSDoc、`ShortcutActions` typedef。
        *   ずらし量と段数の規則：`PASTE_OFFSET_STEP`・クラスJSDocの段数の規則・`#nextPasteStep`。
        *   貼り付け時のidの採番：`VectorModel.addShapesWithNewIds`の(1)、`#issueId()`・`#nextId`の採番箇所の列挙、`ShapeInserter.insertDocument`の独立性。
        *   追加した図形だけを選択する規則：`addShapesWithNewIds`の(3)、`ShapeInserter`の責務JSDoc・`insertDocument`。
        *   選択モード以外での貼り付けの扱い：`main.js`の`paste`コールバックのコメント、`ShortcutActions`の`paste`、`ClipboardController`・`ShapeInserter`の前提。
        *   履歴への記録単位：`ShapeInserter.insertDocument`の「履歴への記録単位」、`ClipboardController.cut()`（既存の削除経路で1件）・`copy()`（記録しない）。
        *   ショートカットの修飾キーとキーリピートの扱い：`SHORTCUT_BINDINGS`のJSDoc（`V`と`Ctrl`+`V`の区別）とエントリのコメント、`#handleKeyDown`のJSDocの例外（`C/X/V/D`）。
    *   タスク4監査の観点外メモを受け、`KeyboardShortcuts.js`の`ShortcutActions` typedefの`paste`の説明「ドラッグ中でなければ常にtrue」を、「クリップボードが空でも常にtrue（ブラウザ標準の貼り付けを起こさないため。ドラッグ中は受理判定（#handleKeyDownの手順4）によりそもそも呼ばれない）」へ書き換えた（JSDocのみ。2行）。`undo`/`redo`の同様の表現は、`performUndo`/`performRedo`自身がドラッグ中を判定して`false`を返す実態どおりのため変更していない。
    *   5ファイルの先頭行の責務JSDoc（いずれも3行以内）が実態と一致していることを確認した（変更なし）。
    *   `main.js`は418行（2章要件7の見込み約416行に対し+2行。タスク4で生成ブロックのコメントを3行としたため。タスク5での変更なし）。
    *   5ファイルとも`node --check`で構文エラーがないことを確認した。

### タスク6: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   `./PROJECT_ARCHITECTURE.md`に「開発資料の更新予定」の各項目を反映した。
        *   1章：フォルダ構造に`js/edit/`（`ShapeInserter.js`・`ClipboardController.js`）を追加。フォルダ分割の方針に`edit/`の置き場所の基準と依存方向`main.js → edit → io → core → shapes`（`core/`・`io/`は`edit/`をimportしない）を追記。
        *   3章1.：インスタンス化一覧に`ShapeInserter`・`ClipboardController`を追加。
        *   3章3.キーボード操作：`ctrl: true`の例外による抑止の例にコピー・切り取り・貼り付け・ブックマーク追加を、注入コールバックの列挙に`ClipboardController`の`copy`・`cut`・`paste`・`duplicate`を追加。
        *   3章6.記録の流れ：切り取り（`deleteSelection`経由で削除と同一）・貼り付け・複製（`addShapesWithNewIds`の前後）・コピーは記録しないことを追加。「後続の編集操作（複製・貼り付け等）」をインポート（Phase 03-05。`ShapeInserter`再利用の想定）の記述へ更新。
        *   3章に新項目「7. コピー・貼り付け・複製」：クリップボード、コピー・切り取り、貼り付け・複製（ずらし量・段数）、選択モード以外での貼り付け、`insertDocument`の処理順、再描画経路。
        *   4章`main.js`：「`DocumentSerializer`を使う処理は`main.js`と`edit/`が持つ」へ修正。新項目「クリップボード配線」（`// 7.5.`）を追加。キーボードショートカット配線に4コールバックとその戻り値・`paste`のモード切替・ドラッグ中を自ら判定しない点（`undo`/`redo`との違い）を追記。
        *   4章`VectorModel.js`：`#issueId()`の利用箇所に`addShapesWithNewIds()`を追加し、新項目「新しいidでの追加」（効果・重複インスタンスの除外・選択・通知・前提・`addShape`を使わないこと）を追加。
        *   4章`InputTracker.js`：`deleteSelection()`の唯一の削除経路の利用元と、編集操作の通知の削除に切り取りを追記。
        *   4章`KeyboardShortcuts.js`：`Ctrl`+`C`/`X`/`V`/`D`のエントリ、`V`と`Ctrl`+`V`の区別、キーリピートの実行対象に貼り付け・複製を追加。
        *   4章`HistoryManager.js`：変更通知の項に`beginEdit`/`commitEdit`の呼び出し元（`InputTracker`・`main.js`・`ShapeInserter`）を追記。
        *   4章に新項目`edit/`（共通の制約・前提、`ShapeInserter.js`・`ClipboardController.js`の責務・公開API・注意点）を`palette/`と`io/`の間に追加。`io/DocumentSerializer.js`の依存方向の記述に`edit/`から利用される旨を追記。
    *   ソースコードは変更していない。

## 5. 懸念事項・要確認ポイント
* **新設フォルダ`js/edit/`**: `core/`から`io/`をimportしない方針と、`io/`に編集手順を混ぜない判断から新設した（2章「置き場所の判断理由」）。Phase 03-04で`main.js`の`captureSnapshot`/`restoreSnapshot`を切り出す際も、`DocumentSerializer`と`VectorModel`を組み合わせる処理であるため、同じ`edit/`が置き場所の候補になる。
* **貼り付け・複製の前提は呼び出し側の責務**: `ShapeInserter`・`ClipboardController`は操作モードを知らない。選択モード以外で`insertDocument`を呼ぶと「選択集合は選択モード以外では常に空」の不変条件が崩れるため、Phase 03-05のインポートで再利用する際は、呼び出し側で先に選択モードへの切り替え（`applyMode`）と進行中の入力操作の中断を行うこと。
* **既存の`VectorModel.addShape(shape)`との併存**: `VectorModel`には、id採番を通らず`#shapes`へ追加するだけの既存公開メソッド`addShape(shape)`（呼び出し元なし）があり、本作業後は追加の公開操作が`addShape`と`addShapesWithNewIds`の2つ並ぶ。貼り付け・複製・インポート等で図形を追加する場合は必ず`addShapesWithNewIds`を使い、`addShape`は使わないこと（idの重複・未採番を防ぐため）。`addShape`の扱い（削除等）は本作業の範囲外とする。
* **`addShapesWithNewIds`は引数の図形インスタンスの`id`を書き換える（タスク1）**: 受け取ったインスタンスをそのまま`#shapes`へ保持し`id`を上書きするため、呼び出し側は追加後にそのインスタンスを他の用途（別キャンバスへの追加等）に流用しないこと。`ShapeInserter`は毎回`deserialize`で新しいインスタンスを作るため問題ない。また、重複判定はインスタンス参照のみで行い、id文字列の値では判定しない（idは常に上書きするため不要）。
* **`EditRecorder` typedefの重複定義（タスク2）**: `ShapeInserter.js`は`InputTracker.js`をimportしない方針のため、`EditRecorder` typedefを`InputTracker.js`と同じ内容で本ファイルにも定義した。将来`EditRecorder`の形（メソッド）を変える場合は、両ファイルのtypedefを揃えて更新すること。
* **`cut()`はserializeを削除の前に行う（タスク3）**: 削除後は選択集合が空になり図形も消えるため、先に作業データへ変換して手元に保持し、削除が受理された場合のみクリップボードへ反映している。この順序を入れ替えないこと。
* **`ClipboardController`は`deleteSelection`のみ型検証する（タスク3）**: コンストラクタは`deleteSelection`が関数かのみ検証し、`model`・`inserter`は検証しない（RESの指定どおり）。注入漏れは呼び出し時の例外で判明する。
* **スキップの扱い**: `insertDocument`は一部がスキップされても読めた図形を追加する（貼り付け・複製では通常起きない）。インポートでスキップを利用者へ通知する方法はPhase 03-05で決める（戻り値の`skipped`で取得できる）。
* **`Ctrl`+`C`/`X`のキーリピート**: `repeatable: false`のため押しっぱなしの2回目以降は実行されないが、`ctrl: true`の既存例外により`preventDefault()`は行われる（選択集合が空の場合でも、2回目以降はブラウザ標準のコピーが起きない）。実害はない想定だが、ページ上の文字を押しっぱなしでコピーする操作は通常ないため許容する。
* **`paste`コールバックの空判定の二重化（タスク4）**: `main.js`の`paste`コールバックは`isEmpty()`を先に確認してからモード切替・`paste()`を呼ぶ（空振りでモードを変えないため）。`ClipboardController.paste()`自身も空なら`false`を返すため判定は二重になるが、RESの指定どおりであり意図的。将来`paste`の受理条件を変える場合は両方を確認すること。
* **`copy`/`cut`のショートカットは選択集合が空ならpreventDefaultしない（タスク4）**: 選択モードで図形を選択していない状態の`Ctrl`+`C`はブラウザ標準のコピーへ素通りする（`?dev`の結果表示欄で選択した文字のコピーを妨げないため。2章要件2の決定どおり）。目視確認では、図形未選択時の`Ctrl`+`C`で異常が起きないことも確認すること。
* **`ShortcutActions`の「常にtrue」の意味の違い（タスク5）**: `undo`/`redo`の「ドラッグ中でなければ常にtrue」はコールバック（`performUndo`/`performRedo`）自身がドラッグ中を判定して`false`を返すことを表す。一方`paste`/`duplicate`のコールバックはドラッグ中を判定せず、ドラッグ中は`KeyboardShortcuts`の受理判定（手順4）で呼ばれないだけである。`paste`の説明はこの違いが読み取れる表現へ修正した。将来`paste`/`duplicate`をショートカット以外（ボタン等）から呼ぶ場合は、ドラッグ中の判定を呼び出し側で別途行う必要がある。
* **開発資料への反映（タスク6）**: `HistoryManager.js`の項の「呼び出し元」は、`main.js`（`?dev`の復元）が`historyManager`を直接呼ぶのに対し、`InputTracker`・`ShapeInserter`は`EditRecorder`として注入で受け取る違いが分かる表現にした。3章3.の「入力監視」冒頭の操作列挙（マウスドラッグ…キーボードショートカット）はコピー等を個別に列挙していないため変更していない（3章7.を新設して記載）。
* **`main.js`の行数**: 実測418行（タスク4完了時点。見込み約416行）。Phase 03-04の切り出し検討（`_doc/COWORK_STATUS.md` 2章P3【03-04へ】）の際に考慮すること。
* **テストプレイでの目視確認項目**:
    * 単一・複数選択の図形を`Ctrl`+`C`→`Ctrl`+`V`で貼り付けると、右下（20, 20）にずれて貼られ、貼った図形だけが選択される（複数選択時は重なり順も元と同じ）。
    * 続けて`Ctrl`+`V`を押すと、さらに右下（40, 40）…へずれる。もう一度`Ctrl`+`C`すると段数がリセットされ、次の貼り付けは（20, 20）からになる。
    * `Ctrl`+`X`で図形が消え（削除ボタンが押せない状態になる）、`Ctrl`+`V`で元の位置に戻る。続けて`Ctrl`+`V`で（20, 20）ずれる。
    * `Ctrl`+`D`で（20, 20）ずれた複製ができて複製だけが選択され、続けて押すと階段状に並ぶ。`Ctrl`+`D`の後の`Ctrl`+`V`は、クリップボードの内容・段数が変わっていないことを確認する。
    * 貼った図形・複製した図形を変形・移動・削除しても元の図形が変わらない（逆も同様）。コピー後に元の図形を変形・削除してから貼り付けても、コピー時点の形で貼られる。
    * 5種の図形（直線・曲線・弧・矩形・円）すべてで貼り付け・複製ができ、形・線の色・太さが元と同じになる。
    * 貼り付け・切り取り・複製がそれぞれ`Ctrl`+`Z`1回で取り消され（貼り付け・複製の取り消しでは操作前の選択に戻る、切り取りの取り消しでは図形が選択状態で戻る）、`Ctrl`+`Y`でやり直せる（貼った図形が選択された状態）。取り消し・やり直しボタンも同じ結果になる。
    * コピーは取り消しの対象にならない（`Ctrl`+`C`の後の`Ctrl`+`Z`はその前の編集操作を取り消す）。取り消し・やり直しの後も、クリップボードの内容・段数は変わらない。
    * 図形作成モード・キャンバス移動モードで`Ctrl`+`V`を押すと、選択モードに切り替わって（モードボタンの表示・パレットの非活性化を含む）貼られる。クリップボードが空なら何も起きず、モードも変わらない。
    * 図形作成モードで作成途中の図形がある状態で`Ctrl`+`V`を押すと、作成途中の図形が破棄されて選択モードで貼られる（取り消しで作成途中の図形は戻らない）。
    * `Ctrl`+`D`でブラウザのブックマーク画面が出ない（何も選択していないとき・図形作成モード・キャンバス移動モード・ドラッグ中も）。
    * `V`キー単体は従来どおり選択モードへの切り替えのまま。`Ctrl`+`Shift`+`V`等では何も起きない。
    * `?dev`の確認用ウィンドウのテキスト入力欄では、`Ctrl`+`C`/`X`/`V`が文字のコピー・切り取り・貼り付けになり、図形のコピー等は起きない。
    * 押しっぱなしで連続して貼り付け・複製できる。`Ctrl`+`C`/`X`は押しっぱなしでも1回だけ実行される。
    * 何度も貼り付け・複製・取り消し・やり直しを繰り返しても、idの衝突による異常（クリックで別の図形が選択される、削除・移動が別の図形に効く等）がない。`?dev`の「JSONへ変換」で各図形のidが重複していないことも確認する。
    * ドラッグ中（本体ドラッグ・ハンドル操作・範囲選択・パン）に`Ctrl`+`C`/`X`/`V`/`D`を押しても何も起きない。
    * 既存操作の回帰がない：図形作成5種・クリック選択・範囲選択・本体ドラッグ・ハンドル操作・削除ボタン・取り消し/やり直し（ボタン・ショートカット）・全ショートカット・パン3通り・ホイールズーム・倍率表示・リセット・モードボタン・図形パレットのハイライトと活性/非活性・`?dev`の確認用ウィンドウ・原点表示。
