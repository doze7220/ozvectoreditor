*   **ToolRules.js**：ツール（選択・キャンバス移動・図形の種別）の一覧と、操作モード・図形種別から押し込みの表示にするツールを求める規則を、状態を持たない関数として提供する（Phase 07-01で新設）。
    *   **公開**：`TOOL_IDS`（ツールの識別子の凍結した配列。`[OperationMode.SELECT, OperationMode.PAN, ...SHAPE_TYPES]`。並び＝ツールパレットのボタンの並び）と`resolveActiveTool(mode, shapeType)`。
    *   **識別子の約束**：選択・キャンバス移動のツールは`OperationMode`の値（`'select'`・`'pan'`）と同じ、図形のツールは図形種別の値と同じ。ボタンのid`tool-${toolId}`は`index.html`側の約束で、本ファイルはDOMを知らない。図形種別に`'select'`・`'pan'`という名前を足さない（`TOOL_IDS`の重複はテストで検出する）。`OperationMode`の値を変えると`#tool-select`・`#tool-pan`と食い違う（起動時に`ToolPalette`の警告で分かる）。
    *   **`resolveActiveTool`**：`mode`が選択→`'select'`、キャンバス移動→`'pan'`（`shapeType`は見ない）、図形作成→`shapeType`（`SHAPE_TYPES`に含まれるときのみ）。それ以外（未知の`mode`、図形作成モードで`SHAPE_TYPES`外の`shapeType`）は`null`（どのボタンも押し込みにしない。`InputTracker`は不正値を受け付けないため実際には起きない）。図形種別ごとの分岐は持たない。
    *   **import**：`OperationMode`（`core/InputTracker`）・`SHAPE_TYPES`（`core/ShapeFactory`。正本）のみ。`InputTracker`・`ShapeFactory`は`ToolRules`をimportしない（循環なし）。`InputTracker.js`はモジュールの最上位でDOMに触れないため`node --test`でimportできる（最上位でDOMに触れる変更をするとテストが壊れる）。
    *   **使う側**：`main.js`のみ（`TOOL_IDS`を`ToolPalette`へ渡し、`syncToolPalette`が`resolveActiveTool`の結果を`toolPalette.setActiveTool`へ渡す）。`core/`の処理からは使われない。
    *   **知らないこと**：DOM・`InputTracker`のインスタンス・ボタンのid・`VectorModel`。状態を持たず引数を書き換えない。
    *   **置き場所の理由**：規則は操作モード（`InputTracker`の`OperationMode`）と図形種別（`ShapeFactory`の`SHAPE_TYPES`）の知識を要する。`edit/`は操作モードを知らず、`palette/`はimportを持たず、`main.js`は判定を持たず、`InputTracker`へは入れない（再分離ではない）ため、`core/`に状態を持たない関数として置いた。`core/`の他の規則（`PointHitRules`）は`core/`の処理から使われるが、`ToolRules`は`main.js`だけから使われる（`PROJECT_ARCHITECTURE.md`1章「フォルダ分割の方針」の`core/`）。
    *   **テスト**：`test/core/ToolRules.test.js`（`_doc/arch/16_test.md`）。
