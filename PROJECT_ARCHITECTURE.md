# PROJECT_ARCHITECTURE.md
## OZ Vector Editor 全体仕様および実装定義書

本資料は、「OZ Vector Editor」（ブラウザ版ベクターパーツ作成エディタ）をAI-IDEが実装・修正する際の「全体マップ（見取り図）」および「インデックス（索引）」となる設計図である。
直接コードを読めば分かる内部ロジックの詳細（関数の中身、引数の全列挙、出力コードのテンプレート等）は本資料には記載しない。実装が進むごとに、セクション4を随時追記・更新していくこと。

---

### 1. プロジェクトフォルダ構造
AIは新規にファイルを作成、あるいはログを記録する際、必ずこの構造に準拠すること。各ファイルの責務は本資料の「4. 各モジュールの責務リファレンス」を唯一の正解（SSOT）とし、ここには記載しない。

```text
/oz-vector-editor/
├── index.html
├── css/
│   └── style.css
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── VectorModel.js
│   │   ├── CanvasManager.js
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
    │   └── closed/    # 実装・動作確認が全て完了したREQファイルの移動先
    └── res/
        └── closed/    # 実装・動作確認が全て完了したRESファイルの移動先
```

**フォルダ分割の方針**：横断的な処理（入力→状態→描画の複数層にまたがるもの）は `core/` に置く。自己完結する機能（1種類の図形、1つのUI部品など）は、それぞれ専用フォルダにまとめる。

---

### 2. データ構造（Model）の概要
ShapeDataは `id, type, color, strokeWidth, isFilled, points` を共通プロパティとして持つ（正式な型定義はコード側の `core/VectorModel.js` を参照）。

---

### 3. 描画・操作フロー（実行サイクル）

1.  **起動処理 (`main.js`)** : DOMの読み込み完了後、`VectorModel`, `CanvasManager`, `InputTracker` をインスタンス化し、イベントをバインドする。
2.  **描画サイクル (`CanvasManager.js`)** : `requestAnimationFrame` を用いた描画ループ。`VectorModel` からShape配列を読み込み、順次Canvas上に描画する。
3.  **入力監視 (`InputTracker.js` → `VectorModel.js`)** : マウスドラッグによる頂点・図形の移動、クリックによる選択。状態が更新されると `VectorModel` が更新イベントを発火し、`CanvasManager` に再描画を促す。

---

### 4. 各モジュールの責務リファレンス
※ 実装が進むごとに随時追記していく。現時点では、方向性のみ薄く記載する。

