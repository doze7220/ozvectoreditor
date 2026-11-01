# RES: 作業計画・作業レポート (Phase 02-01) : 操作モード再設計
* 参照元REQ: `./_log/req/261006_2244_REQ_Phase02-01_OperationMode_Redesign.md`

## 1. 作業目的
現状、`InputTracker.currentTool`という1つの状態に「操作モード（選択／作成）」と「作成する図形種別（line/curve/arc/rect/circle）」という2つの異なる概念が混在しており、コントロールパネルの「直線ツール」と図形パレットの「直線」が同じ`tool='line'`を指して同時にハイライトされる。本作業では以下を行う。

* `InputTracker`の状態を「操作モード（`'select'`／`'create'`）」と「図形種別」の2変数に分離し、それぞれに引数バリデーション付きの切り替えAPIを設ける。
* コントロールパネルを操作モード専用、図形パレットを図形種別専用のUIとして再定義し、`.active`の意味づけを分離する。
* Phase 02-02で「キャンバス移動（パン）」モードボタンを追加する際、`index.html`へのボタン追加と`main.js`のボタン表へのエントリ追加（＋`InputTracker`のモード定義への1エントリ追加）のみで済む構造にする。
* キャンバス上のマウスカーソル形状（`crosshair`／`move`／`pointer`／`default`）による視覚フィードバックを導入する。
* `InputTracker`のJSDoc記載漏れ・古い型注釈を解消する。

## 2. アーキテクチャ設計

### 要件1: 操作モードと図形種別の分離（`InputTracker.js`）

#### 1-1. 定数定義（モジュールスコープでexport）
既存の`InputState`と同じ形式で、以下2つを`InputTracker.js`に定義・exportする。

```js
/** 操作モード。コントロールパネルの各ボタンはこの値に1対1で対応する。 */
export const OperationMode = Object.freeze({
    SELECT: 'select',
    CREATE: 'create',
});

/** 図形作成モードで作成可能な図形種別。setShapeType()の引数バリデーションに用いる。 */
export const SHAPE_TYPES = Object.freeze(['line', 'curve', 'arc', 'rect', 'circle']);
```

* Phase 02-02でパンモードを追加する際は`OperationMode`に`PAN: 'pan'`を1行追加する。
* `SHAPE_TYPES`はホワイトリスト配列であり、`includes()`による受理判定のみに用いる。図形種別ごとの`if`/`switch`分岐は持ち込まない（種別ごとの振る舞いの差は従来どおり`ShapeFactory`と各shapeクラスが担う）。

#### 1-2. 状態フィールド
`this.currentTool`を廃止し、以下2フィールドに置き換える。

| フィールド              | 型                         | 初期値     | 意味                                                                 |
| ----------------------- | -------------------------- | ---------- | -------------------------------------------------------------------- |
| `this.currentMode`      | `'select'\|'create'`       | `'select'` | 現在の操作モード。`setMode()`経由でのみ更新する。                    |
| `this.currentShapeType` | `'line'\|'curve'\|'arc'\|'rect'\|'circle'` | `'line'`   | 図形作成モードで作成する図形種別。`setShapeType()`経由でのみ更新する。操作モードを切り替えても保持され続ける。 |

* 「図形作成モードへ切り替えた直後は前回最後に選んでいた図形種別に復帰する」要件は、`currentShapeType`をモード切り替えで一切リセットしないことで自然に満たされる（専用の退避・復元処理は設けない）。起動直後は初期値`'line'`となる。

#### 1-3. 公開API

**`setMode(mode)`**（旧`setTool(tool)`を置き換え）
1. `Object.values(OperationMode).includes(mode)`でなければ`console.warn`を出して**何もせずreturn**する（内部状態・選択状態・カーソルに一切触れない）。
2. `this.currentMode = mode`。
3. 選択状態・ホバー状態を無条件クリア（既存挙動を維持）。
4. `DRAWING`/`DRAGGING_HANDLE`状態であれば`model.cancelDraft()`の上で`IDLE`へリセット（既存挙動を維持）。
5. カーソルを再評価・適用する（要件3参照。座標情報なしで評価する）。
* 同じモードが再指定された場合も、上記3〜5は既存の`setTool`と同様に無条件で実行する（既存挙動の維持）。

**`setShapeType(type)`**（新規）
1. `SHAPE_TYPES.includes(type)`でなければ`console.warn`を出して**何もせずreturn**する。
2. `this.currentShapeType = type`。
3. `DRAWING`状態であれば`model.cancelDraft()`の上で`IDLE`へ戻す。
4. 操作モード・選択状態・ホバー状態には触れない（図形作成モード中に呼ばれた場合、モードは`'create'`のまま維持される）。
* 選択モード中に呼ばれた場合（通常はパレットが`.disabled`のため発生しない）も、記憶する図形種別の更新のみが行われ、副作用はない。

**`getMode()`** / **`getShapeType()`**（新規、読み取り専用ゲッター）
* `main.js`がバリデーション後の**実際の内部状態**を読み返してUI表示を同期するために用いる。これにより、未知の値が渡された場合でもUI表示と内部状態が乖離しない。

#### 1-4. 既存ハンドラの改修
* `currentTool`を参照している箇所をすべて`currentMode`／`currentShapeType`に置き換える。比較には文字列リテラルではなく`OperationMode.SELECT`等の定数を用いる。
    * `handleMouseMove`／`handleMouseDown`／`handleKeyDown`のガード：`this.currentMode !== OperationMode.SELECT`。
    * `handleClick`の選択分岐：`this.currentMode === OperationMode.SELECT`。
    * `handleClick`の作成開始：`this.model.startDraft(x, y, this.currentShapeType)`（作成フロー以降は不変）。
* `handleClick`の作成開始分岐は、現状「`select`でなければ作成」という暗黙の構造になっている。Phase 02-02でパンモードを追加した際にパンモード中のクリックで図形が作成されてしまう事故を防ぐため、**作成開始は`this.currentMode === OperationMode.CREATE`のときのみ**行う明示的なガードに改める（`select`でも`create`でもないモードではクリックを無視する）。現時点の2モード構成では挙動は変わらない。

### 要件2: コントロールパネルの操作モードボタン（`index.html` / `main.js` / `PaletteController.js`）

#### 2-1. `index.html`
* `#tool-select`（🖱 選択ツール）→ `#mode-select`「🖱 選択」（初期状態で`.active`を付与）
* `#tool-line`（／ 直線ツール）→ `#mode-create`「✏ 図形作成」
* 図形パレットは初期状態`.disabled`のまま（変更なし）。
* `.float-window`／`.window-header`の構造およびCSSは変更しない（ヘッダードラッグ回帰防止。`WindowManager`はボタンのDOM idに依存していないことを確認済み）。
* `.disabled`のCSSコメント「SELECTモード中など」は実態と矛盾しないためそのまま残す。

#### 2-2. `main.js`
用語の分離を徹底するため、以下をリネームする（Phase 02-02以降のREQ・開発資料もこの名称で記述する前提）。

| 旧                         | 新                                       | 備考                                         |
| -------------------------- | ---------------------------------------- | -------------------------------------------- |
| `toolButtons`              | `modeButtons`                            | コントロールパネル側ボタン表（操作モード専用） |
| `applyTool(tool)`          | `applyMode(mode)`                        | 操作モード切り替えの一元関数                 |
| （なし）                   | `applyShapeType(type)`                   | 図形種別切り替えの一元関数（パレットのコールバック） |

