# 作業指示書 REQ: Survey : Phase 8 クローズの開発資料の整合確認
* ルール: `./PROJECT_CONSTITUTION.md`
* 開発資料: `./PROJECT_ARCHITECTURE.md`
* 参考資料: `./_log/res/261116_1249_RES_Phase08-01_Input_Split.md`・`./_log/res/261116_1934_RES_Phase08-02a_Vertex_Tool.md`・`./_log/res/261116_2151_RES_Phase08-02b_Vertex_Multi.md`・`./_log/res/261117_1122_RES_Phase08-03_Arrow_Nudge.md`・`./_log/res/261117_1548_RES_Phase08-04_Position_Input.md`・`./_log/res/261117_1809_RES_Phase08-05_Align_Distribute.md`（Phase 8 の各サブフェイズの作業計画書。資料の記述の経緯を確かめる必要が生じた場合にのみ、該当箇所だけを参照する。全文は読まない）

## 【作業手順（厳守事項）】
本プロンプトは、Phase 8「精度」の期間に書き換えられた開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）の記述と、現在の実コードとの整合のSurveyの「計画立案」のみを目的とする。
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
6. 監査を通過した計画を、調査計画書テンプレート（`./_log/TEMPLATE_RES_SurveyPlan.md`）に完全に準拠したフォーマットで、調査計画書（`./_log/res/YYMMDD_HHMM_RES_Survey_Phase08_Doc_Consistency.md`）として新規作成し出力すること（※YYMMDD_HHMMは作業実行時の現在日時を当てはめること）。RES冒頭の「参照元REQ」には本ファイル（`./_log/req/261117_2000_REQ_Survey_Phase08_Doc_Consistency.md`）を記載すること。
7. チャットにて「調査計画書の作成が完了しました。タスクを実行するための新しいチャットへ移行してください」と報告すること。

## 【調査要件】
Phase 8 の各サブフェイズ（08-01〜08-05）の最終タスクで開発資料へ反映された記述が、Phase 8 終了時点（現在の `HEAD`）の実コードの事実と食い違っていないかを確かめる。各サブフェイズの反映時点ではそのサブフェイズの差分監査に合格しているため、特に **後のサブフェイズのコード変更によって、前のサブフェイズで書いた記述が古くなっていないか** を重点的に見る（例：08-01 で書いた`InputTracker`の行数・`core/`へ切り出した4つの規則・`wiring/DisplayWiring`・`main.js`の配線の記述が、08-02a・08-02b で`InputTracker`へ頂点の枝が増えた後も成り立つか。08-02a で書いた頂点の選択（`A`）・`VertexHandleRules`・選択集合の不変条件の記述が、08-02b の複数選択と 08-05 の`computeVertexHandlesBounds`の追加後も成り立つか。08-02b で書いた頂点のまとめ移動・`updateVertices`の記述が、08-03 の矢印キーでの微調整の経路の追加後も成り立つか。08-03 で書いた`HistoryManager`のまとめの鍵・`NudgeEditor`・`KeyboardShortcuts`の対応表の記述が、08-04 の`nudgeWithoutGrouping`の追加後も成り立つか。08-04 で書いた位置の数値入力・`ShapeExtentReader`・`StatusReadoutRules`・オプションバーの記述が、08-05 の整列・分布のまとまりと`VectorModel`のメソッドの追加後も成り立つか）。

