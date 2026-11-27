# RES: 調査計画・調査レポート Survey : Phase 12 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261127_2020_REQ_Survey_Phase12_Doc_Consistency.md`

## 1. 調査目的
Phase 11 のクローズ後の Interrupt（WEBアイコン、`261126_1200`）と Phase 12「パスの編集」の各サブフェイズ（12-01〜12-05）の最終タスクで開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）へ反映された記述が、現在の `HEAD` の実コードの事実と食い違っていないかを確かめる。各作業の反映時点ではその作業の差分監査に合格しているため、特に **後の作業のコード変更によって、前の作業で書いた記述が古くなっていないか** を重点的に見る。例：
* 12-01で書いた点の追加・削除の対象・集め方が、12-02の`VertexTargetRules`への括り出しの後も成り立つか。
* 12-01・12-02で書いた「閉じる」「結合のボタンが押せる条件」「端点への吸い付き」の記述が、12-03の吸い付くだけの追加の後も成り立つか。
* 12-01〜12-03で書いた描画・当たり判定・スタイル・書き出しの流れや「塗れるのは`rect`・`circle`・閉じた`path`のみ」「共通メソッド契約は18」「作業データ・書き出し形式の版4」が、12-04の複合パスの後も成り立つか。
* 12-04で書いた「版5の連絡は次のサブフェイズ」が、12-05の後に残っていないか。

本Surveyは調査のみを行い、ソースコードおよび資料ファイルを一切変更しない（変更してよいのは本RESファイルだけ）。

計画立案時の実測（`wc -l`、`HEAD` = `4771beb`）：`js/main.js` 1305行・`js/core/InputTracker.js` 2126行・`js/core/VectorModel.js` 1513行・`index.html` 975行。`git diff 5493428 HEAD -- PROJECT_ARCHITECTURE.md _doc/arch` は空（`5493428` より後に資料の変更なし。資料の現在の行番号は `5493428` の行番号と同じ）。

## 2. 調査要件
### 要件1: 差分で追加・変更された記述の照合
【調査範囲】の差分の `+` 行に書かれた事実の主張（新しく足された文・書き換えられた文）を、1つずつ現在の `HEAD` の実コードと照合する。対象の取得方法・照合する主張の種類・照合しないものは『参照する責務』のA・Bに示す。

### 要件2: Phase 12 で変わった・広がった・なくなったものが、資料に古い形のまま残っていないか
Phase 12 のコード変更で変わった・広がった・なくなったものが、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）に「今もそうである」と読める形で残っていないかを、名前・語の検索で確かめる。検索する項目と判定の基準は『参照する責務』のCに示す。

### 要件3: 照合の結果の整理
照合した主張と結果を4章の各タスクの欄へ、相違を5章へ、あいまいな記述・コードのコメント・照合できなかった主張を4章の「推測・所見」へ書く。書き方と既知の傷は『参照する責務』のD・Eに示す。

### 参照する責務
本節は、以後のタスク実行チャットが従う手順と判定の基準である（タスク実行チャットはREQを読まないため、REQの要件1〜3の基準をここに漏らさず写している）。**資料の記述そのものはここに書き写さない。照合の対象は資料の原文そのものであり、必ず資料のファイルを開いて読むこと。**

#### A. 照合の対象を取得する方法
* **照合の対象とする記述**：次の差分の `+` 行（Phase 11 のクローズの資料の整理のコミット `c30239d` から、Phase 12 の最後のサブフェイズの完了のコミット `5493428` まで）。
  * `git diff c30239d 5493428 -- PROJECT_ARCHITECTURE.md _doc/arch`
  * 対象は33ファイル：`PROJECT_ARCHITECTURE.md` と `_doc/arch/` の32ファイル（変更の`01`〜`04`・`06`〜`08`・`10`・`12`〜`18`・`30`・`32`・`41`・`46`・`47`・`52`・`53`・`59`〜`63`と、新設の`66`〜`70`）。
* **タスクごとの対象の絞り方**：
  * 自分のタスクの資料ファイルについて `git diff -U0 c30239d 5493428 -- <ファイル>` を実行する。ハンクの見出し `@@ -a,b +c,d @@` の `+c,d` が現在のファイルでの行番号（c行目から d行。d省略は1行）。
  * `PROJECT_ARCHITECTURE.md` は、3章のタスクリストで指定した**現在のファイルでの行の範囲に入るハンクだけ**を扱う。範囲の外のハンクは他のタスクの担当なので照合しない。
  * `_doc/arch/` のファイルは、指定されたファイルの全ハンクを扱う。
* **文の単位の違いの見分け方**：`-` 行と `+` 行を「。」などの区切りで文に分けて比べ、`-` 行にそのまま同じ文がある文は照合しない。補助として、文の単位の差分を次のコマンドで見られる（`{+…+}` が足された文、`[-…-]` が消えた文）。表示は補助であり、判定は必ず資料のファイルの原文を開いて行う。
  * `git diff -U0 --word-diff=plain --word-diff-regex='[^。]+。?' c30239d 5493428 -- <ファイル>`
* **照合に使う実コード**：現在の作業ツリー（`HEAD`）の `./index.html`、`./sprite-check.html`、`./js/` 配下、`./test/` 配下、`./asset/` 配下。Phase 12 で変更されたコードの一覧は `git diff --stat c30239d HEAD -- js index.html test asset sprite-check.html`（名前と種別は `--name-status`）。これ以外のファイルも、記述の照合に必要なら読んでよい。
* **経緯の確認**：資料の記述の経緯を確かめる必要が生じた場合にのみ、次の作業レポートの該当箇所だけを参照してよい（全文は読まない）：`./_log/res/261126_1200_RES_Interrupt_Web_Icon.md`・`./_log/res/261126_1751_RES_Phase12-01_Vertex_Add_Delete.md`・`./_log/res/261126_2112_RES_Phase12-02_Split_Segment_Delete_Close.md`・`./_log/res/261127_0046_RES_Phase12-03_Vertex_Snap.md`・`./_log/res/261127_1119_RES_Phase12-04_Compound_Path.md`・`./_log/res/261127_1807_RES_Phase12-05_Engine_Roundtrip.md`。
* **対象外**：差分の `+` 行以外の資料の記述（要件2の検索で見つかった箇所と、既知の傷を除く）、`_doc/` の他のファイル（`COWORK_STATUS.md`・`COWORK_HANDOFF.md`・`PROJECT_AI_WORKFLOW.md`・`PROJECT_MILESTONE.md` 等）、`_log/dir/` 配下、本リポジトリの外のファイル（OZ Engine のリポジトリのファイルは読まない・変更しない）。

#### B. 照合する主張の種類と、照合しないもの（要件1の基準）
* **1行の中の一部だけが変わった行**（`-` 行と `+` 行の対になる長い行）では、`-` 行にそのまま同じ文がある文は照合しなくてよい（前のPhaseのクローズで照合済み。要件2の検索で拾う）。新しく足された文・書き換えられた文だけを照合する。
* 照合するのは、コードで真偽を確かめられる次のような主張である：
  * ファイル・フォルダの存在と配置（1章のフォルダ構成図。Phase 12 で新設された`js/`・`test/`のファイルと、`asset/icon/`の4つのPNGを含む。「存在しないもの」として書かれたものが実際に無いことを含む）
  * import の有無・向き（1章「依存方向」とその例外、`_doc/arch/` 各ファイルの「importは〜のみ」「使う側」「呼び出し元」「知らないこと」のうちimportで確かめられるもの。新設の`core/`・`shapes/`・`edit/`・`palette/`のファイルと、`io → core`の規則のimport（`CompoundPathRules`）の向きを含む）
  * 公開メソッド・公開の関数・定数・typedef・列挙の一覧と値・引数・戻り値（新設の`core/VertexEditRules`・`VertexTargetRules`・`VertexDragRules`・`CompoundPathRules`・`CompoundPathRenderer`、`shapes/PathVertexRules`・`PathSplitRules`・`VertexSnapRules`、`edit/PathVertexEditor`・`PathSplitEditor`・`CompoundPathEditor`、`palette/OptionBarSplitGroup`と、変わった図形クラス・`PathJoinRules`・`EndpointSnapRules`・`VectorModel`・`InputTracker`・`PointHitRules`・`ShapeStyleEditor`・`StyleEyedropper`・`GroupCommandRules`・`ItemRowRules`・`ItemListPanel`・`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`・`DrawElementReader`・`FileContentReader`等の公開物）
  * 共通メソッド契約の数（20）と一覧・順番
  * アイテム・作業データ・書き出し形式の形（フォルダの`compound`、作業データの版5と`migrateVersion4To5`、要素のキー順、書き出し形式の版5、描画要素`compoundPath`のキー順と`outlines`、`checkFormat`の受理する版、`compoundPath`から複合パスのフォルダへの組み立て、読み飛ばしの記録）
  * 状態の持ち主・初期値・通知（頂点の選択、吸い付きの作業用フィールド、ダブルクリックの抑止、保存しない・履歴に入れないと書かれたもの、`onChange`の購読先）
  * 既定値・条件（点を足す・消す・分割・区間を消す・閉じる・結合のボタンが押せる条件、吸い付く先・距離・`Ctrl`の扱い、複合パスのボタンが押せる条件、中の図形の集め方・一番下の図形の決め方、塗られた所・穴の当たりの規則、スタイル・スポイトの読み替え先）
  * 呼び出し元・呼び出し順・記録の時点（3章の流れ・履歴の単位・中断したときの戻し）
  * `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先・行数）
  * `InputTracker` の記述（`_doc/arch/06_InputTracker.md`。行数、公開メソッド、入力の補助、修飾キーの項、ダブルクリック・吸い付きの項）
  * `KeyboardShortcuts` のキーの対応表（`_doc/arch/07_KeyboardShortcuts.md`）
  * 数値（行数：`main.js`・`InputTracker.js`・`VectorModel.js`・`index.html` 等、資料に書かれた行数すべて。過去の時点の値として書かれたものは現在の値と区別し、`git show <コミット>:<パス> | wc -l` で確かめられる範囲で確かめる）。行数は `wc -l` 等で実測し、資料の値と並べて記載する。
  * `index.html` の要素・属性・クラス・CSS変数・幅の見積もりのコメント（`_doc/arch/01_index_html.md`。分割のまとまり、一覧の下端の「複合パス」ボタン、複合パスのフォルダの絵、WEBアイコンの`<link>`）
  * 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在と数、テストの内容の記述が実際のテストケースと合っているか、テストの件数、「テストできない箇所」の一覧、書き方の決まりの例外、既存のテストで版の数字だけを直したものの記述）。テストの件数は、プロジェクトのルートで `node --test` を実行して確かめてよい（ファイルを書き換えない実行に限る）。
* 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲だけを照合し、方針そのものの是非は扱わない。
* 実際のブラウザでの見え方・実測値・テストプレイの結果についての記述は、コード（CSSの値・要素の並び）から確かめられる範囲だけを照合し、残りは「照合できなかった主張」として理由を書く。
* 本リポジトリの外についての記述（OZ Engineなど）は「照合できなかった主張」とする。
* 資料に書かれていない事項がコードに存在することは相違とみなさない。

#### C. 要件2の検索の基準（タスク12・13が使う）
* 次の変化が、資料に「今もそうである」と読める形で残っていないかを確かめる。
  * **点の追加・削除**（12-01）：「頂点の選択（`A`）で`Delete`・`Backspace`は何もしない」「頂点の選択のとき削除ボタンは押せる見た目のまま」「点を足す・消す操作は無い」「キャンバスのダブルクリックは何もしない」と読める記述。
  * **分割・区間の削除・閉じる**（12-02）：「パスを分割できない」「区間を消せない」「閉じるは`'path'`だけが対象」「弧は閉じられない」「頂点3つで両端が重なった開いた線でも結合のボタンが押せる」と読める記述。
  * **頂点への吸い付き**（12-03）：「吸い付くのは結合できる線の端点だけ」「ほかの図形の頂点には吸い付かない」「吸い付きの照会の結果は結合と1対1」と読める記述。
  * **複合パス**（12-04）：「複合パスは無い」「1つのフォルダ・図形で穴は作れない」「フォルダの役割（穴）は無い」「塗るのは`nonzero`だけ」「共通メソッド契約は18」「作業データの現行版は4」「`MIGRATIONS`は`{1, 2, 3}`」「書き出し形式は版4」「`checkFormat`は版1〜4を受理」「描画要素の`kind`は4種類」と読める記述。
  * **エンジンへの連絡**（12-05）：「版5は未連絡」「版5の連絡は次のサブフェイズ」と読める記述。
  * **WEBアイコン**（Interrupt `261126_1200`）：「`asset/`には`sprite/`だけ」と読める記述。
  * **使われ方の変わったメソッド**：Phase 12-01・12-02で再び製品コードから使われるようになった`VectorModel.deleteShapes`（「製品コードから呼ばれない」「呼び出し元は無い」と書かれていないか）。Phase 12-02で`core/VertexTargetRules`に括った、頂点の選択から対象を集める手順（`PathCornerEditor`・`PathVertexEditor`の写しとして書かれていないか）。
  * **行数**：`InputTracker.js` 2126行・`main.js` 1305行・`VectorModel.js` 1513行・`index.html` 975行（タスクの最初に `wc -l` で実測し直す）。
  * **数え方**：`_doc/arch/16_test.md` の例外のファイルの数、`PROJECT_ARCHITECTURE.md` の「`edit/ → core/`のファイル数」など、列挙と数を併記している箇所（現在の実数と、後の項の言い方が矛盾していないか）。
* 洗い出しは `git diff --name-status c30239d HEAD -- js index.html test asset sprite-check.html` と【A】の差分の `-` 行で行い、**現在の実コードの事実**を確かめたうえで、現在の `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（差分のない行・差分のないファイルを含む）を `Grep` 等で検索する。
* 差分のない行については、名前・語の検索で見つかった箇所だけを扱う（差分のない行の記述全体の照合は行わない）。
* 「Phase 11 では」「Phase 12-01 の時点では」「当時の値」「版4のまま（当時）」のように経緯・過去の状態として正しく書かれているものは相違としない。
* 検索で見つかった箇所が【A】の差分の `+` 行（要件1のタスク1〜11の担当範囲）の中にある場合も、相違なら5章に挙げ、末尾に「（`+`行。タスクNの範囲）」と添える（タスクの対応は【F】の表で引く）。

