# RES: 作業計画・作業レポート (Interrupt) : Phase 12 クローズの開発資料の相違の修正（相違46項＋漏れ3か所＋取り違えやすい記述＋コードのコメント・テストの題）
* 参照元REQ: `./_log/req/261128_1423_REQ_Interrupt_Phase12_Close_Doc_Fix.md`

## 1. 作業目的
Phase 12 クローズの整合確認（Survey `./_log/res/261127_2040_RES_Survey_Phase12_Doc_Consistency.md`）で見つかった、開発資料の記述と実コードの相違を直す。対象は次のとおりで、これ以外は直さない。

* 5章『開発資料との相違』の全46項（No.1〜No.46。No.n＝Survey の (1033＋n) 行。同じ記述を指す No.7＝No.37、No.9＝No.21、No.10＝No.17 は1か所の直しで済む）。
* どのタスクも相違に挙げていなかった古い記述 X1〜X3。
* Survey 6章の「読み方が分かれる記述」のうち A1〜A14（6章のほかの項目には触れない）。
* コードのコメント・JSDoc・テストの題・空行の C1〜C7（コードのふるまい・テストの期待値は一切変えない）。
* C1 に伴う`_doc/arch/03_VectorModel.md` 26行の追随（「`VectorModel.js`のJSDocは変えていない」等の2か所に時点を書き添える。発注者の決定 2026-11-28。REQ の原則4・7）。
* C1 に伴う同じ追随の残り3か所（`PROJECT_ARCHITECTURE.md` 3章29.(i)・30.(g)、`_doc/arch/14_edit.md` 114行付近の「JSDocは古い」「`VectorModel.js`は変えない」の記述に時点を書き添える）。REQ の要件には無いが、発注者の決定（2026-11-28）により対象に加える（`PROJECT_ARCHITECTURE.md`の2か所は REQ 102行「要件1が挙げていない文は変えない」の、発注者の決定による例外）。

本作業は開発資料の修正そのものが目的であり、各タスクで担当する資料を直す（テンプレートの「開発資料の書き換えは最終タスクのみ」は適用しない。REQの定め）。テストプレイは行わない。

## 2. アーキテクチャ設計
### 要件1: `PROJECT_ARCHITECTURE.md`（No.5・6・13〜16・20・25・26、A1〜A7）
* 章で分けて4タスク（1章＝タスク1、2章＝タスク3、3章の1.〜20.＝タスク5、3章の21.〜31.＝タスク7）。4章（1066行以降）は直す箇所が無い。
* 同じ事実にそろえる組：No.5（3章6.）↔ No.1・A11（`03_VectorModel.md`。タスク2）、No.14（1章29行）↔ No.45（`32_InputModes.md`。タスク6）、No.16（1章365行）↔ A13（`61_ItemRowRules.md`。タスク6）、No.25（2章428行）↔ 同じ資料の439行。
* 原則9（同じファイルの同じ誤り）で直す候補は、計画時に次を見つけた（各タスクで改めて確かめる）：2章の「今は4」（391・393・395行付近）、3章の「今は4」（755・779・795・845・858・875行付近）。いずれも No.6 と同じ「今の値の古い記述」。2章の「作業データ・書き出し形式の版は4のまま」（388・389行付近）は A1 と同じ経緯の文の形で、原則3（「版4のまま」を例に挙げ、時点を書き添えると定める）と原則9により時点を書き添える（共通の決まり7の例外）。
* 要件1に無い3章29.(i)・30.(g)の「`VectorModel`の…JSDocの…は古い」「`VectorModel.js`は変えず」の2か所は、発注者の決定（2026-11-28）により C1 の追随として直す（REQ 102行の「要件1が挙げていない文は変えない」の例外。発注者の決定による）。C1（タスク9）の後に直すため、タスク7とは別にタスク15で扱う（タスク7で直した29.・30.の記述と矛盾させない）。

### 要件2: `_doc/arch/`の`02`・`03`・`06`・`12`・`32`・`40`・`61`・`69`
* タスク2（`03`・`02`・`69`・`40`）、タスク4（`12`）、タスク6（`06`・`32`・`61`）。
* C1 に伴う`03_VectorModel.md` 26行の追随（発注者の決定 2026-11-28）は、C1（タスク9）の後に直すため、タスク2とは別にタスク13で扱う（タスク2で直した`03`の記述と矛盾させない）。

### 要件3: `_doc/arch/`の`14`・`15`・`17`
* タスク8。No.12（`14_edit.md`）は No.38（`16_test.md`。タスク11）と同じ値（5）にそろえる。
* 要件3に無い`14_edit.md` 114行付近（`PathSplitEditor.js`の「契約」）の「JSDocの「呼び出し側が選択モードであること」は…古い記述で」は、発注者の決定（2026-11-28）により C1 の追随として直す。C1（タスク9）の後に直すため、タスク8とは別にタスク15で扱う（タスク8で直した`14_edit.md`の記述と矛盾させない）。

### 要件4: `_doc/arch/16_test.md`
* 直す箇所が16か所あるため2タスクに分ける（タスク11＝10行付近〜227行付近、タスク13＝240行付近〜330行付近）。テストの題を直すタスク（タスク10・12）の後に置き、直した後の題と食い違わないようにする。

### 要件5: コードのコメント・JSDoc・テストの題（C1〜C7）
* `js/`はタスク9（`VectorModel.js`・`KeyboardShortcuts.js`・`SpriteSerializer.js`・`DrawElementReader.js`）とタスク14（`main.js`・`InputTracker.js`・`ScaleHandleRules.js`）、`test/`はタスク10（`DocumentSerializer.roundtrip.test.js`・`FileContentReader.test.js`）とタスク12（残りの4ファイル）。
* 変えてよいのはコメント・JSDoc・テストの題（`describe`・`it`・`test`の第1引数の文字列）の文字と、C7の空行1行だけ。コード・期待値・テストの入力は変えない。

### 要件6: 確認（タスク16）／懸念事項（タスク17）