```js
const modeButtons = {
    [OperationMode.SELECT]: document.getElementById('mode-select'),
    [OperationMode.CREATE]: document.getElementById('mode-create'),
};

function applyMode(mode) {
    inputTracker.setMode(mode);
    const currentMode = inputTracker.getMode();
    Object.entries(modeButtons).forEach(([key, btn]) => btn.classList.toggle('active', key === currentMode));
    paletteController.setEnabled(currentMode === OperationMode.CREATE);
    paletteController.setActiveType(inputTracker.getShapeType());
}

function applyShapeType(type) {
    inputTracker.setShapeType(type);
    paletteController.setActiveType(inputTracker.getShapeType());
}

Object.entries(modeButtons).forEach(([mode, btn]) => btn.addEventListener('click', () => applyMode(mode)));
```

* **開閉原則**：モードを追加する際の変更点は「`index.html`へのボタン追加」「`modeButtons`へのエントリ追加」「`OperationMode`へのエントリ追加」のみであり、走査ループ・`.active`切り替え処理・`applyMode`本体の書き換えは不要。モードごとの`if`/`else`分岐は持たない。パレット活性判定`currentMode === OperationMode.CREATE`は「図形作成モードのときのみパレットが意味を持つ」という単一の条件であり、パンモード追加時も書き換え不要（パンモード中は自動的に非活性になる）。
* `.active`の付け外しには引数`mode`ではなく`inputTracker.getMode()`の戻り値を用いる（未知の値が渡されてもUIが内部状態と乖離しない）。
* 起動時の初期化として、配線完了後に`applyMode(OperationMode.SELECT)`を1回呼び出し、DOMの初期表示（ボタン`.active`・パレット`.disabled`・パレット内ハイライト）を内部状態に同期させる。
* `OperationMode`は`./core/InputTracker.js`から`InputTracker`と同時にimportする。
* `PaletteController`のインスタンス化は、`applyShapeType`を`onTypeSelected`コールバックとして渡す（関数宣言の巻き上げにより、現行と同様に宣言前の参照で問題ない）。

#### 2-3. `PaletteController.js`
`setActiveTool(tool)`（「`'select'`なら非活性」というモード知識と図形種別のハイライトが混在）を廃止し、責務を以下の2メソッドに分割する。パレットは操作モードを一切知らない。

* **`setEnabled(enabled)`**：`enabled === false`ならルート要素に`.disabled`を付与、`true`なら除去する。
* **`setActiveType(type)`**：5ボタンのうち`type`と一致する1つにのみ`.active`を付与し、他は除去する。
* コンストラクタ第2引数のコールバック名を`onToolSelected`→`onTypeSelected`にリネーム（JSDoc・privateフィールド名`#onTypeSelected`も同様）。`InputTracker`への直接依存を持たない構造は維持する。
* パレット内ハイライトは「記憶している図形種別」を表すため、**選択モード中（パレット`.disabled`で半透明表示）でも記憶中の図形種別のボタンがハイライトされたまま**とする。これによりパレットの`.active`は常に図形種別のみを反映し、操作モードの意味を一切持たない（目視確認ポイントとして懸念事項に記載）。

### 要件3: カーソル形状による視覚フィードバック（`InputTracker.js`）

#### 3-1. 担当モジュール
カーソル形状は「現在の操作モード」「入力状態（`state`）」「カーソル位置に対する当たり判定」から決まる入力解釈の結果であり、これらをすべて保持・算出しているのは`InputTracker`のみであるため、`InputTracker`に担わせる（`CanvasManager`には持たせない）。新規ファイルへの分離はREQのスコープ（変更対象4ファイル）を超えるため行わない。これに伴い`InputTracker.js`先頭の責務JSDocを以下のように更新する。

```js
/**
 * 責務：ユーザー入力の解釈とModelへの反映、および入力解釈の状態（操作モード・当たり判定）に
 * 応じたキャンバス上のマウスカーソル形状のフィードバックを担う。
 */
```

#### 3-2. 判定ロジック
以下2つのprivateメソッドを追加する。

* **`#resolveCursor(point)`**：CSS `cursor`値を返す純粋な判定関数（DOMに触れない）。`point`は論理座標`{x, y}`または`null`（座標が不明なとき：`setMode`直後等）。判定順序：
    1. `currentMode === OperationMode.CREATE` → `'crosshair'`（作成途中を含む）
    2. `currentMode !== OperationMode.SELECT` → `'default'`（将来のモード追加時の安全な既定値。Phase 02-02でパンモード用の分岐をここへ追加する想定）
    3. `state === DRAGGING_HANDLE` → `'move'`
    4. `point === null` → `'default'`
    5. 選択中図形が存在し、`selectedShape.hitTestHandle(point.x, point.y, this.hitTolerance)`が真値 → `'move'`
    6. `model.getHoveredId()`が真値 → `'pointer'`
    7. それ以外 → `'default'`
* **`#updateCursor(point = null)`**：`#resolveCursor(point)`の戻り値を`this.canvas.style.cursor`へ代入する。
* ハンドル判定は選択中図形への`hitTestHandle`のポリモーフィック呼び出しのみで行い、図形種別・ハンドル種別による分岐は持たない。図形上判定は、`handleMouseMove`のIDLE処理で直前に更新されたホバー状態（`hitTest`のポリモーフィック呼び出し結果）を再利用し、当たり判定を二重に走らせない。

#### 3-3. 呼び出し箇所

| 呼び出し元                               | 引数       | 結果                                                   |
| ---------------------------------------- | ---------- | ------------------------------------------------------ |
| コンストラクタ末尾                       | なし       | 初期状態（select）→ `default`                          |
| `setMode()`末尾                          | なし       | create → `crosshair`（マウスを動かす前でも即時反映）／select → `default`（選択・ホバーはクリア済み） |
| `handleMouseMove()`のIDLE・selectモード処理末尾（ホバー更新後） | 論理座標 | `move`／`pointer`／`default`                            |
| `handleMouseDown()`でDRAGGING_HANDLEへ遷移した直後 | なし | `move`（ドラッグ中は維持）                             |

* `DRAWING`／`DRAGGING_HANDLE`中の`handleMouseMove`早期returnの分岐ではカーソルを更新しない（それぞれ`crosshair`／`move`が既に適用済みで変化しないため）。
* `handleMouseUp`（ドラッグ終了）、`handleClick`（選択確定・作成確定）、`handleKeyDown`（削除）、`setShapeType`ではカーソルを更新しない。次の`mousemove`で再評価される（直後のカーソルは直前の形状のまま残る。懸念事項参照）。

### 要件4: 既存の持ち越し事項の解消（`InputTracker.js`）
* `handleMouseMove`のJSDocに「IDLE状態のホバー判定・カーソル更新は選択モード中のみ行う」旨を追記する。
* `handleMouseDown`のJSDocに「IDLE状態かつ選択モード中のみ」ハンドル判定を行う旨を追記する。
* `handleClick`のJSDocの「作成する図形のtypeには`currentTool`をそのまま使用する」記述を、`currentShapeType`を使用する旨、および作成開始は図形作成モード中のみである旨に改める。
* `handleKeyDown`のJSDocの「selectツール中」を「選択モード中」に改める（挙動は変更しない）。
* 旧`currentTool`の`@type {'select'|'line'}`、旧`setTool`の`@param {'select'|'line'}`は、新フィールド・新APIのJSDocとして実態どおりの型注釈に置き換える。

