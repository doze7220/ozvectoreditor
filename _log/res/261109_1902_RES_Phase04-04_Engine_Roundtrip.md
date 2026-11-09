# RES: 作業計画・作業レポート (Phase 04-04) : OZ Engineでの表示確認と往復（スプライトの出力をJSだけにする）
* 参照元REQ: `./_log/req/261109_1856_REQ_Phase04-04_Engine_Roundtrip.md`

## 1. 作業目的
OZ Engineは「出力（エンジン用）」で書き出したJS（`<名前>.js`）だけを使い、既定のexportの`draw(ctx)`だけを呼ぶことがエンジン側で確かめられた（往復は1回で完了、エディタ側の直しはなし）。スプライトのJSON（`<名前>.json`）には読み手がいないため、次を行う。
* 「出力（エンジン用）」をJS 1つのダウンロードだけにする（JSのテキストは本作業の前後で同じ）。
* エディタの「開く」「インポート」でスプライトのJSONを読まない（`.json`＝作業データファイル、`.js`＝スプライトの1対1にする）。
* 確認用ページ（`sprite-check.html`）をJSだけの表示にする。
* JSON専用のメソッド・定数・文言・テストを整理する。
* 開発資料2章「スプライト（書き出し形式）」をJSだけの記述に直し、エンジンとの約束(a)〜(c)を書き足す。エンジンからの返信`_doc/BRIDGE_FROM_ENGINE.md`を削除する。

書き出し形式の版（`formatVersion`）は1のまま上げない（エンジンが読む部分＝JSの既定のexportの形と`draw(ctx)`の約束が変わらないため）。`CodeExporter.toModuleText`・`SpriteSerializer.serialize`・埋め込む描画処理は変更しない。

## 2. アーキテクチャ設計

### 要件1: 「出力（エンジン用）」をJSだけにする
*   **`CanvasFileOperations.exportSprite`**（`edit/`）の手順を次にする。
    1. 受理条件・通知の消去は従来どおり（`loading`・`busy`が偽。`'unavailable'`でも受理）。
    2. `SpriteSerializer.serialize(model.getShapes())` → `CodeExporter.toModuleText(spriteData)`でJSのテキストを組み立てる（ここで例外ならダウンロードしない）。
    3. `fileIO.downloadSpriteModule(JSのテキスト, openCanvasName ?? '')`を1回だけ呼ぶ。
    4. 例外は`console.warn`＋通知`spriteExportFailed`。成功時・図形0個のときは通知を出さない。戻り値は「JSをダウンロードしたか」。
    *   `SpriteSerializer.stringify`の呼び出しを外す（`exportSprite`では不要になる）。`SpriteSerializer`のimportは`serialize`のため残る。
    *   図形一式・選択集合・履歴・ビュー変換・操作モード・作成途中の図形に触れない（従来どおり）。
    *   `#fileIO`のJSDoc（使うメソッドの一覧・型）から`downloadSpriteJson`を外す。クラスJSDoc「■ 出力（エンジン用）」を1ファイルの手順に書き直す（「1つ目の失敗で2つ目を呼ばない」「2つのダウンロードは間隔を空けない」「JSは既に落ちており取り消せない」等の記述をなくす）。
*   **`DocumentFileIO`**（`io/`）から、スプライトのJSONのためだけにあるものを削除する（実コードで確認済みの一覧）。
    *   公開メソッド`downloadSpriteJson(text, canvasName)`（呼び出し元は`CanvasFileOperations.exportSprite`のみ）。
    *   公開メソッド`toSpriteJsonFileName(canvasName)`（呼び出し元は`downloadSpriteJson`と`test/io/DocumentFileIO.test.js`のみ）。
    *   非公開定数`SPRITE_JSON_EXTENSION`（使用は`toSpriteJsonFileName`のみ）。
    *   残すもの：`FILE_MIME_TYPE`（作業データファイルで使う）、`FILE_EXTENSION_PATTERN`（`.json`は作業データファイルの従来の拡張子として引き続き除く）、`toSpriteModuleFileName`・`downloadSpriteModule`・`#toBaseName`の`stripLeadingUnderscores`（JSで使う）。
    *   先頭の責務JSDoc・クラスJSDoc・`toCanvasName`・`#downloadBlob`のJSDocから「スプライトのJSON」「3つのダウンロード」の記述をなくす（責務の範囲は広げない）。
*   **`SpriteSerializer.stringify`は残す**：`CodeExporter.toModuleText`がJSへデータを埋め込むときに使っている（`js/io/CodeExporter.js`の`toModuleText`内）。削除しない。`SpriteSerializer.js`は変更しない（JSDocにスプライトのJSONのファイルへの言及がないことを確認済み）。
*   呼び出し元を先に外してから削除する順序とする（タスク1で`CanvasFileOperations`から呼び出しを外し、タスク2で`DocumentFileIO`から削除）。

### 要件2: エディタの「開く」「インポート」でスプライトのJSONを読まない
*   **判定の場所（決定）**：`FileContentReader`で、**JSONとして解析できた値は作業データとしてのみ扱い、`SpriteSerializer.checkFormat`を通さずに`DocumentSerializer.deserialize(data)`へそのまま渡す**。スプライトのJSON（`format: "oz-vector-editor-sprite"`）は`DocumentSerializer`の「作業データ形式が一致しません」の全体失敗（`ok: false`・`console.warn`は`DocumentSerializer`が1回）になる。
    *   理由：`DocumentSerializer`にスプライト形式の知識を持ち込まずに済む（`DocumentSerializer`は`format`が`"oz-vector-editor"`でないものを落とすだけで、スプライトの識別子を知らない）。`FileContentReader`のJSONの経路が`DocumentSerializer.deserializeFromString`と完全に同じ分類になる（既存の「作業データファイルの結果は`deserializeFromString`と同じ分類」の約束がJSON全体へ広がる）。判別の分岐が減る。
    *   `DocumentSerializer.js`は変更しない。
*   **`FileContentReader.deserializeFromText`の新しい判別の順序**：
    1. `JSON.parse(text)`を試す。成功すれば`DocumentSerializer.deserialize(data)`を返す（「JSONから」。スプライトのJSONもここで作業データとして判定され、読み込み不可になる）。
    2. 失敗したら`CodeExporter.extractSpriteDataText(text)`で取り出し（JSは実行しない）、`JSON.parse`して`data`とする（「JSから」）。取り出せない・解析できない場合は読み込み不可（本クラスが警告1回）。
    3. 「JSから」の`data`だけを`SpriteSerializer.checkFormat(data)`で判別する：`'notSprite'`→読み込み不可／`'unsupportedVersion'`→読み込み不可／`'supported'`→`source`が無ければ読み込み不可、あれば`DocumentSerializer.deserialize(data.source)`。
    *   `fromModule`の変数は不要になる（JSONの経路が先に返るため）。全体失敗の警告は従来どおりどの経路でも1回、例外を投げない、引数を書き換えない。
    *   先頭の責務JSDoc・クラスJSDoc（判別の順序・表・規則）・`deserializeFromText`の`@param`を、「作業データのJSON・スプライトのJS」の2種の判別に直す。スプライトのJSONは作業データとして判定され読み込み不可になる旨を書く。
