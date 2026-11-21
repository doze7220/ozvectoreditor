# RES: 作業計画・作業レポート (Interrupt) : Phase 9 クローズの開発資料の相違の修正（資料29件＋コードのコメント3か所）
* 参照元REQ: `./_log/req/261121_2143_REQ_Interrupt_Phase09_Close_Doc_Fix.md`

## 1. 作業目的
Phase 9 のクローズの整合確認（Survey `./_log/res/261120_1637_RES_Survey_Phase09_Doc_Consistency.md`）で見つかった、開発資料と実コードの相違26件（5章の箇条を上から数えた No.1〜No.26。No.19 はコードのJSDoc）、古くなった記述4件（A1〜A4）、コードのコメント2か所（`js/main.js` の削除ボタン・切り取りのコメント）を、すべて実コードに合わせて直す。開発資料の第一の目的はハルシネーションの防止であり、列挙の取りこぼし・断定の誤り・ツールの範囲の古さを残さない。**コードのふるまいは一切変えない**（`.js` で変えるのはコメント行3か所だけ）。

* 本作業は開発資料の修正そのものが目的のため、テンプレートの「開発資料の書き換えは最終タスクのみ」は適用しない。各タスクが担当する資料を直す。
* 資料の行番号は Survey の時点（コミット `63435ba`）のもの。各タスクでは**行番号ではなく記述の文言で箇所を特定する**（タスクを進めると行内の文字数は変わるが、行数は増減させない）。
* 5章の記述と実コードが食い違う（Survey の調査が誤っていた）と分かった箇所は直さず、該当タスクの詳細作業内容に相違点を書いて作業を中断し、指示を待つ。

## 2. アーキテクチャ設計
### 共通の直し方（全タスクが従う。各タスクの実行時に必ず読む）
1. **列挙の取りこぼし**：実コードに合わせて不足分を足す。同じ資料の別の文に書かれている事実でも、参照で済ませず、その列挙にも足す。
2. **断定・限定の文**：実態と合わなければ断定を外して実態を書く。設計として守りたい約束なら、約束が崩れている事実を書いたうえで約束は残す（決められなければ直さずに報告）。
3. **ツールの範囲**：「直線のツール」と書いた文が曲線のツールにも当てはまるなら「直線・曲線のツール」に、「直線以外」で曲線のツールが通らない枝なら「直線・曲線以外のツール（弧・矩形・円）」に直す（`PROJECT_ARCHITECTURE.md` 3章12.の「表示を消す箇所」が既に使う「直線・曲線以外」にそろえる）。
4. **行末を保つ**：REQは「すべてCRLF」と書くが、計画時の実測（`git ls-files --eol` と CR の数）では次のとおり。**どちらの場合も、今の行末を変えないこと**（一括処理で変換しない）。
    * CRLF（行数＝CRの数）：`PROJECT_ARCHITECTURE.md`（740行）・`_doc/arch/06_InputTracker.md`（42）・`12_shapes.md`（88）・`14_edit.md`（105）・`15_io.md`（37）・`16_test.md`（196）
    * LF（CRは0）：`_doc/arch/10_ShapeFactory.md`（9行）・`28_MoveDirectionRules.md`（7）・`30_UnitSnapRules.md`（14）・`40_asset_sprite.md`（6）・`js/main.js`（1074）・`js/shapes/PathCornerRules.js`（187）
    * 確認の方法：`wc -l < ファイル` と `tr -cd '\r' < ファイル | wc -c` を比べ、上の値（行数・CRの数）のまま変わっていないこと。
5. **既存の表記を崩さない**：バッククォート・箇条の形・節の順序・言い回しの調子は既存にそろえる。相違の修正に必要のない箇所は1文字も変えない（例外は6.の差し引きだけ）。
6. **長くしない**：不足分を足すために文を伸ばすときは、**同じ節の中で**冗長になった表現を削って差し引きを取る（REQの原則6のとおり）。5.との両立：削ってよいのは、相違の修正で伸びた分の差し引きに限り、同じ節（`PROJECT_ARCHITECTURE.md`は番号付きの項目〔例：3章22.〕、1章・2章は太字の見出しの箇条、`_doc/arch/`は1つの`.js`ファイルの項）の中で、同じ事実を二重に書いている・修正の結果として冗長になった表現だけ。事実・経緯の付記・参照先の章番号は削らない（消すか迷ったら残す）。
    * 本RESの「3. タスクリスト」の各置き換え案に「**差し引き**」の欄を置き、差し引きを取る箇所（取る場合）か、取らない理由（伸びが小さい、または同じ節に削る冗長な表現が無い）を書いた。実装時はその欄のとおりにし、欄に挙げた以外の箇所を削らない。欄の判断と実際の資料が合わない（欄が挙げた表現が見当たらない・ほかに明らかな重複がある）ときは、削らずに詳細作業内容へ書く。
    * 置き換え後の文は差し引きを考えた案で、原則としてこのとおりに書く。
7. **経緯の付記には触れない**：「（Phase 09-0xx）」「（Interrupt。…）」「発注者の決定」などは、内容を変える必要がなければそのまま残す。
8. **言い回しの統一（本計画で決めるもの）**：
    * **曲がり方を持つ区間まで含めた条件**：条件の形は「直線でない区間（曲線の区間・曲がり方を持つ区間）を1つ以上持つ」、名詞の形は「曲線の区間・曲がり方を持つ区間」。3章22.の用語の定義「曲線の区間＝区間の種類`'smooth'`の区間」は変えない（定義どおりに使う文が他にあるため。直すのは、この語を`'bezier'`まで含めて使っている側）。
    * **作成途中の線（点を打った後）**：「直線・曲線のツールで点を打って頂点が3つ以上になった作成途中の線（`PathJoinRules`の`buildDrawnDraft`・`buildLineOrPath`）」を核にする（No.2・No.17(1)）。
    * **始点で閉じる終わり方**：「吸い付きなし・始点で閉じる＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`」、もう一方は「描き足し・つながり・既存の線を閉じる」（No.4・No.8。3章2.の「当てないもの」の言い方にそろえる）。
    * **版3の連絡**：「版3への版上げは連絡済み（Phase 09-04…）」（No.3・No.24。`PROJECT_ARCHITECTURE.md` 2章のエンジンとの約束(c)にそろえる。(c)は変えない）。
9. **コミットの前提**：計画は `… PLAN` としてコミットされ、各タスクは実装後のdiff監査に合格すると `RESファイル名 TASKn` としてコミットされる。各タスクの開始時には前のタスクまでがコミット済みである前提とし、タスク1〜8の `git diff` はそのタスクの変更だけを見る。本作業全体の変更を見るタスク9は、本作業の開始時点のコミット `933c52e`（REQのコミット）と作業ツリーを比べる。

### 要件1: `PROJECT_ARCHITECTURE.md` 1章（No.1）→ タスク1
* 「依存方向」の「`core/`内のimportは、処理・レンダラー・小さな部品が状態を持たない規則の関数をimportする向きだけ」は、`core/InputTracker.js:7` が状態を持つクラス `core/DragTracker` をimportする事実と合わない（`InputTracker` が生成して所有する。`InputTracker.js:452`）。後半「逆向き（規則が状態を持つクラスをimportする）は無い」は正しいので残す。

### 要件2: `PROJECT_ARCHITECTURE.md` 2章・`_doc/arch/15_io.md`・`40_asset_sprite.md`（No.2・No.3・No.24・No.26の252行）→ タスク1
* No.2：`path` の「作られるのは」の列挙に、点を打って頂点が3つ以上になった作成途中の線（直線・曲線のツール。`PathJoinRules.js:631-634` `buildDrawnDraft`・`:603-609` `buildLineOrPath`。`addDrawnPoint` が呼ぶ）を足す。
* No.3・No.24：「版3の連絡票は未送付でPhase 09-04で出す」を連絡済み（Phase 09-04。記録は `./_log/res/261120_1441_RES_Phase09-04_Engine_Roundtrip.md`）に直す。REQの確定事項。2章245行(c)は変えない。
* No.26（252行）：`"bezierPath"` の括弧の条件を、曲がり方を持つ区間も含む条件に直す（`Path.js:541` のJSDoc「曲線の区間（曲がり方を持つ区間を含む）を1つ以上持つなら`bezierPath`」）。同じ行の後半は変えない。

### 要件3: `PROJECT_ARCHITECTURE.md` 3章6.・11.・12.・`_doc/arch/14_edit.md`（No.4〜No.8）→ タスク2
* No.4・No.8：始点で閉じて終える経路（`EndpointSnapper.js:256-259` → 非公開の `#commitDrawnShape`〔`:330-335`〕＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`）を終わり方の列挙に足す。
* No.5：11.冒頭の結合できる線の列挙に弧を足す（`PathJoinRules.js:81-83` `isJoinableLine`。11.の「結合できる線」の項と合わせる）。
* No.6：`14_edit.md` の「`edit/`の他のクラスは`shapes/`をimportしない」は、`PathCornerEditor`（`js/edit/PathCornerEditor.js:7-8`）が `shapes/` をimportする事実と合わない。
* No.7：「従来の確定`commitDraft`は直線以外のツールの`handleClick`で」は、曲線のツールがこの枝に来ない（`InputTracker.js:1030-1038` の `clickDrawnLine` の枝で `return`）実態に合わせる。来るのは弧・矩形・円だけ（`:1040-1046`）。

### 要件4: `PROJECT_ARCHITECTURE.md` 3章22.・`_doc/arch/06_InputTracker.md`（No.9〜No.13）→ タスク3
* No.9・No.10：`Esc` の「直線以外は従来どおり破棄／今のまま」は、曲線のツールの作成途中の線も `isDrawingLine()` が真で `#finishDrawnLine()` を通る（`InputTracker.js:601-604`）実態に合わせる。破棄（`:606`）は弧・矩形・円だけ。
* No.11：`06_InputTracker.md` の「配線の場面（直線以外・…）」の「直線以外」を、曲線のツールが通らない実態（`InputTracker.js:843-849`・`:1030-1038` で `return`）に合わせる。同じファイルの「線を引いている途中の配線（`DRAWING`。直線・曲線のツール…）」と食い違わないようにする。
* No.12：22.「既存の線とつながる・閉じる」の「途中の点が要るのは相手が直線のとき」は、今の曲線・弧も途中の点なしでは閉じない（`buildClosedPath` が `type !== 'path'` で `null`。`PathJoinRules.js:290-308`）実態に合わせる。11.の「弧の結合」の項（「直線・今の曲線の同じ操作と同じ今の規則のまま」）・22.の「曲線のツール」の項（「同じ弧の両端の間を途中の点なしで引いても何も起きない」）と合わせる。
* No.13：`06_InputTracker.md` の「表示を消す箇所」の `#resetSnapState()` の列挙に、`removeLastLinePoint()` の始点だけでやめる枝（`InputTracker.js:704-706`）を足す。

