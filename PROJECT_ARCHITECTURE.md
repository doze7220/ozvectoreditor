# PROJECT_ARCHITECTURE.md
## OZ Vector Editor 全体仕様および実装定義書

**読者**：このリポジトリのコードを読めるAI。

**記載基準**
*   第一の目的はハルシネーションの防止、第二がコンテキストの削減。第二のために第一を犠牲にしない。
*   残す：責務と「何を知らないか」という境界、依存方向、複数モジュールにまたがる流れと順序の保証、誰が呼ぶか・誰が注入するか、保存形式、設計判断の理由、やらないと決めたこと、未実装のもの、呼んではいけない経路、公開メソッド名の一覧。
*   書かない：1つのファイルのJSDocを読めば分かること（引数と戻り値、private項目、typedefの中身、定数の値、1クラス内の処理順）。
*   JSDocが実コードと食い違う項目を見つけたら、JSDocが直るまで正しい記述をここに残す。
*   消すか迷ったら残す。誤った記述は長さに関係なく直すか消す。

---

### 1. プロジェクトフォルダ構造
新規にファイルを作成、あるいはログを記録する際、必ずこの構造に準拠すること。各ファイルの責務は4章を正とする。

```text
/oz-vector-editor/
├── index.html                  # スタイルはCSSファイル分割せず<style>タグに内包。フロートウィンドウも静的に置く
├── sprite-check.html           # 確認用ページ。index.htmlとは別に開く。スタイルは<style>に内包
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── VectorModel.js
│   │   ├── CanvasManager.js
│   │   ├── ViewTransform.js
│   │   ├── InputTracker.js
│   │   ├── KeyboardShortcuts.js
│   │   ├── DragTracker.js
│   │   ├── HistoryManager.js
│   │   ├── ShapeFactory.js
│   │   └── WindowManager.js
│   ├── shapes/
│   │   ├── Line.js
│   │   ├── Curve.js
│   │   ├── Rect.js
│   │   ├── Ellipse.js
│   │   ├── Path.js             # 図形クラスは種別ごとに1ファイル
│   │   ├── ShapeGeometry.js    # 以下2つは図形クラスではない。図形クラスだけが使う共通の関数
│   │   ├── ShapeDataValidation.js
│   │   ├── PathJoinRules.js    # 図形クラスではない。図形をまたぐ規則（結合）。shapes/の外から使う
│   │   └── EndpointSnapRules.js # 図形クラスではない。図形をまたぐ規則（端点への吸い付き）。shapes/の外から使う
│   ├── palette/
│   │   ├── PaletteController.js
│   │   ├── DevPanel.js
│   │   ├── CanvasPalette.js
│   │   └── PaletteLauncher.js  # 自己完結するUI部品をここに追加する
│   ├── edit/
│   │   ├── ShapeInserter.js
│   │   ├── PathJoiner.js
│   │   ├── EndpointSnapper.js
│   │   ├── ClipboardController.js
│   │   ├── SnapshotAdapter.js
│   │   ├── CanvasLibrary.js
│   │   └── CanvasFileOperations.js
│   ├── io/
│   │   ├── DocumentSerializer.js
│   │   ├── CanvasStorage.js
│   │   ├── DocumentFileIO.js
│   │   ├── SpriteSerializer.js
│   │   ├── CodeExporter.js
│   │   └── FileContentReader.js
│   └── check/
│       ├── SpriteCheckPage.js
│       ├── SpriteCheckCanvas.js
│       └── SpriteCheckInspector.js
├── test/                       # 自動テスト（node --test でのみ実行。index.html・js/からは参照しない）。中はjs/の構成に合わせる
│   ├── core/
│   │   ├── ShapeFactory.test.js
│   │   ├── VectorModel.replaceShape.test.js
│   │   └── VectorModel.snapPoint.test.js
│   ├── shapes/
│   │   ├── Line.test.js
│   │   ├── Curve.test.js
│   │   ├── Rect.test.js
│   │   ├── Ellipse.test.js
│   │   ├── Path.test.js
│   │   ├── PathJoinRules.test.js
│   │   └── EndpointSnapRules.test.js
│   ├── io/
│   │   ├── DocumentSerializer.roundtrip.test.js
│   │   ├── DocumentSerializer.errors.test.js
│   │   ├── SpriteSerializer.test.js
│   │   ├── CodeExporter.test.js
│   │   ├── CodeExporter.assembly.test.js
│   │   ├── FileContentReader.test.js
│   │   └── DocumentFileIO.test.js
│   ├── edit/
│   │   ├── CanvasFileOperations.test.js
│   │   ├── CanvasFileOperations.export.test.js
│   │   ├── PathJoiner.test.js
│   │   └── EndpointSnapper.test.js
│   └── check/
│       └── SpriteCheckInspector.test.js
│
├── PROJECT_CONSTITUTION.md
├── PROJECT_ARCHITECTURE.md
│
├── _doc/
│   ├── arch/                   # 本資料4章の本文。本資料を読む許可がある作業では、4章の一覧をパス指定として該当ファイルを読む
│   # arch/以外は人間・設計AI用の資料。明示的な指示がない限り読んで行動してはならない
│
└── _log/
    ├── req/
    │   └── closed/    # フェイズ大番号移行時にアーカイブ済みREQの退避先
    └── res/
        └── closed/    # フェイズ大番号移行時にアーカイブ済みRESの退避先
```

**存在しないもの**：エディタでのJSの実行（スプライトのJSはテキストから取り出すだけ）、本アプリが書き出した形以外のJSの読み込み・スプライトの`elements`からの図形の作り直し（`CodeImporter`は作らない。`_doc/PROJECT_MILESTONE.md`の将来の野望）、確認用ページでの拡大縮小・移動・編集・複数ファイルの同時表示・組み立て用のJSの表示、エディタから確認用ページへのリンク、組み立て用のJSの書き出し（アニメーションエディタモードのPhase）、スプライトのJSON（`<名前>.json`）の出力・読み込み・確認用ページでのJSONの表示（Phase 04-04でやめた。スプライトはJSだけ。`.json`は作業データファイル）、複数キャンバスの一括出力、PNG・SVG等の形式、カラーピッカー、ツールバー、塗りつぶし、レイヤー、グループ化、`package.json`・`node_modules`・ビルド手順、テストの自動実行（保存時・コミット時のフック、CI）、画面の操作や描画のテスト。

