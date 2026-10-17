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

---

### 3. 描画・操作フロー（実行サイクル）

1.  **起動処理 (`main.js`)** : DOMの読み込み完了後、`VectorModel`, `CanvasManager`, `InputTracker` をインスタンス化し、イベントをバインドする。
2.  **描画サイクル (`CanvasManager.js`)** : `requestAnimationFrame` を用いた描画ループ。`VectorModel` からShape配列を読み込み、順次Canvas上に描画する。
3.  **入力監視 (`InputTracker.js` → `VectorModel.js`)** : マウスドラッグによる頂点・図形の移動、クリックによる選択。状態が更新されると `VectorModel` が更新イベントを発火し、`CanvasManager` に再描画を促す。
4.  **座標系とビュー変換 (`ViewTransform.js`)** : 図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼び、`スクリーン = ワールド × 倍率 ＋ オフセット` の関係にある。
    *   **入力** : `InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す（パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す）。
    *   **描画** : `main.js`の`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎フレーム設定する。
    *   **再描画の経路** : `VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から、同一関数`renderCurrentState()`で再描画する。

---

### 4. 各モジュールの責務リファレンス
※ 実装が進むごとに随時追記していく。個々のメソッドの内部アルゴリズムは各ファイルのJSDocを正とし、ここには書かない。

*   **main.js** : アプリケーションのエントリポイント。DOM読み込み完了後、`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`のインスタンス化とイベントバインドを担う。`applyMode(mode)`で操作モード切替を一元管理する（`modeButtons`オブジェクト（キーは`OperationMode`の値）へのエントリ追加のみで新規モードボタンに対応できる設計。ただし対応するDOM要素を`index.html`側に先に用意し、`InputTracker`の`OperationMode`にも値を追加する必要がある）。`applyMode`は`InputTracker.setMode`呼び出し後に`getMode()`で実状態を読み返して`.active`を同期し、パレットの活性（図形作成モード時のみ）と図形種別ハイライトを`paletteController.setEnabled`/`setActiveType`へ委譲する（コントロールパネル領域とパレット領域とで`.active`管理の責任主体を分離）。図形種別の切替は`applyShapeType(type)`（パレットの`onTypeSelected`コールバック）が担う。起動時に`applyMode(OperationMode.SELECT)`でUI初期表示を内部状態へ同期する。起動時初期化の最後に`renderCurrentState()`を明示的に1回呼び出し、初回描画を`onChange`通知の副作用に依存させない。倍率表示も同様に起動時初期化の最後に`syncZoomDisplay()`を明示的に1回呼び出し、`index.html`の初期文字列や`onChange`通知に依存させない。`ViewTransform`を生成して`InputTracker`へ注入し、`renderCurrentState()`で`view: viewTransform.getState()`を`render()`へ渡す。`viewTransform.onChange`に`renderCurrentState`と`syncZoomDisplay`（コントロールパネルの倍率表示`#view-zoom-display`の更新）を登録する。リセットボタン`#view-reset`は`viewTransform.reset()`を呼ぶのみ（再描画・表示更新は`onChange`経由。操作モード・選択状態には触れない）。`modeButtons`には`[OperationMode.PAN]: #mode-pan`（キャンバス移動）が含まれる（上記「エントリ追加のみで新規モードボタンに対応できる設計」の実例）。
*   **VectorModel.js** : 描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。選択状態(`#selectedId`)・ホバー状態(`#hoveredId`)・作成中図形(`#draftLine`)を保持する。選択/ホバーの読み書きAPI（`selectShape`/`clearSelection`/`getSelectedId`、`setHovered`/`clearHovered`/`getHoveredId`）と、ドラフト（作成中図形）のライフサイクルAPI（`startDraft(x, y, type = 'line')`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。図形idの採番（連番）は`commitDraft()`実行時に行う。再編集用の`updateVertex(id, vertexIndex, x, y)`/`moveShape(id, dx, dy)`は、図形固有の頂点構造を意識せず対象shapeの`setVertex(vertexIndex, x, y)`/`translate(dx, dy)`へポリモーフィックに委譲する（`core/`側にshapeの内部プロパティ名を持ち込まない）。図形の生成は`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する（`Line`への直接依存は持たない）。作成中図形の終点追従を担う`updateDraft(x, y)`は、対象図形の`updateDraftEnd(x, y)`へポリモーフィックに委譲する（追従挙動の詳細は各図形クラス側の責務）。図形削除用の`deleteShape(id)`を持ち、削除対象が選択中/ホバー中であった場合はそれらの状態も同時にクリアする。
*   **CanvasManager.js** : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedId, draftLine, view } = {})`の形で呼び出される（第2引数は省略可、省略時は通常描画のみ）。`view`（`{scale, offsetX, offsetY}`、省略時は倍率1.0・オフセット(0,0)）と`resize()`で算出したdpr（`#pixelRatio`）を合成した描画変換を毎フレーム`setTransform`で明示設定する。クリアは変換の影響を受けずにバッファ全体を消去する。図形より先に、ワールド座標上の背景グリッド（細線10/太線100、画面上の間隔が8px未満なら10倍ずつ繰り上げ、線幅は画面上1px一定、可視範囲のみ）を描く。通常描画（`shape.draw(ctx)`）に加え、`hoveredId`と一致する図形には`drawHover(ctx, view.scale)`を、`selectedId`と一致する図形には`drawHandles(ctx, view.scale)`をポリモーフィックに追加呼び出す（倍率は図形種別によらず一律に渡す）。`draftLine`が渡された場合は全図形描画後に`draw(ctx)`のみ重ねて描画する。ビュー変換状態は保持しない（値は引数で受け取り、`ViewTransform`はimportしない）。dprの算出とバッファサイズの同期は公開メソッド`resize()`が担い（変換の適用は`render()`が行う）、コンストラクタからの初期化と`main.js`からのウィンドウリサイズ時の再同期の両方から呼び出される。`resize()`は`render()`の呼び出しを行わない（再描画トリガーは`main.js`側の責務）。
*   **ViewTransform.js** : キャンバスのビュー変換状態（倍率`scale`・オフセット`offsetX`/`offsetY`、`スクリーン = ワールド × 倍率 ＋ オフセット`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する（`screenToWorld`/`worldToScreen`/`screenLengthToWorld`）。`zoomAt(sx, sy, factor)`はカーソル位置中心のズーム（倍率は`MIN_SCALE`=0.1〜`MAX_SCALE`=10.0にクランプ、クランプ時もカーソル下のワールド点は不変）、`panBy(dx, dy)`はスクリーン座標での平行移動、`reset()`は倍率1.0・オフセット(0,0)への復帰。値が実際に変化した場合のみ`onChange`リスナーへ通知する。`getScale()`は現在の倍率を、`getState()`は描画用のプレーンオブジェクト`{scale, offsetX, offsetY}`を返す。図形データ・DOM・`VectorModel`・`CanvasManager`には依存しない。
*   **InputTracker.js** : マウス・キーボード入力の解釈（パン・ズームを含む）、スクリーン座標からワールド座標への変換。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシンとして実装する。`IDLE`ではホバー判定・選択・新規作成の開始、`DRAWING`では作成中図形の追従・確定、`DRAGGING_HANDLE`ではハンドルドラッグによる頂点更新・平行移動を扱い、状態に応じて`VectorModel`の対応するAPIを呼び出す。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。ハンドル種別から更新対象`vertexIndex`への解決も`shape.getVertexIndexForHandle(this.activeHandle)`へ委譲する（図形間で頂点数・意味が異なるため、`vertexIndex`規約を`core/`層にハードコードしない）。操作モード(`currentMode`: `OperationMode`＝`'select'`/`'create'`/`'pan'`)と図形種別(`currentShapeType`: `SHAPE_TYPES`のいずれか、初期値`'line'`)を独立した状態として保持し、定数`OperationMode`/`SHAPE_TYPES`をexportする。`setMode(mode)`で操作モードを切り替え（選択/ホバー状態のクリアと進行中操作の強制中断（IDLE復帰）を伴う）、`setShapeType(type)`で図形種別を切り替える（作成途中の図形のみ破棄、モードは維持）。いずれも未知の値は`console.warn`のうえ無視する。`getMode()`/`getShapeType()`で現在値を読み出せる。図形種別はモード切替でリセットされないため、図形作成モードへ戻ると前回の種別に復帰する。`currentMode`に応じて`handleMouseMove`/`handleMouseDown`/`handleClick`の解釈を排他的に切り替え、作成開始は図形作成モード中のみ行う。キャンバスのカーソル形状（パン中:`grabbing`／スペース押下中・キャンバス移動モード:`grab`／作成モード:`crosshair`／選択モードでハンドル上・ドラッグ中:`move`／図形上:`pointer`／その他:`default`）の設定も担い、判定は`hitTestHandle`とホバー状態のポリモーフィックな利用のみで行う。`document`購読の`keydown`ハンドラを持ち、選択モード中に選択図形がある状態での`Delete`/`Backspace`押下で`VectorModel.deleteShape(id)`を呼び出す。
    *   **座標系** : コンストラクタで`ViewTransform`を受け取る（`main.js`が生成・注入）。`getScreenCoordinate(event)`でスクリーン座標（CSSズーム吸収済み）を取得し、`getWorldCoordinate(event)`でワールド座標へ逆変換する。`VectorModel`・当たり判定へ渡す座標はすべてワールド座標であり、当たり判定の許容誤差（`hitTolerance`、スクリーンpx単位）は画面上5px相当をワールド換算して渡す。
    *   **パン** : 中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モード（`'pan'`）の左ドラッグで行う。パン状態は`InputState`と直交するprivateフラグで表現し、`DRAWING`を保持したまま行える（`DRAGGING_HANDLE`中は開始しない）。パンの追従・終了は`window`へのcapture購読で検知し（フロートウィンドウ上・ブラウザ外でのボタン解放にも対応）、左ボタンのパン後の`click`は抑止する。スペース押下状態は`keyup`・`blur`で解除する。
    *   **ズーム** : キャンバスの`wheel`（`passive: false`）で、カーソル位置中心のズーム（1刻み約1.1倍、`deltaY`の符号のみで方向を決定）を行う。操作モード・入力状態によらず常に有効。
    *   テキスト入力中判定ヘルパー`isTextInputElement(element)`（input/textarea/contenteditable）をexportし、スペースキーの誤爆防止に用いる。
