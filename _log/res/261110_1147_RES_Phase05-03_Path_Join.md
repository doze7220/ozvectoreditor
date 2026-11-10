# RES: 作業計画・作業レポート (Phase 05-03) : 結合の操作
* 参照元REQ: `./_log/req/261110_1129_REQ_Phase05-03_Path_Join.md`

## 1. 作業目的
選択モードで選んでいる線（直線・開いたパス）を「結合」する操作を足す。開いたパス1本（頂点3つ以上）を結合すると閉じたパスになり、線を2本結合すると1本の開いたパスになる。操作はコントロールパネルの「結合」ボタンとキー`J`の2つで、どちらも同じ1つの経路を通る。結合は1件の編集操作として履歴に記録し、Undo1回で元に戻り、Redo1回でやり直せる。

本作業の中心は次の3点である。
*   **結合の規則**（受理条件・閉じる/2本の結合の頂点の並び・端点の重なりの判定・属性・id・重なり順の決め方）を、表示倍率を知らない純粋な関数として1箇所に置く（Phase 05-04が同じ規則を使い回すため）。
*   **モデルへの反映**：図形1つをその位置で差し替え、他の図形を除き、結果だけを選択する公開操作を`VectorModel`に足す（通知は1回）。
*   **結合の手順**：選択集合から規則で結合の計画を作り、`beginEdit`/`commitEdit`で挟んでモデルへ反映する。`InputTracker`へは入れず、`main.js`は配線だけにする。

結合で作るパスはPhase 05-02のパス（`js/shapes/Path.js`）と同じ図形データ・描画要素であり、作業データの版・書き出し形式の版・`io/`・既存の図形クラス・`ShapeFactory`・`InputTracker`は変更しない。

## 2. アーキテクチャ設計

### 全体構成と依存の向き
```text
index.html ── #selection-join（「結合」ボタン。#selection-deleteと同じ行）
main.js（配線のみ）
  ├─ new PathJoiner({ model, editRecorder: historyManager, screenLengthToWorld })   … edit/
  ├─ performJoin()：ドラッグ中なら不受理 → pathJoiner.join()          … ボタンとキーJの共通経路
  ├─ syncJoinButtonState()：disabled = !pathJoiner.canJoin()          … model.onChangeに登録＋起動時に1回
  └─ KeyboardShortcuts の join コールバック = performJoin
edit/PathJoiner.js（結合の手順。図形種別を知らない）
  ├─ import shapes/PathJoinRules.js（規則の関数と定数）
  ├─ model.getShapes / model.isSelected / model.replaceShape（注入）
  └─ editRecorder.beginEdit / commitEdit（注入。実体HistoryManager）
shapes/PathJoinRules.js（結合の規則。表示倍率・ViewTransform・VectorModelを知らない）
  └─ import shapes/Path.js（結果のパスをコンストラクタで作る）
core/VectorModel.js … 公開操作 replaceShape を追加（図形種別を知らない）
core/KeyboardShortcuts.js … 対応表に KeyJ → 'join' を1件追加
```
*   依存の向き：`main.js → edit/PathJoiner → shapes/PathJoinRules → shapes/Path`。`edit/`から`shapes/`への直接のimportは`PathJoiner`だけの例外として開発資料に書く（`edit/`の現在の原則は「importは`DocumentSerializer`のみ」で、`CanvasFileOperations`の例外と同じ書き方をする）。下向きの一方向であり、`shapes/`は`core/`・`edit/`をimportしない。
*   `core/`は`PathJoinRules`をimportしない（本作業では`VectorModel`・`KeyboardShortcuts`とも不要）。Phase 05-04で`core/`から使う場合も`core → shapes`の向きなので許される。

### 要件1: 結合の対象（受理条件）
規則は`PathJoinRules.classifyJoin(shapes)`の1箇所で判定する（ボタンの押せる/押せない・手順の両方がこれを使う）。`shapes`は選択集合の図形を**重なり順（`model.getShapes()`の並び。奥が先）**で並べた配列。

| `shapes` | 戻り値 |
| --- | --- |
| 1つで、図形データの`type`が`'path'`・`closed`が真でない・`points`が3つ以上 | `'close'` |
| 2つで、どちらも「結合できる線」（`type`が`'line'`、または`type`が`'path'`で`closed`が真でない） | `'join'` |
| 上記以外（0個／直線1本／頂点2つの開いたパス1本／3つ以上／`curve`・`rect`・`circle`・`arc`・閉じたパスを1つでも含む） | `null` |

*   図形の読み取りは`type`（共通プロパティ）と`toJSON()`（2章「図形データ」の形：`points`・`closed`・`strokeColor`・`strokeWidth`）だけで行う。`Line`の`x1`等の内部プロパティを読まない（`Line`の図形データは`points`2点＝[始点, 終点]で`closed`を持たないため、開いた線として扱える）。
*   `null`のとき手順は何もしない（図形・選択集合・履歴を変えず、例外を投げない）。
*   **ドラッグ中**：キーは`KeyboardShortcuts`の手順4で止まる。ボタンは`main.js`の`performJoin()`がドラッグ中を不受理にする（`_doc/arch/02_main.md`「ボタン等ショートカット以外から呼ぶ場合は呼び出し側でドラッグ中の判定が必要」に従う。中ボタンのパン中に左クリックでボタンを押せる可能性があるため）。
*   **キャンバスの読み込み中（計画時に実コードで確認済み）**：読み込み中は図形0個・選択集合が空のため、`classifyJoin([])`が`null`となり「何もしない」に当たる。根拠：
    *   `VectorModel`は図形0個で生成される（`constructor`）。読み込み中に図形一式を入れる経路は`CanvasLibrary`の`#enterCanvas`（→`model.replaceAllShapes`。選択集合をクリアする）だけで、`start()`では`#enterCanvas`の後に`await`で別のイベントが割り込む前に（`#openFirstLoadable`の`return`→`start()`の`finally`はマイクロタスクで続く。`'unavailable'`の分岐は同期的に`finally`へ進む）`#isLoading = false`になる。
    *   読み込み中に図形を足し得る他の経路はすべて受理されない：マウス入力は`#canvas-loading-cover`が遮る、貼り付けはクリップボードが空（起動直後）、複製・全選択は図形0個のため選択集合が空のまま、インポートは`CanvasFileOperations`の`state.loading`判定で不受理、開く（ファイル）・新規作成は`CanvasLibrary`が不受理、`?dev`の復元は`main.js`の`onImport`が`loading`で不受理。
    *   したがって結合のボタンは`disabled`のまま（`syncJoinButtonState`）、キー`J`は`performJoin()`→`join()`が`false`を返すだけになる。読み込み中の専用の判定は足さない。

### 要件2: 開いたパス1本を閉じる
`PathJoinRules.buildClosedPath(shape, tolerance)`：
1.  `shape`が「頂点3つ以上の開いたパス」でなければ`null`。
2.  `data = shape.toJSON()`。始点`points[0]`と終点`points[n-1]`の距離（`Math.hypot`）が`tolerance`以下なら、最後の頂点を除く（終点を始点にまとめる）。
3.  残りの頂点が3つ未満なら`null`（何もしない）。
4.  `new Path(points, true, data.strokeColor, data.strokeWidth)`を返す（区間はコンストラクタが`n`個の`'line'`で作るため、要素数の不変条件を満たす。`id`は`null`のまま。頂点の並び・向きは変えない）。

id・重なり順の位置を保つことは計画（要件4の`planJoin`の`keepId: true`・`targetId`）とモデルの公開操作（要件7の`replaceShape`）で実現する。

### 要件3: 2本を結合する
`PathJoinRules.buildJoinedPath(a, b, tolerance)`（`a`＝基準の線A＝重なり順で奥、`b`＝もう一方B）：
1.  `a`・`b`のどちらかが結合できる線でなければ`null`。
2.  `A = a.toJSON().points`、`B = b.toJSON().points`。端点の組を次の優先順に並べ、距離（`Math.hypot`）が**厳密に小さい**ときだけ候補を更新して最小の組を選ぶ（同じ距離なら先の組が残る）：
    | 順 | 組 | Bの並べ方（`Bseq`） | 結果の頂点の並び |
    | --- | --- | --- | --- |
    | (1) | Aの終点とBの始点 | Bの順のまま | `A` ＋ `Bseq` |
    | (2) | Aの終点とBの終点 | Bを逆順 | `A` ＋ `Bseq` |
    | (3) | Aの始点とBの終点 | Bの順のまま | `Bseq` ＋ `A` |
    | (4) | Aの始点とBの始点 | Bを逆順 | `Bseq` ＋ `A` |
    *   Aの終点でつなぐ（(1)(2)）とき`Bseq`はつなぐ端点が先頭、Aの始点でつなぐ（(3)(4)）とき`Bseq`はつなぐ端点が末尾になる。
3.  選んだ組の距離が`tolerance`以下（ちょうどを含む）なら重なっているとみなし、`Bseq`側のつなぐ端点を除く（(1)(2)は`Bseq`の先頭、(3)(4)は`Bseq`の末尾）。まとめた頂点の座標はAの端点のまま（Aの形を変えない）。離れていれば除かない（端点どうしの間に直線の区間ができる）。
4.  `new Path(points, false, Aの strokeColor, Aの strokeWidth)`を返す（開いたパス。区間はすべて`'line'`で`頂点数 - 1`個。頂点はA・Bとも2つ以上のため結果は常に3つ以上）。両端が重なっても閉じない。

