# RES: 作業計画・作業レポート (Phase 10-01) : 外枠のハンドルでの拡大縮小
* 参照元REQ: `./_log/req/261122_1007_REQ_Phase10-01_Scale_Handles.md`

## 1. 作業目的
選択（`V`）で図形を1つ以上選んでいるとき、選んだ図形全体を囲む**外枠**（画面の縦横に沿った矩形。**線の太さを含めない**＝図形の線の中心を囲む）と、四隅の**角のハンドル**4つ・各辺の中央の**辺のハンドル**4つ（まとめて**外枠のハンドル**）を常に出し、ハンドルを引いて選択全体を拡大縮小できるようにする。角は縦横、辺はその向きだけ。`Shift`で比率を保ち、`Alt`で外枠の中心を動かさない。反対側を越えると裏返る。1px・グリッドのスナップで引いている辺・角が刻みの目に乗る（`Ctrl`の間は丸めない）。離すと確定して取り消し1件、`Esc`で引き始めの形に戻る。対象は直線・パス（直線の区間・曲線の区間・曲がり方を持つ区間・角の点）・矩形・円・弧・今の曲線のすべてで、円・弧は縦横別の倍率で楕円（楕円の弧）になる（弧は上下に裏返らず、裏返した後の外枠に上半分の弧のまま収める）。

最上位の要件：
* `node --test`が全件通る（作業前 tests 2067 / suites 337。既存のケースの期待値は変えない。変える必要のあるケースは無い見込み。下の要件Fの「既存のテストへの影響」）。
* 外枠のハンドルを引かない限り、今のふるまいを変えない（本体のドラッグ・`Alt`の複製・`Shift`の限定・クリックと`Ctrl`+クリック・範囲選択・頂点の選択（`A`）・矢印キー・位置の数値入力・整列・分布・ほかのツール）。
* 作業データの版は2、書き出しの版は3のまま。結果は図形の座標そのものに入る。図形の種別・id・重なり順は変わらない。
* 改名・整形・削除をしない。キーの割り当ての表（`KeyboardShortcuts.js`の`SHORTCUT_BINDINGS`）は変えない。到達不能の枝（`PressActionRules`の`dragHandle`・`CursorShapeRules`のハンドルの枝・各図形の`drawHandles`・`CanvasManager.render`の`showHandles`）は消さない。

## 2. アーキテクチャ設計
### 全体の方針
* **図形への変形の入口は図形クラスの第19メソッド`createTransformed(transform)`**（要件A）。2次元のアフィン変換`{ a, b, c, d, e, f }`（点`(x, y)`を`(a·x + c·y + e, b·x + d·y + f)`へ写す。Canvasの`setTransform`と同じ並び）を当てた**新しい図形**を返し、自身は変えない。回転を後で足すときもこの入口のまま（`Line`・`Curve`・`Rect`・`Path`は一般のアフィン変換で正しく働く。`Ellipse`は今の持ち方で回転・傾きを表せないため、`b`・`c`が0でない変換には`Error`を投げる＝後の「円・弧のデータの持ち方の変更」で中身を作り直す）。点の写し方は`shapes/ShapeGeometry`の新しい関数`applyAffineTransformToPoint`の1か所。
* **引き始めの状態から毎回計算する**：押下の時点で選んでいる図形のインスタンスそのもの（`originals`）を`InputTracker`が控え、追従のたびに`originals[i].createTransformed(その時点の変換)`で新しい図形を作り、`VectorModel`の新しい入口`replaceShapesKeepingIds`（同じidの位置へ差し替える。通知1回）へ渡す。控えたインスタンスは変えられないため誤差がたまらず、`Esc`・中断では**控えたインスタンスそのもの**を同じ入口で戻す（正確に元へ戻る）。
* **外枠の求め方は1つ**（要件B）：`io/SpriteSerializer`の外枠の計算（`#computeBounds`）に「線の太さの半分を広げるか」の引数を足し、新しい静的メソッド`computeShapesGeometryBounds(shapes)`（線を含まない外枠）を足す。照会は`edit/ShapeExtentReader`の新しいメソッド`getSelectedGeometryBounds()`。インスタンスは`main.js`の既存の`shapeExtentReader`（今は`// 7.10.`で生成）を使い、**3つ目は作らない**。`renderCurrentState`（`// 4.`）と`InputTracker`の注入から使うため、この1行の生成を`// 4.`の`InputTracker`の生成の前へ移す（一時的デッドゾーンを避けるため。インスタンスの数は2のまま）。
* **規則は状態を持たない新しいファイル`core/ScaleHandleRules.js`**（要件C）：外枠の出し方（選択モードだけ・小さい外枠・0の向き）・ハンドルの位置・当たり・カーソルの向き・倍率と動かない点の計算・スナップの当て方・変換の組み立て。丸めは`core/UnitSnapRules.roundPointToUnit`を呼ぶ（丸め方を写さない）。`core/`は`io/`・`edit/`をimportできないため、外枠の値は引数で受け取る（`main.js`は`shapeExtentReader`の照会結果を渡し、`InputTracker`は注入された照会`getSelectionFrameBounds`の結果を渡す）。
* **入力**（要件D）：新しい入力状態`InputState.SCALING_SELECTION`を足す（頂点のハンドルの`DRAGGING_HANDLE`に載せると、端点への吸い付き・`'move'`のカーソル・`#vertexDragOrigins`の枝と混ざるため）。押下の分岐は`PressActionRules.resolvePressAction`の第3引数（外枠のハンドル名）で先頭の行として決め（表の正本を1か所に保つ）、カーソルは`CursorShapeRules.resolveCursorShape`の新しい入力`scaleHandle`で決める。`InputTracker`は判定・計算を持たず、規則の呼び出し・控えの保持・`replaceShapesKeepingIds`への受け渡し・確定と中断の後始末だけを足す。
* **`Esc`**（要件E。**発注者の決定＝方針(a)**）：今のコードでは、ドラッグ中の`Esc`は`KeyboardShortcuts`の受理判定の手順5で止まり`cancelDraftOrClearSelection`まで届かない（REQの「今の`cancelDraftOrClearSelection`のドラッグ中の扱い」という前提と実コードが食い違っていた）。そのため、受理判定に「拡大縮小のドラッグ中は`cancel`だけを、**`Shift`・`Alt`・`Ctrl`（Meta）を問わず**通す」例外を1つ足し（**発注者の決定（追加）**：修飾キーを押したままでも`Esc`で中断して元の形に戻す。今の`#findBinding`は`Alt`押下で常に`null`、`cancel`のエントリは`ctrl: false`・`shift: FORBIDDEN`のため、例外は`#findBinding`より前に置く。判定はexportする状態なしの関数`findCancelableDragBinding`の1か所で、キーの識別は対応表の`cancel`のエントリの`codes`から取る。照会`isCancelableDrag`を注入で受け取る。対応表は変えない。拡大縮小のドラッグ中以外の照合は今のまま）、`cancelDraftOrClearSelection`の(1)は拡大縮小のドラッグなら中断して引き始めの形に戻し`true`、それ以外のドラッグは今のまま`false`にする。中断の後にボタンを離したときの`click`で選択が変わらないよう、`DragTracker.cancel`に省ける引数（中断の後の`click`を1回抑止する）を足す。
* **描画**（要件D）：`main.js`の`renderCurrentState`が`collectScaleFrame(...)`の結果を`CanvasManager.render`の新しい引数`scaleFrame`として渡すだけ。`CanvasManager`は受け取った外枠とハンドルの位置を描くだけ（`vertexHandles`と同じ形）。再描画は今の`model.onChange`の経路だけ。
* **依存方向**：新しいimportの向きは`core/ScaleHandleRules → core/InputModes・core/UnitSnapRules`、`core/CursorShapeRules → core/ScaleHandleRules`、`core/InputTracker・main.js → core/ScaleHandleRules`、`shapes/Line・Curve・Rect・Ellipse・Path → shapes/ShapeGeometry`（既存の向き）。`core/`から`edit/`・`io/`・`shapes/`への`import`文は増やさない。ただし`core/ScaleHandleRules`のJSDocだけは、`shapes/ShapeGeometry`の`AffineTransform`を`import()`型参照で参照する（実行時の依存は生まない）。**これは資料の約束ではなく新しい向き**：`PROJECT_ARCHITECTURE.md`に`import()`型参照の扱いの記述は無く、今の`js/core/`に`core/ → shapes/`の型参照は1件も無い（作業前に確かめた）。そのため本作業ではこの1か所に限り（ほかの`core/`のファイルは`shapes/`への型参照を足さない）、資料の1章（依存方向）に例外として明記する（開発資料の更新予定の1章）。循環しない（`UnitSnapRules`・`InputModes`は何もimportしない）。
* **変えないファイル**：`palette/`・`index.html`・`edit/`（`ShapeExtentReader`以外）・`io/`（`SpriteSerializer`以外）・`shapes/`の規則のファイル（`PathJoinRules`等）・`VertexHandleRules`・`PointHitRules`・`SelectionRules`・`UnitSnapRules`・`UnitSnapSettings`・`HistoryManager`・`wiring/`・`check/`。

### 要件A: 図形への変形の入口（`shapes/`。共通メソッド契約を18→19にする）
* **増やす理由**：図形の座標の持ち方が図形クラスごとに違い（`Line`は`x1, y1, x2, y2`、`Curve`・`Rect`は`points`、`Ellipse`は中心・右端・上端・開始角・終了角の5点で半径を中心からの距離で読む、`Path`は`points`・`segments`（`'bezier'`の引っ張る点は絶対座標）・`corners`）、変形の当て方を`core/`・`edit/`へ持ち込まずに表すには図形クラスのメソッドが要る。既存の`setVertex`・`translate`では円・弧の半径の縦横別の倍率と弧の上下の扱い、パスの引っ張る点を表せない。
* **`shapes/ShapeGeometry.js`**：
    *   typedef`AffineTransform`（`{ a, b, c, d, e, f }`。点`(x, y)`→`(a·x + c·y + e, b·x + d·y + f)`）を足す。
    *   `export function applyAffineTransformToPoint(transform, point)`：新しいオブジェクト`{ x, y }`を返す。引数を書き換えない。式の唯一の箇所。
* **第19メソッド`createTransformed(transform)`の契約（5クラス共通）**：
    *   変換を当てた**新しいインスタンス**を返す。自身（頂点・区間・配列）は変えず、戻り値は自身と配列・頂点・座標のオブジェクトを共有しない。
    *   `type`・`id`（そのまま写す）・`strokeColor`・`strokeWidth`・`fillColor`（線の太さは変えない）は同じ。`Path`の`closed`・区間の種類・`corners`も同じ。
    *   `transform`の検証はしない（呼び出し側の責任）。
* **各クラスの当て方**：
    *   `Line`：始点・終点を写し、`new Line(…, strokeColor, strokeWidth, fillColor)`の`id`へ自身の`id`を入れる。
    *   `Curve`：`points`の3点（始点・制御点・終点）を写す（2次ベジェは制御点ごと写せば形も同じ変換になる）。コンストラクタで作った後に`points`を写した値で置き換える（`fromJSON`と同じ形）。
    *   `Rect`：`points`の4頂点を写す（4頂点を独立に持つため、裏返っても4頂点の並びのまま描ける。`hitTestFill`は向きによらないnonzero）。作り方は`Curve`と同じ。
    *   `Path`：`points`をすべて写し、`'bezier'`の区間は`control1`・`control2`も写す（`'line'`・`'smooth'`は`{ kind }`のまま。`'smooth'`の制御点は頂点の1次式のため同じ変換に追従する）。`new Path(写した頂点, closed, strokeColor, strokeWidth, fillColor, 区間の指定の配列, corners)`で作り`id`を入れる（区間の写しはコンストラクタの`copySegment`に任せる）。
    *   `Ellipse`（円・弧）：`b !== 0 || c !== 0`なら`Error`（文言は`'Ellipse.createTransformed: 回転・傾きを含む変換は円・弧で表せません'`）。それ以外は、中心`(xc, yc)`＝`points[0]`・`rx = |points[1].x − xc|`・`ry = |points[2].y − yc|`（`draw`と同じ読み方）から、新しい中心＝`applyAffineTransformToPoint(transform, 中心)`、`rx' = |a|·rx`、`ry' = |d|·ry`。**弧（`type !== 'circle'`）で`d < 0`のときだけ、新しい中心の`y`に`ry'`を足す**（上半分の弧は外枠`[yc − ry, yc]`を持ち、上下に裏返した外枠は`[yc', yc' + ry']`になるため、上半分の弧の中心はその下端に置く＝上下に裏返らず、裏返した後の外枠に収まる。左右の裏返し`a < 0`は見た目が同じなので何もしない。円は上下・左右とも何もしない）。新しいインスタンスを`new Ellipse(中心x, 中心y, 中心x, 中心y, this.type, スタイル3つ)`で作り、非公開の`#updatePointsFromRadii(rx', ry')`（同じクラスのため別インスタンスにも呼べる）で`points[1]`〜`[4]`を今の約束の位置にそろえ、`id`を入れる。開始角・終了角は`type`から決まるため変わらない。
* **JSDoc**：5クラスのクラスJSDocの「18メソッド」を「19メソッド」にして`createTransformed`を足す。`Ellipse.js`先頭の`ELLIPSE_TYPES`の「種別で分岐する全箇所」の列挙に`createTransformed`を足す。各ファイル先頭の責務定義は「データ保持・描画・当たり判定・相互変換」に「変形を当てた新しい図形の生成」を足す（意味が広がるため実態に合わせる）。

### 要件B: 線を含まない外枠（`io/SpriteSerializer.js`・`edit/ShapeExtentReader.js`）
* `SpriteSerializer.#computeBounds(elements, includeStroke = true)`：`includeStroke`が偽なら線の太さの半分を広げない（`half = includeStroke && typeof element.strokeColor === 'string' ? … : 0`）。既存の呼び出し（`serialize`・`computeShapesBounds`）は引数を渡さず、値は変わらない。
* `static computeShapesGeometryBounds(shapes)`：`#computeBounds(shapes.map((s) => s.toDrawElement()), false)`。描画要素ごとの形の範囲（中心線の外接矩形。`polyline`は全頂点、`quadratic`・`bezierPath`は端点と各軸の極値（制御点そのものは含めない）、`ellipse`は弧の両端と軸上の端点）の和で、線なしの要素も含める。図形0個で`null`。`@throws`は`computeShapesBounds`と同じ。
* `ShapeExtentReader.getSelectedGeometryBounds()`：選択中の図形（描画順・見えない図形も含む）を`computeShapesGeometryBounds`へ渡す。選択なしで`null`。先頭の責務定義・クラスJSDocに「線の太さを含まない外枠」の照会を足す。クラスJSDocの生成箇所の記述（今は「`main.js`の`// 7.10.`」）は、**生成を実際に移す`main.js`のタスク（タスク10）で「`main.js`の`// 4.`」に直す**（要件Bのタスク3ではこの記述に触れない。タスク3〜9の間は生成が`// 7.10.`のままのため、先に直すと実コードと食い違う）。
* 今の外枠（線を含む）の値・今の呼び出し元（ステータスバーの`W:`・`H:`（選択中の図形の幅と高さ）・全体表示・位置の欄・整列・分布・書き出しの`bounds`）の結果は変えない。

### 要件C: 外枠のハンドルの規則（新規`core/ScaleHandleRules.js`）
状態なし・DOMなし。importは`./InputModes.js`の`OperationMode`と`./UnitSnapRules.js`の`roundPointToUnit`のみ。引数を書き換えず、戻り値は毎回新しいオブジェクト。
* **定数（export）**：`SCALE_HANDLE_NAMES`（`Object.freeze({ NW: 'nw', N: 'n', NE: 'ne', E: 'e', SE: 'se', S: 's', SW: 'sw', W: 'w' })`。ハンドル名の唯一の定義）・`SCALE_HANDLE_HIT_SCREEN_PX = 6`（当たりの正方形の一辺の半分。画面上px）・`SCALE_EDGE_HANDLE_MIN_SCREEN_PX = 24`（辺のハンドルを出す外枠の辺の長さの下限。画面上px＝ハンドル3つ分）。
* **typedef**：`ScaleHandle`＝`{ name, x, y }`（ワールド座標）、`ScaleFrame`＝`{ bounds: {minX, minY, maxX, maxY}, handles: ScaleHandle[] }`、`BoundsScale`＝`{ scaleX, scaleY, originX, originY }`（縦横の倍率と動かない点）、`BoundsScaleInput`（下の`computeBoundsScale`の引数）。`AffineTransform`は`import('../shapes/ShapeGeometry.js').AffineTransform`の型参照（`import`文は書かない。`core/ → shapes/`の型参照は新しい向きで、本作業ではこのファイルだけ。上の「依存方向」）。
* **`collectScaleFrame(mode, bounds, viewScale)` → `ScaleFrame|null`**（出す外枠とハンドル。描画と当たりが共有する唯一の組み立て）：
    *   `mode !== OperationMode.SELECT`・`bounds`が`null`・`viewScale`が正の有限の数値でない・`bounds`の値が有限でない → `null`。
    *   幅`W = maxX − minX`・高さ`H = maxY − minY`。`W === 0 && H === 0` → `null`（外枠もハンドルも出さない）。
    *   位置：`cx = (minX + maxX) / 2`・`cy = (minY + maxY) / 2`。`n (cx, minY)`・`e (maxX, cy)`・`s (cx, maxY)`・`w (minX, cy)`・`nw (minX, minY)`・`ne (maxX, minY)`・`se (maxX, maxY)`・`sw (minX, maxY)`。
    *   出すハンドル：`W === 0`（`H > 0`）→ `n`・`s`だけ。`H === 0`（`W > 0`）→ `w`・`e`だけ。それ以外 → 辺のハンドルは「上下の辺の`n`・`s`は`W · viewScale ≥ 24`のとき」「左右の辺の`e`・`w`は`H · viewScale ≥ 24`のとき」だけ出し、角の4つは常に出す。
    *   並び：辺のハンドル（`n`・`e`・`s`・`w`の順で出すものだけ）→ 角のハンドル（`nw`・`ne`・`se`・`sw`）。**後ろほど優先**（当たりは後ろから探し、描画は前から描くため後ろが上に重なる＝角が優先。図形の描画順・当たりの「後ろ＝手前」と同じ約束）。
    *   `bounds`は新しいオブジェクトに写して入れる。
