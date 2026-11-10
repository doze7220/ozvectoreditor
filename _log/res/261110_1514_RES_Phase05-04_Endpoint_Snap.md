# RES: 作業計画・作業レポート (Phase 05-04) : 端点へのスナップと描き足し
* 参照元REQ: `./_log/req/261110_1430_REQ_Phase05-04_Endpoint_Snap.md`

## 1. 作業目的
直線を描くとき、および選択モードで線の端点のハンドルをドラッグするときに、結合できる線（直線・開いたパス）の端点へ吸い付くようにし、吸い付いた端点で描き足し・結合・閉じる操作を行えるようにする。吸い付いている端点には、中を青で塗った正方形を表示する。

* 結果の組み立ては Phase 05-03 の結合の規則（`js/shapes/PathJoinRules.js`）を使い回し、同じ規則を別の場所に書き直さない。端点を指定してつなぐ入口・描き足しの入口・吸い付いた端点での操作の計画を`PathJoinRules`に足す。
* 吸い付きの規則（対象・距離・候補の選び方）は`shapes/`の新設ファイル`EndpointSnapRules.js`に、照会と反映の手順は`edit/`の新設クラス`EndpointSnapper`に置く（05-03の`PathJoinRules`（規則）・`PathJoiner`（手順）の分け方に倣う）。
* `InputTracker`には、入力の場面で注入された`EndpointSnapper`を**呼び出す**最小限の配線だけを足す。吸い付きの表示の状態は`VectorModel`に置き、既存の経路（`model.onChange`→`renderCurrentState`→`CanvasManager.render`）で描く。
* 既存の振る舞い（端点から離れた位置で描いた直線、直線以外の図形の作成、選択・移動・端点以外のハンドル操作・削除・複製・貼り付け・結合ボタンとキー`J`・Undo/Redo・保存/読み込み/書き出し、キー割り当て・ボタン、ハンドルの当たり判定と優先順位）は変えない。図形クラス・`ShapeFactory`・`io/`は変更しない。

計画時点の`node --test`：tests 563 / pass 563 / fail 0。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
```text
main.js ──生成・注入──▶ edit/EndpointSnapper ──import──▶ shapes/EndpointSnapRules ──import──▶ shapes/PathJoinRules ──import──▶ shapes/Path
   │                         │                    └──────────import──────────▶ shapes/PathJoinRules
   │                         └─注入で受け取る─▶ VectorModel（getShapes・getDraftShape・cancelDraft・replaceShape）
   │                                          editRecorder（実体 HistoryManager）・screenLengthToWorld（実体 viewTransform）
   └──生成（第5引数に endpointSnapper を注入）──▶ core/InputTracker ──呼ぶだけ──▶ EndpointSnapAssist（typedef。実体 EndpointSnapper）
                                                         └──▶ VectorModel.setSnapPoint / clearSnapPoint（吸い付きの表示の点）
main.js の renderCurrentState ── model.getSnapPoint() ──▶ CanvasManager.render({ ..., snapPoint })
```
* 依存方向`main.js → edit → io → core → shapes`は保つ。`core/InputTracker`は`edit/`をimportせず、`main.js`が注入したオブジェクトのメソッドを呼ぶだけ（`editRecorder`と同じ形）。`shapes/`は`core/`をimportしない。
* `edit/EndpointSnapper`は`shapes/EndpointSnapRules`と`shapes/PathJoinRules`をimportする（`edit/PathJoiner`と同じ「`edit/`が`shapes/`の規則をimportする」例外。開発資料に例外として書く）。
* `shapes/EndpointSnapRules`は`./PathJoinRules.js`だけをimportする（`isJoinableLine`・`canCloseByMergingEnds`を使い回す）。`PathJoinRules`は従来どおり`./Path.js`だけをimportする（循環しない）。

### 要件1: 吸い付く対象・距離・候補の選び方
規則は新設`js/shapes/EndpointSnapRules.js`（図形クラスではない。`PathJoinRules`と同じ「図形をまたぐ規則」の種類。状態を持たない`export`の関数と定数のみ）に置く。

* **公開するもの**：
    *   `SNAP_TOLERANCE_SCREEN_PX = 8`：吸い付く距離（画面上のpx）。唯一の定義箇所。`PathJoinRules.JOIN_TOLERANCE_SCREEN_PX`（5px。端点の重なりの判定）とは別の定数として扱う（どちらを変えても他方は変わらない）。ワールドへの換算は呼び出し側（`EndpointSnapper`）が行う。
    *   typedef`SnapTarget`：`{ shapeId, end: 'start'|'end', x, y }`。吸い付いた端点（`shapeId`は図形の`id`を不透明に読み写した値、`x`・`y`は端点のワールド座標）。`PathJoinRules`のtypedef`EndpointRef`（`{ shapeId, end }`）を満たす（そのまま計画の関数へ渡せる）。
    *   `isSnapDrawShapeType(shapeType)`：描く図形種別が吸い付く種別か（`shapeType === 'line'`のときだけ真）。「直線を描くときだけ吸い付く」の規則の唯一の定義箇所。
    *   `resolveEndpointHandle(shape, handleName)`：ハンドルが結合できる線の端点のハンドルなら`'start'`/`'end'`、それ以外は`null`。`isJoinableLine(shape)`が偽なら`null`。`shape.getVertexIndexForHandle(handleName)`の番号が`0`なら`'start'`、`shape.toJSON().points.length - 1`なら`'end'`、それ以外（途中の頂点・`null`）は`null`（直線`'start'`→0・`'end'`→1、パス`'vertex-0'`→始点・`'vertex-<n-1>'`→終点、直線の`'move'`は`null`）。「頂点の番号`i`＝図形データの`points[i]`」（開発資料2章「`points`の並びは各図形クラスの頂点の並びと同じ」）に依る。
    *   `findSnapTarget(shapes, point, tolerance, dragged = null)`：吸い付く端点を1つ選ぶ。戻り値は`SnapTarget`か`null`。
* **対象**：`shapes`の図形のうち`isJoinableLine`が真（直線・開いたパス）のものの始点・終点（`toJSON().points`の先頭・末尾）だけ。曲線・矩形・円・弧・閉じたパスの点、パスの途中の頂点は対象にしない。
* **距離**：`Math.hypot`の距離が`tolerance`以下（ちょうどを含む）。`tolerance`はワールド座標の長さで受け取る（表示倍率を知らない）。
* **候補の選び方**：図形を`shapes`の末尾（前面）から先頭へ、各図形は始点→終点の順に調べ、距離が**厳密に小さい**ときだけ更新する。これで「いちばん近い端点／同距離なら前面の図形／同じ図形の始点と終点が同距離なら始点」になる。
* **ハンドルのドラッグでの除外**（`dragged`＝`{ shapeId, end }`を渡したときだけ）：`dragged.shapeId`の図形について、`dragged.end`の端点は対象にしない。もう一方の端点は`canCloseByMergingEnds(shape)`（`PathJoinRules`。要件5）が真のときだけ対象にする。他の図形は通常どおり。
* **吸い付いたときの座標**：`SnapTarget`の`x`・`y`（端点の座標そのもの）を、描き始め・描き終え・ドラッグ中の頂点の座標に使う（`InputTracker`が`x`・`y`だけを読む）。
* 読むもの：図形の`type`（`isJoinableLine`経由）・`id`・`toJSON()`・`getVertexIndexForHandle`。図形クラスの内部プロパティを読まない。表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モードを知らない。`try/catch`を持たない。引数の図形を書き換えない。
* 修飾キーによる一時無効は作らない。

### 要件2: 吸い付いている表示
* **状態の置き場所**：`VectorModel`に`#snapPoint`（`{x, y}`か`null`。ワールド座標）を足す（ホバー・選択矩形と同じく表示専用の状態。図形種別を関知しない）。公開操作：
    *   `setSnapPoint(x, y)`：値が変わったときだけ設定して通知（1回）。同じ座標なら何もしない（mousemoveごとの無駄な再描画を避ける）。
    *   `clearSnapPoint()`：`null`でなかったときだけ`null`にして通知（1回）。`clearSelectionRect`と同じ形。
    *   `getSnapPoint()`：コピー（`{x, y}`）か`null`。
    *   `replaceAllShapes`の(5)のクリア対象に`#snapPoint`を足す（キャンバスの切り替え・読み込み・取り消し/やり直し・`?dev`の復元で消える。通知は従来どおり1回）。
* **描画への渡し方**：`main.js`の`renderCurrentState()`が`snapPoint: model.getSnapPoint()`を`CanvasManager.render`へ渡す。再描画は既存の`model.onChange`経路のみ（機能専用の経路を足さない）。
* **描画（`CanvasManager`）**：`render`の引数に`snapPoint = null`を足し、非`null`なら作成中の図形の後・選択矩形の前に`#drawSnapIndicator(point, view.scale)`で描く（選択矩形は従来どおり最前面。選択矩形と吸い付きの表示は同時に出ない：範囲選択は選択モードの空白ドラッグ、吸い付きは作成モードと端点のハンドルのドラッグ）。
    *   画面上8pxの正方形（中心が端点）を、塗り`#4a90e2`（選択ハンドルの枠と同じ色）・枠`#1f4e8c`（濃い青）・枠の太さ画面上1.5px（選択ハンドルと同じ太さ）で描く（**枠の色・太さは計画時の決定**：白塗りの選択ハンドルと塗りで見分けられ、白い背景でも見た目の大きさが選択ハンドルと同じになるよう、枠を白でなく濃い青にした）。大きさ・太さは`÷ view.scale`で画面上一定。`save()`/`restore()`で後続へ残さない。倍率が正の有限値でなければ描かない（`#drawSelectionRect`と同じ防御）。
    *   定数（`SNAP_INDICATOR_SIZE = 8`・`SNAP_INDICATOR_FILL_COLOR`・`SNAP_INDICATOR_STROKE_COLOR`・`SNAP_INDICATOR_LINE_WIDTH = 1.5`）は`CanvasManager.js`に置く（表示の大きさであり、吸い付く距離`SNAP_TOLERANCE_SCREEN_PX`とは別の意味の値）。
    *   `CanvasManager`は状態を判定しない（渡された点を描くだけ）。
* **表示する場面と設定・消去の箇所**（`InputTracker`が`#showSnap(snap)`＝`snap`があれば`setSnapPoint(snap.x, snap.y)`、なければ`clearSnapPoint()`を呼ぶ）：
    *   (a) 図形作成モード・IDLEのmousemove：描く図形種別で照会した結果を表示（直線以外の種別では照会結果が常に`null`のため表示されない）。
    *   (b) DRAWINGのmousemove：描き終えの候補を表示。
    *   (c) 端点のハンドルのドラッグの更新（閾値超過後の`#applyLeftDragUpdate`。ドラッグ中のホイールも含む）。
    *   選択モードのIDLEのmousemove・キャンバス移動モード・パン中（ドラッグ中はmousemoveが早期returnする）では設定しない。
* **消し忘れ防止**（`InputTracker`の`#resetSnapState()`＝吸い付きの作業用フィールドを`null`にして`model.clearSnapPoint()`）：
    *   描き終え（`handleClick`のDRAWING確定の後）・描き途中の取り消し（`cancelDraftOrClearSelection`のDRAWING）・図形種別の切り替え（`setShapeType`。描いていなくても常に）・`#abortOngoingOperation()`（＝`setMode`のモード切り替え・`abortOngoingOperation()`を通る取り消し/やり直しの前処理・`?dev`の復元。何も進行していなくても常に消す。戻り値`aborted`には影響させない）・左ドラッグの終了と中断の共通後始末（`#finishLeftDrag()`）。
    *   パンの開始（`#beginPan`）では表示だけを消す（`model.clearSnapPoint()`。DRAWINGの`#drawEndSnap`は作成途中の図形の終点と対応させるため残す。5章）。
    *   キャンバスの切り替え・読み込み（`prepareSwitch`→`applyMode`→`setMode`）、インポート（`prepareInsert`→`setMode`）、貼り付け（選択モードへの`applyMode`）、取り消し/やり直し（`replaceAllShapes`）も上記で消える。
    *   **キャンバス外へカーソルが出た場合**（計画時の決定）：何もしない（`mouseleave`を購読しない）。表示は次にキャンバス上でmousemoveしたときに正しくなる（選択モードのホバー表示が残るのと同じ扱い）。

