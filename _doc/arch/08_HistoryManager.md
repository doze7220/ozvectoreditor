*   **HistoryManager.js**：編集操作の履歴（スナップショットの前後の組の列・取り消し/やり直しの位置・上限）の保持と、記録・取り消し・やり直し・リセット・可否の照会を担う。
    *   **公開メソッド**：`beginEdit`・`commitEdit`・`undo`・`redo`・`canUndo`・`canRedo`・`clear`・`onChange`。export：`HISTORY_LIMIT`（唯一の定義箇所）。
    *   **まとめの鍵（Phase 08-03。`commitEdit(groupKey)`の省略できる引数。流れと設計判断は3章6.・19.）**：同じ鍵で続けて記録された編集操作を、新しいエントリを足さず直前の1件へ畳む（`before`は据え置き、`after`だけ更新）。鍵の中身は解釈しない。
        *   **畳む条件**：`groupKey`が空でない文字列・直前に記録したエントリの鍵と同じ・位置 > 0。省略・空文字列は畳まず、従来どおり1件記録する（既存の呼び出し元のふるまいは変わらない）。
        *   **往復で消える**：畳んだ結果`before`と`after`の作業データが同一ならエントリを取り除き、位置を1つ戻し、鍵を忘れる（残すと次の同じ鍵が無関係な前のエントリへ畳まれてしまうため）。
        *   **鍵を忘れる契機**：`undo`・`redo`・`clear`、鍵なし／別の鍵での記録、往復で取り除いたとき。不変条件：鍵を覚えている間は「位置＝エントリ数」で、畳む処理はやり直しの履歴の破棄・`HISTORY_LIMIT`の判定を行わない（この条件に依存する）。前後が同じで記録しなかった`commitEdit`は鍵を変えない。
        *   **通知と戻り値**：畳んだとき・往復で取り除いたときも変更通知する。`commitEdit`の戻り値は「履歴に記録として残ったか」（新しいエントリ・畳んで残ったエントリ＝`true`、前後が同じ・往復で消えた・`beginEdit`なし＝`false`）。既存の呼び出し元は戻り値を使わない。
        *   **テスト**：`test/core/HistoryManager.test.js`（`_doc/arch/16_test.md`）。
    *   **スナップショットの項目（Phase 11-04a）**：typedef`Snapshot`に省略可の`selectedGroupIds`（その時点で選んでいるフォルダのid）・`collapsedGroupIds`（その時点で閉じているフォルダのid）を足した（JSDocのみ。コードは変えていない。本クラスは両方とも中身を解釈せず、記録時の比較は従来どおり`document`の`JSON.stringify`だけ）。`SnapshotAdapter.capture`は`document`から折りたたみ`collapsed`を外すため、折りたたみの変更だけでは前後の`document`が同じになり記録されず、まとめの鍵の往復の判定も折りたたみで変わらない。フォルダの選択・閉じているフォルダは`restore`の入力として運ばれるだけで、比較に入らない（選択だけの変化が記録されないのと同じ）。
    *   **知らないこと**：DOM・図形種別・図形固有のプロパティ名・作業データの中身。importは持たない。
    *   **注入**：スナップショットの取得・適用はコンストラクタで注入される`{ capture, restore }`（実体は`edit/SnapshotAdapter`）へ委譲する。`core/`から`io/`をimportしないため。
    *   **呼び出し元**：`beginEdit`/`commitEdit`は`InputTracker`（作成・ドラッグ。切り取り・削除の記録は、Phase 11-04aから`ClipboardController.cut`／`InputTracker.deleteSelection()`の先の`GroupEditor.removeSelection()`が挟み、`InputTracker`は記録先を呼ばない）、`GroupEditor`（まとめる・解除・空のフォルダ・削除。Phase 11-04a）、`main.js`（`?dev`の復元）、`ShapeInserter`（貼り付け・複製・インポート）、`PathJoiner`（結合）、`EndpointSnapper`（直線の描き終えでの描き足し・結合・閉じる）、`ShapeStyleEditor`（オプションバーのスタイルの変更。色の欄はピッカー操作の確定時に1件）、`ShapeOrderEditor`（重なり順の変更。Phase 11-04aで`apply`は`rearrangeItems`を1件の編集操作で挟む）、`NudgeEditor`（矢印キーの微調整。**まとめの鍵を渡すのは`NudgeEditor`だけ**）、`ShapeAlignEditor`（整列・分布。鍵なし）。`InputTracker`・`ShapeInserter`・`PathJoiner`・`EndpointSnapper`・`ShapeStyleEditor`・`ShapeOrderEditor`・`NudgeEditor`・`ShapeAlignEditor`・`GroupEditor`へは`EditRecorder`として注入され、いずれも`HistoryManager.js`をimportしない。`undo`/`redo`は`performUndo`/`performRedo`（`main.js`）のみ。`clear`は`CanvasLibrary`の切り替え処理のみ。`onChange`は`main.js`のボタン同期と`CanvasLibrary`の自動保存の契機。
    *   **変更通知**：記録時（まとめの鍵で畳んだとき・往復で取り除いたときを含む）・適用成功時・`clear()`で実際に何かを破棄したときのみ。`beginEdit()`・不記録の`commitEdit()`では通知しない。`restore`が`false`なら位置を動かさず通知しない。
    *   **保存しない**：履歴はメモリ上のみ。進行中の入力操作の中断は呼び出し側の責務。
    *   **注意**：記録ごとに`serialize`と`JSON.stringify`による比較が走り、最大100件×2のスナップショットを保持する（図形数が極端に多い場合は遅延・メモリを確認する）。