* **要件1: 差分で追加・変更された記述の照合**
  * 【調査範囲】の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。照合するのは次のような、コードで真偽を確かめられる主張である：
    * ファイル・フォルダの存在と配置（1章のフォルダ構成図。`js/wiring/`・`asset/sprite/`・`test/` 配下を含む。「存在しないもの」「なくなったもの」として書かれたものが実際に無いことを含む）
    * import の有無・向き（1章「依存方向」とその例外（とくに`edit/`から`core/`をimportする3クラス）、`_doc/arch/` 各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの）
    * 公開メソッド・公開の関数・定数・typedef・列挙の一覧と、識別子の値（`_doc/arch/` 各ファイル。図形クラスの共通メソッド契約のメソッド数18と`getVertexHandleNames`、`OperationMode`・`InputState`の値、`ShiftRule`の3値、`POSITION_AXIS`、整列・分布の操作の値、`TOOL_IDS`の並び 等）
    * 状態の持ち主・初期値・通知（選択集合・頂点の選択（`VectorModel`）の不変条件、`onChange`の通知の条件と回数（とくに`updateVertices`・新しくした移動のメソッドが通知1回であること、頂点の選択の解除と選択集合の変更で2回出ること）、作業データ・履歴・保存先に入れていないもの）
    * 既定値・定数（矢印キーの移動量 1px・`Shift`で10px、履歴の上限、位置の欄の数字の形（小数第1位）、整列・分布の移動量が0かの判定の許容量、`index.html`の幅の見積もり 等）
    * 引数・戻り値・通知の回数など、関数の振る舞いの記述（`resolveNudgeTarget`・`buildNudgeGroupKey`・`collectVertexHandles`・`collectVertexHandlesInRect`・`isVertexHandle`・`computeVertexHandlesBounds`・`resolvePressAction`・`resolveCursorShape`・`isTextInputElement`・`isSpaceOperatedInputElement`・`isSpaceYieldedElement`・`commitEdit`のまとめの鍵・`nudge`／`nudgeWithoutGrouping`・`buildPositionInputView`・`resolvePositionDelta`・`getSelectedBounds`と図形1つずつの外枠の照会・整列・分布の規則の2つの関数・`formatReadoutNumber` 等）
    * 呼び出し元・呼び出し順・記録の時点（3章の各項の「流れ」「履歴の単位」「記録する操作と時点」「記録しない操作」、まとめの鍵を渡す経路と渡さない経路、ドラッグ中に受理しない操作、`model.onChange`だけで表示が追従すること 等）
    * `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表（`// 6.5.`〜`// 7.11.`）・注入の表・生成順の制約・主な関数・同期関数と購読先・行数）
    * `InputTracker` の記述（`_doc/arch/06_InputTracker.md`。行数、コンストラクタの引数、当たり分類の使い方、頂点の選択のモードの押下・クリック・範囲選択・まとめ移動の枝、`SHAPE_TYPES`を再exportしていないこと、モジュールのexport）
    * `KeyboardShortcuts` のキーの対応表（`_doc/arch/07_KeyboardShortcuts.md`。`A`・矢印キー8エントリ・`Shift`の分かれ方・キーリピート・入力欄にフォーカスがある間の扱い・`Ctrl`／`Alt`付きの矢印が一致しないこと）
    * 数値（行数：`main.js`・`InputTracker.js` 等、資料に書かれた行数すべて。ただし「Phase 08-02bで1445行から増加」のように過去の時点の値として書かれたものは、現在の値として書かれたものと区別し、過去の時点の値は `git show <コミット>:<パス>` で確かめられる範囲で確かめる）。行数は `wc -l` 等で実測し、資料の値と並べて記載する。
    * `index.html` の要素・属性・クラス・CSS変数（`_doc/arch/01_index_html.md` の記述。オプションバーの位置のまとまり・整列・分布のまとまりの要素のid、`type="number"`の属性（`step`・`min`・`max`の有無）、`disabled`の初期値、`.toolbar-group`・`.option-unit`・`.tool-btn`・`.icon-btn`、ボタンの`title`、幅の見積もりのコメント 等）
    * 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在、テストの内容の記述が実際のテストケースと合っているか、テストの件数、偽物と実物の使い分け、「テストできない箇所」の一覧）。テストの件数は、プロジェクトのルートで `node --test` を実行して確かめてよい（ファイルを書き換えない実行に限る）。
  * 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲（例：「`A`で`Delete`は何もしない」「頂点を2つ以上選んでいるときは端点への吸い付きを照会しない」「矢印キーの移動量は刻みへ丸めない」「位置の欄にスナップを働かせない」「整列・分布の外枠には線の太さを含む」「数値の確定1回が取り消し1件」）だけを照合し、方針そのものの是非は扱わない。
  * 実際のブラウザでの見え方・実測値についての記述（1280px幅での右端の位置、記号の字形、キャッシュの挙動 等）は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。本リポジトリの外（`D:\ozlab\ozengine-web` 等）についての記述も同じ扱いとする。
