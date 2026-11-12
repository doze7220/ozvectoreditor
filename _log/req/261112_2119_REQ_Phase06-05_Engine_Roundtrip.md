# 作業指示書 REQ: Phase 06-05 : OZ Engineとの往復（機体の作業ファイルと連絡票）
* ルール: `./PROJECT_CONSTITUTION.md`
* 設計指針: `./_log/dir/261111_1822_DIR_Phase06-00_Coloring.md`（4章 Phase 06-05）
* 参考資料: `./_log/res/closed/261109_1902_RES_Phase04-04_Engine_Roundtrip.md`（前回のエンジンとの往復）

## 【作業手順（厳守事項）】
本プロンプトはPhase 06-05（OZ Engineとの往復）の即時実行の作業である。**本アプリのソースコード・テスト・開発資料は一切変更しない。** 作るのは【実装要件】の2つのファイル（作業ファイル・連絡票）と作業レポートだけである。必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本REQの【関連する責務】を把握すること。作業に必要な責務情報はすべてここに記載されている。開発資料（`PROJECT_ARCHITECTURE.md`）は、記載外の責務を確認する必要が生じた場合にのみ参照すること。
3. 【関連する責務】に挙げたコード（図形データの形・読み込みの検証・書き出しの形）を読み、記述と実コードが**矛盾する**場合は、ファイルを作らずに相違点を報告して指示を待つこと。記述にない事項の存在は相違とみなさない。
4. 相違がなければ、【実装要件】に従って要件1（作業ファイル）・要件2（連絡票）を作成し、要件3の確認を行うこと。
5. Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポート（`./_log/res/YYMMDD_HHMM_RES_Phase06-05_Engine_Roundtrip.md`）を新規作成して出力すること（※YYMMDD_HHMMは作業実行時の現在日時）。RES冒頭の「参照元REQ」には本ファイル（`./_log/req/261112_2119_REQ_Phase06-05_Engine_Roundtrip.md`）を記載すること。
   * 「対象ファイル」には、作成した2つのファイルを絶対パスで書き、どちらも本リポジトリの外のファイルでありコミットしないことを明記すること。
   * 「詳細作業内容」に、要件3の確認の結果（実行したコマンドと出力の要点、`node --test`の件数）を書くこと。
   * 「開発資料の更新予定」は、本作業で開発資料に影響がなければ「該当なし」とすること（エンジンからの返信の要点を資料へ移すのは返信が届いた後の別作業であり、本作業では行わない）。
   * 「懸念事項・要確認ポイント」に、要件4の目視確認項目を書くこと。
6. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【実装要件】

### 背景と決定事項（発注者決定、2026-11-12）
* 手書きの`ship.js`（OZ Engine `D:\ozlab\ozengine-web\assets\sprites\ship.js`）とだいたい同じ機体の絵を、**AIが作業ファイル（`.ozve.json`）として用意する**。発注者はそれをエディタの「開く」で開き、「出力（エンジン用）」で書き出す（書き出しは本作業では行わない）。
* 書き出したJSは、発注者が`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR_ship.js`に置く。連絡票にはその場所を書く。エンジン側が`assets/sprites/ship.js`へ差し替え、取り込み後に削除する。
* 連絡票の補足として、未着手のPhaseを名前で指す取り決めを伝える。
* 確認用ページ（`sprite-check.html`）・エディタのキャンバスの背景はどちらも白のままとする（背景の切り替えは足さない）。白の塗りだけ・線なしの機体は両画面でほぼ見えないため、エディタでは「すべて選択」のハンドル・プロパティパネルで、確認用ページでは外枠・原点の印・情報欄で確かめ、見た目はエンジンの画面で確かめる。

