# RES: 調査計画・調査レポート Survey : Phase 8 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261117_2000_REQ_Survey_Phase08_Doc_Consistency.md`

## 1. 調査目的
Phase 8「精度」の各サブフェイズ（08-01・08-02a・08-02b・08-03・08-04・08-05）の最終タスクで開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）へ反映された記述が、Phase 8 終了時点（現在の `HEAD`）の実コードの事実と食い違っていないかを確かめる。各サブフェイズの反映時点ではそのサブフェイズの差分監査に合格しているため、**後のサブフェイズのコード変更によって、前のサブフェイズで書いた記述が古くなっていないか**を重点的に見る。重点の例は次のとおり。
* 08-01 で書いた`InputTracker`の行数・`core/`へ切り出した4つの規則・`wiring/DisplayWiring`・`main.js`の配線の記述が、08-02a・08-02b で`InputTracker`へ頂点の枝が増えた後も成り立つか。
* 08-02a で書いた頂点の選択（`A`）・`VertexHandleRules`・選択集合の不変条件の記述が、08-02b の複数選択と 08-05 の`computeVertexHandlesBounds`の追加後も成り立つか。
* 08-02b で書いた頂点のまとめ移動・`updateVertices`の記述が、08-03 の矢印キーでの微調整の経路の追加後も成り立つか。
* 08-03 で書いた`HistoryManager`のまとめの鍵・`NudgeEditor`・`KeyboardShortcuts`の対応表の記述が、08-04 の`nudgeWithoutGrouping`の追加後も成り立つか。
* 08-04 で書いた位置の数値入力・`ShapeExtentReader`・`StatusReadoutRules`・オプションバーの記述が、08-05 の整列・分布のまとまりと`VectorModel`のメソッドの追加後も成り立つか。

本調査では、ソースコード・資料ファイルを一切変更しない（変更してよいのは本RESファイルだけ）。

## 2. 調査要件
### 要件1: 差分で追加・変更された記述の照合
* 「参照する責務」B.の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。照合する主張の種類と照合しないものは「参照する責務」C.のとおり。

### 要件2: Phase 8 で移った・到達不能になった・公開の形が変わったものが、資料に現存する経路として残っていないか
* Phase 8 ではファイル・クラスの削除・改名は無く、`js`・`index.html`・`test`で31ファイルが新設された（`asset/sprite/`の2ファイルを足すと33ファイル）。そのかわりに起きた変化（「参照する責務」D.の4種）が、資料に「今もそうである」と読める形で残っていないかを、資料の全ファイルの名前の検索で確かめる（タスク17）。

### 要件3: 照合の結果の整理
* 相違・あいまいな記述・照合の結果を、「参照する責務」E.の書き方で4章・5章・6章へまとめる。既知の傷3件（「参照する責務」F.）は、担当のタスクで確かめて5章へ必ず挙げる。

### 参照する責務
本節は、以後の各タスク実行チャット（本REQを読まない）が従う事項である。**資料の記述そのものはここへ書き写さない**（照合の対象は資料の原文そのもの。書き写すと写し誤りが照合の誤りになるため）。

#### A. 読んでよい資料と読まないもの
* 各タスクは、3章の自分のタスクの「対象ファイル」に書かれた資料のファイル・節（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）を読んでよい。照合のために、同じファイルの前後の行（差分のない行）を文脈として読むことも許す（ただし差分のない行の記述は照合の対象外。タスク17の検索で見つかった箇所を除く）。
* タスク17だけは、`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の**全ファイル**（差分のないファイル `09_DragTracker.md`・`11_WindowManager.md`・`15_io.md`・`17_sprite_check.md`・`22_RulerTickRules.md`・`23_RulerRenderer.md`・`28_MoveDirectionRules.md` を含む）を検索・閲覧してよい。
* `_doc/` の他のファイル（`COWORK_STATUS.md`・`COWORK_HANDOFF.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_MILESTONE.md` 等）・`_log/dir/` 配下・本リポジトリの外のファイルは読まない。
* Phase 8 の各サブフェイズの作業計画書（`./_log/res/261116_1249_RES_Phase08-01_Input_Split.md`・`./_log/res/261116_1934_RES_Phase08-02a_Vertex_Tool.md`・`./_log/res/261116_2151_RES_Phase08-02b_Vertex_Multi.md`・`./_log/res/261117_1122_RES_Phase08-03_Arrow_Nudge.md`・`./_log/res/261117_1548_RES_Phase08-04_Position_Input.md`・`./_log/res/261117_1809_RES_Phase08-05_Align_Distribute.md`）は、資料の記述の経緯を確かめる必要が生じた場合にのみ、`Grep`で該当箇所だけを参照する（全文は読まない）。**これらのRESの記述だけで一致と判定してはならない。**
* 照合に使う実コードは現在の作業ツリー（`HEAD`）の `./index.html`、`./js/` 配下、`./test/` 配下、`./asset/` 配下。3章の「対象ファイル」に挙げたコード以外も、照合に必要なら読んでよい。

#### B. 照合の対象を取得する方法
* 照合の対象は、次のコマンドで得られる差分の `+` 行だけである（`6efcbad`＝Phase 8 の最初のサブフェイズの開始の直前のコミット。`33a5ca3`＝最後のサブフェイズ（08-05）の完了を記録したコミット）。
  * `git diff 6efcbad 33a5ca3 -- PROJECT_ARCHITECTURE.md _doc/arch`
* 自分のタスクの対象への絞り方：
  1. `git diff -U0 6efcbad 33a5ca3 -- <資料のファイル>` を実行し、ハンクの見出し（`@@ -a,b +c,d @@`）の `+c,d`（現在のファイルでの開始行と行数。`d`が無いときは1行）を得る。3章の各タスクの「対象ファイル」に、計画立案時に得たハンクの見出し（`+c,d`）を列挙してある。そのうち自分のタスクに割り当てられた行の範囲のハンクだけを扱う。
  2. `33a5ca3` より後のコミットは資料・コードを変更していない（計画立案時に `git diff --stat 33a5ca3 HEAD -- PROJECT_ARCHITECTURE.md _doc/arch js index.html test asset` が空であることを確認済み）。そのため、現在の資料のファイルの該当の行を `Read` の offset/limit で開けば、それが `+` 行の原文である（タスクの最初に同じコマンドで空であることを再確認すること。空でなければ差分の出力の `+` 行の側を正とする）。
  3. 資料の行は1行が長い（1行で数千字になる行がある）。1行が `+` 行なら、その行に書かれた主張は（Phase 8 より前から残っていた語句を含めて）すべて照合の対象とする。どの語句が Phase 8 で変わったかを知りたいときは `git diff --word-diff=plain -U0 6efcbad 33a5ca3 -- <資料のファイル>` を使ってよい（後のサブフェイズの変化で古くなりやすい箇所を優先して見る手がかりにする）。
  4. ある記述がどのサブフェイズで書かれたかを知る必要があるときは、各サブフェイズの完了のコミットの間の差分（`git diff <前の完了> <その完了> -- <資料のファイル>`）で確かめる。完了のコミット：08-01＝`14a7c30`、08-02a＝`93d6584`、08-02b＝`03859f6`、08-03＝`890fd23`、08-04＝`4f7d031`、08-05＝`33a5ca3`（開始の直前＝`6efcbad`）。
* Phase 8 で変更されたコードの一覧は `git diff --stat 6efcbad 33a5ca3 -- js index.html test asset` で得られる（計画立案時の実測は61ファイル）。

#### C. 照合する主張の種類と、照合しないもの（要件1の判定の基準）
* **照合する主張**（コードで真偽を確かめられる主張）：
  1. ファイル・フォルダの存在と配置（1章のフォルダ構成図。`js/wiring/`・`asset/sprite/`・`test/` 配下を含む。「存在しないもの」「なくなったもの」として書かれたものが実際に無いことを含む）。
  2. import の有無・向き（1章「依存方向」とその例外（とくに`edit/`から`core/`をimportする3クラス）、`_doc/arch/` 各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの）。
  3. 公開メソッド・公開の関数・定数・typedef・列挙の一覧と、識別子の値（`_doc/arch/` 各ファイル。図形クラスの共通メソッド契約のメソッド数18と`getVertexHandleNames`、`OperationMode`・`InputState`の値、`ShiftRule`の3値、`POSITION_AXIS`、整列・分布の操作の値、`TOOL_IDS`の並び 等）。
  4. 状態の持ち主・初期値・通知（選択集合・頂点の選択（`VectorModel`）の不変条件、`onChange`の通知の条件と回数（とくに`updateVertices`・新しくした移動のメソッドが通知1回であること、頂点の選択の解除と選択集合の変更で2回出ること）、作業データ・履歴・保存先に入れていないもの）。
  5. 既定値・定数（矢印キーの移動量 1px・`Shift`で10px、履歴の上限、位置の欄の数字の形（小数第1位）、整列・分布の移動量が0かの判定の許容量、`index.html`の幅の見積もり 等）。
  6. 引数・戻り値・通知の回数など、関数の振る舞いの記述（`resolveNudgeTarget`・`buildNudgeGroupKey`・`collectVertexHandles`・`collectVertexHandlesInRect`・`isVertexHandle`・`computeVertexHandlesBounds`・`resolvePressAction`・`resolveCursorShape`・`isTextInputElement`・`isSpaceOperatedInputElement`・`isSpaceYieldedElement`・`commitEdit`のまとめの鍵・`nudge`／`nudgeWithoutGrouping`・`buildPositionInputView`・`resolvePositionDelta`・`getSelectedBounds`と図形1つずつの外枠の照会・整列・分布の規則の2つの関数・`formatReadoutNumber` 等）。
  7. 呼び出し元・呼び出し順・記録の時点（3章の各項の「流れ」「履歴の単位」「記録する操作と時点」「記録しない操作」、まとめの鍵を渡す経路と渡さない経路、ドラッグ中に受理しない操作、`model.onChange`だけで表示が追従すること 等）。
  8. `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表（`// 6.5.`〜`// 7.11.`）・注入の表・生成順の制約・主な関数・同期関数と購読先・行数）。
  9. `InputTracker` の記述（`_doc/arch/06_InputTracker.md`。行数、コンストラクタの引数、当たり分類の使い方、頂点の選択のモードの押下・クリック・範囲選択・まとめ移動の枝、`SHAPE_TYPES`を再exportしていないこと、モジュールのexport）。
  10. `KeyboardShortcuts` のキーの対応表（`_doc/arch/07_KeyboardShortcuts.md`。`A`・矢印キー8エントリ・`Shift`の分かれ方・キーリピート・入力欄にフォーカスがある間の扱い・`Ctrl`／`Alt`付きの矢印が一致しないこと）。
  11. 数値（行数：`main.js`・`InputTracker.js` 等、資料に書かれた行数すべて）。行数は `wc -l` 等で実測し、資料の値と並べて記載する（最終行が改行で終わらないファイルでは `wc -l` が1少なく出るため、`awk 'END{print NR}' <ファイル>` の値も確かめ、両者が違うときは両方を書く）。「Phase 08-02bで1445行から増加」のように**過去の時点の値**として書かれたものは、現在の値として書かれたものと区別し、`git show <コミット>:<パス> | wc -l` 等（コミットはB.4の完了のコミット）で確かめられる範囲で確かめる。
  12. `index.html` の要素・属性・クラス・CSS変数（`_doc/arch/01_index_html.md` の記述。オプションバーの位置のまとまり・整列・分布のまとまりの要素のid、`type="number"`の属性（`step`・`min`・`max`の有無）、`disabled`の初期値、`.toolbar-group`・`.option-unit`・`.tool-btn`・`.icon-btn`、ボタンの`title`、幅の見積もりのコメント 等）。
  13. 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在、テストの内容の記述が実際のテストケースと合っているか、テストの件数、偽物と実物の使い分け、「テストできない箇所」の一覧）。テストの件数は、プロジェクトのルートで `node --test`（全体）または `node --test <テストファイル>`（ファイル単位）を実行して確かめてよい（ファイルを書き換えない実行に限る）。過去の時点の件数（「Phase 08-01完了時」等）は、`git show <完了のコミット>:<テストファイル>` のテストケースの数（`test(`・`it(` の呼び出しの数）で確かめられる範囲で確かめ、確かめきれなければ「照合できなかった主張」として理由を書く。
* **意図・方針の記述の扱い**：「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲（例：「`A`で`Delete`は何もしない」「頂点を2つ以上選んでいるときは端点への吸い付きを照会しない」「矢印キーの移動量は刻みへ丸めない」「位置の欄にスナップを働かせない」「整列・分布の外枠には線の太さを含む」「数値の確定1回が取り消し1件」）だけを照合し、**方針そのものの是非は扱わない**。
* **照合できなかった主張として扱うもの**：実際のブラウザでの見え方・実測値についての記述（1280px幅での右端の位置、記号の字形、キャッシュの挙動 等）は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。本リポジトリの外（`D:\ozlab\ozengine-web` 等）についての記述、テストプレイの結果・発注者の回答のような記録も同じ扱いとする。
* **照合しないもの**：差分の `+` 行以外の資料の記述（Phase 8 より前から変わっていない記述。タスク17の名前の検索で見つかった箇所を除く）、`_doc/` の他のファイル、`_log/dir/` 配下、本リポジトリの外のファイル。資料に書かれていない事項がコードに存在することは相違とみなさない。

#### D. 要件2で探す4種の変化（タスク17の判定の基準）
* **`InputTracker`から`core/`へ移った判定**：操作モードと入力状態の定数（`InputModes.js`）、フォーカスしている要素の判定（`FocusKeyYieldRules.js`）、押下で始める操作の分岐（`PressActionRules.js`）、カーソルの形の判定（`CursorShapeRules.js`）。`InputTracker`が今もこれらの判定表・定数を持つ、または`SHAPE_TYPES`を再exportすると読める記述が残っていないか。
* **`main.js`から`js/wiring/`へ移った配線**：表示の配線（`DisplayWiring.js`）・ツールのアイコンの描画（`ToolIconWiring.js`）。`main.js`が今もこれらを直接行うと読める記述が残っていないか。
* **選択（`V`）から到達不能になった枝**：各図形の`drawHandles`、`PressActionRules`の`dragHandle`の枝、`CursorShapeRules`のハンドルの枝、`CanvasManager.render`の`showHandles`が真のときの段、`VectorModel.updateVertex`。これらが「選択モードで使われる」と読める記述が残っていないか（「到達不能になった」「残してある」のように経緯・現状として正しく書かれているものは相違としない）。
* **非公開からexportになったもの**：`isSpaceYieldedElement`（`FocusKeyYieldRules.js`）。「非公開でテストのためにexportしない」と読める記述が残っていないか。
* 洗い出しは `git diff --name-status 6efcbad 33a5ca3 -- js index.html test` と、B.の差分の `-` 行で行い、**現在の実コードの事実**（その名前がどこにあるか・どこから呼ばれるか）を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）を検索する。
* 差分のない行については、名前の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。

#### E. 結果の書き方（各タスク共通）
* 実コードから読み取れる事実のみを抽出し、4章の自分のタスクの欄の『事実（実コードの記述）』に書く。推測を含める場合はどこまでが事実でどこからが推測かを明示し、推測は『推測・所見』に書く。
* 照合した主張と結果を、**資料のファイル（節）ごと**に『事実』へまとめる。1つの主張につき「（資料のファイル:行）主張の要点 → 一致（確かめたコードの `ファイル:行`、または検索した語と件数）」の形で短く書く。一致したものは「一致」と短く書けばよい。主張の要点は自分の言葉で短く書き、資料の文を長く写さない。
* 相違の判定は、**資料の原文とコードの該当行を両方開いて行う**（記憶・要約・Phase 8 のRESの記述だけで一致と判定しない）。一致と書く主張には必ず確かめたコードの場所を添える。
* 資料の記述と実コードに相違があった場合は、5章に「**（タスク番号）（対象：資料のファイルと節（行））**：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で追記する（作業は中断しない）。5章の「（資料の記述）」は、相違の箇所を特定できる最小限の引用にとどめる。
* 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものは、5章に入れず、4章の自分のタスクの『推測・所見』に「**読み方が分かれる記述**：（資料のファイル:行）要点・読み方の候補」の形で書く。
* 照合できなかった主張は、4章の自分のタスクの『推測・所見』に「**照合できなかった主張**：（資料のファイル:行）要点・理由」の形で書く。
* 4章の自分のタスクの『調査内容』には、実行したコマンド（`git diff -U0 …`・`wc -l`・`node --test`・検索した語）と、開いたコードのファイルを書く。
* タスクの終わりに、ソースコードおよび資料ファイルを一切変更していないことを `git status` で確認し、その結果（変更があるのは本RESファイルだけであること）を『調査内容』の末尾に1行で書く。そのうえで3章の自分のタスクを `[x]` にする。
* 4章・5章への書き込みは、自分のタスクの欄と5章の末尾への追記だけにする（他のタスクの欄を書き換えない）。

#### F. 既知の傷3件（現場設計セッションが把握している。確認漏れと区別するため、担当のタスクで確かめて5章へ必ず挙げる）
1. `_doc/arch/32_InputModes.md` のテストの列挙に `test/core/VertexHandleRules.test.js` が無い（Phase 08-02a 由来の書き漏れ）。→ 担当：タスク15。
2. `_doc/arch/02_main.md` の行数の行は、全角括弧の開閉が1つ合っていない（Phase 08-03 の着手前から）。→ 担当：タスク10。
3. `js/edit/ShapeExtentReader.js` のクラスJSDocに「main.jsが1つだけ生成する」と残っているが、実際は `js/wiring/DisplayWiring.js` の内部と `js/main.js` の2か所で生成している（`_doc/arch/14_edit.md` は2か所と正しく書いている）。**これはコードのコメントの側の食い違い**であり、5章に「資料は正しく、コードのJSDocが古い」と分かる形で書く。→ 担当：タスク8。

## 3. タスクリスト
各タスクは互いに独立に実行できる（前のタスクの調査結果を読まなくてよい）。各タスクは「参照する責務」A.〜F.に従う。ハンクの見出しはいずれも `git diff -U0 6efcbad 33a5ca3 -- <ファイル>` の `+c,d`（現在のファイルでの開始行,行数）。括弧内の字数は計画立案時に測った `+` 行のバイト数の目安。

* [x] タスク1: `PROJECT_ARCHITECTURE.md` 1章のフォルダ構成図・「存在しないもの」と、4章の一覧（約1.5万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 1章「1. プロジェクトフォルダ構造」のフォルダ構成図（17〜190行。ハンク `+20` `+29,4` `+34` `+36` `+40,3` `+44` `+48,2` `+71,2` `+76,3` `+89,6` `+109,2` `+113` `+116,2` `+119` `+121` `+125` `+132` `+135,3` `+164,3` `+172,2`）：（照合）
    * 同 1章「**存在しないもの**」（192行。ハンク `+192`）：（照合）
    * 同 4章「4. 各モジュールの責務リファレンス」の表（648〜657行。ハンク `+648,10`）：（照合）
    * 照合に使うコード：`./index.html`・`./js/`・`./test/`・`./asset/sprite/` のファイルの一覧（`git ls-files`）と各 `.js` の先頭の責務のJSDoc、`./_doc/arch/` のファイル名の一覧（`ls`。中身は読まない）：（監査）
  * **調査内容**:
    * 構成図の `+` 行の各ファイル・フォルダが実在し、その位置（フォルダ）にあることを確かめる。構成図のコメントに書かれた責務・状態の有無・使う側（「wiring/DisplayWiringが使う」等）を、そのファイルの先頭のJSDoc・import・呼び出し元の検索で確かめる。
    * 「存在しないもの」の `+` 行に書かれた、Phase 8 の各サブフェイズで入れなかったもの・まだ無いもの（「Phase 08-05で入った」等の後のサブフェイズで入ったと注記したものを含む）が、コードに無いこと・注記どおり入ったことを `Grep` で確かめる。
    * 4章の表の10行について、モジュールのファイルと `_doc/arch/` のファイルの両方が実在することを確かめる。

