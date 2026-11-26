# RES: 作業計画・作業レポート Phase 12-03 : 頂点への吸い付き（結合しない）
* 参照元REQ: `./_log/req/261127_0032_REQ_Phase12-03_Vertex_Snap.md`

## 1. 作業目的
隣り合う塗りのすき間を防ぐため、ほかの図形の頂点（パスのすべての点・矩形の4つの角・直線の両端・今の曲線の始点と終点・弧の両端・円と弧の中心）に、点をぴったり合わせられるようにする（**吸い付くだけ**。離しても・クリックしても結合しない）。働く場面は、頂点の選択（`A`）での点のドラッグ（1つ・2つ以上）、直線・曲線のツールの描き始め・引いている途中・描き終え、矩形のツールの2つの角、円・弧のツールの中心。表示は、今の**結合する吸い付き**（中を青で塗った正方形）と見分けられる中が白の正方形にする。今の結合する吸い付き（描き足し・結合・閉じる・自分の始点で閉じる・分割した直後の重なった端の点の結合し直し）、「`Ctrl`の間は何にも吸い付かない」、「吸い付いたら丸めない・吸い付かなかったときだけ丸める」、頂点のまとめ移動の「アンカーの行き先をそのまま渡す」設計は変えない。取り消しは操作と一緒に1回、作業データ・書き出し形式の版は上げない。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **結合する吸い付き**：今の、結合できる線の端点への吸い付き（結果は`SnapTarget`＝`{ shapeId, end, x, y }`）と、線を引いている途中の自分の始点への吸い付き（結果は`DrawnStartSnap`＝`{ kind: 'drawnStart', x, y }`）。離す・クリックすると描き足し・結合・閉じるになる。表示は中を青で塗った正方形（■）。
*   **吸い付くだけ（頂点への吸い付き）**：今回足す吸い付き。結果は新しい`VertexSnap`＝`{ kind: 'vertex', x, y }`（`shapeId`・`end`を持たない）。離しても・クリックしても結合しない。表示は中が白の正方形（□）。
*   **吸い付く先の頂点**：変えられる図形（`model.getEditableShapes()`）の次の点。パス＝`points`のすべて（開いた・閉じたとも）、矩形＝4つの角、直線＝両端、今の曲線＝始点・終点（制御点は除く）、弧＝両端（`PathJoinRules.lineEndpointOf`が中心と半径から求める点）と中心（`points[0]`）、円＝中心（`points[0]`）。曲がり方を持つ区間の引っ張る点（`control1`・`control2`）は含めない。
*   **動かしている点を持つ図形**：頂点のドラッグでは`#vertexDragOrigins`に入っている図形のすべて（1つでも2つ以上でも）。線を引いている途中では、描き始めが結合する吸い付き（`SnapTarget`）のときのその線（描き足しで結果がその線になるため。下の5章の計画で決めたこと(a)）。作成途中の図形は`getEditableShapes()`に入っていないため、もともと候補にならない。動かしている点を持つ図形の点は**吸い付くだけの候補にしない**（結合する吸い付きの候補は今のまま＝自分のもう一方の端点で閉じる・自分の始点で閉じるは今までどおり）。
*   **選び方**：結合する吸い付きの候補（今の規則で選んだ1つ）と吸い付くだけの候補（吸い付く先の頂点のうちいちばん近い1つ）のうち、照会した点（丸めていないカーソル位置）に近い方。**同じ距離なら結合する吸い付き**。距離は画面上8px（`SNAP_TOLERANCE_SCREEN_PX`。ちょうどを含む）をその時点の表示倍率でワールドへ換算した値以下。同じ距離の頂点どうしは、今の端点の走査と同じく前面の図形・図形の中では点の並びの前の方。
*   **スナップ（丸め）**：3章17.の丸め。吸い付き（結合する・だけ）とは別の機能で、用語を混ぜない。

### 最初の表（場面ごとの結果。テストはこの表の欄ごとに書く）
各欄は「吸い付くか・表示（■＝中を塗った四角／□＝中が白の四角／なし）・離したとき（クリックしたとき）に結合するか」。共通：吸い付いたときはその点の座標をそのまま使い丸めない、吸い付かなかったときは今までどおりスナップで丸める（`Ctrl`なら丸めない）。吸い付く先は変えられる図形の点だけ。

| 場面 | 近くにあるのが結合できる線の端点のとき | 近くにあるのがそれ以外の頂点のとき | 両方が近いとき | `Ctrl`を押しているとき |
| --- | --- | --- | --- | --- |
| 頂点の選択で1つの点をドラッグ（端点＝直線の両端・開いたパスの始点と終点・今の曲線の始点と終点） | 吸い付く・■・離すと結合（別の線の端点）／閉じる（自分のもう一方の端点。頂点4つ以上の開いたパスだけ。それ以外の自分の端点には吸い付かない）。今までどおり | 吸い付く・□・結合しない（自分の図形の頂点は候補にしない） | いちばん近い方。同じ距離なら結合する吸い付き（■・離すと結合） | 吸い付かない・なし・結合しない |
| 頂点の選択で1つの点をドラッグ（端点でない点＝パスの途中の点・閉じたパスの点・矩形の角・今の曲線の制御点） | 吸い付く（吸い付くだけ）・□・結合しない | 吸い付く・□・結合しない | いちばん近い点・□・結合しない | 吸い付かない・なし・結合しない |
| 頂点の選択で2つ以上の点をまとめてドラッグ（押した点が端点でも） | 押した点だけが吸い付く・□・結合しない（ほかの選んだ点は押した点と同じ量だけ動く） | 押した点だけが吸い付く・□・結合しない（同上） | いちばん近い点・□・結合しない（同上） | 吸い付かない・なし・結合しない（丸めない） |
| 直線・曲線のツールの描き始め（1点目のクリック。描き始める前の`mousemove`の表示も同じ） | 吸い付く・■・その端点から描き始める（終えると描き足し・つながる・閉じる）。今までどおり | 吸い付く・□・新しい線として描き始める（描き足しにならない） | いちばん近い方。同じ距離なら結合する吸い付き（■） | 吸い付かない・なし・新しい線（丸めない） |
| 直線・曲線のツールの引いている途中（付いてくる線の先と、そこでのクリック） | 吸い付く・■・クリックでその線とつながって終える。自分の始点（打った点が3つ以上で描き始めが端点でないとき）も■で、クリックで閉じる。今までどおり（描き始めの端点は候補にしない） | 吸い付く・□・クリックでその位置に点を打って引き続ける（終えない・結合しない）。描き始めが端点のときのその線の頂点は候補にしない | いちばん近い方。同じ距離なら結合する吸い付き（自分の始点を含む。■） | 吸い付かない・なし・クリックで点を打つ（`Shift`の限定は働く・丸めない） |
| 直線・曲線のツールの描き終え（クリックで終える・`Esc`・ツールの切り替え） | ■でクリック＝つながって終える・閉じる（今までどおり） | □でのクリックは終えずに点を打つ。その点で終えるには同じ位置でもう一度クリック（最後の点と重なる）・`Esc`・ツールの切り替え（開いたまま終える）。描き始めが□だった線は新しい線として確定する（結合しない） | 上の行と同じ | 吸い付かない・なし（ただし`Ctrl`を押す前の照会結果が残る今の注意は同じ。3章12.） |
| 矩形のツールの1つ目の角（描き始める前の表示も同じ） | 吸い付く・□（端点も頂点として扱う）・結合しない | 吸い付く・□・結合しない | いちばん近い点・□・結合しない | 吸い付かない・なし（丸めない） |
| 矩形のツールの2つ目の角（`mousemove`と、クリックでの確定） | 吸い付く・□・結合しない（クリックで矩形として確定。`commitDraft`） | 吸い付く・□・結合しない（同上） | いちばん近い点・□・結合しない（同上） | 吸い付かない・なし（丸めない） |
| 円・弧のツールの中心（1つ目のクリック。描き始める前の表示も同じ） | 吸い付く・□・結合しない | 吸い付く・□・結合しない | いちばん近い点・□・結合しない | 吸い付かない・なし（丸めない） |
| 円・弧のツールの2つ目の点 | 吸い付かない・なし・今までどおりスナップで丸める | 同左 | 同左 | 吸い付かない・なし（丸めない） |

### 要件1：吸い付く先と選び方（規則。`shapes/EndpointSnapRules.js`の更新・`shapes/VertexSnapRules.js`の新規）
*   **`EndpointSnapRules.js`（更新。結果は変えない）**：走査と距離の測り方を、吸い付くだけの規則と共有できる形で1か所に出す。
    *   `export function snapDistance(a, b)`：`Math.hypot(a.x - b.x, a.y - b.y)`。吸い付きの距離の測り方の唯一の箇所（今の`findNearestEndpoint`と`findDrawnLineSnapTarget`の始点の判定の`Math.hypot`をこれに置き換える。`hypot`は差の符号によらず同じ値のため結果は変わらない）。
    *   `export function findNearestSnapPoint(shapes, point, tolerance, pointsOf)`：吸い付く先の点の走査の唯一の箇所。`shapes`を末尾（前面）から先頭へ、各図形は`pointsOf(shape)`が返す配列（`{ x, y, ...}`の候補。並びの順）の順に調べ、`snapDistance(候補, point)`が`tolerance`以下で、かつそれまでの最小より厳密に小さいときだけ更新する。戻り値は`{ shape, candidate, distance }`（無ければ`shape`・`candidate`は`null`・`distance`は`Infinity`）。`candidate`は`pointsOf`が返したオブジェクトそのもの。引数を書き換えない。
    *   非公開`findNearestEndpoint(shapes, point, tolerance, isExcluded)`の本体を、`pointsOf`＝「結合できる線なら`toJSON()`を1回読み、`'start'`→`'end'`の順に`isExcluded`が偽の端点を`{ end, x, y }`（座標は`lineEndpointOf`）で返す。結合できる線でなければ空」として`findNearestSnapPoint`を呼び、`{ target: { shapeId, end, x, y } | null, distance }`へ直す形に書き換える（名前・引数・戻り値・走査の順・同じ距離の扱いは不変）。`findSnapTarget`・`findDrawnLineSnapTarget`・`resolveEndpointHandle`・`isSnapDrawShapeType`・定数・typedefは変えない。
    *   ファイル先頭の責務（3行以内）に「吸い付く先の点の走査（いちばん近い点の選び方）と距離の測り方（吸い付くだけの規則`VertexSnapRules`と共有）」を足す。
