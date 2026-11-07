# RES: 作業計画・作業レポート (Phase 04-02) : スプライトJSの書き出し
* 参照元REQ: `./_log/req/261107_2135_REQ_Phase04-02_Sprite_Export.md`

## 1. 作業目的
開いているキャンバスを、ゲームが`import`して描ける「スプライト」として書き出せるようにする。スプライトは**JSファイル（ESモジュール。`<名前>.js`）とJSONファイル（`<名前>.json`）のセット**で、どちらも同じ「スプライトデータ」（書き出し形式の識別子と版・描画データ・外枠・作業データ`source`）を持ち、JSにはそれに加えて共通の描画処理`draw(ctx)`が入る。キャンバスパレットのボタンを「出力（作業ファイル）」（既存の書き出しの改名）と「出力（エンジン用）」（新設）の2つにし、作業データファイルの既定のファイル名を`<名前>.ozve.json`へ変えてスプライトのJSONと見分けられるようにする。

スプライトデータの組み立てとJS・JSONのテキストの組み立ては、DOMに依存しない新設モジュール（`js/io/SpriteSerializer.js`・`js/io/CodeExporter.js`）に置き、Phase 04-01の自動テスト（`node --test`）で、描画データの中身・外枠・`source`の往復・JSの`import`・エディタの描画との一致（描画命令を記録する偽の`ctx`による比較）を検証する。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
```text
index.html  … 「出力（作業ファイル）」#canvas-export（改名）・「出力（エンジン用）」#canvas-export-sprite（新設）
   │
main.js     … CanvasPaletteへ onExportSprite = () => canvasFileOperations.exportSprite() を注入（1行追加）
   │
palette/CanvasPalette.js … ボタンの配線・押せる/押せない・文言のみ（スプライトデータの中身を知らない）
   │（コールバック）
edit/CanvasFileOperations.js … exportSprite()：受理判定 → 組み立て（2つのテキストを先にそろえる）→ JSのダウンロード → JSONのダウンロード → 失敗時は通知
   │ import                          │ 注入
   ├─ io/SpriteSerializer.js（新設）  └─ io/DocumentFileIO.js … Blob・<a download>・ファイル名の規則（拡張子・使えない文字・先頭の`_`）
   │     ├─ import io/DocumentSerializer.js（sourceの組み立て）
   │     └─ 各図形の toDrawElement()（ポリモーフィックに呼ぶ。import はしない）
   └─ io/CodeExporter.js（新設）
         └─ import io/SpriteSerializer.js（JSON文字列化と線の太さの既定値）

shapes/Line.js・Curve.js・Rect.js・Ellipse.js … 共通契約に toDrawElement() を追加（13メソッド契約へ）
```
* 依存方向`main.js → edit → io → core → shapes`は変わらない。`io/`は`edit/`をimportしない。`core/`は変更しない（`io/`をimportしない）。`shapes/`は何もimportしない。
* DOMに触れるのは従来どおり`DocumentFileIO`（ダウンロード）と`CanvasPalette`・`main.js`のみ。`SpriteSerializer`・`CodeExporter`・`CanvasFileOperations`はDOMに触れない（Node.jsでテストできる）。
* グローバル変数は追加しない。書き出したJSの中の定数・関数もモジュールのスコープに閉じる。

### 要件1: キャンバスパレットの操作
* **ボタン**：
  * 「出力（作業ファイル）」：既存の`#canvas-export`の表示名を変える（idは変えない）。動作は既存の`exportCanvas()`のまま（ファイル名は要件6で`<名前>.ozve.json`）。
    * `title`：「エディタで開き直すための作業データを、ファイル（.ozve.json）としてダウンロードします」
  * 「出力（エンジン用）」：新設`#canvas-export-sprite`。押すと`onExportSprite()`→`canvasFileOperations.exportSprite()`。形式を選ぶ小窓は出さない。
    * `title`：「ゲームで使うスプライトを、JS（.js）とJSON（.json）の2つのファイルとしてダウンロードします」
* **並べ方**（パレットの内側の幅216px）：出力の2ボタンを1行に並べると、文字13px×(10+9)字＝247px＞216pxで収まらない。そのため次の順に縦へ並べる（`.window-body`は`flex-direction: column`・`gap: 8px`）。
  ```text
  [＋ 新規作成]
  [出力（作業ファイル）]       … 1行に1ボタン（.tool-btn の既定のとおり全幅・左寄せ。「＋ 新規作成」と同じ見た目）
  [出力（エンジン用）]         … 同上
  [開く][インポート]           … 既存の .canvas-file-row（2ボタンを横並び。13px×(2+5)字＋余白・枠20px＋間隔4pxで約115px）
  （一覧）
  ```
  * 「開く」「インポート」のボタン名・`title`・動作は変えない。`.canvas-file-row`のCSSは変えず、コメントのみ実態（2ボタン）に合わせて直す。
* **押せる・押せない条件**：「出力（エンジン用）」は「出力（作業ファイル）」と同じ`busy || loading`で`disabled`。`'unavailable'`（`!canManage`）でも押せる。受理条件（二次判定）も`exportCanvas`と同じ（合成後の`getState()`の`loading`・`busy`が偽）。
* **通知**：受理時にファイル操作の通知`fileNotice`を消す（`exportCanvas`と同じ）。成功時は通知を出さない。失敗時は**新しい通知の種類`'spriteExportFailed'`**を出す（作業ファイルの出力の失敗`'exportFailed'`とは文言を分ける。理由：2つのファイルのうち片方だけが落ちた可能性を伝える文言にするため）。`issue`には種類を足さない。
* **2つのファイルの扱い（決定）**：
  1. 組み立て：`SpriteSerializer.serialize(model.getShapes())`でスプライトデータを作り、そこから**JSONのテキストとJSのテキストを両方とも先に組み立てる**。ここで例外が出たら、どちらもダウンロードしない（通知`spriteExportFailed`）。
  2. JS（`<名前>.js`）をダウンロードする。例外が出たら、JSONはダウンロードしない（通知`spriteExportFailed`）。
  3. JSON（`<名前>.json`）をダウンロードする。例外が出たら通知`spriteExportFailed`（JSは既に落ちている。取り消せないため、文言で出し直しを促す）。
  * 順序はJS→JSON（エンジンが`import`する主たるファイルを先にする）。
* **複数のダウンロードの許可（判断）**：2つのダウンロードは同じクリックの処理の中で続けて行い、**間隔は空けない**。理由：`Blob`のURLを`<a download>`で落とす方式は画面の移動を伴わないため互いに打ち消し合わない。また、Chrome系の「複数のファイルのダウンロード」の確認は、利用者の1回の操作で2つ目以降を落とすときに出るもので、間隔を空けても（むしろ利用者の操作から離れるほど）避けられないため。確認が出た場合は「許可」を選べば以後はそのサイト（オリジン）で記憶される。目視確認項目に入れ、2つ目が落ちないブラウザがあれば後のInterruptで間隔の追加を検討する（5章）。
* **触れないもの**：スプライトの出力は、図形・選択集合・履歴・ビュー変換・操作モード・作成途中の図形に触れず、`applyMode`・`prepareInsert`・`beginEdit`/`commitEdit`を呼ばない（自動保存の契機にならない）。`model`は`getShapes()`のみ使う。

### 要件1-2: 文言の変更一覧（「書き出し」の表記の置き換え）
| 場所 | 変更前 | 変更後 |
| --- | --- | --- |
| `index.html` `#canvas-export`の表示名 | 書き出し | 出力（作業ファイル） |
| `index.html` `#canvas-export`の`title` | 開いているキャンバスをファイル（.json）としてダウンロードします | エディタで開き直すための作業データを、ファイル（.ozve.json）としてダウンロードします |
| `index.html` `#canvas-export-sprite`（新設） | － | 表示名「出力（エンジン用）」、`title`は要件1のとおり |
| `index.html` `.canvas-file-row`のCSSコメント | 書き出し・開く・インポートの3ボタン… | 開く・インポートの2ボタン…（出力の2ボタンは1行に収まらないため別の行に置く旨と計算） |
| `CanvasPalette` `ISSUE_MESSAGES.writeFailed` | …「書き出し」でファイルに残せます。 | …「出力（作業ファイル）」でファイルに残せます。 |
| `CanvasPalette` `FILE_NOTICE_MESSAGES.exportFailed` | 書き出しに失敗しました。 | 作業ファイルの出力に失敗しました。 |
| `CanvasPalette` `FILE_NOTICE_MESSAGES.spriteExportFailed`（新設） | － | エンジン用の出力に失敗しました。JSとJSONの片方だけがダウンロードされた場合は、もう一度出力してください。 |
| `CanvasPalette` `FILE_NOTICE_MESSAGES.readFailed` | …本アプリの作業データファイルか確認してください。 | …本アプリで出力した作業ファイルか確認してください。（ボタン名「作業ファイル」と揃える。エンジン用のJSONを選んだ場合もこの文言になる） |
| `CanvasPalette`のJSDoc（`onExport`・`#exportButton`・`#handleExport`・クラスJSDocの「操作」「表示の規則」・typedef`FileNotice`） | 「書き出し」 | 「出力（作業ファイル）」。`onExportSprite`・`#exportSpriteButton`・`#handleExportSprite`・`'spriteExportFailed'`を追記 |
| `CanvasFileOperations`のJSDoc・`console.warn` | 書き出し | 出力（作業ファイル）／出力（エンジン用） |
| `main.js`の配線のコメント（2箇所） | ファイル操作（書き出し・開く（ファイル）・インポート） | ファイル操作（出力（作業ファイル・エンジン用）・開く（ファイル）・インポート） |
* コード上の名前（`exportCanvas`・`onExport`・`#canvas-export`・`'exportFailed'`）は変えない（改名は指示外のため）。

### 要件2: スプライトの既定のファイル名
* `<名前>.js`・`<名前>.json`（キャンバス名`ship` → `ship.js`・`ship.json`）。
* 規則（作業データファイルと共通の手順に、手順4を加える）：
  1. `\ / : * ? " < > |`と制御文字を`_`へ置換する。
  2. 前後の空白を除く。
  3. 末尾のピリオドと空白を除く。
  4. **スプライトのみ**：先頭の`_`と空白をすべて除く（正規表現`/^[_\s]+/u`。例：`_hero` → `hero`、`__ a` → `a`、`/ship`（手順1で`_ship`）→ `ship`）。
  5. 結果が空なら既定の名前`無題`（例：`___` → `無題.js`）。
  6. 拡張子を付ける（`.js`・`.json`）。
