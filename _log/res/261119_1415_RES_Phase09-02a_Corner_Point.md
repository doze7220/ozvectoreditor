# RES: 作業計画・作業レポート (Phase 09-02a) : 点の滑らかさ（オプションバーの「角」のチェックボックス）
* 参照元REQ: `./_log/req/261119_1323_REQ_Phase09-02a_Corner_Point.md`

## 1. 作業目的
Phase 09-01a・09-01bでパスに曲線の区間（`'smooth'`）が入り、曲線の連なりは打った点をすべてなめらかに通る1本の曲線になった。曲線の区間どうしがつながった点も自動でなめらかになる。今は、曲線の連なりの途中の点で角を立てる方法がない。

本作業（Phase 09-02の前半（a））では、**曲線の連なりの途中の点を、なめらかにつなぐか角を立てるかを、点ごとに選べるようにする**（髪の毛の先端のような、曲線どうしが尖って出会う形を作るため）。操作は、頂点の選択（`A`）で点を選び、オプションバーの右端の「角」のチェックボックスで行う。

最上位の要件（REQのとおり。満たさない変更は失敗）：
* `node --test`が全件通る（作業開始前は tests 1779 / suites 281）。**既存のテストの期待値は変えない**（本計画では書き換える既存のケースは無い見込み。出た場合はタスクの詳細作業内容にケースと理由を列挙する）。
* 角の点が1つもないパスの作業データ（`toJSON()`の値。キー・キーの順を含む）・描画・当たり判定・書き出しの結果を変えない。
* 作業データ形式の版は2、書き出し形式の版は3のまま。
* 直線の区間と曲線の区間のつなぎ目は、今までどおり常に角が立つ（なめらかにする方法は作らない）。
* 改名・整形・「不要に見えるコードの削除」をしない。既存の公開関数名・メソッド名・フィールド名・DOMのid・クラス名を変えない。`KeyboardShortcuts.js`の対応表を変えない。共通メソッド契約（18メソッド）を増やさない。

用語はREQのとおり（**角の点**＝両側とも曲線の区間の点で角を立てると決めた点、**なめらかな点**＝両側とも曲線の区間の点で角を立てていない点、**角を操作できる点**＝両側とも曲線の区間の点）。本計画では加えて、片側でも直線の区間の、パスの点を**直線の角の点**（実際に角が立っていて操作できない点）、開いたパスの端の点・パス以外の図形の点を**角の考えがない点**と呼ぶ。

## 2. アーキテクチャ設計

### 全体の方針
* **3層＋形の式**：形の決め方の式（`shapes/ShapeGeometry`）に「角の点で連なりが切れる」を足し、角の情報は図形（`Path`）だけが持つ。判定と組み立ては`shapes/`の新しい規則（`PathCornerRules`）、1件の編集操作は`edit/`の新しい手順（`PathCornerEditor`）、DOMは`palette/`の新しいUI部品（`OptionBarCornerGroup`）。`main.js`は生成・注入・同期とドラッグ中の受理判定だけ（重なり順（14.）・整列・分布（21.）と同じ3層）。
* **変えないもの**：`core/`のコード（`VectorModel`・`InputTracker`・`CanvasManager`・`KeyboardShortcuts`・`HistoryManager`・`NudgeTargetRules`ほか。`FocusKeyYieldRules`はJSDocの1文だけ。要件J）、`io/`のコード（`DocumentSerializer`はJSDocの1文だけ。要件H）、`check/`、`edit/`の既存のファイル、`palette/`の既存のファイル、`asset/`、`wiring/`、図形クラスの`Line`・`Curve`・`Rect`・`Ellipse`、`ShapeFactory`、`EndpointSnapRules`。
* **同期**：再描画・オプションバーの同期は既存の`model.onChange`の経路だけ。機能専用の経路を足さない。
* **依存方向の追加（2つ。どちらも下向きで循環しない）**：(1)`edit/PathCornerEditor → shapes/PathCornerRules`（`edit/ → shapes/`の例外の列に1つ足す）、(3)`edit/PathCornerEditor → core/NudgeTargetRules`（`edit/ → core/`の例外の列に1つ足す。`PositionInputEditor`と同じ使い方）。`shapes/`内は`PathCornerRules → Path`・`PathJoinRules → Path`（既存のimportに関数を1つ足すだけ）。`PathCornerRules`は`PathJoinRules`・`EndpointSnapRules`をimportしない（循環しない）。

### 要件A: 形の決め方の式に角の点を足す（`js/shapes/ShapeGeometry.js`。既存へ変更）
* `computeSmoothSegmentControls(points, smoothFlags, closed, cornerFlags = [])`：省ける第4引数`cornerFlags`（頂点ごとの「角の点か」の真偽値の配列。要素数`n`。`=== true`の要素だけを角とみなす。省く・短い・`true`以外の値は角でない）。
* 式の変更は2か所だけ（区間`i`、`a = P[i]`、`b = P[(i+1) % n]`）：
  * `hasPrev`の条件に「`cornerFlags[i] === true`でない」を足す（区間の始点が角の点なら前の区間を見ず、仮の点`2a − b`を使う）。
  * `hasNext`の条件に「`cornerFlags[(i + 1) % n] === true`でない」を足す（区間の終点が角の点なら次の区間を見ず、仮の点`2b − a`を使う）。
* 性質（JSDocに書く）：第4引数を省いた結果は今と同じ。制御点は頂点の座標の1次式のまま。角の情報が効くのは両側とも曲線の区間の点だけ（直線の区間との境目・開いたパスの端はもともと仮の点を使うため）。角の点で形が変わるのは、その点の両隣の区間だけ（区間`i`の`Q0`・`Q3`の選び方が見るのは`P[i]`と`P[i+1]`の角の情報だけのため）。閉じたパスで全区間が曲線・全点が角なら区間ごとに直線と同じ形。引数を書き換えない。
* ファイル先頭の責務定義は変えない（「形の決め方（制御点）」に含まれる）。

### 要件B: パスが角の情報を持つ（`js/shapes/Path.js`。既存へ変更）
* **持ち方（データ）の決定**：パスの図形データに、頂点と同じ並びの真偽値の配列`corners`（`corners[i]`＝`points[i]`が角の点か）を、**角の点が1つ以上あるときだけ**持たせる。キーの位置は`segments`の直後・`strokeColor`の前（`fillColor`は最後のキーのまま）。
  * 形：`{ type: 'path', id, points, closed, segments, corners?, strokeColor, strokeWidth, fillColor }`。
  * **理由**：(1) 頂点の側（`points[i].corner`）に持つと、`setVertex`が頂点のオブジェクトを`{ x, y }`で置き換えるため失われ、`PathJoinRules`・`toDrawElement`等の頂点の写し（`x`・`y`だけを写す）でも失われる。(2) 区間の要素の側に持つと、1つの点の情報が前後2つの区間のどちらに属すかの約束が要り、Bを逆順にするときに付け替えが要る。(3) 頂点の番号の並び（`[1, 3]`）は、逆順・連結のたびに番号の付け替えが要る。頂点と同じ並びの配列なら、`segments`が区間と同じ並びであるのと同じく、頂点を逆順・連結するときに一緒に並べるだけで済む（`PathJoinRules`の1か所で頂点・区間の種類と一緒に扱える）。(4) 角の点がないときキーを出さないため、角の点が1つもないパスの`toJSON()`は今と同じ（キー・順とも）。
  * **古いエディタ（本作業より前）**：`Path.fromJSON`は最上位の余分なキーを見ない（`validateShapeData`は「余分なプロパティは見ない」、`Path.fromJSON`は`closed`・`points`・`segments`だけを検証する。実コードで確認済み）。したがって図形はスキップされず、角の点がなめらかに描かれるだけになる。版は2のまま。
* **図形の側の保持**：公開プロパティ`corners`（`boolean[]`。常に`points`と同じ要素数。初めはすべて`false`）。
* **コンストラクタ**：省ける第7引数`corners`（真偽値の配列）を足す。`this.corners = this.points.map((_, i) => Array.isArray(corners) && corners[i] === true)`の形で、渡された配列を保持せず、要素数を常に`points`にそろえる（検証はしない。`true`以外は`false`）。第1〜6引数・省いたときの結果は今と同じ（`ShapeFactory`の`curve`の`create`は6引数のままで、角の点なし）。
* **`#segmentControls`**：`computeSmoothSegmentControls(this.points, 区間の真偽値, this.closed, this.corners)`と第4引数を渡す。描画（`#tracePath`）・当たり判定／範囲選択（`#someSegment`）・塗りの内側（`#fillPolygon`）・`toDrawElement`はこれを共有しているため、ほかは変えずに角の点が反映される。
* **`toJSON`**：`segments`の直後に、`this.corners`に`true`が1つ以上あるときだけ`corners: this.corners.slice()`（新しい配列）を入れる（条件付きのスプレッドで、キーの順を保つ）。
* **`fromJSON`**：`segments`の検証の後に`corners`を検証する。`data.corners === undefined`（キーなし）なら角の点なし。それ以外は次の順に検証して例外を投げる（エラー文は`Path.fromJSON: `に続けて）：
  * 配列でない（`null`を含む）→ `cornersが配列ではありません`
  * 要素数が`points`の要素数と違う → `cornersが${n}要素の配列ではありません`
  * 要素が真偽値でない → `corners[${i}]が真偽値ではありません`
  * 生成は`new Path(data.points, data.closed, style.strokeColor, style.strokeWidth, style.fillColor, SEGMENT_KIND_LINE, readCornerFlags(data))`（`segments`は今どおり直後に作り直す）。すべて`false`の`corners`は受理し、`toJSON()`では出さない（正規化。許容）。`@throws`に3つの条件を足す。