### 要件5: `PROJECT_ARCHITECTURE.md` 3章23.・`_doc/arch/16_test.md`（No.14・No.15・No.20・A1・A2）→ タスク4
* No.14・A1：見積もり「約1189px」を `index.html:447` の現在のコメントの「約1261px」に直す（24.の「確認の状況」の「約1261px」と同じ値になる）。
* No.15：「続けるには`Tab`で戻る」は実態と合わない。`blur()`（`OptionBarCornerGroup.js:94`）の後は何にもフォーカスが無く、`Tab` はパレットを隠す/出すだけ（`KeyboardShortcuts.js:184` の `toggleFloatWindows`。3章15.の「`Tab`の扱い」・`_doc/arch/07_KeyboardShortcuts.md` 5行と同じ事実。この2か所は変えない）。「許容」は残す。
* No.20：`new Curve(…)` への置き換えは3ファイル（`DocumentSerializer.roundtrip.test.js`・`DocumentSerializer.errors.test.js`・`CanvasFileOperations.test.js`。同じ項目の上の行が挙げる3つ）。
* A2：`EndpointSnapRules.test.js` の「対象」の範囲を、テストが確かめている現在の範囲（曲線のパス〔09-01b〕・今の曲線の始点と終点〔09-03a。制御点には吸い付かない〕・弧の左端と右端〔09-03b。中心・頂上には吸い付かない〕・円は対象外）に直す（`test/shapes/EndpointSnapRules.test.js` の `describe` 381・501・544行の各ケース）。テストの件数の記載は変えない。

### 要件6: `_doc/arch/12_shapes.md`（No.16・No.17・No.18・No.25・No.26の40・51・52行・A3・A4）→ タスク5
* No.16：`assembleOpenPath` の呼び出し元は `buildJoinedPath`（`PathJoinRules.js:346`）・`buildJoinedPathAt`（`:402`）・`buildExtendedPath`（`:421`）の3つで、`buildClosedPath` は使わない（`:294-307` で `chainOf` の写しから自分で `new Path`。同じ資料の「角の点（Phase 09-02a）」の項と同じ事実）。「唯一の箇所」は `assembleOpenPath` のJSDoc（`:350-351`「頂点・区間の種類・角の点の並べ方の規則はここだけに置く」）の約束なので、範囲（開いたパスへつなぐとき）を明示して約束は残す。
* No.17：(1)「作る操作」に作成途中の線（`PathJoinRules.js:633`・`:608`）と角の切り替え（`PathCornerRules.js:175` `planCornerToggle`）を足す。(2)「区間ごとの配列も受ける」の使い道に角の切り替え（`PathCornerRules.js:181`）と区間の切り替え（`PathSegmentKindRules.js:171`・`:193`）を足す。同じ資料の `PathCornerRules.js` の「公開」「読むもの」の項と合わせる。
* No.18：`findSnapTarget`・`resolveEndpointHandle` の対象の括弧の弧の部分を、`resolveEndpointHandle` は弧のどのハンドルにも `null`（`EndpointSnapRules.js:64-65`）という同じ資料の「読むもの」「注意」・`Ellipse.js` の項と合う形に直す。
* No.25：`Path.fromJSON` の区間は `copySegment` が写す（`Path.js:671`・`:74-86`。`'bezier'` は `control1`・`control2` も複製）。
* No.26（40・51・52行）：共通の直し方8.の言い回しに直す（`Path.js:233`・`:251-254`・`:279-280`・`:541`）。
* A3：見出し「直線のツールで線を続けて引く作業の追加（3章22.）」を、同じ資料の `EndpointSnapRules.js` の「公開」の項の見出し「直線・曲線のツールで線を続けて引く作業の追加（3章22.）」にそろえる。見出しの後の列挙は変えない。
* A4：「`isPointInPolygonNonzero（」のバッククォートの閉じ忘れを直す。ほかの文字は変えない。

### 要件7: `_doc/arch/10_ShapeFactory.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md`（No.21・No.22・No.23）→ タスク6
* No.21：`create` の戻り値（作成途中の図形）の `type` は `PathJoinRules.isDrawnLineShape`（`PathJoinRules.js:66-70`）が読む（`EndpointSnapper.isDrawingLine()`〔`EndpointSnapper.js:194-197`〕が `getDraftShape()` を渡す）。「呼び出し元は`VectorModel.startDraft`だけ」は正しいが、同じ項目の「置き場所の理由」が同じ事実を書くため、括弧からは外して差し引きに充てる（事実は「置き場所の理由」に残る）。
* No.22：足したimportは `SEGMENT_KIND_SMOOTH` だけ（`Path` は前から `path` の `fromJSON` のためにimport。`ShapeFactory.js:9`）。
* No.23：曲線のツールの作成途中の線も `InputTracker.js:843-847` → `#resolveDrawnLineEnd`（`:790-797`）を通る。30の「`Shift`だけ」の限定は残す。

### 要件8: コードのコメント3か所（No.19・`main.js` の2か所）→ タスク7
* No.19：`js/shapes/PathCornerRules.js` の typedef `CornerTarget` のJSDocの説明行（24行「 * 選んだ点。」）に、`SegmentSwitchTarget`（`js/shapes/PathSegmentKindRules.js:23`）と対になる1文を足す（1行のまま）。`SegmentSwitchTarget` 側は変えない。
* `js/main.js` 305行・502行：キーボードのショートカット（Delete/Backspace）は `inputTracker.deleteLastLinePointOrSelection()`（`main.js:906`。`InputTracker.js:717` は `this.removeLastLinePoint() || this.deleteSelection()`）を通り、削除ボタン（`:306`）と切り取り（`:503`）は `deleteSelection()` を通る実態に合わせる。904行〜906行のコメントは正しいので変えない。
* 実行されるコードは1行も変えない。行数も増やさない。

### REQの補足決定（現場設計セッションの回答。2026-11-21）：No.19 に伴う資料の2か所 → タスク8
* No.19 で `CornerTarget` のJSDocに1文を足すと、`_doc/arch/12_shapes.md` 29行（`PathSegmentKindRules.js` の「公開」の typedef`SegmentSwitchTarget` の括弧）と `PROJECT_ARCHITECTURE.md` 3章24.「モジュールの分担」（681行）の「`CornerTarget`側からの言及は無い」とその理由（「`PathCornerRules`を変えないため」「`PathCornerRules`は変えないファイルのため」）の文が事実と合わなくなる。計画時の質問に対する回答 (A) により、**この2か所の該当の文だけ**の変更禁止を解き、互いのJSDocに関係が書かれている旨に直す。
* 3章24.のほかの文と、REQが【変更してはならないもの】に挙げたほかの箇所（2章245行・3章22.640行・524行など）は今のまま変えない。
* 理由：発注者はJSDocの修正を含めて3か所とも直すと決めており、この2文はJSDocを直した結果として事実が変わる記述にあたる。REQの決定から外れた点として、5.の懸念事項1に残す。
* タスク7（JSDocの修正）の後に、資料2ファイル・この1件だけを扱うタスク8で直す（タスク7に入れると1タスクの対象が4ファイルになるため分けた。JSDocが直る前に資料だけ先に変わらない順にした）。

