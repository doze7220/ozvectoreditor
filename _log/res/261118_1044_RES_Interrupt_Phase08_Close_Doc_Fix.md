# RES: 作業計画・作業レポート Interrupt : Phase 8 クローズの開発資料の相違の修正（資料57件＋コードのJSDoc1件）
* 参照元REQ: `./_log/req/261118_1023_REQ_Interrupt_Phase08_Close_Doc_Fix.md`

## 1. 作業目的
Phase 8 のクローズに伴う開発資料の整合確認（Survey。`./_log/res/261117_1934_RES_Survey_Phase08_Doc_Consistency.md` の5章）で見つかった、開発資料の記述と実コードの相違64件のうち、**58件**を直す。内訳は資料の修正57件（No.1・2、No.9〜26、No.28〜64）と、コードのクラスJSDocの修正1件（No.27。`js/edit/ShapeExtentReader.js`）。No.3〜8（`PROJECT_ARCHITECTURE.md` 1章の192行・194〜201行・202行）は本作業の対象外。

* 方向は**資料を実コードに合わせる**だけ。コードのふるまいは一切変えない。変える `.js` は `js/edit/ShapeExtentReader.js` のクラスJSDocのコメント1行のみ。
* 番号 No.N は、Survey の5章の箇条を上から数えた番号（No.1＝1489行、No.N＝(1488＋N)行、No.64＝1552行）。本計画では各タスクに番号と、Survey の該当行を示す。直すときに相違の根拠（実コードの行）を見たいときは、Survey の該当の1行だけを読む（`sed -n '<行>p'`。ファイル全体は約940KBあるので読まない）。
* テストプレイは行わない。確認は `node --check` と `node --test` の件数で行う（変更前の実測：tests 1543 / suites 230 / pass 1543 / fail 0。計画立案時に実行して確かめた）。

## 2. アーキテクチャ設計

### 全タスクに共通の約束（各タスクの実行前に必ず読む）
1. **変更してよいファイルは、そのタスクの「対象ファイル」だけ**。それ以外のファイル（`index.html`・`test/`・`js/`〔タスク9の1行を除く〕・`asset/`・`PROJECT_CONSTITUTION.md`・`_doc/` の arch 以外・`_log/` の既存ファイル・REQが挙げていない `_doc/arch/` のファイル）は1文字も変えない。本RESへの記入は各タスクで行ってよい。
2. **`PROJECT_ARCHITECTURE.md` の192行・194〜201行・202行には触れない**（No.3〜8は対象外。多重表記の排除の別工程で扱う）。
3. **行を足さない・消さない**。どの修正も既存の1行の中で行う（本計画の行番号がタスクをまたいで有効なままになるように）。
4. **行末を保つ**（計画立案時に `tr -cd '\r' < ファイル | wc -c` で実測した。REQの説明と一部違うが、**実測を正とする**）：
    * **CRLF**：`PROJECT_ARCHITECTURE.md`・`_doc/arch/01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`08_HistoryManager.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`16_test.md`
    * **LF**：`_doc/arch/06_InputTracker.md`・`32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`・`36_DisplayWiring.md`・`38_VertexHandleRules.md`・`41_NudgeTargetRules.md`・`js/edit/ShapeExtentReader.js`
    * 確かめ方：編集後に `tr -cd '\r' < ファイル | wc -c` と `wc -l < ファイル` を比べる（CRLFのファイルは両者が等しい、LFのファイルは前者が0）。あわせて `git diff --stat -- ファイル` で変更行数が直した行の数だけであること（全行の差分になっていないこと）を確かめる。一括置換・ファイル全体の書き直しはしない（`Edit` で該当箇所だけを置き換える）。
5. **共通の直し方の原則**（REQの8項目の要約。迷ったらREQの【共通の直し方の原則】を読む）：①列挙の取りこぼしは、別の箇所に書いてあってもこの列挙に足す。②断定・限定（唯一・だけ・のみ・N か所）は外して実態を書く。設計の約束だった場合は約束の意図を残す。③到達不能の枝は消さず「現在は呼ばれない」と去就を決めるPhaseを書く。④数値は実測。コード側のコメントが古いときは資料だけ直し、その旨を1文添える。⑤テストの列挙は実際の `it`／`describe` に合わせる。⑥行末を保つ。⑦既存の表記（バッククォート・箇条・言い回し）を崩さない。必要のない箇所は1文字も変えない。⑧長くしない。足すときは同じ節の冗長な表現を削って差し引きを取る（ただし情報を消して差し引きを取らない。「消すか迷ったら残す」が優先）。
6. **文案の扱い**：以下の各タスクの「文案」は、直す内容（足す事実・外す断定）の正本である。前後の文とのつながり・既存の表記にそろえるための字句の調整はしてよいが、**事実を足したり減らしたりしない**。
7. **事実の確かめ**：各修正の前に、文案が挙げる実コードの事実を `grep`／`sed -n` で確かめる（行番号は計画立案時の値。ずれていても中身が同じならよい）。**Survey の記述と実コードが食い違ったら、その箇所は直さず、本RESの5章に相違点を書いて、最終報告の「質問:」で指示を待つ**（REQの指示）。計画立案時に主要な事実（`KeyboardShortcuts.js:295`、`main.js:809・884`、`InputTracker.js:834・1142` の `#beginMoveSelection`、`Ellipse.js:259`・`Line.js:112` の `'move'`、`InputModes.js` をimportする `js/` 8件・`test/` 6件、`ShapeFactory.js` をimportする6件、`new ShapeExtentReader` の2件、ツールパレットのCSSの積み上げ337px、`main.js` 988行・`InputTracker.js` 1579行、`resolveVertexPressAction` の引数）は確かめ、Survey と一致した。
8. **各タスクの終わりに**：本RESの「4. 詳細作業内容」の該当タスクの欄に、直した相違の番号（No.N）と、直した前後の記述の要点を書く。「2か所をそろえる」指示がある箇所は、もう一方の記述と内容が合っていることを確かめて書く。行末の確認結果も書く。

### 要件1・2・5：`PROJECT_ARCHITECTURE.md` 1章構成図・3章3./12./15./16./17.（タスク1。No.1・2・9・10・11・12・13・59・60・61）
* **No.1**（29行。構成図 `InputModes.js` の行。Survey 1489行）：「InputTracker・KeyboardShortcuts・ToolRules・CursorShapeRules・VertexHandleRules・wiring/ToolIconWiring・main.jsから使う」→ `VertexHandleRules` の後に `NudgeTargetRules` を足す（この行はバッククォートなしの表記のまま）。
    * 文案：「InputTracker・KeyboardShortcuts・ToolRules・CursorShapeRules・VertexHandleRules・NudgeTargetRules・wiring/ToolIconWiring・main.jsから使う」
* **No.2**（42行。構成図 `NudgeTargetRules.js` の行。Survey 1490行）：「`edit/NudgeEditor`から使う」→「`edit/NudgeEditor`・`edit/PositionInputEditor`から使う」。行のほかの部分は変えない。
* **No.9・No.10**（332行。3.「キーボード操作」の末尾の「操作の実体は`main.js`から注入されたコールバック（…）で実行する。」の括弧の列挙。Survey 1497・1498行）：
    * No.10：「`InputTracker`の公開メソッド」の直後に、`Esc` の実体を書く。文案：「`InputTracker`の公開メソッド（`Esc`だけは実体が`styleEyedropper.cancelPicking`で、`inputTracker.cancelDraftOrClearSelection`はその`fallback`として渡されるだけ。16.）」
    * No.9：列挙の最後の「`displayState`の`toggleOutline`・`toggleBackground`・`toggleGrid`・`toggleFloatWindows`（15.）」の後に足す。文案：「/`nudgeSelection`（実体は`nudgeEditor.nudge`。19.）」
    * 事実：`main.js:809`（`cancel: () => styleEyedropper.cancelPicking(() => inputTracker.cancelDraftOrClearSelection())`）、`main.js:884`（`nudgeSelection: (delta) => nudgeEditor.nudge(delta.dx, delta.dy)`）。
* **No.12**（511行。16.「スポイト」の後半の括弧「（`InputTracker`は照会`isPickingShape`で関わるだけ。」。Survey 1500行）：→ 文案：「（`InputTracker`は照会`isPickingShape`と、注入された`pickShape`の呼び出しで関わるだけ。」（同じ資料の330行「注入された補助`isPickingShape`・`pickShape`だけで関わり」と合う形）。
* **No.13**（506行。16.「修飾キーを見る時点」の `Ctrl` の項。Survey 1501行）：「`Ctrl`（macOSは`⌘`。`event.ctrlKey || event.metaKey`）＝`click`・範囲選択の終了のイベント（確定の時点）。」→ 行を写さず**時点の種類**で整理する。文案：「`Ctrl`（macOSは`⌘`。`event.ctrlKey || event.metaKey`）＝選択の確定は`click`・範囲選択の終了のイベント、頂点の選択モードの押下（選ばれていない頂点を押したときに何も始めないかの判定。18.）は`mousedown`、スナップ・端点への吸い付きを止める読み取りは描き始めの`click`・描いている途中と図形作成モードのIDLEの`mousemove`・ドラッグの追従のたびのイベント（17.）、キーボードは`KeyboardShortcuts`の対応表を引く`keydown`と、`AltKeyGuard`が`Alt`の抑止を除く条件として読む`Alt`自身の`keydown`・`keyup`（`event.ctrlKey`だけ。3.）。」 同じ項の `Shift`・矢印キーの `Shift`・`Alt` の文は変えない。
* **No.11**（528行。17.「`Ctrl`を見る時点」の見出しの括弧。Survey 1499行）：「（`event.ctrlKey || event.metaKey`。`InputTracker.js`が`export`する`hasCtrlModifier`が**`Ctrl`（`⌘`を含む）の読み取りの唯一の定義**で、`main.js`が`CanvasCursorTracker`へ注入する。キーの購読は足さない）」→「唯一」を外し、マウス側を寄せる約束（二重に書かない）とキーボード側の独立の読み取りの両方を書く。文案：「（`event.ctrlKey || event.metaKey`。**マウスのイベントの`Ctrl`（`⌘`を含む）の読み取りは`InputTracker.js`が`export`する`hasCtrlModifier`に寄せ、二重に書かない**（`main.js`が`CanvasCursorTracker`へ注入する）。キーボードの`Ctrl`は`hasCtrlModifier`を使わず別に読む（`KeyboardShortcuts`の`#findBinding`は同じ式、`AltKeyGuard`は`event.ctrlKey`だけを`Alt`の抑止を除く条件に）。キーの購読は足さない）」
    * **2か所をそろえる**：この文案と同じ内容を、タスク5で `_doc/arch/06_InputTracker.md` 27行（No.38）に書く。タスク1ではこの文案のとおりに書き、詳細作業内容に**書いた文をそのまま**記録する（タスク5がそれに合わせる）。
    * 事実：`KeyboardShortcuts.js:295`（`const ctrlPressed = event.ctrlKey || event.metaKey;`）、`AltKeyGuard.js:31`（`if (event.key !== 'Alt' || event.ctrlKey || isTextInputElement(...))`。`metaKey` は読まない）、`InputTracker.js:138`（`hasCtrlModifier` の式）。`js/` で `ctrlKey`・`metaKey` を読むのはこの3か所（Survey 1499行）。No.13 のキーボードの記述も同じ2つ（`KeyboardShortcuts`・`AltKeyGuard`）を挙げる。
