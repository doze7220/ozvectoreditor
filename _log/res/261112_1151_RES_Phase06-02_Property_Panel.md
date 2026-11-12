# RES: 作業計画・作業レポート (Phase 06-02) : プロパティパネル（図形の段）と既定の色
* 参照元REQ: `./_log/req/261112_1130_REQ_Phase06-02_Property_Panel.md`

## 1. 作業目的
選んでいる図形の線（色・太さ・有無）と塗り（有無・色）を画面から変えるプロパティパネル（フロートウィンドウ「プロパティ」の「図形」の段）を作り、新しく描く図形が「直前に使った値」を引き継ぐようにする。
* パネルでの変更は1件の編集操作として履歴に記録し、Undo1回・Redo1回で往復できるようにする（色の欄はピッカーを開いてから確定するまでを1件にまとめる）。
* チェックボックス・色の欄・太さの欄を操作している間に、キーボードショートカット（`Space`のパン、`Delete`、数字キー等）が誤って働かないようにする。
* 図形データの形・作業データの版（2）・書き出し形式の版（2）・`io/`は変えない。結合・描き足し・閉じるの結果のスタイルの規則（`shapes/PathJoinRules.js`）も変えない。
* 精度のPhaseで「頂点」の段を足せるよう、段ごとに見出しで区切り、段ごとにUI部品と配線を分ける2段構成を前提に作る（本サブフェイズでは「図形」の段だけ）。

## 2. アーキテクチャ設計
本計画で「スタイル」は図形の共通プロパティ`strokeColor`（色の文字列、または`null`＝線なし）・`strokeWidth`・`fillColor`（色の文字列、または`null`＝塗りなし）の3つを指す。「塗れる形」は`isFillable()`が真の図形（矩形・円・閉じたパス）であり、塗れるかの判定はすべて`isFillable()`を呼んで行う（規則を二重に書かない）。

### 全体の構成（モジュールの分担）
| 役割 | 置き場所 | 種類 |
| --- | --- | --- |
| 「直前に使った値」（新しく描く図形のスタイル）の保持、新しく描く図形（作成途中の図形を含む）への適用、選択中の図形のスタイルの書き換え（変更通知） | `js/core/VectorModel.js`（変更） | 既存クラスへの状態とメソッドの追加 |
| パネルに出す値の算出（そろっている値・混在・無効・表示する色）、色の文字列の表示用の変換、太さの入力の受理 | `js/edit/StylePanelRules.js`（新設） | 状態を持たない`export`した関数と定数のみ。DOMに触れない |
| パネルの変更の反映（選択中の図形への一括反映・塗れる形だけへの塗りの反映・直前に使った値の更新）と履歴の記録、色の欄のピッカー操作中の扱い、パネルが覚えている色の保持 | `js/edit/ShapeStyleEditor.js`（新設） | クラス。DOMに触れない |
| 「図形」の段のDOMの配線（表示と、利用者の操作のコールバックへの通知） | `js/palette/PropertyShapeSection.js`（新設） | `palette/`のUI部品。importを持たない |
| 「プロパティ」ウィンドウと「図形」の段のマークアップ・CSS（位置の根拠のコメント） | `index.html`（変更） | 静的に置く |
| 生成・注入・表示の同期の登録（`model.onChange`） | `js/main.js`（変更） | 配線ブロック`// 7.7.`の追加 |
| 入力欄の規則（チェックボックス・色の欄の操作中は`Space`のパンと`Ctrl`なしのショートカットを働かせない） | `js/core/InputTracker.js`（判定関数の追加とスペースパンの判定）・`js/core/KeyboardShortcuts.js`（受理判定の手順の追加） | 既存の判定関数`isTextInputElement`と同じ形の判定関数 |

**変更しないもの**：`js/core/ShapeFactory.js`・`js/core/HistoryManager.js`・`js/core/WindowManager.js`・`js/core/CanvasManager.js`・`js/core/ViewTransform.js`・`js/core/DragTracker.js`・`js/shapes/`の全ファイル（図形クラスのコンストラクタの既定値もそのまま）・`js/io/`・`js/check/`・`sprite-check.html`・既存の`js/edit/`のファイル・既存の`js/palette/`のファイル・既存のテストファイル（書き換えるケースは無い見込み）。

### 要件1: プロパティパネルの置き場所と構成
*   **ウィンドウ**：`index.html`に`<div id="window-property-panel" class="float-window">`を静的に置く（`hidden`を付けない＝常に表示。`WindowManager`は起動時にDOMにある`.float-window`だけを検知するため）。見出しはタイトル「プロパティ」のみで`×`ボタンは置かない（コントロールパネル・図形選択パレットと同じ扱い。`.window-header`の`min-height`で高さがそろう）。開閉の呼び出し口は作らない。ドラッグは`WindowManager`の既存の仕組みで動く（`.window-header`の押下）。
*   **`.disabled`は使わない**：ウィンドウ全体の非活性化クラスを付けない（`main.js`も付けない）。操作モードにかかわらず常に操作できる。塗りの欄の無効表示は各`input`の`disabled`属性で行う（`index.html`の約束「ボタン単体の押せない状態はHTMLの`disabled`属性」と同じ。`.disabled`と混用しない）。
*   **初期位置**（CSS。根拠を`#window-shape-palette`と同じ形のコメントで残す）：`#window-property-panel { top: 16px; right: 508px; width: 220px; }`。
    *   `right: 508px`＝開いた状態のキャンバスパレットの`right` 252px＋幅240px＋間隔16px。コントロールパネル・図形選択パレット（`right` 16px・幅220px＝右端から16〜236px）と開いた状態のキャンバスパレット（右端から252〜492px）とは横方向で離れているため、各ウィンドウの高さ（キャンバスパレットは一覧と通知で高さが変わる）によらず重ならない。
    *   上端16pxは他のウィンドウと同じ。パネルの高さは見出し約39px＋本体（余白24px＋見出し・表示行・3行・行間）で約200px、下端は約216pxで、画面の高さ800pxに収まる。
    *   `?dev`の確認用ウィンドウ（`left: 16px`・幅360px＝左端から376px）とは、画面幅が508＋220＋376＝1104px以上なら重ならない（1280px以上で重ならない。`?dev`とは重なってもよい条件だが重ならない）。
*   **2段構成**：
    *   ウィンドウの本体（`.window-body`）の中に、段ごとに`<section class="property-section">`を置き、各段の先頭に見出し`<h3 class="property-section-title">`を置く。本サブフェイズでは`<section id="property-shape-section">`（見出し「図形」）だけを置く。段の間の区切りは`.property-section + .property-section`（上の罫線と余白）のCSSで表し、今は1段のため効かない。
    *   段ごとにUI部品を1つ（`palette/`に1ファイル）、`main.js`の配線ブロックを1つ持つ。ウィンドウ自体を配線するクラスは作らない（ドラッグ・最前面化は`WindowManager`）。精度のPhaseで「頂点」の段を足すときは、`index.html`に`<section id="property-vertex-section">`を足し、`palette/`にその段のUI部品を新設し、`main.js`に段のブロックを足すだけで、`PropertyShapeSection`・既存の段のマークアップ・既存のブロックを変えない。
    *   各段のUI部品は自分の`<section>`をルート要素として受け取り、要素はルート要素内の`querySelector('#id')`で解決する（id規則：「図形」の段は`property-`で始め、段をまたいで重複させない）。
*   **「図形」の段の中身**（上から）：
    1.  表示の対象：`<div id="property-shape-source" class="property-source">`（「選択中：3個」／「次に描く図形」）
    2.  線の行：`<label class="property-toggle"><input type="checkbox" id="property-stroke-enabled"> 線</label>`・`<input type="color" id="property-stroke-color" title="線の色">`・`<span id="property-stroke-color-note" class="property-note"></span>`（「混在」等）
    3.  太さの行：`<label for="property-stroke-width" class="property-label">太さ</label>`・`<input type="number" id="property-stroke-width" min="1" max="100" step="1" title="線の太さ（1〜100の整数）">`・`<span class="property-unit">px</span>`
    4.  塗りの行：`<label class="property-toggle"><input type="checkbox" id="property-fill-enabled"> 塗り</label>`・`<input type="color" id="property-fill-color" title="塗りの色">`・`<span id="property-fill-color-note" class="property-note"></span>`
*   `index.html`には初期値（`checked`・`value`）を書かない（起動時に`main.js`が1回描画する。既定値を`index.html`へ二重に書かないため）。`.float-window`の`user-select: none`は変えず、太さの欄に限り`user-select: text`を指定する（`#dev-json`と同じ扱い）。

### 要件2: パネルの表示（何を表示するか）
*   **表示の内容**は`edit/StylePanelRules.js`の`buildStylePanelView({ selectedShapes, newShapeStyle, rememberedColors })`が求める（DOMに触れない純粋な関数）。`palette/PropertyShapeSection`の`render(view)`はその結果を表示するだけ。
*   **戻り値の形**（typedef`StylePanelView`）：
    ```
    {
      source: 'selection' | 'newShape',        // 選択中の図形を表示しているか・次に描く図形を表示しているか
      selectedCount: number,                    // 選択中の図形の数（newShapeでは0）
      stroke: { enabled: boolean|null, color: string, colorNote: '' | 'mixed' | 'unsupported', disabled: boolean },
      strokeWidth: number | null,               // null＝混在
      fill:   { enabled: boolean|null, color: string, colorNote: '' | 'mixed' | 'unsupported', disabled: boolean }
    }
    ```
    `enabled`の`null`は中間表示（`indeterminate`）、`color`は常に`#rrggbb`（小文字）の文字列で色の欄にそのまま入れる値、`colorNote`は色の欄の横の表示（`'mixed'`→「混在」、`'unsupported'`→「表示できない色」、`''`→なし）、`stroke.disabled`は常に`false`。
*   **図形を選んでいるとき**（`selectedShapes`が1個以上。描画順＝`model.getShapes()`の並びで渡す。重なり順で最も手前＝配列の最後）：`source: 'selection'`。
    *   線の有無：全図形の`strokeColor`が文字列→`true`、全図形が文字列でない（`null`）→`false`、混在→`null`。
    *   線の色：`strokeColor`が文字列の図形だけで決める。1つも無ければ`rememberedColors.stroke`（パネルが覚えている線の色）・`colorNote: ''`。あれば、その中で最も手前の図形の色を表示用に変換した値（変換できなければ`rememberedColors.stroke`）。`colorNote`は、色の文字列の種類が2つ以上（文字列としての完全一致で比べる）なら`'mixed'`、1つで変換できなければ`'unsupported'`、それ以外は`''`。
    *   太さ：線の有無にかかわらず全図形の`strokeWidth`で決める。すべて同じ（`===`）ならその値（小数もそのまま）、違えば`null`。
    *   塗り：**塗れる形（`isFillable()`が真）の図形だけ**で、線と同じ規則で有無と色を決める（`fillColor`、`rememberedColors.fill`）。塗れる形が1つも無ければ`fill.disabled: true`・`enabled: false`・`color: rememberedColors.fill`・`colorNote: ''`（塗れない形の`fillColor`は表示の判定に含めない。図形の`fillColor`は消さない）。塗れる形が1つでもあれば`disabled: false`。
*   **図形を選んでいないとき**（図形作成モード・キャンバス移動モード・キャンバスの読み込み中を含む）：`source: 'newShape'`・`selectedCount: 0`。直前に使った値（`newShapeStyle`）をそのまま表示する：`stroke.enabled = newShapeStyle.strokeEnabled`、`stroke.color`＝`newShapeStyle.strokeColor`を表示用に変換した値（変換できなければ`rememberedColors.stroke`）、`strokeWidth = newShapeStyle.strokeWidth`、塗りも同様（`fill.disabled: false`）、`colorNote`は`''`。
*   **色の文字列の表示用の変換**（`toColorInputValue(color)`。`<input type="color">`は`#rrggbb`しか表示できないため）：
    *   `#rrggbb`（16進6桁、大文字小文字を問わない）→小文字にした値。
    *   `#rgb`（16進3桁）→各桁を2回並べて展開した小文字の`#rrggbb`（例：`#F0a`→`#ff00aa`）。
    *   それ以外（`red`等の色名、`rgb(...)`、`#rrggbbaa`・`#rgba`、空文字、文字列でない値）→`null`（変換できない）。色名をCSSの規則で解釈するにはDOM（Canvasの`fillStyle`等）が要るため、DOMに触れないモジュールでは変換しない。変換できない色は、色の欄に「パネルが覚えている色」を表示し、欄の横に「表示できない色」と表示する（混在のときは「混在」を優先する）。
    *   いずれの場合も表示のために図形の値を書き換えない（利用者がその項目を操作したときだけ変わる）。
*   **パネルが覚えている色**（`rememberedColors`）：`ShapeStyleEditor`が保持する「色の欄に最後に表示した色」（線・塗りそれぞれ`#rrggbb`）。
    *   更新の規則：`ShapeStyleEditor.getPanelView()`がパネルに出す内容を求めるたびに、求めた`stroke.color`・`fill.color`を覚えている色にする（＝色の欄に表示する色が決まらないとき（選んでいる図形がすべて線なし・塗りなし・塗れない形だけ、変換できない色）は、直前まで表示していた色を表示し続ける）。`getPanelView()`は表示の同期（`model.onChange`）と`ShapeStyleEditor`の内部からだけ呼ぶ。
    *   初期値：起動時の直前に使った値の色（`model.getNewShapeStyle()`の`strokeColor`＝`#000000`・`fillColor`＝`#ffffff`）。
    *   要件「線ありの赤い図形を選んで線を『なし』にし、選択を変えずにすぐ『あり』に戻すと赤に戻る」：選択→表示で覚えている線の色が赤 →「なし」で図形の線が`null`、表示はすべて線なしのため覚えている赤を表示 →「あり」で表示中の赤を入れる。
    *   選択の変更：新しい選択の表示で、色が決まる項目は覚えている色が新しい表示の色になり、決まらない項目は直前の色のまま。色の欄で色を選ぶと、その色が表示され覚えている色になる。