* **新しい公開関数`readCornerFlags(data)`**（`export function`。図形データ＝`toJSON()`の値または検証済みの図形データから、頂点ごとの角の点かの真偽値の配列を新しく作る）：`Array.from({ length: data.points.length }, (_, i) => Array.isArray(data.corners) && data.corners[i] === true)`。「`corners`のキーが無ければすべてなめらか」という読み方の唯一の箇所。`points`を持つ直線（`Line`）の`toJSON()`の値にも使える（すべて`false`）。使う側：`Path.fromJSON`・`PathJoinRules`（要件D）・`PathCornerRules`（要件C）。
* **変えないもの**：18メソッドの一覧、`setVertex`・`translate`・`updateDraftEnd`（`corners`は頂点のオブジェクトと別の配列のため、頂点の位置の変更・平行移動で失われない）、`getVertexHandleNames`ほかハンドル関係、`isFillable`。
* JSDoc：ファイル先頭の責務定義（3行以内のまま、必要なら「角の点」を足す）、クラスJSDoc（図形データの形・角の点の意味）、コンストラクタの`@param`、`corners`の`@type`、`toJSON`・`fromJSON`の形と`@throws`、`#segmentControls`を実態に合わせる。

### 要件C: 角の判定と切り替えの組み立て（`js/shapes/PathCornerRules.js`。新規）
* **責務（ファイル先頭。3行以内）**：パスの点の角の状態（角／なめらか／直線の角／角の考えなし）の判定と、選んだ点から「角」のチェックボックスの表示内容と、押したときに角の状態を変えた新しいパスを組み立てる規則を、状態を持たない関数と定数として提供する。
* **種類**：図形クラスではなく、`PathJoinRules`・`EndpointSnapRules`と同じ「図形をまたぐ規則」（第3の種類）。`shapes/`の外（`edit/PathCornerEditor`）から使う。
* **importと読むもの**：importは`./Path.js`（`Path`・`SEGMENT_KIND_SMOOTH`・`readCornerFlags`）のみ。図形の`type`・公開プロパティ`id`・`toJSON()`だけを読み、図形クラスの内部プロパティ（`points`・`segments`・`corners`）を直接読み書きしない（`PathJoinRules`と同じ約束）。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式を知らない。`try/catch`を持たない。引数を書き換えない。
* **公開**：
  * `CornerState`（`Object.freeze`した定数。値の唯一の定義）：`CORNER: 'corner'`（角の点）・`SMOOTH: 'smooth'`（なめらかな点）・`LINE_CORNER: 'lineCorner'`（直線の角の点＝片側でも直線の区間の、パスの点）・`NONE: 'none'`（角の考えがない点）。
  * `resolveCornerState(shape, vertexIndex)` → `CornerState`の値。判定の唯一の箇所：
    1. `shape.type !== 'path'` → `NONE`（直線・矩形・今の曲線・円・弧。矩形の4隅も）。
    2. `data = shape.toJSON()`、`n = data.points.length`。`vertexIndex`が`0`以上`n`未満の整数でない → `NONE`。
    3. 開いたパスで`vertexIndex`が`0`か`n − 1`（端の点）→ `NONE`。
    4. 前の区間＝閉じたパス`(i − 1 + n) % n`・開いたパス`i − 1`、次の区間＝`i`。どちらも`kind === SEGMENT_KIND_SMOOTH`なら、`readCornerFlags(data)[i]`が真で`CORNER`、偽で`SMOOTH`。どちらかが直線 → `LINE_CORNER`。
    * データを読む部分は非公開の`cornerStateOfData(data, vertexIndex)`（`type`の判定の後）に置き、下の2関数が1回の呼び出しの中で同じ図形の`toJSON()`を使い回せるようにする（非公開の`Map`で図形ごとに1回だけ`toJSON()`）。
  * `resolveCornerToggleView(targets)` → typedef`CornerToggleView`＝`{ enabled: boolean, checked: boolean, mixed: boolean }`。`targets`＝`Array<{ shape, vertexIndex }>`（選んだ点。0件可）。チェックの見た目の決め方の唯一の箇所：
    * 角を操作できる点（`CORNER`・`SMOOTH`）が0件 → `enabled: false`・`mixed: false`・`checked`＝`LINE_CORNER`が1件以上あるか（0件なら`false`）。
    * すべて`CORNER` → `enabled: true`・`checked: true`・`mixed: false`。
    * すべて`SMOOTH` → `enabled: true`・`checked: false`・`mixed: false`。
    * 混ざっている → `enabled: true`・`checked: false`・`mixed: true`。
  * `planCornerToggle(targets)` → `Array<{ targetId, path }>`（角の状態が1つでも変わる図形ごとに、変えた新しい`Path`。変わる図形が無ければ空配列）。押したときの結果の決め方の唯一の箇所：
    * 次の値＝`resolveCornerToggleView(targets)`が`enabled`でなければ空配列を返す。`enabled`なら「`checked`なら`false`（すべてなめらか）、そうでなければ`true`（すべて角）」（`mixed`は`checked: false`のため角になる）。
    * 図形ごと（`targets`に最初に現れた順。同じ図形インスタンスは1つにまとめる）に、`readCornerFlags(data)`の写しの、**角を操作できる点（`CORNER`・`SMOOTH`）の番号だけ**を次の値にする（直線の角の点・角の考えがない点は変えない）。1つも変わらなければその図形は結果に入れない。
    * 新しいパスは`new Path(data.points, data.closed, data.strokeColor, data.strokeWidth, data.fillColor, data.segments.map((s) => s.kind), 新しい角の配列)`（id は`null`。`targetId`は`shape.id`。結果は引数と配列・頂点を共有しない）。頂点・閉じているか・区間の種類・スタイルは元のまま。
  * 同じ点が`targets`に2回あっても結果は変わらない（JSDocに書く）。
* typedef：`CornerTarget`（`{ shape: Object, vertexIndex: number }`）、`CornerToggleView`（`palette/OptionBarCornerGroup.js`のtypedefと同じ内容の二重定義。JSDocに互いの存在を書く）、`CornerTogglePlanItem`（`{ targetId: *, path: Path }`）。

### 要件D: 結合・描き足し・閉じるで角の点を保つ（`js/shapes/PathJoinRules.js`。既存へ変更）
* importに`readCornerFlags`を足す（`import { Path, SEGMENT_KIND_LINE, readCornerFlags } from './Path.js';`）。
* **typedef`SegmentChain`**に`corners: boolean[]`（頂点ごとの角の点か。`corners.length === points.length`）を足す。
* **`chainOf(data)`**：`{ points: data.points, kinds: segmentKindsOf(data), corners: 端を偽にした readCornerFlags(data) }`。**開いた線の端の点（先頭・末尾）は常に`false`にする**（「つながってできた点はなめらかな点」の唯一の箇所。開いた線の端の点は、結合・描き足し・閉じるでつながってできた点になるか、結果でも端の点のまま＝角の考えがない点になるかのどちらかのため）。端を偽にした新しい配列を返す（`data`を書き換えない）。
* **`reverseChain(chain)`**：`corners`も`slice().reverse()`する（Bを逆順にすると角の情報も頂点と一緒に逆順）。
* **`assembleOpenPath`**：`bChain.corners`を`bChain.points`と同じように写して`merge`のとき同じ端を除き（`shift`／`pop`）、`aFirst`に応じて`aChain.corners`と連結し、`new Path(..., kinds, corners)`の第7引数に渡す。JSDocの「頂点の並べ方と区間の種類の並べ方の規則はここだけ」に角の情報を足す。
* **`buildExtendedPath`**：足す点の並びを`{ points: [{ x, y }], kinds: [], corners: [false] }`にする。
* **`buildClosedPath`**：`data.points.slice()`・`segmentKindsOf(data)`の代わりに`chainOf(data)`から`points`・`kinds`・`corners`の写しを取り、始点と終点が重なるときは`points`と`corners`の末尾を一緒に`pop`する（`chainOf`が端を偽にしているため、閉じたときの始点・間を埋める区間の両端はなめらかな点になる）。`new Path(points, true, ..., kinds, corners)`。
* **変えないもの**：作成途中の線の組み立て（`buildLineOrPath`・`buildDrawnDraft`・`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`。作成途中の線は角の点を持たない）、計画の関数（`planJoin`・`planDrawnLineJoin`・`planEndpointDragJoin`・非公開の計画の関数。組み立て関数を通るため自動で角の点を保つ）、`isJoinableLine`・`classifyJoin`ほかの判定。
* 角の点がない入力の結果（頂点・区間・id・スタイル・`toJSON()`）は今と同じ（`corners`はすべて`false`で、`toJSON()`にキーが出ない）。
* JSDoc：ファイル先頭の責務定義（3行以内のまま。「結果は元の区間の種類と途中の角の点を保つ」程度を足す）、`chainOf`・`reverseChain`・`assembleOpenPath`・`buildClosedPath`・`buildExtendedPath`・`buildJoinedPath`・`buildJoinedPathAt`の説明に角の点の扱いを足す。

