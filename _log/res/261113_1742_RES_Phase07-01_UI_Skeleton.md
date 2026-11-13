# RES: 作業計画・作業レポート (Phase 07-01) : 画面の骨組み（ツールバー・ステータスバー・ツールパレット）
* 参照元REQ: `./_log/req/261113_1733_REQ_Phase07-01_UI_Skeleton.md`

## 1. 作業目的
画面を、上端の**ツールバー**・下端の**ステータスバー**・その間の**キャンバスの領域**・フロートウィンドウの**ツールパレット**へ組み替え、コントロールパネル（`#window-control-panel`）と図形選択パレット（`#window-shape-palette`）のウィンドウをなくす。以後のサブフェイズ（07-02 オプションバー、07-03 定規・表示の切り替え、07-05 スナップ）の置き場所を先に作るのが目的である。

* 図形の描き方・選び方・履歴・保存・書き出し等の働きは変えない。変わるのは画面の部品の置き場所・見た目（アイコンのみのボタン）・ウィンドウの既定の位置と、図形のツールを選ぶ手数（図形のボタン1回でその図形を描く状態になる）だけである。
* 作業データの版・書き出し形式の版はどちらも2のまま。`InputTracker`の操作モード（`OperationMode`の3値）と図形種別の持ち方・`setMode`・`setShapeType`の働きは変えない。`SHORTCUT_BINDINGS`は変えない。キーは足さない。

## 2. アーキテクチャ設計

### 要件1: 画面の領域（ツールバー・ステータスバー・キャンバス）
**(1) 位置と大きさを1か所にまとめる構成（CSSのカスタムプロパティ）**
`index.html`の`<style>`の先頭に`:root`のブロックを置き、画面の領域の寸法はここだけで決める。

```css
:root {
    --toolbar-height: 40px;          /* ツールバーの高さ（1行固定） */
    --statusbar-height: 28px;        /* ステータスバーの高さ（1行固定） */
    /* キャンバスの領域（07-03で定規を足すときは、この4行だけを直す） */
    --canvas-area-top: var(--toolbar-height);
    --canvas-area-left: 0px;
    --canvas-area-width: calc(100vw - var(--canvas-area-left));
    --canvas-area-height: calc(100vh - var(--canvas-area-top) - var(--statusbar-height));
    /* フロートウィンドウの既定の位置の基準（キャンバスの領域の左上から余白を空ける） */
    --float-window-margin: 8px;
    --float-window-top: calc(var(--canvas-area-top) + var(--float-window-margin));
    --float-window-left: calc(var(--canvas-area-left) + var(--float-window-margin));
}
```

* キャンバスと覆い要素は1つのまとめたルールで同じ領域に置く：`#editor-canvas, .canvas-loading-cover { position: fixed; top: var(--canvas-area-top); left: var(--canvas-area-left); width: var(--canvas-area-width); height: var(--canvas-area-height); }`（z-index・背景等はそれぞれの既存のルールに残す）。`#editor-canvas`は`position: absolute`→`fixed`、`100vw`/`100vh`の指定を外す。覆い要素の`top/left/width/height`（`0`/`100vw`/`100vh`）も外す。
* `<canvas>`は置換要素のため`left`と`right`を両方指定しても伸びない（内部バッファの`width`属性の大きさになる）。必ず`width`/`height`をCSSで明示する（上の変数）。
* 07-03で定規を足すときは、`--canvas-area-top`（ツールバー＋定規の高さ）と`--canvas-area-left`（定規の幅）の2行を直せば、キャンバス・覆い要素・フロートウィンドウの既定の位置が追従する。
* ツールバー・ステータスバーの高さは`--toolbar-height`・`--statusbar-height`で固定（`box-sizing: border-box`）。中身の量・フォントで高さが変わらないため、キャンバスの大きさはブラウザのウィンドウの大きさだけで決まる。

**(2) ブラウザのウィンドウの大きさの変化への追従**：既存の`window`の`resize` → `canvasManager.resize()` → `renderCurrentState()`の経路で足りる（キャンバスの大きさはビューポートの`calc`だけで決まり、ビューポートの大きさが変わるときは必ず`resize`が発火するため）。`ResizeObserver`等は足さない。

**(3) 座標の確認（実コードで確認済みの結果）**
* `InputTracker.getScreenCoordinate`（`js/core/InputTracker.js` 1194行付近）：`rect = canvas.getBoundingClientRect()`を取り、`(event.clientX - rect.left) * (canvas.clientWidth / rect.width)`で求める。キャンバスの左上が`(0, 40)`等へずれても`rect.left/top`で差し引かれるため正しい。キャンバスに枠線・内側の余白は付けない（付けると`clientWidth`と`rect.width`の比が1でなくなり、枠線の分ずれる）。→ `InputTracker`の変更は不要。
* `DragTracker`：`window`へcaptureで購読し、座標は注入された`getScreenCoordinate`だけで求める（`js/core/DragTracker.js` 80〜85行）。→ 変更不要。
* `CanvasManager.resize`（148行付近）：`canvas.clientWidth/clientHeight`（CSSで決めたキャンバスの領域の大きさ）× dprで内部バッファを合わせる。コンストラクタからも呼ばれるが、`<style>`は`index.html`内にあり`DOMContentLoaded`の時点で適用済みのため、起動時から領域の大きさになる。→ 変更不要。
* `main.js`の`resetViewToCenter`・`zoomAtCanvasCenter`：`canvas.clientWidth / 2`・`canvas.clientHeight / 2`はキャンバス左上基準のスクリーン座標（`ViewTransform`のスクリーン座標の定義と同じ）であり、キャンバスの領域の中心を指す。→ 処理は変えない（JSDocの「キャンバス要素全体の中心」を「キャンバスの領域（キャンバス要素）の中心」へ改める）。読み込み完了時の`resetView`も同じ関数を通るため、原点はキャンバスの領域の中央に来る。

**(4) 読み込み中の覆い要素**：上のまとめたルールでキャンバスの領域だけを覆う。`z-index: 5`・表示状態で始まること・`.canvas-loading-cover[hidden] { display: none; }`は変えない。ツールバー・ステータスバーは覆いの外にあり、かつ`z-index`が覆いより上（8）なので読み込み中も押せる。

**(5) 重なりの順**：キャンバス（`z-index: 1`）→ 覆い要素（5）→ ツールバー・ステータスバー（8）→ フロートウィンドウ（10以上。`WindowManager`の最前面化で増える一方で下がらない）。フロートウィンドウはツールバー・ステータスバーの上へ動かせ、重ねると手前に出る（`WindowManager`は変えない）。

**(6) ツールバー・ステータスバーの上でのマウス操作（実コードで確認済み）**
* `InputTracker`はキャンバス要素だけに`mousemove`・`mousedown`・`click`・`wheel`を購読する（366〜370行）。ツールバー・ステータスバーはキャンバスの子ではない兄弟要素のため、その上の押下・クリックはキャンバスの操作として扱われない。`WindowManager`のようなイベント遮断は不要（足さない）。
* キャンバスで始めたドラッグは`DragTracker`の`window`へのcapture購読で追従・終了するため、カーソルがツールバー・ステータスバー・ツールパレットの上へ出てもドラッグは続き、離した所で終わる。離した直後の`click`は押下（キャンバス）と解放の要素の共通の祖先へ送られキャンバスの`click`には来ないが、click抑止フラグの残りは次の押下で`clearSuppressedClick()`が解除する（676・693行。従来のフロートウィンドウの外と同じ）。ボタンの上で離してもボタンの`click`は起きない（押下と解放が同じ要素でないため）。
* ツールバー・ステータスバーには`user-select: none`を付ける（ドラッグで文字が選択されないため）。

**(7) 1行のまま切れる作り**：ツールバー・ステータスバーは`display: flex; flex-wrap: nowrap; overflow: hidden; white-space: nowrap;`。各グループは`flex: none`（縮まない）。収まらない右側の項目は画面の外へ切れる（横スクロールバーは`overflow: hidden`と`body`の`overflow: hidden`で出ない）。ステータスバーのキャンバスの名前は従来どおり省略表示（`…`）されるため、狭い幅ではまず名前が縮み、それでも足りなければ右側の項目が切れる。

### 要件2: ツールバー（上端）
* マークアップ（`index.html`。`<canvas>`・覆い要素の直後に静的に置く）：
  ```html
  <header id="toolbar" class="toolbar">
      <div class="toolbar-group"><!-- パレットの開閉 --> 📁 #launcher-canvas </div>
      <div class="toolbar-group"><!-- 取り消し・やり直し --> ↶ #history-undo ／ ↷ #history-redo </div>
      <div class="toolbar-group"><!-- 選択中の図形の操作 --> 🗑 #selection-delete ／ 🔗 #selection-join </div>
  </header>
  ```