*   **`CanvasFileOperations`**：判定の表（`#classifyRead`）の「読み込み不可」の行に「スプライトのJSON（作業データ形式の違いとして`DocumentSerializer`が落とす）」を加える（JSDocのみ。処理は変えない。`CanvasFileOperations`はスプライト形式を知らないまま）。
*   変えないもの：`index.html`の`accept`（`.json`は作業データファイルのため外さない）、`DocumentFileIO.toCanvasName`の規則、通知の種類（`readFailed`のまま）。

### 要件3: 確認用ページをJSだけにする
*   **`sprite-check.html`**：`#check-file-input`の`accept`を`.js,text/javascript`にする。注意書き`#check-warning`（「選んだJSファイルはこのページで実行されます…」）はJSONを前提にしていないため変えない。
*   **`SpriteCheckPage`の流れ（決定）**：読み取り → `SpriteCheckInspector.parseText(text)` → `kind === 'json'`なら`import`を試みずに`CheckFailure('notSprite')`（前の表示は`#resetDisplay`で既に消えている。`#showFailure`で文言を出す。入力の値は選択直後に空へ戻しているため続けて選び直せる）→ `kind === 'module'`ならテキストのままBlob URLの動的`import` → 以降は従来どおり（`inspectModuleExport` → `summarize` → 描画・情報欄）。
    *   **理由の区分（決定）**：新設せず、既存の`notSprite`の文言を「本アプリのスプライトのJSではない（JSON・作業ファイルは表示しない。書き出したJSを選ぶ）」趣旨に直す。JSONを選んだ場合も、`import`できたが既定のexportがスプライトでないJSの場合も、利用者が取るべき行動（「出力（エンジン用）」で書き出した`.js`を選ぶ）は同じため。区分の一覧（`readFailed`・`notSprite`・`unsupportedVersion`・`importFailed`・`drawFailed`）は変わらない。
    *   文言（`FAILURE_MESSAGES`。唯一の定義箇所のまま）：
        *   `notSprite`：`本アプリが出力したスプライトのJSではありません（JSONのファイル・作業ファイルは表示しません。「出力（エンジン用）」で書き出した.jsを選んでください）。`
        *   `importFailed`：`JSとして読み込めませんでした（壊れたファイル、またはJSの読み込み中のエラー）。`
        *   他の区分の文言は変えない。
    *   `CodeExporter`のimportと`CodeExporter.toModuleText`の呼び出しを削除する（JSONを描くためだけに使っていた）。`check/`のimportは`check/`内と`io/SpriteSerializer`（`SpriteCheckInspector`経由）のみになる。
*   **`SpriteCheckInspector`**：
    *   `inspectSpriteData(value)`を削除する（呼び出し元は`SpriteCheckPage`のJSONの経路とテストのみ）。
    *   `parseText(text)`は**残す**（JSONかを中身で見分けるために使い続ける。戻り値の形`ParsedText`も変えない。`value`は使われなくなるが、形を変えるとテストと型の変更が増えるため最小の変更にとどめる）。
    *   `inspectModuleExport`・`summarize`・`#summarizeBounds`は変えない。
    *   先頭の責務JSDoc・クラスJSDoc・`InspectResult`のtypedefの説明から「JSONの値の判定」を外す（「JSの既定のexportの判定、JSONかの見分け、情報欄の要約」）。

### 要件4: 開発資料2章「スプライト（書き出し形式）」へエンジンとの約束を書き足す
*   最終タスク（タスク7）で、`PROJECT_ARCHITECTURE.md` 2章の該当の項を、スプライト＝`<名前>.js`だけの記述に直し、(a)〜(c)を事実の要約として書き足す（詳細は「開発資料の更新予定」）。`_doc/BRIDGE_FROM_ENGINE.md`を参照先にしない。エンジン側の文書は書き換えない。

### 要件5: 自動テストの整理
*   `test/edit/CanvasFileOperations.export.test.js`（タスク1）：偽の`fileIO`から`downloadSpriteJson`を外し、`exportSprite`のダウンロードが`downloadSpriteModule`の1回だけ（記録が1件）であること・中身が`CodeExporter.toModuleText(SpriteSerializer.serialize(shapes))`と一致することを確かめる。偽物に`downloadSpriteJson`が無いため、本体が呼べば例外→通知になりテストが落ちる（「JSONのダウンロードが呼ばれないこと」の確認を兼ねる）。組み立て失敗・JSのダウンロード失敗で`spriteExportFailed`、図形0個（JS 1回・通知なし）、受理条件、通知の消去、副作用なしの既存の確認は残す。「JSONのダウンロードが失敗したら…」のケースは削除する。
*   `test/io/DocumentFileIO.test.js`（タスク2）：`toSpriteJsonFileName`の確認行を削除する。同じ入力で`toSpriteModuleFileName`の確認がまだ無いもの（`'__ a'`・`'_ _'`・`''`・`'a/b'`・`42`）は、`toSpriteModuleFileName`の確認（期待値の拡張子`.js`）へ置き換えて規則の確認を保つ。`toCanvasName`・往復・`toFileName`のテストは残す（`ship.json` → `ship`は作業データファイルの従来の拡張子として残る）。
*   `test/io/FileContentReader.test.js`（タスク3）：スプライトのJSONから図形が戻ることの確認を削除し、スプライトのJS・`CRLF`のJSの確認は残す。新たに「スプライトのJSON（`source`あり・5種の図形／図形0個）は読み込み不可・例外なし・警告1回」を加える。`source`なし・版が範囲外・`source`の版が範囲外のスプライトのJSONは、引き続き読み込み不可（警告1回）として残してよい（経路が`DocumentSerializer`に変わるだけ）。作業データファイル・既存の読み込み不可のケースは残す。
*   `test/edit/CanvasFileOperations.test.js`（タスク3）：`spriteFileCases`からJSONのケースを除き（JS・`CRLF`のJS）、「開く」「インポート」でスプライトのJSON（ファイル名`ship.json`、`source`あり）を選ぶと`false`・`createCanvasFromShapes`／`prepareInsert`・`insertDocument`を呼ばない・`readFailed`になるケースを加える。
*   `test/check/SpriteCheckInspector.test.js`（タスク4）：`inspectSpriteData`のテストを削除し、`parseText`・`inspectModuleExport`・`summarize`のテストは残す。
*   Phase 04-01の往復のテスト・`test/io/CodeExporter.test.js`（描画の一致）・`test/io/CodeExporter.assembly.test.js`・`test/io/SpriteSerializer.test.js`は変更しない（書き出したJSと`stringify`を引き続き確かめる）。
*   テストのためにソースへ`export`を足さない。補助関数にはJSDocを書く。

### 要件6: エンジンからの返信の削除
*   最終タスク（タスク7）で`_doc/BRIDGE_FROM_ENGINE.md`を削除し、削除したことと、要点（エンジンは既定のimportで受け取り`draw(ctx)`だけを呼ぶ／エンジンの2.1章が本アプリの2章を参照する／版・exportの形・`draw`の約束を変えるときは連絡票）を2章へ移したことを本RESの4章タスク7に記録する。