* **要件2: Phase 8 で移った・到達不能になった・公開の形が変わったものが、資料に現存する経路として残っていないか**
  * Phase 8 ではファイル・クラスの削除・改名は無く、31ファイルが新設された。そのかわり次の変化がある。これらが資料に「今もそうである」と読める形で残っていないかを確かめる。
    * **`InputTracker`から`core/`へ移った判定**：操作モードと入力状態の定数（`InputModes.js`）、フォーカスしている要素の判定（`FocusKeyYieldRules.js`）、押下で始める操作の分岐（`PressActionRules.js`）、カーソルの形の判定（`CursorShapeRules.js`）。`InputTracker`が今もこれらの判定表・定数を持つ、または`SHAPE_TYPES`を再exportすると読める記述が残っていないか。
    * **`main.js`から`js/wiring/`へ移った配線**：表示の配線（`DisplayWiring.js`）・ツールのアイコンの描画（`ToolIconWiring.js`）。`main.js`が今もこれらを直接行うと読める記述が残っていないか。
    * **選択（`V`）から到達不能になった枝**：各図形の`drawHandles`、`PressActionRules`の`dragHandle`の枝、`CursorShapeRules`のハンドルの枝、`CanvasManager.render`の`showHandles`が真のときの段、`VectorModel.updateVertex`。これらが「選択モードで使われる」と読める記述が残っていないか（「到達不能になった」「残してある」のように経緯・現状として正しく書かれているものは相違としない）。
    * **非公開からexportになったもの**：`isSpaceYieldedElement`（`FocusKeyYieldRules.js`）。「非公開でテストのためにexportしない」と読める記述が残っていないか。
  * 洗い出しは `git diff --name-status 6efcbad 33a5ca3 -- js index.html test` と【調査範囲】の差分の `-` 行で行い、**現在の実コードの事実**（その名前がどこにあるか・どこから呼ばれるか）を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）を検索する。
  * 本要件は、差分のない行については名前の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。
* **要件3: 照合の結果の整理**
  * 相違が見つかった記述は、RESの5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で記載する。
  * 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものがあれば、4章の各タスクの「推測・所見」に記載する（5章には入れない）。
  * 照合した主張と結果を、資料のファイル（節）ごとに4章の各タスクの欄へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、その理由を書く）。
  * **既知の傷3件**（現場設計セッションが把握している。確認漏れと区別するため、担当のタスクで確かめて5章へ必ず挙げること）：
    1. `_doc/arch/32_InputModes.md` のテストの列挙に `test/core/VertexHandleRules.test.js` が無い（Phase 08-02a 由来の書き漏れ）。
    2. `_doc/arch/02_main.md` の行数の行は、全角括弧の開閉が1つ合っていない（Phase 08-03 の着手前から）。
    3. `js/edit/ShapeExtentReader.js` のクラスJSDocに「main.jsが1つだけ生成する」と残っているが、実際は `js/wiring/DisplayWiring.js` の内部と `js/main.js` の2か所で生成している（`_doc/arch/14_edit.md` は2か所と正しく書いている）。**これはコードのコメントの側の食い違い**であり、5章に「資料は正しく、コードのJSDocが古い」と分かる形で書くこと。

## 【タスクの分け方の条件】
* 【調査範囲】の差分の `+` 行は、どれも必ず1つのタスクに割り当てる（重複・漏れなし）。計画書の各タスクの「対象ファイル」には、照合する資料のファイルと節（`PROJECT_ARCHITECTURE.md`は章・項の番号と見出し、現在のファイルでの行の範囲）、照合に使う主なコードのファイルを書く。
* 資料の `+` 行は合計で約31万字あり、1行が長い（1行で数千字になる行がある）。1タスクが読む資料の `+` 行とコードの合計が過大にならないよう、**1タスクの資料の `+` 行の合計をおおよそ3万字を上限の目安**として分ける（結果として10〜15タスク程度になる見込み）。目安は次のとおり：
  * `PROJECT_ARCHITECTURE.md`は、1章／2章／3章の既存の項への追記（1.〜17.）／3章18.（頂点の選択ツール）／3章19.（矢印キーでの微調整）／3章20.（位置の数値入力）／3章21.（整列・分布）／4章の一覧、のまとまりごとに分ける。3章18.は前半（08-02a）・後半（08-02b）の記述が2段に並ぶ構成のため、量に応じて2つに分けてよい。
  * `_doc/arch/`は、同じコードを読むもの同士をまとめる（例：`01_index_html.md`と`index.html`、`02_main.md`と`js/main.js`、`06_InputTracker.md`と`js/core/InputTracker.js`、`13_palette.md`と`js/palette/`、`14_edit.md`と`js/edit/`、`16_test.md`と`test/`、`03`・`04`・`05`・`08`・`10`・`12`は対応する`js/core/`・`js/shapes/`のファイルごとに数ファイルずつ、新設の`32`〜`41`は対応する`js/core/`・`js/wiring/`・`asset/`のファイルごとに数ファイルずつ、既存の`18`〜`31`の小さな修正はまとめて1タスク）。
  * `PROJECT_ARCHITECTURE.md`の3章の項と、同じ機能を扱う`_doc/arch/`のファイルを1つのタスクにまとめてもよい（読むコードが重なるため）。
