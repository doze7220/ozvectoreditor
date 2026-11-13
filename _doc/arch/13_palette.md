*   **palette/**：自己完結するUI部品。いずれもDOM操作専任で、`VectorModel`・図形データ・選択状態に関与しない（受け取るのは注入された値とコールバックのみ）。独自のカラーピッカーは未実装（色はブラウザ標準の`<input type="color">`）。ツールバー・ステータスバーは`index.html`の静的な要素で、配線は`main.js`（`palette/`の部品は無い）。
    *   **ToolPalette.js**：ツールパレット（`#window-tool-palette`）のツールのボタンの配線。
        *   **公開メソッド**：`setActiveTool`。
        *   **注入**：`main.js`がルート要素・ツールの識別子の一覧（`ToolRules`の`TOOL_IDS`）・`onToolSelected`（`selectTool`）を渡す。importは持たず、`InputTracker`・`ShapeFactory`・`ToolRules`へ直接依存しない。
        *   **契約**：ボタンはid規則`tool-${toolId}`で解決する。不整合（一覧にあるのにボタンが無い／一覧に無い`tool-`の要素）は`console.warn`で報告して、その要素を配線しない。照合はコンストラクタの1回のみ。`setActiveTool(toolId)`は一致する配線済みのボタン1つだけに`.active`を付け、他は外す（一致しなければ`null`を含めすべて外す）。ルート要素が無いと`console.warn`（`ToolPalette: ルート要素が見つかりません。配線しません。`）して何も配線しない（`setActiveTool`は何もしない）。操作モードの知識は持たない（押し込みにするツールは`main.js`が`ToolRules`で求めて渡す）。`.disabled`（ウィンドウ全体の非活性）を扱わない（ツールパレットは常に押せる。`PaletteController`の`setEnabled`に当たるものは無い）。
    *   **DevPanel.js**：開発者向け確認用ウィンドウ（`#window-dev-panel`）。
        *   **公開メソッド**：`show`。
        *   **知らないこと**：作業データの中身。importを持たず、`VectorModel`・`InputTracker`・`DocumentSerializer`・図形インスタンスを参照しない（受け取るのは文字列と要約`ImportSummary`のみ）。
        *   **契約**：コールバックの例外は捕捉しない。`onImport`側の処理を増やす場合は例外を漏らさない（漏れると結果表示が更新されない）。
    *   **PropertyShapeSection.js**：プロパティパネル（`#window-property-panel`）の「図形」の段のDOMの配線（`render(view)`の表示と、利用者の操作のコールバックへの通知）。流れは3章13.。
        *   **公開メソッド**：`render`。
        *   **注入**：コンストラクタで段のルート要素（`#property-shape-section`）とコールバック6つ（`onStrokeEnabledChange(checked)`・`onFillEnabledChange(checked)`・`onStrokeWidthChange(value)`（戻り値`false`なら表示を書き戻す）・`onColorInput(target, value)`・`onColorChange(target, value)`・`onColorEditEnd()`）を受け取る。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（`render`は何もしない）。`main.js`がコールバックを`ShapeStyleEditor`のメソッドへつなぐ。
        *   **知らないこと**：importを持たず、`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`・`StylePanelRules`を参照しない（受け取るのは`view`とコールバックのみ）。判定・変更の手順を持たない。
        *   **表示の規則の要点**：太さの欄はフォーカスがある間は書き換えない（打ち込み途中の値が`model.onChange`で消えないため）。値の確定が受理されなかったとき・欄から出たときは最後の`view`で書き戻す。色の欄は値が今の値と違うときだけ代入する（ピッカー操作中の再描画で同じ値を入れ直さないため）。チェックボックスの中間表示は`indeterminate`。文言（「混在」「表示できない色」「次に描く図形」等）はこのファイルが唯一の定義箇所。文字は`textContent`で設定する（太さの欄の「混在」は`placeholder`で出す）。
        *   **二重定義**：typedef`StylePanelView`は`edit/StylePanelRules.js`と同じ内容を持つ。形を変える場合は両方を揃える。
        *   **段の足し方**：プロパティパネルは段ごとに1つのUI部品を持つ。段を足すときは、`index.html`に`<section class="property-section">`、`palette/`にその段のUI部品（自分の`<section>`をルート要素に受け取り、要素はルート要素内の`querySelector('#id')`で解決する）、`main.js`に段のブロックを足すだけで、`PropertyShapeSection`・既存の段を変えない。
    *   **PropertyOrderSection.js**：プロパティパネルの「重なり順」の段（`#property-order-section`）の4ボタンのDOMの配線（`render(view)`で各ボタンの押せる/押せないを表示し、押下をコールバックへ通知）。流れは3章14.。
        *   **公開メソッド**：`render`。
        *   **注入**：コンストラクタで段のルート要素とコールバック4つ（`onBringToFront`・`onBringForward`・`onSendBackward`・`onSendToBack`）を受け取る。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（`render`は何もしない）。`main.js`がコールバックを`performShapeOrder(ShapeOrderOperation.…)`へつなぐ。
        *   **知らないこと**：importを持たず、`VectorModel`・選択集合・図形データ・`ShapeOrderEditor`・規則・操作の値（`ShapeOrderOperation`）を参照しない（受け取るのは`view`とコールバックのみ）。
        *   **二重定義**：typedef`ShapeOrderAvailability`は`edit/ShapeOrderEditor.js`と同じ内容を持つ。形を変える場合は両方を揃える。
    *   **ツールバーの位置づけ**：頻繁に使う操作（削除・結合・取り消し/やり直し等）と、他のパレットの**呼び出し口**（開閉ボタン）を置く場所である（ビューのリセット・倍率・キャンバス名はステータスバー）。頻繁には使わない機能はパレットに分け、呼び出し口から開閉する。項目は`<div class="toolbar-group">`のまとまりごとに足し、既存のまとまりは変えない（`_doc/arch/01_index_html.md`）。
    *   **PaletteLauncher.js**：呼び出し口のボタンと開閉式パレットの対応づけと開閉。
        *   **公開メソッド**：なし（コンストラクタのみ）。
        *   **知らないこと**：パレットの中身・`WindowManager`。importを持たない。
        *   **呼び出し口の追加手順**：①`index.html`へ呼び出し口のボタン（ツールバー内の`.toolbar-group`）とパレットのDOM（`.float-window`。`hidden`で初期非表示。`.window-close-btn`を含むヘッダー）を静的に置く（`WindowManager`の検知のため）②`main.js`の対応表`paletteLaunchers`へ`{ button, palette }`の1エントリを追加する（`PaletteLauncher`の変更は不要）③パレットの中身の配線は、そのパレットのUI部品を`palette/`に新設して行う
    *   **CanvasPalette.js**：キャンバスパレット（一覧・新規作成・名前の変更・削除・ファイル操作（出力（作業ファイル）・出力（エンジン用）・開く・インポート）の呼び出し・保存状態とファイル操作の通知の表示）。操作と表示の規則はクラスJSDocを正とする。
        *   **公開メソッド**：`render`（引数は`CanvasFileOperations.getState()`の戻り値）・`confirmOpenUnsaved`（新しい記録を書けないときの確認の小窓。`main.js`が`CanvasLibrary`へ注入する）。
        *   **知らないこと**：`CanvasLibrary`・`VectorModel`・図形データ・IndexedDB。importを持たない。`File`は不透明に渡し、中身・名前を読まない。読み込みの判定・空の名前等の受理判定を持たない（`CanvasFileOperations`・`CanvasLibrary`側）。
        *   **契約**：一覧の並びは`CanvasLibrary`が決め、パレットは受け取った順に表示する。文言の対応表`ISSUE_MESSAGES`・`FILE_NOTICE_MESSAGES`はこのファイルが唯一の定義箇所。名前は`textContent`のみで設定し`innerHTML`は使わない（利用者の入力をHTMLとして解釈しないため）。`'unavailable'`でも出力（作業ファイル・エンジン用）・インポートは押せる（`busy`か読み込み中のみ`disabled`）。
        *   **二重定義**：typedef`CanvasLibraryState`は`CanvasLibrary.js`と、`FileNotice`は`CanvasFileOperations.js`と同じ内容を持つ。形を変える場合は両方を揃える。