### 要件E: 角の切り替えの1件の編集操作（`js/edit/PathCornerEditor.js`。新規）
* **責務（ファイル先頭。3行以内）**：頂点の選択で選んでいる点の角・なめらかを規則（`shapes/PathCornerRules`）で切り替える1件の編集操作と、「角」のチェックボックスの表示内容の照会を担う。DOM・操作モードの解釈・図形種別の判定を持たない。
* **import**：`../core/NudgeTargetRules.js`の`resolveNudgeTarget`と、`../shapes/PathCornerRules.js`の`resolveCornerToggleView`・`planCornerToggle`のみ。
* **注入**（コンストラクタ`{ model, editRecorder, getMode }`）：`model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`・`replaceShape`だけを使う。`editRecorder`（実体は`HistoryManager`）は`beginEdit`・`commitEdit`だけ。`getMode`は値を解釈せず`resolveNudgeTarget`へ渡すだけ（`NudgeEditor`・`PositionInputEditor`と同じ約束）。
* **対象の集め方（非公開`#collectTargets()`）**：`resolveNudgeTarget(getMode(), getSelectedIds(), getSelectedVertices())`が`null`か`type !== 'vertices'`なら空配列（頂点の選択（`A`）以外のモード・点を選んでいない）。`'vertices'`なら各`{ shapeId, handle }`について、`getShapes()`から図形を探し（無ければ飛ばす）、`shape.getVertexIndexForHandle(handle)`（`null`なら飛ばす）で番号を得て`{ shape, vertexIndex }`を集める。図形種別・ハンドル名の形式は解釈しない。
* **`getView()`**：`resolveCornerToggleView(#collectTargets())`を返す（モデル・履歴を変えない）。
* **`toggle()`**：`plan = planCornerToggle(#collectTargets())`。空なら記録先・モデルに一切触れず`false`。そうでなければ`beginEdit()` → 計画の各要素について`model.replaceShape(targetId, path, { keepId: true, select: false })` → `commitEdit()`（まとめの鍵なし）→ `true`。
  * **選択が変わらない理由**：`keepId: true`で同じidのまま置き換わり、`select: false`は選択集合を作り直さず現存しないidだけを外す（外れるidは無い）。頂点の選択は選択集合の図形の組を落とすだけで、同じidのため残る。ハンドル名`'vertex-<i>'`は頂点の数が変わらないため有効なまま。重なり順・スタイル・頂点の位置も変わらない（`PathCornerRules`が元のまま作る）。
  * **通知の回数と取り消し1件**：変わる図形が`k`個なら`replaceShape`の通知が`k`回（1回ずつ正しい状態のため表示は崩れない）。`beginEdit`と`commitEdit`で1回だけ挟むため取り消し1件（`HistoryManager`は前後の作業データを比べて1件にする）。`VectorModel`に複数置き換えのメソッドは足さない（`core/`を変えないため。通知が`k`回になることは資料の注意に残す）。
* **前提（呼び出し側の責務）**：ドラッグ中でないこと（`main.js`の`performCornerToggle`が判定する）。本クラスは進行中の入力操作の中断・モード切り替えを行わない。再描画・UI同期を自分で呼ばない。`try/catch`を持たない。

### 要件F: 「角」のチェックボックスのUI部品（`js/palette/OptionBarCornerGroup.js`。新規）と`index.html`
* **責務（ファイル先頭。3行以内）**：オプションバーの「角」のまとまり（`#option-corner-group`）のチェックボックスの表示（チェックあり・なし・「−」・押せない）と、切り替えのコールバックへの通知を担う。角の判定・選択状態には関与しない。DOM操作専任。
* importなし。状態は「最後に表示した内容」（`#lastView`）だけ（判定は持たない）。`VectorModel`・図形・`PathCornerEditor`・規則を参照しない。
* **コンストラクタ**`(groupElement, actions)`：`actions.onCornerToggle`が関数でなければ`Error`。`groupElement.querySelector('#option-corner-toggle')`が無ければ`console.warn`して配線しない（以後の`render`は何もしない。既存のまとまりと同じ作り）。`change`を購読する。
* **`render(view)`**：`#lastView = view`を覚えて当てる。当て方（非公開`#applyView(view)`）：`checkbox.disabled = !(view && view.enabled === true)`、`checkbox.indeterminate = view?.mixed === true`、`checkbox.checked = view?.checked === true && view?.mixed !== true`。`view`が無ければ押せない・チェックなし。
* **`change`のとき**：`actions.onCornerToggle()`を呼び（戻り値は使わない）、続けて`#applyView(#lastView)`で最後に表示した内容を当て直し、最後に`checkbox.blur()`する。
  * **当て直す理由**：ブラウザは`change`の前に`checked`を反転し`indeterminate`を外す。受理されると`model.onChange`の経路で`render`が先に呼ばれて正しい内容になるが、受理されない（ドラッグ中・変わる点が無い）と`model.onChange`が来ず、反転した見た目が残るため。
  * **`blur`する理由（REQの`Space`・`Enter`の確認）**：`core/FocusKeyYieldRules`は`type="checkbox"`の`input`を`isSpaceOperatedInputElement`として扱い、フォーカスがある間は`Space`をチェックボックスに譲り（パンしない）、`Ctrl`なしのショートカット（`V`・`A`・矢印の微調整・`J`等）を止める。クリックした後にフォーカスが残ると、(1) `Space`（パンのつもり）でチェックボックスが切り替わり、角の状態が意図せず変わって取り消しが1件増える、(2) 矢印キーの微調整・`A`等が働かない、ことになる。`change`の後に`blur`すれば、`Space`はパン・ショートカットは今どおりに働く。`Enter`はチェックボックスでは既定の動作が無く、フォーカスも残らないため切り替わらない。`Tab`でフォーカスを移して`Space`で切り替えた場合も、切り替えの後にフォーカスが外れる（キーボードで続けて操作するには`Tab`で戻る。許容）。`FocusKeyYieldRules`・`KeyboardShortcuts`のコードは変えない。
* typedef：`CornerToggleView`（`shapes/PathCornerRules.js`と同じ内容の二重定義）、`OptionBarCornerGroupActions`（`onCornerToggle: () => boolean`）。
* **`index.html`**（オプションバーの右端＝`#option-align-group`の直後。`</header>`の前）：
  ```html
  <div id="option-corner-group" class="toolbar-group">
      <label class="option-corner-label" title="角（頂点の選択で選んだ、両側とも曲線の区間の点を角にする／なめらかに戻す）"><input type="checkbox" id="option-corner-toggle" disabled><span class="option-unit option-corner-text">角</span></label>
  </div>
  ```
  * 常に置く（頂点の選択の間だけ現れる作りにしない）。`title`にキーは書かない（キーは割り当てない）。
  * CSS（`<style>`の`.option-unit`の後）：`.option-corner-label { display: flex; align-items: center; gap: 2px; }`（文字のクリックでも切り替わる）、`#option-corner-toggle:disabled + .option-corner-text { opacity: 0.4; }`（押せないときは文字も`.tool-btn:disabled`と同じ薄さ。チェックの欄はブラウザ標準の`disabled`の見た目）。
  * **「−」の見た目**：HTMLのチェックボックスの`indeterminate`（JSのプロパティでだけ設定でき、属性は無い）。主なブラウザで「−」（横線）として描かれる。`checked`とは別のプロパティで、`indeterminate`が真の間は`checked`の見た目より優先される（念のため`checked`は偽にそろえる）。支援技術には`aria-checked="mixed"`相当として伝わる。
  * **1280pxの幅の見積もり**：今は約1138px（`index.html`の幅の見積もりのコメント）。足すのは区切り17px（罫線1＋余白8＋8）＋チェックの欄約13px＋チェックボックスの既定の余白約7px＋間隔2px＋文字「角」約12px（12px）＝約51px で、合計**約1189px**（1280px以内）。幅の見積もりのコメントを更新する。

### 要件G: `main.js`の配線（`js/main.js`。既存へ変更）
* importに`PathCornerEditor`（`./edit/PathCornerEditor.js`）と`OptionBarCornerGroup`（`./palette/OptionBarCornerGroup.js`）を足す。
* **配線ブロック`// 7.12.`**（`// 7.11.`の`model.onChange(syncOptionBarAlignGroup);`の直後、`// 8.`の前）：
  * `const pathCornerEditor = new PathCornerEditor({ model, editRecorder: historyManager, getMode: () => inputTracker.getMode() });`
  * `function performCornerToggle()`：`inputTracker.isDragging()`なら`false`、それ以外は`pathCornerEditor.toggle()`の戻り値（`performShapeAlign`と同じ形。JSDocにドラッグ中は受理しない理由＝ドラッグが開いている編集操作と`beginEdit`／`commitEdit`の対を崩さないため）。
  * `const optionBarCornerGroup = new OptionBarCornerGroup(document.getElementById('option-corner-group'), { onCornerToggle: () => performCornerToggle() });`
  * `function syncOptionBarCornerGroup() { optionBarCornerGroup.render(pathCornerEditor.getView()); }` と `model.onChange(syncOptionBarCornerGroup);`
* 起動時の同期：`syncOptionBarAlignGroup();`の直後に、既存と同じ形のコメント付きで`syncOptionBarCornerGroup();`を1回呼ぶ。
* ブロックのコメントは既存の`// 7.11.`にそろえる（表示はUI部品、判定・組み立ては`PathCornerRules`、手順は`PathCornerEditor`、ここは生成・注入・同期とドラッグ中の受理判定のみ。キーは割り当てない）。判定・計算・機能専用の同期経路を足さない。`KeyboardShortcuts`の注入は変えない。
* **追従の確認**：選択の変更・頂点の選択の変更・頂点の移動・取り消し／やり直し・キャンバスの切り替え・モードの切り替え（`setMode`が選択集合を空にし、頂点の選択はそれに含まれるため、頂点を選んでいる状態からの切り替えでは必ず通知が出る。何も選んでいない状態の切り替えでは表示内容が変わらない）は、すべて既存の`model.onChange`で追従する。