#### D. 結果の書き方（要件3。各タスク共通）
* 実コードから読み取れる事実のみを抽出し、推測を含める場合はどこまでが事実でどこからが推測かを明示して、4章の自分のタスクの欄の「事実（実コードの記述）」「推測・所見」にそれぞれ記載する。
* 照合した主張と結果を、資料のファイル（節）ごとにまとめる。照合済みで一致したものは「一致」と短く書けばよいが、**確かめたコードの場所（`ファイル:行`、または検索した語と件数）を必ず添える**。照合できなかった主張があれば、その理由を書く。
* 相違の判定は、資料の原文とコードの該当行を両方開いて行う（記憶・要約・RESの記述だけで一致と判定しない）。
* 資料の記述と実コードに相違があった場合は、5章に、タスク番号を添えて「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で記載する（作業は中断しない）。
* 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものは、4章の自分のタスクの「推測・所見」に「読み方が分かれる記述」と付けて記載する（5章には入れない）。
* 調査の中で、コードのコメント・JSDoc・テストの題に古い説明を見つけた場合は、5章ではなく4章の「推測・所見」に「コードのコメント」と付けて書く（探しに行く必要はない）。
* 照合できなかった主張は、4章の「推測・所見」に「照合できなかった主張」と付けて理由とともに書く。
* タスクの終わりに、`git status` でソースコードおよび資料ファイルを一切変更していないことを確認する（変更があってよいのは本RESファイルだけ）。結果を4章の自分のタスクの欄に記載し、3章の自分のタスクを `[x]` にする。

#### E. 既知の傷（現場設計セッションが把握しているもの。担当のタスクで確かめる）
確認漏れと区別するため、担当のタスクで必ず確かめる。1は資料側で、実際に食い違っていれば5章へ必ず挙げる。2〜5はコード側で、今も残っているかだけを4章の「推測・所見」に「コードのコメント」として書く。
1. `_doc/arch/16_test.md` の以前のPhaseの項に残る古い記述（版の数字・テストの件数など。経緯として正しく書かれているものは相違としない）。（担当：タスク8）
2. `js/core/VectorModel.js` の `replaceShape`・`addShapesWithNewIds` のJSDocの「呼び出し側が選択モードであること」（不変条件は「選択モード・頂点の選択モード以外では空」）。（担当：タスク2）
3. `test/io/SpriteSerializer.items.test.js`（139行付近）のテストの題名「作業データは版4」（確かめている値は5）。（担当：タスク8）
4. `js/io/DrawElementReader.js` の、Phase 12-04で足したメソッドの前の空行の抜け。（担当：タスク11）
5. Phase 11 のクローズで残したコードのコメント（`js/main.js` 188・211行付近、`js/core/InputTracker.js` 141行付近、`js/core/ScaleHandleRules.js` 125行付近。外枠の対象の説明が古い。行の位置はその後ずれている可能性がある）。（担当：`main.js`の分はタスク9、`InputTracker.js`・`ScaleHandleRules.js`の分はタスク10）

