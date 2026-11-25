# RES: 作業レポート Interrupt : Phase 11-06b 書き出しから復元用のデータを外したことのエンジンへの連絡（確かめ用の作業ファイルと連絡票）
* 参照元REQ: `./_log/req/261125_2340_REQ_Phase11-06b_Engine_Notice.md`

## 1. 作業目的
Phase 11-06aで書き出しのスプライトJSから`source`と描画要素の`id`を外したことを、OZ Engineへ連絡票で知らせ、書き出したJSをエンジンで今までどおり描けること（そのまま`draw(ctx)`・`CanvasCache`で焼き付けの両方）を確かめるための、確かめ用の作業ファイルと連絡票を作る。本アプリのソース・テストは変更しない。

## 2. 実装内容
* 【関連する責務】の記述と実コードに矛盾はなかった（アイテム・作業データ・図形データ・変形・結合・書き出し・読み込みの入口とも）。
* 作業ファイルは、一時スクリプトから図形クラス・変形・結合の関数を`import`して作り、`DocumentSerializer.serializeToString`で書いた。スクリプトは確認後に削除済み。
* 連絡票は、REQの【連絡票の本文】（コードブロックの囲みを除く42行）をREQファイルから機械的に切り出して書いた（言い換えなし）。

## 3. 対象ファイル
どちらも本リポジトリの外のファイルであり、コミットしない。
* `C:\Users\takayuki.ozawa\Downloads\testplay_11-06b\no_source_check.ozve.json` : 新規（確かめ用の作業ファイル。フォルダ`testplay_11-06b`も新規）
* `D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR.md` : 新規（連絡票。エンジンのリポジトリ。`git add`・コミットはしていない）
* `./_log/res/261125_2339_RES_Phase11-06b_Engine_Notice.md` : 新規（本レポート）

## 4. 詳細作業内容
* **作業内容**:
  * **作業ファイルの12図形の作り方の要点**（線`#ff8800`・太さ4、塗り`#33aaff`。作った図形は外枠（線を含まない）の中心を、`createTransformed`の平行移動で列・段の中心へ寄せた。範囲±28（番号11・12は±20）を超えたら例外にする検査つき）
    * 1 直線：`Line(0,0,50,30)`。線のみ。
    * 2 曲線：`Curve.fromJSON`で`points`＝[(0,0), (14,-50), (50,10)]（制御点が中央から外れた非対称）。線のみ。
    * 3 矩形：`Rect(0,0,50,40)`。塗りと線。フォルダA（13）の中。
    * 4 回した楕円：`Ellipse(0,0,15,15,'circle')`を`toScaleTransform({scaleX:1.7, scaleY:0.8})`で伸ばし、`toRotationTransform(中心, -30°)`で反時計回りに回した。塗りと線。フォルダAの中。
    * 5 弧：`Ellipse(0,0,25,25,'arc')`。線のみ。フォルダB（14。閉じた）の中。
    * 6 裏返した弧：`Ellipse(0,0,24,24,'arc')`を`toRotationTransform(中心, +30°)`で時計回りに回し、`resolveFlipTransform(FLIP_AXIS.HORIZONTAL, 中心)`で横に反転。線のみ。ロックあり。
    * 7 開いた直線のパス：`Path`4頂点（(0,0),(18,-24),(36,8),(52,-12)）、全区間`'line'`。線のみ。
    * 8 閉じた曲線のパス：`Path`4頂点（(0,-24),(26,0),(0,24),(-26,6)）、閉じて全区間`'smooth'`。塗りと線。
    * 9 半月形：`Ellipse(0,0,26,24,'arc')`の`lineEndpointOf`で読んだ始点・終点を端とする`Line`（終点→始点）を作り、`buildJoinedPath(弧, 直線, 0.001)`→`buildClosedPath(結果, 0.001)`で閉じた。端点は同じ座標（`lineEndpointOf`の値そのもの）。結果は頂点3つ（(-26,0),(0,-24),(26,0)）・区間は`bezier`2つと`line`1つ。結合の結果は`a`の色になるため、`toJSON`の`strokeColor`を`null`にして`Path.fromJSON`で戻し、塗りのみにした。
    * 10 閉じた直線のパス：`Path`5頂点（半径26の正五角形を`Math`で作った）、全区間`'line'`。塗りと線。
    * 11 矩形：`Rect(0,0,40,40)`を中心(0,130)へ。赤（線・塗りとも`#ff0000`・太さ4）。`visible: false`。
    * 12 円：`Ellipse(0,0,20,20,'circle')`を中心(0,-130)へ。赤。図形は`visible: true`、フォルダC（15）が`visible: false`。
    * 名前・入れ子：フォルダ13`本体`（中に3・4・閉じたフォルダ14`飾り`（中に5））、フォルダ15`下書き`、図形は`図形01`〜`図形12`。描画順は番号順。
  * **要件3の確認**（一時スクリプトで実施。`import`は本アプリのモジュールを直接、以前のコードは`git archive 234f59f js`を一時フォルダへ取り出し`{"type":"module"}`の`package.json`を置いて読んだ。作業ツリー・ブランチは変えていない）
    * 作業ファイル：`version` 4。`DocumentSerializer.deserialize`は`ok: true`・`skipped` 0件。12図形が`1:line 2:curve 3:rect 4:circle 5:arc 6:arc 7:path 8:path 9:path 10:path 11:rect 12:circle`の順で読めた。フォルダの入れ子・名前・`visible`・`locked`・`collapsed`（14のみtrue）は要件1のとおり。
    * 書き出し：`SpriteSerializer.serialize`の最上位のキーは`format,formatVersion,bounds,elements`のみ。`formatVersion` 4、`elements` 10個、`kind`は`polyline quadratic polyline ellipse ellipse ellipse polyline bezierPath bezierPath polyline`。どの要素も`id`を持たない。
    * JSのテキスト：`CodeExporter.toModuleText`の結果に`"source"`・`"id"`・`"name"`・`"children"`・`"visible"`・`"locked"`・`本体`・`飾り`・`下書き`・`図形`・`#ff0000`のどれも現れない。
    * 以前のコード（`234f59f`）との比較：以前の書き出しは`format,formatVersion,bounds,elements,source`で`elements` 10個。`bounds`は完全一致、`elements`は`id`を除いて完全一致。それぞれのテキストを`.mjs`として`import`し、命令・設定値を記録する偽の`ctx`で`draw(ctx)`を呼んだ記録は完全一致（86件）。
    * 外枠：`bounds` = `{ minX: -187, minY: -62, maxX: 187, maxY: 66.0529470267308 }`（番号11・12を含まない。横±190・縦±70の内側）。
    * 開き直し：JSのテキストを`FileContentReader.deserializeFromText`に渡すと`ok: true`・読み飛ばし0件・図形10個。書き出し直した`bounds`は元と各辺とも差0（`-187, -62, 187, 66.0529470267308`）。
    * エンジンの機体：`D:\ozlab\ozengine-web\assets\sprites\ship.js`（読むだけ）を`deserializeFromText`に渡すと`ok: true`・読み飛ばし0件・図形3個。書き出し直したJSと元の`ship.js`（一時フォルダへ`.mjs`で写して`import`）の`draw(ctx)`の記録は24件ずつで、差は0件（版2と版4の命令の違いは出なかった）。
    * `node --test`：tests 3699・pass 3699・fail 0（作業前と同じ）。
    * `git status`（本リポジトリ）：作業レポート以外の変更なし（本レポートの作成前の時点で変更なし）。エンジンのリポジトリは`_doc/BRIDGE_FROM_VECTOREDITOR.md`の新規（未追跡）のみ。
  * 一時スクリプト・取り出した以前のコード・一時の`.mjs`は削除済み（OSの一時フォルダ内のみ）。
