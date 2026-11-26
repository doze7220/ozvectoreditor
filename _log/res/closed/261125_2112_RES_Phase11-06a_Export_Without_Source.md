# RES: 作業計画・作業レポート (Phase 11-06a) : 書き出しから復元用のデータを外す（エディタ側）
* 参照元REQ: `./_log/req/261125_2105_REQ_Phase11-06a_Export_Without_Source.md`

## 1. 作業目的
書き出したJSを、ゲームに必要なデータ（`format`・`formatVersion`・`bounds`・`elements`）だけにする。復元用のデータ（スプライトデータの`source`）と描画要素の`id`を外し、`source`の無いJSを開いた・インポートしたときは、`elements`から図形を組み立てる。

* 書き出し形式の版（4）・作業データの版（4）・`checkFormat`の受理の範囲（1〜4）・JSの`draw`の処理・`bounds`の値は変えない。
* `source`のキーがある今までのJS（版1〜4）は、今までどおり`source`だけから戻す。
* **変更しないファイル**：`core/`・`edit/`（`CanvasFileOperations.js`のJSDocを除く）・`palette/`・`wiring/`・`main.js`・`index.html`・`sprite-check.html`・`js/check/`・`asset/`・`js/io/CanvasStorage.js`・`js/io/DocumentFileIO.js`・`shapes/`のうち5つの図形クラスの`toDrawElement()`とそのJSDoc以外。
* 計画時点の`node --test`は tests 3607 / suites 589 / pass 3607 / fail 0。
* **行末**：編集の前に`git ls-files --eol <パス>`の`w/`で実測し、保つこと（Git Bashの`grep`で`\r`を数えると誤る）。計画時の実測は次のとおり。新しく作るファイルはLF。
    * **LF**＝`js/io/DocumentSerializer.js`、`js/shapes/`の`Line`・`Curve`・`Rect`、`test/io/`の`DocumentSerializer.errors`・`.items`・`.migration`・`.roundtrip`・`FileContentReader`・`SpriteSerializer`・`SpriteSerializer.items`、`test/edit/`の`CanvasFileOperations.items`・`ShapeOrderEditor`、`_doc/arch/40_asset_sprite.md`、本RES。
    * **CRLF**＝`js/io/`の`SpriteSerializer`・`CodeExporter`・`FileContentReader`、`js/shapes/`の`Ellipse`・`Path`、`js/edit/CanvasFileOperations.js`、`test/shapes/`の5つ、`test/check/SpriteCheckInspector`、`test/io/`の`SpriteSerializer.visibility`・`DocumentSerializer.collapsed`、`test/edit/`の`CanvasFileOperations`・`GroupEditor.flow`・`TransformInputEditor`・`VisibilityAndLock.flow`、`PROJECT_ARCHITECTURE.md`、`_doc/arch/`の`12`・`14`・`15`・`16`・`17`。
    * **混在**＝`test/io/CodeExporter.test.js`（CRLF 702行・LF 66行。触る行の前後の行末に合わせる）。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **復元用のデータ**：スプライトデータの`source`（作業データそのもの）。
*   **今までのJS**：`source`を持つ、これまでに書き出したJS（版1〜4）。
*   **新しいJS**：本作業の後に書き出した、`source`を持たないJS。
*   **組み立て**：`source`の無いJSの`elements`から図形を作ること。
*   **図形データ**：図形クラスの`toJSON()`の形（`ShapeFactory.fromJSON`が受ける形）。

### モジュールの分担（全体）
| 置き場所 | 役割 |
| --- | --- |
| `js/io/DrawElementReader.js`（新規） | 描画要素1つを図形データへ変換する規則（状態なし・DOMなし）。描画要素→図形データの知識はここだけ。importは`./SpriteSerializer.js`（`resolveStrokeWidth`）のみ |
| `js/io/DocumentSerializer.js`（更新） | 入口`deserializeShapeElements(elements, toShapeData)`を足す。図形の生成と検証（`ShapeFactory.fromJSON`）・読み飛ばしの記録と警告・名前の補いを、作業データの読み込みと同じ仕組みで行う。スプライト・描画要素の形は知らない（変換関数を受け取るだけ） |
| `js/io/FileContentReader.js`（更新） | `source`のキーの有無で分け、無ければ`elements`を上の2つへ渡す。入口`deserializeFromText`のまま |
| `js/io/SpriteSerializer.js`（更新） | `source`を作らない（`DocumentSerializer`のimportが無くなる）。`resolveStrokeWidth`を`export`する |
| `js/io/CodeExporter.js`（更新） | 先頭の説明コメントのキーの並びから`source`を除くだけ（`DRAW_SOURCE`・`toModuleText`・`extractSpriteDataText`は変えない） |
| `js/shapes/`の`Line`・`Curve`・`Rect`・`Ellipse`・`Path`（更新） | `toDrawElement()`が`id`を作らない（とそのJSDoc）だけ |
| `js/edit/CanvasFileOperations.js`（JSDocのみ） | 判定の表の「読み込み不可」の条件と、スプライトの取り出しの説明を実際に合わせる |

importの向き：`FileContentReader → DocumentSerializer・SpriteSerializer・CodeExporter・DrawElementReader`、`DrawElementReader → SpriteSerializer`、`CodeExporter → SpriteSerializer`、`SpriteSerializer → core/ItemTreeRules・core/ItemStateRules`、`DocumentSerializer → core/ShapeFactory・core/ItemTreeRules・core/ItemAttributeRules`。循環は無い。`io/`から`shapes/`のimportは無い。

### 今の使用箇所の洗い出し（`source`・描画要素の`id`・`toDrawElement`）
行番号は計画時。「変える」は括弧内のタスク（T番号）で変える。

**(a) スプライトデータの`source`（製品コード）**

| 箇所 | 今 | 変える／変えない | 理由 |
| --- | --- | --- | --- |
| `SpriteSerializer` 309 `serialize` | `source`を作る | 変える（T6） | 要件1 |
| `SpriteSerializer` 2・16・58・295〜296 のJSDoc、6 のimport | `source`・`DocumentSerializer`に触れる | 変える（T6） | 実際に合わせる |
| `SpriteSerializer` 275 `checkFormat`のJSDoc | `source`の形は見ない | 変えない | 今までのJSにはあるため、正しいまま |
| `CodeExporter` 29 `HEADER_COMMENT` | キーの並びに`source` | 変える（T6） | 要件1（実際のキーに合わせる） |
| `CodeExporter`の`toModuleText`・`DRAW_SOURCE`・`extractSpriteDataText` | `source`を知らない | 変えない | 渡されたデータをそのまま埋め込む・取り出すだけ |
| `FileContentReader` 77〜80 | `source`が無ければ読み込み不可、あれば`deserialize` | 変える（T3） | 要件2・3 |
| `FileContentReader` 1〜31 のJSDoc | `elements`を読まない | 変える（T3） | 実際に合わせる |
| `SpriteCheckInspector` 85〜86（`sourceVersion`）・`SpriteCheckPage` 203〜258・`sprite-check.html` 75 | `source.version`を読み、無ければ「なし」 | 変えない | 新しいJSは今の表示のまま「なし」、今までのJSは版が出る |
| `CanvasFileOperations` 87・92 のJSDoc | 「`source`が無い」を読み込み不可の条件に挙げる | 変える（T10。JSDocのみ） | 実際に合わせる |
| `edit/CanvasLibrary`・`edit/ShapeInserter` | スプライトの`source`に触れる記述は無い | 変えない | 入口は`FileContentReader`のまま |
| `wiring/ToolIconWiring`・`asset/sprite/`の2本 | `bounds`と`draw`だけを使う（2本は`source`入り） | 変えない | 要件3 |
| `DocumentFileIO` 166・210、`PathJoinRules` 238〜242 の`source` | 無関係な局所変数 | 変えない | スプライトの`source`ではない |

**(b) 描画要素の`id`（製品コード）**

| 箇所 | 変える／変えない | 理由 |
| --- | --- | --- |
| `Line`・`Curve`・`Rect`・`Ellipse`の`toDrawElement()`（各1か所）・`Path.toDrawElement()`（2か所）の`id: this.id`とJSDoc | 変える（T8） | 要件1 |
| `SpriteSerializer`のtypedef`DrawElement`（共通のキー・キー列・`@property id`） | 変える（T8） | 実際に合わせる |
| `SpriteSerializer`の外枠の計算・`CodeExporter`の`DRAW_SOURCE`・`js/check/` | 変えない | `id`を読まない |

**(c) `toDrawElement`の呼び出し・言及**

| 箇所 | 変える／変えない | 理由 |
| --- | --- | --- |
| `SpriteSerializer` 303（`serialize`）・320（`computeShapesBounds`）・332（`computeShapesGeometryBounds`） | 変えない | `id`を読まない |
| `edit/ShapeExtentReader` 35・45 | 変えない | JSDocの`@throws`の記述だけで、正しいまま |
| 図形クラスの共通メソッド契約のJSDoc・`Ellipse` 24・`Path` 180 | 変えない | メソッド名は変わらない |

**(d) テスト**：下の「要件4: 既存のテストで直すもの」の表。そこに無いテスト（`test/shapes/PathJoinRules`・`PathSegmentKindRules`、`test/io/DocumentSerializer.migration`・`.roundtrip`・`CodeExporter.assembly`、`test/core/ThumbnailRenderer`、`test/edit/ShapeExtentReader`・`CanvasFileOperations.export`・`FolderDragTargetCopy.flow`・`InsertTarget.flow`等の`toDrawElement`・`SpriteSerializer`の使用）は、描画要素の`id`・スプライトの`source`の値に依らず、変えない（計画時にリポジトリの外の写しで`id`と`source`を外して実行し、失敗しないことを確かめた。`FolderDragTargetCopy.flow`・`InsertTarget.flow`の「スプライトのテキストは変わらない」は、作業データの比較を別に持つため観点は減らない）。

