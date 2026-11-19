# RES: 作業計画・作業レポート (Phase 09-02b) : 区間の直線⇔曲線の切り替え（オプションバーの「直線に」「曲線に」）
* 参照元REQ: `./_log/req/261119_1753_REQ_Phase09-02b_Segment_Kind_Switch.md`

## 1. 作業目的
Phase 09-01a・09-01b・09-02aで、パスに曲線の区間（`'smooth'`）と角の点（`corners`。オプションバーの右端の「角」のチェックボックス）が入った。今は、引いた後に区間の種類（直線・曲線）を変える方法がない。

本作業（Phase 09-02の後半（b））では、**引いた後に、パスの区間や単独の直線・今の曲線を、直線と曲線の間で切り替えられるようにする**。操作は、頂点の選択（`A`）で区間の両端の点を選び、オプションバーの「角」のまとまりに足す「直線に」「曲線に」のボタンで行う。

最上位の要件（REQのとおり。満たさない変更は失敗）：
* `node --test`が全件通る（作業開始前は tests 1860 / suites 294）。**既存のテストの期待値は変えない**（本計画では書き換える既存のケースは無い見込み。出た場合はタスクの詳細作業内容にケースと理由を列挙する）。
* 切り替えを使わない限り、今の作業データ・描画・当たり判定・書き出しの結果を変えない。
* 作業データ形式の版は2、書き出し形式の版は3のまま。図形データの形（キー）も増やさない（`segments`と`corners`で表す）。
* 直線の区間と曲線の区間のつなぎ目は、今までどおり常に角が立つ（なめらかにする方法は作らない）。
* 改名・整形・「不要に見えるコードの削除」をしない。既存の公開関数名・メソッド名・フィールド名・DOMのid・クラス名を変えない（意味が広がる関数・クラスは名前を変えずJSDocを実態に合わせる）。`KeyboardShortcuts.js`の対応表を変えない。共通メソッド契約（18メソッド）を増やさない。

用語はREQのとおり（**曲線の区間・直線の区間・曲線の連なり・今の曲線**は`PROJECT_ARCHITECTURE.md`2章`path`、**角の点・なめらかな点・角を操作できる点**は3章23.、**切り替える区間**＝両端の点がどちらも頂点の選択で選ばれている区間（パスの区間＝閉じたパスの終点→始点の区間を含む、単独の直線の始点と終点、今の曲線の始点と終点）、**足した点**＝「曲線に」でまっすぐな区間の中点に足す点）。本計画では加えて、「直線に」「曲線に」の2つの操作をまとめて**区間の切り替え**と呼ぶ。

## 2. アーキテクチャ設計

### 全体の方針
* **3層（重なり順（14.）・整列・分布（21.）・角（23.）と同じ）**：
  * 規則＝`shapes/`の新しい規則`PathSegmentKindRules`（第3の種類。切り替える区間の判定・押せるかの判定・切り替えた新しい図形の組み立て・元の点の番号から新しい点の番号への対応）。
  * 編集操作＝既存の`edit/PathCornerEditor`に足す（対象の点の集め方`#collectTargets`を共有するため。要件C）。
  * DOM＝既存の`palette/OptionBarCornerGroup`に足す（オプションバーの分け方「まとまりごとにUI部品1つ・配線ブロック1つ」を守るため。要件D）。
  * 配線＝`main.js`の既存の`// 7.12.`に足す（生成・注入・同期とドラッグ中の受理判定だけ）。
* **既存のクラスに足す理由（名前は変えず、責務定義とJSDocを実態に合わせる）**：ボタンは発注者の決定で「角」のまとまり（`#option-corner-group`）の中に置く。オプションバーは「まとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つ」（3章13.）のため、まとまりの一部だけを別のUI部品にすると、1つのルート要素を2つの部品が分け合うことになり分け方が崩れる。そこで`OptionBarCornerGroup`の責務を「角のまとまりの部品（チェックボックスと区間の切り替えの2つのボタン）」へ広げる。手順側も、角の切り替えと区間の切り替えは「頂点の選択で選んでいる点を対象にした、パスの点・区間の編集の1件の編集操作」で、対象の集め方（`resolveNudgeTarget`が`'vertices'`のときだけ、図形と頂点の番号の組を集める）がまったく同じため、`PathCornerEditor`に足して`#collectTargets`を1か所のまま共有する（別のクラスにすると集め方を二重に書くか、集め方だけの新しいモジュールと`edit/`内の新しい種類のimportが要る）。規則は責務が別（角の状態の判定ではなく区間の種類の切り替え）のため、`PathCornerRules`には足さず新しいファイルにする。
* **変えないもの**：`core/`のコード（`VectorModel`・`InputTracker`・`CanvasManager`・`KeyboardShortcuts`・`HistoryManager`・`NudgeTargetRules`・`FocusKeyYieldRules`・`ShapeFactory`ほか）、`io/`のコード、`check/`、`wiring/`、`asset/`、図形クラス（`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）、`ShapeGeometry`、`PathCornerRules`、`EndpointSnapRules`、`edit/`の`PathCornerEditor`以外のファイル、`palette/`の`OptionBarCornerGroup`以外のファイル、`sprite-check.html`。`PathJoinRules`は`segmentKindsOf`に`export`を付けてJSDocを直すだけ（要件A）。
* **同期**：再描画・オプションバーの同期は既存の`model.onChange`の経路だけ。既存の`syncOptionBarCornerGroup`（`model.onChange`へ登録済み・起動時にも1回呼ぶ）の中でボタンの表示も当てるため、登録・経路は増やさない。
* **依存方向の追加（どれも下向きで循環しない）**：(1)`edit/PathCornerEditor → shapes/PathSegmentKindRules`（`edit/ → shapes/`の例外の列に1つ足す。`PathCornerEditor`は既に例外の1つ）。(2)`shapes/`内に`PathSegmentKindRules → Path`・`Line`・`PathJoinRules`（`segmentKindsOf`）・`PathCornerRules`（`resolveCornerState`・`CornerState`）。`PathJoinRules`のimportは`Line`・`Path`だけ、`PathCornerRules`のimportは`Path`だけ、`Line`・`Path`のimportは`ShapeGeometry`・`ShapeDataValidation`だけのため循環しない。`PathSegmentKindRules`を`import`するのは`edit/PathCornerEditor`だけ。
* **規則の唯一の箇所（二重定義をしない）**：形の決め方の式＝`ShapeGeometry.computeSmoothSegmentControls`（写さない。新しいパスを`Path`のコンストラクタで作れば`#segmentControls`が使う）。角の状態の判定＝`PathCornerRules.resolveCornerState`（写さない。要件Bの角の情報の決め方で使う）。`corners`の読み方＝`Path.readCornerFlags`。「`type`が`'line'`の図形は直線の区間1つ」＝`PathJoinRules.segmentKindsOf`（要件Aで`export`して使う）。切り替える区間の決め方・押せるかの決め方・頂点と区間の種類と角の情報の並べ方・点の番号の対応＝`PathSegmentKindRules`の非公開の関数1つずつ。対象の点の集め方＝`PathCornerEditor.#collectTargets`。区間の種類・角の情報は`Path`だけが持ち、ボタンの押せる・押せないはそのつど図形と点の選択から求める（状態を二重に持たない）。

### 要件A: 「直線は直線の区間1つ」を共有する（`js/shapes/PathJoinRules.js`。既存へ変更・最小）
* 非公開の`segmentKindsOf(data)`に`export`を付ける（中身は変えない）。`PathSegmentKindRules`が、単独の直線とパスを同じ「区間を持つ線」として扱うために使う（「`type`が`'line'`の図形は直線の区間1つ」という規則の唯一の定義箇所を守るため。`PathSegmentKindRules`で`type === 'line'`を直線の区間1つとして書き直さない）。
* JSDocを実態に合わせる：「（非公開）」を外し、「開いた線（結合できる線・作成途中の線）の値だけを渡す」を「直線とパス（開いた線・閉じたパス）の`toJSON()`の値を渡す。使う側は`PathJoinRules`の中と`PathSegmentKindRules`（区間の切り替え）」に直す（閉じたパスの`segments`をそのまま写すだけで、中身は閉じたパスでも正しい）。`@param`の説明も同じく直す。
* ファイル先頭の責務定義は変えない（公開になる関数1つで、結合の規則の一部の定義を共有するだけ）。ほかの関数は変えない。
* テスト：`test/shapes/PathJoinRules.test.js`に`describe('segmentKindsOf（Phase 09-02b で公開）')`を足す（直線の値＝`['line']`、開いたパス・閉じたパス＝`segments`の各`kind`の新しい配列、引数を書き換えない）。

### 要件B: 区間の切り替えの規則（`js/shapes/PathSegmentKindRules.js`。新規）
* **責務（ファイル先頭。3行以内）**：頂点の選択で選んだ点から、区間の直線⇔曲線の切り替えで切り替える区間と押せるかを決め、切り替えた新しい図形（パス・直線）と元の点の番号から新しい点の番号への対応を組み立てる規則を、状態を持たない関数と定数として提供する。
* **種類**：図形クラスではなく、`PathJoinRules`・`EndpointSnapRules`・`PathCornerRules`と同じ「図形をまたぐ規則」（第3の種類）。`shapes/`の外（`edit/PathCornerEditor`だけ）から使う。
* **importと読むもの**：`./Path.js`（`Path`・`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`・`readCornerFlags`）、`./Line.js`（`Line`）、`./PathJoinRules.js`（`segmentKindsOf`）、`./PathCornerRules.js`（`resolveCornerState`・`CornerState`）のみ。図形の`type`・公開プロパティ`id`・`toJSON()`だけを読み、図形クラスの内部プロパティを読み書きしない（`PathJoinRules`・`PathCornerRules`と同じ約束）。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式・ハンドル名を知らない。`try/catch`を持たない。引数を書き換えない。結果は引数と配列・頂点を共有しない（新しい図形は`Path`・`Line`のコンストラクタで作る＝頂点を複製する）。
* **公開**：
  * `SegmentKindSwitch`（`Object.freeze`。操作の値の唯一の定義）：`TO_LINE: 'toLine'`（直線に）・`TO_CURVE: 'toCurve'`（曲線に）。
  * typedef `SegmentSwitchTarget`：`{ shape, vertexIndex }`（選んだ点。`PathCornerRules`の`CornerTarget`と同じ形。どちらも`PathCornerEditor.#collectTargets`の結果を受ける。JSDocに互いの存在を書く）。
  * typedef `SegmentSwitchAvailability`：`{ toLine: boolean, toCurve: boolean }`（ボタンの押せる・押せない。`palette/OptionBarCornerGroup.js`に同じ内容の二重定義を置く。互いに存在を書く）。
  * typedef `SegmentSwitchPlanItem`：`{ targetId, shape, vertexIndexMap }`（`targetId`＝元の図形の`id`、`shape`＝切り替えた新しい図形（`Path`または`Line`。idは`null`）、`vertexIndexMap`＝元の頂点の番号`i`から新しい頂点の番号への対応の配列（要素数＝元の頂点の数。対応先が無い点は`null`））。
  * `resolveSegmentSwitchAvailability(targets)` → `SegmentSwitchAvailability`。押せるかの決め方の唯一の入口（下の「変わる区間」が1つ以上ある図形が1つでもあるか）。
  * `planSegmentKindSwitch(targets, operation)` → `SegmentSwitchPlanItem[]`。押したときの結果の唯一の入口。`operation`が`SegmentKindSwitch`の値でなければ、`targets`が空でも計算の前に`Error`（`ShapeAlignRules`と同じ扱い）。