### 全タスク共通の作業の決まり（各タスクの実行AIは必ず守る）
1. **読む範囲**：REQ（`./_log/req/261128_1423_REQ_Interrupt_Phase12_Close_Doc_Fix.md`）の【共通の直し方の原則】（41〜50行）を読む。担当する No. の詳細が要るときは Survey の (1033＋n) 行だけを読む（Survey は約440KB。全体を読まない）。`PROJECT_ARCHITECTURE.md`は1行が非常に長いため全体を読まず、担当箇所だけを次のように切り出して読む：`LC_ALL=C.UTF-8 grep -n -o -P '.{0,200}<文言>.{0,200}' <ファイル>`。
2. **行番号ではなく文言で箇所を特定する**。本計画の行番号は計画時（作業開始時と同じ）の値で、前のタスクの直しでずれることがある。
3. **直す前に実コードを確かめる**：各項の「実コードの実態」を `grep`・`Read` で確かめる。**Survey の記述と実コードが食い違ったら（Survey の調査自体が誤っていたら）、その箇所を直さず、タスクを中断して最終報告の「質問:」に相違点を書く。**
4. **行末を保つ**：直す前と後に、触るファイルごとに次を測り、作業レポートに書く。`for f in <ファイル>; do printf '%s bytes=%s LF=%s CR=%s\n' "$f" "$(wc -c < "$f")" "$(tr -cd '\n' < "$f" | wc -c)" "$(tr -cd '\r' < "$f" | wc -c)"; done`。CRLFのファイルは直した後も CR＝LF、LFのファイルは直した後も CR＝0（作業前と同じ関係）であること。`grep -c $'\r$'` は使わない。CRLF／LF の別は REQ の原則5の一覧のとおり（`PROJECT_ARCHITECTURE.md`・`_doc/arch/02`・`03`・`06`・`12`・`14`・`15`・`16`・`17`・`61`・`69`・`js/core/KeyboardShortcuts.js`・`js/io/SpriteSerializer.js`・`js/main.js`・`js/core/InputTracker.js`＝CRLF、`_doc/arch/32`・`40`・`js/core/VectorModel.js`・`js/core/ScaleHandleRules.js`・`js/io/DrawElementReader.js`・本計画で触るテスト6ファイル＝LF）。
5. **書き換えは `Edit` で、一意に決まる短い文言を `old_string` にする**。直す語句の外の文字は1文字も変えない（原則6）。文が伸びるときは同じ文の冗長な表現を削って差し引く（原則7）。経緯の付記（「（Phase 12-0x）」「発注者の決定」等）は内容を変える必要がなければ残す（原則8）。
6. **版・数の古い値の直し方（原則3）と表現の統一**：作業データの現行は版5（`MIGRATIONS`は`{ 1, 2, 3, 4 }`）、書き出し形式の現行も版5（`checkFormat`は版1〜5を受理）、図形クラスの共通メソッド契約は20。今のテスト・今のコードを述べる文は今の値に直す。過去のPhaseの経緯の文は時点を書き添える。書き添えの表現は既存の「（版は当時の2のまま。今は4）」の形に合わせ、**「当時の◯のまま。今は△」**（括弧の中にあるときは「（当時の4のまま。今は5）」）とする。すでに「当時」「書き換え」と明記した記録は直さない。
7. **原則9（同じ誤りの書き写し）**：No.・X・C の項を直したら、同じファイルの中に同じ誤りが別の言い方で残っていないかを `grep` で確かめ、あれば同じように直して作業レポートに書く。別のファイルで見つけたものは直さず、作業レポートに「懸念事項へ送る」として書く。**A の項（Survey 6章由来）については、同じ言い回しの別の箇所を見つけても直さず作業レポートに書くだけにする**（6章のほかの項目に当たるおそれがあり、REQ が「6章のほかの項目には触れない」と定めているため）。**ただし、原則3の版・数の古い値（「版は4のまま」等）は、A の項と同じ形の文でも原則3・9により時点を書き添えて直し、作業レポートに書く**（例：タスク3の388・389行付近）。
8. **矛盾の確認**：直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめる。矛盾を見つけたら、担当外の箇所は直さず作業レポートに書く。
9. **作業レポート**：タスクの終わりに、本RESの「4. 詳細作業内容」の該当タスクの欄へ、直した番号（No.・X・A・C）ごとに直した前後の記述の要点、原則9で直したもの／見つけたが直さなかったもの、行末の実測（前・後）を書き、「3. タスクリスト」の該当タスクを `[x]` にする。
10. **触らないもの**：REQ の【変更してはならないもの】のとおり（`PROJECT_CONSTITUTION.md`・`_doc/`の COWORK 等・`_log/`の既存ファイル・`index.html`・`sprite-check.html`・`asset/`・担当外の`js/`・`test/`・要件に無い`_doc/arch/`のファイル、章番号・節の順序）。各タスクは「対象ファイル」に挙げたファイルと本RESだけを変える。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./`（`PROJECT_ARCHITECTURE.md`）、`./_doc/arch/`（モジュール別の資料）、`./js/core/`・`./js/io/`・`./js/`（`main.js`）のコメント・JSDoc、`./test/io/`・`./test/edit/`のテストの題
*   **関連する論理クラス**: 資料の記述の対象として `VectorModel`・`InputTracker`・`InputModes`・`ItemTreeRules`・`CompoundPathRules`・`ItemRowRules`・`PathJoinRules`・`EndpointSnapRules`・`VertexSnapRules`・`ShapeGeometry`・`EndpointSnapper`・`PathVertexEditor`・`PathSplitEditor`・`DocumentSerializer`・`SpriteSerializer`・`DrawElementReader`・`FileContentReader`・`CodeExporter`・`KeyboardShortcuts`・`ScaleHandleRules`（いずれもふるまいは変えない）

### 参照する責務
*   本作業は資料の記述を実コードに合わせるものであり、責務の判断を要しない（REQ【関連する責務】）。資料の記載基準（`PROJECT_ARCHITECTURE.md`冒頭）の要点：
    *   第一の目的はハルシネーションの防止、第二がコンテキストの削減。第二のために第一を犠牲にしない。
    *   残す：責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路。
    *   書かない：1つのファイルのJSDocを読めば分かること（引数と戻り値、private項目、typedefの中身、定数の値、1クラス内の処理順）。
    *   消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。
*   依存方向（`PROJECT_ARCHITECTURE.md` 1章365行付近）：`main.js → edit → io → core → shapes`。`edit/ → io/`は許される向き、`io/ → edit/`は許されない向き。`edit/ → core/`は17ファイルの例外。
*   コードを資料に合わせて直すことはしない。設計の変更提案もしない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   本作業そのものが資料の修正であり、各タスクで担当箇所を直す（タスク1・3・5・7・15）。新しい論理クラスの追加・責務の割り当ての変更は無い。
*   スリム化はしない（クローズの片付けで現場設計セッションが行う）。

## 3. タスクリスト
*   [ ] タスク1: `PROJECT_ARCHITECTURE.md` 1章（No.13・14・15・16、A6）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。1章＝15〜368行付近だけ。CRLF）
    *   **作業内容** :
        *   No.14・No.13・No.15・No.16・A6 を直す（詳細は4章のタスク1）。原則9で1章の中を確かめる。

*   [ ] タスク2: `_doc/arch/03_VectorModel.md`・`02_main.md`・`69_CompoundPathRules.md`・`40_asset_sprite.md`（No.1＋A11・No.4・No.42・No.43・No.8）
    *   **対象ファイル** :
        *   `./_doc/arch/03_VectorModel.md` :（更新。CRLF）
        *   `./_doc/arch/02_main.md` :（更新。CRLF）
        *   `./_doc/arch/69_CompoundPathRules.md` :（更新。CRLF）
        *   `./_doc/arch/40_asset_sprite.md` :（更新。LF）
    *   **作業内容** :
        *   No.1とA11を同時に・No.4・No.42・No.43・No.8 を直す（詳細は4章のタスク2）。

*   [ ] タスク3: `PROJECT_ARCHITECTURE.md` 2章（No.25・26、A4・A5、原則9の版の古い値）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。2章＝369〜521行付近だけ。CRLF）
    *   **作業内容** :
        *   No.25・A5・No.26・A4 と、原則9の「今は4」「版は4のまま」を直す（詳細は4章のタスク3）。

*   [ ] タスク4: `_doc/arch/12_shapes.md`（No.2・3・9（＝No.21）・22・23・24、X3、A8・A9）
    *   **対象ファイル** :
        *   `./_doc/arch/12_shapes.md` :（更新。CRLF）
    *   **作業内容** :
        *   詳細は4章のタスク4。

*   [ ] タスク5: `PROJECT_ARCHITECTURE.md` 3章の1.〜20.（No.5・20、A7、原則9の「今は4」）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。3章の522行付近〜20.の終わり（874行付近）だけ。CRLF）
    *   **作業内容** :
        *   詳細は4章のタスク5。

*   [ ] タスク6: `_doc/arch/06_InputTracker.md`・`32_InputModes.md`・`61_ItemRowRules.md`（No.44＋A10・No.45・No.46＋A12・A13）
    *   **対象ファイル** :
        *   `./_doc/arch/06_InputTracker.md` :（更新。CRLF）
        *   `./_doc/arch/32_InputModes.md` :（更新。LF）
        *   `./_doc/arch/61_ItemRowRules.md` :（更新。CRLF）
    *   **作業内容** :
        *   詳細は4章のタスク6。

*   [ ] タスク7: `PROJECT_ARCHITECTURE.md` 3章の21.〜31.（No.6、A1・A2・A3、原則9の「今は4」）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。3章の21.（875行付近）〜31.の終わり（1065行付近）だけ。CRLF）
    *   **作業内容** :
        *   詳細は4章のタスク7。

*   [ ] タスク8: `_doc/arch/14_edit.md`・`15_io.md`・`17_sprite_check.md`（No.10（＝No.17）・12・18・19、X1・X2、A14）
    *   **対象ファイル** :
        *   `./_doc/arch/14_edit.md` :（更新。CRLF）
        *   `./_doc/arch/15_io.md` :（更新。CRLF）
        *   `./_doc/arch/17_sprite_check.md` :（更新。CRLF）
    *   **作業内容** :
        *   詳細は4章のタスク8。

*   [ ] タスク9: `js/`のJSDoc・空行その1（C1・C2・C3・C7、C6）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。JSDocのみ。LF）
        *   `./js/core/KeyboardShortcuts.js` :（更新。JSDocのみ。CRLF）
        *   `./js/io/SpriteSerializer.js` :（更新。JSDocの行の並べ替えのみ。CRLF）
        *   `./js/io/DrawElementReader.js` :（更新。空行1行の追加のみ。LF）
    *   **作業内容** :
        *   コメント・JSDocの文字と空行だけを変える。コードは1文字も変えない（詳細は4章のタスク9）。

*   [ ] タスク10: テストの題その1（C4、C6）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` :（更新。`it`の題の文字列のみ。LF）
        *   `./test/io/FileContentReader.test.js` :（更新。`it`の題の文字列のみ。LF）
    *   **作業内容** :
        *   題の版の数字を、そのテストが確かめている値に合わせる。期待値・入力・コードは変えない（詳細は4章のタスク10）。

*   [ ] タスク11: `_doc/arch/16_test.md` その1（No.11・30・31・32・33・34・35・36・38・7（＝No.37））
    *   **対象ファイル** :
        *   `./_doc/arch/16_test.md` :（更新。10行付近〜227行付近の該当箇所だけ。CRLF）
    *   **作業内容** :
        *   詳細は4章のタスク11。

*   [ ] タスク12: テストの題その2（C4、C6）
    *   **対象ファイル** :
        *   `./test/io/SpriteSerializer.items.test.js` :（更新。`it`の題の文字列のみ。LF）
        *   `./test/edit/PathVertexEditor.items.test.js` :（更新。`test`の題の文字列のみ。LF）
        *   `./test/edit/PathSplitEditor.items.test.js` :（更新。`test`の題の文字列のみ。LF）
        *   `./test/io/DocumentSerializer.collapsed.test.js` :（更新。`it`の題の文字列のみ。LF）
    *   **作業内容** :
        *   詳細は4章のタスク12。

*   [ ] タスク13: `_doc/arch/16_test.md` その2・`03_VectorModel.md` 26行（No.39・40・41・27・28・29、C1の追随）
    *   **対象ファイル** :
        *   `./_doc/arch/16_test.md` :（更新。240行付近〜330行付近の該当箇所だけ。CRLF）
        *   `./_doc/arch/03_VectorModel.md` :（更新。26行の2か所だけ。CRLF。タスク2とは別のタスク）
    *   **作業内容** :
        *   詳細は4章のタスク13。

*   [ ] タスク14: `js/`のコメント・JSDocその2（C5、C6）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新。コメント・JSDocのみ。CRLF）
        *   `./js/core/InputTracker.js` :（更新。JSDocのみ。CRLF）
        *   `./js/core/ScaleHandleRules.js` :（更新。JSDocのみ。LF）
    *   **作業内容** :
        *   詳細は4章のタスク14。

*   [ ] タスク15: `PROJECT_ARCHITECTURE.md` 3章29.・30.・`_doc/arch/14_edit.md`（C1の追随の残り3か所。発注者の決定）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。3章29.の(i)・30.の(g)の2か所だけ。CRLF。タスク7とは別のタスク）
        *   `./_doc/arch/14_edit.md` :（更新。114行付近の1か所だけ。CRLF。タスク8とは別のタスク）
    *   **作業内容** :
        *   詳細は4章のタスク15。

*   [ ] タスク16: 確認（要件6）
    *   **対象ファイル** :
        *   なし（確かめるだけ。本RESの記入のみ）
    *   **作業内容** :
        *   `node --test`・`git diff --stat`・`js/`と`test/`の差分の読み合わせ・全ファイルの行末の確認（詳細は4章のタスク16）。

*   [ ] タスク17: 懸念事項・要確認ポイントの記述
    *   **対象ファイル** :
        *   本RES（`./_log/res/261128_1531_RES_Interrupt_Phase12_Close_Doc_Fix.md`）の「5. 懸念事項・要確認ポイント」のみ
    *   **作業内容** :
        *   詳細は4章のタスク17。

