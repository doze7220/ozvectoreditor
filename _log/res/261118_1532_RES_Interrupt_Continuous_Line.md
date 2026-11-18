# RES: 作業計画・作業レポート (Interrupt) : 直線のツールで線を続けて引く
* 参照元REQ: `./_log/req/261118_1514_REQ_Interrupt_Continuous_Line.md`

## 1. 作業目的
直線のツール（`1`）を、今の「クリックで描き始め → クリックで描き終え」の2クリックで1本を作る操作から、**クリックごとに点を打ち、決まった操作で終える**操作に変える（Photoshopのペンの直線の打ち方に近い操作）。点が2つで終えたら今と同じ直線（`line`）、3つ以上ならパス（直線の区間だけの`path`。開いたまま終えたら開いたパス、始点に吸い付いて終えたら閉じたパス）を作る。

守ること（REQの最上位の要件）：
*   リポジトリのルートの`node --test`が全件通る。既存のテストの期待値は変えない（本計画では変える既存のケースは**無い**見込み。変えた場合は「4. 詳細作業内容」と「5. 懸念事項」に理由を書く）。作業開始前の件数は **tests 1543 / suites 230 / pass 1543 / fail 0**。
*   作業データ形式・書き出し形式の版は2のまま。新しい図形種別・区間の種類を足さない（作るのは既存の`line`と、区間がすべて`'line'`の`path`）。
*   直線以外のツール（曲線・弧・矩形・円）のふるまい、選択（`V`）・頂点の選択（`A`）・キャンバス移動（`H`）のモードのふるまい（端点のハンドルのドラッグでの吸い付きと結合を含む）を一切変えない。
*   改名・整形・「不要に見えるコードの削除」を行わない。既存の公開メソッド名・フィールド名・DOMのid・クラス名は変えない（意味が広がるものは名前を変えずにJSDocを実態に合わせる）。キーの割り当ての表（`KeyboardShortcuts.js`の`SHORTCUT_BINDINGS`）は変えない。

**用語**（本計画書・コード・資料で使い分ける。REQの用語のまま）：
*   **線を引いている途中**：直線のツールで1点目を打ってから終えるまでの間（入力状態`DRAWING`で、作成途中の図形が直線のツールの線のとき）。
*   **打った点**：クリックで確定した点（1点目＝**始点**を含む）。**最後の点**＝最後に打った点。
*   **付いてくる線**：最後の点からカーソルまでの、まだ確定していない区間。その先の点を「**付いてくる線の先**」と呼ぶ。
*   **開いたまま終える**：打った点だけで線を確定する（付いてくる線は捨てる）。**閉じて終える**：打った点で閉じたパスを確定する。
*   **端点への吸い付き**（既存。3章12.）と**スナップ**（既存。3章17.）は別の機能で、用語を混ぜない。新しく足す「**始点への吸い付き**」は、作成途中の線の自分の始点へ吸い付くこと（端点への吸い付きの一種として同じ表示・同じ距離を使うが、照会の結果は種類で区別する）。
*   **作成途中の線**（コードのJSDocで使う語）：線を引いている途中の作成途中の図形。頂点の並び＝「打った点（先頭が始点）」＋「付いてくる線の先（末尾の1つ）」。打った点が1つの間は`Line`（始点・付いてくる線の先）、2つ以上になったら開いた`Path`（最後の頂点が付いてくる線の先）。

## 2. アーキテクチャ設計

### 全体の流れ（新しい経路を作らず、既存の経路に載せる）

**状態の持ち主（二重に持たない）**：打った点の並びは`VectorModel`の作成途中の図形（`#draftShape`）だけが持つ。`InputTracker`は点の並びを持たず、吸い付きの作業用フィールドも**新しく足さない**（既存の`#drawStartSnap`＝描き始めの端点、`#drawEndSnap`＝直前の`mousemove`の照会結果だけを使う。どちらも今どおり`#resetSnapState()`で消える）。

**責務の分担**：
| 役割 | 置き場所 | 中身 |
| --- | --- | --- |
| 点の並びの規則（状態なし） | `shapes/PathJoinRules.js`（既存へ追加） | 作成途中の線から「点を打った線」「最後の点を消した線」「終えた線（開いた／閉じた）」を組み立てる（点2つの開いた線は`Line`、それ以外は`Path`＝**直線とパスの作り分けはここ**）。最後の点の照会、付いてくる線の先が最後の点と重なるかの判定、閉じられるか（打った点が3つ以上か）の判定。`planDrawnLineJoin`を点が複数の線へ広げる |
| 吸い付きの規則（状態なし） | `shapes/EndpointSnapRules.js`（既存へ追加） | 線を引いている途中の照会：描き始めの端点を除いた端点＋（描き始めが端点でなく、打った点が3つ以上なら）自分の始点。始点の結果は種類の項目で区別する |
| 丸めの規則（状態なし） | `core/UnitSnapRules.js`（既存へ追加） | 基準点＋向きを限定した移動量を、限定した直線の上に保って丸めた位置 |
| 向きの限定の規則 | `core/MoveDirectionRules.js`（**変更なし**） | `constrainMoveDirection`をそのまま使い回す |
| 作成途中の図形の持ち主 | `core/VectorModel.js`（既存へ追加） | `replaceDraft(shape)`：作成途中の図形を渡された図形に置き換える（idは`null`・直前に使った値を当てる・`#shapes`に入れない・通知1回） |
| 線を引く手順 | `edit/EndpointSnapper.js`（既存へ追加） | 点を打つ・最後の点を消す・終える（開いたまま／閉じて／ほかの線とつながって）の判定の呼び出しとモデルへの反映・履歴への記録（1回の終わり方で1件。点を打つ・消すでは記録先に触れない） |
| 入力の配線 | `core/InputTracker.js`（既存へ追加） | 線を引いている途中か（注入された補助へ照会）で`mousemove`・`click`・`Esc`の分岐を足す。新しい公開操作3つ（ツールの切り替えの前に終える・最後の点を消す・キーの`Backspace`/`Delete`の実体）。`Shift`の読み取り |
| ツールの切り替え・取り消し・キーの配線 | `main.js`（既存へ追加）・`core/KeyboardShortcuts.js`（typedefのJSDocのみ） | ツールの切り替えの経路だけが先に「終える」を呼ぶ。`performUndo`が先に「最後の点を消す」を呼ぶ。キーの`deleteSelection`の実体を新しい公開操作にする |

**直線とパスの作り分けを`shapes/PathJoinRules.js`に置く理由**（REQの「作り分けの置き場所は計画で決め、理由を書くこと」）：
1.  作り分けを使うのは、作成途中の線を組み立て直す`edit/EndpointSnapper`だけで、`edit/EndpointSnapper`はすでに`shapes/PathJoinRules`を直接importしている（`edit/ → shapes/`の既存の例外）。`ShapeFactory`へ入口を足すと、`EndpointSnapper`が新たに`core/ShapeFactory`をimportする（例外の追加）か、`VectorModel`が点の並びを読む（`VectorModel`は図形固有の頂点構造・図形データを知らない約束に反する）ことになる。
2.  終えた線の描き足し・つながり・閉じるの結果は`PathJoinRules`がすでに`Path`のコンストラクタで組み立てており、閉じたパスの頂点数の下限（非公開の`CLOSED_MIN_POINTS`）・結合できる線の判定（`isJoinableLine`）・描き足し（`buildExtendedPath`）を同じファイルで共有できる。別ファイルにすると、これらを`export`するか二重に定義することになる（REQの「同じ規則の二重定義」の禁止）。
3.  `core/`で図形種別の対応づけを持てるのは`ShapeFactory`だけ、の約束は守られる（`VectorModel`・`InputTracker`は図形種別の分岐を持たない。`shapes/`は図形種別を知ってよい層）。`ShapeFactory.js`は**変更しない**。
*   代わりに`PathJoinRules`の責務定義を「結合の規則」から「結合の規則と、続けて引く線の点の並びの規則」へ広げ、新たに`./Line.js`をimportする（`Line`のimportは`ShapeGeometry`・`ShapeDataValidation`だけのため循環しない）。

**作成途中の図形の持ち方**（REQの「点が2つの間は直線、3つ以上になったらパス」の案をそのまま採る）：打った点が`k`個のとき、作成途中の図形の頂点は`k + 1`個（末尾＝付いてくる線の先）。`k = 1`は`Line`、`k ≥ 2`は開いた`Path`。付いてくる線の先の追従は今と同じ`model.updateDraft(x, y)` → 図形の`updateDraftEnd`（`Line`は終点、`Path`は最後の頂点。どちらも既存のメソッドのまま）。描画は`CanvasManager`が作成途中の図形をポリモーフィックに描くため変更不要（アウトライン表示も同じ）。

**線を引いている途中か**の判定：`InputTracker`は図形種別を知らないため、注入された補助（`EndpointSnapper`）の`isDrawingLine()`へ照会する（実体は「作成途中の図形があり、それが結合できる線（`PathJoinRules.isJoinableLine`＝直線・開いたパス）か」）。直線のツールの作成途中の図形は常に`Line`か開いた`Path`で、曲線・弧・矩形・円の作成途中の図形は結合できる線ではないため、直線のツールのときだけ真になる。補助が注入されない（既定の`NO_SNAP_ASSIST`）ときは常に偽で、今の2クリックの直線のまま動く。`InputTracker`は加えて「入力状態が`DRAWING`か」を自分で確かめる（`#isDrawingLine()`＝`this.state === InputState.DRAWING && this.#snapAssist.isDrawingLine()`）。

**操作ごとの流れ**（線を引いている途中のみ。それ以外は今のまま）：
| 操作 | 流れ |
| --- | --- |
| 1点目（描き始め）のクリック | **今のまま**（`handleClick`の`IDLE`・図形作成モードの枝：`findDrawSnap`で照会 → `#drawStartSnap`へ保持・表示 → 吸い付けば端点の座標、なければスナップで丸めたクリック位置で`startDraft` → `DRAWING`） |
| `mousemove` | 照会`snapAssist.findDrawnLineSnap(#drawStartSnap, 丸めていないカーソル位置)`（`Ctrl`の間は照会せず`null`）→ `#drawEndSnap`へ保持・`#showSnap` → 付いてくる線の先＝吸い付けばその座標、吸い付かず`Shift`なら最後の点（`snapAssist.getDrawnLineLastPoint()`）から`constrainMoveDirection`で限定した移動量を`roundConstrainedPointFromOriginToUnit`で丸めた位置、それ以外は今どおり`roundPointToUnit` → `model.updateDraft` |
| クリック | `snapAssist.clickDrawnLine(#drawStartSnap, #drawEndSnap)`。戻り値が偽（終えた）なら`IDLE`へ戻して`#resetSnapState()`、真（点を打って引き続ける）なら`#drawEndSnap`を`null`・`#showSnap(null)` |
| `Esc` | `cancelDraftOrClearSelection()`の`DRAWING`の枝で、線を引いている途中なら`snapAssist.finishDrawnLine(#drawStartSnap)`（開いたまま終える）→ `IDLE`・`#resetSnapState()`・`true`。直線のツール以外は今どおり`cancelDraft` |
| `Backspace`/`Delete` | キーの`deleteSelection`の実体を新しい公開操作`deleteLastLinePointOrSelection()`にする：線を引いている途中なら`removeLastLinePoint()`（最後の点を消す）、それ以外は今どおり`deleteSelection()` |
| 取り消し（`Ctrl`+`Z`・ボタン） | `performUndo`：ドラッグ中は不受理（今のまま）→ **`inputTracker.removeLastLinePoint()`が真ならそこで終わり（履歴に触れない）** → 今どおり`abortOngoingOperation()`で作成途中の図形を捨てたらそこで終わり → `historyManager.undo()` |
| ツールの切り替え（数字キー・`V`・`A`・`P`・`H`・`I`・ツールパレットのボタン） | `main.js`のツールの切り替えの経路だけが、先に`inputTracker.finishLineDrawing()`（線を引いている途中なら開いたまま終える。**パンのドラッグ中でも終える**。それ以外は何もしない）を呼んでから今どおり切り替える。中ボタンのパン中にツールパレットのボタンを押した場合も描いた分が残り、パンのドラッグは続く`setMode`の`#abortOngoingOperation`が中断する（図形作成モードのまま図形のツールを選んだときは`setMode`を通らず、パンは今どおり続く）。キーの切り替えは`KeyboardShortcuts`がドラッグ中は実行しないため、パン中には来ない |
| それ以外の中断（キャンバスの切り替え・開く・読み込み・貼り付け・全選択・選択の反転・`?dev`の復元・やり直し） | **今のまま**（`applyMode` → `setMode` → `#abortOngoingOperation`、または`abortOngoingOperation`で捨てる） |
| パン・ズーム | **今のまま**（`DRAWING`を保ったまま行える。パンの開始で表示だけを消し`#drawEndSnap`は残す。ズームでは照会し直さない）。パン中のツールパレットのボタンは上の「ツールの切り替え」の行のとおり描いた分を残して終える |

**クリックの判定の順**（`EndpointSnapper.clickDrawnLine`。判定は規則の関数を呼ぶだけ）：
1.  `#drawEndSnap`が始点への吸い付きで、作成途中の線が閉じられる（打った点が3つ以上）→ **閉じて終える**。
2.  付いてくる線の先が最後の点と重なる（`isOnLastDrawnPoint`。距離は`PathJoinRules.JOIN_TOLERANCE_SCREEN_PX`＝画面上5pxをその時点の表示倍率でワールドへ換算）→ **開いたまま終える**（点が1つならやめる）。「同じ位置で2回クリック」（ダブルクリック）は、1回目で点を打ち（付いてくる線の先＝打った点）、2回目がこれに当たる。
3.  `#drawEndSnap`が端点への吸い付き → **その線とつながって終える**（既存の`commitDrawnLine(#drawStartSnap, #drawEndSnap)`。作成途中の線は付いてくる線の先＝吸い付いた端点を含んだまま渡す。点が1つなら今の2クリックの直線の描き終えと入力も結果も同じ）。
4.  それ以外 → **点を打つ**（付いてくる線の先を打った点にし、同じ位置に新しい付いてくる線の先を足す。記録しない）。

**記録（取り消し1件）**：
*   終える（開いたまま・閉じて・つながって・描き足し）は、`EndpointSnapper`の中で**1回の終わり方につき`beginEdit`/`commitEdit`の1組**。吸い付きなし（描き始めが端点でない開いたまま・閉じて）は`model.replaceDraft(終えた線)` → `beginEdit` → `model.commitDraft()` → `commitEdit`（直前に使った値のスタイル・新しいid）。描き足し・つながり・閉じる（既存の線）は既存の`commitDrawnLine`と同じ`cancelDraft` → `beginEdit` → `replaceShape`（`select: false`）→ `commitEdit`（基準の線のスタイル）。何も起きない計画（点が1つ・重なって足す点が無い等）は記録しない。
*   点を打つ・最後の点を消すは`model.replaceDraft`（または点が1つで消したときは`model.cancelDraft`）だけで、記録先に触れない。選択集合は変えない（作成モードでは空のまま）。