#### F. 読んでよい資料と、資料の範囲とタスクの対応
* 各タスク実行チャットは、3章で自分のタスクの対象として指定された資料のファイル・節（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）を読んでよい。タスク12・13は要件2の検索のため、`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイルを検索し、見つかった箇所の前後を読んでよい。`_doc/` の他のファイルは読まない。
* `PROJECT_ARCHITECTURE.md` の行の範囲（現在のファイル）とタスク：1〜14行（`+`行なし）／15〜368行（1章）＝タスク1／369〜521行（2章）＝タスク2／522〜718行（3章の冒頭・1.〜12.）＝タスク3／719〜1034行（3章13.〜28.）＝タスク4／1035〜1065行（3章29.〜31.）＝タスク5／1066〜1140行（4章）＝タスク2。
* `_doc/arch/` のファイルとタスク：`03`・`04`＝タスク2／`08`・`10`・`46`・`47`・`52`・`53`・`59`〜`63`＝タスク4／`12`＝タスク6／`14`・`67`＝タスク7／`16`＝タスク8／`01`・`02`・`13`＝タスク9／`06`・`07`・`18`・`30`・`32`・`41`・`66`・`68`＝タスク10／`15`・`17`・`69`・`70`＝タスク11。

## 3. タスクリスト
（各タスクの「新しい・変わった文」の字数は、計画立案時に `-` 行と同じ文を除いて数えた概算。各タスクは互いに独立に実行でき、前のタスクの結果を読まなくてよい。全タスク共通で『参照する責務』のA〜Fに従う。）

* [ ] タスク1: `PROJECT_ARCHITECTURE.md` 1章（フォルダ構成図・「存在しないもの」・「フォルダ分割の方針」・「依存方向」）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合対象）1章「1. プロジェクトフォルダ構造」15〜368行のハンク（構成図 15〜354行、「存在しないもの」355行、「フォルダ分割の方針」357行〜、「依存方向」365行付近）。新しい・変わった文 約1.8万字（うち355行・365行の2行で約0.65万字）
    * `./js/`・`./test/`・`./asset/` のフォルダとファイルの一覧（`ls`・`Glob`）、`./js/` 配下の各ファイルの `import` 文（`Grep "^import"`）:（照合に使うコード）
  * **調査内容**:
    * 構成図の `+` 行に書かれたファイル・フォルダ（Phase 12 で新設の `js/`・`test/` のファイル、`asset/icon/` の4つのPNG）の存在と配置、各ファイルの責務の短い説明のうちコードの先頭の責務定義・公開物で確かめられるもの。
    * 「存在しないもの」として新たに書かれたものが実際に無いこと。
    * 「フォルダ分割の方針」「依存方向」とその例外の `+` 部分（`io → core` の `CompoundPathRules`、新設の `core/`・`shapes/`・`edit/`・`palette/` のファイルの import の向き、列挙と数の併記）を import 文で照合する。

* [ ] タスク2: `PROJECT_ARCHITECTURE.md` 2章・4章と `_doc/arch/03_VectorModel.md`・`04_CanvasManager.md` の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合対象）2章「2. データ構造（Model）の概要」369〜521行のハンク（約0.97万字）と、4章「4. 各モジュールの責務リファレンス」1066〜1140行のハンク（約0.03万字）
    * `./_doc/arch/03_VectorModel.md` :（照合対象）全ハンク（現在の 2-3, 9-12, 21, 26 行。約0.36万字）
    * `./_doc/arch/04_CanvasManager.md` :（照合対象）全ハンク（現在の 2, 4-5 行。約0.17万字）
    * `./js/core/VectorModel.js`・`./js/core/CanvasManager.js`・`./js/core/CompoundPathRules.js`・`./js/core/ItemTreeRules.js`・`./js/io/DocumentSerializer.js`・`./js/io/SpriteSerializer.js`・`./js/io/DrawElementReader.js`・`./js/shapes/ShapeGeometry.js` ほか記述が指すファイル :（照合に使うコード）
  * **調査内容**:
    * 2章の `+` 部分（図形・アイテム（フォルダの`compound`）・図形データ・作業データ形式（版5・`migrateVersion4To5`・要素のキー順）・スプライト（書き出し形式の版5・`compoundPath`）・エンジンとの約束・開くときの規則・選択状態・吸い付きの表示の点などの状態の持ち主・初期値）を照合する。
    * 4章の `+` 部分を照合する。
    * `03`・`04` の公開メソッド・引数・既定値・状態・描画順（複合パスの描画を含む）を照合する。
    * 既知の傷2（`VectorModel.js` の `replaceShape`・`addShapesWithNewIds` のJSDoc）が今も残っているかを確かめる。

* [x] タスク3: `PROJECT_ARCHITECTURE.md` 3章の冒頭・1.〜12.（起動・描画・入力・ビュー・作業データ・履歴・コピー・キャンバス管理・ファイル入出力・確認用ページ・結合・端点への吸い付き）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合対象）3章 522〜718行のハンク（「同期の経路」523行、1.〜10. 525〜662行、11.「結合」663〜684行、12.「端点への吸い付きと描き足し」685〜718行。約1.7万字。うち11.・12.で約1.0万字）
    * `./js/main.js`・`./js/core/CanvasManager.js`・`./js/core/InputTracker.js`・`./js/core/KeyboardShortcuts.js`・`./js/core/VectorModel.js`・`./js/io/`配下・`./js/edit/ShapeInserter.js`・`./js/edit/PathJoiner.js`・`./js/shapes/PathJoinRules.js`・`./js/edit/EndpointSnapper.js`・`./js/shapes/EndpointSnapRules.js`・`./js/shapes/VertexSnapRules.js` ほか記述が指すファイル :（照合に使うコード）
  * **調査内容**:
    * 各項の `+` 部分の呼び出し元・呼び出し順・記録の時点・履歴の単位・中断したときの戻しを照合する。
    * 11.の閉じる・結合のボタンが押せる条件（12-02の拡張と12-03・12-04の後も成り立つか）、12.の吸い付く先・距離・`Ctrl`の扱い・吸い付くだけ（12-03）の記述を照合する。
    * 描画・作業データ・ファイル入出力の流れの記述が12-04の複合パス・12-05の後も成り立つかを照合する。

* [ ] タスク4: `PROJECT_ARCHITECTURE.md` 3章13.〜28.と、小さな修正の `_doc/arch/` ファイル（`08`・`10`・`46`・`47`・`52`・`53`・`59`〜`63`）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合対象）3章 719〜1034行のハンク（13.「オプションバー（スタイルのまとまり）」719行〜、14.〜27.、28.「図形の一覧」1002〜1034行。約0.83万字）
    * `./_doc/arch/08_HistoryManager.md`（12行）・`10_ShapeFactory.md`（10行）・`46_ItemTreeRules.md`（2, 10行）・`47_ItemAttributeRules.md`（6行）・`52_ThumbnailRenderer.md`（4行）・`53_ItemListWiring.md`（2, 6-9, 11行）・`59_GroupCollapseRules.md`（8行）・`60_GroupCommandRules.md`（1-2, 5-9行）・`61_ItemRowRules.md`（5, 7, 9行）・`62_ItemPlaceRules.md`（10行）・`63_ItemStateRules.md`（10行） :（照合対象）全ハンク（計 約0.75万字）
    * `./js/palette/OptionBarStyleGroup.js`・`./js/edit/ShapeStyleEditor.js`・`./js/edit/StyleEyedropper.js`・`./js/edit/StylePanelRules.js`・`./js/core/PointHitRules.js`・`./js/edit/PathCornerEditor.js`・`./js/shapes/PathSegmentKindRules.js`・`./js/core/ScaleHandleRules.js`・`./js/core/RotationRules.js`・`./js/palette/ItemListPanel.js`・`./js/core/HistoryManager.js`・`./js/core/ShapeFactory.js`・`./js/core/ItemTreeRules.js`・`./js/core/ItemAttributeRules.js`・`./js/core/ThumbnailRenderer.js`・`./js/wiring/ItemListWiring.js`・`./js/core/GroupCollapseRules.js`・`./js/core/GroupCommandRules.js`・`./js/core/ItemRowRules.js`・`./js/core/ItemPlaceRules.js`・`./js/core/ItemStateRules.js`・`./js/main.js` ほか記述が指すファイル（実際の配置は `Glob` で確かめる） :（照合に使うコード）
  * **調査内容**:
    * 3章13.〜28.の `+` 部分（スタイル・スポイトの読み替え先、選択・スナップ・頂点の選択・角・区間の切り替え・拡大縮小・回転・数値入力・図形の一覧での複合パスのフォルダの扱いなど）の条件・呼び出し元・呼び出し順を照合する。
    * 小さな修正の各ファイルの `+` 部分（公開物・引数・戻り値・条件・使う側）を照合する。

* [ ] タスク5: `PROJECT_ARCHITECTURE.md` 3章29.〜31.（頂点の追加と削除・線の分割と区間の削除・複合パス）の照合
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` :（照合対象）3章 1035〜1065行のハンク（29. 1035〜1043行、30. 1044〜1053行、31. 1054〜1065行。約1.75万字）
    * `./js/core/InputTracker.js`・`./js/core/VertexEditRules.js`・`./js/core/VertexTargetRules.js`・`./js/core/VertexDragRules.js`・`./js/shapes/PathVertexRules.js`・`./js/edit/PathVertexEditor.js`・`./js/shapes/PathSplitRules.js`・`./js/edit/PathSplitEditor.js`・`./js/palette/OptionBarSplitGroup.js`・`./js/core/CompoundPathRules.js`・`./js/core/CompoundPathRenderer.js`・`./js/edit/CompoundPathEditor.js`・`./js/main.js`・`./js/core/KeyboardShortcuts.js` ほか記述が指すファイル :（照合に使うコード）
  * **調査内容**:
    * 29.の点を足す・消す操作の入口・条件・対象の集め方（12-02の`VertexTargetRules`への括り出しの後も成り立つか）・履歴の単位を照合する。
    * 30.の分割・区間の削除・閉じるの拡張のボタンが押せる条件・呼び出し順を照合する。
    * 31.の複合パスのボタンが押せる条件・中の図形の集め方・一番下の図形の決め方・描画・当たり・スタイル・書き出しの流れを照合する。

* [ ] タスク6: `_doc/arch/12_shapes.md` と `js/shapes/` の照合
  * **対象ファイル**:
    * `./_doc/arch/12_shapes.md` :（照合対象）全ハンク（現在の 3, 8, 10, 13, 16-17, 19-20, 22-32, 40, 42, 46-68, 77-79, 83, 115, 122-123 行。約1.87万字）
    * `./js/shapes/` 配下（特に `Path.js`・`Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`・`ShapeGeometry.js`・`PathJoinRules.js`・`EndpointSnapRules.js`・`PathSegmentKindRules.js`・`PathVertexRules.js`・`PathSplitRules.js`・`VertexSnapRules.js`） :（照合に使うコード）
  * **調査内容**:
    * 共通メソッド契約の数（20）と一覧・順番を、各図形クラスの実装と照合する。
    * 新設の `PathVertexRules`・`PathSplitRules`・`VertexSnapRules` と変わった図形クラス・規則ファイルの公開物・引数・戻り値・条件・import・使う側を照合する。
    * 「塗れるのは`rect`・`circle`・閉じた`path`のみ」等の記述が12-04（`evenodd`・輪郭のメソッド）の後も成り立つかを照合する。

* [ ] タスク7: `_doc/arch/14_edit.md`・`67_VertexTargetRules.md` と `js/edit/`・`js/core/VertexTargetRules.js` の照合
  * **対象ファイル**:
    * `./_doc/arch/14_edit.md` :（照合対象）全ハンク（現在の 2, 4, 50, 52-57, 63, 69, 93, 95-96, 100-117, 126, 162-168 行。約1.43万字）
    * `./_doc/arch/67_VertexTargetRules.md` :（照合対象）全行（新設。1-8行。約0.16万字）
    * `./js/edit/` 配下（特に `PathVertexEditor.js`・`PathSplitEditor.js`・`CompoundPathEditor.js`・`PathCornerEditor.js`・`PathJoiner.js`・`EndpointSnapper.js`・`ShapeStyleEditor.js`・`StyleEyedropper.js`・`StylePanelRules.js`）、`./js/core/VertexTargetRules.js` :（照合に使うコード）
  * **調査内容**:
    * `edit/` の各ファイルの公開物・引数・戻り値・import・使う側・呼び出し元・履歴の単位を照合する。
    * 頂点の選択から対象を集める手順が `VertexTargetRules` に括られた形（12-02）で書かれているか、`PathCornerEditor`・`PathVertexEditor` の記述が括り出しの後も成り立つかを照合する。
    * スタイル・スポイトの複合パスの読み替え先（12-04）を照合する。

* [ ] タスク8: `_doc/arch/16_test.md` と `test/` の照合
  * **対象ファイル**:
    * `./_doc/arch/16_test.md` :（照合対象）全ハンク（現在の 33, 315-342 行。約1.17万字）。あわせて既知の傷1のため、以前のPhaseの項の版の数字・テストの件数の記述を検索して読む
    * `./test/` 配下（Phase 12 で新設・変更のテストファイル。一覧は `git diff --name-status c30239d HEAD -- test`）、`node --test` の実行結果 :（照合に使うコード）
  * **調査内容**:
    * テストファイルの存在と数、テストの内容の記述と実際のテストケース、テストの件数（`node --test` の結果）、「テストできない箇所」の一覧、書き方の決まりの例外（ファイルの数を含む）、既存のテストで版の数字だけを直したものの記述を照合する。
    * 既知の傷1（以前のPhaseの項に残る古い記述。経緯として正しく書かれているものは相違としない）を確かめ、実際に食い違っていれば5章へ挙げる。
    * 既知の傷3（`test/io/SpriteSerializer.items.test.js` 139行付近の題名）が今も残っているかを確かめる。

* [ ] タスク9: `_doc/arch/02_main.md`・`01_index_html.md`・`13_palette.md` と `js/main.js`・`index.html`・`js/palette/` の照合
  * **対象ファイル**:
    * `./_doc/arch/02_main.md` :（照合対象）全ハンク（現在の 3-4, 14, 29-31, 43-44, 52, 65-66, 71-73, 81, 84-85, 89, 91, 93-95 行。約0.94万字）
    * `./_doc/arch/01_index_html.md` :（照合対象）全ハンク（現在の 3, 15-18, 24 行。約0.32万字）
    * `./_doc/arch/13_palette.md` :（照合対象）全ハンク（現在の 68-74, 87-89 行。約0.30万字）
    * `./js/main.js`・`./index.html`・`./js/palette/OptionBarSplitGroup.js`・`./js/palette/ItemListPanel.js`・`./js/wiring/` 配下・`./asset/icon/` :（照合に使うコード）
  * **調査内容**:
    * `02_main.md` の配線ブロックの表・注入の表・生成順の制約・主な関数・同期関数と購読先・行数を `main.js` と照合する（行数は `wc -l` で実測し並べる）。
    * `01_index_html.md` の要素・属性・クラス・CSS変数・幅の見積もりのコメント（分割のまとまり、一覧の下端の「複合パス」ボタン、複合パスのフォルダの絵、WEBアイコンの`<link>`）と行数を `index.html` と照合する。
    * `13_palette.md` の `OptionBarSplitGroup`・`ItemListPanel` の公開物・引数・条件・import を照合する。
    * 既知の傷5のうち `js/main.js` の分（188・211行付近。位置はずれている可能性あり）が今も残っているかを確かめる。