## 4. 詳細作業内容
※ 各タスクの「計画」は計画時に書いた作業の指示。タスクの実行AIは、その下の「作業内容（レポート）」に結果を記入する。行番号は計画時の値（文言で特定すること）。

### タスク1: `PROJECT_ARCHITECTURE.md` 1章（No.13・14・15・16、A6）
*   **計画** :
    *   **No.14（29行付近。構成図の`InputModes.js`の「…から使う」）**：`InputModes.js`をimportするのは12ファイル（計画時の実測 `grep -rln "from '[^']*InputModes\.js'" js`：`CursorShapeRules`・`GroupCommandRules`・`InputTracker`・`ItemListRules`・`KeyboardShortcuts`・`NudgeTargetRules`・`ScaleHandleRules`・`ToolRules`・`VertexEditRules`・`VertexHandleRules`・`main.js`・`wiring/ToolIconWiring`）。列挙に無い`GroupCommandRules`・`ItemListRules`を足す（並びは既存の列挙の形に合わせ、既存の名前の順は変えない）。タスク6の No.45（`32_InputModes.md`）と同じ12ファイルになる。
    *   **No.13（60行付近。構成図の`ItemTreeRules.js`の「…から使う」）**：importするのは16ファイル。列挙に無い`CompoundPathRules`を足す（計画時の実測 `grep -rln "from '[^']*ItemTreeRules\.js'" js`）。
    *   **No.15（358行付近。「`CompoundPathRules`…は、描画（`main.js`→`CanvasManager`）・当たり判定（`PointHitRules`）・スタイル（`edit/`）・書き出し（`io/SpriteSerializer`）の4か所から使われるため`core/`に置く」）**：使う側は9ファイル（計画時の実測 `grep -rln "from '[^']*CompoundPathRules\.js'" js`：`core/CanvasManager`・`core/ItemRowRules`・`core/PointHitRules`・`core/VectorModel`・`edit/CompoundPathEditor`・`edit/ShapeStyleEditor`・`edit/StyleEyedropper`・`io/SpriteSerializer`・`wiring/ItemListWiring`）で、`main.js`はimportしない。「4か所」の列挙をこの実態に合わせる（長くしないため、役割でまとめてよい。例：描画（`CanvasManager`）・当たり判定（`PointHitRules`）・`VectorModel`・一覧の行（`ItemRowRules`・`wiring/ItemListWiring`）・スタイルと切り替え（`edit/`の3ファイル）・書き出し（`io/SpriteSerializer`））。続く括弧「（`io/`は`core/`をimportできるが`edit/`はimportできず、…）」は変えない。
    *   **No.16（365行付近。依存方向の「フォルダ・一覧の規則は…の段に分かれ、自分より前の段だけをimportする」）**：計画時のimportの実測は次のとおりで、358行付近の文（`CompoundPathRules`が`InsertTargetRules`等と同じ段、`ItemRowRules`が次の段、`ListDragRules`がその次）が正しい。365行付近の段の列挙を「`ItemTreeRules`（何もimportしない）、`GroupTreeRules`、`ItemPlaceRules`・`ItemStateRules`・`GroupSelectionRules`・`GroupCollapseRules`、`InsertTargetRules`・`RemovalRules`・`SoloVisibilityRules`・`CompoundPathRules`、`ItemRowRules`、`ListDragRules`」の形に直す（`ItemRowRules`を`InsertTargetRules`の段から外して次の段にし、`CompoundPathRules`を足す）。直す前に各ファイルの`from '…'`を確かめる。
        *   実測：`GroupTreeRules`←`ItemTreeRules`／`ItemPlaceRules`・`ItemStateRules`・`GroupSelectionRules`・`GroupCollapseRules`←`ItemTreeRules`・`GroupTreeRules`／`InsertTargetRules`←`ItemTreeRules`・`GroupTreeRules`・`GroupSelectionRules`・`ItemPlaceRules`／`RemovalRules`←`ItemTreeRules`・`GroupTreeRules`・`ItemStateRules`／`SoloVisibilityRules`←`GroupTreeRules`・`ItemPlaceRules`・`ItemStateRules`／`CompoundPathRules`←`ItemTreeRules`・`ItemStateRules`／`ItemRowRules`←`ItemTreeRules`・`GroupTreeRules`・`ItemPlaceRules`・`ItemStateRules`・`CompoundPathRules`／`ListDragRules`←`ItemTreeRules`・`ItemRowRules`・`ItemPlaceRules`。
        *   直した後、358行付近の文・63行付近の`ItemRowRules.js`の項「（`CompoundPathRules`の1つ後の段）」と食い違わないことを確かめる。タスク6の A13（`61_ItemRowRules.md`）はこの事実にそろえる。
    *   **A6（355行付近。「存在しないもの」の「`main.js`への操作モードの判定の追加（削除ボタンの見た目は…、`main.js`に操作モードの判定は無い。Phase 12-01。3章29.）」）**：削除ボタンの見た目の判定についての文だと分かるようにする（`main.js`全体には`getMode()`の比較が残る）。例：「…、削除ボタンの見た目の判定は`main.js`に無い」。同じ言い回しは3章の838行付近（18.）・1045行付近（30.）にもあるが、A の項の決まり（共通の決まり7）により直さず作業レポートに書く。
    *   **原則9**：1章の中で「4か所」「の段」、`InputModes`・`ItemTreeRules`・`CompoundPathRules`の使う側の列挙、「今は4」を `grep` で確かめる。
    *   **行末**：CRLF（作業前後で CR＝LF）。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク2: `_doc/arch/03_VectorModel.md`・`02_main.md`・`69_CompoundPathRules.md`・`40_asset_sprite.md`（No.1＋A11・No.4・No.42・No.43・No.8）
*   **計画** :
    *   **No.1＋A11（`03_VectorModel.md` 19行の末尾「`deleteShapes`は製品コードからの呼び出し元が無くなった（削除は`rearrangeItems`へ一本化。既存のテストが使うため残す）」）**：製品コードの呼び出しは`js/edit/PathVertexEditor.js:113`・`js/edit/PathSplitEditor.js:137`の2か所（計画時の実測 `grep -rn 'deleteShapes(' js`）。同じファイルの2・3行目（呼び出し元は`edit/PathVertexEditor`（Phase 12-01）と`edit/PathSplitEditor`（Phase 12-02）だけ）と食い違わないように直す。図形・フォルダの削除の経路が`rearrangeItems`へ一本化されている事実は残す。例：「図形・フォルダの削除は`rearrangeItems`へ一本化。`deleteShapes`の製品コードの呼び出し元は`edit/PathVertexEditor`・`edit/PathSplitEditor`だけ（上の項）」。`PROJECT_ARCHITECTURE.md` 3章6.（タスク5の No.5）も同じ事実にそろえる。
    *   **No.4（`03_VectorModel.md` 22行の末尾「設定・解除を呼ぶのは…」「そのほかに`getSelectedVertices`を読むのは…」）**：計画時の実測（`grep -rn 'SelectedVertices()\|setSelectedVertices(\|clearSelectedVertices(' js`）：
        *   設定・解除：`InputTracker`、`edit/PathCornerEditor`（`setSelectedVertices`。:124）、`edit/PathVertexEditor`（`setSelectedVertices` :81・`clearSelectedVertices` :104。Phase 12-01）、`edit/PathSplitEditor`（`clearSelectedVertices` :122。Phase 12-02）。
        *   読む：`InputTracker`・`main.js`（`renderCurrentState`）・`edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/TransformInputEditor`（この3つは`resolveNudgeTarget`へ渡す）・`edit/PathCornerEditor`・`edit/PathVertexEditor`・`edit/PathSplitEditor`（この3つは`collectVertexTargets`へ渡す。`PathCornerEditor`は付け替え`#remapSelectedVertices`でも読む）。
        *   今の文「（後の3つは`resolveNudgeTarget`の引数に渡す）」は`PathCornerEditor`については今は誤り（`js/edit/PathCornerEditor.js:165`は`collectVertexTargets`）。Survey は挙げていないが同じ文の中なので No.4 と一緒に直し、作業レポートに書く。
    *   **No.42（`02_main.md` 71行 `PathVertexEditor`の注入の表「`getMode`の値は解釈せず`core/NudgeTargetRules`へ渡すだけ」）**：実際は`core/VertexTargetRules`の`collectVertexTargets`へ渡す（`js/edit/PathVertexEditor.js:6`・`:124`）。原則9：`02_main.md`の中の`PathSplitEditor`・`PathCornerEditor`の注入の説明で同じ誤り（`NudgeTargetRules`へ渡す、と書いているが実際は`collectVertexTargets`）が無いかを確かめる（計画時の実測で`PathSplitEditor.js:107`・`PathCornerEditor.js:165`も`collectVertexTargets`）。
    *   **No.43（`69_CompoundPathRules.md` 13行「置き場所の理由」の「`io/`は`core/`をimportできるが`edit/`は`io/`をimportできず」）**：`edit/ → io/`は許される向きで、実コードでも`edit/`は`io/`をimportしている（`js/edit/CanvasFileOperations.js`ほか）。`PROJECT_ARCHITECTURE.md` 358行付近の対応する文「`io/`は`core/`をimportできるが`edit/`はimportできず」は、主語を`io/`とする「`io/`は`edit/`をimportできない」の意味（依存方向 `main.js → edit → io → core → shapes`）と読むのが依存方向と合う。そこで 69 の文を「`io/`は`core/`をimportできるが`edit/`をimportできず」（`io/ → edit/`は禁止）の意味に直す。**注意**：Survey 5章はこの358行付近の文を「`edit/`が`core/`をimportできない」と推測して読んでいる（推測と明記）。69 の誤り自体は依存方向と実コードで確かめられるが、直す向きの読みが Survey の推測と違うため、作業レポートに読みの根拠を書く。同じ行の「描画（`main.js`→`CanvasManager`）・…の4か所が使う」は No.15（`PROJECT_ARCHITECTURE.md`）と同じ誤りだが別のファイルなので**直さず**、作業レポートに「懸念事項へ送る」と書く。
    *   **No.8（`40_asset_sprite.md` 2行「現行の書き出し形式は版4（Phase 10-02）で、…（`SpriteSerializer.checkFormat`は版1〜4を受理し、…）」）**：現行は版5（Phase 12-04）、`checkFormat`は版1〜5を受理（`js/io/SpriteSerializer.js`の`SPRITE_FORMAT_VERSION = 5`・`checkFormat`）。今の値に直す。「生成物は版2・`source`入りのまま書き換えない」等のほかの部分は変えない。
    *   **行末**：`03`・`02`・`69`＝CRLF、`40`＝LF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク3: `PROJECT_ARCHITECTURE.md` 2章（No.25・26、A4・A5、原則9の版の古い値）
