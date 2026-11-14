*   **palette/**：自己完結するUI部品。いずれもDOM操作専任で、`VectorModel`・図形データ・選択状態に関与しない（受け取るのは注入された値とコールバックのみ）。独自のカラーピッカーは未実装（色はブラウザ標準の`<input type="color">`）。ツールバー・ステータスバーは`index.html`の静的な要素。ツールバーの操作のボタンとステータスバーの配線は`main.js`、ツールバーのオプションバーのまとまりは`palette/`のUI部品（`OptionBarStyleGroup`・`OptionBarOrderGroup`）。ステータスバーでは、複数のボタンのまとまり（表示の切り替え・スナップ）は`palette/`のUI部品（`ViewToggleGroup`・`UnitSnapGroup`）、単独のボタン（⛶・🎯）と文字の表示（座標・大きさ・グリッド・倍率）は`main.js`（ツールバーにある🧰の配線も`main.js`）（Phase 07-03で決めた分け方）。
    *   **ToolPalette.js**：ツールパレット（`#window-tool-palette`）のツールのボタンの配線。
        *   **公開メソッド**：`setActiveTool`。
        *   **注入**：`main.js`がルート要素・ツールの識別子の一覧（`ToolRules`の`TOOL_IDS`）・`onToolSelected`（`selectTool`）を渡す。importは持たず、`InputTracker`・`ShapeFactory`・`ToolRules`へ直接依存しない。
        *   **契約**：ボタンはid規則`tool-${toolId}`で解決する。不整合（一覧にあるのにボタンが無い／一覧に無い`tool-`の要素）は`console.warn`で報告して、その要素を配線しない。照合はコンストラクタの1回のみ。`setActiveTool(toolId)`は一致する配線済みのボタン1つだけに`.active`を付け、他は外す（一致しなければ`null`を含めすべて外す）。ルート要素が無いと`console.warn`（`ToolPalette: ルート要素が見つかりません。配線しません。`）して何も配線しない（`setActiveTool`は何もしない）。操作モードの知識は持たない（押し込みにするツールは`main.js`が`ToolRules`で求めて渡す）。ウィンドウ全体を非活性にするクラスは無く、ツールパレットは常に押せる。`Tab`・ツールバーの🧰では他のフロートウィンドウとまとめて隠される（隠す仕組みは`index.html`のCSS（`body.float-windows-hidden .float-window`）と`main.js`で、本クラスは関与しない。`PaletteController`の`setEnabled`に当たるものは無い）。
    *   **DevPanel.js**：開発者向け確認用ウィンドウ（`#window-dev-panel`）。
        *   **公開メソッド**：`show`。
        *   **知らないこと**：作業データの中身。importを持たず、`VectorModel`・`InputTracker`・`DocumentSerializer`・図形インスタンスを参照しない（受け取るのは文字列と要約`ImportSummary`のみ）。
        *   **契約**：コールバックの例外は捕捉しない。`onImport`側の処理を増やす場合は例外を漏らさない（漏れると結果表示が更新されない）。
    *   **OptionBarStyleGroup.js**：オプションバーの「スタイル」のまとまり（`#option-style-group`）のDOMの配線（`render(view)`の表示と、利用者の操作のコールバックへの通知）。流れは3章13.。
        *   **公開メソッド**：`render`。
        *   **注入**：コンストラクタでまとまりのルート要素（`#option-style-group`）とコールバック6つ（`onStrokeToggle()`・`onFillToggle()`（ON/OFFのボタンの`click`。「押された」ことだけを通知し引数なし）・`onStrokeWidthChange(value)`（戻り値`false`なら表示を書き戻す）・`onColorInput(target, value)`・`onColorChange(target, value)`・`onColorEditEnd()`）を受け取る。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（`render`は何もしない）。`main.js`がコールバックを`ShapeStyleEditor`のメソッドへつなぐ。
        *   **知らないこと**：importを持たず、`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`・`StylePanelRules`を参照しない（受け取るのは`view`とコールバックのみ）。判定・変更の手順を持たない。
        *   **表示の規則の要点**：太さの欄はフォーカスがある間は書き換えない（打ち込み途中の値が`model.onChange`で消えないため）。値の確定が受理されなかったとき・欄から出たときは最後の`view`で書き戻す。色の欄は値が今の値と違うときだけ代入する（ピッカー操作中の再描画で同じ値を入れ直さないため）。ON/OFFのボタンは`aria-pressed`（`"true"`／`"false"`／`"mixed"`。`enabled`の`true`／`false`／`null`の写し）で表し、見た目はCSSが決める。色の欄を包む`.option-color-frame`の`data-color-note`（`mixed`・`unsupported`・なし。`colorNote`の写し）と色の欄の`title`を`colorNote`から決める（覆いと斜線の見た目はCSS）。`title`の文言（`COLOR_TITLE_TEXT`）と太さの欄の`placeholder`（「混在」）はこのファイルが唯一の定義箇所。「選択中：n個」「次に描く図形」の表示は持たない。
        *   **二重定義**：typedef`StylePanelView`は`edit/StylePanelRules.js`と同じ内容を持つ。形を変える場合は両方を揃える。
        *   **まとまりの足し方**：オプションバーはまとまり（`.toolbar-group`）ごとに1つのUI部品を持つ。まとまりを足すときは、`index.html`に`<div class="toolbar-group">`、`palette/`にそのまとまりのUI部品（自分のまとまりの要素をルート要素に受け取り、要素はルート要素内の`querySelector('#id')`で解決する）、`main.js`にまとまりのブロックを足すだけで、`OptionBarStyleGroup`・既存のまとまりを変えない。
    *   **ViewToggleGroup.js**：ステータスバーの表示の切り替えのまとまり（`#view-toggle-group`）の3ボタン（▢アウトライン`#view-outline-toggle`・◐背景`#view-background-toggle`・▦グリッド`#view-grid-toggle`）のDOMの配線（`render(view)`で押し込みを表示し、押下をコールバックへ通知）。流れは3章15.。
        *   **公開メソッド**：`render`。
        *   **注入**：コンストラクタでまとまりのルート要素とコールバック3つ（`onToggleOutline`・`onToggleBackground`・`onToggleGrid`）を受け取り、3ボタンはルート要素内の`querySelector`で解決する。コールバックが関数でなければ`Error`、要素が1つでも欠ければ`console.warn`して配線しない（`render`は何もしない）。`main.js`がコールバックを`displayState`の`toggleOutline`・`toggleBackground`・`toggleGrid`へつなぎ、`syncViewToggleGroup`が`displayState.getState()`を`render`へ渡す。
        *   **知らないこと**：importを持たず、`VectorModel`・図形データ・`DisplayState`（表示の状態の持ち主）・描画の規則を参照しない（受け取るのは`view`とコールバックのみ）。押し込みは`.active`で表し、`aria-pressed`は付けない（フォーカス中の`Space`をパンにするため。3章15.）。
        *   **二重定義**：typedef`ViewToggleView`（`outline`・`darkBackground`・`gridVisible`）は`core/DisplayState.js`の`DisplayStateSnapshot`の一部の写し。キー名を変える場合は両方を揃える。
    *   **UnitSnapGroup.js**：ステータスバーのスナップのまとまり（`#unit-snap-group`）の2ボタン（ON/OFFのボタン`#unit-snap-toggle`（🧲。仮）・単位のボタン`#unit-snap-unit-toggle`）のDOMの配線（`render(view)`でON/OFFの押し込みと単位のボタンの文字・`title`を表示し、押下をコールバックへ通知）。Phase 07-05で新設。流れは3章17.。`ViewToggleGroup`と同じ形。
        *   **公開メソッド**：`render`。
        *   **注入**：コンストラクタでまとまりのルート要素とコールバック2つ（`onToggleEnabled`・`onToggleUnit`）を受け取り、2ボタンはルート要素内の`querySelector`で解決する。コールバックが関数でなければ`Error`、要素が1つでも欠ければ`console.warn`して配線しない（`render`は何もしない）。`main.js`がコールバックを`unitSnapSettings`の`toggleEnabled`・`toggleUnit`へつなぎ、`syncUnitSnapGroup`が`unitSnapSettings.getState()`を`render`へ渡す。
        *   **知らないこと**：importを持たず、スナップの設定の持ち主（`UnitSnapSettings`）・丸めの規則（`UnitSnapRules`）・`VectorModel`・図形データを参照しない（受け取るのは`view`とコールバックのみ）。
        *   **表示の規則**：ON/OFFのボタンの押し込みは`.active`で表し、`aria-pressed`は付けない（フォーカス中の`Space`をパンにするため。3章15.）。単位のボタンは押し込みにせず、`textContent`に今の単位の数字（`String(view.unitStep)`）、`title`に`UNIT_TITLE_FORMATS`で作った文言（`スナップの単位: 1px`／`スナップの単位: グリッド (10px)`）を設定する（未知の単位は1pxの文言）。`UNIT_TITLE_FORMATS`は単位のボタンの`title`の**唯一の定義箇所**で、数値は`view.unitStep`から作る（単位の値の唯一の定義は`core/UnitSnapSettings.js`の`UNIT_SNAP_STEPS`）。`view`が無ければ押し込みを外すだけで文字・`title`は変えない。ON/OFFのボタンの押し込みの初期状態と、単位のボタンの文字・`title`は`index.html`に書かず、起動時の`syncUnitSnapGroup()`が付ける（ON/OFFのボタンの文字`🧲`と`title`は`index.html`にある）。
        *   **二重定義**：typedef`UnitSnapView`（`enabled`・`unit`・`unitStep`）は`core/UnitSnapSettings.js`の`UnitSnapSettingsSnapshot`の写し。キー名を変える場合は両方を揃える。`UNIT_TITLE_FORMATS`のキー（`'pixel'`・`'grid'`）は`UnitSnapUnit`の値の写し（`palette/`はimportを持たないため）。
        *   **テスト**：対象外（DOM。テストプレイで確かめる）。
    *   **OptionBarOrderGroup.js**：オプションバーの重なり順のまとまり（`#option-order-group`）の4ボタンのDOMの配線（`render(view)`で各ボタンの押せる/押せないを表示し、押下をコールバックへ通知）。流れは3章14.。
        *   **公開メソッド**：`render`。
        *   **注入**：コンストラクタでまとまりのルート要素とコールバック4つ（`onBringToFront`・`onBringForward`・`onSendBackward`・`onSendToBack`）を受け取る。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（`render`は何もしない）。`main.js`がコールバックを`performShapeOrder(ShapeOrderOperation.…)`へつなぐ。
        *   **知らないこと**：importを持たず、`VectorModel`・選択集合・図形データ・`ShapeOrderEditor`・規則・操作の値（`ShapeOrderOperation`）を参照しない（受け取るのは`view`とコールバックのみ）。
        *   **二重定義**：typedef`ShapeOrderAvailability`は`edit/ShapeOrderEditor.js`と同じ内容を持つ。形を変える場合は両方を揃える。
    *   **ツールバーの位置づけ**：頻繁に使う操作（削除・結合・取り消し/やり直し等）と、他のパレットの**呼び出し口**（開閉ボタン）を置く場所である。続けてオプションバー（選択中の図形・新しく描く図形のスタイルと重なり順）を置く（ビューのリセット・倍率・キャンバス名はステータスバー）。頻繁には使わない機能はパレットに分け、呼び出し口から開閉する。項目は`<div class="toolbar-group">`のまとまりごとに足し、既存のまとまりは変えない（`_doc/arch/01_index_html.md`）。
    *   **PaletteLauncher.js**：呼び出し口のボタンと開閉式パレットの対応づけと開閉。フロートウィンドウをまとめて隠している間の呼び出し口の規則も持つ。
        *   **公開メソッド**：なし（コンストラクタのみ）。
        *   **注入**：第1引数は対応表、第2引数`options = {}`は`{ isFloatWindowsVisible, showFloatWindows }`（表示中かの照会と、出す通知。既定は`() => true`・`() => {}`で、省略時は今までと同じ動き）。**第2引数は省略でき、関数でない値は`Error`ではなく`console.warn`して既定を使う**。これは`palette/`のUI部品の規約（コールバックが関数でなければ`Error`）の**例外**で、省略時に今と同じ動きにするための既定値を持つ引数だから（`PaletteLauncher`は以前から対応表の不正も`Error`ではなく`console.warn`で扱っている）。実体は`main.js`が`displayState.isFloatWindowsVisible()`・`displayState.setFloatWindowsVisible(true)`を注入する。
        *   **隠している間の📁の規則**：照会が偽（まとめて隠している）のとき、呼び出し口の`click`は`showFloatWindows()`で出したうえでパレットを必ず開く（隠す前に開いていた場合も閉じない）。真のときは今までどおり開閉を反転。`×`・対応表の形・起動時の`.active`の合わせ方は変えない。隠している間、📁の`.active`は各パレットの開閉の状態のまま。
        *   **知らないこと**：パレットの中身・`WindowManager`・表示の状態の持ち主（`DisplayState`。照会と通知だけを受け取る）。importを持たない。
        *   **呼び出し口の追加手順**：①`index.html`へ呼び出し口のボタン（ツールバー内の`.toolbar-group`）とパレットのDOM（`.float-window`。`hidden`で初期非表示。`.window-close-btn`を含むヘッダー）を静的に置く（`WindowManager`の検知のため）②`main.js`の対応表`paletteLaunchers`へ`{ button, palette }`の1エントリを追加する（`PaletteLauncher`の変更は不要）③パレットの中身の配線は、そのパレットのUI部品を`palette/`に新設して行う
    *   **CanvasPalette.js**：キャンバスパレット（一覧・新規作成・名前の変更・削除・ファイル操作（出力（作業ファイル）・出力（エンジン用）・開く・インポート）の呼び出し・保存状態とファイル操作の通知の表示）。操作と表示の規則はクラスJSDocを正とする。
        *   **公開メソッド**：`render`（引数は`CanvasFileOperations.getState()`の戻り値）・`confirmOpenUnsaved`（新しい記録を書けないときの確認の小窓。`main.js`が`CanvasLibrary`へ注入する）。
        *   **知らないこと**：`CanvasLibrary`・`VectorModel`・図形データ・IndexedDB。importを持たない。`File`は不透明に渡し、中身・名前を読まない。読み込みの判定・空の名前等の受理判定を持たない（`CanvasFileOperations`・`CanvasLibrary`側）。
        *   **契約**：一覧の並びは`CanvasLibrary`が決め、パレットは受け取った順に表示する。文言の対応表`ISSUE_MESSAGES`・`FILE_NOTICE_MESSAGES`はこのファイルが唯一の定義箇所。名前は`textContent`のみで設定し`innerHTML`は使わない（利用者の入力をHTMLとして解釈しないため）。`'unavailable'`でも出力（作業ファイル・エンジン用）・インポートは押せる（`busy`か読み込み中のみ`disabled`）。
        *   **二重定義**：typedef`CanvasLibraryState`は`CanvasLibrary.js`と、`FileNotice`は`CanvasFileOperations.js`と同じ内容を持つ。形を変える場合は両方を揃える。