* **`hitTestScaleHandle(frame, point, viewScale)` → ハンドル名|`null`**：`frame`が`null`・`viewScale`が正の有限でなければ`null`。`r = SCALE_HANDLE_HIT_SCREEN_PX / viewScale`として、`handles`を**末尾から**見て`|point.x − h.x| ≤ r && |point.y − h.y| ≤ r`の最初のものの`name`。
* **`resolveScaleHandleCursor(name)` → CSSの`cursor`値|`null`**：`nw`・`se`→`'nwse-resize'`、`ne`・`sw`→`'nesw-resize'`、`e`・`w`→`'ew-resize'`、`n`・`s`→`'ns-resize'`、それ以外（`null`・未知の値）→`null`。
* **`computeBoundsScale(input)` → `BoundsScale`**（倍率と動かない点の計算とスナップの当て方の唯一の箇所）。`input`＝`{ handle, bounds, pointer, keepAspect, fromCenter, step, previous }`（`handle`＝ハンドル名、`bounds`＝引き始めの外枠、`pointer`＝丸めていないカーソル位置（ワールド）、`keepAspect`＝`Shift`、`fromCenter`＝`Alt`、`step`＝刻み（`resolveUnitSnapStep`の結果。`null`なら丸めない）、`previous`＝直前に当てた`{ scaleX, scaleY }`（引き始めは`{ 1, 1 }`））。未知の`handle`は`Error`。手順（この順。軸ごとに書くが`y`も同じ）：
    1.  **軸の役割**：`handle`に`'w'`を含めば横の動く辺は`minX`（`hx = −1`）、`'e'`なら`maxX`（`hx = +1`）、どちらも含まなければ横は引かない（`hx = 0`）。縦は`'n'`→`minY`、`'s'`→`maxY`。長さ（`W`・`H`）が0の軸は「引かない軸」と同じ扱い（倍率1）。
    2.  **動かない点**：引く軸の動かない点`ax`＝`fromCenter`なら`cx`、そうでなければ反対側の辺（`hx = +1`なら`minX`、`−1`なら`maxX`）。引かない軸の動かない点は中心（`cx`）。引く軸の動く辺の元の位置`ex`（`maxX`か`minX`）。
    3.  **丸めない倍率**：引く軸ごとに`rawX = (pointer.x − ax) / (ex − ax)`。
    4.  **倍率を決める向き**（角のハンドルで`keepAspect`かつ両方の軸を引くときだけ）：`|rawX − 1| ≥ |rawY − 1|`なら横、そうでなければ縦（外枠に対するカーソルの動きの割合の大きいほう。同じなら横）。
    5.  **丸め**：丸める軸＝角で`keepAspect`でない→引く軸すべて、角で`keepAspect`→倍率を決めた向きだけ、辺→その軸だけ。丸める軸は、引いているハンドルの位置`tx = roundPointToUnit({ x: pointer.x, y: pointer.y }, step).x`（縦は`.y`）を目標にして`sX = (tx − ax) / (ex − ax)`（刻みの目への絶対位置の丸め。動かした量を刻みの倍数にするのではない）。丸めない軸は`sX = rawX`。
    6.  **ちょうど0の位置**：引く軸の`sX === 0`（目標が動かない点と同じ位置）なら、その軸は`previous.scaleX`（直前の形のまま）。角で`keepAspect`のときは、倍率を決めた向きが0なら**両方とも`previous`のまま**。
    7.  **組み合わせ**：
        *   辺・`keepAspect`なし：引く軸＝`s`、もう一方＝1。
        *   辺・`keepAspect`：引く軸＝`s`、もう一方の軸（長さが0でなければ）＝`|s|`（裏返らない）で、その軸の動かない点は中心。長さ0ならもう一方は1。
        *   角・`keepAspect`なし：`sX`・`sY`。
        *   角・`keepAspect`：`m = |倍率を決めた向きの s|`。倍率を決めた向きの符号は丸めた後の`s`の符号（丸めた目標に引く辺が乗るため）。もう一方の向きの符号は、その向きの`raw`の符号（ハンドルがその向きで動かない点を越えたか）。`raw`がちょうど0ならその向きの`previous`の符号。`scaleX = 符号X · m`・`scaleY = 符号Y · m`。
        *   長さ0の軸は常に1（`Shift`でも0のまま）。
    8.  戻り値`{ scaleX, scaleY, originX: 横の動かない点, originY: 縦の動かない点 }`。
* **`toScaleTransform(scale)` → `AffineTransform`**：`{ a: scaleX, b: 0, c: 0, d: scaleY, e: originX − scaleX · originX, f: originY − scaleY · originY }`（動かない点を固定した縦横の拡大縮小・裏返し）。
* **精度の注意**（JSDocに書く）：倍率は割り算で求めるため、ちょうど表せない値では引いた辺の位置が刻みの目から浮動小数の誤差（`1e-12`程度以下）だけずれることがある（許容）。

### 要件D: 入力・描画の配線（`core/`・`main.js`）
* **`core/InputModes.js`**：`InputState`に`SCALING_SELECTION: 'SCALING_SELECTION'`（選択モードで外枠のハンドルを引いて、選んでいる図形をまとめて拡大縮小している状態）を1エントリ足す。既存の値は変えない。
* **`core/PressActionRules.js`**：`resolvePressAction(hit, isSelected, scaleHandle = null)`。**新しい順0**：`scaleHandle`が空でない文字列なら`{ type: 'scaleSelection', handle: scaleHandle }`（外枠のハンドルは図形の本体・図形ごとのハンドルより優先。`isSelected`は呼ばない）。順1〜5は今のまま（引数2つの呼び出しの結果・`isSelected`の呼び出しの回数は変わらない）。typedef`PressAction`に`scaleSelection`を足す。頂点の選択のモードの`resolveVertexPressAction`は変えない。
* **`core/CursorShapeRules.js`**：`CursorShapeInput`に省ける`scaleHandle`（外枠のハンドル名か`null`。`undefined`は`null`と同じ）を足す。**新しい(3b)**を(3a)（待ち受け中の`'cell'`）の後・(4)の前に置く：`state`が`IDLE`か`SCALING_SELECTION`で、`scaleHandle`が文字列で、`resolveScaleHandleCursor(scaleHandle)`が`null`でなければその値。`import { resolveScaleHandleCursor } from './ScaleHandleRules.js'`。パン中・`Space`押下中・待ち受け中が優先されるのは今のまま。戻り値の型に4つのresizeを足す。ほかの枝は変えない（ツールごとにカーソルを変えない約束も変わらない）。
* **`core/DragTracker.js`**：`cancel({ suppressClick = false } = {})`。`suppressClick`が真で中断したセッションが左ボタンなら、click抑止フラグを下ろさずに立てる（中断の後に左ボタンを離したときの`click`を1回無視する。`click`が来なかった残りは今までどおり次の押下の`clearSuppressedClick()`で消える）。省いたとき（blur・`setMode`・`abortOngoingOperation`の経路）は今までどおり下ろす。
* **`core/KeyboardShortcuts.js`**：
    *   `ShortcutActions`に`isCancelableDrag: () => boolean`（`Esc`（`cancel`）で中断できるドラッグ＝拡大縮小のドラッグの最中か。受理判定専用）を足し、コンストラクタの必須の名前に加える（`'isDragging'`と同じ扱い）。
    *   **拡大縮小のドラッグ中の`cancel`の例外（発注者の決定（追加）：`Shift`・`Alt`・`Ctrl`（Meta）を押したままでも`Esc`で中断する）**。例外の判定はこの1か所に置く：
        *   モジュール内の定数`CANCEL_BINDING`（exportしない）＝`SHORTCUT_BINDINGS.find((binding) => binding.action === 'cancel')`（`SHORTCUT_BINDINGS`の直後。対応表の`cancel`のエントリそのもの。キーの識別はこの`codes`から取り、`'Escape'`をコードに書き写さない）。
        *   exportする状態なしの関数`findCancelableDragBinding(event, isCancelableDrag)` → `Readonly<ShortcutBinding>|null`：`event.code`が`CANCEL_BINDING.codes`に含まれなければ`null`（このとき`isCancelableDrag`は呼ばない）。含まれれば`isCancelableDrag()`を呼び、`true`なら`CANCEL_BINDING`、そうでなければ`null`。**修飾キー（`shiftKey`・`altKey`・`ctrlKey`・`metaKey`）と`repeat`は読まない**。`document`に触れない（`node --test`で確かめるためにexportする。対応表そのものはexportしないまま）。
    *   `#handleKeyDown`の順（手順1・2は今のまま先に効かせる）：
        *   手順3：`const dragCancelBinding = findCancelableDragBinding(event, () => this.#actions.isCancelableDrag())`、`const binding = dragCancelBinding ?? this.#findBinding(event)`。`null`なら何もしない（例外が当たらなければ今の`#findBinding`の照合のまま）。
        *   手順4（Spaceで操作する入力部品の操作中）：今のまま（`cancel`は`ctrl: false`のため、色の欄等にフォーカスがある間は例外でも何もしない＝今の`Esc`と同じ）。
        *   手順5：`dragCancelBinding === null && isDragging()`のときだけ実行しない（例外が当たったときは`isDragging()`を見ずに進む。`dragCancelBinding`は上の1回の判定の結果を使うだけで、判定をここに写さない）。`ctrl: true`のエントリの`preventDefault()`の扱いは今のまま。
        *   手順6（キーリピート）・手順7・`preventDefault()`の原則は今のまま（`cancel`は`repeatable: false`のため、押しっぱなしのリピートでは実行しない）。
    *   `SHORTCUT_BINDINGS`・`#findBinding`・`#matchesShiftRule`の処理は変えない。JSDocを実態に合わせる：`#handleKeyDown`の手順の説明（手順3の例外・手順5の例外）、`#findBinding`（「キー識別・修飾キー判定はこのメソッドでのみ行う」に「拡大縮小のドラッグ中の`cancel`の例外（`findCancelableDragBinding`。修飾キーを問わない）を除く」を足し、「`Alt`押下時は常に不一致」はこのメソッドの規則のまま、例外はこのメソッドより前に判定されることを書く）、`ShortcutActions`（`isCancelableDrag`・`cancel`の「拡大縮小のドラッグ中は修飾キーを問わず呼ばれ、引き始めの形に戻して中断する」）、コンストラクタの`@param`、クラスJSDoc、先頭の責務定義（3行以内のまま、ドラッグ中の例外があることが分かる程度に）。
* **`core/VectorModel.js`**：新しい公開メソッド`replaceShapesKeepingIds(replacements)`（`replacements`＝`Array<{ id, shape }>`）：
    *   配列でなければ`console.warn`して何もせず`0`。
    *   配列の順に、`id`の図形の位置へ`shape`を入れ、`shape.id = id`にする。`id`の図形が無い組は飛ばす。`shape`がほかの位置に既にあるインスタンスなら`console.warn`して飛ばす（同じ位置の同じインスタンスは差し替えた扱い）。
    *   1件以上差し替えたら`#pruneSelectedVertices()`の後に通知を**1回**。戻り値は差し替えた件数。
    *   触れないもの：選択集合・ホバー（idが同じため）・作成途中の図形・選択矩形・吸い付きの表示の点・直前に使った値・idの採番・並び。図形インスタンスには`id`の代入以外で触れない（図形種別・図形固有のプロパティを知らない）。履歴の記録は呼び出し側。呼び出し元は`InputTracker`の拡大縮小のドラッグのみ。
* **`core/InputTracker.js`**（呼び出しと控えの保持だけ。見積もり **+150〜190行**＝1729行→約1880〜1920行）：
    *   import：`./ScaleHandleRules.js`の`collectScaleFrame`・`hitTestScaleHandle`・`computeBoundsScale`・`toScaleTransform`。
    *   `InputAssist`に5つ目の項目`getSelectionFrameBounds(): {minX, minY, maxX, maxY}|null`（選んでいる図形全体の線を含まない外枠の照会。既定`NO_INPUT_ASSIST`は常に`null`＝外枠のハンドルなし）。コンストラクタの関数でなければ既定へ置き換える処理に同じ形で足す。
    *   作業用フィールド`#scaleDrag`（`{ handle, bounds, originals, lastScale } | null`。`originals`は押下時の選択中の図形のインスタンス（描画順）、`lastScale`は直前に当てた`{ scaleX, scaleY }`。押下で設定、`#finishLeftDrag`で必ず`null`）。
    *   非公開`#findScaleHandle(point)` → `{ handle, bounds } | null`：`collectScaleFrame(this.currentMode, getSelectionFrameBounds(), this.viewTransform.getScale())`の結果を`hitTestScaleHandle`へ渡すだけ（`bounds`は`frame.bounds`）。
    *   公開`isScalingSelection()`：`this.state === InputState.SCALING_SELECTION`（押下から離す・中断まで。閾値以前を含む）。**「`Esc`で中断できるドラッグか」の判定の唯一の箇所**（`main.js`が`KeyboardShortcuts`の`isCancelableDrag`へ注入し、`cancelDraftOrClearSelection`の(1)もこのメソッドを呼ぶ。ほかの箇所で`state === InputState.SCALING_SELECTION`をこの判定のために比べない）。
    *   `handleMouseMove`（選択モード・頂点の選択モードのIDLEの枝）：`#findScaleHandle`を求め（頂点の選択モードでは規則が`null`を返す）、`#updateCursor(hit, そのハンドル名か null)`へ渡す。ホバーの設定は今のまま（ハンドルの下の本体のホバーの強調も今のまま出る）。
    *   `handleMouseDown`（選択モードの枝。待ち受け中の早期`return`の後）：`#findScaleHandle(point)`を求め、`resolvePressAction(hit, isSelected, その名前か null)`へ渡す。結果が`scaleSelection`なら非公開`#beginScaleSelection(event, point, 見つけた{handle, bounds})`。
    *   `#beginScaleSelection`：`#scaleDrag`に`{ handle, bounds, originals: model.getShapes()のうち選択中のもの, lastScale: { scaleX: 1, scaleY: 1 } }`を入れてから`#beginLeftDrag(event, InputState.SCALING_SELECTION, point)`。開始できなければ`#scaleDrag = null`。（`#beginLeftDrag`の中の`#updateCursor()`がハンドルの向きのカーソルにするため、先に入れる。）`Alt`の複製の記憶（`#duplicateOnMove`）は立てない。
    *   `#beginLeftDrag`：`nextState`の型に`'SCALING_SELECTION'`を足す（処理は今のまま。`SCALING_SELECTION`では`#moveOrigin`等は`null`・`#vertexDragOrigins`は空のまま）。
    *   `#isLeftDragState`：`SCALING_SELECTION`を足す（ドラッグ中のホイールの追従・`Space`のカーソルの判定に効く）。
    *   `#onLeftDragStart`：`beginEdit()`する状態に`SCALING_SELECTION`を足す（複製は`MOVING_SELECTION`のときだけのまま）。
    *   `#applyLeftDragUpdate`：`SCALING_SELECTION`なら非公開`#applyScaleUpdate(event, point)`へ振り分けて`return`。`#applyScaleUpdate`：刻み`resolveUnitSnapStep(getUnitSnapStep(), hasCtrlModifier(event))`、`computeBoundsScale({ handle, bounds, pointer: point, keepAspect: event.shiftKey, fromCenter: event.altKey, step, previous: lastScale })`、`lastScale`を更新、`toScaleTransform`で変換、`model.replaceShapesKeepingIds(originals.map((s) => ({ id: s.id, shape: s.createTransformed(変換) })))`（通知1回）。修飾キーは追従のたびのイベント（`mousemove`・ドラッグ中の`wheel`）で読む。
    *   `#onLeftDragCancel`：`SCALING_SELECTION`で`#isEditOpen`（閾値超過で`beginEdit`済み）なら、`#finishLeftDrag`の前に`model.replaceShapesKeepingIds(originals.map((s) => ({ id: s.id, shape: s })))`で引き始めのインスタンスへ戻す（`commitEdit`は前後が同じため記録されない）。
    *   `#finishLeftDrag`：`#scaleDrag = null`を足す。離したとき（`#onLeftDragEnd`）は今の図形のまま確定（`commitEdit`で取り消し1件）。
    *   `cancelDraftOrClearSelection`の(1)：ドラッグ中で`this.isScalingSelection()`が真なら`this.#drag.cancel({ suppressClick: true })`（→`#onLeftDragCancel`で元に戻す）して`true`。それ以外のドラッグは今のまま`false`。（判定は`isScalingSelection()`を呼ぶだけで、`state`をここで直接比べない。）
    *   `handleClick`（選択モード。待ち受け中の判定の後・`hit.handle`の判定の前）：`#findScaleHandle({ x, y })`が`null`でなければ何もせず`return`（押して閾値以内で離しただけ・`Ctrl`+クリックで選択を変えない）。
    *   `#updateCursor(hit = null, scaleHandle = null)`：`resolveCursorShape`へ`scaleHandle: this.#scaleDrag !== null ? this.#scaleDrag.handle : scaleHandle`を渡す。
    *   ファイル先頭の責務定義（外枠のハンドルでの拡大縮小を足し、修飾キーの用途に「拡大縮小のドラッグで`Shift`・`Alt`・`Ctrl`を規則の関数へ渡す」を足す）・クラスJSDoc・各メソッドのJSDocを実態に合わせる。`InputState`・パンのフラグ等の状態の持ち主は動かさない。
    *   **中断・後始末を説明しているJSDocの直し**（拡大縮小だけは中断で引き始めの形に戻すため、「ドラッグ中に反映済みの頂点・位置は取り消さず残る」等の記述が実態と食い違う）。少なくとも次の箇所（行番号は作業前の実測）を、「拡大縮小のドラッグ（`SCALING_SELECTION`）は中断すると`#onLeftDragCancel`で引き始めのインスタンスへ戻し、記録されない。ほかの左ドラッグは今までどおり反映済みの変化が残り1件として確定する」が分かる形に直す：
        *   `setMode`（476〜482行付近。(1)の「頂点・位置の変更は確定済みのまま残り」「中断した左ドラッグ（本体ドラッグ・moveハンドル・ハンドル変形）で頂点・位置の変化が残った場合は…確定する」）。
        *   `cancelDraftOrClearSelection`（587行付近。(1)の「ドラッグ中なら何もしない」を、拡大縮小のドラッグなら中断して引き始めの形に戻し`true`、それ以外のドラッグは何もしない、に。`@returns`の「(2)(3)(4)を実行したらtrue」に(1)の中断を足す）。
        *   `abortOngoingOperation`（646〜654行付近。「中断した左ドラッグ…で頂点・位置の変化が残った場合は…確定する」「ドラッグ中に反映済みの頂点・位置は取り消さず残る」）。
        *   `#abortOngoingOperation`（721〜723行付近。左ドラッグが`#onLeftDragCancel`でIDLEへ戻る説明に、拡大縮小は引き始めの形へ戻ることを足す）。
        *   `#onLeftDragCancel`（1442〜1444行付近。中断の経路に`Esc`（`cancelDraftOrClearSelection`(1)）を足し、拡大縮小の戻し方を書く）。
        *   `#finishLeftDrag`（1536〜1541行付近。「ドラッグ中に反映した変更（頂点・位置）は取り消さない」「中断で残った変化も1件として記録される」に、拡大縮小の中断は呼び出し前（`#onLeftDragCancel`）に戻してあるため記録されないことを足す。作業用フィールドの列挙に`#scaleDrag`を足す）。
        *   上のほかにも、中断・後始末で「取り消さない・残る」と説明している箇所があれば同じく直す（処理は変えない。JSDocだけ）。
