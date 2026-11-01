# PROJECT_ARCHITECTURE.md
## OZ Vector Editor 全体仕様および実装定義書

本資料は、「OZ Vector Editor」（ブラウザ版ベクターパーツ作成エディタ）をAI-IDEが実装・修正する際の「全体マップ（見取り図）」および「インデックス（索引）」となる設計図である。
直接コードを読めば分かる内部ロジックの詳細（関数の中身、引数の全列挙、出力コードのテンプレート等）は本資料には記載しない。実装が進むごとに、セクション4を随時追記・更新していくこと。

---

### 1. プロジェクトフォルダ構造
AIは新規にファイルを作成、あるいはログを記録する際、必ずこの構造に準拠すること。各ファイルの責務は本資料の「4. 各モジュールの責務リファレンス」を唯一の正解（SSOT）とし、ここには記載しない。

```text
/oz-vector-editor/
├── index.html                  # スタイルはCSSファイル分割せず<style>タグに内包
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── VectorModel.js
│   │   ├── CanvasManager.js
│   │   ├── ViewTransform.js
│   │   ├── InputTracker.js
│   │   ├── KeyboardShortcuts.js
│   │   ├── DragTracker.js
│   │   ├── ShapeFactory.js
│   │   └── WindowManager.js
│   ├── shapes/
│   │   └── (図形クラスを種別ごとに1ファイルで追加していく)
│   ├── palette/
│   │   ├── PaletteController.js
│   │   └── (ツールバー・カラーピッカー等、自己完結するUI部品をここに追加していく)
│   └── io/
│       ├── CodeExporter.js
│       └── CodeImporter.js
│
├── PROJECT_CONSTITUTION.md
├── PROJECT_ARCHITECTURE.md
│
├── _doc/
│   # 人間用の開発資料、未確定の仕様メモ、手書きスケッチ等
│   # AIは明示的な指示がない限り、この中身を勝手に読んで行動してはならない
│
└── _log/
    ├── req/
    │   └── closed/    # フェイズ大番号移行時にアーカイブ済みREQの退避先
    └── res/
        └── closed/    # フェイズ大番号移行時にアーカイブ済みRESの退避先
```

**フォルダ分割の方針**：横断的な処理（入力→状態→描画の複数層にまたがるもの）は `core/` に置く。自己完結する機能（1種類の図形、1つのUI部品など）は、それぞれ専用フォルダにまとめる。

---

### 2. データ構造（Model）の概要
ShapeDataは `id, type, color, strokeWidth, isFilled, points` を共通プロパティとして持つ（正式な型定義はコード側の `core/VectorModel.js` を参照）。
ShapeDataの座標（`points`）はすべてワールド座標である。ビュー変換（表示倍率・オフセット）は図形データに含まれず、表示専用の状態として`core/ViewTransform.js`が保持する（パン・ズームによって図形データが書き換わることはない）。
選択状態は**選択集合**（選択中の図形idの集合。0個以上で、常に現存図形のidのみを含む）であり、範囲選択中の表示用の**選択矩形**（ワールド座標の対角2点。押下点と現在のカーソル位置で、正規化しない）とともに`core/VectorModel.js`が保持する。

---

### 3. 描画・操作フロー（実行サイクル）