* **知識の置き場所（決定）**：拡張子・MIMEタイプ・使えない文字・先頭の`_`の除去・既定の名前は、すべて`DocumentFileIO`に置く（既存の規則が`DocumentFileIO`に閉じているため。手順1〜3・5は作業データファイルと同じprivateの処理を共有し、2箇所に重複させない）。`CanvasFileOperations`はキャンバス名を渡すだけで、拡張子・MIMEタイプを知らない。

### 要件3: スプライトデータの中身（スプライトデータ形式・版1）
```text
{
  "format": "oz-vector-editor-sprite",          … 書き出し形式の識別子（固定の文字列）
  "formatVersion": 1,                           … 書き出し形式の版（1以上の整数）
  "bounds": { "minX", "minY", "maxX", "maxY" } | null,  … 外枠（要件5。図形0個ならnull）
  "elements": [ 描画要素, ... ],                 … 描画データ（描画順＝model.getShapes()の並び）
  "source": { "format": "oz-vector-editor", "version": 1, "shapes": [...] }  … 作業データ（DocumentSerializer.serializeの戻り値そのもの）
}
```
* キーはこの順で出力する（読む側はキーの順に依存しないこと）。
* 座標・長さの単位はpx。基準点はワールド座標の原点(0, 0)。y軸は下向き。エディタのワールド座標をそのまま使い、平行移動・拡大・丸めをしない。角度はラジアン。
* 含めないもの：スプライトごとの変わらないID、キャンバス名、作成日時（参照はファイル名で行う。必要になったら後のPhaseでキーを足す）。
* **描画要素**（`elements`の1要素＝図形1つ。共通のキー：`kind`・`id`・`strokeColor`・`strokeWidth`）：

  | `kind` | 元の図形 | キー（この順） | 描き方（エディタの`draw`と同じ命令・同じ引数・同じ順） |
  | --- | --- | --- | --- |
  | `"polyline"` | `line`（`closed: false`・2点＝[始点, 終点]）、`rect`（`closed: true`・4点＝`points`の並びのまま） | `kind, id, points: [{x, y}, ...], closed, strokeColor, strokeWidth` | `beginPath()` → `moveTo(points[0])` → `lineTo(points[i])`（i=1…）→ `closed`が`true`なら`closePath()` |
  | `"quadratic"` | `curve`（3点＝[始点, 制御点, 終点]） | `kind, id, points: [{x, y} ×3], strokeColor, strokeWidth` | `beginPath()` → `moveTo(points[0])` → `quadraticCurveTo(points[1].x, points[1].y, points[2].x, points[2].y)` |
  | `"ellipse"` | `circle`（`closed: true`・0〜2π）、`arc`（`closed: false`・π〜2π） | `kind, id, x, y, radiusX, radiusY, startAngle, endAngle, closed, strokeColor, strokeWidth` | `beginPath()` → `ellipse(x, y, radiusX, radiusY, 0, startAngle, endAngle)`（7引数。回転は常に0）→ `closed`が`true`なら`closePath()` |
  * どの`kind`も、パスの後に`strokeStyle = strokeColor` → `lineWidth = 線の太さ` → `stroke()`（エディタの各図形の`draw`と同じ順）。
  * `id`は図形の`id`をそのまま入れる。頂点は作業データの`points`の並び順のまま（並べ替えない）。`ellipse`の値は`Ellipse.draw`と同じ式（`x`＝`points[0].x`、`y`＝`points[0].y`、`radiusX`＝`|points[1].x − points[0].x|`、`radiusY`＝`|points[2].y − points[0].y|`、`startAngle`・`endAngle`は`Ellipse`の同名のプロパティ）で求める。読む側は`Ellipse`の`points`の約束を知らなくてよい。
  * 回転（`rotation`）のキーは持たない（回転は0。P5以降で足す場合は「無ければ0」として足せる）。
* **読む側の規則**（書き出したJSの`draw`もこれに従う。P5・P6で項目を足しても既存の項目の意味を変えないための規則）：
  * 未知のキー（最上位・描画要素とも）は無視する。未知の`kind`の要素は描かない（読み飛ばす）。
  * `strokeWidth`が正の有限の数値でない（キーが無い・`undefined`を含む）要素は、線の太さ**2px**として扱う（描画・外枠の両方。定数`DEFAULT_STROKE_WIDTH`。唯一の定義箇所は`SpriteSerializer.js`）。
  * `strokeColor`が文字列でない要素は、**線を描かない**（その要素の線のパス（表の命令）と`strokeStyle`・`lineWidth`・`stroke()`を呼ばない）。これは線についての規則であり、要素そのものを捨てる規則ではない。版1の描き方は線のみのため、結果としてその要素では何も描かれない（何も呼ばない）。P5で塗り等の項目を足すときは、塗りの扱いはこの規則に縛られず、足す項目の側の規則で決める（「線なし・塗りあり」の要素を表せる）。※ 現行のエディタは常に文字列を入れる。
  * 形の項目が足りない要素は描かない：`polyline`は`points`が2点以上の配列、`quadratic`は3点以上の配列、`ellipse`は`radiusX`・`radiusY`が0以上の数値（`NaN`は不可）であること。
* **JSONの出力形**：スプライトデータを`JSON.stringify(data, null, 2)`（字下げ2。作業データファイルと同じ。圧縮・最小化はしない）。関数は含まない。

### 要件4: 版番号と識別子
* **書き出し形式の版**：`formatVersion`（初期値`1`。唯一の定義箇所は`SpriteSerializer.js`の非公開定数）。**作業データの版**：`source.version`（既存。`DocumentSerializer`の`CURRENT_DOCUMENT_VERSION`）。最上位に`version`というキーは置かない。
* **上げる条件**（開発資料へ書く）：書き出し形式の版は、書き出しの形（エンジンが読む部分＝`format`・`formatVersion`・`bounds`・`elements`の形と意味、JSのexportの形）が変わったときに上げる（項目の追加で、古い読み手が未知の項目として無視すると正しく描けなくなる場合を含む）。作業データの版は保存形式が変わったときに上げる（`DocumentSerializer`の手順）。作業データだけ版が上がっても書き出し形式の版は上げなくてよい。
* **識別子（決定）**：`format: "oz-vector-editor-sprite"`を持たせる（作業データの`"oz-vector-editor"`とは別の値。Phase 04-03で本アプリが書き出したものかを見分ける手がかり）。スプライトのJSONを現行の「開く」「インポート」で選ぶと、`format`が作業データ形式と一致しないため`DocumentSerializer`の全体失敗→通知`readFailed`になる（停止しない）。

### 要件5: 外枠
* **表し方（決定）**：`bounds: { minX, minY, maxX, maxY }`（ワールド座標の最小・最大。`minX ≤ maxX`・`minY ≤ maxY`）。理由：計算値をそのまま持て（幅・高さへの引き算による誤差を足さない）、P7で複数のパーツの外枠の和を取りやすいため。幅・高さは読む側で`maxX − minX`等として求める。
* **図形0個のとき（決定）**：`bounds: null`（外枠なし）。理由：0×0（原点の点）にすると、P7で外枠の和を取ったときに原点が誤って含まれるため。読む側は`null`を確かめること（開発資料に書く）。
* **求め方**：描画要素ごとに「形の範囲（中心線の外接矩形）」を求め、その要素の線の太さの半分（`strokeWidth`が正の有限の数値でなければ2pxの半分）だけ四方へ広げ、全要素の和を取る。`kind`ごとの形の範囲：
  * `polyline`：全頂点の最小・最大（`closed`は範囲に影響しない）。
  * `quadratic`：始点・終点と、各軸の極値（`t = (p0 − p1) / (p0 − 2·p1 + p2)`。分母が0でなく`0 < t < 1`のときのみ、`B(t) = (1−t)²·p0 + 2(1−t)t·p1 + t²·p2`）の最小・最大（制御点そのものは含めない）。
  * `ellipse`：`startAngle`〜`endAngle`（`endAngle < startAngle`なら`endAngle`に2πを足して`startAngle`以上にする。差が2π以上なら全周）の範囲にある、両端の点（`x + radiusX·cosθ, y + radiusY·sinθ`）と、`startAngle ≤ k·π/2 ≤ endAngle`となる整数`k`の角度の点（`k`を4で割った余り（負の`k`も0〜3に直す）が0→右端`(x+radiusX, y)`、1→下端`(x, y+radiusY)`、2→左端`(x−radiusX, y)`、3→上端`(x, y−radiusY)`。三角関数を使わず正確な値を使う）の最小・最大。`closed`の弦は弧の凸包の内側のため範囲に影響しない。
  * 未知の`kind`は`Error`をthrowする（エディタの図形が未対応の`kind`を返した実装不具合。出力の手順で捕捉され通知になる）。
* **近似（開発資料・懸念事項に書く）**：鋭い角の継ぎ目（`miter`）の尖りは考慮しない（外枠から少しはみ出すことがある）。一方、線の端（`butt`）・長さ0の線も太さの半分を四方へ広げるため、実際に描かれる範囲より大きくなることがある（保守的な値）。弧の両端は三角関数の誤差（1e-15程度）を含む。外枠は書き出し時にエディタが計算した値であり、読む側は再計算しない。

### 要件6: 作業データファイルの既定のファイル名
* `toFileName(canvasName)`の拡張子を`.json`→`.ozve.json`へ変える（手順は要件2の1〜3・5、拡張子`.ozve.json`。先頭の`_`は除かない）。
* `toCanvasName(fileName)`：末尾の`.ozve.json`または`.json`を**1回だけ**除く（大文字小文字を区別しない。正規表現`/(\.ozve)?\.json$/i`。`.ozve.json`があれば`.ozve`ごと除く）。
* **往復で名前が変わらない性質（規則）**：書き出しは常に`<名前>.ozve.json`、開くと末尾の`.ozve.json`を1回だけ除くため、キャンバス名がどのような拡張子らしい文字列で終わっても元へ戻る。
  * `a` → `a.ozve.json` → `a`／`a.ozve` → `a.ozve.ozve.json` → `a.ozve`／`a.json` → `a.json.ozve.json` → `a.json`／`a.ozve.json` → `a.ozve.json.ozve.json` → `a.ozve.json`。
  * 従来の作業データファイル`ship.json` → `ship`（これまでどおり「開く」「インポート」で読める。中身の判定は変えない）。
  * 末尾のピリオド・使えない文字を含む名前は従来どおり往復で変わる（手順1・3。既存の規則のまま）。
* **ファイル選択の小窓（確認結果）**：`accept=".json,application/json"`は拡張子の末尾で照合するため`.ozve.json`も選べる。`index.html`の`accept`は**変更しない**（目視確認項目に入れる）。