* **No.59**（323行。3.「端点への吸い付き」。Survey 1547行）・**No.60**（439行。12.の見出しの後の本文。Survey 1548行）：どちらも「選択モードで線の端点のハンドルをドラッグするとき」→「**頂点の**選択モードで線の端点のハンドルをドラッグするとき」（「頂点の」を足すだけ）。
* **No.61**（484行。15.「配色の組」の括弧「（`Curve.drawHandles`の点線は黒の背景でほぼ見えないが、ハンドル自体は見える。`drawHandles`の変更はやらないこと）」。Survey 1549行）：記述を消さず、現在は呼ばれないことと去就のPhaseを書く。文案：「（`Curve.drawHandles`の点線は黒の背景でほぼ見えないが、ハンドル自体は見える。**現在`drawHandles`はどのモードからも呼ばれない**（`main.js`が`render`の`showHandles`へ常に`false`を渡すため。去就は変形のPhaseで決める。18.）。`drawHandles`の変更はやらないこと）」
* 長さの差し引き：332行・506行・528行で文が伸びる。同じ節の中に、情報を失わずに削れる重複表現があれば削る。無ければ削らない（その旨を詳細作業内容に書く）。

### 要件3・4：`PROJECT_ARCHITECTURE.md` 3章18.〜21.（タスク2。No.15・16・19・21・22・23・24）
* **No.15**（551行。18.「モジュールの分担」。Survey 1503行）：「頂点のハンドルの一覧の組み立て・「頂点のハンドルか」の照会・矩形に入る頂点の収集は`core/VertexHandleRules`（`collectVertexHandles`・`isVertexHandle`・`collectVertexHandlesInRect`。状態なし。」→ 文案：「頂点のハンドルの一覧の組み立て・「頂点のハンドルか」の照会・矩形に入る頂点の収集・頂点の範囲は`core/VertexHandleRules`（`collectVertexHandles`・`isVertexHandle`・`collectVertexHandlesInRect`・`computeVertexHandlesBounds`（Phase 08-04。20.）。状態なし。」
* **No.16**（554行。18.「履歴・保存」。Survey 1504行）：「頂点の選択は、取り消し・やり直し・削除・キャンバスの切り替え・結合・貼り付け・`?dev`の復元・`setMode`で、」→ 文案：「頂点の選択は、取り消し・やり直し・削除・キャンバスの切り替え・結合・端点への吸い付きの確定・貼り付け・複製（`Ctrl`+`D`）・`?dev`の復元・`setMode`で、」（「結合」の後に「端点への吸い付きの確定」、「貼り付け」の後に「複製（`Ctrl`+`D`）」。既存の項目の順は変えない）。
    * **2か所をそろえる**：タスク4で `_doc/arch/03_VectorModel.md` 4行（No.48）に、同じ2項目を同じ位置（「結合」の後・「貼り付け」の後）へ足す。
* **No.19**（571行と575行。19.「まとめの区切り」と「発注者の決定」(2)。Survey 1507行）：
    * 571行：「(3)**取り消し/やり直し**（`undo`・`redo`が鍵を忘れる）。」の後に足す。文案：「(4)**キャンバスの切り替え**（`CanvasLibrary`の切り替え処理が`HistoryManager.clear()`で履歴と鍵を空にする。6.）。」（「区切りになるのは、(1)…(2)…(3)…(4)…。」の1文にする。句点の位置を合わせる）
    * 575行（発注者の決定の記録）：決定の文言はそのまま残し、括弧で事実を添える。文案：「(2) まとめの区切りは別の編集操作・選ぶ対象の変更・取り消し/やり直しのいずれか（キャンバスの切り替えも`HistoryManager.clear()`で区切りになる）。」
    * 事実：`CanvasLibrary.js:948-950`（`replaceAllShapes` の後の `this.#historyManager.clear()`）、`HistoryManager.js:256-259`。
* **No.21**（578行。20.の見出しの依存の矢印。Survey 1509行）：「→ `edit/PositionInputRules.js`・`edit/NudgeEditor.js`・`edit/ShapeExtentReader.js`・`core/VertexHandleRules.js`」の末尾に「・`core/NudgeTargetRules.js`」を足す。
* **No.22**（581行。20.「モジュールの分担」。Survey 1510行）：「頂点の範囲＝`core/VertexHandleRules.computeVertexHandlesBounds`。」の直前に足す。文案：「対象の決定＝`core/NudgeTargetRules.resolveNudgeTarget`（19.と同じ規則）。」
* **No.23**（593行。21.の見出しの依存の矢印。Survey 1511行）：「`palette/OptionBarAlignGroup.js` ⇄ `main.js` → `edit/ShapeAlignEditor.js` → `edit/ShapeAlignRules.js`・`edit/ShapeExtentReader.js`・`core/VectorModel.js`・`core/HistoryManager.js`」の後に、`main.js` から先を足す。文案：「…・`core/HistoryManager.js`、`main.js` → `core/InputTracker.js`（ドラッグ中の判定）・`core/VectorModel.js`（同期の購読）」
* **No.24**（596行。21.「モジュールの分担」。Survey 1512行）：「配線＝`main.js`の`// 7.11.`（生成・注入・同期のみ。判定・計算を持たない）」→ 文案：「配線＝`main.js`の`// 7.11.`（生成・注入・同期と、`performShapeAlign`のドラッグ中の受理判定（`inputTracker.isDragging()`なら`false`）。そのほかの判定・計算を持たない）」
    * **2か所をそろえる**：タスク3で `_doc/arch/02_main.md` 24行（No.35）を同じ趣旨にする。タスク2では書いた文をそのまま詳細作業内容に記録する。
    * 事実：`main.js:736-741`（`performShapeAlign`。`:737` の `if (inputTracker.isDragging()) { return false; }`）。
* 矛盾の確認：同じ21.の603行「ドラッグ中は受理しない」、595行「流れ（入力）」と合うこと。20.の580行の①（`resolveNudgeTarget`）と合うこと。

### 要件6・12（02:3）：`_doc/arch/01_index_html.md`・`02_main.md`・`36_DisplayWiring.md`（タスク3。No.28〜36）
* **No.28**（01:12。「ツールパレットの縦の範囲は1280×800で`y 68〜約410`（見出し約39px＋本体約301px＋枠2px。CSSコメントが正。ステータスバーの上端772pxより上）。」Survey 1516行）：数値を実測にし、「CSSコメントが正」をCSSコメントが古い旨に書き換える。文案：「ツールパレットの縦の範囲は1280×800で`y 68〜約446`（見出し約39px＋本体337px＋枠2px。ステータスバーの上端772pxより上。`index.html`の`#window-tool-palette`のCSSコメントは「約410」「本体約301px」のまま古い）。」 本体の内訳（余白・まとまりごとの高さ）は資料に書かない（記載基準の「書かない：定数の値」・原則8）。
    * 事実（計画立案時に確かめた。値の確かめにだけ使う）：`index.html` の `#window-tool-palette .window-body` の `padding: 6px`、`.tool-palette-group` の `gap: 4px`、`.tool-palette-group + .tool-palette-group` の `border-top: 1px`・`margin-top: 4px`・`padding-top: 4px`、ボタン32px、1つ目のまとまり4ボタン（32×4＋4×3＝140）、2つ目のまとまり5ボタン（4＋1＋4＋32×5＋4×4＝185）、12＋140＋185＝337。CSSコメントは `index.html:224-225` 付近。**`index.html` は変更しない**。
