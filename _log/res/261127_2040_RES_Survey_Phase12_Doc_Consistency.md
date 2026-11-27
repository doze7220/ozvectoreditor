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

* [x] タスク1: `PROJECT_ARCHITECTURE.md` 1章（フォルダ構成図・「存在しないもの」・「フォルダ分割の方針」・「依存方向」）の照合
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

* [x] タスク5: `PROJECT_ARCHITECTURE.md` 3章29.〜31.（頂点の追加と削除・線の分割と区間の削除・複合パス）の照合
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

* [x] タスク13: 要件2の検索（後半）：複合パス（12-04）・エンジンへの連絡（12-05）・行数・数え方
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
  * 対象：`PROJECT_ARCHITECTURE.md` 現在の15〜368行のうち、`git diff -U0 c30239d 5493428 -- PROJECT_ARCHITECTURE.md` の `+c,d` が15〜368に入るハンク（約75ハンク）。構成図（20〜158行のコメント付きの行、161〜354行のテストの行）、355行「存在しないもの」、357〜365行「フォルダ分割の方針」「依存方向」。
  * 新しい・変わった文の取り出しは、`-` 行と `+` 行を「。」で割り、`-` 側に同じ文が無い文を機械的に抜き出して行った（355行で約29文、358行で約13文、359行で約30文、360行で約5文、362行で約17文、365行で約16文。構成図のコメントは1行ずつ全文を開いて照合）。`--word-diff` の表示は文字化けしたため使わず、判定は資料の原文を開いて行った。
  * フォルダ構成図の照合：`PROJECT_ARCHITECTURE.md` 19〜354行の木を機械的に読み、`js/`・`test/`・`asset/` の実ファイル一覧（`os.walk`）と突き合わせた（資料301ファイル、実ファイル309。差はコメント付きの行に書かれた `asset/icon/` の4つのPNG・`asset/sprite/` の2つのJS・`index.html`・`sprite-check.html` の8件で、木の行としては載っていないだけ）。
  * import の照合：`js/` 配下の全ファイルの `import` 文（静的 import と、JSDoc の `import('…')` 型参照を分けて）を一覧にし（127ファイル）、「importは〜のみ」「〜から使う」「依存方向」の各主張と1つずつ突き合わせた。使う側の列挙は `grep -rlE "import[^;]*from '[^']*/<名前>\.js'|from '\./<名前>\.js'" js` で出した。
  * 公開物・条件の照合：`core/VertexEditRules`・`VertexDragRules`・`VertexTargetRules`・`CompoundPathRules`・`CompoundPathRenderer`・`GroupCommandRules`・`ItemRowRules`・`ItemAttributeRules`・`PointHitRules`、`shapes/PathVertexRules`・`PathSplitRules`・`VertexSnapRules`・`EndpointSnapRules`・`PathJoinRules`・`PathSegmentKindRules`・`Path`・`ShapeGeometry`、`edit/CompoundPathEditor`・`PathVertexEditor`・`PathSplitEditor`・`EndpointSnapper`・`ShapeStyleEditor`・`StyleEyedropper`、`palette/OptionBarSplitGroup`・`ItemListPanel`、`wiring/ItemListWiring`、`io/DocumentSerializer`・`SpriteSerializer`・`DrawElementReader`・`CodeExporter`、`index.html`・`sprite-check.html` を開いて確認した。
  * 「存在しないもの」「やらないと決めたこと」のうち、コードで真偽を確かめられるもの（`main.js` に操作モードの判定が無い、`isFillable` の値、吸い付く先・吸い付く図形種別、複数頂点のときの吸い付き、`evenodd` のみ、複合パスの各決定）を確認した。
  * 古い形が残っていないかの語検索（範囲は `PROJECT_ARCHITECTURE.md` 15〜368行）：`次のサブフェイズ`（0件）、`未連絡`（0件）、`版5の連絡`（1件。355行の「書き出し形式の版5の連絡はPhase 12-05で済んだ」で、過去形で正しい）、`版4`（0件）、`formatVersion`（0件）、`共通メソッド契約`（0件）、`18`（1件。ファイル名や章番号の一部）、``asset/`には``（0件）、``sprite/`だけ``（0件）、`製品コードから呼ばれ`（0件）、`呼び出し元は無い`（0件）。行数の記述（`[0-9,]{3,5}行`）は範囲内に0件。
  * 実行したコマンド：`git status --short`（作業の最初と最後。リポジトリ内の変更は無し。作業用のスクリプト・出力は結果ファイルと同じ scratchpad の下にだけ置いた）。
