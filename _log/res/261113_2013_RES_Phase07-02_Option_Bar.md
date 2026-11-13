# RES: 作業計画・作業レポート (Phase 07-02) : オプションバー（プロパティパネルの中身をツールバーへ移す）
* 参照元REQ: `./_log/req/261113_1915_REQ_Phase07-02_Option_Bar.md`

## 1. 作業目的
プロパティパネル（`#window-property-panel`）の中身（「図形」の段＝線・塗り・線の太さ、「重なり順」の段＝4つのボタン）を、ツールバー（`#toolbar`）の既存の3つのまとまりの右に続く**オプションバー**（スタイルのまとまり・重なり順のまとまりの2つの`.toolbar-group`）へ移し、プロパティパネルのウィンドウをなくす。

* 変わるもの：部品の置き場所と見た目、線・塗りのON/OFFがチェックボックスからアイコンのボタン（`aria-pressed`の3つの表示）になること、補助の表示（「選択中：n個」「次に描く図形」をなくす・色の欄の「混在」「表示できない色」の文字をグレーの地に赤の斜線と`title`に置き換える）、ON/OFFのボタンにフォーカスがあるときのキーの扱い。
* 変えないもの：反映の範囲・履歴の単位・直前に使った値の更新・色の欄の確定の扱い・太さの受理・重なり順の規則と押せる/押せないの条件・既存のショートカットの対応表・作業データの版（2）・書き出し形式の版（2）。
* 本Phaseの基準の計測値（計画時、変更前）：`node --test` → `tests 986` / `pass 986` / `fail 0`。

## 2. アーキテクチャ設計

### 要件1: オプションバーの並びと部品（`index.html`）
* `#toolbar`の既存の3つの`.toolbar-group`（`#launcher-canvas`／`#history-undo`・`#history-redo`／`#selection-delete`・`#selection-join`）は**一切変えず**、その後ろに2つの`<div class="toolbar-group">`を静的に足す。区切りは既存の`.toolbar-group + .toolbar-group`で付く。
* マークアップ（idの接頭辞は`option-`。旧`property-`・`order-`・`#property-shape-section`・`#property-order-section`は残さない）：
  ```html
  <div id="option-style-group" class="toolbar-group">
      <button type="button" id="option-stroke-toggle" class="tool-btn icon-btn" title="線のあり／なしを切り替え" aria-pressed="false">🖊</button>
      <span id="option-stroke-color-frame" class="option-color-frame"><input type="color" id="option-stroke-color" title="線の色"></span>
      <button type="button" id="option-fill-toggle" class="tool-btn icon-btn" title="塗りのあり／なしを切り替え" aria-pressed="false">🪣</button>
      <span id="option-fill-color-frame" class="option-color-frame"><input type="color" id="option-fill-color" title="塗りの色"></span>
      <input type="number" id="option-stroke-width" min="1" max="100" step="1" title="線の太さ（1〜100の整数）">
      <span class="option-unit">px</span>
  </div>
  <div id="option-order-group" class="toolbar-group">
      <button type="button" id="option-bring-to-front" class="tool-btn icon-btn" title="最前面へ (Home)" disabled>⏫</button>
      <button type="button" id="option-bring-forward" class="tool-btn icon-btn" title="前へ (PageUp)" disabled>🔼</button>
      <button type="button" id="option-send-backward" class="tool-btn icon-btn" title="後ろへ (PageDown)" disabled>🔽</button>
      <button type="button" id="option-send-to-back" class="tool-btn icon-btn" title="最背面へ (End)" disabled>⏬</button>
  </div>
  ```
  * アイコンはこのマークアップのボタンの中身だけに書く（JSはボタンの中身の文字を書き換えない。CSSの`content`で重ねない）。`title`のキー表記（`Home`・`PageUp`・`PageDown`・`End`）は`SHORTCUT_BINDINGS`と手動同期のため落とさない。
  * 見出し（「図形」「重なり順」）・項目名（「線」「太さ」「塗り」）は置かない。単位「px」だけ太さの欄の右に置く。
  * 初期値：`checked`・`value`・`data-color-note`等の表示の初期値は書かない（起動時に`main.js`が1回描画する）。例外は2つ：(1) ON/OFFのボタンの`aria-pressed="false"`（要件6の判定がこの属性の**有無**で部品の種類を見分けるため、JSの実行前から必ず持たせる。値は起動時の描画で同期される）、(2) 重なり順のボタンの`disabled`（今と同じく`disabled`で始まる）。
* CSS（`<style>`内。CSSファイルは分割しない）：
  * 足すもの：
    * `.option-color-frame`（色の欄を包む要素）：`position: relative; display: inline-flex; flex: none;`。
    * `.option-color-frame input[type="color"]`：`box-sizing: border-box; width: 32px; height: 24px; padding: 0;`（高さ40pxのツールバーに収まる大きさ）。
    * 覆いと斜線（要件3）：下記「要件3」のルール1つ。
    * `#option-stroke-width`：`box-sizing: border-box; width: 56px; height: 24px; user-select: text;`（`.toolbar`の`user-select: none`は変えず、この欄に限り文字の選択を許可）。
    * `.option-unit`：`font-size: 12px; color: #666;`。
    * ON/OFFの3つの表示（要件2）：下記「要件2」のとおり。
  * なくすもの（実コードで使用箇所を確認済み。すべて`#window-property-panel`の中でだけ使われている）：`#window-property-panel`・`.property-section`・`.property-section + .property-section`・`.property-section-title`・`.property-source`・`.property-row`・`.property-toggle`・`.property-label`・`.property-note`・`.property-unit`・`#property-stroke-width`・`.property-row input[type="color"]`・`.order-button-grid`・`.order-button-grid .tool-btn`のルールとそのコメント。オプションバーで使い続ける働き（太さの欄の幅と`user-select: text`、単位の文字、色の欄の大きさ）は上の`option-`の名前で足し直す。
  * CSSコメントの修正：ツールパレット（`#window-tool-palette`）・読み込み中の覆い要素（`.canvas-loading-cover`）・`?dev`の確認用ウィンドウ（`#window-dev-panel`）のコメントからプロパティパネルの記述を除き、実態（ツールバーのオプションバー）へ改める。`?dev`の確認用ウィンドウの位置（ツールパレットの右隣）とキャンバスパレットの位置（右上）の値は変えない。`.disabled`に触れる`#window-property-panel`のCSSコメントはウィンドウごと削除される。
* **幅の見積もり（1280px幅で全項目が収まることの確認）**：
  | 項目 | 幅の内訳 | 幅 |
  | --- | --- | --- |
  | ツールバーの左の余白 | `padding: 0 8px`の左 | 8px |
  | 既存1（キャンバスパレット） | ボタン32 | 32px |
  | 区切り | `margin-left 8`＋`border-left 1`＋`padding-left 8` | 17px |
  | 既存2（取り消し・やり直し） | 32＋間隔4＋32 | 68px |
  | 区切り | 同上 | 17px |
  | 既存3（削除・結合） | 32＋4＋32 | 68px |
  | 区切り | 同上 | 17px |
  | スタイル | ボタン32＋4＋色32＋4＋ボタン32＋4＋色32＋4＋太さ56＋4＋「px」約14（12px×2字） | 約218px |
  | 区切り | 同上 | 17px |
  | 重なり順 | 32×4＋4×3 | 140px |
  | ツールバーの右の余白 | `padding`の右 | 8px |
  | **合計** | | **約610px** |
  * 1280px幅に対し約670pxの余裕がある。Phase 07-03でパレットの表示・非表示のボタン1つのまとまり（区切り17＋32＝49px）を足しても約659pxで収まる。太さの欄はブラウザによって数値の上下の矢印が欄の中に描かれるが、`width: 56px`の中に収まる（欄の外には広がらない）。
  * 幅が狭いときは`.toolbar`の`overflow: hidden`・`flex-wrap: nowrap`と`.toolbar-group`の`flex: none`（変えない）により、右から（重なり順のまとまり → スタイルのまとまり → 既存のまとまり）切れる。
  * 覆いと斜線は色の欄の上に絶対配置で重ねるだけで幅を持たないため、混在の表示が出たり消えたりしても右側の部品の位置は動かない（旧パネルの「混在」の文字の`<span>`は置かない）。

### 要件2: 線・塗りのON/OFFのボタン
* **3つの表示の定義（CSSの1か所。`aria-pressed`の値で決め、`.active`は併用しない）**：
  * 既存の`.tool-btn.active`のルールのセレクタを`.tool-btn.active, .tool-btn[aria-pressed="true"]`に広げる（押し込みの見た目の定義を増やさず、既存の1つのルールを共有する）。
  * そろっていない：`.tool-btn[aria-pressed="mixed"] { border-style: dashed; border-color: #666; }`（破線の枠。背景色は変えず押し込みの色を付けない）。
  * OFF（`"false"`）は追加の定義なし（`.tool-btn`の通常の見た目）。
  * 無効（`disabled`）は既存の`.tool-btn:disabled`。無効のとき`aria-pressed`は`"false"`になる（規則`buildStylePanelView`が`fill.disabled: true`のとき必ず`enabled: false`を返す。既存テスト「塗れない形だけなら塗りの欄は無効」が確かめている）ため、押し込み・破線にならない。
* UI部品は`render(view)`で`aria-pressed`を`enabled`から写すだけ（`true`→`"true"`、`false`→`"false"`、`null`→`"mixed"`）。`disabled`は`view.stroke.disabled`／`view.fill.disabled`をそのまま`button.disabled`へ。
* **押したときの規則**（`js/edit/StylePanelRules.js`に足す。DOMなし・状態なし）：
  ```js
  /**
   * ON/OFFのボタンを押したときの次の有無を求める（今の表示がONならOFF、OFFまたはそろっていないならON）。
   * @param {boolean|null} enabled - 今の表示（true＝ON・false＝OFF・null＝そろっていない）
   * @returns {boolean} 次の有無
   */
  export function nextEnabledOnToggle(enabled) {
      return enabled !== true;
  }
  ```
* **切り替えのメソッド**（`js/edit/ShapeStyleEditor.js`に足す公開メソッド2つと非公開メソッド1つ）：
  ```js
  /** 線の有無を切り替える（ON→OFF、OFF・そろっていない→ON）。@returns {boolean} 受理したか */
  toggleStrokeEnabled() { return this.#toggleEnabled('stroke'); }
  /** 塗りの有無を切り替える。選択中の図形があるのに塗れる形が無ければ何もせずfalse。@returns {boolean} 受理したか */
  toggleFillEnabled() { return this.#toggleEnabled('fill'); }
  /**
   * 有無の切り替えの共通処理。ピッカー操作中の記録を先に確定してから、今の表示内容（getPanelView）の有無に
   * nextEnabledOnToggleを当てて次の有無を求め、#setEnabledと同じ処理で反映する。
   * @param {string} target - 色の項目（'stroke'・'fill'）
   * @returns {boolean} 受理したか
   */
  #toggleEnabled(target) {
      this.#finishPreview();
      const next = nextEnabledOnToggle(this.getPanelView()[target].enabled);
      return this.#setEnabled(target, next);
  }
  ```
  * `import`に`nextEnabledOnToggle`を足す（importは`./StylePanelRules.js`のみのまま）。
  * 反映の範囲・履歴の単位（1回で1件）・直前に使った値の更新・「ONにしたときは表示中の色を入れる」・塗れる形が無い選択での不受理は、既存の`#setEnabled`をそのまま通るため変わらない（塗れる形が無い選択では`fill.enabled`は`false`→次は`true`→`#setEnabled`が`targets.length === 0`で`false`を返す）。
  * 既存の`setStrokeEnabled(enabled)`・`setFillEnabled(enabled)`は働き・戻り値・テストとも変えず公開のまま残す（Phase 07-04の`D`キー・スポイトで使う見込み）。
* UI部品はボタンの`click`で「押された」ことだけをコールバック（`onStrokeToggle()`・`onFillToggle()`。引数なし）で通知し、`main.js`はそれを`shapeStyleEditor.toggleStrokeEnabled()`／`toggleFillEnabled()`へつなぐだけ（判定を持たない）。`disabled`のボタンは`click`が来ない。

### 要件3: 色の欄と「混在」「表示できない色」の表示
* 色の欄の働きと契約（`input`→`onColorInput(target, value)`、`change`→`onColorChange(target, value)`、`blur`・`keydown`→`onColorEditEnd()`、値は今の値と違うときだけ代入、`disabled`は`view.*.disabled`）は旧`PropertyShapeSection`と同じ。`ShapeStyleEditor`の`previewColor`・`commitColor`・`finishColorPreview`は変えない。
* **覆いと斜線の描き方**：色の欄を包む`.option-color-frame`（`<span>`）の`::after`疑似要素で描く（追加の要素・画像・SVGなし）。UI部品が`render`で包む要素の`data-color-note`属性に`view.*.colorNote`（`''`・`'mixed'`・`'unsupported'`）をそのまま写し、CSSの1つのルールで2つの値を同じ見た目にする：
  ```css
  /* 色の欄の「色を表示できない」表示（混在・表示できない色。2つは見た目を区別せずtitleで区別する）。
     グレーの地・赤の斜線の色と太さの唯一の定義箇所。欄の上に重ねるだけで幅を変えず、マウスの操作は欄へ通す */
  .option-color-frame[data-color-note="mixed"]::after,
  .option-color-frame[data-color-note="unsupported"]::after {
      content: '';
      position: absolute;
      inset: 2px;                 /* 色の欄の枠線の内側（色の部分）を覆う。実装時に実際の見え方で調整してよい */
      pointer-events: none;       /* クリック（ピッカーを開く）・ホバー（title）を下の色の欄へ通す */
      background:
          linear-gradient(to bottom right,
              transparent calc(50% - 1px), #e00000 calc(50% - 1px),
              #e00000 calc(50% + 1px), transparent calc(50% + 1px)),
          #c8c8c8;
  }
  ```
  * `to bottom right`の角の指定により、50%の線は左下の角と右上の角を通る1本の斜線（太さ2px）になる。
  * `''`のときは`::after`が生成されず、色の欄の色がそのまま見える。色の欄が無効（塗れない形だけ）のとき、規則上`colorNote`は`''`のため覆い・斜線は出ない。
  * 色の欄の値（最も手前の図形の色、または覚えている色）・欄の幅・欄のクリックは妨げない（疑似要素は絶対配置・`pointer-events: none`）。開いたピッカーには欄の値の色が出る。
