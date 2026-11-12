# RES: 作業レポート Survey : Phase 6 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261112_2250_REQ_Survey_Phase06_Doc_Consistency.md`

## 1. 調査目的
Phase 6「着色」の期間に書き換えられた開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/` 配下の13ファイル）の追加・変更行（`git diff 433ae2f c9630a0 -- PROJECT_ARCHITECTURE.md _doc/arch` の `+` 行）が、Phase 6 終了時点（`HEAD` = `c9630a0`）の実コードと食い違っていないかを確かめる。特に、後のサブフェイズのコード変更で前のサブフェイズの記述が古くなっていないかを重点的に見る。

## 2. 調査方針
* 差分の `+` 行を資料のファイル（節）ごとに読み、コードで真偽を確かめられる主張を抜き出して、`HEAD` の `index.html`・`js/`・`test/` と1つずつ照合した。
* 照合の手段：
  * フォルダ構成：`find js test -type f` の一覧と1章の構成図を突き合わせた。
  * import：`js/` 配下の全 `import` 文を grep し、1章「依存方向」・各arch文書の「importは〜のみ」「使う側」「呼び出し元」と突き合わせた（`PointHitRules.js`・`StylePanelRules.js`・`ShapeOrderRules.js`・`PropertyShapeSection.js`・`PropertyOrderSection.js` は import 文が0件であることを確認）。
  * 公開メソッド・関数・定数：各ファイルのメソッド定義・`export` を grep して一覧と突き合わせた。
  * 振る舞い：該当メソッドの本体を読んだ（`VectorModel`・`ShapeStyleEditor`・`StylePanelRules`・`ShapeOrderRules`・`ShapeOrderEditor`・`PointHitRules`・`InputTracker`（当たり分類・Spaceキー・押下・クリック）・`KeyboardShortcuts`・5つの図形クラスの `isFillable`/`hitTestFill`/`draw`/`toDrawElement`/`toJSON`/`fromJSON`・`ShapeGeometry.isPointInPolygonNonzero`・`ShapeDataValidation`・`DocumentSerializer`・`SpriteSerializer`・`CodeExporter.DRAW_SOURCE`・`PathJoinRules` の結果の組み立て・`main.js` の `// 7.7.`〜`// 9.` と起動時同期・`PropertyShapeSection`・`PropertyOrderSection`）。
  * 行数：`wc -l` で実測した。
  * 呼び出し元：`beginEdit()`・`updateShapeStyles`・`updateNewShapeStyle`・`reorderShapes`・`hitTestFill`・`isFillable`・`classifyPointHit`・`strokeColor`/`fillColor`/`strokeWidth` の読み書きを `js/` 全体で grep した。
  * テストの記述：各テストファイルの `describe`/`it`/`test` の見出しと import、必要な箇所の本体を読んで `16_test.md` の記述と突き合わせた。
  * 経緯の主張（「06-02でshapes/は変更していない」「06-03・06-04で既存のテストを書き換えていない」「`main.js` の増分 +35行・+53行」「06-03前の当たり分類は奥優先」等）は、各サブフェイズの start/done のコミット間の `git diff --stat`・`git show` で確認した。
* エンジン（`D:\ozlab\ozengine-web`）側の記述と、ブラウザの振る舞いに依る記述はコードで確かめられないため、照合できなかった主張として4章に理由を書いた。

## 3. 対象ファイル
* 資料（照合の対象）：`./PROJECT_ARCHITECTURE.md`、`./_doc/arch/01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`10_ShapeFactory.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`15_io.md`・`16_test.md`・`18_PointHitRules.md`
* 実コード（照合に使用）：
  * `./index.html`
  * `./js/main.js`
  * `./js/core/VectorModel.js`・`InputTracker.js`・`PointHitRules.js`・`KeyboardShortcuts.js`・`HistoryManager.js`・`ShapeFactory.js`・`WindowManager.js`
  * `./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`・`Path.js`・`ShapeGeometry.js`・`ShapeDataValidation.js`・`PathJoinRules.js`
  * `./js/edit/StylePanelRules.js`・`ShapeStyleEditor.js`・`ShapeOrderRules.js`・`ShapeOrderEditor.js`・`EndpointSnapper.js`・`PathJoiner.js`（import の確認）
  * `./js/palette/PropertyShapeSection.js`・`PropertyOrderSection.js`
  * `./js/io/DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`
  * `./test/` 配下（`16_test.md` に記載のある全テストファイル。特に Phase 6 で追加・変更されたもの）

## 4. 調査結果
* **調査内容**:
  * 2章の方針のとおり、差分の `+` 行の主張を資料のファイル（節）ごとに実コードと照合した。結果を以下にまとめる（「一致」は照合済みで食い違いが無いもの）。