**フォルダ分割の方針**
*   `core/`：横断的な処理（入力→状態→描画の複数層にまたがるもの）。
*   `shapes/`：1種類の図形（図形クラス。種別ごとに1ファイル）と、図形クラスだけが使う共通の関数（幾何の計算・図形データの検証。継承ではなく関数の切り出し。詳細は4章`shapes/`）、図形をまたぐ規則（`PathJoinRules`（結合の規則）・`EndpointSnapRules`（端点への吸い付きの規則）。第3の種類で、`shapes/`の外から使う。3章11.・12.）。`palette/`：1つのUI部品。
*   `io/`：作業データ形式の変換（`DocumentSerializer`）、IndexedDBへの読み書き（`CanvasStorage`）、作業データファイル・スプライトのJSのブラウザ内での読み書き（`DocumentFileIO`）、スプライト（書き出し形式）の組み立て（`SpriteSerializer`）とスプライトJSのテキストの組み立てと実行しない取り出し（`CodeExporter`）、開く・インポートで選ばれたファイルの中身の判別と作業データの取り出し（`FileContentReader`）のみ。
*   `check/`：確認用ページ（`sprite-check.html`）専用。DOM・選んだJSの実行・描画を含む。importは`check/`内と`io/`の`SpriteSerializer`のみ。`main.js`・`edit/`・`palette/`・`core/`の状態を持つモジュールをimportせず、`js/`の他のモジュール・`index.html`は`check/`をimportしない。
*   `edit/`：`io/`・`core/`の機能（結合の手順`PathJoiner`と吸い付きの手順`EndpointSnapper`のみ`shapes/`の規則も）を組み合わせて図形一式を扱う手順（貼り付け・複製、履歴のスナップショットの取得・適用、キャンバス一覧の管理、ファイル操作の組み立て、パスの結合、端点への吸い付きと描き足し）。操作モードを知らない。操作モードに依存する判定・処理は`shouldRestoreSelection`・`prepareSwitch`・`prepareInsert`のような中立な注入関数で受け取る。
*   `test/`：自動テスト。Node.jsはテストの実行（`node --test`）にのみ使い、エディタのビルド・配信には使わない。依存は`test/ → js/`の一方向で、`index.html`・`js/`は`test/`を参照しない。規則は4章`test/`。
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`edit/PathJoiner`は例外として`shapes/PathJoinRules`を、`edit/EndpointSnapper`は例外として`shapes/EndpointSnapRules`・`shapes/PathJoinRules`をimportする（下向き。`edit/`の他のクラスは`shapes/`をimportしない）。`shapes/EndpointSnapRules`は`shapes/PathJoinRules`をimportする（`shapes/`内。`PathJoinRules`は`Path`のみimportするため循環しない）。`core/InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドを呼ぶだけ（`editRecorder`と同じ形）。`check/ → io`（確認用ページ専用。エディタ本体の依存の列とは独立）。

---

### 2. データ構造（Model）の概要
*   **図形（Shape）**：`shapes/`の図形クラスのインスタンス。
    *   共通プロパティ：`type`（`ShapeFactory`が受理する文字列と一致）・`id`（`VectorModel`が採番）・`strokeColor`・`strokeWidth`。
    *   頂点の保持形式は図形クラスごとに異なる（`Line`は`x1, y1, x2, y2`、`Curve`/`Rect`/`Ellipse`/`Path`は`points`配列（`Path`は頂点数が可変で、`closed`・`segments`も持つ）。4章`shapes/`）。
    *   塗りつぶしの共通プロパティは未定義。
*   **図形データ**（1図形のJSON表現）：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`を共通の項目とし、種別により項目を足す（`path`）。
    *   **`path`**：`{ type: 'path', id, points, closed, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth }`（キー順）。`closed`は真偽値のみ。
        *   区間の約束：`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`。要素数は開いた`n - 1`・閉じた`n`。`kind`は現在`'line'`のみ。曲線の区間は`kind`の値と区間の要素のキーを足して拡張する。区間の要素の余分なキーは無視する。
        *   頂点数の下限は開いた2・閉じた3、上限なし。長さ0の区間は可。
        *   パスの追加では作業データの版を上げていない（古いエディタでは未知の図形種別として図形単位でスキップされる。発注者の決定）。
    *   各図形クラスの`toJSON()`/`static fromJSON(data)`で相互変換する。
    *   `Line`も`points`2点＝[始点, 終点]で表す。`points`の並びは各図形クラスの頂点の並びと同じ。
    *   `fromJSON`直後の`id`は未検証・未正規化（欠落なら`undefined`、任意の型を取り得る）。`VectorModel.replaceAllShapes`の正規化を経て初めて一意な文字列になる。
*   **作業データ形式**（キャンバス全体の版番号付きJSON表現）：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）。
    *   変換は`io/DocumentSerializer.js`が担う。
    *   保存対象は図形データのみ。選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示・ビュー変換は含めない。
    *   図形クラスは常に現行版の図形データのみを扱う。旧版の知識は`DocumentSerializer`のマイグレーション表に閉じる。