* **`title`**：UI部品が`render`で色の欄の`title`を設定する。文言の唯一の定義箇所はUI部品のファイル（`COLOR_TITLE_TEXT`。旧`COLOR_NOTE_TEXT`に当たる）：
  | `target` | `''` | `'mixed'` | `'unsupported'` |
  | --- | --- | --- | --- |
  | `stroke` | `線の色` | `線の色（混在）` | `線の色（表示できない色）` |
  | `fill` | `塗りの色` | `塗りの色（混在）` | `塗りの色（表示できない色）` |
  * `index.html`の初期の`title`は表の`''`の列の値（`線の色`・`塗りの色`）。

### 要件4: 線の太さの欄
* 旧`PropertyShapeSection`と同じ：`change`で`onStrokeWidthChange(value)`を呼び、戻り値が`false`なら最後の`view`で欄を書き戻す。`blur`で書き戻す。フォーカスがある間は`render`で書き換えない。`view.strokeWidth === null`なら欄を空にして`placeholder`に`混在`（`STROKE_WIDTH_MIXED_PLACEHOLDER`。UI部品が唯一の定義箇所）。`ShapeStyleEditor.setStrokeWidth`・`StylePanelRules.parseStrokeWidthInput`は変えない。

### 要件5: 「選択中：n個」「次に描く図形」の表示をなくす
* オプションバーに表示の対象の文字は置かない（旧`#property-shape-source`・`SOURCE_NEW_SHAPE_TEXT`・`sourceSelectionText`はUI部品の作り替えでなくなる）。働き（選択中なら選択中の図形へ、選択なしなら直前に使った値を表示・変更）は`buildStylePanelView`・`ShapeStyleEditor`のまま変わらない。
* **使う箇所が無くなる項目を消す**：`StylePanelView`の`source`・`selectedCount`。
  * 計画時の`js/`全体の検索結果（`source`・`selectedCount`）：使用箇所は`js/edit/StylePanelRules.js`（typedef・`buildStylePanelView`の戻り値2か所・JSDocの説明1か所）と`js/palette/PropertyShapeSection.js`（typedef・`render`の表示）だけ。`js/edit/ShapeStyleEditor.js`・`js/main.js`は使っていない（`main.js`は`view`をそのまま渡すだけ）。他の`source`は作業データ・スプライトの`source`で無関係。
  * 削除するもの：`StylePanelRules.js`のtypedef`StylePanelView`の2項目・`buildStylePanelView`の戻り値の2項目・JSDocの`source: 'selection'`/`'newShape'`の言及（「図形を1個以上選んでいるときは選択中の図形から、選んでいないときは直前に使った値から決める」の形に改める）、UI部品（`OptionBarStyleGroup.js`）側の二重定義のtypedefの2項目。
  * 書き換える既存のテスト（`test/edit/StylePanelRules.test.js`）：
    1. `buildStylePanelView: 選択なし` › `直前に使った値をそのまま出す`：`assert.deepEqual`の期待値から`source: 'newShape'`・`selectedCount: 0`の2行を削除（理由：戻り値から項目がなくなるため。残りの期待値は変えない）。
    2. `buildStylePanelView: 選択あり` › `1個選択`：期待値から`source: 'selection'`・`selectedCount: 1`の2行を削除（同じ理由）。
  * `test/edit/ShapeStyleEditor.test.js`には`source`・`selectedCount`を確かめるケースが無い（計画時に検索して確認済み）ため、書き換えるケースは無い。

### 要件6: キーボードの扱い（フォーカスがオプションバーの部品にあるとき）
* 計画時の確認：`index.html`・`js/`に`aria-pressed`を持つ要素は無い（検索して確認済み。`CanvasPalette`が動的に作るボタンも持たない）。本作業で足すのはON/OFFのボタン2つだけ。
* **判定の関数**（`js/core/InputTracker.js`のモジュール関数。状態を持たない。exportしない＝`InputTracker.js`の中だけで使う）：
  ```js
  /**
   * 要素がON/OFFのボタン（標準の属性aria-pressedを持つbutton要素）かを判定する。DOMのid・クラス名は見ない。
   * @param {Element|null} element 判定対象（通常は document.activeElement）
   * @returns {boolean} aria-pressed属性を持つbutton要素ならtrue
   */
  function isToggleButtonElement(element) {
      return element instanceof HTMLButtonElement && element.hasAttribute('aria-pressed');
  }

  /**
   * Spaceをスペースパンに使わず、部品自身の操作に譲る要素かを判定する
   * （type が checkbox・color の input（isSpaceOperatedInputElement）と、ON/OFFのボタン（isToggleButtonElement））。
   * Ctrlなしのショートカットを止める判定（KeyboardShortcutsの手順4）には使わない（ON/OFFのボタンではショートカットを働かせるため）。
   * @param {Element|null} element 判定対象（通常は document.activeElement）
   * @returns {boolean} Spaceを部品に譲る要素ならtrue
   */
  function isSpaceYieldedElement(element) {
      return isSpaceOperatedInputElement(element) || isToggleButtonElement(element);
  }
  ```
  * `HTMLButtonElement`は関数の中でだけ参照する（モジュールの最上位でDOMに触れない。`test/core/ToolRules.test.js`が`InputTracker.js`を間接にimportするため）。
* **呼び出しの差し替え**（`InputTracker`クラスにはロジックを足さない）：`#handleSpaceKeyDown`の条件`isTextInputElement(document.activeElement) || isSpaceOperatedInputElement(document.activeElement)`と、`handleKeyUp`の条件`!isTextInputElement(document.activeElement) && !isSpaceOperatedInputElement(document.activeElement)`の`isSpaceOperatedInputElement`を`isSpaceYieldedElement`に置き換える（2か所のみ）。JSDocの説明（「スペースで操作する入力欄（…checkbox・color）」）も「Spaceを部品に譲る要素（`isSpaceYieldedElement`。`checkbox`・`color`の`input`とON/OFFのボタン）」へ改める。
  * 結果：ON/OFFのボタンにフォーカスがあるとき、`keydown`の`Space`はパンせず`preventDefault()`もしない・押下状態にしない。`keyup`でも`preventDefault()`しない → ブラウザ標準のボタンの操作（`Space`の解放で`click`）が起き、ON/OFFが切り替わる。
* **`KeyboardShortcuts.js`は手順を変えない**：手順4は`isSpaceOperatedInputElement`（`input`の`checkbox`・`color`）のままとし、ON/OFFのボタンは対象に入らない → `Ctrl`なしのショートカットはON/OFFのボタンにフォーカスがあっても働く（ツールバーの他のボタンと同じ）。変更はコメントのみ（「チェックボックス・色の欄」→「`type`が`checkbox`・`color`の`input`（色の欄）」）。
* `isSpaceOperatedInputElement`・`isTextInputElement`の働き・export・対象の`type`の一覧（`checkbox`・`color`）は変えない。`SPACE_OPERATED_INPUT_TYPES`のJSDocの「現在、これらのtypeのinput要素はプロパティパネル以外に存在しない」は実態（`color`はオプションバーの色の欄だけ、`checkbox`は画面に無いが`type`別の規則として残す）へ改める。
* 表のマスの結果（実装後の動き）：
  | フォーカス | `Space` | `Ctrl`なし | `Ctrl`付き | 決まる箇所 |
  | --- | --- | --- | --- | --- |
  | 太さの欄（`number`） | 欄の入力 | 働かない | 働かない | `isTextInputElement`（変えない） |
  | 色の欄（`color`） | ピッカーを開く | 働かない | 働く | `isSpaceYieldedElement`（`InputTracker`）／手順4の`isSpaceOperatedInputElement`（変えない） |
  | ON/OFFのボタン | 押す操作（切り替わる） | 働く | 働く | `isSpaceYieldedElement`（新）／手順4の対象外 |
  | 重なり順のボタン | スペースパンの扱い（押されない） | 働く | 働く | 変えない（`aria-pressed`を持たない） |
* DOMの型に依存するため自動テストの対象外とし、テストプレイで確かめる。
* 色の欄の`keydown`で確定する働き（`onColorEditEnd`）、押した直後に`disabled`になったボタンにフォーカスが残る場合の扱い（専用のフォーカス制御を足さない）は変えない。

### 要件7: UI部品と配線の分け方（まとまりごとにUI部品1つ・配線ブロック1つ）
* **UI部品（`palette/`。DOM操作専任・importなし）**：
  * `js/palette/OptionBarStyleGroup.js`（クラス`OptionBarStyleGroup`。旧`PropertyShapeSection.js`の作り替え）：ルート要素`#option-style-group`。ルート要素内の`querySelector('#id')`で`#option-stroke-toggle`・`#option-stroke-color`・`#option-stroke-color-frame`・`#option-fill-toggle`・`#option-fill-color`・`#option-fill-color-frame`・`#option-stroke-width`の7要素を解決する。
    * 公開メソッド：`render(view)`（`StylePanelView`）。
    * コールバック6つ（すべて関数でなければ`Error`）：`onStrokeToggle()`・`onFillToggle()`・`onStrokeWidthChange(value)`（戻り値`false`で書き戻し）・`onColorInput(target, value)`・`onColorChange(target, value)`・`onColorEditEnd()`。typedef名`OptionBarStyleGroupActions`。
    * 要素が1つでも欠ければ`console.warn('OptionBarStyleGroup: スタイルのまとまりの要素が見つかりません。配線しません。')`して配線しない（以後の`render`は何もしない）。`Error`の文言は`OptionBarStyleGroup: actions.${name}は関数である必要があります。`（対象の名前だけを改め、形は旧文言のまま）。
    * typedef：`OptionBarColorNote`（`'' | 'mixed' | 'unsupported'`）・`OptionBarColorView`（旧`PropertyColorView`と同じ4項目）・`StylePanelView`（`edit/StylePanelRules.js`との二重定義。タスク4の時点では今の形（`source`・`selectedCount`を含む）で写し、タスク7で両方から2項目を消す）。
    * 定数：`COLOR_TITLE_TEXT`（要件3の表。凍結）・`STROKE_WIDTH_MIXED_PLACEHOLDER`（`'混在'`）。
  * `js/palette/OptionBarOrderGroup.js`（クラス`OptionBarOrderGroup`。旧`PropertyOrderSection.js`の作り替え）：ルート要素`#option-order-group`。対応表`ORDER_BUTTONS`のidを`#option-bring-to-front`・`#option-bring-forward`・`#option-send-backward`・`#option-send-to-back`に改める（`key`・`action`は同じ）。コールバック4つ（`onBringToFront`・`onBringForward`・`onSendBackward`・`onSendToBack`。typedef名`OptionBarOrderGroupActions`）、typedef`ShapeOrderAvailability`（`edit/ShapeOrderEditor.js`との二重定義。形は変えない）、`render(view)`・`console.warn`（`OptionBarOrderGroup: 重なり順のまとまりの要素が見つからないため、配線しません。`）・`Error`（`OptionBarOrderGroup: actions.${action}は関数である必要があります。`）の契約は旧と同じ。
  * 旧`js/palette/PropertyShapeSection.js`・`js/palette/PropertyOrderSection.js`は削除する（タスク6）。
* **配線（`js/main.js`）**：
  * import：`PropertyShapeSection`・`PropertyOrderSection`のimportを`OptionBarStyleGroup`（`./palette/OptionBarStyleGroup.js`）・`OptionBarOrderGroup`（`./palette/OptionBarOrderGroup.js`）に置き換える。
  * `// 7.7. オプションバー（スタイルのまとまり）配線`：`shapeStyleEditor`の生成（今のまま）、`optionBarStyleGroup = new OptionBarStyleGroup(document.getElementById('option-style-group'), { onStrokeToggle: () => shapeStyleEditor.toggleStrokeEnabled(), onFillToggle: () => shapeStyleEditor.toggleFillEnabled(), onStrokeWidthChange: (text) => shapeStyleEditor.setStrokeWidth(text), onColorInput: …previewColor, onColorChange: …commitColor, onColorEditEnd: …finishColorPreview })`、`syncOptionBarStyleGroup()`（`optionBarStyleGroup.render(shapeStyleEditor.getPanelView())`）を`model.onChange`へ登録。
  * `// 7.8. オプションバー（重なり順のまとまり）配線`：`shapeOrderEditor`の生成・`performShapeOrder`（今のまま）、`optionBarOrderGroup = new OptionBarOrderGroup(document.getElementById('option-order-group'), {…performShapeOrder(ShapeOrderOperation.…)})`、`syncOptionBarOrderGroup()`（`optionBarOrderGroup.render(shapeOrderEditor.getAvailability())`）を`model.onChange`へ登録。
  * 起動時の同期：`syncPropertyShapeSection()`・`syncPropertyOrderSection()`の呼び出しを`syncOptionBarStyleGroup()`・`syncOptionBarOrderGroup()`へ（位置は今と同じ）。
  * ブロックのコメント：「段を足すときは…」を「まとまりを足すときは、まとまりごとにこのブロックと同じ形のブロックを足す（既存のまとまりの配線は変えない）」へ。`inputTracker.isDragging()`を見ない理由の参照（3章13.）は残す。
