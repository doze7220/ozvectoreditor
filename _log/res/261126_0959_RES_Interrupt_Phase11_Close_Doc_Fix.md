# RES: 作業計画・作業レポート (Interrupt) : Phase 11 クローズの開発資料の相違の修正（相違65項＋追加14件＋コードのコメント・テストの残り19か所）
* 参照元REQ: `./_log/req/261126_0220_REQ_Interrupt_Phase11_Close_Doc_Fix.md`

## 1. 作業目的
Phase 11 のクローズの整合確認（Survey）で見つかった、開発資料の記述と実コードの相違 **No.1〜No.65**（延べ65項。重複を除き56件）、取り違えやすい「読み方が分かれる記述」**A1〜A14**、コードのコメント・テストの題の残り **C1〜C19** を、実コードの実態に合わせて直す。開発資料の第一の目的はハルシネーションの防止である。**コードのふるまいは一切変えない**（`js/`・`test/` で変えるのは C1〜C19 のコメント・JSDoc・テストの題の文字と、C19 の不要な1行の削除だけ）。テストプレイは行わない。

本作業は開発資料の修正そのものが目的のため、テンプレートの「開発資料の書き換えは最終タスクのみ」の定めは適用しない。**各タスクで、そのタスクが担当する資料を直す。**

## 2. アーキテクチャ設計
### 要件0: 全タスク共通の進め方（各タスクの実行者は必ず読む）
#### 0-1. 相違一覧（正本）の読み方
* 正本：`./_log/res/261126_0019_RES_Survey_Phase11_Doc_Consistency.md`（約610KB。**全体を読まない**）。
* **No.n は (1379＋n) 行**（No.1＝1380行 … No.65＝1444行）。担当の No. の行だけを `Read` の offset/limit で読む（例：No.24 → offset 1403, limit 1）。
* 5章の記述だけで直せない場合に限り、4章の該当タスクの欄を読む（見出しの行：タスク1＝366、2＝390、3＝438、4＝471、5＝519、6＝552、7＝595、8＝672、9＝713、10＝759、11＝826、12＝860、13＝972、14＝1055、15＝1111、16＝1194、17＝1242、18＝1318）。6章（1446行以降）は読まない。
* 同じ記述を指す項（1か所の直しで済む）：No.2と37、No.4と58、No.15と38、No.44と57、No.36と45、No.39と48、No.40と49、No.41と50、No.42と51。
* 資料・ソースの行番号は Survey 時点のもので、作業の途中でずれる。**行番号ではなく記述の文言で箇所を特定する**（`Grep` の `-o` と前後の文字数指定で文言を探し、`Edit` は一意な部分文字列で置き換える。`PROJECT_ARCHITECTURE.md` は1行が非常に長いので、行全体を読まない）。
* **5章の記述と実コードが食い違う場合**（Survey の調査の誤り）は、その箇所を直さず、作業を中断して最終報告の「質問:」に相違点を書く。直す前に、根拠の `ファイル:行` を実コードで確かめること。

#### 0-2. 共通の直し方の原則（REQの原則1〜10の要約。すべてのタスクで守る）
1. **列挙の取りこぼし**：実コードに合わせて不足分を足す。同じ資料の別の文に書かれていても、参照で済ませずこの列挙にも足す。
2. **断定・限定**（「だけ」「のみ」）：実態と合わなければ断定を外すか、範囲を限って正しい断定にする（例：「図形の並びの状態は`#items`だけ」）。設計として守りたい約束なら約束は残す（決められなければ直さず報告）。
3. **版の古い値**：作業データの現行は**版4**、書き出し形式の現行も**版4**（`js/io/DocumentSerializer.js` の `CURRENT_DOCUMENT_VERSION = 4`、`js/io/SpriteSerializer.js` の `SPRITE_FORMAT_VERSION = 4`）。過去のPhaseで「版を上げなかった」経緯の文は、**そのPhaseの時点の値と分かるよう書き添える**（例：「版は当時の2のまま」）。テストの説明のように今のコードの値を述べる文は、今の値に直す。表現は資料の中でそろえる。
4. **表示・ロックの対象**：描画・⛶は「見えている図形」、選択に対する編集と外枠は「選択中で変えられる図形（見えていてロックされていない）」。語は既存の言い方（「見えている図形」「変えられる図形」）にそろえる。
5. **過去の時点の記述**：その時点の記録として正しい文は残してよい。今の事実と取り違えるものは、時点を書き添えるか今の値に直す。
6. **行末を保つ**（0-3）。
7. **既存の表記を崩さない**：バッククォート・箇条の形・節の順序・言い回しの調子を既存にそろえる。修正に必要のない箇所は1文字も変えない。
8. **長くしない**：文が伸びるときは、同じ文の冗長な表現を削って差し引く。事実は落とさない。
9. **経緯の付記には触れない**：「（Phase 11-0x）」「発注者の決定」などは、内容を変える必要がなければ残す。
10. **同じ誤りの書き写し**：直した文と同じ誤りが**同じファイルの中**に別の言い方で残っていないか確かめ、あれば同じように直して4章に書く。**別のファイル**で見つけたものは直さず、5章へ報告する。

#### 0-3. 行末の保ち方（バイト数での実測）
* `grep -c $'\r$'` は使わない。次で LF と CR のバイト数を数える：`printf "LF=%s CR=%s\n" "$(tr -cd '\n' < <file> | wc -c)" "$(tr -cd '\r' < <file> | wc -c)"`。
* 作業前（計画時点）の実測値。**作業後も LF＝CR（CRLFのファイル）／CR＝0（LFのファイル）であること**を確かめる（行数を変えた場合は LF の数も増減に合わせて確かめる）。

| ファイル | LF | CR | 行末 |
|---|---|---|---|
| `PROJECT_ARCHITECTURE.md` | 1021 | 1021 | CRLF |
| `_doc/arch/01_index_html.md` | 22 | 22 | CRLF |
| `_doc/arch/02_main.md` | 89 | 89 | CRLF |
| `_doc/arch/03_VectorModel.md` | 29 | 29 | CRLF |
| `_doc/arch/06_InputTracker.md` | 58 | 58 | CRLF |
| `_doc/arch/07_KeyboardShortcuts.md` | 24 | 0 | LF |
| `_doc/arch/08_HistoryManager.md` | 15 | 15 | CRLF |
| `_doc/arch/12_shapes.md` | 92 | 92 | CRLF |
| `_doc/arch/13_palette.md` | 89 | 89 | CRLF |
| `_doc/arch/14_edit.md` | 148 | 148 | CRLF |
| `_doc/arch/15_io.md` | 45 | 45 | CRLF |
| `_doc/arch/16_test.md` | 315 | 315 | CRLF |
| `_doc/arch/46_ItemTreeRules.md` | 12 | 0 | LF |
| `_doc/arch/61_ItemRowRules.md` | 13 | 13 | CRLF |
| `js/main.js` | 1234 | 1234 | CRLF（**行数を変えない**） |
| `js/core/InputTracker.js` | 2023 | 2023 | CRLF（**行数を変えない**） |
| `js/core/KeyboardShortcuts.js` | 376 | 376 | CRLF |
| `js/core/InputModes.js` | 49 | 49 | CRLF |
| `js/core/VectorModel.js` | 1462 | 0 | LF |
| `js/core/ListSelectionRules.js` | 134 | 0 | LF |
| `js/core/ItemListRules.js` | 238 | 0 | LF |
| `js/wiring/DisplayWiring.js` | 197 | 0 | LF |
| `js/wiring/ItemListWiring.js` | 489 | 0 | LF |
| `js/palette/ItemListPanel.js` | 696 | 0 | LF |
| `js/shapes/EndpointSnapRules.js` | 162 | 162 | CRLF |
| `js/shapes/PathJoinRules.js` | 779 | 779 | CRLF |
| `test/io/DocumentSerializer.roundtrip.test.js` | 978 | 0 | LF |
| `test/core/ItemPlaceRules.test.js` | 252 | 252 | CRLF |
| `test/edit/ShapeInserter.insertTarget.test.js` | 321 | 321 | CRLF |

