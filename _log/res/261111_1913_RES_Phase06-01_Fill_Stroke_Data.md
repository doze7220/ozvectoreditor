# RES: 作業計画・作業レポート (Phase 06-01) : 塗り・線なしのデータと描画
* 参照元REQ: `./_log/req/261111_1828_REQ_Phase06-01_Fill_Stroke_Data.md`

## 1. 作業目的
図形データに塗り（`fillColor`。色の文字列または`null`＝塗りなし）と「線なし」（`strokeColor: null`）を足し、エディタの描画・作業データの保存と読み込み・スプライトJSの書き出しを対応させる。画面から色を変える操作は作らない（Phase 06-02）。本サブフェイズで塗り・線なしの図形が現れるのは、作業データ（作業データファイル・`?dev`の「JSONから復元」・書き出したスプライトJSの`source`）から読み込んだときと、それらを結合・描き足ししたときだけ。新しく描く図形は従来どおり線あり（`'#000000'`・2px）・塗りなし（`fillColor: null`）。

あわせて次を行う。
* 作業データの版を2に上げ、版1→版2の移行（全図形を塗りなしにする）を`DocumentSerializer`の`MIGRATIONS`に足す。
* 書き出し形式の版を2に上げ、描画要素に`fillColor`を足し、書き出したJSの描画処理（`CodeExporter`の`DRAW_SOURCE`）を図形の`draw`と一致させる。
* DIRの持ち越し事項：`strokeWidth`が無い図形データを2pxとして読み込む／`DRAW_SOURCE`と各図形の`draw`の一致テストを通す／開発資料2章「塗りつぶしの共通プロパティは未定義」を改める。

## 2. アーキテクチャ設計

### 要件1: 図形データの形と検証（作業データの版2）
**図形データの形**（全6種。`fillColor`は`strokeWidth`の後＝最後のキー）
* `line`・`curve`・`rect`・`circle`・`arc`：`{ type, id, points, strokeColor, strokeWidth, fillColor }`
* `path`：`{ type: 'path', id, points, closed, segments, strokeColor, strokeWidth, fillColor }`
* `strokeColor`：色の文字列、または`null`（線なし）。`strokeWidth`：正の有限の数値。`fillColor`：色の文字列、または`null`（塗りなし）。
* 塗れない形（要件2）の図形も`fillColor`を消さずに保持し、`toJSON`は保持している値をそのまま出力する。
* 色の文字列の中身（CSSの色として正しいか）は検証しない（従来の`strokeColor`と同じ）。

**検証（`js/shapes/ShapeDataValidation.js`の`validateShapeData`）**
* 検査の順序：オブジェクトか → `type` → `points`の要素数 → 各頂点 → `strokeColor` → `strokeWidth` → **`fillColor`（新規）**。パス固有の項目（`closed`・`segments`）は従来どおり`Path.fromJSON`側で、共通項目の後に検査する（位置は変えない）。
* `strokeColor`：`typeof === 'string'`または`=== null`なら受理。それ以外（キーなし・`undefined`・数値等）は不正。
* `strokeWidth`：値が`undefined`（キーなしを含む）なら`DEFAULT_STROKE_WIDTH`（2）として読み込む。値があって`Number.isFinite`でない・0以下（`null`・文字列・`NaN`・`Infinity`・0・負）は従来どおり不正、エラー文も変えない。
* `fillColor`：値が`undefined`（キーなしを含む）なら`null`として読み込む。文字列・`null`は受理。それ以外（数値・真偽値・オブジェクト・配列等）は不正。
* **エラー文（全文。`<クラス名>`は`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）**
  * `strokeColor`（文面を改める）：`<クラス名>.fromJSON: strokeColorが文字列またはnullではありません`（旧：`strokeColorが文字列ではありません`）
  * `strokeWidth`（変えない）：`<クラス名>.fromJSON: strokeWidthが正の有限の数値ではありません`
  * `fillColor`（新規）：`<クラス名>.fromJSON: fillColorが文字列またはnullではありません`
* **戻り値（新規）**：`validateShapeData`は、検証に通った共通項目のうち描画の属性を、既定値を解決した値として返す：`{ strokeColor, strokeWidth, fillColor }`（typedef`ShapeStyle`を同ファイルに定義。`strokeColor: string|null`・`strokeWidth: number`（キーなしなら2）・`fillColor: string|null`（キーなしなら`null`））。毎回新しいオブジェクト。`data`は書き換えない。各図形クラスの`fromJSON`はこの戻り値をコンストラクタへ渡す（`data.strokeWidth`を直接渡さない）。
  * 理由：`data`を書き換えずに既定値を適用するため。既定値の知識を`ShapeDataValidation.js`の1箇所に閉じ、図形クラスへ複製しないため。
* **2pxの既定値**：`js/shapes/ShapeDataValidation.js`に非公開の定数`DEFAULT_STROKE_WIDTH = 2`を定義する（`shapes/`内の唯一の定義）。JSDocに「`io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`（書き出し形式の読む側の既定値）と同じ値であるべき。`shapes/`は`io/`をimportできないため別に定義する。図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義」と書く。
* ファイル先頭の責務定義を「図形データの共通項目の検証と、キーが無い項目の既定値の解決」を含む文面へ改める（3行以内）。

**作業データの版2（`js/io/DocumentSerializer.js`）**
* `CURRENT_DOCUMENT_VERSION = 2`。
* 非公開のモジュール関数`migrateVersion1To2(doc)`を`MIGRATIONS`の前に定義し、`MIGRATIONS = Object.freeze({ 1: migrateVersion1To2 })`とする。
  * 戻り値：`{ ...doc, version: 2, shapes }`の新しいオブジェクト。`shapes`は、`doc.shapes`が配列なら各要素のうちプレーンオブジェクト（`typeof === 'object'`・`!== null`・配列でない）を`{ ...item, fillColor: null }`へ置き換え、それ以外の要素はそのまま残した新しい配列。`doc.shapes`が配列でなければその値をそのまま入れる（後段の「`shapes`が配列ではありません」の全体失敗に任せる）。
  * 版1に`fillColor`の意味はないため、要素が`fillColor`を持っていても`null`にする。`strokeColor`・`strokeWidth`には触れない（`strokeWidth`が無い要素は図形クラスの検証で2pxになる）。
  * 引数（`doc`・`doc.shapes`・各要素）を書き換えない。throwしない。
  * プレーンオブジェクトの判定は関数内に書く（`DocumentSerializer.#isPlainObject`はクラス外から呼べないため。既存のprivateメソッドは変えない）。
* `MIGRATIONS`のJSDoc（「現時点では版1のみのため空」）・typedef`DocumentData`（「版1」・図形データの形）を現行の内容へ改める。
* 版2の作業データを古いエディタで開くと「対応していない版」として全体が断られる（DIRの決定どおり。許容）。

### 要件2: 塗れる形と描画（エディタ）
* **公開メソッド`isFillable()`**（14番目の共通メソッド。全5クラスで自律実装。戻り値は真偽値。データに保存しない）
  * `Line`：常に`false`。`Curve`：常に`false`。`Rect`：常に`true`。`Ellipse`：`this.type === 'circle'`（弧は`false`）。`Path`：`this.closed === true`。
  * Phase 06-02（塗りの欄の無効表示）・06-03（内側の当たり判定）で外から使う予定。
  * 各クラスのクラスJSDocの契約の列挙を「14メソッド：…・isFillable」に改める。`Ellipse`は`ELLIPSE_TYPES`のJSDocの「種別で分岐する全箇所」に`isFillable`を足す。
* **`draw`の描き方**（全5クラス共通の順序。`DRAW_SOURCE`と同じ命令・同じ順）
  1. `const shouldFill = this.isFillable() && typeof this.fillColor === 'string';` `const shouldStroke = typeof this.strokeColor === 'string';`
  2. どちらも偽なら何も呼ばずに`return`（`beginPath`も呼ばない）。
  3. 形のパスを組み立てる（従来と同じ命令：`beginPath` → … → 閉じる形なら`closePath`。`Path`は既存の`#tracePath`を使う）。
  4. `shouldFill`なら`ctx.fillStyle = this.fillColor;` → `ctx.fill();`（引数なし＝nonzero）。
  5. `shouldStroke`なら`ctx.strokeStyle = this.strokeColor;` → `ctx.lineWidth = this.strokeWidth;` → `ctx.stroke();`（従来と同じ）。
  * 塗りなし・線ありの図形（これまでの図形）の描画命令は従来と完全に同じになる。
  * 塗る/線を描くの判定の2行は各クラスに書く（`draw`は図形クラスごとの自律実装。共通モジュールは幾何と検証に限るため新設しない）。塗れるかの規則は`isFillable()`だけに置く。
