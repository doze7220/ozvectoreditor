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
│   │   └── InputTracker.js
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

*   **VectorModel.js** : 描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。
*   **CanvasManager.js** : Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。
*   **InputTracker.js** : マウス・キーボード入力の解釈、キャンバス座標への変換。
*   **shapes/** : 図形種別ごとの定義・当たり判定。追加され次第、ここに列挙していく。
*   **palette/** : ツールバー・カラーピッカー等のUI部品。追加され次第、ここに列挙していく。
*   **CodeExporter.js** : ゲームで再利用可能なJavaScript(ESM)コードの出力を担当。出力フォーマットの詳細は、当該Phaseの実装REQ/RESで確定させる。
*   **CodeImporter.js** : 出力されたJSファイルを解析し、`VectorModel` に再ロードする。