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
* [x] タスク1: PROJECT_ARCHITECTURE 1章（構成図・存在しないもの）と4章の表
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
* [x] タスク2: PROJECT_ARCHITECTURE 1章（フォルダ分割の方針・依存方向）と3章13.・15.、表示の小さな修正
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
  * `PROJECT_ARCHITECTURE.md` 1〜304行（構成図）・305〜308行（存在しないもの。実体は306行の1行）・949〜1021行（4章の表。ファイルは1021行で終わる）の`+`行を、抜き出しコマンドで`[新]`の文に分けて照合した。
  * 構成図のファイル名は、図の木構造を解析して作ったファイル一覧（257件）と `git ls-files js test asset index.html sprite-check.html` を突き合わせた。説明文の`importは〜のみ`・`〜から使う`は、`js/` の`import`文（`grep`。複数行のimportも）で1つずつ確かめた。公開物の名前は`export`の一覧、`index.html`の記述は該当行を開いて確かめた。
  * 「存在しないもの」は、検索した語の件数とコードの該当行で確かめた。
  * 4章の表は、行の解析（65行）で、指す`_doc/arch/`のファイルの存在・`_doc/arch/`の全65ファイルが表にあること・`js/`の全ファイルが表の行（ファイル名またはフォルダ）に含まれることを確かめた。