### 要件4: 端点の「重なり」の判定と、規則の置き場所（Phase 05-04からの使い回し）
*   **5pxの定数**：`PathJoinRules.js`に`export const JOIN_TOLERANCE_SCREEN_PX = 5`（画面上のpx）を置く（唯一の定義箇所）。`InputTracker`の`hitTolerance`（同じ5px）とは別の定義とし、統一しない（`InputTracker`を変更しないため）。
*   **換算の担当**：`PathJoiner`が、結合を行う時点で`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`を呼んでワールド座標の許容距離にし、規則の関数へ引数で渡す。`screenLengthToWorld`は`main.js`が`(length) => viewTransform.screenLengthToWorld(length)`として注入する（`ViewTransform.screenLengthToWorld`は`length / scale`。`InputTracker`の当たり判定の換算と同じ方法）。
*   **規則の関数は表示倍率・`ViewTransform`を知らない**：`buildClosedPath`・`buildJoinedPath`・`planJoin`はワールド座標の許容距離`tolerance`を引数で受け取る。`classifyJoin`は許容距離を使わない（押せる/押せないの判定は表示倍率を見ない）。
*   **結合の計画**：`PathJoinRules.planJoin(shapes, tolerance)` → `JoinPlan | null`。
    *   `JoinPlan`＝`{ path: Path, targetId: *, keepId: boolean, removeIds: Array<*> }`（typedefを`PathJoinRules.js`に置く）。
    *   `classifyJoin`が`'close'`：`path = buildClosedPath(shapes[0], tolerance)`。`null`なら`planJoin`も`null`。`targetId = shapes[0].id`、`keepId = true`、`removeIds = []`。
    *   `'join'`：`path = buildJoinedPath(shapes[0], shapes[1], tolerance)`（`shapes[0]`＝重なり順で奥＝A）。`targetId = shapes[0].id`、`keepId = false`（新しいidを採番する）、`removeIds = [shapes[1].id]`。
    *   それ以外は`null`。
    *   `id`は不透明な値として読み写すだけで、形式を解釈しない。
*   **Phase 05-04が使う入口**：`JOIN_TOLERANCE_SCREEN_PX`（吸い付き・重なりの距離）、`isJoinableLine(shape)`（吸い付く対象＝結合できる線）、`buildJoinedPath(a, b, tolerance)`（A＝奥・Aの向き・Aの色と太さ・端点の選び方・重なりでのまとめ方）、`buildClosedPath(shape, tolerance)`。05-04の吸い付きそのものは作らない。
*   **`PathJoinRules.js`の公開**（すべて状態を持たない`export`の関数・定数。クラスにしない）：`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin`。
*   **知らないこと**：表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式。importは`./Path.js`のみ（`ShapeGeometry`・`ShapeDataValidation`は図形クラスだけが使う共通モジュールのためimportしない。距離は`Math.hypot`で求める）。`try/catch`を持たない。
*   **戻り値の独立性**：`toJSON()`の頂点は新しいオブジェクトであり、`Path`のコンストラクタも頂点を複製するため、結果のパスは元の図形の配列・頂点オブジェクトを共有しない。引数の図形を書き換えない。
*   **先頭行の責務JSDoc（案）**：「責務: 線（直線・開いたパス）の結合の規則（受理条件・閉じる／2本の結合の頂点の並びと属性・端点の重なりの判定の距離）を、状態を持たない関数と定数として提供する。表示倍率・モデル・履歴を知らず、ワールド座標の許容距離を引数で受け取る。」（3行以内）

### 要件5: 操作の置き場所（ボタン＋キー`J`）
*   **ボタン（`index.html`）**：`#selection-delete`と新しい`#selection-join`を`<div class="selection-button-row">`で1行に横並びにする。`.selection-button-row`のCSSは`.history-button-row`と同じ指定（`display: flex; gap: 8px;`、子の`.tool-btn`は`flex: 1; text-align: center; white-space: nowrap;`）を新しい規則として足す（既存の`.history-button-row`の規則は書き換えない）。
    *   結合ボタン：`<button type="button" id="selection-join" class="tool-btn" title="選択中の線を結合 (J)" disabled>🔗 結合</button>`（削除ボタンの右）。
    *   削除ボタンのid・`title`・表示文字列・`disabled`は変えない（見た目は行の半分の幅・中央寄せになる）。
    *   行は削除ボタン1つの行を置き換えるだけなので、コントロールパネルの高さは増えない。`#window-shape-palette`の`top`とそのコメントは変えない。
*   **押せる/押せない（`main.js`）**：`syncJoinButtonState()`＝`joinSelectionBtn.disabled = !pathJoiner.canJoin()`。`model.onChange`に登録し、起動時の同期の並び（`syncDeleteButtonState()`の直後）で1回呼ぶ。`canJoin()`は表示倍率を見ない（「まとめると頂点が3つ未満」のときは押せるまま押しても何も起きない）。
*   **キー（`KeyboardShortcuts.js`）**：`{ codes: ['KeyJ'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'join' }`を`deleteSelection`のエントリの直後に1件足す。typedef`ShortcutActions`に`join`を足す。
*   **キーの受理（戻り値）**：`join`は「結合した場合のみ`true`、何もしなかった場合は`false`」とする（修飾キーなしの`cancel`・`deleteSelection`と同じ規則。`J`単体にはブラウザ標準の動作が無いため常に`true`にする理由がない）。`Ctrl`+`J`は`ctrl: false`のエントリに一致しないためブラウザの標準動作のまま。`Shift`+`J`は将来のために予約（不一致）。
*   **同じ1つの経路**：ボタンのclickとキーの`join`コールバックは、どちらも`main.js`の`performJoin()`だけを呼ぶ（`pathJoiner.join()`を直接呼ばない）。`performJoin()`：(1) `inputTracker.isDragging()`なら`false`。(2) `return pathJoiner.join()`。
*   ボタンの`title`と`SHORTCUT_BINDINGS`は手で同期する（`(J)`）。

### 要件6: 履歴（Undo/Redo）
*   `PathJoiner.join()`は、計画が`null`でないときだけ`editRecorder.beginEdit()` → `model.replaceShape(...)` → `editRecorder.commitEdit()`を1回ずつ呼ぶ（`ShapeInserter.insertDocument`と同じ形）。計画が`null`なら`beginEdit`/`commitEdit`を呼ばず、記録しない。
*   前の状態のスナップショットは元の図形（同じid・同じ重なり順・同じ形）と選択集合（結合した図形）、後の状態は結果のパスと選択集合（結果のパスだけ）。Undo/Redoの適用は既存の`SnapshotAdapter.restore`（`replaceAllShapes`＋`shouldRestoreSelection()`が真のときだけ`setSelection`）に任せ、新しい規則を足さない。
*   `editRecorder`の型は既存のtypedef`EditRecorder`をJSDocの`import('./ShapeInserter.js').EditRecorder`で参照し、3つ目の定義を作らない（`InputTracker.js`・`ShapeInserter.js`の二重定義は現状のまま）。

### 要件7: 処理を置く場所
#### 7-1. 置き場所の判断と理由
| 置き場所の候補 | 判断 | 理由 |
| --- | --- | --- |
| `InputTracker` | 不採用 | 操作モードの状態（ドラッグ・作成途中の図形）に依存しない操作（`_doc/COWORK_STATUS.md` 2章C「`InputTracker`の肥大化防止」）。 |
| `main.js` | 配線のみ | 判定ロジック・手順の本体を持たない（`_doc/arch/02_main.md`「持たないもの」）。 |
| `VectorModel` | モデルへの反映の公開操作のみ | 図形種別を関知しないため、結合の規則は置けない。 |
| `edit/`に規則ごと置く | 不採用 | `edit/`は図形種別の分岐・図形固有のプロパティ名を知らない。 |
| `core/`に規則を置く | 不採用 | `core/`で図形種別の対応づけを許すのは`ShapeFactory`だけ。 |
| **`shapes/PathJoinRules.js`（規則）** | 採用 | 図形種別（`'line'`・`'path'`）と図形データ（`points`・`closed`）を知ってよい層で、`Path`を作れる（`shapes → shapes`）。Phase 05-04の`core/`からも`core → shapes`の向きで使える。`core/`をimportしない。 |
| **`edit/PathJoiner.js`（手順）** | 採用 | `ShapeInserter`と同じく、注入された`VectorModel`・`EditRecorder`を組み合わせる1件の編集操作。規則の関数を呼ぶだけで、図形種別の分岐・図形固有のプロパティ名を持たない（読むのは共通プロパティ`id`だけ）。 |

*   `shapes/`の性格の追記：`PathJoinRules.js`は図形クラスでも「図形クラスだけが使う共通モジュール」（`ShapeGeometry`・`ShapeDataValidation`）でもない第3の種類「図形をまたぐ規則」として開発資料に書く（`shapes/`の外（`edit/PathJoiner`、将来は`core/`）からimportされる。共通モジュールの「importするのは図形クラスのみ」の制約は共通モジュール2つについてのもので、変えない）。

#### 7-2. `edit/PathJoiner.js`（新設）
*   **先頭行の責務JSDoc（案）**：「責務: 選択中の線（直線・開いたパス）の結合を、結合の規則（`shapes/PathJoinRules`）で作った計画に従ってモデルへ反映する1件の編集操作（閉じる・2本の結合）と、結合できる選択かの照会を担う。DOMに触れない。」
*   **コンストラクタ**：`constructor({ model, editRecorder, screenLengthToWorld })`。`model`は`getShapes`・`isSelected`・`replaceShape`だけを使う。`screenLengthToWorld`は`(length: number) => number`（画面上の長さ→ワールド座標の長さ）。
*   **`canJoin()`**：`#selectedShapesInOrder()`を`classifyJoin`に渡し、`null`でなければ`true`。モデル・履歴を変えない。
*   **`join()`**：
    1.  `shapes = #selectedShapesInOrder()`（`model.getShapes().filter((shape) => model.isSelected(shape.id))`。重なり順）。
    2.  `plan = planJoin(shapes, screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX))`。`null`なら`false`を返す（何も呼ばない）。
    3.  `editRecorder.beginEdit()` → `placedId = model.replaceShape(plan.targetId, plan.path, { keepId: plan.keepId, removeIds: plan.removeIds })` → `editRecorder.commitEdit()`。
    4.  `placedId !== null`なら`true`、そうでなければ`false`（`null`は起きない想定。起きても`commitEdit`が前後の一致で記録しない）。