* **エンジンからの返信の取り込み（要件5）**（返信：`_doc/BRIDGE_FROM_ENGINE.md`。発注者から「返信が届いた」と知らされた）
  * 返信の要点：
    * 確かめ方：`no_source_check.js`を手で編集せず`import`し、タイトル画面（1280×720）に(a)`draw(ctx)`をそのまま呼んだもの・(b)`CanvasCache.create(sprite, { bounds: sprite.bounds })`で焼き付けたものを並べた（拡大・回転なし）。発注者が画面で確かめた。一時的な変更は戻し、コミットしていない。`oz/`は変えていない。
    * (a)・(b)とも図形10個が表示された。コンソールに警告・エラーなし。赤い図形は出ていない。
    * (a)と(b)の形に違いなし。(b)の端（左上の直線の端、右下の五角形の右の角と下の辺を含む）に欠けなし。機体`ship.js`（版2・`source`入り）はタイトル画面・プレイ画面とも今までどおり出た。
    * 補足（直す依頼ではない）：五角形の右の角の先は`bounds`の`maxX`（187）から約0.08px計算上はみ出す（`miter`の角の先を`bounds`が含まないため。版3・版4の確認のときに伝えた件と同じ）。焼き付けの四方2画素の余白の内側に収まる。
    * `source`・`elements`の`id`を読んでいる所：なし（エンジンの`oz/`・`js/`と、バトリティア（コミット`05b8ae4`）の`js/`を調べた。バトリティアはスプライトJSを`js/view/spriteView.js`だけで`import`し、読むのは`draw`と`bounds`だけ。`CanvasCache.create`の引数名`source`はJSのキー`source`とは別物）。
    * 困ったこと・エディタ側で直してほしいこと：なし。エンジンのコードの変更も不要だった。
    * エンジン側の資料：変えていない。`oz/ENGINE_API.md` 23章の「それ以外のキー（`format`・`formatVersion`・`elements`・`source` など）は、エンジンも利用側も読まない」は誤りではないので変えない。
    * 問題の記載は、返信にない。
  * 開発資料との照合：返信は23章を変えていないため、2章「エンジンとの約束」の(b)（`source`は今までのJSだけが持ち、エンジンも利用側も読まない）との食い違いはない。
  * `PROJECT_ARCHITECTURE.md`の直した2か所（5章に記載のとおり。ほかは変えていない。行末は作業ツリーのCRLFのまま（全1021行がCRLF。gitの中ではLF）。）：2章(d)末尾の文、1章「存在しないもの」の末尾。
  * `_doc/BRIDGE_FROM_ENGINE.md`：取り込み後に削除する（コミットしない。監査で照合した後に実装統括AIが削除する。本作業では削除していない）。
  * 本レポート2章の連絡票の行数の誤記を「41行」から「42行」に直した（実際の本文はREQの93〜134行の42行。監査の指摘）。
  * `node --test`：tests 3699・pass 3699・fail 0。
  * `git status --short`：` M PROJECT_ARCHITECTURE.md`、`?? _doc/BRIDGE_FROM_ENGINE.md`、`?? _log/res/261125_2339_RES_Phase11-06b_Engine_Notice.md`。`git diff --stat`：`PROJECT_ARCHITECTURE.md | 4 ++--`（2行置換）。
  * 返信に書かれていない、エディタ・確認用ページ（`sprite-check.html`）での目視の結果は、本レポートでは確認済みとしていない。