* **idは今のボタンのものを保つ**（`#launcher-canvas`・`#history-undo`・`#history-redo`・`#selection-delete`・`#selection-join`）。そのため`main.js`の`getElementById`・`paletteLaunchers`・同期関数`syncDeleteButtonState`・`syncJoinButtonState`・`syncHistoryButtonState`・`performUndo`・`performRedo`・`performJoin`・`inputTracker.deleteSelection()`の配線は変えずに働く。`disabled`の初期値（取り消し・やり直し・削除・結合）も今のまま。
* **後から項目を足せる構成**：まとまりごとに`<div class="toolbar-group">`を1つ置き、区切りはCSSの隣接セレクタ`.toolbar-group + .toolbar-group { border-left: 1px solid #ccc; margin-left: 8px; padding-left: 8px; }`で付ける（プロパティパネルの`.property-section + .property-section`と同じ考え方。区切りの要素は置かない）。07-02（オプションバー）・07-03（パレットの表示・非表示）は、`<div class="toolbar-group">`を足すだけで既存のまとまりを変えない（07-03のパレットの表示・非表示のボタンは「パレットの開閉」のまとまりへ足すか新しいまとまりにするかを07-03で決める）。本サブフェイズでは空のまとまり・07-02/07-03用の部品は作らない。

### 要件3: ステータスバー（下端）
* マークアップ：
  ```html
  <footer id="status-bar" class="status-bar">
      <div class="status-bar-side status-bar-left">
          <div class="status-bar-group"> #canvas-name-display（class="canvas-name-display"） </div>
      </div>
      <div class="status-bar-side status-bar-right">
          <div class="status-bar-group"> #view-zoom-display（100%） 🎯 #view-reset </div>
      </div>
  </footer>
  ```
* **idは今のものを保つ**（`#canvas-name-display`・`#view-zoom-display`・`#view-reset`）。`syncCanvasNameDisplay`（`⚠ `・「読み込み中…」・`title`・`document.title`）・`syncZoomDisplay`・`resetViewToCenter`の配線は変えずに働く。
* 並び：`.status-bar`は`justify-content: space-between`。左側`.status-bar-left`は`flex: 1 1 auto; min-width: 0;`（名前が縮める）、右側`.status-bar-right`は`flex: none; margin-left: 8px;`。左側のまとまりは`flex: 0 1 auto; min-width: 0;`、`.canvas-name-display`に`min-width: 0`を足して省略表示が効くようにする。
* **後から項目を足せる構成**：左右それぞれの`.status-bar-side`の中に`<div class="status-bar-group">`を足す。区切りは`.status-bar-group + .status-bar-group { border-left: 1px solid #ccc; margin-left: 8px; padding-left: 8px; }`。07-03（左：カーソル位置の座標、右：表示の切り替え・全体を画面に収める）・07-05（右：スナップの切り替え）はまとまりを足すだけで既存を変えない。本サブフェイズでは07-03・07-05用の部品は作らない。

### 要件4: ツールパレット（フロートウィンドウ）
**(1) ツールの一覧と「押し込みにするツール」の規則＝新設`js/core/ToolRules.js`**
* 置き場所の理由：規則は`OperationMode`（`core/InputTracker.js`）と`SHAPE_TYPES`（`core/ShapeFactory.js`）の知識を要する。`edit/`は操作モードを知らない、`palette/`はimportを持たない、`main.js`は判定を持たない、`InputTracker`へは入れない、ため`core/`に状態を持たない関数として置く（`core/PointHitRules.js`と同じ位置づけ。`InputTracker`の再分離ではない）。
* import：`OperationMode`を`./InputTracker.js`から、`SHAPE_TYPES`を`./ShapeFactory.js`（正本）から。`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない（循環なし。`InputTracker.js`はモジュールの最上位でDOMに触れないため`node --test`でimportできることを確認済み）。`ToolRules`をimportするのは`main.js`とテストだけ。
* 公開：
  * `TOOL_IDS`：ツールの識別子の一覧（凍結した配列）。`[OperationMode.SELECT, OperationMode.PAN, ...SHAPE_TYPES]`＝`['select', 'pan', 'line', 'curve', 'arc', 'rect', 'circle']`。並びはツールパレットのボタンの並び。選択・キャンバス移動のツールの識別子は操作モードの値と同じ、図形のツールの識別子は図形種別の値と同じ。
  * `resolveActiveTool(mode, shapeType)`：押し込みにするツールの識別子を返す。`mode`が`SELECT`→`'select'`、`PAN`→`'pan'`（`shapeType`は見ない）、`CREATE`→`shapeType`（`SHAPE_TYPES`に含まれるときのみ）。それ以外（未知の`mode`、`CREATE`で`SHAPE_TYPES`外の`shapeType`）は`null`（どのボタンも押し込みにしない。従来の`setActiveType`で一致しない値を渡したときと同じ扱い。`InputTracker`は不正値を受け付けないため実際には起きない）。DOMに触れない・状態を持たない・引数を書き換えない。分岐は`mode === OperationMode.CREATE`の1つだけで、図形種別ごとの分岐は持たない。
**(2) UI部品＝新設`js/palette/ToolPalette.js`（`PaletteController.js`は削除）**
* 作り替えでなく新設にする理由：対象のウィンドウ・ボタンの一覧（図形種別→ツール）・公開メソッド（`setEnabled`・`setActiveType`→`setActiveTool`）・ファイル名の意味がすべて変わるため。`PaletteController.js`は`main.js`が使わなくなった後のタスクで削除する（`setEnabled`・`setActiveType`・`PALETTE_BUTTON_ID_PREFIX`ごとなくなる）。
* 責務：ツールパレット（`#window-tool-palette`）のツールのボタンのclickをツールの選択要求としてコールバックへ通知し、`setActiveTool(toolId)`で押し込みの表示（`.active`）を排他的に切り替える。importを持たない。`VectorModel`・図形データ・選択状態・`InputTracker`・操作モードの意味を知らない（受け取るのはツールの識別子の一覧・コールバック・識別子のみ）。
* `constructor(rootElement, toolIds, onToolSelected)`：
  * `rootElement`が無ければ`console.warn`して配線しない（`setActiveTool`は何もしない）。
  * ルート要素内の`[id^="tool-"]`をidで引ける`Map`にし、`toolIds`の各識別子について`#tool-${toolId}`を解決する。見つからない識別子は`console.warn`（`ToolPalette: ツール "${toolId}" のボタン（#${id}）が見つかりません。このツールは配線しません。`）、一覧にない`tool-`の要素も`console.warn`（`ToolPalette: 要素 #${id} はツールの一覧にありません。配線しません。`）。いずれも配線しない。文言は`PaletteController`の2つの警告の対象の名前（`PaletteController`→`ToolPalette`、図形種別→ツール）だけを変えたもの。照合はコンストラクタの1回のみ。
  * 配線したボタンの`click`で`onToolSelected(toolId)`を呼ぶ。
* `setActiveTool(toolId)`：配線済みのボタンのうち`toolId`と一致するもの1つだけに`.active`を付け、他は外す。一致しなければ（`null`を含む）すべて外す。
* `.disabled`（ウィンドウ全体の非活性）を扱うメソッドは持たない（ツールパレットは常に押せる）。
**(3) ボタンのidの命名規則**：`tool-${toolId}`（`toolId`は`TOOL_IDS`の値）。`#tool-select`・`#tool-pan`・`#tool-line`・`#tool-curve`・`#tool-arc`・`#tool-rect`・`#tool-circle`。ツールパレットの中では、ツールのボタン以外の要素に`tool-`で始まるidを使わない（照合時に警告される）。旧id`#mode-select`・`#mode-create`・`#mode-pan`・`#palette-${type}`はなくなる。
**(4) マークアップ（`index.html`。静的に置き、`hidden`なし・`×`なし）**：
  ```html
  <div id="window-tool-palette" class="float-window">
      <div class="window-header"></div>   <!-- 見出しの文字は置かない（幅44pxに収まらないため）。ドラッグ用 -->
      <div class="window-body">
          <div class="tool-palette-group">   🖱 #tool-select（class に active）／ ✋ #tool-pan </div>
          <div class="tool-palette-group">   ／ #tool-line ／ 〜 #tool-curve ／ ◠ #tool-arc ／ ▭ #tool-rect ／ ◯ #tool-circle </div>
      </div>
  </div>
  ```
  * 区切りは`.tool-palette-group + .tool-palette-group { border-top: 1px solid #ddd; margin-top: 4px; padding-top: 4px; }`（要素は置かない）。
  * 起動時の表示：`#tool-select`だけに`index.html`で`active`を付ける（`InputTracker`の初期モードは選択。起動時の`applyMode(OperationMode.SELECT)`が同じ結果を同期する）。
  * `WindowManager`は起動時にDOMにある`.float-window`を検知するため、静的に置くだけでドラッグ移動・最前面化・イベント遮断が働く（検知の仕組みは足さない）。ヘッダーは`.window-header`（文字なし。`min-height`で高さを保つ）。