### 要件H: 保存・コピー・書き出し（`io/`のコードは変えない。テストで確認）
* 作業データ：`DocumentSerializer.serialize`は図形の`toJSON()`を使い、`deserialize`は`ShapeFactory.fromJSON` → `Path.fromJSON`を通るため、角の点は保存・読み込み・キャンバスの切り替え（IndexedDB）・取り消し／やり直し（`SnapshotAdapter`）・コピー＆ペースト・複製・`Alt`+ドラッグで保たれる。`corners`の形が正しくない図形は`Path.fromJSON`が例外を投げ、`DocumentSerializer`が図形単位でスキップする（既存の仕組み）。
* 書き出し：`bezierPath`の`segments`の`cubic`の制御点は`Path.toDrawElement`が`#segmentControls`の結果を入れるため、角の点が反映される。`SpriteSerializer`（外枠は`cubic`の制御点から各軸の極値で求める）・`CodeExporter`（`segments`のとおり`bezierCurveTo`）は変えずに、角が描かれ・外枠が形を囲む。エディタで開き直す経路（`FileContentReader`）は`source`（作業データ）を使うため角の点が戻る。
* `js/io/DocumentSerializer.js`のtypedef`DocumentData`のJSDocの1文「（pathは`closed`・`segments`が加わる）」を「（pathは`closed`・`segments`が加わり、角の点があるときだけ`corners`も加わる）」に直す（JSDocのみ。コードは変えない）。

### 要件I: テスト（REQ要件5）
既存のケースは変えない（期待値の書き換えが要る既存のケースは無い見込み。出た場合はタスクの詳細作業内容にケースと理由を列挙する）。`palette/`・`main.js`・`index.html`はテストを置かない（`_doc/arch/16_test.md`の方針）。
* **(I-1) `test/shapes/ShapeGeometry.test.js`**（`describe('computeSmoothSegmentControls 角の点（Phase 09-02a）')`を足す）：第4引数を省いた結果と`[]`・すべて`false`を渡した結果が同じ（開いた・閉じた・直線と曲線の混在）／開いた全区間曲線の途中の点を角にすると、その点の前の区間の`control2`と次の区間の`control1`が仮の点の式になる／頂点5つ以上で、角の点の両隣以外の区間の制御点が角なしと同じ（離れた区間は変わらない）／直線の区間との境目の点・開いたパスの端の点の角の情報は結果を変えない／閉じたパスの始点（番号0）を角にすると閉じる区間の`control2`と区間0の`control1`が仮の点の式になる／閉じた全区間曲線の全点を角にすると各区間が`a + (b−a)/3`・`b − (b−a)/3`（直線と同じ形）／角の点を含めても制御点が頂点の1次式（頂点を拡大縮小・回転・平行移動した結果と、結果の制御点に同じ変換をしたものが一致）／引数を書き換えない。
* **(I-2) `test/shapes/Path.test.js`**（`describe('Path の角の点（Phase 09-02a）')`を足す）：コンストラクタの既定の`corners`（すべて`false`・要素数`n`）・第7引数の写し（渡した配列を共有しない・`true`以外は`false`・要素数を`points`にそろえる）／角の点がないパスの`toJSON()`のキーが今と同じ（`corners`が無い）／角の点があると`corners`が`segments`の直後・`strokeColor`の前に新しい配列で出る／`toJSON`→`fromJSON`の往復で`corners`・描画・当たり判定が一致／すべて`false`の`corners`は受理し`toJSON()`では出ない／`fromJSON`のエラー文（配列でない・`null`・要素数違い・真偽値でない要素）と検査の順序（`segments`の検査の後）／`setVertex`・`translate`の後も`corners`が残る／`toDrawElement`の`cubic`の制御点が`computeSmoothSegmentControls(points, 区間, closed, corners)`と一致し、角なしと違う／区間がすべて直線のパスは角の情報があっても`polyline`のまま／`draw`の`bezierCurveTo`の引数が角の点を反映する／当たり判定（`hitTest`）・範囲選択（`intersectsRect`）・塗りの内側（`hitTestFill`。閉じた全区間曲線の全点を角にしたパスは頂点の多角形と同じ内側）が角の点を反映する／`readCornerFlags`（キーなし・あり・直線の`toJSON()`・新しい配列）。
* **(I-3) `test/shapes/PathCornerRules.test.js`（新規）**：`resolveCornerState`の4つの状態（開いた全曲線の途中＝`SMOOTH`／角にした途中＝`CORNER`／直線と曲線の境目・全直線の途中＝`LINE_CORNER`／開いたパスの端・範囲外・整数でない番号・`Line`・`Rect`・今の曲線（`Curve`）・円＝`NONE`／閉じたパスの始点・最後の点）／`resolveCornerToggleView`（0件・`NONE`だけ＝押せない・チェックなし、`LINE_CORNER`を含み操作できる点が無い＝押せない・チェックあり、すべてなめらか＝チェックなし、すべて角＝チェックあり、混ざっている＝`mixed`、操作できない点が混ざっても操作できる点だけで決まる）／`planCornerToggle`（すべてなめらか→すべて角、すべて角→すべてなめらか、混ざり→すべて角、操作できない点は変わらない、複数の図形、変わらないとき・操作できる点が無いとき空配列、同じ点が2回でも同じ結果、結果のパスの頂点・閉じているか・区間の種類・スタイルが元のまま・idが`null`・`targetId`が元のid、引数の図形を書き換えない・結果が引数と頂点を共有しない）。
* **(I-4) `test/shapes/PathJoinRules.test.js`**（`describe('角の点を保つ（Phase 09-02a）')`を足す）：`buildJoinedPath`・`buildJoinedPathAt`で、Aの途中の角の点・Bの途中の角の点が結果でも角（Bを逆順にする組では角の番号が逆順の位置へ移る）／端点をまとめた点・間を埋める区間の両端がなめらか（`corners`が偽）／`buildClosedPath`（重なる・離れる）で途中の角の点が残り、閉じたときの始点がなめらか／`buildExtendedPath`で角の点が残り足した点がなめらか／`planDrawnLineJoin`（描き足し・閉じる・つながる）と`planEndpointDragJoin`でも角の点が残る／元の線の端の点に角の情報があっても結果の端・つながった点はなめらか／角の点が無い入力の結果の`toJSON()`に`corners`が無い（今と同じ）。
* **(I-5) `test/edit/PathCornerEditor.test.js`（新規）**：実物の`VectorModel`・図形クラスと、呼び出しを記録する偽の記録先、`getMode`の差し替え（`OperationMode`の値）で組む。対象の集め方（頂点の選択の組から番号を求める・図形が無い組は飛ばす）／`getView`（頂点の選択モード以外・点なし＝押せない・チェックなし、各見た目）／`toggle`で角になり`beginEdit`→`commitEdit`が1組（鍵なし）、もう一度で戻る／複数の図形の点を選んでも`beginEdit`/`commitEdit`は1組で、両方の図形が変わる／変わらないとき（操作できる点が無い・頂点の選択モード以外）は`false`で記録先・通知に触れない／図形の選択・頂点の選択・図形のid・重なり順・スタイル・頂点の位置が変わらない／`HistoryManager`と`SnapshotAdapter`の実物と組んで取り消し1回で戻り、やり直しで戻る（`test/edit/`の既存の組み方を参考にする。組み方が重い場合は偽の記録先のケースだけでよい）。
* **(I-6) `test/io/`**：`DocumentSerializer.roundtrip.test.js`に角の点を含むパス（開いた・閉じた）の往復（オブジェクト・文字列）、`DocumentSerializer.errors.test.js`に`corners`の形が正しくないパスが図形単位でスキップされること、`SpriteSerializer.test.js`に角の点を含むパスの`bezierPath`の制御点（角なしと違い、`toDrawElement`と一致）と外枠が形を囲むこと（既存の`sampleBezierPathRange`等の補助を使う）、`CodeExporter.test.js`に角の点を含むパス（開いた・閉じた・塗りあり）でエディタの`draw`と書き出した`draw`の描画命令が一致すること（既存の`assertSameAsEditor`）。

### 要件J: `core/FocusKeyYieldRules.js`のJSDocの1文（コードは変えない）
* `SPACE_OPERATED_INPUT_TYPES`のJSDocの「現在、これらのtypeのinput要素はオプションバーのスタイルのまとまりの色の欄（color）以外に存在しない。」は、チェックボックスを足すと事実と食い違うため、「現在、これらのtypeのinput要素は、オプションバーのスタイルのまとまりの色の欄（color）と、角のまとまりのチェックボックス（checkbox。`change`の後にフォーカスを外す）だけ。」に直す。コード・判定は変えない。

