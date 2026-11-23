# RES: 調査計画・調査レポート Survey : Phase 10 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261123_1310_REQ_Survey_Phase10_Doc_Consistency.md`

## 1. 調査目的
Phase 10「変形」（10-01〜10-04）と、クローズ前のInterrupt「使われないハンドルの処理の整理」の期間（コミット`cc72e0d`から`d524ef1`まで）に書き換えられた開発資料（`./PROJECT_ARCHITECTURE.md`と`./_doc/arch/`配下の25ファイル）の記述が、現在の`HEAD`の実コードの事実と食い違っていないかを確かめる。
* 各作業の反映時点ではその作業の差分監査に合格しているため、特に**後の作業のコード変更によって、前の作業で書いた記述が古くなっていないか**を重点的に見る。例：
  * 10-01で書いた外枠のハンドル・`createTransformed`・`Ellipse`の`Error`・弧の裏返しの仮のふるまい・`isScalingSelection`の記述が、10-02の後も成り立つか。
  * 10-02で書いた回転の中心（外枠の中心）・「やらないこと」・`InputTracker`の行数が、10-03の後も成り立つか。
  * 10-03で書いた位置の欄・外枠の2つの範囲・オプションバーの2行の記述が今のコードと合うか。
  * 10-01〜10-03で書いた「到達不能の枝」「契約は19メソッド」「`showHandles`」「`drawHandles`」「図形ごとのハンドル」の記述が、Interruptの後に残っていないか。10-04で書いた版4の連絡の記述。
* **本Surveyは調査だけを行う。計画の立案・すべてのタスクの実行を通じて、いかなる理由があってもソースコードおよび資料ファイルの修正・作成を行わない（本RESファイルへの記載を除く）。** 見つけた傷は直さず、5章に書く。

## 2. 調査要件
### 要件1: 差分で追加・変更された記述の照合
* 差分の `+` 行（26ファイル・全412行。空行2行を含む。本文は約22万字・約40万バイト）に書かれた事実の主張を、1つずつ現在の実コードと照合する。`+` 行は、行の一部だけの変更でも**行全体**を対象とする。担当はタスク1〜16（`+` 行はどれも1つのタスクにだけ割り当ててある）。
* **照合する主張の種類**（コードで真偽を確かめられるもの）：
  * ファイル・フォルダの存在と配置（1章のフォルダ構成図。Phase 10で新設された`js/`の8ファイル・`test/`の9ファイルを含む。「存在しないもの」として書かれたものが実際に無いことを含む）
  * importの有無・向き（1章「依存方向」とその例外（`core/RotationRules → shapes/ShapeGeometry`、`RotationRules → ScaleHandleRules`、`CursorShapeRules → RotationRules`、`PointHitRules → VertexHandleRules`等）、`_doc/arch/`各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの）
  * 公開メソッド・公開の関数・定数・typedef・列挙の一覧と値（`ScaleHandleRules`・`RotationRules`・`ReferencePointRules`・`TransformInputSettings`・`TransformInputRules`・`TransformInputEditor`・`InputModes`（`CANCELABLE_DRAG_STATES`）・`PressActionRules`・`CursorShapeRules`・`KeyboardShortcuts`（`findCancelableDragBinding`）の公開物、`ROTATION_ZONE_SCREEN_PX`・`ROTATION_SNAP_STEP`・`SCALE_HANDLE_HIT_SCREEN_PX`・`SCALE_EDGE_HANDLE_MIN_SCREEN_PX`等）
  * 共通メソッド契約の数（18）と一覧・順番（「第nメソッド」の番号を含む）
  * 図形データ・作業データ・書き出し形式の形（円・弧の`points`の読み方`u`・`w`、`#readGeometry`の2つの枝、作業データの版3と`migrateVersion2To3`、書き出し形式の版4と`ellipse`の`rotation`のキー順、`checkFormat`が受理する版、`ellipseRange`、`CodeExporter`の`DRAW_SOURCE`、`rotation`が有限でないときの扱い）
  * 変換の式（`AffineTransform`・`applyAffineTransformToPoint`・`toScaleTransform`・`toRotationTransform`・`resolveFlipTransform`・基準点の位置・幅と高さの倍率・角度の符号・弧の結合の読み替え）。式の記述は、コードの式と1項ずつ照らす
  * 状態の持ち主・初期値・通知（基準点・比率の鍵、`#scaleDrag`・`#rotateDrag`、保存しない・履歴に入れないと書かれたもの、`onChange`の購読先）
  * 既定値・条件（外枠のハンドルの出る条件、回転の範囲、当たりの優先、押せる条件、受理の規則、`Shift`・`Alt`・`Ctrl`・`Esc`の扱い、幅・高さ0の扱い）
  * 呼び出し元・呼び出し順・記録の時点（3章の流れ・履歴の単位・中断したときの戻し・離したときの通知）
  * `main.js`の配線（`02_main.md`の配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先・行数）
  * `InputTracker`の記述（`06_InputTracker.md`。行数、公開メソッド、入力の補助、修飾キーの項）
  * `KeyboardShortcuts`のキーの対応表（`07_KeyboardShortcuts.md`。反転の2つのキーと`Esc`の例外を含む）
  * 数値（行数：`main.js`・`InputTracker.js`等、資料に書かれた行数すべて）。行数は`wc -l`等で実測し、資料の値と並べて書く。過去の時点の値として書かれたものは現在の値と区別し、`git show <コミット>:<パス>`で確かめられる範囲で確かめる。各作業の完了のコミット：Phase 10の直前＝`cc72e0d`、10-01＝`b5a5be0`、10-02＝`e861b7b`、10-03＝`b0d738d`、10-04＝`86801cc`、Interrupt＝`d524ef1`（タスクごとのコミットは`git log --oneline cc72e0d..d524ef1`で分かる）
  * `index.html`の要素・属性・クラス・CSS変数・幅の見積もりのコメント（`01_index_html.md`。2行のツールバー、`#option-size-group`・`#option-transform-group`、`--toolbar-height`）
  * 自動テストの記述（`16_test.md`。テストファイルの存在、テストの内容の記述が実際のテストケースと合っているか、テストの件数、「テストできない箇所」の一覧、書き方の決まりの例外）。件数は、プロジェクトのルートで`node --test`を実行して確かめてよい（ファイルを書き換えない実行に限る）
* **照合しないもの・限定するもの**：
  * 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、コードの振る舞いとして確かめられる範囲だけを照合し、方針そのものの是非は扱わない。
  * 実際のブラウザでの見え方・実測値・テストプレイの結果についての記述は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。
  * 本リポジトリの外についての記述（OZ Engineなど）は「照合できなかった主張」とする。エンジンのリポジトリのファイルは読まない・変更しない。
  * 差分の `+` 行以外の資料の記述は、要件2の検索で見つかった箇所と既知の傷だけを扱う。`_doc/`の他のファイル（`COWORK_STATUS.md`・`COWORK_HANDOFF.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_MILESTONE.md`等）・`_log/dir/`・本リポジトリの外のファイルは対象にせず、読まない。`_doc/arch/10_ShapeFactory.md`は期間中の書き換えの差し引きの差分が無いため、要件1の対象に入らない。

### 要件2: Phase 10とInterruptで変わった・広がった・なくなったものが、資料に古い形のまま残っていないか
* メソッド契約の数と`drawHandles`、円・弧の読み方、版、位置の欄、回転の中心・外枠、オプションバー、ドラッグ中の`Esc`、当たり分類、行数の変化が、資料に「今もそうである」と読める形で残っていないかを検索で確かめる（項目と手順は3章のタスク17に書く。単独の1タスク）。
* 現在の実コードの事実を確かめたうえで、現在の`./PROJECT_ARCHITECTURE.md`と`./_doc/arch/`配下の全ファイル（差分のない行・差分のないファイルを含む）を検索する。差分のない行については検索で見つかった箇所だけを扱う。経緯・過去の状態として正しく書かれているものは相違としない。