### 要件1: 機体の作業ファイルを作る
* 作成先：`C:\Users\takayuki.ozawa\AppData\Local\Claude-Data\claude_pzs8sxrjxfjjc\side-session-notes\local_dcd07445-ad57-475f-8286-cb5b55213097\testplay_06-05\ship.ozve.json`（フォルダ`testplay_06-05`が無ければ作る。本リポジトリの外。ファイル名`ship.ozve.json`はエディタで開くとキャンバス名`ship`になり、書き出すJSが`ship.js`になるため）。
* 中身：作業データ形式の版2（`{ "format": "oz-vector-editor", "version": 2, "shapes": [...] }`）。`shapes`は次の3つをこの順（描画順。後ろほど手前）に並べる。手書きの`ship.js`と同じ座標とする。
  1. 閉じたパス（凹型の4頂点）：`type: "path"`、`points`＝`(22, 0)`・`(-23, 18)`・`(-13, 0)`・`(-23, -18)`の順、`closed: true`、`segments`＝`{ "kind": "line" }`を4つ。
  2. 円：中心`(-18, -12)`、半径3。
  3. 円：中心`(-18, 12)`、半径3。
  * 3つとも`strokeColor: null`（線なし）、`strokeWidth: 2`、`fillColor: "#ffffff"`。
  * `id`は`"1"`・`"2"`・`"3"`とする（読み込み時に`VectorModel`が正規化するため値は任意だが、重複させない）。
  * 図形データのキーの順・円の`points`の5点の並びは、【関連する責務】の形と実コード（各図形クラスの`toJSON`）に合わせること。
  * JSONの字下げは2（`JSON.stringify(data, null, 2)`と同じ形）とし、末尾の改行の有無は問わない。

### 要件2: 連絡票をOZ Engineのリポジトリに書く
* 作成先：`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR.md`（新規。既に存在する場合は書かずに報告して指示を待つ）。
* 本文：下の【連絡票の本文】を**一字一句そのまま**書く（発注者が承認した本文。言い換え・追記・削除をしない。コードブロックの囲み（```）自体は含めない）。
* エンジンのリポジトリでは、このファイル以外を作成・変更しない。`git add`・コミットもしない（エンジン側のセッションが取り込む）。

### 要件3: 作業ファイルの確認（ファイルを残さない）
* 作業ファイルが本アプリで正しく読めることを、Node.jsで本アプリのモジュールを`import`する一時的なスクリプトで確かめる。スクリプトは本リポジトリの中に置かず（OSの一時フォルダ等）、確認後に削除する。少なくとも次を確かめる：
  * `DocumentSerializer.deserialize`（作業ファイルのJSONを`JSON.parse`した値を渡す）の結果が全体成功で、図形3つがスキップされずに読める（`path`・`circle`・`circle`の順）。
  * 読めた3図形の`isFillable()`がすべて真。
  * 読めた図形一式から`SpriteSerializer.serialize`で作ったスプライトデータが、`formatVersion: 2`、`elements`の3要素の`kind`が`polyline`・`ellipse`・`ellipse`、3要素とも`strokeColor: null`・`fillColor: "#ffffff"`、`bounds`が`{ minX: -23, minY: -18, maxX: 22, maxY: 18 }`（線なしのため線の太さ分を広げない）になる。
  * 上のスプライトデータから`CodeExporter.toModuleText`でJSのテキストが組み立てられる（例外にならない）。
* プロジェクトのルートで`node --test`を実行し、全件成功すること（本作業はソースを変えないため件数は作業前と同じはず）をRESに記録する。
* `git status`で本リポジトリに作業レポート以外の変更がないことを確かめる。

### 要件4: 目視確認項目（RESの「懸念事項・要確認ポイント」に書く）
発注者のテストプレイの項目として、少なくとも次を書くこと（画面・操作の言葉で）：
* エディタの「開く」で`ship.ozve.json`を開くと、キャンバス`ship`が開き、読み込み失敗の通知が出ない。背景が白のため機体はほぼ見えないが、「すべて選択」（`Ctrl`+`A`）で3つの図形のハンドルが原点付近（左右およそ-23〜22、上下およそ-18〜18）に出る。
* 図形を1つずつ選ぶと、プロパティパネルが線なし・塗りあり（白）を示す。
* 「出力（エンジン用）」で`ship.js`がダウンロードされる。
* 確認用ページ（`sprite-check.html`）で`ship.js`を選ぶと、原点の印と外枠（左右-23〜22、上下-18〜18）が出て、情報欄が書き出し形式の版2・要素3を示す（機体自体は白の背景に白のためほぼ見えない）。
* ダウンロードした`ship.js`を`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR_ship.js`という名前で置いてから、エンジン側のセッションに連絡票を渡す。

### 【連絡票の本文】
```
# 連絡票：OZ Vector Editor → OZ Engine（書き出し形式の版2と、機体のスプライトの差し替え）
* 差出：OZ Vector Editor（`D:\ozlab\ozvectoreditor`）の着色のPhase（Phase 06-05）
* 日付：2026-11-12
* 返信の場所：`D:\ozlab\ozvectoreditor\_doc\BRIDGE_FROM_ENGINE.md`（エンジン側のセッションが新規に書く。エディタ側で取り込み、要点を開発資料へ移してから削除する）
* 本連絡票と下記のJSはエンジンのリポジトリのファイルだが、エディタ側ではコミットしていない。取り込みが済んだら、エンジン側で削除してほしい。

