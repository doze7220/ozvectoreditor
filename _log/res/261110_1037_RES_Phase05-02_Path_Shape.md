# RES: 作業計画・作業レポート (Phase 05-02) : パスの図形
* 参照元REQ: `./_log/req/261110_1007_REQ_Phase05-02_Path_Shape.md`

## 1. 作業目的
頂点の並びと「閉じているか」を持つパスの図形クラス（`js/shapes/Path.js`、図形種別`'path'`）を新しく足し、既存の図形と同じように表示・選択・移動・頂点のハンドル操作・削除・複製/コピー＆ペースト・Undo/Redo・作業データの保存と読み込み・スプライトJSの書き出しができるようにする。

本サブフェイズでは**パスを画面上で新しく作る操作は作らない**（作る操作はPhase 05-03の結合・05-04の描き足し）。パスは作業データ（作業データファイル・`?dev`の「JSONから復元」・書き出したスプライトJSの`source`）から読み込まれたときだけ現れる。

既存の作成・選択・移動・ハンドル操作・削除・複製・Undo/Redo・保存の流れは図形クラスの13メソッド契約をポリモーフィックに呼ぶだけで動くため、本作業の中心は次の3点である。
*   13メソッド契約を満たす`Path`クラス（共通の基底クラス・継承は使わない）。
*   読み込みの振り分け（`ShapeFactory.fromJSON`）への登録。図形パレット・数字キー・`ShapeFactory.create`には出さない（読めるが作れない種別）。
*   自動テスト。

`core/`（`ShapeFactory`を除く）・`io/`・`edit/`・`palette/`・`check/`・`main.js`・`index.html`・既存の4つの図形クラス（`Line`・`Curve`・`Rect`・`Ellipse`）は変更しない。作業データの版（`version`）・書き出し形式の版（`formatVersion`）は上げない。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
*   依存の向き：`core/ShapeFactory → shapes/Path → shapes/ShapeGeometry・shapes/ShapeDataValidation`の一方向。`Path.js`は`shapes/`の共通モジュール2つのみを`import`し、`core/`・`ShapeFactory`・`io/`等を`import`しない。
*   変更対象（全タスク合計）：
    *   ソース：`js/shapes/ShapeDataValidation.js`（更新）、`js/shapes/Path.js`（新規）、`js/core/ShapeFactory.js`（更新）。
    *   テスト：`test/shapes/Path.test.js`（新規）、`test/core/ShapeFactory.test.js`（新規。`test/core/`フォルダも新設）、`test/io/DocumentSerializer.roundtrip.test.js`・`test/io/SpriteSerializer.test.js`・`test/io/CodeExporter.test.js`・`test/io/FileContentReader.test.js`（ケースの追加のみ）。
    *   本RES。最終タスクのみ`PROJECT_ARCHITECTURE.md`・`_doc/arch/12_shapes.md`・`_doc/arch/10_ShapeFactory.md`・`_doc/arch/16_test.md`。
*   変更しないことを計画時に実コードで確かめた箇所（パスのために変更が要らない理由）：
    *   `InputTracker`：ハンドルは`hitTestHandle`の戻り値が真値かで判定し（`if (handleName)`）、`'move'`のときだけ移動、それ以外は`getVertexIndexForHandle`→`VectorModel.updateVertex`→`setVertex`。本体は`hitTest`、範囲選択は`intersectsRect`。図形種別による分岐なし。
    *   `VectorModel`：`setVertex`・`translate`へ委譲するのみ。`startDraft`は`ShapeFactory.create`を使うが、種別は`SHAPE_TYPES`の値だけが渡る（パスは`SHAPE_TYPES`に入れない）。
    *   `CanvasManager`：`draw(ctx)`・`drawHover(ctx, viewScale)`・`drawHandles(ctx, viewScale)`を呼ぶのみ。
    *   `DocumentSerializer`：`toJSON()`の結果を並べ、読み込みは`ShapeFactory.fromJSON`を図形単位の`try/catch`で呼ぶ。`ShapeInserter`（貼り付け・複製・インポート）・`SnapshotAdapter`（Undo/Redo）・`CanvasLibrary`・`FileContentReader`・`DevPanel`はすべてここを通る。平行移動は`translate`。
    *   `SpriteSerializer`・`CodeExporter`：要件4で確認（`polyline`で表せるため変更不要）。

### 要件1: パスの図形データの形と検証

#### 1-1. 図形データの形（発注者の決定。キー順もこの順）
```
{ type: 'path', id, points: [{ x, y }, ...], closed: <真偽値>, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth }
```
*   `points`：頂点の並び（始点→終点）。`closed`：`true`／`false`のみ受理。
*   `segments[i]`は`points[i]`→`points[i+1]`の区間。閉じたパスの最後の要素は`points[n-1]`→`points[0]`の区間。要素数は開いたパス`n - 1`、閉じたパス`n`（`n = points.length`）。
*   区間の要素はオブジェクトで`kind`を持つ。本作業で受理する`kind`は`'line'`のみ。区間の要素の余分なキーは無視し、`toJSON`では`{ kind }`だけを出す。
*   頂点数の下限：開いたパス2点以上、閉じたパス3点以上。上限なし。同じ座標の頂点が続く（長さ0の区間）ことは許す。
*   作業データの版（`version`）は上げない（DIRの決定）。

#### 1-2. `validateShapeData`の引数の拡張（`js/shapes/ShapeDataValidation.js`）
*   第4引数`pointCount`の型を`number | { min: number }`に広げる（引数の数・位置・名前は変えない）。
    *   **数値**（既存の4クラスの呼び方）：従来どおり「要素数がちょうど`pointCount`」。判定・エラー文`pointsが${pointCount}要素の配列ではありません`・検査の順序とも1文字も変えない。
    *   **`{ min }`**（パス）：「要素数が`min`以上」。エラー文は`pointsが${min}要素以上の配列ではありません`。
*   判定は`typeof pointCount === 'number'`で2つの形を見分ける（種別による分岐ではなく、引数の形による分岐）。検査の順序（オブジェクトか → `type` → `points`の要素数 → 各頂点 → `strokeColor` → `strokeWidth`）は変えない。
*   既存の4クラスのファイルは変更しない（呼び出しは数値のまま）。既存の`test/shapes/`4ファイルがそのまま通ることで、既存の振る舞いの不変を確かめる。
*   JSDocの`@param`（2つの形と意味）・`@throws`（`points`が`{ min }`のとき`min`要素未満）・関数の説明を更新する。先頭行の責務JSDocは変えない（責務は変わらない）。

#### 1-3. `Path.fromJSON`の検査の順序とエラー文の全文
エラー文はすべて`Path.fromJSON: <理由>`。違反があれば最初の1件だけを`Error`でthrowする。1〜6は`validateShapeData(data, 'Path', ['path'], { min: 2 })`、7〜12は`Path`側で行う。

| 順 | 条件 | `<理由>`（全文） |
| --- | --- | --- |
| 1 | `data`がプレーンオブジェクトでない（`null`・配列・プリミティブ・`undefined`） | `図形データがオブジェクトではありません` |
| 2 | `data.type !== 'path'` | `図形種別が'path'ではありません（${String(data.type)}）` |
| 3 | `points`が配列でない、または要素数が2未満 | `pointsが2要素以上の配列ではありません` |
| 4 | `points[i]`がプレーンオブジェクトでないか`x`・`y`が有限の数値でない（番号の小さい順） | `points[${i}]のx・yが有限の数値ではありません` |
| 5 | `strokeColor`が文字列でない | `strokeColorが文字列ではありません` |
| 6 | `strokeWidth`が有限の数値でないか0以下 | `strokeWidthが正の有限の数値ではありません` |
| 7 | `typeof data.closed !== 'boolean'`（キーなし・`0`/`1`・`'true'`・`null`等） | `closedが真偽値ではありません` |
| 8 | `closed === true`かつ`points`の要素数が3未満 | `閉じたパスのpointsが3要素以上の配列ではありません` |
| 9 | `segments`が配列でない（キーなしを含む） | `segmentsが配列ではありません` |
| 10 | `segments`の要素数が期待値（開いたパス`n - 1`、閉じたパス`n`）と違う | `segmentsが${期待値}要素の配列ではありません` |
| 11 | `segments[i]`がプレーンオブジェクトでない | `segments[${i}]がオブジェクトではありません` |
| 12 | `segments[i].kind`が受理する種類（`'line'`）でない（キーなしを含む） | `segments[${i}]のkindが'line'ではありません（${String(segments[i].kind)}）` |