*   **計画** :
    *   **No.25（428行付近。描画要素`compoundPath`の描き方「`outlines`が空でない配列で、すべての輪郭の形の項目が足りていなければ何もしない」）**：実コードは、`outlines`が配列でない・空、または輪郭が1つでもオブジェクトでない・`canTrace`が偽なら何もしない（`js/io/CodeExporter.js`の`compoundPath`の描き方。計画時は177〜185行付近の生成テキスト）。439行付近の読み手の規則「`outlines`が配列でない・空・形の項目が足りない輪郭が1つでもある…要素は描かない」と食い違わない書き方にする。例：「`outlines`が配列でない・空、または形の項目が足りない輪郭が1つでもあれば何もしない」。
    *   **A5（429行付近。描き方の順序「塗り（`fillStyle` → `fill()`。引数なし＝nonzero）」）**：`compoundPath`は`fill('evenodd')`で塗る（428・439行付近）ことと取り違えない書き方にする（例：「引数なし＝nonzero。`compoundPath`だけは`evenodd`（上の項）」）。長くしない。
    *   **No.26（459行付近。`compoundPath`→複合パスのフォルダ「`outlines`が配列でない・空・輪郭がオブジェクトでない・`kind`が変換表に無い（入れ子の`compoundPath`を含む）は`Error`」）**：列挙に無い「輪郭の変換の失敗」（今の変換関数が投げる：`points`が配列でない、`bezierPath`の`segments`の不備、`ellipse`の数値・半径・角度の不備）でも`Error`になる（`js/io/DrawElementReader.js`の`toCompoundPathShapeData`の`map`の中の`CONVERTER_BY_KIND`の呼び出し。JSDocの「または輪郭の変換に失敗したとき」）。列挙に足す（例：「…・輪郭の変換に失敗した（今の変換関数が投げた）ときは`Error`」）。
    *   **A4（404・405行付近。「版3→版4の移行（`migrateVersion3To4`。Phase 11-01。`MIGRATIONS`は`{ 1, 2, 3 }`）」）**：Phase 11-01の時点の値だと分かるようにする（今は`{ 1, 2, 3, 4 }`。すぐ下の「版4→版5の移行」の項の書き方とそろえる）。例：「`MIGRATIONS`は当時の`{ 1, 2, 3 }`。今は`{ 1, 2, 3, 4 }`」。
    *   **原則9（2章の中）**：
        *   388行付近「頂点の追加・削除（Phase 12-01。…。作業データ・書き出し形式の版は4のまま）」・389行付近「分割・区間の削除（Phase 12-02。…。作業データ・書き出し形式の版は4のまま）」：原則3の経緯の文（A1と同じ形）。原則9。時点を書き添えて「作業データ・書き出し形式の版は当時の4のまま。今は5」にする（共通の決まり7の例外）。
        *   391・393・395行付近の「今は4」→「今は5」（No.6と同じ「今の値の古い記述」。作業データの現行は版5）。
        *   直さないもの（時点が分かる記録）：399行付近の「版4（Phase 11-01）の要素は2種類」「`collapsed`（Phase 11-04a。版4のまま足したキー）」、412〜413行付近、416〜418行付近・441行付近の「（Phase 11-06a。版は4のまま）」「`checkFormat`は版1〜4を受理するまま」（同じ箇所に版5の経緯も書かれている）。ほかにも見つけたら、時点が分かるかで判断し作業レポートに書く。
    *   **行末**：CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク4: `_doc/arch/12_shapes.md`（No.2・3・9（＝No.21）・22・23・24、X3、A8・A9）
*   **計画** :
    *   **No.24（3行 `ShapeGeometry.js`の`isPointInPolygonEvenOdd`「各図形クラスの`isInsideOutline`が使う」）**：使うのは`Curve`・`Rect`・`Path`・`Ellipse`（弧のみ）の`isInsideOutline`。`Line`は使わず常に偽、`Ellipse`の円は独自の式（計画時の実測 `grep -n 'isPointInPolygonEvenOdd' js/shapes/*.js`）。78行の`isInsideOutline`の項と食い違わないようにする。
    *   **A9（3行 `cubicBezierPoint`「（3次ベジェの点。`Path`・`shapes/PathVertexRules`が使う。Phase 12-01）」）**：Phase 12-01で新設したのではなく、`PathVertexRules`が使い始めたことが分かる書き方にする（例：「`Path`と、Phase 12-01から`shapes/PathVertexRules`が使う」）。
    *   **No.2（13行 `PathJoinRules`の項「`classifyJoin`が`'close'`を返すのは選択が1本の`path`で頂点3つ以上の開いたパスのときだけ（今の曲線1本は閉じない）」）**：実コード（`js/shapes/PathJoinRules.js`の`classifyJoin`）は、1本の分岐が`isJoinableLine`かつ`chainSourceOf(...).points.length >= 3`で、Phase 12-02から弧1本も`'close'`。同じ資料の8行・13行の前の文・`PROJECT_ARCHITECTURE.md` 3章11.と食い違わないように直す。その段落がPhase 09-03bの時点の記述として書かれているなら時点を書き添えて今の事実を短く添え、今の文なら今の事実に直す（どちらにしたかを作業レポートに書く）。
    *   **No.3（13行「何も起きないのは、…頂点3つの開いたパスを閉じようとしたとき（まとめると頂点2つで`planJoin`が`null`を返す。ボタンは押せる見た目で何も起きない。…）」）**：Phase 12-02から`canJoin`は`planJoin(...) !== null`で、この形では結合のボタンは`disabled`（押せない見た目）（`js/edit/PathJoiner.js`の`canJoin`、`js/main.js`の結合のボタンの同期）。8行の記述（押せない）と食い違わないように直す。
    *   **A8（13行 `chainSourceOf`の「（Phase 12-01で`export`にした。…ファイル先頭の責務定義も変えていない）」）**：Phase 12-01の時点の話だと分かるようにする（ファイル先頭の責務はPhase 12-02で変わった）。同じ行の`segmentKindsOf`（Phase 09-02b）の「ファイル先頭の責務定義も変えていない」は A8 の対象外のため直さず、作業レポートに書く（共通の決まり7）。
    *   **No.23（17行 `EndpointSnapRules.js`の`snapDistance`「`findNearestEndpoint`・`findDrawnLineSnapTarget`の始点の判定・`VertexSnapRules`が使う」）**：直接呼ぶのは`findNearestSnapPoint`（`js/shapes/EndpointSnapRules.js:120`）・`findDrawnLineSnapTarget`（:191）・`VertexSnapRules`（`chooseSnapTarget`。`js/shapes/VertexSnapRules.js:85`）。`findNearestEndpoint`は直接呼ばない。列挙を直す。
    *   **No.9（＝No.21。28行 `VertexSnapRules.js`の「読むもの」「図形クラスの共通メソッドは足さない（18メソッド契約のまま）」）**：経緯の付かない今の文として今の値（20）に直す（REQ要件2）。67・68行の「20メソッド契約」と一致させる。
    *   **No.22（123行 `Path`の「区間の要素数の不変条件」「…共通メソッド契約は18のまま。…」）**：経緯の文（Phase 12-01）として時点を書き添える（例：「共通メソッド契約は当時の18のまま。今は20」）。「`Path`に追加・削除のメソッドは足していない」は正しいので残す。
    *   **X3（124行「…18メソッドは増やしていない」）**：経緯の文として時点を書き添える（今は20）。
    *   **原則9**：125行にも「18メソッドは増やしていない」がある（X3と同じ誤り）。同じ形で時点を書き添える。12_shapes の中の「18」「19」の言及は計画時に76行（`createTransformed`＝第18メソッド。正しい）・77行（`appendOutline`＝第19メソッド。正しい）も見つけた。これらは直さない。表現（「当時の18…。今は20」等）は 123・124・125行でそろえる。
    *   **行末**：CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク5: `PROJECT_ARCHITECTURE.md` 3章の1.〜20.（No.5・20、A7、原則9の「今は4」）
*   **計画** :
    *   **No.5（561行付近。3章6.「履歴」の削除と切り取りの項「`model.deleteShapes`はここでは呼ばず、Phase 12-01から点の削除で図形ごと消えるときだけ`PathVertexEditor`が呼ぶ」）**：製品コードで呼ぶのは`PathVertexEditor`（点の削除。Phase 12-01）と`PathSplitEditor`（分割・区間の削除。Phase 12-02）の2か所。同じ資料の558行付近・「分割・区間の削除（Phase 12-02…）」の項、`03_VectorModel.md`（タスク2）と同じ事実にそろえる。例：「…点の削除（Phase 12-01。`PathVertexEditor`）・分割・区間の削除（Phase 12-02。`PathSplitEditor`）で図形ごと消えるときだけ呼ぶ」。
    *   **A7（540行付近。3章6.の`InputAssist`の項「`InputTracker`は`edit/`をimportせず、`beginEdit`／`commitEdit`も呼ばない（記録は`PathVertexEditor`が挟む。6.）」）**：点の追加・削除の経路についての文だと分かるようにする（`InputTracker`は左ドラッグでは`beginEdit`／`commitEdit`を呼ぶ）。例：「…点の追加・削除では`beginEdit`／`commitEdit`も呼ばない」。
    *   **No.20（732行付近。3章13.「オプションバーは2行」の「2行目＝位置・大きさ・変形・整列・分布・角（`X: Y: │ W: 🔒 H: px │ ∠ ° 基準点 反転 │ 整列・分布 │ 角`）」）**：2行目の最後に分割のまとまり（`#option-split-group`。`index.html`の`#option-corner-group`の次。Phase 12-02）がある。同じ行の「Phase 12-02で分割のまとまり約68px＋区切り17pxを足して約1111px」・1章20行付近の`index.html`の項（「2行目＝位置・大きさ・変形・整列・分布・角・分割のオプションバー」）と食い違わないように、並びに「分割」を足す（例：「2行目＝位置・大きさ・変形・整列・分布・角・分割（`… │ 角 │ 分割`）」）。
    *   **原則9（No.6と同じ「今は4」。3章の1.〜20.の中）**：755行付近（15.）・779行付近（16.）・795行付近（17.）・845行付近（19.）・858行付近（20.）の「（版は…当時の2のまま。今は4）」の「今は4」→「今は5」（作業データ・書き出し形式とも現行は版5）。742行付近（14.）の「（この時点。Phase 11-01で作業データは版4になり、…）」は経緯として正しいので直さない。
    *   A6と同じ言い回し（838行付近 18.「`main.js`に操作モードの判定は無い方針は保つ」）は直さず作業レポートに書く（共通の決まり7）。
    *   **行末**：CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク6: `_doc/arch/06_InputTracker.md`・`32_InputModes.md`・`61_ItemRowRules.md`（No.44＋A10・No.45・No.46＋A12・A13）