### 要件1: 書き出しから外すもの
*   `SpriteSerializer.serialize(values)`の戻り値は`{ format, formatVersion, bounds, elements }`（この順。`source`はキーごと無い）。`elements`・`bounds`の求め方（見えている図形だけ）は変えない。
*   `toDrawElement()`は`id`のキーを作らない。ほかのキー・値・並びは変えない。キー列：
    *   `polyline`＝`kind, points, closed, strokeColor, strokeWidth, fillColor`
    *   `bezierPath`＝`kind, points, closed, segments, strokeColor, strokeWidth, fillColor`
    *   `quadratic`＝`kind, points, strokeColor, strokeWidth, fillColor`
    *   `ellipse`＝`kind, x, y, radiusX, radiusY, rotation, startAngle, endAngle, closed, strokeColor, strokeWidth, fillColor`
*   `SPRITE_FORMAT_VERSION`は4のまま。JSDocに「版4のまま、`source`と描画要素の`id`を外した（読む側が使っていない項目を外すだけで、古い読み手も正しく描けるため版を上げない）」を足す（T6で`source`の分、T8で`id`の分）。
*   `HEADER_COMMENT`の該当行は「既定のexportは、スプライトデータ（format・formatVersion・bounds・elements）と、」。

### 要件2-1: 描画要素→図形データ: `io/DrawElementReader`
`export class DrawElementReader { static toShapeData(element) }`。描画要素1つを図形データ（新しいオブジェクト。`id`・名前・表示・ロックのキーは持たない）へ変換する。変換できなければ理由つきの`Error`を投げる（捕捉は`DocumentSerializer`の1か所）。引数を書き換えず、警告を出さない。**図形データの規則（点の数・点の座標が有限か・区間の数・閉じたパスの下限・引っ張る点の形）は書き写さず`ShapeFactory.fromJSON`の検証に任せる**。ここで見るのは「描画要素の語彙と、変換に要る項目があるか」だけ。`kind`→変換関数の対応表を1つ持つ（`Object.prototype.hasOwnProperty`で引く）。

*   **スタイル**（`draw`と同じ読み方）：`strokeColor`＝文字列ならその値、でなければ`null`。`strokeWidth`＝`SpriteSerializer`の`resolveStrokeWidth(element.strokeWidth)`（正の有限の数値でなければ`DEFAULT_STROKE_WIDTH`）。`fillColor`＝「塗れる要素」（下の各`kind`）で文字列ならその値、でなければ`null`。
*   **閉じているか**：`element.closed === true`だけ。
*   **要素がプレーンオブジェクトでない・`kind`が未知**：`Error`。知らないキー（残っている`id`・`name`・`type`等）は読まない。
*   **`polyline`**：`points`が配列でなければ`Error`。閉じていなくてちょうど2点なら`{ type: 'line', points, ...スタイル（塗りなし） }`。ほかは`{ type: 'path', points, closed, segments: すべて{ kind: 'line' }（閉じていればn個、開いていればn−1個。負にしない）, ...スタイル（塗れるのは閉じているとき） }`。1点・閉じた2点は`Path.fromJSON`が断る。
*   **`bezierPath`**：`segments`が配列でなければ`Error`。`{ type: 'path', points, closed, segments, ...スタイル（塗れるのは閉じているとき） }`。区間は`{ kind: 'line' }`→`{ kind: 'line' }`、`{ kind: 'cubic', control1, control2 }`→`{ kind: 'bezier', control1, control2 }`。プレーンオブジェクトでない区間・ほかの`kind`（`'smooth'`・`'bezier'`を含む。描画要素の語彙ではない）は`Error`。`corners`は付けない。
*   **`quadratic`**：`{ type: 'curve', points, ...スタイル（塗りなし） }`。3点でなければ`Curve.fromJSON`が断る。
*   **`ellipse`**：`x`・`y`・`radiusX`・`radiusY`・`startAngle`・`endAngle`のどれかが有限の数値でない、または半径が負なら`Error`。`rotation`は有限の数値でなければ0。
    *   開きの量`sweep = endAngle − startAngle`（負なら2πを1回足す。`SpriteSerializer`の`ellipseRange`と同じ読み方）。角度の比較の許容差は定数`ANGLE_TOLERANCE = 1e-9`。
    *   閉じていて`sweep ≈ 2π` → `type: 'circle'`・`δ = 0`（1周分は開始角によらず同じ輪郭）。閉じていなくて`sweep ≈ π` → `type: 'arc'`・`δ = startAngle − π`（弧の図形は`t = π〜2π`を描くため）。ほかは`Error`。
    *   共役な半径：輪郭`中心 + u·cos t − w·sin t`（`Ellipse`の`points`の約束）が、描画要素の輪郭`中心 + R(rotation)·(radiusX·cos(t + δ), radiusY·sin(t + δ))`と一致するように、`u = R(rotation)·(radiusX·cos δ, radiusY·sin δ)`・`w = R(rotation)·(radiusX·sin δ, −radiusY·cos δ)`（`R(φ)(a, b) = (a·cos φ − b·sin φ, a·sin φ + b·cos φ)`）。
    *   **cos・sinは、角度が4分の1回転の整数倍（許容差`ANGLE_TOLERANCE`以内）ならちょうどの値（0・1・−1）を使う**（`rotation`・`δ`とも。非公開の関数1つ）。回していない円・約束の位置の弧・上下左右の裏返しだけの弧は、`Ellipse.#readGeometry`の縦横に沿った枝に入り、描いたときと同じ約束の位置の点になる。
    *   `points`＝`[中心, 中心 + u, 中心 + w, 開始角の点, 中心 + u]`。開始角の点は、円は`中心 + u`・弧は`中心 − u`。塗れるのは円だけ。
*   **計画時の実測**：この式で、円・弧×大きさ5通り（半径0を含む）×拡大縮小・反転・回転の組み合わせ（6400通り、組み立て直しを含め12800件）の輪郭の点と外枠の差は、大きさに対する比で2.2e-15以下。
*   **値が「等価な別の値」になる場合**：回した・裏返した円・弧は、`Ellipse.#readGeometry`（変えない）の分解の取り方により、もう一度書き出した`rotation`・`startAngle`（差がπ等）や半径の並びが、同じ形を表す別の値になることがある（`Ellipse.toDrawElement`のJSDocにある今までの性質）。見た目・外枠は同じ。テストの比較は、組み立てた図形との比較に限り、`ellipse`だけ、弧は「輪郭の点（媒介変数を等分した点）の並び」、円は「輪郭の形」（`A = rx²·cos²φ + ry²·sin²φ`・`B = (rx² − ry²)·sinφ·cosφ`・`C = rx²·sin²φ + ry²·cos²φ`の3つの係数と中心）で行う。

### 要件2-2: 読み飛ばし・名前の補い: `DocumentSerializer.deserializeShapeElements(elements, toShapeData)`
*   静的メソッド。`elements`の要素ごとに`ShapeFactory.fromJSON(toShapeData(element))`を呼び、`{ kind: ITEM_KIND.SHAPE, shape }`（名前・表示・ロックのキーなし）を集める。投げられた`Error`は今と同じく図形単位で捕捉し、非公開`#recordSkip(skipped, [位置], element, 理由)`で`skipped`に1件・`console.warn`を1回。`RangeError`は今と同じく再送出して全体の失敗にする。
*   集めた後は`deserialize`と同じ後段：`resolveItems`を1回（自動の名前・表示・ロックなし）→`listShapes`→`{ ok, items, shapes, skipped, error }`。この後段（`skipped`の用意・`try/catch`・2つの`#failure`の文言）を非公開の静的メソッド1つに切り出し、`deserialize`と共有する（**文言・警告・結果は変えない**）。
*   例外を外へ投げない（`elements`が配列でない等、図形単位の捕捉の外で投げられたものも、共有した後段の捕捉で全体の失敗になる）。引数を書き換えない。
*   `index`は`elements`の中での位置、`path`は`[index]`、`type`は`#recordSkip`の規則のまま（要素が文字列の`type`を持たなければ`null`。描画要素は通常`null`で、`kind`は理由の文に入る）。
*   描画要素・スプライトの識別子・`kind`の語を書かない（「図形データへ変換できる要素の並び」として扱う）。責務定義・クラスのJSDocを合わせる。
*   組み立てた図形の`id`は`undefined`のまま（`VectorModel.replaceAllShapes`・`addShapesWithNewIds`が今までの規則で付ける。計画時に`replaceAllShapes`と作業データの往復で確かめた）。

### 要件2-3・3: 入口: `FileContentReader`
`checkFormat`が`'supported'`の後：
1. `Object.hasOwn(data, 'source')`なら、今と同じく`DocumentSerializer.deserialize(data.source)`（`null`・不正な値も今と同じ読み込み不可。`elements`は見ない）。
2. `data.elements`が配列でなければ`#failure('スプライトのelementsが配列ではありません')`（警告1回）。
3. `DocumentSerializer.deserializeShapeElements(data.elements, (element) => DrawElementReader.toShapeData(element))`。

判定の表（`CanvasFileOperations.#classifyRead`）は変えない：すべて読めない＝読み込み不可、一部＝通知`partialRead`、0個＝空、全部＝通知なし（組み立てたこと自体の通知も出さない）。

### 要件4: 既存のテストで直すもの（これ以外の既存のテストの値は変えない）
共通の替え方：
*   **替え方A（今までのJSの形）**：各テストファイルの中に、`{ ...SpriteSerializer.serialize(values), source: DocumentSerializer.serialize(values) }`を返す関数（例：`withSource(values)`）を置き、`source`から戻ることを見るテストの入力をこれに替える（期待値は変えない。`test/`にテスト以外の`.js`は作れないためファイルごとに置く）。`source`を外す前後のどちらでも通る。
*   **替え方B（作業データで見る）**：`data.source`を`DocumentSerializer.serialize(同じ入力)`に替える（期待値は変えない）。
*   **替え方C（キーの並び・値）**：期待値から`source`（または`id`）だけを除き、無いことを見る。
*   **替え方D（並びを別の見分け方で）**：`id`での見分けを、色・太さ・座標・`kind`に替える。

