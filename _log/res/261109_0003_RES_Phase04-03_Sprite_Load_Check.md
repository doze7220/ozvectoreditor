# RES: 作業計画・作業レポート (Phase 04-03) : 書き出したJSの読み込み確認
* 参照元REQ: `./_log/req/261108_2355_REQ_Phase04-03_Sprite_Load_Check.md`

## 1. 作業目的
Phase 04-02で書き出したスプライト（`<名前>.js`・`<名前>.json`）を、OZ Engineの完成を待たずにエディタ側だけで「書き出し→読み込み→描画」まで確かめられるようにする。あわせて、書き出したスプライトをエディタの「開く」「インポート」で開き直せるようにする。

*   確認用ページ`sprite-check.html`（`index.html`とは別のHTML）を新設し、選んだスプライトのJSを実際に`import`して`draw(ctx)`で描き、原点(0, 0)の印・外枠・情報を表示する。JSONを選んだ場合も、JSへ埋め込む描画処理と同じもので描く。
*   エディタの「開く」「インポート」で、スプライトのJS・JSONを中身で判別し、同梱の作業データ`source`を作業データファイルと同じ処理（`DocumentSerializer.deserialize`）で読む。エディタではJSを実行しない。
*   組み立て用のJS（P7のキャラ合成の形）が現在の書き出しの形のまま動くことを`node --test`で確かめる。
*   Phase 04-02からの持ち越し2件（スプライトのJSONが`readFailed`になる／ファイル選択が`.json`のみ）を解消する。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
```text
[エディタ本体 index.html]
main.js → edit/CanvasFileOperations ──(読み込みの入口)──→ io/FileContentReader（新設）
                                                            ├→ io/CodeExporter.extractSpriteDataText（新設メソッド。JSのテキストから取り出す。実行しない）
                                                            ├→ io/SpriteSerializer.checkFormat（新設メソッド。識別子・版の判別）
                                                            └→ io/DocumentSerializer.deserialize（既存。作業データ・source の読み込み。旧版の変換を含む）

[確認用ページ sprite-check.html]
js/check/SpriteCheckPage.js（新設。DOM・流れ・Blobのimport）
    ├→ js/check/SpriteCheckInspector.js（新設。DOMに依存しない判定・要約）→ io/SpriteSerializer.checkFormat
    ├→ js/check/SpriteCheckCanvas.js（新設。描画領域の大きさと描画）
    └→ io/CodeExporter.toModuleText（JSONを選んだときに、JSと同じ描画処理を持つモジュールのテキストを作る）
```
*   `io/`内の依存：`FileContentReader → CodeExporter → SpriteSerializer → DocumentSerializer`、`FileContentReader → SpriteSerializer`、`FileContentReader → DocumentSerializer`。いずれも既存の`SpriteSerializer → DocumentSerializer`の向きと同じで循環しない。`DocumentSerializer`はスプライト形式を知らないまま（変更しない）。
*   `check/`（新設フォルダ）は確認用ページ専用。importは`check/`内と`io/`の`SpriteSerializer`・`CodeExporter`のみ。`main.js`・`edit/`・`palette/`・`core/`の状態を持つモジュール（`VectorModel`等）をimportしない。`js/`の他のモジュール・`index.html`は`check/`をimportしない。
    *   `SpriteSerializer`が`DocumentSerializer` → `core/ShapeFactory` → `shapes/`を間接的に読み込むが、いずれも状態を持たないモジュールであり、確認用ページはそれらを呼ばない（エディタの状態を持つモジュールは読み込まない）。
*   `js/main.js`・`js/core/`・`js/shapes/`・`DocumentSerializer.js`・`CanvasStorage.js`・`CanvasLibrary.js`・`ShapeInserter.js`は変更しない。

### 要件1: 確認用ページ（`sprite-check.html`）
*   **置き場所・開き方**：プロジェクトのルートに`sprite-check.html`を新設する。`index.html`と同じく、同じフォルダのHTMLをブラウザで開くだけで動く（ビルドなし・外部ライブラリなし。スタイルは`<style>`に内包）。JSは`<script type="module" src="js/check/SpriteCheckPage.js"></script>`の1つだけを読む。`index.html`・`js/main.js`には手を入れない（リンクも置かない）。
*   **画面の構成（決定）**：縦に「上部の操作・情報欄」と「描画領域」を並べ、描画領域はウィンドウの残りいっぱいに広げる（**ウィンドウに合わせる**。ウィンドウの大きさが変わったら描画領域の大きさを合わせて描き直す）。
    *   見出し（例「スプライトの確認」）。
    *   注意書き（`#check-warning`）：「選んだJSファイルはこのページで実行されます。自分で出力したファイルだけを選んでください。」
    *   ファイル選択（`<input type="file" id="check-file-input" accept=".js,.json,text/javascript,application/json">`。1回に1ファイル。`multiple`は付けない）。同じファイルを続けて選び直しても読み込むよう、選ばれた直後に`value`を空に戻す。
    *   情報欄（`<dl>`等）：ファイル名（`#check-file-name`）・書き出し形式の版（`#check-format-version`）・作業データの版（`#check-source-version`。無ければ「なし」）・描画要素の数（`#check-element-count`。配列でなければ「不明」）・外枠（`#check-bounds`。`minX`・`minY`・`maxX`・`maxY`と幅・高さ。`null`なら「外枠なし（図形0個）」、形が不正なら「外枠の値を読めません」）。値は丸めずにそのまま表示する（書き出した値を確かめるため）。
    *   結果の文言（`#check-message`）：読み込み中は「読み込み中…」、成功は空（または「表示しました」）、失敗は「読み込めませんでした：」＋理由。
    *   描画領域（`<div id="check-canvas-area">`の中に`<canvas id="check-canvas">`）。
*   **描画の座標（決定）**：原点(0, 0)を描画領域の中央に置き、等倍（スプライトの1px＝CSSの1px）で描く。拡大縮小・移動はしない。高DPIでは`canvas`の内部の大きさをCSSの大きさ×`devicePixelRatio`にし、変換`setTransform(dpr, 0, 0, dpr, 中央x×dpr, 中央y×dpr)`で描く（中央はCSSの整数px。`Math.round(幅 / 2)`）。
*   **重ね順（決定）**：①背景を白で塗る → ②外枠の矩形（`bounds`の値をそのまま使う。再計算しない。青系`#2a7ae2`の1pxの破線`[4, 4]`）→ ③原点の印（赤系`#e53935`の1pxの実線の十字。腕の長さ各12px）→ ④スプライトの絵（`sprite.draw(ctx)`）。**印・外枠を絵より先（下）に描く**ため、絵が印・外枠に隠れることはない。印・外枠の線は1pxの奇数幅のため、座標に0.5を足して描きにじみを防ぐ（スプライトの座標には足さない）。
    *   ④は`ctx.save()`→`try { sprite.draw(ctx) } finally { ctx.restore() }`で囲む（選んだJSが`ctx`の状態を戻さない場合に、次の描画へ持ち越さないため）。描くたびに①で`setTransform`し直す。
*   **描くもの（決定）**：
    *   **JSを選んだ場合**：ファイルのテキストを`new Blob([text], { type: 'text/javascript' })`にし、`URL.createObjectURL`のURLを動的`import()`する。既定のexportを判定して`draw(ctx)`で描く（ゲームと同じ経路）。URLは`import()`が成功・失敗のどちらで終わっても`finally`で`URL.revokeObjectURL`する（`import()`が終わった時点でモジュールは読み込み済みのため解放してよい）。`File`をそのまま`createObjectURL`しない（OSが付けるMIMEタイプが`text/javascript`とは限らず、モジュールとして読めないブラウザがあるため。テキストを先に読むのはJSONかの判定にも使うため）。
    *   **JSONを選んだ場合**：判定を通ったスプライトデータを`CodeExporter.toModuleText(スプライトデータ)`でJSのテキストにし、上と同じ方法で`import`して`draw(ctx)`で描く。描画処理を確認用ページで書き起こさない（エディタが書き出すJSと同じ描画処理になる）。JSONの値はJSONの文字列として埋め込まれるだけで、コードとして実行されない（2章「JSの形」と同じ性質）。
    *   **JSONかJSかの見分け方（決定・中身で判定）**：テキストが`JSON.parse`できればJSON、できなければJSとして扱う（拡張子に頼らない。エディタ側の「中身で判定」と揃え、拡張子の規則を確認用ページへ持ち込まないため）。壊れたJSONは「JSとして読み込めない」側になる（文言は下の表で両方に触れる）。
*   **本アプリのスプライトかの判定（決定）**：DOMに依存しない`js/check/SpriteCheckInspector.js`に置く。識別子・現行版の条件は`SpriteSerializer.checkFormat(value)`（新設。要件2）を使い、確認用ページに定数を重複して書かない。
    *   JSON：`checkFormat`が`'supported'`であること（JSONとして解析でき、プレーンなオブジェクトで、`format`が`"oz-vector-editor-sprite"`、`formatVersion`が1以上・現行版以下の整数）。
    *   JS：`import`でき、既定のexportがオブジェクト（`null`でない`typeof 'object'`）で、`checkFormat`が`'supported'`、かつ`draw`が関数であること。
*   **読み込めなかった場合（決定）**：ページは停止せず、前の表示（絵・印・外枠・情報欄）を消して、ファイル名と「読み込めませんでした：」＋理由を表示する。続けて別のファイルを選び直せる。理由の区分と文言（文言の対応表は`SpriteCheckPage.js`が唯一の定義箇所）：

    | 区分 | 起きる場面 | 文言（案） |
    | --- | --- | --- |
    | `readFailed` | ファイルを読み取れない（`file.text()`の失敗） | ファイルを読み取れませんでした。 |
    | `notSprite` | JSONだが本アプリのスプライトではない（作業ファイル・他の`format`・オブジェクトでない）／JSの既定のexportの形が違う・`draw`が関数でない | 本アプリが出力したスプライトではありません（作業ファイルは確認できません）。 |
    | `unsupportedVersion` | `format`は一致するが`formatVersion`が範囲外・整数でない | 対応していない書き出し形式の版です。 |
    | `importFailed` | JSONとして読めず、JSとしての`import`も失敗した（壊れたファイル・構文エラー・`import`中の例外） | JSONとして読めず、JSとしても読み込めませんでした（壊れたファイル、またはJSの読み込み中のエラー）。 |
    | `drawFailed` | `draw(ctx)`の途中で例外 | 描画中にエラーが起きました。 |

    *   例外の詳細は`console.warn`へ出す（画面には区分の文言のみ）。