*   **`VertexSnapRules.js`（新規。`shapes/`の図形をまたぐ規則。状態を持たない`export`した関数と定数のみ）**：
    *   import：`./EndpointSnapRules.js`の`findNearestSnapPoint`・`snapDistance`、`./PathJoinRules.js`の`lineEndpointOf`、`./PathVertexRules.js`の`outlineSourceOf`だけ（`EndpointSnapRules`・`PathJoinRules`・`PathVertexRules`はこのファイルをimportしないため循環しない）。
    *   `export const VERTEX_SNAP_KIND = 'vertex'`（吸い付くだけの結果の種類の値の唯一の定義箇所）。typedef`VertexSnap`＝`{ kind: 'vertex', x, y }`（`shapeId`・`end`を持たず`PathJoinRules`の`EndpointRef`を満たさない。`planDrawnLineJoin`・`planEndpointDragJoin`・`EndpointSnapper`の`commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`joinDraggedEndpoint`へ結合として渡してはならず、`EndpointSnapper`が`isVertexSnap`で先に外す）。`SnapTarget`には`kind`を足さない（今の`DrawnStartSnap`と同じ区別の仕方＝`kind`の有無と値）。
    *   `export function isVertexSnap(snap)`：`null`・`undefined`でなく`snap.kind === VERTEX_SNAP_KIND`なら真（`DrawnStartSnap`・`SnapTarget`は偽）。判定の唯一の箇所。
    *   `export function snapVerticesOf(shape)`：吸い付く先の頂点を図形から読む唯一の箇所（図形の種類ごとの分岐はここだけ）。`shape.toJSON()`を1回読み、(1)`outlineSourceOf(data)`が`null`でない（直線・矩形・今の曲線・パス）ならその`points`（直線＝両端、矩形＝4つの角、今の曲線＝始点・終点（`chainSourceOf`の読み替え。制御点は入らない）、パス＝`points`のすべて。引っ張る点は`segments`側にあり入らない）、(2)`type`が`'arc'`なら`[lineEndpointOf(data, 'start'), lineEndpointOf(data, 'end'), 中心]`、(3)`'circle'`なら`[中心]`、(4)それ以外は空。中心は図形データの`points[0]`（2章の約束。写しを返す）。弧の頂上・`points[1]`〜`[4]`は入らない。戻り値は新しい`{ x, y }`の配列で、引数を書き換えない。
    *   `export function findVertexSnapTarget(shapes, point, tolerance, excludedShapeIds = [])`：`findNearestSnapPoint(shapes, point, tolerance, (shape) => excludedShapeIds.includes(shape.id) ? [] : snapVerticesOf(shape))`の結果から`{ kind: VERTEX_SNAP_KIND, x, y }`（新しいオブジェクト）を返す。無ければ`null`。`shapes`は`model.getEditableShapes()`の並び（奥が先）を想定。
    *   `export function chooseSnapTarget(point, joinSnap, vertexSnap)`：結合する吸い付きと吸い付くだけの選び方の唯一の箇所。`joinSnap`（`SnapTarget`・`DrawnStartSnap`・`null`）が`null`なら`vertexSnap`（無ければ`null`）、`vertexSnap`が`null`なら`joinSnap`、両方あれば`snapDistance(joinSnap, point) <= snapDistance(vertexSnap, point)`なら`joinSnap`、そうでなければ`vertexSnap`（同じ距離なら結合する吸い付き）。どちらも距離は照会の段階で許容距離以内のため、ここでは許容距離を見ない。引数をそのまま返す（写さない）。
    *   `export function isVertexSnapDrawStartShapeType(shapeType)`：描き始め（1点目）で吸い付くだけが働く描く図形種別か。`'line'`・`'curve'`・`'rect'`・`'arc'`・`'circle'`で真、それ以外（`'path'`・未知の値）は偽。
    *   `export function isVertexSnapDrawEndShapeType(shapeType)`：弧・矩形・円のツールの2つ目の点（`DRAWING`の`mousemove`）で吸い付くだけが働く種別か。`'rect'`だけ真（円・弧の2つ目の点は外接する四角の角に当たり、頂点に合わせても円がその頂点を通らないため吸い付かせない。発注者の決定 2026-11-27。直線・曲線のツールの2点目以降は作成途中の線の照会で扱うためここでは偽）。
    *   ファイル先頭の責務（3行以内）：吸い付くだけ（ほかの図形の頂点への吸い付き。結合しない）の規則（図形から吸い付く先の頂点を読むこと・いちばん近い頂点・描くツールごとに働く点・結合する吸い付きとの選び方）を状態を持たない関数と定数として提供する。表示倍率・モデル・操作モードを知らない。
*   **置き場所の理由**：`EndpointSnapRules`の責務は「結合できる線の端点」の規則で、頂点の読み方・吸い付くだけの種類は別の責務のため新しいファイルにする（憲法3章）。走査と距離は1か所に保つため`EndpointSnapRules`に出し、`VertexSnapRules`がそれを使う向きにする（逆向きにすると`EndpointSnapRules`が吸い付くだけを知ることになる）。頂点の読み方は図形の種類の分岐を伴うため`shapes/`の規則に置き、`core/`・`edit/`へ持ち込まない。図形クラスの共通メソッドは足さない（共通メソッド契約は18のまま）。点の読み方は`outlineSourceOf`・`lineEndpointOf`を使い、写しを作らない。
*   **使う側の列挙（JSDocだけ。コードは変えない）**：新しく`VertexSnapRules`から使う既存の関数のうち、JSDoc・責務に使う側（共有先）を列挙しているものに`VertexSnapRules`を足す。`PathJoinRules.js`の`lineEndpointOf`のJSDocの「使う側は`PathJoinRules`の中（…）と`EndpointSnapRules`（`findNearestEndpoint`）」に「・`VertexSnapRules`（`snapVerticesOf`。弧の両端）」を足す。`PathVertexRules.js`の`outlineSourceOf`のJSDocは使う側を列挙していないため変えず、ファイル先頭の責務の「`PathSegmentKindRules`・`PathSplitRules`へ渡す共有の箇所」に`VertexSnapRules`を足す（3行以内のまま）。`EndpointSnapRules`の`findNearestSnapPoint`・`snapDistance`は新しい関数のため、タスク1で使う側（このファイルと`VertexSnapRules`）を書く。

### 要件2・3・5：照会の手順と、結合への渡し方（`edit/EndpointSnapper.js`の更新）
*   **今の公開メソッドは変えない**（`findDrawSnap`・`findDragSnap`・`findDrawnLineSnap`は「結合する吸い付きだけの照会」として名前・引数・結果をそのまま残し、下の新しいメソッドの中で結合する吸い付きの候補を得るのに使う。`InputTracker`はこの3つを呼ばなくなる）。
*   **新しい公開メソッド（照会だけ。モデル・記録先を変えない・通知しない）**：許容距離はどれも`screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX)`、図形は`model.getEditableShapes()`。
    *   `findDrawStartSnap(shapeType, point)`：描き始め（図形作成モードのIDLEの`mousemove`の表示と1点目のクリック）。`joinSnap = this.findDrawSnap(shapeType, point)`（直線・曲線のツールだけ結果が出る）。`isVertexSnapDrawStartShapeType(shapeType)`が偽なら`joinSnap`を返す。真なら`chooseSnapTarget(point, joinSnap, findVertexSnapTarget(図形, point, 許容距離, []))`。
    *   `findDrawEndSnap(shapeType, point)`：弧・矩形・円のツールの2つ目の点（`DRAWING`の`mousemove`）。`isVertexSnapDrawEndShapeType(shapeType)`が偽なら`null`（`screenLengthToWorld`も呼ばない）、真なら`findVertexSnapTarget(図形, point, 許容距離, [])`。結合する吸い付きは返さない（今もこの場面では`findDrawSnap`が`null`）。
    *   `findDrawnLinePointSnap(startSnap, point)`：線を引いている途中の`mousemove`。作成途中の図形が無ければ`null`。`joinSnap = this.findDrawnLineSnap(startSnap, point)`、`usable = this.#toUsableSnap(startSnap)`、除く図形＝`usable`が`null`・`undefined`でも始点への吸い付きでもない（＝`SnapTarget`）なら`[usable.shapeId]`、それ以外は`[]`。`chooseSnapTarget(point, joinSnap, findVertexSnapTarget(図形, point, 許容距離, 除く図形))`。
    *   `findVertexDragSnap(dragged, movingShapeIds, point)`：頂点のハンドルのドラッグの更新。`dragged`（`{ shapeId, end }`。動かす点が1つで端点のハンドルのときだけ。それ以外は`null`）が`null`でなければ`joinSnap = this.findDragSnap(dragged, point)`、`null`なら`joinSnap = null`（**2つ以上・端点でない点では結合する吸い付きを照会しない**）。`chooseSnapTarget(point, joinSnap, findVertexSnapTarget(図形, point, 許容距離, movingShapeIds))`。`movingShapeIds`は動かしている点を持つ図形のidの配列（重なりを許す。`InputTracker`が`#vertexDragOrigins`から渡す）。
    *   `isVertexSnap(snap)`：`VertexSnapRules.isVertexSnap(snap)`の結果（表示を□にするかの照会。`InputTracker`が結果の種類を解釈しないための受け渡し）。
*   **結合への渡し方（吸い付くだけを結合として扱わない唯一の関門）**：非公開`#toUsableSnap(snap)`の先頭で、`isVertexSnap(snap)`なら`null`を返す（JSDocを「結合に使える吸い付き」に直す）。`#toUsableSnap`は今`commitDrawnLine`（両方）・`clickDrawnLine`（両方）・`finishDrawnLine`・`findDrawnLineSnap`（`startSnap`）の冒頭で通るため、吸い付くだけの結果は次のとおり`null`と同じに扱われる：
    *   `commitDrawnLine(□, □)` → 両方`null`で何もせず`false`（弧・矩形・円のツールの描き終えで`InputTracker`が今までどおり`commitDraft`する）。`commitDrawnLine(□, ■)`は`(null, ■)`と同じ（描き足し）。
    *   `clickDrawnLine(start, □)` → 番号は`js/edit/EndpointSnapper.js`の`clickDrawnLine`のJSDocの「処理順」（1.作成途中の図形が無ければ`false`・2.始点への吸い付きで閉じる・3.最後の点と重なる・4.端点への吸い付きでつながって終える・5.点を打つ）のもの。□は`null`と同じになるため2.・4.に当たらず（3.の「最後の点と重なる」は今までどおり先に見る）、5.で点を打って`true`（付いてくる線の先は`InputTracker`が直前の`mousemove`で吸い付いた座標へ動かしてあるため、その位置に点が打たれる）。`PROJECT_ARCHITECTURE.md` 3章22.の「クリックの判定の順」の番号（作成途中の図形が無い場合を数えない1.〜4.）では、1.（始点で閉じる）・3.（端点への吸い付き）に当たらず、2.（最後の点と重なる）を先に見て、4.（点を打つ）になる。
    *   描き始めが□の線は、`findDrawnLineSnap`・`clickDrawnLine`・`finishDrawnLine`で描き始めの吸い付きが無い線として扱われる（新しい線。打った点が3つ以上なら自分の始点に吸い付ける）。
    *   `joinDraggedEndpoint(dragged, snap)`の冒頭にも`snap = this.#toUsableSnap(snap)`を足す（□なら`null`で`planEndpointDragJoin`が`null`＝`false`、モデルに触れない。変えられなくなった図形の端点も`null`になるが、今も`planEndpointDragJoin`が`getEditableShapes()`で計画を作れず`false`のため結果は同じ）。
    *   `PathJoinRules`の結合の計画（`planDrawnLineJoin`・`planEndpointDragJoin`ほか）のコードは変えない（`VertexSnap`を知らない。`EndpointSnapper`の関門の後にしか呼ばれない）。`PathJoinRules.js`で変えるのは`lineEndpointOf`のJSDocの使う側の列挙だけ（タスク2。『要件1』の「使う側の列挙」）。
*   **import**：`../shapes/VertexSnapRules.js`の`isVertexSnap`・`findVertexSnapTarget`・`chooseSnapTarget`・`isVertexSnapDrawStartShapeType`・`isVertexSnapDrawEndShapeType`を足す（`edit/ → shapes/`の例外(1)に1件増える）。`model`が使うメソッドは変わらない（`getShapes`（`#toUsableSnap`の判定だけ）・`getEditableShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`・`replaceDraft`・`commitDraft`）。
*   **ファイル先頭の責務**（3行以内）とクラスのJSDoc（依存の制約・前提・通知の回数＝新しい照会は通知しない）に、吸い付くだけの照会（結合しない）と、結合への関門を足す。図形種別の分岐・図形固有のプロパティ名・操作モードの知識は持たないまま（描く図形種別は不透明な値として規則へ渡し、`snap.shapeId`は`#toUsableSnap`と同じく不透明な値として読む）。

### 要件2：まとめ移動の座標の組み立て（`core/VertexDragRules.js`の新規）
*   `InputTracker`はテストを置かない（3章22.の確認の状況）ため、「押した点だけが吸い付き、ほかの選んだ点は同じ量だけ動く」をテストで確かめられるよう、`#applyLeftDragUpdate`の座標の組み立て（今の`delta`と`updates`の計算）を状態を持たない規則へ**ふるまいを変えずに**切り出す。
*   `export function buildVertexDragUpdates(origins, anchor, target, anchorOrigin)`：`origins`（`#vertexDragOrigins`の要素の配列。typedef`VertexDragOrigin`＝`{ shapeId, handle, vertexIndex, x, y }`。`x`・`y`はアンカーだけ`null`があり得る）・`anchor`（`origins`の要素の1つ。同一性で比べる）・`target`（アンカーの行き先`{ x, y }`）・`anchorOrigin`（押下時のアンカーの位置。`null`可）から、`origins`の順に`{ id: shapeId, vertexIndex, x, y }`の新しい配列を返す。アンカー自身には`target.x`・`target.y`をそのまま入れる（足し算を通さない＝「アンカーの行き先をそのまま渡す」の要点）。ほかは`anchorOrigin`が`null`でなければ移動量`(target − anchorOrigin)`を各自の`x`・`y`へ足し、`null`なら移動量0。引数を書き換えない。
*   ファイル先頭の責務（3行以内）：頂点のハンドルのドラッグ（頂点のまとめ移動）で、押した頂点（アンカー）の行き先から動かす頂点すべての座標の組を組み立てる規則を状態を持たない関数として提供する。importなし。DOM・モデル・図形・吸い付き・スナップを知らない。
*   **置き場所の理由**：`VertexHandleRules`の責務（ハンドルの一覧・判定・範囲）とは別の責務のため新しいファイル。使う側は`InputTracker`だけ（`core/`の処理が状態を持たない規則をimportする向き）。

