# RES: 調査計画・調査レポート Survey : Phase 11 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261126_0015_REQ_Survey_Phase11_Doc_Consistency.md`

## 1. 調査目的
Phase 11「図形の一覧」（サブフェイズ11-01〜11-06b）の期間に書き換えられた開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）の記述が、現在の `HEAD` の実コードの事実と食い違っていないかを確かめる。各作業の反映時点ではその作業の差分監査に合格しているため、特に **後の作業のコード変更によって、前の作業で書いた記述が古くなっていないか** を重点的に見る。
重点の例：
* 11-01で書いた「表示・ロックは値を持つだけで効かせない」「画面からフォルダは作れない」が、11-04a・11-05の後も残っていないか。
* 11-03で書いた描き込む先（図形だけ）・並べ替えの規則が、フォルダを扱う11-04a・11-04bの後も成り立つか。
* 11-02・11-03で書いた「フォルダを含む絵」の扱いが11-04bの後も成り立つか。
* 11-05で書いた`source`（隠した図形も含む全部）が11-06aの後も成り立つか。

**本Surveyのどのタスクでも、ソースコードおよび資料ファイルの修正・作成を行ってはならない（書き換えてよいのは本RESファイルだけ）。**

## 2. 調査要件
### 要件1: 差分で追加・変更された記述の照合
* 対象の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。**1行の中の一部だけが変わった行（`-` 行と `+` 行の対になる長い行）では、`-` 行にそのまま同じ文がある文は照合しなくてよい**（前のPhaseのクローズで照合済み。要件2の検索で拾う）。新しく足された文・書き換えられた文だけを照合する。
* 照合するのは次のような、コードで真偽を確かめられる主張である：
  * ファイル・フォルダの存在と配置（1章のフォルダ構成図。新設された`js/`・`test/`のファイルと、消えた`js/palette/OptionBarOrderGroup.js`・`test/core/VectorModel.reorderShapes.test.js`を含む。「存在しないもの」として書かれたものが実際に無いことを含む）
  * importの有無・向き（1章「依存方向」とその例外、`_doc/arch/` 各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの。`io → core` の規則のimport（`ItemTreeRules`・`ItemStateRules`等）と、`wiring/`・`edit/`・`palette/` の新しいファイルの向きを含む）
  * 公開メソッド・公開の関数・定数・typedef・列挙の一覧と値・引数・戻り値（新設の`core/`の規則（`ItemTreeRules`・`ItemAttributeRules`・`ItemListRules`・`ItemRowRules`・`ItemPlaceRules`・`ItemStateRules`・`GroupTreeRules`・`GroupSelectionRules`・`GroupCollapseRules`・`GroupCommandRules`・`InsertTargetRules`・`ListDragRules`・`ListScrollRules`・`ListSelectionRules`・`RemovalRules`・`SoloVisibilityRules`・`ThumbnailRules`）、`ThumbnailRenderer`、`edit/`の`GroupEditor`・`ItemRenameEditor`・`ItemStateEditor`、`palette/ItemListPanel`、`wiring/ItemListWiring`・`ItemListRowDrag`、`io/DrawElementReader`と、変わった`VectorModel`・`ShapeOrderEditor`・`ShapeInserter`・`ClipboardController`・`SnapshotAdapter`・`DocumentSerializer`・`FileContentReader`・`SpriteSerializer`等の公開物）
  * 共通メソッド契約の数（18）と一覧・順番
  * アイテム・作業データ・書き出し形式の形（図形・フォルダのアイテムの形、作業データの版4と`migrateVersion3To4`、要素のキー順、`collapsed`、`name`・`visible`・`locked`の補い、書き出し形式の版4（`source`・描画要素の`id`なし）、`elements`・`bounds`に入る図形、`source`入りのJSと`elements`から組み立てるJSの読み方、読み飛ばしの記録`index`・`path`）
  * 状態の持ち主・初期値・通知（描き込む先、選んでいるフォルダ、折りたたみ、目の`Alt`＋クリックの覚え、一覧の編集中・ドラッグ中の状態、保存しない・履歴に入れないと書かれたもの、`onChange`の購読先）
  * 既定値・条件（一覧の操作を受け付ける条件、行のドラッグの始まる条件・取りやめの条件、入る場所の決め方、自動の名前、自動で開く条件、変えられる図形・見えている図形の判定、押せる条件、受理の規則、`Shift`・`Alt`・`Ctrl`・`Esc`の扱い、字下げの上限、行の高さ・サムネイルの大きさ）
  * 呼び出し元・呼び出し順・記録の時点（3章の流れ・履歴の単位・まとめの鍵・中断したときの戻し）
  * `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先・行数）
  * `InputTracker` の記述（`_doc/arch/06_InputTracker.md`。行数、公開メソッド、入力の補助、修飾キーの項）
  * `KeyboardShortcuts` のキーの対応表（`_doc/arch/07_KeyboardShortcuts.md`。`group`・`ungroup` を含む。対応表の中の位置の記述も照らす）
  * 数値（行数：`main.js`・`InputTracker.js`・`VectorModel.js` 等、資料に書かれた行数すべて。過去の時点の値として書かれたものは現在の値と区別し、`git show <コミット>:<パス>` で確かめられる範囲で確かめる）。行数は `wc -l` 等で実測し、資料の値と並べて記載する。
  * `index.html` の要素・属性・クラス・CSS変数・幅の見積もりのコメント（`_doc/arch/01_index_html.md`。右端の一覧のパネル、`--canvas-area-width`、2行のツールバーのまとまりの一覧と、重なり順のまとまりが無いこと）
  * 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在と数、テストの内容の記述が実際のテストケースと合っているか、テストの件数、「テストできない箇所」の一覧、書き方の決まりの例外）。テストの件数は、プロジェクトのルートで `node --test` を実行して確かめてよい（ファイルを書き換えない実行に限る）。
* 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲だけを照合し、方針そのものの是非は扱わない。
* 実際のブラウザでの見え方・実測値・テストプレイの結果についての記述は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。
* 本リポジトリの外についての記述（OZ Engineなど）は「照合できなかった主張」とする。エンジンのリポジトリのファイルは読まない・変更しない。

### 要件2: Phase 11 で変わった・広がった・なくなったものが、資料に古い形のまま残っていないか
次の変化が、資料に「今もそうである」と読める形で残っていないかを確かめる。
* **図形の並びの持ち方**：平らな図形の配列 → 入れ子のアイテム（11-01）。「`#shapes`は図形の配列」「`model.getShapes()`を直列化する」「図形の並びそのものを履歴・保存する」「一覧は無い」「図形に名前は無い」と読める記述。
* **版**：作業データの版3 → 4（11-01）。「現行は版3」「`version`は2」「版3まで」「版1〜3を受理」と読める記述（`_doc/arch/16_test.md` の古い項を含む）。
* **重なり順**：オプションバーの重なり順のボタン（`palette/OptionBarOrderGroup`）→ 一覧のドラッグと`PageUp`等のキー（11-03）。「`OptionBarOrderGroup`」「⏫🔼🔽⏬」「`syncOptionBarOrderGroup`」「オプションバーの1行目に重なり順」と読める記述（`_doc/arch/01_index_html.md` を含む）。
* **新しく入る場所**：いつも最前面（末尾）→ 描き込む先のすぐ上・フォルダの中（11-03・11-04b）。「新しい図形は末尾に足す」「貼り付け・複製は最前面」「描き込む先は図形だけ」「すぐ上へ入り、無ければ末尾」と読める記述。
* **フォルダ**：データにだけある → 画面で作る・解除する・出し入れする・コピーする（11-04a・11-04b）。「画面からフォルダは作れない」「フォルダを含む絵では行のドラッグが始まらない」「コピーはフォルダを含まない」「インポートは最前面へ足す」「`hasGroupItem`」と読める記述。
* **表示・ロック**：値を持つだけ → 効く（11-05）。「表示・ロックは効かせない」「`Ctrl`+`A`は全図形」「当たり判定は全図形」「書き出しは全図形」「目・鍵のアイコンは押せない」と読める記述。
* **書き出し**：`source`・描画要素の`id`あり → なし（11-06a）。「`source`のある書き出し」「`source`が無いJSは読み込み不可」「`elements`から図形を作り直さない」「描画要素の共通のキーは`kind`・`id`・…」「`SpriteSerializer`は`DocumentSerializer`をimportする」「エンジンへの連絡は11-06bで行う」と読める記述。
* **消えた・変わった関数・メソッド**：`VectorModel.reorderShapes`・`ShapeOrderEditor.applyOrder`・`ListDragRules`の旧関数・`insertItemsAbove`・`hasGroupItem`、製品コードから呼ばれなくなった`VectorModel.deleteShapes`・`getInsertTargetId`（「呼び出し元は〜」と書かれていないか）。
* **行数**：計画時の実測（`wc -l`）は `js/core/InputTracker.js` 2023行・`js/main.js` 1234行・`js/core/VectorModel.js` 1462行。
* **数え方**：`_doc/arch/16_test.md` の「例外は12ファイル」などの数（現在の実数と、後の項の言い方が矛盾していないか）。

