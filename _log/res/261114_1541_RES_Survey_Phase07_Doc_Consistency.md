# RES: 調査計画・調査レポート Survey : Phase 7 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261114_1541_REQ_Survey_Phase07_Doc_Consistency.md`

## 1. 調査目的
Phase 7「UIの整え」の各サブフェイズ（07-01〜07-05）の最終タスクで開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）へ足された記述が、Phase 7 終了時点（現在の `HEAD`）の実コードの事実と食い違っていないかを確かめる。各サブフェイズの反映時点ではそのサブフェイズの差分監査に合格しているため、特に **後のサブフェイズのコード変更によって、前のサブフェイズで書いた記述が古くなっていないか** を重点的に見る（例：07-01 で書いたツールパレット・`ToolRules`・ツールバー・ステータスバーの記述が、07-04 のスポイトのボタン・07-03 と 07-05 のステータスバーの項目の追加後も成り立つか。07-02 で書いたオプションバー・`ShapeStyleEditor`・`Space`を部品に譲る判定の記述が、07-04 の`D`・スポイトの追加後も成り立つか。07-03 で書いた`main.js`の配線・行数・`InputTracker`のコンストラクタの引数・座標の表示の記述が、07-04・07-05 の追加後も成り立つか。07-04 で書いた移動量の加工・修飾キーを見る時点・図形クラスの共通メソッド契約の記述が、07-05 の丸め・`getHandlePosition`の追加後も成り立つか）。

本工程（調査）を通じて、ソースコードおよび資料ファイルの修正・作成は一切行わない（変更してよいのは本RESファイルのみ）。