* **表示の同期は今の経路のみ**：`model.onChange` → `syncOptionBarStyleGroup`／`syncOptionBarOrderGroup` → `getPanelView()`／`getAvailability()` → `render(view)`。起動時に1回。機能専用の同期経路は足さない。
* 重なり順のボタンとキーは同じ`performShapeOrder`を呼ぶ（同一経路）。ドラッグ中の不受理・`disabled`で始まる・`ShapeOrderEditor`／`ShapeOrderRules`のロジックは変えない。
* 精度のPhase用の空の部品・まとまりは作らない。数値の欄を足すときは、`index.html`に`<div class="toolbar-group">`、`palette/`にそのまとまりのUI部品、`main.js`にそのまとまりのブロックを足すだけで、既存のまとまり・UI部品・ブロックを変えない（置き場所は精度のPhaseのDIRで決める）。

### 要件8: なくすものと、コメント・名前の整理
* なくすもの：`#window-property-panel`のDOMとCSS、要件1に列挙したCSS、`js/palette/PropertyShapeSection.js`・`js/palette/PropertyOrderSection.js`、`property-`・`order-`のid。
* 存在しない`.disabled`クラスに触れるコメント（持ち越し事項の3か所）：`index.html`の`#window-property-panel`のCSSコメント（ウィンドウごと削除）、`js/palette/PropertyShapeSection.js`のJSDoc（作り替えで消える。新ファイルに`.disabled`の記述を書かない）、`js/palette/CanvasPalette.js`のクラスJSDocの「（見た目は既存の`.tool-btn:disabled`。`.disabled`クラスは使わない）」→「（見た目は既存の`.tool-btn:disabled`）」（コメントのみ）。
* コメント・JSDocの「プロパティパネル」「パネル」「段」「チェックボックス」の洗い出し（計画時に`js/`全体を検索。「図形固有のプロパティ名」「共通プロパティ」等の無関係な「プロパティ」は対象外）：
  * `js/main.js`：470行付近`// 7.7.`ブロックのコメント、488行付近`syncPropertyShapeSection`のJSDoc、499行付近`// 7.8.`ブロックのコメント、506行付近`performShapeOrder`のJSDoc（「「重なり順」のボタン」→「オプションバーの重なり順のボタン」）、530行付近`syncPropertyOrderSection`のJSDoc、682〜688行付近の起動時の同期のコメント。→ タスク6で改める。
  * `js/edit/StylePanelRules.js`：先頭の責務定義（「プロパティパネルの「図形」の段に出す値」）、`STROKE_WIDTH_MIN`／`MAX`のJSDoc（「パネルの太さの入力」）、`StylePanelColorView`の説明（「中間表示（`indeterminate`）」→「そろっていない（ボタンの`aria-pressed="mixed"`）」）、同じtypedefの`colorNote`の説明（30行「`@property {ColorNote} colorNote - 色の欄の横の表示`」→「色の欄に重ねる表示（混在・表示できない色の覆いと斜線、`title`）の種類」。作り替え後は欄の横に文字を置かないため）、`StylePanelView`の「パネルに出す内容（`palette/PropertyShapeSection.js`の同名typedef…）」→「オプションバーのスタイルのまとまりに出す内容（`palette/OptionBarStyleGroup.js`の同名typedef…）」、`RememberedColors`・`resolveColorView`・`newShapeColorView`・`buildStylePanelView`の「パネル」。先頭の責務定義に「識別子の「Panel」は表示の部品一般を指す名前として残す」旨を1行で明記（責務定義は3行以内を保つ）。→ タスク7で改める（同じファイルを変えるため）。
    * 先頭の責務定義への切り替えの規則（`nextEnabledOnToggle`）の追加は、関数を足すタスク1で行う（タスク1の完了時点で責務定義と実態を食い違わせないため）。タスク1では今の1行目の担う内容の列挙の末尾に「・ON/OFFのボタンを押したときの次の有無の規則」を足すだけとし、「プロパティパネルの「図形」の段」の文言はタスク7まで変えない。タスク7で最終形（3行）を次のとおりにする：
      1. `責務: オプションバーのスタイルのまとまりに出す値の算出（そろっている値・混在・無効・表示する色）と、色の文字列の表示用の変換・線の太さの入力の受理・ON/OFFのボタンを押したときの次の有無の規則を担う。`
      2. `状態を持たずDOMに触れない。importを持たない。`（今のまま）
      3. `識別子の「Panel」は表示の部品一般を指す名前として残す（実体はオプションバー）。`
  * 旧`js/palette/PropertyShapeSection.js`の「色の欄の横の表示」（7行・16行・42行・232行・234行）・「中間表示＝混在」（14行）・`indeterminate`は、作り替え後の表示（色の欄に覆いと斜線を重ねる・ON/OFFのボタンの`aria-pressed="mixed"`）と合わない。旧ファイルはタスク6で削除されるが、タスク4で下敷きにする際に新ファイル（`OptionBarStyleGroup.js`）へこれらの文言を写さない（`OptionBarColorNote`は「色の欄に重ねる表示（覆いと斜線、`title`）の種類」、`OptionBarColorView`の`enabled`の`null`は「そろっていない（`aria-pressed="mixed"`）」、`COLOR_TITLE_TEXT`は「色の欄の`title`の文言」、色の欄を反映するメソッドのJSDocは「色の欄とそれを包む要素の`data-color-note`・`title`」と書く）。→ タスク4。
  * 上記のほか、`js/`全体を「横の表示」「中間表示」「`indeterminate`」「混在と表示」で検索した結果、作り替え後の表示と合わなくなる記述は`js/edit/StylePanelRules.js`（25行・30行）と旧`js/palette/PropertyShapeSection.js`だけ（`StylePanelRules.js`19行の`ColorNote`の「色の欄の表示の補足」は作り替え後も事実のため残す。`CanvasManager.js`・`InputTracker.js`の「縦横」「横スクロール」は無関係）。
  * `js/edit/ShapeStyleEditor.js`：先頭の責務定義（「プロパティパネルの変更」「パネルが覚えている色」）、`#rememberedColors`のJSDoc、クラスJSDoc（「プロパティパネルの変更を反映する」「パネルの部品がフォーカスを失う」「`getPanelView()`は…」）、`getPanelView`のJSDoc（「パネルに出す内容」）。クラスJSDocに「識別子の「Panel」（`getPanelView`・`StylePanelRules`等）と「パネルが覚えている色」は表示の部品一般を指す名前として残す（実体はオプションバー）」を1行で明記。→ タスク8。
  * `js/edit/ShapeOrderEditor.js`：9行`palette/PropertyOrderSection.js`→`palette/OptionBarOrderGroup.js`。→ タスク8。
  * `js/edit/ShapeOrderRules.js`：9行`PropertyOrderSection`の対応表→`OptionBarOrderGroup`の対応表。→ タスク8。
  * `js/core/InputTracker.js`：133〜181行付近（`TEXT_INPUT_TYPES`のJSDocの「（checkbox・colorはisSpaceOperatedInputElementで別に扱う。）」は事実のため残す、`SPACE_OPERATED_INPUT_TYPES`のJSDocの「プロパティパネル以外に存在しない」を改める）。`handleKeyUp`・`#handleSpaceKeyDown`のJSDocはタスク3で改める。→ 「プロパティパネル」の1行はタスク9。
  * `js/core/KeyboardShortcuts.js`：3行（責務定義）・155行（手順4のJSDoc）・180行（手順4のコメント）の「チェックボックス・色の欄」→「`type`が`checkbox`・`color`の`input`（色の欄）」。ON/OFFのボタンは手順4の対象外であることを手順4のJSDocに1文足す。→ タスク9（コメントのみ）。
  * `js/palette/PaletteLauncher.js`：29行「ツールパレット・プロパティパネルには×が無い」→「ツールパレットには×が無い」。→ タスク9（コメントのみ）。
  * `js/palette/CanvasPalette.js`：102行の`.disabled`の記述（上記）。→ タスク9（コメントのみ）。
  * `js/core/VectorModel.js`：検索の結果、プロパティパネル・パネルに触れる記述は無い → 変更しない。
  * `test/edit/ShapeStyleEditor.test.js`の先頭の責務定義の「プロパティパネルの変更の反映」→「オプションバーでの変更の反映」（コメントのみ。ケースは変えない）。→ タスク8。
* 改名しない識別子：`StylePanelRules`・`buildStylePanelView`・`StylePanelView`・`StylePanelColorView`・`PanelNewShapeStyle`・`RememberedColors`・`getPanelView`・`rememberedColors`・テストファイル名。

### 要件9: 自動テストとテストプレイ
* 追加するテスト（既存のケースは要件5の2件以外変えない）：
  * `test/edit/StylePanelRules.test.js`：`describe('nextEnabledOnToggle')`に、ON（`true`）→`false`、OFF（`false`）→`true`、そろっていない（`null`）→`true`の3ケース（importに`nextEnabledOnToggle`を足す）。
  * `test/edit/ShapeStyleEditor.test.js`（既存の`setup`・`dump`・`countUndo`・`makeRect`・`makeLine`・`makeEllipse`を使う。新しい補助関数を足す場合はJSDoc付き）：
    1. 選択なし：`toggleStrokeEnabled()`が`true`、直前に使った値の`strokeEnabled`が`true`→`false`、もう一度で`true`。`toggleFillEnabled()`で`fillEnabled`が`false`→`true`。図形（`dump`）・履歴（`canUndo() === false`）は変わらない。
    2. 単一選択（線あり`#ff0000`の矩形）：`toggleStrokeEnabled()`で`strokeColor`が`null`、`countUndo`で1件、Undoで`#ff0000`に戻りRedoで`null`。もう一度切り替えると表示中の色（`#ff0000`）が入る。
    3. 複数選択でそろっている（2つとも線あり）→ 両方`null`、履歴1件。
    4. 複数選択でそろっていない（線あり`#0000ff`と線なし）→ 両方とも線ありになり、色は表示中の色（最も手前の線ありの図形の色）。履歴1件。直前に使った値の`strokeEnabled`が`true`。
    5. 塗れる形が無い選択（直線だけ）：`toggleFillEnabled()`が`false`、図形・履歴・直前に使った値を変えない。
    6. 塗れる形と塗れない形が混ざった選択：(a) 矩形`fillColor: null`＋直線`fillColor: '#abcdef'` → 塗りは矩形だけで決まり（OFF）、切り替えで矩形に塗りが入り（表示中の塗りの色）、直線の`fillColor`は`'#abcdef'`のまま。(b) 矩形`fillColor: '#00ff00'`＋直線`fillColor: null` → ON と判定され、切り替えで矩形が`null`、直線は`null`のまま。各1件。
    7. ピッカー操作中（`previewColor('stroke', '#123456')`の後、確定前）に`toggleStrokeEnabled()` → 先にピッカーの分が確定されて履歴2件（Undo1回で線が`#123456`の状態、2回で元の色）。`console.warn`は出ない（`t.mock.method(console, 'warn', () => {})`で抑止し呼ばれた回数0を確かめる）。
* `node --test`は各タスクの完了時に`fail 0`。
* DOMの部品（`OptionBarStyleGroup`・`OptionBarOrderGroup`）・`index.html`・`main.js`の配線・要件6の判定（`isToggleButtonElement`・`isSpaceYieldedElement`）は自動テストの対象外（テストプレイで確かめる）。
* テストプレイの確認項目は5章に列挙する。

### 要件10: 開発資料への記載
* 下記「開発資料の更新予定」に列挙し、最終タスク（タスク11）で反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./index.html` - ツールバーのオプションバー（スタイル・重なり順の2つのまとまり）のマークアップとCSS、プロパティパネルの削除
    *   `./js/palette/` - オプションバーのまとまりごとのUI部品（`OptionBarStyleGroup`・`OptionBarOrderGroup`。旧`PropertyShapeSection`・`PropertyOrderSection`の作り替え・改名）
    *   `./js/edit/` - 切り替えの規則（`StylePanelRules.nextEnabledOnToggle`）と切り替えの手順（`ShapeStyleEditor.toggleStrokeEnabled`・`toggleFillEnabled`）、`StylePanelView`の`source`・`selectedCount`の削除
    *   `./js/core/` - `Space`を部品に譲る判定（`InputTracker.js`のモジュール関数`isToggleButtonElement`・`isSpaceYieldedElement`）、コメント（`KeyboardShortcuts.js`）
    *   `./js/main.js` - 配線ブロック`// 7.7.`・`// 7.8.`の差し替え
    *   `./test/edit/` - `StylePanelRules.test.js`・`ShapeStyleEditor.test.js`
