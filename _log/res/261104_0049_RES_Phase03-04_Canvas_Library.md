# RES: 作業計画・作業レポート (Phase 03-04) : ブラウザ内のキャンバス管理
* 参照元REQ: `./_log/req/261104_0046_REQ_Phase03-04_Canvas_Library.md`

## 1. 作業目的
現状、キャンバスは1枚だけで、ブラウザを再読み込みすると作業内容が失われる。本作業では、ブラウザ内（IndexedDB）に複数のキャンバスを保存し、開いているキャンバスを自動保存し、一覧から切り替えて開く・新規作成・名前の変更・削除ができるようにする。これらの操作は、コントロールパネルの呼び出し口から開閉するキャンバスパレットに集約する。あわせて、肥大化した`main.js`からスナップショットの取得・適用を`js/edit/`へ切り出す。

**用語**（REQの定義に従い、本RES・コード内JSDocで統一する）
* **キャンバス**: 名前を持ち、ブラウザ内に保存される1つの作品（図形一式）の単位。画面に開くキャンバスは常に1枚。
* **キャンバス一覧**: ブラウザ内に保存されているキャンバスの集まり。
* **開いているキャンバス**: 現在画面に表示され、編集の対象となっているキャンバス。
* **キャンバス記録**: 1つのキャンバスの保存単位。`{ id, name, updatedAt, document }`（2章要件1）。
* **自動保存**: 開いているキャンバスの図形一式が変わったとき、利用者の操作なしにキャンバス記録を更新すること。
* **キャンバスパレット**: キャンバス一覧の表示と、新規作成・名前の変更・削除の操作を担うフロートウィンドウ（本作業で新設）。
* **呼び出し口**: コントロールパネル上の、他のパレットを開閉するボタン（キャンバスパレットが最初の例）。
* **切り替え処理**: 開く・新規作成・削除後の切り替え・起動時の復元が共通して通る、開いているキャンバスを入れ替える手順（2章要件4）。
* 編集操作・履歴・スナップショットはPhase 03-02、作業データ形式・シリアライズ／デシリアライズはPhase 03-01、クリップボードはPhase 03-03、選択集合・作成中の図形はPhase 02-03、操作モードはPhase 02-01の定義に従う。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
次の5ファイルを新設する（いずれも図形種別の分岐・図形固有のプロパティ名・図形のid形式の知識を持たない。`window`への公開を行わない）。

| ファイル | クラス | 責務 | DOM |
| --- | --- | --- | --- |
| `js/edit/SnapshotAdapter.js` | `SnapshotAdapter` | 履歴のスナップショット（作業データ＋選択集合）の取得と、キャンバスへの適用（`main.js`から切り出し） | 触れない |
| `js/io/CanvasStorage.js` | `CanvasStorage` | ブラウザ内保存先（IndexedDB）へのキャンバス記録と「最後に開いていたキャンバスの識別子」の読み書き。IndexedDBのAPIを呼ぶ唯一のファイル | 触れない |
| `js/edit/CanvasLibrary.js` | `CanvasLibrary` | キャンバス一覧の管理（起動時の復元・開く・新規作成・名前の変更・削除・切り替え処理・自動保存・保存失敗の状態） | 触れない |
| `js/palette/CanvasPalette.js` | `CanvasPalette` | キャンバスパレットのDOM操作（一覧・操作ボタン・状態表示の描画、`window.prompt`/`window.confirm`、操作の通知） | 担う |
| `js/palette/PaletteLauncher.js` | `PaletteLauncher` | 呼び出し口のボタンとパレットの対応づけと開閉（`hidden`・`.active`・パレットの`×`） | 担う |

**置き場所の判断理由**
* `SnapshotAdapter`・`CanvasLibrary`は`DocumentSerializer`（`io/`）と`VectorModel`（`core/`）を組み合わせて図形一式を入れ替える手順のため、`edit/`に置く（`core/`は`io/`をimportしない既存方針。依存方向`main.js → edit → io → core → shapes`を維持）。`CanvasLibrary`は`InputTracker`に依存しない（操作モードの切り替えは注入コールバックで受け取る）。
* `CanvasStorage`は作業データを不透明なオブジェクトとして保存先と受け渡す入出力処理のため`io/`に置く（`edit/`・`core/`をimportしない。importなし）。
* `CanvasPalette`・`PaletteLauncher`は自己完結するUI部品のため`palette/`に置く（importなし。`VectorModel`・図形データ・IndexedDB・`CanvasLibrary`に依存せず、`main.js`からの注入で受け取る）。
* キャンバス管理の処理本体は`main.js`・`InputTracker`に置かない（REQ要件8）。

| 呼ぶ側 → 呼ばれる側 | 呼び出し内容 |
| --- | --- |
| `main.js` → `SnapshotAdapter` | 生成（`model`・`shouldRestoreSelection`）、`HistoryManager`の`capture`/`restore`として注入 |
| `main.js` → `CanvasStorage` | 生成のみ（`CanvasLibrary`へ注入） |
| `main.js` → `CanvasLibrary` | 生成（`storage`・`model`・`historyManager`・`prepareSwitch`・`resetView`）、`start()`、`openCanvas`/`createCanvas`/`renameCanvas`/`deleteCanvas`（パレットの通知から）、`flushPendingSave()`（ページ非表示時）、`getState()`/`onChange()` |
| `main.js` → `CanvasPalette` | 生成（ルート要素・操作コールバック）、`render(state)` |
| `main.js` → `PaletteLauncher` | 生成（呼び出し口の対応表）のみ |
| `CanvasLibrary` → `CanvasStorage` | `open`/`getAllRecords`/`getRecord`/`putRecord`/`renameRecord`/`deleteRecord`/`getLastOpenedId`/`setLastOpenedId` |
| `CanvasLibrary` → `DocumentSerializer` | `serialize(model.getShapes())`（保存）、`deserialize(record.document)`（開く） |
| `CanvasLibrary` → `VectorModel` | `getShapes()`・`replaceAllShapes(shapes)` |
| `CanvasLibrary` → `HistoryManager` | `onChange(listener)`（自動保存の契機）、`clear()`（切り替え時） |
| `CanvasLibrary` → 注入関数 | `prepareSwitch()`（実体`applyMode(OperationMode.SELECT)`）、`resetView()`（実体`viewTransform.reset()`） |
| `SnapshotAdapter` → `DocumentSerializer`／`VectorModel`／注入関数 | `serialize`/`deserialize`、`getShapes`/`getSelectedIds`/`replaceAllShapes`/`setSelection`、`shouldRestoreSelection()` |

```text
main.js ─┬─ SnapshotAdapter ──▶ HistoryManager(capture/restore)
         ├─ CanvasStorage ──(注入)──▶ CanvasLibrary ──▶ DocumentSerializer / VectorModel / HistoryManager
         │                                 ▲   │ onChange
         │        open/create/rename/delete│   ▼
         ├─ CanvasPalette ─────────(コールバック)── render(getState())   ／ キャンバス名の表示・document.title
         └─ PaletteLauncher（#launcher-canvas ⇔ #window-canvas-palette）
```

### 要件1: 保存先と保存内容
* **保存先の定数**: `CanvasStorage.js`のモジュール定数`STORAGE_CONFIG`（凍結。exportしない。唯一の定義箇所）にまとめる。
  * `databaseName: 'oz-vector-editor'`、`databaseVersion: 1`、`canvasStoreName: 'canvases'`（`keyPath: 'id'`）、`metaStoreName: 'meta'`（キーは外部指定の文字列）、`lastOpenedKey: 'lastOpenedCanvasId'`。
  * `onupgradeneeded`で2つのオブジェクトストアが無ければ作成する（版1のみ。将来の版の追加手順をJSDocに記載）。
* **キャンバス記録（typedef `CanvasRecord`、`CanvasStorage.js`に定義）**: `{ id: string, name: string, updatedAt: number, document: Object }`。
  * `id`: キャンバスの識別子（下記）。`name`: キャンバス名（前後の空白を除いた1〜100文字）。`updatedAt`: 最終更新日時（`Date.now()`のミリ秒）。`document`: 作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値。版番号を含む）。
  * `document`は保存処理・キャンバス一覧の管理とも中身を解釈しない（不透明なオブジェクトとして受け渡す）。読み込みは`CanvasLibrary`が`DocumentSerializer.deserialize`を通し、旧版のマイグレーションはその既存の仕組みに任せる。
  * **保存しないもの**: Undo/Redoの履歴、選択集合・ホバー・作成中の図形・選択矩形（`serialize`の対象外）、ビュー変換（倍率・表示位置）、クリップボード、操作モード。
* **最後に開いていたキャンバスの識別子**: `meta`ストアのキー`lastOpenedCanvasId`に文字列で保存する。
* **キャンバスの識別子の形式**: `canvas-<Date.now()の36進>-<Math.randomの36進8文字>`（例：`canvas-lq2k3x8a-4f9z0k1m`）。採番は`CanvasLibrary`のprivate`#issueCanvasId()`に閉じ、キャンバス一覧（メモリ上の要約）に同じidがあれば採り直す。他のモジュールは形式を解釈しない（`CanvasStorage`は`id`を不透明なキーとして扱う）。図形のid（`shape-<連番>`）とは別体系。時刻＋乱数のため、再読み込み後も既存のキャンバスと衝突しない（`crypto.randomUUID`は安全なコンテキストでしか使えない場合があるため採用しない）。
* **`CanvasStorage`の公開API**（いずれも`Promise`を返し、失敗時はrejectする。DOM・図形種別・図形固有のプロパティ名を持たない）:
  * `open(): Promise<void>` … `indexedDB`が無い・`open`の失敗（プライベートブラウズ等）でreject。2回目以降は何もしない。
  * `getAllRecords(): Promise<CanvasRecord[]>`、`getRecord(id): Promise<CanvasRecord|null>`。
  * `putRecord(record): Promise<void>` … 記録全体を書き込む（新規・上書き兼用）。
  * `renameRecord(id, name): Promise<boolean>` … 1つのreadwriteトランザクション内で読み出し→`name`のみ変更→書き込み（`updatedAt`・`document`は変えない）。記録が無ければ`false`。
  * `deleteRecord(id): Promise<void>`。
  * `getLastOpenedId(): Promise<string|null>`、`setLastOpenedId(id): Promise<void>`。
  * **書き込み順序の保証**: すべての書き込みは呼び出し時点で同期的にトランザクションを生成する（`await`を挟まない）。IndexedDBは範囲が重なるreadwriteトランザクションを生成順に実行するため、呼び出し順に反映される（JSDocに明記。`CanvasLibrary`の順序保証はこれに依存する）。`open()`完了前の呼び出しはrejectする。