* **非公開の関数（規則は各1か所）**：
  * **図形のデータの読み方**（`dataOf(cache, shape)`）：`shape.type`が`'path'`・`'line'`・`'curve'`のときだけ`toJSON()`を1回の呼び出しの中で図形ごとに1回だけ呼んで使い回す（`PathCornerRules`の`dataOf`と同じ形の別の小さな補助。それ以外の図形は`null`＝対象外で`toJSON()`を呼ばない）。
  * **切り替える区間の決め方**（`collectSwitchEntries(targets, cache)`。唯一の箇所）：`targets`を図形のインスタンスごとにまとめ（最初に現れた順。同じ点が2回あっても結果は同じ）、番号は`0`以上・頂点の数未満の整数だけを選んだ点として集める。図形ごとの結果は`{ shape, data, segmentIndexes }`（切り替える区間の番号の昇順）。
    * パス・単独の直線（`type`が`'path'`か`'line'`）：「区間を持つ線」として扱う。区間の種類の並び`kinds = segmentKindsOf(data)`（直線は`['line']`）、頂点の数`n = data.points.length`、閉じているか`closed = data.closed === true`。区間`i`（`0 ≤ i < kinds.length`）の両端は`i`と`(i + 1) % n`で、両方が選ばれていれば切り替える区間（閉じたパスの終点→始点の区間＝`i = n − 1`を含む。開いたパスは`i + 1 < n`のため折り返さない＝開いたパスの始点と終点を選んでも区間にならない）。
    * 今の曲線（`type`が`'curve'`）：始点（番号0）と終点（番号2）がどちらも選ばれていれば、始点→終点の1つを切り替える区間とする（`segmentIndexes = [0]`。制御点（番号1）を選んでいるかは問わない）。今の曲線の頂点の並び（`points[0]`＝始点・`[1]`＝制御点・`[2]`＝終点）は`toJSON()`の`points`の約束（2章「`points`の並びは各図形クラスの頂点の並びと同じ」）から読む。
    * 矩形・円・弧ほか：対象外（結果に入れない）。
  * **変わる区間の決め方**（`changedSegmentIndexes(entry, operation)`。唯一の箇所。押せるかと押したときの結果が共有する）：区間を持つ線は、「曲線に」なら切り替える区間のうち`kinds[i] === SEGMENT_KIND_LINE`のもの、「直線に」なら`kinds[i] === SEGMENT_KIND_SMOOTH`のもの。今の曲線は、「直線に」なら`segmentIndexes`そのまま、「曲線に」なら空（今の曲線の「曲線に」は何もしない。Phase 09-03）。単独の直線の「直線に」は`kinds`が`['line']`のため自然に空になる。
  * **押せるかの決め方**：`resolveSegmentSwitchAvailability`は`collectSwitchEntries`の結果について、`toLine`＝「直線に」で`changedSegmentIndexes`が空でない図形が1つ以上、`toCurve`＝「曲線に」で同じ。0件・頂点の選択以外（呼び出し側が空配列を渡す）なら両方`false`。
  * **「曲線に」の組み立て**（`buildCurvedPath(data, changedIndexes)`。区間を持つ線（パス・単独の直線）が対象。頂点・区間の種類・角の情報を一緒に並べる唯一の箇所）：
    1. `points = data.points`・`kinds = segmentKindsOf(data)`・`corners = readCornerFlags(data)`・`n`・`closed`を読む。
    2. 元の頂点`i = 0 … n − 1`の順に、`vertexIndexMap[i] = 新しい頂点の数`として頂点`i`（新しい`{ x, y }`）と`corners[i]`を並べ、区間`i`があれば（`i < kinds.length`）続けて区間を並べる：変わる区間なら「`'smooth'` → 足した点（区間の両端`points[i]`・`points[(i + 1) % n]`の中点`{ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }`。角の情報は`false`＝なめらかな点）→ `'smooth'`」、そうでなければ`kinds[i]`のまま。
       * これで足した点は区間の始点の直後に入る。**閉じたパスの終点→始点の区間（`i = n − 1`）に足した点は末尾（新しい番号`n + 足した点の数 − 1`）に置かれる**（始点は番号0のまま。元の点の番号は、それより前に足した点の数だけ後ろへずれる）。
       * 要素数：区間の種類は「元の区間の数＋足した点の数」、頂点・角の情報は「元の頂点の数＋足した点の数」で、開いたパス（区間＝頂点−1）・閉じたパス（区間＝頂点）の`Path`の不変条件がそのまま保たれる。
    3. **両端の点の角の情報**（REQの発注者の決定 2026-11-19）：いったん上の並び（角の情報は元の値＋足した点は`false`）で仮のパス`new Path(...)`を作り、変わる区間の両端の点（新しい番号`vertexIndexMap[i]`と`vertexIndexMap[(i + 1) % n]`）それぞれについて`resolveCornerState(仮のパス, 新しい番号)`が`CornerState.CORNER`か`CornerState.SMOOTH`（＝切り替えの後に角を操作できる点）なら角の情報を`true`（角の点）にする。それ以外（片側がまだ直線の区間の点＝`LINE_CORNER`、開いたパスの端の点・単独の直線の端の点＝`NONE`）は**元の値のまま変えない**（形に効かない値。下の「角の情報の値の決定」）。足した点は常に`false`（なめらかな点）。角の状態の判定を写さず`resolveCornerState`をそのまま使う。
    4. 結果は`new Path(新しい頂点, closed, data.strokeColor, data.strokeWidth, data.fillColor, 新しい区間の種類の配列, 新しい角の情報)`（idは`null`）と`vertexIndexMap`。単独の直線は`closed`が偽・区間1つ（`['line']`）の線として同じ手順を通り、**点を3つ持つ開いたパス**（区間はどちらも`'smooth'`、角の情報はすべて`false`＝`toJSON()`に`corners`は出ない）、`vertexIndexMap = [0, 2]`になる。閉じたパスは閉じたまま・`fillColor`はそのまま（塗りが残る）。
  * **「直線に」の組み立て（パス）**（`buildStraightenedPath(data, changedIndexes)`）：頂点・閉じているか・スタイル・角の情報（`readCornerFlags(data)`）は元のまま、区間の種類だけ変わる区間を`'line'`にした`new Path(...)`。点は足さない・消さない。`vertexIndexMap`は恒等（`[0, 1, …, n − 1]`）。角の情報を変えない理由：両端の点は片側が直線の区間になり角を操作できない点になる（形に効かない）ため。
  * **「直線に」の組み立て（今の曲線）**（`buildLineFromCurve(data)`）：`new Line(points[0].x, points[0].y, points[2].x, points[2].y, data.strokeColor, data.strokeWidth, data.fillColor)`（制御点は捨てる）。`vertexIndexMap = [0, null, 1]`（制御点は対応先が無い）。
  * **計画**：`planSegmentKindSwitch`は`collectSwitchEntries`の各図形（最初に現れた順）について`changedSegmentIndexes`が空でないものだけ、上の組み立てで`{ targetId: shape.id, shape: 新しい図形, vertexIndexMap }`を作る。変わる区間が1つも無ければ空配列（既に曲線の区間の「曲線に」・既に直線の区間の「直線に」・単独の直線の「直線に」・今の曲線の「曲線に」はその区間・図形を変えない。点も足さない・両端の角の情報も変えない）。
* **角の情報の値の決定（REQで計画に任された点）**：切り替えの後も角を操作できる点にならない両端の点（片側がまだ直線の区間の点・開いたパスの端の点）の角の情報は**元の値のまま変えない**。理由：(1) 形に効かない値で、どちらにしても形は同じ。(2) 単独の直線の「曲線に」・開いたパスの端の区間の「曲線に」で端の点を`true`にすると、角の点（角を操作できる点）が1つも無いのに`corners`のキーが出るパスができ、「角の点が1つもないパスは`corners`のキーを出さない」約束の意味（角の点＝両側とも曲線の区間の点）とずれる。(3) 後でもう一方の区間を「曲線に」すれば、その点は「曲線に」した区間の両端の点として、そのときに角の点になる（同じ決め方）。結合・描き足しは`PathJoinRules.chainOf`が開いた線の端の点を偽にするため、元の値が残っても持ち込まれない。
* **押した直後の形が変わらないこと（式の性質。テストで確かめる）**：直線の区間`A→B`の中点`M`に点を足して`A→M`・`M→B`を曲線の区間にする。`A`は角の点（または直線の区間との境目・開いたパスの端）のため区間`A→M`の`Q0 = 2A − M`、`M`はなめらかな点で次の区間`M→B`が曲線のため`Q3 = B`。`control1 = A + (M − Q0)/6 = A + (M − A)/3`、`control2 = M − (B − A)/6 = M − (M − A)/3`（`B − A = 2(M − A)`のため）。区間`M→B`も同様に`M + (B − M)/3`・`B − (B − M)/3`。どちらの区間も制御点が区間の1/3・2/3の位置に乗り、直線と同じ形になる。**隣の区間も変わらない**：`A`の反対側が曲線の区間`P→A`なら、元は次の区間が直線のため`Q3 = 2A − P`、切り替えの後は`A`が角の点のため`Q3 = 2A − P`で同じ（だから`A`を角の点にする必要がある）。`A`の反対側が直線の区間なら制御点を持たない。3つ以上続けて選んで途中の点の両側が切り替える区間になる場合も、途中の点は両側とも曲線の区間になり角の点になるため同じ。
* **既に曲線の区間と隣り合う場合**：直線の区間`A→B`と曲線の区間`B→C`の`A`・`B`・`C`を選んで「曲線に」すると、`A→B`だけが変わり、`B`は両側とも曲線の区間になるため角の点になる。`B→C`の`Q0`は元（前の区間が直線）も後（`B`が角の点）も`2B − C`で同じ（形は変わらない）。