*   11・12は要素ごとに番号の小さい順に「11→12」を調べてから次の要素へ進む（例：`[ 'x', { kind: 'curve' } ]`は`segments[0]がオブジェクトではありません`）。
*   10の期待値の例：開いた3点のパス→`segmentsが2要素の配列ではありません`、閉じた3点のパス→`segmentsが3要素の配列ではありません`。
*   `id`は検証しない。余分なプロパティ（最上位・区間の要素とも）は無視する。
*   12の文言の`'line'`は受理する種類の定数から作る。曲線の区間を足すとき（パスの編集のPhase）は受理する種類の並びとこの文言・テストを改める。
*   プレーンオブジェクトの判定（11）は`ShapeDataValidation.js`の非公開関数`isPlainObject`を使えないため、`Path.js`の中に同じ条件（`value !== null && typeof value === 'object' && !Array.isArray(value)`）を書く。`ShapeDataValidation.js`の`export`は増やさない（5章参照）。

### 要件2: `Path`クラス（`js/shapes/Path.js`、13メソッド契約）

#### 2-1. モジュールの形
*   先頭行の責務JSDoc（3行以内）案：「責務: パス（頂点の並びと閉じているか・区間の並びを持つ折れ線）のデータ保持・Canvasへの描画処理・当たり判定、および図形データとの相互変換と描画要素（スプライトの書き出し用）への変換を担う。」
*   `import { distanceToSegment, segmentIntersectsRect } from './ShapeGeometry.js';`・`import { validateShapeData } from './ShapeDataValidation.js';`のみ。
*   モジュール内の定数（JSDoc付き。`export`しない）：開いたパスの頂点数の下限`2`、閉じたパスの頂点数の下限`3`、直線の区間の種類`'line'`、受理する区間の種類の並び（`Object.freeze(['line'])`）、頂点のハンドル名の接頭辞`'vertex-'`。
*   `export class Path`。クラスJSDocに図形種別`'path'`、頂点・`closed`・`segments`の約束、13メソッド契約の列挙（既存4クラスと同じ書式：`draw・drawHandles・drawHover・hitTest・hitTestHandle・setVertex・translate・updateDraftEnd・getVertexIndexForHandle・intersectsRect・toJSON・static fromJSON・toDrawElement`）、座標はすべてワールド座標であること、パスは`ShapeFactory.create`では作られない（読み込み専用。作る操作はPhase 05-03・05-04）ことを書く。
*   `try/catch`を持たない。

#### 2-2. コンストラクタと公開プロパティ
*   `constructor(points, closed = false, strokeColor = '#000000', strokeWidth = 2)`（`ShapeFactory.create`の4引数の形には合わせない）。
    *   `points`の各頂点を新しい`{ x, y }`として複製して保持する（引数の配列・頂点を共有しない）。
    *   `segments`は区間の数（`closed ? n : n - 1`）だけ`{ kind: 'line' }`を新しく作る。
    *   引数は検証しない（検証は`fromJSON`のみ。呼び出し側が1-1の約束を満たす値を渡す）とJSDocに書く。
*   公開プロパティ（JSDoc付き）：`type = 'path'`、`id = null`（既存4クラスと同じ説明）、`points`、`closed`、`segments`、`strokeColor`、`strokeWidth`。
*   区間の要素数の不変条件（開いたパス`n - 1`・閉じたパス`n`）はコンストラクタと`fromJSON`で成り立ち、本作業のメソッドは頂点数・`closed`を変えないため保たれる。

#### 2-3. 各メソッド
*   **非公開の補助`#tracePath(ctx)`**：`beginPath` → `moveTo(points[0])` → `lineTo(points[1]…points[n-1])` → `closed`なら`closePath`。`draw`と`drawHover`が共有する。**区間の種類による分岐の置き場所はここ**とする（本作業の区間はすべて直線のため分岐を書かない。曲線の区間を足すときに、ここで`segments[i].kind`により`lineTo`と曲線の命令を分け、閉じる区間が曲線の場合は`closePath`だけでは描けないことに注意する旨をJSDocに書く）。
*   **非公開の補助（区間の両端の列挙）**：区間`i`（`0 ≤ i < 区間の数`、区間の数＝`closed ? n : n - 1`）の両端を`points[i]`と`points[(i + 1) % n]`とし、述語がいずれかの区間で真になるかを返す（`hitTest`・`intersectsRect`が共有）。区間の数は`points.length`と`closed`から求め、`draw`と同じ区間を対象にする。
*   **`draw(ctx, t = 0)`**：`#tracePath(ctx)` → `strokeStyle = strokeColor` → `lineWidth = strokeWidth` → `stroke()`。`t`は`Curve`・`Rect`・`Ellipse`と同じく未使用の予約引数（JSDocに明記）。
*   **`drawHandles(ctx, viewScale = 1)`**：`Rect`と同じ見た目（`fillStyle = '#ffffff'`・`strokeStyle = '#4a90e2'`・`lineWidth = 1.5 / viewScale`、一辺`8 / viewScale`の正方形を頂点中心に`rect` → `fill` → `stroke`）を全頂点に描く。
*   **`drawHover(ctx, viewScale = 1)`**：`#tracePath(ctx)` → `strokeStyle = 'rgba(74, 144, 226, 0.4)'` → `lineWidth = strokeWidth + 6 / viewScale` → `stroke()`（既存と同じ強調）。
*   **`hitTest(x, y, tolerance)`**：全区間（閉じたパスは終点→始点を含む）で`distanceToSegment(...) <= tolerance`のいずれかが真なら`true`。`strokeWidth`は許容誤差に足さない（`Line`・`Rect`と同じ）。塗り内部は判定しない。
*   **`intersectsRect(minX, minY, maxX, maxY)`**：全区間（同上）で`segmentIntersectsRect(...)`のいずれかが真なら`true`（境界を含む）。塗り内部だけを囲む場合は`false`。
*   **ハンドル名の形**：`'vertex-<i>'`（`<i>`は頂点の番号の10進表記。先頭の0なし。例`'vertex-0'`・`'vertex-12'`）。番号`0`でも空でない文字列になるため、`InputTracker`の`if (handleName)`で偽にならない。`'move'`は返さない。
*   **`hitTestHandle(x, y, tolerance)`**：頂点を番号の小さい順に調べ、`Math.hypot(x - px, y - py) <= tolerance`の最初の頂点のハンドル名を返す。該当なしは`null`。
*   **`getVertexIndexForHandle(handleName)`**：`handleName`が文字列で`/^vertex-(0|[1-9][0-9]*)$/`に一致し、番号が`0 ≤ i < points.length`なら`i`、それ以外（`'move'`・`null`・数値・`'vertex-01'`・`'vertex--1'`・`'vertex-1.5'`・範囲外の番号・他クラスのハンドル名等）は`null`。例外を投げない。
*   **`setVertex(vertexIndex, x, y)`**：`Number.isInteger(vertexIndex)`かつ`0 ≤ vertexIndex < points.length`なら`points[vertexIndex] = { x, y }`。それ以外（`null`・文字列・小数・負・範囲外・`NaN`）は何もしない。例外を投げない。
*   **`translate(dx, dy)`**：全頂点の`x`・`y`へ加算する。
*   **`updateDraftEnd(x, y)`**：`setVertex(points.length - 1, x, y)`（終点を動かす）。本サブフェイズでは呼ばれない（パスは作成中の図形にならない）旨をJSDocに書く。
*   **`toDrawElement()`**：`{ kind: 'polyline', id, points: 各頂点の複製, closed: this.closed, strokeColor, strokeWidth }`（キー順もこの順）。区間の種類は出さない。`id`・`strokeColor`・`strokeWidth`は検証・補完せずそのまま入れる。配列・頂点を共有しない。
*   **`toJSON()`**：`{ type: this.type, id, points: 各頂点の複製, closed, segments: 各区間を { kind } として複製, strokeColor, strokeWidth }`（1-1のキー順）。配列・頂点・区間の要素を共有しない。`JSON.stringify(path)`でもこの戻り値が出力される。
*   **`static fromJSON(data)`**：1-3の検証 → `new Path(data.points, data.closed, data.strokeColor, data.strokeWidth)`（コンストラクタが頂点を複製）→ `path.segments = data.segments.map((segment) => ({ kind: segment.kind }))` → `path.id = data.id` → 返す。`data`内の配列・オブジェクトを流用しない。`@throws`に1-3の全条件を列挙する。往復（`toJSON`→`fromJSON`）で図形データの内容と描画・当たり判定の結果が一致する。