* **事実（実コードの記述）**:
  * 構成図のファイルの存在と配置：解析した257件は`git ls-files`のファイルと一致した（資料にあって実在しないもの 0件。実在して資料にないものは `asset/sprite/select-arrow.js`・`vertex-arrow.js` の2件で、図では`asset/sprite/`の1行にまとめている書き方と一致）。新設の`js/core/`の17規則・`ThumbnailRenderer`・`js/edit/`の3つ・`js/palette/ItemListPanel.js`・`js/wiring/`の2つ・`js/io/DrawElementReader.js`と、新設のテストファイルがすべて図にあり、消えた`js/palette/OptionBarOrderGroup.js`・`test/core/VectorModel.reorderShapes.test.js`は図に無い（`git diff --name-status`のDと一致。`OptionBarOrderGroup`の検索：`js/`・`index.html`で0件）。
  * 構成図の説明のimportの向き：`ItemTreeRules`（なし）・`ItemAttributeRules`（`ItemTreeRules`・`ShapeFactory`）・`ItemListRules`（`InputModes`のみ）・`ItemRowRules`（`ItemTreeRules`・`GroupTreeRules`の`itemIdOf`・`ItemPlaceRules`の`PLACE_KIND`・`ItemStateRules`の`collectItemStates`。`js/core/ItemRowRules.js:5-8`）・`GroupTreeRules`（`ItemTreeRules`）・`ItemPlaceRules`（`ItemTreeRules`・`GroupTreeRules`。`:5-6`）・`ItemStateRules`（`ItemTreeRules`・`GroupTreeRules`の`itemIdOf`。`:5-6`）・`RemovalRules`（`:5-7`）・`SoloVisibilityRules`（`GroupTreeRules`の`itemIdOf`・`ItemPlaceRules`の`findItemLocation`・`ItemStateRules`の`listItemStates`。`:5-7`）・`GroupSelectionRules`・`GroupCollapseRules`（`ItemTreeRules`・`GroupTreeRules`の`itemIdOf`）・`GroupCommandRules`（`InputModes`）・`ListSelectionRules`（`SelectionRules`）・`ListScrollRules`（なし）・`InsertTargetRules`（`ItemTreeRules`・`GroupTreeRules`・`GroupSelectionRules`・`ItemPlaceRules`）・`ListDragRules`（`ItemTreeRules`・`ItemRowRules`・`ItemPlaceRules`）・`ThumbnailRules`（`SpriteFitRules`）・`ThumbnailRenderer`（`ThumbnailRules`）・`ItemListPanel`（なし）：すべて一致。
  * 「から使う」の照合：一致＝`ItemAttributeRules`（`VectorModel`・`DocumentSerializer`・`ItemRenameEditor`）・`ItemStateRules`（6件）・`RemovalRules`・`SoloVisibilityRules`・`GroupCollapseRules`・`GroupCommandRules`・`ListSelectionRules`・`ListScrollRules`・`ListDragRules`（`ItemListRowDrag`）・`ThumbnailRules`・`ThumbnailRenderer`・`SelectionRules`（`InputTracker`・`main.js`・`ListSelectionRules`）・`SpriteFitRules`（`ToolIconWiring`・`ThumbnailRules`）・`DragTracker`（`InputTracker`・`wiring/ItemListRowDrag`）・`ItemListWiring`（`main.js`だけ）・`ItemListRowDrag`（`ItemListWiring`だけ）・`ItemListPanel`。相違＝`ItemTreeRules`の項に`ItemListRules`が使う側として書かれている点（5章）。
  * 公開物の名前：構成図に書かれた`buildItemRows`・`resolveRowViews`・`resolveRowHighlight`（`ItemRowRules`）、`canSetInsertTargetByRow`・`canStartRowDrag`・`shouldSelectPressedRow`・`canToggleGroup`・`resolveStateIconAction`・`STATE_ICON`・`STATE_ICON_ACTION`（`ItemListRules`）、`pickItems`・`listGroupIds`（`GroupTreeRules`。`hasGroupItem`は`js/`で0件）、`PLACE_KIND`（above・below・inside・bottom）・`findItemLocation`・`insertItemsAt`・`canMoveItems`・`moveItems`（`ItemPlaceRules`。`insertItemsAbove`は`js/`で0件）、`listItemStates`ほか`ItemStateRules`の8つ、`resolveRemoval`、`resolveSoloToggle`、`resolveNextInsertTarget`ほか`InsertTargetRules`の6つ、`hasHighlightChanged`、`resolveRowClickSelection`、`applyItemRename`、`resolveUserClickSelection`（`SelectionRules.js:48`）、`ShapeExtentReader.getShapeBounds`（`:76`）：すべて実在。`ItemListRules.canStartRowDrag`の引数は`hasGroups`なし・`isOnStateIcon`あり（`ItemListRules.js:69`。`hasGroups`・`reorderShapes`・`applyOrder`・`resolveDropIndex`の検索は`js/`で0件）。`ItemRowRules`の`RowView`は`insertLine`・`visible`・`locked`・`hiddenByAncestor`・`lockedByAncestor`・`hidden`を持つ（`ItemRowRules.js:36-48`）。`ItemAttributeRules.resolveItems`（`:80-`）に`collapsed`が`true`以外ならキーを消す整えがある（`:101-102`）。
  * `KeyboardShortcuts`：`Shift`+`H`・`Shift`+`V`の2エントリは対応表の末尾（`KeyboardShortcuts.js:221-222`）、`group`・`ungroup`は`invertSelection`（`:191`）の直後・表示の切り替え（`toggleOutline` `:196`）の前（`:193-194`）、`isCancelableDrag`は`main.js:1013`で`inputTracker.isScalingSelection() || itemListWiring.isRowDragging()`。一致。`DragTracker.cancel({ suppressClick })`（`DragTracker.js:146`）：一致。
  * `edit/`・`wiring/`・`palette/`の説明：`ShapeInserter`の`place`・`asUnits`・`InsertResult.inserted`（`ShapeInserter.js:21`ほか）、`ClipboardController`の`getCanvasId`（`:97`）と`RemovalRules`の利用（`:291`）、`ShapeOrderEditor`の`apply`（`:69`）・`moveTo(ids, place)`（`:102`）、`GroupEditor`の`model`の使い方（入れ子の変更は`rearrangeItems`のみ。ほかは`getItems`・`getInsertTarget`・`getSelectedGroupIds`・`isSelected`の照会）と`resolveRemoval`（`:7`）、`ItemRenameEditor`（`beginEdit`→`renameItem`→`commitEdit`。`model`は`getItems`・`renameItem`だけ）、`ItemStateEditor`（`model`は`getItems`・`setItemStates`だけ。`#model.`の使用が`getItems`3箇所・`setItemStates`1箇所）、`ItemListWiring`の注入（`getRows`・`getUnitIds`・`shouldSelectPressedRow`・`selectRow`・`canDrop`・`applyDrop`・`applyRowDrop`・`groupEditor`・`itemStateEditor`。キャンバス切り替えでの`forgetSolo()`は`:160`）、`ItemListRowDrag`（`DragTracker`・`requestAnimationFrame`（`:171`）・`ListDragRules`をimport）、`ItemListPanel`（importなし。`onGroupToggle`・`onAddGroup`・`onStateIconClick`・`data-state-icon`が各1箇所以上、`showDropMark`の`edge`＝`before`／`after`／`inside`と`indent`（`:455-458`）。クラス`drop-before`／`drop-after`／`drop-inside`・`--drop-indent`・`insert-line-before`／`insert-line-after`・`--insert-line-indent`・`item-hidden`・`is-off`・`is-on`・`is-inherited`・`item-row-states`が`ItemListPanel.js`にある。JSDoc`:101`に「`.item-list`の子に要素を足さない」）、`ShapeExtentReader`（選択の外枠は`getEditableSelectedShapes`（`:38`ほか）・全図形の外枠は`getVisibleShapes`（`:86`））：一致。
  * `index.html`の記述：`--toolbar-height: 80px`は`:root`（`:12`）、2行の`.toolbar-row`（`:351`・`:778`）、`--item-list-width: 240px`（`:15`）、`#item-list-panel`・`.item-list-footer`・`#item-list-add-group`（`:850`）、`--canvas-area-right`・`--canvas-area-width`は`body`の規則（`:30-31`。`:root`ではない）、`body.float-windows-hidden`で`--canvas-area-right: 0px`（`:37-39`）、目と鍵の絵のデータURIのSVGは4つ（`:231`・`:236`・`:240`・`:245`）、`.item-row-states`・`.item-row-eye`・`.item-row-lock`・`.is-off`等のCSSあり、`#unit-snap-group`・`#tool-eyedropper`・`#tool-select`・`#tool-vertex`あり（4件）：一致。「`WindowManager`の対象外」は、パネルが`aside#item-list-panel`で`float-window`のクラスを持たないこと（`:850`）までを確かめた。
  * 「存在しないもの」（306行）：`CodeImporter`は`js/`で0件。`source`の無いJSの`elements`の組み立て（`DrawElementReader`）：`polyline`は直線の2点か「ほかはすべて直線区間のパス」（`DrawElementReader.js:110`）で四角を矩形へ戻さない、`ellipse`は閉じた1周を円・開いた半周を弧とし「ほかは断る」（`:183`）、フォルダ・名前は作らない：一致。オプションバーの重なり順のボタンなし（`OptionBarOrderGroup`の検索0件）。`contextmenu`は`js/`で0件、`maxlength`は`js/`で0件、一括の折りたたみ（`collapseAll`・`expandAll`）は0件。フォルダの行にサムネイルを描かない（`drawThumbnail`の呼び出しは図形の行の`row.shape`だけ。`ItemListWiring.js:485`）。ドラッグ中の自動の展開はない（`expandGroupsContaining`の呼び出しは`VectorModel.js:1292`だけ）。横の位置で深さを決める処理はない（`resolveDropPlace`が`pointerX`を範囲の判定にだけ使う。`ListDragRules.js:86-87`）。一覧の空いている所のクリックの処理は`ItemListWiring.js`・`ItemListPanel.js`にない（`空いている`・`onBlank`・`onEmpty`の検索0件）。描き込む先は`SnapshotAdapter`が保存せず今の値を残す（`SnapshotAdapter.js:79`・`:93`。`DocumentSerializer`・`SpriteSerializer`・`CanvasLibrary`の`insertTarget`は0件）。複製の入る場所は`resolveDuplicatePlace`が選んでいるまとまりの最後のもののすぐ上（`InsertTargetRules.js:155-160`）。並べ替え・コピー・複製が表示・ロックの値で止まらないこと：`ShapeOrderEditor`に`locked`・`Editable`の参照なし、`ClipboardController`の複製（`:205-212`）は`resolveRemoval`を通さず、切り取りと`Alt`+ドラッグの複製（`:283-291`）だけが`resolveRemoval`を通す：一致。`source`のキーがある今までのJSは`source`だけを読み`elements`から読まない（`FileContentReader.js:82-83`）：一致。
  * 4章の表：1002〜1021行の20行が指す`_doc/arch/46`〜`65`のファイルはすべて実在し、名前とモジュールの対応（例：`wiring/ItemListWiring.js`→`53_ItemListWiring.md`）も一致。表は全65行で、`_doc/arch/`の全65ファイルが表にあり、`js/`の全ファイルが表の行（モジュール名・`shapes/`・`palette/`・`edit/`・`io/`）に含まれる。消えた`OptionBarOrderGroup`を指す行はない。
