# 作業指示書 REQ: Interrupt : Phase 8 クローズの開発資料の直し（残り5件・いずれも1行）
* ルール: `./PROJECT_CONSTITUTION.md`
* 参考資料: `./_log/res/261118_1044_RES_Interrupt_Phase08_Close_Doc_Fix.md`（5章『懸念事項・要確認ポイント』に、本作業で直す5件の根拠がある）

## 【作業手順（厳守事項）】
本プロンプトは、Phase 8 クローズの開発資料の相違の修正（RES `261118_1044`）で「直さずに申し送る」と判断された5件を直すInterruptである。**修正対象は開発資料（`_doc/arch/` の6ファイル）だけで、ソースコード・テスト・`index.html` は1文字も変更しない。** 必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本REQの【関連する責務】を把握すること。作業に必要な情報はすべてここに記載されている。開発資料（`PROJECT_ARCHITECTURE.md`）は、記載外の内容を確認する必要が生じた場合にのみ参照すること。
3. 修正対象の資料の該当行と、根拠となる実コードの箇所を読み、**本REQの【実装要件】に書かれた実コードの事実と実コードが矛盾する**場合は、修正に着手せず、相違点を報告して指示を待つこと。記述にない事項の存在は相違とみなさない。
4. 相違がなければ、【実装要件】に従って資料の修正を実行すること。
5. 修正が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポート（`./_log/res/YYMMDD_HHMM_RES_Interrupt_Phase08_Close_Doc_Fix2.md`）を新規作成して出力すること。
   * テンプレートの項目に従い、「原因と修正方針」「対象ファイル」「詳細作業内容」を正確に記述すること。**5件それぞれについて、直す前と直した後の記述を書くこと。**
6. 本作業は開発資料の修正そのものが目的である。したがって、テンプレートの「開発資料は修正せず『更新予定』欄に書く」という定めは本作業には適用しない。資料を直接修正すること。
7. すべての作業が完了したら、チャットにて「実装が完了しました」と報告すること。**テストプレイ・ブラウザでの確認は不要**（画面のふるまいが変わらないため）。

## 【背景】
Phase 8 クローズの整合確認（Survey）で見つかった相違64件のうち58件を、直前のInterrupt（RES `261118_1044`）で直した。その作業中に、Surveyの一覧の外側で気づいた点が5件あり、いずれも「直すべきだが当時のREQの変更対象の外」だったため申し送られた。発注者の決定（2026-11-18）により、この5件を直す。

## 【実装要件】
共通の約束：
* **1件＝1行の書き換え**で済ませる。行を増やさない。文が伸びるときは同じ行の冗長な表現を削って差し引きを取る。
* 対象の行以外は1文字も変えない（整形・字句の統一・無関係な記述の削除をしない）。
* **ファイルごとの行末（CRLF／LF）を保つ**。`_doc/arch/` は行末がファイルごとに違う（本作業の対象では `01`・`03`・`16` がCRLF、`24`・`32`・`33` がLF。書き換える前に自分で実測して確かめること）。一括処理で全行を差分にしてはならない。
* 既存の表記（バッククォートの付け方、箇条の形、言い回しの調子）にそろえる。

### 要件1: `_doc/arch/24_CanvasCursorTracker.md` 3行目（`Ctrl`の読み取りの「唯一の定義」）
* 現在の記述：注入の `readCtrlModifier` の実体の説明に「`InputTracker.js`の`hasCtrlModifier`（`Ctrl`（`⌘`を含む）の**読み取りの唯一の定義**。二重に書かない）」とある。
* 実コードの事実：`Ctrl`（`⌘`を含む）を読むコード行は `js/core/InputTracker.js:138`（`hasCtrlModifier`）・`js/core/KeyboardShortcuts.js:295`（`#findBinding` の `event.ctrlKey || event.metaKey`）・`js/core/AltKeyGuard.js:31`（`event.ctrlKey` のみ）の3か所で、「唯一の定義」ではない。`hasCtrlModifier` のJSDoc（`js/core/InputTracker.js:129-135`）は対象を**マウスイベント**とする。
* 直し方：「唯一の定義」を外し、**マウスのイベントの読み取りは `hasCtrlModifier` に寄せて二重に書かない**という約束の形に直す。キーボードの `Ctrl` は `KeyboardShortcuts` が別に読むことを1句で添える。
* **言い回しは `PROJECT_ARCHITECTURE.md` 528行および `_doc/arch/06_InputTracker.md` 27行にそろえること**（直前のInterruptでこの2か所を同じ内容に直してある。3か所目が本件）。両方を読んでから書くこと。

