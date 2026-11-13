# RES: 作業計画・作業レポート (Phase 07-03) : 表示（定規・カーソル位置の座標・表示の切り替え・全体を画面に収める）
* 参照元REQ: `./_log/req/261113_2127_REQ_Phase07-03_Display.md`

## 1. 作業目的
座標と見え方を画面で確かめられるようにする。足すものは次の5つ。
*   **定規**：ツールバーの下（横）と画面の左端（縦）に常に表示する。グリッドの太線の位置にワールド座標の数字、細線の位置に短い目盛り、カーソル位置の印。
*   **ステータスバーの表示**：カーソル位置のワールド座標・選択中の図形の外枠の幅と高さ・グリッド1マスの大きさ。
*   **表示の切り替え**：アウトライン表示（`Z`）・背景の白/黒（`X`）・グリッドの表示（`C`）・フロートウィンドウをまとめて隠す/出す（`Tab`）と、それぞれのボタン。
*   **全体を画面に収める**ボタン（キーなし）。

表示の状態（アウトライン・背景・グリッド・パレットの表示）は、作業データ・書き出し・履歴・ブラウザの保存先のいずれにも入れない（作業データの版・書き出し形式の版は2のまま）。図形の作成・選択・移動・変形・削除・結合・スタイル・重なり順・コピー/貼り付け・取り消し/やり直し・自動保存・ファイル入出力の働きは変えない（変わるのは、アウトライン表示の間の塗った内側のクリックだけ）。表示の状態がすべて初期値のとき、キャンバスの描画結果・当たり分類・既存のショートカットは今と同じ（変わるのは、定規の分だけキャンバスの領域が狭くなること、ツールバー・ステータスバーの項目が増えること、`Tab`・`Z`・`X`・`C`が働くこと）。

## 2. アーキテクチャ設計
**全体の分担（新設は1ファイル1責務）**

| 置き場所 | ファイル | 責務 | テスト |
| --- | --- | --- | --- |
| `core/`（新） | `DisplayState.js` | 表示の状態4つの保持・切り替え・変更通知（表示専用の状態。`ViewTransform`と同じ位置づけ） | `test/core/DisplayState.test.js` |
| `core/`（新） | `GridSpacingRules.js` | 表示倍率からグリッドの細線・太線の間隔を求める規則（状態なし） | `test/core/GridSpacingRules.test.js` |
| `core/`（新） | `RulerTickRules.js` | 定規の目盛りの位置（ワールド座標と太線か）と数字の文字列の規則（状態なし） | `test/core/RulerTickRules.test.js` |
| `core/`（新） | `RulerRenderer.js` | 定規2本の描画（引数だけから毎回描く、状態を持たないレンダラー） | 対象外（テストプレイ） |
| `core/`（新） | `CanvasCursorTracker.js` | キャンバス上の最後のカーソル位置（スクリーン座標）の保持と変更通知 | 対象外（テストプレイ） |
| `core/`（新） | `ViewFitRules.js` | 全体を画面に収める表示倍率とオフセットの計算（状態なし） | `test/core/ViewFitRules.test.js` |
| `core/`（新） | `StatusReadoutRules.js` | ステータスバーの座標・大きさ・グリッドの表示の文字列の規則（状態なし。文言の唯一の定義箇所） | `test/core/StatusReadoutRules.test.js` |
| `edit/`（新） | `ShapeExtentReader.js` | 選択中の図形・全図形の外枠の照会（`SpriteSerializer`の外枠の入口を使う） | `test/edit/ShapeExtentReader.test.js` |
| `palette/`（新） | `ViewToggleGroup.js` | ステータスバーの表示の切り替えのまとまり（3ボタン）の表示と押下の通知（DOM操作専任） | 対象外（テストプレイ） |
| `core/`（変更） | `CanvasManager.js` | グリッドの間隔を`GridSpacingRules`から得る、配色の組、背景の塗り、グリッドの表示、アウトライン表示 | 対象外 |
| `core/`（変更） | `ViewTransform.js` | 表示倍率とオフセットを一度に設定する`setView` | `test/core/ViewTransform.setView.test.js`（新） |
| `core/`（変更） | `PointHitRules.js` | `classifyPointHit`の第6引数`includeFill` | `PointHitRules.test.js`へ追加 |
| `core/`（変更） | `InputTracker.js` | 第6引数`isFillHitExcluded`の注入と`#classifyPoint`での受け渡しのみ | 対象外 |
| `core/`（変更） | `KeyboardShortcuts.js` | 対応表へ`Z`・`X`・`C`・`Tab`の4エントリ、typedefへ4コールバック | 対象外 |
| `shapes/`（変更） | `Line`・`Curve`・`Rect`・`Ellipse`・`Path` | 共通メソッド契約の16番目`drawOutline(ctx, viewScale, color)` | 各図形のテストへ追加 |
| `io/`（変更） | `SpriteSerializer.js` | 公開の外枠の入口`computeShapesBounds(shapes)` | `SpriteSerializer.test.js`へ追加 |
| `palette/`（変更） | `PaletteLauncher.js` | 隠している間の📁の規則（照会と「出す」を注入で受け取る） | 対象外 |
| `palette/`（変更） | `ToolPalette.js` | コメントのみ | なし |
| — | `index.html`・`main.js` | 定規・ステータスバーの項目・ボタン・CSS、配線 | 対象外 |

**依存（すべて既存の方向`main.js → edit → io → core → shapes`の範囲内）**：`core/CanvasManager → core/GridSpacingRules`、`core/RulerRenderer → core/GridSpacingRules・core/RulerTickRules`（`core/`内。`GridSpacingRules`・`RulerTickRules`は何もimportしない）、`edit/ShapeExtentReader → io/SpriteSerializer`（下向き）。`DisplayState`・`ViewFitRules`・`StatusReadoutRules`・`CanvasCursorTracker`・`ViewToggleGroup`は何もimportしない。`main.js`は新設の全ファイルと`ViewTransform`（静的定数）をimportする。`core/`は`edit/`・`io/`・`palette/`をimportしない（`ShapeExtentReader`を`edit/`に置くのはこのため）。

### 要件1: 表示の状態の持ち主と同期の経路（`core/DisplayState.js`）
*   **クラス`DisplayState`**（先頭の責務の例：「責務：表示の状態（アウトライン表示・背景の白/黒・グリッドの表示・フロートウィンドウの表示）の保持・切り替え・変更通知のみを担う。DOM・VectorModel・CanvasManager・図形に依存しない（表示専用の状態）。」）。何もimportしない。
    *   非公開フィールドと初期値：`#outline = false`・`#darkBackground = false`・`#gridVisible = true`・`#floatWindowsVisible = true`・`#listeners = []`。
    *   typedef`DisplayStateSnapshot`＝`{ outline: boolean, darkBackground: boolean, gridVisible: boolean, floatWindowsVisible: boolean }`。
    *   `getState()`：呼ぶたびに新しいプレーンオブジェクト（`DisplayStateSnapshot`）を返す（書き換えても内部は変わらない）。
    *   `isOutline()`・`isFloatWindowsVisible()`：真偽値を返す（`InputTracker`・`PaletteLauncher`へ注入する照会に使う。`main.js`で否定を書かないため）。
    *   `setOutline(value)`・`setDarkBackground(value)`・`setGridVisible(value)`・`setFloatWindowsVisible(value)`：`value`が真偽値でなければ`console.warn`（例：`DisplayState.setOutline: 真偽値ではない値が指定されました: ${value}`）して何もしない。値が変わらなければ通知しない。変われば1回通知する。
    *   `toggleOutline()`・`toggleBackground()`・`toggleGrid()`・`toggleFloatWindows()`：反転して1回通知する（中身は対応する`set…`を`!現在値`で呼ぶ）。
    *   `onChange(callback)`：関数以外は無視（`ViewTransform.onChange`と同じ形）。非公開`#notifyChange()`。
*   **持たないところ**：`VectorModel`・`InputTracker`・`CanvasManager`・作業データ・スナップショット・`CanvasLibrary`・`SnapshotAdapter`・`HistoryManager`・`DocumentSerializer`は表示の状態を知らない。`main.js`が1つだけ生成し、キャンバスの切り替え（開く・新規作成・開く（ファイル）・削除後・取り消し/やり直し・`?dev`の復元）では触れないため、表示の状態は保たれる。ページを開き直すと初期値に戻る（保存しない）。
*   **同期の経路**：開発資料3章冒頭「同期の経路」の一覧へ、`displayState.onChange`（要件1）と`cursorTracker.onChange`（要件2・3で認められたカーソル位置の通知。定規とステータスバーの座標の文字だけを更新し、キャンバスは再描画しない）を足す。機能ごとの専用の再描画・同期の呼び出しは書かない。
    *   `displayState.onChange` → `renderCurrentState`（キャンバスの再描画）・`syncViewToggleGroup`（▢◐▦の押し込み）・`syncFloatWindowVisibility`（`body`のクラスと🧰の押し込み）。
    *   ボタンとキーは同じ操作（`displayState.toggleOutline()`等のメソッド）を呼ぶ（同一経路の原則。削除ボタンとキーが`inputTracker.deleteSelection()`を呼ぶのと同じ形）。ボタンの表示は操作の中ではなく通知で同期する（キーで切り替えてもボタンの表示が追従する）。起動時にも各同期関数を明示的に1回呼ぶ。
*   **読み込み中・作成途中**：表示の切り替えは図形一式を変えないため、読み込み中（覆い要素が出ている間）・図形の作成途中でも受け付ける（判定を足さない）。ドラッグ中のキーは`KeyboardShortcuts`の手順5により実行されない（`ctrl: false`のため`preventDefault()`もしない）。

### 要件2: 定規
*   **グリッドの間隔の規則の切り出し（`core/GridSpacingRules.js`）**：`CanvasManager.js`の定数`GRID_BASE_SPACING`（10）・`GRID_MIN_SCREEN_SPACING`（8）・`GRID_MAX_SPACING_STEPS`（10）と`#drawGrid`の中の間隔の決め方を、そのまま移す（定数はモジュール内の非公開。`CanvasManager.js`から3つの定数と繰り上げのループを削除する）。
    *   `export function computeGridSpacing(scale)` → `{ minor: number, major: number }`。式は切り出し前と同じ：`let minor = GRID_BASE_SPACING; for (let i = 0; i < GRID_MAX_SPACING_STEPS && minor * scale < GRID_MIN_SCREEN_SPACING; i++) { minor *= 10; } return { minor, major: minor * 10 };`。不正な倍率でも例外を投げずに停止しない（`0`・負は10回繰り上げて`1e11`、`NaN`・`Infinity`は`10`。JSDocに明記。呼び出し側は今までどおり正の有限の倍率だけを描く）。
    *   使うのは`CanvasManager.#drawGrid`（倍率の検査は`CanvasManager`に残す）・`RulerRenderer`・`main.js`のグリッド1マスの表示の3か所（同じ関数。二重に書かない）。切り出しでグリッドの見た目（線の位置・間隔・間引き）は変わらない。
*   **定規の目盛りの計算（`core/RulerTickRules.js`）**：DOM・`ctx`に触れない。何もimportしない。
    *   `export function computeRulerTicks(minValue, maxValue, minorSpacing, majorSpacing)` → `Array<{ value: number, major: boolean }>`（`value`の昇順）。`minValue`〜`maxValue`（両端を含む）にある細線の位置を「整数インデックス`i` × `minorSpacing`」で求める（`i`は`Math.ceil(minValue / minorSpacing)`から`i * minorSpacing <= maxValue`の間。加算の誤差を累積させない）。`major`は`ratio = Math.round(majorSpacing / minorSpacing)`として`((i % ratio) + ratio) % ratio === 0`。`value`の`-0`は`0`へ正規化する（`i * minorSpacing + 0`等）。引数が有限の数でない・間隔が正でない・`ratio < 1`・`minValue > maxValue`のときは空配列を返す（例外を投げない）。
    *   `export function formatRulerLabel(value)` → 整数の文字列（`Math.round`して`-0`は`'0'`。例：`-200`→`'-200'`）。
*   **定規の描画（`core/RulerRenderer.js`）**：`CanvasManager`と同じ「引数だけから毎回描く、状態を持たないレンダラー」。保持するのは2つの`<canvas>`要素・2Dコンテキスト・dprのみ。`ViewTransform`・`DisplayState`・`VectorModel`をimportしない（importは`GridSpacingRules`・`RulerTickRules`のみ）。
    *   `constructor(horizontalCanvas, verticalCanvas)`：どちらかが無ければ`console.warn`（例：`RulerRenderer: 定規の要素が見つかりません。描画しません。`）し、以後`resize`・`render`は何もしない。あれば最後に`resize()`を呼ぶ。
    *   `resize()`：`CanvasManager.resize()`と同じ考え方（`window.devicePixelRatio || 1`、各要素の`clientWidth`/`clientHeight` × dprへ内部バッファを同期。`render`は呼ばない）。
    *   `render({ view = DEFAULT_VIEW, cursor = null } = {})`：`view`は`{ scale, offsetX, offsetY }`（`viewTransform.getState()`）、`cursor`はキャンバス要素左上基準のスクリーン座標`{x, y}`または`null`。2本とも全体を消してから描く（地の色はCSS。下記）。倍率が正の有限値でなければ目盛りを描かない。
        *   **ワールド⇔定規の位置の写し方**：横の定規の左端・縦の定規の上端は、CSSでキャンバスの領域の左端・上端にそろえる（下記`index.html`）ため、定規の位置＝キャンバスのスクリーン座標の同じ軸の値。`CanvasManager`が描画変換の行列とその逆行列で写すのと同じく、ビュー変換値を行列`new DOMMatrix([scale, 0, 0, scale, offsetX, offsetY])`として組み、逆行列で定規の両端の位置からワールドの範囲を求め、行列で各目盛りの`value`を定規上の位置へ写す（変換式を手で書かない）。
        *   範囲の目盛りは`computeGridSpacing(view.scale)`の`minor`・`major`で`computeRulerTicks`を呼んで得る（グリッドと同じ間隔。ズームで細線10→100→1000、太線100→1000→10000と繰り上がると定規も同じに変わる）。
        *   描き方（CSSピクセルで`setTransform(dpr, 0, 0, dpr, 0, 0)`。グリッドと同じく位置を画素に丸めない＝グリッドの線と同じ位置に出る）：細線の位置はキャンバス側の辺から長さ5pxの短い目盛り、太線の位置は定規の太さいっぱい（20px）の長い目盛りと、その横に`formatRulerLabel(value)`の数字（`10px sans-serif`）。横の定規は目盛りが縦線で数字は太線の右側に横書き。縦の定規は目盛りが横線で、数字は太線の下側に`-90°`回転して描く（`save`→`translate`→`rotate(-Math.PI / 2)`→`fillText`→`restore`。定規の幅20pxに収まる）。太線の画面上の間隔は80px以上（`GRID_MIN_SCREEN_SPACING` × 10）で、`-10000`等の6文字でも約36pxのため隣の数字と重ならない。
        *   **カーソル位置の印**：`cursor`が`null`でなければ、横の定規の`x = cursor.x`、縦の定規の`y = cursor.y`に1pxの線を定規の太さいっぱいに描く（`null`なら描かない）。
        *   定数（ファイルの中にまとめる。背景の白/黒によらず一定）：目盛りの色`#888888`・数字の色`#444444`・数字のフォント`10px sans-serif`・印の色`#e00000`・細線の目盛りの長さ5px。地の色は描かない（`<canvas>`は透明に消し、地はCSSの`.ruler`の背景色＝ツールバー・ステータスバーと同じ枠の色。定規の角の要素と色を1か所で共有するため。下記`index.html`）。
*   **再描画の契機**：既存の経路（`viewTransform.onChange`・ウィンドウの`resize`）と`cursorTracker.onChange`（要件3）だけ。`main.js`の`renderRulers()`（`rulerRenderer.render({ view: viewTransform.getState(), cursor: cursorTracker.getScreenPosition() })`）をこの3か所に登録し、起動時に1回呼ぶ。ウィンドウの`resize`は`canvasManager.resize()` → `rulerRenderer.resize()` → `renderCurrentState()` → `renderRulers()`の順。
*   **`index.html`（キャンバスの領域を狭める）**：
    *   `:root`に`--ruler-size: 20px;`（定規の太さの唯一の定義箇所）を足し、`--canvas-area-top: calc(var(--toolbar-height) + var(--ruler-size));`・`--canvas-area-left: var(--ruler-size);`の**2行を直す**（`--canvas-area-width`・`--canvas-area-height`・覆い要素・`--float-window-top`/`--float-window-left`は追従する）。
    *   `:root`に`--frame-background-color: #f0f0f0;`を足し、`.toolbar, .status-bar`の`background-color`をこの変数へ置き換える（値は同じ。定規・角の地と1か所で共有するため）。
    *   要素：`<canvas id="ruler-horizontal" class="ruler"></canvas>`・`<canvas id="ruler-vertical" class="ruler"></canvas>`・`<div id="ruler-corner" class="ruler"></div>`を`#canvas-loading-cover`の直後に静的に置く（`.float-window`ではない。`WindowManager`の管理対象外）。
    *   CSS：`.ruler { position: fixed; z-index: 8; background-color: var(--frame-background-color); }`。横`#ruler-horizontal { top: var(--toolbar-height); left: var(--canvas-area-left); width: var(--canvas-area-width); height: var(--ruler-size); }`、縦`#ruler-vertical { top: var(--canvas-area-top); left: 0; width: var(--ruler-size); height: var(--canvas-area-height); }`、角`#ruler-corner { top: var(--toolbar-height); left: 0; width: var(--ruler-size); height: var(--ruler-size); }`（角は何も描かない枠）。定規の`<canvas>`にも枠線・内側の余白を付けない（定規の位置とキャンバスの座標がずれるため）。縦の定規はステータスバーの上で終わる（`--canvas-area-height`）。
    *   **`#editor-canvas`に枠線・内側の余白を付けない**（`InputTracker.getScreenCoordinate`がずれるため）。
    *   **重なり**：定規は`z-index: 8`（ツールバー・ステータスバーと同じ）＝キャンバス（1）・覆い要素（5）より手前、フロートウィンドウ（10以上）より奥。定規はキャンバスの兄弟要素のため、その上の押下・クリック・ホイールはキャンバスへ届かない（ツールバーと同じで、専用のイベント遮断は不要。`InputTracker`はキャンバス要素だけを購読する）。定規の上の`Ctrl`+ホイールのブラウザの拡大縮小は抑止しない（Non-goal）。