*   **前提（呼び出し側の責務。クラスJSDocに書く）**：ドラッグ中でないこと（`performJoin()`が判定）。選択モード以外では選択集合が空のため何もしない（操作モードを知らない）。進行中の入力操作の中断・モード切り替えは行わない（選択モードで選択集合が空でない状態では作成途中の図形が無い）。
*   **知らないこと**：DOM・図形種別の分岐・図形固有のプロパティ名・idの形式・操作モード・表示倍率の値の出どころ（注入関数の戻り値に従うだけ）。`InputTracker`に依存しない。`try/catch`を持たない。
*   **import**：`../shapes/PathJoinRules.js`（`JOIN_TOLERANCE_SCREEN_PX`・`classifyJoin`・`planJoin`）のみ。

#### 7-3. `VectorModel.replaceShape`（公開操作の追加）
既存の公開操作では「指定の図形の位置へ新しい図形を入れ、他の図形を除き、結果だけを選択し、通知1回」を満たせないため足す（`replaceAllShapes`は流用しない：JSDocの用途が「`?dev`の復元・取り消し/やり直し・キャンバスの切り替え」で、選択集合・ホバー・作成中の図形・選択矩形をすべてクリアし、選択のために`setSelection`を続けると通知が2回になるため）。

`replaceShape(targetId, shape, { keepId = false, removeIds = [] } = {})` → `string | null`：
1.  `#shapes`で`id === targetId`の図形の位置を探す。無ければ何もせず（通知もせず）`null`。
2.  `shape`のインスタンスが既に`#shapes`に含まれていれば、`console.warn`のうえ何もせず`null`（同じidの2要素を作らないため。`addShapesWithNewIds`と同じ考え方）。
3.  `shape.id`を、`keepId`が真なら`targetId`、偽なら`#issueId()`で発行した新しいidにする。
4.  `targetId`の位置の図形を`shape`に置き換え、`removeIds`に含まれるidの図形を除く（`targetId`自身が`removeIds`に含まれていても置き換えた位置は除かない。存在しないidは無視）。他の図形の前後関係は変えない。
5.  選択集合を`shape.id`だけにする。ホバー中のidが現存しなくなったらホバーを解除する（`keepId`で同じidが残る場合は解除しない）。作成中の図形・選択矩形には触れない。
6.  変更を通知する（1回）。`shape.id`を返す。
*   図形インスタンスには`id`の代入以外で触れない（図形種別・頂点を関知しない）。id採番は`#issueId()`を経由する。`#issueId`・`#nextId`のJSDocの「採番する操作」の列挙に`replaceShape`を足す。
*   前提（JSDoc）：選択モードであること（選択集合は選択モード以外では常に空という不変条件を呼び出し側が守る）。受け取ったインスタンスを保持して`id`を書き換えるため、呼び出し側は流用しない。

#### 7-4. 変更しないもの
既存の図形クラス（`Line`・`Curve`・`Rect`・`Ellipse`・`Path`）・共通モジュール・`ShapeFactory`・`InputTracker`・`HistoryManager`・`SnapshotAdapter`・`ShapeInserter`・`io/`・`palette/`は変更しない（変更不要と計画時に確認した）。

### 要件8: 結合後のパスの保存・読み込み・書き出し
結果は`new Path(points, closed, strokeColor, strokeWidth)`で作るため、区間の要素数の不変条件（開いた`n - 1`・閉じた`n`、`kind: 'line'`）と頂点数の下限（開いた3以上・閉じた3以上）を満たし、`toJSON`→`Path.fromJSON`で同じ図形データに戻る。スプライトは既存の`Path.toDrawElement`（版1の`polyline`）で書き出される。作業データの版・書き出し形式の版・`io/`は変えない。

### 要件9: 自動テスト
`_doc/arch/16_test.md`の規則に従う（置き場所と命名、`node:test`・`node:assert/strict`のみ、公開APIのみ、先頭行の責務JSDoc、補助関数のJSDoc、図形の`id`は公開プロパティへ文字列を直接代入、注入される依存は素のオブジェクトの偽物、`console.warn`は`t.mock.method`で抑止、テストのためにソースを書き換えない）。計画時点の`node --test`：`tests 498`・`pass 498`・`fail 0`。

#### 9-1. `test/shapes/PathJoinRules.test.js`（新設）
import：`node:test`・`node:assert/strict`・`../../js/shapes/PathJoinRules.js`・`Line`・`Curve`・`Rect`・`Ellipse`・`Path`。
*   **`classifyJoin`**：直線1本→`null`／頂点2つのパス1本→`null`／頂点3つ以上の開いたパス1本→`'close'`／閉じたパス1本→`null`／直線2本→`'join'`／直線とパス（順を入れ替えても）→`'join'`／パス2本（頂点2つのパスを含む）→`'join'`／曲線・矩形・円・弧・閉じたパスのそれぞれと直線の2つ→`null`／3つ以上（直線3本）→`null`／0個→`null`。曲線・矩形・円・弧の1つ→`null`。
*   **`isJoinableLine`**：直線・開いたパス→`true`、閉じたパス・曲線・矩形・円・弧→`false`。
*   **`buildClosedPath`**：
    *   `[(0,0),(100,0),(100,100)]`の開いたパス→`closed`が`true`、`segments`が3要素で全て`{ kind: 'line' }`（元の2要素から1つ増える）、`points`が元と同じ並び、色・太さが元と同じ。
    *   `[(0,0),(100,0),(100,100),(3,4)]`で`tolerance = 5`（距離ちょうど5）→終点を除いた3頂点で閉じる。`tolerance = 4.9`→4頂点のまま閉じる（`segments`4要素）。
    *   `[(0,0),(100,0),(3,4)]`で`tolerance = 5`→`null`（まとめると2頂点）。
    *   直線・頂点2つのパス・閉じたパス→`null`。
*   **`buildJoinedPath`**（A＝`(0,0)→(10,0)`の直線、`tolerance = 0`で離れたケース）：
    *   (1) B＝`(20,0)→(30,0)`→`(0,0),(10,0),(20,0),(30,0)`。
    *   (2) B＝`(30,0)→(20,0)`→`(0,0),(10,0),(20,0),(30,0)`（Bを逆順）。
    *   (3) B＝`(-30,0)→(-20,0)`→`(-30,0),(-20,0),(0,0),(10,0)`。
    *   (4) B＝`(-20,0)→(-30,0)`→`(-30,0),(-20,0),(0,0),(10,0)`（Bを逆順）。
    *   いずれもAの向き（Aの始点→終点の順）が結果の中で保たれること、`closed`が`false`、`segments`がすべて`'line'`で要素数が`頂点数 - 1`。
    *   **優先順**：B＝`(5,10)→(5,-10)`（4組すべて等距離）→(1)の並び。B＝`(-5,10)→(5,10)`（(2)(3)(4)が等距離で(1)より近い）→(2)の並び。B＝`(-3,4)→(-3,-4)`（(3)(4)が等距離で(1)(2)より近い）→(3)の並び。
    *   **重なり**：B＝`(13,4)→(30,0)`で`tolerance = 5`（距離ちょうど5）→`(0,0),(10,0),(30,0)`（まとめた頂点はAの端点`(10,0)`）。同じBで`tolerance = 4.9`→4頂点で`(13,4)`が残る（区間が足される）。Aの始点側（(3)または(4)）でも重なりのまとめ方を1ケース確かめる。
    *   **属性**：A・Bの色・太さが違うとき、結果はAの色・太さ。`id`は`null`。
    *   直線とパス、パスとパス（3頂点以上を含む）でも並びが正しいこと。
    *   結合できない線（閉じたパス・曲線）を含むと`null`。
*   **`planJoin`**：
    *   閉じる：`targetId`が元のid、`keepId`が`true`、`removeIds`が`[]`、`path`が`buildClosedPath`と同じ図形データ。まとめると3頂点未満なら`null`。
    *   2本：`shapes[0]`がA（`targetId = shapes[0].id`・`keepId: false`・`removeIds: [shapes[1].id]`・色と太さが`shapes[0]`）。**2本の並びを入れ替えたケース**で基準の線Aが入れ替わること（重なり順で奥＝配列の先がA）。
    *   受理しない選択（0個・3つ以上・曲線を含む）→`null`。
*   **往復と独立性**：結果のパスの`toJSON()`を`Path.fromJSON`に通すと同じ図形データに戻る（閉じる・2本の結合の両方。`id`は代入してから）。結果の`points`の配列・各頂点が元の図形の`points`（パスの場合）と同じオブジェクトでないこと、結合後に元の図形を`translate`しても結果が変わらないこと、引数の図形の`toJSON()`が呼び出しの前後で変わらないこと。