* **`core/CanvasManager.js`**：`render`に省ける`scaleFrame = null`（`ScaleFrame`の形。省略時は描かない＝今と同じ）。描く位置は頂点のハンドル（5-2）の後・作成中の図形（6）の前。非公開`#drawScaleFrame(frame, scale)`：倍率が正の有限値でなければ描かない。外枠は`bounds`の矩形を線幅`1 / scale`（画面上1px）・色`#4a90e2`で`strokeRect`（新しい定数`SCALE_FRAME_LINE_WIDTH = 1`・`SCALE_FRAME_STROKE_COLOR = '#4a90e2'`）。ハンドルは`handles`の並びの順に、選ばれていない頂点のハンドルと同じ見た目（`VERTEX_HANDLE_SIZE`・`VERTEX_HANDLE_LINE_WIDTH`・`VERTEX_HANDLE_FILL_COLOR`・`VERTEX_HANDLE_STROKE_COLOR`を流用。`÷ scale`）。`save`/`restore`。状態・図形種別・選択・操作モードを判定しない。
* **`main.js`**：
    *   `import { collectScaleFrame } from './core/ScaleHandleRules.js'`。
    *   `// 7.10.`の`const shapeExtentReader = new ShapeExtentReader({ model });`を`// 4.`の`InputTracker`の生成の前へ移す（コメントで2か所の生成の1つであることと移した理由＝`renderCurrentState`・`InputTracker`の注入が使うため、を書く。`// 7.10.`・`// 7.11.`は同じインスタンスを使い続ける。新しいインスタンスは作らない）。
    *   生成を移すのと同じタスク（タスク10）で、`js/edit/ShapeExtentReader.js`のクラスJSDocの生成箇所の記述（作業前は17行目の「main.jsの`// 7.10.`とwiring/DisplayWiringの内部の2か所で生成する」）の`// 7.10.`を`// 4.`に直す（このファイルで変えるのはこの記述だけ）。
    *   `InputTracker`の第7引数に`getSelectionFrameBounds: () => shapeExtentReader.getSelectedGeometryBounds()`を足す。
    *   `renderCurrentState`：`scaleFrame: collectScaleFrame(inputTracker.getMode(), shapeExtentReader.getSelectedGeometryBounds(), viewTransform.getScale())`を`canvasManager.render`へ渡す（JSDocに外枠のハンドルの受け渡しを書く。`showHandles: false`のコメントは「外枠のハンドルは図形ごとの`drawHandles`を使わず`scaleFrame`で描く」に直す）。
    *   `// 8.`の`KeyboardShortcuts`の注入に`isCancelableDrag: () => inputTracker.isScalingSelection()`を足す。
    *   判定・計算は持たない（受け渡しだけ）。

### 要件E: `Esc`・確定・中断・押して離しただけ
* 離す（`#onLeftDragEnd`）→`#finishLeftDrag`の`commitEdit()`で取り消し1件（取り消しで引く前の形と選択、やり直しで引いた後に戻る。`SnapshotAdapter`の今の仕組み）。
* `Esc`（`Shift`・`Alt`・`Ctrl`（Meta）を押したままでも同じ）：`KeyboardShortcuts`の手順3・5の例外（`findCancelableDragBinding`） → `main.js`の`cancel`（`styleEyedropper.cancelPicking(fallback)`。拡大縮小のドラッグは待ち受け中には始まらないため`fallback`へ進む）→ `cancelDraftOrClearSelection`(1) → `DragTracker.cancel({ suppressClick: true })` → `#onLeftDragCancel`で引き始めのインスタンスへ戻す → `#finishLeftDrag`（記録されない）。ボタンを離したときの`click`は抑止される。
* ウィンドウのフォーカスが外れる・`setMode`・`abortOngoingOperation`（今の中断の経路）も`#onLeftDragCancel`を通るため同じく元に戻る。
* 押して閾値以内で離した：`#onLeftDragStart`が呼ばれず記録も変更も無い。直後の`click`は`handleClick`の外枠のハンドルの判定で何もしない。

### 要件F: テスト（REQ要件4）
座標はちょうど表せる値（整数・0.5・0.25等）を使い、形の比較は厳密な一致か小さな許容量（`1e-9`）で行う。`InputTracker`・`main.js`・`DragTracker`の`window`の購読・`KeyboardShortcuts`の`#handleKeyDown`は`document`・`window`に依存するためテストを置かない（`_doc/arch/16_test.md`の方針）。
* `test/shapes/ShapeGeometry.test.js`：`applyAffineTransformToPoint`（拡大・裏返し・平行移動・回転を含む一般の変換・新しいオブジェクト・引数不変）。
* `test/shapes/Line.test.js`・`Curve.test.js`・`Rect.test.js`・`Ellipse.test.js`・`Path.test.js`：`createTransformed`。縦横別の倍率・裏返し（横・縦・両方）・動かない点の位置で、変形後の`toJSON()`・`toDrawElement()`が期待どおり。線の太さ・色・塗り・`id`・`type`が変わらないこと。自身が変わらないこと・戻り値と頂点を共有しないこと・同じ自身へ別の変換を当てた結果が重ねて当てた結果に頼らないこと（同じ自身から2回作って2回目が1回目の影響を受けない）。`Ellipse`：円が縦横別の倍率で楕円（`radiusX ≠ radiusY`）になる・`points[3]`・`[4]`が今の約束の位置・弧の上下の裏返しで上半分の弧のまま裏返した後の外枠（`SpriteSerializer.computeShapesGeometryBounds`ではなく描画要素の`x`・`y`・`radiusX`・`radiusY`で）に収まる・左右の裏返し・`b`・`c`が0でない変換で`Error`。`Path`：直線の区間・曲線の区間（`'smooth'`の制御点が頂点と同じ変換に追従＝`toDrawElement`の`cubic`）・曲がり方を持つ区間（引っ張る点の変換）・`corners`の保持・閉じたパス。
* `test/io/SpriteSerializer.test.js`：`computeShapesGeometryBounds`（線を含む外枠より線の太さの半分だけ内側・曲線・円・弧の極値を含む・線なしの要素・図形0個で`null`・`computeShapesBounds`・`serialize`の値が変わらないこと）。加えて、`createTransformed`した図形の描画要素と外枠（書き出し）。
* `test/edit/ShapeExtentReader.test.js`：`getSelectedGeometryBounds`（選択中だけ・選択なしで`null`・見えない図形を含む・`getSelectedBounds`の値は変わらない）。
* `test/core/VectorModel.replaceShapesKeepingIds.test.js`（新規）：複数の図形の差し替えが通知1回・位置とidの保持・選択集合とホバーの不変・存在しないidの飛ばし・ほかの位置にあるインスタンスの警告・同じ位置の同じインスタンス・配列でない引数・0件で通知なし・戻り値。
* `test/core/ScaleHandleRules.test.js`（新規）：8つのハンドルの位置・並び、小さい外枠（24pxの境界ちょうどと僅かに下・表示倍率による違い）・幅か高さが0・両方0・選択モード以外・`bounds`が`null`での出し方、当たり（境界・ハンドルどうしの重なりで角を優先・`null`）、カーソルの向き、倍率と動かない点（角・辺・`Shift`（角・辺）・`Alt`・`Shift`+`Alt`・裏返り（横・縦・両方）・ちょうど0で`previous`のまま（`Shift`の角を含む）・幅か高さが0の向き）、スナップ（角・辺の丸め・`Shift`・`Alt`で丸める向き・刻み`null`で丸めない・外枠の辺がもともと半端な位置）、`toScaleTransform`（外枠の4隅の写り先）、引数不変。
* `test/core/CursorShapeRules.test.js`：`scaleHandle`の4方向・`SCALING_SELECTION`・パン中・`Space`押下中・待ち受け中の優先・`MOVING_SELECTION`等では使わない・省略時は今と同じ。
* `test/core/PressActionRules.test.js`：第3引数があれば`scaleSelection`（本体・空白・選択集合外の上でも。`isSelected`を呼ばない）・`null`／省略で今と同じ。
* `test/core/KeyboardShortcuts.test.js`（`globalThis`・`document`に触れない範囲）：`isCancelableDrag`だけを欠くとErrorで欠落名がそれだけになる（コンストラクタの配線検証）。`findCancelableDragBinding`：①**修飾キーを押したままの`Esc`で中断される**＝`code: 'Escape'`で`shiftKey`・`altKey`・`ctrlKey`・`metaKey`の16通りの組み合わせすべてで、照会が`true`なら`action`が`'cancel'`のエントリ（凍結済み・`repeatable: false`）が返る。②**ドラッグ中でなければ今のまま**＝同じ16通りで照会が`false`なら`null`（例外は効かず、今の`#findBinding`の照合へ進む）。③`Escape`以外の`code`（`KeyV`・`Space`等）は照会が`true`でも`null`で、照会を呼ばない。④`Escape`では照会を1回だけ呼ぶ。⑤`event`を書き換えない。ファイル先頭の責務定義を、配線漏れの検出に加えて拡大縮小のドラッグ中の`cancel`の例外の判定を確かめる旨に直す。`#handleKeyDown`を通した流れ（`Esc`→`cancel`→中断）は`document`に依存するためテストプレイ（要件Gの9.）で確かめる。
* `test/io/DocumentSerializer.roundtrip.test.js`：`createTransformed`した5クラス（裏返したパス・楕円にした円・弧を含む）の作業データの往復。
* **既存のテストへの影響**：期待値を変えるケースは無い見込み（`resolvePressAction`・`resolveCursorShape`は引数・入力を省いたときに今と同じ、`KeyboardShortcuts`の既存の2件は`isCancelableDrag`を足しても成り立つ（空のコールバックの文言の確かめは`nudgeSelection`・`isDragging`を含むかだけ）、`InputState`の値を列挙するテストは無い）。変える必要が出たらケースと理由を詳細作業内容と懸念事項に書く。

### 要件G: ふるまいの確認（テストプレイの確認項目。REQ要件5）
タスク13で発注者へ提示する。文言は実コード（選択・移動・キーの受理）を確かめて書いた。
0.  **準備**：ブラウザで`index.html`を開き、`Ctrl`+`F5`で最新の状態にする。次を描いておく：直線（`1`。始点と終点をクリックして点を2つ打ち、**終点をもう1回クリック**（または`Esc`）で終える。直線のツールは続けて引く線で、2回目のクリックは点を打って引き続けるだけ。点が2つで終えると直線になる）、弧（`3`）、矩形（`4`）、円（`5`）、曲線のパス（直線のツール`1`で3点打って最後の点をもう1回クリックで終え、続けて曲線のツール`2`でその端点（青い四角が出る位置）から引き始めて2〜3点打ち、最後の点をもう1回クリック＝直線の区間と曲線の区間を混ぜた1本）、弧を結合したパス（弧の右端の青い四角が出る位置から直線のツールで引き始め、点を打って終える）。数字キーは`SHAPE_TYPES`の並び（`1`直線・`2`曲線・`3`弧・`4`矩形・`5`円）。今の曲線は、次の内容のファイル`curve.ozve.json`を作り、キャンバスパレット（📁）の「インポート」で読み込む：`{"format":"oz-vector-editor","version":2,"shapes":[{"type":"curve","id":"c1","points":[{"x":0,"y":0},{"x":60,"y":-80},{"x":120,"y":0}],"strokeColor":"#000000","strokeWidth":2,"fillColor":null}]}`（原点の近くに出る）。太い線の図形も1つ用意する（オプションバーの太さを10などにして描く）。
1.  **外枠とハンドルの表示**：選択（`V`）で図形をクリックすると、形を囲む青い外枠と8つの白い四角のハンドルが出る。太い線の図形では、外枠が線の太さの半分だけ内側（線の中心）にある。表示倍率を変えても外枠の線（1px）とハンドルの大きさは変わらない。範囲選択・`Ctrl`+クリックで複数選ぶと、全体を1つの外枠が囲む。頂点の選択（`A`）に切り替えると選択が外れて外枠も消え、`A`のまま`Ctrl`+クリックで図形を選んでも外枠は出ない。空白をクリックして選択を外すと消える。図形の本体を引いて動かしている間も外枠が図形について動く。アウトライン表示（`Z`）・黒の背景（`X`）でも見える。
2.  **小さい図形・細い図形**：小さく縮めた図形（または表示倍率を下げたとき）は、辺の中央のハンドルが消えて角の4つだけになる（外枠の辺が画面上で24px未満の向き）。水平・垂直な直線（直線のツール`1`で始点をクリックした後、`Shift`を押しながらカーソルを横（縦）へ動かして終点をクリックし、終点をもう1回クリックで終える。線を引いている途中の`Shift`の間は、付いてくる線の向きが横・縦・斜め45°に限られる）は、両端の2つのハンドルだけが出て、引くと長さだけが変わる（`Shift`を押して引いても太さの向きには伸びない）。
3.  **角・辺のハンドル**：角のハンドルを引くと縦横に、辺のハンドルを引くとその向きだけに伸び縮みし、反対側の角（辺）は動かない。ハンドルの上にカーソルを置くと、左上・右下は「↖↘」、右上・左下は「↗↙」、左右の辺は「↔」、上下の辺は「↕」の形になり、引いている間もその形。ハンドルの下に別の図形の線があっても、押せばハンドルが優先される。
4.  **`Shift`・`Alt`**：`Shift`を押しながら角を引くと縦横の比率が保たれ、辺を引くともう一方の向きも同じ割合で伸び縮みする（外枠の中心の線を基準に）。`Alt`を押しながら引くと外枠の中心が動かない。引いている途中で`Shift`・`Alt`を押す・離すと、次にマウスを動かしたときに切り替わる（押した・離しただけでは変わらない）。`Alt`を押してハンドルを引いても図形は複製されない（図形の本体を`Alt`で引くと今までどおり複製されて動く）。
5.  **裏返り**：ハンドルを反対側を越えて引くと、図形が裏返って反対向きに伸びる（大きさがちょうど0の形にはならない）。弧は上下には裏返らず、上半分の弧のまま、引いた側へ伸びる（今回の仮のふるまい。上下の裏返しは後の作業で入る）。左右の裏返しは見た目が同じ。
6.  **スナップ**：ステータスバーの🧲がON（起動時はON・1px）で引くと、引いている辺・角が1pxの目にそろう。単位のボタン（`1`）を押して`10`にすると10pxの目にそろう。外枠の辺がもともと半端な位置にある図形（位置の欄の値は線の太さを含むため、太さが奇数の図形で位置の欄に整数を入れると、外枠の辺は0.5ずれた位置になる。例：太さ1の矩形でXに`10`を入れると外枠の左辺は10.5）でも、引くとすぐ目にそろう。`Ctrl`を押しながら引くと、そろわずに滑らかに動く。🧲をOFFにしても滑らかに動く。
7.  **すべての図形**：直線・矩形・円・弧・曲線のパス・弧を結合したパス・今の曲線を、それぞれ拡大縮小できる。円は縦横別に伸ばすと楕円になる（これで円・弧の大きさを画面から変えられる）。曲線の形も同じように伸び縮みする（曲線の区間・弧から変わった区間とも）。線の太さと線・塗りの色は変わらない。
8.  **複数選択**：いくつかの図形を選んでまとめて拡大縮小すると、図形どうしの位置と大きさの関係を保ったまま伸び縮みする。
9.  **確定・取り消し・`Esc`**：ハンドルを押して数px動かすと拡大縮小が始まり、離すと確定する。取り消し（`Ctrl`+`Z`）1回で引く前の形に戻り（選択も引く前のまま）、やり直し（`Ctrl`+`Y`）で引いた後に戻る。引いている途中（ボタンを押したまま）で`Esc`を押すと元の形に戻り、そのままボタンを離しても選択は変わらず（離した位置が空白でも選択は外れない）、取り消しも増えない。**`Shift`・`Alt`・`Ctrl`を押したまま（比率を保つ・中心を固定する・丸めない状態で引いている途中）でも、`Esc`で同じく元の形に戻り、ボタンを離しても選択は変わらない**（Windowsでは`Ctrl`+`Esc`・`Alt`+`Esc`をOSが使うことがあり、スタートメニュー等が開いてウィンドウのフォーカスが外れた場合は、フォーカスが外れたときの中断として同じく元の形に戻る）。ハンドルを引いていない（ドラッグしていない）ときの`Shift`+`Esc`・`Ctrl`+`Esc`は今までどおり何もしない（`Esc`単体は今までどおり選択の解除）。図形の本体を引いて動かしている途中の`Esc`は今までどおり効かない。ハンドルを押して動かさずに離す（`Ctrl`を押しながらでも）と何も変わらない（選択も変わらない。ハンドルの上の`Ctrl`+クリックで選択が増減しない）。引いている途中にほかのキー（`V`・`Delete`・矢印など）を押しても今までどおり何も起きない。
10. **その後の操作**：拡大縮小した図形を、出力（作業ファイル）して「開く」で開き直す・別のキャンバスへ切り替えて戻る・コピー＆ペースト（`Ctrl`+`C`→`Ctrl`+`V`）・複製（`Ctrl`+`D`）しても同じ形。線の上のクリック・塗った内側のクリック（円・矩形・閉じたパスを塗った場合）・範囲選択で選べる。頂点の選択（`A`）で頂点を動かせる（円・弧は今までどおり頂点が出ない）。直線・開いたパス・今の曲線・拡大縮小した弧は今までどおり結合できる（線の端どうしを重ねて2本選んで`J`。楕円の弧も形を保って結合される）。出力（エンジン用）したJSを確認用ページ（`sprite-check.html`）で開くと、エディタと同じ形で描かれる。
11. **ほかが今までどおり**：図形の本体のドラッグでの移動・`Alt`での複製・`Shift`での方向の限定・クリックと`Ctrl`+クリックでの選択・範囲選択（外枠の内側の空白を押して引いても図形は動かず範囲選択になる）・頂点の選択（`A`）・矢印キー・位置の数値入力・整列・分布・重なり順・スタイル・スポイト（待ち受け中は外枠は出たままでもハンドルは働かず、クリックはスポイトの取り込みになる）・図形の作成・保存・読み込み・書き出しが今までどおり動く。位置の欄（X・Y）とステータスバーの`W:`・`H:`（選択中の図形の幅と高さ）は、今までどおり線の太さを含んだ値を表す（外枠のハンドルの位置とは線の太さの半分だけずれる）。

