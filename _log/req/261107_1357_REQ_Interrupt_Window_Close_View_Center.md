# 作業指示書 REQ: Interrupt : フロートウィンドウの×ボタンの整理と、原点を表示領域の中央に置く初期表示
* ルール: `./PROJECT_CONSTITUTION.md`

## 【作業手順（厳守事項）】
本プロンプトは、フロートウィンドウの×ボタンの整理と、ビューの初期表示（原点を表示領域の中央に置く）のInterruptである。必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本REQの【関連する責務】を把握すること。作業に必要な責務情報はすべてここに記載されている。開発資料（`PROJECT_ARCHITECTURE.md`）は、記載外の責務を確認する必要が生じた場合にのみ参照すること。
3. 実装対象のコードを読み、【関連する責務】に**記述されている内容と実コードが矛盾する**場合は、修正に着手せず、相違点を報告して指示を待つこと。記述にない事項の存在は相違とみなさない。
4. 相違がなければ、【実装要件】に従って実装を開始し、ソースコードの修正を実行すること。
5. コード修正が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポート（`./_log/res/261107_1357_RES_Interrupt_Window_Close_View_Center.md`）を新規作成して出力すること。
   * テンプレートの項目に従い、「原因と修正方針」「対象ファイル」「詳細作業内容」を正確に記述すること。
6. 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）の内容に影響がある場合は、資料本体は修正せず、その旨を作業レポートの『開発資料の更新予定』欄に明記すること。
7. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【背景と確定事項】
以下は発注者の決定であり、変更してはならない。
* フロートウィンドウの×ボタン：コントロールパネル・図形パレットからは削除する。キャンバスパレットは現状のまま（×で閉じ、コントロールパネルの呼び出し口で開き直せる）。`?dev`の確認用ウィンドウは×で閉じられるようにする（開き直す手段は設けない。再読み込みで再表示）。確認用ウィンドウの表示条件（`?dev`のときだけ表示）・名前は変えない。
* ビューの初期表示：ワールド座標の原点(0, 0)を表示領域の中央に置き、表示倍率は100%とする。対象の場面は、キャンバス一覧から開く・新規作成・開く（ファイル）・起動時の前回のキャンバスの復元・ビューのリセット（`Ctrl`+`0`・リセットボタン）。インポート（開いているキャンバスへの追加）では表示を変えない。これはPhase 03-01の「初期表示・リセット時の原点はキャンバス左上」という決定の変更である。
* 「表示領域の中央」はキャンバス要素全体（CSSピクセルの幅・高さ）の中心とする（フロートウィンドウに隠れる部分は考慮しない）。
* ブラウザのウィンドウの大きさを変えても、ビュー変換は変えない（原点を中央に追従させない）。

## 【実装要件】
### 要件1: 原点を中央に置く初期表示（`js/core/ViewTransform.js`・`js/main.js`）
* `ViewTransform.reset()`を、原点を置くスクリーン座標を受け取る形にする：`reset(originX = 0, originY = 0)`。倍率を1、オフセットを`(originX, originY)`にする。既にその状態なら何もせず通知もしない（現行の考え方を保つ）。引数が有限の数でなければ`console.warn`して`0`として扱う。`ViewTransform`はキャンバスの大きさを知らない（DOMに依存しない）ままとする。
* `main.js`に、キャンバス要素の`clientWidth / 2`・`clientHeight / 2`を渡して`viewTransform.reset(...)`を呼ぶローカル関数（例：`resetViewToCenter()`）を1つ置き、次の3か所すべてをこれに置き換える（大きさの扱いは`main.js`のこの1か所に集める。既存の`zoomAtCanvasCenter`と同じ考え方）：
  * リセットボタン（`#view-reset`）の`click`
  * `KeyboardShortcuts`の`resetView`
  * `CanvasLibrary`へ注入する`resetView`
* `CanvasLibrary`は変更しない（注入された`resetView`を切り替え時に呼ぶだけで、開く・新規作成・開く（ファイル）・起動時の復元・開いているキャンバスの削除後の切り替えはすべてこの経路を通る）。インポートの経路（`CanvasFileOperations`）は`resetView`を呼ばないため変更しない。
* 起動時の復元で`resetView`が呼ばれる時点でキャンバス要素の大きさが取れていること（`clientWidth`/`clientHeight`が0のまま原点が左上にならないこと）を実コードで確かめ、作業レポートに記す。取れない順序であれば、修正に着手せず報告すること。
* `window`の`resize`ハンドラは変更しない。