* **保存できない場合**: アプリは停止しない。`CanvasLibrary`が状態`issue`（下記）を持ち、キャンバスパレット内の短い文言と、コントロールパネルのキャンバス名の先頭の`⚠ `で示す（`console.warn`も残す）。
  * `'unavailable'`（起動時に`open`／一覧の読み出しに失敗）: 「このブラウザでは保存できません。再読み込みすると編集内容は失われます。」→ メモリ上だけの空のキャンバス「無題 1」を開き、編集は続けられる。新規作成・名前の変更・削除・開くは受け付けない（パレットの操作ボタンは押せない状態）。自動保存は行わない。
  * `'writeFailed'`（自動保存・名前の変更・削除・最後に開いていたキャンバスの識別子の書き込みの失敗。容量超過等）: 「保存に失敗しました。最新の変更は保存されていない可能性があります。」→ 次に自動保存が成功した時点で解除する。
  * `'loadFailed'`（開こうとしたキャンバスの作業データが全体として読み込めない・記録が見つからない）: 「キャンバスを読み込めませんでした。」→ 次の切り替えの成功で解除（読み込み失敗時に別のキャンバスを開いた場合は残す）。
  * `'partialLoad'`（一部の図形をスキップして開いた）: 「一部の図形を読み込めませんでした。編集すると、その図形は保存から失われます。」→ 次の切り替えの成功で解除。
  * `issue`は最後に起きたものを1つだけ保持する（`'unavailable'`は解除しない）。保存の問題（`'unavailable'`/`'writeFailed'`）のときのみ`hasSaveProblem: true`とし、コントロールパネルのキャンバス名に`⚠ `を付ける。
* 複数タブで同時に開いた場合の整合は扱わない（後から書き込んだ側が残る。Non-goals）。

### 要件2: 自動保存
* **変更の検知経路（決定）**: `historyManager.onChange`。`CanvasLibrary`のコンストラクタで登録する。
  * `historyManager.onChange`は、編集操作の記録（作成・削除・移動・変形・貼り付け・切り取り・複製・`?dev`の復元）・取り消し・やり直しの適用成功・`clear()`での破棄の時点で通知される。選択の変更・ホバー・パン・ズーム・作成途中の図形の開始・破棄・前後が同一の`commitEdit`では通知されないため、保存もされない。ドラッグ中の途中経過は編集操作として確定しないため保存されない。`model.onChange`は使わない。
  * `clear()`による通知は、切り替え処理中は無視する（下記`#isSwitching`）。
* **`#isSwitching`（自動保存の予約を止める区間。唯一の仕組み）**: privateフラグ。`true`の間は`historyManager.onChange`の通知を受けても自動保存を予約しない。`true`にするのは (a)切り替え処理の同期区間（要件4の手順4〜5）と (b)開いているキャンバスの削除の開始から、削除後の切り替え処理の手順5の終わり（`#enterCanvas`内）または削除の中止まで（要件5）の2箇所のみで、`false`へ戻すのは切り替え処理の手順5の終わり（`#enterCanvas`内）と削除の中止時のみ。
* **待ち時間**: `CanvasLibrary.js`のモジュール定数`AUTOSAVE_DELAY_MS = 500`（唯一の定義箇所）。通知のたびに保留中のタイマーを`clearTimeout`して張り直し、最後の通知から0.5秒後に1回保存する（保存回数の見込み：編集操作1回につき最大1回。連続した操作は1回にまとまる）。
* **保留中の保存**: privateフィールド`#pendingSaveTimer`（タイマーid または`null`）と`#pendingSaveCanvasId`（予約時点の開いているキャンバスのid）。
  * 予約しない条件：開いているキャンバスがない（起動時の読み込み完了前。`#openCanvasId === null`）／`'unavailable'`／`#isSwitching`が真（切り替え処理の同期区間・開いているキャンバスの削除中）。
* **保存の実行（private`#saveOpenCanvasNow(): Promise<boolean>`）**: タイマーを解除し、`#pendingSaveCanvasId`が現在の`#openCanvasId`と一致しなければ破棄して`true`（別のキャンバスの記録へ書かない防御）。一致すれば、**同期的に**`{ id, name（メモリ上の現在名）, updatedAt: Date.now(), document: DocumentSerializer.serialize(model.getShapes()) }`を組み立てて`storage.putRecord`を呼び（トランザクションはこの時点で生成される）、メモリ上の要約の`updatedAt`を更新して変更通知する。書き込み成功で`'writeFailed'`を解除して通知、失敗で`console.warn`＋`'writeFailed'`＋通知。戻り値は成功したか。
* **ページ非表示時の確定**: `main.js`が`document`の`visibilitychange`（`document.visibilityState === 'hidden'`のとき）と`window`の`pagehide`で`canvasLibrary.flushPendingSave()`を呼ぶ。`flushPendingSave(): Promise<boolean>`は保留中の保存があれば直ちに`#saveOpenCanvasNow()`を呼ぶ（作業データの取得と`putRecord`の呼び出しはハンドラ内で同期的に行われる）。保留が無ければ`true`で解決する。`CanvasLibrary`自体は`document`・`window`のイベントを購読しない（DOMに触れないため）。
* **名前の変更**: その時点で`storage.renameRecord(id, name)`で名前のみを保存する。**最終更新日時は更新しない**（理由：図形一式の変更ではなく、一覧の並び（最終更新日時の新しい順）が名前の変更で入れ替わると押そうとした行が動いて紛らわしいため）。
* **非同期保存と切り替えの順序の保証**:
  1. 保存の作業データは呼び出し時点で同期的に取得し、予約時点のキャンバスidと一致する場合のみ、そのidの記録へ書く。
  2. 切り替え処理は、図形一式を入れ替える前に保留中の保存を確定させる（要件4の手順2・手順4）。入れ替えの直前（`await`を挟まない同期区間）にも保留の有無を再確認するため、`await`中に行われた編集もAの記録へ書かれる。
  3. IndexedDBの書き込みは生成順に実行されるため、Aへの書き込みが後発のB・削除より後に反映されることはない。
  4. 例：Aの保留中の保存がBへ切り替えた後にBの内容でAを上書きすることはない（入れ替え前に確定済み、または`#pendingSaveCanvasId`不一致で破棄）。Bの記録へAの内容を書くこともない（Aの作業データはAのidと組で同期的に取得）。

### 要件3: 起動時の復元
* `main.js`は初期化の最後（既存の初期同期の後）に`canvasLibrary.start()`を呼ぶ（`await`しない。`start()`はrejectしない）。
* **`start()`の手順**:
  1. `#isLoading = true`で変更通知（パレットは「読み込み中…」、コントロールパネルのキャンバス名も「読み込み中…」）。`#isLoading`の初期値はコンストラクタで`true`とし、`start()`の呼び出し前の`getState().loading`も`true`を返す（起動直後の初回の表示同期から読み込み中として扱うため）。
  2. `storage.open()`→`getAllRecords()`→`getLastOpenedId()`。いずれかが失敗したら`console.warn`し、`'unavailable'`としてメモリ上の空のキャンバス「無題 1」を切り替え処理の同期区間（手順4以降。ただし`'unavailable'`では`setLastOpenedId`等の保存先への書き込みを一切行わない）で開いて終了する。
  3. 記録を検証する（`id`・`name`が文字列、`updatedAt`が有限の数値。外れた記録は`console.warn`して一覧から除外する。保存先からは消さない）。メモリ上の要約`#summaries`（`Map<id, { id, name, updatedAt }>`）を作る（作業データは保持しない）。
  4. **開くキャンバスの決定規則**: 候補を「最後に開いていたキャンバス（存在すれば）→ 残りを最終更新日時の新しい順」に並べ、先頭から`DocumentSerializer.deserialize(record.document)`を試し、`ok: true`になった最初の1枚を開く（`ok: false`の記録は`console.warn`して次へ。記録は消さず一覧に残す。この場合`'loadFailed'`を立てる）。候補が無い・すべて読み込めない場合は、新しい空のキャンバスを作成して開く（初回起動を含む）。
  5. 開くキャンバスは切り替え処理（要件4）の手順4以降で開く（手順2の保存の確定は不要：開いているキャンバスがまだ無いため）。
  6. `#isLoading = false`で変更通知。
* **読み込み完了までの扱い（決定）**: 読み込み完了まで、キャンバスへのマウス入力（図形作成・選択・ドラッグ・パン・ホイールズーム）を受け付けない。これにより、読み込み完了前に図形一式・履歴が変わることはなく、読み込み完了時の切り替え処理（`prepareSwitch`→`replaceAllShapes`→`clear()`）で利用者の操作が消されることも、別のキャンバスに保存されることも起きない。
  * **方式**: 本要件（要件3）を満たす手段として、`index.html`に静的に置くキャンバス全面を覆う要素`#canvas-loading-cover`（DOM・スタイルの詳細は要件6の「読み込み中の覆い要素」の項に記載。キャンバスより前面・フロートウィンドウより背面、「読み込み中…」の表示）を、`main.js`の`syncLoadingCover()`が`canvasLibrary.getState().loading`に応じて表示・非表示にする（`hidden`属性の切り替えのみ）。**段階的な追加（決定）**：覆い要素はタスク6で`hidden`付き（非表示）で置き、タスク7で`syncLoadingCover()`の配線と同時に`index.html`の`hidden`を外す（覆い要素だけが表示されて非表示にする配線が無い状態を作らず、各タスク完了時点でアプリが正常に動作するため）。最終形（タスク7完了後）では覆い要素は`index.html`の時点で表示状態であり（`hidden`を付けない）、`main.js`の実行前からキャンバスへのマウス入力を遮る。`InputTracker`のマウスイベントは`canvas`要素に登録されているため、前面の覆い要素が受けたマウス操作（`mousedown`・`click`・`wheel`等）は`InputTracker`に届かず、ドラッグのセッションも始まらない。`InputTracker.js`・`KeyboardShortcuts.js`は変更しない。
  * 読み込みが`'unavailable'`で終わった場合も`#isLoading = false`で通知されるため覆い要素は非表示になり、メモリ上のキャンバス「無題 1」を編集できる。
  * 読み込み中はパレットの操作ボタンを押せない状態にする（`CanvasLibrary`も読み込み中の操作を受理しない）。
  * 読み込み完了前は開いているキャンバスが無い（`#openCanvasId === null`）ため自動保存も予約されない。
* **読み込み中のキーボードショートカット・ボタン操作の確認（計画時の確認結果）**: キーボードショートカット（`KeyboardShortcuts`は`document`の`keydown`で受けるため覆い要素では止まらない）とフロートウィンドウ上のボタンは読み込み中も働く。読み込み中は図形0個（起動直後の`VectorModel`は空）・クリップボード空（`ClipboardController`はメモリ上のみで起動時に空）・履歴空・作成途中の図形なし（作成にはキャンバスへのマウス入力が必要）であるため、図形一式を変える操作は次のとおりいずれも何もしない。
  * 削除（`Delete`等・削除ボタン）・切り取り・複製：選択集合が空のため何もしない。全選択：図形0個のため選択集合は空のまま。
  * 取り消し・やり直し（ショートカット・ボタン）：履歴が空のため受理されない。
  * 貼り付け：クリップボードが空のため何もしない（`main.js`の既存の`isEmpty()`判定）。
  * 操作モード・図形種別の切り替え、ズーム・リセット（ショートカット・ボタン）：図形一式・履歴を変えない（ビュー変換は切り替え処理の`resetView()`で初期表示へ戻る）。
  * **残る経路：`?dev`の確認用ウィンドウの「復元」（`onImport`）**：フロートウィンドウ上のボタンで覆い要素より前面にあり、図形一式を入れ替えて1件の編集操作として記録するため、読み込み中に実行されると読み込み完了時に破棄される。**扱い（決定）**：`main.js`の`onImport`の先頭で`canvasLibrary.getState().loading`が真なら、図形一式・履歴に触れず`{ ok: false, restoredCount: 0, reassignedCount: 0, skipped: [], error: 'キャンバスの読み込み中です' }`を返す（`DevPanel`は既存の失敗表示「読み込み失敗：…（キャンバスは変更していません）」を出す。`DevPanel.js`は変更しない）。`canvasLibrary`は`// 7.6.`で生成され、`onImport`はボタン押下時（初期化完了後）にのみ呼ばれるため参照できる。