### 要件7: 描画関数とJSの形
* **JSのテキストの形**（`CodeExporter.toModuleText(spriteData)`が組み立てる。`import`文を含まず単体で`import`できる）：
  ```js
  /** OZ Vector Editor が出力したスプライト（ESモジュール）。他のファイルに依存しない。…（固定の説明文。キャンバス名等の利用者の入力は含めない） */
  const spriteData = { …SpriteSerializer.stringify(spriteData)の文字列をそのまま… };

  const DEFAULT_STROKE_WIDTH = 2;   // SpriteSerializer の DEFAULT_STROKE_WIDTH を JSON.stringify して埋め込む

  function draw(ctx) { … }          // 共通の描画処理（データを読む。図形ごとの命令を並べて書き出さない）
  function drawElement(ctx, element) { … }   // kind ごとの描き方（未知の kind は何もしない）

  export default { ...spriteData, draw };
  ```
  * スプライトデータはJSONのテキストのまま埋め込む（JSONはES2019以降のJSの式としてそのまま正しく、データとしてしか解釈されない。利用者の入力を含む値（`strokeColor`等）もJSONの文字列として埋め込まれるため、コードとして解釈されない）。キーはすべて本アプリが組み立てた固定のもの（`__proto__`のような特別なキーは生じない）。
  * 描画処理は`CodeExporter.js`内の固定のテキスト（定数）として持ち、そのまま埋め込む。線の太さの既定値だけは`SpriteSerializer`の定数から1行生成する（定数の重複を避ける）。
* **exportの形（決定）**：**既定のexportのみ**。値は、スプライトデータの全キー（`format`・`formatVersion`・`bounds`・`elements`・`source`）と`draw`を持つ1つのオブジェクト。名前付きのexportは持たない（理由：パーツ同士で名前が衝突せず、`import`する側が名前を付けるため。`import body from './body.js'`）。`draw`は`this`を使わないため`const { draw } = body`と取り出しても動く。
* **`draw(ctx)`の処理**：
  1. `ctx.save()`。以降を`try { … } finally { ctx.restore(); }`で囲む（例外でも`ctx`の状態を戻す）。
  2. エディタで既定値のまま使っている、線の形に関わる設定を明示する：`ctx.lineCap = 'butt'` → `ctx.lineJoin = 'miter'` → `ctx.miterLimit = 10` → `ctx.setLineDash([])`（この順）。
     * 調べた結果：エディタの`CanvasManager`はキャンバスの大きさの設定（状態の初期化）と`setTransform`のみ行い、グリッド・原点・選択矩形は`save`/`restore`で囲む。各図形の`draw`は`strokeStyle`・`lineWidth`のみ設定する。`Curve.drawHandles`は破線を設定した後`setLineDash([])`で戻す。どこも`lineCap`・`lineJoin`・`miterLimit`を設定しないため、図形の線は既定値（`butt`・`miter`・`10`・破線なし）で描かれている。
     * 明示しないもの：`globalAlpha`・`globalCompositeOperation`・影（`shadow*`）・`filter`・変換。理由：これらは線の形ではなく、ゲーム側が意図して使う合成・効果（フェード・点滅・影）と配置であり、`ctx`の現在の変換の上に描く要件とも合うため（開発資料・懸念事項に書く）。
  3. `spriteData.elements`を先頭から順に`drawElement`で描く。
* **`drawElement(ctx, element)`**：要件3の「読む側の規則」の順に判定する：`strokeColor`が文字列でない→線を描かない（線のパスと`stroke()`を呼ばない。版1は線のみのため、この要素では何も呼ばない）／`kind`ごとに形の項目を確かめ足りなければ描かない／未知の`kind`→描かない。線を描く場合は要件3の表の命令のあと`strokeStyle`→`lineWidth`（正の有限の数値でなければ`DEFAULT_STROKE_WIDTH`）→`stroke()`。`strokeColor`の判定は線を描くかどうかの判定として書く（関数のJSDoc・コメントも「線を描かない」の意味で書き、「要素を描かない」と書かない）。
* **組み立て用のJSからの使い方の例**（開発資料に書く）：
  ```js
  // _hero.js（組み立て用。P7で書き出す想定。名前の頭に _ を付ける）
  import body from './body.js';
  import head from './head.js';
  export default {
      draw(ctx) {
          body.draw(ctx);                 // 原点(0, 0)を基準に描く
          ctx.save();
          ctx.translate(0, -40);          // 配置は ctx の変換で行う
          head.draw(ctx);
          ctx.restore();
      }
  };
  ```

### 要件8: 図形が1つもないキャンバス
* `elements: []`・`bounds: null`・`source`は図形0個の作業データ。`draw(ctx)`は`save`・設定の明示・`restore`のみで、パスも`stroke`も呼ばない（何も描かない）。
* ダウンロードは図形があるときと同じく2つとも行い、専用の通知は出さない（通知欄の扱いも同じ）。

### 要件9: 責務の置き場所
* **`js/io/SpriteSerializer.js`（新設）**：スプライトデータ形式（書き出し形式）の定義（識別子・版・線の太さの既定値）と、図形一式からの組み立て（描画要素・外枠・`source`）・JSON文字列化。静的メソッドのみのクラス（`DocumentSerializer`と同じ形）。
  * 公開：`static serialize(shapes)`（戻り値は新しいオブジェクト。図形インスタンスと配列・頂点を共有しない。引数を書き換えない）、`static stringify(spriteData)`（`JSON.stringify(spriteData, null, 2)`）、named export `DEFAULT_STROKE_WIDTH`（`= 2`。`CodeExporter`が埋め込みに使う）。
  * 非公開：識別子`SPRITE_FORMAT`・版`SPRITE_FORMAT_VERSION`、`kind`ごとの形の範囲の表（`polyline`・`quadratic`・`ellipse`）と外枠の計算。
  * importは`DocumentSerializer`のみ（`source`の組み立て）。各図形へは`toDrawElement()`をポリモーフィックに呼ぶだけで、図形種別の分岐・図形固有のプロパティ名（`points`の何番目が何か等）を持たない。知っているのは描画要素の`kind`の語彙と形の項目名。
  * `serialize`は入力を検証しない（`toDrawElement`を持たない要素が混ざると例外。呼び出し側で捕捉する）。
* **`js/io/CodeExporter.js`（新設。開発資料1章で予定されていた名前をそのまま使う）**：スプライトJS（ESモジュール）のテキストの組み立て（スプライトデータの埋め込みと、共通の描画処理の埋め込み）。静的メソッドのみのクラス。
  * 公開：`static toModuleText(spriteData)`（文字列。末尾は改行）。
  * importは`SpriteSerializer`のみ（`stringify`・`DEFAULT_STROKE_WIDTH`）。図形・図形種別・キャンバス名を知らない（引数はスプライトデータのみ）。DOMに触れない。
  * 知っているのは描画要素の`kind`ごとの描き方（埋め込む描画処理のテキストの中）。
* **図形種別ごとの知識の置き場所（決定と理由）**：描画要素への変換は**図形クラスに共通契約の第13メソッド`toDrawElement()`を足して**置く（共通契約の変更として扱う）。
  * 理由1：`Ellipse`の`points`の何番目が何か・角度が`type`から決まること等、図形の内部の約束を図形クラスの外へ出さない（描画データは内部の約束を知らなくても描ける形にする要件）。
  * 理由2：`toDrawElement()`は同じファイルの`draw(ctx)`と同じ式で書けるため、エディタの描画と書き出しの式が1つのファイルに並び、食い違いに気づきやすい。
  * 理由3：既存の方針（`DocumentSerializer`は図形種別の分岐・図形固有のプロパティ名を知らない）を`SpriteSerializer`でも守れ、図形種別を足すときに既存の`kind`で表せれば`io/`を変更しなくてよい。
  * 図形種別の分岐が増える箇所：`Ellipse.toDrawElement()`内の`closed: this.type === 'circle'`の1箇所のみ（`Ellipse`の既存の`type`による分岐と同じ扱い。`ELLIPSE_TYPES`のJSDocの「種別で分岐する全箇所」へ追記する）。`kind`による分岐は`SpriteSerializer`（外枠）と`CodeExporter`（埋め込む描画処理）の2箇所で、描き方の語彙（P6のパス等）が増えたときだけ増える。
  * `core/`（`CanvasManager`等）は`toDrawElement()`を呼ばない。呼び出し元は`SpriteSerializer`のみ。
* **ダウンロード**：`Blob`・`<a download>`は`DocumentFileIO`に閉じる。MIMEタイプは`DocumentFileIO`がファイルの種類ごとに持つ（作業データファイル・スプライトのJSON：`application/json`、スプライトのJS：`text/javascript`）。`CanvasFileOperations`はファイルの種類ごとのメソッドを呼ぶだけ。
* **手順の組み立て**：`CanvasFileOperations.exportSprite()`（要件1の手順。受理条件・通知は`exportCanvas`に揃える）。

### 要件9-2: 自動テスト（決定）
* `test/io/SpriteSerializer.test.js`（新設）：5種の描画要素の中身（`kind`・`id`・頂点の並び順・`closed`・楕円の引数・線の色と太さ）、描画順、外枠（線の太さを含む。曲線は制御点ではなく極値、弧は上半分、円は全周、複数の和）、図形0個（`elements: []`・`bounds: null`）、`strokeWidth`が`undefined`の要素の外枠を2pxで求めること（図形の公開プロパティ`strokeWidth`へ`undefined`を代入して確かめる）、`source`が`DocumentSerializer.deserialize`で元の図形に戻ること、`format`・`formatVersion`と`source.version`が別のキーであること（最上位に`version`が無い）、`stringify`の結果を`JSON.parse`すると`serialize`の結果と同じ、戻り値を書き換えても図形が変わらない（独立性）・引数を書き換えない。
* `test/io/CodeExporter.test.js`（新設）：組み立てたJSのテキストを`data:text/javascript,`＋`encodeURIComponent(テキスト)`のURLで動的`import`できること、exportが既定のexportのみであること、`import`文を含まないこと、既定のexportから`draw`を除いたものが`JSON.parse(SpriteSerializer.stringify(data))`と同じこと、**見た目の一致**（下記）、図形0個で何も描かないこと、`strokeWidth`の無い要素を`lineWidth = 2`で描くこと、未知の`kind`の要素を描かないこと、`strokeColor`が文字列でない要素の線を描かないこと（その要素の線のパスと`stroke()`が呼ばれない。テスト名・説明も「線を描かない」とする）（どちらもスプライトデータを手で組み立てて`toModuleText`へ渡す）、`strokeColor`に引用符・`</script>`・改行・U+2028等を含めてもコードとして解釈されず値がそのまま戻ること。
  * **見た目の一致の求め方（決定）**：テストファイル内に、メソッド呼び出し（`beginPath`・`moveTo`・`lineTo`・`quadraticCurveTo`・`ellipse`・`closePath`・`stroke`・`save`・`restore`・`setLineDash`）とプロパティの代入（`strokeStyle`・`lineWidth`・`lineCap`・`lineJoin`・`miterLimit`。`Object.defineProperty`のsetterで記録）を順に記録する偽の`ctx`（素のオブジェクト）を作る。同じ図形の配列について、(A) エディタ：各図形の`draw(ctx)`を順に呼んだ記録、(B) 書き出し：`import`した既定のexportの`draw(ctx)`の記録、を取り、(B)が「`save` → `lineCap='butt'` → `lineJoin='miter'` → `miterLimit=10` → `setLineDash([])` →（Aと完全に同じ並び・同じ引数）→ `restore`」であることを`deepStrictEqual`で確かめる。5種それぞれ・混在（描画順）・色と太さを変えた図形・頂点を動かした図形で行う。