**REQの要件と本計画の設計の対応**：
| REQの要件 | 本計画の設計 |
| --- | --- |
| 要件1 クリックごとに点を打つ | 要件1（`addDrawnPoint`）・要件4（`replaceDraft`）・要件5（`clickDrawnLine`の4.）・要件6（`mousemove`・`click`） |
| 要件2 終わり方 | 要件1（`buildFinishedDrawnLine`・`isOnLastDrawnPoint`・`canCloseDrawnLine`）・要件2（始点への吸い付き）・要件5（`clickDrawnLine`の1.〜3.・`finishDrawnLine`）・要件6（`Esc`・`finishLineDrawing`）・要件7（ツールの切り替え） |
| 要件3 既存の線とのつながり | 要件1（`planDrawnLineJoin`の拡張）・要件2（描き始めの端点の除外）・要件5（`commitDrawnLine`・`finishDrawnLine`） |
| 要件4 途中の戻し | 要件1（`removeLastDrawnPoint`）・要件5（`removeDrawnLinePoint`）・要件6（`removeLastLinePoint`・`deleteLastLinePointOrSelection`）・要件7（`performUndo`・キーの配線） |
| 要件5 `Shift`で向きを限定 | 要件1（`getLastDrawnPoint`）・要件3（`roundConstrainedPointFromOriginToUnit`）・要件6（`mousemove`の`Shift`） |
| 要件6 テスト | 要件8 |
| 要件7 テストプレイの確認項目 | 要件9 |

---

### 要件1: 作成途中の線の点の並びの規則と、描き足し・つながり・閉じるの計画の拡張（`js/shapes/PathJoinRules.js`。既存へ追加。`js/shapes/Path.js`はJSDocのみ）

**ファイル先頭の責務定義**（3行以内に収める。例）：
「責務: 線（直線・開いたパス）の結合の規則（受理条件・閉じる／2本の結合／端点を指定した結合・描き足し・吸い付いた端点での操作の計画）と、直線のツールで続けて引く作成途中の線の点の並びの規則（点を打つ・最後の点を消す・終えた線の組み立て。点2つの開いた線は直線、それ以外はパス）を、/ 状態を持たない関数と定数として提供する。表示倍率・モデル・履歴を知らず、ワールド座標の許容距離を引数で受け取る。」

**import**：`./Path.js`に加えて`./Line.js`（`Line`）。ほかは足さない。

**作成途中の線（`drawn`）の約束**（新しい関数のJSDocに書く）：結合できる線（`isJoinableLine`が真＝`Line`か開いた`Path`）で、`toJSON().points`の並び＝打った点（先頭＝始点）＋付いてくる線の先（末尾）。頂点は2つ以上。結合できる線でない図形が渡されたら、新しい関数は`null`（`isOnLastDrawnPoint`・`canCloseDrawnLine`は`false`）を返す。**どの関数も引数を書き換えず、結果は引数と配列・頂点を共有しない新しいインスタンス／オブジェクト**。結果の`id`は`null`。結果のスタイル（`strokeColor`・`strokeWidth`・`fillColor`）は`drawn.toJSON()`の値（作成途中の線のスタイル）。

**非公開の定数・関数（新規）**：
*   `LINE_POINT_COUNT = 2`（直線の頂点数。`Line.js`の非公開の同名定数と同じ値であるべき別の定義である旨をJSDocに書く。`CLOSED_MIN_POINTS`と同じ扱い）。
*   `buildLineOrPath(points, closed, data)`：**直線とパスの作り分けの唯一の箇所**。`closed`が偽で`points.length === LINE_POINT_COUNT`なら`new Line(p0.x, p0.y, p1.x, p1.y, data.strokeColor, data.strokeWidth, data.fillColor)`、それ以外は`new Path(points, closed, data.strokeColor, data.strokeWidth, data.fillColor)`。頂点数の検証はしない（呼び出し側が下限を満たす値を渡す）。
*   `extendWithPoints(shape, end, points, tolerance)`：結合できる線`shape`の端点`end`の側へ、`points`を並びの順に1つずつ`buildExtendedPath(現在の線, end, 点, tolerance)`で描き足す（`points[0]`が端点のすぐ隣になる。`end`が`'start'`のときも`buildExtendedPath`を繰り返すことで先頭へ順に足され、元の線の向きが保たれる）。`buildExtendedPath`が`null`を返した点（直前の端点と重なる点）は**足さずに次の点へ進む**。1つも足せなければ`null`。**重なりの規則は`buildExtendedPath`の1か所のまま**（二重に書かない）。点が1つのときの結果は`buildExtendedPath(shape, end, points[0], tolerance)`と完全に同じ。
*   `planCloseWithPoints(shapes, ref, interior, tolerance)`：同じ線の両端に吸い付いた（描き始め＝`ref`）場合に、打った点を加えて閉じる計画。`ref.shapeId`の図形が無い・結合できる線でなければ`null`。`ext = extendWithPoints(図形, ref.end, interior, tolerance) ?? 図形` → `buildClosedPath(ext, tolerance)`（`null`なら`null`）→ `{ path, targetId: 図形.id, keepId: true, removeIds: [] }`（元のidと位置を保つ。スタイルは元の線）。
*   `planJoinWithPoints(shapes, startRef, endRef, interior, tolerance)`：別々の2本の端点に吸い付いた場合に、打った点を間に入れて1本にする計画。2本の図形が見つからない・同じ図形なら`null`。基準＝`shapes`で奥（先）の方（`planJoinAt`と同じ）。基準が描き始めの側なら`seq = interior`、描き終えの側なら`seq = interior`を逆順にしたコピー（基準の端点のすぐ隣の点を先頭にするため）。`ext = extendWithPoints(基準の図形, 基準の端点, seq, tolerance) ?? 基準の図形` → `buildJoinedPathAt(ext, 基準の端点, もう一方の図形, もう一方の端点, tolerance)`（`null`なら`null`）→ `{ path, targetId: 基準の図形.id, keepId: false, removeIds: [もう一方.id] }`（基準の線の向き・スタイル。3本（引き始めの線・引いた線・つないだ線）が1本になる）。

**新しく`export`する関数**（すべてJSDoc（責務・`@param`・`@returns`・引数を書き換えないこと）を書く）：
| 関数 | 結果 |
| --- | --- |
| `addDrawnPoint(drawn)` | 点を打った作成途中の線：頂点＝`drawn`の頂点＋末尾の頂点（付いてくる線の先）の写し。常に開いた`Path`（頂点3つ以上）。結合できる線でなければ`null` |
| `removeLastDrawnPoint(drawn)` | 最後の点を消した作成途中の線：頂点数`n`のうち`n - 2`番目（最後の点）を除き、付いてくる線の先は残す。`n <= 2`（打った点が始点だけ）なら`null`。残りが2つなら`Line`、3つ以上なら開いた`Path`（`buildLineOrPath`） |
| `buildFinishedDrawnLine(drawn, closed)` | 終えた線：打った点（頂点の末尾＝付いてくる線の先を除いた並び）。`closed`が偽なら、打った点が2つ未満で`null`、2つで`Line`、3つ以上で開いた`Path`。`closed`が真なら、打った点が`CLOSED_MIN_POINTS`未満で`null`、それ以外は閉じた`Path`（始点を重ねて足さない）。`closed`の既定は`false` |
| `getLastDrawnPoint(drawn)` | 最後の点（頂点の`n - 2`番目）の新しい`{ x, y }`。結合できる線でない・頂点が2つ未満なら`null` |
| `isOnLastDrawnPoint(drawn, tolerance)` | 付いてくる線の先（末尾の頂点）と最後の点の距離（`Math.hypot`）が`tolerance`以下（ちょうどを含む）なら`true`。「最後の点をもう1回クリック」の判定の唯一の箇所（距離は`JOIN_TOLERANCE_SCREEN_PX`の換算を呼び出し側が渡す） |
| `canCloseDrawnLine(drawn)` | 打った点（頂点数`- 1`）が`CLOSED_MIN_POINTS`以上なら`true`（閉じて終えられるか。始点への吸い付きが働く条件の唯一の箇所） |

**`planDrawnLineJoin(shapes, drawn, startSnap, endSnap, tolerance)`の拡張**（名前・引数・戻り値の形は変えない。`drawn`を「頂点2つ以上の結合できる線（直線か開いたパス）。`toJSON().points`の先頭＝描き始めの点（`startSnap`があればその端点の座標）、末尾＝描き終えの点（`endSnap`があればその端点の座標）、間＝打った途中の点」へ広げ、JSDocを実態に合わせる）。`points = drawn.toJSON().points`、`interior = points.slice(1, -1)`（途中の点）として：
1.  両方`null` → `null`（今のまま）。
2.  両方あり・同じ図形：同じ端点 → `null`（今のまま）。`interior`が空 → **今の`planCloseOf(shapes, startSnap.shapeId, tolerance)`をそのまま呼ぶ**。空でない → `planCloseWithPoints(shapes, startSnap, interior, tolerance)`。
3.  両方あり・別の図形：`interior`が空 → **今の`planJoinAt(shapes, startSnap, endSnap, tolerance)`をそのまま呼ぶ**。空でない → `planJoinWithPoints(shapes, startSnap, endSnap, interior, tolerance)`。
4.  片方だけ：図形が無ければ`null`（今のまま）。描き始めだけ → 足す点＝`points.slice(1)`（描き始めの次から描き終えまで）、描き終えだけ → 足す点＝`points.slice(0, -1)`を逆順にしたコピー（描き終えの手前から描き始めまで）。`path = extendWithPoints(図形, snap.end, 足す点, tolerance)`。`null`なら`null`。`{ path, targetId: 図形.id, keepId: true, removeIds: [] }`（今と同じ形）。
*   **頂点2つの`drawn`（今の直線）での結果は今と完全に同じ**（2.・3.は今の関数をそのまま呼び、4.は足す点が1つで`buildExtendedPath`と同じ結果）。既存の`test/shapes/PathJoinRules.test.js`・`test/edit/EndpointSnapper.test.js`の全ケースがそのまま通ること。

**変えないもの**：`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`assembleOpenPath`・`buildJoinedPathAt`・`buildExtendedPath`・`canCloseByMergingEnds`・`indexOfShape`・`planJoinAt`・`planCloseOf`・`planEndpointDragJoin`・`planJoin`の中身と名前。`CLOSED_MIN_POINTS`の値（JSDocの「共有する」関数の列に新しい関数を足すのは可）。

**`js/shapes/Path.js`（JSDocのみ。コードは変えない）**：クラスのJSDocの「パスは`ShapeFactory.create`では作られない（読み込み専用。作る操作はPhase 05-03・05-04）」に、直線のツールで続けて引く線（点が3つ以上）も`PathJoinRules`が作ること・作成途中の図形にもなることを足す。`updateDraftEnd`のJSDocの「パスは作成中の図形にならないため本サブフェイズでは呼ばれない」を、「直線のツールで続けて引く作成途中の線（開いたパス）の付いてくる線の先（最後の頂点）を動かす。呼ぶのは`VectorModel.updateDraft`」へ直す。`js/shapes/Line.js`は変えない。

**タスクの分け方**：点の並びの規則（`LINE_POINT_COUNT`・`buildLineOrPath`・新しい6関数）と責務定義・`Line`のimport・`Path.js`のJSDocはタスク1、`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`と`planDrawnLineJoin`の拡張はタスク2で行う（テストの観点も同じ分け方）。

**テストの観点**（`test/shapes/PathJoinRules.test.js`へ`describe`を足す。既存のケース・補助関数は変えない）：
*   `addDrawnPoint`：`Line`→頂点3つの開いた`Path`（末尾2つが同じ座標）・`Path`→頂点が1つ増える・スタイル（`strokeColor`・`strokeWidth`・`fillColor`）を引き継ぐ・`id`は`null`・閉じたパス・曲線・矩形では`null`。
*   `removeLastDrawnPoint`：頂点4つの`Path`→頂点3つの`Path`（最後の点だけが消え、付いてくる線の先は残る）・頂点3つの`Path`→`Line`（始点と付いてくる線の先）・`Line`（頂点2つ）→`null`・スタイルを引き継ぐ。
*   `buildFinishedDrawnLine`：開いたまま（`Line`→`null`、頂点3つ→`Line`（打った点2つ）、頂点4つ以上→開いた`Path`）・閉じて（打った点2つ→`null`、3つ以上→閉じた`Path`で頂点は打った点のとおり・`segments`の数・`isFillable()`が真）・スタイルを引き継ぐ。
*   `getLastDrawnPoint`・`isOnLastDrawnPoint`（距離ちょうど・超える・`Line`のとき（最後の点＝始点））・`canCloseDrawnLine`（打った点2つ／3つの境界）。
*   `planDrawnLineJoin`の拡張：描き始めだけ（`end`が`'end'`／`'start'`のそれぞれで、打った点がすべて元の向きを保って足される・元のid・スタイルは元の線）、描き終えだけ（逆順で足される）、同じ線の両端（打った点が加わって閉じる・元のid）、別の線の両端（基準が描き始めの線のとき／描き終えの線のとき＝重なり順で奥の方・新しいid扱い（`keepId: false`）・`removeIds`・頂点の並び・スタイルは基準の線）、途中の点が端点と重なるときは足さない、頂点2つのとき今の結果と同じ（代表的なケースを今の関数の結果と`deepEqual`で比べる）。
*   引数（`drawn`・`shapes`の図形・`startSnap`・`endSnap`）を書き換えないこと、結果が引数と頂点を共有しないこと。

### 要件2: 始点への吸い付きと描き始めの端点の除外（`js/shapes/EndpointSnapRules.js`。既存へ追加）

**ファイル先頭の責務定義**に「線を引いている途中の吸い付き（描き始めの端点を除く端点と、作成途中の線の始点）」を加える（3行以内のまま）。**import**：`./PathJoinRules.js`から`canCloseDrawnLine`を足す（既存の`isJoinableLine`・`canCloseByMergingEnds`はそのまま）。

**新規**：
*   `DRAWN_START_SNAP_KIND = 'drawnStart'`（`export`。始点への吸い付きの結果の種類の値の唯一の定義箇所）。
*   typedef`DrawnStartSnap`：`{ kind: 'drawnStart', x, y }`（`shapeId`・`end`を持たない。`EndpointRef`を満たさないため、`planDrawnLineJoin`・`planEndpointDragJoin`へ渡してはならない旨を書く）。既存のtypedef`SnapTarget`（`{ shapeId, end, x, y }`）には**項目を足さない**（既存のテストが`deepEqual`で形を確かめているため）。2つは`kind`の有無で区別する。
*   `isDrawnStartSnap(snap)`（`export`）：`snap`が`null`・`undefined`でなく`snap.kind === DRAWN_START_SNAP_KIND`なら`true`。照会と反映の取り違えを防ぐ判定の唯一の箇所。
*   `findDrawnLineSnapTarget(shapes, drawn, point, tolerance, startSnap)`（`export`）：線を引いている途中の吸い付く先を1つ選ぶ。
    1.  端点：`findSnapTarget`と同じ対象・同じ走査順・同じ選び方（結合できる線の始点・終点、末尾（前面）の図形から、各図形は始点→終点、距離が厳密に小さいときだけ更新、`tolerance`以下）。ただし`startSnap`（`{ shapeId, end }`。描き始めに吸い付いた端点）が`null`でなければ、**その図形のその端点だけを対象にしない**（同じ図形のもう一方の端点は、頂点の数によらず対象にする。`dragged`の規則（`canCloseByMergingEnds`）は使わない）。
    2.  始点：`startSnap`が`null`で、`drawn`が`canCloseDrawnLine(drawn)`（打った点が3つ以上）のときだけ、`drawn.toJSON().points[0]`（始点）を候補にする。距離が`tolerance`以下で、かつ1.の結果が無いか1.の距離より**厳密に小さい**ときだけ`{ kind: DRAWN_START_SNAP_KIND, x, y }`を選ぶ（同距離なら端点が残る）。
    3.  結果：端点なら既存の`SnapTarget`の形（`{ shapeId, end, x, y }`）、始点なら`DrawnStartSnap`、無ければ`null`。引数を書き換えない。
*   **走査の共有**：`findSnapTarget`の走査（ループ）を非公開の関数（例：`findNearestEndpoint(shapes, point, tolerance, isExcluded)`。`isExcluded(shape, end)`が真の端点を飛ばし、`{ target, distance }`を返す）へ切り出し、`findSnapTarget`（除外＝今の`dragged`の規則。`isDragged && (end === dragged.end || !canCloseByMergingEnds(shape))`）と`findDrawnLineSnapTarget`（除外＝`startSnap`の端点だけ）が共有する（候補の選び方を二重に書かない）。**`findSnapTarget`の名前・引数・結果は変えない**（既存のテストがそのまま通ること）。

**変えないもの**：`SNAP_TOLERANCE_SCREEN_PX`（8px）・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`のふるまい。端点への吸い付きの対象を曲線・矩形・円・弧・閉じたパスの点・途中の頂点へ広げない。

