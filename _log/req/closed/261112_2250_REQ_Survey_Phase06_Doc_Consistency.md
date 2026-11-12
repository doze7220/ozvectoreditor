# 作業指示書 REQ: Survey : Phase 6 クローズの開発資料の整合確認
* ルール: `./PROJECT_CONSTITUTION.md`
* 参考資料: `./_log/res/261111_1913_RES_Phase06-01_Fill_Stroke_Data.md`・`./_log/res/261112_1151_RES_Phase06-02_Property_Panel.md`・`./_log/res/261112_1513_RES_Phase06-03_Fill_Hit_Test.md`・`./_log/res/261112_1936_RES_Phase06-04_Shape_Order.md`・`./_log/res/261112_2122_RES_Phase06-05_Engine_Roundtrip.md`（Phase 6 の各サブフェイズの作業計画書。資料の記述の経緯を確かめる必要が生じた場合にのみ参照する）

## 【作業手順（厳守事項）】
本プロンプトは、Phase 6「着色」の期間に書き換えられた開発資料（`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下）の記述と、現在の実コードとの整合のSurveyである。
**本作業は調査のみを目的とする。いかなる理由があっても、ソースコードおよび資料ファイルの修正・作成を行ってはならない（RESファイルの出力を除く）。**

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本Surveyでは、開発資料の記述そのものが調査対象である。【調査範囲】に示す差分を取得し、そこで追加・変更された記述（差分の `+` 行）を照合の対象とすること。対象の記述の前後の文脈を確かめるために、`./PROJECT_ARCHITECTURE.md` と `./_doc/arch/` 配下の該当ファイルを読んでよい（本REQでパスを指定しているため、`_doc/` 配下の読み取りを許可する。`_doc/` の他のファイルは読まない）。
3. 調査対象のコードを読み、資料の記述と実コードに相違がある場合は、その相違点を調査結果に必ず含めること（作業は中断しない）。資料に書かれていない事項がコードに存在することは相違とみなさない。
4. 【調査要件】に従って調査を行い、実コードから読み取れる事実のみを抽出すること。推測・改善提案は求めていない。推測を含める必要がある場合は、どこまでが実コードの記述でどこからが推測かを明示すること。
5. コード調査が完了したら、この時点までにソースコードおよび資料ファイルを一切変更していないことを（`git status` で）確認したうえで、Survey作業レポートテンプレート（`./_log/TEMPLATE_RES_Survey.md`）を元に、作業レポート（`./_log/res/261112_2250_RES_Survey_Phase06_Doc_Consistency.md`）を新規作成して出力すること。
6. すべての調査が完了したら、チャットにて「調査が完了しました。RESの確認をお願いします」と報告すること。

## 【調査要件】
Phase 6 の各サブフェイズの最終タスクで開発資料へ反映された記述が、Phase 6 終了時点（現在の `HEAD`）の実コードの事実と食い違っていないかを確かめる。各サブフェイズの反映時点ではそのサブフェイズの差分監査に合格しているため、特に **後のサブフェイズのコード変更によって、前のサブフェイズで書いた記述が古くなっていないか** を重点的に見る（例：06-01 で書いた図形データ・描画の記述が 06-03 の当たり判定・06-04 の重なり順・06-05 の書き出し形式の変更後も成り立つか、06-02 で書いた `main.js` の配線・行数が 06-04 の配線追加後も成り立つか）。

* **要件1: 差分で追加・変更された記述の照合**
  * 【調査範囲】の差分の `+` 行に書かれた事実の主張を、1つずつ実コードと照合する。照合するのは次のような、コードで真偽を確かめられる主張である：
    * ファイル・フォルダの存在と配置（1章のフォルダ構成図。`test/` 配下を含む）
    * import の有無・向き（1章「依存方向」とその例外、`_doc/arch/12_shapes.md`・`13_palette.md`・`14_edit.md`・`18_PointHitRules.md` の「importは〜のみ」「使う側」「呼び出し元」）
    * 公開メソッド・公開の関数・定数・typedef の一覧（`_doc/arch/03_VectorModel.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`15_io.md`・`18_PointHitRules.md`）
    * 図形データ・作業データ・スプライトデータの形（2章。共通プロパティ `strokeColor`・`strokeWidth`・`fillColor` の型と `null` の扱い、作業データの版と `migrateVersion1To2`、書き出し形式の版2、描画要素の項目・描き方の順序・塗る条件・線を描かない条件・範囲の求め方）
    * 既定値・定数（`DEFAULT_NEW_SHAPE_STYLE`、線の太さ2pxの4つの定義、太さの受理範囲 1〜100 の整数 等）
    * 引数・戻り値・通知の回数など、関数の振る舞いの記述（`isFillable()`、`updateShapeStyles`、`reorderShapes`、`startDraft` での直前の値の適用、`getPanelView()`、`getAvailability()`、`classifyPointHit` 等）
    * 呼び出し元・呼び出し順・記録の時点（3章6.「記録する操作と時点」「記録しない操作」、3章12.〜14.の「流れ」「履歴の単位」「確定前に他の操作が起きた場合」、`_doc/arch/08_HistoryManager.md` の呼び出し元）
    * `main.js` の配線（`_doc/arch/02_main.md` の配線ブロックの表・注入の表・生成順の制約・主な関数）
    * `InputTracker` の当たり分類の使い方（3章「当たり分類」、`_doc/arch/06_InputTracker.md`・`18_PointHitRules.md`）と `KeyboardShortcuts` のキー（`_doc/arch/07_KeyboardShortcuts.md`。`Home`/`PageUp`/`PageDown`/`End` 等）
    * 数値（行数：`main.js` 681行・`InputTracker.js` 1305行 等、資料に書かれた行数すべて）。行数は `wc -l` 等で実測し、資料の値と並べて記載する。
    * `index.html` の要素・属性（`#property-shape-section`・`#property-order-section`・`#canvas-loading-cover`・接頭辞 `property-` 等、`_doc/arch/01_index_html.md` の記述）
    * 自動テストの記述（`_doc/arch/16_test.md`。テストファイルの存在、テストの内容の記述が実際のテストケースと合っているか。偽物と実物の使い分けの記述）
  * 「発注者の決定」「やらないこと」「注意」のように意図・方針を述べる記述は、それがコードの振る舞いとして確かめられる範囲（例：「`fillColor` は塗れない形でも保持し、塗れる形のときだけ描く」「ドラッグ中のパネルの変更は拒まない」「隣の1つ分だけ動く」）だけを照合し、方針そのものの是非は扱わない。
  * エンジン（`D:\ozlab\ozengine-web`）側の文書・コードについての記述は、本リポジトリの外のため照合しない（照合できなかった主張として理由を書く）。