* **事実（実コードの記述）**:

  * **`PROJECT_ARCHITECTURE.md` 1章（フォルダ構成・フォルダ分割の方針・依存方向）**
    * フォルダ構成図の追加行（`core/PointHitRules.js`、`palette/PropertyShapeSection.js`・`PropertyOrderSection.js`、`edit/StylePanelRules.js`・`ShapeStyleEditor.js`・`ShapeOrderRules.js`・`ShapeOrderEditor.js`、`test/core/PointHitRules.test.js`・`VectorModel.reorderShapes.test.js`・`VectorModel.style.test.js`、`test/shapes/ShapeGeometry.test.js`、`test/io/DocumentSerializer.migration.test.js`、`test/edit/StylePanelRules.test.js`・`ShapeStyleEditor.test.js`・`ShapeOrderRules.test.js`・`ShapeOrderEditor.test.js`）：すべて存在。構成図と実在のファイルの一覧は過不足なく一致。
    * 「存在しないもの」の追加項目（独自のカラーピッカー・「頂点」の段・図形の一覧・直前に使った値の保存・塗った内側による範囲選択・弧/曲線/直線/開いたパスの塗り 等）：一致（該当する実装は無い。色は `index.html:413,423` の `<input type="color">`。範囲選択は `InputTracker.js:1063` の `intersectsRect` のみ。塗れる形は `isFillable()` が真の `rect`・`circle`・閉じた `path` のみ）。
    * `core/`：`PointHitRules` は `InputTracker` から使う状態なしの関数：一致（`InputTracker.js:9` の import のみ、`PointHitRules.js` は import 0件・モジュール変数なし）。
    * `palette/`：段ごとに1つのUI部品、ウィンドウ自体を配線するクラスは無い：一致。
    * `edit/` の追加の手順（スタイルの変更・重なり順の変更）：一致。
    * 依存方向の追加の例外（`ShapeStyleEditor`→`StylePanelRules`、`ShapeOrderEditor`→`ShapeOrderRules`、`ShapeOrderRules` は import なし、`InputTracker`→`PointHitRules`、`PointHitRules` は import なし）：一致（`ShapeStyleEditor.js:5`、`ShapeOrderEditor.js:5`、`InputTracker.js:9`）。`core/` から `edit/` への import は無い。

  * **`PROJECT_ARCHITECTURE.md` 2章（データ構造）**
    * 共通プロパティ `strokeColor`（文字列または `null`）・`fillColor`（文字列または `null`）：一致（`ShapeDataValidation.js:86-96`、各図形クラスのコンストラクタ引数 `fillColor = null`）。
    * スタイル3つの読み書き（`VectorModel` が `updateShapeStyles`・`startDraft`・`updateNewShapeStyle` の作成途中の図形で書き、`StylePanelRules`・`ShapeStyleEditor` が読む。`ShapeStyleEditor` は直接代入しない）：一致（`VectorModel.js:319-323,342-358,368-381,731-737`。`js/core`・`js/edit`・`js/palette`・`main.js` で `strokeColor`/`strokeWidth`/`fillColor` に触れるのは `VectorModel.js`・`ShapeStyleEditor.js`・`StylePanelRules.js`・`PropertyShapeSection.js`（JSDoc以外）のみ。`ShapeStyleEditor` の書き換えはすべて `model.updateShapeStyles` 経由）。15メソッド（`hitTestFill` を足して）：一致（5クラスとも `isFillable`・`hitTestFill` を実装。クラスJSDocにも列挙）。
    * 塗れる形と `isFillable()`（`Line`・`Curve` 常に偽、`Rect` 常に真、`Ellipse` は `type === 'circle'`、`Path` は `closed === true`）：一致（`Line.js:49`、`Curve.js:59`、`Rect.js:53`、`Ellipse.js:83`、`Path.js:98`）。使う側（`StylePanelRules`・`ShapeStyleEditor`・各図形の `hitTestFill`）：一致（`StylePanelRules.js:170`、`ShapeStyleEditor.js:22`、各 `hitTestFill` の冒頭）。
    * `fillColor` は塗れない形でも保持し塗れる形のときだけ描く、`toJSON` はそのまま出力：一致（各 `toJSON` が `fillColor: this.fillColor`、各 `draw` の `shouldFill = this.isFillable() && typeof this.fillColor === 'string'`）。線なしで塗れない形も受理し選べる：一致（`fromJSON` は `strokeColor: null` を受理、`hitTest`・`intersectsRect` は `strokeColor` を見ない）。
    * 図形データのキー（`fillColor` は最後のキー）・`path` のキー順：一致（各 `toJSON`。`Path.js:342-351`）。
    * 色・太さの読み込み（`strokeWidth` のキーなし→2、`fillColor` のキーなし→`null`、それ以外の型は不正、色の中身は検証しない）：一致（`ShapeDataValidation.js:86-97`）。
    * 線の太さ2pxの4つの定義：一致（(1) `VectorModel.js:37-43` の `DEFAULT_NEW_SHAPE_STYLE.strokeWidth: 2`、(2) 各コンストラクタの `strokeWidth = 2`、(3) `ShapeDataValidation.js:21`（非公開）、(4) `SpriteSerializer.js:23`。`ShapeFactory.create` はスタイルを渡さない：`ShapeFactory.js:30-34`。`startDraft` が直後に上書き：`VectorModel.js:320-321`）。
    * 作業データ：保存対象に直前に使った値を含めない：一致。現行版2：一致（`DocumentSerializer.js:18`）。`migrateVersion1To2`（全図形の `fillColor` を `null`、`strokeColor`・`strokeWidth` に触れない、プレーンオブジェクトでない要素はそのまま）：一致（`DocumentSerializer.js:30-39,55`）。版2の作業データを版1までの古いエディタで開くと全体が断られる：Phase 6 開始時点（`433ae2f`）の `DocumentSerializer.js` は `CURRENT_DOCUMENT_VERSION = 1` で `version > CURRENT_DOCUMENT_VERSION` を全体失敗にしており一致。版1の `strokeColor: null` は版2の規則で線なしとして読まれる：一致（移行は `strokeColor` に触れず、検証は `null` を受理）。
    * スプライトデータ（書き出し形式の版2）のキー：一致（`SpriteSerializer.js:17,205-213`）。
    * 描画要素の共通キーと `fillColor`（各 `kind` の最後、塗れない形は `null`、`source` には元の値）：一致（各 `toDrawElement` の `fillColor: this.isFillable() ? this.fillColor : null`、`source` は `DocumentSerializer.serialize`）。`quadratic` の `fillColor` は常に `null`：一致（`Curve.isFillable()` が常に偽）。
    * 描き方の順序（パス → 塗り（`fillStyle` → `fill()` 引数なし）→ 線（`strokeStyle` → `lineWidth` → `stroke()`）、両方偽ならパスも組み立てない）：エディタ側（5クラスの `draw`）と書き出し側（`CodeExporter.js` の `DRAW_SOURCE` の `drawElement`）とも一致。
    * 読む側の規則（線を描かない条件、塗る条件＝`fillColor` が文字列かつ `polyline`/`ellipse` かつ `closed === true`、塗りも線もない要素はパスも組み立てない、`draw(ctx)` の明示設定に `fillStyle` を足さない、形の項目が足りない要素は塗りも線も描かない、版1の JS も `checkFormat` で `'supported'`）：一致（`DRAW_SOURCE`、`SpriteSerializer.js:185-197`）。
    * 外枠の求め方（`strokeColor` が文字列の要素だけ太さの半分を広げる、線なしで塗れない要素も和に含める）：一致（`SpriteSerializer.js:231-258`）。
    * キャンバス記録の保存しないものに直前に使った値：一致（`VectorModel` の `#newShapeStyle` は作業データ・スナップショットへ出ない）。
    * 新しく描く図形のスタイル（`NewShapeStyle` の5項目、既定 線あり `#000000`・太さ2・塗りなし・塗りの色 `#ffffff`、`startDraft` が当てる、作成途中に変えると作成途中の図形も変わる、塗れない形も `fillColor` を持つ、更新は `ShapeStyleEditor` のみ、`getPanelView()` だけでは変わらない、`replaceAllShapes` は触れない）：一致（`VectorModel.js:10-16,37-43,319-358,519-559`。`updateNewShapeStyle` の呼び出し元は `ShapeStyleEditor.js` のみ。作成途中の図形を作るのは `startDraft`（`VectorModel.js:322`）のみ）。当てないもの（結合等の結果は基準の線Aのスタイル）：一致（`PathJoinRules.js:89,146` が `toJSON()` のデータの `strokeColor`・`strokeWidth`・`fillColor` で `Path` を作る）。
    * エンジンとの約束 (a)〜(d)：照合できなかった（後述）。

  * **`PROJECT_ARCHITECTURE.md` 3章（同期の経路・1.・3.・6.・11.・13.・14.）**
    * 同期の経路（プロパティパネルの表示は `model.onChange` で同期）：一致（`main.js:474,515`）。
    * 1.「読み込み完了前の操作」の追加（重なり順も図形0個・選択集合が空のため何もしない、プロパティパネルは読み込み中も操作でき直前に使った値だけを変える）：一致（覆い要素は `z-index: 5`、フロートウィンドウは `z-index: 10`：`index.html:209-231,23-31`。`ShapeOrderRules` は選択なしで不変、`ShapeStyleEditor` は選択なしなら `updateNewShapeStyle` のみ）。
    * 3.「当たり分類」（正本は `PointHitRules.classifyPointHit`、ハンドル → 本体（選択集合の輪郭・手前優先 → 手前から輪郭または塗った内側）、塗った内側で押しても範囲選択は始まらない、選択集合外の図形は押してそのままドラッグでは動かない、範囲選択は輪郭のみ、見えない図形は輪郭だけで選ばれる）：一致（`PointHitRules.js:28-90`、`InputTracker.js:723-739,1175-1183,1063`）。06-03での振る舞いの変化（従来は奥優先）：`35bc91f`（06-03開始時点）の `#classifyPoint` は本体を図形配列の先頭から走査しており一致。
    * 3.「キーボード操作」の入力欄の規則（テキスト入力扱いの `input`（太さの欄＝`type="number"`）では全ショートカットとスペースパンが働かない、`checkbox`・`color` では `Space` のパンをせず `preventDefault()` もしない、`Ctrl` なしは働かず `Ctrl` 付きは働く、判定は `isTextInputElement`・`isSpaceOperatedInputElement`）：一致（`InputTracker.js:141-182,832-843,1147-1160`、`KeyboardShortcuts.js:166-193`、`index.html:418`）。`performShapeOrder` のコールバック：一致（`main.js:574-577`）。
    * 6.「記録する操作」の追加（重なり順は `ShapeOrderEditor.apply` で `reorderShapes` の前後・変わらなければ記録しない、プロパティパネルは `updateShapeStyles` の前後・色の欄は確定時に開始時の色へ戻してから1件・入れ替わっていれば捨てる）・「記録しない操作」の追加：一致（`ShapeOrderEditor.js:72-85`、`ShapeStyleEditor.js:106-120,189-205,233-258`）。
    * 11. 結合・描き足しの結果の塗りは基準の線A（元の線）のもの：一致（`PathJoinRules.js:89,146`）。
    * 13. プロパティパネル：
      * モジュールの分担・`StylePanelView` の二重定義：一致（`StylePanelRules.js:34-42` と `PropertyShapeSection.js:20-28` の内容は同じ）。
      * 表示の流れ（`model.onChange` → `syncPropertyShapeSection` → `getPanelView` → `render`、起動時にも1回）：一致（`main.js:470-474,664`）。
      * 表示の規則（中間表示、混在、塗れる形だけで決める・塗れる形が無ければ無効、最も手前の色、`#rrggbb`・`#rgb` の変換、変換できない色は覚えている色＋「表示できない色」、完全一致で混在判定）：一致（`StylePanelRules.js:68-181`、`PropertyShapeSection.js:43-47,225-244`）。
      * パネルが覚えている色・`getPanelView()` は純粋な照会でない：一致（`ShapeStyleEditor.js:73-81`）。
      * 反映の範囲（変えた項目だけ、塗りは塗れる形だけ、直前に使った値の同じ項目も更新、選択なしは直前に使った値だけで履歴なし、「あり」は表示中の色、色を選ぶと「あり」、塗れる形が無い選択の塗りの変更は `false`）：一致（`ShapeStyleEditor.js:106-205`）。
      * 履歴の単位・確定前に他の操作が起きた場合（コードで確かめられる範囲：`input` の間は `beginEdit` を呼ばない、確定の契機、図形が入れ替わっていれば捨てる）：一致（`ShapeStyleEditor.js:130-162,233-248`、`PropertyShapeSection.js:195-200`）。
      * 太さの受理（1以上100以下の整数）とフォーカス中は書き換えない・外れたら書き戻す：一致（`StylePanelRules.js:7,10,88-101`、`PropertyShapeSection.js:163-165,181-189,207-217`）。
      * ドラッグ中の変更を拒まない（`main.js` のコールバックも `ShapeStyleEditor` も `isDragging()` を見ない、`isDragging()` は閾値以前を含むセッション中に真、閾値超過後の左ドラッグ中は編集操作が開いている、`beginEdit` の上書き・`commitEdit` の対なしは `console.warn`）：一致（`main.js:454-462`、`InputTracker.js:466-468,950-956`、`HistoryManager.js:104-127`）。
      * 2段構成（「図形」`#property-shape-section`・接頭辞 `property-`、「重なり順」`#property-order-section`・接頭辞 `order-`、`<section class="property-section">` と見出し、段ごとに `palette/` の部品1つと `main.js` のブロック1つ、各部品はルート要素を受け取る）：一致（`index.html:408-435`、`main.js:447-515`、`PropertyShapeSection.js:123-131`、`PropertyOrderSection.js:67-70`）。接頭辞の読み方は4章「推測・所見」(3)。
    * 14. 重なり順の変更：
      * モジュールの分担・`ShapeOrderAvailability` の二重定義：一致（`ShapeOrderEditor.js:7-15` と `PropertyOrderSection.js:6-14` は同じ内容）。
      * 流れ（`performShapeOrder` がドラッグ中を不受理、`canReorderSelected` が偽なら何もしない、`beginEdit` → `reorderShapes` → `commitEdit`）：一致（`main.js:492-497`、`ShapeOrderEditor.js:72-85`）。
      * 押せる/押せないの同期・起動時1回・ボタンは `disabled` で始まる：一致（`main.js:511-515,668`、`index.html:430-433`）。
      * 規則（隣の1つ分、離れた選択はまとめない、連続は一緒に、相対順の保持、最前面へ・最背面へは端へ寄せる、選択なし・端・全選択は不変、キーは修飾なし・`Shift` 不可・前へ/後ろへのみリピート）：一致（`ShapeOrderRules.js:59-109`、`KeyboardShortcuts.js:106-109`）。
      * 並びが正本（当たり分類の手前優先と同じ順、06-04で `io/`・`shapes/`・`check/`・`PointHitRules`・`InputTracker`・`CanvasManager` を変えていない）：一致（`git diff --stat 6b843b1 25f280c` で該当ファイルの変更なし）。
    * 4章の表の追加（`PointHitRules.js` → `_doc/arch/18_PointHitRules.md`）：一致（ファイルが存在）。

  * **`_doc/arch/01_index_html.md`**
    * 「重なり順」の4ボタンの `title`：一致（`index.html:430-433`）。
    * プロパティパネル（静的・`hidden` なし・`×` なし・タイトル「プロパティ」のみ・`.disabled` を使わない・塗りの欄の無効表示は `input` の `disabled`・初期位置 `top: 16px; right: 508px; width: 220px`・`checked`/`value` の初期値なし・太さの欄の `user-select: text`）：一致（`index.html:240-244,292-297,403-437`。`WindowManager.js:61` は起動時の `.float-window` を `querySelectorAll` で検知）。
    * 2段構成（`<section class="property-section">`・`<h3 class="property-section-title">`・`.order-button-grid` の2×2・4ボタンは `disabled` で始まる・高さの見積もりはCSSコメント）：一致（`index.html:233-239,304-312,408-435`）。
    * `×` ボタンの記述にプロパティパネルを追加：一致。

  * **`_doc/arch/02_main.md`**
    * 行数 681行：一致（`wc -l js/main.js` = 681）。`// 7.7.` 約30行（`main.js:447-475`）・`// 7.8.` 約40行（`main.js:476-516`）：一致。増分 +35行（06-02：`git diff --stat 9086396 384c7c0 -- js/main.js` = 35 insertions）・+53行（06-04：`git diff --stat 6b843b1 25f280c -- js/main.js` = 53 insertions）：一致。
    * 主な関数の追加（`performShapeOrder`・`syncPropertyShapeSection`・`syncPropertyOrderSection`）：一致（いずれも `main.js` に存在。一覧の全関数が存在）。
    * 配線ブロック `// 7.7.`・`// 7.8.` の内容：一致。
    * 注入の表の追加（`ShapeStyleEditor`・`PropertyShapeSection`・`ShapeOrderEditor`・`PropertyOrderSection`・`KeyboardShortcuts` の4コールバック）：一致（`main.js:454-462,481,499-504,574-577`）。
    * 同一経路の原則・プロパティパネルの同一経路・押せる/押せない状態・起動時の同期の追加：一致（`main.js:470-474,492-497,511-515,664,668`。`main.js` で `getPanelView()` を呼ぶのは `syncPropertyShapeSection` のみ）。

  * **`_doc/arch/03_VectorModel.md`**
    * 責務の一文・公開メソッドの一覧：一致（`VectorModel.js` の公開メソッドは一覧と過不足なく一致）。
    * `reorderShapes(orderedIds)`（不正入力は `console.warn`・`false`、全位置同一なら警告・通知なしで `false`、それ以外は置き換えて通知1回・`true`、触れない状態、`getSelectedIds` は新しい並びの順、呼び出し元は `ShapeOrderEditor` のみ）：一致（`VectorModel.js:206-210,667-689`）。
    * 新しく描く図形のスタイル（`getNewShapeStyle` はコピー、`updateNewShapeStyle` は5キーで自身のプロパティだけ・変わったときだけ作成途中の図形に当てて通知1回・`true`、`startDraft` で当てる・有無が偽は `null`、`replaceAllShapes` は触れない、更新は `ShapeStyleEditor` のみ）：一致（`VectorModel.js:330-358,716-724`）。
    * `updateShapeStyles(changes)`：一致（`VectorModel.js:368-381`。境界の読み方は4章「推測・所見」(2)）。
    * 知らないこと（例外としてスタイル3つは書く）：一致。

  * **`_doc/arch/06_InputTracker.md`**
    * export に `isSpaceOperatedInputElement`（`checkbox`・`color`）：一致（`InputTracker.js:172,180-182`）。
    * スペースパンの入力欄の規則：一致（`InputTracker.js:832-843,1147-1160`）。
    * 知らないこと（当たり判定のメソッドは `PointHitRules` 経由でのみ呼ぶ、`intersectsRect`・`getVertexIndexForHandle` は直接呼ぶ、`isFillable()`・`fillColor` を読まない）：一致（`InputTracker.js` に `.hitTest(`・`.hitTestHandle(`・`.hitTestFill(`・`isFillable`・`fillColor` の呼び出し・参照は無い。`intersectsRect` は 1063行、`getVertexIndexForHandle` は 998行）。
    * 当たり分類（`#classifyPoint` は図形配列・`isSelected`・許容誤差を渡すだけ）：一致（`InputTracker.js:1175-1183`）。
    * 行数 1305行：一致（`wc -l js/core/InputTracker.js` = 1305）。

  * **`_doc/arch/07_KeyboardShortcuts.md`**
    * 重なり順のキー（`Home`/`PageUp`/`PageDown`/`End`、修飾なし・`Shift` 不可、前へ・後ろへのみリピート、コールバックは並びを変えた場合のみ `true`）：一致（`KeyboardShortcuts.js:106-109`、`main.js:574-577,492-497`）。
    * `InputTracker.js` からの import（`OperationMode`/`SHAPE_TYPES`/`isTextInputElement`/`isSpaceOperatedInputElement` のみ）と手順4：一致（`KeyboardShortcuts.js:7,180-183`）。

  * **`_doc/arch/08_HistoryManager.md`**
    * 呼び出し元に `ShapeStyleEditor`・`ShapeOrderEditor` を追加、いずれも `HistoryManager.js` を import しない：一致（`beginEdit()` の呼び出しは `InputTracker`・`EndpointSnapper`・`PathJoiner`・`ShapeInserter`・`ShapeOrderEditor`・`ShapeStyleEditor`・`main.js` のみ。`HistoryManager.js` の import は `main.js` のみ）。

  * **`_doc/arch/10_ShapeFactory.md`**
    * 15メソッド契約：一致。

  * **`_doc/arch/12_shapes.md`**
    * `ShapeGeometry.js` の関数一覧（`isPointInPolygonNonzero` の追加。nonzero・境界上は偽・頂点3未満と面積0は偽・`Rect`・`Path` が使う）：一致（`ShapeGeometry.js:21,61,88,111-142`、`Rect.js:6`、`Path.js:6`）。
    * `validateShapeData` の戻り値（既定値解決済みの新しいオブジェクト、`data` を書き換えない、各 `fromJSON` が戻り値をコンストラクタへ渡す）・検査の順序・`DEFAULT_STROKE_WIDTH` は非公開：一致（`ShapeDataValidation.js:21,65-98`、各 `fromJSON` の `style.strokeColor`・`style.strokeWidth`・`style.fillColor`）。
    * `PathJoinRules` の結果の塗り：一致（`PathJoinRules.js:89,146`）。
    * 15メソッド契約の一覧・5クラスの自律実装：一致。
    * `isFillable()` の各クラスの値・外から使っているのは `StylePanelRules`・`ShapeStyleEditor`・各 `hitTestFill`：一致（`js/` で `isFillable` を外から呼ぶのは `StylePanelRules.js:170`・`ShapeStyleEditor.js:22` のみ）。06-02で `shapes/` を変更していない：一致（`git diff --stat 9086396 384c7c0 -- js/shapes` は空）。
    * `draw` の描き方（5クラス共通、判定の2行は各クラス、`DRAW_SOURCE` と揃う）：一致。
    * `toDrawElement()` の `fillColor`：一致。
    * `hitTestFill`（塗られているときだけ真、許容誤差なし、境界上は偽、`Rect`・`Path` は `isPointInPolygonNonzero`、`Ellipse` は `value < 1` で半径0は偽、`Line`・`Curve` は常に偽、呼び出し元は `PointHitRules` のみ）：一致（`Rect.js:139-144`、`Path.js:225-230`、`Ellipse.js:374-390`、`Line.js:73-78`、`Curve.js:175-180`。`js/` で `hitTestFill` を呼ぶのは `PointHitRules.js:66` のみ）。`Ellipse.hitTest` の通常の分岐（`|r − 1| ≤ allowedDiff`）と `hitTestFill`（`value < 1` ⇔ `r < 1`）の和が `r ≤ 1 + allowedDiff` を覆うこと：式（`Ellipse.js:320-357,374-390`）から一致。
    * `toDrawElement()` の `Ellipse` の種別による分岐が2箇所：一致（`Ellipse.js:503,506`）。
    * `fromJSON` の受理条件の追記（`strokeWidth` のキーなし→2、`fillColor` のキーなし→`null`、`strokeColor` のキーなしは不正）：一致。
    * `Ellipse` の `isFillable` の分岐・弧の塗り/回転の注意・`Path` の曲線の区間の注意：一致（`Ellipse.js:83,369`、`Path.js:219-220`）。

  * **`_doc/arch/13_palette.md`**
    * `palette/` の冒頭（独自のカラーピッカーは未実装）：一致。
    * `PropertyShapeSection`（公開 `render`、コールバック6つ・関数でなければ `Error`・要素が欠ければ `console.warn` で配線しない、import なし、表示の規則、`indeterminate`、文言の唯一の定義、`textContent`、二重定義、段の足し方）：一致（`PropertyShapeSection.js:43-62,107-244`。文言の読み方は4章「推測・所見」(4)）。
    * `PropertyOrderSection`（公開 `render`、コールバック4つ、`Error`/`console.warn`、import なし・`ShapeOrderOperation` を参照しない、二重定義）：一致（`PropertyOrderSection.js:29-93`）。

  * **`_doc/arch/14_edit.md`**
    * 冒頭（3章11.〜14.）・知らないことの例外：一致。
    * 依存（`ShapeStyleEditor` は `./StylePanelRules.js` のみ、`ShapeOrderEditor` は `./ShapeOrderRules.js` のみ、両規則は import なし、`core/` は `edit/` を import しない）：一致。他の `edit/` の import も記述どおり（`EndpointSnapper.js:5-15` は `EndpointSnapRules`・`PathJoinRules` のみ等）。
    * `StylePanelRules`（公開 `STROKE_WIDTH_MIN`・`STROKE_WIDTH_MAX`・`toColorInputValue`・`parseStrokeWidthInput`・`buildStylePanelView`・typedef、`#rrggbb`・`#rgb` 以外は `null`、使う側は `ShapeStyleEditor` のみ）：一致。
    * `ShapeStyleEditor`（公開メソッド7つ、依存の `model` メソッド5つ、import・DOM・`try/catch`・ドラッグ中の判定なし、契約、`COLOR_ITEMS` の `shapeKey`）：一致（`ShapeStyleEditor.js:13-24,46-258`）。戻り値の記述の読み方は4章「推測・所見」(1)。
    * `ShapeOrderRules`（公開 `ShapeOrderOperation`・`reorderSelected`・`canReorderSelected`、未知の操作は `Error`、使う側は `ShapeOrderEditor` と `main.js`（定数のみ））：一致（`main.js:30` は `ShapeOrderOperation` のみ import）。
    * `ShapeOrderEditor`（公開 `apply`・`getAvailability`、呼び出し元、依存、契約、二重定義）：一致。

  * **`_doc/arch/15_io.md`**
    * `DocumentSerializer` のマイグレーション表の例外・現行版2・`MIGRATIONS` 版1→版2：一致。
    * `SpriteSerializer` の外枠で `strokeColor` を見る・現行の書き出し形式の版2・`checkFormat` は版1も受理：一致。
    * `CodeExporter` の `DRAW_SOURCE` の塗りの規則と各図形の `draw` との一致：一致。

  * **`_doc/arch/16_test.md`**
    * 実物を組み合わせる例外（`ShapeStyleEditor.test.js` は `model.onChange(() => editor.getPanelView())` を登録、`ShapeOrderEditor.test.js` は `DocumentSerializer`・`SpriteSerializer` も使う）：一致（`test/edit/ShapeStyleEditor.test.js:7-13,58`、`test/edit/ShapeOrderEditor.test.js` の import）。
    * 各テストファイルの検証範囲の記述（`ShapeOrderRules`・`VectorModel.reorderShapes`・`ShapeOrderEditor`・`Line`/`Curve`/`Rect`/`Ellipse`・`Path`・`ShapeGeometry`・`PointHitRules`・`PathJoinRules`（塗りの引き継ぎ）・`VectorModel.style`・`StylePanelRules`・`ShapeStyleEditor`・`DocumentSerializer.roundtrip`（版2）・`DocumentSerializer.migration`・`SpriteSerializer`・`CodeExporter`・`FileContentReader`）：いずれも実際のテストの見出し・内容と一致。
    * 「書き換えた既存のテスト」06-03・06-04は無し：06-04はテストの削除行0（`git diff 6b843b1 25f280c -- test`）。06-03の削除行3はいずれもテストファイル先頭の責務コメント（`Ellipse.test.js`・`Path.test.js`・`Rect.test.js`）で、テストケースの変更は無い。一致。
    * 版を上げるとき（現在は版2、移行は `migration.test.js`、`MIGRATIONS` の未定義・throw・オブジェクト以外の経路はテストしていない）：一致（`migration.test.js` にこれらの経路のケースは無い）。
    * テストできない箇所（06-02・06-03・06-04の追加）：対象が DOM・`HTMLInputElement`・`document` に依存することはコードと一致（`PropertyShapeSection`・`PropertyOrderSection` は DOM、`isSpaceOperatedInputElement` は `HTMLInputElement`、`KeyboardShortcuts` は `document.addEventListener`）。

  * **`_doc/arch/18_PointHitRules.md`**（新規ファイル全体）
    * 公開（`classifyPointHit(shapes, isSelected, x, y, tolerance)`、typedef `PointHit` の正本、`InputTracker.js` は `import()` 型の別名、非公開の補助関数）：一致（`PointHitRules.js:9-14,28,57,85`、`InputTracker.js:32`）。
    * 読むもの（`id`・`hitTestHandle`・`hitTest`・`hitTestFill`・`isSelected`）・import なし・使う側は `#classifyPoint` のみ・知らないこと：一致。
    * 規則の要約 (1)〜(3)、`handle` と `bodyId` を独立に求める：一致（`PointHitRules.js:28-90`）。

  * **照合できなかった主張（理由）**
    * 2章「エンジンとの約束」(a)〜(d)（エンジンの `oz/ENGINE_API.md` 23章・`PROJECT_ARCHITECTURE.md` 2.1章の参照、エンジンが `draw(ctx)` だけを読むこと、版2への版上げは連絡済みでエンジンのコードの変更なしに表示できたこと、エンジンの `assets/sprites/ship.js` の内容と運用）：本リポジトリの外のため照合していない（REQの指定）。
    * ブラウザの振る舞いに依る記述（3章13.「キャンバスの `mousedown` の後にフォーカスが移って太さの欄の `change` が来る」「ブラウザによっては1回のピッカーの操作が複数件に分かれる」、06_InputTracker「チェックボックスの切り替えは `keyup` で起きる」、01_index_html「`<input type="color">` は `#rrggbb` しか表示できない」、ボタン・パネルの見た目の寸法の見積もり）：ブラウザの実装の振る舞いでありコードからは確かめられない。各コードが記述の前提どおりに書かれていること（`change`・`blur`・`keydown` の購読、`keyup` で `preventDefault()` しない条件、CSSの値）は確認した。
    * 「通常のマウス操作では起こりにくい」「機体の絵で円を多角形より手前に描くため」等の頻度・目的の記述：方針の記述でありコードの振る舞いとして確かめる対象ではない。