*   **選び直しの競合**：読み込みごとに連番を振り、`await`の後で連番が最新でなければ結果を捨てる（前のファイルの読み込みが遅れて終わっても、新しいファイルの表示を上書きしない）。
*   **ウィンドウの大きさの変化**：`window`の`resize`で描画領域の大きさを合わせ、表示中のスプライトがあれば描き直す（`draw`をもう一度呼ぶ。その`draw`が例外を投げたら`drawFailed`として表示を消す）。
*   **やらないこと**：拡大縮小・移動・編集、複数ファイルの同時表示、組み立て用のJSの表示、エディタ本体からのリンク、無限ループ・終わらない`import`への対策（無限ループするJSを選ぶとページが固まる。止められない）。
*   **ファイルの分け方（決定）**：

    | ファイル | 責務 | DOM | import |
    | --- | --- | --- | --- |
    | `sprite-check.html` | 確認用ページのマークアップとスタイル | - | `js/check/SpriteCheckPage.js`のみ |
    | `js/check/SpriteCheckPage.js` | 起動・要素の解決・ファイル選択から表示までの流れ（読み取り→判定→Blobのimport→描画→情報欄）・文言の対応表・表示中のスプライトの保持 | 触れる | `SpriteCheckInspector`・`SpriteCheckCanvas`・`../io/CodeExporter.js` |
    | `js/check/SpriteCheckCanvas.js` | 描画領域の大きさ（ウィンドウ・dpr）と描画（背景・外枠・原点の印・スプライトの`draw`の呼び出し）。スプライト・外枠は引数で受け取り保持しない | 触れる（`canvas`と親要素のみ） | なし |
    | `js/check/SpriteCheckInspector.js` | 本アプリのスプライトかの判定（JSONの値・JSの既定のexport）、JSONかの見分け、情報欄の要約（版・要素数・外枠と幅・高さ） | 触れない（`node --test`でテストする） | `../io/SpriteSerializer.js`のみ |

    *   `SpriteCheckPage`は`File`・`Blob`・`URL`を直接使う（エディタの`DocumentFileIO`は使わない。ファイル名の規則も不要なため）。グローバル変数を作らない（`main.js`と同じく`document`の`DOMContentLoaded`で起動し、`window`へ代入しない）。

### 要件2: エディタの「開く」「インポート」でスプライトを開く
*   **ファイル選択**：`index.html`の`#canvas-open-file-input`・`#canvas-import-file-input`の`accept`を`".json,.js,application/json,text/javascript"`にする（`.ozve.json`は`.json`の末尾一致で引き続き選べる）。2つの`input`は1つにまとめない（既存の方針）。
*   **`title`の文言（決定：直す）**：
    *   「開く」（`#canvas-open-file`）：「作業ファイル（.ozve.json）、またはエンジン用に出力したスプライト（.js・.json）を新しいキャンバスとして開きます」
    *   「インポート」（`#canvas-import`）：「作業ファイル（.ozve.json）、またはエンジン用に出力したスプライト（.js・.json）の図形を、開いているキャンバスへ追加します」
*   **通知`readFailed`の文言（決定：直す）**：`CanvasPalette.js`の`FILE_NOTICE_MESSAGES.readFailed`を「`<ファイル名>` を読み込めませんでした。本アプリで出力した作業ファイル、またはエンジン用のファイル（.js・.json）か確認してください。」へ（従来の「作業ファイルか確認」ではスプライトが読めることが伝わらないため）。通知の種類・解除条件は変えない。
*   **中身での判別と`source`の取り出し（決定）**：新設の`js/io/FileContentReader.js`（静的メソッドのみのクラス`FileContentReader`）の`static deserializeFromText(text)`を、開く・インポートの読み込みの唯一の入口とする。戻り値は`DocumentSerializer`の`DeserializeResult`と同じ形（`{ ok, shapes, skipped, error }`）。例外を投げない。手順：
    1.  `JSON.parse(text)`を試す。成功したらその値を`data`とする（「JSONから」）。
    2.  失敗したら`CodeExporter.extractSpriteDataText(text)`（新設。下記）でスプライトデータのJSONのテキストを取り出す。`null`なら読み込み不可。取り出したテキストを`JSON.parse`し、失敗なら読み込み不可。成功したら`data`とする（「JSから」）。
    3.  `SpriteSerializer.checkFormat(data)`（新設。下記）で判別する。
        *   `'notSprite'`：「JSONから」なら**これまでどおり**`DocumentSerializer.deserialize(data)`の結果を返す（作業データファイル。形式違い等の全体失敗も`DocumentSerializer`が判定・警告する）。「JSから」なら読み込み不可（JSに埋め込まれていたのがスプライトデータでない）。
        *   `'unsupportedVersion'`：読み込み不可。
        *   `'supported'`：`data.source`が`undefined`（キーが無い）なら読み込み不可。それ以外は`DocumentSerializer.deserialize(data.source)`の結果を返す（旧版の変換・図形単位のスキップを含め、作業データファイルを開くときと同じ処理。`source`がオブジェクトでない等は`DocumentSerializer`の全体失敗になる）。`elements`・`bounds`は読まない。
    4.  読み込み不可（`FileContentReader`自身が判定したもの）は`console.warn`を1回出し、`{ ok: false, shapes: [], skipped: [], error: 理由 }`を返す（`DocumentSerializer`の失敗と同じ形）。理由の文字列は利用者向けの文言に出さない（既存の方針）。
    *   全体失敗の警告は、どの経路でも1回（`FileContentReader`か`DocumentSerializer`のどちらか一方）。
    *   作業データファイルの結果は従来の`DocumentSerializer.deserializeFromString(text)`と同じ（JSONとして解析できない場合の`error`の文字列と警告の出し手だけが変わる。分類・通知は同じ）。
*   **JSの形からの取り出し（決定：`CodeExporter`に置く）**：JSの形を組み立てている`CodeExporter`に`static extractSpriteDataText(moduleText)`を足し、組み立てと取り出しを同じファイルの同じ定数で行う。
    *   定数（非公開）：`SPRITE_DATA_DECLARATION_START = 'const spriteData = '`、`SPRITE_DATA_DECLARATION_END = ';'`。`toModuleText`の`const spriteData = ${...};`の行をこの2つの定数で組み立てるよう書き換える（出力のテキストは1文字も変えない）。
    *   取り出しの手順：文字列でなければ`null` → 改行コードを`\n`へそろえる（`/\r\n?/g`を`'\n'`へ。`CRLF`・`CR`のJSでも取り出せる）→ 行頭の`SPRITE_DATA_DECLARATION_START`を探す（テキストの先頭、または`'\n' + START`の最初の出現）。無ければ`null` → その直後から、最初の`SPRITE_DATA_DECLARATION_END + '\n'`（`;`と改行）までをJSONのテキストとして返す。見つからなければ`null`。
    *   この手順が正しい理由（JSDocに書く）：`SpriteSerializer.stringify`（`JSON.stringify`）の出力は、文字列の値の中に改行を生のまま含まず（`\n`等へエスケープされる）、`;`は文字列の値の中にしか現れないため、宣言の開始の後の最初の「`;`＋改行」が宣言の終わりである。先頭の説明コメント（`HEADER_COMMENT`）には`const spriteData = `で始まる行を置かないこと。
    *   JSを実行しない（`import`・`eval`・`Function`を使わない）。`JSON.parse`は呼び出し側（`FileContentReader`）が行う。本アプリが書き出した形から外れたJS（手で整形し直したもの等）は取り出せず読み込み不可になる（許容。5章）。
*   **識別子・版の判別（決定：`SpriteSerializer`に置く）**：`SpriteSerializer`に`static checkFormat(value)`を足す。戻り値は`'supported'`・`'notSprite'`・`'unsupportedVersion'`のいずれか。例外を投げず、警告も出さない。
    *   `'notSprite'`：`value`がプレーンなオブジェクト（`null`・配列以外の`object`）でない、または`format`が`SPRITE_FORMAT`と一致しない。
    *   `'unsupportedVersion'`：`format`は一致するが、`formatVersion`が整数でない／1未満／`SPRITE_FORMAT_VERSION`より大きい（キーが無い・文字列の`"1"`も含む）。
    *   `'supported'`：上記以外。`bounds`・`elements`・`source`の形は見ない（必要な側が見る）。
    *   識別子・現行版は既存の非公開定数をそのまま使い、新たにexportしない（確認用ページ・`FileContentReader`は`checkFormat`だけを使う）。
*   **読み込みの入口の差し替え（決定）**：`CanvasFileOperations`の`#runReadOperation`内の`DocumentSerializer.deserializeFromString(text)`を`FileContentReader.deserializeFromText(text)`へ置き換える。判定の表（`#classifyRead`）・通知の種類・受理条件・手順・戻り値は変えない（`deserializeFromText`が同じ形の結果を返すため）。`DocumentSerializer`のimportは`serialize`・`serializeToString`のため残す。
*   **キャンバス名（決定）**：`DocumentFileIO`の`FILE_EXTENSION_PATTERN`を`/(?:\.ozve)?\.json$|\.js$/i`へ改める（末尾の`.ozve.json`・`.json`・`.js`のいずれかを1回だけ除く。大文字小文字を区別しない）。`ship.js` → `ship`、`ship.json` → `ship`（既存）、`a.js.ozve.json` → `a.js`、`a.json.js` → `a.json`。作業データファイルの往復（`toFileName` → `toCanvasName`）はキャンバス名がどのような文字列で終わっても変わらない（`.ozve.json`が末尾にあるため`.js`の分岐は当たらない）。`toCanvasName`のJSDocと、ファイルの種類ごとの知識の説明を更新する。

### 要件3: 組み立て用のJSが動くことの自動テスト
*   新設`test/io/CodeExporter.assembly.test.js`（`CodeExporter`の書き出しの形の観点のテスト）。
*   手順：①`node:os`の`tmpdir()`の中に`node:fs`の`mkdtempSync`で一時フォルダを作る ②2つの図形一式（例：`body`＝矩形と直線、`head`＝円。色・太さを変えて区別できるようにする）から`CodeExporter.toModuleText(SpriteSerializer.serialize(図形))`で`body.js`・`head.js`を書く ③開発資料2章の例と同じ形の`_hero.js`（`import body from './body.js';`・`import head from './head.js';`・`export default { draw(ctx) { body.draw(ctx); ctx.save(); ctx.translate(0, -40); head.draw(ctx); ctx.restore(); } };`）をテストファイル内の固定のテキストとして書く ④`node:url`の`pathToFileURL(node:pathのjoin(一時フォルダ, '_hero.js')).href`で`import`し、描画命令を記録する偽の`ctx`（`translate`も記録する）で`draw(ctx)`を呼ぶ ⑤同じフォルダの`body.js`・`head.js`も同じ方法で`import`し、単体で`draw`した記録を取る。
*   確かめること：`_hero`の記録が「`body`単体の記録 → `['save']` → `['translate', 0, -40]` → `head`単体の記録 → `['restore']`」と`deepStrictEqual`／`body`単体の記録が`body`の図形のエディタの`draw`の記録（`CodeExporter.test.js`と同じ前置き・後置きを付けた期待値）と一致し、`head`も同様（互いのデータで描かれない）／`body`と`head`の記録が異なる／`body`・`head`の既定のexportの`elements`がそれぞれの`SpriteSerializer.serialize`の`elements`と一致（名前が衝突しない）。
*   後始末：一時フォルダはテストの終了時に`t.after`（または`after`）で`rmSync(フォルダ, { recursive: true, force: true })`で必ず削除する。`test/`の中にテスト以外の`.js`を作らない。
*   `node:fs`・`node:os`・`node:path`・`node:url`はこのテストファイルに限り使う（`16_test.md`の例外として開発資料に追記する）。