*   **定規が入った後の確認（実コードで確認済み）**：`main.js`の`resetViewToCenter`・`zoomAtCanvasCenter`は`canvas.clientWidth`/`clientHeight`を使うため、狭まった後のキャンバスの領域の中心へ追従する（変更不要）。`InputTracker.getScreenCoordinate`は`getBoundingClientRect`で差し引くため、クリック・ドラッグ・ホイールの位置はずれない。フロートウィンドウの既定の位置は`--float-window-top`（40＋20＋8＝68px）・`--float-window-left`（20＋8＝28px）へ追従する。
*   **CSSコメントの位置・範囲の数値（1280×800）を実態へ改める**：ツールパレット＝`top` 68px・`left` 28px、x 28〜74・y 68〜約374。`?dev`の確認用ウィンドウ＝`left: calc(var(--float-window-left) + 54px)`＝82px、x 82〜444・y 68〜。キャンバスパレット＝y 68〜約585（x 1030〜1272は変わらない）。キャンバスパレットと`?dev`の確認用ウィンドウは画面幅が約700px以上なら重ならない（444＋250＝694）。

### 要件3: カーソル位置の座標（ステータスバー）
*   **カーソル位置の追跡（`core/CanvasCursorTracker.js`。`InputTracker`へ入れない）**：先頭の責務の例：「責務：キャンバス上の最後のカーソル位置（スクリーン座標。キャンバスの外なら「なし」）の保持と変更通知のみを担う。VectorModel・ViewTransform・図形に依存しない。」何もimportしない。
    *   `constructor(canvas, { getScreenPoint, screenToWorld })`：`getScreenPoint`・`screenToWorld`が関数でなければ`Error`（例：`CanvasCursorTracker: getScreenPoint・screenToWorld は関数で指定してください`）。`canvas`の`mousemove`で位置を記録（前と違うときだけ通知）、`mouseleave`で「なし」にする（前が「なし」でなければ通知）。`getScreenPoint`は`main.js`が`(event) => inputTracker.getScreenCoordinate(event)`を注入する（スクリーン座標の求め方を二重に書かない。`DragTracker`と同じ）。`screenToWorld`は`(x, y) => viewTransform.screenToWorld(x, y)`を注入する（変換は`ViewTransform.screenToWorld`だけ）。
    *   `getScreenPosition()` → `{x, y}`のコピーまたは`null`（定規の印に使う）。
    *   `getWorldPosition()` → 呼んだ時点の`screenToWorld(x, y)`の結果または`null`（ステータスバーの座標に使う。ビュー変換が変わった後に呼べば、最後のカーソル位置から求め直した値になる）。
    *   `onChange(callback)`：関数以外は無視。
    *   ページを開いた直後（まだ`mousemove`が無い）は`null`。
*   **実コードで確かめた動き（計画書に記載する要件）**：
    *   **ドラッグ中**：`DragTracker`は`window`のcaptureで`mousemove`を購読し、`InputTracker.handleMouseMove`はドラッグ中は何もしないが、キャンバス要素の`mousemove`自体は発火する（`stopPropagation`されない）ため、カーソルがキャンバスの上にある間は追跡が続く。ドラッグのままツールバー・定規・ステータスバー・フロートウィンドウの上へ出るとキャンバスの`mouseleave`で「なし」になり、ドラッグ自体は`DragTracker`が続ける。
    *   **パン中**：`DragTracker`の`window`のcaptureの`mousemove`（→`panBy`→`viewTransform.onChange`→座標の表示を古い位置で求め直す）が先に、続いてキャンバスの`mousemove`（→位置の更新→通知）が来るため、1回のマウスの移動の後の表示は正しい値になる。
    *   **フロートウィンドウの上**：フロートウィンドウはキャンバスの子ではない兄弟要素で、`WindowManager`が`mousemove`の伝播を止めるが、キャンバスは祖先ではないため影響しない。カーソルがキャンバスからウィンドウの上へ移るとキャンバスの`mouseleave`が発火して「なし」になる。
    *   **読み込み中**：覆い要素（`z-index: 5`）がキャンバスの上にあるためキャンバスの`mousemove`は来ず「なし」のまま。
*   **表示の文字列の規則（`core/StatusReadoutRules.js`）**：何もimportしない。文言・記号（`X:`・`Y:`・`W:`・`H:`・`グリッド:`・`—`）の唯一の定義箇所（モジュール内の`Object.freeze`した定数）。
    *   `formatReadoutNumber(value)`：有限の数でなければ`'—'`。それ以外は`Math.round(value * 10) / 10`で小数第1位に丸めてから`-0`を`0`にして`toFixed(1)`（`-0.04`→`'0.0'`。`-0.0`と表示しない）。
    *   `formatCursorReadout(point)`：`point`が`null`なら`'X: —  Y: —'`、それ以外は`'X: 120.5  Y: -40.0'`（項目の間は半角空白2つ）。
    *   `formatSizeReadout(bounds)`：`bounds`が`null`なら`'W: —  H: —'`、それ以外は`W`＝`maxX − minX`・`H`＝`maxY − minY`を`formatReadoutNumber`で（例：`'W: 120.0  H: 80.0'`）。
    *   `formatGridReadout(spacing)`：`'グリッド: 10px'`（`spacing`は整数の想定。有限の数でなければ`'グリッド: —'`）。整数のまま表示する。
    *   `StatusReadoutRules`を使うのは`main.js`だけ（`ToolRules`と同じ「`main.js`から使うUIの表示の規則」の位置づけ）。
*   **表示の更新（`main.js`の同期関数。`syncZoomDisplay`と同じ形）**：`syncCursorReadout()`＝`cursorReadoutEl.textContent = formatCursorReadout(cursorTracker.getWorldPosition())`。登録先：`cursorTracker.onChange`・`viewTransform.onChange`（キー操作・全体を画面に収める・ホイールのズーム・キャンバスの切り替えによる表示のリセットでビュー変換が変わったら、最後のカーソル位置から求め直す）。起動時に1回。マウスの移動のたびに`model.onChange`を通知せず、キャンバス全体も再描画しない（更新するのはステータスバーの文字と定規だけ）。
*   **ホバーの強調がキャンバスの外で残る件**は今のまま（変えない）。

### 要件4: 選択中の図形の大きさ・グリッド1マスの大きさ（ステータスバー）
*   **両方入れる**（下記の作りで制約の中で作れる）。
*   **外枠の公開の入口（`io/SpriteSerializer.js`）**：`static computeShapesBounds(shapes)` → `SpriteBounds | null`。中身は`return SpriteSerializer.#computeBounds(shapes.map((shape) => shape.toDrawElement()));`（既存の計算をそのまま使う。外枠の求め方を二重に書かない）。図形0個で`null`。`serialize`の出力は1バイトも変えない（`serialize`は変更しない）。JSDocに「`serialize(shapes).bounds`と同じ値」「`@throws`は`serialize`の外枠の計算と同じ（未知の`kind`・`toDrawElement`を持たない要素）」。先頭の責務定義に「外枠の照会」を足す（3行以内）。
*   **外枠の照会（`edit/ShapeExtentReader.js`。`core/`は`io/`をimportできないため`edit/`に置く。`main.js`に選択の絞り込みの判定を書かないため）**：先頭の責務の例：「責務：選択中の図形・全図形の外枠（書き出しの外枠`bounds`と同じ求め方）の照会のみを担う。DOMに触れない。」
    *   `constructor({ model })`（他の`edit/`のクラスと同じく検証しない）。
    *   `getSelectedBounds()`：`SpriteSerializer.computeShapesBounds(model.getShapes().filter((shape) => model.isSelected(shape.id)))`（描画順のまま。選択なしで`null`）。
    *   `getAllBounds()`：`SpriteSerializer.computeShapesBounds(model.getShapes())`（図形0個で`null`。見えない図形も含む）。
    *   作成途中の図形は`getShapes()`に含まれないため対象外。図形・選択集合・履歴に触れない。
*   **選択中の図形の大きさの表示**：`main.js`の`syncSelectionSizeReadout()`＝`selectionSizeReadoutEl.textContent = formatSizeReadout(shapeExtentReader.getSelectedBounds())`。`model.onChange`へ登録（ドラッグでの移動・変形の途中も追従する。既存の経路）。起動時に1回。
*   **グリッド1マスの大きさの表示**：`main.js`の`syncGridSizeReadout()`＝`gridSizeReadoutEl.textContent = formatGridReadout(computeGridSpacing(viewTransform.getScale()).minor)`。`viewTransform.onChange`へ登録。起動時に1回。グリッドを非表示にしている間も表示したまま（`displayState`を見ない）。

### 要件5: 表示の切り替え（アウトライン・背景・グリッド）
*   **キー（`KeyboardShortcuts.js`の`SHORTCUT_BINDINGS`）**：次の4エントリを末尾（`duplicate`の後）に足す。既存のエントリは変えない（`Tab`は要件7）。
    *   `{ codes: ['KeyZ'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleOutline' }`
    *   `{ codes: ['KeyX'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleBackground' }`
    *   `{ codes: ['KeyC'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleGrid' }`
    *   `KeyZ`・`KeyX`・`KeyC`は`ctrl`の値で既存の`Ctrl`+`Z`（取り消し。`ctrl: true`）・`Ctrl`+`X`・`Ctrl`+`C`と排他的に区別される（`#findBinding`は`binding.ctrl === ctrlPressed`で照合）。`Shift`+`Z`・`Ctrl`+`Shift`+`Z`の扱いも変わらない。
    *   typedef`ShortcutActions`へ`toggleOutline`・`toggleBackground`・`toggleGrid`（・要件7の`toggleFloatWindows`）を足す（「受理したら`true`。表示の状態を切り替えるだけで常に`true`」）。入力欄にフォーカスがある間は既存の手順2・4で働かない。
    *   `main.js`の注入：`toggleOutline: () => { displayState.toggleOutline(); return true; }`（`toggleBackground`・`toggleGrid`も同じ形）。
*   **アウトライン表示（共通メソッド契約の16番目`drawOutline(ctx, viewScale = 1, color)`）**：各図形クラスに足す。輪郭のパスは各クラスの`draw`・`drawHover`が組み立てるパスと同じ（`Line`＝`beginPath`→`moveTo(x1, y1)`→`lineTo(x2, y2)`。`Curve`＝`beginPath`→`moveTo(points[0])`→`quadraticCurveTo(points[1], points[2])`。`Rect`＝`beginPath`→`moveTo(points[0])`→`lineTo(points[1..3])`→`closePath`。`Ellipse`＝`beginPath`→`ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)`→円のみ`closePath`（弧は開いたまま）。`Path`＝`#tracePath(ctx)`（閉じたパスは`closePath`））。続けて`ctx.strokeStyle = color` → `ctx.lineWidth = 1 / viewScale` → `ctx.stroke()`。**`fill`を呼ばず、`strokeColor`・`strokeWidth`・`fillColor`を読まない**（線なし・塗りなし・何も描かれない図形でも輪郭を描く）。既存の`draw`は変えない（`CodeExporter`の`DRAW_SOURCE`と手で揃えているため）。
    *   各クラスのクラスJSDocの「共通メソッド契約（15メソッド：…）」を「共通メソッド契約（16メソッド：…・hitTestFill・drawOutline）」へ改める（5クラスとも同じ文言）。`drawOutline`のJSDocは「（共通メソッド契約の第16メソッド）」。
    *   `CanvasManager`は図形種別の分岐を持たず、`render`の`outline`が真なら`shape.drawOutline(ctx, view.scale, scheme.outline)`、偽なら`shape.draw(ctx)`をポリモーフィックに呼ぶ（作成途中の図形も同じ）。ホバーの強調（`drawHover`）・ハンドル・範囲選択の矩形・吸い付きの表示は今のまま描く。
*   **配色の組（`CanvasManager.js`）**：個別の色の定数`GRID_MINOR_COLOR`・`GRID_MAJOR_COLOR`・`ORIGIN_AXIS_COLOR`・`ORIGIN_MARK_COLOR`を削除し、`COLOR_SCHEMES`（`Object.freeze`した2組。各組も`Object.freeze`）にまとめる：
    *   `light`（白の背景用。今の見た目と同じ値）：`background: '#ffffff'`・`gridMinor: 'rgba(0, 0, 0, 0.06)'`・`gridMajor: 'rgba(0, 0, 0, 0.14)'`・`originAxis: 'rgba(0, 0, 0, 0.32)'`・`originMark: 'rgba(0, 0, 0, 0.6)'`・`outline: '#000000'`。
    *   `dark`（黒の背景用）：`background: '#000000'`・`gridMinor: 'rgba(255, 255, 255, 0.10)'`・`gridMajor: 'rgba(255, 255, 255, 0.22)'`・`originAxis: 'rgba(255, 255, 255, 0.45)'`・`originMark: 'rgba(255, 255, 255, 0.75)'`・`outline: '#ffffff'`（白系は黒の上で薄く見えやすいため透明度を少し上げる。テストプレイで見え方を確かめる）。
    *   `render`の`darkBackground`が真なら`dark`、偽なら`light`を使う。`#drawGrid(view, scheme)`・`#drawOrigin(view, scheme)`は組の色を使う（`#strokeGridLines`は色を引数で受けるまま）。
*   **背景の塗り**：`render`の手順1を「恒等変換にして、内部バッファ全体を`scheme.background`で`fillRect`する（`save`/`restore`で`fillStyle`を残さない）」へ改める（従来の`clearRect`を置き換える）。`index.html`の`#editor-canvas`の`background-color: #ffffff`は**削除**し（背景の色の定義を配色の組の1か所にするため）、`#editor-canvas`のルールに「背景の色はCanvasManagerの配色の組で塗る（CSSでは付けない）」とコメントする。描画前の一瞬（`main.js`の実行前）は覆い要素（白の半透明）と`body`の`#f9f9f9`が見えるだけで、`DOMContentLoaded`の直後に描画される。白の背景を不透明に塗った結果は、透明に消してCSSの白の上に描いていた今と見た目が同じ。読み込み中の覆い要素は今のまま。
*   **グリッドの表示**：`render`の`showGrid`が偽のときは`#drawGrid`（細線・太線）だけを描かない。軸線と原点マーク（`#drawOrigin`）は常に描く。定規は消さない。
*   **`render`の引数**：描画状態へ`outline = false`・`darkBackground = false`・`showGrid = true`を足す。省略時は今と同じ見た目（アウトラインOFF・白・グリッド表示）。`main.js`の`renderCurrentState`が`displayState.getState()`の`outline`・`darkBackground`・`gridVisible`を渡す。
*   **描画順（改めた後）**：背景の塗り → グリッド（`showGrid`のとき） → 軸線・原点マーク → 全図形の`draw`または`drawOutline`（＋ホバー中の図形の`drawHover`） → 選択集合の図形の`drawHandles` → 作成途中の図形の`draw`または`drawOutline` → 吸い付きの表示 → 選択矩形。
*   **黒の背景での見え方（実コードで各色を確認）**：ハンドル（白の塗り・`#4a90e2`の枠）・ホバーの強調（`rgba(74, 144, 226, 0.4)`の太線）・範囲選択の矩形（`#4a90e2`の破線・薄い青の塗り）・吸い付きの表示（`#4a90e2`の塗り・`#1f4e8c`の枠）は黒の上でも見える見込みのため変えない。`Curve.drawHandles`の始点⇔制御点・終点⇔制御点の点線（`rgba(0, 0, 0, 0.4)`）は黒の背景ではほぼ見えないが、ハンドル自体（白・青）は見えるため変えない（`drawHandles`の変更はNon-goal。5章に記載）。図形の色は変えない（黒い線の図形は黒の背景で見えない。仕様）。
*   **ボタン（ステータスバーの右側）**：UI部品`palette/ViewToggleGroup.js`（要件8）。押し込み（`.active`）＝アウトライン表示がON・背景が黒・グリッドが表示中。`aria-pressed`は付けない。

### 要件6: アウトライン表示の間の、塗った内側のクリック
*   **規則の正本（`core/PointHitRules.js`）**：`classifyPointHit(shapes, isSelected, x, y, tolerance, includeFill = true)`へ第6引数を足し、`findBodyHit`へ渡す。`findBodyHit`の2つ目のループの条件を`shape.hitTest(x, y, tolerance) || (includeFill && shape.hitTestFill(x, y))`へ改める（1つ目のループ＝選択集合の図形の輪郭の優先と、`findHandleHit`は変えない）。省略時は今と同じ結果（既存のテストはそのまま通る）。JSDocの規則の要約・`@param`・ファイル先頭の責務定義（「塗った内側を当たりに含めるかは引数で受け取る」）を改める。
    *   含めないとき：塗った内側は空白（範囲選択を始められる）。手前の塗った図形に隠れていた奥の図形の輪郭が、見えているとおりに選ばれる。選択集合の図形の輪郭の優先とハンドルは変わらない。