*   **計画** :
    *   **No.44（`06_InputTracker.md` 17行「ホバー・押下・クリック・カーソルの4箇所は同じ`#classifyPoint`の結果を共用するため、すべて同じ当たりになる」）＋A10（同13行「1つの分類処理の結果をホバー・押下・クリック・カーソルの4箇所で共用し」）**：計画時の実測（`grep -n '#classifyPoint(' js/core/InputTracker.js`）で呼び出しは6か所（ホバー1038、押下1109・1138、クリック1240・1258、ダブルクリック1304＝Phase 12-01）。カーソル（`#updateCursor`）は`#classifyPoint`を呼ばず、`handleMouseMove`が渡したホバーの結果を受ける（1048・2112行付近）。13行・17行とも、実際の呼び出し箇所（ホバー・押下・クリック・ダブルクリック。カーソルはホバーの結果を使う）に合わせる。13・17行の書き方をそろえる。
    *   **No.45（`32_InputModes.md` 4行「使う側（import元）」の列挙）**：`core/GroupCommandRules`（`OperationMode`。`js/core/GroupCommandRules.js:5`）が無い。足すと12ファイルで、タスク1の No.14（`PROJECT_ARCHITECTURE.md` 29行付近）と同じ12ファイルになる。`ItemListRules`は既に列挙にある。
    *   **No.46＋A12（`32_InputModes.md` 4行「`InputState`を`InputTracker.js`・`CursorShapeRules.js`の外で使うのはテストだけ」）**：同じ行の新しい文（`core/VertexEditRules`が`InputState`・`OperationMode`をimport）と食い違う。製品コードで`InputState`を使うのは`InputTracker.js`・`CursorShapeRules.js`・`VertexEditRules.js`（`js/core/VertexEditRules.js:5`。`resolveDoubleClickInsertTarget`で`InputState.IDLE`と比べる）。列挙に`VertexEditRules.js`を足して同じ行の中の食い違いを無くす。
    *   **A13（`61_ItemRowRules.md` 7行「（**規則の段**：`CompoundPathRules`は`ItemTreeRules`・`ItemStateRules`だけをimportし`InsertTargetRules`等と同じ段、`ItemRowRules`はその次の段、`ListDragRules`は更にその次）」）**：タスク1の No.16（`PROJECT_ARCHITECTURE.md` 365行付近）と同じ事実にそろえる。`61_ItemRowRules.md`の中には規則の「段」の定義が無く、4行では「段」を字下げの意味（1段12px）に使っているため、段という語に頼らず、何が何をimportするかで書く（例：「`CompoundPathRules`は`ItemTreeRules`・`ItemStateRules`だけをimportし（このファイルをimportしないため循環しない）、`ListDragRules`がこのファイルをimportする」）。見出し語「**規則の段**」も合わせて直してよい。長くしない。
    *   **原則9**：`06`の中に「4箇所」の同じ言い方が13・17行のほかに無いか、`32`の中に`InputModes`の使う側・`InputState`の使う側の別の列挙が無いかを確かめる（13行は A10 として直すので対象内）。
    *   **行末**：`06`・`61`＝CRLF、`32`＝LF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク7: `PROJECT_ARCHITECTURE.md` 3章の21.〜31.（No.6、A1・A2・A3、原則9の「今は4」）
*   **計画** :
    *   **No.6（981行付近。3章27.「作業データ形式（当時の版3。今は4）・書き出し形式（版4）・履歴のエントリの形は変えない」）**：「今は4」→「今は5」。「書き出し形式（版4）」も当時の値なので、同じ形で時点を書き添える。例：「作業データ形式（当時の版3。今は5）・書き出し形式（当時の版4。今は5）」。
    *   **A1（1035行付近 29.・1044行付近 30.「作業データ・書き出し形式の版は上げない（4のまま）」）**：原則3のとおり時点を書き添える。「（当時の4のまま。今は5）」。タスク3で直した388・389行付近の書き方とそろえる。
    *   **A2（1039行付近 29.「変えないもの：`VectorModel`・`HistoryManager`・`CanvasManager`・`PathSegmentKindRules`・`PathCornerRules`・`PathCornerEditor`・`io/`・`palette/`・`index.html`（…）」、1047行付近 30.「変えないもの：`VectorModel`・`HistoryManager`・`InputTracker`・…・`io/`」）**：そのサブフェイズ（29.＝Phase 12-01、30.＝Phase 12-02）で変えなかった範囲だと分かるようにする（後のサブフェイズで`io/`・`palette/`・`index.html`等が変わったことと取り違えないように）。例：「Phase 12-01で変えないもの：」「Phase 12-02で変えないもの：」。
    *   **A3（1042行付近 29.「点の追加は別の規則`PathVertexRules`・別の手順`PathVertexEditor`で、共有するのは`Path.resolveSegmentControls`・`PathJoinRules.segmentSpecsOf`・`chainSourceOf`だけ」）**：Phase 12-01の時点の話だと分かるようにする（例：「（Phase 12-01の時点で）共有するのは…だけ」）。今の実態に合わせる場合は、`PathSegmentKindRules`・`VertexSnapRules`も`PathVertexRules`をimportする事実を確かめてから書く（`grep -rn "PathVertexRules" js/shapes js/core`）。どちらにしたかを作業レポートに書く。同じ項の前の文は既に「Phase 12-01の時点で」と書いているので、その書き方に合わせる。
    *   **原則9（3章の21.〜31.の中）**：875行付近（21.）の「（版はどちらも当時の2のまま。今は4。…）」の「今は4」→「今は5」。977行付近の「(j) 版4のJSを版3までのエディタで開くと…」・975行付近（「今の現行版は5」と書き済み）・1056行付近の「版4以前の作業データ・版1〜4のJS」は正しいので直さない。A6と同じ言い回し（1045行付近 30.「（`main.js`に操作モードの判定は無い）」）は直さず作業レポートに書く（共通の決まり7）。
    *   **行末**：CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク8: `_doc/arch/14_edit.md`・`15_io.md`・`17_sprite_check.md`（No.10（＝No.17）・12・18・19、X1・X2、A14）
*   **計画** :
    *   **No.10（＝No.17。`14_edit.md` 4行「依存」の末尾「`edit/`から`core/`をimportするのは`NudgeEditor`・…・`SnapshotAdapter`の14個だけで、他のクラスは`core/`をimportしない」）**：実際は17個（計画時の実測 `grep -l "from '\.\./core/" js/edit/*.js`）。列挙に`CompoundPathEditor`・`ShapeStyleEditor`・`StyleEyedropper`を足し「17個」にする。`PROJECT_ARCHITECTURE.md` 365行付近の「17ファイル」と一致させる。
    *   **No.12（`14_edit.md` 44行 `TransformInputEditor.test.js`の項「`SpriteSerializer.serialize`の形（`formatVersion` 4・…）・作業データ（…）の`version` 4」）**：テストは`formatVersion`・`version`とも5を確かめる（`test/edit/TransformInputEditor.test.js:379`・`:381`）。今のテストの値なので5に直す。タスク11の No.38（`16_test.md` 214行）も同じ値にする。
    *   **No.18（`14_edit.md` 57行 `EndpointSnapper`の注意「非公開`#toUsableSnap(snap)`が`commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`findDrawnLineSnap`と、…`joinDraggedEndpoint`の冒頭で…通す」）**：通す側に`findDrawnLinePointSnap`（`js/edit/EndpointSnapper.js`の`findDrawnLinePointSnap`。冒頭ではなく、`findDrawnLineSnap`を呼んだ後、除く図形を決めるために`#toUsableSnap(startSnap)`を通す）を足す。長くしない。
    *   **No.19（`14_edit.md` 54行「`commitDrawnLine`は3引数のまま」）**：`commitDrawnLine(startSnap, endSnap)`は2引数。3引数なのは`commitDrawnLine`からの`#reflectDrawnJoin(drawn, startSnap, endSnap)`の呼び出し（`finishDrawnLine`は第4引数`drawnKindSource`を付ける）。文脈（直前は`#reflectDrawnJoin`の第4引数の説明）に合わせ、例：「`commitDrawnLine`からの`#reflectDrawnJoin`の呼び出しは3引数のまま」と直す。
    *   **X1（`15_io.md` 13行「図形データの並びからの読み込み（Phase 11-06a）」の`deserializeShapeElements(elements, toShapeData)`）**：今のコードは省ける第3引数`toCompoundShapeData = null`を持つ（Phase 12-04。同じファイル18行の項）。第3引数があることが分かるように今のコードに合わせる（例：シグネチャを`deserializeShapeElements(elements, toShapeData, toCompoundShapeData = null)`にし「第3引数はPhase 12-04。下の項」と添える）。長くしない。
    *   **X2（`15_io.md` 59行 契約の項「配列なら`DocumentSerializer.deserializeShapeElements(data.elements, (element) => DrawElementReader.toShapeData(element))`」）**：今のコード（`js/io/FileContentReader.js` 89〜93行付近）は第3引数`(element) => DrawElementReader.toCompoundPathShapeData(element)`も渡す。今のコードに合わせる。
    *   **A14（`17_sprite_check.md` 19行「版5（Phase 12-04。描画要素`compoundPath`）も同じく…（`check/`・`sprite-check.html`のコードは変更なし。…）」）**：19行には「コードは変更なし」が複数ある（Phase 09-01aの版3・Phase 12-04の版5・Phase 10-02の版4・Phase 11-06aの情報欄）。A14の対象は**Phase 12-04（版5）の文の括弧**で、Phase 12-04で変えなかったと分かるようにする（例：「Phase 12-04で`check/`・`sprite-check.html`のコードは変えていない」）。`sprite-check.html`にはPhase 11のクローズの後のInterruptでWEBアイコンの`<link>`が足されている。ほかの「変更なし」は直さず作業レポートに書く（共通の決まり7）。
    *   **原則9**：`14_edit.md`の中の`edit/ → core/`の数え方の別の記述、`#toUsableSnap`の通す側の別の列挙（53・56行付近にもある）、`15_io.md`の中の`deserializeShapeElements`の別の書き方（58行付近は`DrawElementReader.toShapeData, DrawElementReader.toCompoundPathShapeData`の形で第3引数を含む＝誤りではない）を確かめる。
    *   **行末**：3ファイルとも CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク9: `js/`のJSDoc・空行その1（C1・C2・C3・C7、C6）