## 1. 書き出し形式の版を2に上げた
* エディタは図形に塗り（`fillColor`）と線なし（`strokeColor: null`）を持てるようになり、スプライトJSの書き出し形式の版（`formatVersion`）を1から2に上げた（エディタの約束(c)「版を上げるときはエンジンへ連絡票を出す」による連絡）。
* 版2で変わったこと：
  * 描画要素（`elements`の各要素）に`fillColor`キー（色の文字列、または`null`）が加わった。塗るのは、`fillColor`が文字列で、`kind`が`polyline`または`ellipse`で`closed`が`true`の要素だけ。
  * `strokeColor`が`null`の要素は線を描かない。
  * 描く順は、形のパス → 塗り → 線（線が塗りの上に重なる）。塗りも線も描かない要素は何も描かない。
  * 外枠（`bounds`）は、線を描かない要素では線の太さの分を広げない。
  * `source`（作業データ）の版も2になった（エンジンは読んでいない）。
* 版を上げた理由：古い読み手は`fillColor`を知らずに無視するため、正しく描けないから。
* 形式の唯一の定義は、従来どおりエディタの`PROJECT_ARCHITECTURE.md` 2章「スプライト（書き出し形式）」。

## 2. エンジンが読む部分の約束は変わらない
* 既定のexportの`draw(ctx)`を呼ぶだけでよい約束は変わらない。`import sprite from '…'`で受け取り、位置・回転を`ctx`に設定してから`draw(ctx)`を呼ぶ形のまま。
* 塗り・線なしの描き方は、各JSが持つ`draw`の中に入っている。`draw`は`ctx`の状態を元に戻し、塗る要素では描くたびに`fillStyle`を設定するため、ゲーム側の`ctx`の値に左右されない。エンジンのコードの変更は要らない見込み。
* 既定のexportだけを持ち、`import`文を含まない点も変わらない。

## 3. お願い：手書きの`ship.js`を置き換えてほしい
* 書き出したJS：`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR_ship.js`（エディタで書き出した`ship.js`を、この名前で置いた）。
* 絵：手書きの`assets/sprites/ship.js`と同じ形・同じ座標（凹型の4頂点の閉じたパス(22, 0)・(-23, 18)・(-13, 0)・(-23, -18)と、中心(-18, -12)・(-18, 12)で半径3の円2つ。白（`#ffffff`）の塗りのみ・線なし。原点(0, 0)・前方+X。円は多角形より手前）。
* お願いしたいこと：
  1. `assets/sprites/ship.js`を上のJSの中身で置き換え、ゲームの土台で機体が手書きのときとだいたい同じ見た目で表示されることを確かめる。
  2. 取り込みが済んだら、本連絡票と上のJSを削除する。
* 返信（`D:\ozlab\ozvectoreditor\_doc\BRIDGE_FROM_ENGINE.md`）に書いてほしいこと：
  * 置き換えたスプライトがエンジン上で表示されたか。
  * 手書きのときと比べて、見た目で気になる違いがあるか。
  * エンジン側で困ったこと・エディタ側で直してほしいこと（なければ「なし」）。
  * エンジン側の資料で、エディタの書き出し形式・約束を参照している箇所を変えたか（変えたならどこを）。

