# 作業指示書 REQ: Survey : Phase 9 クローズの開発資料の整合確認
* ルール: `./PROJECT_CONSTITUTION.md`
* 開発資料: `./PROJECT_ARCHITECTURE.md`
* 参考資料: `./_log/res/261118_1532_RES_Interrupt_Continuous_Line.md`・`./_log/res/261118_1937_RES_Phase09-01a_Curve_Tool.md`・`./_log/res/261119_1059_RES_Phase09-01b_Curve_Join.md`・`./_log/res/261119_1415_RES_Phase09-02a_Corner_Point.md`・`./_log/res/261119_1804_RES_Phase09-02b_Segment_Kind_Switch.md`・`./_log/res/261119_2113_RES_Phase09-03a_Curve_Join.md`・`./_log/res/261120_1131_RES_Phase09-03b_Arc_Join.md`・`./_log/res/261120_1441_RES_Phase09-04_Engine_Roundtrip.md`（Phase 8 クローズ後の Interrupt と Phase 9 の各サブフェイズの作業計画書・作業レポート。資料の記述の経緯を確かめる必要が生じた場合にのみ、該当箇所だけを参照する。全文は読まない）

## 【作業手順（厳守事項）】
本プロンプトは、Phase 8 クローズ後の Interrupt「線を続けて引く」と Phase 9「曲線のパス」の期間に書き換えられた開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）の記述と、現在の実コードとの整合のSurveyの「計画立案」のみを目的とする。
**本作業および以後のタスク実行を通じて、いかなる理由があってもソースコードおよび資料ファイルの修正・作成を行ってはならない（RESファイルの出力を除く）。** 本工程では調査そのものも行わず、計画の立案のみに留めること。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本Surveyでは、開発資料の記述そのものが調査対象である。【調査範囲】に示す差分を取得し、`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の該当ファイルを読んで、どのファイルのどの節にどれだけの記述が足されたか・その記述がどのコードについて述べているかを把握すること（本REQでパスを指定しているため、`_doc/arch/` 配下の読み取りを許可する。`_doc/` の他のファイルは読まない）。
3. 以下の【調査要件】を明らかにするための調査計画を立案し、AIがハルシネーションを起こさない適切なスコープを持つ細かなタスクリストを構築すること。タスクの分け方は【タスクの分け方の条件】に従う。
4. 調査計画書（RES）の『参照する責務』項目には、**資料の記述を書き写さない**（照合の対象は資料の原文そのものであり、書き写すと写し誤りが照合の誤りになるため）。代わりに、以後のタスク実行チャットが従う次の事項を書くこと：
   * 照合の対象を取得する方法（【調査範囲】のコマンドと、タスクごとの対象の絞り方）
   * 照合する主張の種類と、照合しないもの（【調査要件】要件1の内容。タスク実行チャットは本REQを読まないため、要件1〜3の判定の基準を漏らさず写すこと）
   * 結果の書き方（【計画書に必ず含めるべきタスクごとの作業】の内容）
   * 各タスク実行チャットは、自分のタスクの対象として計画書が指定した資料のファイル・節（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）を読んでよいこと（`_doc/` の他のファイルは読まない）
5. 計画を出力する前に内部で自己監査を行い、調査範囲の重複・漏れ（【調査範囲】の差分の `+` 行が、いずれか1つのタスクに必ず割り当てられていること）、および1タスクあたりのスコープが過大になっていないかを確認して計画を純化すること。（※監査プロセスのテキスト出力は不要）
6. 監査を通過した計画を、調査計画書テンプレート（`./_log/TEMPLATE_RES_SurveyPlan.md`）に完全に準拠したフォーマットで、調査計画書（`./_log/res/YYMMDD_HHMM_RES_Survey_Phase09_Doc_Consistency.md`）として新規作成し出力すること（※YYMMDD_HHMMは作業実行時の現在日時を当てはめること）。RES冒頭の「参照元REQ」には本ファイル（`./_log/req/261120_1620_REQ_Survey_Phase09_Doc_Consistency.md`）を記載すること。
7. チャットにて「調査計画書の作成が完了しました。タスクを実行するための新しいチャットへ移行してください」と報告すること。

## 【調査要件】
Interrupt「線を続けて引く」と Phase 9 の各サブフェイズ（09-01a・09-01b・09-02a・09-02b・09-03a・09-03b・09-04）の最終タスクで開発資料へ反映された記述が、現在の `HEAD` の実コードの事実と食い違っていないかを確かめる。各サブフェイズの反映時点ではそのサブフェイズの差分監査に合格しているため、特に **後のサブフェイズのコード変更によって、前のサブフェイズで書いた記述が古くなっていないか** を重点的に見る（例：Interrupt で書いた「線を続けて引く」・`isDrawnLineShape`・`isJoinableLine`・`EndpointSnapper.isDrawingLine()`の記述が、09-01a の曲線のツール・09-01b の曲線のパスの結合・09-03a/b の今の曲線・弧の結合の後も成り立つか。09-01a で書いた区間の種類（`'line'`・`'smooth'`）・`ACCEPTED_SEGMENT_KINDS`・`fromJSON`の検証・書き出しの`bezierPath`の記述が、09-02a の`corners`と 09-03a の`'bezier'`の追加後も成り立つか。09-01b で書いた結合の結果の区間の種類の保ち方・`segmentKindsOf`の記述が、09-02b の公開化と 09-03a の`chainSourceOf`の追加後も成り立つか。09-02a で書いた角の点・`PathCornerRules`・`PathCornerEditor`・`OptionBarCornerGroup`の記述が、09-02b で同じクラスが区間の切り替えも受け持った後も成り立つか。09-02b で書いた「直線に」「曲線に」・`PathSegmentKindRules.changedSegmentIndexes`の記述が、09-03a の`'bezier'`の追加後も成り立つか。09-03a で書いた「弧は結合できない」に当たる記述が、09-03b の後に残っていないか）。

* **要件1: 差分で追加・変更された記述の照合**
  * 【調査範囲】の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。照合するのは次のような、コードで真偽を確かめられる主張である：
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
  * 本リポジトリの外についての記述は、原則として「照合できなかった主張」とする。ただし `PROJECT_ARCHITECTURE.md` 2章「エンジンとの約束」の(b)については、OZ Engine の `D:\ozlab\ozengine-web\oz\ENGINE_API.md` 23章と `D:\ozlab\ozengine-web\js\scenes\FlightScene.js` の2ファイルだけを**読み取りのみ**で参照して照合してよい（エンジンのリポジトリのほかのファイルは読まない。どのファイルも変更しない）。
* **要件2: Interrupt と Phase 9 で変わった・広がった・公開の形が変わったものが、資料に古い形のまま残っていないか**
  * Interrupt と Phase 9 ではファイル・クラスの削除・改名は無く、ソース4ファイル・テスト5ファイルが新設された。そのかわり次の変化がある。これらが資料に「今もそうである」と読める形で残っていないかを確かめる。
    * **結合できる線が広がった**：直線・開いたパス → 区間の種類によらない開いたパス（09-01b）・今の曲線（09-03a）・弧（09-03b）。「曲線のパス・今の曲線・弧は結合できない」「結合できる線は直線と直線のパスだけ」と読める記述。
    * **曲線のツールの作るものが変わった**：今の曲線（`curve`。1本の2次の曲線）→ 点を打つ曲線のパス（09-01a。`ShapeFactory.create('curve')`の戻り値の`type`は`'path'`）。「曲線のツールは`Curve`を作る」「`create(type)`の戻り値の`type`は常に引数と一致する」と読める記述。
    * **区間の種類が増えた**：`'line'`のみ → `'line'`・`'smooth'`（09-01a）・`'bezier'`（09-03a）。「`kind`は`'line'`のみ」「パスは区間がすべて直線」と読める記述。
    * **書き出し形式の版が上がった**：版2 → 版3（09-01a。描画要素`bezierPath`の追加）。「現行の書き出し形式は版2」「パスは常に`polyline`」と読める記述（作業データの版は2のままである点と取り違えていないかも見る）。
    * **公開の形が変わったもの**：`ShapeDataValidation`の`isPlainObject`のexport（09-01a。`Path.js`の同名の非公開関数は消えた）、`PathJoinRules.segmentKindsOf`の公開（09-02b）、`Path`の区間の種類の定数のexport、`PathCornerEditor`・`OptionBarCornerGroup`が区間の切り替えも受け持つこと（09-02b）。「非公開」「`Path.js`が自前で持つ」「角だけを扱う」と読める記述。
    * **線を引いている途中かの判定**：`EndpointSnapper.isDrawingLine()`が直線のツールだけに当たると読める記述（09-01a以降は曲線のツールの作成途中の線も当たる）。
  * 洗い出しは `git diff --name-status 7e0f93f 0979518 -- js index.html test asset sprite-check.html` と【調査範囲】の差分の `-` 行で行い、**現在の実コードの事実**（その名前がどこにあるか・どこから呼ばれるか）を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）を検索する。
  * 本要件は、差分のない行については名前・語の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。「Phase 05 では」「09-01a の時点では」のように経緯・過去の状態として正しく書かれているものは相違としない。
* **要件3: 照合の結果の整理**
  * 相違が見つかった記述は、RESの5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で記載する。
  * 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものがあれば、4章の各タスクの「推測・所見」に記載する（5章には入れない）。
  * 照合した主張と結果を、資料のファイル（節）ごとに4章の各タスクの欄へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、その理由を書く）。
  * **既知の傷1件**（現場設計セッションが把握している。確認漏れと区別するため、担当のタスクで確かめて5章へ必ず挙げること）：
    1. `js/shapes/PathSegmentKindRules.js` の `SegmentSwitchTarget` のJSDocは、`js/shapes/PathCornerRules.js` の `CornerTarget` と同じ形であることに触れているが、`CornerTarget` 側のJSDocは `SegmentSwitchTarget` に触れていない（09-02b で `PathCornerRules.js` を変えない約束だったため。`_doc/arch/12_shapes.md` と `PROJECT_ARCHITECTURE.md` 3章24. には両者が同じ形であることが書かれている）。**これはコードのコメントの側の小さな残り**であり、5章に「資料は正しく、コードのJSDocが片側だけ」と分かる形で書くこと。

## 【タスクの分け方の条件】
* 【調査範囲】の差分の `+` 行は、どれも必ず1つのタスクに割り当てる（重複・漏れなし）。計画書の各タスクの「対象ファイル」には、照合する資料のファイルと節（`PROJECT_ARCHITECTURE.md`は章・項の番号と見出し、現在のファイルでの行の範囲）、照合に使う主なコードのファイルを書く。
* 資料の `+` 行は合計で約27万バイト（約9万字）あり、1行が長い（1行で数千字になる行がある）。1タスクが読む資料の `+` 行とコードの合計が過大にならないよう、**1タスクの資料の `+` 行の合計をおおよそ3万字を上限の目安**として分ける（結果として8〜12タスク程度になる見込み）。目安は次のとおり：
  * `PROJECT_ARCHITECTURE.md`（`+` 行は約11.5万バイト）は、1章／2章（図形データ・書き出し形式・エンジンとの約束）／3章の既存の項への追記（1.〜21.。とくに11.結合・12.端点への吸い付きと描き足し）／3章22.（直線・曲線のツールで線を続けて引く）／3章23.（点の滑らかさ）・24.（区間の切り替え）、のまとまりごとに分ける。量に応じて2章・3章22.を2つに分けてよい。
  * `_doc/arch/`は、同じコードを読むもの同士をまとめる（例：`12_shapes.md`と`js/shapes/`（`+` 行は約3.8万バイト）、`16_test.md`と`test/`（約4万バイト。量に応じて2つに分けてよい）、`01_index_html.md`と`index.html`、`02_main.md`と`js/main.js`、`06_InputTracker.md`・`07_KeyboardShortcuts.md`と`js/core/InputTracker.js`・`js/core/KeyboardShortcuts.js`、`03_VectorModel.md`・`10_ShapeFactory.md`と`js/core/`の該当ファイル、`13_palette.md`・`14_edit.md`と`js/palette/`・`js/edit/`、`15_io.md`・`17_sprite_check.md`と`js/io/`・確認用ページ、小さな修正の`28`・`30`・`33`・`40`・`41`はまとめて1タスク）。
  * `PROJECT_ARCHITECTURE.md`の3章の項と、同じ機能を扱う`_doc/arch/`のファイルを1つのタスクにまとめてもよい（読むコードが重なるため）。
* 要件2（変わった・広がった・公開の形が変わったものの検索）は、単独の1タスクにする。
* タスクは互いに独立に実行できること（前のタスクの調査結果を読まなくても実行できること）。

## 【計画書に必ず含めるべきタスクごとの作業】
AIが作成する調査計画書（RES）のタスクリストには、個別の調査タスクごとに、以下の作業を必ず含めること。
* 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、調査計画書の『事実』『推測・所見』欄にそれぞれ記載する。
* 資料の記述と実コードに相違があった場合は、調査計画書の『開発資料との相違』欄（5章）に、タスク番号を添えて記載する（作業は中断しない）。資料に書かれていない事項がコードに存在することは相違とみなさない。
* 相違の判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・Phase 9 のRESの記述だけで一致と判定しない）。一致と書く主張には、確かめたコードの場所（`ファイル:行`、または検索した語と件数）を添える。
* タスクの終わりに、ソースコードおよび資料ファイルを一切変更していないことを `git status` で確認する（変更があってよいのは調査計画書のRESファイルだけ）。

## 【計画書に必ず含めるべき固定タスク】
AIが作成する調査計画書（RES）のタスクリストには、全調査タスクの後に、以下のタスクを必ず含めること。
* 『開発資料との相違』欄を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。あわせて、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。

## 【調査範囲】
* **照合の対象とする記述**：次のコマンドで得られる差分の `+` 行（Phase 8 のクローズを記録したコミット `7e0f93f`（Interrupt「線を続けて引く」の開始の直前。Phase 8 の資料の整合確認はここまでで済んでいる）から、Phase 09-04 の完了のコミット `0979518` まで。`0979518` より後のコミットは開発資料を変更していない）。
  * `git diff 7e0f93f 0979518 -- PROJECT_ARCHITECTURE.md _doc/arch`
  * 対象の18ファイル：`PROJECT_ARCHITECTURE.md`、`_doc/arch/` の `01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`17_sprite_check.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md`・`33_FocusKeyYieldRules.md`・`40_asset_sprite.md`・`41_NudgeTargetRules.md`
  * 現在のファイルでの行番号は `git diff -U0 7e0f93f 0979518 -- <ファイル>` のハンクの見出しで分かる。
* **照合に使う実コード**：現在の作業ツリー（`HEAD`）の `./index.html`、`./sprite-check.html`、`./js/` 配下、`./test/` 配下、`./asset/` 配下。Interrupt と Phase 9 で変更されたコードの一覧は `git diff --stat 7e0f93f 0979518 -- js index.html test asset sprite-check.html` で得られる（41ファイル）。これ以外のファイルも、記述の照合に必要なら読んでよい。
* **対象外**：差分の `+` 行以外の資料の記述（Interrupt より前から変わっていない記述。要件2の検索で見つかった箇所を除く）、`_doc/` の他のファイル（`COWORK_STATUS.md`・`COWORK_HANDOFF.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_MILESTONE.md` 等）、`_log/dir/` 配下、本リポジトリの外のファイル（要件1で許した OZ Engine の2ファイルを除く）。
