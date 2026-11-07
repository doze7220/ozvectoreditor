# RES: 作業計画・作業レポート (Phase 04-01) : 自動テストの導入
* 参照元REQ: `./_log/req/261107_2036_REQ_Phase04-01_Automated_Tests.md`

## 1. 作業目的
作業データ形式の変換（Phase 03-01）とファイル読み込み時の判定（Phase 03-05）を、ブラウザを開かずにコマンド1つ（プロジェクトのルートで`node --test`）で繰り返し確かめられるようにする。Node.js標準の`node:test`・`node:assert`だけで自動テストを導入し、既存の変換処理（`DocumentSerializer`・`ShapeFactory`・`shapes/`の4クラス）と読み込みの判定（`CanvasFileOperations`）のテストを書く。Phase 04-02以降で書き出し処理のテストを同じ規則で足せる形にする。

**エディタ本体のソースコード（`index.html`・`js/`配下）は一切変更しない。** 変更・新設するのは`test/`フォルダ内のファイルと、最終タスクの開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`の該当ファイル）のみ。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
```text
/oz-vector-editor/
├── index.html            （変更しない。test/を参照しない）
├── js/                   （変更しない。test/を参照しない）
└── test/                 （新設。Node.jsの node --test でのみ実行する）
    ├── io/
    │   ├── DocumentSerializer.roundtrip.test.js   … タスク1：5種の図形の往復
    │   └── DocumentSerializer.errors.test.js      … タスク2：全体の失敗・図形単位のスキップ・版の範囲・非破壊
    └── edit/
        └── CanvasFileOperations.test.js            … タスク3：開く（ファイル）・インポートの読み込みの判定
