# RES: 作業計画・作業レポート Phase 12-01 : 頂点の追加と削除
* 参照元REQ: `./_log/req/261126_1729_REQ_Phase12-01_Vertex_Add_Delete.md`

## 1. 作業目的
頂点の選択（`A`）で、線・パスの区間の上をダブルクリックするとその位置に点が増え、選んだ点を`Delete`・`Backspace`・削除ボタン（🗑）で消せるようにする。直線・矩形・今の曲線（`curve`）・パス（区間`line`・`smooth`・`bezier`、開いた・閉じた）のそれぞれで、足したときは形を保ち（`smooth`は曲線のまま）、消したときは前後の区間の種類に合わせてつなぎ、点を減らしすぎたら一段ずつ形を落とす。1回の追加・1回の削除はそれぞれ取り消し1件。作業データ・書き出し形式の版は上げない。「曲線に」・選択ツール（`V`）の削除・切り取り・頂点のドラッグ等の今のふるまいは変えない。

## 2. アーキテクチャ設計

### 用語（全タスク共通）
*   **区間**：REQの【用語】のとおり。矩形は4つの直線の区間（閉じた輪）、直線は1つの直線の区間、今の曲線は始点から終点までの1つの区間（2次ベジェ）として扱う。
*   **輪郭の元（outline source）**：点を足す・消す計算のために、直線・矩形・今の曲線・パスの`toJSON()`の値を「パスの図形データの形」（`{ type: 'path', points, closed, segments, corners?, strokeColor, strokeWidth, fillColor }`）に読み替えたもの。直線＝点2つ・開いた・区間`[{kind:'line'}]`（区間の読みは`PathJoinRules.segmentSpecsOf`＝「直線は直線の区間1つ」の唯一の定義を通す。文字列の区間の指定は`{ kind }`にそろえる）、矩形＝点4つ（`points`の並び＝topLeft→topRight→bottomRight→bottomLeft）・閉じた・区間`{kind:'line'}`×4（「矩形は閉じた4つの直線の区間」の唯一の定義箇所はこの読み替え）、今の曲線＝`PathJoinRules.chainSourceOf`の結果（点2つ・`bezier`の区間1つ。2次→3次の式はそこの1か所のまま）、パス＝`toJSON()`の値そのもの。円・弧は`null`（対象外）。
*   **区間の上の位置（location）**：`{ segmentIndex, t, point, distance }`。`segmentIndex`＝区間の番号、`t`＝区間の上の割合（0〜1）、`point`＝区間の上の点、`distance`＝折れ線の近似での距離（`Path.hitTest`と同じ測り方）。
*   **選んだ点（target）**：`{ shape, vertexIndex }`。`PathCornerRules`の`CornerTarget`・`PathSegmentKindRules`の`SegmentSwitchTarget`と同じ形。

### 図形の種類ごとの結果の表（要件2・3の正本。テストはこの表の行ごとに書く）

#### 点を足したら何になるか（要件2）
足す位置＝ダブルクリックした位置に最も近い区間の上の位置（区間`i`の割合`t`。`0 < t < 1`のときだけ足す）。足した点の番号は`i + 1`（閉じたパスの最後の区間＝`points[n-1]`→`points[0]`に足した点は末尾＝番号`n`）。足した点の角（`corners`）は`false`。ほかの点の角・ほかの区間の種類・線の色・太さ・塗り（`fillColor`）・名前・表示・ロック・一覧での位置・フォルダの所属・`id`は元のまま。

| 元の図形 | 足した区間の種類 | 結果の図形 | 足した点の位置 | 前後の区間 | 形 |
| --- | --- | --- | --- | --- | --- |
| パス（開いた・閉じた） | `line` | パス（点＋1、閉じているかは元のまま） | 区間の線分の上の最も近い点`a + t(b − a)` | `line`・`line` | 変わらない |
| パス（開いた・閉じた） | `bezier` | パス（点＋1） | de Casteljauで`t`で分けた点 | `bezier`（`control1`＝分けた前半の1つ目・`control2`＝前半の2つ目）・`bezier`（後半の1つ目・2つ目） | ぴったり同じ（区間を分けただけ） |
| パス（開いた・閉じた） | `smooth` | パス（点＋1） | 足す前の曲線（`resolveSegmentControls`の制御点の3次ベジェ）の上の`t`の点 | `smooth`・`smooth` | 足した区間とその前後の`smooth`の区間（同じ曲線の連なりの隣）の曲がり方が少しだけ変わる。ほかは変わらない。足した点は角ではない |
| パス（閉じた） | 最後の区間（`n-1`→`0`）の上記3種 | パス（点＋1、足した点は末尾） | 同上 | 同上（最後の区間が2つに分かれる） | 同上 |
| 直線（`line`） | （直線の区間1つ） | 点3つの開いたパス（区間`line`×2） | 線分の上の最も近い点 | `line`・`line` | 変わらない |
| 矩形（`rect`。回した矩形も） | 4辺のどれか（直線の区間） | 点5つの閉じたパス（区間`line`×5） | 辺の上の最も近い点（足した点は辺`i`の後ろ。下辺の後の左辺＝`bottomLeft`→`topLeft`に足すと末尾） | `line`・`line` | 変わらない。塗りは閉じたパスで描かれる |
| 今の曲線（`curve`） | （2次ベジェ1つ） | 点3つの開いたパス（区間`bezier`×2） | 2次→3次（`chainSourceOf`）にした3次ベジェをde Casteljauで分けた点 | `bezier`・`bezier` | 変わらない（次数を上げて分けただけ） |
| 円・弧 | — | 足さない（`null`） | — | — | — |
| （どの図形でも）最も近い位置が`t = 0`・`t = 1`（頂点と同じ位置）、または許容幅の外 | — | 足さない（`null`） | — | — | — |

#### 点を消したら何になるか（要件3）
消す点の集合`D`（図形ごと）、残る点`K`（元の番号の昇順）。残った点の角・ほかの区間の種類・線の色・太さ・塗り（閉じたパスが開いても`fillColor`の値を保つ）・名前・表示・ロック・一覧での位置・フォルダの所属・`id`は元のまま。消した点の角は一緒に消える。**つなぐ区間の種類**（続いた点をまとめて消したときは、消した点にかかる区間すべて＝残る前の点から残る次の点までの区間の並び`run`を見る）：`run`がすべて`line`なら`line`、すべて`bezier`なら`{ kind: 'bezier', control1: run[0].control1, control2: run[最後].control2 }`、それ以外（`smooth`が混ざる・`line`と`bezier`が混ざる等）は`smooth`。

| 元の図形 | 消す点 | 結果 |
| --- | --- | --- |
| 開いたパス | 途中の点（1つ・続いた複数・離れた複数） | 開いたパス。残る前後の点の間は`run`の規則でつないだ1つの区間（`run`が区間1つ＝消した点にかからない区間はそのまま） |
| 開いたパス | 始点（または先頭から続いた点） | 開いたパス。消した点とその点の区間が消え、隣の点が新しい始点 |
| 開いたパス | 終点（または末尾まで続いた点） | 開いたパス。隣の点が新しい終点 |
| 開いたパス | 残りが1点以下 | 図形ごと消える（`null`） |
| 閉じたパス | 残りが3点以上 | 閉じたパス（`K`の順。最後の`K`から最初の`K`へ戻る区間も`run`の規則） |
| 閉じたパス | 残りが2点（`K = [a, b]`、`a < b`） | 開いた線（パス・点2つ・区間1つ・`closed: false`）。`a`→`b`の区間が1つだけ（`b = a + 1`）ならその区間を残して`[a, b]`。そうでなく`b`→`a`の折り返しの区間が1つだけ（`a = 0`・`b = n − 1`）ならその区間を残して`[b, a]`（区間の向きを変えないため並びを`b`→`a`にする）。どちらでもなければ（消した点に触れていない区間が無い）`a`→`b`の向きの`run`（区間`a`〜`b−1`）を規則でつないだ1つの区間で`[a, b]` |
| 閉じたパス | 残りが1点以下 | 図形ごと消える（`null`） |
| 直線（`line`） | どちらか1点・両方 | 点が1つ以下になるので図形ごと消える（`null`） |
| 矩形（`rect`） | 1点 | 残った3点の閉じたパス（区間`line`×3。三角形。塗りは描かれる） |
| 矩形（`rect`） | 隣り合う2点 | 開いた線（パス・点2つ）。残る2点の間の消した点に触れていない辺を残す |
| 矩形（`rect`） | 向かい合う2点（`topLeft`と`bottomRight`等） | 開いた線（パス・点2つ）。触れていない区間が無いので`a`→`b`の向きの`run`（直線の区間2つ）をつないだ直線の区間1つ |
| 矩形（`rect`） | 3点・4点 | 図形ごと消える（`null`） |
| 今の曲線（`curve`） | 始点・制御点・終点のどれか1つ | 残った2点を結ぶ直線（`Line`。始点→制御点→終点の並びで残った順。`fillColor`は値を保つ） |
| 今の曲線（`curve`） | 2点・3点 | 図形ごと消える（`null`） |
| 円・弧 | — | 対象外（頂点のハンドルが無く、選ばれない） |