* **No.29**（01:15。「例外：ON/OFFのボタンの`aria-pressed="false"`（…）と、重なり順の4ボタンの`disabled`（結合ボタンと同じ扱い。`main.js`の`syncOptionBarOrderGroup`が同期する）。」Survey 1517行）：→ 文案：「…と、重なり順の4ボタン・整列・分布の8ボタンの`disabled`（結合ボタンと同じ扱い。`main.js`の`syncOptionBarOrderGroup`・`syncOptionBarAlignGroup`が同期する）。」
* **No.30**（01:4。「（JSはボタンの中身を書き換えず、CSSの`content`で重ねない。単位のボタンの数字だけは`palette/UnitSnapGroup.js`が書く）」Survey 1518行）：→ 文案：「（JSはボタンの中身を書き換えず、CSSの`content`で重ねない。例外は単位のボタンの数字を書く`palette/UnitSnapGroup.js`と、選択・頂点の選択のボタンの中身を`<canvas>`に入れ替える`wiring/ToolIconWiring`（`textContent = ''`と`appendChild`。下の例外）の2つ）」 同じ行の後段の「**例外（Phase 08-02a）**」の文は変えない。
* **No.32**（36:9。「`model.onChange`・`viewTransform.onChange`・`displayState.onChange`には`// 6.5.`より前と後の両方に登録があり、」Survey 1520行）：→ 文案：「`model.onChange`には`// 6.5.`より前と後の両方に、`viewTransform.onChange`・`displayState.onChange`には`// 6.5.`より前と`// 6.5.`の中（`DisplayWiring`）に登録があり、」 理由の後半（通知の呼ばれる順が登録順に依存するため）は残す。
* **No.34**（36:5。「`wiring/`は`palette/`・`edit/`・`core/`をimportし、`io/`はimportしない。」Survey 1522行）：→ 文案：「`wiring/`は`palette/`・`edit/`・`core/`をimportし（`wiring/ToolIconWiring`は`asset/sprite/*.js`も）、`io/`はimportしない。」
* **No.33**（02:65。「キャンバス要素の大きさを使う計算は`main.js`の`resetViewToCenter`・`zoomAtCanvasCenter`と`wiring/DisplayWiring`の`#fitViewToShapes`に集める（中心はキャンバスの領域の中心。ツールバー・定規・ステータスバーを除いた領域）。」Survey 1521行）：括弧の後に例外を足す。文案：「…を除いた領域。例外は`core/CanvasManager.resize`（内部バッファの大きさ）と`core/InputTracker.getScreenCoordinate`（`clientWidth / rect.width`の比）の2つ）。」（既存の括弧の中へ入れて括弧を1組に保つ。表記は既存にそろえてよい）
* **No.35**（02:24。`// 7.11.` の行「…`performShapeAlign`、`syncOptionBarAlignGroup`と`model.onChange`への登録のみ。判定・計算を持たない。」Survey 1523行）：タスク2のNo.24とそろえる。文案：「…`performShapeAlign`（ドラッグ中の受理判定＝`inputTracker.isDragging()`なら`false`）、`syncOptionBarAlignGroup`と`model.onChange`への登録。そのほかの判定・計算を持たない。」
* **No.36**（02:25。`// 8.` の行。Survey 1524行）：先頭に `zoomAtCanvasCenter` の関数宣言を足す（コードの順は `main.js:766` の `zoomAtCanvasCenter` → `:775` の `performInvertSelection` → `:784` の `KeyboardShortcuts` → `:890` の `AltKeyGuard`）。文案：「`zoomAtCanvasCenter`の関数宣言、`performInvertSelection`、`KeyboardShortcuts`の生成（…）、`new AltKeyGuard()`（インスタンスを保持しない）」
* **No.31＋要件12**（02:3。行数の行。Survey 1519行・6.3 の注意）：入れ子の履歴を、**現在の値と現在も有効な決定**だけに絞って1行で書き直す。書く前に `wc -l js/main.js` で988行を確かめる（計画立案時の実測は988）。
    * 残す：現在の行数988行、直近のPhase（08-05）で増えた理由の要点（944行から44行増えた：import2行・`// 7.11.`の配線ブロック・起動時の同期の呼び出し1行）、「配線ブロックの切り出しはしていない」という発注者の決定、`// 7.6.` の切り出しを検討する条件と `// 7.7.`・`// 7.8.` を切り出さなかった理由（設計判断の理由のため残す）。
    * 落とす：Phase 07-03〜08-04 の行数の推移（「以前の記録：…」「以前の増減：…」）、07-05の見込みの値、「07-05で足した配線は…」、`// 7.8.` の括弧の中の「Phase 07-02で…701行のまま」、`// 6.5.` を「次に切り出す第一の候補」とする文（Phase 08-01で切り出し済みで、今は有効でない）。
    * 文案：「*   **行数**：988行（Phase 08-05で944行から44行増えた：`ShapeAlignEditor`・`OptionBarAlignGroup`のimport2行・`// 7.11.`の配線ブロック（`ShapeAlignEditor`・`OptionBarAlignGroup`の生成、`performShapeAlign`、`syncOptionBarAlignGroup`と`model.onChange`への登録）・起動時の同期への呼び出し1行）。行数の推移は`_log/res/`の各RESとgitの履歴が正本。配線ブロックの切り出しはしていない（Phase 07-05での発注者の承認済みの指示。以後のPhaseも同じ。Phase 08-01で`// 6.5.`の表示配線だけを`wiring/DisplayWiring`へ切り出した）。配線を追加する場合は配線ブロック（`// 7.6.`。`applyMode`・`viewTransform`等への依存の受け渡しを伴う）の切り出しを検討する。`// 7.7.`（オプションバーのスタイルのまとまり。約30行）・`// 7.8.`（重なり順のまとまり。約40行）は`applyMode`・`viewTransform`等への依存の受け渡しを伴わない独立したブロックのため、切り出さなかった。」（行頭のインデント `    *   ` は既存のまま）
    * 書いた後、3行目の全角の `（` と `）` の数が等しいことを数えて確かめ、数を詳細作業内容に書く（例：`sed -n 3p _doc/arch/02_main.md | grep -o '（' | wc -l`）。
* 矛盾の確認：02:65 の「整列・分布のボタンは`performShapeAlign()`を呼ぶのみ（…ドラッグ中の判定は`performShapeAlign`が行う…）」と No.35 が合うこと。01:4 の後段の例外の文と No.30 が合うこと。01:15 の整列・分布の文（初期`disabled`）と No.29 が合うこと。

### 要件7：`_doc/arch/03_VectorModel.md`・`10_ShapeFactory.md`・`12_shapes.md`（タスク4。No.47〜52・62・63）
* **No.47**（03:4 の末尾「呼び出し元は`InputTracker`のみ（設定・解除）と`main.js`（`getSelectedVertices`を`renderCurrentState`で読む）。」Survey 1535行）：→ 文案：「呼び出し元は`InputTracker`のみ（設定・解除）と、`getSelectedVertices`を読む`main.js`（`renderCurrentState`）・`edit/NudgeEditor`・`edit/PositionInputEditor`（後の2つは`resolveNudgeTarget`の引数に渡す）。」
* **No.48**（03:4「これで取り消し・やり直し・キャンバスの切り替え・削除・結合・貼り付け・`?dev`の復元・`setMode`（`clearSelection`を通る）で取り残しが出ない。」Survey 1536行）：タスク2のNo.16（`PROJECT_ARCHITECTURE.md` 554行）とそろえる。文案：「これで取り消し・やり直し・キャンバスの切り替え・削除・結合・端点への吸い付きの確定・貼り付け・複製（`Ctrl`+`D`）・`?dev`の復元・`setMode`（`clearSelection`を通る）で取り残しが出ない。」 既存の項目の順（554行とは「削除」「キャンバスの切り替え」の順が違う）は変えない。
* **No.49**（03:5「`edit/NudgeEditor`の矢印キーでの頂点の微調整（今の位置＋移動量の絶対座標を渡す。通知1回。Phase 08-03。3章19.）」Survey 1537行）：→ 文案：「`edit/NudgeEditor`の頂点の移動（矢印キーの微調整`nudge`と、位置の数値入力から届く`nudgeWithoutGrouping`。今の位置＋移動量の絶対座標を渡す。通知1回。Phase 08-03・08-04。3章19.・20.）」
* **No.50**（03:6「`edit/NudgeEditor`が矢印キーでの図形の微調整で呼ぶ（選択中のidを渡す。通知1回。3章19.）」Survey 1538行）：→ 文案：「`edit/NudgeEditor`が図形の移動で呼ぶ（矢印キーの微調整`nudge`と、位置の数値入力から届く`nudgeWithoutGrouping`。選択中のidを渡す。通知1回。3章19.・20.）」 見出しの「（Phase 08-03）」と後続の文は変えない。
* **No.63**（03:8「`select`が真のとき選択モードであることは呼び出し側の保証」Survey 1551行）：→「`select`が真のとき選択モードまたは頂点の選択モードであることは呼び出し側の保証」
* **No.51**（10:6「`InputTracker`・`KeyboardShortcuts`・`ToolRules`が`ShapeFactory`をimportしているため、」Survey 1539行）：→ 文案：「`InputTracker`・`KeyboardShortcuts`・`ToolRules`・`VectorModel`・`io/DocumentSerializer`・`main.js`が`ShapeFactory`をimportしているため、」 循環importの理由の後半（`KeyboardShortcuts`のモジュール最上位での`SHAPE_TYPES`参照が未初期化で失敗し得る）は残す。事実：`grep -rn "import.*ShapeFactory" js` の6件。
* **No.52**（12:28「使う側は`core/VertexHandleRules`＝表示する頂点のハンドルの組み立てと、`InputTracker`の当たりの絞り込み）」Survey 1540行）：→ 文案：「使う側は`core/VertexHandleRules`＝表示する頂点のハンドルの組み立てと、`InputTracker`の当たりの絞り込みと、範囲選択での頂点の収集（`collectVertexHandlesInRect`。Phase 08-02b））」
* **No.62**（12:33「移動ハンドルの名前は文字列`'move'`固定（`InputTracker`がこの名前で分岐する）。」Survey 1550行）：→ 文案：「移動ハンドルの名前は文字列`'move'`固定（`core/PressActionRules`が定数`MOVE_HANDLE_NAME`と比較して分岐する。`InputTracker`は比較しない）。」 事実：`PressActionRules.js:11・36`、`grep -n "'move'" js/core/InputTracker.js` がコメントだけ。
* 矛盾の確認：03:4 の6つのメソッドの列挙と No.48 が合うこと。`_doc/arch/34_PressActionRules.md` 2行の `MOVE_HANDLE_NAME`（タスク8で直す）と No.62 が合うこと。

