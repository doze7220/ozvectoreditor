# 作業指示書 REQ: Interrupt : Phase 11 クローズの開発資料の相違の修正（相違65項＋追加14件＋コードのコメント・テストの残り19か所）
* ルール: `./PROJECT_CONSTITUTION.md`
* 開発資料: `./PROJECT_ARCHITECTURE.md`

## 【作業手順（厳守事項）】
本プロンプトは「計画立案」のみを目的とする。**絶対にファイルの書き換えを行わないこと。** 計画立案のみに留めること。

1. ルール（`PROJECT_CONSTITUTION.md`）および開発資料（`PROJECT_ARCHITECTURE.md`）を熟読・把握すること。
2. 本REQの【入力：相違一覧の所在と読む範囲】に従い、直す対象の相違一覧を読むこと。
3. 以下の【実装要件】を満たす作業計画を立案し、AIがハルシネーションを起こさない適切なスコープを持つ細かなタスクリストを構築すること。
4. 計画を出力する前に内部で自己監査を行い、ルール・開発資料の責務違反や、本REQの【変更してはならないもの】への違反がないか確認して計画を純化すること。（※監査プロセスのテキスト出力は不要）
5. 監査を通過した計画を、作業計画書テンプレート（`./_log/TEMPLATE_RES_ImpretonPlan.md`）に完全に準拠したフォーマットで、作業計画書（`./_log/res/YYMMDD_HHMM_RES_Interrupt_Phase11_Close_Doc_Fix.md`）として新規作成し出力すること（※YYMMDD_HHMMは作業実行時の現在日時）。RES冒頭の「参照元REQ」には本ファイル（`./_log/req/261126_0220_REQ_Interrupt_Phase11_Close_Doc_Fix.md`）を記載すること。
6. チャットにて「計画書の作成が完了しました。タスクを実行するための新しいチャットへ移行してください」と報告すること。

## 【背景と確定事項】
Phase 11 のクローズに伴う開発資料の整合確認（Survey）で、開発資料の記述と実コードの相違が **延べ65項**（重複を除き56件）見つかった。本作業は、その **全項** と、Surveyの6章で「読み方が分かれる記述」とされたもののうち今の事実と取り違えやすい **14件（A1〜A14）**、コードのコメントとテストの残り **19か所（C1〜C19）** を直すものである。

以下は発注者の決定（2026-11-26）であり、変更してはならない。

* **5章の相違はすべて直す**。「だけ」の文字どおりの誤りや列挙の取りこぼしも、断定の誤りと同じ扱いで直す。開発資料の第一の目的はハルシネーションの防止である。
* **「読み方が分かれる記述」からは、A1〜A14だけを直す**。6章のほかの項目には触れない。
* **`16_test.md` 235行の「Node.js v24.20.0で確認」は直さない**（過去の確認の記録。Phase 10 のクローズでも残した）。
* **コードのコメント・テストは C1〜C19 だけを直す**。`js/`・`test/` で変えてよいのは、C1〜C19 のコメント・JSDoc・テストの題の文字と、C19 の不要な1行の削除だけである。**コードのふるまいは一切変えない。**
* **テストプレイは行わない**（画面のふるまいが変わらないため）。

## 【入力：相違一覧の所在と読む範囲】
直す対象の正本は、Survey の作業レポートである。

* ファイル：`./_log/res/261126_0019_RES_Survey_Phase11_Doc_Consistency.md`
* **このファイルは約610KBある。全体を読まないこと。** 次の範囲だけを読む。
  * **5章『開発資料との相違』＝1380行〜1444行**（1行＝1項。「（タスクn）**（対象：資料のファイルと節・行番号）**： 資料の記述 → 実コードの実態（`ファイル:行`）」）。1371〜1379行は重複の一覧。
  * 5章の記述だけでは直せない箇所があった場合に限り、4章の該当タスクの欄を読む。4章の各タスクの見出しの行番号：タスク1＝366、2＝390、3＝438、4＝471、5＝519、6＝552、7＝595、8＝672、9＝713、10＝759、11＝826、12＝860、13＝972、14＝1055、15＝1111、16＝1194、17＝1242、18＝1318。
  * 6章（1446行以降）は読まなくてよい（A1〜A14・C1〜C19は本REQに書いた）。