*   **関連する論理クラス**: `OptionBarStyleGroup`（新・UI部品）、`OptionBarOrderGroup`（新・UI部品）、`ShapeStyleEditor`（手順）、`StylePanelRules`（規則。関数群）、`ShapeOrderEditor`・`ShapeOrderRules`（変更なし。コメントのみ）、`InputTracker`（モジュール関数の追加と呼び出しの差し替えのみ）、`KeyboardShortcuts`（コメントのみ）、`CanvasPalette`・`PaletteLauncher`（コメントのみ）

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`edit/`・`io/`・`palette/`をimportしない。`edit/ShapeStyleEditor`は例外として`edit/StylePanelRules`のみをimportする（`StylePanelRules`はimportを持たない）。`edit/ShapeOrderEditor`は`edit/ShapeOrderRules`のみをimport。
*   **同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`等）のみ。機能専用の再描画・同期処理を足さない。スタイルの表示は`model.onChange` → 同期関数 → `shapeStyleEditor.getPanelView()` → UI部品の`render(view)`。重なり順は`model.onChange` → 同期関数 → `shapeOrderEditor.getAvailability()` → `render(view)`。どちらも起動時に1回呼ぶ。
*   **`palette/`**：自己完結するUI部品。DOM操作専任でimportを持たず、`VectorModel`・図形データ・選択状態・`ShapeStyleEditor`・`ShapeOrderEditor`・規則・判定に関与しない。受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない（`render`は何もしない）。文言（「混在」等）はUI部品のファイルが唯一の定義箇所。文字は`textContent`・属性で設定する。
*   **`edit/`**：DOMに触れない。操作モードを知らない。`StylePanelRules`は状態なし・DOMなし・importなしの規則（`toColorInputValue`・`parseStrokeWidthInput`・`buildStylePanelView`）。`ShapeStyleEditor`は反映の範囲・履歴の記録・色の欄のピッカー操作中の扱い・パネルが覚えている色を担う手順（`model`は`getShapes`・`isSelected`・`getNewShapeStyle`・`updateNewShapeStyle`・`updateShapeStyles`のみ使う。`editRecorder`は注入。`try/catch`なし・ドラッグ中の判定なし）。図形への書き換えは`model.updateShapeStyles`へ渡すだけ。**`getPanelView()`は覚えている色を更新するため純粋な照会ではない**（`main.js`の表示の同期と`ShapeStyleEditor`の内部以外から呼ばない）。直前に使った値を更新するのは`ShapeStyleEditor`だけ。typedef`StylePanelView`は`StylePanelRules.js`とUI部品の二重定義、`ShapeOrderAvailability`は`ShapeOrderEditor.js`とUI部品の二重定義（形を変えるときは両方を揃える）。
*   **反映の範囲・履歴の単位（3章13.）**：選択中の図形があるとき、変えた項目だけを反映（線は選択中の全図形、塗りは塗れる形だけ）し、直前に使った値の同じ項目を更新。選択中の図形が無いときは直前に使った値だけを変える（履歴に記録しない。読み込み中もこちら）。「あり」にしたときは表示中の色を入れる。塗れる形が無い選択での塗りの変更は受理しない（`false`）。有無の変更1回・太さの確定1回で1件。色の欄はピッカーを開いてから閉じるまでを1件（確定の契機：`change`・色の欄の`blur`・`keydown`・`ShapeStyleEditor`の他の変更メソッドの冒頭）。太さは1以上100以下の整数のみ受理し、受理しなければ欄を書き戻す。太さの欄はフォーカスがある間は書き換えず、フォーカスが外れたとき最後の表示へ書き戻す。混在は文字列の完全一致で判定。
*   **ドラッグ中のスタイルの変更は拒まない**：`main.js`のコールバックも`ShapeStyleEditor`も`inputTracker.isDragging()`を見ない（理由は開発資料3章13.）。
*   **重なり順（3章14.）**：ボタンとキー（`Home`・`PageUp`・`PageDown`・`End`）は`main.js`の`performShapeOrder(operation)`のみを呼ぶ（ドラッグ中は不受理）。押せる/押せないの判定は`ShapeOrderRules.canReorderSelected`の1か所。ボタンは`disabled`で始まる。
*   **`InputTracker`**：`Space`（スペースパン）のみを解釈し、ショートカットは解釈しない。テキスト入力扱いの`input`にフォーカスがあるときはスペースパンもショートカットも働かない。`checkbox`・`color`の`input`では`Space`をパンに使わず`preventDefault()`もしない。判定は`InputTracker.js`のモジュール関数（`isTextInputElement`・`isSpaceOperatedInputElement`。部品のid・クラス名に結びつけず要素の種類と属性で判定）。本Phaseでは判定・計算の規則は状態を持たない関数として切り出し、`InputTracker`には呼び出しと配線だけを足す（DIR 4章）。`isSpaceOperatedInputElement`等は`HTMLInputElement`に依存し`node --test`で確かめられない。`InputTracker.js`の最上位でDOMに触れてはならない（`ToolRules.test.js`が間接にimportする）。
*   **`KeyboardShortcuts`**：キー→操作の対応表と`keydown`の受理判定のみ。画面のボタン・DOMのid・クラス名を知らない。手順4：`ctrl: false`のエントリは`isSpaceOperatedInputElement(document.activeElement)`が真なら実行しない（`Ctrl`付きは実行）。
*   **`main.js`**：初期化と依存の注入のみ。判定ロジックを持たない。ボタンとショートカットは同じ操作関数を呼ぶ（同一経路の原則）。
*   **`index.html`**：スタイルは`<style>`に内包。ツールバーは固定の要素（フロートウィンドウではない。`WindowManager`の管理対象外）、高さ`--toolbar-height`（40px）・1行固定・`overflow: hidden`で、収まらない右側は切れる。項目は`<div class="toolbar-group">`のまとまりごとに足し、既存のまとまりを変えない。ボタンはアイコンのみ（`class="tool-btn icon-btn"`。32×32）、アイコンはマークアップの1か所だけ、説明とショートカットは`title`。ボタン単体の押せない状態は`disabled`属性と`.tool-btn:disabled`のみ。重なり：キャンバス1 → 覆い要素5 → ツールバー・ステータスバー8 → フロートウィンドウ10以上。`WindowManager`は起動時にDOMにある`.float-window`だけを検知する。
*   **自動テスト（`_doc/arch/16_test.md`）**：`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`、`node:test`・`node:assert/strict`のみ、公開APIのみを通す、テストのためにソースを書き換えない、画面の操作や描画のテストは行わない、`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止、補助関数にもJSDoc。`test/edit/ShapeStyleEditor.test.js`は実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`ShapeStyleEditor`を組み合わせ、`model.onChange(() => editor.getPanelView())`で`main.js`と同じ呼び方にする（許された例外）。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従い、JSDocを読めば分かること（引数・private・typedefの中身・定数の値）は書かず、境界・流れ・誰が呼ぶか・設計判断の理由・発注者の決定・やらないことを書く。反映はタスク11）
*   **`PROJECT_ARCHITECTURE.md` 1章**：
    *   フォルダ構造の`palette/`：`PropertyShapeSection.js`・`PropertyOrderSection.js`の2行を`OptionBarStyleGroup.js # ツールバーのオプションバーの「スタイル」のまとまり。まとまりごとに1ファイル`・`OptionBarOrderGroup.js # オプションバーの「重なり順」のまとまり`へ。
    *   `index.html`のコメント：「上端にツールバー」を「上端にツールバー（左に操作のボタン、続けてオプションバー）」へ。
    *   「存在しないもの」：「プロパティパネルの「頂点」の段（精度のPhase）」→「頂点の座標・図形の大きさの数値の欄（精度のPhase。置き場所は精度のPhaseのDIRで決める）」。「プロパティパネル（Phase 07-02でツールバーのオプションバーへ移してなくした）」「オプションバーの「選択中：n個」「次に描く図形」の表示（07-02でなくした。選択の有無はキャンバス上のハンドルで見分ける）」を足す。
    *   フォルダ分割の方針の`palette/`：「（プロパティパネルは段ごとに1つのUI部品。ウィンドウ自体を配線するクラスは無い）」→「（ツールバーのオプションバーはまとまり（`.toolbar-group`）ごとに1つのUI部品。ツールバー自体を配線するクラスは無い）」。`edit/`：「選択中の図形のスタイルの変更（プロパティパネル）」→「（オプションバー）」。
*   **2章**：「塗れる形」の「Phase 06-02のプロパティパネル（`StylePanelRules`・`ShapeStyleEditor`）が使う」→「オプションバーのスタイルの表示と変更（…）が使う」。「新しく描く図形のスタイル」の「**更新**：パネルの変更（`ShapeStyleEditor`）からだけ」→「オプションバーでの変更（`ShapeStyleEditor`）からだけ」。
*   **3章冒頭「同期の経路」**：「プロパティパネルの表示は`model.onChange`で同期する」→「オプションバー（スタイル・重なり順のまとまり）の表示は…」。
*   **3章1.「読み込み完了前の操作」**：「プロパティパネルは読み込み中も操作でき」→「オプションバーは読み込み中も操作でき（ツールバーは覆いより手前）」。
*   **3章3.「キーボード操作」の入力欄の規則**：ON/OFFのボタン（`aria-pressed`を持つ`button`）にフォーカスがあるときは`Space`をパンに使わず`preventDefault()`もしない（ボタンの標準の操作で切り替わる）が、`Ctrl`なしのショートカットは働く（`checkbox`・`color`の`input`とは異なる）。判定は`InputTracker.js`の非公開のモジュール関数`isSpaceYieldedElement`（`isSpaceOperatedInputElement`＋`isToggleButtonElement`）。`KeyboardShortcuts`の手順4は`isSpaceOperatedInputElement`のまま。2026-11-13 発注者の決定。
*   **3章6.**：記録する操作の「重なり順の変更（「重なり順」の段のボタン…）」→「（オプションバーの重なり順のボタン…）」。「プロパティパネルの変更（`ShapeStyleEditor`。13.）：チェックボックス・太さは…」→「オプションバーのスタイルの変更（…）：ON/OFFのボタン・太さは…」。記録しない操作の「選択中の図形が無いときのパネルの変更」→「オプションバーの変更」。
*   **3章13.**（見出しを「オプションバー（スタイルのまとまり） (`palette/OptionBarStyleGroup.js` ⇄ `main.js` → …)」へ）：
    *   ツールバーのオプションバーの「スタイル」のまとまり（`#option-style-group`）で変えること。「プロパティ」ウィンドウ（`#window-property-panel`）の記述を除く。
    *   モジュールの分担：DOM＝`OptionBarStyleGroup`。typedef`StylePanelView`の二重定義先を`OptionBarStyleGroup.js`へ。識別子の「Panel」（`StylePanelRules`・`getPanelView`・「パネルが覚えている色」）は改名せず、表示の部品一般を指す名前として残した（規則と手順を変えない方針・テストを書き換えないため）。
    *   表示の流れ：`syncOptionBarStyleGroup()` → `optionBarStyleGroup.render(view)`。
    *   表示の規則：線・塗りのON/OFFはアイコンのボタンの3つの表示（OFF＝通常、ON＝押し込み（`.tool-btn.active`と同じルール）、そろっていない＝破線の枠）。`aria-pressed`（`"true"`／`"false"`／`"mixed"`）が状態の唯一の持ち方で、見た目のCSSはその値で決める。色がそろっていない・表示できない色のときは、色の欄の上に**グレーの地に赤の斜線**を重ね（2つの状態は見た目で区別せず`title`の`（混在）`／`（表示できない色）`で区別）、文字の「混在」「表示できない色」は置かない。太さの混在は今のまま（欄を空にして`placeholder`）。塗れない形だけの選択ではON/OFFのボタンと塗りの色の欄が`disabled`（ボタンの表示はOFFと同じ）。「選択中：n個」「次に描く図形」の表示はなく、`StylePanelView`の`source`・`selectedCount`も削除した。
    *   ON/OFFのボタンを押したときの規則：ONならOFF、OFFまたはそろっていないならON（`StylePanelRules.nextEnabledOnToggle`）。`ShapeStyleEditor.toggleStrokeEnabled`・`toggleFillEnabled`がピッカー操作中の記録を確定してから`getPanelView()`の有無に規則を当て、`setStrokeEnabled`・`setFillEnabled`と同じ`#setEnabled`で反映する（反映の範囲・履歴1件・直前に使った値・塗れる形が無い選択の不受理は同じ）。`setStrokeEnabled`・`setFillEnabled`は公開のまま残す（Phase 07-04の`D`キー・スポイトで使う見込み）。
    *   履歴の単位：「チェックボックス1回」→「ON/OFFのボタン1回」。
    *   「ドラッグ中のパネルの変更は拒まない」の段落：「パネル」→「オプションバー」（中身は変えない）。
    *   発注者の決定（2026-11-13）に追記：ON/OFFのボタン化と3つの表示（そろっていない＝破線の枠）、押したときの結果、混在・表示できない色のグレーの地に赤の斜線、選択の対象の表示をなくすこと、アイコン（仮）。
    *   「2段構成（段の足し方）」→「まとまりごとの分け方」：オプションバーはまとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持つ。各UI部品は自分のまとまりの要素をルート要素とし、要素idは接頭辞`option-`。精度のPhaseで数値の欄を足すときは、まとまり・UI部品・ブロックを足すだけで既存のものを変えない（置き場所は精度のPhaseのDIRで決める）。
    *   「やらないこと」：「「頂点」の段」→「頂点の座標・図形の大きさの数値の欄（精度のPhase）」。