### 要件4: 自動テスト
*   `test/io/SpriteSerializer.test.js`（追記）：`checkFormat`。`serialize`の戻り値とそのJSONの`JSON.parse`が`'supported'`（図形0個も）／`null`・配列・文字列・数値・作業データ（`DocumentSerializer.serialize`の戻り値）・他の`format`が`'notSprite'`／`formatVersion`が0・現行版+1（`SpriteSerializer.serialize([]).formatVersion + 1`で求める）・1.5・文字列`'1'`・キーが無い、が`'unsupportedVersion'`／例外を投げない。
*   `test/io/CodeExporter.test.js`（追記）：`extractSpriteDataText`。`toModuleText`の出力から取り出して`JSON.parse`すると`JSON.parse(SpriteSerializer.stringify(data))`と同じ（5種の図形・図形0個）／`CRLF`へ変えた出力（`text.replace(/\n/g, '\r\n')`）からも同じ／`strokeColor`に`;`・`};`・改行・`const spriteData = `・U+2028等を含めても同じ値が戻る／任意のテキスト・空文字列・宣言はあるが終わりが無いテキスト・文字列以外（`undefined`・数値）で`null`／例外を投げない。既存の`toModuleText`のテストがすべて通る（出力が変わっていない）。
*   `test/io/FileContentReader.test.js`（新設）：
    *   書き出したJSON（`SpriteSerializer.stringify`）・JS（`CodeExporter.toModuleText`の出力そのもの）・`CRLF`に変えたJSから、`ok: true`・元の図形と同じ`toJSON()`の並び・`skipped`が空（5種の図形・図形0個）。
    *   作業データファイル（`DocumentSerializer.serializeToString`）は従来どおり読める（`DocumentSerializer.deserializeFromString`と同じ結果の`toJSON()`）。
    *   `source`に読めない図形が1つあるスプライト（JSON・JS）は、作業データファイルと同じく`ok: true`・`skipped`1件。
    *   読み込み不可（`ok: false`・`shapes`/`skipped`が空・例外を投げない・`console.warn`がちょうど1回）：本アプリのものではないJS（任意のテキスト、`export default {};`等）、他の`format`のJSON、壊れたJSON、`source`が無いスプライト（JSON・JS）、書き出し形式の版が0・現行版+1・1.5のスプライト（JSON・JS）、JSの宣言の中身がJSONでないもの（例`const spriteData = (() => { throw new Error('x'); })();`＋改行。実行されないこと）、JSに埋め込まれたのが作業データ（スプライトでない）、`source`の版が範囲外（`DocumentSerializer`の全体失敗）。
*   `test/edit/CanvasFileOperations.test.js`（追記）：既存の偽物の注入の形のまま、
    *   開く：スプライトのJSON・JS（`CRLF`も）を選ぶと、同じ図形の作業データファイルを開いたときと同じ図形（`toJSON()`）・同じ通知（全部・一部→`partialRead`・図形0個→空のキャンバスで通知なし）になり、`createCanvasFromShapes`の名前は`fileIO.toCanvasName(ファイル名)`。
    *   インポート：スプライトのJSON・JSを選ぶと、作業データファイルと同じ`prepareInsert`→`insertDocument`・同じ作業データの`shapes`・同じ通知（図形0個→`noShapes`）。
    *   本アプリのものでないJS（開く・インポート）で`false`・何も呼ばない・`readFailed`。
*   `test/io/DocumentFileIO.test.js`（追記）：`toCanvasName`の`ship.js` → `ship`、`ship.JS` → `ship`、`a.json.js` → `a.json`、`a.js.ozve.json` → `a.js`。往復のケース表へ`a.js`を加える（既存の往復のケースは変えずに通ること）。
*   `test/io/CodeExporter.assembly.test.js`（新設）：要件3。
*   `test/check/SpriteCheckInspector.test.js`（新設）：判定（JSONの値・JSの既定のexportの偽物（`{ ...スプライトデータ, draw() {} }`。`draw`が無い・関数でない・`null`・関数そのもの等））、JSONかの見分け（JSONのテキスト→`json`と値、JSのテキスト・壊れたJSON→`module`）、要約（版・`source.version`の有無・要素数・外枠と幅・高さ・`bounds: null`・形が不正な外枠）。ブラウザでの`import`・Canvasの描画はテストしない。

### 要件5: 開発資料への記載先（決定）
*   確認用ページの役割・開き方・JSを実行すること・判定の条件・`io/`から使うもの・やらないこと：**新しい分冊`_doc/arch/17_sprite_check.md`**（`sprite-check.html`と`js/check/`の3モジュール）を作り、4章の一覧に1行足す。モジュールをまたぐ流れ（選択→判定→`import`→描画の順、重ね順、JSONは`CodeExporter.toModuleText`で描くこと）は**3章に「10. 確認用ページ」**として足す。1章（フォルダ構造・「存在しないもの」・フォルダ分割の方針・依存方向）にも追記する。
*   エディタでスプライトを開くときの規則：**2章「スプライト（書き出し形式）」**に「エディタで開くときの規則」を足し、「識別子」の項の「現行の「開く」「インポート」で選ぶと…`readFailed`になる」を改める。「ファイル名の規則」に`.js`を除くことを足す。3章9.の読み込みの流れ（`FileContentReader.deserializeFromText`）を改める。
*   モジュール：`_doc/arch/15_io.md`（`FileContentReader`新設、`SpriteSerializer.checkFormat`、`CodeExporter.extractSpriteDataText`、`DocumentFileIO.toCanvasName`、呼び出し元）、`14_edit.md`（`CanvasFileOperations`のimport）、`01_index_html.md`（`accept`）、`16_test.md`（テスト・例外・テストできない箇所）。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/io/`（判別・取り出し・入口の新設、キャンバス名）、`./js/edit/`（読み込みの入口の差し替え）、`./js/palette/`（`readFailed`の文言のみ）、`./index.html`（`accept`・`title`のみ）、`./js/check/`（新設。確認用ページ）、`./sprite-check.html`（新設）、`./test/io/`・`./test/edit/`・`./test/check/`（テスト）。最終タスクのみ`./PROJECT_ARCHITECTURE.md`・`./_doc/arch/`。
*   **新設する論理クラス**: `FileContentReader`（`js/io/FileContentReader.js`）、`SpriteCheckInspector`（`js/check/SpriteCheckInspector.js`）、`SpriteCheckCanvas`（`js/check/SpriteCheckCanvas.js`）、`SpriteCheckPage`（`js/check/SpriteCheckPage.js`）。
*   **変更する論理クラス**: `SpriteSerializer`（`checkFormat`の追加と責務定義）、`CodeExporter`（`extractSpriteDataText`の追加、宣言の行を定数で組み立てる、責務定義）、`DocumentFileIO`（`toCanvasName`の拡張子）、`CanvasFileOperations`（読み込みの入口・JSDoc・責務定義）、`CanvasPalette`（`readFailed`の文言のみ）。
*   **変更しない**: `js/main.js`、`js/core/`全体、`js/shapes/`全体、`DocumentSerializer`、`CanvasStorage`、`CanvasLibrary`、`ShapeInserter`、`ClipboardController`、`SnapshotAdapter`、`PaletteController`、`DevPanel`、`PaletteLauncher`、既存のテストのうち`DocumentSerializer.*.test.js`・`CanvasFileOperations.export.test.js`。

### 参照する責務
*   **憲法3章**：各`.js`の最先頭行に単一責務のJSDoc（3行以内）。責務を逸脱するメソッドを足さない（足す場合は責務定義の変更として本RESに明記したものに限る）。クラス・関数・メソッド・定数・データ構造にJSDoc（`@param`・`@returns`）。グローバル変数（`window`への代入）・外部ライブラリ・ビルドツールの禁止。HTMLをブラウザで直接開いて動くこと。状態（モデル）と描画の分離。
*   **依存方向**（1章）：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`io/`は作業データ形式の変換・保存先とファイルへの読み書き・スプライトの組み立て（本作業でファイルの中身の判別と取り出しを加える）。`palette/`はDOM操作専任で、図形データ・作業データ・スプライトデータの中身を知らない。新設の`check/`は本RES 2章「全体構成と依存の向き」に従う。
*   **作業データ形式**（2章）：`{ format: "oz-vector-editor", version, shapes: [...] }`。`DocumentSerializer`（静的メソッドのみ）：`serialize`・`deserialize`・`serializeToString`・`deserializeFromString`。デシリアライズ系は例外を投げず`{ ok, shapes, skipped, error }`（typedef`DeserializeResult`）を返す。全体失敗（`format`違い・版が範囲外・`shapes`が配列でない等）では`console.warn`を1回出し`ok: false`。図形単位の失敗はスキップして`console.warn`。旧版の移行の知識は`DocumentSerializer`の`MIGRATIONS`に閉じる。引数を書き換えない。**`DocumentSerializer`にスプライト形式の知識を持ち込まない。**
*   **スプライト（書き出し形式）**（2章）：`<名前>.js`（ESモジュール）と`<名前>.json`。スプライトデータ`{ format: "oz-vector-editor-sprite", formatVersion: 1, bounds: {minX, minY, maxX, maxY} | null, elements: [...], source: 作業データ }`。読む側はキーの順に依存しない・未知のキーは無視。`source`は`DocumentSerializer.serialize`の戻り値そのもので`deserialize`で元の図形に戻せる。`bounds`は図形0個で`null`、読む側は再計算しない。識別子・現行版`SPRITE_FORMAT_VERSION`・`DEFAULT_STROKE_WIDTH`の唯一の定義箇所は`SpriteSerializer.js`（識別子・版は非公開定数）。JSONは`JSON.stringify(data, null, 2)`。
    *   **JSの形**（`CodeExporter.toModuleText`）：固定の説明コメント → `const spriteData = <JSON>;` → `const DEFAULT_STROKE_WIDTH = 2;` → `function draw(ctx)`・`function drawElement(ctx, element)` → `export default { ...spriteData, draw };`。`import`文を含まず、既定のexportのみ。`draw`は`this`を使わない。`draw`は`ctx.save()`→`try { 設定の明示 → 各要素を描く } finally { ctx.restore() }`。利用者の入力はJSONの文字列としてのみ埋め込まれ、コードとして解釈されない。
    *   **組み立て用のJSの例**：`_hero.js`が`import body from './body.js'`・`import head from './head.js'`し、`draw(ctx)`で`body.draw(ctx)` → `ctx.save()` → `ctx.translate(0, -40)` → `head.draw(ctx)` → `ctx.restore()`。
*   **`SpriteSerializer.js`**（4章`15_io.md`）：静的メソッドのみ。公開`serialize(shapes)`・`stringify(spriteData)`・named export`DEFAULT_STROKE_WIDTH`。importは`DocumentSerializer`のみ。DOM・キャンバス名・図形種別の分岐を知らない。
*   **`CodeExporter.js`**（4章`15_io.md`）：静的メソッドのみ。公開`toModuleText(spriteData)`（末尾は改行）。importは`SpriteSerializer`のみ。DOM・図形・キャンバス名を知らない。描画処理のテキスト`DRAW_SOURCE`の中で`import`・テンプレート文字列・外部の名前を使わない。
*   **`DocumentFileIO.js`**（4章`15_io.md`・2章「ファイル名の規則」）：ファイルの種類ごとの拡張子・MIMEタイプ・使えない文字・スプライトの先頭の`_`・既定の名前`無題`の唯一の定義箇所。中身を解釈しない。importを持たず状態を持たない。`toCanvasName`は末尾の拡張子を**1回だけ**除き、作業データファイルの往復でキャンバス名が変わらない（`a.json` → `a.json.ozve.json` → `a.json`）。呼び出し元は`CanvasFileOperations`のみ（注入）。
*   **`CanvasFileOperations.js`**（3章9.・4章`14_edit.md`・クラスJSDoc）：ファイル操作の組み立てと通知の状態。DOMに触れない。importは`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`のみ（本作業で`FileContentReader`を加える）。開く：読み取り→デシリアライズ→判定→読めた場合のみ`canvasLibrary.createCanvasFromShapes(fileIO.toCanvasName(ファイル名), 図形)`。インポート：読み取り→デシリアライズ→判定→同一性の確認→`prepareInsert()`→`inserter.insertDocument(DocumentSerializer.serialize(読めた図形), 0, 0)`。判定の表（読み込み不可・空・一部・全部と通知`readFailed`・`partialRead`・`noShapes`）は`#classifyRead`とクラスJSDocが正本。`openFile`・`importFile`はrejectしない。読み取り失敗・予期しない例外は`console.warn`＋`readFailed`。
*   **`CanvasPalette.js`**（4章`13_palette.md`）：DOM操作専任。importを持たない。文言の対応表`ISSUE_MESSAGES`・`FILE_NOTICE_MESSAGES`はこのファイルが唯一の定義箇所。`File`は不透明に渡す。
*   **`index.html`**（4章`01_index_html.md`）：スタイルは`<style>`に内包。キャンバスパレットのファイル選択は「開く」用`#canvas-open-file-input`・「インポート」用`#canvas-import-file-input`の非表示の`input type="file"`を2つ置く（1つにまとめない）。`accept`は拡張子の末尾で照合する。ボタンの`title`にファイルの拡張子を書く。
*   **`test/`**（4章`16_test.md`）：`node:test`・`node:assert/strict`のみ（要件3の1ファイルのみ`node:fs`・`node:os`・`node:path`・`node:url`を例外とする）。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`test/`以下の`.js`はすべてテストとして実行されるため共有の補助モジュールを置かず、補助関数は各テストファイル内に書く（JSDoc付き）。先頭行に単一責務のJSDoc。公開API（`export`されたクラス・定数・publicメソッド）のみを通す。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える。図形の`id`は公開プロパティ`id`へ文字列を直接代入する。動的`import`は`data:text/javascript,`＋`encodeURIComponent(テキスト)`が既存の例。確認したNode.jsはv24.20.0（計画時の`node --test`：tests 219・pass 219・fail 0）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造：ルートに`sprite-check.html`（`# 確認用ページ。index.htmlとは別に開く。スタイルは<style>に内包`）を`index.html`の下に追加。`js/`に`check/`（`SpriteCheckPage.js`・`SpriteCheckCanvas.js`・`SpriteCheckInspector.js`）を追加。`io/`に`FileContentReader.js`を追加。`test/`に`io/FileContentReader.test.js`・`io/CodeExporter.assembly.test.js`・`check/SpriteCheckInspector.test.js`を追加。
    *   「存在しないもの」：「JS形式の入力（書き出し済みJSの再読み込み。`CodeImporter`は作らない…）」と「スプライト（JS・JSON）の読み込み（…Phase 04-03で予定）」を、実態に合わせて「エディタでのJSの実行（スプライトのJSはテキストから取り出すだけ）、本アプリが書き出した形以外のJSの読み込み・スプライトの`elements`からの図形の作り直し（`CodeImporter`は作らない。`_doc/PROJECT_MILESTONE.md`の将来の野望）」へ整理する。「確認用ページでの拡大縮小・移動・編集・複数ファイルの同時表示・組み立て用のJSの表示、エディタから確認用ページへのリンク」を加える。
    *   「フォルダ分割の方針」：`io/`に「開く・インポートで選ばれたファイルの中身の判別と作業データの取り出し（`FileContentReader`）」を加える。`check/`を新設：「確認用ページ（`sprite-check.html`）専用。DOM・選んだJSの実行・描画を含む。importは`check/`内と`io/`の`SpriteSerializer`・`CodeExporter`のみ。`main.js`・`edit/`・`palette/`・`core/`の状態を持つモジュールをimportせず、`js/`の他のモジュール・`index.html`は`check/`をimportしない」。
    *   「依存方向」：`check/ → io`（確認用ページ専用。エディタ本体の依存の列とは独立）を追記。