### 要件2: ×ボタンの整理（`index.html`・`js/palette/DevPanel.js`・`js/palette/PaletteLauncher.js`）
* `index.html`：コントロールパネル（`#window-control-panel`）と図形パレット（`#window-shape-palette`）の見出しから`.window-close-btn`のボタンを削除する。見出しはタイトルだけになる。見出しの見た目（高さ・余白）は、ボタンが無くなっても他のウィンドウとそろうよう必要なら`.window-header`のCSSで調整してよい（例：最小の高さをそろえる）。キャンバスパレット・確認用ウィンドウの見出しは変えない。
* `DevPanel`：コンストラクタで、ルート要素内の`.window-close-btn`の`click`で確認用ウィンドウを閉じる（ルート要素に`hidden`を付ける）配線を行う。ボタンが見つからなくても他の配線は行う（`console.warn`のみ）。開き直す公開メソッドは足さない（既存の`show()`はそのまま）。
* `PaletteLauncher`：コードは変えない。JSDocの「対応表に含まれないウィンドウ（コントロールパネル・図形パレット・`?dev`の確認用ウィンドウ）の×は無機能のまま」を、実態（コントロールパネル・図形パレットには×が無い。確認用ウィンドウの×は`DevPanel`が配線する）に合わせて直す。

### 要件3: JSDoc・コメント
* 変更した関数・メソッドのJSDocとコメントを、修正後の動作に合わせる（`ViewTransform`のクラス説明・`reset`、`main.js`の該当コメント、`CanvasLibrary`の`resetView`の説明で「初期表示」の意味が原点左上を前提としている記述があれば、それも直す。`CanvasLibrary`はJSDoc・コメントのみ変更してよい）。

## 【関連する責務】
* `ViewTransform`（`js/core/`）：表示倍率・オフセットの保持、スクリーン⇔ワールド変換、ズーム・パン・リセット・変更通知。変換式は`スクリーン = ワールド × 倍率 ＋ オフセット`。VectorModel・CanvasManager・図形クラス・DOMに依存しない。
* `main.js`：各部品の組み立てと依存の注入。キャンバス要素の大きさを使う計算（`zoomAtCanvasCenter`）を持つ。再描画・倍率表示の更新は`viewTransform.onChange`の経路で行う。
* `CanvasLibrary`（`js/edit/`）：キャンバスの切り替え（開く・新規作成・開く（ファイル）・起動時の復元・削除後の切り替え）。切り替えの手順5で注入された`resetView()`を呼ぶ。DOMに触れない。
* `CanvasFileOperations`（`js/edit/`）：書き出し・開く（ファイル）・インポート。インポートは開いているキャンバスへ図形を追加するだけで、ビュー変換には触れない。
* `DevPanel`（`js/palette/`）：`?dev`の確認用ウィンドウ（`#window-dev-panel`）のDOM操作専任。`show()`で`hidden`を解除する。
* `PaletteLauncher`（`js/palette/`）：呼び出し口のボタンとパレットの開閉（パレット内の`.window-close-btn`で閉じる）。対応表はキャンバスパレットのみ。
* `WindowManager`（`js/core/`）：フロートウィンドウのドラッグ・最前面化。見出し（`.window-header`）をつかんで動かす。

## 【絶対遵守ルール (Constraints)】
* **アーキテクチャの維持** : `ViewTransform`・`CanvasLibrary`はDOMに触れない。依存方向`main.js → edit → io → core → shapes`を変えない。外部ライブラリを導入しない。
* **対象ファイル** : `js/core/ViewTransform.js`・`js/main.js`・`js/palette/DevPanel.js`・`js/palette/PaletteLauncher.js`（JSDocのみ）・`js/edit/CanvasLibrary.js`（JSDoc・コメントのみ）・`index.html`のみ。
* **範囲外** : ウィンドウの大きさの変更への追従。インポートの表示。確認用ウィンドウの開き直し手段・表示条件・名前の変更。`WindowManager`の変更。作業データ形式の変更。
* **確認** : 実装AIは`node --check`で構文のみ確かめる。ブラウザでの動作確認は現場設計AIが行う。