*   **計画** :
    *   **C1（`js/core/VectorModel.js` 1034行付近 `addShapesWithNewIds`・1098行付近 `replaceShape`のJSDoc）**：「呼び出し側が選択モードであることを保証すること（選択集合は選択モード以外では常に空という不変条件を守るため）」を今の不変条件（選択集合は選択モード・頂点の選択モード以外では空。`_doc/arch/03_VectorModel.md` 17・26行）に合わせる。例：「呼び出し側が選択モードまたは頂点の選択モードであることを保証すること（選択集合は選択モード・頂点の選択モード以外では常に空という不変条件を守るため）」。1098行付近は「`select`が真のときは、」を残す。
    *   **C2（`js/core/KeyboardShortcuts.js` 57行付近 `join`のJSDoc「（開いたパス1本を閉じる・2本を1本の開いたパスにする）」）**：弧1本も閉じる今のふるまい（Phase 12-02。`js/shapes/PathJoinRules.js`の`classifyJoin`のJSDoc・`js/edit/PathJoiner.js`の`canJoin`のJSDoc「頂点3つ以上の開いたパス・弧の1本」）に合わせる。例：「（頂点3つ以上の開いたパス・弧の1本を閉じる・2本を1本の開いたパスにする）」。
    *   **C3（`js/io/SpriteSerializer.js` 17〜21行付近 `SPRITE_FORMAT_VERSION`のJSDocの版の履歴）**：「 * 版4のまま、`source`と描画要素の`id`を外した（…）。」の行を「 * 版5: …」の行の前へ移し、版3 → 版4 → 版4のまま… → 版5 の時系列にする。**各行の文言は1文字も変えない**（行の入れ替えだけ）。
    *   **C7（`js/io/DrawElementReader.js` 261〜262行付近）**：`toShapeData`の閉じ括弧`    }`の直後に`toCompoundPathShapeData`のJSDoc`    /**`が続いている。間に空行を1行足す（ほかのメソッドの間の書き方にそろえる）。空行は空文字の行（空白を入れない。ほかのメソッドの間の空行と同じ内容か確かめる）。
    *   **C6**：`VectorModel.js`・`KeyboardShortcuts.js`・`SpriteSerializer.js`の中に、同じ古い説明が別の言い方で残っていないかを確かめ（例：`grep -n '選択モードであること\|選択モード以外では常に空' js/core/VectorModel.js`、`grep -n '開いたパス1本' js/core/KeyboardShortcuts.js`、`SpriteSerializer.js`の中の版の履歴の別の記述）、あれば同じように直して作業レポートに書く。別のファイルで見つけたものは直さず懸念事項へ送る。
    *   **注意**：`_doc/arch/03_VectorModel.md` 26行は「クラスのJSDocには『`select`が真のときは呼び出し側が選択モードであること』とだけ書かれているが…（Phase 12-01。`VectorModel.js`のJSDocは変えていない）」と書いている。C1で JSDoc を直すとこの記述は今の JSDoc と食い違うため、タスク13で時点を書き添える（発注者の決定 2026-11-28。同じ食い違いの`PROJECT_ARCHITECTURE.md` 3章29.(i)・30.(g)・`_doc/arch/14_edit.md` 114行付近はタスク15）。本タスクでは資料を変えない。タスク13・15が直す内容に合わせられるよう、C1で直した後の JSDoc の文言を作業レポートに写す。
    *   **確認**：直した後、`git diff -- js/core/VectorModel.js js/core/KeyboardShortcuts.js js/io/SpriteSerializer.js js/io/DrawElementReader.js` を読み、変わったのがコメント・JSDocの行と空行1行だけであることを確かめる。
    *   **行末**：`VectorModel.js`・`DrawElementReader.js`＝LF、`KeyboardShortcuts.js`・`SpriteSerializer.js`＝CRLF（足す空行・入れ替える行も同じ行末にする）。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク10: テストの題その1（C4、C6）
*   **計画** :
    *   **C4**：題の版の数字を、そのテストが確かめている値に合わせる。**期待値・入力・コードは変えない**。題が入力の版を述べていて、入力が実際にその版なら直さない。各題について、本体の`assert`と入力の作り方を読んで判断し、作業レポートに書く。数字以外の言い回しは変えない（「4のまま」→「5のまま」のように数字だけを直す）。
        *   `test/io/DocumentSerializer.roundtrip.test.js` 542行付近「serializeの version が 4 である」：544・545行付近で`.version, 5`を確かめる → 5。
        *   同 648行付近「作業データの版は4のまま・…」：651行付近で`.version, 5` → 5。
        *   同 704行付近「…、作業データの版は4のまま」：721・722行付近で`.version, 5` → 5。
        *   同 780行付近（テンプレート文字列）「`${state.name}が保たれ、作業データの版は4のまま（${route.name}）`」：790行付近で`.version, 5` → 5（`${…}`の部分は変えない）。
        *   `test/io/FileContentReader.test.js` 432行付近「今までのJS（source入り）の版4のJS・CRLFのJSから…」：入力は`withSource(shapes)`で、436行付近で`data.formatVersion, 5`を確かめる（入力のJSも版5）→ 5。直す前に`withSource`が今の`SpriteSerializer.serialize`の版を使っていることを確かめる。
    *   **C6**：同じ2ファイルの中で、題の版の数字と確かめている値が食い違う題がほかに無いかを確かめる（`grep -n "版4\|version が 4\|4のまま\|版は4" <ファイル>`等）。あれば同じように直して作業レポートに書く。入力として`version: 4`・`formatVersion: 4`のデータを作って読むテストの題は直さない。
    *   **確認**：`git diff`で、変わったのが`it`の第1引数の文字列だけであることを確かめる。`_doc/arch/16_test.md`がこれらの題を文字どおり引いている箇所があれば（`grep -n '版は4のまま\|version が 4' _doc/arch/16_test.md`）、直さず作業レポートに書く（タスク11・13で扱う）。
    *   **行末**：2ファイルとも LF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク11: `_doc/arch/16_test.md` その1（No.11・30・31・32・33・34・35・36・38・7（＝No.37））
*   **計画** :
    *   **今の値に直すか、時点を書き添えるかの判断**（REQ要件4）：その文が今のテストファイルを指しているか（「計n件」「新設」など今の状態の記述を伴うか）で判断し、項ごとの判断を作業レポートに書く。Phase当時のテストの内容として書いた文は「（当時の版4。今は5）」の形で時点を書き添える。今のテストを述べる文は今の値（5）に直す。タスク10で直したテストの題（今の題は「版5」「5のまま」等）と食い違わないこと。すでに「当時」「書き換え」と明記した記録（130・205・244行付近）は直さない。
    *   **No.11（10行「注入される依存」の「計44ファイル（数え方：実物の`core/VectorModel.js`をimportする`test/edit/*.test.js`の42ファイルと、`test/core/`の`EditableHit.test.js`・`SelectionRules.test.js`。…）」）**：数え方の説明ごと今の実数に直す。計画時の実測：`grep -lE "from '.*core/VectorModel" test/edit/*.test.js | wc -l`＝51、`test/core/`の`VectorModel.*.test.js`以外で実物の`VectorModel`をimportするのは`EditableHit.test.js`・`PointHitRules.compound.test.js`・`SelectionRules.test.js`・`VertexDragRules.test.js`の4ファイル（`ls test/core/*.test.js | grep -v 'VectorModel\.' | xargs grep -lE "from '.*core/VectorModel"`）→計55ファイル。作業時に数え直し、その数で書く。続く「以下はその組み合わせ方で、まずPhase 11-03より前の12ファイル…」以降は変えない。
    *   **No.30（30行 `DocumentSerializer.roundtrip.test.js`「…`version`は4）」）**：544・545行付近で5を確かめる。判断に従い直す。
    *   **No.31（131行 `FileContentReader.test.js`（+2件）「版4の曲線のパスを含むJS（`LF`・`CRLF`）が読める」）**：436行付近で`formatVersion, 5`。タスク10で題を版5に直している。判断に従い直す。
    *   **No.32（162行 Phase 09-02bの追加「…`corners`のキーの有無、版4・キー順）と、…書き出し形式の版4」）**：`DocumentSerializer.roundtrip.test.js` 648行付近は`.version, 5`、`SpriteSerializer.test.js` 681・692・755行付近の題は「版は5」で値も5。判断に従い直す。
    *   **No.33（172行 Phase 09-03aの追加「…作業データの版は4のまま」）**：704行付近は`.version, 5`。判断に従い直す。
    *   **No.34（180行 Phase 09-03bの追加「…作業データの版は4のまま・`console.warn`なし」）**：780行付近は`.version, 5`。判断に従い直す。
    *   **No.35（191行 Phase 10-01の追加「…パスの曲がり方を持つ区間・版4・復元後に動かしても元が不変」）**：904行付近の題は「…版5…」、値も5。判断に従い直す。
    *   **No.36（202行 Phase 10-02の追加「`test/io/SpriteSerializer.test.js`（計81件）：版4・`checkFormat`」）**：1055行付近の題は「formatVersionは5で、checkFormatは版1〜5をsupported・版6をunsupportedVersionとする」、値も5（`describe`の題1011行付近の「版4（Phase 10-02）」はPhase名を含む題でテストファイルの変更対象外）。判断に従い直す。
    *   **No.38（214行 `TransformInputEditor.test.js`（新設・23件）「`formatVersion`（4）…、作業データ…の`version`が4」）**：379・381行付近は5。「新設」を伴う今のテストの記述として5に直す（タスク8の No.12 と同じ値）。
    *   **No.7（＝No.37。227行「版を上げるとき」「現在は版4で`MIGRATIONS`に版1→版2・版2→版3・版3→版4があり」）**：今の値に直す（現在は版5、`MIGRATIONS`に版4→版5（`migrateVersion4To5`）も加わる。`js/io/DocumentSerializer.js`の`CURRENT_DOCUMENT_VERSION`・`MIGRATIONS`で確かめる）。
    *   **原則9**：直した範囲（10〜227行付近）の中で同じ「版4」「4のまま」の古い値が残っていないかを確かめる（195行付近の「書き出し形式の版4 2367」など件数の記録・205行付近の「書き換え」の記録・33行付近（「現行は版5…版4はPhase 10-02」と書き済み）は直さない）。230行付近より後はタスク13の範囲なので、見つけても作業レポートに書くだけにする。
    *   **行末**：CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク12: テストの題その2（C4、C6）
