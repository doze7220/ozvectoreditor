# RES: 作業計画・作業レポート (Interrupt) : 使われないハンドルの処理の整理と、頂点がつかめない不具合の修正
* 参照元REQ: `./_log/req/261123_1207_REQ_Interrupt_Handle_Dead_Branches.md`

## 1. 作業目的
頂点の選択（`A`）で、手前の図形の頂点でないハンドル（円・弧の中心と上下左右、直線の中点）が奥の図形の頂点を隠してつかめなくする不具合を直す。あわせて、選択（`V`）で図形ごとのハンドルを出さなくなった（Phase 08-02a）後に残っている、どこからも使われない処理（`drawHandles`・`showHandles`・選択モードのハンドルの枝・円と弧のハンドルの式・直線の`move`）を、使われていないことを確かめたうえで消し、誤ったJSDocを実態に合わせる。不具合のほかに画面のふるまいは変えない。作業前は tests 2467 / suites 400（計画時に`node --test`で全件合格を確認）。

## 2. アーキテクチャ設計
### 要件1: 頂点でないハンドルがほかの図形の頂点を隠さないようにする
*   **原因（計画時に実コードで再現済み）**：`PointHitRules.findHandleHit`が、手前から最初に非`null`となった`hitTestHandle`の結果で打ち切る。その後で`InputTracker.#classifyPoint`が`isVertexHandle`で除くため、奥の頂点を調べる機会がない。手前が円・弧（回していない・回したの両方）の5か所、直線の中点で、手前の頂点でないハンドルが返ることを確かめた。矩形・今の曲線・パスの`hitTestHandle`は頂点の名前だけを返す。
*   **直し方**：`PointHitRules.js`が`VertexHandleRules.js`の`isVertexHandle`をimportし、`findHandleHit`の中で「`hitTestHandle`が名前を返し、かつ`isVertexHandle(shape, 名前)`が真」のときだけ当たりにする。偽なら打ち切らず次（奥）の図形へ進む。`classifyPointHit`の引数・戻り値の形は変えない。
*   **`InputTracker.#classifyPoint`**：後からの絞り込み（`isVertexMode && hit.handle`の枝）を消し、`classifyPointHit(…)`の結果をそのまま返す。`isVertexHandle`のimportも消す（`collectVertexHandlesInRect`のimportは残す）。ホバー・押下・クリック・カーソルは今までどおりこの1つの結果を使う。
*   **優先順位は不変**：頂点どうしは手前の図形が優先、同じ図形では先着。同じ図形の中で頂点が隠れることはない（`Line.hitTestHandle`は`start`・`end`を`move`より先に調べる）。
*   **依存**：`PointHitRules → VertexHandleRules → InputModes`の一方向（`VertexHandleRules`は`PointHitRules`をimportしない）。循環なし。判定の定義は`isVertexHandle`（＝図形の`getVertexHandleNames()`）の1か所のまま。
*   要件2(4)の後は5クラスの`hitTestHandle`が頂点の名前しか返さなくなるが、`findHandleHit`の絞り込みは残す。「`A`で当たるのは頂点だけ」を保証する規則の側の唯一の箇所であり、図形クラスの実装に頼らないため（偽の図形を使うテストで固定する）。`isVertexHandle`の本番の使い手もここになる。

### 要件2: 使われない処理を消す（到達できないことの根拠）
前提となる共通の事実（計画時に`js/`全体のGrepで確認）：
*   **(ア)** `classifyPointHit`の呼び出しは`InputTracker.#classifyPoint`の1か所だけで、`includeHandles`に`currentMode === OperationMode.VERTEX`を渡す。よって**選択（`V`）では`hit.handle`は常に`null`**。`#classifyPoint`の呼び出しは`handleMouseMove`の1か所・`handleMouseDown`の2か所（`VERTEX`・`SELECT`）・`handleClick`の2か所（`SELECT`・`VERTEX`）で、いずれも同じ呼び出しの中でモードは変わらない。
*   **(イ)** `hitTestHandle`の呼び出しは`PointHitRules.findHandleHit`だけ。
*   **(ウ)** 頂点の選択（`VectorModel`の`#selectedVertices`）とドラッグの`target`へ入るハンドル名の出どころは、①`VERTEX`の`hit.handle`（`isVertexHandle`を通ったもの。`setSelectedVertices`・`resolveVertexClickSelection`・`#beginLeftDrag`）、②`collectVertexHandlesInRect`（`getVertexHandleNames()`の名前）、③`PathCornerEditor.#remapSelectedVertices`（置き換えた図形の`getVertexHandleNames()`の名前、または元の選択のまま）の3つだけ。5クラスの`getVertexHandleNames()`に`'move'`・`'right'`・`'up'`・`'left'`・`'down'`は無いので、**これらの名前は本番では生まれない**。取り消し等で同じidの図形の種別が変わって古い名前（`'vertex-0'`・`'start'`等）が弧に渡ることはあり得るが、弧は今もその名前に`null`を返しており、変わらない。履歴・作業データは頂点の選択を持たない。