### 要件2・3・5：配線（`core/InputTracker.js`の更新。判定・計算は足さない）
*   **`EndpointSnapAssist`のtypedefと既定値`NO_SNAP_ASSIST`**：`InputTracker`が呼ぶ項目だけを並べる形を保ち、`findDrawSnap`→`findDrawStartSnap(shapeType, point)`、`findDragSnap`→`findVertexDragSnap(dragged, movingShapeIds, point)`、`findDrawnLineSnap`→`findDrawnLinePointSnap(startSnap, point)`に置き換え、`findDrawEndSnap(shapeType, point)`と`isVertexSnap(snap)`を足す（既定は照会が`null`、`isVertexSnap`が`false`）。ほかの項目は変えない。
*   **呼ぶ場面**（`Ctrl`の間は今までどおり照会せず`null`と同じ経路）：
    *   `handleMouseMove`の`DRAWING`で線を引いている途中：`findDrawnLineSnap` → `findDrawnLinePointSnap(#drawStartSnap, point)`。
    *   `handleMouseMove`の`DRAWING`で弧・矩形・円：`findDrawSnap(this.currentShapeType, point)` → `findDrawEndSnap(this.currentShapeType, point)`（結果を`#drawEndSnap`へ保持・表示し、吸い付けばその座標で`updateDraft`。今の流れのまま）。
    *   `handleMouseMove`の図形作成モードのIDLE：`findDrawSnap` → `findDrawStartSnap`（表示だけ）。
    *   `handleClick`の図形作成モードの描き始め：`findDrawSnap` → `findDrawStartSnap`（結果を`#drawStartSnap`へ保持・表示し、吸い付けばその座標で`startDraft`）。
    *   `#applyLeftDragUpdate`の`DRAGGING_HANDLE`：今の`if (this.#dragEndpoint) { … }`をやめ、動かす点の数・端点かによらず`snap = suppressed ? null : this.#snapAssist.findVertexDragSnap(this.#dragEndpoint, this.#vertexDragOrigins.map((o) => o.shapeId), target)`・`this.#dragSnap = snap`・`this.#showSnap(snap)`にする。行き先（吸い付けば`snap`の座標、吸い付かなければ`#unitSnapHandleOrigin`からの丸め）の決め方は今のまま。座標の組は`buildVertexDragUpdates(this.#vertexDragOrigins, anchor, target, this.#unitSnapHandleOrigin)`の結果を`model.updateVertices`へ1回で渡す（今の`delta`・`updates`の計算を置き換える。結果は同じ）。
    *   `#onLeftDragEnd`のコードは変えない（`#dragEndpoint`と`#dragSnap`があるときだけ`joinDraggedEndpoint`を呼ぶ。`#dragSnap`が吸い付くだけなら補助側が`false`を返す。`#dragEndpoint`は今までどおり動かす点が1つで端点のハンドルのときだけ）。
*   **表示**：`#showSnap(snap)`は`this.model.setSnapPoint(snap.x, snap.y, this.#snapAssist.isVertexSnap(snap))`にする（`x`・`y`だけを読み、種類は補助へ問い合わせる。結果の`kind`を自分で読まない）。消す場面・`#resetSnapState`・作業用フィールドの寿命は変えない。
*   **import**：`./VertexDragRules.js`の`buildVertexDragUpdates`を足す。`edit/`はimportしないまま。
*   **JSDoc**：ファイル先頭の責務の「Ctrlの間に端点への吸い付きの照会を省くこと」を「Ctrlの間に吸い付き（結合する吸い付き・吸い付くだけ）の照会を省くこと」にする（3行以内のまま）。クラスのJSDoc・`EndpointSnapAssist`・`#drawStartSnap`／`#drawEndSnap`／`#dragSnap`の説明（吸い付くだけの結果も入る）・`handleMouseMove`・`handleClick`・`#beginLeftDrag`（`#dragEndpoint`は結合する吸い付きのためだけで、吸い付くだけは点の数によらない）・`#applyLeftDragUpdate`（「端点への吸い付きは頂点が1つだけのとき」の記述を「結合する吸い付きは動かす点が1つで端点のハンドルのときだけ、吸い付くだけは押した点（アンカー）について常に」に）・`#onLeftDragEnd`・`#showSnap`を直す。
*   **変えないもの**：`hitTestHandle`の優先順位・当たり分類・押下の判定表、`Ctrl`・`Shift`を読む時点、丸めの箇所と順、`#resetSnapState`を呼ぶ箇所・順、`#vertexDragOrigins`の組み立て・`#dragEndpoint`の解決、ほかの入力状態の処理。

### 要件4：吸い付く先が分かる表示（`core/VectorModel.js`・`core/CanvasManager.js`・`js/main.js`の更新）
*   **`VectorModel`**：吸い付きの表示の点に「吸い付くだけか」の別を足す。`setSnapPoint(x, y, vertex = false)`（3つ目の引数は`true`のときだけ吸い付くだけ。今の2引数の呼び出しは結合する吸い付きのまま）。今の点と座標も別も同じなら何もせず、どちらかが変われば設定して通知1回。`clearSnapPoint`・`replaceAllShapes`で別も消える。`getSnapPoint()`の戻り値は今のまま`{ x, y }`（既存のテストの値を変えないため、別は入れない）。新しい照会`isSnapPointVertex()`（表示中で吸い付くだけなら`true`、表示なし・結合する吸い付きなら`false`）。保存しない・履歴の対象外は今のまま。ファイル先頭の責務（3行以内のまま）の「吸い付きの表示の点」に「（結合する吸い付きか吸い付くだけかの別を含む）」を足す。
*   **`CanvasManager`**：`render`の引数に`snapPointVertex = false`を足し（真なら吸い付くだけの表示）、`#drawSnapIndicator(point, scale, vertex)`で中の色を`vertex ? SNAP_INDICATOR_VERTEX_FILL_COLOR : SNAP_INDICATOR_FILL_COLOR`にする。新しい定数`SNAP_INDICATOR_VERTEX_FILL_COLOR = '#ffffff'`（JSDoc付き。吸い付くだけの表示の中の色）。枠の色（`SNAP_INDICATOR_STROKE_COLOR`）・大きさ（8px）・線幅・描く順（作成中の図形の上・選択矩形の下）は今のまま。状態を持たない（受け取った値で描くだけ）。
*   **`main.js`**：`renderCurrentState`の`canvasManager.render`の引数に`snapPointVertex: model.isSnapPointVertex()`を足し、JSDoc・`// 4.`の`EndpointSnapper`の説明コメントに吸い付くだけを足す（判定・計算は書かない）。

### 要件6：取り消しと保存
*   吸い付きは座標を決めるだけで、別の編集操作にならない：頂点のドラッグは閾値超過の`beginEdit`から`#finishLeftDrag`の`commitEdit`までの1件、線を引くのは終えるときの1件、弧・矩形・円は`commitDraft`の前後の1件（どれも今のまま）。吸い付くだけの表示の別は`VectorModel`の表示用の状態で、スナップショット・作業データ・書き出しに入れない。
*   `io/`・`palette/`・`KeyboardShortcuts.js`・`HistoryManager.js`・`edit/SnapshotAdapter.js`は変えない。作業データの版（4）・書き出し形式の版（4）は上げない。

### 要件7：自動テストと、既存のテストで値を変えるもの
*   **足すテストファイル**：`test/shapes/EndpointSnapRules.scan.test.js`（タスク1）・`test/shapes/VertexSnapRules.test.js`（タスク2）・`test/edit/EndpointSnapper.vertexSnap.test.js`・`test/edit/EndpointSnapper.vertexSnap.flow.test.js`（タスク3）・`test/core/VertexDragRules.test.js`（タスク4）・`test/core/VectorModel.snapPointVertex.test.js`（タスク5）。
*   **最初の表との対応**：表の行×列の欄は、`EndpointSnapper`の新しい照会（`InputTracker`が渡すのと同じ引数）の結果の種類（`SnapTarget`／`DrawnStartSnap`／`VertexSnap`／`null`）と、その結果を`commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`joinDraggedEndpoint`へ渡したときの反映（結合する・しない）で確かめる（タスク3）。`Ctrl`の列は`InputTracker`が照会しない（`null`と同じ経路）ため、`null`を渡したときの反映が今のままであることで確かめる。まとめて動かす行の「ほかの点は同じ量だけ動く」はタスク4。表示（■／□）は`isVertexSnap`の結果（タスク3）と`VectorModel`の別（タスク5）で確かめ、描画そのものはテストしない（画面の描画のテストは置かない方針）。
*   **既存のテストの値は変えない**（変えるものは無い見込み）。タスク1は結果を変えない書き換え、タスク3は今の公開メソッドを変えず、`#toUsableSnap`の追加の分岐は今まで存在しなかった`VertexSnap`にしか当たらない。`joinDraggedEndpoint`に足す`#toUsableSnap`は、今のテストの入力では結果（戻り値・モデルへの呼び出し）が変わらない。値を変えざるを得ないテストが出たら、そのタスクを中断して質問する。