*   **`PROJECT_ARCHITECTURE.md` 2章**：
    *   「スプライト（書き出し形式）」に「**エディタで開くときの規則**」を足す：中身で判定する（拡張子に頼らない。JSONとして解析できればJSON、できなければ本アプリのJSの形からスプライトデータのJSONを取り出す）／`format`が`"oz-vector-editor-sprite"`なら`source`だけを使い、作業データファイルと同じ`DocumentSerializer.deserialize`へ渡す（旧版の変換・スキップ・判定の表も同じ。`elements`・`bounds`は使わない）／JSは実行せず、`CodeExporter.extractSpriteDataText`でテキストから取り出す（取り出しの知識は組み立てと同じ`CodeExporter`。`CRLF`も可）／受け付ける書き出し形式の版は1以上・現行版以下の整数／読み込み不可：`format`が違うJSに埋め込まれたデータ・`source`が無い・版が範囲外・取り出しや解析の失敗（通知`readFailed`）／入口は`io/FileContentReader`。
    *   「識別子」の項の「スプライトのJSONを現行の「開く」「インポート」で選ぶと`format`不一致で…`readFailed`になる」を、「本アプリが書き出したものかを見分ける手がかり（エディタの「開く」「インポート」・確認用ページ）。判別は`SpriteSerializer.checkFormat`」へ改める。
    *   「ファイル名の規則」：開くときは末尾の`.ozve.json`・`.json`・`.js`のいずれかを1回だけ除く（`ship.js` → `ship`）。作業データファイルの往復の性質は変わらない。
*   **`PROJECT_ARCHITECTURE.md` 3章**：
    *   9.の見出しのモジュールの列に`FileContentReader.js`を加える。「開く（ファイル）」「インポート」の`deserializeFromString`を`FileContentReader.deserializeFromText`へ。「旧版のファイル」を「読み込みは必ず`FileContentReader.deserializeFromText`を通し、作業データ（スプライトの`source`を含む）は`DocumentSerializer.deserialize`で読む。`DocumentFileIO`・`CanvasFileOperations`・`CanvasLibrary`・`CanvasPalette`は版の知識もスプライト形式の知識も持たない」へ。
    *   「10. 確認用ページ（`sprite-check.html`）」を新設：流れ（ファイル選択 → `File.text()` → JSONか判定 → JSON：`SpriteCheckInspector`の判定 → `CodeExporter.toModuleText` ／ JS：テキストのまま → Blob URLの動的`import`（`finally`で解放）→ 既定のexportの判定 → 要約 → 描画（背景 → 外枠 → 原点の印 → `draw`）と情報欄）、選び直しの競合の扱い、失敗時の表示の消去と理由の区分、ウィンドウの大きさの変化で描き直すこと、エディタ本体とは状態を共有しないこと。
*   **`PROJECT_ARCHITECTURE.md` 4章**：一覧に`sprite-check.html`・`check/`（確認用ページ）→ `_doc/arch/17_sprite_check.md`を追加。
*   **`_doc/arch/17_sprite_check.md`（新設）**：`sprite-check.html`（役割・開き方（`index.html`と同じ。リンクは置かない）・選んだJSを実行すること（注意書き・無限ループで固まること・選んだJSはページのDOMにも触れ得ること）・要素のid）、`SpriteCheckPage.js`（責務・公開なし（起動のみ）・知らないこと・文言の対応表の唯一の定義箇所・`File`/`Blob`/`URL`を直接使うこと）、`SpriteCheckCanvas.js`（公開メソッド・状態（描画領域の大きさのみ）・重ね順と色・線種）、`SpriteCheckInspector.js`（公開メソッド・判定の条件・`SpriteSerializer.checkFormat`を使い定数を重複させないこと・DOMに依存しないこと・テスト）、`io/`から使うもの（`SpriteSerializer.checkFormat`・`CodeExporter.toModuleText`）、やらないこと。
*   **`_doc/arch/15_io.md`**：`io/`の冒頭の文に「開く・インポートで選ばれたファイルの中身の判別」を加える。`FileContentReader.js`の項を新設（公開`deserializeFromText`・呼び出し元`CanvasFileOperations`・知らないこと（DOM・図形種別・版の移行・スプライトの識別子の値とJSの形（それぞれ`SpriteSerializer`・`CodeExporter`に任せる））・JSを実行しないこと・契約（例外を投げない・結果の形・全体失敗の警告1回）・テスト）。`SpriteSerializer.js`：公開へ`checkFormat`、呼び出し元へ`FileContentReader`・`check/SpriteCheckInspector`。`CodeExporter.js`：公開へ`extractSpriteDataText`（取り出しの手順と正しい理由・`HEADER_COMMENT`の注意・組み立てと同じ定数）、呼び出し元へ`FileContentReader`（取り出し）・`check/SpriteCheckPage`（`toModuleText`）。`DocumentSerializer.js`の呼び出し元へ`io/`の`SpriteSerializer`・`FileContentReader`（既存の記載漏れの補いを含む）。`DocumentFileIO.js`：`toCanvasName`が`.js`も除くこと。
*   **`_doc/arch/14_edit.md`**：`edit/`の「依存」の`CanvasFileOperations`の例外に`FileContentReader`を加える。`CanvasFileOperations.js`の「依存」のimportに`FileContentReader`を加え、読み込みは`FileContentReader.deserializeFromText`を通すこと（スプライト形式を知らない）を書く。
*   **`_doc/arch/01_index_html.md`**：「キャンバスパレットのファイル選択」の`accept=".json,application/json"`…（変更しない）を、`accept=".json,.js,application/json,text/javascript"`（`.ozve.json`は末尾一致で選べる。スプライトのJS・JSONも選べる）へ改める。
*   **`_doc/arch/16_test.md`**：冒頭の「`node:test`・`node:assert/strict`のみ」と「書き方の決まり」に、要件3の`test/io/CodeExporter.assembly.test.js`に限り`node:fs`・`node:os`・`node:path`・`node:url`を使ってよい例外（一時フォルダはOSの一時フォルダの中に作り、テストの終了時に必ず削除する。`test/`の中にテスト以外の`.js`を作らない）を追記。既存のテストファイルと検証範囲へ`FileContentReader.test.js`・`CodeExporter.assembly.test.js`・`check/SpriteCheckInspector.test.js`を追加し、`SpriteSerializer.test.js`（`checkFormat`）・`CodeExporter.test.js`（`extractSpriteDataText`）・`DocumentFileIO.test.js`（`.js`）・`CanvasFileOperations.test.js`（スプライトのJS・JSON）の検証範囲を更新。「テストできない箇所」に確認用ページの`SpriteCheckPage`・`SpriteCheckCanvas`（DOM・Blob URLの動的`import`・Canvas。テストプレイで確かめる）を追加。
*   (各タスクの実行時に影響が判明した場合も、この欄へ追記する。資料本体への反映は最終タスクで行う)