* **推測・所見**:
  * 読み方が分かれる記述：
    * 構成図の「〜から使う」の一覧は、実際に使うモジュールの一部しか挙げていないものが多い（事実）。例：`GroupTreeRules`の項にない使い手＝`ItemStateRules`・`RemovalRules`・`SoloVisibilityRules`、`ItemPlaceRules`の項にない使い手＝`ClipboardController`・`ShapeInserter`、`GroupSelectionRules`の項にない使い手＝`InsertTargetRules`・`ClipboardController`・`ItemListWiring`、`ItemTreeRules`の項にない使い手＝`GroupTreeRules`・`GroupCollapseRules`・`GroupSelectionRules`・`InsertTargetRules`・`ItemPlaceRules`・`ItemRowRules`・`ItemStateRules`・`ListDragRules`・`RemovalRules`・`SoloVisibilityRules`・`edit/GroupEditor`。書かれた使い手に誤りが無い限り「資料にない事項がコードにある」だけなので相違とはしなかった。ただし一覧が全部と読むと誤る（読み手がどう読むかは推測）。
    * `ItemListRowDrag`の項の「判定・計算は`core/ListDragRules`・`core/ItemListRules`」：`ItemListRowDrag.js`は`ItemListRules`をimportも使いもしない（importは`DragTracker`・`ListDragRules`のみ。`canStartRowDrag`を呼ぶのは`ItemListWiring.js:224`）。行のドラッグを「始めてよいか」の判定は`ItemListRules`が持つという意味なら正しい（推測）が、`ItemListRowDrag`が`ItemListRules`を使うと読むと誤る。
  * コードのコメント：特になし（この範囲のコードのコメントに古い説明は見つけなかった）。
  * 照合できなかった主張：目と鍵のアイコンのうすさ・点線・色の見た目（CSSの値の存在までで、実ブラウザの見え方は見ていない）、「一覧の幅・行の高さは変えていない」（Phase 11-04aより前の値との差を網羅して確かめていない）、`_doc/PROJECT_MILESTONE.md`の将来の野望（読まない決まりのため）。
  * 既知の傷：本タスクの担当なし。

### タスク2: PROJECT_ARCHITECTURE 1章（フォルダ分割の方針・依存方向）と3章13.・15.、表示の小さな修正
* **調査内容**: 
  * `PROJECT_ARCHITECTURE.md` 309〜316行（1章「フォルダ分割の方針」「依存方向」。実体は309〜316行。317行以降は空行・区切り）、638〜654行（3章13.）、673〜695行（3章15.）の`+`行を、抜き出しコマンドで`[新]`・`[既存]`の文に分けて読み、`[新]`を照合した。`_doc/arch/`の5ファイル（`04_CanvasManager`・`11_WindowManager`・`20_DisplayState`・`23_RulerRenderer`・`36_DisplayWiring`）は、`git diff`の`+`行（計8行）を抜き出して照合し、ほかの行は文脈として読んだ。
  * 「依存方向」は、`js/`の全`.js`ファイルのimport文（複数行・default importを含む）を解析して「どのファイル → どのファイル：名前」の一覧（246件）を作り、資料の例外の一覧と1つずつ突き合わせた。フォルダ間の件数：`core→core` 77・`core→shapes` 6（`ShapeFactory`5・`RotationRules`1）・`edit→core` 28・`edit→shapes` 5・`edit→io` 9・`edit→edit` 6・`io→core` 5・`io→io` 6・`wiring→core` 19・`wiring→palette` 3・`wiring→edit` 1・`wiring→wiring` 1・`wiring→asset` 2・`main.js→wiring` 3。`palette/`・`asset/`・`shapes/→core` のimportは0件、`core→io/edit/palette/wiring/asset`は0件。`import()`型参照は`grep`で別に集めた。
  * 3章13.・15.は、`ShapeStyleEditor`・`StyleEyedropper`・`ShapeExtentReader`・`StylePanelRules`・`DisplayWiring`・`main.js`・`index.html`の該当行を開いて確かめた。3章の行は`[既存]`の文にも目を通し、要件2の古い形が残っていないかを見た（既知の傷2）。