*   **`InputTracker.js`（照会の受け取りと受け渡しだけ）**：
    *   コンストラクタの第6引数`isFillHitExcluded = () => false`（「塗った内側を当たりに含めないかの照会。真なら含めない。省略時は常に含める」）。関数でなければ`console.warn`（例：`InputTracker: isFillHitExcluded が関数ではないため、塗った内側を常に当たりに含めます`）して既定の関数を使う。非公開フィールド`#isFillHitExcluded`に保持する。既存の5つの引数の意味は変えない。
    *   `#classifyPoint`で`classifyPointHit(…, this.#getWorldHitTolerance(), !this.#isFillHitExcluded())`と渡すだけ。ホバー・カーソル・押下・クリックの4か所は`#classifyPoint`の結果を共用しているため、すべて同じ規則になる。
    *   `InputTracker`は表示の状態・アウトライン表示という言葉を知らない（JSDocにも書かない）。`main.js`が`() => displayState.isOutline()`を注入する。
    *   切り替えた直後のホバーの強調・カーソルの形は、次にマウスを動かすまで前のまま（専用の再評価は足さない）。
*   範囲選択（`intersectsRect`）・ハンドルの当たり・結合・吸い付きは変えない。

### 要件7: フロートウィンドウをまとめて隠す/出す（`Tab`とツールバーのボタン）
*   **対象**：すべての`.float-window`（ツールパレット・キャンバスパレット・`?dev`の確認用ウィンドウ）。ツールバー（オプションバーを含む）・定規・ステータスバーは隠れない。
*   **隠し方（`index.html`のCSS）**：`body.float-windows-hidden .float-window { display: none; }`。各ウィンドウの`hidden`属性（キャンバスパレットの開閉・`?dev`の`×`）・位置（`style.left`/`top`）・重なり順（`style.zIndex`）には触れないため、外すと隠す前の状態（開いていたウィンドウだけが元の位置・重なりで）に戻る。`.float-window`とその中の要素は`display`を指定していないため、このルールと`hidden`属性は衝突しない。
*   **状態と同期**：`displayState`の`floatWindowsVisible`。`main.js`の`syncFloatWindowVisibility()`が`document.body.classList.toggle('float-windows-hidden', !displayState.isFloatWindowsVisible())`と🧰（`#float-windows-toggle`）の`.active`（表示中＝押し込み）を同期する。`displayState.onChange`へ登録し、起動時に1回呼ぶ。クラス名`float-windows-hidden`は`index.html`のCSSと`main.js`のこの関数の2か所（DOMのクラス名は`core/`へ持ち込まない）。
*   **キー`Tab`**：`{ codes: ['Tab'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'toggleFloatWindows' }`を要件5の3エントリの後に足す。`main.js`の注入：`toggleFloatWindows: () => { displayState.toggleFloatWindows(); return true; }`（受理したので`preventDefault()`され、フォーカスは移らない）。
    *   **実コードで確かめた動き（`KeyboardShortcuts`の手順は変えない）**：テキスト入力扱いの欄（太さの欄`type="number"`は`TEXT_INPUT_TYPES`に含まれる、`?dev`の`textarea`）にフォーカスがある間は手順2で何もしない（従来どおりフォーカスの移動）。色の欄（`type="color"`）は手順4（`ctrl: false`かつ`isSpaceOperatedInputElement`）で何もしない（フォーカスの移動）。ボタン（`aria-pressed`の有無によらない）・何もフォーカスが無い（`body`）ときは手順4の対象外で実行される（隠す/出す。`Tab`でボタンからボタンへフォーカスを移すことはできなくなる）。`Shift`+`Tab`は`FORBIDDEN`で一致せずブラウザのフォーカスの移動。`Ctrl`+`Tab`は`ctrl`が一致せず、`Alt`+`Tab`は`#findBinding`がAlt押下で`null`。ドラッグ中は手順5で実行されず、`ctrl: false`のため`preventDefault()`もされない（ブラウザのフォーカスの移動。今と同じ）。
*   **ツールバーのボタン🧰**：最初のまとまり（📁のあるまとまり）の📁の左に`<button type="button" id="float-windows-toggle" class="tool-btn icon-btn" title="パレットを隠す／出す (Tab)">🧰</button>`。`click`で`displayState.toggleFloatWindows()`（`Tab`と同じ操作）。
*   **隠している間の📁（`palette/PaletteLauncher.js`の開閉の規則として持つ）**：
    *   コンストラクタへ第2引数`options = {}`（`{ isFloatWindowsVisible, showFloatWindows }`）を足す。`isFloatWindowsVisible`（既定`() => true`）・`showFloatWindows`（既定`() => {}`）。指定されて関数でなければ`console.warn`して既定を使う。省略時は今と同じ動き。
    *   呼び出し口のボタンの`click`：`isFloatWindowsVisible()`が偽なら`showFloatWindows()`を呼び、パレットを必ず開く（`#setOpen(button, palette, true)`。隠す前に開いていた場合も閉じない）。真なら今までどおり開閉を反転。`×`で閉じる働き・対応表の形・起動時の`.active`の合わせ方は変えない。隠している間、📁の`.active`は各パレットの開閉の状態のまま。
    *   `main.js`の注入：`new PaletteLauncher(paletteLaunchers, { isFloatWindowsVisible: () => displayState.isFloatWindowsVisible(), showFloatWindows: () => displayState.setFloatWindowsVisible(true) })`（`main.js`に判定を書かない）。
*   **その他**：隠している間もショートカット（`V`・`H`・数字・`P`等）のツールの切り替えは働き、ツールパレットの押し込みの表示は`syncToolPalette`で内部的に同期される（`display: none`の要素の`classList`も更新される）。隠したウィンドウの中にフォーカスがあった場合は専用の制御を足さない。
*   **`WindowManager`は変えない**：起動時に`.float-window`を配線済み。ウィンドウの見出しをドラッグ中に`Tab`で隠しても、`WindowManager`の`window`のcaptureの`mousemove`は`#draggingWindow`の`style.left`/`top`を更新し続け、`mouseup`・`blur`・`buttons === 0`で終わる（止まったままにならない。出すとドラッグした先の位置に出る）。ウィンドウのドラッグは`InputTracker`のドラッグではないため、`Tab`は手順5で止まらない。

### 要件8: ボタンの並び・アイコン・`title`・幅、UI部品と配線
*   **足すボタン**（アイコンは仮。`index.html`のそのボタンのマークアップの1か所だけに書き、JS・CSSに重ねない。`class="tool-btn icon-btn"`。文字のラベルなし。押し込みは`.active`、`aria-pressed`は付けない＝フォーカス中の`Space`はパン。`InputTracker`の`isSpaceYieldedElement`は変えない）：

    | 置き場所 | id | アイコン | `title` | 押し込み |
    | --- | --- | --- | --- | --- |
    | ツールバーの最初のまとまり（📁の左） | `float-windows-toggle` | 🧰 | `パレットを隠す／出す (Tab)` | パレットを表示している間 |
    | ステータスバーの右側・表示の切り替えのまとまり`#view-toggle-group` | `view-outline-toggle` | ▢ | `アウトライン表示 (Z)` | ONの間 |
    | 同上 | `view-background-toggle` | ◐ | `背景の白／黒を切り替え (X)` | 黒の間 |
    | 同上 | `view-grid-toggle` | ▦ | `グリッドの表示 (C)` | 表示している間 |
    | ステータスバーの右側・表示倍率のまとまり（🎯の左） | `view-fit` | ⛶ | `全体を画面に収める` | なし |

    *   `title`のキーの表記（`Tab`・`Z`・`X`・`C`）は`SHORTCUT_BINDINGS`と手動で同期する（落とさない）。押し込みの初期状態は`index.html`に書かない（起動時の同期関数が付ける。既定値を二重に書かないため）。
*   **ステータスバーのマークアップ（左から）**：
    *   左側`.status-bar-left`：キャンバスの名前のまとまり（既存。`class="status-bar-group status-bar-group-shrink"`を付ける）→ `<div class="status-bar-group"><span id="cursor-readout" class="status-readout"></span></div>` → `<div class="status-bar-group"><span id="selection-size-readout" class="status-readout"></span></div>` → `<div class="status-bar-group"><span id="grid-size-readout" class="status-readout"></span></div>`（文字は起動時の同期が入れる）。
    *   右側`.status-bar-right`：`<div id="view-toggle-group" class="status-bar-group">`（▢・◐・▦）→ 既存の表示倍率のまとまり（`#view-zoom-display` → ⛶`#view-fit` → 🎯`#view-reset`）。Phase 07-05のスナップのまとまりは、`.status-bar-group`を足すだけで並ぶ（今の作りを保つ）。
*   **ステータスバーのCSS**：
    *   `.status-bar-group`に`flex: none;`を足す（既定は縮まない）。`.status-bar-left > .status-bar-group { flex: 0 1 auto; min-width: 0; }`のルールを削除し、`.status-bar-group-shrink { flex: 0 1 auto; min-width: 0; }`を足す（名前のまとまりだけが縮む）。
    *   `.status-bar-left`の`min-width: 0`を削除する（`flex: 1 1 auto`は残す）。左側の最小の幅が縮まない3つのまとまりの合計になり、幅が足りないときはまず名前が省略表示で縮み、それでも足りないと右側が今の規則どおり右端から画面の外へ切れる（左側の表示が右側へ重ならないため）。
    *   `.status-readout { white-space: pre; font-variant-numeric: tabular-nums; }`（ステータスバーの`white-space: nowrap`は連続する空白を1つにまとめるため、項目の間の空白2つを保つ）。最小の幅：`#cursor-readout { min-width: 24ch; }`・`#selection-size-readout { min-width: 22ch; }`・`#grid-size-readout { min-width: 17ch; }`（`X: -99999.9  Y: -99999.9`＝24文字、`W: 99999.9  H: 99999.9`＝22文字、`グリッド: 10000px`＝かな4文字×約2ch＋9文字。数字の桁が変わっても右側の項目が揺れない。これを超える桁ではその分だけ伸びる）。
*   **幅の見積もり（1280px幅）**：
    *   **ツールバー全体**：左右の余白16px＋最初のまとまり68px（ボタン32×2＋間隔4。🧰で32→68）＋取り消し/やり直し68px＋削除/結合68px＋区切り17px×4＋スタイル約218px＋重なり順140px＝**約646px**（足す前は約610px）。実測の最後のボタン⏬の右端（約601px）は約637pxになる見込みで、1280px幅で全項目が切れずに収まる。`index.html`のCSSコメント「オプションバー（…）の幅の見積もり」は見出しを「ツールバー全体の幅の見積もり」へ改め、この数値へ直す。
    *   **ステータスバー**：左右の余白16px。左側の縮まない3つのまとまり＝座標約161px（24ch×約6.7px）＋大きさ約147px＋グリッド約114px＋区切り17px×3（名前と座標の間を含む）＝約473px。右側＝`margin-left` 8px＋表示の切り替え80px（24×3＋4×2）＋区切り17px＋表示倍率約91px（倍率の文字約35＋4＋⛶24＋4＋🎯24）＝約196px。名前に残る幅は1280−16−473−196＝**約595px**で全項目が収まる（名前が極端に長い場合は名前が省略表示になる）。
*   **UI部品と配線の分け方（決定と理由）**：既存の作りにそろえて「**複数のボタンのまとまりは`palette/`のUI部品、単独のボタンと文字の表示は`main.js`**」とする。
    *   `palette/ViewToggleGroup.js`（新）：表示の切り替えのまとまり（3ボタン）。オプションバーの`OptionBarOrderGroup`と同じ形（ルート要素`#view-toggle-group`とコールバック3つ`onToggleOutline`・`onToggleBackground`・`onToggleGrid`を受け取り、ルート要素内の`querySelector('#view-outline-toggle')`等で解決。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない＝`render`は何もしない。`render(view)`で各ボタンの`.active`を`view.outline`・`view.darkBackground`・`view.gridVisible`で付け外しする）。importなし。`VectorModel`・図形データ・`DisplayState`（持ち主）・規則を知らない。typedef`ViewToggleView`（`outline`・`darkBackground`・`gridVisible`）は`DisplayState.js`の`DisplayStateSnapshot`の一部の写し（キー名を変えるときは両方を揃える旨をJSDocに書く）。理由：まとまりの`.active`の付け外しと配線をUI部品に閉じ、`main.js`（701行）の増加を抑える。Phase 07-05のスナップのまとまりも同じ形で足せる。
    *   `main.js`：🧰・⛶（単独のボタン。削除・結合・取り消し・🎯と同じ形）、座標・大きさ・グリッドの表示（`syncZoomDisplay`と同じ`textContent`の同期）、`body`のクラスの同期。
    *   どちらも`main.js`に判定を書かず、UI部品に`VectorModel`・図形データ・表示の状態の持ち主・規則を持ち込まない。
*   **`main.js`の配線ブロック（番号の並びを保つ）**：
    *   `// 2.`：`RulerRenderer`の生成を`CanvasManager`の生成の直後に足す（`rulerRenderer = new RulerRenderer(document.getElementById('ruler-horizontal'), document.getElementById('ruler-vertical'))`）。
    *   `// 3.2.`（新。`// 3.`の後・`// 3.5.`の前）：`DisplayState`の生成（`const displayState = new DisplayState();`）。
    *   `// 4.`：`InputTracker`の第6引数に`() => displayState.isOutline()`。`InputTracker`の生成の直後に`CanvasCursorTracker`の生成（要件3）。`renderCurrentState`へ表示の状態の3項目、`renderRulers`の追加、`displayState.onChange(renderCurrentState)`・`viewTransform.onChange(renderRulers)`・`cursorTracker.onChange(renderRulers)`の登録、`resize`の手順（要件2）。
    *   `// 6.5.`（新。`// 6.`の後・`// 7.`の前）「表示配線（ステータスバーの座標・大きさ・グリッドの表示、表示の切り替えのまとまり、パレットを隠す、全体を画面に収める）」：`ShapeExtentReader`の生成、`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`と登録、`ViewToggleGroup`の生成と`syncViewToggleGroup`・登録、🧰と`syncFloatWindowVisibility`・登録、⛶と`fitViewToShapes`。
    *   `// 7.6.`：`PaletteLauncher`の第2引数（要件7）。
    *   `// 8.`：`KeyboardShortcuts`へ4コールバック。
    *   起動時の同期（末尾）：`renderRulers()`・`syncCursorReadout()`・`syncSelectionSizeReadout()`・`syncGridSizeReadout()`・`syncViewToggleGroup()`・`syncFloatWindowVisibility()`を、既存の同期関数の呼び出しと同じ形（理由のコメント付き）で`canvasLibrary.start()`の前に足す。
    *   見込みの行数：約840行（約140行の増加）。配線ブロックの切り出しは本作業では行わない（5章）。

### 要件9: 全体を画面に収める
*   **`ViewTransform.setView(scale, offsetX, offsetY)`（公開メソッドを1つ足す）**：`scale`が正の有限の数でない、または`offsetX`・`offsetY`が有限の数でなければ`console.warn`（例：`ViewTransform.setView: 不正な値が指定されました: scale=${scale}, offsetX=${offsetX}, offsetY=${offsetY}`）して何もしない。`scale`は`MIN_SCALE`〜`MAX_SCALE`に収める。収めた後の値が今と同じなら通知しない。変われば3つを設定して通知を1回。変換式は持たない（設定だけ）。先頭の責務定義に「表示倍率とオフセットの一括設定」を足す。
*   **収める計算（`core/ViewFitRules.js`。DOMに触れない・状態を持たない・何もimportしない）**：
    *   `export const FIT_VIEW_MARGIN_PX = 40;`（画面上の余白。各辺）。
    *   `export function computeFitView(bounds, viewportWidth, viewportHeight, { minScale, maxScale, margin = FIT_VIEW_MARGIN_PX })` → `{ scale, offsetX, offsetY }`。
        1. `bounds`が`null`（図形0個）なら`{ scale: 1, offsetX: viewportWidth / 2, offsetY: viewportHeight / 2 }`（表示のリセットと同じ結果＝100%・原点が領域の中心）。
        2. 範囲の幅`w = maxX − minX`・高さ`h = maxY − minY`、使える大きさ`availW = viewportWidth − 2 × margin`・`availH = viewportHeight − 2 × margin`。正の`w`・`h`の軸だけで`avail ÷ 長さ`の候補を求め、その最小を倍率とする（一方が0ならもう一方だけ。両方0なら1）。候補が有限の数でなければ1とする。
        3. `minScale`〜`maxScale`に収める（`avail`が0以下で倍率が0以下になる＝領域が余白より小さい場合は`minScale`になり、停止しない）。
        4. 範囲の中心`cx = (minX + maxX) / 2`・`cy = (minY + maxY) / 2`が領域の中心に写るオフセット：`offsetX = viewportWidth / 2 − cx × scale`・`offsetY = viewportHeight / 2 − cy × scale`。
    *   フロートウィンドウに隠れる部分は考慮しない。ウィンドウの大きさの変更には追従しない（押した時点の大きさで求める）。
    *   手順4の式は`ViewTransform`の変換の定義を「範囲の中心を領域の中心に置く」向きに解いた配置の計算で、REQが本ファイルに置くと定めたもの（スクリーン⇔ワールドの変換の関数`screenToWorld`・`worldToScreen`はここに書かない）。テストは結果を`ViewTransform`へ設定して`worldToScreen(cx, cy)`が領域の中心になることで確かめ、変換の定義との食い違いを検出する（5章）。