## 3. タスクリスト
*   [x] タスク1: 識別子・版の判別`SpriteSerializer.checkFormat`の追加とテスト
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` :（更新）
        *   `./test/io/SpriteSerializer.test.js` :（更新）
    *   **作業内容** :
        *   `SpriteSerializer`に`static checkFormat(value)`を追加する（2章要件2「識別子・版の判別」の条件どおり。戻り値`'supported'|'notSprite'|'unsupportedVersion'`。例外を投げず警告も出さない。プレーンなオブジェクトの判定は`typeof value === 'object' && value !== null && !Array.isArray(value)`）。既存の非公開定数`SPRITE_FORMAT`・`SPRITE_FORMAT_VERSION`を使い、新たにexportしない。`serialize`・`stringify`・外枠の計算は変えない。
        *   JSDoc：メソッドに条件・戻り値・呼び出し元（`FileContentReader`・確認用ページの`SpriteCheckInspector`）・`bounds`/`elements`/`source`の形は見ないことを書く。戻り値の型をtypedef（例`SpriteFormatCheck`）で定義する。先頭の責務JSDocを「スプライトデータ形式（書き出し形式）の定義と判別（識別子・版）と、図形一式からの…組み立て・JSON文字列化を担う。」の趣旨へ改める（3行以内）。クラスJSDocの「組み立て・JSON文字列化を行う」にも判別を加える。
        *   テスト：2章要件4の`SpriteSerializer.test.js`の項目を新しい`describe`として追記する（既存のテストは変えない）。
        *   完了時にプロジェクトのルートで`node --test`を実行し、全テストの成功と件数（`tests`・`pass`・`fail`）を4章へ記録する（既存の219件が通ること）。失敗した場合、テストの誤りなら直し、本タスクの実装の誤りなら直す（それ以外の既存コードの不具合と考えられる場合は直さずに5章へ記録して報告する）。開発資料への影響が判明したら2章の更新予定欄へ追記し、判断に迷った点・目視確認を推奨する箇所・将来の修正時の注意点は5章へ記述する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク2: JSのテキストからの取り出し`CodeExporter.extractSpriteDataText`の追加とテスト
    *   **対象ファイル** :
        *   `./js/io/CodeExporter.js` :（更新）
        *   `./test/io/CodeExporter.test.js` :（更新）
    *   **作業内容** :
        *   非公開定数`SPRITE_DATA_DECLARATION_START = 'const spriteData = '`・`SPRITE_DATA_DECLARATION_END = ';'`を追加し（各JSDocに「組み立て（`toModuleText`）と取り出し（`extractSpriteDataText`）の両方が使う」ことを書く）、`toModuleText`の宣言の行を`SPRITE_DATA_DECLARATION_START + SpriteSerializer.stringify(spriteData) + SPRITE_DATA_DECLARATION_END`で組み立てる（出力のテキストは1文字も変えない。既存のテストがすべて通ること）。
        *   `static extractSpriteDataText(moduleText)`を追加する（2章要件2「JSの形からの取り出し」の手順どおり。戻り値`string|null`。例外を投げない。`import`・`eval`・`Function`を使わない。`JSON.parse`しない）。JSDocに手順・この手順が正しい理由・`CRLF`/`CR`を扱うこと・本アプリが書き出した形以外は`null`になり得ること・呼び出し元（`FileContentReader`）を書く。`HEADER_COMMENT`のJSDocに「`const spriteData = `で始まる行を置かない（取り出しの目印のため）」を追記する。
        *   先頭の責務JSDocを「スプライトJS（ESモジュール）のテキストの形を担う：組み立て（スプライトデータと共通の描画処理の埋め込み）と、実行せずにテキストから埋め込んだスプライトデータ（JSONのテキスト）を取り出すこと。DOMに依存しない。」の趣旨へ改める（3行以内）。クラスJSDocも同様に改める。
        *   テスト：2章要件4の`CodeExporter.test.js`の項目を新しい`describe`として追記する（既存のテストは変えない）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク3: 読み込みの入口`FileContentReader`の新設とテスト
    *   **対象ファイル** :
        *   `./js/io/FileContentReader.js` :（新規）
        *   `./test/io/FileContentReader.test.js` :（新規）
    *   **作業内容** :
        *   `FileContentReader.js`：先頭行に単一責務JSDoc（案：「責務: 開く・インポートで選ばれたファイルのテキストを中身で判別し（作業データ・スプライトのJSON・スプライトのJS）、作業データ（スプライトはsource）をDocumentSerializer.deserializeへ渡す読み込みの入口を担う。JSは実行しない。DOMに依存しない。」）。importは`./DocumentSerializer.js`・`./SpriteSerializer.js`・`./CodeExporter.js`のみ。`export class FileContentReader`に`static deserializeFromText(text)`（2章要件2「中身での判別と`source`の取り出し」の手順1〜4どおり）。戻り値の型は`import('./DocumentSerializer.js').DeserializeResult`を参照する。
        *   読み込み不可の結果を作る非公開の静的メソッド（例`#failure(reason)`。`console.warn('FileContentReader: ファイルを読み込めませんでした: ' + reason)`を1回出し`{ ok: false, shapes: [], skipped: [], error: reason }`を返す）を置く。`JSON.parse`の例外はこのクラスで捕捉する（`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`の呼び出しは例外を投げない契約のため、ほかに`try/catch`を足さない）。引数・取り出した値を書き換えない。
        *   クラス・メソッド・定数にJSDoc（判別の順序の表、`elements`・`bounds`を読まないこと、全体失敗の警告が1回であること、作業データファイルの結果が`DocumentSerializer.deserializeFromString`と同じ分類になること、JSを実行しないこと、呼び出し元は`CanvasFileOperations`）。
        *   `FileContentReader.test.js`：先頭行に単一責務JSDoc。2章要件4の`FileContentReader.test.js`の項目をすべて書く。図形は`ShapeFactory.create`または各図形クラスで作り`id`へ文字列を代入する。各テストで`console.warn`をモックで抑止し、読み込み不可のケースでは呼び出し回数が1であることを確かめる。
        *   この時点では`CanvasFileOperations`はまだ呼ばない（エディタの動作は変わらない）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク4: キャンバス名から`.js`も除く（`DocumentFileIO.toCanvasName`）とテスト
    *   **対象ファイル** :
        *   `./js/io/DocumentFileIO.js` :（更新）
        *   `./test/io/DocumentFileIO.test.js` :（更新）
    *   **作業内容** :
        *   `FILE_EXTENSION_PATTERN`を`/(?:\.ozve)?\.json$|\.js$/i`へ改め、JSDocを「末尾の拡張子（`.ozve.json`・`.json`・`.js`のいずれか。大文字小文字を区別しない）」へ改める。`toCanvasName`のJSDocに`.js`を除くこと・1回だけ除くこと・例（`ship.js` → `ship`、`a.json.js` → `a.json`、`a.js.ozve.json` → `a.js`）を足す。クラスJSDocの「ファイルの種類ごとの…規則」の説明に、開くときに除く拡張子を足す。他のメソッド・定数は変えない（`SPRITE_MODULE_EXTENSION`を正規表現の組み立てに流用する整理もしない）。
        *   テスト：2章要件4の`DocumentFileIO.test.js`の項目を追記する（既存のケースは変えない）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク5: エディタの読み込みの入口の差し替え（`CanvasFileOperations`）とテスト
    *   **対象ファイル** :
        *   `./js/edit/CanvasFileOperations.js` :（更新）
        *   `./test/edit/CanvasFileOperations.test.js` :（更新）
    *   **作業内容** :
        *   importに`../io/FileContentReader.js`を加える。`#runReadOperation`の`DocumentSerializer.deserializeFromString(text)`を`FileContentReader.deserializeFromText(text)`へ置き換える。それ以外の処理（受理条件・判定の表・通知・手順・戻り値・`exportCanvas`・`exportSprite`）は変えない。
        *   JSDoc：先頭の責務JSDocを「作業データファイルの出力と、作業データファイル・スプライトを開く・インポートする手順、スプライト（エンジン用）の出力の組み立て…」の趣旨へ改める（3行以内）。クラスJSDocの「■ 開く（ファイル）」「■ インポート」の`deserializeFromString`を`FileContentReader.deserializeFromText`へ、「■ 読み込みの判定の表」の見出し（「`FileContentReader.deserializeFromText`の結果`result`で判定」）と1行目の場面に「本アプリのスプライトでない・書き出し形式の版が範囲外・`source`が無い・JSから取り出せない」を加え、「JSONの解析は`deserializeFromString`に任せる」を「`FileContentReader`に任せる（スプライトの判別・`source`の取り出しも。本クラスはスプライト形式を知らない）」へ、「■ 依存の制約」のimportへ`FileContentReader`を加える。`#classifyRead`の`@param`の説明、`#runReadOperation`の説明も合わせる。
        *   テスト：2章要件4の`CanvasFileOperations.test.js`の項目を新しい`describe`として追記する（既存の偽物の注入の形・補助関数を使い、既存のテストは変えない）。期待値は同じ図形の作業データファイルを同じ手順で開いた・インポートした結果と比べる。スプライトのテキストは`SpriteSerializer.serialize`・`stringify`・`CodeExporter.toModuleText`で作る。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク6: ファイル選択と文言（`index.html`の`accept`・`title`、`CanvasPalette`の`readFailed`）
    *   **対象ファイル** :
        *   `./index.html` :（更新。`accept`・`title`のみ）
        *   `./js/palette/CanvasPalette.js` :（更新。`FILE_NOTICE_MESSAGES.readFailed`の文言のみ）
    *   **作業内容** :
        *   `index.html`：`#canvas-open-file-input`・`#canvas-import-file-input`の`accept`を`".json,.js,application/json,text/javascript"`へ。`#canvas-open-file`・`#canvas-import`の`title`を2章要件2の文言へ。それ以外（並び・CSS・他の要素）は変えない。
        *   `CanvasPalette.js`：`FILE_NOTICE_MESSAGES.readFailed`を2章要件2の文言へ。他の文言・処理・JSDocは変えない（先頭の責務JSDocは変えない）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する（両ファイルはテスト対象外だが全件成功を確かめる）。可能ならブラウザで`index.html`を開き、「開く」の小窓で`.js`が選べることを確認して記録する（できない場合は5章の目視確認項目に委ねる旨を記録する）。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [x] タスク7: 組み立て用のJSが動くことの自動テスト
    *   **対象ファイル** :
        *   `./test/io/CodeExporter.assembly.test.js` :（新規）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（案：「責務: 書き出したパーツのJSを、組み立て用のJS（_hero.js）がファイル名でimportして原点基準に配置して描けること（P7のキャラ合成の形）を、一時フォルダの実ファイルで検証する。」）。2章要件3の手順・確かめること・後始末どおりに書く。importは`node:test`・`node:assert/strict`・`node:fs`・`node:os`・`node:path`・`node:url`と、`../../js/io/CodeExporter.js`・`../../js/io/SpriteSerializer.js`・図形クラス（または`../../js/core/ShapeFactory.js`）のみ。
        *   `_hero.js`のテキストは開発資料2章の例と同じ形の固定の文字列（テンプレート文字列で値を差し込まない）。偽の`ctx`（`translate`を含めて記録する）とエディタの記録・期待値を作る補助関数はこのファイル内に置き、JSDocを書く（`CodeExporter.test.js`と同じ形でよい。共有モジュールにしない）。
        *   一時フォルダは`mkdtempSync(join(tmpdir(), 'ozve-assembly-'))`で作り、`t.after`等で`rmSync(..., { recursive: true, force: true })`により必ず削除する。`test/`の中・プロジェクトの中にファイルを作らない。`globalThis`へ代入しない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。一時フォルダでの`.js`のESモジュールとしての読み込みで問題が出た場合（一時フォルダの上位に`package.json`がある等）は、ソースを変えずに原因を5章へ記録して報告する。開発資料への影響（`16_test.md`の例外）は2章の更新予定欄に記載済み。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク8: 確認用ページの判定部分`SpriteCheckInspector`の新設とテスト
    *   **対象ファイル** :
        *   `./js/check/SpriteCheckInspector.js` :（新規。フォルダ`js/check/`も新設）
        *   `./test/check/SpriteCheckInspector.test.js` :（新規。フォルダ`test/check/`も新設）
    *   **作業内容** :
        *   先頭行に単一責務JSDoc（案：「責務: 確認用ページで、選んだファイルの中身が本アプリのスプライトかの判定（JSONの値・JSの既定のexport）と、情報欄に出す値の要約を担う。DOMに依存しない。」）。importは`../io/SpriteSerializer.js`のみ。静的メソッドのみのクラス`export class SpriteCheckInspector`：
            *   `static parseText(text)`：`JSON.parse`できれば`{ kind: 'json', value }`、できなければ`{ kind: 'module' }`（JSとして`import`する側）。例外を投げない。
            *   `static inspectSpriteData(value)`：`SpriteSerializer.checkFormat(value)`が`'supported'`なら`{ ok: true }`、`'notSprite'`なら`{ ok: false, reason: 'notSprite' }`、`'unsupportedVersion'`なら`{ ok: false, reason: 'unsupportedVersion' }`。
            *   `static inspectModuleExport(value)`：オブジェクト（`null`でない`typeof 'object'`）でなければ`notSprite` → `checkFormat`の結果で`notSprite`・`unsupportedVersion` → `typeof value.draw !== 'function'`なら`notSprite` → `{ ok: true }`。
            *   `static summarize(spriteData)`：`{ formatVersion, sourceVersion, elementCount, bounds }`。`sourceVersion`は`source`がプレーンなオブジェクトで`version`が`undefined`でなければその値、それ以外は`null`（無い）。`elementCount`は`elements`が配列ならその長さ、それ以外は`null`（不明）。`bounds`は`{ state: 'none' }`（`null`）・`{ state: 'ok', minX, minY, maxX, maxY, width, height }`（4つとも有限の数値。幅・高さは`maxX - minX`・`maxY - minY`）・`{ state: 'invalid' }`（それ以外）。値は丸めない。
            *   判定の理由・戻り値の形はtypedefで定義する。識別子・版の定数を書かない（`checkFormat`のみ使う）。
        *   クラス・メソッド・typedefにJSDoc（判定の条件、DOM・`import`・描画を扱わないこと、呼び出し元は`SpriteCheckPage`）。
        *   テスト：先頭行に単一責務JSDoc。2章要件4の`SpriteCheckInspector.test.js`の項目をすべて書く。スプライトデータは`SpriteSerializer.serialize`で作る（現行版+1は`formatVersion + 1`で求める）。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する（`test/check/`の新しいテストも実行されていることを確かめる）。失敗時の扱い・開発資料への影響・判断に迷った点の記録はタスク1と同じ。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク9: 確認用ページ（`sprite-check.html`・`SpriteCheckCanvas`・`SpriteCheckPage`）
    *   **対象ファイル** :
        *   `./sprite-check.html` :（新規）
        *   `./js/check/SpriteCheckCanvas.js` :（新規）
        *   `./js/check/SpriteCheckPage.js` :（新規）
    *   **作業内容** :
        *   `sprite-check.html`：2章要件1「画面の構成」のとおり（`<html lang="ja">`・`<meta charset="UTF-8">`・`<title>`「スプライトの確認 - OZ Vector Editor」・`<style>`に内包。`body`を縦のflex・高さ`100vh`・余白0、上部の操作・情報欄、`#check-canvas-area`は残りいっぱい（`flex: 1`・`min-height: 0`・`overflow: hidden`）、`#check-canvas`は`display: block`）。注意書きは目立つ色で常に表示する。スクリプトは`<script type="module" src="js/check/SpriteCheckPage.js"></script>`のみ。`index.html`へのリンクを置いてもよいが、`index.html`から確認用ページへのリンクは置かない。
        *   `SpriteCheckCanvas.js`：先頭行に単一責務JSDoc（案：「責務: 確認用ページの描画領域の大きさ（ウィンドウ・devicePixelRatio）の調整と、背景・外枠・原点の印・スプライトのdrawの呼び出しによる描画を担う。表示するスプライトは保持しない。」）。importなし。`export class SpriteCheckCanvas`：
            *   コンストラクタ（`canvas`要素と、その大きさを決める親要素を受け取る。2Dコンテキストを取得する）。
            *   `resize()`：親要素の`clientWidth`・`clientHeight`をCSSの大きさとし、`canvas`の`style`の幅・高さと内部の大きさ（×`devicePixelRatio`を丸めた値）を合わせる。
            *   `clear()`：背景のみ（印も外枠も描かない）。
            *   `render(sprite, bounds)`：2章要件1「描画の座標」「重ね順」どおり（背景 → `bounds`が`{minX, minY, maxX, maxY}`なら外枠の破線 → 原点の印 → `ctx.save()`→`try { sprite.draw(ctx) } finally { ctx.restore() }`）。`bounds`が`null`なら外枠を描かない。`sprite.draw`の例外は捕捉せず呼び出し元へ投げる。色・線種・印の大きさは非公開の定数に置く。
            *   保持する状態は描画領域の大きさ（CSSの幅・高さ・dpr）のみ。スプライト・外枠・ファイルの情報を保持しない（状態は`SpriteCheckPage`）。
        *   `SpriteCheckPage.js`：先頭行に単一責務JSDoc（案：「責務: 確認用ページ（sprite-check.html）の起動と、ファイルの選択から表示まで（読み取り→判定→Blob URLの動的import→描画→情報欄・結果の文言）の流れと、表示中のスプライトの保持を担う。」）。importは`./SpriteCheckInspector.js`・`./SpriteCheckCanvas.js`・`../io/CodeExporter.js`のみ。
            *   `document`の`DOMContentLoaded`で要素（`#check-file-input`・`#check-file-name`・`#check-format-version`・`#check-source-version`・`#check-element-count`・`#check-bounds`・`#check-message`・`#check-canvas-area`・`#check-canvas`）を解決し、1つでも欠けたら`console.warn`して配線しない。`window`へ代入しない（グローバル変数を作らない）。
            *   流れ（2章要件1）：`change` → ファイルが無ければ何もしない → `value`を空に戻す → 連番を進め、前の表示を消す（表示中のスプライトを`null`・`canvas.clear()`・情報欄を「—」・ファイル名を表示・「読み込み中…」）→ `file.text()`（失敗は`readFailed`）→ `SpriteCheckInspector.parseText` → JSON：`inspectSpriteData`（失敗はその理由）→ `CodeExporter.toModuleText(value)`／JS：テキストのまま → Blob URLの動的`import`（`finally`で`URL.revokeObjectURL`。失敗は`importFailed`）→ `inspectModuleExport(既定のexport)`（失敗はその理由）→ `summarize` → 表示中のスプライト（既定のexportと、`bounds.state === 'ok'`なら外枠の値）を保持して`canvas.render`（例外は`drawFailed`）→ 情報欄。各`await`の後で連番が最新でなければ何もせず終える。
            *   失敗時：表示中のスプライトを`null`、`canvas.clear()`、情報欄は「—」、結果の文言は「読み込めませんでした：」＋2章要件1の表の文言。例外は`console.warn`で詳細を出す。`change`のハンドラから例外・rejectを漏らさない。
            *   `window`の`resize`：`canvas.resize()`のうえ、表示中のスプライトがあれば`render`し直す（例外は`drawFailed`として失敗時の表示）。起動時にも`resize()`・`clear()`する。
            *   情報欄の表示：`sourceVersion`が`null`なら「なし」、`elementCount`が`null`なら「不明」、外枠は`state`ごとに「minX … / minY … / maxX … / maxY …（幅 … × 高さ …）」・「外枠なし（図形0個）」・「外枠の値を読めません」。値は`String()`のまま。すべて`textContent`で設定する（`innerHTML`を使わない。ファイル名・値をHTMLとして解釈しないため）。
            *   理由の区分→文言の対応表（`Object.freeze`）はこのファイルが唯一の定義箇所。
        *   3ファイルとも、クラス・メソッド・定数・typedefにJSDocを書く。`SpriteCheckPage`・`SpriteCheckCanvas`はDOMに依存するため自動テストしない。
        *   完了時に`node --test`を実行し、全テストの成功と件数を4章へ記録する。可能ならブラウザ（`file://`とローカルサーバーの両方が望ましい）で`sprite-check.html`を開き、書き出したJS・JSONの表示と失敗時の表示を確認して記録する（できない場合は5章の目視確認項目に委ねる旨を記録する）。Blob URLの動的`import`がブラウザ・開き方によって失敗する場合は、`data:text/javascript,`のURLへの切り替えを独断で行わず、5章へ記録して報告する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