*   **表示の同期**：`main.js`が`model.onChange`へ`syncPropertyShapeSection()`（`propertyShapeSection.render(shapeStyleEditor.getPanelView())`）を登録し、起動時にも1回呼ぶ。選択の変更・取り消し/やり直し（`replaceAllShapes`）・キャンバスの切り替え・図形の作成・削除・パネルでの変更（`updateShapeStyles`）・直前に使った値の変更（`updateNewShapeStyle`）はすべて`model.onChange`を通知するため、既存の経路だけで追従する。機能専用の再描画・同期処理・新しい通知の経路は足さない（直前に使った値を`VectorModel`に置く理由の1つ。要件6）。
*   **`render(view)`の表示の規則**（`PropertyShapeSection`）：
    *   表示の対象：`source`が`'selection'`なら`選択中：${selectedCount}個`、`'newShape'`なら`次に描く図形`。
    *   チェックボックス：`checked = (enabled === true)`、`indeterminate = (enabled === null)`、`disabled`は`view`のとおり（中間表示のチェックボックスを押すと「あり」になる）。
    *   色の欄：値が今の値と違うときだけ`value`へ代入する（ピッカーで色を動かしている間の再描画で同じ値を入れ直さないため）。`disabled`は`view`のとおり。欄の横の表示は`colorNote`の文言（`textContent`）。
    *   太さの欄：`strokeWidth`が`null`なら値を空にし`placeholder`を「混在」、数値ならその値（`String(strokeWidth)`）で`placeholder`を空にする。ただし太さの欄にフォーカスがある間（`document.activeElement`がその欄）は値を書き換えない（ホバー等の`model.onChange`で打ち込み途中の値が消えないため）。値の確定で受理されなかったとき・欄からフォーカスが外れたときは、最後に表示した内容（`#lastView`）で値を書き戻す。

### 要件3: パネルの操作（変えたときに何が起きるか）と履歴
*   **配線**：`PropertyShapeSection`は利用者の操作を注入されたコールバックへ渡すだけ。`main.js`はコールバックを`ShapeStyleEditor`のメソッドへつなぐだけ（判定を持たない）。
    | DOMのイベント | コールバック | `ShapeStyleEditor`のメソッド |
    | --- | --- | --- |
    | 線のチェックボックスの`change` | `onStrokeEnabledChange(checked)` | `setStrokeEnabled(enabled)` |
    | 塗りのチェックボックスの`change` | `onFillEnabledChange(checked)` | `setFillEnabled(enabled)` |
    | 太さの欄の`change`（`Enter`・欄から出たとき・矢印の操作）。`input`では何もしない | `onStrokeWidthChange(value)`（戻り値`false`なら`#lastView`で書き戻す） | `setStrokeWidth(text)` |
    | 色の欄の`input`（ピッカーで色を動かしている間） | `onColorInput(target, value)`（`target`は`'stroke'`/`'fill'`） | `previewColor(target, color)` |
    | 色の欄の`change`（ピッカーを閉じて確定） | `onColorChange(target, value)` | `commitColor(target, color)` |
    | 色の欄の`blur`・`keydown` | `onColorEditEnd()` | `finishColorPreview()` |
    | 太さの欄の`blur` | （コールバックなし） | `#lastView`で書き戻す（パネル内のみ） |
*   **反映の範囲**（`ShapeStyleEditor`。対象＝選択中の図形を描画順に並べたもの）：
    *   選択中の図形があるとき：変えた項目だけを対象に反映する（触っていない項目は図形ごとの値のまま）。線の有無・線の色・太さは選択中の全図形、塗りの有無・塗りの色は選択中の図形のうち`isFillable()`が真の図形だけ（塗れない形の`fillColor`は変えない）。あわせて直前に使った値の、変えた項目も更新する。
    *   選択中の図形が無いとき：直前に使った値だけを変える（図形を変えない。履歴にも記録しない）。キャンバスの読み込み中は図形0個・選択集合が空のため、必ずこちらになる（図形一式を変えない。専用の判定は持たない）。
*   **各操作の結果**（`model.updateShapeStyles`で図形のスタイルを、`model.updateNewShapeStyle`で直前に使った値を変える。図形への反映は`#recordEdit`で`beginEdit()`/`commitEdit()`の1件で挟む）：
    | 操作 | 選択中の図形がある | 直前に使った値 |
    | --- | --- | --- |
    | `setStrokeEnabled(false)` | 全図形の`strokeColor`を`null` | `strokeEnabled: false` |
    | `setStrokeEnabled(true)` | 全図形の`strokeColor`を、今表示している線の色（`getPanelView().stroke.color`。中間表示なら最も手前の線ありの図形の色、すべて線なしなら覚えている色） | `strokeEnabled: true`（色は変えない） |
    | `setFillEnabled(false/true)` | 塗れる形の図形の`fillColor`を`null`／今表示している塗りの色。塗れる形が1つも無ければ何もせず`false`を返す（直前に使った値も変えない） | `fillEnabled`（色は変えない） |
    | `setStrokeWidth(text)` | `parseStrokeWidthInput(text)`が`null`なら何もせず`false`。受理したら全図形（線なしの図形を含む）の`strokeWidth` | `strokeWidth` |
    | 色を選ぶ（線） | 全図形の`strokeColor`をその色（線なしの図形にも線が付く＝「あり」） | `strokeColor`とその色・`strokeEnabled: true` |
    | 色を選ぶ（塗り） | 塗れる形の図形の`fillColor`をその色。塗れる形が1つも無ければ何もせず`false` | `fillColor`とその色・`fillEnabled: true` |
    *   選択中の図形が無いときは、上の表の「直前に使った値」の列だけを行う（`setFillEnabled`も受理する）。
    *   戻り値：各メソッドは受理したか（`boolean`）を返す。
    *   前後で作業データが同じ（同じ色を選び直した・同じ太さ等）なら`HistoryManager.commitEdit`の既存の規則で記録されない。
*   **太さの受理**（`parseStrokeWidthInput(text)`）：引数が文字列で、前後の空白を除いて空でなく、`Number(text)`が整数（`Number.isInteger`）で`STROKE_WIDTH_MIN`（1）以上`STROKE_WIDTH_MAX`（100）以下ならその数値、それ以外は`null`。空・`0`・負・小数・100超・数値でない文字列・文字列でない値は`null`。`'1.0'`・`'1e1'`は数値として整数（1・10）のため受理する（`<input type="number">`の`value`の形）。受理しなかったときパネルは図形を変えずに欄を元の値（そろっていればその値、混在なら空欄）へ書き戻す。数値の入力欄の`min="1" max="100" step="1"`で上下の矢印は1ずつ・範囲内で増減する。
*   **見えない図形を作ることを許す**：線を「なし」にした結果、何も描かれなくなる図形になる操作もそのまま受け付ける（`ShapeStyleEditor`は判定しない）。選び方は変えない。
*   **履歴の単位**：
    *   チェックボックス1回・太さの確定1回：`#recordEdit`（`beginEdit()` → `model.updateShapeStyles(...)` → `commitEdit()`）の1件。直前に使った値の更新は`commitEdit()`の後に行う（履歴の対象外。スナップショットは作業データと選択集合だけのため、直前に使った値はもともと含まれない）。
    *   **色の欄（ピッカーを開いてから閉じるまでを1件）**：`input`の間は履歴を開かずに図形へ反映し、確定のときに1件として記録する（「後でまとめて記録する」方式）。編集操作を`input`から`change`まで開いたままにしないため、他の操作と開始・確定の対が崩れることが構造上ない。
        1.  `previewColor(target, color)`（`input`）：色を`toColorInputValue`で確かめ（変換できなければ`false`）、対象（線＝選択中の全図形、塗り＝その中の塗れる形）を求める。選択中の図形が無ければ直前に使った値だけを変えて終わる（記録しない）。ピッカー操作中の記録`#preview`が無ければ、`{ target, entries: [{ shape: 図形インスタンス, original: 開始時の色（文字列またはnull） }], color }`を作る。`#preview`が別の項目のもの、または対象の図形インスタンスの組が今の対象と違う（選択が変わった等）なら、先に`#finishPreview()`で確定してから作り直す。対象へ`model.updateShapeStyles`で色を入れ（記録しない。キャンバスにはすぐ表示される）、`#preview.color`を更新し、直前に使った値の色と有無を更新する。
        2.  `commitColor(target, color)`（`change`）：`previewColor(target, color)`の後に`#finishPreview()`。
        3.  `#finishPreview()`：`#preview`が無ければ何もしない。あれば`#preview`を先に`null`にし、記録した図形インスタンスがすべて今の`model.getShapes()`に（同じインスタンスとして）残っているかを確かめる。1つでも無ければ（取り消し/やり直し・キャンバスの切り替え・`?dev`の復元・削除等で入れ替わった）記録せずに捨てる（図形にも触れない）。残っていれば、開始時の色へ戻し（`model.updateShapeStyles`）→ `beginEdit()` → 最後の色を入れる → `commitEdit()`の1件として記録する（「前の状態」がピッカーを開く前の色になり、Undo1回でピッカーを開く前の色に戻る）。戻して入れ直す間に描画は同期的に行われるが、同じタスクの中のため画面には出ない。
        4.  確定の契機：`change`、色の欄の`blur`（`change`が来ないブラウザ・ピッカーを閉じずに別の場所を操作した場合。キャンバスや他の部品の押下でフォーカスが移ると来る）、色の欄の`keydown`（色の欄にフォーカスがあるまま`Ctrl`+`Z`等のショートカットを押したとき、`document`の`keydown`より先に色の欄で受けて確定する）、および`ShapeStyleEditor`の他の変更メソッド（`setStrokeEnabled`・`setFillEnabled`・`setStrokeWidth`・別の項目の`previewColor`）の冒頭。
        5.  確定の前に他の操作が起きた場合（`blur`・`keydown`の来ない操作。例：フォーカスを移さないボタンの押下、非同期に終わったファイルの読み込みによるキャンバスの切り替え）：他の操作の`beginEdit()`/`commitEdit()`・`undo()`/`redo()`・`clear()`は、`ShapeStyleEditor`が開いている編集操作が無いため対が崩れない（`console.warn`も出ない）。そのとき図形に入っていた色は、他の操作のスナップショットにそのまま含まれる。図形が入れ替わっていれば後の確定で捨てられる（その色の変化は履歴に残らない）。入れ替わっていなければ後の確定で1件として記録される（選択が変わっていても、記録した図形が対象）。
        6.  ピッカーが`blur`等で途中で確定された後に`input`が続いた場合は、新しい1件として扱う（ブラウザによっては1回のピッカーの操作が複数件に分かれることがある。懸念事項）。
*   **ドラッグ中の扱い**：パネルの変更は`inputTracker.isDragging()`では拒まない（`main.js`のコールバックも`ShapeStyleEditor`も判定しない）。**これはREQ要件3の「ドラッグ中はパネルの変更を受け付けない、または起こり得ないことを確かめる」のどちらにも当たらない、REQからの逸脱の判断である**（受け付けたうえで、起こり得る経路が1つ残る。逸脱の理由・残る経路・将来防ぐ場合の案は5章「REQからの逸脱：ドラッグ中のパネルの変更を受け付ける」）。
    *   拒まない理由：太さの欄に打ち込んで`Enter`を押さずにキャンバスを押すと、キャンバスの`mousedown`の処理（ドラッグのセッションの開始。閾値以前も`isDragging()`は真）の後にフォーカスが移り、そのとき`change`が来る。拒むと打ち込んだ太さが失われる。
    *   拒まなくても安全な理由：閾値以前の左ドラッグ・パンの間は、他の編集操作が開いていない（`InputTracker`の`beginEdit()`は閾値超過時）ため、パネルの変更の`beginEdit()`/`commitEdit()`はそのまま1件になる。閾値を超えた左ドラッグ（`InputTracker`が編集操作を開いている間）は、左ボタンを押したままで、パネルの部品はキャンバスの押下でフォーカスを失っているため、通常の操作ではパネルの変更は起こり得ない（中ボタンのパン中に左クリックでパネルを操作する場合は、パンが編集操作を開かないため安全）。キーボードの`Tab`でドラッグ中にパネルの部品へフォーカスを移して`Space`等を押す場合だけは起こり得る（5章「REQからの逸脱：ドラッグ中のパネルの変更を受け付ける」に記録。対は崩れるが`console.warn`のみで停止しない）。
*   **自動保存**：パネルの変更の記録（`commitEdit`）が`historyManager.onChange`を通知し、既存の自動保存の契機になる（パネル専用の保存処理は足さない）。直前に使った値の変更・ピッカー操作中の反映は保存の契機にならない（確定の記録で保存される）。

### 要件4: 新しく描く図形の既定のスタイル（直前に使った値）
*   **置き場所**：`VectorModel`が非公開の状態`#newShapeStyle`（typedef`NewShapeStyle`）として持つ。
    ```
    NewShapeStyle = { strokeEnabled: boolean, strokeColor: string, strokeWidth: number, fillEnabled: boolean, fillColor: string }
    ```
    有無と色を分けて持つ（「なし」にしても色の欄に直前の色を表示し、「あり」に戻すとその色が入るため）。
*   **既定（起動時の値）**：`VectorModel.js`の非公開の定数`DEFAULT_NEW_SHAPE_STYLE`（凍結）＝`{ strokeEnabled: true, strokeColor: '#000000', strokeWidth: 2, fillEnabled: false, fillColor: '#ffffff' }`。既定のまま描いた図形のスタイルはこれまでと同じ（線あり`#000000`・2px・塗りなし（`fillColor: null`））。
*   **公開メソッド**（`VectorModel`に追加）：
    *   `getNewShapeStyle()`：`#newShapeStyle`のコピーを返す。
    *   `updateNewShapeStyle(patch)`：`patch`のうち`NewShapeStyle`の5つのキー（自身のプロパティとして持つもの）だけを上書きする（他のキーは無視。値の検証はしない＝呼び出し側の責務）。値が1つでも変わった場合のみ、作成途中の図形があればそのスタイルも新しい値にしたうえで、変更を通知する（1回）。戻り値は値が変わったか（`boolean`）。
    *   `updateShapeStyles(changes)`：`changes`＝`Array<{ id: string, style: { strokeColor?, strokeWidth?, fillColor? } }>`（typedef`ShapeStyleChange`）。各idの図形へ、`style`が自身のプロパティとして持つ`strokeColor`・`strokeWidth`・`fillColor`だけを代入する（他のキーは無視。値の検証はしない）。存在しないidは無視する。1件以上の図形に代入した場合のみ変更を通知する（1回）。選択集合・ホバー・作成途中の図形・選択矩形・吸い付きの表示の点・直前に使った値には触れない。戻り値は代入した図形の数。