### 要件8：`_doc/arch/06_InputTracker.md`・`08_HistoryManager.md`・`13_palette.md`（タスク5。No.18・20・37・38・64＋要件12の06:40）
* **No.37**（06:4「`OperationMode`のimport元は`KeyboardShortcuts`・`core/ToolRules`・`core/CursorShapeRules`（`InputState`も）・`main.js`」Survey 1525行）：→ 文案：「`OperationMode`のimport元は`KeyboardShortcuts`・`core/ToolRules`・`core/CursorShapeRules`（`InputState`も）・`core/NudgeTargetRules`・`core/VertexHandleRules`・`wiring/ToolIconWiring`・`main.js`」
* **No.38**（06:27「`main.js`が`CanvasCursorTracker`へ注入する`Ctrl`（`⌘`を含む）の読み取りの唯一の定義で、二重に書かない」Survey 1526行）：タスク1のNo.11（`PROJECT_ARCHITECTURE.md` 528行）で**実際に書いた文**（本RESのタスク1の詳細作業内容に記録がある）と同じ内容にする。文案（タスク1が文案どおりに書いた場合）：「**マウスのイベントの`Ctrl`（`⌘`を含む）の読み取りはこの関数に寄せ、二重に書かない**（`main.js`が`CanvasCursorTracker`へ注入する）。キーボードの`Ctrl`は`hasCtrlModifier`を使わず別に読む（`KeyboardShortcuts`の`#findBinding`は同じ式、`AltKeyGuard`は`event.ctrlKey`だけを`Alt`の抑止を除く条件に）」 同じ行のほかの文は変えない。
* **No.64**（06:30「`handleMouseDown`の`MOVING_SELECTION`の2か所（moveハンドル・選択中の図形の本体）は非公開の`#beginMoveSelection(event, point)`を呼ぶ」Survey 1552行）：→ 文案：「`handleMouseDown`は`resolvePressAction`の結果が`moveSelection`（moveハンドル・選択中の図形の本体）の枝の1か所で非公開の`#beginMoveSelection(event, point)`を呼ぶ」 同じファイル13行（分岐の表は`core/PressActionRules`が持ち、結果を`#beginMoveSelection`・`#beginLeftDrag`へ振り分けるだけ）・27行（「`#beginMoveSelection`の1か所」）と合うこと。事実：`InputTracker.js:834`（`action.type === 'moveSelection'` の枝）・`:1142`（宣言）。
* **要件12（06:40。行数の行）**：書く前に `wc -l js/core/InputTracker.js` で1579行を確かめる（計画立案時の実測は1579）。文案：「*   **行数**：1579行（Phase 08-02bで頂点の複数選択・まとめ移動・範囲選択の配線を足して1445行から増えた。再分離は行っていない）。行数の推移は`_log/res/`の各RESとgitの履歴が正本。再分離の候補は`_doc/COWORK_STATUS.md`2章A。」（「以前の記録：…」と07-05の見込みを落とす。`_doc/COWORK_STATUS.md` は読まない・変えない。参照の文はそのまま残す）。書いた後、全角括弧の開閉の数が等しいことを確かめる。
* **No.18**（08:11。Survey 1506行）：
    * 呼び出し元の列挙の末尾「`NudgeEditor`（矢印キーの微調整。**まとめの鍵を渡すのは`NudgeEditor`だけ**）」の後に「、`ShapeAlignEditor`（整列・分布。鍵なし）」を足す。
    * 注入先の列挙「`InputTracker`・`ShapeInserter`・`PathJoiner`・`EndpointSnapper`・`ShapeStyleEditor`・`ShapeOrderEditor`・`NudgeEditor`へは`EditRecorder`として注入され」の `NudgeEditor` の後に「・`ShapeAlignEditor`」を足す。
    * 事実：`ShapeAlignEditor.js:93・95`（`beginEdit`・`commitEdit`）、`main.js:726`（`new ShapeAlignEditor({ model, editRecorder: historyManager, shapeExtentReader })`）。「まとめの鍵を渡すのは`NudgeEditor`だけ」は正しいので残す。
* **No.20**（13:1「単独のボタン（⛶・🎯）と文字の表示（座標・大きさ・グリッド・倍率）は`main.js`側の配線（⛶・座標・大きさ・グリッドの表示と、ツールバーにある🧰の配線は`wiring/DisplayWiring`、🎯・倍率は`main.js`）」Survey 1508行）：→ 文案：「単独のボタン（⛶・🎯）と文字の表示（キャンバス名・座標・大きさ・グリッド・倍率）は`main.js`側の配線（⛶・座標・大きさ・グリッドの表示と、ツールバーにある🧰の配線は`wiring/DisplayWiring`、🎯・倍率・キャンバス名（`#canvas-name-display`の`syncCanvasNameDisplay`）は`main.js`）」 事実：`main.js:555・567-577・596`。

### 要件8（続き）：`_doc/arch/14_edit.md`・`38_VertexHandleRules.md`・`41_NudgeTargetRules.md`（タスク6。No.14・17・25・26）
* **No.25**（14:6。`ShapeExtentReader` の公開メソッド。Survey 1513行）：呼び出し元の列挙に `PositionInputEditor` を入れ、同じ行の後続の文と重複しないよう1か所にまとめる。「呼び出し元は`wiring/DisplayWiring`の`#syncSelectionSizeReadout`（ステータスバーの選択中の図形の大きさ）・`#fitViewToShapes`（全体を画面に収める）。生成も`DisplayWiring`が行う（Phase 08-01）。Phase 08-04で`PositionInputEditor`が`getSelectedBounds`を使う（図形の位置の外枠）ため、`main.js`の`// 7.10.`でも別に1つ生成する（」→ 文案：「呼び出し元は、`getSelectedBounds`が`wiring/DisplayWiring`の`#syncSelectionSizeReadout`（ステータスバーの選択中の図形の大きさ）と`edit/PositionInputEditor`（図形の位置の外枠。Phase 08-04）、`getAllBounds`が`DisplayWiring`の`#fitViewToShapes`（全体を画面に収める）。生成も`DisplayWiring`が行う（Phase 08-01）が、`PositionInputEditor`のために`main.js`の`// 7.10.`でも別に1つ生成する（」 括弧の中（2か所で生成…）と、その後の Phase 08-05 の `getSelectedBoundsPerShape` の文は変えない。事実：`PositionInputEditor.js:80`、`DisplayWiring.js:137・189`。
* **No.26**（14:3。前提の「選択モードであること」。Survey 1514行）：`duplicate` だけが実態と違うことを書く。**コードは直さない**。文案：「…の前提（呼び出し側の責務）：選択モードであること（例外：`duplicate`（`Ctrl`+`D`）の呼び出しは`ensureSelectMode()`を通らず操作モードを見ないため、頂点の選択モードでも選択集合が空でなければ実行され図形を追加する。`paste`・`pasteInPlace`は`main.js`の`performPaste`が`ensureSelectMode()`で満たす）・ドラッグ中でないこと・作成途中の図形がないこと。」 後続の文（`duplicateInPlaceWithinEdit` の例外、呼び出し側は`main.js`、不変条件の文）は変えない。事実：`main.js:846-849`（`duplicate`）、`main.js:491-498`（`performPaste`。`:495` の `ensureSelectMode()`）、`KeyboardShortcuts.js:170`、`ClipboardController.js:171-177`。`PROJECT_ARCHITECTURE.md` 549行（複製は頂点の選択モードでも働く）と合うこと。
* **No.14**（38:8「`core/InputTracker`（`#classifyPoint`が`isVertexHandle`で頂点のハンドルだけに絞り込む）」Survey 1502行）：→ 文案：「`core/InputTracker`（`#classifyPoint`が`isVertexHandle`で頂点のハンドルだけに絞り込み、`#commitMarquee`の頂点の選択モードの枝が`collectVertexHandlesInRect`で矩形に入る頂点を集める）」 事実：`InputTracker.js:12`（import）・`:1329`。
* **No.17**（41:7「`edit/NudgeEditor`だけ（`nudge`の手順①②）。`main.js`・`KeyboardShortcuts`は使わない。」Survey 1505行）：→ 文案：「`edit/NudgeEditor`（`nudge`の手順①②）と`edit/PositionInputEditor`（位置の数値入力の対象の決定。Phase 08-04）。`main.js`・`KeyboardShortcuts`は使わない。」 事実：`PositionInputEditor.js:6・77`。

### 要件9：`_doc/arch/16_test.md`（タスク7。No.39〜46）
* **No.39**（16:10。Survey 1527行）：「例外は`test/edit/PathJoiner.test.js`と`test/edit/EndpointSnapper.test.js`の組み合わせのケースのみ：」の「のみ」を外し、例外が10ファイルあることと一覧を先に書く。既存の各ファイルの詳細の文（PathJoiner・EndpointSnapper・ShapeStyleEditor・ShapeOrderEditor・NudgeEditor）は消さない（ほかの節に書かれていないため）。
    * 文案（10行の「注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える。」の直後）：「例外（実物の`VectorModel`等を組み合わせる`test/edit/`のテスト）は10ファイル：下の`PathJoiner`・`EndpointSnapper`・`ShapeStyleEditor`・`ShapeOrderEditor`・`NudgeEditor`と、`ClipboardController`・`StyleEyedropper`・`ShapeExtentReader`・`ShapeAlignEditor`（組み合わせは各ファイルの項）・`PositionInputEditor`（実物の`VectorModel`・`ShapeExtentReader`・`NudgeEditor`）。`test/edit/PathJoiner.test.js`と`test/edit/EndpointSnapper.test.js`の組み合わせのケース：」（以下、既存の「履歴の手順（Undo/Redoの往復と…）を…組み合わせる。」へ続ける）
    * `PositionInputEditor` だけ組み合わせを括弧に書くのは、102行（同ファイルの項）が実物の `VectorModel`・`ShapeExtentReader` を書いていないため（102行は本作業で変えない）。
    * 長さの差し引き：同じ10行の `NudgeEditor` の文の「条件は同じ：DOM・ブラウザのAPIに依存せず、公開APIだけを通す」を「条件は同じ」に縮める（同じ行の前半に条件が書かれているため）。
    * 事実の確かめ：`grep -ln "js/core/VectorModel.js" test/edit/*.test.js` が上の10ファイルであること。`test/edit/PositionInputEditor.test.js` のimport（`:9` 付近の `ShapeExtentReader`、`:11` の `VectorModel`、`NudgeEditor`）。