*   **3章14.**：見出しの`index.html`の`#property-order-section`→`#option-order-group`。「プロパティパネルの「重なり順」の段の4ボタン」→「オプションバーの重なり順のまとまりの4ボタン」。表示＝`OptionBarOrderGroup`、二重定義先を`OptionBarOrderGroup.js`へ。`syncPropertyOrderSection`→`syncOptionBarOrderGroup`、`propertyOrderSection`→`optionBarOrderGroup`。規則の「操作は常にプロパティパネルの段に置く」→「操作は常にオプションバーの重なり順のまとまりに置く」。
*   **4章の一覧**：モジュールのファイルの表自体は変更なし（`palette/`の行で足りる）。本文（`_doc/arch/`）を下記のとおり更新する。
*   **`_doc/arch/01_index_html.md`**：ツールバーの「保っているid」に`#option-style-group`・`#option-stroke-toggle`・`#option-stroke-color`・`#option-stroke-color-frame`・`#option-fill-toggle`・`#option-fill-color`・`#option-fill-color-frame`・`#option-stroke-width`・`#option-order-group`・`#option-bring-to-front`・`#option-bring-forward`・`#option-send-backward`・`#option-send-to-back`（UI部品がルート要素内で解決）を足す。「ボタンの見た目」にON/OFFのボタン（`aria-pressed`の3値、押し込みは`.tool-btn.active`のルールのセレクタを共有、破線の枠）を足す。「非活性の表現」から「プロパティパネルも常に操作できる」を除く。「ショートカットの表記」の「「重なり順」の4ボタン」→「オプションバーの重なり順の4ボタン」。「プロパティパネル」「プロパティパネルの2段構成」の項目を削除し、「オプションバー」の項目を新設（2つのまとまり・並び・接頭辞`option-`、初期値の例外（`aria-pressed="false"`は要件6の判定のため・重なり順の`disabled`）、色の欄を包む`.option-color-frame`と`data-color-note`・`::after`の覆いと斜線（`pointer-events: none`、幅を変えない）、太さの欄だけ`user-select: text`、1280px幅で約610pxの見積もり・切れる順は右から）。「ウィンドウの既定の位置」「フロートウィンドウの`×`ボタン」からプロパティパネルを除く。
*   **`_doc/arch/02_main.md`**：配線ブロックの表の`// 7.7.`・`// 7.8.`を「オプションバー（スタイルのまとまり。`ShapeStyleEditor`・`OptionBarStyleGroup`の生成、`syncOptionBarStyleGroup`と`model.onChange`への登録）。まとまりを足すときはこの後にまとまりごとのブロックを足す」「オプションバー（重なり順のまとまり。`ShapeOrderEditor`・`OptionBarOrderGroup`の生成、`performShapeOrder`、`syncOptionBarOrderGroup`…）」へ。注入の一覧の`PropertyShapeSection`行→`OptionBarStyleGroup`（`#option-style-group`の要素・`onStrokeToggle`/`onFillToggle`→`toggleStrokeEnabled`/`toggleFillEnabled`、他4つは今のまま）、`PropertyOrderSection`行→`OptionBarOrderGroup`（`#option-order-group`）。主な関数の`syncPropertyShapeSection`・`syncPropertyOrderSection`を改名。「プロパティパネルの同一経路」→「オプションバー（スタイル）の同一経路」。押せる/押せない状態の「「重なり順」の4ボタン」・`syncPropertyOrderSection`を改める。起動時の同期の`syncPropertyShapeSection()`を改める。行数（タスク6完了時に実測して記録）。
*   **`_doc/arch/06_InputTracker.md`**：「スペースパンの入力欄の規則」を、`#handleSpaceKeyDown`・`handleKeyUp`が`isTextInputElement`と非公開のモジュール関数`isSpaceYieldedElement`（`isSpaceOperatedInputElement`または`isToggleButtonElement`＝`aria-pressed`を持つ`button`）で判定する形へ（「チェックボックスの切り替えは`keyup`で起きる」→「ボタン・チェックボックスの操作は`Space`の解放で起きる」）。exportの`isSpaceOperatedInputElement`の説明の「パネルの部品のidに」→「部品のidに」。2つの新しい関数はexportしない・DOMの型に依存し`node --test`で確かめられないことを足す。
*   **`_doc/arch/07_KeyboardShortcuts.md`**：「`Space`で操作する入力部品（チェックボックス・色の欄）」→「`type`が`checkbox`・`color`の`input`（色の欄）」。ON/OFFのボタン（`aria-pressed`を持つ`button`）は手順4の対象外で、`Ctrl`なしのショートカットが働くこと（発注者の決定）を足す。
*   **`_doc/arch/08_HistoryManager.md`**：呼び出し元の「`ShapeStyleEditor`（プロパティパネルの変更。…）」→「（オプションバーのスタイルの変更。…）」。
*   **`_doc/arch/13_palette.md`**：冒頭の「ツールバー・ステータスバーは`index.html`の静的な要素で、配線は`main.js`（`palette/`の部品は無い）」→「ツールバー・ステータスバーは`index.html`の静的な要素。ツールバーの操作のボタンとステータスバーの配線は`main.js`、オプションバーのまとまりは`palette/`のUI部品（`OptionBarStyleGroup`・`OptionBarOrderGroup`）」。`PropertyShapeSection.js`・`PropertyOrderSection.js`の項目を`OptionBarStyleGroup.js`・`OptionBarOrderGroup.js`へ置き換える（ルート要素、コールバック（`onStrokeToggle`・`onFillToggle`ほか）、`aria-pressed`の写し方、`data-color-note`の写し方、`title`の文言の唯一の定義箇所（`COLOR_TITLE_TEXT`）、太さの欄の規則、二重定義）。「段の足し方」→「まとまりの足し方」。「ツールバーの位置づけ」に「続けてオプションバー（選択中の図形・新しく描く図形のスタイルと重なり順）」を足す。
*   **`_doc/arch/14_edit.md`**：`StylePanelRules`の説明の「プロパティパネルに出す値」→「オプションバーに出す値」、公開に`nextEnabledOnToggle`を足す、`StylePanelView`に`source`・`selectedCount`が無いこと（07-02で削除）。`ShapeStyleEditor`の説明の「プロパティパネル」→「オプションバー」、公開メソッドに`toggleStrokeEnabled`・`toggleFillEnabled`、呼び出し元を`OptionBarStyleGroup`経由・`syncOptionBarStyleGroup`へ。`ShapeOrderEditor`の呼び出し元の`syncPropertyOrderSection`→`syncOptionBarOrderGroup`、二重定義先を`palette/OptionBarOrderGroup.js`へ。
*   **`_doc/arch/16_test.md`**：`StylePanelRules.test.js`の検証範囲に`nextEnabledOnToggle`（3ケース）、`ShapeStyleEditor.test.js`に切り替えのメソッド（選択なし・単一・複数のそろっている／そろっていない・塗れる形が無い・混在・履歴1件・ピッカー操作中の確定）を足す。「テストできない箇所（07-02の追加）」：`OptionBarStyleGroup`・`OptionBarOrderGroup`（DOM）、`main.js`のオプションバーの配線、`index.html`のオプションバー、`InputTracker.js`の`isToggleButtonElement`・`isSpaceYieldedElement`と`Space`の扱い。「書き換えた既存のテスト（07-02）」：`StylePanelRules.test.js`の2ケース（ケース名と理由は要件5）。既存の記述のうち、なくなったモジュール名（「（06-04の追加）」の`PropertyOrderSection`・「「重なり順」の段」、「（06-02の追加）」の`PropertyShapeSection`・「プロパティパネル」）を新しい名前へ直す（誤った記述になるため）。
*   **`_doc/arch/12_shapes.md`**：22行の`isFillable()`の項目の「Phase 06-02で`edit/StylePanelRules`・`edit/ShapeStyleEditor`（プロパティパネルの塗りの欄）が外から使っており」→「`edit/StylePanelRules`・`edit/ShapeStyleEditor`（オプションバーの塗りのON/OFFのボタンと色の欄。Phase 06-02で追加）が外から使っており」（他の記述は変えない）。
*   **検索の範囲と結果**：`PROJECT_ARCHITECTURE.md`と`_doc/arch/`配下の全ファイル（01〜19）を「プロパティパネル」「パネル」「プロパティ」「`PropertyShapeSection`」「`PropertyOrderSection`」「`property-`」「`#order-`」「の段」「チェックボックス」「`indeterminate`」「混在」「次に描く図形」で検索し直した。プロパティパネル（ウィンドウ・段・チェックボックス・その表示）に触れる記述があるのは、上に列挙した`PROJECT_ARCHITECTURE.md`・`01_index_html.md`・`02_main.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`12_shapes.md`・`13_palette.md`・`14_edit.md`・`16_test.md`だけ。`03_VectorModel.md`・`15_io.md`・`18_PointHitRules.md`の一致は「公開プロパティ」「図形固有のプロパティ名」等の無関係な「プロパティ」と、作業データの「混在」の描画順のみ、`04`・`05`・`09`〜`11`・`17`・`19`は一致なし → 変更しない。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する）

## 3. タスクリスト
**各タスク共通の作業**（すべてのタスクで行う）：
* 新設・変更したクラス・メソッド・関数・定数・typedefのJSDoc（`@param`・`@returns`・`@throws`）、注入するコールバックの契約、変更したファイルの先頭の責務定義（3行以内）を確認する。
* タスクの完了時にプロジェクトのルートで`node --test`を実行し、`fail 0`であることと`tests`・`pass`の件数を「4. 詳細作業内容」に記録する。
* タスクの完了後、「4. 詳細作業内容」の該当タスクの欄を記入し、タスクを`[x]`にする。
* 開発資料の記載に影響が出る場合は資料本体を修正せず、2章「開発資料の更新予定」へ追記する。
* 判断に迷った点・目視確認を推奨する箇所・将来の注意点は5章へ追記する。

*   [x] タスク1: 切り替えの規則`nextEnabledOnToggle`の追加とテスト
    *   **対象ファイル** :
        *   `./js/edit/StylePanelRules.js` : 更新（関数の追加と、先頭の責務定義への切り替えの規則の追記のみ）
        *   `./test/edit/StylePanelRules.test.js` : 更新（テストの追加のみ。既存のケースは変えない）
    *   **作業内容** :
        *   2章「要件2」のとおり`export function nextEnabledOnToggle(enabled)`を`parseStrokeWidthInput`の後ろに足す（JSDoc付き）。
        *   先頭の責務定義の1行目の担う内容の列挙の末尾に「・ON/OFFのボタンを押したときの次の有無の規則」を足す（2章「要件8」の`StylePanelRules.js`の項目のとおり。3行のまま。「プロパティパネルの「図形」の段」の文言はタスク7で改めるため、このタスクでは変えない）。他の関数・typedef・コメントはこのタスクでは変えない。
        *   テストの`import`に`nextEnabledOnToggle`を足し、`describe('nextEnabledOnToggle')`で3ケース（`true`→`false`、`false`→`true`、`null`→`true`）を足す。
        *   完了時点で画面の動きは変わらない（まだ使われない）。
*   [x] タスク2: 切り替えのメソッド`toggleStrokeEnabled`・`toggleFillEnabled`の追加とテスト
    *   **対象ファイル** :
        *   `./js/edit/ShapeStyleEditor.js` : 更新（メソッドの追加とimportの追加のみ）
        *   `./test/edit/ShapeStyleEditor.test.js` : 更新（テストの追加のみ。既存のケースは変えない）
    *   **作業内容** :
        *   2章「要件2」のとおり、`import`に`nextEnabledOnToggle`を足し、公開メソッド`toggleStrokeEnabled()`・`toggleFillEnabled()`（`setFillEnabled`の直後）と非公開メソッド`#toggleEnabled(target)`（`#setEnabled`の直前）を足す（JSDoc付き）。既存のメソッド・コメントはこのタスクでは変えない。
        *   2章「要件9」の`ShapeStyleEditor.test.js`の7件（6は(a)(b)の2件に分けてよい）を足す。
        *   完了時点で画面の動きは変わらない（まだ使われない）。
*   [x] タスク3: `Space`を部品に譲る判定の追加（`InputTracker.js`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新（モジュール関数2つの追加と、`#handleSpaceKeyDown`・`handleKeyUp`の条件の差し替え・そのJSDocの修正のみ）
    *   **作業内容** :
        *   2章「要件6」のとおり、`isSpaceOperatedInputElement`の直後に非公開のモジュール関数`isToggleButtonElement`・`isSpaceYieldedElement`を足す（exportしない。JSDoc付き。`HTMLButtonElement`は関数の中でだけ参照）。
        *   `#handleSpaceKeyDown`と`handleKeyUp`の条件の`isSpaceOperatedInputElement(document.activeElement)`を`isSpaceYieldedElement(document.activeElement)`へ置き換え（2か所のみ）、両メソッドのJSDocの説明を改める。`InputTracker`クラスに他のロジックを足さない。`SPACE_OPERATED_INPUT_TYPES`のJSDocの「プロパティパネル」の行はタスク9で改める（このタスクでは触れない）。
        *   完了時点で`aria-pressed`を持つ要素は画面に無いため、動きは変わらない。