### 要件7: 回帰防止と目視確認
*   目視確認項目は5章に列挙する。

### 自己監査の結果（設計上の約束）
*   `palette/`（`CanvasPalette.js`）は文言の変更のみ。スプライトデータ・作業データの中身を知らない。
*   `io/`から`edit/`へのimport、`core/`から`io/`へのimportは発生しない。`FileContentReader`のimportは`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`のまま（JSの経路で`SpriteSerializer.checkFormat`・`CodeExporter.extractSpriteDataText`を使い続ける）。
*   `DocumentSerializer`にスプライト形式の知識を入れない（変更しない）。
*   DOMに触れない層（`CanvasFileOperations`・`FileContentReader`・`SpriteCheckInspector`）にDOM操作を入れない。
*   グローバル変数を足さない。テストのためにソースへ`export`を足さない。
*   `main.js`・`js/core/`・`js/shapes/`・`js/io/CodeExporter.js`・`js/io/SpriteSerializer.js`・`js/io/DocumentSerializer.js`は変更しない（JSDocにスプライトのJSONの出力・確認用ページのJSONへの言及がないことを確認済み）。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/edit/` - ファイル操作の組み立て（`CanvasFileOperations`）
    *   `./js/io/` - ファイルの読み書き（`DocumentFileIO`）、開く・インポートの読み込みの入口（`FileContentReader`）
    *   `./js/check/` - 確認用ページ（`SpriteCheckPage`・`SpriteCheckInspector`）
    *   `./js/palette/` - キャンバスパレットの文言（`CanvasPalette`。文言のみ）
    *   `./index.html` - ボタンの`title`の文言のみ（`accept`は変えない）
    *   `./sprite-check.html` - ファイル選択の`accept`のみ
    *   `./test/edit/`・`./test/io/`・`./test/check/` - 関係する自動テスト
    *   最終タスクのみ：`./PROJECT_ARCHITECTURE.md`、`./_doc/arch/01_index_html.md`・`15_io.md`・`16_test.md`・`17_sprite_check.md`（必要なら`14_edit.md`）、`./_doc/BRIDGE_FROM_ENGINE.md`（削除）
*   **関連する論理クラス**: `CanvasFileOperations`（更新）、`DocumentFileIO`（メソッド・定数の削除）、`FileContentReader`（判別の順序の変更）、`SpriteCheckPage`（JSONの経路の削除・文言）、`SpriteCheckInspector`（`inspectSpriteData`の削除）、`CanvasPalette`（文言）。変更しないが関係するもの：`DocumentSerializer`（JSONの値をそのまま判定する）、`SpriteSerializer`（`checkFormat`・`stringify`を残す）、`CodeExporter`（`toModuleText`・`extractSpriteDataText`を残す）。
*   **新規のクラス・ファイル**：なし。

### 参照する責務
（`PROJECT_ARCHITECTURE.md`と分冊`_doc/arch/`からの抜粋。以後のタスク実行チャットはこの項目のみを責務情報源とする。記述は**本作業の前**の状態であり、本作業で変わる箇所は上の要件の設計を正とする。）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`check/ → io`（確認用ページ専用。エディタ本体の依存の列とは独立）。
*   **`io/`**：作業データ形式の変換（`DocumentSerializer`）、IndexedDBへの読み書き（`CanvasStorage`）、作業データファイル・スプライトのファイルのブラウザ内での読み書き（`DocumentFileIO`）、スプライト（書き出し形式）の組み立て（`SpriteSerializer`）とスプライトJSのテキストの組み立てと実行しない取り出し（`CodeExporter`）、開く・インポートで選ばれたファイルの中身の判別と作業データの取り出し（`FileContentReader`）のみ。
*   **`check/`**：確認用ページ（`sprite-check.html`）専用。DOM・選んだJSの実行・描画を含む。`main.js`・`edit/`・`palette/`・`core/`の状態を持つモジュールをimportせず、`js/`の他のモジュール・`index.html`は`check/`をimportしない。
*   **`edit/`**：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。`CanvasFileOperations`はDOMに触れない。importは`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`・`FileContentReader`のみ。拡張子・MIMEタイプを知らず、キャンバス名を渡すだけ。スプライト形式を知らない（読み込みは`FileContentReader.deserializeFromText`を通す）。読み込みの判定の表・通知の解除条件の正本は`CanvasFileOperations`のクラスJSDoc。
*   **スプライト（書き出し形式）**：`format: "oz-vector-editor-sprite"`（作業データの`"oz-vector-editor"`とは別の値）。判別は`SpriteSerializer.checkFormat`（`'supported'`・`'notSprite'`・`'unsupportedVersion'`）が唯一の入口。識別子・現行版は`SpriteSerializer`の非公開定数で、他のモジュールは`checkFormat`だけを使う。書き出し形式の版は、エンジンが読む部分（`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったときに上げる。JSの形は`CodeExporter.toModuleText`（固定の説明コメント → `const spriteData = <JSON>;` → `const DEFAULT_STROKE_WIDTH = 2;` → `function draw(ctx)`・`function drawElement(ctx, element)` → `export default { ...spriteData, draw };`。既定のexportのみ）。`<JSON>`は`SpriteSerializer.stringify`（`JSON.stringify(data, null, 2)`）。
*   **エディタで開くときの規則（本作業の前）**：入口は`io/FileContentReader.deserializeFromText`（エディタの「開く」「インポート」の読み込みはすべてここを通る）。中身で判定する（拡張子に頼らない）。JSは実行しない（`CodeExporter.extractSpriteDataText`がテキストから取り出す。`CRLF`も可）。スプライトは`source`だけを使い`DocumentSerializer.deserialize`へ渡す。全体失敗の警告（`console.warn`）はどの経路でも1回（本クラス自身が判定した読み込み不可は本クラスが、`DocumentSerializer`の判定による失敗は`DocumentSerializer`が出す）。例外を投げない。引数・取り出した値を書き換えない。※本作業でJSONのスプライトの読み込みをやめる（要件2）。
*   **`DocumentSerializer`**：スプライト形式は知らない（スプライトの`source`は`FileContentReader`が取り出して`deserialize`へ渡す）。デシリアライズ系は例外をthrowせず結果オブジェクト（`ok`・`shapes`・`skipped`・`error`）を返す。`format`が`'oz-vector-editor'`でなければ全体失敗（`console.warn`1回）。
*   **`DocumentFileIO`**：ファイルの種類ごとの知識（拡張子・MIMEタイプ・使えない文字・スプライトの先頭の`_`の除去・既定の名前`無題`）はすべてここに閉じる。作業データ・スプライトの中身・図形種別・版を知らない。importを持たず、状態も持たない。呼び出し元は`CanvasFileOperations`のみ（注入）。`toCanvasName`は末尾の`.ozve.json`・`.json`・`.js`を1回だけ除く。
*   **ファイル名の規則**：共通の手順（使えない文字を`_`へ → 前後の空白を除く → 末尾のピリオドと空白を除く → 空なら`無題`）。作業データファイルは`<名前>.ozve.json`（先頭の`_`は除かない）。スプライトは共通の手順に加え、置換の後に先頭の`_`と空白をすべて除く。
*   **出力（エンジン用）（本作業の前）**：形式を選ぶ小窓は出さない。受理条件・通知の消去は出力（作業ファイル）と同じ。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。成功時は通知を出さない。失敗は通知`spriteExportFailed`。※本作業でJS 1つのダウンロードにする（要件1）。
*   **`palette/CanvasPalette`**：文言の対応表`ISSUE_MESSAGES`・`FILE_NOTICE_MESSAGES`はこのファイルが唯一の定義箇所。`CanvasFileOperations`は種類・ファイル名・件数のみを返し、文言を知らない。`FileNotice`のtypedefは`CanvasFileOperations.js`と二重定義（揃えること。本作業では種類を変えない）。
*   **確認用ページ（3章10.・`_doc/arch/17_sprite_check.md`）**：選び直しの競合は連番で捨てる。失敗時はページを止めず、前の表示（絵・外枠・情報欄）を消してファイル名と「読み込めませんでした：」＋理由を出す。理由の区分は`readFailed`・`notSprite`・`unsupportedVersion`・`importFailed`・`drawFailed`（文言の唯一の定義箇所は`SpriteCheckPage`の`FAILURE_MESSAGES`）。詳細は`console.warn`。エディタの`DocumentFileIO`は使わない。`SpriteCheckInspector`はDOM・`import`・描画を知らず、importは`io/SpriteSerializer`のみ。識別子・版の条件は`checkFormat`に任せ定数を重複して持たない。`SpriteCheckPage`・`SpriteCheckCanvas`は自動テストの対象外（テストプレイで確かめる）。
*   **`test/`（`_doc/arch/16_test.md`）**：`node:test`・`node:assert/strict`のみ（例外は`test/io/CodeExporter.assembly.test.js`）。先頭行に単一責務のJSDoc（3行以内）。補助関数にもJSDoc（`@param`・`@returns`）。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は各テストで`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存はテストファイル内の素のオブジェクトの偽物。共有の補助モジュールを置かない。
*   **憲法3章**：すべての`.js`の最先頭行に単一責務のJSDoc（3行以内）。責務を逸脱するロジックを足さない。クラス・関数・メソッド・データ構造にJSDoc。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（最終タスク（タスク7）で反映する。各タスクで影響が判明したらここへ追記する。）
*   **`PROJECT_ARCHITECTURE.md` 1章**
    *   「存在しないもの」に「スプライトのJSON（`<名前>.json`）の出力・読み込み・確認用ページでのJSONの表示（Phase 04-04でやめた。スプライトはJSだけ）」の趣旨を加える。
    *   「フォルダ分割の方針」の`io/`：「作業データファイル・スプライトのファイル」→「作業データファイル・スプライトのJS」の趣旨に。`FileContentReader`の説明はそのままでよいか確認。
    *   「フォルダ分割の方針」の`check/`：importを「`check/`内と`io/`の`SpriteSerializer`のみ」に直す（`CodeExporter`をimportしなくなる）。
*   **`PROJECT_ARCHITECTURE.md` 2章**
    *   「作業データファイル」：変更なし（読み込みは従来の`.json`も可）。
    *   「スプライト（書き出し形式）」の本文：「`<名前>.js`（ESモジュール）と`<名前>.json`のセット。どちらも同じスプライトデータを持ち、JSはさらに`draw(ctx)`を持つ」→「`<名前>.js`（ESモジュール）だけ。既定のexportにスプライトデータの全キーと`draw(ctx)`を持つ」。「組み立ては`io/SpriteSerializer`（データ・JSON文字列）と`io/CodeExporter`（JSのテキスト）」→ JSON文字列はJSに埋め込むためのものである旨に。
    *   同じ項に「**エンジン（OZ Engine）との約束**」を書き足す：(a) エンジン（OZ Engine、`D:\ozlab\ozengine-web`）の`PROJECT_ARCHITECTURE.md` 2.1章は、この項を書き出し形式の唯一の定義として参照している。(b) エンジンが読むのは既定のexportの`draw(ctx)`だけ（`format`・`formatVersion`・`bounds`・`elements`・`source`は現在エンジンでは読んでいない。エンジンは`import sprite from '…'`と既定のimportで受け取り、位置・回転を`ctx`に設定してから`draw(ctx)`を呼ぶ）。(c) 書き出し形式の版（`formatVersion`）を上げるとき、JSのexportの形や`draw`の約束を変えるときは、エンジンへ連絡票を出す。（`_doc/BRIDGE_FROM_ENGINE.md`を参照先にしない。）
    *   `source`の項：「JS・JSONの両方に入るため図形の情報を2重に持つ」→「JSの中に`elements`と`source`の両方を持つため図形の情報を2重に持つ（薄い書き出しとして許容）」。
    *   「識別子」：見分ける場面を「エディタの「開く」「インポート」（JSに埋め込まれたデータ）・確認用ページ（JSの既定のexport）」に。
    *   「エディタで開くときの規則」：`JSON.parse`できればJSONとして**作業データとしてのみ**扱い`DocumentSerializer.deserialize`へそのまま渡す（スプライトのJSONは`format`の不一致で読み込み不可。`DocumentSerializer`はスプライトの識別子を知らずに落とす）、できなければ本アプリのJSの形からスプライトデータのJSONを取り出す。`format`が`"oz-vector-editor-sprite"`なら`source`だけを使う（JSのみ）。読み込み不可の列挙に「スプライトのJSON（Phase 04-04でやめた。`.json`＝作業データファイル、`.js`＝スプライト）」を加え、「JSONの`format`が違う場合は従来どおり作業データとして`DocumentSerializer`が判定する」をJSON全体の規則へ改める。
    *   「JSONの出力形」→「JSに埋め込むデータの文字列の形」：`JSON.stringify(data, null, 2)`（`SpriteSerializer.stringify`。JSの中の`const spriteData = <JSON>;`の`<JSON>`。字下げ2・最小化しない・関数は含まない）。
    *   「図形0個」：「ダウンロードは図形があるときと同じく2つとも行い」→「JSを図形があるときと同じく1つダウンロードし」。
    *   「ファイル名の規則」のスプライト：「`<名前>.js`・`<名前>.json`」→「`<名前>.js`」。作業データファイルの開くときの`.json`除去は「作業データファイルの従来の拡張子」として残る旨（`ship.json`は作業データファイルとして`ship`）。
*   **`PROJECT_ARCHITECTURE.md` 3章9.**
    *   「用語」：出力（エンジン用）＝「スプライトのJSとJSONとして」→「スプライトのJS（`<名前>.js`）として」。
    *   「出力（エンジン用）」：`SpriteSerializer.serialize` → `CodeExporter.toModuleText`でJSのテキストを組み立て → `DocumentFileIO.downloadSpriteModule`の1回。組み立ての失敗ではダウンロードしない。失敗は通知`spriteExportFailed`。2つのダウンロード・複数ダウンロードの許可・2つ目の失敗の記述を削除。
    *   「開く（ファイル）」：`FileContentReader.deserializeFromText`（作業データファイル・スプライトのJS。スプライトのJSONは読み込み不可）。
    *   「ファイル名とキャンバス名の変換」：「スプライト`.js`/`.json`」→「スプライト`.js`」。
    *   「旧版のファイル」：変更なし（確認のみ）。
*   **`PROJECT_ARCHITECTURE.md` 3章10.**
    *   見出しの依存：`SpriteCheckPage.js → SpriteCheckInspector.js・SpriteCheckCanvas.js・io/SpriteSerializer.js`（`SpriteCheckInspector`経由。`io/CodeExporter.js`を外す）。
    *   「流れ」：`SpriteCheckInspector.parseText`でJSONかを中身で判定 → JSONなら`import`を試みず`notSprite`として表示 → JSならテキストのままBlob URLの動的`import` → 以降従来どおり。「JSONを選んでも描画処理は書き出したJSと同じ」の文を削除。
    *   「失敗時」：理由の区分の一覧は変わらない（`notSprite`がJSONを選んだ場合も含む旨を加える）。
*   **`_doc/arch/01_index_html.md`**：`accept`の文の「スプライトのJS・JSONも選べる」→「スプライトのJSも選べる（`.json`は作業データファイルのため外さない）」。「ボタンの`title`に作業ファイル（.ozve.json）とスプライト（.js・.json）を書く」→「スプライト（.js）」。
*   **`_doc/arch/15_io.md`**
    *   `DocumentFileIO`：公開メソッドから`downloadSpriteJson`・`toSpriteJsonFileName`を外す。拡張子・MIMEタイプの列挙から「スプライトのJSON`.json`・`application/json`」を外す。`toCanvasName`の`.json`は作業データファイルの従来の拡張子として除く旨。
    *   `SpriteSerializer`：「JSON文字列化」「`stringify`（字下げ2）」はJSへの埋め込み用として残る（呼び出し元は`CodeExporter`）旨を確認・補記。
    *   `CodeExporter`：`toModuleText`の呼び出し元から「`check/SpriteCheckPage`（JSONを選んだとき）」を外す（`CanvasFileOperations`のみ）。
    *   `FileContentReader`：「（作業データ・スプライトのJSON・スプライトのJS）」→「（作業データのJSON・スプライトのJS。JSONは作業データとしてのみ扱い、スプライトのJSONは読み込み不可）」。「知らないこと」・importは変わらない。
*   **`_doc/arch/16_test.md`**
    *   `FileContentReader.test.js`：「書き出したJSON・JS・`CRLF`のJSから元の図形に戻ること」→「書き出したJS・`CRLF`のJS」。読み込み不可に「スプライトのJSON（`source`あり）」を加える。
    *   `SpriteCheckInspector.test.js`：「JSONの値・JSの既定のexportの判定」→「JSの既定のexportの判定」。
    *   `CanvasFileOperations.export.test.js`：「組み立て失敗でどちらも落とさないこと、1つ目の失敗で2つ目を呼ばないこと、2つ目の失敗の通知」→「JSのダウンロードが1回だけであること、組み立て失敗でダウンロードしないこと、ダウンロード失敗の通知」。
    *   `CanvasFileOperations.test.js`：「（スプライトのJS・JSONを選んだ場合を含む）」→「（スプライトのJSを選んだ場合、スプライトのJSONを選ぶと読み込み不可になることを含む）」。
    *   「テストできない箇所」：`DocumentFileIO`の`downloadSpriteJson`を外す。
    *   `DocumentFileIO.test.js`の記述があれば`toSpriteJsonFileName`への言及を外す（現状は「ファイル名の変換は`test/io/DocumentFileIO.test.js`でテストする」のみ）。
*   **`_doc/arch/17_sprite_check.md`**
    *   冒頭：「書き出したスプライト（`<名前>.js`・`<名前>.json`）」→「書き出したスプライト（`<名前>.js`）」。
    *   「依存」：「`io/`の`SpriteSerializer`・`CodeExporter`のみimportする」→「`io/`の`SpriteSerializer`のみ（`SpriteCheckInspector`から）」。
    *   `sprite-check.html`：`accept`は`.js`だけ（JSONは選べないが、すべてのファイルを表示して選んだ場合は中身で見分けて`notSprite`）。「ブラウザでの開き方」の「JSとしても読み込めませんでした」→新しい`importFailed`の文言に合わせる。
    *   `SpriteCheckPage.js`「直接使うもの」：JSONを`CodeExporter.toModuleText`でJSにする記述を削除し、「JSONかJSかは中身で見分け、JSONは`import`を試みずに`notSprite`」に。
    *   `SpriteCheckInspector.js`：「本アプリのスプライトかの判定（JSONの値・JSの既定のexport）」→「JSの既定のexportの判定」。公開メソッドから`inspectSpriteData`を外す（`parseText`・`inspectModuleExport`・`summarize`）。「判定の条件」から「JSONは…」を外す。
    *   「io/から使うもの」：`SpriteSerializer.checkFormat`（判定）のみ。
*   **`_doc/arch/14_edit.md`（タスク1での追記）**：`CanvasFileOperations`の`exportSprite`の記述（JS・JSONの2つのダウンロード、`downloadSpriteJson`の使用）があれば、JS 1つのダウンロードに直す（資料本体は未確認・未変更。最終タスクで確認）。
*   **`_doc/BRIDGE_FROM_ENGINE.md`**：削除する（要件6）。

## 3. タスクリスト
*   [x] タスク1: 「出力（エンジン用）」をJS 1つのダウンロードにする（`CanvasFileOperations`）とそのテスト
    *   **対象ファイル** :
        *   `./js/edit/CanvasFileOperations.js` :（更新）
        *   `./test/edit/CanvasFileOperations.export.test.js` :（更新）
    *   **作業内容** :
        *   `exportSprite()`から`SpriteSerializer.stringify`の呼び出しと`this.#fileIO.downloadSpriteJson(...)`の呼び出しを削除し、`SpriteSerializer.serialize` → `CodeExporter.toModuleText` → `downloadSpriteModule`の1回にする（2章 要件1）。受理条件・通知の消去・失敗時の`console.warn`＋`spriteExportFailed`・成功時に通知を出さないことは変えない。
        *   JSDocを直す：`exportSprite`のメソッドJSDoc（「JS（`<名前>.js`）としてダウンロードする」「JSのテキストを組み立ててからダウンロードする」「`@returns {boolean}` JSをダウンロードしたか」）、クラスJSDoc「■ 出力（エンジン用）」（1ファイルの手順に。2つ目・間隔・取り消せない等の記述を削除）、`#fileIO`のJSDocの使用メソッド一覧と型から`downloadSpriteJson`を外す。先頭の責務JSDocは範囲を広げない（変更不要なら変えない）。
        *   テスト：偽の`fileIO`から`downloadSpriteJson`を削除。「JS→JSONの順に…」を「JSだけを1回、キャンバス名とともにダウンロードし、true を返す」（記録が`downloadSpriteModule`の1件で、`text`が`CodeExporter.toModuleText(SpriteSerializer.serialize(shapes))`と一致）に、「図形が0個でも2つとも…」を「図形が0個でもJSを1回ダウンロードし、通知を出さない」に、「JSのダウンロードが失敗したらJSONは呼ばず…」を「JSのダウンロードが失敗したら通知 spriteExportFailed を出し false を返す」に直す。「JSONのダウンロードが失敗したら…」のケースを削除。組み立て失敗・受理条件・通知の消去・副作用なし・`exportCanvas`のケースは残す。`SpriteSerializer.stringify`を使わなくなったら不要なimportがないか確認する。
        *   完了作業：プロジェクトのルートで`node --test`を実行し、全件成功と件数（tests/pass/fail）を4章に記録する。4章の詳細作業内容を記入し、本タスクを[x]にする。開発資料への影響は2章「更新予定」へ追記する（資料本体は変えない）。迷った点・目視確認の推奨は5章へ。