### 要件K: ふるまいの確認（テストプレイの確認項目。REQ要件6）
実装の最後（タスク10）に、本RESの「4. 詳細作業内容」へ写して実装の結果に合わせて確かめ、最終報告で発注者へ提示する。
0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。
1. **チェックボックスの置き場所**：オプションバーの右端（整列のボタンの右）に「角」のチェックボックスがある。選択（`V`）では押せない見た目（チェックの欄も「角」の文字も薄い）。幅1280px程度の画面でも切れずに見える。
2. **角にする**：曲線のツールで点を4つ以上打って曲線を引く。頂点の選択（`A`）で線をクリックして選び、途中の点を1つ選ぶと、チェックボックスが押せる（チェックなし）。チェックを入れると、その点で両側の曲線が尖って出会う（その点の両隣の区間だけ形が変わる）。チェックを外すと、元のなめらかな曲線に戻る。点は選んだまま。
3. **角の点を動かす**：角にした点をドラッグ・矢印キーで動かしても、角のまま形が決まり直す。チェックボックスを押した直後に矢印キー・`A`・`V`などのキーがそのまま働き、`Space`を押しながらのドラッグでパンできる（チェックが切り替わらない）。
4. **押せない点**：直線のツールで引いたパスの途中の点、曲線のパスに直線の区間を結合でつないだ境目の点を選ぶと、チェックが入った見た目で押せない。開いた線の端の点、直線・矩形・今までに描いた曲線（今の曲線）の点を選ぶと、チェックなしで押せない。点を選んでいないとき・線だけを選んで点を選んでいないときも押せない。
5. **複数の点**：曲線のパスの途中の点を複数選ぶ（`Ctrl`+クリック・範囲選択）。全部なめらかならチェックなしで、押すと全部角になる。角となめらかが混ざっていると「−」の見た目で、押すと全部角になる。全部角ならチェックありで、押すと全部なめらかになる。押せない点（端の点・直線の境目の点）が混ざっていても、押せる点だけが変わる。
6. **閉じた曲線**：曲線のツールで始点に戻って閉じた形を描き、始点を含む点を角にできる。全部の点を角にすると、直線で結んだ多角形と同じ形になる。塗りを付けると、角を含めた形どおりに塗られ、内側のクリックで選べる。線の上のクリック・範囲選択も描かれた形どおりに働く。
7. **取り消し・やり直し**：切り替えが取り消し（`Ctrl`+`Z`）1回で戻り、やり直しで切り替えた後に戻る。複数の図形の点をまとめて切り替えても取り消し1回で戻る（取り消し・やり直しの後は、今までの頂点の移動の取り消しと同じく、図形の選択は戻り頂点の選択は外れる）。点を変えられないときに押しても取り消しの履歴は増えない。
8. **結合・描き足し**：角の点を含む曲線のパスを、ほかの線と結合（`J`）・曲線のツールでの描き足し・端点のドラッグでつなぐと、元の角の点は角のまま残る。つないだところは、曲線どうしならなめらか、直線との境目なら角。
9. **保存・書き出し**：角の点を含むパスを保存して開き直す（キャンバスの切り替え・コピー＆ペースト・複製（`Ctrl`+`D`）も）と、同じ形に戻る。書き出して確認用ページ（`sprite-check.html`）で開くと、角を含めて同じ形で描かれ、外枠が形を囲む。
10. **ほかが今までどおり**：角を使っていない曲線のパス・直線のパスの形、曲線のツール・直線のツールの連続作成、結合・描き足し、選択・頂点の選択・位置の数値入力・整列・保存・読み込み・書き出しが今までどおり動く。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（形の決め方の式・パスの図形クラス・図形をまたぐ規則）、`./js/edit/`（1件の編集操作の手順）、`./js/palette/`（オプションバーのまとまりのUI部品）、`./js/main.js`（配線）、`./index.html`（オプションバーの要素と`<style>`）、`./test/shapes/`・`./test/edit/`・`./test/io/`（自動テスト）。JSDocのみ：`./js/io/DocumentSerializer.js`・`./js/core/FocusKeyYieldRules.js`。
*   **関連する論理クラス**:
    *   `shapes/ShapeGeometry.computeSmoothSegmentControls`（既存。第4引数`cornerFlags`を足す）
    *   `shapes/Path`（既存。公開プロパティ`corners`・コンストラクタの第7引数・`toJSON`/`fromJSON`の`corners`・公開関数`readCornerFlags`を足す。18メソッドは不変）
    *   `shapes/PathCornerRules`（**新規**。`CornerState`・`resolveCornerState`・`resolveCornerToggleView`・`planCornerToggle`。図形をまたぐ規則＝第3の種類）
    *   `shapes/PathJoinRules`（既存。`SegmentChain`に`corners`、`chainOf`・`reverseChain`・`assembleOpenPath`・`buildClosedPath`・`buildExtendedPath`で角の点を一緒に並べる）
    *   `edit/PathCornerEditor`（**新規**。`getView`・`toggle`）
    *   `palette/OptionBarCornerGroup`（**新規**。`render`）
    *   `main.js`の`// 7.12.`（**新規ブロック**。`performCornerToggle`・`syncOptionBarCornerGroup`）
    *   `index.html`の`#option-corner-group`・`#option-corner-toggle`（**新規要素**）