*   [x] タスク4: オプションバーのスタイルのまとまりのUI部品の新設（`OptionBarStyleGroup.js`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarStyleGroup.js` : 新規
    *   **作業内容** :
        *   2章「要件2〜4・7」のとおりクラス`OptionBarStyleGroup`を作る（旧`PropertyShapeSection.js`を下敷きにする。旧ファイルはこのタスクでは消さない）。先頭に単一責務のJSDoc（3行以内。例：「責務：ツールバーのオプションバーの「スタイル」のまとまり（`#option-style-group`）の表示と、利用者の操作（線・塗りのON/OFF、太さ、色）のコールバックへの通知を担う。図形データ・選択状態には関与しない。DOM操作専任。」）。
        *   typedef（`OptionBarColorNote`・`OptionBarColorView`・`StylePanelView`（今の`StylePanelRules.js`と同じ形＝`source`・`selectedCount`を含む。タスク7で両方から消す）・`OptionBarStyleGroupActions`）、定数`COLOR_TITLE_TEXT`（`stroke`・`fill`×3値。`Object.freeze`）・`STROKE_WIDTH_MIXED_PLACEHOLDER`。
        *   旧ファイルの「色の欄の横の表示」「中間表示＝混在」「`indeterminate`」の文言は新ファイルへ写さず、2章「要件8」の旧`PropertyShapeSection.js`の項目のとおり作り替え後の表示（色の欄に覆いと斜線を重ねる・`title`・`aria-pressed="mixed"`）に合う説明で書く。
        *   コンストラクタ：6つのコールバックの検証（`Error`）→ ルート要素内で7要素を解決 → 欠ければ`console.warn`して配線しない。配線：ON/OFFのボタンの`click`→`onStrokeToggle()`／`onFillToggle()`、太さの欄の`change`（戻り値`false`で書き戻し）・`blur`（書き戻し）、色の欄の`input`・`change`・`blur`・`keydown`（旧と同じ）。
        *   `render(view)`：ON/OFFのボタンの`aria-pressed`（`setAttribute`。`true`→`'true'`・`null`→`'mixed'`・それ以外→`'false'`）と`disabled`、色の欄の`value`（違うときだけ代入）・`disabled`・`title`（`COLOR_TITLE_TEXT[target][colorNote]`。無い値は`''`の列）、包む要素の`data-color-note`（`colorNote`をそのまま）、太さの欄（フォーカスがある間は書き換えない）。表示の対象（選択中：n個等）は扱わない。
        *   クラスJSDocに「■ まとまりの構成」（オプションバーはまとまりごとにUI部品を1つ持つ。ルート要素は自分の`<div id="option-style-group" class="toolbar-group">`。要素はルート要素内の`querySelector('#id')`で解決。後からまとまりを足しても本クラスは変えない。`.disabled`の記述は書かない）と「■ 表示の規則」を書く。
        *   完了時点では誰もimportしないため、画面の動きは変わらない。
*   [x] タスク5: オプションバーの重なり順のまとまりのUI部品の新設（`OptionBarOrderGroup.js`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarOrderGroup.js` : 新規
    *   **作業内容** :
        *   2章「要件7」のとおりクラス`OptionBarOrderGroup`を作る（旧`PropertyOrderSection.js`を下敷きにし、ファイル名・クラス名・typedef名`OptionBarOrderGroupActions`・`ORDER_BUTTONS`のid（`#option-…`）・`console.warn`／`Error`の文言・JSDocの「段」「プロパティパネル」を実態へ改める。`render`・配線の働きは同じ）。先頭に単一責務のJSDoc（3行以内）。typedef`ShapeOrderAvailability`は形を変えず、二重定義の相手を`edit/ShapeOrderEditor.js`と書く。
        *   完了時点では誰もimportしないため、画面の動きは変わらない。
*   [x] タスク6: オプションバーへの切り替えと、プロパティパネル・古いUI部品の削除
    *   **対象ファイル** :
        *   `./index.html` : 更新（オプションバーのマークアップとCSSの追加、プロパティパネルのDOM・CSSの削除、CSSコメントの修正）
        *   `./js/main.js` : 更新（import・`// 7.7.`・`// 7.8.`・起動時の同期の差し替えとコメント）
        *   `./js/palette/PropertyShapeSection.js` : 削除
        *   `./js/palette/PropertyOrderSection.js` : 削除
    *   **作業内容** :
        *   **同じタスクで4ファイルを変える理由**：`index.html`のid（`option-`）と`main.js`の`getElementById`・UI部品のルート要素の対応は片方だけでは起動時に`console.warn`が出て線・塗り・太さ・重なり順を画面から変えられなくなり、古いUI部品のファイルは`main.js`のimportを外した時点で使われなくなるため、4つを同時に揃えて各タスクの完了時点で画面が壊れていない状態を保つ。
        *   `index.html`：2章「要件1〜3」のとおり、`#toolbar`の既存の3つのまとまりの後ろに2つのまとまりを足し、CSS（`.option-color-frame`・色の欄の大きさ・覆いと斜線のルール・`#option-stroke-width`・`.option-unit`・`.tool-btn.active`のセレクタの拡張・`[aria-pressed="mixed"]`）を足す。`#window-property-panel`のDOMと、2章「要件1」に列挙したCSSのルールとコメントを削除する。ツールパレット・読み込み中の覆い要素・`?dev`の確認用ウィンドウのCSSコメントのプロパティパネルの記述を実態へ改める（位置の値は変えない）。新しいCSSには、ツールバーに収まる大きさ・幅を変えない理由・1280px幅の見積もり（約610px）を短いコメントで書く。
        *   `main.js`：2章「要件7」のとおりimport・`// 7.7.`・`// 7.8.`のブロック（UI部品の生成・同期関数の改名・JSDoc・ブロックのコメント）と起動時の同期の呼び出し・コメントを改める。`performShapeOrder`の働き・`KeyboardShortcuts`の注入・他のブロックは変えない（`performShapeOrder`のJSDocの「「重なり順」のボタン」は「オプションバーの重なり順のボタン」へ）。
        *   `js/palette/PropertyShapeSection.js`・`js/palette/PropertyOrderSection.js`をファイルごと削除する（`git rm`等のリポジトリ操作はしない。ファイルの削除のみ）。
        *   完了後に`js/`・`index.html`を`id="property-`・`#property-`・`.property-`・`id="order-`・`#order-`（`order-`単独はCSSの`border-`に誤って一致するため使わない）・`PropertyShapeSection`・`PropertyOrderSection`・`window-property-panel`で検索し、残りが無いこと（コメントの残りはタスク8・9の対象のファイルのみ）を確かめて記録する。`main.js`の行数を記録する（2章「開発資料の更新予定」の`02_main.md`の行数へ追記）。
        *   完了時点：起動してこれまでの操作ができ、オプションバーから線・塗り・太さ・重なり順を変えられる（コンソールにエラー・警告が出ないことは合成イベントの範囲で確かめ、実ブラウザでの確認は5章のテストプレイ項目）。
*   [x] タスク7: `StylePanelView`の`source`・`selectedCount`の削除とテストの書き換え、`StylePanelRules.js`のコメント
    *   **対象ファイル** :
        *   `./js/edit/StylePanelRules.js` : 更新（戻り値とtypedefから2項目を削除、コメント・JSDocの修正）
        *   `./test/edit/StylePanelRules.test.js` : 更新（2章「要件5」の2ケースの期待値から2項目を削除のみ）
        *   `./js/palette/OptionBarStyleGroup.js` : 更新（二重定義のtypedef`StylePanelView`から2項目を削除のみ）
    *   **作業内容** :
        *   **同じタスクで3ファイルを変える理由**：typedef`StylePanelView`は`StylePanelRules.js`と`OptionBarStyleGroup.js`の二重定義で「形を変えるときは両方を揃える」約束があり、戻り値を変えると既存テストの`deepEqual`が失敗するため、3つを同時に揃えて`node --test`の`fail 0`を保つ。
        *   `buildStylePanelView`の戻り値（選択なし・選択ありの2か所）から`source`・`selectedCount`を削除し、typedef・JSDocから2項目と`source`の言及を除く。2章「要件8」の`StylePanelRules.js`のコメント・JSDocの修正を行う（`StylePanelColorView`の「中間表示（`indeterminate`）」と、`colorNote`の説明「色の欄の横の表示」→「色の欄に重ねる表示（混在・表示できない色の覆いと斜線、`title`）の種類」を含む）。先頭の責務定義は2章「要件8」の最終形（3行）にする：対象を「オプションバーのスタイルのまとまり」へ改め、タスク1で足した切り替えの規則（`nextEnabledOnToggle`＝ON/OFFのボタンを押したときの次の有無の規則）を担う内容に残し、識別子の「Panel」を残す旨を1行で明記する（3行以内）。
        *   テストは2章「要件5」の2ケースの期待値から2行ずつを削除するだけ（他のケースは変えない）。
        *   完了後に`js/`・`test/`を`selectedCount`と`source: '`（`'selection'`・`'newShape'`）で検索し、残りが無いことを記録する。
*   [x] タスク8: `edit/`のコメント・JSDocの修正（オプションバーの実態へ）
    *   **対象ファイル** :
        *   `./js/edit/ShapeStyleEditor.js` : 更新（コメント・JSDocのみ）
        *   `./js/edit/ShapeOrderEditor.js` : 更新（コメント・JSDocのみ）
        *   `./js/edit/ShapeOrderRules.js` : 更新（コメント・JSDocのみ）
        *   `./test/edit/ShapeStyleEditor.test.js` : 更新（先頭の責務定義のコメントのみ）
    *   **作業内容** :
        *   **同じタスクで複数ファイルを変える理由**：いずれもロジックを変えないコメントのみの修正で、互いの前提にならず、タスク6でUI部品の名前が確定した後でまとめて行うのが誤りを生みにくいため。
        *   2章「要件8」の洗い出しのとおり改める。`ShapeStyleEditor.js`は先頭の責務定義・クラスJSDoc・`getPanelView`・`#rememberedColors`のJSDocの「プロパティパネル」「パネル」を「オプションバー」へ改め、クラスJSDocに識別子の「Panel」と「パネルが覚えている色」を表示の部品一般の名前として残す旨を1行で明記する。タスク2で足したメソッドのJSDocも実態に合うか確かめる。
        *   ロジック・識別子・テストのケースは変えない。
*   [x] タスク9: `core/`・`palette/`のコメント・JSDocの修正
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新（`SPACE_OPERATED_INPUT_TYPES`のJSDocのみ）
        *   `./js/core/KeyboardShortcuts.js` : 更新（コメント・JSDocのみ）
        *   `./js/palette/CanvasPalette.js` : 更新（クラスJSDocの`.disabled`の記述のみ）
        *   `./js/palette/PaletteLauncher.js` : 更新（クラスJSDocの1行のみ）
    *   **作業内容** :
        *   **同じタスクで複数ファイルを変える理由**：タスク8と同じ（コメントのみで互いの前提にならない）。
        *   2章「要件6・8」の洗い出しのとおり改める。`KeyboardShortcuts.js`は手順4の判定（`isSpaceOperatedInputElement`）・手順の順序を変えず、ON/OFFのボタンが手順4の対象外であることをJSDocに1文足す。
        *   ロジックは変えない。
*   [ ] タスク10: 残置とJSDocの最終確認
    *   **対象ファイル** :
        *   （原則として変更なし。見落としが見つかった場合に限り、タスク1〜9の対象ファイルの中で直す）
    *   **作業内容** :
        *   `js/`・`index.html`・`test/`を`プロパティパネル`・`PropertyShapeSection`・`PropertyOrderSection`・`id="property-`・`#property-`・`id="order-`・`#order-`・`window-property-panel`・`チェックボックス`・`.property-`・`order-button-grid`・`indeterminate`・`横の表示`・`中間表示`・`selectedCount`で検索し（`order-`・`property-`を単独で使わない：`order-`はCSSの`border-`に、接頭辞なしの語は作り替え後の`option-order-group`等に誤って一致するため。上の形は`#option-order-group`・`id="option-order-group"`には一致しない）、残りが無いこと（`isSpaceOperatedInputElement`の`checkbox`の`type`の一覧とその説明は残す）を記録する。
        *   新設・変更したファイルのJSDoc（`@param`・`@returns`・`@throws`）・先頭の責務定義（3行以内）・注入するコールバックの契約を確認する。
        *   `node --test`の件数を記録する。
*   [ ] タスク11: 開発資料への反映（最終固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（1章・2章・3章・4章の本文の該当箇所）
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/06_InputTracker.md` : 更新
        *   `./_doc/arch/07_KeyboardShortcuts.md` : 更新
        *   `./_doc/arch/08_HistoryManager.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新（`isFillable()`の項目の「プロパティパネルの塗りの欄」の1か所のみ）
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
    *   **作業内容** :
        *   2章「開発資料の更新予定」（各タスクで追記された分を含む）を確認し、`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従って反映する。実コードと照合し、行数等は実測値を書く。`_doc/arch/12_shapes.md`は22行の`isFillable()`の項目の「（プロパティパネルの塗りの欄）」をオプションバーの実態へ改める（2章の該当項目のとおり）。
        *   反映後に`PROJECT_ARCHITECTURE.md`と`_doc/arch/`配下の全ファイルを「プロパティパネル」「`PropertyShapeSection`」「`PropertyOrderSection`」「`property-`」「`#order-`」「の段」「チェックボックス」「`indeterminate`」で検索し、プロパティパネルに触れる記述の残り（経緯として残す記述を除く）が無いことを記録する。
        *   ※ 実装AIによる開発資料の書き換えは本ワークフローでは原則禁止であるが、**この最終タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 切り替えの規則`nextEnabledOnToggle`の追加とテスト