*   **新しく描く図形への適用**：`startDraft(x, y, type)`で`ShapeFactory.create(type, x, y, x, y)`の直後に、非公開の`#assignShapeStyle(shape, this.#toShapeStyle())`で作成途中の図形へスタイルを入れる（`#toShapeStyle()`＝`{ strokeColor: strokeEnabled ? strokeColor : null, strokeWidth, fillColor: fillEnabled ? fillColor : null }`）。確定（`commitDraft`）はそのインスタンスをそのまま登録するため、確定した図形も同じスタイルになる。塗れない形（直線・曲線・弧）も`fillColor`を持つ（描かれないが保持する）。作成途中に直前に使った値を変えた場合は`updateNewShapeStyle`が作成途中の図形へも入れるため、確定する図形は確定時点の直前に使った値になる。
*   **当てる場所を`VectorModel.startDraft`にした理由**：作成途中の図形を生成するのは`startDraft`だけで、`InputTracker`・`ShapeFactory`・図形クラスを変えずに済む（`InputTracker`は図形のスタイルを知らないまま。`ShapeFactory`は対応表の表引きのみのまま。図形クラスの共通メソッド契約は14メソッドのまま）。
*   **当てないもの**：貼り付け・複製・インポート・ファイルから開いた図形・取り消し/やり直し（いずれも`addShapesWithNewIds`・`replaceAllShapes`で図形データのスタイルのまま）。直線の描き終えで吸い付いた場合の描き足し・結合・閉じるの結果（作成途中の直線は捨てられ、`PathJoinRules`の基準の線Aのスタイルになる。06-01のまま）。
*   **保存しない・履歴の対象外・キャンバスごとに持たない**：`#newShapeStyle`は作業データ（`DocumentSerializer`は図形だけを変換）にもスナップショット（作業データ＋選択集合）にも含まれない。`replaceAllShapes`（取り消し/やり直し・キャンバスの切り替え・`?dev`の復元）は触れない。ページを開き直すと既定に戻る。
*   **「直前に使った値」の更新は`ShapeStyleEditor`（パネルの変更）からだけ**：図形を選んだだけでは変わらない（`getPanelView()`は直前に使った値を変えない）。
*   **線の太さ2pxの定義の整理**（`VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE`のJSDocに書く）：
    1.  `DEFAULT_NEW_SHAPE_STYLE.strokeWidth`（`core/VectorModel.js`）：新しく描く図形の既定の太さ（起動時の直前に使った値）の唯一の定義。
    2.  各図形クラスのコンストラクタの既定値`strokeWidth = 2`（`shapes/`）：残す。位置づけは「引数を省略して生成したときの値」（`ShapeFactory.create`はスタイルを渡さないが、`startDraft`が直後に直前に使った値で上書きするため、新しく描く図形の太さを決めない。テスト・既存の呼び出しが既定値に依存するため値も変えない。1.と同じ値である必要はない）。図形クラスのJSDocは「線の太さ」とだけ書いており「新しく描く図形の太さ」とは書いていないため直さない。
    3.  `shapes/ShapeDataValidation.js`の非公開定数`DEFAULT_STROKE_WIDTH`（読み込みで`strokeWidth`のキーが無いときの値）：変えない。ただしそのJSDoc（`js/shapes/ShapeDataValidation.js:18`）の「図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義」は、本計画の後は「新しく描く図形の太さ」の部分が実態と食い違う（新しく描く図形の太さは1.が決める）。`ShapeDataValidation.js`はREQで変更しない見込みのファイルのため本サブフェイズでは直さず、5章に記録し、開発資料に正しい位置づけを残す（「開発資料の更新予定」）。
    4.  `io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`（書き出し形式の読む側の既定値。3.と同じ値であるべき）：変えない。

### 要件5: 入力欄の操作中のキーボードショートカット
*   **太さの欄（`<input type="number">`）**：既存の`isTextInputElement`でテキスト入力扱い（`number`は`TEXT_INPUT_TYPES`に含まれる）。`Space`のパンとすべてのショートカットが働かない挙動を変えない（`Ctrl`+`Z`等はブラウザ標準の動作）。
*   **チェックボックス・色の欄**：判定関数`isSpaceOperatedInputElement(element)`を`core/InputTracker.js`に足してexportする（`isTextInputElement`と同じ形。`KeyboardShortcuts`と`InputTracker`のスペースパンが使う）。
    *   非公開の定数`SPACE_OPERATED_INPUT_TYPES = Object.freeze(['checkbox', 'color'])`（`Space`を部品自身の操作（チェックの切り替え・ピッカーを開く）に使い、テキスト入力ではない`input`の`type`）。`isSpaceOperatedInputElement(element)`は`element instanceof HTMLInputElement && SPACE_OPERATED_INPUT_TYPES.includes(element.type)`。
    *   **当てる範囲**：パネルの部品に限らず、`type`が`checkbox`・`color`の`input`全般とする（判定を部品のidに結びつけず、後から段を足しても同じ規則が当たるため）。現在のUIにこの2つの`type`の`input`はパネル以外に無いため、既存の要素（ボタン・非表示のファイル選択`input type="file"`・`?dev`のテキスト欄）にフォーカスがあるときの挙動は変わらない。`radio`・`range`等は使っていないため含めない（使うときに一覧への追加を検討する）。
    *   **`Space`**：`InputTracker`の`#handleSpaceKeyDown`は、`isTextInputElement`または`isSpaceOperatedInputElement`が真なら何もしない（パンしない・`preventDefault()`しない・押下状態にしない）。`handleKeyUp`は、どちらかが真なら`preventDefault()`しない（チェックボックスの切り替えは`keyup`で起きるため）。押下状態の解除は従来どおり常に行う（押下状態が残らない）。
    *   **`Ctrl`なしのショートカット**（`V`・`P`・`H`・数字キー・`J`・`Delete`・`Backspace`・`Escape`）：`KeyboardShortcuts`の`#handleKeyDown`で、対応表から見つけたエントリが`ctrl: false`で、`isSpaceOperatedInputElement(document.activeElement)`が真なら何もしない（`preventDefault()`もしない）。
    *   **`Ctrl`付きのショートカット**（取り消し・やり直し・全選択・コピー・切り取り・貼り付け・複製・表示のリセット・拡大・縮小）：従来どおり働く（ドラッグ中・キーリピートの規則も従来どおり）。
    *   **判定順序**（`#handleKeyDown`のJSDocを更新する）：1. IME変換中 → 2. テキスト入力中 → 3. 対応表から一致エントリを探す → **4. `ctrl: false`のエントリで、`Space`で操作する入力部品（チェックボックス・色の欄）にフォーカスがある → 何もしない（新設）** → 5. ドラッグ中 → 6. キーリピート → 7. 実行。`preventDefault()`の原則の「唯一の例外」の記述の手順番号（4・5→5・6）も改める。手順番号を参照する箇所は判定順序の列挙のほかに`KeyboardShortcuts.js`の`:59`（typedef`ShortcutActions`の`paste`）・`:145`・`:148`（`preventDefault()`の原則）・`:164`（行内コメント）があり、すべて改める（タスク5）。
*   **`KeyboardShortcuts`の有効/無効API**：足さない（判定関数で足りるため）。
*   **パネル専用のフォーカス制御**：足さない（フォーカスを外す方法は既存どおりキャンバスの左クリック等）。色の欄の`blur`・`keydown`の購読はピッカー操作中の記録の確定のためで、フォーカスを動かさない。
*   **自動テスト**：`isSpaceOperatedInputElement`は`HTMLInputElement`に依存し、Node.jsでは`HTMLInputElement`が無いため`node --test`で確かめられない（テストのためにソースを書き換えない）。テストプレイの確認項目に含める（5章）。

### 要件6: 責務の置き場所
*   **`InputTracker`へ入れない**：スタイルの変更・直前に使った値・パネルに出す値の算出は`InputTracker`に置かない。`InputTracker`の変更は要件5の判定関数の追加と、スペースパンの2箇所の判定（`#handleSpaceKeyDown`・`handleKeyUp`）に限る。要件4のための`InputTracker`の変更は無い（`startDraft`が直前に使った値を当てるため）。
*   **`palette/PropertyShapeSection`**：DOMの配線のみ。importを持たない。`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`を参照しない。受け取るのは`render(view)`の`view`（表示する内容）とコンストラクタのコールバックのみ。typedef`StylePanelView`は`edit/StylePanelRules.js`と同じ内容を持つ（二重定義。形を変える場合は両方を揃える）。
*   **直前に使った値を`VectorModel`に置く理由**：(1) 作成途中の図形を作る`startDraft`が使う。(2) 変更を既存の`model.onChange`で通知でき、パネルの表示の同期に新しい経路が要らない（3章「同期の経路」）。(3) 作業データ・スナップショットに含まれないため、保存しない・履歴の対象外・キャンバスを切り替えても変わらないが自然に満たされる。`VectorModel`の責務定義（ファイル先頭）に「新しく描く図形のスタイル（直前に使った値）」を足す。
*   **図形の共通プロパティの読み書きの位置づけ**：`strokeColor`・`strokeWidth`・`fillColor`は2章「図形（Shape）」の共通プロパティ（全図形クラスが同じ名前・同じ意味で持つ公開プロパティ）であり、図形固有のプロパティ（頂点の保持形式等）ではない。
    *   `VectorModel`は共通プロパティのスタイル3つだけを書く（`updateShapeStyles`・`startDraft`・`updateNewShapeStyle`の作成途中の図形）。「図形固有の頂点構造・内部プロパティ名を知らない」約束は変えない。
    *   `edit/StylePanelRules`・`edit/ShapeStyleEditor`は、`edit/`の「図形固有のプロパティ名を知らない」約束の例外として共通プロパティのスタイル3つを読む（`ShapeStyleEditor`は書き換えを`model.updateShapeStyles`へ渡すだけで、図形へ直接代入しない）。塗れるかは`isFillable()`（共通メソッド契約）を呼ぶ。図形種別の分岐は持たない。
    *   図形クラスにメソッドを足さない（共通メソッド契約は14メソッドのまま。`shapes/`を変えない）。
*   **`edit/`に置く理由**：`ShapeStyleEditor`は`VectorModel`と`HistoryManager`（`EditRecorder`）を注入で受け取り、選択中の図形一式を変える1件の編集操作の手順であり、`PathJoiner`等と同じ種類。`StylePanelRules`はその規則（`PathJoinRules`と`PathJoiner`の分け方に合わせる）。`palette/`はDOM専任・図形データに関与しないため置けない。依存方向：`main.js → edit/ShapeStyleEditor → edit/StylePanelRules`（`edit/`内）。`ShapeStyleEditor`のimportは`./StylePanelRules.js`のみ、`StylePanelRules`はimportを持たない（`edit/`の「importは`DocumentSerializer`のみ」の例外に加える）。`core/`は`edit/`をimportしない（`VectorModel`は`StylePanelRules`を知らない）。
*   **`ShapeFactory`**：変えない（対応表の表引きのみのまま）。
*   **`main.js`**：配線ブロック`// 7.7.`（プロパティパネル）を`// 7.6.`の後・`// 8.`の前に足す（生成2つ・コールバック6つ・`syncPropertyShapeSection`・`model.onChange`への登録）。起動時の同期に`syncPropertyShapeSection()`を足す。判定ロジックは持たない。**配線ブロックの切り出しは行わない**：理由：足すのは約40行で`applyMode`・`viewTransform`等への依存の受け渡しを伴わない独立したブロックであり、`02_main.md`が切り出しの候補とする`// 7.6.`とは無関係のため。行数は約630行になる見込み（`02_main.md`の行数を更新する）。

### 要件7: 自動テスト
`_doc/arch/16_test.md`の規則（置き場所と命名・`node:test`と`node:assert/strict`のみ・公開APIのみ・テストのためにソースを書き換えない・画面の操作や描画のテストは行わない）に従う。
*   **新設**：
    *   `test/core/VectorModel.style.test.js`：直前に使った値（既定値・コピーを返すこと・`updateNewShapeStyle`の部分更新と通知（変わらなければ通知しない・未知のキーは無視）・`replaceAllShapes`で変わらないこと）、新しく描いた図形への適用（`SHAPE_TYPES`の全種別で、既定のまま／変えた後の作成途中の図形と確定した図形のスタイル。塗れない形も`fillColor`を持つこと。作成途中に変えると作成途中の図形も変わること）、`updateShapeStyles`（指定したキーだけ・指定した図形だけ・存在しないidの無視・通知1回・0件なら通知しない・スタイル以外のキーを無視・選択集合に触れない）。
    *   `test/edit/StylePanelRules.test.js`：`buildStylePanelView`（選択なし、1個選択、複数選択で値がそろっている／そろっていない（有無・色・太さ）、線なしの図形を含む選択の線の色、すべて線なし、塗れない形だけの選択（塗りの欄が無効）、塗れる形と塗れない形の混在（塗りの値は塗れる形だけで決まる）、最も手前の図形の色が描画順で決まること、`#rgb`・変換できない色・小数の太さ、引数を書き換えないこと）、`toColorInputValue`、`parseStrokeWidthInput`（1以上100以下の整数のみ受理し、空・0・負・小数・100超・数値でない入力は受理しない）。図形は実物の図形クラスで作る。
    *   `test/edit/ShapeStyleEditor.test.js`：実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeStyleEditor`を組み合わせる（`16_test.md`の例外に加える。表示の同期の代わりに`model.onChange(() => editor.getPanelView())`を登録して`main.js`と同じ呼び方にする）。一括反映（変えた項目だけ・他の項目は不変）、塗りは塗れる形だけ（塗れない形の`fillColor`は保持）、「なし」が`null`、色を選ぶと「あり」、太さが線なしの図形にも反映、1回の変更が履歴1件（Undo・Redoの往復）、前後が同じなら記録されない、色の欄の`input`の連続が1件にまとまる（Undo1回でピッカーを開く前の色）、確定前に別の操作が起きたときの扱い（他の変更・選択の変更・`replaceAllShapes`による入れ替え・`finishColorPreview`で、`console.warn`が出ないこと）、選択なしの変更が図形・履歴を変えず直前に使った値だけを変えること、赤に戻る要件、塗れない形だけの選択で`setFillEnabled`が`false`、太さの不正な入力で`false`。直前に使った値（要件4・要件7「パネルで変えた項目だけの更新」）：(1) 図形を選んでいるときにパネルで変えると、変えた項目だけが直前に使った値に入ること（`setStrokeEnabled(true)`は`strokeEnabled`だけを変え`strokeColor`を変えない、`setStrokeEnabled(false)`・`setFillEnabled`は有無だけ、`setStrokeWidth`は`strokeWidth`だけ、色を選ぶ（`previewColor`・`commitColor`）と色と有無（線＝`strokeColor`・`strokeEnabled`、塗り＝`fillColor`・`fillEnabled`）だけ。他のキーは`getNewShapeStyle()`で変わらないことを確かめる）。(2) 図形を選ぶだけ（`setSelection`）・`getPanelView()`を呼ぶだけでは直前に使った値が変わらないこと（線の色・太さ・塗りが既定と違う図形を選んで`getPanelView()`を呼んでも`getNewShapeStyle()`が既定のまま）。
*   **既存のテストの扱い**：書き換えるケースは無い見込み（`ShapeFactory`・図形クラスを変えず、`startDraft`の既定のスタイルはこれまでと同じのため）。書き換えが必要になった場合は、テストファイル・ケース名・理由を「4. 詳細作業内容」に列挙する。
*   **テストしないもの**：`isSpaceOperatedInputElement`と`InputTracker`・`KeyboardShortcuts`の入力欄の規則（`HTMLInputElement`に依存）、`PropertyShapeSection`（DOM）、`main.js`の配線、`index.html`。テストプレイで確かめる。

### 要件8: テストプレイの準備と確認項目
*   テストプレイ用のファイル（`#rrggbb`以外の色の文字列を持つ図形、小数の太さの図形等）は現場設計AIがテストプレイ時に用意する。実装AIは作成しない（リポジトリに含めない）。
*   確認項目は5章「テストプレイで確認すべき項目」に、操作手順と期待する結果の形で列挙する。