**テストの観点**（`test/shapes/EndpointSnapRules.test.js`へ`describe`を足す。既存のケースは変えない）：`DRAWN_START_SNAP_KIND`の値・`isDrawnStartSnap`（`null`・`undefined`・`SnapTarget`・`DrawnStartSnap`）・描き始めの端点の除外（同じ図形のもう一方の端点は直線でも対象・別の図形は通常どおり）・始点が候補になる条件（`startSnap`が`null`かつ打った点3つ以上。打った点2つでは候補にならない・`startSnap`があれば候補にならない）・距離の境界（ちょうど8を含む）・端点と始点の近い方を選ぶこと・同距離なら端点・結果の形（`SnapTarget`は今と同じキーだけ）・引数を書き換えないこと。

### 要件3: `Shift`で限定した向きを保つ丸め（`js/core/UnitSnapRules.js`。既存へ追加）

*   **新規**`roundConstrainedPointFromOriginToUnit(origin, delta, step)`（`export`。JSDocの見出しは既存の(a)〜(d)に続けて(e)）：基準点`origin`に、`MoveDirectionRules.constrainMoveDirection`の結果（向きを限定した移動量）`delta`を`roundConstrainedDeltaToUnit(delta, step)`で丸めた移動量を足した位置を返す。刻みが正の有限の数値でないとき（`null`＝スナップOFF・`Ctrl`の間を含む）は丸めずに`origin + delta`。結果に`-0`を含めない（既存の関数と同じ書き方）。引数を書き換えない。新しいオブジェクトを返す。`MoveDirectionRules`をimportしない（入力の形だけを前提にする。`roundConstrainedDeltaToUnit`と同じ）。
*   用途（JSDocに書く）：直線のツールで線を引いている途中、`Shift`を押している間の付いてくる線の先（基準点＝最後の点）。図形の移動の`Shift`＋スナップ（`#resolveMoveDelta`の「限定 → 丸め」）と同じ考え方で、45°では両軸が同じ量になり、限定した向きが丸めで崩れない。基準点が刻みの倍数なら結果も刻みの倍数（打つ点にスナップが当たる）。基準点が端点への吸い付きで小数の座標でも、向きを保って小数の部分を保つ。
*   ファイル先頭の責務定義・既存の関数は**変えない**。
*   **テストの観点**（`test/core/UnitSnapRules.test.js`へ`describe`を足す。既存のケースは変えない）：刻み1・10での横・縦・斜め45°（結果の`|x − origin.x| === |y − origin.y|`）・移動量0・小数の基準点で小数の部分が保たれる・刻み`null`／0／負／`NaN`では丸めない（`origin + delta`）・`-0`を含まない・引数を書き換えない・新しいオブジェクト。

### 要件4: 作成途中の図形の置き換え（`js/core/VectorModel.js`。既存へ追加）

*   **新規**`replaceDraft(shape)`（`cancelDraft`の直後に置く）：作成途中の図形を、渡した図形に置き換える公開操作（直線のツールで続けて引く線の、点を打つ・最後の点を消す・終えた線の組み立て直しで`edit/EndpointSnapper`が使う）。
    1.  作成途中の図形が無ければ、何もせず（通知もせず）`false`を返す。
    2.  `shape`のインスタンスが`#shapes`に含まれていれば、`console.warn`のうえ何もせず`false`を返す（`replaceShape`と同じ防御）。
    3.  `shape.id = null`（作成途中の図形はidを持たない）。直前に使った値を当てる（`this.#assignShapeStyle(shape, this.#toShapeStyle())`。`startDraft`と同じ）。`#draftShape = shape`。`#shapes`には入れない。
    4.  変更を通知して（1回）`true`を返す。
    *   選択集合・頂点の選択・ホバー・選択矩形・吸い付きの表示の点・直前に使った値・idの採番には触れない。図形の種別・頂点を関知しない（`id`の代入とスタイル3つの代入以外で触れない）。受け取ったインスタンスをそのまま保持して書き換えるため、呼び出し側は以後そのインスタンスを他の用途に流用しない（JSDocに書く）。
*   JSDocの更新：`startDraft`のJSDocの「作成途中の図形を作るのは`startDraft`だけ」に相当する記述があれば`replaceDraft`も当てることを足す（`#draftShape`のフィールドのJSDoc「作成中（始点確定・終点未確定）の未コミット図形」に、直線のツールでは打った点＋付いてくる線の先を持つことを足す）。ファイル先頭の責務定義・既存のメソッドの中身は**変えない**。
*   **テストの観点**（新規`test/core/VectorModel.replaceDraft.test.js`。`VectorModel.updateVertices.test.js`・`VectorModel.style.test.js`の書き方にそろえる）：作成途中の図形が無いとき`false`・通知0・`getDraftShape()`は`null`のまま／あるとき`true`・通知1回・`getDraftShape()`が渡した図形・`id`が`null`になる（`id`を持つ図形を渡しても）・`getShapes()`に入らない・スタイルが直前に使った値になる（`updateNewShapeStyle`で変えた後に置き換えた場合を含む。線なし・塗りあり等の組み合わせ）・`#shapes`に含まれる図形を渡すと`console.warn`して`false`・通知0・選択集合・ホバー・吸い付きの表示の点・直前に使った値が変わらない・置き換えた後の`commitDraft`で置き換えた図形が新しいidで確定する・置き換えた後の`cancelDraft`で捨てられる・`updateDraft`が置き換えた図形の`updateDraftEnd`へ委譲される（`Path`の最後の頂点が動く）。

### 要件5: 線を引く手順（`js/edit/EndpointSnapper.js`。既存へ追加）

**ファイル先頭の責務定義**（3行以内。例）：「責務: 端点への吸い付きの照会（直線を描くとき・端点のハンドルのドラッグ中。線を引いている途中は作成途中の線の始点も）と、吸い付いた端点での描き足し・結合・閉じる操作、および直線のツールで続けて引く線の点を打つ・最後の点を消す・終える操作の / モデルへの反映を、規則（`shapes/EndpointSnapRules`・`shapes/PathJoinRules`）に従って行う手順を担う。DOMに触れない。」

**import**：`../shapes/EndpointSnapRules.js`から`isDrawnStartSnap`・`findDrawnLineSnapTarget`、`../shapes/PathJoinRules.js`から`isJoinableLine`・`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`・`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`を足す（importするファイルは今の2つのまま）。

**クラスのJSDocの更新**：`model`で使うメソッドに`replaceDraft`・`commitDraft`を足す（`getShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`・`replaceDraft`・`commitDraft`）。前提（呼び出し側の責務）に「線を引く手順のメソッドは、作成途中の線があるとき（`isDrawingLine()`が真のとき）に呼ぶ」を足す。通知の回数に新しいメソッドの分を足す。「図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない」は守る（規則の関数を呼ぶだけ）。

**既存の`commitDrawnLine(startSnap, endSnap)`**：ふるまい・呼び出し順・戻り値を変えない。中身の「計画 → `cancelDraft` → 計画が`null`なら終わり → `beginEdit` → `replaceShape`（`select: false`）→ `commitEdit`」を非公開の`#reflectDrawnJoin(drawn, startSnap, endSnap)`へ切り出し、`commitDrawnLine`は「両方`null`なら何も呼ばず`false`」の後に`#reflectDrawnJoin(model.getDraftShape(), startSnap, endSnap)`を呼んで`true`を返す（`finishDrawnLine`と共有するため。作成途中の図形が無いときに換算を呼ばない点も今のまま）。JSDocに、作成途中の線は点が複数でもよいこと（付いてくる線の先＝`endSnap`の端点を含む並び）と、`endSnap`に`DrawnStartSnap`を渡さないこと（`clickDrawnLine`が先に扱う）を足す。

**非公開（新規）**：`#commitDrawnShape(shape)`：`model.replaceDraft(shape)` → `editRecorder.beginEdit()` → `model.commitDraft()` → `editRecorder.commitEdit()`（吸い付きなしで終えた線を、直前に使った値のスタイル・新しいidで確定する1件）。

**公開（新規）**（すべてJSDoc。処理順を番号付きで書く）：
| メソッド | 処理 |
| --- | --- |
| `isDrawingLine()` | 作成途中の図形が`null`・`undefined`でなく、`isJoinableLine(作成途中の図形)`なら`true`（線を引いている途中か。直線のツールの作成途中の図形は常に直線か開いたパスで、ほかのツールの作成途中の図形は結合できる線ではない旨を書く）。モデル・記録先を変えない |
| `findDrawnLineSnap(startSnap, point)` | 作成途中の図形が無ければ`null`（換算も呼ばない）。あれば`findDrawnLineSnapTarget(model.getShapes(), 作成途中の図形, point, screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX), startSnap)` |
| `getDrawnLineLastPoint()` | 作成途中の図形が無ければ`null`。あれば`getLastDrawnPoint(作成途中の図形)`（`Shift`の向きの限定の基準点） |
| `clickDrawnLine(startSnap, endSnap)` → `boolean` | 線を引いている途中のクリック。**戻り値は「点を打って引き続けるか」**（`true`＝点を打った、`false`＝終えた）。1. 作成途中の図形が無ければ`false`。2. `isDrawnStartSnap(endSnap)`かつ`canCloseDrawnLine(作成途中の図形)`なら`#commitDrawnShape(buildFinishedDrawnLine(作成途中の図形, true))`（閉じて終える）で`false`。3. `isOnLastDrawnPoint(作成途中の図形, screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX))`なら`finishDrawnLine(startSnap)`（開いたまま終える）で`false`。4. `endSnap`が`null`でなく`isDrawnStartSnap(endSnap)`が偽なら`commitDrawnLine(startSnap, endSnap)`（つながって終える）で`false`。5. それ以外（始点への吸い付きでも閉じられないときを含む）は`model.replaceDraft(addDrawnPoint(作成途中の図形))`（点を打つ。記録先に触れない）で`true` |
| `finishDrawnLine(startSnap)` | 開いたまま終える（`Esc`・ツールの切り替え・最後の点のクリック）。1. 作成途中の図形が無ければ何もしない。2. `finished = buildFinishedDrawnLine(作成途中の図形, false)`が`null`（打った点が始点だけ）なら`model.cancelDraft()`だけ（何も残さない。記録しない）。3. `startSnap`が`null`なら`#commitDrawnShape(finished)`。4. それ以外は`#reflectDrawnJoin(finished, startSnap, null)`（描き始めの線の続きとして描き足す。計画が`null`なら作成途中の線を捨てるだけ）。戻り値なし |
| `removeDrawnLinePoint()` → `boolean` | 最後の点を消す。**戻り値は「引き続けるか」**。1. 作成途中の図形が無ければ`false`。2. `next = removeLastDrawnPoint(作成途中の図形)`が`null`（打った点が始点だけ）なら`model.cancelDraft()`で`false`（引くのをやめる）。3. それ以外は`model.replaceDraft(next)`で`true`。記録先に触れない |

*   **1回の終わり方で記録は最大1件**（`#commitDrawnShape`の1組、または`#reflectDrawnJoin`の1組。どちらか一方だけを通る）。点を打つ・最後の点を消すでは`beginEdit`/`commitEdit`を呼ばない。
*   既存の`findDrawSnap`・`resolveDragEndpoint`・`findDragSnap`・`joinDraggedEndpoint`は**変えない**（描き始めのクリック・図形作成モードの`IDLE`の表示・端点のハンドルのドラッグは今のまま）。

**テストの観点**（`test/edit/EndpointSnapper.test.js`へ足す。**既存のケース・補助関数（`setupFake`・`setupReal`等）は変えない**。偽の`model`に`replaceDraft`・`commitDraft`が要るケースは、新しい補助関数（JSDoc付き）を足して使う）：
*   偽物での手順：`isDrawingLine`（作成途中の図形が無い・直線・開いたパス・曲線）、`clickDrawnLine`の1.〜5.それぞれの呼び出し順（閉じる＝`replaceDraft`→`beginEdit`→`commitDraft`→`commitEdit`、開いたまま＝同じ、つながり＝`cancelDraft`→`beginEdit`→`replaceShape`→`commitEdit`、点を打つ＝`replaceDraft`だけで記録先に触れない）と換算の値（5・8）、`finishDrawnLine`（点が1つ＝`cancelDraft`だけ・描き始めが端点＝描き足しの`replaceShape`の引数）、`removeDrawnLinePoint`（`replaceDraft`だけ・点が1つ＝`cancelDraft`で`false`・記録先に触れない）、`getDrawnLineLastPoint`・`findDrawnLineSnap`（作成途中の図形が無いとき`null`で換算を呼ばない）。
*   実物（`setupReal`）の組み合わせ：点を5つ打って開いたまま終える → 開いたパス1つ・頂点は打った点のとおり・選択は空・履歴1件・`undo`で消え`redo`で戻る／点2つで終えると`line`／始点に吸い付いて閉じる → 閉じたパス・履歴1件／既存の線の端点から引き始めて終える → 元のidの開いたパス（元の線の向き・スタイル）・履歴1件・`undo`で元の直線に戻る／別の線の端点に吸い付いて終える → 1本・履歴1件／両端とも別の線 → 3本が1本・新しいidが奥の位置に入りもう一方が除かれる／既存の線の端点から引き始め、その線のもう一方の端点で閉じる → 元のidの閉じたパス／点を打つ・最後の点を消すの間は`history.canUndo()`が変わらず`getShapes()`も変わらない／新しく引いた線のスタイルが直前に使った値（`updateNewShapeStyle`で変えた値）。

### 要件6: 入力の配線（`js/core/InputTracker.js`。既存へ追加）

**ファイル先頭の責務定義**（3行以内のまま。REQの「3か所を揃える」の1つ目。例）：
*   1行目の「図形作成」を「図形作成（直線のツールでは点を打って続けて引く）」に。
*   2行目の修飾キーの用途に「Shiftで線を引いている途中の付いてくる線の向きを限定するかを決めること」を足し（「規則の関数へ渡すこと、Altで注入された複製を呼ぶかを決めること、Ctrlの間に端点への吸い付きの照会を省くこと、Shiftで線を引いている途中の向きを限定するかを決めることにだけ使う」）、状態依存の操作に「線を引いている途中の最後の点の削除・終える」を足す。
*   3行目は変えない。