1.  **起動処理 (`main.js`)** : DOMの読み込み完了後、`VectorModel`, `CanvasManager`, `InputTracker` をインスタンス化し、イベントをバインドする。
2.  **描画サイクル (`CanvasManager.js`)** : `requestAnimationFrame` を用いた描画ループ。`VectorModel` からShape配列を読み込み、順次Canvas上に描画する。
3.  **入力監視 (`InputTracker.js`・`KeyboardShortcuts.js` → `VectorModel.js`)** : マウスドラッグによる頂点・図形の移動、クリックによる選択、範囲選択（マーキー選択）による複数選択、選択集合の一括削除（削除ボタン・`Delete`/`Backspace`）、キーボードショートカット。状態が更新されると `VectorModel` が更新イベントを発火し、`CanvasManager` に再描画を促す。
    *   **ドラッグのライフサイクル** : 左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）とパンの、ボタン押下から解放までのライフサイクル（開始ボタン・移動量閾値・追従/終了検知・中断・終了直後のclick抑止）は`DragTracker`が`window`へのcapture購読で一元管理し、ドラッグの意味の解釈（パン量・頂点変形・選択集合の平行移動・範囲選択）は`InputTracker`が行う。閾値判定のみスクリーン座標で行い、当たり判定・移動量・選択矩形はワールド座標で扱う。
    *   **範囲選択の流れ** : 選択モードで空白を左ボタンで押下 → 閾値（スクリーン3px）超過後、押下点と現在のカーソル位置（ワールド座標）で`VectorModel`の選択矩形を更新（描画は`CanvasManager`）→ 解放時に矩形を正規化し、各図形の`intersectsRect`をポリモーフィックに呼んで掛かった図形で選択集合を置き換え、選択矩形を破棄する（0件なら全解除）。中断（blur・モード切替）時は選択矩形を破棄するのみで確定しない。
    *   **キーボード操作** : `document`の`keydown`は、`Space`を`InputTracker`（スペースパン）、それ以外のキーを`KeyboardShortcuts`（対応表`SHORTCUT_BINDINGS`と受理判定）が排他的に担当する（同一キーを二重に解釈しない。`keyup`は`Space`のみ`InputTracker`が購読）。`KeyboardShortcuts`の受理判定の順序は「IME変換中 → テキスト入力中（`isTextInputElement`）→ 対応表照合（修飾キー・Shift規則）→ ドラッグ中またはキーリピート → コールバック実行」で、`preventDefault()`はコールバックが`true`（受理）を返した場合のみ行う。唯一の例外として、`ctrl: true`のエントリがドラッグ中またはキーリピートで実行されなかった場合は`preventDefault()`のみ行う（ブラウザのズーム・ページ全選択の抑止）。操作の実体は`main.js`から注入されたコールバック（`applyMode`/`applyShapeType`/`viewTransform`/`InputTracker`の公開メソッド）で実行され、UI同期は既存経路（`applyMode`・`applyShapeType`・`viewTransform.onChange`・`model.onChange`）のみを通る（ショートカット専用のUI同期・再描画は持たない）。