* **No.40**（16:76。Survey 1528行）：「余白が領域以上、拡大する場合、引数の非破壊」→「余白が領域以上、縮小する場合も倍率を求める、外枠の最小が0でないとき最小を原点側へ寄せる、引数の非破壊」。事実：`test/core/SpriteFitRules.test.js:46-49・66-69`。件数（16件）は変えない。
* **No.41**（16:77。Survey 1529行）：「`isVertexHandle`（`'move'`が偽・未知の名前・`null`）」→「`isVertexHandle`（頂点のハンドルは真・`'move'`と未知の名前は偽／円は常に偽／`shape`が`null`・`undefined`・一覧を持たないときも偽）」。事実：`test/core/VertexHandleRules.test.js:77-87`。件数（8件。08-02a時点）は変えない。
* **No.42**（16:94。Survey 1530行）：引数なしの既存のふるまいの括弧の末尾「`beginEdit`なしの`commitEdit`は警告して`false`」の後に「、前後が同じなら記録せず通知もしない」を足す（7ケース）。事実：`test/core/HistoryManager.test.js:150・168`。
* **No.43**（16:109。Survey 1531行）：「件数不足（整列2未満・分布3未満で空配列・`canApplyAlign`が偽）」→「件数不足（整列2未満・分布3未満で空配列・`canApplyAlign`が偽。2件の整列は動く）」。事実：`test/edit/ShapeAlignRules.test.js:169`。
* **No.44**（16:93。Survey 1532行）：「図形だけで頂点0件は`null`」の後に「・`VERTEX`で図形も頂点も0件なら`null`」を足す。事実：`test/core/NudgeTargetRules.test.js:49`。
* **No.45**（16:111。Survey 1533行）：「既存の`moveShapes`のふるまいが変わらないこと」の前に「件数が複数でも通知は1回だけ、」を足す（または列挙の適切な位置。テストの並びに合わせてよい）。事実：`test/core/VectorModel.moveShapesBy.test.js:65-73`。
* **No.46**（16:110。Survey 1534行）：「`beginEdit` → `moveShapesBy` → `commitEdit`の対が1回で鍵なし・通知1回であること」→ 文案：「`beginEdit`・`commitEdit`が鍵なしで1回ずつ呼ばれ通知1回であること（`moveShapesBy`がその間に呼ばれることは観測しない。手順は`_doc/arch/14_edit.md`の`ShapeAlignEditor.js`の項）」。事実：`test/edit/ShapeAlignEditor.test.js:128-135`、`_doc/arch/14_edit.md:73`（手順 `beginEdit()` → `moveShapesBy` → `commitEdit()`）。
* **件数の確かめ**（REQ要件9の末尾）：計画立案時に、`test/` の全60ファイルを1つずつ `node --test <ファイル>` で数え（合計1543）、16_test.md の「（N件）」の44か所と照らした。食い違って見える17か所はいずれも**各Phaseの時点の件数・追加分**（例：`VertexHandleRules.test.js` は 77行＝08-02a時点8件 → 87行「+10件。計18件」→ 103行「+8件。計26件」＝現在26）で、各Phaseの節の合計（08-05＝新設3ファイル41件＋既存へ6件＝47件、1496＋47＝1543）とも合っていた。全体の件数（115行の tests 1543 / suites 230）も実測と一致。ただし計画立案時のファイルごとの実測件数は本RESに残っていないため、**タスク7で改めて実測し、記録する**：
    * `test/` の全 `*.test.js`（60ファイル）を1つずつ `node --test <ファイル>` で実行し、出力の `# tests N` を読む（例：`for f in $(find test -name '*.test.js' | sort); do printf '%s ' "$f"; node --test "$f" 2>&1 | grep '^# tests'; done`）。
    * 詳細作業内容に、**ファイルごとの表**（ファイル／実測件数／16_test.md の該当行と「（N件）」の記述／照合結果＝一致・各Phaseの時点の件数や追加分として整合〔その計算〕・食い違い）と、実測件数の合計（期待1543）を書く。
    * 件数の数字は、食い違いを見つけたときだけ実測で直す。直した節（76・77・93・94・109・110・111行）は「（N件）」が直したケースの列挙と矛盾しないことも確かめる。
    * 全体の件数（tests / suites）は、タスク10の `node --test` で確かめる。

### 要件10：`_doc/arch/32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`（タスク8。No.53〜58）
* **No.53**（32:4 と 32:8。Survey 1541行）：
    * 4行の「テストは`test/core/ToolRules.test.js`（`OperationMode`）・`test/core/CursorShapeRules.test.js`（両方）・`test/core/NudgeTargetRules.test.js`（`OperationMode`）・`test/edit/NudgeEditor.test.js`（`OperationMode`）。」の末尾に「・`test/core/VertexHandleRules.test.js`（`OperationMode`）・`test/edit/PositionInputEditor.test.js`（`OperationMode`）」を足す（6件）。
    * 8行の「（値の定義のみ。`test/core/ToolRules.test.js`・`test/core/CursorShapeRules.test.js`が値を使う）」を6件に合わせる。文案：「（値の定義のみ。`test/core/ToolRules.test.js`・`test/core/CursorShapeRules.test.js`・`test/core/NudgeTargetRules.test.js`・`test/core/VertexHandleRules.test.js`・`test/edit/NudgeEditor.test.js`・`test/edit/PositionInputEditor.test.js`が値を使う）」
    * 事実：`grep -rln "InputModes.js" test` の6件（計画立案時に確かめた）。
* **No.54**（33:5「入力欄の規則の内容は`PROJECT_ARCHITECTURE.md`3章2.「入力欄の規則」・2026-11-13 発注者の決定」Survey 1542行）：→「入力欄の規則の内容は`PROJECT_ARCHITECTURE.md`3章3.「入力監視」の「キーボード操作」の「入力欄の規則」・2026-11-13 発注者の決定」
* **No.55・No.56**（32:6 と 33:6。**2か所の言い回しをそろえる**。Survey 1543・1544行）：
    * 32:6「`ToolRules`・`KeyboardShortcuts`が値だけのために`InputTracker.js`（`DragTracker`・DOMに依存するクラス）をimportしていたのをなくすため。」→ 文案：「`ToolRules`が値だけのために、`KeyboardShortcuts`が値と判定の関数の両方のために`InputTracker.js`（`DragTracker`・DOMに依存するクラス）をimportしていたうち、値の分をなくすため（判定の関数の分は`core/FocusKeyYieldRules`。`_doc/arch/33_FocusKeyYieldRules.md`）。」
    * 33:6「`KeyboardShortcuts`・`AltKeyGuard`が判定のためだけに`InputTracker.js`をimportしていた。」→ 文案：「`AltKeyGuard`が判定の関数だけのために、`KeyboardShortcuts`が値と判定の関数の両方のために`InputTracker.js`をimportしていた（値の分は`core/InputModes`。`_doc/arch/32_InputModes.md`）。」 続く「依存を整理するため、…切り出した。」は変えない。
    * 事実（Survey の記録。必要なら確かめる）：`git show 6efcbad:js/core/KeyboardShortcuts.js` の7行が `import { OperationMode, SHAPE_TYPES, isTextInputElement, isSpaceOperatedInputElement } from './InputTracker.js';`、`6efcbad:js/core/ToolRules.js:5` は `OperationMode` のみ、`6efcbad:js/core/AltKeyGuard.js:6` は `isTextInputElement` のみ（`git show` は読み取りのみで、リポジトリの状態を変えない）。
* **No.57**（34:2「`'move'`との比較はここ1か所だけ」Survey 1545行）：意図（各図形の`hitTestHandle`の戻り値と一致させる）は残す。文案：「`core/`での`'move'`との比較はここ1か所だけ（図形クラスでは`Line`・`Ellipse`の`getHandlePosition`も`'move'`と比較する）」 事実：`grep -rn "=== 'move'" js` が `Ellipse.js:259`・`Line.js:112`（`CursorShapeRules.js` の `'move'` はカーソルの形の値で比較ではない）。
* **No.58**（34:23「**読むもの**：引数の`hit`（…）と`isSelected`（`(id) => boolean`）。」Survey 1546行）：→ 文案：「**読むもの**：引数の`hit`（…）と、`resolvePressAction`の`isSelected`（`(id) => boolean`）、`resolveVertexPressAction`の`isVertexSelected`（`(shapeId, handle) => boolean`）・`additive`（真偽値）。」 後続の文（何もimportしない・`isSelected`を呼ぶのは本体の判定のときだけ…）は変えない。事実：`PressActionRules.js:70-76`（JSDocと宣言）。同じファイルの22行（`isVertexSelected` を呼ぶ条件・`additive` の読み方）と合うこと。