**typedef`EndpointSnapAssist`と既定値`NO_SNAP_ASSIST`**：項目を足す（JSDocに型と意味）：`isDrawingLine(): boolean`（既定`false`）、`findDrawnLineSnap(startSnap, point): {x, y}|null`（既定`null`）、`getDrawnLineLastPoint(): {x, y}|null`（既定`null`）、`clickDrawnLine(startSnap, endSnap): boolean`（既定`false`）、`finishDrawnLine(startSnap): void`（既定は何もしない）、`removeDrawnLinePoint(): boolean`（既定`false`）。既定では`isDrawingLine`が常に偽のため、補助が注入されないときは今の2クリックの直線のまま（ほかの項目は呼ばれない）。吸い付きの結果は今どおり`x`・`y`だけを読み、種類の項目（`kind`）は解釈せずそのまま補助へ返す。

**非公開（新規）**：
*   `#isDrawingLine()`：`this.state === InputState.DRAWING && this.#snapAssist.isDrawingLine()`。
*   `#finishDrawnLine()`：`this.#snapAssist.finishDrawnLine(this.#drawStartSnap)` → `this.state = InputState.IDLE` → `this.#resetSnapState()`（`Esc`と`finishLineDrawing`が共有）。
*   `#resolveDrawnLineEnd(point, event, suppressed)`：吸い付かなかったときの付いてくる線の先。刻み`step = resolveUnitSnapStep(getUnitSnapStep(), suppressed)`。`event.shiftKey`が真で`origin = this.#snapAssist.getDrawnLineLastPoint()`が`null`でなければ`roundConstrainedPointFromOriginToUnit(origin, constrainMoveDirection(point.x - origin.x, point.y - origin.y), step)`、それ以外は`roundPointToUnit(point, step)`（今と同じ）。**`Shift`を見るのはこの`mousemove`イベント**（キーの購読は足さない。`Ctrl`の間も限定は働き、丸めだけが止まる）。

**`handleMouseMove`の`DRAWING`の枝**：先頭（`point`・`suppressed`を求めた後）に、`#isDrawingLine()`（ここでは`this.#snapAssist.isDrawingLine()`）なら：`snap = suppressed ? null : this.#snapAssist.findDrawnLineSnap(this.#drawStartSnap, point)` → `this.#drawEndSnap = snap` → `this.#showSnap(snap)` → `end = snap ? snap : this.#resolveDrawnLineEnd(point, event, suppressed)` → `this.model.updateDraft(end.x, end.y)` → `return`。**直線のツール以外の枝は今のコードをそのまま残す**（`findDrawSnap`・`roundPointToUnit`）。吸い付いたときは限定もスナップもしない（吸い付きを優先）。

**`handleClick`の`DRAWING`の枝**：先頭に、`this.#snapAssist.isDrawingLine()`なら：`continuing = this.#snapAssist.clickDrawnLine(this.#drawStartSnap, this.#drawEndSnap)`。`continuing`が偽なら`this.state = InputState.IDLE`・`this.#resetSnapState()`、真なら`this.#drawEndSnap = null`・`this.#showSnap(null)`（点を打った直後。次の`mousemove`で照会し直す）→ `return`。**直線のツール以外は今のコード（`commitDrawnLine`が偽なら`beginEdit`→`commitDraft`→`commitEdit`）をそのまま残す**。描き始め（`IDLE`・図形作成モードの枝）は変えない。

**`cancelDraftOrClearSelection()`（`Esc`）の`DRAWING`の枝**：`this.#snapAssist.isDrawingLine()`なら`this.#finishDrawnLine()`、そうでなければ今どおり`cancelDraft()` → `IDLE` → `#resetSnapState()`。どちらも`true`を返す。ドラッグ中は今どおり`false`。(3)〜(5)は変えない。JSDocの(2)を実態に合わせる。

**公開（新規）**（区切り「公開API（状態依存の操作：削除・取消・全選択・中断）」の中に置く。JSDocに受理条件・戻り値・呼び出し元を書く）：
| メソッド | 処理 |
| --- | --- |
| `finishLineDrawing()` → `boolean` | ツールの切り替えの前処理。`#isDrawingLine()`が偽なら何もせず`false`（**ドラッグ中かは見ない**。線を引いている途中のドラッグは`DRAWING`を保ったままのパンだけで、ツールパレットのボタンの経路（`main.js`の`selectTool` → `toolActions`）はドラッグ中かを見ないため、パン中に押されても描いた分を残すため）。それ以外は`#finishDrawnLine()`で`true`（描いた分を開いたまま残して終える。点が1つなら何も残さない）。パンのドラッグ中に呼ばれた場合、パンのドラッグそのものは中断しない（続く`setMode`の`#abortOngoingOperation`がパンのドラッグを`DragTracker.cancel()`で中断し、`#finishPan()`が走る。図形作成モードのまま図形のツールを選ぶ経路は`setMode`を通らないため、パンは今どおり離すまで続き、`IDLE`のままパンする今の状態と同じになる）。カーソルは再評価しない（続けて呼ばれる`setMode`、またはパンの終わりの`#finishPan()`が再評価する）。呼び出し元は`main.js`のツールの切り替えの経路だけ（`selectModeTool`・`selectShapeTool`・`startEyedropper`）。**ほかの中断（`setMode`・`abortOngoingOperation`）は今どおり捨てる**。JSDocに、ドラッグ中かを見ない理由と、パンのドラッグの中断を続く`setMode`に任せることを書く |
| `removeLastLinePoint()` → `boolean` | 線を引いている途中の最後の点を消す（取り消しと`Backspace`/`Delete`の共通）。ドラッグ中または`#isDrawingLine()`が偽なら何もせず`false`（ドラッグ中の条件は`finishLineDrawing()`と違って残す。取り消しは`performUndo`がドラッグ中は不受理、キーは`KeyboardShortcuts`がドラッグ中は実行しないため、パン中に点を消す経路はもともと無いため）。`this.#snapAssist.removeDrawnLinePoint()`が真（引き続ける）なら`this.#drawEndSnap = null`・`this.#showSnap(null)`（消した点に合わせた照会結果・`Shift`の限定が古くなるため。次の`mousemove`で照会し直す）、偽（始点だけだったのでやめた）なら`IDLE`・`#resetSnapState()`。どちらも`true`。記録先に触れない |
| `deleteLastLinePointOrSelection()` → `boolean` | キーの`Backspace`/`Delete`（`KeyboardShortcuts`の`deleteSelection`）の実体。`removeLastLinePoint()`が真ならそれを返し、偽なら`deleteSelection()`の戻り値を返す。**`deleteSelection()`の中身は変えない**（削除ボタン・切り取り（`ClipboardController`）と共有する唯一の削除経路のため、点を消す入口を入れない） |

**JSDocの更新**：`abortOngoingOperation()`のJSDocの「`performUndo`（`main.js`）がこの戻り値で作成途中の図形の破棄を判定している」を、「`performUndo`は先に`removeLastLinePoint()`を呼ぶため、線を引いている途中にここへは来ない。ここで捨てた作成途中の図形（直線のツール以外）の有無を`performUndo`が戻り値で判定している」へ合わせる。クラスのJSDocに、線を引いている途中の`mousemove`・`click`・`Esc`・新しい公開操作の配線と、`Shift`の読み取り（付いてくる線の先。向きの限定は`MoveDirectionRules`、丸めは`UnitSnapRules`の関数へ渡すだけ）を足し、「削除・取消・全選択・進行中操作の中断は状態依存の公開メソッドとして提供し」の列に新しい公開操作を足す。`handleMouseMove`・`handleClick`のJSDocに線を引いている途中の枝を足す。`setShapeType`・`setMode`・`#abortOngoingOperation`の中身は**変えない**（線を引いている途中でも捨てる。ツールの切り替えでは`main.js`が先に`finishLineDrawing()`を呼ぶため、ここへ来る時点では`IDLE`。パン中だった場合はここでパンのドラッグが中断される）。

**パンのドラッグ中に終える処理が走っても問題がないこと**（実コードで確かめた点）：
*   線を引いている途中に起こり得るドラッグはパンだけ（`handleMouseDown`は`IDLE`以外では左ボタンで何も始めず、`DRAWING`のまま始められるのは中ボタン・スペース＋左ボタンの`#beginPan`だけ）。ツールパレットのボタンを押せるのは、左ボタンが空いている中ボタンのパン中。
*   パンは記録先・モデルの図形に触れない：`#beginPan`の追従（`onMove`）は`viewTransform.panBy`だけ、終わり（`onEnd`・`onCancel`）の`#finishPan()`は`#isPanning`を下ろしてカーソルを再評価するだけ。開始で`model.clearHovered()`・`model.clearSnapPoint()`を呼ぶが、どちらも履歴のスナップショット（図形一式と選択集合。`HistoryManager`の`capture`）の対象外。`#isEditOpen`は左ドラッグ（移動・変形）でしか立たないため、パン中に`beginEdit`が開いたままになっていることはない（`HistoryManager.beginEdit`の「確定されていない編集操作」の警告は出ない）。
*   そのため、パン中に`EndpointSnapper`の終える処理（`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`、または`cancelDraft` → `beginEdit` → `replaceShape` → `commitEdit`）が走っても、1回の終わり方で1件の記録になり、パンの表示（`ViewTransform`）は変わらない。重なり・吸い付きの距離の換算は、その時点の表示倍率で行われる（パンは倍率を変えない）。`#finishDrawnLine()`の`#resetSnapState()`は表示の点を消すだけで、パンの状態（`#isPanning`・`#drag`）に触れない。

**変えないもの**：作業用フィールドの数（**足さない**）・`#resetSnapState()`・`#beginPan`・`handleWheel`・`handleMouseDown`・`deleteSelection()`・`selectAll()`・`setMode`・`setShapeType`・`#abortOngoingOperation`・選択モード・頂点の選択モード・キャンバス移動モードのすべての枝・端点のハンドルのドラッグ（`findDragSnap`・`joinDraggedEndpoint`）・描き始めのクリック・図形作成モードの`IDLE`の`mousemove`。`InputTracker`は図形種別の分岐・点の並び・「終える／閉じる／最後の点か」の判定・向きの限定の計算を持たない（注入された補助と規則の関数を呼ぶだけ）。**状態の所有者の再分離（クラスの分割）は行わない**。

### 要件7: ツールの切り替え・`Backspace`/`Delete`・取り消しの配線（`js/main.js`。`js/core/KeyboardShortcuts.js`はtypedefのJSDocのみ）

**`js/main.js`**（判定・計算を書かない。`InputTracker`の公開操作を条件なしに呼ぶか、戻り値をそのまま返す）：
1.  `performUndo()`（`// 3.5.`）：`isDragging()`の判定の次に`if (inputTracker.removeLastLinePoint()) { return true; }`を足す（線を引いている途中は最後の点を消して終わり、履歴に触れない）。その後の`abortOngoingOperation()`・`historyManager.undo()`は今のまま。JSDocの(2)の前に新しい手順を足し、(2)の「ここで中断し得るのは作成途中の図形のみ」を「直線のツール以外の作成途中の図形のみ」へ合わせる。`performRedo()`は**変えない**（線を引いている途中のやり直しは今どおり捨ててからやり直す）。
2.  `// 7.`に関数`selectModeTool(mode)`を足す（JSDoc付き。`selectShapeTool`の前）：「ツールの切り替えでモードを選ぶ（ツールパレットの選択・頂点の選択・キャンバス移動のボタンと、キー`V`・`A`・`P`・`H`の共通経路）。線を引いている途中なら描いた分を残して終えてから（`inputTracker.finishLineDrawing()`。判定は`InputTracker`が持つ）`applyMode`で切り替える。貼り付け・全選択・キャンバスの切り替え等の`applyMode`の経路は通らない（今どおり捨てる）」。中身は`inputTracker.finishLineDrawing();` → `applyMode(mode);`。
3.  `selectShapeTool(type)`の先頭に`inputTracker.finishLineDrawing();`を足す（同じ直線のツールを選び直したときも含めて終える）。JSDocに足す。
4.  `startEyedropper()`の先頭（`ensureSelectMode()`の前）に`inputTracker.finishLineDrawing();`を足す。JSDocに足す。**`ensureSelectMode()`は変えない**（全選択・貼り付け・選択の反転からの切り替えは今どおり捨てる）。
5.  `toolActions`の`[OperationMode.SELECT]`・`[OperationMode.VERTEX]`・`[OperationMode.PAN]`を`() => selectModeTool(OperationMode.…)`へ（JSDocの「選択・頂点の選択・キャンバス移動は`applyMode`」を`selectModeTool`へ）。
6.  `// 8.`の`KeyboardShortcuts`への注入：`setMode`を`(mode) => { selectModeTool(mode); return true; }`へ（コメントも合わせる）。`deleteSelection`を`() => inputTracker.deleteLastLinePointOrSelection()`へ（コメント：「線を引いている途中は最後の点を消し、それ以外は選択集合の削除（削除ボタンと同一経路の`deleteSelection()`）。判定は`InputTracker`」）。`cancel`・`undo`・`redo`・`setShapeType`・`startEyedropper`の注入は**変えない**（実体の側で意味が変わる）。
7.  `applyMode`のJSDocの呼び出し元の列（「ツールパレットの選択・頂点の選択・キャンバス移動のボタン（`selectTool`経由の`toolActions`）、…キー`V`・`A`・`P`・`H`（`KeyboardShortcuts`の`setMode`）」）を、`selectModeTool`経由であることに合わせる。
*   **変えないもの**：削除ボタン（`inputTracker.deleteSelection()`）・`ClipboardController`への`deleteSelection`の注入・`ensureSelectMode`・`performPaste`・`performInvertSelection`・`selectAll`・`CanvasLibrary`の`prepareSwitch`・`prepareInsert`・`?dev`の`onImport`・`syncHistoryButtonState`（作成途中の図形があれば取り消しボタンは押せる＝線を引いている途中も押せる。今のまま）・`EndpointSnapper`・`InputTracker`の生成と注入（引数は変えない）。線を引く専用の再描画・同期の経路を足さない（`model.onChange`の既存の経路で描かれる）。

**`js/core/KeyboardShortcuts.js`**（**対応表`SHORTCUT_BINDINGS`・受理判定・コンストラクタは変えない**。typedef`ShortcutActions`のJSDocだけを実態に合わせる）：`setMode`・`setShapeType`（直線のツールで線を引いている途中なら、描いた分を残して終えてから切り替える）、`cancel`（直線のツールで線を引いている途中は、描いた分を開いたまま残して終える）、`deleteSelection`（直線のツールで線を引いている途中は最後の点を消す（始点だけならやめる）。それ以外は選択集合の全図形を削除する）、`undo`（直線のツールで線を引いている途中は最後の点を消すだけで履歴を変化させない。それ以外の作成途中の図形はその破棄のみ）。キーリピートの設定は今のまま（`Backspace`/`Delete`は繰り返さない、`Ctrl`+`Z`は繰り返す）。

### 要件8: テスト（REQ要件6）