*   **作業データファイル**：作業データ形式のJSON文字列を内容とするファイル（既定の拡張子`.ozve.json`。読み込みは従来の`.json`も可）。キャンバス名は内容に含まれない。ファイル名との変換は`io/DocumentFileIO`が担う（3章9.。規則は下記「ファイル名の規則」）。
*   **スプライト（書き出し形式）**：開いているキャンバスをゲームが`import`して描けるようにしたもの。`<名前>.js`（ESモジュール）だけ（スプライトのJSONは出力も読み込みもしない。Phase 04-04でやめた）。既定のexportにスプライトデータの全キーと`draw(ctx)`を持つ。組み立ては`io/SpriteSerializer`（データ・JSに埋め込むJSON文字列）と`io/CodeExporter`（JSのテキスト）が担う。本項がスプライトの形の唯一の記載箇所（他の箇所はここを参照する）。
    *   **エンジン（OZ Engine、`D:\ozlab\ozengine-web`）との約束**：(a) エンジンの`PROJECT_ARCHITECTURE.md` 2.1章は、本項を書き出し形式の唯一の定義として参照している。(b) エンジンが読むのは既定のexportの`draw(ctx)`だけ（`format`・`formatVersion`・`bounds`・`elements`・`source`は現在エンジンでは読んでいない）。エンジンは`import sprite from '…'`と既定のimportで受け取り、位置・回転を`ctx`に設定してから`draw(ctx)`だけを呼ぶ。(c) 書き出し形式の版（`formatVersion`）を上げるとき、JSのexportの形や`draw`の約束を変えるときは、エンジンへ連絡票を出す。
    *   **スプライトデータ（書き出し形式の版1）**：`{ format: "oz-vector-editor-sprite", formatVersion: 1, bounds: {minX, minY, maxX, maxY} | null, elements: [描画要素, ...], source: 作業データ }`。キーはこの順で出力するが、読む側はキーの順に依存しないこと。
        *   `source`：`DocumentSerializer.serialize`の戻り値そのもの（作業データ形式。`source.version`は作業データの版）。`DocumentSerializer.deserialize`で元の図形に戻せる。JSの中に`elements`と`source`の両方を持つため図形の情報を2重に持つ（薄い書き出しとして許容）。
        *   含めないもの：スプライトごとの変わらないID、キャンバス名、作成日時（参照はファイル名で行う）。
        *   単位はpx、角度はラジアン。基準点はワールド座標の原点(0, 0)、y軸は下向き。エディタのワールド座標をそのまま使い、平行移動・拡大・丸めをしない。
    *   **描画要素**（`elements`の1要素＝図形1つ。描画順＝`model.getShapes()`の並び。`id`は図形の`id`そのまま、頂点は作業データの`points`の並び順のまま。回転のキーは持たない）。図形クラスの`toDrawElement()`が作る。共通のキーは`kind`・`id`・`strokeColor`・`strokeWidth`。
        *   `"polyline"`（`line`・`rect`・`path`）：`kind, id, points: [{x, y}, ...], closed, strokeColor, strokeWidth`。`line`は`closed: false`・2点、`rect`は`closed: true`・4点、`path`は`closed`のとおり・全頂点（閉じたパスも始点を重複させない）。区間の種類は描画要素に出さない（区間がすべて直線の間のみ`polyline`で表せる）。`beginPath` → `moveTo(points[0])` → `lineTo`（i=1…）→ `closed`なら`closePath`。
        *   `"quadratic"`（`curve`）：`kind, id, points: [始点, 制御点, 終点], strokeColor, strokeWidth`。`beginPath` → `moveTo` → `quadraticCurveTo(制御点, 終点)`。
        *   `"ellipse"`（`circle`・`arc`）：`kind, id, x, y, radiusX, radiusY, startAngle, endAngle, closed, strokeColor, strokeWidth`。`ellipse(x, y, radiusX, radiusY, 0, startAngle, endAngle)`（回転は常に0）→ `closed`なら`closePath`。`circle`は`closed: true`・0〜2π、`arc`は`closed: false`・π〜2π。値は`Ellipse.draw`と同じ式（読む側は`Ellipse`の`points`の約束を知らなくてよい）。
        *   どの`kind`もパスの後に`strokeStyle` → `lineWidth` → `stroke()`（エディタの各図形の`draw`と同じ順・同じ命令）。
    *   **読む側の規則**（着色・パス等のPhaseで項目を足しても既存の項目の意味を変えないための規則。書き出したJSの`draw`もこれに従う）：
        *   未知のキー（最上位・描画要素とも）は無視する。未知の`kind`の要素は描かない。
        *   `strokeWidth`が正の有限の数値でない（キーが無い・`undefined`を含む）要素は線の太さ2pxとして扱う（描画・外枠とも。`DEFAULT_STROKE_WIDTH`の唯一の定義箇所は`SpriteSerializer.js`）。
        *   `strokeColor`が文字列でない要素は**線を描かない**（線のパスと`strokeStyle`・`lineWidth`・`stroke()`を呼ばない）。これは線についての規則であり、要素を捨てる規則ではない。版1は線のみのため結果として何も呼ばれない。着色のPhaseで塗り等を足すときの塗りの扱いはこの規則に縛られず、足す項目の側で決める。
        *   形の項目が足りない要素は描かない：`polyline`は`points`が2点以上、`quadratic`は3点以上、`ellipse`は`radiusX`・`radiusY`が0以上の数値（`NaN`不可）。
    *   **2つの版**：書き出し形式の版は`formatVersion`（唯一の定義箇所は`SpriteSerializer.js`）、作業データの版は`source.version`（`DocumentSerializer`）。最上位に`version`キーは置かない。書き出し形式の版は、エンジンが読む部分（`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったとき（項目の追加で、古い読み手が未知の項目として無視すると正しく描けなくなる場合を含む）に上げる。作業データの版（`source.version`）は、作業データの保存形式が変わったとき（`DocumentSerializer`の`MIGRATIONS`へ関数を足すとき）に上げる。作業データだけ版が上がっても書き出し形式の版は上げなくてよい。
    *   **識別子**：`format: "oz-vector-editor-sprite"`（作業データの`"oz-vector-editor"`とは別の値）。本アプリが書き出したものかを見分ける手がかり（エディタの「開く」「インポート」ではJSに埋め込まれたデータ、確認用ページではJSの既定のexport）。判別は`SpriteSerializer.checkFormat`（`'supported'`・`'notSprite'`・`'unsupportedVersion'`）が唯一の入口。
    *   **エディタで開くときの規則**（入口は`io/FileContentReader.deserializeFromText`。エディタの「開く」「インポート」の読み込みはすべてここを通る）：
        *   中身で判定する（拡張子に頼らない）。`JSON.parse`できればJSONとして**作業データとしてのみ**扱い、そのまま`DocumentSerializer.deserialize`へ渡す（スプライトのJSONは`format`の不一致で読み込み不可。Phase 04-04で読まなくなった：`.json`＝作業データファイル、`.js`＝スプライト。`DocumentSerializer`はスプライトの識別子を知らずに落とす）。できなければ本アプリのJSの形からスプライトデータのJSONを取り出す。
        *   取り出したデータの`format`が`"oz-vector-editor-sprite"`なら`source`だけを使い（JSのみ）、作業データファイルと同じ`DocumentSerializer.deserialize`へ渡す（旧版の変換・図形単位のスキップ・`CanvasFileOperations`の判定の表も同じ。`elements`・`bounds`は使わない）。
        *   JSは実行しない。`CodeExporter.extractSpriteDataText`がテキストから取り出す（取り出しの知識は組み立てと同じ`CodeExporter`。`CRLF`も可）。
        *   受け付ける書き出し形式の版は1以上・現行版以下の整数。
        *   読み込み不可（通知`readFailed`）：`format`が違うJSに埋め込まれたデータ・`source`が無い・版が範囲外・取り出しや解析の失敗・スプライトのJSON（上の規則により作業データとして判定され、`format`の不一致で`DocumentSerializer`が全体失敗にする）。
        *   本アプリが書き出した形から外れたJS（手で整形し直したもの等）は取り出せず読み込み不可になる（許容）。
    *   **外枠`bounds`**：ワールド座標の最小・最大（`minX ≤ maxX`・`minY ≤ maxY`。幅・高さは読む側で引き算する）。図形0個のとき`null`（0×0の原点の点にするとアニメーションエディタモードで外枠の和を取るとき原点が誤って含まれるため）。読む側は`null`を確かめること。外枠は書き出し時にエディタが計算した値であり、読む側は再計算しない。
        *   求め方：描画要素ごとの形の範囲（中心線の外接矩形）を線の太さの半分（太さが不正なら2pxの半分）だけ四方へ広げ、全要素の和を取る。`polyline`は全頂点、`quadratic`は端点と各軸の極値（制御点は含めない）、`ellipse`は弧の両端と軸上の端点（`closed`の弦は影響しない）。未知の`kind`は`Error`をthrowする。
        *   近似：鋭い角の継ぎ目（`miter`）の尖りは考慮しない（はみ出すことがある）。線の端・長さ0の線も太さの半分を広げるため実際より大きくなることがある（保守的な値）。弧の両端は三角関数の誤差（1e-15程度）を含む。
    *   **JSに埋め込むデータの文字列の形**：`JSON.stringify(data, null, 2)`（`SpriteSerializer.stringify`。JSの中の`const spriteData = <JSON>;`の`<JSON>`。字下げ2。最小化しない。関数は含まない）。
    *   **JSの形**（`CodeExporter.toModuleText`）：`import`文を含まず単体で`import`できる。固定の説明コメント → `const spriteData = <JSON>;` → `const DEFAULT_STROKE_WIDTH = 2;` → `function draw(ctx)`・`function drawElement(ctx, element)` → `export default { ...spriteData, draw };`。**既定のexportのみ**（名前付きexportなし。`import body from './body.js'`と`import`する側が名前を付けるため衝突しない）。値はスプライトデータの全キーと`draw`。`draw`は`this`を使わず、`const { draw } = body`と取り出しても動く。スプライトデータはJSONのまま式として埋め込む（ES2019以降が前提。キーは本アプリが組み立てる固定のもの。利用者の入力を含む値はJSONの文字列としてのみ埋め込まれ、コードとして解釈されない）。
        *   `draw(ctx)`：`ctx.save()` → `try { 明示設定 → 各要素を順に描く } finally { ctx.restore() }`。明示する設定は`lineCap='butt'` → `lineJoin='miter'` → `miterLimit=10` → `setLineDash([])`（エディタの図形の線が既定値で描かれているため、ゲーム側の`ctx`の値に左右されないよう明示する）。
        *   明示しないもの：`globalAlpha`・`globalCompositeOperation`・影・`filter`・変換。ゲーム側が意図して使う合成・効果と配置であり、`ctx`の現在の変換の上に描く要件のため。配置は`ctx`の変換で行う。
        *   図形0個：`draw`は`save`・設定の明示・`restore`のみで、パスも`stroke`も呼ばない。JSを図形があるときと同じく1つダウンロードし、専用の通知は出さない。
        *   組み立て用のJSからの使い方の例（アニメーションエディタモードのPhaseで書き出す想定。名前の頭に`_`を付ける。配置は`ctx`の変換）：
            ```js
            // _hero.js
            import body from './body.js';
            import head from './head.js';
            export default {
                draw(ctx) {
                    body.draw(ctx);              // 原点(0, 0)を基準に描く
                    ctx.save();
                    ctx.translate(0, -40);
                    head.draw(ctx);
                    ctx.restore();
                }
            };
            ```
*   **ファイル名の規則**（唯一の定義箇所は`io/DocumentFileIO`。`CanvasFileOperations`はキャンバス名を渡すだけで拡張子・MIMEタイプを知らない）：
    *   共通の手順：使えない文字（`\ / : * ? " < > |`と制御文字）を`_`へ置換 → 前後の空白を除く → 末尾のピリオドと空白を除く → 空なら`無題`。
    *   作業データファイル：`<名前>.ozve.json`（先頭の`_`は除かない）。開くときは末尾の`.ozve.json`・`.json`・`.js`のいずれかを**1回だけ**除く（大文字小文字を区別しない。`ship.js` → `ship`、`a.js.ozve.json` → `a.js`、`a.json.js` → `a.json`）ため、キャンバス名がどのような拡張子らしい文字列で終わっても作業データファイルの往復で変わらない（`a.json` → `a.json.ozve.json` → `a.json`。`.ozve.json`が末尾にあるため`.js`の分岐は当たらない）。従来の`ship.json`も読め、名前は`ship`になる。末尾のピリオド・使えない文字を含む名前は従来どおり往復で変わる。
    *   スプライト：`<名前>.js`。共通の手順に加え、使えない文字の置換の後に先頭の`_`と空白をすべて除く（`_hero` → `hero`、`___` → `無題`）。DIRの組み立て用のJSは名前の頭に`_`を付け、パーツのJSは付けないため。
