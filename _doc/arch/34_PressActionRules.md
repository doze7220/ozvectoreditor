*   **PressActionRules.js**：選択モードと頂点の選択のモード（Phase 08-02b）のそれぞれで、マウスを押したときに、当たり分類の結果から「何の操作を始めるか」を決める規則（押下時の分岐の表）を、状態を持たない関数として提供する（Phase 08-01で`InputTracker.handleMouseDown`の末尾の分岐から切り出して新設。判定の順序・条件は移動前と同じ）。
    *   **公開**：`resolvePressAction(hit, isSelected, scaleHandle = null, rotationCorner = null)` → `PressAction`（選択モード。第3引数`scaleHandle`＝外枠のハンドル名か`null`はPhase 10-01で、第4引数`rotationCorner`＝回転の範囲の角の名前か`null`はPhase 10-02で足した）、`resolveVertexPressAction(hit, isVertexSelected, additive)` → `VertexPressAction`（頂点の選択のモード。Phase 08-02b。下の表）と、typedef`PressAction`（`{ type: 'scaleSelection', handle }`（Phase 10-01）・`{ type: 'rotateSelection', corner }`（Phase 10-02。`corner`は押した角の名前で、`rotationCorner`をそのまま返す）・`{ type: 'moveSelection' }`・`{ type: 'marquee' }`・`null`のいずれか。`null`は何もしない＝離した後の`click`で判定する）。Interrupt `261123_1213`で`{ type: 'dragHandle', target }`の結果と非公開の`MOVE_HANDLE_NAME`（`'move'`）を消した（選択モードでは`hit.handle`が常に`null`で通らず、`'move'`のハンドルも無いため）。**`resolvePressAction`は`hit.handle`を読まない**。
    *   **判定の表**（この順に判定する）：

        | 順 | 条件 | 結果 |
        | --- | --- | --- |
        | 0 | `scaleHandle`が空でない文字列（外枠のハンドル。Phase 10-01） | `{ type: 'scaleSelection', handle: scaleHandle }`（外枠のハンドルでの拡大縮小。図形の本体より優先。`isSelected`は呼ばない） |
        | 0b | `rotationCorner`が空でない文字列（回転の範囲。Phase 10-02。外枠のハンドルの次） | `{ type: 'rotateSelection', corner: rotationCorner }`（外枠の角の外側での回転。図形の本体より優先。`hit`・`isSelected`は見ない） |
        | 1 | `hit.bodyId`があり、`isSelected(hit.bodyId)`が真（本体が選択集合内） | `{ type: 'moveSelection' }`（本体ドラッグ。単一選択でも有効） |
        | 2 | `hit.bodyId === null`（空白） | `{ type: 'marquee' }`（範囲選択） |
        | 3 | それ以外（本体が選択集合外） | `null`（何も始めない） |

    *   **頂点の選択のモードの判定の表**（Phase 08-02b。**正本は`resolveVertexPressAction`**。この順に判定。選択モードの表は変えていない）：`VertexPressAction`は`{ type: 'dragSelectedVertices', target }`・`{ type: 'selectVertexAndDrag', target }`・`{ type: 'marquee' }`・`null`（何もしない＝離した後の`click`で選択へ追加・解除する）のいずれか。`target`は`hit.handle`そのもの。

        | 順 | 条件 | 結果 |
        | --- | --- | --- |
        | 1 | `hit.handle`があり、その頂点が選ばれている（`isVertexSelected(hit.handle.shapeId, hit.handle.handle)`が真） | `dragSelectedVertices`（選んでいる頂点すべてのドラッグ。`additive`によらない） |
        | 2 | `hit.handle`があり、選ばれていなくて`additive`が偽 | `selectVertexAndDrag`（その頂点だけを選び直してドラッグ） |
        | 3 | `hit.handle`があり、選ばれていなくて`additive`が真 | `null`（何も始めない。離した後の`click`で追加する） |
        | 4 | `hit.handle`が無い（図形の本体の上・空白のどちらでも） | `marquee`（範囲選択。図形は動かない） |

        `isVertexSelected`を呼ぶのは`hit.handle`があるときだけで1回。頂点のハンドルだけに絞り込むのはここでは行わない（`PointHitRules.findHandleHit`が行う。`InputTracker`の`#classifyPoint`は結果をそのまま渡す）。`additive`は`Ctrl`（`⌘`を含む）の真偽値として読むだけ。**不整合に見える組み合わせ**：順1は`Ctrl`によらずドラッグを始めるため、`Ctrl`＋選ばれている頂点を押して閾値以内で離すと、直後の`click`（`Ctrl`あり・選択中→外す）でその頂点が選択から外れる。図形側と同じ約束で、REQどおりの正しいふるまい。
    *   **読むもの**：引数の`hit`（`PointHitRules`のtypedef`PointHit`。JSDocの型参照のみで、`import`文は書かない）と、`resolvePressAction`の`isSelected`（`(id) => boolean`）、`resolveVertexPressAction`の`isVertexSelected`（`(shapeId, handle) => boolean`）・`additive`（真偽値）。何もimportしない。引数を書き換えない。**`isSelected`を呼ぶのは本体の判定（順1）のときだけで、引数は`hit.bodyId`**（空白のときは呼ばない。呼び出しの回数を移動前と変えないため）。結果の`moveSelection`・`marquee`は毎回新しいオブジェクト。`scaleHandle`（`string|null`）は空でない文字列かだけを見る（名前の意味は知らない。`null`・省略・空文字は外枠のハンドルなしで、順1以降の結果と`isSelected`の呼び出しの回数は今までと同じ）。`rotationCorner`（`string|null`）も空でない文字列かだけを見る（角の名前の意味は知らない。`null`・省略・空文字は回転の範囲なしで、順0b以外の結果と`isSelected`の呼び出しの回数は今までと同じ。順0が順0bより先のため、外枠のハンドルと回転の範囲が両方渡されても拡大縮小）。
    *   **使う側**：`core/InputTracker.handleMouseDown`のみ（頂点の選択のモードは`resolveVertexPressAction`の結果を`dragSelectedVertices`・`selectVertexAndDrag`→`#beginLeftDrag(…, DRAGGING_HANDLE, …)`、`marquee`→`#beginLeftDrag(…, MARQUEE_SELECTING, …)`へ振り分ける（`_doc/arch/06_InputTracker.md`）。選択モードは`resolvePressAction(hit, (id) => this.model.isSelected(id), 外枠のハンドル名, 回転の範囲の角の名前)`の結果（Phase 10-01で第3引数、Phase 10-02で第4引数を足した。外枠のハンドル名は`#findScaleHandle`の結果。回転の範囲の角の名前は`scaleHit`が無いときだけ求める`#findRotationZone`の結果）を、`scaleSelection`→`#beginScaleSelection`、`rotateSelection`→`#beginRotateSelection`（`Alt`・`Ctrl`は見ない）、`moveSelection`→`#beginMoveSelection`、`marquee`→`#beginLeftDrag(…, InputState.MARQUEE_SELECTING, …)`へ振り分け、`null`は何もしない）。それ以前の判定（中ボタン・`Space`・パン・スポイトの待ち受け・図形作成モード等）と、当たり分類（`#classifyPoint`）・`event.altKey`の記憶（`#beginMoveSelection`）は`InputTracker`に残る。
    *   **知らないこと**：DOM・イベント・修飾キー（`Ctrl`・`Shift`・`Alt`。選択モードの押下時の分岐の表は`Ctrl`で変えない＝2026-11-14 発注者の決定。頂点の選択のモードは`additive`の真偽値だけを受け取る。`PROJECT_ARCHITECTURE.md`3章）・操作モード・入力状態（`InputState`）・図形種別・`VectorModel`。
    *   **置き場所の理由**：分岐の表を`node --test`で確かめるため（`InputTracker.js`は`DragTracker`・DOMに依存し、ソースを書き換えないテストの規則のもとでは非公開メソッドを確かめられない）。`PointHitRules`と同じ形（`InputTracker`だけが使う状態のない規則）。`InputTracker`の再分離（状態の所有者設計）ではない。
    *   **注意**：押下時の分岐の表を変えるときはこのファイルだけを変える。選択モードの当たり分類では`hit.handle`は常に`null`（`includeHandles`が偽。`_doc/arch/18_PointHitRules.md`）のため、図形ごとのハンドルの枝は持たない。
    *   **テスト**：`test/core/PressActionRules.test.js`（27件。Interrupt `261123_1213`で選択モードの「ハンドルあり」の5件を削除して32件から27件。以下は削除前の内訳：選択モードの12件＋外枠のハンドルの7件（Phase 10-01）＋頂点の選択のモードの8件。Phase 10-02で回転の範囲の5件を足して32件（順0bで角の名前をそのまま返す・図形の本体・図形ごとのハンドルより優先で`isSelected`を呼ばない・外枠のハンドルのほうが優先・空文字／`null`／省略で従来どおり・毎回新しいオブジェクトで`hit`を書き換えない）。`_doc/arch/16_test.md`）。