### 要件3: 照合の結果の整理
* 相違が見つかった記述は、5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行`を添える）」の形で、タスク番号を添えて書く。
* 相違ではないが、あいまいで実コードと照らして複数の読み方ができる記述は、4章の各タスクの「推測・所見」に書く（5章には入れない）。
* 照合した主張と結果は、資料のファイル（節）ごとに4章の各タスクの欄へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、その理由を書く）。
* **既知の傷**（現場設計セッションが把握している。確認漏れと区別するため、担当のタスクで確かめて5章へ必ず挙げる。内容は担当のタスクの調査内容に書く）：
  1. 版4の連絡についての古い記述（`_doc/arch/15_io.md`行25、`PROJECT_ARCHITECTURE.md`1章「存在しないもの」行218） → タスク3・タスク2
  2. `PROJECT_ARCHITECTURE.md`3章25.「確認の状況」（行736） → タスク8
  3. `PROJECT_ARCHITECTURE.md`3章17.（行594）の配線ブロックの切り出し → タスク5
  4. `PROJECT_ARCHITECTURE.md`3章18.（行598〜622）の前半と後半の2段 → タスク6
  5. `_doc/arch/02_main.md`「主な関数」（行4）の書き漏れ → タスク12
  6. `_doc/arch/01_index_html.md`・`index.html`のCSSコメントの、ツールパレットの縦の範囲の見積もり → タスク11

### 参照する責務
* 本Surveyでは資料の記述そのものが照合の対象のため、記述を書き写さない。以後のタスク実行チャットは、次に従う。
* **照合の対象を取得する方法**：
  * 対象の記述は`git diff cc72e0d d524ef1 -- PROJECT_ARCHITECTURE.md _doc/arch`の `+` 行（26ファイル）。ファイルごとの行番号は`git diff -U0 cc72e0d d524ef1 -- <ファイル>`のハンクの見出しで分かる。
  * `d524ef1`より後のコミットは開発資料・コードを変更していないため、各タスクに書いた行番号は現在のファイルの行番号と同じである（計画時に、全412行が現在のファイルの同じ行番号の行と一致することを確認した）。タスクの対象の行だけを`Read`の`offset`・`limit`（または`sed -n '<行>p'`）で開く。1行が数千字になる行がある。
  * 挙げた行の意味を取るのに必要な同じ節の前後の行は読んでよいが、照合する主張は挙げた行（既知の傷は指定された行・範囲）だけとする。行の中のどこが変わったかは`git diff -U0 --word-diff`で分かるが、照合は行全体について行う。
  * 照合に使う実コードは現在の作業ツリー（`HEAD`）の`./index.html`・`./sprite-check.html`・`./js/`・`./test/`・`./asset/`。Phase 10で変更されたコードの一覧は`git diff --stat cc72e0d d524ef1 -- js index.html test asset sprite-check.html`（60ファイル）。タスクに挙げていないコードのファイルも、記述の照合に必要なら読んでよい。
  * 記述の経緯を確かめる必要が生じた場合にのみ、Phase 10の各RES（`./_log/res/261122_1050_RES_Phase10-01_Scale_Handles.md`・`./_log/res/261122_1415_RES_Phase10-02_Rotate.md`・`./_log/res/261122_1838_RES_Phase10-03_Origin_Size_Angle_Flip.md`・`./_log/res/261122_2058_RES_Phase10-04_Engine_Roundtrip.md`・`./_log/res/261123_1213_RES_Interrupt_Handle_Dead_Branches.md`）の該当箇所だけを参照する（全文は読まない）。
  * 日本語を含む行の検索は`Grep`ツール（または`LC_ALL=C.UTF-8`を付けた`grep`）で行う。バイト単位の切り出しは文字が壊れる。
* **読んでよい資料**：自分のタスクの対象として本計画書が指定した資料のファイル・節（`./PROJECT_ARCHITECTURE.md`と`./_doc/arch/`配下）。既知の傷の確認に指定された行も読んでよい。`_doc/`の他のファイルは読まない。
* **判定の基準**：要件1の「照合する主張の種類」「照合しないもの・限定するもの」と、要件2・要件3のとおり。資料の原文とコードの該当行を両方開いて判定する（記憶・要約・RESの記述だけで一致と判定しない）。資料に書かれていない事項がコードに存在することは相違とみなさない。
* **結果の書き方**：4章の自分のタスクの欄の「調査内容」「事実」「推測・所見」を埋める。事実は資料のファイル（節）ごとに分け、主張の要点・結果（一致／相違／照合できなかった）・確かめたコードの場所（`ファイル:行`、または検索した語と件数）を書く。相違の詳細は5章に書き、4章からは「5章」と指す。終わったら3章の自分のタスクを`[x]`にする。
* **タスクは互いに独立**：ほかのタスクの調査結果を読まずに実行する。5章へは自分のタスクの分だけを末尾に足し、ほかの記載を書き換えない。
* **禁止**：ソースコード・資料ファイルの変更・作成、リポジトリの状態を変えるgit操作、過去のコミットを取り出しての実行。終わりに`git status`で、変更が本RESだけであることを確認する。

## 3. タスクリスト
* [x] タスク1: 1章（構成図・フォルダの責務・依存方向）と4章の表
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 20・29・31〜33・36・41〜46・53〜55・65・78〜79・99〜102・106・129・131・136〜137・139・145・151・198〜200・221〜223・225・228・822〜825（42行）。1章「プロジェクトフォルダ構造」の構成図、フォルダの責務`core/`・`shapes/`・`io/`・`edit/`（行221〜225）、依存方向（行228）、4章の表（行822〜825））
    * 照合に使う主なコード :（監査。`./js/`・`./test/`・`./asset/`（ファイルの一覧とimport文の検索）。説明の照合に必要な`./js/core/`・`./js/shapes/`・`./js/io/`・`./js/edit/`・`./js/palette/`のファイルの先頭とimport文）
  * **調査内容**（資料の `+` 行の合計 約15.3千字）:
    * 構成図の `+` 行の各ファイルの存在・配置・説明（import・使う側・置き場所）を、ファイルの一覧とimport文で1つずつ照合する。新設の`js/`の8ファイル・`test/`の9ファイル（`git diff --name-status cc72e0d d524ef1 -- js test` の `A` の行）がすべて図にあるかも確かめる。
    * フォルダの責務（行221〜225）に挙げられたファイル名・責務を実ファイルと照合する。
    * 依存方向（行228）の「〜だけ」「〜をimportしない」「例外は〜」を、`js/`・`asset/`のimport文の全件で1件ずつ照合する（JSDocの`import()`型参照は別に数える）。例外の列挙がすべて実在し、列挙に無い例外のimportが無いかを両方向で見る。
    * 4章の表のパスとファイルの存在を確かめる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [x] タスク2: 1章「存在しないもの」
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 218（1行）。1章「存在しないもの」（1段落。約4,500字））
    * 照合に使う主なコード :（監査。`./js/`・`./index.html`・`./sprite-check.html`・`./test/`（名前・語の検索。必要な箇所だけ読む）、`./js/core/ScaleHandleRules.js`・`RotationRules.js`・`TransformInputSettings.js`、`./js/edit/TransformInputRules.js`）
  * **調査内容**（資料の `+` 行の合計 約4.5千字）:
    * 列挙を1項目ずつ、コード・HTML・ファイル一覧の検索で「本当に無い」ことを確かめる（検索した語と件数を書く）。「Phase 10-0xで実装した」「〜は別」などの但し書きの真偽も確かめる。
    * Phase 10-01〜10-03の分の列挙が、後の作業（10-02の回転・10-03の数値入力と反転・Interrupt）で入ったもの・消えたものを、今と違う形で書いていないかを重点的に見る。
    * **既知の傷1（2か所のうち本節）**：「エンジンでの版4の確認と連絡票（Phase 10-04）」（同じ段落に2回現れる）。版4は連絡済み（同じ資料の2章「エンジンとの約束」(c)＝行265に連絡済みと書かれている）。確かめて5章へ必ず挙げる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [x] タスク3: 2章（データ構造）と`15_io.md`・`17_sprite_check.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 235・237・246・258〜259・262・265〜266・270・274・278・286・296・329・338〜340（17行）。2章「データ構造（Model）の概要」）
    * `./_doc/arch/15_io.md` :（監査。差分の `+` 行＝現在の行 5〜6・24〜25・31・36（6行））
    * `./_doc/arch/17_sprite_check.md` :（監査。差分の `+` 行＝現在の行 19（1行））
    * 照合に使う主なコード :（監査。`./js/io/DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`FileContentReader.js`、`./js/shapes/Ellipse.js`・`Path.js`・`PathJoinRules.js`（`toDrawElement`・`createTransformed`・`#readGeometry`・弧の読み替え）、`./js/core/VectorModel.js`（スタイルの読み書き）、`./js/edit/StylePanelRules.js`・`ShapeStyleEditor.js`、`./js/check/`、`./sprite-check.html`）
  * **調査内容**（資料の `+` 行の合計 約16.5千字）:
    * データの形・キーの並び・版（作業データ3・書き出し4）・移行（`migrateVersion1To2`・`migrateVersion2To3`）・`checkFormat`が受理する版・`ellipseRange`・`DRAW_SOURCE`・`rotation`が有限でないときの扱い・外枠の求め方を、コードの式と1項ずつ照合する。
    * 円・弧の`points`の読み方`u`・`w`と`#readGeometry`の2つの枝、弧の結合の読み替えを`Ellipse.js`・`PathJoinRules.js`と照合する。
    * `15_io.md`の「importは〜のみ」「知らないこと」をimport文で確かめる。`17_sprite_check.md`の判定の条件を`js/check/`・`sprite-check.html`と照合する。
    * 保存しないもの（行329・338〜340）を、保存・履歴・書き出しのコードに該当する項目が現れないことで確かめる。
    * エンジン側の事実の記述（行265）は「照合できなかった主張」とする。
    * **既知の傷1（2か所のうち`15_io.md`行25）**：「版4はPhase 10-04で連絡する（本作業の時点で未連絡）」。版4は連絡済み（行265(c)）。確かめて5章へ必ず挙げる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [x] タスク4: 3章の同期の経路・3.・6.と`07_KeyboardShortcuts.md`・`09_DragTracker.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 353・363・366〜367・369・371・385〜388（10行）。3章冒頭「同期の経路」（行353）、3.（入力監視。行363〜371）、6.（履歴。行385〜388））
    * `./_doc/arch/07_KeyboardShortcuts.md` :（監査。差分の `+` 行＝現在の行 2〜3・13〜20（10行））
    * `./_doc/arch/09_DragTracker.md` :（監査。差分の `+` 行＝現在の行 3（1行））
    * 照合に使う主なコード :（監査。`./js/core/KeyboardShortcuts.js`・`DragTracker.js`・`InputTracker.js`（クリックの解釈・本体ドラッグ・`Alt`複製・`cancelDraftOrClearSelection`・`isScalingSelection`・編集操作の開始と確定）・`PointHitRules.js`・`HistoryManager.js`・`VectorModel.js`、`./js/edit/TransformInputEditor.js`、`./js/main.js`（`KeyboardShortcuts`の注入）、`./test/core/KeyboardShortcuts.test.js`・`KeyboardShortcuts.keydown.test.js`）
  * **調査内容**（資料の `+` 行の合計 約15.6千字）:
    * 同期の経路・当たり分類・クリックの解釈・本体ドラッグの移動量・`Alt`+ドラッグ・キーボード操作（行371。約3,800字）・履歴の単位を、`main.js`・`InputTracker`・`KeyboardShortcuts`・`HistoryManager`の該当箇所と照合する。
    * `07`の公開・追加の仕方・反転の2つのキー・`CANCEL_BINDING`・`findCancelableDragBinding`・`#handleKeyDown`の手順を`KeyboardShortcuts.js`と照合する。`Esc`の例外の条件（修飾キーの扱い・どの状態で効くか・受理判定の手順番号）は1項ずつ照らす。
    * `09`の`cancel({ suppressClick })`を`DragTracker.js`と照合する。
    * 「ドラッグ中は`Esc`を受け付けない」「`cancel`は修飾キーなしだけ」「頂点でないハンドルも当たる」と読める古い記述が、対象の行に残らないかも見る。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク5: 3章2.・11.〜17.と`04_CanvasManager.md`・`30_UnitSnapRules.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 360・480・498・507・524〜526・539・561・574・577・579〜580・584〜585（15行）。3章2.（描画サイクル。行360）、11.（行480）、12.（行498・507）、13.（行524〜526）、15.（行539）、16.（行561）、17.（行574〜585））
    * `./_doc/arch/04_CanvasManager.md` :（監査。差分の `+` 行＝現在の行 2・4〜5（3行））
    * `./_doc/arch/30_UnitSnapRules.md` :（監査。差分の `+` 行＝現在の行 12（1行））
    * 照合に使う主なコード :（監査。`./js/core/CanvasManager.js`・`UnitSnapRules.js`・`InputTracker.js`（スナップ・修飾キーを見る時点）、`./js/shapes/PathJoinRules.js`・`EndpointSnapRules.js`、各図形クラスの`getHandlePosition`、`./js/edit/PathJoiner.js`・`EndpointSnapper.js`、`./js/main.js`（`renderCurrentState`・オプションバーの配線）、`./index.html`（`.toolbar-row`・`--toolbar-height`）、`./js/wiring/DisplayWiring.js`）
  * **調査内容**（資料の `+` 行の合計 約11.9千字）:
    * 描画順・配色の組・外枠と外枠のハンドルの描き方（`04`・行360・行539）を`CanvasManager.js`と照合する（Interruptで消えた`drawHandles`・`showHandles`が今もあると読めないか）。
    * 弧の結合・吸い付き（行480・498・507）、オプションバー（行524〜526。2行・まとまりの数と並び・`main.js`のブロック）、修飾キーを見る時点（行561）、スナップの分担・丸め方・`Ctrl`を見る時点（行574〜585）を照合する。`getHandlePosition`の契約の番号（第16メソッド）と名前の範囲も照らす。
    * `30`の「使う側」（関数ごとの使う箇所）を検索で確かめる。
    * **既知の傷3**：行594（3章17.。差分の行ではない）に「`main.js`の配線ブロックの切り出しは行わない」が残る。`wiring/DisplayWiring`（Phase 08-01で切り出した）と今の`main.js`を見て、現行の制約と取り違える余地を確かめ、5章へ必ず挙げる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク6: 3章18.・19.と`18`・`32`・`34`・`38`・`41`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 600〜601・609〜611・614・616・627（8行）。3章18.（頂点の選択。行600〜616）、19.（行627））
    * `./_doc/arch/18_PointHitRules.md` :（監査。差分の `+` 行＝現在の行 3〜4・6・8〜9（5行））
    * `./_doc/arch/38_VertexHandleRules.md` :（監査。差分の `+` 行＝現在の行 4・6・8・11〜12（5行））
    * `./_doc/arch/34_PressActionRules.md` :（監査。差分の `+` 行＝現在の行 2・7〜11・22〜24・27〜28（11行））
    * `./_doc/arch/32_InputModes.md` :（監査。差分の `+` 行＝現在の行 1〜2・4・8（4行））
    * `./_doc/arch/41_NudgeTargetRules.md` :（監査。差分の `+` 行＝現在の行 7（1行））
    * 照合に使う主なコード :（監査。`./js/core/PointHitRules.js`・`VertexHandleRules.js`・`PressActionRules.js`・`InputModes.js`・`NudgeTargetRules.js`・`InputTracker.js`（`#classifyPoint`・頂点の選択の分岐）・`CanvasManager.js`（頂点のハンドル）・`VectorModel.js`（頂点の選択）・`CursorShapeRules.js`、`./js/edit/NudgeEditor.js`・`PositionInputEditor.js`・`TransformInputEditor.js`、`./js/main.js`、`./test/core/PointHitRules.test.js`・`VertexHandleRules.test.js`・`PressActionRules.test.js`・`InputModes.test.js`）
  * **調査内容**（資料の `+` 行の合計 約14.6千字）:
    * 18.・19.・`38`・`18`・`34`・`32`・`41`の各主張（公開・判定表の順番と条件・importと使う側・読むもの・テストの件数）をコードとテストで1つずつ照合する。`PressActionRules`の表は`scaleHandle`・`rotationCorner`の順を含めて照らす。
    * 「使われないハンドルの処理の整理」（行611）と「発注者の決定」「注意」（行614・616）のうちコードで真偽を確かめられる範囲を照合する。`isVertexHandle`で絞り込むこと・頂点の選択（`A`）でだけ当たること・契約が18メソッドであることを照らす。
    * **既知の傷4**：3章18.の全体（行598〜622。差分の行でない行を含む）を読み、前半（08-02a）と後半（08-02b。行618以降）が2段に並んでいることと、食い違いの有無・箇所を確かめて5章へ必ず挙げる（構成の整理は別の作業）。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク7: 3章20.・21.・24.と`13_palette.md`・`14_edit.md`・`26_StatusReadoutRules.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 637〜640・647〜649・657・720（9行）。3章20.（位置の数値入力。行637〜649）、21.（行657）、24.（行720））
    * `./_doc/arch/13_palette.md` :（監査。差分の `+` 行＝現在の行 17・43〜56・73（16行））
    * `./_doc/arch/14_edit.md` :（監査。差分の `+` 行＝現在の行 5〜6・23・27〜28・32〜44（18行））
    * `./_doc/arch/26_StatusReadoutRules.md` :（監査。差分の `+` 行＝現在の行 4（1行））
    * 照合に使う主なコード :（監査。`./js/palette/OptionBarSizeGroup.js`・`OptionBarTransformGroup.js`・`OptionBarPositionGroup.js`・`OptionBarStyleGroup.js`・`OptionBarCornerGroup.js`、`./js/edit/PositionInputRules.js`・`PositionInputEditor.js`・`TransformInputRules.js`・`TransformInputEditor.js`・`ShapeExtentReader.js`・`ShapeAlignRules.js`・`ShapeAlignEditor.js`・`NudgeEditor.js`・`PathCornerEditor.js`、`./js/core/StatusReadoutRules.js`・`ReferencePointRules.js`・`VertexHandleRules.js`、`./js/io/SpriteSerializer.js`（外枠）、`./js/main.js`（`// 7.10.`・`// 7.13.`・`// 7.14.`）、`./js/wiring/DisplayWiring.js`、`./index.html`（該当のまとまり））
  * **調査内容**（資料の `+` 行の合計 約15.6千字）:
    * 20.の表示・入力の流れ・位置の定義・発注者の決定・やらないことを、`PositionInputRules`・`PositionInputEditor`・`main.js`（`// 7.10.`）と照合する（図形は線を含まない外枠の基準点か、頂点の選択（`A`）は今までどおりか）。21.（整列の外枠の線の太さ）・24.（区間の切り替え）の該当行も照合する。
    * `13`の`OptionBarSizeGroup`・`OptionBarTransformGroup`の公開メソッド・注入・表示の規則・知らないこと・二重定義、まとまりの足し方、ツールバーの位置づけを照合する。
    * `14`の`ShapeExtentReader`・`PositionInputRules`・`PositionInputEditor`・`TransformInputRules`・`TransformInputEditor`の公開・依存・契約・使う側・テストの件数を照合する（`SIZE_AXIS`・`FLIP_AXIS`の値、入力の数値の判定3行の二重定義を含む）。
    * `26`の「使う側」を検索で確かめる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク8: 3章25.（拡大縮小）と`42_ScaleHandleRules.md`・`35_CursorShapeRules.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 724〜737（14行）。3章25.（行724〜736。行737は空行））
    * `./_doc/arch/42_ScaleHandleRules.md` :（監査。差分の `+` 行＝現在の行 1〜11（11行））
    * `./_doc/arch/35_CursorShapeRules.md` :（監査。差分の `+` 行＝現在の行 2〜4・8（4行））
    * 照合に使う主なコード :（監査。`./js/core/ScaleHandleRules.js`・`CursorShapeRules.js`・`UnitSnapRules.js`・`InputTracker.js`（拡大縮小の部分）・`CanvasManager.js`（外枠）・`DragTracker.js`・`RotationRules.js`（`ScaleHandleRules`を使う箇所）、`./js/edit/ShapeExtentReader.js`・`TransformInputRules.js`、`./js/io/SpriteSerializer.js`（`computeShapesGeometryBounds`）、図形クラスの`createTransformed`、`./js/main.js`（`renderCurrentState`・注入）、`./test/core/ScaleHandleRules.test.js`・`CursorShapeRules.test.js`）
  * **調査内容**（資料の `+` 行の合計 約16.8千字）:
    * `collectScaleFrame`・`hitTestScaleHandle`・`resolveScaleHandleCursor`・`computeBoundsScale`・`toScaleTransform`・`collectFrameCorners`・`computeFrameCenter`の式・条件・並び・定数を1項ずつコードと照合する。
    * 25.の流れ・記録の時点・`Esc`・確定・中断・`Alt`／`Shift`／`Ctrl`の扱い・幅と高さ0の扱い・図形ごとの扱い・ふるまいの注意・やらないことを照合する。回転（10-02）・基準点（10-03）・Interruptの後の今のコードで成り立つかを重点的に見る。
    * `35`の判定の表（順番(0a)〜と条件）を`CursorShapeRules.js`の分岐の順と1つずつ照らす。公開の値・読むもの・importも確かめる。
    * **既知の傷2**：25.「確認の状況」（行736）がPhase 10-01のテストプレイの結果を「この資料の時点で結果は未記録」としたまま（実際は2026-11-22に発注者のテストプレイで合格。コードでは確かめられないため、現場設計セッションの把握として扱う）。26.・27.の同じ項（行753・772）が合格と書いていることとの差を添えて5章へ必ず挙げる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク9: 3章26.（回転）と`43_RotationRules.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 738〜753（16行）。3章26.（行738〜753））
    * `./_doc/arch/43_RotationRules.md` :（監査。差分の `+` 行＝現在の行 1〜14（14行））
    * 照合に使う主なコード :（監査。`./js/core/RotationRules.js`・`ScaleHandleRules.js`（`collectFrameCorners`・`computeFrameCenter`・`hitTestScaleHandle`）・`ReferencePointRules.js`・`CursorShapeRules.js`・`PressActionRules.js`・`InputTracker.js`（回転の部分）・`CanvasManager.js`（傾いた外枠の描画）・`InputModes.js`、`./js/shapes/ShapeGeometry.js`・`Ellipse.js`（回転に関わる部分）、`./js/edit/TransformInputRules.js`、`./js/main.js`、`./test/core/RotationRules.test.js`）
  * **調査内容**（資料の `+` 行の合計 約15.6千字）:
    * `hitTestRotationZone`・`resolveRotationCursor`・`computeRotationCenter`・`computeRotationAngle`・`toRotationTransform`・`rotateScaleFrame`・`resolveDisplayedScaleFrame`の式・条件・符号・定数（`ROTATION_ZONE_SCREEN_PX`・`ROTATION_SNAP_STEP`）を1項ずつ照合する。
    * 26.の流れ・外枠の控え・離したときの通知・`Esc`・確定・中断・カーソル・図形ごとの扱い・保存と版・ふるまいの注意を照合する。
    * 10-03で回転の中心が基準点に変わった後も、26.・`43`の記述（発注者の決定・注意・やらないことを含む）が今のコードと食い違わないか、過去の時点の記述として読めるかを重点的に見る。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク10: 3章27.（基準点・大きさ・角度・反転）と`44`・`45`・`03_VectorModel.md`
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（監査。差分の `+` 行＝現在の行 754〜773（20行）。3章27.（行754〜772。行773は空行））
    * `./_doc/arch/44_ReferencePointRules.md` :（監査。差分の `+` 行＝現在の行 1〜9（9行））
    * `./_doc/arch/45_TransformInputSettings.md` :（監査。差分の `+` 行＝現在の行 1〜9（9行））
    * `./_doc/arch/03_VectorModel.md` :（監査。差分の `+` 行＝現在の行 2・9（2行））
    * 照合に使う主なコード :（監査。`./js/core/ReferencePointRules.js`・`TransformInputSettings.js`・`VectorModel.js`（公開メソッドと`replaceShapesKeepingIds`）・`RotationRules.js`・`ScaleHandleRules.js`・`StatusReadoutRules.js`、`./js/edit/TransformInputRules.js`・`TransformInputEditor.js`・`PositionInputEditor.js`・`PositionInputRules.js`・`ShapeExtentReader.js`、`./js/palette/OptionBarSizeGroup.js`・`OptionBarTransformGroup.js`、`./js/main.js`（該当の配線・`performFlip`）、`./test/core/ReferencePointRules.test.js`・`TransformInputSettings.test.js`・`VectorModel.replaceShapesKeepingIds.test.js`）
  * **調査内容**（資料の `+` 行の合計 約15.1千字）:
    * 27.の表示・入力の流れ、押せる条件、基準点の位置、幅と高さ（倍率・比率の鍵）、角度の符号、反転（`resolveFlipTransform`）、数字の形、確定の契機、ドラッグ中の扱い、取り消し1件、保存しないもの、位置の欄・ドラッグの回転との関係を照合する。発注者の決定・計画の設計判断・ふるまいの注意は、コードで真偽を確かめられる範囲だけ照合する。
    * `44`・`45`の公開・契約・import・使う側・知らないこと・テストの件数を照合する。`main.js`での生成の位置（`// 3.4.`）と`onChange`の購読先も確かめる。
    * `03`の公開メソッドの一覧（増減・並び）と`replaceShapesKeepingIds`の手順・例外・通知の回数を照合する。
    * 「確認の状況」（行772）の件数（tests 2467 / suites 400）が、Phase 10-03の時点の値と現在の値のどちらに読めるかを記録する（Interruptの後は2470 / 401。`16_test.md`行225）。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク11: `01_index_html.md`
  * **対象ファイル**:
    * `./_doc/arch/01_index_html.md` :（監査。差分の `+` 行＝現在の行 2〜3・10・12・15〜17・19（8行））
    * 照合に使う主なコード :（監査。`./index.html`（全体）、`./js/core/KeyboardShortcuts.js`（`title`の表記と対応するキー）・`ToolRules.js`・`FocusKeyYieldRules.js`、`./js/palette/`の該当のまとまり）
  * **調査内容**（資料の `+` 行の合計 約13.6千字）:
    * 要素・`id`・クラス・`disabled`・`title`・ボタンの並び・`aria-pressed`の有無を`index.html`と1つずつ照合する（`#option-size-group`・`#option-transform-group`・`.toolbar-row`・`--toolbar-height`を含む）。
    * CSSの値を`index.html`の`:root`と宣言で照合する。幅の見積もり（1280px幅）は、資料の値・CSSコメント（`index.html`行487〜490）の値・CSSの宣言からの計算を突き合わせる。1行を前提にした値（「約1261px」「残り約19px」「40px」「高さは1行固定」）が今もそうだと読める形で残っていないか。実際のブラウザでの見え方は「照合できなかった主張」とし理由を書く。
    * ショートカットの表記と`KeyboardShortcuts`の対応を照合する。
    * **既知の傷6**：ツールパレットの縦の範囲の見積もり（「約410」「本体約301px」など。実測と合わない値が残るとされる）。計画時の検索では「約410」は`index.html`・`01_index_html.md`に無く、資料の行12は「y 108〜約450」、CSSコメント（`index.html`行236〜237）は「y 108〜約450」「見出し約39px＋本体約301px＋枠2px」だった。これらがCSSの宣言から計算した値（ボタンの数・寸法・余白・見出し）・互いの値と合うかを確かめ、5章へ必ず挙げる（合っていた場合も、その旨と根拠を書く。資料には「CSSコメントの見積もりは正本でない」と書いてある。ブラウザでの実測はできないため、コードから確かめた範囲を明記し、残りは「照合できなかった主張」に書く）。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク12: `02_main.md`
  * **対象ファイル**:
    * `./_doc/arch/02_main.md` :（監査。差分の `+` 行＝現在の行 3〜4・12・14・24・27〜29・40・44・54・56〜59・65・71・74・78・81（20行））
    * 照合に使う主なコード :（監査。`./js/main.js`（全体）、注入先のクラスのコンストラクタ（`InputTracker`・`KeyboardShortcuts`・`PositionInputEditor`・`TransformInputEditor`・`OptionBarSizeGroup`・`OptionBarTransformGroup`・`ShapeAlignEditor`・`ShapeExtentReader`・`TransformInputSettings`・`wiring/DisplayWiring`））
  * **調査内容**（資料の `+` 行の合計 約13.5千字）:
    * 行数（`wc -l js/main.js`。計画時の実測は1183行）、主な関数の一覧、配線ブロックの表の各行（番号・生成物・注入・順番）、注入の表の各行、生成順の制約（行74）、同一経路（行78）、起動時の同期（行81）を`main.js`の該当行と1つずつ照合する（番号の欠け・入れ替わりも見る）。過去の行数の列挙は`git show <コミット>:js/main.js | wc -l`で確かめられる範囲で確かめる。
    * 注入の表の引数名・キー名は、クラスのコンストラクタと照らす。
    * **既知の傷5**：「主な関数」（行4）の一覧に`resetViewToCenter`（`main.js`に定義がある）が無い。5章へ必ず挙げる。ほかに定義があって一覧に無い関数・一覧にあって定義が無い関数も、`main.js`の関数の一覧と突き合わせる（書き漏れか意図した省略かが資料から読めないものは4章の「推測・所見」へ）。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク13: `06_InputTracker.md`
  * **対象ファイル**:
    * `./_doc/arch/06_InputTracker.md` :（監査。差分の `+` 行＝現在の行 1〜2・6〜7・13〜16・20・28〜43・45〜46・57（28行））
    * 照合に使う主なコード :（監査。`./js/core/InputTracker.js`（全体。2020行）、呼び出す規則の公開物（`ScaleHandleRules`・`RotationRules`・`PressActionRules`・`PointHitRules`・`CursorShapeRules`・`InputModes`）、`./js/main.js`（`InputTracker`の生成と注入））
  * **調査内容**（資料の `+` 行の合計 約16.2千字）:
    * 公開メソッド・export・入力状態・知らないこと・当たり分類・押下とカーソルの規則への委譲・頂点の選択モードの分岐・`cancelDraftOrClearSelection`を`InputTracker.js`と照合する。
    * 拡大縮小（行28〜35）・回転（行36〜42）の控え（`#scaleDrag`・`#rotateDrag`のキー）・流れ・確定と中断・`isScalingSelection`・`getRotationDragView`・離したときの通知の順を、コードの順に沿って照合する。
    * 修飾キー（行43）・`InputAssist`（行45）・`Alt`+ドラッグ（行46）・行数（行57。`wc -l`の実測2020行）を照合する。過去の行数の列挙は`git show <コミット>:js/core/InputTracker.js | wc -l`で確かめられる範囲で確かめる。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク14: `12_shapes.md`
  * **対象ファイル**:
    * `./_doc/arch/12_shapes.md` :（監査。差分の `+` 行＝現在の行 3〜4・8・13・35・40〜44・46〜47・49〜54・67・72〜73・76〜79・81〜82（27行））
    * 照合に使う主なコード :（監査。`./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`・`Path.js`・`ShapeGeometry.js`・`PathJoinRules.js`・`EndpointSnapRules.js`・`PathCornerRules.js`・`PathSegmentKindRules.js`・`ShapeDataValidation.js`（公開メソッドと該当の式。`Ellipse.js`は全体）、`./js/core/RotationRules.js`・`ShapeFactory.js`（importのみ））
  * **調査内容**（資料の `+` 行の合計 約17.8千字）:
    * 共通メソッド契約の数（18）・一覧・順番（「第nメソッド」の番号）を、5つの図形クラスの公開メソッドと照合する（Interruptで`drawHandles`を消した後の番号になっているか）。
    * `Ellipse`の`u`・`w`の読み方、`createTransformed`の手順、弧の左右・上下の裏返し、`hitTest`・`intersectsRect`・`hitTestFill`の式、`toDrawElement`の`rotation`を1項ずつ照合する。
    * `PathJoinRules`の弧の読み替え・公開一覧・区間の種類、`ShapeGeometry`の公開関数とimportの制約を照合する。
    * 直線の`move`・円と弧の図形ごとのハンドルの式が今もあると読める記述が残らないかを見る。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク15: `16_test.md` 前半（Phase 10-01・10-02まで）
  * **対象ファイル**:
    * `./_doc/arch/16_test.md` :（監査。差分の `+` 行＝現在の行 8・19・81・185〜208（27行））
    * 照合に使う主なコード :（監査。`./test/core/PointHitRules.test.js`・`InputModes.test.js`・`ScaleHandleRules.test.js`・`RotationRules.test.js`・`PressActionRules.test.js`・`CursorShapeRules.test.js`・`KeyboardShortcuts.test.js`・`KeyboardShortcuts.keydown.test.js`・`VectorModel.replaceShapesKeepingIds.test.js`、`./test/shapes/`の`ShapeGeometry`・`Line`・`Curve`・`Rect`・`Path`・`Ellipse`・`PathJoinRules`の各`.test.js`、`./test/io/SpriteSerializer.test.js`・`DocumentSerializer.migration.test.js`・`DocumentSerializer.roundtrip.test.js`・`CodeExporter.test.js`・`FileContentReader.test.js`、`./test/edit/ShapeExtentReader.test.js`（全文は読まず、`describe`・`it`（`test`）の名前の一覧と、資料に書かれた該当ケースだけを読む））
  * **調査内容**（資料の `+` 行の合計 約9.5千字）:
    * 各行が挙げるテストファイルの存在、ケースの内容（`it`・`test`・`describe`の名前と本文）、件数（追加数と「計」）を、今のテストファイルと照合する。「計n件」が今の数と違う場合は、その作業の完了時の値か（`git show <コミット>:<パス>`で数える）今の値かを読み分ける。
    * 行8（書き方の決まりの例外）・行19（`PointHitRules.test.js`）・行81（08-02aのテストできない箇所）も照合する。「テストできない箇所」は、その対象のテストが今も無く、理由（DOM・Canvas依存など）が今のコードで成り立つかを見る。
    * 「タスクごとの件数」「完了時の件数」は過去の時点の値。`git show`で確かめられる範囲で確かめ、繰り返しで生成されるケースなどで確かめられないものは「照合できなかった主張」にする（過去のコミットを取り出して実行しない）。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク16: `16_test.md` 後半（Phase 10-03・Interrupt・末尾）
  * **対象ファイル**:
    * `./_doc/arch/16_test.md` :（監査。差分の `+` 行＝現在の行 209〜225・236（18行））
    * 照合に使う主なコード :（監査。`./test/core/ReferencePointRules.test.js`・`TransformInputSettings.test.js`・`RotationRules.test.js`・`KeyboardShortcuts.test.js`・`KeyboardShortcuts.keydown.test.js`・`PointHitRules.test.js`・`PressActionRules.test.js`・`CursorShapeRules.test.js`・`VertexHandleRules.test.js`、`./test/edit/PositionInputEditor.test.js`・`TransformInputRules.test.js`・`TransformInputEditor.test.js`・`ShapeExtentReader.test.js`、`./test/shapes/`の該当ファイル（全文は読まず、`describe`・`it`（`test`）の名前の一覧と該当ケースだけを読む）、行236が挙げる`./js/`の対象）
  * **調査内容**（資料の `+` 行の合計 約7.9千字）:
    * 各行が挙げるテストファイルの存在、ケースの内容、件数（追加数・削除数と「計」）を今のテストファイルと照合する（前半・後半の境目は行208と209）。過去の時点の件数の扱い：`git show <コミット>:<パス>`で確かめられる範囲で確かめ、確かめられないものは「照合できなかった主張」にする（過去のコミットを取り出して実行しない）。
    * 行218・行224・行236（テストできない箇所）が挙げる対象を、コードとテストの有無で照合する。
    * 件数の最終値（tests 2470 / suites 401）は、プロジェクトのルートの`node --test`（ファイルを書き換えない実行）で実測して並べる。
    * Interruptで追加・削除・書き換えたケース（行220〜225）の記述を、今のテストと`git show b0d738d:<パス>`（Interruptの前）で照合する。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク17: 変わった・広がった・なくなったもの（要件2）の検索
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md`・`./_doc/arch/` 配下の全ファイル :（監査。差分のない行・差分のないファイルを含む。**名前・語の検索で見つかった箇所だけ**を読む）
    * 照合に使う主なコード :（監査。`./js/`・`./index.html`・`./test/` のうち、次の一覧の事実を確かめる範囲）
  * **調査内容**:
    * 洗い出し：`git diff --name-status cc72e0d d524ef1 -- js index.html test asset sprite-check.html` と、`git diff -U0 cc72e0d d524ef1 -- PROJECT_ARCHITECTURE.md _doc/arch` の `-` 行から、変わった・なくなった名前・値・言い回しを集める。**現在の実コードの事実**を先に確かめてから資料を検索する。次の一覧のほかに洗い出しで見つかったものも同じ手順で検索する。
    * 「資料に『今もそうである』と読める形で残っているか」を見る。「Phase 09 では」「Phase 10-01 の時点では」のように経緯・過去の状態として正しく書かれているものは相違としない。項目ごとに、確かめたコードの事実（`ファイル:行`）・検索した語・件数・判定（残り／経緯として正しい）を書く。
    * 一覧：
      1. **メソッド契約の数と`drawHandles`**：19メソッド → 18メソッド（Interruptで`drawHandles`を消した）。「17・18・19メソッド」「`drawHandles`」「`showHandles`」「ハンドルを描く」「選択（`V`）のハンドル」「到達不能の枝」「`dragHandle`の枝」と、直線の`move`・円と弧の図形ごとのハンドルの式が今もあると読める記述。
      2. **円・弧の読み方**：縦横に沿った半径だけの読み方 → 共役な半径（10-02）。「円・弧は回転を持てない」「`createTransformed`は回転で`Error`」「弧は上下に裏返らない」「半径は`points[1].x`と`points[2].y`から求める」と読める記述。
      3. **版**：作業データの版2 → 3、書き出し形式の版3 → 4（10-02）。「現行は版2」「版3まで」「`ellipse`は回転のキーを持たない」「版4は未連絡」と読める記述。
      4. **位置の欄**：線を含む外枠の左上 → 線を含まない外枠の基準点（10-03。頂点の選択（`A`）は今までどおり）。「位置は外枠の左上」「線の太さを変えると位置の欄の値が変わる」「位置の欄・ステータスバー・書き出しが同じ外枠」と読める記述。
      5. **回転の中心・外枠**：外枠の中心 → 基準点（10-03）。「回転の中心は常に外枠の中心」「大きさ・角度の欄は無い」「基準点は無い」「反転は無い」と読める記述。
      6. **オプションバー**：1行（高さ40px）→ 2行（`--toolbar-height` 80px、10-03）。「高さは1行固定」「残り約19px」「約1261px」「`y 68`」「40px」など1行を前提にした値・記述。
      7. **ドラッグ中の`Esc`**：キーボードの例外（10-01・10-02）。「ドラッグ中は`Esc`を受け付けない」「`cancel`は修飾キーなしだけ」と読める記述。
      8. **当たり分類**：頂点の選択（`A`）で頂点でないハンドルも当たりになる → 頂点だけ（Interrupt）。
      9. **`InputTracker.js`・`main.js` の行数**：2020行・1183行（計画時に`wc -l`で実測。実行時にも実測する）。
    * 差分のない行については名前・語の検索で見つかった箇所だけを扱い、記述全体の照合は行わない。
    * 差分の `+` 行に見つかった残りも5章へ書く（その行を照合するタスク1〜16と重複してよい。対象の資料の行番号を必ず添え、他のタスクの調査結果は読まない）。
  * **作業**（タスクごとに必ず行う）：
    * 実コードから読み取れる事実だけを4章の『事実』に書く。推測を含む場合はどこまでが事実でどこからが推測かを明示し、読み方が分かれる記述・照合できなかった主張（理由つき）とともに『推測・所見』に書く。
    * 相違は5章に「タスクn：」を添えて書く（作業は中断しない）。資料に無くコードにあるだけの事項は相違にしない。
    * 判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。「一致」には`ファイル:行`または検索した語と件数を添える。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。
* [ ] タスク18: 『開発資料との相違』の確認と、6章への一覧のまとめ（固定タスク。全調査タスクの後）
  * **対象ファイル**:
    * 本RES（4章・5章・6章） :（確認・追記）
  * **調査内容**:
    * 5章『開発資料との相違』を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。既知の傷1〜6（担当：1＝タスク2・3、2＝タスク8、3＝タスク5、4＝タスク6、5＝タスク12、6＝タスク11）が5章に挙がっているかも確かめ、挙がっていないものがあればその旨を6章に書く（調査はやり直さない）。
    * 4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。
    * 終わりに`git status`で、変更が調査計画書のRESファイルだけであることを確認する。

## 4. 調査結果
### タスク1: 1章（構成図・フォルダの責務・依存方向）と4章の表
* **調査内容**:
  * `PROJECT_ARCHITECTURE.md`の対象の`+`行（20・29・31〜33・36・41〜46・53〜55・65・78〜79・99〜102・106・129・131・136〜137・139・145・151・198〜200・221〜223・225・228・822〜825）を開き、`git ls-files js test asset`・`index.html`・`js/`のimport文の全件検索（`^import`・`from '`・`import('`。import文とJSDocの`import()`型参照は別に集計）・各ファイルのexport・`index.html`の要素と照合した。構成図は、図の木をスクリプトで解析して`git ls-files js test asset`と全件突き合わせた。
* **事実（実コードの記述）**:
  * 構成図（1章の木）：図に載るファイル169件（`PROJECT_ARCHITECTURE.md`・`PROJECT_CONSTITUTION.md`・`index.html`・`sprite-check.html`の4件を含む）と`git ls-files js test asset`の167件を突き合わせた。図にあって実在しないもの＝無し（上の4件はルートに実在）。実在して図に無いもの＝`asset/sprite/select-arrow.js`・`vertex-arrow.js`の2件だけで、図は`asset/sprite/`のコメントに2つのファイル名を書いている（一致）。`git diff --name-status cc72e0d d524ef1 -- js test`の`A`の17件（`js/`8・`test/`9）はすべて図にあり、置き場（`core/`・`edit/`・`palette/`、`test/core/`・`test/edit/`）も実在の場所と一致。テストの行129・131・136・137・139・145・151・198〜200は`test/core/`・`test/edit/`に実在。
  * 構成図の説明（行20・29・31〜33・36・41〜46・53〜55・65・78〜79・99〜102・106）：
    * 行20（`index.html`）：`#tool-eyedropper`（💉）・`#tool-select`・`#tool-vertex`（中身無し。`ToolIconWiring`が`<canvas>`を入れる＝`js/wiring/ToolIconWiring.js:28`）・`#unit-snap-group`（🧲のボタンと単位のボタン）・ツールバー2行（1行目＝操作・取り消し・削除/結合・スタイル・重なり順、2行目＝位置・大きさ・変形・整列・分布・角＝`index.html:530〜`の`.toolbar-row`2つ、`#option-size-group`566・`#option-transform-group`574）・`--toolbar-height: 80px`（`index.html:12`。定義は1か所）・ステータスバー右側＝表示の切り替え・スナップ・表示倍率の順（`index.html:617〜634`）。一致。
    * 行29：`CANCELABLE_DRAG_STATES`＝`[SCALING_SELECTION, ROTATING_SELECTION]`（`js/core/InputModes.js:32`）、`InputModes`はimportなし。一致。使う側の列挙は5章（タスク1）の相違（`ScaleHandleRules`が抜けている）。
    * 行31：`resolvePressAction(hit, isSelected, scaleHandle = null, rotationCorner = null)`＝外枠のハンドルは第3引数・回転の範囲の角は第4引数（`js/core/PressActionRules.js:35〜42`）。`InputTracker`から使う（`InputTracker.js:13`）。一致。
    * 行32：`CursorShapeRules`は`resolveScaleHandleCursor`（`ScaleHandleRules`）・`resolveRotationCursor`（`RotationRules`）をimport（`CursorShapeRules.js:7・8`）。`InputTracker`から使う（`InputTracker.js:14`）。一致。
    * 行33：`PointHitRules`のimportは`VertexHandleRules`の1件だけ（`PointHitRules.js:6`）。一致。
    * 行36：`UnitSnapRules`のimport元は`InputTracker.js:17`・`wiring/DisplayWiring.js:9`・`ScaleHandleRules.js:6`の3件で、列挙どおり（`UnitSnapSettings.js`にある語はコメントでimportではない）。一致。
    * 行41：`VertexHandleRules`のexport＝`collectVertexHandles`・`isVertexHandle`・`collectVertexHandlesInRect`・`computeVertexHandlesBounds`（記述の4つの働きと対応）。import元＝`PointHitRules.js:6`・`InputTracker.js:12`・`main.js:14`・`edit/PositionInputEditor.js:8`で列挙どおり。一致。
    * 行42：`NudgeTargetRules`のimportは`InputModes`のみ（`NudgeTargetRules.js:5`）。export＝`resolveNudgeTarget`・`buildNudgeGroupKey`。使う側の列挙は5章（タスク1）の相違（`PathCornerEditor`が抜けている）。
    * 行43：`ScaleHandleRules`のimportは`InputModes`・`UnitSnapRules`のみ（`ScaleHandleRules.js:5・6`）、`AffineTransform`は`import()`型参照だけ（同:317）。`collectScaleFrame`・`hitTestScaleHandle`・`resolveScaleHandleCursor`・`computeBoundsScale`・`toScaleTransform`・`collectFrameCorners`（97）・`computeFrameCenter`（112）が実在。使う側＝`InputTracker.js:18`・`CursorShapeRules.js:7`・`main.js:15`・`RotationRules.js:5`・`ReferencePointRules.js:5`・`edit/TransformInputRules.js:7`。一致（末尾の一文の読み方は『推測・所見』）。
    * 行44：`RotationRules`のimportは`ScaleHandleRules`（`SCALE_HANDLE_NAMES`・`hitTestScaleHandle`・`collectFrameCorners`）・`ReferencePointRules`（`resolveReferencePointPosition`）・`shapes/ShapeGeometry`（`applyAffineTransformToPoint`）のみ（`RotationRules.js:5〜7`）。`hitTestRotationZone`・`resolveRotationCursor`・`computeRotationAngle`・`toRotationTransform`・`resolveDisplayedScaleFrame`・`computeRotationCenter(frame, referencePoint)`（172。基準点を省く・名前でない値は外枠の中心＝`ReferencePointRules.js:59〜`）が実在。使う側＝`InputTracker.js:19`・`CursorShapeRules.js:8`・`main.js:16`・`edit/TransformInputRules.js:8`。一致。
    * 行45：`ReferencePointRules`のimportは`ScaleHandleRules`のみ（`ReferencePointRules.js:5`）。基準点9か所（`REFERENCE_POINT`の9エントリ）。使う側＝`RotationRules.js:6`・`TransformInputSettings.js:5`・`edit/PositionInputEditor.js:7`・`edit/TransformInputEditor.js:7`。一致。
    * 行46：`TransformInputSettings`のimportは`ReferencePointRules`のみ（`TransformInputSettings.js:5`）。生成は`main.js:87〜`の1か所。一致（保存しない・履歴の対象外は、`HistoryManager`・保存系へのimportが無い構造から確かめた範囲）。
    * 行53：`StatusReadoutRules`のimport元＝`wiring/DisplayWiring.js:6`・`edit/PositionInputRules.js:6`・`edit/TransformInputRules.js:6`。一致（`PositionInputEditor`にある語はコメント）。
    * 行54：`findCancelableDragBinding`のexport（`KeyboardShortcuts.js:234`）は`Shift`・`Alt`・`Ctrl`・`Meta`を読まずEscのcodeだけで判定。対応表の末尾（`KeyboardShortcuts.js:213・214`）が`Shift`+`H`・`Shift`+`V`の2エントリ。一致。
    * 行55：`DragTracker.cancel({ suppressClick = false } = {})`（`DragTracker.js:145`）。一致。
    * 行65：`applyAffineTransformToPoint`は`shapes/ShapeGeometry.js:236`のexportで、図形クラス5つの`createTransformed`が使う（`Line.js:325`・`Curve.js:379`・`Rect.js:358`・`Ellipse.js:703`・`Path.js:665`）。`core/RotationRules`も使う（`RotationRules.js:7・243〜`）。一致（「図形クラスだけが使う」と例外の一文の関係は『推測・所見』）。
    * 行78・79：`OptionBarSizeGroup.js`（幅・高さの数値の欄・比率の鍵）・`OptionBarTransformGroup.js`（角度の欄・基準点・反転）が実在し、責務の1行目が記述と同じ。`index.html:566〜590`に幅・高さの欄、比率の鍵（`#option-size-lock`）、角度の欄（`#option-angle`）、基準点の9つのボタン（`data-reference-point`）、反転の2つのボタンが実在。一致。
    * 行99〜102：`PositionInputRules`のimportは`core/StatusReadoutRules`のみ（`PositionInputRules.js:6`）。`TransformInputRules`のimportは`StatusReadoutRules`・`ScaleHandleRules`の`toScaleTransform`・`RotationRules`の`toRotationTransform`のみ（`TransformInputRules.js:6〜8`）。入力の数値の判定3行（文字列かつ空でない→`Number`→`Number.isFinite`）は`TransformInputRules.js:120〜126`の非公開`parseInputNumber`と`PositionInputRules.js:48〜52`にある。`PositionInputEditor`は`HistoryManager`を持たず`nudgeEditor.nudgeWithoutGrouping`へ任せる（`PositionInputEditor.js:48・75`）。`FLIP_AXIS`のexport（`TransformInputRules.js:21`）を`main.js:54`が使う。`TransformInputEditor`は`getSizeView`・`getTransformView`・`setSize`・`rotateBy`・`flip`を持つ。一致。
    * 行106：`ShapeExtentReader`は`getSelectedBounds`・`getSelectedGeometryBounds`（線を含まない外枠）・`getSelectedBoundsPerShape`（1つずつ）・`getAllBounds`を持つ（`ShapeExtentReader.js:37〜76`）。外枠のハンドルの位置の元は`main.js:221`の`getSelectedGeometryBounds()`。一致（基準点の基準になるのは`PositionInputEditor.js`・`TransformInputEditor.js`が`resolveReferencePointPosition`を使う形で確認）。
  * フォルダの責務：
    * 行221（`core/`）：`edit/`から`core/`のimportは`NudgeTargetRules`・`VertexHandleRules`・`StatusReadoutRules`・`ReferencePointRules`・`ScaleHandleRules`（`toScaleTransform`）・`RotationRules`（`toRotationTransform`）の関数だけ（`edit/`の`../core/`import全件）。`ScaleHandleRules`・`RotationRules`は`InputTracker`・`CursorShapeRules`と`main.js`の両方から使う（上の使う側）。状態を持つ設定＝`DisplayState`・`UnitSnapSettings`・`TransformInputSettings`・`CanvasCursorTracker`が実在。`InputTracker`の注入`getReferencePoint`は`main.js:196`、`InputTracker`は`ReferencePointRules`をimportしない。一致（`RotationRules`の使うものの読み方は『推測・所見』）。
    * 行222（`shapes/`）：`PathJoinRules`の`isJoinableLine`（81）・`isDrawnLineShape`（66）・`segmentKindsOf`（101）・`segmentSpecsOf`（115）・`lineEndpointOf`（208）・`endpointVertexIndexOf`（224）はexport、`chainSourceOf`（130）・`arcChainSourceOf`（162）は非公開。`PathSegmentKindRules`は`PathJoinRules`の`segmentKindsOf`・`segmentSpecsOf`を使う（`PathSegmentKindRules.js:7・95・116・147`）。`PathCornerRules`・`EndpointSnapRules`・`PathSegmentKindRules`が実在。一致。
    * 行223（`io/`）：`DocumentSerializer`・`CanvasStorage`・`DocumentFileIO`・`SpriteSerializer`（`computeShapesBounds`・`computeShapesGeometryBounds`＝線を含む・含まない）・`CodeExporter`（`toModuleText`・`extractSpriteDataText`）・`FileContentReader`の6ファイルで、`js/io/`の実在の全ファイルと一致。
    * 行225（`edit/`）：挙げられた`ShapeOrderRules`・`ShapeOrderEditor`・`NudgeEditor`・`PositionInputRules`・`PositionInputEditor`・`TransformInputRules`・`TransformInputEditor`・`ShapeAlignRules`・`ShapeAlignEditor`・`PathCornerEditor`・`ShapeExtentReader`・`StyleEyedropper`・`ClipboardController`が実在。`shouldRestoreSelection`（`SnapshotAdapter.js`）・`prepareSwitch`（`CanvasLibrary.js`）・`prepareInsert`（`CanvasFileOperations.js`）・`applyStyle`・`resetColors`（`ShapeStyleEditor.js`）・`#collectTargets`（`PathCornerEditor.js`）が実在。`edit/`に`InputModes`・`OperationMode`のimportは無い。`NudgeEditor`・`PositionInputEditor`・`TransformInputEditor`は`getMode()`の戻り値を`resolveNudgeTarget`へ渡すだけ（`NudgeEditor.js:90`・`PositionInputEditor.js:83`・`TransformInputEditor.js:134`）。`TransformInputEditor`・`NudgeEditor`は`editRecorder`を受け取る（`TransformInputEditor.js:59`・`NudgeEditor.js:50`）、`PositionInputEditor`は受け取らない。`ShapeExtentReader`の生成は`DisplayWiring.js:65`と`main.js:179`（`// 4.`＝`main.js:159`の節内。`renderCurrentState`のハンドル＝`main.js:221`、`InputTracker`の注入`getSelectionFrameBounds`＝`main.js:194`、`PositionInputEditor`＝`main.js:748`、`ShapeAlignEditor`＝`main.js:776`が共有）の2か所。生成の移動は`git show cc72e0d:js/main.js`（719行目）と`b5a5be0:js/main.js`（168行目）で確かめた。一致。
  * 依存方向（行228）：`js/`・`asset/`の`import`文を全件検索した（`import()`型参照は別に数えた）。
    * `core/`のimport文：`io/`・`edit/`・`palette/`・`wiring/`・`asset/`へのものは0件。`shapes/`へのimport文は`ShapeFactory.js:5〜9`（5件）と`RotationRules.js:7`（1件）で、ファイルは2つだけ。一致。
    * `import()`型参照：`core/`から`shapes/`へは`ScaleHandleRules.js:317`（1件）と`RotationRules.js:211・236`（2件）の2ファイルだけ。一致。
    * `io/`のimport文：`io/`内（`CodeExporter→SpriteSerializer`・`FileContentReader→DocumentSerializer・SpriteSerializer・CodeExporter`・`SpriteSerializer→DocumentSerializer`）と`DocumentSerializer.js:5`の`core/ShapeFactory`だけ。`edit/`へは0件。一致。
    * `palette/`・`asset/`：import文0件。一致。`check/ → io`：`SpriteCheckInspector.js:5`の`io/SpriteSerializer`のみ（ほかは`check/`内）。一致。
    * `wiring/`：`palette/`（`ViewToggleGroup`・`UnitSnapGroup`）・`edit/`（`ShapeExtentReader`）・`core/`・`asset/`をimport。`wiring/`をimportするのは`main.js:57・58`だけ。一致。
    * `edit/`のimport文：`shapes/`へは`PathJoiner.js:5`・`EndpointSnapper.js:6・14`・`PathCornerEditor.js:7・8`だけ。`core/`へは`NudgeEditor`・`PositionInputEditor`・`PathCornerEditor`・`PositionInputRules`・`TransformInputEditor`・`TransformInputRules`の6ファイルだけで、記述どおりの名前だけ（`VectorModel`・`HistoryManager`・`ShapeExtentReader`のimport文は0件）。`edit/`内のimport＝`ShapeStyleEditor`・`StyleEyedropper→StylePanelRules`、`ShapeOrderEditor→ShapeOrderRules`、`ShapeAlignEditor→ShapeAlignRules`、`PositionInputEditor→PositionInputRules`、`TransformInputEditor→TransformInputRules`の形で記述と同じ。一致。
    * `shapes/`内：`EndpointSnapRules→PathJoinRules`、`PathCornerRules→Path`、`PathSegmentKindRules→Path・Line・PathJoinRules・PathCornerRules`、`PathJoinRules→Path・Line`のみ。図形クラスは`ShapeGeometry`・`ShapeDataValidation`のみimport（規則のファイルへは0件）。一致。
    * `core/`内の例外：`PointHitRules→VertexHandleRules`（6）・`ScaleHandleRules→UnitSnapRules`（6）・`CursorShapeRules→ScaleHandleRules`（7）・`RotationRules→ScaleHandleRules`（5）・`CursorShapeRules→RotationRules`（8）・`ReferencePointRules→ScaleHandleRules`（5）・`RotationRules→ReferencePointRules`（6）・`TransformInputSettings→ReferencePointRules`（5）はすべて実在し、列挙に無い規則どうしのimportは0件。循環は無い。`RotationRules`は`computeFrameCenter`をimportしていない（`RotationRules.js:5`の名前に無い）。`core/`内の状態を持つ部品のimportは`InputTracker→DragTracker`の1件だけ（`InputTracker.js:7`）。`InputTracker`は`edit/`をimportしない。`InputTracker`のコンストラクタの第7引数`inputAssist`の注入の6関数は`main.js:189〜196`に実在。一致。
  * 4章の表（822〜825）：`_doc/arch/42_ScaleHandleRules.md`・`43_RotationRules.md`・`44_ReferencePointRules.md`・`45_TransformInputSettings.md`が実在し、`ScaleHandleRules.js`等が`js/core/`に実在。一致。