開いた線（点2つ）は`path`のまま表す（`line`にしない。残す区間が`bezier`・`smooth`でも形を保つため。`J`で閉じるには点が3つ以上要る＝今の`classifyJoin`のふるまい）。

### 要件1: ダブルクリックで点を足す
*   **入口（`core/InputTracker`。最小の変更）**：キャンバスの`dblclick`を購読し、公開のイベントハンドラ`handleDoubleClick(event)`で受ける。中身は「ワールド座標を求める → `#classifyPoint`（クリックと同じ当たり分類・同じ許容幅）→ `core/VertexEditRules.resolveDoubleClickInsertTarget({ mode, state, isDragging, clickSuppressed, hit })`が図形のidを返したら、注入された補助`InputAssist.insertVertexAt(shapeId, point, tolerance)`（`tolerance`＝`#getWorldHitTolerance()`）を呼ぶ」だけ。計算・判定を持たない。
*   **足す相手の規則（新規`core/VertexEditRules.js`。状態なし。importは`InputModes`のみ）**：`resolveDoubleClickInsertTarget`は、操作モードが`VERTEX`・入力状態が`IDLE`・ドラッグ中でない・直前の`click`が抑止されていない（2回目のクリックが閾値を超えたドラッグだったときは足さない）・当たりが頂点のハンドルでない・本体`bodyId`がある、のときだけ`bodyId`を返し、ほかは`null`。修飾キーは見ない（`Ctrl`等を押したままのダブルクリックでも足す）。
*   **直前の`click`が抑止されたか**：`InputTracker`の`handleClick`の冒頭の`this.#drag.consumeSuppressedClick()`の結果を非公開のフィールド`#lastClickSuppressed`へ覚える（このフィールドを足すだけ。`handleClick`の他のふるまいは変えない）。
*   **輪郭からの許容幅・図形の種類の判定（`shapes/PathVertexRules.planVertexInsertion`）**：塗りの内側だけで当たった（輪郭から許容幅の外）・円・弧・最も近い位置が頂点と同じ（`t`が0か1）なら`null`。隠れた・ロックされた図形は`#classifyPoint`が`getEditableShapes()`しか見ないため当たらず、手順の側（`PathVertexEditor.insertAt`）も`getEditableShapes()`に無いidでは何もしない（二重の守り）。
*   **1件の編集操作（新規`edit/PathVertexEditor.js`の`insertAt(shapeId, point, tolerance)`）**：①`model.getEditableShapes()`から図形を探す（無ければ`false`）②`planVertexInsertion`が`null`なら`false`（記録先・モデルに触れない）③足した点のハンドル名を、新しい図形の`getVertexHandleNames()`のうち`getVertexIndexForHandle(名前) === insertedIndex`のものとして求める（ハンドル名の形式を知らない。`PathCornerEditor.#remapSelectedVertices`と同じ求め方）④`beginEdit` → `model.replaceShape(shapeId, plan.shape, { keepId: true, select: true })`（その図形だけが選ばれる。名前・表示・ロック・位置・所属・`id`を引き継ぐ）→ `model.setSelectedVertices([{ shapeId, handle }])`（足した点だけが選ばれる）→ `commitEdit()`（鍵なし）⑤`true`。
*   **ダブルクリックの1回目・2回目のクリック**：今のまま（頂点の選択で本体をクリックすると頂点の選択が空になりその図形だけが選ばれる）。最終の状態は④で決まる。点を足した直後のカーソルの形は次にマウスを動かすまで前のまま（`#updateCursor`を呼び足さない）。

### 要件2: 足したときの形（`shapes/PathVertexRules`）
*   **区間の制御点の求め方の共有（`shapes/Path.js`の変更）**：`Path`の非公開`#segmentControls()`の本体（`computeSmoothSegmentControls`へ`smooth`の区間を渡し、`bezier`の区間だけ引っ張る点に置き換える＝区間の種類による分岐の唯一の箇所）を、exportする関数`resolveSegmentControls(data)`（`data`＝`Path`のインスタンスか`toJSON()`の値。角は`readCornerFlags(data)`、閉じているかは`data.closed === true`で読む）へ移し、`#segmentControls()`は`return resolveSegmentControls(this);`だけにする（計算・結果は今とビット単位で同じ。描画・当たり判定・範囲選択・塗りの内側・書き出しは今のまま）。形の決め方の式（`ShapeGeometry.computeSmoothSegmentControls`）は今の1か所のまま。あわせて折れ線の近似の分割数`SMOOTH_SEGMENT_SAMPLE_COUNT`（100）を`export`にする（区間の上の最も近い位置の許容幅の判定を`Path.hitTest`と同じ測り方にするため。値・唯一の定義の箇所は変えない）。
*   **今の曲線の読み替えの共有（`shapes/PathJoinRules.js`の変更）**：非公開の`chainSourceOf`に`export`を付ける（中身は変えない。JSDocの「非公開」を「`PathVertexRules`からも使う」へ直す）。2次→3次の式`s + (c − s) * 2 / 3`は今の1か所のまま。
*   **新規`shapes/PathVertexRules.js`（図形クラスではない第3の種類の規則。状態なし）**：
    *   import：`./Path.js`（`Path`・`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`・`SEGMENT_KIND_BEZIER`・`readCornerFlags`・`resolveSegmentControls`・`SMOOTH_SEGMENT_SAMPLE_COUNT`）・`./Line.js`（`Line`。今の曲線の点を消した結果）・`./PathJoinRules.js`（`segmentSpecsOf`・`chainSourceOf`）・`./ShapeGeometry.js`（`cubicBezierPoint`）。図形クラス・`PathJoinRules`・`ShapeGeometry`はこのファイルをimportしないため循環しない。
    *   `outlineSourceOf(data)`（export）：用語の「輪郭の元」。`type`が`line`・`rect`・`curve`・`path`以外は`null`。引数を書き換えず、結果は引数と配列・点を共有しない新しい値。
    *   `findNearestSegmentLocation(source, point, tolerance)`（export）：区間の上の最も近い位置。`controls = resolveSegmentControls(source)`。区間`i`（`points[i]`→`points[(i+1) % n]`。閉じたパスの最後の区間を含む）ごとに、直線の区間（`controls[i] === null`）は線分への射影（`t`を0〜1に収める。長さ0の区間は`t = 0`）で`point`と`distance`を求める。曲線の区間（`smooth`・`bezier`）は、`Path.#someSegment`と同じ`SMOOTH_SEGMENT_SAMPLE_COUNT`個の小区間の折れ線（`k = 0…N`の点。`k = 0`は始点、`k = N`は終点そのもの、ほかは`cubicBezierPoint(a, c1, c2, b, k/N)`）で最も近い小区間`k`と小区間の上の割合`s`を求め、`distance`＝その折れ線の距離、`t0 = (k − 1 + s) / N`とし、`[max(0, (k − 2)/N), min(1, (k + 1)/N)]`の範囲で三分探索（反復40回の定数`NEAREST_REFINE_ITERATIONS`）して真の曲線の上で`point`との距離が最も小さい`t`を求め、`point = cubicBezierPoint(a, c1, c2, b, t)`（曲線の上にちょうど乗る）。区間の間では`distance`が最も小さいもの（同じなら番号の小さい区間）。最小の`distance`が`tolerance`より大きければ`null`。点が1つ以下・区間が無ければ`null`。引数を書き換えない。
    *   `splitCubicBezier(p0, p1, p2, p3, t)`（export）：de Casteljauで3次ベジェを`t`で2つに分ける。`{ first: { control1, control2 }, point, second: { control1, control2 } }`（新しい座標）。前半＝`p0`・`first.control1`・`first.control2`・`point`、後半＝`point`・`second.control1`・`second.control2`・`p3`で、元と同じ曲線をたどる。
    *   `planVertexInsertion(shape, point, tolerance)`（export）：`shape`の`type`・`toJSON()`だけを読む（`type`が対象外なら`toJSON()`を呼ばず`null`）。`outlineSourceOf` → `findNearestSegmentLocation`（`null`なら`null`）→ `t <= 0`か`t >= 1`なら`null` → 表のとおり新しい点・区間・角の並びを作り（区間の指定は`segmentSpecsOf`の結果の要素を写す。直線の区間＝`{kind:'line'}`×2、曲がり方を持つ区間＝`splitCubicBezier(a, control1, control2, b, t)`の2つ、点を通る曲線の区間＝`{kind:'smooth'}`×2。足す点は直線＝`location.point`、曲がり方を持つ区間＝分けた`point`、点を通る曲線＝`location.point`）、`new Path(points, closed, strokeColor, strokeWidth, fillColor, specs, corners)`で組み立てる（`id`は`null`）。戻り値`{ shape: Path, insertedIndex: number }`。