### 要件9: 確認 → タスク9
* `node --check js/main.js`・`node --check js/shapes/PathCornerRules.js`、ルートで `node --test`（変更前は tests 2067 / suites 337 / fail 0。件数は変わらないはず）、本作業の開始時点のコミット `933c52e` と作業ツリーの比較（`git diff 933c52e`）で `.js` の変更がコメント行だけで、変わったファイルが計画の12ファイルと本RESだけであること、全件（No.1〜No.26・A1〜A4・`main.js` 305行・502行）の処理の照合。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./`（`PROJECT_ARCHITECTURE.md`）、`./_doc/arch/`（`06_InputTracker.md`・`10_ShapeFactory.md`・`12_shapes.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md`・`40_asset_sprite.md`）、`./js/`（`main.js`）、`./js/shapes/`（`PathCornerRules.js`）
*   **関連する論理クラス**: 読むだけ（照合用）：`core/InputTracker`・`core/DragTracker`・`core/ShapeFactory`・`core/KeyboardShortcuts`・`edit/EndpointSnapper`・`edit/PathCornerEditor`・`shapes/PathJoinRules`・`shapes/EndpointSnapRules`・`shapes/Path`・`shapes/PathCornerRules`・`shapes/PathSegmentKindRules`・`palette/OptionBarCornerGroup`。コメントを直す：`js/main.js`・`shapes/PathCornerRules`（typedef `CornerTarget` のJSDocのみ）。

### 参照する責務
*   `PROJECT_ARCHITECTURE.md` 冒頭の記載基準：第一の目的はハルシネーションの防止、第二がコンテキストの削減で、第二のために第一を犠牲にしない。残す＝責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路、公開メソッド名の一覧。書かない＝1つのファイルのJSDocを読めば分かること（引数と戻り値、private項目、typedefの中身、定数の値、1クラス内の処理順）。消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。
*   `js/shapes/PathCornerRules.js` の先頭の責務定義は変えない（JSDocの説明行を1文足すだけで、責務は増やさない）。`js/main.js` も配線のコメントを実態に合わせるだけ。
*   本作業は資料の記述を実コードに合わせる方向だけで、コードを資料に合わせる修正・設計の変更は行わない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   本作業そのものが開発資料の修正であり、内容はタスク1〜タスク6・タスク8のとおり（各タスクで直す）。
*   **変えない箇所**：`PROJECT_ARCHITECTURE.md` 2章245行（エンジンとの約束(c)）・3章22.640行（用語の定義）・3章24.（「モジュールの分担」の`CornerTarget`側からの言及の文だけはREQの補足決定によりタスク8で直す。ほかの文は変えない）・3章15.524行（`Tab`の扱い）。`_doc/arch/07_KeyboardShortcuts.md`、REQの要件に挙げていない `_doc/arch/` のファイル、`_doc/arch/12_shapes.md` 29行のうちタスク8で直す1文以外。

## 3. タスクリスト
*   [x] タスク1: `PROJECT_ARCHITECTURE.md` 1章・2章、`_doc/arch/15_io.md`・`40_asset_sprite.md`（No.1・No.2・No.26の2章252行・No.3・No.24）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章「依存方向」の1文、2章 `path` の「作られるのは」の文、2章「描画要素」の `"bezierPath"` の括弧）
        *   `./_doc/arch/15_io.md` : 更新（`SpriteSerializer.js` の「知らないこと」の1文）
        *   `./_doc/arch/40_asset_sprite.md` : 更新（「使う側」の括弧の1文）
    *   **作業内容** :
        *   **No.1**（1章「依存方向」。文言「`core/`内のimportは、処理・レンダラー・小さな部品が」で特定）：
            *   前：「`core/`内のimportは、処理・レンダラー・小さな部品が状態を持たない規則の関数をimportする向きだけで、逆向き（規則が状態を持つクラスをimportする）は無い。」
            *   後：「`core/`内のimportは、処理・レンダラー・小さな部品が状態を持たない規則の関数をimportする向きと、`InputTracker`が生成して持つ状態を持つ部品`DragTracker`をimportする1件だけで、逆向き（規則が状態を持つクラスをimportする）は無い。」
            *   差し引き：取らない（伸び約35字。「依存方向」の各文はimportの事実の列挙で、この修正で冗長になる表現は無い）。
        *   **No.2**（2章 `path`。文言「と、曲線のツールの作成途中（頂点2つ」で特定）：
            *   前：「…と、曲線のツールの作成途中（頂点2つ・区間1つ`'smooth'`の開いたパス。`ShapeFactory.create('curve')`）。」
            *   後：「…と、曲線のツールの作成途中（頂点2つ・区間1つ`'smooth'`の開いたパス。`ShapeFactory.create('curve')`）、直線・曲線のツールで点を打って頂点が3つ以上になった作成途中の線（`PathJoinRules`の`buildDrawnDraft`・`buildLineOrPath`。22.）。」
            *   タスク5のNo.17(1)が同じ核の言い回し（共通の直し方8.）を使う。
            *   差し引き：取らない（伸び約70字だが列挙の取りこぼしの補い〔共通の直し方1.〕。`path`の箇条のほかの文は作られ方・区間の種類の約束で、同じ事実を二重に書く表現は無い）。
        *   **No.26の252行**（2章「描画要素」の `"bezierPath"`）：
            *   前：「`"bezierPath"`（曲線の区間を1つ以上持つ`path`。版3で追加）」
            *   後：「`"bezierPath"`（直線でない区間（曲線の区間・曲がり方を持つ区間）を1つ以上持つ`path`。版3で追加）」
            *   同じ行の後半（「`'smooth'`に加え曲がり方を持つ区間`'bezier'`…も`cubic`になる」以降）は変えない。3章22.の用語の定義は変えない。
            *   差し引き：取らない（伸び約15字）。
        *   **No.3**（`15_io.md` の `SpriteSerializer.js`「知らないこと」）：
            *   前：「エンジンへの版3の連絡票は未送付で、Phase 09-04で出す」
            *   後：「版3への版上げはエンジンへ連絡済み（Phase 09-04。2章）」
            *   外側の括弧の閉じ「）。」と、その後の `bezierPath` の外枠の文は変えない。
            *   差し引き：不要（長さはほぼ同じ）。
        *   **No.24**（`40_asset_sprite.md` の「使う側」）：
            *   前：「版3への版上げの連絡票は未送付でPhase 09-04で出す。2章」
            *   後：「版3への版上げは連絡済み（Phase 09-04）。2章」
            *   「この2本は書き出し形式の版の変更の連絡票の対象にならない。」は変えない。
            *   差し引き：不要（短くなる）。
        *   **整合の確認**：`PROJECT_ARCHITECTURE.md` 2章245行(c)の「版3への版上げ（…）は連絡済み（Phase 09-04。…）」と、No.3・No.24の言い方が合うこと（245行は変えない）。`grep -rn "未送付" PROJECT_ARCHITECTURE.md _doc/arch` が0件になること。1章「依存方向」の(3)以降の文・`_doc/arch/06_InputTracker.md` のimportの記述と、No.1の文が矛盾しないこと。
        *   **行末の確認**：`PROJECT_ARCHITECTURE.md`・`15_io.md` はCRLF、`40_asset_sprite.md` はLFのまま（共通の直し方4.の方法と値）。
        *   **記録**：4.の「タスク1」に、直した番号（No.1・No.2・No.26(252行)・No.3・No.24）と前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク2: `PROJECT_ARCHITECTURE.md` 3章6.・11.・12.、`_doc/arch/14_edit.md`（No.4・No.5・No.6・No.7・No.8）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（3章6.「記録する操作と時点」の図形の作成、11.冒頭、12.「流れ（描き終え）」の括弧）
        *   `./_doc/arch/14_edit.md` : 更新（`edit/` の「依存」の1文、`EndpointSnapper.js` の「契約」の「線を引く手順の記録」）
    *   **作業内容** :
        *   **No.4**（3章6.「図形の作成：`InputTracker.handleClick`の`DRAWING`確定時」の行）：
            *   前：「（吸い付きなし＝`model.replaceDraft` → `beginEdit` → `model.commitDraft()` → `commitEdit`、描き足し・つながり・閉じる＝`cancelDraft` → `beginEdit` → `model.replaceShape` → `commitEdit`。」
            *   後：「（吸い付きなし・始点で閉じる＝`model.replaceDraft` → `beginEdit` → `model.commitDraft()` → `commitEdit`、描き足し・つながり・既存の線を閉じる＝`cancelDraft` → `beginEdit` → `model.replaceShape` → `commitEdit`。」
            *   差し引き：取らない（伸び約10字）。
        *   **No.8**（`14_edit.md` の「**線を引く手順の記録**」）：
            *   前：「（吸い付きなし＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`、描き足し・つながり・既存の線を閉じる＝」
            *   後：「（吸い付きなし・始点で閉じる＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`、描き足し・つながり・既存の線を閉じる＝」
            *   No.4と同じ言い方（共通の直し方8.）。非公開の `#commitDrawnShape` の名前は書かない（記載基準の「private項目」）。
            *   差し引き：取らない（伸び約6字）。
        *   **No.5**（3章11.冒頭）：
            *   前：「選択モードで選んだ線（直線・開いたパス・今の曲線）を結合する。」
            *   後：「選択モードで選んだ線（直線・開いたパス・今の曲線・弧）を結合する。」
            *   差し引き：取らない（伸び2字）。
        *   **No.7**（3章12.「流れ（描き終え）」）：
            *   前：「（従来の確定`commitDraft`は直線以外のツールの`handleClick`で、`commitDrawnLine`が何もしなかったときに起きる）」
            *   後：「（従来の確定`commitDraft`は直線・曲線以外のツール（弧・矩形・円）の`handleClick`で、`commitDrawnLine`が何もしなかったときに起きる）」
            *   同じ行の「点が1つなら従来の2クリックの直線の描き終えと…」「作成途中の直線を捨て」は本作業の対象外で変えない。タスク3のNo.11（`06_InputTracker.md`）と同じ範囲の言い方。
            *   差し引き：取らない（伸び約12字）。
        *   **No.6**（`14_edit.md` 4行「依存」の `EndpointSnapper` の文）：
            *   前：「（いずれも下向き。`edit/`の他のクラスは`shapes/`をimportしない）」
            *   後：「（いずれも下向き。`edit/`で`shapes/`をimportするのは`PathJoiner`・`PathCornerEditor`・`EndpointSnapper`の3つだけ）」
            *   差し引き：取らない（伸び約20字。同じ箇条の「`edit/`から`core/`をimportするのは…4つだけ」と同じ形にそろえる文で、冗長になる表現は無い）。
        *   **整合の確認**：No.4・No.8 が3章2.の「当てないもの」（「描き足し・つながり・既存の線を閉じる」「吸い付きなしで終えた線・始点で閉じた線は…」）・3章22.「記録（取り消し1件）」と矛盾しないこと。No.5 が11.「結合できる線」の項（直線・開いたパス・今の曲線・弧。円は含めない）と一致すること。No.6 が `PROJECT_ARCHITECTURE.md` 1章「依存方向」(1)の `edit/ → shapes/` の3クラスと一致すること。No.7 が3章12.「表示を消す箇所」の「直線・曲線以外」と同じ範囲であること。
        *   **行末の確認**：`PROJECT_ARCHITECTURE.md`・`14_edit.md` はCRLFのまま。
        *   **記録**：4.の「タスク2」に、No.4・No.5・No.6・No.7・No.8 の前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク3: `PROJECT_ARCHITECTURE.md` 3章22.、`_doc/arch/06_InputTracker.md`（No.9・No.10・No.11・No.12・No.13）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（3章22.「操作ごとの流れ」の `Esc`、「既存の線とつながる・閉じる」の括弧）
        *   `./_doc/arch/06_InputTracker.md` : 更新（`cancelDraftOrClearSelection()` の項、「配線の場面」の見出し〔確認の結果によりその本文のIDLEの句〕、「表示を消す箇所」）
    *   **作業内容** :
        *   **No.9**（3章22.「`Esc`（`cancelDraftOrClearSelection`の`DRAWING`の枝）」）：
            *   前：「直線以外は従来どおり破棄。」
            *   後：「直線・曲線以外のツール（弧・矩形・円）は従来どおり破棄。」
            *   差し引き：取らない（伸び約12字）。
        *   **No.10**（`06_InputTracker.md` の「**`cancelDraftOrClearSelection()`（`Esc`）**」）：
            *   前：「・直線以外は今のまま、」
            *   後：「・直線・曲線以外のツール（弧・矩形・円）は従来どおり破棄、」
            *   No.9と同じ言い方。
            *   差し引き：取らない（伸び約14字）。
        *   **No.11**（`06_InputTracker.md` の「配線の場面」の見出し）：
            *   前：「**配線の場面（直線以外・描き始め・端点のハンドルのドラッグ）**」
            *   後：「**配線の場面（直線・曲線以外のツール・描き始め・端点のハンドルのドラッグ）**」
            *   見出しの後の本文は、下の「IDLEの照会の確認」で誤読されると判断した場合を除き変えない。直前の「線を引いている途中の配線（`DRAWING`。直線・曲線のツール…）」と範囲が重ならないこと。タスク2のNo.7と同じ範囲の言い方。
            *   **IDLEの照会の確認**：IDLEの`mousemove`の照会（`findDrawSnap`）が非`null`を返すのは直線・曲線のツールだけ（`isSnapDrawShapeType`。`js/core/InputTracker.js:859-862` → `EndpointSnapper.findDrawSnap`）。直した見出しの下の本文「図形作成モードのIDLEは照会して表示のみ」が、見出しの「直線・曲線以外のツール」の場面（弧・矩形・円で吸い付きが表示される）と誤読されない形かを確かめる。誤読されると判断したら、本文はその句だけを「図形作成モードのIDLEは照会して表示のみ（吸い付くのは直線・曲線のツールだけ）」に直す（本文で変えてよいのはこの句だけ。差し引きは取らない＝伸び約18字）。どちらにしたかと理由を詳細作業内容に書く。
            *   差し引き：取らない（見出しの伸び約6字）。
        *   **No.12**（3章22.「既存の線とつながる・閉じる」）：
            *   前：「（頂点が3つ以上の開いたパスなら途中の点なしでも閉じる。途中の点が要るのは相手が直線のとき＝頂点2つの線は閉じない）」
            *   後：「（頂点が3つ以上の開いたパスなら途中の点なしでも閉じる。途中の点が要るのはそれ以外のとき＝頂点2つの線・今の曲線・弧は途中の点なしでは閉じない。11.）」
            *   「＝頂点2つの線は閉じない」の句は今も正しい（直線と頂点2つの開いた`Path`を含む。`js/shapes/PathJoinRules.js` の `buildClosedPath`〔`:293`〕で頂点3つ未満は`null`）ため、「直線」の列挙に替えず、この句に今の曲線・弧（`:291` の `type !== 'path'` で`null`）を足す形にした。
            *   差し引き：取らない（伸び約12字）。
        *   **No.13**（`06_InputTracker.md` の「**表示を消す箇所**」）：
            *   前：「`#resetSnapState()`（描き終え、`cancelDraftOrClearSelection`のDRAWING分岐、`setShapeType`、`#abortOngoingOperation`、`#finishLeftDrag`、`finishLineDrawing`）、点を打った直後・最後の点を消した直後（`#drawEndSnap`を`null`・`#showSnap(null)`）」
            *   後：「`#resetSnapState()`（描き終え、`cancelDraftOrClearSelection`のDRAWING分岐、`setShapeType`、`#abortOngoingOperation`、`#finishLeftDrag`、`finishLineDrawing`、`removeLastLinePoint`の始点だけでやめる枝）、点を打った直後・最後の点を消して引き続けるとき（`#drawEndSnap`を`null`・`#showSnap(null)`）」
            *   後半を「消して引き続けるとき」にするのは、足した「始点だけでやめる枝」と同じ操作の別の枝であることを読み分けるため（`InputTracker.js:702-703` と `:704-706`）。
            *   差し引き：取らない（伸び約20字。列挙の取りこぼしの補い）。
        *   **整合の確認**：No.9・No.10 が3章22.の用語「線を引いている途中」（直線・曲線のツール）・`06_InputTracker.md` の「線を引いている途中の配線」（`Esc`＝`finishDrawnLine`）と合うこと。No.11 の見出しと本文が上の「IDLEの照会の確認」を満たすこと（IDLEの照会が非`null`を返すのは直線・曲線のツールだけ。`isSnapDrawShapeType`。`js/core/InputTracker.js:859-862`）。No.12 が3章11.「弧の結合」の項・3章22.「曲線のツール」の項と合うこと。`grep -n "直線以外" PROJECT_ARCHITECTURE.md _doc/arch/06_InputTracker.md` の残りが3章22.冒頭の「直線以外のツール・選択（`V`）…は変えない」（Interrupt の時点の記述。本作業の対象外）だけになること。
        *   **行末の確認**：`PROJECT_ARCHITECTURE.md`・`06_InputTracker.md` はCRLFのまま。
        *   **記録**：4.の「タスク3」に、No.9〜No.13 の前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク4: `PROJECT_ARCHITECTURE.md` 3章23.、`_doc/arch/16_test.md`（No.14・No.15・No.20・A1・A2）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（3章23.「`change`の後に`blur`する理由」の括弧、「確認の状況」の見積もり）
        *   `./_doc/arch/16_test.md` : 更新（`EndpointSnapRules.test.js` の項の「対象」の括弧、「書き換えた既存のテスト（09-01a）」の末尾の文、「テストできない箇所（09-02aの追加）」の見積もり）
    *   **作業内容** :
        *   **No.14**（3章23.「確認の状況」）：
            *   前：「1280px幅での収まり（見積もり約1189px）」
            *   後：「1280px幅での収まり（見積もり約1261px）」
            *   差し引き：不要（伸びない）。
        *   **No.15**（3章23.「`change`の後に`blur`する理由」）：
            *   前：「（続けるには`Tab`で戻る。許容）」
            *   後：「（外れた後の`Tab`はパレットを隠す/出すだけでチェックボックスへは戻らない。15.の`Tab`の扱い。許容）」
            *   3章15.の「`Tab`の扱い」（524行）・`_doc/arch/07_KeyboardShortcuts.md` 5行は変えない。
            *   差し引き：取らない（伸び約35字。「`change`の後に`blur`する理由」のほかの文は`blur`の理由・受理されなかったときの事実で、この修正で冗長になる表現は無い）。
        *   **No.20**（`16_test.md` の「**書き換えた既存のテスト（09-01a）**」）：
            *   前：「図形の作り方を`new Curve(…)`へ置き換えたのは上の4ファイル（期待値は変えていない）。」
            *   後：「図形の作り方を`new Curve(…)`へ置き換えたのは上の3ファイル（期待値は変えていない）。」
            *   直前の `DocumentSerializer.roundtrip.test.js` の項が挙げる3ファイル（`roundtrip`・`errors.test.js`・`CanvasFileOperations.test.js`）と一致すること。
            *   差し引き：不要（伸びない）。
        *   **A1**（`16_test.md` の「**テストできない箇所（09-02aの追加）**」）：
            *   前：「1280px幅での収まり（見積もり約1189px）」
            *   後：「1280px幅での収まり（見積もり約1261px）」
            *   差し引き：不要（伸びない）。
        *   **A2**（`16_test.md` の `test/shapes/EndpointSnapRules.test.js` の項）：
            *   前：「対象（結合できる線の端点だけ。曲線のパスを含む。Phase 09-01b）」
            *   後：「対象（結合できる線の端点だけ。曲線のパス＝Phase 09-01b、今の曲線の始点・終点＝09-03a、弧の左端・右端＝09-03bを含み、今の曲線の制御点・弧の中心と頂上・円は含まない）」
            *   書いた範囲がテストにあること（`EndpointSnapRules.test.js` の `describe('EndpointSnapRules 曲線のパスと…')`・`'… 今の曲線の吸い付き（Phase 09-03a）'`・`'… 弧の吸い付き（Phase 09-03b）'` の `it` の名前で確かめる）。テストにない範囲は書かない。同じ項目のほかの語・テストの件数は変えない。
            *   差し引き：取らない（伸び約75字だが、テストが確かめる範囲の列挙の補い。同じ項目のほかの語はテストの観点の列挙で、冗長な表現は無い）。
        *   **整合の確認**：`grep -rn "1189" PROJECT_ARCHITECTURE.md _doc/arch` が0件、`index.html` の見積もりのコメント（約1261px）・3章24.「確認の状況」・`_doc/arch/01_index_html.md` の値と一致すること（読むだけ）。
        *   **行末の確認**：`PROJECT_ARCHITECTURE.md`・`16_test.md` はCRLFのまま。
        *   **記録**：4.の「タスク4」に、No.14・No.15・No.20・A1・A2 の前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク5: `_doc/arch/12_shapes.md`（No.16・No.17・No.18・No.25・No.26の40・51・52行・A3・A4）
    *   **対象ファイル** :
        *   `./_doc/arch/12_shapes.md` : 更新（3・8・13・17・40・51・52・63・80行の該当の文だけ）
    *   **作業内容** :
        *   **A4**（3行 `ShapeGeometry.js`）：「`isPointInPolygonNonzero（」→「`isPointInPolygonNonzero`（」（バッククォート1文字を足すだけ）。差し引き：不要。
        *   **A3**（8行 `PathJoinRules.js` の「公開」）：
            *   前：「直線のツールで線を続けて引く作業の追加（3章22.）：」
            *   後：「直線・曲線のツールで線を続けて引く作業の追加（3章22.）：」（17行の見出しと同じ。後の列挙は変えない）
            *   差し引き：取らない（伸び3字）。
        *   **No.16**（13行「区間の種類（Phase 09-01b）」の終わり近く）：
            *   前：「`assembleOpenPath`が頂点と区間の種類を一緒に並べる唯一の箇所で、`buildJoinedPath`系・`buildExtendedPath`・`buildClosedPath`が共有する。」
            *   後：「`assembleOpenPath`が開いたパスへつなぐときに頂点と区間の種類を一緒に並べる唯一の箇所で、`buildJoinedPath`系・`buildExtendedPath`が共有する（`buildClosedPath`は使わない。角の点の項）。」
            *   同じ13行の「`assembleOpenPath`・`buildClosedPath`・`buildJoinedPath`系・…のコードは変えていない」は変えない。
            *   差し引き：取らない（伸び約20字。範囲の明示〔共通の直し方2.〕と`buildClosedPath`を共有から外す補いで、13行のほかの文は区間の種類の各Phaseの読み方・変えていないコードの事実で、この修正で冗長になる表現は無い）。括弧は伸びを抑える書き方にした（`buildClosedPath`が`chainOf`の写しから並べる事実は14行の「角の点（Phase 09-02a）」が書くため、括弧は「使わない」と参照だけ）。既存の文から削る箇所は無く、13行のほかの文は削らない。
        *   **No.18**（17行 `EndpointSnapRules.js` の「公開」の括弧の弧の部分）：
            *   前：「弧の左端・右端も含む＝Phase 09-03b。弧の中心・頂上は対象にならない）」
            *   後：「弧は左端・右端に吸い付く＝Phase 09-03b（中心・頂上には吸い付かない）が、弧のハンドルはどれも`resolveEndpointHandle`の対象にならない＝`null`）」
            *   18行（「弧のハンドルはどれも端点として解決しない」）・21行・77行と合うこと。
            *   差し引き：取らない（伸び約30字。17行のほかの文は公開の名前と対象の事実で、この修正で冗長になる表現は無い）。
        *   **No.26の40行**（`hitTestFill`）：「曲線の区間は100分割の折れ線で近似した並び」→「曲線の区間・曲がり方を持つ区間は100分割の折れ線で近似した並び」
        *   **No.26の51行**（`intersectsRect`）：「`Path`の曲線の区間は輪郭を100分割した」→「`Path`の曲線の区間・曲がり方を持つ区間は輪郭を100分割した」
        *   **No.26の52行**（`toDrawElement()`）：「曲線の区間を1つ以上持つ`Path`は`bezierPath`」→「直線でない区間（曲線の区間・曲がり方を持つ区間）を1つ以上持つ`Path`は`bezierPath`」（タスク1の `PROJECT_ARCHITECTURE.md` 252行と同じ言い方）
        *   No.26（40・51・52行）の差し引き：取らない（各伸び約10〜15字）。
        *   **No.25**（63行 `Path.fromJSON`）：
            *   前：「区間を`data.segments`の`kind`から作り直す。」
            *   後：「区間を`data.segments`から`copySegment`で作り直す（`'bezier'`の区間は`control1`・`control2`も複製）。」
            *   80行の「`copySegment`が区間の写しの唯一の箇所（コンストラクタ・`toJSON`・`fromJSON`が使う…）」と合うこと。
            *   差し引き：取らない（伸び約30字。80行は別の項〔`Path.js`〕で、63行の項に冗長な表現は無い）。
        *   **No.17(1)**（80行 `Path.js` の「作る操作」）：
            *   前：「作る操作は結合・描き足し・閉じる・直線・曲線のツールで点を3つ以上打って終える（`PathJoinRules`がコンストラクタで作る。3章11.・12.・22.）・区間の切り替え（`PathSegmentKindRules`がコンストラクタで作る。単独の直線の「曲線に」は点を3つ持つ開いたパスになる。Phase 09-02b。3章24.）。」
            *   後：「作る操作は結合・描き足し・閉じる・直線・曲線のツールで点を3つ以上打って終える（`PathJoinRules`がコンストラクタで作る。3章11.・12.・22.）・直線・曲線のツールで点を打って頂点が3つ以上になった作成途中の線（`PathJoinRules`の`buildDrawnDraft`・`buildLineOrPath`。3章22.）・角の切り替え（`PathCornerRules`の`planCornerToggle`。Phase 09-02a。3章23.）・区間の切り替え（`PathSegmentKindRules`がコンストラクタで作る。単独の直線の「曲線に」は点を3つ持つ開いたパスになる。Phase 09-02b。3章24.）。」
            *   作成途中の線の言い方はタスク1のNo.2と同じ核（共通の直し方8.）。
            *   差し引き：取らない（伸び約90字だが列挙の取りこぼしの補い〔共通の直し方1.〕。80行の`Path.js`の項のほかの文は保持の形・定数の使う側・コンストラクタの約束・分岐の置き場所の事実で、この修正で冗長になる表現は無い。「`ShapeFactory.create`では`curve`の作成途中の図形…だけが作られ」は`ShapeFactory`に限った文で、足す作成途中の線と重ならないため削らない）。
        *   **No.17(2)**（80行「コンストラクタの第6引数」の後の文）：
            *   前：「区間ごとの配列も受ける（`PathJoinRules`の結合・描き足し・閉じる用。Phase 09-01b。」
            *   後：「区間ごとの配列も受ける（`PathJoinRules`の結合・描き足し・閉じる、`PathCornerRules`の角の切り替え、`PathSegmentKindRules`の区間の切り替えが使う。Phase 09-01b。」
            *   23行・24行（「`planCornerToggle`の結果は`new Path(...)`…第6引数は`data.segments`」）と合うこと。
            *   差し引き：取らない（伸び約40字。列挙の取りこぼしの補い）。
        *   **整合の確認**：29行（`SegmentSwitchTarget` の項）はこのタスクでは変えない（「`CornerTarget`側からの言及は無い」の文はタスク7の後にタスク8で直す）。「曲線の区間」を `'bezier'` まで含めて使う文が、27行・80行（`'smooth'`と`'bezier'`を分けて書く文）と食い違わないこと。13行と14行の `buildClosedPath` の記述が一致すること。
        *   **行末の確認**：`12_shapes.md` はCRLFのまま（88行・CR 88）。
        *   **記録**：4.の「タスク5」に、No.16・No.17(1)(2)・No.18・No.25・No.26(40・51・52行)・A3・A4 の前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク6: `_doc/arch/10_ShapeFactory.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md`（No.21・No.22・No.23）
    *   **対象ファイル** :
        *   `./_doc/arch/10_ShapeFactory.md` : 更新（6行「`curve`の`create`は曲線のパスを返す」の括弧と末尾の文）
        *   `./_doc/arch/28_MoveDirectionRules.md` : 更新（5行「使う側」の範囲の語）
        *   `./_doc/arch/30_UnitSnapRules.md` : 更新（10行・12行の範囲の語）
    *   **作業内容** :
        *   **No.21**（10の6行）：
            *   前：「（`js/`内で戻り値の`type`を見る箇所は無い。呼び出し元は`VectorModel.startDraft`だけで、戻り値を作成途中の図形として持つ）」
            *   後：「（戻り値は`VectorModel.startDraft`が作成途中の図形として持ち、その`type`を`PathJoinRules.isDrawnLineShape`が読む＝`'path'`のため続けて引く線の形に当たり、曲線のツールも線を続けて引く流れを通る。3章22.）」
            *   差し引き：括弧の中で取った（「呼び出し元は`VectorModel.startDraft`だけ」は、同じ項目の「置き場所の理由」の「`ShapeFactory.create`の`js/`内の呼び出し元は`VectorModel.startDraft`だけで」と同じ事実の二重の記述のため、括弧からは外す。「置き場所の理由」の文は変えない）。
        *   **No.22**（10の6行の末尾）：
            *   前：「importは`Path`と`SEGMENT_KIND_SMOOTH`（`shapes/Path.js`が`export`）を足した。」
            *   後：「importは`SEGMENT_KIND_SMOOTH`（`shapes/Path.js`が`export`）を足した（`Path`は`path`の`fromJSON`のため前からimportしている）。」
            *   差し引き：取らない（伸び約25字。この項目でNo.21の分のほかに削る冗長な表現は無い）。
        *   **No.23**（共通の直し方3.）：
            *   28の5行：「直線のツールで線を引いている途中の付いてくる線の先」→「直線・曲線のツールで線を引いている途中の付いてくる線の先」
            *   30の10行：「（直線のツールで線を引いている途中の最後の点）」→「（直線・曲線のツールで線を引いている途中の最後の点）」
            *   30の12行：「`roundConstrainedPointFromOriginToUnit`は直線のツールで線を引いている途中の`Shift`だけ」→「`roundConstrainedPointFromOriginToUnit`は直線・曲線のツールで線を引いている途中の`Shift`だけ」（「`Shift`だけ」の限定は残す）
            *   差し引き：取らない（各伸び3字）。
        *   **整合の確認**：`PROJECT_ARCHITECTURE.md` 3章22.「モジュールの分担」の「`ShapeFactory`は作り分けの入口にせず、09-01aで変えたのは`curve`の`create`だけ」・`_doc/arch/06_InputTracker.md` の「線を引いている途中の配線（`DRAWING`。直線・曲線のツール…）」と合うこと（読むだけ）。10の6行の「置き場所の理由」の文は変えない。
        *   **行末の確認**：3ファイルとも**LFのまま**（10＝9行・28＝7行・30＝14行、CRは0）。
        *   **記録**：4.の「タスク6」に、No.21・No.22・No.23 の前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク7: コードのコメント3か所（No.19・`js/main.js` 305行・502行）
    *   **対象ファイル** :
        *   `./js/shapes/PathCornerRules.js` : 更新（typedef `CornerTarget` のJSDocの説明行1行のみ）
        *   `./js/main.js` : 更新（305行・502行のコメント行2行のみ）
    *   **作業内容** :
        *   **No.19**（`PathCornerRules.js` 24行。typedef `CornerTarget` の直前のJSDocの説明行）：
            *   前：「 * 選んだ点。」
            *   後：「 * 選んだ点。`PathSegmentKindRules`のtypedef`SegmentSwitchTarget`と同じ形（どちらも`PathCornerEditor`が集めた同じ結果を受ける）。」
            *   `PathSegmentKindRules.js:23` の言い方と対になる形。`@typedef`・`@property` の行、ファイル先頭の責務定義は変えない。`PathSegmentKindRules.js` は変えない。
        *   **`main.js` 305行**（削除ボタンの配線のコメントの2行目）：
            *   前：「    // （Delete/Backspaceショートカットと同一経路。ここでmodel.deleteShapesを直接呼ばないこと）」
            *   後：「    // （切り取りの削除と同一経路。Delete/BackspaceはdeleteLastLinePointOrSelection()を通り、線を引いている途中でなければ同じ削除。ここでmodel.deleteShapesを直接呼ばないこと）」
        *   **`main.js` 502行**（切り取りの削除の注入のコメント）：
            *   前：「    // 切り取りの削除は、既存の唯一の削除経路inputTracker.deleteSelection()を注入する（Delete/削除ボタンと同一経路）」
            *   後：「    // 切り取りの削除は、既存の唯一の削除経路inputTracker.deleteSelection()を注入する（削除ボタンと同一経路。Delete/BackspaceはdeleteLastLinePointOrSelection()を通り、線を引いている途中でなければ同じ削除）」
        *   3か所とも1行のまま（行数を増やさない）。実行されるコードの行、904行〜906行のコメントは変えない。
        *   差し引き：対象外（共通の直し方6.は資料の原則。コードのコメントは1行のまま直すことだけを守る）。
        *   資料（`_doc/arch/12_shapes.md` 29行・`PROJECT_ARCHITECTURE.md` 3章24.）はこのタスクでは触らない（タスク8）。
        *   **確認**：`node --check js/main.js`・`node --check js/shapes/PathCornerRules.js` が通ること。`git diff --stat -- js`（タスク6までがコミット済みのため、このタスクの変更だけを示す）が2ファイルで、`js/main.js` は2行・`js/shapes/PathCornerRules.js` は1行の置き換え（合計 3 insertions / 3 deletions）であること。
        *   **行末の確認**：2ファイルとも**LFのまま**（`main.js`＝1074行・`PathCornerRules.js`＝187行、CRは0）。
        *   **記録**：4.の「タスク7」に、No.19・`main.js` 305行・502行の前後の要点、`node --check` の結果、行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク8: No.19 に伴う資料の2か所（`_doc/arch/12_shapes.md` 29行・`PROJECT_ARCHITECTURE.md` 3章24.。REQの補足決定）
    *   **対象ファイル** :
        *   `./_doc/arch/12_shapes.md` : 更新（`PathSegmentKindRules.js` の「公開」の typedef`SegmentSwitchTarget` の括弧の中の1文だけ）
        *   `./PROJECT_ARCHITECTURE.md` : 更新（3章24.「モジュールの分担」の規則の括弧の中の1文だけ）
    *   **前提**：タスク7で `CornerTarget` のJSDocに `SegmentSwitchTarget` との関係の1文が入っていること（`grep -n "SegmentSwitchTarget" js/shapes/PathCornerRules.js` が1件）。入っていなければ作業を中断して報告する。
    *   **作業内容** :
        *   **`12_shapes.md` 29行**（文言「`CornerTarget`側からの言及は無い」で特定）：
            *   前：「。`SegmentSwitchTarget`側のJSDocには`CornerTarget`との関係が書かれているが、コードは`PathCornerRules`を変えないため`CornerTarget`側からの言及は無い）」
            *   後：「。この関係は互いのJSDocに書かれている）」
            *   同じ括弧の「`PathCornerRules`の`CornerTarget`と同じ形。どちらも`PathCornerEditor.#collectTargets`の結果を受ける」と、29行のほかの語は変えない。
            *   差し引き：不要（短くなる）。
        *   **`PROJECT_ARCHITECTURE.md` 3章24.「モジュールの分担」**（文言「`CornerTarget`側からの言及は無い」で特定）：
            *   前：「。この関係は`SegmentSwitchTarget`側のJSDocには書かれているが、`PathCornerRules`は変えないファイルのため`CornerTarget`側からの言及は無い）」
            *   後：「。この関係は互いのJSDocに書かれている）」
            *   同じ括弧の「`PathCornerRules`の`CornerTarget`と`SegmentSwitchTarget`は同じ形で、どちらも`PathCornerEditor.#collectTargets`の結果を受ける」と、3章24.のほかの文（「`core/`・`io/`・`check/`・図形クラスのコードは変えていない」を含む）は変えない。
            *   差し引き：不要（短くなる）。
        *   2か所とも同じ言い方にする。
        *   **整合の確認**：`grep -rn "言及は無い" PROJECT_ARCHITECTURE.md _doc/arch` が0件、`grep -rn "この関係は互いのJSDocに書かれている" PROJECT_ARCHITECTURE.md _doc/arch` が2件（`PROJECT_ARCHITECTURE.md` 1件・`_doc/arch/12_shapes.md` 1件）。`js/shapes/PathCornerRules.js` の `CornerTarget` と `js/shapes/PathSegmentKindRules.js:23` の `SegmentSwitchTarget` のJSDocが、どちらも相手のtypedefの名前を書いていること（読むだけ）。`git diff -U0 -- PROJECT_ARCHITECTURE.md _doc/arch/12_shapes.md` で変わった行が各1行（3章24.「モジュールの分担」の行・29行）だけであること（このタスクの開始時にはタスク7までがコミット済みのため、この `git diff` はこのタスクの変更だけを示す）。
        *   **行末の確認**：`PROJECT_ARCHITECTURE.md`（740行・CR 740）・`12_shapes.md`（88行・CR 88）はCRLFのまま。
        *   **記録**：4.の「タスク8」に、2か所の前後の要点、整合・行末の確認結果を書き、タスクを[x]にする。