### 関連フォルダと論理クラス
*   **対象フォルダ**：`./js/shapes/`（図形クラス5つと`ShapeGeometry`）、`./js/core/`（新規`ScaleHandleRules`、`InputModes`・`PressActionRules`・`CursorShapeRules`・`DragTracker`・`KeyboardShortcuts`・`VectorModel`・`InputTracker`・`CanvasManager`）、`./js/io/`（`SpriteSerializer`）、`./js/edit/`（`ShapeExtentReader`）、`./js/main.js`、`./test/`。
*   **関連する論理クラス**：
    *   新規：`core/ScaleHandleRules.js`（状態なしの規則。外枠のハンドルの出し方・位置・当たり・カーソルの向き・倍率と動かない点・スナップの当て方・変換の組み立て）。
    *   既存の拡張：`Line`・`Curve`・`Rect`・`Ellipse`・`Path`（第19メソッド`createTransformed`）、`ShapeGeometry`（`applyAffineTransformToPoint`・`AffineTransform`）、`SpriteSerializer`（`computeShapesGeometryBounds`）、`ShapeExtentReader`（`getSelectedGeometryBounds`）、`VectorModel`（`replaceShapesKeepingIds`）、`InputModes`（`SCALING_SELECTION`）、`PressActionRules`（第3引数・`scaleSelection`）、`CursorShapeRules`（`scaleHandle`・(3b)）、`DragTracker`（`cancel`の省ける引数）、`KeyboardShortcuts`（`isCancelableDrag`・`findCancelableDragBinding`・手順3・5の例外）、`InputTracker`（拡大縮小のドラッグの配線・`isScalingSelection`・`InputAssist.getSelectionFrameBounds`）、`CanvasManager`（`render`の`scaleFrame`）、`main.js`（受け渡し・`shapeExtentReader`の生成位置）。

### 参照する責務
*   **憲法**：変更は本RESで対象と明示したファイルだけ。各`.js`の先頭に3行以内の責務定義、クラス・関数・メソッド・データ構造にJSDoc。責務を逸脱するロジックを足さない。改名・整形・不要に見えるコードの削除をしない。
*   **依存方向**（1章）：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`・`asset/`をimportしない。`core/`から`shapes/`をimportするのは`core/ShapeFactory`だけ。（JSDocの`import()`型参照の扱いは資料に記述が無く、今の`js/core/`に`core/ → shapes/`の型参照は1件も無い。本作業の`core/ScaleHandleRules`の`AffineTransform`の型参照は資料の約束に基づくものではなく新しい向きのため、この1か所に限り、開発資料の更新予定の1章で依存方向の例外として明記する。）`io/`のimportは`io/`内と`core/ShapeFactory`のみ。`edit/ShapeExtentReader`は`io/SpriteSerializer`のみをimportする。`shapes/`の共通モジュール（`ShapeGeometry`・`ShapeDataValidation`）は`shapes/`の図形クラスだけが使い、`shapes/`の外・互いをimportしない。規則の関数は状態・DOMを持たない（今は「何もimportしないか`InputModes`の値だけ」。本作業で`ScaleHandleRules → UnitSnapRules`・`CursorShapeRules → ScaleHandleRules`の規則どうしの向きが加わる）。循環importは無い。
*   **`core/`の規則のファイル**（1章「フォルダ分割の方針」）：規則は操作モードと図形種別の知識を要し、`edit/`は操作モードを知らない・`palette/`はimportを持たない・`main.js`は判定・計算を持たない・`CanvasManager`は位置を引数で受け取るだけ・`InputTracker`へは入れない、ため`core/`の規則にする。`node --test`で確かめられる形にするために切り出す。
*   **図形クラス**（`_doc/arch/12_shapes.md`）：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。座標はすべてワールド座標。共通基底クラスは無く、共通の幾何の計算は`ShapeGeometry`の関数を呼ぶ（継承ではなく関数の切り出し）。共通メソッド契約は今18メソッド（`draw`・`drawHandles`・`drawHover`・`hitTest`・`hitTestHandle`・`setVertex`・`translate`・`updateDraftEnd`・`getVertexIndexForHandle`・`intersectsRect`・`toDrawElement`・`toJSON`・`static fromJSON`・`isFillable`・`hitTestFill`・`drawOutline`・`getHandlePosition`・`getVertexHandleNames`）で、5クラスが自律実装し、メソッドを増減するときは5クラスのクラスJSDocも更新する。`toJSON`/`fromJSON`はどちらの方向でも内部配列・頂点を共有しない。`toDrawElement`は毎回新しいオブジェクト。`Ellipse`は`points[0]`＝中心・`[1]`＝右端（`x`だけを半径として読む）・`[2]`＝上端（`y`だけ）・`[3]`＝開始角の点（弧は左端・円は右端）・`[4]`＝終了角の点（右端）で、開始角・終了角は`type`から決まる固定値（保存しない）、回転は表せない。弧は画面の上半分（π〜2π）。`Path`の`'bezier'`の引っ張る点はワールド座標の絶対座標で頂点ではない。`'smooth'`の制御点は頂点の1次式（拡大縮小・回転・平行移動に追従）。`corners`は`points`と同じ並び・同じ要素数。
*   **選択状態**（2章）：`VectorModel`が保持。選択集合は選択モード・頂点の選択モード以外では空。頂点の選択は選択集合に含まれる図形の組だけを持ち、`#pruneSelectedVertices()`を選択集合・図形一式が変わる操作の通知の前に呼ぶ。保存しない・履歴の対象外。
*   **`VectorModel`**（`_doc/arch/03_VectorModel.md`）：図形配列と選択・ホバー・作成中図形・選択矩形・吸い付きの表示の点・直前に使った値の単一の真実。図形固有の頂点構造・内部プロパティ名を知らず、図形のメソッドへポリモーフィックに委譲する。`replaceShape`は1回の通知で位置へ差し替える（`keepId`・`select`）。`moveShapesBy`・`updateVertices`は1件以上で通知1回。履歴の記録は呼び出し側の責務。
*   **`InputTracker`**（`_doc/arch/06_InputTracker.md`）：入力の解釈とModel・ビュー変換への反映、編集操作の開始・確定の通知（`editRecorder`の`beginEdit`／`commitEdit`）、カーソルの形の適用（判定は`CursorShapeRules`）。図形種別を知らない。`edit/`をimportせず、注入された補助（第7引数`inputAssist`。項目ごとに関数でなければ既定へ置き換え）を呼ぶ。押下時の分岐は`PressActionRules`、カーソルは`CursorShapeRules`へ渡すだけ。左ドラッグのライフサイクルは`DragTracker`（閾値超過で`#onLeftDragStart`＝`beginEdit`、終了・中断の共通の後始末`#finishLeftDrag`＝`commitEdit`と作業用フィールドの消去）。中断（blur・`setMode`・`abortOngoingOperation`）は`#onLeftDragCancel`。`handleKeyDown`は`Space`専用。修飾キーの読み取りは規則の関数へ渡すこと等にだけ使い、`Ctrl`の読み取りは`hasCtrlModifier`に寄せる。修飾キーの用途を足すときは、先頭の責務定義・`06_InputTracker.md`の修飾キーの項・3章17.の「`Ctrl`を見る時点」の3か所をそろえる。作業用フィールドの寿命は入力状態と同じ（遷移のたびに消す対応を崩さない）。状態の持ち主の分け直しはしない。
*   **`PressActionRules`**（`_doc/arch/34_PressActionRules.md`）：選択モードの押下時の分岐の表の正本。修飾キー・操作モード・`InputState`・図形種別・`VectorModel`を知らない。`isSelected`を呼ぶのは本体の判定のときだけ（呼び出しの回数を変えない）。表を変えるときはこのファイルだけを変える。
*   **`CursorShapeRules`**（`_doc/arch/35_CursorShapeRules.md`）：カーソルの形の判定表。パン中・`Space`押下中が優先。ツールごとにカーソルの形を変えない（操作モードの分岐だけ）。`isPickingShape`・`isSelected`は関数で受け、短絡評価を保つ。importは`InputModes`だけ（本作業で`ScaleHandleRules`が加わる）。
*   **`UnitSnapRules`**（`_doc/arch/30_UnitSnapRules.md`）：丸めの規則の唯一の箇所。刻みが正の有限の数値でなければ丸めない。ちょうど中間は0から遠い側。`resolveUnitSnapStep(activeStep, suppressed)`が刻みと`Ctrl`の組み合わせの唯一の箇所。
*   **`KeyboardShortcuts`**（`_doc/arch/07_KeyboardShortcuts.md`・3章3.）：`document`の`keydown`は`Space`を`InputTracker`、それ以外を`KeyboardShortcuts`が排他的に担当（同一キーを二重に解釈しない）。受理判定の手順1〜7。ドラッグ中（手順5）は実行しない（本作業で、拡大縮小のドラッグ中の`cancel`を修飾キーを問わず通す例外が1つ加わる。判定は`findCancelableDragBinding`の1か所）。`#findBinding`は`Alt`押下で常に不一致、`ctrl: false`は`ctrlKey`・`metaKey`がともに偽、`FORBIDDEN`は`shiftKey`が偽（この規則は変えない）。対応表は変えない。
*   **`DragTracker`**（`_doc/arch/09_DragTracker.md`）：押下〜解放のライフサイクル（閾値・`window`のcapture購読・blurでの中断・終了直後のclick抑止）。ドラッグの意味は知らない。
*   **`CanvasManager`**（`_doc/arch/04_CanvasManager.md`）：純粋な描画。図形データ・選択状態・ビュー変換・表示の状態を持たず、値は`render`の引数で受け取る。頂点のハンドルは全図形の描画の後・作成中の図形の前に、画面上一定の大きさで描く。
*   **`SpriteSerializer`**（`_doc/arch/15_io.md`）：外枠`bounds`の求め方の正本（形の範囲を線の太さの半分だけ広げ、線を描かない要素は形の範囲のまま、全要素の和）。`computeShapesBounds`は`serialize(shapes).bounds`と同じ値。`io/`は`shapes/`をimportできない。
*   **`ShapeExtentReader`**（`_doc/arch/14_edit.md`）：選択中・全図形の外枠の照会。外枠の求め方は`SpriteSerializer`に任せ、対象の絞り込みだけを持つ。生成は`wiring/DisplayWiring`の内部と`main.js`の2か所（3つ目は作らない）。
*   **`main.js`**（`_doc/arch/02_main.md`）：生成・注入・同期の配線のみ。判定・計算を持たない。再描画は`renderCurrentState`の4経路（`model`・`viewTransform`・`displayState`の`onChange`とリサイズ）だけで、機能専用の再描画・同期の経路を足さない。`renderCurrentState`は`collectVertexHandles`の結果を`vertexHandles`として渡すだけ（同じ形で外枠を渡す）。
*   **履歴**（3章6.）：変更処理を`beginEdit`／`commitEdit`で挟む。前後の作業データが同じなら記録しない。ドラッグは閾値超過で開始し、終了・中断の共通後始末で確定する。
*   **テスト**（`_doc/arch/16_test.md`）：`node:test`・`node:assert/strict`のみ。公開APIだけを通し、テストのためにソースを変えない。`palette/`・`main.js`・`index.html`・`InputTracker`はテストを置かない。補助関数は各テストファイルの中に書き、JSDocを付ける。`console.warn`は`t.mock.method`で抑止する。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章**：構成図に`core/ScaleHandleRules.js`（「選択（`V`）の外枠と外枠のハンドルの出し方・位置・当たり・カーソルの向きと、引いたときの倍率と動かない点・スナップの当て方の規則（状態なし）。`InputTracker`・`CursorShapeRules`・`main.js`から使う」）と`test/core/ScaleHandleRules.test.js`・`test/core/VectorModel.replaceShapesKeepingIds.test.js`を足す。`UnitSnapRules`の使う側に`ScaleHandleRules`を足す。「存在しないもの」の「拡大縮小・回転・反転・外枠のハンドル」を、本作業でやらないこと（回転・円と弧の回転・弧の上下の裏返し・円と弧のデータの持ち方の変更・基準点の選択・幅と高さと角度の数値の欄・反転のボタンとキー・変形の状態に入る操作・回転用のハンドル・傾き（シアー）・遠近・線の太さを拡大縮小に合わせること・頂点の選択で選んだ頂点だけの拡大縮小・外枠のハンドルの端点への吸い付き・位置の欄と「大きさ」を線を含まない外枠にそろえること）に置き換える。「フォルダ分割の方針」の「規則の関数は何もimportしないか、`InputModes`の値だけ」に`ScaleHandleRules → UnitSnapRules`・`CursorShapeRules → ScaleHandleRules`を足す。`ShapeExtentReader`の生成箇所を「`main.js`の`// 4.`」に直す。依存方向の節に**例外**として「`core/ScaleHandleRules`のJSDocは`shapes/ShapeGeometry`の`AffineTransform`を`import()`型参照で参照する（`import`文ではなく実行時の依存は無い。`core/ → shapes/`の型参照はこの1か所だけ。Phase 10-01）」を明記する（今の資料に`import()`型参照の扱いの記述は無く、`core/ → shapes/`の型参照も初めてのため）。`KeyboardShortcuts`の公開の関数に`findCancelableDragBinding`が加わったことを、構成図の`KeyboardShortcuts.js`の説明に足す（必要なら）。
*   **2章**：共通メソッド契約の件数の記述（スタイル3つの項）に第19メソッド`createTransformed`（Phase 10-01。拡大縮小）を足す。選択状態の項に「外枠・外枠のハンドルの位置は毎回図形から求め、保存しない・履歴に入れない・作業データに入れない」。`Ellipse`の拡大縮小での表し方（中心を変換、`rx`・`ry`に倍率の大きさ、弧は上下に裏返らず`d < 0`で中心を`ry'`だけ下げる、`points[1]`〜`[4]`は今の約束の位置）。
*   **3章**：新しい節「25. 外枠のハンドルでの拡大縮小」（流れ・モジュールの分担・外枠の求め方・倍率の計算の手順・スナップ・`Esc`・確定・中断・発注者の決定・現場設計の決定・やらないこと・確認の状況）。3.の当たり分類と`Esc`（キーボード操作）・キーボードの受理判定の例外（拡大縮小のドラッグ中は`cancel`を`Shift`・`Alt`・`Ctrl`（Meta）を問わず通す。判定は`findCancelableDragBinding`の1か所で`#findBinding`より前、キーは`cancel`のエントリの`codes`から取る。手順1・2・4・6は今のまま。拡大縮小のドラッグ中以外の照合・「`Alt`押下中は常に不一致」は今のまま。発注者の決定（追加））、6.の記録する操作に拡大縮小、16.・17.の修飾キーを見る時点（`Shift`・`Alt`・`Ctrl`を拡大縮小のドラッグの追従のたびに読む）、17.の丸める箇所に外枠のハンドル（引いている辺・角の位置を刻みの目へ丸める）、18.の「`drawHandles`が呼ばれなくなること」に「外枠のハンドルは図形ごとの`drawHandles`・`hitTestHandle`を使わず`ScaleHandleRules`と`CanvasManager.render`の`scaleFrame`で作る。到達不能の枝は本作業では消していない」。15.の`drawHandles`の注記も同じ。
*   **4章**：一覧に`ScaleHandleRules.js` → `_doc/arch/42_ScaleHandleRules.md`を足す。
*   **`_doc/arch/`**：`42_ScaleHandleRules.md`（新規）・`06_InputTracker.md`（`SCALING_SELECTION`・`#scaleDrag`・`isScalingSelection`・`InputAssist`の5項目目・修飾キーの項・`cancelDraftOrClearSelection`(1)・行数）・`12_shapes.md`（19メソッド契約・`createTransformed`の契約と各クラス・`ShapeGeometry.applyAffineTransformToPoint`）・`03_VectorModel.md`（`replaceShapesKeepingIds`）・`04_CanvasManager.md`（`scaleFrame`・描画順・定数）・`14_edit.md`（`getSelectedGeometryBounds`・生成箇所）・`15_io.md`（`computeShapesGeometryBounds`・`#computeBounds`の引数）・`16_test.md`（新しいテストファイルと件数。`test/core/KeyboardShortcuts.test.js`の範囲に`findCancelableDragBinding`を足し、`#handleKeyDown`を通した修飾キー付きの`Esc`はテストできない箇所としてテストプレイで確かめる旨）・`30_UnitSnapRules.md`（使う側に`ScaleHandleRules`）・`32_InputModes.md`（`SCALING_SELECTION`）・`34_PressActionRules.md`（順0・第3引数）・`35_CursorShapeRules.md`（(3b)・`scaleHandle`・import）・`07_KeyboardShortcuts.md`（手順3・5の例外・`findCancelableDragBinding`・`CANCEL_BINDING`・修飾キーを問わないこと・`isCancelableDrag`）・`09_DragTracker.md`（`cancel`の省ける引数）・`02_main.md`（`shapeExtentReader`の生成位置・`getSelectionFrameBounds`・`scaleFrame`・`isCancelableDrag`の注入・生成順）。
*   **1章（タスク1で判明）**：構成図の`ShapeGeometry`の説明に`applyAffineTransformToPoint`（点へのアフィン変換。変形の式の唯一の箇所。Phase 10-01）を足す。
*   **1章・`_doc/arch/15_io.md`・`14_edit.md`（タスク3で判明）**：`SpriteSerializer`の責務に線を含まない外枠の照会（`computeShapesGeometryBounds`・`#computeBounds`の`includeStroke`引数）、`ShapeExtentReader`に`getSelectedGeometryBounds`を足す（既に上の2章・`_doc/arch/`の項に概ね記載あり）。
*   **`_doc/arch/03_VectorModel.md`（タスク4で判明）**：公開メソッド`replaceShapesKeepingIds(replacements)`（複数図形を同じidのまま位置へ差し替え・通知1回・別の位置のインスタンスは警告して飛ばす・選択集合とホバーと並びと`#nextId`に触れない・呼び出し元は`InputTracker`の拡大縮小のみ）を、公開メソッドの一覧・`replaceShape`との違いの説明に足す。`PROJECT_ARCHITECTURE.md`のVectorModelの公開メソッドの記述があれば同様。
*   **`_doc/arch/42_ScaleHandleRules.md`（タスク5で判明）**：新規ファイル`core/ScaleHandleRules.js`の公開名（上記）・非公開の補助・import（`InputModes`・`UnitSnapRules`）・`computeBoundsScale`の手順・辺のShiftで直前の倍率が0のとき`|previous|`を使うこと・テストの範囲（94件）を記載する。1章の構成図・`16_test.md`は上の記載どおり。
*   **`_doc/arch/32_InputModes.md`・`34_PressActionRules.md`・`35_CursorShapeRules.md`（タスク6で判明）**：`SCALING_SELECTION`の追加、`resolvePressAction`の第3引数・順0・`PressAction`の`scaleSelection`、`resolveCursorShape`の`scaleHandle`・(3b)・`CursorShapeRules → ScaleHandleRules`のimport・戻り値の型（上の記載どおり。`CursorShapeRules.js`先頭の「importはInputModes.jsのみ」の記述が資料にあれば直す）。
*   **`_doc/arch/06_InputTracker.md`・1章の`InputTracker`の行数（タスク8で判明）**：`InputTracker.js`は1729行→1867行（+138行）。`isScalingSelection()`・`#scaleDrag`・`InputAssist`の5項目目`getSelectionFrameBounds`・`SCALING_SELECTION`の配線・`cancelDraftOrClearSelection`(1)・修飾キーの項（先頭の責務定義に拡大縮小のドラッグでShift・Alt・Ctrlを規則の関数へ渡すことを追記済み）を反映する。
*   **（タスク10で判明）**：`_doc/arch/07_KeyboardShortcuts.md`・1章の`KeyboardShortcuts`の説明（`isCancelableDrag`・`CANCEL_BINDING`・`findCancelableDragBinding`のexport・手順3・5の例外）、`_doc/arch/02_main.md`（`shapeExtentReader`を`// 4.`で生成・`getSelectionFrameBounds`・`scaleFrame`・`isCancelableDrag`の注入）、`_doc/arch/14_edit.md`（生成箇所`// 4.`）、`_doc/arch/16_test.md`（`KeyboardShortcuts.test.js`に6件追加・全体2254件）。
*   （各タスクの実行時に判明した分はここへ追記する。）