### 要件3: 読み込みの振り分けへの登録（`js/core/ShapeFactory.js`）
*   **読めるが作れない種別の表し方**：`SHAPE_REGISTRY`の1エントリとして`{ type: 'path', create: null, fromJSON: (data) => Path.fromJSON(data) }`を**末尾（`circle`の後）**に足す。`create: null`を「作れない（図形パレット・数字キーに出さない。読み込み専用）」の印とする。
    *   `SHAPE_TYPES`は`SHAPE_REGISTRY.filter((entry) => entry.create !== null).map((entry) => entry.type)`で導出する。結果は従来と同じ5種・同じ並び（`['line', 'curve', 'arc', 'rect', 'circle']`）。
    *   `REGISTRY_BY_TYPE`（`fromJSON`の振り分け用）は全エントリ（パスを含む）から作る（従来どおり）。
    *   `create`は「エントリが無い、またはエントリの`create`が`null`」のとき、従来と同じ`Error`（`ShapeFactory: unknown shape type "${type}"`）をthrowする。`create('path', …)`の文言は未知の種別と同じ。
    *   種別一覧の正本は`SHAPE_REGISTRY`の1箇所のまま（表を2つに分けない）。対応づけは表引きのみで、`if`は表の値（エントリの有無・`create`が`null`か）の判定だけであり種別による分岐ではない。`switch`は持たない。
*   JSDocの更新：`ShapeRegistryEntry`の`create`の型を`((x1, y1, x2, y2) => Object) | null`とし、`null`の意味を書く。`SHAPE_REGISTRY`の説明（並び順＝パレット・数字キーの順は`create`が`null`でないエントリについてのもの。読み込み専用のエントリはパレットのボタン不要）・`SHAPE_TYPES`の説明（作成できる種別のみ。`create`が`null`のエントリを除く）・`fromJSON`の`@returns`（`Path`を足す）・`@param`・`@throws`（「`SHAPE_TYPES`に含まれない」→「対応表に無い」）を改める。`create`の`@throws`に「`create`が`null`の種別（`'path'`）」を足す。先頭行の責務JSDocは変えない（責務は変わらない）。
*   `import { Path } from '../shapes/Path.js';`を足す（`shapes/`のみの`import`という依存の制約は保たれる）。
*   `InputTracker`・`KeyboardShortcuts`・`PaletteController`・`VectorModel`・`main.js`・`index.html`は変更しない（`SHAPE_TYPES`の値・並びが変わらないため）。

### 要件4: スプライトJSの書き出し（`formatVersion`は上げない。`io/`は変更しない）
計画時に実コードで次を確かめた。
*   **描画命令の一致**：`js/io/CodeExporter.js`の`DRAW_SOURCE`の`drawElement`の`polyline`は「`strokeColor`が文字列か → `points`が2点以上の配列か → `beginPath` → `moveTo(points[0].x, points[0].y)` → `for (i = 1; i < points.length; i++) lineTo(points[i].x, points[i].y)` → `element.closed === true`なら`closePath` → `strokeStyle = strokeColor` → `lineWidth = strokeWidth（正の有限の数値でなければ2）` → `stroke()`」。`Path.draw`（2-3）は「`beginPath` → `moveTo(points[0])` → `lineTo(points[1]…points[n-1])` → `closed`なら`closePath` → `strokeStyle` → `lineWidth` → `stroke()`」で、命令・引数・順序が一致する（`fromJSON`を通ったパスは`strokeColor`が文字列・`strokeWidth`が正の有限の数値・`closed`が真偽値・頂点2点以上のため、`DRAW_SOURCE`の分岐はすべて同じ側を通る）。閉じる区間は両者とも`closePath`で描き、`lineTo(points[0])`は出さない。
*   **外枠**：`js/io/SpriteSerializer.js`の`polylineRange`は`element.points`の全頂点の`x`・`y`の最小・最大を取り、`#computeBounds`が線の太さの半分だけ広げる。パスの描画要素は全頂点を持つため正しく求まる（閉じる区間は頂点の凸包の内側にあり範囲を広げない）。
*   **描画要素の形**：書き出し形式の版1の`polyline`（`{ kind: 'polyline', id, points, closed, strokeColor, strokeWidth }`、頂点数の制限なし・2点以上）でそのまま表せる。区間の種類は描画要素に出さない（本作業の区間はすべて直線のため）。
*   **結論**：`io/`の変更・`formatVersion`の版上げは不要。エンジンとの約束(c)の連絡票も不要（エンジンが読む`draw(ctx)`の約束・`elements`の形と意味は変わらない）。
*   書き出したJSを開き直す経路（`FileContentReader` → `source` → `DocumentSerializer.deserialize` → `ShapeFactory.fromJSON`）は要件3の登録でパスを復元する。
*   曲線の区間を足すとき（パスの編集のPhase）に`polyline`で表せなくなることは5章に記録する。