*   [x] タスク9: 確認（要件9。固定タスク）
    *   **対象ファイル** :
        *   なし（本RESの4.・5.へ記録するのみ）
    *   **作業内容** :
        *   `node --check js/main.js`・`node --check js/shapes/PathCornerRules.js` を実行する。
        *   プロジェクトのルートで `node --test` を実行し、全件成功（fail 0）と tests・suites の件数を記録する（変更前は tests 2067 / suites 337。件数が変わっていれば原因を調べて報告する）。
        *   **比較の基準**：このタスクの開始時にはタスク1〜8がコミット済みで、作業ツリーと HEAD の差（`git diff`・`git status --short`）には本作業の変更がほぼ出ない。そのため、本作業の開始時点のコミット `933c52e`（REQのコミット。本作業の変更を一切含まない）と作業ツリーを比べる `git diff 933c52e …` で確かめる（未コミットの変更も含めて見る）。
        *   `git diff 933c52e -- js` で、変更が `js/main.js` のコメント2行と `js/shapes/PathCornerRules.js` のJSDoc1行だけであることを確かめる。
        *   `git diff --stat 933c52e` で、変更されたファイルが本計画の12ファイル（`PROJECT_ARCHITECTURE.md`・`_doc/arch/06`・`10`・`12`・`14`・`15`・`16`・`28`・`30`・`40`・`js/main.js`・`js/shapes/PathCornerRules.js`）と本RES（`933c52e` には無いため新規ファイルとして出る）だけであることを確かめる。あわせて `git status --short` で、未追跡のファイル・意図しない新規ファイルが無いことを見る（コミット済みの変更はここには出ないため、変更されたファイルの確認は `git diff --stat 933c52e` で行う）。
        *   `git diff --numstat 933c52e` で、12ファイルそれぞれの insertions と deletions が等しい（置き換えだけで行の増減が無い）ことを確かめる。**本RESはこの照合から外す**（記録で行が増えるため）。
        *   `git diff -U0 933c52e -- PROJECT_ARCHITECTURE.md _doc/arch js` の変わった行が、タスク1〜8で計画した箇所だけであることを、下の全件の照合と合わせて確かめる。
        *   12ファイルの行末が共通の直し方4.の値のままであることを、まとめてもう一度確かめる。
        *   **全件の照合**：4.の「タスク9」に、No.1〜No.26・A1〜A4・`main.js` 305行・502行を番号順に並べ、それぞれ処理したタスクと結果（直した／直さなかった＋理由）を書く。No.26は2章252行（タスク1）と `12_shapes.md` 40・51・52行（タスク5）の両方がそろって「直した」とする。No.19は `CornerTarget` のJSDoc（タスク7）と、それに伴う資料の2か所（タスク8。REQの補足決定）を併記する。
        *   テストプレイ・ブラウザでの確認は行わない（画面のふるまいが変わらないため）。
        *   タスクを[x]にする。