*   **キャンバス**：名前を持ち、ブラウザ内に保存される1つの作品の単位。画面に開くキャンバスは常に1枚。
*   **キャンバス記録**（キャンバスの保存単位）：`{ id, name, updatedAt, document }`（typedef`CanvasRecord`は`io/CanvasStorage.js`）。
    *   `id`：形式`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`。採番と形式の知識は`CanvasLibrary`に閉じ、他のモジュールは解釈しない。図形のid`shape-<連番>`とは別体系。
    *   `name`：前後の空白を除いた1〜100文字。重複は許す。
    *   `updatedAt`：`Date.now()`のミリ秒。名前の変更では更新しない。
    *   `document`：作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）。保存処理・キャンバス一覧の管理とも中身を解釈しない。読み込みは`DocumentSerializer.deserialize`を通す。
    *   保存しないもの：Undo/Redoの履歴・選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示・ビュー変換・クリップボード・操作モード。
*   **保存先**：IndexedDB。設定は`CanvasStorage.js`の`STORAGE_CONFIG`が唯一の定義箇所。ストアはキャンバス記録と、「最後に開いていたキャンバスの識別子」を保持するメタ情報の2つ。
    *   オリジン単位のため、`file://`で開いた場合とローカルサーバー経由で開いた場合、ポート番号が違う場合は別のキャンバス一覧になる。
    *   複数タブで同時に開いた場合の整合は扱わない（後から書き込んだ側が残る）。
*   **座標**：図形の座標はすべてワールド座標。ビュー変換（表示倍率・オフセット）は図形データに含まれず、表示専用の状態として`core/ViewTransform.js`が保持する。パン・ズームで図形データは書き換わらない。
*   **選択状態**：`core/VectorModel.js`が保持する。
    *   **選択集合**：選択中の図形idの集合。0個以上で、常に現存図形のidのみを含む。選択モード以外では空（不変条件）。
    *   **選択矩形**：範囲選択中の表示用。ワールド座標の対角2点（押下点と現在のカーソル位置）。正規化しない。
*   **吸い付きの表示の点**：`core/VectorModel.js`が保持するワールド座標の1点（`null`＝表示なし）。表示専用で、保存対象外・履歴の対象外。`InputTracker`が設定・消去する（3章12.）。

---

### 3. 描画・操作フロー（実行サイクル）
**同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、モードと図形種別は`applyMode`・`applyShapeType`）のみで行う。機能専用の再描画・同期処理を足さない。

1.  **起動処理 (`main.js`)**：DOMの読み込み完了後、インスタンス化・依存の注入・イベントバインドを行う（配線は4章`main.js`）。URLに`?dev`があるときのみ`DevPanel`も生成・表示する。
    *   **キャンバスの非同期の読み込み**：初期化の最後に`canvasLibrary.start()`を呼ぶ（`await`しない）。起動直後は空のキャンバスで描画され、読み込み完了時に切り替え処理（8.）で図形一式が入る（倍率100%・選択モード・履歴は空）。
    *   **開くキャンバスの決定**：候補は「最後に開いていたキャンバス（一覧にあれば）→ 残りを最終更新日時の新しい順」。先頭から読み込みを試し、全体として読めた最初の1枚を開く。読めない記録は一覧に残し、保存先からも消さない。形式不正の記録（`id`・`name`・`updatedAt`の型が違う）は一覧から除外し、保存先からは消さない。候補が無い・すべて読めない場合は新しい空のキャンバスを作成して開く（初回起動を含む）。
    *   **保存先を利用できない場合**：保存先へ一切書き込まず、メモリ上だけの空のキャンバス「無題 1」を開く（`'unavailable'`。8.）。
    *   **読み込み完了前の操作**：`index.html`で表示状態から始まる覆い要素`#canvas-loading-cover`がキャンバスへのマウス入力を遮る（読み込み完了時の切り替えで利用者の操作が消されたり別のキャンバスに保存されたりしないため）。キーボードショートカットとフロートウィンドウ上のボタンは働く。読み込み中は図形0個・クリップボード空・履歴空のため図形一式を変えない（結合も、図形0個・選択集合が空のため何もしない。専用の判定は無い）。唯一図形一式を変え得る`?dev`の「復元」は読み込み中は受理しない。`CanvasLibrary`も読み込み中の開く・新規作成等を受理しない。図形一式を変える操作を新しく足す場合は読み込み中の扱いが要る。