* `test/io/DocumentFileIO.test.js`（新設）：`toFileName`（`.ozve.json`・使えない文字・前後の空白・末尾のピリオド・空なら`無題.ozve.json`・文字列以外）、`toSpriteModuleFileName`・`toSpriteJsonFileName`（`.js`・`.json`・先頭の`_`と空白の除去・除去で空なら`無題`・使えない文字の置換の後に先頭の`_`を除くこと）、`toCanvasName`（`.ozve.json`・`.json`・大文字小文字・1回だけ除く）、往復（要件6の4例と`ship.json`）。`downloadText`等のダウンロードは`document`に依存するためテストしない。
* `test/edit/CanvasFileOperations.export.test.js`（新設）：`exportSprite`・`exportCanvas`の手順。依存の偽物を注入し、ダウンロードの呼び出し（順序・引数）、受理条件（`loading`・`busy`で不受理・何も呼ばない／`'unavailable'`でも受理）、空のキャンバスでも2つとも落ちて通知なし、組み立ての失敗でどちらも落とさない、1つ目の失敗で2つ目を呼ばない、2つ目の失敗で通知、受理時に既存の通知を消すこと、`prepareInsert`・`insertDocument`・`createCanvasFromShapes`を呼ばないこと。
* 既存の`test/edit/CanvasFileOperations.test.js`は**変更しない**（偽の`fileIO`は`downloadText`を持ち、開く・インポートのテストは出力に依存しないため影響なし。計画時に確認）。

### 要件10: 開発資料への記載先（決定）
* スプライトデータの形（項目名・意味・単位・基準点・y軸・描画順・`id`と頂点の並び順・楕円の引数・2pxの規則・外枠の求め方と近似・空のときの`null`・読む側の規則）、2つの版の項目名と上げる条件、JSのexportの形と組み立て用のJSの例、ファイル名の規則：**`PROJECT_ARCHITECTURE.md` 2章**に「スプライト（書き出し形式）」として1箇所にまとめる（作業データ形式と並ぶ保存形式のため。Phase 04-04でエンジン側へ渡す文書の元になる）。
* モジュールの責務：`_doc/arch/15_io.md`（`SpriteSerializer`・`CodeExporter`・`DocumentFileIO`）、`12_shapes.md`（13メソッド契約）、`10_ShapeFactory.md`（契約の数）、`14_edit.md`（`CanvasFileOperations`）、`13_palette.md`（`CanvasPalette`）、`02_main.md`（注入の一覧・行数）、`01_index_html.md`（キャンバスパレットのボタンの並び）、`16_test.md`（テスト）。流れ：3章9.。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形。共通契約へ`toDrawElement`を追加）、`./js/io/`（スプライトの組み立て新設・ファイル名とダウンロード）、`./js/edit/`（出力の手順）、`./js/palette/`（ボタンと文言）、`./js/main.js`（配線）、`./index.html`（ボタン・並べ方）、`./test/io/`・`./test/edit/`（テスト新設）。最終タスクのみ`./PROJECT_ARCHITECTURE.md`・`./_doc/arch/`。
*   **新設する論理クラス**: `SpriteSerializer`（`js/io/SpriteSerializer.js`）、`CodeExporter`（`js/io/CodeExporter.js`）。
*   **変更する論理クラス**: `Line`・`Curve`・`Rect`・`Ellipse`（`toDrawElement`の追加と責務定義・契約のJSDoc）、`DocumentFileIO`（拡張子・スプライトのダウンロードとファイル名）、`CanvasFileOperations`（`exportSprite`・通知の種類）、`CanvasPalette`（ボタン・文言）、`main.js`（注入1行・コメント）。
*   **変更しない**: `js/core/`全体（`ShapeFactory`・`CanvasManager`を含む）、`DocumentSerializer`、`CanvasStorage`、`CanvasLibrary`、`ShapeInserter`、`ClipboardController`、`SnapshotAdapter`、`DevPanel`、`PaletteController`、`PaletteLauncher`、既存のテスト3ファイル。
*   **`js/shapes/`を変更する理由**：要件9「図形種別ごとの知識の置き場所」のとおり（図形の内部の約束を外へ出さず、`io/`に図形種別の分岐を持ち込まないため）。

### 参照する責務
*   **依存方向**（1章）：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`io/`は作業データ形式の変換・保存先とファイルへの読み書き（本作業でスプライトの組み立てを加える）。
*   **憲法3章**：各`.js`の最先頭行に単一責務のJSDoc（3行以内）。責務を逸脱するメソッドを足さない（足す場合は責務定義の変更として本RESに明記したものに限る）。クラス・関数・メソッド・データ構造にJSDoc。グローバル変数・外部ライブラリ・ビルドツールの禁止。`index.html`をブラウザで直接開いて動くこと。
*   **図形データ**（2章）：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`。`Line`は`x1, y1, x2, y2`で保持し図形データでは`points`2点[始点, 終点]。`Curve`は`points`3点[始点, 制御点, 終点]。`Rect`は`points`4点[topLeft, topRight, bottomRight, bottomLeft]（論理名。正規化しない）。`Ellipse`（`circle`・`arc`）は`points`5点[中心, 右端制御点, 上端制御点, 開始角制御点, 終了角制御点]、`startAngle`・`endAngle`は公開プロパティで`type`から決まる固定値（`circle`は0〜2π、`arc`はπ〜2π）。
*   **作業データ形式**（2章）：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）。`DocumentSerializer.serialize(shapes)`は新しいオブジェクトを返し、図形インスタンスを共有しない。`serializeToString`は字下げ2。`deserialize`は例外を投げず`{ ok, shapes, skipped, error }`を返す。`format`が一致しなければ全体失敗。
*   **`shapes/`**（4章`12_shapes.md`）：共通基底クラスは無く、各図形クラスが共通契約（現在12メソッド：`draw(ctx, t)`・`drawHandles`・`drawHover`・`hitTest`・`hitTestHandle`・`setVertex`・`translate`・`updateDraftEnd`・`getVertexIndexForHandle`・`intersectsRect`・`toJSON`・`static fromJSON`）を自律実装する。メソッドを増減する場合は4クラスのクラスJSDocも更新する。`toJSON`/`fromJSON`はどちらの方向でも内部配列・頂点オブジェクトを共有しない。各図形クラスは`try/catch`を持たない。各`draw`は`beginPath`→パス→`strokeStyle`→`lineWidth`→`stroke()`の順（この順は`12_shapes.md`には書かれていない。実コード：`Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`の`draw`による）（`Line.draw(ctx)`は`t`を持たない）。
*   **`DocumentFileIO.js`**（4章`15_io.md`・ソース）：作業データファイルのブラウザ内での読み書き（`Blob`のダウンロード・`File`の読み取り・ファイル名とキャンバス名の変換）。公開メソッド`downloadText`・`readText`・`getFileName`・`toFileName`・`toCanvasName`。中身を解釈しない・importを持たない・状態を持たない。キャンバス名の長さ・空の扱いは`CanvasLibrary`の知識のため持ち込まない。`downloadText`はオブジェクトURLの解放を`try/finally`で10秒後に予約する。例外は捕捉しない。
*   **`CanvasFileOperations.js`**（3章9.・4章`14_edit.md`・クラスJSDoc）：ファイル操作の組み立てと、パレットの表示同期用の状態（`getState()`＝`CanvasLibrary.getState()`＋`busy`の合成＋`fileNotice`）・変更通知。DOMに触れない。importは`DocumentSerializer`のみ（本作業で`SpriteSerializer`・`CodeExporter`を加える）。`model`は`getShapes`のみ使う。書き出し（`exportCanvas`）：受理条件は合成後の`getState()`の`loading`・`busy`が偽／受理時に通知を消す／`serializeToString(model.getShapes())`と`openCanvasName ?? ''`を`fileIO.downloadText`へ／準備中の例外は捕捉して`console.warn`＋通知`exportFailed`／例外を投げない（リスナーの例外を除く）／図形一式・選択集合・履歴・ビュー変換・操作モード・作成途中の図形に触れない。通知の解除：次のファイル操作の受理時・キャンバスの切り替えの成功時。成功時は通知を出さない。typedef`FileNotice`は`CanvasPalette.js`と二重定義（揃えること）。
*   **`CanvasPalette.js`**（4章`13_palette.md`・クラスJSDoc）：DOM操作専任。importを持たず、`CanvasLibrary`・`VectorModel`・図形データを参照しない（受け取るのは`render(state)`の状態とコールバックのみ）。必要な要素が1つでも欠けると`console.warn`して配線しない。コールバックが関数でなければコンストラクタが`Error`を投げる。押されたボタンは処理前に`blur()`。`busy || loading`で書き出し・インポートを`disabled`（`'unavailable'`でも押せる）。文言の対応表`ISSUE_MESSAGES`・`FILE_NOTICE_MESSAGES`はこのファイルが唯一の定義箇所。名前・ファイル名は`textContent`のみで設定する。
*   **`index.html`**（4章`01_index_html.md`）：スタイルは`<style>`に内包。ボタン単体の押せない状態は`disabled`属性と`.tool-btn:disabled`（`.disabled`クラスと混用しない）。キャンバスパレットのファイル選択は「開く」用・「インポート」用の非表示の`input type="file"`を2つ置く（1つにまとめない）。
*   **`main.js`**（4章`02_main.md`）：インスタンス化・依存の注入・イベントバインドのみ。判定ロジック・作業データの中身の解釈を持たない。`CanvasPalette`へ`onExport`/`onOpenFile`/`onImportFile`→`canvasFileOperations`の`exportCanvas`/`openFile`/`importFile`を注入している（配線ブロック`// 7.6.`）。
*   **`test/`**（4章`16_test.md`）：`node:test`・`node:assert/strict`のみ。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。共有の補助モジュールを置かず、補助関数は各テストファイル内に書く（JSDoc付き）。先頭行に単一責務のJSDoc。公開API（`export`されたクラス・定数・publicメソッド・JSDocにある公開プロパティ）のみを通す。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える。図形の`id`は公開プロパティ`id`へ文字列を直接代入する。確認したNode.jsはv24.20.0（計画時の`node --test`：tests 145・pass 145・fail 0）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造の`io/`：`CodeExporter.js`の「未実装（P4の書き出しで追加予定。現在このファイルは存在しない）」の注記を消し、`SpriteSerializer.js`を追加する（`DocumentFileIO.js`の後に`SpriteSerializer.js`、`CodeExporter.js`の順）。
    *   フォルダ構造の`test/`：`test/io/SpriteSerializer.test.js`・`test/io/CodeExporter.test.js`・`test/io/DocumentFileIO.test.js`・`test/edit/CanvasFileOperations.export.test.js`を追加する。
    *   「存在しないもの」：「JS形式の入力（書き出し済みJSの再読み込み。`CodeImporter`は作らない…）」は残し、「スプライト（JS・JSON）の読み込み（確認用ページ、「開く」「インポート」でのスプライトの読み込み。Phase 04-03で予定）、組み立て用のJSの書き出し（P7）、複数キャンバスの一括出力、PNG・SVG等の形式」を加える。
    *   「フォルダ分割の方針」の`io/`：「スプライト（書き出し形式）の組み立て（`SpriteSerializer`）とスプライトJSのテキストの組み立て（`CodeExporter`）」を加える。