* 本REQでは、5章の項を**上から数えた番号（No.1〜No.65）**で指す。**No.n は (1379＋n) 行**である（No.1＝1380行、No.65＝1444行）。
* 資料・ソースの行番号はSurveyの時点のもので、本作業の開始時点でも同じである。作業の途中で行がずれるため、各タスクでは行番号ではなく記述の文言で箇所を特定すること。
* 同じ記述を指す項（1か所の直しで済むもの）：No.2と37（673行）、No.4と58（685行）、No.15と38（859行）、No.44と57（`16_test.md` 10行）、No.36と45（同30行）、No.39と48（同162行）、No.40と49（同172行）、No.41と50（同180行）、No.42と51（同191行）。

5章の記述と実コードが食い違う場合（Survey の調査自体が誤っていた場合）は、その箇所を直さず、相違点を報告して指示を待つこと。

## 【共通の直し方の原則】
1. **列挙の取りこぼし**：実コードの実態に合わせて不足分を足す。不足分が同じ資料の別の文に書かれている場合も、参照で済ませず、この列挙にも足す。
2. **断定・限定の文**（「だけ」「のみ」など）：実態と合わなければ、断定を外すか、範囲を限って正しい断定にする（例：「図形の並びの状態は`#items`だけ」）。その断定が**設計として守りたい約束**だった場合は、約束そのものは残す（どちらとも決められなければ、直さずに報告する）。
3. **版の古い値**：作業データの現行は**版4**、書き出し形式の現行も**版4**。過去のPhaseで「版を上げなかった」という経緯を述べる文は、**そのPhaseの時点の値だと分かるように書き添える**（例：「版は当時の2のまま」）。テストの説明のように今のコードの値を述べる文は、今の値に直す。表現は資料の中でそろえる。
4. **表示・ロックの対象**：描画・⛶は「見えている図形」、選択に対する編集と外枠は「選択中で変えられる図形（見えていてロックされていない）」という実態に合わせる。語は既存の資料の言い方（「見えている図形」「変えられる図形」）にそろえる。
5. **過去の時点の記述**：その時点の記録として正しい文は、経緯として残してよい。今の事実と取り違えるものは、時点を書き添えるか、今の値に直す。
6. **行末を保つ**：CRLFとLFのファイルが混在している。書き換える前にバイト数で実測し、行末を変えないこと（`grep -c $'\r$'` は誤った数を返すことがあるので使わない）。実測値：CRLF＝`PROJECT_ARCHITECTURE.md`・`_doc/arch/01`・`02`・`03`・`06`・`08`・`12`・`13`・`14`・`15`・`16`・`61`・`js/main.js`・`js/core/InputTracker.js`・`KeyboardShortcuts.js`・`InputModes.js`・`js/shapes/EndpointSnapRules.js`・`PathJoinRules.js`・`test/core/ItemPlaceRules.test.js`・`test/edit/ShapeInserter.insertTarget.test.js`。LF＝`_doc/arch/07`・`46`・`js/core/VectorModel.js`・`ListSelectionRules.js`・`ItemListRules.js`・`js/wiring/DisplayWiring.js`・`ItemListWiring.js`・`js/palette/ItemListPanel.js`・`test/io/DocumentSerializer.roundtrip.test.js`。
7. **既存の表記を崩さない**：バッククォートの付け方、箇条の形、節の順序、言い回しの調子は既存にそろえる。修正に必要のない箇所は1文字も変えない。
8. **長くしない**：文が伸びるときは、同じ文の冗長な表現を削って差し引きを取る。事実は落とさない。
9. **経緯の付記には触れない**：「（Phase 11-0x）」「発注者の決定」などの付記は、内容を変える必要がなければそのまま残す。
10. **同じ誤りの書き写し**：直す文と同じ誤りが、同じファイルの中に別の言い方で残っていないかを確かめ、あれば同じように直して作業レポートに書く（別のファイルで見つけたものは、直さずに5章へ報告する）。

## 【実装要件】