| ファイル（行は計画時） | テスト | 理由 | 直し方 | タスク |
| --- | --- | --- | --- | --- |
| `test/io/FileContentReader.test.js` 235 | sourceが無いスプライト（JSON・JS…） | 要件2で読めるようになる | JSONは読み込み不可のまま。JSは`elements`から組み立てて`ok: true`・`skipped`0件・件数が同じ、に替え、題を合わせる | T3 |
| 同 103・111・161・172・257・342・354・417・430 | 書き出したJS／スプライトのJSONの読み込み | 書き出しに`source`が無くなり入力の意味が変わる | 替え方A（257の題の「sourceあり」はそのまま正しい） | T4 |
| 同 `mutatedSprite`（202・235・243・275・`makeVersion1Sprite`＝366・381が使う） | `source`を書き換えた入力 | 同上 | 関数の元を替え方Aの値にする | T4 |
| 同 460 `makeSpriteData`（「JSから読むとitemsに…」） | すでに`source`を足す形 | 変わらない | 変えない | — |
| `test/edit/CanvasFileOperations.test.js` 314 `makeSpriteDataWithSourceShapes`・358（6件）・409〜415（6件）・396・451（各2件） | スプライトのJS／JSONの開く・インポートが作業データと同じ | 入力の意味が変わる | 入力を替え方A | T5 |
| `test/edit/CanvasFileOperations.items.test.js` 185 | 出力（エンジン用）のJS→開く・インポートも同じ | 新しいJSではフォルダ・名前が戻らない | 題を「今までのJS（source入り）→開く・インポートも同じ」とし、入力を`CodeExporter.toModuleText(替え方A)`に替える（新しいJSの往復はT10で足す） | T5 |
| `test/edit/GroupEditor.flow.test.js` 127 | まとめてもelements・boundsは同じ（`source`にはフォルダが出る） | `source`が無い | 最後の1行を替え方B（まとめる前後の作業データが異なる） | T5 |
| 同 441 | スプライトデータのsourceからも入れ子…が戻る | 同上 | 替え方A（今までのJSの形を`deserialize`）。`elements`3件の確認は残す | T5 |
| `test/edit/VisibilityAndLock.flow.test.js` 458 | 書き出しは隠した図形を出さず…sourceには全部 | 同上 | 替え方B（作業データに4件・開くと値が戻る）。`elements`2件は残し、題を合わせる | T5 |
| `test/check/SpriteCheckInspector.test.js` 83 | 作業データの版を返す | 同上 | 替え方A | T5 |
| 同 104 | sourceが無い場合は null | 観点を足す | 今の行はそのまま。`source`のキー自体が無い入力の1行を足す | T6 |
| `test/io/DocumentSerializer.collapsed.test.js` 145 | 折りたたみはsourceに入る | `source`が無い | 替え方B。`elements`・`bounds`が変わらないことは残す | T4 |
| `test/io/SpriteSerializer.items.test.js` 134・149（名前の行）・162 | sourceの往復・自動の名前・特殊な名前 | 同上 | 134・149は替え方B、162は替え方A（JSのテキストを通す） | T4 |
| 同 119・126 | キーの並び・sourceが作業データと同じ | 同上 | 119は替え方C。126は「版が4・`source`のキーが無い」に替え、作業データの版4・全部の図形を持つことは替え方B | T6 |
| `test/io/SpriteSerializer.visibility.test.js` 69・80・101・144 | 隠した図形がsourceから戻る | 同上 | 69・80・101は替え方B、144は替え方A。題を合わせる | T4 |
| 同 113 | 版4・キーの並び | 同上 | 替え方C（作業データの版4は替え方B） | T6 |
| `test/io/SpriteSerializer.test.js` 185・324・369・1001 | sourceの往復・塗れない形の`fillColor`・変換後の図形 | 同上 | 替え方B | T4 |
| 同 55・134 | キーの順・図形0個 | 同上 | 替え方C（作業データの`format`・版・図形0個の形は替え方B） | T6 |
| 同 206 | 戻り値を書き換えても図形は変わらない | 同上 | `data.source…`の1行を除く（`elements`の点を書き換える行がすでにある） | T6 |
| 同 184 の題 | describeの題に`source` | 題だけ | 題から`source`を除く。261（`checkFormat`）の題は、今までのJSの`source`も見ないため正しく、変えない | T6 |
| `test/io/CodeExporter.test.js` 126 | 既定のexportのキー | 同上 | 替え方C | T6 |
| 同 504 | 特殊な文字列の値が戻る | `sprite.source`が無い | `source`の1行を、替え方Aの入力で書き出した別のJSの`source.shapes[0].strokeColor`で見る形に替える | T4 |
| `test/edit/TransformInputEditor.test.js` 365 | 書き出しのキー | 同上 | 替え方C。`source`の版・キーは替え方B | T6 |
| `test/edit/ShapeOrderEditor.test.js` 190 | 書き出しの並びが追従 | `id`で見る | 替え方D：並べ替えの前に各図形を別々の量だけ`translate`し（4つとも同じ矩形のため）、`elements`の`points[0].x`の並びで見る | T7 |
| `test/io/SpriteSerializer.test.js` 123・312・356・987 | 描画順・塗り | 同上 | 替え方D：123＝`closed`と座標、312＝`strokeWidth`の並び`[2, 4, 6]`、356＝入力の順のままの`fillColor`の並び、987＝`strokeColor`の並び | T7 |
| `test/io/SpriteSerializer.items.test.js` 103 | 並び | 同上 | 替え方D（`kind`と`strokeColor`の並び） | T7 |
| `test/io/SpriteSerializer.visibility.test.js` 58 `idsOf`（63・69・80・89・96・120・144が使う） | 並び | 同上 | 替え方D：線の色（`#111111`＝a・`#222222`＝b・`#333333`＝c・`#444444`＝d）から名前へ引く関数に替える（期待値の並びは変えない） | T7 |
| `test/io/SpriteSerializer.test.js` 65・75・87・96・285・499・908・916・924・933・942・951、`test/io/SpriteSerializer.items.test.js`の`EXPECTED_ELEMENTS`（119・149が使う） | 描画要素のキー順・値 | `id`が無くなる | 替え方C（908の題の「id」も直す） | T8 |
| `test/io/SpriteSerializer.items.test.js` 110「名前・表示・ロックのキーが出ない」 | — | 観点を足す | キーの一覧に`'id'`を足し、題を合わせる | T8 |
| `test/shapes/Line.test.js` 434・539、`Curve.test.js` 448・550、`Rect.test.js` 527・632 | `toDrawElement`のキー順・値 | `id`が無くなる | 替え方C | T8 |
| `test/shapes/Ellipse.test.js` 700（題の「13キー」→「12キー」）・807・821・842・852・862・872・882・979・1167 | 同上 | 同上 | 替え方C（`toJSON`・`out.id`の`id`は変えない） | T8 |
| `test/shapes/Path.test.js` 761・1206・1212（`el.id`の行を「`id`のキーが無い」へ）・1681・1701 | 同上 | 同上 | 替え方C（`toJSON`側の`id`は変えない） | T8 |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/io/`（書き出し・読み込み）、`./js/shapes/`（`toDrawElement`のみ）、`./js/edit/`（JSDocのみ）、`./test/`、`./PROJECT_ARCHITECTURE.md`・`./_doc/arch/`（最終タスクのみ）
*   **関連する論理クラス**: `DrawElementReader`（新規）、`DocumentSerializer`、`FileContentReader`、`SpriteSerializer`、`CodeExporter`、`Line`・`Curve`・`Rect`・`Ellipse`・`Path`、`CanvasFileOperations`（JSDocのみ）

### 参照する責務
*   **`io/`**：作業データ形式の変換、スプライトの組み立て、開く・インポートで選ばれたファイルの中身の判別、保存先・ファイルへの読み書きのみ。`edit/`をimportしない。`shapes/`を直接importしない（図形の復元は`core/ShapeFactory`を通す）。importは`io/`内と`core/ShapeFactory`・`core/ItemTreeRules`・`core/ItemAttributeRules`・`core/ItemStateRules`のみ。
*   **`DocumentSerializer`**：作業データ形式の定義（識別子・版は他に書かない）・シリアライズ・デシリアライズ・旧版の移行。デシリアライズ系は例外を投げず`{ ok, items, shapes, skipped, error }`を返す。図形単位の`try/catch`を置くのはこのクラスだけ（`core/`・`shapes/`・ほかの`io/`は捕捉しない）。名前の補いは`ItemAttributeRules.resolveItems`を1回。スプライト形式・描画要素を知らない。図形種別の分岐・図形固有のプロパティ名を持たない（移行の中だけ例外）。
*   **`SpriteSerializer`**：書き出し形式の識別子・版（他に書かない）・`DEFAULT_STROKE_WIDTH`・描画要素の`kind`の語彙と外枠の計算。図形は`toDrawElement()`をポリモーフィックに呼ぶだけ。
*   **`CodeExporter`**：スプライトJSのテキストの形（組み立てと、実行しない取り出し）。JSの形の知識はここだけ。`const spriteData = `で始まる行を先頭の説明コメントに置かない。
*   **`FileContentReader`**：選ばれたファイルのテキストの判別の順序だけを持つ読み込みの唯一の入口。JSを実行しない（`import`・`eval`・`Function`を使わない）。例外を投げない。全体失敗の警告はどの経路でも1回。
*   **`ShapeFactory.fromJSON(data)`**：図形データの`type`で図形クラスの`fromJSON`へ振り分け、不正なら`Error`。例外は捕捉しない。
*   **図形クラス（`shapes/`）**：`toDrawElement()`は描画要素を返すだけで、描画要素から自身を復元する知識を持たない。`toDrawElement()`とそのJSDoc以外は変えない。
*   **`Ellipse`の`points`の約束**：`[0]`＝中心・`[1]`＝右端の制御点・`[2]`＝上端の制御点・`[3]`＝開始角の点・`[4]`＝終了角の点。`u = [1] − [0]`・`w = [2] − [0]`を共役な半径とし、輪郭`中心 + u·cos t − w·sin t`（円は`t = 0〜2π`、弧は`t = π〜2π`）。約束の位置（`u`＝右向き・`w`＝上向き）の弧の開始角の点は左端。
*   **`CanvasFileOperations`**：読み込みは`FileContentReader.deserializeFromText`を通し、スプライト形式を知らない。判定は結果の`shapes.length`・`skipped.length`だけ。
*   **`test/`**：`node:test`・`node:assert/strict`のみ。`test/`の中にテスト以外の`.js`を作らない。公開APIだけを通す。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   `PROJECT_ARCHITECTURE.md`
    *   1章：構成図（`js/io/DrawElementReader.js`・新しいテストのファイル）。「存在しないもの」（300行）から「スプライトの`elements`からの図形の作り直し」を除き、本アプリの形から外れたJSを読まないことは残す（四角い閉じたパスを矩形に戻すこと・通る点や角・フォルダ・名前を推し量って戻すこと、半周でない弧・1周でない円を図形として表すことは「存在しないもの」に足す）。フォルダ分割の方針の`io/`（305行）へ`DrawElementReader`を足す。
    *   2章（341・354〜388行）：スプライトデータの形（4つのキー）・`source`の項（今までのJSだけが持つ）・描画要素の`id`とキー列・図形0個／すべて隠れたとき・エンジンとの約束の(b)（読まないものの列挙の`source`）・(d)（`ship.js`は`source`入りの版2なので今までどおり開ける。書き出し直すと`source`の無いJSになる）・「2つの版」（版を上げる条件を「古い読み手が正しく描けなくなるとき。読む側が使っていない項目を外すだけなら上げない」ことが分かる書き方にし、版の履歴に「版4のまま`source`と描画要素の`id`を外した（Phase 11-06a）」を足す。「作業データの版は`source.version`」は今までのJSについての記述へ）・「エディタで開くときの規則」（`source`のキーの有無での分岐・組み立ての対応表・スタイルの読み方・読み飛ばし・名前）。エンジンへの連絡は11-06bのため「連絡済み」とは書かない。
    *   3章9.（557〜569行）・10.・28.ほか`source`と書き出しに触れる箇所（563「折りたたみの扱い」・568「旧版のファイル」・569「書き出しと表示・ロック」）。624行の`source`は無関係（確かめてから判断する）。
*   `_doc/arch/`
    *   `12_shapes.md`：`toDrawElement`の戻り値に`id`が無いこと（54行・79行ほか）。
    *   `14_edit.md`：`source`に触れる箇所（44行の`source.version`ほか）、`CanvasFileOperations`の判定。
    *   `15_io.md`：`DrawElementReader`の項（新規。4章の`io/`は`15_io.md`1つにまとまっているため、資料のファイルは新設せずここへ足す）、`DocumentSerializer.deserializeShapeElements`、`SpriteSerializer`の戻り値・import・`resolveStrokeWidth`の公開、`FileContentReader`の規則・import、`kind`を足す手順に`DrawElementReader`を足す。
    *   `16_test.md`：新しいテスト・直したテスト。
    *   `17_sprite_check.md`：`SpriteSerializer`のimportを通じて読み込まれるものの記述から`DocumentSerializer`・`ShapeFactory`・`shapes/`を除く（実コードで確かめる）、「作業データの版」は新しいJSで「なし」。
    *   `40_asset_sprite.md`：現行の書き出しは`source`を持たないが、2本は版2・`source`入りのまま。

## 3. タスクリスト
※ 各タスクの共通の作業：コード修正の後、JSDocの記載漏れが無いことを確認する／完了後に本RESの「4. 詳細作業内容」を記入し、タスクを[x]にする／開発資料の記載に影響が出る場合は、資料本体は直さず「開発資料の更新予定」に追記する／`node --test`が全件合格することを確かめる。**対象ファイルに挙げたもの以外は変えない（本RESを除く）。**

*   [x] タスク1: 描画要素→図形データの変換（`DrawElementReader`）
    *   **対象ファイル** :
        *   `./js/io/DrawElementReader.js` :（新規）
        *   `./js/io/SpriteSerializer.js` :（更新）
        *   `./test/io/DrawElementReader.test.js` :（新規）
    *   **作業内容** :
        *   `SpriteSerializer.js`は非公開の関数`resolveStrokeWidth`に`export`を付け、JSDocに使う側（外枠の計算と`DrawElementReader`）を書くだけ。
        *   「要件2-1」のとおり`DrawElementReader`を作る（責務定義を先頭に3行以内・JSDoc）。`Error`の文は`DrawElementReader: `で始め、`kind`・項目名が分かる日本語にする。
        *   テスト：`kind`ごとの変換（REQ要件2の表の全行）、スタイルの読み方（線なし・塗りなし・太さの不正・`fillColor`／`closed`／`rotation`のキーが無い・塗れない要素の塗り）、閉じた要素の判定は`true`だけ、円弧（約束の位置の円・弧の5点が描いたときと同じ・左右／上下／両方の裏返し・90°／180°／30°の回転・傾いた楕円・`rotation`が数値でない・負の開き）、断る入力（オブジェクトでない・未知の`kind`（`'toString'`等の継承した名前を含む）・項目の不足・半径が負・`NaN`・閉じた半周・開いた1周・4分の1周・`segments`の未知の`kind`）、知らないキー（`id`・`name`・`type`。要素へ明示的に足す）を読まない、引数を書き換えない。入力は文字どおりの要素か、`toDrawElement()`の戻り値から作り、後者でも戻り値の`id`の有無に依らない（タスク8の後もこのファイルを変えずに、同じ観点を確かめたまま全件合格すること）。結果は`ShapeFactory.fromJSON`に通して確かめる（点の数の不足等は`ShapeFactory.fromJSON`が投げることを見る）。
*   [x] タスク2: 変換関数を受ける読み込みの入口（`DocumentSerializer.deserializeShapeElements`）
    *   **対象ファイル** :
        *   `./js/io/DocumentSerializer.js` :（更新）
        *   `./test/io/DocumentSerializer.shapeElements.test.js` :（新規）
    *   **作業内容** :
        *   「要件2-2」のとおり入口を足し、後段を非公開メソッドへ切り出して`deserialize`と共有する。`deserialize`・`serialize`の結果・文言・警告は変えない。責務定義（3行以内）・クラスのJSDoc・typedef`SkippedShape`／`DeserializeResult`のJSDocを合わせる。
        *   テスト（変換関数は偽物でよい。要素は文字どおりのデータで作り、書き出しや`toDrawElement()`の戻り値に依らない）：図形データを返せば図形になる・名前は自動（種類ごとの番号）・表示・ロックなし、変換が投げた／`ShapeFactory`が断った要素だけを飛ばす（`skipped`の`index`・`path`・`type`・`reason`・警告の回数）、すべて飛ばすと`ok: true`・0個、空配列、配列でない・`RangeError`は全体失敗で例外が出ない・警告1回、引数を書き換えない。
*   [x] タスク3: `source`の無いJSの読み込み（`FileContentReader`）
    *   **対象ファイル** :
        *   `./js/io/FileContentReader.js` :（更新）
        *   `./test/io/FileContentReader.test.js` :（更新）
        *   `./test/io/FileContentReader.elements.test.js` :（新規）
    *   **作業内容** :
        *   「要件2-3・3」のとおり分岐を足し、責務定義（3行以内）・クラスのJSDocの判別の表と規則を実際に合わせる。`JSON.parse`できるテキストの扱い・`extractSpriteDataText`・版の受理は変えない。
        *   `FileContentReader.test.js`は235行のテストだけを直す（要件4の表）。
        *   **新しいテストは、書き出しの戻り値の`source`・`id`の有無に依らない形で作る**：`source`・`id`を外すタスク6・8の後も、このファイルを変えずに、同じ観点を確かめたまま全件合格すること。`source`の無い入力は、書き出しの値から`source`のキーを（あっても無くても同じ結果になる形で）除いて作る。`source`のあるケースは、替え方A（または文字どおりの固定データ）で作り、書き出しの戻り値の`source`を読まない・書き換えない。`id`のあるケースは要素へ`id`を明示的に足し（または固定データにし）、`id`の無いケースは`id`のキーを（あっても無くても同じ結果になる形で）除く。
        *   新しいテストの内容：種類ごとの組み立て（`id`の無い要素）、要素に`id`を足しても読める（`id`の無いときと同じ図形になり、足した`id`は図形へ移らない）、名前・表示・ロック・フォルダ、`CRLF`、版1〜3の形（`source`を取り除き、`formatVersion`と`fillColor`／`rotation`のキーを外したもの）、線なし・塗りなし・太さの不正、読み飛ばし（未知の`kind`・項目の不足・表に当てはまらない円弧・点の数の不足・要素がオブジェクトでない。件数と警告の回数）、すべて読めない、`elements`が配列でない（無い・`null`・オブジェクト）＝読み込み不可・警告1回、`elements`が空、`source`があれば`elements`を空・別の形にしても`source`から戻る、`source`が`null`・文字列・版違い・`shapes`なしなら読み込み不可（`elements`から組み立てない）。文字どおりの値で固定した今までのJS（版2。`id`と`source`を持つ）を1つ入れる。
*   [x] タスク4: 既存のテストの入力を「今までのJSの形」「作業データ」へ替える・`test/io/`（製品コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/FileContentReader.test.js` :（更新）
        *   `./test/io/SpriteSerializer.test.js` :（更新）
        *   `./test/io/SpriteSerializer.items.test.js` :（更新）
        *   `./test/io/SpriteSerializer.visibility.test.js` :（更新）
        *   `./test/io/DocumentSerializer.collapsed.test.js` :（更新）
        *   `./test/io/CodeExporter.test.js` :（更新）
    *   **作業内容** :
        *   「要件4」の表で「T4」の行だけを直す（替え方A・B）。期待値は変えず、確かめている観点を減らさない。題・先頭の責務定義が実際と合わなくなるものは合わせる。`source`を書き出しから外す前でも全件合格すること。
        *   足した関数にはJSDocを書く。