#### 0-4. 各タスクの終わりに必ずすること
1. 直した記述が、同じ資料の別の箇所・別のファイルと矛盾していないかを確かめる（別のファイルの矛盾は直さず5章へ）。
2. 0-3 の方法で、触ったファイルの行末が保たれていることを確かめる。
3. `js/` を触ったタスクは `node --check <file>` を通す。
4. 4章の自分のタスクの欄へ、**直した番号（No.・A・C）と、直した前後の記述の要点**を書き、3章のタスクを `[x]` にする。直さなかった・直せなかった番号があれば、その理由も書く。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./`（`PROJECT_ARCHITECTURE.md`）、`./_doc/arch/`（`01`・`02`・`03`・`06`・`07`・`08`・`12`・`13`・`14`・`15`・`16`・`46`・`61`）、`./js/core/`・`./js/wiring/`・`./js/palette/`・`./js/shapes/`・`./js/main.js`（コメント・JSDocのみ）、`./test/io/`・`./test/core/`・`./test/edit/`（C16・C17・C19のみ）
*   **関連する論理クラス**: `InputTracker`・`KeyboardShortcuts`・`InputModes`・`VectorModel`・`ListSelectionRules`・`ItemListRules`・`DisplayWiring`・`ItemListWiring`・`ItemListPanel`・`EndpointSnapRules`・`PathJoinRules`（いずれもふるまいは変えない）

### 参照する責務
*   本作業は資料の記述を実コードに合わせるものであり、責務の判断を要しない。**コードを資料に合わせて直すことはしない。** 設計の変更提案もしない。
*   資料の記載基準（`PROJECT_ARCHITECTURE.md` 冒頭）：第一の目的はハルシネーションの防止、第二がコンテキストの削減（第二のために第一を犠牲にしない）。残す＝責務と「何を知らないか」の境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路。書かない＝1つのファイルのJSDocを読めば分かること。消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。
*   `shapes/` は `core/` を参照しない（C13・C14 で `shapes/` から `core/` への import・`import()` 型参照を足さない。文中で名前に触れるのは今と同じくよい）。
*   **変更してはならないもの**：`PROJECT_CONSTITUTION.md`・`_doc/COWORK_STATUS.md`・`_doc/COWORK_STATUS_CLOSED.md`・`_doc/PROJECT_AI_WORKFLOW.md`・`_doc/PROJECT_MILESTONE.md`・`_doc/PROJECT_PHASE_TRANSITION_CLEANUP.md`・`_log/` の既存ファイル（本RESを除く）、`index.html`・`sprite-check.html`・`asset/`、`js/`・`test/` のすべて（C1〜C19を除く）、REQが挙げていない `_doc/arch/` のファイル、`PROJECT_ARCHITECTURE.md` の要件1〜3が挙げていない文（原則10の同じ誤りを除く）、章番号・節の順序、修正に必要のない整形・字句の統一・行末の変換・無関係な記述の削除、エンジンのリポジトリ（`D:\ozlab\ozengine-web`。読まない）。
*   **やらないこと**：テストの追加・期待値の変更。`VectorModel.deleteShapes`・`getInsertTargetId` の削除。Survey 6章の A1〜A14 以外、C1〜C19 以外のコメント（`js/shapes/` の契約の番号、`main.js` の `renderCurrentState` のJSDoc、`ItemListPanel.js` 2行、`FileContentReader.test.js` の題など）。`PROJECT_ARCHITECTURE.md` のスリム化。`_doc/arch/16_test.md` の「Node.js v24.20.0で確認」（235行付近）の変更。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   本作業そのものが資料の修正であり、各タスク（タスク6〜16）で担当の資料を直す。新しい論理クラスの追加・責務の割り当ての変更は無い。
*   タスクの実行中に、担当外のファイルで同じ誤りや矛盾に気づいた場合は、直さずに5章へ追記する。

## 3. タスクリスト
*   [x] タスク1: `js/core` 入力系と `main.js` のコメント（C1・C2・C3・C4・C8）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :更新（コメントのみ。**行数2023を変えない**）
        *   `./js/core/KeyboardShortcuts.js` :更新（JSDocのみ）
        *   `./js/core/InputModes.js` :更新（コメントのみ）
        *   `./js/main.js` :更新（コメントのみ。**行数1234を変えない**）
    *   **作業内容** :
        *   **C1**（`InputTracker.js` 1081行付近、click のハンドラのJSDoc）：「確定登録（commitDraft({ atInsertTarget: true })。描き込む先のすぐ上へ入り、描き込む先が無ければ末尾）」の括弧内を、今の描き込む先の3つの形（行の上＝その行のすぐ上・フォルダの中・フォルダの一番下）に合わせる。書く前に `VectorModel.commitDraft` と、それが使う置き場所の規則（`core/ItemPlaceRules.insertItemsAt` 等）の実コードで、3つの形ごとの入り先と、描き込む先が `null` のときの入り先を確かめ、そのとおりに短く書く。行を増やさず、同じ行の中で置き換える。
        *   **C2**（`InputTracker.js` 412行、コンストラクタの `@param inputAssist` の「項目（duplicateSelection・isPickingShape・pickShape・getUnitSnapStep・getSelectionFrameBounds・getReferencePoint）」）：`InputAssist` のtypedef と既定値（`NO_INPUT_ASSIST`）で `deleteSelectedItems` の位置を確かめて列挙へ足す。同じ行の「省略時は従来どおり動作する（…）」の括弧に `deleteSelectedItems` の既定の動きが無ければ、既定値の実コードを確かめて短く足すかは判断し、4章に書く（行を増やさない）。
        *   **C3**（`KeyboardShortcuts.js` の `@property` 54・55・82・86行付近）：`selectAll`「全図形を選択する」・`deleteSelection`「選択集合の全図形を削除する」・`invertSelection`「全図形のうち選択されていないものを選択する」・`resetColors`「その全図形へ記録し」を、今の対象に合わせる。書く前に実コードを確かめる：`selectAll`＝`main.js` の注入（1042行付近）→ `inputTracker.selectAll()` の選ぶ対象、`deleteSelection`＝`inputTracker.deleteSelection()` → `GroupEditor.removeSelection()`（選択中の変えられる図形と**選んでいるフォルダ**が対象）、`invertSelection`＝`main.js` 988行付近（`model.getEditableShapes()`）、`resetColors`＝`edit/ShapeStyleEditor.resetColors()`。語は「変えられる図形」にそろえる。
        *   **C4**（`InputModes.js` 11行）：`MOVING_SELECTION` の「選択集合の全図形を平行移動する」を「選択中の変えられる図形を平行移動する」に合わせる（`InputTracker` の移動の対象を実コードで確かめる）。
        *   **C8**（`main.js` 343行の行コメント）：「ここでmodel.deleteShapesを直接呼ばないこと」を、削除の実体（`GroupEditor.removeSelection`）を直接呼ばず `inputTracker.deleteSelection()` を通す、という今の約束に合わせる（同じ行の中で置き換え、行数を変えない）。
        *   0-4 を行う（`node --check` 4ファイル、`wc -l js/main.js js/core/InputTracker.js` が 1234・2023 のまま、行末）。

*   [ ] タスク2: `js/core` モデル・一覧の規則のコメント（C6・C7・C9・C15）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :更新（JSDocのみ）
        *   `./js/core/ListSelectionRules.js` :更新（JSDoc・typedefのみ）
        *   `./js/core/ItemListRules.js` :更新（JSDocのみ）
    *   **作業内容** :
        *   **C6**（`VectorModel.js` 189〜190行の `#nextId` の説明、1257〜1259行の `#issueId` のJSDoc）：採番の経路の列挙「commitDraft・replaceAllShapes・addShapesWithNewIds・replaceShape」に `rearrangeItems`（新しいフォルダ）を足す。書く前に `rearrangeItems` が新しいフォルダのidを `#issueId` で発行していることを実コードで確かめる。ほかに `#issueId` を呼ぶ経路が無いかも `Grep` で確かめ、あれば同じく足す。
        *   **C7**（`VectorModel.js` 1156行、`rearrangeItems` のJSDocの用途の列挙「まとめる・解除・フォルダの削除・フォルダの中での並べ替え・空のフォルダの追加」）：行のドラッグでの移動（フォルダへの出し入れ。Phase 11-04b）を足す。書く前に `edit/ShapeOrderEditor.moveTo` が `rearrangeItems` を呼ぶことを確かめる。
        *   **C9**（`ListSelectionRules.js` の `ListClickSelection` typedef と `resolveListClickSelection` のJSDoc、6〜29行）：「図形id」を、行のid（図形またはフォルダ）に合わせる。書く前に同ファイルの `resolveRowClickSelection` が `rowIds`・`selectedIds`・`hitId`・`anchorId` にフォルダのidを渡しうることを確かめる（渡さない引数があれば、その引数は直さない）。
        *   **C15**（`ItemListRules.js` 171行付近、`resolveRowHover` の `@param id` の「図形 id」）：行のid（図形またはフォルダ）に直す（呼び出し側 `wiring/ItemListWiring` で、フォルダの行のidが渡りうることを確かめる）。
        *   0-4 を行う（`node --check` 3ファイル、行末＝LF）。