* **壊れた作業データ（決定）**:
  * 全体が読み込めない（`ok: false`）キャンバスは開かない（起動時は次の候補へ、パレットから開いた場合は開いているキャンバスのまま）。`console.warn`と`'loadFailed'`。記録は削除しない（パレットから削除はできる）。
  * 一部の図形がスキップされた（`skipped.length > 0`）場合は、読めた図形で開き、`console.warn`（スキップ一覧）と`'partialLoad'`を残す。開いただけでは記録を書き換えない（自動保存は編集操作でのみ予約されるため）。編集すると、スキップした図形は記録から消える（文言で予告する。一般利用者向け通知UIはPhase 03-05で見直す）。

### 要件4: キャンバスを開く・新規作成（共通の切り替え処理）
* **置き場所**: `CanvasLibrary`のprivateメソッド。手順1〜2を`async`のprivate`#prepareLeave()`、手順4〜6を同期のprivate`#enterCanvas(summary, shapes)`に分ける（`await`を挟まない区間を明確にするため）。
* **手順（順序）**:
  1. **進行中の入力操作の中断と選択モードへの切り替え**: 注入された`prepareSwitch()`（実体`applyMode(OperationMode.SELECT)`。`InputTracker.setMode`の強制中断で作成途中の図形は破棄。**ドラッグ中の扱い（決定）**: パン・範囲選択は中断、本体ドラッグ・ハンドル操作は既存の`setMode`の仕様どおり、そこまでの移動・変形を残したまま中断され1件の編集操作として記録される → 自動保存が予約され、手順2で切り替え前のキャンバスへ保存される）。
  2. **切り替え前のキャンバスの保留中の保存の確定**: `await flushPendingSave()`。失敗した場合は**切り替えを中止**する（開いているキャンバスのまま。`'writeFailed'`。保存できていない変更を画面から消さないため）。
  3. **切り替え先の読み込み**（開く：`await storage.getRecord(id)`→`deserialize`。`null`・`ok: false`なら中止して`'loadFailed'`。新規作成：記録を作成して`await storage.putRecord`。失敗しても中止せず`'writeFailed'`として開く（次の自動保存で記録が作成される））。
  4. **同期区間の開始**（ここから手順6まで`await`を挟まない）: もう一度`prepareSwitch()`を呼び（`await`中に始まった作成途中の図形・ドラッグを中断する）、保留中の保存があれば`#saveOpenCanvasNow()`を呼んで切り替え前のキャンバスへ書く（完了は待たない。生成順で反映される）。**手順2との違い（決定）**：手順2は書き込みの失敗で切り替えを中止するが、手順4は失敗しても切り替えを続ける。理由：手順4は`await`を挟まない同期区間のため完了を待てない（待つと区間が途切れ、`await`中の編集の取りこぼしを防ぐ目的が崩れる）。また手順4で書くのは手順2〜3の`await`中に行われた編集のみ（それ以前の変更は手順2で書き込み済み）であり、書き込みに失敗した場合は`#saveOpenCanvasNow()`の失敗処理により`console.warn`＋`'writeFailed'`で示す（その分の変更は切り替え前のキャンバスに保存されない可能性がある）。続けて`#isSwitching = true`とし、**図形一式の入れ替え**`model.replaceAllShapes(shapes)`（図形のidは記録されたものを保持する既存仕様）。
  5. **履歴のリセット**`historyManager.clear()`（切り替えそのものは編集操作として記録しない。`beginEdit`/`commitEdit`を呼ばない）→ **ビュー変換を初期表示へ**`resetView()`（実体`viewTransform.reset()`）→ `#isSwitching = false`。
  6. `#openCanvasId`を更新し、`storage.setLastOpenedId(id)`を呼び（完了は待たない。失敗時`console.warn`＋`'writeFailed'`）、`issue`を更新（`'loadFailed'`/`'partialLoad'`の解除・設定）して**変更通知**する（キャンバス名の表示・`document.title`・パレットの一覧は、この通知1経路で更新される）。
* **再描画・ボタン同期**: `replaceAllShapes`の`model.onChange`、`clear()`の`historyManager.onChange`、`reset()`の`viewTransform.onChange`の既存経路のみで行う（切り替え専用の再描画・同期処理は書かない）。
* **開く（`openCanvas(id): Promise<boolean>`）**: 受理条件＝読み込み中・処理中（`#isBusy`）・`'unavailable'`でない、`id`が一覧にある、開いているキャンバス自身でない。受理しなければ何もせず`false`。
* **新規作成（`createCanvas(): Promise<boolean>`）**: 受理条件＝読み込み中・処理中・`'unavailable'`でない。記録`{ id: #issueCanvasId(), name: 新しい名前, updatedAt: Date.now(), document: DocumentSerializer.serialize([]) }`を作成し、空の図形一式で切り替える。
* **新規キャンバスの命名規則**: 「無題 1」「無題 2」…のうち、キャンバス一覧（メモリ上の要約）の名前と一致しない最小の番号（`'無題 ' + n`。半角スペース1つ）。先頭・`'unavailable'`時のメモリ上のキャンバスも同じ規則（一覧が空なので「無題 1」）。
* **処理中の扱い**: 開く・新規作成・名前の変更・削除・起動時の復元はprivateフラグ`#isBusy`で直列化し、処理中は新たな操作を受け付けない（`false`）。`getState().busy`でパレットのボタンを押せない状態にする。処理中もキャンバスの編集は止めない（上記手順4で整合を取る）。
* **クリップボード**: 切り替えで消えない（`ClipboardController`のインスタンスは`main.js`で1つだけ生成し、作り直さない。`CanvasLibrary`はクリップボードに触れない）。**貼り付けの段数は切り替えでリセットしない（決定）**：`ClipboardController`の仕様変更がNon-goalsであり、段数は「同じ内容を何回貼り付けたか」を表すため。別のキャンバスでの貼り付けは通常の貼り付けと同じ規則（新しいid（`replaceAllShapes`で`#nextId`が保持idより大きく繰り上がるため衝突しない）・その時点の段数のずらし量・追加した図形だけを選択・1件の編集操作）で働く。

### 要件5: 名前の変更・削除
* **対象（決定）**: 一覧の任意のキャンバス。一覧の各行に「✎（名前の変更）」「🗑（削除）」の小さなボタンを置く（行の名前部分を押すと開く）。理由：開いていないキャンバスを消すたびに開き直す手間が無く、行ごとのボタンはイベント委譲1本で実装量も小さいため。
* **名前の変更（`CanvasPalette`→`renameCanvas(id, rawName): Promise<boolean>`）**:
  * `CanvasPalette`が`window.prompt('キャンバス名を入力してください', 現在の名前)`を表示し、`null`（キャンセル）なら何もしない。それ以外の文字列を`onRename(id, text)`で渡す。
  * `CanvasLibrary`が受理判定する：文字列でない・前後の空白を除いて空 → 変えずに`false`。**最大文字数（決定）**：定数`CANVAS_NAME_MAX_LENGTH = 100`（`CanvasLibrary.js`。唯一の定義箇所）。超える場合は先頭100文字（`Array.from`でサロゲートペアを分断しない）に切り詰めて受理する。変更後の名前が現在の名前と同じなら`false`（書き込まない）。名前の重複は許す。
  * 受理時：メモリ上の要約の名前を更新して通知し、`await storage.renameRecord(id, name)`。失敗・`false`なら`console.warn`＋`'writeFailed'`（メモリ上の名前は新しいまま。開いているキャンバスなら次の自動保存で記録の名前も揃う）。最終更新日時は変えない。
* **削除（`CanvasPalette`→`deleteCanvas(id): Promise<boolean>`）**:
  * `CanvasPalette`が`window.confirm('キャンバス「<名前>」を削除しますか？この操作は取り消せません。')`で「OK」の場合のみ`onDelete(id)`を呼ぶ。
  * 受理条件＝読み込み中・処理中・`'unavailable'`でない、`id`が一覧にある。
  * **開いていないキャンバスの削除**: `await storage.deleteRecord(id)`。成功で要約から除いて通知。失敗なら`'writeFailed'`で一覧に残す。開いているキャンバス・図形一式・履歴・自動保存には触れない。
  * **開いているキャンバスの削除**: (1)`prepareSwitch()` (2)保留中の保存を**破棄**（タイマー解除・`#pendingSaveCanvasId = null`。確定しない）(3)`#isSwitching = true`にしてから`await`する（要件2の`#isSwitching`。この間は自動保存を予約しないため、削除の`await`中の編集も記録を復活させない。削除後の切り替え処理の手順5の終わり（`#enterCanvas`内）で`false`に戻る）(4)`await storage.deleteRecord(id)`。失敗したら`#isSwitching = false`へ戻して中止し（開いているキャンバスのまま。`'writeFailed'`）、手順(2)で破棄した保留分と`await`中の編集を保存するため`#scheduleSave()`で自動保存を予約し直す（記録は残っているため、そのキャンバス自身へ書くのが正しい）(5)成功したら要約から除き、残りを最終更新日時の新しい順に読み込みを試して最初に読めたものを開く（切り替え処理の手順3〜6。手順2は不要）。1枚も残らない・すべて読めない場合は新しい空のキャンバスを作成して開く。
  * 削除したキャンバスへの書き込みが削除後に反映されない理由：保留中の保存は手順(2)で破棄され、削除の開始から削除後の切り替え処理の手順5の終わり（`#enterCanvas`内）までの予約は`#isSwitching`で止められ（それ以降の予約は新しく開いたキャンバスのidで行われる）、削除前に生成済みの書き込みは削除より先に実行される（生成順）。自動保存の予約を止める仕組みは`#isSwitching`の1つのみで、削除のために`#openCanvasId`を`null`にする処理は設けない。
* **`window.prompt`／`window.confirm`表示中の入力の確認（計画時の確認結果）**:
  * 修飾キー：`KeyboardShortcuts`は`keydown`ごとに`event.ctrlKey`等を読み、押下状態を保持しないため取り違えは起きない。
  * スペースパン：`InputTracker`の`#isSpacePressed`は`keyup`・`window`の`blur`で解除される。Spaceを押したまま小窓を開き、小窓の表示中に離すと`keyup`を取りこぼし、次に`Space`の`keyup`か`blur`が起きるまで`grab`状態が残る可能性がある（ボタンを押す操作でSpaceを押し続けることはまれ。目視確認項目に入れる。`InputTracker`は変更しない）。
  * ドラッグ：小窓はボタンの`click`から開くため、左ドラッグのセッションは無い。中ボタンのパン中に押した場合も`DragTracker`の`buttons`照合で次の`mousemove`で終了する。作成途中の図形は名前の変更・開いていないキャンバスの削除では破棄しない（`prepareSwitch`を呼ばない）。
  * フォーカス：押したボタンにフォーカスが残ると`Enter`で再度押されるため、`CanvasPalette`は操作の処理前に押されたボタンの`blur()`を呼ぶ（`Space`は既存の`InputTracker.handleKeyUp`の`preventDefault()`でボタンのクリックにならない）。