*   状態を持たない規則：`test/shapes/PathJoinRules.test.js`（要件1）・`test/shapes/EndpointSnapRules.test.js`（要件2）・`test/core/UnitSnapRules.test.js`（要件3）へケースを足す。`MoveDirectionRules`は変えないため`test/core/MoveDirectionRules.test.js`は変えない。
*   `VectorModel`：新規`test/core/VectorModel.replaceDraft.test.js`（要件4）。
*   `EndpointSnapper`：`test/edit/EndpointSnapper.test.js`へ足す（要件5。記録が1件になること・点を打つ／消す操作で記録先に触れないこと）。
*   `InputTracker`・`main.js`・`KeyboardShortcuts`のtypedefは既存の方針どおりテストを置かない（`_doc/arch/16_test.md`）。
*   書き方は`_doc/arch/16_test.md`の決まりに従う（`node:test`・`node:assert/strict`のみ・先頭行に単一責務のJSDoc・補助関数にJSDoc・公開APIだけを通す・テストのためにソースを書き換えない・`console.warn`は`t.mock.method`で抑止）。
*   **既存のテストの期待値は変えない**（本計画では変える既存のケースは無い見込み。期待値を変えないと通らないケースが出た場合は、その場で実装を止めて理由を「4. 詳細作業内容」と「5. 懸念事項」に書き、オーケストレータへ報告する）。

### 要件9: ふるまいの確認（テストプレイの確認項目。REQ要件7）

実装の最後に、発注者が画面で確かめられる確認項目を、実装後のコードで裏取りしたうえで、画面・操作・挙動の言葉で提示する。少なくとも次を含める。
0.  **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。直線のツール（`1`）を選ぶ。
1.  **点を打つ**：クリックごとに点が打たれ、最後の点からカーソルまで線が付いてくる。打った点の間は確定した線と同じ見た目で描かれる（アウトライン表示（`Z`）でも同じ）。
2.  **最後の点をもう1回クリックで終える**：点3つ以上なら開いた折れ線（パス）、点2つなら直線になる。ダブルクリックでも終わる。選択（`V`）で選ぶと、点2つの線は直線、3つ以上はパスとして選べ、頂点の選択（`A`）で打った点がそのまま頂点になっている。始点だけのときに同じ位置をもう1回クリックすると何も残らない。
3.  **始点で閉じる**：点を3つ以上打ってから始点にカーソルを近づけると青い正方形が出て、クリックで閉じた多角形になる。点が2つのときは始点に近づけても吸い付かない。閉じた多角形は塗りを付けられる。
4.  **`Esc`で終える**：引いている途中の`Esc`で、描いた分が開いたまま残る。始点だけのときの`Esc`は何も残らない。
5.  **戻し**：引いている途中の`Backspace`・`Delete`・`Ctrl`+`Z`・ツールバーの取り消しボタンで最後の点が消え、引き続けられる。始点だけのときは引くのをやめる。引いている途中の`Ctrl`+`Z`で、その前に描いた図形が消えない。
6.  **取り消し1回で丸ごと戻る**：点を5つ打って終えた線が、`Ctrl`+`Z`1回で丸ごと消え、`Ctrl`+`Y`で丸ごと戻る。
7.  **既存の線の続き**：開いた線（直線・開いたパス）の端点から引き始めて点をいくつか打って終えると、その線の続きとして伸びた1本になる（色・太さは元の線のまま）。取り消し1回で伸ばす前に戻る。引き始めた端点にカーソルを戻しても青い正方形は出ない。
8.  **別の線とつながる**：引いている途中に別の開いた線の端点へ吸い付いてクリックすると、その線とつながった1本になって終わる。両端とも別の線の端点にすると3本が1本になる。
9.  **既存の線を閉じる**：開いた線の端点から引き始め、点を1つ以上打ってから、その線のもう一方の端点に吸い付いてクリックすると、閉じた多角形になる。
10. **`Shift`**：`Shift`を押している間、付いてくる線が横・縦・斜め45°に限定される。端点・始点の近くでは吸い付きが優先される。グリッドのスナップ（10px）をONにしても、限定した向きが崩れない。
11. **スナップと`Ctrl`**：スナップがONなら打つ点がそれぞれ刻みに乗る。`Ctrl`を押している間は、吸い付きもスナップも働かない（`Shift`の限定は働く）。
12. **パン・ズーム**：引いている途中にスペース＋ドラッグ・中ボタンのドラッグ・ホイールでパン・ズームしても、描いている線は消えず、そのまま引き続けられる。
13. **ツールの切り替え**：引いている途中に`V`・`A`・`H`・`P`・`I`・数字キー・ツールパレットのボタン（直線のツールのボタンを押し直したときも）を押すと、描いた分が残ってからツールが切り替わる（始点だけなら何も残らない）。中ボタンでパンしている最中にツールパレットのボタンを押しても、描いた分が残ってから切り替わる（取り消し1回で丸ごと消える）。
14. **中断で捨てる**：引いている途中にキャンバスを切り替える・ファイルを開く・貼り付ける（`Ctrl`+`V`）・全選択（`Ctrl`+`A`）・やり直し（`Ctrl`+`Y`）すると、描いている線は捨てられる（今までどおり）。
15. **削除・切り取りとの関係**：引いていないとき、選択（`V`）で図形を選んで`Delete`・削除ボタン・`Ctrl`+`X`を使うと、今までどおり図形が消える。
16. **ほかのツールが今までどおり**：曲線・弧・矩形・円は今までどおり2クリックで1つでき、作成途中の`Esc`で捨てられ、作成途中の`Ctrl`+`Z`でも捨てられる（その前の図形は消えない）。選択・頂点の選択・端点のハンドルのドラッグでの吸い付きと結合・結合（`J`）・保存・読み込み・書き出しが今までどおり動く。書き出したファイル（エンジン用のJS）で、引いたパスが折れ線として表示される（確認用ページ`sprite-check.html`で開いて確かめられる）。
*   自動テストで確かめられない箇所（`InputTracker`・`main.js`の配線、カーソルの追従と表示、ダブルクリック、`Shift`・`Ctrl`の読み取り、パン・ズームとの組み合わせ）を、特に確かめてほしい項目として添える。

---

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - 図形をまたぐ規則（`PathJoinRules`：点の並びの規則と描き足し・つながり・閉じるの計画の拡張、`EndpointSnapRules`：始点への吸い付きと描き始めの端点の除外）。`Path`はJSDocのみ。
    *   `./js/core/` - `VectorModel`（作成途中の図形の置き換え）、`UnitSnapRules`（限定した向きを保つ丸め）、`InputTracker`（入力の配線）、`KeyboardShortcuts`（typedefのJSDocのみ）。
    *   `./js/edit/` - `EndpointSnapper`（線を引く手順と反映・記録）。
    *   `./js/` - `main.js`（ツールの切り替え・取り消し・キーの配線）。
    *   `./test/shapes/`・`./test/core/`・`./test/edit/` - 上記の規則・モデル・手順のテスト。
*   **関連する論理クラス**: `PathJoinRules`（関数群）、`EndpointSnapRules`（関数群）、`UnitSnapRules`（関数群）、`MoveDirectionRules`（変更なし。使い回す）、`VectorModel`、`EndpointSnapper`、`InputTracker`、`KeyboardShortcuts`（JSDocのみ）、`Line`・`Path`（図形クラス。`Path`はJSDocのみ）。
*   **新しく作るファイル**：`test/core/VectorModel.replaceDraft.test.js`のみ（ソースのファイルは増やさない）。
*   **変更しないファイル（REQの読む範囲に挙がっていたもの）**：`js/core/InputModes.js`・`js/core/ShapeFactory.js`・`js/core/HistoryManager.js`・`js/core/MoveDirectionRules.js`・`js/shapes/Line.js`。REQに挙がっていないファイル（`index.html`・CSS・`palette/`・`io/`・`wiring/`・`CanvasManager.js`等）は変えない（変える必要が出た場合は実装を止めて本計画書の5章に理由を書き、発注者の判断を仰ぐ）。