* [ ] タスク10: `_doc/arch/06_InputTracker.md`・`07`・`18`・`30`・`32`・`41`・`66`・`68` と `js/core/` の該当ファイルの照合
  * **対象ファイル**:
    * `./_doc/arch/06_InputTracker.md` :（照合対象）全ハンク（現在の 2, 17, 22, 25-26, 44, 46, 48-54, 59-61, 63-64, 66 行。約0.94万字）
    * `./_doc/arch/07_KeyboardShortcuts.md`（24行）・`18_PointHitRules.md`（2-3, 7, 11行）・`30_UnitSnapRules.md`（1, 13行）・`32_InputModes.md`（4行）・`41_NudgeTargetRules.md`（7行） :（照合対象）全ハンク
    * `./_doc/arch/66_VertexEditRules.md`（1-10行）・`68_VertexDragRules.md`（1-9行） :（照合対象）全行（新設）。以上で計 約1.66万字
    * `./js/core/InputTracker.js`・`./js/core/KeyboardShortcuts.js`・`./js/core/PointHitRules.js`・`./js/core/UnitSnapRules.js`・`./js/core/InputModes.js`・`./js/core/NudgeTargetRules.js`・`./js/core/VertexEditRules.js`・`./js/core/VertexDragRules.js`・`./js/core/ScaleHandleRules.js`（実際の配置は `Glob` で確かめる） :（照合に使うコード）
  * **調査内容**:
    * `06_InputTracker.md` の行数（`wc -l` で実測し並べる）、公開メソッド、入力の補助、修飾キーの項、ダブルクリック・吸い付きの項、状態（ダブルクリックの抑止・吸い付きの作業用フィールド）を照合する。
    * `07` のキーの対応表、`18` の塗られた所・穴の当たりの規則、`30`・`32`・`41` の `+` 部分、`66`・`68` の公開物・引数・戻り値・条件・import・使う側を照合する。
    * 既知の傷5のうち `js/core/InputTracker.js`（141行付近）・`js/core/ScaleHandleRules.js`（125行付近）の分（位置はずれている可能性あり）が今も残っているかを確かめる。

* [ ] タスク11: `_doc/arch/15_io.md`・`17_sprite_check.md`・`69_CompoundPathRules.md`・`70_CompoundPathRenderer.md` と `js/io/`・`js/core/CompoundPathRules.js`・`CompoundPathRenderer.js` の照合
  * **対象ファイル**:
    * `./_doc/arch/15_io.md` :（照合対象）全ハンク（現在の 3, 6, 14-19, 32-33, 35-39, 45, 49, 58 行。約0.73万字）
    * `./_doc/arch/17_sprite_check.md` :（照合対象）全ハンク（現在の 2, 19 行。約0.05万字）
    * `./_doc/arch/69_CompoundPathRules.md`（1-15行）・`70_CompoundPathRenderer.md`（1-9行） :（照合対象）全行（新設。計 約0.76万字）
    * `./js/io/` 配下（特に `DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`DrawElementReader.js`・`FileContentReader.js`）、`./js/core/CompoundPathRules.js`・`./js/core/CompoundPathRenderer.js`、`./sprite-check.html`・`./js/check/` 配下 :（照合に使うコード）
  * **調査内容**:
    * 作業データの版5と `migrateVersion4To5`・`MIGRATIONS`・要素のキー順、書き出し形式の版5、描画要素 `compoundPath` のキー順と `outlines`、`checkFormat` の受理する版、`compoundPath` から複合パスのフォルダへの組み立て、読み飛ばしの記録を照合する。
    * `CompoundPathRules`・`CompoundPathRenderer` の公開物・typedef・引数・戻り値・条件・import（`io → core` の向きを含む）・使う側を照合する。
    * `17` の `+` 部分を照合する。
    * 既知の傷4（`js/io/DrawElementReader.js` の、Phase 12-04で足したメソッドの前の空行の抜け）が今も残っているかを確かめる。

* [x] タスク12: 要件2の検索（前半）：点の追加・削除（12-01）・分割・区間の削除・閉じる（12-02）・頂点への吸い付き（12-03）・WEBアイコン・使われ方の変わったメソッド
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル :（検索対象。差分のない行・差分のないファイルを含む）
    * `./js/core/InputTracker.js`・`./js/core/KeyboardShortcuts.js`・`./js/main.js`・`./js/shapes/PathJoinRules.js`・`./js/shapes/EndpointSnapRules.js`・`./js/shapes/VertexSnapRules.js`・`./js/edit/EndpointSnapper.js`・`./js/core/VertexTargetRules.js`・`./js/edit/PathCornerEditor.js`・`./js/edit/PathVertexEditor.js`・`./js/core/VectorModel.js`・`./asset/` ほか事実の確認に必要なファイル :（事実の確認に使うコード）
  * **調査内容**:
    * 『参照する責務』Cの項目のうち、**点の追加・削除**（12-01）、**分割・区間の削除・閉じる**（12-02）、**頂点への吸い付き**（12-03）、**WEBアイコン**、**使われ方の変わったメソッド**（`VectorModel.deleteShapes` の呼び出し元、`VertexTargetRules` に括った対象の集め方）について、まず現在の実コードの事実を確かめ（`deleteShapes` は `Grep` で呼び出し元を件数とともに確かめる）、次に資料の全ファイルを語で検索して、古い形のまま残っている箇所を探す。
    * 経緯・過去の状態として正しく書かれているものは相違としない。

* [ ] タスク13: 要件2の検索（後半）：複合パス（12-04）・エンジンへの連絡（12-05）・行数・数え方
  * **対象ファイル**:
    * `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル :（検索対象。差分のない行・差分のないファイルを含む）
    * `./js/io/DocumentSerializer.js`・`./js/io/SpriteSerializer.js`・`./js/io/FileContentReader.js`・`./js/io/DrawElementReader.js`・`./js/core/CompoundPathRules.js`・`./js/shapes/` 配下の図形クラス・`./js/main.js`・`./js/core/InputTracker.js`・`./js/core/VectorModel.js`・`./index.html`・`./test/` 配下ほか事実の確認に必要なファイル :（事実の確認に使うコード）
  * **調査内容**:
    * 『参照する責務』Cの項目のうち、**複合パス**（12-04）、**エンジンへの連絡**（12-05）について、まず現在の実コードの事実（現行版・`MIGRATIONS` のキー・`checkFormat` の受理する版・描画要素の `kind` の種類・共通メソッド契約の数・塗りの規則）を確かめ、次に資料の全ファイルを語で検索して、古い形のまま残っている箇所を探す。
    * **行数**：`wc -l` で `InputTracker.js`・`main.js`・`VectorModel.js`・`index.html` を実測し直し、資料の全ファイルで古い行数（Phase 12 前の値など）が現在の値として書かれていないかを検索する。過去の時点の値として書かれたものは区別する。
    * **数え方**：`_doc/arch/16_test.md` の例外のファイルの数、`PROJECT_ARCHITECTURE.md` の「`edit/ → core/`のファイル数」など、列挙と数を併記している箇所を検索し、現在の実数と後の項の言い方が矛盾していないかを確かめる。
    * 経緯・過去の状態として正しく書かれているものは相違としない。

* [ ] タスク14: 結果の整理（固定タスク）
  * **対象ファイル**:
    * 本RES（`./_log/res/261127_2040_RES_Survey_Phase12_Doc_Consistency.md`）の4章・5章・6章 :（整理）
  * **調査内容**:
    * 5章『開発資料との相違』を確認し、相違が一件もなかった場合は「相違なし」と明記する（未確認と区別するため）。
    * 4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」「コードのコメント」と「照合できなかった主張」を、6章へ一覧（資料のファイルと節・要点・タスク番号）としてまとめる（内容は書き換えず、一覧にするだけ）。
    * `git status` で、ソースコードおよび資料ファイルを一切変更していないことを確認する。