* **推測・所見**:
  * 行43の末尾「外枠の角の位置`collectFrameCorners`・外枠の中心`computeFrameCenter`（Phase 10-02）は`RotationRules`・`ReferencePointRules`（中心の式）・`edit/TransformInputRules`（`toScaleTransform`）からも使う」は、3つの使う側と2つの関数・`toScaleTransform`の対応が列挙の順にしか分からず、読み方が分かれる。実態は、`collectFrameCorners`を使うのは`RotationRules`、`computeFrameCenter`を使うのは`ReferencePointRules`だけで、`edit/TransformInputRules`が使うのは`toScaleTransform`。`RotationRules`が`computeFrameCenter`を使うと読める余地がある（実際は`RotationRules.js:167`のJSDocにあるだけ）。
  * 行221「`RotationRules`は`ScaleHandleRules`の外枠の角・中心・当たりを使う側」の「中心」は、`RotationRules`が直接使うのは角（`collectFrameCorners`）・当たり（`hitTestScaleHandle`）・名前（`SCALE_HANDLE_NAMES`）で、中心は`ReferencePointRules`経由（`RotationRules.js:172〜174`）。行228の「`RotationRules`は`computeFrameCenter`をimportしなくなった」と合わせて読めば矛盾しないが、行221だけを読むと直接使うと読める。行228のPhase 10-02の例外(1)も`computeFrameCenter`を挙げ、後のPhase 10-03の記述が打ち消す形になっている（階層的な読み方が必要）。
  * 行65「図形クラスだけが使う共通の関数」と、同じ行の「`core/RotationRules`も…使う」は、例外を書き添えた形で、文だけを読むと食い違うように読める。
  * `edit/TransformInputRules.js:137・170・184`は`shapes/ShapeGeometry`を`import()`型参照している（JSDocのみ）。行228は型参照の例外を`core/`の2か所だけと書き、`edit/`から`shapes/`への型参照は資料の例外に載っていない（資料に書かれていない事項のため相違とはしない）。
  * 照合できなかった主張：行20の見え方（`💉（仮）`・`🧲（仮）`の表示、ツールバー2行の収まり具合）は、要素・CSSの値の存在だけを確かめ、実際のブラウザでの見え方は確かめていない。行221の「置く理由：…ほかに置き場所が無く」は設計の理由で照合対象外。