*   **`PROJECT_ARCHITECTURE.md` 2章**：
    *   「作業データファイル」：既定の拡張子を`.ozve.json`へ（読み込みは従来の`.json`も可。ファイル名の規則は下記）。
    *   「スプライト（書き出し形式）」の項を新設し、本RES 2章の要件3〜5・7・8の内容（スプライトデータの形と各キーの意味・単位・基準点・y軸・角度の単位・描画順・`id`と頂点の並び順の保持・`kind`ごとの描画要素のキーと描き方・回転なし・読む側の規則（未知のキー・未知の`kind`・2px・`strokeColor`が文字列でない要素は線を描かない（要素を捨てる規則ではなく線についての規則。P5で足す塗り等はこれに縛られない）・形の項目が足りない）・外枠の表し方と求め方と近似・空のときの`bounds: null`と`draw`が何も描かないこと・2つの版のキー名と上げる条件・識別子・JSONの字下げ・JSの形（`import`文なし・既定のexportのみ・`draw`の`save`/`restore`と明示する設定・明示しない設定とその理由）・組み立て用のJSの例）をまとめて書く。
    *   「ファイル名の規則」：作業データファイル`<名前>.ozve.json`（開くときは末尾の`.ozve.json`または`.json`を1回だけ除く。往復の例）、スプライト`<名前>.js`・`<名前>.json`（先頭の`_`と空白を除く。DIRの組み立て用のJSは名前の頭に`_`を付け、パーツのJSは付けないため）。共通の手順（使えない文字・空白・末尾のピリオド・空なら`無題`）。規則の唯一の定義箇所は`DocumentFileIO`。
*   **`PROJECT_ARCHITECTURE.md` 3章**：
    *   6.「記録しない操作」の「書き出し」→「出力（作業ファイル・エンジン用）」。
    *   8.「逃げ道は書き出し」→「逃げ道は出力（作業ファイル）」。「`'unavailable'`でも書き出し・インポートは使える」→「出力（作業ファイル・エンジン用）・インポートは使える」。
    *   9.の見出し・用語・流れ：用語「書き出し」を「**出力（作業ファイル）**（コード上は`exportCanvas`）」へ改め、「**出力（エンジン用）**＝開いているキャンバスをスプライトのJSとJSONとしてダウンロードする（`exportSprite`）」を足す。流れ：`SpriteSerializer.serialize(model.getShapes())` → `stringify`・`CodeExporter.toModuleText`で2つのテキストを先にそろえる → `DocumentFileIO.downloadSpriteModule` → `downloadSpriteJson`。組み立ての失敗ではどちらも落とさず、1つ目の失敗で2つ目を呼ばない。失敗は通知`spriteExportFailed`。ダウンロードの間隔は空けない。図形・選択集合・履歴・ビュー変換・操作モードに触れず、自動保存の契機にならない。「ファイル名とキャンバス名の変換」へ拡張子`.ozve.json`・スプライトの規則を反映。
*   **`_doc/arch/15_io.md`**：`io/`の冒頭の文にスプライトの組み立てを加える。`DocumentFileIO.js`：責務（作業データファイル・スプライトのファイル）、公開メソッドへ`downloadSpriteModule`・`downloadSpriteJson`・`toSpriteModuleFileName`・`toSpriteJsonFileName`を追加、ファイルの種類ごとの拡張子・MIMEタイプを持つこと、呼び出し元。`CodeExporter.js`の「未実装」の項を実態に置き換え、`SpriteSerializer.js`の項を新設（公開・知らないこと・依存・契約・`kind`を足す手順（図形の`toDrawElement`・`SpriteSerializer`の形の範囲の表・`CodeExporter`の描画処理・テスト・書き出し形式の版））。
*   **`_doc/arch/12_shapes.md`**：「12メソッド契約」→「13メソッド契約」、`toDrawElement()`を一覧に追加し、説明（戻り値は2章の描画要素、図形ごとの`kind`、配列・頂点を共有しない、`draw`と同じ式で求める、呼び出し元は`SpriteSerializer`のみ、`draw`を変えたら`toDrawElement`と`CodeExporter`の描画処理と`test/io/CodeExporter.test.js`を揃える）。「新規図形を追加する際は…満たせば`core/`・`io/`を変更せずに…」へ「既存の`kind`で表せない場合は`io/`の`SpriteSerializer`・`CodeExporter`も変更が要る」を補う。図形種別を追加したら`SpriteSerializer`・`CodeExporter`のテストにもケースを足す。
*   **`_doc/arch/10_ShapeFactory.md`**：図形種別の追加手順の「12メソッド契約」→「13メソッド契約」。
*   **`_doc/arch/14_edit.md`**：`CanvasFileOperations.js`：責務の文・公開メソッドへ`exportSprite`・依存（importに`SpriteSerializer`・`CodeExporter`）・出力の手順のテスト`test/edit/CanvasFileOperations.export.test.js`。`edit/`冒頭の「importは`DocumentSerializer`のみ」は`CanvasFileOperations`の例外を明記する。
*   **`_doc/arch/13_palette.md`**：`CanvasPalette.js`：ファイル操作の呼び出しが出力2種・開く・インポートであること、`'unavailable'`でも出力（2種）・インポートは押せること。
*   **`_doc/arch/02_main.md`**：注入の一覧の`CanvasPalette`へ`onExportSprite`→`exportSprite`を追加。行数を実測値へ更新。
*   **`_doc/arch/01_index_html.md`**：キャンバスパレットのボタンの並び（出力の2ボタンは1行に収まらないため1行に1つ、「開く」「インポート」は`.canvas-file-row`で横並び）と、`accept`が`.ozve.json`も選べること。
*   **`_doc/arch/16_test.md`**：既存のテストファイルと検証範囲へ新設の4ファイルを追加。「テストできない箇所」を更新（`DocumentFileIO`のファイル名の変換は`test/io/DocumentFileIO.test.js`でテストする。図形の`draw`は描画命令を記録する偽の`ctx`で書き出しの描画処理と比べている（ピクセルの比較ではない）。`CanvasFileOperations`の出力の手順はテストする）。描画命令の比較を「画面の描画のテスト」とは区別して書く。
*   (各タスクの実行時に影響が判明した場合も、この欄へ追記する。資料本体への反映は最終タスクで行う)