* **事実（実コードの記述）**:
  * **構成図の木（19〜354行）**：資料の木に載る `js/`・`test/` のファイルはすべて実在し、実在する `js/`・`test/` のファイルはすべて木に載っている（差分なし。`js/` 全体と `test/` 全体を `os.walk` で確認）。Phase 12 で新設のファイルの木の行も実在：`core/CompoundPathRules.js`・`CompoundPathRenderer.js`・`VertexTargetRules.js`・`VertexDragRules.js`・`VertexEditRules.js`、`shapes/PathVertexRules.js`・`PathSplitRules.js`・`VertexSnapRules.js`、`edit/CompoundPathEditor.js`・`PathVertexEditor.js`・`PathSplitEditor.js`、`palette/OptionBarSplitGroup.js`、新設のテストファイル（`test/core` に `CompoundPathRules`・`CompoundPathRenderer`・`GroupCommandRules.compound`・`ItemAttributeRules.compound`・`ItemRowRules.compound`・`PointHitRules.compound`・`VectorModel.snapPointVertex`・`VectorModel.compound`・`VertexDragRules`・`VertexEditRules`・`VertexTargetRules`、`test/shapes` に `PathJoinRules.close`・`PathSplitRules.split`・`.segments`・`PathVertexRules.locate`・`.insert`・`.remove`・`.select`・`ShapeGeometry.evenodd`・`OutlineMethods`・`EndpointSnapRules`・`.scan`・`VertexSnapRules`、`test/io` に `DocumentSerializer.compound`・`SpriteSerializer.compound`・`CodeExporter.compound`・`DrawElementReader.compound`、`test/edit` に `CompoundPath.flow`・`CompoundPathEditor`・`PathJoiner.close`・`PathVertexEditor`・`.items`・`PathSplitEditor`・`.items`・`EndpointSnapper.vertexSnap`・`.vertexSnap.flow`・`CompoundStyle`）。
  * **`asset/icon/`（158行）**：`asset/icon/` に `apple-touch-icon-180.png`・`favicon-32.png`・`icon-192.png`・`icon-512.png` の4つが実在。`index.html:7-10` と `sprite-check.html:7-10` の `<link>` がこの4つを指す。`js/`・`test/`・`asset/` の `.js` から `asset/icon` を参照する行は無い（`grep -rn "asset/icon"` で `index.html`・`sprite-check.html` の8行だけ）。
  * **index.html（20行）**：`#option-split-group`（`index.html:888`。2行目の `.toolbar-row` の中、`index.html:840` 以降）・`#option-split-at-vertices`（889）・`#option-delete-segments`（890）、`--toolbar-height: 80px`（16）、`--item-list-width: 240px`（19）、`.item-list-footer` の中で `#item-list-add-group` の後ろに `#item-list-compound`（894。`aria-pressed="false"`）、CSS `.item-list-compound[aria-pressed="true"]`（96）、`.item-row-folder-icon.is-compound`（161。地の色を変え `::after` に5pxの丸い穴）。
  * **core/ の各行**：
    * `InputModes` の使う側に `VertexEditRules`：`core/VertexEditRules.js:5` が `./InputModes.js` をimport。
    * `PointHitRules`：静的 import は `VertexHandleRules`・`CompoundPathRules` の2つ（`PointHitRules.js:7` ほか）。`classifyPointHit` の第8引数 `compoundPaths = []`（`PointHitRules.js:107`）。
    * `NudgeTargetRules` の使う側：`VertexTargetRules`・`edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/TransformInputEditor` の4つ（grep結果と一致）。
    * `VertexTargetRules`：静的 import は `./NudgeTargetRules.js` のみ。`collectVertexTargets`（`VertexTargetRules.js:27`）をexport。使う側は `edit/PathCornerEditor`・`PathVertexEditor`・`PathSplitEditor` の3つだけ。
    * `VertexDragRules`：import無し。`buildVertexDragUpdates`（`VertexDragRules.js:37`）をexport。使う側は `core/InputTracker.js:18` だけ。
    * `VertexEditRules`：import は `InputModes` だけ。`resolveDeleteRoute`（25）・`resolveDoubleClickInsertTarget`（41）をexport。使う側は `InputTracker.js:16` だけ。
    * `ItemTreeRules`：JSDocの `GroupItem` 相当の typedef に `compound`（`git diff c30239d HEAD` で `@property {true} [compound]` の1行のみ追加。コードの変更なし）。使う側は16ファイル（下の所見参照）。
    * `ItemAttributeRules`：`resolveItems` が `compound !== true` のとき `delete item.compound`（`ItemAttributeRules.js:104-105`）。importは `ItemTreeRules`・`ShapeFactory` のみ。
    * `ItemRowRules`：静的 import は `ItemTreeRules`・`GroupTreeRules`・`ItemPlaceRules`・`ItemStateRules`・`CompoundPathRules`（`ItemRowRules.js:9` が `isCompoundGroup`）。`ItemRow`・`RowView` に `compound` のプロパティ（`ItemRowRules.js:24`・`51`。値は99・238行で作る）。
    * `ItemPlaceRules` の使う側（`InsertTargetRules`・`ItemRowRules`・`ListDragRules`・`SoloVisibilityRules`・`VectorModel`・`edit/GroupEditor`・`edit/ShapeOrderEditor`・`edit/PathSplitEditor`・`wiring/ItemListWiring`）：grep結果（9ファイル）と過不足なく一致。
    * `GroupCommandRules`：`resolveCompoundButtonState`（68）・`canToggleCompound`（86）を追加。静的 import は `InputModes` のみ。
    * `CompoundPathRules`：静的 import は `ItemTreeRules`・`ItemStateRules` のみ（8行目の `import('./ItemTreeRules.js')` は型参照）。状態を持たない関数群で、属性 `compound` の読み書き（`isCompoundGroup`・`setCompound`・`resolveCompoundToggle`）、効いている複合パスの中身と一番下の図形（`listCompoundPaths`。`shapes[0]` が一番下、`style` は一番下の図形の値）、描く単位（`buildDrawUnits`）、塗られた所（`isInsideCompoundFill`・`hitTestCompoundFill`）、スタイルの読み替え（`resolveStyleTargets`）。使う側は `CanvasManager`・`ItemRowRules`・`PointHitRules`・`VectorModel`・`edit/CompoundPathEditor`・`edit/ShapeStyleEditor`・`edit/StyleEyedropper`・`io/SpriteSerializer`・`wiring/ItemListWiring` の9ファイル（grepと過不足なく一致。`main.js` は import しない）。
    * `CompoundPathRenderer`：import無し。`drawCompoundPath`（`CompoundPathRenderer.js:14`）をexport。使う側は `CanvasManager` だけ。順は `beginPath` → 輪郭ごとの `appendOutline` → `fill('evenodd')` → `stroke`（`CompoundPathRenderer.js:21-35`）で、`CodeExporter.js:160-206` の `drawCompoundPath`（`beginPath` → 輪郭ごと → `fill('evenodd')` → `stroke`）と同じ順。
    * `core/` 内の import（`CanvasManager → CompoundPathRules`・`CompoundPathRenderer`、`VectorModel → CompoundPathRules`、`PointHitRules → CompoundPathRules`、`ItemRowRules → CompoundPathRules`、`InputTracker → VertexDragRules`・`VertexEditRules`、`VertexTargetRules → NudgeTargetRules`）はすべて静的 import として実在。逆向き（`CompoundPathRules` が使う側をimportする）は無い。
    * `main.js` → `CanvasManager` の複合パスの受け渡し：`main.js:247` の `compoundPaths: model.getCompoundPaths()`。
  * **shapes/ の各行**：
    * `Path.js`：`resolveSegmentControls`（`Path.js:122`）と `SMOOTH_SEGMENT_SAMPLE_COUNT`（`Path.js:53`）を export。`Path` 内の `#segmentControls()` は `resolveSegmentControls(this)` を呼ぶだけ（`Path.js:213-214`）。`PathVertexRules.js:12・266` も使う。
    * `ShapeGeometry`：`cubicBezierPoint`（107）・`applyAffineTransformToPoint`（283）・`isPointInPolygonEvenOdd`（232。`n < 3` は偽、境界の上は偽、交差の数の偶奇）。`isPointInPolygonEvenOdd` を呼ぶのは `Rect.js:147`・`Curve.js:160`・`Ellipse.js:563`・`Path.js:421` で、どれも `isInsideOutline` の中だけ。`core/RotationRules.js:7` が `applyAffineTransformToPoint` を、`PathVertexRules.js:16` が `cubicBezierPoint` を import。
    * `PathJoinRules`：`chainSourceOf`（130。`PathVertexRules.js:15・112` が使う）、`endpointVertexIndexOf`（224。`PathSplitRules.js:7・87-88` が使う）、`lineEndpointOf`（208。`VertexSnapRules.js:5` が使い、弧は `snapVerticesOf` で始点・終点を読む）、`buildClosedPath`（299。頂点3つ以上の開いたパスと弧1本を閉じる）。`segmentKindsOf`（101。「`type` が `'line'` なら直線の区間1つ」の唯一の定義箇所と本文に記載）・`segmentSpecsOf`（115）を `PathSegmentKindRules.js:7` と `PathVertexRules.js:15` が使う。
    * `EndpointSnapRules`：`findNearestSnapPoint`（113）・`snapDistance`（98）を export。`VertexSnapRules.js:4` が両方を import。`EndpointSnapRules` の静的 import は `PathJoinRules` のみ。
    * `VertexSnapRules`：静的 import は `EndpointSnapRules`・`PathJoinRules`・`PathVertexRules` の3つ。`snapVerticesOf`（44。図形の種類の分岐はここだけ）、`findVertexSnapTarget`（66。`findNearestSnapPoint` に任せる）、`chooseSnapTarget`（82）、描き始めで働く図形種別 `line`・`curve`・`rect`・`arc`・`circle`（93）、2つ目の点で働く図形種別は `rect` だけ（104。円・弧は外接する四角の角で、発注者の決定 2026-11-27 と本文に記載）。使う側は `edit/EndpointSnapper.js` だけ。
    * `PathVertexRules`：`outlineSourceOf`（88。直線・矩形・今の曲線・パスを読み、円・弧ほかは `null`。矩形を閉じた4つの直線の区間として読む箇所はここだけ）、`outlineVertexIndexOf`（139）、`selectedSegmentIndexesOf`（165）、`findNearestSegmentLocation`（260）、`splitCubicBezier`（294）、`planVertexInsertion`（320）、`planVertexRemoval`（482）。`outlineVertexIndexOf`・`selectedSegmentIndexesOf` は `PathSplitRules.js:6`・`PathSegmentKindRules.js:9`（`selectedSegmentIndexesOf`）が使う。`outlineSourceOf` は `VertexSnapRules.js:6`・`PathSplitRules.js:6` が使う。
    * `PathSplitRules`：`planSplitAtVertices`（230）・`planSegmentDeletion`（251）・`resolveSplitAvailability`（269）、内部の `buildPieces`（112。呼ぶのは237・258行の2か所）・`orderPieces`（186。元の行を引き継ぐ1本を先頭にする）。静的 import は `Path`・`PathVertexRules`・`PathJoinRules`。
    * `shapes/` 内の import：`EndpointSnapRules → PathJoinRules`、`VertexSnapRules → EndpointSnapRules`・`PathJoinRules`・`PathVertexRules`、`PathCornerRules → Path`、`PathSegmentKindRules → Path`・`Line`・`PathJoinRules`・`PathCornerRules`・`PathVertexRules`、`PathVertexRules → Path`・`Line`・`PathJoinRules`・`ShapeGeometry`、`PathSplitRules → Path`・`PathVertexRules`・`PathJoinRules`、`PathJoinRules → Path`・`Line`。図形クラス（`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）は `ShapeGeometry`・`ShapeDataValidation` しか import しない。`VertexSnapRules` をimportする `shapes/` のファイルは無い（循環なし）。
    * `isFillable()`：`Line`・`Curve` は常に偽（`Line.js:49`・`Curve.js:59`）、`Rect` は真（`Rect.js:53`）、`Ellipse` は `type === 'circle'`（`Ellipse.js:99`）、`Path` は `closed === true`（`Path.js:204`）。Phase 12-04 の図形クラスの差分は `appendOutline`・`isInsideOutline` の追加が中心で、`draw` の出力は変えていない（`Path` は `#tracePath` を `beginPath` ＋ `#traceSubpath` に分けただけ）。
  * **palette/・wiring/**：`OptionBarSplitGroup`（`#option-split-group`・`#option-split-at-vertices`・`#option-delete-segments` の2ボタン。import無し。`aria-pressed` を付けない）。`ItemListPanel`：import無し、`onCompoundToggle`（98）、`renderCompoundButton({ enabled, pressed })`（291）、`classList.toggle('is-compound', compound)`（408）。`ItemListWiring`：コンストラクタが `compoundPathEditor` を受け（100）、`sync` の中（192〜210）で `this.#panel.renderCompoundButton(this.#resolveCompoundButtonState())`、`GroupCommandRules` の `resolveCompoundButtonState`・`canToggleCompound` を使う（27行目の import）。`wiring/` 内の import は `ItemListWiring → ItemListRowDrag` の1件だけ。
  * **edit/**：`CompoundPathEditor`（`beginEdit` → `setGroupCompound` → `commitEdit`。`CompoundPathEditor.js:51-53`。`model` は `getItems`・`setGroupCompound` だけ）。`ShapeStyleEditor`：`resolveStyleTargets(this.#model.getEditableSelectedShapes(), this.#model.getCompoundPaths())`（`ShapeStyleEditor.js:311`）。`StyleEyedropper`：省ける依存 `getCompoundPaths = () => []`（61）と `findCompoundOf`（132。複合パスの中は `compound.style` を使う）。`PathCornerEditor`・`PathVertexEditor`・`PathSplitEditor` はどれも `collectVertexTargets(this.#getMode(), …)` を呼ぶ `#collectTargets` を持ち、`getMode` の戻り値を解釈しない。`PathVertexEditor` は `PathVertexRules` の `planVertexInsertion`・`planVertexRemoval`、`PathSplitEditor` は `PathSplitRules` の3つと `ItemTreeRules`・`ItemPlaceRules` を import。`EndpointSnapper` は `#toUsableSnap`（`EndpointSnapper.js:483`。結合の反映の入口4か所で使う）を持つ。
  * **io/**：`DocumentSerializer.deserializeShapeElements(elements, toShapeData, toCompoundShapeData = null)`（329。第3引数が複合パスの図形データ配列を返すとフォルダ `{ type: 'group', compound: true, children }` を組み立てる。346-347行）。`type: 'group'` の語（`GROUP_TYPE`）を持つのは io/ の中では `DocumentSerializer` だけ（`DrawElementReader`・`SpriteSerializer`・`FileContentReader`・`CodeExporter` に `'group'` は無い）。`DrawElementReader` は `compoundPath` を輪郭ごとの図形データ配列へ変換（263〜）。`SpriteSerializer` は `core/CompoundPathRules` を import し `buildCompoundPathElement`（`kind, outlines, strokeColor, strokeWidth, fillColor` の順）で `compoundPath` を作る。io/ の静的 import：`DocumentSerializer → ShapeFactory`・`ItemTreeRules`・`ItemAttributeRules`、`SpriteSerializer → ItemTreeRules`・`ItemStateRules`・`CompoundPathRules`、そのほかは io/ 内だけ。io/ から `edit/`・`shapes/` への import は無い。
  * **「依存方向」の数え方**：`edit/ → core/` を静的 import する `edit/` のファイルは、`ClipboardController`・`CompoundPathEditor`・`GroupEditor`・`ItemRenameEditor`・`ItemStateEditor`・`NudgeEditor`・`PathCornerEditor`・`PathSplitEditor`・`PathVertexEditor`・`PositionInputEditor`・`PositionInputRules`・`ShapeOrderEditor`・`ShapeStyleEditor`・`SnapshotAdapter`・`StyleEyedropper`・`TransformInputEditor`・`TransformInputRules` の17ファイル（資料の「17ファイル」と一致。`CanvasFileOperations`・`CanvasLibrary`・`EndpointSnapper`・`PathJoiner`・`ShapeAlignEditor`・`ShapeAlignRules`・`ShapeExtentReader`・`ShapeInserter`・`ShapeOrderRules`・`StylePanelRules` は静的に `core/` を import しない）。`edit/ → shapes/` は `PathJoiner`・`EndpointSnapper`・`PathCornerEditor`・`PathVertexEditor`・`PathSplitEditor` の5ファイルだけで、資料が挙げる5つと一致。`core/ → shapes/` の静的 import は `ShapeFactory`・`RotationRules` の2ファイルだけ（JSDocの型参照は core/ では `ScaleHandleRules`・`RotationRules` の `ShapeGeometry`）。`wiring/` が import するのは `palette/`・`edit/`・`core/`・`asset/sprite/` で、`main.js` だけが `wiring/` を import。`core/`・`palette/`・`asset/sprite/` から上位フォルダへの静的 import は無い。`check/ → io/`（`SpriteCheckInspector → SpriteSerializer`）。
  * **`InputTracker` の第7引数（365行）**：項目は `duplicateSelection`・`isPickingShape`・`pickShape`・`getUnitSnapStep`・`getSelectionFrameBounds`・`getReferencePoint`・`deleteSelectedItems`・`insertVertexAt`・`hasRemovableVertices`・`removeSelectedVertices` の10個（`InputTracker.js:148-168`、`458` のコンストラクタの第7引数 `inputAssist`、`470-498` の置き換え）。`canDeleteSelectionOrVertices()` は `InputTracker.js:869`、`main.js:351` の `deleteSelectionBtn.disabled = !inputTracker.canDeleteSelectionOrVertices()`。
  * **「存在しないもの」の新しい文**：
    * `main.js` の削除ボタンの見た目：`main.js:342-351`（押せるかの照会は `canDeleteSelectionOrVertices()` の1つだけ。モードの判定は `VertexEditRules`、照会は `InputTracker` と書かれている）。
    * 点の追加はダブルクリック（`InputTracker.js:562` の `dblclick` → `handleDoubleClick`）、削除は `Delete`（`KeyboardShortcuts.js:172` の `Delete`・`Backspace` → `deleteSelection`）、結合は `J`（`KeyboardShortcuts.js:174`）・🔗（`index.html:829`）。
    * `PathJoinRules.buildClosedPath` は頂点3つ未満・頂点2つ・閉じたパス・矩形・円で `null`（点2つの閉じたパスは作れない）。`outlineSourceOf` は円・弧で `null`（円・弧の点の追加・削除・分割・区間の削除の対象外）。
    * `VertexSnapRules.snapVerticesOf` は、直線の両端・矩形の4角・今の曲線の始点終点・パスの全点・弧の両端と中心・円の中心で、区間の上・外枠の角・グリッドの交点・中心（円・弧以外）は含まない。
    * `InputTracker.js:1680` の `findVertexDragSnap` は頂点のドラッグだけで呼ばれ（`#snapAssist` の呼び出し箇所の一覧に選択の本体のドラッグ・拡大縮小・回転・矢印キーの吸い付きは無い）、結合する吸い付きは動かす点が1つのときだけ `#dragEndpoint` を持つ（`InputTracker.js:1520-1523`）。吸い付くだけは押した点（アンカー）について `#vertexDragOrigins` の図形のidを除外して常に照会する（`1680`）。
    * 複合パス：`CompoundPathRenderer` は `evenodd` のみ（`fill('evenodd')`）。`resolveCompoundButtonState` はドラッグ中・ロック中を見た目に含めない（`GroupCommandRules.js:58-60`）。`resolveStyleTargets` は `baseEditable` が偽の複合パスを飛ばす（`CompoundPathRules.js:282`）。`classifyPointHit` は編集できる図形だけを渡される（`InputTracker.js:2032` のコメント。ロックされた図形は素通り）。`CodeExporter` の `drawCompoundPath` は `outlines` が空・配列でない・`canTrace` が偽の輪郭が1つでもあれば何も描かない（`CodeExporter.js:165-179`）。内側の複合パスのフォルダにも `ItemRow.compound` が付く（`ItemRowRules.js:99`）。選択の外枠・全体の外枠は図形ごとの `computeShapesBounds([shape])`／`computeShapesBounds(visibleShapes)` で、複合パスのスタイルは使わない（`ShapeExtentReader.js:39・77・86`）。塗れる形（`isFillable`）は上のとおり。
  * **照合した主張の数の目安**：構成図のコメント付きの行のうち `+` 行を含むもの約35行（新しい文は1〜10文ずつ。約90文）、構成図のテストの行の追加約45行（すべて実在を機械で確認）、355行の新しい文29（コードで確かめられるもの約15、方針・経緯のもの約14）、357〜365行の新しい文約80。
* **推測・所見**:
  * 相違として5章に挙げたものは4件（`ItemTreeRules` の使う側の列挙の欠け・`InputModes` の使う側の列挙の欠け・`CompoundPathRules` の「4か所」・365行と358行の段の食い違い）。それ以外の主張は、上の照合の範囲で実コードと一致した。
  * 5章に挙げた（4件目）：365行の段の列挙（`ItemRowRules` を `InsertTargetRules` と同じ段とする。この文は `-` 行にもあった文＝Phase 12 より前の文）と358行の新しい文（`CompoundPathRules` が `InsertTargetRules` 等と同じ段、`ItemRowRules` が次、`ListDragRules` がその次）が、同じ `+` 行の中で食い違う。コードは358行側に合う：`ItemRowRules.js:8-9` が `ItemStateRules`・`CompoundPathRules` を import（`CompoundPathRules.js:6` が `ItemStateRules` を import）、`InsertTargetRules.js:5-8` は `ItemRowRules` の `resolveRowIndent` を使わず（`ItemTreeRules`・`GroupTreeRules`・`GroupSelectionRules`・`ItemPlaceRules` のimport）、`ListDragRules.js:6` が `ItemRowRules` を import。
  * 5章に挙げた（1件目）：構成図 `ItemTreeRules.js` の行（`PROJECT_ARCHITECTURE.md:60`）の使う側の列挙は `+` 行で書き換えた文（`-` 行には `edit/PathSplitEditor` が無い）。15ファイルを挙げるが、`grep -rlE "from '[^']*/ItemTreeRules\.js'|from '\./ItemTreeRules\.js'" js` は16ファイルで、`core/CompoundPathRules`（`CompoundPathRules.js:5`）が無い。
  * 5章に挙げた（2件目）：構成図 `InputModes.js` の行（`PROJECT_ARCHITECTURE.md:29`）の使う側の列挙は `VertexEditRules` を足した `+` 行で書き換えた文。`grep -rlE "from '[^']*/InputModes\.js'|from '\./InputModes\.js'" js` は12ファイルで、`core/GroupCommandRules`・`core/ItemListRules` が無い（Phase 12 より前からのずれ）。足された `VertexEditRules` は正しい（`VertexEditRules.js:5`）。
  * 読み方が分かれる記述：355行の「`main.js`に操作モードの判定は無い」は、直前の「（削除ボタンの見た目は頂点の選択で変わるが、判定は`core/VertexEditRules`・照会は`InputTracker.canDeleteSelectionOrVertices()`で、…）」の文脈では削除ボタンの見た目の判定のことで、削除ボタンの見た目の判定に限れば一致（`main.js:342-351`）。`main.js` 全体では、`inputTracker.getMode()` の比較が残っている（`main.js:109-110`・`236-238`・`479`・`515`。Phase 12 より前から）。
  * 5章に挙げた（3件目）：358行の「`CompoundPathRules`は、描画（`main.js`→`CanvasManager`）・当たり判定（`PointHitRules`）・スタイル（`edit/`）・書き出し（`io/SpriteSerializer`）の4か所から使われる」は `-` 行に同じ文が無い新しい文。実際に import するのは `CanvasManager`・`ItemRowRules`・`PointHitRules`・`VectorModel`・`edit/CompoundPathEditor`・`edit/ShapeStyleEditor`・`edit/StyleEyedropper`・`io/SpriteSerializer`・`wiring/ItemListWiring` の9ファイルで、`main.js` は import しない。
  * 照合できなかった主張：158行（`asset/icon/`）の「OZ Engine の土台の assets/icon/ の4つのPNGを中身を変えずにコピーしたもの」と、355行の「OZ Engineへの連絡（書き出し形式の版5の連絡はPhase 12-05で済んだ）」は、本リポジトリの外（OZ Engine）のことなので確かめられない。
  * 照合できなかった主張：355行の「発注者の決定、2026-11-27」「計画で決めたこと」「Phase 12-0x でやらないと決めたこと」のうち、「点を足した直後のカーソルの形の再評価」「修飾キーでダブルクリックのふるまいを変えること」「分かれた線を自動でまとめること」「切った点の位置をずらすこと」などの、方針として「やらない」と書かれた項目は、コードに存在しないことをすべて網羅して確かめる手段が無い（ここでは、`J`・🔗の結合、点2つの閉じたパス、円・弧の点の追加・削除・分割、吸い付く先の頂点の範囲、2つ目の点の吸い付き、`evenodd` のみ、など、コードで確かめられるものだけを確認した）。是非は扱わない。
  * 対象外で見つけた記述：特に無し（15〜368行の範囲の外を探しに行っていない）。
  * コードのコメント：この担当で開いた範囲で、古い説明のコメントは見つからなかった（`InputTracker.js:148-168`・`265-267`、`VertexSnapRules.js`、`PathSplitRules.js`、`GroupCommandRules.js:55-61`、`CompoundPathRenderer.js` の冒頭は現状と合っている）。既知の傷2〜5はこのタスクの担当ではない。
  * 作業の最初と最後に `git status --short` を確認し、リポジトリ内のファイル（ソースコード・資料・RES）に変更は無かった（`imports.json` を一時的にリポジトリ直下へ出力したが、直後に削除した。`git status` は空）。

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
  * 範囲：`PROJECT_ARCHITECTURE.md` 3章 1035〜1062行（29.＝1035〜1043、30.＝1044〜1053、31.＝1054〜1062。1063行は空行、1064行は `---`）。`git diff -U0 c30239d 5493428 -- PROJECT_ARCHITECTURE.md` のハンク `+1035,28` が1035〜1062行をすべて `+` 行として足している（この範囲に `-` 行は0本。全文が新しい文）。範囲内の他のハンクは無い。
  * 照合した文の数の目安：29.＝約55文（9行）、30.＝約62文（10行）、31.＝約57文（9行）。計約170文。各行を全文開いて文ごとにコードと照合した。
  * 照合に使ったコード：`js/core/InputTracker.js`・`js/core/VertexEditRules.js`・`js/core/VertexTargetRules.js`・`js/shapes/PathVertexRules.js`・`js/edit/PathVertexEditor.js`・`js/shapes/PathSplitRules.js`・`js/edit/PathSplitEditor.js`・`js/palette/OptionBarSplitGroup.js`・`js/core/CompoundPathRules.js`・`js/core/CompoundPathRenderer.js`・`js/edit/CompoundPathEditor.js`・`js/main.js`・`js/core/KeyboardShortcuts.js`・`js/core/VectorModel.js`・`js/core/PointHitRules.js`・`js/core/CanvasManager.js`・`js/core/GroupCommandRules.js`・`js/wiring/ItemListWiring.js`・`js/palette/ItemListPanel.js`・`js/edit/ShapeStyleEditor.js`・`js/edit/StyleEyedropper.js`・`js/edit/StylePanelRules.js`・`js/io/SpriteSerializer.js`・`js/io/CodeExporter.js`・`js/io/DocumentSerializer.js`・`js/io/DrawElementReader.js`・`js/io/FileContentReader.js`・`js/shapes/Path.js`・`Line.js`・`Rect.js`・`Curve.js`・`Ellipse.js`・`PathJoinRules.js`・`EndpointSnapRules.js`・`VertexSnapRules.js`・`index.html`・`test/` 配下。
  * 動かして確かめたもの：一時スクリプト（スクラッチパッド `t5check.mjs`。リポジトリ外）で `PathSplitRules`・`PathVertexRules` を直接呼び、表A・表B・点の削除・点の追加の結果を確かめた。`node --test`（ファイルを書き換えない実行）は 4199 件・pass 4199・fail 0。
  * 漏れ・古い記述を探す検索（範囲 1035〜1062行に対する `sed -n 1035,1062p PROJECT_ARCHITECTURE.md | grep -cE "<式>"` の件数）：`版4`＝1、`4のまま`＝2、`3801|3910|4199`＝3、`の写し`＝3、`nonzero`＝0、`版5`＝4、`未連絡|次のサブフェイズ`＝0、`写し`＝4、`VertexDragRules`＝0（ファイル一覧に挙がっているが、この範囲に記述は無い）。ヒットした `版4`・`4のまま`・`の写し` は下の「推測・所見」で扱った。
  * import の向きを探す検索：`grep -rn "VertexEditRules\|VertexTargetRules\|PathSplitRules\|PathVertexRules" js --include=*.js | grep "^js/[^:]*:[0-9]*:import"`＝9件（`InputTracker`→`VertexEditRules`、`PathCornerEditor`・`PathSplitEditor`・`PathVertexEditor`→`VertexTargetRules`、`PathSplitEditor`→`PathSplitRules`、`PathVertexEditor`→`PathVertexRules`、`PathSegmentKindRules`・`PathSplitRules`・`VertexSnapRules`→`PathVertexRules`）。
  * 使われ方を探す検索：`grep -rn "appendOutline\|isInsideOutline" js -l`＝7ファイル（`Curve`・`Ellipse`・`Line`・`Path`・`Rect`・`CompoundPathRenderer`・`CompoundPathRules`）、`grep -rn "getCompoundPaths\|buildDrawUnits\|drawCompoundPath\|findCompoundOf\|resolveStyleTargets\|hitTestCompoundFill\|isInsideCompoundFill\|mapCompoundsByShape" js`（`CompoundPathRules.js` を除く）＝呼び出し元 `CanvasManager`・`PointHitRules`・`InputTracker`・`VectorModel`・`ShapeStyleEditor`・`StyleEyedropper`・`SpriteSerializer`・`main.js`（`CodeExporter` は書き出す文字列の中）。