## 4. 調査結果
### タスク1: `PROJECT_ARCHITECTURE.md` 1章の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク2: `PROJECT_ARCHITECTURE.md` 2章・4章と `03_VectorModel.md`・`04_CanvasManager.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク3: `PROJECT_ARCHITECTURE.md` 3章の冒頭・1.〜12.の照合
* **調査内容**:
  * 対象は `./PROJECT_ARCHITECTURE.md` の522〜718行（3章の冒頭「同期の経路」523行、1.〜10. 525〜662行、11.「結合」663〜684行、12.「端点への吸い付きと描き足し」685〜718行）に入る `git diff -U0 --word-diff=plain --word-diff-regex='[^。]+。?' c30239d 5493428 -- PROJECT_ARCHITECTURE.md` のハンク25個（新しい行番号で 523, 531, 533, 535, 539-540, 542, 545-546, 551, 556, 558, 561, 577-579, 603, 642, 657, 663, 665, 673-675, 678, 685-691, 694, 696, 700-701, 703, 707-717）。照合した「新しい・書き換えられた文」の数の目安は約75文（同期の経路・1.〜10.で約35文、11.で約10文、12.で約30文）。`-` 行にそのまま同じ文がある文は照合していない。資料の原文は `PROJECT_ARCHITECTURE.md` を開いて確かめ、差分の表示は補助にだけ使った。
  * `git diff --stat c30239d HEAD -- js index.html test asset sprite-check.html` と `--name-status` で変更の範囲を確かめた（`js/` 44ファイル。`js/check/`・`ClipboardController.js`・`ShapeInserter.js`・`SnapshotAdapter.js`・`CanvasFileOperations.js`・`CanvasLibrary.js`・`CanvasStorage.js`・`DocumentFileIO.js` は変更なし。`sprite-check.html` はWEBアイコンの `<link>` 4行だけの変更）。
  * 照合したコード：`js/main.js`（同期関数・`renderCurrentState`・`InputAssist` の注入・`// 7.16.`・`performJoin`・`syncJoinButtonState`・`syncDeleteButtonState`・`syncOptionBarSplitGroup`・`deleteLastLinePointOrSelection` の注入）、`js/core/InputTracker.js`（`handleDoubleClick`・`#lastClickSuppressed`・`deleteSelection`・`deleteSelectionOrVertices`・`canDeleteSelectionOrVertices`・`deleteLastLinePointOrSelection`・`#classifyPoint`・`#applyLeftDragUpdate`・`#beginLeftDrag`・`#onLeftDragEnd`・`handleMouseMove`・`handleClick`・`InputAssist` の既定・import）、`js/core/VertexEditRules.js`・`VertexDragRules.js`・`VertexTargetRules.js`・`PointHitRules.js`・`CompoundPathRules.js`・`CompoundPathRenderer.js`・`CanvasManager.js`・`VectorModel.js`（`getCompoundPaths`・`setGroupCompound`・`setSnapPoint`・`isSnapPointVertex`・`replaceShape`・`replaceAllShapes`）、`js/edit/EndpointSnapper.js`・`PathJoiner.js`・`PathVertexEditor.js`・`PathSplitEditor.js`・`CompoundPathEditor.js`・`ClipboardController.js`、`js/shapes/PathJoinRules.js`・`EndpointSnapRules.js`・`VertexSnapRules.js`・`PathVertexRules.js`（`outlineSourceOf`）・`PathSplitRules.js`・`Curve.js`・`Ellipse.js`、`js/io/DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`FileContentReader.js`・`DrawElementReader.js`、`js/core/ItemAttributeRules.js`、`js/check/SpriteCheckInspector.js`・`SpriteCheckPage.js`、`sprite-check.html`、`index.html`（`#selection-join`・分割のボタン・複合パスのボタン）、`test/` の12-03のテスト6ファイルの存在。
  * 使った検索（件数）：`grep -n "syncJoinButtonState|syncOptionBarSplitGroup|syncDeleteButtonState|compoundPaths|canDeleteSelectionOrVertices|deleteSelectionOrVertices|deleteLastLinePointOrSelection|// 7.16|PathVertexEditor|insertVertexAt|hasRemovableVertices|removeSelectedVertices|viewTransform.onChange" js/main.js`（約45行）／`grep -n "dblclick|handleDoubleClick|lastClickSuppressed|resolveDoubleClickInsertTarget|resolveDeleteRoute|DELETE_ROUTE|deleteSelectionOrVertices|canDeleteSelectionOrVertices|deleteLastLinePointOrSelection|removeLastLinePoint()|buildVertexDragUpdates|unitSnapHandleOrigin|vertexDragOrigins|classifyPoint|getCompoundPaths|applySelectionChange|import " js/core/InputTracker.js`（約120行）／`grep -rnF "deleteShapes(" js`（3件：定義1、`PathSplitEditor.js:137`、`PathVertexEditor.js:113`）／`grep -rnF "#toUsableSnap(" js`（11件）／`grep -rnF "findVertexSnapTarget(" js`（9件）／`grep -rnF "isVertexSnap(" js`（7件）／`grep -rnF "viewTransform.onChange(syncJoinButtonState" js`（1件）／`grep -rnF "model.onChange(syncOptionBarSplitGroup" js`（1件）／`grep -rn "from '../edit" js`（1件。`js/wiring/DisplayWiring.js:5`。`InputTracker.js` には `edit/` のimportは無い）／`grep -n "SEGMENT_KIND_SMOOTH =|SEGMENT_KIND_LINE =|SEGMENT_KIND_BEZIER =" js/shapes`（3件）／`grep -rn "checkFormat|formatVersion|version" js/check`（`SpriteCheckInspector.js:69` の `checkFormat` 呼び出しのみ。版の直書きなし）。
  * 既知の傷のうち、このタスクの担当は無い（傷2〜5は他タスク）。
  * `git status` で、ソースコード・資料ファイル・RESに変更が無いことを確認した（出力なし＝変更なし）。結果の書き込みは結果ファイル（リポジトリ外）だけ。