### 要件3: 点を消す
*   **入口（`core/InputTracker`。最小の変更）**：
    *   今の`deleteSelection()`は**変えない**（選択ツールの削除ボタン・`Delete`・切り取りの唯一の削除経路のまま。切り取り`ClipboardController.cut`は今どおり`deleteSelection()`を注入されるため、頂点の選択では今のまま何もしない）。
    *   公開メソッド`deleteSelectionOrVertices()`を足す：`core/VertexEditRules.resolveDeleteRoute(this.currentMode)`が`DELETE_ROUTE.VERTICES`（頂点の選択）なら、入力状態が`IDLE`でドラッグ中でなく、注入された補助`InputAssist.hasRemovableVertices()`が真のときだけ`InputAssist.removeSelectedVertices()`を呼んで`true`（ほかは`false`）。`DELETE_ROUTE.ITEMS`（それ以外のモード）なら`this.deleteSelection()`の結果をそのまま返す。
    *   `deleteLastLinePointOrSelection()`（`Delete`・`Backspace`の実体）は`this.removeLastLinePoint() || this.deleteSelectionOrVertices()`にする（線を引いている途中なら最後の点を消す今の割り当てを保ち、頂点の選択のときの振り分けだけを足す。`KeyboardShortcuts.js`の対応表は変えない）。
    *   公開の照会`canDeleteSelectionOrVertices()`を足す：`resolveDeleteRoute`が`VERTICES`なら`InputAssist.hasRemovableVertices()`、`ITEMS`なら`model.hasRemovableSelection()`（今の削除ボタンの式そのまま）。削除ボタンの押せる・押せないの唯一の照会。
*   **振り分けの規則（`core/VertexEditRules.js`）**：値`DELETE_ROUTE`（`ITEMS: 'items'`・`VERTICES: 'vertices'`。凍結）と`resolveDeleteRoute(mode)`（`OperationMode.VERTEX`なら`VERTICES`、ほか（`SELECT`・`CREATE`・`PAN`・未知の値）は`ITEMS`）。
*   **削除ボタン（`main.js`の配線だけ）**：`syncDeleteButtonState`を`deleteSelectionBtn.disabled = !inputTracker.canDeleteSelectionOrVertices();`に、ボタンの`click`を`inputTracker.deleteSelectionOrVertices()`にする。`main.js`に操作モードの判定を書かない（判定は`VertexEditRules`、照会は`InputTracker`）。選択ツール（`V`）・ほかのモードの見た目・ふるまいは今と同じ（`ITEMS`の枝が今の式・今の`deleteSelection()`のため）。モードの切り替えは`setMode`の`clearSelection()`が必ず通知するため、ボタンの同期は今の`model.onChange`の経路だけで追従する。
*   **1件の編集操作（`edit/PathVertexEditor`）**：
    *   `#collectTargets()`：`resolveNudgeTarget(getMode(), getSelectedIds(), getSelectedVertices())`が`'vertices'`のときだけ、`getShapes()`から図形を探して`getVertexIndexForHandle`で番号を得た`{ shape, vertexIndex }`の並び（図形が無い組・番号が得られない組は飛ばす）。`PathCornerEditor.#collectTargets`と同じ手順（非公開で共有できないため写す。モードの値は解釈せず規則へ渡すだけ）。
    *   `canRemoveSelectedVertices()`：`planVertexRemoval(#collectTargets()).length > 0`（純粋な照会）。
    *   `removeSelectedVertices()`：①`plan = planVertexRemoval(#collectTargets())`、空なら`false`（記録先・モデルに触れない）②`beginEdit` → `model.clearSelectedVertices()`（先に空にして、途中の通知で古いハンドル名が残らないようにする）→ 結果が図形の組ごとに`model.replaceShape(targetId, shape, { keepId: true, select: false })`（選択は保たれる）→ 図形ごと消える組の`targetId`を集め、1つ以上なら`model.deleteShapes(ids)`（図形のアイテムだけを除き、入っていたフォルダは空になっても残る。選択集合・ホバー・描き込む先も`VectorModel`が整える）→ `commitEdit()`（鍵なし。複数の図形でも1件）③`true`。
*   **規則（`shapes/PathVertexRules.planVertexRemoval(targets)`）**：図形ごと（`targets`に最初に現れた順）に、0以上・頂点の数未満の整数の番号だけを消す点とする（同じ点の重複は1つ）。`type`が`curve`なら表の今の曲線の行、`line`・`rect`・`path`なら`outlineSourceOf`の結果に表の規則を当てる、それ以外は飛ばす。消す点が1つ以上ある図形だけを結果に入れ、`{ targetId: shape.id, shape: Path|Line|null }`（`null`＝図形ごと消える。新しい図形の`id`は`null`）。引数を書き換えず、結果は引数と配列・点を共有しない。
*   **消した後の選択**：頂点の選択は空。残った図形は選ばれたまま、消えた図形は選択から外れる（`deleteShapes`の既存のふるまい）。

### 要件4: 取り消しと、変えられない図形
*   追加・削除はそれぞれ`beginEdit`／`commitEdit`の1組で取り消し1件（複数の図形の点をまとめて消しても1件）。何も変わらない（計画が空・`null`）ときは`beginEdit`も呼ばない。スナップショットは頂点の選択を含まないため、取り消し・やり直しの後は頂点の選択が外れ図形の選択だけが戻る（角・区間の切り替えと同じ既存のふるまい）。
*   変えられない図形：頂点の選択は`VectorModel`が変えられる図形の組しか持たない（今の不変条件。`removeSelectedVertices`の対象にならない）。ダブルクリックは`getEditableShapes()`の当たり＋`insertAt`の`getEditableShapes()`の確認で対象にならない。テストで確かめて保つ（コードの変更は不要）。

### 要件5: 保存・書き出し
*   結果は今の`path`（`points`・`closed`・`segments`・`corners`）と`line`の形のまま。`io/`は変えない（作業データの版4・書き出し形式の版4のまま）。2点の開いたパス・5点の閉じたパスは今の`Path.fromJSON`の受理の範囲（開いた2点以上・閉じた3点以上）。

### 要件6: 「曲線に」との関係
*   `PathSegmentKindRules`・`PathCornerEditor`は変えない（`buildCurvedPath`の結果・`#remapSelectedVertices`はそのまま）。点の追加は別の規則`PathVertexRules`・別の手順`PathVertexEditor`。共有するのは`Path.resolveSegmentControls`（形の決め方の分岐の唯一の箇所。中身は今の`#segmentControls`そのもの）と`PathJoinRules.segmentSpecsOf`・`chainSourceOf`だけ。テストで「曲線に」の結果（点の位置・区間の種類・角）が今の値のままであることを確かめる。

### 要件7: 自動テストと、既存のテストで値を変えるもの
*   足すテストファイル：`test/shapes/PathVertexRules.locate.test.js`（タスク1）・`test/shapes/PathVertexRules.insert.test.js`（タスク2）・`test/shapes/PathVertexRules.remove.test.js`（タスク3）・`test/core/VertexEditRules.test.js`（タスク4）・`test/edit/PathVertexEditor.test.js`・`test/edit/PathVertexEditor.items.test.js`（タスク5）。
*   **既存のテストで値を変えるもの：なし（見込み）**。既存のテストファイルは変更しない。`Path`の`#segmentControls`の移し替えは結果がビット単位で同じであるべきで、既存のテストの全件合格で確かめる。実行して1件でも値を変えざるを得ないものが出たら、そのタスクを中断して質問する。