*   [ ] タスク2: `DocumentFileIO`からスプライトのJSON専用のメソッド・定数を削除する（呼び出し元はタスク1で外し済み）とそのテスト
    *   **対象ファイル** :
        *   `./js/io/DocumentFileIO.js` :（更新・削除）
        *   `./test/io/DocumentFileIO.test.js` :（更新）
    *   **作業内容** :
        *   着手前に`js/`・`test/`を`downloadSpriteJson`・`toSpriteJsonFileName`・`SPRITE_JSON_EXTENSION`で検索し、呼び出し元が`DocumentFileIO.js`自身と`test/io/DocumentFileIO.test.js`だけであることを確かめる（他にあれば中断して報告）。
        *   `downloadSpriteJson`・`toSpriteJsonFileName`・`SPRITE_JSON_EXTENSION`を削除する。`FILE_MIME_TYPE`・`FILE_EXTENSION_PATTERN`・`toSpriteModuleFileName`・`downloadSpriteModule`・`#toBaseName`は残す。
        *   JSDocを直す：先頭の責務JSDoc（「スプライトのファイル（JS・JSON）」→「スプライトのJS」の趣旨。3行以内・範囲を広げない）、クラスJSDoc（「スプライトのファイルとは、スプライトのJS（`<名前>.js`）である」等）、`toCanvasName`（「従来の`.json`の作業データファイルも、スプライトのJSも開ける」）、`#downloadBlob`（「3つのダウンロード」→「2つのダウンロード（作業データファイル・スプライトのJS）」）、`FILE_MIME_TYPE`等の定数JSDocにJSONのスプライトへの言及があれば外す。
        *   テスト：`describe`名を`DocumentFileIO.toSpriteModuleFileName`にし、`toSpriteJsonFileName`の確認行を削除する。同じ入力で`toSpriteModuleFileName`の確認が無いもの（`'__ a'`→`'a.js'`、`'_ _'`・`''`→`'無題.js'`、`'a/b'`→`'a_b.js'`、`42`→`'無題.js'`）は`toSpriteModuleFileName`の確認へ置き換える。`it`名の「.js・.json」等を直す。`toFileName`・`toCanvasName`・往復のテストは変えない。
        *   完了作業：`node --test`の全件成功と件数を4章に記録／4章の詳細作業内容を記入し本タスクを[x]／開発資料への影響は2章「更新予定」へ追記（資料本体は変えない）／迷った点は5章へ。