### 要件3: 直線を描くときの振る舞い（描き足し・結合・閉じる）
* **吸い付く条件**：図形作成モードで、`EndpointSnapper.findDrawSnap(shapeType, point)`が`isSnapDrawShapeType(shapeType)`の偽のとき`null`を返す（曲線・矩形・円・弧は吸い付かない）。`InputTracker`は`currentShapeType`を不透明な文字列として渡すだけで分岐しない。
* **描き始め**（`handleClick`のIDLE・図形作成モード）：クリック位置で照会し（クリックの解釈はホバー状態を参照しない原則に従い、クリック位置で取り直す）、吸い付いていれば端点の座標、いなければクリック位置で`startDraft`する。照会結果を`#drawStartSnap`に保持し、表示も合わせる。
* **描いている途中**（`handleMouseMove`のDRAWING）：カーソル位置で照会し、結果を`#drawEndSnap`に保持・表示し、作成途中の直線の終点を「吸い付いていれば端点の座標、いなければカーソル位置」へ`updateDraft`する（描いている途中の見た目は吸い付いた端点まで伸びる）。
* **描き終え**（`handleClick`のDRAWING）：`EndpointSnapper.commitDrawnLine(#drawStartSnap, #drawEndSnap)`を呼ぶ。`false`（両方`null`）なら従来どおり`beginEdit`→`commitDraft`→`commitEdit`（既存の振る舞いを変えない）。その後IDLEへ戻し`#resetSnapState()`。
    *   描き終えの端点は**直前のmousemoveの照会結果**を使う（従来も作成途中の図形の終点は直前のmousemoveの位置で、クリック位置で取り直していない。吸い付きの判定を終点の座標と対応させ、表示どおりの結果にするため）。
* **計画の規則**（`PathJoinRules`に追加。結果は05-03のtypedef`JoinPlan`＝`{ path, targetId, keepId, removeIds }`）：`planDrawnLineJoin(shapes, drawn, startSnap, endSnap, tolerance)`。`drawn`は作成途中の直線（`toJSON().points`の先頭＝描き始めの点、末尾＝描き終えの点）。`startSnap`・`endSnap`は`EndpointRef`か`null`。

    | 始点の端点 | 終点の端点 | 計画 |
    | --- | --- | --- |
    | なし | なし | `null`（呼び出し側の`EndpointSnapper`はこの場合呼ばずに`false`を返し、従来の直線の確定になる） |
    | 線Lの端点E | なし | `buildExtendedPath(L, E, 描き終えの点, tolerance)`。`{ targetId: L.id, keepId: true, removeIds: [] }` |
    | なし | 線Mの端点E | `buildExtendedPath(M, E, 描き始めの点, tolerance)`。`{ targetId: M.id, keepId: true, removeIds: [] }` |
    | 線Lの端点E | Lの、Eでない方の端点 | `buildClosedPath(L, tolerance)`（直線・頂点2つのパスは`null`、まとめて3つ未満も`null`）。`{ targetId: L.id, keepId: true, removeIds: [] }` |
    | 線Lの端点E | Lの同じ端点E | `null`（何も起きない） |
    | 線Lの端点 | 別の線Mの端点 | 共通の非公開関数`planJoinAt`：基準の線＝`shapes`で先（奥）の方。`buildJoinedPathAt(基準, 基準の端点, もう一方, もう一方の端点, tolerance)`。`{ targetId: 基準.id, keepId: false, removeIds: [もう一方.id] }` |

    *   どの行でも、`shapeId`の図形が`shapes`に無い・結合できる線でない場合は`null`。結果のパスが`null`なら計画も`null`。
* **3-1 描き足し**：新しい入口`buildExtendedPath(shape, end, point, tolerance)`を`PathJoinRules`に足す。結合できる線でなければ`null`。`point`と`end`の端点の距離が`tolerance`以下なら`null`。それ以外は元の線の頂点の並び（向き）を保ったまま、`end === 'end'`なら末尾、`'start'`なら先頭に`point`を加えた開いたパス（色・太さは元の線のもの。描いている直線の色・太さは使わない）。計画は`keepId: true`で元のid・重なり順の位置を保つ。
    *   **重なる場合の扱い（計画時の決定）**：足す頂点が吸い付いた端点と画面上5px以内で重なるなら**何も起きない**（`null`。作成途中の直線を捨て、元の線を変えず、履歴に残さない）。理由：05-03の規則（重なっていれば1つにまとめる）を当てはめると足す頂点は端点にまとまり元の線と同じ形になるため、結果は「変化なし」と同じ。3-3（長さ0の区間は何も起きない）とも揃う。通常は吸い付かなかった点が8px以内のすべての端点の外にあるため起きない（起き得るのは描き始めと描き終えの間にホイールで縮小した場合、または描き始めた後にカーソルを動かさずに描き終えた場合）。
    *   **別の入口を足した理由**（`buildJoinedPathAt`で「元の線」と「描いた直線」の2本の結合として組み立てない理由）：(1) 描き足しの結果は元のidを保つが、2本の結合の規則は重なり順で奥の線を基準にして新しいidを振る規則で、モデルに無い描いた直線には重なり順が無く当てはまらない。(2) 入力は1点だけでよく、描いた直線のどちらの端が元の線に接しているかを規則が知る必要がなくなる。(3) 重なる場合の扱い（何も起きない）が2本の結合と異なる。頂点の並べ方は、後述の非公開の組み立て関数を`buildJoinedPath`・`buildJoinedPathAt`と共有するため、規則は二重定義にならない。
* **3-2 閉じる**：既存の`buildClosedPath`をそのまま使う（並び・向きを変えず閉じる区間を足す。始点と終点が重なればまとめ、3つ未満なら`null`）。元のid・位置を保つ。頂点2つの線（直線・頂点2つのパス）は`null`で何も起きない。
* **3-3 同じ端点**：計画`null`で何も起きない。
* **3-4 結合**：新しい入口`buildJoinedPathAt(a, aEnd, b, bEnd, tolerance)`を`PathJoinRules`に足す。`a`が基準の線（向き・色・太さの元）。つなぐ端点を引数で指定する（いちばん近い組を選ばない）。並べ方は`buildJoinedPath`と同じ（`aEnd === 'end'`ならA＋B側の並び、`'start'`ならB側の並び＋A。Bは`aEnd === bEnd`のとき逆順）。2つの端点の距離が`tolerance`以下ならBの側の端点を除く（Aの端点の座標を残す）。結果は常に開いたパス（両端が重なっても閉じない）。結合できる線でなければ`null`。
* **規則の共有（`PathJoinRules`の内部の整理。既存の振る舞いを変えない）**：
    *   非公開の組み立て関数（例：`assembleOpenPath(dataA, bSeq, aFirst, merge)`。`bSeq`は向きを合わせ済みのBの頂点の列、`aFirst`はAが先か、`merge`はBのつなぐ端点を除くか）を足し、`buildJoinedPath`（候補の選び方・優先順・同距離の扱いは変えない）・`buildJoinedPathAt`・`buildExtendedPath`（`bSeq`＝`[point]`・`merge`＝`false`）がこれを呼ぶ。
    *   閉じたパスの頂点数の下限3を非公開の定数（例：`CLOSED_MIN_POINTS`）にまとめ、`classifyJoin`・`buildClosedPath`・`canCloseByMergingEnds`で共有する。
    *   既存の`buildJoinedPath`・`planJoin`・`classifyJoin`・`buildClosedPath`の振る舞いと05-03のテスト（`test/shapes/PathJoinRules.test.js`の既存ケース）は変えない。
* **反映の手順**（`EndpointSnapper.commitDrawnLine(startSnap, endSnap)`）：
    1.  両方`null`なら何もせず`false`（`screenLengthToWorld`も呼ばない）。
    2.  `planDrawnLineJoin(model.getShapes(), model.getDraftShape(), startSnap, endSnap, screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX))`。作成途中の図形が無ければ（`null`。通常起きない）計画`null`として扱う。
    3.  `model.cancelDraft()`（作成途中の直線を捨てる。通知1回）。
    4.  計画が`null`なら`true`を返して終わる（何も起きない。`beginEdit`/`commitEdit`を呼ばない）。
    5.  `editRecorder.beginEdit()` → `model.replaceShape(plan.targetId, plan.path, { keepId: plan.keepId, removeIds: plan.removeIds, select: false })`（通知1回） → `editRecorder.commitEdit()`。`true`を返す。
* **確定後の状態**：図形作成モードのままIDLE。選択集合は空のまま（`replaceShape`の`select: false`）。描き足し・結合・閉じた直後も、次のクリックで端点に吸い付けば続けて描き始められる。
* **選択しない差し替え**（`VectorModel.replaceShape`の引数の追加）：`replaceShape(targetId, shape, { keepId = false, removeIds = [], select = true } = {})`。`select`が偽のときは選択集合を新しく作らず、現存しなくなったid（置き換えで消えた元のid・除いた図形のid）だけを選択集合から外す（作成モードでは空のまま。「選択集合は常に現存図形のidのみ」を保つ）。それ以外（位置・id・除去・ホバー・通知1回・`#issueId()`の採番）は従来どおり。既定値が真のため既存の呼び出し元`PathJoiner`の振る舞いは変わらない。前提の記述を「`select`が真のときは選択モードであることを呼び出し側が保証」に改める。
* **描き途中の取り消し**：既存の破棄の経路（`Esc`の`cancelDraftOrClearSelection`・`setMode`・`setShapeType`・`abortOngoingOperation`）は`cancelDraft`だけで元の線に触れない。追加するのは吸い付きの作業用フィールドと表示の消去だけ。履歴にも残らない（従来どおり）。

### 要件4: 直線を描くときの履歴（Undo/Redo）
* 描き足し・閉じる・結合は、`EndpointSnapper.commitDrawnLine`の中で`beginEdit`→`replaceShape`→`commitEdit`の1組で記録する（記録先は`InputTracker`と同じ`historyManager`を`main.js`が注入）。差し替え（書き換え・除去）を含めて1件。
* 何も起きない場合（3-2の閉じられない場合・3-3・3-1の重なる場合）は`beginEdit`を呼ばないため記録しない。
* 選択集合の扱いは既存の`SnapshotAdapter`・`shouldRestoreSelection`に従う（作成モードでの記録では前後とも選択集合は空。適用時は「選択モードのときのみ」復元）。新しい規則は足さない。
* Undoは`replaceAllShapes`で元の図形一式（同じid・同じ形・同じ重なり順）に戻る。

### 要件5: 端点のハンドルのドラッグ
* **端点のハンドルかの判定**：`#beginLeftDrag`でDRAGGING_HANDLEを開始したとき、`EndpointSnapper.resolveDragEndpoint(shapeId, handleName)`（→`EndpointSnapRules.resolveEndpointHandle`）が`'start'`/`'end'`を返せば`#dragEndpoint = { shapeId, end }`、`null`なら`null`（途中の頂点・曲線・矩形・円・弧・閉じたパスのハンドルは吸い付かない）。直線の`'move'`ハンドル・本体のドラッグはMOVING_SELECTIONのため対象外（従来どおり）。ハンドルの当たり判定・優先順位（`#classifyPoint`・`hitTestHandle`）は変えない。
* **ドラッグ中**（`#applyLeftDragUpdate`のDRAGGING_HANDLE）：`#dragEndpoint`があれば`EndpointSnapper.findDragSnap(#dragEndpoint, point)`（→`findSnapTarget(shapes, point, 8pxのワールド換算, dragged)`）で照会し、結果を`#dragSnap`に保持・表示し、吸い付いていれば頂点を端点の座標へ、いなければカーソル位置へ`updateVertex`する。
* **吸い付く対象**：ドラッグしている線以外の結合できる線の端点と、ドラッグしている線自身のもう一方の端点（`canCloseByMergingEnds`が真＝頂点4つ以上の開いたパスのときだけ）。ドラッグしている端点そのものは対象にしない（要件1の除外）。
    *   `canCloseByMergingEnds(shape)`（`PathJoinRules`に追加）：開いたパスで、両端を1つにまとめて閉じても頂点が3つ以上残るか（`type === 'path'`・`closed`が偽・頂点数`- 1 >= CLOSED_MIN_POINTS`）。「吸い付く＝閉じられる」の1対1を、閉じる規則と同じ場所の同じ定数で判定する。
