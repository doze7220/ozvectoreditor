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
* [ ] タスク1: `PROJECT_ARCHITECTURE.md` 1章（フォルダ構成・存在しないもの・各フォルダの役割・依存方向）の照合（`+` 行 約1.9万バイト）
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
  * （タスク実行時に記載）
* **事実（実コードの記述）**:
  * （タスク実行時に記載）
* **推測・所見**:
  * （タスク実行時に記載）

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

## 6. 懸念事項・今後の修正における注意点
* （タスク14が、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、資料のファイルと節・要点・タスク番号の一覧としてまとめる）
