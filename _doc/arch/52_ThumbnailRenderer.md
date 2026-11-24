*   **ThumbnailRenderer.js**：1つの`<canvas>`へ図形1つをサムネイルとして描く、`CanvasManager`・`RulerRenderer`と同じ「引数だけから毎回描く、状態を持たないレンダラー」（Phase 11-02で新設。流れは`PROJECT_ARCHITECTURE.md`3章28.）。
    *   **公開**：`drawThumbnail(canvas, shape, bounds, pixelRatio)`のみ。呼び出し元は`wiring/ItemListWiring`の`#drawVisibleThumbnails`。
    *   **手順**：①内部バッファを`THUMBNAIL_SIZE_PX × pixelRatio`（丸めて1以上）の正方形にし直す（代入で内容も消える。`<canvas>`は透明に消えて、図形だけを描く。枠の背景はCSSの`#b0b0b0`で、キャンバスの背景・アウトライン表示の影響を受けない）。②`computeThumbnailFit(bounds)`が`null`（外枠が求まらない）なら描かず空のまま。③`shape.createTransformed(恒等変換)`で**別のインスタンスの写し**を作り、その`strokeWidth`へ`resolveThumbnailStrokeWidth`の値を入れる。④`ctx.setTransform`で収める変換（内部バッファの倍率を含む）を設定し、`copy.draw(ctx)`を呼ぶ（`draw`は`lineWidth`に自身の`strokeWidth`を使うため、写しの`strokeWidth`を書き換える）。線も塗りもない図形は`draw`が何も描かず空の枠になる。
    *   **契約**：元の図形のインスタンスを書き換えない（書くのは写しの`strokeWidth`だけ）。図形種別の分岐・図形固有のプロパティ名を持たない（読み書きするのは共通プロパティの`strokeWidth`、呼ぶのは共通メソッドの`createTransformed`・`draw`だけ。`12_shapes.md`の18メソッド契約）。`getContext('2d')`が`null`なら何もしない。
    *   **読むもの・知らないこと**：importは`core/ThumbnailRules`のみ。`shapes/`を新たにimportしない。アプリケーション状態・`io/`・`edit/`・`palette/`・`wiring/`を知らない。外枠は呼び出し側（`wiring/`）が`ShapeExtentReader.getShapeBounds`で求めて渡す（`core/`は`io/`をimportできないため）。
    *   **使う側**：`wiring/ItemListWiring`だけ。
    *   **テスト**：`test/core/ThumbnailRenderer.test.js`（10件。偽の`<canvas>`・実物の図形5種。画面での見え方は発注者のテストプレイ。`_doc/arch/16_test.md`）。