## 4. 補足：エディタのPhaseの番号
* エンジンの資料（`_doc/PROJECT_MILESTONE.md`・`PROJECT_ARCHITECTURE.md`）は、エディタのPhaseを「エディタのP5（塗り）」「エディタのP7（アニメーションエディタモード）」のように番号で書いている。エディタは2026-11-09にPhaseを並べ替えたため、番号がずれている（「P5（塗り）」は現在の着色のPhaseで、今回の置き換えで完了する予定。アニメーションエディタモードのPhaseは現在P9）。
* エディタの未着手のPhaseの番号は今後も並べ替えで変わるため、エディタ側では番号ではなく名前（例：「アニメーションエディタモードのPhase」）で指す取り決めにしている（番号の正本はエディタの`_doc/PROJECT_MILESTONE.md`「フェイズ管理」だけ）。エンジン側の資料も名前で書いてもらえると食い違いが起きにくい。直すかどうか・いつ直すかはエンジン側に任せる。
```

## 【関連する責務】
* **作業データ形式**（`js/io/DocumentSerializer.js`）：`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`。`shapes`は描画順（後ろほど手前）。現行版は2。`deserialize(data)`は全体の形を検証し、図形単位で`ShapeFactory`経由の各図形クラスの`fromJSON`に渡す（不正な図形はスキップされる）。
* **図形データ**（各図形クラスの`toJSON()`/`static fromJSON(data)`）：共通の項目は`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth, fillColor }`（`fillColor`は最後のキー）。`strokeColor`は文字列または`null`（線なし）、`fillColor`は文字列または`null`（塗りなし）、`strokeWidth`は正の有限の数値。
  * **`path`**（`js/shapes/Path.js`）：`{ type: 'path', id, points, closed, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth, fillColor }`（キー順）。`closed`は真偽値。閉じたパスは頂点3つ以上、`segments`の要素数は頂点数と同じ（`segments[i]`＝`points[i]`→`points[i+1]`、最後＝`points[n-1]`→`points[0]`）。`kind`は`'line'`のみ。閉じたパスも始点を重複させない。
  * **`circle`**（`js/shapes/Ellipse.js`。図形種別`'circle'`）：`points`は5点固定。`points[0]`＝中心、`[1]`＝右端、`[2]`＝上端（y軸は下向きのため中心のyから半径を引く）、`[3]`＝開始角点（円は右端）、`[4]`＝終了角点（右端）。半径は`points[1].x`と`points[2].y`から求める。
* **塗れる形**：`isFillable()`が真になるのは`rect`・`circle`・閉じた`path`。
* **スプライト（書き出し形式）**（`js/io/SpriteSerializer.js`・`js/io/CodeExporter.js`）：`SpriteSerializer.serialize(shapes)`がスプライトデータ`{ format: "oz-vector-editor-sprite", formatVersion: 2, bounds, elements, source }`を作り、`CodeExporter.toModuleText(spriteData)`がJSのテキストを組み立てる。描画要素は図形1つにつき1要素で、`path`は`kind: "polyline"`、`circle`は`kind: "ellipse"`。外枠は線を描く要素（`strokeColor`が文字列）だけ線の太さの半分を広げる。
* **エンジンとの約束**（開発資料2章）：エンジンは既定のexportの`draw(ctx)`だけを読む。書き出し形式の版を上げるときはエンジンへ連絡票を出す。

## 【絶対遵守ルール (Constraints)】
* **本アプリを変更しない** : 本リポジトリで作成・変更してよいのは作業レポート（RES）1つだけ。`js/`・`test/`・`index.html`・`sprite-check.html`・開発資料・`_doc/`は変更しない。確認用のスクリプトは本リポジトリの外に置き、確認後に削除する。
* **エンジンのリポジトリ** : 作成してよいのは`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR.md`だけ。`ship.js`・その他のファイルは変更しない。コミットしない。
* **連絡票の本文** : 【連絡票の本文】を一字一句そのまま書く。誤り・矛盾に気づいた場合は書き換えずに報告して指示を待つ。
* **作業ファイルの座標** : 【実装要件】の座標・色・順序から変えない。