*   [ ] タスク10: 懸念事項・今後の修正における注意点の記述（固定タスク）
    *   **対象ファイル** :
        *   なし（本RESの5.へ記録するのみ）
    *   **作業内容** :
        *   5.「懸念事項・要確認ポイント」（REQの「懸念事項・今後の修正における注意点」欄）に、タスク1〜タスク9で判断に迷った点、資料の別の箇所との整合で気づいた点（本作業の対象外として残したものを含む）、将来この箇所を修正する際に注意すべき点を追記する。計画時に書いた項目（5.の1〜4）は消さず、その後ろに足す。
        *   タスクを[x]にする。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `PROJECT_ARCHITECTURE.md` 1章・2章、`_doc/arch/15_io.md`・`40_asset_sprite.md`（No.1・No.2・No.26の2章252行・No.3・No.24）
*   **作業内容** :
    *   No.1：1章「依存方向」を、計画の置き換え案どおり「…importする向きと、`InputTracker`が生成して持つ状態を持つ部品`DragTracker`をimportする1件だけで、逆向き…は無い」に直した。
    *   No.2：2章 `path` の「作られるのは」の列挙の末尾に「直線・曲線のツールで点を打って頂点が3つ以上になった作成途中の線（`PathJoinRules`の`buildDrawnDraft`・`buildLineOrPath`。22.）」を足した。
    *   No.26(252行)：`"bezierPath"` の括弧を「直線でない区間（曲線の区間・曲がり方を持つ区間）を1つ以上持つ`path`。版3で追加」に直した。同じ行の後半は未変更。
    *   No.3：`15_io.md` を「版3への版上げはエンジンへ連絡済み（Phase 09-04。2章）」に直した（外側の括弧以降は未変更）。
    *   No.24：`40_asset_sprite.md` を「版3への版上げは連絡済み（Phase 09-04）。2章」に直した。
    *   差し引きは計画どおりどれも取っていない。
    *   整合確認：`grep -rn 未送付 PROJECT_ARCHITECTURE.md _doc/arch` は0件。2章245行(c)は未変更。
    *   行末確認：`PROJECT_ARCHITECTURE.md` 740行/CR740、`15_io.md` 37行/CR37（CRLF維持）、`40_asset_sprite.md` 6行/CR0（LF維持）。