| 対象 | 呼び出し元・渡される値 | 判断 |
| --- | --- | --- |
| (1) `CanvasManager.render`の`showHandles`と`drawHandles`の段 | `render`の呼び出しは`main.js`の`renderCurrentState`の1か所（`CanvasManager`の生成も`main.js`だけ）で、常に`showHandles: false`。 | 消す |
| (1)に伴う`render`の`selectedIds` | `render`の中で`selectedIds`を読むのは消す段（`selectedSet`）だけ。消した後は誰も読まない。 | 引数・JSDoc・`main.js`の`selectedIds: model.getSelectedIds()`を消す（`collectVertexHandles(…)`へ渡す`model.getSelectedIds()`は残す） |
| (2) 5クラスの`drawHandles` | 本番の呼び出しは(1)の段だけ。テストは`test/shapes/Path.test.js`の1件（`drawHandles`そのもの）。頂点のハンドルは`CanvasManager.#drawVertexHandles`、外枠のハンドルは`#drawScaleFrame`が別に描く。 | 消す。契約は19→18 |
| (3) `resolvePressAction`の`hit.handle`の枝（`move`・`dragHandle`）・`MOVE_HANDLE_NAME` | 呼び出しは`handleMouseDown`の`SELECT`の枝だけ。(ア)より`hit.handle`は常に`null`。`MOVE_HANDLE_NAME`はこの枝だけが使う。 | 消す（typedef`PressAction`の`dragHandle`も） |
| (3) `InputTracker.handleMouseDown`の`action.type === 'dragHandle'`の枝 | 上の枝だけが`dragHandle`を返す。`DRAGGING_HANDLE`は`VERTEX`の枝が使うため状態は残す。 | 枝だけ消す |
| (3) `InputTracker.handleClick`の`SELECT`の`if (hit.handle) return;` | (ア)より常に偽。`VERTEX`の`if (hit.handle)`は使われているので残す。 | 消す |
| (3) `CursorShapeRules`の(7) | `resolveCursorShape`の呼び出しは`#updateCursor`だけ。引数`hit`を渡すのは`handleMouseMove`（当たり分類と同じ呼び出しの中）だけで、ほかの`#updateCursor()`は`null`。(7)へ来るのは`SELECT`だけで、(ア)より`hit.handle`は`null`。 | 消す（(2a)の`hit.handle`は使われているので残す） |
| (4) `Line`の`'move'`（`hitTestHandle`・`getHandlePosition`） | (イ)より`hitTestHandle`の`'move'`は要件1の絞り込みで必ず捨てられる。`getHandlePosition`の呼び出し元は`collectVertexHandles`・`collectVertexHandlesInRect`（`getVertexHandleNames()`の名前）・`computeVertexHandlesBounds`・`#beginLeftDrag`・`NudgeEditor`（(ウ)の名前）だけで`'move'`は渡らない。`getVertexIndexForHandle('move')`は今も`null`。作成中の図形・吸い付き・結合は`move`を使わない。 | 消す：`hitTestHandle`は`'start'`・`'end'`・`null`、`getHandlePosition('move')`は`null` |
| (4) `Ellipse.hitTestHandle` | (イ)。5つの名前はすべて要件1の絞り込みで捨てられる。 | 式を消す：**常に`null`（当たらない）** |
| (4) `Ellipse.getHandlePosition` | 呼び出し元は`Line`の行と同じ。(ウ)より5つの名前は渡らず、渡り得る名前（古い`'vertex-<i>'`等）には今も`null`。`getVertexHandleNames()`が空なので表示・範囲選択でも呼ばれない。 | 式を消す：**常に`null`（位置なし）** |
| (4) `Ellipse.getVertexIndexForHandle` | 呼び出し元は`#beginLeftDrag`・`NudgeEditor`・`PathCornerEditor`（(ウ)の名前）と`EndpointSnapRules.resolveEndpointHandle`（弧は番号が何でも`endpointVertexIndexOf`が`null`のため結果は`null`で同じ）。テストは弧のどの名前でも`resolveEndpointHandle`の`null`を期待しており合う。 | 対応表を消す：**常に`null`（番号なし）** |
| (4) `Ellipse.setVertex` | 本番は`VectorModel.updateVertices`（種別を分けず呼ぶ契約のメソッド）だけで、円・弧の番号を渡す経路は無い。しかし**既存のテストが図形の組み立てに使っている**（`test/shapes/Ellipse.test.js`の「頂点を動かした後」2件と「自身は変わらず、戻り値と頂点を共有しない」、`test/io/DocumentSerializer.roundtrip.test.js`の「楕円にした」「中心を動かした」と`arc.setVertex(1, 120, 0)`、`test/io/CodeExporter.test.js`の`circle.setVertex`・`arc.setVertex`）。 | **残す**（式は変えない）。JSDocを正しい説明にする。`#updatePointsFromRadii`は`updateDraftEnd`（作成中の図形）も使うため残す |

*   **`DRAGGING_HANDLE`・`NudgeEditor`・`PathCornerEditor`・端点の吸い付き・結合・作成中の図形**は、上の表のとおり消す値を使っていない。結合・吸い付きの弧の端点は`PathJoinRules.lineEndpointOf`が中心と半径（図形データ）から求めており、ハンドルの式を使わない。
*   **消さずに残す周辺**：`CursorShapeRules`の(4)の`DRAGGING_HANDLE`（選択モードで`DRAGGING_HANDLE`になる経路はもう無いが、REQ要件2の範囲に無く、既存テストが`'move'`を期待しているため触らない）、`VectorModel.updateVertex`、`InputState.DRAGGING_HANDLE`、`includeHandles`、`hitTestHandle`・`getHandlePosition`・`getVertexHandleNames`・`getVertexIndexForHandle`の契約そのもの、`VertexHandleRules`の全関数。
*   **契約の数**：19→18。クラスJSDocの一覧から`drawHandles`を消して「18メソッド」にする。JSDocの「共通メソッド契約の第Nメソッド」はこの一覧の並びの番号なので、`drawHandles`（2番目）が抜けた分だけ第10〜第19を1つずつ繰り上げる（`intersectsRect`第10→第9、`toJSON`第11→第10、`fromJSON`第12→第11、`toDrawElement`第13→第12、`isFillable`第14→第13、`hitTestFill`第15→第14、`drawOutline`第16→第15、`getHandlePosition`第17→第16、`getVertexHandleNames`第18→第17、`createTransformed`第19→第18）。
*   **ハンドル名の契約（作業後）**：`hitTestHandle`が返すのは`getVertexHandleNames()`の名前か`null`だけ。その名前は`getVertexIndexForHandle`で番号に、`getHandlePosition`で位置に解決できる。移動ハンドル`'move'`は無い。頂点を持たない図形（円・弧）は、当たらない（`null`）・位置なし（`null`）・番号なし（`null`）・一覧は空。