*   [ ] タスク10: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   タスク1〜9で変更・新設したファイル :（確認・必要ならJSDoc・コメントのみ更新）
        *   `./_log/res/261109_0003_RES_Phase04-03_Sprite_Load_Check.md` :（更新）
    *   **作業内容** :
        *   新設の`.js`（`FileContentReader.js`・`SpriteCheckInspector.js`・`SpriteCheckCanvas.js`・`SpriteCheckPage.js`・テスト3ファイル）の先頭行に単一責務のJSDoc（3行以内）があること、変更したファイルの先頭の責務JSDocが実態と一致すること（`SpriteSerializer.js`・`CodeExporter.js`・`DocumentFileIO.js`・`CanvasFileOperations.js`）、追加したクラス・関数・メソッド・定数・typedef・テストの補助関数にJSDoc（`@param`・`@returns`）があることを確認する。
        *   次を確認する：`DocumentSerializer.js`に変更が無くスプライト形式の知識が無い／`io/`から`edit/`へのimportが無い／`core/`・`shapes/`・`main.js`に変更が無い／`io/`内のimportに循環が無い／`palette/`が作業データ・スプライトデータを参照していない／`FileContentReader`・`CodeExporter`・`SpriteSerializer`・`CanvasFileOperations`・`SpriteCheckInspector`がDOM・`window`・`document`に触れていない／エディタ側（`js/io/`・`js/edit/`）に`import(`・`eval`・`Function(`が無い（JSを実行しない）／`js/check/`が`core/`の状態を持つモジュール・`edit/`・`palette/`・`main.js`をimportしていない、`js/`の他のモジュール・`index.html`が`js/check/`をimportしていない／グローバル変数（`window`への代入）が無い／テストのためだけの`export`が無い／テストが`globalThis`・`window`へ代入していない／`test/`に補助用の`.js`が無い／`node:fs`等を使うテストが`CodeExporter.assembly.test.js`のみ／`package.json`等ができていない／識別子・現行版が`SpriteSerializer.js`、JSの宣言の形が`CodeExporter.js`、拡張子が`DocumentFileIO.js`にのみ定義されている／確認用ページに描画処理（`moveTo`・`ellipse`等のスプライトの描き方）が書き起こされていない。
        *   プロジェクトのルートで`node --test`を実行し、全テストの成功と件数を4章のタスク10の欄へ記録する。
        *   本RESの仕上げとして、4章のタスク10の欄を記入し（タスク1〜9の欄はそれぞれのタスクで記入済みのため書き換えない）、開発資料への影響を2章の更新予定欄へ（資料本体は修正しない）、判断に迷った点・目視確認を推奨する箇所・将来修正する際の注意点を「5. 懸念事項・要確認ポイント」欄へ追記する。
        *   完了時に本タスクを [x] にする。