* **事実（実コードの記述）**:
  * 1章 309行（`core/`の項）：`edit/`から使う`core/`の規則（`NudgeTargetRules`・`VertexHandleRules`・`StatusReadoutRules`・`ReferencePointRules`・`ScaleHandleRules`（`toScaleTransform`）・`RotationRules`（`toRotationTransform`）・`GroupTreeRules`（`pickItems`・`listGroupIds`）・`GroupSelectionRules`（`resolveSelectedUnitIds`）・`InsertTargetRules`（`resolvePastePlace`・`resolveDuplicatePlace`。`ClipboardController`）・`ItemAttributeRules`（`applyItemRename`。`ItemRenameEditor`））：一致（`edit/ClipboardController.js`・`ItemRenameEditor.js`ほかのimport文。下の(3)の一覧と同じ）。`ItemTreeRules`・`ItemAttributeRules`が`VectorModel`・`DocumentSerializer`・`SpriteSerializer`から使われる：一致（`DocumentSerializer`→`ItemTreeRules`・`ItemAttributeRules`、`SpriteSerializer`→`ItemTreeRules`・`ItemStateRules`、`VectorModel`→両方）。`ItemAttributeRules`が`ItemTreeRules`・`ShapeFactory`をimport：一致（`ItemAttributeRules.js`）。
  * 1章 309行（11-02の一覧の規則）：`ItemListRules`・`ListSelectionRules`・`ListScrollRules`のimport元は`wiring/ItemListWiring`だけ（一致）。`ThumbnailRules`のimport元は`wiring/ItemListWiring`（`ItemListWiring.js:28`）と`core/ThumbnailRenderer`（`ThumbnailRenderer.js:5`）の2つで、資料の「`ItemListWiring`だけが使う」とは食い違う（5章）。`ThumbnailRenderer`は`ThumbnailRules`だけをimport（`shapes/`はimportしない）、`createTransformed`・`draw`・`strokeWidth`だけを使う（`ThumbnailRenderer.js:5`・`:27-31`）、`wiring/ItemListWiring`から呼ぶ：一致。
  * 1章 309行（Phase 11-03）：`ListDragRules`のimport元は`wiring/ItemListRowDrag`だけ：一致。`InsertTargetRules`のimport元は`VectorModel`・`edit/ClipboardController`・`wiring/ItemListWiring`の3つで、`ItemListWiring`が呼ぶのは`resolveInsertMark`だけ（一致）。`resolveInsertMarkId`は`js/`で0件：一致。どちらも状態なし・11-04bでimportを持つ：一致（`InsertTargetRules`は4つの規則をimport）。`SelectionRules.resolveUserClickSelection`：一致（タスク1）。
  * 1章 309行（Phase 11-04a）：5ファイル（`GroupTreeRules`・`GroupSelectionRules`・`GroupCollapseRules`・`GroupCommandRules`・`ItemRowRules`）の存在と役割：一致（`itemIdOf`の定義は`GroupTreeRules.js:14`の1か所だけ。`buildItemRows`は`ItemListRules`に無く`ItemRowRules`にある。`GroupCommandRules`の公開は`canEditGroups`・`resolveFolderButtonAction`・`FOLDER_BUTTON_ACTION`）。`ItemTreeRules`が`id`を読まない：`.id`の検索0件で一致。`wrapUnits`ほかは`GroupTreeRules`にある（`:68`ほか）：一致。入れ子を変える公開の入口は`VectorModel.rearrangeItems`（`VectorModel.js:1175`）1つ。`GroupEditor`は`rearrangeItems`で入れ子を変える（`GroupEditor.js:83`・`:127`・`:146`・`:165`）、`ShapeOrderEditor`は`apply`（`:83`）・`moveTo`（`:109`）とも`rearrangeItems`を呼び、`listSiblingLists`・`mapSiblingLists`で兄弟の並びごとに動かす：一致。
  * 1章 309行（Phase 11-04b）：`ItemPlaceRules`の公開（`PLACE_KIND`・`findItemLocation`・`insertItemsAt`・`canMoveItems`・`moveItems`）：一致（タスク1）。使う側の列挙（`InsertTargetRules`・`ItemRowRules`・`ListDragRules`・`VectorModel`・`GroupEditor`・`ShapeOrderEditor`・`ItemListWiring`）は、すべて実際にimportしている（実際のimport元は上の7つに`SoloVisibilityRules`が加わる。資料に無い事項がコードにあるだけで相違ではない）。`GroupTreeRules`に足した`pickItems`・`listGroupIds`：実在（`GroupTreeRules.js:25`・`:45`）。消えた名前（`reorderShapes`・`applyOrder`・`resolveDropIndex`・`insertItemsAbove`・`hasGroupItem`・`getAvailability`）は`js/`で0件：一致。
  * 1章 309行（Phase 11-05）：`ItemStateRules`のimport元は6つ（`VectorModel`・`ItemRowRules`・`io/SpriteSerializer`・`RemovalRules`・`SoloVisibilityRules`・`edit/ItemStateEditor`）で資料の列挙と一致。`RemovalRules`は`ItemStateRules.collectEditableIds`、`SoloVisibilityRules`は`listItemStates`・`ItemPlaceRules.findItemLocation`を使う：一致（`RemovalRules.js`・`SoloVisibilityRules.js`のimport）。`GroupTreeRules`・`ItemPlaceRules`が`ItemStateRules`をimportしない：一致。`.visible`・`.locked`を直接読む箇所は`ItemStateRules`・`ItemAttributeRules`・`DocumentSerializer`のほかは、`ItemRowRules`（`ItemStateRules`の結果の写し）・`SoloVisibilityRules`（`listItemStates`の結果）・`ItemListPanel`（行の見た目）だけで、アイテムの値は読まない。`edit/`の規則の関数のimportは、`ItemStateEditor`・`GroupEditor`・`ClipboardController`だけ（`ItemStateRules`・`RemovalRules`・`SoloVisibilityRules`のimport元がこの3つ）：一致。
  * 1章 310行（`palette/`の項）：`ItemListPanel`のimportなし・`VectorModel`などを知らない：一致（`ItemListPanel.js`のimport 0件）。
  * 1章 311行（`io/`の項）：`io/`は`CanvasStorage`・`CodeExporter`・`DocumentFileIO`・`DocumentSerializer`・`DrawElementReader`・`FileContentReader`・`SpriteSerializer`の7ファイル（資料の列挙と一致）。`deserializeShapeElements`：`DocumentSerializer.js:299`。`FileContentReader`が`DocumentSerializer.deserializeShapeElements`を呼ぶ（`FileContentReader.js:88`）：一致。
  * 1章 313行（`edit/`の項）：`ShapeOrderEditor`の`getAvailability`は無く、`moveTo`は有り、`applyOrder`は無い：一致。`getShapeBounds`（`ShapeExtentReader.js:76`）：一致。`ShapeExtentReader`の生成は`DisplayWiring`の内部（`DisplayWiring.js:65`）と`main.js`の`// 4.`（`main.js:182`）の2か所。`main.js`で同じ`shapeExtentReader`を共有するのは`renderCurrentState`（`:227`）・`InputTracker`の注入（`:197`）・`PositionInputEditor`（`new`は`:753`、`shapeExtentReader`を渡す引数の行は`:756`）・`ShapeAlignEditor`（`new`と引数が同じ`:784`の1行）・`ItemListWiring`（`new`は`:951`、引数の行は`:953`）：一致。1件の編集操作の手順が規則の関数だけをimportする：`ItemRenameEditor`（`ItemAttributeRules`）・`ItemStateEditor`（`ItemStateRules`・`SoloVisibilityRules`）ほか一致（`VectorModel`・`HistoryManager`のimportは`edit/`に0件）。
  * 1章 314行（`wiring/`の項）：`ItemListWiring`が`ThumbnailRenderer`もimport（`ItemListWiring.js`の`drawThumbnail`）、`ItemListRowDrag`が`DragTracker`・`ListDragRules`をimportして`DragTracker`を生成（`ItemListRowDrag.js:5`・`:39`）、`ItemListRowDrag`を使うのは`ItemListWiring`だけ：一致。`wiring/`が`new`で作る`core/`の状態を持つ部品は`DragTracker`だけ（`wiring/`の`new`の一覧：`ShapeExtentReader`・`ViewToggleGroup`・`UnitSnapGroup`・`ItemListPanel`・`ItemListRowDrag`・`DragTracker`・`WeakMap`）：一致。`main.js`だけが`wiring/`をimport（`main.js:59-61`。ほかの`js/`のファイルから`wiring/`へのimportは0件）：一致。
  * 1章 316行（依存方向）：
    * `io/`のimportは`io/`内と`core/ShapeFactory`・`ItemTreeRules`・`ItemAttributeRules`・`ItemStateRules`（`SpriteSerializer`）だけ、`edit/`はimportしない：一致（`io→core`は5件＝`DocumentSerializer`→`ShapeFactory`・`ItemTreeRules`・`ItemAttributeRules`、`SpriteSerializer`→`ItemTreeRules`・`ItemStateRules`）。`SpriteSerializer`は`listShapes`をimportしない（`toItems`・`listVisibleShapes`）：一致。
    * `core/`から`shapes/`へのimport文は`ShapeFactory`と`RotationRules`の2ファイルだけ、`import()`型参照は`RotationRules`・`ScaleHandleRules`の2ファイルだけ：一致（`core/→shapes/`の`import()`は`RotationRules.js:211`・`:236`、`ScaleHandleRules.js:317`）。11-02以降に`core/`から`shapes/`へのimport・型参照は増えていない：一致（`ThumbnailRenderer`・`ItemTreeRules`ほかに0件）。
    * (1)`edit/ → shapes/`：`PathJoiner`・`EndpointSnapper`・`PathCornerEditor`の3ファイルだけ、importする規則も一致（`edit→shapes`は5件）。
    * (3)`edit/ → core/`の一覧：`NudgeEditor`・`PositionInputEditor`・`PathCornerEditor`→`NudgeTargetRules`、`PositionInputEditor`→`VertexHandleRules`・`ReferencePointRules`、`PositionInputRules`→`StatusReadoutRules`、`TransformInputEditor`→`NudgeTargetRules`・`ReferencePointRules`、`TransformInputRules`→`StatusReadoutRules`・`ScaleHandleRules`・`RotationRules`、`ClipboardController`→`GroupTreeRules`（`pickItems`・`listGroupIds`）・`GroupSelectionRules`・`InsertTargetRules`・`RemovalRules`、`ItemRenameEditor`→`ItemAttributeRules`、`GroupEditor`→`GroupTreeRules`（`wrapUnits`・`unwrapGroups`）・`RemovalRules`・`GroupSelectionRules`・`GroupCommandRules`（`canEditGroups`）・`ItemTreeRules`（`ITEM_KIND`）・`ItemPlaceRules`（`insertItemsAt`）、`ShapeOrderEditor`→`GroupTreeRules`（`isSameTree`・`itemIdOf`・`listSiblingLists`・`mapSiblingLists`）・`GroupSelectionRules`・`ItemPlaceRules`（`moveItems`）、`SnapshotAdapter`→`GroupCollapseRules`（`withoutCollapsed`・`listCollapsedIds`・`restoreCollapsed`）、`ItemStateEditor`→`ItemStateRules`（`resolveVisibleToggle`・`resolveLockToggle`）・`SoloVisibilityRules`（`resolveSoloToggle`）：すべて一致。`edit/`で`core/`をimportするファイルは12で、資料の「この12ファイル」と一致。`GroupEditor`は`GroupTreeRules.removeItems`をimportしない：一致（`removeItems`のimport元は`ItemPlaceRules`だけ）。importするのは`core/`の状態を持たない規則の関数のみ：一致（クラスのimportは0件）。
    * `edit/`内のimport：`ShapeStyleEditor`・`StyleEyedropper`→`StylePanelRules`、`ShapeOrderEditor`→`ShapeOrderRules`、`ShapeAlignEditor`→`ShapeAlignRules`、`PositionInputEditor`→`PositionInputRules`、`TransformInputEditor`→`TransformInputRules`の6件（`edit→edit`6件）：一致。
    * `core/`内のimportで、規則が状態を持つクラスをimportする向きは無い：一致（状態を持つクラスのimportは`InputTracker`→`DragTracker`だけ。`VectorModel`は規則をimport）。
    * 例外の一覧の過不足（`core→core` 77件）：Phase 11-01（`ItemAttributeRules`→`ItemTreeRules`・`ShapeFactory`、`VectorModel`→`ItemTreeRules`・`ItemAttributeRules`）、Phase 11-02（`ListSelectionRules`→`SelectionRules`、`ThumbnailRules`→`SpriteFitRules`、`ThumbnailRenderer`→`ThumbnailRules`）、Phase 11-03（`VectorModel`→`InsertTargetRules`。`wiring/ItemListWiring`→`wiring/ItemListRowDrag`、`ItemListRowDrag`→`DragTracker`・`ListDragRules`）、Phase 11-04a（`GroupTreeRules`・`GroupSelectionRules`・`GroupCollapseRules`・`ItemRowRules`のimport先。`GroupCommandRules`は`InputModes`だけ、`ItemListRules`は`InputModes`だけ、`ListSelectionRules`は`SelectionRules`だけ。`VectorModel`→`GroupTreeRules`（`itemIdOf`・`isSameTree`）・`GroupSelectionRules`・`GroupCollapseRules`。`ItemListWiring`→`ItemRowRules`・`GroupCommandRules`。`GroupTreeRules.hasGroupItem`のimportなし）、Phase 11-04b（`ItemPlaceRules`・`InsertTargetRules`・`ItemRowRules`→`ItemPlaceRules`・`ListDragRules`のimport先と引数の名前。`VectorModel`→`ItemPlaceRules`・`ItemListWiring`→`ItemPlaceRules`（`canMoveItems`）・`InsertTargetRules`（`resolveInsertMark`）、`ItemListRowDrag`→`ListDragRules`）、Phase 11-05（`ItemStateRules`・`RemovalRules`・`SoloVisibilityRules`・`ItemRowRules`→`ItemStateRules`のimport先と引数の名前。`VectorModel`→`ItemStateRules`・`RemovalRules`。`SpriteSerializer`→`ItemStateRules`（`listVisibleShapes`））：すべて実際のimportと一致。資料の例外の一覧にないimport（実コード側）は、`core/`の処理から規則への向き（`InputTracker`・`CanvasManager`・`RulerRenderer`・`KeyboardShortcuts`・`AltKeyGuard`→規則）と、`VectorModel`→`ShapeFactory`などの既存の向きだけ。
    * 循環の無い一方向の説明：`ItemTreeRules ← GroupTreeRules ← 上の3つ`・`ItemTreeRules ← GroupTreeRules ← ItemPlaceRules ← InsertTargetRules・ItemRowRules ← ListDragRules`・`ItemTreeRules ← GroupTreeRules ← ItemStateRules ← RemovalRules・SoloVisibilityRules・ItemRowRules`・`ItemPlaceRules ← SoloVisibilityRules`：すべて実際のimportの向きと一致し、逆向きのimportは0件。`ItemPlaceRules`は`InsertTargetRules`・`ItemRowRules`・`ListDragRules`をimportしない、`GroupTreeRules`は`ItemTreeRules`のほかをimportしない、`GroupSelectionRules`・`GroupCollapseRules`・`ItemRowRules`は互いにimportしない：一致。
    * `core/VectorModel`の`hasRemovableSelection`が`resolveRemoval`を呼ぶ：一致（`VectorModel.js:299-305`）。`edit/ItemStateEditor`の`model`は`getItems`・`setItemStates`だけ：タスク1で確認済みのため再確認していない。`GroupTreeRules.removeItems`は`edit/GroupEditor`からは使われず`ItemPlaceRules`が使う：一致（`ItemPlaceRules.js:6`・`:180`）。
    * 「`shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`のJSDocの『`model.getShapes()`の並び』は残る（実際に渡るのは`getEditableShapes()`の並び）」：JSDocは`EndpointSnapRules.js:77`・`:141`、`PathJoinRules.js:271`に残る。`EndpointSnapper`は`getEditableShapes()`を渡す（`EndpointSnapper.js:95`・`:124`・`:173`・`:220`・`:381`）：一致。`PathJoinRules.classifyJoin`（`:271`）へは`PathJoiner`が`getEditableSelectedShapes()`（`PathJoiner.js:100`）を渡す（所見に書く）。
  * 3章13.（638〜654行）：`ShapeStyleEditor`の対象は`getEditableSelectedShapes()`（`ShapeStyleEditor.js:304-305`の`#selectedShapes`）。表示の規則（変えられる図形を選んでいるときは選択中から決める、選んでいないときは直前に使った値）：`buildStylePanelView`（`StylePanelRules.js:198-205`）に`selectedShapes`が空なら`newShapeStyle`から作る分岐があり、`getPanelView`が`#selectedShapes()`を渡す（`ShapeStyleEditor.js:77`）：一致。反映の範囲：`setStrokeWidth`は変えられる図形があれば`#recordEdit`で`updateShapeStyles`、無ければ`updateNewShapeStyle`だけ（記録なし）（`:130-136`）、`applyStyle`は同じ形（`:159-191`）、`#finishPreview`だけが`getShapes()`を見る（`:334`）：一致。`applyStyle`・`resetColors`の1件の記録：一致。スポイトの手本は`getEditableShapes()`（`StyleEyedropper.js:118`）、手本が無ければ`false`を返し`stop()`しない（待ち受けは続く。`:114-124`）：一致。「対象と記録」の`#selectedShapes`＝`getEditableSelectedShapes()`：一致。
  * 3章13. 650行・651行：まとまりごとの分け方で「重なり順」のまとまり`#option-order-group`をPhase 11-03でなくした：`option-order`・`OptionBarOrderGroup`は`js/`・`index.html`で0件、一致。1行目＝🧰📁・取り消しとやり直し・削除と結合・スタイル：`index.html:778-796`の`.toolbar-group`4つ（`:779`・`:783`・`:787`・`:791`の`#option-style-group`）で一致。2行目＝位置・大きさ・変形・整列・分布・角（`:800-846`の5つ）：一致。1280px幅の見積もり約489px：`index.html:735`の式（16＋68＋68＋68＋約218＋17×3）は489になり、資料と一致。
  * 3章15.（673〜695行）：674〜679行付近：`resizeAndRenderViews`を`main.js`が`new DisplayWiring`（`main.js:412`）の後に`displayState.onChange(resizeAndRenderViews)`で登録（`:415`）、`onChange`は登録順に呼ぶ（`DisplayState`の契約。`20_DisplayState.md`の契約の記述と同じ）：一致。キャンバスの領域の大きさの同期（`canvasManager.resize()`・`rulerRenderer.resize()`・再描画。`main.js:278-283`）：一致。
  * 3章15. 679〜681行：選択中の変えられる図形の大きさは`ShapeExtentReader.getSelectedBounds()`（`:37-39`）が`SpriteSerializer.computeShapesBounds`を使い、`DisplayWiring.js:137`が呼ぶ：一致。一覧のパネル`#item-list-panel`は`aside`で`.float-window`ではない（`index.html:850`）。`body.float-windows-hidden .item-list-panel`は`visibility: hidden`（`index.html:276-277`。コメントに「`display: none`にしない（スクロール位置が失われるブラウザがあるため）。…マウスの操作も受けない」）：一致。`--canvas-area-right`は`body.float-windows-hidden`で`0px`（`:37-38`）、通常は`--item-list-width`（`:30`）：一致。⛶・`Ctrl`+`0`・🎯・`Ctrl`+`+`/`-`が`canvas.clientWidth / 2`等を使う：`resetViewToCenter`（`main.js:320`。`Ctrl`+`0`・🎯・⛶の`resetView`の経路）、`main.js:978`（`Ctrl`+`+`/`-`）、`DisplayWiring.js:191`（⛶）で一致。キャンバスパレットの既定の位置`right: calc(var(--item-list-width) + var(--float-window-margin))`：`index.html:581`で一致。⛶→`#fitViewToShapes`→`ShapeExtentReader.getAllBounds()`→`getVisibleShapes()`（`ShapeExtentReader.js:85-86`）：一致。見えている図形は「隠れていないもの。ロックは含む」（`ItemStateRules.listVisibleShapes`＝`!state.hidden`のみ。`:69-73`）：一致。図形0個は`computeFitView`が`null`を受けて表示のリセットと同じ結果（`ViewFitRules.js:23`・`:35`）：一致。
  * 3章15. 694行：`ShapeExtentReader`の選択の外枠3つ（`getSelectedBounds`・`getSelectedBoundsPerShape`・`getSelectedGeometryBounds`）は`getEditableSelectedShapes()`から求める（`:37-38`・`:47-48`・`:62`）、`getAllBounds`は`getVisibleShapes()`：一致。`DisplayWiring`は照会の結果を使うだけ：一致（`DisplayWiring.js:137`・`:190`）。ステータスバーの「大きさ」は選んでいる中の変えられる図形、⛶は見えている図形：一致。
  * 既知の傷2（3章13.（638〜654行）・15.（673〜695行）の各行を`sed -n '<行>p'`で1行ずつ読み直した結果）：要件2の古い形が「今もそうである」と読める形で残っていたのは2件で、5章へ挙げた。(a) 673行（15.の1行目）の「作業データの版・書き出し形式の版は2のまま」（版。実コードは`DocumentSerializer.js:21`・`SpriteSerializer.js:21`とも4）。(b) 685行の「すべての図形…の輪郭を…描く」（表示・ロック。隠れた図形は描かれない。`main.js:220`）。このほか、重なり順（650行の`#option-order-group`はPhase 11-03でなくしたと書かれ`OptionBarOrderGroup`は`js/`・`index.html`で0件、641行の「重なり順で最も手前の図形の色」は図形の並びの意味）・新しく入る場所・フォルダ・書き出し（15.に書き出しの記述なし。673行の「書き出し」は表示の状態を入れないという文）・消えた関数（`drawHandles`は675行に「消した」と明記）・行数（13.・15.に行数の記述なし）・`getShapes()`が全部と読める記述（`#finishPreview`だけが`getShapes()`を見ると653行に明記。`ShapeStyleEditor.js:334`と一致）・「`Ctrl`+`A`は全図形」・「表示・ロックは効かせない」は、残っていなかった。
  * `_doc/arch/04_CanvasManager.md`：`resize()`の呼び出し元が`main.js`の`resizeAndRenderViews()`で、呼ぶのはウィンドウリサイズ時と一覧のパネルの出し入れでの`displayState.onChange`（`main.js:278-284`・`:415`）：一致。`render()`を呼ばない（`resize()`自体は再描画しない。再描画は`resizeAndRenderViews`の`renderCurrentState()`）：一致。初期表示・ビューのリセット時は`main.js`の`resetViewToCenter`で原点がキャンバス要素の中央（`main.js:319-321`）、ウィンドウの大きさの変更には追従しない（`resizeAndRenderViews`はビュー変換に触れない。`main.js:276`のコメント）：一致。`resetViewToCenter`の呼び出し元（`main.js:325`・`:598`・`:1032`）：起動時の復元・開く・新規作成の経路を、`:590-598`の注入と`:1032`の呼び出しで確認した（それぞれの経路の個別の確認はしていない）。
  * `_doc/arch/11_WindowManager.md`：`#item-list-panel`は`aside`で`.float-window`ではない（`index.html:850`）：一致。`z-index`：一覧のパネル`8`（`index.html:51`）・定規`8`（`:306`・`:317`）・`.float-window`は`10`（`:435`）で、「フロートウィンドウ（10以上）はツールバー・ステータスバー・一覧のパネル（8）の上」：一致。`WindowManager`のコンストラクタが`.float-window`だけを扱うこと：`main.js:287`の`new WindowManager()`のみ（クラス名の検索は`WindowManager.js`の`.float-window`）。
  * `_doc/arch/20_DisplayState.md`：`main.js`が`new DisplayWiring`の直後に`resizeAndRenderViews`を登録（`main.js:412`・`:415`）、`wiring/ItemListWiring`が`displayState.onChange`を登録しパネルが隠れたとき自分のホバーを消す（`ItemListWiring.js:170-175`。行のドラッグも取りやめる）：一致。`floatWindowsVisible`が偽のとき一覧のパネルも隠れる（`body`のクラス`float-windows-hidden`。`DisplayWiring.js:178`・`index.html:276`）、`DisplayState`は一覧を知らない（`DisplayState`のimportは0件）：一致。
  * `_doc/arch/23_RulerRenderer.md`：呼び出し元は`main.js`の`renderRulers()`（`main.js:258`）と`resizeAndRenderViews()`（`rulerRenderer.resize()`。`:280`）で、後者は`window`の`resize`（`:284`）と`displayState.onChange`（`:415`）から：一致。横の定規の幅が`--canvas-area-width`に追従する（`index.html:31`。`.ruler`の幅の指定はCSS）：変数の定義までを確かめた。
  * `_doc/arch/36_DisplayWiring.md`：`#syncFloatWindowVisibility`が`body`のクラス`float-windows-hidden`を付け外し（`DisplayWiring.js:178`）、一覧のパネルが`visibility: hidden`（`index.html:277`）、`--canvas-area-right`が変わる（`:37-38`）、`main.js`が`new DisplayWiring`の直後に`displayState.onChange(resizeAndRenderViews)`を登録（`main.js:412`・`:415`）：一致。「新しい表示の状態・同期関数は足していない」：`DisplayWiring`の同期関数は`#syncCursorReadout`・`#syncSelectionSizeReadout`・`#syncGridSizeReadout`・`#syncViewToggleGroup`・`#syncUnitSnapGroup`・`#syncFloatWindowVisibility`の6つで、10行の記述と一致（コードの履歴にある「JSDocの文言だけを直した」は照合できず）。表示・ロックとの関係：`#syncSelectionSizeReadout`が`getSelectedBounds()`（`DisplayWiring.js:137`）、`#fitViewToShapes`が`getAllBounds()`（`:190`）、前者は`getEditableSelectedShapes()`、後者は`getVisibleShapes()`で、すべて隠れていれば`null`（`SpriteSerializer.computeShapesBounds`は図形0個で`null`。`:325`のJSDoc）：一致。「変えられないものだけを選んでいるときは空」＝`getEditableSelectedShapes()`が空になり`computeShapesBounds([])`が`null`を返す：一致。