*   **`main.js`の`fitViewToShapes()`**（`// 6.5.`）：`const view = computeFitView(shapeExtentReader.getAllBounds(), canvas.clientWidth, canvas.clientHeight, { minScale: ViewTransform.MIN_SCALE, maxScale: ViewTransform.MAX_SCALE }); viewTransform.setView(view.scale, view.offsetX, view.offsetY);`（分岐を書かない）。⛶の`click`から呼ぶ。キーは割り当てない。キャンバス要素の大きさを使う計算は`resetViewToCenter`・`zoomAtCanvasCenter`・`fitViewToShapes`に集める。
*   操作モード・選択集合・図形一式・履歴に触れない。ドラッグ中（中ボタンのパン中に左クリックで押される場合）の判定は持たない（表示のリセットのボタンと同じ）。再描画・表示倍率・定規・座標の表示・グリッド1マスの表示は既存の`viewTransform.onChange`だけで追従する。

### 要件10: コメント・記述の整理（ファイルごとの対象）
*   `js/palette/ToolPalette.js`：クラスJSDocの「ウィンドウ全体の非活性（`.disabled`）は扱わない（ツールパレットは常に押せる）。」→「ウィンドウ全体を非活性にするクラスは無く、ツールパレットは常に押せる。`Tab`・ツールバーのパレットの表示・非表示のボタンでは、他のフロートウィンドウとまとめて隠される（隠す仕組みは`index.html`のCSSと`main.js`。本クラスは関与しない）。」（コメントのみ。ロジックは変えない。タスク26）
*   `js/core/CanvasManager.js`：先頭の責務定義（背景の塗り・配色の組・アウトライン表示を含む純粋な描画）、クラスJSDoc、`render`のJSDoc（描画順・引数`outline`・`darkBackground`・`showGrid`）、`#drawGrid`（間隔は`GridSpacingRules.computeGridSpacing`。色は配色の組）・`#drawOrigin`（色は配色の組）のJSDoc（タスク1・8）。
*   `js/main.js`：`renderCurrentState`のJSDoc（「3経路」→`model.onChange`・`viewTransform.onChange`・`displayState.onChange`・`resize`の4経路と表示の状態の受け渡し）、`resize`の登録のコメント（定規の大きさの同期と再描画の順序）、`resetViewToCenter`のJSDoc（「ツールバー・ステータスバーを除いた領域」→「ツールバー・定規・ステータスバーを除いた領域」）、`// 2.`・`// 4.`・`// 7.6.`・`// 8.`のブロックのコメント、起動時の同期のコメント（タスク21〜25）。
*   `js/core/KeyboardShortcuts.js`：`SHORTCUT_BINDINGS`のJSDoc（`KeyZ`・`KeyX`・`KeyC`は`ctrl`の値で`Ctrl`付きと排他的に区別されること、`KeyZ`の`Ctrl`付きは`Shift`で取り消し/やり直しに分かれること、`Tab`は入力欄（テキスト入力扱い＝手順2、色の欄＝手順4）にフォーカスがある間はブラウザのフォーカスの移動になること）、typedef`ShortcutActions`（タスク23・24）。手順の順序・`#handleKeyDown`の処理は変えない。
*   `js/core/InputTracker.js`：コンストラクタのJSDoc（第6引数）、クラスJSDocの当たり分類の1文（「塗った内側を当たりに含めるかは注入された照会に従う」）、`#classifyPoint`のJSDocの規則の要約（タスク10）。
*   `js/palette/PaletteLauncher.js`：先頭の責務定義（隠している間の呼び出し口の規則を含む）、クラスJSDocの「■ 開閉の規則」（隠している間は出して必ず開く）・「■ 他のモジュール・ウィンドウとの関係」（まとめて隠す仕組みは`index.html`のCSSと`main.js`で、本クラスは照会と「出す」の注入だけを受け取る）（タスク20）。
*   `js/core/ViewTransform.js`・`js/io/SpriteSerializer.js`・`js/core/PointHitRules.js`：先頭の責務定義（タスク11・13・9）。
*   `js/shapes/`の5クラス：クラスJSDocの契約の列挙（タスク3〜7）。
*   `index.html`：`:root`の先頭のコメントと`--canvas-area-*`のコメント（「07-03で定規を足すときに直すのは…」の予定の記述を、定規の分を含む実態へ）、`#editor-canvas`のルールのコメント（領域・背景の色）、ツールバー・ステータスバーの共通のコメント（重なりに定規を含める）、`.status-bar-left`・`.status-bar-group`周りのコメント、ツールパレット・キャンバスパレット・`?dev`の確認用ウィンドウの位置・範囲の数値、覆い要素のコメント（定規も手前）、ツールバー全体の幅の見積もり（タスク8・21・22・24）。

### 要件11: 自動テスト
*   規則（`_doc/arch/16_test.md`）：`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`、`node:test`・`node:assert/strict`のみ、公開APIのみ、テストのためにソースを書き換えない、`test/`に共有の補助モジュールを置かない（補助関数は各テストファイルの中にJSDoc付きで）、`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止し回数を確かめる、画面の操作・描画のテストは行わない。
*   新設・追加するテストと観点：
    *   `test/core/DisplayState.test.js`：初期値（`getState()`・`isOutline()`・`isFloatWindowsVisible()`）、4つの`toggle…`（値が反転・通知1回）、4つの`set…`（変わる値で通知1回・同じ値で通知0回・真偽値でない値は`console.warn`して変わらず通知0回）、`getState()`の戻り値を書き換えても内部が変わらない・呼ぶたびに別のオブジェクト、`onChange`に関数以外を渡しても例外にならない。
    *   `test/core/GridSpacingRules.test.js`：100%で`{10, 100}`、80%は10のまま、79%で100へ繰り上がる、10%（`{100, 1000}`）、1000%（`{10, 100}`）、不正な倍率（`0`・負・`NaN`・`Infinity`）で例外を投げない（戻り値はJSDocの値）、切り出し前の`CanvasManager`の式（テストファイル内の参照用の補助関数として書き写す）と多数の倍率（`MIN_SCALE`〜`MAX_SCALE`を`1.1`刻み等）で同じ結果。
    *   `test/core/RulerTickRules.test.js`：正の範囲・負の範囲・0をまたぐ範囲、太線と細線の区別（間隔10/100・100/1000）、範囲の端ちょうど（含む）、端が間隔の途中、誤差が累積しない（大きなインデックスで`value`が`i × 間隔`と厳密に等しい。例：0.1刻みではなく10刻みで`-100000`付近）、`-0`が出ない（`Object.is(value, -0)`が偽）、不正な引数で空配列。`formatRulerLabel`：`-200`→`'-200'`・`0`→`'0'`・`-0`→`'0'`・`100`→`'100'`・小数は整数に丸める。
    *   `test/core/StatusReadoutRules.test.js`：`formatReadoutNumber`（小数第1位への丸め・負の値・`-0.04`→`'0.0'`・`-0`→`'0.0'`・非有限→`'—'`）、`formatCursorReadout`（値あり・`null`）、`formatSizeReadout`（幅と高さの引き算・`null`）、`formatGridReadout`（10・1000・非有限）。
    *   `test/core/ViewFitRules.test.js`：横長・縦長、領域より小さい／大きい範囲、上限（小さな図形で`maxScale`）・下限（大きな図形で`minScale`）、幅が0・高さが0・両方0（1）、余白より小さい領域（`minScale`・例外なし）、`null`で`{1, w/2, h/2}`、結果を`new ViewTransform()`の`setView`へ設定して`worldToScreen(範囲の中心)`が領域の中心に写る（`ViewTransform`は公開APIとして使う）、余白を空けて収まっている（範囲の四隅の写像が`[margin, 大きさ − margin]`の内側。倍率を収めない場合）。
    *   `test/core/ViewTransform.setView.test.js`（新設。`setView`の分だけ）：設定（`getState()`の値）、上限・下限に収める、不正な値（`0`・負・`NaN`・`Infinity`の倍率、非有限のオフセット）で`console.warn`して変わらない・通知しない、同じ値で通知しない、変わったとき通知1回、収めた結果が今と同じなら通知しない。既存のメソッドのテストは足さない。
    *   `test/edit/ShapeExtentReader.test.js`：実物の`VectorModel`と図形で、`getSelectedBounds`（選択なしで`null`・1つ・複数の和・選択の変更に追従）、`getAllBounds`（図形0個で`null`・全図形の値が`SpriteSerializer.serialize(model.getShapes()).bounds`と同じ）、図形・選択集合を変えない（呼んだ後の`getShapes()`・`getSelectedIds()`が同じ・`onChange`が呼ばれない）。
    *   `test/io/SpriteSerializer.test.js`へ追加：`computeShapesBounds`が各種の図形（線あり・線なし・弧・曲線・パス・複数）で`serialize(shapes).bounds`と同じ値、図形0個で`null`、引数の図形を書き換えない。既存のケースは変えない（`serialize`の出力が変わらないことは既存のテストが確かめる）。
    *   `test/core/PointHitRules.test.js`へ追加：`includeFill`が`false`のとき、塗った内側は空白（`bodyId: null`）、手前の塗った図形の内側にある奥の図形の輪郭が選ばれる、選択集合の図形の輪郭の優先とハンドルは変わらない、輪郭の近くは今までどおり選ばれる。`true`を明示したときは省略時と同じ。既存のケースは変えない。
    *   `test/shapes/{Line,Curve,Rect,Ellipse,Path}.test.js`へ追加：`drawOutline`の描画命令（パスの形が`draw`と同じ命令・引数・順序、`set:strokeStyle`が渡した色、`set:lineWidth`が`1 / viewScale`（例：`viewScale`=2で0.5）・省略時は1、`stroke`を1回、`fill`・`set:fillStyle`を呼ばない、線なし／塗りなし／何も描かれない図形（`strokeColor: null`・`fillColor: null`）でも同じ命令、弧は`closePath`を呼ばない・円・矩形・閉じたパスは呼ぶ、開いたパスは呼ばない）。偽の`ctx`は各ファイルの既存の`makeRecordingCtx`を使い、足りない命令（`quadraticCurveTo`・`ellipse`等）は既存の偽の`ctx`の記録の範囲で確かめる（既存の補助関数を書き換える必要がある場合は、記録する命令を足すだけにして既存のケースの期待値を変えない）。既存の`draw`のテストは変えない。
*   **自動テストの対象外（テストプレイで確かめる）**：`CanvasManager`（配色の組・背景・グリッドの表示・アウトライン表示）、`RulerRenderer`、`CanvasCursorTracker`、`ViewToggleGroup`、`PaletteLauncher`の規則、`index.html`、`main.js`の配線、`KeyboardShortcuts`の4エントリ（`document`を購読する）、`InputTracker`の注入と受け渡し。
*   既存のテスト（997件）は変えない（上記の追加を除く）。各タスクの完了時に`node --test`が`fail 0`であること。

### 要件12: 開発資料への記載
*   下記「開発資料の更新予定」に列挙し、最終タスク（タスク27）で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./index.html` - 定規（2つの`<canvas>`と角）・`:root`のキャンバスの領域・ステータスバーの項目（座標・大きさ・グリッド・表示の切り替え・⛶）・ツールバーの🧰・まとめて隠すCSS・CSSコメント
    *   `./js/core/` - 新設：`DisplayState`（表示の状態の持ち主）・`GridSpacingRules`（グリッドの間隔の規則）・`RulerTickRules`（定規の目盛りの規則）・`RulerRenderer`（定規のレンダラー）・`CanvasCursorTracker`（カーソル位置の追跡）・`ViewFitRules`（収める計算）・`StatusReadoutRules`（表示の文字列の規則）。変更：`CanvasManager`・`ViewTransform`・`PointHitRules`・`InputTracker`・`KeyboardShortcuts`
    *   `./js/shapes/` - 5つの図形クラスの`drawOutline`（共通メソッド契約の16番目）
    *   `./js/io/` - `SpriteSerializer.computeShapesBounds`
    *   `./js/edit/` - 新設：`ShapeExtentReader`（外枠の照会）
    *   `./js/palette/` - 新設：`ViewToggleGroup`。変更：`PaletteLauncher`（隠している間の📁）・`ToolPalette`（コメントのみ）
    *   `./js/main.js` - 配線ブロック`// 2.`・`// 3.2.`（新）・`// 4.`・`// 6.5.`（新）・`// 7.6.`・`// 8.`・起動時の同期
    *   `./test/core/`・`./test/edit/`・`./test/io/`・`./test/shapes/` - 新設と追加
*   **関連する論理クラス**: `DisplayState`（新・表示専用の状態）、`RulerRenderer`（新・レンダラー）、`CanvasCursorTracker`（新・入力の位置の保持と通知）、`GridSpacingRules`・`RulerTickRules`・`ViewFitRules`・`StatusReadoutRules`（新・規則の関数群）、`ShapeExtentReader`（新・照会）、`ViewToggleGroup`（新・UI部品）、`CanvasManager`・`ViewTransform`・`PointHitRules`・`InputTracker`・`KeyboardShortcuts`・`SpriteSerializer`・`PaletteLauncher`・`ToolPalette`・`Line`・`Curve`・`Rect`・`Ellipse`・`Path`（変更）

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`edit/`・`io/`・`palette/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`core/`内の新しいimport：`CanvasManager → GridSpacingRules`、`RulerRenderer → GridSpacingRules・RulerTickRules`。`edit/ShapeExtentReader → io/SpriteSerializer`。`DisplayState`・`GridSpacingRules`・`RulerTickRules`・`ViewFitRules`・`StatusReadoutRules`・`CanvasCursorTracker`・`ViewToggleGroup`・`PointHitRules`は何もimportしない。
*   **同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`・`historyManager.onChange`・`canvasLibrary.onChange`・`canvasFileOperations.onChange`、`applyMode`・`applyShapeType`）に、本作業で`displayState.onChange`（表示の状態）と`cursorTracker.onChange`（カーソル位置。定規とステータスバーの座標の文字だけ）を足したものだけで行う。機能専用の再描画・同期処理を足さない。各同期関数は起動時にも明示的に1回呼ぶ。
*   **描画サイクル**：常時ループ（rAF）は持たない。キャンバスは`renderCurrentState()`（`main.js`）で、定規は`renderRulers()`（`main.js`）で同期的に描く。
*   **`CanvasManager`**：Canvasへの純粋な描画。図形データ・選択状態・ビュー変換状態・表示の状態を保持しない（値は`render`の引数で受け取り、`ViewTransform`・`DisplayState`をimportしない）。保持するのはCanvas要素・2Dコンテキスト・dprのみ。補助描画はポリモーフィックに呼び、図形種別の分岐を持たない。`resize()`は`render()`を呼ばない。可視範囲は描画変換の逆行列で対角2隅を写して求める（変換式を重複させない）。
*   **`ViewTransform`**：ビュー変換状態（倍率・オフセット。`スクリーン = ワールド × 倍率 ＋ オフセット`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する。値が実際に変化した場合のみ通知する。図形データ・DOM・`VectorModel`・`CanvasManager`を知らない。原点（スクリーン座標）はキャンバス要素（キャンバスの領域）の左上。
*   **`InputTracker`**：ユーザー入力の解釈。キーはスペースパンのみ。図形種別の分岐を持たない。当たり分類の規則の正本は`PointHitRules.classifyPointHit`で、`#classifyPoint`は受け渡しだけ（結果をホバー・押下・クリック・カーソルで共用）。**本Phaseで足してよいのは、判定・計算の規則を状態を持たない関数として切り出したものの呼び出しと配線だけ**（本作業では要件6の照会の注入と受け渡しのみ。カーソル位置の追跡・表示の切り替え・収める・パレットを隠すは入れない）。`InputTracker.js`の最上位でDOMに触れない（`ToolRules.test.js`が間接にimportする）。`getScreenCoordinate`は`getBoundingClientRect`で差し引き、キャンバス外のイベントにもキャンバス左上基準の座標を返す。
*   **`KeyboardShortcuts`**：キー→操作の対応表（`SHORTCUT_BINDINGS`。キー→操作の対応はここ1か所）と`keydown`の受理判定のみ。画面のボタン・DOMのid・クラス名・表示の状態を知らない。同一のcode・修飾キーの組に一致するエントリを2件以上置かない。コンストラクタで対応表の全action名と`isDragging`の注入を検証し、欠ければ`Error`。判定の手順（1.IME変換中 2.テキスト入力中 3.一致の検索 4.`ctrl: false`かつ`checkbox`・`color`の`input` 5.ドラッグ中 6.リピート 7.実行と`preventDefault`）は変えない。`index.html`のボタンの`title`はこの表と手動で一致させる。
*   **`PointHitRules`**：選択モードの当たり分類の規則（状態なし・何もimportしない）。図形種別・`isFillable()`・`fillColor`・`VectorModel`・`ViewTransform`・DOMを知らない。`handle`と`bodyId`は独立に求める。ハンドルの優先順位は`CanvasManager`のハンドルの描画順と一致させる。使う側は`InputTracker.#classifyPoint`のみ。
*   **`shapes/`の図形クラス**：種別ごとに1ファイルで共通メソッド契約を自律実装する（継承なし）。`draw`は`CodeExporter`の`DRAW_SOURCE`と命令・順序を手で揃えている（変えない）。`drawHover`・`drawHandles`・当たり判定・`toDrawElement`・`toJSON`/`fromJSON`は変えない。契約を増やすときは5クラスのクラスJSDocの列挙を揃える。
*   **`io/SpriteSerializer`**：書き出し形式の定義と組み立て（静的メソッドのみ・DOMなし）。外枠の求め方（2章「外枠`bounds`」）：描画要素ごとの形の範囲を、`strokeColor`が文字列の要素だけ線の太さの半分（不正なら2pxの半分）広げ、全要素の和。図形0個で`null`。未知の`kind`は`Error`。`serialize`の出力の形・キー順は変えない。
*   **`edit/`**：DOMに触れない。操作モードを知らない。`io/`・`core/`の機能を組み合わせる手順。
*   **`palette/`**：自己完結するUI部品。DOM操作専任でimportを持たず、`VectorModel`・図形データ・選択状態・判定に関与しない（受け取るのは注入された値とコールバックのみ）。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない。`PaletteLauncher`は呼び出し口とパレットの対応づけと開閉（`palette.hidden`と`.active`）のみで、対応表の唯一の定義箇所は`main.js`の`paletteLaunchers`。
*   **`main.js`**：初期化・依存の注入・イベントバインドのみ。判定・計算のロジックを持たない。ボタンとショートカットは同じ操作関数を呼ぶ（同一経路の原則）。キャンバス要素の大きさを使う計算は専用の関数に集める（`resetViewToCenter`・`zoomAtCanvasCenter`、本作業で`fitViewToShapes`）。配線ブロックはコメント番号の順に置く。
*   **`index.html`**：スタイルは`<style>`に内包（CSSファイルを分けない）。画面の領域の寸法は`:root`のカスタムプロパティが唯一の定義箇所。`#editor-canvas`に枠線・内側の余白を付けない。重なり：キャンバス1 → 覆い要素5 → ツールバー・ステータスバー8 → フロートウィンドウ10以上（`WindowManager`の最前面化で増える）。ツールバー・ステータスバーは1行固定・`overflow: hidden`で収まらない右側は切れる（折り返し・横スクロールなし）。項目はまとまり（`.toolbar-group`／`.status-bar-group`）ごとに足し、既存のまとまりは変えない。ボタンはアイコンのみ（`tool-btn icon-btn`）、アイコンはマークアップの1か所、説明とショートカットは`title`。`WindowManager`は起動時にDOMにある`.float-window`だけを検知する。
*   **保存・履歴**：作業データ・キャンバス記録・スナップショットに含めるのは図形データ（とスナップショットの選択集合）のみ。表示の状態はどこにも含めない。
*   **自動テスト（`_doc/arch/16_test.md`）**：要件11の冒頭のとおり。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（冒頭の記載基準に従い、JSDocを読めば分かること（引数・private・typedefの中身・定数の値・1クラス内の処理順）は書かず、境界・流れ・誰が呼ぶか・注入・設計判断の理由・発注者の決定・やらないことを書く。反映はタスク27）
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造の`core/`へ`DisplayState.js`（表示の状態の持ち主。表示専用）・`GridSpacingRules.js`（グリッドの間隔の規則。状態なし。`CanvasManager`・`RulerRenderer`・`main.js`から使う）・`RulerTickRules.js`（定規の目盛りの規則。状態なし。`RulerRenderer`から使う）・`RulerRenderer.js`（定規のレンダラー）・`CanvasCursorTracker.js`（キャンバス上のカーソル位置）・`ViewFitRules.js`（全体を画面に収める計算。状態なし。`main.js`から使う）・`StatusReadoutRules.js`（ステータスバーの表示の文字列の規則。状態なし。`main.js`から使う）、`edit/`へ`ShapeExtentReader.js`、`palette/`へ`ViewToggleGroup.js # ステータスバーの表示の切り替えのまとまり`、`test/`へ新設の7ファイル。
    *   `index.html`のコメント：「上端にツールバー…・その下と左端に定規（固定）・下端にステータスバー」。
    *   「存在しないもの」へ：表示の状態（アウトライン・背景・グリッド・パレットの表示）の保存・履歴の対象化、定規の表示・非表示の切り替え・ガイド・定規からのドラッグ・定規の原点の変更・単位の切り替え、全体を画面に収めるキー・100%で表示するキー・選択中の図形だけを画面に収める操作、白・黒以外の背景・図形の色を背景に合わせて変えること・ダークモード（定規・バー・ウィンドウの配色の切り替え）、カーソルがキャンバスの外へ出たときのホバーの強調の解除。
    *   フォルダ分割の方針の`core/`：状態を持たない規則の関数に`GridSpacingRules`（`CanvasManager`・`RulerRenderer`・`main.js`が使う。間隔の規則を1か所にするため）・`RulerTickRules`（`RulerRenderer`）・`ViewFitRules`・`StatusReadoutRules`（`main.js`だけが使う。`ToolRules`と同じ位置づけ）を足す。表示専用の状態`DisplayState`（`ViewTransform`と同じ位置づけ）、`RulerRenderer`（`CanvasManager`と同じ状態を持たないレンダラー）、`CanvasCursorTracker`（`InputTracker`へ入れないため分けた。DOMの購読を含む）を足す。`edit/`に「外枠の照会（`ShapeExtentReader`。`core/`は`io/`をimportできないため）」を足す。
    *   依存方向：`core/CanvasManager → core/GridSpacingRules`、`core/RulerRenderer → core/GridSpacingRules・core/RulerTickRules`（`core/`内。2つは何もimportしない）、`edit/ShapeExtentReader → io/SpriteSerializer`。