### モジュールの分担（全体）
| 層 | ファイル | 持つもの | 持たないもの |
| --- | --- | --- | --- |
| `shapes/` | `EndpointSnapRules.js`（更新） | 吸い付く先の点の走査`findNearestSnapPoint`・距離`snapDistance`（共有の唯一の箇所）、今の結合する吸い付きの規則 | 吸い付くだけの種類・頂点の読み方 |
| `shapes/` | `VertexSnapRules.js`（新規） | 吸い付く先の頂点の読み方（種類ごとの分岐）・いちばん近い頂点・結合する吸い付きとの選び方・ツールごとに働く点・`VERTEX_SNAP_KIND`／`isVertexSnap` | 表示倍率・モデル・操作モード・除く図形の決め方 |
| `edit/` | `EndpointSnapper.js`（更新） | 照会の手順（換算・変えられる図形・除く図形）・結合への関門`#toUsableSnap` | 候補の選び方・距離・図形種別の分岐 |
| `core/` | `VertexDragRules.js`（新規） | まとめ移動の座標の組み立て（アンカーの行き先をそのまま渡す） | 吸い付き・スナップ・モデル |
| `core/` | `InputTracker.js`（更新） | 呼ぶ場面の配線・表示の設定（別は補助に問い合わせる）・作業用フィールド | 候補の選び方・距離・結果の種類の解釈・除く図形の決め方 |
| `core/` | `VectorModel.js`（更新） | 吸い付きの表示の点と別（吸い付くだけか） | 描き方 |
| `core/` | `CanvasManager.js`（更新） | ■／□の描き分け（定数） | 状態 |
| `js/` | `main.js`（更新） | `snapPointVertex`の受け渡し | 判定・計算 |
| `shapes/` | `PathJoinRules.js`・`PathVertexRules.js`（JSDocだけ更新） | 使う側の列挙に`VertexSnapRules`を足す（`lineEndpointOf`のJSDoc・`PathVertexRules`のファイル先頭の責務の共有先）。コードは変えない | 吸い付くだけの種類 |
| 変えない | 図形クラス・`HistoryManager`・`KeyboardShortcuts`・`PointHitRules`・`PressActionRules`・`UnitSnapRules`・`VertexHandleRules`・`io/`・`palette/`・`wiring/`・`index.html` | — | — |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形をまたぐ規則）・`./js/edit/`（手順）・`./js/core/`（規則の関数・入力・モデル・描画）・`./js/`（`main.js`）・`./test/`
*   **関連する論理クラス**: 新規＝`shapes/VertexSnapRules`（規則の関数）・`core/VertexDragRules`（規則の関数）。更新＝`shapes/EndpointSnapRules`・`edit/EndpointSnapper`・`core/InputTracker`・`core/VectorModel`・`core/CanvasManager`・`main.js`、JSDocだけ更新（コードは変えない）＝`shapes/PathJoinRules`・`shapes/PathVertexRules`。変えない＝図形クラス・`core/HistoryManager`・`core/KeyboardShortcuts`・`core/PointHitRules`・`core/PressActionRules`・`core/UnitSnapRules`・`core/VertexHandleRules`・`io/`・`palette/`・`wiring/`・`index.html`。

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない（`InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドを呼ぶだけ）。循環importは無い。列から外れるのは(1)`edit/ → shapes/`（今回`EndpointSnapper → shapes/VertexSnapRules`を足す）、(2)`shapes/`内で規則のファイルが図形クラス・ほかの規則のファイルをimportする向き（今回`VertexSnapRules → EndpointSnapRules`・`PathJoinRules`・`PathVertexRules`を足す。`EndpointSnapRules → PathJoinRules`は今のまま）、(3)`edit/ → core/`の状態を持たない規則の関数。`core/`内は処理（`InputTracker`）が状態を持たない規則（今回`VertexDragRules`）をimportする向き。
*   **`shapes/`の図形をまたぐ規則**：状態を持たない`export`した関数と定数のみ。図形の`type`・`id`・`toJSON()`（と決められた共通メソッド）だけを読む。図形クラスは規則のファイルをimportしない。唯一の箇所：`PathJoinRules.lineEndpointOf`（結合できる線の端点の座標。弧は中心と半径から）・`endpointVertexIndexOf`（端点の番号）・`chainSourceOf`（今の曲線・弧の読み替え）・`isJoinableLine`（結合できる線）、`PathVertexRules.outlineSourceOf`（直線・矩形・今の曲線・パスを輪郭の元へ読む。矩形は閉じた4点、今の曲線は始点・終点）、`EndpointSnapRules`の`SNAP_TOLERANCE_SCREEN_PX`（8px）・`isSnapDrawShapeType`（結合する吸い付きは直線・曲線のツールだけ）・`isDrawnStartSnap`・`DRAWN_START_SNAP_KIND`。共通メソッド契約は18メソッド（増やさない）。円・弧の中心は`points[0]`。
*   **端点への吸い付き（3章12.）**：対象・距離・候補の選び方は`EndpointSnapRules`、照会と反映は`EndpointSnapper`、配線は`InputTracker`、表示の状態は`VectorModel`の吸い付きの表示の点、描画は`CanvasManager`（`render`の`snapPoint`）。照会が見る図形は`model.getEditableShapes()`。`#toUsableSnap`が`commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`findDrawnLineSnap`の冒頭で、変えられなくなった図形の端点の吸い付きを`null`にする。`Ctrl`の間は照会せず「照会結果が`null`」と同じ経路。描き終え・離したときは直前の照会結果で決まる。表示を消す責任は`InputTracker`（`#resetSnapState`ほか）で、作業用フィールドの寿命は入力状態（`DRAWING`・`DRAGGING_HANDLE`）と同じ。`SNAP_TOLERANCE_SCREEN_PX`・`JOIN_TOLERANCE_SCREEN_PX`（5px）・`hitTolerance`・表示の大きさは別の定義。
*   **スナップ（3章17.）**：丸めは座標の入口（`InputTracker`）で行い、吸い付いたら丸めない・吸い付かなかったときだけ丸める。頂点のハンドルは「押下時のハンドルの位置＋丸めた移動量」。`commitDrawnLine`・`joinDraggedEndpoint`へは吸い付きの結果だけが渡る。
*   **頂点の選択（3章18.）**：押した点が選んでいる点の1つなら選んでいる点すべてを、そうでなければ押した点だけを動かす（`#beginLeftDrag`が`#vertexDragOrigins`を組み立てる）。アンカーの行き先を求め、アンカーには行き先そのもの、ほかには「アンカーの移動量」を各自の押下時の位置へ足して`model.updateVertices`へ1回で渡す（通知1回・取り消し1件）。円・弧は頂点のハンドルを持たない。頂点のハンドルは選択集合の変えられる図形だけ。
*   **線を続けて引く（3章22.）**：クリックの判定の順（`clickDrawnLine`。番号は`PROJECT_ARCHITECTURE.md` 3章22.のもので、`EndpointSnapper.js`のJSDocの「処理順」では先頭に「作成途中の図形が無ければ`false`」が入り2.〜5.になる）は 1.始点への吸い付きで閉じられる → 2.最後の点と重なる → 3.端点への吸い付き → 4.点を打つ。打った点の並びは`VectorModel`の作成途中の図形だけが持つ。`InputTracker`・`main.js`はテストを置かない（規則・手順を`test/shapes/`・`test/core/`・`test/edit/`で確かめる）。
*   **`edit/`のクラス**：DOMに触れない。操作モードを解釈しない。図形種別の分岐・図形固有のプロパティ名を持たない。`VectorModel`・`HistoryManager`は注入で受け取り、規則の関数だけをimportする。`try/catch`を持たない。表示・ロックは`VectorModel`の照会で絞るだけ。
*   **`core/`の規則のファイル**：状態・DOMを持たない関数。引数を書き換えない。図形種別の分岐・図形固有のプロパティ名を持たない。
*   **`VectorModel`**：状態の唯一の持ち主。吸い付きの表示の点は表示専用で保存・履歴の対象外。`setSnapPoint`は同じなら通知しない、`clearSnapPoint`は表示中のときだけ通知、`replaceAllShapes`で消える。
*   **`CanvasManager`**：状態を持たず、引数の値で描く。大きさ・線幅は`÷ view.scale`で画面上一定。定数はファイルの中。
*   **`main.js`**：生成・注入・同期の配線だけ。判定・計算を書かない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`shapes/VertexSnapRules.js`（図形クラスではない。図形をまたぐ規則（吸い付くだけ＝ほかの図形の頂点への吸い付き。吸い付く先の頂点の読み方・いちばん近い頂点・結合する吸い付きとの選び方・ツールごとに働く点）。`shapes/`の外から使う。Phase 12-03）、`core/VertexDragRules.js`（頂点のまとめ移動の座標の組み立て（アンカーの行き先をそのまま渡す）の規則。状態なし・importなし。`InputTracker`から使う。Phase 12-03）を足す。`EndpointSnapRules.js`の行に「吸い付く先の点の走査と距離の測り方は`VertexSnapRules`と共有（Phase 12-03）」、`PathJoinRules.js`の行（`lineEndpointOf`を`VertexSnapRules`からも使う）、`PathVertexRules.js`の行（`outlineSourceOf`を`VertexSnapRules`からも使う）。テストの一覧に今回の6ファイル。
*   **1章「存在しないもの」**：Phase 12-01・12-02の「ほかの図形の頂点への吸い付き・端点への吸い付きの対象を広げること」をPhase 12-03で入った（結合する吸い付きの対象は広げず、吸い付くだけを足した）旨に直す。「複数の頂点（2つ以上）を選んでいるときの端点への吸い付き（1つだけ選んでいるときだけ働く）」を「結合する吸い付き」に直し、吸い付くだけは働く旨。**Phase 12-03でやらないと決めたこと**（REQの「今回やらないこと」：選択（`V`）の本体のドラッグ・外枠のハンドルの拡大縮小・回転・矢印キー・位置の数値入力での吸い付き、区間の上（線の途中）・図形の中心（円・弧の中心を除く）・外枠の角・グリッドの交点への吸い付き、吸い付く先を示す線（ガイド）の表示、吸い付きのオン・オフの切り替え・吸い付く距離の設定、分割した直後の重なった端の点を結合させずに動かす特別な扱い、点の本当の共有、複合パス、版を上げること。加えて計画で決めたこと：円・弧の2つ目の点の吸い付き、描き始めが端点のときのその線の頂点への吸い付くだけ、図形クラスへの共通メソッドの追加）を足す。
*   **1章「フォルダ分割の方針」「依存方向」**：用語の段落（「スナップ」と「端点への吸い付き」を使い分ける）に「結合する吸い付き」「吸い付くだけ（頂点への吸い付き）」を足し、混ぜない旨。`shapes/`の第3の種類に`VertexSnapRules`。依存方向の(1)に`edit/EndpointSnapper → shapes/VertexSnapRules`、(2)に`VertexSnapRules → EndpointSnapRules`・`PathJoinRules`・`PathVertexRules`。`core/`内のimportの向きに`InputTracker → VertexDragRules`（処理が規則をimportする向き）。`core/InputTracker`が呼ぶ`EndpointSnapper`のメソッドの記述があれば直す。
*   **2章「吸い付きの表示の点」**：ワールド座標の1点に、結合する吸い付きか吸い付くだけかの別（`setSnapPoint`の3つ目の引数・`isSnapPointVertex()`。`getSnapPoint()`は`{ x, y }`のまま）。保存対象外・履歴の対象外は今のまま。
*   **3章3.（入力監視）**：「端点への吸い付き」の項を「吸い付き（結合する吸い付き・吸い付くだけ）」に。「頂点のハンドルのドラッグ・図形の作成で打つ点」の項の「端点への吸い付きは頂点を1つだけ選んでいるときだけ働く」を「結合する吸い付きは…、吸い付くだけは押した点（アンカー）について点の数によらず働く」に、座標の組み立てが`core/VertexDragRules.buildVertexDragUpdates`であること。「図形の作成で打つ点は、端点へ吸い付かなかったときだけ丸める」を吸い付き全体に。
*   **3章12.（端点への吸い付きと描き足し）**：見出し・冒頭の段落に吸い付くだけ（中が白の正方形。結合しない）を足すか、新しい項「吸い付くだけ（Phase 12-03）」を立てる（最初の表の要約・対象の点・選び方（いちばん近い・同じ距離なら結合する吸い付き）・動かしている点を持つ図形の除外・ツールごとの働く点（円・弧は中心だけ）・関門`#toUsableSnap`・表示）。「モジュールの分担」に`VertexSnapRules`・`VertexDragRules`・`EndpointSnapper`の新しい照会。「流れ」の各項（描き始め・描いている途中（弧・矩形・円の`DRAWING`の`mousemove`は`findDrawEndSnap`。矩形だけ吸い付くだけ）・描き終え（`commitDrawnLine`は吸い付くだけを`null`として扱う）・端点のハンドルのドラッグ（`findVertexDragSnap`。点の数によらず照会））。「表示＝中を青で塗った8pxの正方形」に吸い付くだけの□。「表示を消す箇所」の「図形作成モードのIDLEで直線・曲線以外の図形種別のmousemove」は、弧・矩形・円でも吸い付くだけの表示が出るように直す。「`Ctrl`の間は照会しない」の照会の場面に吸い付くだけ。「やらないこと」の「今の曲線の制御点・矩形・円・閉じたパスの点・弧の中心と頂上・途中の頂点への吸い付き」を、結合する吸い付きの対象にはしない（吸い付くだけの対象にはなる。今の曲線の制御点・弧の頂上は吸い付くだけの対象にもならない）に直す。「変えられる図形だけが対象」の`EndpointSnapper`の照会の箇所の数・`#toUsableSnap`の通る箇所（`joinDraggedEndpoint`を足す・吸い付くだけを外す）。
*   **3章17.（スナップ）**：「用語」の「既存の識別子の`snap`はすべて端点への吸い付きを指す」を、吸い付き（結合する・だけ）を指す（吸い付くだけは`Vertex`/`vertex`を含む識別子）に。「端点への吸い付きとの優先」を吸い付き全体に（吸い付くだけでも丸めない・吸い付かなかったときだけ丸める。丸めも吸い付くだけも結合として扱われない）。「やらないこと」の「端点への吸い付きの対象は広げない」は、結合する吸い付きの対象は広げていない旨に。
*   **3章18.（頂点の選択）**：まとめ移動の項に、吸い付くだけは押した点だけが吸い付きほかは同じ量だけ動く（発注者の決定、2026-11-27）・2つ以上では結合する吸い付きは働かない（Phase 08-02bの決定(11)の目的を保つ）・座標の組み立ては`VertexDragRules`。発注者の決定(11)に「Phase 12-03で吸い付くだけは働くようになった」旨の注記。「やらないこと」の「2つ以上の頂点を選んでいるときの端点への吸い付き」を結合する吸い付きに限る。
*   **3章22.（線を続けて引く）**：`mousemove`の照会が`findDrawnLinePointSnap`になり吸い付くだけを含むこと。「クリックの判定の順」（22.の番号の1.〜4.。`EndpointSnapper.js`のJSDocの「処理順」の2.〜5.に当たる）で、吸い付くだけの頂点でのクリックは1.（始点で閉じる）・3.（端点への吸い付き）に当たらず、2.（最後の点と重なる）を今までどおり先に見て、4.（点を打つ）になること（`#toUsableSnap`で`null`と同じ）。描き始めが吸い付くだけの線は新しい線。モジュールの分担の手順の列に新しい照会。あわせて、2.の括弧書きの「`dblclick`のリスナーは無く2回の`click`として扱う」は、Phase 12-01で`InputTracker`に`dblclick`のハンドラ（`handleDoubleClick`。InputTracker.js 1271行付近）が入った後の実態と食い違っているため見直す（`handleDoubleClick`は`VertexEditRules.resolveDoubleClickInsertTarget`が頂点の選択のモードでしか図形のidを返さず図形作成モードでは働かないため、線を引いている途中のダブルクリックのふるまいは2回の`click`のまま、という形に直す。書く前に実コードで確かめる）。
*   **3章6.（履歴）**：記録の時点は変わらない旨を、必要なら1文（吸い付きは別の編集操作にならない）。
*   **4章の一覧と`_doc/arch/`**：新規`68_VertexDragRules.md`（一覧の表に足す）。更新`02_main.md`（`renderCurrentState`の`snapPointVertex`・`// 4.`のコメント・行数）、`03_VectorModel.md`（`setSnapPoint`の3つ目の引数・`isSnapPointVertex`・公開メソッドの列）、`04_CanvasManager.md`（`render`の`snapPointVertex`・定数`SNAP_INDICATOR_VERTEX_FILL_COLOR`）、`06_InputTracker.md`（`EndpointSnapAssist`の項目の置き換え・呼ぶ場面・`#applyLeftDragUpdate`の照会と`VertexDragRules`・`#showSnap`・`Ctrl`の間は照会しない項の呼ぶメソッド名・importの列・行数）、`12_shapes.md`（`EndpointSnapRules`の新しい公開2つと使う側・新しい節`VertexSnapRules.js`・`PathJoinRules`・`PathVertexRules`の使う側）、`14_edit.md`（`EndpointSnapper`の公開メソッド・依存・契約・注意（関門）・使う側）、`16_test.md`（新しいテストファイル・件数）、`38_VertexHandleRules.md`・`30_UnitSnapRules.md`・`67_VertexTargetRules.md`・`08_HistoryManager.md`（記述が今回の変更と食い違う箇所があれば直す。無ければ変えない）。`main.js`・`InputTracker.js`の行数・テストの件数は実測して直す（作業前は`main.js`1296行・`InputTracker.js`2112行・tests 3910 / suites 652 / 152ファイル）。
*   **（タスク6で実測）`InputTracker.js`の行数**：2112行から2124行（`06_InputTracker.md`のタスク8で`wc -l`により再実測して直す。`EndpointSnapAssist`の項目の置き換え・importに`VertexDragRules`・`#applyLeftDragUpdate`と`#showSnap`の記述）。
*   **（タスク5で実測）`main.js`の行数**：1296行から1297行（`02_main.md`のタスク8で`wc -l`により再実測して直す）。`VectorModel`の`isSnapPointVertex()`・`setSnapPoint`の3つ目の引数は`03_VectorModel.md`・2章「吸い付きの表示の点」、`CanvasManager`の`snapPointVertex`・`SNAP_INDICATOR_VERTEX_FILL_COLOR`は`04_CanvasManager.md`に反映する。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・メソッド・引数・戻り値・typedef、意味が変わった既存のJSDoc・ファイル先頭の責務・importの記述・「`model`は…だけを使う」の記述）が無いことを確認する。(b) リポジトリのルートで`node --test`が全件合格することを確認する（既存のテストファイルの値は変えない。値を変えざるを得ないテストが出たら中断して質問する）。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』欄へ追記する。(e) 行末：既存のファイルは書き換える前に行末（CRLF／LF）を実測して保つ。計画時の実測（CR数/LF数）は次のとおり。**CRLF**＝`js/shapes/EndpointSnapRules.js`(162/162)・`js/shapes/PathJoinRules.js`(778/778)・`js/core/InputTracker.js`(2112/2112)・`js/main.js`(1296/1296)・`PROJECT_ARCHITECTURE.md`(1072/1072)・`_doc/arch/`の`02_main.md`(94/94)・`03_VectorModel.md`(29/29)・`04_CanvasManager.md`(8/8)・`06_InputTracker.md`(65/65)・`08_HistoryManager.md`(15/15)・`12_shapes.md`(113/113)・`14_edit.md`(166/166)・`16_test.md`(328/328)・`67_VertexTargetRules.md`(8/8)。**LF**＝`js/shapes/PathVertexRules.js`(0/512)・`js/edit/EndpointSnapper.js`(0/401)・`js/core/VectorModel.js`(0/1462)・`js/core/CanvasManager.js`(0/532)・`_doc/arch/30_UnitSnapRules.md`(0/14)・`_doc/arch/38_VertexHandleRules.md`(0/12)。変更しないが合格を確かめる既存のテストは、`test/shapes/EndpointSnapRules.test.js`が**混在**(542/621)、`test/core/VectorModel.snapPoint.test.js`がLF(0/102)、`test/edit/EndpointSnapper.test.js`がCRLF(1207/1207)。混在のファイルを書き換える場合（今の計画では書き換えない）は、ファイル全体を一方へそろえず、既存の行は行ごとの今の行末を保ち、足す行は周りの行（直前の行。無ければ直後の行）の行末に合わせる。**新規のファイル**は同じフォルダが混在しているため（`js/shapes/` LF8・CRLF5、`js/core/` LF35・CRLF19、`test/shapes/` LF9・CRLF6・混在2、`test/edit/` LF29・CRLF24・混在1、`test/core/` LF42・CRLF21・混在1）ファイルごとに次のとおりにする：LF＝`js/shapes/VertexSnapRules.js`・`js/core/VertexDragRules.js`・`test/shapes/EndpointSnapRules.scan.test.js`・`test/shapes/VertexSnapRules.test.js`・`test/edit/EndpointSnapper.vertexSnap.test.js`・`test/edit/EndpointSnapper.vertexSnap.flow.test.js`・`test/core/VertexDragRules.test.js`・`test/core/VectorModel.snapPointVertex.test.js`（各フォルダで多い方）、CRLF＝`_doc/arch/68_VertexDragRules.md`（書き方を合わせる`67_VertexTargetRules.md`と同じ）。各タスクの対象ファイル欄にも行末を書いた。(f) 対象ファイル以外は変更しない。