*   [x] タスク5: 既存のテストの入力を「今までのJSの形」「作業データ」へ替える・`test/edit/`と`test/check/`（製品コードは変えない）
    *   **対象ファイル** :
        *   `./test/edit/CanvasFileOperations.test.js` :（更新）
        *   `./test/edit/CanvasFileOperations.items.test.js` :（更新）
        *   `./test/edit/GroupEditor.flow.test.js` :（更新）
        *   `./test/edit/VisibilityAndLock.flow.test.js` :（更新）
        *   `./test/check/SpriteCheckInspector.test.js` :（更新）
    *   **作業内容** :
        *   「要件4」の表で「T5」の行だけを直す（替え方A・B）。期待値は変えず、確かめている観点を減らさない。題・先頭の責務定義が実際と合わなくなるものは合わせる。`source`を書き出しから外す前でも全件合格すること。
        *   足した関数にはJSDocを書く。
*   [x] タスク6: 書き出しから`source`を外す
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` :（更新）
        *   `./js/io/CodeExporter.js` :（更新）
        *   `./test/io/SpriteSerializer.test.js` :（更新）
        *   `./test/io/SpriteSerializer.items.test.js` :（更新）
        *   `./test/io/SpriteSerializer.visibility.test.js` :（更新）
        *   `./test/io/CodeExporter.test.js` :（更新）
        *   `./test/edit/TransformInputEditor.test.js` :（更新）
        *   `./test/check/SpriteCheckInspector.test.js` :（更新）
    *   **作業内容** :
        *   「要件1」のうち`source`の分（`DocumentSerializer`のimportを除く・責務定義・typedef`SpriteData`・`SPRITE_FORMAT_VERSION`・`serialize`のJSDoc）と`HEADER_COMMENT`の1行。
        *   「要件4」の表で「T6」の行を直す。書き出したデータ・JSのテキストに`source`・名前・フォルダ・ロック・隠した図形の情報が無いこと（隠した図形だけが持つ色・座標の文字列がテキストに無いことを含む）と、すべて隠れたときが図形0個の書き出しと同じJSのテキストになることを`SpriteSerializer.visibility.test.js`に足す。
*   [x] タスク7: `id`で見分けている既存のテストを別の見分け方へ替える（製品コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/SpriteSerializer.test.js` :（更新）
        *   `./test/io/SpriteSerializer.items.test.js` :（更新）
        *   `./test/io/SpriteSerializer.visibility.test.js` :（更新）
        *   `./test/edit/ShapeOrderEditor.test.js` :（更新）
    *   **作業内容** :
        *   「要件4」の表で「T7」の行だけを直す（替え方D）。`id`を外す前でも全件合格すること。