## 3. タスクリスト
*   [x] タスク1: 図形クラスへ描画要素への変換`toDrawElement()`を追加（共通契約の変更）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` :（更新）
        *   `./js/shapes/Curve.js` :（更新）
        *   `./js/shapes/Rect.js` :（更新）
        *   `./js/shapes/Ellipse.js` :（更新）
    *   **作業内容** :
        *   各クラスへ`toDrawElement()`を追加する（`toJSON()`の直前に置く）。戻り値は2章要件3の描画要素（キーの順も表のとおり）。毎回新しいオブジェクト・新しい頂点オブジェクトを作り、内部配列・頂点を共有しない。`id`・`strokeColor`・`strokeWidth`は自身のプロパティをそのまま入れる（検証・補完しない）。
            *   `Line`：`{ kind: 'polyline', id, points: [{x: x1, y: y1}, {x: x2, y: y2}], closed: false, strokeColor, strokeWidth }`。
            *   `Rect`：`{ kind: 'polyline', id, points: points[0..3]の複製, closed: true, strokeColor, strokeWidth }`。
            *   `Curve`：`{ kind: 'quadratic', id, points: points[0..2]の複製, strokeColor, strokeWidth }`。
            *   `Ellipse`：`draw()`と同じ式で`{ kind: 'ellipse', id, x, y, radiusX, radiusY, startAngle: this.startAngle, endAngle: this.endAngle, closed: this.type === 'circle', strokeColor, strokeWidth }`。
        *   既存の`draw`等のメソッドは変更しない（式を共通化する整理もしない）。
        *   各メソッドにJSDoc（何を返すか・キー・「共通メソッド契約の第13メソッド」・`draw`と同じ式であること・配列を共有しないこと・呼び出し元は`SpriteSerializer`）。`@returns`に戻り値の形を書く。
        *   責務定義の変更：4ファイルの先頭の責務JSDocを「…および図形データ・描画要素（スプライトの書き出し用）との変換を担う。」の趣旨へ改める（3行以内。`Line`は「相互変換」→「図形データとの相互変換と描画要素への変換」等、意味が通るように）。クラスJSDocの「共通メソッド契約（12メソッド：…・static fromJSON）」を「13メソッド：…・static fromJSON・toDrawElement」へ改める。`Rect.js`の`#distanceToSegment`のJSDocの「12メソッド契約には含まれない」を「13メソッド契約」へ改める。`Ellipse.js`の`ELLIPSE_TYPES`のJSDocの「種別で分岐する全箇所」へ`toDrawElement`を加える。
        *   完了時にプロジェクトのルートで`node --test`を実行し、全テストの成功と件数（`tests`・`pass`・`fail`）を本RESの4章へ記録する（既存の145件が通ること）。開発資料への影響が判明したら2章の更新予定欄へ追記し、判断に迷った点は5章へ記述する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク2: スプライトデータの組み立て`SpriteSerializer`の新設とテスト
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` :（新規）
        *   `./test/io/SpriteSerializer.test.js` :（新規）
    *   **作業内容** :
        *   `SpriteSerializer.js`：先頭行に単一責務JSDoc（案：「責務: スプライトデータ形式（書き出し形式）の定義と、図形一式からのスプライトデータ（描画要素・外枠・作業データsource）の組み立て・JSON文字列化を担う。DOMに依存しない。」）。2章要件9の公開・非公開の構成で作る：非公開定数`SPRITE_FORMAT = 'oz-vector-editor-sprite'`・`SPRITE_FORMAT_VERSION = 1`、named export `DEFAULT_STROKE_WIDTH = 2`、`export class SpriteSerializer`（`static serialize(shapes)`・`static stringify(spriteData)`）。
        *   `serialize(shapes)`：`elements = shapes.map((shape) => shape.toDrawElement())`、`bounds`＝2章要件5の計算（要素0個なら`null`）、`source = DocumentSerializer.serialize(shapes)`。戻り値のキーの順は`format, formatVersion, bounds, elements, source`。
        *   外枠：`kind`→形の範囲を求める関数の対応表（`Object.freeze`。`polyline`・`quadratic`・`ellipse`）と、線の太さの解決（正の有限の数値でなければ`DEFAULT_STROKE_WIDTH`）を非公開の静的メソッド・定数で持つ。未知の`kind`は`Error`をthrow。
        *   typedef（`SpriteData`・`DrawElement`・`SpriteBounds`）とすべての関数・メソッド・定数にJSDocを書く。importは`./DocumentSerializer.js`のみ。DOM・`window`・`document`に触れない。
        *   `SpriteSerializer.test.js`：先頭行に単一責務JSDoc。2章要件9-2の`SpriteSerializer`の項目をすべて書く。図形は`ShapeFactory.create`または各図形クラスのコンストラクタで作り、`id`へ文字列を代入する。外枠の値は手計算の期待値と比べる（弧・円の両端を含む値は許容誤差1e-9で比べる補助関数をテストファイル内に置く）。少なくとも次の期待値を含める：曲線 始点(0,0)・制御点(50,100)・終点(100,0)・太さ2 → `{minX:-1, minY:-1, maxX:101, maxY:51}`（制御点の100を使わない）、円 中心(10,20)・半径(30,40)・太さ2 → `{-21, -21, 41, 61}`、弧（同じ値）→ `{-21, -21, 41, 21}`（`maxY`は許容誤差で比べる）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗した場合、テストの誤りなら直し、本タスク・タスク1の実装の誤りなら直す（それ以外の既存コードの不具合と考えられる場合は直さずに5章へ記録して報告する）。開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク3: スプライトJSのテキストの組み立て`CodeExporter`の新設とテスト
    *   **対象ファイル** :
        *   `./js/io/CodeExporter.js` :（新規）
        *   `./test/io/CodeExporter.test.js` :（新規）
    *   **作業内容** :
        *   `CodeExporter.js`：先頭行に単一責務JSDoc（案：「責務: スプライトJS（ESモジュール）のテキストの組み立て（スプライトデータの埋め込みと、データを読む共通の描画処理の埋め込み）を担う。DOMに依存しない。」）。`export class CodeExporter`に`static toModuleText(spriteData)`。importは`./SpriteSerializer.js`（`SpriteSerializer.stringify`・`DEFAULT_STROKE_WIDTH`）のみ。
        *   組み立てるテキストは2章要件7の形：固定の先頭コメント → `const spriteData = ` ＋ `SpriteSerializer.stringify(spriteData)` ＋ `;` → `const DEFAULT_STROKE_WIDTH = ` ＋ `JSON.stringify(DEFAULT_STROKE_WIDTH)` ＋ `;` → 描画処理（`draw`・`drawElement`。非公開の定数文字列としてこのファイルに持つ）→ `export default { ...spriteData, draw };`。末尾は改行。キャンバス名等の利用者の入力を受け取らない・埋め込まない。描画処理は2章要件7の`draw(ctx)`・`drawElement`の仕様（`save`→`try`→設定の明示（`lineCap`→`lineJoin`→`miterLimit`→`setLineDash([])`）→要素を順に描く→`finally`で`restore`、要素ごとの判定と命令の順）どおりに書く。描画処理の中で`import`・テンプレート文字列・外部の名前（`window`等）を使わない。
        *   定数・メソッドにJSDocを書く（埋め込む描画処理のテキストの定数には、2章要件3の表・要件7の仕様と`shapes/`の各`draw`と揃えて保守する必要があることを書く）。
        *   `CodeExporter.test.js`：先頭行に単一責務JSDoc。2章要件9-2の`CodeExporter`の項目をすべて書く。動的`import`は`await import('data:text/javascript,' + encodeURIComponent(text))`。描画命令を記録する偽の`ctx`を作る補助関数（JSDoc付き）をテストファイル内に置く。`globalThis`へ代入しない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。見た目の一致を確かめられない点があれば理由を5章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク2と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク4: ファイル名の規則とスプライトのダウンロード（`DocumentFileIO`）とテスト
    *   **対象ファイル** :
        *   `./js/io/DocumentFileIO.js` :（更新）
        *   `./test/io/DocumentFileIO.test.js` :（新規）
    *   **作業内容** :
        *   先頭の責務JSDocを「作業データファイルとスプライトのファイル（JS・JSON）のブラウザ内での読み書き（Blobのダウンロード・Fileの読み取り・ファイル名とキャンバス名の変換）を担う。中身は解釈しない（文字列として受け渡す）。」の趣旨へ改める。
        *   定数：作業データファイルの拡張子を`.ozve.json`へ。スプライトのJSの拡張子`.js`・MIMEタイプ`text/javascript`、スプライトのJSONの拡張子`.json`（MIMEタイプは`application/json`）を追加。キャンバス名へ戻すときの正規表現を`/(\.ozve)?\.json$/i`へ。先頭の`_`と空白の正規表現`/^[_\s]+/u`を追加。各定数にJSDoc。
        *   公開メソッド：`downloadText(text, canvasName)`（作業データファイル。動作は従来どおり、ファイル名が`.ozve.json`になる）、`downloadSpriteModule(text, canvasName)`（`<名前>.js`・`text/javascript`）、`downloadSpriteJson(text, canvasName)`（`<名前>.json`・`application/json`）、`toFileName(canvasName)`（`.ozve.json`）、`toSpriteModuleFileName(canvasName)`、`toSpriteJsonFileName(canvasName)`、`toCanvasName(fileName)`（末尾の`.ozve.json`または`.json`を1回だけ除く）、`readText`・`getFileName`（変更なし）。
        *   共通化：ダウンロードの手順（Blob→オブジェクトURL→`<a download>`→`click()`→削除、URLの解放の予約）は非公開メソッド（例`#downloadBlob(text, fileName, mimeType)`）1つにまとめ、3つのダウンロードのメソッドから呼ぶ。ファイル名の手順（2章要件2の1〜3・5）は非公開メソッド（例`#toBaseName(canvasName, stripLeadingUnderscores)`）1つにまとめ、3つのファイル名のメソッドから呼ぶ（規則を重複させない）。
        *   `toFileName`・`toCanvasName`のJSDocの規則と往復の例を`.ozve.json`に合わせて書き直す。クラスJSDocの「既定の拡張子`.json`」等も実態に合わせる。
        *   `DocumentFileIO.test.js`：先頭行に単一責務JSDoc。2章要件9-2の`DocumentFileIO`の項目をすべて書く。`downloadText`・`downloadSpriteModule`・`downloadSpriteJson`はテストしない（`document`に依存するため。JSDocにも書かない）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク2と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク5: 出力（エンジン用）の手順（`CanvasFileOperations.exportSprite`）とテスト
    *   **対象ファイル** :
        *   `./js/edit/CanvasFileOperations.js` :（更新）
        *   `./test/edit/CanvasFileOperations.export.test.js` :（新規）
    *   **作業内容** :
        *   importに`../io/SpriteSerializer.js`・`../io/CodeExporter.js`を加える。
        *   `exportSprite()`を`exportCanvas()`の直後に追加する（同期。戻り値`boolean`＝2つともダウンロードしたか。例外を投げない（リスナーの例外を除く））：受理判定（合成後の`getState()`の`loading`・`busy`が偽。不受理なら何も変えず`false`）→ 通知があれば消して`#notifyChange()` → `try`の中で、(1)`SpriteSerializer.serialize(this.#model.getShapes())`、(2)`SpriteSerializer.stringify`でJSONのテキスト、(3)`CodeExporter.toModuleText`でJSのテキストをそろえ、(4)`this.#fileIO.downloadSpriteModule(JSのテキスト, 名前)`、(5)`this.#fileIO.downloadSpriteJson(JSONのテキスト, 名前)`（名前は`state.openCanvasName ?? ''`）→ `true`。`catch`で`console.warn`＋通知`{ kind: 'spriteExportFailed', fileName: null, skippedCount: 0 }`＋`#notifyChange()`→`false`。
        *   JSDocの更新：先頭の責務JSDoc（「作業データファイルの出力・開く・インポートと、スプライトの出力の組み立て…」の趣旨。3行以内）、typedef`FileNotice`の`kind`へ`'spriteExportFailed'`（`fileName`は「出力の失敗はnull」）、クラスJSDoc（「■ 操作と受理条件」へ出力（エンジン用）、「■ 書き出し」を「■ 出力（作業ファイル）（`exportCanvas`）」へ改め、「■ 出力（エンジン用）（`exportSprite`）」を新設（2章要件1の手順・順序・失敗の扱い・触れないもの・間隔を空けないこと）、「■ 通知の持ち方と解除条件」の「書き出しは受理時」を「出力（2種）は受理時」へ、「■ 失敗で止めない」・「■ 依存の制約」（importに2モジュールを追加）を更新）、`#fileIO`の型（`downloadSpriteModule`・`downloadSpriteJson`を追加）、コンストラクタの`deps.fileIO`の説明、`exportCanvas`のJSDoc・`console.warn`の「書き出し」の表記。
        *   `exportCanvas`・`openFile`・`importFile`の動作は変えない。
        *   `CanvasFileOperations.export.test.js`：先頭行に単一責務JSDoc。2章要件9-2の項目をすべて書く。偽の`fileIO`は`downloadText`・`downloadSpriteModule`・`downloadSpriteJson`（呼び出しを順に記録。指定に応じて例外を投げる）と、通知を消すことの確認に使う`readText`・`getFileName`・`toCanvasName`を持つ。期待するテキストはテスト内で`SpriteSerializer.serialize`・`stringify`・`CodeExporter.toModuleText`から作って比べる。`model`の偽物は`getShapes`のみ持つ。組み立ての失敗は`getShapes`が`toDrawElement`を持たない要素（例`[{}]`）を返すことで起こす。既存の`test/edit/CanvasFileOperations.test.js`は変更しない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク2と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク6: キャンバスパレットのボタンの並べ方と文言（`index.html`）
    *   **対象ファイル** :
        *   `./index.html` :（更新）
    *   **作業内容** :
        *   `#window-canvas-palette`の`.window-body`の中を2章要件1の並びにする：`#canvas-create` → `#canvas-export`（表示名「出力（作業ファイル）」・`title`は要件1-2の表）→ `#canvas-export-sprite`（新設。`type="button"`・`class="tool-btn"`・表示名「出力（エンジン用）」・`title`は要件1の文）→ `.canvas-file-row`（`#canvas-open-file`・`#canvas-import`のみ）→ 2つの`input type="file"`（変更しない）→ 一覧・通知（変更しない）。
        *   `.canvas-file-row`のCSSコメントを実態に合わせる（「開く・インポートの2ボタンを横並び」と幅の計算、出力の2ボタンは1行に収まらない（13px×(10+9)字＝約247px＞216px）ため1行に1つずつ置くこと）。CSSの規則自体は変更しない。
        *   `accept`は変更しない（`.json`で`.ozve.json`も選べるため）。
        *   この時点では`#canvas-export-sprite`は配線されず押しても何も起きない（タスク7で配線する）。既存の書き出し・開く・インポートはこれまでどおり動くこと。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する（`index.html`はテスト対象外だが、全件成功を確かめる）。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク7: キャンバスパレットの配線と文言（`CanvasPalette`・`main.js`）
    *   **対象ファイル** :
        *   `./js/palette/CanvasPalette.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `CanvasPalette.js`：`#exportSpriteButton`（`#canvas-export-sprite`）を追加し、コンストラクタで解決・必須要素の確認（欠けたら既存どおり`console.warn`して配線しない。警告文の要素一覧へ追加）・`click`で`#handleExportSprite()`（`blur()`のうえ`void this.#actions.onExportSprite()`）。コールバック`onExportSprite`を必須にする（関数でなければ`Error`。エラー文・`@throws`へ追加）。`render`で`this.#exportSpriteButton.disabled = isFileBusy`。
        *   文言：2章要件1-2の表のとおり`ISSUE_MESSAGES.writeFailed`・`FILE_NOTICE_MESSAGES.exportFailed`・`readFailed`を改め、`spriteExportFailed`を追加する。
        *   JSDoc：typedef`FileNotice`の`kind`へ`'spriteExportFailed'`（`CanvasFileOperations.js`と揃える）、typedef`CanvasPaletteActions`へ`onExportSprite`を追加し`onExport`の説明を「出力（作業ファイル）」へ、クラスJSDocの「■ 操作」「■ 表示の規則」（「出力（作業ファイル）・出力（エンジン用）・インポートを`disabled`」）、`#exportButton`・`#handleExport`の説明、コンストラクタのJSDocの要素一覧。先頭の責務JSDocは「ファイル操作の呼び出し」に含まれるため変えない。
        *   `main.js`：`CanvasPalette`へ渡すコールバックに`onExportSprite: () => canvasFileOperations.exportSprite()`を`onExport`の直後に追加する。配線ブロック`// 7.6.`のコメント2箇所の「書き出し」を2章要件1-2の表のとおり改める。それ以外は変えない（新しいimportは無い）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。可能ならブラウザで`index.html`を開き、キャンバスパレットに2つの出力ボタンが並び、コンソールに`CanvasPalette`の警告が出ないことを確認して記録する（できない場合は5章の目視確認項目に委ねる旨を記録する）。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク8: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   タスク1〜7で変更・新設したファイル :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261107_2156_RES_Phase04-02_Sprite_Export.md` :（更新）
    *   **作業内容** :
        *   新設の`.js`（`SpriteSerializer.js`・`CodeExporter.js`・テスト4ファイル）の先頭行に単一責務のJSDoc（3行以内）があること、変更したファイルの先頭の責務JSDocが実態と一致すること（`shapes/`の4ファイル・`DocumentFileIO.js`・`CanvasFileOperations.js`）、追加したクラス・関数・メソッド・定数・typedef・テストの補助関数にJSDoc（`@param`・`@returns`）があることを確認する。
        *   次を確認する：`io/`から`edit/`へのimportが無い／`core/`に変更が無い／`palette/`が図形データ・スプライトデータを参照していない／`SpriteSerializer`・`CodeExporter`・`CanvasFileOperations`がDOM・`window`・`document`に触れていない／グローバル変数（`window`への代入）が無い／テストのためだけの`export`が無い／テストが`globalThis`・`window`へ代入していない／`test/`に補助用の`.js`が無い／`package.json`等ができていない／線の太さの既定値2px・書き出し形式の版・識別子・拡張子がそれぞれ1箇所で定義されている／typedef`FileNotice`の二重定義が揃っている／画面の文言・`title`に「書き出し」が残っていない（`index.html`・`CanvasPalette.js`を`書き出し`で検索して確かめる）。
        *   プロジェクトのルートで`node --test`を実行し、全テストの成功と件数を4章のタスク8の欄へ記録する。
        *   本RESの仕上げとして、4章のタスク8の欄を記入し（タスク1〜7の欄はそれぞれのタスクで記入済みのため書き換えない）、開発資料への影響を2章の更新予定欄へ（資料本体は修正しない）、判断に迷った点・目視確認を推奨する箇所・将来修正する際の注意点を「5. 懸念事項・要確認ポイント」欄へ追記する。
        *   完了時に本タスクを [x] にする。
*   [ ] タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/15_io.md` :（更新）
        *   `./_doc/arch/12_shapes.md` :（更新）
        *   `./_doc/arch/10_ShapeFactory.md` :（更新）
        *   `./_doc/arch/14_edit.md` :（更新）
        *   `./_doc/arch/13_palette.md` :（更新）
        *   `./_doc/arch/02_main.md` :（更新）
        *   `./_doc/arch/01_index_html.md` :（更新）
        *   `./_doc/arch/16_test.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料の更新予定」に記録した内容（各タスクでの追記を含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従って反映する。スプライトデータの形は2章の「スプライト（書き出し形式）」の1箇所にまとめ、他の箇所からはそこを参照する（同じ規則を複数箇所に書き分けない）。
        *   反映時に、実際のファイル名・公開メソッド名・定数の値・キー名・`node --test`の結果が記述と一致することをソース・テストで確認する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本最終タスクのみ明示的な例外とする（後続タスクが存在せず、他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 図形クラスへ描画要素への変換`toDrawElement()`を追加（共通契約の変更）
*   **作業内容** :
    *   `Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`の各`toJSON()`の直前に`toDrawElement()`を追加した（キー順は2章要件3の表のとおり。毎回新しいオブジェクト・頂点を作り、`id`・`strokeColor`・`strokeWidth`はそのまま入れる）。
        *   `Line`：`polyline`・`closed: false`・`points`は`[{x1,y1},{x2,y2}]`。`Rect`：`polyline`・`closed: true`・`points`を並びのまま複製。`Curve`：`quadratic`・`points`3点を複製。`Ellipse`：`draw`と同じ式で`ellipse`（`radiusX`・`radiusY`は絶対値、`startAngle`・`endAngle`は自身のプロパティ、`closed: this.type === 'circle'`）。
    *   既存メソッドは変更していない。4ファイルの先頭の責務JSDocへ「描画要素（スプライトの書き出し用）への変換」を追記し、クラスJSDocを「13メソッド…・toDrawElement」へ更新した。`Rect.js`の`#distanceToSegment`のJSDocを「13メソッド契約」へ、`Ellipse.js`の`ELLIPSE_TYPES`のJSDocの分岐箇所へ`toDrawElement`を追記した。
    *   `node --test`：tests 145・pass 145・fail 0。