### 要件3: JSDoc・コメントの誤り
*   `Ellipse`の「到達不能の枝のため式は変えない」の注意（`hitTestHandle`・`getHandlePosition`・`getVertexIndexForHandle`・`setVertex`。`drawHandles`は関数ごと消える）と、`fromJSON`の「`right`/`up`/`left`/`down`のハンドル操作で正準位置へ再計算され、`move`では平行移動されるだけ」を直す。
*   ハンドルが無くなったことで誤りになる説明：`EndpointSnapRules.resolveEndpointHandle`（「番号のないハンドル（直線の`'move'`など）」「弧のハンドルは半径の編集のハンドル」）、`PathJoinRules.endpointVertexIndexOf`（「弧のハンドル（`'left'`…）は半径の編集のハンドル」）、`InputModes`（「moveハンドル」、`SELECT`の「ハンドルドラッグ」）、`InputTracker`（moveハンドル・移動用ハンドル・図形ごとのハンドル・`isVertexHandle`での絞り込み）、`PressActionRules`・`CursorShapeRules`・`PointHitRules`・`CanvasManager`・`main.js`。

### 要件4: テスト
**追加**（`test/core/PointHitRules.test.js`。新しい`describe`「classifyPointHit: 頂点でないハンドル」。9件の見込み）：①手前が円・奥がパス（中心・右・上・左・下の5か所で奥の頂点が当たる）②手前が弧・奥が線（同じ5か所）③手前が回した円・奥が線（回した後の図形の`points`から、直す前の`hitTestHandle`と同じ式で求めた5か所。位置はテストの中で数式として求め、図形のハンドルのメソッドを呼ばない）④手前が回した弧・奥がパス ⑤手前が直線の中点・奥がパス ⑥手前が直線の中点・奥が線 ⑦円の中心で奥に頂点が無いとき`handle`は`null`で`bodyId`は`includeHandles`が偽のときと同じ ⑧頂点どうしの重なりは手前の図形が優先（手前が線の`end`・奥がパス）⑨`hitTestHandle`が頂点でない名前を返す偽の図形（`getVertexHandleNames()`に無い名前）が手前でも奥の頂点が当たる。⑧以外は直す前に失敗し、直した後に通る。既存の`includeHandles`・`isVertexHandle`のテストは残す。

**変える既存のテスト（これ以外は変えない）**：

| ファイル・ケース | 変え方 | REQの区分 |
| --- | --- | --- |
| `test/core/PressActionRules.test.js`：`describe('resolvePressAction：ハンドルあり')`の5件 | `describe`ごと削除 | (a) |
| 同：「nullと省略は従来と同じ結果（本体・空白・ハンドル・isSelectedの呼び出し）」 | ハンドルの4行（`const handle`〜`result.target`）を削除し、ケース名から「・ハンドル」を除く | (b) |
| `test/core/CursorShapeRules.test.js`：「ハンドル上はmove（本体が選択外でも）」（選択モード） | 削除 | (a) |
| 同：「isSelectedはハンドル上・本体なし・hitがnull・ドラッグ状態では呼ばない」 | `hit.handle`ありの1行を削除し、ケース名から「ハンドル上・」を除く | (b) |
| `test/shapes/Line.test.js`：「'start'・'end'・'move'（中点）の位置を返す」 | `'move'`の期待値を`null`にし、ケース名を合わせる | (b) |
| 同：「返したオブジェクトを書き換えても図形は変わらず、呼ぶたびに新しいオブジェクト」「返した位置をhitTestHandleへ渡すとそのハンドル名が返る」（`Line.getHandlePosition`の2件） | 名前の並びから`'move'`を除く | (b) |
| `test/shapes/Ellipse.test.js`：「円・弧それぞれで5つのハンドルの位置（左端・下端は計算上の位置）」 | 5つの名前すべてで`null`を期待する形にし、ケース名を合わせる | (b) |
| 同：「返したオブジェクトを書き換えても図形は変わらず、毎回新しいオブジェクト」「返した位置をhitTestHandleへ渡すとそのハンドル名が返る（円・弧）」（`Ellipse.getHandlePosition`の2件） | 削除 | (a) |
| `test/core/VertexHandleRules.test.js`：「円・弧は getVertexHandleNames が空でも、渡されたハンドル名の位置が求まる」 | `computeVertexHandlesBounds(shapes, [{ shapeId: 'e', handle: 'right' }])`が`null`になる期待へ変え、ケース名を合わせる（`const pos`の行は不要になるため除く） | (b) |
| `test/shapes/Path.test.js`：「drawHandles: 全頂点に一辺8 / viewScaleの正方形を頂点中心に描く」 | 削除 | (a) |

*   追加（消した後のふるまいの固定）：`Line.test.js`に「中点では`hitTestHandle`が`null`」1件、`Ellipse.test.js`に「`hitTestHandle`は5か所（円・弧・回した円）で`null`」「`getVertexIndexForHandle`は5つの名前で`null`」の2件（`describe`を1つ足す）。
*   変えなくても通るため変えないもの：`hit.handle`を入れた選択モードのケースのうち外枠のハンドル・回転・待ち受け・パン・範囲選択の優先を確かめるもの、`NudgeEditor.test.js`・`PathCornerEditor.test.js`・`EndpointSnapper.test.js`・`EndpointSnapRules.test.js`・`VertexHandleRules.test.js`の`isVertexHandle`の`'move'`等のケース。
*   件数の見込み：タスク1後 2476 / 401、タスク2後 同じ、タスク3後 2470 / 400、タスク4後 2471 / 401、タスク5後 2470 / 401。