*   [x] タスク8: 描画要素から`id`を外す
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` :（更新）
        *   `./js/shapes/Curve.js` :（更新）
        *   `./js/shapes/Rect.js` :（更新）
        *   `./js/shapes/Ellipse.js` :（更新）
        *   `./js/shapes/Path.js` :（更新）
        *   `./js/io/SpriteSerializer.js` :（更新。typedef`DrawElement`と`SPRITE_FORMAT_VERSION`のJSDocのみ）
        *   `./test/io/SpriteSerializer.test.js` :（更新）
        *   `./test/io/SpriteSerializer.items.test.js` :（更新）
        *   `./test/shapes/Line.test.js`・`./test/shapes/Curve.test.js`・`./test/shapes/Rect.test.js`・`./test/shapes/Ellipse.test.js`・`./test/shapes/Path.test.js` :（更新）
    *   **作業内容** :
        *   5つの図形クラスの`toDrawElement()`の`id: this.id`（計6か所）と、そのJSDoc（形・`@returns`・「`id`は検証・補完せず」）を直す。ほかの行は変えない。
        *   「要件4」の表で「T8」の行を直す。
*   [x] タスク9: 書き出し→組み立て→描画→書き出し直しの往復のテスト
    *   **対象ファイル** :
        *   `./test/io/SpriteRoundTrip.test.js` :（新規）
    *   **作業内容** :
        *   図形の種類ごと（直線・今の曲線・矩形・円・弧・パス（開いた／閉じた × 直線だけ／曲線／曲がり方を持つ区間／混ざり／角の点））と、それぞれを`createTransformed`で拡大縮小（縦横別）・回転（30°・90°・180°・斜めの角度）・反転（左右・上下・両方）したもの、弧は左右・上下の裏返しと回転の組み合わせ。
        *   確かめること：書き出したJS→`FileContentReader`で読み（`skipped`0件）→ (a) 元の図形の`draw`・書き出したJSの`draw`・組み立てた図形の`draw`の描画命令（記録する偽の`ctx`）が丸めの範囲で一致、(b) もう一度書き出した`elements`（キー・並び・値）・`bounds`が丸めの範囲で一致。許容差は大きさに対する比1e-9。`ellipse`の緩め（「要件2-1」の「等価な別の値」。コメントに理由を書く）を適用するのは、**組み立てた図形との比較だけ**（(a)の組み立てた図形の`draw`と、(b)の書き出し直した`elements`）。(a)の「元の図形の`draw`」と「書き出したJSの`draw`」は組み立てを挟まず引数がそのまま一致するはずなので、`ellipse`も緩めずに描画命令の引数どうしを比べる。回していない円・約束の位置の弧は値そのものでも一致すること、矩形は`path`になること、図形の種類・塗り・重なり順も見る。
        *   組み立てた図形を、動かす・`createTransformed`・作業データの往復（`DocumentSerializer`）しても見た目が追従すること。書き出しのテキストに`"source"`・`"id"`・`"name"`が無いこと。引数（スプライトデータ）を書き換えないこと。不具合が見つかったら製品コードを直さずに報告する。
*   [x] タスク10: 開く・インポートの手順のテストと`CanvasFileOperations`のJSDoc
    *   **対象ファイル** :
        *   `./js/edit/CanvasFileOperations.js` :（更新。JSDocのみ）
        *   `./test/edit/CanvasFileOperations.elements.test.js` :（新規）
    *   **作業内容** :
        *   JSDocの判定の表の1行目（`source`が無い→`source`が読めない・`source`が無く`elements`が配列でない）と、その下の「`source`の取り出しも」を実際に合わせる。**コードは1行も変えない**（コメントを除いた差分が無いことを確かめる）。
        *   テスト（実物の`CanvasFileOperations`・`VectorModel`・`HistoryManager`・`SnapshotAdapter`・`ShapeInserter`。組み立ては`CanvasFileOperations.items.test.js`に倣う）：新しいJSの開く（図形・自動の名前・フォルダなし・表示・ロックなし・通知なし）、インポート（追加した図形だけが選ばれる・1件の記録・取り消し1回で元どおり・やり直し）、一部が読めない（`partialRead`と件数）、すべて読めない・`elements`が配列でない（`readFailed`・何も変えない）、空（開く＝空のキャンバス・インポート＝`noShapes`）、出力（エンジン用）したJSのテキストに`source`・名前・フォルダ・隠した図形が無い、組み立てた図形を開いた後の作業ファイルの出力→開くで同じ図形、もう一度のエンジン用の出力が同じ見た目、今までのJSを開いて書き出し直すと`source`が無い。組み立てた図形の結合・色の変更・直線／曲線の切り替え（`PathJoiner`・`ShapeStyleEditor`・`PathCornerEditor`の実物）が、その種類の図形としてできること。
*   [x] タスク11: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   「開発資料の更新予定」の`PROJECT_ARCHITECTURE.md`の分を反映する（この固定タスクに限り資料の書き換えを認める）。実コードで確かめてから書く。書き換える前に行末を実測し、保つ。エンジンへ「連絡済み」とは書かない。
*   [x] タスク12: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/12_shapes.md`・`./_doc/arch/14_edit.md`・`./_doc/arch/15_io.md`・`./_doc/arch/16_test.md`・`./_doc/arch/17_sprite_check.md`・`./_doc/arch/40_asset_sprite.md` :（更新）
    *   **作業内容** :
        *   「開発資料の更新予定」の`_doc/arch/`の分を反映する（この固定タスクに限り資料の書き換えを認める）。書き換える前に各ファイルの行末（CRLF／LF）を実測し、保つ（計画時は`40`がLF、ほかはCRLF）。テストの件数は`node --test`の実測で書く。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 描画要素→図形データの変換（`DrawElementReader`）
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`：`resolveStrokeWidth`に`export`を付け、JSDocに使う側（外枠の計算と`DrawElementReader`）を書いた（CRLFのまま）。
    *   `js/io/DrawElementReader.js`（新規・LF）：`DrawElementReader.toShapeData(element)`を要件2-1のとおり実装。`kind`→変換関数の対応表（`hasOwnProperty`で引く）、`polyline`／`bezierPath`／`quadratic`／`ellipse`。円・弧の共役な半径は`ANGLE_TOLERANCE`内の4分の1回転の整数倍でちょうどの cos・sin を使う。Errorの文は`DrawElementReader: `で始まる。点・区間の制御点は新しいオブジェクトへ写す。
    *   `test/io/DrawElementReader.test.js`（新規・LF）：30件。各`kind`・スタイル・円弧（約束の位置・描いた5点・裏返し／回転／傾きの輪郭）・断る入力・`id`等を読まない・引数不変・警告なし。`node --test`は tests 3637 / pass 3637 / fail 0。

### タスク2: 変換関数を受ける読み込みの入口（`DocumentSerializer.deserializeShapeElements`）
*   **作業内容** :
    *   `js/io/DocumentSerializer.js`（LFのまま）：静的メソッド`deserializeShapeElements(elements, toShapeData)`を追加。後段（`skipped`の用意・`resolveItems`→`listShapes`・`try/catch`・2つの`#failure`の文言）を非公開`#buildResult(collect)`へ切り出し、`deserialize`と共有（文言・警告・結果は変えない）。図形単位は`ShapeFactory.fromJSON(toShapeData(element))`を`try/catch`し、`#recordSkip(skipped, [position], ...)`で記録、`RangeError`は再送出して全体失敗。責務定義・クラス・`SkippedShape`・`DeserializeResult`のJSDocを合わせた。
    *   `test/io/DocumentSerializer.shapeElements.test.js`（新規・LF）：9件（図形になる・自動の名前・既定の表示／ロック、飛ばしの記録と警告回数、`type`の記録、すべて飛ばす、空配列、配列でない→全体失敗・警告1回、`RangeError`、変換関数が関数でない、引数不変）。`node --test`は tests 3646 / pass 3646 / fail 0。

