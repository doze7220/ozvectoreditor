*   **InputModes.js**：入力の状態（`InputState`）と操作モード（`OperationMode`）の値の定義だけを持つ（Phase 08-01で`InputTracker.js`から切り出して新設）。判定・状態・関数を持たない。
    *   **公開**：`InputState`（素のオブジェクト。`IDLE`・`DRAWING`・`DRAGGING_HANDLE`・`MOVING_SELECTION`・`MARQUEE_SELECTING`。値は同名の文字列）・`OperationMode`（`Object.freeze`した値。`SELECT`＝`'select'`・`CREATE`＝`'create'`・`PAN`＝`'pan'`）。値・凍結の有無とも移動前と同じ。
    *   **読むもの**：なし（何もimportしない。DOMに触れない。`core/`の規則のファイルと同じ約束）。
    *   **使う側（import元）**：`core/InputTracker`（`InputState`・`OperationMode`）・`core/CursorShapeRules`（両方）・`core/ToolRules`（`OperationMode`）・`core/KeyboardShortcuts`（`OperationMode`）・`main.js`（`OperationMode`）。テストは`test/core/ToolRules.test.js`（`OperationMode`）・`test/core/CursorShapeRules.test.js`（両方）。`InputState`を`InputTracker.js`・`CursorShapeRules.js`の外で使うのはテストだけ。`InputTracker.js`は再exportしない。
    *   **知らないこと**：`InputTracker`の実装（JSDocが`InputTracker.setMode()`を参照するだけ）・DOM・図形・図形種別。`PointHit`のtypedefは`InputTracker.js`に残る（ここへ移していない）。
    *   **置き場所の理由**：`ToolRules`・`KeyboardShortcuts`が値だけのために`InputTracker.js`（`DragTracker`・DOMに依存するクラス）をimportしていたのをなくすため。`CursorShapeRules`が両方の値を使うため、`CursorShapeRules → InputTracker`のimportを避ける理由もある。`InputTracker`の再分離（状態の所有者設計）ではない。
    *   **注意**：操作モードを足すときはここへ1エントリを足す（`InputTracker.setMode()`の受理判定は本定義の値を正とする）。`OperationMode`の`SELECT`・`PAN`の値は`index.html`のボタンのid（`#tool-select`・`#tool-pan`）と対応する（`_doc/arch/19_ToolRules.md`）。
    *   **テスト**：専用のテストなし（値の定義のみ。`test/core/ToolRules.test.js`・`test/core/CursorShapeRules.test.js`が値を使う）。