*   [x] タスク1: 吸い付く先の点の走査と距離を1か所に出す（結果は変えない）
    *   **対象ファイル** :
        *   `./js/shapes/EndpointSnapRules.js` :（更新。行末はCRLF）
        *   `./test/shapes/EndpointSnapRules.scan.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件1』の`EndpointSnapRules.js`のとおり、`snapDistance(a, b)`・`findNearestSnapPoint(shapes, point, tolerance, pointsOf)`をJSDoc付きでexportし（唯一の箇所である旨と使う側＝このファイルと`VertexSnapRules`を書く）、非公開`findNearestEndpoint`の本体と`findDrawnLineSnapTarget`の始点の距離をそれらの呼び出しに書き換える。`findNearestEndpoint`のJSDoc（走査を`findNearestSnapPoint`に任せる）を直す。ファイル先頭の責務を3行以内のまま直す。ほかの関数・定数・typedefは変えない。
        *   テスト（`EndpointSnapRules.scan.test.js`）：`snapDistance`（値・引数の順を入れ替えても同じ・負の座標）。`findNearestSnapPoint`：図形が無い・候補が無い（`pointsOf`が空）は`shape`・`candidate`が`null`で`distance`が`Infinity`、許容距離ちょうどは選ぶ・わずかに外は選ばない、いちばん近い候補、同じ距離なら前面（配列で後ろ）の図形、同じ図形の中で同じ距離なら`pointsOf`の並びの前の方、`candidate`は`pointsOf`が返したオブジェクトそのもの（ほかのキーも保つ）・`shape`は図形そのもの、引数を書き換えない。既存の`test/shapes/EndpointSnapRules.test.js`が変更なしで全件合格すること（`findSnapTarget`・`findDrawnLineSnapTarget`の結果が変わらないことの確認）。

*   [x] タスク2: 吸い付くだけの規則
    *   **対象ファイル** :
        *   `./js/shapes/VertexSnapRules.js` :（新規。行末はLF）
        *   `./test/shapes/VertexSnapRules.test.js` :（新規。行末はLF）
        *   `./js/shapes/PathJoinRules.js` :（更新。`lineEndpointOf`のJSDocの使う側の列挙に`VertexSnapRules`を足すだけ。コードは変えない。行末はCRLF）
        *   `./js/shapes/PathVertexRules.js` :（更新。ファイル先頭の責務の共有先の列挙に`VertexSnapRules`を足すだけ（3行以内のまま）。コードは変えない。行末はLF）
    *   **作業内容** :
        *   『要件1』の`VertexSnapRules.js`のとおり、先頭に3行以内の責務、import（`findNearestSnapPoint`・`snapDistance`・`lineEndpointOf`・`outlineSourceOf`）、`VERTEX_SNAP_KIND`・typedef`VertexSnap`・`isVertexSnap`・`snapVerticesOf`・`findVertexSnapTarget`・`chooseSnapTarget`・`isVertexSnapDrawStartShapeType`・`isVertexSnapDrawEndShapeType`をJSDoc付きで作る（`VertexSnap`を結合の計画・`EndpointSnapper`の反映へ渡してはならない旨、円・弧の2つ目の点に吸い付かない理由（発注者の決定 2026-11-27）、同じ距離なら結合する吸い付き、を書く）。『要件1』の「使う側の列挙」のとおり、`PathJoinRules.js`の`lineEndpointOf`のJSDocと`PathVertexRules.js`のファイル先頭の責務に`VertexSnapRules`を足す（どちらもコメントだけで、コードは変えない）。
        *   テスト（実物の`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）：`snapVerticesOf`＝開いたパス（途中の点を含むすべての点・並び）、閉じたパス（すべての点）、曲がり方を持つ区間のパス（`control1`・`control2`の座標が入らない）、矩形（4つの角。回した矩形も`points`の4点）、直線（両端）、今の曲線（始点・終点だけ。制御点が入らない）、弧（`lineEndpointOf`の始点・終点と中心`points[0]`の3点。頂上・`points[1]`〜`[4]`が入らない。回した弧も`lineEndpointOf`と同じ値）、円（中心だけ）、未知の図形は空、戻り値が図形の点と同じオブジェクトでない・図形を書き換えない。`findVertexSnapTarget`＝点の種類ごと（パスの途中の点・閉じたパスの点・矩形の角・直線の両端・今の曲線の始点と終点・弧の両端・円と弧の中心）に吸い付く、吸い付かない点（今の曲線の制御点・引っ張る点・弧の頂上）、許容距離ちょうどは吸い付く・外は吸い付かない、いちばん近い点、同じ距離なら前面の図形、`excludedShapeIds`の図形の点は吸い付かない（ほかの図形には吸い付く）、結果が`{ kind: 'vertex', x, y }`だけ（`shapeId`・`end`を持たない）、引数を書き換えない。`chooseSnapTarget`＝結合する吸い付きだけ・吸い付くだけだけ・両方無し、近い方、同じ距離なら結合する吸い付き（`SnapTarget`・`DrawnStartSnap`とも）、引数のオブジェクトそのものを返す。`isVertexSnap`＝`VertexSnap`で真、`SnapTarget`・`DrawnStartSnap`・`null`・`undefined`で偽、`isDrawnStartSnap`が`VertexSnap`で偽。ツールの判定＝描き始めは`line`・`curve`・`rect`・`arc`・`circle`が真で`path`・未知・`null`が偽、2つ目の点は`rect`だけ真。

*   [x] タスク3: 照会の手順と、吸い付くだけを結合として扱わない関門
    *   **対象ファイル** :
        *   `./js/edit/EndpointSnapper.js` :（更新。行末はLF）
        *   `./test/edit/EndpointSnapper.vertexSnap.test.js` :（新規。行末はLF）
        *   `./test/edit/EndpointSnapper.vertexSnap.flow.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件2・3・5：照会の手順と、結合への渡し方』のとおり、`findDrawStartSnap`・`findDrawEndSnap`・`findDrawnLinePointSnap`・`findVertexDragSnap`・`isVertexSnap`をJSDoc付きで足し（処理順・除く図形の決め方・呼び出し元が`InputTracker`である旨）、`#toUsableSnap`の先頭に吸い付くだけを`null`にする分岐を足し（JSDocを直す）、`joinDraggedEndpoint`の冒頭に`snap = this.#toUsableSnap(snap);`を足す（JSDocの処理順に足す）。importに`VertexSnapRules`の5つを足す。ファイル先頭の責務（3行以内）・クラスのJSDoc（依存の制約のimportの列・前提・通知の回数）を直す。今の公開メソッドの中身・ほかの非公開メソッドは変えない（`findDrawSnap`・`findDragSnap`・`findDrawnLineSnap`のJSDocに「結合する吸い付きだけの照会。`InputTracker`は新しい照会を呼び、その中で使われる」を足す）。
        *   テスト（`EndpointSnapper.vertexSnap.test.js`。今の`EndpointSnapper.test.js`の偽のmodelの組み立て方に合わせる。最初の表の欄ごと）：
            *   描き始め（`findDrawStartSnap`）：直線・曲線のツールで端点だけ近い＝`SnapTarget`、ほかの頂点（閉じたパスの点・矩形の角等）だけ近い＝`VertexSnap`、両方で端点が近い＝`SnapTarget`・頂点が近い＝`VertexSnap`・同じ距離＝`SnapTarget`。矩形・円・弧のツールは端点の近くでも`VertexSnap`（結合する吸い付きを返さない）。`path`・未知の種別は`null`。許容距離は`screenLengthToWorld(8)`の戻り値。
            *   2つ目の点（`findDrawEndSnap`）：矩形は`VertexSnap`（端点の近くでも）、円・弧・直線・曲線・未知は`null`で`screenLengthToWorld`を呼ばない。
            *   引いている途中（`findDrawnLinePointSnap`）：端点＝`SnapTarget`、自分の始点（打った点3つ以上・描き始めの吸い付きなし）＝`DrawnStartSnap`、ほかの頂点＝`VertexSnap`、端点と頂点・始点と頂点の同じ距離＝結合する吸い付き、描き始めが端点（`SnapTarget`）ならその線の途中の点に`VertexSnap`しない（ほかの図形の頂点にはする）・その線のもう一方の端点には今までどおり`SnapTarget`、描き始めが`VertexSnap`なら描き始めの吸い付きが無い線と同じ（その図形の頂点にも吸い付く・始点に吸い付ける）、作成途中が無ければ`null`。
            *   頂点のドラッグ（`findVertexDragSnap`）：`dragged`ありで別の線の端点＝`SnapTarget`、自分のもう一方の端点（頂点4つ以上の開いたパス）＝`SnapTarget`、頂点2つの直線のもう一方の端点＝`null`（自分の図形の頂点も候補にしない）、ほかの図形の頂点＝`VertexSnap`、同じ距離＝`SnapTarget`。`dragged`が`null`（端点でない点・2つ以上）なら別の線の端点の近くでも`VertexSnap`、`movingShapeIds`の図形（2つ以上の図形）の点には吸い付かない、ほかの図形の点には吸い付く。
            *   `isVertexSnap`：`VertexSnap`で真・`SnapTarget`・`DrawnStartSnap`・`null`で偽。
            *   関門：`commitDrawnLine(VertexSnap, VertexSnap)`・`commitDrawnLine(null, VertexSnap)`・`commitDrawnLine(VertexSnap, null)`は`false`でモデル・記録先の呼び出しなし。`commitDrawnLine(VertexSnap, SnapTarget)`は`commitDrawnLine(null, SnapTarget)`と同じ呼び出し（描き足し）。`clickDrawnLine(null, VertexSnap)`・`clickDrawnLine(VertexSnap, VertexSnap)`は`true`で`replaceDraft`（点を打つ）だけ・記録先に触れない。`clickDrawnLine(VertexSnap, SnapTarget)`は`(null, SnapTarget)`と同じ。`finishDrawnLine(VertexSnap)`は`finishDrawnLine(null)`と同じ（新しい線として`replaceDraft`・`beginEdit`・`commitDraft`・`commitEdit`）。`joinDraggedEndpoint(dragged, VertexSnap)`は`false`で`replaceShape`を呼ばない。`Ctrl`の列：`null`を渡したときの結果が今のまま（`commitDrawnLine(null, null)`＝`false`等）。今の照会（`findDrawSnap`・`findDragSnap`・`findDrawnLineSnap`）が頂点の近くでも今までどおり`null`（吸い付くだけを返さない）。
        *   テスト（`EndpointSnapper.vertexSnap.flow.test.js`。実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`）：隠した図形・ロックした図形（上のフォルダから受け継いだものを含む）の点には新しい照会のどれも吸い付かない。直線のツールの流れ：矩形の角で`findDrawStartSnap`→その座標で`startDraft`、途中で円の中心へ`findDrawnLinePointSnap`→その座標で`updateDraft`→`clickDrawnLine`が`true`で点が円の中心の座標にちょうど打たれ図形の数が変わらない、同じ位置で`clickDrawnLine`→終えて新しい線が1本増え（点2つなら直線、点3つ以上ならパス。テストではもう1点打ってパスにした場合も確かめる）、点が矩形の角・円の中心の座標とちょうど同じ、矩形・円は変わらず別の図形のまま、`Ctrl`+`Z`相当の`history.undo()`1回で線が消え`redo()`で戻る。直線のツールでほかの線の途中の点でクリックしても描き足し・結合にならない（その線の`id`・点が変わらない）。矩形のツールの流れ：1つ目・2つ目の角を`findDrawStartSnap`・`findDrawEndSnap`で頂点に合わせ、`commitDrawnLine`が`false`で呼び出し側の`commitDraft`で矩形が1つ増え、角が頂点の座標とちょうど同じ、取り消し1回で消える。

*   [x] タスク4: まとめ移動の座標の組み立てを規則へ切り出す
    *   **対象ファイル** :
        *   `./js/core/VertexDragRules.js` :（新規。行末はLF）
        *   `./test/core/VertexDragRules.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   『要件2：まとめ移動の座標の組み立て』のとおり、先頭に3行以内の責務、typedef`VertexDragOrigin`・`VertexDragUpdate`（`{ id, vertexIndex, x, y }`。`VectorModel.updateVertices`の引数の要素の形）、`buildVertexDragUpdates(origins, anchor, target, anchorOrigin)`をJSDoc付きで作る（アンカーに行き先をそのまま渡す理由＝`origin+(target−origin)`は浮動小数で`target`と厳密に一致しないため、を書く）。importなし。このタスクでは`InputTracker`は変えない（タスク6で使う）。
        *   テスト：点1つ（アンカーだけ）でアンカーに`target`がそのまま入る（小数の座標で`origin + (target − origin)`と一致しない値でも`target`と厳密に同じ）、点3つ（2つの図形）でほかの点が同じ移動量だけ動く・並びが`origins`の順・`id`と`vertexIndex`が写る、`anchorOrigin`が`null`ならほかの点は動かずアンカーは`target`、引数を書き換えない。流れ（実物の`VectorModel`と`EndpointSnapper`）：2つの図形の点を選んだ状態で、押した点の`findVertexDragSnap(null, 動かしている図形のid, カーソル)`がほかの図形の頂点の`VertexSnap`を返し、その座標を行き先にした`buildVertexDragUpdates`の結果を`model.updateVertices`へ渡すと、押した点がその頂点の座標にちょうど合い、ほかの選んだ点が同じ量だけ動き、吸い付いた先の図形は変わらない。押した点を別の線の端点に近づけても結果は`VertexSnap`（`joinDraggedEndpoint`へ渡しても`false`で結合しない）。`beginEdit`〜`commitEdit`の1組で取り消し1回で戻る。

