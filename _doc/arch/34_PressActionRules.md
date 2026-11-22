*   **PressActionRules.js**：選択モードと頂点の選択のモード（Phase 08-02b）のそれぞれで、マウスを押したときに、当たり分類の結果から「何の操作を始めるか」を決める規則（押下時の分岐の表）を、状態を持たない関数として提供する（Phase 08-01で`InputTracker.handleMouseDown`の末尾の分岐から切り出して新設。判定の順序・条件は移動前と同じ）。
    *   **公開**：`resolvePressAction(hit, isSelected, scaleHandle = null)` → `PressAction`（選択モード。第3引数`scaleHandle`＝外枠のハンドル名か`null`はPhase 10-01で足した）、`resolveVertexPressAction(hit, isVertexSelected, additive)` → `VertexPressAction`（頂点の選択のモード。Phase 08-02b。下の表）と、typedef`PressAction`（`{ type: 'scaleSelection', handle }`（Phase 10-01）・`{ type: 'moveSelection' }`・`{ type: 'dragHandle', target }`・`{ type: 'marquee' }`・`null`のいずれか。`null`は何もしない＝離した後の`click`で判定する）。非公開：`MOVE_HANDLE_NAME`（`'move'`。各図形の`hitTestHandle`の戻り値と一致させる。`core/`での`'move'`との比較はここ1か所だけ（図形クラスでは`Line`・`Ellipse`の`getHandlePosition`も`'move'`と比較する））。
    *   **判定の表**（この順に判定する）：

        | 順 | 条件 | 結果 |
        | --- | --- | --- |
        | 0 | `scaleHandle`が空でない文字列（外枠のハンドル。Phase 10-01） | `{ type: 'scaleSelection', handle: scaleHandle }`（外枠のハンドルでの拡大縮小。図形の本体・図形ごとのハンドルより優先。`isSelected`は呼ばない） |
        | 1 | `hit.handle`があり、そのハンドル名が`'move'` | `{ type: 'moveSelection' }`（選択集合の全図形を平行移動） |
        | 2 | `hit.handle`があり、それ以外（頂点のハンドル） | `{ type: 'dragHandle', target: hit.handle }`（`target`は`hit.handle`そのもの。そのハンドルが属する1図形の頂点だけを変形） |
        | 3 | `hit.bodyId`があり、`isSelected(hit.bodyId)`が真（本体が選択集合内） | `{ type: 'moveSelection' }`（本体ドラッグ。単一選択でも有効） |
        | 4 | `hit.bodyId === null`（空白） | `{ type: 'marquee' }`（範囲選択） |
        | 5 | それ以外（本体が選択集合外） | `null`（何も始めない） |

    *   **頂点の選択のモードの判定の表**（Phase 08-02b。**正本は`resolveVertexPressAction`**。この順に判定。選択モードの表は変えていない）：`VertexPressAction`は`{ type: 'dragSelectedVertices', target }`・`{ type: 'selectVertexAndDrag', target }`・`{ type: 'marquee' }`・`null`（何もしない＝離した後の`click`で選択へ追加・解除する）のいずれか。`target`は`hit.handle`そのもの。

        | 順 | 条件 | 結果 |
        | --- | --- | --- |
        | 1 | `hit.handle`があり、その頂点が選ばれている（`isVertexSelected(hit.handle.shapeId, hit.handle.handle)`が真） | `dragSelectedVertices`（選んでいる頂点すべてのドラッグ。`additive`によらない） |
        | 2 | `hit.handle`があり、選ばれていなくて`additive`が偽 | `selectVertexAndDrag`（その頂点だけを選び直してドラッグ） |
        | 3 | `hit.handle`があり、選ばれていなくて`additive`が真 | `null`（何も始めない。離した後の`click`で追加する） |
        | 4 | `hit.handle`が無い（図形の本体の上・空白のどちらでも） | `marquee`（範囲選択。図形は動かない） |

        `isVertexSelected`を呼ぶのは`hit.handle`があるときだけで1回。`'move'`ハンドルの除外はここでは行わない（頂点のハンドルだけに絞り込むのは呼び出し側＝`InputTracker`の`#classifyPoint`）。`additive`は`Ctrl`（`⌘`を含む）の真偽値として読むだけ。**不整合に見える組み合わせ**：順1は`Ctrl`によらずドラッグを始めるため、`Ctrl`＋選ばれている頂点を押して閾値以内で離すと、直後の`click`（`Ctrl`あり・選択中→外す）でその頂点が選択から外れる。図形側と同じ約束で、REQどおりの正しいふるまい。
    *   **読むもの**：引数の`hit`（`PointHitRules`のtypedef`PointHit`。JSDocの型参照のみで、`import`文は書かない）と、`resolvePressAction`の`isSelected`（`(id) => boolean`）、`resolveVertexPressAction`の`isVertexSelected`（`(shapeId, handle) => boolean`）・`additive`（真偽値）。何もimportしない。引数を書き換えない。**`isSelected`を呼ぶのは本体の判定（順3）のときだけで、引数は`hit.bodyId`**（ハンドルがあるとき・空白のときは呼ばない。呼び出しの回数を移動前と変えないため）。結果の`moveSelection`・`marquee`は毎回新しいオブジェクト。`scaleHandle`（`string|null`）は空でない文字列かだけを見る（名前の意味は知らない。`null`・省略・空文字は外枠のハンドルなしで、順1以降の結果と`isSelected`の呼び出しの回数は今までと同じ）。
    *   **使う側**：`core/InputTracker.handleMouseDown`のみ（頂点の選択のモードは`resolveVertexPressAction`の結果を`dragSelectedVertices`・`selectVertexAndDrag`→`#beginLeftDrag(…, DRAGGING_HANDLE, …)`、`marquee`→`#beginLeftDrag(…, MARQUEE_SELECTING, …)`へ振り分ける（`_doc/arch/06_InputTracker.md`）。選択モードは`resolvePressAction(hit, (id) => this.model.isSelected(id), 外枠のハンドル名)`の結果（Phase 10-01で第3引数を足した。外枠のハンドル名は`#findScaleHandle`の結果）を、`scaleSelection`→`#beginScaleSelection`、`moveSelection`→`#beginMoveSelection`、`dragHandle`→`#beginLeftDrag(…, InputState.DRAGGING_HANDLE, …)`、`marquee`→`#beginLeftDrag(…, InputState.MARQUEE_SELECTING, …)`へ振り分け、`null`は何もしない）。それ以前の判定（中ボタン・`Space`・パン・スポイトの待ち受け・図形作成モード等）と、当たり分類（`#classifyPoint`）・`event.altKey`の記憶（`#beginMoveSelection`）は`InputTracker`に残る。
    *   **知らないこと**：DOM・イベント・修飾キー（`Ctrl`・`Shift`・`Alt`。選択モードの押下時の分岐の表は`Ctrl`で変えない＝2026-11-14 発注者の決定。頂点の選択のモードは`additive`の真偽値だけを受け取る。`PROJECT_ARCHITECTURE.md`3章）・操作モード・入力状態（`InputState`）・図形種別・`VectorModel`。
    *   **置き場所の理由**：分岐の表を`node --test`で確かめるため（`InputTracker.js`は`DragTracker`・DOMに依存し、ソースを書き換えないテストの規則のもとでは非公開メソッドを確かめられない）。`PointHitRules`と同じ形（`InputTracker`だけが使う状態のない規則）。`InputTracker`の再分離（状態の所有者設計）ではない。
    *   **注意**：押下時の分岐の表を変えるときはこのファイルだけを変える。ハンドルの優先は`PointHitRules`の優先順位（`_doc/arch/18_PointHitRules.md`）の結果をそのまま使う（ハンドルが当たれば本体の判定より先）。
    *   **テスト**：`test/core/PressActionRules.test.js`（27件。選択モードの12件＋外枠のハンドルの7件（Phase 10-01）＋頂点の選択のモードの8件。`_doc/arch/16_test.md`）。