## 5. 開発資料の更新予定
この時点では直さない。エンジンからの返信の取り込み後（要件5）に、`PROJECT_ARCHITECTURE.md`の次の2か所だけを直す。
* **2章「エンジンとの約束」の(d)**：末尾の文「`source`・描画要素の`id`を外した変更（Phase 11-06a。版は4のまま）のエンジンへの連絡はPhase 11-06bで行う。」を、連絡済み（Phase 11-06b）で、エンジン本体（`oz/`）のコードの変更なしに、そのまま描いたものも焼き付けたものも今までどおり表示できた、という結果（返信の内容に合わせる）に書き換える。
* **1章「存在しないもの」の末尾**：「エンジン側の資料の更新（エンジンへの連絡はPhase 11-06b）」を「エンジン側の資料の更新（エンジンへの連絡はPhase 11-06bで済んだ）」に書き換える。

### 反映済み（要件5）
上記2か所は、エンジンからの返信の取り込み後に`PROJECT_ARCHITECTURE.md`へ反映済み。
* 2章(d)の末尾の文を、「エンジンへ連絡済み（Phase 11-06b）。エンジン本体（`oz/`）のコードの変更なしに、そのまま描いたもの（`draw(ctx)`）も焼き付けたもの（`CanvasCache`）も今までどおり表示できた。エンジン側の資料（`oz/ENGINE_API.md`）は変えていない。」という趣旨の文に書き換えた。
* 1章「存在しないもの」の末尾を「エンジン側の資料の更新（エンジンへの連絡はPhase 11-06bで済んだ）」に書き換えた。

## 6. 懸念事項・要確認ポイント
【関連する責務】の記述と実コードの相違は、気づかなかった。以下は発注者の目視確認項目（各図形の位置は要件1の配置。上段は左から図形01〜05、下段は左から図形06〜10。中心の横は左から-160・-80・0・80・160、縦は上段-40・下段40）。
* エディタで`Ctrl`+`F5`で最新にしてから「開く」で`no_source_check.ozve.json`を開くと、キャンバス`no_source_check`が開き、読み込み失敗の通知が出ない。原点のまわりに10個の図形が2段に並び（上段：斜めの直線・左右非対称の曲線・矩形・横長で傾いた楕円・弧、下段：傾いて横に裏返った弧・開いた折れ線・閉じた曲線・半月形（塗りのみ）・五角形）、赤い図形は見えない。一覧に、フォルダ「本体」（中に閉じたフォルダ「飾り」）と、隠したフォルダ「下書き」、隠した図形「図形11」、ロックした図形「図形06」がある。
* 「出力（エンジン用）」で`no_source_check.js`がダウンロードされる。
* 確認用ページ（`sprite-check.html`）で`no_source_check.js`を選ぶと、エディタと同じ形に10個が描かれ、赤い図形は出ない。情報欄が書き出し形式の版4・作業データの版「なし」・要素10を示す。
* ダウンロードした`no_source_check.js`を`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR_no_source_check.js`という名前で置いてから、エンジン側のセッションに連絡票`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR.md`を渡す。
* エンジンのゲームの画面で、そのまま描いたものと焼き付けたものが、エディタと同じ形に出る。赤い図形は出ない。焼き付けたほうで、端が欠けていない（外枠は横±187・縦-62〜66.05。線の太さを含む）。機体（`ship.js`）も今までどおり出る。