*   [x] タスク5: 吸い付くだけの表示（モデルの別・描き分け・受け渡し）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。行末はLF）
        *   `./js/core/CanvasManager.js` :（更新。行末はLF）
        *   `./js/main.js` :（更新。行末はCRLF）
        *   `./test/core/VectorModel.snapPointVertex.test.js` :（新規。行末はLF）
    *   **作業内容** :
        *   `VectorModel.js`：『要件4』のとおり、`setSnapPoint(x, y, vertex = false)`・`isSnapPointVertex()`と、別を持つ非公開のフィールド（JSDoc付き）を足し、`clearSnapPoint`・`replaceAllShapes`で別も消す。`getSnapPoint()`の戻り値は`{ x, y }`のまま。JSDoc（`setSnapPoint`の引数と「座標も別も同じなら通知しない」、`getSnapPoint`・`clearSnapPoint`）とファイル先頭の責務（3行以内のまま）を直す。ほかのメソッドは変えない。
        *   `CanvasManager.js`：『要件4』のとおり、定数`SNAP_INDICATOR_VERTEX_FILL_COLOR`（JSDoc付き）、`render`の引数`snapPointVertex`（JSDocの`@param`）、`#drawSnapIndicator`の第3引数（JSDoc）を足す。既存の定数・描く順・大きさは変えない。ファイル先頭の責務は「吸い付きの表示」のままで足りるため変えない（JSDocの「端点への吸い付きの表示」の文言は「吸い付きの表示（結合する吸い付き＝中を塗った正方形、吸い付くだけ＝中が白の正方形）」に直す）。
        *   `main.js`：`renderCurrentState`の`render`の引数に`snapPointVertex: model.isSnapPointVertex()`を足し、`renderCurrentState`のJSDoc・`// 4.`の`EndpointSnapper`の説明コメントを直す。行数を実測して『開発資料の更新予定』へ書く。
        *   テスト（`VectorModel.snapPointVertex.test.js`）：初期は`isSnapPointVertex()`が偽、`setSnapPoint(x, y, true)`で真・`getSnapPoint()`は`{ x, y }`だけ、2引数の`setSnapPoint`は偽、同じ座標で別だけ変わると通知1回・座標も別も同じなら通知なし、`clearSnapPoint`・`replaceAllShapes`で偽に戻る、表示なしでは偽。既存の`VectorModel.snapPoint.test.js`が変更なしで全件合格すること。`CanvasManager`・`main.js`はテストを置かない（描画・配線は`node --test`の対象外）。

*   [x] タスク6: 入力の配線（`InputTracker`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新。行末はCRLF）
    *   **作業内容** :
        *   『要件2・3・5：配線』のとおり、`EndpointSnapAssist`のtypedefと`NO_SNAP_ASSIST`の項目を置き換え・足し、`handleMouseMove`（線を引いている途中・弧・矩形・円の`DRAWING`・図形作成モードのIDLE）・`handleClick`（描き始め）・`#applyLeftDragUpdate`（点の数によらず`findVertexDragSnap`で照会し、座標の組を`buildVertexDragUpdates`で作る）・`#showSnap`（別を`isVertexSnap`で問い合わせて`setSnapPoint`の3つ目の引数へ）を直す。importに`buildVertexDragUpdates`を足す。JSDoc（ファイル先頭の責務（3行以内のまま）・クラス・typedef・作業用フィールド・各メソッド）を直す。『要件2・3・5：配線』の「変えないもの」には触れない。行数を実測して『開発資料の更新予定』へ書く。
        *   テスト：このタスクでは足さない（`InputTracker`はテストを置かない方針。規則・手順はタスク1〜5で確かめている）。既存の全件合格を確かめ、`EndpointSnapAssist`の全項目が`EndpointSnapper`の公開メソッドと名前・引数でそろっていること（`main.js`が`endpointSnapper`をそのまま注入している）をコードで確かめて詳細作業内容に書く。

*   [x] タスク7: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。行末はCRLF）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認し、1章（構成図・「存在しないもの」の吸い付きの項とPhase 12-03でやらないと決めたこと・「フォルダ分割の方針」・依存方向）、2章（吸い付きの表示の点）、3章（3.・12.の「やらないこと」・対象・表示・流れ・17.の用語と「端点への吸い付きとの優先」・18.頂点の選択・22.線を続けて引く・必要なら6.）、4章の一覧（`68_VertexDragRules.md`）へ反映する。書く内容は実コードで確かめる。用語は「結合する吸い付き」「吸い付くだけ」「スナップ（丸め）」を混ぜない。「端点への吸い付きの対象を広げない」「2つ以上では吸い付かない」「弧・矩形・円のツールでは常に`null`」「直線・曲線以外の図形種別のmousemoveで表示を消す」という古い記述を、結合する吸い付きの話として正しく残すか直す。書き換える前に行末を実測して保つ。

*   [x] タスク8: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の`02_main.md`・`03_VectorModel.md`・`04_CanvasManager.md`・`06_InputTracker.md`・`12_shapes.md`・`14_edit.md`・`16_test.md`（と、記述が食い違えば`08_HistoryManager.md`・`30_UnitSnapRules.md`・`38_VertexHandleRules.md`・`67_VertexTargetRules.md`） :（更新）
        *   `./_doc/arch/68_VertexDragRules.md` :（新規。行末はCRLF）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認して反映する。`main.js`の行数（`02`）・`InputTracker.js`の行数（`06`）とテストの件数（`16`。tests・suites・テストファイルの数。作業前は tests 3910 / suites 652 / 152ファイル）は`wc -l`・`node --test`で実測して直す。書き換える前に各ファイルの行末（CRLF／LF）を実測し、保つ。新規の`68_VertexDragRules.md`は近い番号の既存のファイル（`67_VertexTargetRules.md`）の書き方・行末に合わせる。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 吸い付く先の点の走査と距離を1か所に出す（結果は変えない）
*   **作業内容** :
    *   `js/shapes/EndpointSnapRules.js`（CRLFを保持）：`snapDistance(a, b)`・`findNearestSnapPoint(shapes, point, tolerance, pointsOf)`をJSDoc付きでexport。非公開`findNearestEndpoint`を`findNearestSnapPoint`の呼び出しに書き換え（名前・引数・戻り値・走査順・同距離の扱いは不変）、`findDrawnLineSnapTarget`の始点の距離を`snapDistance`に置き換え。ファイル先頭の責務に走査と距離の共有を追記（コメント行数は従来の枠のまま）。
    *   `test/shapes/EndpointSnapRules.scan.test.js`（新規・LF）：計画どおりの欄を追加。
    *   `node --test`は3922件全件合格（既存テストの値は変更なし）。

### タスク2: 吸い付くだけの規則
*   **作業内容** :
    *   `js/shapes/VertexSnapRules.js`（新規・LF）：`VERTEX_SNAP_KIND`・typedef`VertexSnap`・`isVertexSnap`・`snapVerticesOf`・`findVertexSnapTarget`・`chooseSnapTarget`・`isVertexSnapDrawStartShapeType`・`isVertexSnapDrawEndShapeType`をJSDoc付きで作成（計画どおり）。
    *   `js/shapes/PathJoinRules.js`（CRLF保持）：`lineEndpointOf`のJSDocの使う側に`VertexSnapRules`を追記（コメントのみ）。`js/shapes/PathVertexRules.js`（LF保持）：ファイル先頭の責務の共有先に`VertexSnapRules`を追記（3行のまま。コメントのみ）。
    *   `test/shapes/VertexSnapRules.test.js`（新規・LF）：37件。回した矩形・弧は`createTransformed`で作った。
    *   `node --test`は3959件全件合格（既存テストの値は変更なし）。
    *   修正（diff監査の指摘）：曲線の制御点`points[1]`・弧の頂上`points[2]`に吸い付かないことを無条件で検証するよう直した（以前は分岐で検証が飛んでいた）。候補に曲線・弧の`points`全部を足す一時変更で2件とも落ちることを確認し、元に戻した。

### タスク3: 照会の手順と、吸い付くだけを結合として扱わない関門
*   **作業内容** :
    *   `js/edit/EndpointSnapper.js`（LF保持）：`findDrawStartSnap`・`findDrawEndSnap`・`findDrawnLinePointSnap`・`findVertexDragSnap`・`isVertexSnap`をJSDoc付きで追加。`#toUsableSnap`の先頭に`isVertexSnap(snap)`なら`null`の分岐を足し、`joinDraggedEndpoint`の冒頭に`snap = this.#toUsableSnap(snap)`を足した。importに`VertexSnapRules`の5つを追加。ファイル先頭の責務・クラスのJSDoc（依存の制約・前提・通知の回数）を直し、今の3つの照会のJSDocに「結合する吸い付きだけの照会」を足した。今の公開メソッドの中身・ほかの非公開メソッドは変えていない。
    *   `findDrawnLinePointSnap`は、作成途中の図形が無ければ最初に`null`を返し`screenLengthToWorld`も呼ばない（計画の「作成途中が無ければ`null`」のとおり）。
    *   `test/edit/EndpointSnapper.vertexSnap.test.js`（新規・LF）：偽のmodelで最初の表の欄・関門・`Ctrl`列・今の照会が`null`のまま、を確かめる（31件）。`test/edit/EndpointSnapper.vertexSnap.flow.test.js`（新規・LF）：実物のVectorModel・HistoryManagerで、隠した・ロックした図形・ロックしたフォルダの中の図形に吸い付かないこと、直線のツール（点2つ・点3つ）・ほかの線の途中の点・矩形のツールの流れ、取り消し1回を確かめる（5件）。
    *   `node --test`は3995件全件合格（既存テストの値は変更なし）。行末はEndpointSnapper.jsとテスト2本ともLF（CR数0）。