### 要件C: 区間の切り替えの1件の編集操作（`js/edit/PathCornerEditor.js`。既存へ追加）
* **責務（ファイル先頭。3行以内に書き直す）**：頂点の選択で選んでいる点を対象に、角・なめらかの切り替えと区間の直線⇔曲線の切り替えを規則（`shapes/PathCornerRules`・`shapes/PathSegmentKindRules`）で行う1件の編集操作と、オプションバーの「角」のまとまりの表示内容の照会を担う。DOM・操作モードの解釈・図形種別の判定・ハンドル名の形式を持たない。
* **import**：既存の2つに`../shapes/PathSegmentKindRules.js`の`SegmentKindSwitch`・`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`を足す。
* **注入**：コンストラクタ`{ model, editRecorder, getMode }`は変えない。`model`の使うメソッドに`setSelectedVertices`を足す（`getSelectedIds`・`getSelectedVertices`・`getShapes`・`replaceShape`・`setSelectedVertices`）。`editRecorder`は`beginEdit`・`commitEdit`だけ（変えない）。
* **既存の`getView`・`toggle`・`#collectTargets`は変えない**（対象の集め方を共有するだけ。コードは触らない）。
* **公開メソッドを3つ足す**：
  * `getSegmentSwitchAvailability()` → `{ toLine, toCurve }`：`resolveSegmentSwitchAvailability(this.#collectTargets())`を返す（純粋な照会。モデル・履歴を変えない）。
  * `switchSegmentsToLine()` → `boolean`：`#switchSegments(SegmentKindSwitch.TO_LINE)`。
  * `switchSegmentsToCurve()` → `boolean`：`#switchSegments(SegmentKindSwitch.TO_CURVE)`。
* **非公開`#switchSegments(operation)`**（手順）：
  1. `plan = planSegmentKindSwitch(this.#collectTargets(), operation)`。空なら記録先・モデルに一切触れず`false`（結果が変わらない操作は記録しない・頂点の選択以外のモードでは何もしない）。
  2. 置き換える前に、`nextVertices = #remapSelectedVertices(model.getSelectedVertices(), model.getShapes(), plan)`を求める。
  3. `beginEdit()` → 計画の各要素について`model.replaceShape(targetId, shape, { keepId: true, select: false })` → `model.setSelectedVertices(nextVertices)` → `commitEdit()`（**鍵なし**）→ `true`。
* **非公開`#remapSelectedVertices(selectedVertices, shapes, plan)`**（選んでいた点の付け替え。ハンドル名の形式・図形種別を解釈しない）：頂点の選択の各組`{ shapeId, handle }`を元の順に見て、
  * `targetId === shapeId`の計画が無い組はそのまま残す。
  * ある組は、元の図形（`shapes`から`id`で引く）の`getVertexIndexForHandle(handle)`で元の番号を得て（`null`なら落とす）、`vertexIndexMap[元の番号]`で新しい番号を得て（`null`・`undefined`なら落とす＝今の曲線の制御点）、新しい図形の`getVertexHandleNames()`の中から`getVertexIndexForHandle(name) === 新しい番号`となる名前を探して（無ければ落とす）`{ shapeId, handle: その名前 }`にする。
  * 共通メソッドの`getVertexHandleNames`・`getVertexIndexForHandle`と規則が返す番号の対応だけを使い、`'vertex-<i>'`・`'start'`等の形式を書かない（REQの約束）。足した点は元の点の対応先にならないため選ばれない。
* **選択・id・重なり順・スタイル**：`keepId: true`で同じidのまま同じ位置に置き換わり、`select: false`は選択集合を作り直さず現存しないidだけを外す（外れるidは無い）。図形の選択・id・重なり順は変わらない。スタイルは規則が元のまま作る。選んでいた点の位置は、規則が頂点を元の座標のまま並べる（足した点だけが増える・今の曲線の制御点だけが無くなる）ため変わらない。
* **通知の回数と順（REQの確認事項）**：変わる図形が`k`個なら、`replaceShape`の通知が`k`回 → 頂点の選択の内容が変わったときだけ`setSelectedVertices`の通知が1回（「直線に」でパスの区間だけを切り替えた場合はハンドル名が変わらず内容が同じため通知なし）。取り消しは`beginEdit`／`commitEdit`の1組で1件（6.）。
  * **途中の通知での頂点の選択の食い違い**：`replaceShape`の通知の時点では、頂点の選択に元の図形のハンドル名が残る（パスになった図形に`'start'`、点を足したパスで番号がずれた`'vertex-<i>'`、直線になった図形に`'control'`）。この間の同期を実コードで確かめた結果、例外・残る誤表示は無い：
    * 頂点のハンドルの描画（`main.js`の`renderCurrentState` → `core/VertexHandleRules.collectVertexHandles`）：図形の`getVertexHandleNames()`の名前ごとに位置を求め、選ばれているかを名前の一致で決めるだけのため、合わない名前は単に一致しない（番号がずれた名前は一時的に別の点が選ばれた色になる）。
    * 位置の欄（`PositionInputEditor` → `computeVertexHandlesBounds`）：`getHandlePosition`が`null`の組は飛ばす。`Path.getHandlePosition('start')`・`Line.getHandlePosition('control')`は例外を投げず`null`（`_doc/arch/12_shapes.md`の契約）。
    * 「角」のチェックボックスと新しいボタン（`PathCornerEditor.getView`・`getSegmentSwitchAvailability` → `#collectTargets`）：`getVertexIndexForHandle`が`null`の組は飛ばす（`Path`は形式に合わない名前で`null`、`Line`は`{ start, end }`にない名前で`null`）。
    * 削除・結合・重なり順・整列・スタイル・ステータスバーの大きさの同期は図形の選択だけを見る（頂点の選択を見ない）。
    * 最後の`setSelectedVertices`の通知で正しい内容に描き直される。どの通知も同じ同期の処理の中（ブラウザが画面を描く前）で続けて出るため、一時的な表示は画面に出ない。
  * `VectorModel`に「置き換えと頂点の選択の付け替えを1回で行う」メソッドは足さない（`core/`を変えないため。通知が`k + 1`回になり得ることは資料の注意に残す）。
* **取り消し・やり直し**：今までの頂点の移動・角の切り替えの取り消しと同じく、図形の選択は戻り、頂点の選択は外れる（`replaceAllShapes`の既存のふるまい。変えない）。
* **前提（呼び出し側の責務）**：ドラッグ中でないこと（`main.js`の`performSegmentKindSwitch`が判定する）。進行中の入力操作の中断・モード切り替え・再描画・UI同期を自分で行わない。`try/catch`を持たない。
* **クラスJSDoc**：依存の制約（importは2モジュール＋1モジュール、`model`の使うメソッドの一覧に`setSelectedVertices`、操作モードを解釈しない、図形種別の分岐・ハンドル名の形式を持たない）と、区間の切り替えの手順・通知の回数・選択の付け替えを書き足す。

### 要件D: ボタンのUI部品（`js/palette/OptionBarCornerGroup.js`。既存へ追加）と`index.html`
* **責務（ファイル先頭。3行以内に書き直す）**：ツールバーのオプションバーの「角」のまとまり（`#option-corner-group`）の、区間の「直線に」「曲線に」のボタンの押せる・押せないと「角」のチェックボックスの表示（チェックあり・なし・「−」・押せない）、および操作のコールバックへの通知を担う。角・区間の判定・選択状態には関与しない。DOM操作専任。
* importなし。持つ状態は最後に表示したチェックボックスの内容（`#lastView`）と解決した要素だけ（判定は持たない）。
* **コンストラクタ**`(groupElement, actions)`：
  * `actions.onCornerToggle`・`actions.onSegmentToLine`・`actions.onSegmentToCurve`のどれかが関数でなければ`Error`（既存の`onCornerToggle`の文言はそのまま、2つを同じ形の文言で足す）。
  * `#option-corner-toggle`・`#option-segment-to-line`・`#option-segment-to-curve`をルート要素内の`querySelector`で解決し、**1つでも欠ければ**`console.warn`して何も配線しない（以後の`render`・`renderSegmentSwitch`は何もしない。`OptionBarOrderGroup`・`OptionBarAlignGroup`と同じ作り）。既存の警告の文言はそのまま使う。`index.html`に3つとも置くため、チェックボックスのふるまいは今と変わらない。
  * チェックボックスの`change`の購読（呼ぶ→当て直す→`blur`）は変えない。2つのボタンの`click`で`onSegmentToLine()`・`onSegmentToCurve()`を呼ぶ（戻り値は使わない。押せない判定を持たない＝`disabled`のボタンは`click`が来ない）。
* **既存の`render(view)`は変えない**（チェックボックスだけを当てる。typedef`CornerToggleView`も変えない）。
* **公開メソッドを1つ足す**：`renderSegmentSwitch(availability)`：配線されていなければ何もしない。`toLine`ボタンの`disabled = !(availability && availability.toLine === true)`、`toCurve`ボタンも同じ（`availability`が無ければ両方押せない）。
* **ボタンは`blur`しない**（既存のオプションバーのボタン（重なり順・整列）と同じ）：`core/FocusKeyYieldRules`は`aria-pressed`を持たない`button`を`Space`を譲る要素にもテキスト入力にもしないため、クリックの後にフォーカスが残っても、`Space`はパン（`InputTracker`が`keydown`・`keyup`で`preventDefault`するためボタンは押されない）、`Ctrl`なしのショートカット（矢印の微調整・`A`・`V`等）は今どおり働く。`Enter`ではフォーカスの残るボタンがもう一度押される（押せるときだけ。今の重なり順・整列のボタンと同じで許容）。ボタンには`aria-pressed`を付けない（付けると`Space`がパンにならなくなる）。`FocusKeyYieldRules`・`KeyboardShortcuts`のコードは変えない。
* typedef：`SegmentSwitchAvailability`（`{ toLine, toCurve }`。`shapes/PathSegmentKindRules.js`と同じ内容の二重定義。互いに存在を書く）を足し、`OptionBarCornerGroupActions`に`onSegmentToLine: () => boolean`・`onSegmentToCurve: () => boolean`を足す。クラスJSDocの「まとまりの構成」に2つのボタンを足す。
* **`index.html`**（`#option-corner-group`の中、`<label class="option-corner-label" …>`の前に、左から「直線に」「曲線に」の順）：
  ```html
  <button type="button" id="option-segment-to-line" class="tool-btn icon-btn" title="直線に（頂点の選択で両端の点を選んだ区間を直線にする）" disabled>╱</button>
  <button type="button" id="option-segment-to-curve" class="tool-btn icon-btn" title="曲線に（頂点の選択で両端の点を選んだ直線の区間の中点に点を足し、曲線にする）" disabled>∿</button>
  ```
  * アイコン（記号`╱`・`∿`）は仮で、各ボタンの中身の1か所だけ（JSは記号を持たない）。`title`にキーは書かない（キーは割り当てない）。初期`disabled`（起動時に`main.js`の`syncOptionBarCornerGroup`が同期する）。常に置く（頂点の選択の間だけ現れる作りにしない）。
  * CSSの宣言は足さない（既存の`.tool-btn`・`.icon-btn`・`.toolbar-group`を使う）。既存の要素・ルール・id`#option-corner-group`・`#option-corner-toggle`は変えない。
  * **1280pxの幅の見積もり**：今は約1189px（CSSコメント「ツールバー全体の幅の見積もり」）。角のまとまりの中にボタン2つ（32px×2）と、まとまりの中の間隔（`.toolbar-group`の`gap: 4px`）2つ分（4px×2）を足して約72px増え、**約1261px**（1280px以内）。コメントの角のまとまりの項を「角約106px（ボタン32×2＋間隔4×2＋チェックの欄約13px＋既定の余白約7px＋間隔2px＋文字「角」約12px）」、合計を約1261pxに直す。