### 要件1: `PROJECT_ARCHITECTURE.md` 1章・2章（No.1・3・5・8・9・54・59・60・61、A1・A2・A3・A4・A5）
* No.1・3・5・8（392行のほう）・9（443・451行）・54・59・60・61：5章のとおり。No.8 は、要件4の `15_io.md` 37行と書き方をそろえる。
* **A1（1章の構成図 57・61・66行の「〜から使う」）**：今のimport元をすべて挙げる。57行 `ItemTreeRules`＝`core/`の`VectorModel`・`ItemAttributeRules`・`ItemRowRules`・`ItemPlaceRules`・`ItemStateRules`・`InsertTargetRules`・`GroupTreeRules`・`GroupSelectionRules`・`GroupCollapseRules`・`ListDragRules`・`RemovalRules`、`edit/GroupEditor`、`io/DocumentSerializer`・`io/SpriteSerializer`（No.1と同時に直す）。61行 `GroupTreeRules`＝`ItemStateRules`・`RemovalRules`・`SoloVisibilityRules`を足す。66行 `GroupSelectionRules`＝`InsertTargetRules`・`edit/ClipboardController`・`wiring/ItemListWiring`を足す。書く前に `js/` のimportを自分で検索して確かめること。
* **A2（309行）**：「`VectorModel`が唯一の持ち主として呼ぶ」を、描き込む先の値の持ち主が`VectorModel`だけであること（この約束は残す）と、規則をimportするのは`VectorModel`・`edit/ClipboardController`・`wiring/ItemListWiring`の3つであることが分かる文にする。
* **A3（316行）**：「**例外（Phase 11-02）**：規則どうしの`ItemListRules → ItemTreeRules`・`InputModes`」を、今は`ItemListRules → InputModes`だけであること（行の並びは`ItemRowRules`へ移った。Phase 11-04a）に合わせる。同じ行の末尾「`shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`のJSDocの「`model.getShapes()`の並び」は、`shapes/`を変えないため残る（…）」は、C13・C14で直るため消す（渡るのが変えられる図形の並びであるという事実は、同じ行か3章に残っていることを確かめ、無ければ短く残す）。
* **A4（306行）**：キー`Home`/`PageUp`/`PageDown`/`End`が「選択中の図形1つずつに働くまま」を、選んでいるフォルダも1つのまとまりとして兄弟の並びごとに動かす実態（Phase 11-04a）に合わせる（「やらないこと」としての意味が残るなら残し、残らなければ消す）。
* **A5（451行）**：`targetsNewGroup`の説明の「選ばれている図形があれば規則(1)が優先」を、選んでいるフォルダも含む「選んでいるまとまりがあれば」に直す。

### 要件2: `PROJECT_ARCHITECTURE.md` 3章1.〜27.（No.2・4・14・15・18・37・38・58、A6・A7・A8・A9）
* No.：5章のとおり。
* **A6（655・659行）**：「選択中の図形の重なり順」「選択中の各図形は並びの上で隣の1つ分だけ動く」を、兄弟の並びごとに選んでいるまとまり（フォルダを1つのものとして含む）が動く実態に合わせる。「全図形が選択中のときは何もしない」も、実コード（`edit/ShapeOrderEditor`・`edit/ShapeOrderRules`）の実態に合わせる。
* **A7（665行）**：`removeSelection()`の「まとまりが無ければ`beginEdit`も呼ばず`false`」に、何も消えないとき（変えられないものだけ）も同じであることを足す。
* **A8（696・711・760・773・790・896行）**：原則3（版の値を当時の値と分かるようにする。896行は「版3」「版4」）。
* **A9（788・806・915行）**：「選択の外枠（`ShapeExtentReader`）」を、実際に読むもの（788・915行＝線を含まない外枠 `getSelectedGeometryBounds`、806行＝図形ごとの外枠 `getSelectedBoundsPerShape`）に直す。

