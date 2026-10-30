# RES: 作業計画・作業レポート (Phase 02-03) : 範囲選択・複数選択
* 参照元REQ: `./_log/req/261018_0212_REQ_Phase02-03_Marquee_Multi_Select.md`

## 1. 作業目的
現状、`VectorModel`は単一の`#selectedId`で選択状態を保持しており、選択はホバー中図形のクリックによる1つのみ、移動は選択中図形のmoveハンドルのドラッグによるのみである。本作業では以下を行う。

1. 選択状態を**選択集合**（0個以上の図形id）へ拡張し、一括平行移動・一括削除・選択矩形の保持を`VectorModel`に用意する。
2. 選択モードでの**範囲選択（マーキー選択）**を実装する（交差判定は各図形クラスの新共通メソッド`intersectsRect`へポリモーフィックに委譲）。
3. 選択集合に含まれる図形の**本体ドラッグ**による一括平行移動を実装する。
4. 選択集合の全図形へのハンドル表示・ハンドル当たり判定と、`Delete`/`Backspace`による一括削除を実装する。
5. Phase 02-02で判明したハンドルドラッグの終了検知漏れ（キャンバス外での`mouseup`取りこぼし、ボタン種別の未判定、ドラッグ後の`click`による選択解除）を、ドラッグのライフサイクル管理を新設クラス`DragTracker`へ分離・統一することで解消する。

用語は REQ の定義（**選択集合**／**範囲選択（マーキー選択）**／**選択矩形**／**本体ドラッグ**、ワールド座標・スクリーン座標・ビュー変換はPhase 02-02の定義）に統一し、コード内JSDocでも同じ語を用いる。

---

## 2. アーキテクチャ設計

### 全体方針（責務の割り当て）

| 関心事 | 担当 | 座標系 |
| :--- | :--- | :--- |
| 選択集合・ホバー・選択矩形・作成中図形の保持と変更通知 | `VectorModel` | ワールド |
| 図形と矩形の交差判定 | 各図形クラス`intersectsRect`（新・第10共通メソッド） | ワールド |
| ボタン押下〜解放の1回のドラッグのライフサイクル（開始ボタン・移動量閾値・window capture追従/終了・blur中断・click抑止） | **新設** `core/DragTracker.js` | スクリーン |
| ドラッグの**意味**の解釈（パン／範囲選択／ハンドルドラッグ／本体ドラッグ）、当たり分類、選択の変更、カーソル形状 | `InputTracker` | ワールド（パン量のみスクリーン） |
| 選択矩形・複数ハンドルの描画 | `CanvasManager`（引数で受け取るのみ） | ワールド（変換は既存の描画変換） |
| 描画引数の組み立て | `main.js` `renderCurrentState()` | － |

### 要件1: 選択状態の複数化（`VectorModel`）

**内部状態**
* `#selectedId: string|null` を廃し、`#selectedIds: Set<string>`（選択集合）とする。
* 新規に`#selectionRect: {x1: number, y1: number, x2: number, y2: number} | null`（選択矩形。ワールド座標の対角2点、**正規化しない**：`(x1, y1)`=押下点、`(x2, y2)`=現在のカーソル位置）を持つ。保持先はREQの第一候補どおり`VectorModel`とする（作成中図形`#draftLine`・ホバー状態と同様、`model.onChange`→`renderCurrentState()`の既存経路に乗るため）。

**公開API（新設）**

| API | 意味 | 通知 |
| :--- | :--- | :--- |
| `setSelection(ids)` | 選択集合を`ids`（`Iterable<string>`）で**置き換える**。現存しない図形のidは除外する（不変条件：選択集合は常に現存図形のidのみ）。単一選択は`setSelection([id])`で表現する | 1回 |
| `clearSelection()` | （既存名を維持・意味を複数化）選択集合を空にする | 1回（現行どおり無条件） |
| `getSelectedIds()` | 選択集合を**新しい配列**で返す（内部の`Set`は返さない）。並び順は`#shapes`の並び順（描画順） | － |
| `isSelected(id)` | `id`が選択集合に含まれるか | － |
| `moveShapes(ids, dx, dy)` | `ids`に含まれる全図形を`shape.translate(dx, dy)`でポリモーフィックに平行移動（ワールド座標の差分）。存在しないidは無視 | 1件以上移動した場合のみ**1回** |
| `deleteShapes(ids)` | `ids`に含まれる全図形を`#shapes`から除去し、選択集合・ホバー状態からも除去（残留防止） | 1件以上削除した場合のみ**1回** |
| `setSelectionRect(x1, y1, x2, y2)` | 選択矩形を設定（ワールド座標の対角2点。正規化しない） | 1回 |
| `clearSelectionRect()` | 選択矩形を破棄 | 矩形が存在した場合のみ1回 |
| `getSelectionRect()` | 選択矩形のコピー`{x1, y1, x2, y2}`、なければ`null` | － |

**単一選択API（`selectShape`／`getSelectedId`）および単一図形API（`moveShape`／`deleteShape`）の扱い：廃止する。**
アプリを各タスク完了時点で動作させるため、2段階で行う。
1. タスク3：新APIを追加し、旧4APIは新APIへ委譲する互換ラッパー（JSDocに`@deprecated`）として一時的に残す（`selectShape(id)`→`setSelection([id])`、`getSelectedId()`→`getSelectedIds()[0] ?? null`、`moveShape(id, dx, dy)`→`moveShapes([id], dx, dy)`、`deleteShape(id)`→`deleteShapes([id])`）。
2. タスク4〜7で全呼び出し元を新APIへ移行し、タスク10で呼び出し元が0件であることをGrepで確認してから旧4APIを削除する。

**旧API呼び出し元一覧（計画立案時点の実コード調査結果）**

| 旧API | 呼び出し元 | 移行タスク | 移行先 |
| :--- | :--- | :--- | :--- |
| `getSelectedId()` | `main.js` `renderCurrentState()`（`selectedId: model.getSelectedId()`） | タスク4 | `selectedIds: model.getSelectedIds()` |
| `getSelectedId()` | `InputTracker.handleMouseDown`（選択中図形のハンドル判定） | タスク7 | `#classifyPoint()`（選択集合全図形のハンドル判定） |
| `getSelectedId()` | `InputTracker.handleClick`（選択中なら解除） | タスク7 | `getSelectedIds().length > 0` |
| `getSelectedId()` | `InputTracker.handleKeyDown`（Delete/Backspace） | タスク7 | `getSelectedIds()` |
| `getSelectedId()` | `InputTracker.#resolveCursor`（ハンドル上判定） | タスク7 | `#classifyPoint()`の結果 |
| `selectShape(id)` | `InputTracker.handleClick` | タスク7 | `setSelection([id])` |
| `moveShape(id, dx, dy)` | `InputTracker.handleMouseMove`（moveハンドル） ※タスク6で`#applyLeftDragUpdate`へ移設 | タスク7 | `moveShapes(getSelectedIds(), dx, dy)` |
| `deleteShape(id)` | `InputTracker.handleKeyDown` | タスク7 | `deleteShapes(getSelectedIds())` |
| `render({selectedId})`（引数） | `main.js` `renderCurrentState()` | タスク4 | `render({selectedIds, selectionRect})` |
| `clearSelection()`（名称維持） | `InputTracker.setMode` | 変更不要 | 意味のみ複数化 |

**用語修正**：`VectorModel.js`内の「論理座標系」（`startDraft`/`updateDraft`/`updateVertex`/`moveShape`の`@param`）を「ワールド座標」へ、「作成中Line」を「作成中の図形」へ修正する（動作変更なし）。`updateVertex`の`@param vertexIndex`の「（0: 始点, 1: 終点）」はLine固有の記述のため「（図形ごとの`getVertexIndexForHandle`規約に従う）」へ修正する。

### 要件2: 範囲選択（マーキー選択）

**開始判定**：選択モード・IDLE状態・スペース非押下・キャンバス移動モードでない・ドラッグセッション非実行中に、**左ボタン（`event.button === 0`）**で、当たり分類（後述`#classifyPoint`）が**空白**（選択集合の図形のハンドルにも、いずれの図形の本体にも該当しない）の位置を押下した場合、InputStateを`MARQUEE_SELECTING`とし、押下点のワールド座標を`#marqueeAnchor`に記憶して`DragTracker`のセッションを閾値付き（`DRAG_START_THRESHOLD`=3、スクリーンpx）で開始する。
* 閾値以内で離した場合は、`onEnd(moved=false)`でIDLEに戻すのみ。直後の`click`は通常の空白クリック（全選択解除）として処理される。
* スペース押下中・中ボタン・キャンバス移動モードはパン判定が先に成立するため範囲選択は起きない（Phase 02-02の判定順を維持）。図形作成モードではSELECT判定に入らない。

**閾値超過後**：`onStart`でホバーをクリアし、以降の`onMove`で現在カーソルのワールド座標`cur`を求め`model.setSelectionRect(anchor.x, anchor.y, cur.x, cur.y)`を呼ぶ。
* 選択矩形はワールド座標で保持するため、パン・ズームに自動追従する。範囲選択中のホイールズームでは、`handleWheel`の`zoomAt`直後に同じ更新処理（`#applyLeftDragUpdate(event)`）をホイールイベントの座標で呼び、押下点のワールド位置を固定したまま矩形をカーソル位置まで伸ばし直す。

**確定**：左ボタン解放時（`onEnd(moved=true)`）に`#commitMarquee(event)`を実行する。
1. 解放位置のワールド座標`end`を取得（キャンバス外で離しても`getScreenCoordinate`はキャンバス左上基準の座標を返すため、その時点の矩形で確定できる）。
2. **矩形の正規化はここ1箇所のみ**：`minX = Math.min(anchor.x, end.x)`、`maxX = Math.max(...)`、Yも同様。
3. `ids = model.getShapes().filter(s => s.intersectsRect(minX, minY, maxX, maxY)).map(s => s.id)`（ポリモーフィック呼び出しのみ。図形種別分岐なし）。
4. `model.clearSelectionRect()` → `model.setSelection(ids)`（置き換え。0件なら全解除）。変更通知は操作あたり定数回（2回）で、図形数に比例しない。

**中断**：`window`の`blur`、`setMode`による強制中断時は`onCancel`で`clearSelectionRect()`のみ行い、選択集合は変更しない（確定しない）。

**交差判定 `intersectsRect(minX, minY, maxX, maxY)`（第10共通メソッド）**
* 引数：ワールド座標、正規化済み（`minX <= maxX`、`minY <= maxY`）の軸平行矩形。境界を含む。戻り値：`boolean`。
* 判定対象は**描画されている輪郭線の中心線**（`strokeWidth`は含めない）。塗り内部は判定しない（矩形が図形の内側にすっぽり収まり輪郭線と交差しない場合は`false`）。
* 共通アルゴリズム「線分⇔矩形交差（Liang–Barsky法）」を各クラスのprivateヘルパー`#segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY)`として実装する（図形クラスは自己完結の方針、かつ`shapes/`への共通ユーティリティ新設は本REQのスコープ外のため、各ファイルに同一ロジックを持つ。既存の`Rect.#distanceToSegment`と同じ扱い）。手順：
  ```
  dx = bx - ax, dy = by - ay, t0 = 0, t1 = 1
  (p, q) の4組 = (-dx, ax - minX), (dx, maxX - ax), (-dy, ay - minY), (dy, maxY - ay) について:
    p === 0 の場合: q < 0 なら false（平行かつ外側）、そうでなければ次の組へ（除算しない）
    r = q / p
    p < 0 の場合: r > t1 なら false、r > t0 なら t0 = r
    p > 0 の場合: r < t0 なら false、r < t1 なら t1 = r
  すべて通過したら true
  ```
  長さ0の線分（両端点が同一）は全組で`p === 0`となり「点が矩形内（境界含む）か」の判定に一致するため、0除算は起きない。
* 各クラスの実装：
  * **Line**：線分`(x1, y1)-(x2, y2)`を1本判定。
  * **Rect**：4辺`[0,1],[1,2],[2,3],[3,0]`のいずれかが交差すれば`true`（`hitTest`と同じ辺の組）。
  * **Curve**：輪郭のサンプリング（折れ線近似）。モジュール定数`CURVE_INTERSECT_SEGMENTS = 100`（`hitTest`の100分割と同程度）で`t = i / N`（`i = 0..N`）の点`B(t)`を求め、隣接点を結ぶ`N`本の線分のいずれかが交差すれば`true`。前段の早期棄却として、制御多角形（`P0, P1, P2`）の外接矩形が判定矩形と重ならなければ`false`（ベジェ曲線は制御点の凸包内にあるため正しい）。
  * **Ellipse**：輪郭のサンプリング（折れ線近似）。`rx = |points[1].x − xc|`、`ry = |points[2].y − yc|`（`draw`と同じ算出）とし、モジュール定数`ELLIPSE_INTERSECT_SEGMENTS = 100`で`θ = startAngle + (endAngle − startAngle) × i / N`（`i = 0..N`）の点`(xc + rx·cosθ, yc + ry·sinθ)`を結ぶ`N`本の線分で判定する。`draw`の`ctx.ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)`と同じパラメータ化のため、弧（`arc`）は実際に描画されている弧の部分のみが判定対象となり（弦は描かれないので含めない）、円も同じ式で扱える（`type`による分岐は不要）。**縮退した楕円**（`rx`または`ry`がほぼ0）はサンプル点が線分状（両方0なら1点）に並ぶだけで、除算を含まないため0除算は起きず、つぶれた輪郭が矩形に掛かれば選択される（`hitTest`は`rx < 1 || ry < 1`で`false`を返すためクリック選択はできないが、範囲選択では選択・削除できる）。早期棄却として外接矩形`[xc − rx, xc + rx] × [yc − ry, yc + ry]`との重なりを先に確認する。
* 計算量：Curve/Ellipseとも1図形あたり最大100線分 × 定数（確定時に1回だけ実行。mousemoveごとには実行しない）。

**click抑止**：範囲選択の閾値超過後に終了した場合、`DragTracker`がclick抑止フラグを立て、直後の`click`を1回無視する（要件5）。

**ホバー**：`DragTracker`のセッション中（閾値以前を含む）は`handleMouseMove`が冒頭で`return`するためホバー判定を行わない。`onStart`でホバー表示をクリアする。終了後、次のmousemoveから通常のホバー判定に戻る。

### 要件3: 複数選択中の表示とハンドル操作

**描画（`CanvasManager.render()`）**
* 引数を`render(shapes, { hoveredId = null, selectedIds = [], draftLine = null, selectionRect = null, view = DEFAULT_VIEW } = {})`へ変更する（`selectedId`は廃止。`main.js`の`renderCurrentState()`を同一タスクで追従）。
* 描画順を以下の**2パス**に変更する（複数選択時、前面の図形が背面図形のハンドルを覆い隠さないため）：
  1. 全図形の`draw(ctx)`（＋`hoveredId`一致図形の`drawHover(ctx, view.scale)`）
  2. 選択集合に含まれる図形の`drawHandles(ctx, view.scale)`を図形配列の順（前面が最後＝最前面）に呼ぶ
  3. `draftLine.draw(ctx)`
  4. 選択矩形（`selectionRect`が非null）
  * 所属判定は`render()`内のローカル変数`new Set(selectedIds)`で行う（フレーム内の一時値であり、インスタンスに状態は持たない）。
* 選択矩形の描画は`#drawSelectionRect(rect, scale)`（private）：`save()`→ 線幅`SELECTION_RECT_LINE_WIDTH / scale`（画面上1px）、破線`SELECTION_RECT_DASH.map(v => v / scale)`（画面上`[4, 3]`px）、線色`#4a90e2`、塗り`rgba(74, 144, 226, 0.08)`、`rect(x1, y1, x2 − x1, y2 − y1)`を`fill()`→`stroke()`→`restore()`。幅・高さが負でもCanvasは正しく描くため、描画側では正規化しない。色・破線・線幅はモジュール定数として定義する。

**ハンドル当たり判定（`InputTracker.#classifyPoint`）**
* 選択集合の**全図形**を対象に、**図形配列の後ろ（描画順で前面）から**`hitTestHandle`を呼び、最初に非nullとなった図形・ハンドルを採用する（前面優先。描画パス2の重なり順と一致）。この規則を`#classifyPoint`のJSDocに明記する。
* **頂点ハンドル**（`hitTestHandle`の戻り値が`'move'`以外）：InputState`DRAGGING_HANDLE`、`activeShapeId`=そのハンドルが属する1図形、`activeHandle`=ハンドル名。閾値超過後、`shape.getVertexIndexForHandle(activeHandle)`で頂点インデックスを解決し`model.updateVertex(activeShapeId, vertexIndex, x, y)`（従来どおり1図形のみ。選択集合は変更しない）。
* **moveハンドル**（戻り値`'move'`）：InputState`MOVING_SELECTION`（要件4と同じ処理）で選択集合の全図形を平行移動する。

### 要件4: 本体ドラッグによる一括平行移動

**InputStateの拡張**：
```
IDLE               待機状態（ホバー判定・クリックによる選択/新規作成の待機）
DRAWING            作成中の図形の終点をカーソルに追従させている
DRAGGING_HANDLE    選択集合内の1図形の頂点ハンドルを押下・ドラッグ中（閾値以前を含む）
MOVING_SELECTION   選択集合の全図形を平行移動するドラッグを押下・ドラッグ中（本体ドラッグ・moveハンドル。閾値以前を含む）
MARQUEE_SELECTING  範囲選択を押下・ドラッグ中（閾値以前を含む）
```
押下時点で意図した状態へ遷移し、閾値超過（実際の移動）の有無は`DragTracker`が保持する（`hasMoved()`／`onEnd`の`moved`引数）。InputTracker側に「閾値を超えたか」の重複フラグは持たない。

**当たり分類 `#classifyPoint(point)`**（point：ワールド座標）→ `PointHit`
```
/** @typedef {Object} PointHit
 *  @property {{shapeId: string, handle: string} | null} handle  選択集合の図形のハンドル（前面優先）
 *  @property {string | null} bodyId  本体（hitTest）が真の図形id。選択集合の図形を優先し、同順位は図形配列の先頭（従来のホバー規則）
 */
```
* 本体判定は図形配列を1回走査し、`hitTest`が真の最初の図形を記録しつつ、選択集合の図形で真になった時点でそれを採用して打ち切る（1パス）。
* 許容誤差は従来どおり`#getWorldHitTolerance()`（画面上5pxのワールド換算）。
* この分類を **ホバー（`handleMouseMove`）・押下（`handleMouseDown`）・クリック（`handleClick`）・カーソル（`#resolveCursor`）** の4箇所で共通に用い、クリック時にホバー状態（`getHoveredId()`）を参照しない（ドラッグ後の古いホバー状態に依存する不具合の根本解消。要件5参照）。

**押下時の分岐（選択モード・IDLE・左ボタン・パン不成立時）**

| 分類結果 | 遷移 | 備考 |
| :--- | :--- | :--- |
| `handle`あり・`'move'` | `MOVING_SELECTION` | `lastCursor`=押下点（ワールド） |
| `handle`あり・それ以外 | `DRAGGING_HANDLE` | 1図形の頂点のみ変形 |
| `bodyId`が選択集合内 | `MOVING_SELECTION` | 本体ドラッグ。単一選択でも有効 |
| `bodyId`が選択集合外 | 遷移しない（セッションも開始しない） | 現行どおり：移動も範囲選択も起きず、離した後の`click`で判定 |
| 空白 | `MARQUEE_SELECTING` | 要件2 |

**移動の計算**：`MOVING_SELECTION`の`onMove`で、現在カーソルのワールド座標`(x, y)`と`lastCursor`の差分`(dx, dy)`を`model.moveShapes(model.getSelectedIds(), dx, dy)`へ渡し、`lastCursor`を更新する。閾値超過時の最初の`onMove`で押下点からの差分がまとめて適用されるため、閾値分の移動量は失われない。ズーム後は次のmousemove（またはホイール直後の`#applyLeftDragUpdate`）でカーソル下に追従し直す。

**クリック（閾値以内で離した場合を含む）の解釈**（`handleClick`、選択モード・IDLE）