### 要件9: 開発資料への記載
「開発資料の更新予定」に列挙し、最終タスク（タスク10）で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/core/` - `VectorModel`（直前に使った値・スタイルの書き換え）、`InputTracker`（入力欄の判定関数・スペースパン）、`KeyboardShortcuts`（受理判定）
    *   `./js/edit/` - `StylePanelRules`（新設。パネルに出す値の算出の規則）、`ShapeStyleEditor`（新設。スタイルの変更の手順）
    *   `./js/palette/` - `PropertyShapeSection`（新設。プロパティパネルの「図形」の段のDOM）
    *   `./index.html`・`./js/main.js` - ウィンドウと配線
    *   `./test/core/`・`./test/edit/` - 自動テスト（新設3ファイル）
*   **関連する論理クラス**: `VectorModel`（SSOT）、`ShapeStyleEditor`（DOMに触れない手順のクラス）、`StylePanelRules`（関数群）、`PropertyShapeSection`（UI部品）、`HistoryManager`（`EditRecorder`として注入。変更しない）、`SnapshotAdapter`（テストで組み合わせる。変更しない）、図形クラス（`isFillable()`と共通プロパティを使う。変更しない）、`WindowManager`（ウィンドウのドラッグ。変更しない）
*   **新設のファイル**：`js/edit/StylePanelRules.js`・`js/edit/ShapeStyleEditor.js`・`js/palette/PropertyShapeSection.js`・`test/core/VectorModel.style.test.js`・`test/edit/StylePanelRules.test.js`・`test/edit/ShapeStyleEditor.test.js`。

### 参照する責務
（`PROJECT_ARCHITECTURE.md`と`_doc/arch/`からの抜粋。以後のタスク実行は、この項目を責務の情報源とする）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`をimportしない。`shapes/`は`core/`・`io/`をimportしない。`edit/`のimportは`DocumentSerializer`のみが原則（例外：`PathJoiner`→`shapes/PathJoinRules`、`EndpointSnapper`→`shapes/EndpointSnapRules`・`shapes/PathJoinRules`、`CanvasFileOperations`→`io/`の一部）。他の依存（`VectorModel`・`HistoryManager`等）は注入で受け取る。本作業で`ShapeStyleEditor`→`./StylePanelRules.js`の例外を足す。
*   **同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、モードと図形種別は`applyMode`・`applyShapeType`）のみで行う。機能専用の再描画・同期処理を足さない。
*   **`VectorModel.js`**：描画データ（Shape配列）と、選択集合・ホバー状態・作成中図形・選択矩形・吸い付きの表示の点を保持する単一の真実（SSOT）。状態を変更するAPIは変更後に`onChange`の登録リスナーへ通知する。**知らないこと**：図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式・`DocumentSerializer`。再編集・追従は図形の`setVertex`/`translate`/`updateDraftEnd`へポリモーフィックに委譲、生成は`ShapeFactory.create`へ委譲。`replaceAllShapes`は選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示の点をクリアし、通知は1回。選択集合は選択モード以外では空（不変条件。`setMode`がクリアする）。`getSelectedIds()`は`#shapes`の並び順（描画順）。importは`ShapeFactory`のみ。
*   **図形（Shape）**：共通プロパティ`type`・`id`・`strokeColor`（色の文字列、または`null`＝線なし）・`strokeWidth`・`fillColor`（色の文字列、または`null`＝塗りなし）。塗れる形は`rect`・`circle`・閉じた`path`で、公開メソッド`isFillable()`が返す（データに保存しない。塗れるかの規則はこのメソッドだけに置く）。`fillColor`は塗れない形でも保持し、塗れる形のときだけ描く。線なしで塗れない形の図形は何も描かれないがデータとして受理し、従来どおり選べる。図形クラスのコンストラクタは`(…, strokeColor = '#000000', strokeWidth = 2, fillColor = null)`（`Ellipse`は`shapeType`の後、`Path`は`(points, closed, …)`）。共通基底クラスは無く、14メソッド契約を各クラスが自律実装する（メソッドを増減する場合は5クラスのクラスJSDocを揃える）。
*   **`ShapeFactory.js`**：図形種別一覧の正本と生成・復元の振り分け。対応表の表引きのみでif/switch分岐を持たない。`SHAPE_TYPES`の並び＝図形パレットのボタン順＝数字キーの割り当て順＝`VectorModel.startDraft`の既定値（先頭）。本作業では変えない。
*   **`InputTracker.js`**：ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知、カーソル形状。**知らないこと**：図形種別（if/switch分岐をしない）、`HistoryManager.js`のimport、ショートカットの解釈。exportに`isTextInputElement`（スペースパンとショートカットの誤爆防止）。`keydown`は`Space`を`InputTracker`（スペースパン）、それ以外を`KeyboardShortcuts`が排他的に担当、`keyup`は`Space`のみ`InputTracker`が購読。状態に依存しない操作を`InputTracker`へ足さない（肥大化防止）。図形の作成の記録は`handleClick`の`DRAWING`確定時に`commitDraft()`を`beginEdit()`/`commitEdit()`で挟む。左ドラッグの記録は閾値超過時に開始し、ドラッグの終了・中断の共通後始末で確定。`isDragging()`はドラッグのセッション中（パン・左ドラッグ。閾値以前を含む）。
*   **`KeyboardShortcuts.js`**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみ。判定順序と`preventDefault()`の規則は`#handleKeyDown`のJSDocを正とする。`InputTracker.js`からは定数`OperationMode`/`SHAPE_TYPES`と関数`isTextInputElement`のみをimportする（本作業で`isSpaceOperatedInputElement`を足す）。`keyup`は購読しない。公開メソッドなし（`main.js`はインスタンスを保持しない）。ショートカット専用のUI同期を持たない。
*   **`HistoryManager.js`**：`beginEdit()`はその時点のスナップショットを「前の状態」として保持（確定されていない編集操作があると`console.warn`して上書き）。`commitEdit()`は前後の作業データの`JSON.stringify`が一致すれば記録しない（`false`）、違えば1件記録して`onChange`を通知。`undo()`/`redo()`は冒頭で確定されていない編集操作があれば`console.warn`して破棄。`clear()`は記録中の編集操作も破棄（`CanvasLibrary`の切り替え処理のみが呼ぶ）。スナップショットは`{ document: 作業データ, selectedIds }`（取得・適用は`edit/SnapshotAdapter`）。`onChange`は`main.js`のボタン同期と`CanvasLibrary`の自動保存の契機。**記録の規則**：変更処理を`beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録はしない。
*   **`edit/`**：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。**知らないこと（全クラス共通）**：DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、操作モード。`InputTracker`に依存しない。`EditRecorder`（typedefは`edit/ShapeInserter.js`。`beginEdit()`・`commitEdit()`）を注入で受け取る。前提（選択モード・ドラッグ中でない等）は呼び出し側の責務。`try/catch`を持たない。
*   **`palette/`**：自己完結するUI部品。DOM操作専任で、`VectorModel`・図形データ・選択状態に関与しない（受け取るのは注入された値とコールバックのみ）。importを持たない。既存の部品の作法：要素はルート要素内の`querySelector('#id')`で解決し、要素が欠ければ`console.warn`して配線しない／コールバックが関数でなければ`Error`を投げる（`CanvasPalette`）。文字は`textContent`で設定し`innerHTML`を使わない。
*   **`main.js`**：インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶ連携。**判定ロジック・作業データの中身の解釈を持たない**。表示の同期関数（`syncDeleteButtonState`等）を`model.onChange`等へ登録し、起動時にも明示的に1回呼ぶ（`index.html`の初期記述や通知に依存させない）。配線ブロックはコメント番号の順（`// 1.`〜`// 9.`）。`HistoryManager`は`InputTracker`より先に生成。
*   **`index.html`**：スタイルは`<style>`に内包。配置・見た目はマークアップとCSSコメントを正とする。フロートウィンドウ全体の非活性化は`.disabled`、ボタン単体の押せない状態はHTMLの`disabled`属性で表し混用しない。`#window-shape-palette`の`top`はコントロールパネルの下端との余白の根拠をCSSコメントに残している。コントロールパネル・図形選択パレットには`×`が無い（見出しはタイトルのみ。`.window-header`の`min-height`で高さをそろえる）。読み込み中の覆い要素（`z-index: 5`）はフロートウィンドウ（10以上）より背面で、読み込み中もフロートウィンドウは操作できる。
*   **`WindowManager.js`**：`.float-window`要素の検知（コンストラクタ実行時点でDOMに存在する要素のみ）と、`.window-header`のドラッグ移動・最前面化・イベント遮断（ウィンドウ内の`mousedown`・`click`・`mousemove`・`mouseup`の伝播を止める）。図形データ・選択状態・操作モードを知らない。
*   **読み込み完了前の操作**：起動直後は空のキャンバスで、覆い要素がキャンバスへのマウス入力を遮る。キーボードショートカットとフロートウィンドウ上のボタンは働く。読み込み中は図形0個・選択集合が空のため図形一式を変えない。図形一式を変える操作を新しく足す場合は読み込み中の扱いが要る（本作業：選択集合が空のため直前に使った値だけを変える）。
*   **`test/`**：`node:test`・`node:assert/strict`のみ。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc（`@param`・`@returns`）。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止（警告が出ないことを確かめる場合は呼び出し回数を見る）。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換えるのが原則で、実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`を組み合わせてよいのは許された例外のみ（本作業で`test/edit/ShapeStyleEditor.test.js`を例外に加える）。図形の`id`は公開プロパティ`id`へ文字列を直接代入して設定する（`VectorModel`を使う場合は`replaceAllShapes`で入れてよい）。補助関数は各テストファイルの中に書く。実行はプロジェクトのルートで`node --test`（引数なし）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映はタスク10で行う。各タスクで判明した追加は末尾へ追記する）
*   **`PROJECT_ARCHITECTURE.md` 1章**
    *   フォルダ構造に`js/edit/StylePanelRules.js`・`js/edit/ShapeStyleEditor.js`・`js/palette/PropertyShapeSection.js`、`test/core/VectorModel.style.test.js`・`test/edit/StylePanelRules.test.js`・`test/edit/ShapeStyleEditor.test.js`を足す。
    *   「存在しないもの」から「画面から線・塗りを変える操作（プロパティパネル。Phase 06-02）」を削除し、「カラーピッカー」を「独自のカラーピッカー（色はブラウザ標準の`<input type="color">`）」へ改める。「プロパティパネルの『頂点』の段（精度のPhase）」「直前に使った値の保存・キャンバスごとの既定の色」を足す。
    *   「フォルダ分割の方針」の`edit/`に「選択中の図形のスタイルの変更（プロパティパネル）」を足す。`palette/`の説明に「プロパティパネルは段ごとに1つのUI部品」を足す。依存方向の例外に`edit/ShapeStyleEditor`→`edit/StylePanelRules`（`edit/`内）を足す。
*   **`PROJECT_ARCHITECTURE.md` 2章**
    *   「図形（Shape）」：共通プロパティのスタイル3つを`VectorModel`が書き（`updateShapeStyles`・`startDraft`）、`edit/StylePanelRules`・`ShapeStyleEditor`が読むこと（図形固有のプロパティではないため、各モジュールの「図形固有のプロパティ名を知らない」約束の例外として扱う）。`isFillable()`の「Phase 06-02の塗りの欄の無効表示…で外から使う予定」を「06-02のプロパティパネル（`StylePanelRules`・`ShapeStyleEditor`）が使う。06-03で内側の当たり判定に使う予定」へ。
    *   新しい項「新しく描く図形のスタイル（直前に使った値）」：`VectorModel`が保持（`NewShapeStyle`の5項目・有無と色を分けて持つ理由）、既定値（線あり`#000000`・2・塗りなし・塗りの色`#ffffff`）、`startDraft`で作成途中の図形へ当てる（作成途中に変えると作成途中の図形も変わる）、更新はパネルの変更からだけ（図形を選んだだけでは変わらない）、保存しない・履歴の対象外・キャンバスを切り替えても変わらない（作業データ・スナップショットに含まれず`replaceAllShapes`も触れない）、貼り付け・複製・インポート・開く・取り消し/やり直し・結合等の結果には当てない。
    *   「色・太さの読み込み」の「図形クラスのコンストラクタの`strokeWidth = 2`（新しく描く図形の太さ）とも別の定義」を、線の太さ2pxの定義の整理の結果（要件4の4つの定義と位置づけ）へ改める。あわせて、記載基準「JSDocが実コードと食い違う項目を見つけたら、JSDocが直るまで正しい記述をここに残す」により、`js/shapes/ShapeDataValidation.js:18`の`DEFAULT_STROKE_WIDTH`のJSDoc「図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義」が実態と食い違うこと（同ファイルは本サブフェイズで変更しない）と、正しい位置づけ（新しく描く図形の既定の太さは`core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE.strokeWidth`、コンストラクタの既定値は引数を省略して生成したときの値で新しく描く図形の太さを決めない）を書く。
    *   「作業データ形式」の「保存対象は図形データのみ」・「キャンバス記録」の「保存しないもの」に、新しく描く図形のスタイル（直前に使った値）を足す。