*   **2章**：「スタイル3つ…共通メソッド契約は、Phase 06-03で`hitTestFill`を足して15メソッドになった」→「…15メソッドになり、Phase 07-03で`drawOutline`（アウトライン表示）を足して16メソッドになった」。作業データ形式の「保存対象は図形データのみ。…含めない」とキャンバス記録の「保存しないもの」へ「表示の状態（アウトライン・背景・グリッド・パレットの表示）」を足す。
*   **3章冒頭「同期の経路」**：一覧へ`displayState.onChange`（表示の状態。キャンバスの再描画・表示の切り替えのボタン・パレットの表示）と`cursorTracker.onChange`（カーソル位置。定規とステータスバーの座標の文字だけ。キャンバスは再描画しない）を足す。
*   **3章1.「読み込み完了前の操作」**：表示の切り替え（`Z`・`X`・`C`・`Tab`・ボタン・⛶）は図形一式を変えないため読み込み中も働く（専用の判定は無い）。覆い要素の間はキャンバスの`mousemove`が来ないため座標の表示は`—`。
*   **3章2.「描画サイクル」**：キャンバスは`model.onChange`・`viewTransform.onChange`・`displayState.onChange`・ウィンドウリサイズの4経路から`renderCurrentState()`。定規は`viewTransform.onChange`・`cursorTracker.onChange`・ウィンドウリサイズから`renderRulers()`（リサイズは`canvasManager.resize()` → `rulerRenderer.resize()` → `renderCurrentState()` → `renderRulers()`の順）。
*   **3章3.「当たり分類」**：アウトライン表示の間は塗った内側を当たりに含めない（`classifyPointHit`の`includeFill`。`InputTracker`は注入された照会`isFillHitExcluded`を渡すだけで、表示の状態を知らない。2026-11-13 発注者の決定）。「キーボード操作」：`Z`・`X`・`C`（`Ctrl`付きの取り消し・切り取り・コピーとは`ctrl`の値で排他的）・`Tab`（ボタン・フォーカスなしでは隠す/出す、テキスト入力扱いの欄・色の欄ではブラウザのフォーカスの移動、`Shift`+`Tab`は一致しない。2026-11-13 発注者の決定）と、操作の実体の一覧に`displayState`のメソッドを足す。
*   **3章4.「座標系とビュー変換」**：キャンバスの領域は定規（横は`--toolbar-height`の下、縦は左端。太さ`--ruler-size`）の分だけ狭まった（`--canvas-area-top`・`--canvas-area-left`）。スクリーン座標の原点はキャンバス要素の左上のまま。定規の位置はキャンバスのスクリーン座標の同じ軸の値にそろえてある。`setView`（全体を画面に収める）。
*   **3章6.「記録しない操作」**：表示の切り替え（アウトライン・背景・グリッド・パレットを隠す/出す）・全体を画面に収めるを足す。
*   **3章へ「15. 表示」の節を新設**：表示の状態の持ち主（`DisplayState`。保存しない・キャンバスを切り替えても保つ・ページを開き直すと初期値）と通知の経路、配色の組（白・黒の2組。`CanvasManager`の`render`の`darkBackground`で選ぶ。背景の色はCSSに置かず配色の組が唯一）、アウトライン表示（`drawOutline`。画面上1pxの一定の線・塗らない・図形のスタイルを使わない・作成途中も。ホバー・ハンドル・範囲選択・吸い付きは今のまま）、グリッドの表示（細線・太線だけ消す。軸線・原点マークは残す）、定規（常に表示・別要素・`GridSpacingRules`で間隔をグリッドと共有・数字は太線・カーソル位置の印・配色は背景によらない・`z-index` 8）、カーソル位置の座標・選択中の図形の大きさ・グリッド1マスの大きさ（`CanvasCursorTracker`・`StatusReadoutRules`・`ShapeExtentReader`→`SpriteSerializer.computeShapesBounds`。`—`の条件）、パレットをまとめて隠す（`body.float-windows-hidden`。`hidden`・位置・重なりに触れない。隠している間の📁は`PaletteLauncher`の規則）、全体を画面に収める（`ViewFitRules`・`setView`・余白40px・図形0個はリセットと同じ・キーなし）、ボタンに`aria-pressed`を付けない理由（フォーカス中の`Space`をパンにするため）、発注者の決定（2026-11-13）、やらないこと（REQのNon-goals）。
*   **4章の一覧**：`DisplayState.js`・`GridSpacingRules.js`・`RulerTickRules.js`・`RulerRenderer.js`・`CanvasCursorTracker.js`・`ViewFitRules.js`・`StatusReadoutRules.js`の7行を足す（`_doc/arch/20_DisplayState.md`〜`26_StatusReadoutRules.md`）。
*   **`_doc/arch/01_index_html.md`**：画面の領域（定規2本と角、`--ruler-size`・`--frame-background-color`、「07-03で定規を足すときに直すのは…」の予定の記述を実態へ）、重なりの順に定規（8）、定規の`<canvas>`にも枠線・余白を付けない理由、保っているidに`#float-windows-toggle`・`#ruler-horizontal`・`#ruler-vertical`・`#ruler-corner`・`#cursor-readout`・`#selection-size-readout`・`#grid-size-readout`・`#view-toggle-group`（中の3ボタンはUI部品が解決）・`#view-fit`、ステータスバーの並びと縮む項目（名前のまとまりだけ`.status-bar-group-shrink`。`.status-readout`の`white-space: pre`・等幅の数字・最小の幅）、`#editor-canvas`の背景の色をCSSに置かないこと、まとめて隠すCSS、ボタンの押し込みは`.active`で`aria-pressed`を付けない理由、ショートカットの表記（`Tab`・`Z`・`X`・`C`）、ツールバー全体の幅の見積もり約646px、ウィンドウの既定の位置は定規の分ずれること。
*   **`_doc/arch/02_main.md`**：主な関数（`renderRulers`・`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`・`syncViewToggleGroup`・`syncFloatWindowVisibility`・`fitViewToShapes`）、配線ブロックの表（`// 2.`に`RulerRenderer`、`// 3.2.`（新）、`// 4.`に`CanvasCursorTracker`・`renderRulers`・登録、`// 6.5.`（新））、注入の一覧（`InputTracker`の第6引数`isFillHitExcluded`＝`() => displayState.isOutline()`、`CanvasCursorTracker`＝`canvas`・`getScreenPoint`・`screenToWorld`、`RulerRenderer`＝2要素、`ShapeExtentReader`＝`model`、`ViewToggleGroup`＝`#view-toggle-group`・3コールバック→`displayState`のメソッド、`PaletteLauncher`の第2引数、`KeyboardShortcuts`の4コールバック）、同一経路の原則（▢◐▦・🧰とキーは`displayState`のメソッドを呼ぶ、⛶は`fitViewToShapes`、キャンバス要素の大きさを使う計算に`fitViewToShapes`）、起動時の同期、行数（タスク25の完了時に実測）。
*   **`_doc/arch/04_CanvasManager.md`**：公開メソッドの`render`の引数に`outline`・`darkBackground`・`showGrid`、描画順（背景の塗り・グリッドの表示・`draw`/`drawOutline`）、配色の組（定数は`CanvasManager`内。白の組は07-03前の見た目と同じ）、背景の色をCSSに置かない理由、持たないものに表示の状態（`DisplayState`をimportしない）、グリッドの間隔は`GridSpacingRules`（定規・ステータスバーと共有）。「初期表示…原点がキャンバス要素全体の中央」は定規で狭まった領域の中央であること。
*   **`_doc/arch/05_ViewTransform.md`**：公開メソッドに`setView`、契約（倍率は下限・上限に収める・不正な値は`console.warn`して何もしない・変わらなければ通知しない・通知1回）、呼び出し元は`main.js`の`fitViewToShapes`。
*   **`_doc/arch/06_InputTracker.md`**：第6引数`isFillHitExcluded`（照会の注入。表示の状態を知らない。`#classifyPoint`から`classifyPointHit`の`includeFill`へ渡すだけ）、当たり分類の項目の追記、行数（タスク10の完了時に実測）。
*   **`_doc/arch/07_KeyboardShortcuts.md`**：足したエントリ（`Z`・`X`・`C`・`Tab`。修飾キーなし・`Shift`不可・リピートしない・コールバックは常に`true`）、`KeyZ`・`KeyX`・`KeyC`の`ctrl`による排他、`Tab`と入力欄（手順2・4でフォーカスの移動）・ボタン・ドラッグ中、知らないことに表示の状態。
*   **`_doc/arch/12_shapes.md`**：「15メソッド契約」→「16メソッド契約」（`drawOutline(ctx, viewScale = 1, color)`。輪郭のパスは`draw`・`drawHover`と同じ・塗らない・図形のスタイルを読まない・画面上1px・`draw`を変えない理由）。5クラスのクラスJSDocが16メソッドを列挙していること。
*   **`_doc/arch/13_palette.md`**：`ViewToggleGroup.js`の項目（公開`render`・注入・知らないこと・typedefの写し）、`PaletteLauncher.js`（第2引数の照会と「出す」、隠している間の📁の規則、知らないことに表示の状態の持ち主）、`ToolPalette.js`の`.disabled`の記述を実態へ（まとめて隠される対象）、冒頭のツールバー・ステータスバーの配線の分担（ステータスバーの表示の切り替えのまとまりは`palette/`、単独のボタン・文字の表示は`main.js`）。
*   **`_doc/arch/14_edit.md`**：`ShapeExtentReader.js`の項目（公開`getSelectedBounds`・`getAllBounds`、`SpriteSerializer.computeShapesBounds`を使う、呼び出し元は`main.js`の`syncSelectionSizeReadout`・`fitViewToShapes`、図形・選択集合・履歴に触れない）。
*   **`_doc/arch/15_io.md`**：`SpriteSerializer`の公開に`computeShapesBounds`（`serialize(shapes).bounds`と同じ値。外枠の求め方を二重に書かないための入口。呼び出し元は`edit/ShapeExtentReader`）。
*   **`_doc/arch/16_test.md`**：新設の7ファイルと追加分（`PointHitRules`・`SpriteSerializer`・`shapes/`5ファイル）の検証範囲、「テストできない箇所（07-03の追加）」（要件11の対象外の列挙）、「書き換えた既存のテスト（07-03）」（無し。図形のテストの偽の`ctx`の補助関数へ記録する命令を足した場合はその旨）、件数（タスク26の実測）。
*   **`_doc/arch/18_PointHitRules.md`**：公開`classifyPointHit`の第6引数`includeFill`（省略時は含める）、規則の要約(3)の条件、使う側（`InputTracker`は注入された照会の否定を渡す）、知らないことにアウトライン表示・表示の状態。
*   **新設**：`_doc/arch/20_DisplayState.md`・`21_GridSpacingRules.md`・`22_RulerTickRules.md`・`23_RulerRenderer.md`・`24_CanvasCursorTracker.md`・`25_ViewFitRules.md`・`26_StatusReadoutRules.md`（既存の`18_PointHitRules.md`・`05_ViewTransform.md`と同じ形式：責務、公開、読むもの／注入、使う側、知らないこと、置き場所の理由、注意）。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する）

## 3. タスクリスト
**各タスク共通の作業**（すべてのタスクで行う）：
* 新設・変更したクラス・メソッド・関数・定数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、注入するコールバックの契約、新設・変更したファイルの先頭の責務定義（3行以内）を確認する。既存ファイルの責務定義を逸脱するロジックを足さない。
* タスクの完了時にプロジェクトのルートで`node --test`を実行し、`fail 0`であることと`tests`・`pass`の件数を「4. 詳細作業内容」に記録する。
* タスクの完了後、「4. 詳細作業内容」の該当タスクの欄を記入し、タスクを`[x]`にする。
* 開発資料の記載に影響が出る場合は資料本体を修正せず、2章「開発資料の更新予定」へ追記する。
* 判断に迷った点・目視確認を推奨する箇所・将来の注意点は5章へ追記する。
* 各タスクの完了時点で、画面が壊れていない（起動してこれまでの操作ができ、コンソールにエラー・警告が出ない）状態を保つ。既存のエラー文・`console.warn`の文言を変えない。

*   [x] タスク1: グリッドの間隔の規則の切り出し（`GridSpacingRules.js`）と`CanvasManager`での利用
    *   **対象ファイル** :
        *   `./js/core/GridSpacingRules.js` : 新規
        *   `./test/core/GridSpacingRules.test.js` : 新規
        *   `./js/core/CanvasManager.js` : 更新（3つの定数と繰り上げのループの削除、`computeGridSpacing`の利用、`#drawGrid`のJSDoc）
    *   **作業内容** :
        *   **同じタスクで3ファイルを変える理由**：規則を切り出したまま`CanvasManager`に元の定数とループを残すと同じ規則の二重定義になるため、切り出し・置き換え・テストを同時に揃える。
        *   2章「要件2」の`computeGridSpacing(scale)`を作る（先頭に単一責務のJSDoc。例：「責務：表示倍率から背景グリッドの細線・太線の間隔（ワールドの長さ）を求める規則を、状態を持たない関数として提供する。」）。定数3つ（JSDoc付き）はこのファイルへ移す。
        *   `CanvasManager.js`：`import { computeGridSpacing } from './GridSpacingRules.js';`、`#drawGrid`の`let minor…`のループと`const major`を`const { minor, major } = computeGridSpacing(scale);`へ置き換え、定数`GRID_BASE_SPACING`・`GRID_MIN_SCREEN_SPACING`・`GRID_MAX_SPACING_STEPS`を削除。倍率の検査（`if (!(scale > 0) || !Number.isFinite(scale)) return;`）は残す。`#drawGrid`のJSDocの間引き規則の記述を「間隔は`GridSpacingRules.computeGridSpacing`（定規・ステータスバーと共有）」へ改める。色・他の処理は変えない（見た目は不変）。
        *   テストは2章「要件11」の`GridSpacingRules.test.js`の観点。