* **推測・所見**:
  * 読み方が分かれる記述：
    * 1章 309行（Phase 11-03）「描き込む先の規則`InsertTargetRules`（`VectorModel`が唯一の持ち主として呼ぶ。`wiring/ItemListWiring`は印の規則`resolveInsertMark`だけを呼ぶ…）」：`InsertTargetRules`のimport元は`VectorModel`・`edit/ClipboardController`（`resolvePastePlace`・`resolveDuplicatePlace`）・`wiring/ItemListWiring`の3つ（事実）。同じ行の前半（`edit/`からは…`InsertTargetRules`（`resolvePastePlace`・`resolveDuplicatePlace`）（いずれも`ClipboardController`））と、依存方向(3)には`ClipboardController`が書かれている。「唯一の持ち主」は「描き込む先の状態を持ち、決め方の規則（`resolveNextInsertTarget`ほか）を呼ぶのは`VectorModel`だけ」の意味なら一致（推測）。`InsertTargetRules`の関数を呼ぶのが`VectorModel`だけと読むと、`ClipboardController`が抜ける。
    * 1章 316行 依存方向の「**例外（Phase 11-02）**：規則どうしの`ItemListRules → ItemTreeRules`・`InputModes`」：`ItemListRules`は今は`InputModes`だけをimportし、`ItemTreeRules`はimportしない（`ItemListRules.js:5`。タスク1の5章の相違と同じ事実）。この例外の文は「Phase 11-02」の時点の状態として書かれ、同じ段落の後ろ（`Phase 11-04a`の例外）に「`ItemListRules`は`buildItemRows`を手放し`InputModes`だけをimportする（`ItemTreeRules`のimportをやめた）」とある。Phase名の付いた経緯の文と読めば相違ではない（推測）が、11-02の例外の文の中に今の状態へ直す印は無い。5章には入れなかった（タスク1の1章 57行は、Phase名の無い現在形の文だったため5章に入れた）。
    * 1章 316行末尾の文（`shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`の「`model.getShapes()`の並び」は残る。実際に渡るのは`getEditableShapes()`の並び）：`EndpointSnapRules`の2関数へは`getEditableShapes()`の並びが渡る（一致）が、`PathJoinRules.classifyJoin`（`:271`）へは`PathJoiner`が`getEditableSelectedShapes()`（選択中の変えられる図形）を渡す（`PathJoiner.js:100`）。選択中の変えられる図形も重なり順で並ぶ`getEditableShapes()`の部分列のため、「並び」の意味としては成り立つ（推測）。
  * コードのコメント：特になし（この範囲のコードのコメントに古い説明は見つけなかった）。
  * 照合できなかった主張：実ブラウザでの「一覧のパネルを隠したときスクロール位置を失うブラウザがある」（ブラウザの挙動。コード側は`visibility: hidden`のCSSがあることまで）、`36_DisplayWiring.md`の「（コードはJSDocの文言だけを直した）」（過去の変更の記述。`git show`で当時の差分は確かめていない）、`36_DisplayWiring.md`・`20_DisplayState.md`の「`main.js`の行数は1018行から888行へ」など過去の値の記述（差分の`+`行でないため対象外）、「発注者のテストプレイ：全項目OK」（実際の操作の結果）。`resetViewToCenter`が起動時の復元・開く・新規作成の各経路から呼ばれることは、呼び出しの経路を1つずつは追っていない。
  * 既知の傷：2（3章13.・15.の対象の行）は上の「既知の傷2」のとおり、2件（673行の版・685行のアウトライン表示の対象）を5章へ挙げた。3〜6はこのタスクの担当外。
  * 資料に無いが目に入った点（相違ではない）：`36_DisplayWiring.md`の`[既存]`の「import」の行は`core/ViewTransform`（`MIN_SCALE`・`MAX_SCALE`）と書くが、実コードは`import { ViewTransform }`で、`MIN_SCALE`・`MAX_SCALE`は`ViewTransform.MIN_SCALE`・`ViewTransform.MAX_SCALE`の静的メンバとして使う（`DisplayWiring.js:10`・`:193`）。名前の読み方の違いで、importされるのは`ViewTransform`クラス1つ。差分のない行のため相違には入れていない。

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
* （タスク1）**（`PROJECT_ARCHITECTURE.md` 1章の構成図 57行 `ItemTreeRules.js` の項）**： 「VectorModel・io/DocumentSerializer・io/SpriteSerializer・ItemAttributeRules・ItemListRulesから使う」 → `ItemListRules`は`ItemTreeRules`をimportしていない（`js/core/ItemListRules.js:3`に「importは`InputModes`だけ」、`:5`のimportも`InputModes`のみ）。同じ資料の59行にも「Phase 11-04aで…importの`ItemTreeRules`をやめた」とあり、57行と矛盾している。
* （タスク2）**（`PROJECT_ARCHITECTURE.md` 3章15. 673行 表示の1行目）**： 「表示の状態は作業データ・書き出し・履歴・ブラウザの保存先のいずれにも入れない（作業データの版・書き出し形式の版は2のまま）」（`[既存]`の文） → 作業データの版は`js/io/DocumentSerializer.js:21`が`CURRENT_DOCUMENT_VERSION = 4`、書き出し形式の版は`js/io/SpriteSerializer.js:21`が`SPRITE_FORMAT_VERSION = 4`で、「2のまま」は今の値と異なる（要件2の「版」の古い形）。
* （タスク2）**（`PROJECT_ARCHITECTURE.md` 1章 309行 Phase 11-02の文）**： 「`ItemListRules`・`ListSelectionRules`・`ListScrollRules`・`ThumbnailRules`は`wiring/ItemListWiring`だけが使う」 → `ThumbnailRules`のimport元は`wiring/ItemListWiring`（`js/wiring/ItemListWiring.js:28`）のほかに`core/ThumbnailRenderer`（`js/core/ThumbnailRenderer.js:5`）がある（importで真偽が決まる主張）。直後の文には「`ThumbnailRenderer`は…`ThumbnailRules`をimportする」と書かれており、資料の中でも食い違う。ほかの3つ（`ItemListRules`・`ListSelectionRules`・`ListScrollRules`）は`wiring/ItemListWiring`だけで一致。
* （タスク2）**（`PROJECT_ARCHITECTURE.md` 3章15. 685行 発注者の決定「アウトライン表示の見え方」。`[既存]`の文）**： 「ONの間、すべての図形（線なしの図形・塗りだけの図形・何も描かれない図形を含む）の輪郭を…描く」 → 描く図形は`renderCurrentState`が`model.getVisibleShapes()`で取る（`js/main.js:220`）ため、隠れた図形は輪郭も描かれない。要件2の「表示・ロック」の変化の前の形が今もそうであると読める形で残っている（括弧内は線・塗りの有無の話で、隠れた図形には触れていない）。

## 6. 懸念事項・今後の修正における注意点
* （タスク19で、「読み方が分かれる記述」「コードのコメント」「照合できなかった主張」の一覧を記載する）