*   **`PROJECT_ARCHITECTURE.md` 3章**
    *   「同期の経路」：プロパティパネルの表示は`model.onChange`で同期すること（直前に使った値の変更も`model.onChange`で通知される）。
    *   1.「読み込み完了前の操作」：プロパティパネルは読み込み中も操作でき、選択集合が空のため直前に使った値だけを変える（図形一式を変えない。専用の判定は無い）。
    *   3.「キーボード操作」：入力欄の規則（テキスト入力扱いの`input`（太さの欄を含む）はスペースパンとすべてのショートカットが働かない。`type`が`checkbox`・`color`の`input`にフォーカスがあるときは`Space`のパンをせず`preventDefault()`もしない（部品の標準動作）・`Ctrl`なしのショートカットは働かない・`Ctrl`付きは働く。判定は`InputTracker.js`の`isTextInputElement`・`isSpaceOperatedInputElement`）。
    *   6.「記録する操作と時点」に「プロパティパネルの変更（`ShapeStyleEditor`）：チェックボックス・太さは`model.updateShapeStyles`の前後。色の欄はピッカー操作中は記録せず図形へ反映し、確定（`change`・`blur`・`keydown`・他の変更）のときに開始時の色へ戻してから`beginEdit` → 最後の色 → `commitEdit`の1件（図形が入れ替わっていれば捨てる）」を足す。「記録しない操作」に「直前に使った値の変更、選択中の図形が無いときのパネルの変更」を足す。
    *   新しい節13.「プロパティパネル（図形の段）」：モジュールの分担（`PropertyShapeSection` → `main.js` → `ShapeStyleEditor` → `StylePanelRules`・`VectorModel`・`HistoryManager`）、表示の流れ（`model.onChange` → `getPanelView()` → `render`）、反映の範囲（線・太さは選択中の全図形、塗りは塗れる形だけ、選択なしは直前に使った値だけ）、パネルが覚えている色の規則、色の欄の履歴の単位と確定の契機・確定前に他の操作が起きたときの扱い、ドラッグ中に拒まない理由と安全な理由（REQ要件3の「受け付けない、または起こり得ない」から外れる判断であること・残る経路（閾値を超えた左ドラッグ中に`Tab`でパネルへフォーカスを移して操作した場合）と将来防ぐ場合の案）、発注者の決定（混在の表示・塗りは塗れる形だけで決め塗れる形だけへ反映・「あり」は表示中の色・太さは1〜100の整数・見えない図形を許す・直前に使った値はパネルで変えたときだけ更新し保存しない）、2段構成（段の足し方）、やらないこと（頂点の段・透明度・独自のカラーピッカー・スポイト・直前に使った値の保存）。
*   **`_doc/arch/01_index_html.md`**：プロパティパネル`#window-property-panel`（静的に置き常に表示・`×`なし・`.disabled`を使わない・位置の根拠はCSSコメント・初期値を書かない）、2段構成（段ごとの`<section class="property-section">`と見出し、id規則`property-`、段の足し方）、塗りの欄の無効表示は`input`の`disabled`属性。
*   **`_doc/arch/02_main.md`**：配線ブロック`// 7.7.`（プロパティパネル）、注入の一覧に`ShapeStyleEditor`（`model`・`editRecorder`＝`historyManager`）・`PropertyShapeSection`（`onStrokeEnabledChange`/`onFillEnabledChange`/`onStrokeWidthChange`/`onColorInput`/`onColorChange`/`onColorEditEnd`→`shapeStyleEditor`の`setStrokeEnabled`/`setFillEnabled`/`setStrokeWidth`/`previewColor`/`commitColor`/`finishColorPreview`）、主な関数に`syncPropertyShapeSection`、起動時の同期、同一経路の原則（パネルのコールバックは`shapeStyleEditor`のメソッドを呼ぶのみ・ドラッグ中を判定しない理由は3章13.）、行数と切り出しを行わなかった理由。
*   **`_doc/arch/03_VectorModel.md`**：公開メソッドに`getNewShapeStyle`・`updateNewShapeStyle`・`updateShapeStyles`、責務に新しく描く図形のスタイル、「知らないこと」に「共通プロパティのスタイル3つ（`strokeColor`・`strokeWidth`・`fillColor`）は書く（図形固有のプロパティではない）」、`replaceAllShapes`は新しく描く図形のスタイルに触れないこと、`startDraft`がスタイルを当てること。
*   **`_doc/arch/06_InputTracker.md`**：exportに`isSpaceOperatedInputElement`、スペースパンの入力欄の規則（`#handleSpaceKeyDown`・`handleKeyUp`）。
*   **`_doc/arch/07_KeyboardShortcuts.md`**：`InputTracker.js`からのimportに`isSpaceOperatedInputElement`、`Space`で操作する入力部品にフォーカスがあるときは`ctrl: false`のエントリを実行しない（判定順序の手順4）。
*   **`_doc/arch/08_HistoryManager.md`**：`beginEdit`/`commitEdit`の呼び出し元に`ShapeStyleEditor`（プロパティパネル。`EditRecorder`として注入）を足す。
*   **`_doc/arch/12_shapes.md`**：`isFillable()`の「Phase 06-02（塗りの欄の無効表示）…で外から使う予定」を、06-02で`edit/StylePanelRules`・`ShapeStyleEditor`が使うことへ。コンストラクタの既定値（`strokeWidth = 2`等）は引数を省略したときの値で、新しく描く図形のスタイルは`VectorModel`が当てること。`ShapeDataValidation.js`の項があれば、`DEFAULT_STROKE_WIDTH`のJSDoc（`:18`）の「新しく描く図形の太さ」の記述が実態と食い違うこと（JSDocが直るまでの正しい位置づけは`PROJECT_ARCHITECTURE.md`2章「色・太さの読み込み」）。
*   **`_doc/arch/13_palette.md`**：冒頭の「カラーピッカー・ツールバーは未実装」を「ツールバー・独自のカラーピッカーは未実装（色はブラウザ標準の`<input type="color">`）」へ。`PropertyShapeSection.js`の項（公開メソッド`render`、注入（コールバック6つと戻り値の契約）、知らないこと（importなし・`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`）、表示の規則の要点（太さの欄にフォーカスがある間は書き換えない・受理されなければ書き戻す・色の欄は値が違うときだけ代入）、typedef`StylePanelView`の二重定義）。プロパティパネルの段の足し方。
*   **`_doc/arch/14_edit.md`**：`StylePanelRules.js`の項（公開：`STROKE_WIDTH_MIN`・`STROKE_WIDTH_MAX`・`toColorInputValue`・`parseStrokeWidthInput`・`buildStylePanelView`、読むもの：共通プロパティのスタイル3つと`isFillable()`、importなし、DOMに触れない）、`ShapeStyleEditor.js`の項（公開メソッド、呼び出し元は`main.js`のパネルのコールバックと表示の同期、依存（`model`は`getShapes`・`isSelected`・`getNewShapeStyle`・`updateNewShapeStyle`・`updateShapeStyles`、`editRecorder`）、契約（ピッカー操作中の記録・確定・捨てる条件、ドラッグ中を判定しない、`getPanelView`が覚えている色を更新する））。「知らないこと（全クラス共通）」の「図形固有のプロパティ名」の例外（`StylePanelRules`・`ShapeStyleEditor`は共通プロパティのスタイル3つを読む）と、「依存」のimportの例外（`ShapeStyleEditor`→`./StylePanelRules.js`）。
*   **`_doc/arch/16_test.md`**：新設3ファイルと検証範囲、実物の組み合わせの例外に`test/edit/ShapeStyleEditor.test.js`（実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeStyleEditor`）、テストできない箇所に`isSpaceOperatedInputElement`と入力欄の規則（`HTMLInputElement`に依存）・`PropertyShapeSection`・`main.js`のパネルの配線（テストプレイで確かめる）。

## 3. タスクリスト
**全タスク共通の作業**（各タスクで必ず行う）
*   新設・変更したクラス・メソッド・関数・定数・プロパティ・typedefにJSDoc（`@param`・`@returns`・`@throws`・型）を書き、既存のJSDocの記述（責務・判定順序・公開APIの列挙）を新しい内容へ改める。新設の`.js`ファイルの先頭行には単一責務のJSDoc（3行以内）を書く。新しいテストの補助関数にもJSDocを書く。
*   タスクの完了時にプロジェクトのルートで`node --test`を実行し、`fail 0`であることと`tests`・`pass`・`fail`の件数を「4. 詳細作業内容」に記録する（着手前の件数：tests 780・pass 780・fail 0）。
*   既存のテストケースは書き換えない見込み。書き換えが避けられない場合は、テストファイル・ケース名・理由を「4. 詳細作業内容」に列挙する。
*   開発資料の記載に影響があれば、資料本体は直さず「開発資料の更新予定」へ追記する。迷った点・目視確認を推奨する点・将来の注意は「5. 懸念事項」へ追記する。
*   完了後、本RESの該当タスクを`[x]`にし、「4. 詳細作業内容」を記入する。

*   [x] タスク1: `VectorModel`の直前に使った値・新しく描く図形への適用・スタイルの書き換え
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
        *   `./test/core/VectorModel.style.test.js` : 新規
    *   **作業内容** :
        *   2章 要件4のとおり：非公開の定数`DEFAULT_NEW_SHAPE_STYLE`（凍結。JSDocに線の太さ2pxの4つの定義と位置づけを書く）・`NEW_SHAPE_STYLE_KEYS`（5つ）・`SHAPE_STYLE_KEYS`（`strokeColor`・`strokeWidth`・`fillColor`）、typedef`NewShapeStyle`・`ShapeStyleChange`、非公開のフィールド`#newShapeStyle`（コンストラクタで`DEFAULT_NEW_SHAPE_STYLE`のコピーで初期化）。
        *   公開メソッド`getNewShapeStyle()`・`updateNewShapeStyle(patch)`（戻り値`boolean`）・`updateShapeStyles(changes)`（戻り値は代入した図形の数）を足す。非公開の`#toShapeStyle()`・`#assignShapeStyle(shape, style)`（`style`が自身のプロパティとして持つ`SHAPE_STYLE_KEYS`だけを代入）を足す。`startDraft`は`ShapeFactory.create`の直後に`#assignShapeStyle(draft, #toShapeStyle())`する（`ShapeFactory.create`の呼び方は変えない）。
        *   JSDoc：ファイル先頭の責務定義に「新しく描く図形のスタイル（直前に使った値）」を足す（3行以内）。クラスJSDocに、直前に使った値を保持すること・共通プロパティのスタイル3つだけを書くこと（図形固有のプロパティ名は知らない）を足す。`startDraft`（スタイルを当てる）・`replaceAllShapes`（新しく描く図形のスタイルには触れない）・コンストラクタ（初期状態）のJSDocを改める。`updateNewShapeStyle`・`updateShapeStyles`のJSDocに、値を検証しないこと（呼び出し側の責務）・通知の条件・触れない状態を書く。
        *   テスト（新設。先頭行に責務のJSDoc）：2章 要件7の`test/core/VectorModel.style.test.js`の観点。`SHAPE_TYPES`は`../../js/core/ShapeFactory.js`からimportする。作成途中の図形は`getDraftShape()`、確定した図形は`commitDraft()`後の`getShapes()`で、`strokeColor`・`strokeWidth`・`fillColor`を確かめる（既定のまま：`'#000000'`・`2`・`null`。変えた後の例：`strokeEnabled: false`・`strokeWidth: 5`・`fillEnabled: true`・`fillColor: '#ff0000'`で`null`・`5`・`'#ff0000'`（直線・曲線・弧も`'#ff0000'`））。

*   [x] タスク2: パネルに出す値の算出の規則（`edit/StylePanelRules.js`）
    *   **対象ファイル** :
        *   `./js/edit/StylePanelRules.js` : 新規
        *   `./test/edit/StylePanelRules.test.js` : 新規
    *   **作業内容** :
        *   2章 要件2・要件3のとおり：`export const STROKE_WIDTH_MIN = 1`・`STROKE_WIDTH_MAX = 100`、`export function toColorInputValue(color)`・`parseStrokeWidthInput(text)`・`buildStylePanelView({ selectedShapes, newShapeStyle, rememberedColors })`。線と塗りの有無・色の決め方は非公開の関数1つにまとめて共有する（引数：対象の図形の配列・プロパティ名・覚えている色）。importを持たない。DOMに触れない。引数を書き換えない。`try/catch`を持たない。図形種別の分岐を持たず、塗れるかは`isFillable()`を呼ぶ。
        *   JSDoc：先頭行の責務（例：「プロパティパネルの『図形』の段に出す値の算出（そろっている値・混在・無効・表示する色）と、色の文字列の表示用の変換・線の太さの入力の受理を担う。状態を持たずDOMに触れない」）。typedef`StylePanelView`（2章 要件2の形と各値の意味）・`RememberedColors`（`{ stroke: string, fill: string }`）。各関数の規則（要件2の「図形を選んでいるとき」「図形を選んでいないとき」「色の文字列の表示用の変換」、要件3の「太さの受理」）を`@param`・`@returns`とともに書く。読むのは図形の共通プロパティ`strokeColor`・`strokeWidth`・`fillColor`と`isFillable()`だけであること（`edit/`の約束の例外）。
        *   テスト（新設）：2章 要件7の`test/edit/StylePanelRules.test.js`の観点。図形は実物の`Line`・`Curve`・`Rect`・`Ellipse`（`'circle'`・`'arc'`）・`Path`（開いた・閉じた）をコンストラクタのスタイルの引数で作る。