### 参照する責務
（以後のタスク実行チャットは、この項目のみを責務情報源とする。`PROJECT_ARCHITECTURE.md`・`_doc/arch/`からの抜粋）
*   **依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`・`edit/`・`palette/`・`wiring/`・`asset/`をimportしない。`core/`から`shapes/`をimportするのは`core/ShapeFactory`の1ファイルだけ。一方向の列から外れるimportは、(1)`edit/PathJoiner → shapes/PathJoinRules`、`edit/EndpointSnapper → shapes/EndpointSnapRules`・`shapes/PathJoinRules`（`edit/`の他のクラスは`shapes/`をimportしない）、(2)`shapes/`内の`shapes/EndpointSnapRules → shapes/PathJoinRules`（`PathJoinRules`は今は`Path`のみimportするため循環しない。本作業で`Line`も足すが、`Line`のimportは`ShapeGeometry`・`ShapeDataValidation`だけで循環しない）、(3)`edit/NudgeEditor`等 → `core/`の規則、の3種だけ。循環importは無い。`core/InputTracker`は`edit/`をimportせず、`main.js`が注入した`EndpointSnapper`のメソッドを呼ぶだけ。
*   **`core/`の規則の関数**：状態・DOMを持たない関数。`InputTracker`へ判定表・組み立てを持ち込まない（状態の所有者の再分離はしない）。`UnitSnapRules`＝スナップ（座標・移動量を刻みの倍数へ丸めること。端点への吸い付きとは別）の規則。importなし・DOMなし・図形・`VectorModel`・表示倍率・修飾キーを知らない・引数を書き換えず新しいオブジェクトを返す・`MoveDirectionRules`をimportしない。ちょうど中間は0から遠い側へ丸め、`-0`を返さない。`MoveDirectionRules.constrainMoveDirection(dx, dy)`＝横・縦・斜め45°の最も近い直線へ正射影した移動量（斜めは`|dx| === |dy|`が厳密）。図形の移動の`Shift`＋スナップは「移動量 → `Shift`の限定 → 丸め（`roundConstrainedDeltaToUnit`）」の順で、45°では両軸が同じ量。
*   **`InputTracker.js`**：ユーザー入力の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知（注入された記録先`editRecorder`＝`HistoryManager`へ）、カーソル形状の適用を担う。**知らないこと**：図形種別（if/switch分岐を一切行わない）・`vertexIndex`規約・スナップの設定（注入された`getUnitSnapStep`で刻みを受け取るだけ）・`HistoryManager.js`（importしない）・ショートカットの解釈（`KeyboardShortcuts`の担当）・`main.js`の関数（呼ばない）。**端点への吸い付き**：第5引数`snapAssist`（typedef`EndpointSnapAssist`。実体は`EndpointSnapper`。省略時は吸い付かない既定値）。候補の探索・距離の判定・結果の組み立て・モデルへの反映（描き足し・結合・閉じる）を持たず、注入されたものを呼ぶ。描く図形種別（直線か）と端点のハンドルの判定も委ねる。`SnapTarget`は`x`・`y`だけを読む。持つのは呼ぶ場面の配線と、表示の点の設定・消去（`model.setSnapPoint`/`clearSnapPoint`）と、吸い付きの作業用フィールド（`#drawStartSnap`・`#drawEndSnap`・`#dragEndpoint`・`#dragSnap`。入力状態と寿命が同じで`#resetSnapState()`で消す）のみ。**表示を消す箇所**：`#resetSnapState()`（描き終え・`Esc`・`setShapeType`・`#abortOngoingOperation`・`#finishLeftDrag`）・`#beginPan`。**`Ctrl`の間は照会しない**（照会結果が`null`のときと同じ経路。吸い付いたら丸めない・吸い付かなかったときだけ丸める）。**描き終えの端点は直前の`mousemove`の照会結果**（クリック位置で取り直さない）。**修飾キー**：マウスのイベントの`Ctrl`（`⌘`を含む）は`hasCtrlModifier`に寄せる。`Shift`は本体ドラッグの追従のたびのイベントで読む（キーの購読なし）。修飾キーの読み取りは、規則の関数へ渡すこと・`Alt`で注入された複製を呼ぶかを決めること・`Ctrl`の間に吸い付きの照会を省くことにだけ使う（本作業で`Shift`の用途を足す）。**`deleteSelection()`**は削除ボタン・`Delete`/`Backspace`・切り取りの唯一の削除経路で、受理条件（選択モード・`IDLE`・ドラッグ中でない・選択集合が空でない）はこの中だけで判定する。**`abortOngoingOperation()`**は`?dev`の復元と取り消し・やり直しの前処理として`main.js`が呼び、`setMode`と同じ中断処理（ドラッグの中断・作成途中の図形の破棄・`#resetSnapState()`）を行う。**パン**は`DRAWING`を保ったまま行える。行数は1579行（再分離の候補は`_doc/COWORK_STATUS.md`2章A。本作業では再分離しない）。
*   **`VectorModel.js`**：描画データと選択集合・頂点の選択・ホバー・作成中図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイル（直前に使った値）を保持する単一の真実（SSOT）。**知らないこと**：図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式・`DocumentSerializer`。`Line`への直接依存も持たない。共通プロパティのスタイル3つ（`strokeColor`・`strokeWidth`・`fillColor`）は書く（`updateShapeStyles`・`startDraft`・`updateNewShapeStyle`の作成途中の図形。本作業で`replaceDraft`を足す）。再編集・追従は図形の`setVertex`/`translate`/`updateDraftEnd`へポリモーフィックに委譲する。生成は`ShapeFactory.create`へ委譲する。id`shape-<連番>`の採番は`#issueId()`の1箇所。直前に使った値は`startDraft`が`ShapeFactory.create`の直後に作成途中の図形へ当て、作成途中に値を変えると作成途中の図形も変わる。保存・履歴の対象外。`replaceShape`の`select: false`は作成モードでも選択集合の不変条件（選択モード・頂点の選択モード以外では空）を崩さない。
*   **`ShapeFactory.js`**（変更しない）：`core/`層で図形種別の対応づけを許容する唯一の例外。`path`は`create: null`の読み込み専用の種別（`SHAPE_TYPES`に出ず`create`できない）。
*   **`edit/EndpointSnapper.js`**：端点への吸い付きの照会と、吸い付いた端点での描き足し・結合・閉じる操作のモデルへの反映を、規則（`shapes/EndpointSnapRules`・`shapes/PathJoinRules`）に従って行う手順。DOMに触れない。importは`../shapes/EndpointSnapRules.js`と`../shapes/PathJoinRules.js`のみ。`VectorModel`・`HistoryManager`はimportせず注入で受け取る。`InputTracker`に依存しない。図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない（読むのは共通プロパティ`id`のみ）。`try/catch`を持たない。**操作モードを知らない**（`edit/`共通）。呼び出し元は`InputTracker`のみ（`main.js`が生成して第5引数に注入）。描き終えの反映：両方`null`なら何もせず`false`（呼び出し側が従来の確定）、それ以外は作成途中の直線を捨てて`beginEdit` → `replaceShape`（`select: false`）→ `commitEdit`。計画が何も起こさない場合は記録しない。許容距離は呼び出しのたびに`screenLengthToWorld`で換算する（吸い付く距離＝`SNAP_TOLERANCE_SCREEN_PX`の8px、重なり＝`JOIN_TOLERANCE_SCREEN_PX`の5px）。
*   **`shapes/PathJoinRules.js`**：図形をまたぐ規則（結合）。図形クラスではない第3の種類。状態を持たない`export`した関数と定数のみ。規則の詳細の正本はJSDoc。**読むもの**：図形の`type`・公開プロパティ`id`・`toJSON()`の図形データだけ（図形クラスの内部プロパティを読まない）。結果は`Path`のコンストラクタで作る（本作業で`Line`も）。**使う側**：`edit/PathJoiner`・`edit/EndpointSnapper`・`shapes/EndpointSnapRules`（`core/`は使わない）。**知らないこと**：表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式。許容距離はワールドの長さで引数に受け取る。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。**描き足しの規則**：元のid・色・太さ・塗り・重なり順の位置・元の線の向きを保つ。足す頂点が端点と重なる（`tolerance`以内）場合は何も起きない。**吸い付きでの結合**：つなぐ端点は吸い付いた端点。基準の線A＝重なり順で奥の図形で、結果の向き・色・太さ・塗りはAのもの。2本の結合はAの位置に新しいidで置きBを除く。閉じるは元のidと位置を保つ。頂点2つの線は閉じない。頂点の並べ方は非公開の組み立て関数（`assembleOpenPath`）が共有する。`planDrawnLineJoin`の`startSnap`/`endSnap`は`null`で渡す前提。同じ線を閉じる計画は非公開の`planCloseOf`で共有する。
*   **`shapes/EndpointSnapRules.js`**：図形をまたぐ規則（端点への吸い付き）。状態を持たない`export`した関数と定数のみ。**読むもの**：図形の`type`（`isJoinableLine`経由）・`id`・`toJSON()`・`getVertexIndexForHandle`。importは`./PathJoinRules.js`のみ。吸い付く距離＝画面上8px（ちょうどを含む）。対象は結合できる線（直線・開いたパス）の端点だけ（曲線・矩形・円・弧・閉じたパスの点・途中の頂点へ広げない）。候補の選び方は`findSnapTarget`のJSDocが正本。`SNAP_TOLERANCE_SCREEN_PX`（8px）・`JOIN_TOLERANCE_SCREEN_PX`（5px）・`InputTracker`の`hitTolerance`（5px）・表示の大きさ（`CanvasManager`の定数）は互いに別の定義。**`_doc/COWORK_STATUS.md` 2章Aの注意（REQより）**：吸い付きの対象を広げるときは、照会の結果に種類を区別する項目を足し、`commitDrawnLine`・`joinDraggedEndpoint`が取り違えないようにすること／`Ctrl`の間は何にも吸い付かない／吸い付いたら丸めない・吸い付かなかったときだけ丸める。
*   **`shapes/`の図形クラス**：種別ごとに1ファイル。共通メソッド契約は18メソッド（`draw`・`drawHandles`・`drawHover`・`hitTest`・`hitTestHandle`・`setVertex`・`translate`・`updateDraftEnd`・`getVertexIndexForHandle`・`intersectsRect`・`toJSON`・`static fromJSON`・`toDrawElement`・`isFillable`・`hitTestFill`・`drawOutline`・`getHandlePosition`・`getVertexHandleNames`）。本作業でメソッドを足さない。`Line`は`x1, y1, x2, y2`、`Path`は`points`・`closed`・`segments`（区間はすべて`{ kind: 'line' }`。頂点数の下限は開いた2・閉じた3。閉じたパスは始点を重複させない）。塗れる形は`rect`・`circle`・閉じた`path`。
*   **`KeyboardShortcuts.js`**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみ。操作の実体は`main.js`から注入されたコールバック（typedef`ShortcutActions`が契約の正本）。ドラッグ中は実行しない。`Esc`＝`cancel`、`Delete`/`Backspace`＝`deleteSelection`（リピート不可）、`Ctrl`+`Z`＝`undo`（リピート可）。本作業で表は変えない。
*   **`main.js`**：インスタンス化・依存の注入・イベントバインド。**判定・計算のロジックを持たない**（`InputTracker`の公開操作の戻り値をそのまま返す）。同一経路の原則：取り消し・やり直しのボタンとショートカットは`performUndo()`/`performRedo()`のみ、削除ボタンとショートカットは`inputTracker.deleteSelection()`のみ（本作業でショートカット側は`deleteLastLinePointOrSelection()`へ）、ツールパレットの図形のボタンと数字キーは`selectShapeTool`、選択・頂点の選択・キャンバス移動のボタンと`V`・`A`・`H`・`P`は`applyMode`（本作業で`selectModeTool`経由）、スポイトのボタンと`I`は`startEyedropper()`。`ensureSelectMode()`は全選択・貼り付け・同じ位置に貼り付け・選択の反転・スポイトの開始の共通の前処理。`applyMode`は`inputTracker.setMode` → `styleEyedropper.stop()` → `syncToolPalette()`。キャンバスの切り替え（`prepareSwitch`）・インポート（`prepareInsert`）も`applyMode`を通る。同期の経路は既存のもの（`model.onChange`等）のみで、機能専用の再描画・同期を足さない。
*   **履歴**：編集操作の前後を`beginEdit()`／`commitEdit()`で挟むスナップショット方式（前後の作業データが同じなら記録しない）。作成途中の図形の開始・破棄は記録しない。`performUndo`：ドラッグ中は不受理 → `abortOngoingOperation()`で作成途中の図形を捨てたらそこで終わり → `historyManager.undo()`。`performRedo`：ドラッグ中は不受理 → `abortOngoingOperation()`（捨てて続行）→ `redo()`。
*   **テストの規則（`_doc/arch/16_test.md`）**：`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。`node:test`・`node:assert/strict`のみ。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。公開APIのみを通し、テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。注入される依存は素のオブジェクトの偽物（例外：`test/edit/EndpointSnapper.test.js`は実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`EndpointSnapper`を組み合わせてよい）。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止。`InputTracker`・`main.js`はテストを置かない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体への反映は最終タスクで行う。各タスクで判明したことはここへ追記する）
*   **1章**：
    *   フォルダ構造の`test/core/`へ`VectorModel.replaceDraft.test.js`を足す。
    *   「存在しないもの」へ本作業の「今回やらないこと」を足す：曲線の連続作成（曲線のパスのPhase）・ドラッグによるフリーハンドの線・`Enter`・`Ctrl`＋クリックでの線の終了・線を引いている途中のやり直しで点を戻す仕組み。
    *   「依存方向」の(2)の「`PathJoinRules`は`Path`のみimportするため循環しない」を「`PathJoinRules`は`Line`・`Path`のみimportするため循環しない」へ。
    *   `shapes/`の説明（フォルダ分割の方針）に、`PathJoinRules`が続けて引く線の点の並びの規則（直線とパスの作り分け）も持つことを足す。
*   **2章**：`path`の項に「直線のツールで点を3つ以上打って作られる（開いた／閉じた）」を足す。「新しく描く図形のスタイル（直前に使った値）」の**当てる場所**を「`startDraft`と`replaceDraft`（作成途中の図形を作る・置き換えるのはこの2つだけ）」へ。**当てないもの**の「直線の描き終えの吸い付きによる描き足し・結合・閉じるの結果（作成途中の直線は捨てられ…）」を、線を引いた結果の描き足し・つながり・既存の線を閉じるに広げる（吸い付きなしで終えた線・始点で閉じた線は直前に使った値）。
*   **3章3.**：「頂点のハンドルのドラッグ・図形の作成で打つ点」の「図形の作成で打つ2点」を、直線のツールでは打つ点のそれぞれ（描き始め・付いてくる線の先）へ。「本体ドラッグの移動量」の「`Shift`が効くのは本体・moveハンドルの移動だけ（…作成…では何もしない）」に、直線のツールで線を引いている途中の付いてくる線の先も限定されること（2026-11-18 発注者の決定）を足す。**キーボード操作**：`Esc`（線を引いている途中は開いたまま終える）・`Backspace`/`Delete`（線を引いている途中は最後の点を消す。実体は`inputTracker.deleteLastLinePointOrSelection()`）・`Ctrl`+`Z`（線を引いている途中は最後の点を消す）の意味、対応表は変えていないことを書く。
*   **3章6.（履歴）**：記録する操作と時点の「図形の作成」に、直線のツールでは終えたとき（開いたまま・閉じて・つながって）に`EndpointSnapper`の中で1回の終わり方につき1件（吸い付きなし＝`replaceDraft` → `beginEdit` → `commitDraft` → `commitEdit`、描き足し・つながり・閉じる＝`cancelDraft` → `beginEdit` → `replaceShape` → `commitEdit`）・点を打つ・消すは記録しないことを足す。**削除**の項の「`Delete`/`Backspace`」は線を引いていないときであることを足す。**適用の流れ**の手順に「1.の次：`inputTracker.removeLastLinePoint()`が真ならそこで終了（取り消しのみ。履歴を変化させない）」を足し、手順2.の破棄の対象を「直線のツール以外の作成途中の図形」へ。**記録しない操作**に「線を引いている途中の点を打つ・最後の点を消す」を足す。
*   **3章12.（端点への吸い付きと描き足し）**：流れの「描いている途中」「描き終え」を、線を引いている途中の流れ（`mousemove`の照会は`findDrawnLineSnap`＝描き始めの端点を除き、打った点が3つ以上で描き始めが端点でなければ始点も対象。クリックの判定の順1.〜4.・`Esc`・ツールの切り替え・`Backspace`/`Delete`・取り消し）へ書き換える（直線以外のツールの描き終えは今のまま）。始点への吸い付きの結果は種類の項目（`kind: 'drawnStart'`）で区別し、`commitDrawnLine`・`joinDraggedEndpoint`へ渡らない（`clickDrawnLine`が先に扱う）こと。発注者の決定に「既存の線の端点から引き始めたときは自分の始点に吸い付かない」「始点への吸い付きは打った点が3つ以上のときだけ」を足す。**表示を消す箇所**に、点を打った直後・最後の点を消した直後（`#drawEndSnap`を`null`にして表示を消す）と、`finishLineDrawing`（`#resetSnapState()`）を足す。モジュールの分担に`PathJoinRules`の点の並びの規則・`EndpointSnapper`の線を引く手順・`VectorModel.replaceDraft`を足す。
*   **3章16.**：**修飾キーを見る時点**の`Shift`に「直線のツールで線を引いている途中の付いてくる線の先＝その`mousemove`（キーの購読なし）」を足す。**発注者の決定（2026-11-14）**の「`Shift`は移動だけ（…作成…には効かない）」は、2026-11-18の発注者の決定で直線のツールの線を引いている途中が加わったことを注記する。
*   **3章17.（スナップ）**：**丸める箇所**の「図形の作成で打つ2点」を、直線のツールでは打つ点のそれぞれ（描き始め・付いてくる線の先。点を打つ位置＝直前の`mousemove`で決めた付いてくる線の先）へ。`Shift`との組み合わせ（最後の点を基準に`constrainMoveDirection` → `roundConstrainedPointFromOriginToUnit`。基準点が刻みの倍数なら結果も倍数・限定した向きが崩れない）を足す。**`Ctrl`を見る時点**（REQの「3か所を揃える」の3つ目）に、`Shift`を見る時点（線を引いている途中＝その`mousemove`）を足す。モジュールの分担の`UnitSnapRules`の関数の列に`roundConstrainedPointFromOriginToUnit`を足す。
*   **3章に新しい節（22.「直線のツールで線を続けて引く」）を足すか、12.へまとめるかは最終タスクで決める**（どちらにしても、用語・状態の持ち主（打った点の並びは`VectorModel`の作成途中の図形だけ）・作成途中の図形の持ち方（点1つ＝直線、2つ以上＝開いたパス）・操作ごとの流れ（本計画書2章の表）・クリックの判定の順・記録・発注者の決定・現場設計セッションが決めた点・やらないことを書く）。
*   **`_doc/arch/02_main.md`**：主な関数に`selectModeTool`を足す。`// 7.`の行に`selectModeTool`を足す。`performUndo`の手順。同一経路の原則（`Delete`/`Backspace`のショートカットは`deleteLastLinePointOrSelection()`、削除ボタンは`deleteSelection()`のまま／選択・頂点の選択・キャンバス移動のボタンと`V`・`A`・`H`・`P`は`selectModeTool`／ツールの切り替えの経路だけが先に`finishLineDrawing()`を呼び、`ensureSelectMode`の経路は呼ばない理由）。`KeyboardShortcuts`への注入の表の`deleteSelection`・`setMode`。`main.js`の行数。
*   **`_doc/arch/03_VectorModel.md`**：公開メソッドに`replaceDraft`を足し、その約束（idは`null`・直前に使った値を当てる・`#shapes`に入れない・通知1回・作成途中の図形が無い／`#shapes`の図形では何もしない）と呼び出し元（`edit/EndpointSnapper`のみ）を書く。「知らないこと」のスタイル3つを書く箇所に`replaceDraft`を足す。「委譲」の生成に、作成途中の線の組み立て直しは`PathJoinRules`が作った図形を受け取るだけであることを足す。
*   **`_doc/arch/06_InputTracker.md`**：公開メソッドに`finishLineDrawing`・`removeLastLinePoint`・`deleteLastLinePointOrSelection`を足す（`finishLineDrawing`はドラッグ中かを見ない＝パン中のツールパレットのボタンでも描いた分を残し、パンのドラッグの中断は続く`setMode`に任せること、`removeLastLinePoint`はドラッグ中は受け付けないこと）。**修飾キー**の項（REQの「3か所を揃える」の2つ目）に`Shift`の新しい用途と見る時点を足す。**端点への吸い付き**の「配線の場面」に線を引いている途中の場面を、`EndpointSnapAssist`の新しい項目を足す（`kind`は解釈しない）。`cancelDraftOrClearSelection`（`Esc`）の`DRAWING`の扱い。`abortOngoingOperation`と`performUndo`の約束。作業用フィールドは足していないこと。行数。
*   **`_doc/arch/07_KeyboardShortcuts.md`**：対応表は変えず、`cancel`・`deleteSelection`・`undo`・`setMode`・`setShapeType`の意味が線を引いている途中だけ広がったこと（実体の側で変えた）を書く。
*   **`_doc/arch/12_shapes.md`**：`PathJoinRules`の公開に新しい6関数を足し、責務・importに`./Line.js`を足し（「importは`./Path.js`のみ」を直す）、直線とパスの作り分け（`buildLineOrPath`）の唯一の箇所・`extendWithPoints`が`buildExtendedPath`を繰り返すこと・`planDrawnLineJoin`の拡張（頂点2つでは今と同じ）を注意に足す。`EndpointSnapRules`の公開に`DRAWN_START_SNAP_KIND`・`isDrawnStartSnap`・`findDrawnLineSnapTarget`・typedef`DrawnStartSnap`を、importに`canCloseDrawnLine`を足し、走査の共有を書く。`Path.js`の「`ShapeFactory.create`では作られない（…作る操作は結合・描き足し・閉じる）」に続けて引く線を、「`updateDraftEnd`は終点を動かす（現在は呼ばれない）」を作成途中の線で呼ばれることへ直す。
*   **`_doc/arch/14_edit.md`**：`EndpointSnapper`の責務・公開メソッド（`isDrawingLine`・`findDrawnLineSnap`・`getDrawnLineLastPoint`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`）・使う`model`のメソッド（`replaceDraft`・`commitDraft`）・記録の約束を足す。
*   **`_doc/arch/28_MoveDirectionRules.md`**：使う側に`InputTracker`の線を引いている途中の付いてくる線の先を足す（関数は変えていない）。
*   **`_doc/arch/30_UnitSnapRules.md`**：`roundConstrainedPointFromOriginToUnit`を足す。
*   **`_doc/arch/16_test.md`**：`test/core/VectorModel.replaceDraft.test.js`（新規）と、`PathJoinRules`・`EndpointSnapRules`・`UnitSnapRules`・`EndpointSnapper`のテストの検証範囲の追加、既存のケースの期待値の書き換え（無し）、件数（タスク9で控えた`node --test`の結果）。
*   `_doc/arch/10_ShapeFactory.md`は変更なし（`ShapeFactory`は変えていない。直線とパスの作り分けは`PathJoinRules`にある旨を足すかは最終タスクで判断する）。

---

## 3. タスクリスト

**タスクの分け方**：下の層（規則）から上の層（配線）へ、1タスク＝1ファイル（＋そのテスト）を基本に分ける（要件1の`PathJoinRules`は量が多いため、点の並びの規則（タスク1）と、描き足し・つながり・閉じるの計画の拡張（タスク2）の2タスクに分ける。タスク2はタスク1で更新した責務定義・importの上に足す）。タスク1〜5はどこからも呼ばれない関数・メソッドの追加（`planDrawnLineJoin`・`findSnapTarget`は今の結果のまま）のため、途中の段階でもアプリのふるまいと`node --test`の結果は壊れない。タスク6で手順が揃い、タスク7で直線のツールのふるまいが変わり、タスク8でツールの切り替え・キー・取り消しの配線が揃う（タスク7の後・タスク8の前も、ツールの切り替えで捨てる・`Backspace`が何もしない・取り消しで捨てるだけで、アプリは壊れない）。

**全タスク共通の約束**：
*   本計画書の「2. アーキテクチャ設計」の該当の要件と「参照する責務」だけを責務情報源とする。対象ファイル以外を変更しない。改名・整形・不要に見えるコードの削除をしない。既存のテストのケース・期待値・補助関数を変えない（足すだけ）。
*   「今回やらないこと」に挙げた到達不能な枝（各図形の`drawHandles`、`resolvePressAction`のハンドルの枝、`CursorShapeRules`の選択モードのハンドルの枝、`CanvasManager.render`のハンドルを描く段、`VectorModel.updateVertex`）は**残す**。
*   性能の改善を目的とした変更をしない。書き出しの際の座標の丸めをしない。

*   [x] タスク1: 要件1（前半） 作成途中の線の点の並びの規則（`shapes/PathJoinRules`。`Path`はJSDocのみ）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` :（更新。`./Line.js`のimportの追加・非公開の`LINE_POINT_COUNT`・`buildLineOrPath`の追加・新しい6関数の追加・先頭の責務定義の更新・`CLOSED_MIN_POINTS`のJSDocへの追記）
        *   `./js/shapes/Path.js` :（更新。クラスのJSDocと`updateDraftEnd`のJSDocのみ。コードは変えない）
        *   `./test/shapes/PathJoinRules.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件1のとおり、`./Line.js`のimport、非公開の`LINE_POINT_COUNT`・`buildLineOrPath`、公開の`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`・`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`を足す。各関数にJSDoc（責務・`@param`・`@returns`・作成途中の線の約束・引数を書き換えないこと・結果のスタイルとidと共有しないこと）を書く。`CLOSED_MIN_POINTS`のJSDocの「共有する」関数の列に、これを使う新しい関数を足す。
        *   **本タスクでは`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`を足さず、`planDrawnLineJoin`を変えない**（タスク2）。
        *   既存の関数（要件1の「変えないもの」）の中身を変えない。
        *   ファイル先頭の責務定義（3行以内）を要件1の例のとおりに更新する（タスク2の分を含めた最終の文面にする）。
        *   `Path.js`のクラスのJSDoc・`updateDraftEnd`のJSDocを要件1のとおりに直す（コード・他のJSDocは変えない）。
        *   `test/shapes/PathJoinRules.test.js`へ、要件1のテストの観点のうち`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`・`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`の観点と、これらの関数が引数を書き換えず結果が引数と頂点を共有しないことを確かめる`describe`を足す（既存のケース・補助関数は変えない。新しい補助関数にはJSDoc）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（既存の`PathJoinRules`・`EndpointSnapper`のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク2: 要件1（後半） 描き足し・つながり・閉じるの計画の拡張（`shapes/PathJoinRules`の`planDrawnLineJoin`）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` :（更新。非公開の`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`の追加と、`planDrawnLineJoin`の拡張・JSDocの更新のみ）
        *   `./test/shapes/PathJoinRules.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件1のとおり、非公開の`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`を足す（重なりの規則は`buildExtendedPath`の1か所のまま。並べ方・向き・スタイルは既存の`buildExtendedPath`・`buildClosedPath`・`buildJoinedPathAt`を使い回し、二重に書かない）。各関数にJSDoc（責務・`@param`・`@returns`・引数を書き換えないこと・結果のスタイルとidと共有しないこと）を書く。
        *   `planDrawnLineJoin`を要件1の1.〜4.のとおりに広げる（2.・3.の途中の点が無い場合は今の`planCloseOf`・`planJoinAt`をそのまま呼ぶ。4.は`extendWithPoints`）。JSDocの`drawn`の説明と処理の説明を実態に合わせる（名前・引数・戻り値の形は変えない）。
        *   タスク1で足した関数・既存の関数（要件1の「変えないもの」）の中身を変えない。ファイル先頭の責務定義・importは変えない（タスク1で更新済み）。
        *   `test/shapes/PathJoinRules.test.js`へ、要件1のテストの観点のうち`planDrawnLineJoin`の拡張の観点（**頂点2つのとき今の結果と同じであることの回帰**を含む）と、`planDrawnLineJoin`が引数（`drawn`・`shapes`の図形・`startSnap`・`endSnap`）を書き換えず結果が引数と頂点を共有しないことを確かめる`describe`を足す（既存のケース・補助関数・タスク1で足したケースは変えない。新しい補助関数にはJSDoc）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（既存の`PathJoinRules`・`EndpointSnapper`のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク3: 要件2 始点への吸い付きと描き始めの端点の除外（`shapes/EndpointSnapRules`）
    *   **対象ファイル** :
        *   `./js/shapes/EndpointSnapRules.js` :（更新。importの追加・定数・typedef・2関数の追加・走査の非公開関数への切り出し・先頭の責務定義の更新）
        *   `./test/shapes/EndpointSnapRules.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件2のとおり、`canCloseDrawnLine`のimport、`DRAWN_START_SNAP_KIND`・typedef`DrawnStartSnap`・`isDrawnStartSnap`・`findDrawnLineSnapTarget`を足す。`findSnapTarget`の走査を非公開の関数へ切り出して共有する（**`findSnapTarget`の名前・引数・結果・JSDocの規則の記述は変えない**。typedef`SnapTarget`に項目を足さない）。
        *   各関数・定数・typedefにJSDoc（責務・`@param`・`@returns`・候補の選び方・同距離のとき・引数を書き換えないこと・`DrawnStartSnap`を`PathJoinRules`の計画へ渡さないこと）を書く。
        *   ファイル先頭の責務定義（3行以内）を要件2のとおりに更新する。
        *   `test/shapes/EndpointSnapRules.test.js`へ要件2のテストの観点をすべて確かめる`describe`を足す（既存のケースは変えない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（既存の`findSnapTarget`のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク4: 要件3 `Shift`で限定した向きを保つ丸め（`core/UnitSnapRules`）
    *   **対象ファイル** :
        *   `./js/core/UnitSnapRules.js` :（更新。`roundConstrainedPointFromOriginToUnit`の追加のみ）
        *   `./test/core/UnitSnapRules.test.js` :（更新。`describe`の追加と、必要なimportの追加のみ）
    *   **作業内容** :
        *   要件3のとおり`roundConstrainedPointFromOriginToUnit(origin, delta, step)`を`roundPointFromOriginToUnit`の後に足す（中で`roundConstrainedDeltaToUnit`を使う。丸めの規則を二重に書かない。importを足さない）。JSDoc（(e)の見出し・用途・刻みが無効なとき・`-0`を含まない・引数を書き換えない・新しいオブジェクト）を書く。
        *   ファイル先頭の責務定義・既存の関数は変えない。
        *   `test/core/UnitSnapRules.test.js`へ要件3のテストの観点をすべて確かめる`describe`を足す（既存のケースは変えない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク5: 要件4 作成途中の図形の置き換え（`core/VectorModel.replaceDraft`）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`replaceDraft`の追加と、`#draftShape`・`startDraft`のJSDocへの追記のみ）
        *   `./test/core/VectorModel.replaceDraft.test.js` :（新規）
    *   **作業内容** :
        *   要件4のとおり`cancelDraft`の直後に`replaceDraft(shape)`を足す（`#assignShapeStyle`・`#toShapeStyle`を使う。importを足さない。図形種別・頂点を関知しない）。JSDoc（処理順1.〜4.・触れない状態・インスタンスを流用しないこと・呼び出し元＝`edit/EndpointSnapper`・`@param`・`@returns`）を書く。
        *   `#draftShape`のJSDoc・`startDraft`のJSDocを要件4のとおりに補う。ファイル先頭の責務定義・既存のメソッドの中身・importは変えない。
        *   `test/core/VectorModel.replaceDraft.test.js`（新規）：先頭に単一責務のJSDoc。要件4のテストの観点をすべて確かめる（図形は`js/shapes/`の`Line`・`Path`の実物を使ってよい。`console.warn`は`t.mock.method`で抑止）。補助関数にはJSDoc。既存のテストファイルは変えない。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（`VectorModel.updateVertex`・`addShape`は**残す**）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク6: 要件5 線を引く手順（`edit/EndpointSnapper`）
    *   **対象ファイル** :
        *   `./js/edit/EndpointSnapper.js` :（更新。importの追加・`#reflectDrawnJoin`への切り出し・`#commitDrawnShape`と公開6メソッドの追加・クラスのJSDocと先頭の責務定義の更新）
        *   `./test/edit/EndpointSnapper.test.js` :（更新。テストの追加と、必要なimport・新しい補助関数の追加のみ）
    *   **作業内容** :
        *   要件5のとおり、importを足し、`commitDrawnLine`の中身を`#reflectDrawnJoin`へ切り出し（`commitDrawnLine`のふるまい・呼び出し順・換算の呼び方・戻り値は変えない）、`#commitDrawnShape`と`isDrawingLine`・`findDrawnLineSnap`・`getDrawnLineLastPoint`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`を足す。各メソッドにJSDoc（処理順を番号付き・戻り値の意味・記録先に触れるか・`@param`・`@returns`）を書く。
        *   `findDrawSnap`・`resolveDragEndpoint`・`findDragSnap`・`joinDraggedEndpoint`・コンストラクタ・フィールドは変えない。
        *   クラスのJSDoc（依存の制約の`model`のメソッドの列・前提・通知の回数）とファイル先頭の責務定義（3行以内）を要件5のとおりに更新する。
        *   `test/edit/EndpointSnapper.test.js`へ要件5のテストの観点をすべて確かめるテストを足す（**既存のケース・`setupFake`・`setupReal`・`drawLine`等の補助関数は変えない**。偽の`model`に`replaceDraft`・`commitDraft`が要る場合は新しい補助関数をJSDoc付きで足す）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク7: 要件6 入力の配線（`core/InputTracker`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `./UnitSnapRules.js`のimportへ`roundConstrainedPointFromOriginToUnit`を足す（`constrainMoveDirection`はimport済み）。ほかのimportは足さない（`edit/`・`shapes/`をimportしない）。
        *   要件6のとおり、typedef`EndpointSnapAssist`と`NO_SNAP_ASSIST`へ6項目を足し、非公開の`#isDrawingLine`・`#finishDrawnLine`・`#resolveDrawnLineEnd`、公開の`finishLineDrawing`・`removeLastLinePoint`・`deleteLastLinePointOrSelection`を足し、`handleMouseMove`・`handleClick`・`cancelDraftOrClearSelection`の`DRAWING`の枝へ線を引いている途中の分岐を足す（**直線のツール以外の枝・描き始め・ほかのモードの枝のコードは変えない**）。
        *   **作業用フィールドを足さない**。`#resetSnapState()`・`setMode`・`setShapeType`・`#abortOngoingOperation`・`deleteSelection()`・`#beginPan`・`handleWheel`・`handleMouseDown`の中身を変えない。図形種別の分岐・点の並び・判定・計算を書かない（補助と規則の関数を呼ぶだけ）。
        *   ファイル先頭の責務定義（3行以内のまま）・クラスのJSDoc・`handleMouseMove`・`handleClick`・`cancelDraftOrClearSelection`・`abortOngoingOperation`のJSDocを要件6のとおりに実態に合わせる。新しいメソッドとtypedefの項目にJSDocを書く。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（到達不能な枝は**残す**）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`InputTracker`のテストは置かない）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない。変更後の`InputTracker.js`の行数を控える）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク8: 要件7 ツールの切り替え・`Backspace`/`Delete`・取り消しの配線（`main.js`・`KeyboardShortcuts`のtypedef）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
        *   `./js/core/KeyboardShortcuts.js` :（更新。typedef`ShortcutActions`のJSDocのみ。対応表・コードは変えない）
    *   **作業内容** :
        *   `main.js`へ要件7の1.〜7.を行う（`performUndo`への1行・`selectModeTool`の追加・`selectShapeTool`と`startEyedropper`の先頭への1行・`toolActions`の3項目・`KeyboardShortcuts`への注入の`setMode`と`deleteSelection`・JSDocとコメントの更新）。**判定・計算を書かない**（条件なしに呼ぶか、戻り値をそのまま返す）。要件7の「変えないもの」を変えない。新しい再描画・同期の経路・`document`への購読を足さない。
        *   `KeyboardShortcuts.js`のtypedef`ShortcutActions`の`setMode`・`setShapeType`・`cancel`・`deleteSelection`・`undo`のJSDocを要件7のとおりに実態に合わせる（`SHORTCUT_BINDINGS`・受理判定・ほかのJSDocは変えない）。
        *   ツールの切り替えの経路（ツールパレットの全ボタン・数字キー・`V`・`A`・`P`・`H`・`I`）がすべて`finishLineDrawing()`を先に通り、`ensureSelectMode`の経路（全選択・貼り付け・同じ位置に貼り付け・選択の反転）・`prepareSwitch`・`prepareInsert`・`performRedo`・`?dev`の`onImport`が通らないことを、コードを追って確認する。あわせて、ツールパレットのボタンの経路（`selectTool` → `toolActions`）がドラッグ中かを見ないため、中ボタンのパン中に押されても`finishLineDrawing()`が描いた分を残し、続く`setMode`がパンのドラッグを中断することを確認する（要件6の`finishLineDrawing()`）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`KeyboardShortcuts`の既存のテストがそのまま通ること）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない。変更後の`main.js`の行数を控える）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク9: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
    *   **対象ファイル** :
        *   （原則として変更なし。漏れが見つかった場合のみ、タスク1〜8で触れたファイルを直す）
    *   **作業内容** :
        *   タスク1〜8で新規・更新した全ファイルについて、ファイル先頭の責務定義（3行以内）と、クラス・関数・メソッド・typedef・定数のJSDoc（責務・`@param`・`@returns`）の記載漏れがないこと、意味が広がった既存の公開メソッド・関数（`planDrawnLineJoin`・`commitDrawnLine`・`cancelDraftOrClearSelection`・`abortOngoingOperation`・`performUndo`・`applyMode`・`selectShapeTool`・`startEyedropper`・`ShortcutActions`の各項目・`Path.updateDraftEnd`）のJSDocが実態に合っていることを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（「今回やらないこと」に挙げた到達不能な枝＝各図形の`drawHandles`・`resolvePressAction`のハンドルの枝・`CursorShapeRules`の選択モードのハンドルの枝・`CanvasManager.render`のハンドルを描く段と、`VectorModel.updateVertex`は**残す**）。
        *   `git status`・`git diff --stat`で、変更したファイルが本計画書の対象ファイルだけであること（`js/shapes/PathJoinRules.js`・`Path.js`（JSDocのみ）・`EndpointSnapRules.js`、`js/core/UnitSnapRules.js`・`VectorModel.js`・`InputTracker.js`・`KeyboardShortcuts.js`（JSDocのみ）、`js/edit/EndpointSnapper.js`、`js/main.js`、`test/shapes/PathJoinRules.test.js`・`EndpointSnapRules.test.js`、`test/core/UnitSnapRules.test.js`・`VectorModel.replaceDraft.test.js`（新規）、`test/edit/EndpointSnapper.test.js`と本RES）を確認する。`js/core/InputModes.js`・`ShapeFactory.js`・`HistoryManager.js`・`MoveDirectionRules.js`・`CanvasManager.js`、`js/shapes/Line.js`、`index.html`・`js/palette/`・`js/io/`・`js/wiring/`・`asset/`が**変わっていないこと**。
        *   既存のテストの期待値を変えていないことを確認する（`git diff`で既存のテストファイルの変更がケース・`describe`・補助関数・importの**追加だけ**であること）。
        *   作業データ形式・書き出し形式の版（`DocumentSerializer`・`SpriteSerializer`）・図形種別・区間の種類に触れていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ること（`fail 0`）を確認し、`tests`・`suites`・`pass`の件数を控える（本作業前は tests 1543 / suites 230）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク10: 要件9 テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   `./_log/res/261118_1532_RES_Interrupt_Continuous_Line.md` :（更新。詳細作業内容への記載のみ）
    *   **作業内容** :
        *   本計画書の「要件9: ふるまいの確認（テストプレイの確認項目）」の0〜16を、**実装後のコードで裏取りしたうえで**、画面・操作・挙動の言葉で発注者へ提示する（とくに2.のダブルクリック・3.の始点の吸い付きの条件・7.の引き始めた端点に戻ったときの表示・13.・14.の経路の区別は、`InputTracker`・`EndpointSnapper`・`main.js`の実コードで確かめてから書く）。
        *   自動テストで確かめられない箇所（要件9の末尾）を、特に確かめてほしい項目として添える。本計画書の「5. 懸念事項」のうち発注者に目視で確かめてほしい点も添える。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ提示した内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/02_main.md`・`03_VectorModel.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`12_shapes.md`・`14_edit.md`・`16_test.md`・`28_MoveDirectionRules.md`・`30_UnitSnapRules.md` :（更新）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄の全項目（各タスクでの追記を含む）を確認し、資料へ反映する。とくに3章の「キーボード操作」（`Esc`・`Backspace`/`Delete`の意味）、6.「履歴」（記録する操作と時点・取り消しの適用の流れ）、12.「端点への吸い付きと描き足し」（流れ・表示を消す箇所・やらないこと）、17.「スナップ」（打つ点・`Shift`との組み合わせ）、修飾キーの`Shift`の用途（3.・16.・17.と`_doc/arch/06_InputTracker.md`の修飾キーの項。`InputTracker.js`先頭の責務定義とあわせて3か所が揃っていること）を見直す。3章へ新しい節を足すか12.へまとめるかを決めて反映する。
        *   1章（フォルダ構造の`test/`・「存在しないもの」・フォルダ分割の方針・依存方向）・2章（`path`・新しく描く図形のスタイル）を更新する。4章の一覧の表に新しい行が増えない（新しいモジュールは無い）ことを確認する。
        *   `_doc/arch/`の各ファイルを更新予定欄のとおりに直す。`16_test.md`には新設1ファイルと既存4ファイルへの追加の検証範囲・既存のケースの期待値の書き換え（無し）・件数（タスク9で控えた結果）を書く。`06_InputTracker.md`・`02_main.md`の行数を更新する。
        *   記載基準に従う（1つのファイルのJSDocを読めば分かることは書かない。責務・境界・依存方向・流れと順序・誰が呼ぶか・設計判断の理由・やらないと決めたことを残す）。実コードと食い違う記述を作らない。
        *   **本タスクは開発資料の書き換えが明示的に許された唯一のタスク**であり、後続タスクは無い。ソースコード（`js/`・`test/`・`index.html`）は変更しない。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1（前半） 作成途中の線の点の並びの規則（`shapes/PathJoinRules`。`Path`はJSDocのみ）
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：先頭の責務定義を更新（タスク2の分を含む最終の文面）、`./Line.js`をimport、非公開の`LINE_POINT_COUNT`・`buildLineOrPath`、公開の`addDrawnPoint`・`removeLastDrawnPoint`・`buildFinishedDrawnLine`・`getLastDrawnPoint`・`isOnLastDrawnPoint`・`canCloseDrawnLine`を追加（すべてJSDoc付き）。`CLOSED_MIN_POINTS`のJSDocの「共有する」関数の列に`buildFinishedDrawnLine`・`canCloseDrawnLine`を追記。既存の関数の中身は変更なし。`extendWithPoints`等・`planDrawnLineJoin`はタスク2のため未着手。
    *   `js/shapes/Path.js`：クラスのJSDocと`updateDraftEnd`のJSDocのみ変更（コードは不変）。
    *   `test/shapes/PathJoinRules.test.js`：6関数の`describe`と、引数を書き換えず頂点を共有しないことの`describe`を追加（補助関数`makeDrawn`にJSDoc）。importに6関数を追加。
    *   `node --test`：tests 1560 / suites 238 / pass 1560 / fail 0（開始前1543から+17、既存ケースは不変）。