2.  **描画サイクル (`CanvasManager.js`)**：常時ループ（rAF）は持たない。`VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から同一関数`renderCurrentState()`（`main.js`）で同期的に再描画する。描画順は4章`CanvasManager.js`。
3.  **入力監視 (`InputTracker.js`・`KeyboardShortcuts.js` → `VectorModel.js`)**：状態が更新されると`VectorModel`が更新イベントを発火し、再描画を促す。
    *   **端点への吸い付き**：直線を描くとき、および選択モードで線の端点のハンドルをドラッグするときの吸い付きは12.。
    *   **ドラッグのライフサイクル**：左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）とパンの、押下から解放まで（開始ボタン・移動量閾値・追従/終了検知・中断・終了直後のclick抑止）は`DragTracker`が`window`へのcapture購読で一元管理する。ドラッグの意味の解釈（パン量・頂点変形・選択集合の平行移動・範囲選択）は`InputTracker`が行う。閾値判定のみスクリーン座標で行い、当たり判定・移動量・選択矩形はワールド座標で扱う。
    *   **範囲選択の流れ**：選択モードで空白を左ボタンで押下 → 閾値超過後、押下点と現在のカーソル位置で`VectorModel`の選択矩形を更新（描画は`CanvasManager`）→ 解放時に矩形を正規化し、各図形の`intersectsRect`をポリモーフィックに呼んで掛かった図形で選択集合を置き換え、選択矩形を破棄する（0件なら全解除）。中断（blur・モード切替）時は選択矩形を破棄するのみで確定しない。
    *   **キーボード操作**：`document`の`keydown`は、`Space`を`InputTracker`（スペースパン）、それ以外のキーを`KeyboardShortcuts`が排他的に担当する（同一キーを二重に解釈しない）。`keyup`は`Space`のみ`InputTracker`が購読する。操作の実体は`main.js`から注入されたコールバック（`applyMode`/`applyShapeType`/`viewTransform`/`InputTracker`の公開メソッド/`performUndo`・`performRedo`/`ClipboardController`の`copy`・`cut`・`paste`・`duplicate`/`performJoin`）で実行する。
4.  **座標系とビュー変換 (`ViewTransform.js`)**：図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼ぶ。`スクリーン = ワールド × 倍率 ＋ オフセット`。
    *   **入力**：`InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す。パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す。
    *   **描画**：`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎回設定する。
5.  **作業データの変換・`?dev`の復元 (`DocumentSerializer.js` ⇔ `VectorModel.js`)**
    *   **変換**：`DocumentSerializer`が各図形の`toJSON()`から作業データを組み立てる。
    *   **図形インスタンスの生成**：`DocumentSerializer`のデシリアライズ（`ShapeFactory.fromJSON`→各図形クラスの`fromJSON`）。
    *   **`?dev`の「JSONから復元」の順序**：成功時のみ`InputTracker.abortOngoingOperation()` → `HistoryManager.beginEdit()` → `VectorModel.replaceAllShapes(shapes)` → `HistoryManager.commitEdit()`。中断を先に行うのは、ドラッグ中だった場合にその中断分を先に1件確定させるため。全体の読み込みに失敗したらキャンバスを変更せず、履歴にも記録しない。
    *   この順序は`?dev`の復元専用。キャンバスの切り替えは8.（履歴を消す）、貼り付け等は`ShapeInserter.insertDocument`（7.）を通る。
6.  **履歴（取り消し・やり直し） (`InputTracker.js`・`edit/ShapeInserter.js`・`main.js` → `HistoryManager.js`)**：編集操作（図形一式を変化させる利用者の1回の操作）の前後の図形一式を丸ごと記録するスナップショット方式。スナップショットは`{ document: 作業データ, selectedIds: 選択集合 }`。取得・適用の実体は`edit/SnapshotAdapter`（`HistoryManager`へ`capture`/`restore`として注入）。
    *   **記録の規則**：変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録はしない。後続の編集操作も挟むだけで履歴の対象になる。前後の作業データ部分の`JSON.stringify`が一致する場合（閾値以内のクリック・元の位置へ戻したドラッグ等）は記録せず、やり直しの履歴も破棄しない（選択集合は比較しない）。
    *   **記録する操作と時点**：
        *   図形の作成：`InputTracker.handleClick`の`DRAWING`確定時、`model.commitDraft()`の前後。直線の描き終えで吸い付いていた場合は`EndpointSnapper.commitDrawnLine`で、`model.replaceShape`の前後（何も起きない場合は記録しない。12.）。
        *   削除（削除ボタン・`Delete`/`Backspace`）と切り取り（`Ctrl`+`X`）：`InputTracker.deleteSelection()`の受理時、`model.deleteShapes(ids)`の前後。
        *   本体ドラッグ・moveハンドルによる移動、ハンドルによる変形：閾値超過時に開始し、ドラッグの終了・中断の共通後始末で確定。中断（`blur`・モード切替・`abortOngoingOperation()`）で残った変化も1件として記録する（記録しないと次の編集操作の前の状態に混ざり、単独で取り消せなくなるため）。端点のハンドルを吸い付いた状態で離した場合の結合・閉じるは、同じ1件の中で`#finishLeftDrag`の確定の前に行う（12.）。
        *   `?dev`の「JSONから復元」：5.の順序。
        *   結合（結合ボタン・`J`）：`PathJoiner.join`で、`model.replaceShape`の前後。結合できない選択では記録しない（11.）。
        *   貼り付け・複製（`Ctrl`+`V`／`Ctrl`+`D`）・インポート：`ShapeInserter.insertDocument`で、`model.addShapesWithNewIds(shapes)`の前後。追加0件では記録しない。
    *   **記録しない操作**：範囲選択・クリック選択・全選択・選択解除・ホバー・パン・ズーム・ビューのリセット・操作モード/図形種別の切り替え、作成途中の図形の開始・破棄、コピー、出力（作業ファイル・エンジン用）、開く（ファイル）・キャンバスの切り替え。
    *   **適用の流れ**：ショートカット（`Ctrl`+`Z`／`Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`）とボタン（`#history-undo`／`#history-redo`）は、どちらも`main.js`の`performUndo()`／`performRedo()`を呼ぶ（`historyManager.undo()`/`redo()`を直接呼ばない）。
        1.  ドラッグ中（`inputTracker.isDragging()`）なら不受理。
        2.  `inputTracker.abortOngoingOperation()`。取り消しは、作成途中の図形を破棄した場合はそこで終了し履歴を変化させない。やり直しは破棄したうえで続行する。
        3.  `HistoryManager.undo()`／`redo()` → 注入された`restore`＝`SnapshotAdapter.restore(snapshot)`。
        4.  `DocumentSerializer.deserialize`。失敗・スキップ1件以上なら`console.warn`してキャンバスを変更せず、履歴の位置も動かさない。
        5.  `model.replaceAllShapes`。
        6.  注入関数`shouldRestoreSelection()`が真（実体は`main.js`の「選択モードのときのみ」）のときのみ`model.setSelection(snapshot.selectedIds)`。
    *   **戻り値**：ドラッグ中でなければ、履歴がなくても受理（`true`）を返し、ブラウザ標準の動作を抑止する。
    *   **適用後の選択集合**：記録時点のもの（前の状態＝操作開始時、後の状態＝操作完了時。選択モード以外では空）。
    *   **適用時の通知**：`model.onChange`（選択モードでは2回、それ以外では1回）→`historyManager.onChange`（1回）。
    *   **履歴のリセット**：`HistoryManager.clear()`の呼び出し元は`CanvasLibrary`の切り替え処理（8.）のみ。キャンバスを開く・開く（ファイル）・新規作成・削除後の切り替え・起動時の復元で履歴を空にする。切り替えそのものは編集操作として記録しない（`beginEdit`/`commitEdit`を呼ばない）。
7.  **コピー・貼り付け・複製 (`KeyboardShortcuts.js` → `main.js` → `ClipboardController.js` → `ShapeInserter.js` → `VectorModel.js`)**：`Ctrl`+`C`／`X`／`V`／`D`で操作する（ボタンはない）。段数・ずらし量の規則は`ClipboardController`のクラスJSDoc。
    *   **クリップボード**：アプリ内部（メモリ上）。OSのクリップボードは使わない。作業データ形式で保持するため図形インスタンスを参照しない。履歴の対象外。インスタンスは`main.js`が1つだけ生成し、キャンバスを切り替えても消えない（ページの再読み込みで空になる）。
    *   **コピー・切り取り**：選択集合の図形を描画順で`serialize`して記録する。切り取りは先に`serialize`したうえで唯一の削除経路`InputTracker.deleteSelection()`（`main.js`が注入）を呼び、受理された場合のみクリップボードを置き換える。選択集合が空（選択モード以外を含む）なら何もせず`false`を返し、`preventDefault()`しない（ページ上の文字の標準のコピーを妨げないため）。
    *   **貼り付け・複製**：貼り付けはクリップボードの内容を、複製は選択集合の図形を`serialize`した作業データを（クリップボードを経由せず）、`ShapeInserter.insertDocument`へ渡す。追加した図形は毎回新しいインスタンス・新しいidで最前面へ追加され、追加した図形だけが選択される。
    *   **選択モード以外での貼り付け**：`main.js`の`paste`コールバックは、クリップボードが空なら何もしない（モードも切り替えない）。空でなければ、選択モード以外のとき先に`applyMode(OperationMode.SELECT)`で切り替えてから貼り付ける（作成途中の図形は`setMode`の強制中断で破棄される）。
    *   **`insertDocument`の前提**：進行中の入力操作の中断・モード切り替えは行わない（呼び出し側の責務）。