4.  **座標系とビュー変換 (`ViewTransform.js`)** : 図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼び、`スクリーン = ワールド × 倍率 ＋ オフセット` の関係にある。
    *   **入力** : `InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す（パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す）。
    *   **描画** : `main.js`の`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎フレーム設定する。
    *   **再描画の経路** : `VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から、同一関数`renderCurrentState()`で再描画する。

---

### 4. 各モジュールの責務リファレンス
※ 実装が進むごとに随時追記していく。個々のメソッドの内部アルゴリズムは各ファイルのJSDocを正とし、ここには書かない。

*   **index.html** : スタイルはCSSファイル分割せず`<style>`タグに内包する。フロートウィンドウ全体の非活性化は`.disabled`クラス（`pointer-events: none`）で表し、ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`（半透明・`cursor: default`）で表す（両者を混用しない）。`.tool-btn`のホバー色は`:hover:not(:disabled)`で押せる状態のみに限る。各ボタンの`title`属性にショートカットキーを併記しており（例：`選択 (V)`、図形パレットは`SHAPE_TYPES`の並びに対応する数字）、`KeyboardShortcuts.js`の`SHORTCUT_BINDINGS`と手動で同期する必要がある。
*   **main.js** : アプリケーションのエントリポイント。DOM読み込み完了後、`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`のインスタンス化とイベントバインドを担う。`applyMode(mode)`で操作モード切替を一元管理する（`modeButtons`オブジェクト（キーは`OperationMode`の値）へのエントリ追加のみで新規モードボタンに対応できる設計。ただし対応するDOM要素を`index.html`側に先に用意し、`InputTracker`の`OperationMode`にも値を追加する必要がある）。`applyMode`は`InputTracker.setMode`呼び出し後に`getMode()`で実状態を読み返して`.active`を同期し、パレットの活性（図形作成モード時のみ）と図形種別ハイライトを`paletteController.setEnabled`/`setActiveType`へ委譲する（コントロールパネル領域とパレット領域とで`.active`管理の責任主体を分離）。図形種別の切替は`applyShapeType(type)`（パレットの`onTypeSelected`コールバック）が担う。起動時に`applyMode(OperationMode.SELECT)`でUI初期表示を内部状態へ同期する。起動時初期化の最後に`renderCurrentState()`を明示的に1回呼び出し、初回描画を`onChange`通知の副作用に依存させない。倍率表示も同様に起動時初期化の最後に`syncZoomDisplay()`を明示的に1回呼び出し、`index.html`の初期文字列や`onChange`通知に依存させない。`ViewTransform`を生成して`InputTracker`へ注入し、`renderCurrentState()`で`selectedIds: model.getSelectedIds()`・`selectionRect: model.getSelectionRect()`・`view: viewTransform.getState()`等を`render()`へ渡す。`viewTransform.onChange`に`renderCurrentState`と`syncZoomDisplay`（コントロールパネルの倍率表示`#view-zoom-display`の更新）を登録する。リセットボタン`#view-reset`は`viewTransform.reset()`を呼ぶのみ（再描画・表示更新は`onChange`経由。操作モード・選択集合には触れない）。`modeButtons`には`[OperationMode.PAN]: #mode-pan`（キャンバス移動）が含まれる（上記「エントリ追加のみで新規モードボタンに対応できる設計」の実例）。
    *   **削除ボタン** : `#selection-delete`（`deleteSelectionBtn`。倍率表示・リセットボタンと同様に`modeButtons`には含めない）の`click`は`inputTracker.deleteSelection()`を呼ぶのみ（受理条件の判定は`InputTracker`側。`model.deleteShapes`を直接呼ばない）。押せる/押せない状態は`syncDeleteButtonState()`（選択集合が空なら`disabled`）が担い、`model.onChange`に登録したうえで起動時初期化の最後（`renderCurrentState()`・`syncZoomDisplay()`の後）にも明示的に1回呼ぶ。選択集合は操作モード切替でクリアされるため、図形作成・キャンバス移動モード中は常に押せない（モード別分岐なし）。
    *   **キーボードショートカット配線** : 起動時初期化の直前（節「8. キーボードショートカット配線」）で`KeyboardShortcuts`を生成し、操作コールバック（`isDragging`/`setMode`/`setShapeType`/`zoomStep`/`resetView`/`cancel`/`selectAll`/`deleteSelection`）を注入する（インスタンスは`WindowManager`と同様に変数へ保持しない）。数字キー（`setShapeType`）・全選択（`selectAll`）は、必要に応じて先に`applyMode`で図形作成モード・選択モードへ切り替える（モード自動切替は`main.js`のコールバックが`applyMode`経由で行う）。`selectAll`は`inputTracker.selectAll()`の戻り値によらず常に`true`を返す（図形0個でもページ全選択を防ぐ）。拡大・縮小は`zoomAtCanvasCenter(direction)`（キャンバス中心のスクリーン座標を中心に、`InputTracker.js`からimportした`WHEEL_ZOOM_STEP`で`viewTransform.zoomAt`へ委譲）、リセットは`viewTransform.reset()`のみ（リセットボタンと同一）。