*   [x] タスク3: スタイルの変更の手順（`edit/ShapeStyleEditor.js`）
    *   **対象ファイル** :
        *   `./js/edit/ShapeStyleEditor.js` : 新規
        *   `./test/edit/ShapeStyleEditor.test.js` : 新規
    *   **作業内容** :
        *   2章 要件2（パネルが覚えている色）・要件3のとおり：`export class ShapeStyleEditor`。コンストラクタ`constructor({ model, editRecorder })`。非公開：`#model`・`#editRecorder`・`#rememberedColors`（`model.getNewShapeStyle()`の`strokeColor`・`fillColor`で初期化）・`#preview`（`null`または`{ target, entries: [{ shape, original }], color }`）。
        *   色の項目の対応表（非公開・凍結）：`stroke`＝`{ shapeKey: 'strokeColor', enabledKey: 'strokeEnabled', selectTargets: (shapes) => shapes }`、`fill`＝`{ shapeKey: 'fillColor', enabledKey: 'fillEnabled', selectTargets: (shapes) => shapes.filter((shape) => shape.isFillable()) }`（直前に使った値の色のキーは`shapeKey`と同じ名前）。項目による分岐はこの表引きで行う。表に無い`target`は受理しない（`false`）。
        *   公開メソッド：`getPanelView()`（`buildStylePanelView`の結果を返し、`stroke.color`・`fill.color`を`#rememberedColors`にする）、`setStrokeEnabled(enabled)`・`setFillEnabled(enabled)`（共通の非公開メソッドで実装）、`setStrokeWidth(text)`、`previewColor(target, color)`、`commitColor(target, color)`、`finishColorPreview()`。変更メソッドは冒頭で`#finishPreview()`を呼ぶ（`previewColor`は要件3の条件のときだけ）。非公開：`#selectedShapes()`（`model.getShapes()`のうち`model.isSelected(id)`が真のもの。描画順）、`#finishPreview()`、`#recordEdit(apply)`（`beginEdit()` → `apply()` → `commitEdit()`）。各操作の結果・戻り値・履歴の単位・確定の契機・捨てる条件は2章 要件3の表と手順のとおり。`model`は`getShapes`・`isSelected`・`getNewShapeStyle`・`updateNewShapeStyle`・`updateShapeStyles`だけを使う。importは`./StylePanelRules.js`のみ。DOMに触れない。`try/catch`を持たない。ドラッグ中・操作モードを判定しない。
        *   JSDoc：先頭行の責務（例：「プロパティパネルの変更を、選択中の図形（塗りは塗れる形だけ）と直前に使った値へ反映する編集操作と、色の欄のピッカー操作中の記録の確定、パネルが覚えている色の保持を担う。DOMに触れない」）。クラスJSDocに依存の制約（importは`./StylePanelRules.js`のみ・注入で受け取るもの・知らないこと：DOM・図形種別の分岐・操作モード・`InputTracker`。共通プロパティのスタイル3つは読む）、前提（ドラッグ中を判定しない理由は2章 要件3）、ピッカー操作中の記録の方式（開いたままの編集操作を持たないこと）、`getPanelView`は表示の同期と本クラスの内部からだけ呼ぶこと。各メソッドの`@param`・`@returns`（受理したか）。
        *   テスト（新設）：2章 要件7の`test/edit/ShapeStyleEditor.test.js`の観点。補助関数で実物の`VectorModel`（`replaceAllShapes`で図形を入れ、`setSelection`で選ぶ）・`SnapshotAdapter`（`shouldRestoreSelection: () => true`）・`HistoryManager`・`ShapeStyleEditor`を組み合わせ、`model.onChange(() => editor.getPanelView())`を登録する。履歴は`canUndo`・`undo`・`redo`と図形の`toJSON()`で確かめ、件数は`undo()`を繰り返して確かめる。`console.warn`は`t.mock.method`で置き換え、確定前に別の操作が起きるケースで呼ばれないこと（`mock.calls.length === 0`）を確かめる。直前に使った値の観点として、次の2点を必ず含める：(1) 選択中にパネルで変えたとき、変えた項目だけが直前に使った値に入ること（例：`setStrokeEnabled(true)`は色を変えない、太さは`strokeWidth`だけ、色を選ぶと色と有無。変えていないキーは`getNewShapeStyle()`で前の値のまま）。(2) 選ぶだけ（`setSelection`）・`getPanelView()`だけでは直前に使った値が変わらないこと（要件4「図形を選んだだけでは変わらない」）。

*   [ ] タスク4: 入力欄の判定関数とスペースパン（`InputTracker`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   2章 要件5のとおり：`TEXT_INPUT_TYPES`・`isTextInputElement`の直後に、非公開の定数`SPACE_OPERATED_INPUT_TYPES = Object.freeze(['checkbox', 'color'])`と`export function isSpaceOperatedInputElement(element)`を足す。`#handleSpaceKeyDown`は`isTextInputElement(document.activeElement) || isSpaceOperatedInputElement(document.activeElement)`なら何もせず戻る。`handleKeyUp`は同じ条件が偽のときだけ`preventDefault()`する（押下状態の解除・カーソルの再評価は従来どおり常に行う）。他の処理は変えない。
        *   JSDoc：`SPACE_OPERATED_INPUT_TYPES`（含める`type`と理由、含めない`type`の例、パネル以外にこの`type`の`input`が無いこと）、`isSpaceOperatedInputElement`（用途：スペースパンとショートカットの誤爆防止、`@param`・`@returns`）。`isTextInputElement`のJSDocの「含めないtypeの例」に、`checkbox`・`color`は`isSpaceOperatedInputElement`で別に扱うことを足す。`#handleSpaceKeyDown`・`handleKeyUp`のJSDocを新しい条件へ改める。
        *   自動テストは足さない（`HTMLInputElement`に依存しNode.jsで確かめられない。2章 要件5）。`node --test`が従来どおり成功することを確かめる。

*   [ ] タスク5: チェックボックス・色の欄の操作中の`Ctrl`なしのショートカット（`KeyboardShortcuts`）
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新
    *   **作業内容** :
        *   2章 要件5のとおり：`./InputTracker.js`からのimportに`isSpaceOperatedInputElement`を足す。`#handleKeyDown`で、`#findBinding`でエントリが見つかった直後に「`binding.ctrl`が偽で`isSpaceOperatedInputElement(document.activeElement)`が真なら何もせず戻る（`preventDefault()`しない）」を足す。他の手順・対応表は変えない。
        *   JSDoc：ファイル先頭の責務定義の受理判定の列挙に「`Space`で操作する入力部品（チェックボックス・色の欄）の操作中」を足す（3行以内）。`#handleKeyDown`の判定順序を1〜7へ改め（新しい手順4。ドラッグ中＝手順5、キーリピート＝手順6、実行＝手順7）。`preventDefault()`しない場合の列挙に新しい手順を足す。
        *   手順番号の付け替え：古い番号（ドラッグ中＝手順4、キーリピート＝手順5）を参照する次の箇所をすべて新しい番号へ改める（計画時の`Grep`で特定。行番号は計画時点のもの）。
            *   `:59`：typedef`ShortcutActions`の`paste`の「ドラッグ中は受理判定（`#handleKeyDown`の手順4）によりそもそも呼ばれない」→「手順5」。
            *   `:145`：`preventDefault()`の原則の「唯一の例外：ctrl: trueのエントリが、ドラッグ中（手順4）またはキーリピート（手順5）で実行されなかった場合は」→「ドラッグ中（手順5）またはキーリピート（手順6）」。
            *   `:148`：「ctrl: falseのエントリが手順4・5で実行されなかった場合はpreventDefault()もしない」→「手順5・6」（新しい手順4でも`preventDefault()`しないことは、`preventDefault()`しない場合の列挙に足す）。
            *   `:164`：`#handleKeyDown`内の行内コメント「手順4・5：ドラッグ中、またはリピート不可エントリのキーリピートは実行しない」→「手順5・6」。新しい手順4の判定の直前にも行内コメント「手順4：…」を置く。
            *   上の4箇所と判定順序の列挙のほかに古い番号の参照が無いことを、作業後に`Grep`（`手順`）で確かめる（`js/`内の他のファイルには`#handleKeyDown`の手順番号の参照は無いことを計画時に確認済み）。
        *   自動テストは足さない（同上）。`node --test`が従来どおり成功することを確かめる。

*   [ ] タスク6: プロパティパネルの「図形」の段のUI部品（`palette/PropertyShapeSection.js`）
    *   **対象ファイル** :
        *   `./js/palette/PropertyShapeSection.js` : 新規
    *   **作業内容** :
        *   2章 要件1〜3のとおり：`export class PropertyShapeSection`。`constructor(sectionElement, actions)`：`actions`の6つ（`onStrokeEnabledChange`・`onFillEnabledChange`・`onStrokeWidthChange`・`onColorInput`・`onColorChange`・`onColorEditEnd`）が関数でなければ`Error`を投げる。要素（`#property-shape-source`・`#property-stroke-enabled`・`#property-stroke-color`・`#property-stroke-color-note`・`#property-stroke-width`・`#property-fill-enabled`・`#property-fill-color`・`#property-fill-color-note`）を`sectionElement.querySelector`で解決し、1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない）。2章 要件3の配線の表のとおりにイベントを購読する（色の欄の`target`は`'stroke'`・`'fill'`）。
        *   公開メソッド`render(view)`：2章 要件2「`render(view)`の表示の規則」のとおり。最後に表示した内容を`#lastView`に保持し、太さの欄の書き戻しに使う。文言の対応（`colorNote`→「混在」・「表示できない色」・空、太さの`placeholder`「混在」、表示の対象「選択中：n個」・「次に描く図形」）は本ファイルの非公開の定数を唯一の定義箇所とする。文字は`textContent`で設定する。
        *   importを持たない。`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`を参照しない。`.disabled`クラスを使わない。
        *   JSDoc：先頭行の責務（例：「プロパティパネルの『図形』の段（`#property-shape-section`）の表示と、利用者の操作（線・塗りの有無、太さ、色）のコールバックへの通知を担う。図形データ・選択状態には関与しない」）。typedef`StylePanelView`（`edit/StylePanelRules.js`と同じ内容。二重定義である旨）・`PropertyShapeSectionActions`（各コールバックの引数・呼ばれる契機・`onStrokeWidthChange`の戻り値`false`で書き戻すこと）。クラスJSDocに段の構成（段ごとに1部品、ルート要素は自分の`<section>`、後から段を足しても本クラスを変えないこと）。
        *   本タスクの時点では`index.html`・`main.js`から使われない（画面は変わらない）。`node --test`が従来どおり成功することを確かめる。

*   [ ] タスク7: プロパティパネルのウィンドウ（`index.html`）
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   2章 要件1のとおり：`#window-canvas-palette`の後・`#window-dev-panel`の前に`<div id="window-property-panel" class="float-window">`（見出し「プロパティ」・`×`なし）と、本体の`<section id="property-shape-section" class="property-section">`（見出し`<h3 class="property-section-title">図形</h3>`と2章 要件1の4つの行）を置く。`hidden`・`.disabled`・初期値（`checked`・`value`）は付けない。
        *   CSS（`<style>`内）：`#window-property-panel { top: 16px; right: 508px; width: 220px; }`と、位置の根拠のコメント（2章 要件1。`#window-shape-palette`のコメントと同じ形：各ウィンドウの位置・幅と、重ならない理由、`?dev`の確認用ウィンドウと重ならない画面幅の見積もり）。`.property-section`（縦並び・行間）・`.property-section + .property-section`（段の間の上の罫線と余白。今は効かない旨のコメント）・`.property-section-title`（`margin: 0`・文字の大きさ）・`.property-source`・`.property-row`（横並び・中央揃え・間隔）・`.property-toggle`・`.property-label`・`.property-note`（小さい文字・色）・`.property-unit`、太さの欄の幅と`user-select: text`、色の欄の大きさ。既存のウィンドウ・クラスのCSSは変えない。
        *   本タスクの時点では配線されない（パネルは表示されドラッグできるが、操作しても何も起きない）。既存の操作がこれまでどおりできること、`node --test`が成功することを確かめる。

*   [ ] タスク8: プロパティパネルの配線（`main.js`）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   2章 要件2・要件3・要件6のとおり：`ShapeStyleEditor`（`./edit/ShapeStyleEditor.js`）と`PropertyShapeSection`（`./palette/PropertyShapeSection.js`）をimportする。`// 7.6.`のブロックの後・`// 8.`の前に`// 7.7. プロパティパネル（「図形」の段）配線`を足す：`const shapeStyleEditor = new ShapeStyleEditor({ model, editRecorder: historyManager });`、`const propertyShapeSection = new PropertyShapeSection(document.getElementById('property-shape-section'), { onStrokeEnabledChange: (enabled) => shapeStyleEditor.setStrokeEnabled(enabled), onFillEnabledChange: (enabled) => shapeStyleEditor.setFillEnabled(enabled), onStrokeWidthChange: (text) => shapeStyleEditor.setStrokeWidth(text), onColorInput: (target, color) => shapeStyleEditor.previewColor(target, color), onColorChange: (target, color) => shapeStyleEditor.commitColor(target, color), onColorEditEnd: () => shapeStyleEditor.finishColorPreview() });`、関数`syncPropertyShapeSection()`（`propertyShapeSection.render(shapeStyleEditor.getPanelView())`）、`model.onChange(syncPropertyShapeSection);`。起動時の同期の並び（`syncHistoryButtonState();`の後、キャンバス名の同期の前）に`syncPropertyShapeSection();`とその理由のコメントを足す。
        *   コールバックは`shapeStyleEditor`のメソッドを呼ぶだけ（判定を持たない。`isDragging()`を見ない理由は3章13.へ記載予定のためコメントで1行触れる）。ブロックの先頭コメントに、表示と変更の分担（`ShapeStyleEditor`・`PropertyShapeSection`）、同期は`model.onChange`のみであること、段を足すときは段ごとのブロックを足すこと（既存の段の配線を変えない）を書く。配線ブロックの切り出しは行わない（理由は2章 要件6。「4. 詳細作業内容」に行数とともに記録する）。
        *   JSDoc：`syncPropertyShapeSection`（何を何に同期するか・登録先・起動時にも1回呼ぶこと）。
        *   完了後、`node --test`が成功することを確かめる。