* `drawHandles`・`drawHover`・`hitTest`・`intersectsRect`・`hitTestHandle`は変えない。線なしで塗れない形の図形（線なしの直線等）は何も描かれないが、データとして受理し、従来どおり選べる。
* **コンストラクタ**：最後の引数に`fillColor = null`を足す（既存の引数の位置・既定値は変えない）。
  * `Line(x1, y1, x2, y2, strokeColor = '#000000', strokeWidth = 2, fillColor = null)`
  * `Curve`・`Rect`：`Line`と同じ並び。
  * `Ellipse(x1, y1, x2, y2, shapeType = 'circle', strokeColor = '#000000', strokeWidth = 2, fillColor = null)`
  * `Path(points, closed = false, strokeColor = '#000000', strokeWidth = 2, fillColor = null)`
  * プロパティ：`/** @type {string|null} 塗りの色。nullは塗りなし。塗れない形でも保持する（描かないだけ） */ this.fillColor = fillColor;`。`strokeColor`の型の記述は`string|null`（`null`＝線なし）へ改める（JSDocがあるクラスのみ。無いクラスは付ける）。
* **`fromJSON`**：`const style = validateShapeData(...)`の戻り値の`style.strokeColor`・`style.strokeWidth`・`style.fillColor`をコンストラクタへ渡す。`Path`は共通の検証 → パス固有の検査 → `new Path(data.points, data.closed, style.strokeColor, style.strokeWidth, style.fillColor)`。`@throws`の記述を要件1の条件へ改める。
* **`toJSON`**：最後に`fillColor: this.fillColor`を足す（キー順は要件1）。JSDocの形・`@returns`・「バージョン1」の記述を改める。
* **`toDrawElement`**：最後に`fillColor: this.isFillable() ? this.fillColor : null`を足す（キー順は要件4）。`strokeColor`は従来どおりそのまま（`null`も）入れる。JSDocの形・`@returns`を改める。
* **`ShapeFactory`**：`create`は既存の引数のままで動く（塗りの引数は既定値`null`）。変更は`fromJSON`のJSDocの図形データの形の記述（`{ type, id, points, strokeColor, strokeWidth }`）に`fillColor`を足すことだけ。

### 要件3: 結合・描き足し・閉じるの塗り（`js/shapes/PathJoinRules.js`）
* `new Path(...)`を呼ぶ箇所は`buildClosedPath`と`assembleOpenPath`の2箇所のみ（`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`は`assembleOpenPath`を通る。`planJoin`・`planDrawnLineJoin`・`planEndpointDragJoin`は上の関数を通る）。
  * `buildClosedPath`：`new Path(points, true, data.strokeColor, data.strokeWidth, data.fillColor)`（元の線の塗りを保つ）。
  * `assembleOpenPath`：`new Path(points, false, dataA.strokeColor, dataA.strokeWidth, dataA.fillColor)`（基準の線A＝重なり順で奥、描き足しは元の線）。
* 読むのは従来どおり`toJSON()`の図形データだけ（`fillColor`は`toJSON()`に入る）。`dataA`の型の記述・「色と太さはAのもの」等のJSDocを「色・太さ・塗りはAのもの」へ改める。
* 開いたパスを結合で閉じると閉じたパス（塗れる形）になるため、持っていた塗りが現れる。直線の`fillColor`は描かれないが結果のパスに引き継がれる。
* `edit/`（`PathJoiner`・`EndpointSnapper`）は変更しない。

### 要件4: スプライトJSの書き出し（書き出し形式の版2）
* **`js/io/SpriteSerializer.js`**
  * `SPRITE_FORMAT_VERSION = 2`。`checkFormat`は1以上・現行版以下を受理するため、版1のJSも読める（変更なし）。
  * typedef`DrawElement`：共通のキーに`fillColor`（`string|null`）を足し、`strokeColor`を`string|null`とする。typedef`SpriteData`の「版1」の記述を改める。
  * 外枠：`#computeBounds`の`half`を、`typeof element.strokeColor === 'string'`のときだけ`resolveStrokeWidth(element.strokeWidth) / 2`、それ以外は`0`にする（線を描かない要素は形の範囲のまま）。形の範囲は従来どおり全要素の和に含める（線なしで塗れない要素も含める）。未知の`kind`は従来どおり`Error`。`#computeBounds`のJSDocを改める。
* **描画要素**：全`kind`に`fillColor`を最後のキーとして足す（値は要件2の`toDrawElement`）。
  * `polyline`：`kind, id, points, closed, strokeColor, strokeWidth, fillColor`
  * `quadratic`：`kind, id, points, strokeColor, strokeWidth, fillColor`（値は常に`null`）
  * `ellipse`：`kind, id, x, y, radiusX, radiusY, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor`
* **読む側の規則**（書き出したJSの`draw`も従う）
  * 塗るのは、`fillColor`が文字列で、かつ`kind`が`polyline`または`ellipse`で`closed === true`の要素だけ。`quadratic`・`closed`が`true`でない要素・`fillColor`が無い/文字列でない要素は塗らない。
  * 塗りは形のパスを組み立てた後、線より先に`fillStyle` → `fill()`（引数なし＝nonzero）。
  * 「`strokeColor`が文字列でない要素は線を描かない」は線についての規則で、塗りには影響しない。
  * 塗りも線も描かない要素はパスも組み立てない。形の項目が足りない要素・未知の`kind`の要素は塗りも線も描かない。
* **`js/io/CodeExporter.js`の`DRAW_SOURCE`**：`drawElement`を次の形へ書き直す（`draw(ctx)`の明示設定は変えない）。
  ```js
  function drawElement(ctx, element) {
      const shouldStroke = typeof element.strokeColor === 'string';
      const shouldFill = typeof element.fillColor === 'string' && element.closed === true
          && (element.kind === 'polyline' || element.kind === 'ellipse');
      if (!shouldStroke && !shouldFill) {
          return;
      }
      switch (element.kind) {
          // polyline・quadratic・ellipse の形の項目の確認とパスの組み立ては従来のまま（足りなければ return）
          default:
              return;
      }
      if (shouldFill) {
          ctx.fillStyle = element.fillColor;
          ctx.fill();
      }
      if (shouldStroke) {
          ctx.strokeStyle = element.strokeColor;
          ctx.lineWidth = /* 従来の式（正の有限の数値でなければ DEFAULT_STROKE_WIDTH） */;
          ctx.stroke();
      }
  }
  ```
  * `drawElement`の説明コメント（埋め込むテキスト内のJSDoc）と`DRAW_SOURCE`定数のJSDocを、塗りの規則を含む文面へ改める。テンプレート文字列・`import`・外部の名前を使わない制約は維持する。
  * 図形の`draw`と命令・引数・順序が一致する：塗れる形の要素だけが`closed === true`かつ`fillColor`が文字列になり得るため、図形側の`isFillable() && typeof fillColor === 'string'`と書き出し側の条件は同じ結果になる。
* エンジンは`draw(ctx)`を呼ぶだけなので変更不要。連絡票はPhase 06-05。

### 要件5: 自動テスト
* 規則（`_doc/arch/16_test.md`）：`node:test`・`node:assert/strict`のみ、公開APIのみ、テストのためにソースを書き換えない、補助関数は各テストファイル内（JSDoc付き）、`console.warn`は`t.mock.method`で抑止。
* マイグレーションのテストは**`test/io/DocumentSerializer.migration.test.js`を新設**する（`DocumentSerializer.errors.test.js`は全体失敗・スキップの契約に絞られており、版の移行は観点が別のため）。
* **一致テストが途中で失敗しない順序**：図形クラスのタスク（タスク2〜6）では、塗りなし・`strokeColor`が文字列の図形の描画命令が従来と同じになるため、`test/io/CodeExporter.test.js`の既存の一致テスト（すべて塗りなし・線あり）は通り続ける。塗り・線なしの図形の一致テストは`DRAW_SOURCE`を直すタスク10で足す。
* **他のテストファイルへの波及（各タスクで書き換える既存のケース）**：
  * タスク1：検証の規則の変更により、`test/shapes/`の5ファイルの`strokeColor`・`strokeWidth`のエラー文のケースが変わる（`ShapeDataValidation`のテストは図形クラスのテストを通して行う決まりのため、タスク1に含める）。
  * タスク2・3・5・6：`toDrawElement`のキー順の変更により、`test/io/SpriteSerializer.test.js`の該当クラスのキー順のケース（1ケースずつ）が変わる。
  * タスク8：作業データの版の変更により、`test/io/SpriteSerializer.test.js`の`source.version`が`1`のケース（2ケース）が変わる。
* `test/io/CodeExporter.assembly.test.js`は触らない（「P7のキャラ合成」の書き換えは行わない）。

### 要件6: テストプレイ
* テストプレイ用の作業データファイルは現場設計AIが用意する（実装AIは作らない）。確認項目は5章に列挙する。