*   [ ] タスク3: `js/wiring`・`js/palette` のコメント（C5・C10・C11・C12）
    *   **対象ファイル** :
        *   `./js/wiring/DisplayWiring.js` :更新（JSDocのみ）
        *   `./js/wiring/ItemListWiring.js` :更新（JSDoc・コメントのみ）
        *   `./js/palette/ItemListPanel.js` :更新（JSDocのみ）
    *   **作業内容** :
        *   **C5**（`DisplayWiring.js` 183行）：「全図形の外枠が」→「見えている図形の外枠が」（使う外枠 `ShapeExtentReader.getAllBounds` が `getVisibleShapes()` から求めることを確かめる）。
        *   **C10**（`ItemListWiring.js` 38行、クラスのJSDoc「一時的な値として、`Shift`＋クリックの起点・自分が出したホバーのid・最後に見た`openCanvasId`だけを持つ」）：描いたサムネイルの鍵・同期の予約を足す。クラスの private フィールドを実コードで数え、列挙と「だけ」が合うことを確かめる（並びは `PROJECT_ARCHITECTURE.md` 3章28.「`Shift`の起点・自分が出したホバーのid・描いたサムネイルの鍵・最後に見た`openCanvasId`・同期の予約」にそろえる）。
        *   **C11**（`ItemListWiring.js` 73行、`#hoveredRowId` の説明「自分が出したホバーとして記録している図形id」）：`#hoveredRowId` へ代入する箇所をすべて確かめ、フォルダのidが入らないなら「図形id（フォルダの行では記録しない）」のように分かる書き方に、入りうるなら行のid（図形またはフォルダ）に直す。どちらにしたかと根拠の行を4章に書く。
        *   **C12**（`ItemListPanel.js` 536行、`startNameEdit` の `@param id` の「図形のid」）：図形またはフォルダのidに直す（同ファイルの他の `@param id` の言い方にそろえる）。
        *   0-4 を行う（`node --check` 3ファイル、行末＝LF）。

*   [ ] タスク4: `js/shapes` のJSDoc（C13・C14）
    *   **対象ファイル** :
        *   `./js/shapes/EndpointSnapRules.js` :更新（JSDocのみ）
        *   `./js/shapes/PathJoinRules.js` :更新（JSDocのみ）
    *   **作業内容** :
        *   **C13**（`EndpointSnapRules.js` 77・141行）・**C14**（`PathJoinRules.js` 271行）：「`model.getShapes()`の並び」を、今渡るもの（変えられる図形だけの並び）に合わせる。書く前に、呼び出し側（`edit/EndpointSnapper`・`edit/PathJoiner`）が渡す並び（`getEditableShapes()` 等）を実コードで確かめ、そのメソッド名で書く。**`shapes/` から `core/` への import・`import()` 型参照を足さない**（文中でメソッド名に触れるのはよい）。
        *   0-4 を行う（`node --check` 2ファイル、行末＝CRLF）。

