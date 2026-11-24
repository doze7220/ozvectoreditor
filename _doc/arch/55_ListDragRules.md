*   **ListDragRules.js**：図形の一覧の行のドラッグ（並べ替え）の規則を、状態を持たない関数として提供する（Phase 11-03で新設。流れは`PROJECT_ARCHITECTURE.md`3章28.）。動かす行・ドロップ位置・線を出す行・動かした後の並び・自動スクロールの量を求める。
    *   **公開**：`resolveDraggedIds`・`resolveDropIndex`・`resolveDropMark`・`reorderRowsForDrop`・`isSameOrder`・`toDrawOrder`・`resolveAutoScrollTop`と、typedef`ListArea`・`RowIds`・`DropMark`。定数（自動スクロールの帯24px・最小90px/秒・最大900px/秒・経過時間の上限50ms）はファイル内のもので、exportしない。
    *   **`resolveDraggedIds({ rowIds, selectedIds, pressedId })`**：押した行が選ばれていれば、選ばれている行すべて（行の並びの順）。そうでなければ`[pressedId]`。`selectedIds`は`Set`・配列のどちらも受ける。新しい配列。
    *   **`resolveDropIndex({ pointerX, pointerY, area, rowCount })`** → `number|null`：`area`＝`ListArea`（`{ left, right, top, height, scrollTop, maxScrollTop, rowHeight }`。クライアント座標px）。`pointerX`が`left`未満・`right`より大きければ`null`。`rowCount`が正でない・`rowHeight`か`height`が正でなければ`null`。高さを`[top, top + height]`へ収め（上下へ外れたときは見えている端）、`Math.round((y − top + scrollTop) / rowHeight)`を`0`〜`rowCount`に収めて返す（`0`＝一番上の行の上、`rowCount`＝一番下の行の下）。
    *   **`resolveDropMark(rowIds, dropIndex)`** → `{ id, edge: 'before'|'after' }|null`：`dropIndex`が`null`・行が無ければ`null`、`rowIds.length`未満ならその行の`'before'`、`rowIds.length`なら最後の行の`'after'`。
    *   **`reorderRowsForDrop({ rowIds, draggedIds, dropIndex })`**：`dropIndex`より上の動かさない行 ＋ 動かす行（行の並びの順）＋ 残りの動かさない行。新しい配列。
    *   **`isSameOrder(a, b)`**：2つのidの並びが同じか（長さも各位置も）。**`toDrawOrder(rowIds)`**：行の並び（上が前面）を描画順（先頭が最も奥）へ変える。逆順の新しい配列。
    *   **`resolveAutoScrollTop({ pointerX, pointerY, area, elapsedMs })`** → `number|null`：動かさないなら`null`。左右へ外れている・`height`が正でない・`maxScrollTop`が正でないなら`null`。上端・下端の帯（24px。`height / 2`を超えない）に入った深さの割合（帯の外へ外れていれば1）に応じて90〜900px/秒、経過時間は50msまでとして量を求め、`0`〜`maxScrollTop`に収め、今の`scrollTop`と同じなら`null`。帯の境目ちょうど（`y === top + band`）は帯の外。
    *   **読むもの**：渡された配列・数値・`area`だけ。importなし。
    *   **知らないこと**：DOM・`VectorModel`・図形・操作モード・履歴・`requestAnimationFrame`。状態を持たない。引数を書き換えない。
    *   **使う側**：`wiring/ItemListRowDrag`だけ（`main.js`・`ItemListWiring`は直接使わない）。`ShapeOrderEditor.applyOrder`（`edit/`）は`core/`の規則をimportしないため`isSameOrder`を使わず、同じ判定を自分で書く。
    *   **置き場所の理由**：行のドラッグの判定・計算を`wiring/`（判定を持たない）にも`palette/`（何もimportしない）にも置けず、`node --test`で確かめるため、状態を持たない関数として`core/`に置いた。行の操作の判定（ドラッグを始めてよいか等）は操作モードを知る`ItemListRules`に置き、ここには操作モードを知らない計算だけを置く。
    *   **テスト**：`test/core/ListDragRules.test.js`（32件。`_doc/arch/16_test.md`）。