* [x] タスク2: `PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」と依存方向（約1.6万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 1章「**フォルダ分割の方針**」の `core/`（195行。ハンク `+195`）・`edit/` と `wiring/`（199〜200行。ハンク `+199,2`）・「依存方向」（202行。ハンク `+202`）：（照合）
    * 照合に使うコード：`./js/` 配下の全 `.js` の `import` 文（`Grep` で `^import` を `js/` 配下に対して検索）、`./js/core/`・`./js/edit/`・`./js/wiring/`・`./js/main.js`：（監査）
  * **調査内容**:
    * `core/`・`edit/`・`wiring/` の各行に書かれた、フォルダに置くもの・置かないもの・状態の有無・DOMへの依存の有無・属するファイルの列挙を、実在のファイルと各ファイルの先頭のJSDoc・importで確かめる。
    * 「依存方向」の一方向の規則と、その例外として書かれたもの（とくに`edit/`から`core/`をimportする3クラス、`main.js`から`wiring/`への依存、`wiring/`が何をimportするか）を、import文の検索で1件ずつ確かめる。例外として書かれていない逆向きのimportが実在しないかも、import文の一覧から確かめる（実在すれば、資料が「一方向」と書いている範囲と照らして相違かを判定する）。

* [ ] タスク3: `PROJECT_ARCHITECTURE.md` 2章と、3章の冒頭・1.〜6.（約2.1万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 2章「2. データ構造（Model）の概要」（206〜312行。ハンク `+209` `+225` `+282` `+293` `+299,2`）：（照合）
    * 同 3章「3. 描画・操作フロー（実行サイクル）」の冒頭「同期の経路（全機能共通）」（314行。ハンク `+314`）と、1.「起動処理」〜6.「履歴（取り消し・やり直し）」（316〜372行。ハンク `+324` `+326,2` `+329` `+332` `+348` `+353` `+357,5` `+368` `+370`）：（照合）
    * 照合に使うコード：`./js/core/VectorModel.js`・`./js/core/HistoryManager.js`・`./js/core/InputTracker.js`（該当の枝のみ `Grep` で絞る）・`./js/core/KeyboardShortcuts.js`・`./js/core/FocusKeyYieldRules.js`・`./js/core/PointHitRules.js`・`./js/edit/SnapshotAdapter.js`・`./js/edit/NudgeEditor.js`・`./js/edit/ShapeAlignEditor.js`・`./js/io/DocumentSerializer.js`・`./js/wiring/ToolIconWiring.js`・`./js/main.js`：（監査）
  * **調査内容**:
    * 2章：スタイルの読み書き、保存対象・保存しないもの（頂点の選択を作業データ・履歴・保存先に入れていないこと）、本アプリ自身のツールのアイコン、選択集合と頂点の選択の不変条件・持ち主を、`VectorModel`・`DocumentSerializer`・`SnapshotAdapter`・`ToolIconWiring` で確かめる。
    * 3章冒頭・3.：同期の経路（`model.onChange` 等だけで表示が追従すること）、当たり分類・範囲選択の流れ・クリックの解釈・頂点のハンドルのドラッグ・キーボード操作（`keydown`の受け渡し、入力欄の判定）を、`InputTracker`・`PointHitRules`・`KeyboardShortcuts`・`FocusKeyYieldRules`・`main.js` で確かめる。
    * 3章6.：記録する操作と時点（矢印キーでの微調整・整列・分布）、まとめの鍵の畳む条件・往復で消える条件・鍵を忘れる契機・通知、取り消し・やり直しの手順（ドラッグ中の不受理・`shouldRestoreSelection`の実体）、適用後の選択集合を、`HistoryManager`・`NudgeEditor`・`ShapeAlignEditor`・`SnapshotAdapter`・`main.js` で確かめる。とくに 08-04 の`nudgeWithoutGrouping`・08-05 の整列・分布の追加後も、まとめの鍵を渡す経路と渡さない経路の記述が成り立つかを見る。

* [ ] タスク4: `PROJECT_ARCHITECTURE.md` 3章 7.〜17. への追記（約1.7万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章 7.「コピー・貼り付け・複製」〜17.「スナップ」（373〜539行。差分のハンクは12.〜17.にのみある：ハンク `+444` `+470,2` `+482,2` `+489,3` `+506,2` `+511` `+517` `+519` `+525` `+528` `+530` `+532,2`）：（照合）
    * 照合に使うコード：`./js/core/InputTracker.js`（端点のハンドルのドラッグ・修飾キー・スナップの枝のみ `Grep` で絞る）・`./js/edit/EndpointSnapper.js`・`./js/edit/StyleEyedropper.js`・`./js/core/DisplayState.js`・`./js/core/UnitSnapRules.js`・`./js/core/UnitSnapSettings.js`・`./js/palette/`（`OptionBarStyleGroup.js`・`OptionBarOrderGroup.js`・`OptionBarPositionGroup.js`・`OptionBarAlignGroup.js`・`ViewToggleGroup.js`・`UnitSnapGroup.js`・`PaletteLauncher.js`）・`./js/wiring/DisplayWiring.js`・`./js/main.js`・`./index.html`：（監査）
  * **調査内容**:
    * 12.の端点のハンドルのドラッグの流れ（頂点の選択モードでのまとめ移動の追加後も、`resolveDragEndpoint`の呼び出しの条件の記述が成り立つか）を確かめる。
    * 13.のオプションバーのまとまりの分け方（`.toolbar-group`）・やらないこと（位置の欄の扱い）を、08-04・08-05 で増えた位置・整列・分布のまとまりと照らして確かめる。
    * 15.の表示の状態の持ち主と通知、パレットをまとめて隠す、全体を画面に収める（`wiring/DisplayWiring`への移動後の経路）、`aria-pressed`を付けない記述を確かめる。
    * 16.の修飾キーを見る時点・発注者の決定（振る舞いとして確かめられる範囲）・スポイトの待ち受けの持ち主を確かめる。
    * 17.の規則とモジュールの分担・丸めないもの・`Ctrl`を見る時点（`hasCtrlModifier`のexport）・設定の持ち主と同期の経路・ステータスバーの部品・座標の表示（`DisplayWiring`の`#syncCursorReadout`）を確かめる。

* [ ] タスク5: `PROJECT_ARCHITECTURE.md` 3章18.（頂点の選択）と `_doc/arch/38_VertexHandleRules.md`（約2.5万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章18.「頂点の選択（ツールの分割・頂点のハンドルの表示と操作）」（540〜565行。ハンク `+540,69` のうち540〜565行。前半（08-02a）は540〜559行、後半（08-02b）は560〜564行）：（照合）
    * `./_doc/arch/38_VertexHandleRules.md`（新設。1〜12行。ハンク `+1,12`）：（照合）
    * 照合に使うコード：`./js/core/VertexHandleRules.js`・`./js/core/InputModes.js`・`./js/core/ToolRules.js`・`./js/core/PressActionRules.js`・`./js/core/SelectionRules.js`・`./js/core/CursorShapeRules.js`・`./js/core/InputTracker.js`（頂点の選択のモードの枝のみ `Grep` で絞る）・`./js/core/VectorModel.js`（頂点の選択・`updateVertices`）・`./js/core/CanvasManager.js`（`render`の頂点のハンドルの段）・`./js/core/KeyboardShortcuts.js`（`A`）・`./js/wiring/ToolIconWiring.js`・`./js/main.js`：（監査）
  * **調査内容**:
    * 18.の各小項（ツール・操作モードの一覧、選択（`V`）の変更、頂点の選択モードのクリック・押下・まとめ移動・範囲選択・`Esc`・`Delete`／`Backspace`・ホバー・カーソル、モジュールの分担、頂点のハンドルの表示、`drawHandles`が呼ばれなくなること、履歴・保存、ツールのアイコン、発注者の決定・やらないこと・注意（振る舞いとして確かめられる範囲）、後半の要点・前半の記述の訂正）を、該当のコードで1つずつ確かめる。テストプレイの結果は「照合できなかった主張」として扱い、自動テストの件数の記述があれば C.13 の方法で確かめる。
    * `38_VertexHandleRules.md`：公開の関数の一覧と引数・戻り値（`collectVertexHandles`・`collectVertexHandlesInRect`・`isVertexHandle`・`computeVertexHandlesBounds` 等）、import、使う側を `VertexHandleRules.js` と呼び出し元の検索で確かめる。
    * 重点：08-02a の記述が、08-02b の複数選択・まとめ移動と 08-05 の`computeVertexHandlesBounds`の追加後も成り立つか。08-02b の`updateVertices`の記述（通知1回）が、08-03 の矢印キーでの微調整の経路の追加後も成り立つか。

* [ ] タスク6: `PROJECT_ARCHITECTURE.md` 3章19.（矢印キーでの微調整）と `_doc/arch/07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`41_NudgeTargetRules.md`（約1.9万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章19.「矢印キーでの微調整（ナッジ）」（566〜577行。ハンク `+540,69` のうち566〜577行）：（照合）
    * `./_doc/arch/07_KeyboardShortcuts.md`（ハンク `+3` `+11,3`）：（照合）
    * `./_doc/arch/08_HistoryManager.md`（ハンク `+3,6` `+11,2`）：（照合）
    * `./_doc/arch/41_NudgeTargetRules.md`（新設。1〜9行。ハンク `+1,9`）：（照合）
    * 照合に使うコード：`./js/core/KeyboardShortcuts.js`・`./js/core/HistoryManager.js`・`./js/core/NudgeTargetRules.js`・`./js/edit/NudgeEditor.js`・`./js/core/FocusKeyYieldRules.js`・`./js/core/VectorModel.js`（`moveShapes`・`updateVertices`）・`./js/main.js`（`// 7.9.` の配線と`KeyboardShortcuts`の生成）：（監査）
  * **調査内容**:
    * 19.：流れ、モジュールの分担（動く量 1px・`Shift`で10px の持ち主）、対象の決め方、対象がないときは受理しない（戻り値と`preventDefault`）、まとめの区切り（鍵の作り方と畳む条件）、スナップ・端点への吸い付きと無関係、キーリピート、キーの受理（`ctrl: false`のエントリのみ）、発注者の決定・やらないこと（振る舞いとして確かめられる範囲）を確かめる。確認の状況のうち自動テストの記述は C.13 の方法で確かめる。
    * `07_KeyboardShortcuts.md`：`A`のエントリ、矢印キー8エントリ・`Shift`の分かれ方・キーリピート・入力欄にフォーカスがある間の扱い・`Ctrl`／`Alt`付きの矢印が一致しないこと、知らないことを、対応表とimportで確かめる。
    * `08_HistoryManager.md`：まとめの鍵（畳む条件・往復で消える・鍵を忘れる契機・通知と戻り値）、呼び出し元（`beginEdit`/`commitEdit`を呼ぶクラスの一覧。08-04 の`PositionInputEditor`経由・08-05 の`ShapeAlignEditor`を含めて今も成り立つか）、変更通知、履歴の上限、テストの記述を確かめる。
    * `41_NudgeTargetRules.md`：`resolveNudgeTarget`・`buildNudgeGroupKey` の引数・戻り値・import・使う側（08-04 で`PositionInputEditor`が使い始めた後も「使う側」の記述が成り立つか）を確かめる。

* [ ] タスク7: `PROJECT_ARCHITECTURE.md` 3章20.（位置の数値入力）と `_doc/arch/13_palette.md`（約2.0万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章20.「位置の数値入力」（578〜592行。ハンク `+540,69` のうち578〜592行）：（照合）
    * `./_doc/arch/13_palette.md`（ハンク `+1` `+5,2` `+20` `+25` `+27` `+35,16`）：（照合）
    * 照合に使うコード：`./js/palette/` 配下（とくに`OptionBarPositionGroup.js`・`OptionBarAlignGroup.js`・`ToolPalette.js`・`UnitSnapGroup.js`・`ViewToggleGroup.js`）・`./js/edit/PositionInputRules.js`・`./js/edit/PositionInputEditor.js`・`./js/edit/NudgeEditor.js`（`nudgeWithoutGrouping`）・`./js/edit/ShapeExtentReader.js`・`./js/core/StatusReadoutRules.js`（`formatReadoutNumber`）・`./js/core/FocusKeyYieldRules.js`・`./js/main.js`（`// 7.10.` の配線）・`./index.html`（`#option-position-group`）：（監査）
  * **調査内容**:
    * 20.：流れ（表示・入力）、モジュールの分担、位置の定義（外枠の左上・線の太さを含める・頂点のとき）、数字の形と丸め（小数第1位）、確定の契機（`change`だけ。`input`を購読しない）、確定1回が取り消し1件、欄を押せない見た目になる条件、キーとの関係（`FocusKeyYieldRules`の判定）、ドラッグ中は拒まない、発注者の決定・やらないこと（振る舞いとして確かめられる範囲。位置の欄にスナップを働かせない 等）を確かめる。確認の状況のうち自動テストの記述は C.13 の方法で確かめる。
    * `13_palette.md`：palette/ 全体の位置づけ（DOM操作専任・importの範囲）、ツールパレットの契約とアイコンの`<canvas>`との関係、各まとまりの注入・表示の規則、`OptionBarPositionGroup`・`OptionBarAlignGroup` の公開メソッド・注入・表示の規則・知らないこと（importを持たないこと）・二重定義のtypedef（相手側のファイルに同じtypedefが実在し、内容が一致すること）・テスト対象外を確かめる。
    * 重点：08-04 で書いた記述が、08-05 の整列・分布のまとまりの追加後も成り立つか（オプションバーのまとまりの数・並び、`ShapeExtentReader`の使い方）。

* [ ] タスク8: `PROJECT_ARCHITECTURE.md` 3章21.（整列・分布）と `_doc/arch/14_edit.md`（約2.7万バイト）
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` 3章21.「整列・分布」（593〜608行。ハンク `+540,69` のうち593〜608行）：（照合）
    * `./_doc/arch/14_edit.md`（ハンク `+3,2` `+6` `+9,23` `+63,13`）：（照合）
    * 照合に使うコード：`./js/edit/` 配下（とくに`ShapeAlignRules.js`・`ShapeAlignEditor.js`・`ShapeExtentReader.js`・`NudgeEditor.js`・`PositionInputRules.js`・`PositionInputEditor.js`・`ShapeInserter.js`・`ClipboardController.js`・`CanvasFileOperations.js`）・`./js/io/SpriteSerializer.js`（`computeShapesBounds`）・`./js/core/VectorModel.js`（`moveShapesBy`）・`./js/palette/OptionBarAlignGroup.js`・`./js/wiring/DisplayWiring.js`（`ShapeExtentReader`の生成）・`./js/main.js`（`// 7.11.` の配線・`performShapeAlign`）：（監査）
  * **調査内容**:
    * 21.：流れ（表示・入力）、モジュールの分担、整列の基準（各図形の外枠の和）、外枠に線の太さを含める（外枠の求め方の正本）、分布は外枠どうしのすき間をそろえる（並べ方・安定ソート）、押せない条件（図形の数・1pxも動かない判定の許容量）、操作1回＝取り消し1件（まとめの鍵を渡さない）、スナップ等と無関係、ドラッグ中は受理しない、操作モードを見ない、キーを割り当てない、発注者の決定・やらないこと（振る舞いとして確かめられる範囲）を確かめる。確認の状況のうち自動テストの記述は C.13 の方法で確かめる。
    * `14_edit.md`：edit/ 全体の位置づけ・依存（importの範囲と例外）、`ShapeExtentReader`の公開メソッド（`getSelectedBounds`と図形1つずつの外枠の照会）と生成箇所（2か所）、`NudgeEditor`（`nudge`／`nudgeWithoutGrouping`の契約・依存・移動量・知らないこと・呼び出し側の責務）、`PositionInputRules`（`POSITION_AXIS`・`buildPositionInputView`・`resolvePositionDelta`・import・二重定義・使う側）、`PositionInputEditor`、`ShapeAlignRules`（`ShapeAlignOperation`の8操作の値・規則の2つの関数・importなし・契約・二重定義・使う側）、`ShapeAlignEditor`（公開メソッド・依存・契約・二重定義）、各テストの記述を確かめる。
    * 既知の傷3（「参照する責務」F.3）：`js/edit/ShapeExtentReader.js` のクラスJSDocと、`ShapeExtentReader`を`new`している箇所（`Grep`で `new ShapeExtentReader` を `js/` 配下に対して検索）を確かめ、5章に「資料は正しく、コードのJSDocが古い」と分かる形で書く。

* [ ] タスク9: `_doc/arch/01_index_html.md`・`37_SpriteFitRules.md`・`39_ToolIconWiring.md`・`40_asset_sprite.md`（約2.4万バイト）
  * **対象ファイル**:
    * `./_doc/arch/01_index_html.md`（ハンク `+3,4` `+8` `+10` `+12` `+15`）：（照合）
    * `./_doc/arch/37_SpriteFitRules.md`（新設。1〜8行。ハンク `+1,8`）：（照合）
    * `./_doc/arch/39_ToolIconWiring.md`（新設。1〜9行。ハンク `+1,9`）：（照合）
    * `./_doc/arch/40_asset_sprite.md`（新設。1〜6行。ハンク `+1,6`）：（照合）
    * 照合に使うコード：`./index.html`（要素・属性・クラス・CSS変数・`<style>`）・`./js/core/SpriteFitRules.js`・`./js/wiring/ToolIconWiring.js`・`./asset/sprite/select-arrow.js`・`./asset/sprite/vertex-arrow.js`・`./js/palette/ToolPalette.js`（ボタンのid規則）・`./js/main.js`（`ToolIconWiring`の生成のみ）：（監査）
  * **調査内容**:
    * `01_index_html.md`：ツールバー・ステータスバー、ボタンの見た目（`.tool-btn`・`.icon-btn`）、表示の切り替えのボタンの押し込み、スナップのまとまり、フロートウィンドウをまとめて隠すCSS、ショートカットの表記（各ボタンの`title`）、ツールパレット、オプションバー（位置のまとまり・整列・分布のまとまりの要素のid、`type="number"`の`step`・`min`・`max`の有無、`disabled`の初期値、`.toolbar-group`・`.option-unit`、幅の見積もりのコメント）を `index.html` で確かめる。1280px幅での見え方・記号の字形等は C.の「照合できなかった主張」として扱い、CSSの値・要素の並びで確かめられる範囲だけを照合する。
    * `37_SpriteFitRules.md`：公開の関数（`computeSpriteFitTransform` 等）の引数・戻り値・import・使う側を確かめる。
    * `39_ToolIconWiring.md`：公開メソッド・注入・importの範囲・アイコンを描く先・使う側（`main.js`）を確かめる。
    * `40_asset_sprite.md`：`asset/sprite/` のファイルの存在・書き出し形式のスプライトJSであること（エクスポートの形）・読み込む側を確かめる。キャッシュの挙動・本リポジトリの外の記述は「照合できなかった主張」として扱う。