洗い出しは `git diff --name-status ff8718e HEAD -- js index.html test asset sprite-check.html` と、`git diff ff8718e 2b162c9 -- PROJECT_ARCHITECTURE.md _doc/arch` の `-` 行で行い、**現在の実コードの事実**を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）を検索する。差分のない行については名前・語の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。「Phase 10 では」「Phase 11-01 の時点では」「当時の値」のように経緯・過去の状態として正しく書かれているものは相違としない。

### 要件3: 照合の結果の整理
* 相違が見つかった記述は、5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で記載する（タスク番号を添える）。
* 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものは、4章の各タスクの「推測・所見」に記載する（5章には入れない）。
* 照合した主張と結果を、資料のファイル（節）ごとに4章の各タスクの欄へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、その理由を書く）。
* 調査の中で、コードのコメント・JSDoc・テストの題に古い説明を見つけた場合は、5章ではなく4章の「推測・所見」に「コードのコメント」と付けて書く（探しに行く必要はない）。
* 資料に書かれていない事項がコードに存在することは相違とみなさない。
* **既知の傷**（担当のタスクで確かめる。資料側の1・2は実際に食い違っていれば5章へ**必ず**挙げる。3〜6はコード側で、今も残っているかだけを4章の「推測・所見」に書く。1は差分の行以外にあるものを含む）：
  1. `_doc/arch/16_test.md` の以前のPhaseの項に残る古い記述（`DocumentSerializer.roundtrip.test.js` の「`version`は2」、`CanvasFileOperations` の項など） → 担当：タスク15
  2. `PROJECT_ARCHITECTURE.md` 3章と `_doc/arch/06_InputTracker.md`・`14_edit.md`・`16_test.md`（長い一文の中に古い記述が残る可能性があるとされる） → 担当：これらの行を対象に持つ各タスク（下の『参照する責務』3の手順）。差分のない行はタスク17・18の検索で拾う
  3. `js/core/InputTracker.js` のJSDocの、描き込む先の古い説明（すぐ上へ入り、無ければ末尾） → 担当：タスク7
  4. `js/core/ItemListRules.js` の `resolveRowHover` の `@param id` が「図形id」のまま → 担当：タスク11
  5. `js/shapes/EndpointSnapRules.js`・`js/shapes/PathJoinRules.js` のJSDocの「`model.getShapes()`の並び」 → 担当：タスク8
  6. `test/core/ItemPlaceRules.test.js` の `describe` 名の `insertItemsAbove`、`test/edit/ShapeInserter.insertTarget.test.js` の `assert.ok(inserter)` → 担当：タスク16

### 参照する責務
本Surveyでは開発資料の原文そのものが照合の対象であるため、資料の記述は書き写さない（写し誤りを避けるため）。代わりに、各タスク実行チャットは次の手順に従う。