### タスク2: 1章「存在しないもの」
* **調査内容**:
  * `PROJECT_ARCHITECTURE.md`行218（1段落）を開き、Phase 10-01〜10-03の「やらないこと」の列挙と「実装した」の但し書き、既知の傷1（版4の連絡）を、`js/`・`index.html`・`sprite-check.html`・`test/`の語の検索（`Grep`・`grep`）と該当ファイルの読み取りで照合した。行218は`git diff -U0 cc72e0d d524ef1 -- PROJECT_ARCHITECTURE.md`のハンク`@@ -201 +218 @@`で行全体が`+`行のため、前半（Phase 10より前の列挙）を含む行全体の列挙・括弧書きを1項目ずつ照合した（修正後の再照合）。項目は、段落の順に、(A)確認用ページ・書き出し・読み込み、(B)UIの部品・表示、(C)図形・重なり順・スタイル、(D)選択・修飾キー、(E)スナップ・カーソル・アイコン、(F)頂点・パス・弧、(G)整列・分布・微調整・位置の欄・書き出し、(H)Phase 10の3つの列挙、に分けて下の事実に書く。
* **事実（実コードの記述）**:
  * 既知の傷1（版4の連絡）：行218に「エンジンでの版4の確認と連絡票（Phase 10-04）」が2回現れる（10-02の列挙の中と10-03の列挙の末尾）。一方、同じ資料の行265は「版4への版上げ（Phase 10-02。`ellipse`の`rotation`の追加）は連絡済み**（Phase 10-04。エンジン本体（`oz/`）のコードの変更なしで…」と書く。相違（5章タスク2）。同じ行の「エンジンでの版3の確認と連絡票（Phase 09-04）」も、行265が「版3…は連絡済み（Phase 09-04）」と書くのと食い違う（`cc72e0d`時点の行218にも既にあった古い記述。5章タスク2）。
  * 10-01の列挙「回転・円と弧の回転・弧の上下の裏返し・円と弧のデータの持ち方の変更は10-02で実装した」：`js/shapes/Ellipse.js:38`（`rotation`）・`:696〜`（`createTransformed`。「弧の上下の裏返しは下半分の弧になる」・`Error`は投げない）・`js/io/DocumentSerializer.js:108・130`（`migrateVersion2To3`）・`SpriteSerializer.js:16`（版4・`rotation`）が実在。一致。
  * 10-01の列挙「変形の状態に入る操作」：`InputModes.js`の`InputState`は`SCALING_SELECTION`・`ROTATING_SELECTION`（ドラッグ中の状態）のみで、変形の状態に入る操作・モードを表す語（`TRANSFORM*`・`enterTransform`）の検索は0件。一致。
  * 「回転用のハンドル」：外枠の角の外側の範囲（`RotationRules.js:13`の`ROTATION_ZONE_SCREEN_PX`・`hitTestRotationZone`）で、専用のハンドル図形は描かない（`CanvasManager.js`の`scaleFrame`の描画は外枠とハンドルだけ）。一致。
  * 「傾き（シアー）・遠近」：`shear`・`skew`・`perspective`・`シアー`・`遠近`の検索は`js/`・`index.html`・`sprite-check.html`で0件（`傾き`は`Ellipse.js`の`rotation`・`MoveDirectionRules.js`・`RotationRules.js`の角度の説明のみ）。一致。
  * 「線の太さを拡大縮小・変形に合わせること」：5つの図形クラスの`createTransformed`はいずれも`this.strokeWidth`をそのまま渡す（`Rect.js:359`・`Ellipse.js:705`・`Line.js:328`・`Curve.js:380`・`Path.js:677`）。一致。
  * 「頂点の選択で選んだ頂点だけの拡大縮小・回転・反転」：`collectScaleFrame`は`mode !== SELECT`で`null`（`ScaleHandleRules.js:130`）。`TransformInputEditor.#resolveFrame`は`target.type === 'shapes'`のときだけ外枠を求める（`TransformInputEditor.js:134〜137`）。一致。「頂点の選択で円・弧に点を出すこと」（段落内に2回。09-03bの列挙と10-02の列挙）：`Ellipse.getVertexHandleNames()`は常に`[]`（`Ellipse.js:207〜209`）、`getHandlePosition`・`hitTestHandle`は常に`null`（`Ellipse.js:187〜199`）で、`collectVertexHandles`は`getVertexHandleNames()`の順にだけハンドルを集める（`VertexHandleRules.js:21〜27`）ため、円・弧には点が出ない。一致。
  * 「外枠のハンドルの端点への吸い付き」：`InputTracker.#applyScaleUpdate`（`InputTracker.js:1620〜1635`）は`UnitSnap`の刻み（`resolveUnitSnapStep`）だけを使い、`#snapAssist`（端点への吸い付き）は呼ばない。`ScaleHandleRules.js`のimportは`InputModes`・`UnitSnapRules`のみ。一致（拡大縮小の1px・グリッドの丸めは有る。資料の列挙は端点への吸い付きだけ）。
  * 「実装した」：基準点の選択（`index.html:581〜`の9つの`data-reference-point`・`main.js:196・920`）・幅と高さの欄（`index.html:566〜573`）・角度の欄（`index.html:575`）・反転のボタン（`index.html:589・590`）とキー`Shift`+`H`・`Shift`+`V`（`KeyboardShortcuts.js:213・214`）・位置の欄を線を含まない外枠にそろえる（`PositionInputEditor.js:86`の`getSelectedGeometryBounds`）・拡大縮小・外枠のハンドル・複数選択をまとめた拡大縮小（`InputTracker.js:1620〜`・`TransformInputEditor.js:136`）が実在。一致。
  * 10-02の列挙「回した角度・図形ごとの今の角度の表示」：描画の文字は定規の目盛り（`RulerRenderer.js:167・196`の`fillText`）だけ。ドラッグ中の外枠の傾き（`InputTracker.js:623`の`getRotationDragView`→`resolveDisplayedScaleFrame`）は有るが、角度の数値・図形ごとの角度の保持は無い。一致（外枠の傾き表示は「離すと縦横の外枠に戻る」と同じ段落の記述に沿う。離した後は`getRotationDragView`が`null`＝`InputTracker.js:624〜626`）。
  * 「回転用の専用のハンドル」「回転への1px・グリッドのスナップ・端点への吸い付き・スマートガイド（`Shift`の15°刻みだけ）」「`Shift`以外の刻み」：`#applyRotateUpdate`（`InputTracker.js:1646〜1656`）は`computeRotationAngle`へ`snapToStep: Boolean(event.shiftKey)`だけを渡し、`ROTATION_SNAP_STEP = Math.PI / 12`（`RotationRules.js:19`、15°）が唯一の刻み。`RotationRules.js:199`で丸める。`UnitSnapRules`・`snapAssist`は呼ばない。一致。
  * 10-03の列挙「基準点の印をキャンバスに出すこと」：`CanvasManager.js`に基準点を描く処理は無い（`referencePoint`・`ReferencePoint`の検索0件）。一致。「9か所以外の基準点」：`REFERENCE_POINT`は9エントリ（タスク1で確認済み）。一致。
  * 「外枠のハンドルの拡大縮小の動かない点を基準点にすること」：`InputTracker.#applyScaleUpdate`は`getReferencePoint`を使わない（`getReferencePoint`の使い道は回転の中心の`computeRotationCenter`のみ。`main.js:196`）。一致。
  * 「角度の欄の刻みとスナップ」：`index.html:575`の`#option-angle`は`step="any"`。一致。
  * 「ステータスバーの「大きさ」・整列・分布・書き出しの`bounds`を線を含まない外枠にそろえること」：`DisplayWiring.js:137`は`getSelectedBounds()`（線を含む）、整列は`getSelectedBoundsPerShape`（`ShapeAlignEditor.js:87・106`）、書き出しは`computeShapesBounds`（`DisplayWiring.js:189`の`getAllBounds`ほか）で、いずれも線を含む外枠のまま。線を含まない外枠（`getSelectedGeometryBounds`）の使い道は、位置の欄・外枠のハンドル・変形の数値入力だけ（`PositionInputEditor.js:86`・`TransformInputEditor.js:136`・`main.js:194・221`）。一致。
  * 「`Shift`+`H`・`Shift`+`V`以外の新しいキー」：`KeyboardShortcuts.js`の`Shift`必須（`REQUIRED`）のエントリは`Ctrl`+`Shift`+`Z`・`Ctrl`+`Shift`+`V`・`Shift`+矢印・`Shift`+`H`・`Shift`+`V`の5種で、Phase 10で足したキーは`Shift`+`H`・`Shift`+`V`だけ（`action`の一覧にも回転・拡大縮小用のものは無い）。一致。
  * 「オプションバーの出し分けと折りたたみ」：`OptionBar*Group.js`・`main.js`に`hidden`・`style.display`・折りたたみの処理は無く、グループは常に並び`disabled`で押せる条件を表す（`index.html:560〜592`）。ツールバーは`flex-wrap: nowrap`・`overflow: hidden`（`index.html:55・57・106・110`）で、行は折り返さない。一致。
  * 「基準点と比率の鍵の保存」：`TransformInputSettings`は`HistoryManager`・`io/`をimportしない（タスク1）。`js/`の`localStorage`・`sessionStorage`の検索は0件、`indexedDB`は`CanvasStorage.js`のみ（作業データの保存）。一致。
  * 前半（Phase 10より前の列挙。行218は行全体が`+`行のため、前半も1項目ずつ照合した。以下、項目→結果→確かめた場所。相違は既知の傷1（上）だけで、そのほかは一致。字義どおりに読むと足りない・広い記述は4章の所見に書いた）：
    * (A)確認用ページ・書き出し・読み込み：
      * 「エディタでのJSの実行（スプライトのJSはテキストから取り出すだけ）」：`js/`（`js/check/`を含む）に`eval(`・`new Function`・`Function(`の検索0件。動的`import(`の呼び出しは`js/check/SpriteCheckPage.js:168`（確認用ページ。Blob URLで読む）の1件だけで、エディタ側には無い。テキストから取り出す処理は`CodeExporter.extractSpriteDataText`（`CodeExporter.js:194〜210`。「`import`・`eval`・`Function`を使わない」と書く）で、`FileContentReader.js:60`が呼ぶ。一致（資料の主語は「エディタ」。確認用ページは選んだJSを実行する＝`sprite-check.html:70`の警告文・`SpriteCheckPage.js:165〜168`。所見に書く）。
      * 「本アプリが書き出した形以外のJSの読み込み・スプライトの`elements`からの図形の作り直し（`CodeImporter`は作らない）」：`CodeImporter`の検索0件。`FileContentReader.js:29`は「スプライトの`elements`・`bounds`は読まない（`source`だけを使う）」と書き、`FileContentReader.js`・`DocumentSerializer.js`・`js/edit/CanvasFileOperations.js`・`CanvasLibrary.js`の`elements`の検索は`FileContentReader.js:29`のコメントの1件だけ。一致。
      * 「確認用ページでの拡大縮小・移動・編集・複数ファイルの同時表示・組み立て用のJSの表示」：`js/check/`のイベントの購読は、ファイル入力の`change`と`window`の`resize`だけ（`SpriteCheckPage.js:84・89`）で、`wheel`・マウス系の購読0件。ファイル入力は`multiple`なし（`sprite-check.html:71`。`multiple`の検索0件）。表示の項目はファイル名・版2つ・描画要素の数・外枠の5つだけ（`sprite-check.html:72〜78`）。一致。
      * 「エディタから確認用ページへのリンク」：`index.html`・`sprite-check.html`に`<a `・`href=`・`window.open`の検索0件（`<a download>`はダウンロードの内部生成＝`DocumentFileIO.js:171・173・187`のみ）。`location.`は`main.js:1079`の`?dev`の判定だけ。一致。
      * 「組み立て用のJSの書き出し（アニメーションエディタモードのPhase）」「複数キャンバスの一括出力」：書き出しのボタンは`#canvas-export`（作業データ）・`#canvas-export-sprite`（スプライトJS）の2つだけ（`index.html:660・661`）。`animation`・`アニメ`の検索0件、`exportAll`・`batch`・`allCanvas`の検索0件（`一括`は`InputTracker.js`の一括削除の説明のみ）。一致。
      * 「スプライトのJSON（`<名前>.json`）の出力・読み込み・確認用ページでのJSONの表示（04-04でやめた。スプライトはJSだけ。`.json`は作業データファイル）」：スプライトのファイル名は`<名前>.js`だけ（`DocumentFileIO.js:22・142〜148`）、`.json`は作業データ（`.ozve.json`＝`:10`。開くときの拡張子の除去＝`:67`）。確認用ページの`accept`は`.js,text/javascript`（`sprite-check.html:71`）。開くときの`accept`が`.json,.js`（`index.html:666・667`）なのは作業データの`.json`を開くため（`FileContentReader.js:17`が先に作業データとして読む）。一致。
      * 「PNG・SVG等の形式」：`toBlob`・`toDataURL`・`image/png`の検索0件。`svg`は`RotationRules.js:38・62・63`（回転のカーソル画像のdata URL）だけで、書き出し・読み込みの形式ではない。一致。
      * 「独自のカラーピッカー（色はブラウザ標準の`<input type="color">`）」：`colorPicker`・`ColorPicker`の検索0件。`type="color"`は`index.html:546・548`（`:415`はCSSの選択子）。一致。
    * (B)UIの部品・表示：
      * 「プロパティパネル（07-02でオプションバーへ移してなくした）」：`PropertyPanel`の検索0件。`index.html`のフロートウィンドウは`#window-tool-palette`・`#window-canvas-palette`・`#window-dev-panel`の3つ（`:635・653・673`）で、スタイルの欄はツールバーの`#option-style-group`（`:544〜551`）。一致。
      * 「オプションバーの「選択中：n個」「次に描く図形」の表示」：`次に描く`の検索0件。`index.html`の`選択中`は`#selection-delete`・`#selection-join`の`title`だけ（`:541・542`）で、オプションバーにそのテキストの要素は無い。「選択の有無はキャンバス上のハンドルで見分ける」の描画は`CanvasManager.js:281〜`（頂点のハンドル）・`:312〜`（外枠のハンドル）が実在（見え方は照合対象外）。一致。
      * 「ツールバー・ステータスバーの折り返し・横スクロール・項目の省略メニュー（ツールバーは2行・ステータスバーは1行で固定し、各行の収まらない右側は切れる）」：`.toolbar, .status-bar`は`flex-wrap: nowrap`・`overflow: hidden`・`white-space: nowrap`（`index.html:48〜58`）、`.toolbar-row`も同じ（`:100〜111`）、`class="toolbar-row"`は2つ（検索2件）、高さは`--toolbar-height: 80px`の固定（`:12`・`.toolbar`の`height`）、ステータスバーは`<footer id="status-bar">`の1行（`:609〜`）。`overflow-y: auto`（`:340`）・`text-overflow: ellipsis`（`:325・356`）は別の要素（キャンバスの一覧・名前の表示）。メニューの要素（`<select>`・`<details>`・`dropdown`）の検索0件。一致。
      * 「フロートウィンドウの位置・表示状態の保存」「動かせる範囲の制限」：`WindowManager.js`は`style.left`・`style.top`へ移動量を足すだけ（`:109・110・140・141`）で、`innerWidth`・`clientWidth`による範囲の制限の検索0件。`localStorage`・`sessionStorage`は`js/`全体で0件、`indexedDB`は`CanvasStorage.js:82・88`（作業データと最後に開いたキャンバスのid＝`:190・202`）だけ。一致。
      * 「表示の状態（アウトライン・背景・グリッド・パレットの表示）の保存・履歴の対象化」：`DisplayState.js`はimport0件で、持つのは`#outline`・`#darkBackground`・`#gridVisible`・`#floatWindowsVisible`（`:22〜40`）。`SnapshotAdapter.js:59〜65`の`capture`は`document`と`selectedIds`だけで、`js/io/`・`HistoryManager.js`・`SnapshotAdapter.js`に`displayState`・`DisplayState`・`outline`の検索0件。一致。
      * 「定規の表示・非表示の切り替え・ガイド・定規からのドラッグ・定規の原点の変更・単位の切り替え」：定規の要素は`#ruler-horizontal`・`#ruler-vertical`・`#ruler-corner`（`index.html:527〜529`）。`RulerRenderer.js`は`addEventListener`0件で、`js/`が定規のidを参照するのは`main.js:74`（`RulerRenderer`の生成）だけ。`KeyboardShortcuts.js:150〜214`のaction一覧に定規のactionは無い。`guide`・`ガイド`・`origin`・`unit`の検索は`RulerRenderer.js`・`RulerTickRules.js`で0件。表示の切り替えは▢◐▦の3つだけ（`index.html:620〜622`）。一致。
      * 「全体を画面に収めるキー・100%で表示する専用のキー（`Ctrl`+`1`。表示のリセットの`Ctrl`+`0`は表示倍率を100%へ戻す）・選択中の図形だけを画面に収める操作」：`Digit1`は`ctrl: false`の図形のツール（`KeyboardShortcuts.js:154〜161`）で、`ctrl: true`の`Digit1`は0件。⛶は`#view-fit`（`index.html:630`。`DisplayWiring.js:99`）でキーなし。収める対象は全図形（`DisplayWiring.js:187〜194`の`getAllBounds`）で、選択中だけを収める操作の検索0件。`Ctrl`+`0`は`KeyboardShortcuts.js:162`→`main.js:306〜308`の`viewTransform.reset`→`ViewTransform.js:158〜170`で`#scale = 1`（100%）。一致。
      * 「白・黒以外の背景・図形の色を背景に合わせて変えること・ダークモード（定規・バー・ウィンドウの配色の切り替え）」：配色の組は`light`・`dark`の2つ（背景`#ffffff`・`#000000`＝`CanvasManager.js:21〜37`）。`prefers-color-scheme`・`ダーク`・`dark-mode`の検索0件。`darkBackground`を使うのは`CanvasManager.js:216`・`main.js:217`・`ViewToggleGroup.js:11・29`・`DisplayState.js`だけで、バー・ウィンドウ・定規の配色は切り替わらない。配色の組が決めるのは背景・グリッド・軸・アウトライン表示の線の色で、図形の`strokeColor`・`fillColor`は変えない（`CanvasManager.js:216`以降）。一致。
    * (C)図形・重なり順・スタイル：
      * 「重なっている図形だけを数える前へ・後ろへ、離れた選択図形をまとめる重なり順の変更」：`ShapeOrderRules.js:43〜44`「選択中の各要素は並びの上で隣の1つ分だけ動き（重なっているかは見ない）、離れた選択中の要素はまとまらず…」、`reorderSelected`（`:59〜`）の前へ・後ろへは隣との入れ替え。一致（最前面へ・最背面へ＝`:64〜`は選択中の図形が末尾・先頭に連続して並ぶ。所見に書く）。
      * 「図形の一覧・ドラッグによる並べ替え（図形の一覧のPhase）」：`ShapeList`・`shape-list`・`図形の一覧`・`draggable`・`dragstart`（DOMのイベント）の検索0件（`DragStart`は`InputTracker.js`の`#onLeftDragStart`等のメソッド名のみ）。一致。
      * 「直前に使った値（新しく描く図形のスタイル）の保存・キャンバスごとの既定の色」：`VectorModel.js:150`「保存せず、履歴の対象外」、`#newShapeStyle`は起動時に`DEFAULT_NEW_SHAPE_STYLE`（`:40`）から始まるメモリ上の値（`:170`）。`localStorage`の検索0件、`js/io/`に`newShapeStyle`・`NewShapeStyle`の検索0件。一致（メモリ上の「直前に使った値」は有り、資料が「存在しない」とするのはその保存）。
      * 「塗った内側による範囲選択（範囲選択は輪郭のみ）」：範囲選択の確定は`shape.intersectsRect`（輪郭線が矩形に掛かるか。`InputTracker.js:1785`・`Rect.js:132〜134`の説明）だけで、`hitTestFill`を呼ぶのは`PointHitRules.js:72`（クリックの当たり）だけ。一致。
      * 「弧・曲線（今の曲線`curve`）・直線・開いたパス（開いた曲線のパスを含む）の塗り（塗れるのは`rect`・`circle`・閉じた`path`のみ。閉じた曲線のパスは塗れる）」：`isFillable()`は`Rect.js:53`が`true`、`Ellipse.js:99〜100`が`this.type === 'circle'`（弧は偽）、`Line.js:49〜50`・`Curve.js:59〜60`が`false`、`Path.js:174〜175`が`this.closed === true`（区間の種類を見ないため閉じた曲線のパスも塗れる。塗りの形は`#fillPolygon`＝`Path.js:270・371`）。一致。
      * 「透明度・グラデーション」：`globalAlpha`・`createLinearGradient`・`createRadialGradient`・`createConicGradient`の検索0件。`rgba(`は`CanvasManager.js`の配色・選択矩形（`:73`）・`Rect.js:258`のホバーの線の色など表示用で、図形のデータの色ではない（図形の色はスタイルの`strokeColor`・`fillColor`の文字列）。`opacity`は`index.html:275・470・485`のCSSだけ。一致。
      * 「レイヤー、グループ化」：`レイヤ`・`layer`・`Layer`・`groupShapes`・`ungroup`・`グループ化`の検索0件（`group`は`toolbar-group`等のCSSのクラスと、履歴のまとめの`HistoryManager`・`NudgeEditor`の語）。一致。
      * 「`package.json`・`node_modules`・ビルド手順」「テストの自動実行（保存時・コミット時のフック、CI）」「画面の操作や描画のテスト」：`git ls-files`に`package.json`・`.github`・`.husky`・`.yml`・`.yaml`が無く、`node_modules`も無い。`.git/hooks`は`.sample`のみ、`.vscode/`は`.gitignore`済み（`settings.json`に`test`・`task`・`runOnSave`の記述0件）。`.claude/settings.local.json`に`hooks`0件。`test/`に`getContext`・`new CanvasManager`・`jsdom`・`puppeteer`・`playwright`の検索0件（`document.`は`HistoryManager.test.js:18`の`snap.document`だけ）。一致。
    * (D)選択・修飾キー・ドラッグ：
      * 「`Shift`+クリックでの選択の追加」「`Ctrl`+範囲選択での解除（範囲選択の`Ctrl`は追加だけ）」：`InputTracker.js`の`shiftKey`の参照は`:873`（直線・曲線の付いてくる線）・`:1604`（本体の移動）・`:1628`（拡大縮小）・`:1654`（回転）だけで、クリック・範囲選択では読まない。範囲選択の`Ctrl`は`resolveMarqueeSelection`の追加だけ（`SelectionRules.js:46〜66`）。一致。
      * 「選択集合外の図形の押してそのままのドラッグ・`Alt`+ドラッグ（1回クリックで選んでから）」：`PressActionRules.js:44〜52`は選択集合外の本体の押下を`null`（何も始めない）にし、`Alt`の複製は選択集合の本体ドラッグ（`moveSelection`）の押下時にだけ記憶する（`InputTracker.js:1419〜1426`）。一致。
      * 「`Shift`での正方形・正円の作成」：図形のツールで`shiftKey`を読むのは`InputTracker.js:873`（直線・曲線のツールの付いてくる線の先）だけで、矩形・円・弧の作成に`shiftKey`の参照は無い。一致。
      * 「ドラッグの途中での`Alt`の切り替え（押した時点の`Alt`で決まる）」：本体の移動の複製は押した時点の`event.altKey`を`#duplicateOnMove`へ記憶し以後は読まない（`InputTracker.js:326・330・1426`）。一致（拡大縮小は追従のたびに`:1629`で読む。所見に書く）。
      * 「頂点のハンドルのドラッグでの`Shift`の限定（`Shift`が効くのは本体の移動と、直線・曲線のツールで線を引いている途中の付いてくる線の先だけ。3章3.・16.・22.）」「頂点のドラッグでの`Shift`による方向の限定」：頂点のハンドルのドラッグは「Shiftは頂点のハンドルには効かせない」（`InputTracker.js:1521`）。`#resolveMoveDelta`（`:1602`）を呼ぶのは本体の移動（`:1548`）だけ。3章3.・16.・22.の節は`PROJECT_ARCHITECTURE.md:361・559・669`に実在し、題名もそれぞれ入力監視・選択と移動・線を続けて引く操作。一致（「だけ」はPhase 10後は一般の文として読むと古い。所見に書く）。
      * 「複数の頂点（2つ以上）を選んでいるときの端点への吸い付き（1つだけ選んでいるときだけ働く）」「範囲選択で図形そのものを選ぶこと・頂点が出ていない図形の頂点を範囲選択で選ぶこと」：端点への吸い付きは`#dragEndpoint`があるときだけ（`InputTracker.js:1522`。`:351`）。頂点の選択の範囲選択は`collectVertexHandlesInRect`で選択中の図形の頂点だけを集め、図形の選択を変えない（`InputTracker.js:1747〜1779`）。一致。
      * 「カーソルがキャンバスの外へ出たときのホバーの強調の解除」：`InputTracker.js`の購読は`mousemove`・`mousedown`・`click`・`wheel`・`keydown`・`keyup`・`window`の`blur`だけ（`:500〜510`）で`mouseleave`0件。`mouseleave`は`CanvasCursorTracker.js:52`だけで、カーソル位置を「なし」にするだけ（`:105`）。一致。
      * 「`D`での太さの変更（`D`は色だけ）」：`D`は`resetColors`（`KeyboardShortcuts.js:194`）で、値は`RESET_COLORS_STYLE`＝`strokeColor`・`fillColor`だけ（`StylePanelRules.js:75`）。一致。
      * 「スポイトの連続の取り込み（1回取り込むと待ち受けがやむ）・取り込む項目を選ぶUI・画面の色からの取り込み・押している間だけ働く一時的なスポイト」：`StyleEyedropper.pickFrom`は取り込んだ後に`this.stop()`（`StyleEyedropper.js:114〜123`）。取り込む値は線の色・太さと（塗れる図形の）塗りの色の固定（`StylePanelRules.js:135〜141`）で、選ぶUIの検索0件。`EyeDropper`（画面の色の取得のAPI）の検索0件。`keyup`の購読は`AltKeyGuard.js:38`と`InputTracker.js`のスペース（`:1225〜`）だけで、スポイトは`I`のkeydown（`KeyboardShortcuts.js:196`）で待ち受けを始める。一致。
      * 「`Ctrl`＋矢印・`Alt`＋矢印への割り当て（ブラウザ・OSの操作を通すため一致させない。`Shift`＋矢印は「10px動かす」で占めた…）」：矢印のエントリは`ctrl: false`で`Shift`なし1px・`Shift`10px（`KeyboardShortcuts.js:109・197〜210`）、`Alt`は`#findBinding`が常に不一致（`:341〜343`）。一致。
    * (E)スナップ・カーソル・アイコン：
      * 「スナップの設定（ON/OFF・単位）の保存・履歴の対象化・キャンバスごとの設定」：`UnitSnapSettings.js:35〜36`「作業データ・履歴・ブラウザの保存先には含まれず…ページを開き直すと初期値（ON・1px）に戻る」、`js/io/`・`SnapshotAdapter.js`にスナップの設定の語の検索0件。一致。
      * 「1px・グリッド10px以外の単位・単位の数値の入力欄・画面のグリッドの線の間隔に合わせる単位」：単位は`pixel: 1`・`grid: 10`の2つだけ（`UnitSnapSettings.js:12・13・22〜25`）、グリッドの10は固定値で画面のグリッドの間隔の規則とは別（`:17〜21`の説明）。`index.html`の数値の欄は6つ（線の太さ・位置のXY・幅・高さ・角度）でスナップの単位の欄は無い。一致。
      * 「スナップのキー」「`Ctrl`以外の修飾キーでの一時無効・キーの購読による即時の反映（`Ctrl`を押した・離しただけでは反映せず、次のマウスの移動・`wheel`で切り替わる）」：`KeyboardShortcuts.js`のaction一覧にスナップのactionは無い。丸めを止めるのは`resolveUnitSnapStep(…, hasCtrlModifier(event))`（`InputTracker.js:176・1603・1630`）で、`Ctrl`を読むのはマウス・`wheel`のイベントだけ。`handleKeyUp`は`Space`以外を無視する（`:1225〜1228`）。`Ctrl`の状態は`CanvasCursorTracker.js:96・100`（`mousemove`）。一致。
      * 「丸めた位置を示す表示・定規の印を丸めた位置へ動かすこと」：キャンバスに描く吸い付きの印（`CanvasManager.js:91〜103`）は`model.setSnapPoint`の位置で、これを呼ぶのは端点への吸い付きの`#showSnap`（`InputTracker.js:837`）だけ。丸めた位置の印は描かない。定規の印は丸めないカーソル位置のまま（`DisplayWiring.js:122`のコメント）。一致（ステータスバーの座標の表示は丸めた値を出す＝`DisplayWiring.js:127・128`。「丸めた位置を示す表示」の範囲は所見に書く）。
      * 「既存の図形・読み込み・出力・貼り付けのずらし量の丸め」：`roundDeltaToUnit`・`roundPointToUnit`・`Math.round`の呼び出しは`js/edit/`・`js/io/`・`js/shapes/`に0件（`UnitSnapRules`のimportは`InputTracker.js:17`・`ScaleHandleRules.js:6`・`DisplayWiring.js:9`だけ）。一致。
      * 「曲線の作成時の制御点の丸め（今の曲線`curve`は曲線のツールで作られなくなったため該当する操作が無い。Phase 09-01a）」：曲線のツールは頂点2つ・区間1つの曲線のパス（`type`は`'path'`）を作り、今の曲線は`fromJSON`でのみ作られる（`ShapeFactory.js:17・33`）。一致。
      * 「ツールごとのカーソルの形の切り替え（カーソルの形の規則は操作モードの分岐だけ）」：`resolveCursorShape`（`CursorShapeRules.js:60〜`）の入力に図形種別は無く、`mode`で`crosshair`（作成）・`grab`（キャンバス移動）に分かれる。一致（括弧書きの「操作モードの分岐だけ」は、実際には`isPanning`・`isSpacePressed`・`state`・`hit`・`scaleHandle`・`rotationCorner`も読むため、字義どおりには足りない。所見に書く）。
      * 「選択・頂点の選択以外のツールのアイコンの差し替え（スポイト・キャンバス移動・図形のボタンは今までの文字のアイコン）」「アイコンの`devicePixelRatio`の変化・ウィンドウの移動での描き直し（起動時に1回だけ描く）」：`ToolIconWiring.js`の`import`は`select-arrow.js`・`vertex-arrow.js`の2つだけ（`:5・6`）、`index.html:639・640`の2つのボタンだけが空で、`#tool-pan`・`#tool-eyedropper`・図形のボタンは文字（`:641・642・645〜649`）。`ToolIconWiring.js`に`addEventListener`・`matchMedia`・`resize`の検索0件、呼び出しは`main.js:404`の1回。一致。
      * 「`main.js`への操作モードの判定の追加（削除ボタンの見た目を頂点の選択で変えない。3章18.）」：`syncDeleteButtonState`は選択集合の有無だけ（`main.js:322〜324`）で、`deleteSelection`は選択モード以外で`false`（`InputTracker.js:642〜645`。頂点の選択のときは押しても何も起きない）。3章18.は`PROJECT_ARCHITECTURE.md:598`（頂点の選択）に実在し、行599〜に(8)として同じ内容を書く。一致（`main.js`に`getMode()`・`OperationMode`を使う箇所は他にあるが削除ボタンとは無関係。所見に書く）。
    * (F)頂点・パス・弧：
      * 「頂点の削除」「パスの分割」：`removeVertex`・`deleteVertex`・`splitPath`・`頂点の削除`の検索0件（`分割`は`Curve.js`・`Ellipse.js`・`Path.js`の折れ線近似の分割数のみ）。一致。
      * 「区間の切り替えのハイライト表示」「角の点をキャンバス上で見分ける表示・角の点の方向線（ハンドル）」：`CanvasManager.js`に`segment`・`区間`の検索0件、頂点のハンドルは角・なめらかを区別しない同じ四角（`CanvasManager.js:281〜`、`VertexHandleRules.js:21〜27`）。`Path.js:118`「引っ張る点は頂点ではない（ハンドルにならない）」。一致。
      * 「区間の切り替えのキー（「直線に」「曲線に」のボタンだけ）」「角の切り替えのキー（「角」のチェックボックスだけ）」：`KeyboardShortcuts.js`のaction一覧に無い。ボタンは`#option-segment-to-line`・`#option-segment-to-curve`（`index.html:603・604`）、チェックボックスは`type="checkbox"`の1つ（`index.html:605`の`option-corner-label`）。一致。
      * 「「曲線に」で足す点以外の頂点の追加」「「直線に」で点を消すこと」「今の曲線の「曲線に」」：パスの「曲線に」が足すのは変わる区間の中点だけ（`PathSegmentKindRules.js:145〜`の`buildCurvedPath`）、パスの「直線に」は「点は足さない・消さない」（`:190〜`の`buildStraightenedPath`）、今の曲線の「曲線に」は何も変えない（`:225`）。一致（今の曲線の「直線に」は制御点を捨てる＝`:202〜`の`buildLineFromCurve`。所見に書く）。
      * 「曲がり方を持つ区間と隣の区間のつなぎ目をなめらかにすること」「直線の区間と曲線の区間のつなぎ目をなめらかにすること（つなぎ目は常に角）」：`PathCornerRules.js:65〜80`の`cornerStateOfData`は両側が打った点の曲線の区間（`SEGMENT_KIND_SMOOTH`）の点だけを`CORNER`・`SMOOTH`にし、片側でも直線の区間・曲がり方を持つ区間なら`LINE_CORNER`（操作できない）。一致。
      * 「今の曲線への制御点の追加・削除」「結合でまとめた端点の側の引っ張る点を動かすこと」「曲線の方向のハンドル（引っ張る点の表示・ドラッグでの直接の操作）・区間をクリックして選ぶ仕組み・引きながらの直線と曲線の切り替え」：今の曲線の頂点のハンドルは`['start', 'control', 'end']`の固定（`Curve.js:179〜181`）で追加・削除の処理が無い。パスの引っ張る点はハンドルにならない（`Path.js:118`）。当たり判定は図形・頂点のハンドルだけを返し、区間を選ぶ処理の検索0件。一致。
      * 「頂点2つの閉じた形（今の曲線1本と直線1本の半月形・今の曲線2本のレンズ形）」「弧1本の閉じる（同じ弧の両端の間を途中の点なしで引いても何も起きない）」：閉じられるのは頂点3つ以上の開いたパス1本だけ（`PathJoinRules.js:20`の`CLOSED_MIN_POINTS = 3`・`:274〜285`の`classifyJoin`・`:300`の`buildClosedPath`（「今の曲線・弧1本は`null`」＝`:294`）・`:440〜443`の`canCloseByMergingEnds`）。一致。
      * 「描いている間に元の線を含めた結合後の形を見せる仕組み（Phase 09-01b）」：`CanvasManager.js:261〜263`は作成中の図形（`draftShape`）の輪郭だけを描き、`preview`・`プレビュー`の検索は`CanvasManager.js`・`VectorModel.js`で0件。一致。
      * 「弧自身の端のハンドルのドラッグでの吸い付き・結合（弧は頂点のハンドルを持たず、半径のハンドルも無い。Phase 09-03bで決定）」：弧は`getVertexHandleNames()`が`[]`・`hitTestHandle`が`null`（`Ellipse.js:187〜209`）、`endpointVertexIndexOf`は弧に`null`（`PathJoinRules.js:225`）。半径のハンドルの名前・処理は`Ellipse.js`に無い。一致。
      * 「結合で弧の形を誤差なく保つこと（楕円の4分の1の近似で半径の約0.03%のずれを許す）」：弧は楕円の4分の1ごとの3次ベジェで表し（`PathJoinRules.js:34〜40`の`QUARTER_ELLIPSE_BEZIER_K = 4 * (Math.SQRT2 - 1) / 3`）、外側へ最大で半径の約0.027%と書く。一致（約0.03%の丸め）。
      * 「弧の角度の変更」「弧のツールで描くときの吸い付き」：`startAngle`・`endAngle`を代入するのはコンストラクタ（`Ellipse.js:71・74`）と回転・反転の`createTransformed`（`:249〜293`）だけで、弧の角度を入力・編集する処理は無い。`isSnapDrawShapeType`は`'line'`・`'curve'`だけ真（`EndpointSnapRules.js:46〜48`）で、弧のツールは`findDrawSnap`が`null`（`EndpointSnapper.js:89〜92`）。一致。
      * 「パスを開く／閉じる」：専用の「開く／閉じる」の操作・ボタンは無く、閉じたパスを開く処理の検索0件。閉じるのは「結合」（`J`）が開いたパス1本を閉じる経路（`PathJoinRules.js:277〜280`・`:300`）と、線を引いている途中の始点への吸い付きで閉じる経路（`:732〜736`）。一致（字義どおりには「閉じる」の経路は有る。所見に書く）。
      * 「頂点の選択の保存・履歴の対象化・書き出し」：`selectedVertices`は`VectorModel.js:137`のメモリ上の状態で、`js/io/`・`SnapshotAdapter.js:59〜65`・`HistoryManager.js`に`selectedVertices`・`SelectedVertices`の検索0件。一致。
      * 「ドラッグによるフリーハンドの線・`Enter`や`Ctrl`＋クリックでの線の終了・線を引いている途中の「やり直し」で点を戻す仕組み（取り消しは点を戻す。やり直しは捨てる）」：`freehand`・`フリーハンド`・`Enter`の検索は`KeyboardShortcuts.js`・`InputTracker.js`で0件、線を終えるのは`Esc`（`InputTracker.js:852`・`finishLineDrawing`＝`:760`）・図形のツールの切り替え（`main.js:463〜493`）で、`Ctrl`はクリックでは吸い付きを止めるだけ（`:1084・1190`）。取り消しは最後の点を消す（`removeLastLinePoint`＝`:769〜`、`main.js:129`）、やり直しは`abortOngoingOperation`で作成途中を捨ててから`historyManager.redo`（`main.js:152〜156`）。一致。
    * (G)整列・分布・微調整・位置の欄・書き出し：
      * 「ツールパレット等への微調整のボタンの追加」：`index.html`に`nudge`の検索0件（微調整は矢印キーだけ）。一致。
      * 「整列・分布へのキーの割り当て（ボタンだけ）」「頂点の選択（`A`）で選んだ頂点をそろえる機能（整列・分布の対象は図形だけ）」「基準にする図形（キーオブジェクト）・キャンバスを基準にした整列」「指定した間隔の分布（すき間の数値入力）」「中心の間隔をそろえる分布（そろえるのは外枠どうしのすき間）」：整列・分布のactionは`KeyboardShortcuts.js`に無く、ボタンは`index.html:593〜600`の8つ。`ShapeAlignEditor.js`は`selectedVertices`・`keyObject`を参照せず、図形の外枠だけを使う（importは`ShapeAlignRules.js`のみ＝`:5`）。分布は「すき間＝（全体の長さ−各図形の長さの合計）／（個数−1）」（`ShapeAlignRules.js:129・149〜150`）。数値の欄に分布のすき間の欄は無い（上の6つ）。一致。
      * 「微調整・位置の欄・整列・分布の結果でのスナップの丸め・端点への吸い付き」：`NudgeEditor.js:6`・`PositionInputEditor.js:6〜9`・`ShapeAlignEditor.js:5`のimportに`UnitSnapRules`・`EndpointSnap*`が無い。一致。
      * 「位置の欄の値の保存」：`PositionInputEditor.js`・`PositionInputRules.js`に保存先（`localStorage`・`HistoryManager`・`io/`）のimport・参照0件。一致。
      * 「書き出しの際の座標の丸め」：`js/io/`・`js/shapes/`に`Math.round`・`toFixed`の検索0件。一致。
      * 「性能の改善を目的とした変更」「どのサブフェイズで「今回やらないこと」と決めたかは`_log/req/`・`_log/res/`とgitが正本（同じ項目が複数のサブフェイズに挙がっていたものは1つにまとめた）」：意図・方針の記述でコードの振る舞いとして確かめられない。照合対象外（「照合できなかった主張」）。
      * 「作業データ・書き出し・履歴のエントリの形・版は、Phase 8のどのサブフェイズでも変えていない」：現在の版（作業データ3・書き出し4＝`DocumentSerializer.js:108・130`・`SpriteSerializer.js:16`）はPhase 9・10で上げたもので、Phase 8より後の版上げと矛盾しない。Phase 8の間に変えていない点は、コミットの履歴の確認が必要で、本タスクでは過去のコミットの比較を行っていないため照合できなかった。
    * (H)Phase 10の3つの列挙（10-01・10-02・10-03）：上の行394〜410で照合済み。