### タスク4: まとめ移動の座標の組み立てを規則へ切り出す
*   **作業内容** :
    *   `js/core/VertexDragRules.js`（新規・LF）：先頭の責務（3行以内）、typedef`VertexDragOrigin`・`VertexDragUpdate`、`buildVertexDragUpdates(origins, anchor, target, anchorOrigin)`をJSDoc付きで作成（アンカーへ`target`をそのまま入れる理由を記載）。importなし。計算は`InputTracker`の`#applyLeftDragUpdate`の今の`delta`・`updates`と同じ（`InputTracker`は変えていない）。
    *   `test/core/VertexDragRules.test.js`（新規・LF）：規則5件（`0.7→0.1`のように足し算を通すと一致しない値でアンカーが`target`と厳密に一致・点3つの移動量と並び・`anchorOrigin`が`null`・同一性での比較と対照・引数を書き換えない）と、実物の`VectorModel`・`HistoryManager`・`EndpointSnapper`の流れ3件（押した点が他図形の頂点にちょうど合いほかの点が同じ量動く・取り消し1回／別の線の端点の近くでも`VertexSnap`で`joinDraggedEndpoint`が`false`・対照に`SnapTarget`／動かしている図形の頂点には吸い付かず動かしていない図形には吸い付く）。
    *   `node --test`は4003件全件合格（既存テストの値は変更なし）。行末は新規2ファイルともLF（CR数0）。

### タスク5: 吸い付くだけの表示（モデルの別・描き分け・受け渡し）
*   **作業内容** :
    *   `js/core/VectorModel.js`（LF保持）：非公開フィールド`#snapPointVertex`（JSDoc付き）、`setSnapPoint(x, y, vertex = false)`（座標も別も同じなら通知しない。`vertex === true`のときだけ吸い付くだけ）、`isSnapPointVertex()`を足し、`clearSnapPoint`・`replaceAllShapes`・コンストラクタで別を偽にした。`getSnapPoint()`の戻り値は`{ x, y }`のまま。JSDocとファイル先頭の責務（3行のまま）を直した。
    *   `js/core/CanvasManager.js`（LF保持）：定数`SNAP_INDICATOR_VERTEX_FILL_COLOR = '#ffffff'`（JSDoc付き）、`render`の引数`snapPointVertex = false`（`@param`付き）、`#drawSnapIndicator(point, scale, vertex)`で中の色を切り替えた。枠・大きさ・線幅・描く順は変えていない。
    *   `js/main.js`（CRLF保持）：`renderCurrentState`の`render`の引数に`snapPointVertex: model.isSnapPointVertex()`を足し、JSDoc・`// 4.`のコメントを直した。行数は1296行から1297行。
    *   `test/core/VectorModel.snapPointVertex.test.js`（新規・LF）：7件（初期は偽・`true`で真かつ`getSnapPoint`は`{x,y}`だけ・2引数は偽・同じ座標で別だけ変わると通知1回／すべて同じなら通知なし・別が同じで座標だけ変わる・`clearSnapPoint`で偽に戻る・`replaceAllShapes`で偽に戻る）。
    *   `node --test`は4010件全件合格（既存テストの値は変更なし）。行末はVectorModel.js・CanvasManager.js・新規テストがLF（CR数0）、main.jsがCRLF（1297/1297）。

### タスク6: 入力の配線（`InputTracker`）
*   **作業内容** :
    *   `js/core/InputTracker.js`（CRLF保持。2112行から2124行、CR/LFとも2124）：importに`buildVertexDragUpdates`を足し、`EndpointSnapAssist`のtypedefと`NO_SNAP_ASSIST`を`findDrawStartSnap`・`findDrawEndSnap`・`isVertexSnap`（既定false）・`findVertexDragSnap`・`findDrawnLinePointSnap`に置き換え・追加した。呼ぶ場面：`handleMouseMove`の線を引いている途中は`findDrawnLinePointSnap`、弧・矩形・円の`DRAWING`は`findDrawEndSnap`、図形作成モードのIDLEと`handleClick`の描き始めは`findDrawStartSnap`。`#applyLeftDragUpdate`は`#dragEndpoint`の有無によらず（Ctrlでなければ）`findVertexDragSnap(#dragEndpoint, #vertexDragOriginsのshapeId, target)`で照会し、座標の組を`buildVertexDragUpdates(#vertexDragOrigins, anchor, target, #unitSnapHandleOrigin)`で作る（今の`delta`・`updates`の計算を置き換え）。`#showSnap`は`setSnapPoint(snap.x, snap.y, this.#snapAssist.isVertexSnap(snap))`。`#onLeftDragEnd`・`#resetSnapState`・`hitTestHandle`・丸めの順などは変えていない。
    *   JSDoc：ファイル先頭の責務（行数は従来のまま）・クラス・typedef・`#snapAssist`・`#drawStartSnap`・`#drawEndSnap`・`#dragEndpoint`・コンストラクタの`@param`・`hasCtrlModifier`・`handleMouseMove`・`handleClick`・`#beginLeftDrag`・`#applyLeftDragUpdate`・`#onLeftDragEnd`・`#showSnap`を直した。
    *   確認：`EndpointSnapAssist`の全項目（`findDrawStartSnap`・`findDrawEndSnap`・`findDrawnLinePointSnap`・`findVertexDragSnap`・`isVertexSnap`・`resolveDragEndpoint`・`commitDrawnLine`・`joinDraggedEndpoint`・`isDrawingLine`・`getDrawnLineLastPoint`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`）が`js/edit/EndpointSnapper.js`の公開メソッドと名前・引数でそろっていること、`main.js`が`endpointSnapper`をそのまま第5引数へ注入していること（`main.js`192行）をコードで確かめた。旧名（`findDrawSnap`・`findDragSnap`・`findDrawnLineSnap`）は`InputTracker.js`に残っていない。
    *   `node --test`は4010件全件合格（既存テストの値は変更なし）。

### タスク7: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`（CRLFを保持。CR/LFとも1072から1091）を、実コード（`VertexSnapRules`・`VertexDragRules`・`EndpointSnapper`・`InputTracker`・`VectorModel`・`CanvasManager`）で確かめながら直した。用語は「結合する吸い付き」「吸い付くだけ」「スナップ（丸め）」で統一した。
    *   1章：構成図（`VertexSnapRules.js`・`VertexDragRules.js`の新規2行、`EndpointSnapRules.js`・`EndpointSnapper.js`・`PathJoinRules.js`・`PathVertexRules.js`の行、テスト一覧に今回の6ファイル）、「存在しないもの」（12-01・12-02の項を「結合する吸い付きの対象は広げていない・吸い付くだけが入った」へ、2つ以上選んだときの吸い付きを結合する吸い付きに限定、Phase 12-03でやらないと決めたことを新設）、「フォルダ分割の方針」（用語・`VertexSnapRules`・`VertexDragRules`）、「依存方向」（(1)(2)と`core/`内の向き）。
    *   2章「吸い付きの表示の点」（別の持ち方）。3章3.（吸い付きの項・頂点のドラッグの項）、6.（記録の時点は変わらない旨の1文）、12.（見出し・用語・モジュールの分担・描き始め・描いている途中・描き終え・ハンドルのドラッグ・対象・表示・表示を消す箇所・`Ctrl`の間・やらないこと・変えられる図形だけが対象（`joinDraggedEndpoint`を足す・吸い付くだけを外す）、新しい項「吸い付くだけ（頂点への吸い付き。Phase 12-03）」の導入の項を含む10項目を追加）、17.（用語・優先・やらないこと・座標の表示の注）、18.（まとめ移動・発注者の決定(11)への注記・やらないこと）、22.（見出し・モジュールの分担・`mousemove`の照会・クリックの判定の順に吸い付くだけの場合を追記）。
    *   22.の「`dblclick`のリスナーは無く」は、実コードで`handleDoubleClick`の存在と`resolveDoubleClickInsertTarget`（頂点の選択のモード・`IDLE`のときだけ図形のidを返す）を確かめて、「ハンドラはあるが図形作成モードでは何もしないため2回の`click`のまま」に直した。
    *   4章の一覧に`VertexDragRules.js`→`_doc/arch/68_VertexDragRules.md`の1行を足した（資料本体はタスク8で作る）。
    *   古い記述の扱い：「端点への吸い付きの対象は広げない」「2つ以上では吸い付かない」は結合する吸い付きの話として残し、「弧・矩形・円のツールでは常に`null`」は`findDrawEndSnap`（矩形だけ□）に、「直線・曲線以外の図形種別のmousemoveで表示を消す」は`findDrawStartSnap`が`null`のとき・`Ctrl`の間に直した。
    *   diff監査の軽微2件を修正した：(1) 3章3.の吸い付きの項の「吸い付くだけだけ」を「矩形・円・弧のツールでは吸い付くだけが働く（1つ目の点は3つとも、2つ目の点は矩形だけ）」に直した。(2) 上の「9項目」を、導入の項を含む「10項目」に直した。

### タスク8: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   行末は書き換え前に実測して保った（`02`・`03`・`04`・`06`・`12`・`14`・`16`・`68`はCRLF、`30`はLF。編集後にCR数・LF数を再測定して一致を確認）。`08_HistoryManager.md`・`38_VertexHandleRules.md`・`67_VertexTargetRules.md`は今回の変更と食い違う記述が無く変えていない。`_doc/COWORK_STATUS.md`は書き換えていない。
    *   `02_main.md`：行数を1296行から1297行（`wc -l`で実測）へ、`renderCurrentState`の`snapPointVertex`の受け渡し・`// 4.`の`EndpointSnapper`の説明の更新を足した。
    *   `03_VectorModel.md`：公開メソッドの列に`isSnapPointVertex`、「吸い付きの表示の点」に別（`setSnapPoint`の3つ目の引数・`#snapPointVertex`・通知・`clearSnapPoint`・`replaceAllShapes`・`getSnapPoint`は`{ x, y }`のまま）を反映した。
    *   `04_CanvasManager.md`：`render`の`snapPointVertex`と、吸い付きの表示の中の色の描き分け（`SNAP_INDICATOR_FILL_COLOR`・新しい定数`SNAP_INDICATOR_VERTEX_FILL_COLOR`）を反映した。
    *   `06_InputTracker.md`：行数を2112行から2124行（`wc -l`で実測）へ。`EndpointSnapAssist`の項目の置き換え・呼ぶ場面（`findDrawStartSnap`・`findDrawEndSnap`・`findDrawnLinePointSnap`・`findVertexDragSnap`・`isVertexSnap`）・`#applyLeftDragUpdate`の照会と`VertexDragRules.buildVertexDragUpdates`・`#showSnap`・`#dragEndpoint`は結合する吸い付きのためだけで吸い付くだけは点の数によらないこと・`Ctrl`の間は照会しない項のメソッド名・スナップの項を直した。実コード（`InputTracker.js`の呼び出し箇所）で確かめた。
    *   `12_shapes.md`：`EndpointSnapRules`の新しい公開2つ（`snapDistance`・`findNearestSnapPoint`）と使う側、新しい節`VertexSnapRules.js`（公開・`snapVerticesOf`・`findVertexSnapTarget`・`chooseSnapTarget`・ツールごとに働く点・読むもの・使う側・知らないこと・注意・テスト）、`PathJoinRules`（`lineEndpointOf`）・`PathVertexRules`（`outlineSourceOf`）の使う側を反映した。
    *   `14_edit.md`：`EndpointSnapper`の責務・公開メソッド（新しい5つの照会。今の3つは結合する吸い付きだけの照会として残る）・依存（`VertexSnapRules`のimport。`edit/`から`shapes/`をimportする例外の記述）・契約（`commitDrawnLine`・`joinDraggedEndpoint`）・注意（関門`#toUsableSnap`が吸い付くだけを`null`にし、`joinDraggedEndpoint`にも通る）を直した。
    *   `16_test.md`：Phase 12-03の新設分（6ファイル100件。各ファイルの件数は`node --test <ファイル>`で実測）・書き換えた既存のテスト無し・テストできない箇所・件数を足した。件数は`node --test`の実測で tests 4010 / suites 659 / pass 4010 / fail 0（作業前は tests 3910 / suites 652）。テストファイルは`find test -name '*.test.js'`で158（152から+6）。
    *   `30_UnitSnapRules.md`：「端点への吸い付きとは別」「端点への吸い付きとの優先」を、吸い付き（結合する吸い付き・吸い付くだけ）に直した。
    *   `68_VertexDragRules.md`（新規・CRLF）：`67_VertexTargetRules.md`の書き方に合わせ、`buildVertexDragUpdates`・typedef・「アンカーの行き先をそのまま渡す」理由・使う側・置き場所の理由・テスト（8件）を書いた。内容は`js/core/VertexDragRules.js`で確かめた。