## 2. 調査要件
### 要件1: 差分で追加・変更された記述の照合
* 【照合の対象】の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。照合するのは次のような、コードで真偽を確かめられる主張である：
  * ファイル・フォルダの存在と配置（1章のフォルダ構成図。`test/` 配下を含む。「存在しないもの」「なくなったもの」として書かれたものが実際に無いことを含む）
  * import の有無・向き（1章「依存方向」とその例外、`_doc/arch/` 各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの）
  * 公開メソッド・公開の関数・定数・typedef の一覧と、識別子の値（`_doc/arch/` 各ファイル。`TOOL_IDS`の並び、`EYEDROPPER_TOOL_ID`、図形クラスの共通メソッド契約のメソッド数17と`drawOutline`・`getHandlePosition` 等）
  * 状態の持ち主・初期値・通知（`DisplayState`・`UnitSnapSettings`・`CanvasCursorTracker`・`StyleEyedropper` 等の初期値、`onChange`の通知の条件と回数、作業データ・履歴・保存先に入れていないこと）
  * 既定値・定数（スナップの単位 1px・10px、全体を画面に収めるときの余白と倍率の範囲、定規の太さ`--ruler-size`、座標の表示の桁、グリッドの間隔の規則 等）
  * 引数・戻り値・通知の回数など、関数の振る舞いの記述（`resolveActiveTool`、`classifyPointHit`の`includeFill`、`computeGridSpacing`、`computeRulerTicks`、`SelectionRules`・`MoveDirectionRules`・`UnitSnapRules`・`ViewFitRules`・`StatusReadoutRules`の各関数、`nextEnabledOnToggle`、`toggleStrokeEnabled`・`toggleFillEnabled`、`ShapeExtentReader`、貼り付けのずらし量 等）
  * 呼び出し元・呼び出し順・記録の時点（3章の各項の「流れ」「履歴の単位」「記録する操作と時点」「記録しない操作」、修飾キー（`Ctrl`・`Shift`・`Alt`）を見る時点、「`Shift`の方向の限定 → 丸め」の順、端点への吸い付きとスナップの優先、`Ctrl`の間に照会を呼ばないこと、作業用フィールドを消す箇所 等）
  * `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先）
  * `InputTracker` のコンストラクタの引数（第7引数`InputAssist`の項目と既定）、当たり分類の使い方、`Space`・`Tab`を部品に譲る判定、モジュールのexport（`_doc/arch/06_InputTracker.md`・`18_PointHitRules.md`・`29_AltKeyGuard.md`）
  * `KeyboardShortcuts` のキーの対応表（`_doc/arch/07_KeyboardShortcuts.md`。`Z`・`X`・`C`・`Tab`・`D`・`I`・`Ctrl`+`I`・`Ctrl`+`Shift`+`V` 等と、キーリピート・入力欄にフォーカスがある間の扱い）
  * 数値（行数：`main.js`・`InputTracker.js` 等、資料に書かれた行数すべて。ただし「Phase 07-03で701行から877行」のように過去の時点の値として書かれたものは、現在の値として書かれたものと区別し、過去の時点の値は `git show <コミット>:<パス>` で確かめられる範囲で確かめる）。行数は `wc -l` 等で実測し、資料の値と並べて記載する。
  * `index.html` の要素・属性・クラス・CSS変数（`_doc/arch/01_index_html.md` の記述。ツールバー・オプションバー・定規・ステータスバー・ツールパレットの要素のid、`tool-${toolId}`、`.toolbar-group`・`.status-bar-group`・`.status-bar-left`の`display: contents`、`aria-pressed`の有無、`:root`の`--ruler-size`・`--canvas-area-top`・`--canvas-area-left`、ボタンの`title` 等）
  * 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在、テストの内容の記述が実際のテストケースと合っているか、テストの件数、偽物と実物の使い分け、「テストできない箇所」の一覧）。テストの件数は、プロジェクトのルートで `node --test` を実行して確かめてよい（ファイルを書き換えない実行に限る）。
* 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲（例：「アウトライン表示の間は塗った内側が当たりにならない」「`C`で消すのはグリッドの細線・太線だけ」「単位のボタンはスナップがOFFの間も押せる」「曲線の作成時の制御点は丸めない」）だけを照合し、方針そのものの是非は扱わない。
* 実際のブラウザでの見え方・実測値についての記述（1280px幅での右端の位置、フォントによる字形、キャッシュの挙動 等）は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。本リポジトリの外（`D:\ozlab\ozengine-web` 等）についての記述も同じ扱いとする。

### 要件2: Phase 7 でなくなったものの名前が、資料に現存するものとして残っていないか
* Phase 7 では、ファイル・クラス・`index.html`の要素が多数なくなった（例：`js/palette/PaletteController.js`・`js/palette/PropertyShapeSection.js`・`js/palette/PropertyOrderSection.js`（`OptionBarOrderGroup.js`へ改名）、コントロールパネル・図形選択パレット・プロパティパネルの各ウィンドウとその要素のid、`StylePanelView`の`source`・`selectedCount`、`InputTracker`の公開フィールド`lastCursor`、フロートウィンドウの`.disabled`クラス）。
* なくなったものの名前を、`git diff --name-status 9edd0fc 6c9005d -- js index.html test` の削除・改名と、照合の対象の差分の `-` 行から洗い出し、**現在の実コードに存在しないこと**を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイル`09_DragTracker.md`・`17_sprite_check.md`を含む）を検索する。
* 見つかった箇所のうち、「なくなった」「Phase 07-0Xで削除した」のように経緯として書かれているものは相違としない。現存するもの・今も呼べるものとして読める箇所だけを相違として挙げる。
* 本要件は、差分のない行については名前の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。

### 要件3: 照合の結果の整理
* 相違が見つかった記述は、5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で、タスク番号を添えて記載する。
* 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものがあれば、4章の各タスクの「推測・所見」に「読み方が分かれる記述」として記載する（5章には入れない）。
* 照合した主張と結果を、資料のファイル（節）ごとに4章の各タスクの欄へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、「照合できなかった主張」としてその理由を書く）。

### 参照する責務
本Surveyは資料の記述そのものが照合の対象であるため、ここには資料の記述を書き写さない。以後の各タスク実行チャットは次の事項に従うこと（本RESの1章・2章の要件1〜3も判定の基準として必ず従う。REQは読まなくてよい）。

* **照合の対象を取得する方法**：
  * 照合の対象は、次のコマンドで得られる差分の `+` 行だけである（Phase 7 の最初のサブフェイズの開始のコミット `9edd0fc` から、最後のサブフェイズの完了を記録したコミット `6c9005d` まで。`6c9005d` より後のコミットは開発資料を変更していないため、現在の作業ツリーの資料ファイルの該当行が `+` 行そのものである）。
    * `git diff 9edd0fc 6c9005d -- PROJECT_ARCHITECTURE.md _doc/arch`
  * タスクごとの絞り方：自分のタスクの対象ファイルだけを `git diff -U0 9edd0fc 6c9005d -- <資料のファイル>` で取得し、ハンクの見出し（`@@ -a,b +c,d @@`）の `+c,d` で現在のファイルでの行番号を確かめる。3章「対象ファイル」に書いた行番号の `+` 行だけが自分の担当であり、それ以外の `+` 行は他タスクの担当なので照合しない（同じファイルの差分のない行も照合しない。読むのは文脈の把握に必要な範囲に留める）。
  * 照合は、資料の現在のファイルの該当行の原文を `Read`（offset/limit）で開いて行う。1行が2000字を超える行があるため、長い行は1つの主張ずつ区切って照合する。
  * 照合に使う実コードは、現在の作業ツリー（`HEAD`）の `./index.html`・`./js/` 配下・`./test/` 配下。3章に書いた「主なコード」以外も、主張の照合に必要なら読んでよい。Phase 7 で変更されたコードの一覧は `git diff --stat 9edd0fc 6c9005d -- js index.html test` で得られる。
* **照合する主張の種類と、照合しないもの**：2章「要件1」の箇条（主張の種類、意図・方針の記述の扱い、ブラウザでの見え方・リポジトリ外の記述の扱い）に従う。要件2のタスク（タスク14）は2章「要件2」に従う。対象外は、差分の `+` 行以外の資料の記述（要件2の名前の検索で見つかった箇所を除く）、`_doc/` の他のファイル、`_log/dir/` 配下、本リポジトリの外のファイル。
* **経緯の確認**：資料の記述の経緯を確かめる必要が生じた場合に限り、Phase 7 の各サブフェイズの作業計画書（`./_log/res/261113_1742_RES_Phase07-01_UI_Skeleton.md`・`./_log/res/261113_2013_RES_Phase07-02_Option_Bar.md`・`./_log/res/261113_2131_RES_Phase07-03_Display.md`・`./_log/res/261114_0026_RES_Phase07-04_Selection_Move.md`・`./_log/res/261114_1334_RES_Phase07-05_Snap.md`）の該当箇所だけを `Grep` で探して参照してよい（全文は読まない）。RESの記述だけで一致と判定してはならない。
* **結果の書き方**：
  * 実コードから読み取れる事実のみを4章の該当タスクの『事実』欄に、推測を含める場合はどこまでが事実でどこからが推測かを明示して『推測・所見』欄に記載する。
  * 相違の判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・Phase 7 のRESの記述だけで一致と判定しない）。一致と書く主張には、確かめたコードの場所（`ファイル:行`、または検索した語と件数）を添える。
  * 照合した主張と結果は、資料のファイル（節）ごとにまとめる。一致したものは「一致」と短く書けばよい。照合できなかった主張は「照合できなかった主張」として理由を書く。
  * 相違があった場合は5章に、タスク番号を添えて「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で記載する（作業は中断しない）。資料に書かれていない事項がコードに存在することは相違とみなさない。
  * 相違ではないが、実コードと照らして複数の読み方ができる記述は、4章の該当タスクの『推測・所見』に「読み方が分かれる記述」として書く（5章には入れない）。
  * 5章・6章への追記は、既存の記載を消さず末尾に足す。
* **資料の閲覧の許可**：各タスク実行チャットは、自分のタスクの対象として3章が指定した資料のファイル・節（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）を読んでよい。タスク14は `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイルを検索・閲覧してよい。`_doc/` の他のファイルは読まない。
* **変更の禁止**：タスクの終わりに、ソースコードおよび資料ファイルを一切変更していないことを `git status` で確認する（変更があってよいのは本RESファイルだけ）。`node --test` はファイルを書き換えない実行に限り行ってよい。