#### 9-2. `test/core/VectorModel.replaceShape.test.js`（新設）
`VectorModel`の新しい公開操作（モデルへの反映：重なり順の位置・新しいid・Bの除去・選択・通知1回）を確かめる。import：`node:test`・`node:assert/strict`・`../../js/core/VectorModel.js`・`Line`・`Path`。図形一式は`model.replaceAllShapes([...])`（idを直接代入した図形）で入れる。
*   `keepId: false`・`removeIds: [B]`：結果が`targetId`の位置に入り、Bが除かれ、他の図形の前後関係が変わらない。返り値の新しいidが文字列で、置き換え前のどのidとも違う（idの形式は解釈しない）。`shape.id`が返り値と同じ。選択集合が`[新しいid]`。`onChange`の通知が1回。
*   `keepId: true`・`removeIds: []`：`shape.id`が`targetId`と同じ。位置・選択集合・通知1回。
*   `targetId`が存在しない→`null`、図形・選択集合が変わらず通知なし。
*   既に`#shapes`にあるインスタンスを渡す→`null`・`console.warn`1回・変化なし・通知なし。
*   `removeIds`に`targetId`・存在しないidが含まれても、置き換えた位置は残り、例外にならない。
*   ホバー：除いた図形・置き換えた図形（`keepId: false`）をホバー中ならホバーが解除される。`keepId: true`で置き換えた図形をホバー中ならホバーは残る。
*   作成中の図形・選択矩形に触れない（`setSelectionRect`で設定した選択矩形が残る）。

#### 9-3. `test/edit/PathJoiner.test.js`（新設）
注入する`model`（`getShapes`・`isSelected`・`replaceShape`を持つ素のオブジェクト。`replaceShape`は引数を記録して文字列を返す）・`editRecorder`（呼び出しの順序を記録）・`screenLengthToWorld`（引数を記録し、決めた値を返す）は偽物。図形は本物の`Line`・`Path`・`Curve`に`id`を直接代入する。
*   `canJoin`：受理する選択（開いたパス1本・直線2本）で`true`、受理しない選択（0個・直線1本・3本・曲線を含む）で`false`。モデル・記録先のどのメソッドも呼ばない（`getShapes`・`isSelected`の読み取りを除く）。
*   `join`（受理しない選択）：`false`、`beginEdit`・`replaceShape`・`commitEdit`を呼ばない。
*   `join`（閉じる）：`beginEdit` → `replaceShape` → `commitEdit`の順に1回ずつ。`replaceShape`の引数が`(元のid, 閉じたPath, { keepId: true, removeIds: [] })`。`true`を返す。
*   `join`（2本）：`getShapes`の並びで奥の図形がA（`isSelected`の対象を同じにして`getShapes`の並びを入れ替えると`targetId`・`removeIds`が入れ替わる）。`replaceShape`の引数が`(Aのid, 開いたPath, { keepId: false, removeIds: [Bのid] })`。
*   許容距離の換算：`screenLengthToWorld`が`5`（`JOIN_TOLERANCE_SCREEN_PX`）で呼ばれ、その戻り値が重なりの判定に使われる（端点の距離8の2本で、戻り値10なら3頂点・戻り値5なら4頂点）。
*   選択されていない図形は結合の対象にならない（図形3つのうち2つだけ選択→その2つを結合）。
*   `replaceShape`が`null`を返したら`join`は`false`（`beginEdit`・`commitEdit`は1回ずつ呼ばれる）。

#### 9-4. 自動テストにしない部分
ボタン・キー`J`・押せる/押せない状態の同期・`performJoin`のドラッグ中の不受理・`HistoryManager`と組み合わせたUndo/Redo（実体のスナップショットの適用）・描画・保存と開き直し・スプライトの表示は、5章のテストプレイの確認項目で確かめる。

### 要件10: テストプレイの確認項目
5章「テストプレイの確認項目」に列挙する（テストプレイ用のデータは現場設計AIが用意する。実装AIは作成しない）。

### 要件11: 開発資料への記載
*   **結合の規則の記載先**：規則の詳細（端点の組の優先順・まとめ方の手順）の正本は`PathJoinRules.js`のJSDocとする（1ファイルのJSDocで分かることは資料に書かない基準のため）。Phase 05-04が揃えるべき**発注者の決定と使い回しの入口**（基準の線A＝重なり順で奥、Aの向き、色・太さ＝A、2本の結合は新しいid・Aの位置・Bは除く、閉じるはidと位置を保つ、端点の重なり＝画面上5px以内（ちょうどを含む）を結合時の表示倍率でワールドへ換算、自動では閉じない、3本以上は結合しない、使い回す関数と定数）は`PROJECT_ARCHITECTURE.md` 3章に新設する「11. 結合」に書き、モジュールの責務は`_doc/arch/12_shapes.md`（`PathJoinRules.js`）・`_doc/arch/14_edit.md`（`PathJoiner.js`）に書く。
*   反映先の一覧は「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」欄。反映は最終タスク（タスク9）でのみ行う。

### 関連フォルダと論理クラス
*   **対象フォルダ**:
    *   `./js/shapes/` - `PathJoinRules.js`の新設（結合の規則。図形をまたぐ規則という第3の種類）
    *   `./js/edit/` - `PathJoiner.js`の新設（結合の手順。1件の編集操作）
    *   `./js/core/` - `VectorModel.js`（公開操作`replaceShape`の追加）、`KeyboardShortcuts.js`（対応表に1件）
    *   `./js/main.js`・`./index.html` - 配線・ボタン
    *   `./test/shapes/`・`./test/core/`・`./test/edit/` - 自動テスト（3ファイル新設）
*   **関連する論理クラス・モジュール**:
    *   `PathJoinRules`（新設。状態を持たない関数と定数：`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin`）
    *   `PathJoiner`（新設。`canJoin`・`join`）
    *   `VectorModel`（`replaceShape`を追加）
    *   `KeyboardShortcuts`（`SHORTCUT_BINDINGS`に`KeyJ`→`join`、typedef`ShortcutActions`に`join`）
    *   `main.js`（`PathJoiner`の生成と注入、`performJoin`、`syncJoinButtonState`、ボタンのclick、`join`コールバック）
    *   変更しないが関係するもの：`Path`（コンストラクタ・`toJSON`・`fromJSON`）、`Line`（`toJSON`）、`HistoryManager`（`beginEdit`・`commitEdit`）、`SnapshotAdapter`（Undo/Redoの適用・選択集合の復元）、`ViewTransform`（`screenLengthToWorld`）、`InputTracker`（`isDragging`）、`ShapeInserter`（typedef`EditRecorder`の定義元）、`CanvasLibrary`（読み込み中の扱い）