### 要件7: 開発資料への記載
* 下の「開発資料の更新予定」に列挙し、タスク14で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形クラス（`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）、共通モジュール（`ShapeDataValidation`）、図形をまたぐ規則（`PathJoinRules`）
    *   `./js/io/` - `DocumentSerializer`（版2・移行）、`SpriteSerializer`（書き出し形式の版2・外枠）、`CodeExporter`（`DRAW_SOURCE`）
    *   `./js/core/` - `ShapeFactory`（JSDocの図形データの形のみ）
    *   `./test/shapes/`・`./test/io/` - 自動テスト（新設：`test/io/DocumentSerializer.migration.test.js`）
*   **関連する論理クラス**: `Line`・`Curve`・`Rect`・`Ellipse`・`Path`（具象。基底クラスなし。14メソッド契約を自律実装）、`validateShapeData`（共通の関数）、`PathJoinRules`（規則の関数群）、`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`（静的メソッドのみのクラス）、`ShapeFactory`（Factory）
*   **新設の論理クラス・ファイル**：ソースはなし。テストは`test/io/DocumentSerializer.migration.test.js`のみ。
*   **変更しないもの**：`core/`（`ShapeFactory`のJSDocを除く）・`edit/`・`palette/`・`main.js`・`index.html`・`check/`・`sprite-check.html`・`js/shapes/ShapeGeometry.js`・`EndpointSnapRules.js`・`js/io/FileContentReader.js`・`CanvasStorage.js`・`DocumentFileIO.js`・`test/core/`・`test/edit/`・`test/check/`・`test/io/CodeExporter.assembly.test.js`・`test/io/DocumentSerializer.errors.test.js`・`test/io/DocumentFileIO.test.js`・`test/shapes/EndpointSnapRules.test.js`。

### 参照する責務
（`PROJECT_ARCHITECTURE.md`と`_doc/arch/`からの抜粋。以後のタスク実行は、この項目を責務の情報源とする）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`shapes/`は`core/`・`io/`をimportしない。`core/ShapeFactory`は`shapes/`のみをimportする。`io/`は`edit/`をimportしない。`check/ → io`（`SpriteSerializer`のみ）。
*   **図形クラス（`shapes/`）**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。座標はすべてワールド座標。**共通基底クラスは無い**。共通メソッド契約を各クラスが自律実装し、クラスJSDocに契約を列挙する（メソッドを増減する場合は`Path`を含む5クラスのクラスJSDocを更新する）。
    *   現在の13メソッド：`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest`、`hitTestHandle`、`setVertex`、`translate`、`updateDraftEnd`、`getVertexIndexForHandle`、`intersectsRect`、`toDrawElement()`、`toJSON()`、`static fromJSON(data)`。`Line`は`draw(ctx)`（`t`なし）、他4クラスは`draw(ctx, t = 0)`で`t`は未使用。
    *   図形の`draw`は倍率を受け取らない。`intersectsRect`・`hitTest`は塗り内部を判定しない。
    *   `toDrawElement()`：毎回新しいオブジェクト・頂点を作り内部配列を共有しない。値は`draw`と同じ式。呼び出し元は`SpriteSerializer`のみ。`Ellipse`の`closed: this.type === 'circle'`が種別による分岐。**`draw`の式を変えたら`toDrawElement`・`io/CodeExporter.js`の描画処理・`test/io/CodeExporter.test.js`を揃える。**
    *   `toJSON`/`fromJSON`：どちらの方向でも内部配列・頂点を共有しない。`fromJSON`は不正な入力で`Error`をthrowする。`id`は検証せずそのまま保持。余分なプロパティは無視。**各図形クラス・`ShapeFactory`は`try/catch`を持たない**（捕捉は`DocumentSerializer`の1箇所）。往復で図形データの内容と描画・当たり判定の結果は一致する。
    *   `fromJSON`の共通項目の検証は`ShapeDataValidation.validateShapeData`が行う（エラー文のクラス名・受理する種別・頂点数は各図形クラスが引数で渡す）。共通項目の規則を変える場合はこの関数を変え、`test/shapes/`の全クラスのエラー文のテストを確かめる。`Path.fromJSON`はパス固有の項目（`closed`・閉じたパスの頂点数・`segments`）を共通項目の後に`Path`側で検証する。`Curve`・`Rect`・`Ellipse`の`fromJSON`はコンストラクタで仮生成した後に頂点を`data`の値で設定し直す。
    *   **図形クラスは常に現行版の図形データのみを扱う**。旧版の知識は`DocumentSerializer`の`MIGRATIONS`に閉じる。図形データの形を変える場合は`MIGRATIONS`のJSDocの手順に従う。
    *   `Ellipse`：`type`（`'circle'`|`'arc'`）で振る舞いを分岐する。弧は画面の上半分（π〜2π）。`Path`：`points`・`closed`・`segments`で保持。`ShapeFactory.create`では作られない（読み込み専用。結合・描き足し・閉じるで`PathJoinRules`がコンストラクタで作る）。
*   **共通モジュール（`ShapeGeometry.js`・`ShapeDataValidation.js`）**：状態を持たない`export`した関数のみ（クラスにしない）。`import`するのは`shapes/`の図形クラスのみ。共通モジュールは`shapes/`の外および互いを`import`しない。幾何の計算と`fromJSON`の共通項目の検証を図形クラスへ複製しない。
*   **`PathJoinRules.js`**：図形をまたぐ規則（結合）。状態を持たない`export`した関数と定数のみ。読むのは図形の`type`・公開プロパティ`id`・`toJSON()`の図形データだけ（内部プロパティを読まない）。importは`./Path.js`のみ（結果は`Path`のコンストラクタで作る）。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。基準の線A＝重なり順で奥の図形で、結果の向き・色・太さはAのもの。描き足しは元のid・色・太さ・重なり順の位置を保つ。頂点の並べ方・まとめ方は非公開の組み立て関数が共有する（規則を変えると`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が同時に変わる）。使う側は`edit/PathJoiner`・`edit/EndpointSnapper`・`shapes/EndpointSnapRules`。
*   **`ShapeFactory.js`**：図形種別一覧の正本（対応表`SHAPE_REGISTRY`）と生成・復元の振り分け。対応表の表引きのみでif/switch分岐を持たない。`try/catch`を持たない。`path`は`create: null`（読み込み専用）。
*   **`DocumentSerializer.js`**：作業データ形式（`{ format: "oz-vector-editor", version, shapes }`）のシリアライズ・デシリアライズと旧版からのマイグレーションを担う静的メソッドのみのクラス。importは`ShapeFactory`のみ。図形種別の分岐・図形固有のプロパティ名を知らない（図形単位の変換は委譲）。デシリアライズ系は例外をthrowせず結果オブジェクト（`ok`・`shapes`・`skipped`・`error`）を返す。図形単位の`try/catch`はここ1箇所。引数のオブジェクトは書き換えない。**マイグレーション関数は引数を書き換えない**（旧版の入力は呼び出し元の作業データそのものが渡るため）。変換不能時はthrowしてよい（全体失敗）。現行版の入力はマイグレーションを通らず、コピーもせずそのまま読む。**版を上げるときは`test/io/`へマイグレーションのテストを追加する**。
    *   ※「`DocumentSerializer`は図形固有のプロパティ名を知らない」に対し、版1→版2の移行関数は`fillColor`の名前を知る。旧版の知識を`MIGRATIONS`に閉じる設計のとおりで、マイグレーション表の中に限る（開発資料の更新予定に記載）。