### 要件E: `main.js`の配線（`js/main.js`。既存の`// 7.12.`へ追加）
* importは増やさない（`PathCornerEditor`・`OptionBarCornerGroup`はimport済み）。
* `// 7.12.`の中で次を足す・直す（ほかのブロックは変えない）：
  * `function performSegmentKindSwitch(applySwitch)`：`inputTracker.isDragging()`なら`false`、それ以外は`applySwitch()`の戻り値を返すだけ（`performCornerToggle`と同じ形。JSDocにドラッグ中は受理しない理由＝ドラッグが開いている編集操作と`beginEdit`／`commitEdit`の対を崩さないため、`applySwitch`は`pathCornerEditor`の切り替えのメソッドを呼ぶ関数であること）。
  * `OptionBarCornerGroup`の生成の第2引数に`onSegmentToLine: () => performSegmentKindSwitch(() => pathCornerEditor.switchSegmentsToLine())`・`onSegmentToCurve: () => performSegmentKindSwitch(() => pathCornerEditor.switchSegmentsToCurve())`を足す（戻り値をそのまま返すだけ）。
  * 既存の`syncOptionBarCornerGroup()`に`optionBarCornerGroup.renderSegmentSwitch(pathCornerEditor.getSegmentSwitchAvailability());`を1行足す（`render`の後）。`model.onChange`への登録と起動時の1回の呼び出しは既存のまま（新しい登録・経路を足さない）。JSDocを「チェックボックスとボタンの表示」に直す。
  * ブロック冒頭のコメントに、区間の切り替え（判定・組み立ては`PathSegmentKindRules`、手順は`PathCornerEditor`、表示は`OptionBarCornerGroup`）とキーを割り当てないことを足す。
* 判定・計算・機能専用の同期経路を足さない。`KeyboardShortcuts`の注入は変えない。`InputTracker`は変えない（配線の追加も要らない）。
* **追従の確認**：選択の変更・頂点の選択の変更・頂点の移動・取り消し／やり直し・キャンバスの切り替え・モードの切り替え・区間の切り替えの直後は、すべて既存の`model.onChange` → `syncOptionBarCornerGroup`で、ボタンと「角」のチェックボックスの両方が追従する（区間の切り替えの直後は、新しい区間の種類で「角」の見た目も決まり直す）。

### 要件F: 保存・コピー・書き出し・結合（コードは変えない。テストで確認）
* 作業データ：切り替えた結果はふつうの`Path`（`segments`・`corners`）と`Line`で、`toJSON()`・`ShapeFactory.fromJSON`を通るため、保存・読み込み・キャンバスの切り替え・取り消し／やり直し・コピー＆ペースト・複製で保たれる。作業データの版は2のまま・図形データのキーは増えない。
* 書き出し：曲線の区間を持つパスは`Path.toDrawElement`が`bezierPath`（`cubic`の制御点は`#segmentControls`の結果）を出し、区間がすべて直線のパスと直線は`polyline`のため、`SpriteSerializer`・`CodeExporter`は変えずに描かれ、外枠は形を囲む。書き出し形式の版は3のまま。
* 結合：単独の直線から変わったパスは開いたパス、今の曲線から変わった直線は直線のため、`PathJoinRules.isJoinableLine`のとおり結合・描き足しの対象になる（`PathJoinRules`の判定・組み立ては変えない）。
* `io/`・`check/`のコードとJSDocは変えない。

### 要件G: テスト（REQ要件5）
既存のケースは変えない（期待値の書き換えが要る既存のケースは無い見込み。出た場合はタスクの詳細作業内容にケースと理由を列挙する）。`palette/`・`main.js`・`index.html`はテストを置かない（`_doc/arch/16_test.md`の方針）。座標は中点・1/3の位置がちょうど表せる値（例：3の倍数・偶数の和になる整数）を使い、形の比較は厳密な一致か、`1e-9`程度の許容量で行う。
* **(G-1) `test/shapes/PathJoinRules.test.js`**（要件Aの`describe`を足す）：`segmentKindsOf`の直線・開いたパス・閉じたパス・新しい配列・引数を書き換えない。
* **(G-2) `test/shapes/PathSegmentKindRules.test.js`（新規）**：
  * `SegmentKindSwitch`の値と凍結。未知の操作は`targets`が空でも`Error`。
  * **切り替える区間と押せるか**（`resolveSegmentSwitchAvailability`）：0件・1点だけ＝両方`false`／直線のパスの隣り合う2点＝`toCurve`だけ／曲線のパスの隣り合う2点＝`toLine`だけ／直線と曲線の区間をまたいで3点＝両方`true`／並んでいない点（開いたパスの点0・1・3で、区間0が曲線・区間2と3が直線）＝区間0だけが対象（`toLine`だけ）／閉じたパスの終点と始点（番号`n − 1`と0）＝終点→始点の区間が対象／開いたパスの始点と終点だけ（頂点3つ以上）＝区間にならない／単独の直線の始点と終点＝`toCurve`だけ・片方だけ＝両方`false`／今の曲線の始点と終点（制御点を含めても含めなくても）＝`toLine`だけ・始点と制御点だけ＝両方`false`／矩形の4隅・円＝両方`false`／複数の図形＝それぞれの結果の「または」。
  * **「曲線に」の組み立て**（`planSegmentKindSwitch(…, TO_CURVE)`）：直線のパス（開いた・頂点3つ）の区間0＝頂点4つ・番号1に中点・区間の種類`['smooth', 'smooth', 'line']`・`vertexIndexMap`が`[0, 2, 3]`・`segments`の要素数＝頂点−1・`corners`の要素数＝頂点・角の情報（端の点・片側が直線の点は元のまま`false`）で`toJSON()`に`corners`が無い／同じパスの3点すべて＝頂点5つ・途中の元の点（新しい番号2）が角の点・足した点がなめらか・`vertexIndexMap`が`[0, 2, 4]`／反対側が既に曲線の区間の端の点が角の点になる／既に角の点だった点（切り替えに関係しない点）の角の情報が変わらない／閉じたパス（直線の正方形）の終点→始点の区間＝足した点が末尾（番号4）・`vertexIndexMap`が`[0, 1, 2, 3]`・閉じたまま・`fillColor`が残る／閉じたパスの全点＝すべての区間に点が足され元の点がすべて角の点／既に曲線の区間だけを選ぶと空配列・曲線と直線の区間を選ぶと直線の区間だけが変わる（曲線の区間の両端の角の情報は変わらない）／**押した直後の形が変わらない**：切り替えた区間の`toDrawElement()`の`cubic`の`control1`・`control2`が区間の両端の1/3・2/3の位置（区間の上）にあり、隣の曲線の区間の制御点が切り替えの前と同じ（開いたパス・閉じたパス・3つ以上続けて選んだ場合・既に曲線の区間と隣り合う場合）／単独の直線＝`type`が`'path'`・頂点3つ（始点・中点・終点）・開いた・区間の種類がどちらも`'smooth'`・`corners`なし・スタイル（線の色・太さ・塗りの色）が元のまま・idが`null`・`targetId`が元のid・`vertexIndexMap`が`[0, 2]`・`toDrawElement()`の制御点が線分の上／今の曲線の「曲線に」・単独の直線の「直線に」は空配列。
  * **「直線に」の組み立て**（`TO_LINE`）：曲線のパスの区間＝頂点の数が変わらない・その区間だけ`'line'`・角の情報が元のまま（`true`の点を含む）・`vertexIndexMap`が恒等／既に直線の区間だけは空配列／閉じた曲線のパスの終点→始点の区間＝閉じたまま・塗りが残る／今の曲線＝`type`が`'line'`・`toJSON()`の`points`が[始点, 終点]・スタイルが元のまま・idが`null`・`vertexIndexMap`が`[0, null, 1]`。
  * **共通**：複数の図形は最初に現れた順の計画・同じ点が2回でも同じ結果・引数の図形の`toJSON()`が変わらない・結果が引数と頂点を共有しない（結果の頂点を書き換えても元の図形が変わらない）。
* **(G-3) `test/edit/PathCornerEditor.segmentSwitch.test.js`（新規。既存の`test/edit/PathCornerEditor.test.js`は変えない）**：実物の`VectorModel`・図形クラス、呼び出しを記録する偽の記録先、`getMode`の差し替え（`OperationMode`の値）で組む（既存の`PathCornerEditor.test.js`と同じ組み方）。
  * `getSegmentSwitchAvailability`：頂点の選択モード以外・点なし＝両方`false`、隣り合う2点の区間の種類に応じた値、並んでいない点は両端が選ばれた区間だけで決まる。
  * `switchSegmentsToCurve`：`beginEdit`→`commitEdit`が1組（`commitEdit`の引数なし）・パスに点が足される・**選んでいた点が選ばれたまま**（例：頂点4つの開いたパスで`'vertex-1'`・`'vertex-2'`を選んで区間1を切り替えると、頂点の選択が`'vertex-1'`・`'vertex-3'`になり、足した点`'vertex-2'`は選ばれない。選んだ順も保つ）・図形の選択・id・重なり順（`getShapes()`の中の位置）・スタイルが変わらない・選んでいた点の位置が変わらない。
  * 単独の直線の「曲線に」：`type`が`'path'`になり、頂点の選択`'start'`・`'end'`が`'vertex-0'`・`'vertex-2'`になる。今の曲線の「直線に」：`type`が`'line'`になり、`'start'`・`'control'`・`'end'`を選んでいた頂点の選択が`'start'`・`'end'`になる（制御点の選択は外れる）。
  * 複数の図形の点を選んで切り替えても`beginEdit`/`commitEdit`は1組で、両方の図形が変わる。
  * 変わらないとき（既に曲線の区間の「曲線に」・既に直線の区間の「直線に」・点が1つだけ・頂点の選択モード以外）は`false`で、記録先にも`model.onChange`の通知にも触れない。
  * 通知の回数（変わる図形1つ。`replaceShape`1回＋頂点の選択の内容が変わったときだけ`setSelectedVertices`1回）：選んでいた点の番号がずれる「曲線に」（上の頂点4つの開いたパスで`'vertex-1'`・`'vertex-2'`を選んで区間1を切り替える例）＝2回、閉じたパスの終点→始点の区間だけを「曲線に」（足した点は末尾で`vertexIndexMap`が恒等のため、ハンドル名が変わらない）＝1回、パスの「直線に」＝1回（ハンドル名が変わらない）。
  * 実物の`HistoryManager`・`SnapshotAdapter`との組み合わせ：取り消し1回で切り替えの前の作業データに戻り、やり直しで切り替えた後に戻る（複数の図形をまとめて切り替えても取り消し1回）。
