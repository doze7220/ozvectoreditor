*   **HistoryManager.js**：編集操作の履歴（スナップショットの前後の組の列・取り消し/やり直しの位置・上限）の保持と、記録・取り消し・やり直し・リセット・可否の照会を担う。
    *   **公開メソッド**：`beginEdit`・`commitEdit`・`undo`・`redo`・`canUndo`・`canRedo`・`clear`・`onChange`。export：`HISTORY_LIMIT`（唯一の定義箇所）。
    *   **知らないこと**：DOM・図形種別・図形固有のプロパティ名・作業データの中身。importは持たない。
    *   **注入**：スナップショットの取得・適用はコンストラクタで注入される`{ capture, restore }`（実体は`edit/SnapshotAdapter`）へ委譲する。`core/`から`io/`をimportしないため。
    *   **呼び出し元**：`beginEdit`/`commitEdit`は`InputTracker`（作成・削除・切り取り・ドラッグ）、`main.js`（`?dev`の復元）、`ShapeInserter`（貼り付け・複製・インポート）。`InputTracker`・`ShapeInserter`へは`EditRecorder`として注入され、両者は`HistoryManager.js`をimportしない。`undo`/`redo`は`performUndo`/`performRedo`（`main.js`）のみ。`clear`は`CanvasLibrary`の切り替え処理のみ（JSDocの「開く・新規作成時に呼ぶ前提」は古い）。`onChange`は`main.js`のボタン同期と`CanvasLibrary`の自動保存の契機。
    *   **変更通知**：記録時・適用成功時・`clear()`で実際に何かを破棄したときのみ。`beginEdit()`・不記録の`commitEdit()`では通知しない。`restore`が`false`なら位置を動かさず通知しない。
    *   **保存しない**：履歴はメモリ上のみ。進行中の入力操作の中断は呼び出し側の責務。
    *   **注意**：記録ごとに`serialize`と`JSON.stringify`による比較が走り、最大100件×2のスナップショットを保持する（図形数が極端に多い場合は遅延・メモリを確認する）。
