*   **PressActionRules.js**：選択モードでマウスを押したときに、当たり分類の結果から「何の操作を始めるか」を決める規則（押下時の分岐の表）を、状態を持たない関数として提供する（Phase 08-01で`InputTracker.handleMouseDown`の末尾の分岐から切り出して新設。判定の順序・条件は移動前と同じ）。
    *   **公開**：`resolvePressAction(hit, isSelected)` → `PressAction`と、typedef`PressAction`（`{ type: 'moveSelection' }`・`{ type: 'dragHandle', target }`・`{ type: 'marquee' }`・`null`のいずれか。`null`は何もしない＝離した後の`click`で判定する）。非公開：`MOVE_HANDLE_NAME`（`'move'`。各図形の`hitTestHandle`の戻り値と一致させる。`'move'`との比較はここ1か所だけ）。
    *   **判定の表**（この順に判定する）：

        | 順 | 条件 | 結果 |
        | --- | --- | --- |
        | 1 | `hit.handle`があり、そのハンドル名が`'move'` | `{ type: 'moveSelection' }`（選択集合の全図形を平行移動） |
        | 2 | `hit.handle`があり、それ以外（頂点のハンドル） | `{ type: 'dragHandle', target: hit.handle }`（`target`は`hit.handle`そのもの。そのハンドルが属する1図形の頂点だけを変形） |
        | 3 | `hit.bodyId`があり、`isSelected(hit.bodyId)`が真（本体が選択集合内） | `{ type: 'moveSelection' }`（本体ドラッグ。単一選択でも有効） |
        | 4 | `hit.bodyId === null`（空白） | `{ type: 'marquee' }`（範囲選択） |
        | 5 | それ以外（本体が選択集合外） | `null`（何も始めない） |

    *   **読むもの**：引数の`hit`（`PointHitRules`のtypedef`PointHit`。JSDocの型参照のみで、`import`文は書かない）と`isSelected`（`(id) => boolean`）。何もimportしない。引数を書き換えない。**`isSelected`を呼ぶのは本体の判定（順3）のときだけで、引数は`hit.bodyId`**（ハンドルがあるとき・空白のときは呼ばない。呼び出しの回数を移動前と変えないため）。結果の`moveSelection`・`marquee`は毎回新しいオブジェクト。
    *   **使う側**：`core/InputTracker.handleMouseDown`のみ（`resolvePressAction(hit, (id) => this.model.isSelected(id))`の結果を、`moveSelection`→`#beginMoveSelection`、`dragHandle`→`#beginLeftDrag(…, InputState.DRAGGING_HANDLE, …)`、`marquee`→`#beginLeftDrag(…, InputState.MARQUEE_SELECTING, …)`へ振り分け、`null`は何もしない）。それ以前の判定（中ボタン・`Space`・パン・スポイトの待ち受け・図形作成モード等）と、当たり分類（`#classifyPoint`）・`event.altKey`の記憶（`#beginMoveSelection`）は`InputTracker`に残る。
    *   **知らないこと**：DOM・イベント・修飾キー（`Ctrl`・`Shift`・`Alt`。押下時の分岐の表は`Ctrl`で変えない＝2026-11-14 発注者の決定。`PROJECT_ARCHITECTURE.md`3章）・操作モード・入力状態（`InputState`）・図形種別・`VectorModel`。
    *   **置き場所の理由**：分岐の表を`node --test`で確かめるため（`InputTracker.js`は`DragTracker`・DOMに依存し、ソースを書き換えないテストの規則のもとでは非公開メソッドを確かめられない）。`PointHitRules`と同じ形（`InputTracker`だけが使う状態のない規則）。`InputTracker`の再分離（状態の所有者設計）ではない。
    *   **注意**：押下時の分岐の表を変えるときはこのファイルだけを変える。ハンドルの優先は`PointHitRules`の優先順位（`_doc/arch/18_PointHitRules.md`）の結果をそのまま使う（ハンドルが当たれば本体の判定より先）。
    *   **テスト**：`test/core/PressActionRules.test.js`（12件。`_doc/arch/16_test.md`）。
