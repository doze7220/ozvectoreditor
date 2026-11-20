# RES: 調査計画・調査レポート Survey : Phase 9 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261120_1620_REQ_Survey_Phase09_Doc_Consistency.md`

## 1. 調査目的
Phase 8 クローズ後の Interrupt「線を続けて引く」と Phase 9「曲線のパス」の各サブフェイズ（09-01a・09-01b・09-02a・09-02b・09-03a・09-03b・09-04）の最終タスクで開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）へ反映された記述が、現在の `HEAD` の実コードの事実と食い違っていないかを確かめる。各サブフェイズの反映時点ではそのサブフェイズの差分監査に合格しているため、特に **後のサブフェイズのコード変更によって、前のサブフェイズで書いた記述が古くなっていないか** を重点的に見る。重点の例：
* Interrupt で書いた「線を続けて引く」・`isDrawnLineShape`・`isJoinableLine`・`EndpointSnapper.isDrawingLine()` の記述が、09-01a の曲線のツール・09-01b の曲線のパスの結合・09-03a/b の今の曲線・弧の結合の後も成り立つか。
* 09-01a で書いた区間の種類（`'line'`・`'smooth'`）・`ACCEPTED_SEGMENT_KINDS`・`fromJSON` の検証・書き出しの `bezierPath` の記述が、09-02a の `corners` と 09-03a の `'bezier'` の追加後も成り立つか。
* 09-01b で書いた結合の結果の区間の種類の保ち方・`segmentKindsOf` の記述が、09-02b の公開化と 09-03a の `chainSourceOf` の追加後も成り立つか。
* 09-02a で書いた角の点・`PathCornerRules`・`PathCornerEditor`・`OptionBarCornerGroup` の記述が、09-02b で同じクラスが区間の切り替えも受け持った後も成り立つか。
* 09-02b で書いた「直線に」「曲線に」・`PathSegmentKindRules.changedSegmentIndexes` の記述が、09-03a の `'bezier'` の追加後も成り立つか。
* 09-03a で書いた「弧は結合できない」に当たる記述が、09-03b の後に残っていないか。

本RESは調査計画であり、計画立案・タスク実行のいずれの工程でも、ソースコードおよび資料ファイルの修正・作成を一切行わない（変更してよいのは本RESファイルだけ）。