```
*   依存の向きは`test/ → js/`の一方向のみ。テストファイルは対象モジュールを相対パス（例：`../../js/io/DocumentSerializer.js`）で`import`する。`js/`・`index.html`から`test/`を`import`・参照しない。
*   テストファイル同士は`import`し合わない。共有の補助モジュールは作らない（理由は要件2）。

### 要件1: Node.jsの使い方の範囲
*   Node.jsは**テストの実行にのみ**使う。エディタ本体のビルド・変換・配信には使わない。エディタは従来どおり`index.html`をブラウザで直接開くだけで動く（手順は増えない）。
*   使うのは`node:test`（`describe`・`it`・`TestContext`の`t.mock`）と`node:assert/strict`のみ。npmパッケージ・外部ライブラリは導入しない。`node_modules`・`package-lock.json`は作らない。
*   **`package.json`は作らない。** 計画立案時に、作業用の一時フォルダ（プロジェクトの外）でNode.js v24.20.0により次を確認した（プロジェクト内にはファイルを作っていない）：
    *   `package.json`のない場所の`test/*.test.js`から、`js/io/DocumentSerializer.js`・`js/core/ShapeFactory.js`・`js/edit/CanvasFileOperations.js`を`import`でき、警告（`MODULE_TYPELESS_PACKAGE_JSON`等）が出ない。
    *   引数なしの`node --test`で`test/`配下（入れ子のフォルダを含む）のファイルが自動で見つかり、末尾に`ℹ tests N`・`ℹ pass N`・`ℹ fail 0`等の件数が表示される。
    *   `t.mock.method(console, 'warn', () => {})`はそのテストの終了時に自動で元へ戻る（次のテストで`console.warn`が元の関数に戻っていることを確認した。`async`のテストでも働く）。
    *   よって`package.json`（`"type": "module"`）は不要と判断した。
*   実行コマンドは、プロジェクトのルートで`node --test`（引数なし）の1つ。結果の表示はNode.js標準の出力のまま（独自の集計・レポーターを作らない）。

### 要件2: テストファイルの置き場所と書き方
*   **置き場所**：プロジェクトのルート直下の`test/`。中は`js/`のフォルダ構成に合わせる（`js/io/X.js`のテストは`test/io/`、`js/edit/Y.js`のテストは`test/edit/`）。Phase 04-02で書き出し処理（`js/io/`等）を足したら、同じ規則で`test/<js/からの相対フォルダ>/`へ置く。
*   **命名**：`<対象モジュール名>.test.js`。1つのモジュールのテストを観点で複数ファイルに分ける場合は`<対象モジュール名>.<観点>.test.js`（本作業の`DocumentSerializer.roundtrip.test.js`・`DocumentSerializer.errors.test.js`）。いずれも`node --test`が引数なしで見つける`*.test.js`に当たる。
*   **`test/`内の`.js`はすべてテストファイルとして実行される**：Node.jsの`node --test`（引数なし）は`*.test.js`等に加え、**`test/`という名前のフォルダの下にあるすべての`.js`**を実行対象にする（計画時に確認：`test/`下に置いた補助用の`.js`も1つのテストとして実行・計上された）。そのため、テストファイル間で共有する補助モジュールは作らず、補助関数は各テストファイルの中に書く。また、テスト以外の`.js`を`test/`以下に置かない。プロジェクト内の他の場所に`test.js`・`test-*.js`・`*_test.js`・`*-test.js`という名前のファイルを作らない（同じく実行対象になる）。
*   **ファイル先頭**：憲法3章に従い、最先頭行に単一責務のJSDoc（3行以内）を書く。補助関数（`silenceWarn`・偽物の生成関数・比較関数等）にはJSDoc（`@param`・`@returns`）を書く。テストケース本体（`it`のコールバック）はテスト名で内容を示し、JSDocは不要とする（関数宣言ではないため）。
*   **公開APIのみを通す**：テストが使うのは、`export`されている`DocumentSerializer`・`ShapeFactory`・`SHAPE_TYPES`・`Line`・`Curve`・`Rect`・`Ellipse`・`CanvasFileOperations`と、それらのpublicメソッド・JSDocに記載された公開プロパティ（`type`・`id`・`strokeColor`・`strokeWidth`・`Ellipse`の`startAngle`・`endAngle`）のみ。`#`付きのprivate項目・非公開の定数（`CURRENT_DOCUMENT_VERSION`・`MIGRATIONS`・`DOCUMENT_FORMAT`等）には触れない（触れられない）。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しを行わない。
*   **`id`の設定**：図形の`id`は通常`VectorModel`が採番するが、本作業のテストでは`VectorModel`を使わず、図形インスタンスの公開プロパティ`id`へ文字列（`'shape-1'`等）を直接代入する（JSDocに「`VectorModel`の採番・正規化の後は文字列」とある公開プロパティであり、`VectorModel`が行うのと同じ操作のため）。
*   **`console.warn`の抑止**：`DocumentSerializer`・`CanvasFileOperations`が出す`console.warn`は、各テストの冒頭で補助関数`silenceWarn(t)`（中身は`t.mock.method(console, 'warn', () => {})`。戻り値はモック）を呼んで抑止する。`t.mock`はそのテストの終了時に自動で元へ戻るため、`afterEach`での手動の復元は不要。`globalThis`・`console`への直接の代入は行わない。
    *   警告の回数は検証に使う（`DocumentSerializer.deserialize`のJSDoc「スキップ1件ごと、および全体の読み込み失敗時にconsole.warnを出す」の契約のため）：全体の失敗で1回、スキップ1件につき1回、正常な往復では0回。警告の**文言**は検証に使わない（契約ではないため）。
    *   `CanvasFileOperations`のテストでは警告の回数を検証しない（抑止のみ）。
*   **グローバル**：`globalThis`・`window`への代入や、DOMの模擬オブジェクトのグローバルへの設置を行わない。Node.jsの組み込み（`structuredClone`・`JSON`・`Math`）の読み取り・呼び出しのみ使う。

### 要件3: DOMへの依存の調査（計画時の調査結果）
対象モジュールの`import`と、テストで呼ぶメソッドの中身を読んで調べた。**テストの対象範囲ではDOM・ブラウザ専用のAPIに触れる箇所はなく、切り離しが必要な箇所はない。**

| モジュール | `import` | `import`した時点の処理 | テストで呼ぶメソッドが使うもの | DOM依存 |
| --- | --- | --- | --- | --- |
| `js/io/DocumentSerializer.js` | `../core/ShapeFactory.js`のみ | 定数の定義・`Object.freeze`のみ | `JSON.parse`/`JSON.stringify`・`Number.isInteger`・`Array.isArray`・`console.warn` | なし（ソース中の`document`は変数名`documentData`の一部） |
| `js/core/ShapeFactory.js` | `shapes/`の4ファイルのみ | 対応表の`Object.freeze`・`Map`の生成のみ | 表引きと各図形クラスの`fromJSON`への委譲 | なし |
| `js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js` | なし | 定数の定義のみ | コンストラクタ・`setVertex`・`translate`・`toJSON`・`static fromJSON`（`Math`・`Number.isFinite`のみ） | なし |
| `js/edit/CanvasFileOperations.js` | `../io/DocumentSerializer.js`のみ | なし | `openFile`・`importFile`・`getState`・コンストラクタ。`File`は不透明に扱い注入された`fileIO`へ渡すだけ。`Blob`・`File`のAPIは`DocumentFileIO`（注入）に閉じる | なし |

テスト対象外で、Node.jsに無いAPIに依存しているためNode.jsからそのままはテストできない箇所（本作業では切り離さず、5章に記録する。Node.js v24.20.0で`typeof`により存在を確認した：`File`・`Blob`・`URL.createObjectURL`・`URL.revokeObjectURL`・`setTimeout`は`function`、`document`・`indexedDB`・`CanvasRenderingContext2D`は`undefined`）：
*   `js/io/DocumentFileIO.js`：`downloadText`は`document`（`document.createElement`・`document.body`）に依存するためNode.jsでそのまま動かない（`Blob`・`URL.createObjectURL`・`URL.revokeObjectURL`・`setTimeout`はNode.jsにも存在する）。`readText`（`return file.text();`のみ。`File`はNode.jsにも存在する）・`getFileName`・`toFileName`・`toCanvasName`はNode.jsでも動き得るが、本作業の対象外。
*   `js/io/CanvasStorage.js`：`indexedDB`に依存する（Node.jsには`indexedDB`が無い）。
*   `shapes/`の`draw`・`drawHandles`・`drawHover`：引数に`CanvasRenderingContext2D`が要る（Node.jsには`CanvasRenderingContext2D`が無い。描画のテストはNon-goal）。
*   `CanvasLibrary`・`ShapeInserter`・`ClipboardController`・`SnapshotAdapter`・`VectorModel`等：本作業の対象外（調査していない）。

### 要件4: 5種の図形の往復テスト（タスク1）
*   **比較方法**（補助関数`assertSameShape(actual, expected)`）：
    1.  `actual !== expected`（別のインスタンスであること）。
    2.  `actual.constructor === expected.constructor`（同じ図形クラス）。
    3.  `assert.deepStrictEqual(actual.toJSON(), expected.toJSON())`。`toJSON()`は`{ type, id, points, strokeColor, strokeWidth }`を返すため、種別・`id`・頂点の個数・座標・**並び順**（配列の順序まで比較される）・線の色・線の太さの一致をまとめて確かめられる。
    4.  `actual.toJSON().points.length`が種別ごとの頂点数（開発資料4章`shapes/`：`line`=2・`curve`=3・`rect`=4・`arc`/`circle`=5）であること（両方の`toJSON`が同じように頂点を落とした場合の見逃しを防ぐ）。
    *   `arc`・`circle`の場合は、各テストで追加で`actual.startAngle === expected.startAngle`・`actual.endAngle === expected.endAngle`を確かめる（公開プロパティ。図形データに保存されず`type`から決まる値のため）。
*   **往復の経路**（補助関数）：
    *   オブジェクト層：`roundTripByObject(shapes)` = `DocumentSerializer.deserialize(DocumentSerializer.serialize(shapes))`。
    *   文字列層：`roundTripByString(shapes)` = `DocumentSerializer.deserializeFromString(DocumentSerializer.serializeToString(shapes))`。
    *   どちらも結果が`ok === true`・`skipped`が空配列・`error === null`・`shapes.length`が元と同じであることを確かめ、各要素を`assertSameShape`で比較する。`console.warn`の呼び出しが0回であることも確かめる。
*   **作る状態**（各図形クラスの実コードを読んで決めた。座標の値は例示であり、実装時に同等の値でよい。各状態は1図形の配列として両方の層で往復させる。`id`は`'shape-1'`等を代入する）：
    *   `line`：
        *   生成直後：`ShapeFactory.create('line', 10, 20, 110, 70)`。
        *   逆向き：`ShapeFactory.create('line', 110, 70, 10, 20)`（始点・終点の並びが入れ替わらないこと）。
        *   頂点を動かした：生成後に`setVertex(0, -15.5, 30.25)`・`setVertex(1, 240, -60)`（負の数・小数を含む）。
        *   平行移動した：生成後に`translate(12.5, -7)`。
        *   線の色・太さを変えた：`new Line(0, 0, 50, 50, '#ff0000', 5.5)`。
    *   `curve`：
        *   生成直後：`ShapeFactory.create('curve', 0, 0, 100, 40)`（制御点は始点・終点の中点）。
        *   頂点を動かした：生成後に`setVertex(1, 30, -80)`（制御点を中点から外す）・`setVertex(2, 150.75, 10)`。
        *   平行移動した：生成後に`translate(-3, 4.5)`。
        *   線の色・太さを変えた：`new Curve(0, 0, 100, 40, '#00ff00', 1)`。
    *   `rect`：
        *   生成直後：`ShapeFactory.create('rect', 10, 10, 90, 60)`。
        *   右下から左上へ作った：`ShapeFactory.create('rect', 90, 60, 10, 10)`（`points[0]`が見た目の右下になる状態。並びが正規化されないこと）。
        *   頂点を動かした：生成後に`setVertex(2, 120, 95)`・`setVertex(3, 5, 70.5)`（軸に平行でない自由変形）。
        *   平行移動した：生成後に`translate(100, -50)`。
        *   線の色・太さを変えた：`new Rect(10, 10, 90, 60, '#123456', 8)`。
    *   `arc`・`circle`（`Ellipse`。同じ状態を両方の種別で作る）：
        *   生成直後：`ShapeFactory.create(type, 50, 50, 80, 20)`。
        *   楕円にした：生成後に`setVertex(1, 120, 0)`（横の半径を変える。`y`は無視される）・`setVertex(2, 0, 10)`（縦の半径を変える。`x`は無視される）。
        *   中心を動かした：生成後に`setVertex(0, -20, 35.5)`。
        *   平行移動した：生成後に`translate(7, -9)`。
        *   線の色・太さを変えた：`new Ellipse(50, 50, 80, 20, type, '#0000ff', 3)`。
        *   弧の角度：角度を変える公開APIは無い（`startAngle`・`endAngle`は`type`から決まる固定値で、図形データに保存しない。開発資料4章`shapes/`）。そのため各状態で、復元後の`startAngle`・`endAngle`が元と一致すること（`arc`は`Math.PI`→`Math.PI * 2`、`circle`は`0`→`Math.PI * 2`）を確かめるのみとする。
    *   **状態を作れたことの確認**：`setVertex`・`translate`で作った状態（「頂点を動かした」「楕円にした」「中心を動かした」「平行移動した」）では、往復の前に、同じ引数で`ShapeFactory.create`した生成直後の図形の`toJSON().points`と`notDeepStrictEqual`であることを確かめる（頂点の変更APIが効いていないのに往復だけ成功する見逃しを防ぐ）。線の色・太さを変えた状態では、`strokeColor`が`'#000000'`でなく`strokeWidth`が`2`でないこと（コンストラクタJSDocの既定値）を確かめる。
*   **混在の往復（描画順）**：5種を既定の並び（`SHAPE_TYPES`の順）と異なる順（例：`rect`・`arc`・`line`・`circle`・`curve`）で1つの配列にし、一部は頂点を動かした状態、`id`は`'shape-1'`〜`'shape-5'`とする。両方の層で往復し、復元後の配列の`type`の並び・`id`の並びが元と一致し、各要素が`assertSameShape`を満たすことを確かめる。
*   **図形0個**：`serialize([])`→`deserialize`、`serializeToString([])`→`deserializeFromString`の両方で、`ok === true`・`shapes`が空配列・`skipped`が空配列・`error === null`。
*   **補足の検証**（往復の前提の確認。少数に留める）：
    *   `JSON.parse(DocumentSerializer.serializeToString(shapes))`が`DocumentSerializer.serialize(shapes)`と`deepStrictEqual`（文字列層とオブジェクト層が同じ作業データを表す）。
    *   `serialize(shapes)`の結果が`format === 'oz-vector-editor'`・`version`が1以上の整数・`shapes`が各図形の`toJSON()`の配列。
    *   独立性：往復で復元した図形に`translate`をしても元の図形の`toJSON()`が変わらない。`serialize`の結果の頂点を書き換えても元の図形の`toJSON()`が変わらない（DocumentSerializerのJSDoc「図形インスタンスを共有しない」）。

### 要件5: 旧版・壊れたデータ・未知の図形種別の挙動のテスト（タスク2・タスク3）

#### タスク2：`DocumentSerializer`の契約（`test/io/DocumentSerializer.errors.test.js`）
*   **補助関数**：`silenceWarn(t)`、`currentVersion()`（`DocumentSerializer.serialize([]).version`を返す。現行版の番号をテストに直接書かない）、`makeValidShapes()`（`id`付きの5種の図形インスタンスを毎回新しく作って返す）、`makeDocument(shapesData)`（`{ ...DocumentSerializer.serialize([]), shapes: shapesData }`を返す。`format`・`version`は公開APIの出力から得る）、`assertWholeFailure(result)`（`ok === false`・`shapes`が空配列・`skipped`が空配列・`typeof error === 'string'`かつ空でない）。
*   **全体の読み込み失敗（オブジェクト層`deserialize`）**：各ケースで`assertWholeFailure`、および`console.warn`が1回。
    *   最上位がプレーンオブジェクトでない：`null`・`undefined`・`[]`・図形データを要素に持つ配列・`0`・`42`・`'text'`・`true`。
    *   `format`：無い・`'other-format'`・`'OZ-VECTOR-EDITOR'`（大文字小文字の違い）・`null`。
    *   `version`：無い・`String(currentVersion())`（`"1"`のような文字列）・`currentVersion() + 0.5`（小数）・`0`・`-1`・`currentVersion() + 1`（現行版より大きい）・`NaN`・`null`。
    *   `shapes`：無い・`null`・`{}`・`'shapes'`・`3`。
*   **全体の読み込み失敗（文字列層`deserializeFromString`）**：同じく`assertWholeFailure`と`console.warn`1回。
    *   JSONとして解析できない：`''`・`'not json'`・`'{"format":'`・正しい作業データの文字列の末尾1文字を削ったもの。
    *   JSONとしては正しいが作業データでない：`'null'`・`'[]'`・`'42'`・`'"text"'`・版0の作業データの`JSON.stringify`。
*   **版の範囲（旧版の作業データ）**：
    *   `currentVersion()`が1以上の整数であること。
    *   現行版の作業データ（`makeDocument`に5種の図形データ）が`ok === true`で5図形とも復元されること（オブジェクト層・文字列層）。
    *   版0・現行版より大きい版が全体の失敗になること（上の`version`のケースと同じ内容を「版の範囲」の見出しでも明示する。重複してよい）。
    *   マイグレーション（版1→版2等）のテストは版2が追加されるまで書けない（`MIGRATIONS`が空・非公開のため）。5章と開発資料の更新予定に記録する。
*   **図形単位のスキップ**：1つの作業データの`shapes`に、正しい図形データと次の不正な要素を混ぜる（両方の層で確かめる。文字列層ではJSONで表せる値のみを使う）。
    *   未知の図形種別：`{ type: 'triangle', id: 'x', points: [{x:0,y:0},{x:1,y:1}], strokeColor: '#000000', strokeWidth: 2 }` → スキップ（`type: 'triangle'`）。
    *   頂点の不足：`line`で`points`が1要素 → スキップ（`type: 'line'`）。
    *   頂点の過多：`curve`で`points`が4要素 → スキップ（`type: 'curve'`）。
    *   座標が数値でない：`rect`の`points[2].x`が`'10'`（文字列）→ スキップ（`type: 'rect'`）。
    *   `points`が配列でない：`arc`で`points: {}` → スキップ（`type: 'arc'`）。
    *   線の太さが不正：`circle`で`strokeWidth: 0` → スキップ（`type: 'circle'`）。
    *   線の色が文字列でない：`line`で`strokeColor: 123` → スキップ（`type: 'line'`）。
    *   要素がオブジェクトでない：`null`・`7`・`['x']` → スキップ（`type: null`）。
    *   種別が文字列でない・無い：`type: 5`の図形データ・`type`の無い図形データ → スキップ（`type: null`）。
    *   確かめること：`ok === true`・`error === null`／復元された図形が正しい要素だけで、並びが元の順（`toJSON()`を元の図形データと`deepStrictEqual`）／`skipped`の各要素の`index`（`shapes`配列内の位置）と`type`が期待どおりの並びで一致（`skipped.map(({index, type}) => ({index, type}))`を期待の配列と`deepStrictEqual`）／各`reason`が空でない文字列（文言は比較しない）／`console.warn`の回数が`skipped.length`と同じ。
    *   余分なプロパティ：正しい`circle`の図形データに`startAngle: 1`・`foo: 'bar'`を足したものはスキップされず復元され、復元後の`toJSON()`に余分なプロパティが無い（開発資料4章`shapes/`「余分なプロパティは無視する」）。
*   **全図形のスキップ**：不正な要素だけの`shapes`で`ok === true`・`shapes`が空配列・`skipped.length`が要素数・`error === null`。
*   **引数を書き換えない**：
    *   `deserialize`：正しい要素と不正な要素を混ぜた作業データ、および全体の失敗になる作業データ（`version: 0`）について、呼ぶ前に`structuredClone`で写しを取り、呼んだ後の引数が写しと`deepStrictEqual`。
    *   `serialize`：渡した配列の長さ・各要素が同じインスタンスのまま同じ順であること、各図形の`toJSON()`が呼ぶ前と`deepStrictEqual`であること。

#### タスク3：読み込みの判定（`test/edit/CanvasFileOperations.test.js`）
*   **書くと判断した理由**：
    *   `CanvasFileOperations`の`import`は`DocumentSerializer`のみで、DOMに触れない。依存（`fileIO`・`canvasLibrary`・`inserter`・`model`・`prepareInsert`）はすべてコンストラクタで注入され、使うメソッドはJSDocに列挙されている（`fileIO`は`downloadText`・`readText`・`getFileName`・`toCanvasName`、`canvasLibrary`は`createCanvasFromShapes`・`getState`・`onChange`、`inserter`は`insertDocument`、`model`は`getShapes`）。偽物は数十行に収まる。
    *   分類の結果は、公開APIの戻り値（`openFile`・`importFile`の`Promise<boolean>`）・`getState().fileNotice`・注入した依存が呼ばれたか（とその引数）で観測できる。いずれもクラスJSDocの「読み込みの判定の表」「■ インポート」の手順と開発資料3章9.に書かれた契約であり、private項目や記述の無い内部手順には依存しない。
*   **偽物**（テストファイル内の補助関数`createHarness()`で毎回新しく作る。JSDocを書く）：
    *   ファイル：`{ name, text }`または`{ name, readError }`の素のオブジェクト（`CanvasFileOperations`は`File`を不透明に扱い`fileIO`へ渡すだけのため）。
    *   `fileIO`：`getFileName(file)`は`file.name`、`readText(file)`は`readError`があればreject・無ければ`text`でresolve、`toCanvasName(name)`は`'canvas:' + name`のような識別できる変換、`downloadText`は何もしない。
    *   `canvasLibrary`：`getState()`は`{ loading: false, busy: false, canManage: true, openCanvasId: 'canvas-a', openCanvasName: 'A', canvases: [], issue: null, hasSaveProblem: false }`の新しいオブジェクト、`onChange(listener)`は登録のみ、`createCanvasFromShapes(name, shapes)`は引数を記録して`true`でresolve。
    *   `inserter`：`insertDocument(documentData, dx, dy)`は引数を記録し、`{ ok: true, insertedIds: documentData.shapes.map((_, i) => 'new-' + i), skipped: [], error: null }`を返す（`ShapeInserter`の`InsertResult`の形）。
    *   `model`：`getShapes()`は空配列。
    *   `prepareInsert`：呼ばれたことを記録する関数。
    *   呼び出しの順序は1つの記録用配列（例：`['prepareInsert', 'insertDocument']`）に積む。
*   **ファイルの中身**：正しい作業データの文字列は`DocumentSerializer.serializeToString`で作る。不正な図形を含む文字列は、`DocumentSerializer.serialize`の結果の`shapes`に不正な図形データ（例：`type: 'triangle'`）を足して`JSON.stringify`する。
*   **ケース**（判定の表の各行 × 開く（ファイル）・インポート。各テストで`silenceWarn(t)`）：
    | 場面 | 開く（ファイル）で確かめること | インポートで確かめること |
    | --- | --- | --- |
    | ファイルを読み取れない（`readText`がreject） | 戻り値`false`・`createCanvasFromShapes`が呼ばれない・`fileNotice`が`{ kind: 'readFailed', fileName, skippedCount: 0 }` | 戻り値`false`・`prepareInsert`・`insertDocument`が呼ばれない・`fileNotice`が同上 |
    | JSONとして解析できない（`'not json'`） | 同上 | 同上 |
    | `ok: false`（`format`違い・版0・現行版より大きい版の3つ） | 同上 | 同上 |
    | 図形がすべて読めない（不正な図形だけ） | 同上（新しいキャンバスを作らない） | 同上 |
    | 図形0個の正しいファイル | 戻り値`true`・`createCanvasFromShapes`が1回、引数が`(toCanvasName(fileName), [])`・`fileNotice`が`null` | 戻り値`false`・`prepareInsert`・`insertDocument`が呼ばれない・`fileNotice`が`{ kind: 'noShapes', fileName, skippedCount: 0 }` |
    | 一部の図形が読めない（正しい2図形＋不正1つ） | 戻り値`true`・`createCanvasFromShapes`へ渡った図形の`toJSON()`が正しい2図形の図形データと一致・`fileNotice`が`{ kind: 'partialRead', fileName, skippedCount: 1 }` | 戻り値`true`・呼び出し順が`prepareInsert`→`insertDocument`（各1回）・`insertDocument`の第1引数の`shapes`が正しい2図形の図形データと一致し、第2・第3引数が`0`・`fileNotice`が`{ kind: 'partialRead', fileName, skippedCount: 1 }` |
    | すべて読めた（5種の図形） | 戻り値`true`・渡った図形の`toJSON()`が5図形の図形データと並びも含め一致・`fileNotice`が`null` | 戻り値`true`・呼び出し順が`prepareInsert`→`insertDocument`・第1引数の`shapes`が5図形の図形データと一致・`fileNotice`が`null` |
*   **対象外**（5章に記録）：書き出し（`exportCanvas`）、受理条件（読み込み中・処理中・`'unavailable'`）、読み取り中の`busy`、インポートのキャンバスの同一性の確認、`createCanvasFromShapes`が`false`の場合の通知、通知の解除条件、`insertDocument`の`skipped`の合算。いずれも読み込み結果の分類（REQ要件5の対象）ではないため。

### 要件6: 開発資料への記載（最終タスクで反映）
*   記載先は`PROJECT_ARCHITECTURE.md`冒頭の記載基準と4章の運用（モジュール・フォルダごとに`_doc/arch/`の分冊を作り一覧へ1行足す）に従い、次のとおりとする。
    *   `PROJECT_ARCHITECTURE.md` 1章：フォルダ構造へ`test/`（`io/`・`edit/`と3ファイル）を追加。「存在しないもの」へ`package.json`・`node_modules`・ビルド手順・テストの自動実行（フック・CI）を追加。「フォルダ分割の方針」へ`test/`の1項（Node.jsはテストの実行にのみ使う・依存は`test/ → js/`の一方向で`index.html`・`js/`は`test/`を参照しない・詳細は4章`test/`）を追加。
    *   `PROJECT_ARCHITECTURE.md` 4章の一覧：`test/`（自動テスト）→`_doc/arch/16_test.md`の1行を追加。
    *   `_doc/arch/16_test.md`（新設）：実行方法・置き場所と命名・書き方の決まり・既存のテストファイルの一覧と検証範囲・版を上げるときの決まり・テストできない箇所・やらないと決めたこと。
    *   `_doc/arch/15_io.md`・`14_edit.md`・`12_shapes.md`：該当モジュールの変更時に対応するテストを直す・足す旨の1文。
*   実行方法等を`PROJECT_ARCHITECTURE.md`本文ではなく分冊にする理由：テストの規則はテストを書く・直す作業でのみ必要で、1つのフォルダ（`test/`）に閉じた知識のため、4章の他のフォルダ（`shapes/`・`edit/`等）と同じ扱いにしてコンテキストを減らす。一方、Node.jsの使い方の制限（ビルドなしの方針との関係）と依存の向きは全作業に関わるため、1章に要点を残す（ハルシネーションの防止を優先）。

### 要件7: 回帰防止
*   `index.html`・`js/`配下を変更しないため、エディタの挙動は変わらない。テストプレイの確認項目は5章に列挙する。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./test/`（新設。自動テスト）、`./test/io/`（`js/io/`のテスト）、`./test/edit/`（`js/edit/`のテスト）。最終タスクのみ`./PROJECT_ARCHITECTURE.md`・`./_doc/arch/`。
*   **新設するテストファイル**: `test/io/DocumentSerializer.roundtrip.test.js`、`test/io/DocumentSerializer.errors.test.js`、`test/edit/CanvasFileOperations.test.js`。
*   **テスト対象（変更しない）の論理クラス**: `DocumentSerializer`（`js/io/`）、`ShapeFactory`・`SHAPE_TYPES`（`js/core/`）、`Line`・`Curve`・`Rect`・`Ellipse`（`js/shapes/`）、`CanvasFileOperations`（`js/edit/`）。
*   **偽物で置き換える（importしない）論理クラス**: `DocumentFileIO`、`CanvasLibrary`、`ShapeInserter`、`VectorModel`、`prepareInsert`の実体（`main.js`の`applyMode`）。

### 参照する責務
*   **依存方向**（1章）：`main.js → edit → io → core → shapes`の一方向。テストはこの外側（`test/ → js/`）から公開APIを呼ぶだけとし、依存方向に手を入れない。
*   **図形データ**（2章）：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`。各図形クラスの`toJSON()`/`static fromJSON(data)`で相互変換する。`Line`も`points`2点＝[始点, 終点]。`points`の並びは各図形クラスの頂点の並びと同じ。`fromJSON`直後の`id`は未検証・未正規化（`data.id`のまま）。
*   **作業データ形式**（2章）：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）。変換は`io/DocumentSerializer.js`。図形クラスは常に現行版の図形データのみを扱い、旧版の知識は`DocumentSerializer`のマイグレーション表に閉じる。
*   **`DocumentSerializer.js`**（4章`io/`）：静的メソッドのみ。公開メソッドは`serialize`・`deserialize`（オブジェクト層）、`serializeToString`・`deserializeFromString`（文字列層）。DOMを知らず、importは`ShapeFactory`のみ。
    *   デシリアライズ系は例外をthrowせず、結果オブジェクト`{ ok, shapes, skipped, error }`を返す。全体失敗（`ok: false`・`shapes`/`skipped`は空配列・`error`は理由の文字列）の条件：最上位がプレーンオブジェクト（null・配列以外のobject）でない／`format`が`'oz-vector-editor'`でない／`version`が整数でない・1未満・現行版より大きい／必要なマイグレーション関数が未定義・throw・プレーンオブジェクト以外を返した／マイグレーション後の`shapes`が配列でない。`deserializeFromString`は`JSON.parse`の失敗も全体失敗にする。
    *   図形単位の`try/catch`はここ1箇所のみ。未知の図形種別・不正な図形データの要素はスキップとして`{ index, type, reason }`（`type`は要素が文字列の`type`を持てばその値、なければ`null`。`reason`は捕捉したErrorのmessage）を記録し、残りを続行する。全要素がスキップされた場合・`shapes`が空配列の場合も`ok: true`（図形0個）。スキップ1件ごと、および全体の失敗時に`console.warn`を出す。
    *   `serialize`系は入力を検証しない（図形インスタンスの配列のみを渡す）。戻り値は図形インスタンスを共有しない。引数のオブジェクトは書き換えない。
    *   現行版は非公開定数`CURRENT_DOCUMENT_VERSION`（現在1）。`MIGRATIONS`は非公開で空。版の追加手順は`MIGRATIONS`のJSDoc。
*   **`ShapeFactory.js`**（4章`ShapeFactory.js`・ソースJSDoc）：図形種別一覧の正本。`SHAPE_TYPES`は`['line', 'curve', 'arc', 'rect', 'circle']`の順。`create(type, x1, y1, x2, y2)`は未知の種別でthrow。`fromJSON(data)`はプレーンオブジェクトでない・未知の種別でthrowし、各図形クラスの`fromJSON`へ委譲する（例外を捕捉しない）。`arc`・`circle`はどちらも`Ellipse`。
*   **`shapes/`**（4章`shapes/`）：
    *   `toJSON`/`fromJSON`はどちらの方向でも内部配列・頂点オブジェクトを共有しない。`fromJSON`は不正な入力で`Error`をthrowする（プレーンオブジェクトでない／`type`が違う／`points`の要素数が違う・配列でない／頂点の`x`・`y`が有限の数値でない／`strokeColor`が文字列でない／`strokeWidth`が有限の数値でないか0以下）。`id`は検証せずそのまま保持する。余分なプロパティは無視する。往復で図形データの内容は一致する。
    *   `Line`：`x1, y1`=始点／`x2, y2`=終点で保持し、図形データでは`points`2点。`setVertex(0|1, x, y)`。
    *   `Curve`：3頂点（始点・制御点・終点）。コンストラクタは制御点を中点に置く。`setVertex(0|1|2, x, y)`。
    *   `Rect`：4頂点（topLeft・topRight・bottomRight・bottomLeft。論理名で見た目の位置を保証しない）。正規化しない。`setVertex(0〜3, x, y)`は直接上書き。
    *   `Ellipse`（`circle`・`arc`）：5頂点（中心・右端・上端・開始角・終了角の制御点）。`setVertex`は0〜2のみ（0=中心移動で半径維持、1=横の半径（`y`は無視）、2=縦の半径（`x`は無視））。開始角・終了角は`type`から決まる固定値（`arc`は`Math.PI`〜`Math.PI * 2`、`circle`は`0`〜`Math.PI * 2`）で図形データに保存しない。コンストラクタの引数は`(x1, y1, x2, y2, shapeType, strokeColor, strokeWidth)`。
    *   コンストラクタの線の色・太さの既定値は`'#000000'`・`2`（`Line`・`Curve`・`Rect`は第5・第6引数、`Ellipse`は第6・第7引数）。
    *   `draw`・`drawHandles`・`drawHover`は`CanvasRenderingContext2D`を受け取る（テストしない）。
*   **`CanvasFileOperations.js`**（3章9.・4章`edit/`・クラスJSDoc）：ファイル操作の組み立て。DOMに触れない。importは`DocumentSerializer`のみ。公開メソッドは`exportCanvas`・`openFile`・`importFile`・`getState`・`onChange`。
    *   注入：`fileIO`（`downloadText`・`readText`・`getFileName`・`toCanvasName`のみ使用）、`canvasLibrary`（`createCanvasFromShapes`・`getState`・`onChange`のみ使用）、`inserter`（`insertDocument`のみ使用）、`model`（`getShapes`のみ使用）、`prepareInsert`（関数でなければコンストラクタがthrow）。
    *   読み込みの判定の表（`deserializeFromString`の結果`result`で判定）：読み取れない・JSONとして解析できない・`ok: false`（形式違い・非対応の版を含む）→読み込み不可（開く・インポートとも何も変えない／通知`readFailed`）。`shapes`0個かつ`skipped`1件以上→読み込み不可（新しいキャンバスを作らない／`readFailed`）。`shapes`・`skipped`とも0件→空（開く：空のキャンバスとして開く・通知なし／インポート：何も変えない・`noShapes`）。`shapes`1個以上かつ`skipped`1件以上→一部（読めた図形で開く・追加する／`partialRead`）。`shapes`1個以上かつ`skipped`0件→全部（開く・追加する／通知なし）。
    *   開く（ファイル）：読めた場合のみ`canvasLibrary.createCanvasFromShapes(fileIO.toCanvasName(ファイル名), 読めた図形)`。
    *   インポート：判定を通った後に`prepareInsert()`→`inserter.insertDocument(DocumentSerializer.serialize(読めた図形), 0, 0)`。読み込み不可・図形0個では`prepareInsert`より前に終わる。`partialRead`の件数は判定時と`insertDocument`の`skipped`の合計。
    *   通知`FileNotice`は`{ kind, fileName, skippedCount }`。`getState().fileNotice`で得る。`openFile`・`importFile`は`Promise`をrejectしない。
*   **`DocumentFileIO.js`**（4章`io/`）：`Blob`・`File`のブラウザAPIを閉じ込める。`CanvasFileOperations`へ注入される（テストでは偽物に置き換える）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造の`PROJECT_CONSTITUTION.md`の前（`js/`の後）へ次を追加する。
        ```text
        ├── test/                       # 自動テスト（node --test でのみ実行。index.html・js/からは参照しない）。中はjs/の構成に合わせる
        │   ├── io/
        │   │   ├── DocumentSerializer.roundtrip.test.js
        │   │   └── DocumentSerializer.errors.test.js
        │   └── edit/
        │       └── CanvasFileOperations.test.js
        ```
    *   「存在しないもの」へ追加：`package.json`・`node_modules`・ビルド手順・テストの自動実行（保存時・コミット時のフック、CI）・画面の操作や描画のテスト。
    *   「フォルダ分割の方針」へ追加：「`test/`：自動テスト。Node.jsはテストの実行（`node --test`）にのみ使い、エディタのビルド・配信には使わない。依存は`test/ → js/`の一方向で、`index.html`・`js/`は`test/`を参照しない。規則は4章`test/`。」
*   **`PROJECT_ARCHITECTURE.md` 4章の一覧**：`| test/（自動テスト） | _doc/arch/16_test.md |`を末尾に追加。
*   **`_doc/arch/16_test.md`（新設）**：他の分冊と同じ箇条書きの形式（`*   **test/**：…`）で次を書く。
    *   実行方法：プロジェクトのルートで`node --test`（引数なし）。確認したNode.jsの版はv24.20.0。`package.json`を作らない（`package.json`がなくても`import`/`export`を含む`.js`がESモジュールとして読み込まれ、警告も出ないことを確認済み。古いNode.jsでは動かない可能性がある）。Node.jsはテストの実行にのみ使う。結果は標準の出力の`tests`・`pass`・`fail`の件数で見る。
    *   置き場所と命名：`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`test/`以下の`.js`はすべてテストとして実行されるため、共有の補助モジュールを置かず、補助関数は各テストファイルの中に書く。プロジェクト内に`test.js`・`test-*.js`・`*_test.js`・`*-test.js`の名前のファイルを作らない。
    *   書き方の決まり：先頭行の単一責務JSDocと補助関数のJSDoc／`node:test`・`node:assert/strict`のみ（外部ライブラリ・DOMの模擬ライブラリを使わない）／対象は相対パスで`import`し、公開API（`export`されたクラス・定数・publicメソッド・JSDocにある公開プロパティ）のみを通す／テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない／`globalThis`・`window`へ代入しない／`console.warn`は各テストで`t.mock.method(console, 'warn', () => {})`により抑止する（テストの終了時に自動で戻る）／注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える。
    *   既存のテストファイルと検証範囲（3ファイルそれぞれ1〜2行）。
    *   版を上げるとき：作業データ形式の版を上げる（`MIGRATIONS`へ関数を足す）ときは、`test/io/`へマイグレーションのテスト（旧版の作業データが現行版として読めること、マイグレーションが引数を書き換えないこと等）を追加する。現在は版1のみで`MIGRATIONS`が空・非公開のため、マイグレーションの経路（未定義・throw・オブジェクト以外を返す場合の全体失敗を含む）はテストしていない。
    *   テストできない箇所（要件3の調査結果。Node.js v24.20.0で確認）：`DocumentFileIO`の`downloadText`（`document`に依存するためNode.jsでそのまま動かない）、`CanvasStorage`（`indexedDB`に依存。Node.jsには無い）、図形の`draw`・`drawHandles`・`drawHover`（`CanvasRenderingContext2D`が要る。Node.jsには無い）。DOMからの切り離しは行っていない。`DocumentFileIO`の`readText`・`getFileName`・`toFileName`・`toCanvasName`はNode.jsでも動き得るが、テストしていない（`File`・`Blob`・`URL.createObjectURL`はNode.jsにも存在する）。
    *   やらないと決めたこと：`package.json`・npmパッケージ・ビルドツールの導入、テストの自動実行（フック・CI）、画面の操作・描画のテスト、ブラウザの自動操作。
*   **`_doc/arch/15_io.md`**：`DocumentSerializer.js`の「マイグレーションと版の追加」へ「版を上げるときは`test/io/`へマイグレーションのテストを追加する（4章`test/`）。」を追加。「契約」の項の後へ「契約（往復・全体の失敗・スキップ・非破壊）は`test/io/DocumentSerializer.*.test.js`で検証している。契約を変えたらテストも直す。」を追加。
*   **`_doc/arch/14_edit.md`**：`CanvasFileOperations.js`の項へ「読み込みの判定の表と通知は`test/edit/CanvasFileOperations.test.js`で検証している（判定・通知を変えたらテストも直す）。」を追加。
*   **`_doc/arch/12_shapes.md`**：12メソッド契約の「新規図形を追加する際は…」の後へ「図形種別を追加したら`test/io/DocumentSerializer.roundtrip.test.js`へ往復のケースを足す。」を追加。
*   (各タスクの実行時に影響が判明した場合も、この欄へ追記する。資料本体への反映は最終タスクで行う)

## 3. タスクリスト
*   [x] タスク1: 5種の図形の往復テストの新設
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` :（新規。`test/`・`test/io/`フォルダも新設）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: DocumentSerializerの往復（図形インスタンス→作業データ→図形インスタンス）で5種の図形が元と同じ図形に戻ることを、公開APIのみを通して検証する。」
        *   importは`node:test`（`describe`・`it`）・`node:assert/strict`・`../../js/io/DocumentSerializer.js`・`../../js/core/ShapeFactory.js`（`ShapeFactory`・`SHAPE_TYPES`）・`../../js/shapes/`の4ファイル（色・太さを変えた図形のコンストラクタ呼び出し用）のみ。
        *   補助関数`silenceWarn(t)`・`assertSameShape(actual, expected)`・`roundTripByObject(shapes)`・`roundTripByString(shapes)`（必要なら頂点数の表・状態を作る関数）をJSDoc付きで書く。
        *   2章要件4の「作る状態」「状態を作れたことの確認」「混在の往復」「図形0個」「補足の検証」をすべて、オブジェクト層・文字列層の両方で書く。各テストで`silenceWarn(t)`を呼び、往復では警告0回を確かめる。
        *   ソース（`index.html`・`js/`）を変更しない。`globalThis`へ代入しない。`package.json`を作らない。
        *   完了時にプロジェクトのルートで`node --test`を実行し、全テストの成功と表示された件数（`tests`・`pass`・`fail`）を本RESの4章へ記録する。失敗した場合、テストの誤りなら直し、既存コードの不具合と考えられる場合はソースを直さずに5章へ記録して報告する。開発資料への影響が判明したら2章の更新予定欄へ追記し、判断に迷った点は5章へ記述する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク2: `DocumentSerializer`の失敗・スキップ・版の範囲・非破壊のテストの新設
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.errors.test.js` :（新規）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: DocumentSerializerのデシリアライズの契約（全体の読み込み失敗・図形単位のスキップ・版の範囲・引数を書き換えないこと）を、公開APIのみを通して検証する。」
        *   importは`node:test`・`node:assert/strict`・`../../js/io/DocumentSerializer.js`・`../../js/core/ShapeFactory.js`のみ（図形を作るため。必要なら`../../js/shapes/`も可）。
        *   補助関数`silenceWarn(t)`・`currentVersion()`・`makeValidShapes()`・`makeDocument(shapesData)`・`assertWholeFailure(result)`をJSDoc付きで書く。現行版の番号・`format`の値はテストに直接書かず`DocumentSerializer.serialize([])`から得る（ただし`format`が`'oz-vector-editor'`であることの確認はタスク1で行う）。
        *   2章要件5「タスク2」の全体の読み込み失敗（オブジェクト層・文字列層）・版の範囲・図形単位のスキップ（両方の層）・余分なプロパティ・全図形のスキップ・引数を書き換えないことをすべて書く。警告の回数（全体の失敗で1回、スキップ1件につき1回）を確かめ、文言は比較しない。
        *   ソースを変更しない。`globalThis`へ代入しない。
        *   完了時に`node --test`を実行し、全テスト（タスク1を含む）の成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク3: 読み込みの判定（`CanvasFileOperations`）のテストの新設
    *   **対象ファイル** :
        *   `./test/edit/CanvasFileOperations.test.js` :（新規。`test/edit/`フォルダも新設）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（3行以内）。案：「責務: CanvasFileOperationsの開く（ファイル）・インポートでの読み込み結果の分類（読み込み不可・空・一部・全部）と通知を、注入する依存の偽物と公開APIのみを通して検証する。」
        *   importは`node:test`・`node:assert/strict`・`../../js/edit/CanvasFileOperations.js`・`../../js/io/DocumentSerializer.js`（ファイルの中身を作るため）・`../../js/core/ShapeFactory.js`（図形を作るため）のみ。`DocumentFileIO`・`CanvasLibrary`・`ShapeInserter`・`VectorModel`は`import`しない。
        *   補助関数`silenceWarn(t)`・`createHarness()`（2章要件5「タスク3」の偽物一式と呼び出しの記録を返す）・ファイルの偽物を作る関数等をJSDoc付きで書く。偽物は注入されるメソッドだけを持つ素のオブジェクトとし、グローバルに置かない。各テストで新しい`CanvasFileOperations`を作る。
        *   2章要件5「タスク3」のケースの表をすべて書く（開く（ファイル）・インポートの両方）。対象外の項目（書き出し・受理条件等）は書かない。
        *   ソースを変更しない。`globalThis`へ代入しない。
        *   完了時に`node --test`を実行し、全テスト（タスク1・2を含む）の成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク4: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js`、`./test/io/DocumentSerializer.errors.test.js`、`./test/edit/CanvasFileOperations.test.js` :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261107_2041_RES_Phase04-01_Automated_Tests.md` :（更新）
    *   **作業内容** :
        *   3つのテストファイルの先頭行の単一責務JSDoc（3行以内）が実態と一致していること、すべての補助関数にJSDoc（`@param`・`@returns`）があることを確認する。
        *   テストファイルがprivate項目・非公開の定数に触れていないこと、`globalThis`・`window`・`console`へ直接代入していないこと、`console.warn`の抑止が`t.mock`のみであること、`test/`内に補助用の`.js`（テストファイル以外）が無いこと、`test/`以外に新しいファイル（`package.json`・`node_modules`・`package-lock.json`等）ができていないこと、`index.html`・`js/`配下に変更が無いことを確認する。
        *   プロジェクトのルートで`node --test`を実行し、全テストの成功と件数、警告の文言が出力に流れていないことを4章のタスク4の欄へ記録する。
        *   本RESの仕上げとして、4章のタスク4の欄を記入し（タスク1〜3の欄はそれぞれのタスクで記入済みのため書き換えない）、開発資料への影響を2章の更新予定欄へ（資料本体は修正しない）、判断に迷った点・目視確認を推奨する箇所・将来修正する際の注意点を「5. 懸念事項・要確認ポイント」欄へ追記する。
        *   完了時に本タスクを [x] にする。
*   [ ] タスク5: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/16_test.md` :（新規）
        *   `./_doc/arch/15_io.md` :（更新）
        *   `./_doc/arch/14_edit.md` :（更新）
        *   `./_doc/arch/12_shapes.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料の更新予定」に記録した内容（各タスクでの追記を含む）を反映する：`PROJECT_ARCHITECTURE.md`の1章（フォルダ構造への`test/`の追加・「存在しないもの」・「フォルダ分割の方針」への`test/`の項）と4章の一覧（`test/`→`_doc/arch/16_test.md`の1行）、`_doc/arch/16_test.md`の新設（実行方法・確認したNode.jsの版・`package.json`を作らないこと・Node.jsはテストの実行にのみ使うこと・置き場所と命名規則・書き方の決まり・既存のテストと検証範囲・版を上げるときにマイグレーションのテストを足すこと・テストできない箇所・やらないと決めたこと）、`15_io.md`・`14_edit.md`・`12_shapes.md`への1文ずつの追記。
        *   反映時に実際の`test/`のファイル名・`node --test`の結果が記述と一致することを確認する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本最終タスクのみ明示的な例外とする（後続タスクが存在せず、他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 5種の図形の往復テストの新設
*   **作業内容** :
    *   `test/io/DocumentSerializer.roundtrip.test.js`を新設（`test/`・`test/io/`も新設）。補助関数`silenceWarn`・`assertSameShape`・`assertRestored`・`roundTripByObject`・`roundTripByString`・`statesFor`（種別ごとの状態の表）をJSDoc付きで記述。
    *   5種それぞれの「作る状態」を、オブジェクト層・文字列層の両方で往復（警告0回、動かした状態は生成直後との`notDeepStrictEqual`、色・太さは既定値でないことを確認、arc/circleは`startAngle`/`endAngle`比較）。混在（描画順・id）・図形0個・補足の検証（文字列層＝オブジェクト層、format/version/shapes、独立性2種）も実装。
    *   `node --test`の結果：`tests 56`・`pass 56`・`fail 0`（suites 6）。ソース・`package.json`は変更・作成なし。

### タスク2: `DocumentSerializer`の失敗・スキップ・版の範囲・非破壊のテストの新設
*   **作業内容** :
    *   `test/io/DocumentSerializer.errors.test.js`を新設。補助関数`silenceWarn`・`currentVersion`・`makeValidShapes`・`makeValidData`・`makeDocument`・`assertWholeFailure`・`without`・`broken`・`skipCases`（ケース表）・テスト内の局所関数`assertSkipped`をJSDoc付きで記述。
    *   全体の失敗（オブジェクト層25件・文字列層9件、各警告1回）、版の範囲、図形単位のスキップ（12ケース×両層＋複数混在）、余分なプロパティ（両層）、全図形のスキップ（両層）、引数を書き換えない（deserialize2件・serialize1件）を実装。
    *   `node --test`の結果（タスク1を含む全体）：`tests 127`・`pass 127`・`fail 0`（suites 12）。ソース・`package.json`は変更・作成なし。

### タスク3: 読み込みの判定（`CanvasFileOperations`）のテストの新設
*   **作業内容** :
    *   `test/edit/CanvasFileOperations.test.js`を新設（`test/edit/`も新設）。補助関数`silenceWarn`・`createHarness`（偽物一式＋呼び出し順`calls`・`createCalls`・`insertCalls`の記録。偽物の各メソッド・局所の`prepareInsert`にもJSDoc）・`makeFile`・`makeUnreadableFile`・`makeShapes`・`makeBadShapeData`・`makeTextWithShapesData`・`notice`・`unreadableCases`（読み込み不可6ケースの表）をJSDoc付きで記述。
    *   開く（ファイル）・インポートそれぞれで、読み込み不可6ケース（読み取り不可・JSON解析不可・format違い・版0・現行版より大きい版・図形がすべて読めない）、図形0個、一部読めない（正2＋不正1）、すべて読めた（5種）を実装。戻り値・依存の呼び出し（引数・順序）・`getState().fileNotice`を検証。警告回数は検証しない（抑止のみ）。
    *   `node --test`の結果（タスク1・2を含む全体）：`tests 145`・`pass 145`・`fail 0`（suites 14）。ソース・`package.json`は変更・作成なし。

### タスク4: JSDocの確認とRESの完成
*   **作業内容** :
    *   (未実施)

### タスク5: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   (未実施)

## 5. 懸念事項・要確認ポイント
* **`package.json`は不要と判断した**：計画時にプロジェクトの外の一時フォルダでNode.js v24.20.0により、`package.json`なしで`js/`のモジュールを`import`でき、警告が出ず、引数なしの`node --test`が`test/`を見つけて件数を表示することを確認した（2章要件1）。Node.jsの版が古い環境（`package.json`の無い`.js`のESM自動判定が無い版）では`import`で失敗する可能性がある。その場合も`package.json`を足さず、Node.jsの版を上げる方針とする（開発資料にも確認した版を書く）。
* **`test/`内のすべての`.js`がテストとして実行される**：引数なしの`node --test`は`test/`フォルダ下の`.js`を全部実行する（計画時に確認）。共有の補助モジュールを置くと、それも1件のテストとして実行・計上される。本作業では補助関数を各テストファイルの中に書き、ファイル間で重複してよいとした（`silenceWarn`等）。将来、補助関数の重複が大きくなっても`test/`下に補助モジュールを置かないこと（置く場合は別途方針を決める）。
* **命名の拡張**：REQの`<対象>.test.js`に対し、1モジュールを観点で分けるため`<対象モジュール名>.<観点>.test.js`（`DocumentSerializer.roundtrip.test.js`・`DocumentSerializer.errors.test.js`）とした。「1タスク＝原則1テストファイル」とタスクの順序（往復→失敗・スキップ）を守るため。
* **`id`は公開プロパティへの直接代入で設定する**：`VectorModel`の採番を使わず、図形の公開プロパティ`id`へ`'shape-1'`等を代入する（2章要件2）。`id`が`null`（作成中の図形）の往復はテストしない（保存される図形は`VectorModel`の採番後のため）。
* **線の色・太さの変更はコンストラクタの引数で行う**：線の色・太さを変える公開のメソッドは無く（色の編集はP5）、コンストラクタの引数（JSDocに記載）で既定値以外の図形を作る。
* **弧の角度**：角度を変える公開APIが無いため、`type`から決まる`startAngle`・`endAngle`が復元後に一致することのみを確かめる。弧の角度編集を実装する際は、角度を図形データへ保存して作業データ形式の版を上げ、往復テストに角度を変えた状態を足すこと。
* **マイグレーションのテスト**：現在の作業データ形式は版1のみで、`MIGRATIONS`は空・非公開のため、マイグレーションそのもの（旧版から現行版への変換、マイグレーション関数が未定義・throw・オブジェクト以外を返した場合の全体失敗）はテストできない。**作業データ形式の版を上げるとき（`MIGRATIONS`へ関数を足すとき）に、`test/io/`へマイグレーションのテストを追加すること**（開発資料の更新予定にも記載）。現時点では、現行版が読めること・版0と現行版より大きい版が全体の失敗になることのみを確かめる。
* **Node.jsに無いAPIに依存していてテストできない箇所**（2章要件3。Node.js v24.20.0で`typeof`により確認）：`DocumentFileIO`の`downloadText`（`document`に依存するためNode.jsでそのまま動かない。`Blob`・`URL.createObjectURL`はNode.jsにも存在する）、`CanvasStorage`（`indexedDB`。Node.jsには無い）、図形の`draw`・`drawHandles`・`drawHover`（`CanvasRenderingContext2D`。Node.jsには無い）。本作業では切り離していない。`DocumentFileIO`の`readText`（`File`の`text()`。`File`はNode.jsにも存在する）・`getFileName`・`toFileName`・`toCanvasName`はNode.jsでも動き得るが、本作業の対象外。テスト対象（`DocumentSerializer`・`ShapeFactory`・`shapes/`の変換・`CanvasFileOperations`の読み込み）にはDOM依存は無かった。
* **`CanvasFileOperations`のテストで扱わない項目**：書き出し（`exportCanvas`）、受理条件（読み込み中・処理中・`'unavailable'`）、読み取り中の`busy`、インポートのキャンバスの同一性の確認、`createCanvasFromShapes`が`false`の場合の通知（`'writeFailed'`なら出さない）、通知の解除条件、`insertDocument`の`skipped`の件数の合算。REQ要件5の対象（読み込み結果の分類）ではないため。偽物の`inserter`は常に`skipped: []`を返す。
* **テストが確かめる契約と実装の結びつき**：`CanvasFileOperations`のテストは、インポートで`prepareInsert`→`insertDocument(serialize(読めた図形), 0, 0)`の順に呼ぶことを確かめる。これはクラスJSDoc「■ インポート」と開発資料3章9.に書かれた契約だが、将来この手順を変える場合（例：`insertDocument`へ渡す作業データの作り方を変える）はテストも直す必要がある。
* **既存コードの不具合を見つけた場合**：テストの実行で既存コードの不具合と考えられる失敗が出たら、ソースを直さず本欄へ記録し、現場設計AIへ報告する（修正は別途Interrupt）。
* **テストプレイでの目視確認項目**（エディタ本体を変更しないため回帰は起きない見込み。次を確認する）：
    1.  プロジェクトのフォルダ（`index.html`のあるフォルダ）でPowerShell等を開き、`node --test`と入力して実行すると、全テストが成功し、最後に`ℹ tests`・`ℹ pass`（testsと同じ数）・`ℹ fail 0`の件数が表示される。
    2.  出力に`DocumentSerializer: …`・`CanvasFileOperations: …`のような警告の文言が大量に流れない。`ExperimentalWarning`・`MODULE_TYPELESS_PACKAGE_JSON`等の警告も出ない。
    3.  `node --test`を2回続けて実行しても同じ結果になり、実行後にプロジェクトのフォルダへ新しいファイルが増えない。
    4.  プロジェクトのフォルダに`package.json`・`package-lock.json`・`node_modules`ができておらず、新しくできたのは`test/`フォルダ（とその中の3ファイル）と開発資料の更新・新設（`_doc/arch/16_test.md`）のみである。
    5.  `index.html`をブラウザで（ダブルクリックで）開くと、これまでどおり起動し、5種の図形（直線・曲線・弧・矩形・円）の作成・頂点の変形・移動・取り消し/やり直し・コピー/貼り付けができる。
    6.  再読み込みしても図形が残る（自動保存）。キャンバスの新規作成・切り替えができる。
    7.  ファイルの書き出し → 開く（ファイル）・インポートで、書き出した図形がそのまま読み込める。
* **タスク1の実装メモ**：状態の表は`statesFor(type)`にまとめ、`it`をループで生成している（テスト名は`<状態名>（<層名>）`、`describe`は種別ごと）。`arc`・`circle`は同じ状態表を共用。
* **タスク2での補足**：`broken`は`makeValidData`から種別ごとの図形データを取り出して1項目だけ壊す。`assertSkipped`はテスト内の局所関数（describe内）。`undefined`・`NaN`はJSONで表せないためオブジェクト層のみで使用した。