*   [ ] タスク9: JSDocの記載漏れの確認
    *   **対象ファイル** :
        *   タスク1〜8で新設・変更したファイル : 確認（記載漏れがあれば該当ファイルのJSDocのみ修正）
    *   **作業内容** :
        *   新設・変更したクラス・メソッド・関数・定数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、注入するコールバックの契約（`PropertyShapeSectionActions`・`ShapeStyleEditor`のコンストラクタの依存）、新設ファイルの先頭行の責務定義（3行以内）、`VectorModel`・`KeyboardShortcuts`の責務定義の更新、`#handleKeyDown`の判定順序、typedef`StylePanelView`の二重定義（`StylePanelRules.js`と`PropertyShapeSection.js`）が一致していることを確かめる。図形クラスにはメソッドを足していないため、クラスJSDocの共通メソッド契約の列挙は変わらない（14メソッドのまま）ことを確かめる。
        *   `Grep`で、`js/`内に「新しく描く図形の太さ」等の古い位置づけの記述が残っていないか確かめる（変更対象外のファイルに残る記述は直さず5章に記録する。`js/shapes/ShapeDataValidation.js:18`は計画時に特定して5章・「開発資料の更新予定」に記録済み。それ以外に見つかった場合だけ追記する）。
        *   `js/core/KeyboardShortcuts.js`で、`#handleKeyDown`の判定順序の手順番号を参照する箇所すべて（判定順序の列挙、typedef`ShortcutActions`の`paste`の「`#handleKeyDown`の手順N」、`preventDefault()`の原則の「唯一の例外」と「`ctrl: false`のエントリが手順N・Mで実行されなかった場合」、`#handleKeyDown`内の行内コメント「手順N・M」）が新しい番号（ドラッグ中＝手順5、キーリピート＝手順6、実行＝手順7）にそろっていることを`Grep`（`手順`）で確かめる。

*   [ ] タスク10: 開発資料への反映（最終タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・2章・3章）
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/03_VectorModel.md` : 更新
        *   `./_doc/arch/06_InputTracker.md` : 更新
        *   `./_doc/arch/07_KeyboardShortcuts.md` : 更新
        *   `./_doc/arch/08_HistoryManager.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   2章「開発資料の更新予定」（各タスクで追記された内容を含む）を、`PROJECT_ARCHITECTURE.md`冒頭の記載基準（残す：責務・境界・依存方向・複数モジュールにまたがる流れと順序の保証・誰が呼ぶか・誰が注入するか・設計判断の理由・やらないと決めたこと・未実装のもの・公開メソッド名の一覧／書かない：1ファイルのJSDocで分かること）に従って反映する。4章の一覧は、新設のファイルが既存のまとまり（`edit/`・`palette/`）に属するため行を足さない（該当の`_doc/arch/`ファイルへ書く）。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、本タスクのみREQにより明示的な例外とする（後続タスクが無く、他タスクの前提が動かないため）。個別の実装タスク内では資料を書き換えない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `VectorModel`の直前に使った値・新しく描く図形への適用・スタイルの書き換え
*   **作業内容** :
    *   `js/core/VectorModel.js`：非公開定数`DEFAULT_NEW_SHAPE_STYLE`（凍結。JSDocに線の太さ2pxの4つの定義）・`NEW_SHAPE_STYLE_KEYS`・`SHAPE_STYLE_KEYS`、typedef`NewShapeStyle`・`ShapeStyleChange`、非公開フィールド`#newShapeStyle`を追加。公開メソッド`getNewShapeStyle()`・`updateNewShapeStyle(patch)`・`updateShapeStyles(changes)`、非公開`#toShapeStyle()`・`#assignShapeStyle()`を追加。`startDraft`は`ShapeFactory.create`の直後にスタイルを当てる。ファイル先頭の責務・クラスJSDoc・`startDraft`・コンストラクタ・`replaceAllShapes`のJSDocを更新。
    *   `test/core/VectorModel.style.test.js`：新規（18ケース。SHAPE_TYPES全種別の既定／変更後の適用を含む）。
    *   既存テストの書き換え：なし。
    *   `node --test`：tests 798・pass 798・fail 0（着手前780＋新規18）。

### タスク2: パネルに出す値の算出の規則（`edit/StylePanelRules.js`）
*   **作業内容** :
    *   `js/edit/StylePanelRules.js`：新規。`STROKE_WIDTH_MIN`(1)・`STROKE_WIDTH_MAX`(100)、`toColorInputValue`・`parseStrokeWidthInput`・`buildStylePanelView`をexport。線と塗りの有無・色・補足の決め方は非公開関数`resolveColorView(shapes, key, remembered)`に共有、選択なしの表示は非公開`newShapeColorView`。typedef`StylePanelView`・`StylePanelColorView`・`ColorNote`・`RememberedColors`・`PanelNewShapeStyle`。importなし・DOMなし・図形種別分岐なし（塗れるかは`isFillable()`）。
    *   `test/edit/StylePanelRules.test.js`：新規（20ケース）。
    *   既存テストの書き換え：なし。
    *   `node --test`：tests 818・pass 818・fail 0（着手前798＋新規20）。

### タスク3: スタイルの変更の手順（`edit/ShapeStyleEditor.js`）
*   **作業内容** :
    *   `js/edit/ShapeStyleEditor.js`：新規。`export class ShapeStyleEditor`（`constructor({ model, editRecorder })`）。公開：`getPanelView`・`setStrokeEnabled`・`setFillEnabled`・`setStrokeWidth`・`previewColor`・`commitColor`・`finishColorPreview`。非公開：`#model`・`#editRecorder`・`#rememberedColors`・`#preview`、`#setEnabled(target, enabled)`（線・塗りの有無の共通実装）、`#selectedShapes`・`#isSamePreview`・`#finishPreview`・`#recordEdit`。色の項目の対応表`COLOR_ITEMS`（凍結。`stroke`・`fill`）の表引きで項目を分岐。importは`./StylePanelRules.js`のみ。DOMなし・`try/catch`なし・ドラッグ判定なし。
    *   `test/edit/ShapeStyleEditor.test.js`：新規（22ケース。実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeStyleEditor`の組み合わせ。直前に使った値の2観点を含む）。
    *   既存テストの書き換え：なし。
    *   `node --test`：tests 840・pass 840・fail 0（着手前818＋新規22）。

### タスク4: 入力欄の判定関数とスペースパン（`InputTracker`）
*   **作業内容** :
    *   （未実施）

### タスク5: チェックボックス・色の欄の操作中の`Ctrl`なしのショートカット（`KeyboardShortcuts`）
*   **作業内容** :
    *   （未実施）

### タスク6: プロパティパネルの「図形」の段のUI部品（`palette/PropertyShapeSection.js`）
*   **作業内容** :
    *   （未実施）

### タスク7: プロパティパネルのウィンドウ（`index.html`）
*   **作業内容** :
    *   （未実施）

### タスク8: プロパティパネルの配線（`main.js`）
*   **作業内容** :
    *   （未実施）

### タスク9: JSDocの記載漏れの確認
*   **作業内容** :
    *   （未実施）

### タスク10: 開発資料への反映
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
### 計画時の判断・注意
*   **REQで計画時に決めるとされた事項の決定**（詳細は2章）：
    *   パネルの初期位置：`top: 16px; right: 508px; width: 220px`（開いた状態のキャンバスパレットの左隣。横方向で既存の3ウィンドウと離れている。`?dev`の確認用ウィンドウとは画面幅1104px以上で重ならない）。
    *   2段構成：段ごとに`<section class="property-section">`＋見出し、段ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つ。
    *   色の文字列の表示：`#rrggbb`は小文字、`#rgb`は展開、それ以外は表示できない色（色の欄はパネルが覚えている色、横に「表示できない色」）。表示のために図形の値を書き換えない。
    *   パネルが覚えている色：色の欄に最後に表示した色（`getPanelView()`のたびに更新）。
    *   色の欄の履歴：ピッカー操作中は記録せずに図形へ反映し、確定（`change`・`blur`・`keydown`・他の変更）のときに開始時の色へ戻して1件として記録する。図形が入れ替わっていたら捨てる。
    *   ドラッグ中：拒まない（理由と安全な理由は2章 要件3）。REQ要件3の「受け付けない、または起こり得ない」から外れる判断（下の「REQからの逸脱：ドラッグ中のパネルの変更を受け付ける」）。
    *   読み込み中：選択集合が空のため直前に使った値だけが変わる（専用の判定なし）。
    *   置き場所：直前に使った値は`VectorModel`、算出の規則は`edit/StylePanelRules`、変更の手順は`edit/ShapeStyleEditor`、DOMは`palette/PropertyShapeSection`。当てる場所は`VectorModel.startDraft`。
    *   線の太さ2pxの定義：新しく描く図形の既定は`VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE`。コンストラクタの既定値は「引数を省略したときの値」として残す。読み込み・書き出しの既定値は変えない。
    *   入力欄の規則：`type`が`checkbox`・`color`の`input`全般に当てる。判定関数`isSpaceOperatedInputElement`を`InputTracker.js`に置く。`KeyboardShortcuts`の有効/無効APIとパネル専用のフォーカス制御は足さない。
    *   `main.js`の配線ブロックの切り出しは行わない（理由は2章 要件6）。
*   **変更対象の見込みからの差分**：REQの見込みに挙がっていた`js/core/ShapeFactory.js`と`js/shapes/`の図形クラスは変更しない（`startDraft`でスタイルを当てるため不要）。見込み外のファイルの変更は無い。
*   **変更対象外のファイルに残る線の太さの古い位置づけ（JSDocと実態の食い違い）**：`js/shapes/ShapeDataValidation.js:18`（非公開定数`DEFAULT_STROKE_WIDTH`のJSDoc）に「図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義」とある。本計画の後は、新しく描く図形の太さは`core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE.strokeWidth`が決め、コンストラクタの既定値は「引数を省略して生成したときの値」になるため、括弧内の「新しく描く図形の太さ」が実態と食い違う（「コンストラクタの既定値とは別の定義」という点自体は正しい）。`ShapeDataValidation.js`はREQで変更しない見込みのファイル（スコープの厳守）のため本サブフェイズではソースを直さず、タスク10で`PROJECT_ARCHITECTURE.md`2章「色・太さの読み込み」に正しい位置づけを残す（「開発資料の更新予定」）。JSDocを直すのは`shapes/`を変更する後続の作業に委ねる。計画時の`Grep`（`js/`・`test/`で「新しく描く」「コンストラクタの既定」「strokeWidth = 2」「既定」）では、図形クラス（`Line`・`Rect`・`Curve`・`Ellipse`・`Path`。REQの変更対象の見込みに挙がっていたが本計画では変更しない）のコンストラクタのJSDocは`@param {number} [strokeWidth=2] - 線の太さ`とだけ書いており、クラスJSDoc・`ShapeFactory.js`・`VectorModel.js`・`InputTracker.js`にも同じ食い違いは無い（他に該当箇所なし）。
*   **`getPanelView()`が状態を変えること**：パネルが覚えている色を更新するため、純粋な照会ではない。表示の同期（`model.onChange`）と`ShapeStyleEditor`の内部以外から呼ぶと、覚えている色がその時点の表示に変わる（同じ状態で何度呼んでも結果は同じ）。
*   **混在の判定は文字列の完全一致**：`'#fff'`と`'#ffffff'`、`'#FF0000'`と`'#ff0000'`のように同じ色でも書き方が違えば「混在」と表示する（データとして違う値のため。色を選び直すとそろう）。
*   **表示できない色の図形**：線の色が`'red'`の図形だけを選ぶと、線の有無は「あり」、色の欄はパネルが覚えている色、横に「表示できない色」。この状態で線を「なし」→「あり」にすると、色の欄に表示されていた色（`'red'`ではない）が入る（利用者がその項目を操作したため。要件どおり）。
*   **ピッカー操作中の確定がブラウザで異なる**：`<input type="color">`の`input`・`change`・`blur`の出方はブラウザ・OSで異なる（Windowsの一部のブラウザはOSのダイアログで、閉じたときに`input`と`change`がまとめて来る。macOSのSafariはピッカーが別ウィンドウのまま残り、ページを操作すると`blur`で途中確定し、その後の`input`は新しい1件になる）。いずれも開始と確定の対は崩れないが、1回のピッカーの操作が複数件に分かれることがある。テストプレイで使うブラウザで、Undo1回でピッカーを開く前の色に戻ることを確かめる。
*   **確定前に他の操作が起きた場合**：`blur`・`keydown`の来ない操作（フォーカスを移さないボタンの押下等）や非同期のキャンバスの切り替えが確定の前に起きると、ピッカーで入れた色が他の操作のスナップショットに含まれる、または図形が入れ替わってその色の変化が履歴に残らないことがある（2章 要件3の手順5。`console.warn`は出ず、アプリは停止しない）。
*   **REQからの逸脱：ドラッグ中のパネルの変更を受け付ける**（REQ要件3「ドラッグ中（`inputTracker.isDragging()`）はパネルの変更を受け付けない、または起こり得ないことを計画時に確かめて記載すること」）：
    *   **逸脱の内容**：本計画はドラッグ中のパネルの変更を拒まず受け付ける。「受け付けない」にも「起こり得ない」にも当たらない（起こり得る経路が1つ残る）。
    *   **外れる理由**：`InputTracker.isDragging()`はドラッグのセッション中（閾値以前を含む）に真になる。太さの欄に打ち込んで`Enter`を押さずにキャンバスを押すと、キャンバスの`mousedown`（セッションの開始）の後にフォーカスが移って太さの欄の`change`が来るため、`isDragging()`で拒むと打ち込んだ太さが失われる。閾値以前・パン（中ボタン・スペース）の間は他の編集操作が開いていないため、受け付けても履歴の開始と確定の対は崩れない（2章 要件3「ドラッグ中の扱い」）。
    *   **残る経路**：閾値を超えた左ドラッグ中（`InputTracker`が編集操作を開いている間）に、キーボードの`Tab`でパネルの部品へフォーカスを移して`Space`・矢印等で値を変えた場合。影響：アプリは停止しない。パネルの`beginEdit()`がドラッグの編集操作の「前の状態」を上書きし（`HistoryManager.beginEdit`が`console.warn`を出す）、パネルの変更はドラッグ途中の位置を「前の状態」とする1件になる。その後のドラッグの確定の`commitEdit()`は対を失い（`console.warn`を出して記録しない）、ドラッグの移動は履歴に残らない部分が出る（パネルの変更の取り消しはドラッグ途中の位置へ戻り、ドラッグを始める前の位置へは取り消しで戻れない）。通常のマウス操作では左ボタンを押したまま`Tab`を押す必要があり起こりにくいため、本サブフェイズでは対処しない。
    *   **将来防ぐ場合の案**：`InputTracker`に「編集操作を開いているか（閾値を超えた左ドラッグ中か）」の照会を足し（状態に依存する照会のため`InputTracker`の責務の範囲）、`main.js`が`ShapeStyleEditor`へ注入して、開いている間は変更を受理しない（`false`を返し、パネルは表示を書き戻す）。または、ドラッグの開始時にパネルの部品からフォーカスを外す。いずれも`isDragging()`（閾値以前を含む）では判定しない。