*   [x] タスク2: 表示の状態の持ち主（`DisplayState.js`）とテスト
    *   **対象ファイル** :
        *   `./js/core/DisplayState.js` : 新規
        *   `./test/core/DisplayState.test.js` : 新規
    *   **作業内容** :
        *   2章「要件1」のとおり作る（JSDoc付き）。テストは2章「要件11」の観点。完了時点では誰もimportしない。
*   [x] タスク3: `Line`の`drawOutline`とテスト
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新（`drawOutline`の追加、クラスJSDocの契約の列挙のみ）
        *   `./test/shapes/Line.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   2章「要件5」の`drawOutline(ctx, viewScale = 1, color)`を`drawHover`の直後に足す（JSDocに「共通メソッド契約の第16メソッド」、輪郭のパスは`draw`と同じ、塗らない、図形のスタイルを読まない、線の太さは画面上1px、`draw`を変えない理由（`CodeExporter`の`DRAW_SOURCE`と揃えているため））。クラスJSDocを「共通メソッド契約（16メソッド：…・hitTestFill・drawOutline）」へ。
        *   テストは2章「要件11」の`shapes/`の観点（`describe('Line.drawOutline の描画命令')`）。
        *   **5クラスを別タスクに分ける理由**：1タスク＝ソースとそのテストの原則に従う。各クラスの途中では契約の数がクラス間で一時的にそろわないが、`CanvasManager`はタスク8まで`drawOutline`を呼ばないため動きは変わらない。
*   [x] タスク4: `Curve`の`drawOutline`とテスト
    *   **対象ファイル** :
        *   `./js/shapes/Curve.js` : 更新（`drawOutline`の追加、クラスJSDocの契約の列挙のみ）
        *   `./test/shapes/Curve.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   タスク3と同じ形（パスは`moveTo(points[0])`→`quadraticCurveTo(points[1], points[2])`。閉じない）。偽の`ctx`に`quadraticCurveTo`の記録が無ければ既存の補助関数へ記録する命令を足すだけにする（既存のケースの期待値を変えない）。
*   [x] タスク5: `Rect`の`drawOutline`とテスト
    *   **対象ファイル** :
        *   `./js/shapes/Rect.js` : 更新（`drawOutline`の追加、クラスJSDocの契約の列挙のみ）
        *   `./test/shapes/Rect.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   タスク3と同じ形（パスは4頂点＋`closePath`）。
*   [x] タスク6: `Ellipse`の`drawOutline`とテスト
    *   **対象ファイル** :
        *   `./js/shapes/Ellipse.js` : 更新（`drawOutline`の追加、クラスJSDocの契約の列挙のみ）
        *   `./test/shapes/Ellipse.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   タスク3と同じ形（パスは`ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)`、円のみ`closePath`。弧は閉じない）。テストに円と弧の両方。
*   [x] タスク7: `Path`の`drawOutline`とテスト
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` : 更新（`drawOutline`の追加、クラスJSDocの契約の列挙、`#tracePath`のJSDocの共有先に`drawOutline`を足すのみ）
        *   `./test/shapes/Path.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   タスク3と同じ形（パスは`#tracePath(ctx)`。閉じたパスは`closePath`、開いたパスは閉じない）。テストに開いた・閉じたの両方。
        *   完了後に`js/shapes/`を「15メソッド」で検索し、残りが無いことを記録する。
*   [x] タスク8: `CanvasManager`の配色の組・背景の塗り・グリッドの表示・アウトライン表示
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
        *   `./index.html` : 更新（`#editor-canvas`の`background-color: #ffffff`の削除とそのルールのコメントのみ）
    *   **作業内容** :
        *   **同じタスクで2ファイルを変える理由**：背景の色の定義を配色の組へ移すとき、CSSの白を同時に消さないと背景の色の二重定義が残るため。
        *   2章「要件5」のとおり、色の定数4つを削除して`COLOR_SCHEMES`（JSDoc付き）を足し、`render`の引数へ`outline = false`・`darkBackground = false`・`showGrid = true`を足し、手順1を背景の塗りへ、グリッドの表示、図形・作成途中の図形の`draw`/`drawOutline`の分岐（`render`の引数による分岐のみ。図形種別の分岐は書かない）を実装する。`#drawGrid(view, scheme)`・`#drawOrigin(view, scheme)`は組の色を使う。
        *   先頭の責務定義・クラスJSDoc・`render`のJSDoc（描画順・新しい引数・省略時は今と同じ見た目）・`#drawGrid`・`#drawOrigin`のJSDocを改める（2章「要件10」）。
        *   `index.html`：`#editor-canvas`のルールから`background-color: #ffffff;`を削除し、「背景の色はCanvasManagerの配色の組で塗る（CSSでは付けない。色の定義を1か所にするため）」のコメントを付ける。
        *   完了時点では`main.js`が新しい引数を渡さないため、省略時の値で今と同じ見た目になる。
*   [x] タスク9: `classifyPointHit`の第6引数`includeFill`とテスト
    *   **対象ファイル** :
        *   `./js/core/PointHitRules.js` : 更新
        *   `./test/core/PointHitRules.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   2章「要件6」のとおり。先頭の責務定義・typedef`PointHit`の`bodyId`の説明・`findBodyHit`・`classifyPointHit`のJSDocを改める。テストは2章「要件11」の観点。既存のケースは変えない。
*   [x] タスク10: `InputTracker`の照会の注入と受け渡し
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新（第6引数・非公開フィールド・`#classifyPoint`の受け渡しとJSDocのみ）
    *   **作業内容** :
        *   2章「要件6」のとおり。他のロジック・状態を足さない。JSDocに表示の状態・アウトライン表示という言葉を書かない（「塗った内側を当たりに含めないかの照会」）。クラスJSDocの当たり分類の1文、コンストラクタのJSDoc、`#classifyPoint`のJSDocを改める。
        *   完了時点では`main.js`が第6引数を渡さないため、既定（常に含める）で今と同じ。行数を記録する（2章「開発資料の更新予定」の`06_InputTracker.md`へ追記）。
*   [x] タスク11: `ViewTransform.setView`とテスト
    *   **対象ファイル** :
        *   `./js/core/ViewTransform.js` : 更新（`setView`の追加と先頭の責務定義のみ）
        *   `./test/core/ViewTransform.setView.test.js` : 新規
    *   **作業内容** :
        *   2章「要件9」のとおり`reset`の直後に足す（JSDoc付き）。変換式を書かない。テストは2章「要件11」の観点。
*   [x] タスク12: 全体を画面に収める計算（`ViewFitRules.js`）とテスト
    *   **対象ファイル** :
        *   `./js/core/ViewFitRules.js` : 新規
        *   `./test/core/ViewFitRules.test.js` : 新規
    *   **作業内容** :
        *   2章「要件9」のとおり作る（先頭に単一責務のJSDoc。何もimportしない）。テストは2章「要件11」の観点（`ViewTransform`の公開APIで写像を確かめる）。
*   [x] タスク13: 外枠の公開の入口`SpriteSerializer.computeShapesBounds`とテスト
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` : 更新（静的メソッドの追加と先頭の責務定義のみ）
        *   `./test/io/SpriteSerializer.test.js` : 更新（テストの追加のみ）
    *   **作業内容** :
        *   2章「要件4」のとおり`serialize`の直後に足す（JSDoc付き）。`serialize`・`#computeBounds`・他の関数は変えない。テストは2章「要件11」の観点。
*   [ ] タスク14: 外枠の照会（`edit/ShapeExtentReader.js`）とテスト
    *   **対象ファイル** :
        *   `./js/edit/ShapeExtentReader.js` : 新規
        *   `./test/edit/ShapeExtentReader.test.js` : 新規
    *   **作業内容** :
        *   2章「要件4」のとおり作る（JSDoc付き）。テストは2章「要件11」の観点。完了時点では誰もimportしない。
*   [ ] タスク15: 定規の目盛りの規則（`RulerTickRules.js`）とテスト
    *   **対象ファイル** :
        *   `./js/core/RulerTickRules.js` : 新規
        *   `./test/core/RulerTickRules.test.js` : 新規
    *   **作業内容** :
        *   2章「要件2」のとおり`computeRulerTicks`・`formatRulerLabel`を作る（何もimportしない。JSDoc付き）。テストは2章「要件11」の観点。
*   [ ] タスク16: 定規のレンダラー（`RulerRenderer.js`）
    *   **対象ファイル** :
        *   `./js/core/RulerRenderer.js` : 新規
    *   **作業内容** :
        *   2章「要件2」のとおり作る（先頭の責務の例：「責務：定規（横・縦の2本）の`<canvas>`への純粋な描画（目盛り・数字・カーソル位置の印）のみを担う。ビュー変換値・カーソル位置は引数で受け取り、状態は保持しない。」）。importは`GridSpacingRules`・`RulerTickRules`のみ。定数（色・フォント・長さ）はJSDoc付きでこのファイルにまとめる。`DEFAULT_VIEW`は`CanvasManager`と同じ値をこのファイルにも置く（`CanvasManager`の非公開の定数をimportしないため。JSDocに理由）。
        *   完了時点では誰もimportしない（自動テストの対象外）。
*   [ ] タスク17: カーソル位置の追跡（`CanvasCursorTracker.js`）
    *   **対象ファイル** :
        *   `./js/core/CanvasCursorTracker.js` : 新規
    *   **作業内容** :
        *   2章「要件3」のとおり作る（JSDoc付き。クラスJSDocに、ドラッグ中・パン中・フロートウィンドウの上・読み込み中の動き（2章「要件3」の実コードで確かめた動き）を短く書く）。完了時点では誰もimportしない（自動テストの対象外）。
*   [ ] タスク18: ステータスバーの表示の文字列の規則（`StatusReadoutRules.js`）とテスト
    *   **対象ファイル** :
        *   `./js/core/StatusReadoutRules.js` : 新規
        *   `./test/core/StatusReadoutRules.test.js` : 新規
    *   **作業内容** :
        *   2章「要件3・4」のとおり4つの関数と文言の定数を作る（何もimportしない。JSDoc付き）。テストは2章「要件11」の観点。
*   [ ] タスク19: 表示の切り替えのまとまりのUI部品（`palette/ViewToggleGroup.js`）
    *   **対象ファイル** :
        *   `./js/palette/ViewToggleGroup.js` : 新規
    *   **作業内容** :
        *   2章「要件8」のとおり作る（`OptionBarOrderGroup.js`を下敷きにする。先頭に単一責務のJSDoc。typedef`ViewToggleView`・`ViewToggleGroupActions`。importなし）。完了時点では誰もimportしない。
*   [ ] タスク20: 隠している間の📁の規則（`PaletteLauncher.js`）
    *   **対象ファイル** :
        *   `./js/palette/PaletteLauncher.js` : 更新
    *   **作業内容** :
        *   2章「要件7」のとおり第2引数`options`を足し、呼び出し口の`click`の規則を改める（`#bind`へ照会と通知を渡す。`#setOpen`・`×`・対応表の形は変えない）。先頭の責務定義・クラスJSDoc（2章「要件10」）・コンストラクタのJSDocを改める。
        *   完了時点では`main.js`が第2引数を渡さないため、既定（常に表示中）で今と同じ。
*   [ ] タスク21: 定規とキャンバスの領域（`index.html`・`main.js`）
    *   **対象ファイル** :
        *   `./index.html` : 更新（`:root`・定規の要素とCSS・枠の地の色の変数・CSSコメント）
        *   `./js/main.js` : 更新（`RulerRenderer`・`CanvasCursorTracker`の生成、`renderRulers`と登録、`resize`の手順、コメント）
    *   **作業内容** :
        *   **同じタスクで2ファイルを変える理由**：定規の要素だけを置くと何も描かれない空の枠が出て、`main.js`だけを変えると要素が無く`console.warn`が出るため、両方を揃える。
        *   `index.html`：2章「要件2」の`index.html`の項目（`--ruler-size`・`--frame-background-color`・`--canvas-area-top`・`--canvas-area-left`の2行・3要素・`.ruler`と各位置のCSS）。`:root`の先頭のコメント・`--canvas-area-*`のコメントを実態へ（「07-03で定規を足すときに直すのは…」の予定の記述をなくし、定規の太さとキャンバスの領域の関係を書く）。`#editor-canvas`・覆い要素の共通ルールのコメント（領域＝ツールバー・横の定規とステータスバーの間、縦の定規の右）、ツールバー・ステータスバーの共通のコメントの重なりに定規を含める、覆い要素のコメント（定規も手前）、ツールパレット・キャンバスパレット・`?dev`の確認用ウィンドウの位置・範囲の数値（2章「要件2」の末尾）。
        *   `main.js`：`import`（`RulerRenderer`・`CanvasCursorTracker`）。`// 2.`に`rulerRenderer`の生成。`// 4.`の`inputTracker`の生成の直後に`cursorTracker`の生成（`getScreenPoint`・`screenToWorld`の注入）、`renderRulers()`（JSDoc付き）と`viewTransform.onChange(renderRulers)`・`cursorTracker.onChange(renderRulers)`、`resize`のハンドラを`canvasManager.resize()` → `rulerRenderer.resize()` → `renderCurrentState()` → `renderRulers()`へ（コメントも）。`resetViewToCenter`のJSDocの領域の記述。起動時に`renderRulers()`を1回（理由のコメント付き）。
        *   完了時点：定規が出て、パン・ズームに追従し、カーソル位置の印が出る。キャンバスは定規の分だけ狭まり、クリック・ドラッグ・ホイールの位置・表示のリセット・キーボードの拡大縮小の中心がずれない。
*   [ ] タスク22: ステータスバーの座標・大きさ・グリッドの表示（`index.html`・`main.js`）
    *   **対象ファイル** :
        *   `./index.html` : 更新（ステータスバーの左側の3つのまとまり、名前のまとまりのクラス、ステータスバーのCSSとコメント）
        *   `./js/main.js` : 更新（`// 6.5.`の新設と3つの同期関数・登録、起動時の同期）
    *   **作業内容** :
        *   **同じタスクで2ファイルを変える理由**：表示の要素と同期関数は片方だけでは起動時に`null`の要素へ書き込んで止まる、または空の枠が残るため。
        *   `index.html`：2章「要件8」のステータスバーのマークアップの左側と、CSS（`.status-bar-group`の`flex: none`、`.status-bar-left > .status-bar-group`のルールの削除、`.status-bar-group-shrink`、`.status-bar-left`の`min-width: 0`の削除、`.status-readout`と3つの最小の幅）。関係するCSSコメントを実態へ（縮むのは名前のまとまりだけ・縮まない3つのまとまり・足りないと右側が切れる・空白2つを保つため`pre`）。
        *   `main.js`：`import`（`ShapeExtentReader`・`StatusReadoutRules`の3関数・`computeGridSpacing`）。`// 6.`の後に`// 6.5.`のブロック（2章「要件8」の見出しのコメント）を新設し、`shapeExtentReader`の生成、`syncCursorReadout`・`syncSelectionSizeReadout`・`syncGridSizeReadout`（JSDoc付き）と登録（2章「要件3・4」）。起動時に3つを1回ずつ（理由のコメント付き）。
        *   完了時点：カーソル位置の座標（キャンバスの外は`—`）・選択中の図形の大きさ・グリッド1マスの大きさが表示され、追従する。
*   [ ] タスク23: アウトライン・背景・グリッドの切り替え（`KeyboardShortcuts.js`・`index.html`・`main.js`）
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新（3エントリ・typedefの3コールバック・`SHORTCUT_BINDINGS`のJSDoc）
        *   `./index.html` : 更新（ステータスバーの右側の表示の切り替えのまとまり）
        *   `./js/main.js` : 更新（`// 3.2.`の新設、`InputTracker`の第6引数、`renderCurrentState`、`ViewToggleGroup`の配線、キーのコールバック、起動時の同期）
    *   **作業内容** :
        *   **同じタスクで3ファイルを変える理由**：`KeyboardShortcuts`は対応表の全action名の注入を起動時に検証し、欠けると`Error`で起動できないため、エントリと`main.js`のコールバックを同時に足す。ボタンのDOMと`ViewToggleGroup`の配線も片方だけでは`console.warn`が出るため揃える。
        *   `KeyboardShortcuts.js`：2章「要件5」の3エントリとtypedef、`SHORTCUT_BINDINGS`のJSDoc（2章「要件10」）。手順・既存のエントリは変えない。
        *   `index.html`：`.status-bar-right`の先頭に`<div id="view-toggle-group" class="status-bar-group">`と3ボタン（2章「要件8」の表）。
        *   `main.js`：`import`（`DisplayState`・`ViewToggleGroup`）。`// 3.2.`で`displayState`の生成。`InputTracker`の生成に第6引数`() => displayState.isOutline()`（コメント：塗った内側を当たりに含めない照会）。`renderCurrentState`に`outline`・`darkBackground`・`showGrid`（`displayState.getState()`から）を渡し、JSDocの経路を4経路へ。`displayState.onChange(renderCurrentState)`。`// 6.5.`に`ViewToggleGroup`の生成（コールバックは`displayState.toggleOutline()`等を呼ぶだけ）・`syncViewToggleGroup()`（JSDoc付き）と`displayState.onChange`への登録。`// 8.`に`toggleOutline`・`toggleBackground`・`toggleGrid`。起動時に`syncViewToggleGroup()`を1回。
        *   完了時点：`Z`・`X`・`C`と▢◐▦で切り替わり、キーで切り替えてもボタンの押し込みが追従する。アウトライン表示の間は塗った内側で選ばれない。`Ctrl`+`Z`・`Ctrl`+`X`・`Ctrl`+`C`は従来どおり。