* **推測・所見**:
  * 「頂点のハンドルのドラッグでの`Shift`の限定（`Shift`が効くのは本体の移動と、直線・曲線のツールで線を引いている途中の付いてくる線の先だけ。3章3.・16.・22.）」の「だけ」は、`Shift`が頂点のハンドルのドラッグに効かないことを述べる文脈だが、Phase 10で`Shift`は拡大縮小のドラッグの縦横比の保持（`InputTracker.js:1628`）・回転のドラッグの15°刻み（`:1654`）にも効く。「`Shift`が効くのは…だけ」を一般の文として読むと古い。文脈（頂点のハンドルのドラッグ）で読めば矛盾しない。相違にはせず所見とする（行218の同じ段落で`Shift`の15°刻みを「やらないこと」の例外として別に書いている）。
  * 「ドラッグの途中での`Alt`の切り替え（押した時点の`Alt`で決まる）」は、本体の移動のAltの複製（`InputTracker.js:326・1426`）を指す。拡大縮小のドラッグは追従のたびに`event.altKey`を読み中心からの拡大縮小を途中で切り替えられる（`InputTracker.js:1629`）ため、拡大縮小も含めて読むと古い。文脈は複製の記述のため相違にはしない。
  * 10-01の列挙の括弧書き「（…拡大縮小・外枠のハンドル・複数選択をまとめた拡大縮小も実装済み）」は、「やらないこと」の列挙の途中で実装済みの項目を括弧で足した形で、列挙と実装済みの区別が括弧の入れ子に依存する。10-02・10-03の欄にも同じ形がある（読み方が分かれるが事実とは合う）。
  * 「エディタでのJSの実行（スプライトのJSはテキストから取り出すだけ）」の主語は「エディタ」で、一致と判定した。一方、同じリポジトリの確認用ページは選んだJSをBlob URLの動的`import`で実行する（`SpriteCheckPage.js:165〜168`・`sprite-check.html:70`の警告文）。1章の同じ段落の「確認用ページでの…」の項目と合わせて読めば矛盾しないが、「JSの実行は無い」と一般の文として読むと確認用ページに当てはまらない。相違にはしない。
  * 「重なっている図形だけを数える前へ・後ろへ、離れた選択図形をまとめる重なり順の変更」は、前へ・後ろへ（隣との入れ替え。離れた選択図形はまとまらない＝`ShapeOrderRules.js:43〜44`）には一致する。最前面へ・最背面へ（`:64〜`）は、離れた選択図形が末尾・先頭に連続して並ぶ（元の相対順は保つ）ため、「まとめる」を最前面へ・最背面へまで含めて読むと食い違って読める。資料の文脈は前へ・後ろへ（「重なっている図形だけを数える前へ・後ろへ」と並べた記述）で、相違にはしない。
  * 「丸めた位置を示す表示」は、キャンバスに丸めた位置の印を描かないこと（`InputTracker.js:837`が`setSnapPoint`を呼ぶのは端点への吸い付きだけ）には一致する。一方、ステータスバーのカーソル位置の座標の表示は、スナップがONで`Ctrl`を押していないときは丸めた値を出す（`DisplayWiring.js:127・128`。3章17.のモジュールの分担にも「ステータスバーのカーソル位置の座標の表示」と書かれている）。「丸めた位置を示す表示」を座標の表示まで含めて読むと食い違って読める。前後の「定規の印を丸めた位置へ動かすこと」と並ぶためキャンバス上の印を指すと読み、相違にはしない。
  * 「ツールごとのカーソルの形の切り替え（カーソルの形の規則は操作モードの分岐だけ）」は、図形種別でカーソルが変わらない（`CursorShapeRules.js:60〜`の入力に図形種別が無い）点では一致する。ただし括弧書きの「操作モードの分岐だけ」は、実際の`resolveCursorShape`が`isPanning`・`isSpacePressed`・`state`・`hit`・`scaleHandle`・`rotationCorner`・`isPickingShape`も読む（Phase 10-01・10-02で外枠のハンドル・回転の範囲のカーソルが加わった）ことに照らすと、字義どおりには足りない。「ツールごとの切り替え」が無いという趣旨に読めば矛盾しないため、相違にはしない。
  * 「`main.js`への操作モードの判定の追加（削除ボタンの見た目を頂点の選択で変えない。3章18.）」は、削除ボタンの同期（`main.js:322〜324`）に操作モードの判定が無いことには一致する。`main.js`全体には`getMode()`・`OperationMode`を使う箇所が他にある（`main.js:102・103・219・221・412・444・480`）ため、「`main.js`に操作モードの判定を足さない」を文だけで読むと広く読める。括弧書きの削除ボタンに限った記述と読み、相違にはしない。
  * 「「直線に」で点を消すこと」は、パスの「直線に」（点は足さない・消さない＝`PathSegmentKindRules.js:190〜`）には一致する。今の曲線（`curve`）の「直線に」は制御点を捨てて直線にする（`:202〜`の`buildLineFromCurve`。`vertexIndexMap`は`[0, null, 1]`）ため、今の曲線まで含めて読むと「点を消す」場合がある。直前の「「曲線に」で足す点以外の頂点の追加」と対のパスの記述と読み、相違にはしない。
  * 「パスを開く／閉じる」は、専用の操作・ボタンが無いことには一致する。ただし開いたパスを閉じる経路は有る（結合の`J`で開いたパス1本を閉じる＝`PathJoinRules.js:277〜280`・`:300`、線を引いている途中の始点への吸い付き＝`:732〜736`）。「閉じる」の経路まで含めて読むと食い違って読める。専用の開く／閉じる操作を指すと読み、相違にはしない。
  * 照合できなかった主張：「Phase 10-0xでやらないと決めた」「同じ項目が複数のサブフェイズに挙がっていたものは1つにまとめた」「どのサブフェイズで…`_log/`とgitが正本」「性能の改善を目的とした変更」は決定の経緯・意図・方針で、コードでは確かめられない。「作業データ・書き出し・履歴のエントリの形・版は、Phase 8のどのサブフェイズでも変えていない」は、Phase 8の間の変更の有無をコミットの履歴で確かめる必要があり、過去のコミットの比較を行っていないため確かめられなかった（現在の版3・版4と矛盾はしない）。「ツールバー・ステータスバーの収まらない右側は切れる」の実際の見え方はCSSの値（`nowrap`・`overflow: hidden`）までを確かめ、ブラウザでの実測は行っていない。行218の前半を含む上のほかの項目は、すべてコード・HTML・ファイル一覧で確かめた（上の事実のとおり）。