**1. 読んでよい資料**：自分のタスクの「対象ファイル」に書かれた資料のファイル・節（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）を読んでよい（タスク17・18は `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイルを検索し、見つかった箇所を読んでよい）。`_doc/` の他のファイル（`COWORK_STATUS.md`等）・`_log/dir/`・本リポジトリの外のファイルは読まない。記述の経緯を確かめる必要が生じた場合に限り、次のPhase 11の各サブフェイズのRESの該当箇所だけを読んでよい（全文は読まない）：`./_log/res/261124_1415_RES_Phase11-01_List_Data_Base.md`・`./_log/res/261124_1815_RES_Phase11-02_List_View_And_Selection.md`・`./_log/res/261124_2115_RES_Phase11-03_Reorder_And_Insert_Target.md`・`./_log/res/261124_2330_RES_Phase11-04a_Folder_Basics.md`・`./_log/res/261125_1445_RES_Phase11-04b_Folder_Drag_Target_Copy.md`・`./_log/res/261125_1916_RES_Phase11-05_Visibility_And_Lock.md`・`./_log/res/261125_2112_RES_Phase11-06a_Export_Without_Source.md`・`./_log/res/261125_2339_RES_Phase11-06b_Engine_Notice.md`。

**2. 照合の対象の取得方法**：
* 対象の差分は `git diff ff8718e 2b162c9 -- PROJECT_ARCHITECTURE.md _doc/arch`（47ファイル・`+` 行871行。計画時に確認済み）。`2b162c9` より後に開発資料の変更はないため、`+` 行の行番号は現在のファイルの行番号と同じである。生の差分は `git diff -U0 ff8718e 2b162c9 -- <ファイル>`（ハンクの見出しの `+開始行` が現在の行番号）。
* 各タスクの「対象ファイル」に書かれた「ファイル」と「現在のファイルでの行の範囲」に入る `+` 行だけを、そのタスクが照合する（範囲の中の差分のない行は、文脈として読んでよいが要件1の対象外）。範囲が「全行」のファイルは、そのファイルの `+` 行すべてが対象。
* 新しく足された・書き換えられた文の抜き出しは、次のコマンド（Git Bash。プロジェクトのルートで実行。ファイルを書き換えない）で行える。引数は `ファイル 開始行 終了行`。`[新]` の文が要件1の照合の対象、`[既存]` の文は `-` 行にそのまま同じ文がある文（「。」で区切って、同じハンクの `-` 行と比べている）。`[新]` でも「。」の無い行（フォルダ構成図・表の行など）や長い文は一部だけが変わっている場合があるので、`git diff -U0` の `-` 行と見比べて変わった部分を照合する。

```bash
export PYTHONIOENCODING=utf8; python - PROJECT_ARCHITECTURE.md 917 928 <<'E'
import subprocess,re,sys
f,s,e=sys.argv[1],int(sys.argv[2]),int(sys.argv[3])
d=subprocess.run(['git','diff','-U0','ff8718e','2b162c9','--',f],capture_output=True).stdout.decode('utf8')
sp=lambda t:[x.strip() for x in re.split('(?<=。)',t) if x.strip()]
for h in re.split(r'(?m)^(?=@@ )',d)[1:]:
    L=h.split('\n'); n=int(re.match(r'@@ -\S+ \+(\d+)',L[0])[1])
    old={x for l in L[1:] if l[:1]=='-' for x in sp(l[1:])}
    for i,l in enumerate([l for l in L[1:] if l[:1]=='+']):
        if s<=n+i<=e:
            print(f'--- {n+i}行')
            for x in sp(l[1:]): print(('    [既存] ' if x in old else '[新] ')+x)