### 要件5: ふるまいの確認
タスク6で、実コードのふるまい（当たり分類・規則・`InputTracker`の分岐）と突き合わせて「5.」末尾の確認項目を確定する。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`（当たり分類・押下・カーソルの規則、描画、入力）、`./js/shapes/`（図形クラス）、`./js/main.js`（配線）、`./test/core/`・`./test/shapes/`
*   **関連する論理クラス**: `PointHitRules`・`VertexHandleRules`（変更なし）・`PressActionRules`・`CursorShapeRules`・`InputModes`（コメントのみ）・`InputTracker`・`CanvasManager`・`Line`・`Curve`・`Rect`・`Ellipse`・`Path`・`EndpointSnapRules`（JSDocのみ）・`PathJoinRules`（JSDocのみ）。新しいファイルは作らない。

### 参照する責務
*   **`PointHitRules`**：ある点が選択集合の図形のハンドル・図形の本体・空白のどれに当たるかを、図形の公開メソッドと選択中かの照会だけで判定する状態を持たない規則。操作モード・図形種別・`VectorModel`を知らない。`handle`と`bodyId`は独立に求める。使う側は`InputTracker.#classifyPoint`のみ。
*   **`VertexHandleRules`**：頂点のハンドルの一覧・ハンドル名が頂点のハンドルかの判定（`isVertexHandle`）・矩形に入る頂点の収集・頂点の範囲。`getVertexHandleNames`・`getHandlePosition`と`id`だけを読む。importは`InputModes`のみ。
*   **`PressActionRules`**：押下の当たり分類から始める操作を決める判定表。importなし・引数を書き換えない。選択モードの順は 外枠のハンドル → 回転の範囲 → 本体が選択集合内 → 空白 → それ以外は`null`。`isSelected`は本体の判定のときだけ呼ぶ。
*   **`CursorShapeRules`**：操作モード・入力状態・当たり分類からCSSの`cursor`を決める判定表。`isPickingShape`・`isSelected`は関数で受け、呼ぶ回数を変えない。
*   **`InputTracker`**：入力の解釈。図形種別・図形固有のプロパティ・`vertexIndex`規約を持たず、当たりの規則・判定表は規則のファイルに置く。1つの当たり分類の結果をホバー・押下・クリック・カーソルで共用する。
*   **`CanvasManager`**：引数だけから描く純粋な描画。図形データ・選択状態・操作モードを持たない。頂点のハンドルは`vertexHandles`、外枠のハンドルは`scaleFrame`を受け取って描く。
*   **図形クラス（`shapes/`）**：共通メソッド契約を自律実装する。どのハンドルが頂点かは`getVertexHandleNames()`だけが決める。`toDrawElement`・`draw`の式は変えない（`CodeExporter`の`DRAW_SOURCE`と揃えている）。
*   **`main.js`**：生成・注入・配線だけ。判定・計算を持たない。
*   **行末**（計画時にバイト数で実測。編集で保つこと）：CRLF＝`InputTracker.js`・`CursorShapeRules.js`・`InputModes.js`・`main.js`・`Ellipse.js`・`Path.js`・`EndpointSnapRules.js`・`PathJoinRules.js`・`PointHitRules.test.js`・`VertexHandleRules.test.js`・`Line.test.js`・`Path.test.js`。LF＝`CanvasManager.js`・`PointHitRules.js`・`PressActionRules.js`・`Line.js`・`Curve.js`・`Rect.js`・`CursorShapeRules.test.js`・本RES。混在＝`PressActionRules.test.js`（CRLF 262・LF 50）・`Ellipse.test.js`（CRLF 1154・LF 59）。混在のファイルは触らない行の行末を変えない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
反映は最終タスクのみ。行番号は計画時のもの。
*   `PROJECT_ARCHITECTURE.md`（CRLF）
    *   1章（フォルダ構造・`core/`の説明・依存方向）：`PointHitRules`が`VertexHandleRules`をimportするようになったこと。218行「存在しないもの」の、moveハンドル・弧の半径のハンドルに触れた箇所（どちらも無い）。
    *   2章：235行（契約の数の変遷に「本作業で`drawHandles`を消して18」を足し、`createTransformed`を第18メソッドに）、237行（`Ellipse`の到達不能の枝・ハンドルに触れた箇所）、246行（`drawHandles`に触れた箇所）。
    *   3章3.：363行（絞り込みは`PointHitRules`の中で行い、頂点でないハンドルは奥の頂点を隠さない）、366行付近（クリックの解釈「ハンドルの上は何もしない」）、367・369・385行（moveハンドル）。
    *   3章12.：498・507行（弧のハンドル・moveハンドル）。3章15.：539行（`drawHandles`・ハンドルに触れた箇所の確認）。3章17.：574・577・584・585行（第17メソッド→第16メソッド、`'move'`・円と弧のハンドルの位置、moveハンドル）。
    *   3章18.：600・601・608〜611・614・616行（`showHandles`・`includeHandles`・`drawHandles`が呼ばれなくなること＝消した・去就は決着・絞り込みの場所）。3章19.：627行（線の中点`'move'`）。3章24.：720行（第19メソッド→第18メソッド）。3章25.：726・727・735行。3章26.：740・751の(i)・752行。