## 3. タスクリスト
* [ ] タスク1: `PROJECT_ARCHITECTURE.md` 1章（フォルダ構成・存在しないもの・フォルダの役割・依存方向）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。1章「### 1. プロジェクトフォルダ構造」L15-170 のうち `+` 行 L20, L30-42, L59, L62-65, L74, L77, L94-96, L98-99, L101-104, L108-110, L132, L137, L139-140, L158, L161-162, L165, L167）
    * 主なコード：`./index.html`（L20 の記述分）、`./js/` 配下・`./test/` 配下のファイル一覧（`git ls-files js test`）、各ファイルの `import` 文（`Grep` で `^import`）
  * **調査内容**:
    * フォルダ構成図の `+` 行のファイルが実在し、構成図の位置（フォルダ）に置かれていること、各ファイルの注記（「状態なし」「〜から使う」等）を import と呼び出し元の検索で照合する。
    * L158「存在しないもの」の `+` 部分について、書かれたものが実際に無いこと（ファイル・クラス名の検索）を確かめる。
    * L161-162・L165 のフォルダの役割の記述と、L167「依存方向」とその例外を、`js/` 全体の import を検索して照合する（例外として書かれた import 以外に逆向きの import が無いか）。
    * 結果を4章タスク1へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク2: `PROJECT_ARCHITECTURE.md` 2章と、図形・データ側の `_doc/arch/`（`03_VectorModel.md`・`10_ShapeFactory.md`・`12_shapes.md`）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。2章「### 2. データ構造（Model）の概要」L171-275 のうち `+` 行 L174, L176, L190, L257, L270）
    * `./_doc/arch/03_VectorModel.md` :（照合。`+` 行 L6）
    * `./_doc/arch/10_ShapeFactory.md` :（照合。`+` 行 L3-5, L7）
    * `./_doc/arch/12_shapes.md` :（照合。`+` 行 L20-22, L26-27, L29-30, L34。17メソッド契約・`isFillable`・`drawOutline`・`getHandlePosition`・ハンドル名の契約）
    * 主なコード：`./js/core/VectorModel.js`・`./js/core/ShapeFactory.js`・`./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`・`Path.js`、保存・履歴に入れないものの照合に `./js/io/DocumentSerializer.js`・`./js/edit/SnapshotAdapter.js`・`./js/edit/CanvasLibrary.js`
  * **調査内容**:
    * スタイル3つの読み書き・`isFillable()`・保存対象／保存しないもの（表示の状態・スナップの設定を含めない）・直前に使った値の更新元の記述を照合する。
    * 図形クラスの共通メソッド契約のメソッド数（17）と各メソッド（`drawOutline`・`getHandlePosition` 等）が5クラスすべてに実在すること、シグネチャ・ハンドル名の契約を照合する（07-04 で書いた契約が 07-05 の `getHandlePosition` 追加後も成り立つかを重点）。
    * `ShapeFactory`・`VectorModel` の `+` 行の公開API・定数を照合する。
    * 結果を4章タスク2へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク3: `PROJECT_ARCHITECTURE.md` 4章と、描画・ビュー・履歴・ウィンドウ・入出力の `_doc/arch/`（`04`・`05`・`08`・`11`・`15`）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。4章「### 4. 各モジュールの責務リファレンス」L499-534 のうち `+` 行 L522-534）
    * `./_doc/arch/04_CanvasManager.md` :（照合。`+` 行 L2-6, L8）
    * `./_doc/arch/05_ViewTransform.md` :（照合。`+` 行 L2-3）
    * `./_doc/arch/08_HistoryManager.md` :（照合。`+` 行 L5）
    * `./_doc/arch/11_WindowManager.md` :（照合。`+` 行 L4）
    * `./_doc/arch/15_io.md` :（照合。`+` 行 L22）
    * 主なコード：`./js/core/CanvasManager.js`・`./js/core/ViewTransform.js`・`./js/core/HistoryManager.js`・`./js/core/WindowManager.js`・`./js/io/SpriteSerializer.js`、4章の表が指すモジュールと `_doc/arch/19`〜`31` のファイルの実在
  * **調査内容**:
    * 4章の表の `+` 行のモジュールが `js/core/` に実在し、対応する `_doc/arch/` のファイルが実在することを確かめる（各ファイルの中身の照合は他タスクの担当）。
    * `CanvasManager` の描画の経路・アウトライン・背景・グリッドの描画、`ViewTransform` の追加API、`HistoryManager`・`WindowManager`・`io/` の `+` 行の記述を照合する。
    * 結果を4章タスク3へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク4: `PROJECT_ARCHITECTURE.md` 3章冒頭・3章1.〜2.と `_doc/arch/02_main.md`（`main.js` の配線）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章「### 3. 描画・操作フロー（実行サイクル）」の冒頭「同期の経路」L277、1.「起動処理」〜2.「描画サイクル」L279-284 のうち `+` 行 L277, L283-284）
    * `./_doc/arch/02_main.md` :（照合。`+` 行 L3-4, L9-11, L13, L15-22, L32-38, L43, L45-48, L52, L55-61, L63。行数・主な関数・配線ブロックの表・注入の表・生成順の制約・同期関数と購読先）
    * 主なコード：`./js/main.js`、`./js/core/CanvasManager.js`（描画の経路）、`./index.html`（`#canvas-loading-cover`）
  * **調査内容**:
    * `main.js` の行数を `wc -l` で実測し資料の値と並べる。「Phase 07-03で701行から877行」等の過去の時点の値は、対応するコミットを `git log --oneline -- js/main.js` で特定し `git show <コミット>:js/main.js | wc -l` で確かめられる範囲で確かめる。
    * 配線ブロックのコメント番号と各ブロックの内容、注入の表の各クラスへの注入物、生成順の制約、主な関数、同期関数と購読先（`onChange` の経路）を `main.js` の該当行と照合する（07-03 で書いた配線が 07-04・07-05 の追加後も成り立つかを重点）。
    * 3章冒頭の同期の経路と、1.〜2.の `+` 行（読み込み完了前の操作・描画の4経路）を照合する。
    * 結果を4章タスク4へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク5: `PROJECT_ARCHITECTURE.md` 3章3.（入力監視）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章3.「入力監視」L285-295 のうち `+` 行 L287, L289-295）
    * 主なコード：`./js/core/InputTracker.js`、呼び出し先の照合に `./js/core/SelectionRules.js`・`./js/core/MoveDirectionRules.js`・`./js/core/UnitSnapRules.js`・`./js/core/KeyboardShortcuts.js`・`./js/main.js`
  * **調査内容**:
    * 3.の範囲選択・クリックの解釈・本体ドラッグの移動量（`#resolveMoveDelta`、「`Shift`の方向の限定 → 丸め」の順）・頂点のハンドルのドラッグと打つ点・`Alt`+ドラッグ・スポイトの待ち受け中の入力・キーボード操作の分担の記述を、`InputTracker.js` の該当行と照合する（修飾キーを見る時点・作業用フィールドを消す箇所を重点。07-04 の記述が 07-05 の丸めの追加後も成り立つか）。
    * 3.の `+` 行に `InputTracker.js` の行数・コンストラクタの引数・当たり分類の使い方・`Space`・`Tab` の判定についての主張があれば、それも本タスクで照合する（`06_InputTracker.md` の `+` 行の照合はタスク6の担当なので行わない）。
    * 結果を4章タスク5へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク6: `_doc/arch/06_InputTracker.md`・`18_PointHitRules.md`・`29_AltKeyGuard.md` の照合
  * **対象ファイル**:
    * `./_doc/arch/06_InputTracker.md` :（照合。`+` 行 L3-6, L11-17, L23-26）
    * `./_doc/arch/18_PointHitRules.md` :（照合。`+` 行 L2, L4-6）
    * `./_doc/arch/29_AltKeyGuard.md` :（照合。`+` 行 L1-7）
    * 主なコード：`./js/core/InputTracker.js`・`./js/core/PointHitRules.js`・`./js/core/AltKeyGuard.js`、呼び出し先の照合に `./js/core/SelectionRules.js`・`./js/core/MoveDirectionRules.js`・`./js/core/UnitSnapRules.js`・`./js/core/KeyboardShortcuts.js`・`./js/main.js`（`InputTracker` の生成箇所）
  * **調査内容**:
    * `InputTracker.js` の行数を実測し資料の値と並べる（過去の時点の値はタスク4と同じ方法で確かめられる範囲で）。
    * コンストラクタの引数（第7引数 `InputAssist` の項目と既定）、export、当たり分類の使い方（`includeFill` 等）、`Space`・`Tab` を部品に譲る判定を照合する。
    * `06_InputTracker.md` の `+` 行のうち、範囲選択・クリックの解釈・移動量・ハンドル・`Alt`+ドラッグ・スポイト・キーボード操作に触れる記述も、`InputTracker.js` の該当行と照合する（`PROJECT_ARCHITECTURE.md` 3章3.の `+` 行の照合はタスク5の担当なので行わない）。
    * `PointHitRules`・`AltKeyGuard` の公開API・振る舞い・使う側を照合する。
    * 結果を4章タスク6へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク7: `PROJECT_ARCHITECTURE.md` 3章4.〜9.と `_doc/arch/07_KeyboardShortcuts.md`・`14_edit.md` の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章4.「座標系とビュー変換」〜9.「ファイル入出力」L296-374 のうち `+` 行 L296, L312-317, L329, L333-335, L364）
    * `./_doc/arch/07_KeyboardShortcuts.md` :（照合。`+` 行 L3, L5-11。キーの対応表、キーリピート・入力欄にフォーカスがある間の扱い）
    * `./_doc/arch/14_edit.md` :（照合。`+` 行 L1, L3-8, L10-11, L21-22, L24-27, L30, L36, L39, L41-42, L44-46）
    * 主なコード：`./js/core/KeyboardShortcuts.js`・`./js/core/ViewTransform.js`、`./js/edit/` 配下（`ShapeExtentReader.js`・`ShapeInserter.js`・`ClipboardController.js`・`StylePanelRules.js`・`ShapeStyleEditor.js`・`ShapeOrderRules.js`・`ShapeOrderEditor.js`・`StyleEyedropper.js`）、`./js/palette/CanvasPalette.js`（`ISSUE_MESSAGES`）、`./js/main.js`（呼び出し元）
  * **調査内容**:
    * `KeyboardShortcuts` のキーの対応表（`Z`・`X`・`C`・`Tab`・`D`・`I`・`Ctrl`+`I`・`Ctrl`+`Shift`+`V` 等）とキーリピート・入力欄フォーカス中の扱いを照合する。
    * 3章4.〜9.の `+` 行（ビュー変換、履歴の記録する操作と時点、同じ位置に貼り付け・貼り付けのずらし量、保存・読み込みの問題）を照合する。
    * `14_edit.md` の `+` 行の各クラスの公開メソッド・依存（import）・契約・使う側・定数（`RESET_COLORS_STYLE` 等）を照合する（07-02 で書いた `ShapeStyleEditor` の記述が 07-04 の `D`・スポイトの追加後も成り立つかを重点）。
    * 結果を4章タスク7へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク8: `PROJECT_ARCHITECTURE.md` 3章10.〜14.と `_doc/arch/13_palette.md` の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章10.「確認用ページ」〜14.「重なり順の変更」L375-437 のうち `+` 行 L381, L397-398, L400, L408-410, L414-417, L419-421, L424-427, L429-430, L432-433）
    * `./_doc/arch/13_palette.md` :（照合。`+` 行 L1-5, L10, L12, L14, L16-17, L19-31, L34-35, L37-40）
    * 主なコード：`./js/palette/` 配下（`ToolPalette.js`・`OptionBarStyleGroup.js`・`ViewToggleGroup.js`・`UnitSnapGroup.js`・`OptionBarOrderGroup.js`・`PaletteLauncher.js`）、`./js/edit/ShapeStyleEditor.js`・`./js/edit/ShapeOrderEditor.js`・`./js/edit/EndpointSnapper.js`、`./js/core/InputTracker.js`（12.の吸い付きの流れ・`Ctrl`の間は照会しない箇所）、`./js/main.js`（同期関数）
  * **調査内容**:
    * 12.の端点への吸い付きの流れ（描き始め・端点のハンドルのドラッグ）、吸い付きとスナップの優先、`Ctrl`の間に照会を呼ばない場面を `InputTracker.js` の該当行と照合する。
    * 11.・13.・14.の `+` 行（ボタンのid、反映の範囲、ドラッグ中の変更を拒まないこと、押せる/押せないの同期の経路）を照合する。
    * `13_palette.md` の各部品の公開メソッド・注入（コンストラクタの引数）・importの有無・二重定義のtypedef・表示の規則・`PaletteLauncher` の注入と隠している間の規則を照合する（07-01・07-02 の記述が 07-04・07-05 の追加後も成り立つかを重点）。
    * 結果を4章タスク8へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク9: `PROJECT_ARCHITECTURE.md` 3章15.（表示）と `_doc/arch/20`〜`26` の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章15.「表示（アウトライン・背景・グリッド・定規・座標の表示・パレットを隠す・全体を画面に収める）」L438-459。全行が `+` 行）
    * `./_doc/arch/20_DisplayState.md`・`21_GridSpacingRules.md`・`22_RulerTickRules.md`・`23_RulerRenderer.md`・`24_CanvasCursorTracker.md`・`25_ViewFitRules.md`・`26_StatusReadoutRules.md` :（照合。いずれも新設で全行が `+` 行）
    * 主なコード：`./js/core/DisplayState.js`・`GridSpacingRules.js`・`RulerTickRules.js`・`RulerRenderer.js`・`CanvasCursorTracker.js`・`ViewFitRules.js`・`StatusReadoutRules.js`、`./js/core/CanvasManager.js`（描画）、`./js/palette/ViewToggleGroup.js`、`./js/main.js`（`// 6.5.` 等の表示配線）、`./index.html`（定規・ステータスバーの要素とCSS変数）
  * **調査内容**:
    * 各モジュールの公開API・状態の初期値・`onChange` の通知の条件と回数・既定値と定数（全体を画面に収めるときの余白と倍率の範囲、座標の表示の桁、グリッドの間隔の規則、定規の太さ）・使う側（import）を照合する。
    * 15.の流れ（表示の切り替え、`C`で消すのがグリッドの細線・太線だけであること、アウトライン表示の間は塗った内側が当たりにならないこと、パレットを隠す、全体を画面に収める、座標の表示）を `main.js`・`CanvasManager.js`・`InputTracker.js` の該当行と照合する（07-03 で書いた記述が 07-04・07-05 の追加後も成り立つかを重点）。
    * 作業データ・履歴・保存先に表示の状態を入れていないことを確かめる。
    * 結果を4章タスク9へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク10: `PROJECT_ARCHITECTURE.md` 3章16.（選択と移動の操作）と `_doc/arch/27_SelectionRules.md`・`28_MoveDirectionRules.md` の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章16.「選択と移動の操作」L460-472。全行が `+` 行）
    * `./_doc/arch/27_SelectionRules.md`・`28_MoveDirectionRules.md` :（照合。いずれも新設で全行が `+` 行）
    * 主なコード：`./js/core/SelectionRules.js`・`./js/core/MoveDirectionRules.js`・`./js/core/InputTracker.js`（呼び出し箇所・修飾キーを見る時点）、`./js/edit/StyleEyedropper.js`（スポイト）、`./js/core/KeyboardShortcuts.js`・`./js/main.js`（選択の反転等）
  * **調査内容**:
    * `SelectionRules`・`MoveDirectionRules` の公開関数の引数・戻り値・振る舞い・使う側（import）を照合する。
    * 16.の各操作（`Ctrl`+クリック・`Ctrl`+範囲選択・`Shift`+ドラッグ・`Alt`+ドラッグ・選択の反転・スポイト 等）の流れ・修飾キーを見る時点・履歴の単位を `InputTracker.js`・`main.js` の該当行と照合する（07-05 の丸めの追加後も成り立つかを重点）。
    * 結果を4章タスク10へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク11: `PROJECT_ARCHITECTURE.md` 3章17.（スナップ）と `_doc/arch/30_UnitSnapRules.md`・`31_UnitSnapSettings.md` の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合。3章17.「スナップ」L473-498 のうち `+` 行 L473-496）
    * `./_doc/arch/30_UnitSnapRules.md`・`31_UnitSnapSettings.md` :（照合。いずれも新設で全行が `+` 行）
    * 主なコード：`./js/core/UnitSnapRules.js`・`./js/core/UnitSnapSettings.js`・`./js/core/InputTracker.js`（丸めの呼び出し箇所）、`./js/palette/UnitSnapGroup.js`、`./js/main.js`（`// 3.3.` 等の配線）、`./js/shapes/` の `getHandlePosition`
  * **調査内容**:
    * `UnitSnapRules` の公開関数・定数（単位 1px・10px 等）、`UnitSnapSettings` の初期値・`onChange` の通知の条件と回数・保存しないことを照合する。
    * 17.の流れ（丸める場面と丸めない場面（曲線の作成時の制御点等）、「`Shift`の方向の限定 → 丸め」の順、端点への吸い付きとの優先、`Ctrl`の間は照会しないこと、単位のボタンはスナップがOFFの間も押せること、作業用フィールドを消す箇所）を `InputTracker.js`・`UnitSnapGroup.js`・`main.js` の該当行と照合する。
    * 結果を4章タスク11へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク12: `_doc/arch/01_index_html.md` と `_doc/arch/19_ToolRules.md` の照合
  * **対象ファイル**:
    * `./_doc/arch/01_index_html.md` :（照合。`+` 行 L2-12, L15, L17-18）
    * `./_doc/arch/19_ToolRules.md` :（照合。新設で全行 L1-9 が `+` 行）
    * 主なコード：`./index.html`、`./js/core/ToolRules.js`・`./js/palette/ToolPalette.js`・`./js/core/KeyboardShortcuts.js`（`title` に併記したショートカットとの対応）・`./js/main.js`（覆い要素・ウィンドウの表示）・`./js/core/WindowManager.js`
  * **調査内容**:
    * `index.html` の画面の領域・ツールバー・オプションバー・定規・ステータスバー・ツールパレットの要素のid・クラス・属性（`aria-pressed` の有無、`title`、`hidden`）、`.toolbar-group`・`.status-bar-group`・`.status-bar-left` の `display: contents`、`:root` のCSS変数（`--ruler-size`・`--canvas-area-top`・`--canvas-area-left` 等）、ボタンの並び、ウィンドウの既定の位置の記述を照合する（07-01 の記述が 07-03〜07-05 のステータスバーの項目・スポイトのボタンの追加後も成り立つかを重点）。ブラウザでの見え方は2章要件1の扱いに従う。
    * `ToolRules` の公開API（`TOOL_IDS` の並び・`EYEDROPPER_TOOL_ID`・`resolveActiveTool` 等）と `tool-${toolId}` の対応、使う側を照合する。
    * 結果を4章タスク12へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク13: `_doc/arch/16_test.md`（自動テスト）の照合
  * **対象ファイル**:
    * `./_doc/arch/16_test.md` :（照合。`+` 行 L16-17, L19, L24-25, L29, L34, L42-70, L73-75, L78-79）
    * 主なコード：`./test/` 配下（記述のあるテストファイル）と、テストの対象のモジュール
  * **調査内容**:
    * 記述されたテストファイルの存在、テストの内容の記述と実際のテストケース（`test(` / `it(` の名前と検証内容）、偽物と実物の使い分け、「テストできない箇所」の一覧を照合する。
    * テストの件数は、プロジェクトのルートで `node --test` を実行して確かめる（ファイルを書き換えない実行に限る）。ファイルごとの件数は該当ファイルのテストケースを数える。「Phase 07-03完了時」等の過去の時点の件数は、該当コミットを `git log --oneline -- test` で特定し、`git show <コミット>:<パス>` のテストケースの数で確かめられる範囲で確かめる（チェックアウトはしない）。
    * 結果を4章タスク13へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク14: 要件2（Phase 7 でなくなったものの名前の残存）の検索
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイル `09_DragTracker.md`・`17_sprite_check.md` を含む） :（名前の検索）
    * 洗い出しの元：`git diff --name-status 9edd0fc 6c9005d -- js index.html test` の削除・改名（`js/palette/PaletteController.js`・`js/palette/PropertyShapeSection.js`・`js/palette/PropertyOrderSection.js` → `OptionBarOrderGroup.js`）、`git diff 9edd0fc 6c9005d -- js index.html test` の `-` 行（なくなった要素のid・クラス・フィールド・メソッド）、`git diff 9edd0fc 6c9005d -- PROJECT_ARCHITECTURE.md _doc/arch` の `-` 行（148行）
    * 主なコード：`./index.html`・`./js/` 配下・`./test/` 配下（なくなったことの確認）
  * **調査内容**:
    * なくなった名前（ファイル・クラス・`index.html` の要素のid・クラス・`StylePanelView` の `source`・`selectedCount`、`InputTracker` の公開フィールド `lastCursor`、フロートウィンドウの `.disabled` クラス 等）を一覧にし、それぞれが現在の実コードに存在しないことを `Grep` で確かめる（存在するものは一覧から外し、その旨を書く）。
    * 一覧の名前で `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイルを検索し、見つかった箇所を「経緯として書かれている（相違としない）」「現存するもの・今も呼べるものとして読める（相違）」に分ける。差分のない行は、検索で見つかった箇所だけを扱う。
    * 結果を4章タスク14へ、相違を5章へ記載し、`git status` で無変更を確認する。

* [ ] タスク15: 『開発資料との相違』欄の確認と、読み方が分かれる記述・照合できなかった主張の一覧化（固定タスク）
  * **対象ファイル**:
    * `./_log/res/261114_1541_RES_Survey_Phase07_Doc_Consistency.md` :（本RESの4章・5章・6章）
  * **調査内容**:
    * 5章『開発資料との相違』を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。
    * 4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。
    * `git status` で、本RES以外に変更がないことを確認する。

## 4. 調査結果
### タスク1: `PROJECT_ARCHITECTURE.md` 1章の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク2: `PROJECT_ARCHITECTURE.md` 2章と `03_VectorModel.md`・`10_ShapeFactory.md`・`12_shapes.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク3: `PROJECT_ARCHITECTURE.md` 4章と `04`・`05`・`08`・`11`・`15` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク4: `PROJECT_ARCHITECTURE.md` 3章冒頭・1.〜2.と `02_main.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク5: `PROJECT_ARCHITECTURE.md` 3章3.の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク6: `06_InputTracker.md`・`18_PointHitRules.md`・`29_AltKeyGuard.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク7: `PROJECT_ARCHITECTURE.md` 3章4.〜9.と `07_KeyboardShortcuts.md`・`14_edit.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク8: `PROJECT_ARCHITECTURE.md` 3章10.〜14.と `13_palette.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク9: `PROJECT_ARCHITECTURE.md` 3章15.と `20`〜`26` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク10: `PROJECT_ARCHITECTURE.md` 3章16.と `27_SelectionRules.md`・`28_MoveDirectionRules.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク11: `PROJECT_ARCHITECTURE.md` 3章17.と `30_UnitSnapRules.md`・`31_UnitSnapSettings.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク12: `01_index_html.md` と `19_ToolRules.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク13: `16_test.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク14: 要件2（なくなったものの名前の残存）の検索
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク15: 『開発資料との相違』欄の確認と一覧化
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

## 5. 開発資料との相違
* `PROJECT_ARCHITECTURE.md` および `_doc/arch/` 配下の記述と、実コードに相違があった場合のみ、タスク番号を添えて記載する。
* 形式: **（対象：資料のファイルと節）**： （資料の記述） → （実コードの実態。`ファイル:行` を添える）
* 相違が見つからなかった場合は「相違なし」と記載すること（未確認と区別するため。タスク15で記入する）。

## 6. 懸念事項・今後の修正における注意点
* （タスク15で、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、資料のファイルと節・要点・タスク番号の一覧としてまとめる。特になければ「特になし」とする）