| `#classifyPoint`の結果 | 動作 |
| :--- | :--- |
| `handle`あり | 何もしない（選択集合を維持。ハンドル位置は REQ 定義上「空白」ではないため解除しない） |
| `bodyId`あり | `setSelection([bodyId])`（その図形のみの単一選択。複数選択中に選択集合内の図形を動かさずクリックした場合もこれ） |
| 空白 | 選択集合が空でなければ`clearSelection()` |

**カーソル形状（`#resolveCursor(hit)`）の判定順**
(0a) パン中→`grabbing`／(0b) スペース押下中かつ左ドラッグ状態（`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`）でない→`grab`／(1) 作成モード→`crosshair`／(2) キャンバス移動モード→`grab`／(3) 選択モード以外→`default`／(4) `DRAGGING_HANDLE`・`MOVING_SELECTION`→`move`／(5) `MARQUEE_SELECTING`→`default`／(6) `hit === null`（座標不明）→`default`／(7) `hit.handle`あり→`move`／(8) `hit.bodyId`が選択集合内→`move`／(9) `hit.bodyId`あり→`pointer`／(10) それ以外→`default`。
`#updateCursor(point)`の引数を`#updateCursor(hit = null)`（`PointHit`）へ変更し、`handleMouseMove`では1回計算した分類結果をホバー更新とカーソル更新で共用する（mousemoveごとのhitTest重複実行を避ける）。

### 要件5: ドラッグ終了検知の統一（Phase 02-02由来の不具合の解消）

**原因の整理（実コード調査結果）**
1. `handleMouseUp`がキャンバス要素にのみ購読されており、`WindowManager`が`.float-window`上の`mouseup`の伝播を止めるため、フロートウィンドウ上・ブラウザ外での解放を検知できず`DRAGGING_HANDLE`が残留する。
2. `handleMouseDown`/`handleMouseUp`がボタン種別を判定していない（右ボタンでハンドルドラッグが始まる、中ボタンの`mouseup`で終わる）。
3. （要調査事項）`handleClick`が`getHoveredId()`で選択/解除を決めている。ドラッグ中は`handleMouseMove`がホバー判定をしないためホバー状態が押下前のまま古く、さらにEllipse中心のmoveハンドル・Curveの制御点ハンドルのように**輪郭線上にないハンドル**ではホバーが`null`になるため、ドラッグ後の`click`が空白クリック扱いとなり選択が外れる。

**対策：`core/DragTracker.js`（新設）へドラッグのライフサイクルを集約**
```
/**
 * 責務：マウスボタン押下から解放までの1回のドラッグ操作のライフサイクル（開始ボタン・移動量閾値の判定、
 * windowへのcapture購読による追従/終了検知、blur時の中断、終了直後のclick抑止）を担う。ドラッグの意味は知らない。
 */
export class DragTracker {
  #getScreenPoint   // (event: MouseEvent) => {x, y}  スクリーン座標を返す関数（InputTracker.getScreenCoordinateを注入）
  #session = null   // {button, startScreen, lastScreen, threshold, suppressClick, moved, handlers} | null
  #suppressNextClick = false

  constructor(getScreenPoint)       // window へ mousemove/mouseup を capture（第3引数true）、blur を購読
  begin(event, handlers, { threshold = 0, suppressClick = 'whenMoved' } = {})  // セッション中なら console.warn して false
      // handlers: { onStart?(): void,
      //             onMove?(event, screen, prevScreen): void,   // screen/prevScreen はスクリーン座標
      //             onEnd?(event, moved: boolean): void,
      //             onCancel?(): void }
  isActive(): boolean
  hasMoved(): boolean              // 閾値を超えたか（セッションなしは false）
  cancel(): void                   // セッションを破棄して onCancel を呼ぶ。click抑止フラグも解除する
  consumeSuppressedClick(): boolean  // 抑止フラグが立っていれば解除して true
  clearSuppressedClick(): void       // 抑止フラグの残留解除（InputTracker.handleMouseDown 冒頭で呼ぶ）
}
```
* **追従**（window capture `mousemove`）：セッション中のみ。`moved`がfalseの間は押下点からのスクリーン距離`Math.hypot(...)`が`threshold`を**超えた**時点で`moved = true`とし`onStart()`→`onMove(...)`を呼ぶ。以降は毎回`onMove(...)`。`lastScreen`は毎回更新する（パンはスクリーン座標の差分を使う）。
* **終了**（window capture `mouseup`）：`event.button === session.button`の場合のみ。セッションを**先に**`null`にしてから（コールバック内の`isActive()`がfalseを返すように）、`session.button === 0`かつ（`suppressClick === 'always'`または`moved`）ならclick抑止フラグを立て、`onEnd(event, moved)`を呼ぶ。
* **取りこぼし保険**（タスク6で追加）：window capture `mousemove`で`event.buttons`に開始ボタンのビット（左=1、中=4）が含まれていなければ、そのイベントを解放とみなして終了処理を行う。
* **中断**：`window`の`blur`、および`InputTracker.setMode`からの`cancel()`。セッション破棄→`onCancel()`、click抑止フラグ解除（blur後にclickは来ないため）。
* フロートウィンドウ上でもwindow captureの`mousemove`は到達するため、**ドラッグ中にカーソルがフロートウィンドウ上を通過しても追従は途切れない（要件5の任意項目：対応する）**。

**InputTrackerでの利用規則**
* 左ドラッグ（ハンドル・本体・範囲選択）は`event.button === 0`の押下でのみ`begin(..., { threshold: DRAG_START_THRESHOLD, suppressClick: 'whenMoved' })`し、左ボタンの解放でのみ終了する（`DragTracker`の開始ボタン一致判定）。右ボタン（2）の押下は何も開始しない。中ボタン（1）はパンのみ。
* パンは`begin(..., { threshold: 0, suppressClick: 'always' })`（現行：左ボタンのパン後のclickは移動の有無によらず抑止、中ボタンは抑止しない＝`button === 0`条件で再現）。パン中フラグ`#isPanning`（boolean）はInputTrackerが保持し、`onEnd`/`onCancel`で解除する。パンの直前位置・開始ボタンは`DragTracker`のセッションが保持する（現行`#panDrag`は廃止）。
* セッションは同時に1つのみ。`handleMouseDown`は「click抑止残留の解除」→「中ボタンなら`preventDefault()`」→「セッション中なら何もしない」の順で判定する（左ドラッグ中にパンは開始しない＝現行の「DRAGGING_HANDLE中はパンしない」の一般化）。
* キャンバスの`mouseup`購読と`handleMouseUp`メソッドは廃止する（終了検知は`DragTracker`へ一元化）。
* `handleMouseMove`（キャンバス購読）はセッション中（パン・左ドラッグ・閾値以前を含む）は冒頭で`return`する。左ドラッグの追従は`DragTracker`の`onMove`→`#applyLeftDragUpdate(event)`（InputStateで`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`を振り分けるディスパッチャ。図形種別分岐ではない）が担う。
* 終了・中断時の後始末は`#finishLeftDrag()`に集約：`state = IDLE`、`activeHandle`/`activeShapeId`/`lastCursor`/`#marqueeAnchor`を`null`、カーソル再評価。範囲選択の確定（`onEnd`かつ`moved`）／破棄（`onCancel`）は呼び出し前に行う。
* click抑止は`handleClick`冒頭で`this.#drag.consumeSuppressedClick()`。抑止フラグはパンと左ドラッグで**共通化**し、所有者は`DragTracker`のみとする（InputTrackerの`#suppressNextClick`は廃止）。
* `#handleWindowBlur`（InputTracker）はスペース押下状態の解除とカーソル再評価のみを担う（ドラッグの中断は`DragTracker`自身のblur購読が行う）。
* `setMode`：セッション中なら`this.#drag.cancel()`（範囲選択は破棄、パンは終了）→ 既存処理（選択集合・ホバーのクリア、`state !== IDLE`なら`cancelDraft()`してIDLE、カーソル再評価）。
* `handleKeyDown`の一括削除はIDLE状態のときのみ受け付ける（ドラッグ中に削除して、存在しない図形を参照し続けることを防ぐ。現行はハンドルドラッグ中の削除で`getVertexIndexForHandle`の呼び出し先が`undefined`となり得る）。

### 要件6: 一括削除と選択解除
* 選択モード・IDLE状態・選択集合が空でない状態で`Delete`/`Backspace`→ `preventDefault()`（現行どおり、この条件成立時のみ）→ `model.deleteShapes(model.getSelectedIds())`。削除後は`deleteShapes`内で選択集合から除去されるため空になる。
* 空白クリック→全解除、本体クリック→その図形のみ選択（要件4のクリック表）。
* `setMode`は既存どおり`clearSelection()`（意味が複数化）を無条件に呼ぶ。

### 要件7: 回帰防止
* 当たり判定・選択矩形・移動量はすべて`getWorldCoordinate`（`ViewTransform.screenToWorld`）経由のワールド座標で扱い、閾値判定のみ`DragTracker`がスクリーン座標で行う。変換式を新たに書かない。
* 単一選択・図形作成（5種）・パン（3通り）・ズーム・倍率表示/リセットの経路は、タスク5（純粋な移設）完了時点で挙動不変を確認し、以降のタスクでも目視確認項目（5章）で確認する。
* 既知の意図的な挙動変化（5章に記載）：ハンドルドラッグに3pxの遊びが入る、ハンドル上の動かさないクリックで選択が外れなくなる、選択集合の図形と非選択図形が重なる位置ではホバー表示が選択集合の図形を優先する、複数選択時のハンドルが全図形の上に描かれる。

### 要件8: `InputTracker`の責務分離の検討
**採否：一部を分離する（ドラッグのライフサイクル管理のみを`core/DragTracker.js`へ分離）。**

* **分離するもの**：開始ボタンの記憶、押下点・直前位置（スクリーン座標）、移動量閾値の判定、windowへのcapture購読による追従/終了検知、`buttons`による取りこぼし検知、blur時の中断、終了直後のclick抑止フラグ。いずれもドラッグの**意味に依存しない**汎用処理であり、現状パン専用に書かれているものを4種のドラッグで共用するため、分離によって重複実装を防げる。
* **分離しないもの**：ドラッグの意味の解釈（パン量の`panBy`、範囲選択・本体ドラッグ・ハンドルドラッグの`VectorModel`更新）、当たり分類、カーソル形状。これらは`InputState`・操作モード・スペース押下状態・`VectorModel`・`ViewTransform`を同時に参照するため、別クラスへ切り出すと状態の参照・所有が複数クラスにまたがり二重管理を生む。
* **依存方向**：`InputTracker` → `DragTracker`（一方向）。`InputTracker`がコンストラクタで`new DragTracker((e) => this.getScreenCoordinate(e))`を生成・所有し、`begin()`時にコールバックを渡す。`DragTracker`は`InputTracker`・`VectorModel`・`ViewTransform`・DOMの`canvas`をimport/参照しない（スクリーン座標取得関数のみ注入）。
* **状態の所有者**

| 状態 | 所有者 |
| :--- | :--- |
| `state`（InputState）、`currentMode`、`currentShapeType` | InputTracker |
| `activeHandle`、`activeShapeId`、`lastCursor`（ワールド）、`#marqueeAnchor`（ワールド） | InputTracker |
| `#isPanning`、`#isSpacePressed` | InputTracker |
| ドラッグセッション（開始ボタン・押下点/直前位置（スクリーン）・閾値・`moved`・コールバック） | DragTracker |
| click抑止フラグ（パン・左ドラッグ共通） | DragTracker |
| 選択集合・ホバー・選択矩形（表示用） | VectorModel |

  ※`#marqueeAnchor`は範囲選択のジェスチャーの起点（入力解釈の状態）、`VectorModel`の選択矩形は描画用の派生値であり、毎回`#marqueeAnchor`と現在位置から再設定する（`VectorModel`側の値を読み返して入力解釈に使わない）。
* **移設の分離**：タスク5で`DragTracker`を新設し**パンのみ**を移設する純粋なリファクタリングとする（挙動不変）。ハンドルドラッグの移行・不具合修正はタスク6、新機能はタスク8・9で行う。
* **InputTracker内のメソッド整理方針**：区切りコメントで以下のセクションに整理する。「公開API（モード・図形種別）」「キャンバスイベントハンドラ」「左ドラッグ（ハンドル・本体・範囲選択）」「パン」「当たり分類」「座標取得」「カーソル形状」。
* **用語・古いJSDocの修正**（該当箇所に触れるタスクで実施）：`InputState`のJSDoc（「新規Line作成中」「start/end/move」）、`activeHandle`の`@type {'start'|'end'|'move'|null}`（→`{string|null}`、各図形の`hitTestHandle`の戻り値）、`handleMouseMove`の「作成中Line」、クラスJSDocの「（IDLE / DRAWING / DRAGGING_HANDLE）」「#panDrag / #isSpacePressed / #suppressNextClick」。
* 分離後もInputTrackerは機能追加により現状（約720行）と同程度以上の行数になる見込みであり、将来の再分離候補（選択ジェスチャーの解釈）を5章に記す。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/core/` - 横断処理（入力・状態・描画）
    *   `./js/shapes/` - 図形ドメイン（交差判定メソッドの追加のみ）
    *   `./js/` - エントリポイント（`main.js`）
*   **関連する論理クラス**:
    *   `VectorModel`（更新：選択集合・一括移動/削除・選択矩形）
    *   `InputTracker`（更新：範囲選択・本体ドラッグ・当たり分類・ドラッグ終了検知の統一・カーソル形状。`InputState`に`MOVING_SELECTION`/`MARQUEE_SELECTING`追加）
    *   **`DragTracker`（新設：`./js/core/DragTracker.js`。ドラッグのライフサイクル管理）**
    *   `CanvasManager`（更新：`render()`の引数変更・ハンドルの2パス描画・選択矩形の描画）
    *   `main.js`（更新：`renderCurrentState()`の引数構成）
    *   `Line` / `Curve` / `Rect` / `Ellipse`（更新：第10共通メソッド`intersectsRect`の追加のみ）
    *   変更しない：`ViewTransform`、`ShapeFactory`、`WindowManager`、`PaletteController`、`index.html`

### 参照する責務
（`PROJECT_ARCHITECTURE.md`より抜粋。以後のタスク実行チャットはこの項目のみを責務情報源とする）

*   **2. データ構造**：ShapeDataの座標（`points`）はすべてワールド座標である。ビュー変換（表示倍率・オフセット）は図形データに含まれず、表示専用の状態として`core/ViewTransform.js`が保持する（パン・ズームによって図形データが書き換わることはない）。
*   **3. 座標系とビュー変換**：図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼び、`スクリーン = ワールド × 倍率 ＋ オフセット`の関係にある。入力は`InputTracker`がスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す（パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す）。描画は`main.js`の`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡す。再描画は`VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から、同一関数`renderCurrentState()`で行う。
*   **main.js**：アプリケーションのエントリポイント。`VectorModel`/`CanvasManager`/`InputTracker`/`PaletteController`/`WindowManager`のインスタンス化とイベントバインドを担う。`applyMode(mode)`で操作モード切替を一元管理する。起動時初期化の最後に`renderCurrentState()`を明示的に1回呼び出す。`ViewTransform`を生成して`InputTracker`へ注入し、`renderCurrentState()`で`view: viewTransform.getState()`を`render()`へ渡す。`viewTransform.onChange`に`renderCurrentState`と`syncZoomDisplay`を登録する。
*   **VectorModel.js**：描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。選択状態(`#selectedId`)・ホバー状態(`#hoveredId`)・作成中図形(`#draftLine`)を保持する。選択/ホバーの読み書きAPI（`selectShape`/`clearSelection`/`getSelectedId`、`setHovered`/`clearHovered`/`getHoveredId`）と、ドラフトのライフサイクルAPI（`startDraft(x, y, type = 'line')`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）を持つ。図形idの採番（連番）は`commitDraft()`実行時に行う。`updateVertex(id, vertexIndex, x, y)`/`moveShape(id, dx, dy)`は対象shapeの`setVertex`/`translate`へポリモーフィックに委譲する（`core/`側にshapeの内部プロパティ名を持ち込まない）。図形の生成は`ShapeFactory.create(type, x1, y1, x2, y2)`へ完全委譲する。`updateDraft(x, y)`は対象図形の`updateDraftEnd(x, y)`へポリモーフィックに委譲する。`deleteShape(id)`は削除対象が選択中/ホバー中であった場合それらの状態も同時にクリアする。
*   **CanvasManager.js**：Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。`render(shapes, { hoveredId, selectedId, draftLine, view } = {})`の形で呼び出される。`view`とdpr（`#pixelRatio`）を合成した描画変換を毎フレーム`setTransform`で明示設定する。図形より先にワールド座標上の背景グリッドを描く。通常描画（`shape.draw(ctx)`）に加え、`hoveredId`と一致する図形には`drawHover(ctx, view.scale)`を、`selectedId`と一致する図形には`drawHandles(ctx, view.scale)`をポリモーフィックに追加呼び出す。`draftLine`が渡された場合は全図形描画後に`draw(ctx)`のみ重ねて描画する。ビュー変換状態は保持しない（`ViewTransform`はimportしない）。`resize()`は`render()`の呼び出しを行わない（再描画トリガーは`main.js`側の責務）。
*   **ViewTransform.js**：ビュー変換状態（`scale`・`offsetX`/`offsetY`）を保持する唯一のクラス。スクリーン⇔ワールドの変換式はここにのみ実装する（`screenToWorld`/`worldToScreen`/`screenLengthToWorld`）。`zoomAt(sx, sy, factor)`はカーソル位置中心のズーム（クランプ時もカーソル下のワールド点は不変）、`panBy(dx, dy)`はスクリーン座標での平行移動。値が実際に変化した場合のみ`onChange`リスナーへ通知する。図形データ・DOM・`VectorModel`・`CanvasManager`には依存しない。
*   **InputTracker.js**：マウス・キーボード入力の解釈（パン・ズームを含む）、スクリーン座標からワールド座標への変換。`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシン。図形種別のif/switch分岐は一切行わず、`shape.hitTest(...)`/`shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。ハンドル種別から`vertexIndex`への解決は`shape.getVertexIndexForHandle(this.activeHandle)`へ委譲する。操作モード(`currentMode`: `'select'`/`'create'`/`'pan'`)と図形種別(`currentShapeType`)を独立した状態として保持し、定数`OperationMode`/`SHAPE_TYPES`をexportする。`setMode(mode)`は選択/ホバー状態のクリアと進行中操作の強制中断（IDLE復帰）を伴う。キャンバスのカーソル形状（パン中:`grabbing`／スペース押下中・キャンバス移動モード:`grab`／作成モード:`crosshair`／選択モードでハンドル上・ドラッグ中:`move`／図形上:`pointer`／その他:`default`）の設定も担う。`document`購読の`keydown`で、選択モード中に選択図形がある状態での`Delete`/`Backspace`押下で`VectorModel.deleteShape(id)`を呼ぶ。
    *   **座標系**：コンストラクタで`ViewTransform`を受け取る。`getScreenCoordinate(event)`でスクリーン座標（CSSズーム吸収済み）を取得し、`getWorldCoordinate(event)`でワールド座標へ逆変換する。`VectorModel`・当たり判定へ渡す座標はすべてワールド座標であり、許容誤差（`hitTolerance`、スクリーンpx単位）は画面上5px相当をワールド換算して渡す。
    *   **パン**：中ボタンドラッグ・スペース＋左ドラッグ・キャンバス移動モードの左ドラッグ。パン状態は`InputState`と直交するprivateフラグで表現し、`DRAWING`を保持したまま行える（`DRAGGING_HANDLE`中は開始しない）。パンの追従・終了は`window`へのcapture購読で検知し、左ボタンのパン後の`click`は抑止する。スペース押下状態は`keyup`・`blur`で解除する。
    *   **ズーム**：キャンバスの`wheel`（`passive: false`）で、カーソル位置中心のズーム。操作モード・入力状態によらず常に有効。