## 3. タスクリスト
*   [x] タスク1: 要件A 点の変換と第19メソッド（直線・今の曲線・矩形）とテスト
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js` : 更新（`AffineTransform`・`applyAffineTransformToPoint`）
        *   `./js/shapes/Line.js`・`./js/shapes/Curve.js`・`./js/shapes/Rect.js` : 更新（`createTransformed`。クラスJSDocの19メソッド・先頭の責務定義）
        *   `./test/shapes/ShapeGeometry.test.js`・`./test/shapes/Line.test.js`・`./test/shapes/Curve.test.js`・`./test/shapes/Rect.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   要件Aのとおり実装する。新しい関数・メソッド・typedefにJSDoc（`@param`・`@returns`、自身を変えないこと・共有しないこと）を書く。
        *   要件Fの該当ケースを足す。`node --test`が全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク2: 要件A 第19メソッド（円・弧・パス）とテスト
    *   **対象ファイル** :
        *   `./js/shapes/Ellipse.js`・`./js/shapes/Path.js` : 更新（`createTransformed`。クラスJSDocの19メソッド・先頭の責務定義・`ELLIPSE_TYPES`のJSDocの列挙）
        *   `./test/shapes/Ellipse.test.js`・`./test/shapes/Path.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   要件Aのとおり実装する（弧の上下の裏返しの扱い、`b`・`c`の`Error`、`points[1]`〜`[4]`を`#updatePointsFromRadii`でそろえる、パスの引っ張る点と`corners`）。JSDocを書く。
        *   要件Fの該当ケースを足す。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク3: 要件B 線を含まない外枠の照会とテスト
    *   **対象ファイル** :
        *   `./js/io/SpriteSerializer.js` : 更新（`#computeBounds`の引数・`computeShapesGeometryBounds`）
        *   `./js/edit/ShapeExtentReader.js` : 更新（`getSelectedGeometryBounds`・責務定義・クラスJSDocへの線を含まない外枠の照会の追記。**クラスJSDocの生成箇所の記述（「main.jsの`// 7.10.`と…2か所で生成する」）には触れない**＝生成を移すタスク10で直す）
        *   `./test/io/SpriteSerializer.test.js`・`./test/edit/ShapeExtentReader.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   要件Bのとおり実装する。今の外枠の値・呼び出しを変えない。JSDocを書く。`ShapeExtentReader`のクラスJSDocの生成箇所の記述は、このタスクの時点では実コード（`main.js`の`// 7.10.`での生成）と合っているため変えない。
        *   要件Fの該当ケースを足す（`SpriteSerializer`の`createTransformed`した図形の書き出しのケースはタスク11）。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク4: 要件D モデルの入口`replaceShapesKeepingIds`とテスト
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新（`replaceShapesKeepingIds`）
        *   `./test/core/VectorModel.replaceShapesKeepingIds.test.js` : 新規
    *   **作業内容** :
        *   要件Dの`VectorModel`の項のとおり実装する（図形種別の分岐・図形固有のプロパティ名を持ち込まない）。JSDocを書く。
        *   要件Fのケースを書く。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク5: 要件C 外枠のハンドルの規則`ScaleHandleRules`とテスト
    *   **対象ファイル** :
        *   `./js/core/ScaleHandleRules.js` : 新規
        *   `./test/core/ScaleHandleRules.test.js` : 新規
    *   **作業内容** :
        *   要件Cのとおり実装する（先頭の責務定義3行以内、定数・typedef・関数すべてにJSDoc。`computeBoundsScale`のJSDocに手順1〜8を書く）。丸めは`roundPointToUnit`を呼ぶだけ。
        *   要件Fのケースを書く。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク6: 要件D 入力状態・押下の分岐・カーソルの規則とテスト
    *   **対象ファイル** :
        *   `./js/core/InputModes.js` : 更新（`SCALING_SELECTION`）
        *   `./js/core/PressActionRules.js` : 更新（第3引数・順0・typedef）
        *   `./js/core/CursorShapeRules.js` : 更新（`scaleHandle`・(3b)・import・戻り値の型）
        *   `./test/core/PressActionRules.test.js`・`./test/core/CursorShapeRules.test.js` : 更新（ケースの追加のみ）
    *   **作業内容** :
        *   要件Dの該当項のとおり実装する。既存の枝・引数を省いたときの結果を変えない。JSDoc（判定順の説明・先頭の責務定義のimportの記述）を実態に合わせる。
        *   要件Fの該当ケースを足す。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク7: 要件E `Esc`の後の`click`の抑止（`DragTracker.cancel`の引数）
    *   **対象ファイル** :
        *   `./js/core/DragTracker.js` : 更新（`cancel({ suppressClick })`・JSDoc）
    *   **作業内容** :
        *   要件Dの`DragTracker`の項のとおり実装する。省いたときのふるまい（blur・`setMode`・`abortOngoingOperation`の経路）を変えない。`DragTracker`は`window`の購読に依存するためテストを置かない（要件F）。全件通ることを確かめる。
        *   （`KeyboardShortcuts`の変更は、`isCancelableDrag`を必須にするとブラウザで起動時に`Error`になる間ができるため、`main.js`の注入と同じタスク10で行う。）
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク8: 要件D・E `InputTracker`の配線
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   要件Dの`InputTracker`の項・要件Eのとおり、呼び出し・控え・後始末だけを足す（計算・判定表・修飾キーの解釈・スナップの当て方を持ち込まない）。先頭の責務定義・クラスJSDoc・`InputAssist`・各メソッドのJSDocを実態に合わせる。増えた行数を詳細作業内容に書く。
        *   「`Esc`で中断できるドラッグか」の判定は公開`isScalingSelection()`の1か所にし、`cancelDraftOrClearSelection`の(1)は`this.isScalingSelection()`を呼ぶ（`state === InputState.SCALING_SELECTION`をそこで直接比べない）。
        *   中断・後始末を説明しているJSDoc（`setMode`・`cancelDraftOrClearSelection`・`abortOngoingOperation`・`#abortOngoingOperation`・`#onLeftDragCancel`・`#finishLeftDrag`。要件Dの`InputTracker`の項の「中断・後始末を説明しているJSDocの直し」）の「ドラッグ中に反映済みの頂点・位置は取り消さず残る」等を、拡大縮小のドラッグだけは中断で引き始めの形に戻り記録されない実態に合わせて直す（処理は変えない）。
        *   全件通ることを確かめる（`InputTracker`のテストは置かない）。この時点では`main.js`が`getSelectionFrameBounds`を注入していないため既定値（常に`null`）で外枠のハンドルは出ず、`KeyboardShortcuts`もまだ変えていないため、ブラウザで起動時に`Error`にはならない。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク9: 要件D 外枠とハンドルの描画（`CanvasManager.render`の`scaleFrame`）
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新（`render`の省ける引数`scaleFrame`・`#drawScaleFrame`・定数・`render`とクラスのJSDocの描画順）
    *   **作業内容** :
        *   要件Dの`CanvasManager`の項のとおり実装する。`scaleFrame`は省ける引数（省略時・`null`は描かない＝今と同じ）で、ほかのタスクと順序の縛りは無い（`main.js`が渡すのはタスク10）。状態・図形種別・選択・操作モードを判定しない。新しい定数・メソッド・引数にJSDocを書き、`render`の描画順の説明に外枠のハンドル（頂点のハンドルの後・作成中の図形の前）を足す。
        *   要件Fに`CanvasManager`のケースは無く（今の`test/`に`CanvasManager`のテストファイルは無い）、テストは足さない。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク10: 要件D・E `Esc`の受理（`KeyboardShortcuts`の例外）と`main.js`の配線とテスト
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` : 更新（`isCancelableDrag`・`CANCEL_BINDING`・`findCancelableDragBinding`・手順3・5の例外・JSDoc）
        *   `./js/main.js` : 更新（import・`shapeExtentReader`の生成位置・`getSelectionFrameBounds`・`renderCurrentState`の`scaleFrame`・`isCancelableDrag`）
        *   `./js/edit/ShapeExtentReader.js` : 更新（**クラスJSDocの生成箇所の記述の1行だけ**。「main.jsの`// 7.10.`」を「main.jsの`// 4.`」に。ほかは変えない）
        *   `./test/core/KeyboardShortcuts.test.js` : 更新（ケースの追加と先頭の責務定義）
    *   **作業内容** :
        *   要件Dの`KeyboardShortcuts`・`main.js`の項のとおり実装する。`KeyboardShortcuts`：対応表`SHORTCUT_BINDINGS`・`#findBinding`の照合は変えない。例外の判定は`findCancelableDragBinding`の1か所にまとめ、キーは`CANCEL_BINDING.codes`から取る（`'Escape'`をソースに書き写さない）。IME変換中・テキスト入力欄（手順1・2）は例外より先に効かせる。`main.js`：判定・計算を足さない。新しい再描画・同期の経路を足さない。コメント・JSDocを実態に合わせる。
        *   `main.js`で`shapeExtentReader`の生成を`// 4.`へ移すのに合わせて、`js/edit/ShapeExtentReader.js`のクラスJSDocの生成箇所の記述を`// 4.`に直す（生成を移すこのタスクで直し、実コードと食い違う間を作らない。このファイルのほかの行は変えない）。
        *   `KeyboardShortcuts`が`isCancelableDrag`を必須にする変更と`main.js`の注入を同じタスクで行う（ブラウザで起動時に`Error`になる間を作らない）。
        *   要件Fの`KeyboardShortcuts`のケースを足す。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク11: 要件F 保存・書き出しのテスト
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js`・`./test/io/SpriteSerializer.test.js` : 更新（ケースの追加のみ。ソースは変えない）
    *   **作業内容** :
        *   `createTransformed`した5クラスの作業データの往復と、書き出しの描画要素・外枠のケースを足す。全件通ることを確かめる。
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   開発資料（`PROJECT_ARCHITECTURE.md`）の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク12: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。漏れがあれば上のタスクの対象ファイルの中で直す）
    *   **作業内容** :
        *   コード修正完了後、JSDocコメントの記載漏れがないこと（新しい・変えた関数・メソッド・typedef・定数、先頭の責務定義）を確認する。
        *   `git diff --stat`で対象ファイル以外が変わっていないこと、`SHORTCUT_BINDINGS`・既存の公開名・到達不能の枝が変わっていないこと、既存のテストの期待値が変わっていないことを確かめる。`node --test`の件数を記録する。
        *   開発資料の記載に影響が出る場合は、資料本体は修正せず、その旨を『開発資料の更新予定』欄に追記する。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [x] タスク13: 要件G テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   本RES（詳細作業内容）
    *   **作業内容** :
        *   実装後のコードで要件Gの文言（カーソルの形・キーの受理・`Esc`の後の`click`・準備の手順）を確かめ直し、食い違いがあれば直して詳細作業内容に確認項目として書く。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。
*   [ ] タスク14: 開発資料（`PROJECT_ARCHITECTURE.md`と、`_doc/arch/`の該当ファイル）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/`の該当ファイル（『開発資料の更新予定』の一覧。`42_ScaleHandleRules.md`は新規） : 更新・新規
    *   **作業内容** :
        *   各タスクで記録した『開発資料の更新予定』を確認し、開発資料へ反映する（本ワークフローで資料の書き換えが許される唯一のタスク）。少なくとも、`PROJECT_ARCHITECTURE.md`の1章（構成図・「存在しないもの」・依存方向の例外＝`core/ScaleHandleRules`の`shapes/`への`import()`型参照）・2章（選択状態の項・`Ellipse`の拡大縮小での表し方・共通メソッドの件数）・3章（拡大縮小の新しい節・17.の丸める箇所・18.の「`drawHandles`が呼ばれなくなること」・`Esc`とキーボードの受理判定）・4章の一覧、`_doc/arch/06_InputTracker.md`・`12_shapes.md`・`16_test.md`ほかを直す。
        *   書き換える前に各ファイルの行末（CRLF／LF）を実測し、行末を保つ（`PROJECT_ARCHITECTURE.md`・`_doc/arch/06_InputTracker.md`・`12_shapes.md`は作業前の実測でCRLF。ほかのファイルも反映前に測る）。
        *   `_doc/arch/06_InputTracker.md`等に記録している`InputTracker.js`の行数を本作業の後の値に直す。
        *   タスク完了後、作業レポート（本RES）の「4. 詳細作業内容」の本タスクの欄を記載し完成させ、本タスクを`[x]`にする。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件A 点の変換と第19メソッド（直線・今の曲線・矩形）とテスト