### タスク3: `source`の無いJSの読み込み（`FileContentReader`）
*   **作業内容** :
    *   `js/io/FileContentReader.js`（CRLFのまま）：`DrawElementReader`をimport。`checkFormat`が`'supported'`の後、`Object.hasOwn(data, 'source')`なら今までどおり`DocumentSerializer.deserialize(data.source)`、無ければ`elements`が配列でないとき`#failure('スプライトのelementsが配列ではありません')`、配列なら`DocumentSerializer.deserializeShapeElements(data.elements, (element) => DrawElementReader.toShapeData(element))`。責務定義（2行）・クラスのJSDocの判別の表と規則を実際に合わせた。
    *   `test/io/FileContentReader.test.js`（LFのまま）：「sourceが無いスプライト」のテストだけを、JSONは読み込み不可のまま・JSは`elements`から組み立てて`ok: true`・`skipped`0件・件数が同じ、に替え、題を合わせた。
    *   題の見直し：替え方Bの題・コメントの`source`を「作業データ」へ（collapsed・items・SpriteSerializer.test の4件・visibility の69・101・143）、替え方Aのテストの題に「今までのJS（source入り）」を足した（FileContentReader 8件）。入力・期待値・行末は変えず、describeの題と`.visibility`・`.items`の先頭の責務定義はT6で直す。
    *   `test/io/FileContentReader.elements.test.js`（新規・LF）：12件（種類ごとの組み立てと書き出し直し・`id`を足しても同じ・名前／表示／ロック／フォルダ・CRLF・版1〜3の形・線なし／塗りなし／太さの不正・読み飛ばし・すべて読めない・`elements`が配列でない3通り・`elements`が空・`source`があれば`elements`を見ない・`source`が不正なら読み込み不可・固定データの版2の今までのJS）。`source`は書き出しの値から`delete`して除き、`id`は`delete`／明示的に足して作り、書き出しの`source`・`id`の有無に依らない。`node --test`は tests 3659 / suites 599 / pass 3659 / fail 0。

### タスク4: 既存のテストの入力を「今までのJSの形」「作業データ」へ替える・`test/io/`
*   **作業内容** :
    *   `test/io/FileContentReader.test.js`（LF）：替え方Aの関数`withSource`を足し、書き出したJS／JSONを読むテスト（5種・図形0個・パス・版2・版4・`formatVersion`書き換え・`sourceあり`のJSON）の入力と`mutatedSprite`の元を`withSource`へ替えた。`makeSpriteData`・「sourceが無い」「`elements`から組み立てる」テストは変えない。
    *   `test/io/SpriteSerializer.test.js`（LF）：`source`の往復・パスの往復・塗れない形の`fillColor`・変換後の図形の4テストを、替え方B（`DocumentSerializer.serialize(同じ入力)`）へ替えた。
    *   `test/io/SpriteSerializer.items.test.js`（LF）：`withSource`を足し、134・149（名前の行）は替え方B、162（JSのテキストを通す往復）は替え方A。
    *   `test/io/SpriteSerializer.visibility.test.js`（CRLF）：隠した図形が戻る3テストは替え方B、JS書き出しを通す往復は替え方A（その場で`source`を足す）。
    *   `test/io/DocumentSerializer.collapsed.test.js`（CRLF）：折りたたみのテストを替え方B（`elements`・`bounds`が変わらないことは残した）。
    *   `test/io/CodeExporter.test.js`（混在。触った行の行末に合わせた）：`DocumentSerializer`をimportし、特殊な文字列のテストの`source`の1行を、替え方Aの入力で書き出したJSの`source.shapes[0].strokeColor`で見る形に替えた。
    *   `node --test`は tests 3659 / pass 3659 / fail 0。

### タスク5: 既存のテストの入力を「今までのJSの形」「作業データ」へ替える・`test/edit/`と`test/check/`
*   **作業内容** :
    *   `test/edit/CanvasFileOperations.test.js`（CRLF）：替え方Aの関数`withSource(values)`を足し、`makeSpriteDataWithSourceShapes`の元・スプライトのJS（開く・インポートの全部／一部／図形0個）・スプライトのJSON（開く・インポートの各2件）の入力を`withSource`へ替えた。
    *   `test/edit/CanvasFileOperations.items.test.js`（LF）：`withSource(items)`を足し、題を「今までのJS（source入り）→開く・インポートも同じ」へ、入力を`CodeExporter.toModuleText(withSource(h.model.getItems()))`へ替えた（`exportSprite`の呼び出しと`downloads`1件の確認は残した）。`SpriteSerializer`・`CodeExporter`をimport。
    *   `test/edit/GroupEditor.flow.test.js`（CRLF）：127は最後の1行を替え方B（まとめる前後の`DocumentSerializer.serialize`が異なる）へ。441は題を「今までのJS（source入り）の…」とし、`sprite`をその場で`source`を足した形へ（替え方A。`elements`3件の確認は残した）。
    *   `test/edit/VisibilityAndLock.flow.test.js`（CRLF）：458は替え方B（`sprite.elements`2件・作業データ`shapes`4件・開くと値が戻る）、題の「sourceには」を「作業データには」へ。
    *   `test/check/SpriteCheckInspector.test.js`（CRLF）：`makeSpriteDataWithSource()`を足し、83の「作業データの版を返す」テストだけその入力へ替えた。
    *   `node --test`は tests 3659 / suites 599 / pass 3659 / fail 0。

### タスク6: 書き出しから`source`を外す
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`（CRLFのまま）：`serialize`が`source`を作らない（戻り値は`format`・`formatVersion`・`bounds`・`elements`）。`DocumentSerializer`のimportを除き、責務定義・typedef`SpriteData`（`source`のプロパティ）・`SPRITE_FORMAT_VERSION`のJSDoc（「版4のまま、`source`を外した…」を足す）・`serialize`・`checkFormat`のJSDocを実際に合わせた。
    *   `js/io/CodeExporter.js`（CRLFのまま）：`HEADER_COMMENT`の該当行から`source`を除いた。
    *   テスト（替え方C・B）：`SpriteSerializer.test.js`（キーの順・図形0個・戻り値を書き換える1行・先頭の責務定義・describeの題）、`SpriteSerializer.items.test.js`（キーの並び・版4のテストを「sourceのキーが無く、作業データは版4で全部の図形を持つ」へ・責務定義）、`SpriteSerializer.visibility.test.js`（キーの並び・責務定義・JS書き出しを通す往復の題を「今までのJS（source入り）」に。新規2件：テキストに`source`・名前・フォルダ・ロック・隠した図形だけが持つ色・座標が無いこと／すべて隠れたときのJSのテキストが図形0個と同じ）、`CodeExporter.test.js`（126。行末は触った行の前後のまま）、`TransformInputEditor.test.js`（365。`source`の版・キーは作業データで見る）、`SpriteCheckInspector.test.js`（`source`のキー自体が無い入力の1行を足した）。
    *   `node --test`は tests 3661 / suites 599 / pass 3661 / fail 0。

### タスク7: `id`で見分けている既存のテストを別の見分け方へ替える
*   **作業内容** :
    *   替え方Dで、`elements`の`id`での見分けを替えた（期待値の並び・観点は変えない。製品コードは変えていない）。
    *   `test/io/SpriteSerializer.test.js`（LF）：頂点を動かした図形の描画順＝`closed`の並び`[false, true]`と矩形の`points[0]`、パスと他の図形の混在＝`strokeWidth`の並び`[2, 4, 6]`、版2のfillColor＝入力の順の`fillColor`の並び、`createTransformed`の6種の並び＝`strokeColor`の並び。
    *   `test/io/SpriteSerializer.items.test.js`（LF）：`kind`と`strokeColor`の並び。
    *   `test/io/SpriteSerializer.visibility.test.js`（CRLFのまま）：`idsOf`を、線の色（`#111111`〜`#444444`）から名前（a〜d）へ引く関数に替えた（関数名・使用箇所・期待値は変えていない）。
    *   `test/edit/ShapeOrderEditor.test.js`（LF）：並べ替えの前に各図形を`translate`（10・20・30・40）し、書き出しの`points[0].x`の並び`[20, 30, 40, 10]`で見る。
    *   行末は`git ls-files --eol`で変わっていないことを確かめた。`node --test`は tests 3661 / suites 599 / pass 3661 / fail 0。

### タスク8: 描画要素から`id`を外す
*   **作業内容** :
    *   `js/shapes/`の`Line`・`Curve`・`Rect`（LF）・`Ellipse`・`Path`（CRLF）：`toDrawElement()`が`id`のキーを作らない（計6か所）。そのJSDocの形・`@returns`・「`id`は検証・補完せず」も合わせた。`toJSON`・`fromJSON`・`createTransformed`は変えていない。
    *   `js/io/SpriteSerializer.js`（CRLF。JSDocのみ）：typedef`DrawElement`の共通のキー・キー列・`@property id`を外し、`SPRITE_FORMAT_VERSION`のJSDocを「版4のまま、`source`と描画要素の`id`を外した…」にした。
    *   テスト（替え方C）：`test/io/SpriteSerializer.test.js`（65・75・87・96・285・499・908・916・924・933・942・951の各行。81・94の`el.id`の行は除き、908の題を「idのキーは無い」へ）、`SpriteSerializer.items.test.js`（`EXPECTED_ELEMENTS`から`id`を除いた。「名前・表示・ロックのキーが出ない」はキーの一覧に`'id'`を足し題を合わせた）、`test/shapes/Line・Curve・Rect・Ellipse・Path.test.js`（`toDrawElement`のキー順・値から`id`を除いた。Ellipseの題「13キー」→「12キー」、Pathの`el.id`の行は「`id`のキーが無い」へ。`toJSON`側・`out.id`の`id`は変えていない）。
    *   行末は`git ls-files --eol`で変わっていないことを確かめた（`test/shapes/Line・Curve・Rect.test.js`はCRLF、`Curve・Line・Rect.js`はLF。実際の行末のまま編集した）。`node --test`は tests 3661 / suites 599 / pass 3661 / fail 0。