*   [ ] タスク3: エディタの「開く」「インポート」の読み込みからスプライトのJSONを外す（`FileContentReader`）とそのテスト
    *   **対象ファイル** :
        *   `./js/io/FileContentReader.js` :（更新）
        *   `./js/edit/CanvasFileOperations.js` :（更新。クラスJSDocの判定の表の1行のみ。処理は変えない）
        *   `./test/io/FileContentReader.test.js` :（更新）
        *   `./test/edit/CanvasFileOperations.test.js` :（更新）
    *   **作業内容** :
        *   `deserializeFromText`を2章 要件2の判別の順序にする：`JSON.parse`に成功したら`DocumentSerializer.deserialize(data)`を返す（`checkFormat`を通さない）。失敗したら従来どおり`CodeExporter.extractSpriteDataText` → `JSON.parse` → `SpriteSerializer.checkFormat`（`'notSprite'`・`'unsupportedVersion'`・`source`なしは本クラスの`#failure`で読み込み不可、`'supported'`は`DocumentSerializer.deserialize(data.source)`）。`fromModule`は削除。`#failure`の理由の文字列は実態に合わせる（JSの経路のみになる）。例外を投げない・警告1回・引数を書き換えないことを保つ。`DocumentSerializer.js`は変更しない。
        *   JSDocを直す：先頭の責務JSDoc（「作業データのJSON・スプライトのJS」の判別。3行以内）、クラスJSDoc「■ 判別の順序」・表（JSの列だけの表、またはJSONは常に`DocumentSerializer.deserialize`である旨）・「■ 規則」（スプライトのJSONは作業データとして判定され`DocumentSerializer`の形式違いで読み込み不可・警告は`DocumentSerializer`が1回。作業データのJSONの結果は`deserializeFromString`と同じ分類）、`deserializeFromText`の`@param`。
        *   `CanvasFileOperations.js`：クラスJSDoc「■ 読み込みの判定の表」の読み込み不可の行に「スプライトのJSON（作業データ形式の違いとして）」を加える。他は変えない。
        *   `FileContentReader.test.js`：「書き出したスプライトの読み込み」からスプライトのJSONの確認を削除（JS・`CRLF`のJSは残す）、「読めない図形を含むsource」をJSのみに。「読み込み不可」に「スプライトのJSON（`source`あり。5種の図形・図形0個・`CRLF`に改行を変えたJSON）は読み込み不可・例外なし・警告1回」を加える（`assertUnreadable`を使う）。`source`なし・版が範囲外・`source`の版が範囲外のJSONのケースは残してよい。`describe`/`it`名・先頭の責務JSDocの「スプライトのJSON」を実態に合わせる。不要になった補助関数・importを整理する（`asJson`を使い続けるなら残す）。
        *   `CanvasFileOperations.test.js`：`spriteFileCases`からJSONのケースを除く（JS・`CRLF`のJS）。「開く（スプライトのJS…）」に「スプライトのJSON（`ship.json`、`source`あり・5種の図形）: false・キャンバスを作らない（`createCalls`が0件）・`readFailed`（ファイル名`ship.json`）」、「インポート（スプライトのJS…）」に「スプライトのJSON: false・何も呼ばない（`calls`が空）・`readFailed`」を加える。`describe`名・`spriteFileCases`のJSDoc・先頭の責務JSDocの「JS・JSON」を直す。本アプリのものでないJSのケースは残す。
        *   完了作業：`node --test`の全件成功と件数を4章に記録／4章の詳細作業内容を記入し本タスクを[x]／開発資料への影響は2章「更新予定」へ追記（資料本体は変えない）／迷った点は5章へ。