**(5) `main.js`の配線（`// 7.`のブロックを作り替える）**
  ```js
  const toolPalette = new ToolPalette(document.getElementById('window-tool-palette'), TOOL_IDS, (toolId) => selectTool(toolId));
  function syncToolPalette() {            // applyMode・applyShapeTypeの中からだけ呼ぶ（専用の同期経路ではない）
      toolPalette.setActiveTool(resolveActiveTool(inputTracker.getMode(), inputTracker.getShapeType()));
  }
  function applyMode(mode) { inputTracker.setMode(mode); syncToolPalette(); }
  function applyShapeType(type) { inputTracker.setShapeType(type); syncToolPalette(); }
  function selectShapeTool(type) {        // 図形のボタンと数字キーの共通経路（今のsetShapeTypeコールバックの中身を移したもの）
      if (inputTracker.getMode() !== OperationMode.CREATE) { applyMode(OperationMode.CREATE); }
      applyShapeType(type);
  }
  const toolActions = {                   // ツールの識別子→操作の対応表（TOOL_IDSと同じ並び）
      [OperationMode.SELECT]: () => applyMode(OperationMode.SELECT),
      [OperationMode.PAN]: () => applyMode(OperationMode.PAN),
      ...Object.fromEntries(SHAPE_TYPES.map((type) => [type, () => selectShapeTool(type)])),
  };
  function selectTool(toolId) { const action = toolActions[toolId]; if (action) { action(); } }
  ```
  * 「選択」「キャンバス移動」のボタンは`applyMode`の経路（今のモードボタンと同じ）。図形のボタンは`selectShapeTool`＝数字キーと同じ1つの関数。`KeyboardShortcuts`の`setShapeType`コールバックは`(type) => { selectShapeTool(type); return true; }`に変える（動きは今と同じ）。`setMode`コールバック（`V`・`P`・`H`）は今のまま`applyMode`。`P`は`applyMode(CREATE)`→`resolveActiveTool(CREATE, 最後の図形種別)`で、その図形のボタンが押し込みになる（起動直後は`SHAPE_TYPES[0]`＝直線）。
  * 押し込みの表示は`applyMode`・`applyShapeType`の中で`inputTracker.getMode()`・`getShapeType()`を読み返して同期する（未知の値が無視された場合も内部状態と一致）。貼り付け・全選択・キャンバスの切り替え（`prepareSwitch`）・インポート（`prepareInsert`）は既存どおり`applyMode`を呼ぶため追従する。
  * `toolActions`は従来の`modeButtons`と同じ表引きの配線で、判定ではない（`if (action)`は一覧外の識別子を無視する防御のみ）。`modeButtons`・`shapePaletteEl`・`paletteController`・`PaletteController`のimport・パレットの活性制御（`setEnabled`）は削除する。
**(6) 半透明にしない・常に押せる**：ツールパレットに`.disabled`を付けない（`.disabled`のCSS自体を削除する）。
**(7) キー**：`SHORTCUT_BINDINGS`は変えない。`V`・`H`・`P`・数字キー（テンキーを含む）の動きは今と同じで、押し込みの表示が`applyMode`・`applyShapeType`の経路で追従する。

### 要件5: ボタンの見た目（アイコンと説明）
* 各ボタンのアイコンは`index.html`のそのボタンの中身の文字だけに書く（JSはボタンの中身を書き換えない。CSSの`content`等で重ねない）。文字のラベルは付けない。`title`はREQ要件5の表のとおり（キーの表記を落とさない）。
* 共通のクラス`.icon-btn`を`.tool-btn`と併用する（`class="tool-btn icon-btn"`）。押し込み（`.tool-btn.active`）・押せない（`.tool-btn:disabled`）・ホバー（`.tool-btn:hover:not(:disabled)`）の見た目は既存の`.tool-btn`のルールをそのまま使う（考え方を二重に書かない）。`.icon-btn`は`.tool-btn`のルールの後に置き、大きさと中央寄せだけを上書きする：
  ```css
  .icon-btn { box-sizing: border-box; width: 32px; height: 32px; padding: 0; display: inline-flex; align-items: center; justify-content: center; flex: none; font-size: 16px; line-height: 1; text-align: center; }
  .status-bar .icon-btn { width: 24px; height: 24px; font-size: 14px; }
  ```
  ツールバー（高さ40px）・ツールパレットは32×32、ステータスバー（高さ28px）は24×24。
* キャンバスパレット・プロパティパネル・`?dev`の確認用ウィンドウの中のボタン・欄の見た目は変えない（`.tool-btn`の既存のルールは変えない）。

### 要件6: なくすものと、残すウィンドウの既定の位置
**(1) なくすもの（実コードで使用箇所を確認済み）**
* `index.html`のマークアップ：`#window-control-panel`（中の`#mode-select`・`#mode-create`・`#mode-pan`、見出しの「OZ Vector Editor」を含む）、`#window-shape-palette`（`#palette-line`〜`#palette-circle`）。
* `index.html`のCSS：`#window-control-panel`・`#window-shape-palette`のルールとそのコメント、`.disabled`（使うのは`#window-shape-palette`の初期クラスと`PaletteController.setEnabled`だけ）、`.view-zoom-row`・`.history-button-row`（＋`.history-button-row .tool-btn`）・`.selection-button-row`（＋`.selection-button-row .tool-btn`）（いずれもコントロールパネルの行だけが使う）。`.tool-btn:disabled`のコメント中の`.disabled`への言及も改める。
* JS：`js/palette/PaletteController.js`（ファイルごと）、`main.js`の`modeButtons`・`shapePaletteEl`・`paletteController`・`PaletteController`のimport。
* 残すもの（確認済み）：`.window-title`（キャンバスパレット・プロパティパネル・`?dev`が使う）、`.tool-btn`の`text-align: left`（キャンバスパレット等が使う）、`.canvas-name-display`（ステータスバーへ移す）。
**(2) 既定の位置（1280×800での確認込み。枠線1pxを含めて見積もる）**
| ウィンドウ | 指定 | 1280×800での範囲（x、y） |
| --- | --- | --- |
| ツールパレット | `top: var(--float-window-top); left: var(--float-window-left); width: 44px;`（`.window-body`は`padding: 6px`） | x 8〜54、y 48〜約354（見出し約39＋本体約265＋枠2） |
| キャンバスパレット（`hidden`で始まる） | `top: var(--float-window-top); right: var(--float-window-margin); width: 240px;` | x 1030〜1272、y 48〜約565（一覧の最大240pxを含む見積もり） |
| プロパティパネル | `top: var(--float-window-top); right: 258px; width: 220px;`（258＝余白8＋キャンバスパレット240＋枠2＋余白8） | x 800〜1022、y 48〜約378（既存の見積もり約330px） |
| `?dev`の確認用ウィンドウ | `top: var(--float-window-top); left: calc(var(--float-window-left) + 54px); width: 360px;`（54＝ツールパレット44＋枠2＋余白8） | x 62〜424、y 48〜 |
* ツールパレット・開いた状態のキャンバスパレット・プロパティパネルは横方向で離れているため高さによらず重ならない。いずれも上端48px（ツールバーの下端40px＋8px）、下端はステータスバーの上端772pxより上。`?dev`はツールパレットと重ならない（プロパティパネルとは画面幅が約1110px未満で重なり得る。許容）。
* 位置の根拠は各ルールのCSSコメントに既存と同じ形で書き、コントロールパネル・図形選択パレットを基準にした古いコメントは実態へ改める。フロートウィンドウの位置・表示状態は保存しない（変更なし）。

### 要件7: 既存の操作が従来どおり働くこと
* ショートカットの対応表・`KeyboardShortcuts`のロジックは変えない。注入するコールバックのうち変わるのは`setShapeType`の中身（同じ動きの`selectShapeTool`を呼ぶ）だけ。
* フォーカスとキー（実コードで確認済み）：ツールバー・ステータスバー・ツールパレットのボタンは今と同じ`<button type="button">`。`isTextInputElement`（`input`のテキスト系の`type`・`textarea`・`contenteditable`）・`isSpaceOperatedInputElement`（`input`の`checkbox`・`color`）はどちらも要素の種類だけを見て置き場所を見ないため、ボタンでは今と同じく偽。`InputTracker`の`Space`（`#handleSpaceKeyDown`・`handleKeyUp`）はボタンにフォーカスがあってもパンし`preventDefault()`する（ボタンが`Space`で押されない）のは今のコントロールパネルと同じ。`Enter`でフォーカス中のボタンが押されるのも今と同じ。専用のフォーカス制御は足さない。
* コメント・JSDocの修正（ロジックは変えない）：`js/core/InputTracker.js`（36行`OperationMode`の説明、324行`currentShapeType`の初期値の説明）、`js/core/KeyboardShortcuts.js`（75行`SHORTCUT_BINDINGS`の並びの前提）、`js/core/ShapeFactory.js`（17・24・25・26・47行）、`js/palette/PaletteLauncher.js`（責務定義・クラスJSDoc・`@property`の例の説明）、`js/main.js`（各コメント）。

### 要件8: 自動テスト
* 新設`test/core/ToolRules.test.js`（`node:test`・`node:assert/strict`のみ。公開APIのみ）：
  * `TOOL_IDS`：凍結されていること、並びが`['select', 'pan', ...SHAPE_TYPES]`であること、先頭2つが`OperationMode.SELECT`・`OperationMode.PAN`と同じ値であること、重複が無いこと、`SHAPE_TYPES`の全要素を含むこと。
  * `resolveActiveTool`：選択モード→`'select'`（`shapeType`が`SHAPE_TYPES`の全種別・`'path'`・未知の値・`undefined`のいずれでも）、キャンバス移動モード→`'pan'`（同）、図形作成モード→`SHAPE_TYPES`の各種別でその種別。
  * 「常にちょうど1つ」：全操作モード×全図形種別の組み合わせで、結果が`TOOL_IDS`にちょうど1回現れること（`TOOL_IDS.filter((id) => id === result).length === 1`）。
  * 不正な入力：未知の`mode`→`null`、図形作成モードで`'path'`・未知の種別→`null`。
* DOMの部品（`ToolPalette`）・`index.html`・`main.js`の配線は自動テストの対象外（テストプレイ）。既存のテストは変えない（仕様が変わるケースなし）。

### 要件9: テストプレイの確認項目
「5. 懸念事項・要確認ポイント」に操作手順と期待する結果の形で列挙した。