* **事実（実コードの記述）**:
  * **29. 頂点の追加と削除**
    * 流れ（点を足す）：一致。`InputTracker.js:562` が `dblclick` を購読、`handleDoubleClick`（`InputTracker.js:1297`）が `#classifyPoint`（`InputTracker.js:2043`）の結果を `resolveDoubleClickInsertTarget`（`VertexEditRules.js:36`）へ渡し、id が返ったときだけ `#inputAssist.insertVertexAt`（`InputTracker.js:1309`）。`main.js:210` が `pathVertexEditor.insertAt` を注入、生成は `main.js:993-996`（`// 7.16.`）。`PathVertexEditor.insertAt`（`PathVertexEditor.js:73-84`）の手順（`getEditableShapes()` から探す→`planVertexInsertion` が `null` なら `false`→ハンドル名を `getVertexIndexForHandle(名前) === plan.insertedIndex` で求める→`beginEdit`→`replaceShape(…, { keepId: true, select: true })`→`setSelectedVertices`→`commitEdit`）が文面と一致。ハンドル名の求め方は `PathCornerEditor.js:138-158`（`#remapSelectedVertices`）と同じ形。足した直後にカーソルを更新する呼び出しは `handleDoubleClick` に無い（`InputTracker.js:1297-1310`）。
    * 流れ（点を消す）：一致。`deleteLastLinePointOrSelection`（`InputTracker.js:882-884`、`main.js:1122` で `deleteSelection` に注入）→`deleteSelectionOrVertices`（`InputTracker.js:853-863`）→`removeSelectedVertices`（`main.js:212`→`PathVertexEditor.js:100-116`）。手順（`planVertexRemoval(#collectTargets())` が空なら `false`→`beginEdit`→`clearSelectedVertices`→図形ごとに `replaceShape(…, { keepId: true, select: false })`→`deleteShapes`→`commitEdit`）一致。`#collectTargets()` は `collectVertexTargets(getMode(), getSelectedIds(), getSelectedVertices(), getShapes())` を呼ぶだけ（`PathVertexEditor.js:123-125`）。`collectVertexTargets`（`VertexTargetRules.js:29-39`）は `resolveNudgeTarget` が `'vertices'` のときだけ集める。`PathCornerEditor.js:164-166`・`PathSplitEditor.js:106-108` も同じ関数を呼ぶ。削除ボタンの照会は `canDeleteSelectionOrVertices`（`InputTracker.js:869-874`）、`main.js:350-352` の `syncDeleteButtonState`。`VectorModel.deleteShapes`（`VectorModel.js:929-948`）は図形のアイテムだけを除き、選択集合・頂点の選択（その図形の組）から外す。`replaceShape` の `select: false` は生き残るidを選択に残す（`VectorModel.js:1115-1130`）。頂点の選択は `setSelectedVertices`（`VectorModel.js:521-538`）が選択集合に入り変えられる図形だけを受理する。
    * `VertexEditRules`：`DELETE_ROUTE`（`ITEMS`・`VERTICES`）・`resolveDeleteRoute`・`resolveDoubleClickInsertTarget`、import は `InputModes` のみ（`VertexEditRules.js:5`）。一致。`PathVertexEditor` の公開は `insertAt`・`canRemoveSelectedVertices`・`removeSelectedVertices`、import は `VertexTargetRules` と `PathVertexRules` のみ（`PathVertexEditor.js:6-7`）。`InputTracker` の import に `edit/` は無い（`InputTracker.js:7-21`）。`KeyboardShortcuts.js:55` の `deleteSelection` の JSDoc は「頂点の選択では選んだ点を消す」に更新済み。
    * 結果の規則：`Path.resolveSegmentControls`（`Path.js:122`）を `Path.js` の `#segmentControls`（`Path.js:213`）が呼び、その使用先は描画（`#traceSubpath` 235）・当たり／範囲選択（`#someSegment` 260）・塗りの内側（`#fillPolygon` 295）・書き出し（`toDrawElement` 580）、点の追加（`PathVertexRules.js:267` の `resolveSegmentControls`）。`PathJoinRules.chainSourceOf`（`PathJoinRules.js:130`）・`segmentSpecsOf`（`PathJoinRules.js:115`）は `export`。2章 `path` の「頂点の追加・削除」の項は `PROJECT_ARCHITECTURE.md:388` にある。
    * 足す・消すの結果（スクリプトで実行）：直線の途中に足すと `path`（点3・`insertedIndex` 1）、矩形の辺に足すと閉じた `path`（点5）、今の曲線に足すと `path`（点3）、閉じた3点パスの最後の区間に足すと `insertedIndex` は 3（末尾）。消す側は、閉じた3点パスの1点→開いた2点の `path`、2点→図形ごと消える、矩形の1点→閉じた3点、隣り合う2点・向かい合う2点→開いた2点の `path`、今の曲線の1点→`line`、2点→消える、直線の1点→消える。区間の種類の規則は `connectRun`（`PathVertexRules.js:385-401`。すべて `line`→`line`、すべて `bezier`→前の `control1`＋後の `control2` の `bezier`、それ以外→`smooth`）。`t` が0か1なら `null`（`PathVertexRules.js:329`）、円は `null`（実行結果）。許容幅の測り方は `SMOOTH_SEGMENT_SAMPLE_COUNT = 100`（`Path.js:53`）、`Curve.hitTest` は101点（`Curve.js:101-113`）。
    * `VectorModel.replaceShape`（`VectorModel.js:1098`）・`addShapesWithNewIds`（`VectorModel.js:1034`）の JSDoc は今も「呼び出し側が選択モードであること」のまま。`_doc/arch/03_VectorModel.md` に「選択モード・頂点の選択モード以外では空」の記述が1件ある（文面 29.(i)・30.(g) の「古い」「`VectorModel.js` は変えず `03` に正しい記述を残す」と一致）。
    * `test/` のファイル：`PathVertexRules.locate/insert/remove/select`・`VertexEditRules`・`VertexTargetRules`・`PathVertexEditor`・`PathVertexEditor.items` はすべて存在する。`PathVertexRules.insert.test.js:286` に「「曲線に」の結果が今の値のまま」の describe がある。
  * **30. 線の分割と区間の削除（閉じるの拡張を含む）**
    * 流れ（表示）：`main.js:1031-1035`（`syncOptionBarSplitGroup`＝`optionBarSplitGroup.render(pathSplitEditor.getAvailability())`、`model.onChange` に登録）、起動時の明示呼び出しは `main.js:1284`。`getAvailability`＝`resolveSplitAvailability(#collectTargets())`（`PathSplitEditor.js:79-81`）。`main.js` に操作モードの判定は無い（`InputTracker.setMode`（`InputTracker.js:596-608`）が `model.clearSelection()` を呼び、`clearSelection` は常に通知する（`VectorModel.js:422-426`））。`OptionBarSplitGroup.render`（`OptionBarSplitGroup.js:80-84`）は `disabled` だけを書く。
    * 流れ（入力）：`OptionBarSplitGroup.js:66-71` の `click`→`onSplit`／`onDeleteSegments`→`main.js:1013-1019` の `performPathSplit`（`inputTracker.isDragging()` なら `false`、それ以外は `applySplit()` の戻り値）。`PathSplitEditor.#apply`（`PathSplitEditor.js:115-141`）の手順が文面①〜④と一致（元の選択・選んでいるフォルダ・`listShapeItems(getItems())` を控える→`beginEdit`→`clearSelectedVertices`→ピースが空なら消す図形へ控え、そうでなければ `replaceShape(targetId, pieces[0], { keepId: true, select: false })`、ピース2つ以上は `addShapesWithNewIds(…, { place: { kind: PLACE_KIND.ABOVE, id: targetId } })`→`deleteShapes`→`setSelection([...元の選択, ...新しいid], { groupIds })`→`commitEdit`）。新しい線の値に `visible`・`locked` は渡さない（`PathSplitEditor.js:133`）。補う値は `visible = true`・`locked = false`（`ItemAttributeRules.js:94,97`）。`replaceShape`・`addShapesWithNewIds`・`deleteShapes`・`setSelection` はそれぞれ通知を出す（`VectorModel.js` の各メソッド末尾の `#notifyChange()`）。
    * モジュールの分担：`PathSplitRules` の import は `Path`・`PathVertexRules`・`PathJoinRules` のみ（`PathSplitRules.js:5-7`）、公開は `planSplitAtVertices`・`planSegmentDeletion`・`resolveSplitAvailability`、ピースを作る非公開関数は `buildPieces`（`PathSplitRules.js:112`）、1本の決め方は `orderPieces`（`PathSplitRules.js:186`）、束ねる非公開関数は `collectEntries`（`PathSplitRules.js:53`）。輪郭の元＝`outlineSourceOf`・輪郭の番号＝`outlineVertexIndexOf`・選んでいる区間＝`selectedSegmentIndexesOf`・端の判定＝`endpointVertexIndexOf` を使う。`VertexTargetRules` の import は `NudgeTargetRules` のみ（`VertexTargetRules.js:6`）。`PathSplitEditor` の import は `VertexTargetRules`・`ItemTreeRules`・`ItemPlaceRules`・`PathSplitRules` のみ（`PathSplitEditor.js:6-9`）。公開は `getAvailability`・`splitAtSelectedVertices`・`deleteSelectedSegments`。`OptionBarSplitGroup` は import なし・欠ければ `console.warn` して配線しない（`OptionBarSplitGroup.js:60-63`）・`blur` も `aria-pressed` も無い。`PathCornerEditor`・`PathVertexEditor`・`PathSplitEditor` の3つが `collectVertexTargets` を使う。`PathVertexRules.planVertexRemoval` の束ね（`PathVertexRules.js:482-`）・`PathSegmentKindRules.collectSwitchEntries`（`PathSegmentKindRules.js:76`）は、`PathSplitRules.collectEntries` と別の写しとして今も存在する。
    * 表A・表B（スクリプトで実行）：開いた5点を点1・3で切る→3本（2点・3点・2点）。両端だけを選ぶと切れず押せない。点2つのパスは分割が押せず、区間を消すは両端選択で図形ごと消える（`pieces` 0本）。閉じた4点を点2で切る→1本・5点（n+1）。点1・3で切る→2本。矩形を1点で切る→1本・5点。矩形の4点すべて→2点の線が4本。閉じた4点の区間を1つ消す→1本・4点の開いた線。矩形の対角2点→区間を消すは押せない。直線・今の曲線は分割が押せず、両端選択（今の曲線は点番号0と2）で区間を消すと図形ごと消える。今の曲線の点0と1だけでは区間を消すも押せない。円は両方押せない。`selectedSegmentIndexesOf`（`PathVertexRules.js:165-187`）は閉じた形の最後の区間を含み、開いた線は折り返さない。`pieceToPath`（`PathSplitRules.js:208`）は `source.fillColor` を保つ。`orderPieces` は「`start` が0」→「点0を含む」→「`start` が最小」の順（`PathSplitRules.js:186-200`）。
    * (d)の角：`PathJoinRules.chainOf`（`PathJoinRules.js:237-242`）が先頭と末尾の角を `false` にする。(h)の5px：`JOIN_TOLERANCE_SCREEN_PX = 5`（`PathJoinRules.js:14`）、`viewTransform.onChange(syncJoinButtonState)`（`main.js:399`）、結合ボタンは `canJoin()`（`planJoin` が `null` でないか。`PathJoiner.js:62-67`）。(i)の8px：`SNAP_TOLERANCE_SCREEN_PX = 8`（`EndpointSnapRules.js:14`）。結合する吸い付きと吸い付くだけの選び方は距離が同じなら結合（`VertexSnapRules.js:82-86`）。
    * 既存のテストの値を変えたもの：`git diff c30239d HEAD -- test/shapes/PathJoinRules.test.js test/edit/PathJoiner.test.js` で、`classifyJoin` の「曲線・矩形・円・弧の1つ」（172行付近）、「弧と円・矩形・閉じたパスは null、弧1本は close」（2377行付近）、`buildClosedPath`／`planJoin`（2536行付近）、`planDrawnLineJoin`（2601行付近）、`planEndpointDragJoin`（2646行付近）、`PathJoiner.test.js` の弧1本（438行付近）の6件が変わっており、文面の列挙と一致。
    * `index.html`：`#option-split-group`（888行）が2行目の `toolbar-row`（840行）の中。「分割」`#option-split-at-vertices`（記号✂）・「区間を消す」`#option-delete-segments`（記号✕）、どちらも `disabled`。幅の見積もりのコメントは「分割約68px（ボタン32×2＋間隔4）＝約1111px」（776行）。
  * **31. 複合パス**
    * 用語・規則：`listCompoundPaths`（`CompoundPathRules.js:136-168`）は、複合パスのフォルダのうち上のフォルダが複合パスでないものだけを返し（内側へは `walk` しない）、中の図形は `listShapeItems(item.children)` から `!states.get(shapeItem).hidden` のもの（ロックは問わない）、先頭を一番下の図形として `style`（3つ）と `baseEditable` を写す。中の図形が無ければ返さない。`isInsideCompoundFill`（`CompoundPathRules.js:235-246`）は `style.fillColor` が文字列で、`isInsideOutline` の真の数が奇数。`hitTestCompoundFill`（`CompoundPathRules.js:256-258`）は塗られた所かつその図形の輪郭の内側。`mapCompoundsByShape`（175行）を `buildDrawUnits`・`findCompoundOf`・`resolveStyleTargets` と `PointHitRules` が使う。公開は12個（`isCompoundGroup`・`setCompound`・`resolveCompoundToggle`・`collectCompoundGroupIds`・`listCompoundPaths`・`mapCompoundsByShape`・`buildDrawUnits`・`findCompoundOf`・`isInsideCompoundFill`・`hitTestCompoundFill`・`resolveStyleTargets`・`DRAW_UNIT_KIND`）で、文面の列挙と同じ。import は `ItemTreeRules`・`ItemStateRules` のみ。図形からは `isInsideOutline`・`isFillable` とスタイル3つだけを読む。
    * 描画：`CanvasManager.render`（`CanvasManager.js:254-272`）が `buildDrawUnits(shapes, compoundPaths)` の単位ごとに、アウトライン表示でない複合パスなら `drawCompoundPath`、アウトライン表示なら図形ごとの `drawOutline`。`drawCompoundPath`（`CompoundPathRenderer.js:14-35`）は塗りも線も文字列でない・`shapes` が空なら何もせず、そうでなければ `beginPath`→`appendOutline`→`fill('evenodd')`→`stroke`、塗りは `isFillable()` を問わない。`renderCurrentState` は `compoundPaths: model.getCompoundPaths()` を渡す（`main.js:247`）。`appendOutline`・`isInsideOutline` を持つ図形クラスは5つ（`Line`・`Rect`・`Curve`・`Ellipse`・`Path`）、`ShapeGeometry.isPointInPolygonEvenOdd`（`ShapeGeometry.js:232`）がある。`Path.appendOutline` は開いた輪郭は閉じず、`Path.isInsideOutline` は始点と終点を結んだ多角形で判定（`Path.js:408-422`）。
    * 当たり：`classifyPointHit` の第8引数 `compoundPaths`（`PointHitRules.js`）、`InputTracker.#classifyPoint` が `this.model.getCompoundPaths()` を渡す（`InputTracker.js:2052`）。`findBodyHit`（`PointHitRules.js:66-85`）は、手前から輪郭、または複合パスの中の図形なら `hitTestCompoundFill`。渡される図形は `getEditableShapes()` で、ロックされた図形は渡されず素通り。
    * 切り替え：`resolveCompoundButtonState`（`GroupCommandRules.js:68-74`）の引数は `unitIds`・`selectedGroupIds`・`isEditable`・`isCompound` でドラッグ中・ロック中を含めない。`canToggleCompound`（`GroupCommandRules.js:86-88`）がドラッグ中・行のドラッグ中・ロック中を見る。`ItemListWiring.sync` が `renderCompoundButton(#resolveCompoundButtonState())` を呼ぶ（`ItemListWiring.js:210`）。`#handleCompoundToggle`（`ItemListWiring.js:424-435`）は `canToggleCompound` が真なら `compoundPathEditor.toggle(state.groupId)`。`CompoundPathEditor.toggle`（`CompoundPathEditor.js:46-55`）は `resolveCompoundToggle` が `null` なら `false`、そうでなければ `beginEdit`→`setGroupCompound`→`commitEdit`。`VectorModel.setGroupCompound`（`VectorModel.js:354-361`）は変わらなければ通知せず `false`、変われば通知1回。`ItemRowRules.js:99` が行の `compound`（上のフォルダを見ず `isCompoundGroup(item)`）、`ItemAttributeRules.js:104-105` が `compound !== true` なら除く。ボタン `#item-list-compound` は `index.html:894`、複合パスのフォルダの絵 `.item-row-folder-icon.is-compound` は `index.html:161-167`。`ItemListPanel.renderCompoundButton`（`ItemListPanel.js:291-295`）は `disabled`・`aria-pressed` だけを書く。
    * スタイル・スポイト：`ShapeStyleEditor.#styleTargets`（`ShapeStyleEditor.js:310-312`）が `resolveStyleTargets(getEditableSelectedShapes(), getCompoundPaths())`、`resolveStyleTargets`（`CompoundPathRules.js:268-290`）は `baseEditable` が偽の複合パスを飛ばし、一番下の図形を塗りの対象にも入れる。`StylePanelRules.buildStylePanelView` は `fillableShapes` を受ける。`StyleEyedropper`（`StyleEyedropper.js:132-134`）は `findCompoundOf` で見つけた複合パスなら `{ ...compound.style }` を取り込む。
    * 保存・書き出し・開く：`CURRENT_DOCUMENT_VERSION = 5`（`DocumentSerializer.js:21`）、`migrateVersion4To5`（`DocumentSerializer.js:154`）、`MIGRATIONS = { 1, 2, 3, 4 }`（186行）、フォルダの要素は `compound: true` を複合パスのときだけ書く（191行）。`SPRITE_FORMAT_VERSION = 5`（`SpriteSerializer.js:23`）、`checkFormat` は版1〜5を受理（`SpriteSerializer.js:337`）。`buildCompoundPathElement`（`SpriteSerializer.js:287-300`）のキー順は `kind, outlines, strokeColor, strokeWidth, fillColor`、`compoundPathRange`（`SpriteSerializer.js:248`）を `SHAPE_RANGE_BY_KIND`（273-279）に登録。`serialize` は `buildDrawUnits(listVisibleShapes(items), listCompoundPaths(items))` の単位ごと（`SpriteSerializer.js:354-355`）。`CodeExporter.js` の `DRAW_SOURCE`（42行）に `canTrace`（70）・`traceElement`（113）・`drawCompoundPath`（171）・`drawElement`（220）がある。`drawCompoundPath` は `outlines` が空・配列でない・`canTrace` が偽の輪郭が1つでもあれば何も描かず（CodeExporter.js 173〜186行相当）、`fill('evenodd')` で塗る。開く側は `DrawElementReader.toCompoundPathShapeData`（`DrawElementReader.js:272`）、`FileContentReader.js:32-34,92`、`DocumentSerializer` の `toCompoundShapeData`（`DocumentSerializer.js:318-346`）。
    * 参照先の見出し：3章2.（描画サイクル）・3.（入力監視）・5.（作業データの変換）・13.（オプションバー・スタイル）・16.（スポイトの記述あり）が文面の番号と合う（`PROJECT_ARCHITECTURE.md:530,532,550,719,779`）。2章「フォルダの複合パスの属性`compound`」（382行）・「エディタで開くときの規則」（443行）、1章「存在しないもの」のPhase 12-04の項（355行。「やらないと決めたこと」に塗り方の切り替え・形の計算・1回の操作とキー・サムネイルの色・PNG出力・OZ Engineへの連絡が並ぶ）はいずれも存在する。
    * 件数：全件の `node --test` は4199件・pass 4199（文面の「4199件すべて合格」と一致）。`test/` に `CompoundPathRules`・`CompoundPathRenderer`・`CompoundPathEditor`・`GroupCommandRules.compound`・`ItemAttributeRules.compound`・`ItemRowRules.compound`・`PointHitRules.compound`・`VectorModel.compound`・`CompoundStyle`・`CodeExporter.compound`・`DocumentSerializer.compound`・`DrawElementReader.compound`・`SpriteSerializer.compound`・`CompoundPath.flow`・`ShapeGeometry.evenodd`・`OutlineMethods` のテストがある。`test/` に `ItemListPanel`・`ItemListWiring`・`OptionBarSplitGroup` のテストは無い（DOM を置かないという記述と一致）。