### 要件3: `PROJECT_ARCHITECTURE.md` 3章28.（No.24〜27・30〜32、A10・A11・A12）
* No.24（945行(k)）：空のフォルダも選べる実態がはっきり読める文にする。No.25（918行）・26（921行）・27（924行）・30（929行）・31（931行）・32（934行）：5章のとおり。No.31 は、貼り付け（描き込む先が自分のコピーのフォルダの中なら、そのフォルダのすぐ上＝`resolvePastePlace`）も書き分ける。
* **A10（918・930行の「変えていない」）**：そのPhase（11-02・11-03）の時点で変えなかった、という経緯だと分かるようにする（No.27と書き方をそろえる）。
* **A11（935行）**：フォルダの行にも末尾に目・鍵のアイコンがあること（Phase 11-05）を足す。929行の「**フォルダがあっても始まる**＝Phase 11-04aの引数`hasGroups`は消した）」の括弧の欠け（開きが無い）を直す。
* **A12（942行）**：確認の状況（Phase 11-03）の`ItemTreeRules.insertItemsAbove`・`ShapeOrderEditor.applyOrder`に、Phase 11-04bで消えたことを書き添える。

### 要件4: `_doc/arch/02`・`03`・`06`・`08`・`15`（No.7・8・10〜13・16・17・43・55・62・63、A13）
* No.7（`15_io.md` 28行）・8（`15_io.md` 37行）・10〜13・55（`03_VectorModel.md`）・16・43・62（`02_main.md`）・17（`08_HistoryManager.md`）・63（`06_InputTracker.md`）：5章のとおり。
* **A13（`15_io.md` 9・10行、`12_shapes.md` 89行）**：「作業データの版は2（のまま）」「書き出し形式（書き出し）の版は3のまま」を原則3で直す（`12_shapes.md` はこの1か所だけを変える）。
* `06_InputTracker.md` 44行が、C1の古い説明を「古い」と断っている場合は、C1で直ることに合わせてその断りを消す。

### 要件5: `_doc/arch/01`・`07`・`13`・`14`・`46`・`61`（No.6・19〜23・28・29・64・65、A14）
* No.6（`46_ItemTreeRules.md` 11行）・19（`07`）・20・65（`14_edit.md`）・21・64（`13_palette.md`）・22・23（`01_index_html.md`）・28・29（`61_ItemRowRules.md`）：5章のとおり。
* No.28 の幅の見積もりは、`index.html` のCSSの値から計算し直し、計算に入れたものを文に書く（実測ではないことも分かるようにする）。「どちらも名前が読める」は、計算し直した値で言えなければ外す。
* **A14**：`46_ItemTreeRules.md` 10行の「使う側」に、今のimport元の不足分（`core/ItemPlaceRules`・`core/InsertTargetRules`・`core/ItemStateRules`・`core/ListDragRules`・`core/RemovalRules`）を足す。`14_edit.md` 137行の「`edit/`から`core/`をimportする8つ目の例外」を、Phase 11-02の時点の数だと分かるようにするか、数を外す。

### 要件6: `_doc/arch/16_test.md`（No.33〜36・39〜42・44〜53・56・57）
* No.36・39〜42・45〜51：原則3（今のテストの値＝版4に直す。130行の`checkFormat`は版1〜4、131行は版4）。No.51 の弧は、205行と食い違わないようにする。
* No.44・57（10行の例外の数）：今の`test/edit/`・`test/core/`を数え直し、数え方（何を例外に数えるか）を文に書いて、列挙と数を合わせる。数を保つのが難しければ、数を外して列挙だけにしてよい。242・253行などの「例外の数え方に加わる」とも食い違わないようにする。
* No.56（8行の`globalThis`の例外）・No.33・34・35・52・53：5章のとおり。
* **259〜265行（Phase 11-03の項）**：今のHEADに無い関数（`resolveInsertTarget`・`resolveInsertMarkId`・`toDrawOrder`・`isSameOrder`・`applyOrder`・`insertItemsAbove`）が、今は無いこと（Phase 11-04bで置き換えた・消した）を、項の中の1文で断る。
* **テストの件数の記載**（No.13・52・53・56・57に関わるもの以外）は変えない。235行は変えない。