* **離したとき**（`#onLeftDragEnd`。`moved`が真で、`#dragEndpoint`と`#dragSnap`がともにあるとき）：`EndpointSnapper.joinDraggedEndpoint(#dragEndpoint, #dragSnap)`を呼び、その後`#finishLeftDrag()`。
    *   計画の規則`planEndpointDragJoin(shapes, dragged, snap, tolerance)`（`PathJoinRules`に追加）：
        *   `snap.shapeId`が`dragged.shapeId`と同じで`end`が違う → `buildClosedPath(ドラッグしている線, tolerance)`（ドラッグした頂点はもう一方の端点の座標に置かれているため距離0でまとまる。元のid・位置を保つ）。`{ keepId: true, removeIds: [] }`。
        *   同じ図形の同じ端点 → `null`。
        *   別の線M → `planJoinAt`（要件3の3-4と同じ。基準の線＝奥の方、つなぐ端点＝ドラッグしていた端点とMの吸い付いた端点。同じ座標のため1つの頂点にまとまる。新しいid、もう一方は除く）。
        *   図形が無い・結合できる線でない・結果が`null`なら`null`。
    *   手順：計画が`null`なら何もせず`false`。それ以外は`model.replaceShape(plan.targetId, plan.path, { keepId, removeIds, select: true })`（結果だけを選択。通知1回）で`true`。**`beginEdit`/`commitEdit`を呼ばない**（`InputTracker`が閾値超過時に開いた編集操作の中で行い、`#finishLeftDrag()`の`commitEdit`で頂点の移動とあわせて1件になる）。
    *   離したときに吸い付いていなければ、従来どおり頂点を動かしただけで終わる。
* **中断**（blur・`setMode`・`abortOngoingOperation`）：`#onLeftDragCancel`→`#finishLeftDrag`で、結合・閉じるを行わない（頂点は中断した時点の位置。従来どおり1件として確定）。吸い付きの表示と作業用フィールドは`#finishLeftDrag`で消す。

### 要件6: 処理を置く場所
* **置き場所と理由**：
    *   **吸い付きの規則**（対象の判定・端点の列挙・候補の選び方・描く図形種別・端点のハンドル）→ `shapes/EndpointSnapRules.js`（新設）。図形種別（`'line'`）・頂点の並び（`toJSON().points`の先頭と末尾、頂点の番号と`points`の対応）を知る必要があり、それを知ってよいのは`shapes/`だけのため。`shapes/`は`core/`をimportしないので表示倍率を知らない形（ワールドの許容距離を引数で受け取る）になり、自動テストで確かめられる。
    *   **結果の組み立て**（端点を指定した結合・描き足し・閉じられるかの判定・描く流れとドラッグの計画）→ `shapes/PathJoinRules.js`（追加）。結合の規則の唯一の置き場所に置き、二重定義を避ける。
    *   **照会と反映の手順**（許容距離の換算・規則の呼び出し・作成途中の図形の破棄・`replaceShape`・履歴の記録）→ `edit/EndpointSnapper.js`（新設）。`edit/`は「`core/`の機能を組み合わせて図形一式を扱う手順」で、`PathJoiner`と同じ形（`model`・`editRecorder`・`screenLengthToWorld`の注入、規則のimport）。図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードを持たない（読むのは共通プロパティ`id`だけ。`shapeType`は規則へ渡すだけ）。`InputTracker`に依存しない。
    *   **入力の場面での呼び出し**→ `core/InputTracker.js`（最小限の配線）。`core/`は`edit/`をimportできないため、`main.js`が`EndpointSnapper`を生成してコンストラクタの第5引数で注入する（`editRecorder`と同じ注入の形。typedef`EndpointSnapAssist`は`InputTracker.js`に置き、省略時は何もしない既定値`NO_SNAP_ASSIST`）。
    *   **表示の状態**→ `VectorModel`（`#snapPoint`）。描画は`CanvasManager`（引数を描くだけ）。
* **`InputTracker`の「知らないこと」を破らない理由**：「描く図形種別が直線のときだけ吸い付く」は`findDrawSnap(shapeType, point)`が規則`isSnapDrawShapeType`で判定し、`InputTracker`は`currentShapeType`を渡すだけ（if/switchしない）。「端点のハンドルか」は`resolveDragEndpoint(shapeId, handleName)`が規則`resolveEndpointHandle`で判定し、`InputTracker`は`vertexIndex`規約を持たない。`SnapTarget`は`x`・`y`だけを読み、他のプロパティは解釈せずに保持して`EndpointSnapper`へ返す。
* **typedef`EndpointSnapAssist`**（`InputTracker.js`。メソッド5つ）：
    *   `findDrawSnap(shapeType, point) => SnapTarget|null`
    *   `resolveDragEndpoint(shapeId, handleName) => 'start'|'end'|null`
    *   `findDragSnap(dragged, point) => SnapTarget|null`（`dragged`＝`{ shapeId, end }`）
    *   `commitDrawnLine(startSnap, endSnap) => boolean`（両方`null`なら何もせず`false`。それ以外は作成途中の直線を破棄して反映し`true`）
    *   `joinDraggedEndpoint(dragged, snap) => boolean`（開いている編集操作の中で反映。記録は呼び出し側）
    *   `NO_SNAP_ASSIST`：照会は常に`null`、`commitDrawnLine`・`joinDraggedEndpoint`は常に`false`（第5引数の省略時は従来と同じ振る舞い）。
* **`InputTracker`に足す配線**（privateフィールド：`#snapAssist`・`#drawStartSnap`・`#drawEndSnap`（タスク8）、`#dragEndpoint`・`#dragSnap`（タスク9）。privateメソッド：`#showSnap(snap)`・`#resetSnapState()`）：
    *   `handleMouseMove`：(1)ドラッグ中なら何もしない（従来）。(2)DRAWING：照会→`#drawEndSnap`→表示→`updateDraft(吸い付きの座標かカーソル)`。(3)IDLEかつ図形作成モード：照会→表示のみ。(4)以降は従来（選択モードのIDLEのホバー）。
    *   `handleClick`：DRAWINGは`commitDrawnLine`が`false`のときだけ従来の確定、その後IDLE・`#resetSnapState()`。IDLEの図形作成モードは照会→`#drawStartSnap`→表示→`startDraft(吸い付きの座標かクリック位置)`。
    *   `setShapeType`：従来の処理の後に`#resetSnapState()`。`cancelDraftOrClearSelection`のDRAWINGの分岐：`#resetSnapState()`。`#abortOngoingOperation`：最後に`#resetSnapState()`（`aborted`は変えない）。`#beginPan`：開始できたとき`model.clearSnapPoint()`。
    *   `#beginLeftDrag`：DRAGGING_HANDLEのとき`#dragEndpoint`を解決。`#applyLeftDragUpdate`のDRAGGING_HANDLE：照会→`#dragSnap`→表示→`updateVertex(吸い付きの座標かカーソル)`。`#onLeftDragEnd`：範囲選択の確定の後、条件を満たせば`joinDraggedEndpoint`。`#finishLeftDrag`：`#resetSnapState()`（ドラッグの作業用フィールドも`null`に）。
    *   変更する既存のJSDoc：クラスJSDoc（吸い付きの照会と反映を注入された`EndpointSnapAssist`へ委ねること、図形種別・`vertexIndex`規約を知らないこと）、コンストラクタ（`@param snapAssist`）、`handleMouseMove`・`handleClick`・`setShapeType`・`cancelDraftOrClearSelection`・`#abortOngoingOperation`・`#beginPan`・`#beginLeftDrag`・`#applyLeftDragUpdate`・`#onLeftDragEnd`・`#finishLeftDrag`の処理順の説明。先頭行の責務JSDocは変えない（入力の解釈とModelへの反映の範囲に収まるため）。
* **`InputTracker`の行数の増分の見積もり**：タスク8で約+90行（typedef・既定値・フィールドとJSDocで約45行、ハンドラの配線と補助メソッドで約30行、既存JSDocの追記で約15行）、タスク9で約+35行。計約+125行（1146行 → 約1270行）。再分離は精度のPhase（`_doc/COWORK_STATUS.md` 2章A）。
* **通知の回数・順序**：
    *   描き終え（吸い付きあり・計画あり）：`cancelDraft`（1回）→ `beginEdit` → `replaceShape`（1回）→ `commitEdit`（記録すれば`historyManager.onChange` 1回）→ `InputTracker`の`#resetSnapState`の`clearSnapPoint`（表示中だった場合1回）。
    *   描き終え（吸い付きあり・何も起きない）：`cancelDraft`（1回）→ `clearSnapPoint`（表示中だった場合1回）。履歴の通知なし。
    *   描き終え（吸い付きなし）：従来どおり（`commitDraft` 1回、記録の通知）＋`clearSnapPoint`（表示は無いため通知なし）。
    *   DRAWINGのmousemove：`setSnapPoint`/`clearSnapPoint`（表示が変わったときだけ1回）→ `updateDraft`（1回）。図形作成モードのIDLEのmousemove：表示が変わったときだけ1回（従来は0回）。
    *   ハンドルのドラッグを離したとき（結合・閉じる）：`replaceShape`（1回）→ `#finishLeftDrag`の`commitEdit`（記録の通知1回）→ `clearSnapPoint`（1回）。
