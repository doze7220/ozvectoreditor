# RES: 作業計画・作業レポート (Phase 02-02) : ビュー変換（パン・ズーム・グリッド）
* 参照元REQ: `./_log/req/261008_2031_REQ_Phase02-02_View_Transform.md`

## 1. 作業目的
現状、キャンバスは100%固定表示であり、図形データの座標（ワールド座標）と画面上の座標（スクリーン座標）が同一視されている（`InputTracker.getLogicalCoordinate()`・`CanvasManager.resize()`に「将来ズーム・パン実装時に修正が必要」のコメントあり）。本作業では以下を行う。

* 表示倍率・オフセットを保持する「ビュー変換」を`core/`配下の新設クラス`ViewTransform`に一元化し、ワールド座標とスクリーン座標を分離する。
* パン（中ボタンドラッグ／スペース＋左ドラッグ／「キャンバス移動」モード）、ホイールによるカーソル中心ズーム、倍率表示とリセット、パン・ズームに追従する背景グリッドを実装する。
* ズームしても編集用の補助表示（ハンドル・ホバー強調）と当たり判定を画面上で一定の大きさに保つ。
* 任意のパン・ズーム状態で、Phase 1の作成・選択・再編集・削除操作がクリック位置とずれずに行えることを保証する。

**用語（本RES・コード内JSDocで統一する）**
* **ワールド座標**: 図形データが保持する座標。`VectorModel`・`js/shapes/`配下が扱う座標はすべてこれ。
* **スクリーン座標**: キャンバス要素の左上を原点とするCSSピクセル座標（現行`getLogicalCoordinate()`の戻り値に相当）。
* **ビュー変換**: `スクリーン = ワールド × 倍率 ＋ オフセット`（倍率`scale`、オフセット`offsetX`/`offsetY`）。逆変換は`ワールド = (スクリーン − オフセット) ÷ 倍率`。
* 既存JSDocの「論理座標」は、対象ファイル（`InputTracker.js`・`CanvasManager.js`）内では文脈に応じて「スクリーン座標」または「ワールド座標」に置き換え、以後使用しない。

## 2. アーキテクチャ設計

### 全体構成（依存関係）
```text
main.js ──生成・注入──▶ ViewTransform（core/・新設）  … 倍率/オフセットの唯一の保持者・変換式の唯一の実装箇所
   │                        ▲ zoomAt / panBy（スクリーン座標）       │ onChange通知
   │                        │ screenToWorld / screenLengthToWorld    ▼
   ├──▶ InputTracker ───────┘                         main.js: renderCurrentState() / syncZoomDisplay()
   │      （スクリーン座標取得 → ViewTransformでワールド座標へ逆変換 → VectorModelへ）
   └──▶ CanvasManager.render(shapes, { …, view: viewTransform.getState() })
          （受け取った値で描画変換を設定するのみ。状態は保持しない）
```
* `VectorModel`・`js/shapes/`はビュー変換の存在を知らない（例外：`drawHandles`/`drawHover`が受け取る倍率値`viewScale`のみ。オフセットは渡さない）。
* `CanvasManager`は`ViewTransform`をimportしない。`main.js`が`getState()`で取り出したプレーンオブジェクト`{scale, offsetX, offsetY}`を`render()`の第2引数に含めて渡す。

### 要件1: ビュー変換状態の保持と座標変換（`js/core/ViewTransform.js`・新設）

#### 1-1. クラス定義
```js
/**
 * 責務：キャンバスのビュー変換状態（表示倍率・オフセット）の保持と、
 * スクリーン座標⇔ワールド座標の相互変換・ズーム・パン・リセット・変更通知を担う。
 */
export class ViewTransform {
    static MIN_SCALE = 0.1;   // 10%
    static MAX_SCALE = 10.0;  // 1000%
    #scale = 1; #offsetX = 0; #offsetY = 0; #listeners = [];
    ...
}
```

| メソッド                          | 引数の座標系 | 戻り値                         | 内容 |
| --------------------------------- | ------------ | ------------------------------ | ---- |
| `getScale()`                      | －           | `number`                       | 現在の倍率。 |
| `getState()`                      | －           | `{scale, offsetX, offsetY}`    | 描画用のスナップショット（新しいプレーンオブジェクト）。`CanvasManager`へ渡す用途。 |
| `screenToWorld(sx, sy)`           | スクリーン   | `{x, y}`（ワールド）           | `(s − offset) ÷ scale`。 |
| `worldToScreen(wx, wy)`           | ワールド     | `{x, y}`（スクリーン）         | `w × scale ＋ offset`。 |
| `screenLengthToWorld(length)`     | スクリーン長 | `number`（ワールド長）         | `length ÷ scale`。当たり判定許容誤差のワールド換算に用いる。 |
| `zoomAt(sx, sy, factor)`          | スクリーン   | なし                           | カーソル位置中心のズーム（1-2参照）。 |
| `panBy(dx, dy)`                   | スクリーン   | なし                           | `offsetX += dx; offsetY += dy`。`dx === 0 && dy === 0`なら何もしない。 |
| `reset()`                         | －           | なし                           | 倍率1.0・オフセット(0,0)へ。既に初期状態なら何もしない。 |
| `onChange(callback)`              | －           | なし                           | 変更通知リスナー登録（`VectorModel.onChange`と同形式：関数のみ受理し配列へpush）。 |

* 状態を変更したメソッド（`zoomAt`/`panBy`/`reset`）は、**実際に値が変化した場合のみ**privateメソッド`#notifyChange()`で全リスナーへ通知する。
* 変換式（`×scale＋offset`／`(−offset)÷scale`／`÷scale`）は本クラス内にのみ記述し、他ファイルに重複させない。
* `VectorModel`・`CanvasManager`・図形クラスへの依存は持たない（importなし）。

#### 1-2. `zoomAt(sx, sy, factor)` のアルゴリズム（カーソル中心・クランプ両立）
1. `factor`が正の有限数でなければ`console.warn`して何もしない。
2. ズーム前に、カーソル位置のワールド座標`w = screenToWorld(sx, sy)`を求める。
3. `newScale = clamp(scale × factor, MIN_SCALE, MAX_SCALE)`。
4. `newScale === scale`（既に上限/下限に張り付いている）なら何もしない（通知もしない）。
5. `scale = newScale`、`offsetX = sx − w.x × newScale`、`offsetY = sy − w.y × newScale`。
6. `#notifyChange()`。
* 手順5はクランプ後の倍率でオフセットを再計算するため、クランプ時もカーソルの下のワールド座標点は動かない。

#### 1-3. 再描画の経路（`main.js`）
* `viewTransform.onChange(renderCurrentState)`を登録する。`renderCurrentState()`は`model.onChange`・リサイズ時と**同一の関数**であり、再描画トリガーを重複定義しない。
* `renderCurrentState()`内の`canvasManager.render()`の第2引数に`view: viewTransform.getState()`を追加する（3経路すべてが同じ引数構成になる）。
* 倍率表示の更新（要件4）は別関数`syncZoomDisplay()`とし、同じく`viewTransform.onChange`に登録する。

#### 1-4. `InputTracker`の座標取得の分離
* `getLogicalCoordinate(event)`を **`getScreenCoordinate(event)`** にリネームする（CSSズーム吸収ロジック（`clientWidth / rect.width`）は1行も変えない）。戻り値はスクリーン座標。
* **`getWorldCoordinate(event)`** を新設する：`const { x, y } = this.getScreenCoordinate(event); return this.viewTransform.screenToWorld(x, y);`。
* `VectorModel`へ渡す座標（`startDraft`/`updateDraft`/`updateVertex`/`moveShape`の差分）、`hitTest`/`hitTestHandle`へ渡す座標、`lastCursor`、`#resolveCursor(point)`の`point`はすべて`getWorldCoordinate()`由来とする。
* パン量（要件2）・ズーム中心（要件3）は`getScreenCoordinate()`由来とする。
* コンストラクタ第3引数`viewTransform`を追加し、`this.viewTransform`として保持する（依存性の注入。`main.js`が生成・注入）。

### 要件2: パン（`InputTracker.js`）

#### 2-1. パン状態の表現（新しい`InputState`値は追加しない）
パンは`DRAWING`状態を保持したまま行う必要があるため、`InputState`とは**直交する別フラグ**で表現する。

| フィールド（private）    | 型                                                  | 初期値  | 意味 |
| ------------------------ | --------------------------------------------------- | ------- | ---- |
| `#panDrag`               | `{button: number, lastScreen: {x, y}} \| null`      | `null`  | パンのドラッグ中なら、開始したマウスボタン（0=左/1=中）と直前カーソルのスクリーン座標。非nullがパン中を表す。 |
| `#isSpacePressed`        | `boolean`                                           | `false` | スペースキー押下中か。 |
| `#suppressNextClick`     | `boolean`                                           | `false` | 左ボタンのパン終了直後に発火する`click`を1回だけ無視するためのフラグ。 |

#### 2-2. パン開始（`handleMouseDown`の先頭で判定）
`handleMouseDown`の冒頭に以下を追加し、既存の選択モード処理より先に評価する。
1. `this.#suppressNextClick = false`（前回のパンが`click`を伴わずに終わった場合のフラグ残留を、次の押下で必ず解除する）。
2. `this.#panDrag`が非null（既にパン中）なら何もせずreturn。
3. `event.button === 1`（中ボタン）なら`event.preventDefault()`（オートスクロール抑止）。`state !== DRAGGING_HANDLE`であれば`#beginPan(event)`してreturn。`DRAGGING_HANDLE`中ならパンせずreturn。
4. `event.button === 0`かつ（`#isSpacePressed` または `currentMode === OperationMode.PAN`）かつ`state !== DRAGGING_HANDLE`なら`#beginPan(event)`してreturn。
5. 以降は既存処理（IDLE・選択モード中のハンドル判定）。

`#beginPan(event)`：`#panDrag = { button: event.button, lastScreen: this.getScreenCoordinate(event) }`。選択モード中のホバー表示が古いまま残らないよう`model.clearHovered()`を呼ぶ。`#updateCursor()`（→`grabbing`）。`DRAWING`状態・作成途中図形には触れない。

#### 2-3. パン中の追従と終了（`window`へのcapture購読）
`WindowManager`は`.float-window`上の`mousemove`/`mouseup`の伝播を止めるため、キャンバスへの購読だけではフロートウィンドウ上・ブラウザ外でボタンを離した場合に検知できない。そこで`WindowManager`と同じく **`window`へcaptureフェーズ（第3引数`true`）で購読**する（captureは対象要素の`stopPropagation`より先に到達する）。コンストラクタで常設し、`#panDrag === null`の間は何もしない。
* `#handleWindowMouseMove(event)`：パン中なら`getScreenCoordinate(event)`（キャンバス外でもキャンバス左上基準のスクリーン座標が得られる）と`lastScreen`の差分を`viewTransform.panBy(dx, dy)`へ渡し、`lastScreen`を更新する。
* `#handleWindowMouseUp(event)`：パン中かつ`event.button === #panDrag.button`なら`#endPan()`。
* `#endPan()`：開始ボタンが左（0）だった場合は`#suppressNextClick = true`。`#panDrag = null`。`#updateCursor()`。
* キャンバスの`handleMouseMove`冒頭に「`#panDrag`が非nullなら何もせずreturn」を追加する（パン中にホバー判定・作成途中図形の更新・ハンドルドラッグが走らない）。パン中はカーソル下のワールド座標点がカーソルに追従するため、`DRAWING`中の作成途中図形の終点はパン後もカーソル位置にあり、次の`mousemove`以降も従来どおり追従する。
* `handleClick`冒頭に「`#suppressNextClick`が真ならfalseに戻してreturn」を追加する（スペース／キャンバス移動モードの左ドラッグ後の`click`で、作成開始・確定・選択・選択解除が実行されない）。中ボタンでは`click`は発火しないため抑止不要。
* `setMode()`に「パン中なら`#endPan()`」を追加する（安全策）。

#### 2-4. スペースキー
* `handleKeyDown`の**先頭**（既存の選択モードガードより前）で`event.code === 'Space'`を判定し、`#handleSpaceKeyDown(event)`へ委譲してreturnする。
    * `isTextInputElement(document.activeElement)`が真なら何もしない（文字入力を妨げない。`preventDefault`もしない）。
    * それ以外は`event.preventDefault()`（ページスクロール、およびフォーカス中のボタンのスペース押下による誤クリックの抑止）。
    * `#isSpacePressed`が既に真（キーリピート）なら以上で終了（状態を二重に変えない）。偽なら真にして`#updateCursor()`（→`grab`）。
* `document`へ`keyup`を新たに購読（`handleKeyUp(event)`）：`Space`かつテキスト入力中でなければ`preventDefault()`、`#isSpacePressed = false`、`#updateCursor()`。
    * スペースを離した時点でパンのドラッグ中だった場合、**そのドラッグはマウスボタンを離すまで継続**する（ドラッグ途中で選択・作成の挙動に切り替わる不整合を避けるため。終了時の`click`抑止も有効）。
* `window`へ`blur`を新たに購読（`#handleWindowBlur()`）：`#isSpacePressed = false`、パン中なら`#endPan()`の後`#suppressNextClick = false`（`blur`後に`click`は来ないため）、`#updateCursor()`。

#### 2-5. テキスト入力判定ヘルパー（Phase 02-04で再利用）
`InputTracker.js`のモジュールスコープに以下をexportする（クラス外の純粋関数）。
```js
/**
 * 要素がテキスト入力中とみなすべき要素（input / textarea / contenteditable）かを判定する。
 * キーボードショートカット（スペースパン、将来のDelete/Backspace等）の誤爆防止に用いる。
 * @param {Element|null} element 判定対象（通常は document.activeElement）
 * @returns {boolean}
 */
export function isTextInputElement(element) { ... }
```
* 判定：`element`が`HTMLElement`であり、`tagName`が`INPUT`または`TEXTAREA`、または`isContentEditable`が真。
* 本作業では`Space`判定にのみ使用し、`Delete`/`Backspace`には適用しない（Phase 02-04）。`index.html`に確認用の入力欄は追加しない。

#### 2-6. 「キャンバス移動」操作モード
* `OperationMode`に`PAN: 'pan'`を1エントリ追加する。`setMode`のバリデーションは`OperationMode`を正とするため自動的に受理される。
* `index.html`の`#window-control-panel`の`.window-body`に`<button type="button" id="mode-pan" class="tool-btn">✋ キャンバス移動</button>`を`#mode-create`の直後に追加する（タスク7）。その後のタスクで`main.js`の`modeButtons`へ`[OperationMode.PAN]: document.getElementById('mode-pan')`を追加する（タスク8）。
* `applyMode`本体・ボタン走査ループは書き換えない。パレット活性は`currentMode === OperationMode.CREATE`のままでパンモード中は自動的に非活性になる。
* パンモード中、`handleMouseMove`（IDLE処理は選択モード限定）・`handleClick`（選択/作成モード以外は無視）・`handleKeyDown`の`Delete`処理（選択モード限定）は既存ガードによりすべて無反応となる。左ドラッグは2-2の手順4でパンになる。

#### 2-7. カーソル形状（`#resolveCursor`の判定順序の改訂）
| 順 | 条件                                                        | 戻り値         |
| -- | ----------------------------------------------------------- | -------------- |
| 0a | パンのドラッグ中（`#panDrag !== null`）                     | `'grabbing'`   |
| 0b | スペース押下中かつ`state !== DRAGGING_HANDLE`               | `'grab'`       |
| 1  | 図形作成モード                                              | `'crosshair'`  |
| 2  | キャンバス移動モード                                        | `'grab'`       |
| 3  | 選択モード以外（将来のモード追加時の既定値）                | `'default'`    |
| 4〜8 | 既存の(3)〜(7)（`DRAGGING_HANDLE`→`move`、座標不明→`default`、ハンドル上→`move`、ホバー中→`pointer`、その他→`default`） | 既存どおり |

* 0bに`DRAGGING_HANDLE`除外を付けるのは、ハンドルドラッグ中はパンを開始しない仕様のため、`grab`表示が誤誘導になるため（ドラッグ中は`move`を維持）。
* 手順5のハンドル判定の許容誤差は要件6のワールド換算値を用いる。`point`はワールド座標。
* `#updateCursor`の追加呼び出し箇所：`#beginPan`、`#endPan`、スペースの押下（初回のみ）／解放、`blur`。いずれも座標不明（`null`）で評価し、選択モードのホバー由来の形状は次の`mousemove`で再評価される。