### 参照する責務
*   **依存方向（1章）**：`main.js → edit → io → core → shapes`の一方向。一方向の列から外れるimportは3種だけ：(1)`edit/ → shapes/`（`PathJoiner → PathJoinRules`、`EndpointSnapper → EndpointSnapRules`・`PathJoinRules`。`edit/`の他のクラスは`shapes/`をimportしない）、(2)`shapes/`内（`EndpointSnapRules → PathJoinRules`。`PathJoinRules`は`Line`・`Path`のみimport）、(3)`edit/ → core/`（`NudgeEditor`・`PositionInputEditor → NudgeTargetRules`、`PositionInputEditor → VertexHandleRules`、`PositionInputRules → StatusReadoutRules`。importするのは`core/`の状態を持たない規則の関数のみで、`VectorModel`・`HistoryManager`は注入）。`palette/`は何もimportしない。循環importは無い。**本作業で(1)に`PathCornerEditor → PathCornerRules`、(3)に`PathCornerEditor → NudgeTargetRules`を足す。**
*   **`shapes/`（1章・`_doc/arch/12_shapes.md`）**：図形クラス（種別ごとに1ファイル）・図形クラスだけが使う共通の関数（`ShapeGeometry`は形の決め方の式の唯一の箇所）・図形をまたぐ規則（第3の種類。`shapes/`の外から使う。状態を持たない`export`した関数と定数のみ。図形の`type`・公開プロパティ`id`・`toJSON()`だけを読み、図形クラスの内部プロパティを読まない。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式を知らない。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない）。`PathJoinRules`は頂点と区間の種類を一緒に並べる唯一の箇所が`assembleOpenPath`（`buildJoinedPath`系・`buildExtendedPath`が共有）と`buildClosedPath`、Bの逆順は`reverseChain`。
*   **`Path`（`_doc/arch/12_shapes.md`）**：制御点は非公開の`#segmentControls`が1か所で求め、描画・当たり判定／範囲選択・塗りの内側・`toDrawElement`が共有する。`fromJSON`は不正な入力で`Error`をthrowし（`DocumentSerializer`が図形単位で捕捉）、`id`は検証せず、余分なプロパティは無視する。往復で図形データの内容と描画・当たり判定の結果は一致する。共通メソッド契約は18メソッド。区間の要素数の不変条件は頂点の追加・削除を足すときに保つ。
*   **`edit/`（1章・`_doc/arch/14_edit.md`）**：操作モードを知らない（`NudgeEditor`・`PositionInputEditor`は`getMode`の戻り値を解釈せず`core/NudgeTargetRules`へ渡すだけ）。1件の編集操作の手順は`VectorModel`・`HistoryManager`（`EditRecorder`）を注入で受け取り、規則の関数だけをimportする。DOM・図形種別の分岐・図形固有のプロパティ名を持たない。再描画・UI同期を自分で呼ばない。
*   **`palette/`（1章・`_doc/arch/13_palette.md`）**：1つのUI部品。オプションバーはまとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持ち、各UI部品は自分のまとまりの要素をルート要素として受け取り、要素idは接頭辞`option-`。importなし、`VectorModel`・図形データ・選択状態・手順を知らない。
*   **`main.js`（`_doc/arch/02_main.md`）**：インスタンス化・依存の注入・イベントバインドのみ。判定ロジックを持たない。重なり順・整列・分布のボタンは`perform…`の中で`inputTracker.isDragging()`なら不受理（ドラッグが開いている編集操作と`beginEdit`／`commitEdit`の対を崩さないため）。起動時の同期は`onChange`通知に依存せず明示的に1回呼ぶ。
*   **同期の経路（3章冒頭）**：再描画・UI同期は既存の経路（`model.onChange`ほか）のみ。オプションバーの表示は`model.onChange`で同期する。機能専用の再描画・同期処理を足さない。
*   **履歴（3章6.）**：変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。前後の作業データが一致すれば記録しない。結果が変わらない操作は`beginEdit`も呼ばない（重なり順・整列と同じ）。取り消し・やり直しは`replaceAllShapes`で選択集合・頂点の選択をクリアし、`shouldRestoreSelection`が真なら図形の選択だけを戻す。
*   **頂点の選択（2章・3章18.）**：`VectorModel`が持つ`{ shapeId, handle }`の配列（保存しない・履歴の対象外）。選択集合に含まれる図形の組だけを持つ。パスのハンドル名は`'vertex-<i>'`で、番号は図形の`getVertexIndexForHandle`で得る。`VectorModel.replaceShape`は`keepId`・`select: false`で選択集合を作り直さず、現存しないidだけを外し、頂点の選択から選択中でなくなった図形の組を落とす（通知1回）。
*   **2章`path`**：`{ type: 'path', id, points, closed, segments, strokeColor, strokeWidth, fillColor }`（キー順）。曲線の区間の形は`computeSmoothSegmentControls`の式（`Q0`＝前の区間が曲線ならその始点、そうでなければ`2a − b`。`Q3`も同様）。曲線の連なりで決まる。直線の区間とのつなぎ目は角。作業データの版は2のまま（古いエディタでは未知の区間の種類としてその図形がスキップされる）。書き出しの`bezierPath`の`cubic`の制御点は作業データの式の結果。
*   **入力欄とキー（`core/FocusKeyYieldRules`）**：`type`が`checkbox`・`color`の`input`にフォーカスがある間は`Space`を部品に譲り（パンしない）、`Ctrl`なしのショートカットを止める。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`shapes/`に`PathCornerRules.js`（図形クラスではない。図形をまたぐ規則（点の角・なめらかの判定と切り替えの組み立て）。`shapes/`の外から使う）、`palette/`に`OptionBarCornerGroup.js`（オプションバーの「角」のまとまり）、`edit/`に`PathCornerEditor.js`（角の切り替えの1件の編集操作と表示内容の照会）、`test/shapes/PathCornerRules.test.js`・`test/edit/PathCornerEditor.test.js`を足す。
*   **1章 フォルダ分割の方針**：`shapes/`の図形をまたぐ規則に`PathCornerRules`を足す。`edit/`の手順の列に`PathCornerEditor`（規則は`shapes/PathCornerRules`、対象の決定は`core/NudgeTargetRules`）を足す。**依存方向**の(1)に`edit/PathCornerEditor → shapes/PathCornerRules`、(2)の`PathJoinRules`のimportの説明（`Path`から`readCornerFlags`も）と`PathCornerRules → Path`、(3)に`edit/PathCornerEditor → core/NudgeTargetRules`を足す（「この3ファイルだけ」の数を直す）。
*   **1章「存在しないもの」**：「曲線の連なりの途中に角を立てる「この点は角」という情報」を消し、角の点をキャンバス上で見分ける表示、角の点の方向線（ハンドル）、角の切り替えのキー、直線の区間と曲線の区間のつなぎ目をなめらかにすることを足す。
*   **2章`path`**：図形データの形に`corners`（頂点と同じ並びの真偽値の配列。角の点が1つ以上あるときだけ`segments`の直後に出す）、持ち方の理由、形の決め方の式に「区間の始点が角の点なら`Q0`は仮の点、終点が角の点なら`Q3`は仮の点」、角の情報は両側とも曲線の区間の点でだけ形に効くこと、`fromJSON`の`corners`の検証、古いエディタでは図形はスキップされず角の点がなめらかに描かれるだけ（版は2のまま）。
*   **3章 新しい項「点の滑らかさ（角）」**（23.として足す）：流れ（表示・入力）、モジュールの分担（規則`PathCornerRules`・手順`PathCornerEditor`・DOM`OptionBarCornerGroup`・配線`main.js`の`// 7.12.`）、チェックの見た目と押したときの結果の規則、発注者の決定・現場設計の決定、通知が`k`回で取り消し1件、ドラッグ中は受理しない、`change`の後に`blur`する理由（`Space`・ショートカット）、取り消し後に頂点の選択が外れること、やらないこと。
*   **3章6.（履歴）**：記録する操作に「角の切り替え（`PathCornerEditor.toggle`。`replaceShape`の前後。変わらないときは`beginEdit`も呼ばない。鍵なし）」を足す。
*   **3章11.・12.・22.**：結合・描き足し・閉じるで元の途中の角の点は角の点のまま、つながってできた点はなめらかな点（`chainOf`が開いた線の端を偽にする）。
*   **3章13.**：まとまりの一覧に「角」（`#option-corner-group`）を足す。
*   **`_doc/arch/12_shapes.md`**：`ShapeGeometry.computeSmoothSegmentControls`の第4引数、`Path`の`corners`・第7引数・`readCornerFlags`・`toJSON`/`fromJSON`、`PathJoinRules`の`SegmentChain`の`corners`と読むもの（importに`readCornerFlags`）、`PathCornerRules`の項（公開・読むもの・使う側・知らないこと）、`Path`の「頂点の追加・削除を足すときは`corners`も同じ並びで保つ」。
*   **`_doc/arch/13_palette.md`**：`OptionBarCornerGroup.js`の項（`render`・`change`の後の当て直しと`blur`・typedefの二重定義）。
*   **`_doc/arch/14_edit.md`**：`PathCornerEditor.js`の項（import・注入・`getView`・`toggle`・通知の回数）。
*   **`_doc/arch/15_io.md`**：`DocumentSerializer`のJSDocの1文の修正と、角の点は`io/`を変えずに保存・書き出しされること。
*   **`_doc/arch/16_test.md`**：Phase 09-02aの新設・追加分、書き換えた既存のテスト（無しの見込み）、テストできない箇所（`OptionBarCornerGroup`・`main.js`の`// 7.12.`・`index.html`の見た目と1280px幅の収まり・`indeterminate`の見た目・`blur`）、件数（タスク9で記録）。
*   **`_doc/arch/02_main.md`**：主な関数に`performCornerToggle`、配線ブロック`// 7.12.`、注入の一覧、起動時の同期、行数。
*   **`_doc/arch/01_index_html.md`**：オプションバーの右端の`#option-corner-group`・`#option-corner-toggle`・CSS・幅の見積もり（約1189px）。
*   **`_doc/arch/33_FocusKeyYieldRules.md`**：チェックボックスが1つ存在するようになったこと（JSDocの1文の修正）。
*   **`_doc/arch/41_NudgeTargetRules.md`**：使う側に`edit/PathCornerEditor`を足す。