*   **WindowManager.js**（変更しない）：`.float-window`要素のドラッグ移動・最前面化・イベント遮断（下層要素への透過防止）を一元管理する。※`.float-window`上の`mousedown`/`click`/`mousemove`/`mouseup`の伝播を止めるため、キャンバス購読のみではフロートウィンドウ上の解放を検知できない（windowへのcapture購読が必要な理由）。
*   **shapes/**：図形種別ごとのデータ保持・描画・当たり判定を担う。`Line`/`Curve`/`Rect`/`Ellipse`はいずれも同一シグネチャの9メソッド（`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`）を自律実装しており、この契約を満たす限り`core/`層を変更せずに作成・選択・再編集フローへ組み込める。図形クラスが扱う座標はすべてワールド座標である。
    *   **Line.js**：直線（`x1, y1`=始点／`x2, y2`=終点）。`hitTestHandle`は`'start'|'end'|'move'|null`。
    *   **Curve.js**：2次ベジェ曲線（`points[0]`=始点／`points[1]`=制御点／`points[2]`=終点）。`move`ハンドルは持たない。
    *   **Rect.js**：矩形（`points[0..3]`=topLeft/topRight/bottomRight/bottomLeft）。`move`ハンドルは持たない。
    *   **Ellipse.js**：円・楕円・弧（`points[0]`=中心／`[1]`=右端／`[2]`=上端／`[3]`・`[4]`=開始角・終了角制御点）。内部の`type`（`'circle'`|`'arc'`）で振る舞いを分岐する。中心が`'move'`ハンドル。
*   **ShapeFactory.js**（変更しない）：`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュール。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1. フォルダ構造**：`core/`に`DragTracker.js`を追加。
*   **2. データ構造**：選択状態は選択集合（図形idの集合。0個以上）であり、選択矩形（範囲選択中の表示用、ワールド座標の対角2点）とともに`VectorModel`が保持する旨を追記。
*   **3. 描画・操作フロー**：入力監視の項に「左ドラッグ（ハンドル・本体・範囲選択）とパンのライフサイクルは`DragTracker`がwindowへのcapture購読で一元管理し、意味の解釈は`InputTracker`が行う」旨と、範囲選択の流れ（閾値判定はスクリーン座標、選択矩形・交差判定・移動量はワールド座標）を追記。
*   **VectorModel.js**：`#selectedId`→`#selectedIds`（選択集合）、`#selectionRect`の追加。API記述を`setSelection(ids)`/`clearSelection()`/`getSelectedIds()`/`isSelected(id)`、`moveShapes(ids, dx, dy)`/`deleteShapes(ids)`（通知は1操作1回、削除時の選択集合・ホバーからの除去）、`setSelectionRect`/`clearSelectionRect`/`getSelectionRect`へ更新。`selectShape`/`getSelectedId`/`moveShape`/`deleteShape`の記述を削除。
*   **CanvasManager.js**：`render(shapes, { hoveredId, selectedIds, draftLine, selectionRect, view } = {})`へ更新。描画順（図形＋ホバー → 選択集合のハンドル → 作成中図形 → 選択矩形）と、選択矩形の描画仕様（画面上1pxの破線＋薄い半透明塗り）を追記。
*   **main.js**：`renderCurrentState()`が`selectedIds: model.getSelectedIds()`・`selectionRect: model.getSelectionRect()`を渡す旨を追記。
*   **InputTracker.js**：状態を`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`の5状態へ更新。当たり分類`#classifyPoint`（ハンドルは選択集合の全図形を前面優先、本体は選択集合優先）をホバー・押下・クリック・カーソルで共用する旨、範囲選択（開始条件・閾値`DRAG_START_THRESHOLD`・`intersectsRect`による確定・矩形の正規化は確定処理1箇所のみ）、本体ドラッグ、クリックの解釈表、カーソル形状の判定順、`Delete`/`Backspace`による一括削除（IDLE時のみ）を更新。パンの記述（`DRAGGING_HANDLE`中は開始しない→ドラッグセッション中は開始しない、click抑止の所有者は`DragTracker`）を更新。`DragTracker`を生成・所有する旨を追記。※タスク10追記：先頭の責務定義を「ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・一括削除・パン・ズーム）の解釈とModel・ビュー変換への反映、およびカーソル形状のフィードバック」へ更新した。メソッドは区切りコメントで「公開API（モード・図形種別）」「イベントハンドラ」「左ドラッグ」「パン」「当たり分類」「座標取得」「カーソル形状」の順に整理済み（資料に内部構成を記す場合の参考）。
*   **DragTracker.js（新規エントリ）**：単一責務、公開API（`begin`/`isActive`/`hasMoved`/`cancel`/`consumeSuppressedClick`/`clearSuppressedClick`）、閾値はスクリーン座標、開始ボタンの解放でのみ終了、`buttons`による取りこぼし検知、blurで中断、click抑止は左ボタンのみ、依存方向（`InputTracker`→`DragTracker`の一方向、スクリーン座標取得関数のみ注入）。
*   **shapes/**：共通メソッド契約を9→10メソッドへ更新（`intersectsRect(minX, minY, maxX, maxY)`：ワールド座標・正規化済み矩形・境界含む・輪郭線の中心線で判定・塗り内部は対象外）。Curve/Ellipseはサンプリング近似である旨。

---

## 3. タスクリスト

> **各実装タスク共通の完了作業**（タスク1〜10の「作業内容」末尾に必ず含める）
> * (a) JSDocの記載漏れがないことを確認する。座標を扱う引数・戻り値・プロパティには**ワールド座標かスクリーン座標か**を明記する。選択に関するAPIは単一（`id`）か選択集合（`ids`）かが名称・JSDocから明確に分かること。
> * (b) 本RESの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクを`[x]`にする。
> * (c) 開発資料に影響が出る場合は資料本体を修正せず、「開発資料の更新予定」欄へ追記する。
> * (d) 判断に迷った点・目視確認を推奨する箇所・将来の修正時の注意点を「5. 懸念事項・要確認ポイント」へ追記する。

*   [x] タスク1: 図形クラスへの交差判定メソッド追加（Line・Rect）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新（メソッド追加のみ）
        *   `./js/shapes/Rect.js` : 更新（メソッド追加のみ）
    *   **作業内容** :
        *   各クラスにprivateヘルパー`#segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY)`を追加する（2章 要件2のLiang–Barsky法の手順どおり。`p === 0`の組では除算しない）。JSDocに「線分（ワールド座標）と軸平行矩形（ワールド座標・正規化済み・境界含む）の交差判定。長さ0の線分は点の内包判定となる。契約メソッドではない内部ヘルパー」と記す。
        *   公開メソッド`intersectsRect(minX, minY, maxX, maxY)`を追加する。Line：線分`(x1, y1)-(x2, y2)`を判定。Rect：4辺`[0,1],[1,2],[2,3],[3,0]`のいずれかが交差すれば`true`。
        *   JSDoc：「選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド（共通メソッド契約の第10メソッド）。塗り内部は判定しない」、各引数「ワールド座標。呼び出し側で正規化済み（min ≤ max）」、戻り値`boolean`。
        *   既存メソッド（`draw`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`等）のロジック・JSDocは変更しない。
        *   この時点では呼び出し元はない（アプリの挙動は不変）。
        *   共通完了作業(a)〜(d)。
*   [x] タスク2: 図形クラスへの交差判定メソッド追加（Curve・Ellipse）
    *   **対象ファイル** :
        *   `./js/shapes/Curve.js` : 更新（メソッド・定数追加のみ）
        *   `./js/shapes/Ellipse.js` : 更新（メソッド・定数追加のみ）
    *   **作業内容** :
        *   各ファイルにモジュール定数（`CURVE_INTERSECT_SEGMENTS = 100`／`ELLIPSE_INTERSECT_SEGMENTS = 100`、JSDocで「輪郭サンプリングの分割数。hitTestの100分割と同程度の計算量」）と、タスク1と同一ロジックのprivateヘルパー`#segmentIntersectsRect(...)`を追加する。
        *   Curve `intersectsRect`：制御多角形（`points[0..2]`）の外接矩形が判定矩形と重ならなければ`false`（早期棄却）。重なる場合は`B(t)`を`t = i / N`（`i = 0..N`）でサンプリングし、隣接点を結ぶ`N`本の線分のいずれかが交差すれば`true`。
        *   Ellipse `intersectsRect`：`rx`/`ry`を`draw`と同じ式で求め、外接矩形`[xc − rx, xc + rx] × [yc − ry, yc + ry]`で早期棄却。`θ = startAngle + (endAngle − startAngle) × i / N`で`(xc + rx·cosθ, yc + ry·sinθ)`をサンプリングし線分判定。`this.type`による分岐は追加しない（`startAngle`/`endAngle`のみで円・弧を同一処理）。JSDocに「縮退した楕円（rx/ryが0）でもサンプル点が線分状・点状に並ぶだけで0除算を起こさず、輪郭が掛かれば`true`」「弧は描画されている弧部分のみ（弦は含めない）」「折れ線近似のため真の輪郭とのずれ（最大で半径×(1−cos(π/N))程度）がある」と明記する。
        *   既存メソッドのロジック・JSDocは変更しない。呼び出し元はまだない（挙動不変）。
        *   共通完了作業(a)〜(d)。
*   [x] タスク3: `VectorModel`の選択集合化・一括移動/削除・選択矩形の保持（旧APIは互換ラッパー化）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
    *   **作業内容** :
        *   `#selectedId`を`#selectedIds`（`Set<string>`、JSDoc「選択集合：選択中の図形idの集合（0個以上）。常に現存図形のidのみを含む」）へ置き換える。`#selectionRect`（`{x1, y1, x2, y2}|null`、JSDoc「範囲選択中の選択矩形。ワールド座標の対角2点（x1,y1=押下点、x2,y2=現在のカーソル位置）。正規化しない。描画用」）を追加しコンストラクタで初期化する。
        *   2章 要件1の表どおり`setSelection(ids)`（現存idのみ採用・置き換え・通知1回）、`clearSelection()`（選択集合を空に・通知1回）、`getSelectedIds()`（`#shapes`の並び順の新しい配列）、`isSelected(id)`、`moveShapes(ids, dx, dy)`（1件以上移動時のみ通知1回）、`deleteShapes(ids)`（`#shapes`・`#selectedIds`・`#hoveredId`から除去、1件以上削除時のみ通知1回）、`setSelectionRect(x1, y1, x2, y2)`、`clearSelectionRect()`（存在時のみ通知）、`getSelectionRect()`（コピーまたは`null`）を実装する。`moveShapes`/`deleteShapes`は図形種別を意識せず、`translate`の委譲とidによる除去のみで実装する。
        *   旧API`selectShape(id)`/`getSelectedId()`/`moveShape(id, dx, dy)`/`deleteShape(id)`は新APIへ委譲する互換ラッパーに書き換え、JSDocに`@deprecated 選択集合API（…）へ移行中。Phase 02-03 タスク10で削除予定`を付す（`getSelectedId()`は「選択集合の先頭（描画順）または`null`」）。呼び出し元（`main.js`・`InputTracker.js`）は本タスクでは変更しない（この時点でアプリは従来どおり動作する）。
        *   用語修正：「論理座標系」→「ワールド座標」（`startDraft`/`updateDraft`/`updateVertex`/`moveShape`の`@param`）、「作成中Line」→「作成中の図形」（`updateDraft`/`commitDraft`/`cancelDraft`）、`updateVertex`の`@param vertexIndex`の「（0: 始点, 1: 終点）」→「各図形の`getVertexIndexForHandle`の規約に従う頂点インデックス」。動作は変更しない。
        *   ファイル先頭の責務JSDocを確認し、必要なら「図形データ・選択集合・ホバー・作成中図形・選択矩形の状態管理（SSOT）と更新通知を担う」等へ更新する（3行以内）。
        *   共通完了作業(a)〜(d)。
*   [x] タスク4: `CanvasManager.render()`の選択集合・選択矩形対応と`main.js`の追従
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
        *   `./js/main.js` : 更新
    *   **作業内容** :
        *   `render()`の引数を`{ hoveredId = null, selectedIds = [], draftLine = null, selectionRect = null, view = DEFAULT_VIEW } = {}`へ変更し、`selectedId`を廃止する。
        *   描画を2章 要件3の順（(1)全図形`draw`＋ホバー → (2)選択集合の図形の`drawHandles(ctx, view.scale)`を図形配列順に → (3)`draftLine` → (4)選択矩形）へ変更する。所属判定は`render()`内ローカルの`new Set(selectedIds)`で行い、インスタンスフィールドを追加しない。
        *   モジュール定数（`SELECTION_RECT_STROKE_COLOR = '#4a90e2'`、`SELECTION_RECT_FILL_COLOR = 'rgba(74, 144, 226, 0.08)'`、`SELECTION_RECT_LINE_WIDTH = 1`（スクリーンpx）、`SELECTION_RECT_DASH = [4, 3]`（スクリーンpx））とprivate`#drawSelectionRect(rect, scale)`（`save`/`restore`、線幅・破線を`÷ scale`で画面上一定、`rect(x1, y1, x2 − x1, y2 − y1)`を`fill`→`stroke`。正規化しない）を追加する。
        *   `render()`のJSDocを更新（`state.selectedIds`：選択集合のid配列、`state.selectionRect`：ワールド座標の対角2点・正規化不要、描画順）。先頭の責務JSDoc（「背景グリッドを含む」）を必要に応じ「背景グリッド・選択矩形を含む」へ更新。
        *   `main.js`の`renderCurrentState()`を`selectedIds: model.getSelectedIds()`、`selectionRect: model.getSelectionRect()`へ変更し、JSDocの「（shapes/selectedId/hoveredId/draftLine）」を「（shapes/selectedIds/hoveredId/draftLine/selectionRect）」へ修正する。再描画経路（3経路から同一関数）は変更しない。
        *   この時点で選択集合は最大1要素のため、見た目は従来と同一（ハンドルが他図形より前面に描かれる点のみ変化）。
        *   共通完了作業(a)〜(d)。
*   [x] タスク5: `DragTracker`の新設とパンの移設（純粋なリファクタリング）
    *   **対象ファイル** :
        *   `./js/core/DragTracker.js` : 新規
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `DragTracker.js`を2章 要件5の仕様で新規作成する（先頭に3行以内の責務JSDoc、クラス・全メソッド・privateフィールドにJSDoc。`startScreen`/`lastScreen`・`onMove`の`screen`/`prevScreen`・`threshold`は**スクリーン座標**と明記）。本タスクでは`buttons`による取りこぼし検知は**実装しない**（タスク6で追加）。`InputTracker`・`VectorModel`・`ViewTransform`をimportしない。
        *   `InputTracker`のパンを`DragTracker`へ移設する：`#panDrag`・`#suppressNextClick`・`#handleWindowMouseMove`・`#handleWindowMouseUp`・`#endPan`を廃止し、`#isPanning`（boolean）と`#drag`（`DragTracker`）を追加。コンストラクタで`new DragTracker((e) => this.getScreenCoordinate(e))`を生成し、window capture `mousemove`/`mouseup`の購読をInputTrackerから削除する（`blur`購読は残し、スペース押下解除とカーソル再評価のみ行う）。
        *   `#beginPan(event)`：`#isPanning = true`、ホバークリア、カーソル更新の後、`this.#drag.begin(event, { onMove: (e, screen, prev) => this.viewTransform.panBy(screen.x − prev.x, screen.y − prev.y), onEnd: () => this.#finishPan(), onCancel: () => this.#finishPan() }, { threshold: 0, suppressClick: 'always' })`。`#finishPan()`：`#isPanning = false`、カーソル再評価。
        *   `handleMouseDown`冒頭の`#suppressNextClick = false`を`this.#drag.clearSuppressedClick()`へ、`handleClick`冒頭の抑止判定を`this.#drag.consumeSuppressedClick()`へ、`#panDrag !== null`判定を`#isPanning`へ置き換える。`setMode`のパン終了は`this.#drag.cancel()`へ置き換える。`DRAGGING_HANDLE`中はパンを開始しない既存条件、ハンドルドラッグの処理（キャンバス`mouseup`含む）は**本タスクでは変更しない**。
        *   クラスJSDoc・関連JSDocの「#panDrag / #suppressNextClick」記述を実態に合わせて修正する。
        *   完了時点でパン3通り（中ボタン・スペース＋左・キャンバス移動モード）、パン中のDRAWING維持、左パン後のclick抑止、フロートウィンドウ上/ブラウザ外での解放、blur時の解除が従来どおりであることを確認する。
        *   共通完了作業(a)〜(d)。
*   [x] タスク6: ハンドルドラッグの`DragTracker`への移行（Phase 02-02由来の終了検知漏れの解消）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
        *   `./js/core/DragTracker.js` : 更新
    *   **作業内容** :
        *   `DragTracker`に`buttons`による取りこぼし検知を追加する（2章 要件5）。
        *   `InputTracker`にモジュール定数`DRAG_START_THRESHOLD = 3`（JSDoc「クリックとドラッグを区別する移動量の閾値。スクリーン座標のCSSピクセル」）を追加する。
        *   `handleMouseDown`を「click抑止残留の解除 → 中ボタンなら`preventDefault()`してパン開始（セッション中なら開始しない）→ セッション中なら`return` → 左ボタン＋（スペース or キャンバス移動モード）ならパン → `event.button !== 0`なら`return` → 選択モード・IDLEのハンドル判定」の順に整理する（パン開始条件の`state !== DRAGGING_HANDLE`は「セッション中なら開始しない」へ一般化）。
        *   ハンドル押下時は従来どおり`activeHandle`/`activeShapeId`/`lastCursor`（ワールド）を記憶して`DRAGGING_HANDLE`へ遷移し、`this.#drag.begin(event, { onStart: () => this.#onLeftDragStart(), onMove: (e) => this.#applyLeftDragUpdate(e), onEnd: (e, moved) => this.#finishLeftDrag(), onCancel: () => this.#finishLeftDrag() }, { threshold: DRAG_START_THRESHOLD, suppressClick: 'whenMoved' })`を呼ぶ。`#onLeftDragStart()`：ホバークリア・カーソル更新。`#applyLeftDragUpdate(event)`：InputStateで振り分け、本タスクでは`DRAGGING_HANDLE`のみ（moveハンドルは従来どおり`moveShape`、それ以外は`getVertexIndexForHandle`→`updateVertex`）。`#finishLeftDrag()`：IDLE復帰・作業用フィールドを`null`・カーソル再評価。
        *   `handleMouseMove`の`DRAGGING_HANDLE`分岐を削除し、冒頭を`if (this.#drag.isActive()) return;`へ変更する。キャンバス`mouseup`購読と`handleMouseUp`メソッドを削除する。
        *   `handleWheel`：`zoomAt`の後、`this.#drag.hasMoved()`かつ左ドラッグ状態なら`#applyLeftDragUpdate(event)`を呼ぶ（ズーム後もカーソル下へ追従）。
        *   `handleKeyDown`：一括削除の前に`this.state !== InputState.IDLE`なら`return`（ドラッグ中の削除を受け付けない）。
        *   `#resolveCursor`の(0b)の`DRAGGING_HANDLE`除外は維持。
        *   JSDoc修正：`InputState`の`DRAGGING_HANDLE`説明（「start/end/move」→「選択中図形のハンドルを押下・ドラッグ中（閾値以前を含む）」）、`activeHandle`の`@type`を`{string|null}`（各図形`hitTestHandle`の戻り値）へ、`handleMouseMove`の「作成中Line」→「作成中の図形」、`handleMouseDown`・`handleClick`・`setMode`・`handleWheel`・`handleKeyDown`の説明を実態へ。
        *   完了時点で、ハンドルドラッグ中にフロートウィンドウ上・ブラウザ外で離しても状態が残留しないこと、右ボタンでハンドルドラッグが始まらないこと、ドラッグ中の中ボタン解放で終わらないこと、ハンドルを動かした直後の`click`で選択が外れないことを確認する（動かさずに離した場合の古いホバー依存はタスク7で解消）。
        *   共通完了作業(a)〜(d)。
*   [x] タスク7: `InputTracker`の選択集合APIへの移行と当たり分類の共通化
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `InputState`に`MOVING_SELECTION`を追加する（JSDoc「選択集合の全図形を平行移動するドラッグを押下・ドラッグ中（moveハンドル・本体ドラッグ。閾値以前を含む）」）。
        *   `PointHit`のtypedefと`#classifyPoint(point)`（point：ワールド座標）を2章 要件4の規則で実装する（ハンドルは選択集合の全図形を**図形配列の後ろ＝前面から**判定、本体は1パスで選択集合の図形を優先・同順位は配列の先頭）。規則をJSDocに明記する。図形種別分岐は持たず、`isSelected`・`hitTestHandle`・`hitTest`の呼び出しのみ。
        *   `handleMouseMove`（IDLE・選択モード）：`hit = #classifyPoint(world)`を1回計算し、`hit.bodyId`があれば`setHovered`、なければ`clearHovered`、`#updateCursor(hit)`。
        *   `handleMouseDown`：`getSelectedId()`による単一図形のハンドル判定を`#classifyPoint`へ置き換える。`hit.handle`が`'move'`なら`MOVING_SELECTION`、それ以外なら`DRAGGING_HANDLE`（`activeShapeId = hit.handle.shapeId`）。`#applyLeftDragUpdate`の`MOVING_SELECTION`分岐で`model.moveShapes(model.getSelectedIds(), dx, dy)`（ワールド座標の差分）と`lastCursor`更新を行う（`moveShape`呼び出しを削除）。本体押下による`MOVING_SELECTION`開始は本タスクでは行わない（タスク8）。
        *   `handleClick`（IDLE・選択モード）：`getHoveredId()`/`selectShape`/`getSelectedId`を廃し、2章 要件4のクリック表どおり（ハンドル→何もしない、本体→`setSelection([bodyId])`、空白→選択集合が空でなければ`clearSelection()`）。
        *   `handleKeyDown`：`getSelectedIds()`が空なら`return`、`Delete`/`Backspace`なら`preventDefault()`→`deleteShapes(getSelectedIds())`（`deleteShape`呼び出しを削除）。
        *   `#resolveCursor(point)`→`#resolveCursor(hit)`、`#updateCursor(point = null)`→`#updateCursor(hit = null)`へ変更し、2章 要件4の判定順（本タスク時点で(5)`MARQUEE_SELECTING`は未定義のため除く。(4)に`MOVING_SELECTION`を含める、(0b)の除外にも`MOVING_SELECTION`を含める）で実装する。全呼び出し元（引数なし呼び出しは`null`のまま）を追従させる。
        *   `setMode`の進行中操作の中断条件を「`state !== IDLE`」へ一般化する（`cancelDraft()`→IDLE）。
        *   完了時点でInputTrackerに`getSelectedId`/`selectShape`/`moveShape`/`deleteShape`の呼び出しが残っていないことをGrepで確認する。
        *   共通完了作業(a)〜(d)。
*   [x] タスク8: 本体ドラッグによる一括平行移動
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `handleMouseDown`の選択モード・IDLE・左ボタン判定で、`hit.handle`がなく`hit.bodyId`が選択集合内（`model.isSelected(hit.bodyId)`）の場合、`lastCursor`=押下点（ワールド）を記憶し`MOVING_SELECTION`へ遷移して、タスク6/7と同じハンドラ・オプションで`#drag.begin(...)`する。選択集合外の本体押下ではセッションを開始しない（現行どおり）。
        *   `#resolveCursor`の(8)（選択集合内の本体上→`move`）を有効にする（タスク7で実装済みの場合は確認のみ）。
        *   `handleMouseDown`のJSDocに押下時の分岐表（2章 要件4）を反映する。
        *   完了時点で、単一選択・複数選択（この時点では複数選択の手段がないため単一で確認）で本体ドラッグによる移動、動かさずに離した場合のクリック動作（その図形のみ選択）、移動直後に選択が外れないこと、パン・ズーム状態での移動量の一致を確認する。
        *   共通完了作業(a)〜(d)。
*   [x] タスク9: 範囲選択（マーキー選択）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `InputState`に`MARQUEE_SELECTING`（JSDoc「範囲選択を押下・ドラッグ中（閾値以前を含む）」）、privateフィールド`#marqueeAnchor`（`{x, y}|null`、JSDoc「範囲選択の押下点。ワールド座標。選択矩形の固定側の頂点」）を追加する。
        *   `handleMouseDown`の選択モード・IDLE・左ボタン判定で、`hit.handle`も`hit.bodyId`もない（空白）場合、`#marqueeAnchor`=押下点（ワールド）を記憶し`MARQUEE_SELECTING`へ遷移して`#drag.begin(...)`する（オプションは他の左ドラッグと同じ）。`onEnd`は`moved`なら`#commitMarquee(event)`、`onCancel`は`model.clearSelectionRect()`のみを行ってから`#finishLeftDrag()`を呼ぶ。
        *   `#applyLeftDragUpdate`の`MARQUEE_SELECTING`分岐：`cur = getWorldCoordinate(event)`、`model.setSelectionRect(anchor.x, anchor.y, cur.x, cur.y)`。
        *   `#commitMarquee(event)`：2章 要件2の確定手順（解放位置のワールド座標、**矩形の正規化はここ1箇所のみ**、`intersectsRect`のポリモーフィック呼び出し、`clearSelectionRect()`→`setSelection(ids)`）。JSDocに「矩形の正規化を行う唯一の箇所」と明記する。
        *   `#resolveCursor`に(5)`MARQUEE_SELECTING`→`default`を追加し、(0b)の除外に`MARQUEE_SELECTING`を含める。
        *   `#finishLeftDrag()`で`#marqueeAnchor = null`とする。`handleWheel`の追従（タスク6）が`MARQUEE_SELECTING`でも動作することを確認する。
        *   完了時点で、倍率・オフセットを変えた状態での範囲選択（矩形と図形の位置一致）、範囲選択中のホイールズーム、5種の図形（縮退した楕円・弧を含む）の選択、0件での全解除、フロートウィンドウ上/ブラウザ外での解放、blurでの破棄、範囲選択直後のclick抑止、複数選択後の本体ドラッグ・moveハンドルでの一括移動・頂点ハンドルでの1図形変形・一括削除を確認する。
        *   共通完了作業(a)〜(d)。
*   [x] タスク10: 旧単一選択APIの削除と`InputTracker`の整理
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `js/`配下を`selectShape|getSelectedId|moveShape\(|deleteShape\(|selectedId`でGrepし、呼び出し元（JSDoc・コメント上の言及を含む）が0件であることを確認したうえで、`VectorModel`の互換ラッパー`selectShape`/`getSelectedId`/`moveShape`/`deleteShape`を削除する。残存があれば先に新APIへ移行する。
        *   `InputTracker.js`を2章 要件8のセクション区切り（公開API／キャンバスイベントハンドラ／左ドラッグ／パン／当たり分類／座標取得／カーソル形状）でメソッド順を整理する（動作は変更しない）。クラスJSDoc（状態一覧「IDLE / DRAWING / DRAGGING_HANDLE」、パンのprivateフラグ記述）と先頭の責務JSDoc（3行以内。範囲選択・本体ドラッグを含む入力解釈である旨）を実態に合わせて更新する。
        *   共通完了作業(a)〜(d)。
*   [x] タスク11: JSDoc・責務定義の最終監査
    *   **対象ファイル** :
        *   `./js/main.js`、`./js/core/VectorModel.js`、`./js/core/InputTracker.js`、`./js/core/DragTracker.js`、`./js/core/CanvasManager.js`、`./js/shapes/Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js` : 確認（必要な場合のみJSDocを更新。ロジックは変更しない）
    *   **作業内容** :
        *   改修対象の全`.js`ファイルについて、先頭行の単一責務JSDoc（3行以内）が改修後の実態と一致していることを確認し、必要なら更新する。
        *   本作業で追加・変更したクラス・メソッド・フィールド・定数・typedefにJSDocがあること、座標を扱う引数・戻り値・プロパティにワールド座標／スクリーン座標の別が明記されていること、選択APIが単一（`id`）か選択集合（`ids`）か名称・JSDocで明確であることを確認する。
        *   用語「選択集合」「範囲選択（マーキー選択）」「選択矩形」「本体ドラッグ」の表記が統一されていること、`VectorModel.js`・`InputTracker.js`に「論理座標系」「作成中Line」「start/end/move」等の古い表記が残っていないことを確認する。
        *   `core/`層（`VectorModel`/`CanvasManager`/`InputTracker`/`DragTracker`）に図形種別のif/switch分岐、`CanvasManager`にインスタンス状態の追加がないこと、スクリーン⇔ワールド変換式が`ViewTransform`以外に書かれていないことをGrep等で確認する。
        *   本RESの「4. 詳細作業内容」へ記載し、気づいた点を「開発資料の更新予定」「5. 懸念事項・要確認ポイント」へ追記する。
*   [x] タスク12: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映（固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
    *   **作業内容** :
        *   本RESの「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」欄（各タスクでの追記分を含む）を確認し、資料へ反映する。本作業では`VectorModel.js`（選択集合・一括移動/削除API・選択矩形の保持）、`InputTracker.js`（5状態・範囲選択・本体ドラッグ・当たり分類・ドラッグ終了検知の統一・カーソル形状・一括削除）、新設`DragTracker.js`（1章フォルダ構造への追加と4章の新規エントリ）、`CanvasManager.js`（`render()`の引数変更・描画順・選択矩形の描画）、`main.js`（`renderCurrentState()`の引数構成）、`shapes/`（共通メソッド契約9→10メソッド、`intersectsRect`）の記述更新を必須とし、2章（データ構造：選択集合・選択矩形）・3章（描画・操作フロー：ドラッグのライフサイクルと範囲選択の流れ）にも追記する。
        *   ※ 実装AIによる開発資料の書き換えは本ワークフローにおいて原則禁止であるが、**この最終タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。個別の実装タスク内で資料を書き換えてはならない。
        *   本RESの「4. 詳細作業内容」へ反映内容を記載する。

---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 図形クラスへの交差判定メソッド追加（Line・Rect）
*   **作業内容** :
    *   `js/shapes/Line.js`：`hitTestHandle`の直後に公開メソッド`intersectsRect(minX, minY, maxX, maxY)`（線分`(x1, y1)-(x2, y2)`を1本判定）と、privateヘルパー`#segmentIntersectsRect(ax, ay, bx, by, minX, minY, maxX, maxY)`を追加した。
    *   `js/shapes/Rect.js`：`hitTest`の直後に`intersectsRect(minX, minY, maxX, maxY)`（4辺`[0,1],[1,2],[2,3],[3,0]`を`some`で判定。`hitTest`と同じ辺の組・同じ書き方）と、Lineと同一ロジックの`#segmentIntersectsRect(...)`を追加した。
    *   `#segmentIntersectsRect`は2章 要件2の手順どおりのLiang–Barsky法で実装した（`(p, q)`の4組を配列で走査、`p === 0`の組は`q < 0`なら`false`・それ以外は除算せず次の組へ、`p < 0`/`p > 0`で`t0`/`t1`を更新）。境界上は交差とみなす（比較はすべて非厳密側で`true`）。
    *   JSDoc：`intersectsRect`に「選択矩形に輪郭線（中心線。`strokeWidth`は含めない）の一部でも掛かるかを判定する範囲選択用の共通メソッド（共通メソッド契約の第10メソッド）。塗り内部は判定しない」、各引数に「ワールド座標。呼び出し側で正規化済み（min ≤ max）」、戻り値`boolean`を記載。ヘルパーに「線分（ワールド座標）と軸平行矩形（ワールド座標・正規化済み・境界含む）の交差判定。長さ0の線分は点の内包判定となる。契約メソッドではない内部ヘルパー」を記載し、全引数にワールド座標である旨を明記した。
    *   既存メソッドのロジック・JSDocは変更していない。呼び出し元はまだないため、アプリの挙動は不変。
    *   **動作確認**（Node.jsでES Modulesとして直接import、スクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：Line（矩形を横断・矩形内に内包・矩形外・矩形の角付近を斜めに外れる・境界線上に接する・長さ0の線分の内側/外側/境界上・辺に平行で外側）、Rect（選択矩形が矩形の内側に収まり辺に触れない＝`false`・辺に掛かる・全体を覆う・完全に外側・幅高さ0の選択矩形が辺上）の14ケースすべてが期待どおりであることを確認した。
    *   共通完了作業(a)：追加した2メソッド×2ファイルすべてにJSDocがあり、座標引数はすべて「ワールド座標」と明記済み。(c)：開発資料への影響は既存の「開発資料の更新予定」の`shapes/`項（9→10メソッド）に含まれるため追記なし。(d)：5章へ追記した。

### タスク2: 図形クラスへの交差判定メソッド追加（Curve・Ellipse）
*   **作業内容** :
    *   `js/shapes/Curve.js`：先頭の責務JSDocの直後（クラス定義の前）にモジュール定数`CURVE_INTERSECT_SEGMENTS = 100`（JSDoc「範囲選択の交差判定で用いる輪郭サンプリングの分割数。hitTestの100分割と同程度の計算量」）を追加。`hitTestHandle`の直後に公開メソッド`intersectsRect(minX, minY, maxX, maxY)`とprivateヘルパー`#segmentIntersectsRect(...)`（タスク1と同一コード・同一JSDoc）を追加した。
        *   `intersectsRect`：制御多角形`points[0..2]`の外接矩形（`Math.min`/`Math.max`）が判定矩形と重ならなければ`false`（早期棄却）。重なる場合は`hitTest`と同じ式で`B(t)`を`t = i / N`（`i = 0..N`）でサンプリングし（`i = 0`は`points[0]`そのもの）、隣接点を結ぶ`N`本の線分のいずれかが交差すれば`true`。
    *   `js/shapes/Ellipse.js`：同様にモジュール定数`ELLIPSE_INTERSECT_SEGMENTS = 100`を追加。`hitTest`の直後（当たり判定系メソッドの近く。クラス末尾）に`intersectsRect`と`#segmentIntersectsRect(...)`（タスク1と同一コード）を追加した。
        *   `intersectsRect`：`rx`/`ry`を`draw`と同じ式（`|points[1].x − xc|`／`|points[2].y − yc|`）で求め、外接矩形`[xc − rx, xc + rx] × [yc − ry, yc + ry]`で早期棄却。`θ = startAngle + (endAngle − startAngle) × i / N`で`(xc + rx·cosθ, yc + ry·sinθ)`をサンプリングし線分判定。`this.type`による分岐は追加していない（円・弧を`startAngle`/`endAngle`のみで同一処理）。
        *   JSDocに「縮退した楕円（rx/ryが0）でもサンプル点が線分状・点状に並ぶだけで0除算を起こさず、輪郭が掛かれば`true`」「弧は描画されている弧部分のみ（弦は含めない）」「折れ線近似のため真の輪郭とのずれ（最大で半径×(1−cos(π/N))程度）がある」を明記した。
    *   既存メソッドのロジック・JSDocは変更していない。呼び出し元はまだないため、アプリの挙動は不変。
    *   **動作確認**（Node.jsでES Modulesとして直接import、スクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：Curve（頂点付近に掛かる・制御多角形の内側だが曲線の外側＝`false`・曲線と弦の間の内部のみ＝`false`・始点に掛かる・外接矩形の外＝`false`・全体を覆う・長さ0の曲線の内側/外側）、Ellipse（円：右端/上端に掛かる・内側に収まり触れない＝`false`・外側＝`false`・外接矩形の角の隙間＝`false`／弧：描画側（下半分）に掛かる・空隙側（上半分）＝`false`・弦の位置のみ＝`false`／縮退：ry=0の線分状に掛かる/外れる・rx=ry=0の点状に掛かる/外れる）の20ケースすべてが期待どおりであることを確認した。
    *   共通完了作業(a)：追加した定数2・メソッド4すべてにJSDocがあり、座標引数はすべて「ワールド座標」と明記済み。(c)：開発資料への影響は既存の「開発資料の更新予定」の`shapes/`項（9→10メソッド、Curve/Ellipseはサンプリング近似）に含まれるため追記なし。(d)：5章へ追記した。

### タスク3: `VectorModel`の選択集合化・一括移動/削除・選択矩形の保持（旧APIは互換ラッパー化）
*   **作業内容** :
    *   `js/core/VectorModel.js`：`#selectedId`を`#selectedIds`（`Set<string>`。JSDoc「選択集合：選択中の図形idの集合（0個以上）。常に現存図形のidのみを含む」）へ置き換え、`#selectionRect`（`{x1, y1, x2, y2}|null`。ワールド座標の対角2点・正規化しない・描画用）を追加してコンストラクタで`new Set()`／`null`に初期化した。
    *   新API：`setSelection(ids)`（`#shapes`のidで現存確認し、現存idのみで新しい`Set`に置き換え・通知1回）、`clearSelection()`（`Set.clear()`・通知1回。現行どおり無条件）、`getSelectedIds()`（`#shapes`を`filter`→`map`して描画順の新しい配列を返す。内部`Set`は返さない）、`isSelected(id)`、`moveShapes(ids, dx, dy)`（`#shapes`を走査し対象に`translate`を委譲。1件以上移動時のみ通知1回）、`deleteShapes(ids)`（`filter`で残す図形を作り、件数が変わらなければ何もしない。削除したidを`#selectedIds`・`#hoveredId`から除去して通知1回）、`setSelectionRect(x1, y1, x2, y2)`（正規化せず保持・通知1回）、`clearSelectionRect()`（存在時のみ通知）、`getSelectionRect()`（スプレッドによるコピーまたは`null`）を実装した。`moveShapes`/`deleteShapes`は図形種別を意識せず、`translate`の委譲とidによる除去のみで実装している。
    *   旧API`selectShape(id)`→`setSelection([id])`、`getSelectedId()`→`getSelectedIds()[0] ?? null`、`moveShape(id, dx, dy)`→`moveShapes([id], dx, dy)`、`deleteShape(id)`→`deleteShapes([id])`の互換ラッパーに書き換え、JSDocに「【互換ラッパー】」と`@deprecated 選択集合API（…）へ移行中。Phase 02-03 タスク10で削除予定`を付した。各ラッパーは対応する新APIの直後（`selectShape`/`getSelectedId`は`isSelected`の直後）に配置した。呼び出し元（`main.js`・`InputTracker.js`）は変更していない。
    *   用語修正：`startDraft`/`updateDraft`/`updateVertex`/`moveShape`の`@param`の「論理座標系」→「ワールド座標」、`updateDraft`/`commitDraft`/`cancelDraft`の「作成中Line」→「作成中の図形」、`updateVertex`の`@param vertexIndex`→「各図形のgetVertexIndexForHandleの規約に従う頂点インデックス」。単一idを取る引数のJSDocには「（単一）」を付した。動作は変更していない。
    *   先頭の責務JSDocを「図形データ・選択集合・ホバー・作成中図形・選択矩形の状態管理（SSOT：Single Source of Truth）と更新通知を担う」（1行）へ更新した。
    *   **動作確認**（Node.jsでES Modulesとして直接import、スクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：`setSelection`の通知回数（1回）・存在しないidの除外・`getSelectedIds`の描画順と配列コピー・`isSelected`・`moveShapes`（対象なしは通知0回、対象ありは1回で座標変化）・`deleteShapes`（対象なしは通知0回、対象ありは1回で選択集合・ホバーを除去）・`setSelectionRect`の非正規化とコピー・`clearSelectionRect`（なしは通知0回、ありは1回）・`clearSelection`の通知・旧4APIの互換動作の16ケースすべてが期待どおりであることを確認した。
    *   共通完了作業(a)：追加・変更したフィールド・メソッドすべてにJSDocがあり、座標引数は「ワールド座標」と明記、選択APIは`id`（単一）／`ids`（集合）を名称・JSDocで区別した。(c)：開発資料への影響は既存の「開発資料の更新予定」の`VectorModel.js`項に含まれるため追記なし。(d)：5章へ追記した。

### タスク4: `CanvasManager.render()`の選択集合・選択矩形対応と`main.js`の追従
*   **作業内容** :
    *   `js/core/CanvasManager.js`：`render()`の引数を`{ hoveredId = null, selectedIds = [], draftLine = null, selectionRect = null, view = DEFAULT_VIEW } = {}`へ変更し、`selectedId`を廃止した。
    *   描画順を2章 要件3どおりに変更した：背景グリッド → (1)全図形の`draw`＋`hoveredId`一致図形の`drawHover` → (2)選択集合に含まれる図形の`drawHandles(ctx, view.scale)`を図形配列順に → (3)`draftLine.draw` → (4)選択矩形。所属判定は`render()`内ローカルの`new Set(selectedIds)`で行い、インスタンスフィールドは追加していない（`selectedSet.size === 0`の場合は2パス目の走査を省略）。
    *   モジュール定数`SELECTION_RECT_STROKE_COLOR = '#4a90e2'`／`SELECTION_RECT_FILL_COLOR = 'rgba(74, 144, 226, 0.08)'`／`SELECTION_RECT_LINE_WIDTH = 1`（スクリーンpx）／`SELECTION_RECT_DASH = Object.freeze([4, 3])`（スクリーンpx）を追加した（既存`DEFAULT_VIEW`に倣い配列は`freeze`）。
    *   private`#drawSelectionRect(rect, scale)`を追加した：`save()` → 線幅`SELECTION_RECT_LINE_WIDTH / scale`、`setLineDash(SELECTION_RECT_DASH.map(v => v / scale))`、線色・塗り色設定 → `beginPath()`→`rect(x1, y1, x2 − x1, y2 − y1)`→`fill()`→`stroke()` → `restore()`。正規化しない。`#drawGrid`と同じく`scale`が正の有限値でない場合は描画しないガードを入れた。
    *   `render()`のJSDocを更新（`state.selectedIds`：選択集合のid配列・0個以上、`state.selectionRect`：ワールド座標の対角2点・正規化不要、描画順と2パスの理由）。`hoveredId`には「（単一）」を付した。先頭の責務JSDocを「背景グリッド・選択矩形を含む」へ更新した。
    *   `js/main.js`：`renderCurrentState()`を`selectedIds: model.getSelectedIds()`、`selectionRect: model.getSelectionRect()`へ変更し、JSDocの「（shapes/selectedId/hoveredId/draftLine）」を「（shapes/selectedIds/hoveredId/draftLine/selectionRect）」へ修正した。再描画経路（3経路から同一関数）は変更していない。
    *   **動作確認**（Node.jsでES Modulesとして直接import、モックのcanvas/ctxを用いたスクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：3図形・`hoveredId=2`・`selectedIds=[3,1]`・draft・負の幅高さの選択矩形・`scale=2`で、呼び出し順が`draw1→draw2→hover2→draw3→handles1→handles3→draft→選択矩形`（ハンドルは引数の順ではなく図形配列順）、選択矩形の線幅`0.5`・破線`[2, 1.5]`・`rect(10, 10, -15, -10)`（非正規化のまま）であること、引数省略時に例外なくハンドル・矩形が描かれないことを確認した。
    *   `js/`配下を`selectedId\b|\.render\(`でGrepし、`render()`の呼び出し元は`main.js`のみ、`selectedId`引数の残存がないことを確認した（`InputTracker.js`内の`selectedId`はローカル変数名で、タスク7の移行対象）。
    *   共通完了作業(a)：追加した定数4・メソッド1、変更した`render()`にJSDocがあり、座標はワールド座標／スクリーンpxの別を明記、`selectedIds`は選択集合（配列）であることを名称・JSDocで明示した。(c)：開発資料への影響は既存の「開発資料の更新予定」の`CanvasManager.js`項・`main.js`項に含まれるため追記なし。(d)：5章へ追記した。

### タスク5: `DragTracker`の新設とパンの移設（純粋なリファクタリング）
*   **作業内容** :
    *   `js/core/DragTracker.js`（新規）：先頭に3行の責務JSDoc（2章 要件5の文言どおり）。typedef`DragHandlers`（`onStart`/`onMove(event, screen, prevScreen)`/`onEnd(event, moved)`/`onCancel`）・`DragSession`（`button`/`startScreen`/`lastScreen`/`threshold`/`suppressClick`/`moved`/`handlers`）を定義し、座標・閾値はすべて**スクリーン座標**と明記した。privateフィールド`#getScreenPoint`/`#session`/`#suppressNextClick`、公開API`begin`/`isActive`/`hasMoved`/`cancel`/`consumeSuppressedClick`/`clearSuppressedClick`、privateハンドラ`#handleWindowMouseMove`/`#handleWindowMouseUp`/`#handleWindowBlur`を実装した。
        *   コンストラクタで`window`へ`mousemove`/`mouseup`をcapture（第3引数`true`）、`blur`を購読（常設、セッション外は何もしない）。
        *   `begin`：セッション中なら`console.warn`して`false`。押下点のスクリーン座標を`startScreen`/`lastScreen`に記録し`true`を返す。
        *   追従：`lastScreen`は閾値以前も含め毎回更新。未移動の間は押下点からの`Math.hypot`距離が`threshold`を**超えた**時点で`moved = true`→`onStart()`→`onMove(...)`、以降は毎回`onMove(...)`。
        *   終了：`event.button === session.button`の場合のみ。セッションを先に`null`にし、`button === 0`かつ（`'always'`または`moved`）でclick抑止フラグを立ててから`onEnd(event, moved)`。
        *   中断：`cancel()`はセッションを破棄→click抑止フラグ解除→`onCancel()`（セッションなしなら何もしない）。`blur`は`cancel()`を呼ぶのみ。
        *   `buttons`による取りこぼし検知は計画どおり**未実装**（タスク6）。`InputTracker`・`VectorModel`・`ViewTransform`・canvasをimport/参照していない（import文なし）。
    *   `js/core/InputTracker.js`：
        *   `DragTracker`をimportし、`#panDrag`・`#suppressNextClick`・`#handleWindowMouseMove`・`#handleWindowMouseUp`・`#endPan`を廃止。`#isPanning`（boolean）と`#drag`（`DragTracker`）を追加し、コンストラクタで`new DragTracker((event) => this.getScreenCoordinate(event))`を生成。window capture `mousemove`/`mouseup`の購読を削除し、`blur`購読（`#handleWindowBlur`）は残してスペース押下解除とカーソル再評価のみを行うようにした。
        *   `#beginPan(event)`：`this.#drag.begin(event, { onMove: (e, screen, prev) => panBy(screen − prev), onEnd/onCancel: #finishPan }, { threshold: 0, suppressClick: 'always' })`。`#finishPan()`：`#isPanning = false`・カーソル再評価。
        *   `handleMouseDown`冒頭の抑止解除を`this.#drag.clearSuppressedClick()`へ、`handleClick`冒頭の抑止判定を`this.#drag.consumeSuppressedClick()`へ、`handleMouseMove`/`handleMouseDown`/`#resolveCursor`の`#panDrag !== null`を`#isPanning`へ置き換えた。`setMode`のパン終了は`if (this.#drag.isActive()) this.#drag.cancel();`へ置き換えた。
        *   `DRAGGING_HANDLE`中はパンを開始しない既存条件、ハンドルドラッグの処理（キャンバス`mouseup`購読・`handleMouseUp`含む）は変更していない。
        *   JSDoc修正：クラスJSDocの「#panDrag / #suppressNextClick」→「#isPanning / #isSpacePressed」＋DragTrackerへの委譲の説明、`setMode`・`handleMouseMove`・`handleMouseDown`・`handleClick`・`#beginPan`・`#handleWindowBlur`の説明を実態に合わせた。
    *   **動作確認**（Node.jsでES Modulesとして直接import、window/document/canvasをモックしたスクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：`node --check`で両ファイルの構文を確認。実`ViewTransform`を用いて、中ボタンパン（grabbingカーソル・オフセット変化・左ボタンmouseupでは終わらず中ボタンmouseupで終了・終了後のclickを抑止しない）、キャンバス移動モードの左パン（動かさなくても直後のclickを抑止）、図形作成モードでのスペース＋左パン（DRAWING維持・直後のclickで確定しない）、パン中のblur（パン終了・click抑止解除により次のclickで確定する）、パン中の`setMode`（パン終了・以後のmousemoveでパンしない）の13ケースすべてが期待どおりであることを確認した。フロートウィンドウ上/ブラウザ外での解放はwindow capture購読の構造が従来と同一であることで担保しており、実ブラウザでの確認は目視確認項目19・12で行うこと。
    *   共通完了作業(a)：`DragTracker`のクラス・全メソッド・全privateフィールド・typedefにJSDocがあり、スクリーン座標である旨を明記。`InputTracker`の追加フィールド・メソッドにJSDocを付した。(c)：開発資料への影響は既存の「開発資料の更新予定」の`DragTracker.js`項・`InputTracker.js`項・1章フォルダ構造に含まれるため追記なし。(d)：5章へ追記した。

### タスク6: ハンドルドラッグの`DragTracker`への移行（Phase 02-02由来の終了検知漏れの解消）
*   **作業内容** :
    *   `js/core/DragTracker.js`：
        *   モジュール定数`BUTTON_TO_BUTTONS_BIT`（`button`→`buttons`のビット対応表。左0→1・中1→4・右2→2）を追加した。
        *   `#handleWindowMouseMove`の冒頭（セッション確認の直後）に取りこぼし保険を追加した：`event.buttons`に開始ボタンのビットが含まれていなければ、そのmousemoveを解放とみなして終了処理を行い、`onMove`は呼ばない。
        *   終了処理を`#handleWindowMouseUp`から新設のprivate`#endSession(event)`へ切り出し、mouseup（開始ボタン一致時）とbuttons検知の両方から呼ぶようにした（処理内容：セッションを先に`null`→左ボタンかつ抑止条件でclick抑止フラグ→`onEnd(event, moved)`。従来と同一）。
        *   **JSDoc修正（ユーザー指示。ロジックは変更なし）**：`DragHandlers.onMove`の`prevScreen`を「直前のmousemove時点のカーソル位置。直前位置は閾値以前のmousemoveでも更新されるため、`threshold > 0`のセッションの初回は押下点ではなく閾値超過直前のmousemove位置（閾値以内のmousemoveがなかった場合のみ押下点。`threshold = 0`では初回は押下点）。累積移動量が必要なら呼び出し側で押下時点の座標を記憶すること」へ修正した。同じ誤解を招く`DragSession.lastScreen`の「（初回は押下時点）」も「初期値は押下点で、閾値以前のmousemoveでも毎回更新する」へ修正した。あわせて`onEnd`の`event`がbuttons検知時はmousemoveになる旨、クラスJSDocに取りこぼし保険の説明を追記した。
    *   `js/core/InputTracker.js`：
        *   モジュール定数`DRAG_START_THRESHOLD = 3`（JSDoc「クリックとドラッグを区別する移動量の閾値。スクリーン座標のCSSピクセル」）を追加した。
        *   `handleMouseDown`を計画の順に整理した：click抑止残留の解除 → 中ボタンなら`preventDefault()`し、セッション中でなければパン開始して`return` → セッション中なら`return` → 左ボタン＋（スペース or キャンバス移動モード）ならパン → `event.button !== 0`なら`return` → 選択モード・IDLEのハンドル判定。旧条件`state !== DRAGGING_HANDLE`・`#isPanning`による早期returnは「セッション中なら開始しない」へ一般化した。
        *   ハンドル押下時はprivate`#beginHandleDrag(event, shapeId, handle, point)`を呼ぶ。計画どおりのハンドラ（`onStart`→`#onLeftDragStart`、`onMove`→`#applyLeftDragUpdate`、`onEnd`/`onCancel`→`#finishLeftDrag`）とオプション（`threshold: DRAG_START_THRESHOLD`、`suppressClick: 'whenMoved'`）で`#drag.begin(...)`し、**成功した場合のみ**`activeHandle`/`activeShapeId`/`lastCursor`（押下点・ワールド座標）を記憶して`DRAGGING_HANDLE`へ遷移・カーソル更新する（タスク5の`#beginPan`と同じ順序）。
        *   `#onLeftDragStart()`（ホバークリア・カーソル更新）、`#applyLeftDragUpdate(event)`（InputStateで振り分け。本タスクでは`DRAGGING_HANDLE`のみ：moveハンドルは`lastCursor`との差分で`moveShape`、それ以外は`getVertexIndexForHandle`→`updateVertex`。対象図形が見つからない場合は何もしないガードを追加）、`#finishLeftDrag()`（IDLE復帰・`activeHandle`/`activeShapeId`/`lastCursor`を`null`・カーソル再評価）を追加した。
        *   左ドラッグ状態の判定をprivate`#isLeftDragState()`（現状`state === DRAGGING_HANDLE`のみ）に集約し、`handleWheel`の追従条件で使用した（タスク7・9で`MOVING_SELECTION`/`MARQUEE_SELECTING`を加える箇所を1箇所にするため）。
        *   `handleMouseMove`の`DRAGGING_HANDLE`分岐を削除し、冒頭を`if (this.#drag.isActive()) return;`へ変更した。キャンバス`mouseup`購読と`handleMouseUp`メソッドを削除した。
        *   `handleWheel`：`zoomAt`の後、`this.#drag.hasMoved() && this.#isLeftDragState()`なら`#applyLeftDragUpdate(event)`を呼ぶ。
        *   `handleKeyDown`：選択モード判定の直後に`this.state !== InputState.IDLE`なら`return`を追加した。
        *   `#resolveCursor`の(0b)（`DRAGGING_HANDLE`除外）は変更していない。
        *   新メソッド群は`handleWheel`の直後に区切りコメント「左ドラッグ（ハンドルドラッグ）」を設けて配置した（セクション整理の本格実施はタスク10）。
        *   JSDoc修正：`InputState`（DRAWING「作成中の図形の終点を…」、DRAGGING_HANDLE「選択中図形のハンドルを押下・ドラッグ中（閾値以前を含む…）」）、`activeHandle`の`@type`を`{string|null}`（各図形`hitTestHandle`の戻り値）へ、`lastCursor`の説明、クラスJSDoc・`#drag`の説明（パン・ハンドルドラッグがDragTrackerを利用）、コンストラクタのコメント、`setMode`・`handleMouseMove`（「作成中Line」→「作成中の図形」含む）・`handleMouseDown`（判定順の箇条書き）・`handleClick`（「作成中Line」→「作成中の図形」、ハンドルドラッグ後のclick抑止）・`handleWheel`・`handleKeyDown`の説明を実態に合わせた。
    *   **動作確認**（Node.jsでES Modulesとして直接import、window/document/canvasをモックし実`VectorModel`・`ViewTransform`を用いたスクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：`node --check`で両ファイルの構文を確認。直線のendハンドルで、閾値以内（2px）では頂点不変・キャンバスmousemoveは無視・閾値超過で頂点がカーソル位置へ、window captureのmouseupのみ（フロートウィンドウ上・ブラウザ外の解放相当）でIDLE復帰・作業用フィールドnull・直後のclickが抑止され選択が維持、右ボタン押下でドラッグ不開始、ドラッグ中の中ボタン押下でパン不開始・中ボタン解放で終わらずカーソル`move`維持、`buttons=0`のmousemoveで終了しその移動は反映されない、moveハンドルで差分移動・ドラッグ中のホイールズーム後の移動量がワールド換算で一致、ドラッグ中の`Delete`が無視される、blur・`setMode`で中断し以後追従しない、中ボタンパンの追従と`buttons`による終了、IDLE時の`Delete`で削除の24ケースすべてが期待どおりであることを確認した。
    *   共通完了作業(a)：追加した定数2・メソッド6（DragTracker 1、InputTracker 5）にJSDocがあり、閾値・`prevScreen`/`lastScreen`はスクリーン座標、`lastCursor`・`#beginHandleDrag`の`point`はワールド座標と明記、`#beginHandleDrag`の`shapeId`は単一である旨を明記した。(c)：開発資料への影響（キャンバスmouseup廃止・`buttons`による取りこぼし検知・閾値・ドラッグ中の削除不可・パン開始条件の一般化）は既存の「開発資料の更新予定」の`InputTracker.js`項・`DragTracker.js`項に含まれるため追記なし。(d)：5章へ追記した。

### タスク7: `InputTracker`の選択集合APIへの移行と当たり分類の共通化
*   **作業内容** :
    *   `js/core/InputTracker.js`：
        *   `InputState`に`MOVING_SELECTION`を追加した（JSDoc「選択集合の全図形を平行移動するドラッグを押下・ドラッグ中（moveハンドル・本体ドラッグ。閾値以前を含む）」）。あわせて`DRAGGING_HANDLE`の説明を「選択集合内の1図形の頂点ハンドルを押下・ドラッグ中」へ修正した。
        *   typedef`PointHit`（`handle: {shapeId, handle}|null`、`bodyId: string|null`、両方nullで空白）を`InputState`の直後に追加した。
        *   private`#classifyPoint(point)`（point：ワールド座標）を新設の区切りコメント「当たり分類」（`#getWorldHitTolerance`の直後）に追加した。ハンドルは選択集合の図形のみを図形配列の後ろ（前面）から`hitTestHandle`し最初の非nullを採用、本体は配列を先頭から1パスで走査し`hitTest`が真の最初の図形を記録しつつ選択集合の図形で真になった時点で採用・打ち切り。規則（前面優先がCanvasManagerの描画パス2の順序と一致する旨を含む）をJSDocに明記した。図形種別分岐はなく、`isSelected`・`hitTestHandle`・`hitTest`の呼び出しのみ。
        *   `handleMouseMove`（IDLE・選択モード）：`hit = #classifyPoint(world)`を1回計算し、`hit.bodyId`で`setHovered`/`clearHovered`、`#updateCursor(hit)`。
        *   `handleMouseDown`：`getSelectedId()`による単一図形のハンドル判定を`#classifyPoint`へ置き換えた。`hit.handle`がなければ`return`（本体押下による`MOVING_SELECTION`開始はタスク8）、`'move'`なら`MOVING_SELECTION`、それ以外は`DRAGGING_HANDLE`（`activeShapeId = hit.handle.shapeId`）。
        *   タスク6の`#beginHandleDrag(event, shapeId, handle, point)`を、両状態で共用する`#beginLeftDrag(event, nextState, point, target = null)`へ一般化した（`target`は`DRAGGING_HANDLE`の`{shapeId, handle}`。ハンドラ・オプション・「`begin`成功時のみ状態を記憶」の順序はタスク6と同一）。`MOVING_SELECTION`では`activeHandle`/`activeShapeId`は`null`のまま。タスク8の本体ドラッグもこのメソッドを`MOVING_SELECTION`で呼べばよい。
        *   `#applyLeftDragUpdate`：`#isLeftDragState()`で入口を判定し、`MOVING_SELECTION`分岐で`model.moveShapes(model.getSelectedIds(), dx, dy)`（ワールド座標の差分）と`lastCursor`更新、`DRAGGING_HANDLE`は頂点更新のみ（`moveShape`呼び出し・`activeHandle === 'move'`分岐を削除）。
        *   `#isLeftDragState()`に`MOVING_SELECTION`を追加した（`handleWheel`の追従・`#resolveCursor`の(0b)/(4)で使用）。
        *   `handleClick`（IDLE・選択モード）：`getHoveredId()`/`selectShape`/`getSelectedId`を廃し、クリック表どおり（ハンドル→何もしない、本体→`setSelection([bodyId])`、空白→`getSelectedIds().length > 0`なら`clearSelection()`）。
        *   `handleKeyDown`：`getSelectedIds()`が空なら`return`、`Delete`/`Backspace`なら`preventDefault()`→`deleteShapes(selectedIds)`。
        *   `#resolveCursor(point)`→`#resolveCursor(hit)`、`#updateCursor(point = null)`→`#updateCursor(hit = null)`へ変更した。判定順は2章 要件4から(5)`MARQUEE_SELECTING`を除いたもの（(0b)・(4)は`#isLeftDragState()`で`DRAGGING_HANDLE`/`MOVING_SELECTION`の両方を扱う。(8)選択集合内の本体上→`move`も実装済み）。JSDoc上の番号は(5)を詰めて(0a)〜(9)とした。引数なしの呼び出し元はすべて`null`のまま（変更不要）、座標付きの呼び出しは`handleMouseMove`の1箇所のみで`hit`を渡す。
        *   `setMode`の中断条件を`state !== IDLE`へ一般化した。
        *   JSDoc修正：`state`・`lastCursor`・`activeHandle`・`activeShapeId`の説明（MOVING_SELECTIONでの扱い）、`setMode`・`handleMouseMove`・`handleMouseDown`・`handleClick`・`handleKeyDown`・`handleWheel`・左ドラッグ区切りコメント・`#isLeftDragState`・`#applyLeftDragUpdate`の説明を実態に合わせた。クラスJSDocの状態一覧（「IDLE / DRAWING / DRAGGING_HANDLE」）は計画どおりタスク10で更新する（本タスクでは未修正）。
        *   `InputTracker.js`を`getSelectedId|selectShape|moveShape\(|deleteShape\(|getHoveredId|#beginHandleDrag`でGrepし、0件であることを確認した。
    *   `js/core/DragTracker.js`：本タスクの対象ファイルではなく変更していない。ユーザー指示の`DragHandlers.onMove`の`prevScreen`のJSDoc（「初回は押下時点」）はタスク6で既に実装の実態（threshold > 0のセッションの初回は閾値超過直前のmousemove位置）へ修正済みであることを本タスクで再確認した（`DragSession.lastScreen`も同様に修正済み）。追加の修正は不要と判断した。
    *   **動作確認**（Node.jsでES Modulesとして直接import、window/document/canvasをモックし実`VectorModel`・`ViewTransform`・図形クラスを用いたスクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：`node --check`で構文を確認。非選択図形のホバー（`pointer`）、本体クリックで単一選択、選択図形の本体上のカーソル`move`、別図形クリックでその図形のみ、空白クリックで全解除、複数選択（`setSelection`で作成）中のmoveハンドル押下で`MOVING_SELECTION`・閾値以内は不動・閾値超過で全図形が押下点からの差分だけ移動・終了後IDLEかつ選択維持（click抑止）、頂点ハンドルで`DRAGGING_HANDLE`（対象図形のみ変形・選択集合維持）、moveハンドル・円の中心ハンドルを動かさずクリックしても選択維持、ハンドル上のカーソル`move`、重なったハンドルは前面（配列の後ろ）の図形を採用、重なった本体のホバーは選択集合の図形を優先・選択なしなら配列の先頭、`Delete`で選択集合を一括削除し選択が空に、`MOVING_SELECTION`中の`Delete`は無視、`setMode`でIDLE復帰・選択クリア・以後追従しない、移動中のホイールズームで図形が跳ばず以後の移動量がワールド換算で一致、の23ケースすべてが期待どおりであることを確認した。
    *   共通完了作業(a)：追加した`InputState.MOVING_SELECTION`・typedef`PointHit`・`#classifyPoint`・`#beginLeftDrag`、変更したメソッドすべてにJSDocがあり、`point`はワールド座標、`shapeId`/`bodyId`は単一idと明記した。選択集合は`getSelectedIds()`/`moveShapes`/`deleteShapes`（`ids`）で扱い、単一APIは呼んでいない。(c)：開発資料への影響（当たり分類の共用・クリックの解釈・カーソル判定順・一括削除）は既存の「開発資料の更新予定」の`InputTracker.js`項に含まれるため追記なし。(d)：5章へ追記した。

### タスク8: 本体ドラッグによる一括平行移動
*   **作業内容** :
    *   `js/core/InputTracker.js`：
        *   `handleMouseDown`の選択モード・IDLE・左ボタン判定を、当たり分類の結果で分岐する形に整理した。`hit.handle`がある場合は従来どおり（`'move'`→`MOVING_SELECTION`、それ以外→`DRAGGING_HANDLE`）開始して`return`。`hit.handle`がなく`hit.bodyId`が選択集合内（`model.isSelected(hit.bodyId)`）の場合は、タスク7の`#beginLeftDrag(event, InputState.MOVING_SELECTION, point)`を呼ぶ（`lastCursor`=押下点（ワールド座標）の記憶、ハンドラ・オプション（`threshold: DRAG_START_THRESHOLD`、`suppressClick: 'whenMoved'`）はmoveハンドルと完全に同一）。選択集合外の本体・空白の押下ではセッションを開始しない（現行どおり）。
        *   `#resolveCursor`の(8)（選択集合内の本体上→`move`）はタスク7で実装済みであることを確認した（JSDoc上は(7)。判定順の番号はタスク9で2章の(0a)〜(10)へ戻す）。変更なし。
        *   JSDoc：`handleMouseDown`の(6)を2章 要件4の押下時の分岐表（ハンドル'move'／頂点ハンドル／本体が選択集合内／本体が選択集合外／空白）へ書き換えた（空白は「範囲選択は未実装」と記載。タスク9で更新）。`#drag`フィールドの説明に「本体ドラッグ」を、`handleClick`に「選択集合内の図形の本体上で（閾値以内で）離した場合はその図形のみの単一選択になる」旨を追記した。
    *   `js/core/DragTracker.js`：本タスクの対象ファイルではなく変更していない。ユーザー指示の`DragHandlers.onMove`の`prevScreen`のJSDoc（「初回は押下時点」）は、タスク6で既に実装の実態（`threshold > 0`のセッションの初回は閾値超過直前のmousemove位置。閾値以内のmousemoveがなかった場合のみ押下点）へ修正済みであることを本タスクで再確認した（`DragSession.lastScreen`も同様）。ロジック・JSDocとも追加の修正は不要と判断した。
    *   **動作確認**（Node.jsでES Modulesとして直接import、window/document/canvasをモックし実`VectorModel`・`ViewTransform`・図形クラスを用いたスクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：`node --check`で構文を確認。選択集合外の本体上のカーソル`pointer`・押下で状態遷移せずドラッグしても不動、選択集合内の本体上のカーソル`move`・押下で`MOVING_SELECTION`・`lastCursor`=押下点、閾値以内（2px）は不動、閾値超過時に押下点からの差分がまとめて反映、以降の移動は1回の変更通知で非選択図形は不動、window captureのmouseupでIDLE復帰・直後のclickが抑止され選択維持、複数選択（`setSelection`で作成）中に選択集合内の本体を動かさずに離すとその図形のみの単一選択、複数選択での本体ドラッグで全図形が同量移動・選択維持、倍率2倍＋オフセットありでスクリーン40,20pxの移動がワールド20,10に一致、本体ドラッグ中のホイールズームで図形が跳ばず以後の移動量が新倍率で一致、右ボタンで開始しない、`MOVING_SELECTION`中の`Delete`は無視、`setMode`で中断・以後追従しない、blurでIDLE復帰、の26ケースすべてが期待どおりであることを確認した。
    *   共通完了作業(a)：変更した`handleMouseDown`・`handleClick`・`#drag`のJSDocを実態に合わせ、押下点はワールド座標、`bodyId`は単一idであることを明記済み。選択集合は`isSelected`/`getSelectedIds()`/`moveShapes`で扱い、単一選択APIは呼んでいない。(c)：開発資料への影響（本体ドラッグ・押下時の分岐表）は既存の「開発資料の更新予定」の`InputTracker.js`項に含まれるため追記なし。(d)：5章へ追記した。

### タスク9: 範囲選択（マーキー選択）
*   **作業内容** :
    *   `js/core/InputTracker.js`：
        *   `InputState`に`MARQUEE_SELECTING`（JSDoc「範囲選択を押下・ドラッグ中（閾値以前を含む）」）を追加した。privateフィールド`#marqueeAnchor`（`{x, y}|null`。JSDoc「範囲選択の押下点。ワールド座標。選択矩形の固定側の頂点」＋Modelの選択矩形を読み返さない旨）を追加した。
        *   `handleMouseDown`：本体ドラッグの分岐に`return`を追加し、末尾に`hit.bodyId === null`（`hit.handle`は直前の分岐で`return`済みのため、空白）の場合に`#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point)`を呼ぶ分岐を追加した（選択集合外の本体押下では開始しない）。オプションは他の左ドラッグと同じ（`threshold: DRAG_START_THRESHOLD`、`suppressClick: 'whenMoved'`）。
        *   `#beginLeftDrag`：`onEnd`を`#onLeftDragEnd(e, moved)`、`onCancel`を`#onLeftDragCancel()`へ変更した（3状態で共用のまま）。`MARQUEE_SELECTING`では押下点を`#marqueeAnchor`に記憶し`lastCursor`は`null`、それ以外では従来どおり`lastCursor`=押下点・`#marqueeAnchor = null`。
        *   新設`#onLeftDragEnd(event, moved)`：`MARQUEE_SELECTING`かつ`moved`なら`#commitMarquee(event)`、その後`#finishLeftDrag()`。新設`#onLeftDragCancel()`：`MARQUEE_SELECTING`なら`model.clearSelectionRect()`のみ（選択集合は変更しない）、その後`#finishLeftDrag()`。他の左ドラッグ状態では従来の`#finishLeftDrag()`と同一の動作。
        *   `#applyLeftDragUpdate`に`MARQUEE_SELECTING`分岐を追加：`cur = getWorldCoordinate(event)`で`model.setSelectionRect(anchor.x, anchor.y, cur.x, cur.y)`（正規化しない）。
        *   新設`#commitMarquee(event)`：解放位置のワールド座標と`#marqueeAnchor`から`Math.min`/`Math.max`で正規化（JSDocに「矩形の正規化を行う唯一の箇所」と明記）→`model.getShapes().filter(s => s.intersectsRect(minX, minY, maxX, maxY)).map(s => s.id)`（ポリモーフィック呼び出しのみ）→`clearSelectionRect()`→`setSelection(ids)`。
        *   `#isLeftDragState()`に`MARQUEE_SELECTING`を追加した（`handleWheel`の追従・`#applyLeftDragUpdate`の入口・`#resolveCursor`の(0b)が同時に対応）。
        *   `#resolveCursor`：タスク7の追記の注意どおり、(4)を`DRAGGING_HANDLE`/`MOVING_SELECTION`の直接比較に戻し（`#isLeftDragState()`のままだと範囲選択中も`move`になるため）、その直後に(5)`MARQUEE_SELECTING`→`default`を追加した。JSDoc上の番号を2章 要件4の(0a)〜(10)へ戻した。
        *   `#finishLeftDrag()`で`#marqueeAnchor = null`とした。`handleWheel`のコードは変更していない（`#isLeftDragState()`の拡張により範囲選択中もズーム直後に矩形を伸ばし直す）。
        *   JSDoc修正：`state`・`lastCursor`・`activeHandle`・`activeShapeId`・`#drag`の説明（MARQUEE_SELECTINGでの扱い）、`setMode`（範囲選択は破棄して確定しない）、`handleMouseDown`の分岐表の空白行（「範囲選択は未実装」→`MARQUEE_SELECTING`）とパン判定が先行する旨、`handleKeyDown`・`handleWheel`・左ドラッグ区切りコメント・`#isLeftDragState`・`#beginLeftDrag`・`#applyLeftDragUpdate`・`#finishLeftDrag`。クラスJSDocの状態一覧は計画どおりタスク10で更新する（本タスクでは未修正）。
    *   **動作確認**（Node.jsでES Modulesとして直接import、window/document/canvasをモックし実`VectorModel`・`ViewTransform`・図形クラスを用いたスクラッチ上の使い捨てスクリプト。リポジトリには追加していない）：`node --check`で構文を確認。空白押下で`MARQUEE_SELECTING`・カーソル`default`、閾値以内では選択矩形なし、閾値超過で非正規化の選択矩形、解放で矩形破棄・輪郭の掛かった直線と矩形のみ選択（円は非選択）・直後のclick抑止、矩形の内側に収まる選択矩形は非選択、逆方向ドラッグ（正規化）で選択、0件の範囲選択で全解除、閾値以内の空白クリックで全解除、倍率2倍＋オフセットありで選択矩形がワールド座標、範囲選択中のホイールズームで押下点不変・矩形がホイール位置まで伸びる、ズーム後の確定、弧の空隙側は非選択・描画側は選択、曲線の始点付近で選択、縮退した楕円（ry=0）の選択と`Delete`での削除（例外なし）、`buttons`検知による確定（ブラウザ外解放相当）、blurで破棄・以後追従しない、範囲選択中は選択集合不変・`setMode`で破棄しIDLE、右ボタンで開始しない、中ボタン解放で終わらない、範囲選択中の`Delete`無視・スペース押下でもカーソル`default`、範囲選択で3図形を複数選択→moveハンドル・本体ドラッグで一括移動（選択維持）・頂点ハンドルで1図形の1頂点のみ変形（選択維持）・`Backspace`で一括削除、10図形の範囲選択確定で変更通知2回、選択集合外の本体押下では開始しない、の40項目すべてが期待どおりであることを確認した。フロートウィンドウ上での解放・選択矩形の見た目は実ブラウザでの目視確認項目1〜3・12で確認すること。
    *   共通完了作業(a)：追加した`InputState.MARQUEE_SELECTING`・`#marqueeAnchor`・`#onLeftDragEnd`・`#onLeftDragCancel`・`#commitMarquee`、変更したメソッドすべてにJSDocがあり、押下点・選択矩形・正規化後の矩形はワールド座標と明記した。選択集合は`setSelection(ids)`で置き換え、単一選択APIは呼んでいない。(c)：開発資料への影響（範囲選択の開始条件・確定手順・中断時の破棄・カーソル）は既存の「開発資料の更新予定」の`InputTracker.js`項に含まれるため追記なし。(d)：5章へ追記した。

### タスク10: 旧単一選択APIの削除と`InputTracker`の整理
*   **作業内容** :
    *   **旧APIの呼び出し元確認**：`js/`配下を`selectShape|getSelectedId\b|moveShape\(|deleteShape\(|selectedId\b`でGrepし、ヒットが`VectorModel.js`内の互換ラッパー定義4件（`selectShape`/`getSelectedId`/`moveShape`/`deleteShape`）のみで、呼び出し元（`main.js`・`InputTracker.js`・`CanvasManager.js`、JSDoc・コメント上の言及を含む）が0件であることを確認した。
    *   `js/core/VectorModel.js`：互換ラッパー`selectShape(id)`・`getSelectedId()`・`moveShape(id, dx, dy)`・`deleteShape(id)`をJSDocごと削除した。新API（`setSelection`/`clearSelection`/`getSelectedIds`/`isSelected`/`moveShapes`/`deleteShapes`/選択矩形API）・先頭の責務JSDoc（タスク3で更新済み）は変更していない。削除後に同じパターンに`互換ラッパー|deprecated`を加えて再Grepし、`js/`配下で0件であることを確認した。
    *   `js/core/InputTracker.js`（メソッド順の整理。ロジックは変更していない）：
        *   2章 要件8のセクション区切りで並べ替えた。最終的な順序：フィールド・コンストラクタ →「公開API（モード・図形種別）」（`setMode`/`setShapeType`/`getMode`/`getShapeType`）→「イベントハンドラ（キャンバス・document・windowの購読先）」（`handleMouseMove`/`handleMouseDown`/`handleClick`/`handleKeyDown`/`handleKeyUp`/`handleWheel`/`#handleWindowBlur`）→「左ドラッグ（ハンドルドラッグ・選択集合の平行移動・範囲選択）」（`#isLeftDragState`〜`#finishLeftDrag`、順序変更なし）→「パン」（`#beginPan`/`#finishPan`/`#handleSpaceKeyDown`）→「当たり分類」（`#classifyPoint`）→「座標取得」（`getScreenCoordinate`/`getWorldCoordinate`/`#getWorldHitTolerance`）→「カーソル形状」（`#resolveCursor`/`#updateCursor`）。
        *   並べ替えはメソッド単位（JSDoc付きブロック）の行範囲の移動のみで行い、移動前後で空行・区切りコメントを除く全行の集合が一致することをスクリプトで機械的に確認した（行の欠落・重複・改変なし）。
        *   区切り名の変更：計画の「キャンバスイベントハンドラ」は、`keydown`/`keyup`（document購読）・`blur`（window購読）のハンドラも同セクションに置くため「イベントハンドラ（キャンバス・document・windowの購読先）」とした。新設した区切りは「公開API（モード・図形種別）」「イベントハンドラ」「カーソル形状」の3つで、既存の「左ドラッグ」「パン」「座標取得」「当たり分類」の区切りコメントは文言を変えずに位置のみ移動した。
        *   先頭の責務JSDoc（2行）を「ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・一括削除・パン・ズーム）の解釈とModel・ビュー変換への反映、および入力状態に応じたキャンバスのカーソル形状のフィードバックを担う」へ更新した。
        *   クラスJSDoc：状態一覧を「IDLE / DRAWING / DRAGGING_HANDLE / MOVING_SELECTION / MARQUEE_SELECTING」へ、パンのprivateフラグ記述を「パン中：`#isPanning`、スペース押下中：`#isSpacePressed`」へ、DragTrackerへの委譲対象を「パンと左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）」へ、意味の解釈を「パン量、頂点変形・選択集合の平行移動・範囲選択のModel反映」へ更新し、当たり分類（`#classifyPoint`）を4箇所で共用する旨とセクション構成を追記した。
        *   `OperationMode`のJSDocの`SELECT`の説明（「ホバー判定・選択・ハンドルドラッグ・削除」）が実態と合わなくなっていたため、「ホバー判定・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・一括削除」へ更新した（計画の明記外だが同一ファイル内のJSDoc修正のみ）。
    *   **動作確認**：`node --check`で`VectorModel.js`・`InputTracker.js`の構文を確認（未定義のprivateメンバー参照もここで検出される）。Node.jsでES Modulesとして直接import（window/document/canvasをモック、実`VectorModel`・`ViewTransform`・図形クラスを使用。スクラッチ上の使い捨てスクリプトでリポジトリには追加していない）し、直線の作成→範囲選択で選択→本体ドラッグで移動（選択維持・IDLE復帰）→`Delete`で一括削除（選択空・カーソル`default`）、および`VectorModel`インスタンスに旧4APIが存在しないことを確認した。並べ替えは純粋な移動のため、詳細な挙動確認はタスク9までの確認結果と目視確認項目に委ねる。
    *   共通完了作業(a)：削除のみ・並べ替えのみのため新規のクラス・メソッドはなく、更新したJSDoc（責務定義・クラス・`OperationMode`）は選択集合／単一の別を名称で明示している。(c)：「開発資料の更新予定」へ追記した（`InputTracker.js`のセクション構成）。(d)：5章へ追記した。

### タスク11: JSDoc・責務定義の最終監査
*   **作業内容** :
    *   **先頭の責務JSDoc（3行以内）**：対象9ファイル（`main.js`・`VectorModel.js`・`InputTracker.js`・`DragTracker.js`・`CanvasManager.js`・`Line.js`・`Curve.js`・`Rect.js`・`Ellipse.js`）の先頭を確認し、すべて3行以内で改修後の実態と一致していることを確認した（`VectorModel`はタスク3、`CanvasManager`はタスク4、`InputTracker`はタスク10で更新済み、`DragTracker`は新規作成時の文言どおり）。`main.js`（「各モジュールの初期化と連携（依存性の注入）」）と図形4クラス（「データ保持・描画処理・当たり判定」。`intersectsRect`は当たり判定の一種として範囲内）は変更不要と判断した。
    *   **JSDocの有無・座標系の明記・単一/集合の区別**：本作業で追加・変更したクラス・メソッド・フィールド・定数・typedef（`VectorModel`の選択集合API・選択矩形API、`CanvasManager.render()`・`#drawSelectionRect`・`SELECTION_RECT_*`、`DragTracker`全体と`DragHandlers`/`DragSession`/`BUTTON_TO_BUTTONS_BIT`、`InputTracker`の`InputState`・`PointHit`・`DRAG_START_THRESHOLD`・`#marqueeAnchor`・左ドラッグ／当たり分類／カーソル形状の各メソッド、図形4クラスの`intersectsRect`・`#segmentIntersectsRect`・`*_INTERSECT_SEGMENTS`）を読み、すべてにJSDocがあること、座標を扱う引数・戻り値・プロパティにワールド座標／スクリーン座標の別が明記されていること、選択APIが`id`（単一。JSDocに「（単一）」）か`ids`（選択集合）かが名称・JSDocで区別されていることを確認した。
    *   **用語の統一・古い表記**：`js/`の対象ファイルを`論理座標|作成中Line|start/end/move|selectedId\b|selectShape|getSelectedId\b|moveShape\(|deleteShape\(|互換ラッパー|deprecated|#panDrag|handleMouseUp|線分本体`および表記ゆれ候補（`矩形選択|ラバーバンド|選択範囲|ドラッグ選択|範囲指定|選択状態`等）でGrepした。`VectorModel.js`・`InputTracker.js`に「論理座標系」「作成中Line」「start/end/move」の残存はなし。「範囲選択（マーキー選択）」「選択矩形」「本体ドラッグ」の表記ゆれはなし。以下を**JSDoc・コメントのみ**修正した（ロジックは変更していない）：
        *   `InputTracker.js`：`DRAG_START_THRESHOLD`の「左ドラッグ（ハンドルドラッグ等）」→「左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）」、`hitTolerance`の「線分本体のhitTest」→「図形本体のhitTest」（Line時代の表記）、`setMode`の「選択状態」2箇所・`setShapeType`の「選択状態」→「選択集合」、コンストラクタのblur購読コメントと`#handleWindowBlur`の「パン（状態）のドラッグの中断はDragTrackerが担う」→「ドラッグ（パン・左ドラッグ）の中断はDragTrackerが担う」（タスク6以降は左ドラッグもDragTrackerのblurで中断されるため）。
        *   `main.js`：リセットボタンのコメント「操作モード・選択状態には触れない」→「選択集合」。
        *   `CanvasManager.js`：`#pixelRatio`のJSDoc「図形データ・選択状態・ビュー変換状態は含まない」→「選択集合」。
        *   `DragTracker.js`の`#suppressNextClick`はDragTracker自身の正規のフィールド（InputTrackerからは廃止済み）であり問題なし。図形クラス既存メソッドの「論理座標系」は5章の既出事項どおり本REQの範囲外として修正していない（後述）。
    *   **アーキテクチャ制約のGrep確認**：
        *   `core/`層（`VectorModel`/`CanvasManager`/`InputTracker`/`DragTracker`）を`instanceof|\.type\b|switch|constructor\.name|'line'|'curve'|'arc'|'rect'|'circle'`でGrepし、図形種別のif/switch分岐がないことを確認した（ヒットは`SHAPE_TYPES`のホワイトリスト・`currentShapeType`の型注釈と初期値・`startDraft`の既定引数（`ShapeFactory`へ委譲）・`isTextInputElement`の`instanceof HTMLElement`のみで、いずれも図形種別による振る舞いの分岐ではない）。
        *   `CanvasManager`のインスタンス状態は`#pixelRatio`・`canvas`・`ctx`のみで、本作業による追加はない（選択集合の所属判定用`Set`は`render()`内のローカル変数）。
        *   `offsetX|offsetY|* scale|/ scale`でGrepし、スクリーン⇔ワールドの点の変換式が`ViewTransform`以外に書かれていないことを確認した（`CanvasManager`の`setTransform`による描画変換の合成・線幅/破線/グリッド間隔の`÷ scale`による画面上一定化、`InputTracker.getScreenCoordinate`のCSSズーム吸収は、いずれも既存設計どおりで変換式の重複ではない）。
    *   **動作確認**：`node --check`で`InputTracker.js`・`CanvasManager.js`・`main.js`の構文を確認した。変更はJSDoc・コメントの文言のみ（置換対象の文字列がコメント内に各1件のみ存在することをスクリプトでassertして置換）のため、挙動の変化はない。
    *   **開発資料への影響**：本タスクの修正はコメントの文言のみで、既存の「開発資料の更新予定」に追記すべき事項はない。

### タスク12: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映（固定タスク）
*   **作業内容** :
    *   本RES 2章「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」の全項目（タスク10での`InputTracker.js`追記分を含む）を確認し、`PROJECT_ARCHITECTURE.md`へ反映した。反映前に`js/core/`の`VectorModel`/`CanvasManager`/`InputTracker`/`DragTracker`の公開メソッド・定数のシグネチャをGrepし、更新予定の記述と実装が一致していることを確認した。
    *   **1. フォルダ構造**：`core/`に`DragTracker.js`を追加（`InputTracker.js`の直後）。
    *   **2. データ構造**：選択状態は選択集合（0個以上・現存図形のidのみ）であり、選択矩形（ワールド座標の対角2点・正規化しない）とともに`VectorModel`が保持する旨の段落を追加。
    *   **3. 描画・操作フロー**：入力監視の項に範囲選択・一括削除を追記し、サブ項目「ドラッグのライフサイクル」（`DragTracker`による一元管理と`InputTracker`による意味の解釈の分担、閾値のみスクリーン座標）と「範囲選択の流れ」（閾値超過→選択矩形の更新→解放時の正規化と`intersectsRect`による選択集合の置き換え→中断時は破棄のみ）を追加。
    *   **4. main.js**：`renderCurrentState()`が`selectedIds`・`selectionRect`・`view`等を`render()`へ渡す旨へ更新。リセットボタンの「選択状態には触れない」→「選択集合」（タスク11のコード側の表記修正に合わせた）。
    *   **4. VectorModel.js**：`#selectedId`→`#selectedIds`、`#selectionRect`を追加。API記述を選択集合API（`setSelection`/`clearSelection`/`getSelectedIds`/`isSelected`）・選択矩形API（`setSelectionRect`/`clearSelectionRect`/`getSelectionRect`）・`moveShapes`/`deleteShapes`（削除時の選択集合・ホバーからの除去、1操作1回の通知）へ更新し、`selectShape`/`getSelectedId`/`moveShape`/`deleteShape`の記述を削除。
    *   **4. CanvasManager.js**：`render()`の引数を`{ hoveredId, selectedIds, draftLine, selectionRect, view }`へ更新し、描画順（グリッド → 図形＋ホバー → 選択集合のハンドル（2パス）→ 作成中図形 → 選択矩形）、所属判定はローカルな`Set`でインスタンス状態を持たない旨、選択矩形の描画仕様（画面上1pxの破線＋薄い半透明塗り・最前面・描画側では正規化しない）を記載。
    *   **4. InputTracker.js**：冒頭の責務記述をタスク10で更新したファイル先頭の責務定義に合わせ、状態を5状態へ更新（各状態の扱い）。ポリモーフィック呼び出しに`intersectsRect`を追加。`setMode`の中断内容（ドラッグセッションの中断・範囲選択の破棄）、カーソル形状の一覧（2章 要件4の判定順の要約）、一括削除（IDLE時のみ・`deleteShapes`）を更新。サブ項目「当たり分類」（`#classifyPoint`の規則と4箇所での共用、クリックがホバー状態に依存しない）、「選択モードの左ボタン操作」（押下時の分岐、閾値`DRAG_START_THRESHOLD`、クリックの解釈、click抑止、押下点からの差分による移動量、ホイールズーム後の追従）、「DragTrackerの所有」（生成・所有、セッション1つ、click抑止の所有者、キャンバス`mouseup`非購読）を追加。「パン」の「`DRAGGING_HANDLE`中は開始しない」を「ドラッグセッション中は開始しない」へ、追従・終了を`DragTracker`への委譲へ更新。
    *   **4. DragTracker.js（新規エントリ）**：単一責務、公開API、閾値・座標はスクリーン座標、`threshold > 0`時の初回`prevScreen`の注意（タスク6のJSDoc修正内容）、開始ボタンの解放でのみ終了、`buttons`による取りこぼし検知、blur・`cancel()`による中断、click抑止は左ボタンのみ、依存方向を記載。
    *   **4. shapes/**：共通メソッド契約を9→10メソッドへ更新し、`intersectsRect(minX, minY, maxX, maxY)`の契約（ワールド座標・正規化済み・境界含む・輪郭の中心線で判定・塗り内部は対象外、Curve/Ellipseはサンプリング近似、弧は描画部分のみ）を追記。
    *   **残存確認**：`PROJECT_ARCHITECTURE.md`を`selectedId\b|selectShape|getSelectedId\b|moveShape\(|deleteShape\(|9メソッド|DRAGGING_HANDLE\`中は`でGrepし、旧記述の残存が0件であることを確認した。
    *   資料の章立て・他モジュール（`ViewTransform`/`ShapeFactory`/`WindowManager`/`PaletteController`/`io/`）の記述は変更していない。ソースコードは変更していない。

---

## 5. 懸念事項・要確認ポイント

### 計画時点の判断事項（意図的な挙動変化を含む）
* **ハンドルドラッグにも移動量閾値（3px）を適用する**：本体ドラッグ・範囲選択と挙動を統一し、「動かさずに離したら従来のクリック動作」「実際に動かした場合のみclick抑止」を一貫させるため。押下直後の3px以内では頂点が動かない（遊びが入る）。頂点ハンドルは閾値超過時にカーソル位置へ頂点が合わせられる（現行も押下位置とハンドル中心のずれは吸収せず頂点をカーソル位置に合わせる挙動であり、差は最大でも許容誤差5px程度）。
* **ハンドル上の「動かさないクリック」は選択を変更しない**：REQ要件2の「空白部分」の定義（ハンドル位置は空白ではない）に従う。現行はEllipse中心・Curve制御点のハンドルをクリックすると選択が外れていたが、これが解消される。複数選択中にLineのmoveハンドル（線上の中点）を動かさずクリックした場合も単一選択にはならず選択集合を維持する（本体部分のクリックは単一選択になる）。
* **ホバー表示の優先順位**：当たり分類の本体判定は「選択集合の図形を優先、同順位は図形配列の先頭」とし、ホバー表示もこれに揃える。選択集合の図形と非選択図形の輪郭が重なる位置でのみ、従来（配列の先頭）と異なる図形がホバー表示される（クリック結果・カーソル形状と一致させるため）。
* **ハンドルの描画順**：複数選択に対応するため、ハンドルは全図形の描画後にまとめて描く（2パス）。単一選択時も、選択図形より前面にある図形の上にハンドルが描かれるようになる。
* **選択集合外の図形の本体を押してドラッグ**：現行どおりセッションを開始しないため、離した位置で`click`が判定される（離した位置が空白なら全解除、別図形上ならその図形を選択）。REQの「現行どおりの挙動でよい」に従う。
* **範囲選択の確定時の変更通知は2回**（`clearSelectionRect`と`setSelection`）。図形数に比例しないためREQの「1操作につき図形数分発行しない」は満たすが、1回に統合したい場合は`VectorModel`に複合APIを追加する必要がある。
* **ドラッグ中の`Delete`/`Backspace`は受け付けない**（IDLE時のみ）。ドラッグ対象の消失による例外を防ぐため。
* **`setMode`中のパン終了**：現行は`#endPan()`によりclick抑止フラグを立てていたが、`cancel()`は抑止フラグを解除する。ボタン押下中にモードボタンはクリックできないため実害はない。
* **`#isPanning`の位置付け**：パンはDRAWINGと直交するためInputStateに含められず、パン中フラグはInputTrackerに残す。ドラッグセッション（ボタン・位置・閾値）は`DragTracker`が保持し、意味（パンかどうか）はInputTrackerが保持する分担であり、同じ事実の二重管理ではない。
* **交差判定ヘルパーの重複**：`#segmentIntersectsRect`を4ファイルに同一ロジックで持つ（`shapes/`への共通ユーティリティ新設は本REQのスコープ外）。将来修正する際は4ファイルを同時に直すこと。共通化する場合は別REQで`shapes/`配下のユーティリティ新設を検討する。
* **Curve/Ellipseの交差判定はサンプリング近似**：極端に細い選択矩形が、真の輪郭と折れ線近似の間（半径1000で約0.5ワールド単位）にだけ掛かる場合に判定がずれ得る。実用上は問題ない想定。
* **`InputTracker`の行数**：`DragTracker`へ一部を分離しても、範囲選択・本体ドラッグ・当たり分類の追加により行数は現状と同程度以上となる見込み。将来さらに分離する場合の候補は「選択モードのジェスチャー解釈（押下時分岐・クリック解釈・範囲選択の確定）」であるが、`InputState`の所有者が分散するため、分離時は状態の所有者設計を先に行うこと。
* **図形クラス内の古い用語**：`shapes/`配下の既存JSDocにも「論理座標系」の表記が残るが、本REQの変更範囲は交差判定メソッドの追加のみのため修正しない（別途の用語整理で対応）。
* **範囲外ファイルの変更**：`index.html`・`ViewTransform.js`・`ShapeFactory.js`・`WindowManager.js`・`PaletteController.js`の変更は不要と判断した。
* **テキスト選択の発生**：キャンバス上で押下してフロートウィンドウ上へドラッグした際、ブラウザのテキスト選択が発生する可能性がある（現行のパンでも同条件）。発生する場合、`mousedown`の`preventDefault()`はフォーカス移動を妨げ、Phase 02-04のテキスト入力中判定にも影響し得るため、本作業では対処せず目視確認の結果を記録する。

### タスク1 実施時の追記
* **ヘルパーの配置位置**：Lineは`hitTestHandle`の直後、Rectは既存ヘルパー`#distanceToSegment`を使う`hitTest`の直後に置いた（当たり判定系メソッドの近くにまとめるため）。タスク2のCurve/Ellipseでも同様の位置に置くと読みやすい。
* **境界の扱い**：選択矩形の辺にちょうど接する（接点1点のみ・辺上を重なって走る）場合も`true`となる。浮動小数点誤差により、理論上ちょうど境界に接する線分が微小量だけ外れて`false`になることはあり得るが、範囲選択の用途では実害はない想定。
* **将来の修正時の注意**：`#segmentIntersectsRect`はLine・Rect（タスク2以降でCurve・Ellipseも）に同一コードで重複している。判定ロジックを直す場合は全ファイルを同時に修正すること（既出の「交差判定ヘルパーの重複」を参照）。
* **目視確認**：本タスク時点では呼び出し元がなくUI上で確認できない。実動作の確認はタスク9完了後の目視確認項目4（直線・矩形の輪郭の一部のみを掛ける／矩形の内側にすっぽり収める）で行う。

### タスク2 実施時の追記
* **弧の描画側**：`startAngle = 0`、`endAngle = π`、Canvasは下向きがY正のため、`sinθ ≥ 0`となる**中心より下側の半分**が描画される弧であり、交差判定もこの下半分のみを対象とする（`draw`と同じパラメータ化による）。Node上の確認でも上半分（空隙側）に矩形を掛けた場合は`false`となった。目視確認項目5で、画面上の弧の向きと判定対象が一致することを確認すること。
* **`hitTest`との不一致（意図どおり）**：Ellipseの`hitTest`は`rx < 1 || ry < 1`で`false`を返すが、`intersectsRect`は縮退した楕円も判定する（2章 要件2の方針どおり）。クリックでは選べず範囲選択でのみ選べる状態になる。また`hitTest`は`strokeWidth / 2`を許容幅に含めるが、`intersectsRect`は中心線のみで判定するため、太い線の外縁にだけ矩形が掛かっても選択されない（Line・Rectと同じ）。
* **将来`startAngle`/`endAngle`が可変になった場合**：現在は固定値（0 と 2π／π）だが、`intersectsRect`は両者の差をそのまま分割するため、`endAngle < startAngle`（逆回り）や差が2πを超える値が入ると`ctx.ellipse`の`counterclockwise=false`時の解釈（終了角を開始角から時計回りに正規化）と一致しなくなる。弧の角度編集を実装する際は、`draw`の角度正規化と同じ規則をここにも適用すること。
* **ヘルパーの重複**：これで`#segmentIntersectsRect`は4ファイル（Line・Rect・Curve・Ellipse）に同一コードで存在する。修正時は4ファイル同時に直すこと（既出「交差判定ヘルパーの重複」参照）。
* **Curveの早期棄却**：外接矩形は制御点を含む制御多角形の外接矩形であり、曲線自体の外接矩形より大きい。棄却漏れ（無駄なサンプリング）はあり得るが、誤って`false`にすることはない。

### タスク3 実施時の追記
* **`selectShape`の微小な挙動変化**：旧実装は存在しないidでもそのまま`#selectedId`に設定していたが、互換ラッパーは`setSelection`経由のため現存しないidは無視される（不変条件の維持）。現行の呼び出し元（`InputTracker.handleClick`）はホバー中＝現存図形のidのみを渡すため、実害はない。
* **`getSelectedId()`の意味**：選択集合の先頭（描画順＝`#shapes`の並び順）を返す。タスク7で呼び出し元がなくなるまでの間は選択集合が最大1要素のため、従来と同じ値になる。
* **`getSelectedIds()`の計算量**：呼び出しごとに`#shapes`全体を走査する（O(図形数)）。`renderCurrentState()`から毎フレーム呼ばれる想定（タスク4）だが、描画自体が全図形を走査するため実用上問題ない。
* **`setSelection`の通知**：選択集合が実質的に変化しなくても通知する（計画どおり「1回」。`clearSelection`と同じく無条件）。範囲選択の確定時に冗長な再描画が1回起こり得るが、実害はない。
* **`#draftLine`という名称**：「作成中の図形」へJSDocを修正したが、フィールド名・`getDraftLine()`の名称はLine時代のまま（呼び出し元が`main.js`にあり本タスクの対象外のため変更していない）。将来の名称整理の候補。
* **目視確認**：本タスク時点では新APIの呼び出し元がなく、旧APIは互換ラッパー経由で従来どおり動作する。回帰確認として目視確認項目19の単一選択系（クリック選択・解除・頂点変形・moveハンドル移動・削除）を推奨する。

### タスク4 実施時の追記
* **見た目の変化（意図どおり）**：単一選択でも、選択図形より前面（配列の後ろ）にある図形の上にハンドルが描かれるようになった。また作成中の図形はハンドルより前面に描かれる（従来も最後に描画していたため変化なし）。目視確認項目19の単一選択系と併せ、重なった図形を選択した際のハンドルの見え方を確認すること。
* **選択矩形の描画は現時点で未発生**：`VectorModel.setSelectionRect`の呼び出し元はタスク9まで存在しないため、本タスク時点では選択矩形はUI上に現れない。描画仕様（画面上1pxの破線・薄い塗り・最前面）の目視確認は目視確認項目3（タスク9完了後）で行う。
* **`getSelectedIds()`の毎フレーム呼び出し**：タスク3の追記どおりO(図形数)の走査が再描画ごとに1回加わる。描画側でも`new Set(selectedIds)`を毎フレーム生成するが、いずれも図形数に線形で描画本体と同オーダーのため実用上問題ない想定。
* **将来の修正時の注意**：`render()`に新たな重ね描き要素を追加する場合、「ハンドル → 作成中の図形 → 選択矩形」の前後関係（選択矩形が常に最前面）を崩さないこと。ハンドルの前面優先の当たり判定（タスク7の`#classifyPoint`、図形配列の後ろから判定）は、この描画パス2の順序（図形配列順）と一致している前提である。

### タスク5 実施時の追記
* **`#beginPan`の処理順（計画からの微修正）**：計画では「`#isPanning = true`→ホバークリア→カーソル更新→`begin`」の順だったが、`begin`が`false`（セッション中）を返した場合に`#isPanning`が立ったまま残るのを避けるため、**先に`begin`を呼び、成功時のみ**フラグ・ホバー・カーソルを更新する順にした。`begin`内でコールバックは同期的に呼ばれないため、挙動は同一。
* **`cancel()`はセッションなしでは何もしない**：click抑止フラグの解除もセッション中の場合のみ行う（旧`#handleWindowBlur`がパン中のみ抑止フラグを解除していた挙動と一致）。`setMode`は`isActive()`を確認してから呼ぶ。
* **`lastScreen`の更新タイミング**：閾値以前も毎回更新するため、`threshold > 0`のセッションでは最初の`onMove`の`prevScreen`は押下点ではなく直前のmousemove位置になる（閾値分のスクリーン移動量は`onMove`の差分に含まれない）。パンは`threshold: 0`のため影響なし。タスク6以降の左ドラッグはワールド座標の`lastCursor`との差分で計算する計画のため問題ないが、将来`threshold > 0`でスクリーン差分を使う用途を追加する場合は注意すること。
* **blurリスナーの順序**：`DragTracker`の`blur`購読（パン中断）はInputTrackerの`blur`購読（スペース解除）より先に登録される。DragTracker側の`#finishPan`でカーソルが一時的に`grab`（スペース押下中のため）に評価され、直後にInputTracker側で再評価されるが、同期的に連続するため視覚的影響はない。
* **window capture購読の登録順**：`WindowManager`も`window`へcaptureで`mousemove`/`mouseup`を購読しているが、従来のInputTracker直下の購読と同じくInputTrackerのコンストラクタ内で登録されるため、登録順・到達順は従来と同一。
* **目視確認**：本タスクは純粋な移設のため、目視確認項目19のうちパン3通り（中ボタン・スペース＋左・キャンバス移動モード）、作成途中でのパン（DRAWING維持）、左パン後に誤選択/誤作成が起きないこと、およびパン中にフロートウィンドウ上・ブラウザ外で離した場合・タブ切替（blur）した場合に`grabbing`やパン追従が残留しないことを確認すること。

### タスク6 実施時の追記
* **`buttons`による取りこぼし検知の`onEnd`イベント**：mouseupを取りこぼした場合、`onEnd`にはmouseupではなく解放とみなしたmousemoveが渡る。そのmousemoveの位置への追従（`onMove`）は行わず、終了のみ行う（ボタンが離れた後の位置へ図形を動かさないため）。タスク9の`#commitMarquee(event)`はこのイベントの位置で確定することになるが、離した位置に近い（最初の非押下mousemove）ため実用上問題ない想定。
* **`buttons`検知でもclick抑止フラグが立つ**：終了処理を共通化したため、取りこぼし検知で終了した場合も左ボタンかつ移動済みなら抑止フラグが立つ。通常この場合はキャンバスへのclickが来ないため、フラグは次の`mousedown`冒頭の`clearSuppressedClick()`で解除される（残留による誤抑止はない）。
* **`buttons`を正しく報告しない環境**：`buttons`はモダンブラウザで標準だが、ボタン押下中なのに`buttons`が0のmousemoveを送る環境があると、ドラッグが即座に終了してしまう。目視確認項目12・19で、通常のドラッグ（ハンドル・パン3通り）が途中で切れないことを確認すること。
* **ドラッグ終了直後のカーソル**：`#finishLeftDrag`はカーソル位置不明（`null`）で再評価するため、ハンドル上で離した直後は一旦`default`になり、次のmousemoveで`move`/`pointer`へ戻る（旧実装はmouseup時にカーソルを更新せず`move`のまま残っていた）。一瞬の表示差のみで実害はない想定。
* **閾値以内で離した場合のclick**：抑止されず従来どおりホバー依存の選択/解除が行われる。ハンドル押下からonStartまではホバーをクリアしないため、押下前のホバー状態のまま判定される（円の中心・曲線の制御点ハンドルを動かさずクリックすると選択が外れる既知事象は計画どおりタスク7で解消）。
* **ドラッグ中のホイールズームでの追従**：ズームはカーソル下のワールド点を固定するため、ハンドルドラッグでは`#applyLeftDragUpdate`はほぼ同位置への再設定（moveハンドルは差分0）となり見た目の変化はない。範囲選択（タスク9）で意味を持つ処理である。
* **`#isLeftDragState()`の追加（計画外の小さなprivateヘルパー）**：`handleWheel`の「左ドラッグ状態なら」の判定に用いる。タスク7で`MOVING_SELECTION`、タスク9で`MARQUEE_SELECTING`をここへ追加すること。`#resolveCursor`の(0b)は計画の「維持」に従い`DRAGGING_HANDLE`の直接比較のまま残したため、タスク7・9で(0b)を拡張する際はこのヘルパーへの置き換えを検討するとよい。
* **`setMode`の中断条件**：`setMode`は先に`#drag.cancel()`→`#finishLeftDrag()`でIDLEにするため、ハンドルドラッグ中の`setMode`では既存の「`DRAWING`/`DRAGGING_HANDLE`なら`cancelDraft()`」分岐には入らない（ハンドルドラッグにドラフトはないため問題なし）。条件の一般化はタスク7で行う。
* **将来の修正時の注意**：`DragTracker`の`onMove`の`prevScreen`は、`threshold > 0`のセッションでは押下点からの差分ではない（JSDoc修正済み）。左ドラッグはワールド座標の`lastCursor`（押下点で初期化）との差分で移動量を計算しているため閾値分の移動量は失われない。スクリーン差分で左ドラッグを処理する用途を追加する場合は、押下点を呼び出し側で記憶すること。

### タスク7 実施時の追記
* **選択集合内の本体上のカーソルが先行して`move`になる（タスク8までの過渡状態）**：計画の判定順どおり(8)（選択集合内の本体上→`move`）を本タスクで実装したが、本体押下による`MOVING_SELECTION`開始はタスク8で実装するため、タスク7完了時点では「カーソルは`move`だがドラッグしても動かない」状態になる（離した後のclickで単一選択になる）。タスク8完了で解消する。タスク7単体での目視確認時はこの点を不具合と誤認しないこと。
* **カーソル判定順の番号**：2章 要件4の(5)`MARQUEE_SELECTING`は未定義のため、JSDoc上は詰めて(0a)〜(9)とした。タスク9で(4)の直後に`MARQUEE_SELECTING`→`default`を追加し、番号を2章の(0a)〜(10)へ戻すこと。(0b)・(4)の左ドラッグ状態判定は`#isLeftDragState()`へ置き換えたため、タスク9では`#isLeftDragState()`に`MARQUEE_SELECTING`を加えると(0b)・`handleWheel`の追従・`#applyLeftDragUpdate`の入口が同時に対応する。ただし(4)は`move`を返すため、(5)の`MARQUEE_SELECTING`判定を(4)より**前**に置くか、(4)を`DRAGGING_HANDLE`/`MOVING_SELECTION`の直接比較に戻す必要がある点に注意。
* **`#beginHandleDrag`→`#beginLeftDrag`への改名・一般化（計画外の小変更）**：moveハンドルと頂点ハンドルの両方から同じハンドラ・オプションで開始するため1メソッドに統合した。タスク9の範囲選択は`onEnd`/`onCancel`の処理が異なるため、このメソッドをそのまま使うか（`nextState`で`onEnd`の分岐を`#finishLeftDrag`前に入れる）別メソッドにするかはタスク9で判断すること。
* **ホバーの算出コスト**：`#classifyPoint`は選択集合の図形の`hitTestHandle`と全図形の`hitTest`を行う。mousemoveごとに1回（ホバーとカーソルで共用）であり、従来（`hitTest`の全走査＋選択図形の`hitTestHandle`）と同オーダー。ただし`isSelected`の呼び出しが図形数分加わる（`Set`参照のためO(1)）。
* **ハンドルの当たりが本体より優先される**：選択集合の図形のハンドルが別の図形の本体と重なる位置では、クリックしても別図形は選択されない（ハンドル→何もしない）。計画どおり（ハンドル位置は「空白」でも本体でもない）だが、目視確認項目10の際に、ハンドル付近の別図形をクリックしにくいと感じないか確認すること。
* **ドラッグ終了直後のホバー**：`handleClick`はホバー状態を参照しなくなったため、ドラッグ後の古いホバー状態はclickの結果に影響しない。ホバー表示自体は次のmousemoveで再評価される（従来どおり）。
* **`DragTracker.js`のJSDoc（ユーザー指示）**：`onMove`の`prevScreen`の記述はタスク6で修正済みで、本タスクでは対象外のため変更していない。今後`DragTracker`の閾値・`lastScreen`更新ロジックを変更する場合は、`DragHandlers.onMove`と`DragSession.lastScreen`の2箇所のJSDocを同時に見直すこと。

### タスク8 実施時の追記
* **タスク7の過渡状態の解消**：選択集合内の本体上でカーソルが`move`になるのにドラッグしても動かない状態（タスク7の追記参照）は本タスクで解消した。
* **本体ドラッグとハンドルの優先順位**：押下時はハンドル判定が本体判定より先に成立する。直線のmoveハンドル（中点）は本体上にもあるが、いずれも`MOVING_SELECTION`のため結果は同じ。頂点ハンドル（端点・矩形の角等）は本体と重なるが、押下すると頂点変形（`DRAGGING_HANDLE`）になり本体ドラッグにはならない。端点付近を掴んで図形全体を動かしたい場合は端点から許容誤差（画面上5px）以上離れた本体部分を掴む必要がある。目視確認項目8で操作感を確認すること。
* **選択集合外の図形を押してドラッグ**：計画どおりセッションを開始しないため、未選択図形を「押してそのまま動かす」ことはできない（1回クリックで選択してからドラッグする）。離した位置で`click`が判定されるため、未選択図形の上で押して空白で離すと全解除になる（現行どおり）。将来「押した図形を選択してそのまま移動」に変える場合は、押下時に`setSelection([bodyId])`してから`MOVING_SELECTION`を開始し、閾値以内で離した場合のclick結果（同じ単一選択）と矛盾しないことを確認すること。
* **選択集合外の本体と選択集合内の本体が重なる位置**：`#classifyPoint`は選択集合の図形を優先するため、重なる位置での押下は選択集合の本体ドラッグになる（カーソル`move`・ホバーとも一致）。
* **空白押下は現時点で何も開始しない**：範囲選択はタスク9で`handleMouseDown`の末尾（`bodyId`もない場合）に追加する。本タスクで`hit.handle`の分岐を`return`付きのブロックに整理したため、タスク9では末尾に`else`相当の空白分岐を足すだけでよい（選択集合外の本体押下で範囲選択を始めないよう、条件は「`hit.bodyId === null`」とすること）。
* **`DragTracker.js`のJSDoc（ユーザー指示）**：本タスクでも再確認のみで変更なし（タスク6で修正済み）。本体ドラッグもワールド座標の`lastCursor`（押下点で初期化）との差分で移動量を計算するため、`prevScreen`の初回値の仕様の影響は受けない。

### タスク9 実施時の追記
* **終了・中断ハンドラの分割（計画からの微修正）**：計画では範囲選択用に`onEnd`/`onCancel`を別にする記述だったが、`#beginLeftDrag`を3状態で共用したまま、`onEnd`→`#onLeftDragEnd`、`onCancel`→`#onLeftDragCancel`（いずれもInputStateで範囲選択の確定/破棄を振り分けてから`#finishLeftDrag`）とした。DragTrackerは`onEnd`/`onCancel`呼び出し時点でセッションを破棄済みだが、InputStateは`#finishLeftDrag`まで`MARQUEE_SELECTING`のまま残るため、この判定は正しく機能する。`#finishLeftDrag`を直接ハンドラに戻さないこと（範囲選択の確定・破棄が漏れる）。
* **`#resolveCursor`の(4)**：(4)は`#isLeftDragState()`ではなく`DRAGGING_HANDLE`/`MOVING_SELECTION`の直接比較とした（`#isLeftDragState()`に`MARQUEE_SELECTING`を含めたため）。将来左ドラッグ状態を追加する場合は、(0b)（`#isLeftDragState()`）と(4)/(5)のどちらに該当するかを個別に判断すること。
* **閾値以内の範囲選択の`onCancel`**：選択矩形は未設定のため`clearSelectionRect()`は通知しない（存在時のみ通知）。
* **`buttons`検知での確定位置**：タスク6の追記どおり、mouseupを取りこぼした場合は解放とみなしたmousemoveの位置で確定する。直前の`onMove`は呼ばれないため、表示されていた選択矩形と確定に用いる矩形が最後の1移動分ずれ得る（通常は数px以内）。
* **範囲選択中の変更通知**：mousemoveごとに`setSelectionRect`で1回通知（再描画1回）。確定時は2回（既出）。
* **選択集合外の本体と空白の境界**：本体判定は`hitTest`の許容誤差（画面上5px）を含むため、図形の輪郭から5px以内での押下は範囲選択にならない（何も開始せず、clickでその図形を選択）。密集した図形の近くから範囲選択を始めにくいと感じないか、目視確認項目1・7の際に確認すること。
* **範囲選択はキャンバス上の押下でのみ開始**：フロートウィンドウ上の押下はキャンバスへ届かないため開始しない（従来のドラッグと同じ）。

### タスク10 実施時の追記
* **旧APIの削除で外部からの呼び出しは壊れない**：`js/`配下に呼び出し元はない。ただし開発資料（`PROJECT_ARCHITECTURE.md`）の`VectorModel.js`・`CanvasManager.js`・`InputTracker.js`の項には現在も`selectShape`/`getSelectedId`/`moveShape`/`deleteShape`/`selectedId`の記述が残っている（タスク12で反映予定。既存の「開発資料の更新予定」に記載済み）。タスク12までの間に開発資料を参照して実装する場合は、これらが既に存在しないことに注意すること。
* **区切り名の微修正**：「キャンバスイベントハンドラ」→「イベントハンドラ（キャンバス・document・windowの購読先）」。`handleKeyUp`（旧位置：パンのセクション）と`#handleWindowBlur`（同）は購読ハンドラのためイベントハンドラのセクションへ移した。`#handleSpaceKeyDown`は`handleKeyDown`から委譲されるスペースパン専用処理のためパンのセクションに残した。`handleKeyUp`・`#handleWindowBlur`はスペース押下状態（パン用）しか扱わないため、パンのセクションに置く方が自然と考える場合は戻してもよい（動作には無関係）。
* **`#getWorldHitTolerance`の配置**：当たり分類からのみ使われるが、ワールド長への換算（`ViewTransform`への委譲）であるため「座標取得」に残した。計画の順序（当たり分類→座標取得）により、`#classifyPoint`から下方の`#getWorldHitTolerance`を参照する形になる（JSのメソッド定義順は動作に影響しない）。
* **将来の修正時の注意**：メソッドを追加する際は、クラスJSDoc末尾に記したセクション構成に従って該当区切りへ置くこと。新しい左ドラッグ状態を追加する場合は、タスク9の追記どおり`#isLeftDragState()`と`#resolveCursor`の(4)/(5)を個別に判断すること。
* **目視確認**：本タスクは削除（呼び出し元なし）と並べ替えのみのため、目視確認項目19（回帰）を一通り行えば十分と考える。

### タスク11 実施時の追記
* **図形クラスに残る「論理座標系」**：`Line`/`Curve`/`Rect`/`Ellipse`の既存メソッド（`hitTest`・`hitTestHandle`・`setVertex`・`updateDraftEnd`・`translate`）の`@param`には「論理座標系」「論理座標系のピクセル単位」の表記が残っている（Grepで約40箇所）。本REQでは図形クラスの変更を交差判定メソッドの追加に限定しているため修正していない。意味はワールド座標と同一であり、`core/`層・`intersectsRect`のJSDocは「ワールド座標」で統一済み。別REQで用語整理する際は、`tolerance`の「論理座標系のピクセル単位」を「ワールド座標の長さ（呼び出し側が画面上の許容誤差をワールド換算して渡す）」へ直すこと。
* **`#draftLine`/`getDraftLine()`/`render()`の`draftLine`引数の名称**：JSDocは「作成中の図形」で統一したが、識別子はLine時代の名称のまま（タスク3の追記どおり）。名称変更は`main.js`・`CanvasManager.js`・`VectorModel.js`を同時に変える必要があるため、別REQでの整理候補。
* **`isTextInputElement`のJSDoc**：「将来のDelete/Backspace等」「Phase 02-04で…再利用する想定」の記述は今後の計画に関する注記のため変更していない。Phase 02-04で一括削除（`handleKeyDown`）にテキスト入力中判定を加える際に更新すること。
* **「選択状態」という語**：選択集合そのものを指す箇所は「選択集合」へ統一したが、`VectorModel`の責務（「選択集合・ホバー…の状態管理」）のように一般的な「状態」の意味で使う箇所は残している。今後のJSDocでも、選択中の図形idの集合を指す場合は「選択集合」を用いること。
* **目視確認**：本タスクはコメントのみの変更のため、追加の目視確認は不要。

### タスク12 実施時の追記
* **記述の粒度**：開発資料冒頭の方針（内部アルゴリズムの詳細は書かない）に従い、Liang–Barsky法・カーソル判定順の番号・`#beginLeftDrag`等のprivateメソッド構成・`InputTracker`のセクション構成は資料に記載していない（タスク10の更新予定に「資料に内部構成を記す場合の参考」とあったが、索引としては不要と判断した）。例外として、外部から観測できる規則に直結する`#classifyPoint`（当たり分類の優先順位）のみ名前を挙げた。必要であれば追記してよい。
* **`InputTracker.js`の項の肥大化**：本Phaseの追記で同項が資料中で最も長くなった。将来`InputTracker`の再分離（5章「`InputTracker`の行数」参照）を行う際は、資料側もサブ項目（当たり分類・選択モードの左ボタン操作）を新クラスの項へ移すこと。
* **本REQの範囲外で資料に残る古い記述（未修正）**：3章2.「描画サイクル」の「`requestAnimationFrame`を用いた描画ループ」は、実装（3経路からの`renderCurrentState()`呼び出し。3章4.に記載）と一致していない可能性がある。また`WindowManager.js`・`PaletteController.js`の項の「選択状態には一切関与しない」は一般的な意味での表記で誤りではないため残した。いずれも本タスクの更新予定外のため修正していない。次回の資料整理で確認することを推奨する。
* **目視確認**：資料のみの変更のため、アプリの目視確認は不要。資料の記述内容（特に3章「範囲選択の流れ」と4章`InputTracker.js`のカーソル形状一覧）が意図どおりの仕様表現になっているか、発注者側での確認を推奨する。

### テストプレイでの目視確認項目
1. 倍率300%・オフセットを変えた状態で範囲選択し、選択矩形の位置がカーソルと一致し、掛かった図形のみが選択されること（倍率10%・1000%付近でも確認）。
2. 範囲選択中にホイールズームしても、押下点のワールド位置が動かず、矩形がカーソル位置まで正しく伸びること。
3. 選択矩形が画面上1px程度の破線で、図形・ハンドルより前面に表示され、ボタンを離すと消えること。
4. 5種の図形（直線・曲線・弧・矩形・円）それぞれについて、輪郭の一部だけを矩形に掛けると選択され、図形の内側に矩形がすっぽり収まり輪郭に触れない場合は選択されないこと。
5. 弧の描画されていない側（空隙部分）だけに矩形を掛けても選択されないこと。
6. 縮退した楕円（片方の半径をほぼ0にした円）を範囲選択して`Delete`で削除できること（コンソールにエラーが出ないこと）。
7. 何も掛からない範囲選択で選択がすべて解除されること。3px以内の空白クリックで従来どおり全解除されること。
8. 複数選択中に、選択集合内の図形の本体ドラッグ・moveハンドル（直線の中点・円の中心）ドラッグで全図形が一緒に移動し、移動量がカーソル移動量と一致すること（倍率を変えた状態でも）。
9. 複数選択中に頂点ハンドルをドラッグすると、その1図形の頂点のみ変形し、選択集合は変わらないこと。ハンドルが重なる場合は前面の図形のハンドルが優先されること。
10. 複数選択中に選択集合内の図形を動かさずクリックすると、その図形のみの単一選択になること。選択集合外の図形をクリックするとその図形のみが選択されること。
11. 複数選択中に`Delete`/`Backspace`で全図形が削除され、選択が空になること。削除後にホバー表示が残らないこと。
12. 複数選択中・範囲選択中・ハンドルドラッグ中・本体ドラッグ中に、カーソルをフロートウィンドウ上・ブラウザ外へ出してボタンを離しても、状態（ドラッグ追従・選択矩形）が残留しないこと。フロートウィンドウ上を通過中も追従が途切れないこと。
13. ドラッグ中にタブ切替（blur）した場合、範囲選択は確定されずに破棄され、戻った後に押していないのに図形が追従しないこと。
14. 右クリックでハンドル・図形本体・空白を押してもドラッグ・範囲選択が始まらないこと。左ドラッグ中に中ボタンを押して離してもドラッグが終わらないこと。
15. ハンドルドラッグ直後・本体ドラッグ直後・範囲選択直後に選択が外れないこと（特に円の中心ハンドル・曲線の制御点ハンドル）。
16. 円の中心ハンドル・曲線の制御点ハンドルを動かさずにクリックしても選択が外れないこと。
17. カーソル形状：選択集合内の図形の本体上・ハンドル上・ドラッグ中は`move`、選択集合外の図形上は`pointer`、範囲選択中は`default`であること。スペース押下中は`grab`（左ドラッグ中を除く）。
18. 操作モード切替で選択集合がすべてクリアされること。
19. 回帰：単一選択でのクリック選択・選択解除・頂点変形・moveハンドル移動・削除、図形作成5種（作成中のパン・ズームを含む）、パン3通り（中ボタン・スペース＋左・キャンバス移動モード、左パン後に誤選択/誤作成が起きないこと）、ズーム、倍率表示・リセットが従来どおりであること。
20. キャンバスからフロートウィンドウ上へドラッグした際にページのテキスト選択が発生しないか（発生した場合は記録）。