*   **`SpriteSerializer.js`**：スプライトデータ形式の定義（識別子・版・`DEFAULT_STROKE_WIDTH`）と、図形一式からの組み立て（描画要素・外枠・`source`）・JSON文字列化を担う静的メソッドのみのクラス。各図形の`toDrawElement()`をポリモーフィックに呼ぶだけで図形種別の分岐を持たない。知っているのは描画要素の`kind`の語彙と形の項目名。importは`DocumentSerializer`のみ。`DEFAULT_STROKE_WIDTH`の唯一の定義箇所（`io/`内）。書き出し形式の版（`formatVersion`）の唯一の定義箇所。`checkFormat`は1以上・現行版以下を`'supported'`とする。
*   **`CodeExporter.js`**：スプライトJSのテキストの組み立て（スプライトデータと共通の描画処理`draw`・`drawElement`の埋め込み）と実行しない取り出し。importは`SpriteSerializer`のみ。知っているのは描画要素の`kind`ごとの描き方（埋め込む固定のテキストの中）。エディタの描画との一致は`test/io/CodeExporter.test.js`の描画命令の記録の比較で検証する。**図形の`draw`・`toDrawElement`・埋め込む描画処理のどれかを変えたら残りとテストを揃える。** `draw(ctx)`：`ctx.save()` → `try { lineCap='butt' → lineJoin='miter' → miterLimit=10 → setLineDash([]) → 各要素 } finally { ctx.restore() }`。
*   **`FileContentReader.js`**（変更しない）：開く・インポートの読み込みの唯一の入口。スプライトのJSは`source`だけを`DocumentSerializer.deserialize`へ渡す（`elements`・`bounds`は読まない）。受け付ける書き出し形式の版は`SpriteSerializer.checkFormat`に任せる。
*   **書き出し形式の版の規則**：書き出し形式の版は、エンジンが読む部分（`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったとき（古い読み手が未知の項目として無視すると正しく描けなくなる場合を含む）に上げる。作業データの版（`source.version`）は`MIGRATIONS`へ関数を足すときに上げる。エンジンとの約束(c)：書き出し形式の版を上げるときはエンジンへ連絡票を出す（Phase 06-05）。
*   **`test/`**：`node:test`・`node:assert/strict`のみ。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc（`@param`・`@returns`）。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止。図形の`id`は公開プロパティ`id`へ文字列を直接代入して設定する。補助関数は各テストファイルの中に書く（共有の補助モジュールを置かない）。実行はプロジェクトのルートで`node --test`（引数なし）、結果の`tests`・`pass`・`fail`の件数を見る。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映はタスク14で行う。各タスクで判明した追加は末尾へ追記する）
*   **`PROJECT_ARCHITECTURE.md` 1章**
    *   フォルダ構造の`test/io/`に`DocumentSerializer.migration.test.js`を足す。
    *   「存在しないもの」の「塗りつぶし」を、まだ無いものの記述（画面から線・塗りを変える操作（プロパティパネル）、塗った内側のクリックでの選択、弧・曲線・直線・開いたパスの塗り、透明度・グラデーション）へ改める（「カラーピッカー」はそのまま）。
*   **`PROJECT_ARCHITECTURE.md` 2章**
    *   「図形（Shape）」：共通プロパティに`fillColor`を足す（`strokeColor`は`null`＝線なしを含む）。「塗りつぶしの共通プロパティは未定義」を、塗れる形（`rect`・`circle`・閉じた`path`。`isFillable()`が返す・データに保存しない）と「`fillColor`は塗れない形でも保持し、塗れる形のときだけ描く」（DIR Phase 06の決定。後続のPhaseでパスを開く・閉じる等をしても塗りが壊れないため）へ改める。
    *   「図形データ」：`{ type, id, points, strokeColor, strokeWidth, fillColor }`、`path`のキー順、`strokeColor`＝文字列または`null`（線なし）、`fillColor`＝文字列または`null`（塗りなし。キーが無ければ`null`として読む）、`strokeWidth`が無ければ2pxとして読む（既定値の`shapes/`内の定義は`ShapeDataValidation.js`。`SpriteSerializer`の`DEFAULT_STROKE_WIDTH`と同じ値であるべき別の定義）。
    *   「作業データ形式」：現行版2。版1→版2の移行（全図形の`fillColor`を`null`にする。プレーンオブジェクトでない要素はそのまま残し後の図形単位の検証でスキップ）。版2の作業データは古いエディタでは「対応していない版」として全体が断られる（DIRの決定。版を上げた理由：上げないと`strokeColor: null`の図形が古いエディタで黙って捨てられるため）。
    *   「スプライト（書き出し形式）」：版2（版の表記をすべて改める）。描画要素の共通のキーに`fillColor`（最後。塗れる形なら図形の`fillColor`、塗れない形なら`null`）、各`kind`のキー列。描き方の順序（形のパス → 塗り`fillStyle`→`fill()`（nonzero）→ 線`strokeStyle`→`lineWidth`→`stroke()`）。読む側の規則（塗るのは`fillColor`が文字列で`polyline`/`ellipse`かつ`closed === true`の要素だけ・`quadratic`は塗らない・塗りも線もない要素はパスも組み立てない。「版1は線のみのため結果として何も呼ばれない」等の文面を改める）。外枠（線を描かない要素は線の太さの半分を広げない）。`draw(ctx)`の明示設定に塗りの分は足さない理由。
*   **`PROJECT_ARCHITECTURE.md` 3章**
    *   11.「発注者の決定」の「結果の向き・色・太さはAのもの」・12.の「描き足しの規則：元のid・色・太さ…を保つ」に塗り（`fillColor`）を足す（DIRの決定「結合・描き足しの色」）。
*   **`_doc/arch/10_ShapeFactory.md`**
    *   「図形種別の追加手順」の①「13メソッド契約を満たす」→「14メソッド契約を満たす」。
*   **`_doc/arch/12_shapes.md`**
    *   「13メソッド契約」→「14メソッド契約」（`isFillable()`を足す。各クラスの値。Phase 06-02・06-03で外から使う予定）。「新規図形を追加する際」の記述も14メソッドへ。
    *   `draw`の描き方の共通の順序（塗るか＝`isFillable()`かつ`fillColor`が文字列、線を描くか＝`strokeColor`が文字列、どちらも偽なら何も呼ばない）と、`DRAW_SOURCE`と揃えること。
    *   `toDrawElement()`の`fillColor`（塗れない形は`null`）。
    *   共通モジュール：`validateShapeData`が検証に加えて既定値を解決した`{ strokeColor, strokeWidth, fillColor }`を返すこと、検査の順序に`fillColor`、`strokeWidth`が無ければ2px（`DEFAULT_STROKE_WIDTH`の`shapes/`内の唯一の定義、`io/`の同名の定数と同じ値であるべき別の定義）。
    *   `toJSON`/`fromJSON`の「`strokeWidth`の0以下も不正」に「キーが無い場合は2px」を足す。
    *   `Ellipse`：`isFillable`も`type`で分岐する（円は真・弧は偽）。
    *   `PathJoinRules`：結果の塗りは基準の線A（描き足し・閉じるは元の線）のもの。
*   **`_doc/arch/15_io.md`**
    *   `DocumentSerializer`：現行版2、`MIGRATIONS`の版1→版2（`migrateVersion1To2`）。「図形固有のプロパティ名を知らない」の例外として、マイグレーション表の中だけは旧版の変換のためにプロパティ名（`fillColor`）を知ること。
    *   `SpriteSerializer`：外枠の計算で`strokeColor`が文字列かを見ること（知っている項目名に`strokeColor`を足す）。
    *   `CodeExporter`：`DRAW_SOURCE`が塗りの規則を持つこと。
*   **`_doc/arch/16_test.md`**
    *   「既存のテストファイルと検証範囲」：`test/shapes/`各クラス（塗れる形か・偽の`ctx`による描画命令・`fillColor`の受理と不正・`strokeColor: null`の受理・`strokeWidth`のキーなし→2・`toJSON`/`toDrawElement`の`fillColor`とキー順）、`PathJoinRules.test.js`（結果の塗り）、`DocumentSerializer.roundtrip.test.js`（塗り・線なしの往復、版2）、新設`DocumentSerializer.migration.test.js`（版1→版2）、`SpriteSerializer.test.js`（描画要素の`fillColor`・線なしの外枠・版2）、`CodeExporter.test.js`（塗り・線なしの一致、塗りの読む側の規則）、`FileContentReader.test.js`（版2のJSの塗り・線なしの復元、版1のJS）。
    *   「版を上げるとき」：現在は版2で`MIGRATIONS`に版1→版2があり、移行は`test/io/DocumentSerializer.migration.test.js`で確かめていること。未定義・throw・オブジェクト以外を返す場合の全体失敗の経路は引き続きテストしていない（`MIGRATIONS`が非公開のため）。
    *   `test/shapes/Line.test.js`等の4クラスにも偽の`ctx`による描画命令のテストがあること（「テストできない箇所」の`draw`の記述と整合させる）。

## 3. タスクリスト
**全タスク共通の作業**（各タスクで必ず行う）
*   変更・追加したメソッド・関数・定数・プロパティにJSDoc（`@param`・`@returns`・`@throws`・型）を書き、既存のJSDocの記述（形・キー順・版・契約の列挙）を新しい内容へ改める。新しいテストの補助関数にもJSDocを書く。テストファイルの先頭行の責務の記述は、検証範囲が広がった場合に3行以内で改める。
*   タスクの完了時にプロジェクトのルートで`node --test`を実行し、`fail 0`であることと`tests`・`pass`・`fail`の件数を「4. 詳細作業内容」に記録する（着手前の件数：tests 646・pass 646・fail 0）。
*   書き換えた既存のテストケースは、テストファイル・ケース名・理由を「4. 詳細作業内容」に列挙する。指示された以外の既存のケースは書き換えない。
*   開発資料の記載に影響があれば、資料本体は直さず「開発資料の更新予定」へ追記する。迷った点・目視確認を推奨する点・将来の注意は「5. 懸念事項」へ追記する。
*   完了後、本RESの該当タスクを`[x]`にし、「4. 詳細作業内容」を記入する。

*   [x] タスク1: 共通項目の検証の変更（`strokeColor: null`の受理・`strokeWidth`のキーなし→2・`fillColor`の検証と戻り値）
    *   **対象ファイル** :
        *   `./js/shapes/ShapeDataValidation.js` : 更新
        *   `./test/shapes/Line.test.js`・`Curve.test.js`・`Rect.test.js`・`Ellipse.test.js`・`Path.test.js` : 更新（共通項目の規則のケースのみ）
    *   **作業内容** :
        *   2章 要件1「検証」のとおり`validateShapeData`を変える：`strokeColor`は文字列または`null`、`strokeWidth`は`undefined`なら`DEFAULT_STROKE_WIDTH`（2）、その後に`fillColor`の検査（`undefined`→`null`、文字列・`null`以外は不正）。エラー文は要件1の全文。戻り値`{ strokeColor, strokeWidth, fillColor }`（typedef`ShapeStyle`）を返す。`data`を書き換えない。
        *   非公開の定数`DEFAULT_STROKE_WIDTH = 2`を定義し、要件1の内容のJSDocを書く。ファイル先頭の責務定義を要件1のとおり改める（3行以内）。`validateShapeData`のJSDoc（検査の順序・`@returns`・`@throws`）を改める。
        *   本タスクでは図形クラスを変えない（`fromJSON`が戻り値を使うのはタスク2〜6。`strokeWidth`が無い場合は本タスクの時点ではコンストラクタの既定値で2になる）。
        *   テスト（5ファイル。`ShapeDataValidation`は図形クラスのテストを通して確かめる決まりのため）：
            *   書き換え（`Line`・`Curve`・`Rect`・`Ellipse`の各ファイル）：「strokeColorが文字列でなければ拒否する」（エラー文を新しい文面へ）、「strokeWidthが正の有限の数値でなければ拒否する」（キーなしを拒否する部分を外し、不正な値に`null`を足す）、「検査の順序：種別 → 頂点数 → 頂点（小さい番号が先）→ strokeColor → strokeWidth」（`strokeColor`のエラー文を新しい文面へ）。
            *   書き換え（`Path.test.js`）：「strokeColorが文字列でない」（エラー文）、「strokeWidthが0以下／有限でない」（不正な値の並びから`undefined`を外し`null`を足す）。
            *   追加（5ファイルとも）：`strokeColor: null`の図形データを受理し、`fromJSON`の結果の`toJSON().strokeColor`が`null`であること。`strokeWidth`のキーが無い図形データを受理し、`toJSON().strokeWidth`が`2`であること。
            *   `fillColor`のテストはタスク2〜6で足す。

*   [x] タスク2: `Line`の塗り（`fillColor`・`isFillable`・`draw`・`toJSON`・`toDrawElement`・`fromJSON`）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新
        *   `./test/shapes/Line.test.js` : 更新
        *   `./test/io/SpriteSerializer.test.js` : 更新（ケース「lineはpolyline（closed: false・2点）」のみ）
    *   **作業内容** :
        *   2章 要件2のとおり：コンストラクタに`fillColor = null`（最後）とプロパティ、`isFillable()`（常に`false`）、`draw`を共通の順序へ（`Line`は塗らないが、判定は`isFillable()`を使う。線を描かないなら何も呼ばない）、`toJSON`の最後に`fillColor`、`toDrawElement`の最後に`fillColor: this.isFillable() ? this.fillColor : null`、`fromJSON`は`validateShapeData`の戻り値を使う。
        *   JSDoc：クラスJSDocの契約を14メソッドへ、`isFillable`・`draw`・`toJSON`・`toDrawElement`・`fromJSON`（`@throws`）・コンストラクタの`@param`・プロパティの型、`LINE_POINT_COUNT`等の「バージョン1」の記述を改める。
        *   テスト（`Line.test.js`。偽の`ctx`の補助関数（`beginPath`・`moveTo`・`lineTo`・`closePath`・`fill`・`stroke`の呼び出しと`strokeStyle`・`lineWidth`・`fillStyle`の代入を記録）をファイル内に作る）：
            *   `isFillable()`が`false`。コンストラクタの既定の`fillColor`が`null`で、既存の引数の位置・既定値が変わらないこと。
            *   `draw`の記録：塗りなし線あり（従来と同じ命令列）、`fillColor`がある線あり（塗らない：`fillStyle`・`fill`が出ない）、`fillColor`がある線なし（何も呼ばない）、塗りも線もなし（何も呼ばない）。
            *   `fromJSON`：`fillColor`の受理（文字列・`null`・キーなし→`null`）、不正（数値・真偽値・オブジェクト・配列）でエラー文`Line.fromJSON: fillColorが文字列またはnullではありません`、検査の順序（`strokeWidth`の不正と`fillColor`の不正→`strokeWidth`、`strokeColor`の不正と`fillColor`の不正→`strokeColor`）。`strokeWidth`のキーなし→2（`fromJSON`が戻り値を使うことの確認）。
            *   `toJSON`のキー順（`['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor']`）と、`fillColor`を持つ直線の往復で`fillColor`が保持されること。`toDrawElement`のキー順（`['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']`）と、`fillColor`を持っていても`null`、`strokeColor: null`はそのまま`null`。
        *   書き換え（`test/io/SpriteSerializer.test.js`「lineはpolyline（closed: false・2点）」）：キー順と期待するオブジェクトに`fillColor: null`を足す（理由：描画要素のキー追加）。

*   [x] タスク3: `Curve`の塗り
    *   **対象ファイル** :
        *   `./js/shapes/Curve.js` : 更新
        *   `./test/shapes/Curve.test.js` : 更新
        *   `./test/io/SpriteSerializer.test.js` : 更新（ケース「curveはquadratic（3点）」のみ）
    *   **作業内容** :
        *   タスク2と同じ変更を`Curve`へ（`isFillable()`は常に`false`。`draw`のパスは従来の`beginPath`→`moveTo`→`quadraticCurveTo`）。JSDocも同様に改める。
        *   テスト（`Curve.test.js`。偽の`ctx`は`quadraticCurveTo`も記録する）：タスク2と同じ観点（`isFillable`が`false`、`draw`の4パターン、`fromJSON`の`fillColor`の受理・不正・順序・`strokeWidth`キーなし→2、`toJSON`のキー順と`fillColor`の保持、`toDrawElement`のキー順`['kind', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor']`と`fillColor: null`）。エラー文は`Curve.fromJSON: fillColorが文字列またはnullではありません`。
        *   書き換え（`test/io/SpriteSerializer.test.js`「curveはquadratic（3点）」）：キー順に`fillColor`を足す（理由：描画要素のキー追加）。

*   [ ] タスク4: `Rect`の塗り
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新
        *   `./test/shapes/Rect.test.js` : 更新
    *   **作業内容** :
        *   タスク2と同じ変更を`Rect`へ（`isFillable()`は常に`true`。`draw`のパスは従来の`beginPath`→`moveTo`→`lineTo`×3→`closePath`）。JSDocも同様に改める。
        *   テスト（`Rect.test.js`。`beginPath`・`moveTo`・`lineTo`・`closePath`・`fill`・`stroke`の呼び出しと`fillStyle`・`strokeStyle`・`lineWidth`の代入を記録する偽の`ctx`の補助関数をファイル内に作る）：`isFillable`が`true`。`draw`の記録：塗りあり線あり（パス→`fillStyle`→`fill()`（引数なし）→`strokeStyle`→`lineWidth`→`stroke()`）、塗りあり線なし（パス→`fillStyle`→`fill()`のみ）、塗りなし線あり（従来と同じ）、塗りも線もなし（何も呼ばない）。`fromJSON`の`fillColor`の受理・不正（`Rect.fromJSON: fillColorが文字列またはnullではありません`）・順序・`strokeWidth`キーなし→2。`toJSON`のキー順、`toDrawElement`のキー順（`polyline`）と`fillColor`が図形の値であること。
        *   `test/io/SpriteSerializer.test.js`の`rect`のケースはキー順を見ていないため書き換えない。

*   [ ] タスク5: `Ellipse`（円・弧）の塗り
    *   **対象ファイル** :
        *   `./js/shapes/Ellipse.js` : 更新
        *   `./test/shapes/Ellipse.test.js` : 更新
        *   `./test/io/SpriteSerializer.test.js` : 更新（ケース「circleはellipse（0〜2π・closed: true）」のみ）
    *   **作業内容** :
        *   タスク2と同じ変更を`Ellipse`へ。`isFillable()`は`this.type === 'circle'`。`draw`のパスは従来の`beginPath`→`ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)`→円なら`closePath`。`toDrawElement`の`closed`は従来どおり`this.type === 'circle'`、`fillColor`は`this.isFillable() ? this.fillColor : null`。コンストラクタは`shapeType`の後の`strokeColor`・`strokeWidth`の後に`fillColor = null`。`ELLIPSE_TYPES`のJSDocの「種別で分岐する全箇所」に`isFillable`を足す。JSDocも同様に改める。
        *   テスト（`Ellipse.test.js`。偽の`ctx`は`ellipse`も記録する）：円は`isFillable`が`true`・弧は`false`。円の`draw`の4パターン（タスク4と同じ）、弧に`fillColor`がある場合（線ありなら塗らずに線だけ、線なしなら何も呼ばない）。`fromJSON`（円・弧）の`fillColor`の受理・不正（`Ellipse.fromJSON: fillColorが文字列またはnullではありません`）・順序・`strokeWidth`キーなし→2。`toJSON`のキー順、`toDrawElement`のキー順（`ellipse`の12キー）と`fillColor`（円は図形の値・弧は`null`）。
        *   書き換え（`test/io/SpriteSerializer.test.js`「circleはellipse（0〜2π・closed: true）」）：キー順に`fillColor`を足す（理由：描画要素のキー追加）。

*   [ ] タスク6: `Path`の塗り
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` : 更新
        *   `./test/shapes/Path.test.js` : 更新
        *   `./test/io/SpriteSerializer.test.js` : 更新（ケース「開いたパスはpolyline（closed: false・segmentsなし・キー順）」のみ）
    *   **作業内容** :
        *   タスク2と同じ変更を`Path`へ。`isFillable()`は`this.closed === true`。`draw`は`#tracePath(ctx)`でパスを組み立てる（`drawHover`は変えない）。`fromJSON`は共通の検証の戻り値を受け取り、パス固有の検査の後に`new Path(data.points, data.closed, style.strokeColor, style.strokeWidth, style.fillColor)`。JSDocも同様に改める（`@throws`の`strokeColor`・`fillColor`の条件を含む）。
        *   テスト（`Path.test.js`。既存の`makeRecordingCtx`を使う）：閉じたパスは`isFillable`が`true`・開いたパスは`false`。閉じたパスの`draw`の4パターン（塗りは`fill()`を引数なしで呼ぶ。自分自身と交差する閉じたパス（例：(0,0)→(100,100)→(100,0)→(0,100)）も同じ命令列で`fill()`を引数なしで呼ぶ）、開いたパスに`fillColor`がある場合（塗らない／線なしなら何も呼ばない）。`fromJSON`の`fillColor`の受理・不正（`Path.fromJSON: fillColorが文字列またはnullではありません`）、検査の順序（`fillColor`の不正と`closed`の不正→`fillColor`、`strokeWidth`の不正と`fillColor`の不正→`strokeWidth`）、`strokeWidth`キーなし→2。`toDrawElement`の`fillColor`（閉じたパスは図形の値・開いたパスは`null`）。
        *   書き換え（`Path.test.js`）：「toJSONのキー順と中身（開いたパス）」（キー順と期待するオブジェクトに`fillColor: null`を足す）、「toDrawElementの中身とキー順（開いたパス）」（同）。理由：図形データ・描画要素のキー追加。「コンストラクタの既定値とidの初期値」は書き換えず、既定の`fillColor`が`null`であること・既存の引数の位置と既定値が変わらないことは新しいケースで確かめる。
        *   書き換え（`test/io/SpriteSerializer.test.js`「開いたパスはpolyline（closed: false・segmentsなし・キー順）」）：キー順と期待するオブジェクトに`fillColor: null`を足す（理由：描画要素のキー追加）。

*   [ ] タスク7: 結合・描き足し・閉じるの塗りの引き継ぎ
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新
        *   `./test/shapes/PathJoinRules.test.js` : 更新
    *   **作業内容** :
        *   2章 要件3のとおり、`buildClosedPath`と`assembleOpenPath`の`new Path(...)`に`fillColor`を渡す。`assembleOpenPath`の`dataA`の型の記述、`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`・`buildClosedPath`のJSDocの「色と太さ」を「色・太さ・塗り」へ改める。関数の追加・規則の変更はしない。
        *   テスト（追加のみ）：`buildJoinedPath`（Aの`fillColor`を結果が持つ。Bだけが`fillColor`を持つ場合は結果が`null`。直線Aの`fillColor`も引き継ぐ）、`buildClosedPath`（元の`fillColor`を保ち、結果の`isFillable()`が`true`、`toDrawElement().fillColor`が元の値）、`buildJoinedPathAt`、`buildExtendedPath`（元の線の`fillColor`）、`planJoin`（`'close'`・`'join'`）、`planDrawnLineJoin`（描き足し・閉じる・結合）、`planEndpointDragJoin`（閉じる・結合）の結果の`fillColor`が基準の線A（元の線）のもの。

*   [ ] タスク8: 作業データの版2と版1→版2の移行
    *   **対象ファイル** :
        *   `./js/io/DocumentSerializer.js` : 更新
        *   `./test/io/DocumentSerializer.migration.test.js` : 新規
        *   `./test/io/SpriteSerializer.test.js` : 更新（`source.version`が`1`のケース2つのみ）
    *   **作業内容** :
        *   2章 要件1「作業データの版2」のとおり：`CURRENT_DOCUMENT_VERSION = 2`、`migrateVersion1To2`（JSDoc：引数・戻り値・引数を書き換えないこと・`fillColor`を`null`にする理由・プレーンオブジェクトでない要素と配列でない`shapes`の扱い）、`MIGRATIONS = Object.freeze({ 1: migrateVersion1To2 })`。`MIGRATIONS`のJSDoc・typedef`DocumentData`を改める。`deserialize`の処理は変えない。
        *   新設テスト`test/io/DocumentSerializer.migration.test.js`（先頭行に責務のJSDoc。補助関数はファイル内）：
            *   版1の作業データ（`fillColor`を持たない5種＋開いた／閉じたパス）がオブジェクト層・文字列層とも全図形`fillColor: null`で読め、他の項目（`points`・`closed`・`segments`・`strokeColor`・`strokeWidth`・`id`）が元のとおりであること。
            *   版1で要素が`fillColor`（文字列）を持っていても`null`になること。
            *   版1で`strokeWidth`の無い図形が2pxで読めること。
            *   版1の`shapes`のプレーンオブジェクトでない要素（`null`・数値・配列・文字列）がスキップされ（`index`・`type: null`）、残りが読めること。警告の回数。
            *   版1で`shapes`が配列でない場合は全体失敗（`shapesが配列ではありません`）・警告1回。
            *   移行が引数を書き換えないこと（`fillColor`を持つ要素・持たない要素・プレーンオブジェクトでない要素を含む版1の作業データを`structuredClone`等で控え、`deserialize`後に`deepStrictEqual`）。
            *   現行版（版2）の作業データの`fillColor`（文字列）は移行されずそのまま読めること、`serialize`の`version`が`2`であること。
        *   書き換え（`test/io/SpriteSerializer.test.js`）：「キーの順と識別子・版を持ち、最上位にversionを持たない」の`data.source.version`の期待値を`2`へ、「図形0個は elements: []・bounds: null・sourceは図形0個の作業データ」の`source`の`version`を`2`へ（理由：作業データの版の変更）。

*   [ ] タスク9: 書き出し形式の版2と外枠
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` : 更新
        *   `./test/io/SpriteSerializer.test.js` : 更新
    *   **作業内容** :
        *   2章 要件4のとおり：`SPRITE_FORMAT_VERSION = 2`、typedef`DrawElement`（`fillColor`・`strokeColor`の`null`）・`SpriteData`（版）の記述、`#computeBounds`で`strokeColor`が文字列でない要素は線の太さの半分を広げない（JSDocも改める）。`checkFormat`は変えない。
        *   書き換え：「キーの順と識別子・版を持ち、最上位にversionを持たない」の`formatVersion`の期待値を`2`へ（理由：書き出し形式の版の変更）。
        *   追加：描画要素の`fillColor`（塗れる形：`rect`・`circle`・閉じたパスは図形の値／塗れない形：`line`・`curve`・`arc`・開いたパスは`fillColor`を持っていても`null`）と、`source`の図形データには塗れない形の`fillColor`も残ること。外枠：`strokeColor: null`の直線・矩形・円・曲線・弧・パスは形の範囲のまま（広げない）、線ありは従来どおり広げる、線なしと線ありの混在の和、線なしで塗れない要素も外枠に含まれること。`checkFormat`が`formatVersion: 1`を`supported`とすること（版1のJSを読める根拠）。

*   [ ] タスク10: 書き出したJSの描画処理（`DRAW_SOURCE`）の塗り
    *   **対象ファイル** :
        *   `./js/io/CodeExporter.js` : 更新
        *   `./test/io/CodeExporter.test.js` : 更新
    *   **作業内容** :
        *   2章 要件4の`drawElement`の形へ`DRAW_SOURCE`を書き直す（形の項目の確認とパスの組み立て・線の太さの式は従来のまま）。埋め込むテキスト内の`drawElement`の説明コメントと`DRAW_SOURCE`のJSDocを改める。`DRAW_SOURCE`のJSDocの「保守上の注意」にある古いRESの節番号への参照（「RES 2章要件3・要件7」）は、開発資料（`PROJECT_ARCHITECTURE.md` 2章「スプライト（書き出し形式）」）への参照に改める。`draw`・`HEADER_COMMENT`・`toModuleText`・`extractSpriteDataText`は変えない。
        *   テスト：
            *   書き換え：補助関数`createRecordingCtx`に`fill`の呼び出しと`fillStyle`の代入の記録を足す（理由：塗りの描画命令を記録するため。既存のケースの期待値は変わらない）。
            *   追加（エディタの描画との一致。全6種＝5クラス）：塗りあり線あり（`rect`・`circle`・閉じたパス）、塗りのみ線なし（同）、塗りも線もなし（全6種。記録は前置きと`restore`のみ）、塗れない形に`fillColor`がある（`line`・`curve`・`arc`・開いたパス。線ありと線なし）、自分自身と交差する閉じたパスの塗り、塗り・線なしと従来の図形の混在（描画順）。
            *   追加（読む側の規則。手で組み立てた描画要素）：`fillColor`が文字列でない（数値・`null`・キーなし）要素は塗らない、`closed`が`true`でない（`false`・キーなし・`'true'`）`polyline`/`ellipse`は塗らない、`quadratic`は`fillColor`が文字列でも塗らない、線なしで塗りだけの`polyline`/`ellipse`は塗る（パス→`fillStyle`→`fill()`で`stroke`なし）、塗りも線もない要素は何も呼ばない、形の項目が足りない要素・未知の`kind`は`fillColor`があっても何も呼ばない。

*   [ ] タスク11: 作業データの往復のテスト（塗り・線なし）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` : 更新
    *   **作業内容** :
        *   追加のみ（既存のケース・補助関数は変えない）：塗り・線なしを含む図形（塗りあり線ありの矩形、塗りのみ線なしの円・閉じたパス、自分自身と交差する閉じたパスの塗り、`fillColor`を持つ直線・曲線・弧・開いたパス（塗れない形）、線なしで塗りなしの直線）が、オブジェクト層・文字列層の両方の往復で`fillColor`・`strokeColor`まで元どおりに戻ること（既存の`assertRestoredWithPaths`に加え、各図形の`fillColor`・`strokeColor`を明示的に比べる）。`serialize`の`version`が`2`であること。

*   [ ] タスク12: スプライトJSの読み込みのテスト（塗り・線なし、版1のJS）
    *   **対象ファイル** :
        *   `./test/io/FileContentReader.test.js` : 更新
    *   **作業内容** :
        *   追加のみ：塗り・線なしを含むキャンバス（塗れない形の`fillColor`を含む）を`SpriteSerializer.serialize`→`CodeExporter.toModuleText`で書き出したJS（版2）を`deserializeFromText`で読み、`ok`・スキップなしで`fillColor`・`strokeColor`を含む`toJSON()`が元どおりに戻ること（`CRLF`のJSも）。版1の書き出し形式のJS（書き出したデータの`formatVersion`を`1`、`source.version`を`1`にし、`source.shapes`の各要素から`fillColor`を除いたもの、および`fillColor`を残したもの）が読め、全図形が`fillColor: null`になること。

*   [ ] タスク13: JSDocの記載漏れの確認と`ShapeFactory`のJSDoc
    *   **対象ファイル** :
        *   `./js/core/ShapeFactory.js` : 更新（JSDocのみ）
        *   タスク1〜12で変更したファイル : 確認（記載漏れがあれば該当ファイルのJSDocのみ修正）
    *   **作業内容** :
        *   `ShapeFactory.fromJSON`の`@param`の図形データの形を`{ type, id, points, strokeColor, strokeWidth, fillColor }`（`path`は`closed`・`segments`も持つ）へ改める。コードは変えない。
        *   変更したメソッド・関数・定数のJSDoc（`@param`・`@returns`・`@throws`）、5クラスのクラスJSDocの契約の列挙（14メソッド・`isFillable`を含む）、図形データ・描画要素の形の記述（キー順・`fillColor`・`strokeColor`の`null`・版）が実コードと一致することを確かめる。「13メソッド」「バージョン1」「版1」等の古い記述が残っていないか`Grep`で確かめる（`js/`内。`check/`・`edit/`等の変更対象外のファイルに残る記述は直さず5章に記録する）。

*   [ ] タスク14: 開発資料への反映（最終タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・2章・3章）
        *   `./_doc/arch/10_ShapeFactory.md` : 更新（「図形種別の追加手順」の①のみ）
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/15_io.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   2章「開発資料の更新予定」（各タスクで追記された内容を含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準（残す：責務・境界・保存形式・設計判断の理由・やらないと決めたこと・未実装のもの・公開メソッド名の一覧／書かない：1ファイルのJSDocで分かること）に従って反映する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本タスクのみREQにより明示的な例外とする（後続タスクが無く、他タスクの前提が動かないため）。個別の実装タスク内では資料を書き換えない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 共通項目の検証の変更
*   **作業内容** :
    *   `js/shapes/ShapeDataValidation.js`：`strokeColor`は文字列または`null`を受理（エラー文を「文字列またはnullではありません」へ）、`strokeWidth`は`undefined`なら非公開定数`DEFAULT_STROKE_WIDTH = 2`、`fillColor`の検査を最後に追加（`undefined`→`null`、文字列・`null`以外は不正）、戻り値`{ strokeColor, strokeWidth, fillColor }`（typedef`ShapeStyle`）を返す。`data`は書き換えない。先頭の責務定義・JSDocを改めた。図形クラスは未変更。
    *   テスト：`Line`・`Curve`・`Rect`・`Ellipse`・`Path`の各テストに「`strokeColor: null`を受理」「`strokeWidth`キーなし→2」を追加。
    *   `node --test`：tests 656・pass 656・fail 0。
*   **書き換えた既存ケース** :
    *   `Line/Curve/Rect/Ellipse.test.js`：「strokeColorが文字列でなければ拒否する」（エラー文を新文面へ）、「strokeWidthが正の有限の数値でなければ拒否する」（キーなし拒否の部分を外し、不正値に`null`を追加）、「検査の順序…」（strokeColorのエラー文を新文面へ）。
    *   `Path.test.js`：「strokeColorが文字列でない」（エラー文）、「strokeWidthが0以下／有限でない」（`undefined`を外し`null`を追加）。

### タスク2: `Line`の塗り
*   **作業内容** :
    *   `js/shapes/Line.js`：コンストラクタ末尾に`fillColor = null`とプロパティ、`isFillable()`（常に`false`）、`draw`を共通の順序へ（`shouldFill`/`shouldStroke`の2行、どちらも偽なら`return`、パス→塗り→線）、`toJSON`末尾に`fillColor`、`toDrawElement`末尾に`fillColor: this.isFillable() ? this.fillColor : null`、`fromJSON`は`validateShapeData`の戻り値`style`を使用。クラスJSDocを14メソッドへ、`LINE_POINT_COUNT`の「バージョン1」を「現行版」へ、各JSDoc（`@param`・`@returns`・`@throws`・`strokeColor`の`string|null`）を改めた。
    *   `test/shapes/Line.test.js`：先頭の責務JSDocを改めた（当たり判定・`isFillable`・描画命令・図形データとの相互変換）。偽の`ctx`の補助関数`makeRecordingCtx`を追加。`isFillable`・コンストラクタの既定値、`draw`の4パターン、`fromJSON`の`fillColor`（受理・不正・検査の順序・`strokeWidth`キーなし→2）、`toJSON`/`toDrawElement`のキー順と`fillColor`を追加。
    *   `node --test`：tests 670・pass 670・fail 0。
*   **書き換えた既存ケース** :
    *   `test/io/SpriteSerializer.test.js`「lineはpolyline（closed: false・2点）」：キー順と期待するオブジェクトに`fillColor: null`を足した（理由：描画要素のキー追加）。

### タスク3: `Curve`の塗り
*   **作業内容** :
    *   `js/shapes/Curve.js`：コンストラクタ末尾に`fillColor = null`とプロパティ（`strokeColor`の型を`string|null`へ）、`isFillable()`（常に`false`）、`draw`を共通の順序へ（パスは従来の`beginPath`→`moveTo`→`quadraticCurveTo`）、`toJSON`末尾に`fillColor`、`toDrawElement`末尾に`fillColor: this.isFillable() ? this.fillColor : null`、`fromJSON`は`validateShapeData`の戻り値`style`を使用。クラスJSDocを14メソッドへ、`CURVE_POINT_COUNT`の「バージョン1」を「現行版」へ、各JSDoc（`@param`・`@returns`・`@throws`）を改めた。
    *   `test/shapes/Curve.test.js`：先頭の責務JSDocを改めた（当たり判定・`isFillable`・描画命令・図形データとの相互変換）。偽の`ctx`の補助関数`makeRecordingCtx`をファイル内に追加（`quadraticCurveTo`も記録）。`isFillable`・コンストラクタの既定値、`draw`の4パターン、`fromJSON`の`fillColor`（受理・不正・検査の順序・`strokeWidth`キーなし→2）、`toJSON`/`toDrawElement`のキー順と`fillColor`を追加。
    *   `node --test`：tests 684・pass 684・fail 0。
*   **書き換えた既存ケース** :
    *   `test/io/SpriteSerializer.test.js`「curveはquadratic（3点）」：キー順に`fillColor`を足した（理由：描画要素のキー追加）。

### タスク4: `Rect`の塗り
*   **作業内容** :
    *   (未着手)

### タスク5: `Ellipse`（円・弧）の塗り
*   **作業内容** :
    *   (未着手)

### タスク6: `Path`の塗り
*   **作業内容** :
    *   (未着手)

### タスク7: 結合・描き足し・閉じるの塗りの引き継ぎ
*   **作業内容** :
    *   (未着手)

### タスク8: 作業データの版2と版1→版2の移行
*   **作業内容** :
    *   (未着手)

### タスク9: 書き出し形式の版2と外枠
*   **作業内容** :
    *   (未着手)

### タスク10: 書き出したJSの描画処理（`DRAW_SOURCE`）の塗り
*   **作業内容** :
    *   (未着手)

### タスク11: 作業データの往復のテスト（塗り・線なし）
*   **作業内容** :
    *   (未着手)

### タスク12: スプライトJSの読み込みのテスト（塗り・線なし、版1のJS）
*   **作業内容** :
    *   (未着手)

### タスク13: JSDocの記載漏れの確認と`ShapeFactory`のJSDoc
*   **作業内容** :
    *   (未着手)

### タスク14: 開発資料への反映
*   **作業内容** :
    *   (未着手)

## 5. 懸念事項・要確認ポイント
### 計画時の判断・注意
* **スコープ外への波及**：`core/`（`ShapeFactory`のJSDocを除く）・`edit/`・`palette/`・`main.js`・`index.html`・`check/`の変更は不要と判断した（選択・移動・ハンドル・削除・複製/貼り付け・Undo/Redo・自動保存・`?dev`の復元は`toJSON`/`fromJSON`を通るため塗りも運ぶ。`CanvasManager`は図形の`draw`・`drawHover`・`drawHandles`を呼ぶだけ。確認用ページは書き出したJS自身の`draw`を呼ぶ）。`test/core/`・`test/edit/`・`test/check/`の既存のケースも、版・キー順を動的に参照しているか、塗りなしの図形だけを使うため書き換え不要の見込み（タスク実行時に失敗した場合は、そのケースのみ理由を記録して書き換える）。
* **1タスク＝1ファイルの例外**：タスク1は`ShapeDataValidation`を直接確かめる5つの図形クラスのテストを、タスク2・3・5・6・8は`test/io/SpriteSerializer.test.js`のキー順・版のケース（各1〜2ケース）を同じタスクで書き換える（各タスクの完了時に`node --test`が`fail 0`になるため）。
* **タスク1の過渡期**：タスク1の時点では図形クラスの`fromJSON`は`validateShapeData`の戻り値をまだ使わず、`strokeWidth`が無い図形はコンストラクタの既定値（2）で読み込まれる。タスク2〜6で戻り値を使うよう改める。
* **`validateShapeData`の戻り値**：検証の関数が既定値を解決した値を返すよう責務を広げる（ファイル先頭の責務定義も改める）。`data`を書き換えずに既定値を適用するためと、既定値の知識を図形クラスへ複製しないため。
* **2pxの定義が3種類ある**：`shapes/ShapeDataValidation.js`の`DEFAULT_STROKE_WIDTH`（読み込みの既定値）、`io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`（書き出し形式の読む側の既定値）、各図形クラスのコンストラクタの`strokeWidth = 2`（新しく描く図形の太さ。Phase 06-02で「直前に使った値」に置き換わる見込み）。前2つは同じ値であるべき（JSDocに記載）。
* **塗る/線を描くの判定の重複**：`draw`の先頭の2行（`shouldFill`・`shouldStroke`）は5クラスに同じ形で書く（`draw`は自律実装で、共通モジュールは幾何と検証に限るため）。塗れるかの規則そのものは`isFillable()`の1箇所。`DRAW_SOURCE`側の規則（`closed === true`かつ`polyline`/`ellipse`）は描画要素から判断する別の書き方で、一致テストで揃っていることを確かめる。
* **線なしで塗れない形の図形（見えない図形）**：データとして受理し、輪郭付近のクリック・範囲選択・ホバーの強調・ハンドルは従来どおり。画面上での扱いはPhase 06-02・06-03で決める。
* **版1の作業データの`strokeColor: null`**：版1では不正だったが、移行は`strokeColor`に触れないため、版1のファイルに`strokeColor: null`があれば版2の規則で線なしとして読まれる（エディタが書き出した版1のファイルには現れない値。許容と判断）。
* **`DocumentSerializer`と図形のプロパティ名**：版1→版2の移行関数は`fillColor`の名前を知る（旧版の知識は`MIGRATIONS`に閉じる設計のとおり）。開発資料の「図形固有のプロパティ名を知らない」に例外を書く（更新予定に記載）。
* **`_doc/COWORK_STATUS.md`**：DIRの持ち越し事項「完了時に同項目を2章から外す」は実装AIの作業範囲外（`_doc/`は資料の反映対象外）。現場設計AI側で行うこと。
* **`test/io/CodeExporter.assembly.test.js`**：触らないため、責務コメントの「P7のキャラ合成」は直さない。

### テストプレイで確認すべき項目（操作手順 → 期待する結果）
テストプレイ用の作業データファイルは現場設計AIが用意する（塗り・線なし・塗れない形の`fillColor`・自分自身と交差する閉じたパス・`strokeWidth`の無い図形・版1のファイルを含むもの）。

**塗り・線なしの表示**
1. `fillColor`に色を入れた矩形・円・閉じたパスを含む作業データファイルを「開く（ファイル）」で開く → それぞれの内側が指定の色で塗られ、線（`strokeColor`が文字列のもの）は塗りの上に重なって表示される。
2. 自分自身と交差する閉じたパス（例：5頂点を一筆で結んだ星形）に塗りを入れたファイルを開く → nonzeroの規則で塗られる（星形なら中央の五角形も塗られる）。
3. 同じファイルで、直線・曲線・弧・開いたパスに`fillColor`が入っている → 塗られない（線だけが表示される）。
4. `strokeColor`が`null`で`fillColor`がある矩形・円・閉じたパス → 線が描かれず、塗りだけが表示される。
5. `strokeColor`が`null`で塗れない形（直線等）・または塗りも無い図形 → 画面には何も描かれないが、輪郭付近をクリックすると選択でき（ハンドルが出る）、ホバーで強調が出る。範囲選択でも選べる。
6. 塗り・線なしの図形を選択して移動・ハンドルで変形・削除・複製（`Ctrl`+`D`）・コピー＆ペースト・Undo/Redo → 塗り・線なしが保たれたまま操作でき、Undo/Redoで元に戻る。ホバーの強調・ハンドルの表示は従来どおり。

**保存と読み込み**
7. 上のキャンバスを「出力（作業ファイル）」で保存し、そのファイルを「開く（ファイル）」で開き直す → 見た目が同じで、塗られていない図形（直線・曲線・弧・開いたパス）の`fillColor`もファイルの中に元の値のまま残っている。保存したファイルの`version`が`2`。
8. ページを再読み込みする（自動保存の復元） → 塗り・線なしが保たれている。
9. 版1の作業データファイル（これまでに保存したファイル）を開く → すべての図形が塗りなしとして読み込まれ、見た目はこれまでと変わらない。一部が読めない旨の通知は出ない。
10. `strokeWidth`の無い図形を含む作業データファイルを開く → その図形が線の太さ2pxで表示され、スキップされない（一部が読めない旨の通知が出ない）。
11. `?dev`の「JSONから復元」に塗り・線なしを含む作業データを入れて復元 → 塗り・線なしが表示される。

**結合・描き足し**
12. 奥に`fillColor`を持つ開いたパスA、手前に`fillColor`の無い直線Bを置いたファイルを開き、2本を選んで結合（`J`） → 結果のパスは開いたパスのため塗られない。結果を選んで閉じる（`J`） → Aの塗りが現れる。
13. 奥に`fillColor`の無い線、手前に`fillColor`を持つ線を結合 → 結果は塗りなし（閉じても塗られない）。
14. `fillColor`を持つ開いたパス（頂点4つ以上）の端点のハンドルをもう一方の端点へドラッグして閉じる → 塗りが現れる。
15. `fillColor`を持つ開いたパスの端点から直線を描き足す → 結果のパスが元の`fillColor`を持つ（その後閉じると塗りが現れる）。`fillColor`を持つ直線どうしを描いた直線でつないだ場合も、結果は奥の線の塗りを持つ。

**書き出し**
16. 塗り・線なしを含むキャンバスを「出力（エンジン用）」で書き出し、`sprite-check.html`で開く → エディタと同じ見た目（塗り・線なし・塗れない形は塗られない・自分自身と交差するパスのnonzero）で描かれる。外枠は、線なしの図形では形にぴったり、線ありの図形では線の太さの半分だけ外側になる。情報欄の書き出し形式の版が2、作業データの版が2。
17. 書き出したJSを開き、`elements`の塗れない形の要素の`fillColor`が`null`、`source`の同じ図形の`fillColor`は元の値であることを確かめる。
18. 書き出したJSをエディタの「開く（ファイル）」「インポート」で読み込む → 塗り・線なし・塗れない形の`fillColor`が戻る。
19. これまでに書き出した版1のJSを、エディタの「開く（ファイル）」と`sprite-check.html`で開く → どちらも読み込め、従来どおりの見た目（塗りなし）で表示される。

**既存の動作が変わらないこと**
20. 新しく直線・曲線・弧・矩形・円を描く → 従来どおり黒・2px・塗りなし。図形パレット・数字キーの並びは変わらない。
21. 既存の図形の選択・範囲選択・移動・ハンドル操作・削除・複製/コピー＆ペースト・Undo/Redo・結合・描き足し・端点への吸い付き・キャンバスの切り替え・自動保存・出力（作業ファイル・エンジン用）・開く・インポート → これまでと同じに動く。塗り・線なしを含まない図形の見た目・書き出したJSの見た目は変わらない。