### 参照する責務
*   （`PROJECT_ARCHITECTURE.md` 1章）**依存方向**：`main.js → edit → io → core → shapes`の一方向。`core/`は`io/`をimportしない。`core/`・`io/`は`edit/`をimportしない。`shapes/`：1種類の図形（図形クラス）と、図形クラスだけが使う共通の関数。`edit/`：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。操作モードを知らない。操作モードに依存する判定・処理は中立な注入関数で受け取る。`test/`：依存は`test/ → js/`の一方向。
*   （`PROJECT_ARCHITECTURE.md` 2章）**図形データ**：全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`。`path`は`{ type: 'path', id, points, closed, segments: [{ kind: 'line' }, ...], strokeColor, strokeWidth }`、区間の要素数は開いた`n - 1`・閉じた`n`、頂点数の下限は開いた2・閉じた3。`Line`も`points`2点＝[始点, 終点]で表す。**選択集合**は`VectorModel`が保持し、常に現存図形のidのみ・選択モード以外では空（不変条件）。図形の座標はすべてワールド座標。
*   （`PROJECT_ARCHITECTURE.md` 3章冒頭）**同期の経路**：再描画・UI同期は既存の経路（`model.onChange`等）のみ。機能専用の再描画・同期処理を足さない。
*   （同3章1.）**読み込み完了前の操作**：覆い要素がマウス入力を遮る。キーボードショートカットとフロートウィンドウ上のボタンは働く。読み込み中は図形0個・クリップボード空・履歴空。図形一式を変える操作を新しく足す場合は読み込み中の扱いが要る（本計画では要件1で確認済み）。
*   （同3章3.）**キーボード操作**：`Space`以外のキーは`KeyboardShortcuts`が担当。操作の実体は`main.js`から注入されたコールバックで実行する。
*   （同3章6.）**履歴**：変更処理を`HistoryManager.beginEdit()`と`commitEdit()`で挟む。前後の作業データ部分の`JSON.stringify`が一致する場合は記録しない。Undo/Redoの適用は`SnapshotAdapter.restore`→`DocumentSerializer.deserialize`→`model.replaceAllShapes`→`shouldRestoreSelection()`が真のときのみ`setSelection(snapshot.selectedIds)`。適用後の選択集合は記録時点のもの（前＝操作開始時、後＝操作完了時）。
*   （`_doc/arch/02_main.md`）**main.js**：インスタンス化・依存の注入・イベントバインドと連携のみ。判定ロジック・作業データの中身の解釈を持たない。配線ブロック`// 6.`はコントロールパネルの配線（ビュー・削除・取り消し/やり直しのボタンと表示同期）。**同一経路の原則**：取り消し・やり直しのボタンとショートカットは`performUndo()`/`performRedo()`を呼ぶのみ、削除ボタンとショートカットは`inputTracker.deleteSelection()`を呼ぶのみ。**押せる/押せない状態**は`model.onChange`等に登録し、**起動時の同期**として初期化の最後に各表示の同期関数を明示的に1回ずつ呼ぶ。**キーボードショートカットのコールバック**：戻り値の意味はtypedef`ShortcutActions`を正とする。ボタン等ショートカット以外から呼ぶ場合は呼び出し側でドラッグ中の判定が必要。行数538行（配線を追加する場合は配線ブロックの切り出しを検討）。
*   （`_doc/arch/03_VectorModel.md`）**VectorModel.js**：Shape配列と選択集合・ホバー・作成中図形・選択矩形のSSOT。知らないこと：図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式。図形idの採番（`shape-<連番>`）は1箇所に一本化し、id形式の知識は`VectorModel`内に閉じる。単一選択は`setSelection([id])`。（実コード）状態を変える操作は変更後に通知し、複数件の変更でも通知は1回。採番はすべて`#issueId()`を経由する。
*   （`_doc/arch/07_KeyboardShortcuts.md`）**KeyboardShortcuts.js**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と受理判定のみ。新しいショートカットは対応表へのエントリ追加（＋必要なら注入コールバックの追加）。Shift規則は必ず`ShiftRule`の値を指定する。コンストラクタで全action名の注入を検証し、欠落時は`Error`をthrowする（対応表に`join`を足す前に`main.js`が`join`を注入しておけば起動は壊れない）。ショートカット専用のUI同期・再描画は持たない。
*   （`_doc/arch/08_HistoryManager.md`）**HistoryManager.js**：`beginEdit`/`commitEdit`の呼び出し元は`InputTracker`・`main.js`（`?dev`の復元）・`ShapeInserter`。`InputTracker`・`ShapeInserter`へは`EditRecorder`として注入され、`HistoryManager.js`をimportしない。
*   （`_doc/arch/12_shapes.md`）**shapes/**：図形クラスが扱う座標はすべてワールド座標。共通基底クラスは無い。共通モジュール（`ShapeGeometry.js`・`ShapeDataValidation.js`）は状態を持たない`export`した関数のみで、`import`するのは`shapes/`の図形クラスのみ。各図形クラス・`ShapeFactory`は`try/catch`を持たない。**Path.js**：`ShapeFactory.create`では作られない（作る操作はPhase 05-03・05-04）。コンストラクタは引数を検証しない（頂点を複製し、区間を頂点数から作る）。区間の要素数の不変条件は、閉じる操作等を足すときに保つこと。`toJSON`/`fromJSON`はどちらの方向でも内部配列・頂点オブジェクトを共有しない。
*   （`_doc/arch/10_ShapeFactory.md`）`shapes/`は`ShapeFactory`・`core/`をimportしない。
*   （`_doc/arch/14_edit.md`）**edit/**：知らないこと（全クラス共通）：DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、操作モード。`InputTracker`に依存しない。依存：importは`DocumentSerializer`のみ（`CanvasFileOperations`は例外）。他の依存は注入で受け取る。**ShapeInserter.js**：履歴へは1件以上追加した場合のみ1件記録する。進行中の入力操作の中断・モード切り替えは行わない（呼び出し側の責務）。
*   （`_doc/arch/01_index_html.md`）**index.html**：ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`で表す。各ボタンの`title`属性にショートカットキーを併記し、`SHORTCUT_BINDINGS`と手動で同期する。`#window-shape-palette`の`top`はコントロールパネルの下端との余白24px以上を確保するための固定値（コントロールパネルの高さを変える場合は手動で再調整）。
*   （`_doc/COWORK_STATUS.md` 2章C）**`InputTracker`の肥大化防止**：状態に依存しない操作をショートカット用に足す場合は`InputTracker`へ入れず、`main.js`の注入コールバック側か別クラスへ置く。**コントロールパネルの高さ**：ボタン・行をさらに追加すると図形パレットと重なる（余白は計算上約29px）。**キー割り当ての手動同期**：ボタンの`title`と`SHORTCUT_BINDINGS`。
*   （`_doc/arch/16_test.md`）`node:test`・`node:assert/strict`のみで書き、プロジェクトのルートの`node --test`で実行する。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。共有の補助モジュールを置かず、補助関数は各テストファイルの中に書く。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc（`@param`・`@returns`）。公開APIのみを通す。テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える。図形の`id`は`VectorModel`を使わず、公開プロパティ`id`へ文字列を直接代入する。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   **`PROJECT_ARCHITECTURE.md` 1章 フォルダ構成**：
    *   `js/shapes/`に`PathJoinRules.js`を足す（`ShapeDataValidation.js`の後。注記「図形をまたぐ規則（結合）。`shapes/`の外から使う」）。
    *   `js/edit/`に`PathJoiner.js`を足す（`ShapeInserter.js`の後）。
    *   `test/`に`core/VectorModel.replaceShape.test.js`・`shapes/PathJoinRules.test.js`・`edit/PathJoiner.test.js`を足す。
*   **`PROJECT_ARCHITECTURE.md` 1章 フォルダ分割の方針**：`shapes/`に第3の種類「図形をまたぐ規則（`PathJoinRules`。結合の規則）」を足す。**依存方向**に「`edit/PathJoiner`は例外として`shapes/PathJoinRules`をimportする（下向き）」を足す。
*   **`PROJECT_ARCHITECTURE.md` 3章**：
    *   1.「読み込み完了前の操作」：結合は読み込み中は図形0個・選択集合が空のため何もしない（専用の判定は無い）ことを足す。
    *   3.「キーボード操作」の注入コールバックの列挙に`performJoin`を足す。
    *   6.「記録する操作と時点」に「結合（結合ボタン・`J`）：`PathJoiner.join`で、`model.replaceShape`の前後。結合できない選択では記録しない」を足す。
    *   **11. 結合**（新設）：流れ（ボタン`#selection-join`／`J` → `main.js`の`performJoin()`（ドラッグ中は不受理）→ `PathJoiner.join()` → `PathJoinRules.planJoin(重なり順の選択図形, 画面上5pxのワールド換算)` → `beginEdit` → `model.replaceShape` → `commitEdit`）、押せる/押せないの同期（`model.onChange`の`syncJoinButtonState`、`canJoin`は表示倍率を見ない）、発注者の決定（基準の線A＝重なり順で奥・Aの向き・色と太さ＝A・2本の結合は新しいidでAの位置・Bは除く・閉じるはidと位置を保つ・端点の重なりは画面上5px以内（ちょうどを含む）を結合時の表示倍率でワールドへ換算・結合後は結果だけを選択）、やらないこと（自動で閉じない・3本以上・曲線/矩形/円/弧/閉じたパスの結合・閉じたパスを開く）、規則の詳細の正本は`PathJoinRules.js`のJSDoc、Phase 05-04は`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`buildJoinedPath`・`buildClosedPath`を使い回して結果の扱いを揃えること。
*   **`_doc/arch/12_shapes.md`**：冒頭の共通モジュールの記述の後に**PathJoinRules.js**の節を足す（図形をまたぐ規則。公開：`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin`。読むのは`type`と`toJSON()`の図形データだけで図形クラスの内部プロパティを読まない。importは`./Path.js`のみ（共通モジュールはimportしない）。importするのは`shapes/`の外（`edit/PathJoiner`、Phase 05-04では`core/`からも可）。知らないこと：表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。`JOIN_TOLERANCE_SCREEN_PX`と`InputTracker`の`hitTolerance`は同じ5pxだが別の定義）。`Path.js`の節の「作る操作はPhase 05-03・05-04」を「結合（`PathJoinRules`がコンストラクタで作る）と05-04」に改める。
*   **`_doc/arch/14_edit.md`**：**PathJoiner.js**の節を足す（責務、公開メソッド`canJoin`・`join`、呼び出し元は`main.js`（`performJoin`・`syncJoinButtonState`）、`model`は`getShapes`・`isSelected`・`replaceShape`のみ使う、契約：結合できない選択では何もせず記録しない・1件の記録・ドラッグ中でないことは呼び出し側の責務・進行中の入力操作の中断とモード切り替えを行わない、`screenLengthToWorld`の注入）。**依存**の項に`PathJoiner`の例外（`shapes/PathJoinRules`のみをimport）を足す。
*   **`_doc/arch/03_VectorModel.md`**：公開メソッドの一覧に`replaceShape`を足す（図形の位置での差し替え・指定の図形の除去・結果だけの選択・通知1回、`keepId`で同じidを保つか`#issueId()`で新しいidを採番。呼び出し元は`PathJoiner`）。
*   **`_doc/arch/02_main.md`**：主な関数に`performJoin`・`syncJoinButtonState`を足す。配線ブロック`// 6.`の内容に「結合（`PathJoiner`の生成・`performJoin`・ボタンと表示同期）」を足す。注入の一覧に`PathJoiner`（`model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`＝`(length) => viewTransform.screenLengthToWorld(length)`）と、`KeyboardShortcuts`のコールバックに`join`を足す。同一経路の原則に「結合ボタンとショートカットは`performJoin()`を呼ぶのみ（`pathJoiner.join()`を直接呼ばない。ドラッグ中の判定は`performJoin`）」を足す。押せる/押せない状態に結合ボタン（`canJoin()`、`model.onChange`）を足す。行数を実際の値に改める。
*   **`_doc/arch/07_KeyboardShortcuts.md`**：`KeyJ`→`join`（修飾キーなし・`Shift`不可・キーリピートでは実行しない・結合した場合のみ`true`）を足し、`Shift`+`J`も予約に含めるか判断して書く。
*   **`_doc/arch/08_HistoryManager.md`**：`beginEdit`/`commitEdit`の呼び出し元に`PathJoiner`（結合。`EditRecorder`として注入され`HistoryManager.js`をimportしない）を足す。
*   **`_doc/arch/01_index_html.md`**：コントロールパネルの「削除」「結合」を`.selection-button-row`で1行に横並びにしていること（コントロールパネルの高さを増やさないため）、結合ボタンの`title`のショートカット併記を足す。
*   **`_doc/arch/16_test.md`**：「既存のテストファイルと検証範囲」に`test/shapes/PathJoinRules.test.js`（9-1の観点）・`test/core/VectorModel.replaceShape.test.js`（9-2）・`test/edit/PathJoiner.test.js`（9-3）を足す。ボタン・キー・描画・保存はテストプレイで確かめることを「テストできない箇所」に足すか判断する（Undo/Redoの実体は下記のとおり一部が自動テスト化されたため、「テストできない箇所」の記述をそれに合わせて調整する）。
    *   （タスク4で判明）`test/edit/PathJoiner.test.js`の実物の組み合わせテスト（実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`PathJoiner`）で、結合のUndo/Redoの往復（履歴1件、`canUndo`/`canRedo`、`shouldRestoreSelection`の真偽による選択集合の復元）が自動テストで確かめられる。9-4の「Undo/Redoの実体は自動テストにしない」はその範囲で覆される。
    *   （タスク4で判明）このテストは、`16_test.md`の規則「注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える」の例外である。理由は、REQ要件9とタスク4の追加仕様で、履歴の手順をNodeで組み合わせて確かめるため。`HistoryManager`はimportを持たず、`SnapshotAdapter`のimportは`DocumentSerializer`のみでブラウザのAPIに依存しない。タスク9で、規則の記述にこの例外（実物の組み合わせテストを置くこと、その条件）を書く。
*   （各タスクの実行時に影響が判明した場合は、この欄へ追記する。資料本体への反映はタスク9で行う。）

## 3. タスクリスト
*   [x] タスク1: 結合の規則`PathJoinRules`の新設
    *   **対象ファイル** :
        *   `./js/shapes/PathJoinRules.js` :（新規）
    *   **作業内容** :
        *   2章要件1〜4のとおり、状態を持たない`export`の関数と定数（`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin`）とtypedef`JoinPlan`を作る。クラスにしない。importは`./Path.js`のみ。図形の読み取りは`type`と`toJSON()`だけで行い、`Line`の内部プロパティを読まない。表示倍率・`ViewTransform`・`VectorModel`を知らない。`try/catch`を持たない。引数の図形を書き換えない。
        *   端点の組の優先順は要件3の表のとおり（距離が厳密に小さいときだけ更新）。重なりは`距離 <= tolerance`。結果のパスは`new Path(points, closed, strokeColor, strokeWidth)`で作る（`id`は`null`のまま）。
        *   JSDoc：先頭行に単一責務JSDoc（3行以内。要件4の案）、各定数・関数・補助関数・typedefにJSDoc（`@param`・`@returns`。前提と`null`を返す条件、`shapes`が重なり順で奥が先であること、`tolerance`がワールド座標の長さであること、端点の組の優先順と並べ方、Phase 05-04が使い回す入口であること）。
        *   既存のファイルは変更しない。`node --test`を実行し、`fail 0`と件数を4章の本タスクの欄へ記録する（テストを足さないため件数は計画時点の498のまま）。
        *   開発資料への影響は2章の更新予定欄へ追記し（資料本体は修正しない）、迷った点・Phase 05-04が使い回すときの注意は5章へ追記する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する。
*   [x] タスク2: 結合の規則のテストの新設
    *   **対象ファイル** :
        *   `./test/shapes/PathJoinRules.test.js` :（新規）
        *   `./js/shapes/PathJoinRules.js` :（テストで誤りが見つかった場合のみ修正）
    *   **作業内容** :
        *   2章要件9の9-1の観点をすべて書く（観点は最低限で、実コードを読んで足してよい）。距離の境界は3・4・5の直角三角形（距離ちょうど5）で浮動小数の誤差なく確かめる。
        *   テストが失敗した場合は、計画（要件1〜4）と`PathJoinRules.js`のどちらが誤りかを確かめ、テストを計画からずらして通さない（ソースの誤りならタスク1の範囲の誤りとして5章に記録したうえで直してよい）。
        *   先頭行に単一責務JSDoc（3行以内）、補助関数にJSDoc（`@param`・`@returns`）を書く。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [x] タスク3: `VectorModel`への公開操作`replaceShape`の追加とそのテスト
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`replaceShape`の追加と`#issueId`・`#nextId`のJSDocの列挙のみ）
        *   `./test/core/VectorModel.replaceShape.test.js` :（新規）
    *   **作業内容** :
        *   2章要件7の7-3のとおり`replaceShape(targetId, shape, { keepId = false, removeIds = [] } = {})`を足す。図形種別・頂点に触れない（`id`の代入のみ）。id採番は`#issueId()`。通知は変化があったときだけ1回。既存の公開メソッドの処理は変えない。`ShapeFactory`以外のimportを足さない。
        *   JSDoc：`replaceShape`の説明（手順(1)〜(6)・前提・`console.warn`の条件・インスタンスの`id`を書き換えること）、`@param`（`options.keepId`・`options.removeIds`を含む）・`@returns`。`#issueId`・`#nextId`のJSDocの採番する操作の列挙に`replaceShape`を足す。先頭行の責務JSDocは変えない。
        *   `test/core/VectorModel.replaceShape.test.js`に9-2の観点を書く（先頭行に単一責務JSDoc、補助関数にJSDoc）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [x] タスク4: 結合の手順`PathJoiner`の新設とそのテスト
    *   **対象ファイル** :
        *   `./js/edit/PathJoiner.js` :（新規）
        *   `./test/edit/PathJoiner.test.js` :（新規）
    *   **作業内容** :
        *   2章要件7の7-2のとおり`PathJoiner`クラス（`constructor({ model, editRecorder, screenLengthToWorld })`・`canJoin()`・`join()`）を作る。importは`../shapes/PathJoinRules.js`のみ。図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードを持たない。DOMに触れない。`try/catch`を持たない。`editRecorder`の型はJSDocの`import('./ShapeInserter.js').EditRecorder`で参照する（typedefを新しく定義しない）。
        *   JSDoc：先頭行に単一責務JSDoc（3行以内。7-2の案）、クラスJSDoc（依存の制約・前提（呼び出し側の責務））、privateフィールド・コンストラクタ（`@param`）・各メソッド（処理順・`@returns`）・補助メソッド。
        *   `test/edit/PathJoiner.test.js`に9-3の観点を書く（先頭行に単一責務JSDoc、補助関数にJSDoc）。
        *   `main.js`・`index.html`は変更しない（本タスクの時点では`PathJoiner`はどこからも使われない）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [x] タスク5: コントロールパネルへの「結合」ボタンの追加
    *   **対象ファイル** :
        *   `./index.html` :（更新。結合ボタンとその行の見た目のみ）
    *   **作業内容** :
        *   2章要件5のとおり、`#selection-delete`を`<div class="selection-button-row">`で包み、その中の削除ボタンの右に`<button type="button" id="selection-join" class="tool-btn" title="選択中の線を結合 (J)" disabled>🔗 結合</button>`を置く。削除ボタンの属性・表示文字列は変えない。
        *   `<style>`に`.selection-button-row`（`display: flex; gap: 8px;`）と`.selection-button-row .tool-btn`（`flex: 1; text-align: center; white-space: nowrap;`）を、`.history-button-row`の規則の直後に新しい規則として足す。CSSコメントで「削除・結合の2ボタンを1行に横並び（コントロールパネルの高さを増やさないため。取り消し・やり直しの行と同じ見た目）」を書く。既存の規則（`.history-button-row`・`#window-shape-palette`の`top`とそのコメント等）は変えない。
        *   本タスクの時点では`main.js`が配線しないため、ボタンは`disabled`のまま押せない（起動は壊れない）。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク6: `main.js`の配線（`PathJoiner`の生成・`performJoin`・ボタンと押せる状態の同期・`join`コールバックの注入）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新。配線のみ）
    *   **作業内容** :
        *   `import { PathJoiner } from './edit/PathJoiner.js';`を足す。
        *   配線ブロック`// 6.`の削除ボタンの配線の後に、次を置く（結合の規則・手順の本体を書かない）：
            *   `const pathJoiner = new PathJoiner({ model, editRecorder: historyManager, screenLengthToWorld: (length) => viewTransform.screenLengthToWorld(length) });`
            *   `const joinSelectionBtn = document.getElementById('selection-join');`
            *   `function performJoin()`：(1) `inputTracker.isDragging()`なら`false`。(2) `return pathJoiner.join();`。JSDoc（ボタンとキー`J`の共通経路であること、ドラッグ中の不受理の理由（ボタンはショートカット以外の呼び出し元のため）、`@returns`）。
            *   `function syncJoinButtonState()`：`joinSelectionBtn.disabled = !pathJoiner.canJoin();`。JSDoc（`model.onChange`に登録し起動時に1回呼ぶこと、表示倍率を見ないこと、DOM更新は`main.js`が担うこと）。
            *   `model.onChange(syncJoinButtonState);`と`joinSelectionBtn.addEventListener('click', () => performJoin());`（コメント：受理条件の判定と結合は`performJoin`→`pathJoiner.join()`のみ。キー`J`と同一経路）。
        *   `// 8.`の`KeyboardShortcuts`のコールバックに`join: performJoin,`を`deleteSelection`の後に足す（コメント：結合ボタンと同一経路。結合した場合のみtrue）。対応表への追加はタスク7（注入が先なので起動は壊れない）。
        *   起動時の同期の`syncDeleteButtonState();`の直後に`syncJoinButtonState();`を足す（コメント：削除ボタンと同様に、`index.html`の初期`disabled`や通知に依存させない）。
        *   既存の配線・関数・コメントは変えない。`// 6.`の冒頭のコメントに結合を足す程度の最小の追記はよい。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響（`main.js`の行数を含む）は2章、迷った点は5章へ）。
*   [ ] タスク7: `KeyboardShortcuts`の対応表へのキー`J`の追加
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` :（更新。対応表への1件の追加とそのJSDocのみ）
    *   **作業内容** :
        *   `SHORTCUT_BINDINGS`の`deleteSelection`のエントリの直後に`{ codes: ['KeyJ'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'join' },`を足す（必要なら直前に1行のコメント：選択中の線の結合。キーリピートでは実行しない）。
        *   typedef`ShortcutActions`に`@property {() => boolean} join 選択中の線を結合する（開いたパス1本を閉じる・2本を1本の開いたパスにする）。結合した場合のみtrue（結合できない選択ではfalse）`を足す。
        *   `#handleKeyDown`・`#findBinding`・他のエントリ・判定の規則は変えない。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する（件数は変わらない）。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（開発資料への影響は2章、迷った点は5章へ）。
*   [ ] タスク8: JSDocの確認とRESの完成
    *   **対象ファイル** :
        *   本作業で新設・変更したファイル（`./js/shapes/PathJoinRules.js`・`./js/edit/PathJoiner.js`・`./js/core/VectorModel.js`・`./js/main.js`・`./js/core/KeyboardShortcuts.js`・3つのテストファイル）:（JSDocの記載漏れがあった場合のみ修正）
        *   本RES :（更新）
    *   **作業内容** :
        *   新設ファイルの先頭行の単一責務JSDoc（3行以内）、各関数・メソッド・クラス・typedef・定数のJSDoc（`@param`・`@returns`・該当すれば`@throws`）、変更した既存の関数・コールバック（`VectorModel`の`#issueId`・`#nextId`、`main.js`の追加分、`ShortcutActions`）のJSDocに漏れがないことを確かめ、漏れがあればJSDocだけを直す（処理は変えない）。
        *   `index.html`のボタンの`title`（`(J)`）と`SHORTCUT_BINDINGS`の`KeyJ`が一致していることを確かめる。
        *   `node --test`を実行し、`fail 0`と件数を4章へ記録する。
        *   4章の全タスクの欄が記入済みであること、2章の更新予定欄・5章が最新であることを確かめ、RESを完成させる。完了時に本タスクを [x] にする。
*   [ ] タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/01_index_html.md`・`./_doc/arch/02_main.md`・`./_doc/arch/03_VectorModel.md`・`./_doc/arch/07_KeyboardShortcuts.md`・`./_doc/arch/08_HistoryManager.md`・`./_doc/arch/12_shapes.md`・`./_doc/arch/14_edit.md`・`./_doc/arch/16_test.md` :（更新）
    *   **作業内容** :
        *   2章「開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定」欄（各タスクで追記された分を含む）を確かめ、資料へ反映する。記載先と内容は`PROJECT_ARCHITECTURE.md`冒頭の記載基準に従う（1ファイルのJSDocで分かること（引数・戻り値・定数の値・1クラス内の処理順）は書かず、責務・知らないこと・依存方向・モジュールをまたぐ流れ・誰が呼ぶか/注入するか・設計判断の理由・やらないと決めたこと・公開メソッド名の一覧を書く）。新しいモジュールは各フォルダのファイル（`12_shapes.md`・`14_edit.md`）に節を足す（4章の一覧の行はフォルダ単位のため足さない）。
        *   反映の前に実コードを読み、更新予定欄の記述と実装が食い違う箇所は実装に合わせる（食い違いは5章に記録する）。
        *   ※ 実装AIによる開発資料の書き換えは原則禁止であるが、**この最終タスクのみ明示的な例外とする**（後続タスクが存在せず、資料の変更によって他タスクの前提が動く危険がないため）。
        *   コードは変更しない。`node --test`を実行し、`fail 0`と件数を4章へ記録する。完了時に本タスクを [x] にし、4章の本タスクの欄を記入する（反映での判断・注意は5章へ）。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 結合の規則`PathJoinRules`の新設
*   **対象ファイル** : `./js/shapes/PathJoinRules.js`（新規）
*   **作業内容** :
    *   `JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin`とtypedef`JoinPlan`を、状態を持たない`export`の関数・定数として作成。importは`./Path.js`のみ。図形の読み取りは`type`と`toJSON()`のみ。
    *   追加仕様：`classifyJoin`は図形の数（1または2）を先に判定し、合わなければ`toJSON()`を呼ばず`null`。2つの場合も`type`で`line`/`path`以外を先に除外してから`toJSON()`を呼ぶ。1つの場合は`type !== 'path'`なら`toJSON()`を呼ばない。理由をJSDocに記載。判定結果は計画の表のとおり。
    *   `node --test`：tests 498 / pass 498 / fail 0。
    *   開発資料への影響：新規ファイル`shapes/PathJoinRules.js`（第3の種類「図形をまたぐ規則」）の追加。資料本体は未修正（計画2章のとおりタスク9で反映）。

### タスク2: 結合の規則のテストの新設
*   **対象ファイル** : `./test/shapes/PathJoinRules.test.js`（新規）。`PathJoinRules.js`は変更なし（テストで誤りは見つからなかった）。
*   **作業内容** :
    *   要件9の9-1の観点をすべて書いた（`JOIN_TOLERANCE_SCREEN_PX`・`classifyJoin`・`isJoinableLine`・`buildClosedPath`・`buildJoinedPath`（(1)〜(4)・優先順3ケース・重なり（3-4-5の直角三角形で距離ちょうど5と4.9、Aの始点側(3)(4)も）・属性・直線/パスの組み合わせ・結合できない線・両端が重なっても閉じない）・`planJoin`（閉じる・2本・並び入れ替え・受理しない選択）・往復と独立性）。実コードを読んで、`JOIN_TOLERANCE_SCREEN_PX`が5であること、両端が重なっても閉じないことを足した。
    *   先頭行に単一責務JSDoc、補助関数にJSDocを記述。公開APIのみ使用、`id`は公開プロパティへ文字列を直接代入。
    *   `node --test`：tests 542 / pass 542 / fail 0（498 + 新規44）。
    *   開発資料への影響：新規テストファイル`test/shapes/PathJoinRules.test.js`の追加（2章の更新予定欄の`16_test.md`・フォルダ構成の記述に既に含まれる。追記なし）。

### タスク3: `VectorModel`への公開操作`replaceShape`の追加とそのテスト
*   **対象ファイル** : `./js/core/VectorModel.js`（更新）、`./test/core/VectorModel.replaceShape.test.js`（新規）
*   **作業内容** :
    *   `replaceShape(targetId, shape, { keepId = false, removeIds = [] } = {})`を要件7-3の手順(1)〜(6)どおり追加。targetId不在→null、既存インスタンス→console.warnのうえnull（どちらも`shape.id`を書き換えず、通知なし）。`#issueId`・`#nextId`のJSDocの採番する操作の列挙に`replaceShape`を追記。importは追加なし、既存メソッドは未変更。
    *   `test/core/VectorModel.replaceShape.test.js`に9-2の観点（keepId偽/真・targetId不在・既存インスタンス・removeIdsにtargetId/存在しないid・ホバー解除/維持・選択矩形不変）を記述。
    *   `node --test`：tests 551 / pass 551 / fail 0（542 + 新規9）。
    *   開発資料への影響：更新予定欄の`03_VectorModel.md`・`16_test.md`の記述で足りる（追記なし）。

### タスク4: 結合の手順`PathJoiner`の新設とそのテスト
*   **対象ファイル** : `./js/edit/PathJoiner.js`（新規）、`./test/edit/PathJoiner.test.js`（新規）
*   **作業内容** :
    *   `PathJoiner`（`constructor({ model, editRecorder, screenLengthToWorld })`・`canJoin()`・`join()`）を要件7-2どおり作成。importは`../shapes/PathJoinRules.js`のみ。`editRecorder`の型は`import('./ShapeInserter.js').EditRecorder`で参照。
    *   `test/edit/PathJoiner.test.js`に9-3の観点（偽のmodel・editRecorder）を書いた。追加仕様として、実物の`VectorModel`・`SnapshotAdapter`・`HistoryManager`・`PathJoiner`を組み合わせたケースを追加：2本の結合（間に別の図形）のundo/redo往復（履歴1件を`canUndo`/`canRedo`で確認）、開いたパス1本を閉じるundo/redo往復、`shouldRestoreSelection`の真偽による選択集合の復元結果、結合できない選択で履歴が増えないこと。ソース（`VectorModel`・`SnapshotAdapter`・`HistoryManager`）は未変更。
    *   `node --test`：tests 563 / pass 563 / fail 0（551 + 新規12）。
    *   開発資料への影響：更新予定欄の`14_edit.md`・`16_test.md`の記述で足りる。`16_test.md`の「テストできない箇所」は、Undo/Redoの実体の一部が自動テスト化されたため（`HistoryManager`と`SnapshotAdapter`の組み合わせ）、タスク9で記述を調整すること。資料本体は未修正。
    *   監査指摘の修正：2章の`16_test.md`の項に、実物の組み合わせテストの内容と規則（注入される依存は偽物）の例外を追記。`test/edit/PathJoiner.test.js`を締め直し：`screenLengthToWorld`の呼び出しを`[5]`の厳密比較に（実装は計画前に必ず1回呼ぶため、受理しない選択でも1回）、`canJoin`が受理する選択（閉じる・2本）でも記録`calls`が空であることを確認。`node --test`：tests 563 / pass 563 / fail 0。

### タスク5: コントロールパネルへの「結合」ボタンの追加
*   **対象ファイル** : `./index.html`（更新）
*   **作業内容** :
    *   `#selection-delete`を`<div class="selection-button-row">`で包み、その右に`<button type="button" id="selection-join" class="tool-btn" title="選択中の線を結合 (J)" disabled>🔗 結合</button>`を追加。削除ボタンの属性・表示文字列は未変更。
    *   `<style>`の`.history-button-row .tool-btn`の規則の直後に`.selection-button-row`（`display: flex; gap: 8px;`）と`.selection-button-row .tool-btn`（`flex: 1; text-align: center; white-space: nowrap;`）を新規追加（CSSコメント付き）。既存の規則は未変更。
    *   `main.js`が未配線のため結合ボタンは`disabled`のまま。
    *   `node --test`：tests 563 / pass 563 / fail 0（件数変化なし）。
    *   開発資料への影響：更新予定欄の`01_index_html.md`の記述で足りる（追記なし）。目視確認推奨：削除・結合が1行に並び、`#window-shape-palette`との余白が保たれていること。

### タスク6: `main.js`の配線（`PathJoiner`の生成・`performJoin`・ボタンと押せる状態の同期・`join`コールバックの注入）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク7: `KeyboardShortcuts`の対応表へのキー`J`の追加
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク8: JSDocの確認とRESの完成
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク9: 開発資料（`PROJECT_ARCHITECTURE.md`）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント

### 計画時の確認・判断
*   **スコープ**：変更対象はREQの「スコープの厳守」の範囲内（`index.html`・`main.js`・`KeyboardShortcuts.js`・新設`shapes/PathJoinRules.js`・新設`edit/PathJoiner.js`・`VectorModel.js`・テスト3ファイルの新設、最終タスクの資料）。既存の図形クラス・`ShapeFactory`・`InputTracker`の変更は不要と判断した。`test/core/VectorModel.replaceShape.test.js`は要件9の「モデルへの反映の手順の自動テスト（重なり順の位置・新しいid・Bの除去・選択）」に当たるものとして新設する。
*   **`edit/`から`shapes/`へのimport**：`PathJoiner`だけの例外として資料に書く（`edit/`の「importは`DocumentSerializer`のみ」の原則に、`CanvasFileOperations`と同じ形の例外を足す）。向きは下向きで循環はない（`PathJoinRules`は`Path`だけを、`Path`は共通モジュールだけをimportする）。
*   **`performJoin`のドラッグ中の判定**：REQは「ボタンはドラッグ中に押せない」とするが、中ボタンのパン中に左クリックでボタンを押せる可能性があり、資料（`02_main.md`）も「ボタン等ショートカット以外から呼ぶ場合は呼び出し側でドラッグ中の判定が必要」としているため、`performUndo`と同じ形で`main.js`に置いた。キーは`KeyboardShortcuts`の手順4で先に止まるため、キーの振る舞いは変わらない。
*   **`replaceAllShapes`を流用しない理由**：要件7の7-3のとおり（JSDocの用途外・選択集合等のクリア・通知2回）。
*   **閉じる操作でインスタンスを差し替えること**：`Path`を変更しない（区間を足すメソッドを持たない）ため、同じidの新しい`Path`で差し替える。履歴はスナップショット（図形データ）で比較・適用するため、インスタンスが変わっても影響しない。
*   **`JOIN_TOLERANCE_SCREEN_PX`と`InputTracker.hitTolerance`**：どちらも5pxだが別の定義（`InputTracker`を変更しないため統一しない）。どちらかを変えても他方は変わらない。
*   **`main.js`の行数**：538行に約30行足す。資料は「配線を追加する場合は配線ブロック（`// 7.6.`）の切り出しを検討」としているが、本作業は`// 6.`への小さな追加のため切り出さない（切り出しは別のREQで扱う）。
*   **タスク1実装時の注意**：`isJoinableLine`は`type==='path'`のとき`toJSON()`を呼ぶ（`Line`は`toJSON()`なしで真）。`buildJoinedPath`の端点の組は距離が厳密に小さいときだけ更新（同距離は先の組を維持）。`buildClosedPath`は`planJoin`経由では`classifyJoin`の後に再度`toJSON()`を呼ぶ（選択操作時のみで負荷は小さいと判断）。Phase 05-04が使うときも`tolerance`はワールド座標の長さで渡すこと。
*   **削除ボタンの見た目の変化**：削除ボタンは1行全体の左寄せから、行の半分の幅・中央寄せになる（要件5の「同じ行に並べる」による。属性・動作は変わらない）。

### Phase 05-04が結合の規則を使い回すときの注意
*   結果の扱い（重なりの距離・色と太さ・向き・重なり順・id）を揃えるには、`PathJoinRules`の`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`buildJoinedPath`・`buildClosedPath`を使い、同じ規則を別の場所に書き直さないこと。
*   `buildJoinedPath(a, b, tolerance)`の`a`が基準の線（結果の向き・色・太さ・位置の元）である。描き足しで「既存の線」と「描いている線」をつなぐとき、どちらを`a`にするか（重なり順で奥＝既存の線になる見込み）は05-04のREQで決めること。
*   `buildJoinedPath`はいちばん近い端点の組を自分で選ぶ。05-04で「吸い付いた端点」を指定してつなぐ必要がある場合（近い組と吸い付いた組が違う場合がある）は、規則の関数に端点を指定する入口を足す必要がある（本作業では作らない）。
*   規則の関数は表示倍率を知らない。05-04でも`JOIN_TOLERANCE_SCREEN_PX`を呼び出し側で表示倍率によりワールドへ換算して渡すこと。

### テストプレイの確認項目（操作手順と期待する結果）
テストプレイ用のパス・作業データファイル（頂点2つのパス、閉じたパス、色・太さの違う線、始点と終点が近い開いたパス等）は現場設計AIが用意する（リポジトリには含めない）。
1.  **開いたパスを閉じる**：直線2本を結合して作った頂点3つ以上の開いたパス（または用意したデータ）を選び「結合」を押す → 終点から始点への区間が描かれ、閉じた形になる。ハンドルの数（頂点の数）は変わらない。そのパスだけが選択されたまま。
2.  **始点と終点が近いパスを閉じる**：始点と終点が画面上5px以内の開いたパスを閉じる → 頂点が1つ減って閉じる（短い閉じる区間ができない）。頂点3つで始点と終点が5px以内のパスでは、ボタンは押せるが押しても何も起きない（取り消しボタンの状態も変わらない）。
3.  **頂点2つの線1本**：直線1本・頂点2つのパス1本を選ぶ → 結合ボタンは押せない。`J`を押しても何も起きない。
4.  **直線2本（端点が重なる）**：1本目の直線の終点付近（画面上5px以内）から2本目を描き、2本を範囲選択して「結合」→ 1本のパスになり、ハンドルは3つ（つないだ点は1つ）。つないだ頂点の位置は奥（先に描いた）の直線の端点。
5.  **直線2本（離れている）**：離れた2本を選んで結合 → いちばん近い端点どうしが直線の区間でつながった1本のパスになり、ハンドルは4つ。
6.  **直線とパス・パス2本**：直線と開いたパス、開いたパス2本をそれぞれ結合 → 1本の開いたパスになる。結果の両端が重なっていても閉じない（もう一度「結合」で閉じられる）。
7.  **結合できない選択**：3本以上・曲線・矩形・円・弧・閉じたパスを含む選択、何も選んでいない状態 → ボタンは押せない、`J`で何も起きない、図形・選択が変わらず、コンソールにエラーが出ずアプリが止まらない。
8.  **Undo/Redo**：結合（閉じる・2本）の直後に取り消し1回（ボタン・`Ctrl`+`Z`）→ 元の図形が同じ形・同じ重なり順で戻り、結合した図形が選択された状態。やり直し1回（ボタン・`Ctrl`+`Y`）→ 結合後のパスに戻る。`?dev`の「JSONへ変換」で、Undo後のidが元と同じこと、2本の結合後のidが元の2本のどちらとも違うこと、閉じた後のidが元と同じことを確かめる。
9.  **保存と開き直し**：結合後に少し待って再読み込み → 結合後のパスが残っている。「出力（作業ファイル）」→「開く」で開き直しても同じ形。
10. **スプライトJSの書き出し**：結合後のキャンバスを「出力（エンジン用）」で書き出し、`sprite-check.html`で開く → 開いたパス・閉じたパスがエディタと同じ形で表示される。
11. **ボタンの押せる/押せない**：選択を変えるたびに状態が変わる（開いたパス1本（頂点3つ以上）・線2本で押せる、それ以外で押せない）。図形作成・キャンバス移動モードでは常に押せない。起動直後（読み込み中を含む）は押せない。
12. **キー`J`**：`J`で結合できる。`Shift`+`J`では何も起きない。`Ctrl`+`J`はブラウザの標準動作のまま（奪わない）。`J`を押し続けても1回だけ結合する。`?dev`の入力欄にフォーカスがあるときは`J`が文字として入力され、結合しない。図形のドラッグ中に`J`を押しても結合しない。
13. **表示倍率と重なりの判定**：倍率200%で画面上4pxほど離れた端点の2本を結合 → まとまる（ハンドル3つ）。倍率100%で画面上6〜7px離れた端点 → まとまらない（ハンドル4つ）。倍率50%で画面上4pxほど離れた端点 → まとまる。
14. **結合後の選択と重なり順**：直線A → 矩形R（Aと重なる位置）→ 直線B（Rと重なる位置）の順に描き、AとBを結合 → 結果のパスだけが選択され、パスはRより奥に描かれる（Aの位置に入る）。閉じた場合もパスの前後関係は変わらない。色・太さの違う2本（用意したデータ）を結合 → 奥の線の色・太さになる。
15. **コントロールパネルの見た目**：「削除」「結合」が1行に並び、コントロールパネルの高さが変わらず、図形選択パレットと重ならない。結合ボタンにマウスを載せると「選択中の線を結合 (J)」と出る。
16. **既存の操作**：削除ボタン・`Delete`/`Backspace`、取り消し・やり直しのボタンとキー、`V`/`P`/`H`、数字キー、`Esc`、`Ctrl`+`A`/`C`/`X`/`V`/`D`、ズームとリセットがこれまでどおり動く。
17. **（任意）中ボタンのパン中のボタン**：中ボタンでパンしながら結合ボタンを左クリック → 結合されない。
*   **タスク4実装時の注意**：実物の組み合わせテストの`shouldRestoreSelection`は素の関数（`() => true/false`）で与え、選択集合の結果は与えた値から既存の仕組み（`restore`）で決まるものだけを確かめている。9-4の「Undo/Redoの実体は自動テストにしない」はこのテストで一部覆される（ボタン・キー・描画・保存は引き続きテストプレイ）。