*   [ ] タスク5: テストの題と不要な1行（C16・C17・C19）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` :更新（`describe` の題のみ）
        *   `./test/core/ItemPlaceRules.test.js` :更新（`describe` の題のみ）
        *   `./test/edit/ShapeInserter.insertTarget.test.js` :更新（1行の削除と分割代入の名前1つの削除のみ）
    *   **作業内容** :
        *   **C16**（432行）：`describe('塗り・線なしの往復（作業データの版2）', …)` → `describe('塗り・線なしの往復（作業データの版4）', …)`（この `describe` の中に `it('serializeの version が 4 である')` があり、版4を確かめているため）。
        *   **C17**（136行）：`describe('insertItemsAt：insertItemsAbove と同じ値（above）', …)` → `describe('insertItemsAt（above）', …)`（無くなった関数名を外す。中の `it` は変えない）。
        *   **C19**（292〜306行のテスト「ShapeInserter 記録しない入口: …」）：最後の `assert.ok(inserter);` の1行を消し、同じテストの先頭 `const { model, history, inserter } = setup();` を `const { model, history } = setup();` にする（このテストの中で `inserter` はほかに使われていないことを確かめてから）。確かめる内容は変えない。
        *   `node --test test/io/DocumentSerializer.roundtrip.test.js test/core/ItemPlaceRules.test.js test/edit/ShapeInserter.insertTarget.test.js` が全件成功し、件数が変わらないことを確かめる（変更前の件数もこの3ファイルで先に測る）。行末（LF／CRLF／CRLF）。C16・C17 の題が `_doc/arch/16_test.md` に書かれているかは、タスク9（C18）で確かめる。

*   [ ] タスク6: `PROJECT_ARCHITECTURE.md` 1章（No.1・3・59・60・61、A1・A2・A3・A4）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :更新（1章のみ）
    *   **作業内容** :
        *   **No.1・A1**（構成図 `ItemTreeRules.js` の項「VectorModel・io/DocumentSerializer・io/SpriteSerializer・ItemAttributeRules・ItemListRulesから使う」）：今の import 元をすべて挙げる（`ItemListRules` は外す）。計画時点の `import` 文の検索結果（JSDocの `import()` 型参照は数えない）：`core/` の `VectorModel`・`ItemAttributeRules`・`ItemRowRules`・`ItemPlaceRules`・`ItemStateRules`・`InsertTargetRules`・`GroupTreeRules`・`GroupSelectionRules`・`GroupCollapseRules`・`ListDragRules`・`RemovalRules`、`edit/GroupEditor`、`io/DocumentSerializer`・`io/SpriteSerializer`。**書く前に `Grep` で `from '…/ItemTreeRules.js'` を検索して自分で確かめる。** 既存の書き方（`core/` は接頭辞なし、他は `edit/`・`io/` 付き）にそろえる。
        *   **A1**（構成図 `GroupTreeRules.js` の項の「…から使う」）：`ItemStateRules`・`RemovalRules`・`SoloVisibilityRules` を足す。（`GroupSelectionRules.js` の項の「…から使う」）：`InsertTargetRules`・`edit/ClipboardController`・`wiring/ItemListWiring` を足す。いずれも `Grep` で確かめてから。
        *   **No.59**（構成図 `TransformInputEditor.js` の項「選んでいる図形を基準点を動かさずに変形する」）・**No.60**（`ShapeAlignEditor.js` の項「選んでいる図形の外枠をそろえる」）：原則4で「選択中の変えられる図形」に（同じ1章の `NudgeEditor` の行の言い方にそろえる）。
        *   **No.61**（1章 `edit/` の説明の「選択中の図形・全図形の外枠の照会（`ShapeExtentReader`。…）」）：選択の外枠は選択中で変えられる図形だけ、全図形の外枠（`getAllBounds`）は見えている図形だけであることが分かるようにする（構成図 `ShapeExtentReader.js` の項の「Phase 11-05：…」の言い方にそろえる）。
        *   **A4**（「存在しないもの」の段落「キー`Home`/`PageUp`/`PageDown`/`End`は選択中の図形1つずつに働くまま」）：選んでいるフォルダも1つのまとまりとして兄弟の並びごとに動かす実態（Phase 11-04a）に合わせる。「やらないこと」としての意味（離れた選択図形をまとめないこと）が残るなら残し、残らなければこの括弧の記述を消す。`edit/ShapeOrderEditor`・`edit/ShapeOrderRules` の実コードで確かめる。
        *   **No.3**（`core/` の説明 Phase 11-02 の文「`ItemListRules`・`ListSelectionRules`・`ListScrollRules`・`ThumbnailRules`は`wiring/ItemListWiring`だけが使う」）：`ThumbnailRules` は `core/ThumbnailRenderer` も import する。範囲を限って正しい断定にする（直後の文の「`ThumbnailRenderer`は…`ThumbnailRules`をimportする」と食い違わないように）。
        *   **A2**（同じ段落の Phase 11-03「描き込む先の規則`InsertTargetRules`（`VectorModel`が唯一の持ち主として呼ぶ。…）」）：描き込む先の値の持ち主が `VectorModel` だけであること（約束として残す）と、規則を import するのは `VectorModel`・`edit/ClipboardController`・`wiring/ItemListWiring` の3つであることが分かる文にする。`wiring/ItemListWiring` が印の規則 `resolveInsertMark` を呼ぶ記述は残す。
        *   **A3**（依存方向の「**例外（Phase 11-02）**：規則どうしの`ItemListRules → ItemTreeRules`・`InputModes`…」）：今は `ItemListRules → InputModes` だけであること（行の並びは `ItemRowRules` へ移った。Phase 11-04a）に合わせる。同じ行の末尾「`shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`のJSDocの「`model.getShapes()`の並び」は、`shapes/`を変えないため残る（…）」は、タスク4（C13・C14）で直ったため消す。消す前に、渡るのが変えられる図形の並びであるという事実が同じ行か3章に残っていることを `Grep` で確かめ、無ければ短く残す。
        *   原則10（1章の中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク7: `_doc/arch/03_VectorModel.md`・`15_io.md`・`12_shapes.md`（No.7・8（`15_io.md`）・10・11・12・13・55、A13）
    *   **対象ファイル** :
        *   `./_doc/arch/03_VectorModel.md` :更新
        *   `./_doc/arch/15_io.md` :更新
        *   `./_doc/arch/12_shapes.md` :更新（A13 の1か所のみ）
    *   **作業内容** :
        *   **No.10・55**（`03` 3行 アイテムの入れ子の項）：No.10＝「状態は非公開の`#items`（アイテムの入れ子の配列）だけ」を原則2で範囲を限った断定（図形の並びの状態は`#items`だけ）に。No.55＝「`replaceAllShapes`・`addShapesWithNewIds`・`addShape`は配列の要素にアイテムまたは素の図形インスタンスを受け」から `addShape` を分け、`addShape` は単一の図形インスタンスだけを受けることが分かるようにする。
        *   **No.11**（`03` 5行 照会の項「`getVisibleShapes()`（…描画・書き出し・⛶の外枠が使う）」）：使い手は描画と⛶の外枠。書き出しは `ItemStateRules.listVisibleShapes` を直接使う（見えている図形だけを書き出すこと自体は正しいので、その事実は落とさない）。
        *   **No.12**（`03` 13行 経路ごとの候補）：`addShapesWithNewIds` は `asUnits` が真なら選んでいるフォルダの候補が空でない（同じ資料の3行の書き方にそろえる）。
        *   **No.13**（`03` 16行「`VectorModel.insertTarget.test.js`（50件。Phase 11-04bで描き込む先の3つの形の11件を足した）」）：11件 → 12件（Survey 4章タスク5の根拠を必要なら読む）。
        *   **No.7**（`15_io.md` 28行「…`test/io/SpriteSerializer.visibility.test.js`（12件）で検証している」）：現在の件数14件に合わせる（`it(` を数えて確かめる）。
        *   **No.8**（`15_io.md` 37行 `DrawElementReader` の知らないこと「ここで見るのは「描画要素の語彙」と「変換に要る項目があるか」だけ」）：`convertEllipse` が `x`・`y`・`radiusX`・`radiusY`・`startAngle`・`endAngle` の有限性と半径の負でないことも見る実態に合わせる（範囲を限った断定にする）。**ここで決めた書き方に、タスク8で `PROJECT_ARCHITECTURE.md` 2章を合わせる**ので、直した後の文言を4章にそのまま書いておく。
        *   **A13**（`15_io.md` 9・10行、`12_shapes.md` 89行の「作業データの版は2（のまま）」「書き出し形式（書き出し）の版は3のまま」）：原則3（当時の値と分かるよう書き添える）。`12_shapes.md` はこの1か所だけを変える。
        *   原則10（各ファイルの中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク8: `PROJECT_ARCHITECTURE.md` 2章（No.5・8（392行）・9・54、A5）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :更新（2章のみ）
    *   **作業内容** :
        *   **No.5**（2章 アイテムの文「`VectorModel`は入れ子のアイテムの配列`#items`だけを状態として持ち、…」）：原則2で範囲を限った断定（図形の並びの状態は`#items`だけ）にする。
        *   **No.8**（2章 組み立ての規則の導入の文「`DrawElementReader`は描画要素の語彙と変換に要る項目の有無だけを見る」）：タスク7で直した `_doc/arch/15_io.md` 37行の書き方にそろえる（4章のタスク7の欄に書いた文言を読む）。
        *   **No.9**（2章 選んでいるフォルダの文の「（図形の選択が空でもフォルダの選択があれば、空のフォルダだけを選んだ状態なので）描き込む先は今の値のまま」と、描き込む先の文の `setSelectionByUser` の説明「空のフォルダだけを選んでいるときは描き込む先は今の値のまま」）：描き込む先は `{ inside, そのフォルダ }` になる実態（`core/InsertTargetRules.resolveNextInsertTarget`・`resolveRowInsertTarget`、`core/VectorModel.setSelectionByUser`）に合わせる。同じ文の規則(1)の説明・`_doc/arch/03_VectorModel.md` 13行と食い違わないように。
        *   **A5**（同じ描き込む先の文の `targetsNewGroup` の説明「選ばれている図形があれば規則(1)が優先」）：選んでいるフォルダも含む「選んでいるまとまりがあれば」に直す。
        *   **No.54**（2章 外枠・外枠のハンドルの位置「選択集合の図形から**毎回求める**（…）」）：原則4で、選択中で変えられる図形から求めることが分かるように（同じ資料の1章 `ShapeExtentReader.js` の項の言い方にそろえる）。
        *   原則10（2章の中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク9: `_doc/arch/16_test.md` 前半（No.56・44/57・36/45・46・47・39/48・40/49・41/50・42/51、C18）
    *   **対象ファイル** :
        *   `./_doc/arch/16_test.md` :更新
    *   **作業内容** :
        *   **No.56**（8行「`globalThis`・`window`へ代入しない。例外は`test/core/KeyboardShortcuts.keydown.test.js`のみ」）：`test/core/KeyboardShortcuts.group.test.js` も同じ形の例外であることを足す（実コードで確かめる。同じ文の後半の説明が両方に当てはまるようにし、長くしない）。
        *   **No.44・57**（10行「例外（…）は12ファイル（Phase 11-04bまで）：…」）：今の `test/edit/`・`test/core/` を数え直し、**数え方（何を例外に数えるか）を文に書いて、列挙と数を合わせる**。計画時点の目安：`test/edit/*.test.js` のうち `core/VectorModel.js` を import するのは42ファイル（しないのは7）、`test/core/` で `VectorModel.*` 以外に `VectorModel` を import するのは `EditableHit.test.js`・`SelectionRules.test.js`（後者が例外に当たるかは中身で確かめる）。推奨：例外の範囲を規則（例：「実物の`VectorModel`を import する`test/edit/`のテストと`test/core/EditableHit.test.js`」）で定めて数を書き、続く個別の組み合わせの説明は「組み合わせ方を書いたもの」として残す。数を保つのが難しければ、数を外して規則と列挙だけにしてよい。いずれにしても、242・253行などの「例外の数え方に加わる」とも食い違わないようにする。どう数えたか（コマンドと結果）を4章に書く。
        *   **No.36・45**（30行 `DocumentSerializer.roundtrip.test.js` の項「`version`は2」）：今のテストの値＝版4に。
        *   **No.46**（130行 `SpriteSerializer.test.js`「`checkFormat`が版1〜3を受理」）：版1〜4 に。同じ行の「版3・`bezierPath`」「**書き換え**：`formatVersion`の期待値2→3」は Phase 09-01a の経緯なので、原則3・5で取り違えやすいかを判断し、変える・変えないを4章に書く。
        *   **No.47**（131行 `FileContentReader.test.js`「版3の曲線のパスを含むJS（`LF`・`CRLF`）が読める、`formatVersion`を2に書き換えた同じJSも読める」）：版4 に（`test/io/FileContentReader.test.js` の該当 `describe`・`it` で、今の版と書き換え先の版を確かめる）。
        *   **No.39・48**（162行）：作業データの版2 → 版4、書き出し形式の版3 → 版4。
        *   **No.40・49**（172行）・**No.41・50**（180行）：「`version`は2のまま」→ 版4（「のまま」の言い方は、今のテストの題「作業データの版は4のまま」にそろえてよい）。
        *   **No.42・51**（191行）：版2 → 版4。「弧は上半分のまま」は、今のテスト（`test/io/DocumentSerializer.roundtrip.test.js` 880行付近）と205行の(c)と食い違わないように直す。
        *   **C18**：タスク5で変えた題（旧「塗り・線なしの往復（作業データの版2）」・旧「insertItemsAt：insertItemsAbove と同じ値（above）」）が `16_test.md` に題として書かれているかを `Grep` で確かめ、あれば新しい題（「塗り・線なしの往復（作業データの版4）」・「insertItemsAt（above）」）にそろえる。無ければ「該当なし」と4章に書く（290行の「旧`insertItemsAbove`と同じ値の5件」はテストの内容の説明で、題の引用ではない）。
        *   テストの件数の記載（No.13・52・53・56・57に関わるもの以外）は変えない。235行付近の「Node.js v24.20.0で確認」は変えない。原則10（同じファイルの中の、版の値の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク10: `PROJECT_ARCHITECTURE.md` 3章3.〜17.（No.18・14・2/37・4/58、A6・A7・A8（696・711行））
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :更新（3章3.〜17.のみ）
    *   **作業内容** :
        *   **No.18**（3. キーボード操作の項「Phase 11-04aで`Ctrl`+`G`（…）・`Ctrl`+`Shift`+`G`（…）を対応表の末尾に足した」）：`invertSelection` の直後（表示の切り替えの前）に合わせる（`_doc/arch/07_KeyboardShortcuts.md` 13行の言い方にそろえる）。
        *   **A6**（14. 重なり順の変更の「選択中の図形の重なり順」「選択中の各図形は並びの上で隣の1つ分だけ動く」）：兄弟の並びごとに、選んでいるまとまり（フォルダを1つのものとして含む）が動く実態に合わせる。「全図形が選択中のときは何もしない」も `edit/ShapeOrderEditor`・`edit/ShapeOrderRules` の実コードの実態に合わせる。
        *   **No.14**（14.「モジュールの分担」「配線＝`main.js`（キーの4つの注入と`performShapeOrder`だけ）」）：行のドラッグの `applyRowDrop`（`shapeOrderEditor.moveTo`）を `ItemListWiring` へ注入していることを足す。
        *   **A7**（14. の `removeSelection()` の「まとまりが無ければ`beginEdit`も呼ばず`false`」）：何も消えないとき（変えられないものだけ）も同じであることを足す（`edit/GroupEditor.removeSelection` で確かめる）。
        *   **No.2・37**（15. 表示の見出しの行「（作業データの版・書き出し形式の版は2のまま）」）：原則3（当時の値と分かるように）。
        *   **No.4・58**（15. 発注者の決定「アウトライン表示の見え方」「ONの間、すべての図形（…）の輪郭を…描く」）：隠れている図形は描かれない（見えている図形が対象。ロックされた図形は描く）ことが分かるように。
        *   **A8**（16. 696行付近・17. 711行付近の版の値）：原則3（当時の値と分かるように）。文言で箇所を特定する。
        *   原則10（3章3.〜17.の中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク11: `_doc/arch/02_main.md`・`06_InputTracker.md`・`08_HistoryManager.md`（No.16・43・62・63・17、`06` 44行）
    *   **対象ファイル** :
        *   `./_doc/arch/02_main.md` :更新
        *   `./_doc/arch/06_InputTracker.md` :更新
        *   `./_doc/arch/08_HistoryManager.md` :更新
    *   **作業内容** :
        *   **No.43**（`02` 3行「`// 7.8.`（重なり順のまとまり。約40行）」）：Phase 11-03 の後は「重なり順（キー）配線」（`ShapeOrderEditor`・`GroupEditor` の生成と `performShapeOrder`）の約24行であることに合わせる（`main.js` の `// 7.8.`〜`// 7.9.` の行で確かめる）。
        *   **No.62**（`02` 41行）・**No.63**（`06` 45行）：`getSelectionFrameBounds` の「選んでいる図形全体の線を含まない外枠」を、選択中で変えられる図形の外枠に（原則4）。
        *   **No.16**（`02` 87行「`// 7.15.`は`ItemRenameEditor`と`ItemListWiring`の生成と注入のみ」）：`ItemStateEditor` を足す。
        *   **`06` 44行**：タスク1の C1 の古い説明（描き込む先のすぐ上・無ければ末尾）を「古い」と断っている記述があれば、C1 で直ったことに合わせてその断りを消す（無ければ「該当なし」と4章に書く）。
        *   **No.17**（`08` 12行「`beginEdit`/`commitEdit`は`InputTracker`（作成・切り取り・ドラッグ。…）」）：`InputTracker` が呼ぶのは作成とドラッグだけ。切り取りの記録は `ClipboardController.cut` → `inputTracker.deleteSelection()` → `GroupEditor.removeSelection()` が挟むことが分かるように（同じ括弧の「削除の記録は、Phase 11-04aから`GroupEditor`が挟む」とまとめて短く）。
        *   原則10（各ファイルの中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク12: `PROJECT_ARCHITECTURE.md` 3章18.〜27.（No.15/38、A8（760・773・790・896行）、A9）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :更新（3章18.〜27.のみ）
    *   **作業内容** :
        *   **A8**（19. 760行付近・20. 773行付近・21. 790行付近・27. 896行付近の版の値。896行は「版3」「版4」）：原則3（当時の値と分かるように）。文言で箇所を特定する。
        *   **No.15・38**（24.「保存・書き出し・結合」「図形データのキーは増えない（作業データの版は2、書き出しの版は3のまま）」）：原則3。
        *   **A9**（20. 788行付近・27. 915行付近の「選択の外枠（`ShapeExtentReader`）」＝線を含まない外枠 `getSelectedGeometryBounds`、21. 806行付近＝図形ごとの外枠 `getSelectedBoundsPerShape`）：実際に読むものに直す（各 `edit/` の実コードで呼ぶメソッドを確かめる）。
        *   直した版の書き方を、タスク10で直した 3章15.・16.・17. の書き方とそろえる。原則10（3章18.〜27.の中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク13: `_doc/arch/01_index_html.md`・`13_palette.md`・`61_ItemRowRules.md`（No.21・22・23・28・29・64）
    *   **対象ファイル** :
        *   `./_doc/arch/01_index_html.md` :更新
        *   `./_doc/arch/13_palette.md` :更新
        *   `./_doc/arch/61_ItemRowRules.md` :更新
    *   **作業内容** :
        *   **No.23**（`01` 15行 オプションバーの角のまとまり「収まらないときは右のまとまりから切れる（角→整列・分布→位置→スタイルの順）」）：今の2行の構成（行ごとに切れる。2行目の右から 角→整列・分布→変形→大きさ→位置）に合わせる（`index.html` の該当のCSSコメントと要素の並びで確かめる）。
        *   **No.22**（`01` 17行「1行目約646px・2行目約1026px」）：1行目は Phase 11-03 の後の約489px（同じ資料の16行・`index.html` のCSSコメントで確かめる）。
        *   **No.21**（`13` 87行 `ItemListPanel.js` の「使う側」「`wiring/ItemListWiring`だけ（生成・購読・同期）」）：`wiring/ItemListRowDrag` も注入された `panel` のメソッドを呼ぶことを足す（生成は `ItemListWiring` だけ）。
        *   **No.64**（`13` 68行 オプションバーの「選択中の図形…」）：原則4で、選択中で変えられる図形が対象であることが分かるように（新しく描く図形のスタイルは別）。
        *   **No.28**（`61` 4行 `resolveRowIndent(depth)` の「名前の幅の見積もり」）：`index.html` のCSSの値から計算し直す（目・鍵のアイコンの帯 `.item-row-states`、行の `gap`、フォルダの三角・フォルダの絵の幅、サムネイルの幅など、計算に入れたものを文に書く）。実測ではないことが分かるように書く。「どちらも名前が読める」は、計算し直した値で言えなければ外す。計算の式と値を4章に書く。
        *   **No.29**（`61` 8行「読むもの：…だけ」）：図形のアイテムの `item.shape` を足す。
        *   原則10（各ファイルの中の同じ誤り）を確かめる。0-4 を行う（`index.html` は読むだけで変えない）。