*   `_doc/arch/`
    *   `02_main.md`（CRLF）：3行目の行数、74行目（`showHandles`・`selectedIds`）。
    *   `04_CanvasManager.md`（CRLF）：2行目（`render`の引数から`selectedIds`・`showHandles`を除く）、4行目（描画順から`drawHandles`の段を除く）。
    *   `06_InputTracker.md`（CRLF）：13〜16・29・31・43・46行（`dragHandle`・`move`ハンドル・`#classifyPoint`の絞り込み・importの`isVertexHandle`）、57行目の行数。
    *   `10_ShapeFactory.md`（LF）：9行目（19メソッド契約→18）。
    *   `12_shapes.md`（CRLF）：35・36行（契約の数と一覧）、40〜44行（第Nメソッドの繰り上げ）、47行（クラスJSDoc）、49〜51行（ハンドル名の契約）、54行（`viewScale`の`drawHandles`）、8・67〜69・73・76・78・79・82・84行（`Line`・`Ellipse`・`Path`・`PathJoinRules`等の`move`・弧のハンドル・到達不能の枝）。
    *   `16_test.md`（CRLF）：本作業の追加・削除・書き換えと件数の項を足す。過去の作業の項の件数は書き換えない。19行（`PointHitRules.test.js`の説明）、81・226行付近の「テストできない箇所」の`#classifyPoint`の絞り込みの説明は、絞り込みが`PointHitRules`で確かめられるようになったことを反映する。
    *   `18_PointHitRules.md`（LF）：2〜8行（importが`VertexHandleRules`の`isVertexHandle`になる・規則(1)・使う側・注意）。
    *   `34_PressActionRules.md`（LF）：2・7〜10・15・24・26・29・30行（`dragHandle`・`MOVE_HANDLE_NAME`・順1と順2の行・テストの件数）。
    *   `35_CursorShapeRules.md`（LF）：3行目（(7)を欠番にする）・テストの件数。
    *   `38_VertexHandleRules.md`（LF）：4・6〜8・11・12行（`isVertexHandle`の使う側が`PointHitRules`になる・円のハンドル名は位置が求まらない）。
    *   `42_ScaleHandleRules.md`（LF）：10行目（到達不能の枝）。`32_InputModes.md`（LF）：`SELECT`・`MOVING_SELECTION`の説明に「moveハンドル・ハンドルドラッグ」があれば。`27_SelectionRules.md`・`41_NudgeTargetRules.md`：`hit.handle`・`'move'`に触れた記述の確認。

## 3. タスクリスト
*   [x] タスク1: 当たり分類で頂点のハンドルだけを当たりにする（要件1・要件4）
    *   **対象ファイル** :
        *   `./test/core/PointHitRules.test.js` :（更新。追加のみ）
        *   `./js/core/PointHitRules.js` :（更新）
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   先に要件4の①〜⑨をテストへ追加し、`node --test test/core/PointHitRules.test.js`で⑧以外が失敗することを確かめて「4.」に記録する（回した図形は`createTransformed`で作る。補助関数にJSDocを書く。先頭の責務定義に頂点でないハンドルの扱いを足す）。
        *   `PointHitRules.js`：`import { isVertexHandle } from './VertexHandleRules.js';`を足し、`findHandleHit`の条件を`handleName && isVertexHandle(shape, handleName)`にする（偽なら次の図形へ）。`findHandleHit`・`classifyPointHit`・typedef`PointHit`・先頭の責務定義（3行以内）のJSDocを「頂点として扱えるハンドルだけ。頂点でないハンドルは奥の頂点を隠さない」に直し、使う図形のメンバーに`getVertexHandleNames`を足す。`CanvasManager`がハンドルを図形配列の順に描く旨の説明は`vertexHandles`の描画に合う表現にする。
        *   `InputTracker.js`：`#classifyPoint`の後からの絞り込みを消して結果をそのまま返す。import行から`isVertexHandle`を除く。クラスJSDoc（223〜225行付近）・`#classifyPoint`のJSDoc（1936〜1940行付近）を合わせる。ほかのメソッドは触らない。
        *   `node --test`全件合格。JSDocの記載漏れの確認。「4.」の記入と、開発資料の更新予定欄への追記（影響が判明した場合。資料本体は修正しない）。
*   [x] タスク2: `showHandles`・`selectedIds`と`drawHandles`を呼ぶ段を消す（要件2(1)）
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   着手時に`render(`・`showHandles`・`selectedIds`の参照をGrepし直し、「2.」の根拠と同じことを確かめる。
        *   `CanvasManager.render`：引数`selectedIds`・`showHandles`と「5.」の段（`selectedSet`を含む）を消す。JSDocの描画順(2)・`@param shapes`の`drawHandles`・`@param state.selectedIds`・`@param state.showHandles`・渡された引数の列挙の`selectedIds`を消し、頂点のハンドルの説明（「`drawHandles`と同じ位置」）を「全図形の描画後・作成中の図形の前」だけにする。まとめて描く理由（前面の図形が覆い隠さないため）は頂点のハンドルの説明として残す。ほかのコメントの番号は、抜けた番号に合わせる範囲だけ直してよい。描く順・ほかの段は変えない。
        *   `main.js`：`selectedIds: model.getSelectedIds(),`・`showHandles: false,`とその説明のコメント2行を消し、`renderCurrentState`のJSDocの`drawHandles`・`showHandles`・（渡す状態としての）`selectedIds`の記述を直す。
        *   `node --test`全件合格。JSDocの記載漏れの確認。「4.」の記入と、開発資料の更新予定欄への追記（影響が判明した場合。資料本体は修正しない）。
*   [x] タスク3: 選択（`V`）のハンドルの枝を消す（要件2(3)）
    *   **対象ファイル** :
        *   `./js/core/PressActionRules.js` :（更新）
        *   `./js/core/CursorShapeRules.js` :（更新）
        *   `./js/core/InputTracker.js` :（更新）
        *   `./js/core/InputModes.js` :（更新。コメントのみ）
        *   `./test/core/PressActionRules.test.js` :（更新）
        *   `./test/core/CursorShapeRules.test.js` :（更新）
    *   **作業内容** :
        *   着手時に`resolvePressAction(`・`resolveCursorShape(`・`classifyPointHit(`の呼び出し元をGrepし直し、「2.」の根拠と同じことを確かめる。
        *   `PressActionRules.js`：`MOVE_HANDLE_NAME`と`if (hit.handle) {…}`の枝、typedef`PressAction`の`dragHandle`を消す。JSDocの判定表からハンドルの2行を消し、「図形ごとのハンドルより優先」「ハンドルがあるとき」を除き、`hit.handle`は読まない（選択モードでは常に`null`）と書く。`resolveVertexPressAction`のコードは変えず、JSDocの「'move'ハンドルの除外はここでは行わない（…呼び出し側の責務）」を「頂点のハンドルだけに絞り込むのは`PointHitRules`」に直す。
        *   `CursorShapeRules.js`：`SELECT`の`if (hit.handle) return 'move';`（(7)）だけを消す。JSDocは(7)を「欠番（図形ごとのハンドルの枝は消した）」とし、(8)〜(10)の番号・(2a)・(4)は変えない。
        *   `InputTracker.js`：`handleMouseDown`の`dragHandle`の枝、`handleClick`の`SELECT`の`if (hit.handle) { return; }`を消す。次のコメントを実態に合わせる：移動用ハンドル・moveハンドル（197・240・473〜476・528・728・988・1424・1483行付近）、図形ごとのハンドル・「本体・ハンドルより優先」（982・984行付近）、クリックの「ハンドルの判定より前」「選択集合の図形のハンドル上なら何もしない」（1089〜1093行付近）と「ハンドル上で離した場合は選択集合を維持し」（1118行付近。外枠のハンドルのことに直す）。
        *   `InputModes.js`：`MOVING_SELECTION`の「moveハンドル・」と、`SELECT`の「ハンドルドラッグ」（→外枠のハンドルでの拡大縮小・外枠の角の外側での回転）のコメントだけを直す。
        *   テストは「2.」の表のとおり（`PressActionRules.test.js`は行末が混在しているため、触らない行の行末を変えない）。
        *   `node --test`全件合格。JSDocの記載漏れの確認。「4.」の記入と、開発資料の更新予定欄への追記（影響が判明した場合。資料本体は修正しない）。