## 3. タスクリスト
*   [x] タスク1: 要件A 形の決め方の式に角の点を足す（`shapes/ShapeGeometry`）
    *   **対象ファイル** :
        *   `./js/shapes/ShapeGeometry.js` : 更新（`computeSmoothSegmentControls`の第4引数・2つの条件とJSDocのみ）
        *   `./test/shapes/ShapeGeometry.test.js` : 更新（(I-1)の`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件A」のとおり、省ける第4引数`cornerFlags = []`を足し、`hasPrev`・`hasNext`の条件に角の点の判定を1つずつ足す。ほかの関数は変えない。
        *   JSDoc（`@param`の第4引数・角の点の規則・省いたときの結果が今と同じこと・両隣の区間だけが変わること・閉じた全点角の性質）を書く。
        *   「2. 要件I」の(I-1)のテストを足す。既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク1に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する（資料本体は直さない）。
*   [x] タスク2: 要件B パスが角の情報を持つ（`shapes/Path`）
    *   **対象ファイル** :
        *   `./js/shapes/Path.js` : 更新（`readCornerFlags`の追加、コンストラクタの第7引数と`corners`、`#segmentControls`、`toJSON`、`fromJSON`と、関係するJSDoc・ファイル先頭の責務定義）
        *   `./test/shapes/Path.test.js` : 更新（(I-2)の`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件B」のとおりにする（データの形・キーの位置・検証の順とエラー文・`readCornerFlags`の形）。18メソッドの一覧・`setVertex`・`translate`・`updateDraftEnd`・ハンドル関係・`isFillable`は変えない。
        *   新しい関数・プロパティ・引数にJSDocを書き、クラス・コンストラクタ・`toJSON`・`fromJSON`（`@throws`）・ファイル先頭の責務定義（3行以内）を実態に合わせる。
        *   「2. 要件I」の(I-2)のテストを足す。既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク2に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク3: 要件C 角の判定と切り替えの組み立て（`shapes/PathCornerRules`）
    *   **対象ファイル** :
        *   `./js/shapes/PathCornerRules.js` : 新規
        *   `./test/shapes/PathCornerRules.test.js` : 新規
    *   **作業内容** :
        *   「2. 要件C」のとおりに、ファイル先頭の責務定義（3行以内）・`CornerState`・`resolveCornerState`・`resolveCornerToggleView`・`planCornerToggle`と非公開の補助（`cornerStateOfData`・図形ごとの`toJSON()`の使い回し）を作る。importは`./Path.js`のみ。図形の`type`・`id`・`toJSON()`だけを読む。
        *   すべての関数・定数・typedef（`CornerTarget`・`CornerToggleView`・`CornerTogglePlanItem`）にJSDocを書く（`CornerToggleView`は`palette/OptionBarCornerGroup.js`との二重定義であることを書く）。
        *   「2. 要件I」の(I-3)のテストを作る。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク3に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク4: 要件D 結合・描き足し・閉じるで角の点を保つ（`shapes/PathJoinRules`）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新（importの`readCornerFlags`、typedef`SegmentChain`、`chainOf`・`reverseChain`・`assembleOpenPath`・`buildExtendedPath`・`buildClosedPath`と、関係するJSDoc・ファイル先頭の責務定義）
        *   `./test/shapes/PathJoinRules.test.js` : 更新（(I-4)の`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件D」のとおりにする。開いた線の端を偽にするのは`chainOf`の1か所だけにし、頂点・区間の種類・角の情報を並べるのは`assembleOpenPath`・`buildClosedPath`・`reverseChain`だけにする（二重に書かない）。作成途中の線の組み立て・計画の関数・判定の関数のコードは変えない。
        *   JSDoc（`SegmentChain`・`chainOf`・`reverseChain`・`assembleOpenPath`・`buildClosedPath`・`buildExtendedPath`・`buildJoinedPath`・`buildJoinedPathAt`・ファイル先頭の責務定義（3行以内））を実態に合わせる。
        *   「2. 要件I」の(I-4)のテストを足す。既存のケースは変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク4に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク5: 要件E 角の切り替えの1件の編集操作（`edit/PathCornerEditor`）
    *   **対象ファイル** :
        *   `./js/edit/PathCornerEditor.js` : 新規
        *   `./test/edit/PathCornerEditor.test.js` : 新規
    *   **作業内容** :
        *   「2. 要件E」のとおりに、ファイル先頭の責務定義（3行以内）・クラス（コンストラクタ`{ model, editRecorder, getMode }`・`getView`・`toggle`・非公開の`#collectTargets`）を作る。クラスJSDocに依存の制約（importは2モジュールの3関数のみ、`model`・`editRecorder`の使うメソッド、操作モードを解釈しない、図形種別の分岐・図形固有のプロパティ名を持たない、`try/catch`を持たない、再描画・UI同期を呼ばない）と前提（ドラッグ中でないことは呼び出し側）を書く。
        *   すべてのメソッド・フィールドにJSDocを書く。
        *   「2. 要件I」の(I-5)のテストを作る。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク5に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク6: 要件H 保存・書き出しのテスト（`io/`。コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` : 更新（`describe`の追加のみ）
        *   `./test/io/DocumentSerializer.errors.test.js` : 更新（ケースの追加のみ）
        *   `./test/io/SpriteSerializer.test.js` : 更新（`describe`の追加のみ）
        *   `./test/io/CodeExporter.test.js` : 更新（`describe`の追加のみ）
        *   `./js/io/DocumentSerializer.js` : 更新（typedef`DocumentData`のJSDocの1文のみ。コードは変えない）
    *   **作業内容** :
        *   「2. 要件I」の(I-6)のテストを足す（既存の補助関数を使う。既存のケースは変えない）。
        *   「2. 要件H」のとおり、`DocumentSerializer.js`のJSDocの1文を直す。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク6に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク7: 要件F・要件J 「角」のチェックボックスのUI部品と要素（`palette/OptionBarCornerGroup`・`index.html`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarCornerGroup.js` : 新規
        *   `./index.html` : 更新（`#option-corner-group`の要素の追加、`<style>`への2つのルールの追加、幅の見積もりのコメントの更新のみ）
        *   `./js/core/FocusKeyYieldRules.js` : 更新（`SPACE_OPERATED_INPUT_TYPES`のJSDocの1文のみ。コードは変えない）
    *   **作業内容** :
        *   「2. 要件F」のとおりに、ファイル先頭の責務定義（3行以内）・typedef（`CornerToggleView`の二重定義であることを書く・`OptionBarCornerGroupActions`）・クラス（コンストラクタ・`render`・非公開の`#applyView`・`change`の後の当て直しと`blur`）を作る。importを持たない。既存のまとまりの作り（`OptionBarAlignGroup`）にそろえる。
        *   `index.html`に「2. 要件F」の要素とCSSを足し、幅の見積もりのコメントに角のまとまり（区切り17px＋約34px）と合計約1189pxを足す。既存の要素・ルールは変えない。
        *   「2. 要件J」のとおり、`FocusKeyYieldRules.js`のJSDocの1文を直す。
        *   すべてのメソッド・フィールドにJSDocを書く。DOMのためテストは置かない。
        *   `node --test`が全件通ることを確かめる（このタスクでは件数は変わらない）。
        *   完了後、本RESの「4. 詳細作業内容」のタスク7に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク8: 要件G `main.js`の配線（`// 7.12.`）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新（importの2行、`// 7.12.`のブロック、起動時の同期の1か所のみ）
    *   **作業内容** :
        *   「2. 要件G」のとおりに、`PathCornerEditor`・`OptionBarCornerGroup`の生成・注入、`performCornerToggle`（ドラッグ中は`false`）、`syncOptionBarCornerGroup`と`model.onChange`への登録、起動時の1回の同期を足す。判定・計算・機能専用の同期経路を足さない。`KeyboardShortcuts`の注入・既存のブロックは変えない。
        *   `performCornerToggle`・`syncOptionBarCornerGroup`にJSDocを書き、ブロックのコメントを既存の`// 7.11.`にそろえる。
        *   `node --test`が全件通ることを確かめる。変更後の`main.js`の行数を記録する（タスク11で資料へ書く）。
        *   完了後、本RESの「4. 詳細作業内容」のタスク8に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク9: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。不備があればタスク1〜8の対象ファイルの中でだけ直す）
    *   **作業内容** :
        *   タスク1〜8で足した・変えた関数・定数・typedef・引数・フィールドのJSDocに漏れが無いこと、新しいファイル・変えたファイルの先頭の責務定義が3行以内で実態に合うことを確かめる。
        *   変えたファイルがタスクの対象ファイルだけであること（`git status`・`git diff --stat`で確かめる。`js/core/`は`FocusKeyYieldRules.js`のJSDocの1文だけ、`js/io/`は`DocumentSerializer.js`のJSDocの1文だけ、`js/core/VectorModel.js`・`js/core/InputTracker.js`・`js/core/KeyboardShortcuts.js`・`js/core/ShapeFactory.js`・`js/edit/`の既存のファイル・`js/palette/`の既存のファイル・`js/check/`・`js/wiring/`・`asset/`・`sprite-check.html`は不変）、改名・整形・不要に見えるコードの削除をしていないことを確かめる。
        *   規則の二重定義が無いこと（形の決め方の式は`ShapeGeometry`、`corners`の読み方は`readCornerFlags`、角を操作できるかの判定は`resolveCornerState`、チェックの見た目と押したときの結果は`resolveCornerToggleView`、頂点と角の情報の並べ方は`PathJoinRules`の`chainOf`・`reverseChain`・`assembleOpenPath`・`buildClosedPath`）を`Grep`で確かめる。
        *   `node --test`が全件通ることを確かめ、件数（tests / suites / pass / fail）を記録する。既存のケースの期待値を書き換えていないこと（書き換えた場合はケースと理由）を記録する。
        *   完了後、本RESの「4. 詳細作業内容」のタスク9に確認結果を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク10: 要件K テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （本RESのみ）
    *   **作業内容** :
        *   「2. 要件K」の確認項目0〜10を、本RESの「4. 詳細作業内容」のタスク10へ写し、実装の結果に合わせて文言を確かめる（実装で判明した注意点があれば足す）。最終報告でも提示する。
*   [ ] タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/15_io.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
        *   `./_doc/arch/33_FocusKeyYieldRules.md` : 更新
        *   `./_doc/arch/41_NudgeTargetRules.md` : 更新
    *   **作業内容** :
        *   本タスクは、実装AIによる開発資料の書き換えが原則禁止の本ワークフローにおいて、**明示的な例外**として行う（後続タスクが無く、資料の変更で他タスクの前提が動く危険が無いため）。上のファイル（本タスクでパス指定する`_doc/arch/`のファイル）だけを読み・直す。
        *   本RESの「2. 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」と、各タスクで追記された分を確かめ、資料へ反映する。少なくとも、`PROJECT_ARCHITECTURE.md`の2章`path`（角の情報の持ち方・形の決め方の式・古いエディタでの扱い）、3章の新しい項「点の滑らかさ（角）」（流れ・モジュールの分担・発注者の決定・現場設計の決定・やらないこと）、3章6.・11.・12.・13.・22.、1章の構成図・フォルダ分割の方針（依存方向の例外の列を含む）・「存在しないもの」を直す。
        *   資料の記載基準（`PROJECT_ARCHITECTURE.md`冒頭）に従い、1つのファイルのJSDocを読めば分かることは書かない。誤った記述は直すか消す。
        *   `_doc/arch/16_test.md`の件数はタスク9で記録した値、`_doc/arch/02_main.md`の行数はタスク8で記録した値を使う。
        *   完了後、本RESの「4. 詳細作業内容」のタスク11に反映した箇所を記載する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件A 形の決め方の式に角の点を足す（`shapes/ShapeGeometry`）
*   **作業内容** :
    *   `js/shapes/ShapeGeometry.js`：`computeSmoothSegmentControls(points, smoothFlags, closed, cornerFlags = [])`に第4引数を足し、`hasPrev`に`cornerFlags[i] !== true`、`hasNext`に`cornerFlags[(i + 1) % n] !== true`を足した（式の変更はこの2条件のみ）。JSDocに角の点の規則・省いたときの結果が同じこと・両隣の区間だけが変わること・閉じた全点角の性質・`@param cornerFlags`を追記。
    *   `test/shapes/ShapeGeometry.test.js`：`describe('computeSmoothSegmentControls 角の点（Phase 09-02a）')`を末尾に追加（8ケース。(I-1)の項目を網羅）。既存ケースの変更なし。
    *   `node --test`：tests 1787 / suites 282 / fail 0。

### タスク2: 要件B パスが角の情報を持つ（`shapes/Path`）
*   **作業内容** :
    *   `js/shapes/Path.js`：公開関数`readCornerFlags(data)`、コンストラクタ第7引数`corners`と公開プロパティ`corners`（常に`points`と同じ要素数・写して保持）、`#segmentControls`の第4引数、`toJSON`（角の点があるときだけ`segments`直後に`corners`）、`fromJSON`（`segments`検査の後に`corners`を検証。エラー文3種。生成は`readCornerFlags(data)`を第7引数へ）を足し、JSDoc・ファイル先頭の責務定義・`@throws`を実態に合わせた。18メソッド・`setVertex`・`translate`・`updateDraftEnd`・ハンドル関係・`isFillable`は変えていない。
    *   `test/shapes/Path.test.js`：importに`readCornerFlags`を足し、末尾に`describe('Path の角の点（Phase 09-02a）')`を追加（14ケース。(I-2)の項目を網羅）。既存ケースの変更なし。
    *   `node --test`：tests 1801 / suites 283 / fail 0。