*   [ ] タスク14: `PROJECT_ARCHITECTURE.md` 3章28.（No.24〜27・30〜32、A10・A11・A12）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :更新（3章28.のみ）
    *   **作業内容** :
        *   **No.25・A10**（「モジュールの分担」「一覧が`wiring/`の一時的な値として持つのは、…同期の予約だけ」と、同じ行の「変えていない」）：`wiring/ItemListRowDrag` も行のドラッグの一時的な値を持つことに合わせる（`ItemListWiring` の5つと分けて書く。`_doc/arch/53_ItemListWiring.md` の言い方と食い違わないように。53 は変えない）。「変えていない」は Phase 11-02 の時点で変えなかった経緯と分かるように（No.27 と書き方をそろえる）。
        *   **No.26**（「一覧で選ぶ」「`Shift`の起点は、ふつうのクリックと`Ctrl`＋クリックでだけ変わる」）：行のドラッグの押下で選ぶ `selectRow` でも変わり、キャンバスの切り替えで `null` になることを足す。
        *   **No.27**（「名前の編集」「（`KeyboardShortcuts`・`FocusKeyYieldRules`は変えていない）」）：そのPhase（11-02）の時点の経緯と分かるようにする。
        *   **No.30・A11**（`canStartRowDrag` の条件の列挙）：押したのが目・鍵のアイコンの上でないこと（`isOnStateIcon`。Phase 11-05）を足す。同じ箇所の「**フォルダがあっても始まる**＝Phase 11-04aの引数`hasGroups`は消した）」の開き括弧の欠けを直す。
        *   **A10**（930行付近の「変えていない」。Phase 11-03）：その時点の経緯と分かるように（No.27 とそろえる）。
        *   **No.31**（描き込む先の見せ方と変え方「新しい図形（描く・貼り付け・複製・`Alt`+ドラッグ・インポート）と…は、描き込む先の場所へ入る」）：複製は選んでいるまとまりの一番上のもののすぐ上（`resolveDuplicatePlace`）、貼り付けは描き込む先が自分のコピーのフォルダの中ならそのフォルダのすぐ上（`resolvePastePlace`）であることを書き分ける（`core/InsertTargetRules`・`edit/ClipboardController` で、`Alt`+ドラッグがどちらを使うかも確かめる）。
        *   **No.32**（行の並び「行は`{ … }`」「`resolveRowViews`が…`{ … }`を決める」）：`visible`・`locked`・`hiddenByAncestor`・`lockedByAncestor`・`hidden` の5つ（Phase 11-05）を、`core/ItemRowRules.js` の `ItemRow`・`RowView` の実際のキーで確かめて足す。
        *   **A11**（935行付近）：フォルダの行にも末尾に目・鍵のアイコンがあること（Phase 11-05）を足す。
        *   **A12**（942行付近 確認の状況（Phase 11-03）の `ItemTreeRules.insertItemsAbove`・`ShapeOrderEditor.applyOrder`）：Phase 11-04b で消えたことを書き添える。
        *   **No.24**（945行付近「Phase 11-04bのふるまいの注意」(k)「…（空のフォルダを除く）だけ」）：空のフォルダも選べる実態（`core/GroupSelectionRules.js` の不変条件、`test/core/VectorModel.groupSelection.test.js` の「空のフォルダは図形の選択が空でも選べる」）がはっきり読める文にする。
        *   原則10（3章28.の中の同じ誤り）を確かめる。0-4 を行う。