* **事実（実コードの記述）**:
  * **同期の経路（523行）**：`main.js:398-399` で `model.onChange(syncJoinButtonState)` と `viewTransform.onChange(syncJoinButtonState)` の両方に登録（一致）。`syncJoinButtonState` は `!pathJoiner.canJoin()` を `disabled` へ入れる（`main.js:392-394`）。`canJoin` は `planJoin(選択図形, screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX=5)) !== null`（`PathJoiner.js:62-67`、`PathJoinRules.js:14`）で、`join()` も同じ `planJoin` の入口（`PathJoiner.js:80-88`）。`syncOptionBarSplitGroup` は `model.onChange` のみ（`main.js:1035`。`viewTransform.onChange` への登録は無い）。→ 一致。
  * **描画・複合パス（531行）**：`renderCurrentState` は `compoundPaths: model.getCompoundPaths()` を渡すだけ（`main.js:247`）。`CanvasManager.render` は `buildDrawUnits(shapes, compoundPaths)`（`CanvasManager.js:254`）で単位に分け、`outline` でなければ `drawCompoundPath`（255-257）、中の図形の `draw` は呼ばない（260-265は `!asCompound` のときだけ）。`drawCompoundPath` は `beginPath` → 各図形の `appendOutline` → `fill('evenodd')` → `stroke`（`CompoundPathRenderer.js:21-33`）。ホバーは図形ごとの `drawHover` を複合パスを描いた直後に呼ぶ（`CanvasManager.js:267-269`）。アウトライン表示は単位によらず図形ごとの `drawOutline`（262）。スタイルは `listCompoundPaths` で `inner[0]`（前順で最初＝一番下）の図形の値（`CompoundPathRules.js:154-159`）。→ 一致。
  * **吸い付きの場面（533行）**：直線・曲線のツールの描き始め・線を引く途中、頂点のハンドルのドラッグで結合する吸い付きが働き、描き始めは5つのツールすべてで吸い付くだけが返る（`isVertexSnapDrawStartShapeType` が5種、`VertexSnapRules.js`）。2つ目の点は矩形だけ（`isVertexSnapDrawEndShapeType` は `'rect'` のみ）。→ 一致。
  * **塗られた所・穴（535行）**：`#classifyPoint` は第8引数に `this.model.getCompoundPaths()`（`InputTracker.js:2043-2053`、`classifyPointHit` の仮引数は8つ）。`classifyPointHit` は呼び出しごとに `mapCompoundsByShape(compoundPaths)` を1回作る（`PointHitRules.js:113-115`）。輪郭（`hitTest`）が先、次に `includeFill` が真なら後ろ（前面）から、複合パスに入る図形は `hitTestCompoundFill`、入らない図形は `hitTestFill`（`PointHitRules.js:67-84`）。`isInsideCompoundFill` は `fillColor` が文字列でなければ偽（`CompoundPathRules.js:235-244`）。ロック・隠れた図形は `getEditableShapes()` に入らず素通り（`InputTracker.js:2045`）。アウトライン表示の間は `!this.#isFillHitExcluded()` で塗りを含めない（2049）。範囲選択・全選択は `compoundPaths` を使わない（`grep "getCompoundPaths" InputTracker.js` は2043-2053のみ）。→ 一致。
  * **削除の受理（539行）**：`deleteSelection()` は選択モード・IDLE・非ドラッグ・`hasRemovableSelection()` で `deleteSelectedItems()` を呼んで `true`（`InputTracker.js:702-713`）。`beginEdit`/`commitEdit`・`deleteShapes` はこのメソッドの中に無い。削除ボタン `syncDeleteButtonState` は `!inputTracker.canDeleteSelectionOrVertices()`（`main.js:350-351`）。`canDeleteSelectionOrVertices` は `VERTICES` なら `hasRemovableVertices()`、`ITEMS` なら `model.hasRemovableSelection()`（`InputTracker.js:869-874`）。→ 一致。モード切り替えは `setMode` が `clearSelection()` するため（`InputTracker.js:606`）、ボタンの状態は `model.onChange` で追従する。
  * **ダブルクリックと頂点の削除の入口（540行）**：コンストラクタが `canvas` の `dblclick` を購読（`InputTracker.js:562`）。`handleDoubleClick` は `resolveDoubleClickInsertTarget({ mode, state, isDragging, clickSuppressed, hit })` が `shapeId` を返したときだけ `insertVertexAt(shapeId, point, #getWorldHitTolerance())`（`InputTracker.js:1297-1310`）。規則は VERTEX・IDLE・非ドラッグ・非抑止・`hit.handle` なし・`bodyId` あり（`VertexEditRules.js:41-48`）、修飾キーは見ない。`#lastClickSuppressed` は `handleClick` の冒頭で `consumeSuppressedClick()` の結果を覚える（`InputTracker.js:1207`）。`deleteSelectionOrVertices` は `resolveDeleteRoute(currentMode)` が `VERTICES` なら IDLE・非ドラッグ・`hasRemovableVertices()` のときだけ `removeSelectedVertices()` して `true`、`ITEMS` なら `deleteSelection()`（853-862）。`deleteLastLinePointOrSelection` は `removeLastLinePoint() || deleteSelectionOrVertices()`（882-884）で、`main.js:1122` が `KeyboardShortcuts` の `deleteSelection` に注入し、`main.js:360` の削除ボタンは `deleteSelectionOrVertices()`。切り取りは `deleteSelection()`（`main.js:562` のコメント）。`InputAssist` はコンストラクタ第7引数（`InputTracker.js:458`）で、3項目の既定は `false` を返す（192-200）。実体は `main.js:208-212` で `pathVertexEditor`（`main.js:993-996` の `// 7.16.`）。`InputTracker` は `edit/` を import しない（`InputTracker.js` の import は `core/` のみ）。→ 一致。1回目・2回目の `click` は今のまま（頂点の選択で本体をクリックすると `clearSelectedVertices()` の後に図形だけを選ぶ。`InputTracker.js:1272-1275`）。
  * **頂点のドラッグ・吸い付くだけ（542行）**：結合する吸い付きの `#dragEndpoint` は `#vertexDragOrigins.length === 1` のときだけ解決（`InputTracker.js:1520-1523`）。`#applyLeftDragUpdate` は `Ctrl` でなければ点の数によらず `findVertexDragSnap(this.#dragEndpoint, 動かす点を持つ図形のid列, target)` を呼ぶ（1680）。座標の組み立ては `buildVertexDragUpdates(origins, anchor, target, anchorOrigin)`（1692、`VertexDragRules.js`）で、アンカーには `target` をそのまま、ほかには `o.x + (target.x − anchorOrigin.x)` を渡す。`updateVertices` を1回呼ぶ。作成で打つ点は、吸い付かなかったときだけ `roundPointToUnit`（`InputTracker.js:1027-1030, 1233-1241`）で、吸い付いたときは丸めない。→ 一致。
  * **キーボード操作（545-546行）**：`Backspace`/`Delete` の実体は `main.js:1122` の `inputTracker.deleteLastLinePointOrSelection()`。`KeyboardShortcuts.js` の差分は JSDoc 1行だけで対応表は変わらない。→ 一致。
  * **表示・ロックと入力（546行 (4)）**：削除ボタンの照会は `canDeleteSelectionOrVertices()`、頂点の選択では選んだ点があるときだけ押せる（`InputTracker.js:869-874`）。→ 一致。
  * **作業データ（551行）**：`DocumentSerializer.#itemToElement` は `collapsed`（真のときだけ）→ `compound`（真のときだけ）→ `children` の順（`DocumentSerializer.js:424-433`）。読む側は `compound: element.compound`（479）で、`ItemAttributeRules.resolveItems` が `compound !== true` ならキーを消す（`ItemAttributeRules.js:104-106`）。現行版5（`DocumentSerializer.js:21`）。`migrateVersion4To5` は `shapes` を再帰でたどり `type: 'group'` から `compound` を除く（146-168）。`MIGRATIONS` は `{1,2,3,4}`（186）。→ 一致。
  * **履歴（556・558・561・577〜579行）**：吸い付きは座標を決めるだけで `beginEdit`/`commitEdit` の位置は変わらない（`InputTracker.js:1804-1805` の `joinDraggedEndpoint` は移動の確定の前、`1222-1226` の弧・矩形・円の `commitDraft` の前後）。`CompoundPathEditor.toggle` は `resolveCompoundToggle` が `null` なら `false`（`beginEdit` を呼ばない）、そうでなければ `beginEdit` → `model.setGroupCompound` → `commitEdit`（`CompoundPathEditor.js`、`CompoundPathRules.js:88-109`）。切り替えはスタイルを書き換えない（`setCompound` は `compound` のキーだけ）。削除の経路の「頂点の選択の `Delete`/`Backspace`・削除ボタンはこの経路を通らない」は一致（`InputTracker.js:853-862`）。点の追加は `PathVertexEditor.insertAt`：`getEditableShapes()` に無い・計画 `null` なら `beginEdit` 前に `false`、あれば `beginEdit` → `replaceShape(…, { keepId: true, select: true })` → `setSelectedVertices` → `commitEdit`。点の削除は `removeSelectedVertices`：計画が空なら `beginEdit` 前に `false`、`clearSelectedVertices` → 図形の組ごとに `replaceShape(…, { keepId: true, select: false })` → 消える図形があれば `deleteShapes(ids)` → `commitEdit`。分割・区間の削除は `PathSplitEditor.#apply`：`clearSelectedVertices` → `replaceShape(…, { keepId: true, select: false })`×k → `addShapesWithNewIds(…, { place: { kind: 'above', id } })`×k' → 消える図形があれば `deleteShapes` → `setSelection` → `commitEdit`（`PLACE_KIND.ABOVE = 'above'`）。→ 一致。**ただし561行の「`model.deleteShapes`…点の削除で図形ごと消えるときだけ`PathVertexEditor`が呼ぶ」は相違（5章）**：`deleteShapes` の製品コードからの呼び出しは `PathVertexEditor.js:113` と `PathSplitEditor.js:137` の2か所。
  * **コピー（603行）**：`ClipboardController`・`ShapeInserter` は `c30239d`〜`HEAD` で変更なし（`git diff --stat` が空）。コピーは `DocumentSerializer.serialize(picked.items)`（`ClipboardController.js:139, 162, 211, 254`）で、`#itemToElement` が `compound: true` を書き、貼り付けの `deserialize` が読む。図形だけを写すと図形の要素になり `compound` を持たない。→ 一致。
  * **ファイル入出力（642行）**：出力（作業ファイル）は版5で複合パスのフォルダに `compound: true`（`DocumentSerializer.js:21, 431-433`）。出力（エンジン用）は `SpriteSerializer.js` で `SPRITE_FORMAT_VERSION = 5`（23）、効いている複合パスは要素 `compoundPath` を1つ（346の説明、359）。`source` のあるJSは `DocumentSerializer.deserialize(data.source)`、`source` の無いJSは `deserializeShapeElements(data.elements, toShapeData, toCompoundPathShapeData)`（`FileContentReader.js:80-93`）。`DrawElementReader.toCompoundPathShapeData` は `DrawElementReader.js:272`。フォルダへの組み立ては `DocumentSerializer.js:346-347`（`{ type: GROUP_TYPE, compound: true, children: compoundData }`）。版1〜4のJSは `checkFormat` が `1 ≤ version ≤ 5` で受理（`SpriteSerializer.js:337`）。→ 一致。
  * **確認用ページ（657行）**：`SpriteSerializer.checkFormat` は版1〜5を受理（`SpriteSerializer.js:19, 337`）。`CodeExporter.js:221-222` の `DRAW_SOURCE` が `element.kind === 'compoundPath'` を描く。`js/check/` は `c30239d`〜`HEAD` で変更なし。`SpriteCheckInspector.js:69` は `SpriteSerializer.checkFormat(value)` を呼び、`js/check/` と `sprite-check.html` に版の数値の直書きは無い（`formatVersion`・`source.version` を表示するだけ）。→ 一致。
  * **結合（663・665・673・675・678行）**：`classifyJoin`：1本は `isJoinableLine` かつ `chainSourceOf(toJSON()).points.length >= 3`（`CLOSED_MIN_POINTS = 3`）で `'close'`（`PathJoinRules.js:274-279`）。弧は `arcChainSourceOf` で頂点3つ・`bezier`×2（162-205）。直線・今の曲線は頂点2つ。閉じたパス・矩形・円は `isJoinableLine` が偽。`buildClosedPath` は `chainOf` の点が3つ未満なら `null`、両端が許容距離以内なら最後の点を除き、離れていれば閉じる区間（`gapSegmentKind`）を足す（299-318）。まとめると2つになるものは `null`（`buildClosedPath` の `points.pop()` 後の検証）。`replaceShape` は `{ ...item, shape }` で名前・位置を保つ（`VectorModel.js:1118-1127`）。`canJoin` は `planJoin`、両端が重なる3点のパス・5px以内の小さな弧は `null` で押せない。直線・今の曲線の区間の種類を足す `drawnSegmentKind`（`line`／`smooth`。`Path.js:33,39`）。閉じたパスを開く専用のボタン・キーは無い（`index.html:889-890` は「分割」「区間を消す」のみ。`KeyboardShortcuts.js` の対応表に該当なし）。閉じたパスの分割は `PathSplitRules.js:140-` で閉じた輪郭を切って開く。→ 一致。
  * **12.（685〜718行）**：`EndpointSnapper` の新しい照会 `findDrawStartSnap`・`findDrawEndSnap`・`findDrawnLinePointSnap`・`findVertexDragSnap`・`isVertexSnap` が存在（`EndpointSnapper.js:127, 153, 180, 216, 236`）。`chooseSnapTarget` は同じ距離なら結合する吸い付き（`<=`、`VertexSnapRules.js`）。距離は `SNAP_TOLERANCE_SCREEN_PX = 8`（`EndpointSnapRules.js:14`）、`findNearestSnapPoint` は `d <= tolerance && d < bestDist`、末尾（前面）から、図形の中は並びの順（113-129）。`snapVerticesOf`：パス＝`points` のすべて・矩形＝4つの角・直線＝両端・今の曲線＝`chainSourceOf` の始点・終点（制御点は除く）は `outlineSourceOf`（`PathVertexRules.js:88-128`）、弧＝`lineEndpointOf` の両端＋中心、円＝中心（`VertexSnapRules.js`）。動かしている点を持つ図形を除く：`findVertexDragSnap` は `movingShapeIds`（`InputTracker.js:1680`）、`findDrawnLinePointSnap` は描き始めが `EndpointRef` なら `[その図形のid]`（`EndpointSnapper.js:180-200`）。`#toUsableSnap` は `commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`findDrawnLineSnap`・`joinDraggedEndpoint` の冒頭（`EndpointSnapper.js:289-292, 312-313, 356-357, 398-399, 433-434`）で、`isVertexSnap(snap)` なら `null`（483-486）。`commitDrawnLine` は両方 `null` なら `false`（292-295）。弧・矩形・円で□を確定するときは `InputTracker.handleClick` が `commitDrawnLine` の `false` を受けて `commitDraft({ atInsertTarget: true })`（`InputTracker.js:1222-1226`）。表示：`#showSnap` が `model.setSnapPoint(snap.x, snap.y, 補助のisVertexSnap(snap))`（`InputTracker.js:921-923`）、`VectorModel.setSnapPoint(x, y, vertex=false)`・`isSnapPointVertex()`（`VectorModel.js:635, 669`）、`renderCurrentState` が `snapPointVertex` を渡す（`main.js:246`）、`CanvasManager` は白 `SNAP_INDICATOR_VERTEX_FILL_COLOR = '#ffffff'`・青 `SNAP_INDICATOR_FILL_COLOR = '#4a90e2'`・枠 `#1f4e8c`・大きさ8・線幅1.5（`CanvasManager.js:93-117, 397-398`）。`replaceAllShapes` は吸い付きの表示の点を消す（`VectorModel.js:1012-1013`）。`Ctrl` の間はドラッグの更新でも照会しない（`InputTracker.js:1679-1680`）。結合する吸い付きの対象の読み方 `lineEndpointOf`・`endpointVertexIndexOf`（弧は `null`、`PathJoinRules.js:208, 224`）、`resolveEndpointHandle`（`EndpointSnapRules.js:60-68`）、弧のハンドルは `getVertexIndexForHandle` が常に `null`（`Ellipse.js:217-219`）、曲線の制御点 `'control'` は頂点のハンドル（`Curve.js:207-209`）で結合する吸い付きの端点としては解決されない（index 1 は 0・2 のどちらでもない）。`planEndpointDragJoin` は同じ図形の別の端点なら `planCloseOf`（弧も閉じる計画を返す。`PathJoinRules.js:748-756`）が、弧は `resolveEndpointHandle` が `null` のため実際には起きない。12-03のテスト6ファイルは存在（`test/shapes/EndpointSnapRules.scan.test.js`・`VertexSnapRules.test.js`、`test/edit/EndpointSnapper.vertexSnap.test.js`・`EndpointSnapper.vertexSnap.flow.test.js`、`test/core/VertexDragRules.test.js`・`VectorModel.snapPointVertex.test.js`）。→ 一致（相違は5章の1件のみ）。
  * **行数**：`wc -l` の実測は `js/main.js` 1305、`js/core/InputTracker.js` 2126、`js/core/VectorModel.js` 1513、`index.html` 975。このタスクの範囲の `+` 行に行数の記述は無い。