### タスク2: 要件1（後半） 描き足し・つながり・閉じるの計画の拡張（`shapes/PathJoinRules`の`planDrawnLineJoin`）
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：非公開の`extendWithPoints`・`planCloseWithPoints`・`planJoinWithPoints`を追加（JSDoc付き）。`planDrawnLineJoin`を要件1の1.〜4.のとおりに拡張しJSDocを更新（途中の点が無い2.・3.は今の`planCloseOf`・`planJoinAt`をそのまま呼ぶ。4.は`extendWithPoints`）。責務定義・import・タスク1の関数・既存関数の中身は不変。
    *   `test/shapes/PathJoinRules.test.js`：`planDrawnLineJoin`の拡張の`describe`（描き始めだけ・描き終えだけ・同じ線の両端・別の線の両端・重なる点を足さない・頂点2つの回帰・引数を書き換えず頂点を共有しない）と補助関数`planToPlain`（JSDoc付き）を末尾に追加。
    *   `node --test`：tests 1575 / suites 245 / pass 1575 / fail 0（タスク1後の1560から+15、既存ケースは不変）。

### タスク3: 要件2 始点への吸い付きと描き始めの端点の除外（`shapes/EndpointSnapRules`）
*   **作業内容** :
    *   `js/shapes/EndpointSnapRules.js`：先頭の責務定義を更新、`canCloseDrawnLine`をimport、`DRAWN_START_SNAP_KIND`・typedef`DrawnStartSnap`・`isDrawnStartSnap`・`findDrawnLineSnapTarget`を追加（JSDoc付き）。`findSnapTarget`の走査を非公開の`findNearestEndpoint(shapes, point, tolerance, isExcluded)`へ切り出して共有（`findSnapTarget`の名前・引数・結果・JSDocは不変。除外の条件は元と同じ）。
    *   `test/shapes/EndpointSnapRules.test.js`：importに3つ追加、補助関数`makeDrawn`（JSDoc付き）と`describe`4つを末尾に追加（種類の値・`isDrawnStartSnap`・描き始めの端点の除外・始点の条件・距離の境界・近い方／同距離なら端点・結果の形・引数を書き換えない）。既存のケースは不変。
    *   `node --test`：tests 1589 / suites 249 / pass 1589 / fail 0（タスク2後の1575から+14）。