*   [ ] タスク15: `_doc/arch/07_KeyboardShortcuts.md`・`14_edit.md`・`46_ItemTreeRules.md`（No.6・19・20・65、A14）
    *   **対象ファイル** :
        *   `./_doc/arch/07_KeyboardShortcuts.md` :更新
        *   `./_doc/arch/14_edit.md` :更新
        *   `./_doc/arch/46_ItemTreeRules.md` :更新
    *   **作業内容** :
        *   **No.19**（`07` 3行「`ShiftRule.REQUIRED`のエントリは、…だけで」）：`Ctrl`+`Shift`+`G`（`ungroup`）を足す。
        *   **No.65**（`14` 78行 `ShapeAlignRules.js`「選んでいる図形の整列・分布の規則」）：原則4で、渡る外枠が選択中で変えられる図形のものであることが分かるように（次の `ShapeAlignEditor.js` の段落の言い方にそろえる）。
        *   **No.20**（`14` 108行「`restore`＝`replaceAllShapes(result.items, { keepInsertTarget: true })`」）：`restoreCollapsed(…)` を通した `items` を渡す実態に合わせる（続く109行と重ならないよう短く）。
        *   **A14**（`14` 137行「`edit/`から`core/`をimportする8つ目の例外」）：Phase 11-02 の時点の数だと分かるようにするか、数を外す。
        *   **A14**（`46` 10行「使う側」）：今の import 元の不足分（`core/ItemPlaceRules`・`core/InsertTargetRules`・`core/ItemStateRules`・`core/ListDragRules`・`core/RemovalRules`）を足す（`Grep` で確かめ、タスク6で直した `PROJECT_ARCHITECTURE.md` 1章の `ItemTreeRules.js` の項の列挙と食い違わないように）。
        *   **No.6**（`46` 11行「`VectorModel`は`#items`だけを状態にでき…」）：原則2で範囲を限った断定に（タスク7・8の `03_VectorModel.md`・2章の書き方にそろえる）。
        *   原則10（各ファイルの中の同じ誤り）を確かめる。0-4 を行う（`07`・`46` は LF）。