### 要件6: キャンバスパレットと呼び出し口
* **`index.html`（コントロールパネル）**: `.window-body`の末尾（倍率表示行の後）に、キャンバス名の表示`<div id="canvas-name-display" class="canvas-name-display"></div>`と呼び出し口`<button type="button" id="launcher-canvas" class="tool-btn" title="キャンバスパレットを開く／閉じる">📁 キャンバス</button>`をこの順に置く。
* **`index.html`（キャンバスパレット）**: `#window-dev-panel`の前に静的に置く。
  ```html
  <div id="window-canvas-palette" class="float-window" hidden>
      <div class="window-header">
          <span class="window-title">キャンバス</span>
          <button type="button" class="window-close-btn">×</button>
      </div>
      <div class="window-body">
          <button type="button" id="canvas-create" class="tool-btn">＋ 新規作成</button>
          <div id="canvas-list" class="canvas-list"></div>
          <p id="canvas-notice" class="canvas-notice" hidden></p>
      </div>
  </div>
  ```
* **スタイル（`index.html`の`<style>`）**:
  * `#window-canvas-palette { top: 16px; right: 252px; width: 240px; }`（コントロールパネル`right: 16px`＋幅220px＋間隔16px＝252px。コントロールパネルの左隣。`?dev`の確認用ウィンドウ（`left: 16px`・幅360px）とは、画面幅が約870px以上なら重ならない）。
  * `.canvas-name-display`（`font-size: 12px; line-height: 18px; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;`）。
  * `.canvas-list`（`max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px;`）、`.canvas-row`（`display: flex; gap: 4px;`）、`.canvas-row-open`（`flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;`）、`.canvas-row-btn`（`flex: none;`）、開いているキャンバスの行は`.canvas-row.current .canvas-row-open`に`.tool-btn.active`と同じ配色。`.canvas-notice`（`margin: 0; font-size: 12px; color: #b00020;`）。
  * 行のボタンはいずれも`.tool-btn`を併用し、押せない状態は`disabled`属性と既存の`.tool-btn:disabled`で表す（`.disabled`クラスと混用しない）。
* **`index.html`（読み込み中の覆い要素。要件3を満たす手段。DOM・スタイルをまとめて本項に記載）**: `<canvas id="editor-canvas">`の直後に`<div id="canvas-loading-cover" class="canvas-loading-cover" hidden>読み込み中…</div>`を静的に置く（タスク6では`hidden`付きで追加し、タスク7で`syncLoadingCover()`の配線と同時に`hidden`を外して、最終形では表示状態で始める。要件3の「段階的な追加」）。スタイル：`.canvas-loading-cover { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 5; display: flex; align-items: center; justify-content: center; background-color: rgba(255, 255, 255, 0.6); font-family: sans-serif; font-size: 14px; color: #666; cursor: progress; user-select: none; }`と`.canvas-loading-cover[hidden] { display: none; }`（`display: flex`が`hidden`属性の既定の非表示を上書きするため必須）。`z-index: 5`はキャンバス（`1`）より前面・フロートウィンドウ（`10`以上。最前面化でも下がらない）より背面であり、コントロールパネル・パレット・`?dev`の確認用ウィンドウは読み込み中も操作できる。
* **図形パレットの位置**: `#window-shape-palette`の`top`を`368px`→`440px`へ変更する。計算根拠：変更前のパネル下端は約341px（既存コメント）。追加分＝キャンバス名の行18px＋行間8px＋呼び出し口ボタン約36px＋行間8px＝約70px → 新しい下端は約411px。`440 − 411 = 29px`で24px以上を確保する（既存コメントを更新）。
* **`PaletteLauncher`（呼び出し口の開閉の共通化）**:
  * `constructor(bindings)`：`bindings`は`[{ button: HTMLElement|null, palette: HTMLElement|null }]`。要素が欠けるエントリは`console.warn`して配線しない。各エントリについて、ボタンの`click`で開閉を反転し、パレット内の`.window-close-btn`の`click`で閉じる。開閉は`palette.hidden`の切り替えと`button.classList.toggle('active', 開いているか)`のみ。起動時は`palette.hidden`の現状（`index.html`で`hidden`）に`.active`を合わせる。
  * 対応表は`main.js`の1箇所（定数`paletteLaunchers`。例：`[{ button: document.getElementById('launcher-canvas'), palette: document.getElementById('window-canvas-palette') }]`）に持つ。後続のパレットは「`index.html`にボタンとパレットのDOMを静的に追加 → 対応表へ1エントリ追加」で開閉できる（JSDocに追加方法を記載）。
  * 他のウィンドウ（コントロールパネル・図形パレット・`?dev`）の`×`は対応表に含まれないため無機能のまま。
  * `WindowManager`との関係：`WindowManager`は起動時にDOMにある`.float-window`をすべて配線し、非表示の要素も対象になる。ヘッダーのドラッグ移動は表示中に`getBoundingClientRect()`で位置を取るため、`hidden`から表示へ切り替えた後も働く。よって**`WindowManager.js`は変更しない**。
* **`CanvasPalette`**:
  * `constructor(rootElement, { onOpen, onCreate, onRename, onDelete })`：ルート要素内の`#canvas-create`・`#canvas-list`・`#canvas-notice`を解決し、1つでも欠ければ`console.warn`して配線しない（`DevPanel`と同じ方針）。コールバックは関数でなければ`Error`。
  * 一覧のクリックは`#canvas-list`への1本のイベント委譲で扱う（行の要素に`data-canvas-id`、ボタンに`data-action`＝`'open'|'rename'|'delete'`）。名前の変更・削除の小窓はここで表示し、確定した場合のみコールバックを呼ぶ。コールバックの戻り値（`Promise`）は待たない。
  * `render(state)`：`state`（`CanvasLibraryState`）から一覧を作り直す（`textContent`のみで名前を設定し`innerHTML`は使わない。利用者の入力した名前をHTMLとして解釈しないため）。行の名前ボタンの`title`に名前全体を設定する。開いているキャンバスの行に`.current`。`busy || !canManage`なら新規作成・各行のボタンを`disabled`。`loading`なら一覧の代わりに状態表示へ「読み込み中…」。`issue`に応じた文言（2章要件1の表。対応表`ISSUE_MESSAGES`はこのファイルに持つ）を`#canvas-notice`へ表示し、`null`なら`hidden`。
  * importを持たず、`CanvasLibrary`・`VectorModel`・図形データ・IndexedDBを参照しない（受け取るのは`state`とコールバックのみ）。
* **`CanvasLibraryState`（`getState()`の戻り値。毎回新しいオブジェクト）**: `{ loading: boolean, busy: boolean, canManage: boolean（'unavailable'でない）, openCanvasId: string|null, openCanvasName: string|null, canvases: [{ id, name, updatedAt, isOpen }]（最終更新日時の新しい順。同値はid順）, issue: null|'unavailable'|'writeFailed'|'loadFailed'|'partialLoad', hasSaveProblem: boolean }`。

### 要件7: 開いているキャンバスの名前の表示
* **表示先（決定）**: コントロールパネルの`#canvas-name-display`（呼び出し口`📁 キャンバス`の直上の1行）。省略表示（`text-overflow: ellipsis`）とし、`title`属性に名前全体を設定する。
* `main.js`の`syncCanvasNameDisplay()`が`canvasLibrary.getState()`から、`#canvas-name-display`の`textContent`（`hasSaveProblem`なら先頭に`⚠ `、読み込み中は「読み込み中…」）と`document.title`（`<キャンバス名> - OZ Vector Editor`。読み込み中は`OZ Vector Editor`）を更新する。
* `main.js`の`syncLoadingCover()`が`canvasLibrary.getState().loading`から`#canvas-loading-cover`の`hidden`を設定する（`loading`なら表示、それ以外は非表示。要件3）。要素が無ければ`console.warn`のみで何もしない。
* `canvasLibrary.onChange`に`syncCanvasNameDisplay`・`syncLoadingCover`と`() => canvasPalette.render(canvasLibrary.getState())`を登録する（名前の変更・切り替え・削除後の切り替え・読み込み完了の通知で直ちに更新）。起動時にも明示的に1回ずつ呼ぶ。

### `SnapshotAdapter`の仕様（`main.js`からの切り出し。REQ要件8）
* `constructor({ model, shouldRestoreSelection })`（`shouldRestoreSelection`が関数でなければ`Error`）。importは`DocumentSerializer`のみ。
* **操作モードを知らない（`edit/`の制約の維持）**: 注入関数`shouldRestoreSelection(): boolean`は「選択集合を復元してよいか」を返すだけの、操作モードに中立な名前とする。`SnapshotAdapter`は操作モード（`OperationMode`・`InputTracker`）をimport・参照せず、その判定の根拠も知らない（実体は`main.js`が与える）。
* `capture(): Snapshot`、`restore(snapshot): boolean`は現行の`captureSnapshot`/`restoreSnapshot`と同一の処理・戻り値・`console.warn`の文言とする（選択集合の復元は`shouldRestoreSelection()`が真のときのみ）。typedef`Snapshot`は`HistoryManager.js`と同じ内容を本ファイルにも定義する（形を変える場合は両方を揃える旨をJSDocに記載）。
* `main.js`：`const snapshotAdapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => inputTracker.getMode() === OperationMode.SELECT });`（選択モードのときのみ選択集合を復元する既存の規則は、この`main.js`側の実体で表す）、`new HistoryManager({ capture: () => snapshotAdapter.capture(), restore: (snapshot) => snapshotAdapter.restore(snapshot) })`。`shouldRestoreSelection`の実体は後で宣言される`inputTracker`を参照するが、呼ばれるのは起動完了後の取り消し・やり直し時のみ（既存と同じ注意をコメントに残す）。取り消し・やり直しの挙動・受理条件は変わらない。

### 要件8: `main.js`の肥大化への対応
* `main.js`に追加するのは、新設クラスの生成・注入コールバック・イベントの配線（`syncCanvasNameDisplay`、`syncLoadingCover`、ページ非表示時の`flushPendingSave`、`start()`の呼び出し、`?dev`の`onImport`の読み込み中の受理拒否（要件3））のみ。キャンバスの切り替え・新規作成・削除・名前の変更・自動保存の処理本体は`CanvasLibrary`に置く。`InputTracker`には何も追加しない。
* 配線位置：`// 3.5.`の履歴配線を`SnapshotAdapter`利用に置き換え／`// 7.5.`の後に`// 7.6. キャンバス管理（キャンバス一覧・自動保存・キャンバスパレット・呼び出し口）配線`を新設（`applyMode`・`viewTransform`・`historyManager`の生成後であること）／ページ非表示時の確定を同ブロックに置く／初期化の最後（`syncHistoryButtonState()`の後）に`syncCanvasNameDisplay()`・`syncLoadingCover()`・パレットの初回`render`・`canvasLibrary.start()`。
* **行数の見込み**: 418行 − スナップショット関数（約40行）＋`SnapshotAdapter`配線（約6行）＋import 5行＋キャンバス管理配線（約60行）＋`syncLoadingCover`（約12行）＋`onImport`の読み込み中判定（約5行）＋初期化の追記（約10行）＝**約470〜490行**。