8.  **キャンバス管理（自動保存・切り替え） (`CanvasPalette.js` → `main.js` → `CanvasLibrary.js` → `CanvasStorage.js`・`DocumentSerializer.js`・`VectorModel.js`・`HistoryManager.js`)**：受理判定と処理本体は`CanvasLibrary`が担う。細則の正本は`CanvasLibrary`のクラスJSDoc（手順・`#isSwitching`・削除・直列化・`Promise`・`issue`の種類と解除条件）。本節は主にモジュールをまたぐ流れを書く。
    *   **表示の同期**：開いているキャンバスの名前の表示・ページのタイトル・覆い要素は`canvasLibrary.onChange`の通知で`canvasLibrary.getState()`から同期する。パレットの一覧は`canvasFileOperations.onChange`（`canvasLibrary.onChange`の転送を含む1経路）で`canvasFileOperations.getState()`から同期する。
    *   **自動保存**：
        *   契機は`historyManager.onChange`のみ（`model.onChange`は使わない）。選択の変更・ホバー・パン・ズーム・作成途中の図形の開始/破棄・ドラッグ中の途中経過では保存しない。
        *   通知のたびに待ち時間を張り直し、最後の通知から待ち時間後に1回、開いているキャンバスの記録全体を書き込む。
        *   予約しないのは、開いているキャンバスが無い（読み込み完了前）・`'unavailable'`・`#isSwitching`のとき。
        *   保存の作業データは書き込みの呼び出し時点で同期的に取得する。予約時点のキャンバスと開いているキャンバスが一致する場合のみ、そのキャンバスの記録へ書く。
    *   **ページ非表示時の確定**：`main.js`が`document`の`visibilitychange`（`hidden`のとき）と`window`の`pagehide`で`canvasLibrary.flushPendingSave()`を呼ぶ（`CanvasLibrary`自体は`document`・`window`のイベントを購読しない）。作業データの取得と書き込みの開始はハンドラ内で同期的に行われる。
    *   **保存に失敗した変更**：利用者が明示的に捨てない限り失わない（発注者の決定）。
        *   失敗した変更は保留のまま残り、次の編集・切り替え・ページ非表示時に書き込みを再試行する。タイマーでの自動再試行はしない。
        *   失敗する限り、開く・開く（ファイル）・新規作成は切り替えを中止する。変更を捨てて移るための確認の小窓は無い（発注者の決定）。逃げ道は出力（作業ファイル）、再読み込み・タブを閉じるときのブラウザの確認、開いているキャンバスの削除（確認の小窓が明示的に捨てる操作に当たる）。
        *   再読み込み・タブを閉じるとき：`main.js`が`window`の`beforeunload`で`canvasLibrary.hasUnsavedChanges()`が真なら`preventDefault()`する。
        *   新規作成・開く（ファイル）で新しい記録を書けないとき：`CanvasLibrary` → 注入された`confirmOpenUnsaved`（実体`canvasPalette.confirmOpenUnsaved()`。文言と`window.confirm`はパレット）で確認する。「いいえ」は作らず今のキャンバスのまま（ファイルの中身はファイルに残る）。「はい」は記録の無いまま開き、保存できるまで別のキャンバスへは移れない。起動時・削除後は開く先が他に無いため確認せずに開く。
    *   **切り替え処理の順序**：開く・開く（ファイル）・新規作成・開いているキャンバスの削除後の切り替え・起動時の復元が共通して通る。手順の番号と細則はクラスJSDoc「■ 切り替え処理」。起動時の復元・削除後の切り替えは読み込みから入り、確定手順を通らない。
        *   モジュールをまたぐ順序：`prepareSwitch()`（実体`applyMode(OperationMode.SELECT)`）→ 切り替え前の保存の確定（`flushPendingSave()`）→ 切り替え先の読み込み（`CanvasStorage`・`DocumentSerializer`）→ もう一度`prepareSwitch()`のうえ保留・書き込み中の保存が無くなるまで確定（確定手順）→ `await`を挟まずに`model.replaceAllShapes` → `historyManager.clear()` → `resetView()` → 開いているキャンバスの更新と変更通知。
        *   中止しても最初の`prepareSwitch()`の副作用は残る（選択モードへの切り替え・選択解除・作成途中の図形の破棄）。
        *   クリップボードには触れない。
    *   **非同期保存と切り替えの順序の保証**：次の3点により、切り替え前のキャンバスの記録を切り替え後の内容で上書きすることも、切り替え後のキャンバスの記録へ切り替え前の内容を書くことも起きない。
        *   `CanvasStorage`はすべての書き込みのトランザクションを呼び出し時点で同期的に生成し、IndexedDBはそれを生成順に実行するため、書き込みは呼び出し順に反映される。
        *   切り替え前の保存の確定と確定手順で、図形一式の入れ替え前に保留中の保存を確定する。
        *   保存の作業データの同期取得と、予約時点のキャンバスとの一致の確認（上記「自動保存」）。
    *   **名前の変更**：一覧の任意のキャンバスが対象。保存先へは名前のみを書き、最終更新日時は更新しない（一覧の並びが入れ替わると押そうとした行が動いて紛らわしいため）。
    *   **削除**：一覧の任意のキャンバスが対象（確認の小窓は`CanvasPalette`）。
        *   開いていないキャンバス：開いているキャンバス・図形一式・履歴・自動保存に触れない。
        *   開いているキャンバス：進行中の入力操作の中断 → 保留中の保存の破棄（確定しない）→ 予約の停止（`#isSwitching`）→ 記録の削除。成功したら残りを最終更新日時の新しい順に試して開く（無ければ新しい空のキャンバス）。失敗したら中止して開いているキャンバスのままとし、自動保存を予約し直す。
        *   記録の削除に成功してから切り替えが完了するまでは、`openCanvasName`が`null`で、`openCanvasId`は一覧に無いidを指す。
    *   **処理中の直列化**：ファイルの読み取り中は`CanvasFileOperations`の処理中によりパレットの全操作が押せなくなる。処理中もキャンバスの編集は止めない（確定手順で整合を取る）。
    *   **保存・読み込みの問題（`issue`）**：アプリは停止せず、最後に起きた問題を1つだけ保持する。種類と解除条件はtypedef`CanvasIssue`。キャンバスパレットの文言（`CanvasPalette`の`ISSUE_MESSAGES`）と、保存の問題（`'unavailable'`・`'writeFailed'`）ではコントロールパネルのキャンバス名の先頭の`⚠ `で示す。`'unavailable'`でも出力（作業ファイル・エンジン用）・インポートは使える（インポートは履歴に記録されるが保存されない）。