### 要件5: コントロールパネルのヘッダードラッグ（回帰防止）
* `WindowManager.js`は変更しない。`WindowManager`は`.float-window`／`.window-header`のクラス名のみに依存しており、ボタンのDOM id変更の影響を受けない（調査済み）。
* `index.html`の変更はコントロールパネル`.window-body`内のボタン2つの置き換えに限定し、ウィンドウ構造・クラス名・CSSに手を入れない。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./`（`index.html`） - コントロールパネルのDOM
    *   `./js/` - エントリポイント（`main.js`）
    *   `./js/core/` - 入力解釈層（`InputTracker.js`）
    *   `./js/palette/` - 自己完結UI部品（`PaletteController.js`）
*   **関連する論理クラス**:
    *   `InputTracker`（更新：`currentTool`→`currentMode`/`currentShapeType`分離、`setMode`/`setShapeType`/`getMode`/`getShapeType`、カーソル制御`#resolveCursor`/`#updateCursor`）
    *   `OperationMode`（新規：`InputTracker.js`内のexport定数）、`SHAPE_TYPES`（新規：`InputTracker.js`内のexport定数）
    *   `PaletteController`（更新：`setActiveTool`→`setEnabled`/`setActiveType`に分割、コールバック`onTypeSelected`）
    *   `main.js`（更新：`toolButtons`→`modeButtons`、`applyTool`→`applyMode`、`applyShapeType`新設）
    *   参照のみ（変更しない）：`VectorModel`、`CanvasManager`、`WindowManager`、`ShapeFactory`、`shapes/`配下の各図形クラス