*   [ ] タスク4: 確認用ページをJSだけにする（`SpriteCheckPage`・`SpriteCheckInspector`・`sprite-check.html`）とそのテスト
    *   **対象ファイル** :
        *   `./js/check/SpriteCheckPage.js` :（更新）
        *   `./js/check/SpriteCheckInspector.js` :（更新・`inspectSpriteData`の削除）
        *   `./sprite-check.html` :（更新。`#check-file-input`の`accept`のみ）
        *   `./test/check/SpriteCheckInspector.test.js` :（更新）
    *   **作業内容** :
        *   `SpriteCheckPage.js`：`#handleChange`で`parseText`の結果が`'json'`なら`import`を試みずに`throw new CheckFailure('notSprite')`。`'module'`ならテキストのまま`#importModule(text)`。`moduleText`の変数と`CodeExporter`のimport・`toModuleText`の呼び出しを削除する。`FAILURE_MESSAGES`の`notSprite`・`importFailed`を2章 要件3の文言にする（他の区分は変えない。区分は新設しない）。連番・`#resetDisplay`・`#showFailure`・`input.value = ''`の流れは変えない。先頭の責務JSDocは範囲を広げずに実態に合うか確認する。
        *   `SpriteCheckInspector.js`：`inspectSpriteData`を削除する。`parseText`・`inspectModuleExport`・`summarize`・`#summarizeBounds`・`ParsedText`は変えない。先頭の責務JSDoc（「JSの既定のexportの判定、JSONかの見分け、情報欄の要約」の趣旨）・`InspectResult`の説明・クラスJSDocを直す。`SpriteSerializer`のimportは`inspectModuleExport`のため残る。
        *   `sprite-check.html`：`accept=".js,text/javascript"`にする。注意書き`#check-warning`・他の要素は変えない。
        *   テスト：`SpriteCheckInspector.inspectSpriteData`の`describe`を削除。`parseText`・`inspectModuleExport`・`summarize`は残す。先頭の責務JSDocから「JSONの値の判定」を外す。不要になったimport・補助関数を整理する（`SpriteSerializer.stringify`等が他で使われていなければ）。
        *   完了作業：`node --test`の全件成功と件数を4章に記録／4章の詳細作業内容を記入し本タスクを[x]／開発資料への影響は2章「更新予定」へ追記（資料本体は変えない）／ブラウザでの目視確認が要る点（JSON・作業ファイルを選んだときの表示、続けてJSを選べること）を5章へ。