*   [ ] タスク4: 直線の`move`と、円・弧の図形ごとのハンドルの式を消す（要件2(4)・要件3）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` :（更新）
        *   `./js/shapes/Ellipse.js` :（更新）
        *   `./js/shapes/EndpointSnapRules.js` :（更新。JSDocのみ）
        *   `./js/shapes/PathJoinRules.js` :（更新。JSDocのみ）
        *   `./test/shapes/Line.test.js` :（更新）
        *   `./test/shapes/Ellipse.test.js` :（更新）
        *   `./test/core/VertexHandleRules.test.js` :（更新）
    *   **作業内容** :
        *   着手時に`hitTestHandle(`・`getHandlePosition(`・`getVertexIndexForHandle(`・`setVertex(`・`setSelectedVertices(`の呼び出し元をGrepし直し、「2.」の(イ)(ウ)と表が成り立つことを確かめる。
        *   `Line.js`：`hitTestHandle`の中点の判定と`getHandlePosition`の`'move'`を消し、JSDoc（`@returns`・優先順位・`getVertexHandleNames`の`'move'`の説明）を直す。
        *   `Ellipse.js`：`hitTestHandle`・`getHandlePosition`・`getVertexIndexForHandle`の本体を`return null;`だけにする（引数は契約の形を揃えるため残し、使わないとJSDocに書く。書き方は`Line.hitTestFill`の例に倣う）。JSDocは「円・弧は頂点のハンドルを持たないため常に`null`」とし、「到達不能の枝」の注意・ダミーハンドルの説明を消す。`getVertexHandleNames`のJSDocを合わせる。`setVertex`はコードを変えず、JSDocを「円・弧は頂点のハンドルを持たないため画面の操作からは番号が渡らない。`VectorModel.updateVertices`が種別を分けず呼ぶ契約のメソッドで、テストの図形の組み立てが使うため残す。今の約束の位置を前提にした式で、回した・裏返した円・弧では正しくない」に直し、本体の中の「ハンドルの移動」というコメントも頂点の番号の説明に直す。`#updatePointsFromRadii`・`#readGeometry`ほかは変えない。`fromJSON`のJSDocの、ハンドル操作で正準位置へ再計算される旨を直す（形は`points[0..2]`だけから読み、`[3]`・`[4]`は変形・平行移動で一緒に写るだけ）。
        *   `EndpointSnapRules.js`・`PathJoinRules.js`：弧のハンドル・直線の`'move'`のJSDocを、弧は頂点のハンドルを持たない／番号の得られないハンドル名は`null`、という説明に直す（コードは変えない）。
        *   テストは「2.」の表と「追加」のとおり（`Ellipse.test.js`は行末が混在）。
        *   `node --test`全件合格。JSDocの記載漏れの確認。「4.」の記入と、開発資料の更新予定欄への追記（影響が判明した場合。資料本体は修正しない）。
*   [ ] タスク5: 各図形クラスの`drawHandles`を消し、共通メソッド契約を18にする（要件2(2)）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js`・`./js/shapes/Curve.js`・`./js/shapes/Rect.js`・`./js/shapes/Ellipse.js`・`./js/shapes/Path.js` :（更新）
        *   `./test/shapes/Path.test.js` :（更新）
    *   **作業内容** :
        *   着手時に`drawHandles`の参照をGrepし直し、残りが図形クラスの定義・JSDocと`Path.test.js`の1件だけであることを確かめる。
        *   5クラスの`drawHandles`をJSDocごと消す。クラスJSDocの契約を「18メソッド」にして一覧から`drawHandles`を除く。`第N`メソッドを「2.」のとおり1つずつ繰り上げる（第10→第9から昇順に置き換えると二重に繰り上がらない。関係のない語は変えない）。`getHandlePosition`等のJSDocの「`hitTestHandle`・`drawHandles`と同じ」、`Path`のクラスJSDocの`drawHandles`を直す。
        *   `test/shapes/Path.test.js`の`drawHandles`の1件を削除する。
        *   `node --test`全件合格。`js/`のGrepで`drawHandles`・`showHandles`・`dragHandle`・`MOVE_HANDLE_NAME`・`19メソッド`・「moveハンドル」・「到達不能」が0件、`test/`のGrepで`drawHandles`・`dragHandle`が0件であることを確かめる。JSDocの記載漏れの確認。「4.」の記入と、開発資料の更新予定欄への追記（影響が判明した場合。資料本体は修正しない）。
*   [ ] タスク6: テストプレイの確認項目の裏取りと、JSDocの総点検（要件5）
    *   **対象ファイル** :
        *   `./_log/res/261123_1213_RES_Interrupt_Handle_Dead_Branches.md` :（更新。ソース・テストは変更しない。JSDocの漏れ・誤りが見つかった場合は、タスク1〜5の対象ファイルのJSDocに限り直してよい）
    *   **作業内容** :
        *   「5.」の確認項目を、実コードで裏取りして確定する。当たり分類・押下・カーソルの規則と図形のメソッドは、リポジトリの外（OSの一時フォルダ）に置いた使い捨てのスクリプトから呼んで値を確かめ、`InputTracker`・`main.js`の配線はコードを読んで確かめる（実施した内容と結果を「4.」に書く。スクリプトは作業後に消す）。特に、確認項目1・2の「隠れていた点」が作業前は当たらず作業後に当たること、円を回したときの5か所の位置（中心と、中心から、回した後の右端の制御点との横の差・上端の制御点との縦の差だけ離れた位置）を確かめ、操作の言葉で正しく書く。
        *   選択（`V`）の押下・カーソルが、`hit.handle`が`null`の入力に対して作業前後で同じであることを、作業前のソース（`git show 52b5980:<パス>`で一時フォルダへ取り出す。読み取りのみ）と`resolvePressAction`・`resolveCursorShape`の結果を総当たりで比べて確かめる。
        *   タスク1〜5で変えた全ファイルのJSDocの記載漏れと、先頭の責務定義が保たれていることを確かめる。
        *   「4.」の記入と、開発資料の更新予定欄への追記（影響が判明した場合。資料本体は修正しない）。
*   [ ] タスク7（固定タスク）: 『開発資料の更新予定』を確認し、開発資料へ反映する
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/`の`02_main.md`・`04_CanvasManager.md`・`06_InputTracker.md`・`10_ShapeFactory.md`・`12_shapes.md`・`16_test.md`・`18_PointHitRules.md`・`34_PressActionRules.md`・`35_CursorShapeRules.md`・`38_VertexHandleRules.md`・`42_ScaleHandleRules.md` :（更新）
        *   `./_doc/arch/`の`27_SelectionRules.md`・`32_InputModes.md`・`41_NudgeTargetRules.md` :（確認し、誤りになった記述があれば更新）
    *   **作業内容** :
        *   書き換える前に各ファイルの行末をバイト数（CRLF・LFの数）で実測し、書き換えた後も行末を保つ（計画時の実測：CRLF＝`PROJECT_ARCHITECTURE.md`・02・04・06・12・16、LF＝10・18・32・34・35・38・42。27・41は実測してから）。
        *   『開発資料の更新予定』を反映する。反映後に`drawHandles`・`showHandles`・`dragHandle`・`MOVE_HANDLE_NAME`・`19メソッド`・`第1[0-9]メソッド`・「到達不能」・「moveハンドル」・`isVertexHandle`・`'move'`をGrepし、残りが過去の経緯の記録（`16_test.md`の過去の作業の項、契約の数の変遷など）・作業後も正しい記述・カーソルの`'move'`だけであることを確かめる。今を説明する記述に古い内容を残さない。
        *   `16_test.md`には本作業の増減と最終の件数、`02_main.md`・`06_InputTracker.md`には行数の実測値を書く。本作業と関係しない資料の直し（「版4は未連絡」の古い記述など）はしない。
        *   `node --test`全件合格を確かめ、「4.」を記入して本RESを完成させる。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 当たり分類で頂点のハンドルだけを当たりにする（要件1・要件4）
*   **作業内容** :
    *   `test/core/PointHitRules.test.js`へ、新しい`describe`「classifyPointHit: 頂点でないハンドル」を追加（9件、補助関数3つ：`makePathStartingAt`・`fiveNonVertexPositions`・`rotationAround`、いずれもJSDoc付き。回した図形は`createTransformed`で作成）。修正前に`node --test test/core/PointHitRules.test.js`を実行し、8件失敗（⑧頂点どうしの重なりだけ通る）を確認。
    *   `PointHitRules.js`：`isVertexHandle`をimportし、`findHandleHit`の条件を`handleName && isVertexHandle(shape, handleName)`に変更。先頭の責務定義・`PointHit`・`findHandleHit`・`classifyPointHit`のJSDocを合わせた（使う図形のメンバーに`getVertexHandleNames`を追加）。
    *   `InputTracker.js`：`#classifyPoint`の後からの絞り込みを消し`classifyPointHit`の結果をそのまま返すようにした。importから`isVertexHandle`を除去。クラスJSDoc・`#classifyPoint`のJSDocを合わせた。
    *   `node --test`全件合格：tests 2476 / suites 401（見込みどおり）。行末は各ファイルの元のまま（InputTracker・テストはCRLF、PointHitRulesはLF）。

### タスク2: `showHandles`・`selectedIds`と`drawHandles`を呼ぶ段を消す（要件2(1)）
*   **作業内容** :
    *   着手時に`js/`の`.render(`・`showHandles`をGrepし直し、`CanvasManager.render`の呼び出しが`main.js`の`renderCurrentState`1か所だけ・常に`showHandles: false`であることを確認（`test/`に`showHandles`の参照なし）。
    *   `CanvasManager.render`：引数`selectedIds`・`showHandles`と`selectedSet`を含む段を消し、頂点のハンドルの段を5、外枠を5-2に繰り上げた。JSDoc（描画順・`@param shapes`・`state.selectedIds`・`state.showHandles`・引数の列挙）を合わせた。
    *   `main.js`：`selectedIds: model.getSelectedIds(),`・`showHandles: false,`とコメント2行を消し、`renderCurrentState`のJSDocを直した（`collectVertexHandles`へ渡す`model.getSelectedIds()`は残した）。
    *   `node --test`全件合格：tests 2476 / suites 401（見込みどおり）。行末は元のまま（CanvasManager＝LF、main.js＝CRLF）。

### タスク3: 選択（`V`）のハンドルの枝を消す（要件2(3)）
*   **作業内容** :
    *   着手時に`resolvePressAction(`・`resolveCursorShape(`・`classifyPointHit(`の呼び出し元を`js/`でGrepし直し、各1か所（`InputTracker`の`handleMouseDown`・`#updateCursor`・`#classifyPoint`）であることを確認。
    *   `PressActionRules.js`：`MOVE_HANDLE_NAME`・`if (hit.handle) {…}`の枝・typedef`PressAction`の`dragHandle`を消し、JSDocの判定表・`isSelected`を呼ぶ条件・`@returns`を合わせ、`hit.handle`は読まない旨を足した。`resolveVertexPressAction`のコードは変えず、JSDocの「'move'ハンドルの除外…」を「頂点のハンドルだけに絞り込むのは`PointHitRules`」に直した。
    *   `CursorShapeRules.js`：`SELECT`の`if (hit.handle) return 'move';`を消し、JSDocの(7)を欠番にした（(8)〜(10)・(2a)・(4)は変更なし）。
    *   `InputTracker.js`：`handleMouseDown`の`dragHandle`の枝、`handleClick`の`SELECT`の`if (hit.handle) { return; }`を消し、移動用ハンドル・moveハンドル・図形ごとのハンドルに触れたコメント、クリックのJSDoc（「選択集合の図形のハンドル上なら何もしない」を削除、「ハンドル上で離した場合」を外枠のハンドルに）を直した。
    *   `InputModes.js`：`MOVING_SELECTION`の「moveハンドル・」を除き、`SELECT`の「ハンドルドラッグ」を「外枠のハンドルでの拡大縮小・外枠の角の外側での回転」に直した（コメントのみ）。
    *   テスト：`PressActionRules.test.js`の`describe('resolvePressAction：ハンドルあり')`（5件）を削除、「nullと省略は…」のハンドルの4行を削除しケース名から「・ハンドル」を除いた。`CursorShapeRules.test.js`の「ハンドル上はmove（本体が選択外でも）」を削除、「isSelectedは…」の`hit.handle`ありの1行を削除しケース名から「ハンドル上・」を除いた。行末は元のまま（PressActionRules.js・CursorShapeRules.test.js＝LF、CursorShapeRules.js・InputTracker.js・InputModes.js＝CRLF、PressActionRules.test.jsは触らない行の行末を維持）。
    *   `node --test`全件合格：tests 2470 / suites 400（見込みどおり）。

### タスク4: 直線の`move`と、円・弧の図形ごとのハンドルの式を消す（要件2(4)・要件3）
*   **作業内容** :
    *   （未実施）

### タスク5: 各図形クラスの`drawHandles`を消し、共通メソッド契約を18にする（要件2(2)）
*   **作業内容** :
    *   （未実施）

### タスク6: テストプレイの確認項目の裏取りと、JSDocの総点検（要件5）
*   **作業内容** :
    *   （未実施）

### タスク7（固定タスク）: 『開発資料の更新予定』を確認し、開発資料へ反映する
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
* **`Ellipse.setVertex`は消さない**：本番では円・弧の頂点の番号が渡らないが、既存のテスト（往復・書き出し・当たり判定）が楕円・動かした円を組み立てる手段として使っており、REQの「少しでも使われていれば残す」に当たるため。
* **`Ellipse.getHandlePosition`の扱いの解釈**：`test/core/VertexHandleRules.test.js`の1件が「円のハンドル名を渡すと位置が求まる」ことを期待している。この期待は消す処理（円・弧のハンドルの位置）のふるまいそのものなので、「使っているから残す」ではなくREQの(b)（消したことで必然的に変わる期待値）として`null`の期待へ変える計画にした。REQ要件2(4)の例「円・弧は『当たらない』『位置なし』」に合わせている。
* **`CursorShapeRules`の(4)の`DRAGGING_HANDLE`**：選択モードで`DRAGGING_HANDLE`になる経路は無いが、REQ要件2の範囲に無いため残す（報告のみ）。
* **要件1の絞り込みと要件2(4)の重なり**：図形側から頂点でないハンドルを消すだけでも今の5種別の不具合は直るが、保証は規則側（`PointHitRules`）に置き、図形側の整理とは独立に成り立つようにした。
* 自動テストの対象外（目視で確かめる箇所）：`CanvasManager.render`の描画、`InputTracker`の配線、`main.js`の`renderCurrentState`。
* **テストプレイの確認項目（下書き。タスク6で裏取りして確定する。最初に`Ctrl`+`F5`で読み込み直す）**：
    1. 直線のツールで点を3つ以上打ってパスを描く。その後、円のツールで、円の中心がパスの点の上に来るように円を描く。`V`でパスと円を両方選び（`Ctrl`+クリックか範囲選択）、`A`に切り替えると、円の中心に重なったパスの点をドラッグで動かせる。円の右・上・左・下の端がパスの点に重なるように描いたときも同じ。弧でも同じ。円を`V`で外枠の角の外側から回した後も、中心などに重なった点がつかめる。点の上ではカーソルが移動の形になり、クリックするとその点が選ばれる（青くなる）。
    2. 先にパスを描き、その点の上に真ん中が来るように後から直線を描く。両方を選んで`A`にすると、直線の真ん中に重なったパスの点をドラッグで動かせる。ほかの図形の点が無い直線の真ん中には、今までどおり点は出ず、押して引くと範囲選択になる。
    3. `A`の今までの操作が変わらない：点のドラッグ、点の`Ctrl`+クリックでの追加・解除、範囲選択、複数の点のまとめ移動、矢印キー、位置の欄、「角」の切り替え、線の端の点をほかの線の端へ近づけたときの吸い付きとつながり。点どうしが重なる所では手前の図形の点がつかまれる。円・弧には点が出ない。
    4. `V`の今までの操作が変わらない：クリックでの選択、`Ctrl`+クリック、本体のドラッグでの移動（直線の真ん中の線の上を含む）、`Alt`+ドラッグの複製、外枠のハンドルでの拡大縮小、外枠の角の外側での回転、空白からの範囲選択、カーソルの形。塗りのない円の中心は今までどおり空白の扱い（押して引くと範囲選択）。`V`では図形ごとの点が出ず、外枠とそのハンドルだけが出る。