#### 2-8. 他の操作との関係（まとめ）
| 状態                | 中ボタン／スペースパン | ホイールズーム | 備考 |
| ------------------- | ---------------------- | -------------- | ---- |
| `IDLE`              | 可                     | 可             | パンモード中は左ドラッグもパン。 |
| `DRAWING`           | 可（作成途中図形は保持） | 可           | パン終了時の`click`は抑止され、作成確定は起きない。 |
| `DRAGGING_HANDLE`   | **不可**（開始しない） | 可             | ズームはカーソル中心のため、カーソル下のワールド点は不変で頂点追従・move差分は破綻しない。 |
| パンのドラッグ中    | （二重開始しない）     | 可             | パン中は`handleMouseMove`/`handleMouseDown`の他処理は走らない。 |

### 要件3: ズーム（`InputTracker.js`）
* キャンバスへ`wheel`を`{ passive: false }`で購読する（`handleWheel(event)`）。
    1. `event.preventDefault()`（ページスクロール・Ctrl+ホイールのブラウザズームを抑止）。
    2. `event.deltaY === 0`（横スクロールのみ）なら何もしない。
    3. `factor = event.deltaY < 0 ? WHEEL_ZOOM_STEP : 1 / WHEEL_ZOOM_STEP`（`WHEEL_ZOOM_STEP = 1.1`をモジュール定数として定義）。
    4. `const { x, y } = this.getScreenCoordinate(event); this.viewTransform.zoomAt(x, y, factor);`
* `deltaY`の符号のみで方向を決め、大きさは使わない（トラックパッドの扱いは懸念事項参照）。
* 操作モード・入力状態によらず常に有効。`DRAWING`中もカーソル下のワールド点が不変のため、作成途中図形の終点はカーソル位置に留まり、以後の`mousemove`でも追従する。
* ズーム後のホバー状態・カーソル形状は次の`mousemove`で再評価する（ホイール単独では再判定しない）。

### 要件4: 倍率表示とリセット（`index.html` / `main.js`）
* `index.html`：`#window-control-panel`の`.window-body`内、操作モードボタン群の下に以下を追加する。
    ```html
    <div class="view-zoom-row">
        <span id="view-zoom-display">100%</span>
        <button type="button" id="view-reset" class="tool-btn">リセット</button>
    </div>
    ```
    CSSに`.view-zoom-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: #333; }`を追加する（既存の`.float-window`/`.window-header`/`.tool-btn`/`.disabled`の定義は変更しない）。リセットボタンは`modeButtons`に含めないため`.active`は付かない。
* `main.js`：
    * `syncZoomDisplay()`：`zoomDisplayEl.textContent = \`${Math.round(viewTransform.getScale() * 100)}%\``。`viewTransform.onChange(syncZoomDisplay)`で登録し、起動時にも1回呼ぶ。
    * リセットボタンのclickで`viewTransform.reset()`を呼ぶのみ（再描画・表示更新は`onChange`経由）。操作モード・選択状態には触れない。
* DOM更新の担当は`main.js`とする（`CanvasManager`・`VectorModel`・`ViewTransform`はDOMに触れない）。表示要素が1つ・ボタン1つの小規模な配線であり、`palette/`配下にUI部品を新設するほどの責務ではないと判断した。

### 要件5: 背景グリッド（`CanvasManager.js`）
* privateメソッド`#drawGrid(view)`を新設し、`render()`内で**クリア直後・図形描画より前**に呼ぶ。
* ワールド変換を設定した状態で、ワールド座標上の格子線を描く。線幅は`1 / view.scale`（ワールド単位）とし、画面上で常に1px相当にする。
* **可視範囲の算出**：変換式を`CanvasManager`に重複させないため、`this.ctx.getTransform().inverse()`（標準`DOMMatrix`）でバッファ四隅`(0,0)`・`(canvas.width, canvas.height)`をワールド座標へ写して求める。範囲は`Math.floor(min / spacing) * spacing`から`max`まで`spacing`刻みで線を引く（画面に見えている範囲のみ。無限キャンバスとして振る舞う）。
* **間隔の自動間引き**（定数はモジュールスコープに定義）：
    * `GRID_BASE_SPACING = 10`（ワールド）、`GRID_MIN_SCREEN_SPACING = 8`（スクリーンpx）。
    * `minor = GRID_BASE_SPACING`から開始し、`minor × scale < GRID_MIN_SCREEN_SPACING`の間`minor *= 10`（上限ガード付き）。`major = minor × 10`。
    * 例：倍率100%→細線10/太線100、倍率50%→細線100/太線1000（細線10は描かれない）、倍率10%→細線100/太線1000、倍率1000%→細線10/太線100。
* **色**：細線`rgba(0, 0, 0, 0.06)`、太線`rgba(0, 0, 0, 0.14)`（図形の視認を妨げない薄い色）。細線を先に描き、太線を重ねる（太線位置の細線は重複描画されるが視覚上問題ない）。それぞれ1本の`beginPath()`にまとめて`stroke()`1回で描く。
* グリッドはスナップ機能を持たない。ON/OFF切替も持たない（Non-goal）。

### 要件6: ハンドル・ホバー強調・当たり判定の見た目一定化
* **当たり判定**（`InputTracker`）：privateメソッド`#getWorldHitTolerance()`＝`this.viewTransform.screenLengthToWorld(this.hitTolerance)`を新設し、`hitTest`/`hitTestHandle`の全呼び出し（`handleMouseMove`のホバー判定、`handleMouseDown`のハンドル判定、`#resolveCursor`のハンドル判定）の第3引数をこれに置き換える。`hitTolerance`（=5）はスクリーンpx単位である旨をJSDocに明記する。図形クラスの当たり判定ロジックは変更しない。
* **描画**（`shapes/`）：`Line`/`Curve`/`Rect`/`Ellipse`の`drawHandles(ctx, viewScale = 1)`／`drawHover(ctx, viewScale = 1)`にシグネチャを統一し、以下のスクリーン一定値を`÷ viewScale`でワールド単位に換算して描く。

| 対象 | 現行値 | 改修後 |
| ---- | ------ | ------ |
| ハンドル一辺（`handleSize`／Ellipseは`half = 4`） | 8 | `8 / viewScale`（`half`は`4 / viewScale`） |
| ハンドル枠線幅 | 1.5 | `1.5 / viewScale` |
| ホバー強調の線幅 | `strokeWidth + 6` | `strokeWidth + 6 / viewScale`（`strokeWidth`部分は倍率に比例して表示される） |
| `Curve`の制御点ヘルパー点線（線幅・破線間隔） | 1 / `[2, 2]` | `1 / viewScale` / `[2 / viewScale, 2 / viewScale]` |

* `Curve`のヘルパー点線はREQの列挙外だが`drawHandles`内の補助表示であり、倍率に比例して太く・粗くなると見た目の一貫性を欠くため同様に換算する（判断事項として懸念事項に記載）。
* `viewScale`省略時（既定値1）は現行と完全に同じ見た目になる。`draw(ctx, t)`のシグネチャ・内容は変更しない。
* `CanvasManager`は全図形に一律`shape.drawHover(ctx, view.scale)`／`shape.drawHandles(ctx, view.scale)`を渡すのみで、図形種別の分岐を持たない。作成途中図形（`draftLine.draw(ctx)`）は対象外。

### 要件7: 描画変換の適用（`CanvasManager.js`）
* `render(shapes, { hoveredId = null, selectedId = null, draftLine = null, view = DEFAULT_VIEW } = {})`とする。`DEFAULT_VIEW = Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })`をモジュール定数とし、第2引数省略時・`view`省略時は倍率1.0・オフセット(0,0)として振る舞う。
* `resize()`で算出したdprをprivateフィールド`#pixelRatio`に保持する（描画バッファの設定値であり、図形データ・選択状態・ビュー変換状態ではない。懸念事項参照）。`resize()`は従来どおりバッファサイズを再計算し、`ctx.scale(dpr, dpr)`の代わりに`#pixelRatio`の更新のみを行う（変換の設定は`render()`が毎フレーム行う）。
* `render()`の手順：
    1. `ctx.setTransform(1, 0, 0, 1, 0, 0)`→`ctx.clearRect(0, 0, canvas.width, canvas.height)`（変換の影響を受けずにバッファ全体を消去）。
    2. `ctx.setTransform(dpr × s, 0, 0, dpr × s, dpr × offsetX, dpr × offsetY)`（毎フレーム明示設定。`scale`/`translate`の累積はしない）。
    3. `#drawGrid(view)`（背面）。
    4. 既存の図形ループ（`draw` → 一致時`drawHover(ctx, view.scale)` → 一致時`drawHandles(ctx, view.scale)`）。
    5. `draftLine.draw(ctx)`。
* ウィンドウリサイズ時は`main.js`の`resize()`→`renderCurrentState()`の順序を維持する。ビュー変換状態は`ViewTransform`が保持しているため失われない（オフセットはキャンバス左上基準のため、リサイズしても左上の表示位置は不変）。
* `resize()`内・`getLogicalCoordinate()`（→`getScreenCoordinate()`）の「将来ズーム・パン実装時に修正が必要」コメントは削除し、実態（`resize`はdprの算出・バッファ同期のみ／ビュー変換は`render`で合成、`getScreenCoordinate`はスクリーン座標を返しワールド変換は`getWorldCoordinate`が担う）を記したJSDocに置き換える。

### 要件8: 回帰防止（パン・ズーム後の操作の一致）
* 図形データに渡る座標はすべて`getWorldCoordinate()`経由に統一する（1-4）。`moveShape`の差分は`lastCursor`（ワールド座標）との差分で計算するため、倍率≠1でもカーソルと図形の移動量が一致する。
* パン・ズームは`ViewTransform`の値のみを変更し、図形データ（座標・線幅）は一切書き換えない。
* テストプレイの目視確認項目（DPI・CSSズーム含む）は「5. 懸念事項・要確認ポイント」に列挙する。

### 責務の肥大化に関する検討（`InputTracker`の分割の採否）
* **検討案**：パン・ズームの入力解釈（ホイール・中ボタン・スペースキー・`window`購読）を`core/ViewInputController.js`等へ分離する。
* **結論：本作業では不採用**（`InputTracker`内にprivateメソッド群`#beginPan`/`#endPan`/`#handleWindowMouseMove`/`#handleWindowMouseUp`/`#handleSpaceKeyDown`/`#handleWindowBlur`としてまとめ、ファイル内で一塊に配置する）。
* **理由**：(1)パン状態は`InputTracker`の状態遷移（`DRAGGING_HANDLE`中は開始しない、パン中はホバー・作成・ハンドル判定を止める、パン終了後の`click`抑止、操作モード`'pan'`の解釈）と密結合しており、分離すると両クラスが互いの状態を問い合わせる双方向依存になる。(2)カーソル形状の判定（`#resolveCursor`）がパン状態とモード・当たり判定を同時に参照する単一の判定表であり、分割すると判定順序の一元性が崩れる。(3)REQのスコープ（変更対象ファイル）に別の入力解釈ファイルが含まれない。
* ファイル先頭の責務JSDocは「ユーザー入力の解釈（パン・ズームを含む）」として範囲内に収まる形へ更新する（タスク5/6）。Phase 02-03（範囲選択）でドラッグ系の入力がさらに増える際に、ドラッグ操作の分離を再検討すること（懸念事項に記載）。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./`（`index.html`） - コントロールパネルのDOM・CSS（キャンバス移動ボタン、倍率表示、リセットボタン）
    *   `./js/` - エントリポイント（`main.js`：ビュー変換の生成・注入・再描画配線・倍率表示・リセット）
    *   `./js/core/` - ビュー変換（`ViewTransform.js`・**新設**）、入力解釈層（`InputTracker.js`）、描画層（`CanvasManager.js`）
    *   `./js/shapes/` - 図形ドメイン（`Line.js`/`Curve.js`/`Rect.js`/`Ellipse.js`：`drawHandles`/`drawHover`の倍率対応のみ）
*   **関連する論理クラス**:
    *   `ViewTransform`（**新規**：倍率・オフセットの保持、`screenToWorld`/`worldToScreen`/`screenLengthToWorld`、`zoomAt`/`panBy`/`reset`、`getScale`/`getState`、`onChange`、`MIN_SCALE`/`MAX_SCALE`）
    *   `InputTracker`（更新：`viewTransform`注入、`getLogicalCoordinate`→`getScreenCoordinate`リネーム、`getWorldCoordinate`新設、許容誤差のワールド換算、ホイールズーム`handleWheel`、パン状態`#panDrag`/`#isSpacePressed`/`#suppressNextClick`と関連privateメソッド、`handleKeyUp`、`blur`処理、`#resolveCursor`の`grab`/`grabbing`）
    *   `OperationMode`（更新：`PAN: 'pan'`追加）、`isTextInputElement`（**新規**：`InputTracker.js`内のexport関数）、`WHEEL_ZOOM_STEP`（新規：`InputTracker.js`内のモジュール定数）
    *   `CanvasManager`（更新：`render()`の第2引数に`view`、`#pixelRatio`、毎フレームの`setTransform`、`#drawGrid`、`drawHover`/`drawHandles`への倍率受け渡し）
    *   `Line`/`Curve`/`Rect`/`Ellipse`（更新：`drawHandles(ctx, viewScale = 1)`/`drawHover(ctx, viewScale = 1)`）
    *   `main.js`（更新：`ViewTransform`生成・注入、`renderCurrentState`へ`view`追加、`viewTransform.onChange`登録、`modeButtons`へ`PAN`追加、`syncZoomDisplay`、リセット配線）
    *   参照のみ（変更しない）：`VectorModel`、`ShapeFactory`、`WindowManager`、`PaletteController`