*   [ ] タスク5: パレットの通知とボタンの説明の文言を、スプライト＝JSだけに合わせる
    *   **対象ファイル** :
        *   `./js/palette/CanvasPalette.js` :（更新。文言とJSDocのみ）
        *   `./index.html` :（更新。`#canvas-export-sprite`・`#canvas-open-file`・`#canvas-import`の`title`のみ。`accept`は変えない）
    *   **作業内容** :
        *   `FILE_NOTICE_MESSAGES`：
            *   `readFailed`：`` `${notice.fileName ?? ''} を読み込めませんでした。本アプリで出力した作業ファイル（.ozve.json）、またはエンジン用のファイル（.js）か確認してください。` ``
            *   `spriteExportFailed`：`'エンジン用のファイル（.js）の出力に失敗しました。'`
            *   他の文言・種類・`FileNotice`のtypedefは変えない。
        *   `CanvasPalette.js`の`onExportSprite`のJSDoc（「スプライト（JSとJSON）として出力する」）を「スプライトのJS（.js）として出力する」の趣旨に直す。他の処理は変えない。
        *   `index.html`の`title`：
            *   `#canvas-export-sprite`：`ゲームで使うスプライトを、JS（.js）のファイルとしてダウンロードします`
            *   `#canvas-open-file`：`作業ファイル（.ozve.json）、またはエンジン用に出力したスプライト（.js）を新しいキャンバスとして開きます`
            *   `#canvas-import`：`作業ファイル（.ozve.json）、またはエンジン用に出力したスプライト（.js）の図形を、開いているキャンバスへ追加します`
        *   完了作業：`node --test`の全件成功と件数を4章に記録／4章の詳細作業内容を記入し本タスクを[x]／開発資料への影響は2章「更新予定」へ追記（資料本体は変えない）／文言の目視確認を5章へ。
*   [ ] タスク6: JSDoc・コメントの記載漏れと、削除したメソッド・定数・ダウンロードへの言及の残存を確認する
    *   **対象ファイル** :
        *   タスク1〜5の対象ファイルのみ（修正が要る場合に限り更新）。それ以外のファイルに残存を見つけた場合は変更せず5章へ記録する。
    *   **作業内容** :
        *   `js/`・`test/`・`index.html`・`sprite-check.html`を次で検索し、残存がないことを確かめる：`downloadSpriteJson`・`toSpriteJsonFileName`・`SPRITE_JSON_EXTENSION`・`inspectSpriteData`・`スプライトのJSON`・`JSとJSON`・`JS・JSON`・`.js・.json`・`<名前>.json`・`2つのダウンロード`・`3つのダウンロード`・`2つとも`・`toModuleText`（`check/`内）。作業データファイルの従来の`.json`に関する記述は正しいため残す。
        *   タスク1〜5で触れたクラス・メソッド・定数・テストの補助関数にJSDocがあること、各`.js`の先頭行の単一責務のJSDocが3行以内で実態に合うことを確かめる。
        *   検索結果（該当なし／直した箇所）を4章に記録する。
        *   完了作業：`node --test`の全件成功と件数を4章に記録／4章の詳細作業内容を記入し本タスクを[x]／開発資料への影響は2章「更新予定」へ追記／気づいた点は5章へ。