*   **ShapeFactory.js** : 図形typeに応じたインスタンス生成を一元的に担うFactory。静的メソッド`create(type, x1, y1, x2, y2)`を持ち、`type`は`'line' | 'curve' | 'arc' | 'rect' | 'circle'`の5種を受理する。対応関係：`line`→`Line`、`curve`→`Curve`、`rect`→`Rect`、`circle`→`Ellipse(..., 'circle')`、`arc`→`Ellipse(..., 'arc')`。未知の`type`が渡された場合は`Error`をthrowする。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。
*   **WindowManager.js** : `.float-window`要素の動的検知と、ドラッグ移動・アクティブ最前面化・イベント遮断（下層要素への透過防止）を一元管理する。コンストラクタ実行時点でDOMに存在する`.float-window`を検知する（動的に後から追加される要素の再検知は未対応）。`VectorModel`が持つ図形データ・選択状態・ツール状態には一切関与しない、DOM統治専任のクラスである。
*   **shapes/** : 図形種別ごとのデータ保持・描画・当たり判定を担う。`Line`/`Curve`/`Rect`/`Ellipse`はいずれも同一シグネチャの9メソッド（`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`）を自律実装しており、この契約を満たす限り`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を変更せずに作成・選択・再編集フローへ組み込める。新規図形を追加する際はこの9メソッド契約を満たすこと。`drawHandles`/`drawHover`の`viewScale`は表示倍率であり、ハンドルの大きさ・枠線幅・ホバー強調の上乗せ幅等の補助表示を画面上一定に保つため`÷ viewScale`で換算する。図形本体の`draw`は倍率を受け取らない（線幅は倍率に比例して表示される）。図形クラスが扱う座標はすべてワールド座標であり、オフセットは渡されない。各メソッドの内部実装（描画方法・当たり判定アルゴリズム等）は各ファイルのJSDocを参照。
    *   **Line.js** : 直線（2頂点：`points[0]`=始点／`points[1]`=終点）。
    *   **Curve.js** : 2次ベジェ曲線（3頂点：`points[0]`=始点／`points[1]`=制御点／`points[2]`=終点）。`move`ハンドルは持たない（`hitTestHandle`の戻り値は`'start'|'end'|'control'|null`）。
    *   **Rect.js** : 矩形（4頂点：`points[0]`=topLeft／`points[1]`=topRight／`points[2]`=bottomRight／`points[3]`=bottomLeft）。コンストラクタは対角2点から4点を算出するのみで、矩形維持のための正規化は行わない（4隅の自由変形が可能）。
    *   **Ellipse.js** : 円・楕円・弧（5頂点：`points[0]`=中心／`points[1]`=右端制御点／`points[2]`=上端制御点／`points[3]`=開始角制御点／`points[4]`=終了角制御点）。内部の`type`プロパティ（`'circle'`|`'arc'`）で振る舞いを分岐する。
*   **palette/** : ツールバー・カラーピッカー等のUI部品。
    *   **PaletteController.js** : 図形選択パレット（直線・曲線・弧・矩形・円の5ボタン）の配線を担う自己完結UI部品。`InputTracker`へ直接依存せず、図形種別選択時に呼び出す汎用コールバック`onTypeSelected(type)`（`main.js`側の`applyShapeType`）を受け取る。公開メソッド`setEnabled(enabled)`でパレット本体の`.disabled`制御を、`setActiveType(type)`で5ボタンの`.active`排他制御を行う。操作モードの知識は持たない（活性/非活性の判断は`main.js`側の責務）。`WindowManager`と同様、`VectorModel`・図形データ・選択状態には一切関与しないDOM操作専任のクラスである。
*   **io/**（未実装） :
    *   **CodeExporter.js** : ゲームで再利用可能なJavaScript(ESM)コードの出力を担当。出力フォーマットの詳細は、当該Phaseの実装REQ/RESで確定させる。
    *   **CodeImporter.js** : 出力されたJSファイルを解析し、`VectorModel` に再ロードする。