*   **main.js** : アプリケーションのエントリポイント。DOM読み込み完了後の各クラス（`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`）のインスタンス化とイベントバインドを担う。ツール切替を一元管理する`applyTool(tool)`は、コントロールパネルが直接ownするツールボタン（`select`/`line`。将来のpan/zoom等の増設を想定）をツール名文字列でマッピングする汎用オブジェクト`toolButtons`を走査するループ（`.active`の付け外し、クリックリスナー登録の双方）によって排他制御を行い、個別ボタンごとのハードコードされたif/classList分岐を持たない（開閉原則：新規ボタン追加時は`toolButtons`へのエントリ追加のみで対応可、ただし対応するDOM要素が`index.html`側に先に存在している必要がある）。パレット内5ボタンの`.active`制御には一切関与せず、`paletteController.setActiveTool(tool)`への委譲に完全に留める（コントロールパネル領域とパレット領域とで`.active`管理の単独責任者を分離し、二重管理を回避する設計）。
*   **VectorModel.js** : 描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。選択状態(`#selectedId`)・ホバー状態(`#hoveredId`)・作成中Line(`#draftLine`)を併せて保持する。選択/ホバーの読み書きAPI（`selectShape`/`clearSelection`/`getSelectedId`、`setHovered`/`clearHovered`/`getHoveredId`）と、ドラフト（作成中Line）のライフサイクルAPI（`startDraft`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。図形idの採番（連番）は`commitDraft()`実行時にここで行う。再編集用の`updateVertex(id, vertexIndex, x, y)`/`moveShape(id, dx, dy)`は、図形固有の頂点構造を意識せず対象shapeの`setVertex(vertexIndex, x, y)`/`translate(dx, dy)`へポリモーフィックに委譲する（`core/`側にshapeの内部プロパティ名を持ち込まない）。図形の生成は`Line`への直接依存を持たず`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する（`startDraft(x, y, type = 'line')`のシグネチャで生成種別を受け取る）。作成中図形の終点追従を担う`updateDraft(x, y)`は、頂点構造を意識せず対象図形の`updateDraftEnd(x, y)`へポリモーフィックに委譲する（`Line`は`setVertex(1, x, y)`と同義、`Curve`は制御点も中点として再計算するなど、追従挙動の詳細は各図形クラス側の責務とする）。図形削除用の`deleteShape(id)`を持ち、削除対象が選択中/ホバー中であった場合はそれらの状態も同時にクリアする。
*   **CanvasManager.js** : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedId, draftLine } = {})`の形で呼び出される。通常描画（`shape.draw(ctx)`）に加え、`hoveredId`と一致する図形には`drawHover(ctx)`を、`selectedId`と一致する図形には`drawHandles(ctx)`をポリモーフィックに追加呼び出す。`draftLine`が渡された場合は全図形描画後に`draw(ctx)`のみ重ねて描画する。第2引数は省略可能（省略時はデフォルト値によりすべてnull扱いとなり通常描画のみ行う）。内部バッファサイズとdprスケールの計算・再適用は公開メソッド`resize()`（旧`initCanvasSize()`を一本化・改称）が担い、コンストラクタからの初期化と`main.js`からのウィンドウリサイズ時の再同期の両方から呼び出される。`resize()`はバッファサイズ・スケールの再計算のみを行い、`render()`の呼び出しは行わない（再描画トリガーは`main.js`側の責務）。
*   **InputTracker.js** : マウス・キーボード入力の解釈、キャンバス座標への変換。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシンとして実装する。`IDLE`ではホバー判定・選択・新規作成の開始、`DRAWING`では作成中Lineの追従・確定、`DRAGGING_HANDLE`ではハンドルドラッグによる頂点更新・平行移動を扱い、状態に応じて`VectorModel`の対応するAPIを呼び出す。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。`DRAGGING_HANDLE`状態でのハンドル種別から更新対象`vertexIndex`への解決も、`'start'|'end'`の2値決め打ちの三項演算子ではなく`shape.getVertexIndexForHandle(this.activeHandle)`へポリモーフィックに委譲する（`Line`/`Curve`など頂点数の異なる図形間での`vertexIndex`意味不一致を`core/`層に持ち込まないため）。現在アクティブなツール種別(`currentTool`: `'select'`/`'line'`)を保持し、`setTool(tool)`によって切り替える。ツール切り替え時は選択/ホバー状態の無条件クリアおよび進行中操作の強制中断（IDLE復帰）を行う。`currentTool`に応じて`handleMouseMove`のホバー判定・`handleMouseDown`のハンドル検出・`handleClick`のクリック解釈を排他的に切り替える（`select`ツール中のみホバー判定/ハンドル検出/選択操作を行い、`line`ツール中は常に新規Line作成を開始する）。`document`を購読先とする`keydown`ハンドラも持ち、`select`ツール中に選択図形がある状態での`Delete`/`Backspace`押下で`VectorModel.deleteShape(id)`を呼び出す図形削除機能を持つ。
*   **ShapeFactory.js** : 図形typeに応じたインスタンス生成を一元的に担うFactory。静的メソッド`create(type, x1, y1, x2, y2)`を持ち、`type`は`'line' | 'curve' | 'arc' | 'rect' | 'circle'`の5種を受理する。`type === 'line'`の場合は`new Line(x1, y1, x2, y2)`を返す。`type === 'curve'`の場合は`new Curve(x1, y1, x2, y2)`を返す（Phase01-05で本実装接続済み）。`type === 'rect'`の場合は`new Rect(x1, y1, x2, y2)`を返す（Phase01-06で本実装接続済み）。`type === 'circle'`の場合は`new Ellipse(x1, y1, x2, y2, 'circle')`を返す（Phase01-07で本実装接続済み）。`type === 'arc'`の場合は`new Ellipse(x1, y1, x2, y2, 'arc')`を返す（Phase01-07で本実装接続済み）。上記5種以外の未知の`type`が渡された場合は`Error`をthrowする。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。
*   **WindowManager.js** : `.float-window`要素の動的検知と、ドラッグ移動・アクティブ最前面化・イベント遮断（バブリングによる下層要素への透過防止）を一元管理する。コンストラクタ実行時点でDOMに存在する`.float-window`を`querySelectorAll`で検知し、各要素の`mousedown`で遮断＋z-index最前面化を、`.window-header`の`mousedown`起点かつ`window`レベル共通の`mousemove`/`mouseup`でドラッグ状態機械を駆動する。動的に後から追加される`.float-window`の再検知（MutationObserver等）は未対応。`VectorModel`が持つ図形データ・選択状態・ツール状態には一切関与しない、DOM統治専任のクラスである。
*   **shapes/** : 図形種別ごとの定義・当たり判定。各図形が自身のプロパティと描画ロジック(`draw`メソッド)を持つ。追加され次第、ここに列挙していく。
    *   **Line.js**（作成済み）: 直線のデータ保持・描画・当たり判定を担う。共通インターフェースとして `hitTest(x, y, tolerance)`（本体の当たり判定）、`hitTestHandle(x, y, tolerance)`（start/end/moveハンドルの当たり判定、戻り値`'start'|'end'|'move'|null`）、`drawHandles(ctx)`（選択中のハンドル描画）、`drawHover(ctx)`（ホバー時の強調描画）、`setVertex(vertexIndex, x, y)`（頂点の絶対座標更新）、`translate(dx, dy)`（相対移動）、`updateDraftEnd(x, y)`（作図中に終点をカーソルへ追従させる。`setVertex(1, x, y)`と同義）、`getVertexIndexForHandle(handleName)`（ハンドル名から対応する`vertexIndex`を自己申告する。該当なしは`null`）を実装する。今後追加する図形（曲線・円・楕円等）も、この8メソッドを自身に実装することで`core/`側（VectorModel/CanvasManager/InputTracker）を変更せずに同一の作成・選択・再編集フローへ組み込める。
    *   **Curve.js**（作成済み）: 2次ベジェ曲線（始点・制御点・終点の3頂点構造、`points[0]`=始点／`points[1]`=制御点／`points[2]`=終点）のデータ保持・描画・当たり判定を担う。`Line.js`と同名・同シグネチャの9メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`/`updateDraftEnd`/`getVertexIndexForHandle`）を自律実装しており、`core/`層（VectorModel/CanvasManager/InputTracker）を一切変更せずに選択・ハンドル操作・ホバー表示のフローへ組み込まれている。`draw`は`ctx.quadraticCurveTo`によるベジェ曲線描画、`hitTest`はベジェ方程式$B(t)$を`t=0〜1`の100分割でサンプリングし入力点との最短距離が`tolerance`以内かを判定する。`drawHandles`は始点・終点を正方形、制御点をひし形で描き分け、始点⇔制御点・終点⇔制御点を結ぶ点線ヘルパーを併せて描画する。`Line`の`'move'`ハンドルに相当するものは持たず、`hitTestHandle`の戻り値は`'start'|'end'|'control'|null`となる。`updateDraftEnd(x, y)`は終点を`(x, y)`に更新し、制御点を「始点と新しい終点の中点」として再計算する（作図プレビュー中は常に直線に見える状態を保つ）。`getVertexIndexForHandle(handleName)`は`{start:0, control:1, end:2}`のルックアップで対応する`vertexIndex`を返す。
    *   **Rect.js**（作成済み）: 矩形（4頂点構造、`points[0]`=topLeft／`points[1]`=topRight／`points[2]`=bottomRight／`points[3]`=bottomLeft）のデータ保持・描画・当たり判定を担う。`Line.js`/`Curve.js`と同名・同シグネチャの9メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`/`updateDraftEnd`/`getVertexIndexForHandle`）を自律実装しており、`core/`層（VectorModel/CanvasManager/InputTracker）を一切変更せずに選択・ハンドル操作・ホバー表示のフローへ組み込まれている。コンストラクタは対角2点`(x1,y1)`/`(x2,y2)`から4点を直接算出するのみで正規化は行わない（`x1>x2`等でも`topLeft`という命名と実座標が食い違い得るが、矩形維持ロジックを持ち込まない設計方針を優先）。`draw`は4頂点を`points[0]→[1]→[2]→[3]`の順に結び`closePath`する閉パス描画、`hitTest`は4辺（`[0,1]`,`[1,2]`,`[2,3]`,`[3,0]`）に対しRect内部専用のprivateヘルパー`#distanceToSegment`（点-線分距離）をそれぞれ適用し、いずれか1辺でも`tolerance`以内なら`true`を返す。`drawHandles`は4隅に`Line`/`Curve`と同一配色・サイズの正方形ハンドルを描画する。`setVertex(vertexIndex, x, y)`は矩形維持のための連動再計算を一切行わず、指定頂点のみを独立して上書きする（4隅ハンドルの個別ドラッグによる平行四辺形化を含む自由変形が可能）。`updateDraftEnd(x, y)`は1回目クリック地点（`points[0]`）を固定したまま、カーソル座標を対角（`points[2]`）とし`points[1]`/`points[3]`を対角線上の交点として再計算することで、ドラフト中は常に軸並行の矩形として追従する。`getVertexIndexForHandle(handleName)`は`{topLeft:0, topRight:1, bottomRight:2, bottomLeft:3}`のルックアップで対応する`vertexIndex`を返す。
    *   **Ellipse.js**（作成済み）: 円・楕円・弧（5頂点構造、`points[0]`=中心／`points[1]`=右端制御点／`points[2]`=上端制御点／`points[3]`=開始角制御点／`points[4]`=終了角制御点）のデータ保持・描画・当たり判定を担う。`Line.js`/`Curve.js`/`Rect.js`と同名・同シグネチャの9メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`/`updateDraftEnd`/`getVertexIndexForHandle`）を自律実装しており、`core/`層（VectorModel/CanvasManager/InputTracker）を一切変更せずに選択・ハンドル操作等のフローへ組み込まれている。コンストラクタは`x1, y1`（中心）、`x2, y2`から絶対距離$r_x, r_y$を算出し、初期化を行う。内部の`type`プロパティ(`'circle'`|`'arc'`)により振る舞いを分岐する。`draw`は`ctx.ellipse`を用い、円は`closePath`による閉パス、弧は開パスで描画。`hitTest`は楕円方程式ベースの境界線判定（縮退時の0除算ガードと弧の角度フィルタ付き）。`drawHandles`は中心・右端・上端に加え、左端・下端に対称ダミーハンドルを描画。`setVertex`と`updateDraftEnd`は共通ヘルパーを利用し、入力座標から中心からの絶対距離$r_x, r_y$を再計算して正準位置へ再配置する正規化ロジックを備え、左端/下端ドラッグ時の反転ワープを防ぐ。`getVertexIndexForHandle`は`{ right: 1, up: 2, left: 1, down: 2 }`のルックアップで対応する`vertexIndex`を返す。
*   **palette/** : ツールバー・カラーピッカー等のUI部品。追加され次第、ここに列挙していく。
    *   **PaletteController.js**（作成済み）: 図形選択パレット（直線・曲線・弧・矩形・円の5ボタン）の配線を担う自己完結UI部品。コンストラクタは`InputTracker`インスタンスへ直接依存せず、ツール選択時に呼び出す汎用コールバック`onToolSelected(type)`（`main.js`側の`applyTool`）を受け取り、パレット5ボタンの`click`時に対応する図形種別`type`文字列を渡してこれを呼び出す。公開メソッド`setActiveTool(tool)`により、パレット本体の`.disabled`制御（`tool === 'select'`時に付与）と、5ボタンの`.active`排他制御（`tool`と一致するボタンのみ付与）を行う。`WindowManager`と同様、`VectorModel`・図形データ・選択状態には一切関与しないDOM操作専任のクラスである。
*   **CodeExporter.js** : ゲームで再利用可能なJavaScript(ESM)コードの出力を担当。出力フォーマットの詳細は、当該Phaseの実装REQ/RESで確定させる。
*   **CodeImporter.js** : 出力されたJSファイルを解析し、`VectorModel` に再ロードする。