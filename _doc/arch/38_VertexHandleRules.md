*   **VertexHandleRules.js**：頂点の選択モードで描く頂点のハンドルの一覧の組み立てと、ハンドル名が頂点のハンドルかの判定を、図形の共通メソッドだけを使う状態を持たない関数として提供する（Phase 08-02aで新設）。
    *   **公開**：`collectVertexHandles(mode, shapes, selectedIds, selectedVertices)` → `Array<{ shapeId, handles: Array<{ x, y, selected }> }>`と、`isVertexHandle(shape, handleName)` → 真偽値。
    *   **`collectVertexHandles`**：`mode`が`OperationMode.VERTEX`でなければ空配列。そうでなければ`shapes`の並び（描画順）のうち`selectedIds`に含まれる図形について、`shape.getVertexHandleNames()`の順に`shape.getHandlePosition(name)`で位置を求め（`null`は飛ばす）、`selectedVertices`に同じ`{ shapeId, handle }`の組があれば`selected: true`にする。ハンドルが0個の図形（円・弧）は結果に含めない。毎回新しい配列を返し、引数を書き換えない。
    *   **`isVertexHandle`**：`shape`が`getVertexHandleNames`を持ち、その一覧に`handleName`が含まれるときだけ真（`'move'`・未知の名前・`shape`が`null`／`undefined`は偽で、例外を投げない）。
    *   **読むもの**：図形の共通メソッド`getVertexHandleNames`・`getHandlePosition`と`id`だけ（ポリモーフィックに呼ぶ。図形種別の分岐・図形固有のプロパティ名・`vertexIndex`規約を持たない）。importは`core/InputModes`の`OperationMode`のみ。
    *   **使う側**：`main.js`（`renderCurrentState`が`collectVertexHandles`の結果を`canvasManager.render`の`vertexHandles`へ渡す）と`core/InputTracker`（`#classifyPoint`が`isVertexHandle`で頂点のハンドルだけに絞り込む）。`SelectionRules`と同じく、`core/`の処理と`main.js`の両方が使う位置づけ。
    *   **知らないこと**：DOM・`CanvasManager`の描き方（色・大きさ）・`VectorModel`（選択集合・頂点の選択は引数で受け取る）・表示倍率・履歴・入力の状態。
    *   **置き場所の理由**：`CanvasManager`は状態・図形を知らず位置を引数で受け取り、`main.js`は判定・計算を持たず、`InputTracker`は図形種別を知らない。この3つの制約を同時に満たす置き場所が、`core/`の状態を持たない規則だった。ハンドル名の一覧の読み取りを1か所にまとめる意味もある。`InputTracker`の再分離ではない。
    *   **注意**：頂点として扱う名前の正本は図形の`getVertexHandleNames`（`_doc/arch/12_shapes.md`のハンドル名の契約の4つ目）。表示（`collectVertexHandles`）と当たりの絞り込み（`isVertexHandle`）が同じ一覧を読むため、食い違わない。
    *   **テスト**：`test/core/VertexHandleRules.test.js`（8件。実物の図形クラスを使い、5種別の一覧と位置・円/弧が含まれないこと・選択中でない図形が含まれないこと・`selected`の付き方・モードが違えば空配列・引数を書き換えないこと・`isVertexHandle`。`_doc/arch/16_test.md`）。