* **推測・所見**:
  * 一致と判定した主張は、上の「事実」の各項（`ファイル:行` つき）のとおり。29.・30.・31. の全文を開いて照合した結果、資料の記述と実コードの食い違いは見つからなかった。
  * 読み方が分かれる記述：1035行（29.）の「作業データ・書き出し形式の版は上げない（4のまま）」と1044行（30.）の「…版は上げない（4のまま）」。Phase 12-01・12-02 の時点の話としては正しいが、現在の版は作業データ5・書き出し形式5（`DocumentSerializer.js:21`・`SpriteSerializer.js:23`）で、現在形で「4のまま」と読むと食い違う。節の見出しに「（Phase 12-01）」「（Phase 12-02）」が付いているため、当時の値として読めば相違ではない（5章には入れなかった）。
  * 読み方が分かれる記述：1039行（29.）と1047行（30.）の「変えないもの：`VectorModel`・`HistoryManager`・`CanvasManager`・…・`io/`・`palette/`・`index.html`」。そのサブフェイズでの話として読めば正しいが、Phase 12-04 でこれらは変更されている（`git diff --name-status c30239d HEAD` で `VectorModel.js`・`CanvasManager.js`・`io/`・`palette/`・`index.html` が変更）。
  * 読み方が分かれる記述：1042行の「共有するのは`Path.resolveSegmentControls`・`PathJoinRules.segmentSpecsOf`・`chainSourceOf`だけ」。現在は `PathSegmentKindRules` が `PathVertexRules.selectedSegmentIndexesOf` を import し（`PathSegmentKindRules.js:9`）、`VertexSnapRules` も `outlineSourceOf` を import する（`VertexSnapRules.js:7`）。「点の追加の規則と共有するもの」を Phase 12-01 の時点で見れば正しく、Phase 12-02 以降の共有は別の節（30.）が書いている。
  * 読み方が分かれる記述：1041行 (j) と1037行の「Phase 12-01の時点では`PathCornerEditor.#collectTargets`と同じ手順の写しだった。Phase 12-02で括った」は、経緯として正しく書かれている（現在は `VertexTargetRules.collectVertexTargets` に括られている。上記の検索で `の写し` が3件ヒットしたがすべて経緯の記述）。一方 1051行 (f) の「`PathSplitRules`の非公開`collectEntries`は…3つ目の写しで、承知のうえで残した」は現在も成り立つ（`collectEntries`・`planVertexRemoval` の束ね・`PathSegmentKindRules.collectSwitchEntries` が別々に存在する）。
  * 読み方が分かれる記述：1051行 (i)「少しだけドラッグして離すともう一方の端点へ吸い付いて結合し直る（今の端点への吸い付き。変えない）」は、Phase 12-03 で足した吸い付くだけの規則（`VertexSnapRules`）と共存している。結合する吸い付きと吸い付くだけの距離が同じなら結合を選ぶ（`VertexSnapRules.js:82-86`）ため、重なった端点では結合が選ばれる。重なっていない他の頂点の方が近い場合は結合にならない（文面は重なった端点の場面に限る）。
  * コードのコメント：`VectorModel.js:1034`（`addShapesWithNewIds`）と `VectorModel.js:1098`（`replaceShape`）の JSDoc に「呼び出し側が選択モードであることを保証すること」が今も残っている。選択集合の不変条件は「選択モード・頂点の選択モード以外では空」（`PathVertexEditor.js:24` のコメントや `_doc/arch/03_VectorModel.md` の記述）。資料の29.(i)・30.(g) がこの古さを認めているので資料の記述としては一致。コード側の既知の傷2が今も残っている。
  * 照合できなかった主張：1043行の「Phase 12-01のタスク7の時点で3801件すべて合格」、1053行の「Phase 12-02のタスク7の時点で3910件すべて合格」は、過去の時点の件数の主張で、現在の作業ツリーでは確かめられない（現在は4199件。当時のコミットを実行していない）。1043・1053・1062行の「ブラウザのダブルクリックの判定（間隔・位置）・カーソルの形・削除ボタンの見た目の切り替わり・1280px幅での収まり・ブラウザでの見た目・操作」は実ブラウザの挙動で、コード（CSSの値・要素の並び）から確かめられる範囲（見積もりの数字 `index.html:776`、要素の存在）だけ照合した。
  * 照合できなかった主張：1061行の「書き出し形式の版5の連絡はPhase 12-05で済んだ」はOZ Engine側の事実で、本リポジトリの外のため照合できない（1061行の「OZ Engineへの連絡等」も同様）。
  * 照合できなかった主張：1038行の「区間の制御点の求め方…結果は移す前とビット単位で同じ」は、移す前（Phase 12-01の前のコミット）のコードとの比較で、今のコードだけからは確かめられない。`#segmentControls` が `resolveSegmentControls(this)` を呼ぶだけになっている点（`Path.js:213-215`）までは確認した。
  * 照合できなかった主張：1040行の「発注者の決定（2026-11-26）」・1050行の「発注者の決定」・1041行と1051行の「計画で決めたこと」の方針そのものの是非は照合の対象外とし、コードの振る舞いとして確かめられる部分（足す相手の決め方・つなぐ区間の種類・一段ずつ形を落とす規則・分割のピースの数・元の行を引き継ぐ1本の決め方・新しい線の入る場所・ボタンが押せる条件・`Ctrl`・`Shift`・`Alt` を見ないこと・`#lastClickSuppressed`・`t` が0か1なら足さないこと）だけを確かめた。
  * 対象外で見つけた記述：なし（照合の途中で、範囲外の行の食い違いには気づかなかった）。
  * 補足：このタスクの対象ファイル一覧にある `js/core/VertexDragRules.js` と `js/core/KeyboardShortcuts.js` のうち、`VertexDragRules` は 1035〜1062行に記述が無い（検索 `VertexDragRules`＝0件。`InputTracker.js:18` の import と `buildVertexDragUpdates`（`VertexDragRules.js:37`）の存在は確認したのみ）。`KeyboardShortcuts` は 1039行の「対応表は変えない。`deleteSelection` の JSDoc の説明だけ更新」が対象で、`KeyboardShortcuts.js:55` の説明更新と `172行` の `Delete`・`Backspace` の対応表（`ctrl: false, shift: FORBIDDEN, repeatable: false, action: 'deleteSelection'`）を確認した。

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
  * 検索対象は `./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の全ファイル（70ファイル。差分のない行・ファイルを含む）。自作の語検索スクリプト（`re.finditer`で各行の前後60〜70字を表示。長い行に隠れた語を拾うため）で走査し、ヒット箇所の前後を開いて読んだ。使った式（Python正規表現、全文）と行ヒット数：
    * 共通メソッド契約の数：`契約[^。]{0,12}(18|19|20)|(18|19|20)メソッド|第(18|19|20)メソッド|(18|19|20)個のメソッド`（grep -oE。約30件）／`18メソッド`・`第18メソッド`（上と別に再検索。11件）／`複合パス[^。]{0,25}(無い|ない|なし|未実装|まだ|作れない|対象外)`・`(穴|くり抜)[^。]{0,20}(作れない|無い|ない|できない|なし)`・`(フォルダ|グループ)の(役割|種類)[^。]{0,20}(無い|ない|なし)`・`fill\(\)[^。]{0,20}nonzero|nonzeroだけ|nonzeroのみ|引数なし＝nonzero`・`kind[^。]{0,15}(4種|四つ|4つ|４種)|4種類`・`(版5|エンジン)[^。]{0,25}(未連絡|連絡していない|連絡は|次のサブフェイズ|未確認|確認していない)`・`(未連絡|連絡票|連絡する|連絡して)`・`MIGRATIONS[^。]{0,30}(\{|版|キー)`（まとめて49件）
    * 版の数字：`(今は|現在は?|現行は?|今の現行)[^。]{0,12}版[0-9]`・`CURRENT_DOCUMENT_VERSION[^。]{0,40}`・`SPRITE_FORMAT_VERSION[^。]{0,40}`・`(polyline|bezierPath)[^。]{0,8}(・|、|と)[^。]{0,12}(quadratic|ellipse)[^。]{0,30}`・`描画要素[^。]{0,10}(は|の)[^。]{0,6}(4|5|四|五)(種|つ)`・`(未知|知らない)の?.?kind`・`formatVersion[^。]{0,20}[0-9]`（41件）／`版4`の全行ヒット（74件。全件を読んで「経緯・当時」か「今の記述」かを判定）／`(現行版[^。]{0,6}[0-9]|現在は版[0-9]|現行の[^。]{0,8}版[0-9]|版1〜[0-9]|版1～[0-9]|1〜[0-9]を受理|\{ ?1, ?2, ?3 ?\}|版[0-9]まで|formatVersion: ?[0-9])`（35件）
    * エンジンへの連絡：`12-05[^。]{0,60}`・`版5[^。]{0,30}(連絡|エンジン)`・`(エンジン|OZ Engine)[^。]{0,40}(版5|compoundPath)`・`連絡票[^。]{0,60}`（15件。全件を読んだ）
    * 行数：`(InputTracker|main\.js|VectorModel|index\.html|`main`)[^。]{0,40}[0-9]{3,4} ?行`・`[0-9]{3,4} ?行[^。]{0,30}(InputTracker|main\.js|VectorModel|index\.html)`・`(約|およそ)?[0-9,]{3,5} ?行`・`(行数|行ある|行の大|大きい|肥大)[^。]{0,40}`（86件）／`\b(1513|975)\b`・`(1[0-9]{3}|9[0-9]{2})行`（`02_main.md:3`・`06_InputTracker.md:66`の履歴を除き3件）／旧値の検索：`\b(1462|931|1234|2023|2124|1297|1296|1248)\b`・`行数[^。]{0,60}`・`VectorModel[^。]{0,30}(行|肥大|分割|分離)`・`index\.html[^。]{0,30}[0-9]{3} ?行`（履歴の2ファイルを除き6件）
    * 数え方：`(edit/? ?→ ?core/?|edit → core)[^。]{0,80}`・`(例外|直書き|決まりの例外)[^。]{0,30}[0-9]+(つ|件|個|ファイル|本)`・`[0-9]+(ファイル|つのファイル|本のファイル)[^。]{0,40}`・`(計|合計|全)[0-9]+(ファイル|個|つ)`（61件。`PROJECT_ARCHITECTURE.md:365`・`14_edit.md:4`・`16_test.md:8,10`・`core/ → shapes/`・`edit/ → shapes/`の数を実コードの`import`と並べた）
  * 実コードの事実の確認：`wc -l`（`js/core/InputTracker.js`・`js/main.js`・`js/core/VectorModel.js`・`index.html`）、`git show c30239d:<パス> | wc -l`（旧値）、`js/io/DocumentSerializer.js`（`CURRENT_DOCUMENT_VERSION`・`MIGRATIONS`・`migrateVersion4To5`・`deserialize`の受理範囲）、`js/io/SpriteSerializer.js`（`SPRITE_FORMAT_VERSION`・`checkFormat`）、`js/io/DrawElementReader.js`（`CONVERTER_BY_KIND`・`toCompoundPathShapeData`）、`js/io/CodeExporter.js`（`fill('evenodd')`・`fill()`）、`js/shapes/Curve.js:24`（共通メソッド契約の数）、`js/edit/*.js`の`from '../core/`・`from '../shapes/`のimport、`test/**/*.test.js`の`from '.*core/VectorModel`、`globalThis`の代入。
  * 照合した主張・件数の目安：版・契約の数・行数・数え方の言及の約190行ヒットを読み、うち「今の値」と読める記述を約30文、経緯と読める記述を約150文に仕分けた。
* **事実（実コードの記述）**:
  * 作業データの現行版は5：`js/io/DocumentSerializer.js:21`（`CURRENT_DOCUMENT_VERSION = 5`）。`MIGRATIONS`は`{ 1, 2, 3, 4 }`：同:186（`migrateVersion1To2`〜`migrateVersion4To5`）。`deserialize`は版1〜`CURRENT_DOCUMENT_VERSION`を受理：同:283。
  * 書き出し形式の現行版は5：`js/io/SpriteSerializer.js:23`（`SPRITE_FORMAT_VERSION = 5`）。`checkFormat`は1〜5を受理：同:337（`version > SPRITE_FORMAT_VERSION`で断る）。JSDoc同:18-19に「版1〜4」「版1〜5」の履歴。
  * 描画要素の`kind`は、`DrawElementReader.CONVERTER_BY_KIND`が`polyline`・`bezierPath`・`quadratic`・`ellipse`の4種（`js/io/DrawElementReader.js:235-240`）に、複合パスの`compoundPath`（`js/io/SpriteSerializer.js:293`で作る。`DrawElementReader.toCompoundPathShapeData`が読む。同:269-273）が加わり5種。図形クラスの`toDrawElement()`が返すのは4種のまま。
  * `CodeExporter`は`compoundPath`を`fill('evenodd')`で塗り（`js/io/CodeExporter.js:163,200`）、ほかの`kind`は`fill()`（引数なし）：命令の`ctx.fill();`は同:238。同:214は「fill() は引数なし」と書いたコメント行（命令ではない）。
  * 共通メソッド契約は20メソッド：`js/shapes/Curve.js:24`（`appendOutline`・`isInsideOutline`を含む）。
  * 行数（`wc -l`）：`js/core/InputTracker.js` 2126・`js/main.js` 1305・`js/core/VectorModel.js` 1513・`index.html` 975。Phase 11クローズ時（`c30239d`）は2023・1234・1462・931。
  * `js/edit/`のうち`core/`をimportするファイルは17個：`ClipboardController`・`CompoundPathEditor`・`GroupEditor`・`ItemRenameEditor`・`ItemStateEditor`・`NudgeEditor`・`PathCornerEditor`・`PathSplitEditor`・`PathVertexEditor`・`PositionInputEditor`・`PositionInputRules`・`ShapeOrderEditor`・`ShapeStyleEditor`・`SnapshotAdapter`・`StyleEyedropper`・`TransformInputEditor`・`TransformInputRules`（`grep -l "from '\.\./core/" js/edit/*.js`の結果）。`js/edit/`が`shapes/`を`import`文でimportするのは`EndpointSnapper`・`PathCornerEditor`・`PathJoiner`・`PathSplitEditor`・`PathVertexEditor`の5個（`TransformInputRules`は型参照`import()`だけ）。`js/core/`が`shapes/`を`import`文でimportするのは`RotationRules`・`ShapeFactory`の2個。
  * 実物の`core/VectorModel.js`をimportするテスト：`test/edit/*.test.js`のうち51ファイル（`grep -lE "from '.*core/VectorModel" test/edit/*.test.js`。`Phase 11クローズ時`は42）、`test/core/`のうち`VectorModel.*.test.js`以外で`EditableHit.test.js`・`PointHitRules.compound.test.js`・`SelectionRules.test.js`・`VertexDragRules.test.js`の4ファイル（`c30239d`では`EditableHit`・`SelectionRules`の2ファイル）。
  * テストで`globalThis`へ代入するのは`test/core/KeyboardShortcuts.keydown.test.js`・`KeyboardShortcuts.group.test.js`の2ファイル（`test/io/CodeExporter.test.js:506,512`は文字列と読み取りだけで代入ではない）。
  * 要件2の「古い形」のうち、現在の資料に「今もそうである」形で残っていないことを確かめたもの：「複合パスは無い」（`複合パス…(無い|ない|なし…)`の49件はすべて「版4以前に複合パスは無い」「複合パスが無い要素」等の正しい用法。`PROJECT_ARCHITECTURE.md:355`は「穴は複合パスとして入った」と更新済み）／「穴は作れない」「フォルダの役割（穴）は無い」（0件。`:355`）／「塗るのは`nonzero`だけ」（0件。`PROJECT_ARCHITECTURE.md:429`・`12_shapes.md:70`の「`fill()`（引数なし＝nonzero）」は複合パス以外の描き方の話で正しい。`:439`・`:375`・`70_CompoundPathRenderer.md:3`は`evenodd`）／「`MIGRATIONS`は`{1, 2, 3}`」（`PROJECT_ARCHITECTURE.md:405`は「Phase 11-01。`MIGRATIONS`は`{ 1, 2, 3 }`」と当時と明示、`:406`・`15_io.md:6`が現在の`{ 1, 2, 3, 4 }`）／「書き出し形式は版4」「`checkFormat`は版1〜4」（下の相違を除き、`PROJECT_ARCHITECTURE.md:441`・`SpriteSerializer.js:18`と同型の履歴の書き方）／「描画要素の`kind`は4種類」（0件。`15_io.md:38,49`・`12_shapes.md:89`の4種は`toDrawElement`・`DrawElementReader`変換表の話で実コードと一致）／「版5は未連絡」「次のサブフェイズ」（0件。`PROJECT_ARCHITECTURE.md:355,416,1061`・`15_io.md:36`は「12-05で連絡済み・エンジンの変更なしに表示できた」と更新済み）／`deleteShapes`等は本タスクの項目外。
  * 行数の資料の値：`02_main.md:3`「1305行」・`06_InputTracker.md:66`「2126行」・`16_test.md:342`「`main.js`は1305行・`InputTracker.js`は2126行」は現在の実測と一致。`VectorModel.js`・`index.html`の行数を資料に現在の値として書いた行は、検索の範囲では見つからなかった（`\b(1513|975)\b`・`(1[0-9]{3}|9[0-9]{2})行`、旧値`1462`・`931`とも0件。ヒットは`02_main.md`・`06_InputTracker.md`の履歴、`36_DisplayWiring.md:8`の「1018行から888行」（当時の値と明示）、`14_edit.md:138`の「約1200行」（`ItemStateEditor`に類する別ファイルの概数。本タスクの対象外）のみ）。履歴の中の値（1297・1296・1248・1234・2124・2112・2023等）は「…完了時の値」と明示されているため相違としない。
  * 「`edit/ → core/`のファイル数」：`PROJECT_ARCHITECTURE.md:365`の「17ファイルだけ」は実数17と一致（列挙の個数は11＋2＋1＋3＝17）。
* **推測・所見**:
  * 読み方が分かれる記述：`PROJECT_ARCHITECTURE.md:429`「描き方の順序（エディタの各図形の`draw`と同じ順・同じ命令）：…塗り（`fillStyle` → `fill()`。引数なし＝nonzero）」は、直前の節の流れでは`compoundPath`以外の`kind`の話だが、行の中に「`compoundPath`は`evenodd`」の限定が無い（`:439`に別の項として`evenodd`が書かれている）。実コードは`CodeExporter.js:238`が`fill()`の命令（`:214`は「fill() は引数なし」のコメント行）、`:200`が`fill('evenodd')`で、後者は`compoundPath`だけ。
  * 読み方が分かれる記述：`_doc/arch/12_shapes.md:123`（`+`行）「頂点の追加・削除はPhase 12-01で…入った（`Path`に追加・削除のメソッドは足していない。共通メソッド契約は18のまま。…）」は、「Phase 12-01で」の経緯の中の文であり、12-01の時点では18で正しい。現在は20（`Curve.js:24`）で、同じ行の文脈に「今は20」の書き添えが無い。
  * 読み方が分かれる記述：`PROJECT_ARCHITECTURE.md:363`「`main.js`の他の配線ブロックは切り出していない（4章の`main.js`の行数の項）」の参照先は、4章（1066〜1140行）では`main.js`の行は表の1行（`_doc/arch/02_main.md`への案内。`PROJECT_ARCHITECTURE.md:1072`付近）だけで、行数の記述は`_doc/arch/02_main.md:3`にある。「4章の行数の項」を`02_main.md`の行数の項と読めば合う（`c30239d`にも同じ文言あり。Phase 12より前から）。
  * 読み方が分かれる記述：`_doc/arch/16_test.md:162,191,240,279,303,318,324`の「版4」（`作業データの往復と版4のまま`等）は、各Phase当時のテストの内容の記述。対応するテストは現在、版5を確かめている（`test/edit/PathVertexEditor.items.test.js:226`・`PathSplitEditor.items.test.js:214`・`test/io/SpriteSerializer.visibility.test.js:115-119`・`DocumentSerializer.collapsed.test.js:81`）。`16_test.md:340`に「版の数字だけを直した」とあるが、各Phase項の当時の記述は直していない。「当時」と読めば一致、「今のテストの内容」と読めば不一致。
  * 読み方が分かれる記述：`PROJECT_ARCHITECTURE.md:405`「版3→版4の移行（`migrateVersion3To4`。Phase 11-01。`MIGRATIONS`は`{ 1, 2, 3 }`）」は、Phase 11-01の時点の値。`:404`も同型（`{ 1, 2 }`）。「Phase 11-01。」と時点が付いているため当時の記述と読めるが、現在の`MIGRATIONS`は`{ 1, 2, 3, 4 }`。
  * コードのコメント：検索の範囲では、複合パス・版・契約の数・行数に関する古い説明は見つからなかった（`SpriteSerializer.js:18-19`・`DocumentSerializer.js:183-186`・`Curve.js:24`はいずれも現状と合う）。`test/io/DocumentSerializer.collapsed.test.js:79`のテストの題名「`versionは4のまま`」は確かめている値が5（同:81 `assert.equal(data.version, 5)`）で、題名が古い（既知の傷3と同じ形のものが別のファイルにもある）。
  * 照合できなかった主張：`PROJECT_ARCHITECTURE.md:416`・`15_io.md:36`の「エンジンのコードの変更なしに表示できた」「OZ Engineへの連絡票はPhase 12-05で出し」は、本リポジトリの外（OZ Engine）の結果で、コードから確かめられない。同じ理由で`PROJECT_ARCHITECTURE.md:355,1061`の「書き出し形式の版5の連絡はPhase 12-05で済んだ」も確かめていない（連絡票を出したこと自体はリポジトリ内のコードに痕跡が無い）。
  * 対象外で見つけた記述：`_doc/arch/14_edit.md:44`（`+`行でなく、版の数字の検索で拾った）「`SpriteSerializer.serialize`の形（`formatVersion` 4・…）・作業データ（`DocumentSerializer.serialize`）の`version` 4」は、対応するテスト`test/edit/TransformInputEditor.test.js:379,381`が`formatVersion`・`version`とも5を確かめている（5章に別途挙げた）。
  * 対象外で見つけた記述：`_doc/arch/14_edit.md:138`「約1200行でも1クラスにまとめている」の対象クラスは本タスクで確かめていない（行数の検索で拾っただけ。対象外）。
  * 確認していない主張：PA（`PROJECT_ARCHITECTURE.md`）の`版4（Phase 11-01）の要素は2種類`（`:399`）は版4の読み方の説明で、版5の`compound`は同じ行の別の位置と`:382`・`:551`に書かれているため一致とした（0件の抜けではない）。

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
* **（対象：`PROJECT_ARCHITECTURE.md` 3章27.（`:981`））**：「作業データ形式（当時の版3。今は4）・書き出し形式（版4）・履歴のエントリの形は変えない」→「今は」の作業データの現行版は5（`js/io/DocumentSerializer.js:21` `CURRENT_DOCUMENT_VERSION = 5`）。書き出し形式の現行版も5（`js/io/SpriteSerializer.js:23`）で、「書き出し形式（版4）」は当時の値（Phase 10-03）。「今は4」だけが今の値として書かれている。差分の`+`行ではない（Phase 12-04で足されなかった）。（タスク13）
* **（対象：`_doc/arch/16_test.md` 版を上げるときの項（`:227`））**：「現在は版4で`MIGRATIONS`に版1→版2・版2→版3・版3→版4があり、移行は`test/io/DocumentSerializer.migration.test.js`で確かめている」→ 現在の作業データの版は5で、`MIGRATIONS`は`{ 1, 2, 3, 4 }`（版4→版5の`migrateVersion4To5`を含む。`js/io/DocumentSerializer.js:21,186`）。（タスク13。差分の`+`行ではない）
* **（対象：`_doc/arch/40_asset_sprite.md`（`:2`））**：「現行の書き出し形式は版4（Phase 10-02）で、Phase 11-06aから`source`・描画要素の`id`を持たないが、…（`SpriteSerializer.checkFormat`は版1〜4を受理し、…）」→ 現行の書き出し形式は版5、`checkFormat`は版1〜5を受理する（`js/io/SpriteSerializer.js:23,337`）。差分の`+`行ではない（Phase 12で足されなかった）。（タスク13）
* **（対象：`_doc/arch/12_shapes.md`（`:28`。VertexSnapRulesの「読むもの」の項））**：「図形クラスの共通メソッドは足さない（18メソッド契約のまま）」→ 共通メソッド契約は20メソッド（`js/shapes/Curve.js:24`。`appendOutline`・`isInsideOutline`はPhase 12-04で加わった。同じファイルの`:67`・`:68`も「20メソッド契約」）。`:28`は同ファイル内の`:67`と矛盾する（`+`行。タスク6の範囲）。（タスク13）
* **（対象：`_doc/arch/14_edit.md`（`:4`））**：「`edit/`から`core/`をimportするのは`NudgeEditor`・…・`SnapshotAdapter`の14個だけで、他のクラスは`core/`をimportしない」→ 実際は17個。列挙に無い`ShapeStyleEditor`・`StyleEyedropper`・`CompoundPathEditor`も`core/`をimportする（`js/edit/ShapeStyleEditor.js`・`StyleEyedropper.js`・`CompoundPathEditor.js`の`from '../core/…'`。`grep -l "from '\.\./core/" js/edit/*.js`が17件）。`PROJECT_ARCHITECTURE.md:365`は「17ファイルだけ」と書いており、同じ数を数える2つの記述が食い違う（`+`行。タスク7の範囲）。（タスク13）
* **（対象：`_doc/arch/16_test.md` 注入される依存の項（`:10`））**：「実物の`VectorModel`等を組み合わせる…テストは計44ファイル（数え方：実物の`core/VectorModel.js`をimportする`test/edit/*.test.js`の42ファイルと、`test/core/`の`EditableHit.test.js`・`SelectionRules.test.js`。…）」→ 現在、実物の`core/VectorModel.js`をimportする`test/edit/*.test.js`は51ファイル、`test/core/`の`VectorModel.*.test.js`以外は`EditableHit`・`PointHitRules.compound`・`SelectionRules`・`VertexDragRules`の4ファイルで、計55ファイル（`grep -lE "from '.*core/VectorModel" test/edit/*.test.js`が51件、`test/core/*.test.js`のうち`VectorModel.*`以外が4件）。「42」はPhase 11クローズ時（`c30239d`）の値で、Phase 12で増えた（`+`行ではない。タスク8の範囲の項だが差分のない行）。（タスク13）
* **（対象：`_doc/arch/14_edit.md`（`:44`。`TransformInputEditor.test.js`の項））**：「`SpriteSerializer.serialize`の形（`formatVersion` 4・…）・作業データ（`DocumentSerializer.serialize`）の`version` 4」→ 対応するテストは`formatVersion`・`version`とも5を確かめている（`test/edit/TransformInputEditor.test.js:379`・`:381`。Phase 12-04で5へ直した）。差分の`+`行ではない（Phase 12-04で資料は直されなかった）。（タスク13）
* **`PROJECT_ARCHITECTURE.md:60`（構成図 `ItemTreeRules.js`）**：「VectorModel・ItemAttributeRules・ItemRowRules・ItemPlaceRules・ItemStateRules・InsertTargetRules・GroupTreeRules・GroupSelectionRules・GroupCollapseRules・ListDragRules・RemovalRules・edit/GroupEditor・io/DocumentSerializer・io/SpriteSerializer・edit/PathSplitEditorから使う」（15ファイル）→ `ItemTreeRules` を import するのは16ファイルで、`core/CompoundPathRules` が無い（`js/core/CompoundPathRules.js:5`）。（タスク1）
* **`PROJECT_ARCHITECTURE.md:29`（構成図 `InputModes.js`）**：「InputTracker・KeyboardShortcuts・ToolRules・CursorShapeRules・VertexHandleRules・NudgeTargetRules・ScaleHandleRules・VertexEditRules・wiring/ToolIconWiring・main.jsから使う」→ 12ファイルが import し、`core/GroupCommandRules`・`core/ItemListRules` が無い（`js/core/GroupCommandRules.js`・`js/core/ItemListRules.js` の `InputModes` の import）。（Phase 12 より前からのずれ）（タスク1）
* **`PROJECT_ARCHITECTURE.md:358`（フォルダ分割の方針）**：「`CompoundPathRules`は、描画（`main.js`→`CanvasManager`）・当たり判定（`PointHitRules`）・スタイル（`edit/`）・書き出し（`io/SpriteSerializer`）の4か所から使われる」→ 使う側は `CanvasManager`・`ItemRowRules`・`PointHitRules`・`VectorModel`・`edit/CompoundPathEditor`・`edit/ShapeStyleEditor`・`edit/StyleEyedropper`・`io/SpriteSerializer`・`wiring/ItemListWiring` の9ファイルで、`main.js` は import しない（grep `from '[^']*/CompoundPathRules\.js'|from '\./CompoundPathRules\.js'`）。（タスク1）
* **`PROJECT_ARCHITECTURE.md:365`（依存方向）と358行**：365行の「`InsertTargetRules`・`ItemRowRules`・`RemovalRules`・`SoloVisibilityRules`、`ListDragRules`の段」（`ItemRowRules` を `InsertTargetRules` と同じ段とする。この文は `-` 行にもあった）と、同じ `+` 行の358行の新しい文「`CompoundPathRules`が`InsertTargetRules`等と同じ段、`ItemRowRules`が次の段、`ListDragRules`がその次」が食い違う → コードは358行側に合う：`ItemRowRules` が `CompoundPathRules` を import（`js/core/ItemRowRules.js:8-9`）、`InsertTargetRules` は `ItemRowRules` を import しない（`js/core/InsertTargetRules.js:5-8`）、`ListDragRules` が `ItemRowRules` を import（`js/core/ListDragRules.js:6`）。（タスク1）

## 6. 懸念事項・今後の修正における注意点
* （タスク14で、4章の各タスクの「推測・所見」に書かれた「読み方が分かれる記述」「コードのコメント」「照合できなかった主張」を、資料のファイルと節・要点・タスク番号の一覧としてまとめる）
* （タスク3）……561行の `deleteShapes` の呼び出し元の記述（5章）は、「ここでは呼ばず」と「だけ」のどちらを主張として読むかで重さが変わる。本調査では「`deleteShapes` を呼ぶ製品コードは `PathVertexEditor` だけ」という読み方を相違とした。
* （タスク3）……12.の注意事項 (b)・(c)・(d)・(a) と「確認の状況」の「テストプレイで確かめる」は、実際のマウス操作・見え方・重さに関する記述で、コードだけでは照合できない。目視確認を推奨する。
* （タスク3）……540行の「`InputTracker`は…`beginEdit`／`commitEdit`も呼ばない」は点の追加・削除の経路についてなら一致するが、`InputTracker` 全体への主張と読むと左ドラッグの記録の呼び出しと食い違う（読み方が分かれる）。
* （タスク3）……`js/core/KeyboardShortcuts.js` 57行の `join` の JSDoc が「開いたパス1本を閉じる」のままで、弧1本も閉じるようになった12-02の変更が反映されていない（コードのコメント）。
* （タスク13）……`_doc/arch/16_test.md:162,191,240,279,303,318,324`の「版4」「版4のまま」の扱い：各Phase当時のテストの内容として書かれているが、対応するテストは今は版5を確かめている（上の「推測・所見」）。「当時の記述」と読むか「今の内容」と読むかで判定が分かれる。5章には入れていない。目視で方針を確認してほしい。
* （タスク13）……`_doc/arch/12_shapes.md:123`の「共通メソッド契約は18のまま」は、12-01の経緯の中の文として5章に入れなかった（`:28`は経緯の付かない現在形のため5章に入れた）。同じ扱いでよいか確認してほしい。
* （タスク13）……`PROJECT_ARCHITECTURE.md:363`の「4章の`main.js`の行数の項」の参照先の読み方（4章は案内の表1行。行数は`_doc/arch/02_main.md:3`）。
* （タスク13）……`PROJECT_ARCHITECTURE.md:429`の「引数なし＝nonzero」に`compoundPath`以外の限定が文中に無い（`:439`に別の項で`evenodd`）。
* （タスク13）……OZ Engine側の結果（「エンジンのコードの変更なしに表示できた」）は照合できなかった。
* （タスク13）……コードのコメント（テストの題）：`test/io/DocumentSerializer.collapsed.test.js:79`の題名「versionは4のまま」で確かめる値は5（`:81`）。
* （タスク5）……1035行・1044行の「版は上げない（4のまま）」と1039行・1047行の「変えないもの：…」は、サブフェイズ当時の値・範囲として読めば正しいが、現在形に読むと古い。5章には入れなかった。目視確認を推奨する。
* （タスク5）……1042行の「共有するのは…だけ」は Phase 12-01 の時点の話として読んだ（現在は `PathSegmentKindRules`・`VertexSnapRules` も `PathVertexRules` を import している）。5章には入れなかった。
* （タスク5）……1043行・1053行の「3801件」「3910件」は過去の時点の件数で、現在の作業ツリーでは確かめられない（現在は4199件）。
* （タスク5）……`VectorModel.js` の `replaceShape`（1098行）・`addShapesWithNewIds`（1034行）の JSDoc の「呼び出し側が選択モードであること」は今も残る（コード側の既知の傷2。資料側の29.(i)・30.(g)は古いことを認めている）。
* （タスク5）……1061行の「書き出し形式の版5の連絡はPhase 12-05で済んだ」はOZ Engine側の事実で、照合できなかった。
* （タスク1）……OZ Engine についての記述（158行・355行）は照合できなかった。