*   [ ] タスク24: パレットをまとめて隠す/出す（`KeyboardShortcuts.js`・`index.html`・`main.js`）
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新（`Tab`のエントリ・typedefの1コールバック・`SHORTCUT_BINDINGS`のJSDoc）
        *   `./index.html` : 更新（🧰のボタン、まとめて隠すCSS、ツールバー全体の幅の見積もりのコメント）
        *   `./js/main.js` : 更新（🧰と`syncFloatWindowVisibility`、`PaletteLauncher`の第2引数、キーのコールバック、起動時の同期）
    *   **作業内容** :
        *   **同じタスクで3ファイルを変える理由**：タスク23と同じ（エントリとコールバックの同時の追加、ボタンと配線の対応）。
        *   `KeyboardShortcuts.js`：2章「要件7」の`Tab`のエントリとtypedef、`SHORTCUT_BINDINGS`のJSDoc（`Tab`と入力欄。2章「要件10」）。
        *   `index.html`：最初のまとまりの📁の左に🧰（2章「要件8」の表）。`body.float-windows-hidden .float-window { display: none; }`（コメント：各ウィンドウの`hidden`・位置・重なりに触れずにまとめて隠す）。CSSコメント「オプションバー（…）の幅の見積もり」の見出しを「ツールバー全体の幅の見積もり」へ改め、数値を約646pxへ（2章「要件8」）。
        *   `main.js`：`// 6.5.`に🧰の要素の取得・`click`で`displayState.toggleFloatWindows()`・`syncFloatWindowVisibility()`（JSDoc付き）と`displayState.onChange`への登録。`// 7.6.`の`new PaletteLauncher(paletteLaunchers, { isFloatWindowsVisible, showFloatWindows })`（コメント付き）。`// 8.`に`toggleFloatWindows`。起動時に`syncFloatWindowVisibility()`を1回。
        *   完了時点：`Tab`・🧰でフロートウィンドウがまとめて隠れ・出て、隠している間の📁でパレットがすべて出てキャンバスパレットが開く。
*   [ ] タスク25: 全体を画面に収める（`index.html`・`main.js`）
    *   **対象ファイル** :
        *   `./index.html` : 更新（⛶のボタン）
        *   `./js/main.js` : 更新（`fitViewToShapes`と⛶の配線）
    *   **作業内容** :
        *   **同じタスクで2ファイルを変える理由**：ボタンと配線は片方だけでは押しても何も起きない・要素が無く止まるため。
        *   `index.html`：表示倍率のまとまりの`#view-zoom-display`と🎯の間に⛶（2章「要件8」の表）。
        *   `main.js`：`import`（`computeFitView`）。`// 6.5.`に`fitViewToShapes()`（JSDoc付き。2章「要件9」）と⛶の`click`。完了後に`main.js`の行数を記録する（2章「開発資料の更新予定」の`02_main.md`へ追記）。
        *   完了時点：⛶で全図形が余白40pxを空けて収まり、図形0個では表示のリセットと同じになる。
*   [ ] タスク26: コメントの整理（`ToolPalette.js`）と残置・JSDocの最終確認
    *   **対象ファイル** :
        *   `./js/palette/ToolPalette.js` : 更新（クラスJSDocの1文のみ）
        *   （見落としが見つかった場合に限り、タスク1〜25の対象ファイルの中で直す）
    *   **作業内容** :
        *   `ToolPalette.js`：2章「要件10」の文へ改める（コメントのみ。ロジックは変えない）。
        *   `js/`・`index.html`・`test/`を「15メソッド」「`.disabled`」「07-03で」「3経路」「`GRID_MINOR_COLOR`」「`GRID_MAJOR_COLOR`」「`ORIGIN_AXIS_COLOR`」「`ORIGIN_MARK_COLOR`」「`GRID_BASE_SPACING`」（`GridSpacingRules.js`以外）「`background-color: #ffffff`」（`#editor-canvas`）「オプションバー（スタイル・重なり順の2つのまとまり）の幅の見積もり」で検索し、残り（使われなくなったコード・CSS・実態と合わないコメント）が無いことを記録する。
        *   新設・変更したファイルのJSDoc（`@param`・`@returns`・`@throws`）・先頭の責務定義（3行以内）・注入するコールバックの契約（`InputTracker`の第6引数・`PaletteLauncher`の第2引数・`CanvasCursorTracker`・`ViewToggleGroup`・`KeyboardShortcuts`の4コールバック）を確認する。
        *   `node --test`の件数を記録する（2章「開発資料の更新予定」の`16_test.md`へ）。
*   [ ] タスク27: 開発資料への反映（最終固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・2章・3章・4章）
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/04_CanvasManager.md` : 更新
        *   `./_doc/arch/05_ViewTransform.md` : 更新
        *   `./_doc/arch/06_InputTracker.md` : 更新
        *   `./_doc/arch/07_KeyboardShortcuts.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/15_io.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
        *   `./_doc/arch/18_PointHitRules.md` : 更新
        *   `./_doc/arch/20_DisplayState.md`・`21_GridSpacingRules.md`・`22_RulerTickRules.md`・`23_RulerRenderer.md`・`24_CanvasCursorTracker.md`・`25_ViewFitRules.md`・`26_StatusReadoutRules.md` : 新規
    *   **作業内容** :
        *   2章「開発資料の更新予定」（各タスクで追記された分を含む）を確認し、`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従って反映する。実コードと照合し、行数・件数等は実測値を書く。
        *   反映後に`PROJECT_ARCHITECTURE.md`と`_doc/arch/`配下の全ファイルを「15メソッド」「3経路」「07-03で」「定規を足すとき」「ツールバー・ステータスバーを除いた」「`.disabled`」で検索し、実態と合わない記述の残り（経緯として残す記述を除く）が無いことを記録する。
        *   ※ 実装AIによる開発資料の書き換えは本ワークフローでは原則禁止であるが、**この最終タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: グリッドの間隔の規則の切り出し（`GridSpacingRules.js`）と`CanvasManager`での利用
*   **作業内容** :
    *   `js/core/GridSpacingRules.js`を新規作成（`computeGridSpacing(scale)`と非公開定数3つ。先頭に責務定義）。
    *   `CanvasManager.js`：`computeGridSpacing`をimport、`#drawGrid`の繰り上げループ・`major`を置き換え、定数3つを削除、`#drawGrid`のJSDocを更新。倍率の検査・色・他の処理は不変。
    *   `test/core/GridSpacingRules.test.js`を新規作成（100%・80%/79%・10%・1000%・不正倍率・旧式との一致）。
    *   `node --test`：tests 1003 / pass 1003 / fail 0。

### タスク2: 表示の状態の持ち主（`DisplayState.js`）とテスト
*   **作業内容** :
    *   `js/core/DisplayState.js`を新規作成（要件1のとおり。4つの状態・`getState`・`isOutline`・`isFloatWindowsVisible`・`set…`4種・`toggle…`4種・`onChange`。何もimportしない。誰もimportしない）。
    *   `test/core/DisplayState.test.js`を新規作成（初期値・toggle・set（変化/同値/非真偽値の警告）・`getState`の独立性・`onChange`の関数以外）。
    *   `node --test`：tests 1023 / pass 1023 / fail 0。
    *   監査指摘の修正：`DisplayState.test.js`の補助関数`captureWarnings`（`console.warn`の手書き差し替え）を削除し、非真偽値のテストを`t.mock.method(console, 'warn', () => {})`と`warn.mock.callCount()`（4回）・`warn.mock.calls[0].arguments[0]`で確かめる形に変更。定数`SETTERS`にJSDocを追加。修正後`node --test`：tests 1023 / pass 1023 / fail 0（件数は不変）。

### タスク3: `Line`の`drawOutline`とテスト
*   **作業内容** :
    *   `js/shapes/Line.js`：`drawHover`の直後に`drawOutline(ctx, viewScale = 1, color)`を追加（JSDoc付き。パスは`draw`と同じ、`fill`・図形のスタイルを使わない、`lineWidth = 1 / viewScale`）。クラスJSDocを16メソッド契約（…・hitTestFill・drawOutline）へ。`draw`は不変。
    *   `test/shapes/Line.test.js`：`describe('Line.drawOutline の描画命令')`を追加（4ケース。命令列・`1 / viewScale`と省略時1・`fill`/`closePath`を呼ばない・線なし/塗りなし/何も描かれない図形でも同じ命令）。既存の補助関数・ケースは不変。
    *   `node --test`：tests 1027 / pass 1027 / fail 0。

### タスク4: `Curve`の`drawOutline`とテスト
*   **作業内容** :
    *   `js/shapes/Curve.js`：`drawHover`の直後に`drawOutline(ctx, viewScale = 1, color)`を追加（JSDoc付き。パスは`draw`と同じ`moveTo(points[0])`→`quadraticCurveTo(points[1], points[2])`、閉じない、`fill`・図形のスタイルを使わない、`lineWidth = 1 / viewScale`）。クラスJSDocを16メソッド契約へ。`draw`は不変。
    *   `test/shapes/Curve.test.js`：`describe('Curve.drawOutline の描画命令')`を追加（4ケース。Lineと同じ観点）。偽の`ctx`は既に`quadraticCurveTo`を記録するため補助関数は不変。既存ケースも不変。
    *   `node --test`：tests 1031 / pass 1031 / fail 0。

### タスク5: `Rect`の`drawOutline`とテスト
*   **作業内容** :
    *   `js/shapes/Rect.js`：`drawHover`の直後に`drawOutline(ctx, viewScale = 1, color)`を追加（JSDoc付き。パスは`draw`と同じ4頂点＋`closePath`、`fill`・図形のスタイルを使わない、`lineWidth = 1 / viewScale`）。クラスJSDocを16メソッド契約へ。`draw`は不変。
    *   `test/shapes/Rect.test.js`：`describe('Rect.drawOutline の描画命令')`を追加（4ケース。Lineと同じ観点。`closePath`を含む命令列）。偽の`ctx`は既に`closePath`・`lineTo`を記録するため補助関数は不変。既存ケースも不変。
    *   `node --test`：tests 1035 / pass 1035 / fail 0。

### タスク6: `Ellipse`の`drawOutline`とテスト
*   **作業内容** :
    *   `js/shapes/Ellipse.js`：`drawHover`の直後に`drawOutline(ctx, viewScale = 1, color)`を追加（JSDoc付き。パスは`draw`と同じ`ctx.ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)`、円のみ`closePath`・弧は閉じない、`fill`・図形のスタイルを使わない、`lineWidth = 1 / viewScale`）。クラスJSDocを16メソッド契約へ。`draw`は不変。
    *   `test/shapes/Ellipse.test.js`：`describe('Ellipse.drawOutline の描画命令')`を追加（5ケース。円・弧それぞれの命令列、`1 / viewScale`と省略時1、`fill`/`fillStyle`を呼ばない、線なし/塗りなし/何も描かれない図形でも円・弧とも同じ命令）。偽の`ctx`は既に`ellipse`・`closePath`を記録するため補助関数は不変。既存ケースも不変。
    *   `node --test`：tests 1040 / pass 1040 / fail 0。

### タスク7: `Path`の`drawOutline`とテスト
*   **作業内容** :
    *   `js/shapes/Path.js`：`drawHover`の直後に`drawOutline(ctx, viewScale = 1, color)`を追加（JSDoc付き。パスは`#tracePath(ctx)`、閉じたパスのみ`closePath`、`fill`・図形のスタイルを使わない、`lineWidth = 1 / viewScale`）。クラスJSDocを16メソッド契約へ。`#tracePath`のJSDocの共有先に`drawOutline`を追加。`draw`は不変。
    *   `test/shapes/Path.test.js`：`describe('Path.drawOutline の描画命令')`を追加（4ケース。開いたパスの命令列と`1 / viewScale`・閉じたパスの`closePath`と`fill`/`fillStyle`を呼ばない・省略時1・線なし/塗りなし/何も描かれない図形でも開いた・閉じた両方で同じ命令）。既存の補助関数・ケースは不変。
    *   `js/shapes/`を「15メソッド」で検索：残りは5クラスの`hitTestFill`のJSDoc「第15メソッド」（正しい記述）のみで、契約の列挙の「15メソッド」は残っていない。
    *   `node --test`：tests 1044 / pass 1044 / fail 0。

### タスク8: `CanvasManager`の配色の組・背景の塗り・グリッドの表示・アウトライン表示
*   **作業内容** :
    *   `js/core/CanvasManager.js`：色の定数4つを削除し`COLOR_SCHEMES`（light/dark、`Object.freeze`、typedef`ColorScheme`付き）を追加。`render`へ`outline = false`・`darkBackground = false`・`showGrid = true`を追加。手順1を`save`→恒等変換→`fillRect(scheme.background)`→`restore`へ（`clearRect`を置換）。`showGrid`が偽なら`#drawGrid`のみ省略（`#drawOrigin`は常に描く）。図形・作成途中の図形は`outline`が真なら`drawOutline(ctx, view.scale, scheme.outline)`、偽なら`draw`（種別の分岐なし）。`#drawGrid(view, scheme)`・`#drawOrigin(view, scheme)`は組の色を使う。先頭の責務・クラス・`render`・`#drawGrid`・`#drawOrigin`のJSDocを更新。
    *   `index.html`：`#editor-canvas`の`background-color: #ffffff;`を削除し、ルールの直前に配色の組で塗る旨のコメントを追加。
    *   `node --test`：tests 1044 / pass 1044 / fail 0（CanvasManagerはテスト対象外のため件数不変）。

### タスク9: `classifyPointHit`の第6引数`includeFill`とテスト
*   **作業内容** :
    *   `js/core/PointHitRules.js`：`classifyPointHit`へ第6引数`includeFill = true`を追加し`findBodyHit`へ渡す。`findBodyHit`の2つ目のループを`hitTest || (includeFill && hitTestFill)`へ変更（1つ目のループと`findHandleHit`は不変）。先頭の責務定義（塗った内側を当たりに含めるかは引数で受け取る）・typedef`PointHit`の`bodyId`・`findBodyHit`・`classifyPointHit`のJSDocを更新。
    *   `test/core/PointHitRules.test.js`：`describe('classifyPointHit: includeFill…')`を追加（6ケース。既存ケースは不変）。
    *   `node --test`：tests 1050 / pass 1050 / fail 0。

### タスク10: `InputTracker`の照会の注入と受け渡し
*   **作業内容** :
    *   `js/core/InputTracker.js`：コンストラクタへ第6引数`isFillHitExcluded = () => false`を追加（関数でなければ`console.warn`して既定を使う）。非公開フィールド`#isFillHitExcluded`を追加。`#classifyPoint`は`classifyPointHit(…, this.#getWorldHitTolerance(), !this.#isFillHitExcluded())`と渡すだけ。コンストラクタ・`#classifyPoint`・クラスJSDocの当たり分類の1文を更新（表示の状態・アウトライン表示という言葉は書いていない）。`main.js`は第6引数を渡さないため既定で挙動は従来どおり。
    *   `js/core/InputTracker.js`の行数：1345行（タスク10の完了時に実測。`06_InputTracker.md`へ反映）。
    *   `node --test`：tests 1050 / pass 1050 / fail 0。

### タスク11: `ViewTransform.setView`とテスト
*   **作業内容** :
    *   `ViewTransform.js`：`reset`の直後に`setView(scale, offsetX, offsetY)`を追加（JSDoc付き。不正値は`console.warn`して何もしない、倍率を`MIN_SCALE`〜`MAX_SCALE`に収める、収めた後が今と同じなら通知なし、変われば3つを設定して通知1回。変換式なし）。先頭の責務定義に「表示倍率とオフセットの一括設定」を追記。
    *   `test/core/ViewTransform.setView.test.js`を新設（6ケース：設定と通知1回、上限・下限、不正値8通りでwarn回数・不変・通知なし（`t.mock.method`使用）、同じ値、収めた結果が同じ、オフセットのみ変化）。`node --test`は1056件pass・fail 0。

### タスク12: 全体を画面に収める計算（`ViewFitRules.js`）とテスト
*   **作業内容** :
    *   `js/core/ViewFitRules.js`を新規作成（先頭に単一責務のJSDoc、何もimportしない）。`FIT_VIEW_MARGIN_PX = 40`・typedef`FitBounds`・`computeFitView(bounds, w, h, { minScale, maxScale, margin })`（要件9の手順1〜4。`null`は`{1, w/2, h/2}`、正の軸のみの最小候補、非有限なら1、倍率を収める、中心配置のオフセット）。
    *   `test/core/ViewFitRules.test.js`を新規作成（13ケース：余白既定、横長・縦長、小さい/大きい、上限・下限、幅0・高さ0・両方0、余白より小さい領域、`null`、`ViewTransform`へ設定して`worldToScreen`が領域の中心、四隅が余白の内側、`margin`指定）。`node --test`：tests 1069 / pass 1069 / fail 0。