* **(G-4) `test/io/`（既存のファイルに`describe`を足す。既存のケースは変えない）**：
  * `test/io/DocumentSerializer.roundtrip.test.js`：「曲線に」で点を足し角の点ができたパス（開いた・閉じた。塗りあり）と単独の直線から変わったパス・今の曲線から変わった直線の往復（オブジェクト・文字列。既存の補助`assertRestored`等を使う）で`toJSON()`が一致する。
  * `test/io/SpriteSerializer.test.js`：切り替えたパスの`bezierPath`の要素（頂点の数・`segments`の要素数・`cubic`の制御点が`toDrawElement()`と一致）と外枠が形を囲むこと（既存の`sampleBezierPathRange`・`assertBoundsClose`）。単独の直線を「曲線に」した直後の外枠が、元の直線の外枠と同じ（形が変わらないため）。今の曲線を「直線に」した結果が`polyline`になる。
* **(G-5) 既存のテストで足りるところ**：結合（切り替えた図形も`isJoinableLine`の対象）は、結果が既存の`Path`・`Line`と区別できないため、`PathJoinRules`の既存のテストで足りる（足さない）。`CodeExporter`の描画の一致は、`bezierPath`・`polyline`の既存のテストで足りる（足さない）。

### 要件H: ふるまいの確認（テストプレイの確認項目。REQ要件6）
実装の最後（タスク7）に、本RESの「4. 詳細作業内容」へ写して実装の結果に合わせて確かめ、最終報告で発注者へ提示する。
0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。
1. **ボタンの置き場所**：オプションバーの右端に、左から「直線に」（╱）「曲線に」（∿）のボタンと「角」のチェックボックスが並ぶ。選択（`V`）では押せない見た目。マウスを乗せると名前が出る。幅1280px程度の画面でも切れずに見える。
2. **曲線にする**：直線のツールで点を3つ以上打ってパスを引く。頂点の選択（`A`）で線をクリックして選び、隣り合う2つの点を選ぶと「曲線に」が押せる。押すと、形は変わらずに区間の中点に点が足される（足した点のハンドルが出る。選んでいた2つの点は選ばれたまま、足した点は選ばれない）。足した点をドラッグすると、その区間が曲がる。両端の点は角（片側が直線のままの点は、チェックが入った見た目で押せない）。両側とも曲線になった端の点の「角」のチェックを外すと、隣の曲線となめらかにつながる。
3. **まとめて切り替える**：3つ以上続けて点を選んで「曲線に」を押すと、その間の区間すべてに点が足される（形は変わらない）。並んでいない点を選んだときは、両端が選ばれている区間だけが変わる。
4. **直線にする**：曲線のツールで引いたパスの隣り合う2つの点を選んで「直線に」を押すと、その間が直線になる。点の数は変わらない。両端の点の「角」はチェックが入った見た目で押せなくなる。
5. **単独の直線・今の曲線**：直線のツールで引いた1本の直線の両端の点を選んで「曲線に」を押すと、中点に点が足される（形は変わらない）。足した点をドラッグすると曲がる。今までに描いた曲線（今の曲線）の両端の点を選んで「直線に」を押すと、両端を結ぶ直線になる（曲がりを引っ張る点は無くなる）。どちらも色・太さ・重なり順は変わらない。
6. **閉じた形と塗り**：閉じた形（直線のパス・曲線のパス）の区間を、始点と終点の間の区間も含めて切り替えても、閉じたまま塗りも残る。
7. **押せないとき**：点を選んでいない・点を1つだけ選んでいる・既に曲線の区間だけを選んで「曲線に」（既に直線の区間だけを選んで「直線に」）のときは、ボタンが押せない見た目。開いた線の始点と終点だけを選んでも押せない。矩形の角・円を選んでも押せない。
8. **選択と取り消し**：切り替えた後も、選んでいた点は選ばれたまま（足した点は選ばれない。今の曲線を「直線に」したとき、曲がりを引っ張る点の選択は外れる）。取り消し（`Ctrl`+`Z`）1回で戻り、やり直しで切り替えた後に戻る（取り消し・やり直しの後は、今までの頂点の移動の取り消しと同じく、図形の選択は戻り頂点の選択は外れる）。複数の図形をまとめて切り替えても取り消し1回で戻る。押せないときに押しても（押せない見た目のため押せないが）、取り消しの履歴は増えない。
9. **ボタンを押した後のキー**：ボタンを押した直後に、矢印キー・`A`・`V`などのキーがそのまま働き、`Space`を押しながらのドラッグでパンできる（ボタンが押されない）。
10. **保存・書き出し・結合**：切り替えた図形を保存して開き直す（キャンバスの切り替え・コピー＆ペースト・複製（`Ctrl`+`D`）も）と、同じ形に戻る。書き出して確認用ページ（`sprite-check.html`）で開くと、同じ形で描かれ、外枠が形を囲む。切り替えた線も、今までどおり結合（`J`・ボタン・端点のドラッグ）・描き足しができる。
11. **ほかが今までどおり**：切り替えを使っていない線の形、「角」のチェックボックス、曲線のツール・直線のツールの連続作成、結合・描き足し、選択・頂点の選択・位置の数値入力・整列・重なり順・保存・読み込み・書き出しが今までどおり動く。

### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/`（図形をまたぐ規則）、`./js/edit/`（1件の編集操作の手順）、`./js/palette/`（オプションバーのまとまりのUI部品）、`./js/main.js`（配線）、`./index.html`（オプションバーの要素と幅の見積もりのコメント）、`./test/shapes/`・`./test/edit/`・`./test/io/`（自動テスト）。
*   **関連する論理クラス**:
    *   `shapes/PathSegmentKindRules`（**新規**。`SegmentKindSwitch`・`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`。図形をまたぐ規則＝第3の種類）
    *   `shapes/PathJoinRules`（既存。`segmentKindsOf`を`export`にするだけ）
    *   `shapes/PathCornerRules`（既存。変えない。`resolveCornerState`・`CornerState`を新しい規則が使う）
    *   `shapes/Path`・`shapes/Line`（既存。変えない。新しい規則がコンストラクタ・`readCornerFlags`・区間の種類の定数を使う）
    *   `edit/PathCornerEditor`（既存。`getSegmentSwitchAvailability`・`switchSegmentsToLine`・`switchSegmentsToCurve`を足す。名前は変えず責務を広げる）
    *   `palette/OptionBarCornerGroup`（既存。`renderSegmentSwitch`と2つのボタンの配線を足す。名前は変えず責務を広げる）
    *   `main.js`の`// 7.12.`（既存ブロック。`performSegmentKindSwitch`を足し、`syncOptionBarCornerGroup`にボタンの表示を足す）
    *   `index.html`の`#option-segment-to-line`・`#option-segment-to-curve`（**新規要素**。`#option-corner-group`の中）