*   **作業内容** :
    *   `js/edit/StylePanelRules.js`：`parseStrokeWidthInput`の後ろに`export function nextEnabledOnToggle(enabled)`（`enabled !== true`を返す。JSDoc付き）を追加。先頭の責務定義1行目の末尾を「…線の太さの入力の受理・ON/OFFのボタンを押したときの次の有無の規則を担う。」に変更（3行のまま。「プロパティパネルの「図形」の段」はタスク7まで未変更）。
    *   `test/edit/StylePanelRules.test.js`：importに`nextEnabledOnToggle`を追加し、`describe('nextEnabledOnToggle')`に3ケース（true→false、false→true、null→true）を追加。既存ケースは未変更。
    *   `node --test`：tests 989 / pass 989 / fail 0（基準986＋3）。

### タスク2: 切り替えのメソッド`toggleStrokeEnabled`・`toggleFillEnabled`の追加とテスト
*   **作業内容** :
    *   `js/edit/ShapeStyleEditor.js`：importに`nextEnabledOnToggle`を追加。`setFillEnabled`の直後に公開メソッド`toggleStrokeEnabled()`・`toggleFillEnabled()`、`#setEnabled`の直前に非公開`#toggleEnabled(target)`を追加（JSDoc付き。`#finishPreview()`→`getPanelView()[target].enabled`に`nextEnabledOnToggle`→`#setEnabled`）。既存のメソッド・コメントは未変更。
    *   `test/edit/ShapeStyleEditor.test.js`：末尾に要件9の7件（6は(a)(b)の2件、計8テスト）を追加。既存ケース・補助関数は未変更。
    *   `node --test`：tests 997 / pass 997 / fail 0（タスク1後989＋8）。

### タスク3: `Space`を部品に譲る判定の追加（`InputTracker.js`）
*   **作業内容** :
    *   `js/core/InputTracker.js`：`isSpaceOperatedInputElement`の直後に非公開のモジュール関数`isToggleButtonElement`・`isSpaceYieldedElement`を追加（export なし・JSDoc付き。`HTMLButtonElement`は関数内でのみ参照）。`#handleSpaceKeyDown`・`handleKeyUp`の条件の`isSpaceOperatedInputElement`を`isSpaceYieldedElement`へ置き換え（2か所のみ）、両メソッドのJSDocの説明を改めた。`SPACE_OPERATED_INPUT_TYPES`のJSDocは未変更（タスク9）。クラスに他のロジックは足していない。
    *   `node --test`：tests 997 / pass 997 / fail 0（件数変化なし。テスト追加なし）。

### タスク4: オプションバーのスタイルのまとまりのUI部品の新設（`OptionBarStyleGroup.js`）
*   **作業内容** :
    *   `js/palette/OptionBarStyleGroup.js`を新規作成（旧`PropertyShapeSection.js`は未変更・未削除）。クラス`OptionBarStyleGroup`、typedef（`OptionBarColorNote`・`OptionBarColorView`・`StylePanelView`（`source`・`selectedCount`を含む今の形）・`OptionBarStyleGroupActions`）、定数`COLOR_TITLE_TEXT`（凍結）・`STROKE_WIDTH_MIXED_PLACEHOLDER`。
    *   コールバック6つ（`onStrokeToggle`・`onFillToggle`・`onStrokeWidthChange`・`onColorInput`・`onColorChange`・`onColorEditEnd`）の検証、7要素の解決と`console.warn`、配線（ON/OFFのボタンの`click`、太さの`change`・`blur`、色の`input`・`change`・`blur`・`keydown`）、`render(view)`（`aria-pressed`の3値と`disabled`、色の欄の`value`（違うときだけ）・`disabled`・`title`、包む要素の`data-color-note`、太さの欄）。
    *   旧文言の「色の欄の横の表示」「中間表示」「`indeterminate`」「`.disabled`」は写していない。選択の対象の表示（`source`の表示）は扱わない。誰もimportしないため画面の動きは変わらない。`node --check`で構文確認済み（`node --test`はテスト対象外のため未実行）。

### タスク5: オプションバーの重なり順のまとまりのUI部品の新設（`OptionBarOrderGroup.js`）
*   **作業内容** :
    *   `js/palette/OptionBarOrderGroup.js`を新規作成（旧`PropertyOrderSection.js`は未変更・未削除）。クラス`OptionBarOrderGroup`、typedef`OptionBarOrderGroupActions`・`ShapeOrderAvailability`（形は同じ、二重定義の相手は`edit/ShapeOrderEditor.js`）、`ORDER_BUTTONS`のidを`#option-bring-to-front`・`#option-bring-forward`・`#option-send-backward`・`#option-send-to-back`へ。`console.warn`／`Error`の文言・JSDocの「段」「プロパティパネル」を「まとまり」「オプションバー」へ改め、ルート要素は`<div id="option-order-group" class="toolbar-group">`と記述。`render`・配線の働きは旧と同じ。誰もimportしないため画面の動きは変わらない。
    *   `node --check`で構文確認。`node --test`：tests 997 / pass 997 / fail 0（件数変化なし）。
    *   監査の指摘による修正: `OptionBarOrderGroup.js`の`console.warn`の文言から「」を除き、要件7の指定（`OptionBarOrderGroup: 重なり順のまとまりの要素が見つからないため、配線しません。`）に一致させた。`node --test`：tests 997 / pass 997 / fail 0。

### タスク6: オプションバーへの切り替えと、プロパティパネル・古いUI部品の削除
*   **作業内容** :
    *   `index.html`：`#toolbar`の既存3つのまとまりの後ろに`#option-style-group`・`#option-order-group`を要件1のマークアップどおり追加。CSSに`.option-color-frame`・色の欄の大きさ・覆いと斜線（`::after`）・`#option-stroke-width`・`.option-unit`・`.tool-btn[aria-pressed="mixed"]`（破線の枠）を追加し、`.tool-btn.active`のセレクタを`.tool-btn.active, .tool-btn[aria-pressed="true"]`に拡張、幅の見積もり（約610px）のコメントを付けた。`#window-property-panel`のDOMと`.property-*`・`.order-button-grid`等のCSS・コメントを削除。ツールパレット・読み込み中の覆い要素・`?dev`の確認用ウィンドウのCSSコメントのプロパティパネルの記述を改めた（位置の値は不変）。
    *   `js/main.js`：import・`// 7.7.`・`// 7.8.`のブロック（`optionBarStyleGroup`・`optionBarOrderGroup`の生成、`onStrokeToggle`/`onFillToggle`→`toggleStrokeEnabled`/`toggleFillEnabled`、`syncOptionBarStyleGroup`・`syncOptionBarOrderGroup`）・JSDoc・コメント・起動時の同期を差し替え。`performShapeOrder`のJSDocを「オプションバーの重なり順のボタン」へ。
    *   `js/palette/PropertyShapeSection.js`・`PropertyOrderSection.js`をファイル削除。
    *   検索結果（`id="property-`・`#property-`・`.property-`・`id="order-`・`#order-`・`PropertyShapeSection`・`PropertyOrderSection`・`window-property-panel`・`プロパティパネル`、`js/`・`index.html`）：残りはタスク7〜9の対象ファイルのコメントのみ（`InputTracker.js`169行、`ShapeOrderEditor.js`9行、`ShapeOrderRules.js`9行、`ShapeStyleEditor.js`2・35行、`StylePanelRules.js`2・35行、`PaletteLauncher.js`29行）。`index.html`・`main.js`に残りなし。
    *   `main.js`の行数：701行。`node --test`：tests 997 / pass 997 / fail 0（`node --check js/main.js`も通過）。実ブラウザでの確認は未実施（5章のテストプレイ項目）。

### タスク7: `StylePanelView`の`source`・`selectedCount`の削除とテストの書き換え、`StylePanelRules.js`のコメント
*   **作業内容** :
    *   `js/edit/StylePanelRules.js`：`buildStylePanelView`の戻り値2か所から`source`・`selectedCount`を削除し、typedef`StylePanelView`・JSDocから2項目と`source`の言及を除いた。先頭の責務定義を最終形（3行：オプションバーのスタイルのまとまり＋切り替えの規則／状態を持たない／識別子「Panel」を残す旨）にした。`STROKE_WIDTH_MIN`／`MAX`・`StylePanelColorView`（`aria-pressed="mixed"`、`colorNote`は覆いと斜線・`title`の種類）・`StylePanelView`（`OptionBarStyleGroup.js`との二重定義）・`RememberedColors`・`resolveColorView`・`newShapeColorView`・`buildStylePanelView`のコメント・JSDocの「パネル」表現を改めた。
    *   `js/palette/OptionBarStyleGroup.js`：二重定義のtypedef`StylePanelView`から2項目を削除のみ。
    *   `test/edit/StylePanelRules.test.js`：2ケースの期待値から2行ずつ削除のみ。
    *   `js/`・`test/`を`selectedCount`・`source: '`で検索し、残りなし。`node --test`：tests 997 / pass 997 / fail 0。

### タスク8: `edit/`のコメント・JSDocの修正（オプションバーの実態へ）
*   **作業内容** :
    *   `js/edit/ShapeStyleEditor.js`：先頭の責務定義・クラスJSDoc・`#rememberedColors`・`getPanelView`の「プロパティパネル」「パネル」を「オプションバー」へ改め、クラスJSDocに識別子の「Panel」と「パネルが覚えている色」を表示の部品一般の名前として残す旨を1行足した（責務定義は2行のまま）。タスク2のメソッドのJSDocは実態に合うため未変更。
    *   `js/edit/ShapeOrderEditor.js`：9行を`palette/OptionBarOrderGroup.js`へ。`js/edit/ShapeOrderRules.js`：9行を`OptionBarOrderGroup`の対応表へ。
    *   `test/edit/ShapeStyleEditor.test.js`：先頭の責務定義を「オプションバーでの変更の反映」へ（ケースは未変更）。コード・識別子は変えていない（`node --test`は未実行。コメントのみ）。

### タスク9: `core/`・`palette/`のコメント・JSDocの修正
*   **作業内容** :
    *   `js/core/InputTracker.js`：`SPACE_OPERATED_INPUT_TYPES`のJSDocの「プロパティパネル以外に存在しない」を「オプションバーのスタイルのまとまりの色の欄（color）以外に存在しない」へ。
    *   `js/core/KeyboardShortcuts.js`：先頭の責務定義（3行のまま）・手順4のJSDoc・手順4のコメントの「チェックボックス・色の欄」を「typeがcheckbox・colorのinput。色の欄」へ。手順4のJSDocに、ON/OFFのボタン（aria-pressedを持つbutton）は手順4の対象外でSpaceの扱いはInputTrackerが決める旨を1行足した。
    *   `js/palette/CanvasPalette.js`：`.disabled`クラスの記述を削除。`js/palette/PaletteLauncher.js`：「プロパティパネル」を削除。
    *   コメントのみ。ロジックは未変更。

### タスク10: 残置とJSDocの最終確認
*   **作業内容** :
    *   (未実施)

### タスク11: 開発資料への反映（最終固定タスク）
*   **作業内容** :
    *   (未実施)

## 5. 懸念事項・要確認ポイント
* **計画時の判断事項（REQで計画時に決めるとされた項目）**
    * 名前：UI部品は`OptionBarStyleGroup`（`js/palette/OptionBarStyleGroup.js`）・`OptionBarOrderGroup`（`js/palette/OptionBarOrderGroup.js`）、idの接頭辞は`option-`（まとまりのルートは`#option-style-group`・`#option-order-group`）。
    * ON/OFFの3つの表示のCSS：`aria-pressed`の値で決め、`.active`は併用しない。押し込みは既存の`.tool-btn.active`のルールのセレクタに`[aria-pressed="true"]`を足して共有し、そろっていないは`[aria-pressed="mixed"]`の破線の枠のルール1つ。
    * 覆いと斜線：色の欄を包む`<span class="option-color-frame">`の`::after`（`data-color-note`が`mixed`・`unsupported`のとき）に`linear-gradient`の斜線と単色の地を重ねる。追加の要素・画像・SVGなし。
    * 判定の関数：`InputTracker.js`の非公開のモジュール関数`isToggleButtonElement`（`button`要素が`aria-pressed`属性を持つ）と`isSpaceYieldedElement`（`isSpaceOperatedInputElement`または`isToggleButtonElement`）。exportしないのは、使うのが`InputTracker`の`Space`の処理の2か所だけで、`KeyboardShortcuts`の手順4には使わないため。
    * 切り替えの規則の名前：`StylePanelRules.nextEnabledOnToggle`。メソッド：`ShapeStyleEditor.toggleStrokeEnabled`・`toggleFillEnabled`。コールバック：`onStrokeToggle`・`onFillToggle`。