### タスク3: 2章（データ構造）と`15_io.md`・`17_sprite_check.md`
* **調査内容**:
  * 対象の`+`行を行全体について開いた：`PROJECT_ARCHITECTURE.md`の行235・237・246・258〜259・262・265〜266・270・274・278・286・296・329・338〜340（17行）、`_doc/arch/15_io.md`の行5・6・24・25・31・36（6行）、`_doc/arch/17_sprite_check.md`の行19（1行）。主張を1つずつ、`js/io/DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`FileContentReader.js`、`js/shapes/Ellipse.js`・`Path.js`・`PathJoinRules.js`、`js/core/VectorModel.js`・`TransformInputSettings.js`・`InputTracker.js`・`ScaleHandleRules.js`、`js/edit/ShapeStyleEditor.js`・`ShapeExtentReader.js`、`js/check/`・`sprite-check.html`・`asset/sprite/`、`test/io/`の該当箇所と照合した（import文・公開物・式・キー順・条件を開いて読み比べた）。既知の傷1（`15_io.md`行25）を確かめた。
* **事実（実コードの記述）**:
  * `PROJECT_ARCHITECTURE.md`行235（スタイル3つの読み書き）：書き手＝`VectorModel`の`updateShapeStyles`（`VectorModel.js:442`）・`startDraft`（`:393`。作成中の図形へ`#assignShapeStyle`）・`updateNewShapeStyle`（`:416`。作成中の図形へも当てる）。読み手＝`StylePanelRules.js:136・206`・`ShapeStyleEditor.js`は図形のスタイルを読み、書き換えは`model.updateShapeStyles`へ渡すだけ（`ShapeStyleEditor.js:132・174・239`。`shape.<スタイル> =`の代入は`js/edit/`に0件）。一致。メソッド契約の数：`Ellipse.js:49〜50`・`Path.js:124〜125`に18メソッドの列挙（`drawHandles`なし。数えて18）、`createTransformed`が第18（`Ellipse.js:694`）、`js/`・`index.html`で`drawHandles`の検索0件。履歴（15→16→17→18→19→18）は経緯の記述で、`Ellipse.js:96`（第13）・`:157`（第15）・`:192`（第16）・`:202`（第17）・`:694`（第18）の番号と矛盾しない。一致。
  * 行237（`Ellipse`の読み方）：`#readGeometry`の戻り値`{ x, y, radiusX, radiusY, rotation, startAngle, endAngle, axisAligned }`（`Ellipse.js:309`）、`u`・`w`（`:237〜240`）、縦横に沿った枝＝`uy === 0 && wx === 0`で`radiusX = |points[1].x − xc|`・`radiusY = |points[2].y − yc|`・`rotation` 0・`axisAligned: true`（`:252〜256`）、弧の`flipX = ux < 0`・`flipY = wy > 0`の取り直し（`:257〜270`）、一般の枝は2×2行列の分解（`:271〜295`。`sy < 0`で裏返し）、弧の開始角を`[0, 2π)`へ正規化（`:298〜307`）。`draw`・`drawHover`・`drawOutline`・`hitTest`・`hitTestFill`・`intersectsRect`・`toDrawElement`はいずれも`#readGeometry`を呼ぶ（`:117・143・166・447・509・580・622`）。`points`の並び・数・`toJSON`/`fromJSON`は`#readGeometry`の導入前後で変わらない（`:52〜93・652〜691`）。`hitTest`の弧の角度は縦横に沿った枝`atan2(ly, lx)`・一般の枝`atan2(ly / ry, lx / rx)`を`(endAngle − 2π, endAngle]`へ写し`startAngle`未満を除外（`:474〜485`）。90°回した弧は`uy ≠ 0`で`axisAligned`偽（`:252`）。`#toLocalPoint`（`:321`）・`#pointOnOutline`（`:340`）が実在。`createTransformed`は5つの点を`applyAffineTransformToPoint`で写し、新しい中心で作り`id`を入れる（`:703〜708`）。`b`・`c`が0でない変換の`Error`・弧の上下の裏返しで中心の`y`を動かす処理は無い（`:703〜708`に`throw`なし）。`hitTestHandle`・`getHandlePosition`・`getVertexIndexForHandle`は常に`null`（`:187・197・217`）、`getVertexHandleNames`は`[]`（`:207`）、`setVertex`のJSDocに約束の位置の前提の注意（`:382〜383`）。作業データの版3・書き出し形式の版4（`DocumentSerializer.js:18`・`SpriteSerializer.js:19`）。3章25.・26.は`PROJECT_ARCHITECTURE.md`に実在（行724・738）。一致。
  * 行246（曲がり方を持つ区間`'bezier'`）：定数`SEGMENT_KIND_BEZIER`（`Path.js:45`）。`control1`・`control2`は絶対座標の引っ張る点で`getVertexHandleNames`・`hitTestHandle`は`points`だけを扱う（`Path.js:118`）。描画・当たり判定・範囲選択・塗りの内側・書き出しは`#segmentControls`（`:185`）の結果を使う（`:214・240・271・533`。分岐は`:194`の1か所）。`setVertex`は始点とする区間の`control1`・終点とする区間の`control2`だけ動かし（`:459〜490`）、`translate`はすべて動かす（`:496〜506`）。`PathJoinRules.chainSourceOf`が今の曲線を頂点2つ・区間1つ、弧を頂点3つ・区間2つに読み替え、2次→3次の式は`PathJoinRules.js:140・141`の1か所。弧の近似：`u`・`w`を中心・右端・上端から求め（`points[3]`・`[4]`は読まない）、始点`中心−u`・頂上`中心+w`・終点`中心+u`（点を先に求めてから`k`倍を足す）、区間0＝`control1 = 始点 + k·w`・`control2 = 頂上 − k·u`、区間1＝`control1 = 頂上 + k·u`・`control2 = 終点 + k·w`（`PathJoinRules.js:162〜196`）、`k = 4(√2 − 1)/3`（`:41`）。今の約束の位置での値の式は上の式に`u = (rx, 0)`・`w = (0, −ry)`を入れて一致。Bの逆順で`control1`・`control2`を入れ替え（`:247〜253`）、`fromJSON`は`control1`・`control2`を検証し（`Path.js:630〜636`）、エラー文は`ACCEPTED_SEGMENT_KINDS`から`'bezier'`を除いて作る（`:622〜628`）。端点をまとめるとき除くのはBの端点の点だけで引っ張る点の値は書き換えない（`PathJoinRules.js:380〜382`の`bPoints.pop`。区間の値は元のまま）。一致。
  * 行258（現行版3・版1→2）：`CURRENT_DOCUMENT_VERSION = 3`（`DocumentSerializer.js:18`）、`migrateVersion1To2`は`fillColor: null`にし`strokeColor`・`strokeWidth`に触れず、プレーンオブジェクトでない要素はそのまま（`:39〜49`）。一致。
  * 行259（版2→3）：`MIGRATIONS = { 1, 2 }`（`:130`）。`alignEllipsePointsForVersion3`（`:69〜102`）：円・弧だけ、`points`が長さ5・全点が有限のプレーンオブジェクトでなければそのまま返す。`points[1]`＝右端・`[2]`＝上端・`[4]`＝右端、`[3]`は円で右端・弧で左端`(xc − rx, yc)`。すでに約束の位置なら値を写す（右端`p1.x >= c.x && p1.y === c.y`・上端`p2.y <= c.y && p2.x === c.x`・弧の`points[3]`は比`1e-9`の許容量`ARC_START_POINT_TOLERANCE_RATIO`（`:27`）×`max(1, |xc|, rx)`）。`migrateVersion2To3`は新しいオブジェクトで`version: 3`、引数を書き換えず`throw`なし（`:108〜115`）。テスト：`test/io/DocumentSerializer.migration.test.js`に版2→3のdescribe（`:186`）があり、`new Ellipse(0.7,0,0.1,10,'arc')`のulpずれ（`:190・200`）・手で書いた値のそろい・描画要素が版2の読み方と同じ・壊れた円・弧のスキップ・円・弧以外は不変・`shapes`が配列でない・版1→3・引数を書き換えない・版3は変換しない（`:203〜290`）。版1→2のテストは`expectedAfterVersion3`（弧だけ`points[3]`を左端にした写し。`:57〜62`）と比べる。一致。
  * 行262：版3の作業データは`version`が現行版より大きいとき全体失敗（`DocumentSerializer.js`の`DocumentSerializer.js:213`）。一致（版の数値の事実は上のとおり）。
  * 行265（エンジンとの約束）：(a)(b)(d)と(c)の「エンジン本体のコードの変更なしで表示できた」「エンジン側の資料は変更なし」はエンジンのリポジトリの事実で、本リポジトリの外のため照合できなかった。(c)の「版4への版上げは連絡済み（Phase 10-04）」の内容は5章タスク2・3の既知の傷1と対になる記述で、書き出しの版の値4（`SpriteSerializer.js:19`）・`ellipse`の`rotation`の追加（`:38`）は一致。
  * 行266（書き出し形式の版4）：キー順`format, formatVersion, bounds, elements, source`、`bounds`は`null`または外枠（`SpriteSerializer.js:300〜306`）、`formatVersion: 4`（`:19`）。一致。
  * 行270（描画要素）：`elements`の並び＝`shapes.map(toDrawElement)`（`:299`）。`rotation`のキーを持つのは`Ellipse.toDrawElement`だけで（`Ellipse.js:631`）、`Line.js`・`Rect.js`・`Curve.js`・`Path.js`に`rotation`の検索0件。共通キー・`fillColor`は塗れる形なら図形の値、塗れない形は`null`（`Ellipse.js:637`）。一致。
  * 行274（`ellipse`）：キー順`kind, id, x, y, radiusX, radiusY, rotation, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor`（`Ellipse.js:624〜638`）、`closed`は`type === 'circle'`、値は`#readGeometry`。描き方`ctx.ellipse(x, y, radiusX, radiusY, rotation, startAngle, endAngle)`→`closed`なら`closePath`（`CodeExporter.js:144〜148`）。円は0〜2π・弧は今の約束の位置でπ〜2π（`Ellipse.js:71・74`）、回した・裏返した弧は`#readGeometry`の取り直しで別の値。一致。
  * 行278（`rotation`の扱い）：`Number.isFinite(element.rotation) ? element.rotation : 0`が`ctx.ellipse`の第5引数（`CodeExporter.js:145`）、外枠は`typeof rotation === 'number' && Number.isFinite(rotation) && rotation !== 0`のときだけ回した枝（`SpriteSerializer.js:194`）。キー無し・`undefined`・`NaN`・文字列・`Infinity`・`null`はいずれも有限の数値でなく0扱い。一致。
  * 行286（2つの版）：`SPRITE_FORMAT_VERSION`の唯一の定義は`SpriteSerializer.js:19`、作業データの版は`DocumentSerializer.js:18`、最上位に`version`キー無し（`SpriteSerializer.js:300〜306`）。版の履歴の記述（2＝`fillColor`・3＝`bezierPath`・4＝`rotation`）はコメント（`SpriteSerializer.js:14〜16`）と合う。`checkFormat`は版1〜`SPRITE_FORMAT_VERSION`（4）の整数を受理（`:278〜290`）。`MIGRATIONS`は`{ 1, 2 }`で版1→2＝`fillColor`・版2→3＝円・弧の点（`DocumentSerializer.js:130`）。`asset/sprite/select-arrow.js`・`vertex-arrow.js`は`formatVersion: 2`（`:8`）、`ToolIconWiring.js`が使うのは`sprite.bounds`と`sprite.draw`だけ（`:35・39`）。一致。
  * 行296（外枠の求め方）：`strokeColor`が文字列の要素だけ`resolveStrokeWidth/2`を広げる（不正な太さは`DEFAULT_STROKE_WIDTH` 2＝`SpriteSerializer.js:255〜259・364〜366`）、線なしで塗れない要素も和に含む（`:356〜371`）、`polyline`は全頂点（`:73`）、`quadratic`は端点と極値で制御点は含まない（`:86〜112`）、`ellipse`は弧の両端と軸上の端点で`closed`の弦は影響しない（`:215〜236`）。回した`ellipse`は両端の点と`tx`・`tx+π`・`ty`・`ty+π`のうち弧の範囲内の点の最小・最大（`:194〜213`）、非公開`ellipseRange`の1か所、`rotation`が0・キー無し・数値でないときは従来の手順（`:215〜`）。未知の`kind`は`Error`（`:360〜362`）。一致。
  * 行329（保存しないもの）：記録の`document`は`DocumentSerializer.serialize(model.getShapes())`の戻り値（`CanvasLibrary.js:68〜69・176`）で図形データだけ。`TransformInputSettings`・`referencePoint`・`aspectLocked`の語は`js/io/`・`SnapshotAdapter.js`・`HistoryManager.js`・`VectorModel.js`・`CanvasLibrary.js`に0件（持ち主は`TransformInputSettings.js`・`main.js`・`edit/TransformInputEditor`への注入のみ）。ほかの項目（履歴・選択集合・頂点の選択等）は保存の経路に現れない（記録の中身が図形データだけであることによる）。一致。
  * 行338：`collectScaleFrame(mode, bounds, viewScale)`（`ScaleHandleRules.js:129`）へ`shapeExtentReader.getSelectedGeometryBounds()`の結果を渡す（`main.js:194・221`、`InputTracker.js:1316`の`getSelectionFrameBounds`注入）。`getSelectedGeometryBounds`は選択中の図形から毎回求める（`ShapeExtentReader.js:47〜50`）。`VectorModel.js`・`HistoryManager.js`に外枠・回転の語の検索0件。一致。
  * 行339：`#rotateDrag`の持つ項目は`corner`（押した角）・`frame`（押下時の外枠）・`center`（回転の中心）・`origin`（押した位置）・`originals`（押下時の図形のインスタンス）・`rawAngle`（直前の丸めない角度）・`angle`（今の角度）の7つ（`InputTracker.js:389〜395・1461〜1469`）で記述の列挙と対応。`#finishLeftDrag`で`null`に戻る（`:1849〜1850`）。回した結果は図形の座標へ入る（`createTransformed`による差し替え）。一致。
  * 行340：`TransformInputSettings`が`{ referencePoint, aspectLocked }`を持ち（`TransformInputSettings.js`の`getState`）、初期値は`DEFAULT_REFERENCE_POINT`＝`REFERENCE_POINT.CENTER`（`ReferencePointRules.js:24`）・`false`。`main.js`で`transformInputSettings`を操作するのは基準点・鍵のボタン（`:884・920`）と同期の購読（`:769・897・934`）だけで、キャンバスの切り替え・選択の変更・取り消し/やり直しで触れる箇所は0件。基準点は名前だけを覚え、位置は`resolveReferencePointPosition(frame.bounds, 基準点)`で毎回求める（`TransformInputEditor.js:95・109・123`）。一致。
  * `_doc/arch/15_io.md`行5：`DocumentSerializer`のimportは`ShapeFactory`のみ（`DocumentSerializer.js:5`）。マイグレーション表の中だけが旧版の変換のためにプロパティ名・種別を知る（`:39〜115`）。一致。
  * 同行6：上の行258・259と同じ内容（版3・`MIGRATIONS { 1, 2 }`・許容量の式`1e-9 × max(1, |xc|, rx)`＝`:27・89`・非公開の`alignEllipsePointsForVersion3`・`isFinitePoint`・`migrateVersion2To3(doc)`の戻り・テストの一覧＝`test/io/DocumentSerializer.migration.test.js`）。一致。
  * 同行24：`serialize`・`computeShapesBounds`・`computeShapesGeometryBounds`・`stringify`・`checkFormat`（`'supported'`・`'notSprite'`・`'unsupportedVersion'`）・named export`DEFAULT_STROKE_WIDTH`（`SpriteSerializer.js:25・278〜`）、非公開の`#computeBounds(elements, includeStroke = true)`（`:348`）、識別子・現行版は非公開定数（`:11・19`）。呼び出し元：`CanvasFileOperations`（`serialize`＝`CanvasFileOperations.js:235`）・`CodeExporter`（`stringify`・`DEFAULT_STROKE_WIDTH`＝`CodeExporter.js:5・184`）・`FileContentReader`（`checkFormat`＝`:70`）・`edit/ShapeExtentReader`（`:39・49・64・77`）・`check/SpriteCheckInspector`（`checkFormat`＝`:69`）で列挙どおり、`js/`の他のimportは0件。一致。
  * 同行25：`SpriteSerializer`のimportは`DocumentSerializer`のみ（`:5`）。`io/`は`shapes/`をimportしない（`js/io/`のimport文は`../core/ShapeFactory.js`と`io/`内だけ）。現行版4・`checkFormat`は版1〜4（`:19・286`）。`bezierPathRange`・`cubicAxisRange`（`:159・123`。`ShapeGeometry.cubicBezierPoint`とは別の定義）。`ellipseRange`の回した枝は`end`の補正（`:190〜192`）の後（`:193〜`）に置かれ、`rotation`が0・キー無し・数値でない・`Infinity`・`NaN`は従来の手順。`SHAPE_RANGE_BY_KIND`に`bezierPath`（`:243〜248`）。**相違：文中の「版4はPhase 10-04で連絡する（本作業の時点で未連絡）」＝既知の傷1（5章タスク3）**。同じ文の「版3への版上げはエンジンへ連絡済み（Phase 09-04。2章）」は行265と一致。
  * 同行31：`CodeExporter`のimportは`SpriteSerializer`のみ（`stringify`・`DEFAULT_STROKE_WIDTH`＝`CodeExporter.js:5`）。`DRAW_SOURCE`（`:42〜168`）：塗るのは`fillColor`が文字列で`closed === true`かつ`polyline`/`ellipse`/`bezierPath`（`:73〜74`）、`bezierPath`は点2つ以上・`segments`の要素数・各`kind`・`cubic`の`control1`/`control2`を組み立ての前に確認して足りなければ`return`（`:104〜123`）、区間ごとに`bezierCurveTo`／`lineTo`、閉じた要素の最後の区間が`line`なら`lineTo`なしで`closePath`（`:126〜136`）、塗り→線の順（`:154〜164`）、塗りも線も無い要素はパスを組み立てない（`:75〜77`）。`case 'ellipse'`の第5引数は`Number.isFinite(element.rotation) ? element.rotation : 0`（`:145`）、`drawElement`のコメントに`rotation`の扱い（`:67`）。各図形の`draw`の命令・引数・順序は`Ellipse.draw`（`Ellipse.js:119〜133`）と一致（`ctx.ellipse(... g.rotation ...)`→円のみ`closePath`→塗り→線）。一致。
  * 同行36：`FileContentReader`・`js/check/`・`sprite-check.html`に版の数値の直書きは0件（版の受理は`SpriteSerializer.checkFormat`＝`FileContentReader.js:70`・`SpriteCheckInspector.js:69`）。`git diff --stat cc72e0d d524ef1 -- js/check sprite-check.html`は変更なし、`FileContentReader.js`も変更なし（`js/io/`の変更は`CodeExporter.js`・`DocumentSerializer.js`・`SpriteSerializer.js`の3件）。`test/io/FileContentReader.test.js`は、Phase 10の直前（`cc72e0d`）の`it`の題「版3のJS・CRLFのJS…」・`formatVersion`の期待値3が、今は題「版4のJS…」・`assert.equal(data.formatVersion, 4)`（`:417・421`）。一致。
  * `_doc/arch/17_sprite_check.md`行19：判定の条件＝`null`でない`object`・`checkFormat`が`'supported'`・`draw`が関数（`SpriteCheckInspector.js:66〜76`）、定数を重複して持たない。外枠の矩形は書き出しの`bounds`をそのまま使う（`SpriteCheckCanvas.js:43・102〜121`）。`js/check/`・`sprite-check.html`は`cc72e0d`〜`d524ef1`で変更なし（上のdiff stat）。回した楕円の極値で求めた`bounds`は`SpriteSerializer.js:194〜213`。一致。