*   **VectorModel.js** : 描画データ（Shape配列）と選択集合を保持する単一の真実（SSOT）。選択集合(`#selectedIds`：`Set<string>`)・ホバー状態(`#hoveredId`)・作成中図形(`#draftLine`)・選択矩形(`#selectionRect`)を保持する。選択集合の読み書きAPI（`setSelection(ids)`＝現存idのみで置き換え（単一選択は`setSelection([id])`で表現）/`clearSelection()`/`getSelectedIds()`＝描画順の新しい配列/`isSelected(id)`）、ホバーの読み書きAPI（`setHovered`/`clearHovered`/`getHoveredId`）、選択矩形API（`setSelectionRect(x1, y1, x2, y2)`＝ワールド座標の対角2点を正規化せず保持/`clearSelectionRect()`/`getSelectionRect()`＝コピーまたは`null`）と、ドラフト（作成中図形）のライフサイクルAPI（`startDraft(x, y, type = 'line')`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。図形idの採番（連番）は`commitDraft()`実行時に行う。再編集用の`updateVertex(id, vertexIndex, x, y)`（単一図形）/`moveShapes(ids, dx, dy)`（選択集合等の複数図形の一括平行移動）は、図形固有の頂点構造を意識せず対象shapeの`setVertex(vertexIndex, x, y)`/`translate(dx, dy)`へポリモーフィックに委譲する（`core/`側にshapeの内部プロパティ名を持ち込まない）。図形の生成は`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する（`Line`への直接依存は持たない）。作成中図形の終点追従を担う`updateDraft(x, y)`は、対象図形の`updateDraftEnd(x, y)`へポリモーフィックに委譲する（追従挙動の詳細は各図形クラス側の責務）。図形の一括削除用の`deleteShapes(ids)`を持ち、削除した図形のidを選択集合・ホバー状態からも同時に除去する（残留防止）。`moveShapes`/`deleteShapes`の変更通知は1操作につき1回（対象が1件以上の場合のみ）で、図形数分は発行しない。
*   **CanvasManager.js** : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedIds, draftLine, selectionRect, view } = {})`の形で呼び出される（第2引数は省略可、省略時は通常描画のみ。`selectedIds`は選択集合のid配列、`selectionRect`はワールド座標の対角2点で正規化不要）。`view`（`{scale, offsetX, offsetY}`、省略時は倍率1.0・オフセット(0,0)）と`resize()`で算出したdpr（`#pixelRatio`）を合成した描画変換を毎フレーム`setTransform`で明示設定する。クリアは変換の影響を受けずにバッファ全体を消去する。図形より先に、ワールド座標上の背景グリッド（細線10/太線100、画面上の間隔が8px未満なら10倍ずつ繰り上げ、線幅は画面上1px一定、可視範囲のみ）を描く。描画順は「背景グリッド → 全図形の`draw(ctx)`（＋`hoveredId`と一致する図形の`drawHover(ctx, view.scale)`）→ 選択集合に含まれる図形の`drawHandles(ctx, view.scale)`（図形配列の順。複数選択時に前面の図形が背面図形のハンドルを覆わないよう、全図形の描画後にまとめて描く2パス）→ `draftLine`の`draw(ctx)` → 選択矩形」であり、補助描画はいずれもポリモーフィックに呼び出す（倍率は図形種別によらず一律に渡す）。選択集合の所属判定は`render()`内のローカルな`Set`で行い、インスタンスに状態は持たない。選択矩形は画面上1pxの破線＋薄い半透明塗りで常に最前面に描く（線幅・破線は`÷ scale`で画面上一定。描画側では正規化しない）。ビュー変換状態は保持しない（値は引数で受け取り、`ViewTransform`はimportしない）。dprの算出とバッファサイズの同期は公開メソッド`resize()`が担い（変換の適用は`render()`が行う）、コンストラクタからの初期化と`main.js`からのウィンドウリサイズ時の再同期の両方から呼び出される。`resize()`は`render()`の呼び出しを行わない（再描画トリガーは`main.js`側の責務）。
*   **ViewTransform.js** : キャンバスのビュー変換状態（倍率`scale`・オフセット`offsetX`/`offsetY`、`スクリーン = ワールド × 倍率 ＋ オフセット`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する（`screenToWorld`/`worldToScreen`/`screenLengthToWorld`）。`zoomAt(sx, sy, factor)`はカーソル位置中心のズーム（倍率は`MIN_SCALE`=0.1〜`MAX_SCALE`=10.0にクランプ、クランプ時もカーソル下のワールド点は不変）、`panBy(dx, dy)`はスクリーン座標での平行移動、`reset()`は倍率1.0・オフセット(0,0)への復帰。値が実際に変化した場合のみ`onChange`リスナーへ通知する。`getScale()`は現在の倍率を、`getState()`は描画用のプレーンオブジェクト`{scale, offsetX, offsetY}`を返す。図形データ・DOM・`VectorModel`・`CanvasManager`には依存しない。
*   **InputTracker.js** : ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈とModel・ビュー変換への反映、状態依存の操作（一括削除・取消・全選択）の公開、スクリーン座標からワールド座標への変換、およびカーソル形状のフィードバック。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`の5状態を持つ状態遷移マシンとして実装する。`IDLE`ではホバー判定・選択・新規作成の開始、`DRAWING`では作成中図形の追従・確定、`DRAGGING_HANDLE`では選択集合内の1図形の頂点ハンドルによる頂点更新、`MOVING_SELECTION`では選択集合の全図形の平行移動（moveハンドル・本体ドラッグ）、`MARQUEE_SELECTING`では範囲選択を扱い、状態に応じて`VectorModel`の対応するAPIを呼び出す（左ドラッグの3状態は押下時点で遷移し、閾値超過の有無は`DragTracker`が保持する）。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`/`shape.intersectsRect(...)`をポリモーフィックに呼び出すのみとする。ハンドル種別から更新対象`vertexIndex`への解決も`shape.getVertexIndexForHandle(this.activeHandle)`へ委譲する（図形間で頂点数・意味が異なるため、`vertexIndex`規約を`core/`層にハードコードしない）。操作モード(`currentMode`: `OperationMode`＝`'select'`/`'create'`/`'pan'`)と図形種別(`currentShapeType`: `SHAPE_TYPES`のいずれか、初期値`'line'`)を独立した状態として保持し、定数`OperationMode`/`SHAPE_TYPES`をexportする。`setMode(mode)`で操作モードを切り替え（選択集合/ホバー状態のクリアと進行中操作の強制中断（ドラッグセッションの中断・範囲選択の破棄・IDLE復帰）を伴う）、`setShapeType(type)`で図形種別を切り替える（作成途中の図形のみ破棄、モードは維持）。いずれも未知の値は`console.warn`のうえ無視する。`getMode()`/`getShapeType()`で現在値を読み出せる。図形種別はモード切替でリセットされないため、図形作成モードへ戻ると前回の種別に復帰する。`currentMode`に応じて`handleMouseMove`/`handleMouseDown`/`handleClick`の解釈を排他的に切り替え、作成開始は図形作成モード中のみ行う。キャンバスのカーソル形状（パン中:`grabbing`／スペース押下中（左ドラッグ中を除く）・キャンバス移動モード:`grab`／作成モード:`crosshair`／選択モードでハンドルドラッグ・選択集合の平行移動中、ハンドル上、選択集合内の図形の本体上:`move`／範囲選択中:`default`／選択集合外の図形上:`pointer`／その他:`default`）の設定も担う。`document`購読の`keydown`は`Space`（スペースパン）のみを解釈する。ショートカットの解釈は`KeyboardShortcuts`が担う。
    *   **状態依存の公開メソッド** : `isDragging()`（`DragTracker`のセッション中＝パン・左ドラッグ中か。閾値以前を含む）、`deleteSelection()`（受理条件：選択モード・`IDLE`・ドラッグ中でない・選択集合が空でない。受理時`VectorModel.deleteShapes(ids)`で一括削除。削除ボタンと`Delete`/`Backspace`ショートカット（`KeyboardShortcuts`→`main.js`の注入コールバック経由）の唯一の削除経路で、呼び出し側は条件を重複判定しない）、`cancelDraftOrClearSelection()`（`Esc`の実体。作成途中の図形の破棄、または選択モードでの選択解除）、`selectAll()`（選択モード・`IDLE`・ドラッグ中でない場合に全図形を選択）。いずれも受理したら`true`を返す。選択モード以外からの全選択は呼び出し側（`main.js`）が先にモードを切り替える（`InputTracker`は`main.js`の関数を呼ばない）。
    *   **当たり分類** : private`#classifyPoint(point)`（ワールド座標）が、選択集合の全図形のハンドル（図形配列の後ろ＝前面優先。`CanvasManager`のハンドル描画順と一致）と、図形の本体（選択集合の図形を優先、同順位は図形配列の先頭）を1回で分類する。この結果をホバー・押下・クリック・カーソルの4箇所で共用し、クリックの解釈にホバー状態を参照しない。
    *   **選択モードの左ボタン操作** : 押下時は当たり分類により、moveハンドル・選択集合内の本体→`MOVING_SELECTION`、頂点ハンドル→`DRAGGING_HANDLE`、空白→`MARQUEE_SELECTING`へ遷移し、選択集合外の本体ではドラッグを開始しない（離した後のclickで判定）。閾値（`DRAG_START_THRESHOLD`＝スクリーン3px）以内で離した場合はclickとして解釈し、ハンドル上→選択集合を維持、本体上→その図形のみの単一選択、空白→全解除とする。閾値を超えて動かした左ドラッグの直後のclickは抑止する。移動量は押下点（ワールド座標）からの差分で計算するため閾値分の移動量は失われず、ドラッグ中のホイールズーム直後もカーソル位置へ追従し直す。範囲選択の確定（矩形の正規化はここ1箇所のみ）・中断時の破棄は3章「範囲選択の流れ」のとおり。
    *   **座標系** : コンストラクタで`ViewTransform`を受け取る（`main.js`が生成・注入）。`getScreenCoordinate(event)`でスクリーン座標（CSSズーム吸収済み）を取得し、`getWorldCoordinate(event)`でワールド座標へ逆変換する。`VectorModel`・当たり判定へ渡す座標はすべてワールド座標であり、当たり判定の許容誤差（`hitTolerance`、スクリーンpx単位）は画面上5px相当をワールド換算して渡す。
    *   **パン** : 中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モード（`'pan'`）の左ドラッグで行う。パン状態は`InputState`と直交するprivateフラグ（`#isPanning`）で表現し、`DRAWING`を保持したまま行える（ドラッグセッション中＝左ドラッグ中は開始しない）。パンの追従・終了・中断は`DragTracker`に委譲し（フロートウィンドウ上・ブラウザ外でのボタン解放にも対応）、左ボタンのパン後の`click`は移動の有無によらず抑止する。スペース押下状態は`keyup`・`blur`で解除する。
    *   **DragTrackerの所有** : コンストラクタで`DragTracker`を生成・所有し（スクリーン座標取得関数`getScreenCoordinate`のみを注入）、パン・左ドラッグの開始時に`begin()`へコールバックを渡す。ドラッグセッションは同時に1つのみ。click抑止フラグの所有者は`DragTracker`であり、`InputTracker`は`handleClick`冒頭で消費、`handleMouseDown`冒頭で残留を解除するのみ。キャンバスの`mouseup`は購読しない（終了検知は`DragTracker`へ一元化）。
    *   **ズーム** : キャンバスの`wheel`（`passive: false`）で、カーソル位置中心のズーム（1刻み`WHEEL_ZOOM_STEP`＝約1.1倍、`deltaY`の符号のみで方向を決定）を行う。操作モード・入力状態によらず常に有効。`WHEEL_ZOOM_STEP`はexportし、キーボードショートカットの拡大・縮小（`main.js`）でも同値を共有する。
    *   テキスト入力中判定ヘルパー`isTextInputElement(element)`をexportし、スペースパンとショートカット（`KeyboardShortcuts`）の両方の誤爆防止に用いる。`input`は`type`別に判定し（テキスト系の`type`一覧`TEXT_INPUT_TYPES`に含まれる場合のみ。`checkbox`/`range`/`button`等は対象外）、`textarea`・`contenteditable`はテキスト入力扱い、`select`は対象外。