* **推測・所見**:
  * 読み方が分かれる記述：540行の `InputAssist` 項目の説明「`InputTracker`は`edit/`をimportせず、`beginEdit`／`commitEdit`も呼ばない（記録は`PathVertexEditor`が挟む。6.）」は、点の追加・削除の経路についてなら一致する。`InputTracker` 全体では左ドラッグの閾値超過で `editRecorder.beginEdit()`／`commitEdit()` を呼ぶ（`InputTracker.js:339-340, 1804` 付近）。「点の追加・削除では」と限定して読めば一致、`InputTracker` 全体に付く文と読めば不一致になる。
  * 読み方が分かれる記述：561行「`model.deleteShapes`はここでは呼ばず、Phase 12-01から点の削除で図形ごと消えるときだけ`PathVertexEditor`が呼ぶ」の「ここでは呼ばず」は削除の経路（`GroupEditor.removeSelection`）についてなら一致。「だけ」を製品コード全体の呼び出し元と読むと相違（5章に挙げた）。
  * 読み方が分かれる記述：550行の頂点の削除の入口の文「公開の照会 `canDeleteSelectionOrVertices()`…が削除ボタンの押せる・押せないの唯一の照会」は、`main.js:350-351` の1か所だけが呼ぶことと一致する。
  * 照合できなかった主張：12.の注意事項 (b)（吸い付くだけで重ねた後に少しドラッグすると、距離0の点へ吸い付いたまま動かない／離すと結合する＝結合する吸い付きの今のふるまい）は、実際の操作の結果で、コードの個々の分岐（`findNearestSnapPoint` の `d <= tolerance`、`chooseSnapTarget` の同距離は結合）とは整合するが、挙動そのものは操作で確かめる必要がある（コードだけでは照合できない）。
  * 照合できなかった主張：12.の注意事項 (c)「点の極端に多い図形が多数ある絵での重さは確かめていない」、(d)「アンチエイリアスで境目にごく薄い線が見える（ズームしても画面上1px程度）」は実測・見え方の記述で、コードからは確かめられない。(a)「描き始めた位置の頂点で□が出る間にクリックすると『最後の点と重なる』で終える」は `clickDrawnLine` の分岐 `isOnLastDrawnPoint`（`EndpointSnapper.js:398-` の順）から読み取れるが、画面上の動きは未確認。
  * 照合できなかった主張：12.の「発注者の決定、2026-11-27」「発注者の決定2026-11-18」「計画で決めたこと」は方針の記述で、コードの振る舞いとして確かめられる範囲（弧・円の2つ目の点は吸い付かない、自分の始点に吸い付かない）だけを照合した（矩形のときだけ `findDrawEndSnap` が返す＝`VertexSnapRules.js` の `isVertexSnapDrawEndShapeType`）。「円・弧の2つ目の点は外接する四角の角に当たり、頂点に合わせても円がその頂点を通らない」という理由の部分は設計上の説明で未照合。
  * 照合できなかった主張：12.の「確認の状況（Phase 12-03）」の「実際のマウスでの吸い付きの見た目は自動テストの対象外（テストプレイで確かめる）」は、テストの範囲の記述（`_doc/arch/16_test.md` はタスク8の担当）で、ここでは6つのテストファイルの存在までを確かめた。
  * コードのコメント：`js/core/KeyboardShortcuts.js` の `join` の JSDoc（57行）「選択中の線を結合する（開いたパス1本を閉じる・2本を1本の開いたパスにする）」は、12-02で弧1本も閉じるようになった後の記述になっていない（弧の記載なし）。`git diff c30239d HEAD -- js/core/KeyboardShortcuts.js` で変わったのは `deleteSelection` の JSDoc 1行だけ。
  * コードのコメント：`js/core/InputTracker.js:1457` の「頂点を2つ以上動かすときは結合する吸い付きをせず」は、結合する吸い付きについては正しく、続く1458行目で吸い付くだけの扱いを補っており、古い記述は無い（確認のみ）。
  * 照合の外で見つけた記述：なし。

### タスク4: `PROJECT_ARCHITECTURE.md` 3章13.〜28.と小さな修正の `_doc/arch/` ファイルの照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク5: `PROJECT_ARCHITECTURE.md` 3章29.〜31.の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク6: `12_shapes.md` と `js/shapes/` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク7: `14_edit.md`・`67_VertexTargetRules.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク8: `16_test.md` と `test/` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク9: `02_main.md`・`01_index_html.md`・`13_palette.md` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク10: `06_InputTracker.md`・`07`・`18`・`30`・`32`・`41`・`66`・`68` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク11: `15_io.md`・`17_sprite_check.md`・`69`・`70` の照合
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

### タスク12: 要件2の検索（前半）
* **調査内容**: 
  * 検索対象は `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（`Grep`・自作の語検索スクリプトで全ファイルを走査）。使った式と件数（件数は資料全体の行ヒット数。多数の語は前後を読んで判定）：
    * `deleteShapes`：30件（読んだ。下の相違1・所見）／`製品コードから|呼び出し元は無|呼び出し元はない|呼ばれない|呼ばれていない`：10件／`製品コードからの呼び出し元が無くなった`・`一本化|rearrangeItems…`：21件
    * 点の追加・削除（12-01）：`押せる見た目|消せない|閉じられない|'path'だけ|1対1|一対一|ほかの図形の頂点|他の図形の頂点`：22件／`(頂点の選択|A).{0,60}何もしない|何もしない.{0,40}…|点を(足す|消す|追加).{0,20}(無|ない|しない)|(足せ|消せ)ない`：21件／`(dblclick|handleDoubleClick|ダブルクリック)…(使わない|扱わない|無視|未対応|無い|ない|しない|なし)`：4件（`ダブルクリック`の単純検索は34件）／`何もしない`単純検索：101件（頂点の選択・`Delete`・`Backspace`・ダブルクリックの近くを上の式で絞って読んだ）
    * 分割・区間の削除・閉じる（12-02）：`(線を切る|分割|区間を消す|区間の削除|切断)…(行わない|しない|無い|ない|できない|未|やらない|対象外)|閉じ…(だけ|のみ)|弧…(閉じない|閉じられない)|開いた線を閉じる…`：5件／`'close'|classifyJoin|canCloseByMergingEnds`：43件／`(結合|閉じる)…(ボタン|J)…押せ|両端が重な…(押せ|何も起きない)|何も起きない…(結合|閉じ)|syncJoinButtonState|joinSelectionBtn`：17件／`押せる見た目で何も`（全ファイルの行数）：1件（`12_shapes.md:13`）
    * 頂点への吸い付き（12-03）：`吸い付(く|き)…は…(だけ|のみ)|端点だけ|吸い付く先…(だけ|のみ)|結合できる線の端点(だけ|のみ)|…`：14件／`吸い付かない|吸い付きは(無|ない|しない)|吸い付き…結合|…`：23件
    * WEBアイコン：`asset/…(には|は|の下|配下)|asset/sprite|asset/(icon|sprite)|apple-touch|favicon|rel="icon"`：24件／`(asset|アセット)…(のみ|だけ|唯一|1つ)`：0件（`PROJECT_ARCHITECTURE.md:156-158` の構成図は `icon/` と `sprite/` の2つ）
    * `VertexTargetRules`・`#collectTargets`・`collectTargets`・`対象の集め方`：82件（全件を読んだ）／`(PathCornerEditor|PathVertexEditor)…(NudgeTargetRules|resolveNudgeTarget)`：5件／`getSelectedVertices|setSelectedVertices|clearSelectedVertices`の呼び出し元の記述（`03_VectorModel.md:22`）を実コード `grep` と照合
  * 実コードの事実の確認：`git diff --name-status c30239d HEAD -- js index.html test asset sprite-check.html`、`Grep deleteShapes js`（呼び出しの件数は下記）、`js/core/VertexTargetRules.js`・`js/edit/PathCornerEditor.js`・`PathVertexEditor.js`・`PathSplitEditor.js`・`js/shapes/PathJoinRules.js`（`classifyJoin`・`planJoin`・`buildClosedPath`・`canCloseByMergingEnds`）・`js/edit/PathJoiner.js`（`canJoin`）・`js/shapes/VertexSnapRules.js`・`js/core/KeyboardShortcuts.js`・`ls asset`。
  * 行数の実測（`wc -l`）：`js/core/InputTracker.js` 2126・`js/main.js` 1305・`js/core/VectorModel.js` 1513・`index.html` 975（計画立案時と同じ。行数の検索はタスク13）。