### 参照する責務
*   **main.js** : アプリケーションのエントリポイント。DOM読み込み完了後、`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`のインスタンス化とイベントバインドを担う。`applyMode(mode)`で操作モード切替を一元管理する（`modeButtons`オブジェクト（キーは`OperationMode`の値）へのエントリ追加のみで新規モードボタンに対応できる設計。ただし対応するDOM要素を`index.html`側に先に用意し、`InputTracker`の`OperationMode`にも値を追加する必要がある）。`applyMode`は`InputTracker.setMode`呼び出し後に`getMode()`で実状態を読み返して`.active`を同期し、パレットの活性（図形作成モード時のみ）と図形種別ハイライトを`paletteController.setEnabled`/`setActiveType`へ委譲する（コントロールパネル領域とパレット領域とで`.active`管理の責任主体を分離）。図形種別の切替は`applyShapeType(type)`（パレットの`onTypeSelected`コールバック）が担う。起動時に`applyMode(OperationMode.SELECT)`でUI初期表示を内部状態へ同期する。
*   **VectorModel.js**（参照のみ・変更禁止） : 描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。選択状態(`#selectedId`)・ホバー状態(`#hoveredId`)・作成中図形(`#draftLine`)を保持する。選択/ホバーの読み書きAPI（`selectShape`/`clearSelection`/`getSelectedId`、`setHovered`/`clearHovered`/`getHoveredId`）と、ドラフト（作成中図形）のライフサイクルAPI（`startDraft(x, y, type = 'line')`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。再編集用の`updateVertex(id, vertexIndex, x, y)`/`moveShape(id, dx, dy)`は、対象shapeの`setVertex(vertexIndex, x, y)`/`translate(dx, dy)`へポリモーフィックに委譲する。図形の生成は`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する。図形削除用の`deleteShape(id)`を持ち、削除対象が選択中/ホバー中であった場合はそれらの状態も同時にクリアする。
*   **CanvasManager.js** : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedId, draftLine } = {})`の形で呼び出される（第2引数は省略可、省略時は通常描画のみ）。通常描画（`shape.draw(ctx)`）に加え、`hoveredId`と一致する図形には`drawHover(ctx)`を、`selectedId`と一致する図形には`drawHandles(ctx)`をポリモーフィックに追加呼び出す。`draftLine`が渡された場合は全図形描画後に`draw(ctx)`のみ重ねて描画する。内部バッファサイズとdprスケールの計算・再適用は公開メソッド`resize()`が担い、コンストラクタからの初期化と`main.js`からのウィンドウリサイズ時の再同期の両方から呼び出される。`resize()`はバッファサイズ・スケールの再計算のみを行い、`render()`の呼び出しは行わない（再描画トリガーは`main.js`側の責務）。
*   **InputTracker.js** : マウス・キーボード入力の解釈、キャンバス座標への変換。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシンとして実装する。`IDLE`ではホバー判定・選択・新規作成の開始、`DRAWING`では作成中図形の追従・確定、`DRAGGING_HANDLE`ではハンドルドラッグによる頂点更新・平行移動を扱い、状態に応じて`VectorModel`の対応するAPIを呼び出す。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。ハンドル種別から更新対象`vertexIndex`への解決も`shape.getVertexIndexForHandle(this.activeHandle)`へ委譲する。操作モード(`currentMode`: `OperationMode`＝`'select'`/`'create'`)と図形種別(`currentShapeType`: `SHAPE_TYPES`のいずれか、初期値`'line'`)を独立した状態として保持し、定数`OperationMode`/`SHAPE_TYPES`をexportする。`setMode(mode)`で操作モードを切り替え（選択/ホバー状態のクリアと進行中操作の強制中断（IDLE復帰）を伴う）、`setShapeType(type)`で図形種別を切り替える（作成途中の図形のみ破棄、モードは維持）。いずれも未知の値は`console.warn`のうえ無視する。`getMode()`/`getShapeType()`で現在値を読み出せる。`currentMode`に応じて`handleMouseMove`/`handleMouseDown`/`handleClick`の解釈を排他的に切り替え、作成開始は図形作成モード中のみ行う。キャンバスのカーソル形状（作成モード:`crosshair`／選択モードでハンドル上・ドラッグ中:`move`／図形上:`pointer`／その他:`default`）の設定も担い、判定は`hitTestHandle`とホバー状態のポリモーフィックな利用のみで行う。`document`購読の`keydown`ハンドラを持ち、選択モード中に選択図形がある状態での`Delete`/`Backspace`押下で`VectorModel.deleteShape(id)`を呼び出す。
*   **ShapeFactory.js**（参照のみ・変更禁止） : 図形typeに応じたインスタンス生成を一元的に担うFactory。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。
*   **WindowManager.js**（参照のみ・変更禁止） : `.float-window`要素の動的検知と、ドラッグ移動・アクティブ最前面化・イベント遮断（下層要素への透過防止）を一元管理する。`VectorModel`が持つ図形データ・選択状態・ツール状態には一切関与しない、DOM統治専任のクラスである。
*   **shapes/** : 図形種別ごとのデータ保持・描画・当たり判定を担う。`Line`/`Curve`/`Rect`/`Ellipse`はいずれも同一シグネチャの9メソッド（`draw(ctx, t)`、`drawHandles(ctx)`、`drawHover(ctx)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`）を自律実装しており、この契約を満たす限り`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を変更せずに作成・選択・再編集フローへ組み込める。新規図形を追加する際はこの9メソッド契約を満たすこと。
*   **PaletteController.js**（参照のみ・変更禁止） : 図形選択パレットの配線を担う自己完結UI部品。`InputTracker`へ直接依存せず、図形種別選択時に呼び出す汎用コールバック`onTypeSelected(type)`を受け取る。`setEnabled(enabled)`でパレット本体の`.disabled`制御を、`setActiveType(type)`で5ボタンの`.active`排他制御を行う。操作モードの知識は持たない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1. プロジェクトフォルダ構造** : `js/core/`配下に`ViewTransform.js`を追加する（`CanvasManager.js`の直後等）。
*   **2. データ構造（Model）の概要** : 「ShapeDataの座標はすべてワールド座標であり、ビュー変換（表示倍率・オフセット）は図形データに含まれない（`ViewTransform`が保持する表示専用の状態）」旨を1〜2文追記する。
*   **3. 描画・操作フロー** : 座標系の説明を追記する。「入力：`InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す（パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す）。描画：`main.js`の`renderCurrentState()`が`viewTransform.getState()`を`render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎フレーム設定する。再描画は`VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から同一関数で行う。」
*   **4. ViewTransform.js（新規項目）** : 「キャンバスのビュー変換状態（倍率`scale`・オフセット`offsetX`/`offsetY`、`スクリーン = ワールド × 倍率 ＋ オフセット`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する（`screenToWorld`/`worldToScreen`/`screenLengthToWorld`）。`zoomAt(sx, sy, factor)`はカーソル位置中心のズーム（倍率は`MIN_SCALE`=0.1〜`MAX_SCALE`=10.0にクランプ、クランプ時もカーソル下のワールド点は不変）、`panBy(dx, dy)`はスクリーン座標での平行移動、`reset()`は倍率1.0・オフセット(0,0)への復帰。値が実際に変化した場合のみ`onChange`リスナーへ通知する。`getState()`は描画用のプレーンオブジェクトを返す。図形データ・DOM・`CanvasManager`には依存しない。」
*   **4. main.js** : 「`ViewTransform`を生成して`InputTracker`へ注入し、`renderCurrentState()`で`view: viewTransform.getState()`を`render()`へ渡す。`viewTransform.onChange`に`renderCurrentState`と`syncZoomDisplay`（コントロールパネルの倍率表示`#view-zoom-display`の更新）を登録する。リセットボタン`#view-reset`は`viewTransform.reset()`を呼ぶのみ。」を追記。`modeButtons`の例に`PAN`が加わる旨は既存記述の範囲内（追記任意）。
*   **4. main.js**（タスク4で追加） : 起動時の記述「起動時に`applyMode(OperationMode.SELECT)`でUI初期表示を内部状態へ同期する」の後に、「起動時初期化の最後に`renderCurrentState()`を明示的に1回呼び出し、初回描画を`onChange`通知の副作用に依存させない」旨を追記する。
*   **4. main.js**（タスク8で追加） : 上記の初回描画の記述に続けて、「倍率表示も同様に起動時初期化の最後に`syncZoomDisplay()`を明示的に1回呼び出し、`index.html`の初期文字列や`onChange`通知に依存させない」旨を追記する。`modeButtons`に`[OperationMode.PAN]: #mode-pan`が加わった旨（既存記述「エントリ追加のみで新規モードボタンに対応できる設計」の実例）を追記してもよい。
*   **4. CanvasManager.js** : `render()`の記述を「`render(shapes, { hoveredId, selectedId, draftLine, view } = {})`。`view`（`{scale, offsetX, offsetY}`、省略時は倍率1.0・オフセット(0,0)）と`resize()`で算出したdpr（`#pixelRatio`）を合成した描画変換を毎フレーム`setTransform`で明示設定する。クリアは変換の影響を受けずにバッファ全体を消去する。図形より先に、ワールド座標上の背景グリッド（細線10/太線100、画面上の間隔が8px未満なら10倍ずつ繰り上げ、線幅は画面上1px一定、可視範囲のみ）を描く。`drawHover(ctx, view.scale)`/`drawHandles(ctx, view.scale)`へ倍率を一律に渡す。ビュー変換状態は保持しない（値は引数で受け取る）。」に更新。`resize()`の記述の「dprスケールの計算・再適用」を「dprの算出とバッファサイズの同期（変換の適用は`render()`が行う）」に更新。
*   **4. InputTracker.js** : 以下を追記・更新。「コンストラクタで`ViewTransform`を受け取る。`getScreenCoordinate(event)`でスクリーン座標（CSSズーム吸収済み）を取得し、`getWorldCoordinate(event)`でワールド座標へ逆変換する。`VectorModel`・当たり判定へ渡す座標はすべてワールド座標、当たり判定の許容誤差は画面上5px相当をワールド換算して渡す。`OperationMode`に`'pan'`（キャンバス移動）を含む。パン（中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モードの左ドラッグ）は`InputState`と直交するフラグで表現し、`DRAWING`を保持したまま行える（`DRAGGING_HANDLE`中は開始しない）。パンの追従・終了は`window`へのcapture購読で検知し、左ボタンのパン後の`click`は抑止する。キャンバスの`wheel`（`passive: false`）でカーソル位置中心のズーム（1刻み約1.1倍）を行う。スペース押下状態は`keyup`・`blur`で解除する。カーソル形状に`grabbing`（パン中）／`grab`（スペース押下中・キャンバス移動モード）を加える。テキスト入力中判定ヘルパー`isTextInputElement(element)`をexportする。」また`currentMode`の型記述を`'select'`/`'create'`/`'pan'`に更新。
*   **4. shapes/**（タスク3で実装済み） : 9メソッド契約の記述を`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`に更新し、「`viewScale`は表示倍率。ハンドルの大きさ・枠線幅・ホバー強調の上乗せ幅等の補助表示を画面上一定に保つため`÷ viewScale`で換算する。図形本体の`draw`は倍率を受け取らない（線幅は倍率に比例して表示される）」旨を追記。

## 3. タスクリスト

> **タスク共通事項（各実装タスクの最後に必ず行うこと）**
> * コード修正完了後、改修したクラス・メソッド・フィールド・定数のJSDocコメントに記載漏れがないこと、および`.js`ファイル先頭の責務JSDoc（3行以内）が改修後の実態と一致していることを確認する。**座標を扱う引数・戻り値・プロパティには、それがワールド座標かスクリーン座標かを明記すること。**
> * `node --check`で構文エラーがないことを確認する。
> * 本RESの「4. 詳細作業内容」の該当タスク欄に作業内容を記載し、タスクを`[x]`にする。
> * 開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を本RESの『開発資料の更新予定』欄に追記する。
> * 実装中に判断に迷った点、目視確認を推奨する箇所、将来この箇所を修正する際に注意すべき点があれば、本RESの「5. 懸念事項・要確認ポイント」欄に追記する。
> * 変更禁止ファイル（`VectorModel.js`／`WindowManager.js`／`ShapeFactory.js`／`PaletteController.js`）には触れない。
>
> **タスク順序の方針**：各タスク完了時点でアプリが起動・動作する順序とする。タスク1（新設クラス）→タスク2〜3（描画側は既定値で現行と同じ見た目）→タスク4（配線。この時点では倍率1.0固定）→タスク5（座標分離＋ズーム）→タスク6（パン）→タスク7〜8（UI）。

*   [x] タスク1: ビュー変換クラス`ViewTransform`の新設
    *   **対象ファイル** :
        *   `./js/core/ViewTransform.js` : 新規
    *   **作業内容** :
        *   ファイル先頭に責務JSDoc（要件1 1-1の文面、3行以内）を記述する。
        *   `export class ViewTransform`を作成し、static定数`MIN_SCALE = 0.1`／`MAX_SCALE = 10.0`、privateフィールド`#scale = 1`／`#offsetX = 0`／`#offsetY = 0`／`#listeners = []`を定義する。各フィールド・定数にJSDoc（`@type`、単位：倍率は無次元、オフセットはスクリーン座標のCSSピクセル）を付ける。
        *   要件1 1-1の表のメソッド（`getScale`/`getState`/`screenToWorld`/`worldToScreen`/`screenLengthToWorld`/`zoomAt`/`panBy`/`reset`/`onChange`）とprivateメソッド`#notifyChange`を実装する。`zoomAt`は要件1 1-2の手順1〜6を厳守する。
        *   各メソッドのJSDocに、引数・戻り値がスクリーン座標かワールド座標かを明記し、`zoomAt`には「クランプ後の倍率でオフセットを再計算するため、クランプ時もカーソル下のワールド点は不変」「倍率が変化しない場合は通知しない」旨を、`getState`には「描画用スナップショット（呼び出しごとに新しいオブジェクト）」である旨を記載する。
        *   クラスJSDocに変換式（`スクリーン = ワールド × 倍率 ＋ オフセット`）と「変換式は本クラスにのみ実装する」旨を記載する。
        *   `VectorModel`・`CanvasManager`・図形クラス・DOMへの依存を持たないこと（importなし）。
        *   本タスク時点では利用者がいないため、アプリの挙動は変わらない。

*   [x] タスク2: `CanvasManager`の描画変換合成と背景グリッド
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
    *   **作業内容** :
        *   モジュール定数`DEFAULT_VIEW`（`Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })`）、`GRID_BASE_SPACING = 10`、`GRID_MIN_SCREEN_SPACING = 8`、グリッド色2種（要件5）を定義し、それぞれJSDocを付ける。
        *   privateフィールド`#pixelRatio`を追加し、`resize()`で`window.devicePixelRatio || 1`を代入する。`resize()`末尾の`this.ctx.scale(dpr, dpr)`と「将来的にキャンバスのズーム機能を追加する際は…」コメントを削除し、`resize()`のJSDocを「dprの算出とバッファサイズの同期のみを行い、描画変換（dpr×ビュー変換）の適用は`render()`が毎フレーム行う」旨に更新する。冒頭の`setTransform(1, 0, 0, 1, 0, 0)`は残してよい。
        *   `render()`の第2引数の分割代入に`view = DEFAULT_VIEW`を追加し、要件7の手順1〜5に書き換える（クリアは恒等変換で`canvas.width`/`canvas.height`全体、続いて`setTransform(dpr × s, 0, 0, dpr × s, dpr × offsetX, dpr × offsetY)`）。
        *   privateメソッド`#drawGrid(view)`を新設する（要件5。可視範囲は`this.ctx.getTransform().inverse()`でバッファ四隅を写して求める。間隔の繰り上げループには上限ガードを設ける。`ctx.save()`/`restore()`等でスタイルを後続描画へ残さない）。JSDocに、描画はワールド座標で行い線幅`1 / scale`で画面上1px一定にすること、間引き規則、可視範囲のみ描くことを記載する。
        *   図形ループの`shape.drawHover(this.ctx)`／`shape.drawHandles(this.ctx)`を`(this.ctx, view.scale)`に変更する（この時点の図形クラスは第2引数を無視するため挙動不変）。`draftLine.draw(this.ctx)`は変更しない。
        *   `render()`のJSDocに`@param {{scale: number, offsetX: number, offsetY: number}} [state.view]`（省略時は倍率1.0・オフセット(0,0)、オフセットはスクリーン座標）を追記し、`shapes`の説明を`drawHover(ctx, viewScale)`/`drawHandles(ctx, viewScale)`に改める。
        *   ファイル先頭の責務JSDocを「Canvas要素への純粋な描画処理（背景グリッドを含む）のみを担う。描画変換は引数で受け取ったビュー変換値から毎フレーム設定し、状態は保持しない。」の趣旨（3行以内）に更新する。
        *   `ViewTransform`・`VectorModel`をimportしないこと。図形種別の分岐を持ち込まないこと。
        *   完了後、起動して背景グリッド（10px細線・100px太線）が図形の背面に表示され、既存の作成・選択・ハンドル操作が従来どおり動くことを確認する（`main.js`は`view`を渡していないため倍率1.0で描画される）。

*   [x] タスク3: 図形クラスの`drawHandles`/`drawHover`の倍率対応
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新（`drawHandles`/`drawHover`のみ）
        *   `./js/shapes/Curve.js` : 更新（`drawHandles`/`drawHover`のみ）
        *   `./js/shapes/Rect.js` : 更新（`drawHandles`/`drawHover`のみ）
        *   `./js/shapes/Ellipse.js` : 更新（`drawHandles`/`drawHover`のみ）
    *   **作業内容** :
        *   4クラスの`drawHandles(ctx)`／`drawHover(ctx)`を`drawHandles(ctx, viewScale = 1)`／`drawHover(ctx, viewScale = 1)`に統一し、要件6の表のとおりスクリーン一定値を`÷ viewScale`で換算する（ハンドル一辺・`half`、枠線幅1.5、ホバー上乗せ幅6、`Curve`のヘルパー点線の線幅1と破線間隔`[2, 2]`）。
        *   JSDocに`@param {number} [viewScale=1] 現在の表示倍率。ハンドルの大きさ・枠線幅（drawHoverでは強調の上乗せ幅）を画面上で一定に保つために用いる。省略時は倍率1.0として現行と同じ見た目になる`を追加する。`drawHover`には「図形本体の`strokeWidth`部分は倍率に比例して表示される」旨を明記する。
        *   `draw`・当たり判定・頂点操作など他メソッドのロジックとJSDocは変更しない（他メソッドJSDocに残る「論理座標系」表記も本タスクでは修正しない）。
        *   `CanvasManager`はタスク2で既に倍率を渡しているが、`main.js`が`view`を渡していないため値は常に1であり、見た目は変わらないことを確認する。

*   [x] タスク4: `main.js`への`ViewTransform`の配線（生成・注入・再描画経路）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `import { ViewTransform } from './core/ViewTransform.js';`を追加する。
        *   `InputTracker`の生成より前に`const viewTransform = new ViewTransform();`を生成し（コメント番号付きのセクション見出しを既存の形式に合わせて付ける）、`new InputTracker(canvas, model, viewTransform)`で注入する（この時点の`InputTracker`は第3引数を無視するが、次タスクで使用する）。
        *   `renderCurrentState()`の`render()`第2引数に`view: viewTransform.getState()`を追加し、JSDocを「Model状態とビュー変換状態を…`model.onChange`・`viewTransform.onChange`・resizeハンドラの3経路から同一の引数構成で呼び出す」趣旨に更新する。
        *   `model.onChange(renderCurrentState);`の直後に`viewTransform.onChange(renderCurrentState);`を追加し、「ビュー変換（パン・ズーム・リセット）が変化したら同一経路で再描画する」旨のコメントを付ける。
        *   ファイル先頭の責務JSDoc（「各モジュールの初期化と連携(依存性の注入)を担う。」）が実態と一致していることを確認する（変更不要の想定）。
        *   完了後、起動して表示・操作がタスク3完了時点と変わらないことを確認する。

*   [x] タスク5: `InputTracker`のワールド/スクリーン座標の分離とホイールズーム
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   コンストラクタに第3引数`viewTransform`を追加し`this.viewTransform`に保持する（JSDoc：`@param {ViewTransform} viewTransform - スクリーン⇔ワールド変換とズーム・パンを担うビュー変換`。型参照のためのimportは行わずJSDocの型名のみとする）。
        *   `getLogicalCoordinate(event)`を`getScreenCoordinate(event)`にリネームする（本体のロジックは変更しない）。JSDocの「将来的にキャンバスのズーム・パン機能を追加する際は…」の注記を削除し、「キャンバス左上基準のスクリーン座標（CSSピクセル）を返す。CSSズームによるずれを吸収する。ワールド座標が必要な場合は`getWorldCoordinate`を用いる」旨に改める。
        *   `getWorldCoordinate(event)`を新設する（要件1 1-4。`this.viewTransform.screenToWorld`への委譲のみで、変換式を書かない）。
        *   `handleMouseMove`（DRAWING／DRAGGING_HANDLE／IDLEの3箇所）、`handleMouseDown`、`handleClick`の座標取得を`getWorldCoordinate(event)`に置き換える。
        *   privateメソッド`#getWorldHitTolerance()`を新設し（要件6）、`hitTest`/`hitTestHandle`の第3引数（`handleMouseMove`・`handleMouseDown`・`#resolveCursor`の3箇所）をこれに置き換える。`hitTolerance`のJSDocを「画面上（スクリーン座標）のピクセル単位。当たり判定時は`#getWorldHitTolerance()`でワールド換算して渡す」に改める。
        *   モジュール定数`WHEEL_ZOOM_STEP = 1.1`（JSDoc付き）を定義し、`handleWheel(event)`を新設して要件3の手順1〜4を実装する。コンストラクタでキャンバスへ`wheel`を`{ passive: false }`で購読する。JSDocに「操作モード・入力状態によらず常に有効」「`deltaY`の符号のみで方向を決める」「ズーム中心はスクリーン座標」を記載する。
        *   JSDocの座標系表記を統一する：`lastCursor`（ワールド座標）、`#resolveCursor`/`#updateCursor`の`point`（ワールド座標）、各ハンドラ説明内の「論理座標」→「ワールド座標」。
        *   ファイル先頭の責務JSDocを「ユーザー入力（パン・ズームを含む）の解釈とModel・ビュー変換への反映、および入力状態に応じたキャンバスのカーソル形状のフィードバックを担う。」の趣旨（3行以内）に更新する。
        *   スコープ外の既存ロジック（状態遷移、`Delete`処理等）は変更しない。図形種別の分岐を持ち込まない。
        *   完了後、テストプレイで以下を確認する：(a)ホイールでカーソル位置中心に拡大・縮小し、10%／1000%で止まる、(b)ページがスクロール・ブラウザズームしない、(c)倍率200%・50%で5種の図形を作成でき、クリック位置と図形がずれない、(d)ホバー・選択・ハンドルドラッグ・moveハンドル移動・削除がずれなく行える、(e)ハンドルの大きさ・ホバー強調の上乗せ幅・グリッド線幅が倍率によらず画面上一定、図形本体の線幅は倍率に比例する、(f)`DRAWING`中のズーム後も終点がカーソルに追従する。

*   [x] タスク6: `InputTracker`のパン（中ボタン・スペースキー・キャンバス移動モード）とカーソル形状
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `OperationMode`に`PAN: 'pan'`を追加し、JSDocに「PAN: キャンバス移動モード（左ドラッグでパン）」を追記する。`currentMode`の`@type`、`setMode`/`getMode`の型注釈を`'select'|'create'|'pan'`に更新する。
        *   モジュールスコープに`export function isTextInputElement(element)`を新設する（要件2 2-5。JSDocにPhase 02-04の`Delete`/`Backspace`誤爆対策で再利用する想定である旨を記載）。
        *   privateフィールド`#panDrag`／`#isSpacePressed`／`#suppressNextClick`を追加する（要件2 2-1。JSDocに意味・型・座標系（`lastScreen`はスクリーン座標）を記載）。
        *   privateメソッド`#beginPan(event)`／`#endPan()`／`#handleWindowMouseMove(event)`／`#handleWindowMouseUp(event)`／`#handleSpaceKeyDown(event)`／`#handleWindowBlur()`、公開メソッド`handleKeyUp(event)`を実装する（要件2 2-2〜2-4）。ファイル内で一塊に配置し、各JSDocに役割・呼び出し元・座標系を記載する。
        *   コンストラクタで`window`へ`mousemove`/`mouseup`をcapture（第3引数`true`）で、`document`へ`keyup`を、`window`へ`blur`を購読する。JSDocまたはコメントに「`WindowManager`が`.float-window`上の伝播を止めるため、`window`のcaptureで検知する」理由を記載する。
        *   `handleMouseDown`冒頭に要件2 2-2の手順1〜4を追加する。`handleMouseMove`冒頭に「パン中は何もしない」、`handleClick`冒頭に「`#suppressNextClick`なら解除してreturn」、`handleKeyDown`冒頭に`Space`の委譲（既存の選択モードガードより前）、`setMode`に「パン中なら`#endPan()`」を追加する。各ハンドラのJSDocに追加した挙動を追記する。
        *   `#resolveCursor`を要件2 2-7の判定順序に改め、JSDocの判定順序・`@returns`（`'grabbing'|'grab'|'crosshair'|'move'|'pointer'|'default'`）を更新する。`#updateCursor`の呼び出しを要件2 2-7の箇所に追加する。
        *   クラスJSDoc・ファイル先頭の責務JSDocが、パン状態（`InputState`と直交するフラグ）を含めた実態と一致していることを確認し、必要なら更新する（3行以内）。
        *   完了後、テストプレイで以下を確認する（キャンバス移動ボタンは未追加のため(c)はタスク8で確認）：(a)中ボタンドラッグで全モードでパンでき、オートスクロールが出ない、(b)スペース押下中は`grab`、左ドラッグで`grabbing`かつパン、離すと元のモードの挙動・カーソルに戻る、キーリピートで状態が壊れない、(c)スペースパン後に図形の作成開始・確定・選択・選択解除が起きない、(d)`DRAWING`中に中ボタン／スペースでパンしても作成途中図形が残り、パン後も終点がカーソルに追従し、次のクリックで確定できる、(e)ハンドルドラッグ中にスペースを押してもパンにならない、(f)パン中にカーソルをフロートウィンドウ上・ブラウザ外へ出してボタンを離してもパン状態が残らない、(g)スペースを押したままタブ切替して戻ってもスペース押下状態が残らない、(h)モードボタンをクリックした直後（ボタンにフォーカスがある状態）にスペースを押してもモード切替（ボタンの誤クリック）が起きない。

*   [x] タスク7: コントロールパネルへのキャンバス移動ボタン・倍率表示・リセットボタンの追加
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   `#window-control-panel`の`.window-body`内、`#mode-create`の直後に`<button type="button" id="mode-pan" class="tool-btn">✋ キャンバス移動</button>`を追加する。
        *   その下に要件4の`.view-zoom-row`（`#view-zoom-display`「100%」、`#view-reset`「リセット」）を追加し、`<style>`に`.view-zoom-row`の定義を追加する。
        *   既存のウィンドウ構造（`.float-window`／`.window-header`／`.window-close-btn`）、既存CSS定義（`.tool-btn`／`.disabled`等）、図形パレット部は変更しない（ヘッダードラッグの回帰防止）。コントロールパネルが縦に伸びるため、図形パレット（`top: 320px`）と重ならないかを目視確認し、重なる場合は`#window-shape-palette`の`top`のみ調整する（調整した場合は詳細作業内容に記載）。
        *   本タスクはDOM/CSSのみの変更であり、JSDoc対象の`.js`ファイルはない。この時点ではボタンは未配線（クリックしても何も起きない）。

*   [x] タスク8: `main.js`へのキャンバス移動モード・倍率表示・リセットの配線
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `modeButtons`に`[OperationMode.PAN]: document.getElementById('mode-pan')`を追加する（タスク7のDOM idと一致させること）。`applyMode`本体・クリックリスナー登録ループは書き換えない。`applyMode`のJSDocの`@param`型を`'select'|'create'|'pan'`に更新する。
        *   `#view-zoom-display`・`#view-reset`の要素を取得し、`syncZoomDisplay()`（JSDoc付き。倍率を整数%に四捨五入して表示、DOM更新の担当が`main.js`である旨）を新設する。`viewTransform.onChange(syncZoomDisplay)`を登録し、起動時に1回呼ぶ。
        *   リセットボタンのclickで`viewTransform.reset()`のみを呼ぶ（操作モード・選択状態に触れない旨のコメントを付ける）。
        *   ファイル先頭の責務JSDocが実態と一致していることを確認する。
        *   完了後、テストプレイで以下を確認する：(a)「✋ キャンバス移動」で`.active`が移り、パレットが非活性、カーソル`grab`、左ドラッグでパン（`grabbing`）、クリックしても図形の作成・選択が起きない、(b)モード切替時に選択・ホバーがクリアされる、(c)倍率表示がホイールズームに即時追従する（例：100%→110%→121%）、(d)リセットで100%・初期表示位置に戻り、操作モード・選択状態は変わらない、(e)ウィンドウリサイズ後もパン・ズーム状態が維持される、(f)両フロートウィンドウのヘッダードラッグが従来どおり機能する。

*   [x] タスク9: JSDoc・責務定義・座標系表記の最終確認
    *   **対象ファイル** :
        *   `./js/core/ViewTransform.js` : 確認（必要時のみ更新）
        *   `./js/core/InputTracker.js` : 確認（必要時のみ更新）
        *   `./js/core/CanvasManager.js` : 確認（必要時のみ更新）
        *   `./js/main.js` : 確認（必要時のみ更新）
        *   `./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js` : 確認（`drawHandles`/`drawHover`のJSDocのみ、必要時のみ更新）
    *   **作業内容** :
        *   対象ファイルを通読し、新設・改修したクラス・メソッド・フィールド・定数・関数のすべてにJSDocが付き、`@param`/`@type`/`@returns`の型注釈が実態と一致していることを確認する。記載漏れがあれば補う（ロジックの変更は行わない）。
        *   **座標を扱う引数・戻り値・プロパティに「ワールド座標」「スクリーン座標」の別が明記されていること**を確認する。`js/core/`・`js/main.js`で「論理座標」を検索し、残存がないことを確認する（`shapes/`の対象外メソッドに残る表記は懸念事項に記載済みのため対象外）。
        *   `getLogicalCoordinate`の残存（コード・コメント）がないこと、「将来…ズーム・パン…修正が必要」旨のコメントが残っていないことを検索で確認する。
        *   変換式（`* scale`／`/ scale`等によるスクリーン⇔ワールド変換）が`ViewTransform.js`以外に重複していないことを検索で確認する（`CanvasManager`の`setTransform`による描画変換の合成と、図形クラスの`÷ viewScale`による補助表示サイズの換算は除く）。
        *   `VectorModel.js`／`WindowManager.js`／`ShapeFactory.js`／`PaletteController.js`に差分がないことを`git diff --stat`で確認する。
        *   各ファイル先頭の責務JSDoc（3行以内）が実態と一致していることを確認する。

*   [x] タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映【固定タスク】
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   本RESの『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄（タスク1〜9で追記された内容を含む）を確認し、資料へ反映する。本作業では以下を更新必須とする。
            *   1章フォルダ構造への`ViewTransform.js`の追加。
            *   2章（データ構造）への「図形座標はワールド座標、ビュー変換は図形データに含まれない」旨の追記。
            *   3章（描画・操作フロー）への座標系（ワールド/スクリーン）と再描画3経路の説明の追記。
            *   4章：`ViewTransform.js`の新規項目、`main.js`（ビュー変換の配線・倍率表示・リセット）、`CanvasManager.js`（`render()`の引数・描画変換・グリッド描画・`resize()`の記述）、`InputTracker.js`（ワールド/スクリーン座標の分離・パン状態・`OperationMode`への`'pan'`追加・ホイール/スペースキー処理・カーソル形状・`isTextInputElement`）、`shapes/`（9メソッド契約の`drawHandles`/`drawHover`シグネチャ変更）。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、**本タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。タスク1〜9の中で資料を書き換えてはならない。
        *   反映後、更新予定欄の各項目が資料へ反映済みであることを詳細作業内容に記載する。`PROJECT_ARCHITECTURE.md`内で`getLogicalCoordinate`・`drawHandles(ctx)`・`drawHover(ctx)`（引数1つの旧記述）を検索し、残存がないことを確認する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: ビュー変換クラス`ViewTransform`の新設
*   **作業内容** :
    *   `./js/core/ViewTransform.js`を新規作成した。ファイル先頭に要件1 1-1の文面どおりの責務JSDoc（本文2行）を記述。
    *   `export class ViewTransform`を作成し、static定数`MIN_SCALE = 0.1`／`MAX_SCALE = 10.0`、privateフィールド`#scale = 1`／`#offsetX = 0`／`#offsetY = 0`／`#listeners = []`を定義。各JSDocに`@type`と単位（倍率は無次元、オフセットはスクリーン座標のCSSピクセル＝ワールド原点の画面上の位置）を記載した。
    *   公開メソッド`getScale`／`getState`／`screenToWorld`／`worldToScreen`／`screenLengthToWorld`／`zoomAt`／`panBy`／`reset`／`onChange`、privateメソッド`#notifyChange`を実装した。
        *   `getState()`は呼び出しごとに新しいプレーンオブジェクト`{scale, offsetX, offsetY}`を返す（JSDocに「描画用スナップショット」と明記）。
        *   `zoomAt(sx, sy, factor)`は要件1 1-2の手順1〜6のとおり：`factor`が正の有限数でなければ`console.warn`してreturn → ズーム前にカーソル下のワールド座標を`screenToWorld`で取得 → `MIN_SCALE`〜`MAX_SCALE`へクランプ → 倍率不変なら何もせず通知もしない → クランプ後の倍率でオフセットを再計算 → 通知。JSDocに「クランプ時もカーソル下のワールド点は不変」「倍率が変化しない場合は通知しない」旨を記載。
        *   `panBy(dx, dy)`は`dx === 0 && dy === 0`なら通知せずreturn。`reset()`は既に初期状態（倍率1・オフセット(0,0)）なら通知せずreturn。
        *   `onChange(callback)`／`#notifyChange()`は`VectorModel`と同形式（関数のみ受理して配列へpush／全リスナーを順に呼ぶ）。
    *   各メソッドのJSDocで、引数・戻り値がスクリーン座標（CSSピクセル）かワールド座標かを明記した。クラスJSDocに変換式（`スクリーン = ワールド × 倍率 ＋ オフセット`／逆変換）、ワールド座標・スクリーン座標の定義、「変換式は本クラスにのみ実装する」「VectorModel・CanvasManager・図形クラス・DOMには依存しない」旨を記載した。
    *   import文は一切なし（他モジュール・DOMへの依存なし）。本タスク時点では利用者がいないため、アプリの挙動は変わらない。
    *   `node --check js/core/ViewTransform.js`で構文エラーなしを確認。加えて、スクラッチ領域の一時スクリプト（プロジェクト外）からNodeでimportし、以下を確認した：(a)`zoomAt(200,100,2)`の前後でカーソル下のワールド座標が不変、(b)連続拡大で`MAX_SCALE`=10に張り付き、張り付き後の`zoomAt`は通知されずカーソル下ワールド点も不変、(c)連続縮小で`MIN_SCALE`=0.1に張り付く、(d)`factor`が負・`NaN`のとき警告のみで状態不変、(e)`panBy(0,0)`・初期状態での`reset()`は通知なし、(f)`worldToScreen(screenToWorld(p))`が`p`に戻る、(g)`getState()`が毎回別オブジェクトを返す。

### タスク2: `CanvasManager`の描画変換合成と背景グリッド
*   **作業内容** :
    *   ファイル先頭の責務JSDocを「Canvas要素への純粋な描画処理（背景グリッドを含む）のみを担う。描画変換は引数で受け取ったビュー変換値から毎フレーム設定し、状態は保持しない。」（本文2行）に更新した。
    *   モジュール定数`DEFAULT_VIEW`（`Object.freeze({ scale: 1, offsetX: 0, offsetY: 0 })`）、`GRID_BASE_SPACING = 10`、`GRID_MIN_SCREEN_SPACING = 8`、`GRID_MINOR_COLOR = 'rgba(0, 0, 0, 0.06)'`、`GRID_MAJOR_COLOR = 'rgba(0, 0, 0, 0.14)'`、および間隔繰り上げループの上限ガード`GRID_MAX_SPACING_STEPS = 10`を定義し、それぞれJSDoc（単位：ワールド長／スクリーンpx）を付けた。
    *   privateフィールド`#pixelRatio`（初期値1）を追加。`resize()`で`window.devicePixelRatio || 1`を代入し、末尾の`this.ctx.scale(dpr, dpr)`と「将来的にキャンバスのズーム機能を追加する際は…」コメントを削除した。冒頭の`setTransform(1, 0, 0, 1, 0, 0)`は残し、コメントを「変換を恒等へ戻す（設定はrender()が毎フレーム行う）」に改めた。`resize()`のJSDocを「dprの算出とバッファサイズの同期のみ。描画変換（dpr × ビュー変換）の適用は`render()`が毎フレーム行う」に更新。あわせて`resize()`内のローカル変数`logicalWidth`/`logicalHeight`を`cssWidth`/`cssHeight`へ改名し、コメントの「論理サイズ」を「スクリーン座標のCSSピクセル」に改めた（RES 1章の用語統一。ロジック不変）。
    *   `render()`の第2引数に`view = DEFAULT_VIEW`を追加し、要件7の手順1〜5に書き換えた：(1)恒等変換で`canvas.width`/`canvas.height`全体を`clearRect` → (2)`setTransform(dpr × s, 0, 0, dpr × s, dpr × offsetX, dpr × offsetY)` → (3)`#drawGrid(view)` → (4)図形ループ（`drawHover(this.ctx, view.scale)`／`drawHandles(this.ctx, view.scale)`） → (5)`draftLine.draw(this.ctx)`（変更なし）。旧実装の`style.width`パースによるクリア範囲算出は不要となったため削除した。
    *   `render()`のJSDocに`@param {{scale, offsetX, offsetY}} [state.view]`（変換式、オフセットはスクリーン座標、省略時は倍率1.0・オフセット(0,0)）を追記し、`shapes`等の説明を`drawHover(ctx, viewScale)`/`drawHandles(ctx, viewScale)`に改めた。
    *   privateメソッド`#drawGrid(view)`を新設：倍率が正の有限数でなければ描かない（防御）→細線間隔を`GRID_BASE_SPACING`から`minor × scale < 8`の間10倍に繰り上げ（上限ガード付き）、太線は`minor × 10`→`this.ctx.getTransform().inverse().transformPoint()`でバッファ四隅`(0,0)`/`(canvas.width, canvas.height)`をワールド座標へ写して可視範囲を算出→`save()`→`lineWidth = 1 / scale`→細線・太線の順に描画→`restore()`。
    *   計画にない補助privateメソッド`#strokeGridLines(spacing, bounds, color)`を追加した（細線・太線で同一の「縦横線を1本のパスにまとめて`stroke()`1回」処理を共通化するため）。線位置は`Math.floor(min / spacing)`からの整数インデックス×間隔で求め、加算による浮動小数誤差の累積を避けた。
    *   `ViewTransform`・`VectorModel`のimportなし、図形種別の分岐なし。変更禁止ファイルには触れていない。
    *   `node --check js/core/CanvasManager.js`で構文エラーなしを確認。
    *   ローカルHTTPサーバ（一時的に`python -m http.server`で起動、確認後停止・設定ファイル削除済み）＋アプリ内ブラウザ（dpr=2環境）で確認した：(a)背景グリッド（10px細線・100px太線）が表示され、図形の背面に描かれる、(b)図形作成モードで直線を作成でき、選択モードでホバー強調・ハンドル表示・端点ハンドルのドラッグが従来どおり動作、(c)コンソールエラーなし。加えて、ページ内で`CanvasManager`を別キャンバスに生成し`view`を直接渡して描画したところ、1行あたりのグリッド被覆画素数から、倍率100%→細線10、50%→細線100、10%→細線100、1000%→細線10（いずれも画面上1px幅＝dpr2で2物理px）となることを確認した（`main.js`はまだ`view`を渡さないため、アプリ上は倍率1.0のみ）。

### タスク3: 図形クラスの`drawHandles`/`drawHover`の倍率対応
*   **作業内容** :
    *   `Line`/`Curve`/`Rect`/`Ellipse`の4クラスで、`drawHandles(ctx)`／`drawHover(ctx)`を`drawHandles(ctx, viewScale = 1)`／`drawHover(ctx, viewScale = 1)`に統一した。
    *   要件6の表のとおりスクリーン一定値を`÷ viewScale`でワールド長へ換算した：
        *   ハンドル一辺：`Line`/`Curve`/`Rect`は`const handleSize = 8 / viewScale`（`half`は従来どおり`handleSize / 2`から算出）、`Ellipse`は`const half = 4 / viewScale`。換算箇所に「画面上8px（4px）一定（ワールド長へ換算）」の行末コメントを付けた。
        *   ハンドル枠線幅：4クラスとも`ctx.lineWidth = 1.5 / viewScale`。
        *   ホバー強調：4クラスとも`ctx.lineWidth = this.strokeWidth + 6 / viewScale`（`strokeWidth`部分は換算しない）。
        *   `Curve`の制御点ヘルパー点線：`ctx.lineWidth = 1 / viewScale`、`ctx.setLineDash([2 / viewScale, 2 / viewScale])`（後続の`setLineDash([])`によるクリアは変更なし）。
    *   JSDocに`@param {number} [viewScale=1]`を追加した（`drawHandles`：ハンドルの大きさ・枠線幅を画面上一定に保つ／省略時は倍率1.0として現行と同じ見た目、`drawHover`：強調の上乗せ幅を画面上一定に保つ／図形本体の`strokeWidth`部分は倍率に比例して表示される／省略時は現行と同じ見た目）。既存`@param`の記法（`- 説明`）に合わせた。
    *   `Rect.drawHandles`のJSDoc本文「同一サイズ（一辺8pxの正方形）」を「同一サイズ（画面上で一辺8pxの正方形）」に改めた（倍率対応後の実態に合わせるための最小修正）。
    *   `draw`・当たり判定・頂点操作など他メソッドのロジック・JSDoc（「論理座標系」表記を含む）、ファイル先頭の責務JSDocは変更していない（責務「データ保持・描画・当たり判定」の範囲内のため更新不要と判断）。変更禁止ファイルには触れていない。
    *   `node --check`で4ファイルとも構文エラーなしを確認。
    *   スクラッチ領域の一時スクリプト（プロジェクト外）から4クラスをNodeでimportし、呼び出しを記録するモックコンテキストで描画値を確認した：(a)`viewScale`省略時はハンドル一辺8（`Ellipse`の`half`4）・枠線幅1.5・ホバー線幅`strokeWidth + 6`（既定`strokeWidth`=2で8）・`Curve`点線は線幅1／破線`[2, 2]`で、改修前と完全に同値、(b)`viewScale = 2`ではそれぞれ4（2）・0.75・5・0.5／`[1, 1]`となり、ハンドル中心座標は不変。
    *   `CanvasManager`はタスク2で既に`view.scale`を渡しているが、`main.js`が`view`を渡していないため値は常に1であり、アプリ上の見た目は変わらない（上記(a)により担保。ブラウザでの目視確認はタスク5以降のズーム実装後に行う）。

### タスク4: `main.js`への`ViewTransform`の配線（生成・注入・再描画経路）
*   **作業内容** :
    *   `import { ViewTransform } from './core/ViewTransform.js';`を追加した（既存import群の末尾、`WindowManager`の直後）。
    *   `CanvasManager`生成の直後・`InputTracker`生成の前に、セクション見出し`// 3. ViewTransform (ビュー変換：表示倍率・オフセットの保持とスクリーン⇔ワールド座標変換)`を付けて`const viewTransform = new ViewTransform();`を生成し、`new InputTracker(canvas, model, viewTransform)`で注入した（この時点の`InputTracker`は第3引数を無視する）。
        *   見出し番号を連番に保つため、以降の既存見出しを繰り下げた：`3. Controller`→`4.`、`4. フロートウィンドウ統治`→`5.`、`5. フロートパネル（コントロールパネル）配線`→`6.`、`6. 図形選択パレット配線`→`7.`（番号のみの変更。見出し文言・処理は不変）。
    *   `renderCurrentState()`の`render()`第2引数に`view: viewTransform.getState()`を追加し、JSDocを「Model状態とビュー変換の現在の状態（`getState()`による倍率・オフセットのスナップショット）をCanvasManagerへ渡す。`model.onChange`・`viewTransform.onChange`・resizeハンドラの3経路から同一の引数構成で呼び出し、再描画トリガーの重複定義を避ける」趣旨に更新した。
    *   `model.onChange(renderCurrentState);`の直後に`viewTransform.onChange(renderCurrentState);`を追加し、「ビュー変換（パン・ズーム・リセット）が変化したら、同一経路で再描画する」旨のコメントを付けた。
    *   **【追加指示による変更】起動時の初回描画の明示化**：起動時初期化の末尾（`applyMode(OperationMode.SELECT);`の後）に`renderCurrentState();`を1行追加した。従来、起動直後の初回描画は`applyMode` → `InputTracker.setMode` → `VectorModel.clearSelection()`の無条件の`notifyChange()`という副作用に偶然依存しており、将来この通知を値変化時のみに最適化すると起動直後に何も描画されなくなる（背景グリッドも出ない）。その理由をコード内コメントに記載した。現状は`applyMode`経由の描画と合わせて起動時に2回描画されるが、同一状態の再描画であり見た目・挙動に影響はない。
    *   ファイル先頭の責務JSDoc（「各モジュールの初期化と連携(依存性の注入)を担う。」）は、`ViewTransform`の生成・注入・再描画配線も「初期化と連携(依存性の注入)」の範囲内であるため、変更不要と判断した。`applyMode`/`applyShapeType`/`modeButtons`は変更していない。変更禁止ファイルには触れていない。
    *   `node --check js/main.js`で構文エラーなしを確認。
    *   ローカルHTTPサーバ（一時的に`python -m http.server`で起動、確認後停止）＋アプリ内ブラウザ（dpr=2）で確認した：(a)起動直後に背景グリッドが描画され、コンソールエラーなし、(b)描画コンテキストの変換が`matrix(2, 0, 0, 2, 0, 0)`（dpr × 倍率1.0・オフセット(0,0)）であり、`view`を渡すようになってもタスク3完了時点と同じ描画変換であること、(c)図形作成モードで直線を作成（作成途中の終点がカーソルに追従し、クリックで確定）、選択モードでホバー強調・選択時の端点ハンドル表示が従来どおり動作すること。なお、ペイン非表示のまま初回読み込みした際にキャンバスが0×0になる既知の現象（タスク2の懸念事項に記載済み）が再現したが、再読み込みで解消しており本タスクの変更とは無関係。

### タスク5: `InputTracker`のワールド/スクリーン座標の分離とホイールズーム
*   **作業内容** :
    *   ファイル先頭の責務JSDocを「ユーザー入力（パン・ズームを含む）の解釈とModel・ビュー変換への反映、および入力状態に応じたキャンバスのカーソル形状のフィードバックを担う。」（本文2行）に更新した。
    *   コンストラクタに第3引数`viewTransform`を追加し、`this.viewTransform`に保持した（`@param {ViewTransform} viewTransform`、フィールドにも`@type {ViewTransform}`のJSDocを付与。importは行わずJSDocの型名のみ）。
    *   `getLogicalCoordinate(event)`を`getScreenCoordinate(event)`にリネームした（CSSズーム吸収ロジックは不変）。「将来…ズーム・パン…修正が必要」の注記を削除し、JSDocを「キャンバス左上基準のスクリーン座標（CSSピクセル）を返す。CSSズームによるずれを吸収する。ワールド座標が必要な場合は`getWorldCoordinate`を用いる。キャンバス外のイベントでもキャンバス左上基準の座標を返す」に改めた。内部コメントの「論理サイズ／論理座標」も「スクリーン座標」に改めた。
    *   `getWorldCoordinate(event)`を新設した（`getScreenCoordinate`の結果を`this.viewTransform.screenToWorld`へ委譲するのみ。変換式は持たない）。
    *   `handleMouseMove`（DRAWING／DRAGGING_HANDLE／IDLEの3箇所）、`handleMouseDown`、`handleClick`の座標取得（計5箇所）を`getWorldCoordinate(event)`に置き換えた。
    *   privateメソッド`#getWorldHitTolerance()`（`this.viewTransform.screenLengthToWorld(this.hitTolerance)`）を新設し、`hitTest`/`hitTestHandle`の第3引数3箇所（`handleMouseMove`のホバー判定・`handleMouseDown`のハンドル判定・`#resolveCursor`のハンドル判定）を置き換えた。`hitTolerance`のJSDocを「画面上（スクリーン座標）のピクセル単位。当たり判定時は`#getWorldHitTolerance()`でワールド換算して渡す」に改めた。
    *   モジュール定数`WHEEL_ZOOM_STEP = 1.1`（JSDoc付き、非export）を`SHAPE_TYPES`の直後に定義し、公開メソッド`handleWheel(event)`を新設した（要件3の手順1〜4：`preventDefault` → `deltaY === 0`なら何もしない → 符号のみで`factor`決定 → `getScreenCoordinate`のスクリーン座標を中心に`viewTransform.zoomAt`）。コンストラクタでキャンバスへ`wheel`を`{ passive: false }`で購読した（理由のコメント付き）。JSDocに「操作モード・入力状態によらず常に有効」「`deltaY`の符号のみで方向を決める」「ズーム中心はスクリーン座標」「ズーム後のホバー・カーソルは次の`mousemove`で再評価」を記載した。`handleWheel`は`handleKeyDown`の直後（座標取得メソッド群の前）に配置した。
    *   JSDocの座標系表記を統一した：`lastCursor`（ワールド座標）、`#resolveCursor`/`#updateCursor`の`point`（ワールド座標）、`handleMouseMove`の「現在の論理座標」→「現在のワールド座標」、`handleMouseMove`/`handleMouseDown`/`handleClick`の説明にワールド座標・許容誤差のワールド換算を追記。`InputTracker.js`内で「論理」「getLogicalCoordinate」の残存がないことを検索で確認した。
    *   状態遷移・`Delete`処理・`setMode`/`setShapeType`等のスコープ外ロジックは変更していない。図形種別の分岐は持ち込んでいない。変更禁止ファイルには触れていない。`getLogicalCoordinate`の呼び出し元が`js/`配下に残っていないことを検索で確認した。
    *   `node --check js/core/InputTracker.js`で構文エラーなしを確認。
    *   ローカルHTTPサーバ（一時的に`.claude/launch.json`を作成して`python -m http.server`で起動、確認後に停止・設定ファイル削除済み）＋アプリ内ブラウザ（dpr=2、キャンバス1024×768）で、合成イベント（`WheelEvent`/`MouseEvent`/`KeyboardEvent`のdispatch）と描画結果（`ctx.getTransform()`・`getImageData`による画素確認）・スクリーンショットにより確認した：
        *   (a) ホイール拡大で描画変換が`matrix(2.2, …, -40, -40)`（倍率1.1・カーソル(200,200)中心）となり、連続拡大で倍率10（dpr込み20）、連続縮小で倍率0.1（同0.2）に張り付いて止まる。いずれもカーソル(200,200)下のワールド点は不変（オフセット値から逆算して確認）。`deltaY = 0`（横スクロールのみ）では変化なし。
        *   (b) `wheel`イベントの`defaultPrevented`が`true`（ページスクロール・ブラウザズームの既定動作を抑止）。
        *   (c) 倍率約211%で直線を作成し、作成途中に別位置を中心に縮小（約175%）しても作成途中図形の終点がカーソル位置に留まり（(f)）、クリックで確定した図形の終点がクリック位置に描画された。倍率約50%で直線・曲線・弧・矩形・円の5種を作成し、直線終点・矩形の2隅がクリック位置に描画されることを画素で確認した。
        *   (d) 倍率約175%で、線から画面上4px離れた位置ではホバー（`pointer`）、12px離れた位置では非ホバー（`default`）。クリックで選択、端点ハンドル上で`move`、端点ハンドルのドラッグで端点がカーソル位置へ移動、moveハンドルのドラッグ（画面上(+80,+40)）で始点・終点とも画面上同量移動、`Delete`で削除されることを確認した。
        *   (e) 倍率約50%と約500%のスクリーンショットで、選択中矩形のハンドルの大きさ・グリッド線幅が画面上一定、図形本体の線幅は倍率に比例して太くなることを目視確認した。
        *   コンソールエラーなし。
    *   なお、初回確認時はブラウザのHTTPキャッシュにより旧`InputTracker.js`が読み込まれ、ズームが効かないように見えた（`fetch(..., {cache: 'reload'})`で各モジュールを再取得後に再読み込みして解消）。コードの問題ではない。

### タスク6: `InputTracker`のパン（中ボタン・スペースキー・キャンバス移動モード）とカーソル形状
*   **作業内容** :
    *   `OperationMode`に`PAN: 'pan'`を追加し、JSDocに「PAN: キャンバス移動モード（左ドラッグでパン）」を追記した（「パンモード等のモードを追加する際は」の記述は「モードを追加する際は」に改めた）。`currentMode`の`@type`、`setMode`の`@param`、`getMode`の`@returns`を`'select'|'create'|'pan'`に更新した。
    *   モジュールスコープに`export function isTextInputElement(element)`を新設した（`WHEEL_ZOOM_STEP`の直後・クラス定義の前。`HTMLElement`であり`tagName`が`INPUT`/`TEXTAREA`、または`isContentEditable`が真なら`true`）。JSDocにPhase 02-04の`Delete`/`Backspace`誤爆対策で再利用する想定、`input`は`type`を問わない保守的判定、`select`は含めない旨を記載した。
    *   privateフィールド`#panDrag`（`{button, lastScreen} | null`、`lastScreen`はスクリーン座標）／`#isSpacePressed`／`#suppressNextClick`をクラス先頭に追加し、それぞれ意味・型・解除タイミングをJSDocに記載した。
    *   パン関連のメソッドを`handleWheel`の直後に「`// ---- パン（…） ----`」の区切りコメントを付けて一塊に配置した（公開`handleKeyUp`、private`#beginPan`/`#endPan`/`#handleWindowMouseMove`/`#handleWindowMouseUp`/`#handleSpaceKeyDown`/`#handleWindowBlur`）。続く座標取得メソッド群の前に「`// ---- 座標取得 ----`」の区切りを付けた。各JSDocに役割・呼び出し元・座標系を記載した。
        *   `#beginPan`：`#panDrag`へ開始ボタンと`getScreenCoordinate`のスクリーン座標を記憶 → `model.clearHovered()` → `#updateCursor()`。`InputState`・作成途中図形には触れない。
        *   `#endPan`：パン中でなければ何もしない（防御）。開始ボタンが左なら`#suppressNextClick = true` → `#panDrag = null` → `#updateCursor()`。
        *   `#handleWindowMouseMove`：パン中のみ、スクリーン座標の差分を`viewTransform.panBy`へ渡し`lastScreen`を更新。
        *   `#handleWindowMouseUp`：パン中かつ開始ボタンと同じボタンの場合のみ`#endPan()`。
        *   `#handleSpaceKeyDown`：テキスト入力中は何もしない → `preventDefault()` → 押下済み（キーリピート）なら終了 → `#isSpacePressed = true`・`#updateCursor()`。
        *   `handleKeyUp`：`Space`以外は無視。テキスト入力中でなければ`preventDefault()`。`#isSpacePressed = false`・`#updateCursor()`（テキスト入力中の扱いは懸念事項参照）。
        *   `#handleWindowBlur`：`#isSpacePressed = false` → パン中なら`#endPan()`後に`#suppressNextClick = false` → `#updateCursor()`。
    *   コンストラクタで`document`へ`keyup`、`window`へ`mousemove`/`mouseup`をcapture（第3引数`true`）、`window`へ`blur`を購読した。`WindowManager`が`.float-window`上の伝播を止めるため`window`のcaptureで検知する理由、`blur`購読の理由をコメントに記載した。
    *   `handleMouseDown`冒頭に要件2 2-2の手順1〜4（click抑止フラグの解除 → パン中なら何もしない → 中ボタンは`preventDefault()`のうえ`DRAGGING_HANDLE`以外ならパン開始・いずれもreturn → 左ボタンかつ（スペース押下中またはキャンバス移動モード）かつ`DRAGGING_HANDLE`以外ならパン開始）を追加した。`handleMouseMove`冒頭に「パン中は何もしない」、`handleClick`冒頭に「`#suppressNextClick`なら解除してreturn」、`handleKeyDown`冒頭に`Space`の`#handleSpaceKeyDown`への委譲（既存の選択モードガードより前）、`setMode`のバリデーション直後に「パン中なら`#endPan()`」を追加し、各JSDocに追加挙動を追記した。
    *   `#resolveCursor`を要件2 2-7の判定順序（0a `grabbing` → 0b スペース押下中かつ非`DRAGGING_HANDLE`で`grab` → 作成モード`crosshair` → キャンバス移動モード`grab` → 選択モード以外`default` → 既存の判定）に改め、JSDocの判定順序（(0a)〜(8)に振り直し）と`@returns`（`'grabbing'|'grab'|'crosshair'|'move'|'pointer'|'default'`）を更新した。`#updateCursor()`は`#beginPan`・`#endPan`・スペース初回押下・解放・`blur`で呼ぶ（いずれも座標不明`null`で評価）。
    *   クラスJSDocに「パンは`DRAWING`を保持したまま行えるよう`InputState`と直交するprivateフラグで表現する」「ズーム・パンによる表示の変更は`ViewTransform`へ委譲する」旨を追記した。ファイル先頭の責務JSDoc（タスク5で「パン・ズームを含む」に更新済み）は実態と一致しているため変更していない。
    *   状態遷移・`Delete`処理等の既存ロジックは変更していない。図形種別の分岐は持ち込んでいない。変更禁止ファイルには触れていない。
    *   `node --check js/core/InputTracker.js`で構文エラーなしを確認。
    *   ローカルHTTPサーバ（一時的に`.claude/launch.json`を作成して`python -m http.server`で起動、確認後に停止・設定ファイル削除済み）＋アプリ内ブラウザ（dpr=2、キャンバス1024×768）で、合成イベントのdispatchと描画変換（`ctx.getTransform()`）・画素・`style.cursor`・スクリーンショットにより確認した（キャンバス移動ボタンは未追加のため計画の(c)はタスク8で確認）：
        *   (a) 選択モードで中ボタンドラッグ（+50,+30）するとオフセットが(50,30)になり、押下中のカーソルは`grabbing`、離すと`default`へ戻る。中ボタン`mousedown`の`defaultPrevented`が`true`（オートスクロール抑止）。図形作成モード中・`DRAWING`中の中ボタンパンも動作。
        *   (b) スペース押下で`grab`、左ドラッグ中`grabbing`でパン、ボタンを離すと`grab`、スペース解放で`default`に戻る。キーリピート（`keydown`連続）でも状態は壊れない。`keydown`/`keyup`とも`defaultPrevented`が`true`。
        *   (c) 図形作成モードでスペース＋左ドラッグ（＋直後の`click`）を行ってもパンのみで図形の作成は開始されない（スクリーンショットで余分な図形がないことを確認）。カーソルはスペース解放後`crosshair`に戻る。
        *   (d) `DRAWING`中に中ボタンでパン（0,−50）しても作成途中図形が残り、始点が画面上でパン量だけ移動、その後のクリックで終点がクリック位置に確定した（画素で確認）。`DRAWING`中のスペース＋左ドラッグでも同様で、パン直後の`click`では確定されず、次のクリックで確定した。
        *   (e) 選択モードで端点ハンドルをドラッグ中（カーソル`move`）にスペースを押してもカーソルは`move`のまま、中ボタン押下でもパンは開始されず（オフセット不変）、ハンドルドラッグは継続して頂点が移動した。
        *   (f) 中ボタンパン中にフロートウィンドウ上で`mouseup`（`WindowManager`が伝播を止める要素）、および`window`（ブラウザ外相当）で`mouseup`した場合とも、パンが終了し、その後キャンバス上で`mousemove`してもオフセットが変化しない。フロートウィンドウ上での`mousemove`でもパンが追従した。
        *   (g) スペース＋左ドラッグでパン中に`window`へ`blur`を送ると、カーソル`default`・パン終了・スペース押下状態解除となり、その後の`mousemove`・左ドラッグでパンしない。
        *   (h) 「図形作成」ボタンにフォーカスした状態でボタン上へスペースの`keydown`/`keyup`を送ると、両方とも`defaultPrevented`が`true`となり、`.active`は「選択」のまま（合成イベントのため、実キー操作でのボタン活性化抑止は懸念事項参照）。
        *   テキスト入力欄（確認用に一時的にDOMへ追加し、確認後削除）にフォーカスした状態のスペースは`preventDefault`されず、カーソルも`grab`にならない。
        *   コンソールエラーなし。
    *   確認中、ペイン非表示状態で初回読み込みした際にキャンバスが0×0になる既知の現象（タスク2の懸念事項）が再現したが、ペイン表示後の再読み込みで解消しており本タスクの変更とは無関係。

### タスク7: コントロールパネルへのキャンバス移動ボタン・倍率表示・リセットボタンの追加
*   **作業内容** :
    *   `index.html`の`#window-control-panel`の`.window-body`内、`#mode-create`の直後に`<button type="button" id="mode-pan" class="tool-btn">✋ キャンバス移動</button>`を追加した。
    *   その直下に要件4の`.view-zoom-row`（`<span id="view-zoom-display">100%</span>`、`<button type="button" id="view-reset" class="tool-btn">リセット</button>`）を追加した。
    *   `<style>`の末尾（`.tool-btn.active`の後）に`.view-zoom-row { display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 13px; color: #333; }`を、既存CSSのコメント形式に合わせた説明コメント付きで追加した。
    *   既存のウィンドウ構造（`.float-window`／`.window-header`／`.window-close-btn`）、既存CSS定義（`.tool-btn`／`.disabled`／`#window-control-panel`等）、図形パレット部は変更していない。`#window-shape-palette`の`top`も調整不要と判断し変更していない（下記確認結果による）。
    *   JSDoc対象の`.js`ファイルの変更はない（`node --check`対象なし）。この時点ではボタンは未配線（クリックしても何も起きない。`main.js`の`modeButtons`に`PAN`がないため`.active`も移らない）。変更禁止ファイルには触れていない。
    *   ローカルHTTPサーバ（一時的に`.claude/launch.json`を作成して`python -m http.server`で起動、確認後に停止・設定ファイル削除済み）＋アプリ内ブラウザで確認した：(a)コントロールパネルに「🖱 選択」「✏ 図形作成」「✋ キャンバス移動」の3ボタンと、その下に「100%」とリセットボタンが左右に並ぶ行が表示される、(b)コントロールパネルの下端は`254px`、図形パレットの上端は`320px`で重ならない（倍率行の高さ37px）、(c)コントロールパネルのヘッダーを合成イベントでドラッグすると移動量どおりにウィンドウが移動する（ヘッダードラッグの回帰なし）、(d)コンソールエラーなし。

### タスク8: `main.js`へのキャンバス移動モード・倍率表示・リセットの配線
*   **作業内容** :
    *   `modeButtons`に`[OperationMode.PAN]: document.getElementById('mode-pan')`を追加した（タスク7のDOM id`mode-pan`と一致）。`applyMode`本体・クリックリスナー登録ループは書き換えていない。`applyMode`のJSDocの`@param`型を`'select'|'create'|'pan'`に更新した。
    *   セクション「6. フロートパネル（コントロールパネル）配線」内、`modeButtons`の直後に以下を追加した。
        *   `#view-zoom-display`／`#view-reset`の要素取得（`zoomDisplayEl`／`viewResetBtn`。`modeButtons`に含めず`.active`の対象外である旨のコメント付き）。
        *   `syncZoomDisplay()`を新設（`Math.round(viewTransform.getScale() * 100)`を`"…%"`で表示）。JSDocに、整数%への四捨五入、`viewTransform.onChange`登録・起動時の明示呼び出し、DOM更新の担当が`main.js`であり`ViewTransform`/`CanvasManager`/`VectorModel`はDOMに触れない旨を記載した。
        *   `viewTransform.onChange(syncZoomDisplay)`を登録した（再描画は`renderCurrentState`の登録で別途行われる旨のコメント付き）。
        *   リセットボタンのclickで`viewTransform.reset()`のみを呼ぶリスナーを登録した（操作モード・選択状態に触れない、再描画・表示更新は`onChange`経由である旨のコメント付き）。
    *   起動時初期化の最後（`renderCurrentState()`の明示呼び出しの後）に`syncZoomDisplay()`を明示的に1回呼ぶ処理を追加した（タスク4の懸念事項の方針どおり、`index.html`の初期文字列や`onChange`通知に依存させない旨のコメント付き）。
    *   ファイル先頭の責務JSDoc（「各モジュールの初期化と連携(依存性の注入)を担う。」）は、倍率表示・リセットの配線も「初期化と連携」の範囲内であるため変更不要と判断した。セクション見出し番号は変更していない。変更禁止ファイルには触れていない。
    *   `node --check js/main.js`で構文エラーなしを確認。
    *   ローカルHTTPサーバ（一時的に`.claude/launch.json`を作成して`python -m http.server`で起動、確認後に停止・設定ファイル削除済み）＋アプリ内ブラウザ（dpr=2、キャンバス1024×768）で、合成イベントのdispatchと描画変換（`ctx.getTransform()`）・画素・`style.cursor`・スクリーンショットにより確認した：
        *   (a)(b) 直線を作成・選択（ハンドル表示）した状態で「✋ キャンバス移動」をクリックすると、`.active`が`mode-pan`へ移り、パレットが`.disabled`、ハンドル位置の画素が消えて選択・ホバーがクリアされた。カーソルは図形上でも`grab`、左`mousedown`で`grabbing`、ドラッグ(+50,+30)でオフセットが(50,30)となり、離すと`grab`に戻る。パン直後の`click`、空白・図形上でのクリック・ドラッグを行っても図形の作成・選択は起きない（スクリーンショットで図形1本のみ・ハンドルなしを確認）。
        *   (c) 倍率表示がホイールズームに即時追従：100%→110%→121%→（縮小）110%。連続拡大で1000%、連続縮小で10%に張り付く。
        *   (d) リセットで倍率表示100%・描画変換が倍率1・オフセット(0,0)に戻る。リセット前後で`.active`（操作モード）は不変、選択中の直線のハンドル画素も保持された（選択状態不変）。初期状態での再度のリセットも表示・変換とも不変。
        *   (e) 倍率約26%・オフセット≠0の状態で`resize`イベントを発火しても、倍率表示・描画変換が維持された。
        *   (f) コントロールパネル・図形パレット（図形作成モードで活性化した状態）のヘッダーを合成イベントでドラッグし、移動量どおりに移動することを確認した。
        *   起動直後の倍率表示「100%」、コンソールエラーなし。
    *   確認中、ペイン非表示状態で初回読み込みした際にキャンバスが0×0になる既知の現象（タスク2の懸念事項）が再現したが、ペイン表示後の再読み込みで解消しており本タスクの変更とは無関係。

### タスク9: JSDoc・責務定義・座標系表記の最終確認
*   **作業内容** :
    *   対象ファイル（`ViewTransform.js`／`InputTracker.js`／`CanvasManager.js`／`main.js`、`shapes/`4クラスの`drawHandles`/`drawHover`）を通読し、新設・改修したクラス・メソッド・フィールド・定数・関数のすべてにJSDocが付き、`@param`/`@type`/`@returns`の型注釈が実態と一致していることを確認した。ロジックの変更は行っていない。
    *   **修正1（追加指示）**：`main.js`のresizeハンドラ直前のコメント「CanvasManagerのバッファサイズ・dprスケールを同期し、その直後に最新のModel状態で再描画する」が、タスク2で`resize()`がdprスケールを適用しなくなった実態とずれていたため、「まず`CanvasManager.resize()`でdprの算出と内部バッファサイズの同期を行い（`resize()`は描画変換を適用しない。dpr × ビュー変換の描画変換は`render()`が毎フレーム設定する）、その直後に最新のModel状態・ビュー変換状態で再描画する（この呼び出し順序を厳守すること）」に改めた（コメントのみ。呼び出し順序・処理は不変）。
    *   **修正2**：`Curve.drawHandles`の`@param viewScale`の説明が「ハンドルの大きさ・枠線幅を画面上で一定に保つ」のみで、タスク3で同様に換算した点線ヘルパーの線幅・破線間隔に触れていなかったため、「ハンドルの大きさ・枠線幅、および点線ヘルパーの線幅・破線間隔を画面上で一定に保つ」に補った（JSDocのみ）。
    *   **座標系表記**：座標を扱う引数・戻り値・プロパティについて、以下のとおりワールド／スクリーンの別が明記されていることを確認した（修正不要）。
        *   `ViewTransform`：`screenToWorld`/`worldToScreen`/`screenLengthToWorld`/`zoomAt`/`panBy`の引数・戻り値、`#offsetX`/`#offsetY`、`getState()`の戻り値。
        *   `InputTracker`：`getScreenCoordinate`（スクリーン）／`getWorldCoordinate`（ワールド）の戻り値、`lastCursor`（ワールド）、`#panDrag.lastScreen`（スクリーン）、`hitTolerance`（スクリーンpx）／`#getWorldHitTolerance()`（ワールド長）、`#resolveCursor`/`#updateCursor`の`point`（ワールド）、`handleWheel`のズーム中心（スクリーン）。
        *   `CanvasManager`：`DEFAULT_VIEW`・`render()`の`state.view`・`#drawGrid(view)`のオフセット（スクリーン）、`GRID_BASE_SPACING`（ワールド長）／`GRID_MIN_SCREEN_SPACING`（スクリーンpx）、`#strokeGridLines`の`spacing`（ワールド長）・`bounds`（ワールド）。
    *   **検索による確認**（`js/core/*.js`・`js/main.js`）：
        *   「論理」：`InputTracker.js`／`CanvasManager.js`／`ViewTransform.js`／`main.js`には残存なし。`VectorModel.js`のJSDocに「論理座標系」が8箇所残るが、変更禁止ファイルのため修正していない（懸念事項に記載）。
        *   `getLogicalCoordinate`：`js/`配下・`index.html`ともに残存なし。
        *   「将来」：残存3件はいずれも「将来…ズーム・パン実装時に修正が必要」旨のコメントではない（`isTextInputElement`のPhase 02-04再利用、`#resolveCursor`の将来のモード追加時の既定値、`main.js`の初回描画明示化の理由）。
        *   変換式の重複：`* scale`／`/ scale`等の出現は`ViewTransform.js`内（`screenToWorld`/`worldToScreen`/`screenLengthToWorld`/`zoomAt`）のほかは、`CanvasManager`の`setTransform`による描画変換の合成（除外対象）と、`#drawGrid`の`minor * scale`（画面上のグリッド間隔による間引き判定）・`lineWidth = 1 / scale`（画面上1px一定の線幅換算）のみで、スクリーン⇔ワールドの座標変換の重複はない。後2者は図形クラスの`÷ viewScale`と同種の補助表示サイズの換算と判断し、除外扱いとした（懸念事項に記載）。
    *   **責務JSDoc**：対象8ファイルの先頭責務JSDoc（いずれも3行以内）が実態と一致していることを確認した（`ViewTransform`：ビュー変換状態の保持・変換・ズーム・パン・リセット・通知、`InputTracker`：パン・ズームを含む入力解釈とカーソル形状、`CanvasManager`：背景グリッドを含む純粋な描画・状態非保持、`main.js`：初期化と連携、`shapes/`4クラス：データ保持・描画・当たり判定）。変更なし。
    *   `node --check`で対象8ファイルとも構文エラーなしを確認。
    *   `git diff --stat -- js/core/VectorModel.js js/core/WindowManager.js js/core/ShapeFactory.js js/palette/PaletteController.js`の出力が空であり、変更禁止ファイルに差分がないことを確認した。
    *   開発資料への影響：今回の修正はコメント・JSDocのみで、`resize()`の記述更新（「dprの算出とバッファサイズの同期（変換の適用は`render()`が行う）」）は既に『開発資料の更新予定』の「4. CanvasManager.js」に記載済みのため、追記事項はない。

### タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映【固定タスク】
*   **作業内容** :
    *   『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄の全項目（タスク4・8・9で追記・確認された内容を含む）を確認し、以下のとおり資料へ反映した。コード（`.js`/`index.html`）は変更していない。
        *   **1章（フォルダ構造）**：`js/core/`配下の`CanvasManager.js`の直後に`ViewTransform.js`を追加した。
        *   **2章（データ構造）**：「ShapeDataの座標（`points`）はすべてワールド座標であり、ビュー変換は図形データに含まれず`core/ViewTransform.js`が保持する表示専用の状態である（パン・ズームで図形データは書き換わらない）」旨を追記した。
        *   **3章（描画・操作フロー）**：項目「4. 座標系とビュー変換」を新設し、ワールド/スクリーン座標の定義と変換式、入力（`InputTracker`→`screenToWorld`→`VectorModel`・当たり判定、パン量・ズーム中心はスクリーン座標）、描画（`renderCurrentState()`→`getState()`→`render()`でdprと合成）、再描画3経路（`VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズ、同一関数`renderCurrentState()`）を記載した。
        *   **4章 main.js**：起動時の`applyMode`の記述の後に、起動時初期化の最後での`renderCurrentState()`の明示呼び出し（タスク4追加分）、`syncZoomDisplay()`の明示呼び出し（タスク8追加分）、`ViewTransform`の生成・注入・`render()`への`view`受け渡し・`onChange`への2関数登録・リセットボタンの配線、`modeButtons`への`PAN`（`#mode-pan`）エントリ（任意項目だが既存設計の実例として記載）を追記した。
        *   **4章 CanvasManager.js**：`render()`のシグネチャを`{ hoveredId, selectedId, draftLine, view }`に更新し、描画変換（`view`×`#pixelRatio`の毎フレーム`setTransform`）、バッファ全体のクリア、背景グリッド（細線10/太線100・8px未満で10倍繰り上げ・画面上1px・可視範囲のみ）、`drawHover`/`drawHandles`への`view.scale`の一律受け渡し、ビュー変換状態を保持しない旨を記載した。`resize()`の記述を「dprスケールの計算・再適用」から「dprの算出とバッファサイズの同期（変換の適用は`render()`が行う）」に更新した（タスク9確認分）。
        *   **4章 ViewTransform.js（新規項目）**：`CanvasManager.js`の直後に新設し、更新予定欄の記述どおり記載した（`getScale()`も公開APIとして併記）。
        *   **4章 InputTracker.js**：冒頭の責務を「マウス・キーボード入力の解釈（パン・ズームを含む）、スクリーン座標からワールド座標への変換」に更新（コード側の責務JSDocに合わせた）、`currentMode`の型を`'select'`/`'create'`/`'pan'`に更新、カーソル形状に`grabbing`/`grab`を追加した。座標系・パン・ズーム・`isTextInputElement`は長文化を避けるため、`shapes/`配下の記載形式に倣いサブ項目（`座標系`/`パン`/`ズーム`/ヘルパー）として追記した。
        *   **4章 shapes/**：9メソッド契約を`drawHandles(ctx, viewScale = 1)`/`drawHover(ctx, viewScale = 1)`に更新し、`viewScale`による補助表示の`÷ viewScale`換算・`draw`は倍率を受け取らない旨・図形クラスの座標はワールド座標でオフセットは渡されない旨を追記した。
    *   `PROJECT_ARCHITECTURE.md`内で`getLogicalCoordinate`・`drawHandles(ctx)`・`drawHover(ctx)`（引数1つの旧記述）・「論理座標」・「dprスケール」を検索し、いずれも残存がないことを確認した。
    *   更新予定欄の各項目（1章／2章／3章／4章 ViewTransform・main.js（本体・タスク4追加・タスク8追加）・CanvasManager・InputTracker・shapes）はすべて反映済みである。

## 5. 懸念事項・要確認ポイント
* **【要件8】DPI・CSSズーム環境下での`moveShape`差分の目視確認項目（持ち越し事項）**：以下の条件で、moveハンドルによる平行移動・頂点ハンドルのドラッグ・新規作成を行い、カーソルと図形（ハンドル）がずれないかを目視確認すること（タスク5・8完了後）。
    * ブラウザズーム100%・表示倍率100%（基準）
    * ブラウザズーム125%・表示倍率200%で図形を移動し、カーソルと図形がずれないか
    * ブラウザズーム125%・表示倍率50%で図形を移動し、カーソルと図形がずれないか
    * ブラウザズーム150%（または高DPIディスプレイ、`devicePixelRatio`≠1の環境）・表示倍率1000%で頂点ハンドルを掴んで移動し、ハンドル中心がカーソルに追従するか
    * パン（オフセット≠0）後に上記を行い、ずれが増えないか
    * 表示倍率を変えた後にブラウザズームを変更（`resize`イベント発生）し、表示位置・倍率が維持され、クリック位置がずれないか
    * 表示倍率200%で、画面上5px以内でホバー・ハンドル判定が反応し、それより外では反応しないか（当たり判定の画面上一定化）
* **【既存不具合・本作業では修正しない】`DRAGGING_HANDLE`のドラッグ終了検知漏れ**：`handleMouseUp`はキャンバス要素にのみ購読しているため、ハンドルドラッグ中にカーソルをフロートウィンドウ上（`WindowManager`が`mouseup`の伝播を止める以前に、そもそもキャンバスの子孫ではない）やブラウザ外へ移動してボタンを離すと、キャンバスに`mouseup`が届かず`DRAGGING_HANDLE`状態が残留する。その後キャンバス上へ戻るとボタンを押していないのに頂点・図形が追従し、次のキャンバス上での`mouseup`まで解除されない。本作業でパン用に導入する`window`のcapture購読（`#handleWindowMouseUp`）にハンドルドラッグの終了も載せれば解消できる見込みだが、REQにより修正は必須とせず、本作業では行わない（後続のInterrupt候補）。
* **【既存挙動】`handleMouseDown`がマウスボタン種別を判定していない**：現状、選択モードで右ボタンを押した場合もハンドルドラッグが開始される。本作業では中ボタンをパン判定で先に処理するため中ボタンでのハンドルドラッグは発生しなくなるが、右ボタンの扱いは変更しない（後続で`event.button === 0`のガード追加を推奨）。
* **トラックパッドでのズーム感度**：`deltaY`の符号のみで1イベント＝1刻み（約1.1倍）とするため、トラックパッドやピンチ（ブラウザ上は`ctrlKey`付き`wheel`として届く）では細かいイベントが大量に発生し、ズームが過敏になる可能性がある。マウスホイールでの予測しやすさを優先して本作業ではこの方式とする。問題がある場合は、`deltaMode`で単位を正規化した`deltaY`の大きさに応じて`factor = 1.1 ^ (−deltaY / 100)`とする連続方式への変更を後続で検討する（`handleWheel`内の変更のみで済む）。
* **フロートウィンドウ上のCtrl+ホイール**：ホイールの既定動作抑止はキャンバス上のみのため、フロートウィンドウ上でCtrl+ホイールを行うとブラウザズームが働く。ブラウザズームは`resize`イベント経由で`CanvasManager.resize()`が追従するため表示は破綻しない想定（目視確認推奨）。
* **フォーカス中のボタンとスペースキー（目視確認推奨）**：操作モードボタン等をクリックするとボタンにフォーカスが残り、スペースキーでそのボタンがclickされる（ブラウザ既定動作）。モードボタンが再clickされると`setMode`により選択解除・作成途中図形の破棄が起きるため、スペースの`keydown`/`keyup`の両方で`preventDefault()`して抑止する計画とした。ブラウザによってボタンの活性化が`keydown`/`keyup`のどちらで起きるかが異なるため、タスク6(h)で実機確認すること。抑止しきれない場合は、ボタンクリック後に`blur()`する等の対策が別途必要（`main.js`側の変更）。
* **スペースを離した時点でパンのドラッグ中だった場合の挙動（判断事項）**：ドラッグ途中で選択・作成の挙動へ切り替わる不整合を避けるため、スペースを離してもマウスボタンを離すまでパンを継続する設計とした。違和感がある場合は`handleKeyUp`で`#endPan()`を呼べば即時終了に変更できる。
* **`isTextInputElement`の判定範囲**：`input`要素は`type`（`button`/`checkbox`等）を問わずテキスト入力扱いとする（REQの列挙どおり、かつ誤爆防止の観点で保守的な判定）。Phase 02-04で`Delete`/`Backspace`に適用する際に、`type`別の扱いが必要か再検討すること。`select`要素は含めない。
* **`CanvasManager`の`#pixelRatio`フィールド（判断事項）**：`render()`で毎フレーム「dpr × ビュー変換」を設定するため、`resize()`で算出したdprを保持する。これは描画バッファの設定値（`canvas.width`と同種の情報）であり、図形データ・選択状態・ビュー変換状態・操作モードではないため、「状態を持たないレンダラー」の原則には反しないと判断した。`render()`内で毎回`window.devicePixelRatio`を読み直す案は、`resize()`未実行のままdprが変化した場合にバッファサイズと変換が食い違うため採らない。
* **グリッド線のにじみ（目視確認推奨）**：グリッドはワールド変換下で線幅`1 / scale`として描くため、線の位置が物理ピクセル境界に揃わず、倍率・オフセットによっては1pxの線が2pxの薄い線ににじんで見える場合がある。気になる場合は、スクリーン変換下で`DOMMatrix.transformPoint`により線位置を求めて0.5px境界に丸める方式へ`#drawGrid`内のみの変更で切り替えられる。
* **グリッドの色・間引き閾値（目視確認推奨）**：細線`rgba(0,0,0,0.06)`・太線`rgba(0,0,0,0.14)`、画面上8px未満で繰り上げ。倍率の境界（例：80%付近で細線10px→8px）で細線が突然消える・現れる切り替わりがあるため、違和感がある場合は閾値や色（フェード）を調整する。
* **`Curve`のヘルパー点線の倍率対応（判断事項）**：REQ要件6の列挙（ハンドルの大きさ・枠線幅・ホバー上乗せ幅）には含まれないが、`drawHandles`内の補助表示であり、換算しないと拡大時に太く粗い点線になるため、線幅・破線間隔も`÷ viewScale`で換算する計画とした。
* **ズーム直後のホバー・カーソル表示**：ホイールズームやパン終了の直後は、マウスを動かすまでホバー強調・カーソル形状が再評価されない（パン開始時はホバーをクリアする）。Phase 02-01の「カーソル更新のタイミング」懸念と同種で、実用上の問題は小さいと判断した。
* **`InputTracker`の責務肥大化**：パン・ズームの入力解釈を同ファイルに追加するため行数が大きく増える。分離案の不採用理由は「2. アーキテクチャ設計」に記載した。Phase 02-03（範囲選択・複数選択）でドラッグ系の入力（範囲選択の矩形ドラッグ）がさらに加わる際に、ドラッグ操作の解釈（パン・範囲選択・ハンドルドラッグ）を別クラスへ分離する設計を再検討すること。
* **`getLogicalCoordinate`のリネーム**：座標系の用語を統一するため`getScreenCoordinate`へリネームする。`InputTracker`外からの呼び出しはない（`main.js`等は未使用）ことを計画時に確認済み。REQ本文は旧名で記述されているが、要件（スクリーン座標取得とワールド変換の分離）は新名で同等に満たす。
* **`shapes/`のJSDocに残る「論理座標系」表記**：`setVertex`等の対象外メソッドのJSDocに「論理座標系」とあるが、REQのスコープ（`drawHandles`/`drawHover`の倍率対応のみ）を守るため修正しない。意味としては「ワールド座標」である。後続で図形クラスに触れる際に用語を揃えること。
* **【参照する責務と実コードの相違】`Line.draw`のシグネチャ**：開発資料は9メソッド契約を`draw(ctx, t)`と記載しているが、`Line.js`の`draw`は`draw(ctx)`（`t`引数なし）である（`Ellipse.draw`は`draw(ctx, t = 0)`）。本作業では`draw`を変更しないため影響はないが、モーフィング実装時に揃える必要がある。
* **既存JSDocの古い記述（Phase 02-01からの持ち越し）**：`InputState`のJSDoc（「新規Line作成中」「start/end/move」）、`activeHandle`の`@type {'start'|'end'|'move'|null}`は実態（`control`/`topLeft`/`right`等のハンドル）と一致していない。本作業では座標系表記の更新に伴い同じJSDocブロックに触れる可能性があるが、ハンドル種別の記述はスコープ外として修正しない（後続のInterrupt候補）。
* **【タスク1】`MIN_SCALE`/`MAX_SCALE`はstaticの公開フィールド（判断事項）**：計画どおり`static MIN_SCALE = 0.1`の形で定義したため、外部から代入により書き換え可能である（`Object.freeze`や getter 化はしていない）。現状は読み取り専用として扱う前提であり、書き換える利用者はいない。将来この値をUI等から参照する場合も代入しないこと（必要になれば`static get`への変更を検討）。
* **【タスク1】`reset()`の初期状態判定は厳密等価（判断事項）**：`reset()`は`scale === 1 && offsetX === 0 && offsetY === 0`の場合のみ「何もしない」。ズームを往復（例：×1.1 → ÷1.1）した後は浮動小数誤差で倍率が厳密に1にならないことがあり、その場合は見た目上100%でも`reset()`が実行され通知（再描画）が1回起きる。値は正しく初期化されるため実害はない。また倍率表示（タスク8）は四捨五入のため「100%」と表示されつつ内部値が1でない状態があり得る点に留意。
* **【タスク1】ズーム往復時の誤差の蓄積**：`zoomAt`は`scale × factor`を累積するため、ホイールの拡大・縮小を同回数行っても倍率・オフセットが厳密には元に戻らない（微小誤差）。実用上は問題ないが、将来「ズーム段階のスナップ（例：100%に吸着）」が必要になった場合は`zoomAt`内でのみ対応すること（変換式を他所に持ち出さない）。
* **【タスク2】計画外の補助メソッド・定数の追加（判断事項）**：`#drawGrid`内の細線・太線の描画処理が同一のため、privateメソッド`#strokeGridLines(spacing, bounds, color)`に共通化した。また「上限ガード付き」の具体値として定数`GRID_MAX_SPACING_STEPS = 10`を定義した（`MIN_SCALE`=0.1では繰り上げは最大1回のため実際には到達しない）。いずれも`CanvasManager`の描画責務の範囲内であり、外部APIは増えていない。
* **【タスク2】クリア範囲の変更**：旧`render()`はCSSサイズ（`style.width`のパース）でクリアしていたが、恒等変換下で`canvas.width`/`canvas.height`（バッファ全体）をクリアする方式に変えた。`style.width`をパースする箇所はなくなった。
* **【タスク2】`DOMMatrix`/`DOMPoint`への依存**：可視範囲算出に`ctx.getTransform()`（`DOMMatrix`）と`DOMPoint`を用いる。現行の主要ブラウザでは標準だが、古いブラウザ（`getTransform`未対応）では例外になる。対象ブラウザに制約がある場合は要確認。
* **【既存挙動・タスク2の確認中に判明】非表示状態で読み込むとキャンバスが0×0に固定される**：ページ読み込み時にキャンバスの`clientWidth`/`clientHeight`が0（タブ・ペインが非表示等）だと、`resize()`が`style.width/height = 0px`を固定してしまい、以後リサイズしても0のまま復帰しない（再読み込みで解消）。本タスクの変更前から同じロジックであり、本作業では修正しない（後続のInterrupt候補）。
* **【タスク2】ハンドルドラッグ後の選択解除（未調査）**：確認中、端点ハンドルをドラッグした直後に選択（ハンドル表示）が外れて見えた。ドラッグ終了時の`click`による選択判定（既存の`InputTracker`挙動）の可能性が高く、`CanvasManager`の変更とは無関係と考えられるが、本タスクのスコープ外のため未調査。タスク5以降のテストプレイで、変更前（`git stash`等）と挙動が同じかを確認すること。
* **【タスク3】`viewScale`の不正値に対する防御なし（判断事項）**：図形クラスの`drawHandles`/`drawHover`は`viewScale`が0・負・`NaN`の場合のガードを持たない（`8 / 0`=`Infinity`等になる）。倍率は`ViewTransform`が`MIN_SCALE`〜`MAX_SCALE`にクランプし、`CanvasManager`は`getState()`由来の値を渡すのみのため実際には到達しない前提とした。将来、図形クラスを別経路（サムネイル描画・書き出しプレビュー等）から呼ぶ場合は、呼び出し側で正の有限数を保証すること。
* **【タスク3】倍率極小時のハンドルの重なり（目視確認推奨）**：ハンドルは画面上一定サイズのため、倍率10%付近では小さな図形のハンドル同士が画面上で重なり、ハンドル同士・本体の視認や掴み分けが難しくなる（当たり判定はタスク5で画面上5px一定化されるが、重なった場合の優先順位は既存の`hitTestHandle`の判定順に従う）。仕様どおりの挙動だが、タスク5以降のテストプレイで操作性を確認すること。
* **【タスク3】`Ellipse.drawHandles`のみ`half`基準**：`Line`/`Curve`/`Rect`は`handleSize`（一辺）を換算して`half`を導出するのに対し、`Ellipse`は既存実装どおり`half`（4）を直接換算している（一辺は`half * 2`）。結果の大きさは同一。将来ハンドルサイズを変更・定数化する際は4クラスすべてを揃えて修正すること（現状は各クラスにリテラル値が分散している）。
* **パレットの`.disabled`中のヘッダードラッグ不可**：キャンバス移動モード中も図形パレットは`.disabled`となり、ヘッダーもドラッグできない（Phase 02-01からの現状仕様。REQ Non-goalにより維持）。
* **【タスク4】起動時の二重描画と初回描画の位置（将来の修正時の注意）**：起動時初期化の末尾に明示的な`renderCurrentState()`を追加したため、現状は`applyMode`経由（`clearSelection()`の無条件通知）と合わせて起動時に2回描画される（同一状態のため無害）。将来`VectorModel`の通知を値変化時のみに最適化した場合でも、この明示呼び出しにより初回描画は保証される。この1行は**起動時初期化の最後**（すべての`onChange`登録・`applyMode`の後）に置くこと。また、タスク8で`syncZoomDisplay()`の起動時呼び出しを追加する際も、同様に値変化通知に依存しない明示呼び出しとすること。
* **【タスク4】セクション見出し番号の繰り下げ**：`ViewTransform`を`3.`として挿入したため、`main.js`内の既存見出し番号（Controller以降）を1つずつ繰り下げた。他ドキュメントやRESで`main.js`の見出し番号を参照している箇所があれば読み替えが必要（本RES内には番号参照なし）。
* **【タスク5】合成イベントによる確認の限界（目視確認推奨）**：タスク5の動作確認はdispatchした合成イベントで行ったため、以下は実機のマウス操作で確認できていない。(1)実ホイール（Ctrl+ホイール含む）でページスクロール・ブラウザズームが起きないこと（`defaultPrevented`は確認済み）、(2)実クリック操作では`mouseup`後に`click`が発火するため、ハンドルドラッグ終了直後の`click`で選択が解除・変更される既存挙動（タスク2懸念事項の「ハンドルドラッグ後の選択解除」）が倍率≠1でも同様に起きるか、(3)「5. 懸念事項」冒頭の【要件8】DPI・ブラウザズーム組み合わせの目視確認項目。
* **【タスク5】`hitTolerance`の公開フィールドとしての扱い**：`hitTolerance`は従来どおり公開フィールドのまま（値5、スクリーンpx単位）とし、当たり判定時に毎回`#getWorldHitTolerance()`でワールド換算する。外部から`hitTolerance`を書き換える利用者はいないが、将来書き換える場合もスクリーンpx単位で与えること（ワールド長を代入すると倍率で二重に換算される）。
* **【タスク5】作成途中のズームで始点は画面上で動く**：`DRAWING`中のズームでカーソル下のワールド点（＝作成途中図形の終点）は不変だが、始点はワールド座標で固定のため、ズーム中心から離れた始点は画面上で移動して見える（仕様どおり）。違和感の有無をテストプレイで確認すること。
* **【タスク6】`handleKeyUp`のテキスト入力中の扱い（計画からの軽微な変更・判断事項）**：計画（要件2 2-4）は「`Space`かつテキスト入力中でなければ`preventDefault()`・押下状態解除・カーソル更新」としていたが、テキスト入力中でも**押下状態の解除とカーソル更新は行い、`preventDefault()`のみ省く**実装とした。キャンバス上でスペースを押したままテキスト入力欄へフォーカスが移った場合に、解放を取りこぼして`#isSpacePressed`が`blur`まで残留する（以後の左クリックがすべてパンになる）ことを防ぐため。テキスト入力中に新たに押下状態になることはない（`keydown`側で無視する）ため、文字入力の妨げにはならない。
* **【タスク6】合成イベントによる確認の限界（目視確認推奨）**：(1)実機で中ボタンを押した際にオートスクロール（スクロールアイコン）が出ないこと、(2)フォーカス中のボタンでの実スペースキー操作でボタンのclickが発火しないこと（合成`KeyboardEvent`はブラウザ既定動作のボタン活性化を起こさないため、`defaultPrevented`の確認のみ）、(3)実マウスでのフロートウィンドウ上・ブラウザ外でのボタン解放、(4)実際のタブ切替（Alt+Tab等）による`blur`、は実機での確認を推奨する。キャンバス移動モード（左ドラッグパン・`grab`カーソル・click無反応）はボタン未配線のためタスク8で確認すること。
* **【タスク6】中ボタンの`click`/`auxclick`**：中ボタンのパン後は`#suppressNextClick`を立てない（中ボタンでは`click`ではなく`auxclick`が発火するため）。将来`auxclick`や右ボタンの`contextmenu`等を購読する場合は、パン後の抑止の要否を再検討すること。
* **【タスク6】ハンドルドラッグ中に中ボタンを押した場合**：計画どおりパンせずreturnする（`preventDefault`のみ）。既存の`handleMouseUp`はボタン種別を見ないため、ハンドルドラッグ中に中ボタンを押して離すと、その中ボタンの`mouseup`でハンドルドラッグが終了する（既存の「`handleMouseDown`/`handleMouseUp`がマウスボタン種別を判定していない」懸念と同根）。
* **コントロールパネルの縦幅増加**：ボタン1つと倍率表示行の追加でコントロールパネルが縦に伸び、図形パレット（初期位置`top: 320px`）と重なる可能性がある。タスク7で目視確認し、重なる場合は`#window-shape-palette`の`top`のみ調整する。
    * **【タスク7で確認済み】** 追加後のコントロールパネル下端は`254px`（既定フォント環境）で、図形パレット上端`320px`との間に約66pxの余白があり重ならないため、`top`は調整していない。OSのフォント・ブラウザの既定文字サイズ設定によっては高さが変わるため、異なる環境で目視確認を推奨。今後コントロールパネルへ要素を追加する場合（残り余白はボタン約1.5個分）は再確認すること。
* **【タスク7】倍率表示の初期文字列「100%」のハードコード**：`#view-zoom-display`の初期テキストは`index.html`に「100%」と直書きしている。タスク8で起動時に`syncZoomDisplay()`を明示的に呼ぶことで実値に上書きされる前提である（呼び出しを省くと、`ViewTransform`の初期値を変えた場合に表示が食い違う）。
* **【タスク7】リセットボタンに`.tool-btn`を流用**：`.tool-btn`は`text-align: left`・`:hover`・`.active`の定義を持つ。リセットボタンは`modeButtons`に含めないため`.active`は付かないが、将来`main.js`で`.tool-btn`を一括走査して`.active`を制御する実装に変えると、リセットボタンも巻き込まれる点に注意（現状の`applyMode`は`modeButtons`のみを走査するため問題なし）。
* **【タスク7・目視確認推奨】フォーカス中のリセットボタンとスペースキー**：リセットボタンもクリック後にフォーカスが残るため、スペースキー押下によるボタン活性化（＝意図しないリセット）が起こり得る。タスク6で`keydown`/`keyup`とも`preventDefault()`済みのため抑止される想定だが、モードボタンと同様に実機での確認を推奨（タスク8の配線後）。
    * **【タスク8】** 合成`KeyboardEvent`ではブラウザ既定のボタン活性化が起きないため、本タスクでも実機確認はできていない。リセットボタン・「✋ キャンバス移動」ボタンをクリックした直後に実キーでスペースを押し、リセット・モード再切替（選択解除）が起きないことを目視確認すること。
* **【タスク8】合成イベントによる確認の限界（目視確認推奨）**：キャンバス移動モードの左ドラッグパン・`click`無反応・倍率表示の追従・リセットは合成イベントで確認した。実マウスでのキャンバス移動モードのドラッグ（特にフロートウィンドウ上・ブラウザ外でボタンを離した場合のパン終了）、実ホイールでの倍率表示の追従、および【要件8】DPI・ブラウザズーム組み合わせの目視確認項目（本欄冒頭）は実機での確認を推奨する。
* **【タスク8】倍率表示は四捨五入値**：`syncZoomDisplay()`は整数%に四捨五入して表示するため、ズーム往復後の内部倍率が厳密に1でなくても「100%」と表示される（タスク1の`reset()`厳密等価判定の懸念と同根）。表示上100%でもリセットボタンで再描画が1回起きるのは仕様どおり。また`syncZoomDisplay`は`onChange`の登録順で`renderCurrentState`の後に呼ばれる（どちらも同期処理で順序に意味はないが、将来表示更新に描画結果を参照させる場合は登録順に注意）。
* **【タスク9】`VectorModel.js`のJSDocに残る「論理座標系」表記**：`startDraft`/`updateDraft`/`updateVertex`/`moveShape`の`@param`（計8箇所）に「論理座標系」とある。意味は「ワールド座標」であり、`InputTracker`は`getWorldCoordinate()`由来の値を渡している。変更禁止ファイルのため本作業では修正していない。`shapes/`の同種表記と合わせ、後続で`VectorModel`に触れる際に「ワールド座標」へ揃えること。
* **【タスク9】`#drawGrid`内の`* scale`／`/ scale`の扱い（判断事項）**：`minor * scale < GRID_MIN_SCREEN_SPACING`（ワールド長のグリッド間隔を画面上の間隔へ換算して間引きを判定）と`lineWidth = 1 / scale`（画面上1px一定の線幅）は、スクリーン⇔ワールドの「座標」変換ではなく長さの換算であり、図形クラスの`÷ viewScale`と同種の補助表示サイズの換算として変換式重複の確認対象から除外した。将来`ViewTransform`の変換式（例：非等方スケールや回転）を拡張する場合は、これらの長さ換算も`view.scale`単一値を前提としている点に注意すること（`screenLengthToWorld`に相当する処理の移譲を検討）。
* **【タスク8】キャンバス移動モード中もモード切替で選択がクリアされる**：既存の`setMode`仕様どおり、「✋ キャンバス移動」へ切り替えると選択・ホバーがクリアされる（パン後に選択モードへ戻っても選択は復元されない）。一方スペース・中ボタンによる一時パンでは選択は保持される。選択を保ったまま移動したい場合はスペース／中ボタンを使う運用となる点を、必要ならUI上の説明・ヘルプで補うこと。
* **【タスク10】3章「描画サイクル」の`requestAnimationFrame`記述と実装の相違（未修正）**：開発資料3章の項目2は「`requestAnimationFrame`を用いた描画ループ」と記載しているが、実装は`onChange`通知・リサイズ時に`renderCurrentState()`を同期的に呼ぶイベント駆動の再描画であり、rAFループは存在しない。本タスクでは更新予定欄の範囲（座標系・再描画3経路の追記）に留め、既存の項目2の記述は書き換えていない（新設した項目4に再描画3経路を明記したため、両者を読み比べると矛盾して見える）。将来アニメーション（モーフィング等）でrAFループを導入するかどうかと合わせ、項目2の記述を見直すこと。
* **【タスク10】3章項目1の起動処理の列挙**：「`VectorModel`, `CanvasManager`, `InputTracker`をインスタンス化」とあり、`ViewTransform`（および既存の`PaletteController`/`WindowManager`）は列挙されていない。4章`main.js`の記述が正（SSOT）であるため本タスクでは変更していないが、3章を見直す際に揃えること。
* **【タスク10】InputTracker項目のサブ項目化（判断事項）**：4章`InputTracker.js`の記述がさらに長文化するため、座標系・パン・ズーム・`isTextInputElement`を`shapes/`配下と同じ入れ子の箇条書き（サブ項目）として追記した。他モジュールは1段落形式のままであり、記載形式が混在している。Phase 02-03でドラッグ系入力を別クラスへ分離する場合は、該当サブ項目を新クラスの項目へ移すこと。
* **【タスク10・既存記述】`WindowManager.js`の「`VectorModel`が持つ…ツール状態」**：Phase 02-01以降、操作モード・図形種別は`InputTracker`が保持しているが、開発資料の`WindowManager`項目は旧表現のままである（本作業の更新予定外のため未修正）。