### タスク9: 書き出し→組み立て→描画→書き出し直しの往復のテスト
*   **作業内容** :
    *   `test/io/SpriteRoundTrip.test.js`（新規・LF）：24件。製品コードは変えていない。
        *   図形15種（直線・今の曲線・矩形・円・弧・パス9通り＝開／閉×直線だけ／曲線／曲がり方を持つ区間／混ざり／角の点）を、拡大縮小（等倍・縦横別）×反転（なし・左右・上下・両方）×回転（0・30・90・180・37度）の40通りの`createTransformed`にかけ、書き出したJSのテキストを`data:`のURLで実際に読み込んだ`draw`と`FileContentReader`で組み立てた図形で、(a)元の図形・書き出したJS・組み立てた図形の`draw`の描画命令（全メソッドと代入を記録する`Proxy`の偽ctx）、(b)書き出し直した`elements`（キーの並びを含む）・`bounds`を、大きさに対する比1e-9で比べる。
        *   `ellipse`の緩め（輪郭の形／輪郭の点の並び）は、組み立てた図形との比較（(a)の組み立てた図形の`draw`、(b)の書き出し直した`elements`）だけに適用。元の図形と書き出したJSの`draw`は引数どうしをそのまま比べる。
        *   ほか：全種類を1つにしたときの種類・線・塗り・重なり順、変換した図形のまとめ、矩形が4点・4区間の閉じたパスになること、回していない円・約束の位置の弧（拡大縮小だけを含む）は緩めなしでも一致、曲線の区間が曲がり方を持つ区間になること、組み立てた図形を動かす・`createTransformed`した見た目が元に同じ操作をしたものと一致、作業データの往復（`DocumentSerializer`）、書き出しのテキストに`"source"`・`"id"`・`"name"`が無いこと（idつきの図形・名前つきのアイテムの両方）、引数（図形・スプライトデータ・`elements`）を書き換えないこと。
    *   不具合は見つからなかった。`node --test`は tests 3685 / suites 603 / pass 3685 / fail 0。

### タスク10: 開く・インポートの手順のテストと`CanvasFileOperations`のJSDoc
*   **作業内容** :
    *   `js/edit/CanvasFileOperations.js`（CRLFのまま。JSDocのみ2行）：判定の表の1行目を「`source`が読めない・`source`が無く`elements`が配列でない」に、表の下の注記を「スプライトの判別・`source`の取り出し・`source`が無いときの`elements`からの組み立ても」に合わせた。コードは変えていない（差分はコメント行の2行のみ）。
    *   `test/edit/CanvasFileOperations.elements.test.js`（新規・LF）：14件。出力のテキスト（`source`・`id`・名前・フォルダ・隠した図形が無く、ロックした図形は出る）、開く（図形6つ・自動の名前・フォルダなし・表示あり・ロックなし・通知なし・矩形は4点4区間の閉じたパス）、インポート（追加分だけ選択・1件の記録・取り消し1回・やり直し）、一部が読めない（`partialRead`・件数2）、すべて読めない／`elements`が配列でない（`readFailed`・何も変えない）、空（開く＝空のキャンバス・インポート＝`noShapes`）、作業ファイルの出力→開くで同じ、もう一度のエンジン用の出力が同じテキスト、今までのJSを開いて書き出し直すと`source`が無い、`PathJoiner`の結合・`ShapeStyleEditor`の色の変更・`PathCornerEditor`の直線／曲線の切り替え。製品コードは変えていない。`node --test`は tests 3699 / suites 609 / pass 3699 / fail 0。

### タスク11: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`（CRLFのまま。Node.jsのスクリプトで、各置換の一致件数を確かめながら編集。`git ls-files --eol`は`i/lf w/crlf`のまま、`\n`と`\r\n`の数が同じ＝LFだけの行なし）。製品コード・`_doc/arch/`は変えていない。
    *   1章：構成図の`io/`に`DrawElementReader.js`、`test/io/`に`SpriteRoundTrip.test.js`・`DrawElementReader.test.js`、`test/edit/`に`CanvasFileOperations.elements.test.js`を足した。「存在しないもの」から「スプライトの`elements`からの図形の作り直し」を除き、本アプリの形から外れたJSを読まないことは残し、矩形に戻すこと・通る点や角・フォルダ・名前を推し量ること・半周でない弧や1周でない円を表すことを足した。過去のPhaseの「やらないこと」の記述に`source`が出る3か所へ、Phase 11-06aで外した旨を足し、Phase 11-06aでやらないと決めたことの1文を末尾に足した。フォルダ分割の方針の`io/`へ`DrawElementReader`・`deserializeShapeElements`・`FileContentReader`の役割を足した。
    *   2章：作業データの`collapsed`の記述、エンジンとの約束(b)(d)（`source`は今までのJSだけ・`ship.js`は`source`入りの版2で今までどおり開ける・書き出し直すと`source`が無くなる・エンジンへの連絡は11-06b）、スプライトデータの形（4つのキー）、`source`の項（今までのJSだけ）と`elements`・`bounds`の項への分割、描画要素の`id`・キー列（4か所）、`source`の元の値の注記、「2つの版」（版を上げる条件・版の履歴に「版4のまま`source`と描画要素の`id`を外した」・作業データの版は今までのJSの`source.version`）、「エディタで開くときの規則」（`source`のキーの有無での分岐・読み込み不可の条件・組み立ての規則の項＝対応表・スタイル・読み飛ばし・名前・等価な別の値）。「連絡済み」とは書いていない。
    *   3章：9.の折りたたみの扱い・旧版のファイル・書き出しと表示・ロック、ツールのアイコンの`source`入りの注記。624行（現在は638行付近）の`StylePanelView`の`source`は無関係のため変えていない。
    *   監査の指摘で、1章の構成図の`test/io/`に`DocumentSerializer.shapeElements.test.js`（タスク2）・`FileContentReader.elements.test.js`（タスク3）の2行を足した（行末はCRLFのまま）。
    *   確認：`source`・`id`で検索し、実コード（`FileContentReader`・`DrawElementReader`）と食い違う記述が残っていないことを確かめた。10.（確認用ページ）・`toDrawElement`の呼び出しの記述・`SpriteSerializer.computeShapesBounds`の記述は変えていない（実コードと合っている）。

### タスク12: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   `_doc/arch/`の6ファイルを実コードで確かめて更新した（行末は実測のとおり、`12`・`14`・`15`・`16`・`17`はCRLF、`40`はLFのまま。`git ls-files --eol`で変わっていないことを確認。製品コード・テストは変えていない）。
    *   `12_shapes.md`：`toDrawElement()`の項に「描画要素に`id`のキーは無い」、描画要素から図形を戻す知識は`io/DrawElementReader`だけ、新しい図形クラスを足すときの`DrawElementReader`の変換。
    *   `14_edit.md`：`CanvasFileOperations`の依存の項に`source`の有無での読み方・判定の表は変えないこと・出力（エンジン用）に`source`・名前・フォルダ・隠した図形が無いことを足した。`TransformInputEditor`のテストの記述（`SpriteSerializer.serialize`のキー・作業データの版）を直した。
    *   `15_io.md`：`DocumentSerializer`（公開メソッド・呼び出し元・`deserializeShapeElements`の新しい項・`collapsed`の記述・角の点の戻り方）、`DrawElementReader.js`の新しい項（公開・知らないこと・変換の規則・円弧の共役な半径・テスト）、`SpriteSerializer`（`source`・`id`を出さない・戻り値のキー・importから`DocumentSerializer`を除く・`resolveStrokeWidth`の公開・版4のまま外した旨・`kind`を足す手順に`DrawElementReader`）、`FileContentReader`（`source`のキーの有無での経路・`elements`が配列でないとき・importと知らないこと・テスト）。
    *   `16_test.md`：既存のテストの検証範囲の記述（`SpriteSerializer`・`FileContentReader`・`TransformInputEditor`・`SpriteSerializer.items`・`.visibility`・折りたたみ・`GroupEditor.flow`・`SpriteSerializer`の変換の項）を現行に合わせ、Phase 11-06aの新設5ファイル・追加・書き換え・件数（tests 3699 / suites 609 / pass 3699 / fail 0。作業前は tests 3607 / suites 589。テストファイルは133 → 138）の項を、Phase 11-05の件数の項の後ろ（「やらないと決めたこと」の前）へ足した。件数は`node --test`の実測。
    *   `17_sprite_check.md`：`SpriteSerializer`のimportを通じて読み込まれるものを実コードの`core/ItemTreeRules`・`core/ItemStateRules`（・`GroupTreeRules`）へ直し（`DocumentSerializer`・`ShapeFactory`・`shapes/`は読み込まれない）、「作業データの版」は新しいJSで「なし」・今までのJSは数字が出ることを足した。
    *   `40_asset_sprite.md`：現行の書き出しは`source`・`id`を持たないが、2本は版2・`source`入りのままで`ToolIconWiring`が読む`bounds`・`draw`には関係しないことを足した。
    *   確認：`_doc/arch/`全体を`source`・`toDrawElement`・`SpriteSerializer`・`DrawElement`・描画要素の`id`・テストの総件数（3607・3699）で検索した。対象の6ファイルに、実コードと食い違う現行の記述は残っていない（以前のPhaseの項の`source`・`id`は当時の記述で、16の新しい項に「当時の値」と注記）。対象外のファイル（`03_VectorModel`・`37_SpriteFitRules`・`45_TransformInputSettings`・`46_ItemTreeRules`・`63_ItemStateRules`）は`SpriteSerializer`の名前に触れるだけで、`source`・`id`・件数の食い違いは見つからなかった。