### 要件7: コードのコメント・テストの残り（C1〜C19。動きは変えない）
行数が資料（`02_main.md`・`06_InputTracker.md`・`COWORK_STATUS.md`）に書かれている `js/main.js`（1234行）・`js/core/InputTracker.js`（2023行）は、**行数を変えない**。
* **C1** `js/core/InputTracker.js` 1081行付近：「描き込む先のすぐ上へ入り、描き込む先が無ければ末尾」を、今の描き込む先の3つの形（行の上・フォルダの中・フォルダの一番下）に合わせる。
* **C2** `js/core/InputTracker.js` 412行：第7引数の項目の列挙に`deleteSelectedItems`を足す。
* **C3** `js/core/KeyboardShortcuts.js` 54・55・82・86行付近：`selectAll`・`deleteSelection`・`invertSelection`・`resetColors`の「全図形」を、今の対象（変えられる図形）に合わせる。`deleteSelection`は選んでいるフォルダも対象であることを含める。書く前に実コードの対象を確かめること。
* **C4** `js/core/InputModes.js` 11行：`MOVING_SELECTION`の「選択集合の全図形」を「選択中の変えられる図形」に合わせる。
* **C5** `js/wiring/DisplayWiring.js` 183行：「全図形の外枠」→「見えている図形の外枠」。
* **C6** `js/core/VectorModel.js` 189〜190行・1257〜1259行：採番の経路の列挙に`rearrangeItems`（新しいフォルダ）を足す。
* **C7** `js/core/VectorModel.js` 1156行：用途の列挙に、行のドラッグでの移動（フォルダへの出し入れ。Phase 11-04b）を足す。
* **C8** `js/main.js` 343行：「ここでmodel.deleteShapesを直接呼ばないこと」を、削除の実体（`GroupEditor.removeSelection`）を直接呼ばず`inputTracker.deleteSelection()`を通す、という今の約束に合わせる。
* **C9** `js/core/ListSelectionRules.js` の`resolveListClickSelection`のJSDoc・typedef（6〜29行）：「図形id」を、行のid（図形またはフォルダ）に合わせる。書く前に呼び出し側（同ファイルの`resolveRowClickSelection`）を確かめること。
* **C10** `js/wiring/ItemListWiring.js` 38行：一時的な値の列挙に、描いたサムネイルの鍵・同期の予約を足す。
* **C11** `js/wiring/ItemListWiring.js` 73行：`#hoveredRowId`の説明。実コードを確かめ、フォルダのidが入らないなら、そのことが分かる書き方（例：「図形id（フォルダの行では記録しない）」）にする。入りうるなら行のidに直す。
* **C12** `js/palette/ItemListPanel.js` 536行：`startNameEdit`の`@param id`を、図形またはフォルダのidに直す。
* **C13** `js/shapes/EndpointSnapRules.js` 77・141行、**C14** `js/shapes/PathJoinRules.js` 271行：「`model.getShapes()`の並び」を、今渡るもの（変えられる図形だけの並び）に合わせる。**`shapes/`から`core/`を参照する書き方（import・型参照）を足さないこと**（文中で名前に触れるのは今と同じくよい）。
* **C15** `js/core/ItemListRules.js` 171行付近：`resolveRowHover`の`@param id`の「図形 id」を、行のid（図形またはフォルダ）に直す。
* **C16** `test/io/DocumentSerializer.roundtrip.test.js` 432行：`describe`の題「（作業データの版2）」を外すか今の値（版4）に直す。
* **C17** `test/core/ItemPlaceRules.test.js` 136行：`describe`の題から、無くなった関数名`insertItemsAbove`を外す。
* **C18** C16・C17で変えた題が、資料（`16_test.md`）に書かれていれば、要件6とあわせてそろえる。
* **C19** `test/edit/ShapeInserter.insertTarget.test.js` 305行：不要な`assert.ok(inserter);`の1行を消す（`inserter`が使われなくなるなら、その取り出しも合わせて消してよい。確かめる内容は変えない）。

### 要件8: 確認
* 変えた`js/`のファイルを`node --check`で確かめる。
* プロジェクトのルートで`node --test`を実行し、全件成功すること（**変更前は tests 3699 / suites 609 / fail 0。件数は変わらないはず**）を確かめ、件数を作業レポートに記す。
* `git diff`で、`js/`の変更がコメント・JSDocだけであること、`test/`の変更がC16・C17・C19だけであること、`index.html`・`sprite-check.html`に変更が無いことを確かめる。
* `js/main.js`・`js/core/InputTracker.js`の行数が変わっていないことを確かめる。
* 触った全ファイルの行末が変わっていないことを、バイト数で確かめる。
* No.1〜No.65・A1〜A14・C1〜C19が**すべて処理されたこと**を、番号を並べて作業レポートに記す。直せなかったもの・直さないと判断したものがあれば、番号と理由を書く。