*   **作業内容** :
    *   `js/shapes/ShapeGeometry.js`：typedef`AffineTransform`・`applyAffineTransformToPoint`を末尾に追加。
    *   `Line.js`・`Curve.js`・`Rect.js`：`createTransformed(transform)`を追加（`Curve`・`Rect`は`fromJSON`と同形で`points`を写した値に置換、`id`を引き継ぐ）。クラスJSDocを19メソッドへ、先頭の責務定義に「変形を当てた新しい図形の生成」を追記、`applyAffineTransformToPoint`をimport。
    *   テスト：`ShapeGeometry.test.js`（3件）、`Line`・`Curve`・`Rect`の各`test`に`createTransformed`の6件（倍率・変形後の`toDrawElement()`・裏返し・不変/非共有・独立性・回転）を追加。先頭の責務定義も追記。`node --test`：tests 2088 / suites 341 全件合格。
    *   diff監査の指摘で修正：`ShapeGeometry.js`の先頭の責務定義に「点へのアフィン変換（変形の式の唯一の箇所）」を追記（3行のまま）。独立性のテストは期待値を固定の座標で比べる形に直した（`second`は変換のみ、`first`は変換後に`translate(100, 100)`した値）。変形後の`toDrawElement()`（座標・線の太さ・色・`fillColor`）を確かめるケースを3クラスに1件ずつ追加（2085→2088）。

### タスク2: 要件A 第19メソッド（円・弧・パス）とテスト
*   **作業内容** :
    *   `Ellipse.js`：`createTransformed(transform)`を追加（`b`・`c`が0でなければ指定の文言の`Error`。中心を写し、`rx' = |a|·rx`・`ry' = |d|·ry`、弧で`d < 0`のときだけ新しい中心の`y`に`ry'`を足す。`new Ellipse`の後に`#updatePointsFromRadii`で`points[1]`〜`[4]`をそろえ、`id`を引き継ぐ）。`applyAffineTransformToPoint`をimport。クラスJSDocを19メソッドへ、先頭の責務定義に「変形を当てた新しい図形の生成」を追記、`ELLIPSE_TYPES`のJSDocの列挙に`createTransformed`を追加。
    *   `Path.js`：`createTransformed(transform)`を追加（`points`と`'bezier'`の`control1`・`control2`を写し、`new Path(写した頂点, closed, 色・太さ・塗り, 区間の配列, corners)`で作って`id`を引き継ぐ）。import・クラスJSDoc・先頭の責務定義を同様に更新。
    *   テスト：`Ellipse.test.js`に`createTransformed`の14件（円の縦横倍率の`toJSON`・変形後の`toDrawElement`・円の裏返し・弧の上下の裏返し（`toJSON`と`toDrawElement`を固定値で）・弧の左右の裏返し・弧の裏返しなしの倍率・`b`/`c`の`Error`の文言一致・不変/非共有・独立性。監査の指摘で追加した5件：真円（rx=ry）に縦横別の倍率と原点以外の動かない点・弧を外枠の下端（y=100）基準で上下裏返し（中心(100,140)・`radiusY` 40・外枠のy[100,140]）・弧の縦横別倍率と上下の裏返しの同時（原点以外の動かない点）・弧の上下と左右の同時の裏返し（`a<0`かつ`d<0`、平行移動つき）・弧の縦横別倍率と原点以外の動かない点（`d>0`）。いずれも`toJSON()`と`toDrawElement()`を固定値で確認）、`Path.test.js`に9件（直線の区間の`toJSON`/`toDrawElement`・曲がり方を持つ区間の引っ張る点と`bezierPath`・`smooth`と`corners`の保持・`corners`キーが出ない・回転・不変/非共有・独立性。監査の指摘で追加した2件：直線・曲がり方を持つ・曲線の区間と角の点を含むパスの上下の裏返し（`d<0`）と上下左右の両方の裏返し（`a<0`かつ`d<0`）。固定値の`toJSON()`・`toDrawElement().points`・曲線の区間の制御点が頂点の写しに追従することを確認）を追加。両ファイル先頭の責務定義も追記。独立性のテストは固定の座標で比べる形（タスク1の監査の指摘どおり）。`node --test`：tests 2111 / suites 343 全件合格（作業前2088→+23）。

### タスク3: 要件B 線を含まない外枠の照会とテスト
*   **作業内容** :
    *   `js/io/SpriteSerializer.js`：`#computeBounds(elements, includeStroke = true)`（偽なら`half = 0`）、`static computeShapesGeometryBounds(shapes)`（`#computeBounds(…, false)`）を追加。既存の呼び出し（`serialize`・`computeShapesBounds`）は引数を渡さず値は不変。先頭の責務定義に「外枠（線を含む・線を含まない）の照会」を反映。ファイルはCRLFのまま。
    *   `js/edit/ShapeExtentReader.js`：`getSelectedGeometryBounds()`を追加。先頭の責務定義・クラスJSDocに線を含まない外枠の照会を追記。クラスJSDocの生成箇所の記述（`main.js`の`// 7.10.`）は変えていない（タスク10）。
    *   テスト：`SpriteSerializer.test.js`に`computeShapesGeometryBounds`の9件（線・矩形が線を含む外枠より太さの半分内側＝Line(10,20,30,5,太さ4)で{10,5,30,20}対{8,3,32,22}・曲線の極値{0,0,100,50}・3次ベジェの極値{0,0,30,30}と線ありの{-5,-5,35,35}・円{-20,-20,40,60}・弧{-20,-20,40,20}・線なしの要素を含む和・複数の和・図形0個でnull・未知kindでError・引数不変と新しいオブジェクト・線を含む外枠`computeShapesBounds`・`serialize`の値不変）、`ShapeExtentReader.test.js`に`getSelectedGeometryBounds`の5件（選択なしnull・選択中だけ・`getSelectedBounds`との差と値不変・線なし塗りなしの図形を含む・選択追従と副作用なし）を追加。期待値は手計算の固定値。`node --test`：tests 2125 / suites 345 全件合格（作業前2111→+14）。

### タスク4: 要件D モデルの入口`replaceShapesKeepingIds`とテスト
*   **作業内容** :
    *   `js/core/VectorModel.js`：公開メソッド`replaceShapesKeepingIds(replacements)`を`replaceShape`の後に追加（配列でなければ`console.warn`して`0`。作業用の配列のコピー上で、組の順に`id`の位置へ`shape`を入れ`shape.id = id`、`id`なしの組は飛ばし、別の位置に既にあるインスタンスは`console.warn`して飛ばす・同じ位置の同じインスタンスは差し替えた扱い。1件以上で`#pruneSelectedVertices()`の後に通知1回、0件は通知なし。戻り値は件数）。図形種別・固有プロパティは持ち込まず、`id`の代入以外で図形に触れない。JSDocを手順・触れないもの・呼び出し側の責務まで記載。クラスJSDocに差し替えの入口の1行を追記（先頭の責務定義は3行のまま変更なし）。ファイルはLFのまま。
    *   テスト：`test/core/VectorModel.replaceShapesKeepingIds.test.js`（新規・13件）。複数の差し替えが通知1回・位置とidの保持・選択集合／頂点の選択／ホバーの不変・存在しないidの飛ばし（混在・のみ）・別の位置のインスタンスの警告（のみ・混在）・同じ位置の同じインスタンス・配列でない引数（`null`・オブジェクト）・空配列で通知なし・引き始めのインスタンスへ戻せる・`#nextId`不変（次の採番が`shape-3`）・引数不変。期待値は固定値。`node --test`：tests 2138 / suites 345 全件合格（作業前2125→+13）。
    *   監査指摘の修正：クラスJSDoc（`VectorModel.js:79`）の`replaceShape`の説明を「既定では新しいidを採番する」に直した（`options.keepId`との整合）。`node --test`全件合格（2138）。

### タスク5: 要件C 外枠のハンドルの規則`ScaleHandleRules`とテスト
*   **作業内容** :
    *   `js/core/ScaleHandleRules.js`（新規）：先頭の責務定義（3行以内）、`SCALE_HANDLE_NAMES`・`SCALE_HANDLE_HIT_SCREEN_PX`・`SCALE_EDGE_HANDLE_MIN_SCREEN_PX`、typedef `ScaleHandle`・`ScaleFrame`・`BoundsScale`・`BoundsScaleInput`、関数`collectScaleFrame`・`hitTestScaleHandle`・`resolveScaleHandleCursor`・`computeBoundsScale`（JSDocに手順1〜8）・`toScaleTransform`。importは`InputModes`の`OperationMode`と`UnitSnapRules`の`roundPointToUnit`のみ（`AffineTransform`はJSDocの`import()`型参照だけ）。丸めは`roundPointToUnit`を呼ぶだけ。モジュール内の非公開：`isPositiveFinite`・`isFiniteBounds`・`readAxis`・`snapAxisScale`・typedef`AxisState`（いずれもJSDocあり、exportしない）。
    *   `test/core/ScaleHandleRules.test.js`（新規・94件）：8つのハンドルの位置と並び・小さい外枠（24pxちょうど／僅かに下・表示倍率による違い）・幅か高さが0・両方0・選択モード以外・boundsがnull/非有限・viewScale不正、当たり（境界6/6.5・倍率2で3/3.5・角優先・重なる小さい外枠でsw優先・null）、カーソルの向き、倍率と動かない点（角4・辺4・Shift（角・辺）・Alt・Shift+Alt・裏返り（横・縦・両方・Shiftの角）・ちょうど0でpreviousのまま（Shiftの角を含む・符号はpreviousの符号）・幅か高さが0の向き）、スナップ（刻み10の角・辺・Shift・Alt・Shift+Alt、刻みnull/0/負で丸めない、外枠の辺が半端な位置（minX=10.5）、丸めた結果が0でpreviousのまま）、`toScaleTransform`（4隅の写り先）、引数不変・未知のハンドル名のError。期待値は固定の値で手計算（各`it`の題に計算を記載）。`node --test`：tests 2232 / suites 363 全件合格（作業前2138→+94）。
    *   diff監査の指摘で修正：`Shift`の角で、倍率を決めた向きの符号を丸める前の`raw`ではなく丸めた後の`s`の符号から取るよう直した（もう一方の向きは今のとおりその向きの`raw`の符号、ちょうど0なら`previous`の符号）。外枠の辺が半端な位置でカーソルが動かない点から半刻み以内のとき、引く辺が刻みの目に乗らなかった欠陥の修正。JSDoc手順7と上の要件C（RES:72）の文言も実態に合わせた。テスト1件追加（外枠`{10.5,0,110.5,50}`・`se`・(12,50)・刻み10で`Shift`あり`{-0.005, 0.005, 10.5, 0}`、`Shift`なし`{-0.005, 1, 10.5, 0}`）。既存の93件は変更なしで合格。

### タスク6: 要件D 入力状態・押下の分岐・カーソルの規則とテスト
*   **作業内容** :
    *   `js/core/InputModes.js`：`InputState`に`SCALING_SELECTION: 'SCALING_SELECTION'`を末尾に1エントリ追加し、JSDocの列挙に説明を足した（既存の値は不変）。
    *   `js/core/PressActionRules.js`：`resolvePressAction(hit, isSelected, scaleHandle = null)`。順0＝`scaleHandle`が空でない文字列なら`{ type: 'scaleSelection', handle: scaleHandle }`（`isSelected`は呼ばない）。順1〜5は不変。typedef`PressAction`・戻り値の説明・判定順の説明・先頭の責務定義（外枠のハンドルは第3引数で受ける旨）を更新。`resolveVertexPressAction`は不変。
    *   `js/core/CursorShapeRules.js`：`CursorShapeInput`に省ける`scaleHandle`、(3b)を(3a)の後・(4)の前に追加（`state`が`IDLE`か`SCALING_SELECTION`で`scaleHandle`が文字列、`resolveScaleHandleCursor`が`null`でなければその値）。`import { resolveScaleHandleCursor } from './ScaleHandleRules.js'`、戻り値の型に4つのresizeを追加、先頭の責務定義のimportの記述・判定順の説明・`isLeftDragState`の説明に`SCALING_SELECTION`を反映。既存の枝（(7)ハンドルの枝等）は消していない。
    *   テスト（ケースの追加のみ。既存の期待値は不変）：`PressActionRules.test.js`に7件（空白・選択集合内の本体・集合外の本体・moveと頂点ハンドルより優先・`isSelected`を呼ばない・null／省略で従来どおり（呼び出し回数を含む）・空文字）、`CursorShapeRules.test.js`に9件（8方向・`SCALING_SELECTION`・ハンドルの下の本体・パン／スペース／待ち受けの優先・スペース中の拡大縮小ドラッグ・MOVING等では使わない・VERTEX／CREATE／PANでは使わない・省略／undefined／null・未知の名前）。`node --test`：tests 2248 / suites 365 全件合格（作業前2232→+16）。CRLFを保った。

### タスク7: 要件E `Esc`の後の`click`の抑止（`DragTracker.cancel`の引数）
*   **作業内容** :
    *   `js/core/DragTracker.js`：`cancel({ suppressClick = false } = {})`に変更。`suppressClick`が真で中断したセッションが左ボタンなら`#suppressNextClick = true`、それ以外（省いたとき＝blur・`setMode`・`abortOngoingOperation`の経路）は従来どおり`false`（`suppressClick && button === 0`の1式）。セッションなしは何もしない（従来どおり）。`cancel`のJSDocに引数・挙動を追記。先頭の責務定義（「blur時の中断、終了直後のclick抑止」）は実態と合うため変更なし。`#handleWindowBlur`は引数なしの`cancel()`のまま。CRLFを保った。テストは置かない（`window`購読に依存）。`node --test`全件合格を確認。

### タスク8: 要件D・E `InputTracker`の配線
*   **作業内容** :
    *   `js/core/InputTracker.js`のみ変更（LFのまま。1729行→1867行、**+138行**。見積もり+150〜190行の下限未満）。
    *   import：`collectScaleFrame`・`hitTestScaleHandle`・`computeBoundsScale`・`toScaleTransform`。`InputAssist`に`getSelectionFrameBounds`（既定`NO_INPUT_ASSIST`は`null`、コンストラクタの関数でなければ既定へ置き換える処理に同じ形で追加）。
    *   フィールド`#scaleDrag`（`{ handle, bounds, originals, lastScale }|null`。`#finishLeftDrag`で`null`）。公開`isScalingSelection()`（「`Esc`で中断できるドラッグか」の判定の唯一の箇所。`state === InputState.SCALING_SELECTION`の比較はほかに振り分け用が4か所ある。`cancelDraftOrClearSelection`の(1)はこれを呼び、真なら`this.#drag.cancel({ suppressClick: true })`して`true`、それ以外のドラッグは`false`のまま）。
    *   非公開`#findScaleHandle(point)`（`collectScaleFrame`→`hitTestScaleHandle`の受け渡しだけ）・`#beginScaleSelection`（`#scaleDrag`を先に入れて`#beginLeftDrag`。開始できなければ`null`。`#duplicateOnMove`は立てない）・`#applyScaleUpdate`（`computeBoundsScale`・`toScaleTransform`・`replaceShapesKeepingIds`。`lastScale`を更新）。
    *   `handleMouseMove`（外枠のハンドル名を`#updateCursor`の第2引数へ）・`handleMouseDown`（`resolvePressAction`の第3引数・`scaleSelection`で`#beginScaleSelection`）・`handleClick`（選択モードで待ち受けの判定の後・`hit.handle`の前に`#findScaleHandle`が非`null`なら`return`）・`#isLeftDragState`・`#onLeftDragStart`（`beginEdit`の対象に追加）・`#applyLeftDragUpdate`（`SCALING_SELECTION`を`#applyScaleUpdate`へ）・`#onLeftDragCancel`（`SCALING_SELECTION`かつ`#isEditOpen`なら`originals`を`replaceShapesKeepingIds`で戻してから`#finishLeftDrag`）・`#updateCursor(hit, scaleHandle)`（`#scaleDrag`があれば`#scaleDrag.handle`を必ず渡す）。
    *   JSDoc：先頭の責務定義（外枠のハンドルでの拡大縮小・修飾キーの用途に拡大縮小のドラッグでShift・Alt・Ctrlを規則の関数へ渡すことを追記）・クラスJSDoc・`InputAssist`・`NO_INPUT_ASSIST`・コンストラクタの`@param`・`state`の説明・`#beginLeftDrag`の`nextState`・`handleWheel`・`handleMouseMove`・`handleMouseDown`・`handleClick`・`setMode`・`cancelDraftOrClearSelection`・`abortOngoingOperation`・`#abortOngoingOperation`・`#onLeftDragCancel`・`#finishLeftDrag`（拡大縮小だけ中断で引き始めの形に戻り記録されないことを反映。処理は変えていない）。
    *   `node --test`：tests 2248 / suites 365 全件合格（作業前と同数。`InputTracker`のテストは置かない方針）。
    *   diff監査の指摘で修正（JSDoc・コメントのみ、処理は不変）：`#isEditOpen`・`#applyLeftDragUpdate`の`@param`・`#beginLeftDrag`（種類と中断の経路にEsc）・クラスJSDoc・フィールドの左ドラッグ／編集操作の列挙に拡大縮小を追記。上記`isScalingSelection()`の記述を直した。修正後も`InputTracker.js`は1867行、`node --test`全件合格。
    *   再監査の指摘で修正（JSDoc・コメントのみ、処理は不変）：`DRAG_START_THRESHOLD`・`isDragging()`・左ドラッグの区切りコメント・`activeHandle`/`activeShapeId`の未使用の状態・`#beginLeftDrag`の`target`の`@param`・`handleMouseDown`のAltを記憶しない左ドラッグ・`#finishLeftDrag`の`#isEditOpen`の説明の列挙に拡大縮小を追記し、`#finishLeftDrag`の重複した1文をまとめた。修正後も`InputTracker.js`は1867行、`node --test`全件合格（tests 2248 / suites 365）。
    *   3回目の修正（JSDocのみ、処理は不変）：`handleMouseDown`の分岐の表の列挙に外枠のハンドルを先頭に足し、`handleClick`のclickを抑止する場合に`Esc`で中断した拡大縮小のドラッグの後（閾値以内でも）を足して閾値以内の言い切りを「それ以外で」に直した。修正後は`InputTracker.js`1868行、`node --test`全件合格（tests 2248 / suites 365）。