### タスク4: 要件3 `Shift`で限定した向きを保つ丸め（`core/UnitSnapRules`）
*   **作業内容** :
    *   `js/core/UnitSnapRules.js`：`roundConstrainedPointFromOriginToUnit(origin, delta, step)`を末尾（`roundPointFromOriginToUnit`の後）に追加（JSDoc(e)付き。中で`roundConstrainedDeltaToUnit`を使い、`origin + 丸めた移動量`、`-0`は0へ。刻みが無効なら`origin + delta`）。責務定義・import・既存関数は不変。
    *   `test/core/UnitSnapRules.test.js`：importに1つ追加、`describe`を末尾に追加（横・縦・斜め45°・基準点が倍数／小数・刻みが無効・移動量0・`-0`なし・引数を書き換えない）。既存のケースは不変。
    *   `node --test`：tests 1597 / suites 250 / pass 1597 / fail 0（タスク3後の1589から+8）。
    *   開発資料への影響：2章の更新予定の記載のとおりで、追加は無い。

### タスク5: 要件4 作成途中の図形の置き換え（`core/VectorModel.replaceDraft`）
*   **作業内容** :
    *   （未実施）

### タスク6: 要件5 線を引く手順（`edit/EndpointSnapper`）
*   **作業内容** :
    *   （未実施）

### タスク7: 要件6 入力の配線（`core/InputTracker`）
*   **作業内容** :
    *   （未実施）

### タスク8: 要件7 ツールの切り替え・`Backspace`/`Delete`・取り消しの配線（`main.js`・`KeyboardShortcuts`のtypedef）
*   **作業内容** :
    *   （未実施）

### タスク9: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
*   **作業内容** :
    *   （未実施）

### タスク10: 要件9 テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （未実施）

### タスク11: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
*   **直線とパスの作り分けの置き場所**：`ShapeFactory`ではなく`shapes/PathJoinRules`に置いた（理由は2章「全体の流れ」）。これに伴い`PathJoinRules`の責務定義が「結合の規則」から「結合の規則と、続けて引く線の点の並びの規則」へ広がり、`./Line.js`のimportが増える（依存方向の(2)の記述を最終タスクで直す）。別ファイルへ分けなかった理由は、閉じたパスの頂点数の下限・結合できる線の判定・描き足しの組み立てを共有し、二重定義を避けるため。
*   **線を引いている途中かの判定**：`EndpointSnapper.isDrawingLine()`は「作成途中の図形が結合できる線（直線・開いたパス）か」で決める（図形種別の文字列を新たに比べる規則を足さないため）。直線のツールの作成途中の図形は常にこれに当たり、ほかのツールは当たらない。将来、ほかのツールの作成途中の図形が直線・開いたパスになる場合（曲線のパスのPhase等）は、この判定を見直すこと。
*   **見た目の変化（REQで決まっている点）**：既存の線の端点から引き始めたとき、その端点（自分の始点）にカーソルを戻しても青い正方形が出なくなる（今は出る）。同じ線のもう一方の端点には、頂点の数によらず吸い付く（今と同じ）。
*   **クリックの判定の順**：始点への吸い付き（閉じる）→ 最後の点と重なる（開いたまま終える）→ 端点への吸い付き（つながる）→ 点を打つ、の順にした。たとえば`Ctrl`で吸い付きを止めて既存の線の端点の上に点を打った直後、`Ctrl`を離してマウスを少し動かし（端点へ吸い付く）、その点の上でクリックすると、端点に吸い付いていても「最後の点と重なる」が先に当たり、つながらずに開いたまま終わる（まれな操作。目視で違和感があれば順を見直す）。
*   **ダブルクリックの2回目**：開いたまま終える（点を打つ → 同じ位置で終える）はダブルクリックで終わる。一方、始点で閉じる・別の線とつながるの1回目で終わった後のダブルクリックの2回目は、図形作成モードの`IDLE`のクリックとして新しい線の描き始めになる（今の直線の描き終えのダブルクリックと同じ動き。変えていない）。
*   **最後の点を消した直後**：`Backspace`/`Delete`・取り消しで点を消した直後は、付いてくる線の先は消す前の位置のまま、吸い付きの照会結果と表示を消す（`#drawEndSnap`を`null`）。マウスを動かさずにクリックすると、その位置に点が打たれる（吸い付かない）。次の`mousemove`で照会し直す。キーのイベントはカーソル位置を持たないため、この形にした。
*   **パン中のツールの切り替え**：線を引いている途中は中ボタンのパンを`DRAWING`のまま行え、ツールパレットのボタンの経路はドラッグ中かを見ない。そのため`finishLineDrawing()`はドラッグ中かを見ずに終える（ドラッグ中で`false`を返すと、続く`setMode`の`#abortOngoingOperation`が線を捨て、REQの「ツールを切り替えたら描いた分を残す」に反するため）。パンは記録先・図形・選択集合に触れないため、パン中に終える処理（`beginEdit`/`commitEdit`を含む）が走っても記録は1件で問題ない（要件6で実コードを確かめた）。パンのドラッグは、続く`setMode`が中断する。図形作成モードのまま別の図形のツールのボタンを押した場合は`setMode`を通らないため、パンはボタンを離すまで続く（今の、作成途中にパンしながら図形のツールを選んだときと同じ）。
*   **`Ctrl`+`Z`の押しっぱなし**：キーリピートの設定は今のまま（繰り返す）ため、線を引いている途中に`Ctrl`+`Z`を押し続けると、点が1つずつ消え、始点だけになって引くのをやめた後は、続くリピートで今までどおり履歴の取り消しが進む（今の「作成途中の`Ctrl`+`Z`で捨てた後のリピートは履歴を取り消す」と同じ）。
*   **表示倍率を変えたあとの重なりの判定**：「最後の点と重なる」は、クリックした時点の表示倍率で画面上5pxを換算する。打った点の間隔が狭いまま縮小すると、点を打つつもりのクリックが「最後の点と重なる」になり終わることがある（今の結合の「重なる」と同じ性質）。また、描き足しの途中の点が端点と重なる場合はその点を足さない（`extendWithPoints`。点が1つの今の描き足しの「重なれば何も起きない」と同じ規則を1点ずつ当てたもの）。
*   **既存のテストの期待値**：変える既存のケースは無い見込み（`planDrawnLineJoin`・`commitDrawnLine`・`findSnapTarget`は頂点2つの線・今の引数で結果が変わらない作り）。変える必要が出た場合はタスクの作業を止めて報告する。
*   **REQに挙がっていないファイル**：変更は不要の見込み（`CanvasManager`は作成途中の図形をポリモーフィックに描くため、`Path`の作成途中の図形もそのまま描かれる）。必要が出た場合は実装を止めて発注者の判断を仰ぐ。
*   **（タスク1の記録）`removeLastDrawnPoint`・`getLastDrawnPoint`・`isOnLastDrawnPoint`の頂点数の下限**：頂点が2つ未満の入力（作成途中の線の約束外）は`null`／`false`にした。`PathJoinRules`の責務定義の文面と`Line`のimportは、タスク2の分を含む最終の形に更新済み（タスク2で責務定義・importを変えない）。開発資料への影響は最終タスク（依存方向(2)の記述）で扱う予定のとおりで、追加の更新予定は無い。