9.  **ファイル入出力（出力（作業ファイル）・出力（エンジン用）・開く（ファイル）・インポート） (`CanvasPalette.js` → `main.js` → `CanvasFileOperations.js` → `DocumentFileIO.js`・`FileContentReader.js`・`DocumentSerializer.js`・`SpriteSerializer.js`・`CodeExporter.js`・`CanvasLibrary.js`・`ShapeInserter.js`・`VectorModel.js`)**：`CanvasFileOperations`（DOMに触れない）が手順の組み立てと通知の状態を担う。ブラウザAPI（`Blob`・`File`）は`DocumentFileIO`（`CanvasFileOperations`へ注入。作業データの中身は解釈しない）に閉じる。読み込みの判定の表・通知の解除条件の正本は`CanvasFileOperations`のクラスJSDoc。
    *   **用語**：**出力（作業ファイル）**（コード上は`exportCanvas`）＝開いているキャンバスを作業データファイルとしてダウンロードする。**出力（エンジン用）**（`exportSprite`）＝開いているキャンバスをスプライトのJS（`<名前>.js`）としてダウンロードする。**開く（ファイル）**＝ファイルを新しいキャンバスとして一覧へ登録し、開いているキャンバスと入れ替える（一覧の行を押す`openCanvas`とは別）。**インポート**＝ファイルの図形を開いているキャンバスへ追加する。
    *   **出力（作業ファイル）**：`serializeToString(model.getShapes())`を`DocumentFileIO.downloadText`へ渡す。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。
    *   **出力（エンジン用）**：形式を選ぶ小窓は出さない。受理条件・通知の消去は出力（作業ファイル）と同じ。`SpriteSerializer.serialize(model.getShapes())` → `CodeExporter.toModuleText`でJSのテキストを組み立て → `DocumentFileIO.downloadSpriteModule`の1回。組み立ての失敗ではダウンロードしない。失敗は通知`spriteExportFailed`。図形・選択集合・履歴・ビュー変換・操作モードに触れず、`beginEdit`/`commitEdit`も呼ばないため自動保存の契機にならない。成功時は通知を出さない。スプライトの形は2章「スプライト（書き出し形式）」。
    *   **開く（ファイル）**：読み取り → `FileContentReader.deserializeFromText`（作業データファイル・スプライトのJS。スプライトのJSONは読み込み不可。規則は2章「エディタで開くときの規則」）→ 判定 → 読めた場合のみ`CanvasLibrary.createCanvasFromShapes(toCanvasName(ファイル名), 読めた図形)`（切り替え処理をすべて通る。編集操作として記録しない）。`issue`は`'partialLoad'`にせず、一部が読めない旨は通知`partialRead`で示す。
    *   **インポート**：読み取り → `FileContentReader.deserializeFromText` → 判定 → キャンバスの同一性の確認（読み取り中に開いているキャンバスが変わっていない・読み込み中でない・処理中でない。`canvasLibrary.getState()`の値で判定する）→ `prepareInsert()`（実体`applyMode(OperationMode.SELECT)`）→ `ShapeInserter.insertDocument(serialize(読めた図形), 0, 0)`。読めた図形を`serialize`し直して渡すのは、`insertDocument`内の再`deserialize`でスキップの`console.warn`が重複しないため。失敗・図形0個では図形一式・選択集合・履歴・操作モード・作成途中の図形に一切触れない。
    *   **ファイル操作の通知**：`fileNotice`は`CanvasFileOperations`が1つだけ保持し、`getState()`でパレットへ渡す。`CanvasLibrary`の`issue`には種類を足さない（解除条件が異なるため）。互いに隠さず別々に表示する。
    *   **読み取り中**：`getState().busy`が真になり、パレットの全操作が押せなくなる。図形の編集（キャンバス操作・ショートカット）は止めない。
    *   **ファイル名とキャンバス名の変換**：`DocumentFileIO`が拡張子（作業データファイル`.ozve.json`・スプライト`.js`）と使えない文字・スプライトの先頭の`_`を扱う（規則は2章「ファイル名の規則」。開くときはスプライトの`.js`も除く）。長さの切り詰め・空の場合の「無題 n」は`CanvasLibrary`が名前の変更と同じ規則で行う。
    *   **旧版のファイル**：読み込みは必ず`FileContentReader.deserializeFromText`を通し、作業データ（スプライトの`source`を含む）は`DocumentSerializer.deserialize`で読む。`DocumentFileIO`・`CanvasFileOperations`・`CanvasLibrary`・`CanvasPalette`は版の知識もスプライト形式の知識も持たない。
10. **確認用ページ（`sprite-check.html`） (`SpriteCheckPage.js` → `SpriteCheckInspector.js`・`SpriteCheckCanvas.js`・`io/SpriteSerializer.js`（`SpriteCheckInspector`経由）)**：書き出したスプライトを、エディタの状態とは無関係に「読み込み→描画」で確かめる別ページ。`index.html`・`main.js`・`edit/`とは状態を共有しない。ページの役割・要素・注意点は`_doc/arch/17_sprite_check.md`。
    *   **流れ**：ファイル選択（1ファイル。選択直後に`input`の値を空に戻す）→ `File.text()` → `SpriteCheckInspector.parseText`でJSONかを中身で判定 → JSONなら`import`を試みず`notSprite`として表示／JSならテキストのままBlob URL（`type: 'text/javascript'`）の動的`import`（成否にかかわらず`finally`でURLを解放）→ 既定のexportを`inspectModuleExport`で判定 → `summarize`で要約 → 描画（背景 → 外枠 → 原点の印 → `draw`）と情報欄の表示。
    *   **選び直しの競合**：読み込みごとに連番を振り、`await`の後で連番が最新でなければ結果を捨てる（遅れて終わった前のファイルの結果で新しい表示を上書きしない）。
    *   **失敗時**：ページは止めず、前の表示（絵・外枠・情報欄）を消してファイル名と「読み込めませんでした：」＋理由を出す。理由の区分は`readFailed`・`notSprite`・`unsupportedVersion`・`importFailed`・`drawFailed`（文言の唯一の定義箇所は`SpriteCheckPage`。`notSprite`はJSONを選んだ場合も含む）。詳細は`console.warn`。
    *   **ウィンドウの大きさの変化**：`window`の`resize`で描画領域の大きさを合わせ、表示中のスプライトがあれば`draw`をもう一度呼んで描き直す（`draw`が例外を投げたら`drawFailed`として表示を消す）。