E
```

* 資料の行は1行で数千字になるものがある。`Read` は長い行を途中で切ることがあるため、上のコマンドか `sed -n '<行>p' <ファイル>` で読む。1回の出力が長すぎて切れたら行の範囲を分けて取り直す（切れたまま照合を終えない）。

**3. 照合の手順**：
* `[新]` の文を先頭から順に読み、要件1の種類の主張を1つずつ、照合に使うコードの該当行を開いて確かめる。タスクの「対象ファイル」に書かれたコードは主な照合先であり、照合に必要なら他のソース・テストも読んでよい。コードは現在の作業ツリー（`HEAD`）を使う。importの有無・呼び出し元は `grep` で確かめる。
* **相違の判定は、資料の原文とコードの該当行を両方開いて行う**（記憶・要約・RESの記述だけで一致と判定しない）。
* 過去の時点の値・状態として書かれたもの（「Phase 11-02で…」「件数（Phase 11-03完了時）」など）は現在の値と区別し、`git show <コミット>:<パス>` で確かめられる範囲で確かめる（コミットは `git log --oneline ff8718e..2b162c9` で分かる）。当時の値として正しければ一致とする。
* **`PROJECT_ARCHITECTURE.md` 3章・`06_InputTracker.md`・`14_edit.md`・`16_test.md` の対象の行**（既知の傷2）では、`[既存]` の文にも目を通し、要件2の古い形が「今もそうである」と読める形で残っているかだけを見る（残っていれば5章へ挙げる。`[既存]` の文のほかの主張は照合しない）。結果は4章に「既知の傷2：（対象の行の範囲）…」として1行書く。
* 行数の記述は `wc -l` で実測し、資料の値と並べて書く。

**4. 結果の書き方**（4章の自分のタスクの欄・5章）：
* 「調査内容」に、照合した資料の範囲と確かめ方を書く。
* 「事実（実コードの記述）」に、資料のファイル（節・行）ごとに、照合した主張と結果を書く。一致と書く主張には、確かめたコードの場所（`ファイル:行`、または検索した語と件数）を添える。一致したものは「一致」と短く書けばよい。
* 「推測・所見」に、読み方が分かれる記述、「コードのコメント」（コードのコメント・JSDoc・テストの題の古い説明）、「照合できなかった主張」（理由を添える）、既知の傷3〜6の確認の結果を、それぞれの種類の見出しを付けて書く。推測を含める場合は、どこまでが事実でどこからが推測かを明示する。無ければ「特になし」。
* 相違は5章に「（タスクN）**（資料のファイルと節・行）**： （資料の記述） → （実コードの実態。`ファイル:行`）」の形で追記する（作業は中断しない）。自分のタスクの範囲外で偶然見つけた相違も、5章に同じ形で書いてよい。
* 各タスクは他のタスクの調査結果を読まなくても実行できる。4章の他のタスクの欄は読まない。
* タスクの終わりに `git status` で、変更があるのが本RESファイルだけであることを確かめ、3章の自分のタスクを `[x]` にする。

## 3. タスクリスト
* [ ] タスク1: PROJECT_ARCHITECTURE 1章（構成図・存在しないもの）と4章の表
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 1〜304行（1章「プロジェクトフォルダ構造」の構成図）・305〜308行（1章「存在しないもの」）・949〜1030行（4章「各モジュールの責務リファレンス」の表）
    * 照合に使うコード: `./js/`・`./test/`・`./asset/` のファイル一覧 :（監査）
    * 照合に使うコード: `./index.html` :（監査）
    * 照合に使うコード: 構成図の1行説明の照合先：`./js/core/` の新設17規則と `ThumbnailRenderer.js`・`KeyboardShortcuts.js`・`DragTracker.js`・`SelectionRules.js`、`./js/edit/`・`./js/palette/ItemListPanel.js`・`./js/wiring/`・`./js/io/` の該当ファイル（ファイル先頭の責務・公開物・import） :（監査）
    * 照合に使うコード: 「存在しないもの」の照合先：`./js/core/VectorModel.js`・`./js/core/InputTracker.js`・`./js/io/SpriteSerializer.js`・`./js/io/FileContentReader.js`・`./js/wiring/ItemListWiring.js` :（監査）
  * **調査内容**:
    * 構成図に足されたファイルの存在と配置を、ファイルの一覧と突き合わせる（新設ファイルの漏れ・消えた`js/palette/OptionBarOrderGroup.js`・`test/core/VectorModel.reorderShapes.test.js`が構成図に残っていないことを含む）。行の末尾の説明は、該当コードで照合する。
    * 「存在しないもの」の新しい文は、書かれたものが実際に無いことを、検索した語と件数を添えて確かめる（後のサブフェイズで作られたものが「無い」のまま残っていないかを重点に見る）。
    * 4章の表の追加行は、指すファイルの存在とモジュール名の対応を確かめる。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク2: PROJECT_ARCHITECTURE 1章（フォルダ分割の方針・依存方向）と3章13.・15.、表示の小さな修正
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 309〜319行（1章「フォルダ分割の方針」「依存方向」）・638〜654行（3章13.「オプションバー（スタイルのまとまり）」）・673〜695行（3章15.「表示」）
    * 資料: `./_doc/arch/04_CanvasManager.md`・`./_doc/arch/11_WindowManager.md`・`./_doc/arch/20_DisplayState.md`・`./_doc/arch/23_RulerRenderer.md`・`./_doc/arch/36_DisplayWiring.md`（いずれも全行）
    * 照合に使うコード: `./js/` 全ファイルのimport文（`grep`） :（監査）
    * 照合に使うコード: `./js/core/CanvasManager.js`・`WindowManager.js`・`DisplayState.js`・`RulerRenderer.js` :（監査）
    * 照合に使うコード: `./js/wiring/DisplayWiring.js` :（監査）
    * 照合に使うコード: `./js/edit/ShapeStyleEditor.js`・`ShapeExtentReader.js`・`StylePanelRules.js` :（監査）
    * 照合に使うコード: `./js/palette/OptionBarStyleGroup.js` :（監査）
    * 照合に使うコード: `./js/main.js`・`./index.html`（該当箇所のみ） :（監査）
  * **調査内容**:
    * 「依存方向」とその例外の一覧は、`js/` の全import文を `grep` で集めて1つずつ突き合わせる（例外の一覧の過不足を含む）。
    * 3章13.・15.は、オプションバーのまとまりの一覧・対象（変えられる図形／見えている図形）・記録・パレットを隠す対象・⛶の対象を照合する。3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク3: PROJECT_ARCHITECTURE 2章（図形・アイテム・作業データ）とItemTreeRules・ItemAttributeRules・ItemStateRules
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 320〜360行（2章「図形」「アイテム」「図形データ」「作業データ形式」「作業データファイル」）
    * 資料: `./_doc/arch/46_ItemTreeRules.md`・`./_doc/arch/47_ItemAttributeRules.md`・`./_doc/arch/63_ItemStateRules.md`・`./_doc/arch/10_ShapeFactory.md`・`./_doc/arch/12_shapes.md`（いずれも全行）
    * 照合に使うコード: `./js/core/ItemTreeRules.js`・`ItemAttributeRules.js`・`ItemStateRules.js`・`ShapeFactory.js` :（監査）
    * 照合に使うコード: `./js/io/DocumentSerializer.js` :（監査）
    * 照合に使うコード: `./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`・`Path.js` :（監査）
    * 照合に使うコード: `./test/core/ItemTreeRules.test.js`・`ItemAttributeRules.test.js`・`ItemStateRules.test.js`（資料がテストの件数・内容に触れている所だけ） :（監査）
  * **調査内容**:
    * アイテムの形・名前の整え方・表示とロックの補い・フォルダ・作業データの版4・`migrateVersion3To4`・要素のキー順・読み飛ばしの記録（`index`・`path`）を照合する。
    * 共通メソッド契約の数（18）と一覧・順番を、各図形クラスのメソッドと突き合わせる。
    * 11-01時点の「値を持つだけ」「画面から作れない」の記述が残っていないかを重点に見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク4: PROJECT_ARCHITECTURE 2章（書き出し形式）・3章4.・5.・9.とio/
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 361〜434行（2章「スプライト（書き出し形式）」（エンジンとの約束・描画要素・エディタで開くときの規則・外枠を含む）・「ファイル名の規則」・「キャンバス」・「キャンバス記録」の途中（「保存しないもの」の直前）まで）・485〜492行（3章4.「座標系とビュー変換」・5.「作業データの変換・`?dev`の復元」）・573〜586行（3章9.「ファイル入出力」）
    * 資料: `./_doc/arch/15_io.md`・`./_doc/arch/17_sprite_check.md`・`./_doc/arch/37_SpriteFitRules.md`・`./_doc/arch/40_asset_sprite.md`（いずれも全行）
    * 照合に使うコード: `./js/io/DocumentSerializer.js`・`SpriteSerializer.js`・`DrawElementReader.js`・`FileContentReader.js`・`CodeExporter.js` :（監査）
    * 照合に使うコード: `./js/edit/CanvasFileOperations.js`・`ShapeInserter.js` :（監査）
    * 照合に使うコード: `./js/core/SpriteFitRules.js`・`ItemStateRules.js`・`ItemAttributeRules.js`・`ItemTreeRules.js` :（監査）
    * 照合に使うコード: `./js/shapes/` の `toDrawElement` :（監査）
    * 照合に使うコード: `./js/check/`・`./sprite-check.html`・`./asset/` :（監査）
    * 照合に使うコード: `./js/main.js`（`?dev`の復元の箇所） :（監査）
  * **調査内容**:
    * 書き出し形式の版4（`source`・描画要素の`id`なし）、`elements`・`bounds`に入る図形、`source`入りのJSと`elements`から組み立てるJSの読み方、組み立ての規則・読み飛ばし、出力・開く・インポートの流れを照合する。
    * 11-05の`source`の記述が11-06aの後も成り立つかを重点に見る。エンジン側の記述は「照合できなかった主張」とする。3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク5: PROJECT_ARCHITECTURE 2章（選択状態・描き込む先）とVectorModel・GroupSelectionRules
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 435〜462行（2章「キャンバス記録」の「保存しないもの」から、「選択状態」（選んでいるフォルダ・折りたたみ・一覧の選択の表示・頂点の選択・描き込む先を含む）を経て2章の終わりまで）
    * 資料: `./_doc/arch/03_VectorModel.md`・`./_doc/arch/58_GroupSelectionRules.md`（いずれも全行）
    * 照合に使うコード: `./js/core/VectorModel.js` :（監査）
    * 照合に使うコード: `./js/core/GroupSelectionRules.js`・`InsertTargetRules.js`・`ItemPlaceRules.js`・`GroupCollapseRules.js`・`ItemStateRules.js`・`ItemTreeRules.js`・`ItemAttributeRules.js` :（監査）
    * 照合に使うコード: `./js/edit/SnapshotAdapter.js`・`CanvasLibrary.js`（履歴・保存に入れる／入れないの照合） :（監査）
    * 照合に使うコード: 呼び出し元の `grep`（`./js/` 全体） :（監査）
    * 照合に使うコード: `./test/core/VectorModel.*.test.js`・`GroupSelectionRules.test.js`（件数・存在の照合だけ） :（監査）
  * **調査内容**:
    * 公開メソッドの一覧・引数・戻り値・通知、状態の持ち主と初期値、描き込む先の3つの形と動く条件、選んでいるフォルダの経路ごとの候補、保存しない・履歴に入れないと書かれたもの、行数を照合する。
    * 呼び出し元の記述は`grep`で確かめる（`deleteShapes`・`getInsertTargetId`など製品コードから呼ばれなくなったものを含む）。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク6: main.js・HistoryManagerとPROJECT_ARCHITECTURE 3章1.・2.・6.・8.
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 463〜471行（3章冒頭「同期の経路」・1.「起動処理」・2.「描画サイクル」）・493〜534行（3章6.「履歴」）・544〜572行（3章8.「キャンバス管理」）
    * 資料: `./_doc/arch/02_main.md`・`./_doc/arch/08_HistoryManager.md`（いずれも全行）
    * 照合に使うコード: `./js/main.js` :（監査）
    * 照合に使うコード: `./js/core/HistoryManager.js`・`CanvasManager.js`（描画サイクル） :（監査）
    * 照合に使うコード: `./js/edit/SnapshotAdapter.js`・`CanvasLibrary.js`・`ShapeInserter.js`・`GroupEditor.js`・`ItemRenameEditor.js`・`ItemStateEditor.js`・`ShapeOrderEditor.js`・`NudgeEditor.js`・`ShapeStyleEditor.js`（記録の時点・まとめの鍵） :（監査）
    * 照合に使うコード: `./js/core/InputTracker.js`（記録の箇所の検索のみ） :（監査）
    * 照合に使うコード: `./js/wiring/ItemListWiring.js`・`DisplayWiring.js`（注入の受け側） :（監査）
  * **調査内容**:
    * 配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先・行数（計画時の実測は1234行）を、`main.js`を開いて1行ずつ突き合わせる。
    * 履歴の1件の単位・記録しない操作・復元の手順・自動保存の契機を照合する。3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク7: InputTracker・KeyboardShortcutsとPROJECT_ARCHITECTURE 3章3.・16.〜18.
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 472〜484行（3章3.「入力監視」）・696〜759行（3章16.「選択と移動の操作」・17.「スナップ」・18.「頂点の選択」）
    * 資料: `./_doc/arch/06_InputTracker.md`・`./_doc/arch/07_KeyboardShortcuts.md`・`./_doc/arch/09_DragTracker.md`・`./_doc/arch/18_PointHitRules.md`・`./_doc/arch/27_SelectionRules.md`・`./_doc/arch/32_InputModes.md`・`./_doc/arch/33_FocusKeyYieldRules.md`・`./_doc/arch/38_VertexHandleRules.md`（いずれも全行）
    * 照合に使うコード: `./js/core/InputTracker.js`・`KeyboardShortcuts.js`・`DragTracker.js`・`PointHitRules.js`・`SelectionRules.js`・`InputModes.js`・`FocusKeyYieldRules.js`・`VertexHandleRules.js` :（監査）
    * 照合に使うコード: `./js/core/RemovalRules.js`・`ItemListRules.js`（参照される範囲） :（監査）
    * 照合に使うコード: `./js/edit/ClipboardController.js`（`duplicateInPlace`） :（監査）
    * 照合に使うコード: `./js/main.js`（コールバックの実体） :（監査）
    * 照合に使うコード: `./index.html`（フォーカスを譲る部品） :（監査）
  * **調査内容**:
    * キーの対応表（`group`・`ungroup` と、表の中の位置の記述を含む）、公開メソッド、修飾キーの扱い、削除の受理、変えられる図形・見えている図形の使い分け、行数（計画時の実測は `InputTracker.js` 2023行）を照合する。
    * 3章と `06_InputTracker.md` の行は`[既存]`の文も既知の傷2の手順で見る。
    * 既知の傷3（`js/core/InputTracker.js` のJSDocの描き込む先の古い説明）が残っているかを「推測・所見」に書く。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク8: 14_edit（前半）とPROJECT_ARCHITECTURE 3章10.〜12.・19.〜27.
  * **対象ファイル**:
    * 資料: `./_doc/arch/14_edit.md` 1〜97行（冒頭の責務・依存から`ClipboardController`の直前まで）
    * 資料: `./PROJECT_ARCHITECTURE.md` 587〜637行（3章10.「確認用ページ」・11.「結合」・12.「端点への吸い付きと描き足し」）・760〜916行（3章19.「矢印キーでの微調整」〜27.「基準点・大きさと角度の数値入力・反転」）
    * 照合に使うコード: `./js/edit/` の `ShapeExtentReader.js`・`NudgeEditor.js`・`PositionInputEditor.js`・`PositionInputRules.js`・`TransformInputEditor.js`・`TransformInputRules.js`・`ShapeInserter.js`・`PathJoiner.js`・`EndpointSnapper.js`・`PathCornerEditor.js`・`ShapeStyleEditor.js`・`ShapeOrderRules.js`・`ShapeOrderEditor.js`・`ShapeAlignEditor.js` :（監査）
    * 照合に使うコード: `./js/edit/` 全ファイルのimport文（`grep`。例外の一覧の照合） :（監査）
    * 照合に使うコード: `./js/core/NudgeTargetRules.js`・`ScaleHandleRules.js`・`RotationRules.js`・`InsertTargetRules.js` :（監査）
    * 照合に使うコード: `./js/shapes/EndpointSnapRules.js`・`PathJoinRules.js` :（監査）
    * 照合に使うコード: `./js/palette/OptionBarCornerGroup.js`・`OptionBarAlignGroup.js` :（監査）
    * 照合に使うコード: `./js/core/InputTracker.js`（ハンドル・線を続けて引く箇所の検索） :（監査）
  * **調査内容**:
    * 各クラスの依存（importの一覧と例外の一覧）・注入・公開メソッド・契約・対象（変えられる図形）・入る場所の決め方を照合する。
    * 3章・`14_edit.md` の行は`[既存]`の文も既知の傷2の手順で見る。
    * 既知の傷5（`EndpointSnapRules.js`・`PathJoinRules.js` のJSDocの「`model.getShapes()`の並び」）が残っているかを「推測・所見」に書く。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク9: 14_edit（後半）とPROJECT_ARCHITECTURE 3章7.、RemovalRules・SoloVisibilityRules
  * **対象ファイル**:
    * 資料: `./_doc/arch/14_edit.md` 98〜148行（`ClipboardController`から終わりまで。`StyleEyedropper`・`SnapshotAdapter`・`CanvasLibrary`・`CanvasFileOperations`・`GroupEditor`・`ItemRenameEditor`・`ItemStateEditor`）
    * 資料: `./PROJECT_ARCHITECTURE.md` 535〜543行（3章7.「コピー・貼り付け・複製」）
    * 資料: `./_doc/arch/64_RemovalRules.md`・`./_doc/arch/65_SoloVisibilityRules.md`（いずれも全行）
    * 照合に使うコード: `./js/edit/` の `ClipboardController.js`・`StyleEyedropper.js`・`SnapshotAdapter.js`・`CanvasLibrary.js`・`CanvasFileOperations.js`・`GroupEditor.js`・`ItemRenameEditor.js`・`ItemStateEditor.js`・`ShapeInserter.js` :（監査）
    * 照合に使うコード: `./js/core/RemovalRules.js`・`SoloVisibilityRules.js`・`InsertTargetRules.js`・`GroupSelectionRules.js`・`GroupTreeRules.js`・`GroupCollapseRules.js`・`ItemStateRules.js` :（監査）
    * 照合に使うコード: `./js/main.js`（生成・注入の箇所） :（監査）
    * 照合に使うコード: `./test/edit/GroupEditor.test.js`・`ItemRenameEditor.test.js`・`ItemStateEditor.test.js`、`./test/core/RemovalRules.test.js`・`SoloVisibilityRules.test.js`（件数・内容に触れている所だけ） :（監査）
  * **調査内容**:
    * 写し方・自分のコピーの見分け・貼り付けと複製の入る場所・切り取りと削除で消えるもの・その行だけの表示の覚え・スナップショットの形・`requestSave`・importの一覧・呼び出し元・テストの件数を照合する。
    * 3章・`14_edit.md` の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク10: PROJECT_ARCHITECTURE 3章14.（重なり順）とGroupTreeRules・ItemPlaceRules・InsertTargetRules・ListDragRules
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 655〜672行（3章14.「重なり順の変更」）
    * 資料: `./_doc/arch/54_InsertTargetRules.md`・`./_doc/arch/55_ListDragRules.md`・`./_doc/arch/57_GroupTreeRules.md`・`./_doc/arch/62_ItemPlaceRules.md`（いずれも全行）
    * 照合に使うコード: `./js/core/GroupTreeRules.js`・`ItemPlaceRules.js`・`InsertTargetRules.js`・`ListDragRules.js` :（監査）
    * 照合に使うコード: `./js/edit/ShapeOrderEditor.js`・`ShapeOrderRules.js`・`GroupEditor.js` :（監査）
    * 照合に使うコード: `./js/main.js`（`performShapeOrder`・行のドラッグの配線） :（監査）
    * 照合に使うコード: `./index.html`（重なり順のまとまりが無いこと） :（監査）
    * 照合に使うコード: 呼び出し元の `grep`（`./js/` 全体） :（監査）
    * 照合に使うコード: `./test/core/` の同名のテスト（件数・内容に触れている所だけ） :（監査）
  * **調査内容**:
    * 公開の関数・定数・typedefの一覧と値、入る場所（上・下・フォルダの中）の決め方、動かすまとまり、重なり順のキーの流れ、消えた関数（`reorderShapes`・`applyOrder`・`hasGroupItem`・`insertItemsAbove`・`ListDragRules`の旧関数）の言及を照合する。
    * 3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク11: PROJECT_ARCHITECTURE 3章28.（表示・選択・名前）とItemListRules・ItemListWiring
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 917〜928行（3章28.「図形の一覧」の冒頭からふるまいの注意まで。モジュールの分担・同期の流れ・サムネイル・選択・カーソル・名前の編集・領域の同期・決定・設計判断）
    * 資料: `./_doc/arch/48_ItemListRules.md`・`./_doc/arch/53_ItemListWiring.md`（いずれも全行）
    * 照合に使うコード: `./js/core/ItemListRules.js`・`ListSelectionRules.js`・`ListScrollRules.js`・`ThumbnailRenderer.js`・`ThumbnailRules.js` :（監査）
    * 照合に使うコード: `./js/wiring/ItemListWiring.js` :（監査）
    * 照合に使うコード: `./js/palette/ItemListPanel.js` :（監査）
    * 照合に使うコード: `./js/main.js`（`// 7.15.`） :（監査）
    * 照合に使うコード: `./index.html`（一覧のパネルのCSS・要素） :（監査）
  * **調査内容**:
    * 一覧の操作を受け付ける条件、行の押下・カーソル・名前の編集の流れ、`requestAnimationFrame`の同期、注入の一覧、購読先、状態（編集中・ドラッグ中）を照合する。11-02・11-03の記述がフォルダ・表示/ロックの後も成り立つかを重点に見る。
    * 3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 既知の傷4（`ItemListRules.js` の `resolveRowHover` の `@param id`）が残っているかを「推測・所見」に書く。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク12: PROJECT_ARCHITECTURE 3章28.（行のドラッグ・描き込む先・フォルダの行）とItemListRowDrag・ItemRowRules等
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 929〜939行（3章28.の行のドラッグ・始まりと取りやめ・描き込む先の見せ方と変え方・Phase 11-03のふるまいの注意・フォルダの行（行の並び・パネル・折りたたみ・選択・作るボタン・行のドラッグとの関係））
    * 資料: `./_doc/arch/56_ItemListRowDrag.md`・`./_doc/arch/59_GroupCollapseRules.md`・`./_doc/arch/60_GroupCommandRules.md`・`./_doc/arch/61_ItemRowRules.md`（いずれも全行）
    * 照合に使うコード: `./js/wiring/ItemListRowDrag.js`・`ItemListWiring.js` :（監査）
    * 照合に使うコード: `./js/core/ItemRowRules.js`・`GroupCollapseRules.js`・`GroupCommandRules.js`・`ListDragRules.js`・`InsertTargetRules.js`・`GroupSelectionRules.js`・`DragTracker.js` :（監査）
    * 照合に使うコード: `./js/palette/ItemListPanel.js` :（監査）
    * 照合に使うコード: `./js/edit/GroupEditor.js`・`ShapeOrderEditor.js` :（監査）
    * 照合に使うコード: `./index.html`（`#item-list-add-group`・行のCSS） :（監査）
    * 照合に使うコード: `./test/core/` の同名のテスト（件数・内容に触れている所だけ） :（監査）
  * **調査内容**:
    * 行のドラッグの始まる条件・取りやめの条件・入る場所・自動スクロール、描き込む先の印、行の並び（`buildItemRows`）・字下げの上限、折りたたみ・自動で開く条件、フォルダを作るボタンを照合する。
    * 3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク13: PROJECT_ARCHITECTURE 3章28.（ふるまいの注意・確認の状況・目と鍵）とListSelectionRules・ListScrollRules・Thumbnail
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md` 940〜948行（3章28.の「やらないこと」・「確認の状況」・Phase 11-04a・04bのふるまいの注意・Phase 11-05（目・鍵のアイコン）と確認の状況）
    * 資料: `./_doc/arch/49_ListSelectionRules.md`・`./_doc/arch/50_ListScrollRules.md`・`./_doc/arch/51_ThumbnailRules.md`・`./_doc/arch/52_ThumbnailRenderer.md`（いずれも全行）
    * 照合に使うコード: `./js/core/ListSelectionRules.js`・`ListScrollRules.js`・`ThumbnailRules.js`・`ThumbnailRenderer.js`・`SoloVisibilityRules.js`・`ItemStateRules.js`・`GroupCollapseRules.js`・`InsertTargetRules.js` :（監査）
    * 照合に使うコード: `./js/palette/ItemListPanel.js` :（監査）
    * 照合に使うコード: `./js/wiring/ItemListWiring.js`・`ItemListRowDrag.js` :（監査）
    * 照合に使うコード: `./js/edit/ItemStateEditor.js`・`ClipboardController.js` :（監査）
    * 照合に使うコード: `./test/core/` の同名のテスト（確認の状況に書かれた範囲だけ） :（監査）
  * **調査内容**:
    * 目・鍵のアイコンの操作（`Alt`＋クリックを含む）、ふるまいの注意の各項がコードで成り立つか、`Shift`＋クリックの起点、サムネイルの大きさ・線の太さの下限・描き直しの判定を照合する。
    * 「確認の状況」のブラウザでの確認の記述は「照合できなかった主張」とする。3章の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク14: 01_index_html・13_palette
  * **対象ファイル**:
    * 資料: `./_doc/arch/01_index_html.md`・`./_doc/arch/13_palette.md`（いずれも全行）
    * 照合に使うコード: `./index.html` :（監査）
    * 照合に使うコード: `./js/palette/ItemListPanel.js` :（監査）
    * 照合に使うコード: `./js/palette/` の他のファイル（import・注入の照合） :（監査）
    * 照合に使うコード: `./js/core/WindowManager.js`・`./js/wiring/DisplayWiring.js`・`ItemListWiring.js`（`--canvas-area-width`・使う側の照合） :（監査）
  * **調査内容**:
    * 要素・id・属性・クラス・CSS変数・CSSの値・幅の見積もりのコメント、2行のツールバーのまとまりの一覧（重なり順のまとまりが無いこと）、右端の一覧のパネル、目・鍵のアイコンの見た目を照合する。
    * `ItemListPanel` の公開メソッド・注入・構成・イベント・名前の編集を照合する。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク15: 16_test（前半。1〜268行）
  * **対象ファイル**:
    * 資料: `./_doc/arch/16_test.md` 1〜268行（書き方の決まり・以前のPhaseの項のうち書き換えられた行・Phase 11-01〜11-03の項）
    * 照合に使うコード: `./test/` 配下（Phase 11-01〜11-03の新設・変更のテストファイル） :（監査）
    * 照合に使うコード: `./test/io/DocumentSerializer.roundtrip.test.js`・`SpriteSerializer.test.js`・`FileContentReader.test.js`、`./test/edit/CanvasFileOperations*.test.js`・`TransformInputEditor.test.js`・`ShapeOrderEditor.test.js` :（監査）
    * 照合に使うコード: `./js/palette/ItemListPanel.js`・`./js/wiring/`（「テストできない箇所」の照合） :（監査）
  * **調査内容**:
    * テストファイルの存在・件数・内容の記述を、テストファイルを開いて照合する。件数は現在の値か当時の値かを区別し、当時の値は `git show <コミット>:<パス>` で確かめられる範囲で確かめる。
    * 書き方の決まりの例外（「例外は12ファイル」などの数と一覧）を現在の実数と突き合わせ、後の項の言い方と矛盾しないかを見る。
    * 既知の傷1（`DocumentSerializer.roundtrip.test.js` の「`version`は2」の項（30行付近）、`CanvasFileOperations` の項（39・40行付近）など、以前のPhaseの項に残る古い記述）を、差分のない行を含めて確かめる。食い違っていれば5章へ必ず挙げる。
    * 対象の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク16: 16_test（後半。269〜315行）
  * **対象ファイル**:
    * 資料: `./_doc/arch/16_test.md` 269〜315行（Phase 11-04a〜11-06aの項）
    * 照合に使うコード: `./test/` 配下（Phase 11-04a〜11-06aの新設・変更のテストファイル） :（監査）
    * 照合に使うコード: `./js/palette/ItemListPanel.js`・`./js/wiring/`（「テストできない箇所」の照合） :（監査）
  * **調査内容**:
    * テストファイルの存在・件数・内容の記述を、テストファイルを開いて照合する（「→」の前後の件数、消したテストファイル、書き換えた既存のテストを含む）。現在の全体の件数は `node --test` を実行して確かめる。各サブフェイズ完了時の件数は当時の値として扱う。
    * 既知の傷6（`test/core/ItemPlaceRules.test.js` の `describe` 名の `insertItemsAbove`、`test/edit/ShapeInserter.insertTarget.test.js` の `assert.ok(inserter)`）が残っているかを「推測・所見」に書く。
    * 対象の行は`[既存]`の文も既知の傷2の手順で見る。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク17: 要件2の検索（前半：並びの持ち方・版・重なり順・新しく入る場所・フォルダ）
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md`・`./_doc/arch/` 配下の全ファイル（01〜65。差分のない行・差分のないファイルを含む）の検索
    * 照合に使うコード: `./js/core/VectorModel.js`・`./js/io/DocumentSerializer.js`・`./js/io/FileContentReader.js`・`./js/edit/`・`./js/core/` の該当箇所 :（監査）
    * 照合に使うコード: `./index.html`・`./js/main.js`（重なり順） :（監査）
  * **調査内容**:
    * `git diff --name-status ff8718e HEAD -- js index.html test asset sprite-check.html` と、開発資料の差分の `-` 行から、変わった・なくなった名前と言い方を洗い出し、現在の実コードの事実を確かめる。
    * 要件2の「図形の並びの持ち方」「版」「重なり順」「新しく入る場所」「フォルダ」の5項目について、語（例：`#shapes`・`getShapes()`・`serialize(model.getShapes`・「並びそのもの」・「一覧は無い」・「版3」・「version」・「版1〜3」・`OptionBarOrderGroup`・⏫・🔼・🔽・⏬・`syncOptionBarOrderGroup`・「重なり順」・「末尾」・「最前面」・「すぐ上」・`hasGroupItem`・「フォルダを含む」・「フォルダは作れない」など。洗い出した語を足してよい）で全ファイルを検索する。
    * 見つかった箇所を1つずつ読み、「今もそうである」と読める古い記述か、経緯・過去の状態として正しいかを判定する。検索した語と件数を4章に書く（件数0も書く）。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク18: 要件2の検索（後半：表示とロック・書き出し・消えた関数・行数・数え方）
  * **対象ファイル**:
    * 資料: `./PROJECT_ARCHITECTURE.md`・`./_doc/arch/` 配下の全ファイル（01〜65。差分のない行・差分のないファイルを含む）の検索
    * 照合に使うコード: `./js/io/SpriteSerializer.js`・`FileContentReader.js`・`DrawElementReader.js`、`./js/core/VectorModel.js`・`InputTracker.js`・`ListDragRules.js`、`./js/edit/`・`./js/wiring/`・`./js/palette/ItemListPanel.js` の該当箇所 :（監査）
    * 照合に使うコード: `./test/`（数え方） :（監査）
  * **調査内容**:
    * `git diff --name-status ff8718e HEAD -- js index.html test asset sprite-check.html` と、開発資料の差分の `-` 行から、変わった・なくなった名前と言い方を洗い出し、現在の実コードの事実を確かめる（`ListDragRules`の旧関数名は、`git log --oneline ff8718e..2b162c9 -- js/core/ListDragRules.js` で分かるコミットの版を `git show <コミット>:js/core/ListDragRules.js` で見て洗い出す）。
    * 要件2の「表示・ロック」「書き出し」「消えた・変わった関数・メソッド」「行数」「数え方」の5項目について、語（例：「効かせない」・「値を持つだけ」・「全図形」・`selectAll`・「目・鍵」・`source`・「読み込み不可」・「作り直さない」・`kind, id`・「`SpriteSerializer`」のimport・「11-06b」・`reorderShapes`・`applyOrder`・`deleteShapes`・`getInsertTargetId`・`insertItemsAbove`・`hasGroupItem`・`ListDragRules`の旧関数名・「〜行」（行数）・`wc -l`・「例外は」・「〜ファイル」の数など。洗い出した語を足してよい）で全ファイルを検索する。
    * 「呼び出し元は〜」の記述は、`grep` で現在の製品コードの呼び出し元を確かめて照合する。行数の記述は `wc -l` で実測し、資料の値と並べて書く。
    * 見つかった箇所を1つずつ読み、「今もそうである」と読める古い記述か、経緯・過去の状態として正しいかを判定する。検索した語と件数を4章に書く（件数0も書く）。
    * 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の『事実』『推測・所見』欄に書く。相違は5章にタスク番号を添えて書く（作業は中断しない。資料に無い事項がコードにあることは相違としない）。判定は資料の原文とコードの該当行を両方開いて行い、一致には `ファイル:行`、または検索した語と件数を添える。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。