*   [ ] タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/17_sprite_check.md` :（新規）
        *   `./_doc/arch/15_io.md` :（更新）
        *   `./_doc/arch/14_edit.md` :（更新）
        *   `./_doc/arch/01_index_html.md` :（更新）
        *   `./_doc/arch/16_test.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料の更新予定」に記録した内容（各タスクでの追記を含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従って反映する。スプライトの形・エディタで開くときの規則は2章の「スプライト（書き出し形式）」の1箇所にまとめ、他の箇所からはそこを参照する（同じ規則を複数箇所に書き分けない）。`17_sprite_check.md`は既存の分冊（`15_io.md`等）と同じ形式（箇条書き・**太字の見出し**・公開メソッド・知らないこと・契約）で書く。
        *   反映時に、実際のファイル名・公開メソッド名・定数の値・正規表現・要素のid・`node --test`の結果が記述と一致することをソース・テストで確認する。
        *   完了時に本タスクを [x] にし、4章の本タスクの欄へ詳細を記入する。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本最終タスクのみ明示的な例外とする（後続タスクが存在せず、他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 識別子・版の判別`SpriteSerializer.checkFormat`の追加とテスト
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`：`static checkFormat(value)`を追加（プレーンなオブジェクトでない／`format`不一致→`'notSprite'`、`formatVersion`が整数でない・1未満・現行版超・キー無し→`'unsupportedVersion'`、それ以外→`'supported'`）。既存の非公開定数を使い新規exportなし。typedef`SpriteFormatCheck`を追加。先頭の責務JSDoc・クラスJSDocへ「判別（識別子・版）」を追記。`serialize`・`stringify`・外枠計算は未変更。
    *   `test/io/SpriteSerializer.test.js`：`describe('SpriteSerializer.checkFormat')`を追記（4件。supported／notSprite／unsupportedVersion／形を見ない・例外なし）。既存テストは未変更。
    *   `node --test`：tests 223・pass 223・fail 0（既存219＋追加4）。
    *   監査指摘の修正：テストの補助関数`sampleShapes`にJSDocを追加（再実行でも tests 223・pass 223・fail 0）。

### タスク2: JSのテキストからの取り出し`CodeExporter.extractSpriteDataText`の追加とテスト
*   **作業内容** :
    *   `js/io/CodeExporter.js`：非公開定数`SPRITE_DATA_DECLARATION_START`・`SPRITE_DATA_DECLARATION_END`を追加し、`toModuleText`の宣言の行をこの2つで組み立てるよう変更（出力は不変）。`static extractSpriteDataText(moduleText)`を追加（文字列以外→`null`、`/\r\n?/g`を`\n`へ、行頭の開始を探し、直後から最初の`;`＋改行までを返す。実行・`JSON.parse`なし）。JSDocに手順・正しい理由・`CRLF`/`CR`・`null`になり得る場合・呼び出し元を記載。`HEADER_COMMENT`のJSDocへ注意を追記。先頭の責務JSDoc・クラスJSDocを更新。
    *   `test/io/CodeExporter.test.js`：補助関数`sampleShapesOfAllKinds`・`assertExtractsSameValue`（JSDoc付き）と`describe('CodeExporter.extractSpriteDataText')`（5件）を追記。既存テストは未変更。
    *   `node --test`：tests 228・pass 228・fail 0（タスク1後の223＋追加5）。

### タスク3: 読み込みの入口`FileContentReader`の新設とテスト
*   **作業内容** :
    *   `js/io/FileContentReader.js`（新規）：先頭に責務JSDoc。importは`DocumentSerializer`・`SpriteSerializer`・`CodeExporter`のみ。`export class FileContentReader`に`static deserializeFromText(text)`（JSON.parse→失敗なら`CodeExporter.extractSpriteDataText`→`JSON.parse`→`SpriteSerializer.checkFormat`で判別。notSpriteはJSONなら`DocumentSerializer.deserialize(data)`、JSなら読み込み不可。unsupportedVersion・source無しは読み込み不可。supportedは`deserialize(data.source)`）。非公開`#failure(reason)`が`console.warn`を1回出し`{ ok: false, shapes: [], skipped: [], error }`を返す。`try/catch`は`JSON.parse`のみ。JSDocに判別の表・規則を記載。
    *   `test/io/FileContentReader.test.js`（新規）：補助関数（`sampleShapesOfAllKinds`・`toJsonList`・`assertRestored`・`assertUnreadable`・`mutatedSprite`・`asJson`・`asModule`、JSDoc付き）と4つの`describe`（`it`12件。書き出したスプライト（5種・0個、JSON/JS/CRLF）、作業データ、source内の読めない図形（skipped1件）、読み込み不可（警告ちょうど1回）の各ケース）。
    *   `node --test`：tests 240・pass 240・fail 0（タスク2後の228＋追加12）。`CanvasFileOperations`は未変更。

### タスク4: キャンバス名から`.js`も除く（`DocumentFileIO.toCanvasName`）とテスト
*   **作業内容** :
    *   `js/io/DocumentFileIO.js`：`FILE_EXTENSION_PATTERN`を`/(?:\.ozve)?\.json$|\.js$/i`へ変更し、そのJSDoc・`toCanvasName`のJSDoc（`.js`を除く・1回だけ・例`ship.js`・`a.json.js`・`a.js.ozve.json`）・クラスJSDoc（開くときに除く拡張子も本クラスが定めること）を更新。他のメソッド・定数は未変更。
    *   `test/io/DocumentFileIO.test.js`：`toCanvasName`の`describe`に`it`を2件追加（`ship.js`・`ship.JS`→`ship`／`a.json.js`→`a.json`・`a.js.ozve.json`→`a.js`・`a.js.js`→`a.js`）。往復のケース表へ`a.js`を加え、`toFileName('a.js')`が`a.js.ozve.json`になる確認を1行追加（既存のケースは未変更）。補助関数の追加なし。
    *   `node --test`：tests 242・pass 242・fail 0（タスク3後の240＋追加2）。

### タスク5: エディタの読み込みの入口の差し替え（`CanvasFileOperations`）とテスト
*   **作業内容** :
    *   `js/edit/CanvasFileOperations.js`：importへ`../io/FileContentReader.js`を追加し、`#runReadOperation`の`DocumentSerializer.deserializeFromString(text)`を`FileContentReader.deserializeFromText(text)`へ置換（他の処理は未変更）。先頭の責務JSDoc・クラスJSDoc（開く・インポート・判定の表の見出しと1行目の場面・「JSONの解析は`FileContentReader`に任せる」・依存の制約）・`#classifyRead`の`@param`を更新。
    *   `test/edit/CanvasFileOperations.test.js`：import（`SpriteSerializer`・`CodeExporter`）と先頭の責務JSDocの追記、補助関数`makeSpriteDataWithSourceShapes`・`spriteFileCases`・`foreignJsCases`（JSDoc付き）、新しい`describe`2つ（開く（スプライトのJS・JSON）：11件、インポート（スプライトのJS・JSON）：11件。計22件）を追記。全部・一部・図形0個×（JSON・JS・CRLFのJS）を、同じ図形の作業データファイルを同じ手順で開いた・インポートした結果（図形の`toJSON()`・通知・呼び出しの記録）と比較。開くの名前は`fileIO.toCanvasName('ship.js')`。本アプリのものでないJS（任意のJS・`export default {};`）は開く・インポートとも`false`・何も呼ばない・`readFailed`。既存テストは未変更。
    *   `node --test`：tests 264・pass 264・fail 0（タスク4後の242＋追加22）。

### タスク6: ファイル選択と文言（`index.html`の`accept`・`title`、`CanvasPalette`の`readFailed`）
*   **作業内容** :
    *   `index.html`：`#canvas-open-file-input`・`#canvas-import-file-input`の`accept`を`".json,.js,application/json,text/javascript"`へ（2か所）。`#canvas-open-file`・`#canvas-import`の`title`を2章要件2の文言へ（2か所）。他は未変更。
    *   `js/palette/CanvasPalette.js`：`FILE_NOTICE_MESSAGES.readFailed`の文言のみを2章要件2の文言へ変更。他は未変更。
    *   `node --test`：tests 264・pass 264・fail 0（タスク5後と同数）。
    *   ブラウザでの確認（「開く」の小窓で`.js`が選べること）は行っていない。5章の目視確認項目に委ねる。

### タスク7: 組み立て用のJSが動くことの自動テスト
*   **作業内容** :
    *   `test/io/CodeExporter.assembly.test.js`（新規）：先頭に責務JSDoc。importは`node:test`・`node:assert/strict`・`node:fs`・`node:os`・`node:path`・`node:url`と`CodeExporter`・`SpriteSerializer`・`Line`・`Rect`・`Ellipse`のみ。固定の定数`HERO_SOURCE`（開発資料2章の例と同じ形の`_hero.js`）、補助関数（JSDoc付き。`createRecordingCtx`（`translate`も記録）・`recordEditorDraw`・`recordSpriteDraw`・`expectedExportLog`・`importFromDir`・`makeBodyShapes`・`makeHeadShapes`の7件）、`describe` 1件・`it` 1件。
    *   `it`の内容：`mkdtempSync(join(tmpdir(), 'ozve-assembly-'))`の一時フォルダへ`body.js`（矩形と直線）・`head.js`（円）・`_hero.js`を書き、`pathToFileURL`で動的importする。`_hero`の記録が「`body`単体 → `['save']` → `['translate', 0, -40]` → `head`単体 → `['restore']`」と一致、`body`・`head`単体の記録がエディタの`draw`の記録（前置き・後置き付き）と一致、`body`と`head`の記録・`elements`が異なり、それぞれ`SpriteSerializer.serialize`の`elements`と一致することを確かめる。一時フォルダは`t.after`で`rmSync(..., { recursive: true, force: true })`により削除。
    *   `node --test`：tests 265・pass 265・fail 0（タスク6後の264＋追加1）。一時フォルダでのESモジュールの読み込みに問題は出なかった。プロジェクトの中にファイルは作られていない（`git status`で新規はテストファイル1件のみ）。