11. **結合（選択中の線の結合） (`index.html`の`#selection-join`・`KeyboardShortcuts.js` → `main.js` → `edit/PathJoiner.js` → `shapes/PathJoinRules.js`・`VectorModel.js`・`HistoryManager.js`)**：選択モードで選んだ線（直線・開いたパス）を結合する。開いたパス1本（頂点3つ以上）は閉じたパスになり、線2本は1本の開いたパスになる。
    *   **流れ**：ボタン`#selection-join`／キー`J` → `main.js`の`performJoin()`（ドラッグ中は不受理。ボタンとキーは`performJoin()`を呼ぶのみで`pathJoiner.join()`を直接呼ばない）→ `PathJoiner.join()` → `PathJoinRules.planJoin(重なり順の選択図形, 画面上5pxのワールド換算)` → `HistoryManager.beginEdit` → `model.replaceShape` → `commitEdit`。結合できない選択では何もせず記録しない。結合は1件の編集操作で、Undo1回・Redo1回で往復する（6.）。
    *   **押せる/押せないの同期**：`model.onChange`に登録した`syncJoinButtonState`が`PathJoiner.canJoin()`でボタンの`disabled`を更新する。`canJoin`は表示倍率を見ない（受理する選択かの判定のみ）。
    *   **発注者の決定**：
        *   基準の線A＝重なり順で奥の図形。結果の向き・色・太さはAのもの。
        *   2本の結合は、Aの位置に新しいidで結果を置き、Bを除く。閉じるは元のidと位置を保つ。
        *   端点が重なっている＝画面上5px以内（ちょうどを含む）。結合を行う時点の表示倍率でワールドの長さへ換算する（`main.js`が`screenLengthToWorld`を注入）。重なる端点は1つにまとめ、離れていればそのまま区間でつなぐ。
        *   結合後は結果の図形だけを選択する。
    *   **やらないこと**：自動で閉じない（2本の結合の結果の両端が重なっていても閉じない）、3本以上の結合、曲線・矩形・円・弧・閉じたパスの結合、閉じたパスを開く。
    *   **規則の詳細の正本**は`PathJoinRules.js`のJSDoc（端点の組の優先順・まとめ方の手順）。規則の関数は表示倍率を知らないため、`tolerance`は呼び出し側がワールドの長さへ換算して渡す。`InputTracker`の`hitTolerance`は同じ5pxだが別の定義。
    *   **端点を指定する入口（Phase 05-04）**：公開の`buildJoinedPathAt`（つなぐ端点を指定して結合）・`buildExtendedPath`（描き足し）・`canCloseByMergingEnds`（もう一方の端点へ重ねて閉じられるか）・`planDrawnLineJoin`（直線の描き終えの計画）・`planEndpointDragJoin`（ハンドルのドラッグの計画）を、`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`buildJoinedPath`・`buildClosedPath`と同じ規則・同じ組み立て関数で実装している（規則を二重に書かない）。
    *   **描き足しの規則**：元のid・色・太さ・重なり順の位置を保つ。元の線の向きを保つ（描いた線の向きは使わない）。足す頂点が端点と重なる（`tolerance`以内）場合は何も起きない。
    *   **吸い付きでの結合**：つなぐ端点は吸い付いた端点であり、いちばん近い端点の組ではない（`planJoin`の優先順とは別）。結果の扱い（基準の線A・向き・色・太さ・idの扱い）は選択の結合と同じ。

12. **端点への吸い付きと描き足し (`InputTracker.js` → `edit/EndpointSnapper.js` → `shapes/EndpointSnapRules.js`・`shapes/PathJoinRules.js`・`VectorModel.js`・`HistoryManager.js`、表示は`VectorModel`の吸い付きの表示の点 → `main.js`の`renderCurrentState` → `CanvasManager.js`)**：直線を描くとき、および選択モードで線の端点のハンドルをドラッグするとき、結合できる線の端点へ吸い付き、吸い付いた端点で描き足し・結合・閉じる操作を行う。吸い付いている端点には中を青で塗った正方形を表示する。
    *   **モジュールの分担**：規則＝`EndpointSnapRules`（対象・距離・候補の選び方）と`PathJoinRules`（結果の組み立て・計画）。手順＝`edit/EndpointSnapper`（照会とモデルへの反映）。配線＝`InputTracker`（注入された`EndpointSnapper`を呼ぶだけ。候補の探索・距離の判定・結果の組み立てを持たず、描く図形種別と端点のハンドルの判定も`EndpointSnapper`に委ねる）。表示の状態＝`VectorModel`の吸い付きの表示の点。描画＝`CanvasManager`（`render`の`snapPoint`）。
    *   **流れ（直線の描き始め）**：図形作成モード・IDLEのmousemoveで照会して表示 → クリックで描き始めるとき、クリック位置で照会した結果を保持して表示し、吸い付いていれば端点の座標から`startDraft`。
    *   **流れ（描いている途中）**：mousemoveごとに照会 → 保持（描き終えの端点）・表示 → 作成途中の終点を吸い付いた端点の座標（なければカーソル位置）に追従。
    *   **流れ（描き終え）**：`DRAWING`のクリックで`EndpointSnapper.commitDrawnLine(描き始めの結果, 描き終えの結果)`を呼ぶ。描き終えの端点は**直前のmousemoveの照会結果**を使う（クリック位置で取り直さない。従来も終点は直前のmousemoveの位置で確定しており、取り直すと吸い付きなしの直線の終点が変わるため）。両方`null`なら何もせず従来の確定（`commitDraft`）。それ以外は作成途中の直線を捨て、`beginEdit` → `model.replaceShape` → `commitEdit`（描き足し・結合・閉じる）。計画が何も起こさない場合（同じ端点・頂点2つの線の閉じる・足す頂点が端点と重なる）は記録せず作成途中の直線を捨てるだけ。
    *   **流れ（端点のハンドルのドラッグ）**：ドラッグ開始時に`resolveDragEndpoint`でドラッグ中の端点を解決（端点のハンドルでなければ`null`で吸い付かない）。更新のたびに`findDragSnap`（ドラッグ中の端点を除く）→ 表示 → 頂点を吸い付いた端点の座標へ`updateVertex`。閾値超過で移動した状態で離したとき、`#finishLeftDrag`の確定の前に`joinDraggedEndpoint`が`model.replaceShape`（`select: true`）で結合・閉じる。記録は移動と同じ1件（`beginEdit`/`commitEdit`は呼び出し側の移動の開始・確定）。結果だけが選択される。
    *   **発注者の決定**：
        *   吸い付く距離＝画面上8px（ちょうどを含む）。`main.js`が注入する`screenLengthToWorld`で表示倍率に応じてワールドの長さへ換算する。
        *   対象は結合できる線（直線・開いたパス）の端点だけ。候補の選び方は`findSnapTarget`のJSDocが正本。
        *   表示＝中を青で塗った8pxの正方形（画面上で一定）。
        *   ハンドルのドラッグで吸い付いて離すと結合・閉じる。閉じられない場合は自身のもう一方の端点に吸い付かない。頂点2つの線は閉じない。
        *   選択集合：作成モードでは`replaceShape`の`select: false`により空のまま。ドラッグでは結果だけを選択する。
    *   **表示を消す箇所**：`InputTracker`の`#resetSnapState()`（描き終え・`Esc`等の作成途中の破棄・図形種別の切り替え・中断（`abortOngoingOperation`。モードの切り替えを含む）・左ドラッグの後始末）、パンの開始、図形作成モードのIDLEで直線以外の図形種別のmousemove。`VectorModel.replaceAllShapes`も表示の点を消す（呼ばれるのは取り消し/やり直し・キャンバスの切り替え・`?dev`の「JSONから復元」）。インポートは`replaceAllShapes`を通らず、`prepareInsert`→`applyMode`→`#abortOngoingOperation`→`#resetSnapState()`で消える。表示を消す責任は`InputTracker`にあり、吸い付きの作業用フィールドは入力状態（`DRAWING`・`DRAGGING_HANDLE`）と寿命が同じ。状態の所有者を分けるときは遷移のたびに消す対応を崩さないこと。
    *   **やらないこと**：曲線・矩形・円・弧・閉じたパスの点・途中の頂点への吸い付き、修飾キーでの一時無効、整数px・グリッドへの吸い付き、本体・moveハンドルのドラッグでの吸い付き、自動で閉じる。
    *   **別の定義**：`SNAP_TOLERANCE_SCREEN_PX`（8px）・`JOIN_TOLERANCE_SCREEN_PX`（5px。端点が重なっているとみなす距離）・`InputTracker`の`hitTolerance`（5px）・表示の大きさ（`CanvasManager`の定数）は互いに別の定義で、どれを変えても他は変わらない。
    *   **注意（パン／ズームの後）**：パンの開始で表示は消すが描き終えの端点の保持は残すため、パンの後にカーソルを動かさずに描き終えると、表示の無いまま直前の照会結果で結合・描き足しになり得る。ズーム（`handleWheel`）は、描いている途中・図形作成モードのIDLEでは照会し直さないため表示を消さず、ズームの後も表示が残る（作成途中の終点・保持した端点も更新されない）。端点のハンドルを閾値を超えてドラッグしている最中のズームは`#applyLeftDragUpdate`で照会し直す（吸い付く距離をその時点の表示倍率で換算し直す）ため、吸い付きが外れて表示が消えることがある。

---

### 4. 各モジュールの責務リファレンス
本文はモジュールごとのファイルに分かれている。**作業では、該当するモジュールのファイルだけを読むこと。開発資料への反映も該当するモジュールのファイルに対して行うこと。** 新しいモジュールは`_doc/arch/`に同じ形式のファイルを作り、下の一覧に1行追加する。

| モジュール | ファイル |
| --- | --- |
| `index.html` | `_doc/arch/01_index_html.md` |
| `main.js` | `_doc/arch/02_main.md` |
| `VectorModel.js` | `_doc/arch/03_VectorModel.md` |
| `CanvasManager.js` | `_doc/arch/04_CanvasManager.md` |
| `ViewTransform.js` | `_doc/arch/05_ViewTransform.md` |
| `InputTracker.js` | `_doc/arch/06_InputTracker.md` |
| `KeyboardShortcuts.js` | `_doc/arch/07_KeyboardShortcuts.md` |
| `HistoryManager.js` | `_doc/arch/08_HistoryManager.md` |
| `DragTracker.js` | `_doc/arch/09_DragTracker.md` |
| `ShapeFactory.js` | `_doc/arch/10_ShapeFactory.md` |
| `WindowManager.js` | `_doc/arch/11_WindowManager.md` |
| `shapes/` | `_doc/arch/12_shapes.md` |
| `palette/` | `_doc/arch/13_palette.md` |
| `edit/` | `_doc/arch/14_edit.md` |
| `io/` | `_doc/arch/15_io.md` |
| `test/`（自動テスト） | `_doc/arch/16_test.md` |
| `sprite-check.html`・`check/`（確認用ページ） | `_doc/arch/17_sprite_check.md` |