*   [ ] タスク16: `_doc/arch/16_test.md` 後半（No.33・34・35・52・53、Phase 11-03の項の消えた関数の断り）
    *   **対象ファイル** :
        *   `./_doc/arch/16_test.md` :更新
    *   **作業内容** :
        *   **No.52**（246行 Phase 11-02 の項「新設7ファイル96件」）：100件に（+114 と合う）。
        *   **No.53**（258行 Phase 11-03 の項「既存6ファイルへの追加39件・消した1件」）：追加40件・消した1件（純増39件）と読めるように（265行の個別の値「+6件・−1件」と合うことを確かめる）。
        *   **259〜265行（Phase 11-03 の項）**：今の HEAD に無い関数（`resolveInsertTarget`・`resolveInsertMarkId`・`toDrawOrder`・`isSameOrder`・`applyOrder`・`insertItemsAbove`）が今は無いこと（Phase 11-04b で置き換えた・消した）を、項の中の1文で断る（各関数が今の `js/` に無いことを `Grep` で確かめてから）。
        *   **No.33**（287行 11-04a の「テストできない箇所」「`main.js`の`// 7.8.`の`groupEditor`・`performGroupCommand`・`onCollapsedChange`の登録・`// 8.`の`group`・`ungroup`の注入」）：`performGroupCommand` は `// 8.`、`onCollapsedChange` の登録は `// 7.6.` であることに合わせる（`main.js` で確かめる）。
        *   **No.34**（312行 11-06a の (a)「各ファイル内の`withSource`」）：`withSource` を持つのは4ファイルで、ほかはその場で `source` を足す別の書き方であることが分かるように。
        *   **No.35**（312行の頭書き「(a)〜(d)は入力・見分け方だけ。期待値の観点は変えない」）：`FileContentReader.test.js` の「sourceが無いスプライト（…）」で JS の期待が読み込み不可から読めるへ変わったことと食い違わないようにする（Survey 4章タスク16を必要なら読む）。
        *   テストの件数の記載（No.13・52・53・56・57に関わるもの以外）は変えない。235行付近は変えない。原則10を確かめる。0-4 を行う。