* [ ] タスク10: `_doc/arch/02_main.md` と `36_DisplayWiring.md`（約2.6万バイト）
  * **対象ファイル**:
    * `./_doc/arch/02_main.md`（ハンク `+3,2` `+16,2` `+22,4` `+32` `+40` `+48,5` `+54,3` `+61` `+64,3` `+68,3`）：（照合）
    * `./_doc/arch/36_DisplayWiring.md`（新設。1〜10行。ハンク `+1,10`）：（照合）
    * 照合に使うコード：`./js/main.js`（配線ブロックのコメント `// 6.5.`〜`// 8.` を `Grep` で位置を得てから読む）・`./js/wiring/DisplayWiring.js`・`./js/edit/ShapeExtentReader.js`（生成箇所の確認のみ）：（監査）
  * **調査内容**:
    * `02_main.md`：行数（現在の値と、「Phase 08-05で944行から増えた」のような過去の時点の値。過去の値は `git show <完了のコミット>:js/main.js | wc -l` で確かめる）、主な関数の一覧、配線ブロックの表（`// 6.5.`〜`// 7.11.`・`// 8.` の各行の内容が、`main.js`の該当ブロックに実在するか）、注入の表（各クラスへ渡している引数の名前と実体）、生成順の制約、同一経路の原則、スナップの配線、押せる/押せない状態、操作モード・図形種別の切替、起動時の同期、同期関数と購読先を確かめる。
    * 重点：08-01 で書いた配線（`wiring/DisplayWiring`への切り出し）の記述が、08-02a〜08-05 で配線ブロックが増えた後も成り立つか。
    * `36_DisplayWiring.md`：公開メソッド・注入・内部で生成するもの（`ShapeExtentReader` 等）・同期関数と購読先・import・`main.js`との分担を `DisplayWiring.js` で確かめる。
    * 既知の傷2（「参照する責務」F.2）：`02_main.md` の行数の行の全角括弧（`（`・`）`）の数を数え、開閉が合っていないことを確かめて5章に挙げる。

* [ ] タスク11: `_doc/arch/06_InputTracker.md`（約2.2万バイト）
  * **対象ファイル**:
    * `./_doc/arch/06_InputTracker.md`（ハンク `+1` `+3,3` `+7` `+12,16` `+31` `+35` `+38` `+40`）：（照合）
    * 照合に使うコード：`./js/core/InputTracker.js`（1579行と大きいので、`Grep`でメソッド名・`export`・`import`の位置を得てから offset/limit で読む）・`./js/core/InputModes.js`・`./js/core/FocusKeyYieldRules.js`・`./js/core/PressActionRules.js`・`./js/core/CursorShapeRules.js`・`./js/core/PointHitRules.js`・`./js/core/SelectionRules.js`・`./js/core/VertexHandleRules.js`・`./js/main.js`（`InputTracker`の生成のみ）：（監査）
  * **調査内容**:
    * 役割の行、モジュールのexport（`WHEEL_ZOOM_STEP`・`hasCtrlModifier` 等。`SHAPE_TYPES`を再exportしていないこと）、`InputState`・`OperationMode`の定義とimport元、スペースパンの入力欄の規則、状態（入力状態の値の一覧）、当たり分類の使い方、押下時の分岐・カーソルの形の規則への委譲、頂点の選択モードの分岐（`#classifyPoint`・`handleMouseMove`・`handleMouseDown`・`handleClick`・`cancelDraftOrClearSelection`・変えていないもの）、頂点のまとめ移動（`#vertexDragOrigins`・追従・端点の解決・`#commitMarquee`・`#applyVertexSelectionChange`）、修飾キー、スナップ、行数（現在の値と過去の時点の値。過去の値は `git show <完了のコミット>:js/core/InputTracker.js | wc -l`）、コンストラクタの引数を確かめる。
    * 重点：08-01 で書いた記述（行数・切り出した4つの規則への委譲）が、08-02a・08-02b で頂点の枝が増えた後も成り立つか。08-02b のまとめ移動の記述が、08-03 以降の変更後も成り立つか。

* [ ] タスク12: `_doc/arch/16_test.md` の前半（書き方の決まり・既存の列挙の修正と、Phase 08-01〜08-02b の分）（約1.6万バイト）
  * **対象ファイル**:
    * `./_doc/arch/16_test.md`（ハンク `+10` `+29` `+51` `+55` `+68`、およびハンク `+70,46` のうち70〜91行（Phase 08-01・08-02a・08-02b の新設・追加分、書き換えた既存のテスト、テストできない箇所、件数））：（照合）
    * 照合に使うコード：`./test/core/PressActionRules.test.js`・`CursorShapeRules.test.js`・`SpriteFitRules.test.js`・`VertexHandleRules.test.js`・`VectorModel.selectedVertices.test.js`・`VectorModel.updateVertices.test.js`・`SelectionRules.test.js`・`ToolRules.test.js`・`PointHitRules.test.js`、`./test/shapes/` の5図形のテスト、および「テストできない箇所」に挙がった `./js/` のファイル（該当箇所のみ）：（監査）
  * **調査内容**:
    * 10行（偽物と実物の使い分けの例外の列挙）、29行（`ToolRules.test.js`の`TOOL_IDS`の並び）、51行・68行（テストできない箇所）、55行（`SelectionRules.test.js`の件数と内容）を、該当のテストファイルとコードで確かめる。
    * 70〜91行：各テストファイルの存在、内容の記述（何を対象に何を確かめているか）が実際のテストケースと合っているか、件数（現在の値として書かれたものは `node --test <テストファイル>` で、「Phase 08-0x完了時」の値は C.13 の方法で）、書き換えた既存のテスト、テストできない箇所（挙がった箇所が実際に自動テストの無い・DOMに依存する箇所か）を確かめる。
    * 重点：08-02a・08-02b で書いたファイルごとの件数（「計N件」）が、後のサブフェイズ（08-03〜08-05）で同じファイルへテストが足された後も、過去の時点の値として読める書き方か、現在の値として読める書き方か（現在の値として読めるのに今の件数と違えば相違）。

* [ ] タスク13: `_doc/arch/16_test.md` の後半（Phase 08-03〜08-05 の分と、既存の「テストできない箇所」の修正）（約1.4万バイト）
  * **対象ファイル**:
    * `./_doc/arch/16_test.md`（ハンク `+70,46` のうち92〜115行（Phase 08-03・08-04・08-05 の新設・追加分、書き換えた既存のテスト、テストできない箇所、件数）、およびハンク `+119` `+121` `+124`）：（照合）
    * 照合に使うコード：`./test/core/NudgeTargetRules.test.js`・`HistoryManager.test.js`・`KeyboardShortcuts.test.js`・`VertexHandleRules.test.js`・`VectorModel.moveShapesBy.test.js`、`./test/edit/NudgeEditor.test.js`・`PositionInputRules.test.js`・`PositionInputEditor.test.js`・`ShapeAlignRules.test.js`・`ShapeAlignEditor.test.js`・`ShapeExtentReader.test.js`、および「テストできない箇所」に挙がった `./js/` のファイル（該当箇所のみ）：（監査）
  * **調査内容**:
    * 92〜115行：各テストファイルの存在、内容の記述、件数（現在の値は `node --test <テストファイル>`、過去の時点の値は C.13 の方法）、書き換えた既存のテスト、テストできない箇所を確かめる。
    * 「件数（Phase 08-05完了時）」の行は、`33a5ca3` 以後コードが変わっていないため現在の値と同じはずである。プロジェクトのルートで `node --test`（全体）を実行し、出力の `# tests`・`# pass`・`# fail` の値と並べて記載する。
    * 119・121・124行（既存の「テストできない箇所」（07-01・06-02・07-02 の追加）の Phase 8 での修正）を、該当のコード（`FocusKeyYieldRules.js` の`isSpaceYieldedElement`等）で確かめる。

* [ ] タスク14: `_doc/arch/03_VectorModel.md`・`04_CanvasManager.md`・`05_ViewTransform.md`・`10_ShapeFactory.md`・`12_shapes.md`（約1.6万バイト）
  * **対象ファイル**:
    * `./_doc/arch/03_VectorModel.md`（ハンク `+1,2` `+4,4`）：（照合）
    * `./_doc/arch/04_CanvasManager.md`（ハンク `+2` `+4,2`）：（照合）
    * `./_doc/arch/05_ViewTransform.md`（ハンク `+3`）：（照合）
    * `./_doc/arch/10_ShapeFactory.md`（ハンク `+3` `+6,2`）：（照合）
    * `./_doc/arch/12_shapes.md`（ハンク `+20,2` `+28` `+31` `+35` `+51,3` `+57` `+65`）：（照合）
    * 照合に使うコード：`./js/core/VectorModel.js`・`./js/core/CanvasManager.js`・`./js/core/ViewTransform.js`・`./js/core/ShapeFactory.js`・`./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`・`Path.js`、呼び出し元の確認に `./js/core/InputTracker.js`・`./js/edit/NudgeEditor.js`・`./js/edit/ShapeAlignEditor.js`（`Grep` のみ）：（監査）
  * **調査内容**:
    * `03_VectorModel.md`：役割の行、公開メソッドの一覧、頂点の選択（非公開のフィールド・不変条件・通知の回数）、頂点の更新（`updateVertex`と`updateVertices`の関係・通知1回）、`moveShapes`の呼び出し元（08-03 で書いた一覧が、08-05 の`moveShapesBy`の追加後も成り立つか）、`moveShapesBy`の引数・通知を確かめる。
    * `04_CanvasManager.md`：`render`の引数、描画順（頂点のハンドルの段・`showHandles`の段）、配色の組を確かめる。
    * `05_ViewTransform.md`：契約の行を確かめる。
    * `10_ShapeFactory.md`：対応表と種別一覧、依存の制約、図形種別の追加手順（18メソッド）を確かめる。
    * `12_shapes.md`：18メソッド契約の一覧と`getVertexHandleNames`（第18メソッド）、5図形がいずれも18メソッドを持つこと、各図形の`getVertexHandleNames`が返す名前、`hitTestHandle`の戻り値、各図形の頂点の並びを確かめる。

* [ ] タスク15: `_doc/arch/32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`・`35_CursorShapeRules.md`（約1.7万バイト）
  * **対象ファイル**:
    * `./_doc/arch/32_InputModes.md`（新設。1〜8行。ハンク `+1,8`）：（照合）
    * `./_doc/arch/33_FocusKeyYieldRules.md`（新設。1〜7行。ハンク `+1,7`）：（照合）
    * `./_doc/arch/34_PressActionRules.md`（新設。1〜28行。ハンク `+1,28`）：（照合）
    * `./_doc/arch/35_CursorShapeRules.md`（新設。1〜8行。ハンク `+1,8`）：（照合）
    * 照合に使うコード：`./js/core/InputModes.js`・`./js/core/FocusKeyYieldRules.js`・`./js/core/PressActionRules.js`・`./js/core/CursorShapeRules.js`、使う側の確認に `./js/core/InputTracker.js`・`./js/core/KeyboardShortcuts.js`・`./js/main.js`・`./js/palette/`（`Grep` のみ）、テストの列挙の確認に `./test/` のファイルの一覧：（監査）
  * **調査内容**:
    * 各ファイルの公開の定数・関数の一覧と値（`OperationMode`・`InputState`の値、押下の判定表の行と戻り値、カーソルの形の判定の枝、`isTextInputElement`・`isSpaceOperatedInputElement`・`isSpaceYieldedElement`の判定）、import、使う側（`Grep`で import している箇所を `js/` 配下に対して検索）、テストの列挙（実在するテストファイルとの対応）を確かめる。
    * 重点：08-01 で書いた記述が、08-02a・08-02b で頂点の選択モードの枝（`PressActionRules`の頂点の判定表・`CursorShapeRules`の頂点の枝）が足された後も成り立つか。
    * 既知の傷1（「参照する責務」F.1）：`32_InputModes.md` のテストの列挙と、`InputModes.js` を import しているテストファイル（`Grep`で `InputModes` を `test/` 配下に対して検索）を比べ、`test/core/VertexHandleRules.test.js` が列挙に無いことを確かめて5章に挙げる。

* [ ] タスク16: 既存の `_doc/arch/18`〜`31` の小さな修正（約1.4万バイト）
  * **対象ファイル**:
    * `./_doc/arch/18_PointHitRules.md`（ハンク `+1,2` `+4` `+8`）：（照合）
    * `./_doc/arch/19_ToolRules.md`（ハンク `+1,5` `+8`）：（照合）
    * `./_doc/arch/20_DisplayState.md`（ハンク `+5`）・`21_GridSpacingRules.md`（ハンク `+5` `+7`）・`24_CanvasCursorTracker.md`（ハンク `+6`）・`25_ViewFitRules.md`（ハンク `+5`）：（照合）
    * `./_doc/arch/26_StatusReadoutRules.md`（ハンク `+1` `+4` `+6`）・`27_SelectionRules.md`（ハンク `+1,2` `+4` `+6` `+9`）：（照合）
    * `./_doc/arch/29_AltKeyGuard.md`（ハンク `+4`）・`30_UnitSnapRules.md`（ハンク `+11`）・`31_UnitSnapSettings.md`（ハンク `+6`）：（照合）
    * 照合に使うコード：`./js/core/PointHitRules.js`・`ToolRules.js`・`DisplayState.js`・`GridSpacingRules.js`・`CanvasCursorTracker.js`・`ViewFitRules.js`・`StatusReadoutRules.js`・`SelectionRules.js`・`AltKeyGuard.js`・`UnitSnapRules.js`・`UnitSnapSettings.js`、使う側の確認に `./js/` 配下の import の検索（`Grep` のみ）：（監査）
  * **調査内容**:
    * 各 `+` 行の主張（役割、公開の定数・関数と値（`TOOL_IDS`の並び、`classifyPointHit`の引数（`includeHandles`）、`SelectionRules`の頂点用の関数と`VertexSelectionChange`、`formatReadoutNumber`の数字の形 等）、import、使う側（08-01 で`main.js`から`wiring/DisplayWiring`へ移った後の使う側、08-04 で`PositionInputRules`が`formatReadoutNumber`を使い始めた後の使う側 等）、テストの列挙）を、該当のコードと import の検索で確かめる。