### タスク9: 要件D 外枠とハンドルの描画（`CanvasManager.render`の`scaleFrame`）
*   **作業内容** :
    *   `js/core/CanvasManager.js`のみ変更（LFのまま。483行→約530行）。
    *   `render`に省ける`scaleFrame = null`を足し、(5-3)として頂点のハンドルの後・作成中の図形の前に、非`null`のときだけ非公開`#drawScaleFrame(frame, scale)`を呼ぶ。省略・`null`では何も描かず今と同じ描画。到達不能の`showHandles`の枝は消していない。
    *   `#drawScaleFrame`：倍率が正の有限値でなければ描かない。`bounds`の矩形を線幅`SCALE_FRAME_LINE_WIDTH / scale`・色`SCALE_FRAME_STROKE_COLOR`で`strokeRect`し、`handles`の並びの順に選ばれていない頂点のハンドルと同じ見た目（`VERTEX_HANDLE_*`を流用、`÷ scale`）で描く。`save`/`restore`。状態・図形種別・選択・操作モードは判定しない。
    *   新しい定数`SCALE_FRAME_LINE_WIDTH = 1`・`SCALE_FRAME_STROKE_COLOR = '#4a90e2'`。JSDoc：先頭の責務定義（外枠とそのハンドルを列挙に追加）・`render`の描画順（2-3）と`@param state.scaleFrame`・`#drawScaleFrame`・定数。
    *   `node --test`：tests 2248 / suites 365 全件合格（テストは足していない）。

### タスク10: 要件D・E `Esc`の受理（`KeyboardShortcuts`の例外）と`main.js`の配線とテスト
*   **作業内容** :
    *   `js/core/KeyboardShortcuts.js`（LFのまま）：`ShortcutActions`に`isCancelableDrag`を足しコンストラクタの必須名に追加。`SHORTCUT_BINDINGS`の直後に非export定数`CANCEL_BINDING`（`action === 'cancel'`のエントリ）と、export関数`findCancelableDragBinding(event, isCancelableDrag)`（`event.code`が`CANCEL_BINDING.codes`に含まれるときだけ照会を1回呼び、真なら`CANCEL_BINDING`、それ以外は`null`。修飾キー・`repeat`は読まない）。`#handleKeyDown`の手順3は`dragCancelBinding ?? #findBinding(event)`、手順5は`dragCancelBinding === null && isDragging()`のときだけ実行しない。対応表・`#findBinding`の処理・`#matchesShiftRule`は不変。JSDoc：先頭の責務定義（3行）・`ShortcutActions`（`isCancelableDrag`・`cancel`）・`CANCEL_BINDING`・`findCancelableDragBinding`・クラスJSDoc・コンストラクタ`@param`・`#handleKeyDown`の手順3・5・`#findBinding`。
    *   `js/main.js`：`collectScaleFrame`のimport。`shapeExtentReader`の生成を`// 4.`の`InputTracker`の生成の前へ移し（コメントで2か所の生成の1つ・移した理由を記載）、`// 7.10.`の生成行は「生成済みの同じインスタンスを使う」コメントに置き換えた（インスタンスは2のまま）。`InputTracker`の第7引数に`getSelectionFrameBounds`、`renderCurrentState`に`scaleFrame: collectScaleFrame(inputTracker.getMode(), shapeExtentReader.getSelectedGeometryBounds(), viewTransform.getScale())`（JSDoc・`showHandles: false`のコメントを実態に直した）、`// 8.`の`KeyboardShortcuts`の注入に`isCancelableDrag: () => inputTracker.isScalingSelection()`。判定・計算・新しい再描画の経路は足していない。`// 7.11.`のコメント「7.10.で生成した同じshapeExtentReader」を「4.で生成した…」に直した。
    *   `js/edit/ShapeExtentReader.js`：クラスJSDocの生成箇所の1行の`// 7.10.`を`// 4.`に直しただけ。
    *   `test/core/KeyboardShortcuts.test.js`：先頭の責務定義を拡張。`isCancelableDrag`だけを欠く配線検証・`findCancelableDragBinding`のケース（16通りの修飾キーで照会が真ならcancelのエントリ（凍結・`repeatable: false`・codes`['Escape']`）／偽ならnull・`Escape`以外は照会を呼ばずnull・照会は1回・eventを書き換えない）。期待値は固定値。
    *   `node --test`：tests 2254 / suites 366 全件合格（+6件・+1スイート）。

### タスク11: 要件F 保存・書き出しのテスト
*   **作業内容** :
    *   `test/io/SpriteSerializer.test.js`（LFのまま）：末尾に`describe('SpriteSerializer: createTransformed した図形の書き出し')`の9件を追加（ヘルパ`SCALE_TRANSFORM`・`makeScaledShapes`）。変換は`{a:-2, b:0, c:0, d:-0.5, e:100, f:50}`（点(x,y)→(-2x+100, -0.5y+50)。左右・上下の裏返しを含む）を、直線・今の曲線・矩形・円・弧・パス（閉じた塗りあり・曲がり方を持つ区間を含む）の6種へ当てる。固定値：直線の描画要素（(10,20)→(80,40)・(30,40)→(40,30)）、今の曲線（(0,0)→(100,50)・(30,-80)→(40,90)・(100,40)→(-100,30)）、矩形（(80,45)・(-80,45)・(-80,20)・(80,20)）、円（中心(0,25)・横60・縦15）、弧（上下の裏返しで中心y=25+15=40・横60・縦15・上半分のまま）、パス（`bezierPath`・`cubic`の制御点(-140,35)・(-140,15)）。外枠は図形ごとに線を含む／含まない・`serialize().bounds`を固定値で確認（曲線のyの極値66＝`0.36·50+0.48·90+0.16·30`、パスのxの極値-130＝`-100-30`は式をコメントに記載）。6種を並べた描画順・種類・外枠の和（線あり{-132,-2,102,67}・線なし{-130,0,100,66}）、`source`の中身と版2。先頭の責務定義に1行追記（3行以内）。
    *   `test/io/DocumentSerializer.roundtrip.test.js`（CRLFのまま）：末尾に`describe('拡大縮小（createTransformed）した図形の往復（Phase 10-01）')`の変換後の作業データ（固定値`EXPECTED_JSON`）1件・往復（オブジェクト層・文字列層。1図形ずつと6種まとめ）2件・円は楕円・弧は上半分のまま（角度・描画要素）1件・パスの曲がり方を持つ区間と描画要素の`cubic`1件・版2とキー構成1件・復元後に動かしても元が不変1件の計7件（it）を追加。先頭の責務定義を3行以内で拡張。
    *   ソース（`js/`）は変えていない。既存のケースの期待値は変えていない。期待値はすべて手計算の固定値で、実行で食い違いは出なかった。`node --test`：tests 2270 / suites 368 全件合格（作業前2254→+16）。

### タスク12: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   `git diff 911428a HEAD --stat`（`.claude/skills/oz-impl-session/SKILL.md`は本作業の外のため除く）で、変更はRES・各タスクの対象ファイル（`js/`・`test/`）のみで、対象外のファイルが変わっていないことを確認。`SHORTCUT_BINDINGS`の対応表の中身・既存の公開名・到達不能の枝（`dragHandle`・`CursorShapeRules`の(7)・各図形の`drawHandles`・`showHandles`）は変えていない。既存のテストの期待値は変えていない。
    *   JSDoc：新しい・変えた関数・メソッド・typedef・定数と先頭の責務定義に記載漏れは見つからなかった。
    *   監査から回された軽微な4点を直した（処理は不変）：(1)本RESのタスク5の「（新規・93件）」を「94件」へ。(2)`PressActionRules.js`のJSDocで「呼ぶときの引数はhit.bodyId。」を`isSelected`の説明の行へ戻し、「注：」の文の末尾からは外した。(3)`DragTracker.js`の`#suppressNextClick`のJSDocに`cancel({ suppressClick: true })`（中断時に左ボタンなら立てる）を追記。(4)`main.js`の`cancel`注入のコメントに、拡大縮小のドラッグの中断（`cancelDraftOrClearSelection`の(1)）を追記。
    *   `node --test`：tests 2270 / suites 368 / pass 2270 / fail 0（全件合格）。
    *   開発資料の更新予定：本タスクで新たに増えたものは無い（タスク14で各タスクの記録を反映する）。

### タスク13: 要件G テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   実コード（選択・移動・キーの受理）で要件Gの各項目を確かめ、次のとおり確定した。要件Gからの変更は、6.（位置の欄の値が線の太さを含むため、半端な位置の作り方を直した）、9.（動かし始めの距離、`Esc`後に離しても選択が変わらないこと・ハンドルの上の`Ctrl`+クリックで選択が変わらないことを明記）、0.（数字キーの記述からコードの言葉を除いた）。要件Gの6.・9.も同じ文言へ直した。
    *   （監査指摘の修正）項目11のステータスバーの「大きさ」を、画面の実際の表示に合わせて「ステータスバーの`W:`・`H:`（選択中の図形の幅と高さ）」へ直した（要件G・タスク13の項目11と、2章の呼び出し元の列挙の3か所）。
    *   **発注者への確認項目**（`Ctrl`+`F5`で最新にして確認する）：
        *   0.  **準備**：ブラウザで`index.html`を開き、`Ctrl`+`F5`で最新の状態にする。次を描いておく：直線（`1`。始点と終点をクリックして点を2つ打ち、**終点をもう1回クリック**（または`Esc`）で終える。直線のツールは続けて引く線で、2回目のクリックは点を打って引き続けるだけ。点が2つで終えると直線になる）、弧（`3`）、矩形（`4`）、円（`5`）、曲線のパス（直線のツール`1`で3点打って最後の点をもう1回クリックで終え、続けて曲線のツール`2`でその端点（青い四角が出る位置）から引き始めて2〜3点打ち、最後の点をもう1回クリック＝直線の区間と曲線の区間を混ぜた1本）、弧を結合したパス（弧の右端の青い四角が出る位置から直線のツールで引き始め、点を打って終える）。図形のツールの数字キーは`1`直線・`2`曲線・`3`弧・`4`矩形・`5`円。描き終えたら`V`で選択に戻る。今の曲線は、次の内容のファイル`curve.ozve.json`を作り、キャンバスパレット（📁）の「インポート」で読み込む：`{"format":"oz-vector-editor","version":2,"shapes":[{"type":"curve","id":"c1","points":[{"x":0,"y":0},{"x":60,"y":-80},{"x":120,"y":0}],"strokeColor":"#000000","strokeWidth":2,"fillColor":null}]}`（原点の近くに出る）。太い線の図形も1つ用意する（オプションバーの太さを10などにして描く）。
        *   1.  **外枠とハンドルの表示**：選択（`V`）で図形をクリックすると、形を囲む青い外枠と8つの白い四角のハンドルが出る。太い線の図形では、外枠が線の太さの半分だけ内側（線の中心）にある。表示倍率を変えても外枠の線（1px）とハンドルの大きさは変わらない。範囲選択・`Ctrl`+クリックで複数選ぶと、全体を1つの外枠が囲む。頂点の選択（`A`）に切り替えると選択が外れて外枠も消え、`A`のまま`Ctrl`+クリックで図形を選んでも外枠は出ない。空白をクリックして選択を外すと消える。図形の本体を引いて動かしている間も外枠が図形について動く。アウトライン表示（`Z`）・黒の背景（`X`）でも見える。
        *   2.  **小さい図形・細い図形**：小さく縮めた図形（または表示倍率を下げたとき）は、辺の中央のハンドルが消えて角の4つだけになる（外枠の辺が画面上で24px未満の向き）。水平・垂直な直線（直線のツール`1`で始点をクリックした後、`Shift`を押しながらカーソルを横（縦）へ動かして終点をクリックし、終点をもう1回クリックで終える。線を引いている途中の`Shift`の間は、付いてくる線の向きが横・縦・斜め45°に限られる）は、両端の2つのハンドルだけが出て、引くと長さだけが変わる（`Shift`を押して引いても太さの向きには伸びない）。
        *   3.  **角・辺のハンドル**：角のハンドルを引くと縦横に、辺のハンドルを引くとその向きだけに伸び縮みし、反対側の角（辺）は動かない。ハンドルの上にカーソルを置くと、左上・右下は「↖↘」、右上・左下は「↗↙」、左右の辺は「↔」、上下の辺は「↕」の形になり、引いている間もその形。ハンドルの下に別の図形の線があっても、押せばハンドルが優先される。
        *   4.  **`Shift`・`Alt`**：`Shift`を押しながら角を引くと縦横の比率が保たれ、辺を引くともう一方の向きも同じ割合で伸び縮みする（外枠の中心の線を基準に）。`Alt`を押しながら引くと外枠の中心が動かない。引いている途中で`Shift`・`Alt`を押す・離すと、次にマウスを動かしたときに切り替わる（押した・離しただけでは変わらない）。`Alt`を押してハンドルを引いても図形は複製されない（図形の本体を`Alt`で引くと今までどおり複製されて動く）。
        *   5.  **裏返り**：ハンドルを反対側を越えて引くと、図形が裏返って反対向きに伸びる（大きさがちょうど0の形にはならない）。弧は上下には裏返らず、上半分の弧のまま、引いた側へ伸びる（今回の仮のふるまい。上下の裏返しは後の作業で入る）。左右の裏返しは見た目が同じ。
        *   6.  **スナップ**：ステータスバーの🧲がON（起動時はON・1px）で引くと、引いている辺・角が1pxの目にそろう。単位のボタン（`1`）を押して`10`にすると10pxの目にそろう。外枠の辺がもともと半端な位置にある図形（位置の欄の値は線の太さを含むため、太さが奇数の図形で位置の欄に整数を入れると、外枠の辺は0.5ずれた位置になる。例：太さ1の矩形でXに`10`を入れると外枠の左辺は10.5）でも、引くとすぐ目にそろう。`Ctrl`を押しながら引くと、そろわずに滑らかに動く。🧲をOFFにしても滑らかに動く。
        *   7.  **すべての図形**：直線・矩形・円・弧・曲線のパス・弧を結合したパス・今の曲線を、それぞれ拡大縮小できる。円は縦横別に伸ばすと楕円になる（これで円・弧の大きさを画面から変えられる）。曲線の形も同じように伸び縮みする（曲線の区間・弧から変わった区間とも）。線の太さと線・塗りの色は変わらない。
        *   8.  **複数選択**：いくつかの図形を選んでまとめて拡大縮小すると、図形どうしの位置と大きさの関係を保ったまま伸び縮みする。
        *   9.  **確定・取り消し・`Esc`**：ハンドルを押して数px動かすと拡大縮小が始まり、離すと確定する。取り消し（`Ctrl`+`Z`）1回で引く前の形に戻り（選択も引く前のまま）、やり直し（`Ctrl`+`Y`）で引いた後に戻る。引いている途中（ボタンを押したまま）で`Esc`を押すと元の形に戻り、そのままボタンを離しても選択は変わらず（離した位置が空白でも選択は外れない）、取り消しも増えない。**`Shift`・`Alt`・`Ctrl`を押したまま（比率を保つ・中心を固定する・丸めない状態で引いている途中）でも、`Esc`で同じく元の形に戻り、ボタンを離しても選択は変わらない**（Windowsでは`Ctrl`+`Esc`・`Alt`+`Esc`をOSが使うことがあり、スタートメニュー等が開いてウィンドウのフォーカスが外れた場合は、フォーカスが外れたときの中断として同じく元の形に戻る）。ハンドルを引いていない（ドラッグしていない）ときの`Shift`+`Esc`・`Ctrl`+`Esc`は今までどおり何もしない（`Esc`単体は今までどおり選択の解除）。図形の本体を引いて動かしている途中の`Esc`は今までどおり効かない。ハンドルを押して動かさずに離す（`Ctrl`を押しながらでも）と何も変わらない（選択も変わらない。ハンドルの上の`Ctrl`+クリックで選択が増減しない）。引いている途中にほかのキー（`V`・`Delete`・矢印など）を押しても今までどおり何も起きない。
        *   10. **その後の操作**：拡大縮小した図形を、出力（作業ファイル）して「開く」で開き直す・別のキャンバスへ切り替えて戻る・コピー＆ペースト（`Ctrl`+`C`→`Ctrl`+`V`）・複製（`Ctrl`+`D`）しても同じ形。線の上のクリック・塗った内側のクリック（円・矩形・閉じたパスを塗った場合）・範囲選択で選べる。頂点の選択（`A`）で頂点を動かせる（円・弧は今までどおり頂点が出ない）。直線・開いたパス・今の曲線・拡大縮小した弧は今までどおり結合できる（線の端どうしを重ねて2本選んで`J`。楕円の弧も形を保って結合される）。出力（エンジン用）したJSを確認用ページ（`sprite-check.html`）で開くと、エディタと同じ形で描かれる。
        *   11. **ほかが今までどおり**：図形の本体のドラッグでの移動・`Alt`での複製・`Shift`での方向の限定・クリックと`Ctrl`+クリックでの選択・範囲選択（外枠の内側の空白を押して引いても図形は動かず範囲選択になる）・頂点の選択（`A`）・矢印キー・位置の数値入力・整列・分布・重なり順・スタイル・スポイト（待ち受け中は外枠は出たままでもハンドルは働かず、クリックはスポイトの取り込みになる）・図形の作成・保存・読み込み・書き出しが今までどおり動く。位置の欄（X・Y）とステータスバーの`W:`・`H:`（選択中の図形の幅と高さ）は、今までどおり線の太さを含んだ値を表す（外枠のハンドルの位置とは線の太さの半分だけずれる）。

