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
* [x] タスク1: `PROJECT_ARCHITECTURE.md` 1章（フォルダ構成・存在しないもの・フォルダの役割・依存方向）の照合
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
  * `git diff -U0 9edd0fc 6c9005d` の `+` 行（L20, L30-42, L59, L62-65, L74, L77, L94-96, L98-99, L101-104, L108-110, L132, L137, L139-140, L158, L161-162, L165, L167）を、`git ls-files js test index.html`・`js/` 全体の `^import` の検索・`index.html` の要素・`wc -l` と照合した。
* **事実（実コードの記述）**:
  * **L20（index.html）**：一致。`#tool-eyedropper`（💉、`title="スポイト (I)"`）は index.html:533。ツールバー`#toolbar`（index.html:473。操作のボタンの`.toolbar-group`が先、続けて`#option-style-group`・`#option-order-group`）、定規（`#ruler-horizontal`・`#ruler-vertical`・`#ruler-corner`、index.html:470-472。`.ruler`は`position: fixed` :69）、ステータスバー（`.toolbar, .status-bar`が`position: fixed` :49-50）。ステータスバー右側は`#view-toggle-group`→`#unit-snap-group`（`#unit-snap-toggle`🧲・`#unit-snap-unit-toggle`）→表示倍率のまとまりの順（index.html:510-524）。CSSファイルの分割なし（`<link>`0件、`<style>`は index.html:7）。`:root`の`--ruler-size`（index.html:14）・`--canvas-area-top/left/width/height`（:18-21）の定義はここのみ（`js/`内に`canvas-area`・`ruler-size`・`toolbar-height`・`statusbar-height`の語の定義は無し。`js/check/SpriteCheckPage.js:262`の`check-canvas-area`は別物）。`sprite-check.html`は存在し`<style>`あり（sprite-check.html:7）。
  * **L30-42、L59、L62-65、L74、L77（構成図のファイル）**：全ファイル実在し、図の位置のフォルダに置かれている（`git ls-files js`）。注記の照合：`PointHitRules`は`InputTracker`のみから使われる、`SelectionRules`は`InputTracker`・`main.js`、`MoveDirectionRules`は`InputTracker`のみ、`UnitSnapRules`は`InputTracker`・`main.js`、`GridSpacingRules`は`CanvasManager`・`RulerRenderer`・`main.js`、`RulerTickRules`は`RulerRenderer`のみ、`ViewFitRules`・`StatusReadoutRules`は`main.js`のみ、`ToolRules`は`main.js`（と`test/core/ToolRules.test.js`）がimportし、`InputTracker.js`・`ShapeFactory.js`・`ToolPalette.js`に出る語はコメント中のみ（import無し。`ToolRules`自身は`InputTracker`・`ShapeFactory`をimport、`ToolRules.js`冒頭）。`UnitSnapSettings`は`main.js`・`UnitSnapGroup.js`（コメント）に出現、`UnitSnapGroup`はimport0。`AltKeyGuard`・`ViewToggleGroup`・`UnitSnapGroup`・`DisplayState`・`CanvasCursorTracker`・`StyleEyedropper`（`StylePanelRules`のみimport）・`ShapeExtentReader`（`SpriteSerializer`のみimport）は一致。`palette/`の全8ファイルの`^import`は0件。すべて一致。
  * **L94-96, L98-99, L101-104, L108-110, L132, L137, L139-140（test/）**：記載の`*.test.js`はすべて`test/`の同フォルダに実在（L92-142の45ファイル、`git ls-files test`も45件で過不足なし）。`test/`は`js/`のみをimportし、`index.html`・`main.js`をimportするテストは無し（`js/`から`test/`のimportも無し）。一致。
  * **L158（存在しないもの）**：差分（`git diff -U0 9edd0fc 6c9005d`のハンク`@@ -127 +158 @@`の`-`行と`+`行）で書き換え・追加された項目を照合した（L158は本タスクだけの担当）。`-`行と`+`行を見比べると、書き換え・追加された項目は次の26項目である（`-`行と同じ原文の項目は変更部分ではない）：(1)頂点の座標・図形の大きさの数値の欄（`-`行の「プロパティパネルの「頂点」の段」の書き換え）、(2)プロパティパネル、(3)オプションバーの「選択中：n個」「次に描く図形」の表示、(4)ツールバー・ステータスバーの折り返し・横スクロール・項目の省略メニュー（`-`行の「ツールバー」の書き換え）、(5)フロートウィンドウの位置・表示状態の保存、(6)フロートウィンドウを動かせる範囲の制限、(7)表示の状態の保存・履歴の対象化、(8)定規の表示・非表示の切り替え・ガイド・定規からのドラッグ・原点の変更・単位の切り替え、(9)全体を画面に収めるキー・100%で表示するキー・選択中の図形だけを画面に収める操作、(10)白・黒以外の背景・図形の色を背景に合わせて変えること・ダークモード、(11)カーソルがキャンバスの外へ出たときのホバーの強調の解除、(12)〜(19)（Phase 07-04）`Shift`+クリックでの選択の追加／`Ctrl`+範囲選択での解除／選択集合外の図形の押してそのままのドラッグ・`Alt`+ドラッグ／頂点のハンドルのドラッグでの`Shift`の限定／`Shift`での正方形・正円の作成／ドラッグの途中での`Alt`の切り替え／スポイトの連続の取り込み・取り込む項目を選ぶUI・画面の色からの取り込み・押している間だけ働く一時的なスポイト／`D`での太さの変更、(20)〜(26)（Phase 07-05）スナップの設定の保存・履歴の対象化・キャンバスごとの設定／1px・グリッド10px以外の単位・単位の数値の入力欄・グリッドの線の間隔に合わせる単位／スナップのキー／`Ctrl`以外の修飾キーでの一時無効・キーの購読による即時の反映／丸めた位置を示す表示・定規の印を丸めた位置へ動かすこと／既存の図形・読み込み・出力・貼り付けのずらし量の丸め／曲線の作成時の制御点の丸め。各項目の結果は以下のとおり。
    * (1)頂点の座標・図形の大きさの数値の欄：`index.html`の入力欄は`type="color"`2つ（:488,490）・`type="number"`は`#option-stroke-width`（線の太さ、:491）の1つだけ・`type="file"`2つ（:557-558）・`#dev-json`の`textarea`（:574）のみ。`js/`に`createElement('input')`は0件。頂点の座標・図形の大きさの欄は無い。一致。括弧内の「置き場所は精度のPhaseのDIRで決める」は方針のため照合していない。
    * 名前の不在：`CodeImporter`・`PaletteController`・`PropertyShapeSection`・`PropertyOrderSection`・`PropertyPanel`・`プロパティパネル`・`ColorPicker`・レイヤー（`Layer`）は`js/`・`index.html`・`test/`に0件。`package.json`・`node_modules`・`.github`は無い。`index.html`・`js/`に確認用ページ（sprite-check）へのリンク無し。独自のカラーピッカーは`<input type="color">`のみ（index.html:488,490）。`.json`は作業データファイル（`.ozve.json`、`js/io/DocumentFileIO.js:10`）、スプライトはJS。一致。(2)プロパティパネルは上記の`PropertyPanel`・`プロパティパネル`0件で一致（括弧内の「Phase 07-02で〜なくした」は経緯のため照合していない）。
    * (3)オプションバーの「選択中：n個」「次に描く図形」の表示：`選択中：`・`次に描く`は`index.html`・`js/`に0件。オプションバーのid（index.html:486-498）は線・塗りのあり/なし、色、太さ、重なり順のみ。一致。括弧内の「選択の有無はキャンバス上のハンドルで見分ける」：選択集合の図形のハンドルを描く（CanvasManager.js:226-233）。一致。
    * (4)ツールバー・ステータスバーの折り返し・横スクロール・項目の省略メニュー（1行固定で収まらない右側は切れる）：`.toolbar, .status-bar`が`display: flex; flex-wrap: nowrap; overflow: hidden; white-space: nowrap`（index.html:49-58。index.html:433にも「幅が足りないときは右のまとまりから切れる」）。`overflow: auto`・`overflow-y: auto`はフロートウィンドウ内の別の要素（:325,458）。省略メニューのid・要素は無い。一致。
    * (5)フロートウィンドウの位置・表示状態の保存：`localStorage`・`sessionStorage`は`js/`・`index.html`に0件。一致。(6)フロートウィンドウを動かせる範囲の制限：ドラッグ中の移動処理`#handleWindowMouseMove`（JSDoc WindowManager.js:119-127、本体 :128-142）は開始時点のleft/topへ移動量を足すだけ（:137-141）。`WindowManager.js`全体に`clamp`・`Math.`・`innerWidth`・`innerHeight`の語は0件。一致。
    * (7)表示の状態（アウトライン・背景・グリッド・パレットの表示）の保存・履歴の対象化、(20)スナップの設定の保存・履歴の対象化：`DisplayState`・`UnitSnapSettings`は`js/io/`・`js/edit/`・`js/core/HistoryManager.js`にimport・語とも0件。作業データの形は`format`・`version`・`shapes`の3項目（typedef DocumentSerializer.js:62-64、`serialize` :97-101）。`UnitSnapSettings.js`のJSDoc（作業データ・履歴・保存先に含まれない）とも合う。一致。(20)スナップのキャンバスごとの設定：`UnitSnapSettings`は`main.js`で1つだけ生成され（main.js:73）、`UnitSnap`の語が出るのは`InputTracker.js`・`UnitSnapRules.js`・`UnitSnapSettings.js`・`main.js`・`UnitSnapGroup.js`の5ファイルのみ（キャンバスの切り替えを持つ`js/edit/CanvasLibrary.js`等には0件）。キャンバスごとに持つ仕組みは無い。一致。
    * (8)定規の表示・非表示の切り替え・ガイド・定規からのドラッグ・原点の変更・単位の切り替え：定規の要素は`#ruler-horizontal`・`#ruler-vertical`・`#ruler-corner`の3つだけでボタン・入力欄は無い（index.html:470-472）。`js/main.js`の定規の配線は`rulerRenderer`の生成・`renderRulers`・`resize`のみ（:61-62,210-228）。`index.html`・`RulerRenderer.js`に`guide`・`origin`・`ガイド`の語は0件。一致。
    * (9)全体を画面に収めるキー・選択中の図形だけを画面に収める操作：`KeyboardShortcuts.js`の対応表（:110-157）に全体表示用のエントリは無く、`fitViewToShapes`は`#view-fit`のclickからのみ呼ばれる（main.js:455-468）。選択中の図形だけを収める操作は`fitViewToShapes`にも`index.html`にも無い。一致。
    * (9)100%で表示するキー：対応表の`Ctrl`+`0`（`resetView`。KeyboardShortcuts.js:122）は倍率1.0へ戻す（main.js:258-266）。専用のキーはこれ以外に無い。→「読み方が分かれる記述」を参照（相違としない）。
    * (10)白・黒以外の背景・ダークモード：`DisplayState`の背景は真偽値`setDarkBackground`のみ（DisplayState.js:99）。`prefers-color-scheme`は`js/`・`index.html`に0件。一致。括弧内の「定規・バー・ウィンドウの配色の切り替え」：`darkBackground`を読むのは`main.js`の描画の引数（main.js:179）→`CanvasManager.render`だけで、`main.js`・`RulerRenderer.js`にも`index.html`のCSSにも背景に応じて配色を変えるクラス・属性（`.dark`・`theme`）は無い。一致。(10)図形の色を背景に合わせて変えること：通常の表示では`shape.draw(this.ctx)`に配色を渡さず（CanvasManager.js:218）、図形は自身の色で描かれる。背景で切り替わる配色の組（CanvasManager.js:21-38）は背景・グリッド・軸線・原点の印と`outline`の色だけ。→「読み方が分かれる記述」を参照（相違としない）。
    * (11)カーソルがキャンバスの外へ出たときのホバーの強調の解除：`InputTracker`のイベント購読（InputTracker.js:509-519）に`mouseleave`は無く、`clearHovered`はIDLE以外への遷移・選択解除・パン開始などの内部の呼び出しのみ（:555,1160,1383）。`mouseleave`を購読するのは`CanvasCursorTracker`だけで、位置を「なし」にするのみ（CanvasCursorTracker.js:52,105）。一致。
    * **（Phase 07-04）** (12)`Shift`+クリックでの選択の追加：`shiftKey`の読み取りは移動方向の限定のみ（InputTracker.js:1241）。クリックの選択は`Ctrl`の有無だけを`resolveClickSelection`へ渡す（:965）。一致。(13)`Ctrl`+範囲選択での解除：`resolveMarqueeSelection`の`additive`は既存への追加のみ（SelectionRules.js:48-63）。一致。(14)選択集合外の図形の押してそのままのドラッグ：本体が選択集合外なら遷移しない（InputTracker.js:840,890-893）。一致。`Alt`+ドラッグ：`Alt`は押した時点の`event.altKey`だけを記憶し（:1138）、`#beginMoveSelection`の2か所（moveハンドル・選択中の本体。:883,891）のみから記憶する。頂点のハンドル（:885）・範囲選択（:896）では記憶しない。一致（「1回クリックで選んでから」は選択集合外で遷移しないことと合う）。(15)頂点のハンドルのドラッグでの`Shift`の限定：頂点の追従（InputTracker.js:1205-1226）は`shiftKey`を読まず`roundPointFromOriginToUnit`のみ。一致。(16)`Shift`での正方形・正円の作成：作成の経路（:798,975）に`shiftKey`は無い。一致。(17)ドラッグの途中での`Alt`の切り替え：`Alt`は`#duplicateOnMove`へ押した時点だけ記憶（:1131-1139）。一致。(18)スポイトの連続の取り込み：`pickFrom`は取り込んだら`stop()`する（StyleEyedropper.js:108-123）。一致。画面の色からの取り込み：`EyeDropper`は`js/`・`index.html`に0件。一致。押している間だけ働く一時的なスポイト：`KeyboardShortcuts`は`keyup`を購読せず（KeyboardShortcuts.js:162）、`I`は`startEyedropper`（:156）。一致。取り込む項目を選ぶUI：オプションバー・ツールパレットの要素（index.html:486-498,531-533）に該当する要素は無い。一致。(19)`D`での太さの変更：`RESET_COLORS_STYLE`は`strokeColor`・`fillColor`のみ（StylePanelRules.js:75）で、`resetColors`は`applyStyle`へ渡すだけ（ShapeStyleEditor.js:198-200）。一致。
    * **（Phase 07-05）** (20)スナップの設定の保存・履歴の対象化・キャンバスごとの設定は上記(7)(20)の項で照合した。(21)スナップの単位：`UNIT_SNAP_STEPS`は`pixel: 1`・`grid: 10`の2つだけ（UnitSnapSettings.js:22-25）。単位の数値の入力欄・グリッドの線の間隔に合わせる単位：スナップのまとまりの要素は`#unit-snap-toggle`・`#unit-snap-unit-toggle`のボタン2つだけ（index.html:516-519）で、`UnitSnapSettings`は`GridSpacingRules`をimportしない（UnitSnapSettings.js:19のJSDoc。`^import`0件）。一致。(22)スナップのキー：対応表（KeyboardShortcuts.js:110-157）にスナップ用のエントリは無い。一致。(23)`Ctrl`以外の修飾キーでの一時無効：丸めの省略は`hasCtrlModifier`のみ（InputTracker.js:794,971,1209,1240）。一致。キーの購読による即時の反映：`InputTracker.handleKeyUp`は`Space`以外で何もせず（:1006-1009）、`Ctrl`の`keydown`・`keyup`で丸めを更新する処理は無い（`Ctrl`は`mousemove`・`click`・追従のイベントの`ctrlKey`で見る）。一致。括弧内の「次のマウスの移動・`wheel`で切り替わる」：`wheel`はキャンバスで購読し（InputTracker.js:513）、ドラッグ中なら同じ`wheel`のイベントで追従し直す（:1044-1045。追従の丸めは`hasCtrlModifier(event)` :1209,1240）。ステータスバーの座標の表示は`cursorTracker.isCtrlPressed()`（main.js:372）で、`CanvasCursorTracker`が購読するのは`mousemove`・`mouseleave`だけ（CanvasCursorTracker.js:51-52）。`wheel`の拡大縮小では`viewTransform.onChange`から表示を同期し直す（main.js:364のJSDoc）。一致。(24)丸めた位置を示す表示：丸めた位置を示す要素は無い（ステータスバーの座標の表示のみ。main.js:366-373）。定規の印を丸めた位置へ動かすこと：定規の印は丸めない位置のまま（main.js:368のコメント、`renderRulers`は`cursorTracker`の位置を渡す :210-218）。一致。(25)既存の図形・読み込み・出力・貼り付けのずらし量の丸め：`UnitSnapRules`をimportするのは`InputTracker`と`main.js`のみ。`js/io/`・`js/edit/`に`UnitSnap`・`roundPointToUnit`の語は0件。一致。(26)曲線の作成時の制御点の丸め：作成時の丸めの呼び出しは始点・終点の2か所（InputTracker.js:798,975）のみで、制御点用の丸めは無い。一致。
    * 上記(1)〜(26)はすべて照合した（(9)の「100%で表示するキー」と(10)の「図形の色を背景に合わせて変えること」は読み方が分かれる。他は一致）。照合していないのは、項目に添えた経緯・方針の括弧書き（(1)の「置き場所は精度のPhaseのDIRで決める」、(2)の「Phase 07-02で〜なくした」、(3)の「07-02でなくした」、各項目の「〜のPhase」）と、`-`行と同じ原文の項目のうち名前で確かめられない経緯（`Phase 04-04`の経緯、`_doc/PROJECT_MILESTONE.md`への言及など）で、コードで確かめられる範囲がないため。
  * **L161-162, L165（フォルダの役割）**：`core/`の記載ファイルは全て実在。`edit/`は`io/`をimport（`CanvasFileOperations`・`CanvasLibrary`・`ClipboardController`・`ShapeExtentReader`・`ShapeInserter`・`SnapshotAdapter`）、`shapes/`をimportするのは`PathJoiner`（`PathJoinRules`）と`EndpointSnapper`（`EndpointSnapRules`・`PathJoinRules`、EndpointSnapper.js:10,15）のみ。`edit/`に`OperationMode`のimportは無い（`SnapshotAdapter.js:21`・`CanvasLibrary.js:240`はコメントで操作モードを知らないことを述べる）。`StyleEyedropper`・`applyStyle`・`resetColors`（ShapeStyleEditor.js:150, 195付近）・`pasteInPlace`（ClipboardController.js:188）・`duplicateInPlaceWithinEdit`（:206。main.js:161で`duplicateSelection`へ注入）が実在。`io/`・`check/`の記述はimportと一致（`check/`のimportは`check/`内と`io/SpriteSerializer`のみ。`SpriteCheckPage.js:168`は選んだJSのBlob URLの動的import）。
  * **L162（`+`行。ハンク`@@ -130,2 +161,2 @@`。変更部分は`palette/`の記述）**：`shapes/`の3種類の記述は`-`行と`+`行で同じ原文のため、変更部分ではない（参考：`js/shapes/`は図形クラス`Line`・`Rect`・`Ellipse`・`Path`・`Curve`、共通の関数`ShapeGeometry`・`ShapeDataValidation`、図形をまたぐ規則`PathJoinRules`・`EndpointSnapRules`の9ファイル。規則を使うのは`edit/PathJoiner`・`edit/EndpointSnapper`で`shapes/`の外。`main.js`の言及はコメントのみ）。変更部分「ツールバーのオプションバーはまとまり（`.toolbar-group`）ごとに1つのUI部品」：`.toolbar-group`はindex.html:474,478,482,486,494の5つで、そのうち`#option-style-group`（:486）・`#option-order-group`（:494）が`OptionBarStyleGroup.js`・`OptionBarOrderGroup.js`が1つずつ受け持つ（各JSDocにも同じ記述）。「ツールバー自体を配線するクラスは無い」：`js/`に`toolbar`を扱うクラス・`getElementById('toolbar')`は0件。一致。
  * **L167（依存方向とその例外）**：`core/`は`io/`・`edit/`をimportしない、`io/`は`edit/`をimportしない、`js/core`・`js/io`・`js/shapes`に`main`・`edit`のimportは0件。記載の例外import（`PathJoiner→shapes/PathJoinRules`、`EndpointSnapper→EndpointSnapRules・PathJoinRules`、`ShapeStyleEditor→StylePanelRules`、`StyleEyedropper→StylePanelRules`（`sampleStyleFromShape`のみ）、`ShapeOrderEditor→ShapeOrderRules`、`EndpointSnapRules→PathJoinRules`、`PathJoinRules→Path`のみ、`InputTracker→PointHitRules・SelectionRules・MoveDirectionRules・UnitSnapRules`（`resolveUnitSnapStep`ほか。InputTracker.js冒頭のimport）、`AltKeyGuard→InputTracker`の`isTextInputElement`のみ、`CanvasManager→GridSpacingRules`、`RulerRenderer→GridSpacingRules・RulerTickRules`、`ShapeExtentReader→SpriteSerializer`）はすべて実在。`main.js`のimportに`UnitSnapSettings`・`UnitSnapRules`の`resolveUnitSnapStep`・`roundPointToUnit`・`UnitSnapGroup`・`InputTracker`の`hasCtrlModifier`・`SelectionRules`の`invertSelection`あり（main.js:9,12,43-46）。「何もimportしない」と書かれたモジュール（`PointHitRules`・`SelectionRules`・`MoveDirectionRules`・`UnitSnapRules`・`UnitSnapSettings`・`UnitSnapGroup`・`GridSpacingRules`・`RulerTickRules`・`DisplayState`・`ViewFitRules`・`StatusReadoutRules`・`CanvasCursorTracker`・`ViewToggleGroup`・`ShapeOrderRules`）の`^import`は0件。`InputTracker`は`edit/`をimportせず、第7引数の補助`duplicateSelection`・`isPickingShape`・`pickShape`・`getUnitSnapStep`を既定付きで受ける（InputTracker.js:139-159）。`ToolRules`の`import`先は`InputTracker`の`OperationMode`と`ShapeFactory`の`SHAPE_TYPES`、`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない。逆向きのimportは見つからなかった。
    * 「`core/UnitSnapSettings`・`core/UnitSnapRules`・`palette/UnitSnapGroup`は何もimportしない（`GridSpacingRules`も新たにimportしない。3章17.）」：括弧の主語はこの3モジュール。3ファイルとも`^import`0件で、`GridSpacingRules`の語はコメントのみ（UnitSnapSettings.js:18-19）。一致（`main.js`が`computeGridSpacing`をimportするのは別の主張で、main.js:40。この括弧の対象ではない）。
* **推測・所見**:
  * 読み方が分かれる記述：L165「`io/`・`core/`の機能を組み合わせて」。`edit/`の`core/`のimportは0件（`edit/`が`core/`をimportするのは無い。`core/`の機能は`main.js`の注入経由）。「組み合わせ」を注入されたオブジェクト（`VectorModel`等）を扱う意味と読めば一致。
  * 読み方が分かれる記述：L158「100%で表示するキー」（存在しないもの）。`Ctrl`+`0`（`resetView`）は倍率1.0（100%）へ戻すキーとして実在する（KeyboardShortcuts.js:122、main.js:258-266）。「新たに足したキーは無い」と読めば一致、「100%へ戻すキーは無い」と読めば不一致になる。同じ行の他のキー（全体表示・スナップ）は実在しない。
  * 読み方が分かれる記述：L158「図形の色を背景に合わせて変えること」（存在しないもの）。通常の表示では図形は自身の色で描かれ、背景に応じて変わらない（`shape.draw(this.ctx)`、CanvasManager.js:218）。一方、アウトライン表示の線の色は背景で切り替わる（白の背景で`#000000`、黒の背景で`#ffffff`。CanvasManager.js:28,36、`drawOutline(this.ctx, view.scale, scheme.outline)` :216）。「図形自身の色（線・塗り）を変えない」と読めば一致、「図形の描画の色を背景で変えることは無い」と読めばアウトライン表示の線の色と食い違う。
  * 照合できなかった主張：ブラウザでの見え方・実測値（フォントによる字形、1280px幅での実際の切れ方等）。コードの値（CSS・要素の並び）で確かめられるツールバー・ステータスバーの「収まらない右側は切れる」は上のL158で照合した。L158の方針・経緯の部分（各Phaseへの言及）は上記のとおり照合していない。

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