* [ ] タスク17: 要件2：Phase 8 で移った・到達不能になった・公開の形が変わったものの残りの検索
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` の全体と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）：（検索）
    * 照合に使うコード：`./js/core/InputTracker.js`・`InputModes.js`・`FocusKeyYieldRules.js`・`PressActionRules.js`・`CursorShapeRules.js`・`CanvasManager.js`・`VectorModel.js`・`./js/shapes/` の5図形・`./js/main.js`・`./js/wiring/DisplayWiring.js`・`./js/wiring/ToolIconWiring.js`（名前の所在と呼び出し元の確認のみ）：（監査）
  * **調査内容**:
    * 「参照する責務」D.に従う。まず `git diff --name-status 6efcbad 33a5ca3 -- js index.html test` と、`git diff 6efcbad 33a5ca3 -- PROJECT_ARCHITECTURE.md _doc/arch` の `-` 行（`Grep`等で `^-` の行だけを抜き出して読む）から、移った・到達不能になった・公開の形が変わった名前を洗い出す。
    * D.の4種の名前（`InputState`・`OperationMode`・`SHAPE_TYPES`・`isTextInputElement`・`isSpaceOperatedInputElement`・`isSpaceYieldedElement`・`resolvePressAction`・`dragHandle`・`resolveCursorShape`・`DisplayWiring`・`ToolIconWiring`・`drawHandles`・`showHandles`・`updateVertex`（`updateVertices`と区別する）、および `-` 行から得た名前）について、現在のコードでの所在（定義のファイル・export の有無・呼び出し元）を `Grep` で確かめる。
    * それらの名前と、「判定表」「再export」「非公開」「テストのためにexportしない」「選択モードで」等の語で、`PROJECT_ARCHITECTURE.md` と `_doc/arch/` の全ファイルを検索し、見つかった箇所が「今もそうである」と読める形で古い事実を述べていないかを判定する。経緯・現状として正しく書かれているもの（「到達不能になった」「残してある」等）は相違としない。
    * 4章のタスク17の欄には、検索した語・見つかった件数・判定（現存の経路として残っていない／残っている）を、資料のファイル:行ごとに書く。

* [ ] タスク18: 『開発資料との相違』欄の確定と、読み方が分かれる記述・照合できなかった主張の一覧
  * **対象ファイル**:
    * 本RES（`./_log/res/261117_1934_RES_Survey_Phase08_Doc_Consistency.md`）の4章・5章・6章：（整理）
  * **調査内容**:
    * 5章『開発資料との相違』を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。相違があれば、既知の傷3件（「参照する責務」F.）がタスク8・10・15から5章に挙がっていることを確かめる（挙がっていなければその旨を6章に書く）。
    * 4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。
    * 終わりに `git status` で、変更があるのは本RESファイルだけであることを確認する。

## 4. 調査結果
### タスク1: `PROJECT_ARCHITECTURE.md` 1章のフォルダ構成図・「存在しないもの」と、4章の一覧
* **調査内容**: 
  * `git diff --stat 33a5ca3 HEAD -- PROJECT_ARCHITECTURE.md _doc/arch js index.html test asset` → 空（B.2の前提どおり）。
  * `PROJECT_ARCHITECTURE.md` 17〜192行・640〜657行を開いた。構成図（17〜190行）の木をスクリプトで解析してパスを復元し、実在を確認。`git ls-files index.html sprite-check.html js test asset`（143件）と突き合わせた。
  * 構成図コメントの検証：対象各 `.js` の先頭JSDoc（`head -8`）、`import` 文の検索（`grep -rlE "import .*/<モジュール名>.js" js`、`^import` の件数）、`new ShapeExtentReader`・`drawToolIcons` の検索、`asset/sprite/*.js` の `^import|^export`、`index.html` の id・`:root` 変数・ボタン（`tool-select`・`tool-vertex`・`tool-eyedropper`・`unit-snap-group`・`unit-snap-toggle`・`option-position-group`・`option-align-group`・`view-toggle-group`・`float-windows-toggle`・`view-fit`・🧲・💉・🧰・⛶）の検索。
  * 「存在しないもの」：`git ls-files | grep -iE "package|node_modules|\.github|husky|CodeImporter"`（0件）、`ls -a`・`ls .github .husky`（無い）、`js/` 配下を `CodeImporter|addVertex|removeVertex|insertVertex|deleteVertex|splitPath|splitAt|rotate|flip|scale[A-Z]|mirror|keyObject|ungroup|layer` で検索（該当は `InputTracker.js:1531-1535` の `scaleX/scaleY`＝クライアント座標の換算と、`RulerRenderer.js:194` の `ctx.rotate`＝縦の定規の数字の向きだけで、図形の変形・頂点の追加削除ではない）、`ShapeAlignEditor.js` の `moveShapesBy`・`beginEdit`・`commitEdit` の検索。
  * 4章の表（648〜657行）の10行：`ls ./_doc/arch`（ファイル名のみ）と `git ls-files`。
  * 開いたコード：`js/core/` の `InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`・`PointHitRules`・`SelectionRules`・`MoveDirectionRules`・`UnitSnapRules`・`UnitSnapSettings`・`AltKeyGuard`・`ToolRules`・`SpriteFitRules`・`VertexHandleRules`・`NudgeTargetRules`・`DisplayState`・`GridSpacingRules`・`RulerTickRules`・`ViewFitRules`・`StatusReadoutRules`、`js/edit/` の `NudgeEditor`・`PositionInputRules`・`PositionInputEditor`・`ShapeAlignRules`・`ShapeAlignEditor`・`ShapeExtentReader`・`StyleEyedropper`、`js/palette/` の `OptionBarPositionGroup`・`OptionBarAlignGroup`・`UnitSnapGroup`・`ViewToggleGroup`、`js/wiring/` の2ファイル、`asset/sprite/select-arrow.js`、`index.html`、`js/main.js`（367・372・697行）の先頭または該当部。
  * 「存在しないもの」（192行）の項目ごとの照合（差し戻し対応）：`eval\(|new Function\(|import\(`、`\.png|\.svg|toDataURL|toBlob|\.json`、`globalAlpha|createLinearGradient|rgba\(|prefers-color-scheme`、`localStorage|sessionStorage|indexedDB`、`mouseleave|mouseout|pointerleave`、`shiftKey`・`altKey`（`KeyboardShortcuts.js` 除く）、`ctrlKey`（`hasCtrlModifier`）、`roundPointToUnit|roundDeltaToUnit|roundPointFromOriginToUnit|roundConstrainedDeltaToUnit|resolveUnitSnapStep`、`snap`（`js/edit/`・`KeyboardShortcuts.js`・`HistoryManager.js`・`SnapshotAdapter.js`・`CanvasStorage.js`・`DocumentSerializer.js`・`RulerRenderer.js`・`PositionInput*.js`・`ShapeAlign*.js`・`Nudge*.js` ほか）、`toggleSegment|segmentType|convertSegment|setSegment|toCurve|toLine`、`\.closed\s*=[^=]`、`\b(ratio|aspect\w*|pivot|basePoint)\b`、`devicePixelRatio|matchMedia|resize`、`drawToolIcons`、`selectedVertex|vertexSelection`、`isFillable\(\)`、`ruler`（`KeyboardShortcuts.js`）、`(?i)assembl|組み立て`、`document\.|getContext\(`（`test/`）、`nudge|arrow`・`type="color"`・`flex-wrap|overflow-x|Digit1|href=|multiple`（`index.html` ほか）を実行。開いたコード：`CursorShapeRules.js`（全体）、`PressActionRules.js`（全体）、`SelectionRules.js`（全体）、`UnitSnapSettings.js`（全体）、`ShapeAlignEditor.js`（1-100）、`ShapeAlignRules.js`（1-30・94-155）、`ToolIconWiring.js`（1-50）、`KeyboardShortcuts.js`（184-197・286-315）、`InputTracker.js`（130-141・998-1010・1170-1355）、`index.html`（500-536）。
  * 2回目の差し戻し対応で追加・再実行した検索（範囲はかっこ内）：`CodeImporter|addVertex|…|layer`（`js/`。再実行）、`\.elements\b`（`js/`）、`downloadText\(|downloadSpriteModule\(`（`js/`）、`for \(|forEach|\.map\(`（`CanvasFileOperations.js`）、`\.png|\.svg|image/png|image/svg|toDataURL|toBlob`（`js/`・`index.html`・`sprite-check.html`）、`type="number"`（`index.html`）、`createElement\(['"]input`（`js/`）、`draggable|dragstart|dragover|dragend|'drop'|"drop"`（`js/`・`index.html`）、`NewShapeStyle|newShapeStyle`（`js/`）、`#newShapeStyle`（`VectorModel.js`）、`new VectorModel`・`replaceAllShapes\(`（`js/`）、`globalAlpha|createLinearGradient|createRadialGradient|rgba\(`（`js/`・`index.html`）、`clamp|Math\.min|Math\.max|innerWidth`（`WindowManager.js`）、`\.style\.(left|top)\s*=`（`js/`）、`'group'|"group"`（`js/`）、`Digit|Numpad`・`action: '…'`・`ArrowUp|ArrowDown|ArrowLeft|ArrowRight`（`KeyboardShortcuts.js`）、`darkBackground|isDarkBackground`（`js/shapes/`）、`SEGMENT_KIND|\.kind\b|kind:`（`Path.js`）、`\.segments\s*=[^=]|segments\.(push|splice)|segments\[[^]]*\]\s*=[^=]`（`js/`）。開いたコード：`Path.js`（50-110・420-442）、`FileContentReader.js`（1-40・50-90）、`CanvasFileOperations.js`（197-245）、`DocumentFileIO.js`（80-110 と定数）、`VectorModel.js`（144-152）、`WindowManager.js`（94-112・128-142）、`CanvasManager.js`（20-36・225-240）、`KeyboardShortcuts.js`（100-150・180-200・286-305）、`ShapeFactory.js`（29-52）、`Rect.js`・`Ellipse.js`・`Line.js`・`Path.js`・`Curve.js` の `rgba(` の行を含むメソッド。
  * 末尾：`git status --short` → `?? .vscode/`（作業前から未追跡）のみ。ソース・資料に変更なし（変更があるのは本RESファイルだけ）。
* **事実（実コードの記述）**:
  * 構成図（1章）：
    * 構成図に書かれたファイル143件はすべて実在し、書かれたフォルダの位置にある。`git ls-files` の143件のうち構成図に個別に載っていないのは `asset/sprite/select-arrow.js`・`vertex-arrow.js` の2件だけで、構成図の `asset/sprite/` の行のコメントが名前を挙げている → 一致。
    * （:20）index.html のコメント：`#tool-eyedropper`（💉）＝`index.html:557`、`#tool-select`＝554・`#tool-vertex`＝555（中身は空でJSが描く）、`#unit-snap-group`＝539・🧲のボタン＝540、`:root` のカスタムプロパティ＝12〜25行 → 一致。
    * `core/InputModes.js`：先頭JSDocが値の定義だけ・importなし（`InputModes.js:1-4`）、`^import` 0件。列挙された使う側7つ（`InputTracker`・`KeyboardShortcuts`・`ToolRules`・`CursorShapeRules`・`VertexHandleRules`・`wiring/ToolIconWiring`・`main.js`）はいずれも import している → 一致。ただし列挙に無い `core/NudgeTargetRules.js` も import している（5章）。
    * `FocusKeyYieldRules.js`：先頭JSDocが「DOMの型は関数の中でだけ参照」（`:1-4`）。使う側 `InputTracker`・`KeyboardShortcuts`・`AltKeyGuard` の3つだけが import → 一致。
    * `PressActionRules`（importなし。使う側＝`InputTracker`のみ）・`CursorShapeRules`（使う側＝`InputTracker`のみ）・`PointHitRules`（使う側＝`InputTracker`のみ）→ 一致。
    * `SelectionRules`（使う側＝`InputTracker`・`main.js`。先頭JSDocが図形と頂点のクリック・範囲選択の次の選択と図形の選択の反転）、`MoveDirectionRules`（`InputTracker`のみ）、`UnitSnapRules`（`InputTracker`・`wiring/DisplayWiring`）、`UnitSnapSettings`（importなし。`main.js`が使う）、`AltKeyGuard`、`ToolRules`（`main.js`のみ）→ 一致。
    * `SpriteFitRules`（importなし・状態なし。使う側＝`wiring/ToolIconWiring`のみ）→ 一致。
    * `VertexHandleRules`：先頭JSDocの4つの規則（ハンドルの一覧・ハンドル名の判定・範囲に入る頂点・選んでいる頂点の範囲）と構成図の説明が一致。使う側＝`InputTracker`・`main.js`・`edit/PositionInputEditor`の3つ → 一致。
    * `NudgeTargetRules`：先頭JSDoc「importは`InputModes`の`OperationMode`のみ」（`:1-4`）→ 一致。使う側は `edit/NudgeEditor` のみと読める記述だが、`edit/PositionInputEditor.js` も import している → 5章。
    * `DisplayState`・`GridSpacingRules`（使う側＝`CanvasManager`・`RulerRenderer`・`wiring/DisplayWiring`）・`RulerTickRules`（`RulerRenderer`のみ）・`ViewFitRules`（`wiring/DisplayWiring`のみ）・`StatusReadoutRules`（`wiring/DisplayWiring`・`edit/PositionInputRules`。先頭JSDocが小数第1位の数字の形）→ 一致。
    * （palette）`OptionBarPositionGroup`（X・Yの欄。`#option-position-group`＝`index.html:506`）・`OptionBarAlignGroup`（8つのボタン。押せる／押せないの表示と押下の通知のみ。`#option-align-group`＝`index.html:513`）・`ViewToggleGroup`（`#view-toggle-group`＝`index.html:534`）・`UnitSnapGroup`（ON/OFFと単位の2つのボタン）→ 一致。
    * （wiring）`DisplayWiring`：ステータスバーの座標・大きさ・グリッド、表示の切り替え・スナップのまとまり、🧰（`DisplayWiring.js:93`、ボタンは `index.html:481`）・⛶（`index.html:545`）の購読が実在。使う側は `main.js:367` の1か所のみ → 一致。`ToolIconWiring`：先頭JSDocが選択・頂点の選択のボタンへスプライトJSを描いた`<canvas>`を入れる配線。`drawToolIcons()`（`ToolIconWiring.js:46`）を `main.js:372` が起動時に1回呼ぶ。使う側は `main.js` のみ → 一致。
    * （edit）`NudgeEditor`：先頭JSDocが「矢印キーでの微調整と位置の数値入力の両方が使う」（`:2`）→ 一致。`PositionInputRules`：importは `core/StatusReadoutRules` のみ、使う側＝`PositionInputEditor`のみ → 一致。`PositionInputEditor`：「実際の移動と記録は`NudgeEditor`に任せ」（`:3`）→ 一致。`ShapeAlignRules`：importなし・整列6種＋分布2種の8操作、使う側＝`ShapeAlignEditor`のみ → 一致。`ShapeAlignEditor`：`beginEdit`（`:93`）→`moveShapesBy`（`:94`）→`commitEdit`（`:95`）の対 → 一致。`ShapeExtentReader`：先頭JSDocが選択中・全図形・選択中の図形1つずつの外枠の照会 → 一致。`StyleEyedropper`：待ち受けの状態の保持と変更の通知、手本の図形からの取り込みの手順（先頭JSDoc）→ 一致。
    * （asset）`asset/sprite/select-arrow.js`・`vertex-arrow.js`：`^import` 0件、各214行が `export default { ...spriteData, draw };`、先頭JSDocが「OZ Vector Editor が出力したスプライト…他のファイルに依存しない」。`asset/sprite/` を import しているのは `js/wiring/ToolIconWiring.js` のみ → 一致。
    * （test）構成図の `test/` 配下のファイルはすべて実在し、`git ls-files test` と過不足なし。`index.html`・`js/` から `test/` を実行時に参照する箇所は無い（`ShapeStyleEditor.js:36`・`CodeExporter.js:38` のコメントの言及のみ）→ 一致。
  * 「存在しないもの」（192行）の項目ごとの照合（192行に書かれた項目を先頭から順に。「無い」と書かれたものは、検索した語と件数を添える）：
    * 共通の検索（以下で「共通の検索」と書く）：`CodeImporter|addVertex|removeVertex|insertVertex|deleteVertex|splitPath|splitAt|rotate|flip|scale[A-Z]|mirror|keyObject|ungroup|layer` を `js/` で検索し5件。`InputTracker.js:1531-1532,1534-1535` の `scaleX`／`scaleY`（4件。クライアント座標の換算）と `RulerRenderer.js:194` の `ctx.rotate`（1件。縦の定規の数字の向き）だけで、`CodeImporter`・頂点の追加と削除・パスの分割・図形の変形（拡大縮小・回転・反転）・キーオブジェクト・グループ化・レイヤーの実装は無い。`CodeImporter`・`package.json`・`node_modules` は `git ls-files` の検索で0件、`.github`・`.husky` は `ls` で無い（調査内容のとおり）。
    * 前半（Phase 07 より前の項目）：
      * 「エディタでのJSの実行」→ 一致。`js/` と `index.html`・`sprite-check.html` を `\beval\(|new Function\(` で検索し0件。`import(` は `js/check/SpriteCheckPage.js:168` の1件のみ（確認用ページがBlob URLのスプライトを読み込む処理で、エディタ本体（`js/` の他）には無い）。
      * 「本アプリが書き出した形以外のJSの読み込み・`CodeImporter`」→ 一致。`git ls-files | grep CodeImporter` 0件（上の調査内容）。「スプライトの`elements`からの図形の作り直し」→ 一致。スプライトのJSの読み込みは `FileContentReader.js:58-81` の `#deserializeFromModule` だけで、図形を作るのは `DocumentSerializer.deserialize(data.source)`（`:80`）。`:29` の規則が「スプライトの`elements`・`bounds`は読まない（`source`だけを使う）」と書く。`\.elements\b` を `js/` で検索し2件：`check/SpriteCheckInspector.js:87`（確認用ページの要素の数の表示）と `io/CodeExporter.js:54`（書き出すJSに埋め込む描画処理の文字列）だけで、`elements` から図形を作る処理は無い。
      * 「確認用ページでの拡大縮小・移動・編集・複数ファイルの同時表示」→ 一致。`js/check/` を `wheel|mousedown|pointerdown|dragover|drop|keydown` で検索し0件、`pan|translate|setOffset|panBy` で0件。`multiple` 属性は `sprite-check.html`・`js/check/*.js` で0件。「エディタから確認用ページへのリンク」→ `index.html`・`js/main.js`・`js/edit/*.js`・`js/palette/*.js` を `sprite-check|href=|<a ` で検索し0件（`js/check/SpriteCheckPage.js:2` の責務の記述に出るのみ）。「組み立て用のJSの表示・書き出し」→ `(?i)assembl|組み立て` を `js/check/` で検索し0件（`js/` 全体の該当16ファイルは文章中の「組み立てる」の用法のコメントで、組み立て用のJSを出す関数は `io/` に無い。書き出しは `CodeExporter`・`SpriteSerializer` のスプライトのJSのみ。ただし該当16ファイルの文脈は1件ずつは開いていない）。確認用ページの責務（`SpriteCheckPage.js:2`）はスプライトの表示の流れのみ。
      * 「スプライトのJSON（`<名前>.json`）の出力・読み込み・確認用ページでのJSON表示」→ 一致。`js/` を `\.png|\.svg|image/png|image/svg|toDataURL|\.json['"`]` で検索：拡張子の文字列は `js/io/DocumentFileIO.js` の作業データファイル（`FILE_EXTENSION = '.ozve.json'`＝`:10`）だけで、スプライトのJSONの出力は無い。
      * 「複数キャンバスの一括出力」→ 一致。ファイルへの書き出しは `CanvasFileOperations.js` の `exportCanvas`（`:197`。作業データ）と `exportSprite`（`:225`。スプライトのJS）の2つで、どちらも開いているキャンバスの `this.#model.getShapes()`（`:207`・`:235`）を、開いているキャンバスの名前（`state.openCanvasName`。`:208`・`:237`）で1回だけ `downloadText`（`:208`）／`downloadSpriteModule`（`:238`）へ渡す。キャンバスの一覧を回す繰り返しは無い（同ファイルの `for (`・`forEach`・`.map(` の検索は `:426` のリスナーの通知の1件のみ）。`downloadText\(|downloadSpriteModule\(` を `js/` で検索し5件：呼び出しは `:208`・`:238` の2件だけで、残りは `DocumentFileIO.js:87,98` の定義と `CanvasFileOperations.js:56` のコメント。
      * 「PNG・SVG等の形式」→ 一致。`\.png|\.svg|image/png|image/svg|toDataURL|toBlob` を `js/`・`index.html`・`sprite-check.html` で検索し0件。書き出しの拡張子は作業データの `.ozve.json`（`DocumentFileIO.js:10`）とスプライトの `.js`（`:22`）だけ。
      * 「独自のカラーピッカー」→ 一致。`index.html` の色の欄は `<input type="color">`（`:494`・`:496`）のみ。
      * 「図形の大きさ・角度の数値の欄」「頂点・図形の位置の数値の欄はPhase 08-04で実装済み」→ 一致。`type="number"` を `index.html` で検索し3件：`:497`（線の太さ `option-stroke-width`）・`:508`（`option-position-x`）・`:510`（`option-position-y`）。`:508,510` の `title` は「選択の外枠の左上のX（Y）座標…頂点の選択では選んだ頂点の左上」で、図形と頂点の位置の欄。大きさ・角度の欄は無い。`js/` で `createElement\(['"]input` は0件（欄を後から作る処理も無い）。位置の欄の実装として `js/edit/PositionInputEditor.js`・`PositionInputRules.js`・`js/palette/OptionBarPositionGroup.js` と `index.html:506` の `option-position-group` が実在。
      * 「プロパティパネル」「オプションバーの選択中：n個・次に描く図形の表示」「図形の一覧」→ 一致。`index.html` を `id="[a-z-]*(property|panel|layer|list)[a-z-]*"` で検索：該当は `canvas-list`（`:583`。キャンバスの一覧で図形の一覧ではない）と `window-dev-panel`（`:588`）のみ。`選択中：`・`selection-count` の検索は `index.html`・`js/main.js`・`js/palette/*.js` で0件。
      * 「重なっている図形だけを数える前へ・後ろへ」「離れた選択図形をまとめる重なり順の変更」→ 重なり順のボタンは4つ（`index.html:501-504`）で、`ShapeOrderRules.js` の4操作（`:14` の列挙）。重なっている図形だけを数える処理・離れた選択図形をまとめる処理の有無は、`ShapeOrderRules.js` の `reorderSelected`（`:59-`）の分岐（`BRING_TO_FRONT`＝`:64`・`SEND_TO_BACK`＝`:70`・`BRING_FORWARD`＝`:78` 等）の入力が全図形のidの並び（`items`）と `isSelected` だけであること（`:55-59` の引数）までを確かめた。「重なっている図形だけ」を数えるための図形の外枠の入力は無い。→ 一致（各操作の細部の挙動は照合していない）。
      * 「図形の一覧・ドラッグによる並べ替え」→ 一致。図形の一覧の要素が無いことは上の `id` の検索のとおり。`draggable|dragstart|dragover|dragend|'drop'|"drop"` を `js/`・`index.html` で検索し0件で、要素をドラッグして並べ替える処理は無い。重なり順を変える入口は上の4つのボタンと `KeyboardShortcuts.js` の `bringToFront`（`:158`）・`bringForward`（`:159`）・`sendBackward`（`:160`）・`sendToBack`（`:161`）のエントリ。
      * 「直前に使った値（新しく描く図形のスタイル）の保存」→ 一致。`localStorage|sessionStorage|indexedDB` を `js/` で検索：該当ファイルは `js/io/CanvasStorage.js` の1件のみ（作業データの保存先で、`getNewShapeStyle` を保存する経路は無い。`ShapeStyleEditor.js` に保存先の語なし）。
      * 「キャンバスごとの既定の色」→ 一致。新しく描く図形のスタイルは `VectorModel` の `#newShapeStyle`（`VectorModel.js:152`）1つで、`VectorModel` の生成は `main.js:60` の1か所。`#newShapeStyle` へ代入するのはコンストラクタ（`:168`。`DEFAULT_NEW_SHAPE_STYLE` の写し）と `updateNewShapeStyle`（`:417`）だけ（`#newShapeStyle` の検索：`:152,168,402,416,417,834`）。キャンバスの切り替え（`CanvasLibrary.js:948`）が呼ぶ `replaceAllShapes`（`VectorModel.js:632`）は触れない（`:149` のJSDoc「replaceAllShapesは触れない」）。`newShapeStyle|NewShapeStyle` は `CanvasStorage.js`・`DocumentSerializer.js` で0件で、キャンバスごとに色を持つ箇所は無い。
      * 「塗った内側による範囲選択」「弧・曲線・直線・開いたパスの塗り」→ 範囲選択は `InputTracker.js:1344-1347` が `shape.intersectsRect`（輪郭が矩形に掛かるか）で選ぶ。塗れる図形は `isFillable` の5実装：`Rect.js:53` が真、`Ellipse.js:83` が `this.type === 'circle'`（弧は偽）、`Path.js:98` が `this.closed === true`、`Line.js:49`・`Curve.js:59` が偽 → 一致。
      * 「透明度・グラデーション」→ 一致。`globalAlpha|createLinearGradient|createRadialGradient|rgba\(` を `js/` で検索し15件で、すべて `rgba(`（`globalAlpha`・グラデーションは0件）。内訳は `CanvasManager.js:24-27,32-35`（グリッド・軸線・原点の印の配色の8件）と `:73`（選択矩形の塗り）、`Rect.js:280`・`Ellipse.js:141`・`Line.js:261`・`Path.js:195`・`Curve.js:331`（各 `drawHover` のホバーの強調）、`Curve.js:106`（`drawHandles` の制御点の補助線）で、いずれもエディタの表示の色。エディタで図形の色を決める入口は `<input type="color">`（`index.html:494,496`）で、図形の `draw` は `this.fillColor`・`this.strokeColor` をそのまま使う（例：`Rect.js:79,83`）。図形のスタイルとしての透明度・グラデーションは無い。`index.html` の `rgba(` は `:179,386` のCSSの2件。
      * 「ツールバー・ステータスバーの折り返し・横スクロール・省略メニュー」→ `index.html:55` が `flex-wrap: nowrap`。`overflow-x` の検索は `index.html` で0件。→ 一致（要素の並びとCSSの範囲）。実際の見え方は「照合できなかった主張」（既出）。
      * 「フロートウィンドウの位置・表示状態の保存」→ 一致。上の `localStorage` の検索の該当は `CanvasStorage.js` のみで、`WindowManager.js` は該当せず。
      * 「フロートウィンドウを動かせる範囲の制限」→ 一致。`js/core/WindowManager.js` を `clamp|Math\.min|Math\.max|innerWidth` で検索し0件。ドラッグ中の位置は `#handleWindowMouseMove`（`WindowManager.js:128-142`）が `style.left`・`style.top` へ開始位置＋移動量をそのまま入れる（`:140-141`）。`\.style\.(left|top)\s*=` を `js/` で検索し4件で、すべて `WindowManager.js`（`:109-110` のドラッグ開始時の位置の固定と `:140-141`）。
      * 「レイヤー」「グループ化」→ 一致。共通の検索（`layer`・`ungroup`）で該当なし。図形種別は `ShapeFactory.js:30-35` の6種（`line`・`curve`・`arc`・`rect`・`circle`・`path`）で、`'group'|"group"` を `js/` で検索し0件。
      * 「`package.json`・`node_modules`・ビルド手順」「テストの自動実行（フック・CI）」「画面の操作や描画のテスト」→ `package.json` 等は `git ls-files` 0件、`.github`・`.husky` は無し。画面の操作や描画のテスト → 一致。`document\.(getElementById|createElement|querySelector)|getContext\(|new Image\(|jsdom|puppeteer|playwright` を `test/` で検索し0件（`test/` の個々のテストの内容はタスク12・13の担当）。
      * 「表示の状態（アウトライン・背景・グリッド・パレットの表示）の保存・履歴の対象化」→ 一致。`DisplayState.js` は `import` を持たず（`^import` 0件）、`HistoryManager.js` の `Snapshot` は `document`・`selectedIds` だけ（`HistoryManager.js:14`・`SnapshotAdapter.js:59-87`）。
      * 「定規の表示・非表示の切り替え・ガイド・定規からのドラッグ・原点の変更・単位の切り替え」→ 一致。`RulerRenderer.js` のインスタンスメソッドは `constructor`（`:67`）・`resize`（`:86`）・`render`（`:104`）の3つだけで、表示の切り替え・ガイド・原点・単位の入口が無い。`ruler`（大文字小文字を区別しない）を `KeyboardShortcuts.js` で検索し0件。
      * 「全体を画面に収めるキー・100%専用のキー（`Ctrl`+`1`）・選択中だけを画面に収める操作」→ 一致。`KeyboardShortcuts.js` の対応表で数字キーのエントリは2つだけ：`SHAPE_TYPES.map` で作る図形種別のエントリ（`:141-148`。`Digit${i + 1}`・`Numpad${i + 1}` をテンプレートで作るので `Digit1` も含まれるが、`ctrl: false`＝`:143` のみ）と、`Digit0`・`Numpad0` の `resetView`（`:149`。`ctrl: true`）。`Digit|Numpad` の検索の該当は `:113`（JSDoc）・`:142`・`:149`・`:150-151`（`NumpadAdd`・`NumpadSubtract` の拡大・縮小）だけで、`Ctrl`+`1` のエントリ（`ctrl: true` で `Digit1` を含むもの）は無い。対応表の `action` の値（27種）に全体・選択中を画面に収める操作は無い（画面に収めるのは ⛶ のボタン `index.html:545` のみ）。
      * 「白・黒以外の背景・ダークモード」→ 一致。背景は `DisplayState.js` の `darkBackground`（真偽値。`:9,28,55`）の2値のみ。`prefers-color-scheme` は `js/`・`index.html` で0件。「図形の色を背景に合わせて変えること」→ 一致。`darkBackground|isDarkBackground` を `js/shapes/` で検索し0件。`CanvasManager.render` は通常の表示では `shape.draw(this.ctx)`（`CanvasManager.js:238`）を背景の情報を渡さずに呼び、図形は自分の `strokeColor`・`fillColor` で描く（例：`Rect.js:79,83`）。
      * 「カーソルがキャンバスの外へ出たときのホバーの強調の解除」→ 一致。`mouseleave|mouseout|pointerleave` を `js/` で検索：該当は `core/CanvasCursorTracker.js:52` の購読（カーソル位置を「なし」にするだけ）のみで、`InputTracker.js` には無い。`clearHovered()` の呼び出しは `InputTracker.js:468,736,1166,1444`（モード切り替え・移動中の当たり判定・ドラッグ開始）で、キャンバスの外へ出たことを契機にしたものではない。
    * （Phase 07-04）：
      * 「`Shift`+クリックでの選択の追加」→ 一致。`shiftKey` を `js/` で検索（`KeyboardShortcuts.js` を除く）：`InputTracker.js:1265` の移動方向の限定のみ。クリックの選択の追加・解除は `hasCtrlModifier`（`InputTracker.js:137-139`。`ctrlKey || metaKey`）で `SelectionRules.js:23-37` の `additive` へ渡る。
      * 「`Ctrl`+範囲選択での解除（範囲選択の`Ctrl`は追加だけ）」→ 一致。`SelectionRules.js:48-62` の `resolveMarqueeSelection` は `additive` のとき既存の選択へ足すだけ（外す分岐なし）。
      * 「選択集合外の図形の押してそのままのドラッグ・`Alt`+ドラッグ（1回クリックで選んでから）」→ 一致。`PressActionRules.js:42-50`：本体が選択集合外なら `null`（何も始めない）、選択集合内なら `moveSelection`。`Alt` は押した時点の `event.altKey` を `InputTracker.js:1144` で `#duplicateOnMove` へ記憶する経路のみ（`altKey` を `js/` で検索：`InputTracker.js:271,760,1137,1144` のコメントと代入のみで、追従のたびには読まない）。
      * 「頂点のハンドルのドラッグでの`Shift`の限定（効くのは本体・moveハンドルの移動だけ）」→ 一致。`#applyLeftDragUpdate`（`InputTracker.js:1196-1251`）の頂点の枝は `event.shiftKey` を読まず、`:1192` のJSDocが「Shiftは頂点のハンドルには効かせない」と書く。`shiftKey` を読むのは `#resolveMoveDelta`（`:1265`）のみ。
      * 「`Shift`での正方形・正円の作成」「ドラッグの途中での`Alt`の切り替え」→ 一致。上の `shiftKey`・`altKey` の検索で、作成（`:692-723`・`:940-951`）の枝に `shiftKey`・`altKey` の参照は無い。
      * 「スポイトの連続の取り込み（1回取り込むと待ち受けがやむ）」→ 一致。`StyleEyedropper.js:114-123` の `pickFrom` が `this.stop()` を呼ぶ（`:86` の `stop` が `#picking = false`）。「取り込む項目を選ぶUI・画面の色からの取り込み・押している間だけ働く一時的なスポイト」→ `StyleEyedropper.js` の公開メソッドは `start`（`:73`）・`stop`（`:86`）・`cancelPicking`（`:101`）・`pickFrom`（`:114`）で、項目を選ぶ引数・画面の色の取得（`EyeDropper`）は無い。`KeyboardShortcuts.js` のスポイトのエントリは `KeyI`（`:183`）の1件で `keyup` の購読は無い（`addEventListener('key` の検索：`AltKeyGuard.js:37-38`・`OptionBarStyleGroup.js:183`・`InputTracker.js:427-428`・`KeyboardShortcuts.js:225`。`KeyboardShortcuts.js` は `keydown` のみ）。→ 一致。
      * 「`D`での太さの変更（`D`は色だけ）」→ 一致。`KeyD`（`ctrl: false`）は `resetColors`（`KeyboardShortcuts.js:181`）。`ShapeStyleEditor.js:198-200` の `resetColors` は `applyStyle(RESET_COLORS_STYLE)` を呼ぶだけで、`RESET_COLORS_STYLE`（`StylePanelRules.js:75`）は `{ strokeColor: '#000000', fillColor: '#ffffff' }` の2つ（太さを含まない）。
    * （Phase 07-05）：
      * 「スナップの設定の保存・履歴の対象化・キャンバスごとの設定」→ 一致。`UnitSnapSettings.js:35` のJSDocが「作業データ・履歴・ブラウザの保存先には含まれず」と書き、実装は `#enabled`・`#unit` の2つのフィールドのみで保存先の呼び出しが無い（`UnitSnapSettings.js:38-143` を全て開いた）。`snap` を `KeyboardShortcuts.js`・`HistoryManager.js`・`SnapshotAdapter.js`・`CanvasStorage.js`・`DocumentSerializer.js` で検索し、スナップの設定に当たるものは0件（`Snapshot` の語のみ）。
      * 「1px・グリッド10px以外の単位・単位の数値の入力欄」→ 一致。`UnitSnapSettings.js:22-25` の `UNIT_SNAP_STEPS` は `pixel: 1`・`grid: 10` の2つのみ。`index.html` の `type="number"` の欄は3つ（`:497` の線の太さ `option-stroke-width`、`:508,510` の位置のX・Y）で、スナップの単位の欄は無い（`UnitSnapGroup.js` は2つのボタン）。「画面のグリッドの線の間隔に合わせる単位」→ `UnitSnapSettings.js:18-19` のコメントが `GridSpacingRules.js` をimportしないと書き、`^import` 0件。
      * 「スナップのキー」→ 一致。`snap` を `KeyboardShortcuts.js` で検索し0件。
      * 「`Ctrl`以外の修飾キーでの一時無効・キーの購読による即時の反映」→ 一致。`hasCtrlModifier`（`InputTracker.js:137-139`）が `ctrlKey || metaKey` のみ。`InputTracker.js:963-992` の `handleKeyDown`・`handleKeyUp` は `Space` 以外は `return`（`:964-966`・`:982-984`）。`Ctrl` の状態は `CanvasCursorTracker`（`isCtrlPressed`＝`DisplayWiring.js:127` が読む）でマウスの移動から更新される。
      * 「丸めた位置を示す表示」→ 読み方が分かれる（下記）。「定規の印を丸めた位置へ動かすこと」→ 一致。`snap` を `RulerRenderer.js` で検索し0件。
      * 「既存の図形・読み込み・出力・貼り付けのずらし量の丸め」→ 一致。`roundPointToUnit|roundDeltaToUnit|roundPointFromOriginToUnit|roundConstrainedDeltaToUnit|resolveUnitSnapStep` を `js/`（`UnitSnapRules.js` 以外）で検索：使う場所は `InputTracker.js`（`:717`・`:950`・`:1235`・`:1264-1268` の点を打つ・頂点のドラッグ・本体の移動）と `wiring/DisplayWiring.js:127-128`（ステータスバーの座標の表示）だけ。`Math.round|toFixed|Math.floor|Math.trunc` を `js/io/` で検索：該当は `SpriteSerializer.js:133` の `Math.floor`（弧の四分円の計算）の1件のみで座標の丸めではない。貼り付け・複製の `ClipboardController.js`・`ShapeInserter.js` に `snap` の語は0件。
      * 「曲線の作成時の制御点の丸め」→ 一致。上の `roundPointToUnit` の使う場所は点を打つ2か所（`:717`・`:950`）のみで、制御点を丸める箇所は無い。`Curve.js` を `Math.round|Math.floor|Math.trunc|toFixed` で検索し0件。
    * （Phase 08-02a）：
      * 「頂点の追加・削除」→ 一致（共通の検索）。
      * 「ツールごとのカーソルの形の切り替え（カーソルの形の規則は操作モードの分岐だけ）」→ 一致。`CursorShapeRules.js` は `import` が `InputModes.js` のみ（`:6`）で、図形種別（`SHAPE_TYPES`・`currentShapeType`）を参照しない。モードの分岐は `OperationMode.CREATE`（`:62`）・`PAN`（`:66`）・`VERTEX`（`:70`）・`SELECT` 以外の既定（`:90`）。
      * 「選択・頂点の選択以外のツールのアイコンの差し替え」→ 一致。`ToolIconWiring.js:46-49` の `drawToolIcons` が描くのは `tool-select`・`tool-vertex` の2つだけ（`OperationMode.SELECT`・`VERTEX`）。
      * 「アイコンの`devicePixelRatio`の変化・ウィンドウの移動での描き直し（起動時に1回だけ描く）」→ 一致。`drawToolIcons` の呼び出しは `main.js:372` の1件のみ（`drawToolIcons` を `js/` で検索：定義 `ToolIconWiring.js:46`・import `main.js:49`・呼び出し `main.js:372`）。`devicePixelRatio` を読むのは `ToolIconWiring.js:29` の描画のたびで、`resize`・`matchMedia` の購読は `ToolIconWiring.js` に無い（`devicePixelRatio|matchMedia|resize` の検索：`ToolIconWiring.js` は `:29` のみ）。
      * 「頂点の選択の保存・履歴の対象化・書き出し」→ 一致。`selectedVertex|vertexSelection|VertexSelection` を `js/` で検索：`InputTracker.js`（7件）・`SelectionRules.js`（3件）のみで、`io/`・`HistoryManager.js`・`SnapshotAdapter.js` には0件（`(?i)vertex|opmode|OperationMode` を `js/io/` で検索し0件）。`SnapshotAdapter.js:79-87` の復元は `snapshot.selectedIds` のみ。
      * 「`main.js`への操作モードの判定の追加（削除ボタンの見た目を頂点の選択で変えない）」→ 一致。`main.js:290-292` の `syncDeleteButtonState` は `model.getSelectedIds().length === 0` だけで `OperationMode` を参照しない。`main.js` が `OperationMode` を参照する行は `:88-89`（選択の復元の可否）・`:398-459`（`applyMode` と `toolActions`）・`:528,540,929` で、削除ボタンの状態の同期には無い。
    * （Phase 08-02b）：
      * 「頂点の追加・削除」「パスの分割」「拡大縮小・回転・反転・外枠のハンドル」→ 一致（共通の検索）。
      * 「区間の直線／曲線の切り替え」→ 一致。`Path.js` は区間の種類を持つ：`this.segments` を区間の数だけ `{ kind: SEGMENT_KIND_LINE }` の並びとして作り（`Path.js:81-84`。`SEGMENT_KIND_LINE = 'line'`＝`:25`）、`:57` のJSDocが「区間の要素は`{ kind }`で、`kind`は現在`'line'`のみ」と書き、`fromJSON` が `segments[i].kind` を受理する種類（`ACCEPTED_SEGMENT_KINDS`＝`:31` の `'line'` のみ）かを検証して（`:430-436`）復元する（`:439`）。ただし `kind` の値は `'line'` だけで、切り替える経路は無い：`\.segments\s*=[^=]|segments\.(push|splice)|segments\[[^]]*\]\s*=[^=]` を `js/` で検索し2件（`Path.js:82` のコンストラクタと `:439` の `fromJSON`）のみ、`toggleSegment|segmentType|convertSegment|setSegment|toCurve|toLine` を `js/` で検索し0件。描画の `#tracePath`（`:109`）は `kind` で分岐しない（`:105-106` のコメント「本作業の区間はすべて直線のため分岐しない」「曲線の区間を足すときは、ここで`kind`により…分ける」）。
      * 「パスを開く／閉じる」→ 一致。`\.closed\s*=[^=]` を `js/` で検索し1件のみ：`Path.js:80`（コンストラクタ）。`openPath|togglePathClosed|toggleClosed` の検索0件。パスを閉じる経路は端点のドラッグでの結合（`InputTracker.js:1286-1288` の `joinDraggedEndpoint`）と `J` の結合（`KeyboardShortcuts.js:156`）で、これらは本作業の追加ではない（Phase 08 より前から）。
      * 「複数の頂点（2つ以上）を選んでいるときの端点への吸い付き（1つだけ選んでいるときだけ働く）」→ 一致。`InputTracker.js:1125` が `if (this.#vertexDragOrigins.length === 1)` のときだけ `#dragEndpoint` を解決する。`:1064` のJSDocも同じことを書く。
      * 「頂点のドラッグでの`Shift`による方向の限定」→ 一致（07-04 の項のとおり。`InputTracker.js:1192`）。
      * 「範囲選択で図形そのものを選ぶこと・頂点が出ていない図形（選択集合に無い図形）の頂点を範囲選択で選ぶこと」→ 一致。頂点の選択のモードの範囲選択（`InputTracker.js:1328-1342`）は `collectVertexHandlesInRect(this.model.getShapes(), this.model.getSelectedIds(), …)`（選択集合の図形の頂点だけ）を使い、`intersectsRect`・`resolveMarqueeSelection` を呼ばずに `return` する（`:1344-1352` の図形の枝へ行かない）。
      * 「整列と分布」→ 192行末の注記のとおりPhase 08-05で実装済み（下の「192行末の注記」の項）。
    * （Phase 08-03）：
      * 「整列と分布」「拡大縮小・回転・反転・外枠のハンドル」「頂点の追加・削除」「パスの分割」「区間の直線／曲線の切り替え」「パスを開く／閉じる」→ 08-02b の項と同じ（整列と分布は192行末の注記の項）。
      * 「`Ctrl`＋矢印・`Alt`＋矢印への割り当て（一致させない）」→ 一致。矢印キーのエントリ8件は `KeyboardShortcuts.js:105-108`（4方向）と `:187-197`（方向ごとにShiftなし／Shift併用の2つ。`ctrl: false`＝`:192`）。`:186` のコメントが「Ctrl（⌘）付きのエントリは作らず、Alt付きは#findBindingが常に不一致」と書き、対応表のJSDocの `:121` も同じことを書く。`#findBinding`（`:291-302`）は先頭が `if (event.altKey) { return null; }`（`:292-294`）で、`binding.ctrl === ctrlPressed`（`:298`）で比較する。`ArrowUp|ArrowDown|ArrowLeft|ArrowRight` を `KeyboardShortcuts.js` で検索し5件：`:105-108`（方向の定義）と `:120`（対応表のJSDoc）だけで、矢印キーのエントリは `:105-108` の `code` を使う `:187-197` の組み立てだけ（`ctrl: true` の矢印キーのエントリは無い）。「`Shift`＋矢印は10px」→ `KeyboardShortcuts.js:188-189`（`NUDGE_STEPS.shift`・`ShiftRule.REQUIRED`）。
      * 「微調整でのスナップの丸め・端点への吸い付き」→ 一致。`snap`（大文字小文字を区別しない）を `js/edit/NudgeEditor.js`・`js/core/NudgeTargetRules.js` で検索し0件（`js/edit/` 全体では `EndpointSnapper.js`（27件）・`SnapshotAdapter.js`（9件。`Snapshot` の語）のみ）。`NudgeEditor.js` に `import` する丸めの規則は無い。
      * 「ツールパレット等への微調整のボタンの追加」→ 一致。`nudge|arrow` を `index.html` で検索し0件。
      * 「性能の改善を目的とした変更」→ 意図の記述でコードの事実としては確かめられない → 「照合できなかった主張」（下記）。
      * 「書き出しの際の座標の丸め」→ 一致。`js/io/` の `Math.round|toFixed|Math.floor|Math.trunc|precision` の検索の該当は `SpriteSerializer.js:133` のみで座標の丸めではない。
    * （Phase 08-04）：
      * 「整列と分布」「大きさ・角度の数値の欄」「拡大縮小・回転・反転・外枠のハンドル」「頂点の追加・削除」→ 前半の「図形の大きさ・角度の数値の欄」の項・共通の検索のとおり一致（整列と分布は192行末の注記の項）。
      * 「基準点の指定」→ 一致。`\b(ratio|aspect\w*|pivot|basePoint)\b` を `js/` で検索（大文字小文字を区別しない）：`RulerTickRules.js` の5件のみ（目盛りの語で位置の欄とは無関係）。位置の欄は `index.html:508,510` の `title` のとおり外枠の左上のX・Yの2つだけ。
      * 「位置の欄でのスナップの丸め・端点への吸い付き」→ 一致。`snap` を `js/edit/PositionInput*.js`・`js/palette/OptionBarPositionGroup.js` で検索し0件。
      * 「欄の値の保存（作業データ・書き出し・履歴のエントリの形・版は変えていない）」→ 値の保存先として使う `localStorage` の呼び出しは `CanvasStorage.js` のみで、位置の欄を扱う `PositionInputEditor.js`・`OptionBarPositionGroup.js` には無い。「履歴のエントリの形・版は変えていない」は `HistoryManager.js:14` の `Snapshot` の形が `document`・`selectedIds` であることまで確認（過去の形との差は `git diff` で確かめていない）→ 「照合できなかった主張」（下記）。
    * （Phase 08-05）：
      * 「頂点の選択（`A`）で選んだ頂点をそろえる機能（対象は図形だけ）」→ 一致。`ShapeAlignEditor.js:29,87` が使う外枠は `getSelectedBoundsPerShape`（選択中の図形1つずつ）だけで、`vertex` の語は `js/edit/ShapeAlignRules.js`・`ShapeAlignEditor.js` に0件（`js/edit/` の `vertex`（大文字小文字を区別しない）の検索の該当は `NudgeEditor.js`（6件）・`PositionInputEditor.js`（2件）のみ）。
      * 「基準にする図形（キーオブジェクト）・キャンバスを基準にした整列」→ 一致。`computeAlignMoves(items, operation)`（`ShapeAlignRules.js:161`）は図形の一覧と操作だけを受け取り、基準の指定の引数・キャンバスの大きさの引数が無い。基準は全体の範囲の最小・最大（`:103-118`）。`keyObject` は `js/` で0件（共通の検索）。
      * 「指定した間隔の分布（すき間の数値入力）」→ 一致。`index.html:513-522` の整列のまとまりは8つのボタンのみ（`type="number"` の欄なし）。すき間は `ShapeAlignRules.js:129` の式で自動計算。
      * 「中心の間隔をそろえる分布（そろえるのは外枠どうしのすき間）」→ 一致。`:121-139`：軸の最小端（`minKey`）で並べ、`gap`（全体の長さ−各図形の長さの合計）÷（件数−1）を置く外枠どうしのすき間。中心の間隔をそろえる分岐は無い。
      * 「整列・分布へのキーの割り当て（ボタンだけ）」→ 一致。`align|distribute|Align|Distribute` を `KeyboardShortcuts.js` で検索し0件。
      * 「大きさ・角度の数値の欄」→ 一致。`type="number"` を `index.html` で検索し3件（`:497` の線の太さ、`:508,510` の位置のX・Y）で、大きさ・角度の欄は無い（前半の「図形の大きさ・角度の数値の欄」の項）。
      * 「基準点の指定」→ 08-04 の項と同じ（一致）。
      * 「変形（拡大縮小・回転・反転）」「複数選択の比率の保持」→ 一致。共通の検索の `scale[A-Z]|rotate|flip|mirror`（図形の変形なし）と、`ratio|aspect` の検索（`RulerTickRules.js` のみ）。
      * 「頂点の追加・削除」→ 一致（共通の検索）。
      * 「整列・分布の結果へのスナップの丸め・端点への吸い付き」→ 一致。`ShapeAlignRules.js:153` のJSDocが「座標は丸めない」と書き、`snap` の検索は0件。`ShapeAlignEditor.js:33` も「スナップの設定を読まない」。
      * 「作業データ・書き出し・履歴のエントリの形・版は変えていない」→ 上の08-04と同じ（「照合できなかった主張」）。
    * 192行末の注記「Phase 08-02b・08-03・08-04の項の「整列と分布」は当時の記録で、Phase 08-05で実装済み」→ 一致。`js/edit/ShapeAlignRules.js`・`js/edit/ShapeAlignEditor.js`・`js/palette/OptionBarAlignGroup.js` と `index.html:513` の `option-align-group` が実在。
  * 4章の一覧（648〜657行の10行）：`InputModes.js`→`32_InputModes.md`、`FocusKeyYieldRules.js`→`33_`、`PressActionRules.js`→`34_`、`CursorShapeRules.js`→`35_`、`wiring/DisplayWiring.js`→`36_DisplayWiring.md`、`SpriteFitRules.js`→`37_`、`VertexHandleRules.js`→`38_`、`wiring/ToolIconWiring.js`→`39_ToolIconWiring.md`、`asset/sprite/`→`40_asset_sprite.md`、`NudgeTargetRules.js`→`41_NudgeTargetRules.md`。モジュール側と `_doc/arch/` のファイルは10行すべて実在 → 一致。
* **推測・所見**:
  * **読み方が分かれる記述**：（同 192行、Phase 07-05）「丸めた位置を示す表示」は、キャンバス上の印なのか数字の表示も含むのかが分からない。キャンバス上の印（`CanvasManager` が描く吸い付きの印は端点への吸い付き用の `setSnapPoint`＝`InputTracker.js:665-670`）と読めば一致（丸めた位置の印は無い）。ステータスバーの座標の表示を含むと読めば、`wiring/DisplayWiring.js:120-128` がスナップONのとき丸めた位置を表示しているため相違（ただし同じ資料の 3章17. の側にこの表示が書かれているかは、本タスクの対象外のため未確認）。
  * **照合できなかった主張**：（同 192行、Phase 08-03・08-04・08-05）「作業データ・書き出し・履歴のエントリの形・版は変えていない」は、Phase 8 の前後での形の差を `git diff` で確かめていない（現在の `Snapshot` の形＝`HistoryManager.js:14` と `SnapshotAdapter.js:59-87` までを確認）。
  * **読み方が分かれる記述**：（同 192行、前半）「図形の色を背景に合わせて変えること」は、図形のスタイルの色（`strokeColor`・`fillColor`）のことと読めば一致（通常の表示は `CanvasManager.js:238` の `shape.draw(this.ctx)` で背景の情報を渡さない）。アウトライン表示の線の色も含むと読めば、`CanvasManager.js:28,36` の配色（白背景で `'#000000'`・黒背景で `'#ffffff'`）を `:209` で背景により選び `:236` の `drawOutline` へ渡しているため、背景に合わせて変わっている（Phase 8 より前からの実装。`git show 6efcbad:js/core/CanvasManager.js` でも `:28,36` の配色と `:190`・`:217` の同じ選び方がある）。
  * **照合できなかった主張**：（同 192行、Phase 08-03）「性能の改善を目的とした変更」は、やらないことの意図の記述でコードの事実として確かめられない。
  * **照合できなかった主張**：（同 192行、前半）「重なっている図形だけを数える前へ・後ろへ」「離れた選択図形をまとめる重なり順の変更」は、`ShapeOrderRules.js` の各操作の細部の挙動（並びの入れ替え方）までは照合していない（入力が図形のidの並びと選択の判定だけであることのみ確認）。
  * **読み方が分かれる記述**：（同 192行）「整列と分布」は08-02b・08-03・08-04の各項に「やらないこと」として残るが、末尾の注記で「当時の記録で08-05で実装済み」と明示されており、相違とはしない。
  * **照合できなかった主張**：（同 192行）選択の有無の見分け方・テストプレイや発注者の決定に基づく運用上の見え方は、コードの有無だけ確かめ、見え方は照合していない。
  * **照合できなかった主張**：（同 20行）「ツールバー・定規・ステータスバーはフロートウィンドウではない」の実ブラウザでの見え方は、要素の並び以上は確かめていない。
  * 構成図に `README.md`（リポジトリ直下に実在）は載っていないが、Phase 8 の差分の `+` 行ではないため照合の対象外。

### タスク2: `PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」と依存方向
* **調査内容**: 
  * `git diff --stat 33a5ca3 HEAD -- PROJECT_ARCHITECTURE.md _doc/arch js index.html test asset` → 空（B.2の前提どおり）。`git diff -U0 6efcbad 33a5ca3 -- PROJECT_ARCHITECTURE.md` のハンク見出しに `+195`・`+199,2`・`+202` があることを確認。`PROJECT_ARCHITECTURE.md` 192〜203行を開いた（194行＝見出し「フォルダ分割の方針」、195行＝`core/`、196行＝`shapes/`・`palette/`、197行＝`io/`、198行＝`check/`、199行＝`edit/`、200行＝`wiring/`、201行＝`test/`、202行＝「依存方向」）。照合の対象は195・199・200・202行のみ（196〜198・201行は `+` 行ではない）。
  * `grep -rnE "^import|^\} from|^export .* from" js`（`js/` 全体。`shapes/` は別に実行）で全 import 文を一覧にした。`js/edit/EndpointSnapper.js` だけが複数行の `import {` 〜 `} from` で、`../shapes/EndpointSnapRules.js` と `../shapes/PathJoinRules.js` を読む。`export ... from`（再export）は `js/` に0件。
  * モジュールごとの使う側の検索：`grep -rlE "from '.*/<名前>\.js'" js`・同 `test`（対象：`InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`・`PointHitRules`・`SelectionRules`・`MoveDirectionRules`・`UnitSnapRules`・`UnitSnapSettings`・`AltKeyGuard`・`ToolRules`・`SpriteFitRules`・`VertexHandleRules`・`NudgeTargetRules`・`GridSpacingRules`・`RulerTickRules`・`ViewFitRules`・`StatusReadoutRules`・`DisplayState`・`CanvasCursorTracker`・`ViewToggleGroup`・`UnitSnapGroup`・`ShapeAlignRules`・`ShapeOrderRules`・`StylePanelRules`・`PositionInputRules`）と、各ファイル自身の `^import` の件数。
  * 逆向きのimportの検索：`wiring/` を読む import（`js/main.js` 以外）、`asset/` を読む import、`js/edit/` の `../core/` の import、`js/io`・`js/shapes`・`js/check` から `../core`・`../edit` を読む import、`js/palette` の import 文、`js/` で `check/` を読む import。
  * 規則の関数の「状態・DOMに触れない」確認：`js/core/` の規則15ファイル（`PointHitRules`・`SelectionRules`・`MoveDirectionRules`・`PressActionRules`・`CursorShapeRules`・`NudgeTargetRules`・`VertexHandleRules`・`SpriteFitRules`・`GridSpacingRules`・`RulerTickRules`・`ViewFitRules`・`StatusReadoutRules`・`UnitSnapRules`・`ToolRules`・`InputModes`）を `\bdocument\b|\bwindow\b|^\s*class |\bthis\.` で検索 → 0件（`VertexHandleRules.js:20,63` の `new Set` は状態ではない）。`js/edit/ShapeAlignRules.js`・`PositionInputRules.js` を `\bthis\.|\bclass\b` で検索 → 0件。
  * 先頭JSDocを開いたファイル：`InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`・`AltKeyGuard`・`UnitSnapSettings`・`DisplayState`・`CanvasCursorTracker`・`RulerRenderer`・`StatusReadoutRules`・`wiring/DisplayWiring`・`wiring/ToolIconWiring`・`edit/ShapeExtentReader`（8〜20行）。`export` の検索（`js/core` の10ファイル・`js/edit` の7ファイル）。
  * `js/edit/` の `OperationMode|InputModes`・`shouldRestoreSelection|prepareSwitch|prepareInsert`・`getMode|HistoryManager` の検索。`new ShapeExtentReader`（`js/` 全体）・`nudgeEditor`（`js/main.js`）・`new DisplayWiring`・`InputTracker` の `this.#snapAssist.`・`this.#inputAssist.` の呼び出しの検索。`js/wiring/DisplayWiring.js`（55〜196行）・`ToolIconWiring.js`（14〜49行）・`edit/PositionInputEditor.js`・`edit/ShapeAlignEditor.js`（56〜80行）・`edit/NudgeEditor.js`・`main.js`（690〜726行）を開いた。`wc -l js/wiring/*.js js/main.js` → `DisplayWiring.js` 196・`ToolIconWiring.js` 49・`main.js` 988（`awk 'END{print NR}' js/main.js` も988で一致。行数は本タスクの照合の対象の主張ではないため参考）。
  * 末尾：`git status --short` → `?? .vscode/`（作業前から未追跡）のみ。ソース・資料に変更なし（変更があるのは本RESファイルだけ）。