### 要件5: 自動テスト
`_doc/arch/16_test.md`の規則に従う：`node:test`・`node:assert/strict`のみ、先頭行に単一責務のJSDoc（3行以内）、補助関数にJSDoc（`@param`・`@returns`）、公開APIのみを通す（テストのためにソースを書き換えない）、`globalThis`・`window`へ代入しない、`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止、図形の`id`は公開プロパティへ文字列を直接代入する。既存のテストファイルにはケース（と、そのケースだけが使う補助関数・`import`）を足すだけとし、既存のケース・補助関数を書き換えない。

#### 5-1. `test/shapes/Path.test.js`（新設）
*   先頭行の責務JSDoc案：「責務: パス（Path）の当たり判定（hitTest・intersectsRect）・頂点のハンドル（hitTestHandle・getVertexIndexForHandle・setVertex）・fromJSONの不正な図形データのエラー文・図形データと描画要素への変換を、公開APIのみを通して検証する。」
*   標準の図形の例：頂点`(0,0)`・`(100,0)`・`(100,100)`・`(0,100)`の開いたパス（区間3）と、同じ頂点の閉じたパス（区間4。終点→始点の区間は`x = 0`の縦線）。許容誤差は5を基本にする。
*   補助関数（JSDoc付き）：正常な図形データを作る`makeValidData(closed)`（呼ぶたびに新しいオブジェクト。`id`を入れた`toJSON()`の戻り値）、`assertFromJSONError(data, reason)`（`{ name: 'Error', message: 'Path.fromJSON: ' + reason }`で全文一致）、標準のパスを作る関数。
*   `describe('Path.hitTest')`：開いた／閉じたそれぞれで、区間の上は当たる／塗り内部（中央）は当たらない／許容誤差ちょうど（区間から距離5）は当たる／許容誤差の外（距離6）は当たらない／始点・終点の外側の延長上（端点から距離6）は当たらない（開いたパス）／**終点→始点の区間上（例`(0, 50)`）は閉じたパスだけが当たり、開いたパスは当たらない**／頂点を動かした後・平行移動した後の区間で判定する／長さ0の区間を含むパス（例`(0,0)`・`(0,0)`・`(100,0)`）でも区間上が当たり例外を投げない／`strokeWidth`を大きくしても許容誤差に足されない。
*   `describe('Path.intersectsRect')`：矩形が区間に掛かる／パス全体を内側に含む／（閉じたパスの）塗り内部だけを囲む場合は`false`／完全に外れる場合は`false`／境界にちょうど接する場合は`true`／**終点→始点の区間だけに掛かる矩形（例`(-5,40)-(5,60)`）は閉じたパスだけが`true`**／頂点を動かした後・平行移動した後／長さ0の区間を含む場合。
*   `describe('Path の頂点のハンドル')`：各頂点の位置で`hitTestHandle`が`'vertex-<i>'`を返し、`getVertexIndexForHandle`で`i`に解決でき、`setVertex(i, …)`でその頂点だけが動く／頂点以外（区間の中ほど等）では`null`で、`'move'`を返さない／ハンドルが重なる（同じ座標・許容誤差内の近い頂点）ときは番号の小さい頂点が選ばれる／`getVertexIndexForHandle`は不正な名前（`'move'`・`'start'`・`'vertex-'`・`'vertex-01'`・`'vertex--1'`・`'vertex-1.5'`・範囲外の番号・`null`・`undefined`・数値`0`）で`null`を返し例外を投げない／`setVertex`は範囲外・不正な番号（`-1`・`n`・`1.5`・`null`・`'1'`・`NaN`）で例外を投げず`toJSON()`が変わらない／`updateDraftEnd`は終点だけを動かす／`translate`は全頂点を動かす。
*   `describe('Path.fromJSON のエラー文')`：正常なデータ（開いた・閉じた・2点の開いたパス・3点の閉じたパス・長さ0の区間を含む）は例外を投げず`toJSON()`が元のデータと一致する／1-3の表の全理由の全文（共通項目：オブジェクトでない（`null`・`[]`・`'path'`・`42`・`undefined`）・種別の不一致（他の種別・キーなし）・頂点数が下限未満（1点・0点・キーなし・配列でない）・頂点の座標が有限の数値でない（`NaN`・`Infinity`・文字列・頂点が`null`。何番目かを添える）・`strokeColor`が文字列でない・`strokeWidth`が0以下／有限でない。パス固有：`closed`が真偽値でない（キーなし・`1`・`'true'`・`null`）・閉じたパスの頂点数が3未満（2点）・`segments`が配列でない（キーなし・オブジェクト）・要素数の不一致（開いた／閉じたそれぞれで多い・少ない）・要素がオブジェクトでない（`null`・`'line'`・配列）・未知の`kind`（`'curve'`・キーなし））／検査の順序（複数の違反を同時に持つデータで先の理由が出ること。少なくとも「頂点の不正と`strokeColor`の不正→頂点」「`strokeWidth`の不正と`closed`の不正→`strokeWidth`」「`closed`の不正と`segments`の不正→`closed`」「閉じた2点と`segments`の要素数の不一致→頂点数」「`segments`の要素数の不一致と要素の不正→要素数」「`segments[0]`の未知の`kind`と`segments[1]`がオブジェクトでない→`segments[0]`」）／余分なプロパティ（最上位・区間の要素）は無視され`toJSON()`に出ない／`id`は検証されずそのまま保持される（数値・`undefined`）。
*   `describe('Path の toJSON・fromJSON・toDrawElement')`：`toJSON`のキー順（`type, id, points, closed, segments, strokeColor, strokeWidth`）と中身（開いた／閉じた）／往復で`toJSON()`・`hitTest`・`intersectsRect`の結果が一致／独立性：`toJSON()`の戻り値の配列・頂点・区間の要素を書き換えても元が変わらない、`fromJSON`へ渡した`data`の配列・頂点・区間の要素を後から書き換えても復元したパスが変わらない（逆も）、コンストラクタへ渡した配列・頂点を書き換えてもパスが変わらない／`toDrawElement`の中身（`{ kind: 'polyline', id, points, closed, strokeColor, strokeWidth }`、キー順、開いた`closed: false`・閉じた`closed: true`、閉じたパスでも頂点は`n`個で始点を重複させない、`segments`を含まない）と独立性。
*   必要なら`draw`・`drawHover`の描画命令の並びを、メソッド呼び出しとプロパティ代入を記録する偽の`ctx`（テストファイル内の素のオブジェクト）で確かめてよい（閉じたパスだけ`closePath`が入ること）。

#### 5-2. `test/core/ShapeFactory.test.js`（新設。`test/core/`フォルダも新設）
*   先頭行の責務JSDoc案：「責務: ShapeFactoryの種別一覧（SHAPE_TYPES）・生成（create）・図形データからの復元の振り分け（fromJSON）を、公開APIのみを通して検証する。」
*   `SHAPE_TYPES`が`['line', 'curve', 'arc', 'rect', 'circle']`のまま（5種・この並び・`'path'`を含まない）で、凍結されている。
*   `create`：`SHAPE_TYPES`の各種別で`type`が一致する図形を返す。`create('path', 0, 0, 10, 10)`は`{ name: 'Error', message: 'ShapeFactory: unknown shape type "path"' }`をthrowする（未知の種別`'triangle'`と同じ形の文言）。
*   `fromJSON`：開いたパス・閉じたパスの図形データから`Path`のインスタンスを返し、`toJSON()`が元と一致する。不正なパスの図形データでは`Path.fromJSON`の`Error`がそのまま伝わる（例：`closed`が真偽値でない→`Path.fromJSON: closedが真偽値ではありません`）。オブジェクトでない入力・未知の種別のエラー文は従来どおり（`ShapeFactory.fromJSON: 図形データがオブジェクトではありません`・`ShapeFactory.fromJSON: 未知の図形種別です: triangle`）。

#### 5-3. `test/io/DocumentSerializer.roundtrip.test.js`（ケースの追加のみ）
*   既存の`assertSameShape`は`POINT_COUNTS[expected.type]`を使うためパスには使えない。パス用の補助関数（例：`assertSamePath(actual, expected)`：別インスタンス・`constructor`が同じ・`toJSON()`が一致・`points`・`closed`・`segments`・`strokeColor`・`strokeWidth`が一致）と、パスと既存の5種の混在を確かめる補助関数を**新しく足す**（既存の補助関数は書き換えない）。`import { Path } from '../../js/shapes/Path.js';`を足す。
*   `describe('path の往復')`：オブジェクト層・文字列層の両方で、開いたパス（3点以上）・閉じたパス・2点の開いたパス・頂点を動かした・平行移動した・線の色と太さを変えた・長さ0の区間を含む、が元と同じ図形に戻り、`console.warn`が0回。
*   既存の5種と開いた／閉じたパスの混在（例：`rect`・開いたパス・`line`・閉じたパス・`circle`・`curve`・`arc`）の往復で、描画順（`type`の並び）・`id`・各図形の内容が保たれる（両層）。
*   先頭行の責務JSDocの「5種の図形」は、パスを含む記述へ改めてよい（責務の記述を実態に合わせるため。ケースの書き換えではない）。

#### 5-4. `test/io/SpriteSerializer.test.js`（ケースの追加のみ）
*   `describe('SpriteSerializer.serialize: パス')`：開いたパス→`{ kind: 'polyline', id, points, closed: false, strokeColor, strokeWidth }`（キー順・`segments`なし）、閉じたパス→`closed: true`・頂点`n`個／開いた・閉じたパスの外枠（全頂点の最小・最大を線の太さの半分だけ広げた値。閉じる区間で範囲が変わらないこと）／パスと他の図形の混在で描画順と外枠の和／`source`を`DocumentSerializer.deserialize`で戻すと`closed`・`segments`を含めて元と同じ。`import { Path } ...`を足す。

#### 5-5. `test/io/CodeExporter.test.js`（ケースの追加のみ）
*   既存の`assertSameAsEditor`（偽の`ctx`で各図形の`draw`の記録と書き出した`draw`の記録を`deepStrictEqual`）を使い、`describe('CodeExporter.toModuleText: 見た目の一致（パス）')`に、開いたパス・閉じたパス・2点の開いたパス・頂点を動かした／平行移動したパス・長さ0の区間を含むパス・既存の5種との混在（描画順）を足す。`import { Path } ...`を足す。
*   必要なら`extractSpriteDataText`でパスを含む`toModuleText`の出力から取り出した値が元と一致することを足してよい。

#### 5-6. `test/io/FileContentReader.test.js`（ケースの追加のみ）
*   `describe('FileContentReader.deserializeFromText: パスを含むスプライト')`：パス（開いた・閉じた）と既存の5種を含むキャンバスを書き出したJS（LF・CRLF）から、パスを含む全図形が元どおりに戻る（`toJSON()`の並びと内容、復元した図形が`Path`のインスタンスで`closed`・`segments`が一致）。既存の補助関数`assertRestored`・`toJsonList`はそのまま使ってよい。`import { Path } ...`を足す。

### 要件6: テストプレイの準備と確認項目
*   テストプレイ用のパスを含む作業データファイルは現場設計AIがテストプレイ時に用意する（リポジトリには含めない）。実装AIは作成しない。
*   確認項目は5章に、操作手順と期待する結果の形で列挙する。

### 要件7: 開発資料への記載
下の「開発資料の更新予定」に記載先と内容を列挙し、最終タスク（タスク10）で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形ドメイン（`Path.js`の新設、`ShapeDataValidation.js`の引数の拡張）
    *   `./js/core/` - `ShapeFactory.js`のみ（対応表へのパスの登録。読めるが作れない種別の表し方）
    *   `./test/shapes/`・`./test/core/`（新設）・`./test/io/` - 自動テスト
*   **関連する論理クラス・モジュール**:
    *   `Path`（新設。具象の図形クラス。共通の基底クラスを持たず13メソッドを自律実装）
    *   `ShapeDataValidation`（`validateShapeData`の第4引数を`number | { min }`へ拡張）
    *   `ShapeGeometry`（変更なし。`distanceToSegment`・`segmentIntersectsRect`を`Path`が使う）
    *   `ShapeFactory`（`SHAPE_REGISTRY`へ`create: null`のエントリを追加。`SHAPE_TYPES`の導出と`create`の判定を変更）
    *   変更しないが関係するもの：`Line`・`Curve`・`Rect`・`Ellipse`、`DocumentSerializer`（`fromJSON`の例外を図形単位で捕捉）、`SpriteSerializer`（`polyline`の外枠）、`CodeExporter`（`DRAW_SOURCE`の`polyline`）、`FileContentReader`、`InputTracker`・`KeyboardShortcuts`・`PaletteController`・`VectorModel`・`CanvasManager`（`SHAPE_TYPES`・13メソッドのポリモーフィックな呼び出し）

### 参照する責務
*   （`PROJECT_ARCHITECTURE.md` 1章）**依存方向**：`main.js → edit → io → core → shapes`の一方向。`shapes/`：1種類の図形（図形クラス。種別ごとに1ファイル）と、図形クラスだけが使う共通の関数（幾何の計算・図形データの検証。継承ではなく関数の切り出し）。`test/`：依存は`test/ → js/`の一方向で、`index.html`・`js/`は`test/`を参照しない。
*   （`PROJECT_ARCHITECTURE.md` 2章）**図形データ**（1図形のJSON表現）：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`。各図形クラスの`toJSON()`/`static fromJSON(data)`で相互変換する。`fromJSON`直後の`id`は未検証・未正規化。図形クラスは常に現行版の図形データのみを扱う。**描画要素**：`"polyline"`：`kind, id, points: [{x, y}, ...], closed, strokeColor, strokeWidth`。`beginPath` → `moveTo(points[0])` → `lineTo`（i=1…）→ `closed`なら`closePath`。どの`kind`もパスの後に`strokeStyle` → `lineWidth` → `stroke()`（エディタの各図形の`draw`と同じ順・同じ命令）。書き出し形式の版は、エンジンが読む部分（`elements`の形と意味等）が変わったときに上げ、上げるときはエンジンへ連絡票を出す（約束(c)）。外枠：`polyline`は全頂点。
*   （`_doc/arch/12_shapes.md`）**shapes/**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。座標はすべてワールド座標。共通基底クラスは無い。共通の幾何の計算と図形データの検証は共通モジュール（`ShapeGeometry.js`：`distanceToSegment`・`segmentIntersectsRect`・`quadraticBezierPoint`、`ShapeDataValidation.js`：`validateShapeData`）の関数を呼び、図形クラスへ複製しない。共通モジュールは状態を持たない`export`した関数のみで、`import`するのは`shapes/`の図形クラスのみ。共通モジュールの式を変えるときは`test/shapes/`の全テストを確かめる。
    *   **13メソッド契約**：`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`、`intersectsRect(minX, minY, maxX, maxY)`、`toDrawElement()`、`toJSON()`、`static fromJSON(data)`。各図形クラスのクラスJSDocは契約を列挙している。図形種別を追加したら`test/shapes/<クラス名>.test.js`へ当たり判定と`fromJSON`のエラー文のテストを、`test/io/DocumentSerializer.roundtrip.test.js`へ往復のケースを、`test/io/SpriteSerializer.test.js`・`test/io/CodeExporter.test.js`へスプライトのケースを足す。
    *   **ハンドル名の契約**：移動ハンドルの名前は`'move'`固定（`InputTracker`がこの名前で分岐する）。`'move'`以外のハンドル名は、`getVertexIndexForHandle`で有効な番号に解決できなければならない。
    *   **`intersectsRect`**：引数はワールド座標の正規化済み軸平行矩形（境界を含む）。輪郭線の中心線（`strokeWidth`は含めない）が一部でも掛かれば`true`。塗り内部は判定しない。
    *   **`toDrawElement()`**：毎回新しいオブジェクト・頂点を作り、内部配列・頂点を共有しない。値は`draw`と同じ式で求める。呼び出し元は`SpriteSerializer`のみ。`draw`の式を変えたら`toDrawElement`・`io/CodeExporter.js`の描画処理・`test/io/CodeExporter.test.js`を揃える。
    *   **`viewScale`**：`drawHandles`/`drawHover`の補助表示を画面上一定に保つため`÷ viewScale`で換算する。
    *   **`toJSON`/`fromJSON`**：どちらの方向でも内部配列・頂点オブジェクトを共有しない（`data`内の配列・オブジェクトも流用しない）。`fromJSON`は不正な入力で`Error`をthrowする（`strokeWidth`の0以下も不正）。`id`は検証せずそのまま保持する。余分なプロパティは無視する。各図形クラス・`ShapeFactory`は`try/catch`を持たない（捕捉は`DocumentSerializer`）。往復で図形データの内容と描画・当たり判定の結果は一致する。
*   （`_doc/arch/10_ShapeFactory.md`）**ShapeFactory.js**：図形種別一覧の正本（対応表）と、種別に応じたインスタンス生成・図形データからの復元の振り分けを担う。対応づけは対応表の表引きのみで行い、if/switch分岐は持たない。状態は持たない。`SHAPE_REGISTRY`が唯一の正本で、`SHAPE_TYPES`はこれから導出する（他モジュールは種別一覧を自前で列挙しない）。並び順＝図形パレットのボタン順＝数字キーの割り当て順＝`InputTracker`の図形種別の初期値・`VectorModel.startDraft`の既定値（先頭要素）。`shapes/`のみをimportし、`core/`内の他モジュールをimportしない。`shapes/`も`ShapeFactory`・`core/`をimportしない。
*   （`_doc/arch/16_test.md`）`node:test`・`node:assert/strict`のみで書き、プロジェクトのルートの`node --test`で実行する。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。共有の補助モジュールを置かず、補助関数は各テストファイルの中に書く。先頭行に単一責務のJSDoc（3行以内）。補助関数にもJSDoc（`@param`・`@returns`）。公開APIのみを通す。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。図形の`id`は公開プロパティ`id`へ文字列を直接代入する。エディタの描画との一致は、描画命令を記録する偽の`ctx`で各図形の`draw`の記録と書き出した`draw`の記録を`deepStrictEqual`で比べる。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章 フォルダ構成**：
    *   `js/shapes/`に`Path.js`を`Ellipse.js`の次に足し、`# 図形クラスは種別ごとに1ファイル`の注記を`Path.js`の行へ移す。
    *   `test/`に`core/ShapeFactory.test.js`（`test/core/`。`shapes/`の前）と`shapes/Path.test.js`を足す。
*   **`PROJECT_ARCHITECTURE.md` 2章「図形（Shape）」**：頂点の保持形式を「`Line`は`x1, y1, x2, y2`、`Curve`/`Rect`/`Ellipse`/`Path`は`points`配列（`Path`は頂点数が可変で、`closed`・`segments`も持つ）」に改める。
*   **`PROJECT_ARCHITECTURE.md` 2章「図形データ」**：「全図形共通で`{ type, id, points, strokeColor, strokeWidth }`」を共通の項目とし、種別により項目を足すこと（`path`）を書く。パスの項を足す：`{ type: 'path', id, points, closed, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth }`（キー順）、`closed`は真偽値のみ、区間の約束（`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`、要素数は開いた`n - 1`・閉じた`n`、`kind`は現在`'line'`のみ、曲線の区間は`kind`の値と区間の要素のキーを足して拡張する、区間の要素の余分なキーは無視）、頂点数の下限（開いた2・閉じた3、上限なし、長さ0の区間は可）、パスの追加では作業データの版を上げていない（古いエディタでは未知の図形種別として図形単位でスキップされる。発注者の決定）。
*   **`PROJECT_ARCHITECTURE.md` 2章「描画要素」**：`"polyline"`の対象を（`line`・`rect`・`path`）にし、「`path`は`closed`のとおり・全頂点（閉じたパスも始点を重複させない）。区間の種類は描画要素に出さない（区間がすべて直線の間のみ`polyline`で表せる）」を足す。
*   **`_doc/arch/12_shapes.md`**：
    *   13メソッドを自律実装するクラスの列挙に`Path`を足す（「`Line`/`Curve`/`Rect`/`Ellipse`/`Path`」）。`draw`のシグネチャの記述の「他3クラス」を`Path`を含む記述に改める（`Path`も`draw(ctx, t = 0)`で`t`は未使用）。
    *   「新規図形を追加する際は…（`ShapeFactory`の対応表への登録とボタンは必要）」に、読み込み専用の種別（`create: null`）はボタン不要であることを足す（詳細は`10_ShapeFactory.md`）。
    *   `intersectsRect`の「`Line`・`Rect`は線分の厳密判定」に`Path`を足す。`toDrawElement()`の「`Line`・`Rect`は`polyline`」に`Path`を足す。
    *   「変換の変更時の注意」に、`validateShapeData`の頂点数は数値（ちょうどその数）か`{ min }`（その数以上。`Path`が使う）を渡すこと、`Path.fromJSON`はコンストラクタが`data`の頂点を複製して生成し区間を`data.segments`の`kind`から作り直すこと、パス固有の項目（`closed`・閉じたパスの頂点数・`segments`）は`Path`側で検証すること（検査は共通項目の後）を足す。
    *   **Path.js**の節を新設：頂点数可変の`points`・`closed`・`segments`（約束は2章「図形データ」）。`ShapeFactory.create`では作られない（読み込み専用。作る操作はPhase 05-03・05-04）。`hitTestHandle`の戻り値は`'vertex-<i>'`（`<i>`は頂点の番号の10進表記・先頭の0なし）か`null`、番号の小さい順の先着1件、`move`ハンドルは持たない（本体のドラッグで移動）。`getVertexIndexForHandle`は`'vertex-<i>'`を範囲内の番号へ解決し、それ以外は`null`。`setVertex`は範囲外・整数でない番号では何もしない。`updateDraftEnd`は終点を動かす（本サブフェイズでは呼ばれない）。`hitTest`は`strokeWidth`を許容誤差に足さない。閉じたパスは終点→始点の区間も描画・当たり判定・範囲選択の対象。曲線の区間を足すときは、描画・当たり判定・範囲選択・`toDrawElement`のすべてで区間の種類による分岐が要り、`polyline`で表せなくなるため新しい`kind`と書き出し形式の版の判断（エンジンへの連絡票）が要ること（やらないと決めたこと／将来の注意）。区間の要素数の不変条件は頂点の追加・削除・閉じる/開く操作を足すときに保つこと。
*   **`_doc/arch/10_ShapeFactory.md`**：
    *   対応関係に`path`→`Path`を足す。
    *   **読めるが作れない種別**の項を足す：`SHAPE_REGISTRY`のエントリの`create`を`null`にする（現在は`path`のみ）。`SHAPE_TYPES`は`create`が`null`でないエントリだけから導出する（図形パレット・数字キー・作成できる種別に出ない）。`create`へ渡すと未知の種別と同じ`Error`。`fromJSON`は振り分ける。表は1つのまま（種別一覧の正本は1箇所）。
    *   **並び順**の記述は`create`が`null`でないエントリについてのものであることを足す（読み込み専用のエントリは末尾に置いている）。
    *   **図形種別の追加手順**に、読み込み専用の種別は③（パレットのボタン）が不要であることを足す。
*   **`_doc/arch/16_test.md`**：
    *   「既存のテストファイルと検証範囲」に`test/shapes/Path.test.js`（5-1の観点）と`test/core/ShapeFactory.test.js`（5-2の観点）を足す。
    *   `test/io/DocumentSerializer.roundtrip.test.js`・`test/io/SpriteSerializer.test.js`・`test/io/CodeExporter.test.js`・`test/io/FileContentReader.test.js`の記述に、パス（開いた・閉じた）のケースを足す（5種→5種とパス）。
    *   `ShapeDataValidation`の`{ min }`の形は`Path`のテストを通して確かめていることを足す（「共通モジュールの関数そのもののテストは無く、図形クラスのテストを通して確かめている」に含める）。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する。資料本体への反映はタスク10で行う。）

## 3. タスクリスト
*   [x] タスク1: `validateShapeData`の頂点数の引数の拡張
    *   **対象ファイル** :
        *   `./js/shapes/ShapeDataValidation.js` :（更新）
    *   **作業内容** :
        *   2章要件1の1-2のとおり、第4引数`pointCount`に`{ min: number }`の形を受け付けるようにする。数値のときの判定・エラー文・検査の順序は1文字も変えない。`{ min }`のときのエラー文は`pointsが${min}要素以上の配列ではありません`。
        *   `validateShapeData`のJSDoc（関数の説明・`@param pointCount`の2つの形・`@throws`）を更新する。先頭行の責務JSDocは変えない。
        *   既存の4クラス（`Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`）と既存のテストは変更しない。
        *   プロジェクトのルートで`node --test`を実行し、`fail 0`と件数を4章の本タスクの欄へ記録する（計画時点：`tests 385`・`pass 385`・`fail 0`。本タスクはテストを足さないため件数は変わらない）。
        *   開発資料への影響は2章の更新予定欄へ追記し（資料本体は修正しない）、迷った点は5章へ追記する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [x] タスク2: `Path`クラスの新設
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` :（新規）
    *   **作業内容** :
        *   2章要件2（2-1〜2-3）と要件1の1-3（検査の順序とエラー文の全文）のとおり、13メソッド契約を自律実装する`Path`クラスを作る。共通の基底クラス・継承は使わない。幾何の計算は`ShapeGeometry.js`の`distanceToSegment`・`segmentIntersectsRect`、共通項目の検証は`validateShapeData(data, 'Path', ['path'], { min: 2 })`を使い、図形クラスへ複製しない。`try/catch`を持たない。`import`は共通モジュール2つのみ。
        *   `draw`の命令・引数・順序が2章要件4の`DRAW_SOURCE`の`polyline`と一致すること（閉じる区間は`closePath`）、`toDrawElement`が`polyline`を返すことを守る。
        *   JSDoc：先頭行に単一責務JSDoc（3行以内。2-1の案）、クラスJSDocで13メソッド契約を列挙、すべての定数・コンストラクタ・公開プロパティ・メソッド・非公開の補助にJSDoc（`@param`・`@returns`、`fromJSON`は`@throws`に1-3の全条件）を書く。
        *   本タスクではテストファイル・`ShapeFactory`を変更しない。`node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。
        *   開発資料への影響は2章の更新予定欄へ追記し、迷った点は5章へ追記する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [ ] タスク3: `Path`のテストの新設
    *   **対象ファイル** :
        *   `./test/shapes/Path.test.js` :（新規）
    *   **作業内容** :
        *   2章要件5の5-1の観点をすべて書く（観点は最低限で、実コードを読んで足してよい）。`import`は`node:test`・`node:assert/strict`・`../../js/shapes/Path.js`のみ。
        *   エラー文は1-3の表の全文と一致させる。テストが失敗した場合は、計画（1-3・2-3）と`Path.js`のどちらが誤りかを確かめ、テストを計画からずらして通さない（ソースの誤りならタスク2の範囲の誤りとして5章に記録したうえで`Path.js`を直してよい）。
        *   先頭行に単一責務JSDoc（3行以内。5-1の案）、補助関数にJSDoc（`@param`・`@returns`）を書く。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク4: `ShapeFactory`への登録（読めるが作れない種別）とそのテスト
    *   **対象ファイル** :
        *   `./js/core/ShapeFactory.js` :（更新）
        *   `./test/core/ShapeFactory.test.js` :（新規。`test/core/`フォルダも新設）
    *   **作業内容** :
        *   2章要件3のとおり、`Path`を`import`し、`SHAPE_REGISTRY`の末尾に`{ type: 'path', create: null, fromJSON: (data) => Path.fromJSON(data) }`を足す。`SHAPE_TYPES`は`create`が`null`でないエントリから導出し、`create`は`create`が`null`の種別でも従来と同じ文言の`Error`をthrowする。`fromJSON`の処理は変えない（`REGISTRY_BY_TYPE`は全エントリから作る）。`switch`・種別による`if`を持たない。`try/catch`を持たない。
        *   JSDoc（`ShapeRegistryEntry`の`create`の型と`null`の意味、`SHAPE_REGISTRY`・`SHAPE_TYPES`の説明、`create`の`@throws`、`fromJSON`の`@param`・`@returns`・`@throws`）を更新する。先頭行の責務JSDocは変えない。
        *   `test/core/ShapeFactory.test.js`に2章要件5の5-2の観点を書く（先頭行に単一責務JSDoc。5-2の案）。
        *   `InputTracker`・`KeyboardShortcuts`・`PaletteController`・`VectorModel`・`main.js`・`index.html`は変更しない。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（既存の`DocumentSerializer.roundtrip`等が`SHAPE_TYPES`の5種のまま通ることを含む）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク5: 作業データの往復テストへのパスの追加
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` :（更新。ケースの追加のみ）
    *   **作業内容** :
        *   2章要件5の5-3のとおり、パス用の補助関数（JSDoc付き）と`describe('path の往復')`・パスと既存の5種の混在の往復のケースを足す。既存のケース・補助関数（`assertSameShape`・`POINT_COUNTS`・`statesFor`・`makeMixed`等）は書き換えない。先頭行の責務JSDocはパスを含む記述へ改めてよい。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [ ] タスク6: スプライトデータの組み立てのテストへのパスの追加
    *   **対象ファイル** :
        *   `./test/io/SpriteSerializer.test.js` :（更新。ケースの追加のみ）
    *   **作業内容** :
        *   2章要件5の5-4のとおり、パスの描画要素の中身（開いた・閉じた）と外枠、混在の描画順と外枠、`source`の往復のケースを足す。既存のケース・補助関数は書き換えない。補助関数を足す場合はJSDocを書く。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [ ] タスク7: スプライトJSのエディタの描画との一致テストへのパスの追加
    *   **対象ファイル** :
        *   `./test/io/CodeExporter.test.js` :（更新。ケースの追加のみ）
    *   **作業内容** :
        *   2章要件5の5-5のとおり、既存の`assertSameAsEditor`で開いたパス・閉じたパス等の`draw`と書き出した`draw`の描画命令の記録が一致することを確かめるケースを足す。既存のケース・補助関数は書き換えない。
        *   一致しない場合は`io/`を直さず、`Path.draw`（2章要件4）を見直す。`io/`の変更・`formatVersion`の版上げが必要と判断した場合は作業を中断して5章に理由を書き、報告する（エンジンとの約束(c)により設計指針の変更提案に当たる）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [ ] タスク8: 書き出したJSの読み込みテストへのパスの追加
    *   **対象ファイル** :
        *   `./test/io/FileContentReader.test.js` :（更新。ケースの追加のみ）
    *   **作業内容** :
        *   2章要件5の5-6のとおり、パスを含むキャンバスを書き出したJS（LF・CRLF）からパスが元どおりに戻るケースを足す。既存のケース・補助関数は書き換えない。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [ ] タスク9: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   `./js/shapes/Path.js`、`./js/shapes/ShapeDataValidation.js`、`./js/core/ShapeFactory.js`、`./test/shapes/Path.test.js`、`./test/core/ShapeFactory.test.js`、タスク5〜8で変更した`./test/io/`の4ファイル :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261110_1037_RES_Phase05-02_Path_Shape.md` :（更新）
    *   **作業内容** :
        *   新設ファイル（`Path.js`・2つのテストファイル）の先頭行の単一責務JSDoc（3行以内）、`Path`のクラスJSDocでの13メソッド契約の列挙、各メソッド・補助関数・定数のJSDoc（`@param`・`@returns`・`@throws`）、`validateShapeData`・`ShapeFactory`の更新したJSDocが実コードと一致していることを確認する。
        *   `Path.js`の`import`が共通モジュール2つのみであること、`Path`・`ShapeFactory`が`try/catch`を持たないこと、`ShapeFactory`が`switch`・種別による分岐を持たないこと、`SHAPE_TYPES`が5種・従来の並びのままであること、`js/shapes/`の既存4クラス・`core/`（`ShapeFactory`以外）・`io/`・`edit/`・`palette/`・`check/`・`main.js`・`index.html`に変更が無いこと、既存のテストファイルの既存のケースが書き換わっていないこと（`git status`・`git diff --stat`・`git diff`で確かめる。gitの状態を変える操作はしない）を確認する。
        *   プロジェクトのルートで`node --test`を実行し、全テストの成功と件数を4章の本タスクの欄へ記録する。
        *   本RESの仕上げとして、4章の本タスクの欄を記入し（タスク1〜8の欄は書き換えない）、開発資料への影響を2章の更新予定欄へ（資料本体は修正しない）、判断に迷った点・目視確認を推奨する箇所・将来修正する際の注意点を5章へ追記する。
        *   完了時に本タスクを [x] にする。
*   [ ] タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。1章のフォルダ構成、2章の「図形（Shape）」「図形データ」「描画要素」）
        *   `./_doc/arch/12_shapes.md` :（更新）
        *   `./_doc/arch/10_ShapeFactory.md` :（更新）
        *   `./_doc/arch/16_test.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料の更新予定」（各タスクで追記された項目を含む）を確認し、`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従って上記4ファイルへ反映する。1つのファイルのJSDocを読めば分かること（引数と戻り値の詳細、private項目、定数の値、1クラス内の処理順）は書かない。上記以外の`_doc/arch/`のファイルに食い違いを見つけた場合は変更せず、5章に記録して報告する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、本タスクのみ明示的な例外とする（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章の本タスクの欄へ記録する（資料の変更のみのため件数は変わらない）。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ反映した箇所を記入する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `validateShapeData`の頂点数の引数の拡張
*   **作業内容** :
    *   `js/shapes/ShapeDataValidation.js`の`validateShapeData`で、`typeof pointCount === 'number'`なら従来の判定・エラー文（`pointsが${pointCount}要素の配列ではありません`）をそのまま、それ以外（`{ min }`）なら`points.length < pointCount.min`で`pointsが${pointCount.min}要素以上の配列ではありません`を投げるようにした。検査の順序は不変。
    *   JSDoc（関数の説明・`@param pointCount`の2つの形・`@throws`）を更新。先頭行の責務JSDocは不変。既存4クラス・既存テストは未変更。
    *   `node --test`：`tests 385`・`pass 385`・`fail 0`。

### タスク2: `Path`クラスの新設
*   **作業内容** :
    *   `js/shapes/Path.js`を新設。2-1〜2-3・1-3のとおり13メソッドを自律実装（`import`は`ShapeGeometry.js`・`ShapeDataValidation.js`のみ、`try/catch`なし）。非公開補助は`#tracePath(ctx)`（区間の種類による分岐の置き場所。JSDocに曲線追加時の注意を記載）と`#someSegment(predicate)`（`hitTest`・`intersectsRect`共有。区間`i`の両端は`points[i]`・`points[(i+1)%n]`）。
    *   `fromJSON`は`validateShapeData(data, 'Path', ['path'], { min: 2 })`の後に1-3の7〜12を検査（エラー文は表の全文。12の`'line'`は`ACCEPTED_SEGMENT_KINDS`から生成）。`isPlainObject`は`Path.js`内に同条件で定義。
    *   `ShapeFactory`・テストは未変更。`node --test`：`tests 385`・`pass 385`・`fail 0`。簡易動作確認（閉じた3点のtoJSON・要素数不一致のエラー文）も期待どおり。
    *   開発資料の更新予定欄への追記：なし（計画済みの内容どおり）。

### タスク3: `Path`のテストの新設
*   **作業内容** :
    *   （未実施）

### タスク4: `ShapeFactory`への登録（読めるが作れない種別）とそのテスト
*   **作業内容** :
    *   （未実施）

### タスク5: 作業データの往復テストへのパスの追加
*   **作業内容** :
    *   （未実施）

### タスク6: スプライトデータの組み立てのテストへのパスの追加
*   **作業内容** :
    *   （未実施）

### タスク7: スプライトJSのエディタの描画との一致テストへのパスの追加
*   **作業内容** :
    *   （未実施）

### タスク8: 書き出したJSの読み込みテストへのパスの追加
*   **作業内容** :
    *   （未実施）

### タスク9: JSDocの確認とRESの完成
*   **作業内容** :
    *   （未実施）

### タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント

### 計画時の確認・判断
*   **`io/`・`formatVersion`は変更不要（計画時に確認済み）**：2章要件4のとおり、`Path.draw`と`DRAW_SOURCE`の`polyline`の描画命令・引数・順序は一致し、外枠は`polylineRange`が全頂点で正しく求める。`io/`の変更・書き出し形式の版上げ・エンジンへの連絡票は不要。タスク7で一致しなかった場合も`io/`は直さず`Path.draw`を見直す。
*   **スコープ外の変更は不要と判断**：`core/`（`ShapeFactory`以外）・`io/`・`edit/`・`palette/`・`main.js`・`index.html`・既存の4クラスは変更しない（理由は2章「全体構成と依存の向き」）。新設する`test/core/ShapeFactory.test.js`はREQで「新設する場合のみ」許可された範囲。
*   **曲線の区間を足すとき（パスの編集のPhase）の注意**：区間に曲線が入ると、パスは書き出し形式の版1の`polyline`で表せなくなる（`polyline`は`moveTo`→`lineTo`→`closePath`のみ）。新しい`kind`（例：区間の並びを持つ描画要素）を足すか、既存の`kind`を分けて出すかの判断と、書き出し形式の版（`formatVersion`）を上げるかの判断が要る。古い読み手が未知の`kind`として無視すると正しく描けなくなるため版上げに当たる見込みで、エンジンとの約束(c)により連絡票が要る。あわせて`Path`の`#tracePath`（描画）・区間の両端の列挙（当たり判定・範囲選択）・`toDrawElement`・`fromJSON`の受理する`kind`とエラー文（1-3の12）・`SpriteSerializer`の外枠・`CodeExporter`の`DRAW_SOURCE`を揃える必要がある。閉じる区間が曲線の場合は`closePath`だけでは描けない。
*   **古いエディタで開いた場合**：作業データの版を上げないため、パスを含む作業データファイル・スプライトJSを本作業より前のエディタで開くと、パスは未知の図形種別として図形単位でスキップされ「一部読めない」の通知が出る（DIRで許容済み）。
*   **プレーンオブジェクトの判定の小さな重複**：`Path.fromJSON`の区間の要素の判定（1-3の11）は、`ShapeDataValidation.js`の非公開関数`isPlainObject`と同じ条件を`Path.js`に書く。`ShapeDataValidation.js`の`export`を増やす案もあるが、共通モジュールの公開APIを図形固有の検証のために広げないこととした。区間の検証が増える（曲線の制御点等）ときに、区間の検証を共通モジュールへ移すかを再検討する。
*   **`io/`等のJSDocの図形データの形**：`DocumentSerializer`の`DocumentData`のtypedef・`ShapeFactory.fromJSON`の`@param`等に「図形データ（`{ type, id, points, strokeColor, strokeWidth }`）」とある。`ShapeFactory`は本作業でJSDocを改めるが、`io/`は変更しない（共通の項目の記述として誤りではないため）。開発資料2章で「共通の項目＋種別により足す項目」と書き分ける。
*   **区間の要素数の不変条件**：開いたパス`n - 1`・閉じたパス`n`は、コンストラクタ・`fromJSON`で成り立ち、本作業のメソッドは頂点数・`closed`を変えない。Phase 05-03・05-04で頂点を足す・閉じる処理を書くときは、新しい`Path`をコンストラクタで作る（区間を作り直す）か、`points`・`closed`・`segments`をそろえて更新すること。コンストラクタは引数を検証しない。
*   **`polylineRange`の`Math.min(...xs)`**：`SpriteSerializer`の外枠の計算は頂点の配列を展開して`Math.min`・`Math.max`へ渡すため、頂点数が極端に多い（JSの引数の数の上限を超える、おおむね10万点以上）パスでは書き出しで例外になり得る。パスの頂点数に上限は設けない決定のため記録のみ（本作業でパスを作る操作はなく、現実的な頂点数では起きない）。`io/`は変更しない。
*   **ハンドルの優先順位**：`hitTestHandle`は頂点の番号の小さい順の先着1件。閉じたパスで始点と終点が重なる等の場合は番号の小さい頂点が選ばれる。`InputTracker`はハンドルを本体より先に調べるため、頂点の多いパスでは選択中の頂点付近の本体のドラッグがハンドルのドラッグになる（既存の図形と同じ振る舞い。`hitTestHandle`の優先順位の見直しはREQのNon-goals）。

### テストプレイの確認項目（操作手順と期待する結果）
前提：現場設計AIが、開いたパス（例：頂点4つのジグザグ）と閉じたパス（例：頂点5つの多角形）を含み、線の色・太さを既定と変えたものを含む作業データファイルを用意する（リポジトリには含めない）。`?dev`の「JSONから復元」に同じ作業データを貼り付けて用意してもよい。
1.  **表示（開いた/閉じた）**：作業データファイルを「開く（ファイル）」で開く → 開いたパスは始点から終点まで直線でつながり、終点と始点の間に線が無い。閉じたパスは終点から始点へも直線でつながる。色・太さが作業データどおり。閉じたパスの角（始点の位置を含む）が他の角と同じ継ぎ目で描かれる。
2.  **クリック選択**：選択モードでパスの線の上をクリック → パスが選択され、全頂点に白塗り・青枠の四角いハンドルが出る。開いたパスの終点と始点を結ぶ位置（線の無い所）や閉じたパスの内側をクリック → 選択されない。線の上にマウスを置くと半透明の太線の強調が出る。
3.  **範囲選択**：空白からドラッグしてパスの一部の区間に掛かる矩形を描く → パスが選択される。閉じたパスの内側だけを囲む矩形 → 選択されない。開いたパスの「終点と始点の間（線の無い所）」だけに掛かる矩形 → 選択されない。
4.  **本体のドラッグによる移動**：選択したパスの線（頂点以外）をドラッグ → パス全体が平行移動する。
5.  **頂点のハンドルのドラッグ**：選択したパスの各頂点のハンドル（始点・中間の頂点・終点）をドラッグ → その頂点だけが動き、前後の区間がつながったまま伸び縮みする。閉じたパスの始点・終点を動かすと閉じる区間も追従する。
6.  **削除**：パスを選択して削除ボタン／`Delete`／`Backspace` → パスが消える。
7.  **複製/コピー＆ペースト・切り取り**：パスを選択して`Ctrl`+`D` → ずれた位置に同じ形のパス（開いた/閉じたが同じ）が追加され、それだけが選択される。`Ctrl`+`C` → `Ctrl`+`V`も同様。`Ctrl`+`X` → `Ctrl`+`V`で戻る。
8.  **Undo/Redo**：4〜7の各操作の後に`Ctrl`+`Z` → 操作前に戻る（頂点の位置・閉じているか・色・太さとも）。`Ctrl`+`Y`／`Ctrl`+`Shift`+`Z` → やり直せる。
9.  **保存して開き直す**：パスを動かした後、「出力（作業ファイル）」でダウンロードし、「開く（ファイル）」で開き直す → 頂点の並び・閉じているか・色・太さが元どおり。キャンバスを切り替えて戻る・ページを再読み込みする（自動保存）→ パスが元どおり。
10. **スプライトJSの書き出しと確認用ページ**：パスと既存の図形を含むキャンバスを「出力（エンジン用）」で書き出し、`sprite-check.html`で開く → エディタと同じ見た目（開いたパスは閉じず、閉じたパスは閉じる）で描かれ、外枠がパスを含む（線の太さの半分の余白を含む）。
11. **書き出したJSを開き直す**：10で書き出したJSをエディタの「開く（ファイル）」と「インポート」で読む → パスが元どおりに戻る（「一部読めない」の通知が出ない）。
12. **既存の5種の図形が従来どおり動く**：直線・曲線・弧・矩形・円をそれぞれ作成し、クリック選択・範囲選択・移動・ハンドル操作・削除・複製・Undo/Redo・保存と読み込み・書き出しがこれまでと同じに動く。
13. **図形パレットと数字キーにパスが出ない**：図形パレットのボタンは従来の5つ（並びも同じ）で、パスのボタンが無い。起動時に`PaletteController`の警告がコンソールに出ない。数字キー`1`〜`5`は従来どおりの図形に対応し、`6`を押しても何も起きない。
