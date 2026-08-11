# 作業指示書 REQ: (Phase 01-02 Task5.5 / Interrupt) : `updateVertex` / `moveShape` のLine固有プロパティ直接アクセス解消（ポリモーフィック化）
*  ルール: `./PROJECT_CONSTITUTION.md`
*  開発資料: `./PROJECT_ARCHITECTURE.md`
*  作業計画書: `./_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`

--------------------------------------------------------------------------------

## 【作業手順（厳守事項）】
本プロンプトは、Phase01-02 タスク5（`VectorModel.js`の`updateVertex` / `moveShape`実装）で発生した設計上の不備を修正するInterruptである。必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）および開発資料（`PROJECT_ARCHITECTURE.md`）を熟読・把握すること。
2. 作業計画書（`./_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`）を読み、タスク5の実装内容（`updateVertex` / `moveShape`が`shape.x1`等のLine固有プロパティに直接アクセスしている点）と、その懸念事項欄の該当記述（「`updateVertex` / `moveShape`におけるLine固有プロパティへの直接アクセス」）を確認すること。
3. 以下の【実装要件】に従って実装を開始し、ソースコードの修正を実行すること。**タスク6以降（`CanvasManager.js` / `InputTracker.js`）には絶対に着手しないこと。**
4. コード修正が完了したら、既存の作業レポート（`./_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`）の「3. タスクリスト」に、タスク5の直後へ **`[x] タスク5.5: shapeへの頂点操作の委譲（ポリモーフィック化）`** の行を追加した上で、作業レポート末尾に追記用テンプレート（`./_log/TEMPLATE_RES_AddInterrupt.md`）を用いて作業の詳細を追記すること。
    * 見出しは `### Phase 01-02 Task5.5 / Interrupt` とすること。
    * テンプレートの項目に従い、「追加作業目的」（＝原因・理由：タスク5時点でLine固有プロパティに直接アクセスしていたこと）と「対応」（具体的な修正内容）を正確に記述すること。
    * タスク5自体の「3. タスクリスト」の`[x]`表記および「4. 詳細作業内容」のタスク5本文、「5. 懸念事項・要確認ポイント」の既存記述は、1文字も改変しないこと（過去ログ保護）。
5. 開発資料（`PROJECT_ARCHITECTURE.md`）の内容に影響がある場合は資料を修正し、その旨を作業レポートの対応内容に含めること（`shapes/`の責務リファレンスに`setVertex` / `translate`を今後の図形が踏襲すべき共通インターフェースとして追記する必要があるかを判断すること）。
6. すべての作業が完了したら、チャットにて「Task5.5（Phase 01-02）が完了しました。ビルド・動作確認をお願いします」と報告すること。

--------------------------------------------------------------------------------

## 【実装要件】
タスク5で実装した`VectorModel.updateVertex(id, vertexIndex, x, y)`と`VectorModel.moveShape(id, dx, dy)`は、内部で`shape.x1` / `shape.y1` / `shape.x2` / `shape.y2`というLine固有のプロパティ名に直接アクセスしている。これは、本Phaseの中心命題（RES要件1：「`core/`配下は図形種別を意識せずポリモーフィックに呼び出すだけ」）に反しており、将来Line以外の図形（曲線・円・楕円）を追加した際にこの2メソッドがそのまま動作しない。今のうちに、`draw` / `hitTest` / `hitTestHandle` / `drawHandles` / `drawHover`と同じパターン（図形固有ロジックをshape自身に閉じ込める）に揃える。

*   **要件1: `shapes/Line.js` へのポリモーフィックAPI追加**
    *   `setVertex(vertexIndex, x, y)`：`vertexIndex === 0`なら`(x1, y1)`を、`vertexIndex === 1`なら`(x2, y2)`を絶対座標で更新するメソッドを追加する。`0`・`1`以外の値が渡された場合は何もしない（現行の`VectorModel.updateVertex`が持っていたガード条件を、そのままこのメソッド側に移す）。
    *   `translate(dx, dy)`：`x1, y1, x2, y2`すべてに`dx, dy`を加算するメソッドを追加する。
    *   両メソッドともJSDocで引数・戻り値・責務を明文化すること。
    *   ファイル先頭の責務定義（現在「直線のデータ保持・Canvasへの描画処理・当たり判定を担う。」）は、`setVertex` / `translate`が「データ保持（自身の座標の更新）」という既存の責務の範囲内に収まるため、**更新不要と判断する**（新たな責務の追加ではない）。もし実装AI側でこの判断に同意できない場合のみ、懸念事項欄にその理由を記述すること。

*   **要件2: `core/VectorModel.js` の内部実装のポリモーフィック化**
    *   `updateVertex(id, vertexIndex, x, y)`：`#shapes`からのid検索・存在しない場合の早期return・`#notifyChange()`呼び出しのロジックはそのまま維持し、頂点座標の更新処理のみを`shape.setVertex(vertexIndex, x, y)`の呼び出しに置き換える。`vertexIndex`の0/1判定ロジックは`Line.setVertex`側に移譲したため、`VectorModel`側から削除する。
    *   `moveShape(id, dx, dy)`：同様にid検索・早期return・`#notifyChange()`のロジックは維持し、座標加算処理のみを`shape.translate(dx, dy)`の呼び出しに置き換える。
    *   `updateVertex` / `moveShape`のメソッドシグネチャ（引数・戻り値）は変更しないこと（呼び出し元は未実装のため影響はないが、REQ本文・RESの要件2で確定済みのAPI形状を崩さないため）。

*   **スコープ外（本Interruptに絶対に含めないこと）**
    *   `core/CanvasManager.js` / `core/InputTracker.js`（タスク6〜10）への着手
    *   `setVertex` / `translate`以外の新規メソッド追加
    *   `hitTest` / `hitTestHandle` / `drawHandles` / `drawHover`等、既存メソッドの変更

--------------------------------------------------------------------------------

## 【絶対遵守ルール (Constraints)】
*   **図形種別分岐の排除の原則維持**：修正後、`VectorModel.js`側にLine固有のプロパティ名（`x1`, `y1`, `x2`, `y2`等）やif/switchによる型分岐が一切残っていないことを確認すること。
*   **外部インターフェースの不変性**：`updateVertex` / `moveShape`の呼び出し側から見た引数・戻り値・挙動（同一id・同一入力に対する結果）は、リファクタリング前後で変化しないこと。あくまで内部実装の委譲先を変更するのみとする。
*   **対象ファイルの限定**：変更してよいファイルは`./js/shapes/Line.js`と`./js/core/VectorModel.js`の2つのみ。