### 要件9: 回帰防止
* 変更しないファイル：`CanvasManager.js`／`ShapeFactory.js`／`ViewTransform.js`／`DragTracker.js`／`InputTracker.js`／`KeyboardShortcuts.js`／`VectorModel.js`／`HistoryManager.js`／`DocumentSerializer.js`／`PaletteController.js`／`DevPanel.js`／`ClipboardController.js`／`ShapeInserter.js`／`shapes/`の4ファイル／`WindowManager.js`。
* キーボードショートカットは追加しない。既存のUI同期経路（`model.onChange`・`historyManager.onChange`・`viewTransform.onChange`・`applyMode`）を変えない。
* 起動直後は既存どおり空のキャンバスで描画され（読み込み中は覆い要素の下に表示され、マウス入力は受け付けない）、読み込み完了時に切り替え処理で図形一式が入り、覆い要素が非表示になる（倍率100%・選択モード・履歴は空）。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/edit/` - `SnapshotAdapter`（新設）、`CanvasLibrary`（新設。キャンバス一覧の管理）
    *   `./js/io/` - `CanvasStorage`（新設。IndexedDBへの読み書き）
    *   `./js/palette/` - `CanvasPalette`（新設）、`PaletteLauncher`（新設。呼び出し口の開閉）
    *   `./js/` - `main.js`（配線・スナップショット関数の置き換え）
    *   `./index.html` - キャンバスパレットのDOM・スタイル、呼び出し口・キャンバス名の表示、読み込み中の覆い要素、図形パレットの`top`
*   **関連する論理クラス**:
    *   `SnapshotAdapter`・`CanvasStorage`・`CanvasLibrary`・`CanvasPalette`・`PaletteLauncher`（新設）
    *   `HistoryManager`（`capture`/`restore`の注入元の変更、`clear()`・`onChange`の利用。変更なし）、`VectorModel`（`replaceAllShapes`・`getShapes`の利用。変更なし）、`DocumentSerializer`（利用のみ）、`ViewTransform`（`reset()`の利用）、`InputTracker`（`applyMode`経由の`setMode`・`getMode`の利用。変更なし）、`WindowManager`（変更なし）、`ClipboardController`（変更なし。切り替えで作り直さない）

### 参照する責務
*   **フォルダ分割の方針（1章）**: 横断的な処理は`core/`、自己完結する機能（UI部品等）は専用フォルダ。`io/`・`core/`の機能を組み合わせて図形一式を編集する手順は`edit/`に置く。依存方向は`main.js → edit → io → core → shapes`の一方向で、`core/`・`io/`は`edit/`をimportしない。`core/`は`io/`をimportしない。
*   **2章**: 作業データ形式は`{ format: "oz-vector-editor", version, shapes }`で`io/DocumentSerializer.js`が変換を担う。保存対象は図形データのみで、選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない。旧版の知識は`DocumentSerializer`のマイグレーション表に閉じる。ビュー変換は表示専用の状態として`ViewTransform`が保持する。
*   **3章4.再描画の経路**: `VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から同一関数`renderCurrentState()`で再描画する。
*   **3章5.作業データの復元**: 復元は`deserialize`で図形インスタンスを生成し、成功時のみ図形一式を入れ替える。全体の読み込みに失敗した場合はキャンバスを変更しない。再描画・UI同期は`model.onChange`・`historyManager.onChange`経路のみ。
*   **3章6.履歴**: スナップショットは`{ document: 作業データ, selectedIds }`。記録は`beginEdit()`/`commitEdit()`で挟む（作成・削除・ドラッグ・`?dev`の復元・切り取り・貼り付け・複製）。前後の作業データが一致すれば記録しない。範囲選択・選択・ホバー・パン・ズーム・モード切替・作成途中の図形の開始/破棄は記録経路を通らない。適用は`performUndo()`/`performRedo()`→`HistoryManager.undo()`/`redo()`→`restore`（`deserialize`（失敗・スキップ1件以上なら`console.warn`してキャンバスを変更せず`false`）→`model.replaceAllShapes`→選択モードのときのみ`model.setSelection(snapshot.selectedIds)`）。再描画・ボタン同期は`model.onChange`→`historyManager.onChange`の既存経路のみ。
*   **3章7.クリップボード**: `ClipboardController`のインスタンスは`main.js`が起動時に1つだけ生成するため、キャンバスを切り替えても消えない。貼り付けの段数はコピーで1・切り取りで0にリセット、貼り付けで+1。貼り付けは毎回新しいidで追加し、追加した図形だけを選択する1件の編集操作。
*   **index.html**: スタイルは`<style>`に内包。フロートウィンドウ全体の非活性化は`.disabled`クラス、ボタン単体の押せない状態は`disabled`属性と`.tool-btn:disabled`（両者を混用しない）。`#window-shape-palette`の`top`はコントロールパネル下端との余白24px以上を確保する固定値（自動配置しない。パネルの高さを変える場合は手動で再調整）。`#window-dev-panel`は`hidden`属性で初期非表示、`?dev`時のみ表示。フロートウィンドウの`×`は全ウィンドウとも見た目のみ（本作業でキャンバスパレットのみ機能化）。
*   **main.js**: エントリポイント。インスタンス化・依存の注入・イベントバインド。判定ロジック・作業データの中身の解釈は持たない（持たせる必要が生じたら別モジュールへ分離）。`// 3.5.`履歴配線（`historyManager`は`InputTracker`より先に生成）。`applyMode(mode)`が操作モード切替を一元管理（`inputTracker.setMode`→`getMode()`で読み返して`.active`同期・パレットの活性・ハイライト）。起動時は`applyMode(OperationMode.SELECT)`の後、初期化の最後に`renderCurrentState()`・`syncZoomDisplay()`・`syncDeleteButtonState()`・`syncHistoryButtonState()`を明示的に1回ずつ呼ぶ。`// 7.5.`クリップボード配線。`?dev`の`onImport`は`abortOngoingOperation()`→`beginEdit()`→`replaceAllShapes`→`commitEdit()`。`window`へ公開しない。
*   **VectorModel.js**: `replaceAllShapes(shapes)`は全図形を入れ替え、空でない未出現の文字列idは保持、それ以外は振り直す（保持した採番形式のidの最大連番より`#nextId`を繰り上げる）。選択集合・ホバー・作成中の図形・選択矩形をクリアし、変更通知は1回。進行中の入力操作は中断しない（呼び出し側の責務）。同一インスタンスを配列に重複して渡さない。id形式の知識は`VectorModel`内に閉じる。
*   **InputTracker.js**: `setMode(mode)`は「進行中操作の強制中断（ドラッグセッションは中断、左ドラッグで残った頂点・位置の変化は1件の編集操作として確定、作成途中の図形は破棄）→ モード更新 → 選択集合/ホバーのクリア → カーソル再評価」。`abortOngoingOperation()`はモード・選択集合・スペース押下状態を変えない。スペース押下状態は`keyup`・`blur`で解除（`keyup`ではテキスト入力中以外`preventDefault()`）。状態に依存しない操作を`InputTracker`へ入れない。
*   **HistoryManager.js**: importを持たず、DOM・作業データの中身を知らない。`capture`/`restore`は注入（関数でなければ`Error`）。`clear()`は履歴を空にし、図形一式・選択集合には触れず、実際に何かを破棄した場合のみ通知する（キャンバスを開く・新規作成時に呼ぶ前提）。`onChange`は記録時・適用成功時・`clear()`で破棄したときのみ通知（`beginEdit()`・不記録の`commitEdit()`では通知しない）。履歴はメモリ上のみ。
*   **ViewTransform.js**: `reset()`は倍率1.0・オフセット(0,0)への復帰。値が実際に変化した場合のみ`onChange`へ通知。
*   **WindowManager.js**: コンストラクタ実行時点でDOMに存在する`.float-window`を検知し、ドラッグ移動（`.window-header`）・最前面化・イベント遮断（mousedown/click/mousemove/mouseupの伝播停止）を配線する（後から追加された要素は未対応）。図形データ・状態には関与しないDOM操作専任。
*   **palette/**: `PaletteController`・`DevPanel`はimportを持たず、`VectorModel`・図形データに関与しないDOM操作専任の自己完結UI部品。コールバックを`main.js`から注入される。`DevPanel`は必要な要素が1つでも欠ければ`console.warn`のうえ一切配線しない。
*   **edit/**: DOMに触れず、図形種別の分岐・図形固有のプロパティ名・id形式の知識を持たない。`InputTracker`に依存せず操作モードを知らない（前提は呼び出し側の責務）。`ShapeInserter`・`ClipboardController`のimportは`DocumentSerializer`のみ。
*   **DocumentSerializer.js**: 静的メソッドのみ・DOM非依存。`serialize(shapes)`は新しい作業データを返す（`model.getShapes()`のみを渡す想定）。`deserialize(documentData)`は例外をthrowせず`DeserializeResult`（`{ ok, shapes, skipped: [{ index, type, reason }], error }`）を返し、引数を書き換えない。スキップ1件ごと・全体失敗時に`console.warn`を出す。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**: フォルダ構造に`js/edit/SnapshotAdapter.js`・`js/edit/CanvasLibrary.js`・`js/io/CanvasStorage.js`・`js/palette/CanvasPalette.js`・`js/palette/PaletteLauncher.js`を追加。`index.html`の注記にキャンバスパレットを追加。フォルダ分割の方針の`io/`の説明に「ブラウザ内保存先への読み書き（`CanvasStorage`）」を加える。フォルダ分割の方針の`edit/`の定義（「`io/`・`core/`の機能を組み合わせて図形一式を編集する手順」）を拡張し、キャンバス一覧の管理（`CanvasLibrary`。開く・新規作成・名前の変更・削除・切り替え・自動保存）と、履歴のスナップショットの取得・適用（`SnapshotAdapter`）を含める（操作モードを知らない制約は維持し、必要な判定は`shouldRestoreSelection`・`prepareSwitch`のような中立な注入関数で受け取る旨）。
*   **2章**: キャンバス記録`{ id, name, updatedAt, document }`と保存しないもの、キャンバスの識別子の形式（`CanvasLibrary`に閉じる）、保存先（IndexedDB・定数`STORAGE_CONFIG`）を追記。
*   **3章1.起動処理**: インスタンス化一覧に`SnapshotAdapter`・`CanvasStorage`・`CanvasLibrary`・`CanvasPalette`・`PaletteLauncher`を追加。初期化の最後に`canvasLibrary.start()`で非同期に「最後に開いていたキャンバス」を読み込むこと（開くキャンバスの決定規則・読み込み完了前の操作の扱い）を追記。
*   **3章に新項目「8. キャンバス管理（自動保存・切り替え）の流れ」**: 自動保存（`historyManager.onChange`→`AUTOSAVE_DELAY_MS`後に保存、ページ非表示時の確定）、切り替え処理の手順1〜6、非同期保存と切り替えの順序の保証、削除・名前の変更、保存失敗時の`issue`。
*   **3章6.履歴**: 「`clear()`の呼び出し元＝`CanvasLibrary`の切り替え処理（切り替えは編集操作として記録しない）」と、スナップショットの取得・適用の実体が`SnapshotAdapter`であることを追記。
*   **4章`index.html`**: キャンバスパレット（`#window-canvas-palette`・`hidden`で初期非表示・初期位置）、読み込み中の覆い要素`#canvas-loading-cover`（表示状態で始まり、`main.js`が読み込み完了で非表示にする。キャンバスより前面・フロートウィンドウより背面）、呼び出し口`#launcher-canvas`とキャンバス名の表示`#canvas-name-display`、`#window-shape-palette`の`top`を`440px`へ、`×`ボタンはキャンバスパレットのみ機能する旨。
*   **4章`main.js`**: `// 3.5.`の`SnapshotAdapter`利用、`// 7.6.`キャンバス管理配線（生成・注入コールバック・`onChange`登録・ページ非表示時の`flushPendingSave`）、起動時の`syncCanvasNameDisplay()`・`syncLoadingCover()`・`start()`、呼び出し口の対応表`paletteLaunchers`、`?dev`の`onImport`は読み込み中は受理しないこと。「スナップショットの取得・適用関数も`main.js`に置く」記述の削除。
*   **4章`HistoryManager.js`**: `clear()`の「現状は呼び出し元なし」を「`CanvasLibrary`の切り替え処理から呼ばれる」へ。`capture`/`restore`の実体を`SnapshotAdapter`へ。
*   **4章`WindowManager.js`**: 静的に置いた非表示のウィンドウ（開閉式パレット）も起動時に配線され、表示後にドラッグ移動・最前面化が働くこと。開閉は`PaletteLauncher`が担う（`WindowManager`は開閉に関与しない）。
*   **4章`edit/`**: `edit/`の定義（DOMに触れない・図形種別の分岐等を持たない・操作モードを知らない・importは`DocumentSerializer`のみ）の対象に、キャンバス一覧の管理（`CanvasLibrary`）とスナップショットの取得・適用（`SnapshotAdapter`）を含めるよう拡張する（`CanvasLibrary`の`CanvasStorage`は注入で受け取りimportしないこと、操作モード依存の判定は注入関数で受け取ることを併記）。
*   **4章に新項目**: `edit/SnapshotAdapter.js`・`edit/CanvasLibrary.js`・`io/CanvasStorage.js`・`palette/CanvasPalette.js`・`palette/PaletteLauncher.js`の責務・公開API・依存の制約。コントロールパネルの位置づけ（操作モード切替・頻繁に使う操作・他パレットの呼び出し口）と、呼び出し口の追加手順。

## 3. タスクリスト
*   [x] タスク1: スナップショットの取得・適用を`SnapshotAdapter`へ切り出す
    *   **対象ファイル** :
        *   `./js/edit/SnapshotAdapter.js` :（新規）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `SnapshotAdapter.js`を2章「`SnapshotAdapter`の仕様」のとおり新設する。先頭行に単一責務JSDoc（3行以内）。案：「責務：履歴のスナップショット（作業データ＋選択集合）の取得と、キャンバスへの適用を担う（HistoryManagerへ注入するcapture/restoreの実体）。DOMに触れない。」
        *   `capture()`・`restore(snapshot)`の処理・戻り値・`console.warn`は現行`main.js`の`captureSnapshot`/`restoreSnapshot`と同一にし、既存のJSDocの説明（共有しない理由・全体失敗またはスキップ1件以上でキャンバスを変更しない理由・`shouldRestoreSelection()`が真のときのみ選択集合を復元・進行中の入力操作の中断は呼び出し側の責務）を移す（「選択モードのときのみ」という説明は`main.js`側の注入箇所のコメントに残す）。typedef`Snapshot`を定義し、`HistoryManager.js`と同じ内容である旨を記載する。
        *   `main.js`：`import { SnapshotAdapter } from './edit/SnapshotAdapter.js';`を追加し、`// 3.5.`の`captureSnapshot`/`restoreSnapshot`の関数定義を削除して2章のとおり`snapshotAdapter`の生成と`HistoryManager`への注入に置き換える。`// 3.5.`の見出しコメントを実態（スナップショットの実体は`SnapshotAdapter`）に合わせて更新する。注入する`shouldRestoreSelection`の実体（`inputTracker.getMode() === OperationMode.SELECT`）が後で宣言される`inputTracker`を参照する旨のコメントを残す。`SnapshotAdapter.js`は`OperationMode`・`InputTracker`をimport・参照しない（JSDocで`shouldRestoreSelection`は「選択集合を復元してよいか」を返す関数とだけ説明し、操作モードに言及しない）。`performUndo`/`performRedo`・`?dev`の`onImport`は変更しない。
        *   `main.js`がまだ`DocumentSerializer`を使う（`?dev`）ためimportは残す。
        *   本タスク完了時点で、取り消し・やり直しの挙動が変わらないこと。
*   [ ] タスク2: IndexedDBへの読み書きを担う`CanvasStorage`の新設
    *   **対象ファイル** :
        *   `./js/io/CanvasStorage.js` :（新規）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務：ブラウザ内保存先（IndexedDB）へのキャンバス記録と最後に開いていたキャンバスの識別子の読み書きを担う。IndexedDBのAPIを呼ぶ唯一のモジュール。作業データの中身は解釈しない。」
        *   importなし。モジュール定数`STORAGE_CONFIG`（凍結。exportしない）とtypedef`CanvasRecord`を2章要件1のとおり定義し、JSDocに各項目の意味・保存しないもの・`document`を解釈しないことを記載する。
        *   クラス`CanvasStorage`：private`#db`（`IDBDatabase|null`）。公開API`open`・`getAllRecords`・`getRecord`・`putRecord`・`renameRecord`・`deleteRecord`・`getLastOpenedId`・`setLastOpenedId`を2章要件1のとおり実装する（`IDBRequest`／`IDBTransaction`を`Promise`へ包むprivateヘルパーを1つ持ってよい）。書き込みは`transaction`の`oncomplete`で解決、`onerror`/`onabort`でreject。`open`は`onupgradeneeded`でストアを作成し、`onblocked`は`console.warn`のみ。
        *   JSDocに、書き込み順序の保証（呼び出し時点で同期的にトランザクションを生成し、IndexedDBが生成順に実行する）・失敗時はrejectし捕捉は呼び出し側の責務であること・`open()`前の呼び出しはrejectすること・版を上げる場合の手順（`databaseVersion`を+1し`onupgradeneeded`に旧版からの移行を追加）を記載する。
        *   DOM・図形種別・図形固有のプロパティ名・作業データ形式の知識を持たないこと。本タスクでは他ファイルを変更しない（未使用のためアプリの動作は変わらない）。
*   [ ] タスク3: キャンバス一覧の管理を担う`CanvasLibrary`の新設（状態・起動時の復元・切り替え処理・自動保存・開く・新規作成）
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js` :（新規）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務：キャンバス一覧の管理（起動時の復元・開く・新規作成・切り替え処理・開いているキャンバスの自動保存・保存失敗の状態）を担う。DOMに触れない。」（名前の変更・削除はタスク4で責務の記述に加える）
        *   importは`../io/DocumentSerializer.js`のみ（`CanvasStorage`・`VectorModel`・`HistoryManager`は注入）。モジュール定数`AUTOSAVE_DELAY_MS = 500`・新規キャンバス名の接頭辞`'無題 '`（exportしない）。typedef`CanvasSummary`・`CanvasLibraryState`・`CanvasIssue`。
        *   `constructor({ storage, model, historyManager, prepareSwitch, resetView })`（`prepareSwitch`・`resetView`が関数でなければ`Error`）。`historyManager.onChange`へ自動保存の予約を登録する。
        *   公開API：`start()`・`openCanvas(id)`・`createCanvas()`・`flushPendingSave()`・`getState()`・`onChange(listener)`を2章要件1〜4のとおり実装する。privateで`#issueCanvasId()`・`#nextUntitledName()`・`#scheduleSave()`・`#saveOpenCanvasNow()`・`#prepareLeave()`・`#enterCanvas(summary, shapes)`・`#openFirstLoadable(candidates, loadDocument)`（起動時・削除後（タスク4）の共通。候補は要約の配列で、作業データの取得方法を引数で受け取る：起動時は`getAllRecords()`で読み出し済みの記録から、削除後は`storage.getRecord(id)`で取得。取得失敗・`null`・`ok: false`は`console.warn`して次の候補へ。読めた候補が無ければ新規作成して開く）・`#setIssue(issue)`・`#notifyChange()`等を持つ。処理中の直列化（`#isBusy`）・`getState()`の全項目（`busy`・`canManage`を含む）も本タスクで実装する。`setTimeout`/`clearTimeout`/`Date.now`/`Math.random`以外のブラウザAPI（`document`・`window`のイベント等）を使わない。
        *   外部からの公開メソッドの`Promise`はrejectしない（内部で捕捉して`console.warn`＋`issue`）。
        *   `#isLoading`の初期値は`true`とする（`start()`前の`getState().loading`も`true`。2章要件3）。自動保存の予約を止める仕組みは`#isSwitching`の1つに揃え、`false`へ戻すのは切り替え処理の手順5の終わり（`#enterCanvas`内）とする（2章要件2。削除の中止時の扱いはタスク4）。
        *   切り替え処理の手順4は保留中の保存を`#saveOpenCanvasNow()`で書くが完了を待たず、失敗しても切り替えを続ける（手順2は失敗で中止。2章要件4の「手順2との違い」）。
        *   JSDocに次を記載する：キャンバス記録と保存しないもの／キャンバスの識別子の形式（本クラスに閉じる）／自動保存の契機（`historyManager.onChange`。選択・ホバー・パン・ズームでは保存しない）と待ち時間とページ非表示時の確定（`flushPendingSave`は`main.js`から呼ばれる）／非同期保存と切り替えの順序の保証（2章要件2の1〜4）／起動時に開くキャンバスの決定規則と読み込み完了前の操作の扱い（`loading`の間は`main.js`が覆い要素でキャンバスへのマウス入力を止める前提。本クラスは読み込み中の操作を受理しない）／`#isSwitching`の意味（自動保存の予約を止める区間と、`true`にする2箇所。`false`へ戻すのは切り替え処理の手順5の終わり（`#enterCanvas`内）と削除の中止時）／壊れた作業データ・一部スキップの扱い／切り替え処理の手順1〜6（履歴のリセット・ビュー変換の初期化・切り替えを編集操作として記録しない・クリップボードに触れない（段数もリセットしない））／手順2と手順4の保存の失敗時の違いとその理由（手順4は`await`を挟まない同期区間のため待てない。手順4で書くのは手順2〜3の`await`中に行われた編集のみで、失敗時は`'writeFailed'`で示す）／新規キャンバスの命名規則／処理中の直列化／`issue`の種類と解除条件。
        *   図形種別の分岐・図形固有のプロパティ名・図形のid形式を持たないこと（作業データは不透明に扱う）。本タスクでは他ファイルを変更しない（未使用のためアプリの起動・動作は変わらない）。
*   [ ] タスク4: `CanvasLibrary`への名前の変更・削除の追加
    *   **対象ファイル** :
        *   `./js/edit/CanvasLibrary.js` :（更新）
    *   **作業内容** :
        *   先頭行の単一責務JSDocに名前の変更・削除を加える（3行以内）。案：「責務：キャンバス一覧の管理（起動時の復元・開く・新規作成・名前の変更・削除・切り替え処理・開いているキャンバスの自動保存・保存失敗の状態）を担う。DOMに触れない。」
        *   モジュール定数`CANVAS_NAME_MAX_LENGTH = 100`（exportしない。唯一の定義箇所）を追加する。
        *   公開API`renameCanvas(id, rawName)`・`deleteCanvas(id)`を2章要件5のとおり実装する（処理中の直列化`#isBusy`・`issue`はタスク3の仕組みを使う。開いているキャンバスの削除後の切り替えはタスク3の`#openFirstLoadable`と切り替え処理の手順3〜6を使う）。
        *   開いているキャンバスの削除では、開始時に`#isSwitching = true`とし、削除後の切り替え処理の手順5の終わり（`#enterCanvas`内）で`false`に戻る。削除の中止時は`false`へ戻して`#scheduleSave()`で予約し直す（2章要件2・要件5）。
        *   外部からの公開メソッドの`Promise`はrejectしない（内部で捕捉して`console.warn`＋`issue`）。
        *   JSDocに次を記載する：名前の変更の受理条件（空・キャンセル・最大文字数・最終更新日時を変えない理由）／削除の受理条件と開いているキャンバスを削除した場合の挙動（削除したキャンバスの記録を復活させない理由）。タスク3で記載した`#isSwitching`の説明と矛盾しないことを確認する。
        *   既存（タスク3）の処理は変更しない。本タスクでは他ファイルを変更しない（未使用のためアプリの起動・動作は変わらない）。
*   [ ] タスク5: `PaletteLauncher`と`CanvasPalette`の新設
    *   **対象ファイル** :
        *   `./js/palette/PaletteLauncher.js` :（新規）
        *   `./js/palette/CanvasPalette.js` :（新規）
    *   **作業内容** :
        *   `PaletteLauncher.js`：先頭行の責務JSDoc案「責務：コントロールパネルの呼び出し口のボタンと、開閉式のフロートウィンドウ（パレット）の対応づけと開閉（表示切り替え・ボタンの押された見た目・パレットの×ボタン）を担う。DOM操作専任。」。2章要件6のとおり実装し、JSDocに対応表のエントリの形・後続のパレットの追加方法（`index.html`へ静的にDOMを置き`hidden`で初期非表示 → `main.js`の対応表へ1エントリ追加）・`WindowManager`は開閉に関与しないこと・対応表に無いウィンドウの`×`は無機能のままであることを記載する。importなし。
        *   `CanvasPalette.js`：先頭行の責務JSDoc案「責務：キャンバスパレット（キャンバス一覧・新規作成・名前の変更・削除・保存状態の表示）のDOM操作を担う自己完結UI部品。操作の実行は注入されたコールバックへ委譲する。」。2章要件5・6のとおり実装する（イベント委譲・`textContent`のみ・`window.prompt`/`window.confirm`の文言・押されたボタンの`blur()`・`ISSUE_MESSAGES`）。typedef`CanvasLibraryState`の受け取る項目をJSDocに記載する（`CanvasLibrary.js`の定義と揃える旨）。importなし。
        *   JSDocに、名前の変更・削除の小窓の扱い（キャンセル時は何も呼ばない。空文字の判定は`CanvasLibrary`側）、`busy`・`canManage`・`loading`・`issue`による表示の規則、`VectorModel`・図形データ・IndexedDBに依存しないことを記載する。
        *   本タスクでは他ファイルを変更しない（未使用のためアプリの動作は変わらない）。
*   [ ] タスク6: `index.html`へキャンバスパレット・呼び出し口・キャンバス名の表示・読み込み中の覆い要素を追加
    *   **対象ファイル** :
        *   `./index.html` :（更新）
    *   **作業内容** :
        *   2章要件6のとおり、コントロールパネル末尾へ`#canvas-name-display`と`#launcher-canvas`を追加し、`#window-canvas-palette`（`hidden`）を`#window-dev-panel`の前に追加する。
        *   2章要件6の「読み込み中の覆い要素」の項（要件3を満たす手段）のとおり、`<canvas id="editor-canvas">`の直後に`#canvas-loading-cover`（文言「読み込み中…」）を**`hidden`付き**で追加する（非表示にする配線はタスク7で入るため、本タスクでは非表示で置く。`hidden`はタスク7で外す）。
        *   スタイルを追加し（`#window-canvas-palette`・`.canvas-name-display`・`.canvas-list`・`.canvas-row`・`.canvas-row-open`・`.canvas-row-btn`・`.canvas-row.current .canvas-row-open`・`.canvas-notice`・`.canvas-loading-cover`・`.canvas-loading-cover[hidden]`）、それぞれにコメント（役割・位置の根拠。覆い要素は`z-index`の根拠と`[hidden]`指定が必須な理由）を付ける。
        *   `#window-shape-palette`の`top`を`440px`へ変更し、直前のコメントを計算根拠（2章要件6）に更新する。
        *   既存の要素・スタイルは変更しない。本タスク完了時点では呼び出し口は未配線（押しても何も起きない）で、覆い要素は非表示のため、キャンバスへのマウス入力を含む既存の操作は従来どおり動作する。
*   [ ] タスク7: `main.js`のキャンバス管理の配線（覆い要素の表示開始を含む）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
        *   `./index.html` :（更新。`#canvas-loading-cover`の`hidden`属性の削除のみ）
    *   **作業内容** :
        *   import追加：`CanvasStorage`（`./io/CanvasStorage.js`）・`CanvasLibrary`（`./edit/CanvasLibrary.js`）・`CanvasPalette`・`PaletteLauncher`（`./palette/`）。
        *   `// 7.5.`の後に`// 7.6. キャンバス管理（キャンバス一覧・自動保存・キャンバスパレット・呼び出し口）配線`を置き、次を行う（コメントで、処理本体は`CanvasLibrary`が持ち、ここは生成と注入のみである旨を明記）：
            *   `new PaletteLauncher(paletteLaunchers)`（対応表`paletteLaunchers`は同ブロックの定数。JSDocに追加方法）。
            *   `const canvasLibrary = new CanvasLibrary({ storage: new CanvasStorage(), model, historyManager, prepareSwitch: () => applyMode(OperationMode.SELECT), resetView: () => viewTransform.reset() });`
            *   `const canvasPalette = new CanvasPalette(document.getElementById('window-canvas-palette'), { onOpen: (id) => canvasLibrary.openCanvas(id), onCreate: () => canvasLibrary.createCanvas(), onRename: (id, name) => canvasLibrary.renameCanvas(id, name), onDelete: (id) => canvasLibrary.deleteCanvas(id) });`
            *   `syncCanvasNameDisplay()`（2章要件7。JSDoc付き）と、`canvasLibrary.onChange`への`syncCanvasNameDisplay`・パレットの`render`の登録。
            *   `syncLoadingCover()`（2章要件3・要件7。`#canvas-loading-cover`の`hidden`を`!getState().loading`にする。要素が無ければ`console.warn`のみ。JSDocに、読み込み完了までキャンバスへのマウス入力を止めて読み込み完了時の切り替えで利用者の操作が消されないようにする目的を記載）と、`canvasLibrary.onChange`への登録。
            *   `document`の`visibilitychange`（`hidden`のとき）と`window`の`pagehide`で`canvasLibrary.flushPendingSave()`を呼ぶ。
        *   `index.html`：`syncLoadingCover()`の配線と同時に、タスク6で追加した`#canvas-loading-cover`の`hidden`属性を外す（2章要件3の「段階的な追加」。`main.js`の実行前からキャンバスへのマウス入力を遮るため）。`index.html`のそれ以外の箇所は変更しない（覆い要素のスタイルのコメントに初期表示である旨が必要なら、そのコメントのみ更新してよい）。
        *   `// 9.`の`?dev`の`onImport`の先頭に、`canvasLibrary.getState().loading`が真なら図形一式・履歴に触れず`{ ok: false, restoredCount: 0, reassignedCount: 0, skipped: [], error: 'キャンバスの読み込み中です' }`を返す判定を追加し、既存のコメントに理由（読み込み完了時の切り替えで復元内容が消されるため。2章要件3）を追記する。それ以外の`onImport`の処理は変更しない。
        *   初期化の最後（`syncHistoryButtonState()`の後）に、`syncCanvasNameDisplay()`・`syncLoadingCover()`・`canvasPalette.render(canvasLibrary.getState())`・`canvasLibrary.start()`をコメント付きで追加する（`start()`は非同期で、読み込み完了時に切り替え処理で図形一式が入り、覆い要素が非表示になる）。
        *   再描画・削除ボタン・取り消し/やり直しボタンの同期処理を追加しない（既存経路に任せる）。`window`への公開を行わない。図形種別・図形固有のプロパティ名を持ち込まない。
        *   先頭行の責務JSDocが実態と一致していることを確認する（変更不要の見込み）。改修後の行数を確認しRESへ記録する。
        *   本タスク完了時点で、自動保存・起動時の復元・キャンバスパレットの全操作が動作し、読み込み中はキャンバスへのマウス入力が遮られ、読み込み完了後に覆い要素が非表示になって操作できる。
*   [ ] タスク8: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   `./js/edit/SnapshotAdapter.js`、`./js/io/CanvasStorage.js`、`./js/edit/CanvasLibrary.js`、`./js/palette/CanvasPalette.js`、`./js/palette/PaletteLauncher.js`、`./js/main.js` :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261104_0049_RES_Phase03-04_Canvas_Library.md` :（更新）
    *   **作業内容** :
        *   JSDocの記載漏れがないことを確認する。特に次がJSDocから読み取れること：キャンバス記録の内容と保存しないもの／キャンバスの識別子の形式／自動保存の契機と待ち時間とページ非表示時の確定／非同期保存と切り替えの順序の保証（手順2と手順4の保存の失敗時の違いを含む）／起動時に開くキャンバスの決定規則と読み込み完了前の操作の扱い（覆い要素・`?dev`の復元の受理拒否）／切り替え処理の手順（履歴のリセット・ビュー変換の初期化・クリップボードを消さないこと）／新規キャンバスの命名規則／名前の変更と削除の受理条件／開いているキャンバスを削除した場合の挙動／保存失敗時の扱い／呼び出し口とパレットの対応の追加方法／`SnapshotAdapter`が操作モードを知らないこと（`shouldRestoreSelection`の意味）。
        *   全改修対象`.js`の先頭行の責務JSDoc（3行以内）が実態と一致していることを確認する。
        *   本RESの「4. 詳細作業内容」を記入し、開発資料への影響を「開発資料の更新予定」欄へ、判断に迷った点・目視確認項目・将来の注意点を「5. 懸念事項・要確認ポイント」欄へ追記する。
*   [ ] タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料の更新予定」に記録した内容（各タスクでの追記を含む）を、1章（新設ファイル・`index.html`のキャンバスパレット、フォルダ分割の方針の`io/`の説明の追加と`edit/`の定義の拡張（キャンバス一覧の管理・スナップショットの取得/適用を含める））、2章（キャンバス記録）、3章（起動処理の変更（非同期の読み込み）、自動保存・キャンバス切り替えの流れ、履歴のリセットの呼び出し元）、4章（`edit/`の定義の拡張（キャンバス一覧の管理・スナップショットの取得/適用を含める）、新設クラスの責務、`main.js`の配線とスナップショット処理の切り出し、`HistoryManager.js`の`clear()`の呼び出し元、`WindowManager.js`との関係（開閉式パレット）、コントロールパネルの位置づけ（呼び出し口））へ反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本最終タスクのみ明示的な例外とする（後続タスクが存在せず、他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: スナップショットの取得・適用を`SnapshotAdapter`へ切り出す
*   **作業内容** :
    *   `js/edit/SnapshotAdapter.js`を新設。先頭行の責務JSDocは計画の案どおり（1行）。importは`../io/DocumentSerializer.js`のみ。typedef`Snapshot`（`HistoryManager.js`と同じ内容である旨・形を変える場合は両方を揃える旨を記載）とクラス`SnapshotAdapter`を定義した。
        *   `constructor({ model, shouldRestoreSelection })`：`shouldRestoreSelection`が関数でなければ`Error`。private`#model`・`#shouldRestoreSelection`に保持。
        *   `capture()`：旧`captureSnapshot`と同一（`{ document: DocumentSerializer.serialize(model.getShapes()), selectedIds: model.getSelectedIds() }`）。共有しない理由のJSDocを移した。
        *   `restore(snapshot)`：旧`restoreSnapshot`と同一の処理・戻り値・`console.warn`文言（「履歴の適用に失敗したため、キャンバスを変更しません。」）。選択集合の復元条件のみ`inputTracker.getMode() === OperationMode.SELECT`→`this.#shouldRestoreSelection()`に置き換えた。JSDocは「`shouldRestoreSelection()`が真のときのみ復元」とし、操作モードには言及しない。進行中の入力操作の中断は呼び出し側の責務である旨を記載。
        *   クラスJSDocに依存の制約（DOMに触れない・図形種別等の知識なし・`OperationMode`/`InputTracker`をimport・参照しない）を記載。
    *   `js/main.js`：`import { SnapshotAdapter } from './edit/SnapshotAdapter.js';`を追加。`// 3.5.`の`captureSnapshot`/`restoreSnapshot`の関数定義（JSDoc含む）を削除し、`snapshotAdapter`の生成（`shouldRestoreSelection: () => inputTracker.getMode() === OperationMode.SELECT`）と`new HistoryManager({ capture: () => snapshotAdapter.capture(), restore: (snapshot) => snapshotAdapter.restore(snapshot) })`に置き換えた。見出しコメントを「実体はSnapshotAdapter（edit/）、ここは生成と注入のみ」へ更新し、「選択モードのときのみ選択集合を復元する」規則と、後で宣言される`inputTracker`を参照するが起動完了後の取り消し・やり直し時のみ呼ばれる旨のコメントを残した。
    *   `DocumentSerializer`のimportは`?dev`（`onExport`/`onImport`）で使うため残した。`performUndo`/`performRedo`・`onImport`は変更していない。
    *   `main.js`の行数：418行 → 390行。

### タスク2: IndexedDBへの読み書きを担う`CanvasStorage`の新設
*   **作業内容** :
    *   (未実施)

### タスク3: キャンバス一覧の管理を担う`CanvasLibrary`の新設（状態・起動時の復元・切り替え処理・自動保存・開く・新規作成）
*   **作業内容** :
    *   (未実施)

### タスク4: `CanvasLibrary`への名前の変更・削除の追加
*   **作業内容** :
    *   (未実施)

### タスク5: `PaletteLauncher`と`CanvasPalette`の新設
*   **作業内容** :
    *   (未実施)

### タスク6: `index.html`へキャンバスパレット・呼び出し口・キャンバス名の表示・読み込み中の覆い要素を追加
*   **作業内容** :
    *   (未実施)

### タスク7: `main.js`のキャンバス管理の配線（覆い要素の表示開始を含む）
*   **作業内容** :
    *   (未実施)

### タスク8: JSDocの確認とRESの完成
*   **作業内容** :
    *   (未実施)

### タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   (未実施)

## 5. 懸念事項・要確認ポイント
* **読み込み完了前の操作**: 読み込み完了まで覆い要素`#canvas-loading-cover`がキャンバスへのマウス入力を遮るため、図形の作成・選択・ドラッグ・パン・ホイールズームは起きない。キーボードショートカットとフロートウィンドウ上のボタンは働くが、読み込み中は図形0個・クリップボード空・履歴空のため図形一式を変える操作は何もしない。唯一図形一式を変え得る`?dev`の「復元」は読み込み中は受理しない。よって読み込み完了時の切り替え処理で利用者の操作が消されることも、別のキャンバスに保存されることもない（2章要件3）。覆い要素の表示中に`Ctrl`＋ホイールを使うとブラウザ自体の拡大縮小が起きうる（キャンバスの`wheel`の`preventDefault()`が働かないため。作業内容には影響しない）。
* **覆い要素`#canvas-loading-cover`の追加はREQの列挙外**: REQのスコープ欄の`index.html`変更項目の列挙には含まれていないが、要件3（読み込み完了までの扱い）を満たす手段として、現場設計AI（発注者側）がチェック0の対応で指示した追加である。タスク6では`hidden`付き（非表示）で置き、タスク7で`syncLoadingCover()`の配線と同時に`hidden`を外す（各タスク完了時点でアプリが正常に動作するため）。
* **`CanvasLibrary`を1クラスにまとめる理由（クラス分割はしない）**: 起動時の復元・開く・新規作成・名前の変更・削除・切り替え処理・自動保存・保存失敗の状態を1クラスが持つ。自動保存の確定（保留中の保存・`#pendingSaveCanvasId`）と切り替え処理の順序保証（手順2・手順4での確定、`#isSwitching`による予約の停止、開いているキャンバスの削除時の保留の破棄）が同じprivate状態を同期区間内で読み書きする密結合のため、別クラスに分けると状態の受け渡しで順序保証が崩れやすくなる。実装量の偏りはタスク3・タスク4に分けて扱う。
* **切り替え処理の手順2と手順4の保存失敗時の違い**: 手順2（`await flushPendingSave()`）は失敗で切り替えを中止するが、手順4（同期区間内の`#saveOpenCanvasNow()`）は完了を待たず、失敗しても切り替えを続ける。手順4は`await`を挟まない同期区間のため待てず、手順4で書くのは手順2〜3の`await`中に行われた編集のみである。失敗時は`console.warn`＋`'writeFailed'`で示すが、その分の変更は切り替え前のキャンバスに保存されない可能性がある（2章要件4）。
* **ローカルファイルとして開いた場合の保存先**: IndexedDBはオリジン単位のため、`file://`で開いた場合とローカルサーバー経由で開いた場合では別のキャンバス一覧になる。ブラウザによっては`file://`でIndexedDBが使えず、`'unavailable'`（保存できない表示）になる。
* **保存に失敗した状態での切り替え**: 切り替え前のキャンバスの保存に失敗すると切り替えを中止する（保存できていない変更を画面から消さないため）。容量超過が続く場合は、不要なキャンバスの削除（開いていないもの）で空きを作る運用になる。
* **新規作成の記録の書き込みに失敗した場合**: そのキャンバスはメモリ上の一覧にだけ存在し、次の自動保存が成功した時点で記録が作られる。編集せずに別のキャンバスへ切り替えて再読み込みすると、そのキャンバスは一覧から消える。
* **一部スキップして開いたキャンバス**: 開いただけでは記録は変わらないが、編集すると読めなかった図形は記録から消える（パレットの文言で予告。Phase 03-05で通知UIを見直す）。
* **起動時に全記録を読み出す**: 一覧の作成のため起動時に全キャンバスの作業データを一度読み出す（以後はメモリに保持しない）。キャンバス数・図形数が極端に多い場合は起動時間を確認すること。
* **小窓とスペースパン**: `Space`を押したまま名前の変更・削除の小窓を開き、表示中に離すと、`keyup`を取りこぼして`grab`カーソルが残る可能性がある（次の`Space`の`keyup`・ウィンドウの`blur`で解消）。`InputTracker`は変更しない。
* **`WindowManager.js`は変更しない**: 非表示で静的に置いたウィンドウも起動時に配線され、表示後のドラッグ移動・最前面化が働く見込み。働かない場合のみ、理由を記録したうえで変更を検討する。開いたパレットが他のウィンドウの下に隠れる場合（ドラッグで重ねた後）は、クリックで最前面になる（既存の最前面化）。
* **図形パレットの`top`（440px）**: ボタンの高さはフォント・絵文字の表示に依存するため、コントロールパネル下端との余白が24px以上あるかを目視確認すること。
* **（タスク1）`Snapshot`の型定義の二重化**: typedef`Snapshot`は`HistoryManager.js`と`SnapshotAdapter.js`の両方にある。スナップショットの形を変える場合は両方を揃えること。タスク1完了時点で、取り消し・やり直し（選択モード時の選択集合の復元を含む）の挙動が従来どおりかを目視確認すること。
* **テストプレイでの目視確認項目**:
    * 図形を描いて再読み込みすると同じ図形が出る／ブラウザを閉じて開き直しても残る／描いた直後（1秒以内）に再読み込みしても残る。
    * 再読み込み後は倍率100%・選択モード・取り消しボタンが押せない状態。
    * 起動直後の読み込み中はキャンバスを操作できず（「読み込み中…」の覆いが表示され、クリック・ドラッグ・ホイールで何も起きない）、読み込み完了後に覆いが消えて操作できる。読み込み中もコントロールパネル等のフロートウィンドウは覆いの前面にある。`?dev`付きで開いた場合、読み込み中に「復元」を押すと失敗表示になりキャンバスは変わらない。
    * パレットを開いて新規作成すると空のキャンバスになり、名前が「無題 n」と表示される（一覧・コントロールパネル・タブ名）。
    * 一覧から前のキャンバスを選ぶと元の図形に戻り、取り消しが押せない状態になる（倍率100%に戻る）。開いているキャンバスの行を押しても何も起きない。
    * 名前の変更が一覧・コントロールパネル・タブ名に反映され、再読み込み後も残る。名前変更の小窓でキャンセル・空欄（空白のみ）にすると名前が変わらない。100文字を超える名前は100文字に切り詰められる。
    * 削除の小窓でキャンセルすると消えない、OKで一覧から消える。開いていないキャンバスを削除しても、開いているキャンバスの図形・取り消しの状態は変わらない。
    * 開いているキャンバスを削除すると最近更新したものが開く、最後の1枚を削除すると新しい空のキャンバス（無題 1）になる。削除直後に再読み込みしても、削除したキャンバスが復活しない。
    * キャンバスAでコピー → Bへ切り替え → 貼り付けでBに貼られ、1回の取り消しで消える（DIR 03-03の持ち越し確認）。
    * パレットの`×`・呼び出し口のボタンで閉じる（ボタンの押された見た目も戻る）、ヘッダーでドラッグ移動できる。他のウィンドウの`×`は従来どおり何も起きない。
    * コントロールパネル・図形パレット・キャンバスパレットが重ならない（`?dev`の確認用ウィンドウとも）。キャンバス数が多いとパレット内でスクロールできる。
    * 図形の作成途中・ドラッグ中（中ボタンのパン中を含む）にパレットを操作しても状態が壊れない（作成途中の図形は切り替えで破棄、ドラッグで動かした分は切り替え前のキャンバスに保存される）。
    * 小窓を閉じた後にショートカット・スペースパンが正常に働く。小窓を閉じた後に`Enter`を押しても操作が繰り返されない。
    * キャンバスを何度も切り替え・貼り付け・取り消しを繰り返してもidの衝突による異常がない（`?dev`の「JSONへ変換」でidの重複がないこと）。
    * プライベートウィンドウ等で保存できない場合でも描画・編集ができ、パレットに保存できない旨、コントロールパネルのキャンバス名に`⚠`が表示される。
    * 既存の操作（図形作成5種・クリック選択・範囲選択・本体ドラッグ・ハンドル操作・削除ボタン・取り消し/やり直し（ボタン・ショートカット）・コピー/切り取り/貼り付け/複製・全ショートカット・パン3通り・ホイールズーム・倍率表示・リセット・モードボタン・図形パレットのハイライトと活性/非活性・`?dev`の確認用ウィンドウ・原点表示）の挙動が変わらない。