### 要件11：`js/edit/ShapeExtentReader.js` のクラスJSDoc（タスク9。No.27）
* 17行のクラスJSDoc「図形の外枠の照会クラス。main.jsが1つだけ生成する。」→ 文案：「図形の外枠の照会クラス。main.jsの`// 7.10.`とwiring/DisplayWiringの内部の2か所で生成する。」（既存のJSDocがファイル名をバッククォートなしで書いているのに合わせ、`// 7.10.` だけバッククォートで囲む。字句の調整は可）
* 実行されるコード・ほかのJSDoc・ファイル先頭の責務定義（1〜4行。3行以内の「責務：」）は1文字も変えない。資料（`_doc/arch/14_edit.md:6`・`PROJECT_ARCHITECTURE.md:581`）は正しいので変えない。
* 事実：`main.js:697`・`DisplayWiring.js:65`（`grep -rn "new ShapeExtentReader" js` の2件）。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./`（`PROJECT_ARCHITECTURE.md`）、`./_doc/arch/`（開発資料の分冊）、`./js/edit/`（`ShapeExtentReader.js` のクラスJSDocのみ）
*   **関連する論理クラス**: 資料の記述の対象として、`InputTracker`・`KeyboardShortcuts`・`InputModes`・`NudgeTargetRules`・`VertexHandleRules`・`PressActionRules`・`FocusKeyYieldRules`・`VectorModel`・`ShapeFactory`・`HistoryManager`・`NudgeEditor`・`PositionInputEditor`・`ShapeAlignEditor`・`ShapeExtentReader`・`ClipboardController`・`StyleEyedropper`・`DisplayWiring`・`ToolIconWiring`・`main.js`（いずれもコードは変えない。`ShapeExtentReader` のクラスJSDocの1行を除く）

### 参照する責務
*   **資料の記載基準**（`PROJECT_ARCHITECTURE.md` 6〜11行）：第一の目的はハルシネーションの防止、第二がコンテキストの削減。第二のために第一を犠牲にしない。残す：責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路、公開メソッド名の一覧。書かない：1つのファイルのJSDocを読めば分かること。JSDocが実コードと食い違う項目を見つけたら、JSDocが直るまで正しい記述を資料に残す。消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。
*   **`js/edit/ShapeExtentReader.js` の責務**（ファイル先頭）：選択中の図形・全図形・選択中の図形1つずつの外枠（書き出しの外枠`bounds`と同じ求め方）の照会のみを担う。DOMに触れず、図形・選択集合・履歴を変更しない。クラスJSDocの修正はこの責務の範囲内（生成箇所の記述の訂正）で、責務定義そのものは変えない。
*   **憲法3章**：すべての `.js` の最先頭行に3行以内の責務定義を置く。クラス・関数にJSDocを書く。タスク9はクラスJSDocの1行だけを実態に合わせ、責務定義の形を崩さない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   本作業は開発資料の修正そのものが目的のため、テンプレートの「資料本体への反映は最終タスクで行う」は適用しない（REQの指示）。**各タスクで、そのタスクの対象ファイル（資料）を直接修正する**。
*   新しい論理クラスの追加・責務の変更はない。

## 3. タスクリスト

**タスクの分け方**：資料のファイル単位で分け、1タスク3ファイル・相違10件までにした。「2か所をそろえる」組は、先に書く側を前のタスクに置き、後のタスクがその記録に合わせる（No.11→No.38＝タスク1→5、No.16→No.48＝タスク2→4、No.24→No.35＝タスク2→3。No.55↔No.56 はタスク8の中）。

*   [x] タスク1: 要件1・2・5 `PROJECT_ARCHITECTURE.md` の1章構成図と3章3.・12.・15.・16.・17.（No.1・2・9・10・11・12・13・59・60・61。10件）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。29・42・323・332・439・484・506・511・528行の中だけ。CRLF）
    *   **作業内容** :
        *   「2. アーキテクチャ設計」の「全タスクに共通の約束」と「要件1・2・5（タスク1）」を読み、文案のとおりに各行を直す（事実を確かめてから。192・194〜201・202行には触れない）。
        *   No.11（528行）は書いた文をそのまま詳細作業内容に記録する（タスク5がそろえる）。
        *   330行（スポイトの待ち受け中の入力）・544〜545行（頂点の押下の`Ctrl`）・553行（`drawHandles`）と直した記述が矛盾しないことを確かめる。
        *   行末（CRLF）と `git diff --stat` を確かめ、詳細作業内容に番号ごとの前後の要点を書く。

*   [x] タスク2: 要件3・4 `PROJECT_ARCHITECTURE.md` の3章18.〜21.（No.15・16・19・21・22・23・24。7件）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。551・554・571・575・578・581・593・596行の中だけ。CRLF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件3・4（タスク2）」を読み、文案のとおりに各行を直す。
        *   No.16（554行）・No.24（596行）は書いた文をそのまま詳細作業内容に記録する（タスク4・3がそろえる）。
        *   575行は発注者の決定の記録なので、決定の文言を変えず括弧で事実を添える形を守る。
        *   580行・595行・603行と直した記述が矛盾しないことを確かめる。行末（CRLF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [x] タスク3: 要件6・12 `_doc/arch/01_index_html.md`・`02_main.md`・`36_DisplayWiring.md`（No.28・29・30・31・32・33・34・35・36。9件）
    *   **対象ファイル** :
        *   `./_doc/arch/01_index_html.md` :（更新。4・12・15行の中だけ。CRLF）
        *   `./_doc/arch/02_main.md` :（更新。3・24・25・65行の中だけ。CRLF）
        *   `./_doc/arch/36_DisplayWiring.md` :（更新。5・9行の中だけ。LF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件6・12（タスク3）」を読み、文案のとおりに直す。No.35 はタスク2の詳細作業内容に記録されたNo.24の文と趣旨をそろえる。
        *   02:3 は書く前に `wc -l js/main.js` で988行を確かめ、書いた後に全角括弧の開閉の数を数えて記録する。
        *   `index.html` は変更しない（No.28 は資料だけを直し、CSSコメントが古い旨を1文添える）。
        *   行末（01・02はCRLF、36はLF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [x] タスク4: 要件7 `_doc/arch/03_VectorModel.md`・`10_ShapeFactory.md`・`12_shapes.md`（No.47・48・49・50・51・52・62・63。8件）
    *   **対象ファイル** :
        *   `./_doc/arch/03_VectorModel.md` :（更新。4・5・6・8行の中だけ。CRLF）
        *   `./_doc/arch/10_ShapeFactory.md` :（更新。6行の中だけ。CRLF）
        *   `./_doc/arch/12_shapes.md` :（更新。28・33行の中だけ。CRLF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件7（タスク4）」を読み、文案のとおりに直す。No.48 はタスク2の詳細作業内容に記録されたNo.16の文（`PROJECT_ARCHITECTURE.md` 554行）と同じ2項目を同じ位置に足す。
        *   行末（CRLF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [x] タスク5: 要件8・12 `_doc/arch/06_InputTracker.md`・`08_HistoryManager.md`・`13_palette.md`（No.18・20・37・38・64＋06:40の行数の行。5件＋1）
    *   **対象ファイル** :
        *   `./_doc/arch/06_InputTracker.md` :（更新。4・27・30・40行の中だけ。LF）
        *   `./_doc/arch/08_HistoryManager.md` :（更新。11行の中だけ。CRLF）
        *   `./_doc/arch/13_palette.md` :（更新。1行の中だけ。CRLF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件8（タスク5）」を読み、文案のとおりに直す。No.38 はタスク1の詳細作業内容に記録されたNo.11の文（`PROJECT_ARCHITECTURE.md` 528行）と同じ内容にする。
        *   06:40 は書く前に `wc -l js/core/InputTracker.js` で1579行を確かめ、書いた後に全角括弧の開閉の数を確かめる。
        *   行末（06はLF、08・13はCRLF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [ ] タスク6: 要件8 `_doc/arch/14_edit.md`・`38_VertexHandleRules.md`・`41_NudgeTargetRules.md`（No.14・17・25・26。4件）
    *   **対象ファイル** :
        *   `./_doc/arch/14_edit.md` :（更新。3・6行の中だけ。CRLF）
        *   `./_doc/arch/38_VertexHandleRules.md` :（更新。8行の中だけ。LF）
        *   `./_doc/arch/41_NudgeTargetRules.md` :（更新。7行の中だけ。LF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件8（続き）（タスク6）」を読み、文案のとおりに直す。No.26 はコードを直さない（ふるまいの変更は対象外）。
        *   `PROJECT_ARCHITECTURE.md` 549行（複製は頂点の選択モードでも働く）・581行（`ShapeExtentReader` の2か所の生成）と矛盾しないことを確かめる（`PROJECT_ARCHITECTURE.md` は読むだけ）。
        *   行末（14はCRLF、38・41はLF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [ ] タスク7: 要件9 `_doc/arch/16_test.md`（No.39〜46。8件）
    *   **対象ファイル** :
        *   `./_doc/arch/16_test.md` :（更新。10・76・77・93・94・109・110・111行の中だけ。CRLF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件9（タスク7）」を読み、文案のとおりに直す。各ケースは実際のテストファイルの `it`／`describe` を読んで確かめる（`test/` は読むだけで変えない）。
        *   `test/` の全 `*.test.js` をファイルごとに `node --test` で実測し、16_test.md の各節の「（N件）」と照合した結果を、ファイルごとの表（実測件数・資料の記述・照合結果）と合計件数として詳細作業内容に記録する（手順は要件9の「件数の確かめ」）。直した節の「（N件）」と列挙が矛盾しないことも確かめる（件数の数字は、食い違いを見つけたときだけ実測で直す）。全体の件数はタスク10で確かめる。
        *   行末（CRLF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [ ] タスク8: 要件10 `_doc/arch/32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`（No.53・54・55・56・57・58。6件）
    *   **対象ファイル** :
        *   `./_doc/arch/32_InputModes.md` :（更新。4・6・8行の中だけ。LF）
        *   `./_doc/arch/33_FocusKeyYieldRules.md` :（更新。5・6行の中だけ。LF）
        *   `./_doc/arch/34_PressActionRules.md` :（更新。2・23行の中だけ。LF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件10（タスク8）」を読み、文案のとおりに直す。No.55（32:6）と No.56（33:6）は言い回しをそろえる。
        *   34:22（`isVertexSelected` を呼ぶ条件）と No.58 が合うこと、`_doc/arch/12_shapes.md` 33行（タスク4で直した `MOVE_HANDLE_NAME` の記述）と No.57 が合うことを確かめる。
        *   行末（LF）と `git diff --stat` を確かめ、詳細作業内容に記録する。

*   [ ] タスク9: 要件11 `js/edit/ShapeExtentReader.js` のクラスJSDoc（No.27。1件。本作業で唯一のソース修正）
    *   **対象ファイル** :
        *   `./js/edit/ShapeExtentReader.js` :（更新。17行のクラスJSDocのコメント1行だけ。LF）
    *   **作業内容** :
        *   「全タスクに共通の約束」と「要件11（タスク9）」を読み、クラスJSDocの「main.jsが1つだけ生成する。」を、2か所で生成する実態に直す。実行されるコード・ほかのJSDoc・先頭の責務定義（3行以内の「責務：」）は変えない（JSDocの記述の形を保つ）。
        *   `node --check js/edit/ShapeExtentReader.js` を実行し、行末（LF）と `git diff` が17行の1行だけであることを確かめ、詳細作業内容に記録する。

*   [ ] タスク10: 要件13 確認（`node --check`・`node --test` の件数の記録と、58件すべての処理の照合）
    *   **対象ファイル** :
        *   `./_log/res/261118_1044_RES_Interrupt_Phase08_Close_Doc_Fix.md` :（更新。本タスクの詳細作業内容のみ）
    *   **作業内容** :
        *   `node --check js/edit/ShapeExtentReader.js` を実行する。
        *   プロジェクトのルートで `node --test` を実行し、tests / suites / pass / fail の件数を記録する（期待：tests 1543 / suites 230 / pass 1543 / fail 0。件数は変わらないはず）。
        *   `git status --short` と `git diff --stat` で、変更されたファイルがタスク1〜9の対象ファイル（`PROJECT_ARCHITECTURE.md`・`_doc/arch/` の01・02・03・06・08・10・12・13・14・16・32・33・34・36・38・41・`js/edit/ShapeExtentReader.js`）と本RESだけであることを確かめる（`.vscode/` は作業前からの未追跡で対象外）。`PROJECT_ARCHITECTURE.md` の192・194〜201・202行に差分が無いことを `git diff -U0 PROJECT_ARCHITECTURE.md` で確かめる。
        *   全ファイルの行末が作業前と同じであることを `git ls-files --eol` の `w/` 列（または `tr -cd '\r'` の数）で確かめる。
        *   No.1・2、No.9〜64（No.31 は要件12で、No.27 は要件11で処理）の58件について、番号を並べて「どのタスクで処理したか」を照合した表を詳細作業内容に書く。直せなかったもの・直さないと判断したものがあれば、番号と理由を書く。
        *   テストプレイ・ブラウザでの確認は行わない。

*   [ ] タスク11: 「5. 懸念事項・要確認ポイント」の記述
    *   **対象ファイル** :
        *   `./_log/res/261118_1044_RES_Interrupt_Phase08_Close_Doc_Fix.md` :（更新。5章と本タスクの詳細作業内容のみ）
    *   **作業内容** :
        *   タスク1〜10の詳細作業内容と5章の既存の記述を読み、判断に迷った点、資料の別の箇所との整合で気づいた点（本作業の対象外で残った同種の記述を含む）、将来この箇所を修正する際に注意すべき点を、5章へ追記する。資料・コードは変更しない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1・2・5 `PROJECT_ARCHITECTURE.md` の1章構成図と3章3.・12.・15.・16.・17.
*   **作業内容** :
    *   実コードの事実（`KeyboardShortcuts.js:295`、`main.js:809・884`、`AltKeyGuard.js:31`、`main.js` の `showHandles: false`、`InputTracker` の `pickShape`）を確かめ、Survey と一致。文案どおりに9行（29・42・323・332・439・484・506・511・528）を `Edit` 相当の完全一致置換で直した（No.59・60は別行、計10件）。
    *   No.1（29行）：`VertexHandleRules`の後に`NudgeTargetRules`を追加。No.2（42行）：「`edit/NudgeEditor`・`edit/PositionInputEditor`から使う」。
    *   No.9・10（332行）：`InputTracker`の公開メソッドの直後に`Esc`の実体の括弧（`styleEyedropper.cancelPicking`・`fallback`・16.）、列挙末尾に`/nudgeSelection`（実体は`nudgeEditor.nudge`。19.）を追加。
    *   No.12（511行）：「照会`isPickingShape`と、注入された`pickShape`の呼び出しで関わるだけ」。330行の「注入された補助`isPickingShape`・`pickShape`だけで関わり」と合う。
    *   No.13（506行）：`Ctrl`の項を時点の種類（選択の確定・頂点の選択モードの押下`mousedown`・スナップ/吸い付きの読み取り・キーボード）で書き直した。`Shift`・矢印キーの`Shift`・`Alt`の文は不変。
    *   No.11（528行）：書いた文（見出しの括弧）：「（`event.ctrlKey || event.metaKey`。**マウスのイベントの`Ctrl`（`⌘`を含む）の読み取りは`InputTracker.js`が`export`する`hasCtrlModifier`に寄せ、二重に書かない**（`main.js`が`CanvasCursorTracker`へ注入する）。キーボードの`Ctrl`は`hasCtrlModifier`を使わず別に読む（`KeyboardShortcuts`の`#findBinding`は同じ式、`AltKeyGuard`は`event.ctrlKey`だけを`Alt`の抑止を除く条件に）。キーの購読は足さない）」（タスク5のNo.38はこの文に合わせる）。
    *   No.59・60（323・439行）：「頂点の」選択モードに。
    *   No.61（484行）：「**現在`drawHandles`はどのモードからも呼ばれない**（`main.js`が`render`の`showHandles`へ常に`false`を渡すため。去就は変形のPhaseで決める。18.）。」を追記（元の記述は残した）。553行（`drawHandles`が呼ばれなくなること）と矛盾なし。
    *   矛盾確認：330行・544〜545行（頂点の押下の`Ctrl`）・553行と矛盾しない。長さの差し引き：332・506・528行は伸びたが、情報を失わずに削れる重複表現は見当たらず削っていない。
    *   行末：`wc -l`＝657、`tr -cd '\r'`の数＝657（CRLF維持）。`git diff --stat`：9 insertions / 9 deletions（変更は直した9行のみ）。