### タスク8: 確認用ページの判定部分`SpriteCheckInspector`の新設とテスト
*   **作業内容** :
    *   (未記入)

### タスク9: 確認用ページ（`sprite-check.html`・`SpriteCheckCanvas`・`SpriteCheckPage`）
*   **作業内容** :
    *   (未記入)

### タスク10: JSDocの確認とRESの完成
*   **作業内容** :
    *   (未記入)

### タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   (未記入)

## 5. 懸念事項・要確認ポイント
### 計画時の判断と注意点
*   **新しいモジュール`FileContentReader`を置く理由**：判別と取り出しを`SpriteSerializer`に置くと、JSの形を知る`CodeExporter`を`SpriteSerializer`がimportすることになり`CodeExporter → SpriteSerializer`と循環する。`DocumentSerializer`にはスプライト形式を持ち込めない。`CanvasFileOperations`（`edit/`）に置くとDOMに依存しない`io/`の部分という要件に反し、`edit/`がスプライト形式を知ることになる。このため、判別の順序だけを持つ入口を`io/`に新設し、識別子・版は`SpriteSerializer.checkFormat`、JSの形は`CodeExporter.extractSpriteDataText`、作業データは`DocumentSerializer.deserialize`へ任せた。
*   **取り出しを`CodeExporter`に置くことによる責務定義の変更**：`CodeExporter`の責務は「JSのテキストの組み立て」から「JSのテキストの形（組み立てと、実行しない取り出し）」へ広がる（要件2の「JSの形を組み立てている側と1箇所にまとめ」に従う）。宣言の開始・終わりの定数を組み立てと取り出しで共有するため、片方だけ変えて食い違うことを防げる。`toModuleText`の宣言の行の形（`const spriteData = <JSON>;`の後に改行）を変える場合は、取り出しとテストも同時に直すこと。
*   **取り出しの限界**：本アプリが書き出した形（`const spriteData = `で始まる行と、`JSON.stringify`の出力の直後の`;`＋改行）に頼る。書き出したJSを手で整形し直した（Prettier等で`spriteData`のJSONを1行にした・キーの引用符を外した・`;`を省いた等）場合は取り出せないか`JSON.parse`に失敗し、読み込み不可（`readFailed`）になる。JSを実行しないという決定の範囲内で許容する。
*   **確認用ページのJSONかJSかの見分け**：拡張子ではなく中身（`JSON.parse`できるか）で行う。結果として、壊れたJSONファイルはJSとして`import`が試みられ（構文エラーで失敗する）、「JSONとして読めず、JSとしても読み込めませんでした」と表示される。拡張子で見分けない理由は、拡張子の規則（`DocumentFileIO`が唯一の定義箇所）を確認用ページへ持ち込まないためと、エディタ側の「中身で判定」と揃えるため。
*   **確認用ページでJSONを描く方法**：`CodeExporter.toModuleText`でJSのテキストに戻して`import`する。描画処理は書き出したJSと同じものになる（描画処理が2系統に分かれない）。ただし、JSONを選んだ場合に使われるのは「今のエディタの`CodeExporter`の描画処理」であり、JSを選んだ場合は「書き出した時点の描画処理」である。`CodeExporter`の描画処理を変えた後に古いJSを選ぶと、両者の表示が異なり得る（その差は確かめたい差でもある）。
*   **確認用ページが間接的に読み込むモジュール**：`SpriteSerializer`のimportを通じて`DocumentSerializer`・`core/ShapeFactory`・`shapes/`が読み込まれる。いずれも状態を持たないモジュールで、確認用ページはそれらを呼ばない。要件の「エディタの状態を持つモジュール（`VectorModel`等・`edit/`・`palette/`）を`import`しない」は守られる。
*   **選んだJSの実行**：確認用ページは選んだJSをページ内で実行する（発注者了承済み）。JSはページのDOM・`window`にも触れ得る。無限ループするJSを選ぶとページが固まり、止められない（タブを閉じる必要がある）。終わらない`await`を持つJSでは「読み込み中…」のままになるが、別のファイルを選べば新しい読み込みが優先される（古い結果は捨てる）。対策は作らない（要件6）。開発資料（`17_sprite_check.md`）にも記録する。
*   **読み込んだモジュールのメモリ**：ブラウザは`import`したモジュールをページを閉じるまで保持する（Blob URLを解放しても、モジュール自体は解放されない）。多数のファイルを選び続けるとメモリが増えるが、確認用の用途では許容する（再読み込みで戻る）。
*   **一時フォルダでのESモジュールの読み込み（要件3のテスト）**：`package.json`の無い一時フォルダの`.js`は、Node.js v24の構文の自動判別でESモジュールとして読まれる（プロジェクトの`test/`と同じ前提）。一時フォルダの上位（例：ユーザーのフォルダ）に`"type": "commonjs"`を持つ`package.json`があると読めない可能性がある。起きた場合はタスク7で記録する。
*   **`file://`で開いた場合の動的`import`（要調査・目視確認）**：計画時にブラウザでの実地確認はできていない。一般に、Chrome・Edgeは`file://`で開いたHTMLからESモジュール（`<script type="module" src>`）を読み込めない（エディタ本体の`index.html`も同じ条件のため、確認用ページだけが動かないことはない）。Firefoxは`file://`でも同じフォルダ以下のモジュールを読める。Blob URLの動的`import`は、ローカルサーバー経由（`http://localhost`）ではChrome・Edge・Firefoxとも使える。`file://`で開いたページ（オリジンが不透明）からのBlob URLの`import`の可否はブラウザにより異なる可能性があるため、テストプレイで確かめる。失敗した場合は「JSONとして読めず、JSとしても読み込めませんでした」と表示されページは止まらない（コンソールに詳細）。その場合の代替（`data:text/javascript,`のURL。`test/io/CodeExporter.test.js`と同じ方法）への切り替えは、テストプレイの結果を見て判断する。
*   **`accept`への`.js`の追加**：「開く」「インポート」で`.js`を選べるようになるが、エディタはJSを実行しない（テキストとして読むだけ）。本アプリのものでないJSは`readFailed`。
*   **作業データファイルの読み込みの経路の変更**：開く・インポートの入口が`DocumentSerializer.deserializeFromString`から`FileContentReader.deserializeFromText`に変わる。作業データファイルの分類・通知・図形は変わらない（タスク5の既存テストで確かめる）。JSONとして解析できないファイルの`console.warn`の出し手が`DocumentSerializer`から`FileContentReader`へ変わる。

### タスク2で追記
*   判断に迷った点・開発資料への影響：なし（2章の更新予定どおり）。テストの`CR`のみ改行のケースは計画の項目に加えた補足（手順が`/\r\n?/g`を扱うことの確認）。

### タスク3で追記
*   判断に迷った点・開発資料への影響：なし（2章の更新予定どおり）。`#failure`のwarn文言は「FileContentReader: ファイルを読み込めませんでした: 理由」。

### タスク4で追記
*   判断に迷った点・開発資料への影響：なし（2章の更新予定どおり）。`a.js.js`→`a.js`のケースは計画の項目に加えた補足（1回だけ除くことの確認）。

### タスク5で追記
*   判断に迷った点・開発資料への影響：なし（2章の更新予定どおり）。インポートの期待値は`insertDocument`の引数の`shapes`・`dx`・`dy`と呼び出し順・通知で比較（偽物の`insertDocument`は`documentData.shapes`の件数に応じた結果を返す）。通知の`fileName`だけは作業データ側（`work.json`）とスプライト側（`ship.js`）で異なるため置き換えて比較した。

### タスク6で追記
*   判断に迷った点・開発資料への影響：なし（2章の更新予定どおり）。目視確認として、エディタの「開く」「インポート」の小窓で`.js`・`.json`・`.ozve.json`が選べること、ボタンのツールチップ（`title`）の文言を推奨。

### タスク7で追記
*   判断に迷った点・開発資料への影響：なし（2章の更新予定どおり。`16_test.md`の例外はタスク11で反映）。一時フォルダの`.js`はこの環境で問題なくESモジュールとして読めた。

### 目視確認項目（テストプレイ）
*   `sprite-check.html`を、`index.html`と同じ開き方（同じフォルダのHTMLをブラウザで開く。普段ローカルサーバーを使っている場合はそれも）で開くと、注意書き・ファイル選択・情報欄・描画領域が表示され、コンソールにエラーが出ない。
*   04-02で出力した`ship.js`を選ぶと、エディタと同じ線画が、原点を描画領域の中央にして等倍で表示され、外枠の矩形（青の破線）と原点の印（赤の十字）が出る。線画が印・外枠に隠れない。情報欄にファイル名・書き出し形式の版（1）・作業データの版（1）・描画要素の数（図形の数）・外枠の値と幅・高さが出る。
*   同じキャンバスの`ship.json`を選んでも同じ表示になる（ファイル名以外の情報欄も同じ）。
*   図形0個で出力したスプライト（JS・JSON）では、絵が無く原点の印だけが出て、外枠は「外枠なし（図形0個）」、描画要素の数は0。
*   作業データファイル（`.ozve.json`）・関係のないJS・壊れたJSON・テキストを途中で切ったJSを選ぶと、前の表示が消えて「読み込めませんでした：」と理由が出てページが止まらず、続けて別のファイル（`ship.js`等）を選ぶと正しく表示される。同じファイルを続けて2回選んでも2回目も読み込まれる。
*   スプライトを表示したままウィンドウの大きさを変えると、原点が中央のまま描き直され、線画の大きさ（等倍）は変わらない。
*   エディタの「開く」の小窓で`.js`が選べ、`ship.js`・`ship.json`を選ぶと`ship`という名前の新しいキャンバスとして開け、図形（位置・色・太さ・並び）が元どおり。
*   エディタの「インポート」でスプライト（JS・JSON）を選ぶと、開いているキャンバスへ図形が追加されて選択され、取り消し（Undo）で戻り、やり直し（Redo）で再び追加される。
*   関係のないJS・壊れたファイルを「開く」「インポート」すると、読み込み失敗の通知（「…本アプリで出力した作業ファイル、またはエンジン用のファイル（.js・.json）か確認してください。」）が出て、アプリは止まらない。
*   従来の`.ozve.json`・`.json`の作業データファイルも、これまでどおり「開く」「インポート」できる。
*   「開く」「インポート」ボタンにマウスを乗せると、スプライト（.js・.json）も選べることが分かる説明が出る。
*   既存の作成・保存（再読み込み後も残る）・出力（作業ファイル・エンジン用）・Undo/Redo・コピー＆ペースト・キャンバスの切り替えが変わらない。
*   プロジェクトのルートで`node --test`が全件成功する（`fail 0`）。