* **`VectorModel`への追加**（要件2・3）：`setSnapPoint`・`clearSnapPoint`・`getSnapPoint`と`replaceShape`の`select`。図形種別を関知しない・id採番は`#issueId()`・通知は1回、の原則を守る。`ShapeFactory`以外のimportを足さない。
* **変更しないもの**：図形クラス（`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）・`ShapeFactory`・`PathJoiner`・`DragTracker`・`HistoryManager`・`SnapshotAdapter`・`io/`・`index.html`・`KeyboardShortcuts`。変更が不可避になった場合は5章に理由を書く。

### 要件7: 保存・読み込み・書き出し
* 結果はすべて`Path`のコンストラクタで作る（区間の要素数は開いたパス`n - 1`・閉じたパス`n`、`kind`は`'line'`）ため、Phase 05-02のパスと同じ図形データ・描画要素になる。`toJSON`→`Path.fromJSON`の往復をテストで確かめる。作業データの版・書き出し形式の版・`io/`は変えない。

### 要件8: 自動テスト
`_doc/arch/16_test.md`の規則に従う（`node:test`と`node:assert/strict`のみ、公開APIのみ、テストのためにソースを書き換えない、補助関数は各ファイル内にJSDoc付きで書く、図形の`id`は公開プロパティへ直接代入、`console.warn`は`t.mock.method`で抑止）。距離の境界は浮動小数の誤差が出ない値（3・4・5の直角三角形や軸に沿った距離）で確かめる。既存のテストファイルにはケースを足すだけで既存のケースを書き換えない。

* **8-1 `test/shapes/PathJoinRules.test.js`（ケースの追加。タスク1）**：
    *   `buildJoinedPathAt`：4通りの端点の組（A終点–B始点／A終点–B終点／A始点–B終点／A始点–B始点）の並び、いちばん近い組ではない組を指定してもその組でつながる、重なりの境界（距離ちょうど`tolerance`でBの端点を除く・僅かに外で区間が足される）、まとめた頂点の座標がAの端点、属性（Aの色・太さ、idは`null`）、結果は開いたパスで両端が重なっても閉じない、直線とパスの組み合わせ、結合できない線で`null`。
    *   `buildExtendedPath`：直線から（始点側・終点側）、パスから（始点側・終点側）、元の線の向き・色・太さが保たれる、頂点が1つ増え区間は頂点数`- 1`、重なり（距離ちょうど`tolerance`で`null`・僅かに外で足す）、結合できない線（閉じたパス・曲線）で`null`。
    *   `canCloseByMergingEnds`：頂点4つ以上の開いたパスで真、頂点3つ・2つのパス・直線・閉じたパス・曲線で偽。
    *   `planDrawnLineJoin`：表の各行（なし–なし`null`／描き足し（始点側・終点側、直線から・パスから。`keepId: true`・`targetId`＝元のid・`removeIds: []`）／閉じる（頂点3つ以上のパスで閉じたパス・`keepId: true`、直線・頂点2つのパスで`null`）／同じ端点で`null`／結合（基準の線＝`shapes`で奥、並びを入れ替えると基準が入れ替わる、`keepId: false`・`removeIds`＝もう一方、吸い付いた端点でつながる（いちばん近い組でない場合も）、重なっていれば1つにまとまる））、図形が無いidで`null`。
    *   `planEndpointDragJoin`：別の線との結合（基準＝奥、同じ座標の端点が1つにまとまる、`keepId: false`）、自身のもう一方の端点で閉じる（頂点が1つ減った閉じたパス・`keepId: true`）、同じ端点・`snap`なしで`null`。
    *   不変条件と往復：結果（描き足し・閉じる・結合）が開いた／閉じたパスの区間の要素数と`kind: 'line'`を満たし、`toJSON`→`Path.fromJSON`で同じ図形データに戻る。結果が元の図形の頂点の配列・頂点オブジェクトを共有しない（元を`translate`しても結果が変わらない）。引数の図形の`toJSON()`が前後で変わらない。
    *   既存の`buildJoinedPath`・`planJoin`等のケースは変えずに通ること（内部の整理の確認）。
* **8-2 `test/shapes/EndpointSnapRules.test.js`（新設。タスク2）**：`SNAP_TOLERANCE_SCREEN_PX`が8で`JOIN_TOLERANCE_SCREEN_PX`と別の値。`isSnapDrawShapeType`（`'line'`だけ真、`'curve'`・`'rect'`・`'circle'`・`'arc'`・`'path'`・未知は偽）。`resolveEndpointHandle`（直線`'start'`/`'end'`/`'move'`、パス`'vertex-0'`/末尾/途中、閉じたパス・曲線・矩形で`null`、不正な名前で`null`）。`findSnapTarget`：対象（直線・開いたパスの両端に吸い付く／曲線・矩形・円・弧・閉じたパスの点・パスの途中の頂点に吸い付かない）、距離（ちょうど`tolerance`で吸い付く・僅かに外で`null`）、戻り値の`shapeId`・`end`・`x`・`y`、候補の選び方（いちばん近い端点／同距離なら前面の図形／同じ図形の始点と終点が同距離なら始点）、`dragged`の除外（ドラッグしている端点は対象外／自身のもう一方の端点は頂点4つ未満（直線・頂点2つ・3つのパス）で対象外、頂点4つ以上の開いたパスで対象）、図形0個で`null`、引数の図形を書き換えない。
* **8-3 `test/core/VectorModel.replaceShape.test.js`（ケースの追加。タスク3）**：`select: false`で選択集合が空のまま（作成モード相当）、選択集合に他の図形があればそれは残り、除いた図形・置き換えで消えた元のidは外れる、位置・`keepId`・除去・通知1回は`select`の有無で同じ、`select`を省略すると従来どおり結果だけが選択される。
* **8-4 `test/core/VectorModel.snapPoint.test.js`（新設。タスク4）**：初期値`null`、`setSnapPoint`で設定・通知1回、同じ座標の再設定は通知しない、別の座標で通知、`getSnapPoint`がコピーを返す（書き換えても内部が変わらない）、`clearSnapPoint`は表示中のときだけ通知、`replaceAllShapes`で`null`になり通知は1回のまま、図形・選択集合・ホバー・作成中の図形・選択矩形に触れない。
* **8-5 `test/edit/EndpointSnapper.test.js`（新設。タスク5）**：
    *   偽物での手順：`findDrawSnap`（直線以外の種別で`null`・`screenLengthToWorld`を呼ばない、直線で`screenLengthToWorld(8)`の戻り値が許容距離として使われる）、`resolveDragEndpoint`（無いidで`null`）、`findDragSnap`（除外が効く）、`commitDrawnLine`（両方`null`で`false`・モデルと記録先を呼ばない、描き足しで`cancelDraft`→`beginEdit`→`replaceShape`（`keepId: true`・`select: false`）→`commitEdit`の順、何も起きない場合は`cancelDraft`だけで`true`、`screenLengthToWorld(5)`で換算）、`joinDraggedEndpoint`（`beginEdit`/`commitEdit`を呼ばず`replaceShape`（`select: true`）だけ、計画`null`で何も呼ばず`false`）。
    *   実物の組み合わせ（実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`EndpointSnapper`。`PathJoiner.test.js`と同じ例外。DOM・ブラウザのAPIに依存せず公開APIだけを通す）：直線からの描き足し（`startDraft`→`updateDraft`→`commitDrawnLine`）で同じid・同じ重なり順の開いたパスになり選択集合は空・作成途中の図形は無い・履歴1件、Undo1回で元の直線（同じid・形・位置）・Redo1回で描き足し後、結合（間に別の図形を挟む）で新しいidが奥の位置に入りもう一方が除かれ・Undo/Redoで往復、閉じるで元のidの閉じたパス、何も起きない場合（同じ端点・頂点2つの線の閉じる）で図形一式が変わらず履歴が増えない、ハンドルのドラッグ（`beginEdit`→`updateVertex`で端点を重ねる→`joinDraggedEndpoint`→`commitEdit`）で履歴1件・結果だけが選択・Undo1回でドラッグ前の位置と図形一式に戻る、自身のもう一方の端点での閉じる。
* 自動テストにしない部分（`InputTracker`の配線・`CanvasManager`の描画・`main.js`の配線）はテストプレイの確認項目（5章）に入れる。

### 要件9: テストプレイの確認項目
5章「テストプレイの確認項目」に、操作手順と期待する結果の形で列挙する。テストプレイ用の作業データは現場設計AIが用意する（実装AIは作成しない）。

### 要件10: 開発資料への記載
下記「開発資料の更新予定」に列挙し、最終タスク（タスク11）で`PROJECT_ARCHITECTURE.md`と`_doc/arch/`の該当ファイルへ反映する。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - `EndpointSnapRules.js`の新設（端点への吸い付きの規則。図形をまたぐ規則の種類）、`PathJoinRules.js`への入口・計画の追加
    *   `./js/edit/` - `EndpointSnapper.js`の新設（吸い付きの照会と反映の手順）
    *   `./js/core/` - `VectorModel.js`（吸い付きの表示の点・`replaceShape`の`select`）、`CanvasManager.js`（吸い付きの表示の描画）、`InputTracker.js`（最小限の配線）
    *   `./js/main.js` - 生成・注入・描画の引数
    *   `./test/shapes/`・`./test/core/`・`./test/edit/` - 自動テスト（新設3ファイル、ケースの追加2ファイル）
*   **関連する論理クラス・モジュール**:
    *   `EndpointSnapRules`（新設。`SNAP_TOLERANCE_SCREEN_PX`・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`、typedef`SnapTarget`）
    *   `PathJoinRules`（追加：`buildJoinedPathAt`・`buildExtendedPath`・`canCloseByMergingEnds`・`planDrawnLineJoin`・`planEndpointDragJoin`、typedef`EndpointRef`。非公開の組み立て関数・定数・`planJoinAt`）
    *   `EndpointSnapper`（新設。`findDrawSnap`・`resolveDragEndpoint`・`findDragSnap`・`commitDrawnLine`・`joinDraggedEndpoint`）
    *   `VectorModel`（追加：`setSnapPoint`・`clearSnapPoint`・`getSnapPoint`、`replaceShape`の`select`、`replaceAllShapes`のクリア対象）
    *   `CanvasManager`（`render`の`snapPoint`・`#drawSnapIndicator`）
    *   `InputTracker`（第5引数`snapAssist`・typedef`EndpointSnapAssist`・`NO_SNAP_ASSIST`・配線）
    *   `main.js`（`EndpointSnapper`の生成と注入、`renderCurrentState`の`snapPoint`）
    *   変更しないが関係するもの：`Path`（コンストラクタ・`toJSON`・`fromJSON`）、`Line`（`toJSON`・`getVertexIndexForHandle`・`updateDraftEnd`）、`ShapeFactory`（`startDraft`の直線の作成）、`PathJoiner`（`replaceShape`の既存の呼び出し元）、`HistoryManager`（`beginEdit`・`commitEdit`）、`SnapshotAdapter`（選択集合の復元）、`ViewTransform`（`screenLengthToWorld`）、`DragTracker`（`onStart`・`onMove`・`onEnd(moved)`・`onCancel`の契約）