### 要件2: `_doc/arch/01_index_html.md` 1行目（何を正本とするか）
* 現在の記述：「配置・見た目はマークアップと**CSSコメント**を正とする。」
* 食い違い：同じファイルの12行目に、直前のInterruptで「ツールパレットの縦の範囲は実測で `y 68〜約446`。`index.html` のCSSコメント（222〜226行）に残る古い値（本体約301px・約410）は古い」と書いた。1行目を読むとCSSコメントが正本に見え、12行目と矛盾して読める。
* 直し方：1行目の正本を**マークアップとCSSの宣言**とし、**CSSコメントの中の見積もりの数値は正本でない**（古いことがある）旨に直す。12行目は変えない。

### 要件3: `_doc/arch/03_VectorModel.md` 4行目（頂点の選択の呼び出し元）
* 現在の記述：行の末尾が「呼び出し元は`InputTracker`のみ（設定・解除）と、`getSelectedVertices`を読む`main.js`（`renderCurrentState`）・`edit/NudgeEditor`・`edit/PositionInputEditor`（後の2つは`resolveNudgeTarget`の引数に渡す）。」となっている。
* 実コードの事実：`InputTracker` 自身も `getSelectedVertices()` を読む（`js/core/InputTracker.js:575・929・1099・1339`）。現在の文は、`InputTracker` を「設定・解除」の側だけに置いており、読む側であることを表していない。
* 直し方：`InputTracker` が**設定・解除と読み取りの両方**を行うことが分かる形に直す。ほかの読む側（`main.js`・`edit/NudgeEditor`・`edit/PositionInputEditor`）の記述は変えない。

### 要件4: `_doc/arch/32_InputModes.md` 6行目・`_doc/arch/33_FocusKeyYieldRules.md` 6行目（切り出しの経緯の「値の分」）
* 現在の記述：`32:6` は「`KeyboardShortcuts`が値と判定の関数の両方のために`InputTracker.js`をimportしていたうち、**値の分をなくすため**（判定の関数の分は`core/FocusKeyYieldRules`）」、`33:6` は「`KeyboardShortcuts`が値と判定の関数の両方のために`InputTracker.js`をimportしていた（**値の分は`core/InputModes`**）」。
* 実コードの事実：当時 `KeyboardShortcuts` が `InputTracker.js` から import していた値は `OperationMode` と `SHAPE_TYPES` の2つで、**`SHAPE_TYPES` は `core/InputModes` へは行かず、正本の `ShapeFactory.js` から直接 import する形になった**（現在の `js/core/KeyboardShortcuts.js:8` が `import { SHAPE_TYPES } from './ShapeFactory.js';`）。現在の両行は「値の分は`core/InputModes`」としか書いておらず、`SHAPE_TYPES` の行き先が分からない。
* 直し方：両行の「値の分」の説明に、**`SHAPE_TYPES` は `ShapeFactory.js` から直接 import する形になった**ことを1句足す。`32:6` と `33:6` は対になる記述なので、**2か所の言い回しをそろえること**。
* 同じ内容が `_doc/arch/02_main.md` 69行目（「`SHAPE_TYPES`は正本の`ShapeFactory.js`から直接importする。」）にもある。`02_main.md` は変更しない。

### 要件5: `_doc/arch/16_test.md` 2行目（確認したNode.jsの版）
* 現在の記述：「確認したNode.jsの版はv24.20.0。」
* 事実：本作業の環境で `node -v` を実行すると別の版が返り、その版で `node --test` は全件成功する（tests 1543 / suites 230 / fail 0）。
* 直し方：**`node -v` と `node --test` を自分で実行して実測し**、「確認したNode.jsの版」をその実測値に直す。過去の版の履歴は書かない（版の履歴は `_log/res/` と git が正本）。同じ行のほかの記述（`package.json`を作らない方針、結果の見方）は変えない。