* **事実（実コードの記述）**:
  * 195行 `core/`（フォルダの方針の前半）：
    * 「`PointHitRules`は`InputTracker`から使う。DOM・状態に触れない」→ 一致。使う側は `js/` で `core/InputTracker.js` のみ（`test/core/PointHitRules.test.js` がテスト）。上の `document|window|class|this.` の検索で `PointHitRules.js` は0件。
    * 「`ToolRules`を使うのは`main.js`だけで、`core/`の処理からは使われない」→ 一致。`js/` で `main.js` のみ、`test/` で `test/core/ToolRules.test.js` のみ。`ToolRules.js` の import は `InputModes`・`ShapeFactory` の2件（`ToolRules.js:5-6`）で、「操作モードと図形種別の知識を要する」の根拠に合う。
    * 「`edit/`は操作モードを知らない」→ 一致（コードのコメントを除く）。`OperationMode|InputModes` を `js/edit/` で検索：該当は `CanvasLibrary.js:240`・`NudgeEditor.js:5,21`・`SnapshotAdapter.js:21` のコメントだけで、`NudgeEditor.js:21` は「`OperationMode`をimportせず、比較も分岐もせず規則へ渡すだけ」と書く（`edit/` に `OperationMode` の import は0件）。「`palette/`はimportを持たない」→ 一致。`js/palette/` の `import ` の該当は `console.warn` の文字列中の語の2件（`CanvasPalette.js:212`・`DevPanel.js:79`）だけで import 文は0件。
    * 「`main.js`は判定を持たない」は設計の意図（C.の「意図・方針」）。`main.js` が `VertexHandleRules` の `collectVertexHandles` を呼ぶ（import `main.js`）ことだけ確認した。
    * Phase 07-03：`GridSpacingRules`の使う側（`CanvasManager`・`RulerRenderer`・`wiring/DisplayWiring`）→ 一致（`js/` の使う側3件がこのとおり）。`RulerTickRules`は`RulerRenderer`が使う → 一致（使う側は `RulerRenderer.js` のみ）。`ViewFitRules`は`wiring/DisplayWiring`だけが使う → 一致（`js/` で `DisplayWiring.js` のみ）。`StatusReadoutRules`は`wiring/DisplayWiring`だけが使う → 相違（5章。使う側は `DisplayWiring.js` のほかに `js/edit/PositionInputRules.js:6`。同じ行の末尾の Phase 08-04 の文（`:195`）と `:202` の Phase 08-04 の文が `edit/PositionInputRules` の使用を書いているが、07-03 の文の「だけが使い」は訂正されていない）。`DisplayState`・`CanvasCursorTracker`が`core/`にある → 一致（`js/core/`。`CanvasCursorTracker.js` の責務JSDocはカーソル位置の保持と通知で、`DisplayState` の責務JSDoc（`:2-3`）は表示専用の状態＝`ViewTransform` と同じ位置づけ）。`RulerRenderer`は状態を持たない → 一致（責務JSDoc「状態は保持しない」）。`CanvasCursorTracker`は「DOMの購読を含む」→ 一致（`CanvasCursorTracker.js:51-52` に `canvas.addEventListener('mousemove', ...)` と `('mouseleave', ...)`。責務JSDocの「カーソル位置の保持と変更通知のみ」とは別に、本体が DOM を購読している）。
    * Phase 07-04：`SelectionRules`は`InputTracker`と`main.js`の両方が使う → 一致（`js/` の使う側がこの2件。`main.js` は `invertSelection`）。`MoveDirectionRules`は`InputTracker`だけが使う → 一致。`AltKeyGuard`は「`Alt`の単独押下・単独解放の抑止」→ 一致（責務JSDoc `AltKeyGuard.js:2-3`）。`AltKeyGuard`は「DOMの購読を含む小さな部品」→ 一致（`AltKeyGuard.js:37-38` に `document.addEventListener('keydown'|'keyup', handleAltKey)`）。`KeyboardShortcuts`は`keyup`を購読しない → 一致（`js/core/KeyboardShortcuts.js` を `addEventListener` で検索して1件、`:225` の `document.addEventListener('keydown', ...)` のみ）。
    * Phase 07-05：`UnitSnapRules`は`InputTracker`と`wiring/DisplayWiring`が使う → 一致（`js/` の使う側2件。`UnitSnapRules.js` の import は0件）。`UnitSnapSettings`の責務が「保持・切り替え・変更通知のみ」（`DisplayState`と同じ位置づけ。importなし）→ 一致（責務JSDoc `UnitSnapSettings.js:2-3`、`^import` 0件）。
    * Phase 08-01：`InputModes`の使う側として`InputTracker`・`KeyboardShortcuts`・`ToolRules`・`CursorShapeRules`・`main.js`を挙げる（使う側の列挙は網羅の列挙と読む。タスク1と同じ基準）→ 相違（5章。`grep -rlE "from '.*/InputModes\.js'" js` の使う側は8ファイル：左の5つのほか `core/NudgeTargetRules.js:5`・`core/VertexHandleRules.js:5`・`wiring/ToolIconWiring.js:8`。不足する3件は同じ資料の `:202` の後のサブフェイズの文に書かれている）。`InputModes`の内容が`InputState`・`OperationMode`の値の定義 → 一致（`InputModes.js:16`・`:34`の2つのexport。責務JSDoc `:2-3`）。`FocusKeyYieldRules`の使う側が`InputTracker`・`KeyboardShortcuts`・`AltKeyGuard` → 一致（`js/` の3件ちょうど。責務JSDocは「DOMの型は関数の中でだけ参照」）。`PressActionRules`・`CursorShapeRules`は`InputTracker`だけが使う → 一致（`js/` で `InputTracker.js` のみ。両者に `document|window|class|this.` は0件）。
  * 195行 `core/`（Phase 08-02a〜08-04）：
    * 08-02a：`SpriteFitRules`は`wiring/ToolIconWiring`だけが使う → 一致（`js/` で `ToolIconWiring.js` のみ。import 0件）。`VertexHandleRules`の「`InputTracker`と`main.js`の両方が使い」（使う側を列挙・限定する文。網羅の列挙と読む）→ 相違（5章。`grep -rlE "from '.*/VertexHandleRules\.js'" js` の使う側は `js/core/InputTracker.js`・`js/main.js`・`js/edit/PositionInputEditor.js` の3ファイル。`InputTracker.js` は `isVertexHandle`・`collectVertexHandlesInRect`、`main.js` は `collectVertexHandles`、`PositionInputEditor` は `computeVertexHandlesBounds`）。不足する `PositionInputEditor` は同じ資料の `:195` の Phase 08-04 の文と `:202` の Phase 08-04 の文に書かれている。`VertexHandleRules`の公開：`collectVertexHandles`（`:18`）・`isVertexHandle`（`:42`）・`collectVertexHandlesInRect`（`:62`。08-02b の追加として書かれたもの）・`computeVertexHandlesBounds`（`:89`）→ 一致。「`CanvasManager`は位置を引数で受け取る」→ `CanvasManager.js` は `VertexHandleRules` を import しない（使う側の検索）ことだけ確認した。
    * 08-03：`NudgeTargetRules`は「`edit/NudgeEditor`だけが使う」→ 相違（5章。使う側は `js/edit/NudgeEditor.js:6` と `js/edit/PositionInputEditor.js:6`。不足する `PositionInputEditor` は同じ資料の `:202` の Phase 08-04 の文に書かれている）。`NudgeTargetRules`の中身（動かす対象の決定とまとめの鍵の組み立て）→ 一致（`resolveNudgeTarget`＝`:23`・`buildNudgeGroupKey`＝`:43`）。「`InputTracker`は矢印キーの経路に関わらない」→ 一致。`js/core/InputTracker.js` を `Arrow|nudge` で検索して0件、かつ `NudgeTargetRules` を import しない（使う側の検索：`NudgeEditor.js`・`PositionInputEditor.js` のみ）。「`edit/`は操作モードを知らない」→ 上のとおり一致。
    * 08-04：`computeVertexHandlesBounds`が`VertexHandleRules`にあり、`edit/PositionInputEditor`が使う → 一致（`VertexHandleRules.js:89`、`PositionInputEditor.js:7` の import）。`formatReadoutNumber`（数字の形＝小数第1位）の使う側が、ステータスバーに加えて`edit/PositionInputRules`にも増えた → 一致。`formatReadoutNumber`（`StatusReadoutRules.js:26`。責務JSDoc `:2-4` が小数第1位）を `PositionInputRules.js:6,35` が import して呼ぶ。ステータスバー側は `DisplayWiring` が `formatCursorReadout`・`formatSizeReadout`・`formatGridReadout`（`DisplayWiring.js:6`）を呼び、その内部（`StatusReadoutRules.js:40-41,51-52`）で `formatReadoutNumber` を呼ぶ（`DisplayWiring.js` に `formatReadoutNumber` の語は0件。「使う側がステータスバー」は間接の使い方）。
  * 199行 `edit/`：
    * 「結合の手順`PathJoiner`と吸い付きの手順`EndpointSnapper`のみ`shapes/`の規則も」→ 一致。`js/edit/` で `../shapes/` を import するのは `PathJoiner.js`（`PathJoinRules`）と `EndpointSnapper.js`（`EndpointSnapRules`・`PathJoinRules`）だけ。
    * 手順の列挙：貼り付け・複製・同じ位置に貼り付け・`Alt`+ドラッグの複製（`ClipboardController`＝`paste`:150・`duplicate`:171・`pasteInPlace`:188・`duplicateInPlaceWithinEdit`:206）、履歴のスナップショットの取得・適用（`SnapshotAdapter`。`shouldRestoreSelection` を注入で受ける＝`:46`）、キャンバス一覧の管理（`CanvasLibrary`）、ファイル操作の組み立て（`CanvasFileOperations`）、パスの結合（`PathJoiner`）、吸い付き（`EndpointSnapper`）、スタイルの変更（`ShapeStyleEditor` の `applyStyle`＝`:150`・`resetColors`＝`:198`）、スポイト（`StyleEyedropper`）、重なり順（`ShapeOrderEditor`）、外枠の照会（`ShapeExtentReader`の`getSelectedBounds`＝`:37`・`getAllBounds`＝`:66`、ほかに `getSelectedBoundsPerShape`＝`:50`）→ ファイル・メソッドは実在し一致。各手順の内部の挙動は本タスクの対象外。
    * 「`core/`は`io/`をimportできないため、`SpriteSerializer`の外枠の入口を使うこの照会は`edit/`に置く」→ 一致。`ShapeExtentReader.js` は `../io/SpriteSerializer.js` を import（`edit → io`）。`core/` から `io/` を読む import は0件（下の依存方向の項）。
    * 「操作モードに依存する判定・処理は`shouldRestoreSelection`・`prepareSwitch`・`prepareInsert`のような中立な注入関数で受け取る」→ 一致。`shouldRestoreSelection`＝`SnapshotAdapter.js:38,46`、`prepareSwitch`＝`CanvasLibrary.js:243`、`prepareInsert`＝`CanvasFileOperations.js:144,179`（いずれも注入）。
    * Phase 08-03：`NudgeEditor`の位置づけ（`ShapeOrderEditor`と同じ）と「`getMode`の戻り値を`core/NudgeTargetRules`の規則へ渡すだけ」→ 一致（`NudgeEditor.js:50` が `getMode` を受け、`:90` の `resolveNudgeTarget(this.#getMode(), ...)` で渡す。`OperationMode` の import は無い）。
    * Phase 08-04：`PositionInputRules`（状態を持たない）→ 一致（`this.`・`class` は0件）。`PositionInputEditor`の「`getMode`の戻り値を規則へ渡すだけ」→ 一致（`PositionInputEditor.js:43,77`）。「動かす操作と履歴の記録は`NudgeEditor`（呼び出し元が矢印キーと位置の数値入力の2つ）へ任せ、`PositionInputEditor`は`HistoryManager`を持たない」→ 一致。`PositionInputEditor.js:69` が `nudgeEditor.nudgeWithoutGrouping` を呼び、`HistoryManager` は import も引数にも無い（`PositionInputEditor.js:15` のJSDocが「`HistoryManager`を持たない」）。`NudgeEditor` の呼び出し元は `main.js:702`（`PositionInputEditor` へ渡す）と `main.js:884`（`nudgeSelection`＝`nudgeEditor.nudge`）の2つ。
    * 「`ShapeExtentReader`は、`wiring/DisplayWiring`が内部に1つ持つほか、`main.js`の`// 7.10.`でも1つ生成している（2か所。状態を持たない照会で値は同じ）」→ 一致。`new ShapeExtentReader` は `js/` で `wiring/DisplayWiring.js:65` と `main.js:697`（`// 7.10.`＝`:692`）の2件ちょうど。フィールドは `#model` の1つだけ（`ShapeExtentReader.js:22`）で状態を持たない。
    * Phase 08-05：`ShapeAlignRules`（状態を持たない。importなし）→ 一致（`^import` 0件、`this.`・`class` 0件）。`ShapeAlignEditor`は`VectorModel`・`HistoryManager`・`ShapeExtentReader`を注入で受け取る → 一致（`ShapeAlignEditor.js:65` のコンストラクタが `model`・`editRecorder`・`shapeExtentReader`）。「`ShapeOrderRules`・`ShapeOrderEditor`と同じ形」→ `ShapeOrderEditor.js:5` が `./ShapeOrderRules.js` を import し、`ShapeAlignEditor.js:5` も同じ形（`ShapeAlignRules` を import）。「操作モードを知らず、対象は選択中の図形だけ」→ `OperationMode|getMode` を `ShapeAlignEditor.js`・`ShapeAlignRules.js` で検索し0件。「`// 7.10.`のインスタンスを`PositionInputEditor`と`ShapeAlignEditor`の2つが使い、生成は2か所のまま」→ 一致（`main.js:701`・`:726`。`:701` は `PositionInputEditor` への注入、`:726` は `ShapeAlignEditor` への注入）。
  * 200行 `wiring/`：
    * 「`DisplayWiring`＝ステータスバーの座標・大きさ・グリッドの表示、表示の切り替え・スナップのまとまり・🧰・⛶」→ 一致。`DisplayWiring.js:128`（座標）・`:137`（大きさ）・`:146`（グリッド）、`ViewToggleGroup`（`:78`）、`UnitSnapGroup`（`:87`）、`#float-windows-toggle`（フロートウィンドウ）、`#view-fit`（全体を画面に収める）。
    * 「判定・計算の規則は持たず、`core/`の規則・`palette/`の部品・`edit/`の照会を呼ぶだけ」（呼ぶ先を列挙・限定する文。使う側の列挙と同じく網羅の列挙と読む）→ 相違（5章）。`DisplayWiring.js` の import は `edit/ShapeExtentReader`（`:5`）・`core/` の5つ（`:6-10`）・`palette/` の2部品（`:11-12`）。`core/` の5つのうち `StatusReadoutRules`・`GridSpacingRules`・`ViewFitRules`・`UnitSnapRules`（`:6-9`）は規則だが、`core/ViewTransform`（`:10`）は規則ではない（責務JSDoc `ViewTransform.js:2-3` はビュー変換状態の保持・変換・変更通知。上の `js/core/` の規則15ファイルにも入れていない）。`DisplayWiring` は `ViewTransform` の静的な値 `ViewTransform.MIN_SCALE`・`ViewTransform.MAX_SCALE`（`:192`）を使う。さらに `DisplayWiring` は注入された `core/` の状態オブジェクトのメソッドを呼ぶ：`displayState` の `toggleOutline`・`toggleBackground`・`toggleGrid`（`:79-81`）・`onChange`（`:83`・`:96`）・`toggleFloatWindows`（`:95`）・`getState`（`:156`）・`isFloatWindowsVisible`（`:176`）、`unitSnapSettings` の `onChange`（`:72`・`:91`）・`toggleEnabled`・`toggleUnit`（`:88-89`）・`getActiveStep`（`:127`）・`getState`（`:166`）、`viewTransform` の `onChange`（`:71`・`:74`）・`getScale`（`:146`）・`setView`（`:194`）、`cursorTracker` の `onChange`（`:70`）・`getWorldPosition`（`:126`）・`isCtrlPressed`（`:127`）、`model` の `onChange`（`:73`）（`DisplayState`・`UnitSnapSettings`・`ViewTransform`・`CanvasCursorTracker`・`VectorModel` はいずれも `js/core/` の状態を持つクラスで、規則ではない）。呼ぶ先の `core/` が「規則」に限られない。`core/ViewTransform` の import は同じ資料の `:202` の「`wiring/DisplayWiring`はほかに`edit/ShapeExtentReader`・`core/StatusReadoutRules`・`core/GridSpacingRules`・`core/ViewFitRules`・`core/ViewTransform`・`palette/ViewToggleGroup`をimportする」が補っているが、`:202` の文は import の列挙で、状態オブジェクトのメソッドの呼び出しには触れていない。また `ToolIconWiring.js:5-6` が `asset/sprite/select-arrow.js`・`asset/sprite/vertex-arrow.js` を import し、`:39` で `sprite.draw(ctx)`（スプライトJSの描画）を呼ぶ。呼ぶ先の `asset/sprite/` が列挙に無い。不足分は同じ資料の `:202` の Phase 08-02a の向きの文（`wiring/ToolIconWiring → asset/sprite/*.js`）に書かれている。「判定・計算の規則は持たず」の部分は一致：計算は `#fitViewToShapes` の `computeFitView` 呼び出し・`#syncGridSizeReadout` の `computeGridSpacing` 呼び出しなど規則への委譲で、独自の判定式は `world === null ? null : ...` の null 分岐だけ（`:128`）。`ToolIconWiring.js` も計算は `computeSpriteFitTransform` への委譲と `Math.round`（キャンバスの画素数）だけ。
    * 「`main.js`だけが使い、`js/`の他のフォルダは`wiring/`をimportしない」→ 一致。`js/` で `wiring/` を import する行は `main.js`（`DisplayWiring`・`drawToolIcons`）のみ。「`main.js`の他の配線ブロックは切り出していない」→ `main.js` に `// 7.1x.` 等の配線ブロックが残る（`main.js:692`・`:721`）ことだけ確認。「4章の`main.js`の行数の項」の参照先は照合していない（4章は本行の `+` 行ではない）。
    * 「`ToolIconWiring`＝ツールパレットの選択・頂点の選択のボタンへスプライトJSの絵を描く」→ 一致（責務JSDoc `ToolIconWiring.js:2-3`、`:47-48` の `drawToolIcons`）。
  * 202行 「依存方向」：
    * 「`main.js → edit → io → core → shapes`の一方向」→ 一致（import文の一覧の範囲）。`edit → io`（`CanvasFileOperations`・`CanvasLibrary`・`ClipboardController`・`ShapeExtentReader`・`ShapeInserter`・`SnapshotAdapter` が `../io/`）、`io → core`（`io/DocumentSerializer.js` が `../core/ShapeFactory.js`）、`core → shapes`（`core/ShapeFactory.js` が `../shapes/` の5図形）。逆向き：`core/` が `io/`・`edit/`・`palette/`・`wiring/`・`asset/` を import する行は0件、`io/` が `edit/`・`wiring/` を import する行は0件、`shapes/` の import は `shapes/` 内（`ShapeGeometry`・`ShapeDataValidation`・`Path`・`PathJoinRules`）のみ、`js/palette/` の import 文は0件。
    * 「`main.js`は加えて`wiring/`をimportし、`wiring/`は`palette/`・`edit/`・`core/`をimportする（`main.js → wiring → palette / edit / core`。`js/`の他のフォルダは`wiring/`をimportしない）」（import 先を列挙する文。網羅の列挙と読む）→ `wiring/` の import 先は相違（5章）。`wiring/DisplayWiring.js`＝`edit/`1・`palette/`2・`core/`5で列挙の範囲内だが、`wiring/ToolIconWiring.js`＝`core/`2（`:7-8`）と`asset/sprite/`2（`:5-6`）で、`asset/sprite/` が列挙に無い（`js/wiring/` はこの2ファイルのみ）。不足分は同じ資料の `:202` の Phase 08-02a の向きの文（`wiring/ToolIconWiring → asset/sprite/*.js`）に書かれている。`main.js` が `wiring/` を import し、`js/` の他のフォルダは `wiring/` を import しない → 一致（`wiring/` を import するのは `main.js` のみ）。
    * 「`core/`は`io/`をimportしない」「`core/`・`io/`は`edit/`をimportしない」→ 一致（上のとおり0件）。
    * 「`edit/PathJoiner`は`shapes/PathJoinRules`を、`edit/EndpointSnapper`は`shapes/EndpointSnapRules`・`shapes/PathJoinRules`をimportする。`edit/`の他のクラスは`shapes/`をimportしない」→ 一致（`js/edit/` で `../shapes/` を読むのはこの2ファイルだけ）。
    * 「`edit/ShapeStyleEditor`は`edit/StylePanelRules`を、`edit/StyleEyedropper`は`StylePanelRules`の`sampleStyleFromShape`を、`edit/ShapeOrderEditor`は`edit/ShapeOrderRules`を（`edit/`内）import。`ShapeOrderRules`は何もimportしない」→ 一致（`StylePanelRules` の使う側は `ShapeStyleEditor.js`・`StyleEyedropper.js` の2件。`ShapeStyleEditor.js` は `buildStylePanelView`・`nextEnabledOnToggle`・`parseStrokeWidthInput`・`RESET_COLORS_STYLE`・`toColorInputValue`、`StyleEyedropper.js` は `sampleStyleFromShape` の1つ。`ShapeOrderRules.js` の `^import` 0件）。
    * 「`shapes/EndpointSnapRules`は`shapes/PathJoinRules`をimportする。`PathJoinRules`は`Path`のみimportする」→ 一致（`EndpointSnapRules.js:5`、`PathJoinRules.js:5`）。
    * 「`core/InputTracker`は`PointHitRules`・`SelectionRules`・`MoveDirectionRules`・`InputModes`・`FocusKeyYieldRules`・`PressActionRules`・`CursorShapeRules`をimportする。`CursorShapeRules`だけが`InputModes`をimportし、それ以外の6つは何もimportしない」→ 一致。`InputTracker.js` の import 文に7つとも含まれる。7つのうち自身の import 行があるのは `CursorShapeRules.js:6`（`InputModes` のみ）だけで、他の6つは `^import` 0件。
    * 「`core/InputTracker`は`core/UnitSnapRules`をimportする。`UnitSnapRules`は何もimportしない」→ 一致。
    * 「`main.js`は`core/UnitSnapSettings`・`core/InputTracker`の`hasCtrlModifier`・`core/InputModes`の`OperationMode`・`wiring/DisplayWiring`をimportする」→ 一致（`main.js` の import 文。`InputTracker` は `WHEEL_ZOOM_STEP` も同じ文で import）。「`UnitSnapRules`の`resolveUnitSnapStep`・`roundPointToUnit`と`palette/UnitSnapGroup`は`wiring/DisplayWiring`がimportする。`DisplayWiring`はほかに`edit/ShapeExtentReader`・`core/StatusReadoutRules`・`GridSpacingRules`・`ViewFitRules`・`ViewTransform`・`palette/ViewToggleGroup`をimportする」→ 一致（`DisplayWiring.js` の import 8行がこの名前どおり。余りも不足もなし）。
    * 「`core/UnitSnapSettings`・`core/UnitSnapRules`・`palette/UnitSnapGroup`は何もimportしない。`GridSpacingRules`も新たにimportしない」→ 一致（3ファイルとも `^import` 0件）。
    * 「`core/AltKeyGuard`は`core/FocusKeyYieldRules`の`isTextInputElement`だけをimportする。`InputTracker`は`AltKeyGuard`をimportしない」→ 一致（`AltKeyGuard.js:6`。`AltKeyGuard` の使う側は `main.js` のみ）。「`main.js`は`core/SelectionRules`の`invertSelection`をimportする」→ 一致。
    * 「`core/ToolRules`は`core/InputModes`の`OperationMode`と`core/ShapeFactory`の`SHAPE_TYPES`をimportする。`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない。`ToolRules`をimportするのは`main.js`とテストだけ」→ 一致（`ToolRules.js` の import 2行。`js/` の使う側は `main.js` のみ、`test/` は `test/core/ToolRules.test.js` のみ）。
    * 「`core/CanvasManager`は`core/GridSpacingRules`をimportする。`core/RulerRenderer`は`GridSpacingRules`・`RulerTickRules`をimportする（この2つは何もimportしない）」→ 一致（`CanvasManager.js`・`RulerRenderer.js` の import。`GridSpacingRules`・`RulerTickRules` の `^import` 0件）。
    * 「`edit/ShapeExtentReader`は`io/SpriteSerializer`をimportする」→ 一致。「`DisplayState`・`ViewFitRules`・`StatusReadoutRules`・`CanvasCursorTracker`・`palette/ViewToggleGroup`は何もimportしない」→ 一致（5ファイルとも `^import` 0件）。
    * 「`core/InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドと、第7引数の補助（`duplicateSelection`・`isPickingShape`・`pickShape`・`getUnitSnapStep`）を呼ぶだけ」→ 一致。この「だけ」は、`InputTracker` から `edit/` の機能へ届く呼び出しに限った言い方と読んだ（`InputTracker.js:338` のコンストラクタ `(canvas, model, viewTransform, editRecorder, snapAssist, isFillHitExcluded, inputAssist)` に対し、`main.js:162-170` が渡す引数のうち `edit/` の部品へ届くのは第5引数 `endpointSnapper`（`edit/EndpointSnapper`）と第7引数の補助（実体は `edit/ClipboardController` の `clipboardController`・`edit/StyleEyedropper` の `styleEyedropper`。`getUnitSnapStep` の実体は `core/UnitSnapSettings` の `unitSnapSettings`）の2つ。第6引数 `() => displayState.isOutline()` は `core/DisplayState` に属し、`edit/` へは届かない）。`InputTracker.js` に `edit/` を読む import は0件。`#snapAssist.`（`resolveDragEndpoint`・`findDragSnap`・`findDrawSnap`・`commitDrawnLine`・`joinDraggedEndpoint`）と `#inputAssist.`（`duplicateSelection`・`getUnitSnapStep`・`isPickingShape`・`pickShape`）を呼ぶ。コンストラクタ第7引数＝`inputAssist`（`InputTracker.js:338`）、4項目（`duplicateSelection`・`isPickingShape`・`pickShape`・`getUnitSnapStep`）を並べる JSDoc は `InputTracker.js:184` と `:334-335`（`:33-37` はドラッグの閾値の JSDoc で、4項目の列挙ではない）。
    * 「`check/ → io`（確認用ページ専用）」→ 一致（`check/SpriteCheckInspector.js` が `../io/SpriteSerializer.js`、`check/` の他の import は `check/` 内）。`js/` から `check/` を import する行は0件（198行の記述は `+` 行ではないが、依存方向の例外の箇所として確認）。
    * Phase 08-02a の向き：`wiring/ToolIconWiring → asset/sprite/*.js`（`ToolIconWiring.js:5-6`）・`→ core/SpriteFitRules`・`core/InputModes` → 一致。`asset/sprite/` の2ファイルは `^import|^export .* from` 0件で何もimportしない。`core/` は `asset/` を import しない（0件）。`core/InputTracker → core/VertexHandleRules` → 一致。`VertexHandleRules` は `core/InputModes` の `OperationMode` のみ import（`VertexHandleRules.js` の import 1行）。`main.js → core/VertexHandleRules`・`wiring/ToolIconWiring` → 一致。`SpriteFitRules` は何もimportしない → 一致。循環importは無い → import 一覧で確認（上の逆向きの検索に該当なし）。
    * Phase 08-03 の向き：`main.js → edit/NudgeEditor` → 一致。`edit/NudgeEditor → core/NudgeTargetRules` → 一致（`NudgeEditor.js:6`）。「`edit/`から`core/`をimportする最初の例」→ 一致。`git grep -n "\.\./core/" 6efcbad -- js/edit` は16行で、すべて JSDoc の型表記（`import('../core/…')`・`@type`・`@param`）、これを除くと0件（`git grep -n "from '\.\./core/" 6efcbad -- js/edit` も0件）。08-03 完了の `890fd23` では `git grep -n "from '\.\./core/" 890fd23 -- js/edit` が `js/edit/NudgeEditor.js:6` の1件だけ。`core/NudgeTargetRules → core/InputModes`（`OperationMode` のみ）→ 一致。`NudgeEditor` が`NudgeTargetRules`の2関数だけを import（`resolveNudgeTarget`・`buildNudgeGroupKey`）し、`VectorModel`・`HistoryManager` は import しない → 一致（`NudgeEditor.js:6`・`:19`）。
    * Phase 08-04 の向き：`main.js → edit/PositionInputEditor`・`edit/ShapeExtentReader`・`palette/OptionBarPositionGroup` → 一致（`main.js` の import 文）。`PositionInputEditor → core/NudgeTargetRules`・`core/VertexHandleRules`・`edit/PositionInputRules` → 一致（`PositionInputEditor.js:6-8`）。`PositionInputRules → core/StatusReadoutRules` → 一致（`PositionInputRules.js:6`）。「`edit/`から`core/`をimportするファイルは`NudgeEditor`・`PositionInputRules`・`PositionInputEditor`の3つ」→ 一致。`js/edit/` で `../core/` を読む import 文は `NudgeEditor.js:6`・`PositionInputEditor.js:6,7`・`PositionInputRules.js:6` の3ファイル（ほかの `../core/` の行は `import('../core/VectorModel.js')` というJSDocの型表記 `@type`・`@param` で、import 文ではない）。「`NudgeTargetRules`・`VertexHandleRules`は`InputModes`のみ、`StatusReadoutRules`は何もimportしないため循環しない」→ 一致。「`PositionInputEditor`は`NudgeEditor`・`ShapeExtentReader`・`VectorModel`をimportせず、注入で受け取る」→ 一致（import は上の3つのみ。コンストラクタ `PositionInputEditor.js:43`）。`palette/OptionBarPositionGroup` は何もimportしない → 一致（`js/palette/` の import 文は0件）。
    * Phase 08-05 の向き：`main.js → edit/ShapeAlignEditor`・`palette/OptionBarAlignGroup` → 一致。`edit/ShapeAlignEditor → edit/ShapeAlignRules`（`ShapeAlignRules` は何もimportしない）→ 一致（`ShapeAlignEditor.js:5`）。`ShapeAlignEditor` は `core/`・`shapes/`・`io/` を import しない → 一致（import 文は `ShapeAlignRules` の1行のみ）。`palette/OptionBarAlignGroup` は何もimportしない → 一致。