* [ ] タスク19: （固定）『開発資料との相違』の確認と一覧の作成
  * **対象ファイル**:
    * 本RESファイル（4章・5章・6章） :（監査・追記）
  * **調査内容**:
    * 5章『開発資料との相違』を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。
    * 4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」「コードのコメント」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。このタスクに限り、4章の全タスクの「推測・所見」欄を読む。
    * タスクの終わりに `git status` で、ソースコードおよび資料ファイルを一切変更していないこと（変更があるのは本RESだけ）を確かめる。

## 4. 調査結果
### タスク1: PROJECT_ARCHITECTURE 1章（構成図・存在しないもの）と4章の表
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク2: PROJECT_ARCHITECTURE 1章（フォルダ分割の方針・依存方向）と3章13.・15.、表示の小さな修正
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク3: PROJECT_ARCHITECTURE 2章（図形・アイテム・作業データ）とItemTreeRules・ItemAttributeRules・ItemStateRules
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク4: PROJECT_ARCHITECTURE 2章（書き出し形式）・3章4.・5.・9.とio/
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク5: PROJECT_ARCHITECTURE 2章（選択状態・描き込む先）とVectorModel・GroupSelectionRules
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク6: main.js・HistoryManagerとPROJECT_ARCHITECTURE 3章1.・2.・6.・8.
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク7: InputTracker・KeyboardShortcutsとPROJECT_ARCHITECTURE 3章3.・16.〜18.
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク8: 14_edit（前半）とPROJECT_ARCHITECTURE 3章10.〜12.・19.〜27.
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク9: 14_edit（後半）とPROJECT_ARCHITECTURE 3章7.、RemovalRules・SoloVisibilityRules
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク10: PROJECT_ARCHITECTURE 3章14.（重なり順）とGroupTreeRules・ItemPlaceRules・InsertTargetRules・ListDragRules
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク11: PROJECT_ARCHITECTURE 3章28.（表示・選択・名前）とItemListRules・ItemListWiring
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク12: PROJECT_ARCHITECTURE 3章28.（行のドラッグ・描き込む先・フォルダの行）とItemListRowDrag・ItemRowRules等
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク13: PROJECT_ARCHITECTURE 3章28.（ふるまいの注意・確認の状況・目と鍵）とListSelectionRules・ListScrollRules・Thumbnail
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク14: 01_index_html・13_palette
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク15: 16_test（前半。1〜268行）
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク16: 16_test（後半。269〜315行）
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク17: 要件2の検索（前半：並びの持ち方・版・重なり順・新しく入る場所・フォルダ）
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク18: 要件2の検索（後半：表示とロック・書き出し・消えた関数・行数・数え方）
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク19: （固定）『開発資料との相違』の確認と一覧の作成
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

## 5. 開発資料との相違
* （未確認。各タスクで相違を見つけ次第、「（タスクN）**（資料のファイルと節・行）**： （資料の記述） → （実コードの実態。`ファイル:行`）」の形で、この下に追記する。全タスクの後に一件もなければ、タスク19で「相違なし」と記載する）

## 6. 懸念事項・今後の修正における注意点
* （タスク19で、「読み方が分かれる記述」「コードのコメント」「照合できなかった主張」の一覧を記載する）