### モジュールの分担（全体）
| 層 | ファイル | 持つもの | 持たないもの |
| --- | --- | --- | --- |
| `shapes/` | `PathVertexRules.js`（新規） | 輪郭の元への読み替え・区間の上の最も近い位置・ベジェの分割・点を足した／消した新しい図形の組み立て（図形種別の分岐はここに閉じる） | モデル・履歴・選択・操作モード・表示倍率 |
| `shapes/` | `Path.js`（更新） | `resolveSegmentControls`（今の`#segmentControls`の本体）・`SMOOTH_SEGMENT_SAMPLE_COUNT`のexport | 頂点の追加・削除のメソッド（共通メソッド契約は18のまま） |
| `shapes/` | `PathJoinRules.js`（更新） | `chainSourceOf`のexport | 中身の変更 |
| `core/` | `VertexEditRules.js`（新規） | ダブルクリックで足す相手の判定・削除の入口の振り分け | 図形・モデル・DOM |
| `core/` | `InputTracker.js`（更新） | `dblclick`の購読と受け渡し・削除の入口の振り分けの呼び出し・照会・`#lastClickSuppressed` | 計算・判定（規則へ渡すだけ）・`edit/`のimport |
| `edit/` | `PathVertexEditor.js`（新規） | 追加・削除の1件の編集操作の手順・削除の可否の照会 | 図形種別の分岐・ハンドル名の形式・操作モードの解釈・DOM |
| `js/` | `main.js`（更新） | 生成・注入・削除ボタンの同期の式の差し替え | 判定・計算 |
| `core/` | `KeyboardShortcuts.js`（JSDocの1行のみ） | 注入される`deleteSelection`のJSDocの説明の更新 | 対応表・判定の変更 |

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形・図形をまたぐ規則）・`./js/core/`（入力・規則）・`./js/edit/`（編集操作の手順）・`./js/`（`main.js`）・`./test/`
*   **関連する論理クラス**: 新規＝`shapes/PathVertexRules`（規則の関数）・`core/VertexEditRules`（規則の関数）・`edit/PathVertexEditor`（手順のクラス）。更新＝`shapes/Path`（`resolveSegmentControls`・`SMOOTH_SEGMENT_SAMPLE_COUNT`のexport）・`shapes/PathJoinRules`（`chainSourceOf`のexport）・`core/InputTracker`・`core/KeyboardShortcuts`（JSDocのみ）・`main.js`。変えない＝`core/VectorModel`・`core/HistoryManager`・`core/CanvasManager`・`core/PointHitRules`・`core/PressActionRules`・`core/VertexHandleRules`・`core/NudgeTargetRules`・`core/RemovalRules`・`shapes/PathSegmentKindRules`・`shapes/PathCornerRules`・`shapes/ShapeGeometry`・`shapes/Line`・`shapes/Rect`・`shapes/Curve`・`edit/PathCornerEditor`・`edit/GroupEditor`・`edit/ClipboardController`・`io/`のすべて・`palette/`のすべて・`index.html`。

### 参照する責務
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`をimportしない。`palette/`は何もimportしない。循環importは無い。一方向の列から外れるのは(1)`edit/ → shapes/`（`PathJoiner`・`EndpointSnapper`・`PathCornerEditor`だけ。今回`PathVertexEditor → shapes/PathVertexRules`を足す）、(2)`shapes/`内の規則のファイルが図形クラス・ほかの規則のファイルをimportする向き（図形クラスは規則のファイルをimportしない）、(3)`edit/ → core/`の状態を持たない規則の関数（今回`PathVertexEditor → core/NudgeTargetRules`を足す。`VectorModel`・`HistoryManager`は注入で受け取る）。`core/InputTracker`は`edit/`をimportせず、`main.js`が注入した補助（`InputAssist`）を呼ぶだけ。
*   **`shapes/`**：図形クラス（種別ごとに1ファイル）・図形クラスだけが使う共通の関数（`ShapeGeometry`。3次ベジェの点・点を通る曲線の区間の制御点＝形の決め方の式の唯一の箇所）・図形をまたぐ規則（第3の種類。`PathJoinRules`・`EndpointSnapRules`・`PathCornerRules`・`PathSegmentKindRules`。`shapes/`の外から使う）。`PathJoinRules.segmentKindsOf`が「直線は直線の区間1つ」の唯一の定義、`chainSourceOf`が今の曲線・弧から区間への変換（2次→3次の式）の唯一の箇所、`Path.readCornerFlags`が`corners`の読み方の唯一の箇所、`Path.#segmentControls`が区間の種類による制御点の分岐の唯一の箇所（描画・当たり判定・範囲選択・塗りの内側・書き出しが共有）。`Path`の区間の約束：`segments[i]`＝`points[i]`→`points[(i+1)%n]`、要素数は開いた`n−1`・閉じた`n`、頂点数の下限は開いた2・閉じた3、`corners`は頂点と同じ並び（頂点の追加・削除では`points`・`segments`・`corners`を同じ並びで保つ）。`bezier`の引っ張る点は絶対座標で頂点ではない。`bezier`とのつなぎ目は常に角。共通メソッド契約は18メソッド（増やさない）。
*   **`core/`の規則のファイル**：状態・DOMを持たない関数。引数を書き換えない。規則は何もimportしないか`InputModes`の値だけをimportする（規則どうしの決められたimportを除く）。
*   **`InputTracker`**：入力の解釈とModelへの反映。規則・計算・新しい状態を持ち込まない（今回は`#lastClickSuppressed`の1つだけを足す）。図形種別の分岐・図形固有のプロパティ名を持たない。当たり分類は`#classifyPoint`（`PointHitRules.classifyPointHit`。`getEditableShapes()`。頂点の選択のときだけハンドルを含める。許容幅は画面上5pxのワールド換算`#getWorldHitTolerance()`）。削除の受理は`deleteSelection()`の1か所（削除ボタン・`Delete`/`Backspace`・切り取りの経路。選択モード・`IDLE`・ドラッグ中でない・`hasRemovableSelection()`）。今回、頂点の選択での点の削除の経路を別の公開メソッドとして足し、`deleteSelection()`は変えない。記録先へは`beginEdit`・`commitEdit`だけ（点の追加・削除の記録は`PathVertexEditor`が挟み、`InputTracker`は挟まない）。
*   **`edit/`のクラス**：1件の編集操作の手順（`beginEdit` → 変更 → `commitEdit`）。何も変えないときは記録先に一切触れない。操作モードを解釈しない（`getMode`は`core/NudgeTargetRules`へ渡すだけ）。図形種別の分岐・図形固有のプロパティ名（ハンドル名の形式を含む）を持たない。DOMに触れない。`try/catch`を持たない。`VectorModel`・`HistoryManager`は注入で受け取り、規則の関数だけをimportする。
*   **`VectorModel`**：図形・選択・頂点の選択の唯一の持ち主。`replaceShape(id, shape, { keepId, select })`は位置のアイテムの`shape`だけを差し替える（名前・表示・ロック・所属・並びを引き継ぐ。`select`が真なら選択をその図形だけにする）。`deleteShapes(ids)`は図形のアイテムだけを除き、フォルダは空になっても残す（選択集合・ホバー・頂点の選択から除き、描き込む先を付け替える）。`setSelectedVertices`は選択集合に含まれ変えられる図形の組だけを受理する。頂点の選択は保存しない・履歴の対象外。
*   **`HistoryManager`・スナップショット**：前後の作業データを丸ごと比べ、同じなら記録しない。スナップショットは`document`・`selectedIds`・`selectedGroupIds`・`collapsedGroupIds`（頂点の選択を含まない）。
*   **`main.js`**：生成・注入・同期の配線だけ。判定・計算・操作モードの判定を書かない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`core/VertexEditRules.js`（ダブルクリックで足す相手と削除の入口の振り分けの規則。状態なし。importは`InputModes`のみ。`InputTracker`から使う。Phase 12-01）、`shapes/PathVertexRules.js`（図形クラスではない。図形をまたぐ規則（頂点の追加・削除：輪郭の元・区間の上の最も近い位置・ベジェの分割・足した／消した図形の組み立て）。`shapes/`の外から使う）、`edit/PathVertexEditor.js`（点の追加・削除の1件の編集操作の手順と削除の可否の照会）。テストの一覧に`test/core/VertexEditRules.test.js`・`test/shapes/PathVertexRules.locate.test.js`・`.insert.test.js`・`.remove.test.js`・`test/edit/PathVertexEditor.test.js`・`.items.test.js`。`ShapeGeometry`の行の「図形クラスだけが使う」に`PathVertexRules`（`cubicBezierPoint`）を足す。`InputModes`の行の「使う」に`VertexEditRules`。`NudgeTargetRules`の行の「使う」に`edit/PathVertexEditor`。
*   **1章「存在しないもの」**：「頂点の削除」を消す。「`main.js`への操作モードの判定の追加（削除ボタンの見た目を頂点の選択で変えない。3章18.）」を「削除ボタンの見た目は頂点の選択で変わるが、判定は`VertexEditRules`・照会は`InputTracker.canDeleteSelectionOrVertices()`で、`main.js`に操作モードの判定は無い（Phase 12-01）」の趣旨へ直す。「「曲線に」で足す点以外の頂点の追加・「直線に」で点を消すこと」は「「曲線に」「直線に」で点の数を変えること（点の追加はダブルクリック、削除は`Delete`。Phase 12-01）」の趣旨へ直す。Phase 12-01でやらないと決めたこと（REQの「今回やらないこと」：線を切る・区間を消す・開いた線を閉じる操作、頂点2つの閉じたパス、ほかの図形の頂点への吸い付き・端点への吸い付きの対象を広げること、円・弧への点の追加・削除、曲線の方向のハンドル、区間をクリックして選ぶ仕組み・ハサミのツール・点を足す専用のツール・点を足す・消すキーの新設、点の本当の共有・1つの図形に輪郭を複数持たせること、版を上げること。加えて計画で決めたこと：点を足した直後のカーソルの形の再評価、修飾キーでダブルクリックのふるまいを変えること、頂点の選択での切り取り）を足す。
*   **1章「フォルダ分割の方針」「依存方向」**：`shapes/`の第3の種類に`PathVertexRules`（輪郭の元＝直線・矩形・今の曲線・パスを「パスの図形データの形」に読む唯一の箇所。矩形を閉じた4つの直線の区間として読む唯一の箇所。2次→3次は`chainSourceOf`、制御点は`Path.resolveSegmentControls`、「直線は直線の区間1つ」は`segmentSpecsOf`に任せ写さない）。`Path`の区間の制御点の分岐の唯一の箇所が`Path.resolveSegmentControls`（`#segmentControls`はこれを呼ぶだけ）になったこと。依存方向の(1)に`edit/PathVertexEditor → shapes/PathVertexRules`、(2)に`PathVertexRules → Path`・`Line`・`PathJoinRules`・`ShapeGeometry`、(3)に`PathVertexEditor`（13ファイル。`core/NudgeTargetRules`）。`core/`内の規則の列に`VertexEditRules`（`InputModes`の値だけをimport）。`InputTracker`の補助（`InputAssist`）の項目に`insertVertexAt`・`hasRemovableVertices`・`removeSelectedVertices`。
*   **2章 `path`**：頂点の追加・削除の規則（上の2つの表の要約。足した点は角でない・`smooth`は曲線のまま・`bezier`は分けても同じ形・直線／矩形／今の曲線はパスになる・消すときのつなぐ区間の種類の規則・一段ずつ形を落とす・閉じたパスが2点になったときの区間の選び方・今の曲線は直線になる・`fillColor`は値を保つ・作業データの版は4のまま）。「作られるのは次のとき」の列に(6)点の追加・削除を足す。「`Path`へ頂点の追加・削除を足すときは`corners`も…」は実装した旨に直す。2章「アイテム」「フォルダ」の「`deleteShapes`は製品コードから呼ばれない」を「点の削除で図形ごと消えるとき`edit/PathVertexEditor`が呼ぶ（フォルダは空になっても残る）」に直す。
*   **3章3.（入力監視）**：キャンバスで購読するイベントに`dblclick`（`handleDoubleClick`）。ダブルクリックの流れ（`#classifyPoint` → `VertexEditRules.resolveDoubleClickInsertTarget` → `InputAssist.insertVertexAt`）と`#lastClickSuppressed`。「削除の受理」の項に、`deleteSelection()`は変えず、`Delete`/`Backspace`の実体`deleteLastLinePointOrSelection()`と削除ボタンが`deleteSelectionOrVertices()`を通り、頂点の選択では点の削除（`InputAssist.removeSelectedVertices`）へ振り分けること、削除ボタンの見た目は`canDeleteSelectionOrVertices()`、切り取りは今どおり`deleteSelection()`で頂点の選択では何もしないこと。
*   **3章6.（履歴）**：「記録する操作と時点」に点の追加（`PathVertexEditor.insertAt`。`replaceShape`・`setSelectedVertices`の前後。鍵なし）と点の削除（`PathVertexEditor.removeSelectedVertices`。`clearSelectedVertices`・`replaceShape`×k・`deleteShapes`の前後。鍵なし・複数の図形でも1件）。削除の項の「`model.deleteShapes`は製品コードから呼ばれない」を直す。
*   **3章18.（頂点の選択）**：「`Delete`・`Backspace`（`deleteSelection`）：何もしない」を、頂点の選択で選んだ点を消す（Phase 12-01で発注者の決定(4)・(8)を変えた）へ直す。切り取りは今のまま何もしない。モジュールの分担に`VertexEditRules`・`PathVertexEditor`・`PathVertexRules`。「やらないこと」の「頂点の追加・削除」を消す。
*   **3章 新しい節「29. 頂点の追加と削除」**（Phase 12-01）：流れ（表示・入力）、モジュールの分担、発注者の決定（REQの2026-11-26の5項目）、計画で決めたこと（`5. 懸念事項`の項目）、確認の状況（`node --test`で確かめられない＝`dblclick`の購読・`main.js`の配線・ブラウザのダブルクリックの判定・カーソル）。
*   **4章の一覧と`_doc/arch/`**：新規`66_VertexEditRules.md`（一覧の表に足す）。更新`02_main.md`（`// 7.16.`の生成と注入・`InputAssist`の3項目・`syncDeleteButtonState`と削除ボタンの`click`・行数）、`03_VectorModel.md`（`deleteShapes`の使う側・`replaceShape`の`select: true`を頂点の選択から使うこと）、`06_InputTracker.md`（公開メソッドに`handleDoubleClick`・`deleteSelectionOrVertices`・`canDeleteSelectionOrVertices`、`InputAssist`の3項目、`#lastClickSuppressed`、`deleteLastLinePointOrSelection`の振り分け、行数）、`07_KeyboardShortcuts.md`（`deleteSelection`の注入の実体の意味）、`12_shapes.md`（`Path`の`resolveSegmentControls`・`SMOOTH_SEGMENT_SAMPLE_COUNT`、`PathJoinRules.chainSourceOf`のexport、`PathVertexRules`の節）、`14_edit.md`（`PathVertexEditor`の節）、`16_test.md`（新しいテストファイルと件数）、`32_InputModes.md`（使う側に`VertexEditRules`）、`41_NudgeTargetRules.md`（使う側に`PathVertexEditor`）。`main.js`・`InputTracker.js`の行数、テストの件数は実測して直す。