### 参照する責務
*   **main.js** : アプリケーションのエントリポイント。DOM読み込み完了後、`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`のインスタンス化とイベントバインドを担う。`applyTool(tool)`でツール切替を一元管理する（`toolButtons`オブジェクトへのエントリ追加のみで新規ボタンに対応できる設計。ただし対応するDOM要素を`index.html`側に先に用意する必要がある）。パレット内ボタンの`.active`制御には関与せず、`paletteController.setActiveTool(tool)`へ完全に委譲する（コントロールパネル領域とパレット領域とで`.active`管理の責任主体を分離）。
*   **VectorModel.js**（参照のみ・変更禁止） : 描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。選択状態(`#selectedId`)・ホバー状態(`#hoveredId`)・作成中図形(`#draftLine`)を保持する。選択/ホバーの読み書きAPI（`selectShape`/`clearSelection`/`getSelectedId`、`setHovered`/`clearHovered`/`getHoveredId`）と、ドラフト（作成中図形）のライフサイクルAPI（`startDraft(x, y, type = 'line')`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。再編集用の`updateVertex(id, vertexIndex, x, y)`/`moveShape(id, dx, dy)`は対象shapeへポリモーフィックに委譲する。図形の生成は`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する。図形削除用の`deleteShape(id)`を持ち、削除対象が選択中/ホバー中であった場合はそれらの状態も同時にクリアする。
*   **CanvasManager.js**（参照のみ・変更禁止） : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedId, draftLine } = {})`の形で呼び出される。
*   **InputTracker.js** : マウス・キーボード入力の解釈、キャンバス座標への変換。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシンとして実装する。`IDLE`ではホバー判定・選択・新規作成の開始、`DRAWING`では作成中図形の追従・確定、`DRAGGING_HANDLE`ではハンドルドラッグによる頂点更新・平行移動を扱い、状態に応じて`VectorModel`の対応するAPIを呼び出す。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。ハンドル種別から更新対象`vertexIndex`への解決も`shape.getVertexIndexForHandle(this.activeHandle)`へ委譲する。現在アクティブなツール種別(`currentTool`: `'select'`/`'line'`)を保持し、`setTool(tool)`で切り替える。切り替え時は選択/ホバー状態のクリアと進行中操作の強制中断（IDLE復帰）を行う。`currentTool`に応じて`handleMouseMove`/`handleMouseDown`/`handleClick`の解釈を排他的に切り替える。`document`購読の`keydown`ハンドラを持ち、`select`ツール中に選択図形がある状態での`Delete`/`Backspace`押下で`VectorModel.deleteShape(id)`を呼び出す。
*   **ShapeFactory.js**（参照のみ・変更禁止） : 図形typeに応じたインスタンス生成を一元的に担うFactory。`type`は`'line' | 'curve' | 'arc' | 'rect' | 'circle'`の5種を受理する。未知の`type`が渡された場合は`Error`をthrowする。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。
*   **WindowManager.js**（参照のみ・変更禁止） : `.float-window`要素の動的検知と、ドラッグ移動・アクティブ最前面化・イベント遮断（下層要素への透過防止）を一元管理する。`VectorModel`が持つ図形データ・選択状態・ツール状態には一切関与しない、DOM統治専任のクラスである。
*   **shapes/**（参照のみ・変更禁止） : `Line`/`Curve`/`Rect`/`Ellipse`はいずれも同一シグネチャの9メソッド（`draw(ctx, t)`、`drawHandles(ctx)`、`drawHover(ctx)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`）を自律実装しており、この契約を満たす限り`core/`層を変更せずに作成・選択・再編集フローへ組み込める。
*   **PaletteController.js** : 図形選択パレット（直線・曲線・弧・矩形・円の5ボタン）の配線を担う自己完結UI部品。`InputTracker`へ直接依存せず、ツール選択時に呼び出す汎用コールバック`onToolSelected(type)`（`main.js`側の`applyTool`）を受け取る。公開メソッド`setActiveTool(tool)`により、パレット本体の`.disabled`制御と5ボタンの`.active`排他制御を行う。`WindowManager`と同様、`VectorModel`・図形データ・選択状態には一切関与しないDOM操作専任のクラスである。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **main.js** : `applyTool(tool)`/`toolButtons`の記述を以下に置き換える。「`applyMode(mode)`で操作モード切替を一元管理する（`modeButtons`オブジェクト（キーは`OperationMode`の値）へのエントリ追加のみで新規モードボタンに対応できる設計。ただし対応するDOM要素を`index.html`側に先に用意し、`InputTracker`の`OperationMode`にも値を追加する必要がある）。`applyMode`は`InputTracker.setMode`呼び出し後に`getMode()`で実状態を読み返して`.active`を同期し、パレットの活性（図形作成モード時のみ）と図形種別ハイライトを`paletteController.setEnabled`/`setActiveType`へ委譲する。図形種別の切替は`applyShapeType(type)`（パレットの`onTypeSelected`コールバック）が担う。起動時に`applyMode(OperationMode.SELECT)`でUI初期表示を内部状態へ同期する。」
*   **InputTracker.js** : `currentTool`/`setTool`の記述を以下に置き換える。「操作モード(`currentMode`: `OperationMode`＝`'select'`/`'create'`)と図形種別(`currentShapeType`: `SHAPE_TYPES`のいずれか、初期値`'line'`)を独立した状態として保持する。`setMode(mode)`で操作モードを切り替え（選択/ホバー状態のクリアと進行中操作の強制中断を伴う）、`setShapeType(type)`で図形種別を切り替える（作成途中の図形のみ破棄、モードは維持）。いずれも未知の値は`console.warn`のうえ無視する。`getMode()`/`getShapeType()`で現在値を読み出せる。図形種別はモード切替でリセットされないため、図形作成モードへ戻ると前回の種別に復帰する。作成開始は図形作成モード中のみ。キャンバスのカーソル形状（作成モード:`crosshair`／選択モードでハンドル上・ドラッグ中:`move`／図形上:`pointer`／その他:`default`）の設定も担い、判定は`hitTestHandle`とホバー状態のポリモーフィックな利用のみで行う。`Delete`/`Backspace`削除は選択モード中のみ有効。」また`OperationMode`/`SHAPE_TYPES`をexportする旨を記載する。
*   **PaletteController.js** : `onToolSelected`/`setActiveTool`の記述を以下に置き換える。「図形種別選択時に呼び出す汎用コールバック`onTypeSelected(type)`（`main.js`側の`applyShapeType`）を受け取る。公開メソッド`setEnabled(enabled)`でパレット本体の`.disabled`制御を、`setActiveType(type)`で5ボタンの`.active`排他制御を行う。操作モードの知識は持たない（活性/非活性の判断は`main.js`側の責務）。」
*   **3. 描画・操作フロー** : 特になし（実行サイクル自体は不変）。
*   **WindowManager.js**（タスク5で確認、任意）：責務記述の「ツール状態」を「操作モード」へ揃えることを推奨する（ソース側の`WindowManager.js`の責務JSDocも同様の表記で、変更禁止のため未修正）。

## 3. タスクリスト

> **タスク共通事項（各実装タスクの最後に必ず行うこと）**
> * コード修正完了後、改修したクラス・メソッド・フィールド・定数のJSDocコメントに記載漏れがないこと、および`.js`ファイル先頭の責務JSDoc（3行以内）が改修後の実態と一致していることを確認する。
> * 本RESの「4. 詳細作業内容」の該当タスク欄に作業内容を記載し、タスクを`[x]`にする。
> * 開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を本RESの『開発資料の更新予定』欄に追記する。
> * 実装中に判断に迷った点、目視確認を推奨する箇所、将来この箇所を修正する際に注意すべき点があれば、本RESの「5. 懸念事項・要確認ポイント」欄に追記する。
>
> **注意**：タスク1〜3の完了時点では`main.js`が旧API（`setTool`／`setActiveTool`／`#tool-select`等）を参照したままのため、アプリは一時的に正常起動しない。テストプレイはタスク4完了後に行う。

*   [x] タスク1: `InputTracker`の操作モード／図形種別の分離とカーソル制御の導入
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   ファイル先頭の責務JSDocを「2. アーキテクチャ設計 要件3 3-1」の文面に更新する（3行以内）。
        *   `OperationMode`（`Object.freeze`、`SELECT`/`CREATE`）と`SHAPE_TYPES`（`Object.freeze`した5種の配列）を`InputState`の直後に定義・exportし、それぞれJSDocを付ける（`OperationMode`には`@readonly`/`@enum {string}`、パンモード等の追加はここへ1エントリ追加する旨を明記）。
        *   コンストラクタの`this.currentTool`を削除し、`this.currentMode = OperationMode.SELECT`と`this.currentShapeType = 'line'`を追加する。JSDocの`@type`は実態どおり（`'select'|'create'`、`'line'|'curve'|'arc'|'rect'|'circle'`）とし、`currentShapeType`には「操作モード切り替えでリセットされず、図形作成モードへ戻った際に前回の種別へ復帰する」旨を明記する。
        *   `setTool(tool)`を削除し、`setMode(mode)`を新設する（要件1 1-3の手順1〜5。手順5は`this.#updateCursor()`）。JSDocに引数バリデーション（未知の値は`console.warn`して無視、状態不変）と既存の3処理を記載する。
        *   `setShapeType(type)`を新設する（要件1 1-3の手順1〜4）。JSDocに「モード・選択・ホバー状態は変更しない」「作成途中の図形のみ破棄する」旨を記載する。
        *   `getMode()`／`getShapeType()`を新設し、JSDoc（`@returns`）を付ける。
        *   `handleMouseMove`／`handleMouseDown`／`handleKeyDown`のガードを`this.currentMode !== OperationMode.SELECT`に置き換える。
        *   `handleClick`の選択分岐を`this.currentMode === OperationMode.SELECT`に、作成開始を`this.currentMode === OperationMode.CREATE`のときのみ`this.model.startDraft(x, y, this.currentShapeType)`を呼ぶ形に改める（それ以外のモードでは何もしない）。
        *   privateメソッド`#resolveCursor(point)`／`#updateCursor(point = null)`を新設する（要件3 3-2の判定順序を厳守。ハンドル判定は選択中図形の`hitTestHandle`、図形上判定は`model.getHoveredId()`の再利用とし、図形種別の分岐を持ち込まない）。JSDocに判定順序と戻り値（CSS `cursor`値）を記載する。
        *   `#updateCursor`の呼び出しを要件3 3-3の表のとおり追加する（コンストラクタ末尾、`setMode`末尾、`handleMouseMove`のIDLE・選択モード処理のホバー更新後に論理座標付きで、`handleMouseDown`でDRAGGING_HANDLEへ遷移した直後）。
        *   JSDocの持ち越し事項を解消する（要件4の全項目：`handleMouseMove`/`handleMouseDown`のガード条件明記、`handleMouseMove`へのカーソル更新の追記、`handleClick`/`handleKeyDown`の記述更新）。
        *   スコープ外の既存コード（`getLogicalCoordinate`、DRAWING/DRAGGING_HANDLEの処理本体等）の整形・リファクタリングは行わない。

*   [x] タスク2: `PaletteController`の責務分割（活性制御と図形種別ハイライトの分離）
    *   **対象ファイル** :
        *   `./js/palette/PaletteController.js` : 更新
    *   **作業内容** :
        *   `setActiveTool(tool)`を削除し、`setEnabled(enabled)`（`.disabled`の付け外しのみ）と`setActiveType(type)`（5ボタンの`.active`排他制御のみ）を新設する。いずれもJSDoc（`@param`の型：`boolean`／`'line'|'curve'|'arc'|'rect'|'circle'`）を付け、`setActiveType`には「パレットの活性/非活性に関係なくハイライトを更新する」「一致するボタンがない値の場合は全ボタン`.active`なしになる」旨を記載する。
        *   コンストラクタ第2引数・privateフィールドを`onToolSelected`/`#onToolSelected`から`onTypeSelected`/`#onTypeSelected`へリネームし、JSDocの例示を`applyShapeType(type)`に改める。
        *   `#rootElement`のJSDocの「setActiveTool時の.disabled制御対象」を「setEnabled時」に、`#buttons`のJSDocの「setActiveTool時」を「setActiveType時」に改める。
        *   ファイル先頭の責務JSDocを、「5ボタンのclick購読による図形種別の選択要求（コールバック経由）、および`setEnabled(enabled)`によるパレット本体の活性/非活性制御・`setActiveType(type)`による各ボタンのアクティブ表示制御を担う。操作モード・VectorModel・図形データ・選択状態には一切関与しない。」の趣旨に更新する（3行以内）。
        *   `InputTracker`をimportしないこと（疎結合維持）。`#BUTTON_DEFS`は変更しない。

*   [x] タスク3: コントロールパネルの操作モードボタンのDOM置き換え
    *   **対象ファイル** :
        *   `./index.html` : 更新
    *   **作業内容** :
        *   `#window-control-panel`の`.window-body`内の2ボタンを置き換える：`<button type="button" id="mode-select" class="tool-btn active">🖱 選択</button>`、`<button type="button" id="mode-create" class="tool-btn">✏ 図形作成</button>`。
        *   それ以外（ウィンドウ構造・`.window-header`・CSS・図形パレット部）は変更しない（ヘッダードラッグの回帰防止）。
        *   本タスクはDOMのみの変更であり、JSDoc対象の`.js`ファイルはない。

*   [x] タスク4: `main.js`の操作モード／図形種別の配線の再構築
    *   **対象ファイル** :
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `import { InputTracker } from './core/InputTracker.js';`を`import { InputTracker, OperationMode } from './core/InputTracker.js';`に改める。
        *   `toolButtons`を`modeButtons`にリネームし、キーを`[OperationMode.SELECT]`/`[OperationMode.CREATE]`、値を`document.getElementById('mode-select')`/`('mode-create')`とする（タスク3で用意したDOM idと一致させること）。直前のコメントを「コントロールパネルがownする操作モードボタンを、`OperationMode`の値でマッピングする汎用テーブル。モード追加時は`index.html`へのボタン追加・`OperationMode`への値追加・本テーブルへのエントリ追加のみで対応できる」趣旨に更新する。
        *   `new PaletteController(shapePaletteEl, applyTool)`を`new PaletteController(shapePaletteEl, applyShapeType)`に改める。
        *   `applyTool(tool)`を削除し、要件2 2-2のコードどおり`applyMode(mode)`と`applyShapeType(type)`を新設する。それぞれにJSDoc（役割、`@param`の型、`getMode()`/`getShapeType()`で実状態を読み返して表示同期する理由）を付ける。モードごとの`if`/`else`分岐は書かない。
        *   クリックリスナー登録ループを`modeButtons`走査・`applyMode(mode)`呼び出しに改める。
        *   ループの後に起動時初期化として`applyMode(OperationMode.SELECT);`を追加し、UI初期表示を内部状態に同期する旨のコメントを付ける。
        *   ファイル先頭の責務JSDocは現状（「各モジュールの初期化と連携(依存性の注入)を担う。」）で実態と一致しているため変更不要であることを確認する。
        *   完了後、テストプレイで以下を確認できる状態にする（確認結果または未確認である旨を詳細作業内容に記載）：(a)起動直後に「選択」がハイライト・パレット非活性、(b)「図形作成」でパレット活性・「直線」がハイライト・カーソル`crosshair`、(c)パレットで種別を切り替えてもコントロールパネルは「図形作成」のまま、(d)選択→図形作成の往復で最後に選んだ種別へ復帰、(e)選択モードでハンドル上`move`／図形上`pointer`／空白`default`、(f)両ウィンドウのヘッダードラッグが機能する、(g)選択モード中のみ`Delete`/`Backspace`で削除できる。

*   [x] タスク5: JSDoc・責務定義の最終確認
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 確認（必要時のみ更新）
        *   `./js/palette/PaletteController.js` : 確認（必要時のみ更新）
        *   `./js/main.js` : 確認（必要時のみ更新）
    *   **作業内容** :
        *   3ファイル全体を通読し、`currentTool`／`setTool`／`setActiveTool`／`applyTool`／`toolButtons`／`onToolSelected`／`tool-select`／`tool-line`の残存（コード・コメント両方）がないことを検索で確認する。
        *   新設・改修したクラス・メソッド・フィールド・定数のすべてにJSDocが付いており、`@param`/`@type`/`@returns`の型注釈が実態と一致していることを確認する。記載漏れがあれば補う（ロジックの変更は行わない）。
        *   各ファイル先頭の責務JSDoc（3行以内）が実態と一致していることを確認する。

*   [x] タスク6: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映【固定タスク】
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   本RESの『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄（タスク1〜5で追記された内容を含む）を確認し、4章の`main.js`／`InputTracker.js`／`PaletteController.js`の責務記述へ反映する。本作業では3項目とも更新必須である。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、**本タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。タスク1〜5の中で資料を書き換えてはならない。
        *   反映後、更新予定欄の各項目が資料へ反映済みであることを詳細作業内容に記載する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: `InputTracker`の操作モード／図形種別の分離とカーソル制御の導入
*   **作業内容** :
    *   `./js/core/InputTracker.js`のみを更新（他ファイルは未変更）。
    *   **責務JSDoc**：ファイル先頭を要件3 3-1の文面（2行）に更新。
    *   **定数**：`InputState`の直後に`OperationMode`（`Object.freeze`、`SELECT:'select'`/`CREATE:'create'`、`@readonly`/`@enum {string}`、モード追加時はここへ1エントリ追加する旨を明記）と`SHAPE_TYPES`（`Object.freeze`した5種の配列、`@type {ReadonlyArray<...>}`、`includes()`による受理判定専用・`ShapeFactory`と一致させる旨を明記）を定義・export。
    *   **状態フィールド**：`this.currentTool`を削除し、`this.currentMode = OperationMode.SELECT`（`@type {'select'|'create'}`）と`this.currentShapeType = 'line'`（`@type {'line'|'curve'|'arc'|'rect'|'circle'}`、モード切替でリセットされず前回種別へ復帰する旨を明記）を追加。
    *   **公開API**：
        *   `setTool(tool)`を削除し`setMode(mode)`を新設。未知の値は`console.warn`して即return（状態・選択・カーソル不変）。有効値では`currentMode`更新→選択/ホバーの無条件クリア→DRAWING/DRAGGING_HANDLEなら`cancelDraft()`＋IDLE復帰→`this.#updateCursor()`（同一モード再指定時も無条件実行）。
        *   `setShapeType(type)`を新設。未知の値は`console.warn`して即return。有効値では`currentShapeType`更新、DRAWINGなら`cancelDraft()`＋IDLE復帰。モード・選択・ホバー・カーソルには触れない。
        *   `getMode()`／`getShapeType()`を新設（`@returns`付き）。
    *   **ハンドラのガード**：`handleMouseMove`（IDLE処理）／`handleMouseDown`／`handleKeyDown`のガードを`this.currentMode !== OperationMode.SELECT`に置換。`handleClick`の選択分岐を`this.currentMode === OperationMode.SELECT`に、作成開始を`if (this.currentMode === OperationMode.CREATE)`の明示ガード内で`startDraft(x, y, this.currentShapeType)`を呼ぶ形に改めた（それ以外のモードではIDLE時クリックを無視）。
    *   **カーソル制御**：privateメソッド`#resolveCursor(point)`（要件3 3-2の判定順序(1)〜(7)を厳守した純粋関数。ハンドル判定は選択中図形の`hitTestHandle`、図形上判定は`model.getHoveredId()`の再利用のみで、図形種別の分岐なし）と`#updateCursor(point = null)`（`this.canvas.style.cursor`へ代入）を新設。呼び出しは要件3 3-3の表どおり、コンストラクタ末尾（引数なし）、`setMode`末尾（引数なし）、`handleMouseMove`のIDLE・選択モード処理のホバー更新後（論理座標`{x, y}`付き）、`handleMouseDown`のDRAGGING_HANDLE遷移直後（引数なし）の4箇所。
    *   **JSDoc持ち越し事項（要件4）**：`handleMouseMove`（IDLE・選択モード中のみホバー判定とカーソル更新）、`handleMouseDown`（IDLE・選択モード中のみ、遷移後にカーソル更新）、`handleClick`（`currentShapeType`使用・作成開始は図形作成モード中のみ・他モードは無視）、`handleKeyDown`（「selectツール中」→「選択モード中」）を更新。旧`currentTool`/`setTool`の型注釈は新フィールド・新APIの実態どおりの型注釈に置き換え済み。
    *   **確認**：`node --check`で構文エラーなしを確認。`currentTool`／`setTool`の残存がないことを検索で確認。`getLogicalCoordinate`・DRAWING/DRAGGING_HANDLEの処理本体には手を入れていない。
    *   **テストプレイ**：`main.js`が旧API（`setTool`）を参照したままのため、本タスク完了時点ではアプリは正常起動しない（計画どおり）。動作確認はタスク4完了後に行う。

### タスク2: `PaletteController`の責務分割（活性制御と図形種別ハイライトの分離）
*   **作業内容** :
    *   `./js/palette/PaletteController.js`のみを更新（他ファイルは未変更）。
    *   **責務JSDoc**：ファイル先頭を「5ボタンのclick購読による図形種別の選択要求（コールバック経由）、`setEnabled(enabled)`による活性/非活性制御・`setActiveType(type)`によるアクティブ表示制御を担う。操作モード・VectorModel・図形データ・選択状態には一切関与しない。」の趣旨（3行）に更新。
    *   **公開API**：`setActiveTool(tool)`（`'select'`判定というモード知識を含んでいた）を削除し、以下2メソッドを新設。
        *   `setEnabled(enabled)`：`classList.toggle('disabled', !enabled)`でルート要素の`.disabled`の付け外しのみを行う。`.active`には触れない。JSDocに`@param {boolean}`と「活性判断は呼び出し側（`main.js`）の責務」である旨を記載。
        *   `setActiveType(type)`：5ボタンのうち`type`と一致する1つにのみ`.active`を付与する排他制御のみ。JSDocに`@param {'line'|'curve'|'arc'|'rect'|'circle'}`、「パレットの活性/非活性に関係なくハイライトを更新する」「一致するボタンがない値の場合は全ボタン`.active`なし」を記載。
    *   **リネーム**：コンストラクタ第2引数`onToolSelected`→`onTypeSelected`、privateフィールド`#onToolSelected`→`#onTypeSelected`。JSDocの例示を`applyShapeType(type)`に変更。
    *   **フィールドJSDoc**：`#rootElement`の「setActiveTool時」→「setEnabled時」、`#buttons`の「setActiveTool時」→「setActiveType時」に変更。
    *   `InputTracker`のimportなし（疎結合維持）、`#BUTTON_DEFS`は未変更。
    *   **確認**：`node --check`で構文エラーなしを確認。ファイル内に`Tool`（`setActiveTool`/`onToolSelected`等）および`import`の残存がないことを検索で確認。
    *   **テストプレイ**：`main.js`が旧API（`setActiveTool`）を参照したままのため未実施（計画どおり、タスク4完了後に実施）。

### タスク3: コントロールパネルの操作モードボタンのDOM置き換え
*   **作業内容** :
    *   `./index.html`のみを更新（他ファイルは未変更）。
    *   `#window-control-panel`の`.window-body`内の2ボタンを置き換えた：
        *   `#tool-select`「🖱 選択ツール」→ `<button type="button" id="mode-select" class="tool-btn active">🖱 選択</button>`（初期`.active`を維持）
        *   `#tool-line`「／ 直線ツール」→ `<button type="button" id="mode-create" class="tool-btn">✏ 図形作成</button>`
    *   ウィンドウ構造（`.float-window`／`.window-header`／`.window-close-btn`）、CSS（`.tool-btn`／`.disabled`のコメント含む）、図形パレット部（初期`.disabled`）は一切変更していない（ヘッダードラッグの回帰防止）。
    *   **確認**：`index.html`内に`tool-select`／`tool-line`の残存がなく、`mode-select`／`mode-create`が各1箇所のみ存在することを検索で確認。
    *   **テストプレイ**：`main.js`が旧id（`#tool-select`/`#tool-line`）および旧APIを参照したままのため未実施（計画どおり、タスク4完了後に実施）。

### タスク4: `main.js`の操作モード／図形種別の配線の再構築
*   **作業内容** :
    *   `./js/main.js`のみを更新（他ファイルは未変更）。
    *   **import**：`import { InputTracker, OperationMode } from './core/InputTracker.js';`に変更。
    *   **ボタン表**：`toolButtons`を`modeButtons`にリネームし、キーを`[OperationMode.SELECT]`/`[OperationMode.CREATE]`、値を`getElementById('mode-select')`/`('mode-create')`とした（タスク3のDOM idと一致）。直前コメントを「`OperationMode`の値でマッピングする汎用テーブル。モード追加時は`index.html`へのボタン追加・`OperationMode`への値追加・本テーブルへのエントリ追加のみで対応できる（開閉原則）」趣旨に更新。
    *   **パレット配線**：`new PaletteController(shapePaletteEl, applyShapeType)`に変更。
    *   **切替関数**：`applyTool(tool)`を削除し、要件2 2-2のコードどおり`applyMode(mode)`／`applyShapeType(type)`を新設。JSDocに役割・呼び出し元・`@param`の型（`'select'|'create'`／`'line'|'curve'|'arc'|'rect'|'circle'`）・`getMode()`/`getShapeType()`で実状態を読み返して表示同期する理由（未知の値が無視されてもUIと内部状態を乖離させない）を記載。モードごとの`if`/`else`分岐なし。
    *   **リスナー登録**：`modeButtons`を走査して`applyMode(mode)`を呼ぶループに変更。
    *   **起動時初期化**：ループ直後に`applyMode(OperationMode.SELECT);`を追加し、UI初期表示を内部状態へ同期する旨のコメントを付与。
    *   **責務JSDoc**：ファイル先頭（「各モジュールの初期化と連携(依存性の注入)を担う。」）は実態と一致しているため変更なし。
    *   **確認**：`node --check`で構文エラーなし。`main.js`内に`tool`/`Tool`の残存がないことを検索で確認。
    *   **テストプレイ**（ローカルHTTPサーバー＋ブラウザで実施。(a)〜(d)はボタンclick、(e)(g)はcanvasへのマウスイベント送出、(f)は実マウスドラッグで確認。コンソールエラーなし）：
        *   (a) 起動直後：「選択」のみ`.active`、パレット`.disabled`、カーソル`default` … OK（パレット内は「直線」がハイライト。懸念事項「パレットのハイライト表示」の想定どおり）
        *   (b) 「図形作成」押下：「図形作成」のみ`.active`、パレット活性、「直線」ハイライト、カーソル`crosshair` … OK
        *   (c) パレットで「弧」押下：コントロールパネルは「図形作成」のまま、パレットは「弧」のみハイライト … OK
        *   (d) 選択→図形作成の往復：「弧」へ復帰（選択モード中も半透明パレット内で「弧」がハイライト） … OK
        *   (e) 直線を作成後、選択モードで空白`default`／図形上`pointer`／選択後のハンドル上`move`／ハンドルドラッグ中`move`／ドラッグ後の空白`default` … OK
        *   (f) コントロールパネル：ヘッダードラッグで移動 … OK。図形パレット：図形作成モード（活性時）にヘッダードラッグで移動 … OK。選択モード（`.disabled`）中はドラッグ不可（既存CSS`pointer-events: none`による従来挙動。懸念事項参照）
        *   (g) 図形を選択→図形作成モードへ切替→`Delete`：削除されない（切替時に選択解除されるため）… OK。選択モードで選択→`Delete`：削除される … OK

### タスク5: JSDoc・責務定義の最終確認
*   **作業内容** :
    *   対象3ファイル（`InputTracker.js`／`PaletteController.js`／`main.js`）を通読した。JSDocの追記のみを行い、ロジックは変更していない。
    *   **旧名称の残存確認**：`js/`配下で`currentTool`／`setTool`／`setActiveTool`／`applyTool`／`toolButtons`／`onToolSelected`／`tool-select`／`tool-line`を検索し、コード・コメントともに残存なし（0件）。あわせて`tool`（大文字小文字無視）・`ツール`も検索した。対象3ファイルは0件。対象外の`WindowManager.js`（変更禁止）の責務JSDocに「ツール状態」の表記が1件残っている（懸念事項参照）。
    *   **JSDoc型注釈の照合**：以下が実態と一致していることを確認した。
        *   `InputTracker`：`OperationMode`（`@readonly`/`@enum {string}`）、`SHAPE_TYPES`（`@type {ReadonlyArray<...>}`）、`currentMode`／`currentShapeType`の`@type`、`setMode`／`setShapeType`の`@param`、`getMode`／`getShapeType`の`@returns`、`#resolveCursor`の`@param`/`@returns`（`'crosshair'|'move'|'pointer'|'default'`。実装の戻り値4種と一致）、`#updateCursor`の`@param`（省略可・既定値`null`）、各ハンドラの記述（ガード条件・カーソル更新タイミング）。
        *   `PaletteController`：`#rootElement`／`#onTypeSelected`／`#buttons`の`@type`と説明、コンストラクタの`@param`、`setEnabled`（`@param {boolean}`）、`setActiveType`（`@param {'line'|'curve'|'arc'|'rect'|'circle'}`）。
        *   `main.js`：`applyMode`（`@param {'select'|'create'}`）、`applyShapeType`（`@param {'line'|'curve'|'arc'|'rect'|'circle'}`）、`renderCurrentState`。
    *   **補った記載漏れ（3件）**：
        *   `InputTracker`クラス宣言にクラスJSDocがなかったため追加した（状態遷移マシンであること、操作モードと図形種別を独立に保持すること、カーソル形状を更新すること）。
        *   `PaletteController`クラス宣言にクラスJSDocがなかったため追加した（自己完結UI部品であること、コールバックで通知すること、外部の指示で活性/ハイライトを切り替えること、`InputTracker`へ直接依存しないこと）。
        *   `main.js`の`modeButtons`（データ構造）の説明は`//`コメントのみだったため、同じ文面のJSDocブロックに置き換え、`@type {Object<string, HTMLElement>}`（キー：`OperationMode`の値）を追加した。
    *   **責務JSDoc（ファイル先頭）**：3ファイルとも3行以内で、改修後の実態と一致していることを確認した（変更なし）。`InputTracker.js`は入力解釈とカーソル形状のフィードバック、`PaletteController.js`はclick購読・`setEnabled`・`setActiveType`で、モードには関与しない。`main.js`は初期化と依存性の注入。
    *   **確認**：3ファイルとも`node --check`で構文エラーなし。JSDocの追加だけなので、テストプレイ（タスク4で実施済み）はやり直していない。

### タスク6: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映【固定タスク】
*   **作業内容** :
    *   `./PROJECT_ARCHITECTURE.md`のみを更新（ソースコードは未変更）。4章の責務記述3項目について、本RES『開発資料の更新予定』欄の該当文面に置き換えた。
        *   **main.js** … 反映済み。`applyTool(tool)`/`toolButtons`/`setActiveTool`の記述を、`applyMode(mode)`・`modeButtons`（キーは`OperationMode`の値）・`getMode()`による読み返し同期・`setEnabled`/`setActiveType`への委譲・`applyShapeType(type)`・起動時の`applyMode(OperationMode.SELECT)`の記述に置き換えた。もとの「コントロールパネル領域とパレット領域とで`.active`管理の責任主体を分離」という趣旨は残している。
        *   **InputTracker.js** … 反映済み。`currentTool`/`setTool`の記述を、`currentMode`/`currentShapeType`・`OperationMode`/`SHAPE_TYPES`のexport・`setMode`/`setShapeType`（未知値は`console.warn`のうえ無視）・`getMode`/`getShapeType`・種別の復帰・作成開始は図形作成モード中のみ・カーソル形状の設定・選択モード中のみ削除可能の記述に置き換えた。前半の状態遷移マシン・ポリモーフィック呼び出し・`getVertexIndexForHandle`の記述は変更していない。
        *   **PaletteController.js** … 反映済み。`onToolSelected`/`applyTool`/`setActiveTool`の記述を、`onTypeSelected(type)`（`applyShapeType`）・`setEnabled(enabled)`・`setActiveType(type)`・操作モードの知識を持たない旨の記述に置き換えた。
        *   **3. 描画・操作フロー** … 更新予定欄で「特になし」のため変更していない。
        *   **WindowManager.js（任意項目）** … 反映していない（理由は懸念事項【タスク6】を参照）。
    *   **確認**：`PROJECT_ARCHITECTURE.md`内で`currentTool`／`setTool`／`setActiveTool`／`applyTool`／`toolButtons`／`onToolSelected`を検索し、0件であることを確認した。

## 5. 懸念事項・要確認ポイント
* **`SHAPE_TYPES`と`ShapeFactory`の受理種別の二重管理**：`setShapeType`のバリデーション用に`InputTracker.js`へ5種のホワイトリストを置くため、`ShapeFactory`の受理種別と二重管理になる。将来図形種別を追加する際は`ShapeFactory`・`SHAPE_TYPES`・`PaletteController.#BUTTON_DEFS`・`index.html`の4箇所を揃える必要がある。`ShapeFactory`側に受理種別一覧を公開させて単一化するのが望ましいが、本作業では`ShapeFactory.js`が変更禁止のため見送る（後続のInterrupt候補）。
* **リネームによる用語変更**：概念分離を徹底するため、`main.js`の`toolButtons`→`modeButtons`、`applyTool`→`applyMode`、`PaletteController`の`onToolSelected`→`onTypeSelected`、`setActiveTool`→`setEnabled`/`setActiveType`とリネームする。REQ本文は旧名`toolButtons`で記述されているが、要件（ボタン表へのエントリ追加のみでモード追加に対応できる構造）は新名で同等に満たす。Phase 02-02以降のREQは新名称での記述を推奨する。
* **パンモード追加時の変更点**：Phase 02-02では`index.html`・`modeButtons`に加え、`InputTracker`の`OperationMode`へ1エントリの追加が必要（バリデーションが`OperationMode`の値を正としているため）。またパンモードのカーソル（`grab`等）は`#resolveCursor`の手順2（選択・作成以外のモードの既定値）の位置へ分岐を追加する想定。
* **パレットのハイライト表示（目視確認推奨）**：選択モード中もパレット（半透明・非活性）内で記憶中の図形種別がハイライトされたままになる（パレットの`.active`を図形種別のみに対応させるため）。旧実装では選択モード中は全ボタン非ハイライトだったため見た目が変わる。違和感がある場合は、`main.js`の`applyMode`でのみ制御を変えれば`PaletteController`側は変更不要。
* **カーソル更新のタイミング（目視確認推奨）**：カーソルは`setMode`・`mousemove`・ハンドルドラッグ開始時にのみ再評価する。そのため、クリックで図形を選択した直後（ハンドルが出現した位置にカーソルがある場合）、ハンドルドラッグ終了直後、`Delete`での削除直後などは、マウスを少し動かすまで直前のカーソル形状が残る。実用上の問題は小さいと判断したが、気になる場合は`handleClick`/`handleMouseUp`/`handleKeyDown`末尾での再評価（座標を保持する必要あり）を後続で検討する。
* **既存JSDocの古い記述（本作業の対象外）**：`InputState`のJSDoc（「新規Line作成中」「start/end/move」）および`activeHandle`の`@type {'start'|'end'|'move'|null}`は、Phase 1で曲線・矩形・楕円が追加された後の実態（`control`等のハンドル）と一致していない。REQ要件4の対象（ツール種別の型注釈）外であり、スコープ厳守のため本作業では修正しない（後続のInterrupt候補）。
* **【タスク1】作成モードIDLE時の`mousemove`ではカーソルを再評価しない**：設計どおり、`handleMouseMove`のカーソル更新は「IDLE・選択モード」処理内のみ。作成モードの`crosshair`は`setMode`呼び出し時に適用され、以降は変化しないため実害はないが、将来`#resolveCursor`に「作成モード中でも位置により形状を変える」分岐を加える場合は、`handleMouseMove`の早期returnより前に呼び出しを追加する必要がある。
* **【タスク1】`#resolveCursor`内でのハンドル判定の重複**：選択モードIDLE時の`mousemove`ごとに、ホバー判定（全図形`hitTest`）に加えて選択中図形1つへの`hitTestHandle`を1回実行する。図形全体の当たり判定は二重化していないが、`handleMouseDown`でも同じ`hitTestHandle`を行っているため、ハンドル判定ロジックを変更する際は両者の結果が一致することを確認すること。
* **【タスク1】`InputState`の`DRAWING`の説明文**：`handleMouseMove`のJSDocにある「作成中Lineの終点」等の「Line」表記は旧来のまま（DRAWING処理本体はスコープ外のため未修正）。既存の「既存JSDocの古い記述」懸念と合わせて後続のInterrupt候補。
* **【タスク2】`setEnabled`の引数の扱い**：実装は`classList.toggle('disabled', !enabled)`のため、`boolean`以外の値が渡された場合は真偽値として解釈される（例：`undefined`は非活性扱い）。計画上の呼び出し元は`main.js`の`currentMode === OperationMode.CREATE`（常に`boolean`）のみのため実害はないが、将来別の箇所から呼ぶ際は`boolean`を渡すこと。
* **【タスク2】`setActiveType`のローカル変数名**：引数`type`と`#buttons`要素の`type`プロパティの名前衝突を避けるため、分割代入で`type: buttonType`としている。`#BUTTON_DEFS`のプロパティ名を変更する場合は合わせて修正すること。
* **【タスク3】ボタンのクラス名`tool-btn`は据え置き**：計画どおりクラス名は`tool-btn`のまま（CSS変更禁止のため）。DOM idは`mode-*`に改めたが、クラス名には旧来の「tool」表記が残る。CSSセレクタ・パレット側ボタンと共用しているため、将来リネームする場合は`index.html`のCSS定義と全ボタンを同時に修正すること。
* **【タスク3】タスク4でのid一致（要注意）**：タスク4で`main.js`の`modeButtons`が参照するidは`mode-select`／`mode-create`であること。不一致の場合`getElementById`が`null`を返し、`addEventListener`で起動時エラーとなる。
* **【タスク4】非活性パレットはヘッダードラッグ不可（従来挙動・目視確認推奨）**：`.disabled`のCSSが`pointer-events: none`をウィンドウ全体へ適用するため、選択モード中は図形パレットのヘッダーもドラッグできない。本作業前（選択ツール中）も同じ挙動であり回帰ではないが、Phase 02-00の「ウィンドウ操作」観点で問題とする場合は、`.disabled`の適用先を`.window-body`に限定する等のCSS変更が必要（本REQではCSS変更禁止のため見送り）。
* **【タスク4】`applyMode`の起動時呼び出しによる二重同期**：`index.html`側にも初期`.active`（`#mode-select`）・初期`.disabled`（パレット）が静的に記述されており、起動時`applyMode(OperationMode.SELECT)`で同じ状態に上書き同期される。JS読み込み前の初期表示を保つため静的記述は残しているが、初期モードを変更する場合は`index.html`と`main.js`の両方を揃えること。
* **【タスク4】テストプレイ環境**：canvasが0×0の状態（ブラウザ非表示時にロード）では描画されないことを確認時に観測したが、リロードで正常化しており本作業とは無関係（`CanvasManager`の初期サイズ取得のタイミングに起因すると思われる）。
* **【タスク5】`WindowManager.js`の責務JSDocに残る「ツール状態」表記**：`WindowManager.js`先頭の責務JSDocに「図形データ・選択状態・ツール状態など」とある。今回の用語分離後は「操作モード」と呼ぶべき箇所だが、本作業では変更禁止ファイルのため修正していない。意味は通じるため実害はない。後続で`WindowManager.js`に触れる際に「操作モード」へ揃えることを推奨する（開発資料4章の`WindowManager.js`の記述「ツール状態」も同様）。
* **【タスク5】クラスJSDocの追加（目視確認推奨）**：`InputTracker`・`PaletteController`のクラス宣言に既存のクラスJSDocがなかったため、憲法の「クラスにはJSDocを記述」に従って追加した。内容はファイル先頭の責務JSDocと重なるが、クラス単位の説明として残している。責務を変更する際は、ファイル先頭とクラスJSDocの両方を揃えること。
* **【タスク5】`modeButtons`の`@type`**：`getElementById`は型上`HTMLElement|null`を返すが、`index.html`に対応idが必ず存在する前提で`@type {Object<string, HTMLElement>}`とした。idが一致しない場合の起動時エラーについては、既存の懸念「【タスク3】タスク4でのid一致」を参照。
* **【タスク6】`WindowManager.js`の「ツール状態」表記は未反映（判断事項）**：更新予定欄では任意項目である。ソース側の`WindowManager.js`の責務JSDocも「ツール状態」のままで、変更禁止のため修正できない。開発資料だけを書き換えるとソースと資料の表記がずれるため、今回は反映を見送った。後続で`WindowManager.js`に触れる際に、ソースと資料の両方を「操作モード」へ揃えること。
* **【タスク6】開発資料に残る汎用的な「ツール」表記**：2章のフォルダ構成（`palette/`の「ツールバー・カラーピッカー等」）と4章`palette/`の説明に「ツールバー」という語がある。これはUI部品の一般名称で、操作モードの概念とは関係がないため変更していない。
* **一時的な起動不能状態**：タスク順序（DOM→ボタン表）を守るため、タスク1〜3完了時点では`main.js`が旧APIを参照しており正常起動しない。タスク単位のコミットを行う場合は、この状態のコミットが含まれることに留意。