## 【変更してはならないもの】
* `PROJECT_CONSTITUTION.md`・`_doc/COWORK_STATUS.md`・`_doc/COWORK_STATUS_CLOSED.md`・`_doc/PROJECT_AI_WORKFLOW.md`・`_doc/PROJECT_MILESTONE.md`・`_doc/PROJECT_PHASE_TRANSITION_CLEANUP.md`・`_log/`の既存ファイル（本作業のRESを除く）。
* `index.html`・`sprite-check.html`・`asset/`、`js/`・`test/`のすべて（C1〜C19を除く）。
* 本REQが要件で挙げていない`_doc/arch/`のファイル。
* `PROJECT_ARCHITECTURE.md`の、要件1〜3が挙げていない文（原則10の同じ誤りを除く）。
* 章番号・節の順序。
* 修正に必要のない整形・字句の統一・行末の変換・無関係な記述の削除。
* エンジンのリポジトリ（`D:\ozlab\ozengine-web`）。読む必要もない。

## 【計画書に必ず含めるべきタスクごとの作業】
* **本作業は開発資料の修正そのものが目的である。** テンプレートの「実装AIによる開発資料の書き換えは原則禁止、最終タスクのみ例外」という定めは、本作業には適用しない。**各タスクで、そのタスクが担当する資料を直す。**
* タスクは**ファイル単位**で分ける（`PROJECT_ARCHITECTURE.md`は要件1〜3の章の分け方で、さらに分けてよい）。1タスクで扱う資料ファイルは4つまで、直す箇所は10か所までを目安とする。同じファイルを触るタスクを並べて実行しない。
* 要件7は、`js/`と`test/`を資料とは別のタスクにする。
* 各タスクの終わりに、作業レポート（本RESファイル）の詳細作業内容へ、**直した番号（No.・A・C）と、直した前後の記述の要点**を記載する。
* 各タスクで、直した記述が同じ資料の別の箇所・別のファイルと矛盾していないかを確かめる。
* 各タスクの終わりに、触ったファイルの行末が保たれていることを、バイト数で確かめる。

## 【計画書に必ず含めるべき固定タスク】
全タスクの後に、次のタスクを必ず含めること。
* 要件8の確認。
* 「懸念事項・要確認ポイント」欄に、判断に迷った点、資料の別の箇所との整合で気づいた点を記述する。

## 【計画立案時の絶対遵守ルール (Constraints)】
* **アーキテクチャの維持**：本作業はコードのふるまいを変えないため、設計の変更提案を計画に含めてはならない。資料の記述を実コードに合わせるのが唯一の方向であり、**コードを資料に合わせて直す**ことはしない。
* 資料を長くしないこと（共通の直し方の原則8）。

## 【今回やらないこと（スコープの境界）】
* テストを足すこと・テストの期待値を変えること。
* 使われなくなった関数（`VectorModel.deleteShapes`・`getInsertTargetId`）を消すこと（既存のテストが使うため残す。発注者の決定）。
* Survey 6章のA1〜A14以外の「読み方が分かれる記述」、C1〜C19以外のコメント（`js/shapes/`の契約の番号、`main.js`の`renderCurrentState`のJSDoc、`ItemListPanel.js` 2行、`FileContentReader.test.js`の題など）。
* `PROJECT_ARCHITECTURE.md`のスリム化（クローズの片付けで、現場設計セッションが行う）。

## 【関連する責務】
本作業は資料の記述を実コードに合わせるものであり、責務の判断を要しない。資料の記載基準は`PROJECT_ARCHITECTURE.md`の冒頭のとおりで、要点は次のとおり。

* 第一の目的はハルシネーションの防止、第二がコンテキストの削減。第二のために第一を犠牲にしない。
* 残す：責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路。
* 書かない：1つのファイルのJSDocを読めば分かること（引数と戻り値、private項目、typedefの中身、定数の値、1クラス内の処理順）。
* 消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。