### タスク2: スプライトデータの組み立て`SpriteSerializer`の新設とテスト
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`を新設した（importは`DocumentSerializer`のみ）。非公開定数`SPRITE_FORMAT`・`SPRITE_FORMAT_VERSION`、named export `DEFAULT_STROKE_WIDTH = 2`、`SpriteSerializer.serialize`・`stringify`、外枠は`kind`→形の範囲の対応表（`Object.freeze`。`polyline`・`quadratic`・`ellipse`）・線の太さの解決（モジュール内の非公開関数）・非公開静的メソッド`#computeBounds`。未知の`kind`は`Error`をthrow。typedef`SpriteData`・`DrawElement`・`SpriteBounds`・`ShapeRange`にJSDocを記述。
    *   `test/io/SpriteSerializer.test.js`を新設した（18件。5種の描画要素・描画順・外枠（曲線・円・弧の指定の期待値を含む）・図形0個・`strokeWidth`が`undefined`・未知の`kind`・`source`の往復・`stringify`・独立性）。
    *   `node --test`：tests 163・pass 163・fail 0。

### タスク3: スプライトJSのテキストの組み立て`CodeExporter`の新設とテスト
*   **作業内容** :
    *   `js/io/CodeExporter.js`を新設した（importは`SpriteSerializer`のみ）。`CodeExporter.toModuleText(spriteData)`が、固定の先頭コメント → `const spriteData = <stringify>;` → `const DEFAULT_STROKE_WIDTH = <JSON.stringify>;` → 描画処理（非公開定数`DRAW_SOURCE`：`draw`・`drawElement`・`export default { ...spriteData, draw };`）の順で組み立てる（末尾は改行。利用者の入力は埋め込まない）。
    *   `test/io/CodeExporter.test.js`を新設した（20件）。動的`import`（`data:text/javascript,`）・既定のexportのみ・`import`文なし・`draw`を除いた内容がJSONと一致・`draw`の取り出し・見た目の一致（5種・混在・頂点を動かした図形。偽の`ctx`の記録を`deepStrictEqual`で比較）・図形0個・`strokeWidth`の既定2・未知の`kind`・`strokeColor`が文字列でない要素の線を描かないこと・形の項目不足・未知のキー・例外時の`restore`・`strokeColor`に特殊文字を含む場合を検証。
    *   `node --test`：tests 183・pass 183・fail 0。

### タスク4: ファイル名の規則とスプライトのダウンロード（`DocumentFileIO`）とテスト
*   **作業内容** :
    *   `js/io/DocumentFileIO.js`を更新した。先頭の責務JSDocを作業データファイルとスプライトのファイルへ改め、拡張子`.ozve.json`・スプライトのJS（`.js`・`text/javascript`）・JSON（`.json`）の定数、先頭の`_`と空白の正規表現`/^[_\s]+/u`、`toCanvasName`の正規表現`/(\.ozve)?\.json$/i`を追加・変更した。
    *   公開メソッド`downloadSpriteModule`・`downloadSpriteJson`・`toSpriteModuleFileName`・`toSpriteJsonFileName`を追加。ダウンロードの手順は非公開`#downloadBlob(text, fileName, mimeType)`、ファイル名の手順は非公開`#toBaseName(canvasName, stripLeadingUnderscores)`にまとめ、重複させていない。`toFileName`・`toCanvasName`のJSDocを`.ozve.json`と往復の例へ更新した。
    *   `test/io/DocumentFileIO.test.js`を新設した（`toFileName`・`toSpriteModuleFileName`・`toSpriteJsonFileName`・`toCanvasName`・往復。ダウンロードのメソッドはテストしていない）。
    *   `node --test`：tests 202・pass 202・fail 0。