### 参照する責務
*   **依存方向（1章）**：`main.js → edit → io → core → shapes`の一方向。一方向の列から外れるimportは3種だけ：(1)`edit/ → shapes/`（`PathJoiner → PathJoinRules`、`EndpointSnapper → EndpointSnapRules`・`PathJoinRules`、`PathCornerEditor → PathCornerRules`。`edit/`の他のクラスは`shapes/`をimportしない）、(2)`shapes/`内（`EndpointSnapRules → PathJoinRules`、`PathCornerRules → Path`。`PathJoinRules`は`Line`・`Path`のみimport（`Path`からは`readCornerFlags`も）するため循環しない。`PathCornerRules`は`PathJoinRules`・`EndpointSnapRules`をimportしない。`Line`のimportは`ShapeGeometry`・`ShapeDataValidation`だけ）、(3)`edit/ → core/`（`NudgeEditor`・`PositionInputEditor`・`PathCornerEditor → NudgeTargetRules`ほか。importするのは`core/`の状態を持たない規則の関数のみで、`VectorModel`・`HistoryManager`は注入）。`palette/`は何もimportしない。循環importは無い。**本作業で(1)に`PathCornerEditor → PathSegmentKindRules`、(2)に`PathSegmentKindRules → Path`・`Line`・`PathJoinRules`・`PathCornerRules`を足す。**
*   **`shapes/`の図形をまたぐ規則（1章・`_doc/arch/12_shapes.md`）**：図形クラスではない第3の種類。`shapes/`の外から使う。状態を持たない`export`した関数と定数のみ。図形の`type`・公開プロパティ`id`・`toJSON()`だけを読み、図形クラスの内部プロパティを読まない。表示倍率・`VectorModel`・履歴・DOM・操作モード・idの形式を知らない。`try/catch`を持たない。引数を書き換えず、結果は元の図形と配列・頂点を共有しない。`PathJoinRules`の`segmentKindsOf`は「`type`が`'line'`の図形は直線の区間1つ」という規則の唯一の定義箇所。`PathCornerRules`の`resolveCornerState(shape, vertexIndex)`は角の状態（`CORNER`・`SMOOTH`＝角を操作できる点、`LINE_CORNER`＝片側でも直線の区間のパスの点、`NONE`＝開いたパスの端の点・パス以外の図形の点・範囲外）の判定の唯一の箇所。
*   **`Path`（2章`path`・`_doc/arch/12_shapes.md`）**：`{ type: 'path', id, points, closed, segments: [{ kind }], corners?, strokeColor, strokeWidth, fillColor }`（キー順。`corners`は角の点が1つ以上あるときだけ`segments`の直後）。`segments[i]`＝`points[i]`→`points[i+1]`、閉じたパスの最後＝`points[n-1]`→`points[0]`。要素数は開いた`n − 1`・閉じた`n`。`corners`は`points`と同じ並び・同じ要素数（コンストラクタの第7引数。`true`以外は`false`）。コンストラクタは頂点を複製し、第6引数が配列なら区間ごとの種類（要素数は呼び出し側の責任で検証しない）。頂点の追加では`segments`・`corners`も`points`と同じ並びで保つ。`readCornerFlags(data)`は`corners`の読み方の唯一の箇所。区間の種類の定数`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`は`Path.js`が唯一の定義。制御点は`#segmentControls`（`computeSmoothSegmentControls`）が1か所で求め、描画・当たり判定・範囲選択・塗りの内側・`toDrawElement`が共有する。曲線の区間の形の決め方：`control1 = a + (b − Q0)/6`・`control2 = b − (Q3 − a)/6`、`Q0`＝前の区間が曲線かつ始点が角の点でなければ前の区間の始点、そうでなければ`2a − b`（`Q3`も同様）。直線の区間とのつなぎ目は常に角。
*   **ハンドル名の契約（`_doc/arch/12_shapes.md`）**：`getVertexHandleNames()`は毎回新しい配列で、並びは`getVertexIndexForHandle`が返す頂点の番号の昇順。一覧の名前は`hitTestHandle`が返しうる名前で、`getVertexIndexForHandle`が番号を、`getHandlePosition`が位置を返す。`getHandlePosition`はハンドル名でない値に例外を投げず`null`。`Line`＝`['start', 'end']`、`Curve`＝`['start', 'control', 'end']`、`Path`＝`'vertex-<i>'`。
*   **`edit/`（1章・`_doc/arch/14_edit.md`）**：操作モードを知らない（`getMode`の戻り値を解釈せず`core/NudgeTargetRules`へ渡すだけ）。1件の編集操作の手順は`VectorModel`・`HistoryManager`（`EditRecorder`）を注入で受け取り、規則の関数だけをimportする。DOM・図形種別の分岐・図形固有のプロパティ名を持たない。再描画・UI同期を自分で呼ばない。`PathCornerEditor`は対象を`resolveNudgeTarget`が`'vertices'`のときだけ集め（`getShapes()`に図形が無い組・`getVertexIndexForHandle`が`null`の組は飛ばす）、変わるときは`beginEdit` → 図形ごとに`replaceShape(targetId, path, { keepId: true, select: false })` → `commitEdit()`（鍵なし）、変わらないときは記録先・モデルに一切触れず`false`。
*   **`palette/`（1章・3章13.・`_doc/arch/13_palette.md`）**：1つのUI部品。オプションバーはまとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持ち、各UI部品は自分のまとまりの要素をルート要素として受け取り、要素はルート要素内の`querySelector('#id')`で解決する。要素idは接頭辞`option-`。importなし、`VectorModel`・図形データ・選択状態・手順・規則を知らない。コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない。`OptionBarCornerGroup`は`change`の後に最後の表示を当て直し`blur`する（`FocusKeyYieldRules`がチェックボックスに`Space`を譲り`Ctrl`なしのショートカットを止めるため）。
*   **`main.js`（`_doc/arch/02_main.md`）**：インスタンス化・依存の注入・イベントバインドのみ。判定ロジックを持たない。オプションバーのボタンは`perform…`の中で`inputTracker.isDragging()`なら不受理。表示の同期は`model.onChange`へ登録した同期関数だけで行い、起動時にも明示的に1回呼ぶ。`// 7.12.`は`PathCornerEditor`・`OptionBarCornerGroup`の生成と注入、`performCornerToggle`、`syncOptionBarCornerGroup`と`model.onChange`への登録。
*   **`VectorModel`（`_doc/arch/03_VectorModel.md`・2章「選択状態」）**：`replaceShape(targetId, shape, { keepId, select })`は位置を保って置き換え、`select: false`は選択集合を作り直さず現存しないidだけを外し、頂点の選択から選択中でなくなった図形の組を落とす（ハンドル名は見ない。通知1回）。図形インスタンスには`id`の代入以外で触れず、図形種別を関知しない。`setSelectedVertices(pairs)`は選択集合に含まれる図形の組だけを与えられた順で写し、内容が変わったときだけ通知1回。頂点の選択は保存しない・履歴の対象外。
*   **履歴（3章6.）**：変更処理を`beginEdit()`と`commitEdit()`で挟む。前後の作業データが一致すれば記録しない。結果が変わらない操作は`beginEdit`も呼ばない。取り消し・やり直しは`replaceAllShapes`で選択集合・頂点の選択をクリアし、`shouldRestoreSelection`が真なら図形の選択だけを戻す。
*   **入力欄とキー（`core/FocusKeyYieldRules`・`InputTracker`）**：`type`が`checkbox`・`color`の`input`と、`aria-pressed`を持つ`button`にフォーカスがある間は`Space`を部品に譲る。それ以外（`aria-pressed`の無いボタン）では`Space`はパンで、`keydown`・`keyup`の`preventDefault`でボタンは押されない。`Ctrl`なしのショートカットを止めるのはテキスト入力とチェックボックス・色の欄だけ。
*   **同期の経路（3章冒頭）**：再描画・UI同期は既存の経路（`model.onChange`ほか）のみ。機能専用の再描画・同期処理を足さない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **1章 構成図**：`shapes/`に`PathSegmentKindRules.js`（図形クラスではない。図形をまたぐ規則（区間の直線⇔曲線の切り替えの判定と組み立て）。`shapes/`の外から使う）を足す。`palette/OptionBarCornerGroup.js`の説明を「角のまとまり（区間の切り替えの2つのボタンとチェックボックス1つ。表示と操作の通知のみ）」に、`edit/PathCornerEditor.js`の説明を「角の切り替えと区間の切り替えの1件の編集操作と、角のまとまりの表示内容の照会。規則は`shapes/PathCornerRules`・`shapes/PathSegmentKindRules`」に直す。`test/shapes/PathSegmentKindRules.test.js`・`test/edit/PathCornerEditor.segmentSwitch.test.js`を足す。
*   **1章 フォルダ分割の方針**：`shapes/`の図形をまたぐ規則に`PathSegmentKindRules`を足す（`PathJoinRules`の`segmentKindsOf`が公開になり`PathSegmentKindRules`も使うこと）。`edit/`の手順の列の角の切り替えに区間の切り替えを足す。**依存方向**の(1)に`edit/PathCornerEditor → shapes/PathSegmentKindRules`、(2)に`shapes/PathSegmentKindRules → Path`・`Line`・`PathJoinRules`・`PathCornerRules`（循環しない理由）を足す。
*   **1章「存在しないもの」**：「区間の直線／曲線の切り替え（Phase 09-02）」を消し、区間のハイライト表示、区間の切り替えのキー、「曲線に」で足す点以外の頂点の追加・「直線に」で点を消すこと、今の曲線の「曲線に」（今の曲線をパスの曲線の区間にすること。Phase 09-03）を足す（既にある「区間をクリックして選ぶ仕組み」「直線の区間と曲線の区間のつなぎ目をなめらかにすること」「今の曲線・弧の結合と曲線の区間としての取り込み（Phase 09-03）」は残す）。
*   **2章`path`**：作られる操作に「区間の切り替え（単独の直線の「曲線に」で点を3つ持つ開いたパス）」を足す。区間の切り替えで、「曲線に」は区間の中点に点が足され（閉じたパスの終点→始点の区間に足した点は末尾）、`points`・`segments`・`corners`が同じ並びで一緒に増えること（不変条件を保つ）、「直線に」は区間の種類だけが変わることを足す。今の曲線の「直線に」で`line`になること。
*   **3章 新しい項「区間の直線⇔曲線の切り替え」**（24.として足す）：流れ（表示・入力）、モジュールの分担（規則`PathSegmentKindRules`・手順`PathCornerEditor`・DOM`OptionBarCornerGroup`・配線`main.js`の`// 7.12.`）、切り替える区間の決め方・押せるかの決め方・「曲線に」「直線に」の結果（足した点の位置・両端の角の情報の決め方と、角を操作できる点にならない点は元の値のままとした理由・形が変わらない理由）・単独の直線と今の曲線、選んでいた点の付け替え（共通メソッドと番号の対応だけで求める）、通知の回数と順（`k`回＋0か1回、途中の通知で頂点の選択が新しい図形に合わないが例外・残る誤表示は無いこと）、発注者の決定・現場設計の決定・REQの最上位の要件、ドラッグ中は受理しない、ボタンを`blur`しない理由（`Space`・ショートカット・`Enter`）、取り消し後に頂点の選択が外れること、やらないこと、確認の状況。
*   **3章6.（履歴）**：記録する操作に「区間の切り替え（`PathCornerEditor.switchSegmentsToLine`／`switchSegmentsToCurve`。`replaceShape`（変わる図形ごと）と`setSelectedVertices`の前後。変わらないときは`beginEdit`も呼ばない。鍵なし）」を足す。
*   **3章13.（まとまりごとの分け方）**：「角」のまとまりは、区間の切り替えのボタンを同じまとまりに置く発注者の決定により、1つのUI部品（`OptionBarCornerGroup`）と1つの配線ブロック（`// 7.12.`）のまま、ボタン2つとチェックボックス1つを受け持つ（分け方は変えず、UI部品の責務を広げた理由）。
*   **3章23.（角）**：「曲線に」で両端の点のうち両側とも曲線の区間になった点が角の点になること（足した点はなめらかな点）、区間の切り替えの直後もチェックボックスが追従すること、モジュールの分担に`PathCornerEditor`・`OptionBarCornerGroup`が区間の切り替えも受け持つこと。
*   **3章11.・12.**：切り替えた図形（単独の直線から変わったパス・今の曲線から変わった直線）も結合・描き足しの対象であること（必要なら1文）。
*   **`_doc/arch/12_shapes.md`**：`PathSegmentKindRules.js`の項（公開・読むもの・importと循環しない理由・使う側・知らないこと・注意（区間の種類を足すとき・`resolveCornerState`に任せること））。`PathJoinRules`の公開に`segmentKindsOf`（使う側に`PathSegmentKindRules`）。`PathCornerRules`の使う側に`PathSegmentKindRules`。`Path.js`の項の冒頭の説明文に角の情報`corners`を足す（前の作業の残り）、「作る操作」に区間の切り替えを足し、「区間の直線⇔曲線の切り替えを足すときは…（Phase 09-02）」の注意を「実施済み（Phase 09-02b）」の記述に直す。
*   **`_doc/arch/13_palette.md`**：`OptionBarCornerGroup.js`の項（2つのボタン・`renderSegmentSwitch`・コールバック3つ・要素が1つでも欠ければ配線しない・ボタンは`blur`しない理由・typedef`SegmentSwitchAvailability`の二重定義）。`palette/`の冒頭のオプションバーの部品の列に`OptionBarCornerGroup`が無ければ足す。
*   **`_doc/arch/14_edit.md`**：`PathCornerEditor.js`の項（責務の広がり・import・`model`の使うメソッドに`setSelectedVertices`・3つの公開メソッド・選んでいた点の付け替え・通知の回数と順）。`edit/`の「依存」の`edit/ → shapes/`の例外に`PathSegmentKindRules`。
*   **`_doc/arch/03_VectorModel.md`**：`replaceShape`の呼び出し元に`PathCornerEditor`（角の切り替え・区間の切り替え。`keepId: true`・`select: false`）を足す（前の作業で漏れている）。`setSelectedVertices`の呼び出し元に`PathCornerEditor`（区間の切り替えの後の付け替え）を足す。
*   **`_doc/arch/41_NudgeTargetRules.md`**：使う側の`edit/PathCornerEditor`の用途に区間の切り替えの対象の決定を足す。
*   **`_doc/arch/16_test.md`**：Phase 09-02bの新設・追加分、実物の`VectorModel`等を組み合わせる`test/edit/`の例外の数（`PathCornerEditor.segmentSwitch`を足す）、書き換えた既存のテスト（無しの見込み）、テストできない箇所（`OptionBarCornerGroup`のボタン・`main.js`の`// 7.12.`の追加分・`index.html`の見た目と1280px幅の収まり（見積もり約1261px）・ボタンの後のキー）、件数（タスク6で記録）。
*   **`_doc/arch/02_main.md`**：主な関数に`performSegmentKindSwitch`、配線ブロック`// 7.12.`の内容、注入の一覧（`OptionBarCornerGroup`のコールバック3つ）、行数（タスク5で記録）。
*   **`_doc/arch/01_index_html.md`**：保っているidに`#option-segment-to-line`・`#option-segment-to-curve`（と既存で漏れている`#option-corner-group`・`#option-corner-toggle`）、角のまとまりの中身（左から「直線に」「曲線に」「角」・記号は仮・`title`にキーなし・初期`disabled`・`aria-pressed`なし）、幅の見積もり（約1261px）、ショートカットの表記（2つのボタンの`title`にキーを書かない）。