## 3. タスクリスト
※ 全タスク共通：(a) コード修正の後、JSDocの記載漏れ（新しいファイルの先頭の3行以内の責務、関数・メソッド・引数・戻り値・typedef、意味が変わった既存のJSDoc・importの記述・「`model`は…だけを使う」の記述）が無いことを確認する。(b) リポジトリのルートで`node --test`が全件合格することを確認する（既存のテストファイルは変更しない。値を変えざるを得ないテストが出たら中断して質問する）。(c) 本RESの「4. 詳細作業内容」の担当の欄を書き、タスクを`[x]`にする。(d) 開発資料に影響が出たら資料本体は直さず『開発資料の更新予定』欄へ追記する。(e) 既存のファイルは書き換える前に行末（CRLF／LF）を実測して保ち、新規のファイルは同じフォルダの既存のファイルに合わせる。(f) 対象ファイル以外は変更しない。

*   [ ] タスク1: 区間の制御点の共有と、区間の上の最も近い位置・ベジェの分割
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` :（更新）
        *   `./js/shapes/PathJoinRules.js` :（更新）
        *   `./js/shapes/PathVertexRules.js` :（新規）
        *   `./test/shapes/PathVertexRules.locate.test.js` :（新規）
    *   **作業内容** :
        *   `Path.js`：「要件2」のとおり、`#segmentControls()`の本体をexportする関数`resolveSegmentControls(data)`へ移し、`#segmentControls()`は`return resolveSegmentControls(this);`だけにする。`SMOOTH_SEGMENT_SAMPLE_COUNT`に`export`を付ける。どちらもJSDocに「唯一の箇所」「使う側（`Path`自身と`PathVertexRules`）」を書く。ほかのメソッド・ファイル先頭の責務は変えない。
        *   `PathJoinRules.js`：`chainSourceOf`に`export`を付け、JSDocの「非公開」を「`PathVertexRules`からも使う（今の曲線を区間として読む）」へ直す。中身は変えない。
        *   `PathVertexRules.js`（新規）：先頭に3行以内の責務（線・パスの頂点の追加と削除の規則＝輪郭の元への読み替え・区間の上の最も近い位置・曲がり方を持つ区間の分割・点を足した／消した新しい図形の組み立てを、状態を持たない関数として提供する）。このタスクではimportと、typedef`OutlineSource`・`SegmentLocation`・`CubicSplit`、定数`NEAREST_REFINE_ITERATIONS`（40）、`outlineSourceOf`・`findNearestSegmentLocation`・`splitCubicBezier`をJSDoc付きで作る（「要件2」の仕様どおり）。
        *   テスト（`PathVertexRules.locate.test.js`）：`resolveSegmentControls`が`toDrawElement`の`cubic`の制御点と同じ値（`smooth`・`bezier`・角あり・閉じたパス）・直線の区間は`null`。`outlineSourceOf`（直線・矩形（回した矩形を含む）・今の曲線＝`chainSourceOf`と同じ値・パスはそのまま・円と弧は`null`・引数を書き換えない）。`findNearestSegmentLocation`：直線の区間（途中・端で`t`が0/1に収まる・長さ0の区間）、`smooth`の区間（点が曲線の上に乗る＝`cubicBezierPoint`で`t`から求め直した値と一致・距離が折れ線の近似の距離）、`bezier`の区間、閉じたパスの最後の区間（`segmentIndex === n − 1`）、複数の区間で最も近いものを選ぶ・同じ距離なら番号の小さい区間、許容幅の外は`null`、許容幅ちょうどは当たり、点が1つの元は`null`。`splitCubicBezier`：前半・後半を多数の`t`で評価した点が元の曲線の点と許容誤差（1e-9）で一致・`t`の点が`cubicBezierPoint`と一致・引数を書き換えない。