*   [ ] タスク17: 要件8の確認と懸念事項の記入（固定タスク）
    *   **対象ファイル** :
        *   本RES :更新（4章・5章）
    *   **作業内容** :
        *   変えた `js/` の全ファイル（タスク1〜4の12ファイル）を `node --check` で確かめる。
        *   プロジェクトのルートで `node --test` を実行し、全件成功すること（変更前は tests 3699 / suites 609 / fail 0。件数は変わらないはず）を確かめ、件数を4章に記す。
        *   `git diff` で、`js/` の変更がコメント・JSDocだけであること、`test/` の変更が C16・C17・C19 だけであること、`index.html`・`sprite-check.html` に変更が無いこと、2章「変更してはならないもの」に変更が無いことを確かめる（`git diff --stat` と、`js/` の各 hunk の確認）。
        *   `wc -l js/main.js js/core/InputTracker.js` が 1234・2023 のままであることを確かめる。
        *   触った全ファイル（0-3 の表）の行末が保たれていることを、0-3 の方法で確かめる。
        *   **No.1〜No.65・A1〜A14・C1〜C19 がすべて処理されたこと**を、番号を並べて4章に記す（重複の項は対の番号とともに）。直せなかったもの・直さないと判断したものは、番号と理由を書く。
        *   「5. 懸念事項・要確認ポイント」に、判断に迷った点、資料の別の箇所との整合で気づいた点（各タスクで5章へ追記されたものの整理を含む）を記述する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `js/core` 入力系と `main.js` のコメント（C1・C2・C3・C4・C8）
*   **作業内容** :
    *   **C1**（`InputTracker.js` click のJSDoc）：「描き込む先のすぐ上へ入り、描き込む先が無ければ末尾」→「行の上ならその行のすぐ上・フォルダの中ならその一番上か一番下へ入り、描き込む先が無ければいちばん外側の末尾」。根拠：`VectorModel.commitDraft`→`#placeAdded`→`ItemPlaceRules.insertItemsAt`（ABOVE＝行の直後の添字、INSIDE＝フォルダ内の list 末尾、BOTTOM＝list 先頭、place が null＝外側の末尾）。同じ行内で置換。
    *   **C2**（`InputTracker.js` コンストラクタ `@param inputAssist`）：列挙へ `deleteSelectedItems` を追加（typedef・`NO_INPUT_ASSIST`・412〜447行付近の既定置換で確認）。「省略時は…」の括弧にも既定の動き（`NO_INPUT_ASSIST.deleteSelectedItems` は空関数）を「削除の実体は何もしない」として追記。行数不変。
    *   **C3**（`KeyboardShortcuts.js`）：`selectAll`「全図形を選択する」→「変えられる図形を全て選択する」（`InputTracker.selectAll` は `getEditableShapes`）。`deleteSelection`「選択集合の全図形を削除する」→「選択中の変えられる図形と選んでいるフォルダを削除する」（`GroupEditor.removeSelection`）。`invertSelection`「全図形のうち…」→「変えられる図形のうち…」（`main.js` の `getEditableShapes`）。`resetColors`「その全図形へ記録し」→「その変えられる図形へ記録し」（`ShapeStyleEditor` は `getEditableSelectedShapes` 対象）。
    *   **C4**（`InputModes.js`）：`MOVING_SELECTION`「選択集合の全図形を平行移動する」→「選択中の変えられる図形を平行移動する」（`InputTracker` の移動は `getEditableSelectedIds`/`getEditableSelectedShapes`）。
    *   **C8**（`main.js` 343行）：「ここでmodel.deleteShapesを直接呼ばないこと」→「ここでGroupEditor.removeSelectionを直接呼ばずinputTracker.deleteSelection()を通すこと」。行数不変。
    *   検証：`node --check` 4ファイル通過。行数 main.js 1234・InputTracker.js 2023 のまま。行末は4ファイルとも LF＝CR（CRLF保持）。
    *   原則10：同ファイル内に同じ誤りは見当たらず（追加修正なし）。

### タスク2: `js/core` モデル・一覧の規則のコメント（C6・C7・C9・C15）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク3: `js/wiring`・`js/palette` のコメント（C5・C10・C11・C12）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク4: `js/shapes` のJSDoc（C13・C14）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク5: テストの題と不要な1行（C16・C17・C19）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク6: `PROJECT_ARCHITECTURE.md` 1章（No.1・3・59・60・61、A1・A2・A3・A4）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク7: `_doc/arch/03_VectorModel.md`・`15_io.md`・`12_shapes.md`（No.7・8（`15_io.md`）・10・11・12・13・55、A13）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク8: `PROJECT_ARCHITECTURE.md` 2章（No.5・8（392行）・9・54、A5）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク9: `_doc/arch/16_test.md` 前半（No.56・44/57・36/45・46・47・39/48・40/49・41/50・42/51、C18）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク10: `PROJECT_ARCHITECTURE.md` 3章3.〜17.（No.18・14・2/37・4/58、A6・A7・A8（696・711行））
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク11: `_doc/arch/02_main.md`・`06_InputTracker.md`・`08_HistoryManager.md`（No.16・43・62・63・17、`06` 44行）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク12: `PROJECT_ARCHITECTURE.md` 3章18.〜27.（No.15/38、A8（760・773・790・896行）、A9）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク13: `_doc/arch/01_index_html.md`・`13_palette.md`・`61_ItemRowRules.md`（No.21・22・23・28・29・64）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク14: `PROJECT_ARCHITECTURE.md` 3章28.（No.24〜27・30〜32、A10・A11・A12）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク15: `_doc/arch/07_KeyboardShortcuts.md`・`14_edit.md`・`46_ItemTreeRules.md`（No.6・19・20・65、A14）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク16: `_doc/arch/16_test.md` 後半（No.33・34・35・52・53、Phase 11-03の項の消えた関数の断り）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク17: 要件8の確認と懸念事項の記入（固定タスク）
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
* （計画時点）番号の割り当て：No.1〜65 と A1〜A14・C1〜C19 は、次のとおりタスクへ割り当てた（漏れの確認用）。
  * タスク1＝C1・C2・C3・C4・C8／タスク2＝C6・C7・C9・C15／タスク3＝C5・C10・C11・C12／タスク4＝C13・C14／タスク5＝C16・C17・C19
  * タスク6＝No.1・3・59・60・61、A1・A2・A3・A4／タスク7＝No.7・8（`15_io.md`）・10・11・12・13・55、A13／タスク8＝No.5・8（`PROJECT_ARCHITECTURE.md`）・9・54、A5
  * タスク9＝No.36・39・40・41・42・44・45・46・47・48・49・50・51・56・57、C18／タスク10＝No.2・4・14・18・37・58、A6・A7・A8（696・711）
  * タスク11＝No.16・17・43・62・63／タスク12＝No.15・38、A8（760・773・790・896）・A9／タスク13＝No.21・22・23・28・29・64
  * タスク14＝No.24・25・26・27・30・31・32、A10・A11・A12／タスク15＝No.6・19・20・65、A14／タスク16＝No.33・34・35・52・53
* （計画時点）順序の依存：A3（タスク6）は C13・C14（タスク4）の後、`06_InputTracker.md` 44行（タスク11）は C1（タスク1）の後、`PROJECT_ARCHITECTURE.md` 2章の No.8（タスク8）は `15_io.md` 37行（タスク7）の後、C18（タスク9）は C16・C17（タスク5）の後になるよう並べた。同じファイルを触るタスクは並べていない。
* （計画時点）No.44・57（`16_test.md` 10行の例外の数）は、数え方によって数が大きく変わる（`test/edit/` で `VectorModel` を import するのは計画時点で42ファイル）。数え方の選択と、`test/core/SelectionRules.test.js` を例外に含めるかはタスク9で決め、4章に根拠を書く。