*   **チェックボックス・色の欄をクリックした後のショートカット**：クリックでフォーカスが残るブラウザ（WindowsのChrome等）では、キャンバスを左クリックするまで`Ctrl`なしのショートカット（`V`・`P`・`H`・数字キー・`J`・`Delete`・`Backspace`・`Escape`）が働かない（要件どおり）。macOSのSafariはチェックボックスにクリックでフォーカスを移さないため、そのまま働く。
*   **中ボタンのパンではフォーカスが外れない**：既存の注意（`_doc/COWORK_STATUS.md` 2章C）と同じく、入力欄にフォーカスがあるまま中ボタンでパンしてもフォーカスは外れず、ショートカットが働かないままになる（左クリックで解消）。
*   **小数の太さの表示**：ファイル由来の小数の太さ（例：2.5）は太さの欄にそのまま表示する。`step="1"`のため、ブラウザによっては欄が不正な値の見た目（`:invalid`）になり、矢印で整数へ寄せる動き（2.5→3等）になる。値を確定しない限り図形は変わらない。
*   **太さの欄のフォーカス中は表示を書き換えない**：太さの欄にフォーカスがある間に別の契機で選択中の図形の太さが変わった場合（通常は起こらない）、欄の表示は古いままになり、フォーカスが外れたときに最後の表示へ書き戻される。
*   **パネルの表示の更新の頻度**：`model.onChange`はホバー・作成途中の図形の追従でも通知されるため、マウスを動かすたびに`getPanelView()`と`render`が走る（選択中の図形の数に比例する軽い計算と、値が違うときだけのDOMの代入）。図形が非常に多い選択で重くなった場合は、`model.onChange`の種類別の通知（`_doc/COWORK_STATUS.md` 2章C「性能」）と合わせて検討する。
*   **見えない図形**：線を「なし」にした直線・曲線・弧・開いたパス、線も塗りもない図形は画面に何も描かれないが、選び方は06-01のまま（輪郭付近のクリック・範囲選択・全選択で選べ、選んでいる間はハンドルが出る）。扱いの見直しはPhase 06-03。
*   **画面幅が狭い場合**：画面幅が約1104px未満では`?dev`の確認用ウィンドウとパネルが重なり、約728px未満ではパネルの左端が画面外へ出る（ドラッグで動かせる）。条件（1280×800以上）の範囲外。

### タスク3での実装時の注意
*   **`ShapeStyleEditor`の細部の判断**：`previewColor`は受け取った色を`toColorInputValue`の変換結果（小文字`#rrggbb`）で図形・直前に使った値へ入れる（`<input type="color">`の値は常にこの形）。ピッカー操作中の記録と今の対象（項目・図形インスタンスの並び）が違うときだけ先に確定する。選択なし・塗れる形なしの`false`の分岐でも、記録との不一致があれば先に確定してから返す。`setFillEnabled`が`false`を返す（選択中に塗れる形が無い）場合も冒頭の`#finishPreview()`は行う。
*   **`getPanelView()`の副作用の利用**：`setStrokeEnabled(true)`・`setFillEnabled(true)`が表示中の色を得るために内部で`getPanelView()`を呼ぶ（覚えている色を更新するが、同じ状態なら結果は同じ）。
*   **将来の注意**：`COLOR_ITEMS`の`shapeKey`は直前に使った値（`NewShapeStyle`）の色のキー名と同じ前提。項目を足す（透明度等）ときは表へ足すが、`NewShapeStyle`のキーも揃える必要がある。

### テストプレイで確認すべき項目（操作手順 → 期待する結果）
**A. パネルの置き場所・構成**
1.  1280×800以上の画面で開く → 「プロパティ」ウィンドウがキャンバスパレットの左隣（開いていなくても同じ位置）に表示され、コントロールパネル・図形選択パレット・開いたキャンバスパレットのどれとも重ならない。`×`ボタンは無い。見出し「図形」の段がある。
2.  `?dev`付きで開く → 確認用ウィンドウとパネルが重ならない（1280px幅）。
3.  パネルの見出しをドラッグ → パネルが動く。パネルを押すと最前面になる。パネル上の操作でキャンバスの選択・作成が起きない。
4.  選択・図形作成・キャンバス移動の各モードで、パネルが半透明にならず常に操作できる。
5.  キャンバスの読み込み中（起動直後）にパネルを操作 → 操作でき、図形は変わらない。読み込み完了後に描いた図形が、読み込み中に変えた値で描かれる。

**B. 表示（要件2）**
6.  何も選ばない → 「次に描く図形」、線あり・黒・太さ2・塗りなし（塗りの色の欄は白）。
7.  図形1個を選ぶ → 「選択中：1個」、その図形の線の有無・色・太さ・塗りの有無・色。
8.  色・太さ・有無がそろった複数の図形を選ぶ → 「選択中：n個」、そろった値、「混在」の表示なし。
9.  線の色が違う複数の図形を選ぶ → 色の欄は重なり順で最も手前の図形の色、横に「混在」。範囲選択で選んでも、選んだ順ではなく重なり順で決まる。
10. 線あり・線なしの図形を混ぜて選ぶ → 線のチェックボックスが中間表示。色の欄は線ありの図形の色（線なしの図形は判定に含まれない）。
11. 太さの違う図形を選ぶ → 太さの欄が空で「混在」の表示（placeholder）。
12. 直線・曲線・弧・開いたパスだけを選ぶ → 塗りのチェックボックスと色の欄が無効の表示。その図形を保存して開き直しても`fillColor`は元のまま（`?dev`の「JSONへ変換」で確かめる）。
13. 矩形（塗りあり）と直線（`fillColor`あり）を選ぶ → 塗りの欄は有効で、矩形の塗りだけで決まる（直線の`fillColor`は判定に含まれない）。
14. `#fff`の色の図形・`red`の色の図形・小数の太さの図形を含むファイル（現場設計AIが用意）を開いて選ぶ → `#fff`は白として表示（「混在」なし）、`red`は色の欄にパネルが覚えている色・横に「表示できない色」、小数の太さはそのまま表示。選ぶだけでは図形の値が変わらない（「JSONへ変換」で確かめる）。
15. 選択の変更・取り消し/やり直し・キャンバスの切り替え・図形の作成・削除・貼り付けのたびに、パネルの表示が追従する。図形作成モード・キャンバス移動モードへ切り替えると「次に描く図形」になる。

**C. 操作（要件3）**
16. 線ありの赤い図形を選んで線を「なし」→ 線が消える。選択を変えずにすぐ「あり」→ 赤い線に戻る。
17. 複数の図形を選んで線の色を選ぶ → 全図形の線がその色になる（線なしだった図形にも付く）。塗り・太さは図形ごとのまま。キャンバスにすぐ表示される。
18. 線のチェックボックスが中間表示の状態で押す → 「あり」になり、色の欄に表示されていた色（最も手前の線ありの図形の色）が全図形に入る。
19. 矩形・円・閉じたパスと直線を選んで塗りを「あり」・塗りの色を選ぶ → 塗れる形だけが塗られ、直線の`fillColor`は変わらない（「JSONへ変換」で確かめる）。塗りを「なし」→ 塗れる形の`fillColor`が`null`、直線の`fillColor`は元のまま。
20. 太さの欄に`5`を打って`Enter` → 選択中の全図形（線なしの図形を含む）の太さが5。打っている途中は変わらない。矢印で1ずつ増減し、1未満・100超にならない。
21. 太さの欄に`0`・`-1`・`1.5`・`101`・空・`abc`を打って確定（`Enter`・欄から出る）→ 図形は変わらず、欄が元の値（混在なら空欄）に戻る。
22. 太さの欄に打って`Enter`を押さずにキャンバスを押す（選択モードで空白・選択中の図形の上の両方）→ 打った値が反映される。
23. 線を「なし」にして直線を見えなくする → 見えない図形になる（受け付ける）。輪郭付近のクリック・範囲選択で選べ、ハンドルが出る。
24. 何も選ばずにパネルを変える → 図形は変わらず、取り消しボタンの状態も変わらない（履歴に記録されない）。

**D. 履歴（要件3）**
25. 各操作（線の有無・塗りの有無・太さ・線の色・塗りの色）の後に`Ctrl`+`Z` → 1回で元に戻る。`Ctrl`+`Y` → 1回でやり直される。取り消し・やり直しボタンでも同じ。
26. 色の欄のピッカーで色を何度も動かしてから閉じる → 動かしている間もキャンバスに表示される。`Ctrl`+`Z`1回でピッカーを開く前の色に戻る。
27. ピッカーを開いたまま（またはピッカーで色を動かした直後に）キャンバスを押す・他のボタンを押す・`Ctrl`+`Z`を押す → アプリが停止せず、コンソールに`HistoryManager`の警告が出ない。その後の取り消し/やり直しで状態が崩れない。
28. 同じ色を選び直す・同じ太さを確定する → 履歴が増えない（取り消しボタンの状態が変わらない）。
29. パネルで変えた後、しばらく待ってからページを再読み込み → 変えたスタイルが保存されている（自動保存）。
30. ドラッグ中（中ボタンのパン中）にパネルのチェックボックスを左クリック → アプリが停止せず、1件として記録される。

**E. 新しく描く図形（要件4）**
31. 起動直後に5種の図形を描く → これまでと同じ（線あり黒・2px・塗りなし）。
32. 何も選ばずに線の色・太さ・塗りを変えて5種を描く → 作成途中の表示も確定した図形も変えた値。直線・曲線・弧は塗られないが、「JSONへ変換」で`fillColor`を持つ。
33. 図形を選んで線の色だけを変えてから選択を外して描く → 線の色だけが変えた値、他の項目は前の値のまま。
34. 図形を選ぶだけ（変えない）で選択を外して描く → 選んだ図形のスタイルにはならない。
35. 作成途中（1回目のクリックの後）にパネルで色を変えてから2回目のクリック → 作成途中の表示と確定した図形が変えた色。
36. 変えた後にキャンバスを切り替えて描く → 変えた値のまま。ページを再読み込みして描く → 既定に戻る。取り消しで直前に使った値は戻らない。
37. 貼り付け・複製・インポート・開く → 元の図形のスタイルのまま。
38. 直線の描き終えで端点に吸い付いて描き足し・結合・閉じる → 結果のスタイルは基準の線A（重なり順で奥）のもの（これまでどおり）。

**F. 入力欄の操作中のショートカット（要件5。RES `261031_2121` 5章「将来テキスト入力欄を追加した際の確認項目」・テストプレイ項目より）**
39. 太さの欄にフォーカスがある状態で`V`・`P`・`H`・数字（テンキー含む）・`Space`・`Delete`・`Backspace`・`Esc` → 文字入力・文字削除として働き、ショートカット・スペースパンが働かない。
40. 太さの欄で`Ctrl`+`A` → 欄の文字の全選択。`Ctrl`+`0`/`=`/`-` → ブラウザ標準の動作（キャンバスのズームは変わらない）。`Ctrl`+`Z` → ブラウザ標準の動作（アプリの取り消しにならない）。
41. 太さの欄でIME（日本語入力）がオンのときの数字・`Esc`・`Backspace` → 変換操作として働き、ショートカットが働かない。
42. チェックボックスにフォーカスがある状態で`Space` → チェックが切り替わり（線・塗りの有無が変わる）、パンしない。押下状態が残らない（その後キャンバスを左ドラッグしてもパンにならない）。
43. 色の欄にフォーカスがある状態で`Space` → ピッカーが開き（ブラウザの標準動作）、パンしない。
44. チェックボックス・色の欄にフォーカスがある状態で`V`・`P`・`H`・数字（テンキー含む）・`J`・`Delete`・`Backspace`・`Esc` → 何も起きない（モード・図形種別・選択・図形が変わらない）。
45. チェックボックス・色の欄にフォーカスがある状態で`Ctrl`+`Z`/`Y`/`Shift`+`Z`/`A`/`C`/`X`/`V`/`D`/`0`/`=`/`-` → アプリの操作として働く（ブラウザのズーム・ページ全選択は起きない）。
46. 入力欄からフォーカスを外した（キャンバスを左クリック）後 → ショートカット・スペースパンが再び働く。スペースを押したまま入力欄・チェックボックスへフォーカスを移して離しても、スペース押下状態が残らない。
47. 削除ボタン・モードボタン・キャンバスパレットのボタンをクリックした直後の`Space`・`Enter` → これまでどおり誤クリック・再削除が起きない（ボタンにフォーカスがあるときの挙動は変わらない）。`?dev`のテキスト欄の入力もこれまでどおり。
48. ドラッグ中（本体ドラッグ・ハンドルドラッグ・範囲選択・中ボタンパン・スペースパン）に`V`・`3`・`Esc`・`Ctrl`+`A`・`Delete`を押しても何も起きない（これまでどおり）。

**G. 既存の操作が変わらないこと**
49. 図形5種の作成（クリック→クリック）・選択（クリック・範囲選択・全選択）・移動（本体・moveハンドル）・変形（ハンドル）・削除（ボタン・`Delete`）・結合（ボタン・`J`）・端点への吸い付き・コピー/切り取り/貼り付け/複製・取り消し/やり直し・パン・ズーム・ビューのリセットがこれまでどおり動く。
50. キャンバスパレットの新規作成・開く・名前の変更・削除・出力（作業ファイル・エンジン用）・開く（ファイル）・インポートがこれまでどおり動く。パネルで変えた図形を出力（エンジン用）して`sprite-check.html`で開くと、エディタと同じ見た目で描かれる。
51. 既存のショートカット（`V`・`P`・`H`・数字キー・`Ctrl`+`0`/`=`/`-`・`Esc`・`Ctrl`+`A`・`Delete`・`J`・`Ctrl`+`Z`/`Y`/`C`/`X`/`V`/`D`）が、パネルの部品にフォーカスが無いときはこれまでどおり働く。
52. 既存のウィンドウ（コントロールパネル・図形選択パレット・キャンバスパレット・`?dev`の確認用ウィンドウ）の位置・見た目が変わらない。