### 要件6: 確認
* 変更した6ファイルについて、**変更行が要件1〜5で指定した行だけであること**と、**行の増減が無いこと**を `git diff` で確かめ、結果を作業レポートに記す。
* 変更した6ファイルの**行末が変わっていないこと**を実測で確かめ、結果を作業レポートに記す。
* プロジェクトのルートで `node --test` を実行し、**tests 1543 / suites 230 / fail 0** であることを確かめ、件数を作業レポートに記す（ソースを変更しないため件数は変わらない）。
* ソースコード・テスト・`index.html` に差分が無いことを `git status`・`git diff --name-only` で確かめる。

## 【関連する責務】
* `core/InputTracker.js` の `hasCtrlModifier`：`export` される関数で、**マウスイベント**の `Ctrl`（`⌘`を含む）を `event.ctrlKey || event.metaKey` で読む。呼ぶのは `InputTracker.js` 内と `main.js` の `CanvasCursorTracker` への注入だけ。`core/KeyboardShortcuts.js` の `#findBinding` は同じ式を別に持ち、`core/AltKeyGuard.js` は `event.ctrlKey` だけを `Alt` の抑止を除く条件に読む。
* `core/CanvasCursorTracker.js`：キャンバス上のカーソル位置の保持と変更通知。注入の `getScreenPoint`・`screenToWorld` は関数でなければ `Error`。省略可の `readCtrlModifier` は、省略時は常に偽、指定されていて関数でなければ `Error`。
* `core/VectorModel.js` の頂点の選択：非公開の `#selectedVertices` を持ち、公開は `setSelectedVertices`・`clearSelectedVertices`・`getSelectedVertices`・`isVertexSelected` の4つ。設定・解除を呼ぶのは `core/InputTracker` のみ。`getSelectedVertices()` を読むのは `core/InputTracker`・`main.js`・`edit/NudgeEditor`・`edit/PositionInputEditor`。
* `core/InputModes.js`：入力の状態（`InputState`）と操作モード（`OperationMode`）の値の定義。状態なし・importなし。
* `core/FocusKeyYieldRules.js`：フォーカスしている要素がキー入力を受け取るかの判定。状態なし。
* `core/ShapeFactory.js`：図形種別の定数 `SHAPE_TYPES` の正本と、図形の生成。
* `index.html`：スタイルはCSSファイルに分割せず `<style>` タグに内包する。本作業では**変更しない**。
* `test/`：自動テストは `node:test`・`node:assert/strict` のみで書き、プロジェクトのルートの `node --test` で実行する。本作業では**変更しない**。

## 【絶対遵守ルール (Constraints)】
* **ソースを変更しない**：`js/`・`test/`・`index.html`・`asset/` に差分を出してはならない。本作業で変更できるのは `_doc/arch/01_index_html.md`・`03_VectorModel.md`・`16_test.md`・`24_CanvasCursorTracker.md`・`32_InputModes.md`・`33_FocusKeyYieldRules.md` の6ファイルと、本作業の作業レポートだけである。
* **`PROJECT_ARCHITECTURE.md` を変更しない**：要件1は `PROJECT_ARCHITECTURE.md` 528行を**読んで言い回しをそろえる**だけで、同ファイルは変更しない。同ファイルは別工程（現場設計セッションのスリムアップ）で扱う。
* **`_doc/` のほかのファイルを変更しない**：`COWORK_STATUS.md`・`COWORK_STATUS_CLOSED.md`・`PROJECT_MILESTONE.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_PHASE_TRANSITION_CLEANUP.md`、および要件で挙げていない `_doc/arch/` のファイル（`02_main.md`・`06_InputTracker.md` を含む）。
* **資料を長くしない**：1件＝1行の書き換えに収め、行を増やさない。
* **コードを資料に合わせて直さない**：方向は常に「資料の記述を実コードに合わせる」である。
* 外部フレームワークを導入しない Vanilla JS の原則、ビルドツールを使わない原則を維持すること。