* **推測・所見**:
  * 行246の「（作業データの版は2のまま）」「古いエディタでは未知の区間の種類として…」は、Phase 09-03aで`'bezier'`を足した時点の記述。今の作業データの版は3（`DocumentSerializer.js:18`）で、`'bezier'`の追加では上げていないという事実としては合うが、「今の版が2」と読める。相違にはせず所見とする（経緯の文脈）。
  * 行237の「`setVertex`は今の約束の位置を前提にした式のまま残す…本番の経路は無く」：`Ellipse.setVertex`の呼び出し元は`VectorModel.updateVertices`（種別を分けず呼ぶ）で、頂点のハンドルを持たない円・弧には画面の操作から番号が渡らない（`Ellipse.js:382〜383`）。一致と判定したが、「本番の経路は無い」はハンドルが`null`であることからの導出で、`updateVertices`を呼ぶ側の全経路までは追っていない（推測）。
  * `15_io.md`行36の「題を4へ直した」は`it`の題を指し、同じファイルの`describe`の題（`:393`）は「書き出し形式の版3」のまま。`it`の題が版4へ直っていることは一致するが、`describe`の題と並べると版が食い違って見える。相違にはしない。
  * 行265のエンジン側の事実（(a)(b)(d)・(c)のエンジンのコードの変更の有無）は、本リポジトリの外の記述のため「照合できなかった主張」。
  * 行246の「ずれは外側へ最大で半径の約0.027%」は`QUARTER_ELLIPSE_BEZIER_K`（0.552284…）と真の値（0.551915…）の差から計算した値と整合する（コードの値は`PathJoinRules.js:41`、JSDocは約0.03%。`PathJoinRules.js:156`）。数値そのものはコードの式から確かめた概算で、テストでは確かめていない。
  * 行329の保存しないものの列挙は、保存の経路（`CanvasLibrary`の`document`＝`serialize(shapes)`）が図形データだけであることから、列挙のすべてが保存されないと判断した（各項目を個別に探したのではない）。
### タスク4: 3章の同期の経路・3.・6.と`07_KeyboardShortcuts.md`・`09_DragTracker.md`
* **調査内容**:
  * 対象の`+`行を行全体について開いた：`PROJECT_ARCHITECTURE.md`の行353・363・366・367・369・371・385・386・387・388（10行）、`_doc/arch/07_KeyboardShortcuts.md`の行2・3・13〜20（10行）、`_doc/arch/09_DragTracker.md`の行3（1行）。主張を1つずつ、`js/core/KeyboardShortcuts.js`（全文）・`DragTracker.js`・`InputTracker.js`（`handleMouseDown`・`handleClick`・`#classifyPoint`・`#applyLeftDragUpdate`・`#resolveMoveDelta`・`#onLeftDragStart/End/Cancel`・`#finishLeftDrag`・`cancelDraftOrClearSelection`・`isScalingSelection`）・`PointHitRules.js`・`PressActionRules.js`・`SelectionRules.js`・`FocusKeyYieldRules.js`・`AltKeyGuard.js`・`HistoryManager.js`・`js/edit/TransformInputEditor.js`・`TransformInputRules.js`・`ClipboardController.js`、`js/main.js`（`KeyboardShortcuts`の注入・`onChange`の購読）・`index.html`、`test/core/KeyboardShortcuts.test.js`・`KeyboardShortcuts.keydown.test.js`と照合した。`git diff`でPhase 10-01〜10-03・Interruptの`KeyboardShortcuts.js`・テストの変更範囲（コメント行だけの変更・追加だけの変更）を確かめた。`node --test`を2つのテストファイルに限って実行し、件数を数えた（ファイルは書き換えない）。
  * 「ドラッグ中は`Esc`を受け付けない」「`cancel`は修飾キーなしだけ」「頂点でないハンドルも当たる」と読める古い記述が、対象の行に今も成り立つ形で残っていないかを見た。
* **事実（実コードの記述）**:
  * `PROJECT_ARCHITECTURE.md`行353（同期の経路）：購読先を`js/`の`.onChange(`の全件で確かめた。`model.onChange`（`main.js:234`ほか）・`viewTransform.onChange`（`:236`）・`historyManager.onChange`（`:390`）・`canvasLibrary.onChange`（`:643・644`）・`canvasFileOperations.onChange`（`:646`）、`applyMode`・`applyShapeType`が`syncToolPalette`を呼ぶ（`:435・458`）。`styleEyedropper.onChange`の登録先は`syncToolPalette`だけ（`:417`）。`displayState.onChange`は再描画（`:238`）・`DisplayWiring.js:83・96`（切り替えのボタン・フロートウィンドウの表示）。`cursorTracker.onChange`は`renderRulers`（`:260`）と`DisplayWiring.js:70`（座標の表示）だけで再描画は無い。`unitSnapSettings.onChange`の登録先は`DisplayWiring.js:72`（`syncCursorReadout`）・`:91`（`syncUnitSnapGroup`）の2つだけ（`main.js`に0件）。`transformInputSettings.onChange`の登録先は`syncOptionBarPositionGroup`（`:769`）・`syncOptionBarSizeGroup`（`:897`）・`syncOptionBarTransformGroup`（`:934`）の3つだけ。オプションバーの各まとまりは`model.onChange`で同期（`:691・732・767・807・865・896・933`）。直前に使った値の変更も`VectorModel.updateNewShapeStyle`が通知（`VectorModel.js:430`）。一致。
  * 行363（当たり分類）：`classifyPointHit(shapes, isSelected, x, y, tolerance, includeFill = true, includeHandles = true)`（`PointHitRules.js:99`）。ハンドルは選択集合の図形のみ・後ろ（手前）から（`:31〜42`）、`findHandleHit`が`isVertexHandle`でないハンドル名は打ち切らず次の図形へ進む（`:38`）。本体は選択集合の輪郭を手前優先→それ以外は手前から輪郭または`includeFill && hitTestFill`で、選択集合の内側を優先しない（`:68〜81`）。`includeHandles`偽なら`handle`は常に`null`（`:100`）。`InputTracker.#classifyPoint`は`!this.#isFillHitExcluded()`と`this.currentMode === OperationMode.VERTEX`を渡すだけ（`InputTracker.js:1938〜1947`。選択モードはハンドルを含めない）。外枠のハンドルは`#findScaleHandle`（`:1299`、`hitTestScaleHandle`）、回転の範囲は`#findRotationZone`（`:1325`、`hitTestRotationZone`）で別に判定し、押下は`resolvePressAction`の先頭2行（`PressActionRules.js:41〜47`。外枠のハンドル→回転の範囲→選択集合内の本体＝`moveSelection`→選択集合外の本体＝`null`→空白＝`marquee`）、カーソルは`#updateCursor`へ`scaleHandle`・`rotationCorner`を渡す（`:940〜952`・`:2002〜`）。塗った内側で押しても`marquee`でない（本体なら`null`か`moveSelection`）。範囲選択は選択モードで`shape.intersectsRect`（`:1785`）、頂点の選択モードで`collectVertexHandlesInRect`（`:1766`。`intersectsRect`を呼ばない）。`Ctrl`+クリック（`handleClick`＝`:1151`）・`Alt`+ドラッグの押下（`handleMouseDown`＝`:1022`）・スポイトのクリック（`:1151〜1155`）も同じ`#classifyPoint`。`InputTracker`は絞り込みをしない（Interruptの差分`86801cc..d524ef1`で`#classifyPoint`の後からの`isVertexHandle`絞り込みが削除され、`PointHitRules.findHandleHit`の`isVertexHandle`へ移っている）。移行前（`cc72e0d`）の円には頂点でない`'move'`ハンドルがあった（`Ellipse.js`の`hitTestHandle`）ため、「以前は…隠していた」は経緯として合う。一致。
  * 行366（クリックの解釈）：選択モードの`handleClick`は外枠のハンドルの上なら`#findScaleHandle(...) !== null`で`return`（`Ctrl`を見る前。`InputTracker.js:1158〜1160`）。それ以外は`resolveClickSelection(選択, bodyId, hasCtrlModifier)`（`SelectionRules.js:23〜37`。`Ctrl`なし＝`set([id])`または選択があるときだけ`clear`、`Ctrl`あり＝選択中なら外す・未選択なら末尾へ・空白は`null`）。頂点の選択モード：ハンドル上は`resolveVertexClickSelection`（`:102〜116`）、ハンドル上でなく`Ctrl`ありは`resolveClickSelection(…, true)`のみ（頂点の選択は空にしない）、`Ctrl`なしは`clearSelectedVertices()`の後に`resolveClickSelection(…, false)`（`InputTracker.js:1166〜1186`）。`resolvePressAction`は`Ctrl`を引数に取らない（`PressActionRules.js:41`）。`hasCtrlModifier`は`event.ctrlKey || event.metaKey`（`InputTracker.js:176〜178`）、`AltKeyGuard`は`event.ctrlKey`だけ（`AltKeyGuard.js:31`）。一致。
  * 行367（本体ドラッグの移動量）：`#applyLeftDragUpdate`の`MOVING_SELECTION`は`#resolveMoveDelta({ x - #moveOrigin.x, y - #moveOrigin.y }, event)`を目標とし、`#appliedMoveDelta`との差分を`model.moveShapes`へ（差分0でも呼ぶ。`InputTracker.js:1548〜1551`）。`#resolveMoveDelta`は`event.shiftKey`なら`constrainMoveDirection`→`roundConstrainedDeltaToUnit`、そうでなければ`roundDeltaToUnit`、刻みは`resolveUnitSnapStep(getUnitSnapStep(), hasCtrlModifier(event))`（`:1602〜1607`。`Ctrl`の間は丸めず`Shift`の限定は効く）。`Shift`を読むのは`mousemove`・ドラッグ中の`wheel`のイベント（`:1503〜1505`、`:504`）、`keydown`の購読は無い。公開フィールド`lastCursor`は`js/`に0件。頂点のハンドルのドラッグは`Shift`を読まない（`:1523`付近のJSDoc、`shiftKey`の読み取りは`:873・1604・1628・1654`の4か所だけ）。直線・曲線のツールの付いてくる線の先は最後の点を基準に限定（`:870〜876`）。**相違：「`Shift`が効くのは本体の移動だけ」は、`shiftKey`の読み取りが拡大縮小（`:1628`＝`keepAspect`）・回転（`:1654`＝`snapToStep`）のドラッグにもある（5章タスク4）**。それ以外の要素は一致。
  * 行369（`Alt`+ドラッグ）：`#beginMoveSelection`が`#beginLeftDrag`の成功時だけ`#duplicateOnMove = Boolean(event.altKey)`（`InputTracker.js:1426`。頂点のハンドル・範囲選択・拡大縮小・回転では立てない＝`:1434・1455`）、`#onLeftDragStart`が`beginEdit()`の後に`MOVING_SELECTION && #duplicateOnMove`なら`duplicateSelection()`（`:1489〜1491`。閾値以内で離すと呼ばれない）、`main.js:189`が`clipboardController.duplicateInPlaceWithinEdit()`を注入、`duplicateInPlaceWithinEdit`は複製を同じ位置・新しいidで追加し`insertDocumentWithinEdit`（記録しない。クリップボードに触れない。`ClipboardController.js:206〜213`）、`#finishLeftDrag`の`commitEdit`で1件、`#duplicateOnMove`は終了時に`false`（`:1847`）。一致。
  * 行371（キーボード操作）：`cancel`は`styleEyedropper.cancelPicking(() => inputTracker.cancelDraftOrClearSelection())`（`main.js:990`。`cancelPicking`の`fallback`は`StyleEyedropper.js:101〜106`）、`deleteSelection`は`inputTracker.deleteLastLinePointOrSelection()`（`:1006`）、`undo`は`performUndo`が先に`removeLastLinePoint()`（`:125〜137`）。`isCancelableDrag: () => inputTracker.isScalingSelection()`（`:965`）、`isScalingSelection()`は`CANCELABLE_DRAG_STATES.includes(this.state)`（`InputTracker.js:613`）、`CANCELABLE_DRAG_STATES = [SCALING_SELECTION, ROTATING_SELECTION]`（`InputModes.js:32`）。`KeyboardShortcuts`の手順（`:274〜314`）：手順1・2が`findCancelableDragBinding`より前、手順3で`dragCancelBinding ?? #findBinding(event)`、手順4は`!binding.ctrl && isSpaceOperatedInputElement`（`:308`）、手順5は`dragCancelBinding === null && isDragging()`（`:314`）、手順6は`event.repeat && !binding.repeatable`。`findCancelableDragBinding`は`event.code`が`CANCEL_BINDING.codes`に含まれるときだけ`isCancelableDrag()`を1回呼び、修飾キー・`repeat`を読まない（`:234〜239`）。`CANCEL_BINDING`は`SHORTCUT_BINDINGS.find(action === 'cancel')`（`:222`）。`#findBinding`は`altKey`で`null`・`ctrl`の一致・`#matchesShiftRule`（`:340〜365`）。`document`の`keydown`は`InputTracker.handleKeyDown`が`Space`のみ（`InputTracker.js:1201〜1203`）、それ以外は`KeyboardShortcuts`。数字キーは`selectShapeTool`（`main.js:974`）、ツールパレットも同じ（`:508`）。`Z`・`X`・`C`は`ctrl`の値で区別（`KeyboardShortcuts.js:188〜190`と`:176〜183`ほか）。`Tab`は`ctrl: false`・`FORBIDDEN`、手順2・4で止まる（ボタン・`body`は通る）。表示の切り替えのキーは`displayState.toggle*`（`main.js:1040〜1058`付近）。`AltKeyGuard`は`event.key === 'Alt'`・`ctrlKey`偽・テキスト入力扱いでないときだけ（`AltKeyGuard.js:31〜`）、`keydown`・`keyup`を購読（`:37・38`）、`KeyboardShortcuts`は`keyup`を購読しない。`A`（`setMode`／`VERTEX`）・`Ctrl`+`I`・`Ctrl`+`Shift`+`V`・`D`・`I`・`Shift`+`H`・`Shift`+`V`の各エントリと組み合わせの区別は`KeyboardShortcuts.js:150〜214`のとおり（`KeyV`＝4通り、`KeyH`＝2通り、`Ctrl`+`Shift`+`H`は一致なし）。反転の受理は`performFlip`（ドラッグ中は`false`。`main.js:910〜915`）→`transformInputEditor.flip`が`canTransformSelection`（対象が`'shapes'`・外枠が有限。`TransformInputRules.js:70〜75`）。`resolveNudgeTarget`は`SELECT`で図形の選択があるときだけ`'shapes'`（`NudgeTargetRules.js:23〜26`）。入力欄の規則：`isTextInputElement`は`TEXT_INPUT_TYPES`（`number`を含む。太さの欄は`type="number"`＝`index.html:549`）・`textarea`・`contenteditable`、`isSpaceOperatedInputElement`は`checkbox`・`color`、`isToggleButtonElement`は非公開、`isSpaceYieldedElement`はexport（`FocusKeyYieldRules.js:28・54・64・75`）、`InputTracker`が`isSpaceYieldedElement`を使う（`:1230・1909`）。`KeyboardShortcuts`の手順4は`isSpaceOperatedInputElement`（`:9・:306`）。操作の実体の列挙（`performUndo`・`performRedo`・`clipboardController`の`copy`・`cut`・`paste`・`pasteInPlace`・`duplicate`・`performInvertSelection`・`startEyedropper`・`shapeStyleEditor.resetColors`・`performJoin`・`performShapeOrder`・`displayState`の4つ・`nudgeEditor.nudge`・`performFlip`）は`main.js:961〜1071`に実在。一致。
  * 行385（本体ドラッグ・ハンドル変形の履歴）：`#onLeftDragStart`の`beginEdit`（`InputTracker.js:1487`）、`#finishLeftDrag`冒頭の`commitEdit`（`:1834〜1838`）、拡大縮小・回転以外の中断は反映済みの変化を戻さず`#finishLeftDrag`で記録（`#onLeftDragCancel`＝`:1727〜1740`）、結合・閉じるは`#onLeftDragEnd`で`joinDraggedEndpoint`を`#finishLeftDrag`の前に呼ぶ（`:1700〜1702`）。一致。
  * 行386（拡大縮小の履歴）：追従は`createTransformed`の結果を`model.replaceShapesKeepingIds`で差し替え（`InputTracker.js:1616〜`のJSDoc）、中断は`#restoreOriginals(this.#scaleDrag.originals)`の後に`#finishLeftDrag`の`commitEdit`で、前後が同じなら`HistoryManager`が記録しない（`JSON.stringify(before.document) === JSON.stringify(after.document)`＝`HistoryManager.js:151〜153`）。`Esc`の中断は`DragTracker.cancel({ suppressClick: true })`（`:674`）、`blur`・`setMode`・`abortOngoingOperation()`は`cancel()`（`DragTracker.js:250`、`InputTracker.js:815`）。一致。
  * 行387（回転の履歴）：`#applyRotateUpdate`が同じ形で差し替え、`#onLeftDragCancel`が`ROTATING_SELECTION`で`#rotateDrag`を`null`にしてから`#restoreOriginals`（`:1735〜1738`）、離したときは`#onLeftDragEnd`が同じインスタンスで`replaceShapesKeepingIds`を1回通知して外枠の表示を戻し（`:1703〜1715`）、`commitEdit`は前後の作業データを比べる（記録は1件）。閾値以内で離したときは`beginEdit`が呼ばれない（`#onLeftDragStart`は閾値超過時のみ）ため記録しない。一致。
  * 行388（数値入力・反転の履歴）：`#apply`は`shapes.length === 0`で`false`を返してから`beginEdit()`→`replaceShapesKeepingIds`→`commitEdit()`（引数なし＝鍵なし。`TransformInputEditor.js:146〜154`）。`rotateBy`・`flip`は押せない（`!frame.enabled`）・変換が`null`のとき`#apply`を呼ばず`beginEdit`も呼ばない（`:106・121〜126`）。幅0の向きの反転は`toScaleTransform`の`scaleX: -1`で、点が基準点と同じ値なら`-x + 2x`＝`x`で前後が同じ（`HistoryManager.js:151`が省く）。360°は`resolveRotationTransform`が`value === 0`だけを`null`にし（`TransformInputRules.js:172〜178`）、360・−360・720を`Line`へ当てた`createTransformed`の結果が元とJSONで一致することを実行して確かめた（`Line`1つ・基準点1つのみ）。選択は`replaceShapesKeepingIds`が保つ。一致。
  * `_doc/arch/07_KeyboardShortcuts.md`行2：`KeyboardShortcuts.js`のexportはクラスと関数`findCancelableDragBinding`だけ（`export`の検索2件。`:234・249`）。`new KeyboardShortcuts({...})`の戻り値を`main.js`が保持しない（`main.js:961`）。一致。
  * 同行3：`ShiftRule`の3値と書き忘れ・`ANY`・`REQUIRED`以外が`FORBIDDEN`扱い（`#matchesShiftRule`＝`:359`）、`SHAPE_TYPES`からの生成（`:153〜161`）、`Space`は対応表になし、`REQUIRED`のエントリは`Ctrl`+`Shift`+`Z`（`:177`）・`Ctrl`+`Shift`+`V`（`:185`）・`Shift`+矢印4つ（`flatMap`の`REQUIRED`）・`Shift`+`H`・`Shift`+`V`（`:213・214`）だけ。`Ctrl`+`Shift`+`C`・`Ctrl`+`Shift`+`H`は`ctrl: true`の`KeyC`・`ctrl: false`の`KeyH`のため一致なし。`J`は`ctrl: false`・`FORBIDDEN`・`repeatable: false`（`:169`）、`performJoin`は`pathJoiner.join()`を返し結合したときだけ`true`の契約（`main.js:350〜355`）、`Ctrl`+`J`・`Shift`+`J`は一致なし。一致。
  * 同行13（反転のキー）：2エントリの値は資料の文言と1項ずつ同じ（`KeyboardShortcuts.js:213・214`）。位置は矢印の`flatMap`（`:200〜`）の直後＝対応表の末尾。`Phase 10-03`のコードの差分（`e861b7b..b0d738d`）は、エントリ2つの追加・`ShortcutActions`のtypedef・コメント・JSDocの文言のみで、`#handleKeyDown`・`#findBinding`・`findCancelableDragBinding`のコードは変わっていない。`H`・`V`は`FORBIDDEN`（`:151・153`付近）、`Ctrl`+`V`・`Ctrl`+`Shift`+`V`は`ctrl: true`（`:182・185`）。typedefの`flipHorizontal`・`flipVertical`（`:98〜103`）。必須名は対応表から自動で増え（`:261`）、欠けると`Error`（`:262〜264`）、`KeyboardShortcuts.test.js:65・69`が確かめる。`performFlip`への接続（`main.js:1069・1070`）。ボタン`#option-flip-horizontal`・`#option-flip-vertical`の`title`は`横に反転 (Shift+H)`・`縦に反転 (Shift+V)`（`index.html:589・590`）。反転のコールバックの`false`の条件（図形を選んでいない・外枠が求まらない・ドラッグ中）は`performFlip`・`canTransformSelection`と合う。`ctrl: false`のため手順4・2で止まり、手順5・6でも実行しない（`repeatable: false`）。一致。
  * 同行14（`#handleKeyDown`を通したテスト）：`KeyboardShortcuts.keydown.test.js`は`before`で`HTMLInputElement`・`HTMLTextAreaElement`・`HTMLElement`（空のクラス）・`document`（`activeElement: null`・`keydown`のハンドラを受け取る`addEventListener`）を置き（`:84〜96`）、`after`で記述子から元へ戻す（`:98〜108`）。`it`は9件（`node --test`で9件とも合格）：`Shift`+`H`（`:110`）・`Shift`+`V`（`:116`）・`false`で`preventDefault`なし（`:122`）・`H`・`V`が`setMode`（`:130`）・`Ctrl`+`V`・`Ctrl`+`Shift`+`V`（`:137`）・`Ctrl`/`Meta`/`Alt`併用の不一致（`:142`）・キーリピート（`:155`）・ドラッグ中（`:163`）・IME変換中（`:171`）で、資料の列挙と1対1。`KeyboardShortcuts.test.js`の追加は`flipHorizontal`だけ・`flipVertical`だけを欠く2件のみ（`e861b7b..b0d738d`の差分が追加だけ＝既存のケースは変えていない）。一致。
  * 同行15（`Esc`の例外）：`Phase 10-02`の差分（`b5a5be0..e861b7b`の`KeyboardShortcuts.js`）はコメント・JSDocの「拡大縮小」→「拡大縮小・回転」だけでコード行の変更なし。`cancel`のエントリは`ctrl: false`・`FORBIDDEN`・`repeatable: false`（`:165`）。例外は`#findBinding`より前（`:300〜302`）。`#matchesShiftRule`・`SHORTCUT_BINDINGS`・`#findBinding`・「`Alt`押下中は常に不一致」は変更なし。一致。
  * 同行16：`isCancelableDrag`は`ShortcutActions`のtypedef（`:44`）と必須名（`:261`）、欠けると`Error`（`KeyboardShortcuts.test.js:61`）。注入の式は`() => inputTracker.isScalingSelection()`（`main.js:965`）。`isScalingSelection()`が`CANCELABLE_DRAG_STATES`で判定（上記）。一致。
  * 同行17：`CANCEL_BINDING`は非export、`SHORTCUT_BINDINGS`の直後（`:222`）で、`find(action === 'cancel')`、キーは`codes`から取る。一致。
  * 同行18：`findCancelableDragBinding`はexport、状態なし、`event.code`が含まれなければ`null`（照会は呼ばない）、含まれれば`isCancelableDrag()`を1回呼び`CANCEL_BINDING`（`Object.freeze`済み＝`:215`）または`null`、修飾キー・`repeat`は読まない、`document`に触れない（`:234〜239`）。呼び出し元は`#handleKeyDown`（`:301`）とテスト（`KeyboardShortcuts.test.js`）だけ（`js/`・`test/`の検索で2ファイル）。対応表はexportしない。一致。
  * 同行19：手順3・5の式と手順1・2・4・6が例外のときも効くことは上記（`:301〜314`）。`Shift`+`Esc`・`Ctrl`+`Esc`は`#findBinding`で一致しない（`cancel`は`ctrl: false`・`FORBIDDEN`）。ウィンドウのフォーカスが外れると`DragTracker.#handleWindowBlur`が`cancel()`し`#onLeftDragCancel`が引き始めの形へ戻す（`DragTracker.js:249〜251`、`InputTracker.js:1727〜1740`）。一致。
  * 同行20（テスト）：`findCancelableDragBinding`のテストは`KeyboardShortcuts.test.js`の`describe`（`:93`）に6件（16通りの真・16通りの偽・`Escape`以外・照会1回・`ROTATING_SELECTION`を含む照会で16通り・`event`を書き換えない。16通りは`ctrl`・`meta`・`alt`・`shift`の`2^4`）、`isCancelableDrag`だけを欠く配線検証が1件（`:61`）。`ROTATING_SELECTION`を含む照会のテストは`CANCELABLE_DRAG_STATES`を使う（`:134〜`）。**相違：資料の「計9件」は、列挙された内容（6＋1＝7件）とも、ファイル全体（`it`は11件）とも合わない（5章タスク4）**。Windowsで`Ctrl`+`Esc`等をOSが先に使う記述はコードで照合できない（所見）。
  * 同行20（末尾「`#handleKeyDown`を通した修飾キー付きの`Esc`は`document`に依存してテストできず」の照合。追加調査）：`#handleKeyDown`が読むものは`event.isComposing`（`KeyboardShortcuts.js:293`）・`document.activeElement`（`:296・:308`）・`event.code`（`:235`）・修飾キー・`repeat`・`event.preventDefault()`で、`isCancelableDrag`は注入コールバックを`() => this.#actions.isCancelableDrag()`で渡して呼ぶだけ（`:301`）。`document`に触れるのは`addEventListener`（`:268`）と`activeElement`だけで、`KeyboardShortcuts.keydown.test.js:84〜96`の仮の`document`（`activeElement: null`・`keydown`のハンドラを受け取る`addEventListener`）とクラス3つで足りる。`press`（`:64〜81`）は`eventInit`でイベントの値（`code`・`ctrlKey`等）を上書きでき、`actionsOptions`で`isDragging`の戻り値を変えられる。`Escape`の`keydown`（`{ code: 'Escape', shiftKey: true }`等）を渡し、`isCancelableDrag`が真を返すコールバックを注入すれば、手順3の例外（`:301`）・手順5（`:314`）まで送れる形である。ただし現状のヘルパーは`isCancelableDrag`を常に`false`で返す（`:47〜49`）ため、真を返すには`createRecordingActions`の変更または別のヘルパーが要る（テストは新設・変更しない）。`keydown.test.js`で`Escape`を使う箇所は0件、`isCancelableDrag`は上のヘルパーの`:47`の1件だけ（`test/`の`Escape`は`KeyboardShortcuts.test.js`の9行で、どれも`findCancelableDragBinding`を直接呼ぶ6つの`it`の中）。したがって事実は「今は`#handleKeyDown`を通した`Esc`のテストが無い」で、「`document`に依存してテストできない」は、仮の`document`を置く手段が同じファイルの行14・`keydown.test.js`で実際に使われている以上、成り立たない（5章タスク4）。5章に書いた根拠：判定は「理由の誤り」で、読み方が分かれる記述ではない（`document`への依存は`:268・:296・:308`の3か所に限られ、いずれも仮の`document`で足りる）。行14末尾の「…を通した確認は引き続き`node --test`では確かめておらず」は「していない」という現状の記述で、成り立つ。対象の`+`行（行2〜3・13〜20）で他に`document`・DOMを理由とする「できない」の主張は、次項の行20の`isScalingSelection()`だけ（資料の`document`の検索：行12・14・18・20の4行。行12は`+`行の外のため所見に参考として書く。行18の「`document`に触れない」は`findCancelableDragBinding`についてで一致＝`:229・234〜239`）。
  * 同行20（「`isScalingSelection()`が一覧を使うことそのものは`DragTracker`・DOMに依存して確かめられず、テストプレイで確かめる」の照合。追加調査）：(1) インスタンスの生成がDOMに依存することは事実：`InputTracker`のコンストラクタ（`InputTracker.js:411`）は`new DragTracker(...)`（`:498`）、`canvas.addEventListener`（`:500〜502・:504`）、`document.addEventListener`（`:505・:506`）、`window.addEventListener`（`:510`）を呼び、`DragTracker`のコンストラクタ（`DragTracker.js:77`）は`window`へ`mousemove`・`mouseup`（capture）・`blur`を購読する（`:82・:83・:85`）。(2) 判定そのものはDOMに依存しない：`isScalingSelection()`（`InputTracker.js:613〜615`）は`CANCELABLE_DRAG_STATES.includes(this.state)`の1式で、読むのは公開フィールド`state`だけ（`#drag`・`window`・`document`・`canvas`に触れない）。(3) 実行して確かめた（リポジトリの外の一時ファイルから`import`。プロジェクトのファイルは書き換えない）：`window`・`document`が無い`node`で`InputTracker.js`を`import`でき、`InputTracker.prototype.isScalingSelection.call({ state })`は`InputState`の7値のうち`SCALING_SELECTION`・`ROTATING_SELECTION`だけで真。`new InputTracker(...)`は`window`が無いと`ReferenceError`、仮の`window`だけでは`document`の`ReferenceError`、`addEventListener`だけを持つ仮の`window`・`document`と仮のキャンバス（`addEventListener`・`style`）を置くと生成でき、`state`を7値へ替えた結果は同じ。(4) `test/`（74ファイル）の検索：`new InputTracker`0件・`InputTracker`0件・`DragTracker`0件・`isScalingSelection`0件（`InputTracker`・`DragTracker`は大文字小文字を問わなくても0件）。`InputTracker`を生成するテストは無く、「テストプレイで確かめる」は現状と合う。**相違：「依存して確かめられず」は成り立たない（5章タスク4）**。成り立つのは「`InputTracker`の生成は`DragTracker`・DOMに依存する」「今はテストが無い」まで。
  * `_doc/arch/09_DragTracker.md`行3：`cancel({ suppressClick = false } = {})`（`DragTracker.js:145`）。セッションが無ければ何もしない（`:146〜148`）。`this.#suppressNextClick = suppressClick && button === 0`の1式（`:152`）で、省いた・左以外は`false`、`handlers.onCancel?.()`を呼ぶ。`#handleWindowBlur`は引数なしの`cancel()`（`:250`）、`setMode`・`abortOngoingOperation`の経路も`this.#drag.cancel()`（`InputTracker.js:815`）。`clearSuppressedClick()`が次の押下（`handleMouseDown`冒頭）で呼ばれる（`:171`、`InputTracker.js:993`付近の`#drag.clearSuppressedClick()`）。引数付きで呼ぶのは`cancelDraftOrClearSelection`の(1)だけ（`.cancel(`の検索3件：`InputTracker.js:674`（引数あり）・`:815`・`DragTracker.js:250`）。`DragTracker`のテストファイルは`test/`に無い（`test/`で`DragTracker`の検索0件）。公開メソッド6つ（`:100・123・131・145・160・171`）。**一致**。