### タスク13: 外枠の公開の入口`SpriteSerializer.computeShapesBounds`とテスト
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`：`serialize`の直後に`static computeShapesBounds(shapes)`を追加（JSDoc付き。`#computeBounds(shapes.map((shape) => shape.toDrawElement()))`を返すのみ）。先頭の責務定義に「外枠の照会」を追記（2行）。`serialize`・`#computeBounds`・他は不変。
    *   `test/io/SpriteSerializer.test.js`：末尾に`describe('SpriteSerializer.computeShapesBounds')`を追加（3ケース：各種図形で`serialize(shapes).bounds`と同値、図形0個で`null`、引数の配列・図形を書き換えない）。既存の補助関数・ケースは不変。
    *   `node --test`：tests 1072 / pass 1072 / fail 0。

### タスク14: 外枠の照会（`edit/ShapeExtentReader.js`）とテスト
*   **作業内容** :
    *   （未記入）

### タスク15: 定規の目盛りの規則（`RulerTickRules.js`）とテスト
*   **作業内容** :
    *   （未記入）

### タスク16: 定規のレンダラー（`RulerRenderer.js`）
*   **作業内容** :
    *   （未記入）

### タスク17: カーソル位置の追跡（`CanvasCursorTracker.js`）
*   **作業内容** :
    *   （未記入）

### タスク18: ステータスバーの表示の文字列の規則（`StatusReadoutRules.js`）とテスト
*   **作業内容** :
    *   （未記入）

### タスク19: 表示の切り替えのまとまりのUI部品（`palette/ViewToggleGroup.js`）
*   **作業内容** :
    *   （未記入）

### タスク20: 隠している間の📁の規則（`PaletteLauncher.js`）
*   **作業内容** :
    *   （未記入）

### タスク21: 定規とキャンバスの領域（`index.html`・`main.js`）
*   **作業内容** :
    *   （未記入）

### タスク22: ステータスバーの座標・大きさ・グリッドの表示（`index.html`・`main.js`）
*   **作業内容** :
    *   （未記入）

### タスク23: アウトライン・背景・グリッドの切り替え（`KeyboardShortcuts.js`・`index.html`・`main.js`）
*   **作業内容** :
    *   （未記入）

### タスク24: パレットをまとめて隠す/出す（`KeyboardShortcuts.js`・`index.html`・`main.js`）
*   **作業内容** :
    *   （未記入）

### タスク25: 全体を画面に収める（`index.html`・`main.js`）
*   **作業内容** :
    *   （未記入）

### タスク26: コメントの整理（`ToolPalette.js`）と残置・JSDocの最終確認
*   **作業内容** :
    *   （未記入）

### タスク27: 開発資料への反映（最終固定タスク）
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント
**計画時の判断・注意点**
*   **選択中の図形の大きさの桁**：REQの例は`W: 120  H: 80`だが、規則「小数は座標と同じく小数第1位まで」に従い、座標と同じ固定の小数第1位（`W: 120.0  H: 80.0`）とした（桁が変わって右側の項目が揺れないため）。整数だけで表示したい場合は`StatusReadoutRules.formatSizeReadout`の1か所を変える。
*   **収める計算のオフセットの式**：`ViewFitRules.computeFitView`の`offset = 領域の中心 − 範囲の中心 × 倍率`は、`ViewTransform`の変換の定義を配置の向きに解いた式で、REQ要件9が「表示倍率とオフセットを求める」関数として本ファイルに置くと定めたもの。スクリーン⇔ワールドの変換の関数（`screenToWorld`・`worldToScreen`）は`ViewTransform`にだけある。テストで結果を`ViewTransform`へ設定して`worldToScreen`が領域の中心になることを確かめ、変換の定義を将来変えたときに食い違いを検出する。
*   **定規の写し方**：`RulerRenderer`は、`CanvasManager`が描画変換の行列（`setTransform`）とその逆行列で可視範囲を写すのと同じく、ビュー変換値を行列（`DOMMatrix`）として組んで写す（変換式を手で書かない）。ビューに回転を加える場合は`CanvasManager`の可視範囲と同じく見直しが要る。
*   **同期の経路の数**：REQの制約の「既存の経路＋要件1で足す1つの通知」に対し、要件2・3がカーソル位置の通知（`cursorTracker.onChange`）を認めているため、これも経路の一覧に載せる（キャンバスは再描画せず、定規とステータスバーの座標の文字だけを更新する）。
*   **背景の色**：`#editor-canvas`のCSSの白を削除し、配色の組の1か所にした。`main.js`の実行前の一瞬は`body`の`#f9f9f9`と覆い要素が見えるだけで、`DOMContentLoaded`の直後に描かれる（テストプレイで初期表示のちらつきを確かめる）。
*   **定規の地の色**：地は描かずにCSSの`--frame-background-color`（ツールバー・ステータスバーと共有）とし、角の要素と色を1か所で共有した。REQの「定規の配色（地・目盛り・数字）の定数は定規を描くファイルにまとめる」のうち、地だけはCSSの変数にした（角の要素と二重に定義しないため）。目盛り・数字・印の色は`RulerRenderer.js`の定数。
*   **黒の背景の`Curve`の点線**：`Curve.drawHandles`の始点⇔制御点・終点⇔制御点の点線（`rgba(0, 0, 0, 0.4)`）は黒の背景ではほぼ見えない。ハンドル自体（白の塗り・青の枠）は見えるため、`drawHandles`を変えない（Non-goal）。見えにくさが問題なら、配色の組を図形クラスへ渡す形を後のPhaseで検討する。
*   **`main.js`の行数**：約840行になる見込み（701行から約140行の増加）。開発資料`02_main.md`は配線ブロックの切り出しの検討を求めているが、本作業のスコープ外のため行わない。切り出すなら`// 6.5.`（表示配線）が`displayState`・`viewTransform`・`shapeExtentReader`への依存の受け渡しだけで独立しており候補になる。
*   **ステータスバーの最小の幅**：座標・大きさの最小の幅は5桁の整数部（`-99999.9`）まで。それを超える座標（遠くへパンした場合）ではその分だけ伸び、右側の項目が少し動く（許容）。
*   **見積もりの前提**：ツールバー約646px・ステータスバーの名前に残る約595pxは、CSSの値と12〜16pxの文字幅の見積もり。実ブラウザの絵文字・記号の幅で数px変わり得る。
*   **`WindowManager`のドラッグ中の`Tab`**：見出しをドラッグ中に`Tab`で隠すと、見えないままドラッグが続き（`mouseup`で終わる）、出すとドラッグした先の位置に出る。止まったままにはならない。
*   **変更対象外のファイル**：REQの「変更しない見込み」のファイル（`VectorModel.js`・`HistoryManager.js`・`DragTracker.js`・`WindowManager.js`・`ShapeFactory.js`・`ToolRules.js`・`edit/`の既存のファイル・`io/`のその他・`shapes/`のその他・`palette/`のその他・`js/check/`・`sprite-check.html`・その他の`test/`）は変更しない。

**テストプレイの確認項目（操作手順 → 期待する結果）**。【実ブラウザ】は実装AIの合成イベントでは確かめられない項目。
1.  **定規の表示と追従**：起動する → ツールバーの下に横の定規、左端に縦の定規が出て、左上の角は何も描かれない。100%で太線（100px間隔）の位置に`-200`・`-100`・`0`・`100`…の数字、細線（10px間隔）の位置に短い目盛りが出る。パン（`Space`+ドラッグ・中ボタン・✋）・ホイールのズームで数字が追従する。
2.  **定規の間隔の変化とグリッドの一致**（DIRの持ち越し）：`Ctrl`+`-`を繰り返して80%付近を通る → 79%付近で細線が100間隔・太線が1000間隔へ繰り上がり、定規の目盛り・数字の間隔と、グリッドの線の位置・ステータスバーの`グリッド: 100px`が同時に変わる。さらに縮小して10%付近で1000・10000へ。拡大で戻る。定規の目盛りとグリッドの線の位置がずれない（グリッド線のにじみの見え方も確かめる）。
3.  **キャンバスが定規に隠れない・位置がずれない**：表示のリセット（🎯）で原点が定規を除いたキャンバスの領域の中心に来る。原点付近・画面の四隅の近くで直線を描く・図形をクリックする・ドラッグする・ホイールでズームする → カーソルの位置とずれない。`Ctrl`+`0`・`Ctrl`+`+`/`-`の中心が狭まった領域の中心になる。
4.  **定規のカーソル位置の印**：キャンバスの上でマウスを動かす → 横の定規にカーソルのx、縦の定規にカーソルのyの赤い細線が出て追従する。カーソルをツールバー・定規・ステータスバー・フロートウィンドウの上へ出す → 印が消える。
5.  **カーソル位置の座標**：起動直後（マウスを動かす前）は`X: —  Y: —`。原点の上で`X: 0.0  Y: 0.0`（`-0.0`にならない）。原点の上・左で`Y`・`X`が負。キャンバスの外へ出すと`X: —  Y: —`。数字の桁が変わっても右側の項目が左右に揺れない。
6.  **カーソルを動かさずに表示が変わったとき**：マウスをキャンバスの上で止めたまま`Ctrl`+`+`/`-`/`0`・⛶を押す、ホイールを回す → 座標の表示が、カーソルの下の実際のワールド座標（その位置へ直線を描き始めた点）と一致する。定規の印はカーソルの位置のまま。
7.  **選択中の図形の大きさ**：図形を選ばない → `W: —  H: —`。線の太さ2の矩形（0,0〜100,50）を選ぶ → `W: 102.0  H: 52.0`（線の太さの半分ずつ広がる）。複数選択 → 全体の和。ドラッグで移動・変形している途中も追従する。取り消し/やり直しでも追従する。
8.  **グリッド1マスの大きさ**：100%で`グリッド: 10px`、79%付近で`100px`。`C`でグリッドを消しても表示は残る。
9.  **アウトライン表示（`Z`・▢）**：線あり・塗りあり・線なし（塗りだけ）・何も描かれない（線なし・塗りなし）の図形と弧・曲線・開いたパス・閉じたパスを置く → `Z`で全図形が画面上1pxの黒い細線の輪郭だけになり（塗りなし・図形の線の色・太さは使わない）、ズームしても太さが変わらない。弧・開いたパスは閉じない。作成途中の図形も細線。ホバーの強調・ハンドル・範囲選択の矩形・吸い付きの表示は今のまま。もう一度`Z`で元の見え方。▢の押し込みがキー・ボタンどちらで切り替えても追従する。
10. **アウトライン表示の間のクリック**：手前に塗った矩形、その奥に直線を置く → アウトライン表示で矩形の内側を押しても矩形は選ばれず（空白として範囲選択を始められる）、奥の直線の輪郭を押すと直線が選ばれる。矩形の輪郭の近くを押すと矩形が選ばれる。ホバーの強調・カーソルの形も同じ規則（切り替え直後は次にマウスを動かすまで前のままでよい）。OFFに戻すと内側で選ばれる。
11. **背景の白/黒（`X`・◐）**：`X` → キャンバスの背景が黒、グリッドの細線・太線・軸線・原点マークが白系になる。図形の色は変わらない（黒い線の図形は見えない。仕様）。黒の背景で、選択中のハンドル・ホバーの強調・範囲選択の矩形・端点への吸い付きの表示が見える（曲線の制御点への点線は見えにくい。5章の判断）。◐の押し込みが追従する。定規・ツールバー・ステータスバーの配色は変わらない。アウトライン表示と組み合わせると輪郭が白の細線になる。
12. **エンジンの機体**（DIRの持ち越し。Phase 06-05）：白の塗りのみの図形（`ship.js`を開く）が、黒の背景・アウトライン表示のどちらでも見える。
13. **グリッドの表示（`C`・▦）**：`C` → 細線・太線だけが消え、軸線（`x = 0`・`y = 0`）と原点マークは残る。定規は消えない。▦の押し込み（表示中＝押し込み）が追従する。
14. **`Ctrl`+`Z`・`Ctrl`+`X`・`Ctrl`+`C`**：従来どおり取り消し・切り取り・コピーとして働き、アウトライン・背景・グリッドは切り替わらない。【実ブラウザ】`Shift`+`Z`等は何もしない。
15. **パレットをまとめて隠す/出す（`Tab`・🧰）**：`Tab` → ツールパレット・キャンバスパレット（開いていれば）・`?dev`の確認用ウィンドウ（`?dev`時）が隠れ、ツールバー・定規・ステータスバーは残る。もう一度`Tab` → 隠す前の状態（開いていたウィンドウだけが、ドラッグで動かした位置・重なりのまま）に戻る。閉じていたキャンバスパレットは閉じたまま。🧰の押し込みはパレットを表示している間。🧰でも同じ。【実ブラウザ】`Tab`の実キー。
16. **隠している間の📁**：キャンバスパレットを閉じた状態で`Tab`で隠す → 📁 → 隠している状態が終わり全ウィンドウが出て、キャンバスパレットが開く。開いた状態で隠して📁 → 全部出てキャンバスパレットは開いたまま。隠していない間の📁は今までどおり開閉を反転。`×`で閉じられる。
17. **入力欄・ボタンと`Tab`**【実ブラウザ】：オプションバーの太さの欄・`?dev`のテキスト欄にフォーカスして`Tab` → フォーカスが次の部品へ移り、パレットは隠れない。色の欄にフォーカスして`Tab` → フォーカスの移動。ボタン（例：🗑・📁・▢）を押した直後に`Tab` → パレットが隠れる/出る（フォーカスは移らない）。何もフォーカスが無いとき`Tab` → 隠れる/出る。`Shift`+`Tab` → ブラウザのフォーカスの移動。`Ctrl`+`Tab`・`Alt`+`Tab` → 本アプリは反応しない。
18. **ボタンを押した直後の`Space`**【実ブラウザ】：▢・◐・▦・🧰・⛶を押した直後に`Space`を押しながらキャンバスをドラッグ → パンになる（ボタンは切り替わらない）。
19. **隠している間のショートカット**：`Tab`で隠した後に`V`・`H`・`1`〜`5`・`P`を押す → ツールが切り替わり、`Tab`で出したときツールパレットの押し込みが正しい。
20. **全体を画面に収める（⛶）**：図形を広い範囲に置いて⛶ → 全図形が余白40pxを空けてキャンバスの領域に収まり、中心が領域の中心に来る。小さな図形1つ → 1000%まで拡大される。とても大きな範囲 → 10%で中心が合う。図形0個 → 🎯と同じ（100%・原点が中心）。横・縦の直線だけ（線なしの図形を含む）・点のような図形でも停止しない。操作モード・選択集合・履歴は変わらない（取り消しの対象にならない）。
21. **表示の切り替えは履歴・出力に入らない**：`Z`・`X`・`C`・`Tab`・⛶を操作してから`Ctrl`+`Z` → 図形の編集だけが取り消され、表示の状態は戻らない。出力（作業ファイル・エンジン用）の内容が、表示の状態によらず同じ。ページを開き直す → アウトラインOFF・白・グリッド表示・パレット表示に戻る。
22. **キャンバスを切り替えても保つ**：`Z`・`X`・`C`でアウトラインON・黒・グリッド非表示にして、別のキャンバスを開く・新規作成・開く（ファイル）・開いているキャンバスの削除・取り消し/やり直し・`?dev`の復元 → 表示の状態は変わらない。
23. **読み込み中の操作**：起動直後の覆い要素が出ている間に`Z`・`X`・`C`・`Tab`・各ボタン・⛶を操作する → 停止せず、読み込み完了後の図形一式は保存されていたとおり。座標の表示は`—`のまま。
24. **作成途中・ドラッグ中のキー**：直線の作成途中に`Z`・`X`・`C`・`Tab` → 切り替わり、作成は続く（作成途中の図形はアウトラインの細線）。図形を本体ドラッグ中・パン中に`Z`・`X`・`C`・`Tab` → 何も起きない（`Tab`はブラウザのフォーカスの移動になり得る。今と同じ）。
25. **定規・バーとフロートウィンドウの重なり**：ツールパレットを定規の上へドラッグ → ウィンドウが定規の手前に出る。定規の上でクリック・ドラッグ・ホイール → キャンバスは反応しない。図形をドラッグ中にカーソルを定規・バーの上へ出して戻す → ドラッグは続き、座標の表示はキャンバスの外の間`—`。
26. **ウィンドウの大きさと拡大縮小**：ブラウザのウィンドウの大きさを変える → 定規とキャンバスが追従し、定規の数字とグリッドがずれない。【実ブラウザ】ブラウザの拡大縮小（バーの上での`Ctrl`+ホイール等）の後・高DPIの画面で、定規の目盛りとグリッドの線がずれず、定規の文字のにじみが許容範囲。
27. **幅（1280px）**：1280px幅でツールバーの全項目（🧰〜⏬）とステータスバーの全項目（名前・座標・大きさ・グリッド・▢◐▦・倍率・⛶・🎯）が切れずに収まる。ウィンドウの幅を狭める → まずキャンバスの名前が省略表示で縮み、それでも足りないとステータスバーの右側が右端から切れる（左側の表示が右側へ重ならない）。
28. **アイコンの見え方**【実ブラウザ】：🧰・▢・◐・▦・⛶がWindows 11のブラウザで豆腐（□の箱）にならずに表示される。表示されない場合は`index.html`のそのボタンの1文字を差し替える。
29. **IME・macOS**【実ブラウザ】：IME変換中に`Z`・`X`・`C`・`Tab`を押しても表示が切り替わらない（変換の操作のまま）。macOSの`⌘`+`Z`・`⌘`+`X`・`⌘`+`C`は取り消し・切り取り・コピーのまま。
30. **既存の働き**：図形の作成・選択・移動・変形・削除・結合・スタイル（オプションバー）・重なり順・取り消し/やり直し・コピー/貼り付け/複製・キャンバスパレット（開く・新規作成・名前の変更・削除・出力・開く（ファイル）・インポート）・自動保存・`?dev`の確認用ウィンドウが、これまでと同じに動く。表示の状態が初期値のとき、キャンバスの見た目が07-03前と同じ（定規の分だけ領域が狭いことを除く）。コンソールにエラー・警告が出ない。