*   **KeyboardShortcuts.js** : キーボードショートカットのキー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみを担う（判定順序は3章「キーボード操作」）。キーは`event.code`で識別し、`Ctrl`は`Meta`と同一視、`Alt`押下時は常に不一致、Shift併用は拡大・縮小のみ許容する。図形種別のエントリは`SHAPE_TYPES`の並びから生成する（並び＝図形パレットの並び順が前提）。`Space`は対応表に含めない。テキスト入力中・ドラッグ中は受け付けない。キーリピートは拡大・縮小のみ実行する。`preventDefault()`は受理したキーのみ行うが、`ctrl: true`のエントリがドラッグ中またはキーリピートで実行されなかった場合は例外として`preventDefault()`のみ行う。操作の実体は`main.js`から注入されたコールバックへ委譲し（コンストラクタで対応表の全action名の注入を検証し、欠落時は`Error`をthrow）、`VectorModel`・`ViewTransform`・`InputTracker`インスタンス・DOMのボタン要素を参照しない（`InputTracker.js`からは定数`OperationMode`/`SHAPE_TYPES`と関数`isTextInputElement`のみをimport）。`keyup`は購読しない。新しいショートカットは対応表へのエントリ追加（＋必要なら注入コールバックの追加）で対応する。
*   **DragTracker.js** : マウスボタン押下から解放までの1回のドラッグ操作のライフサイクル（開始ボタン・移動量閾値の判定、`window`へのcapture購読による追従/終了検知、blur時の中断、終了直後のclick抑止）を担う。ドラッグの意味（パン・範囲選択等）は知らない。公開APIは`begin(event, handlers, { threshold, suppressClick })`（`handlers`は`onStart`/`onMove(event, screen, prevScreen)`/`onEnd(event, moved)`/`onCancel`。セッション中なら`console.warn`して`false`）、`isActive()`、`hasMoved()`、`cancel()`、`consumeSuppressedClick()`、`clearSuppressedClick()`。押下点・直前位置・閾値はすべてスクリーン座標で、押下点からの距離が閾値を超えた時点で`onStart`→`onMove`を呼ぶ（`threshold > 0`では初回`onMove`の`prevScreen`は押下点ではないため、累積移動量が必要な呼び出し側は押下時点の座標を自前で記憶する）。終了は開始ボタンの`mouseup`でのみ行い（他ボタンの解放では終わらない）、`mouseup`を取りこぼした場合の保険として`mousemove`の`buttons`に開始ボタンのビットが含まれなければ解放とみなして終了する。`window`の`blur`と`cancel()`で中断し`onCancel`を呼ぶ（click抑止フラグも解除）。click抑止は左ボタンのセッションのみで、`suppressClick`が`'always'`または`'whenMoved'`かつ閾値超過時にフラグを立てる。依存方向は`InputTracker`→`DragTracker`の一方向で、`InputTracker`・`VectorModel`・`ViewTransform`・canvasをimport/参照しない。
*   **ShapeFactory.js** : 図形typeに応じたインスタンス生成を一元的に担うFactory。静的メソッド`create(type, x1, y1, x2, y2)`を持ち、`type`は`'line' | 'curve' | 'arc' | 'rect' | 'circle'`の5種を受理する。対応関係：`line`→`Line`、`curve`→`Curve`、`rect`→`Rect`、`circle`→`Ellipse(..., 'circle')`、`arc`→`Ellipse(..., 'arc')`。未知の`type`が渡された場合は`Error`をthrowする。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。
*   **WindowManager.js** : `.float-window`要素の動的検知と、ドラッグ移動・アクティブ最前面化・イベント遮断（下層要素への透過防止）を一元管理する。コンストラクタ実行時点でDOMに存在する`.float-window`を検知する（動的に後から追加される要素の再検知は未対応）。`VectorModel`が持つ図形データ・選択状態・ツール状態には一切関与しない、DOM統治専任のクラスである。
*   **shapes/** : 図形種別ごとのデータ保持・描画・当たり判定を担う。`Line`/`Curve`/`Rect`/`Ellipse`はいずれも同一シグネチャの10メソッド（`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`、`intersectsRect(minX, minY, maxX, maxY)`）を自律実装しており、この契約を満たす限り`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を変更せずに作成・選択・範囲選択・再編集フローへ組み込める。新規図形を追加する際はこの10メソッド契約を満たすこと。`intersectsRect`は範囲選択用の交差判定で、引数はワールド座標の正規化済み（min ≤ max）軸平行矩形（境界を含む）。描画されている輪郭線の中心線（`strokeWidth`は含めない）が一部でも掛かれば`true`を返し、塗り内部は判定しない（Line・Rectは線分の厳密判定、Curve・Ellipseは輪郭を100分割した折れ線による近似判定。Ellipseの弧は描画されている弧部分のみが対象）。`drawHandles`/`drawHover`の`viewScale`は表示倍率であり、ハンドルの大きさ・枠線幅・ホバー強調の上乗せ幅等の補助表示を画面上一定に保つため`÷ viewScale`で換算する。図形本体の`draw`は倍率を受け取らない（線幅は倍率に比例して表示される）。図形クラスが扱う座標はすべてワールド座標であり、オフセットは渡されない。各メソッドの内部実装（描画方法・当たり判定アルゴリズム等）は各ファイルのJSDocを参照。
    *   **Line.js** : 直線（`points`配列は持たず、`x1, y1`=始点／`x2, y2`=終点のプロパティで保持する）。`hitTestHandle`の戻り値は`'start'|'end'|'move'|null`（`move`は中点）。
    *   **Curve.js** : 2次ベジェ曲線（3頂点：`points[0]`=始点／`points[1]`=制御点／`points[2]`=終点）。`move`ハンドルは持たない（`hitTestHandle`の戻り値は`'start'|'end'|'control'|null`）。
    *   **Rect.js** : 矩形（4頂点：`points[0]`=topLeft／`points[1]`=topRight／`points[2]`=bottomRight／`points[3]`=bottomLeft）。コンストラクタは対角2点から4点を算出するのみで、矩形維持のための正規化は行わない（4隅の自由変形が可能）。
    *   **Ellipse.js** : 円・楕円・弧（5頂点：`points[0]`=中心／`points[1]`=右端制御点／`points[2]`=上端制御点／`points[3]`=開始角制御点／`points[4]`=終了角制御点）。内部の`type`プロパティ（`'circle'`|`'arc'`）で振る舞いを分岐する。
*   **palette/** : ツールバー・カラーピッカー等のUI部品。
    *   **PaletteController.js** : 図形選択パレット（直線・曲線・弧・矩形・円の5ボタン）の配線を担う自己完結UI部品。`InputTracker`へ直接依存せず、図形種別選択時に呼び出す汎用コールバック`onTypeSelected(type)`（`main.js`側の`applyShapeType`）を受け取る。公開メソッド`setEnabled(enabled)`でパレット本体の`.disabled`制御を、`setActiveType(type)`で5ボタンの`.active`排他制御を行う。操作モードの知識は持たない（活性/非活性の判断は`main.js`側の責務）。`WindowManager`と同様、`VectorModel`・図形データ・選択状態には一切関与しないDOM操作専任のクラスである。
*   **io/**（未実装） :
    *   **CodeExporter.js** : ゲームで再利用可能なJavaScript(ESM)コードの出力を担当。出力フォーマットの詳細は、当該Phaseの実装REQ/RESで確定させる。
    *   **CodeImporter.js** : 出力されたJSファイルを解析し、`VectorModel` に再ロードする。