* 要件2（移った・到達不能になった・公開の形が変わったものの検索）は、単独の1タスクにする。
* タスクは互いに独立に実行できること（前のタスクの調査結果を読まなくても実行できること）。

## 【計画書に必ず含めるべきタスクごとの作業】
AIが作成する調査計画書（RES）のタスクリストには、個別の調査タスクごとに、以下の作業を必ず含めること。
* 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、調査計画書の『事実』『推測・所見』欄にそれぞれ記載する。
* 資料の記述と実コードに相違があった場合は、調査計画書の『開発資料との相違』欄（5章）に、タスク番号を添えて記載する（作業は中断しない）。資料に書かれていない事項がコードに存在することは相違とみなさない。
* 相違の判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・Phase 8 のRESの記述だけで一致と判定しない）。一致と書く主張には、確かめたコードの場所（`ファイル:行`、または検索した語と件数）を添える。
* タスクの終わりに、ソースコードおよび資料ファイルを一切変更していないことを `git status` で確認する（変更があってよいのは調査計画書のRESファイルだけ）。

## 【計画書に必ず含めるべき固定タスク】
AIが作成する調査計画書（RES）のタスクリストには、全調査タスクの後に、以下のタスクを必ず含めること。
* 『開発資料との相違』欄を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。あわせて、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。

## 【調査範囲】
* **照合の対象とする記述**：次のコマンドで得られる差分の `+` 行（Phase 8 の最初のサブフェイズの開始の直前のコミット `6efcbad`（DIRの追加のみで開発資料を変更していない）から、最後のサブフェイズの完了を記録したコミット `33a5ca3` まで。`33a5ca3` より後のコミットは開発資料を変更していない）。
  * `git diff 6efcbad 33a5ca3 -- PROJECT_ARCHITECTURE.md _doc/arch`
  * 対象の35ファイル：`PROJECT_ARCHITECTURE.md`、`_doc/arch/` の `01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`04_CanvasManager.md`・`05_ViewTransform.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`16_test.md`・`18_PointHitRules.md`・`19_ToolRules.md`・`20_DisplayState.md`・`21_GridSpacingRules.md`・`24_CanvasCursorTracker.md`・`25_ViewFitRules.md`・`26_StatusReadoutRules.md`・`27_SelectionRules.md`・`29_AltKeyGuard.md`・`30_UnitSnapRules.md`・`31_UnitSnapSettings.md`、および新設の10ファイル `32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`・`35_CursorShapeRules.md`・`36_DisplayWiring.md`・`37_SpriteFitRules.md`・`38_VertexHandleRules.md`・`39_ToolIconWiring.md`・`40_asset_sprite.md`・`41_NudgeTargetRules.md`
  * 現在のファイルでの行番号は `git diff -U0 6efcbad 33a5ca3 -- <ファイル>` のハンクの見出しで分かる。
* **照合に使う実コード**：現在の作業ツリー（`HEAD`）の `./index.html`、`./js/` 配下、`./test/` 配下、`./asset/` 配下。Phase 8 で変更されたコードの一覧は `git diff --stat 6efcbad 33a5ca3 -- js index.html test asset` で得られる（59ファイル）。これ以外のファイルも、記述の照合に必要なら読んでよい。
* **対象外**：差分の `+` 行以外の資料の記述（Phase 8 より前から変わっていない記述。要件2の名前の検索で見つかった箇所を除く）、`_doc/` の他のファイル（`COWORK_STATUS.md`・`COWORK_HANDOFF.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_MILESTONE.md` 等）、`_log/dir/` 配下、本リポジトリの外のファイル。