* **要件2: 照合の結果の整理**
  * 相違が見つかった記述は、RESの5章に「（対象：資料のファイルと節）：（資料の記述）→（実コードの実態。`ファイル:行` を添える）」の形で記載する。
  * 相違ではないが、記述があいまいで実コードと照らして複数の読み方ができるものがあれば、4章の「推測・所見」に記載する（5章には入れない）。
  * 照合した主張と結果を、資料のファイル（節）ごとに4章へまとめる（照合済みで一致したものは「一致」と短く書けばよい。照合できなかった主張があれば、その理由を書く）。

## 【調査範囲】
* **照合の対象とする記述**：次のコマンドで得られる差分の `+` 行（Phase 6 の DIR 初版のコミット `433ae2f` から、Phase 6 クローズの記録のコミット `c9630a0` まで。`433ae2f` は開発資料を変更していない）。
  * `git diff 433ae2f c9630a0 -- PROJECT_ARCHITECTURE.md _doc/arch`
  * 対象の14ファイル：`PROJECT_ARCHITECTURE.md`、`_doc/arch/01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`18_PointHitRules.md`
* **照合に使う実コード**：現在の作業ツリー（`HEAD`）の `./index.html`、`./js/` 配下、`./test/` 配下。Phase 6 で変更されたコードの一覧は `git diff --stat 433ae2f c9630a0 -- js index.html test` で得られる。これ以外のファイルも、記述の照合に必要なら読んでよい。
* **対象外**：差分の `+` 行以外の資料の記述（Phase 6 より前から変わっていない記述）、`_doc/arch/` の差分のないファイル、`_doc/` の他のファイル、`_log/dir/` 配下、本リポジトリの外のファイル。