## 5. 懸念事項・要確認ポイント
*   **回した・裏返した円・弧の書き出し直しの値**：`Ellipse.#readGeometry`（変えない）の分解の取り方により、`rotation`・`startAngle`・半径の並びが、同じ形を表す別の値になることがある（例：180°回した円の`rotation`がπ→組み立てて書き出し直すと0）。見た目と外枠は丸めの範囲で同じ。REQ要件4の「もう一度書き出した`elements`が丸めの範囲で一致」は、`ellipse`に限り輪郭の比較で確かめる。
*   **表の端の扱い（計画の判断）**：`quadratic`は3点ちょうどだけ（4点以上は`Curve.fromJSON`が断り、読み飛ばす）。1周より多い`ellipse`・開いた1周・閉じた半周は読み飛ばす。どれも本アプリの書き出しには現れない。
*   **組み立てた曲線のパスの編集**：曲線の区間はすべて曲がり方を持つ区間になるため、頂点を動かしてもなめらかにつなぎ直さない。「角」のチェックボックス・「曲線に」が効かないことも、今の曲がり方を持つ区間と同じ（「直線に」は効く）。
*   **今の曲線（`curve`）はツールでは作れない**（曲線のツールはパスを作る）ため、`quadratic`の組み立てはテストで確かめる。
*   **タスク4・5・7**：製品コードを変える前にテストの入力・見分け方だけを替えるタスクを分け、各タスクの終わりで全件合格するようにした。
*   **ツールのアイコンのJS（`select-arrow.js`）**を今までのJSの代わりに使うと、図形はパス1つだけなので「矩形は矩形のまま」は確かめられない。
*   **古いエディタ**（本作業の前のもの）で新しいJSを開くと、`source`が無いため読み込み不可になる（書き出し形式の版を上げない決定のとおり）。
*   **タスク3**：新しいテストのうち「書き出し直すと同じ描画要素」は、円・弧（`ellipse`）の描画要素の値の比較を避け、型・外枠・直線／曲線／パス系の要素の一致のみ確かめた（要件の「等価な別の値」のため）。`FileContentReader.js`の責務定義は3行以内のまま（2行）。
*   **タスク4**：`FileContentReader.test.js`・`SpriteSerializer.items.test.js`に替え方Aの関数`withSource(values)`を置いた（`SpriteSerializer.test.js`・`SpriteSerializer.visibility.test.js`・`DocumentSerializer.collapsed.test.js`は替え方Bで、その場で`DocumentSerializer.serialize`を呼ぶ）。`data.source`が`DocumentSerializer.serialize(items)`と同じことを見ていた行（`SpriteSerializer.test.js` 185・`.visibility` 74・109）は、替え方Bにすると同じ式の比較（自明）になるため除いた（往復・値の確認は残した）。describeの題の`source`・`.visibility`の先頭の責務定義の`source`はT6で直す。
*   **タスク5**：`GroupEditor.flow.test.js`の441・`CanvasFileOperations.items.test.js`は、書き出しの戻り値に`source`を足す形（替え方A）をテスト内に置いた（前者はその場、後者は`withSource`）。`SpriteCheckInspector.test.js`は83のテストだけ`makeSpriteDataWithSource()`にし、`makeSpriteData()`（ほかのテストが使う）は変えていない（`source`のキー自体が無い入力の行はT6で足す）。
*   **タスク6**：実測では`test/io/SpriteSerializer.test.js`・`SpriteSerializer.items.test.js`はLF、`test/io/SpriteSerializer.visibility.test.js`・`test/edit/TransformInputEditor.test.js`・`test/check/SpriteCheckInspector.test.js`はCRLF（計画時のメモのとおり。途中で`.visibility`がLFになっていたのを戻した）。実際の行末のまま編集した。隠した図形の文字列の確認は、現時点の`id`（`a`〜`d`）が出力に残るため、色・座標（`#111111`等・`200`・`210`）で行った（`id`を外すT8の後も変えずに通る）。
*   **タスク7**：`SpriteSerializer.visibility.test.js`の`idsOf`は、線の色が名前と1対1（`makeItems`の4図形）であることに頼る。色を変えるときはこの表（`NAME_BY_STROKE`）も合わせること。`ShapeOrderEditor.test.js`の書き出しの並びは、`translate`した量（`points[0].x`）で見るため、`setupReal`の矩形の元の`x`が0であることに頼る。
*   **タスク8**：`test/io/SpriteSerializer.test.js`の`ellipseWith`（1020行付近）が`toDrawElement`を差し替える入力の`id: 'R'`は、表に無い入力のため残した（読まれないキーなので無害）。実測の行末は`test/shapes/`の`Line`・`Curve`・`Rect`の各テストがCRLF、`js/shapes/`の`Line`・`Curve`・`Rect`はLF。
*   **タスク9**：`test/io/SpriteRoundTrip.test.js`の許容差は`bounds`（`minX`・`minY`・`maxX`・`maxY`。原点を含む）の幅・高さから求める。組み立てた図形との比較で、円・弧の`ellipse`は輪郭の特徴（円＝中心と`A`・`B`・`C`、弧＝媒介変数を16等分した点の並び）へ直して比べる（弧の点の並びは順方向の一致で足り、逆向きの許容は要らなかった）。回していない円・約束の位置の弧は、拡大縮小しても引数そのもので一致した（回す・裏返す場合の値までは見ていない）。
*   **タスク10**：区間の切り替え（`PathCornerEditor`）は区間の両端の点が選ばれていないと効かないため、テストでは3点すべてを選んだ。`CanvasFileOperations.js`のgit上の行末は`i/lf w/crlf`で、作業前から変わっていない（CRLFのまま編集した）。角のチェックボックス（`toggle`）はテストしていない（組み立てた曲線の区間は角の対象外のため）。
*   **タスク11**：`PROJECT_ARCHITECTURE.md`の「存在しないもの」の行は1行が非常に長いため、置換は一致件数を確かめる方式（Node.jsのスクリプト）で行った。Phase 11-05までの「やらないと決めたこと」の記述（歴史的な記述）は、`source`を外した旨を括弧で足すだけにとどめ、当時の文は消していない。確認用ページ（3章10.）は`SpriteSerializer`経由の記述のみで`source`・`DocumentSerializer`に触れていないため変えていない（`_doc/arch/17_sprite_check.md`はタスク12）。
*   **タスク12**：`16_test.md`の以前のPhaseの項（Phase 07-03〜11-05）には、当時の`source`・描画要素の`id`の記述が履歴として多く残る（`SpriteSerializer`の`source`の往復・`id`の確認など）。現行の検証範囲の記述（既存のテストファイルの項・Phase 11-01・11-04aの項の一部）だけ現行に直し、履歴の項は書き換えず、新しい項に「当時の値」と注記した。履歴の項まで直す場合は別の作業で。`15_io.md`の`DrawElementReader`の項は、4章の`io/`が`15_io.md`1つにまとまっているため新設せずここへ足した（`DrawElementReader.test.js`の件数30件は`node --test`の実測）。`16_test.md`の「件数」はテストの総件数のみ実測で書き、新設ファイルの件数のうち`FileContentReader.elements.test.js`は13件（作業時点の実測。タスク3の記述の12件と食い違う）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
※ 2026-11-25、発注者のテストプレイで合格。
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。**今までのJS**（本作業の前に「出力（エンジン用）」したもの。矩形・フォルダ・隠した図形を含む絵がよい）を1つ手元に用意しておく（無ければ`asset/sprite/select-arrow.js`で代える。この場合はパス1つの絵で、矩形・フォルダは確かめられない）。
1.  **書き出し**：直線・曲線・矩形・円・弧・閉じた曲線のパス（曲線のツールで3点以上打ち、描き始めの点で閉じる）を、色・太さ・塗りを変えて描く。いくつかを、外枠の角の外側を引いて回す・反転する・外枠のハンドルで縦横別に伸ばす。`Ctrl`+`G`でフォルダを作って名前を付け、1つを目のアイコンで隠し、1つを鍵のアイコンでロックする。「キャンバス」のウィンドウの「出力（作業ファイル）」と「出力（エンジン用）」を押す。書き出した`.js`をテキストで開くと、`"source"`も、付けた名前も、`"id"`も無い。隠した図形も無い（ロックした図形はある）。
2.  **確認用ページ**：書き出したJSを`sprite-check.html`（「スプライトの確認」）で選ぶと、キャンバスと同じ見た目で描かれる（隠した図形は出ない）。「書き出し形式の版」は4、「作業データの版」は「なし」。
3.  **新しいJSを開く**：「キャンバス」のウィンドウの「開く」で書き出したJSを選ぶと、新しいキャンバス（名前はファイル名から`.js`を除いたもの）が同じ見た目で開く（隠した図形は無い）。一覧にフォルダは無く、名前は「直線 1」「パス 1」などの自動の名前、矩形は「パス」になり、ロックは無い。通知は出ない。
4.  **組み立てた図形の編集**：開いた図形を、選ぶ（`V`）・動かす・外枠で変形する・回す・`A`で頂点を動かす（円・弧には今までどおり頂点が出ない）・色を変える・並べ替える・`Delete`で消すことができる。`Ctrl`+`Z`も効く。曲線だったパスの頂点を動かすと、両側の曲がり方がついていくだけで、なめらかにつなぎ直さない（「角」のチェックボックスと「曲線に」は、曲線だった区間・その両端の点には効かない。「直線に」は効く）。
5.  **書き出し直し**：3.で開いた絵（4.の編集の後でもよい）をもう一度「出力（エンジン用）」して確認用ページで選ぶと、キャンバスと同じ見た目になる。
6.  **インポート**：別のキャンバスで「インポート」から新しいJSを選ぶと、図形だけが追加されて選ばれ、通知は出ない。`Ctrl`+`Z` 1回で取り消せる。
7.  **今までのJS**：用意しておいた今までのJSを開くと、フォルダ・名前・隠した図形まで今までどおり戻る（矩形は矩形のまま。`select-arrow.js`で代えたときは矢印のパスが1つ戻る）。確認用ページでも今までどおり描かれ、「作業データの版」に数字が出る。開いた絵を「出力（エンジン用）」すると、`"source"`の無いJSになる。
8.  **作業ファイル**：1.の作業ファイル（`.ozve.json`）を「開く」で開くと、フォルダ・名前・隠した図形・ロック・矩形・曲線の通る点が全部戻る。
9.  **空**：図形を全部隠して「出力（エンジン用）」したJSを「開く」で開くと、空のキャンバスとして開く（通知は出ない）。「インポート」では「（ファイル名） に追加できる図形がありませんでした。」と出る。
10. **ほかが今までどおり**：ツールパレットの「選択」「頂点の選択」の矢印のアイコンが今までどおり出る。保存（少し待ってからページを開き直す）・コピー・複製・取り消しが今までどおり動く。