### タスク3: 要件C 角の判定と切り替えの組み立て（`shapes/PathCornerRules`）
*   **作業内容** :
    *   `js/shapes/PathCornerRules.js`（新規）：責務定義（3行）・`CornerState`・`resolveCornerState`・`resolveCornerToggleView`・`planCornerToggle`、非公開の`cornerStateOfData`・`dataOf`（呼び出しごとの`Map`で図形ごとに1回だけ`toJSON()`）・`statesOf`、typedef 3種（`CornerToggleView`は二重定義と明記）。importは`./Path.js`のみ。全関数・定数・typedefにJSDoc。
    *   `test/shapes/PathCornerRules.test.js`（新規）：`resolveCornerState`6・`resolveCornerToggleView`5・`planCornerToggle`7ケース（(I-3)の項目を網羅）。
    *   `node --test`：tests 1820 / suites 286 / pass 1820 / fail 0。既存ケースの変更なし。

### タスク4: 要件D 結合・描き足し・閉じるで角の点を保つ（`shapes/PathJoinRules`）
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：importに`readCornerFlags`、`SegmentChain`に`corners`、`chainOf`（`readCornerFlags`の新配列で先頭・末尾を偽にする唯一の箇所）、`reverseChain`（`corners`も逆順）、`assembleOpenPath`（`merge`で`bCorners`も同じ端を除き連結して第7引数へ）、`buildExtendedPath`（`corners: [false]`）、`buildClosedPath`（`chainOf`から`points`・`kinds`・`corners`の写しを取り、重なるとき`points`と`corners`を一緒に`pop`）を変更。関係するJSDoc・ファイル先頭の責務定義（3行のまま）を更新。作成途中の線の組み立て・計画の関数・判定の関数のコードは不変。
    *   `test/shapes/PathJoinRules.test.js`：末尾に補助2つ（`makeCornerPath`・`cornersOf`）と`describe('角の点を保つ（Phase 09-02a）')`（13ケース。(I-4)の項目を網羅）を追加。既存ケースの変更なし。
    *   `node --test`：tests 1833 / suites 287 / pass 1833 / fail 0。

### タスク5: 要件E 角の切り替えの1件の編集操作（`edit/PathCornerEditor`）
*   **作業内容** :
    *   `js/edit/PathCornerEditor.js`（新規）：責務定義（3行）・クラス（コンストラクタ`{ model, editRecorder, getMode }`・`getView`・`toggle`・非公開`#collectTargets`）。importは`core/NudgeTargetRules`の`resolveNudgeTarget`と`shapes/PathCornerRules`の`resolveCornerToggleView`・`planCornerToggle`のみ。クラスJSDocに依存の制約と前提（ドラッグ中でないことは呼び出し側）を記載。全メソッド・フィールドにJSDoc。
    *   `test/edit/PathCornerEditor.test.js`（新規）：12ケース・3 describe（対象の集め方と`getView`5・`toggle`5・実物の`HistoryManager`/`SnapshotAdapter`との組み合わせ2。(I-5)の項目を網羅）。
    *   `node --test`：tests 1845 / suites 290 / pass 1845 / fail 0。既存ケースの変更なし。

### タスク6: 要件H 保存・書き出しのテスト（`io/`。コードは変えない）
*   **作業内容** :
    *   `test/io/DocumentSerializer.roundtrip.test.js`：`describe('角の点を含むパスの往復（Phase 09-02a）')`を末尾に追加（開いた・閉じた×オブジェクト層・文字列層の4ケース＋角なしで`corners`キーが出ないこと1ケース）。
    *   `test/io/DocumentSerializer.errors.test.js`：importに`Path`・`SEGMENT_KIND_SMOOTH`を足し、`describe('不正な corners のスキップ（Phase 09-02a）')`を追加（配列でない・null・要素数違い・真偽値でない要素の4ケース。図形単位でスキップされ残りが復元される）。
    *   `test/io/SpriteSerializer.test.js`：`describe('角の点を含むパスの bezierPath（Phase 09-02a）')`を追加（開いた・閉じた。制御点が`toDrawElement`と一致し角なしと違うこと、外枠が`sampleBezierPathRange`と一致）。
    *   `test/io/CodeExporter.test.js`：`describe('見た目の一致（角の点を含むパス。Phase 09-02a）')`を追加（開いた・閉じた・塗りあり・角なしと描画命令が違うこと。`assertSameAsEditor`使用）。
    *   `js/io/DocumentSerializer.js`：typedef`DocumentData`のJSDocの1文のみ修正（コード不変）。
    *   `node --test`：tests 1860 / suites 294 / pass 1860 / fail 0。既存ケースの変更なし。

### タスク7: 要件F・要件J 「角」のチェックボックスのUI部品と要素（`palette/OptionBarCornerGroup`・`index.html`）
*   **作業内容** :
    *   `js/palette/OptionBarCornerGroup.js`（新規）：責務定義（3行）・typedef`CornerToggleView`（二重定義と明記）・`OptionBarCornerGroupActions`・クラス（コンストラクタ・`render`・非公開`#applyView`・`change`でコールバック→`#applyView(#lastView)`の当て直し→`blur`）。importなし。全メンバにJSDoc。
    *   `index.html`：`#option-align-group`の直後に`#option-corner-group`を追加。`<style>`に`.option-corner-label`・`#option-corner-toggle:disabled + .option-corner-text`の2ルールを追加。幅の見積もりのコメントに角のまとまり（区切り17px＋約34px）と合計約1189pxを追記。既存の要素・ルールは不変。
    *   `js/core/FocusKeyYieldRules.js`：`SPACE_OPERATED_INPUT_TYPES`のJSDocの1文のみ修正（コード不変）。
    *   `node --test`：全件合格を確認（件数は変わらない見込み。実行結果は最終報告のとおり）。

### タスク8: 要件G `main.js`の配線（`// 7.12.`）
*   **作業内容** :
    *   `js/main.js`：importに`PathCornerEditor`・`OptionBarCornerGroup`を追加（`OptionBarAlignGroup`の直後）。`// 7.11.`の`model.onChange(syncOptionBarAlignGroup);`の直後・`// 8.`の前に`// 7.12.`ブロックを追加（`pathCornerEditor`の生成、JSDoc付き`performCornerToggle`（ドラッグ中は`false`）、`optionBarCornerGroup`の生成、JSDoc付き`syncOptionBarCornerGroup`と`model.onChange`への登録）。起動時の同期は`syncOptionBarAlignGroup();`の直後にコメント付きで`syncOptionBarCornerGroup();`を1回追加。既存のブロック・`KeyboardShortcuts`の注入は不変（監査の指摘で、誤って空白が消えていた`// 8. キーボードショートカット配線`の行を元に戻した）。
    *   変更後の`main.js`の行数：1053行。
    *   `node --test`：tests 1860 / suites 294 / pass 1860 / fail 0。既存ケースの変更なし。
    *   開発資料への影響：「開発資料の更新予定」の`02_main.md`の項のとおりで、追記なし。

### タスク9: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   （未実施）

### タスク10: 要件K テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （未実施）

### タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
* （計画時点）**取り消し・やり直しの後は頂点の選択が外れる**：`replaceAllShapes`が選択集合・頂点の選択をクリアし、`shouldRestoreSelection`は図形の選択だけを戻すため（今までの頂点の移動の取り消しと同じ既存のふるまい）。取り消した直後はチェックボックスが押せない見た目になる。テストプレイの確認項目7に書いた。
* （計画時点）**複数の図形の点を切り替えると変更通知が図形の数だけ出る**：`VectorModel`に複数置き換えのメソッドを足さず`replaceShape`を図形ごとに呼ぶため（取り消しは1件）。1回ずつ正しい状態のため見た目は崩れない見込み。
* （計画時点）**チェックボックスは`change`の後にフォーカスを外す**：`Space`での意図しない切り替えとショートカットの停止を避けるため（要件F）。`Tab`でフォーカスを移してキーボードだけで続けて切り替えることはできない（切り替えのたびに`Tab`で戻る）。実際のブラウザでの`indeterminate`の「−」の見た目・`blur`のふるまい・1280px幅での収まり（見積もり約1189px）は`node --test`で確かめられないため、テストプレイで確かめる。
* （計画時点）**すべて`false`の`corners`を持つ作業データは、読み込んで保存し直すとキーが消える**（`toJSON()`は角の点があるときだけ出すため。本アプリは書き出さない形で、形は変わらない。許容）。
* （タスク5）`PathCornerEditor`は図形の`getVertexIndexForHandle`が`null`を返すものだけを飛ばす。`Line`など`path`以外の図形は`resolveCornerState`が`NONE`にするため、押せない・変わらない扱いになる（テストで確認）。取り消し後に頂点の選択が外れることはテストでは確認していない（`SnapshotAdapter`の既存のふるまい）。開発資料への影響は「開発資料の更新予定」の`14_edit.md`・`16_test.md`の項のとおりで、追記なし。
* （タスク2）`Path.js`の`fromJSON`の`corners`検査は、`corners`のキーが`undefined`のときだけ検査を飛ばす（`null`は「配列ではありません」で例外）。`fromJSON`はコンストラクタに`SEGMENT_KIND_LINE`を渡してから`segments`を作り直す従来の流れのまま。