* **推測・所見**:
  * **読み方が分かれる記述**：（`PROJECT_ARCHITECTURE.md:195`、Phase 08-04 の文）「`formatReadoutNumber`の使う側は、ステータスバー（`wiring/DisplayWiring`）に加えて…」は、`DisplayWiring` が `formatReadoutNumber` を直接呼ぶ（0件）のではなく `formatCursorReadout` 等を通して使う間接の使い方。「使う側」を直接の呼び出しと読めば `DisplayWiring` は使う側ではなく `StatusReadoutRules` 内の別の関数が使う側になる。
  * **照合できなかった主張**：（`PROJECT_ARCHITECTURE.md:195`）「置く理由：…`main.js`は判定を持たない・`InputTracker`へは入れない」「`InputTracker`の再分離ではない」「`ToolRules`と`PointHitRules`とは位置づけが違う」等の設計の意図の記述は、方針そのものであり、コードで確かめられる範囲（使う側・importの有無・状態の有無）のみ照合した。
  * **照合できなかった主張**：（`PROJECT_ARCHITECTURE.md:199`）`edit/`の列挙の各手順の内部の挙動（`ClipboardController` の「同じ位置に貼り付け・`Alt`+ドラッグの複製」の経路、`ShapeStyleEditor`の`applyStyle`の働き 等）は、本タスクの対象（フォルダの置き方と依存）の外のため、メソッドの存在だけ確認した。
  * 本行の `+` 行の主張のうち、他タスクへ先送りしたものは無い。`InputTracker` の頂点の選択の枝・`main.js` の配線ブロックの詳細は、本タスクの対象の記述が「使う側」「import」の範囲で完結するため扱っていない。