*   [ ] タスク2: 点を足した図形の組み立て
    *   **対象ファイル** :
        *   `./js/shapes/PathVertexRules.js` :（更新）
        *   `./test/shapes/PathVertexRules.insert.test.js` :（新規）
    *   **作業内容** :
        *   `planVertexInsertion(shape, point, tolerance)`と、その戻り値のtypedef`VertexInsertionPlan`（`{ shape: Path, insertedIndex: number }`）をJSDoc付きで足す（「要件2」の仕様と「点を足したら何になるか」の表のとおり）。
        *   テスト（表の行ごと）：パスの`line`・`bezier`・`smooth`の区間（開いた・閉じた・閉じたパスの最後の区間＝足した点が末尾）、直線、矩形（回した矩形を含む。点5つの閉じたパス・区間`line`×5）、今の曲線（点3つの開いたパス・`bezier`×2）、円・弧は`null`、許容幅の外は`null`、`t`が0か1（端の外側・頂点の上）は`null`。それぞれ点・区間・角（足した点は`false`、ほかの角は元のまま）・`closed`・スタイル3つ（開いたパスの`fillColor`の値を含む）・`id`が`null`・`insertedIndex`。形：直線の区間は足した点が線分の上（形が変わらない）、`bezier`・今の曲線は分けた後の2つの区間を多数の`t`で評価した点が元の曲線と一致、`smooth`は足した点が元の曲線の上に乗り、足した区間と前後の区間以外の区間の制御点（`resolveSegmentControls`）が元と同じ。引数の図形・`toJSON()`の値を書き換えない。
        *   テスト（「曲線に」が変わらないこと）：`planSegmentKindSwitch(…, SegmentKindSwitch.TO_CURVE)`を直線・開いたパス・閉じたパスの終点→始点の区間に当てた結果（点の位置＝中点・区間の種類・角・`vertexIndexMap`）が今の値（リテラルで書いた期待値）のままであること。

*   [ ] タスク3: 点を消した図形の組み立て
    *   **対象ファイル** :
        *   `./js/shapes/PathVertexRules.js` :（更新）
        *   `./test/shapes/PathVertexRules.remove.test.js` :（新規）
    *   **作業内容** :
        *   `planVertexRemoval(targets)`と、typedef`VertexTarget`（`{ shape, vertexIndex }`。`PathCornerRules.CornerTarget`と同じ形である旨をJSDocに書く）・`VertexRemovalPlanItem`（`{ targetId, shape: Path|Line|null }`）、つなぐ区間の種類を決める非公開の関数（`run`の規則の唯一の箇所）をJSDoc付きで足す（「要件3」の仕様と「点を消したら何になるか」の表のとおり）。
        *   テスト（表の行ごと）：開いたパスの途中の点（1つ・続いた複数・離れた複数）、始点・終点（先頭・末尾から続いた複数を含む）、つなぐ区間の種類の組み合わせ（`line`+`line`→`line`、`bezier`+`bezier`→前の`control1`と後の`control2`の`bezier`、3つ続いた`bezier`→最初の`control1`と最後の`control2`、`smooth`を含む→`smooth`、`line`+`bezier`→`smooth`）、閉じたパス（残り3点以上・最後の点と始点をまたぐ消し方・残り2点で触れていない区間がある（`a→b`・折り返しの`b→a`）／無い・残り1点以下）、開いたパスの残り1点以下、直線（1点・2点）、矩形（1点＝三角形・隣り合う2点・向かい合う2点・3点）、今の曲線（始点・制御点・終点のそれぞれ＝`Line`・2点以上＝`null`）、円・弧の組・範囲外や整数でない番号・同じ点の重複は無視、複数の図形の結果が`targets`に最初に現れた順、残った点の角・ほかの区間の種類・スタイル3つ（閉じたパスが開いても`fillColor`の値）・新しい図形の`id`が`null`、引数を書き換えない・結果が引数と配列・点を共有しない。

*   [ ] タスク4: ダブルクリックと削除の入口の規則
    *   **対象ファイル** :
        *   `./js/core/VertexEditRules.js` :（新規）
        *   `./test/core/VertexEditRules.test.js` :（新規）
    *   **作業内容** :
        *   先頭に3行以内の責務（頂点の選択のダブルクリックで点を足す相手の決め方と、削除の入口（`Delete`・`Backspace`・削除ボタン）を点の削除と図形の削除のどちらへ振り分けるかを、状態を持たない関数と値として提供する。importは`InputModes`のみ）。値`DELETE_ROUTE`（凍結）・`resolveDeleteRoute(mode)`・`resolveDoubleClickInsertTarget({ mode, state, isDragging, clickSuppressed, hit })`をJSDoc付きで作る（「要件1」「要件3」の仕様どおり。`hit`は`PointHitRules`のtypedef`PointHit`の形で、`handle`・`bodyId`だけを読む）。
        *   テスト：`resolveDeleteRoute`（`VERTEX`→`VERTICES`、`SELECT`・`CREATE`・`PAN`・未知の値→`ITEMS`）、`DELETE_ROUTE`が凍結されていること。`resolveDoubleClickInsertTarget`（本体に当たり条件がそろえばそのid、モードが`VERTEX`でない（4モード）・`IDLE`でない（`DRAWING`・`DRAGGING_HANDLE`・`MARQUEE_SELECTING`等）・ドラッグ中・直前のクリックが抑止された・頂点のハンドルの上（`bodyId`があっても）・空白（両方`null`）・`hit`が`null`のときは`null`）。削除ボタンの押せる・押せないは、規則のファイルに照会の選び分けが無いため、ここでは上の`resolveDeleteRoute`のテストで足りる（`InputTracker.canDeleteSelectionOrVertices`と同じ式を写した小さな関数を作って確かめることはしない）。押せる・押せないの実際の値はタスク5の`canRemoveSelectedVertices`のテストで確かめる。