### タスク2: `PROJECT_ARCHITECTURE.md` 3章6.・11.・12.、`_doc/arch/14_edit.md`（No.4・No.5・No.6・No.7・No.8）
*   **作業内容** :
    *   No.4：3章6.の図形の作成を「吸い付きなし・始点で閉じる＝…、描き足し・つながり・既存の線を閉じる＝…」に直した。
    *   No.8：`14_edit.md` の「線を引く手順の記録」を「吸い付きなし・始点で閉じる＝…」に直した（`#commitDrawnShape` の名前は書かず）。
    *   No.5：3章11.冒頭を「（直線・開いたパス・今の曲線・弧）」に直した。
    *   No.7：3章12.を「直線・曲線以外のツール（弧・矩形・円）の`handleClick`で」に直した。同じ行のほかは未変更。
    *   No.6：`14_edit.md` の依存を「`edit/`で`shapes/`をimportするのは`PathJoiner`・`PathCornerEditor`・`EndpointSnapper`の3つだけ」に直した。
    *   差し引きは計画どおりどれも取っていない。
    *   整合確認：No.4・No.8は3章2.「当てないもの」（描き足し・つながり・既存の線を閉じる）と矛盾しない。No.5は11.「結合できる線」の項（円を含めない）と一致。No.6は1章・2章の`edit/`の記述（`PathJoiner`・`EndpointSnapper`・`PathCornerEditor`の3クラスが`shapes/`の規則も使う）と一致。No.7は12.「表示を消す箇所」の「直線・曲線以外」と同じ範囲。
    *   行末確認：`PROJECT_ARCHITECTURE.md` 740行/CR740、`14_edit.md` 105行/CR105（CRLF維持）。