*   **計画** :
    *   **C4**（決まりはタスク10と同じ。期待値・入力・コードは変えない。数字だけを直す）：
        *   `test/io/SpriteSerializer.items.test.js` 139行付近「formatVersionが5で、sourceのキーが無く、作業データは版4で全部の図形を持つ」：145行付近で`work.version, 5` → 「作業データは版5で」。
        *   `test/edit/PathVertexEditor.items.test.js` 212行付近「…版は4のまま」：226行付近で`document.version, 5` → 5。
        *   `test/edit/PathSplitEditor.items.test.js` 209行付近「…版は4のまま」：214行付近で`document.version, 5` → 5。
        *   `test/io/DocumentSerializer.collapsed.test.js` 79行付近「…versionは4のまま」：81行付近で`data.version, 5` → 5。
    *   **C6**：同じ4ファイルの中で、題の版の数字と確かめている値が食い違う題がほかに無いかを確かめ、あれば同じように直して作業レポートに書く。入力として旧版のデータを作って読むテストの題は直さない。
    *   **確認**：`git diff`で、変わったのが`it`・`test`の第1引数の文字列だけであることを確かめる。`_doc/arch/16_test.md`がこれらの題を文字どおり引いている箇所があれば直さず作業レポートに書く（タスク13で扱う）。
    *   **行末**：4ファイルとも LF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク13: `_doc/arch/16_test.md` その2・`03_VectorModel.md` 26行（No.39・40・41・27・28・29、C1の追随）
*   **計画** :
    *   判断の決まり（今の値に直すか、時点を書き添えるか）はタスク11の冒頭と同じ。タスク11の作業レポートの判断・表現とそろえる。タスク12で直したテストの題と食い違わないこと。
    *   **No.39（240行 `DocumentSerializer.items.test.js`（26件）「版4の書き出し（キー順）…・版5以上は全体失敗」）**：`test/io/DocumentSerializer.items.test.js` 93・99行付近は版5の書き出し（`version` 5）、346〜348行付近は「版6以上は全体失敗」（`doc(6, [])`）。判断に従い直す（版の数字2か所）。
    *   **No.40（279行 `DocumentSerializer.collapsed.test.js`（新設・10件）「開いている絵は従来と同じJSON・版4のまま」）**：81行付近は`data.version, 5`。「新設」を伴う今のテストの記述として判断する。
    *   **No.41（303行 `SpriteSerializer.visibility.test.js`（12件）「版4・キーの並び」）**：115〜120行付近は「版は5」（`formatVersion` 5・`DocumentSerializer.serialize(items).version` 5）。判断に従い直す。
    *   **No.27（318行 12-01の項 `PathVertexEditor.items.test.js`（7件）「…作業データの往復と版4のまま」）**：226行付近は`document.version, 5`。判断に従い直す。
    *   **No.28（324行 12-02の項 `PathSplitEditor.items.test.js`（7件）「…作業データの往復と版4のまま」）**：214行付近は`document.version, 5`。判断に従い直す。
    *   **No.29（330行 12-03の項 `EndpointSnapper.vertexSnap.test.js`（31件）「`PROJECT_ARCHITECTURE.md`3章12.の最初の表の欄ごとに新しい照会（…）の結果の種類と…」）**：`PROJECT_ARCHITECTURE.md` 3章12.に表は無い。対応する記述は712行付近の項「**働く場面**（`EndpointSnapper`の新しい照会…）」。参照の書き方を直す（例：「`PROJECT_ARCHITECTURE.md`3章12.の『働く場面』の照会ごとに」）。直す前に3章12.の項の見出しの文言を `grep` で確かめる。
    *   **原則9**：直した範囲（240〜330行付近）の中で同じ古い値が残っていないかを確かめる（338行付近の「版4の作業データと版4のJSが今までどおり開ける」・339・340行付近の版4→5の記録は入力の版・書き換えの記録として正しいので直さない）。
    *   **C1の追随（`_doc/arch/03_VectorModel.md` 26行 `replaceShape`の項。発注者の決定 2026-11-28。REQ の原則4・7）**：C1（タスク9）で`addShapesWithNewIds`・`replaceShape`のJSDocを今の不変条件に直したため、次の2か所を、Phase 12-01／12-02の時点のJSDocの話であり今は（本作業で）今の不変条件に直したことが分かるように直す。直す前に、タスク9の作業レポートと`js/core/VectorModel.js`の両JSDocで C1 が直っていることを確かめる（直っていなければ直さず中断し「質問:」に書く）。
        *   「クラスのJSDocには『`select`が真のときは呼び出し側が選択モードであること』とだけ書かれているが、…（Phase 12-01。`VectorModel.js`のJSDocは変えていない）」：時点を書き添える。例：「…とだけ書かれていたが、…（Phase 12-01。JSDocはInterrupt `261128_1423`で直した）」。
        *   「`addShapesWithNewIds`のJSDocにも同じ古い前提の記述（呼び出し側が選択モードであること）があるが、…。`VectorModel.js`のJSDocは変えていない。」：同じ形で時点を書き添える（例：「…の記述があったが、…」とし、末尾の「`VectorModel.js`のJSDocは変えていない。」を「JSDocはInterrupt `261128_1423`で直した。」にする）。Interrupt での変更の書き方は資料の今の形（「Interrupt `261123_1213`で消した」等。`PROJECT_ARCHITECTURE.md` 372・758・823・835行付近）に合わせる（原則6）。
        *   長くしない（原則7）。2か所の書き添えの表現をそろえる。同じ項の前の文「`select`が真のとき選択モードまたは頂点の選択モードであることは呼び出し側の保証…」、17行の不変条件、タスク2で直した`03`の記述（2・3・19・22行付近）、C1で直した後のJSDocの文言と矛盾させない。
    *   **行末**：`16_test.md`・`03_VectorModel.md`とも CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク14: `js/`のコメント・JSDocその2（C5、C6）
*   **計画** :
    *   **C5**：「選んでいる図形全体の…外枠」を、実際の対象（選択中の変えられる図形。`js/edit/ShapeExtentReader.js`の`getSelectedGeometryBounds`は`model.getEditableSelectedShapes()`の外枠）に合わせる。
        *   `js/main.js` 193行付近のコメント「外枠のハンドルの照会（実体はshapeExtentReader.getSelectedGeometryBounds()。選んでいる図形全体の線を含まない外枠か、選択なしでnull）」。
        *   `js/main.js` 221〜222行付近のJSDoc「選んでいる図形全体の外枠とそのハンドルは、…」。
        *   `js/core/InputTracker.js` 157〜159行付近 `getSelectionFrameBounds`のJSDoc「選んでいる図形全体の外枠（線の太さを含まない。外枠のハンドルの元）の照会。選択なしは`null`。…」。
        *   `js/core/ScaleHandleRules.js` 125行付近 `@param … bounds 選んでいる図形全体の線を含まない外枠`。
        *   例：「選択中の変えられる図形の（線を含まない）外枠」。同じ文の「選択なしでnull」「選択なしは`null`」は、変えられる図形の選択が無いときに`null`になる事実に合わせて「変えられる選択なし」等に直してよい（C6として作業レポートに書く）。
    *   **C6**：3ファイルの中に同じ古い説明（「選んでいる図形全体の…外枠」等）が別の言い方で残っていないかを確かめ（`grep -n '図形全体' js/main.js js/core/InputTracker.js js/core/ScaleHandleRules.js` 等）、あれば同じように直して作業レポートに書く。別のファイル（`_doc/arch/`・`PROJECT_ARCHITECTURE.md`を含む）で見つけたものは直さず懸念事項へ送る。
    *   **確認**：`git diff -- js/main.js js/core/InputTracker.js js/core/ScaleHandleRules.js` を読み、変わったのがコメント・JSDocの行だけであることを確かめる。
    *   **行末**：`main.js`・`InputTracker.js`＝CRLF、`ScaleHandleRules.js`＝LF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク15: `PROJECT_ARCHITECTURE.md` 3章29.・30.・`_doc/arch/14_edit.md`（C1の追随の残り3か所。発注者の決定）