## 5. 懸念事項・要確認ポイント
*   **計画で決めたこと（REQの文言から一意に決まらなかった点。発注者の確認を推奨）**：
    *   (a) **描き始めが端点のときのその線の頂点**：直線・曲線のツールで既存の線Aの端点から引き始めたとき（描き足しになり、結果はAそのもの）、Aを「動かしている点を持つ図形」とみなし、Aの点は吸い付くだけの候補にしない（Aのもう一方の端点への結合する吸い付き＝閉じる・つながるは今までどおり）。こうしないと、引き始めた直後に描き始めの端点の位置へ□が出て、「既存の線の端点から引き始めたときは自分の始点に吸い付かない（正方形が出ない）」（発注者の決定、2026-11-18）と食い違うため。Aの途中の点に合わせて点を打ちたい場合はできない（別の線として描いて結合する）。
    *   (b) **描き始めが吸い付くだけのときの始点**：作成途中の線は`getEditableShapes()`に入らないため、自分の打った点は吸い付くだけの候補にならない（自分の始点への吸い付き＝閉じるは今の条件のまま）。描き始めた位置の頂点（例：矩形の角から描き始めた）には、カーソルがその頂点から8px以内にある間□が出る（そこでクリックすると「最後の点と重なる」で今までどおり終える／やめる）。
    *   (c) **今の照会メソッドを残す**：`EndpointSnapper`の`findDrawSnap`・`findDragSnap`・`findDrawnLineSnap`は名前・結果を変えず「結合する吸い付きだけの照会」として残し、新しい照会がその中で使う（既存のテストの値を変えないため。`findDrawSnap`の「直線・曲線以外の種別では`screenLengthToWorld`も呼ばない」等の既存のテストがある）。`InputTracker`の`EndpointSnapAssist`からは外す。
    *   (d) **まとめ移動の座標の組み立ての切り出し**（`core/VertexDragRules`）：REQ 要件7の「2つ以上の点を動かすときに…ほかの点が同じ量だけ動くこと」のテストのため、`InputTracker`の計算をふるまいを変えずに規則へ移す（`InputTracker`はテストを置かない方針のため）。
    *   (e) **□の色**：中は白（`#ffffff`。新しい定数）、枠は今の吸い付きの表示の枠の色（`#1f4e8c`。濃い青）。頂点の選択の選ばれていない頂点のハンドル（画面上8pxの白・枠`#4a90e2`・線幅1.5px）と大きさ・形が同じで、枠の色だけが少し濃い。吸い付く先の図形も選んでいてハンドルが出ていると、□がハンドルと重なって見分けにくい。テストプレイで見分けやすさを確かめてほしい（変えるなら色の定数だけで済む）。
    *   (f) **2つ以上の点のまとめ移動の吸い付き**：Phase 08-02bの発注者の決定(11)「2つ以上では吸い付かない」は、結合する吸い付きについてはそのまま保ち、吸い付くだけは押した点について働くようにした（REQの発注者の決定、2026-11-27）。
*   **`_doc/COWORK_STATUS.md` 2章Aの「端点への吸い付きの対象を広げるとき」への応え方**：(1)結合する吸い付きの対象は広げず、別の種類の結果`VertexSnap`（`kind: 'vertex'`）を足した（`SnapTarget`の形は変えず、`DrawnStartSnap`と同じく`kind`で区別する）。(2)`commitDrawnLine`・`clickDrawnLine`・`finishDrawnLine`・`findDrawnLineSnap`（描き始めの吸い付き）・`joinDraggedEndpoint`の冒頭の`#toUsableSnap`で吸い付くだけを`null`にし、結合の計画（`PathJoinRules`）へ渡らないようにした（弧・矩形・円のツールの描き終えの`commitDrawnLine`も両方`null`になり、今までどおり`commitDraft`で確定する）。(3)「`Ctrl`の間は何にも吸い付かない」（照会せず`null`と同じ経路）と「吸い付いたら丸めない・吸い付かなかったときだけ丸める」の優先は、照会の呼び出しの箇所を置き換えるだけで保つ。(4)頂点を2つ以上選んでいるときの決定(11)は上の(f)のとおり。COWORK_STATUSの書き換えは実装AIが行わない（現場設計・リード設計の側で反映する）。
*   **すき間（確認項目5）**：座標をぴったり合わせても、線なしの塗りどうしが辺を共有すると、Canvasの描画のアンチエイリアスで境目にごく薄い線が見えることがある（それぞれの塗りの境目の画素が半分ずつ塗られて背景が透けるため。座標のずれではなく、ズームしても幅は画面上1px程度のまま広がらない）。座標がずれていた場合のすき間は、ズームするほど広がる。見分け方を確認項目に書いた。
*   **くっついたまま離れにくいこと**：吸い付くだけで2つの図形の点を重ねた後、その点を少しだけドラッグすると、重なっているもう一方の図形の点（距離0）に吸い付いたまま動かない（画面上8pxより遠くへ動かすと離れる）。両方が結合できる線の端点なら、離すと結合する（今の結合する吸い付きのふるまい。分割した直後の重なった端の点と同じ）。離したまま少しだけ動かしたいときは`Ctrl`を押しながら動かす。
*   **照会の重さ**：吸い付くだけの照会は、`mousemove`・ドラッグの更新のたびに変えられる図形すべての点を調べる（今の端点の照会も図形ごとに`toJSON()`を読む）。点の極端に多い図形が多数ある絵で重くなるかは確かめていない（性能の改善は今回の目的外）。
*   **確認の状況**：`InputTracker`の配線・`CanvasManager`の□の描画・`main.js`の受け渡し・実際のマウスでの吸い付きの見た目は`node --test`で確かめられない（テストプレイで確かめる範囲）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。塗った閉じたパス（直線のツールで点を3つ以上打ち、始点をクリックして閉じ、塗りを付ける）・塗った矩形・円・弧・直線のツールの折れ線を2本（点4つほど。最後は`Esc`で終える）描いておく。頂点の選択（`A`）で点を動かすときは、動かす図形だけを選ぶ（吸い付く先の図形も選んでいると、その点のハンドルが□と重なって見分けにくい。5章(e)）。
1.  **頂点のドラッグ（1つ）**：頂点の選択（`A`）で閉じたパスの線の上をクリックして選び（点が出る）、その点の1つを押してドラッグし、矩形の角に近づける（画面上8px以内）と、中が白の四角が出て点が角にぴったり合う。離しても2つは別々の図形のまま（選択（`V`）で矩形を動かしても閉じたパスは動かない）。同じように円の中心・弧の両端と中心にも吸い付く。四角はドラッグが動き始めてから出る（押しただけ・カーソルを動かしただけでは出ない）。
2.  **結合する吸い付きとの見分け**：頂点の選択で折れ線Aを選び、Aの端の点をドラッグしてもう1本の折れ線Bの端の点に近づけると、今までどおり中を塗った四角が出て、離すと1本に結合する（結合した線が選ばれる）。`Ctrl`+`Z`で戻し、今度はAの途中の点をBの端の点に近づけると中が白の四角で、離しても結合しない（AとBは別の図形のまま）。Aの端の点を、Bの端の点とほかの図形の角の両方が近い所へ動かすと、近い方に吸い付く（同じくらいの距離なら塗った四角＝結合する方）。
3.  **まとめて動かす**：頂点の選択で図形を選び、点を2つ以上選ぶ（点をクリックし、ほかの点を`Ctrl`+クリック。または範囲をドラッグで囲む）。選んだ点の1つを押してドラッグし、ほかの図形の頂点に近づけると、押した点だけが中が白の四角で吸い付き、ほかの選んだ点も同じだけ動く。押した点を別の折れ線の端の点に近づけても中が白の四角で、離しても結合しない。
4.  **描くとき**：直線のツール（`1`）で、描き始める前にカーソルを矩形の角に近づけると中が白の四角が出る。そこでクリックすると角から描き始まる。円の中心に近づけてクリックすると、その位置に点が打たれて線が続く（終わらない）。同じ位置でもう一度クリックするか`Esc`で終える（`Esc`は付いてくる線を捨て、打った点までで終える）。折れ線の端の点に近づけると今までどおり中を塗った四角で、クリックするとつながって終える。矩形のツールで、1つ目の角・2つ目の角をそれぞれほかの図形の頂点に合わせると、中が白の四角が出て角がぴったり合う（折れ線の端の点でも白の四角で、結合しない）。円・弧のツールで、中心（1つ目のクリック）を頂点に合わせると中が白の四角が出て吸い付く。2つ目の点では四角は出ず、今までどおりスナップ（🧲）で丸めた位置に付いてくる。
5.  **すき間**：塗った矩形の角に吸い付かせながら、直線のツールで隣り合う閉じたパスを描き、両方の線を「なし」にして違う塗りの色を付ける。ズームしても、2つの間のすき間がズームに合わせて広がらない。注意：境目にごく薄い線が見えることがあるが、これは画面の描画のぼかし（アンチエイリアス）によるもので、ズームしても幅が画面上1px程度のまま変わらない（座標がずれているとズームするほど広がる。5章）。
6.  **`Ctrl`**：`Ctrl`を押したままカーソルを動かしている間は、どちらの四角も出ず吸い付かない（点はカーソルの位置のまま、スナップでも丸めない）。注意：`Ctrl`を押した・離しただけでは切り替わらず、次にマウスを動かしたときに切り替わる。吸い付いた状態で止めてから`Ctrl`を押してクリック（離す）すると、直前の吸い付きのまま確定する（今までどおり）。
7.  **ロック・非表示**：一覧の鍵でロックした図形・目で隠した図形の点には、どちらの吸い付きも出ない。
8.  **取り消し**：吸い付かせて動かした点のドラッグ・吸い付かせて描いた図形は、`Ctrl`+`Z` 1回で戻る（線を引いている途中の`Ctrl`+`Z`は最後の点を消す操作で、描き終えた後の`Ctrl`+`Z`が図形の取り消し）。
9.  **ほかが今までどおり**：線の端点への吸い付きと描き足し・結合・閉じる、自分の始点で閉じる（点を3つ以上打って始点に近づけると中を塗った四角）、2本の結合（`J`）、点の追加（頂点の選択で線の上をダブルクリック）・削除（点を選んで`Delete`）、分割・区間を消す、分割した直後の重なった端の点を少しだけドラッグして離すと結合し直ること、スナップ（🧲）の丸め（吸い付かなかったときの点の位置）が今までどおり動く。
*   **タスク3の実装メモ**：(i) `joinDraggedEndpoint`に足した`#toUsableSnap`は、既存テストの入力では結果が変わらず全件合格。(ii) `findDrawnLinePointSnap`は`startSnap`が`undefined`のとき今の`findDrawnLineSnap`と同じく`findDrawnLineSnapTarget`へそのまま渡る（`InputTracker`は`null`を渡す前提）。(iii) 開発資料への影響：`EndpointSnapper`の公開メソッド（新しい照会5つ・結合への関門`#toUsableSnap`の吸い付くだけの分岐・`joinDraggedEndpoint`の関門）と`edit/ → shapes/VertexSnapRules`のimport、テストの2ファイル（31件・5件）を、タスク7・8で反映する（既存の『開発資料の更新予定』の範囲内）。
*   **タスク3の修正（diff監査の軽微3件）**：`EndpointSnapper`の`commitDrawnLine`・`clickDrawnLine`・`findDrawnLineSnap`・`finishDrawnLine`の`@param`を`VertexSnap`を受ける実態（吸い付くだけは`null`と同じ扱い）に直した（JSDocのみ）。隠した・ロックした図形のテストと描き始めが端点のテストに、除外が無ければ吸い付く点だったことを確かめる対照を足した。
*   **タスク8の実装メモ**：(i) `06_InputTracker.md`の行数の注記は、直前の値2112行を「Phase 12-02完了時の値（Phase 12-01の値と同じ）」と書いた（`InputTracker`はPhase 12-02で変えていないため。計画の『作業前は2112行』による）。(ii) `06_InputTracker.md`の古い歴史的な記述（Phase 07-05の「端点への吸い付き」の見出し語など、当時の決定の文）は、結合する吸い付きの話として残し、新しい記述は項の先頭・該当箇所に足す形にした。目視で食い違いが気になる箇所があれば、`06`の「吸い付き（結合する吸い付き・吸い付くだけ）」の項を正とする。(iii) `PROJECT_ARCHITECTURE.md`4章の一覧に`68_VertexDragRules.md`は既に足してあり、資料本体を今回作った。
*   **タスク7の実装メモ**：(i) 12.の新しい項は、計画の『開発資料の更新予定』の内容を実コードで確かめて書いた（`findDrawEndSnap`は矩形だけ、`#toUsableSnap`の通る箇所に`joinDraggedEndpoint`を足した、など）。(ii) 12.の既存の行にある「`getEditableShapes()`（`EndpointSnapper`の6か所）」は、実コードで20箇所ほどに増えているため数をやめて「各所」にした。(iii) 12.・17.の古い見出し・歴史的な決定の文（Phase 07-05の「`Ctrl`を押している間は端点への吸い付きが働かなくなる」、17.の発注者の決定(1)など）は、当時の記述として直さず残した。目視で気になる箇所があれば、12.の冒頭の「単に吸い付きと書いた箇所は結合する吸い付きのこと」の一文で読み分ける。(iv) 資料の1章・12.の記述の行数・テストの件数（`16_test.md`）はタスク8で実測して直す。`PROJECT_ARCHITECTURE.md`本体にはファイルの行数・件数は書いていない（既存の通り）。