## 2. 調査要件
### 要件1: 差分で追加・変更された記述の照合
* 【照合の対象】の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。照合するのは次のような、コードで真偽を確かめられる主張である：
  * ファイル・フォルダの存在と配置（1章のフォルダ構成図。新設の`js/edit/PathCornerEditor.js`・`js/palette/OptionBarCornerGroup.js`・`js/shapes/PathCornerRules.js`・`js/shapes/PathSegmentKindRules.js`と`test/` 配下の新設5ファイルを含む。「存在しないもの」として書かれたものが実際に無いことを含む）
  * import の有無・向き（1章「依存方向」とその例外、`_doc/arch/` 各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの。とくに`PathSegmentKindRules`が`PathJoinRules`をimportする理由、`edit/`が`shapes/`をimportする例外の列挙）
  * 公開メソッド・公開の関数・定数・typedef・列挙の一覧と、識別子の値（区間の種類の定数`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`・`SEGMENT_KIND_BEZIER`と`ACCEPTED_SEGMENT_KINDS`、`SMOOTH_SEGMENT_SAMPLE_COUNT`、`CLOSED_MIN_POINTS`、`QUARTER_ELLIPSE_BEZIER_K`、`formatVersion`の値と`checkFormat`が受理する版、`PathJoinRules`の公開の関数（`isJoinableLine`・`isDrawnLineShape`・`chainSourceOf`・`segmentKindsOf`・`segmentSpecsOf`・`reverseSegmentSpec`・`classifyJoin`・`planJoin` 等）、`readCornerFlags`、`CornerTarget`・`SegmentSwitchTarget`の形、`ToolRules`の`TOOL_IDS` 等）
  * 図形データ・作業データ・書き出し形式の形（`path`の`segments`・`corners`・`'bezier'`の区間のキー順、`toJSON()`が`corners`を出す条件、`fromJSON`の検証とエラー文、作業データの版（2）、書き出しの`bezierPath`の`segments`の形・`cubic`の制御点、塗る条件、外枠の求め方（`cubicAxisRange`）、`CodeExporter`の`DRAW_SOURCE`の描き方）
  * 形の決め方の式（`computeSmoothSegmentControls`の式と仮の点・角の点の効き方、今の曲線の2次→3次の式、弧の近似の制御点の式と係数）。式の記述は、コードの式と1項ずつ照らす。
  * 状態の持ち主・初期値・通知（作成途中の図形の持ち主と`replaceDraft`の約束、`replaceShape`の通知の回数、取り消し・やり直しで頂点の選択が外れること、作業データ・履歴に入れていないもの）
  * 既定値・定数（吸い付きの画面上5px、点が2つで終えたときの図形の種類、曲線のツールの作成途中の図形の形（頂点2つ・区間1つ）、`ShapeFactory.create('curve')`の戻り値の`type` 等）
  * 引数・戻り値・通知の回数など、関数の振る舞いの記述（結合・描き足し・閉じる・端点をまとめるときの区間の種類・角の点・引っ張る点の保ち方、逆順にするときの入れ替え、`setVertex`・`translate`が引っ張る点を動かす規則、「角」のチェックボックスの状態の決め方、「直線に」「曲線に」の対象の区間と結果、押せる/押せないの条件 等）
  * 呼び出し元・呼び出し順・記録の時点（3章11.・12.・22.〜24.の「流れ」「履歴の単位」「記録する操作と時点」、クリックの判定の順、`Backspace`/`Delete`・取り消しで最後の点を消す経路、ツールの切り替えで描いた分を残す経路 等）
  * `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先・行数）
  * `InputTracker` の記述（`_doc/arch/06_InputTracker.md`。行数、公開メソッド（`finishLineDrawing`・`removeLastLinePoint`・`deleteLastLinePointOrSelection` 等）、線を引いている途中の点を打つ・終える・最後の点を消す枝）
  * `KeyboardShortcuts` のキーの対応表（`_doc/arch/07_KeyboardShortcuts.md`）
  * 数値（行数：`main.js`・`InputTracker.js` 等、資料に書かれた行数すべて。過去の時点の値として書かれたものは現在の値と区別し、`git show <コミット>:<パス>` で確かめられる範囲で確かめる）。行数は `wc -l` 等で実測し、資料の値と並べて記載する。
  * `index.html` の要素・属性・クラス・幅の見積もりのコメント（`_doc/arch/01_index_html.md`。「角」のまとまり・「直線に」「曲線に」のボタンのid・`title`・初期の`disabled`、オプションバーの幅の見積もり 等）
  * 確認用ページの記述（`_doc/arch/17_sprite_check.md` と `sprite-check.html`・`js/` の確認用ページのモジュール）
  * 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在、テストの内容の記述が実際のテストケースと合っているか、テストの件数、「テストできない箇所」の一覧）。テストの件数は、プロジェクトのルートで `node --test`（ファイル単位なら `node --test <ファイル>`）を実行して確かめてよい（ファイルを書き換えない実行に限る）。
* 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲（例：「直線の区間と曲線の区間のつなぎ目は常に角が立つ」「曲線のツールで点2つで終えたら直線」「片側が直線の点は角のチェックが入ったまま押せない」「今の曲線は『曲線に』で変わらない」「弧自身のハンドルは吸い付かない」）だけを照合し、方針そのものの是非は扱わない。
* 実際のブラウザでの見え方・実測値についての記述（1280px幅での右端の位置、記号の字形 等）は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。
* 本リポジトリの外についての記述は、原則として「照合できなかった主張」とする。ただし `PROJECT_ARCHITECTURE.md` 2章「エンジンとの約束」の(b)については、OZ Engine の `D:\ozlab\ozengine-web\oz\ENGINE_API.md` 23章と `D:\ozlab\ozengine-web\js\scenes\FlightScene.js` の2ファイルだけを**読み取りのみ**で参照して照合してよい（エンジンのリポジトリのほかのファイルは読まない。どのファイルも変更しない）。この参照はタスク2だけが行う。

### 要件2: Interrupt と Phase 9 で変わった・広がった・公開の形が変わったものが、資料に古い形のまま残っていないか
* Interrupt と Phase 9 ではファイル・クラスの削除・改名は無く、ソース4ファイル・テスト5ファイルが新設された。そのかわり次の変化がある。これらが資料に「今もそうである」と読める形で残っていないかを確かめる。
  * **結合できる線が広がった**：直線・開いたパス → 区間の種類によらない開いたパス（09-01b）・今の曲線（09-03a）・弧（09-03b）。「曲線のパス・今の曲線・弧は結合できない」「結合できる線は直線と直線のパスだけ」と読める記述。
  * **曲線のツールの作るものが変わった**：今の曲線（`curve`。1本の2次の曲線）→ 点を打つ曲線のパス（09-01a。`ShapeFactory.create('curve')`の戻り値の`type`は`'path'`）。「曲線のツールは`Curve`を作る」「`create(type)`の戻り値の`type`は常に引数と一致する」と読める記述。
  * **区間の種類が増えた**：`'line'`のみ → `'line'`・`'smooth'`（09-01a）・`'bezier'`（09-03a）。「`kind`は`'line'`のみ」「パスは区間がすべて直線」と読める記述。
  * **書き出し形式の版が上がった**：版2 → 版3（09-01a。描画要素`bezierPath`の追加）。「現行の書き出し形式は版2」「パスは常に`polyline`」と読める記述（作業データの版は2のままである点と取り違えていないかも見る）。
  * **公開の形が変わったもの**：`ShapeDataValidation`の`isPlainObject`のexport（09-01a。`Path.js`の同名の非公開関数は消えた）、`PathJoinRules.segmentKindsOf`の公開（09-02b）、`Path`の区間の種類の定数のexport、`PathCornerEditor`・`OptionBarCornerGroup`が区間の切り替えも受け持つこと（09-02b）。「非公開」「`Path.js`が自前で持つ」「角だけを扱う」と読める記述。
  * **線を引いている途中かの判定**：`EndpointSnapper.isDrawingLine()`が直線のツールだけに当たると読める記述（09-01a以降は曲線のツールの作成途中の線も当たる）。
* 洗い出しは `git diff --name-status 7e0f93f 0979518 -- js index.html test asset sprite-check.html` と【照合の対象】の差分の `-` 行で行い、**現在の実コードの事実**（その名前がどこにあるか・どこから呼ばれるか）を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）を検索する。
* 本要件は、差分のない行については名前・語の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。「Phase 05 では」「09-01a の時点では」のように経緯・過去の状態として正しく書かれているものは相違としない。

### 要件3: 照合の結果の整理
* 相違が見つかった記述は、5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で、タスク番号を添えて記載する。
* 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものがあれば、4章の各タスクの「推測・所見」に記載する（5章には入れない）。
* 照合した主張と結果を、資料のファイル（節）ごとに4章の各タスクの欄へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、その理由を書く）。
* **既知の傷1件**（現場設計セッションが把握している。確認漏れと区別するため、タスク7で確かめて5章へ必ず挙げる）：
  1. `js/shapes/PathSegmentKindRules.js` の `SegmentSwitchTarget` のJSDocは、`js/shapes/PathCornerRules.js` の `CornerTarget` と同じ形であることに触れているが、`CornerTarget` 側のJSDocは `SegmentSwitchTarget` に触れていない（09-02b で `PathCornerRules.js` を変えない約束だったため。`_doc/arch/12_shapes.md` と `PROJECT_ARCHITECTURE.md` 3章24. には両者が同じ形であることが書かれている）。**これはコードのコメントの側の小さな残り**であり、5章に「資料は正しく、コードのJSDocが片側だけ」と分かる形で書く。

### 参照する責務
（照合の対象は資料の原文そのものであるため、ここには資料の記述を書き写さない。以後のタスク実行チャットは、次の事項に従う。タスク実行チャットはREQを読まないため、判定の基準は上の要件1〜3がすべてである。）

* **作業の禁止事項**：ソースコード・資料ファイル（`./PROJECT_ARCHITECTURE.md`・`./_doc/` 配下・`./index.html`・`./sprite-check.html`・`./js/`・`./test/`・`./asset/`）を一切変更・作成しない。変更してよいのは本RESファイル（4章の自分のタスクの欄・5章・6章・3章の自分のタスクの `[ ]`→`[x]`）だけ。git のリポジトリ状態を変える操作（commit・checkout・reset・stash 等）をしない。`git show <コミット>:<パス>` の出力をリポジトリ内のファイルに保存しない（一時ファイルが要るならスクラッチ用のディレクトリを使う）。

* **照合の対象を取得する方法**：
  * 照合の対象は、`git diff 7e0f93f 0979518 -- PROJECT_ARCHITECTURE.md _doc/arch` の `+` 行だけである（`7e0f93f`＝Phase 8 のクローズを記録したコミット、`0979518`＝Phase 09-04 の完了のコミット。`0979518` から `HEAD` までに資料・コードの変更は無いので、差分の `+` 行は現在のファイルの同じ行番号の行と同じ内容である）。
  * 自分のタスクの対象ファイルの `+` 行の行番号は `git diff -U0 7e0f93f 0979518 -- <資料のファイル>` のハンクの見出し（`@@ -a,b +c,d @@` の `+c,d`。`d` を省いたものは1行）で分かる。3章の各タスクの「対象ファイル」に、担当する `+` 行の行番号をすべて列挙してある。**列挙された行番号の行だけが自分の照合の対象**であり、同じファイルの他の `+` 行は他のタスクの担当である（要件2のタスク13を除く）。
  * 資料の1行は数千字になることがある。`Read` は長い行を途中で切ることがあるため、行の全文は Bash の `sed -n '<行番号>p' <資料のファイル>`（または `git diff -U0 7e0f93f 0979518 -- <資料のファイル>` の該当の `+` 行）で取り出して読む。行の一部だけを読んで一致と判定しない。
  * 行の内容が置き換え（`-` 行と `+` 行の組）の場合、`-` 行は「以前の記述」として経緯の確認に使ってよいが、照合の対象は `+` 行である。
  * 記述の経緯を確かめる必要が生じた場合に限り、次の作業計画書・作業レポートの該当箇所だけを `Grep` で探して参照してよい（全文は読まない）：`./_log/res/261118_1532_RES_Interrupt_Continuous_Line.md`・`./_log/res/261118_1937_RES_Phase09-01a_Curve_Tool.md`・`./_log/res/261119_1059_RES_Phase09-01b_Curve_Join.md`・`./_log/res/261119_1415_RES_Phase09-02a_Corner_Point.md`・`./_log/res/261119_1804_RES_Phase09-02b_Segment_Kind_Switch.md`・`./_log/res/261119_2113_RES_Phase09-03a_Curve_Join.md`・`./_log/res/261120_1131_RES_Phase09-03b_Arc_Join.md`・`./_log/res/261120_1441_RES_Phase09-04_Engine_Roundtrip.md`。RESの記述は判定の根拠にしない（判定の根拠は実コードだけ）。
  * 過去の時点の値（「Phase 09-01a完了時」の件数・行数など）を確かめるときの各区切りのコミット：Interrupt 完了 `ee01323`、09-01a 完了 `be6dd64`、09-01b 完了 `6105b14`、09-02a 完了 `1402fc5`、09-02b 完了 `d495ae4`、09-03a 完了 `f0f5058`、09-03b 完了 `47d1dba`、09-04 完了 `0979518`（起点は `7e0f93f`）。行数は `git show <コミット>:<パス> | wc -l` で確かめる。テストの件数の増分は `git diff <前の区切り> <後の区切り> -- <テストファイル>` の追加された `it(`・`describe(` の行を数えて確かめてよい（ループで生成するケース等で数えられない場合は「照合できなかった主張」として理由を書く）。全体の件数は過去の時点では実行できない（チェックアウトしない）ため、現在の値だけを `node --test` で確かめ、過去の全体の件数は各区切りの差分の数え上げで確かめられた範囲に留める。
  * 照合に使う実コードは、現在の作業ツリーの `./index.html`、`./sprite-check.html`、`./js/` 配下、`./test/` 配下、`./asset/` 配下。3章の各タスクの「照合に使う主なコード」は目安であり、記述の照合に必要ならこれ以外のファイルも読んでよい。Interrupt と Phase 9 で変更されたコードの一覧は `git diff --stat 7e0f93f 0979518 -- js index.html test asset sprite-check.html`（41ファイル）で得られる。
  * 行数は Bash の `wc -l <ファイル>` で実測する。最終行に改行が無いファイルは `wc -l` が1少なく出るため、`tail -c1 <ファイル> | od -c` で最終行の改行の有無を確かめ、資料の値と並べて記載する。
  * `node --test`（全体）・`node --test <ファイル>` は、ファイルを書き換えない実行に限り行ってよい。

* **照合する主張の種類と、照合しないもの**：上の要件1（タスク1〜12）・要件2（タスク13）の基準に従う。要約すると、コードで真偽を確かめられる事実の主張は1つずつ照合し、意図・方針の記述はコードの振る舞いとして確かめられる範囲だけを照合し、ブラウザでの見え方・リポジトリの外の記述は「照合できなかった主張」として理由を書く（ただし詳細は必ず要件1・要件2の本文に従う）。資料に書かれていない事項がコードに存在することは相違とみなさない。

* **結果の書き方**（各タスク共通）：
  * 実コードから読み取れる事実のみを抽出して4章の自分のタスクの『事実（実コードの記述）』に書き、推測を含める場合はどこまでが事実でどこからが推測かを明示して『推測・所見』に書く。
  * 照合した主張と結果を、資料のファイル（節。`PROJECT_ARCHITECTURE.md` は章・項の番号と行番号）ごとにまとめる。一致したものは「一致」と短く書いてよいが、確かめたコードの場所（`ファイル:行`、または検索した語と件数）を必ず添える。
  * 相違の判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・Phase 9 のRESの記述だけで一致と判定しない）。
  * 相違があった場合は、5章に「**（タスクN）（対象：資料のファイルと節・行番号）**：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で追記する（作業は中断しない）。資料の記述は該当部分を原文のまま短く引く。
  * 相違ではないが記述があいまいで実コードと照らして複数の読み方ができるものは、4章の自分のタスクの『推測・所見』に「読み方が分かれる記述：」として書く（5章には入れない）。照合できなかった主張は『推測・所見』に「照合できなかった主張：」として理由とともに書く。
  * タスクの終わりに `git status` を実行し、変更があるのは本RESファイルだけであることを確認して、その結果を4章の自分のタスクの『調査内容』の末尾に1行で書く。最後に3章の自分のタスクを `[x]` にする。

* **閲覧してよい資料**：各タスク実行チャットは、3章の自分のタスクの「対象ファイル」に指定された資料のファイル・節（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）を読んでよい。前後の文脈の確認のため同じファイルの他の行を読んでもよいが、照合の対象は自分の担当の `+` 行だけである。タスク13は `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイルを検索・閲覧してよい。`_doc/` の他のファイル（`COWORK_STATUS.md`・`COWORK_HANDOFF.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_MILESTONE.md` 等）と `_log/dir/` 配下は読まない。本リポジトリの外のファイルは、タスク2が要件1で許された OZ Engine の2ファイルを読み取りのみで参照する場合を除き読まない。

* **タスクの独立性**：各タスクは他のタスクの調査結果（4章の他のタスクの欄）を読まずに実行する。5章・6章への追記は末尾に足す（他のタスクの記載を書き換えない）。

## 3. タスクリスト
* [x] タスク1: `PROJECT_ARCHITECTURE.md` 1章（フォルダ構成・存在しないもの・各フォルダの役割・依存方向）の照合（`+` 行 約1.9万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 1章「プロジェクトフォルダ構造」（15〜214行）の `+` 行：63〜66行・75行・97行・135行・152〜153行・170〜171行（フォルダ構成図）、201行（「存在しないもの」）、205行（`shapes/` の役割）、208行（`edit/` の役割）、211行（「依存方向」とその例外）:（照合）
    * 照合に使う主なコード：`./js/` 配下・`./test/` 配下のファイルの実在（`Glob`・`ls`）、全 `.js` の import 文（`grep -rn "^import" js`）、各ファイル先頭の責務定義のJSDoc :（監査）
  * **調査内容**:
    * フォルダ構成図に足された行のファイルが、書かれたフォルダの位置に実在するか、行末のコメントの説明（何の規則・何を受け持つか）がファイル先頭の責務定義・公開の関数と食い違わないか。
    * 201行の「存在しないもの」として書かれたものが実際に無いか（名前・機能の検索で確かめる）。
    * 205・208行の各フォルダの役割の記述と、そこに列挙されたファイル・import の例外が実在・実際の import と一致するか。
    * 211行の依存方向（`main.js → edit → io → core → shapes` 等）と、その例外として列挙された import が、実際の import 文と過不足なく一致するか（とくに `edit/` が `shapes/` を import する例外の列挙、`PathSegmentKindRules` が `PathJoinRules` を import する理由）。例外として列挙されていない逆向き・飛び越しの import が無いかも、import 文の一覧から確かめる。
* [ ] タスク2: `PROJECT_ARCHITECTURE.md` 2章（図形データ・書き出し形式・エンジンとの約束・直前に使った値）と `_doc/arch/15_io.md`・`17_sprite_check.md` の照合（`+` 行 約2.5万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 2章「データ構造（Model）の概要」（215〜327行）の `+` 行：225〜230行・232行（図形データの`path`。区間・角の点・曲がり方を持つ区間・曲線の区間の形の決め方・作業データの版）、245〜246行・251〜254行・260行・263〜265行（エンジンとの約束、スプライトデータ（書き出し形式の版3）、描画要素、塗る条件、外枠、2つの版）、321行・324行（新しく描く図形のスタイル（直前に使った値）の当てる場所・当てないもの）:（照合）
    * `./_doc/arch/15_io.md` の `+` 行：8〜9行・25行・31行・36行 :（照合）
    * `./_doc/arch/17_sprite_check.md` の `+` 行：19行 :（照合）
    * 照合に使う主なコード：`./js/shapes/Path.js`・`./js/shapes/ShapeGeometry.js`・`./js/shapes/ShapeDataValidation.js`・`./js/shapes/Curve.js`・`./js/shapes/Ellipse.js`（`toDrawElement`）・`./js/io/SpriteSerializer.js`・`./js/io/CodeExporter.js`・`./js/io/DocumentSerializer.js`・`./js/core/VectorModel.js`（直前に使った値の当て方）・`./js/check/` 配下・`./sprite-check.html` :（監査）
    * 読み取りのみで参照してよい外部ファイル（245行の(b)の照合に限る）：`D:\ozlab\ozengine-web\oz\ENGINE_API.md` の23章、`D:\ozlab\ozengine-web\js\scenes\FlightScene.js` :（参照）
  * **調査内容**:
    * `path` の図形データの形（`segments` の各区間の形・`'bezier'` の区間のキー順、`corners` の形と `toJSON()` が出す条件）、`fromJSON` の検証とエラー文、作業データの版（2）、`ACCEPTED_SEGMENT_KINDS` 等の定数の値を、`Path.js`・`ShapeDataValidation.js`・`DocumentSerializer.js` の該当行と照らす。
    * 229行の曲線の区間の形の決め方の式（`computeSmoothSegmentControls` の式と仮の点・角の点の効き方）を、`ShapeGeometry.js` の式と1項ずつ照らす。
    * 書き出し形式（`formatVersion` の値・`checkFormat` が受理する版、`polyline`・`bezierPath`・`quadratic`・`ellipse` の描画要素のキーと値の形、`cubic` の制御点、塗る条件、形の項目が足りない要素の扱い、外枠の求め方（`cubicAxisRange`））を `SpriteSerializer.js`・`CodeExporter.js`（`DRAW_SOURCE`）・各図形の `toDrawElement` と照らす。
    * 245行の「エンジンとの約束」(b) を、許可された OZ Engine の2ファイルと照らす（(a) ほかリポジトリの外の記述で照合できないものは理由を書く）。
    * 321・324行の直前に使った値を当てる場所・当てないものを、`VectorModel.js` 等の呼び出し箇所と照らす。
    * `15_io.md`・`17_sprite_check.md` の各行（角の点・曲がり方を持つ区間の扱い、「知らないこと」、版3の読み込み、確認用ページの判定の条件）を、`io/` 配下と `js/check/` 配下・`sprite-check.html` の該当行と照らす。
* [ ] タスク3: `PROJECT_ARCHITECTURE.md` 3章の既存の項（1.〜10.・13.〜21.）への追記の照合（`+` 行 約2.2万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章「描画・操作フロー（実行サイクル）」の `+` 行：338行・343〜344行・347行（3. 入力監視）、359〜360行・369〜370行・373行・381〜382行（6. 履歴）、497行（13. オプションバー（スタイルのまとまり））、533〜534行（16. 選択と移動の操作）、546行・548行・552行・555〜557行・564行（17. スナップ）:（照合）
    * 照合に使う主なコード：`./js/core/InputTracker.js`・`./js/core/KeyboardShortcuts.js`・`./js/core/VectorModel.js`・`./js/core/HistoryManager.js`・`./js/core/UnitSnapRules.js`・`./js/edit/EndpointSnapper.js`・`./js/edit/ShapeInserter.js`・`./js/main.js` :（監査）
  * **調査内容**:
    * 3.の入力監視の追記（端点への吸い付き・本体ドラッグの移動量・頂点のハンドルのドラッグと図形の作成で打つ点・キーボード操作（`Esc`・`Backspace`/`Delete`・`Ctrl`+`Z` の線を引いている途中の扱い））を、`InputTracker.js`・`KeyboardShortcuts.js` の該当の枝と照らす。
    * 6.の履歴の追記（記録する操作と時点：図形の作成・削除・角の切り替え・区間の切り替え、記録しない操作、取り消しの手順の 1b. と 2.）を、`main.js` の `performUndo` 等・`InputTracker.js`・`HistoryManager.js` の呼び出し順と照らす。
    * 13.・16.・17.の追記を、それぞれの記述が名指しするコード（オプションバーのまとまり・選択と移動・スナップの関数）と照らす。とくに 17. の線を続けて引くときの丸め（`UnitSnapRules` の基準点からの丸め等）を、`UnitSnapRules.js` と `InputTracker.js` の呼び出しと照らす。
* [ ] タスク4: `PROJECT_ARCHITECTURE.md` 3章11.（結合）・12.（端点への吸い付きと描き足し）と `_doc/arch/14_edit.md`（依存・`PathJoiner`・`EndpointSnapper` の節）の照合（`+` 行 約2.5万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章の `+` 行：443行・451〜456行・458〜459行（11. 結合（選択中の線の結合））、462〜467行・471〜472行・476〜477行・480〜481行（12. 端点への吸い付きと描き足し）:（照合）
    * `./_doc/arch/14_edit.md` の `+` 行：4行（`edit/` の依存）、35行（`PathJoiner.js`）、39〜42行（`EndpointSnapper.js`）:（照合）
    * 照合に使う主なコード：`./js/edit/PathJoiner.js`・`./js/edit/EndpointSnapper.js`・`./js/shapes/PathJoinRules.js`・`./js/shapes/EndpointSnapRules.js`・`./js/main.js`（`performJoin` 等）・`./js/core/InputTracker.js`（吸い付きの配線）・`./index.html`（`#selection-join`）、`edit/` 配下全ファイルの import 文 :（監査）
  * **調査内容**:
    * 11.の結合できる線（直線・開いたパス（区間の種類によらない）・今の曲線・弧）、結合の判定・組み立ての流れ（`isJoinableLine`・`classifyJoin`・`planJoin`・`buildJoinedPath`・`buildClosedPath` 等）、結合の結果の区間の種類・角の点・曲がり方を持つ区間の保ち方、逆順にするときの入れ替え、履歴の単位を、`PathJoinRules.js`・`PathJoiner.js`・`main.js` と照らす。今の曲線の2次→3次の式・弧の近似の制御点の式と係数が書かれていれば、コードの式と1項ずつ照らす。
    * 12.の吸い付きの対象・許容（画面上5px）・描き足し・閉じる・端点をまとめるときの区間の種類と角の点の保ち方、吸い付く/吸い付かないもの（弧自身のハンドル等）を、`EndpointSnapRules.js`・`EndpointSnapper.js`・`InputTracker.js` と照らす。
    * `14_edit.md` 4行の依存の記述（「importは〜のみ」と例外の列挙）を `edit/` 配下全ファイルの import 文と照らし、35行・39〜42行の公開メソッド・依存（`model` の使うメソッド）・契約を、`PathJoiner.js`・`EndpointSnapper.js` の公開メソッドと実装と照らす。
* [ ] タスク5: `PROJECT_ARCHITECTURE.md` 3章22.（直線・曲線のツールで線を続けて引く）と `_doc/arch/06_InputTracker.md`・`07_KeyboardShortcuts.md` の照合（`+` 行 約3.0万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章22.「直線・曲線のツールで線を続けて引く」（638〜661行）の `+` 行：638〜661行（全行）:（照合）
    * `./_doc/arch/06_InputTracker.md` の `+` 行：2行・8〜9行・20行・28行・35〜38行・40行・42行 :（照合）
    * `./_doc/arch/07_KeyboardShortcuts.md` の `+` 行：14行 :（照合）
    * 照合に使う主なコード：`./js/core/InputTracker.js`・`./js/core/KeyboardShortcuts.js`・`./js/edit/EndpointSnapper.js`・`./js/shapes/PathJoinRules.js`（作成途中の線の点の並びの関数・`isDrawnLineShape`）・`./js/shapes/EndpointSnapRules.js`・`./js/core/VectorModel.js`（`replaceDraft`）・`./js/core/ShapeFactory.js`・`./js/main.js` :（監査）
  * **調査内容**:
    * 22.の流れ（点を打つ・付いてくる線・終える・最後の点を消す・閉じる・ツールの切り替えで描いた分を残す経路、クリックの判定の順、点が2つで終えたときの図形の種類、曲線のツールの作成途中の図形の形（頂点2つ・区間1つ）、作成途中の図形の持ち主と `replaceDraft` の約束、履歴の単位）を、`InputTracker.js`・`EndpointSnapper.js`・`PathJoinRules.js`・`VectorModel.js` の該当行と照らす。`EndpointSnapper.isDrawingLine()` が直線・曲線の両方のツールの作成途中の線に当たるかを確かめる。
    * `06_InputTracker.md` の公開メソッドの一覧（`finishLineDrawing`・`removeLastLinePoint`・`deleteLastLinePointOrSelection` 等）、`abortOngoingOperation()`・`cancelDraftOrClearSelection()` の振る舞い、修飾キー、端点への吸い付きの配線と表示を消す箇所、スナップの記述を `InputTracker.js` と照らし、42行の行数（現在の値と過去の時点の値）を `wc -l`・`git show` で実測して並べる。
    * `07_KeyboardShortcuts.md` 14行のキーの対応を、`KeyboardShortcuts.js` のキーの分岐とコールバックと照らす。
* [ ] タスク6: `PROJECT_ARCHITECTURE.md` 3章23.（点の滑らかさ（角））・24.（区間の直線⇔曲線の切り替え）と `_doc/arch/13_palette.md`・`14_edit.md`（`PathCornerEditor` の節）の照合（`+` 行 約3.0万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章の `+` 行：662〜677行（23. 点の滑らかさ（角））、678〜692行（24. 区間の直線⇔曲線の切り替え）:（照合）
    * `./_doc/arch/13_palette.md` の `+` 行：1行（`palette/` の総論）、50〜58行（`OptionBarCornerGroup.js`）:（照合）
    * `./_doc/arch/14_edit.md` の `+` 行：76〜82行（`PathCornerEditor.js`）:（照合）
    * 照合に使う主なコード：`./js/shapes/PathCornerRules.js`・`./js/shapes/PathSegmentKindRules.js`・`./js/edit/PathCornerEditor.js`・`./js/palette/OptionBarCornerGroup.js`・`./js/main.js`（`performCornerToggle`・`performSegmentKindSwitch`・`// 7.12.` のブロック）・`./js/shapes/Path.js`（`corners`・区間の種類）・`./js/shapes/ShapeGeometry.js`（角の点の効き方）・`./index.html`（`#option-corner-group`） :（監査）
  * **調査内容**:
    * 23.の角を操作できる点の条件、「角」のチェックボックスの状態（`CornerState` の4つ）の決め方、`readCornerFlags`、切り替えの結果・履歴の単位・押せる/押せないの条件（片側が直線の点・曲がり方を持つ区間の点 等）を、`PathCornerRules.js`・`PathCornerEditor.js`・`main.js` と照らす。
    * 24.の「直線に」「曲線に」の対象の区間・結果（`'bezier'` の区間の扱い、今の曲線は「曲線に」で変わらないこと等）、押せる/押せないの条件、`changedSegmentIndexes`、`CornerTarget` と `SegmentSwitchTarget` が同じ形であることの記述を、`PathSegmentKindRules.js`・`PathCornerRules.js`・`PathCornerEditor.js` と照らす（`SegmentSwitchTarget`・`CornerTarget` のJSDocの片側だけの記載はタスク7が5章に挙げるため、本タスクでは資料の記述とコードの形の一致だけを確かめ、重ねて5章に挙げない）。
    * `13_palette.md` の総論と `OptionBarCornerGroup.js` の公開メソッド・注入（コールバック3つ）・表示の規則・`change` のとき・「知らないこと」（importを持たない）・二重定義のtypedefを、`OptionBarCornerGroup.js` の実装と import 文、`PathCornerRules.js`・`PathSegmentKindRules.js` のtypedefと照らす。
    * `14_edit.md` 76〜82行の `PathCornerEditor.js` の公開メソッド・依存（コンストラクタの引数と `model` の使うメソッド）・契約・区間の切り替え・前提・テストのファイル名を、`PathCornerEditor.js`・`main.js`・`test/edit/` の実在と照らす。
* [ ] タスク7: `_doc/arch/12_shapes.md`（`shapes/`）の照合と既知の傷の確認（`+` 行 約3.8万バイト）
  * **対象ファイル**:
    * `./_doc/arch/12_shapes.md` の `+` 行：3行・6〜10行・13〜15行・17〜18行・21〜34行・37行・40行・51〜52行・63行・77行・80〜81行・83〜88行 :（照合）
    * 照合に使う主なコード：`./js/shapes/` 配下（`ShapeGeometry.js`・`PathJoinRules.js`・`EndpointSnapRules.js`・`PathCornerRules.js`・`PathSegmentKindRules.js`・`Path.js`・`ShapeDataValidation.js`・`Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`）と、「使う側」の記述の確認のための全 `.js` の import 文 :（監査）
  * **調査内容**:
    * `ShapeGeometry.js`・`PathJoinRules.js`・`EndpointSnapRules.js`・`PathCornerRules.js`・`PathSegmentKindRules.js` の各節（公開の一覧・読むもの・使う側・知らないこと・区間の種類・角の点・注意）を、各ファイルの export・import・実装と照らす（公開の一覧は export の全件と過不足を比べる。「使う側」は `grep -rn "from '.*<ファイル名>'" js` の件数と照らす）。
    * 図形のインターフェースの節（`isFillable()`・`hitTestFill`・`intersectsRect`・`toDrawElement()`）と `Path.fromJSON`・弧は結合できる線（77行）・`Path.js` の節（80〜88行。区間の種類・曲がり方を持つ区間・角の点・`hitTestHandle` の戻り値・不変条件・やらないと決めたこと）を、各図形クラスの実装と照らす。`setVertex`・`translate` が引っ張る点を動かす規則、逆順にするときの入れ替えの記述があれば実装と照らす。
    * **既知の傷**：`PathSegmentKindRules.js` の `SegmentSwitchTarget` のJSDocと `PathCornerRules.js` の `CornerTarget` のJSDocを両方開き、前者が後者と同じ形であることに触れ、後者が前者に触れていないことを確かめ、`12_shapes.md` の両者が同じ形であるとの記述が型の形として正しいことを確かめたうえで、5章に「資料は正しく、コードのJSDocが片側だけ」と分かる形で必ず挙げる。
* [ ] タスク8: `_doc/arch/16_test.md` のうち既存のファイルの説明と Interrupt・09-01a・09-01b の追加分の照合（`+` 行 約2.2万バイト）
  * **対象ファイル**:
    * `./_doc/arch/16_test.md` の `+` 行：10行・16行・18行・20〜21行・30行・34行（既存のテストファイルの説明への追記）、116〜148行（Interrupt「線を続けて引く」・Phase 09-01a・Phase 09-01b の追加・書き換え分・テストできない箇所・件数）:（照合）
    * 照合に使う主なコード：`./test/` 配下（記述が名指しするテストファイル）と、テストできない箇所として名指しされたコード（`./js/core/InputTracker.js` 等）:（監査）
  * **調査内容**:
    * 名指しされたテストファイルの実在と、テストの内容の記述（何をテストしているか・`describe` 名）が実際のテストケースと合っているかを、テストファイルの該当の `describe`・`it` と照らす。
    * 件数の記述（ファイルごとの「+N件・`describe`+M」、各区切りの全体の件数）を、参照する責務の「過去の時点の値を確かめるときの各区切りのコミット」（Interrupt：`7e0f93f`→`ee01323`、09-01a：`ee01323`→`be6dd64`、09-01b：`be6dd64`→`6105b14`）の差分の数え上げで確かめる。
    * 「書き換えた既存のテスト」の記述を、同じ区切りの差分の `-` 行（期待値の変更）と照らす。
    * 「テストできない箇所」の一覧が、テストの無い箇所として実際にテストから呼ばれていないか（DOM・`InputTracker` の配線等）を、テストファイルの import と照らす。
* [ ] タスク9: `_doc/arch/16_test.md` のうち 09-02a・09-02b・09-03a・09-03b の追加分の照合と現在の件数（`+` 行 約1.9万バイト）
  * **対象ファイル**:
    * `./_doc/arch/16_test.md` の `+` 行：149〜184行（Phase 09-02a・09-02b・09-03a・09-03b の追加・書き換え分・テストできない箇所・件数）:（照合）
    * 照合に使う主なコード：`./test/` 配下（記述が名指しするテストファイル。新設の `test/shapes/PathCornerRules.test.js`・`test/shapes/PathSegmentKindRules.test.js`・`test/edit/PathCornerEditor.test.js`・`test/edit/PathCornerEditor.segmentSwitch.test.js` を含む）と、テストできない箇所として名指しされたコード（`./js/palette/OptionBarCornerGroup.js` 等）:（監査）
  * **調査内容**:
    * 名指しされたテストファイルの実在と、テストの内容の記述（何をテストしているか・`describe` 名）が実際のテストケースと合っているかを、テストファイルの該当の `describe`・`it` と照らす。
    * 件数の記述（ファイルごとの「+N件・`describe`+M」、各区切りの全体の件数と増分）を、各区切りのコミット（09-02a：`6105b14`→`1402fc5`、09-02b：`1402fc5`→`d495ae4`、09-03a：`d495ae4`→`f0f5058`、09-03b：`f0f5058`→`47d1dba`）の差分の数え上げで確かめる。
    * プロジェクトのルートで `node --test` を実行して現在の tests / suites / pass / fail を記録し、184行の 09-03b 完了時の件数と、09-04（`47d1dba`→`0979518`）でのテストの増減（`git diff --stat 47d1dba 0979518 -- test`）とを並べて記載する（09-04 の件数が `16_test.md` に書かれていないことは相違とみなさない）。
    * 「書き換えた既存のテスト」の記述を同じ区切りの差分の `-` 行と照らし、「テストできない箇所」の一覧をテストファイルの import と照らす。
* [ ] タスク10: `_doc/arch/01_index_html.md`（`index.html`）の照合（`+` 行 約1.2万バイト）
  * **対象ファイル**:
    * `./_doc/arch/01_index_html.md` の `+` 行：3行（ツールバー・ステータスバー）、10行（ショートカットの表記）、15行（オプションバー）:（照合）
    * 照合に使う主なコード：`./index.html`（要素・属性・クラス・幅の見積もりのコメント・CSS）、`./js/core/ToolRules.js`（`TOOL_IDS`）・`./js/core/KeyboardShortcuts.js`（`title` に併記されたショートカットとの照合）・`./js/palette/OptionBarCornerGroup.js`（要素の取得） :（監査）
  * **調査内容**:
    * 「角」のまとまり（`#option-corner-group`）・「直線に」「曲線に」のボタンのid・`title`・初期の`disabled`、オプションバーの5つのまとまりの並びと幅の見積もりのコメント、ツールバー・ステータスバーの要素の記述を、`index.html` の該当行と照らす。
    * `title` 属性に併記されたショートカットキーの記述を、`index.html` の `title` と `KeyboardShortcuts.js` のキーの分岐と照らす。
    * 1280px幅での右端の位置・記号の字形など、ブラウザでの見え方の記述は、CSSの値・要素の並びから確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。
* [ ] タスク11: `_doc/arch/02_main.md`（`main.js` の配線）の照合（`+` 行 約1.5万バイト）
  * **対象ファイル**:
    * `./_doc/arch/02_main.md` の `+` 行：3〜4行（行数・主な関数）、17行・25行（配線ブロックの表の `// 7.`・`// 7.12.`）、54〜55行（注入の表の `PathCornerEditor`・`OptionBarCornerGroup`）、64行（注入の表の `KeyboardShortcuts`）、68行（同一経路の原則）、72〜73行（操作モード・図形種別の切替、起動時の同期）、75行（キーボードショートカットのコールバック）:（照合）
    * 照合に使う主なコード：`./js/main.js`、注入先のコンストラクタ（`./js/edit/PathCornerEditor.js`・`./js/palette/OptionBarCornerGroup.js`・`./js/core/KeyboardShortcuts.js`・`./js/core/InputTracker.js`） :（監査）
  * **調査内容**:
    * 3行の行数（現在の値と、書かれていれば過去の時点の値）を `wc -l`・`git show <コミット>:js/main.js | wc -l` で実測して並べ、配線ブロックの見出し（`// 7.` 等）の位置と中身の記述を `main.js` と照らす。
    * 4行の主な関数の一覧、17・25行の配線ブロックの中身（生成するもの・同期関数と購読先）、54・55・64行の注入（渡す引数と値）を、`main.js` の生成箇所と注入先のコンストラクタの引数と照らす。
    * 68・72・73・75行の同一経路の原則・切替・起動時の同期・コールバックの戻り値の意味を、`main.js` の該当関数と `KeyboardShortcuts.js` のtypedef・呼び出しと照らす。生成順の制約が書かれていれば、`main.js` の生成順と照らす。
* [ ] タスク12: `_doc/arch/03_VectorModel.md`・`10_ShapeFactory.md` と小さな修正（`28`・`30`・`33`・`40`・`41`）の照合（`+` 行 約1.5万バイト）
  * **対象ファイル**:
    * `./_doc/arch/03_VectorModel.md` の `+` 行：2行・4行・8〜9行・11行・13〜14行 :（照合）
    * `./_doc/arch/10_ShapeFactory.md` の `+` 行：3行・5〜6行 :（照合）
    * `./_doc/arch/28_MoveDirectionRules.md` の `+` 行：5行 :（照合）
    * `./_doc/arch/30_UnitSnapRules.md` の `+` 行：2行・10行・12行 :（照合）
    * `./_doc/arch/33_FocusKeyYieldRules.md` の `+` 行：3行 :（照合）
    * `./_doc/arch/40_asset_sprite.md` の `+` 行：2行・5行 :（照合）
    * `./_doc/arch/41_NudgeTargetRules.md` の `+` 行：7行 :（照合）
    * 照合に使う主なコード：`./js/core/VectorModel.js`・`./js/core/ShapeFactory.js`・`./js/core/MoveDirectionRules.js`・`./js/core/UnitSnapRules.js`・`./js/core/FocusKeyYieldRules.js`・`./js/core/NudgeTargetRules.js`・`./js/core/InputTracker.js`（使う側の確認）・`./asset/sprite/` 配下・`./js/wiring/` 配下（`ToolIconWiring`）・`./js/shapes/Path.js`（`fromJSON`）、各「使う側」の確認のための全 `.js` の import 文 :（監査）
  * **調査内容**:
    * `03_VectorModel.md` の公開メソッドの一覧・頂点の選択・`replaceShape`（通知の回数）・`replaceDraft(shape)` の約束・直前に使った値・知らないこと・委譲を、`VectorModel.js` の公開メソッドと実装と照らす（取り消し・やり直しで頂点の選択が外れることの記述があれば、外す箇所と照らす）。
    * `10_ShapeFactory.md` の対応表と種別一覧・直線とパスの作り分け・`curve` の `create` が曲線のパスを返すこと（戻り値の `type`・頂点2つ・区間1つ）を、`ShapeFactory.js` と照らす。
    * `28`・`30`・`33`・`41` の公開・使う側・`checkbox` の実在の記述を、各ファイルの export と全 `.js` の import・呼び出し箇所（`index.html` の `checkbox` の実在を含む）と照らす。
    * `40_asset_sprite.md` の生成物の記述（2本の生成物の作られ方・頂点数・使う側）を、`./asset/sprite/` 配下のファイルの中身と `ToolIconWiring` の import と照らす。
* [ ] タスク13: 要件2（Interrupt と Phase 9 で変わった・広がった・公開の形が変わったものの古い形の残り）の検索
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）:（検索）
    * 洗い出しの材料：`git diff --name-status 7e0f93f 0979518 -- js index.html test asset sprite-check.html` と `git diff 7e0f93f 0979518 -- PROJECT_ARCHITECTURE.md _doc/arch` の `-` 行 :（参照）
    * 照合に使う主なコード：`./js/shapes/PathJoinRules.js`（`isJoinableLine`・`segmentKindsOf`）・`./js/shapes/Path.js`（区間の種類の定数）・`./js/shapes/ShapeDataValidation.js`（`isPlainObject`）・`./js/core/ShapeFactory.js`（`create('curve')`）・`./js/io/SpriteSerializer.js`（`formatVersion`）・`./js/io/DocumentSerializer.js`（作業データの版）・`./js/edit/EndpointSnapper.js`（`isDrawingLine`）・`./js/edit/PathCornerEditor.js`・`./js/palette/OptionBarCornerGroup.js` :（監査）
  * **調査内容**:
    * 要件2の6つの変化（結合できる線の広がり、曲線のツールの作るもの、区間の種類の増加、書き出し形式の版、公開の形が変わったもの、線を引いている途中かの判定）ごとに、まず現在の実コードの事実（その名前がどこにあるか・どこから呼ばれるか・値）を `ファイル:行` で確かめて4章に書く。
    * 次に、変化ごとに古い形を表す名前・語（例：「結合できない」「結合できる線」「`Curve`を作る」「`'line'`のみ」「すべて直線」「版2」「`polyline`」「非公開」「`isPlainObject`」「`segmentKindsOf`」「角だけ」「`isDrawingLine`」「直線のツールだけ」等。`-` 行に現れた語も加える）で、`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイルを `Grep` で検索し、検索した語と件数を記録する。
    * 見つかった箇所ごとに、その記述が「今もそうである」と読めるか、経緯・過去の状態として正しく書かれているか（「Phase 05 では」「09-01a の時点では」等）、作業データの版（2のまま）と書き出し形式の版（3）を取り違えていないかを判定する。差分のない行は、検索で見つかった箇所だけを扱う（記述全体の照合は行わない）。相違は5章に「（タスク13・要件2）」と添えて記載する（`+` 行で見つかった箇所も判定して記載してよい。他のタスクと重なる場合があることは問わない）。
* [ ] タスク14: 『開発資料との相違』の確認と、「読み方が分かれる記述」「照合できなかった主張」の一覧化（固定タスク）
  * **対象ファイル**:
    * 本RES（`./_log/res/261120_1637_RES_Survey_Phase09_Doc_Consistency.md`）の4章・5章・6章 :（整理）
  * **調査内容**:
    * 5章『開発資料との相違』を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。タスク7が既知の傷を挙げていることを確かめる。
    * 4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。
    * 終わりに `git status` で、変更があるのが本RESファイルだけであることを確認する。

## 4. 調査結果
### タスク1: `PROJECT_ARCHITECTURE.md` 1章の照合
* **調査内容**: 
  * 担当の `+` 行（63〜66・75・97・135・152〜153・170〜171・201・205・208・211行）を `sed -n` で全文取り出した。照合の範囲は発注者の判断に従い、`+` 行のうち Interrupt・Phase 9 で足された・変えられた文だけとした。`7e0f93f` から変わっていない文（Interrupt より前からある記述）は照合の対象外とした（REQ の【調査範囲】の「対象外」に「Interrupt より前から変わっていない記述」とあり、Phase 8 クローズの整合確認は `7e0f93f` まで済んでいるため）。足された・変えられた文は、`git show 7e0f93f:PROJECT_ARCHITECTURE.md` の対応する旧行（63行←旧63行、64行←旧64行、201行←旧192行、205行←旧196行、208行←旧199行、211行←旧202行）と単語単位で比べて（`git diff --no-index --word-diff`）見分けた。65・66・75・97・135・152・153・170・171行には対応する旧行が無い（行ごと追加）。
  * 旧行と比べた結果：
    * 63行は行末の説明に「、直線・曲線のツールで続けて引く線の点の並び。今の曲線・弧を区間として読む」が足された。64行は行頭の罫線（`└──`→`├──`）だけが変わり、説明の文は旧64行と同じ。
    * 201行で足された・変えられた主張は次の6か所だけで、残りは旧192行と同じ：(a) 塗りの項目の「（今の曲線`curve`）」「（開いた曲線のパスを含む）」「閉じた曲線のパスは塗れる」、(b) 曲線の作成時の制御点の丸めの括弧「（今の曲線`curve`は曲線のツールで作られなくなったため該当する操作が無い。Phase 09-01a）」、(c) 「頂点の追加・削除」→「頂点の削除」、(d) 旧「区間の直線／曲線の切り替え」を置き換えた「区間の切り替えのハイライト表示」から「引きながらの直線と曲線の切り替え」まで、(e) 頂点のハンドルのドラッグでの`Shift`の限定の括弧の「と、直線・曲線のツールで線を引いている途中の付いてくる線の先」「3章3.・16.・22.」、(f) 末尾の「ドラッグによるフリーハンドの線」から「やり直しは捨てる」まで。
    * 205行で足されたのは、`ShapeGeometry` の括弧書き、`PathJoinRules` の括弧のうち「結合の規則」より後、`PathCornerRules`・`PathSegmentKindRules` の項、参照の「・23.・24.」。`palette/` の文などは旧196行と同じ。
    * 208行で変わったのは `PathCornerEditor` を足した3か所（`shapes/` の規則も使う手順の括弧、角の切り替え・区間の切り替えの項目、1件の編集操作の手順の列挙）だけ。
    * 211行で足された・変えられたのは (1)の `PathCornerEditor` の分、(2)の `PathCornerRules`・`PathSegmentKindRules` の分、`PathJoinRules` の import の書き換え（`Line`・`Path`、`Path` からは `readCornerFlags` も）、`PathCornerRules` の import と `Line` の import の文、(3)の `PathCornerEditor` と「この4ファイル」。列（`main.js → edit → io → core → shapes`）、`wiring/`・`core/`・`io/`・`palette/`・`asset/`・`check/` の文、「次の3種だけ」、`edit/` 内・`core/` 内の import の文、「規則の関数は…」、「循環importは無い」、`core/InputTracker` の文は旧202行と同じ。
  * フォルダ構成図：図のファイル名（152件）と実ファイル（`js/`・`test/`・`asset/` の `.js`＋`index.html`・`sprite-check.html`・憲法・資料）を名前で突き合わせ、差は `asset/sprite/` の2ファイル（図には行がなく `asset/sprite/` の行末コメントに名前がある）だけ。新設ファイルの置かれたフォルダも一致。
  * 各ファイル先頭の責務定義のJSDoc（`head`）と行末コメントを照合。
  * 全 `.js` の import 文を `grep` で一覧し、205行・208行・211行の足された・変えられた主張と照合した。201行の足された・変えられた主張は、該当する関数・イベントの購読・キーの対応表・保存されるデータの形をコードで開いて照合し、無いことは検索した語と件数で確かめた。
  * 前回までの作業では `7e0f93f` から同じ主張の一部も照合していた。その記録は下の『事実』に「`7e0f93f` から変わっていない主張（照合の対象外）」と見出しを付けて分けて残した。照合の範囲には含めない。旧行から同じ主張のうち、下に事実を書いていないもの（201行の例：範囲選択は輪郭のみ、キャンバスごとの既定の色、組み立て用のJSの表示・書き出し、押している間だけ働く一時的なスポイト、丸めた位置を示す表示、定規のガイド、単位の切り替え・単位の数値の入力欄、選択中の図形だけを画面に収める操作、基準点の指定、キーオブジェクト、指定した間隔の分布。205行の `palette/` の文 等）は照合していない。
  * 作業の終わり（監査の指摘への修正5回目の後）の `git status --short` は ` M _log/res/261120_1637_RES_Survey_Phase09_Doc_Consistency.md` の1行のみ（変更はRESだけ。ソース・資料の変更なし）。
* **事実（実コードの記述）**:
  * 63行 `PathJoinRules.js`（`js/shapes/`）：実在。先頭の責務は「結合と、直線・曲線のツールで続けて引く作成途中の線の点の並び」で、今の曲線・弧は `chainSourceOf`（非公開。`PathJoinRules.js:130`）が区間として読む。一致。
  * 64行 `EndpointSnapRules.js`（説明は旧64行と同じ。`js/shapes/` に実在し、後に同じフォルダの行が続く罫線と一致）、65行 `PathCornerRules.js`（先頭の責務：角の状態の判定とチェックボックスの表示内容・切り替えの組み立て）、66行 `PathSegmentKindRules.js`（先頭の責務：区間の直線⇔曲線の切り替えの判定と組み立て）：いずれも `js/shapes/` に実在し、説明と一致。
  * 75行 `js/palette/OptionBarCornerGroup.js`：実在。先頭の責務は「角」のまとまり（`#option-corner-group`）の「直線に」「曲線に」のボタンとチェックボックスの表示・通知（DOM操作専任）。一致。
  * 97行 `js/edit/PathCornerEditor.js`：実在。先頭の責務は角の切り替えと区間の切り替えの手順と、「角」のまとまりの表示内容の照会。規則は `shapes/PathCornerRules`・`shapes/PathSegmentKindRules`（`PathCornerEditor.js:7-8`）。一致。
  * 135行 `test/core/VectorModel.replaceDraft.test.js`、152・153行 `test/shapes/PathCornerRules.test.js`・`PathSegmentKindRules.test.js`、170・171行 `test/edit/PathCornerEditor.test.js`・`PathCornerEditor.segmentSwitch.test.js`：すべて書かれたフォルダに実在。
  * 201行「存在しないもの」（Interrupt・Phase 9 で足された・変えられた主張。上の(a)〜(f)）：
    * (a) 塗りの条件「塗れるのは`rect`・`circle`・閉じた`path`のみ。閉じた曲線のパスは塗れる」と、塗れないものの「今の曲線`curve`」「開いた曲線のパスを含む」：`isFillable`は `Rect.js:53-55` が `true`、`Ellipse.js:83-85` が `type === 'circle'`（弧は偽）、`Line.js:49-51`・`Curve.js:59-61` が常に偽、`Path.js:173-175` が `closed === true`（区間の種類を見ないので閉じた曲線のパスは塗れ、開いた曲線のパスは塗れない）。一致。
    * (b) 「今の曲線`curve`は曲線のツールで作られなくなった」「曲線の作成時の制御点の丸めに該当する操作が無い」：`ShapeFactory.js:33` の `'curve'` の `create` は `new Path([2点], false, …, SEGMENT_KIND_SMOOTH)`（`Curve` は作らない。`fromJSON` だけが `Curve.fromJSON`）。`InputTracker.js` に制御点を扱う語は無い（`grep` 0件）。一致。
    * (c) 「頂点の削除」：`removeVertex`・`deleteVertex` は `js/` に無し（0件）。一致。
    * (d) 「区間の切り替えのハイライト表示」：`grep -rniE "highlight|ハイライト" js` は0件。`grep -rn "強調" js` は15件で、すべて図形のホバーの強調（`CanvasManager.js:233` のコメントと、各図形の `drawHover` のJSDoc〔`Curve.js:321-324`・`Ellipse.js:124-127`・`Line.js:251-254`・`Path.js:336-338`・`Rect.js:266-270`〕）。`drawHover` の呼び出しは `CanvasManager.js:241` の1件で、`Path.js:340-345` の `drawHover` は `#tracePath` でパス全体を太線で重ねるだけ（区間ごとの描き分けは無い）。切り替わる区間を決める `changedSegmentIndexes` の呼び出しは `PathSegmentKindRules.js:217-218`（押せるか）・`:238`（組み立て）だけで、描画からは呼ばれない。`js/` に `mouseenter`・`mouseover` は0件。一致。
    * (d) 「区間の切り替えのキー（「直線に」「曲線に」のボタンだけ）」「角の切り替えのキー（「角」のチェックボックスだけ）」：`KeyboardShortcuts.js` の対応表の `action` は27種（`bringForward`・`bringToFront`・`cancel`・`copy`・`cut`・`deleteSelection`・`duplicate`・`invertSelection`・`join`・`nudgeSelection`・`paste`・`pasteInPlace`・`redo`・`resetColors`・`resetView`・`selectAll`・`sendBackward`・`sendToBack`・`setMode`・`setShapeType`・`startEyedropper`・`toggleBackground`・`toggleFloatWindows`・`toggleGrid`・`toggleOutline`・`undo`・`zoomStep`）で、角・区間の切り替えに当たるものは無い。一致。
    * (d) 「『曲線に』で足す点以外の頂点の追加・『直線に』で点を消すこと」「今の曲線の『曲線に』（今の曲線をパスにするには結合する）」：`PathSegmentKindRules.js` の `buildCurvedPath`（`:145`）は変わる区間の中点だけを足し、`buildStraightenedPath` は点を足さず消さない（恒等の対応）。ほかに頂点を足す経路：`grep -rnE "insertVertex|addVertex|insertPoint|addPoint|splice\(" js` は3件（`HistoryManager.js:161,177` は履歴のエントリの配列、`PathJoinRules.js:663` は `removeLastDrawnPoint` の点の削除）で、頂点を足す関数は無い。`grep -rnE "points\.(push|splice|unshift)" js` は6件（`SpriteSerializer.js:203-206` は `ellipseRange` の範囲を求める局所の配列、`PathJoinRules.js:648` は `addDrawnPoint`〔作成途中の線に点を打つ＝線を引くこと〕、`:663` は上と同じ）。`js/` に `dblclick` は0件。頂点の選択で選んだ図形に頂点を足す操作は「曲線に」のほかに無い（線を引くこと・描き足し〔`PathJoinRules.js:416` の `buildExtendedPath`〕・結合〔`:518` の `planCloseWithPoints` 等〕で結果の頂点が増えることの扱いは下の所見に書く）。`changedSegmentIndexes`（`:112-120`）は今の曲線の「曲線に」を空にする（`:113-114`）。今の曲線は結合できる線で（`PathJoinRules.js:81` の `isJoinableLine` が `'curve'` を含む）、結合のボタン・`J` で2本を結合すると `classifyJoin` が `'join'`（`:272-274`）、`planJoin`（`:756`）の `buildJoinedPath`（`:323`）は `assembleOpenPath` が `new Path(…)`（`:378`）を返すのでパスになる。今の曲線1本では `classifyJoin` が `null`（`:267`。`type !== 'path'`）。一致。
    * (d) 「曲がり方を持つ区間と隣の区間のつなぎ目をなめらかにすること」「直線の区間と曲線の区間のつなぎ目をなめらかにすること（つなぎ目は常に角）」：`Path.js:181` のとおり曲がり方を持つ区間は打った点の曲線の区間として渡さず（偽）、`ShapeGeometry.js` の `computeSmoothSegmentControls` は隣が曲線の区間でなければ仮の点（`2a − b`・`2b − a`）を使う＝そのつなぎ目は角になる。`PathJoinRules.js:225-232` の `chainOf` は開いた線の端の点を偽にする。一致。
    * (d) 「今の曲線への制御点の追加・削除」：`Curve` の頂点は始点・制御点・終点の3つに固定（`Curve.js:226-227` の `getVertexHandleNames()` が `['start', 'control', 'end']`、`constructor`（`:37`）は2点を受ける）。`Curve.js` の公開メソッド（`:59`〜`:410`）に点を足す・消すものは無く、`js/` に `addControl`・`removeControl`・`deleteControl`・`insertControl` は0件。一致（「直線に」で今の曲線が直線になること〔`PathSegmentKindRules.js:241-242` の `buildLineFromCurve`〕は図形の置き換えで、下の所見に書く）。
    * (d) 「結合でまとめた端点の側の引っ張る点を動かすこと」：`PathJoinRules.js:361-378` の `assembleOpenPath` は、まとめるとき（`merge`）Bの端点と角の点だけを除き（`:365-371`）、区間の並び（曲がり方を持つ区間の `control1`・`control2` を含む）は `bChain.kinds` をそのまま連ねる（`:375`）。引っ張る点を書き換える処理は無い。一致。
    * (d) 「頂点2つの閉じた形（今の曲線1本と直線1本の半月形・今の曲線2本のレンズ形）」：`PathJoinRules.js:20` `CLOSED_MIN_POINTS = 3`。閉じる判定 `:269`・`:293`（`points.length < CLOSED_MIN_POINTS` で`null`）・`:306`・`:433`（頂点数−1 が `CLOSED_MIN_POINTS` 以上）・`:680`・`:724`。一致。
    * (d) 「描いている間に元の線を含めた結合後の形を見せる仕組み」：結合の計画を作る `planDrawnLineJoin` の呼び出しは `EndpointSnapper.js:354`（`#reflectDrawnJoin`。線を終えたとき）だけ、`planJoin` は `PathJoiner.js:75` だけ（`grep`。`PathJoinRules.js` の外ではこの2件）。描いている間の描画は作成途中の図形をそのまま描くだけ（`CanvasManager.js:260-264`、`main.js:200` が `model.getDraftShape()` を渡す）。一致。
    * (d) 「角の点をキャンバス上で見分ける表示・角の点の方向線（ハンドル）」：`Path.js:327-332` の `drawHandles` は全頂点に同じ四角を描き、頂点の選択のハンドルの項目は `{x, y, selected}` だけ（`VertexHandleRules.js:29`）。`CanvasManager.js`・`VertexHandleRules.js`・`PointHitRules.js` に `corner` は0件。一致。
    * (d) 「弧自身の端のハンドルのドラッグでの吸い付き・結合」「弧の半径のハンドルが画面に出ない」「弧のツールで描くときの吸い付き」：`PathJoinRules.js:endpointVertexIndexOf`（`:214-217`）は弧で `null`、`EndpointSnapRules.js:59-61` の `resolveEndpointHandle` は弧のハンドルを端点として解決しない、`isSnapDrawShapeType` は `'line'`・`'curve'` だけ（`EndpointSnapRules.js:46-47`）。弧の半径のハンドル（`Ellipse.js:178-210` の `drawHandles` が描く右端・上端・左端・下端の四角）は、`main.js:197` が描画に `showHandles: false` を渡すので選択のモードでも描かれず、頂点の選択では `Ellipse.js:275-277` の `getVertexHandleNames()` が `[]` なので頂点のハンドルも出ない。一致。
    * (d) 「頂点の選択で弧に点を出すこと」：`Ellipse.js:275-277` の `getVertexHandleNames()` は円・弧とも `[]` で、頂点の選択のハンドルの一覧（`VertexHandleRules.js:25`）と範囲選択の頂点（`:67`）はこの一覧だけを回すため、弧には頂点のハンドルが出ない。一致。
    * (d) 「弧1本の閉じる（同じ弧の両端の間を途中の点なしで引いても何も起きない）」：結合のボタンの判定 `classifyJoin`（`PathJoinRules.js:264`）は1本のとき `type !== 'path'` なら `null`（`:267`。弧1本は閉じない）。線を引いて同じ線の別の端点へつないだときは `planDrawnLineJoin`（`:571`）が途中の点なしなら `planCloseOf` へ進み（`:579`）、`buildClosedPath` が `type !== 'path'` で `null`（`:291`）、計画が `null` なので `EndpointSnapper.js:362-364` は作成途中の線を捨てるだけで記録しない（何も起きない）。途中の点があれば `planCloseWithPoints` がパスに描き足してから閉じる（`:580`）。弧は頂点3つ（`:159` の `arcChainSourceOf`）なので `CLOSED_MIN_POINTS` の照合では言えず、`type` の判定で言える。一致。
    * (d) 「結合で弧の形を誤差なく保つこと（楕円の4分の1の近似で半径の約0.03%のずれを許す）」：弧の近似の係数は `PathJoinRules.js:41` の `QUARTER_ELLIPSE_BEZIER_K = 4 * (Math.SQRT2 - 1) / 3`、ずれの大きさは `:154` のJSDocに約0.03%とある。一致。
    * (d) 「弧の回転・弧の角度の変更」：`Ellipse.js` には「角度」（`:54`・`:57`・`:377`・`:410`・`:579`・`:600`・`:602`）・「回転」（`:432`・`:546`）の語があるが、どれも固定の角度の説明・当たり判定の角度の範囲・回転を入れるときの注意（`:432`）・回転は常に0（`:546`）・角度の編集を実装するときの注意（`:579`）で、変える処理ではない。`startAngle`・`endAngle` はコンストラクタで固定値になる（`:55` `this.startAngle = (this.type === 'circle') ? 0 : Math.PI;`、`:58` `this.endAngle = Math.PI * 2;`）。`js/` で `.startAngle =`・`.endAngle =` に代入するのはこの `:55`・`:58` だけ（`grep -rnE "\.startAngle\s*=[^=]|\.endAngle\s*=[^=]" js`。ほかに `SpriteSerializer.js:185,188` の `ellipseRange` が局所の変数 `endAngle` を書き換えるが、書き出しの描画要素から範囲を求める計算で図形を変えない）。`ctx.ellipse` の回転の引数は常に0（`Ellipse.js:107`・`:136`・`:162`）。`js/shapes`・`js/edit` に `rotate(`・`flip`・`mirror`・`scaleShape`・`resize(` は0件（`js/` の `rotate(` は `RulerRenderer.js:194` の定規の文字の `ctx.rotate` だけ）。一致。
    * (d) 「曲線の方向のハンドル（曲がり方を持つ区間の引っ張る点の表示・ドラッグでの直接の操作を含む）」：`Path.js:117` のとおり引っ張る点は頂点でなく、`drawHandles`（`:319-332`）・`hitTestHandle`（`:415-421`）・`getVertexHandleNames`（`:467-468`）は `points` だけを扱う。一致。「区間をクリックして選ぶ仕組み」：当たり分類 `PointHit` は `handle` と `bodyId` だけ（`PointHitRules.js:10-13`）、`InputTracker.js`・`PointHitRules.js`・`SelectionRules.js`・`KeyboardShortcuts.js` に `segment` は0件、`js/core`・`js/edit` に `segmentIndex`・`selectedSegment` は（`PathCornerEditor` を除き）0件。一致。「引きながらの直線と曲線の切り替え」：足す区間の種類は作成途中の線の最後の区間の種類から読むだけ（`PathJoinRules.js:617-620` の `drawnSegmentKind`）で、`InputTracker.js` の `keydown` は `Space` だけを扱う（`:1114`）。一致。
    * (e) 「`Shift`が効くのは本体・moveハンドルの移動と、直線・曲線のツールで線を引いている途中の付いてくる線の先だけ」：`event.shiftKey` を読むのは `InputTracker.js:792`（`#resolveDrawnLineEnd`＝付いてくる線の先）と `:1415`（`#resolveMoveDelta`＝`MOVING_SELECTION`の本体・moveハンドルの移動）だけ。頂点のハンドルのドラッグ（`:1374` 以降）は `hasCtrlModifier` のみで `shiftKey` を読まない。`KeyboardShortcuts.js` の `shiftKey` は `:304`（キー対応表の`Shift`規則）だけ。一致（すぐ後の項目「頂点のドラッグでの`Shift`による方向の限定」は旧192行と同じ主張で照合の対象外だが、上の `:1374` 以降の事実が当てはまる）。「3章3.・16.・22.」は資料の中の参照で、コードの主張ではない。
    * (f) 「ドラッグによるフリーハンドの線」：線を引いている途中の `mousemove` は付いてくる線の先を `model.updateDraft` で動かすだけで点を打たない（`InputTracker.js:840-856`）。一致。「`Enter`や`Ctrl`＋クリックでの線の終了」：`js/core`・`js/edit` に `'Enter'`・`NumpadEnter` は0件。線を引いている途中のクリックは `clickDrawnLine` へ吸い付きの照会結果を渡すだけで `Ctrl` を読まない（`InputTracker.js:1029-1038`。`Ctrl` は `mousemove` で吸い付きの照会を省くことにだけ使う〔`:842`〕）。一致。
    * (f) 「（取り消しは点を戻す。…）」：`performUndo`（`main.js:113-125`）はドラッグ中でなければ先に `inputTracker.removeLastLinePoint()` を呼び（`main.js:117`）、真ならそこで終わる。`removeLastLinePoint`（`InputTracker.js:697-708`）は線を引いている途中（`:698`。`#isDrawingLine()` は `:766-767`）なら注入された `removeDrawnLinePoint()`（`EndpointSnapper.js:311-323`）で最後の点を消す（`replaceDraft`。始点だけなら `cancelDraft`）。取り消しは最後の点を消す＝点を戻す。あわせて `Backspace`・`Delete`（`KeyboardShortcuts.js:159`）の実体 `deleteLastLinePointOrSelection` も先に `removeLastLinePoint()` を試す（`InputTracker.js:712-717`）。一致。
    * (f) 「線を引いている途中の『やり直し』で点を戻す仕組み（…やり直しは捨てる）」：`performRedo`（`main.js:138-145`）は `removeLastLinePoint()` を呼ばず、`:142` で `inputTracker.abortOngoingOperation()` を呼んでから `historyManager.redo()`（`:143`）。`abortOngoingOperation`（`InputTracker.js:663-667`）の本体 `#abortOngoingOperation`（`:730`）は DRAWING のとき `this.model.cancelDraft()` で作成途中の図形（線を引いている途中の線を含む）を捨てる（`:738-741`）。キーの `Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`（`KeyboardShortcuts.js:169-170`）も `main.js:916` で同じ `performRedo`。一致。
  * 201行「存在しないもの」（`7e0f93f` の旧192行から変わっていない主張。照合の対象外〔発注者の判断〕。前回までに照合した記録として残す。ここに書いていない旧192行の主張は照合していない）：
    * `CodeImporter`・`PropertyPanel`・`property-panel`・`package.json`・`node_modules`・`.github`・フックは無し（`git ls-files`・`grep -rni` で0件）。エディタでのJSの実行：`js/` の動的な `import(`・`eval(`・`new Function(` はエディタに無く、確認用ページの `check/SpriteCheckPage.js:168` の `import(url)` だけ。スプライトのJSは `CodeExporter.extractSpriteDataText`（`CodeExporter.js:209`。責務 `:2-3`「実行せずにテキストから…取り出す」）で取り出し、`FileContentReader.js` が作業データ（スプライトは `source`）だけを `DocumentSerializer.deserialize` へ渡す（責務 `:2-3`。`elements` からは作り直さない）。
    * 確認用ページ：`check/` の購読は `fileInput` の `change`（`SpriteCheckPage.js:84`）・`resize`（`:89`）・`DOMContentLoaded`（`:277`）だけで、拡大縮小・移動・編集の購読は無い。`sprite-check.html:71` のファイルの欄は `accept=".js,text/javascript"` で `multiple` 無し。JSONのファイルは表示しない（`SpriteCheckPage.js:14,121`）。エディタから確認用ページへのリンク：`index.html`・`js/` に `sprite-check` は0件。
    * 書き出し：スプライトのJSのダウンロードは `CanvasFileOperations.js:225-238` の `exportSprite`（開いているキャンバス1つ）だけ（`downloadSpriteModule(` の呼び出しは `:238` の1件）。ダウンロードの形は作業データ `.ozve.json` とスプライトの `.js`（`DocumentFileIO.js:81-98`）だけで、スプライトのJSONは出さない。`toDataURL`・`toBlob`・`image/png`・`svg` は0件。書き出しの座標の丸め：`js/io` に `Math.round`・`toFixed` は0件。
    * 色・数値の欄：色の欄は `<input type="color">`（`index.html:503,505`）、数値の欄は線の太さ（`:506`）と位置X・Y（`:517,519`）だけ（大きさ・角度の欄は無い）。「選択中：」「次に描く」・図形の一覧（`shape-list`・`layer`）・グループ化・`globalAlpha` は0件（`index.html` の `opacity`〔`:263,444`〕・`linear-gradient`〔`:418`〕はCSSの見た目だけ）。
    * 重なり順：`ShapeOrderRules.js:59-100` の `reorderSelected` は重なっているかを見ず、離れた選択中の要素はまとまらずそれぞれ1つずつ動く（JSDoc `:43-44`）。
    * 保存・履歴の対象：作業データは `format`・`version`・`shapes`（各図形の `toJSON()`）だけ（`DocumentSerializer.js:96-101`）、ブラウザ内保存の記録は `id`・`name`・`updatedAt`・`document`（`CanvasStorage.js:39-42`）と最後に開いたキャンバスのid（`:202`）だけ、履歴のスナップショットは `document` と `selectedIds` だけ（`HistoryManager.js:12-19`。`Snapshot` の `@property` は `:15`・`:17` の2つ）。直前に使った値・表示の状態・スナップの設定・頂点の選択・位置の欄の値・フロートウィンドウの位置は保存・履歴の対象に入っていない。`WindowManager.js` に `Storage`・`Math.min`・`Math.max`・`clamp` は0件（動かせる範囲の制限なし）。`localStorage`・`sessionStorage` は0件（`indexedDB` は `CanvasStorage.js` だけ）。
    * 表示まわり：ツールバー・ステータスバーは `flex-wrap: nowrap`・`overflow: hidden`・`white-space: nowrap`（`index.html:55-58`）。定規は `RulerRenderer.js`・`RulerTickRules.js` に `addEventListener` が0件、`ViewToggleGroup.js`・`DisplayState.js` に `ruler` は0件（表示の切り替え・ドラッグ・原点の変更なし）。全体を画面に収める処理は ⛶（`#view-fit`）のclickからだけ呼ぶ（`DisplayWiring.js:182-184`「キーは割り当てない」）、キーの `action` に収める・100%の操作は無い（上の27種。`Ctrl`+`1` は無く、`Ctrl`+`0` は `resetView`〔`KeyboardShortcuts.js:154`〕）。ダークモード（`prefers-color-scheme`）は0件、背景は `darkBackground` の真偽だけ（`CanvasManager.js:207`）。
    * カーソル・ホバー：「ツールごとのカーソルの形の切り替え」：キャンバスのカーソルを設定するのは `InputTracker.js:1718` の1か所で、`resolveCursorShape`（`CursorShapeRules.js:51`）の入力 `CursorShapeInput`（`:17-25`）に図形種別は無く、図形作成モードはどのツールでも `'crosshair'`（`:62-64`）。`CursorShapeRules.js:6` の import は `InputModes` だけ。「カーソルがキャンバスの外へ出たときのホバーの強調の解除」：`js/` で `mouseleave` を購読するのは `CanvasCursorTracker.js:52` だけで、その処理はカーソル位置を「なし」にして通知する（`:105` のJSDoc）。この通知（`CanvasCursorTracker` の `onChange`）の購読先は、定規の再描画（`main.js:235` の `cursorTracker.onChange(renderRulers)`）と、ステータスバーのカーソル位置の表示（`wiring/DisplayWiring.js:70` の `this.#cursorTracker.onChange(() => this.#syncCursorReadout())`。`#syncCursorReadout`〔`:125-129`〕は表示の文字を書き換えるだけ）の2つで、どちらもホバーの強調を解除しない。`model.clearHovered()` の呼び出し（`InputTracker.js:500`〔`setMode`〕・`:873`〔`handleMouseMove`〕・`:1316`〔`#onLeftDragStart`〕・`:1594`〔`#beginPan`〕）に `mouseleave` からの経路は無い。`pointerleave`・`mouseout` は0件。
    * アイコン：`ToolIconWiring.js:46-49` の `drawToolIcons` は `tool-select`・`tool-vertex` の2つだけに描く。`ToolIconWiring.js:29` は描くときに1回 `devicePixelRatio` を読むだけで、`drawToolIcons()` の呼び出しは `main.js:379` の1件。`resize` の処理（`main.js:241-246`）は `canvasManager.resize()`・`rulerRenderer.resize()`・再描画だけでアイコンを描き直さない。`matchMedia` は0件。
    * 選択・修飾キー：「`Shift`+クリックでの選択の追加」「`Shift`での正方形・正円の作成」：`js/` の `shiftKey` の読み取りは上の(e)の3か所だけで、`resolveClickSelection` 等は `Ctrl` だけを渡す（`InputTracker.js:1068,1075,1501`）。「`Ctrl`+範囲選択での解除」：`resolveMarqueeSelection`（`SelectionRules.js:48-58`）は `additive` のとき追加だけ。「`Alt`+ドラッグ（1回クリックで選んでから）」「ドラッグの途中での`Alt`の切り替え（押した時点の`Alt`で決まる）」：マウスの操作で `event.altKey` を読むのは押した時点の `InputTracker.js:1294` だけ（ドラッグの開始が成立したときだけ記憶。`js/` ではほかに `KeyboardShortcuts.js:297` がキーの対応表の照合で `altKey` を読む）。選択集合外の本体の押下は何も始めない（`PressActionRules.js` の `resolvePressAction`。JSDoc `:27`）。「`Ctrl`＋矢印・`Alt`＋矢印への割り当て」「`Shift`＋矢印は10px」：矢印のエントリは `ctrl: false` だけ（`KeyboardShortcuts.js:190-203`）、`#findBinding` は `altKey` なら `null`（`:297`）、`NUDGE_STEPS.shift = 10`（`:102`）。
    * スポイト・`D`：`pickFrom`（`StyleEyedropper.js:114-125`）は1回取り込むと `stop()` で待ち受けをやめる。`getImageData` は0件。`D`（`resetColors`）は `RESET_COLORS_STYLE = { strokeColor: '#000000', fillColor: '#ffffff' }`（`StylePanelRules.js:75`）を当てるだけ（`ShapeStyleEditor.js:198-200`。太さは変えない）。
    * スナップ：単位は `pixel: 1`・`grid: 10` だけ（`UnitSnapSettings.js:22-25`）。一時無効は `hasCtrlModifier`（`InputTracker.js:163-164`。`ctrlKey`・`metaKey`）をマウスのイベントで読むだけで、`keydown` は `Space` だけ（`:1114`）。キーの `action` にスナップは無い。`js/edit`・`js/io`・`js/palette` に `roundPoint`・`roundDelta` は0件（微調整・位置の欄・整列・分布・貼り付け〔`ClipboardController.js:12` `PASTE_OFFSET_STEP = 20`〕は丸めない）。
    * 整列・分布：操作は8種（`ShapeAlignRules.js:30-38`）で、全体の範囲は対象の外枠の和、分布は外枠どうしのすき間をそろえる（`:145-151`）、座標は丸めない（`:153`）。`ShapeAlignEditor.js`・`ShapeAlignRules.js` に `selectedVertices` は0件。`index.html` に微調整のボタン（`nudge`）は0件。
    * 頂点の選択：端点への吸い付きは動かす頂点が1つのときだけ（`InputTracker.js:1275-1278`）。範囲選択の頂点は選択集合の図形の頂点だけ（`VertexHandleRules.js:63-66`）で、頂点の選択モードの範囲選択は頂点の選択を変えて終わる（`InputTracker.js:1480-1491`）。
    * `main.js`への操作モードの判定の追加（削除ボタン）：`syncDeleteButtonState`（`main.js:297-299`）は選択集合が空かだけを見る。
    * パスの分割：`splitPath` は `js/` に無し（0件）。テスト：`test/` に `document.`・`window.`・`jsdom` は `HistoryManager.test.js:18`（プロパティ名 `snap.document`）の1件だけで、画面の操作・描画のテストは無い。
  * 205行 `shapes/` の役割（足された主張）：`PathJoinRules` の `isJoinableLine`（`PathJoinRules.js:81`）＝`isDrawnLineShape`（`:66`。直線と開いたパス＝区間の種類を問わない）＋`'curve'`＋`'arc'`。「名前は意味の違いのため分けて残す」：`PathJoinRules.js:74-75` のJSDocに「2つの関数を分けて残すのは意味が違うため（結合・吸い付きの対象／続けて引く線の形）」とあり、実際に別の関数として残り、`isDrawnLineShape` は `EndpointSnapper.js:196`（線を引いている途中か）と作成途中の線の規則（`PathJoinRules.js:644`・`:659`・`:675`・`:693`・`:708`・`:723`）、`isJoinableLine` は結合・吸い付きの判定（`EndpointSnapRules.js:60,105,149`、`PathJoinRules.js:267`〜`:520`）で使い分けられている。一致。`chainSourceOf`（`:130`。`'arc'` は `arcChainSourceOf`（`:159`）へ）、`chainOf` で結合・描き足し・閉じるの結果が元の区間の種類と途中の角の点を保つこと、いずれも一致。今の曲線は頂点2つ・曲がり方を持つ区間1つ、弧は頂点3つ（左端・頂上・右端）・区間2つ。「結合できる線の端点の読み方は`lineEndpointOf`・`endpointVertexIndexOf`（`chainSourceOf`で読み替えた頂点の並びの先頭・末尾）」：括弧書きが文字どおり当てはまるのは `lineEndpointOf` だけ（`PathJoinRules.js:198-201` は `chainSourceOf(data).points` の先頭・末尾の座標を返す。使う側は `EndpointSnapRules.js:108-109` と `PathJoinRules.js:328-329,399,419`）。`endpointVertexIndexOf`（`:214-217`）は元の図形データの `points` の番号を返し（JSDoc `:205`「`getVertexIndexForHandle`が返す番号＝`points[i]`の`i`」）、直線・パスは0／`points.length - 1`、今の曲線は0／2（`chainSourceOf` で読み替えた並び〔頂点2つ。`:136`〕の番号なら0／1）、弧は `null`（`:215`。読み替えた並びは頂点3つだが番号を返さない。201行(d)の「弧で`null`」と同じ事実）で、`chainSourceOf` で読み替えた並びの番号ではない。使う側は端点のハンドルの判定 `EndpointSnapRules.js:64-65` だけ。今の曲線の0／2は読み替えた並びの先頭・末尾（始点・終点）に当たる元の頂点の番号で、弧の `null` は読み替えた並びの端（左端・右端）が元の頂点でないため（JSDoc `:208`）。扱いは下の所見に書く。`PathCornerRules` の役割「パスの点の角・なめらかの判定と、『角』のチェックボックスの表示内容・切り替えた新しいパスの組み立ての規則」：先頭の責務（`PathCornerRules.js:1-3`）と公開の関数 `resolveCornerState`（`:90`。判定）・`resolveCornerToggleView`（`:116`。表示内容）・`planCornerToggle`（`:142`。新しいパスの組み立て）と定数 `CornerState`（`:12`）が対応し、import は `Path.js` だけ（`:5`）。一致（「3章23.」は資料の中の参照）。`PathJoinRules.segmentKindsOf`（`:101`）・`segmentSpecsOf`（`:115`）は export 済み。「`segmentKindsOf`＝『直線は直線の区間1つ』の唯一の定義箇所」：`type === 'line'` から `[SEGMENT_KIND_LINE]` を返すのは `PathJoinRules.js:102` だけ（`:116` の `segmentSpecsOf` は `segmentKindsOf` を呼ぶ。`js/` の `=== 'line'` の判定はほかに `:67`・`EndpointSnapRules.js:47`・`PathSegmentKindRules.js:61` で、区間の種類を決めるものではない）。一致。`ShapeGeometry` は `cubicBezierPoint`（`:107`）・`computeSmoothSegmentControls`（`:144`）を持ち、この2つの定義は `js/` でここだけ（使う側は `Path.js:185,254,280`）。一致。`PathSegmentKindRules` の「区間・押せるか・新しい図形（パス・直線）と点番号の対応」はJSDocの責務と一致。旧196行と同じ文（`palette/` の文等）は照合の対象外。
  * 208行 `edit/` の役割（足された主張）：`shapes/` を import する `edit/` のファイルは `PathJoiner`・`EndpointSnapper`・`PathCornerEditor` の3つだけ（`grep`）。`PathCornerEditor` の import は `core/NudgeTargetRules` の `resolveNudgeTarget`（`:6`）、`shapes/PathCornerRules` の `resolveCornerToggleView`・`planCornerToggle`（`:7`）、`shapes/PathSegmentKindRules` の `SegmentKindSwitch`・`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`（`:8`）だけ（JSDoc `:27` も同じ列挙）。このうち `SegmentKindSwitch` は関数でなく凍結した列挙の定数（`PathSegmentKindRules.js:15` `export const SegmentKindSwitch = Object.freeze({`。`PathCornerEditor.js:98,107` で操作の値として使う）で、残りは関数。`VectorModel`・`HistoryManager` の import は無く注入で受け取る。「規則の関数だけをimportする」の扱いは下の所見に書く。対象の点の集め方 `#collectTargets`（`PathCornerEditor.js:164`。非公開）は角の切り替え（`:64`・`:74`）と区間の切り替え（`:89`・`:117`）の両方から呼ばれる。一致。前回までに照合した旧199行と同じ主張の記録（照合の対象外）：列挙された各クラス・ファイルは実在、`ShapeOrderEditor`・`NudgeEditor`・`ShapeAlignEditor` が `VectorModel`・`HistoryManager`（`EditRecorder`）を import せず注入、`PositionInputEditor` は `core/NudgeTargetRules`・`core/VertexHandleRules` を import（`HistoryManager` は持たない）、`ShapeExtentReader` は `DisplayWiring.js:65` が内部で生成し `main.js:719` がもう1つ生成（2か所）。
  * 211行 依存方向（Interrupt・Phase 9 で足された・変えられた主張）：
    * (1) `edit → shapes`：`PathJoiner → PathJoinRules`（`PathJoiner.js:5`）、`EndpointSnapper → EndpointSnapRules`・`PathJoinRules`（`:6-25`）、`PathCornerEditor → PathCornerRules`・`PathSegmentKindRules`（`:7-8`）。列挙と過不足なく一致（`edit/` の他のクラスは `shapes/` を import しない）。
    * (2) `shapes/` 内：`EndpointSnapRules → PathJoinRules`（`:5`）、`PathCornerRules → Path`（`:5`。`Path`・`SEGMENT_KIND_SMOOTH`・`readCornerFlags`）、`PathSegmentKindRules → Path`・`Line`・`PathJoinRules`（`segmentKindsOf`・`segmentSpecsOf`）・`PathCornerRules`（`resolveCornerState`・`CornerState`）（`:5-8`）。一致。`PathSegmentKindRules` を import するのは `edit/PathCornerEditor` だけ（`main.js`・`PathJoinRules.js`・`OptionBarCornerGroup.js` の記載はコメントのみで import ではない）。`PathJoinRules` は `Path`（`readCornerFlags` も）・`Line` のみ import（`:6-7`）、`PathCornerRules` は `PathJoinRules`・`EndpointSnapRules` を import しない、`Line` の import は `ShapeGeometry`・`ShapeDataValidation` だけ。一致。`PathSegmentKindRules → PathJoinRules` を import する理由（`segmentKindsOf`・`segmentSpecsOf` を使う）はコードの使用と一致。
    * (3) `edit → core`：`NudgeEditor.js:6`・`PositionInputEditor.js:6`・`PathCornerEditor.js:6 → core/NudgeTargetRules`、`PositionInputEditor.js:7 → core/VertexHandleRules`、`PositionInputRules.js:6 → core/StatusReadoutRules`。この4ファイルだけで、import するのはいずれも関数。一致。
  * 211行 依存方向（`7e0f93f` の旧202行から変わっていない文。照合の対象外〔発注者の判断〕。前回までに照合した記録として残す）：
    * `main.js` の import 先は `core/`（17件）・`edit/`（16件）・`io/`（3件）・`palette/`（9件）・`wiring/`（2件）のみ（`shapes/` を import しない。`7e0f93f` の `main.js` も `core/` 17件・`edit/` 15件・`io/` 3件・`palette/` 8件・`wiring/` 2件）。`wiring/` の import 先は `palette/`・`edit/`（`DisplayWiring.js:5` が `ShapeExtentReader`）・`core/`・`asset/sprite/`（`ToolIconWiring.js:5-6`）。`wiring/` を import するのは `main.js` だけ。
    * `core/` は `io/`・`edit/`・`palette/`・`wiring/`・`asset/` を import しない。`core/` から `shapes/` を import するのは `core/ShapeFactory.js:5-9` だけ。
    * `io/` は `io/` 内と `core/ShapeFactory`（`DocumentSerializer.js:5`）だけを import。`palette/` と `asset/sprite/` は import 文が0件。`check/` は `check/` 内と `io/SpriteSerializer`（`SpriteCheckInspector.js:5`）のみ。
    * `edit/` 内の import は `ShapeStyleEditor`・`StyleEyedropper → StylePanelRules`、`ShapeOrderEditor → ShapeOrderRules`、`ShapeAlignEditor → ShapeAlignRules`、`PositionInputEditor → PositionInputRules` のみ。
    * `core/` 内の import（`grep -n "^import" js/core/*.js`）：`js/core/*Rules.js`（15ファイル）のうち import 文があるのは `CursorShapeRules.js:6`・`NudgeTargetRules.js:5`・`ToolRules.js:5`・`VertexHandleRules.js:5`（いずれも `InputModes`）と `ToolRules.js:6`（`ShapeFactory` の `SHAPE_TYPES`）だけで、残りの11ファイル（`FocusKeyYieldRules`・`GridSpacingRules`・`MoveDirectionRules`・`PointHitRules`・`PressActionRules`・`RulerTickRules`・`SelectionRules`・`SpriteFitRules`・`StatusReadoutRules`・`UnitSnapRules`・`ViewFitRules`）は import 文が0件。`FocusKeyYieldRules` を import するのは規則でないファイル（`AltKeyGuard.js:6`・`InputTracker.js:9`・`KeyboardShortcuts.js:9`）、`GridSpacingRules` も規則でないファイル（`CanvasManager.js:5`・`RulerRenderer.js:6`）。したがって「規則の関数は何もimportしないか、`InputModes`の値だけ（`ToolRules`は加えて`ShapeFactory`の`SHAPE_TYPES`）をimportする」「逆向き（規則が状態を持つクラスをimportする）は無い」は一致。一方、`core/InputTracker.js:7` は状態を持つクラス `DragTracker`（`DragTracker.js:53` `export class`、`:64` `#session`・`:72` `#suppressNextClick`。生成は `InputTracker.js:452`）を import している（5章に記載。旧202行と同じ文だが、発注者の判断により見つかった事実として残す）。ほかに規則でないものの import は、`InputTracker.js:8`・`KeyboardShortcuts.js:7` の `InputModes`（値。`InputModes.js:16` の `InputState`・`:34` の `OperationMode`。規則のファイルではない）、`InputTracker.js:10`・`KeyboardShortcuts.js:8` の `SHAPE_TYPES`（定数）、`VectorModel.js:6` の `ShapeFactory`（インスタンス状態を持たない静的メソッド群。`ShapeFactory.js:56-58`）・`SHAPE_TYPES`。循環 import は、上の一覧から見つからない。
    * 「`core/InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドと第7引数の補助（`duplicateSelection`・`isPickingShape`・`pickShape`・`getUnitSnapStep`）を呼ぶだけ（`editRecorder`と同じ形）」：`InputTracker.js` の import（`:7-17`）に `edit/` は無い。`constructor`（`:370`）の第7引数は `inputAssist`で、`InputAssist` の型（`:129-136`）の項目はこの4つ。`main.js:169-177` が第5引数に `endpointSnapper`、第7引数にこの4つを渡す。
* **推測・所見**:
  * 相違：211行の `core/` 内の import の文1件（5章に記載）。この文は旧202行から変わっていない文で照合の対象外だが、発注者の判断により見つかった事実として5章に残す。
  * 読み方が分かれる記述（211行。旧202行から変わっていない文で照合の対象外〔発注者の判断〕。前回までに見つけた所見として残す。5章には挙げない）：「規則の関数は何もimportしないか、`InputModes`の値だけ（…）をimportする」は、直前の文の続きとして `core/` の規則の関数を指すと読めば一致する（上の事実のとおり）。ただし文頭の「規則の関数」が `core/` 以外の規則を含むかが書かれておらず、含むと読むと `shapes/` の規則（`PathJoinRules` 等は `Path`・`Line` を import）と `edit/PositionInputRules`（`core/StatusReadoutRules` を import）が当てはまらない（どちらも(2)・(3)に別に列挙されているため実害は小さい）。
  * 読み方が分かれる記述（211行。旧202行から変わっていない文で照合の対象外〔発注者の判断〕。前回までに見つけた所見として残す。5章には挙げない）：「`core/`内のimportは、処理・レンダラー・小さな部品が状態を持たない規則の関数をimportする向きだけ」のうち、`DragTracker` の import は5章の相違とした。`InputTracker.js:8`・`KeyboardShortcuts.js:7` の `InputModes`（値）、`InputTracker.js:10`・`KeyboardShortcuts.js:8` の `SHAPE_TYPES`（定数）、`VectorModel.js:6` の `ShapeFactory`（インスタンス状態を持たない静的メソッド群）は、状態を持たないものの import なので文の趣旨には沿うが、「規則の関数」に当たるかは資料から定まらない。
  * 読み方が分かれる記述（211行。列と「一方向の列から外れるimportは次の3種だけ」は旧202行から変わっていない文で照合の対象外〔発注者の判断〕。前回までに見つけた所見として残す。5章には挙げない）：列は `main.js → edit → io → core → shapes` だが、`main.js` は `core/`（import 文17件）・`io/`（3件。`DocumentSerializer`・`CanvasStorage`・`DocumentFileIO`）を直接 import している（`grep` `^import` `js/main.js`）。一方、同じく1段以上飛ぶ `edit/ → core/` は例外(3)に列挙されている。資料は列が「下流へなら段を飛んでよい」向きの順を表すのか、隣の段への import だけを許す並びなのかを書いておらず、前者なら `main.js → core/`・`main.js → io/` は列の向きどおり（逆向きではない）で列に含まれ、後者なら例外の3種に入っていない import になる。どちらとも読める（`edit/ → core/` だけを例外に挙げていることは後者の読み方に近いが、`main.js` を列の一段として扱ってよいかも書かれていない）。`main.js → palette/`（9件）はこれと分けて扱う：`palette/` は列 `main.js → edit → io → core → shapes` に含まれないので、どちらの読み方をしても列の中に入らない。211行に書かれているのは `wiring → palette` だけで、`main.js` が `palette/` を import することは書かれておらず、3種の例外にも入っていない。文どおりに読むと3種のほかに列から外れる import があることになるが、旧202行から変わっていない文（`7e0f93f` の `main.js` も `palette/` を8件 import）で照合の対象外のため、5章には挙げない。
  * 読み方が分かれる記述（201行。「パスを開く／閉じる」は旧192行から変わっていない主張で照合の対象外〔発注者の判断〕。前回までに見つけた所見として残す。5章には挙げない）：開いたパス1本を閉じる操作が結合のボタンにある（`PathJoinRules.js:264-269` の `classifyJoin` が `'close'`。`7e0f93f` の `PathJoinRules.js:59` にも同じ判定がある）ため、文字どおりの「パスを閉じる」は存在する。開く操作と、閉じた／開いたを切り替える専用の操作は `js/` に無い（`openPath`・`reopen`・`toggleClosed`・`setClosed` は0件、`'open'` は `CanvasPalette.js` のキャンバスを開く操作だけ、キーの `action` にも無い）ので、「開く・閉じるを切り替える仕組み」と読めば一致する。
  * 読み方が分かれる記述（201行。足された主張）：「今の曲線への制御点の追加・削除」は、今の曲線の点を足す・消す操作としては無い（上の事実）。ただし今の曲線に「直線に」を押すと直線に置き換わり（`PathSegmentKindRules.js:113-114,241-242`）、制御点が無くなる。これを制御点の削除に含めるかは資料から定まらないが、資料は同じ行で今の曲線の「曲線に」だけを存在しないものに挙げており、「直線に」は置き換えと読める。
  * 読み方が分かれる記述（201行。足された主張。5章には挙げない）：「『曲線に』で足す点以外の頂点の追加」は、同じ行で「頂点の削除」「パスの分割」と並び、旧192行の「頂点の追加・削除」を置き換えた文なので、選んだ図形の頂点を編集する操作として読めば一致する（上の事実）。ただし線を引くこと（`addDrawnPoint`）、描き足し（`buildExtendedPath`）、途中の点を打って閉じる結合（`planCloseWithPoints`）でも結果の頂点は増える。これらを「頂点の追加」に含めると文どおりには当てはまらないが、どれも資料の別の箇所に機能として書かれた操作で、資料は含めるかを書いていない。
  * 読み方が分かれる記述（205行。足された主張。5章には挙げない）：「結合できる線の端点の読み方は`lineEndpointOf`・`endpointVertexIndexOf`（`chainSourceOf`で読み替えた頂点の並びの先頭・末尾）」は、括弧書きを「端点とは読み替えた並びの先頭・末尾である」という端点の決め方と読めば、`lineEndpointOf` はその座標を、`endpointVertexIndexOf` はその端点に当たる元の頂点の番号（今の曲線は0／2、元の頂点でない弧の端は `null`）を返すので、両方とも一致する。括弧書きを両方の関数の戻り値の説明と読むと、`endpointVertexIndexOf` の戻り値は読み替えた並びの番号ではない（今の曲線は0／1でなく0／2、弧は番号でなく `null`）ので当てはまらない。コードの事実はどちらの読み方でも上のとおりで食い違いは無く、文の係り方だけが定まらないため、5章の相違ではなくこちらに挙げる（201行(d)の「弧で`null`」とも矛盾しない）。
  * 読み方が分かれる記述（208行。`PathCornerEditor` を列挙に足したことで新たに当てはまる部分。5章には挙げない）：「1件の編集操作の手順（…・`PathCornerEditor`）は…規則の関数だけをimportする」に対し、`PathCornerEditor.js:8` は関数のほかに凍結した列挙の定数 `SegmentKindSwitch`（`PathSegmentKindRules.js:15`）を import している。「規則の関数」が規則のファイルが公開する列挙の値を含む（規則のモジュールだけをimportする）と読めば一致し、文字どおり関数だけと読むと当てはまらない。資料はどちらかを書いていない。なお旧199行から列挙にある `ShapeOrderEditor`（`ShapeOrderOperation`。`ShapeOrderRules.js:14`）・`ShapeAlignEditor`（`ShapeAlignOperation`。`ShapeAlignRules.js:30`）も同じく凍結した列挙の定数を import しているが、旧行から変わっていない部分で照合の対象外のため、事実の記録にとどめる。
  * 照合できなかった主張（205行の足された主張のうち）：`PathJoinRules` の括弧の付記「Phase 09-03a」「Phase 09-03b」「Phase 09-01bで広げた」（どのサブフェイズで足した・広げたかの経緯で、`_log/` とgitが正本。コードの現在の姿からは確かめられない。`PathJoinRules.js:62,73,75` のJSDocにも同じ付記があるが、コメントの記述でコードの振る舞いではない）。
  * 照合できなかった主張（201行の足された・変えられた主張のうち）：「エンジンでの版3の確認と連絡票（Phase 09-04）」（リポジトリの外のエンジンでの確認。タスク2の範囲）。「Phase 09-01a」「Phase 09-01b」「Phase 09-02a」「Phase 09-02b」「Phase 09-03aの発注者の決定」「Phase 09-03bで決定」の付記（どのサブフェイズで決めたかの経緯で、`_log/` とgitが正本。コードの現在の姿からは確かめられない）。「弧の半径のハンドルはPhase 08-02aから画面に出ない」のうち「Phase 08-02aから」の時点（今出ないことは上の事実のとおり照合した。時点は経緯で、コードの現在の姿からは確かめられない）。
  * 照合の範囲：201行の足された・変えられた主張（上の(a)〜(f)）は、上の「照合できなかった主張」を除いて上の事実のとおり照合した。旧192行から変わっていない主張は照合の対象外で（発注者の判断）、前回までに事実を書いたものは記録として残したが、それ以外（経緯の付記「Phase 04-04でやめた」「Phase 07-02でなくした」「将来の野望」「アニメーションエディタモードのPhase」、「作業データ・書き出し・履歴のエントリの形・版は、Phase 8のどのサブフェイズでも変えていない」、「性能の改善を目的とした変更」、「ブラウザ・OSの操作を通すため」、「収まらない右側は切れる」の見え方、上の『調査内容』に挙げた項目 等）は照合していない。

### タスク2: `PROJECT_ARCHITECTURE.md` 2章と `15_io.md`・`17_sprite_check.md` の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク3: `PROJECT_ARCHITECTURE.md` 3章の既存の項（1.〜10.・13.〜21.）への追記の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク4: `PROJECT_ARCHITECTURE.md` 3章11.・12.と `14_edit.md`（依存・`PathJoiner`・`EndpointSnapper`）の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク5: `PROJECT_ARCHITECTURE.md` 3章22.と `06_InputTracker.md`・`07_KeyboardShortcuts.md` の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク6: `PROJECT_ARCHITECTURE.md` 3章23.・24.と `13_palette.md`・`14_edit.md`（`PathCornerEditor`）の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク7: `12_shapes.md` の照合と既知の傷の確認
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク8: `16_test.md`（既存のファイルの説明・Interrupt・09-01a・09-01b）の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク9: `16_test.md`（09-02a・09-02b・09-03a・09-03b）の照合と現在の件数
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク10: `01_index_html.md` の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク11: `02_main.md` の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク12: `03_VectorModel.md`・`10_ShapeFactory.md` と小さな修正（`28`・`30`・`33`・`40`・`41`）の照合
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク13: 要件2の検索
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

### タスク14: 相違の確認と一覧化
* **調査内容**: 
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

## 5. 開発資料との相違
* `PROJECT_ARCHITECTURE.md` および `_doc/arch/` 配下の記述と、実コードに相違があった場合のみ記載する。
* 形式: **（タスクN）（対象：資料のファイルと節・行番号）**： （資料の記述） → （実コードの実態。`ファイル:行` を添える）
* 相違が見つからなかった場合は、タスク14が「相違なし」と記載する（未確認と区別するため）。
* （タスク実行時に追記）
* **（タスク1）（対象：`PROJECT_ARCHITECTURE.md` 1章「プロジェクトフォルダ構造」の「依存方向」・211行）**：「`core/`内のimportは、処理・レンダラー・小さな部品が状態を持たない規則の関数をimportする向きだけで、逆向き（規則が状態を持つクラスをimportする）は無い」 → `core/InputTracker.js:7` は状態を持つクラス `DragTracker`（`core/DragTracker.js:53` の `export class`。非公開フィールド `:64` `#session`・`:72` `#suppressNextClick` を持ち、`InputTracker.js:452` で生成される）をimportしており、「状態を持たない規則の関数をimportする向きだけ」に当たらない（後半の「規則が状態を持つクラスをimportする逆向きは無い」は一致：`js/core/*Rules.js` のimportは `InputModes` と `ToolRules.js:6` の `SHAPE_TYPES` だけ）。この文は `7e0f93f` の旧202行から同じ文（Interrupt・Phase 9 で足された文ではない。`DragTracker.js` も `7e0f93f..0979518` で変更が無い）。

## 6. 懸念事項・今後の修正における注意点
* （タスク14が、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、資料のファイルと節・要点・タスク番号の一覧としてまとめる）