*   **計画** :
    *   **位置づけ**：C1（タスク9）で`addShapesWithNewIds`・`replaceShape`のJSDocを今の不変条件に直したため、`_doc/arch/03_VectorModel.md` 26行（タスク13）と同じ「JSDocは古い」「`VectorModel.js`は変えない」という記述の残り3か所に時点を書き添える。REQ の要件には無いが、発注者の決定（2026-11-28）により対象に加えた（REQ の原則4・7）。`PROJECT_ARCHITECTURE.md`の2か所は REQ 102行「要件1が挙げていない文は変えない」の、発注者の決定による例外。この3か所のほかは変えない。
    *   直す前に、タスク9の作業レポートと`js/core/VectorModel.js`の両JSDocで C1 が直っていることを確かめる（直っていなければ直さず中断し「質問:」に書く）。タスク13の作業レポートを読み、`03_VectorModel.md`に書き添えた表現とそろえる。
    *   **3章29.(i)（`PROJECT_ARCHITECTURE.md` 1041行付近）「`VectorModel.replaceShape`のJSDocの「`select`が真のときは呼び出し側が選択モードであること」は古い（…）。`VectorModel.js`は変えず、`_doc/arch/03_VectorModel.md`に正しい記述を残す。」**：Phase 12-01の時点の話であり、JSDocは本作業で直したことが分かるようにする。例：「…は古かった（…）。Phase 12-01では`VectorModel.js`を変えず、`_doc/arch/03_VectorModel.md`に正しい記述を残した（JSDocはInterrupt `261128_1423`で直した）。」
    *   **3章30.(g)（`PROJECT_ARCHITECTURE.md` 1051行付近）「`VectorModel`の`replaceShape`・`addShapesWithNewIds`のJSDocの「呼び出し側が選択モードであること」は古い（…29.の(i)と同じ）。`VectorModel.js`は変えず、`_doc/arch/03_VectorModel.md`に正しい記述を残した。」**：同じ形で時点を書き添える。例：「…は古かった（…）。Phase 12-02では`VectorModel.js`を変えず、…正しい記述を残した（JSDocはInterrupt `261128_1423`で直した）。」
    *   **`14_edit.md` 114行付近（`PathSplitEditor.js`の「契約」の括弧）「`replaceShape`・`addShapesWithNewIds`のJSDocの「呼び出し側が選択モードであること」は選択集合の不変条件より狭い古い記述で、頂点の選択から呼んでも不変条件は崩れない。」**：今の JSDoc の話と取り違えないよう時点を書き添える。例：「…は選択集合の不変条件より狭い古い記述だった（Interrupt `261128_1423`で直した）。頂点の選択から呼んでも不変条件は崩れない。」
    *   **書き添えの表現**：3か所とタスク13の`03_VectorModel.md`の2か所で、Interrupt での変更の書き方を資料の今の形「Interrupt `261128_1423`で直した」（「Interrupt `261123_1213`で消した」等。`PROJECT_ARCHITECTURE.md` 372・758・823・835行付近）にそろえる（原則6）。長くしない（原則7）。
    *   **矛盾の確認**：3章29.・30.はタスク7（A1の「（当時の4のまま。今は5）」、A2の「変えないもの：」の時点の書き添え、A3）でも直しているので、タスク7の作業レポートを読み、そこで直した記述と矛盾させない（特に A2 で「`VectorModel`」を変えなかった範囲として書いた時点と、(i)・(g)の時点を同じにする）。`14_edit.md`はタスク8（No.10・12・18・19）でも直しているので、そこで直した記述と矛盾させない。タスク7・8で直した文は変えない。直した記述が`03_VectorModel.md` 26行（タスク13）・C1で直した後のJSDocの文言と食い違わないことも確かめる。
    *   **原則9**：`PROJECT_ARCHITECTURE.md`・`14_edit.md`の中に同じ「JSDocは古い」「`VectorModel.js`は変えず」の記述がほかに無いかを `grep` で確かめる（例：`LC_ALL=C.UTF-8 grep -n -o -P '.{0,100}選択モードであること.{0,100}' <ファイル>`）。見つけても、発注者の決定はこの3か所に限るため直さず、作業レポートに「懸念事項へ送る」と書く。
    *   **行末**：2ファイルとも CRLF。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク16: 確認（要件6）
*   **計画** :
    *   プロジェクトのルートで`node --test`を実行し、全件成功で件数が作業前と同じ（tests 4199）であることを確かめ、`tests`・`pass`・`fail`の行を作業レポートに写す。
    *   `git diff --stat`で、変わったファイルが次の26ファイルの中だけ（本RESを除く）であることを確かめる：`PROJECT_ARCHITECTURE.md`、`_doc/arch/02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`12_shapes.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`17_sprite_check.md`・`32_InputModes.md`・`40_asset_sprite.md`・`61_ItemRowRules.md`・`69_CompoundPathRules.md`、`js/core/VectorModel.js`・`js/core/KeyboardShortcuts.js`・`js/io/SpriteSerializer.js`・`js/io/DrawElementReader.js`・`js/main.js`・`js/core/InputTracker.js`・`js/core/ScaleHandleRules.js`、`test/io/DocumentSerializer.roundtrip.test.js`・`test/io/FileContentReader.test.js`・`test/io/SpriteSerializer.items.test.js`・`test/edit/PathVertexEditor.items.test.js`・`test/edit/PathSplitEditor.items.test.js`・`test/io/DocumentSerializer.collapsed.test.js`（タスク15で触る`PROJECT_ARCHITECTURE.md`・`_doc/arch/14_edit.md`もこの中にある。`git status`で本RESのほかに新しいファイルが無いことも確かめる）。
    *   `git diff -- js test`を全部読み、差分がコメント・JSDoc・テストの題（`describe`・`it`・`test`の第1引数）の文字列と、C7の空行1行、C3の行の入れ替えだけであることを確かめる。
    *   触ったすべてのファイルの行末を共通の決まり4のコマンドで測り、CRLFのファイルは CR＝LF、LFのファイルは CR＝0 であることを確かめる（REQ原則5の一覧と照合）。`git diff --stat`の行数が、行全体の書き換え（行末の変換）を疑わせる大きさでないことも見る。
    *   失敗・食い違いがあれば直さず、作業レポートに書いて中断する（「質問:」）。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

### タスク17: 懸念事項・要確認ポイントの記述
*   **計画** :
    *   本RESの「4. 詳細作業内容」のタスク1〜16の作業レポートを読み、「5. 懸念事項・要確認ポイント」へ次を書く（計画時に書いた項目は残し、必要なら追記・更新する）。
        *   判断に迷った点。特に原則3の「今の値に直す」と「時点を書き添える」の振り分け（タスク11・13の項ごとの判断の一覧、タスク3・5・7の原則9の振り分け）。
        *   A の項の決まり（共通の決まり7）で直さなかった同じ言い回しの箇所（A6の838・1045行付近、A8の`segmentKindsOf`、A14のほかの「変更なし」等）。
        *   別のファイルで見つけた同じ誤り（原則9・C6で直さなかったもの）。C1の追随（タスク13・15）で見つけたが直さなかった同じ記述。
        *   資料の別の箇所との整合で気づいた点。
    *   資料・コードは変えない。
*   **作業内容（レポート）** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
* （計画時の気づき。タスク17で追記・更新する）
* **決定済み（タスク9の前の要確認）**：C1で`js/core/VectorModel.js`の`addShapesWithNewIds`・`replaceShape`のJSDocを今の不変条件に直すと、`_doc/arch/03_VectorModel.md` 26行の「クラスのJSDocには『`select`が真のときは呼び出し側が選択モードであること』とだけ書かれているが…（Phase 12-01。`VectorModel.js`のJSDocは変えていない）」「`addShapesWithNewIds`のJSDocにも同じ古い前提…（`VectorModel.js`のJSDocは変えていない）」が今のJSDocと食い違う。発注者の決定（2026-11-28）により、REQ の原則4・7に従って時点を書き添える。C1の後に直すため、タスク2とは別にタスク13で扱う。
* **決定済み（C1の追随の残り3か所）**：同じ「JSDocは古い」「`VectorModel.js`は変えない」という記述が`PROJECT_ARCHITECTURE.md` 3章29.(i)（1041行付近）・30.(g)（1051行付近）・`_doc/arch/14_edit.md` 114行付近にもあり、C1の後は今のJSDocと食い違う。REQ の要件には無いが、発注者の決定（2026-11-28）により、03:26と同じく時点を書き添える（REQ の原則4・7）。`PROJECT_ARCHITECTURE.md`の2か所は REQ 102行「要件1が挙げていない文は変えない」の、発注者の決定による例外。タスク13に入れると資料の箇所の目安（10か所）を超えるため、C1の後のタスク15で扱う。書き添えの表現は「Interrupt `261128_1423`で直した」の形（資料の今の書き方）にそろえる。
* `PROJECT_ARCHITECTURE.md` 358行付近の「（`io/`は`core/`をimportできるが`edit/`はimportできず、…）」は、主語を`io/`として「`io/`は`edit/`をimportできない」と読むのが依存方向と合うが、「`edit/`は（`core/`を）importできない」とも読める。Survey 5章（No.43）は後者と推測している。本REQの要件に無いため直さない。No.43（`69_CompoundPathRules.md`）は前者の読みで直す計画（タスク2）。
* `_doc/arch/69_CompoundPathRules.md` 13行の「描画（`main.js`→`CanvasManager`）・当たり判定・スタイル（`edit/`）・書き出しの4か所が使う」は No.15（`PROJECT_ARCHITECTURE.md` 358行付近）と同じ誤りだが、別のファイルのため原則9により直さない。No.15を直した後、`PROJECT_ARCHITECTURE.md`と69の使う側の記述が食い違う。
* `_doc/arch/03_VectorModel.md` 22行の「後の3つは`resolveNudgeTarget`の引数に渡す」は、Survey が挙げていないが`PathCornerEditor`については今は誤り（`collectVertexTargets`へ渡す）。No.4 と同じ文なので一緒に直す計画（タスク2）。
* `test/io/SpriteSerializer.test.js` 1011行付近の`describe`の題「版4（Phase 10-02）」は Phase 名を含む題で、C4の対象ファイルでもないため直さない。