* **スコープ外のファイルに残る`.disabled`の記述**：持ち越し事項の3か所とは別に、`js/palette/ToolPalette.js`のクラスJSDoc（15行「ウィンドウ全体の非活性（`.disabled`）は扱わない」）と`_doc/arch/13_palette.md`の`ToolPalette.js`の項目にも、存在しない`.disabled`に触れる記述がある。REQで`ToolPalette.js`は変更しない見込みとされているため本作業では変えない（`13_palette.md`の該当行もタスク11の`PropertyShapeSection`等の置き換えの範囲外として変えない）。整理する場合は親セッションの判断とする。
* **マウスで押した後のフォーカス**：ブラウザ（Chrome・Edge等）はマウスで押したボタンにフォーカスを残すため、ON/OFFのボタンを押した後にキャンバス以外をクリックせずに`Space`を押すと、スペースパンではなくON/OFFの切り替えになる（要件6の表どおりの動き。キャンバスを押すとフォーカスはボタンから外れる）。ツールバーの他のボタン・重なり順のボタンはこれまでどおりスペースパンの扱い。気になる場合は将来の検討事項とする（専用のフォーカス制御は足さない）。
* **`disabled`の塗りのON/OFFのボタンにフォーカスが残った場合**：`aria-pressed`を持つため`isSpaceYieldedElement`が真になり、`Space`はパンせず`preventDefault()`もしない（`disabled`のボタンは押されないため何も起きない。ページは`overflow: hidden`でスクロールしない）。テストプレイで確かめる。
* **絵文字の見え方**：🖊（U+1F58A）・🪣（U+1FAA3、Unicode 13）・⏫・🔼・🔽・⏬はOS・フォントによって白黒の記号・カラーの絵文字・豆腐（□）で表示が変わり得る。アイコンは後で差し替える予定の仮のもの（発注者の決定）。実ブラウザでの見え方をテストプレイで確かめる。
* **色の欄の内側の描かれ方**：`<input type="color">`の色の部分の余白（ブラウザ標準の`::-webkit-color-swatch-wrapper`等）はブラウザで異なるため、覆いの`inset`の値は実装時に見え方で調整してよい（色の部分を覆い、欄の外へはみ出さないこと）。実ブラウザでの見え方をテストプレイで確かめる。
* **`getPanelView()`の呼び出しが増えること**：`#toggleEnabled`は`getPanelView()`で今の有無を求め、ONにする場合は`#setEnabled`の中でもう一度`getPanelView()`を呼ぶ（覚えている色の更新は同じ状態なら同じ結果のため、表示は変わらない）。`getPanelView()`をクラスの内部から呼ぶのは既存の約束の範囲内。
* **テストプレイで確認すべき項目**（実装AIの確認は合成イベントのみのため、【実ブラウザ】を付けた項目は発注者の実際のブラウザで確かめる）
    * **画面の構成**
        1. ページを開く → 画面の上端のツールバーに、左から📁｜↶↷｜🗑🔗｜🖊・線の色・🪣・塗りの色・太さの欄・「px」｜⏫🔼🔽⏬が1行に並ぶ。まとまりの間に区切りの縦線がある。プロパティパネルのウィンドウは無い。【実ブラウザ】
        2. 各部品にマウスを載せる → `title`がREQ要件1の表のとおり出る（`最前面へ (Home)`等のキー表記を含む）。【実ブラウザ】
        3. ブラウザの幅を1280pxにする → ツールバーの全項目が切れずに見える（右側に余白が残る）。【実ブラウザ】
        4. ブラウザの幅を徐々に狭める → 右から（⏬側から）重なり順のまとまり → スタイルのまとまりの順に画面の外へ切れ、折り返し・横スクロールは出ない。【実ブラウザ】
        5. 太さの欄の高さ・色の欄の高さがツールバー（40px）に収まり、ツールバーの高さが変わらない。【実ブラウザ】
        6. 絵文字（🖊🪣⏫🔼🔽⏬）が判別できる形で表示される。【実ブラウザ】
    * **線・塗りのON/OFFのボタン（3つの表示と押したときの結果）**
        7. 何も選ばない（起動直後）→ 🖊は押し込み（線あり）、🪣は通常（塗りなし）。
        8. 線ありの矩形を1つ選んで🖊を押す → 線が消え、🖊が通常になる。`Ctrl`+`Z`1回で線が戻り🖊が押し込みに戻る。`Ctrl`+`Y`1回で再び線なし。
        9. 線なしの図形を選んで🖊を押す → 色の欄に表示されていた色で線が付く。
        10. 線ありと線なしの図形を範囲選択で一緒に選ぶ → 🖊が破線の枠（押し込みの色なし）になる。押す → 選択中の全図形に線が付き（色は色の欄の色）、🖊が押し込みになる。`Ctrl`+`Z`1回で元に戻る（破線の枠に戻る）。
        11. 塗りありと塗りなしの矩形を一緒に選ぶ → 🪣が破線の枠。押す → 両方塗られる。
        12. 直線・曲線・弧・開いたパスだけを選ぶ → 🪣と塗りの色の欄が無効（半透明・押せない）になり、🪣の見た目は通常（押し込み・破線ではない）。
        13. 矩形（塗りなし）と直線を一緒に選んで🪣を押す → 矩形だけが塗られる（直線は変わらない）。
        14. 何も選ばずに🖊・🪣を押す → ボタンの表示が切り替わり、図形は変わらず、取り消しのボタンは押せるようにならない（履歴に記録されない）。その後に描いた図形がその有無で描かれる。
    * **色の欄と混在・表示できない色**
        15. 線の色が違う図形を2つ選ぶ → 線の色の欄がグレーの地に赤の斜線1本の表示になる。マウスを載せると`線の色（混在）`。塗りの色が違う塗れる図形を2つ選ぶと塗りの色の欄が同様で`塗りの色（混在）`。【実ブラウザ】
        16. 色名（例：`red`）・`rgb(...)`の色を持つ図形を`?dev`の「JSONから復元」で入れて選ぶ → 色の欄がグレーの地に赤の斜線、`title`は`線の色（表示できない色）`／`塗りの色（表示できない色）`。【実ブラウザ】
        17. 15・16の斜線が出た状態で色の欄をクリック → ピッカーが開く（斜線がクリックを妨げない）。開いたピッカーには欄の値の色（最も手前の図形の色、または覚えている色）が出る。色を選んで閉じる → 選択中の全図形（塗りは塗れる形だけ）がその色になり、斜線が消える。【実ブラウザ】
        18. 斜線が出たり消えたりする選択の切り替えをする → 🪣・太さの欄・重なり順のボタンの位置が動かない。【実ブラウザ】
        19. 塗れない形だけを選ぶ → 塗りの色の欄は無効で斜線が出ない。
        20. 図形を選んで色の欄のピッカーを開き、色を何度も動かしてから閉じる → `Ctrl`+`Z`1回でピッカーを開く前の色に戻る（1件）。【実ブラウザ】
    * **線の太さの欄**
        21. 太さに`5`を打って`Enter` → 選択中の全図形の線の太さが5になり、`Ctrl`+`Z`1回で戻る。
        22. `0`・`101`・`1.5`・空・`abc`を打って`Enter`（または欄から出る）→ 図形は変わらず、欄は元の値へ戻る。
        23. 太さが違う図形を2つ選ぶ → 欄が空で`混在`の薄い文字が出る。
        24. 太さの欄に打ち込み途中（`Enter`前）に他の操作で表示が更新されても、打ち込み途中の値が消えない。欄から出ると最後の表示に戻る（確定した場合は確定した値）。
        25. 太さの欄の文字をマウスで選択できる（他のツールバーの文字は選択できない）。【実ブラウザ】
    * **選択なしの扱い**
        26. 何も選ばずに線の色・太さ・塗りを変える → 図形は変わらず、取り消しのボタンは押せるようにならない。次に描いた図形がそのスタイルで描かれる。「選択中：n個」「次に描く図形」の文字はどこにも出ない。
    * **重なり順のまとまり**
        27. 何も選んでいない → 4つのボタンはすべて押せない。
        28. 図形を3つ描き、真ん中を選ぶ → 4つとも押せる。🔼を押す → 1つ手前になる。最前面に達すると⏫・🔼が押せなくなる。`Ctrl`+`Z`1回で1つずつ戻る。
        29. `Home`・`PageUp`・`PageDown`・`End`でボタンと同じ結果になる。
    * **キーボードの扱い（要件6の表の全マス。RES `261031_2121` 5章の考え方）**【実ブラウザ】
        30. 太さの欄にフォーカス → `Space`：欄の入力になりパンしない。`1`〜`5`：欄に入力され図形種別は切り替わらない。`Delete`／`Backspace`：欄の文字が消え図形は消えない。`V`・`H`・`P`・`J`・`Escape`・`Home`等：働かない。`Ctrl`+`Z`：欄の標準の取り消し（アプリの取り消しは働かない）。`Enter`：太さの確定。
        31. 線の色の欄・塗りの色の欄にフォーカス（`Tab`で移動、またはピッカーを閉じた直後）→ `Space`：ピッカーが開き、パンしない。`Enter`：ブラウザ標準の動き（ピッカーが開く場合がある）。`1`〜`5`・`Delete`／`Backspace`・`V`・`H`・`J`・`Home`等：働かない。`Ctrl`+`Z`：アプリの取り消しが働く（ピッカー操作中の記録は`keydown`で先に確定される）。
        32. 🖊・🪣にフォーカス（`Tab`で移動、またはマウスで押した直後）→ `Space`：そのボタンが押されON/OFFが切り替わり、パンしない（`Space`を押している間カーソルが手の形にならない）。`Enter`：ON/OFFが切り替わる。`1`〜`5`：図形種別が切り替わる（ツールパレットの押し込みが追従）。`Delete`／`Backspace`：選択中の図形が削除される。`V`・`H`・`P`・`J`・`Escape`・`Home`／`PageUp`／`PageDown`／`End`：それぞれ働く。`Ctrl`+`Z`／`Ctrl`+`Y`：取り消し・やり直しが働く。
        33. 重なり順のボタンにフォーカス（`Tab`で移動、またはマウスで押した直後）→ `Space`：ボタンは押されず、スペースパンの扱い（押しながらキャンバスをドラッグするとパン）。`Enter`：ボタンが押される。ショートカット（数字・`Delete`・`V`・`Ctrl`+`Z`等）：働く。
        34. 押した直後に`disabled`になったボタンにフォーカスが残った状態（例：⏫で最前面にした直後、塗れる形の選択中に🪣にフォーカスを置いたまま塗れない形だけを選び直す）→ `Space`・`Enter`を押しても誤って押されず、アプリが止まらない。ショートカット（`V`・`Delete`・`Ctrl`+`Z`等）は働く。
        35. `Tab`でフォーカスを移す → ツールバーの左から順（📁 → ↶ → … → 🖊 → 線の色 → 🪣 → 塗りの色 → 太さ → 押せる重なり順のボタン）に移り、`disabled`のボタンは飛ばされる。
        36. 色のピッカーを開いている間にキーを押す（`Escape`・`Space`・数字）→ ピッカーの操作になり、アプリのショートカット・パンは起きない。閉じた後の確定（`Ctrl`+`Z`1回で開く前の色）が崩れない。
    * **読み込み中・ドラッグ・フロートウィンドウ**
        37. 図形の多いキャンバスで再読み込みし、読み込み中の覆い（「読み込み中…」）が出ている間にオプションバーの🖊・色・太さを操作する → 図形一式は変わらず、読み込み完了後に描く図形にだけ反映される（直前に使った値だけが変わる）。重なり順のボタンは押せない。【実ブラウザ】
        38. キャンバスで範囲選択・図形のドラッグを始め、押したままカーソルをオプションバーの上へ出して離す → ドラッグが正常に終わり（範囲選択の確定・移動の確定）、オプションバーの部品は押されない。【実ブラウザ】
        39. ツールパレット・キャンバスパレット・`?dev`の確認用ウィンドウのヘッダーをドラッグしてオプションバーの上へ重ねる → ウィンドウがオプションバーより手前に出る。【実ブラウザ】
    * **既存の機能の回帰**
        40. 図形の作成（5種）・選択・移動・変形・削除（ボタン・キー）・結合（ボタン・`J`）・取り消し/やり直し（ボタン・キー）・コピー/切り取り/貼り付け/複製・キャンバスパレット（一覧・新規作成・名前の変更・削除・出力・開く・インポート）・自動保存（再読み込みで残る）・`?dev`の確認用ウィンドウ（`?dev`付きで開く、JSONへ変換・復元）が、これまでと同じに動く。
        41. ページを開いたときと各操作の後に、ブラウザのコンソールにエラー・警告が出ない（特に`OptionBarStyleGroup`・`OptionBarOrderGroup`の要素が見つからない旨の`console.warn`が出ない）。【実ブラウザ】
        42. 書き出したスプライトJS・作業データファイルの内容（版2）が変わらない（スタイルを変えた図形を出力し、開き直して同じに見える）。
* **（タスク4の記録）色の欄の`title`の付け先**：計画書に付け先の指定が無いため、`title`は色の欄（`input[type="color"]`）にだけ設定した（包む`.option-color-frame`には`data-color-note`のみ。覆いは`pointer-events: none`で、ホバーは下の色の欄に届く）。タスク6で`index.html`の初期`title`（`線の色`・`塗りの色`）と整合することを確認すること。
* **（タスク6の記録）** 色の欄の`title`は`index.html`の初期値（`線の色`・`塗りの色`）が`COLOR_TITLE_TEXT`の`''`列と一致することを確認した。覆いの`inset: 2px`は計画の例のまま（実ブラウザでの見え方の確認・必要なら調整はテストプレイで）。`02_main.md`の行数は701行（開発資料の更新予定へ反映すること）。
* **（タスク4の記録）`OptionBarStyleGroup.js`は`StylePanelView`の二重定義に`source`・`selectedCount`を含む**：タスク7で`StylePanelRules.js`と同時に2項目を消す約束（この時点では`render`はそれらを使わない）。