### 要件10: 開発資料への記載
下記「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」に列挙し、最終タスクで反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./index.html` - 画面の構成（ツールバー・ステータスバー・ツールパレット・キャンバスの領域）とスタイル
    *   `./js/main.js` - 配線（ツールパレット・`applyMode`・`applyShapeType`・`selectShapeTool`・`selectTool`）
    *   `./js/core/` - `ToolRules.js`（新設。ツールの一覧と押し込みにするツールの規則）、`InputTracker.js`・`KeyboardShortcuts.js`・`ShapeFactory.js`（コメント・JSDocのみ）
    *   `./js/palette/` - `ToolPalette.js`（新設）、`PaletteController.js`（削除）、`PaletteLauncher.js`（コメント・JSDocのみ）
    *   `./test/core/` - `ToolRules.test.js`（新設）
*   **関連する論理クラス**: `ToolRules`（関数モジュール。`TOOL_IDS`・`resolveActiveTool`）、`ToolPalette`（UI部品）、`InputTracker`（`OperationMode`・`getMode`・`getShapeType`・`setMode`・`setShapeType`。変更なし）、`KeyboardShortcuts`（変更なし）、`WindowManager`（変更なし）、`PaletteLauncher`（コメントのみ）、`CanvasManager`・`DragTracker`（変更なし）

### 参照する責務
*   **index.html**（`_doc/arch/01_index_html.md`）：スタイルはCSSファイル分割せず`<style>`に内包。フロートウィンドウは静的に置く（`WindowManager`は起動時にDOMにある`.float-window`だけを検知する）。ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`。各ボタンの`title`のショートカットの表記は`SHORTCUT_BINDINGS`と手動で同期する。`#canvas-loading-cover`は`hidden`を付けずに表示状態で始め、`.canvas-loading-cover[hidden] { display: none; }`は必須。プロパティパネルは静的に置き常に表示・`×`なし・`.disabled`を使わない。キャンバスパレットは`hidden`で始まり`PaletteLauncher`が開閉、`×`で閉じる。`?dev`の確認用ウィンドウは`hidden`で始まり`?dev`のときのみ`main.js`が表示。配置・見た目はマークアップとCSSコメントを正とする。
*   **main.js**（`_doc/arch/02_main.md`）：インスタンス化・依存の注入・イベントバインドと連携のみ。**判定ロジックを持たない**。同一経路の原則：取り消し・やり直しは`performUndo`/`performRedo`、削除は`inputTracker.deleteSelection()`、結合は`performJoin()`、ビューのリセットは`resetViewToCenter()`のみ（キャンバス要素の大きさを使う計算は`resetViewToCenter`と`zoomAtCanvasCenter`に集める）。操作モード・図形種別の切替は`applyMode`・`applyShapeType`が一元管理し、切替後に`getMode()`/`getShapeType()`で実状態を読み返して表示を同期する。起動時の同期は初期化の最後に`applyMode(OperationMode.SELECT)`と各同期関数を明示的に1回ずつ呼ぶ。`SHAPE_TYPES`は正本の`ShapeFactory.js`から直接importする。モード自動切替を伴う操作（数字キー→図形作成、全選択・貼り付け→選択）はコールバック内で先に`applyMode`を呼ぶ。
*   **同期の経路**（`PROJECT_ARCHITECTURE.md` 3章冒頭）：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、モードと図形種別は`applyMode`・`applyShapeType`）のみ。機能専用の再描画・同期処理を足さない。描画は`model.onChange`・`viewTransform.onChange`・ウィンドウリサイズの3経路から`renderCurrentState()`。
*   **InputTracker.js**（`_doc/arch/06_InputTracker.md`）：入力の解釈。操作モード（`'select'`/`'create'`/`'pan'`）と図形種別を独立に保持し、図形種別はモード切替でリセットされない。公開`setMode`・`setShapeType`・`getMode`・`getShapeType`・`isDragging`・`getScreenCoordinate`等。export`OperationMode`・`SHAPE_TYPES`（再export）・`isTextInputElement`・`isSpaceOperatedInputElement`等。画面のボタン・DOMのidを知らない。`main.js`の関数を呼ばない。**本作業ではロジックを変えない（コメント・JSDocのみ）**。キャンバスの`mouseup`は購読せず、ドラッグの終了検知は`DragTracker`（`window`へのcapture購読）。
*   **KeyboardShortcuts.js**（`_doc/arch/07_KeyboardShortcuts.md`）：キー→操作の対応表`SHORTCUT_BINDINGS`と受理判定のみ。操作の実体は注入コールバック。`InputTracker.js`から`OperationMode`/`SHAPE_TYPES`/`isTextInputElement`/`isSpaceOperatedInputElement`のみimport。**本作業では対応表・ロジックを変えない（コメントのみ）**。
*   **ShapeFactory.js**（`_doc/arch/10_ShapeFactory.md`）：図形種別一覧の正本`SHAPE_REGISTRY`と導出`SHAPE_TYPES`。並び順＝ボタン順＝数字キーの割り当て順＝`InputTracker`の図形種別の初期値（先頭）。`shapes/`のみをimportし`core/`の他モジュールをimportしない（逆向きは循環import）。他モジュールは種別一覧を自前で列挙しない。**本作業ではコメントのみ**。
*   **WindowManager.js**（`_doc/arch/11_WindowManager.md`）：`.float-window`の検知（コンストラクタ時点のDOMのみ）・ドラッグ移動・最前面化・イベント遮断。開閉には関与しない。**変更しない**。
*   **CanvasManager.js**：状態を持たない描画。`resize()`は`clientWidth/Height`へ内部バッファを同期。**変更しない**。
*   **PointHitRules.js**（`_doc/arch/18_PointHitRules.md`）：`core/`に置いた状態なしの規則の前例。DOM・状態に触れない形で`node --test`で確かめるために切り出したもので、`InputTracker`の再分離ではない。
*   **palette/**（`_doc/arch/13_palette.md`）：自己完結するUI部品。**DOM操作専任で、importを持たず、`VectorModel`・図形データ・選択状態・`InputTracker`に関与しない**（受け取るのは注入された値とコールバックのみ）。`PaletteLauncher`：呼び出し口のボタンと開閉式パレットの対応づけと開閉（`palette.hidden`とボタンの`.active`）、対応表`paletteLaunchers`は`main.js`が唯一の定義箇所。
*   **依存方向**（`PROJECT_ARCHITECTURE.md` 1章）：`main.js → edit → io → core → shapes`の一方向。`core/`は`edit/`・`io/`をimportしない。`core/InputTracker`は`core/PointHitRules`をimportする（`core/`内）。
*   **test/**（`_doc/arch/16_test.md`）：置き場所`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`node:test`・`node:assert/strict`のみ。公開APIのみを通す。テストのためにソースを書き換えない。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止。画面の操作・描画のテストは行わない。実行はプロジェクトのルートで`node --test`（`fail 0`を確かめる）。
*   **憲法**：新設の全`.js`の先頭行に単一責務のJSDoc（3行以内）。クラス・関数・メソッド・定数・typedefにJSDoc。責務定義を逸脱するロジックを足さない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造：`index.html`の説明に「画面の上端にツールバー・下端にステータスバー（固定。フロートウィンドウではない）、キャンバスの領域の寸法は`<style>`の`:root`のカスタムプロパティが唯一の定義箇所」を足す。`core/`に`ToolRules.js    # ツールの一覧と押し込みにするツールの規則（状態なし）。main.jsから使う`を追加。`palette/`の`PaletteController.js`を`ToolPalette.js`に置き換える。`test/core/`に`ToolRules.test.js`を追加。
    *   「存在しないもの」：「ツールバー」を外し、代わりに「ツールバー・ステータスバーの折り返し・横スクロール・項目の省略メニュー（1行固定で右側が切れる）、フロートウィンドウの位置・表示状態の保存、フロートウィンドウを動かせる範囲の制限」等を書く。
    *   フォルダ分割の方針の`core/`：`ToolRules`（ツールの規則。`main.js`から使う）を`PointHitRules`と同じ位置づけとして足す。`palette/`の説明は変えない。
    *   依存方向：「`core/ToolRules`は`core/InputTracker`の`OperationMode`と`core/ShapeFactory`の`SHAPE_TYPES`をimportする（`core/`内。`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない）」を足す。
*   **3章**：
    *   冒頭「同期の経路」：変更なし（ツールパレットの押し込みの表示は`applyMode`・`applyShapeType`の中で同期する旨を必要なら一言）。
    *   1.「読み込み完了前の操作」：覆い要素はキャンバスの領域を覆う。「フロートウィンドウ上のボタン」→「ツールバー・ステータスバー・フロートウィンドウ上のボタン」。
    *   3.「キーボード操作」：数字キーとツールパレットの図形のボタンは`main.js`の`selectShapeTool`（同一経路）を呼ぶ旨。
    *   4.「座標系」：スクリーン座標の原点はキャンバス要素（キャンバスの領域）の左上で、画面の左上ではない。`getScreenCoordinate`が`getBoundingClientRect`で差し引くため、キャンバスの領域が動いても入力の座標は変わらない（キャンバスに枠線・内側の余白を付けない）。
    *   8.「保存・読み込みの問題（`issue`）」：「コントロールパネルのキャンバス名」→「ステータスバーのキャンバス名」。
    *   11.結合：`index.html`の`#selection-join`（ツールバー）。
    *   （新設の節は作らず、操作モード・図形種別とツールパレットの対応は`_doc/arch/02_main.md`と新設の`_doc/arch/19_ToolRules.md`に書く）
*   **4章**：一覧に`ToolRules.js` | `_doc/arch/19_ToolRules.md`を追加。
*   **`_doc/arch/01_index_html.md`**：
    *   画面の領域：`:root`のカスタムプロパティ（`--toolbar-height`・`--statusbar-height`・`--canvas-area-*`・`--float-window-*`）が唯一の定義箇所。キャンバスと覆い要素はまとめた1つのルールで同じ領域に置く（`<canvas>`は置換要素のため`width`/`height`を明示）。07-03の定規は`--canvas-area-top`・`--canvas-area-left`を直す。重なりの順（キャンバス1→覆い5→ツールバー・ステータスバー8→フロートウィンドウ10以上）。キャンバスに枠線・内側の余白を付けない（座標がずれる）。
    *   ツールバー・ステータスバー：固定・1行（`overflow: hidden`で右側が切れる）、まとまり（`.toolbar-group`・`.status-bar-side`/`.status-bar-group`）と隣接セレクタの区切り、項目の足し方、`user-select: none`。保ったid（`#launcher-canvas`・`#history-undo`・`#history-redo`・`#selection-delete`・`#selection-join`・`#canvas-name-display`・`#view-zoom-display`・`#view-reset`）。
    *   ボタンの見た目：アイコンのみ・`.tool-btn icon-btn`・アイコンはマークアップの1か所だけ・説明とショートカットは`title`。
    *   「非活性の表現」：`.disabled`（ウィンドウ全体の非活性）はなくなった。ボタン単体の`disabled`属性と`.tool-btn:disabled`のみ。
    *   「ショートカットの表記」：図形パレット→ツールパレット（`SHAPE_TYPES`の並びに対応する数字）。
    *   「選択操作ボタンの行」「図形選択パレットの位置」「図形選択パレットのボタン」の項を削除し、「ツールパレット」の項（静的・`hidden`なし・`×`なし・見出しの文字なし・id規則`tool-${toolId}`・`ToolPalette`が照合・`tool-`のidを他に使わない・区切りは`.tool-palette-group`・起動時は`#tool-select`だけ`active`）を足す。
    *   ウィンドウの既定の位置（ツールパレット左上・キャンバスパレット右上・プロパティパネルはその左隣・`?dev`はツールパレットの右隣。いずれもツールバーの下）。プロパティパネルの項の`top: 16px; right: 508px`を新しい値へ。
    *   「フロートウィンドウの`×`ボタン」：コントロールパネル・図形選択パレット→ツールパレット・プロパティパネル。
*   **`_doc/arch/02_main.md`**：行数（実装後の値）、主な関数に`selectShapeTool`・`selectTool`・`syncToolPalette`を追加、配線ブロック表の`// 6.`（ツールバー・ステータスバーの配線。`modeButtons`削除）・`// 7.`（ツールパレット：`ToolPalette`の生成、`syncToolPalette`・`applyMode`・`applyShapeType`・`selectShapeTool`・`toolActions`・`selectTool`）、注入の一覧の`PaletteController`行→`ToolPalette`（ルート要素・`TOOL_IDS`・`onToolSelected`＝`selectTool`）、`KeyboardShortcuts`の`setShapeType`＝`selectShapeTool`、同一経路の原則に「図形のボタンと数字キーは`selectShapeTool`、選択・キャンバス移動のボタンと`V`・`H`・`P`は`applyMode`」、「操作モード・図形種別の切替」の項（`modeButtons`・パレットの活性の判断の記述を削除し、`resolveActiveTool`で求めたツールを`toolPalette.setActiveTool`へ渡す・新しいツールの足し方＝`ToolRules`の`TOOL_IDS`・`index.html`の`#tool-<id>`・`toolActions`）、起動時の同期の項。
*   **`_doc/arch/13_palette.md`**：冒頭の「ツールバー・独自のカラーピッカーは未実装」→「独自のカラーピッカーは未実装」（ツールバー・ステータスバーは`index.html`の静的な要素で、配線は`main.js`。`palette/`の部品は無い）。`PaletteController.js`の項を`ToolPalette.js`の項（公開メソッド`setActiveTool`、注入、契約：id規則`tool-${toolId}`・不整合の`console.warn`・照合は1回・操作モードの知識を持たない・`.disabled`を扱わない）へ置き換え。「コントロールパネルの位置づけ」→「ツールバーの位置づけ」（頻繁に使う操作と呼び出し口を置く場所、まとまりごとの足し方）。`PaletteLauncher`の「呼び出し口の追加手順」①の「コントロールパネル内」→「ツールバー内」、④（`#window-shape-palette`の`top`の再調整）を削除。
*   **`_doc/arch/10_ShapeFactory.md`**：「図形パレット」→「ツールパレット」、図形種別の追加手順③を「`index.html`のツールパレットに`id="tool-<type>"`のボタン（アイコン・`title`のショートカット併記）を手で追加する。忘れると起動時に`ToolPalette`の警告」、`PaletteController`はコンストラクタ引数で受け取る→`ToolRules`が`SHAPE_TYPES`から`TOOL_IDS`を導出し`ToolPalette`は`main.js`から受け取る。
*   **`_doc/arch/06_InputTracker.md`・`_doc/arch/07_KeyboardShortcuts.md`・`_doc/arch/11_WindowManager.md`**：コントロールパネル・図形パレットへの言及は無い（確認済み）。`06`は「`OperationMode`をimportするのは`KeyboardShortcuts`・`ToolRules`・`main.js`」を足すか判断する。`11`は「ツールバー・ステータスバーは`.float-window`ではなく管理対象外（イベント遮断も不要）」を足す。
*   **`_doc/arch/16_test.md`**：既存のテストファイルと検証範囲に`test/core/ToolRules.test.js`を追加。「テストできない箇所（07-01の追加）」：`ToolPalette`（DOM）、`main.js`の配線（`selectTool`・`selectShapeTool`・`syncToolPalette`）、`index.html`の画面の領域・ツールバー・ステータスバー・ツールパレット。「書き換えた既存のテスト（07-01）」：無し。
*   **新設`_doc/arch/19_ToolRules.md`**：`ToolRules.js`の責務・公開（`TOOL_IDS`・`resolveActiveTool`）・import（`OperationMode`・`SHAPE_TYPES`）・使う側（`main.js`のみ）・知らないこと（DOM・`InputTracker`のインスタンス・ボタンのid）・置き場所の理由（`PointHitRules`と同じ。`InputTracker`へ入れない）・`null`を返す場合。

## 3. タスクリスト
各タスクの共通の完了条件：(a) 変更・新設したクラス・メソッド・関数・定数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、注入するコールバックの契約、変更したファイルの先頭の責務定義に漏れがないことを確認する。(b) プロジェクトのルートで`node --test`を実行し`fail 0`であること・表示された件数（`tests`・`pass`・`fail`）を「4. 詳細作業内容」に記録する（着手前の基準は`tests 975 / pass 975 / fail 0`）。(c) 起動してこれまでの操作ができ、コンソールにエラーが出ない状態を保つ（合成イベント等で確かめた範囲を記録する）。(d) 「4. 詳細作業内容」の該当欄を記入する。(e) 開発資料に影響があれば資料本体は直さず「開発資料の更新予定」へ追記する。(f) 判断に迷った点・目視確認を推奨する箇所・将来の注意点は「5. 懸念事項・要確認ポイント」へ追記する。

*   [ ] タスク1: ツールの一覧と押し込みにするツールの規則（`ToolRules`）とそのテスト
    *   **対象ファイル** :
        *   `./js/core/ToolRules.js` : 新規
        *   `./test/core/ToolRules.test.js` : 新規（ソースとそれを直接確かめるテストのため同じタスク）
    *   **作業内容** :
        *   2章 要件4(1)のとおり`TOOL_IDS`（凍結）と`resolveActiveTool(mode, shapeType)`を実装する。import は`OperationMode`（`./InputTracker.js`）・`SHAPE_TYPES`（`./ShapeFactory.js`）のみ。DOM・状態なし。
        *   先頭行に単一責務のJSDoc（3行以内。例：「責務：ツール（選択・キャンバス移動・図形の種別）の一覧と、操作モードと図形種別から押し込みの表示にするツールを求める規則を、状態を持たない関数として提供する。DOMに触れない。」）。`TOOL_IDS`・`resolveActiveTool`にJSDoc（`@param`・`@returns`、`null`を返す条件、ツールの識別子の約束＝選択・キャンバス移動は操作モードの値、図形は図形種別の値、ボタンのid`tool-${toolId}`は`index.html`側の約束であり本ファイルはDOMを知らないこと）。
        *   テストは2章 要件8のケース。先頭行に単一責務のJSDoc、補助関数があればJSDoc。
        *   この時点では`main.js`から使わない（画面は変わらない）。
*   [ ] タスク2: ツールパレットのUI部品（`ToolPalette`。まだ使わない）
    *   **対象ファイル** :
        *   `./js/palette/ToolPalette.js` : 新規
    *   **作業内容** :
        *   2章 要件4(2)のとおり`ToolPalette`（`constructor(rootElement, toolIds, onToolSelected)`・`setActiveTool(toolId)`）を実装する。importなし。`console.warn`の文言は2章のとおり。
        *   先頭行に単一責務のJSDoc（3行以内。DOM操作専任・操作モード・`VectorModel`・図形データ・選択状態・`InputTracker`に関与しないことを含める）。定数`TOOL_BUTTON_ID_PREFIX`（`'tool-'`）・クラス・privateフィールド・コンストラクタ・`setActiveTool`にJSDoc（コールバック`onToolSelected(toolId)`の契約を含む）。
        *   この時点では`index.html`・`main.js`から使わない（画面は変わらない。`node --test`は`js/palette/`を読まないが件数を記録する）。
*   [ ] タスク3: 画面の領域（ツールバー・ステータスバーの枠とキャンバスの領域。既存のウィンドウは残す）
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   2章 要件1(1)の`:root`のブロックを`<style>`の先頭に足し、`#editor-canvas, .canvas-loading-cover`のまとめたルールでキャンバスと覆い要素をキャンバスの領域に置く（`#editor-canvas`の`position: absolute`/`top`/`left`/`width: 100vw`/`height: 100vh`と、`.canvas-loading-cover`の`top`/`left`/`width`/`height`を外す。`z-index`・背景・`display: flex`等は残す）。`.canvas-loading-cover`のCSSコメントを「キャンバスの領域を覆い」へ、重なりの順の説明（ツールバー・ステータスバー8を含む）へ改める。
        *   ツールバー・ステータスバーの枠を足す：`<header id="toolbar" class="toolbar"></header>`（中身なし）と、`<footer id="status-bar" class="status-bar">`に空の`<div class="status-bar-side status-bar-left"></div>`・`<div class="status-bar-side status-bar-right"></div>`を、覆い要素の直後・最初のフロートウィンドウの前に置く。CSS：`.toolbar, .status-bar`の共通（`position: fixed; left: 0; right: 0; box-sizing: border-box; display: flex; flex-wrap: nowrap; align-items: center; overflow: hidden; white-space: nowrap; z-index: 8; background-color: #f0f0f0; font-family: sans-serif; user-select: none;`）、`.toolbar`（`top: 0; height: var(--toolbar-height); padding: 0 8px; border-bottom: 1px solid #ccc;`）、`.status-bar`（`bottom: 0; height: var(--statusbar-height); padding: 0 8px; border-top: 1px solid #ccc; justify-content: space-between; font-size: 12px; color: #333;`）、`.toolbar-group`・`.toolbar-group + .toolbar-group`・`.status-bar-side`・`.status-bar-left`・`.status-bar-right`・`.status-bar-group`・`.status-bar-group + .status-bar-group`・`.status-bar-left > .status-bar-group`（2章 要件2・3）。各ルールに役割と1行固定・右側が切れる旨のCSSコメントを書く。
        *   既存のフロートウィンドウ（コントロールパネル・キャンバスパレット・プロパティパネル・`?dev`）の`top: 16px`を`top: var(--float-window-top)`へ、`#window-shape-palette`の`top: 440px`を`top: calc(var(--float-window-top) + 424px)`へ改める（コントロールパネルとの相対の位置を保つ一時的な値。タスク5で削除）。`right`・`left`・`width`はこのタスクでは変えない。位置のCSSコメントのうち`top`の数値に触れている箇所を新しい基準（ツールバーの下）へ合わせる（コントロールパネル基準の説明の全面的な書き直しはタスク5）。
        *   `main.js`は変えない（キャンバスの大きさは`resize`の経路で追従する）。確認：キャンバスがツールバーとステータスバーの間に収まり、四隅付近のクリック・ドラッグ・ホイールのズームがカーソルとずれないこと、リサイズへの追従、読み込み中の覆いがキャンバスの領域だけを覆うこと。
*   [ ] タスク4: ツールバー・ステータスバーへのボタンの移設（idを保つ）
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   コントロールパネルから次を移し、2章 要件2・3のマークアップにする（idを保つ。`disabled`の初期値も保つ。中身はアイコンだけ・`title`はREQ要件5の表のとおり・`class="tool-btn icon-btn"`）：ツールバーへ`#launcher-canvas`（📁）・`#history-undo`（↶）・`#history-redo`（↷）・`#selection-delete`（🗑）・`#selection-join`（🔗）を3つの`.toolbar-group`で。ステータスバーの左側へ`#canvas-name-display`（`class="canvas-name-display"`。中身は空のまま）、右側へ`#view-zoom-display`（`100%`）と`#view-reset`（🎯。`title="表示をリセット (Ctrl+0)"`）を`.status-bar-group`で。
        *   コントロールパネルには`#mode-select`・`#mode-create`・`#mode-pan`だけが残る（タスク5で削除）。
        *   CSS：`.icon-btn`・`.status-bar .icon-btn`を`.tool-btn`のルールの後に足す（2章 要件5）。使われなくなる`.view-zoom-row`・`.history-button-row`（＋`.history-button-row .tool-btn`）・`.selection-button-row`（＋`.selection-button-row .tool-btn`）とそのCSSコメントを削除する。`.canvas-name-display`に`min-width: 0`を足し、CSSコメントを「ステータスバーの左側の開いているキャンバスの名前の表示（長い名前は省略表示し、名前全体は`main.js`が`title`属性に設定する）」へ改める。`#window-canvas-palette`のCSSコメントの「呼び出し口`#launcher-canvas`」がコントロールパネル内を前提にしていれば「ツールバーの」へ改める（位置の数値はタスク5）。
        *   `main.js`は変えない（idで解決しているため）。確認：5つのボタンの働きと押せる/押せない、キャンバスパレットの開閉と押し込み、キャンバス名（`⚠ `・読み込み中・省略表示・`title`）、倍率の追従、表示のリセット、狭い幅で1行のまま右側が切れること。
*   [ ] タスク5: ツールパレットへの切り替えとコントロールパネル・図形選択パレットの削除
    *   **対象ファイル** :
        *   `./index.html` : 更新
        *   `./js/main.js` : 更新
        *   （同じタスクにする理由：ボタンのid（`#mode-*`・`#palette-*`→`#tool-*`）と`main.js`の`getElementById`・`PaletteController`の配線は片方だけ変えると起動時に壊れるため）
    *   **作業内容** :
        *   `index.html`：2章 要件4(4)のツールパレットを静的に置く（`.float-window`の最初＝キャンバスパレットより前）。`#window-control-panel`・`#window-shape-palette`のマークアップを削除する。CSS：`#window-control-panel`・`#window-shape-palette`・`.disabled`のルールとコメントを削除し、`.tool-btn:disabled`のコメントから`.disabled`への言及を除く。`#window-tool-palette`（位置と`width: 44px`）・`#window-tool-palette .window-body`（`padding: 6px; gap: 0;`）・`.tool-palette-group`（`display: flex; flex-direction: column; gap: 4px;`）・`.tool-palette-group + .tool-palette-group`を足す。各ウィンドウの既定の位置を2章 要件6(2)の表の値にし、位置の根拠のCSSコメント（1280×800で重ならないこと・ツールバー/ステータスバーに重ならないこと・`?dev`との関係）を既存と同じ形で書き直す（コントロールパネル・図形選択パレット基準の記述を残さない）。
        *   `main.js`：
            *   import：`PaletteController`を外し、`ToolPalette`（`./palette/ToolPalette.js`）と`TOOL_IDS`・`resolveActiveTool`（`./core/ToolRules.js`）を足す。`SHAPE_TYPES`のimportは残す。
            *   `// 6.`：見出しを「ツールバー・ステータスバー配線」へ。`modeButtons`とそのJSDocを削除。各コメント・JSDocの「コントロールパネルの〜」を「ツールバーの〜」「ステータスバーの〜」へ改める（処理は変えない）。`resetViewToCenter`のJSDocは「キャンバスの領域（キャンバス要素。ツールバー・ステータスバーを除いた領域）の中心」へ。
            *   `// 7.`：見出しを「ツールパレット配線」へ。`shapePaletteEl`・`paletteController`・モードボタンのクリック登録（`Object.entries(modeButtons).forEach(...)`）を削除し、2章 要件4(5)の`toolPalette`・`syncToolPalette`・`applyMode`・`applyShapeType`・`selectShapeTool`・`toolActions`・`selectTool`に置き換える。各関数・定数にJSDoc（`applyMode`/`applyShapeType`は「切替後に実状態を読み返し`resolveActiveTool`で求めたツールを押し込みにする」、`syncToolPalette`は「`applyMode`・`applyShapeType`の中からだけ呼ぶ」、`selectShapeTool`は「図形のボタンと数字キーの共通経路」、`toolActions`は「識別子は`TOOL_IDS`と同じ」）。
            *   `// 8.`：`setShapeType`コールバックを`(type) => { selectShapeTool(type); return true; }`へ（コメント「図形種別切替。…パレットと同一経路」を「ツールパレットの図形のボタンと同一経路」へ）。`setMode`のコメント「モードボタンと同一経路」を「ツールパレットの選択・キャンバス移動のボタンと同一経路」へ。
            *   その他のコメント：`performUndo`/`performRedo`/`performJoin`/`syncDeleteButtonState`/`syncJoinButtonState`/`syncHistoryButtonState`/`syncZoomDisplay`/`paletteLaunchers`（「index.htmlへ呼び出し口のボタン」→「ツールバーへ」）/起動時初期化（「モードボタンの.active・パレットの.disabled・パレット内ハイライト」→「ツールパレットの押し込みの表示」）等の「コントロールパネル」「図形選択パレット」「図形パレット」「モードボタン」を実態へ改める。
        *   確認：7つのボタンで常にちょうど1つが押し込み、図形のボタン1回で描ける、`V`・`H`・`P`・`1`〜`5`（テンキー）と押し込みの一致、貼り付け・全選択・キャンバスの切り替え・インポートで選択へ戻ったときの追従、ツールパレットが半透明にならずドラッグで動かせる、起動時の`console.warn`が出ない、コンソールにエラーが出ない。
*   [ ] タスク6: 使われなくなった`PaletteController.js`の削除
    *   **対象ファイル** :
        *   `./js/palette/PaletteController.js` : 削除
    *   **作業内容** :
        *   リポジトリ内（`index.html`・`js/`・`test/`・`sprite-check.html`）に`PaletteController`の参照が残っていないことを`Grep`で確かめてから削除する（開発資料の記述は最終タスクで直す）。
*   [ ] タスク7: `PaletteLauncher.js`のコメント・JSDocの修正
    *   **対象ファイル** :
        *   `./js/palette/PaletteLauncher.js` : 更新（コメント・JSDocのみ）
    *   **作業内容** :
        *   責務定義の「コントロールパネルの呼び出し口のボタン」→「ツールバーの呼び出し口のボタン」。クラスJSDocの「呼び出し口（コントロールパネル上の、…）」→「（ツールバー上の、…）」、「後続のパレットの追加方法」1.に「呼び出し口のボタンはツールバーの`.toolbar-group`に置く」、「対応表に含まれないウィンドウのうち、コントロールパネル・図形パレットには×が無い」→「ツールパレット・プロパティパネルには×が無い」。ロジック・`console.warn`の文言は変えない。
*   [ ] タスク8: `core/`のコメント・JSDocの修正
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新（コメント・JSDocのみ）
        *   `./js/core/KeyboardShortcuts.js` : 更新（コメント・JSDocのみ）
        *   `./js/core/ShapeFactory.js` : 更新（コメント・JSDocのみ）
        *   （同じタスクにする理由：3ファイルとも同じ観点（図形パレット・コントロールパネルの用語をツールパレットへ）のコメントだけの置き換えで、ロジックに触れず、用語を1度に揃えるため）
    *   **作業内容** :
        *   `InputTracker.js`：36行「操作モード。コントロールパネルの各ボタンはこの値に1対1で対応する。」→「操作モード。ツールパレットの「選択」「キャンバス移動」のボタンはSELECT・PANに、図形のボタンはCREATE（と図形種別）に対応する（対応の規則は`ToolRules.js`）。」の趣旨へ。324行「（図形パレットの先頭ボタン）」→「（ツールパレットの最初の図形のボタン）」。
        *   `KeyboardShortcuts.js`：75行「SHAPE_TYPESの並び＝図形パレットのボタンの並び順」→「ツールパレットの図形のボタンの並び順」。
        *   `ShapeFactory.js`：17行「図形パレット・数字キーに出さず」→「ツールパレット・数字キーに出さず」、24行「図形パレットのボタン順」→「ツールパレットの図形のボタン順」、25行「パレットのボタンは不要」→「ツールパレットのボタンは不要」、26行「index.htmlに`#palette-${type}`のボタンを用意する」→「index.htmlのツールパレットに`#tool-${type}`のボタンを用意する（`ToolRules`の`TOOL_IDS`は`SHAPE_TYPES`から導出されるため変更不要）」、47行「パレットの配線」→「ツールパレットの配線（`ToolRules`の`TOOL_IDS`経由）」。
        *   作業後に`js/`全体を`Grep`（`コントロールパネル|図形選択パレット|図形パレット|図形作成のボタン|palette-|mode-create`）し、残りが無いことを確かめる（`index.html`も同様）。
*   [ ] タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映（固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・3章・4章）
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
        *   `./_doc/arch/10_ShapeFactory.md` : 更新
        *   `./_doc/arch/11_WindowManager.md` : 更新
        *   `./_doc/arch/06_InputTracker.md` : 必要な場合のみ更新
        *   `./_doc/arch/19_ToolRules.md` : 新規
    *   **作業内容** :
        *   各タスクで「開発資料の更新予定」に記録した内容を確認し、`PROJECT_ARCHITECTURE.md`冒頭の記載基準（残す：責務と境界・依存方向・流れと順序・誰が呼ぶか/注入するか・設計判断の理由・やらないこと・公開メソッド名、書かない：1ファイルのJSDocで分かること）に従って反映する。`main.js`の行数は実装後の値を書く。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする（後続タスクが無く、他タスクの前提が動かないため）。個別の実装タスク内では資料を書き換えない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: ツールの一覧と押し込みにするツールの規則（`ToolRules`）とそのテスト
*   **作業内容** :
    *   (未着手)

### タスク2: ツールパレットのUI部品（`ToolPalette`。まだ使わない）
*   **作業内容** :
    *   (未着手)

### タスク3: 画面の領域（ツールバー・ステータスバーの枠とキャンバスの領域。既存のウィンドウは残す）
*   **作業内容** :
    *   (未着手)

### タスク4: ツールバー・ステータスバーへのボタンの移設（idを保つ）
*   **作業内容** :
    *   (未着手)

### タスク5: ツールパレットへの切り替えとコントロールパネル・図形選択パレットの削除
*   **作業内容** :
    *   (未着手)

### タスク6: 使われなくなった`PaletteController.js`の削除
*   **作業内容** :
    *   (未着手)

### タスク7: `PaletteLauncher.js`のコメント・JSDocの修正
*   **作業内容** :
    *   (未着手)

### タスク8: `core/`のコメント・JSDocの修正
*   **作業内容** :
    *   (未着手)

### タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映（固定タスク）
*   **作業内容** :
    *   (未着手)

## 5. 懸念事項・要確認ポイント
### 計画時点の判断・注意点
* **スコープ外の変更**：なし。REQで見込まれた範囲（`index.html`・`js/main.js`・`js/palette/`・新設の規則とテスト・`core/`3ファイルのコメント）に収まる。`CanvasManager`・`ViewTransform`・`WindowManager`・`DragTracker`・`InputTracker`のロジック・`KeyboardShortcuts`の対応表は変えない。
* **`console.warn`の文言**：`PaletteController`の2つの警告は、対象の名前（`PaletteController`→`ToolPalette`、図形種別→ツール）だけを変えて`ToolPalette`へ移す。他のエラー文・警告文は変えない。
* **`core/`内の新しい依存**：`core/ToolRules`→`core/InputTracker`（`OperationMode`）・`core/ShapeFactory`（`SHAPE_TYPES`）。循環なし。`test/core/ToolRules.test.js`は`InputTracker.js`を間接にimportする（モジュールの最上位でDOMに触れないことを確認済み。将来`InputTracker.js`の最上位でDOMに触れる変更をするとこのテストが壊れる）。
* **ツールの識別子と操作モードの値の一致**：選択・キャンバス移動のツールの識別子は`OperationMode`の値と同じ（`'select'`・`'pan'`）。`OperationMode`の値を変えるとボタンのid（`#tool-select`・`#tool-pan`）と`index.html`が食い違う（起動時に`ToolPalette`の警告で分かる）。図形種別に`'select'`・`'pan'`という名前を足さないこと（`TOOL_IDS`の重複はテストで検出する）。
* **キャンバスに枠線・内側の余白を付けない**：`getScreenCoordinate`の比`clientWidth / rect.width`がずれるため。07-03で定規を足すときもキャンバス自体ではなく`:root`の`--canvas-area-*`で領域を狭めること。
* **ステータスバーの名前の縮み方**：狭い幅では先にキャンバスの名前が省略表示で縮み、それでも足りないと右側（倍率・リセット）が画面の外へ切れる。07-03で左側に座標を足すときは、座標のまとまりを縮ませない（`flex: none`）等の扱いを決めること。
* **カーソルがツールバー・ステータスバーへ出たときのホバー**：キャンバスの外へ出てもホバーの表示は残る（キャンバスの`mouseleave`を購読していないため。従来のフロートウィンドウの上へ出た場合と同じ）。今回は変えない。
* **ツールバー・ステータスバーの上での`Ctrl`+ホイール**：キャンバスの`wheel`に届かないため、ブラウザ自体の拡大縮小が起きる（従来のフロートウィンドウの上と同じ）。今回は変えない。
* **既定の位置の高さの見積もり**：キャンバスパレットの下端（約565px）・プロパティパネルの下端（約378px）は文字の大きさ・絵文字の表示に依存する見積もり。1280×800でステータスバー（上端772px）に届かないことを目視で確認してほしい。
* **持ち越し事項の扱い**（参考）：図形パレットの`.disabled`の件（2章B【Phase02-01/02】）・「コントロールパネルの高さ」（2章C）はツールパレットへの統合・コントロールパネルの削除で解消する見込み。`_doc/COWORK_STATUS.md`は本作業では読まず・直さない（発注者側で外す）。

### テストプレイの確認項目（操作手順 → 期待する結果）
※【実ブラウザ】は、実装AIの合成イベントでは確かめられず、実際のブラウザでの確認が要る項目。

**A. 画面の領域（要件1・DIRの実装要件）**
1. ページを開く → 上端にツールバー、下端にステータスバーが固定で表示され、キャンバス（白・グリッド）はその間に収まる。原点の印がキャンバスの領域の中央にある。コンソールにエラー・警告が出ない。
2. ツールバー・ステータスバーをドラッグしようとする → 動かない。`×`が無い。
3. キャンバスの上端付近・下端付近に図形を描く → 図形がツールバー・ステータスバーの下に隠れず、描いた位置がカーソルの位置と一致する。
4. キャンバスの四隅付近（左上・右上・左下・右下。ツールパレットの無い所）でクリック・ドラッグで図形を描く・選ぶ・動かす → 押した位置・ドラッグの位置がカーソルとずれない。
5. キャンバスの四隅付近でホイールを回す → カーソルの下の点を中心に拡大・縮小する（カーソルの下の図形が動かない）。
6. ブラウザのウィンドウの大きさを変える（広げる・狭める・高さを変える）→ キャンバスがツールバーとステータスバーの間に追従して収まり、図形が伸び縮みしたりぼやけたりしない。その後も4・5のとおりずれない。
7. 🎯（表示のリセット）を押す／`Ctrl`+`0` → 倍率100%で原点がキャンバスの領域の中央（ツールバーとステータスバーの間の中央）に来る。
8. `Ctrl`+`+`／`Ctrl`+`-` → キャンバスの領域の中央を中心に拡大・縮小する（中央の点が動かない）。
9. ブラウザのウィンドウの幅をツールバー・ステータスバーの項目が収まらない幅まで狭める → どちらも1行のまま高さが変わらず、右側の項目が画面の外に切れる。横スクロールバーは出ない。ステータスバーは先にキャンバスの名前が`…`で省略される。
10. 【実ブラウザ】ブラウザの表示倍率（`Ctrl`+ホイール／メニューの拡大縮小）やOSの拡大率を変える → 4・5の位置がカーソルとずれない。キャンバスの線がぼやけない。
11. ページを開いた直後（読み込み中）→ キャンバスの領域だけが「読み込み中…」で覆われ、キャンバスを押しても図形ができない。ツールバー・ステータスバー・ツールパレット・プロパティパネルのボタンは押せる（キャンバスパレットの開閉、ツールの切り替え等）。読み込み完了で覆いが消える。※読み込みが速くて見えない場合は開発者ツールのネットワーク・CPUの低速化等で確かめる。
12. ツールパレット・プロパティパネル・キャンバスパレット・`?dev`の確認用ウィンドウをヘッダーでドラッグしてツールバー・ステータスバーの上へ重ねる → 重ねられ、ウィンドウが手前に表示される。ウィンドウのボタンは押せる。
13. ツールバー・ステータスバーの何もない所・ボタンをクリックする → キャンバスで図形ができない・選択が変わらない（ボタンはそのボタンの働きだけをする）。
14. 選択モードで図形を本体ドラッグ中／範囲選択中／パン中（キャンバス移動・`Space`＋ドラッグ・中ボタン）に、カーソルをツールバー・ステータスバー・ツールパレットの上へ出す → ドラッグが続き（図形・選択矩形・表示が追従）、ボタンを離した所で終わる。離した後の最初のキャンバスのクリックが正しく効く（無視されない）。ツールバーのボタンの上で離してもそのボタンは押されない。

**B. ツールバー（要件2）**
15. 📁を押す → キャンバスパレットが開き、📁が押し込みの表示になる。もう一度押す／パレットの`×`→ 閉じて押し込みが外れる。
16. 図形を描く → ↶が押せるようになる。↶ → 取り消される。↷ → やり直される。履歴が無いとき↶・↷は押せない表示。描いている途中（直線の1点目の後）は↶が押せ、押すと作成途中の図形だけが消える。
17. 図形を選ぶ → 🗑が押せるようになり、押すと削除される。何も選んでいないときは押せない表示。
18. 直線を2本描き、端点を近づけて両方選ぶ → 🔗が押せるようになり、押すと1本のパスになる。結合できない選択では押せない表示。
19. マウスを各ボタンに載せる → `title`の説明とショートカットが出る（REQ要件5の表のとおり）。押せないボタンに載せても色が変わらない。

**C. ステータスバー（要件3）**
20. 起動直後 → 左側に「読み込み中…」、読み込み後はキャンバスの名前、ページのタイトルは`<名前> - OZ Vector Editor`。
21. 長い名前のキャンバスを開く → 名前が`…`で省略され、マウスを載せると名前全体が出る。
22. 保存できない状態（`file://`の制限・保存の失敗等、再現できる範囲で）→ 名前の先頭に`⚠ `が付く。
23. ホイール・`Ctrl`+`+`/`-`・🎯 → 右側の倍率の表示が追従する。

**D. ツールパレット（要件4・DIRの実装要件）**
24. 起動直後 → 画面の左端・ツールバーのすぐ下に縦1列（🖱 ✋ ／区切り／ ／ 〜 ◠ ▭ ◯）のツールパレットがあり、🖱だけが押し込みの表示。JSの読み込み前（再読み込みの瞬間）も🖱が押し込み。
25. 各図形のボタン（／〜◠▭◯）を1回押す → すぐにその図形を描ける状態になり、そのボタンだけが押し込みになる（「図形作成」を押す手順は無い）。描いた図形の種類がボタンと一致する。
26. ✋を押す → キャンバス移動になり（左ドラッグでパン）、✋だけが押し込み。🖱 → 選択になり🖱だけが押し込み。
27. どのツールの状態でも → ツールパレットは半透明にならず、全ボタンが押せ、ヘッダーをドラッグして動かせる。7つのうち常にちょうど1つだけが押し込み。
28. 【実ブラウザ】`V` → 🖱が押し込み（選択）。`H` → ✋が押し込み。`1`〜`5`（テンキーの`1`〜`5`も）→ 対応する図形（直線・曲線・弧・矩形・円）のボタンが押し込みになり、その図形を描ける。
29. 【実ブラウザ】起動直後に`P` → 直線のボタンが押し込みになり直線を描ける。`3`（弧）を押した後`V`で選択に戻し、`P` → 弧のボタンが押し込みになり弧を描ける。
30. 図形作成の状態（例：矩形）で、図形をコピー（選択モードで`Ctrl`+`C`）しておき、矩形のボタンを押してから`Ctrl`+`V` → 選択に切り替わって貼り付けられ、🖱が押し込みになる。
31. 図形作成の状態で`Ctrl`+`A` → 選択に切り替わって全選択され、🖱が押し込み。
32. 図形作成／キャンバス移動の状態で、キャンバスパレットから別のキャンバスを開く・新規作成・開く（ファイル）・インポート → 選択に切り替わり🖱が押し込み。
33. ツールパレットのボタンを押した直後に`Space`を押しながらドラッグ → パンになり、ボタンは押されない（フォーカスがボタンに残っていても）。`Enter` → フォーカス中のボタンが押される（今のコントロールパネルと同じ）。

**E. ボタンの見た目（要件5）**
34. 【実ブラウザ】ツールバー・ステータスバー・ツールパレットのボタン → 文字のラベルが無くアイコンだけ。絵文字（📁🗑🔗🎯🖱✋）と記号（↶↷／〜◠▭◯）の大きさ・縦位置が大きく不ぞろいでなく、ボタンの大きさがそろい、アイコンが中央にある。押し込み・押せない・マウスを載せた（押せるときのみ）の見た目が区別できる。
35. キャンバスパレット・プロパティパネル・`?dev`の確認用ウィンドウの中のボタン・欄 → 見た目（文字のラベルを含む）が今と同じ。

**F. なくすもの・ウィンドウの既定の位置（要件6）**
36. コントロールパネル・図形選択パレット・「図形作成」のボタンが無い。アプリ名「OZ Vector Editor」の見出しも無い（ページのタイトルにある）。
37. 画面を1280×800（以上）にして`?dev`付きで開き、📁でキャンバスパレットを開く → ツールパレット（左上）・キャンバスパレット（右上）・プロパティパネル（キャンバスパレットの左隣）が互いに重ならず、ツールバー・ステータスバーにも重ならない。`?dev`の確認用ウィンドウはツールパレットの右隣にあり、ツールパレットと重ならない。
38. ウィンドウを動かしてから再読み込み → 既定の位置に戻る（保存しない）。

**G. 既存の操作（要件7）**
39. 図形の作成（5種）・選択（クリック・範囲選択）・移動・頂点の変形・削除（🗑・`Delete`/`Backspace`）・結合（🔗・`J`）・端点への吸い付き・描き足し・取り消し/やり直し（↶↷・`Ctrl`+`Z`/`Y`/`Shift`+`Z`）・コピー/切り取り/貼り付け/複製（`Ctrl`+`C`/`X`/`V`/`D`）・重なり順（「重なり順」の段・`Home`/`PageUp`/`PageDown`/`End`）・`Escape`・プロパティパネル（線・塗り・太さ・色）が今までと同じに動く。
40. キャンバスパレット（新規作成・開く・名前の変更・削除・出力（作業ファイル）・出力（エンジン用）・開く（ファイル）・インポート）・自動保存（編集後に再読み込みして残っている）・`?dev`の確認用ウィンドウ（JSONへ変換・JSONから復元・`×`）が今までと同じに動く。
41. 【実ブラウザ】既存のショートカット全般（上記のキーと`Ctrl`+`0`/`+`/`-`・`Space`のパン）をキーボードで実際に押して確かめる。プロパティパネルの太さの欄・色の欄・チェックボックスにフォーカスがあるときの扱い（スペースパン・ショートカットが働かない／`Ctrl`付きは働く）が今と同じ。