*   [ ] タスク5: 点の追加・削除の編集操作
    *   **対象ファイル** :
        *   `./js/edit/PathVertexEditor.js` :（新規）
        *   `./test/edit/PathVertexEditor.test.js` :（新規）
        *   `./test/edit/PathVertexEditor.items.test.js` :（新規）
    *   **作業内容** :
        *   先頭に3行以内の責務（頂点の選択での点の追加（ダブルクリックした区間の上）と、選んだ点の削除を、規則（`shapes/PathVertexRules`）でそれぞれ1件の編集操作として行う手順と、削除できるかの照会。DOM・操作モードの解釈・図形種別の判定・ハンドル名の形式を持たない）。クラスのJSDocに手順・依存の制約（importは`core/NudgeTargetRules`の`resolveNudgeTarget`と`shapes/PathVertexRules`の`planVertexInsertion`・`planVertexRemoval`のみ。`model`は`getEditableShapes`・`getShapes`・`getSelectedIds`・`getSelectedVertices`・`replaceShape`・`setSelectedVertices`・`clearSelectedVertices`・`deleteShapes`だけを使う。`editRecorder`は`beginEdit`・`commitEdit`だけ。`try/catch`・再描画の呼び出しを持たない。前提＝ドラッグ中でないこと・頂点の選択であることは呼び出し側の`InputTracker`が判定する）を書く。
        *   `constructor({ model, editRecorder, getMode })`・`insertAt(shapeId, point, tolerance)`・`canRemoveSelectedVertices()`・`removeSelectedVertices()`・非公開`#collectTargets()`を「要件1」「要件3」の手順どおりにJSDoc付きで作る。
        *   `insertAt`は頂点の選択から`replaceShape(…, { keepId: true, select: true })`を呼ぶ。`VectorModel.replaceShape`のJSDocの「`select`が真のときは呼び出し側が選択モードであること」という前提は古い（選択集合の不変条件は「選択モード・頂点の選択モード以外では空」で、頂点の選択からの`select: true`はこれを崩さない）。「5. 懸念事項」のとおり`VectorModel.js`は変えずに、この呼び方のまま進める。
        *   テスト（`PathVertexEditor.test.js`。実物の`VectorModel`・図形クラスと、呼び出しを記録する偽の記録先）：追加＝`beginEdit`→`commitEdit`が1組・その図形だけが選ばれ足した点だけが選ばれる（ハンドル名が新しい図形の`insertedIndex`の名前）・選んでいない図形でも足せる（前の選択・頂点の選択が置き換わる）・`id`が同じ・塗りの内側／許容幅の外／円・弧／無いid／隠れた図形／ロックされた図形（上のフォルダから受け継いだものを含む）では`false`で記録先・モデルに触れない（通知0回）。削除＝`canRemoveSelectedVertices`（頂点の選択で点あり＝真・点なし＝偽・選択（`V`）のモード＝偽）・まとめて消す（複数の図形の点・図形ごと消える図形と残る図形の混在）で記録先が1組・頂点の選択が空・残った図形は選ばれたまま・消えた図形は選択から外れる・`id`が同じ・計画が空なら`false`で触れない・ロックした図形の点は頂点の選択に入らず対象にならない。
        *   テスト（`PathVertexEditor.items.test.js`。実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`）：追加・削除がそれぞれ取り消し1回で戻り（図形の作業データ・選択が戻り、頂点の選択は外れる）やり直しで戻る、複数の図形の点をまとめて消しても1回で戻る、名前・表示・ロック・一覧での位置・フォルダの所属が引き継がれる、図形ごと消えて空になったフォルダが残る（取り消しで図形が戻る）、何も変わらないときは履歴に入らない、作業データ（`DocumentSerializer`の往復）で結果の`path`・`line`が保たれる・`version`が4のまま。

*   [ ] タスク6: 入力（ダブルクリックの受け付けと削除の入口の振り分け）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `import`に`core/VertexEditRules.js`の`DELETE_ROUTE`・`resolveDeleteRoute`・`resolveDoubleClickInsertTarget`を足す。
        *   typedef`InputAssist`と`NO_INPUT_ASSIST`・コンストラクタの補助の組み立てに`insertVertexAt(shapeId, point, tolerance) → boolean`（既定は`false`）・`hasRemovableVertices() → boolean`（既定は`false`）・`removeSelectedVertices() → boolean`（既定は`false`）を足す（今の項目と同じ「関数でなければ既定へ置き換える」形）。
        *   非公開フィールド`#lastClickSuppressed`（初期値`false`）を足し、`handleClick`の冒頭を「`consumeSuppressedClick()`の結果を`#lastClickSuppressed`へ入れ、真なら`return`」にする（ほかの処理は変えない）。
        *   コンストラクタの購読に`this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));`を足し、公開のイベントハンドラ`handleDoubleClick(event)`を「要件1」のとおり作る（`#classifyPoint`の結果を規則へ渡し、idが返れば`insertVertexAt(shapeId, point, #getWorldHitTolerance())`を呼ぶだけ）。
        *   公開メソッド`deleteSelectionOrVertices()`・`canDeleteSelectionOrVertices()`を「要件3」のとおり足し、`deleteLastLinePointOrSelection()`を`this.removeLastLinePoint() || this.deleteSelectionOrVertices()`にする。`deleteSelection()`の中身・JSDocの受理条件は変えない（JSDocの「唯一の削除経路」の説明だけ、頂点の選択の点の削除が別の経路であることを足す）。
        *   クラスのJSDoc（入力の補助の項目の列挙・削除の経路・区切りの説明）とコンストラクタの`@param inputAssist`の項目の列挙を直す。図形種別の分岐・計算を持ち込まない。行数を実測して『開発資料の更新予定』へ書く。
        *   テスト：このタスクでは足さない（判定はタスク4の規則のテスト、手順はタスク5のテストで確かめている。`InputTracker`はDOMに触れるため`node --test`の対象外。既存の全件合格だけを確かめる）。

*   [ ] タスク7: 配線（`main.js`）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
        *   `./js/core/KeyboardShortcuts.js` :（更新。JSDocの1か所のみ）
    *   **作業内容** :
        *   `main.js`：`import { PathVertexEditor } from './edit/PathVertexEditor.js';`を足す。`// 7.15.`の後（`// 8.`の前）に`// 7.16. 頂点の追加・削除配線`を立て、`const pathVertexEditor = new PathVertexEditor({ model, editRecorder: historyManager, getMode: () => inputTracker.getMode() });`を置く（判定・計算を書かない旨の説明コメントを付ける）。`// 4.`の`InputTracker`の第7引数に`insertVertexAt: (shapeId, point, tolerance) => pathVertexEditor.insertAt(shapeId, point, tolerance)`・`hasRemovableVertices: () => pathVertexEditor.canRemoveSelectedVertices()`・`removeSelectedVertices: () => pathVertexEditor.removeSelectedVertices()`を足す（`pathVertexEditor`は後で宣言されるが、呼ばれるのは起動完了後の入力・同期だけである旨のコメントを今の`groupEditor`と同じ形で付ける）。`// 6.`の`syncDeleteButtonState`を`deleteSelectionBtn.disabled = !inputTracker.canDeleteSelectionOrVertices();`にし、JSDoc（頂点の選択では選んだ点があるときだけ押せる。判定は`VertexEditRules`・照会は`InputTracker`で、ここにモードの分岐を書かない）を直す。削除ボタンの`click`を`inputTracker.deleteSelectionOrVertices()`にし、近くのコメント（切り取りは`deleteSelection()`のまま等）を直す。`// 7.5.`の切り取りの注入（`deleteSelection: () => inputTracker.deleteSelection()`）と`// 8.`の`deleteSelection: () => inputTracker.deleteLastLinePointOrSelection()`は変えない（コメントだけ、頂点の選択で点を消す振り分けがあることを足す）。行数を実測して『開発資料の更新予定』へ書く。
        *   `KeyboardShortcuts.js`：typedefの`deleteSelection`の説明（55行目付近「選択中の変えられる図形と選んでいるフォルダを削除する」）に「（頂点の選択では選んだ点を消す。振り分けは注入された実体の側）」の趣旨を足す。対応表・判定・ほかの行は変えない。
        *   テスト：このタスクでは足さない（`main.js`は`node --test`の対象外。既存の全件合格だけを確かめる）。

*   [ ] タスク8: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認し、1章（構成図・「存在しないもの」・「フォルダ分割の方針」・依存方向の列挙）、2章（`path`の頂点の追加・削除の規則・`deleteShapes`の記述）、3章（3.入力監視・6.履歴・18.頂点の選択の`Delete`の記述と発注者の決定(4)(8)の扱い、新しい節29.）、4章の一覧（`66_VertexEditRules.md`）へ反映する。書く内容は実コードで確かめる。「頂点の選択で`Delete`は何もしない」「頂点の削除は存在しない」という古い記述を残さない。書き換える前に行末を実測して保つ。

*   [ ] タスク9: 開発資料の反映（`_doc/arch/`）
    *   **対象ファイル** :
        *   `./_doc/arch/`の`02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`12_shapes.md`・`14_edit.md`・`16_test.md`・`32_InputModes.md`・`41_NudgeTargetRules.md` :（更新）
        *   `./_doc/arch/66_VertexEditRules.md` :（新規）
    *   **作業内容** :
        *   ※ 実装AIによる開発資料の書き換えは原則禁止だが、この最終タスクのみ明示的な例外とする。
        *   『開発資料の更新予定』を確認して反映する。`main.js`・`InputTracker.js`の行数（`02`・`06`）とテストの件数（`16`）は`wc -l`・`node --test`で実測して直す。書き換える前に各ファイルの行末（CRLF／LF）を実測し、保つ（ファイルごとに混在している）。新規の`66_VertexEditRules.md`は近い番号の既存のファイルの書き方・行末に合わせる。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 区間の制御点の共有と、区間の上の最も近い位置・ベジェの分割
*   **作業内容** :
    *   （未記入）

### タスク2: 点を足した図形の組み立て
*   **作業内容** :
    *   （未記入）

### タスク3: 点を消した図形の組み立て
*   **作業内容** :
    *   （未記入）

### タスク4: ダブルクリックと削除の入口の規則
*   **作業内容** :
    *   （未記入）

### タスク5: 点の追加・削除の編集操作
*   **作業内容** :
    *   （未記入）

### タスク6: 入力（ダブルクリックの受け付けと削除の入口の振り分け）
*   **作業内容** :
    *   （未記入）

### タスク7: 配線（`main.js`）
*   **作業内容** :
    *   （未記入）

### タスク8: 開発資料の反映（`PROJECT_ARCHITECTURE.md`）
*   **作業内容** :
    *   （未記入）

### タスク9: 開発資料の反映（`_doc/arch/`）
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント
*   **計画で決めたこと（REQの文言から一意に決まらなかった点。発注者の確認を推奨）**：
    *   閉じたパスが点2つになり、消した点に触れていない区間が無いとき（例：矩形の向かい合う2点を消す）の「つないだ区間1つ」は、番号の小さい方の点`a`から大きい方の点`b`への向き（区間`a`〜`b−1`）の`run`をつなぐ。
    *   残った点2つの開いた線は`path`（開いたパス）で表し、`line`にはしない（残す区間が`bezier`・`smooth`のときも形を保つため。一覧の名前は元のまま）。今の曲線の点を消したときだけは、REQのとおり`Line`（直線）にする。
    *   `Ctrl`・`Shift`・`Alt`を押したままのダブルクリックでも点を足す（修飾キーを見ない）。`Ctrl`のダブルクリックでは1回目・2回目のクリックで図形の選択の追加・解除が起きるが、最後は足した図形だけが選ばれる。
    *   2回目のクリックが閾値を超えたドラッグ（範囲選択・頂点のドラッグ）として抑止されたときに続くダブルクリックでは、点を足さない（`#lastClickSuppressed`）。
    *   最も近い位置が頂点と同じ（`t`が0か1。開いた線の端の外側など）ときは足さない（同じ位置の点が2つになるのを防ぐ。選ばれている図形では頂点のハンドルの当たりが先に効くため、ふつうは起きない）。
    *   点を足した直後のカーソルの形は、次にマウスを動かすまで前のまま（`pointer`。足した点の上の`move`にはならない）。