## 3. タスクリスト
*   [x] タスク1: 要件A・要件B 区間の切り替えの規則（`shapes/PathSegmentKindRules`と`PathJoinRules.segmentKindsOf`の公開）
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` : 更新（`segmentKindsOf`に`export`を付け、そのJSDocを直すのみ）
        *   `./js/shapes/PathSegmentKindRules.js` : 新規
        *   `./test/shapes/PathJoinRules.test.js` : 更新（(G-1)の`describe`の追加のみ）
        *   `./test/shapes/PathSegmentKindRules.test.js` : 新規
    *   **作業内容** :
        *   「2. 要件A」のとおり、`segmentKindsOf`に`export`を付けてJSDocを直す（中身・ほかの関数・ファイル先頭の責務定義は変えない）。
        *   「2. 要件B」のとおりに、ファイル先頭の責務定義（3行以内）・`SegmentKindSwitch`・`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`と非公開の関数（`dataOf`・`collectSwitchEntries`・`changedSegmentIndexes`・`buildCurvedPath`・`buildStraightenedPath`・`buildLineFromCurve`・中点の補助）を作る。importは`./Path.js`・`./Line.js`・`./PathJoinRules.js`・`./PathCornerRules.js`の指定の名前のみ。図形の`type`・`id`・`toJSON()`だけを読む。形の決め方の式・角の状態の判定・`corners`の読み方・「直線は直線の区間1つ」を写さない。
        *   すべての関数・定数・typedef（`SegmentSwitchTarget`・`SegmentSwitchAvailability`・`SegmentSwitchPlanItem`）にJSDocを書く（`SegmentSwitchAvailability`は`palette/OptionBarCornerGroup.js`との二重定義、`SegmentSwitchTarget`は`PathCornerRules`の`CornerTarget`と同じ形であることを書く）。足した点の位置・閉じたパスの終点→始点の区間に足した点が末尾に入ること・両端の角の情報の決め方（角を操作できる点にならない点は元の値のまま）・形が変わらない理由をJSDocに書く。
        *   「2. 要件G」の(G-1)・(G-2)のテストを作る（既存のケースは変えない）。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク1に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する（資料本体は直さない）。
*   [x] タスク2: 要件C 区間の切り替えの1件の編集操作（`edit/PathCornerEditor`）
    *   **対象ファイル** :
        *   `./js/edit/PathCornerEditor.js` : 更新（importの追加、3つの公開メソッドと非公開の`#switchSegments`・`#remapSelectedVertices`の追加、ファイル先頭の責務定義とクラスJSDocの更新のみ。既存の`getView`・`toggle`・`#collectTargets`のコードは変えない）
        *   `./test/edit/PathCornerEditor.segmentSwitch.test.js` : 新規
    *   **作業内容** :
        *   「2. 要件C」のとおりに、`getSegmentSwitchAvailability`・`switchSegmentsToLine`・`switchSegmentsToCurve`・`#switchSegments`・`#remapSelectedVertices`を足す。手順は`planSegmentKindSwitch` → 空なら`false`（記録先・モデルに触れない）→ 置き換える前に付け替え先を求める → `beginEdit()` → 図形ごとの`replaceShape(targetId, shape, { keepId: true, select: false })` → `setSelectedVertices` → `commitEdit()`（鍵なし）→ `true`。付け替えは`getVertexIndexForHandle`・`getVertexHandleNames`と`vertexIndexMap`だけで求め、ハンドル名の形式・図形種別の分岐を書かない。
        *   ファイル先頭の責務定義（3行以内）・クラスJSDoc（依存の制約・`model`の使うメソッド・区間の切り替えの手順・通知の回数と順・選択の付け替え）を実態に合わせ、足したメソッドにJSDocを書く。
        *   「2. 要件G」の(G-3)のテストを作る。既存の`test/edit/PathCornerEditor.test.js`は変えない。
        *   JSDocの記載漏れが無いことを確かめる。`node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク2に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク3: 要件F 保存・書き出しのテスト（`io/`。コードは変えない）
    *   **対象ファイル** :
        *   `./test/io/DocumentSerializer.roundtrip.test.js` : 更新（`describe`の追加のみ）
        *   `./test/io/SpriteSerializer.test.js` : 更新（`describe`の追加のみ）
    *   **作業内容** :
        *   「2. 要件G」の(G-4)のテストを足す（切り替えた図形は`planSegmentKindSwitch`で作る。既存の補助関数を使う。既存のケースは変えない）。`js/io/`のコードとJSDocは変えない。
        *   `node --test`が全件通ることを確かめる。
        *   完了後、本RESの「4. 詳細作業内容」のタスク3に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [x] タスク4: 要件D 「直線に」「曲線に」のボタンのUI部品と要素（`palette/OptionBarCornerGroup`・`index.html`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarCornerGroup.js` : 更新（2つのボタンの解決と`click`の配線、`renderSegmentSwitch`の追加、コールバックの検証の追加、typedef・ファイル先頭の責務定義・クラスJSDocの更新のみ。既存の`render`・`#applyView`・`change`の処理は変えない）
        *   `./index.html` : 更新（`#option-corner-group`の中への2つのボタンの追加と、幅の見積もりのコメントの更新のみ）
    *   **作業内容** :
        *   「2. 要件D」のとおりにする。要素が1つでも欠ければ`console.warn`して配線しない（既存の警告の文言を使う）。ボタンは`blur`しない・`aria-pressed`を付けない。importを持たない。
        *   `index.html`に「2. 要件D」の2つのボタンを`<label class="option-corner-label" …>`の前に足し、幅の見積もりのコメントの角のまとまりの項と合計（約1261px）を直す。CSSの宣言・既存の要素は変えない。
        *   ファイル先頭の責務定義（3行以内）・typedef（`SegmentSwitchAvailability`の二重定義であることを書く・`OptionBarCornerGroupActions`）・クラスJSDoc・足したメソッドとフィールドのJSDocを書く。DOMのためテストは置かない。
        *   `node --test`が全件通ることを確かめる（このタスクでは件数は変わらない）。
        *   完了後、本RESの「4. 詳細作業内容」のタスク4に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク5: 要件E `main.js`の配線（`// 7.12.`への追加）
    *   **対象ファイル** :
        *   `./js/main.js` : 更新（`// 7.12.`のブロックの中だけ：`performSegmentKindSwitch`の追加、`OptionBarCornerGroup`の生成へのコールバック2つの追加、`syncOptionBarCornerGroup`への1行の追加とJSDoc、ブロック冒頭のコメント）
    *   **作業内容** :
        *   「2. 要件E」のとおりにする。importは増やさない。判定・計算・機能専用の同期経路・`model.onChange`への新しい登録を足さない。`KeyboardShortcuts`の注入・ほかのブロック・起動時の同期の呼び出しは変えない。
        *   `performSegmentKindSwitch`にJSDocを書き、`syncOptionBarCornerGroup`のJSDocとブロックのコメントを実態に合わせる。
        *   `node --test`が全件通ることを確かめる。変更後の`main.js`の行数（`wc -l`）を記録する（タスク8で資料へ書く）。
        *   完了後、本RESの「4. 詳細作業内容」のタスク5に作業内容を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク6: 仕上げの確認（JSDoc・スコープ・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。不備があればタスク1〜5の対象ファイルの中でだけ直す）
    *   **作業内容** :
        *   タスク1〜5で足した・変えた関数・定数・typedef・引数・フィールドのJSDocに漏れが無いこと、新しいファイル・変えたファイルの先頭の責務定義が3行以内で実態に合うことを確かめる。
        *   変えたファイルがタスクの対象ファイルだけであること（`git status`・`git diff --stat`で確かめる。`js/core/`・`js/io/`・`js/check/`・`js/wiring/`・`asset/`・`sprite-check.html`・図形クラス・`ShapeGeometry`・`PathCornerRules`・`EndpointSnapRules`・`edit/`の`PathCornerEditor`以外・`palette/`の`OptionBarCornerGroup`以外は不変。`PathJoinRules`は`segmentKindsOf`の`export`とJSDocだけ）、改名・整形・不要に見えるコードの削除をしていないことを確かめる。
        *   規則の二重定義が無いこと（形の決め方の式は`ShapeGeometry`、角の状態の判定は`resolveCornerState`、`corners`の読み方は`readCornerFlags`、「直線は直線の区間1つ」は`segmentKindsOf`、切り替える区間・変わる区間・並べ方・番号の対応は`PathSegmentKindRules`の各1か所、対象の点の集め方は`PathCornerEditor.#collectTargets`）と、`edit/`・`palette/`・`main.js`にハンドル名の形式（`'vertex-'`・`'start'`等）・図形種別（`'path'`・`'line'`・`'curve'`）・区間の種類（`'smooth'`・`'line'`）の文字列が増えていないことを`Grep`で確かめる。
        *   `node --test`が全件通ることを確かめ、件数（tests / suites / pass / fail）を記録する。既存のケースの期待値を書き換えていないこと（書き換えた場合はケースと理由）を記録する。
        *   完了後、本RESの「4. 詳細作業内容」のタスク6に確認結果を記載する。開発資料に影響があれば「開発資料の更新予定」へ追記する。
*   [ ] タスク7: 要件H テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （本RESのみ）
    *   **作業内容** :
        *   「2. 要件H」の確認項目0〜11を、本RESの「4. 詳細作業内容」のタスク7へ写し、実装の結果に合わせて文言を確かめる（実装で判明した注意点があれば足す）。最終報告でも提示する。