* **事実（実コードの記述）**:
  * `VectorModel.deleteShapes` の製品コードの呼び出しは**2件**：`js/edit/PathVertexEditor.js:113`（点の削除で図形ごと消える組）と `js/edit/PathSplitEditor.js:137`（分割・区間の削除で消す図形）。`js/core/InputTracker.js:695` はコメントで「`deleteShapes`も呼ばない」とあるだけ（呼び出しでない）。定義は `js/core/VectorModel.js:929`。
  * 頂点の選択から対象を集める手順は `js/core/VertexTargetRules.js` の `collectVertexTargets`（`resolveNudgeTarget`のみimport）の1か所。`PathCornerEditor.js:165`・`PathVertexEditor.js:124`・`PathSplitEditor.js:107` の `#collectTargets()` はいずれも `collectVertexTargets(...)` を呼ぶだけで、3者とも `NudgeTargetRules` を直接importしない。
  * `js/core/KeyboardShortcuts.js:172` は `Delete`・`Backspace`（`ctrl: false`・`ShiftRule.FORBIDDEN`）を `deleteSelection` に対応づける（モードでの除外はなく、受理判定は注入された側）。`InputTracker.js:562` が `dblclick` を購読する（`handleDoubleClick`）。`js/main.js:392-393` の `syncJoinButtonState` は `!pathJoiner.canJoin()` を `disabled` にし、`js/edit/PathJoiner.js:62-67` の `canJoin` は `planJoin(...) !== null`。
  * `js/shapes/PathJoinRules.js:279-283`（`classifyJoin`）：1本のとき `isJoinableLine(shape)`（直線・開いたパス・今の曲線・弧）かつ `chainSourceOf(shape.toJSON()).points.length >= 3` なら `'close'`（弧は頂点3つで`'close'`）。`buildClosedPath`（同ファイル。まとめると頂点が3つ未満なら `null`）。始点と終点が重なる頂点3つの開いたパスは、まとめると頂点2つになり `buildClosedPath` が `null` → `planJoin` が `null` → `canJoin` が偽 → 結合のボタンは `disabled`。
  * `js/shapes/VertexSnapRules.js:104-106`：`isVertexSnapDrawEndShapeType` は `'rect'` のときだけ真（`PROJECT_ARCHITECTURE.md:689` の「矩形のときだけ吸い付くだけ」と一致）。
  * `ls asset` は `icon/`（`apple-touch-icon-180.png`・`favicon-32.png`・`icon-192.png`・`icon-512.png`）と `sprite/` の2つ。
  * `VectorModel` の頂点の選択の設定・解除の呼び出し元：`setSelectedVertices` は `InputTracker.js:1121,1925`・`PathCornerEditor.js:124`・`PathVertexEditor.js:81`、`clearSelectedVertices` は `InputTracker.js:750,1274,1922`・`PathSplitEditor.js:122`・`PathVertexEditor.js:104`。`getSelectedVertices` を読む編集操作は `NudgeEditor`・`PositionInputEditor`・`TransformInputEditor`・`PathCornerEditor`・`PathSplitEditor`・`PathVertexEditor` と `main.js:236`。
  * 12-01〜12-03の「古い形」として検索基準Cに挙がった記述のうち、次は**現在の資料に「今もそうである」形では残っていない**（見つかった箇所はすべて「Phase 12-01で変えた」「Phase 12-02で括った」「Phase 12-02で変わった」と経緯が付く）：「`A`で`Delete`・`Backspace`は何もしない」（`PROJECT_ARCHITECTURE.md:838` 末尾に「Phase 12-01で変えた」あり。`:1040` に変更を明記）、「削除ボタンは押せる見た目のまま」（`:838` の(8)は`:1040`で変更を明記。`:830` は新しい挙動）、「点を足す・消す操作は無い」（0件）、「ダブルクリックは何もしない」（`:906` は図形作成モードの話で正しい）、「パスを分割できない」「区間を消せない」（0件）、「弧は閉じられない」（`12_shapes.md:8` に「Phase 09-03bの時点では」と経緯付き）、「吸い付くのは端点だけ」（`PROJECT_ARCHITECTURE.md:694` は「結合する吸い付きの先」の話で正しく、`:533`・`:691` も「結合する吸い付きは」と限定）、「ほかの図形の頂点には吸い付かない」（0件。`:689` の「円・弧では吸い付かない」は実コードと一致）、「`asset/`には`sprite/`だけ」（0件）、`PathCornerEditor`・`PathVertexEditor`の`#collectTargets`の写し（`PROJECT_ARCHITECTURE.md:362,922,936,937,1037,1041`・`14_edit.md:93,104`・`41_NudgeTargetRules.md:7`・`67_VertexTargetRules.md:6` はいずれも「Phase 12-01の時点では写し／Phase 12-02で括った」の経緯の書き方で、現在は括った後の記述）。
  * 相違（5章に記載。4件）：(1) `_doc/arch/03_VectorModel.md:19` の「`deleteShapes`は製品コードからの呼び出し元が無くなった」、(2) `_doc/arch/12_shapes.md:13` の「`classifyJoin`が`'close'`を返すのは選択が1本の`path`で頂点3つ以上の開いたパスのときだけ」、(3) 同行の「ボタンは押せる見た目で何も起きない」、(4) `_doc/arch/03_VectorModel.md:22` の頂点の選択の設定・解除と読み手の呼び出し元の一覧。（(2)(3)は同じ行・同じ段落の別の文。計4件）
* **推測・所見**:
  * 読み方が分かれる記述：`_doc/arch/03_VectorModel.md:3`（`+`行）と `:19`（`+`でない行）が同じファイル内で矛盾する。`:3` は`deleteShapes`の製品コードの呼び出し元に`PathVertexEditor`・`PathSplitEditor`を挙げ実コードと一致するが、`:19` の「呼び出し元が無くなった」は Phase 11-04a 時点の文が残ったもの（推測）。`PROJECT_ARCHITECTURE.md:381` は「呼ばれなかったが、Phase 12-01から…」と正しく更新されている。
  * 読み方が分かれる記述：`_doc/arch/12_shapes.md:13` の「何も起きないのは…ボタンは押せる見た目で何も起きない。直線2本の同じ形と同じ」は、結合ボタンの状態の話とも、`planJoin`が`null`で何もしない結果の話とも読める。ただし直前の「結合のボタン」の文脈では Phase 12-02 前の挙動（押せるが何も起きない）で、現在（`canJoin`が`planJoin`の結果）とは合わない。対応する `PROJECT_ARCHITECTURE.md:674` は「Phase 12-02から、この形を選ぶと結合のボタンは押せない見た目になる」と更新済み。5章へ上げた。
  * コードのコメント：検索の範囲では、頂点の選択・`deleteShapes`・`#collectTargets`・吸い付きに関して古い説明は見つからなかった（`InputTracker.js:695`・`PathJoiner.js:9-10,58`・`main.js:388` は現状と合っている）。既知の傷2（`VectorModel.js`の`replaceShape`・`addShapesWithNewIds`のJSDocの「呼び出し側が選択モードであること」）はタスク2の担当のため本タスクでは確かめていない。
  * 照合できなかった主張：なし（本タスクの項目はすべてコードで確かめられた）。
  * 補足（範囲外の気づき）：`03_VectorModel.md:22` の読み手の一覧に `TransformInputEditor`（Phase 10-03 から）も無い。`getSelectedVertices` の読み手の網羅は本タスクの項目外だが、同じ箇所の相違のため5章の(4)に併記した。

### タスク13: 要件2の検索（後半）
* **調査内容**: 
  * （未実施）
* **事実（実コードの記述）**:
  * （未実施）
* **推測・所見**:
  * （未実施）

## 5. 開発資料との相違
* `PROJECT_ARCHITECTURE.md` および `_doc/arch/` 配下の記述と、実コードに相違があった場合のみ記載する。
* 形式: **（対象：資料のファイルと節）**：（資料の記述）→（実コードの実態。`ファイル:行` を添える）（タスクN）
* 相違が見つからなかった場合は、タスク14で「相違なし」と記載する（未確認と区別するため）。

（タスク12の分。タスク13の分は続けて追記する。いずれも差分の`+`行でない記述）
* **（対象：`_doc/arch/03_VectorModel.md` 19行目の末尾）**：「`deleteShapes`は製品コードからの呼び出し元が無くなった（削除は`rearrangeItems`へ一本化。既存のテストが使うため残す）」→ 製品コードの呼び出しは `js/edit/PathVertexEditor.js:113` と `js/edit/PathSplitEditor.js:137` の2件（Phase 12-01・12-02から。同ファイル3行目・`PROJECT_ARCHITECTURE.md:381`・`14_edit.md:102-114` は正しく書かれており、同ファイル内で矛盾）（タスク12）
* **（対象：`_doc/arch/12_shapes.md` 13行目 `PathJoinRules` の項）**：「`classifyJoin`が`'close'`を返すのは選択が1本の`path`で頂点3つ以上の開いたパスのときだけ（今の曲線1本は閉じない）」→ `classifyJoin` の1本の分岐は `isJoinableLine` かつ `chainSourceOf(...).points.length >= 3` で、Phase 12-02から弧1本（頂点3つ）も `'close'`（`js/shapes/PathJoinRules.js:279-283`。同ファイル8行目・13行目の前の文・`PROJECT_ARCHITECTURE.md:673` は「弧は頂点3つで`'close'`」と書き、同行内で矛盾）（タスク12）
* **（対象：`_doc/arch/12_shapes.md` 13行目 `PathJoinRules` の項）**：「何も起きないのは、そうしてできた始点と終点が重なる頂点3つの開いたパスを閉じようとしたとき（まとめると頂点2つで`planJoin`が`null`を返す。ボタンは押せる見た目で何も起きない。直線2本の同じ形と同じ）」→ Phase 12-02から `canJoin` は `planJoin(...) !== null` で、この形を選ぶと結合のボタンは `disabled`（押せない見た目）（`js/edit/PathJoiner.js:62-67`・`js/main.js:392-393`。`PROJECT_ARCHITECTURE.md:674`・`12_shapes.md:8` は押せないと書く）（タスク12）
* **（対象：`_doc/arch/03_VectorModel.md` 22行目 頂点の選択の項）**：「設定・解除を呼ぶのは`InputTracker`と、`edit/PathCornerEditor`（…`setSelectedVertices`を呼ぶ。Phase 09-02b）」「そのほかに`getSelectedVertices`を読むのは`main.js`（`renderCurrentState`）・`edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/PathCornerEditor`」→ Phase 12-01・12-02から `PathVertexEditor` が `setSelectedVertices`（`js/edit/PathVertexEditor.js:81`）・`clearSelectedVertices`（`:104`）を、`PathSplitEditor` が `clearSelectedVertices`（`js/edit/PathSplitEditor.js:122`）を呼ぶ。読み手にも `PathVertexEditor`（`:124`）・`PathSplitEditor`（`:107`）・`TransformInputEditor`（`:134`）が加わる。同ファイル26行目（`+`行）は `PathVertexEditor`・`PathSplitEditor` の呼び出しを書いている（タスク12）
* **（対象：`PROJECT_ARCHITECTURE.md` 3章6.「履歴」の「削除（削除ボタン・`Delete`/`Backspace`…）と切り取り」の項。561行）**：「`model.deleteShapes`はここでは呼ばず、Phase 12-01から点の削除で図形ごと消えるときだけ`PathVertexEditor`が呼ぶ」→ 製品コードで `model.deleteShapes` を呼ぶのは `js/edit/PathVertexEditor.js:113` と `js/edit/PathSplitEditor.js:137` の2か所で、分割・区間の削除（Phase 12-02）で図形ごと消えるときは `PathSplitEditor.#apply` も呼ぶ（同じ資料の558行・「分割・区間の削除（Phase 12-02…）」の項も `model.deleteShapes(ids)` と書いており、561行の「だけ」と食い違う）。Phase 12-01のときは正しく、12-02で古くなった（`+`行）（タスク3）

## 6. 懸念事項・今後の修正における注意点
* （タスク14で、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」「コードのコメント」「照合できなかった主張」を、資料のファイルと節・要点・タスク番号の一覧としてまとめる）
* （タスク3）……561行の `deleteShapes` の呼び出し元の記述（5章）は、「ここでは呼ばず」と「だけ」のどちらを主張として読むかで重さが変わる。本調査では「`deleteShapes` を呼ぶ製品コードは `PathVertexEditor` だけ」という読み方を相違とした。
* （タスク3）……12.の注意事項 (b)・(c)・(d)・(a) と「確認の状況」の「テストプレイで確かめる」は、実際のマウス操作・見え方・重さに関する記述で、コードだけでは照合できない。目視確認を推奨する。
* （タスク3）……540行の「`InputTracker`は…`beginEdit`／`commitEdit`も呼ばない」は点の追加・削除の経路についてなら一致するが、`InputTracker` 全体への主張と読むと左ドラッグの記録の呼び出しと食い違う（読み方が分かれる）。
* （タスク3）……`js/core/KeyboardShortcuts.js` 57行の `join` の JSDoc が「開いたパス1本を閉じる」のままで、弧1本も閉じるようになった12-02の変更が反映されていない（コードのコメント）。