### タスク3: `PROJECT_ARCHITECTURE.md` 3章22.、`_doc/arch/06_InputTracker.md`（No.9・No.10・No.11・No.12・No.13）
*   **作業内容** :
    *   No.9：3章22.の `Esc` を「直線・曲線以外のツール（弧・矩形・円）は従来どおり破棄。」に直した。
    *   No.10：`06_InputTracker.md` の `cancelDraftOrClearSelection()` を「直線・曲線以外のツール（弧・矩形・円）は従来どおり破棄、」に直した。
    *   No.11：「配線の場面」の見出しを「（直線・曲線以外のツール・描き始め・端点のハンドルのドラッグ）」に直した。IDLEの照会の確認：本文の「図形作成モードのIDLEは照会して表示のみ」は、見出しの「直線・曲線以外のツール」の場面（弧・矩形・円）で吸い付きが表示されると誤読されうると判断し、計画どおりその句だけを「（吸い付くのは直線・曲線のツールだけ）」付きに直した（IDLEの照会が非nullなのは直線・曲線のツールだけ。`isSnapDrawShapeType`）。
    *   No.12：3章22.「既存の線とつながる・閉じる」を「途中の点が要るのはそれ以外のとき＝頂点2つの線・今の曲線・弧は途中の点なしでは閉じない。11.」に直した。
    *   No.13：「表示を消す箇所」の `#resetSnapState()` の列挙に「`removeLastLinePoint`の始点だけでやめる枝」を足し、後半を「最後の点を消して引き続けるとき」に直した。
    *   差し引きは計画どおりどれも取っていない。
    *   整合確認：No.9・No.10は22.の「線を引いている途中」（直線・曲線のツール）・06の「線を引いている途中の配線」（`Esc`＝`finishDrawnLine`）と合う。No.12は11.「弧の結合」の項・22.「曲線のツール」の項と合う。`grep -n 直線以外` の残りは3章22.冒頭（638行。対象外）だけ。
    *   行末確認：`PROJECT_ARCHITECTURE.md` 740行/CR740、`06_InputTracker.md` 42行/CR42（CRLF維持）。

### タスク4: `PROJECT_ARCHITECTURE.md` 3章23.、`_doc/arch/16_test.md`（No.14・No.15・No.20・A1・A2）
*   **作業内容** :
    *   No.14：3章23.「確認の状況」の「見積もり約1189px」を「約1261px」に直した。
    *   A1：`16_test.md`「テストできない箇所（09-02aの追加）」の「約1189px」を「約1261px」に直した。
    *   No.15：3章23.「`change`の後に`blur`する理由」を「（外れた後の`Tab`はパレットを隠す/出すだけでチェックボックスへは戻らない。15.の`Tab`の扱い。許容）」に直した。3章15.・`07_KeyboardShortcuts.md` は未変更。
    *   No.20：`16_test.md`「書き換えた既存のテスト（09-01a）」の「上の4ファイル」を「上の3ファイル」に直した（直前の`roundtrip`の項が挙げる3ファイルと一致）。
    *   A2：`EndpointSnapRules.test.js` の項の「対象」の括弧を計画の後の文のとおりに直した。テストの確認：`describe` の「曲線のパスの吸い付き（Phase 09-01b）」（439行）、「今の曲線の吸い付き（Phase 09-03a）」（501行。始点・終点に吸い付き制御点には吸い付かない）、「弧の吸い付き（Phase 09-03b）」（544行。左端・右端に吸い付き、中心・頂上には吸い付かない、円の点には吸い付かない）の各 `it` で、書いた範囲が確かめられている。件数・同じ項目のほかの語は未変更。
    *   差し引きは計画どおりどれも取っていない。
    *   整合確認：`grep -rn 1189 PROJECT_ARCHITECTURE.md _doc/arch` は `PROJECT_ARCHITECTURE.md`・`16_test.md` は0件。`_doc/arch/01_index_html.md` 15行にだけ「Phase 09-02aの約1189pxから…」「…を加えて約1189px、Phase 09-02bで…」という経緯の記述が残る（計画の「0件」と食い違うが、09-02a時点の値を述べる正しい経緯で、現在値は同行の約1261pxと一致。読むだけの資料のため触れず）。`index.html` 447行のコメント（約1261px）・3章24.「確認の状況」（約1261px）・`01_index_html.md` の現在値（約1261px）と一致。
    *   行末確認：`sed -i` がCRを落としたため（Git Bashのsed）、直後に各行末へCRを付け直して復元した。`PROJECT_ARCHITECTURE.md` 740行/CR740、`16_test.md` 196行/CR196（CRLF維持）。`git diff --stat` は2ファイルで各5行の入れ替えのみ。