### タスク2: 要件3・4 `PROJECT_ARCHITECTURE.md` の3章18.〜21.
*   **作業内容** :
    *   実コードの事実（`CanvasLibrary.js:950` の `historyManager.clear()`、`main.js:736-741` の `performShapeAlign`、`VertexHandleRules.js:89` の `computeVertexHandlesBounds`）を確かめ、Survey と一致。文案どおりに8行（551・554・571・575・578・581・593・596）を完全一致置換で直した（7件）。
    *   No.15（551行）：「矩形に入る頂点の収集・頂点の範囲は`core/VertexHandleRules`（…・`computeVertexHandlesBounds`（Phase 08-04。20.）。状態なし。」
    *   No.16（554行）：書いた文（該当部分）：「頂点の選択は、取り消し・やり直し・削除・キャンバスの切り替え・結合・端点への吸い付きの確定・貼り付け・複製（`Ctrl`+`D`）・`?dev`の復元・`setMode`で、選択集合から図形が消えたときに`VectorModel`が落とす（取り残さない）。」（タスク4のNo.48はこの2項目を「結合」の後・「貼り付け」の後に足す）。
    *   No.19（571・575行）：571行は「(3)…（`undo`・`redo`が鍵を忘れる）(4)**キャンバスの切り替え**（`CanvasLibrary`の切り替え処理が`HistoryManager.clear()`で履歴と鍵を空にする。6.）。」（(3)の句点を(4)の末尾へ移し1文）。575行は決定の文言を残し「（キャンバスの切り替えも`HistoryManager.clear()`で区切りになる）」を括弧で追加。
    *   No.21（578行）：依存の矢印の末尾に`・`core/NudgeTargetRules.js``。No.22（581行）：「対象の決定＝`core/NudgeTargetRules.resolveNudgeTarget`（19.と同じ規則）。」を「頂点の範囲＝…」の直前に追加。
    *   No.23（593行）：矢印の末尾に「、`main.js` → `core/InputTracker.js`（ドラッグ中の判定）・`core/VectorModel.js`（同期の購読）」を追加。
    *   No.24（596行）：書いた文（該当部分）：「配線＝`main.js`の`// 7.11.`（生成・注入・同期と、`performShapeAlign`のドラッグ中の受理判定（`inputTracker.isDragging()`なら`false`）。そのほかの判定・計算を持たない）」（タスク3のNo.35はこの趣旨にそろえる）。
    *   矛盾確認：580行の①（`resolveNudgeTarget`）・595行・603行（ドラッグ中は受理しない。`performShapeAlign`が`inputTracker.isDragging()`を見て`false`）と矛盾しない。
    *   行末：`wc -l`＝657、`tr -cd '\r'`の数＝657（CRLF維持）。`git diff --stat`：8 insertions / 8 deletions（直した8行のみ）。

