*   **ThumbnailRules.js**：図形の一覧のサムネイルの収め方・線の太さの下限・描き直すかどうかの判定を、状態を持たない関数として提供する（Phase 11-02で新設。流れは`PROJECT_ARCHITECTURE.md`3章28.）。
    *   **公開**：`THUMBNAIL_SIZE_PX`（`28`。枠の正方形の1辺（CSSピクセル）の唯一の定義。`ItemListPanel`のサムネイルのCSS上の大きさと`ThumbnailRenderer`の内部バッファの元になる）・`computeThumbnailFit(bounds)`・`resolveThumbnailStrokeWidth(strokeWidth, scale)`・`buildThumbnailKey(shapeData, pixelRatio)`・`needsThumbnailRedraw(drawnKey, key)`。非公開の定数：余白2px・線の太さの下限1px。
    *   **`computeThumbnailFit(bounds)`**：`SpriteFitRules.computeSpriteFitTransform(bounds, 28, 28, 2)`をそのまま使う（拡大も行う・大きさ0の向きは倍率の制約にしない・`null`なら描かない）。`bounds`は`ShapeExtentReader.getShapeBounds(shape)`（線の太さを含む外枠）。小さい図形も枠いっぱいに大きく描く（発注者の決定）。
    *   **`resolveThumbnailStrokeWidth(strokeWidth, scale)`**：枠の上で`strokeWidth × scale`が1px未満なら`1 / scale`、それ以外は`strokeWidth`。`scale`が正の有限でない・`1 / scale`が有限でないときは`strokeWidth`のまま。下限で太くした線は外枠より片側0.5pxまで広がるが、余白2pxの内側に収まる。
    *   **`buildThumbnailKey(shapeData, pixelRatio)`**：`<pixelRatio>|<JSON.stringify(shapeData)>`の文字列。図形はドラッグ等でその場で書き換わるため、インスタンスの一致では描き直しを判定できず、図形の今の内容（`toJSON()`）と`devicePixelRatio`から作る。`needsThumbnailRedraw(drawnKey, key)`は、最後に描いた鍵が無い（`undefined`）か今の鍵と違うときに真。鍵を持つのは`wiring/ItemListWiring`（`WeakMap<HTMLCanvasElement, string>`。行の要素が捨てられれば一緒に消える）。
    *   **読むもの**：渡された値だけ。importは`core/SpriteFitRules`のみ（`core/`の規則どうしのimport。循環しない）。
    *   **知らないこと**：DOM・図形クラス・図形種別・`VectorModel`。状態を持たない。
    *   **使う側**：`core/ThumbnailRenderer`（`THUMBNAIL_SIZE_PX`・`computeThumbnailFit`・`resolveThumbnailStrokeWidth`）・`wiring/ItemListWiring`（`THUMBNAIL_SIZE_PX`・`buildThumbnailKey`・`needsThumbnailRedraw`）。
    *   **テスト**：`test/core/ThumbnailRules.test.js`（10件。`_doc/arch/16_test.md`）。