### タスク3: `PROJECT_ARCHITECTURE.md` 2章と、3章の冒頭・1.〜6.
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク4: `PROJECT_ARCHITECTURE.md` 3章 7.〜17. への追記
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク5: `PROJECT_ARCHITECTURE.md` 3章18.（頂点の選択）と `_doc/arch/38_VertexHandleRules.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク6: `PROJECT_ARCHITECTURE.md` 3章19.（矢印キーでの微調整）と `_doc/arch/07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`41_NudgeTargetRules.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク7: `PROJECT_ARCHITECTURE.md` 3章20.（位置の数値入力）と `_doc/arch/13_palette.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク8: `PROJECT_ARCHITECTURE.md` 3章21.（整列・分布）と `_doc/arch/14_edit.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク9: `_doc/arch/01_index_html.md`・`37_SpriteFitRules.md`・`39_ToolIconWiring.md`・`40_asset_sprite.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク10: `_doc/arch/02_main.md` と `36_DisplayWiring.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク11: `_doc/arch/06_InputTracker.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク12: `_doc/arch/16_test.md` の前半
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク13: `_doc/arch/16_test.md` の後半
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク14: `_doc/arch/03_VectorModel.md`・`04_CanvasManager.md`・`05_ViewTransform.md`・`10_ShapeFactory.md`・`12_shapes.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク15: `_doc/arch/32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`・`35_CursorShapeRules.md`
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク16: 既存の `_doc/arch/18`〜`31` の小さな修正
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

### タスク17: 要件2：Phase 8 で移った・到達不能になった・公開の形が変わったものの残りの検索
* **調査内容**: 
  * (未実施)
* **事実（実コードの記述）**:
  * (未実施)
* **推測・所見**:
  * (未実施)

## 5. 開発資料との相違
* `PROJECT_ARCHITECTURE.md` および `_doc/arch/` 配下の記述と、実コードに相違があった場合のみ記載する（各タスクが末尾へ追記する）。
* 形式: **（タスク番号）（対象：資料のファイルと節（行））**： （資料の記述） → （実コードの実態。`ファイル:行` を添える）
* 相違が見つからなかった場合は、タスク18で「相違なし」と記載する（未確認と区別するため）。
* **（タスク1）（対象：`PROJECT_ARCHITECTURE.md` 1章 構成図 `core/InputModes.js` の行（約29行））**：「InputTracker・KeyboardShortcuts・ToolRules・CursorShapeRules・VertexHandleRules・wiring/ToolIconWiring・main.jsから使う」 → `js/core/NudgeTargetRules.js` も `import { OperationMode } from './InputModes.js';` している（使う側が1件足りない。構成図の他の行は使う側をすべて並べており、網羅の列挙と読む）。
* **（タスク1）（対象：`PROJECT_ARCHITECTURE.md` 1章 構成図 `core/NudgeTargetRules.js` の行（約40行））**：「`edit/NudgeEditor`から使う」 → `js/edit/PositionInputEditor.js` も `import { resolveNudgeTarget } from '../core/NudgeTargetRules.js';` している（使う側は `NudgeEditor` と `PositionInputEditor` の2つ。Phase 08-04 の使い方が構成図に反映されていない）。
* **（タスク2）（対象：`PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」`core/`（195行）、Phase 08-02a の文）**：「`VertexHandleRules`（…）`InputTracker`と`main.js`の両方が使い」 → `js/` の使う側は `js/core/InputTracker.js`・`js/main.js` のほかに `js/edit/PositionInputEditor.js`（`computeVertexHandlesBounds`）も import している（使う側の列挙は網羅の列挙と読む）。不足する `PositionInputEditor` は同じ資料の `PROJECT_ARCHITECTURE.md:195`（Phase 08-04 の文「`edit/PositionInputEditor`が使う」）と `:202`（Phase 08-04 の向きの文「`edit/PositionInputEditor → core/NudgeTargetRules`・`core/VertexHandleRules`」）に書かれている。
* **（タスク2）（対象：`PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」`core/`（195行）、Phase 08-01 の文）**：「`InputModes`（`InputState`・`OperationMode`の値の定義。`InputTracker`・`KeyboardShortcuts`・`ToolRules`・`CursorShapeRules`・`main.js`が使う）」 → `js/` で `InputModes.js` を import するのは8ファイル。左の5つのほか `js/core/NudgeTargetRules.js`・`js/core/VertexHandleRules.js`・`js/wiring/ToolIconWiring.js` も import している（`js/core/NudgeTargetRules.js:5`・`js/core/VertexHandleRules.js:5`・`js/wiring/ToolIconWiring.js:8`。使う側が3件足りない）。不足する3件は同じ資料の `PROJECT_ARCHITECTURE.md:202`（Phase 08-02a・08-03 の向きの文：`wiring/ToolIconWiring → core/InputModes`、`VertexHandleRules`は`InputModes`の`OperationMode`のみimport、`core/NudgeTargetRules → core/InputModes`）に書かれている。
* **（タスク2）（対象：`PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」`core/`（195行）、Phase 08-03 の文）**：「`NudgeTargetRules`（…`edit/NudgeEditor`だけが使う。…）」 → `js/edit/NudgeEditor.js:6` のほかに `js/edit/PositionInputEditor.js:6`（`import { resolveNudgeTarget } from '../core/NudgeTargetRules.js'`）も使う。不足する `PositionInputEditor` は同じ資料の `PROJECT_ARCHITECTURE.md:202`（Phase 08-04 の向きの文「`edit/PositionInputEditor → core/NudgeTargetRules`」）に書かれている。
* **（タスク2）（対象：`PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」`core/`（195行）、Phase 07-03 の文）**：「`ViewFitRules`（…）・`StatusReadoutRules`（…）。この2つは`wiring/DisplayWiring`だけが使い」 → `ViewFitRules` は `js/wiring/DisplayWiring.js` のみで一致するが、`StatusReadoutRules` は `js/wiring/DisplayWiring.js:6` のほかに `js/edit/PositionInputRules.js:6` も import している。不足する `edit/PositionInputRules` は同じ資料の `PROJECT_ARCHITECTURE.md:195`（末尾の Phase 08-04 の文）と `:202`（「`edit/PositionInputRules → core/StatusReadoutRules`」）に書かれている。
* **（タスク2）（対象：`PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」`wiring/`（200行））**：「判定・計算の規則は持たず、`core/`の規則・`palette/`の部品・`edit/`の照会を呼ぶだけ」 → `js/wiring/ToolIconWiring.js:5-6` が `asset/sprite/select-arrow.js`・`asset/sprite/vertex-arrow.js` を import し、`js/wiring/ToolIconWiring.js:39` で `sprite.draw(ctx)` を呼ぶ（呼ぶ先の列挙は網羅の列挙と読む。`asset/sprite/` が列挙に無い）。不足分は同じ資料の `PROJECT_ARCHITECTURE.md:202`（Phase 08-02a の向きの文「`wiring/ToolIconWiring → asset/sprite/*.js`」）に書かれている。また `DisplayWiring` も、呼ぶ先の `core/` が「規則」に限られない：`js/wiring/DisplayWiring.js:10` が規則ではない `core/ViewTransform`（責務JSDoc `js/core/ViewTransform.js:2-3`＝ビュー変換状態の保持・変換・変更通知）を import し、`js/wiring/DisplayWiring.js:192` で `ViewTransform.MIN_SCALE`・`ViewTransform.MAX_SCALE` を使う。さらに注入された `core/` の状態オブジェクトのメソッドを呼ぶ：`displayState.toggleOutline()`・`toggleBackground()`・`toggleGrid()`（`js/wiring/DisplayWiring.js:79-81`）・`toggleFloatWindows()`（`:95`）・`onChange`（`:83`・`:96`）・`getState()`（`:156`）・`isFloatWindowsVisible()`（`:176`）、`unitSnapSettings.toggleEnabled()`・`toggleUnit()`（`:88-89`）・`onChange`（`:72`・`:91`）・`getActiveStep()`（`:127`）・`getState()`（`:166`）、`viewTransform.onChange`（`:71`・`:74`）・`getScale()`（`:146`）・`setView(...)`（`:194`）、`cursorTracker.onChange`（`:70`）・`getWorldPosition()`（`:126`）・`isCtrlPressed()`（`:127`）、`model.onChange`（`:73`）（`DisplayState`・`UnitSnapSettings`・`ViewTransform`・`CanvasCursorTracker`・`VectorModel` は `js/core/` の状態を持つクラス）。`core/ViewTransform` の import は同じ資料の `PROJECT_ARCHITECTURE.md:202`（「`wiring/DisplayWiring`はほかに`edit/ShapeExtentReader`・`core/StatusReadoutRules`・`core/GridSpacingRules`・`core/ViewFitRules`・`core/ViewTransform`・`palette/ViewToggleGroup`をimportする」）が補っているが、`:202` の文は import の列挙で、状態オブジェクトのメソッドの呼び出しには触れていない。
* **（タスク2）（対象：`PROJECT_ARCHITECTURE.md` 1章「フォルダ分割の方針」「依存方向」（202行））**：「`wiring/`は`palette/`・`edit/`・`core/`をimportする（`main.js → wiring → palette / edit / core`。…）」 → `js/wiring/ToolIconWiring.js:5-6` が `../../asset/sprite/select-arrow.js`・`../../asset/sprite/vertex-arrow.js` を import している（import 先の列挙は網羅の列挙と読む。`asset/sprite/` が列挙に無い）。不足分は同じ資料の `PROJECT_ARCHITECTURE.md:202` の後段（Phase 08-02a の向きの文「`wiring/ToolIconWiring → asset/sprite/*.js`」）に書かれている。

## 6. 懸念事項・今後の修正における注意点
* (タスク18で、4章の各タスクの「推測・所見」の「読み方が分かれる記述」と「照合できなかった主張」を、一覧（資料のファイルと節・要点・タスク番号）としてまとめる。あわせて、調査結果を踏まえ今後の修正で注意すべき点があれば記述する。特になければ「特になし」とする)