* **推測・所見**:
  * 以下は相違ではないが、記述が実コードと照らして複数の読み方ができるもの。
  * (1) `_doc/arch/14_edit.md` `ShapeStyleEditor.js`「各変更メソッドは受理したか（`boolean`）を返す」：公開メソッド一覧に含まれる `finishColorPreview()` は戻り値を持たない（`ShapeStyleEditor.js:179-181`）。`finishColorPreview` を「変更メソッド」に含めない読み方なら一致、含める読み方なら食い違う。
  * (2) `_doc/arch/03_VectorModel.md` `updateShapeStyles`「1図形以上に代入したときだけ1回通知し、代入した図形の数を返す」：実コードは id が見つかった図形の数を数え、`style` にスタイル3つのキーが1つも無い場合（例 `style: {}`）や値が同じ場合も、その図形を数えて通知する（`VectorModel.js:368-381`）。「代入した」を「idが見つかった」と読めば一致、「実際にプロパティへ値を書いた」と読めば境界で食い違う。現在の呼び出し元（`ShapeStyleEditor`）は常にスタイルのキーを1つ渡している。
  * (3) `PROJECT_ARCHITECTURE.md` 3章13.・`_doc/arch/01_index_html.md`「段のidは段ごとの接頭辞（「図形」の段は`property-`、「重なり順」の段は`order-`）で重複させない」：「重なり順」の段のルート要素のid `property-order-section` は「図形」の段の接頭辞 `property-` で始まる（`index.html:427`）。段の中の要素のidは記述どおり（「図形」は `property-stroke-enabled` 等、「重なり順」は `order-bring-to-front` 等）。段のルート要素のidは `property-<段>-section` の形（「頂点」の段の例も `property-vertex-section`）と読めば一致する。各部品はルート要素内の `querySelector` で要素を解決するため、実際の衝突は起きない。
  * (4) `_doc/arch/13_palette.md` `PropertyShapeSection`「文言（「混在」「表示できない色」「次に描く図形」等）はこのファイルが唯一の定義箇所。文字は`textContent`で設定する」：太さの欄の「混在」は `textContent` ではなく `placeholder` プロパティで設定している（`PropertyShapeSection.js:62,212`）。「文字」を要素の本文に限ると読めば一致（`innerHTML` は使っていない）。また段の見出し・ラベル（「図形」「重なり順」「線」「太さ」「塗り」）は `index.html` に静的に書かれており、唯一の定義箇所の対象は動的な文言と読める。
  * (5) `_doc/arch/01_index_html.md`「太さの欄のみ`user-select: text`」：プロパティパネル内では太さの欄のみ（`index.html:293-297`）。`index.html` 全体では `?dev` の確認用ウィンドウの欄（`index.html:323-340`）にも `user-select: text` がある。プロパティパネルの項の中の記述として読めば一致。

## 5. 開発資料との相違
* 相違なし（照合した `+` 行の主張は、すべて現在の `HEAD` の実コードと一致した。読み方が分かれる記述は4章「推測・所見」(1)〜(5)に記載した。後のサブフェイズのコード変更で古くなった前のサブフェイズの記述は見つからなかった）。

## 6. 懸念事項・今後の修正における注意点
* 行数（`main.js` 681行・`InputTracker.js` 1305行）は資料に数値で書かれているため、両ファイルを変更するたびに資料の更新が要る。
* `StylePanelView`（`StylePanelRules.js`／`PropertyShapeSection.js`）と `ShapeOrderAvailability`（`ShapeOrderEditor.js`／`PropertyOrderSection.js`）は二重定義で、現時点では内容が一致している。形を変えるときは両方を揃える必要がある。
* エディタの `draw`（5クラス）と書き出しの `DRAW_SOURCE` の塗る条件は、現時点では「塗れる形の要素だけが `closed === true` かつ `fillColor` が文字列になり得る」ことで同じ結果になっている。塗れる形や `closed` の意味を変えるときは両方と `test/io/CodeExporter.test.js` を揃える必要がある。