### タスク14: 開発資料（`PROJECT_ARCHITECTURE.md`と、`_doc/arch/`の該当ファイル）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント
* **`Esc`の経路（REQの前提と実コードの食い違い。発注者の決定で方針(a)）**：REQは「`Esc`（今の`cancelDraftOrClearSelection`のドラッグ中の扱い）で元の形に戻る」としていたが、実コードではドラッグ中の`Esc`は`KeyboardShortcuts`の受理判定の手順5（`isDragging()`が真なら実行しない）で止まって`cancelDraftOrClearSelection`まで届かず、届いても(1)で何もせず`false`を返す（今のコードにはドラッグ中に`Esc`でやめる経路が無い）。計画立案の途中で発注者へ確かめ、**方針(a)**に決まった：`KeyboardShortcuts`の受理判定に「拡大縮小のドラッグ中は`cancel`だけを通す」例外を1つ足し（照会`isCancelableDrag`を注入で受け取る。対応表は変えない。修飾キーを問わないことは発注者の決定（追加）で、下の「修飾キーを押したままの`Esc`」の項）、`cancelDraftOrClearSelection`の(1)は拡大縮小のドラッグなら中断して引き始めの形に戻し`true`、それ以外のドラッグは今のまま`false`。このため`KeyboardShortcuts.js`を対象に加えた（REQの「変えない見込み」の一覧には無かったファイル）。
* **`Esc`の後の`click`（計画の設計判断）**：`DragTracker.cancel()`は今、click抑止フラグを下ろす（blurの後に`click`は来ないため）。`Esc`の後もボタンは押されたままで、離すとキャンバスの`click`が来て、離した位置で選択が変わる（空白なら全解除）。`Esc`で元へ戻したのに選択が変わらないよう、`DragTracker.cancel`に省ける引数`suppressClick`を足し、`Esc`の経路だけ抑止を立てる（REQの変更対象の一覧に無かった`DragTracker.js`を加えた理由）。抑止が残った場合は次の押下の`clearSuppressedClick()`で消える（今の約束）。
* **`Shift`の角のハンドルの「変化の大きいほう」の解釈**：現場設計の決定「縦横の倍率の大きさを、外枠に対して変化の大きいほうにそろえる」を、外枠に対するカーソルの動きの割合が大きいほう（`|raw − 1|`。符号付きの倍率`raw`で比べる）と解した（要件Cの手順4）。倍率の絶対値の大きいほう（`max(|sx|, |sy|)`）とは、縮めるとき・裏返したときに結果が変わる。テストプレイで違和感があれば手順4だけを直せばよい。倍率を決めた向きの符号は丸めた後の`s`から、もう一方の向きの符号はその向きの`raw`から取る（決めた向きの辺を刻みの目に乗せるため。外枠の辺が半端な位置のとき、`raw`の符号とは逆になりうる）。
* **ハンドルの下の本体のホバー**：外枠のハンドルの上でも、下にある図形の本体のホバーの強調は今のまま出る（REQに決まりが無く、ホバーの今のふるまいを変えないため）。押せばハンドルが優先され、カーソルはハンドルの向きの形になる。
* **スポイトの待ち受け中**：外枠とハンドルは出たままだが、押下は何も始めず（今の待ち受けの早期`return`がハンドルの判定より前）、クリックはスポイトの取り込み、カーソルは`'cell'`（`CursorShapeRules`の(3a)が(3b)より前）。
* **浮動小数の誤差**：倍率を割り算で求めるため、ちょうど表せない値では引いた辺・角の位置が刻みの目から`1e-12`程度ずれることがある。弧の外枠も三角関数の誤差（`1e-15`程度）を含む（今の書き出しの外枠と同じ性質）。テストはちょうど表せる値か小さな許容量で比べる。
* **色の欄のピッカー操作中の拡大縮小**：`ShapeStyleEditor`は確定前の色の変更を「記録した図形インスタンスが今の図形にあるか」で判定する。拡大縮小のドラッグは図形のインスタンスを差し替えるため、ピッカーを開いたまま（確定前に）ハンドルを引くと、その色の変化は記録されず捨てられる（13.の「確定前に他の操作が起きた場合」と同じ種類の残る経路。通常のマウス操作では起こりにくく、対処しない）。
* **`main.js`の`shapeExtentReader`の生成位置**：`renderCurrentState`（`// 4.`）と`InputTracker`の注入が使うため、`// 7.10.`の生成の1行を`// 4.`へ移す（インスタンスの数は2のまま。`DisplayWiring`の内部の1つと合わせて2か所）。`ShapeExtentReader.js`のクラスJSDocの生成箇所の記述は、生成を移すタスク10で同時に直す（タスク3では触れない。再監査の指摘）。
* **中断で戻るのは拡大縮小だけ**：今の`InputTracker`のJSDoc（`setMode`・`abortOngoingOperation`・`#finishLeftDrag`等）は「中断してもドラッグ中に反映済みの頂点・位置は取り消さず残る」と説明している。拡大縮小のドラッグだけは中断（`Esc`・blur・`setMode`・`abortOngoingOperation`）で引き始めの形に戻り記録されないため、タスク8でこれらのJSDocを実態に合わせて直す（ほかの左ドラッグのふるまいは今のまま。再監査の指摘）。
* **規則どうしのimport**：`ScaleHandleRules → UnitSnapRules`（丸めを写さないため。REQの指示）と`CursorShapeRules → ScaleHandleRules`（カーソルの向きの表を1か所にするため）は、今の「規則の関数は何もimportしないか`InputModes`の値だけ」の約束に無い向き。循環はしない。資料の更新予定に入れた。
* **`core/ → shapes/`の型参照（計画監査の指摘4）**：`core/ScaleHandleRules`のJSDocが`shapes/ShapeGeometry`の`AffineTransform`を`import()`型参照で参照する。資料に`import()`型参照の扱いの約束は無く、今の`js/core/`に`core/ → shapes/`の型参照は1件も無いため、資料の約束に頼らず新しい向きとして扱い、この1か所に限って資料の1章（依存方向）に例外として明記する（開発資料の更新予定の1章）。実行時の依存は生まない（`import`文を書かない）。型参照を使わない形（`ScaleHandleRules`に同じtypedefを写す）は、変換の形の定義が2か所になるため採らなかった。
* **`Ellipse.createTransformed`の回転・傾き**：`b`・`c`が0でない変換は`Error`にする（今の持ち方で表せないため。本作業の呼び出し元は渡さない）。回転を足す後の作業で中身を作り直す。
* **到達不能の枝**：外枠のハンドルは図形ごとの`drawHandles`・`hitTestHandle`を使わずに作り、`PressActionRules`の`dragHandle`・`CursorShapeRules`の(7)・各図形の`drawHandles`・`CanvasManager`の`showHandles`は消さない（去就はPhaseのクローズで決める）。
* **タスクの間のブラウザ（計画監査の指摘5で縮めた）**：`KeyboardShortcuts`が`isCancelableDrag`を必須にする変更を、`main.js`が注入するタスク10へ寄せた（当初はタスク7）。これで起動時に`Error`になる間は無くなる。タスク8〜9の後、タスク10までの間は外枠のハンドルが出ない（`getSelectionFrameBounds`が既定値・`scaleFrame`をまだ渡さない）だけで、ほかは今のまま動く。ブラウザでの確認はタスク10の後に行う。（再監査の指摘で、`CanvasManager`の描画は省ける引数で順序の縛りが無いためタスク9として分けた。`KeyboardShortcuts`と`main.js`は同じタスク10のまま。）
* **修飾キーを押したままの`Esc`（発注者の決定（追加））**：拡大縮小のドラッグ中は`Shift`・`Alt`・`Ctrl`（Meta）を押したままでも`Esc`で中断して元の形に戻す。今の`#findBinding`は`Alt`押下で常に`null`、`cancel`のエントリは`ctrl: false`・`shift: FORBIDDEN`のため、例外を`#findBinding`より前の手順3に置き、判定をexportする状態なしの関数`findCancelableDragBinding`の1か所にまとめた（キーは`cancel`のエントリの`codes`から取る。対応表・`#findBinding`の照合は変えない。拡大縮小のドラッグ中以外は今のまま）。手順1・2（IME変換中・テキスト入力欄）は先に効く。手順4（色の欄等にフォーカス）・手順6（キーリピート）は`cancel`のエントリの値（`ctrl: false`・`repeatable: false`）のまま効く＝色の欄にフォーカスがある間は例外でも`Esc`で中断しない（今の`Esc`と同じ。ドラッグを始めた時点でフォーカスが色の欄に残っている場合に起こり得る。ウィンドウのフォーカスが外れれば中断として元に戻る）。
* **`findCancelableDragBinding`のexport**：`KeyboardShortcuts.js`の公開名が1つ増える（今はクラスだけをexport）。`#handleKeyDown`は`document`に依存してテストを置けず、テストは`globalThis`へ代入しないため、例外の判定だけを`document`に触れない関数にしてexportし`node --test`で確かめる。対応表そのものは今までどおりexportしない（返すのは凍結済みの`cancel`のエントリ1つ）。呼び出し元は`#handleKeyDown`とテストだけ。
* **OSが使う修飾キー付きの`Esc`**：Windowsでは`Ctrl`+`Esc`（スタートメニュー）・`Alt`+`Esc`（ウィンドウの切り替え）・`Ctrl`+`Shift`+`Esc`（タスクマネージャー）をOSが先に使い、ページに`keydown`が届かないことがある。その場合はウィンドウのフォーカスが外れ、`DragTracker`のblurの中断（`#onLeftDragCancel`）で同じく引き始めの形に戻る（`click`の抑止は立たないが、フォーカスが外れたためボタンを離した`click`は通常来ない）。テストプレイの9.に書いた。
* **（タスク2）弧の上下の裏返しの目視確認**：弧は`d < 0`のとき中心の`y`に`ry'`を足すため、上下に裏返した弧は外枠の下端に中心が来る（上半分の弧のまま）。外枠の`getSelectedGeometryBounds`（`toDrawElement`の弧の両端と軸上の端点）と一致する前提で、タスク10の後のブラウザで「弧を含む選択の上辺を下へ越える」操作を目視確認することを勧める。
* **（タスク2）`Path.createTransformed`の`corners`**：コンストラクタが`corners`を要素数`points`にそろえて写すため、`this.corners`をそのまま渡している（コンストラクタが複製するので共有しない）。
* **（タスク3）`computeShapesGeometryBounds`の範囲**：`ellipse`の弧の外枠は両端点と軸上の端点のみで弦は含まない（線を含む外枠と同じ形の範囲）。線なし・塗りなしの図形も和に含む。`ShapeExtentReader`のクラスJSDocの生成箇所の記述は`// 7.10.`のままで、タスク10で`// 4.`へ直す。
* **（タスク5）重なり優先のテスト**：辺のハンドルが出る条件（辺≧24px）では、辺と角の位置は常に`12 / viewScale`以上離れ、当たり半径`6 / viewScale`と重ならない。このため「角が優先」は手作りの`frame`（`n`と`nw`が同じ位置）と、外枠が小さく角どうしが重なるケース（最後の`sw`が優先）で確かめた。
* **（タスク5）Shiftの辺で`previous`が使われる場合**：辺・`keepAspect`でカーソルがちょうど0の位置のとき、引く軸は`previous`の倍率、もう一方は`|その倍率|`になる（手順6→7の素直な読み）。`InputTracker`は`lastScale`に直前の`{scaleX, scaleY}`を渡すだけなので、`Shift`の辺のセッションでは`previous.scaleY = |previous.scaleX|`が保たれる。
* **（タスク5）手順4の同率・長さ0の扱い**：角で`keepAspect`でも、片方の軸の長さが0（`bothPulled`でない）の入力は手順4を行わず、引く軸の`s`だけ（もう一方は1）にした（通常はハンドルが出ないため呼ばれない防御的な扱い）。
* **タスク6（カーソル・押下の規則）**：(3b)は`typeof scaleHandle === 'string'`で見るため空文字は`resolveScaleHandleCursor('')`が`null`を返して(4)以降へ進む。`PressActionRules`の順0は空文字を「ハンドルなし」とする（RESの「空でない文字列」どおり）。`SCALING_SELECTION`中に`scaleHandle`が`null`のまま呼ぶと(4)に当たらず(6)以降の当たり分類の枝へ落ちる（`InputTracker`の`#updateCursor`が拡大縮小中は`#scaleDrag.handle`を必ず渡す前提。タスク8で確認）。`isLeftDragState`の説明に`SCALING_SELECTION`を足したが、実際に真にするのは`InputTracker#isLeftDragState`（タスク8）。
* **（タスク8）`Esc`の後のclick抑止の前提**：`handleMouseDown`の先頭が`this.#drag.clearSuppressedClick()`で、拡大縮小のハンドルの押下の分岐（選択モードの枝の後半）より手前に必ず通る。`Esc`の中断後に`click`が来ず抑止フラグが残っても、次の押下で消える。
* **（タスク8）カーソル**：`#updateCursor`は`#scaleDrag !== null`なら`#scaleDrag.handle`を必ず`scaleHandle`へ渡す。`#beginScaleSelection`は`#beginLeftDrag`（内で`#updateCursor`）の前に`#scaleDrag`を入れる。ブラウザでの確認はタスク10の後。
* **（タスク8）`handleClick`の外枠のハンドルの判定位置**：RESの指示どおり待ち受け（`isPickingShape`）の判定の後・`hit.handle`の前。`#findScaleHandle`はクリックのたびに照会（`getSelectionFrameBounds`）を呼ぶ。`#classifyPoint`は今までどおり先に1回行う。
* **（タスク8）`#onLeftDragCancel`の戻し**：閾値以前の中断は`#isEditOpen`が偽のため戻さない（図形を変えていないため）。`#scaleDrag`の`null`確認を足している（防御）。
* **（タスク9）目視確認**：外枠のハンドルの見た目（外枠の青い1pxの線・白い四角に青い枠）はタスク10の後にブラウザで確認する。ハンドルの大きさは頂点のハンドルと同じ（`VERTEX_HANDLE_SIZE`）で、`handles`の後ろ（角）が前面に重なる。`CanvasManager`は受け取った位置を描くだけ。
* **（タスク10）ファイルの行末**：変更したファイルはすべてLF（作業前にCRを数えて確認）のままにした。
* **（タスク10）目視確認の推奨**：ブラウザで、拡大縮小のドラッグ中に`Esc`（`Shift`・`Alt`・`Ctrl`を押したままも）で元の形に戻りボタンを離しても選択が変わらないこと、外枠と8つのハンドルの見た目、弧を含む選択の上辺を下へ越える操作、色の欄にフォーカスがある間の`Esc`（例外でも効かない）を確認する。`#handleKeyDown`はテストできない。
* **（タスク10）`ShapeExtentReader`の生成位置に関するコメント**：`js/`を`7.10.`で検索し、ほかに生成位置を前提にしたコメントは無いことを確認した（`main.js`の`// 7.10.`の見出しと、移し先のコメント内の言及のみ）。
* **（タスク9）開発資料の更新予定**：`_doc/arch/04_CanvasManager.md`（`render`の描画順に(2-3)外枠とハンドル・`scaleFrame`引数を追記）。
* **（タスク13）目視確認を特に勧める箇所**：テストプレイの4.（`Shift`の角の比率の保ち方。縮める・裏返すときの感触）、5.（弧の上下の裏返しで外枠と見た目がずれないか）、6.（外枠の辺が半端な位置のときのスナップ）、9.（修飾キーを押したままの`Esc`と、`Esc`後にボタンを離したときに選択が変わらないこと）。要件Gの6.の「位置の欄で`10.5`を入れる」は、位置の欄の値が線の太さを含むため外枠の辺の位置と一致しない食い違いがあり、太さが奇数の図形で整数を入れる形に直した。ホイールでの拡大縮小の途中のカーソル追従（ドラッグ中のホイールも追従のたびに倍率を求め直す）は項目に入れていない。