### 参照する責務
*   （`PROJECT_ARCHITECTURE.md` 1章）**依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`edit/PathJoiner`は例外として`shapes/PathJoinRules`をimportする（下向き。`edit/`の他のクラスは`shapes/`をimportしない）。本作業で`edit/EndpointSnapper`を同じ例外に加える。**フォルダ分割**：`shapes/`は図形クラス・図形クラスだけが使う共通の関数・図形をまたぐ規則（`PathJoinRules`。`shapes/`の外から使う）。`edit/`は`io/`・`core/`の機能（結合の手順`PathJoiner`のみ`shapes/`の規則も）を組み合わせて図形一式を扱う手順で、操作モードを知らない（操作モードに依存する判定・処理は中立な注入関数で受け取る）。`test/`は依存が`test/ → js/`の一方向。
*   （同2章）**図形データ**：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`。`path`は`{ type: 'path', id, points, closed, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth }`、区間の要素数は開いた`n - 1`・閉じた`n`、頂点数の下限は開いた2・閉じた3。`Line`も`points`2点＝[始点, 終点]。`points`の並びは各図形クラスの頂点の並びと同じ。**選択集合**は`VectorModel`が保持し、常に現存図形のidのみ・選択モード以外では空（不変条件）。保存対象は図形データのみで、選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない。図形の座標はすべてワールド座標で、ビュー変換は`ViewTransform`が持つ。
*   （同3章冒頭）**同期の経路**：再描画・UI同期は既存の経路（`model.onChange`・`viewTransform.onChange`等）のみ。機能専用の再描画・同期処理を足さない。
*   （同3章2.・4.）**描画サイクル**：常時ループは持たず、`model.onChange`・`viewTransform.onChange`・リサイズの3経路から`renderCurrentState()`（`main.js`）で同期的に再描画する。**入力**：`InputTracker`がスクリーン座標を`ViewTransform.screenToWorld`でワールドへ変換して`VectorModel`・当たり判定へ渡す。
*   （同3章3.）**ドラッグのライフサイクル**は`DragTracker`が一元管理し、意味の解釈は`InputTracker`。閾値判定のみスクリーン座標。（`_doc/arch/09_DragTracker.md`・実コード）`begin()`は`onStart`を同期的に呼ばない。`onStart`→`onMove`は閾値超過後のmousemoveで呼ばれ、閾値以内では`onMove`は呼ばれない。`onEnd(event, moved)`の`moved`は閾値を超えたか。`onCancel`はblur・`cancel()`の中断。
*   （同3章6.）**履歴**：変更処理を`beginEdit()`と`commitEdit()`で挟む。前後の作業データ部分が一致すれば記録しない。図形の作成は`handleClick`のDRAWING確定時の`commitDraft()`の前後。本体ドラッグ・moveハンドル・ハンドルによる変形は閾値超過時に開始し、ドラッグの終了・中断の共通後始末で確定（中断で残った変化も1件）。結合は`PathJoiner.join`で`replaceShape`の前後。記録しない操作：作成途中の図形の開始・破棄、ホバー、パン、モード/図形種別の切り替え等。Undo/Redoの前処理は`performUndo`/`performRedo`（ドラッグ中は不受理→`inputTracker.abortOngoingOperation()`（取り消しは作成途中の図形を破棄した場合そこで終了）→`HistoryManager.undo/redo`→`SnapshotAdapter.restore`→`model.replaceAllShapes`→`shouldRestoreSelection()`が真（選択モード）のときのみ`setSelection`）。
*   （同3章8.）キャンバスの切り替えは`prepareSwitch()`（実体`applyMode(OperationMode.SELECT)`）→…→`model.replaceAllShapes`。インポートは`prepareInsert()`（実体`applyMode(OperationMode.SELECT)`）。
*   （同3章11.）**結合の規則**：基準の線A＝重なり順で奥。結果の向き・色・太さはAのもの。2本の結合はAの位置に新しいidで結果を置きBを除く。閉じるは元のidと位置を保つ。端点が重なっている＝画面上5px以内（ちょうどを含む）を結合時の表示倍率でワールドへ換算（`main.js`が`screenLengthToWorld`を注入）。重なる端点は1つにまとめ、離れていれば区間でつなぐ。自動で閉じない。規則の詳細の正本は`PathJoinRules.js`のJSDoc。Phase 05-04は`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`buildJoinedPath`・`buildClosedPath`を使い回して結果の扱いを揃えること。規則の関数は表示倍率を知らない。`InputTracker`の`hitTolerance`は同じ5pxだが別の定義。
*   （`_doc/arch/12_shapes.md`）**PathJoinRules.js**：状態を持たない`export`した関数と定数のみ。読むのは`type`・`id`・`toJSON()`だけで、図形クラスの内部プロパティを読まない。importは`./Path.js`のみ。使う側は`shapes/`の外（`edit/PathJoiner`。Phase 05-04では`core/`からも可）。知らないこと：表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。**shapes/全般**：共通基底クラスは無く、各図形クラスは13メソッドを自律実装する。図形クラス・`ShapeFactory`は`try/catch`を持たない。共通モジュール（`ShapeGeometry`・`ShapeDataValidation`）をimportするのは図形クラスのみ。**ハンドル名の契約**：移動ハンドルは`'move'`固定。`'move'`以外は`getVertexIndexForHandle`で番号に解決できる。`Line`の`hitTestHandle`は`'start'|'end'|'move'|null`。`Path`は`'vertex-<i>'`か`null`で`move`ハンドルを持たない。`Path`は`ShapeFactory.create`では作られず、コンストラクタは引数を検証しない（頂点を複製し区間を頂点数から作る）。区間の要素数の不変条件は閉じる操作等を足すときに保つこと。`toJSON`/`fromJSON`は配列・頂点を共有しない。
*   （`_doc/arch/10_ShapeFactory.md`）`shapes/`は`ShapeFactory`・`core/`をimportしない。`VectorModel.startDraft`は`ShapeFactory.create`で作る。
*   （`_doc/arch/03_VectorModel.md`）**VectorModel.js**：Shape配列と選択集合・ホバー・作成中図形・選択矩形のSSOT。知らないこと：図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式。`Line`への直接依存も持たない。図形idの採番（`shape-<連番>`）は`#issueId()`に一本化。`replaceShape`は指定idの図形の位置へ新しい図形を入れ、指定の図形を除き、結果の図形だけを選択する（通知1回、`keepId`）。呼び出し元は`PathJoiner`、選択モードであることは呼び出し側の保証。（実コード）状態を変える操作は変更後に通知し、複数件の変更でも通知は1回。`clearSelectionRect`は存在したときだけ通知。`replaceAllShapes`は選択集合・ホバー・作成中の図形・選択矩形をクリアして通知1回。
*   （`_doc/arch/04_CanvasManager.md`）**CanvasManager.js**：Canvasへの純粋な描画。公開`render(shapes, { hoveredId, selectedIds, draftShape, selectionRect, view } = {})`・`resize()`、呼び出し元は`main.js`。図形データ・選択状態・ビュー変換状態を持たず、値は引数で受け取る（`ViewTransform`をimportしない）。描画順：背景グリッド → 軸線・原点マーク → 全図形の`draw`（＋ホバー）→ 選択集合の`drawHandles` → `draftShape`の`draw` → 選択矩形。補助表示は`÷ view.scale`で画面上一定。
*   （`_doc/arch/06_InputTracker.md`）**InputTracker.js**：入力の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知、カーソル形状。**知らないこと**：図形種別（if/switch分岐を一切行わず、`hitTest`/`hitTestHandle`/`intersectsRect`/`getVertexIndexForHandle`をポリモーフィックに呼ぶのみ。`vertexIndex`規約を`core/`層にハードコードしない）。`HistoryManager.js`をimportしない。`main.js`の関数を呼ばない。**状態**：`InputState`（`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`）・操作モード・図形種別を独立に保持。パンは`InputState`と直交するフラグで、`DRAWING`を保持したまま行える。`abortOngoingOperation()`は`?dev`の復元と取り消し・やり直しの前処理として`main.js`が呼び、privateの中断処理本体はカーソルを再評価しない。**編集操作の通知**はコンストラクタの第4引数`editRecorder`（省略時は何もしない）。左ドラッグの開始通知の時点で状態が遷移済みであることは`DragTracker.begin()`が`onStart`を同期的に呼ばないことに依存する。**当たり分類**は1つの分類処理の結果をホバー・押下・クリック・カーソルで共用し、クリックの解釈にホバー状態を参照しない。ハンドルの優先順位は`CanvasManager`のハンドル描画順と一致させる。当たり判定の許容誤差は画面上5px相当をワールド換算して渡す。行数約1140行（再分離の候補は`_doc/COWORK_STATUS.md`2章A。再分離は精度のPhase）。
*   （`_doc/arch/14_edit.md`）**edit/**：知らないこと（全クラス共通）：DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、操作モード。`InputTracker`に依存しない。依存は注入で受け取る。**PathJoiner.js**：`model`は`getShapes`・`isSelected`・`replaceShape`のみ使う。`editRecorder`（実体`historyManager`）と`screenLengthToWorld`は注入。結合できない選択では何もせず記録しない。履歴へは1件記録する。進行中の入力操作の中断・モード切り替えは行わない。`try/catch`を持たない。`editRecorder`の型はJSDocの`import('./ShapeInserter.js').EditRecorder`で参照する。
*   （`_doc/arch/08_HistoryManager.md`）`beginEdit`/`commitEdit`の呼び出し元は`InputTracker`・`main.js`（`?dev`の復元）・`ShapeInserter`・`PathJoiner`。`EditRecorder`として注入され、いずれも`HistoryManager.js`をimportしない。確定されていない編集操作があるときの`beginEdit`は`console.warn`して前の状態を上書きする（入れ子にしない）。
*   （`_doc/arch/02_main.md`）**main.js**：インスタンス化・依存の注入・イベントバインドと連携のみ。判定ロジック・作業データの中身の解釈を持たない。配線ブロック`// 4.`は`InputTracker`の生成・`renderCurrentState`・再描画の登録。`HistoryManager`は`InputTracker`より先に生成する。注入の一覧：`InputTracker`＝`canvas`・`model`・`viewTransform`・`editRecorder`＝`historyManager`、`PathJoiner`＝`model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`＝`(length) => viewTransform.screenLengthToWorld(length)`。行数584行。
*   （`_doc/arch/16_test.md`）`node:test`・`node:assert/strict`のみ、ルートの`node --test`で実行。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc（`@param`・`@returns`）。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止。注入される依存は素のオブジェクトの偽物で置き換える（例外は`test/edit/PathJoiner.test.js`の組み合わせのケースのみ：実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`PathJoiner`。条件はDOM・ブラウザのAPIに依存せず公開APIだけを通すこと）。図形の`id`は公開プロパティ`id`へ文字列を直接代入する。既存のテストファイルにはケースを足すだけ。
*   （`_doc/COWORK_STATUS.md` 2章A）`InputTracker.js`は約1140行。再分離（状態の所有者設計を含む）は精度のPhase。結合の規則は`PathJoinRules`にあり、描き足し・閉じる処理は同じ規則を別の場所に書き直さない。パスの区間の要素数の不変条件を保つため、新しい`Path`をコンストラクタで作る。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章 フォルダ構成**：
    *   `js/shapes/`に`EndpointSnapRules.js`を足す（`PathJoinRules.js`の後。注記「図形クラスではない。図形をまたぐ規則（端点への吸い付き）。`shapes/`の外から使う」）。
    *   `js/edit/`に`EndpointSnapper.js`を足す（`PathJoiner.js`の後）。
    *   `test/`に`core/VectorModel.snapPoint.test.js`・`shapes/EndpointSnapRules.test.js`・`edit/EndpointSnapper.test.js`を足す。
*   **1章 フォルダ分割の方針・依存方向**：`shapes/`の図形をまたぐ規則に`EndpointSnapRules`（端点への吸い付きの規則）を足す。`edit/`の説明の「結合の手順`PathJoiner`のみ`shapes/`の規則も」を`PathJoiner`・`EndpointSnapper`に改める。依存方向の例外に「`edit/EndpointSnapper`は`shapes/EndpointSnapRules`・`shapes/PathJoinRules`をimportする」を足し、「`shapes/EndpointSnapRules`は`shapes/PathJoinRules`をimportする」を書く。
*   **2章**：「作業データ形式」の保存対象外と「キャンバス記録」の保存しないものに「吸い付きの表示」を足す。「選択状態」の近くに「吸い付きの表示の点：`VectorModel`が保持するワールド座標の1点（表示専用。`InputTracker`が設定・消去する）」を足す。
*   **3章**：
    *   3.「入力監視」に、端点への吸い付きの流れの要約（照会は`InputTracker`→注入された`EndpointSnapper`→`EndpointSnapRules`、表示は`VectorModel`の吸い付きの表示の点→`renderCurrentState`→`CanvasManager`）を足すか、新設の12.を参照する。
    *   6.「記録する操作と時点」：図形の作成に「直線の描き終えで吸い付いていた場合は`EndpointSnapper.commitDrawnLine`で、`model.replaceShape`の前後（何も起きない場合は記録しない）」を足す。ハンドルによる変形に「端点のハンドルを吸い付いた状態で離した場合の結合・閉じるは、同じ1件の中で`#finishLeftDrag`の確定の前に行う」を足す。
    *   11.「結合」：公開の入口に`buildJoinedPathAt`（つなぐ端点を指定）・`buildExtendedPath`（描き足し）・`canCloseByMergingEnds`・`planDrawnLineJoin`・`planEndpointDragJoin`を足す。描き足しの規則（元のid・色・太さ・重なり順の位置を保つ、元の線の向きを保つ、足す頂点が端点と重なれば何も起きない）と、吸い付きでの結合はつなぐ端点が吸い付いた端点であること（いちばん近い組ではない）を足す。「Phase 05-04は…を使い回して」の文を実装に合わせて改める。
    *   **12. 端点への吸い付きと描き足し**（新設）：流れ（直線の描き始め・描いている途中・描き終え、端点のハンドルのドラッグの更新と終了）、モジュールの分担（規則`EndpointSnapRules`・`PathJoinRules`、手順`EndpointSnapper`、配線`InputTracker`、表示の状態`VectorModel`、描画`CanvasManager`）、発注者の決定（吸い付く距離＝画面上8px・ちょうどを含む・表示倍率で換算、対象は結合できる線の端点だけ、候補の選び方、表示＝中を青で塗った8pxの正方形、ハンドルのドラッグで吸い付いて離すと結合・閉じる、閉じられない場合は自身のもう一方の端点に吸い付かない、頂点2つの線は閉じない）、表示を消す箇所、描き終えの端点は直前のmousemoveの照会結果を使うこと、履歴（描く流れは1件・何も起きない場合は記録しない、ドラッグは移動と結合で1件）、選択集合（作成モードでは`replaceShape`の`select: false`で空のまま、ドラッグでは結果だけを選択）、やらないこと（曲線・矩形・円・弧・閉じたパスの点・途中の頂点への吸い付き、修飾キーでの一時無効、整数px・グリッド、本体・moveハンドルのドラッグでの吸い付き、自動で閉じる）、`SNAP_TOLERANCE_SCREEN_PX`・`JOIN_TOLERANCE_SCREEN_PX`・`hitTolerance`・表示の大きさ（`CanvasManager`の定数）が別の定義であること。
*   **`_doc/arch/12_shapes.md`**：**EndpointSnapRules.js**の節を足す（責務、公開`SNAP_TOLERANCE_SCREEN_PX`・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`、読むもの（`type`（`isJoinableLine`経由）・`id`・`toJSON()`・`getVertexIndexForHandle`）、importは`./PathJoinRules.js`のみ、使う側は`edit/EndpointSnapper`、知らないこと（表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式）、`try/catch`を持たない、「頂点の番号`i`＝`points[i]`」に依ること）。**PathJoinRules.js**の節の公開に追加分とtypedef`EndpointRef`を足し、使う側に`edit/EndpointSnapper`・`shapes/EndpointSnapRules`を足す（「Phase 05-04では`core/`からも可」は実装に合わせて改める）。頂点の並べ方を非公開の組み立て関数で共有していること（規則を変えるときは`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が同時に変わる）を注意に足す。`Path.js`の節の「作る操作は結合（…）とPhase 05-04」を実装に合わせる。
*   **`_doc/arch/14_edit.md`**：**EndpointSnapper.js**の節を足す（責務、公開メソッド、呼び出し元は`InputTracker`（`main.js`が注入）、`model`は`getShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`のみ使う、`editRecorder`・`screenLengthToWorld`の注入、契約（`commitDrawnLine`は両方`null`なら何もしない・何も起きない場合は記録しない・記録は1件、`joinDraggedEndpoint`は記録しない（呼び出し側の開いている編集操作の中）、作成モードでは選択しない・ドラッグでは結果を選択する、操作モードを知らない））。依存の例外に`EndpointSnapper`を足す。
*   **`_doc/arch/03_VectorModel.md`**：保持する状態に吸い付きの表示の点を足す。公開メソッドに`setSnapPoint`・`clearSnapPoint`・`getSnapPoint`を足す。`replaceShape`の記述に`select`（偽なら選択集合を変えず消えたidだけ外す。呼び出し元に`EndpointSnapper`）を足し、「選択モードであることは呼び出し側の保証」を`select`が真のときに限る。
*   **`_doc/arch/04_CanvasManager.md`**：`render`の引数に`snapPoint`を足し、描画順に「`draftShape`の`draw` → 吸い付きの表示 → 選択矩形」を書く。
*   **`_doc/arch/06_InputTracker.md`**：コンストラクタの第5引数`snapAssist`（typedef`EndpointSnapAssist`。実体は`main.js`が注入する`EndpointSnapper`。省略時は吸い付かない）、吸い付きの候補の探索・距離の判定・結果の組み立て・モデルへの反映を持たないこと、描く図形種別と端点のハンドルの判定も委ねること（図形種別・`vertexIndex`規約を知らないため）、`SnapTarget`は`x`・`y`だけを読むこと、配線の場面（mousemove・描き始め・描き終え・ハンドルのドラッグの更新と終了）と表示を消す箇所、行数を実際の値に改める。
*   **`_doc/arch/02_main.md`**：配線ブロック`// 4.`に`EndpointSnapper`の生成を足す。注入の一覧に`EndpointSnapper`（`model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`）と`InputTracker`の第5引数＝`endpointSnapper`を足す。生成順の制約（`EndpointSnapper`は`InputTracker`より先）を足す。`renderCurrentState`が`snapPoint`を渡すこと。行数を実際の値に改める。
*   **`_doc/arch/08_HistoryManager.md`**：`beginEdit`/`commitEdit`の呼び出し元に`EndpointSnapper`（描き足し・結合・閉じる。`EditRecorder`として注入）を足す。
*   **`_doc/arch/16_test.md`**：「既存のテストファイルと検証範囲」に`test/shapes/EndpointSnapRules.test.js`・`test/core/VectorModel.snapPoint.test.js`・`test/edit/EndpointSnapper.test.js`を足し、`test/shapes/PathJoinRules.test.js`・`test/core/VectorModel.replaceShape.test.js`の範囲に追加分を足す。実物の組み合わせの例外に`test/edit/EndpointSnapper.test.js`を足す。テストプレイで確かめる部分（`InputTracker`の配線・吸い付きの表示の描画）を「テストできない箇所」に足す。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する。資料本体への反映はタスク11で行う。）
*   （タスク1）追加の影響は上記の12_shapes.md・11.「結合」の項目に含まれる。追加の更新予定なし。
*   （タスク2）`EndpointSnapRules`は上記の12_shapes.md・1章の項目どおり。追加の更新予定なし。

## 3. タスクリスト
*   [x] タスク1: 結合の規則`PathJoinRules`への入口・計画の追加とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` :（更新。追加と内部の整理のみ。既存の関数の振る舞いを変えない）
        *   `./test/shapes/PathJoinRules.test.js` :（更新。ケースの追加のみ）
    *   **作業内容** :
        *   2章要件3・5のとおり、typedef`EndpointRef`（`{ shapeId, end: 'start'|'end' }`）、`buildJoinedPathAt(a, aEnd, b, bEnd, tolerance)`・`buildExtendedPath(shape, end, point, tolerance)`・`canCloseByMergingEnds(shape)`・`planDrawnLineJoin(shapes, drawn, startSnap, endSnap, tolerance)`・`planEndpointDragJoin(shapes, dragged, snap, tolerance)`を`export`で足す。非公開の`planJoinAt`（基準の線＝`shapes`で先の方）・組み立て関数（例：`assembleOpenPath`）・閉じたパスの頂点数の下限の定数（例：`CLOSED_MIN_POINTS = 3`）を足し、`buildJoinedPath`（候補の選び方・優先順・同距離の扱いは変えない）・`classifyJoin`・`buildClosedPath`をそれらで書き換える（振る舞いは変えない）。結果は`JoinPlan`の形。
        *   importは`./Path.js`のみのまま。図形の読み取りは`type`・`id`・`toJSON()`だけ。表示倍率・モデルを知らない。`try/catch`を持たない。引数の図形を書き換えない。結果は元の図形と配列・頂点を共有しない。
        *   JSDoc：先頭行の責務JSDocを、端点を指定した結合・描き足し・吸い付いた端点での操作の計画を含む形に改める（3行以内）。追加した各関数・定数・typedef・非公開関数にJSDoc（`@param`・`@returns`。`null`を返す条件、`aEnd`/`bEnd`/`end`の意味、`tolerance`がワールド座標の長さであること、`shapes`が重なり順で奥が先であること、描き足しは元のidを保つ計画になること、重なる場合は何も起きないこと、`planDrawnLineJoin`は両方`null`なら`null`で呼び出し側が従来の確定を行うこと、`planEndpointDragJoin`はドラッグした頂点がもう一方の端点に置かれている前提で`buildClosedPath`がまとめること）。`buildJoinedPath`のJSDocの「Phase 05-04が使い回す入口」の記述は実装に合わせて改めてよい。
        *   `test/shapes/PathJoinRules.test.js`の末尾に2章要件8の8-1のケースを新しい`describe`として足す（既存のケース・補助関数は変えない。補助関数を足す場合はJSDoc付き）。テストが失敗したら計画とソースのどちらが誤りかを確かめ、テストを計画からずらして通さない。
        *   `node --test`を実行し、`fail 0`と件数を4章の本タスクの欄へ記録する。開発資料への影響は2章の更新予定欄へ追記し（資料本体は修正しない）、迷った点・注意は5章へ追記する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [x] タスク2: 吸い付きの規則`EndpointSnapRules`の新設とそのテスト
    *   **対象ファイル** :
        *   `./js/shapes/EndpointSnapRules.js` :（新規）
        *   `./test/shapes/EndpointSnapRules.test.js` :（新規）
    *   **作業内容** :
        *   2章要件1・5のとおり、`SNAP_TOLERANCE_SCREEN_PX = 8`・typedef`SnapTarget`・`isSnapDrawShapeType(shapeType)`・`resolveEndpointHandle(shape, handleName)`・`findSnapTarget(shapes, point, tolerance, dragged = null)`を状態を持たない`export`の関数と定数で作る（クラスにしない）。importは`./PathJoinRules.js`（`isJoinableLine`・`canCloseByMergingEnds`）のみ。図形の読み取りは`type`（`isJoinableLine`経由）・`id`・`toJSON()`・`getVertexIndexForHandle`だけ。表示倍率・モデル・DOM・操作モードを知らない。`try/catch`を持たない。引数の図形を書き換えない。
        *   候補の選び方は要件1のとおり（末尾の図形から、始点→終点、厳密に小さいときだけ更新、`<= tolerance`）。`dragged`の除外は要件1・5のとおり。
        *   JSDoc：先頭行に単一責務JSDoc（3行以内。例「責務: 端点への吸い付きの規則（吸い付く対象の端点・候補の選び方・吸い付く距離・描く図形種別と端点のハンドルの判定）を、状態を持たない関数と定数として提供する。表示倍率・モデルを知らず、ワールド座標の許容距離を引数で受け取る。」）。各定数・関数・typedefにJSDoc（`@param`・`@returns`。`SNAP_TOLERANCE_SCREEN_PX`が唯一の定義で`JOIN_TOLERANCE_SCREEN_PX`と別であること、換算は呼び出し側、候補の選び方、`dragged`の除外、`resolveEndpointHandle`が「頂点の番号`i`＝`points[i]`」に依ること）。
        *   `test/shapes/EndpointSnapRules.test.js`に2章要件8の8-2の観点を書く（先頭行に単一責務JSDoc、補助関数にJSDoc）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク3: `VectorModel.replaceShape`への引数`select`の追加とそのテスト
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`replaceShape`の引数の追加とそのJSDocのみ）
        *   `./test/core/VectorModel.replaceShape.test.js` :（更新。ケースの追加のみ）
    *   **作業内容** :
        *   2章要件3「選択しない差し替え」のとおり、`replaceShape(targetId, shape, { keepId = false, removeIds = [], select = true } = {})`にする。`select`が偽なら選択集合を新しく作らず、現存しなくなったidだけを外す。それ以外の手順（位置・id・除去・ホバー・通知1回・`#issueId()`）は変えない。既定値で既存の呼び出し元`PathJoiner`の振る舞いが変わらないこと。
        *   JSDoc：手順(5)と前提の記述（`select`が真のときは選択モードであることを呼び出し側が保証）を改め、`@param {boolean} [options.select=true]`を足す。先頭行の責務JSDocは変えない。
        *   `test/core/VectorModel.replaceShape.test.js`に2章要件8の8-3のケースを足す（既存のケース・補助関数は変えない）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（既存の`test/edit/PathJoiner.test.js`も変わらず通ること）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク4: `VectorModel`への吸い付きの表示の点の追加とそのテスト
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`#snapPoint`・`setSnapPoint`・`clearSnapPoint`・`getSnapPoint`の追加と`replaceAllShapes`のクリア対象への追加のみ）
        *   `./test/core/VectorModel.snapPoint.test.js` :（新規）
    *   **作業内容** :
        *   2章要件2のとおり、privateフィールド`#snapPoint`（初期値`null`）、`setSnapPoint(x, y)`（値が変わったときだけ設定して通知1回）、`clearSnapPoint()`（`null`でなかったときだけ通知1回）、`getSnapPoint()`（コピーか`null`）を足し、`replaceAllShapes`の(5)で`#snapPoint`も`null`にする（通知は1回のまま）。他の公開メソッドの処理は変えない。importを足さない。
        *   JSDoc：先頭行の責務JSDocの状態の列挙に「吸い付きの表示の点」を足す（3行以内）。クラスJSDocの保持する状態の列挙、`#snapPoint`（ワールド座標の1点・表示専用・保存しない・設定と消去は`InputTracker`）、各メソッド（`@param`・`@returns`、通知の条件）、`replaceAllShapes`の(5)の列挙に足す。
        *   `test/core/VectorModel.snapPoint.test.js`に2章要件8の8-4の観点を書く（先頭行に単一責務JSDoc、補助関数にJSDoc）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク5: 吸い付きの照会と反映の手順`EndpointSnapper`の新設とそのテスト
    *   **対象ファイル** :
        *   `./js/edit/EndpointSnapper.js` :（新規）
        *   `./test/edit/EndpointSnapper.test.js` :（新規）
    *   **作業内容** :
        *   2章要件3・5・6のとおり、`EndpointSnapper`クラス（`constructor({ model, editRecorder, screenLengthToWorld })`・`findDrawSnap(shapeType, point)`・`resolveDragEndpoint(shapeId, handleName)`・`findDragSnap(dragged, point)`・`commitDrawnLine(startSnap, endSnap)`・`joinDraggedEndpoint(dragged, snap)`）を作る。importは`../shapes/EndpointSnapRules.js`（`SNAP_TOLERANCE_SCREEN_PX`・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`）と`../shapes/PathJoinRules.js`（`JOIN_TOLERANCE_SCREEN_PX`・`planDrawnLineJoin`・`planEndpointDragJoin`）のみ。`model`は`getShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`のみ使う。図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードを持たない（読むのは`id`だけ）。DOMに触れない。`try/catch`を持たない。`InputTracker`に依存しない。
        *   照会の許容距離は`screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX)`、結合の許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`で、呼び出しのたびに換算する。`commitDrawnLine`の手順・`joinDraggedEndpoint`の手順は2章要件3・5のとおり（`commitDrawnLine`は両方`null`なら何も呼ばず`false`、`joinDraggedEndpoint`は`beginEdit`/`commitEdit`を呼ばない）。
        *   JSDoc：先頭行に単一責務JSDoc（3行以内。例「責務: 端点への吸い付きの照会（直線を描くとき・端点のハンドルのドラッグ中）と、吸い付いた端点での描き足し・結合・閉じる操作のモデルへの反映を、規則（`shapes/EndpointSnapRules`・`shapes/PathJoinRules`）に従って行う手順を担う。DOMに触れない。」）、クラスJSDoc（依存の制約・呼び出し元（`main.js`が`InputTracker`へ注入）・前提（`commitDrawnLine`は作成途中の直線があるとき、`joinDraggedEndpoint`は呼び出し側が開いた編集操作の中で選択モードのとき）・通知の回数）、privateフィールド・コンストラクタ（`@param`）・各メソッド（処理順・`@param`・`@returns`）。`editRecorder`の型はJSDocの`import('./ShapeInserter.js').EditRecorder`で参照し、`SnapTarget`・`EndpointRef`は`import('../shapes/...')`で参照する（typedefを新しく定義しない）。
        *   `test/edit/EndpointSnapper.test.js`に2章要件8の8-5の観点を書く（先頭行に単一責務JSDoc、補助関数にJSDoc）。
        *   `main.js`・`InputTracker.js`は変更しない（本タスクの時点では`EndpointSnapper`はどこからも使われない）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク6: `CanvasManager`への吸い付きの表示の描画の追加
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` :（更新。吸い付きの表示の描画のみ）
    *   **作業内容** :
        *   2章要件2のとおり、定数`SNAP_INDICATOR_SIZE = 8`・`SNAP_INDICATOR_FILL_COLOR = '#4a90e2'`・`SNAP_INDICATOR_STROKE_COLOR = '#1f4e8c'`・`SNAP_INDICATOR_LINE_WIDTH = 1.5`と、privateメソッド`#drawSnapIndicator(point, scale)`（倍率の防御・`save`/`restore`・`÷ scale`）を足す。`render`の引数に`snapPoint = null`を足し、作成中の図形の描画の後・選択矩形の描画の前に、非`null`なら描く。他の描画・引数の既定値・順序は変えない。状態を持たない・判定しない。
        *   JSDoc：先頭行の責務JSDocの括弧内に「吸い付きの表示」を足す（3行以内）。`render`のJSDoc（描画順と`@param {{x: number, y: number}|null} [state.snapPoint]`）、各定数、`#drawSnapIndicator`（`@param`）。
        *   `main.js`は変更しない（`snapPoint`が渡されない間は描かれない）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク7: `main.js`の配線（`EndpointSnapper`の生成と注入・描画の引数）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新。配線のみ）
    *   **作業内容** :
        *   `import { EndpointSnapper } from './edit/EndpointSnapper.js';`を足す。
        *   配線ブロック`// 4.`の`new InputTracker(...)`の直前に`const endpointSnapper = new EndpointSnapper({ model, editRecorder: historyManager, screenLengthToWorld: (length) => viewTransform.screenLengthToWorld(length) });`を置き、`new InputTracker(canvas, model, viewTransform, historyManager, endpointSnapper)`とする（コメント：吸い付きの規則は`shapes/EndpointSnapRules`・`shapes/PathJoinRules`、手順は`edit/EndpointSnapper`が担い、`InputTracker`は注入されたものを呼ぶだけ。`core/`は`edit/`をimportしないためここで注入する）。本タスクの時点では`InputTracker`は第5引数を受け取らない（JSの余分な引数は無視されるため起動は壊れない。タスク8で受け取る）。
        *   `renderCurrentState()`の`canvasManager.render`の引数に`snapPoint: model.getSnapPoint()`を足し、JSDocの状態の列挙に吸い付きの表示の点を足す。
        *   既存の配線・関数・コメントは変えない。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響（`main.js`の行数を含む）は2章、迷った点は5章へ）。
*   [ ] タスク8: `InputTracker`の直線を描く流れの配線
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新。要件6の最小限の配線のみ）
    *   **作業内容** :
        *   2章要件3・6のとおり、typedef`EndpointSnapAssist`（メソッド5つ）と既定値`NO_SNAP_ASSIST`（`Object.freeze`。照会は`null`、`commitDrawnLine`・`joinDraggedEndpoint`は`false`）、コンストラクタの第5引数`snapAssist = NO_SNAP_ASSIST`、privateフィールド`#snapAssist`・`#drawStartSnap`・`#drawEndSnap`、privateメソッド`#showSnap(snap)`・`#resetSnapState()`を足す。
        *   配線：`handleMouseMove`（DRAWINGの照会・表示・吸い付きの座標での`updateDraft`、IDLEかつ図形作成モードの照会・表示）、`handleClick`（DRAWINGは`commitDrawnLine`が`false`のときだけ従来の確定、その後IDLE・`#resetSnapState()`。IDLEの図形作成モードは照会・`#drawStartSnap`・表示・吸い付きの座標での`startDraft`）、`setShapeType`（最後に`#resetSnapState()`）、`cancelDraftOrClearSelection`のDRAWINGの分岐（`#resetSnapState()`）、`#abortOngoingOperation`（最後に`#resetSnapState()`。戻り値は変えない）、`#beginPan`（開始できたとき`model.clearSnapPoint()`）。
        *   `InputTracker`に図形種別の分岐・`vertexIndex`規約・吸い付きの規則（探索・距離・候補の選び方）・結果の組み立てを書かない。`SnapTarget`は`x`・`y`だけを読む。import・`OperationMode`・`InputState`・当たり分類・カーソル形状・既存の判定順は変えない。選択モードのホバー・クリック選択・範囲選択・ドラッグの処理は変えない（ハンドルのドラッグの配線はタスク9）。
        *   JSDoc：typedef・既定値・フィールド・補助メソッドのJSDoc、コンストラクタの`@param snapAssist`（実体は`main.js`が注入する`EndpointSnapper`、省略時は吸い付かない）、クラスJSDoc（吸い付きの照会と反映を注入された記録先と同様に注入されたものへ委ねること）、変更した`handleMouseMove`・`handleClick`・`setShapeType`・`cancelDraftOrClearSelection`・`#abortOngoingOperation`・`#beginPan`の処理順の説明（描き終えの端点は直前のmousemoveの照会結果を使うこと、描き始めはクリック位置で照会すること、表示を消す箇所）。先頭行の責務JSDocは変えない。
        *   行数の増分を4章へ記録する（見積もり約+90行）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点・目視確認を推奨する箇所は5章へ）。
*   [ ] タスク9: `InputTracker`の端点のハンドルのドラッグの配線
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新。要件6の最小限の配線のみ）
    *   **作業内容** :
        *   2章要件5・6のとおり、privateフィールド`#dragEndpoint`・`#dragSnap`を足し、`#resetSnapState()`でこれらも`null`にする。
        *   配線：`#beginLeftDrag`（DRAGGING_HANDLEで開始できたとき`resolveDragEndpoint`で`#dragEndpoint`を解決）、`#applyLeftDragUpdate`のDRAGGING_HANDLE（`#dragEndpoint`があれば`findDragSnap`→`#dragSnap`→表示→吸い付きの座標での`updateVertex`。なければ従来どおりカーソル位置）、`#onLeftDragEnd`（範囲選択の確定の後、状態がDRAGGING_HANDLEで`moved`が真かつ`#dragEndpoint`・`#dragSnap`があれば`joinDraggedEndpoint`。その後`#finishLeftDrag()`）、`#finishLeftDrag`（`#resetSnapState()`）。`#onLeftDragCancel`では結合しない（変更しない）。
        *   ハンドルの当たり判定・優先順位（`#classifyPoint`）、`#onLeftDragStart`の記録の開始、MOVING_SELECTION・MARQUEE_SELECTINGの処理は変えない。
        *   JSDoc：フィールドのJSDoc、変更した`#beginLeftDrag`・`#applyLeftDragUpdate`・`#onLeftDragEnd`・`#finishLeftDrag`の処理順の説明（結合・閉じるは開いている編集操作の中で行い、`#finishLeftDrag`の確定で頂点の移動とあわせて1件になること、中断では結合しないこと）。
        *   行数の増分を4章へ記録する（見積もり約+35行）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点・目視確認を推奨する箇所は5章へ）。
*   [ ] タスク10: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   本作業で新設・変更したファイル（`./js/shapes/PathJoinRules.js`・`./js/shapes/EndpointSnapRules.js`・`./js/core/VectorModel.js`・`./js/edit/EndpointSnapper.js`・`./js/core/CanvasManager.js`・`./js/main.js`・`./js/core/InputTracker.js`・5つのテストファイル）:（JSDocの記載漏れがあった場合のみ修正）
        *   本RES :（更新）
    *   **作業内容** :
        *   新設ファイルの先頭行の単一責務JSDoc（3行以内）、各関数・メソッド・クラス・typedef・定数のJSDoc（`@param`・`@returns`・該当すれば`@throws`）、変更した既存の関数・メソッドのJSDoc（特に`InputTracker`の`handleMouseMove`・`handleClick`・`#applyLeftDragUpdate`・`#onLeftDragEnd`・`#finishLeftDrag`の処理順の説明、`VectorModel.replaceShape`・`replaceAllShapes`、`CanvasManager.render`）に漏れがないことを確かめ、漏れがあればJSDocだけを直す（処理は変えない）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。`InputTracker.js`・`main.js`の行数を4章と2章の更新予定欄へ記録する。
        *   4章の全タスクの欄が記入済みであること、2章の更新予定欄・5章が最新であることを確かめ、RESを完成させる。完了時に本タスクを [x] にする。
*   [ ] タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/02_main.md`・`./_doc/arch/03_VectorModel.md`・`./_doc/arch/04_CanvasManager.md`・`./_doc/arch/06_InputTracker.md`・`./_doc/arch/08_HistoryManager.md`・`./_doc/arch/12_shapes.md`・`./_doc/arch/14_edit.md`・`./_doc/arch/16_test.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」欄（各タスクで追記された分を含む）を確かめ、資料へ反映する。記載先と内容は`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従う（1ファイルのJSDocで分かること（引数・戻り値・定数の値・1クラス内の処理順）は書かず、責務・知らないこと・依存方向・モジュールをまたぐ流れと順序・誰が呼ぶか/注入するか・設計判断の理由・やらないと決めたこと・公開メソッド名の一覧を書く）。新しいモジュールは各フォルダのファイル（`12_shapes.md`・`14_edit.md`）に節を足す（4章の一覧の行はフォルダ単位のため足さない）。
        *   反映の前に実コードを読み、更新予定欄の記述と実装が食い違う箇所は実装に合わせる（食い違いは5章に記録する）。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、**この最終タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。
        *   コードは変更しない。`node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（反映での判断・注意は5章へ）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 結合の規則`PathJoinRules`への入口・計画の追加とそのテスト
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：先頭の責務JSDocを更新。非公開定数`CLOSED_MIN_POINTS = 3`、typedef`EndpointRef`、`export`の`buildJoinedPathAt`・`buildExtendedPath`・`canCloseByMergingEnds`・`planDrawnLineJoin`・`planEndpointDragJoin`、非公開の`assembleOpenPath`・`indexOfShape`・`planJoinAt`・`planCloseOf`を追加。`buildJoinedPath`は候補選択を変えず末尾を`assembleOpenPath`呼び出しに、`classifyJoin`・`buildClosedPath`は下限を`CLOSED_MIN_POINTS`に置き換え（振る舞い不変）。`buildJoinedPath`のJSDocの「Phase 05-04が使い回す入口」を実装に合わせて改めた。importは`./Path.js`のみのまま。
    *   `test/shapes/PathJoinRules.test.js`：import行に追加分を足し、末尾に8-1のケースを新しい`describe`で追加（補助関数`withId`・`ref`・`assertPathInvariant`にJSDoc付き）。既存のケース・補助関数は変更なし。
    *   `node --test`：tests 595 / pass 595 / fail 0（計画時563、本タスクで+32）。

### タスク2: 吸い付きの規則`EndpointSnapRules`の新設とそのテスト
*   **作業内容** :
    *   `js/shapes/EndpointSnapRules.js`（新規）：先頭に責務JSDoc。`export`の`SNAP_TOLERANCE_SCREEN_PX = 8`・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`、typedef`SnapTarget`。importは`./PathJoinRules.js`の`isJoinableLine`・`canCloseByMergingEnds`のみ。状態なし・`try/catch`なし。`findSnapTarget`は末尾の図形から、始点→終点、`d <= tolerance`かつ厳密に小さいときだけ更新。`dragged`の図形は`dragged.end`の端点を除き、もう一方は`canCloseByMergingEnds`が真のときだけ対象。
    *   `test/shapes/EndpointSnapRules.test.js`（新規）：8-2の観点（定数・`isSnapDrawShapeType`・`resolveEndpointHandle`・対象・距離の境界（3-4-5の直角三角形・軸方向）・候補の選び方・`dragged`の除外・図形0個・非破壊）。
    *   `node --test`：tests 615 / pass 615 / fail 0（タスク1後595、本タスクで+20）。

### タスク3: `VectorModel.replaceShape`への引数`select`の追加とそのテスト
*   **作業内容** :
    *   （未記入）

### タスク4: `VectorModel`への吸い付きの表示の点の追加とそのテスト
*   **作業内容** :
    *   （未記入）

### タスク5: 吸い付きの照会と反映の手順`EndpointSnapper`の新設とそのテスト
*   **作業内容** :
    *   （未記入）

### タスク6: `CanvasManager`への吸い付きの表示の描画の追加
*   **作業内容** :
    *   （未記入）

### タスク7: `main.js`の配線（`EndpointSnapper`の生成と注入・描画の引数）
*   **作業内容** :
    *   （未記入）

### タスク8: `InputTracker`の直線を描く流れの配線
*   **作業内容** :
    *   （未記入）

### タスク9: `InputTracker`の端点のハンドルのドラッグの配線
*   **作業内容** :
    *   （未記入）

### タスク10: JSDocの確認とRESの完成
*   **作業内容** :
    *   （未記入）

### タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント

### 計画時の確認・判断
*   **手順を`edit/`に置き、`InputTracker`へ注入する形にした**：`PROJECT_ARCHITECTURE.md` 3章11.・`12_shapes.md`には「Phase 05-04では`core/`からも可」とあるが、`core/`に手順を置くと`InputTracker`が型を知るモジュールを直接importすることになり、05-03の`PathJoinRules`（規則）・`PathJoiner`（手順）の分け方とも揃わないため、`edit/EndpointSnapper`を`main.js`が生成して注入する形を採った。`edit/`が`shapes/`の規則をimportする例外が`PathJoiner`に加えて1つ増える（開発資料に書く）。
*   **描き足しは元のidを保つ**（REQ要件3-1）：05-03の2本の結合（新しいid）と異なり、閉じる操作（元のid）と同じ扱い。計画は`keepId: true`。
*   **足す頂点が端点と重なる場合は何も起きない**（2章要件3の3-1）：05-03の規則を当てはめると元の線と同じ形になるため。
*   **描き終えの端点は直前のmousemoveの照会結果**：従来も作成途中の図形の終点は直前のmousemoveの位置で確定しており、クリック位置で取り直すと既存の振る舞い（吸い付きなしの直線の終点）を変えるため。描き始めは従来どおりクリック位置で決まるため、クリック位置で照会する。
*   **表示の枠の色・太さ**：枠`#1f4e8c`（濃い青）・画面上1.5px（計画時の決定。REQ要件2で委任）。テストプレイで見分けにくければ定数だけ変える。
*   **キャンバス外へカーソルが出た場合**：何もしない（次のmousemoveで正しくなる。REQ要件2で委任）。
*   **図形クラス・`ShapeFactory`・`io/`・`PathJoiner`は変更しない見込み**。`Path`の`updateDraftEnd`（現在は呼ばれない）も使わない（作成途中の図形は常に直線のため）。

### テストプレイの確認項目（操作手順と期待する結果）
テストプレイ用の作業データ（直線・頂点2つ／3つ／4つ以上の開いたパス・閉じたパス・曲線・矩形・円・弧を含むもの）は現場設計AIが用意する。
1.  **描き始めの吸い付きと表示**：図形作成モード・直線で、直線の端点の近く（画面上8px以内）にカーソルを動かす → 端点に中を青で塗った正方形が1つ出る。8pxより離すと消える。直線の両端・開いたパスの両端で同じ。
2.  **吸い付かない点**：同じ状態で、曲線・矩形・円・弧の点、閉じたパスの頂点、開いたパスの途中の頂点に近づける → 表示は出ない。そこから描くと独立した直線になる。
3.  **直線以外の種別**：図形種別を曲線・矩形・円・弧にして端点に近づける → 表示は出ず、描いた図形は従来どおり（吸い付かない）。直線を描いている途中で数字キー等で図形種別を切り替える → 作成途中の直線と表示が消える。
4.  **直線から描き足す**：直線の端点で描き始め、離れた位置で描き終える → 直線が頂点3つの開いたパスになる（同じ色・太さ、元の直線の向きのまま、描いた線の色は使わない）。選択モードで選ぶと頂点のハンドルが3つ出る（同じ図形）。始点側・終点側の両方で確かめる。
5.  **端点で描き終えて描き足す**：端点から離れた位置で描き始め、開いたパスの端点で描き終える → そのパスに頂点が1つ足される（別の図形にならない）。描いている途中の直線は吸い付いた端点まで伸びる。
6.  **他の線と結合**：直線Lの端点で描き始め、別の直線Mの端点で描き終える → LとMが描いた区間でつながった1本の開いたパスになる（色・太さ・向きは奥（先に描いた）の線のもの。元の2本は消える）。Mの吸い付く端点が、Lの描き始めた端点からいちばん近い端点でない場合も、吸い付いた端点どうしがつながる。
7.  **閉じる**：頂点3つ以上の開いたパスの一方の端点で描き始め、もう一方の端点で描き終える → 閉じたパスになる（同じ図形、頂点の並びはそのまま）。
8.  **閉じられない場合・同じ端点**：直線（または頂点2つのパス）の一方の端点で描き始め、もう一方の端点で描き終える → 何も起きない（描いた線も追加されない。Undoの履歴も増えない）。同じ端点で描き始めて描き終える → 何も起きない。
9.  **独立した直線**：端点から離れた位置で描き始め・描き終える → 従来どおり独立した直線（既存の振る舞い）。
10. **Undo/Redo**：4〜7の各操作の直後に取り消し1回 → 操作前の状態（元の線が同じ形・同じ重なり順）に戻る。やり直し1回 → 操作後に戻る。図形作成モードのまま行っても選択ハンドルは出ない。
11. **描き途中の取り消し**：端点から描き始めた後、描き終える前に`Esc`・モードの切り替え・図形種別の切り替え・取り消し（`Ctrl`+`Z`） → 作成途中の直線が消え、元の線は変わらない。履歴も増えない（`Esc`の後に`Ctrl`+`Z`すると、その前の操作が取り消される）。
12. **続けて描き足す**：描き足した直後に、できた線の端点から続けて描き始め・描き終えを繰り返す → 毎回同じ図形に頂点が足されていく。最後に始点で描き終えると閉じる。
13. **ハンドルのドラッグ（結合）**：選択モードで直線を選び、その端点のハンドルを別の直線の端点の近くまでドラッグする → 吸い付いて表示が出る。離す → 1本の開いたパスになり、結果だけが選択される。Undo1回 → ドラッグ前の位置・2本に戻る。Redo1回 → 結合後に戻る。
14. **ハンドルのドラッグ（閉じる）**：頂点4つ以上の開いたパスを選び、端点のハンドルをもう一方の端点までドラッグして離す → 閉じたパス（重なった2頂点が1つにまとまり、頂点数が1つ減る）。頂点3つのパス・直線ではもう一方の端点に吸い付かない（表示が出ず、離すと頂点が動くだけ）。
15. **ハンドルのドラッグで吸い付かない場合**：パスの途中の頂点のハンドル、閉じたパス・曲線・矩形・円・弧のハンドル、直線の移動（中点）ハンドル、本体のドラッグ → 吸い付かず表示も出ない（従来どおり）。端点のハンドルでも吸い付く範囲の外で離すと頂点が動くだけ。
16. **ドラッグの中断**：端点のハンドルを吸い付かせたままウィンドウのフォーカスを外す（別のウィンドウを押す等） → 結合・閉じるは起きず、頂点は中断した位置に残り、表示は消える。
17. **表示倍率と距離**：拡大・縮小（例：25%・400%）して1・13を繰り返す → 吸い付く距離が画面上で約8pxのまま、表示の正方形の大きさも画面上で一定。
18. **表示の消し忘れ**：表示が出ている状態で、モードの切り替え（選択・キャンバス移動）・図形種別の切り替え・描き終え・`Esc`・パンの開始（スペース＋ドラッグ・中ボタン）・取り消し/やり直し・キャンバスの切り替えや開く（ファイル）・インポートを行う → 古い表示が残らない。選択モードでカーソルを動かすだけでは表示は出ない。キャンバス外へカーソルを出した場合は、次にキャンバス上で動かしたときに正しい表示になる（計画時の決定）。
19. **保存・書き出し**：描き足し・結合・閉じる操作で作ったパスを含むキャンバスを出力（作業ファイル）して開き直す → 同じ形・色・太さ・閉じているかで戻る。出力（エンジン用）したJSを`sprite-check.html`で開く → エディタと同じ見た目で描かれる。
20. **既存の操作**：直線以外の図形の作成・クリック選択・範囲選択・移動・端点以外のハンドル操作・削除・複製/コピー＆ペースト・結合ボタンとキー`J`・取り消し/やり直しがこれまでどおり動く。

### 実装時の注意・将来の注意
*   **パンの後に動かさずに描き終えた場合**：パンの開始で表示は消すが、`#drawEndSnap`（作成途中の直線の終点と対応する照会結果）は残すため、中ボタンのパンの後にカーソルを動かさずに左クリックで描き終えると、表示の無いまま最後の照会結果で結合・描き足しになり得る（従来もパン前の終点で確定する振る舞いと揃えた）。ホイールでズームした後に動かさずに描き終えた場合も、直前のmousemoveの照会結果を使う。違和感があればテストプレイで指摘を受けて見直す（クリック位置で取り直すと既存の確定位置が変わる点に注意）。
*   **精度のPhaseで`InputTracker`を再分離するとき**：吸い付きの作業用フィールド（`#drawStartSnap`・`#drawEndSnap`・`#dragEndpoint`・`#dragSnap`）は入力状態（`DRAWING`・`DRAGGING_HANDLE`）と寿命が同じで、`#resetSnapState()`を呼ぶ箇所（描き終え・取り消し・図形種別の切り替え・中断・左ドラッグの後始末）が`InputState`の遷移と対応している。状態の所有者を分けるときは、この対応（遷移のたびに消すこと）を崩さないこと。表示の状態は`VectorModel`にあり、消す責任は`InputTracker`にある。
*   **スナップの対象を広げるとき**（精度のPhase：曲線・矩形・円・弧の点、整数px・グリッド）：現在の`SnapTarget`は「結合できる線の端点」専用で、`EndpointSnapper`の反映（描き足し・結合・閉じる）と1対1になっている。結合を伴わない吸い付きを足す場合は、照会の結果に「吸い付くだけで結合しない」種類を区別する項目を足し、`commitDrawnLine`・`joinDraggedEndpoint`が結合しない吸い付きを結合として扱わないようにすること。修飾キーによる一時無効は、照会の呼び出し側（`InputTracker`）でキーの状態を渡す形が候補。
*   **規則の共有**：`PathJoinRules`の非公開の組み立て関数を`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が共有するため、頂点の並べ方・まとめ方を変えると3つが同時に変わる（`test/shapes/PathJoinRules.test.js`の全ケースで確かめる）。
*   **`EndpointSnapRules.resolveEndpointHandle`の前提**：「頂点の番号`i`＝図形データの`points[i]`」に依る。新しい結合できる線の種類を足すときや、`Line`・`Path`の頂点の番号の約束を変えるときは見直す。
*   （タスク1で追記）`planDrawnLineJoin`は`drawn`を、片側のみ吸い付いた場合にだけ`toJSON().points`で読む（両方null・両方吸い付きでは読まない）。`startSnap`/`endSnap`は`null`で渡す前提（`undefined`は未対応。`planEndpointDragJoin`の`snap`のみ`undefined`も`null`として扱う）。`planCloseOf`は同じ線を閉じる計画を`planDrawnLineJoin`と`planEndpointDragJoin`で共有する非公開関数（計画書に名前の無い追加）。