* **推測・所見**:
  * `09_DragTracker.md`行3の「呼び出し元は`InputTracker.cancelDraftOrClearSelection`の(1)（拡大縮小のドラッグ中の`Esc`。3章25.）だけ」：(1)の分岐は`isScalingSelection()`で判定し回転のドラッグ中も同じ呼び出しになる（`InputTracker.js:672〜675`。`CANCELABLE_DRAG_STATES`は回転を含む）。括弧書きは回転を挙げていない（10-01の記述のまま）が、呼び出し元の特定としては成り立つので相違にしない。修飾の括弧書きに「回転も。3章26.」が無い点を所見とする。
  * 行371の「`Shift`が効くのは…」に当たる一般化は行367だけ。行371の例外の説明は「拡大縮小・回転のドラッグ中以外の`Esc`の照合は今のまま」と限定して書いてあり、古い記述にならない。
  * 行388の「360°の回転など」は、`Line`1つ・基準点1つで確かめただけで、図形の種類・座標の組み合わせによっては丸めの誤差で前後が変わる可能性は調べていない（推測）。`toRotationTransform`の内部で誤差を丸めているかは本タスクでは読んでいない。
  * 07行19の「ドラッグを始めた時点でフォーカスが色の欄に残っている場合に起こり得る」は、ブラウザでのフォーカスの挙動の記述で、コードから確かめられる範囲（手順4が例外のときも効く）だけ照合した。残りは照合できなかった主張。
  * （参考。差分の`+`行の外）07行12末尾の「矢印キーの受理判定そのものは`document`・`KeyboardEvent`に依存し`node --test`で確かめられない」：`+`行は行2〜3・13〜20で、行12は要件1の照合の対象ではないため相違に数えない。行20末尾と同じ種類の記述のため、理由についてだけ参考として書く：受理判定の経路は行20末尾と同じ`#handleKeyDown`で、`document`は仮の値で足り（`KeyboardShortcuts.keydown.test.js:84〜96`）、`KeyboardEvent`は`KeyboardShortcuts.js`ではJSDocの型（`:290・:337`）にしか現れず、`press`は普通のオブジェクトを渡している（`:64〜81`）。同行が参照する`16_test.md`は読んでいない（本タスクでは読む許可なし）。
  * 07行20の「Windowsでは`Ctrl`+`Esc`・`Alt`+`Esc`・`Ctrl`+`Shift`+`Esc`をOSが先に使いページに`keydown`が届かないことがある」はOSの挙動で、照合できなかった主張。
  * 行363の「見えない図形（塗られていない）は輪郭の当たりだけで選ばれる（2026-11-12 発注者の決定）」・「発注者の決定」「発注者了承済み」は方針を述べる記述で、コードから確かめられる範囲（`hitTestFill`は塗りがある図形だけ当たる＝`findBodyHit`が`hitTest`の後に`hitTestFill`を呼ぶ）だけ照合した。`hitTestFill`が塗りなしで`false`を返すことは各図形のコードまでは確かめていない（推測）。
### タスク5: 3章2.・11.〜17.と`04_CanvasManager.md`・`30_UnitSnapRules.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク6: 3章18.・19.と`18`・`32`・`34`・`38`・`41`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク7: 3章20.・21.・24.と`13_palette.md`・`14_edit.md`・`26_StatusReadoutRules.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク8: 3章25.（拡大縮小）と`42_ScaleHandleRules.md`・`35_CursorShapeRules.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク9: 3章26.（回転）と`43_RotationRules.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク10: 3章27.（基準点・大きさ・角度・反転）と`44`・`45`・`03_VectorModel.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク11: `01_index_html.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク12: `02_main.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク13: `06_InputTracker.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク14: `12_shapes.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク15: `16_test.md` 前半（Phase 10-01・10-02まで）
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク16: `16_test.md` 後半（Phase 10-03・Interrupt・末尾）
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク17: 変わった・広がった・なくなったもの（要件2）の検索
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク18: 『開発資料との相違』の確認と、6章への一覧のまとめ（固定タスク。全調査タスクの後）
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

## 5. 開発資料との相違
* （タスク実行時に記載。相違が一件もなかった場合は、タスク18で「相違なし」と明記する）
* 形式: **タスクn：（対象：資料のファイルと節）**： （資料の記述） → （実コードの実態。`ファイル:行`）
* **タスク1：（対象：`PROJECT_ARCHITECTURE.md`1章の構成図 `InputModes.js`の行29）**： 使う側として「`InputTracker`・`KeyboardShortcuts`・`ToolRules`・`CursorShapeRules`・`VertexHandleRules`・`NudgeTargetRules`・`wiring/ToolIconWiring`・`main.js`から使う」と8つを列挙 → `InputModes`のimport元はもう1つ、`js/core/ScaleHandleRules.js:5`（`OperationMode`）がある。列挙が1件足りない（行43の`ScaleHandleRules`の説明には`InputModes`をimportすると書かれている）。
* **タスク1：（対象：`PROJECT_ARCHITECTURE.md`1章の構成図 `NudgeTargetRules.js`の行42）**： 使う側として「`edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/TransformInputEditor`から使う」と3つを列挙 → `NudgeTargetRules`のimport元はもう1つ、`js/edit/PathCornerEditor.js:6`（`resolveNudgeTarget`）がある。列挙が1件足りない（行225・228の記述には`PathCornerEditor → core/NudgeTargetRules`が挙がっている）。
* **タスク2：（対象：`PROJECT_ARCHITECTURE.md`1章「存在しないもの」行218。既知の傷1）**： 「エンジンでの版4の確認と連絡票（Phase 10-04）」を「存在しないもの」に2回挙げる（10-02の列挙の中・10-03の列挙の末尾） → 版4は連絡済み。同じ資料の行265に「版4への版上げ（Phase 10-02。`ellipse`の`rotation`の追加）は連絡済み（Phase 10-04。エンジン本体（`oz/`）のコードの変更なしで…）」と書かれている。
* **タスク2：（対象：`PROJECT_ARCHITECTURE.md`1章「存在しないもの」行218。同じ行の古い記述）**： 「エンジンでの版3の確認と連絡票（Phase 09-04）」を「存在しないもの」に挙げる → 版3も連絡済み（行265「版3への版上げ（Phase 09-01a）は連絡済み（Phase 09-04）」）。この記述は`cc72e0d`時点の行201にも既にあった古い記述（行218は差分のハンク`@@ -201 +218 @@`で行全体が`+`行のため、要件1の照合対象）で、同じ行で同じ種類の食い違い。
* **タスク3：（対象：`_doc/arch/15_io.md`行25 `SpriteSerializer`の「知らないこと」。既知の傷1）**： 「**版4はPhase 10-04で連絡する（本作業の時点で未連絡）**」 → 版4は連絡済み。`PROJECT_ARCHITECTURE.md`行265に「版4への版上げ（Phase 10-02。`ellipse`の`rotation`の追加）は連絡済み（Phase 10-04。エンジン本体（`oz/`）のコードの変更なしで…）」と書かれている（エンジン側の事実は本リポジトリ外のため照合できないが、同じ資料の記述と食い違う）。同じ行の「版3への版上げはエンジンへ連絡済み（Phase 09-04。2章）」とも、現在形の連絡済みと未連絡が並ぶ。書き出し形式の版が4であること自体は`js/io/SpriteSerializer.js:19`と一致。
* **タスク4：（対象：`PROJECT_ARCHITECTURE.md`3章3.「本体ドラッグの移動量」行367）**： 「`Shift`が効くのは本体の移動だけ（頂点のハンドル・範囲選択・パン・弧・矩形・円の作成では何もしない）」 → Phase 10で`Shift`は拡大縮小のドラッグ（`keepAspect: Boolean(event.shiftKey)`＝`js/core/InputTracker.js:1628`）・回転のドラッグ（`snapToStep: Boolean(event.shiftKey)`＝`:1654`）にも効く。`shiftKey`の読み取りは`:873`（線の先の限定）・`:1604`（本体の移動）・`:1628`・`:1654`の4か所。列挙された「何もしない」操作に拡大縮小・回転は入っていないが、「だけ」の文として読むと古い。
* **タスク4：（対象：`_doc/arch/07_KeyboardShortcuts.md`行20「テスト」）**： 「`findCancelableDragBinding`は`test/core/KeyboardShortcuts.test.js`で確かめる（…計9件。…）」 → 列挙された内容は6件（`describe`の`it`＝`test/core/KeyboardShortcuts.test.js:94・107・113・125・134・144`）に`isCancelableDrag`だけを欠く配線検証1件（`:61`）を足した7件。同ファイルの`it`の総数は現在11件（`node --test`で11件とも合格。Phase 10-02の時点の総数は9件、Phase 10-03で反転の2件を追加＝同ファイル行14に書かれている）。「9」は10-02の時点のファイル全体の件数と読めるが、今のファイル全体（11）・列挙の内訳（7）のどちらとも合わない。
* **タスク4：（対象：`_doc/arch/07_KeyboardShortcuts.md`行20末尾）**： 「`#handleKeyDown`を通した修飾キー付きの`Esc`は`document`に依存してテストできず」 → 仮の`document`を置いて`#handleKeyDown`を通すテストが既にあり（`test/core/KeyboardShortcuts.keydown.test.js:64〜96`）、`document`への依存（`js/core/KeyboardShortcuts.js:268・296・308`）はその仮の値で足りる。「今はテストが無い」だけが成り立つ。
* **タスク4：（対象：`_doc/arch/07_KeyboardShortcuts.md`行20「`isScalingSelection()`」）**： 「`isScalingSelection()`が一覧を使うことそのものは`DragTracker`・DOMに依存して確かめられず」 → `isScalingSelection()`が読むのは`this.state`だけ（`js/core/InputTracker.js:613〜615`）で、DOMの無い`node`でも`prototype`から呼んで確かめられる。DOMに依存するのは`InputTracker`の生成（`:498〜510`、`js/core/DragTracker.js:82〜85`）で、「今はテストが無い」だけが成り立つ。

## 6. 懸念事項・今後の修正における注意点
* （タスク2）`PROJECT_ARCHITECTURE.md`行218は1行約4,500字で、行全体が差分の`+`行のため、前半（Phase 10より前の列挙）を含む列挙・括弧書きを1項目ずつ照合した（4章タスク2の事実(A)〜(H)）。相違は既知の傷1の2件（版4・版3の連絡）だけで、そのほかは一致または所見（字義どおりに読むと足りない・広く読める記述。4章タスク2の所見）。「`Shift`が効くのは…だけ」「ドラッグの途中での`Alt`の切り替え」の2か所は、Phase 10で`Shift`・`Alt`が拡大縮小・回転のドラッグに効くようになったため、一般の文として読むと古い（文脈上は矛盾しないので相違にしていない。4章タスク2の所見）。修正するなら文脈を明記する。
* （タスク3）`PROJECT_ARCHITECTURE.md`の2章の対象行（235・237・246・258〜259・262・265〜266・270・274・278・286・296・329・338〜340）は、1行が数千字になる行（237・246・259）を含め、列挙・式・括弧書きを1項目ずつコードと照合した。相違は`15_io.md`行25の既知の傷1の1件だけ。次の2か所は相違にしていないが、修正するなら文脈を明記する：行246の「作業データの版は2のまま」（Phase 09-03aの時点の記述で、今の版は3）、`15_io.md`行36の「題を4へ直した」（`it`の題を指し、同じファイルの`describe`の題は版3のまま＝`test/io/FileContentReader.test.js:393`）。行265のエンジン側の事実は照合できなかった（本リポジトリの外）。
* （タスク4）`PROJECT_ARCHITECTURE.md`行371（約3,800字）・行363・行367は1行が長いため、列挙・括弧書きを1項目ずつコードと照合した。相違は4件：行367「`Shift`が効くのは本体の移動だけ」（Phase 10で拡大縮小・回転にも効くようになった）と、`07_KeyboardShortcuts.md`行20の3件（「計9件」＝今は列挙7件・ファイル全体11件、末尾の「`document`に依存してテストできず」、`isScalingSelection()`の「`DragTracker`・DOMに依存して確かめられず」）。修正するなら、行367は文脈を明記するか「本体の移動・拡大縮小・回転」へ、「計9件」は件数の数え方（列挙内かファイル全体か）を明記し、残り2件は「今はテストが無い」へ直す。次の所見は相違にしていない：`09_DragTracker.md`行3の「（拡大縮小のドラッグ中の`Esc`。3章25.）」は、同じ呼び出し（`cancelDraftOrClearSelection`の(1)）が回転のドラッグ中にも当たる（`InputTracker.js:672〜675`。回転は3章26.）が、呼び出し元の特定としては成り立つ。`PROJECT_ARCHITECTURE.md`行388の「360°の回転など前後が同じ」は`Line`1つで確かめただけ（`toRotationTransform`の内部は読んでいない）。`07_KeyboardShortcuts.md`行19・20のブラウザ・OSの挙動（色の欄のフォーカス・Windowsの`Ctrl`+`Esc`）は照合できなかった。
* （タスク18で、「読み方が分かれる記述」と「照合できなかった主張」の一覧を記載する）