*   [ ] タスク7（固定）: 開発資料への反映と、エンジンからの返信の削除
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/01_index_html.md` :（更新）
        *   `./_doc/arch/15_io.md` :（更新）
        *   `./_doc/arch/16_test.md` :（更新）
        *   `./_doc/arch/17_sprite_check.md` :（更新）
        *   `./_doc/BRIDGE_FROM_ENGINE.md` :（削除）
        *   （2章「更新予定」に他の分冊の追記があればそのファイル）
    *   **作業内容** :
        *   2章「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」の全項目（各タスクでの追記を含む）を、`PROJECT_ARCHITECTURE.md`と分冊`_doc/arch/`へ反映する。資料の記載基準（`PROJECT_ARCHITECTURE.md`冒頭）に従い、1つのファイルのJSDocを読めば分かることは書かない。
        *   2章「スプライト（書き出し形式）」の項をスプライト＝JSだけの記述に直し、エンジンとの約束(a)〜(c)を事実の要約として書き足す（`_doc/BRIDGE_FROM_ENGINE.md`を参照先にしない。エンジン側の文書は書き換えない）。`JSON.stringify(data, null, 2)`の記述はJSの中の`const spriteData = <JSON>;`の形として残す。
        *   1章「存在しないもの」に「スプライトのJSONの出力・読み込み・確認用ページでのJSONの表示（Phase 04-04でやめた）」の趣旨を加える。
        *   反映後、`PROJECT_ARCHITECTURE.md`・`_doc/arch/`を`<名前>.json`・`JSとJSON`・`JS・JSON`・`downloadSpriteJson`・`toSpriteJsonFileName`・`inspectSpriteData`・`.js・.json`で検索し、作業データファイルの従来の`.json`以外の残存がないことを確かめる。
        *   `_doc/BRIDGE_FROM_ENGINE.md`を削除し、削除したことと、要点（エンジンは`import … from`の既定のimportで受け取り位置・回転を`ctx`に設定してから`draw(ctx)`だけを呼ぶ／`format`・`formatVersion`・`bounds`・`elements`・`source`は読んでいない／エンジンの2.1章がエディタの2章「スプライト（書き出し形式）」を唯一の定義として参照する／版・exportの形・`draw`の約束を変えるときは連絡票）を2章へ移したことを4章タスク7に記録する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本タスクのみ明示的な例外とする（REQの固定タスク）。
        *   完了作業：`node --test`の全件成功と件数を4章に記録／4章の詳細作業内容を記入し本タスクを[x]。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 「出力（エンジン用）」をJS 1つのダウンロードにする（`CanvasFileOperations`）とそのテスト
*   **作業内容** :
    *   `js/edit/CanvasFileOperations.js`：`exportSprite()`から`SpriteSerializer.stringify`と`downloadSpriteJson`の呼び出しを削除し、`serialize` → `toModuleText` → `downloadSpriteModule`の1回にした。メソッドJSDoc・クラスJSDoc「■ 出力（エンジン用）」（2つ目・間隔・取り消せない等の記述を削除）・`#fileIO`のJSDoc（`downloadSpriteJson`を外す）を直した。先頭の責務JSDocは変更なし。`SpriteSerializer`のimportは`serialize`のため残した。
    *   `test/edit/CanvasFileOperations.export.test.js`：偽の`fileIO`から`downloadSpriteJson`を削除。「JSだけを1回…」（記録1件・`toModuleText(serialize(shapes))`と一致）、`openCanvasName`が`null`のケースを`['']`、`'unavailable'`のケースを`calls.length, 1`、図形0個のケースを「JSを1回」＋`CodeExporter.extractSpriteDataText`経由の`bounds === null`確認に変更。「JSのダウンロードが失敗したら通知…false」に直し、「JSONのダウンロードが失敗したら…」を削除。組み立て失敗のケース名を「ダウンロードせず」に直した。先頭JSDocの「順序」を「回数」に変更。`SpriteSerializer`・`CodeExporter`のimportは引き続き使用。
    *   `node --test`：tests 274・pass 274・fail 0（計画時275から、JSONの失敗ケース1件削除で-1）。

### タスク2: `DocumentFileIO`からスプライトのJSON専用のメソッド・定数を削除する とそのテスト
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク3: エディタの「開く」「インポート」の読み込みからスプライトのJSONを外す（`FileContentReader`）とそのテスト
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク4: 確認用ページをJSだけにする（`SpriteCheckPage`・`SpriteCheckInspector`・`sprite-check.html`）とそのテスト
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク5: パレットの通知とボタンの説明の文言を、スプライト＝JSだけに合わせる
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク6: JSDoc・コメントの記載漏れと、削除したメソッド・定数・ダウンロードへの言及の残存を確認する
*   **作業内容** :
    *   (タスク実行時に記入)

### タスク7（固定）: 開発資料への反映と、エンジンからの返信の削除
*   **作業内容** :
    *   (タスク実行時に記入)

## 5. 懸念事項・要確認ポイント
*   **計画時点の`node --test`**：tests 275・pass 275・fail 0（Node.js、計画作成時に実行）。各タスクでテストの追加・削除により件数は変わる。
*   **スプライトのJSONの読み込み不可の警告の出し手**：本計画ではJSONの値を作業データとしてのみ扱うため、スプライトのJSONの`console.warn`は`DocumentSerializer`の「作業データ形式が一致しません: oz-vector-editor-sprite」になる（`FileContentReader`の警告ではない）。警告は1回で、利用者向けの通知は`readFailed`のまま。より分かりやすい警告文が必要になった場合でも、`DocumentSerializer`にスプライトの識別子を持ち込まないこと（その場合は`FileContentReader`で`checkFormat`を見て明示的に読み込み不可にする案に切り替える）。
*   **確認用ページの`notSprite`の兼用**：JSONを選んだ場合と、JSだが既定のexportがスプライトでない場合が同じ文言になる。詳細は`console.warn`で区別できる（`CheckFailure`の`reason`は同じ）。区分を分けたくなった場合は`FAILURE_MESSAGES`に区分を足し、`_doc/arch/17_sprite_check.md`・3章10.を直す。
*   **`SpriteCheckInspector.parseText`の`value`**：JSONの値は使われなくなるが、戻り値の形を変えない判断をした（変更を最小にするため）。将来`parseText`を`isJson`のような真偽値に変える場合はテストも直す。
*   **ファイル選択の`accept`**：確認用ページは`.js`だけにするが、ファイル選択の小窓で「すべてのファイル」を選べばJSONも選べる。その場合は中身で見分けて`notSprite`を表示する（タスク4の目視確認）。
*   **開発資料と実コードの相違（計画時に気づいたもの）**：`_doc/arch/14_edit.md`の`CanvasFileOperations`の「依存：importは`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`のみ」に`FileContentReader`が無い（同ファイルの冒頭の「依存」と実コードには`FileContentReader`がある）。本REQの範囲外のため計画には入れていない。最終タスクで直すかは発注者の判断（直す場合は`14_edit.md`を対象ファイルに加える）。
*   **目視確認項目（テストプレイ）**：
    *   「出力（エンジン用）」を押すと`<名前>.js`だけがダウンロードされ、`<名前>.json`は落ちない。複数ダウンロードの許可を尋ねる表示も出ない。
    *   図形0個のキャンバスで「出力（エンジン用）」を押すと、通知なしで`<名前>.js`が1つ落ちる。
    *   落ちたJSを確認用ページで選ぶと、従来どおり線画・原点の印・外枠・情報欄（書き出し形式の版・作業データの版・描画要素の数・外枠）が出る。ウィンドウの大きさを変えても描き直される。
    *   確認用ページのファイル選択の既定の絞り込みが`.js`になっている。「すべてのファイル」にして過去に出力したスプライトのJSON（`ship.json`）や作業データファイル（`.ozve.json`）を選ぶと、前の表示が消え「本アプリが出力したスプライトのJSではありません（…）」が出て、ページが止まらず、続けてJSを選ぶと表示される。
    *   確認用ページで壊れたJSを選ぶと「JSとして読み込めませんでした…」が出る（「JSONとして読めず」の文言が出ない）。
    *   エディタの「開く」で`ship.js`を選ぶと従来どおり新しいキャンバス`ship`として開ける。「インポート」で`ship.js`を選ぶと図形が追加される（Undoで1回で戻る）。
    *   エディタの「開く」「インポート」で過去のスプライトのJSON`ship.json`を選ぶと、読み込み失敗の通知（`readFailed`）が出て、キャンバス一覧・開いているキャンバス・図形は変わらない。
    *   作業データファイル（`.ozve.json`・従来の`.json`）は従来どおり「開く」「インポート」できる。
    *   「出力（エンジン用）」「開く」「インポート」のボタンにマウスを乗せたときの説明と、読み込み失敗・エンジン用の出力失敗の通知の文言に、スプライトの`.json`の記述が残っていない。
    *   既存の作成・保存（自動保存・再読み込み後の復元）・出力（作業ファイル）・Undo/Redo・コピー＆ペースト・複製が変わらない。
    *   `node --test`が全件成功する。