### タスク5: `_doc/arch/12_shapes.md`（No.16・No.17・No.18・No.25・No.26の40・51・52行・A3・A4）
*   **作業内容** :
    *   A4：3行の「`isPointInPolygonNonzero（」を「`isPointInPolygonNonzero`（」に直した（バッククォート1字のみ）。
    *   A3：8行 `PathJoinRules.js` の「公開」の見出しを「直線・曲線のツールで線を続けて引く作業の追加（3章22.）：」に直した（17行と同じ。後の列挙は未変更）。
    *   No.16：13行を「`assembleOpenPath`が開いたパスへつなぐときに頂点と区間の種類を一緒に並べる唯一の箇所で、`buildJoinedPath`系・`buildExtendedPath`が共有する（`buildClosedPath`は使わない。角の点の項）。」に直した。13行のほかの文は未変更。
    *   No.18：17行の括弧を「弧は左端・右端に吸い付く＝Phase 09-03b（中心・頂上には吸い付かない）が、弧のハンドルはどれも`resolveEndpointHandle`の対象にならない＝`null`）」に直した。
    *   No.26：40行を「曲線の区間・曲がり方を持つ区間は100分割の折れ線で近似した並び」、51行を「`Path`の曲線の区間・曲がり方を持つ区間は輪郭を100分割した」、52行を「直線でない区間（曲線の区間・曲がり方を持つ区間）を1つ以上持つ`Path`は`bezierPath`」に直した。
    *   No.25：63行を「区間を`data.segments`から`copySegment`で作り直す（`'bezier'`の区間は`control1`・`control2`も複製）。」に直した。
    *   No.17(1)：80行「作る操作」に、作成途中の線（`buildDrawnDraft`・`buildLineOrPath`。3章22.）と角の切り替え（`planCornerToggle`。Phase 09-02a。3章23.）を計画の後の文のとおり足した。
    *   No.17(2)：80行の「区間ごとの配列も受ける」を「（`PathJoinRules`の結合・描き足し・閉じる、`PathCornerRules`の角の切り替え、`PathSegmentKindRules`の区間の切り替えが使う。Phase 09-01b。」に直した。
    *   差し引きは計画どおりどれも取っていない。29行は未変更。
    *   整合確認：13行と14行の `buildClosedPath` の記述は一致（14行は `chainOf` から `points`・`kinds`・`corners` を並べると書く）。No.18は18行・21行・77行の趣旨（弧のハンドルは端点として解決しない）と合う。No.25は80行の `copySegment` の項と合う。No.17は23行・24行と合う。`'smooth'`と`'bezier'`を分けて書く27行・80行は未変更で食い違わない。
    *   行末確認：`12_shapes.md` 88行/CR88（CRLF維持。バイナリで置換し `sed -i` は不使用）。`git diff --stat` は1ファイル9行の入れ替えのみ。

### タスク6: `_doc/arch/10_ShapeFactory.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md`（No.21・No.22・No.23）
*   **作業内容** :
    *   No.21：`10_ShapeFactory.md` 6行の括弧を計画の後の文のとおり「（戻り値は`VectorModel.startDraft`が作成途中の図形として持ち、その`type`を`PathJoinRules.isDrawnLineShape`が読む＝`'path'`のため続けて引く線の形に当たり、曲線のツールも線を続けて引く流れを通る。3章22.）」に直した。「呼び出し元は`VectorModel.startDraft`だけ」は括弧から外し（差し引き）、「置き場所の理由」の文は未変更。
    *   No.22：同6行の末尾を「importは`SEGMENT_KIND_SMOOTH`（`shapes/Path.js`が`export`）を足した（`Path`は`path`の`fromJSON`のため前からimportしている）。」に直した。差し引きは取っていない。
    *   No.23：`28_MoveDirectionRules.md` 5行・`30_UnitSnapRules.md` 10行・12行の「直線のツールで線を引いている途中」を「直線・曲線のツールで線を引いている途中」に直した（30の12行の「`Shift`だけ」の限定は残した）。差し引きは取っていない。
    *   整合確認：3章22.「モジュールの分担」の「09-01aで変えたのは`curve`の`create`だけ」、`06_InputTracker.md` の「線を引いている途中の配線（`DRAWING`。直線・曲線のツール…）」と矛盾しない（読むだけ）。10の6行の「置き場所の理由」の文は未変更。
    *   行末確認：3ファイルともLF維持（10＝9行/CR0、28＝7行/CR0、30＝14行/CR0。Pythonのバイナリ書き込みで置換し `sed -i` は不使用）。`git diff --stat` は3ファイルで4行の入れ替えのみ。

### タスク7: コードのコメント3か所（No.19・`js/main.js` 305行・502行）
*   **作業内容** :
    *   No.19：`PathCornerRules.js` 24行を「 * 選んだ点。`PathSegmentKindRules`のtypedef`SegmentSwitchTarget`と同じ形（どちらも`PathCornerEditor`が集めた同じ結果を受ける）。」に直した（1行のまま。`@typedef`・`@property`・先頭の責務定義・`PathSegmentKindRules.js` は未変更）。
    *   `main.js` 305行：「（切り取りの削除と同一経路。Delete/BackspaceはdeleteLastLinePointOrSelection()を通り、線を引いている途中でなければ同じ削除。ここでmodel.deleteShapesを直接呼ばないこと）」に直した。
    *   `main.js` 502行：「（削除ボタンと同一経路。Delete/BackspaceはdeleteLastLinePointOrSelection()を通り、線を引いている途中でなければ同じ削除）」に直した。いずれも1行のまま。実行されるコード・904〜906行のコメントは未変更。資料はタスク8のため未着手。
    *   確認：`node --check` は2ファイルとも成功。`git diff --stat -- js` は2ファイル（`main.js` 2行・`PathCornerRules.js` 1行、3 insertions / 3 deletions）。
    *   行末確認：2ファイルともLF維持（`main.js`＝1074行、`PathCornerRules.js`＝187行、CR 0）。Pythonのバイナリ置換で行い `sed -i` は不使用。

### タスク8: No.19 に伴う資料の2か所（`_doc/arch/12_shapes.md` 29行・`PROJECT_ARCHITECTURE.md` 3章24.。REQの補足決定）
*   **作業内容** :
    *   前提：`grep -c SegmentSwitchTarget js/shapes/PathCornerRules.js` は1件（タスク7の文が入っている）。
    *   `_doc/arch/12_shapes.md` 29行：「。`SegmentSwitchTarget`側のJSDocには`CornerTarget`との関係が書かれているが、コードは`PathCornerRules`を変えないため`CornerTarget`側からの言及は無い）」を「。この関係は互いのJSDocに書かれている）」に直した（1行のまま。同じ括弧のほかの語と29行のほかの語は未変更）。
    *   `PROJECT_ARCHITECTURE.md` 3章24.「モジュールの分担」（681行）：「。この関係は`SegmentSwitchTarget`側のJSDocには書かれているが、`PathCornerRules`は変えないファイルのため`CornerTarget`側からの言及は無い）」を同じ「。この関係は互いのJSDocに書かれている）」に直した（ほかの文は未変更）。
    *   整合確認：`grep -rn "言及は無い"` は0件。`grep -rn "この関係は互いのJSDocに書かれている"` は2件（`PROJECT_ARCHITECTURE.md` 681行・`12_shapes.md` 29行）。`PathCornerRules.js:24` の `CornerTarget` は `SegmentSwitchTarget` の名前を、`PathSegmentKindRules.js:23` の `SegmentSwitchTarget` は `CornerTarget` の名前を書いている（読むだけ）。`git diff -U0` の変更行は各1行（681行・29行）だけ（`--stat` は2ファイル・2 insertions / 2 deletions）。
    *   行末確認：`PROJECT_ARCHITECTURE.md`＝740行/CR 740、`12_shapes.md`＝88行/CR 88でCRLF維持。Pythonのバイナリ置換で行い `sed -i` は不使用。

### タスク9: 確認（要件9。固定タスク）
*   **作業内容** :
    *   コマンド結果：`node --check js/main.js`・`node --check js/shapes/PathCornerRules.js` は2件とも成功。ルートの `node --test` は tests 2067 / suites 337 / pass 2067 / fail 0（変更前と同数）。
    *   `git diff -U0 933c52e -- js`：変更は `js/main.js` 305行・502行のコメント2行と `js/shapes/PathCornerRules.js` 24行のJSDoc1行だけ（実行コード・行数の変更なし）。
    *   `git diff --stat 933c52e`：13ファイル（計画の12ファイル＋本RES。本RESは新規で459 insertions）。`git status --short` は出力なし（未追跡・意図しない新規ファイルなし）。
    *   `git diff --numstat 933c52e`（insertions/deletions）：`PROJECT_ARCHITECTURE.md` 11/11、`06` 3/3、`10` 1/1、`12` 10/10、`14` 2/2、`15` 1/1、`16` 3/3、`28` 1/1、`30` 2/2、`40` 1/1、`main.js` 2/2、`PathCornerRules.js` 1/1。12ファイルとも等しい（増減なし）。本RESは照合から除外。
    *   `git diff -U0 933c52e -- PROJECT_ARCHITECTURE.md _doc/arch` の変更行：`PROJECT_ARCHITECTURE.md` 211・225・252・359・443・467・647・654・673・676・681、`06` 20・37-38、`10` 6、`12` 3・8・13・17・29・40・51-52・63・80、`14` 4・42、`15` 25、`16` 21・135・157、`28` 5、`30` 10・12、`40` 5。いずれもタスク1〜8の計画箇所（下の照合）に対応し、それ以外の行は無い。
    *   行末（行数/CR数）：CRLF維持＝`PROJECT_ARCHITECTURE.md` 740/740、`06` 42/42、`12` 88/88、`14` 105/105、`15` 37/37、`16` 196/196。LF維持＝`10` 9/0、`28` 7/0、`30` 14/0、`40` 6/0、`main.js` 1074/0、`PathCornerRules.js` 187/0。計画の値のまま。
    *   補足：`grep -rn "1189" PROJECT_ARCHITECTURE.md _doc/arch` は `_doc/arch/01_index_html.md` 15行の1件のみ（Phase 09-02a時点の値の経緯の記述。同じ行の現在値は約1261px。計画対象外で正しい記述）。`PROJECT_ARCHITECTURE.md`・`16_test.md` は0件。
    *   **全件の照合**（結果はすべて「直した」。直さなかったものは無い）：
        *   No.1：タスク1。直した（1章「依存方向」。`DragTracker` のimport1件を明記）。
        *   No.2：タスク1。直した（2章 `path` の「作られるのは」に作成途中の線を追加）。
        *   No.3：タスク1。直した（`15_io.md`。版3への版上げは連絡済み）。
        *   No.4：タスク2。直した（3章6.。始点で閉じる終わり方を列挙）。
        *   No.5：タスク2。直した（3章11.冒頭に弧を追加）。
        *   No.6：タスク2。直した（`14_edit.md`。`shapes/` をimportする `edit/` の3クラスを明記）。
        *   No.7：タスク2。直した（3章12.。「直線・曲線以外のツール（弧・矩形・円）」）。
        *   No.8：タスク2。直した（`14_edit.md`。始点で閉じる経路を追加）。
        *   No.9：タスク3。直した（3章22.の `Esc`）。
        *   No.10：タスク3。直した（`06_InputTracker.md` の `cancelDraftOrClearSelection()`）。
        *   No.11：タスク3。直した（`06` の「配線の場面」見出しと関連句）。
        *   No.12：タスク3。直した（3章22.「既存の線とつながる・閉じる」）。
        *   No.13：タスク3。直した（`06` の `#resetSnapState()` の列挙に始点だけでやめる枝を追加）。
        *   No.14：タスク4。直した（3章23.「約1189px」→「約1261px」）。
        *   No.15：タスク4。直した（3章23.。`Tab` で戻るの記述を実態へ。「許容」は残した）。
        *   No.16：タスク5。直した（`12_shapes.md` 13行。`assembleOpenPath` の呼び出し元と範囲）。
        *   No.17：タスク5。直した（`12_shapes.md` 80行。(1)作る操作・(2)区間ごとの配列の使い道）。
        *   No.18：タスク5。直した（`12_shapes.md` 17行。弧のハンドルは `resolveEndpointHandle` で `null`）。
        *   No.19：タスク7＋タスク8。直した（タスク7：`CornerTarget` のJSDoc。タスク8：`12_shapes.md` 29行と `PROJECT_ARCHITECTURE.md` 3章24.681行を「この関係は互いのJSDocに書かれている」に。REQの補足決定）。
        *   No.20：タスク4。直した（`16_test.md`。「上の4ファイル」→「上の3ファイル」）。
        *   No.21：タスク6。直した（`10_ShapeFactory.md` 6行）。
        *   No.22：タスク6。直した（`10_ShapeFactory.md` 6行。追加importは `SEGMENT_KIND_SMOOTH` だけ）。
        *   No.23：タスク6。直した（`28` 5行・`30` 10・12行）。
        *   No.24：タスク1。直した（`40_asset_sprite.md`。版3の連絡済み）。
        *   No.25：タスク5。直した（`12_shapes.md` 63行。`copySegment`）。
        *   No.26：タスク1（`PROJECT_ARCHITECTURE.md` 2章252行）＋タスク5（`12_shapes.md` 40・51・52行）。両方そろって直した。
        *   A1：タスク4。直した（`16_test.md`「約1189px」→「約1261px」）。
        *   A2：タスク4。直した（`16_test.md` の `EndpointSnapRules.test.js` の対象範囲。件数は未変更）。
        *   A3：タスク5。直した（`12_shapes.md` 8行の見出し）。
        *   A4：タスク5。直した（`12_shapes.md` 3行のバッククォート閉じ忘れ）。
        *   `main.js` 305行：タスク7。直した（コメント）。
        *   `main.js` 502行：タスク7。直した（コメント）。
    *   テストプレイ・ブラウザでの確認は行っていない（画面のふるまいが変わらないため）。

### タスク10: 懸念事項・今後の修正における注意点の記述（固定タスク）
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
1. **（計画時・REQの決定から外れた点）No.19 に伴い、REQが変えないとした資料の2文を直す**：REQは「`_doc/arch/12_shapes.md` 29行・`PROJECT_ARCHITECTURE.md` 3章24.は正しいので変えない」としたが、No.19 のJSDocの修正で「`CornerTarget`側からの言及は無い」とその理由の文が事実と合わなくなるため、現場設計セッションの回答（2026-11-21。(A)）により、この2文だけを「この関係は互いのJSDocに書かれている」に直す（タスク8）。3章24.のほかの文とREQが変更禁止に挙げたほかの箇所は変えない。
2. **（計画時）行末の実測がREQと違う**：REQは本作業で触るファイルをすべてCRLFとするが、`_doc/arch/10_ShapeFactory.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md`・`40_asset_sprite.md`・`js/main.js`・`js/shapes/PathCornerRules.js` の作業ツリーはLF（`git ls-files --eol` で `w/lf`）。REQの原則の主旨（行末を変えない）に従い、各ファイルの今の行末を保つ計画にした（2.の共通の直し方4.）。
3. **（計画時）本作業の対象外として残す、近い記述**：`PROJECT_ARCHITECTURE.md` 3章12.「表示を消す箇所」の `#resetSnapState()` の列挙も `removeLastLinePoint` の始点だけでやめる枝を挙げていない（「最後の点を消した直後」に含めて読める書き方）。Survey の5章の26件に入っておらず、REQの要件にも無いため触れない。同じく、2章 `path` の「作られるのは」の列挙には角の切り替え（`planCornerToggle`）が無いが、No.2 の要件は作成途中の線だけのため足さない（`12_shapes.md` 80行はNo.17で足す）。曲線のツールで最後の点を消して点1つに戻った作成途中の線は頂点2つの `Path` を `PathJoinRules.buildDrawnDraft` が作る（`ShapeFactory.create('curve')` ではない）が、No.2・No.17 の要件は「頂点が3つ以上」のため、その言い方のままにする（3章22.「状態の持ち主」が `k = 1` の曲線のツールの形を書いている）。
4. **（計画時）将来この箇所を修正する際の注意**：「直線以外」の範囲の語は、本作業の後も3章22.冒頭の「直線以外のツール・選択（`V`）…は変えない」（Interrupt の時点の記述）に残る。続けて引く線の形（`isDrawnLineShape`）を変えるときは、本作業で「直線・曲線以外のツール（弧・矩形・円）」と書いた3章12.・22.・`06_InputTracker.md` の範囲の語と、`28`・`30` の「直線・曲線のツール」をそろえて見直すこと。区間の種類を足すときは、「直線でない区間（曲線の区間・曲がり方を持つ区間）」と書いた2章252行・`12_shapes.md` 40・51・52行をそろえる。