*   **当たりの測り方の小さな違い**：点を足すかの許容幅は折れ線の近似（区間ごとに100の小区間）の距離で測る。パス・直線・矩形では各図形の`hitTest`と同じ測り方だが、今の曲線（`curve`）の`hitTest`は101個の点までの距離で測るため、許容幅のちょうど境目では「クリックでは当たるのに足さない（またはその逆）」がごくわずかに起き得る（許容）。
*   **`smooth`の区間に足したときの形**：点を通る曲線の式の性質で、足した区間と前後の`smooth`の区間（同じ曲線の連なりの隣）の曲がり方が少し変わる（REQで許容）。打った点の間隔が大きく違うと膨らむことがある（今の式の性質）。テストプレイの確認項目2で見てほしい。
*   **資料の決定の変更**：3章18.の発注者の決定(4)「`A`で`Delete`・`Backspace`は何もしない」と(8)「頂点の選択のとき削除ボタンは押せる見た目のまま」は、REQの発注者の決定（2026-11-26）で変わる。資料の反映（タスク8）で、変わった旨と日付を残す。
*   **`deleteShapes`の再利用**：今は「製品コードから呼ばれない（既存のテストが使うため残す）」とされている`VectorModel.deleteShapes`を、点の削除で図形ごと消えるときに使う（「フォルダは空になっても残す」がREQの要件どおりで、`rearrangeItems`＋`RemovalRules`は空になったフォルダを消すため使わない）。
*   **`VectorModel.replaceShape`のJSDocの前提**：「`select`が真のときは呼び出し側が選択モードであること」と書かれているが、選択集合の不変条件は「選択モード・頂点の選択モード以外では空」で、頂点の選択からの`select: true`は不変条件を崩さない。`VectorModel.js`は今回の変更対象ではないため、JSDocは直さず資料（`03_VectorModel.md`）に正しい記述を残す。
*   **削除ボタンの`title`**：`index.html`の`#selection-delete`の`title`（「選択中の図形を削除 (Delete / Backspace)」）は、頂点の選択で点を消すときも変えない（`index.html`は変更しない）。
*   **`PathVertexEditor.#collectTargets`**：`PathCornerEditor.#collectTargets`と同じ手順の写し（どちらも非公開で共有できない。共有するには`PathCornerEditor`を変えることになるため今回はしない）。
*   **既存のテストの値**：変えるものは無い見込み（`Path`の`#segmentControls`の移し替えは結果が同じ）。
*   **確認の状況**：`dblclick`の購読・`handleDoubleClick`・削除の入口の振り分け（`InputTracker`）と`main.js`の配線、ブラウザのダブルクリックの判定（間隔・位置）、カーソルの形、削除ボタンの見た目の切り替わりは`node --test`で確かめられない（テストプレイで確かめる範囲）。

### テストプレイの確認項目（発注者がブラウザで確かめる手順）
0.  **準備**：画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。直線（直線のツールで2点）・矩形（塗りあり）・直線のツールで描いた折れ線（3点以上）・曲線のツールで描いた曲線（3点以上）・閉じたパス（直線のツールで始点をクリックして閉じたもの）を描く。最後に頂点の選択（`A`）にする。
1.  **直線の区間に足す**：頂点の選択（`A`）で、直線・折れ線・矩形の辺の線の上（点から離れた所）をダブルクリックすると、そこに点が増え、その点だけが選ばれた（青い塗りの）状態になる。形は変わらない。そのまま点を押してドラッグ、または矢印キーで動かせる。選んでいない図形でも足せる（1回目のクリックでその図形が選ばれ、ダブルクリックで点が増える）。矩形は点が5つになる（以後は頂点を1つずつ動かせる形。一覧の名前は「矩形 n」のまま）。
    *   注意：すでに出ている点の近く（画面上で約5px以内）をダブルクリックすると、その点が選ばれるだけで点は増えない。
    *   注意：点を足した直後のマウスの形は、マウスを動かすまで指の形のまま。
2.  **曲線に足す**：曲線のツールで描いた曲線の上をダブルクリックすると、曲線の上に点が増える。形はほとんど変わらない（足した所の前後が少しだけ変わることがある）。足した点を動かすとなめらかにつながり直り、オプションバーの「角」も効く。
3.  **足さない所**：塗った矩形の内側・空白・点の上・円・弧をダブルクリックしても点は増えない（クリックとしてのふるまいだけが起きる：内側・円・弧はその図形が選ばれ、空白は選択が外れ、点の上はその点が選ばれる）。
4.  **消す**：点を選んで`Delete`（または`Backspace`、または🗑）を押すと点が消え、前後がつながる（前後が直線なら直線、曲線が混ざれば曲線でつながる）。複数の点（`Ctrl`+クリック・範囲選択）をまとめて消せる。別の図形の点も一緒に消すには、`Ctrl`+クリックで2つ目の図形の線を押して図形を選択に足し（点は出る）、`Ctrl`+クリックか範囲選択で両方の点を選んでから押す。図形を選んでいても点を1つも選んでいないとき、🗑は押せない見た目になる。選択（`V`）では今までどおり🗑・`Delete`で図形が消える。頂点の選択で`Ctrl`+`X`を押しても何も起きない（今のまま）。
5.  **減らしすぎ**：塗った矩形の角の点を1つ消すと三角形（塗りあり）になる。もう1つ消すと開いた線（点2つ。塗りは描かれない）になる。さらに1つ消すと図形ごと消える（一覧からも消える。フォルダに入れていた場合、フォルダは空のまま残る）。直線の点を1つ消すと図形ごと消える。今の曲線（作業データやJSを開いてできた曲線）の点を1つ消すと直線になる。
    *   塗りの色が保たれていることの確かめ方：三角形から開いた線（点2つ）にした後、その線の上をダブルクリックして点を足し（点3つ）、その線を選んだまま`J`を押すと閉じて、元の塗りの色で塗られる（点2つのままでは`J`で閉じない。今のふるまい）。
6.  **取り消し**：点の追加・削除は、それぞれ`Ctrl`+`Z` 1回で元に戻り、`Ctrl`+`Y`（または`Ctrl`+`Shift`+`Z`）で戻せる。複数の図形の点をまとめて消したときも1回で戻る。取り消した後は点の選択が外れる（図形は選ばれたまま。今の「角」「曲線に」の取り消しと同じ）。
7.  **ロック・非表示**：一覧の鍵でロックした図形・目で隠した図形の線の上をダブルクリックしても点は増えない（ロックした図形はクリックが素通りになり、後ろの図形か空白の扱いになる）。
8.  **保存**：足した・消した形が、ページを開き直しても（自動保存）、作業データの出力→開くでも保たれる。書き出したJSを確認用ページ（`sprite-check.html`）で見ても同じ形。
9.  **ほかが今までどおり**：「曲線に」「直線に」「角」、選択ツール（`V`）での削除（🗑・`Delete`）と切り取り、頂点のドラッグ・矢印キー・範囲選択、一覧の名前のダブルクリックでの名前の編集が今までどおり動く。線を引いている途中の`Backspace`/`Delete`は今までどおり最後の点を消す。