*   [ ] タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新
        *   `./_doc/arch/01_index_html.md` : 更新
        *   `./_doc/arch/02_main.md` : 更新
        *   `./_doc/arch/03_VectorModel.md` : 更新
        *   `./_doc/arch/12_shapes.md` : 更新
        *   `./_doc/arch/13_palette.md` : 更新
        *   `./_doc/arch/14_edit.md` : 更新
        *   `./_doc/arch/16_test.md` : 更新
        *   `./_doc/arch/41_NudgeTargetRules.md` : 更新
    *   **作業内容** :
        *   本タスクは、実装AIによる開発資料の書き換えが原則禁止の本ワークフローにおいて、**明示的な例外**として行う（後続タスクが無く、資料の変更で他タスクの前提が動く危険が無いため）。上のファイル（本タスクでパス指定する`_doc/arch/`のファイル）だけを読み・直す。
        *   本RESの「2. 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」と、各タスクで追記された分を確かめ、資料へ反映する。少なくとも、`PROJECT_ARCHITECTURE.md`の3章の新しい項「区間の直線⇔曲線の切り替え」（流れ・モジュールの分担・発注者の決定・現場設計の決定・やらないこと）、3章6.（記録する操作）・13.（まとまりの一覧と分け方）・23.（「曲線に」で両端が角の点になること）、2章`path`（区間の切り替えで点が足されること・不変条件）、1章の構成図とフォルダ分割の方針（依存方向の例外の列を含む）・「存在しないもの」を直す。`_doc/arch/12_shapes.md`の`Path.js`の項の冒頭の説明文に角の情報`corners`を足す（前の作業の残り）。
        *   資料の記載基準（`PROJECT_ARCHITECTURE.md`冒頭）に従い、1つのファイルのJSDocを読めば分かることは書かない。誤った記述は直すか消す。
        *   `_doc/arch/16_test.md`の件数はタスク6で記録した値、`_doc/arch/02_main.md`の行数はタスク5で記録した値を使う。
        *   完了後、本RESの「4. 詳細作業内容」のタスク8に反映した箇所を記載する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件A・要件B 区間の切り替えの規則（`shapes/PathSegmentKindRules`と`PathJoinRules.segmentKindsOf`の公開）
*   **作業内容** :
    *   `js/shapes/PathJoinRules.js`：`segmentKindsOf`に`export`を付け、JSDocを実態（直線とパスの値を渡す・使う側は`PathJoinRules`の中と`PathSegmentKindRules`）に直した。中身・ほかの関数・先頭の責務定義は変えていない。
    *   `js/shapes/PathSegmentKindRules.js`（新規）：先頭の責務定義（3行以内）、`SegmentKindSwitch`、typedef3つ（`SegmentSwitchTarget`・`SegmentSwitchAvailability`・`SegmentSwitchPlanItem`。ほかに非公開の`SwitchEntry`）、`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`、非公開の`dataOf`・`collectSwitchEntries`・`changedSegmentIndexes`・`midpoint`・`buildCurvedPath`・`buildStraightenedPath`・`buildLineFromCurve`。importは`Path.js`（`Path`・`SEGMENT_KIND_LINE`・`SEGMENT_KIND_SMOOTH`・`readCornerFlags`）・`Line.js`・`PathJoinRules.js`（`segmentKindsOf`）・`PathCornerRules.js`（`resolveCornerState`・`CornerState`）のみ。形の式・角の判定・`corners`の読み方・「直線は区間1つ」は写していない。
    *   `test/shapes/PathJoinRules.test.js`：`describe('segmentKindsOf（Phase 09-02b で公開）')`を追加（既存のケースは変えていない）。
    *   `test/shapes/PathSegmentKindRules.test.js`（新規）：(G-2)の各項目。
    *   `node --test`：tests 1897 / suites 300 / fail 0（開始前は1860 / 294）。
    *   今の曲線のテストでは`Curve`のコンストラクタが制御点を取らない（制御点は中点）ため、テスト内の補助`makeCurve`で公開の`setVertex(1, x, y)`により制御点を置いて作っている（既存テストの慣例）。
    *   監査の指摘で、閉じたパスで区間0が曲線の区間のとき終点→始点の区間を「曲線に」し、番号0をまたいで隣り合う曲線の区間の制御点が変わらないことを確かめるケースを足した。

### タスク2: 要件C 区間の切り替えの1件の編集操作（`edit/PathCornerEditor`）
*   **作業内容** :
    *   `js/edit/PathCornerEditor.js`：`PathSegmentKindRules`のimport（`SegmentKindSwitch`・`resolveSegmentSwitchAvailability`・`planSegmentKindSwitch`）を足し、公開メソッド`getSegmentSwitchAvailability`・`switchSegmentsToLine`・`switchSegmentsToCurve`と非公開の`#switchSegments`・`#remapSelectedVertices`を追加。手順は計画どおり（計画が空なら`false`で何も触れない → 置き換え前に付け替え先を求める → `beginEdit` → `replaceShape`（`keepId: true, select: false`）→ `setSelectedVertices` → `commitEdit()`（鍵なし））。付け替えは`getVertexIndexForHandle`・`getVertexHandleNames`と`vertexIndexMap`だけで、ハンドル名の形式・図形種別は書いていない。ファイル先頭の責務定義（2行）とクラスJSDoc（手順・通知・依存の制約）を実態に合わせた。既存の`getView`・`toggle`・`#collectTargets`は変えていない。
    *   `test/edit/PathCornerEditor.segmentSwitch.test.js`（新規）：(G-3)の各項目（押せるかの照会・曲線に・直線に・選択の付け替え・単独の直線／今の曲線・複数の図形・変わらないとき・通知の回数・実物の履歴での取り消し／やり直し）。既存の`PathCornerEditor.test.js`は変えていない。
    *   `node --test`：tests 1912 / suites 304 / fail 0（タスク1後は1897 / 300）。

### タスク3: 要件F 保存・書き出しのテスト（`io/`。コードは変えない）
*   **作業内容** :
    *   `test/io/DocumentSerializer.roundtrip.test.js`：`describe('区間の切り替えで作った図形の往復（Phase 09-02b）')`を追加（開いたパス・閉じた塗りありのパス（終点→始点の区間を含む）の「曲線に」、単独の直線から変わったパス、今の曲線から変わった直線を、オブジェクト層・文字列層で往復。`corners`のキーの有無、作業データの版2・キー順も確認）。`PathSegmentKindRules`のimportを足した。既存の補助`assertRestoredWithPaths`・`ROUTES`・`silenceWarn`を使用。
    *   `test/io/SpriteSerializer.test.js`：`describe('SpriteSerializer: 区間の切り替えで作った図形（Phase 09-02b）')`を追加（開いた・閉じたパスの`bezierPath`が`toDrawElement()`と一致し外枠が形（線幅の半分を加えたもの）を囲む、単独の直線を「曲線に」した直後の外枠が元と同じ、今の曲線を「直線に」した結果が`polyline`、書き出し形式の版3）。既存の補助`sampleBezierPathRange`・`assertBoundsClose`・`makeCurve`を使用。
    *   `js/io/`のコード・JSDocは変えていない。既存のケースは変えていない。
    *   `node --test`：tests 1926 / suites 306 / fail 0（タスク2後は1912 / 304）。

### タスク4: 要件D 「直線に」「曲線に」のボタンのUI部品と要素（`palette/OptionBarCornerGroup`・`index.html`）
*   **作業内容** :
    *   `js/palette/OptionBarCornerGroup.js`：先頭の責務定義・typedef`SegmentSwitchAvailability`（二重定義の旨を記載）・`OptionBarCornerGroupActions`（`onSegmentToLine`・`onSegmentToCurve`）・クラスJSDocを更新。コンストラクタでコールバック2つを検証し、3要素（`#option-corner-toggle`・`#option-segment-to-line`・`#option-segment-to-curve`）のどれかが欠ければ既存の警告文言で`console.warn`して配線しない。2ボタンの`click`でコールバックを呼ぶ（`blur`なし・`aria-pressed`なし）。公開メソッド`renderSegmentSwitch`・非公開フィールド`#toLineButton`・`#toCurveButton`を追加。既存の`render`・`#applyView`・`change`の処理は変えていない。importなし。
    *   `index.html`：`#option-corner-group`の中、`<label class="option-corner-label">`の前に2つのボタン（初期`disabled`）を追加。幅の見積もりのコメントの角の項（約106px）と合計（約1261px）を更新。CSS・既存要素は不変。
    *   DOMのためテストは置いていない。`node --test`：tests 1926 / suites 306 / fail 0（タスク3後から件数は変わらない）。
    *   注意：タスク4をコミットした時点では`js/main.js`が新しいコールバック（`onSegmentToLine`・`onSegmentToCurve`）をまだ渡していないため、ブラウザで起動すると`OptionBarCornerGroup`のコンストラクタが例外を投げる（タスク5で解消）。

### タスク5: 要件E `main.js`の配線（`// 7.12.`への追加）
*   **作業内容** :
    *   （未記入）

### タスク6: 仕上げの確認（JSDoc・スコープ・全テスト）
*   **作業内容** :
    *   （未記入）

### タスク7: 要件H テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （未記入）

### タスク8: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （未記入）

## 5. 懸念事項・要確認ポイント
* **既存のクラスの責務を広げること**：`edit/PathCornerEditor`と`palette/OptionBarCornerGroup`は、名前を変えずに区間の切り替えも受け持つ（理由は「2. 全体の方針」）。名前（Corner）と中身（角＋区間の切り替え）がずれるが、REQの「意味が広がるクラスは名前を変えずJSDocを実態に合わせる」に従う。
* **`PathJoinRules.segmentKindsOf`の公開**：規則の二重定義を避けるため、結合の規則のファイルの非公開の関数1つを公開にする（中身は変えない。JSDocの「開いた線の値だけを渡す」を直す）。`PathSegmentKindRules`が`PathJoinRules`をimportするのは`segmentKindsOf`のためだけ。
* **角を操作できる点にならない両端の点の角の情報は元の値のまま**（REQで計画に任された点。理由は「2. 要件B」の「角の情報の値の決定」）。形には効かない。
* **途中の通知での頂点の選択の食い違い**：区間の切り替えでは`replaceShape`（`k`回）の通知の時点で頂点の選択のハンドル名が新しい図形に合わない。同期の処理を実コードで確かめ、例外・残る誤表示は無いと判断した（「2. 要件C」）。画面での見え方はテストプレイ（確認項目2・5・8）で確かめる。
* **ボタンの記号（`╱`・`∿`）は仮**。環境によって大きさ・見え方がそろわない可能性がある（整列のボタンと同じ扱い）。1280px幅での収まり（見積もり約1261px。残り約19px）はテストプレイで確かめる。
* **`Enter`でボタンがもう一度押されること**：ボタンを押した後にフォーカスが残り、`Enter`を押すと（押せるときだけ）もう一度切り替わる。今の重なり順・整列のボタンと同じふるまいで、変えない。
* **（タスク1より）`PathSegmentKindRules`の注意**：区間の種類を足すときは`changedSegmentIndexes`と`buildCurvedPath`／`buildStraightenedPath`を直す。角の状態は`resolveCornerState`に任せ写さない。今の曲線の頂点の並び（始点0・制御点1・終点2）は`toJSON().points`の約束から読んでいる。開発資料への影響は「開発資料の更新予定」に既に記載の範囲（追記なし）。
