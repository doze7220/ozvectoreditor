*   **VectorModel.js**：描画データ（Shape配列）と、選択集合・ホバー状態・作成中図形・選択矩形を保持する単一の真実（SSOT）。
    *   **公開メソッド**：`getShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`・`deleteShapes`・`updateVertex`・`moveShapes`／`setSelection`・`clearSelection`・`getSelectedIds`・`isSelected`／`setHovered`・`clearHovered`・`getHoveredId`／`setSelectionRect`・`clearSelectionRect`・`getSelectionRect`／`startDraft`・`updateDraft`・`commitDraft`・`cancelDraft`・`getDraftShape`／`onChange`／`addShape`（使わない。理由はJSDoc）。
    *   **`replaceShape`**：指定idの図形の位置へ新しい図形を入れ、指定の図形を除き、結果の図形だけを選択する（通知は1回）。`keepId`が真なら指定idを引き継ぎ、偽なら`#issueId()`で新しいidを採番する。呼び出し元は`PathJoiner`。選択モードであることは呼び出し側の保証。
    *   **知らないこと**：図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式・`DocumentSerializer`。`Line`への直接依存も持たない。
    *   **委譲**：再編集・追従は対象図形の`setVertex`/`translate`/`updateDraftEnd`へポリモーフィックに委譲する。生成は`ShapeFactory.create`へ委譲する。復元は`DocumentSerializer`→`ShapeFactory.fromJSON`が行い、`VectorModel`は復元済みの図形一式を受け取るのみ。
    *   **id**：図形idの採番（形式`shape-<連番>`）は1箇所に一本化する。連番カウンタは単調増加で減らさない。id形式の知識は`VectorModel`内に閉じる（他モジュールはid形式を解釈しない）。単一選択は`setSelection([id])`で表現する。