### タスク5: 出力（エンジン用）の手順（`CanvasFileOperations.exportSprite`）とテスト
*   **作業内容** :
    *   `js/edit/CanvasFileOperations.js`を更新した。importへ`SpriteSerializer`・`CodeExporter`を追加。`exportSprite()`を`exportCanvas()`の直後に追加（受理判定→通知を消す→`serialize`→`stringify`・`toModuleText`で2つのテキストを先に組み立て→`downloadSpriteModule`→`downloadSpriteJson`。失敗時は`console.warn`＋通知`spriteExportFailed`で`false`）。`exportCanvas`・`openFile`・`importFile`の動作は変えていない（`exportCanvas`の`console.warn`の文言のみ「出力（作業ファイル）」へ）。
    *   JSDoc：先頭の責務、typedef`FileNotice`（`'spriteExportFailed'`）、クラスJSDoc（操作と受理条件・出力（作業ファイル）・出力（エンジン用）の新設・通知の解除条件・失敗で止めない・依存の制約）、`#fileIO`の型、`deps.fileIO`、`exportCanvas`のJSDocを更新した。
    *   `test/edit/CanvasFileOperations.export.test.js`を新設した（17件：`exportSprite`12件・`exportCanvas`5件。ダウンロードの順序・引数、受理条件、空のキャンバス、組み立て失敗でどちらも落とさない、JS失敗でJSONを呼ばない、JSON失敗で通知、通知の消去、`prepareInsert`等を呼ばないこと）。既存のテストは変更していない。
    *   `node --test`：tests 219・pass 219・fail 0。
    *   **監査指摘の修正** : テストの補助関数`makeShape`の`ShapeFactory.create`の呼び出しを正しいシグネチャ`create(type, 10, 20, 60, 80)`へ直した（色・太さは既定値のまま。テストは色・太さを必要としない）。
    *   修正後の`node --test`：tests 219・pass 219・fail 0。

### タスク6: キャンバスパレットのボタンの並べ方と文言（`index.html`）
*   **作業内容** :
    *   `index.html`の`.window-body`を「＋ 新規作成」→`#canvas-export`（表示名「出力（作業ファイル）」・`title`は要件1-2の文）→`#canvas-export-sprite`（新設。`type="button"`・`class="tool-btn"`・表示名「出力（エンジン用）」・`title`は要件1の文）→`.canvas-file-row`（`#canvas-open-file`・`#canvas-import`のみ）の並びへ変更した。
    *   `.canvas-file-row`のCSSコメントを実態（2ボタン・約115px・出力の2ボタンは約247px＞216pxで別の行）に合わせて直した。CSSの規則自体・`accept`・非表示の`input type="file"`・一覧・通知は変更していない。
    *   `index.html`はテスト対象外だが、`node --test`で全件成功を確かめた：tests 219・pass 219・fail 0。`CanvasPalette`は`#canvas-export-sprite`をまだ参照しない（タスク7）。

### タスク7: キャンバスパレットの配線と文言（`CanvasPalette`・`main.js`）
*   **作業内容** :
    *   (未記入)

### タスク8: JSDocの確認とRESの完成
*   **作業内容** :
    *   (未記入)

### タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   (未記入)

## 5. 懸念事項・要確認ポイント
### 計画時の判断と注意点
* **描画処理の二重の保守**：書き出したJSに埋め込む描画処理（`CodeExporter.js`内の固定のテキスト）と、エディタの各図形の`draw`（`shapes/`）は別々に保守される。食い違いは`test/io/CodeExporter.test.js`の見た目の一致のテスト（描画命令の記録の比較）で検出する。図形の`draw`・`toDrawElement`・埋め込む描画処理のどれかを変えるときは、残りとテストを揃えること。比べているのは描画命令の並びと引数であり、ピクセルの一致ではない。
* **共通契約の変更**：図形クラスの共通契約が12メソッドから13メソッド（`toDrawElement`）になる。図形種別を足すときは`toDrawElement`の実装が必要で、既存の`kind`で表せない形（P6のパス等）は`SpriteSerializer`の形の範囲の表・`CodeExporter`の描画処理・テストの変更と、書き出し形式の版の判断が要る。
* **外枠の近似**：鋭い角の継ぎ目（`miter`。上限10）の尖りは外枠に含めない（はみ出すことがある）。線の端・長さ0の線は太さの半分を四方へ広げるため実際より大きくなることがある。弧・円の両端は三角関数の誤差を含む。
* **明示しない描画の設定**：`globalAlpha`・`globalCompositeOperation`・影・`filter`・変換はゲーム側の`ctx`の値で描かれる（意図した仕様）。`strokeColor`が色として解釈できない文字列の場合、Canvasは代入を無視して直前の値（`save`時点のゲーム側の値）で描く（エディタも同じ挙動。現行のエディタの図形では起きない）。
* **複数のダウンロード**：間隔を空けずに2つ続けて落とす。ブラウザが「複数のファイルのダウンロード」の許可を尋ねる場合がある。2つ目が落ちないブラウザがあれば、後のInterruptで間隔の追加を検討する。2つ目だけ失敗した場合はJSだけが残り、通知で出し直しを促す。
* **ファイル名の変更**：ダウンロード時に利用者やブラウザがファイル名を変える（同名のファイルがあると`ship (1).js`等）と、P7でファイル名で`import`する側と合わなくなる。ファイル名の管理は利用者に任せる（DIRの方針）。
* **JSの埋め込みの前提**：スプライトデータをJSONのままJSの式として埋め込むため、JSONをJSの式として扱えるES2019以降の環境（現行の主要ブラウザ・Node.js）を前提とする。キーは本アプリが組み立てる固定のもののため、`__proto__`による`JSON.parse`との差は生じない（利用者の入力をキーにする変更をする場合は埋め込み方を見直すこと）。
* **`source`の重複**：JS・JSONの両方に作業データ`source`が入り、描画データと合わせて図形の情報を2重に持つ（ファイルの大きさが約2倍）。薄い書き出しでは許容する。
* **スプライトのJSONを「開く」**：Phase 04-03までは`format`の不一致で読み込み失敗の通知（`readFailed`）になる（停止しない）。
* **（タスク1）** `Curve`・`Rect`の`toDrawElement`は`points.slice(0, n).map(...)`で複製した（`points`は常に3・4要素のため`toJSON`と同じ結果になる）。`Ellipse.toDrawElement`は`draw`と同じ式を再掲しており（式の共通化はしていない）、`draw`の式を変えたら本メソッドも揃えること。タスク1の時点では`toDrawElement`のテストは未作成（タスク2・3で`SpriteSerializer`・`CodeExporter`のテストが検証する）。

* **（タスク6）** `#canvas-export-sprite`はタスク7で`CanvasPalette`が配線するまで押しても動かない。出力2ボタンが全幅で縦に並ぶ見た目（「＋ 新規作成」と同じ）をタスク7完了後に目視で確認すること。

### 目視確認項目（テストプレイ）
1. 「出力（エンジン用）」で、キャンバス名`ship`のとき`ship.js`・`ship.json`の2つがダウンロードされる。ブラウザが複数のダウンロードの許可を尋ねるか、尋ねた場合に許可すると2つとも落ちるかを確認する。
2. ダウンロードした`ship.json`をテキストで開くと、字下げされた`format`・`formatVersion`・`bounds`・`elements`・`source`が読める。`ship.js`は`import`文を含まない。
3. キャンバス名の先頭が`_`（例`_hero`）のとき、`hero.js`・`hero.json`になる。
4. 「出力（作業ファイル）」で`ship.ozve.json`がダウンロードされ、「開く」で`ship`という名前で開ける。「インポート」で図形が追加される。
5. ファイル選択の小窓で`.ozve.json`のファイルが選べる（「開く」「インポート」とも）。
6. 従来の`.json`の作業データファイル（Phase 04-01以前に書き出したもの）も「開く」（名前は末尾の`.json`を除いたもの）・「インポート」で読める。
7. スプライトの`ship.json`を「開く」「インポート」で選ぶと、読み込めなかった旨の通知が出てアプリは止まらない。
8. 図形が1つもないキャンバスで「出力（エンジン用）」を押すと、空のスプライトの2ファイルが落ち、通知は出ず、アプリは止まらない。
9. キャンバスパレットのボタンがはみ出さず、「出力（作業ファイル）」「出力（エンジン用）」が1行ずつ、「開く」「インポート」が1行に並ぶ。ボタンにマウスを乗せると、何がダウンロードされるか（拡張子を含む）が表示される。画面の文言・説明に「書き出し」の古い表記が残っていない（保存に失敗したときの文言は「出力（作業ファイル）」を案内する）。
10. 読み込み中（起動直後）・処理中（ファイルの読み取り中）は出力の2ボタンが押せない。保存先を利用できない状態（`'unavailable'`）でも出力の2ボタンは押せる。
11. 出力の後も、図形・選択・取り消し/やり直しの履歴・表示倍率・操作モードが変わらない（出力だけでは取り消しの対象が増えない・自動保存されない）。
12. 既存の図形の作成・選択・移動・変形・削除・取り消し/やり直し・コピー＆ペースト・キャンバスの切り替え・自動保存が変わらない。
13. プロジェクトのルートで`node --test`が全件成功する（`fail 0`）。
* 書き出したJSをブラウザで実際に`import`して描く確認は、Phase 04-03（確認用ページ）で行う（本サブフェイズでは自動テストまで）。
* **（タスク2）** 外枠の計算関数（形の範囲の各関数）はクラスの外のモジュール内関数として置いた（非公開静的メソッドにするよりテーブル化しやすいため）。判断に迷う点・開発資料への新たな影響はなし。
* **（タスク4）** 開発資料への新たな影響・判断に迷った点はなし。`downloadText`の動作は従来どおりでファイル名のみ`.ozve.json`になる。ダウンロードのメソッドは`document`に依存するためテスト未実施（目視確認項目1・4に委ねる）。
* **（タスク3）** 描画処理のテキストは`DRAW_SOURCE`（配列の行を`join`）として持ち、`draw`/`drawElement`のJSDocも書き出し先へ含めた。要素の`closed`は`=== true`のときだけ`closePath`する。`ellipse`の`radiusX`・`radiusY`の欠落（`undefined`）は不正として描かない。見た目の一致は描画命令の記録の比較であり、ピクセルの一致ではない。開発資料への新たな影響はなし。
