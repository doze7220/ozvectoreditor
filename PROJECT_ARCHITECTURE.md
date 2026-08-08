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
│   │   └── ShapeFactory.js
│   ├── shapes/
│   │   └── (図形クラスを種別ごとに1ファイルで追加していく)
│   ├── palette/
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
    ├── _req/
    │   └── closed/    # 実装・動作確認が全て完了したREQファイルの移動先
    └── _res/
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

*   **VectorModel.js** : 描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。選択状態(`#selectedId`)・ホバー状態(`#hoveredId`)・作成中Line(`#draftLine`)を併せて保持する。選択/ホバーの読み書きAPI（`selectShape`/`clearSelection`/`getSelectedId`、`setHovered`/`clearHovered`/`getHoveredId`）と、ドラフト（作成中Line）のライフサイクルAPI（`startDraft`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。図形idの採番（連番）は`commitDraft()`実行時にここで行う。再編集用の`updateVertex(id, vertexIndex, x, y)`/`moveShape(id, dx, dy)`は、図形固有の頂点構造を意識せず対象shapeの`setVertex(vertexIndex, x, y)`/`translate(dx, dy)`へポリモーフィックに委譲する（`core/`側にshapeの内部プロパティ名を持ち込まない）。図形の生成は`Line`への直接依存を持たず`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する（`startDraft(x, y, type = 'line')`のシグネチャで生成種別を受け取る）。図形削除用の`deleteShape(id)`を持ち、削除対象が選択中/ホバー中であった場合はそれらの状態も同時にクリアする。
*   **CanvasManager.js** : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedId, draftLine } = {})`の形で呼び出される。通常描画（`shape.draw(ctx)`）に加え、`hoveredId`と一致する図形には`drawHover(ctx)`を、`selectedId`と一致する図形には`drawHandles(ctx)`をポリモーフィックに追加呼び出す。`draftLine`が渡された場合は全図形描画後に`draw(ctx)`のみ重ねて描画する。第2引数は省略可能（省略時はデフォルト値によりすべてnull扱いとなり通常描画のみ行う）。内部バッファサイズとdprスケールの計算・再適用は公開メソッド`resize()`（旧`initCanvasSize()`を一本化・改称）が担い、コンストラクタからの初期化と`main.js`からのウィンドウリサイズ時の再同期の両方から呼び出される。`resize()`はバッファサイズ・スケールの再計算のみを行い、`render()`の呼び出しは行わない（再描画トリガーは`main.js`側の責務）。
*   **InputTracker.js** : マウス・キーボード入力の解釈、キャンバス座標への変換。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシンとして実装する。`IDLE`ではホバー判定・選択・新規作成の開始、`DRAWING`では作成中Lineの追従・確定、`DRAGGING_HANDLE`ではハンドルドラッグによる頂点更新・平行移動を扱い、状態に応じて`VectorModel`の対応するAPIを呼び出す。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。現在アクティブなツール種別(`currentTool`: `'select'`/`'line'`)を保持し、`setTool(tool)`によって切り替える。ツール切り替え時は選択/ホバー状態の無条件クリアおよび進行中操作の強制中断（IDLE復帰）を行う。`currentTool`に応じて`handleMouseMove`のホバー判定・`handleMouseDown`のハンドル検出・`handleClick`のクリック解釈を排他的に切り替える（`select`ツール中のみホバー判定/ハンドル検出/選択操作を行い、`line`ツール中は常に新規Line作成を開始する）。`document`を購読先とする`keydown`ハンドラも持ち、`select`ツール中に選択図形がある状態での`Delete`/`Backspace`押下で`VectorModel.deleteShape(id)`を呼び出す図形削除機能を持つ。
*   **ShapeFactory.js** : 図形typeに応じたインスタンス生成を一元的に担うFactory。静的メソッド`create(type, x1, y1, x2, y2)`を持ち、`type === 'line'`の場合は`new Line(x1, y1, x2, y2)`を返す。未知の`type`が渡された場合は`Error`をthrowする。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュールである。
*   **shapes/** : 図形種別ごとの定義・当たり判定。各図形が自身のプロパティと描画ロジック(`draw`メソッド)を持つ。追加され次第、ここに列挙していく。
    *   **Line.js**（作成済み）: 直線のデータ保持・描画・当たり判定を担う。共通インターフェースとして `hitTest(x, y, tolerance)`（本体の当たり判定）、`hitTestHandle(x, y, tolerance)`（start/end/moveハンドルの当たり判定、戻り値`'start'|'end'|'move'|null`）、`drawHandles(ctx)`（選択中のハンドル描画）、`drawHover(ctx)`（ホバー時の強調描画）、`setVertex(vertexIndex, x, y)`（頂点の絶対座標更新）、`translate(dx, dy)`（相対移動）を実装する。今後追加する図形（曲線・円・楕円等）も、この6メソッドを自身に実装することで`core/`側（VectorModel/CanvasManager/InputTracker）を変更せずに同一の作成・選択・再編集フローへ組み込める。
*   **palette/** : ツールバー・カラーピッカー等のUI部品。追加され次第、ここに列挙していく。
*   **CodeExporter.js** : ゲームで再利用可能なJavaScript(ESM)コードの出力を担当。出力フォーマットの詳細は、当該Phaseの実装REQ/RESで確定させる。
*   **CodeImporter.js** : 出力されたJSファイルを解析し、`VectorModel` に再ロードする。