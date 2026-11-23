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
* [ ] タスク2: 1章「存在しないもの」
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
* [ ] タスク3: 2章（データ構造）と`15_io.md`・`17_sprite_check.md`
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
* [ ] タスク4: 3章の同期の経路・3.・6.と`07_KeyboardShortcuts.md`・`09_DragTracker.md`
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
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク3: 2章（データ構造）と`15_io.md`・`17_sprite_check.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
### タスク4: 3章の同期の経路・3.・6.と`07_KeyboardShortcuts.md`・`09_DragTracker.md`
* **調査内容**:
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）
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

## 6. 懸念事項・今後の修正における注意点
* （タスク18で、「読み方が分かれる記述」と「照合できなかった主張」の一覧を記載する）