### タスク3: 要件6・12 `_doc/arch/01_index_html.md`・`02_main.md`・`36_DisplayWiring.md`
*   **作業内容** :
    *   実コードの事実（`wc -l js/main.js`＝988、`main.js` の `inputTracker.isDragging()`、`CanvasManager.js:164` と `InputTracker.js:1531` の `clientWidth`）を確かめ、Survey と一致。文案どおりに完全一致置換で直した（No.31を含め9件）。
    *   No.28（01:12）：ツールパレットの縦の範囲を「`y 68〜約446`（見出し約39px＋本体337px＋枠2px。…）」にし、`index.html`のCSSコメントが「約410」「本体約301px」のまま古い旨に書き換えた。`index.html`は未変更。
    *   No.29（01:15）：「重なり順の4ボタン・整列・分布の8ボタンの`disabled`（…`syncOptionBarOrderGroup`・`syncOptionBarAlignGroup`が同期する）」。
    *   No.30（01:4）：JSがボタンの中身を書き換えない例外を、`palette/UnitSnapGroup.js`と`wiring/ToolIconWiring`の2つにした。後段の「例外（Phase 08-02a）」は不変で合う。
    *   No.32（36:9）：`model.onChange`は`// 6.5.`より前と後の両方、`viewTransform.onChange`・`displayState.onChange`は`// 6.5.`より前と`// 6.5.`の中（`DisplayWiring`）。理由の後半は残した。No.34（36:5）：「（`wiring/ToolIconWiring`は`asset/sprite/*.js`も）」を追加。
    *   No.33（02:65）：括弧の中に例外（`core/CanvasManager.resize`・`core/InputTracker.getScreenCoordinate`の2つ）を追加し括弧は1組のまま。
    *   No.35（02:24）：書いた文（該当部分）：「`performShapeAlign`（ドラッグ中の受理判定＝`inputTracker.isDragging()`なら`false`）、`syncOptionBarAlignGroup`と`model.onChange`への登録。そのほかの判定・計算を持たない。」（タスク2のNo.24の趣旨と合う）。
    *   No.36（02:25）：`// 8.`の行の先頭に「`zoomAtCanvasCenter`の関数宣言、」を追加。
    *   No.31＋要件12（02:3）：行数の行を文案どおり1行に書き直した（988行は確認済み。推移・07-05の見込み・「次に切り出す第一の候補」の文を落とした）。全角の`（`＝6、`）`＝6で等しい。
    *   矛盾確認：02:65の「ドラッグ中の判定は`performShapeAlign`が行う」とNo.35、01:4の後段の例外とNo.30、01:15の初期`disabled`とNo.29は合う。
    *   行末：01は`wc -l`＝18・CR数＝18、02は73・73（CRLF維持）、36は10・0（LF維持）。`git diff --stat`：01は3行・02は4行・36は2行（直した行のみ、計9 insertions / 9 deletions）。

### タスク4: 要件7 `_doc/arch/03_VectorModel.md`・`10_ShapeFactory.md`・`12_shapes.md`
*   **作業内容** :
    *   事実確認：`import.*ShapeFactory` は js/ の6件（InputTracker・KeyboardShortcuts・ToolRules・VectorModel・io/DocumentSerializer・main.js）、`getSelectedVertices` を読むのは main.js:191・NudgeEditor.js:90・PositionInputEditor.js:77、`PressActionRules.js:11・36` が `MOVE_HANDLE_NAME`、`InputTracker.js` の `'move'` はコメント（394行）だけ。いずれもSurveyと一致。
    *   No.47（03:4）：呼び出し元に `edit/NudgeEditor`・`edit/PositionInputEditor`（`resolveNudgeTarget` の引数に渡す）を足した。
    *   No.48（03:4）：「結合」の後に「端点への吸い付きの確定」、「貼り付け」の後に「複製（`Ctrl`+`D`）」を足した。タスク2のNo.16（`PROJECT_ARCHITECTURE.md` 554行）の2項目と同じ内容・同じ位置。既存の項目の順は変えていない。
    *   No.49（03:5）：頂点の移動の呼び出し元を「矢印キーの微調整 `nudge` と位置の数値入力から届く `nudgeWithoutGrouping`」、Phase 08-03・08-04、3章19.・20. に直した。
    *   No.50（03:6）：図形の移動の呼び出し元を同様に直した（見出しと後続の文は不変）。
    *   No.63（03:8）：「選択モードまたは頂点の選択モードであることは呼び出し側の保証」に直した。
    *   No.51（10:6）：importしている側を6件に直した（循環importの理由の後半は残した）。
    *   No.52（12:28）：使う側に範囲選択での頂点の収集（`collectVertexHandlesInRect`。Phase 08-02b）を足した。
    *   No.62（12:33）：`core/PressActionRules` が `MOVE_HANDLE_NAME` と比較して分岐し、`InputTracker` は比較しない、に直した。
    *   矛盾確認：03:4 の6メソッド列挙とNo.48は合う。34_PressActionRules.md 2行（タスク8で直す）とNo.62は同内容になる想定。
    *   行末：03は `wc -l`＝14・CR数＝14、10は7・7、12は69・69（CRLF維持）。`git diff --stat`：03は4行・10は1行・12は2行（直した行のみ、計7 insertions / 7 deletions）。

### タスク5: 要件8・12 `_doc/arch/06_InputTracker.md`・`08_HistoryManager.md`・`13_palette.md`
*   **作業内容** :
    *   `wc -l js/core/InputTracker.js`＝1579を確認。文案どおりに6行（06:4・27・30・40、08:11、13:1）を完全一致置換で直した。
    *   No.37（06:4）：`OperationMode`のimport元に`core/NudgeTargetRules`・`core/VertexHandleRules`・`wiring/ToolIconWiring`を追加。
    *   No.38（06:27）：「唯一の定義」を外し、タスク1のNo.11（`PROJECT_ARCHITECTURE.md` 528行）と同じ内容にした。書いた文（該当部分）：「**マウスのイベントの`Ctrl`（`⌘`を含む）の読み取りはこの関数に寄せ、二重に書かない**（`main.js`が`CanvasCursorTracker`へ注入する）。キーボードの`Ctrl`は`hasCtrlModifier`を使わず別に読む（`KeyboardShortcuts`の`#findBinding`は同じ式、`AltKeyGuard`は`event.ctrlKey`だけを`Alt`の抑止を除く条件に）」。同じ行のほかの文は不変。
    *   No.64（06:30）：「`handleMouseDown`は`resolvePressAction`の結果が`moveSelection`（moveハンドル・選択中の図形の本体）の枝の1か所で非公開の`#beginMoveSelection(event, point)`を呼ぶ」。06:13・06:27（`#beginMoveSelection`の1か所）と合う。
    *   06:40（要件12）：行数の行を「1579行（…増えた。再分離は行っていない）。行数の推移は`_log/res/`の各RESとgitの履歴が正本。再分離の候補は`_doc/COWORK_STATUS.md`2章A。」にした（以前の記録と07-05の見込みを落とした）。全角の`（`＝1、`）`＝1で等しい。
    *   No.18（08:11）：呼び出し元の列挙の末尾に「、`ShapeAlignEditor`（整列・分布。鍵なし）」、注入先の列挙の`NudgeEditor`の後に「・`ShapeAlignEditor`」を追加。「まとめの鍵を渡すのは`NudgeEditor`だけ」は残した。
    *   No.20（13:1）：文字の表示に「キャンバス名」を足し、`main.js`側に「キャンバス名（`#canvas-name-display`の`syncCanvasNameDisplay`）」を追加。
    *   行末：06は`wc -l`＝40・CR数＝0（LF維持）、08は14・14、13は61・61（CRLF維持）。`git diff --stat`：06は4行・08は1行・13は1行（直した行のみ、計6 insertions / 6 deletions）。

### タスク6: 要件8 `_doc/arch/14_edit.md`・`38_VertexHandleRules.md`・`41_NudgeTargetRules.md`
*   **作業内容** :
    *   （未実施）

### タスク7: 要件9 `_doc/arch/16_test.md`
*   **作業内容** :
    *   （未実施）

### タスク8: 要件10 `_doc/arch/32_InputModes.md`・`33_FocusKeyYieldRules.md`・`34_PressActionRules.md`
*   **作業内容** :
    *   （未実施）

### タスク9: 要件11 `js/edit/ShapeExtentReader.js` のクラスJSDoc
*   **作業内容** :
    *   （未実施）

### タスク10: 要件13 確認
*   **作業内容** :
    *   （未実施）

### タスク11: 「5. 懸念事項・要確認ポイント」の記述
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
* （計画立案時）**行末の説明の違い**：REQの原則6は「`08`・`18`・`20`以降はLF」とするが、実測（`tr -cd '\r'`・`git ls-files --eol`）では `08_HistoryManager.md` はCRLF、`05_ViewTransform.md`・`06_InputTracker.md` はLFだった。本計画は実測を正とした（「ファイルごとの行末を変えない」という原則そのものは同じ）。なお `git` の index はすべてLF（`core.autocrlf=true`）。
* （計画立案時）**No.16・No.48 の列挙に足すのは2項目だけ**：Survey は頂点の選択が落ちる経路として (2)「頂点の選択モードの`Ctrl`+クリックで図形が選択から外れる場合」も挙げているが、REQの要件3・7が足す項目を「複製」と「端点への吸い付きの確定」の2つに限っているため、本計画もREQに従った（(2) は `PROJECT_ARCHITECTURE.md` 544行に書かれている）。
* （計画立案時）**同じ断定の残り**：`hasCtrlModifier` を「`Ctrl`（`⌘`を含む）の読み取りの唯一の定義」とする文は、No.11・No.38 の2か所のほかに `_doc/arch/24_CanvasCursorTracker.md` 3行にもある。`24` はREQが変更対象に挙げていないファイルのため、本作業では直さない。
* （計画立案時）**`16_test.md` の件数の照合**：「2. アーキテクチャ設計」の要件9の「件数の確かめ」のとおり、計画立案時に全ファイルを実測し、各Phaseの時点の件数・追加分として矛盾が無いことを確かめた。ファイルごとの実測件数は計画立案時には記録していないため、タスク7で実測し直して詳細作業内容に記録する。
