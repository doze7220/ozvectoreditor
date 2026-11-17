# RES: 作業計画・作業レポート (Phase 08-03) : 矢印キーでの微調整（ナッジ）
* 参照元REQ: `./_log/req/261117_0930_REQ_Phase08-03_Arrow_Nudge.md`

## 1. 作業目的

選んでいる**図形**、または選んでいる**頂点**を、**矢印キーで1pxずつ（`Shift`併用で10pxずつ）動かせるようにする**。マウスでは出せない細かさで位置を詰めるための操作であり、既存のキーボードショートカットの仕組み（`core/KeyboardShortcuts`の対応表と受理判定）と既存の履歴の仕組み（`core/HistoryManager`の`beginEdit`／`commitEdit`の対）の上に載せる。

**本作業で満たすこと**

* 操作モードが**選択（`V`）**で図形を1つ以上選んでいれば、選んでいる図形すべてが同じだけ動く（既存の`VectorModel.moveShapes`。通知1回・取り消し1件）。
* 操作モードが**頂点の選択（`A`）**で頂点を1つ以上選んでいれば、選んでいる頂点すべてが同じだけ動く（既存の`VectorModel.updateVertices`。通知1回・取り消し1件）。
* 続けて押した矢印キーの分は、**取り消し1件にまとまる**（`HistoryManager`に「直前に記録した1件へ畳む」記録の入口を足す）。
* **動かす対象がないときは何もしない**（記録先にも触れない。受理しないのでブラウザ側の既定の動きを妨げない）。

**変えないこと（これを破る変更は失敗とみなす）**

* 自動テスト（リポジトリのルートの`node --test`）が全件通ること。**既存のテストの期待値を変えない**。
* 作業データ形式・書き出し形式・履歴のエントリの形（前後のスナップショットの組）を変えない（版はどちらも2のまま）。
* マウスでの操作のふるまいを一切変えない。`js/core/InputTracker.js`は**変更しない**。
* 既存のキーのふるまいを一切変えない（足すのは矢印キーの8通りだけ）。
* 入力欄にフォーカスがある間は矢印キーで図形・頂点が動かない（既存の受理判定の手順2・4に任せる）。
* 改名・整形・「不要に見えるコードの削除」を行わない。既存の公開メソッド名・フィールド名・DOMのid・クラス名を変えない。

**発注者の決定（2026-11-17。計画で変えてはならない）**

1. 動く量は、スナップの設定に関係なく、矢印キー1回で**1px**、`Shift`と一緒なら**10px**。グリッドの刻みを入れていても変わらず、動かした後に刻みへ丸めることもしない（座標が小数の図形は小数のまま1pxずつ動く）。
2. 取り消しの**まとめの区切り**は、**別の編集操作・選ぶ対象の変更・取り消し/やり直し**のいずれかが入った時点。パン・ズーム・表示の切り替えでは区切らない。
3. 動かす対象がないとき（何も選んでいない／`A`で頂点を1つも選んでいない＝図形だけを選んでいるときを含む）は何もしない。**ブラウザ側の既定の動きは妨げない**。
4. 矢印キーの押しっぱなし（キーリピート）で連続して動く。
5. 本作業の`Shift`は「10px動かす」の意味だけを持つ（移動方向の限定とは別の話）。

**用語**：**微調整（ナッジ）**＝矢印キーで決まった量だけ動かすこと（本作業で足す）。**スナップ**＝座標・移動量を単位の倍数へ丸めること（`core/UnitSnapRules`。**微調整はスナップを通さない**）。**端点への吸い付き**＝結合できる線の端点へ吸い付くこと（`shapes/EndpointSnapRules`・`edit/EndpointSnapper`。**微調整では働かせない**）。**まとめの区切り**＝続けて押した矢印キーの分を取り消し1件にまとめる、そのまとまりの終わり。

---

## 2. アーキテクチャ設計

### 全体の流れ（新しい経路を作らず、既存の経路に載せる）

```
矢印キー（keydown）
  → core/KeyboardShortcuts（対応表の8エントリ＋既存の受理判定の手順1〜7）
    → main.js の注入コールバック nudgeSelection（移動量を渡して戻り値を返すだけ）
      → edit/NudgeEditor.nudge(dx, dy)
          1. core/NudgeTargetRules.resolveNudgeTarget(モード, 図形の選択, 頂点の選択) → 対象 or null
          2. core/NudgeTargetRules.buildNudgeGroupKey(対象) → まとめの鍵
          3. historyManager.beginEdit()
             → model.moveShapes(ids, dx, dy)  または  model.updateVertices(updates)   （通知1回）
             → historyManager.commitEdit(まとめの鍵)                                   （取り消し1件・続けた分は畳む）
      → 戻り値 true のときだけ KeyboardShortcuts が preventDefault()
再描画・ステータスバー・ボタンの同期は、既存の model.onChange / historyManager.onChange の経路だけで行う
```

* **キーの購読を新しく足さない**（`document`への`addEventListener`は`KeyboardShortcuts`の既存の1つのまま）。
* **判定は状態を持たない規則へ**（`core/NudgeTargetRules`）、**動かす実体は`edit/`のコントローラへ**（`edit/NudgeEditor`）、`main.js`は生成・注入・受け渡しだけを行う。
* **まとめの区切りの判断は`HistoryManager`の中だけで完結**させる（コントローラ側に「まとまりが開いているか」を持たない＝`beginEdit`と`commitEdit`の対をどの経路でも崩さない）。
* **微調整専用の再描画・同期の経路を足さない**。

---

### 要件1: 動かす対象を決める規則（`js/core/NudgeTargetRules.js`。新規）

状態を持たない規則のファイルを1つ新設し、次の2つの関数を`export`する。importは`./InputModes.js`の`OperationMode`のみ。

#### `resolveNudgeTarget(mode, selectedIds, selectedVertices)`

| 条件 | 戻り値 |
| --- | --- |
| `mode === OperationMode.SELECT` かつ `selectedIds`が1件以上 | `{ type: 'shapes', shapeIds: [...新しい配列] }` |
| `mode === OperationMode.VERTEX` かつ `selectedVertices`が1件以上 | `{ type: 'vertices', vertices: [{ shapeId, handle }...新しい配列・新しいオブジェクト] }` |
| 上記以外（`CREATE`・`PAN`・未知のモード、選択0件、`VERTEX`で頂点0件） | `null` |

* 並びは**与えられた順のまま**（`model.getSelectedIds()`は描画順、`model.getSelectedVertices()`は選んだ順）。
* 引数（配列・要素）を**書き換えない**。戻り値は毎回**新しいオブジェクト・新しい配列**。
* `SELECT`では`selectedVertices`を見ない、`VERTEX`では`selectedIds`の有無を見ない（頂点の選択は`VectorModel`の不変条件により選択集合の図形の組だけが入っている）。
* DOM・`VectorModel`・図形のインスタンス・履歴・イベント・修飾キーを知らない。**図形種別の分岐・図形固有のプロパティ名・頂点インデックスの規約を持たない**（ハンドル名は文字列として扱うだけ）。

#### `buildNudgeGroupKey(target)`

* `target`が`null`なら`null`を返す。そうでなければ`JSON.stringify(target)`の文字列を返す。
* 約束：**同じ対象を続けて動かしたときだけ同じ鍵になり、対象（種類・図形の並び・頂点の並び）が変わると別の鍵になる**。
* 区切り文字を自前で決めず`JSON.stringify`にするのは、図形のidの形・ハンドル名の文字（`-`等）を規則が知らないまま、文字の衝突（例：ハンドル名に区切り文字が含まれる場合）を起こさないため。JSDocにこの理由を書く。

#### テスト（`test/core/NudgeTargetRules.test.js`。新規）

* `resolveNudgeTarget`：4モード（`SELECT`・`VERTEX`・`CREATE`・`PAN`）×選択あり／なしの8通り＋未知のモード、`VERTEX`で図形だけを選んで頂点が0件のとき`null`、`SELECT`で頂点の選択が入っていても図形を返すこと、並びが保たれること、引数を書き換えず毎回新しい配列・オブジェクトを返すこと。
* `buildNudgeGroupKey`：`null`で`null`、同じ対象（同じ内容の別オブジェクト）なら同じ鍵、図形が増える／減る／並びが変わる／種類が違う（`shapes`と`vertices`）／同じ図形の別のハンドル名／別の図形の同じハンドル名で**別の鍵**になること。

---

### 要件2: 続けた微調整を取り消し1件にまとめる（`js/core/HistoryManager.js`。更新）

`commitEdit`に**省略できる引数を1つ**足す（`commitEdit(groupKey)`）。非公開フィールド`#lastGroupKey`（`string|null`。初期値`null`）を1つ足す。

#### `commitEdit(groupKey)` の手順（既存の処理順は変えない）

1. 記録中の「前の状態」を取り出して破棄する。無ければ`console.warn`して`false`（**既存のまま**。このとき`#lastGroupKey`は変えない＝記録が起きていないため）。
2. 「後の状態」を取得し、前後の`document`を`JSON.stringify`で比較する。同一なら記録せず`false`（**既存のまま**。このときも`#lastGroupKey`を変えない＝REQの明示）。
3. **畳む条件**：`groupKey`が空でない文字列で、`#lastGroupKey === groupKey`で、かつ位置 > 0 のとき。
   * 直前のエントリ（位置−1）を`Object.freeze({ before: 直前のエントリのbefore, after: 今回のafter })`で置き換える（**「前の状態」はまとまりの先頭のまま**）。エントリ列・位置・上限の扱いは変えない（件数が増えないため上限の判定も不要）。
   * 置き換えた結果、そのエントリの`before.document`と`after.document`が同一（往復して元へ戻った）なら、**そのエントリを取り除き位置を1つ戻す**。
   * **畳んだとき・取り除いたときも変更通知する**（取り消し/やり直しの可否が変わりうるため。自動保存の契機でもあるため）。
   * 取り除いたときは`#lastGroupKey`を`null`にする（**設計判断**。残すと、次の同じ鍵の微調整がさらに前の無関係なエントリへ畳まれてしまうため。REQは明記していないが、「まとまりの先頭の状態を残す」約束を守るために必要）。畳んで残ったときは`#lastGroupKey`を変えない（同じ鍵のまま）。
4. 畳まないときは**これまでどおり**新しいエントリとして記録する（やり直しの履歴の破棄 → 追加 → 上限の切り詰め → 位置の更新 → 変更通知 → `true`）。このとき`#lastGroupKey`は、`groupKey`が空でない文字列ならその値、そうでなければ（引数なしを含む）`null`にする。
5. 戻り値：**履歴に記録として残ったとき`true`**（新しいエントリ・畳んで残ったエントリ）、**残らなかったとき`false`**（`beginEdit`なし・前後が同じ・畳んだ結果エントリが消えた）。JSDocに明記する。既存の呼び出し元（`InputTracker`・`edit/`の各コントローラ・`main.js`）は戻り値を使っていないため影響はない。

#### 鍵を忘れる契機

* `undo()`・`redo()`の**冒頭**（既存の`#discardPendingWithWarning`と同じ位置）で`#lastGroupKey = null`。受理できなかった場合（`canUndo`が偽・`restore`が失敗）も忘れる（「取り消し・やり直しが呼ばれたとき」のとおり）。
* 鍵なしで記録したとき（上の手順4）。
* `clear()`（履歴を空にするとき。通知の条件は変えない）。

#### 変えないもの

履歴のエントリの形（前後の組）・上限（`HISTORY_LIMIT`）・やり直しの履歴の破棄・スナップショットの取得と凍結（`#takeSnapshot`・`#deepFreeze`）・`beginEdit`の約束・`undo`／`redo`／`canUndo`／`canRedo`／`onChange`の約束・既存の変更通知の契機。**引数を渡さない既存の呼び出しのふるまいは一切変わらない**。

#### テスト（`test/core/HistoryManager.test.js`。新規）

**現在このファイルは存在しない**（履歴は`test/edit/`の各テストから間接的に確かめられていた）。REQの「既存のケースは変えない」は、新規作成のため自動的に満たされる。`capture`／`restore`は素のオブジェクト・関数の偽物（連番または渡された値を記録するだけ）で置き換える。

* 鍵つきで2回続けて記録すると**エントリは1件のまま**で、取り消し1回で**最初の状態**へ戻ること（`restore`に渡る`before`がまとまりの先頭の状態であること）、やり直し1回で最後の状態へ戻ること。
* 間に**鍵なしの記録**を挟むと畳まれない（2件になる）。
* 間に**取り消し**・**やり直し**を挟むと畳まれない。
* **鍵が変わると**畳まれない。
* **往復して元へ戻るとエントリが消える**（件数と`canUndo`が動かす前と同じに戻る。通知が出ること）。さらに続けて同じ鍵で記録すると、**無関係な前のエントリへ畳まれず**新しいエントリになること。
* 畳んだときに変更通知が出ること。前後が同じで記録しなかったときは通知が出ず、覚えている鍵も変わらないこと（その後の同じ鍵の記録が畳まれる）。
* **既存の呼び出し（引数なし）のふるまいが変わらないこと**：記録・前後が同じなら記録しない・通知の回数・`undo`／`redo`の往復・`clear`・上限（`HISTORY_LIMIT`件を超えると最古から捨てる）・`beginEdit`なしの`commitEdit`の警告（`t.mock.method(console, 'warn', () => {})`で抑止する）。

---

### 要件3: 微調整の実体（`js/edit/NudgeEditor.js`。新規）

`edit/`に新しいコントローラを1つ新設する。クラス名`NudgeEditor`（`ShapeOrderEditor`・`ShapeStyleEditor`と同じ「1件の編集操作の手順」の位置づけ）。

* **コンストラクタ**：`{ model, editRecorder, getMode }`。
  * `model`は`getSelectedIds`・`getSelectedVertices`・`getShapes`・`moveShapes`・`updateVertices`のみ使う。
  * `editRecorder`は`beginEdit`・`commitEdit`を持つもの（実体は`HistoryManager`）。
  * `getMode`は操作モードを返す関数（実体は`() => inputTracker.getMode()`）。
  * **それ以外（DOM・`InputTracker`のインスタンス・`CanvasManager`・ビュー変換）は受け取らない。**
* **公開メソッドは1つ**：`nudge(dx, dy)` → 動かしたら`true`、動かさなかったら`false`（キーを受理したかの判定にそのまま使う）。
* **処理の順序**：
  1. `resolveNudgeTarget(this.#getMode(), this.#model.getSelectedIds(), this.#model.getSelectedVertices())`で対象を求める。`null`なら、**記録先に一切触れず**`false`。
  2. `buildNudgeGroupKey(target)`で鍵を作る。
  3. 対象が**図形**：`beginEdit()` → `model.moveShapes(target.shapeIds, dx, dy)`（変更通知は既存どおり1回） → `commitEdit(鍵)` → `true`。
  4. 対象が**頂点**：`model.getShapes()`を**1度だけ**取り、各組について図形を引き、`shape.getVertexIndexForHandle(handle)`で頂点インデックスを、`shape.getHandlePosition(handle)`で今の位置を求め、`{ id: shapeId, vertexIndex, x: 位置.x + dx, y: 位置.y + dy }`を組み立てる。**図形が見つからない組・位置が求まらない（`null`）組は飛ばす**。組み立てた結果が0件なら、**記録先に一切触れず**`false`。1件以上なら`beginEdit()` → `model.updateVertices(updates)`（1回で渡す＝通知1回・取り消し1件） → `commitEdit(鍵)` → `true`。
* **ビュー変換（表示倍率・スクロール）を読まない**：`dx`・`dy`はワールド座標のpxとして扱う（表示倍率が変わっても1pxは1px）。
* **スナップ（丸め）・端点への吸い付きを通さない**（`UnitSnapRules`・`UnitSnapSettings`・`EndpointSnapper`をimportも注入もしない）。
* 図形種別の分岐・図形固有のプロパティ名を持たない（共通メソッドのポリモーフィックな呼び出しのみ）。再描画・UI同期を自分で呼ばない。`try/catch`を持たない。
* **操作モードの扱い**：`getMode()`が返す値を**不透明な値として規則へ渡すだけ**で、`OperationMode`をimportせず、モードによる分岐も比較も持たない（`edit/`の「操作モードを知らない」の約束を、値を解釈しない形で守る）。
* **依存の向き**：`edit/NudgeEditor` → `core/NudgeTargetRules`（下向き。`main.js → edit → io → core → shapes`の一方向に沿う）。`edit/`から`core/`をimportする最初の例になるため、開発資料の依存方向の記述へ追記する（`NudgeTargetRules`は`core/InputModes`しかimportしないため循環しない）。

#### テスト（`test/edit/NudgeEditor.test.js`。新規）

`VectorModel`は実物、`editRecorder`と`getMode`はテストファイル内の素のオブジェクト・関数の偽物（呼び出しの順・引数・回数を記録する）で置き換える（`_doc/arch/16_test.md`の「注入される依存は偽物」の例外。条件は既存の例外と同じ＝対象がDOM・ブラウザのAPIに依存せず、公開APIだけを通すこと）。

* 図形の移動：選択モードで複数の図形を選び`nudge(1, 0)`で全部が1px動く（位置の関係が保たれる）・`nudge(0, -10)`で上へ10px・戻り値`true`・`model.onChange`の通知が1回。
* 頂点の移動：頂点の選択モードで複数の頂点（別の図形の頂点を含む）を選び、選んだ頂点だけが動き、選んでいない頂点は動かないこと・通知が1回・戻り値`true`。
* 対象なし（何も選んでいない・`A`で図形だけを選んで頂点が0件・`CREATE`・`PAN`）で`false`を返し、**記録先（`beginEdit`・`commitEdit`）を1回も呼ばず**、図形も通知も変わらないこと。
* 頂点が0件に絞られたとき（`getHandlePosition`が`null`を返すハンドル名を頂点の選択へ入れた場合）に`false`で記録先を呼ばないこと。
* 記録先へ**同じ鍵**が渡ること（同じ対象で2回呼ぶと`commitEdit`の引数が等しい／対象を変えると別の鍵になる）。
* `beginEdit`と`commitEdit`が**1回ずつ対で**、`beginEdit` → モデルの変更 → `commitEdit`の順に呼ばれること。
* ワールド座標の移動量であること（ビュー変換を注入しないこと自体がテストの前提。倍率に相当する依存を受け取らない）。

---

### 要件4: 矢印キーの対応表への追加（`js/core/KeyboardShortcuts.js`。更新）

#### 動く量と4方向の定義（このファイルの1か所だけ）

ファイル内の非公開の定数として、**1か所**に凍結して置く（`export`しない）。

* `NUDGE_STEPS`：`Object.freeze({ normal: 1, shift: 10 })`（`Shift`なし＝1px、`Shift`あり＝10px）。
* `NUDGE_DIRECTIONS`：`Object.freeze([...])`。各要素も`Object.freeze`する。
  * `{ code: 'ArrowLeft', x: -1, y: 0 }`・`{ code: 'ArrowRight', x: 1, y: 0 }`・`{ code: 'ArrowUp', x: 0, y: -1 }`・`{ code: 'ArrowDown', x: 0, y: 1 }`
  * 上が「縦方向のマイナス」、下が「縦方向のプラス」、左が「横方向のマイナス」、右が「横方向のプラス」（画面の見た目と一致する）。

#### 8エントリの組み立て（対応表の末尾に足す）

既存の図形種別のエントリが`SHAPE_TYPES`の並びから生成されているのと同じ書き方で、上の定義から`flatMap`で8エントリ（4方向×`Shift`なし／あり）を組み立てる。

| 項目 | 値 |
| --- | --- |
| `codes` | `[方向のcode]`（`ArrowLeft`・`ArrowRight`・`ArrowUp`・`ArrowDown`。物理キー位置で識別する既存の約束どおり） |
| `ctrl` | `false`（**`Ctrl`（`⌘`）付きのエントリは作らない**＝`Ctrl`＋矢印はブラウザ・OSの操作をそのまま通す。`Alt`＋矢印は`#findBinding`が常に不一致） |
| `shift` | `Shift`なしの4つは`ShiftRule.FORBIDDEN`、`Shift`ありの4つは`ShiftRule.REQUIRED` |
| `repeatable` | `true`（押しっぱなしで連続して動く） |
| `action` | `'nudgeSelection'`（**コールバックは1つ**。方向ごとに別のコールバックを作らない） |
| `arg` | `Object.freeze({ dx: 方向.x × 刻み, dy: 方向.y × 刻み })`（**エントリへ渡す値も凍結する**） |

#### JSDocの更新（矢印キーが加わった実態に合わせる）

* `ShiftRule`の`FORBIDDEN`・`REQUIRED`の説明（「`Ctrl+Shift+V`以外の`Shift+V`等は将来のShift併用操作のために予約」「`REQUIRED`は`Ctrl+Shift+Z`と`Ctrl+Shift+V`」）に、**`Shift`＋矢印キー（10px動かす）**が`REQUIRED`に加わったことを書く。
* `SHORTCUT_BINDINGS`のJSDocの修飾キー規則（「通常は`FORBIDDEN`、拡大・縮小のみ`ANY`、やり直しの`Ctrl+Shift+Z`と同じ位置に貼り付けの`Ctrl+Shift+V`のみ`REQUIRED`」）を、矢印キーの4つを含む実態へ直す。矢印キーは`Shift`の有無で1px／10pxに排他的に分かれること、`Ctrl`付き・`Alt`付きは一致しないことも書く。
* `#findBinding`のJSDocの`REQUIRED`の説明（「やり直しの`Ctrl+Shift+Z`と同じ位置に貼り付けの`Ctrl+Shift+V`のみ」）を同様に直す。
* `ShortcutActions`のtypedefへ`nudgeSelection`を足す：`@property {(delta: {dx: number, dy: number}) => boolean} nudgeSelection 選んでいる図形または頂点を、受け取った移動量（ワールド座標のpx）だけ動かす。動かした場合のみ`true`（動かす対象がないときは`false`＝ブラウザ側の既定の動きを妨げない）`。
* ファイル先頭の責務定義は変えない（キー→操作の対応表と受理判定のみ、という責務の範囲内）。

#### 変えないもの

受理判定（手順1〜7）・キーの識別・`preventDefault()`の原則・既存のエントリ・`#matchesShiftRule`・コンストラクタの検証。`index.html`のボタンの`title`属性は、矢印キーに対応するボタンが無いため変えない。

#### 受理判定の確認（既存の仕組みにそのまま載ることの確認。コードは変えない）

| 場面 | 結果 |
| --- | --- |
| テキスト入力扱いの欄（太さの欄＝`number`・キャンバス名の欄＝`text`等）にフォーカス | 手順2で何もしない（欄の中のカーソル移動・数値の増減が働く。`preventDefault()`もしない） |
| 色の欄・チェックボックス（`isSpaceOperatedInputElement`） | 手順4で`ctrl: false`のため実行しない（`preventDefault()`もしない） |
| ドラッグ中 | 手順5で実行しない。`ctrl: false`のため`preventDefault()`もしない |
| キーリピート | `repeatable: true`のため実行する |
| 動かす対象なし | コールバックが`false`を返すため`preventDefault()`しない（ブラウザの既定の動き＝スクロール等がそのまま起きる） |
| `Ctrl`＋矢印／`Alt`＋矢印 | 一致せず何もしない（ブラウザ・OSの操作のまま） |

#### テスト（`test/core/KeyboardShortcuts.test.js`。新規）

`test/core/`に`KeyboardShortcuts`のテストは**存在しない**。REQの指示に従い、「新しいコールバックが欠けているときに起動時の例外になること」だけを確かめる最小のテストを新設する（コンストラクタは`document`に触れる前にコールバックの検証を行うため、`document`の無いNode.jsでも**欠けている場合の経路だけ**は確かめられる。欠けていない場合は`document.addEventListener`に達するため確かめない）。

* `new KeyboardShortcuts({})`が`Error`を投げ、文言に`nudgeSelection`と`isDragging`が含まれること。
* `nudgeSelection`**だけ**を持たないコールバック群で`Error`を投げ、文言の欠落した名前が`nudgeSelection`だけであること（＝対応表の矢印キーのエントリが`nudgeSelection`を要求していること）。コールバック群は、`'nudgeSelection'`以外のどのプロパティ名にも関数を返す`Proxy`で作る（action名の一覧をテスト側へ二重に書かないため。ソースへ`export`の追加・privateの公開は行わない）。
* 補助関数・`Proxy`にはJSDoc（`@param`・`@returns`）を書く。

**テストできない箇所**（計画書に明記）：矢印キーの`event.code`での一致・`Shift`の有無での1px／10pxの分かれ方・`Ctrl`／`Alt`での不一致・キーリピートでの実行・入力欄とドラッグ中の見送り・`preventDefault()`の有無は、`document`の購読と`KeyboardEvent`に依存するため`node --test`では確かめられない（テストプレイで確かめる）。

---

### 要件5: 配線（`js/main.js`。更新）

* **新しい配線ブロック`// 7.9.`**（`// 7.8.`の後・`// 8.`の前）を足し、そこで`NudgeEditor`を1つ生成する。

  ```
  // 7.9. 微調整（矢印キー）配線
  const nudgeEditor = new NudgeEditor({
      model,
      editRecorder: historyManager,
      getMode: () => inputTracker.getMode(),
  });
  ```

  * 位置の理由：`VectorModel`（`// 1.`）・`HistoryManager`（`// 3.5.`）・`InputTracker`（`// 4.`）が揃った後で、`KeyboardShortcuts`の生成（`// 8.`）より前。既存の生成・注入の順序と`onChange`の登録順（＝通知の呼ばれる順）を**動かさない**ために、既存のブロックの中へは入れず新しいブロックとして足す。
* `KeyboardShortcuts`へ注入するコールバックに1つ足す（`startEyedropper`の後）。

  ```
  // 矢印キーでの微調整（選んでいる図形・頂点を移動量だけ動かす）。動かした場合のみtrue（判定・計算はNudgeEditorと規則が持つ）
  nudgeSelection: (delta) => nudgeEditor.nudge(delta.dx, delta.dy),
  ```

  * **判定・計算を`main.js`へ書かない**（受け取った移動量をそのまま渡し、戻り値をそのまま返すだけ）。
* importを1行足す（`import { NudgeEditor } from './edit/NudgeEditor.js';`。`edit/`のimportの並びに合わせる）。
* 再描画・ステータスバー・オプションバー・削除ボタン等の同期は、**既存の`onChange`の経路だけ**で行う（微調整専用の再描画・同期の呼び出しを足さない）。
* `applyMode`・`ensureSelectMode`・`renderCurrentState`・`performUndo`／`performRedo`・`syncHistoryButtonState`等の既存の関数は**変えない**。

---

### 要件6: ふるまいの確認（テストプレイの確認項目）

最終タスクで、次の項目をそのまま発注者へ提示する。

0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。直線・曲線・矩形・パス・円・弧をいくつか描いておく。
1. **図形を1pxずつ動かす**：選択（`V`）で図形を1つ選び、矢印キーを押すと押した向きへ1px動く。ステータスバーの表示も追従する。
2. **`Shift`で10px**：`Shift`＋矢印で10px動く。
3. **複数の図形**：図形を2つ以上選んで矢印キーを押すと、全部が同じだけ動く（位置の関係が保たれる）。
4. **頂点を1pxずつ動かす**：頂点の選択（`A`）で頂点を1つ選び、矢印キーを押すと、その頂点だけが1px動く（図形の形が変わる）。
5. **頂点を複数**：頂点を2つ以上（別の図形の頂点を含めてよい）選んで矢印キーを押すと、選んだ頂点すべてが同じだけ動く。
6. **対象がないとき**：何も選んでいないとき、頂点の選択（`A`）で図形だけを選んで頂点を選んでいないとき、図形作成（`P`）・キャンバス移動（`H`）のときは、矢印キーで何も動かない。
7. **押しっぱなし**：矢印キーを押し続けると連続して動く。離すと止まる。
8. **取り消しがまとまる**：矢印キーを10回押して10px動かしたあと、取り消し（`Ctrl`+`Z`）を**1回**押すと10回分がまとめて元の位置へ戻る。やり直し（`Ctrl`+`Shift`+`Z`）1回で動かした状態へ戻る。
9. **区切り（別の編集）**：矢印キーで動かす → マウスで図形を動かす（または削除・貼り付け・色の変更） → また矢印キーで動かす、の順に操作すると、取り消しは**3回**でそれぞれの段階へ戻る。
10. **区切り（選ぶ対象の変更）**：図形Aを矢印キーで動かす → 図形Bを選ぶ → Bを矢印キーで動かす、のあと、取り消し1回でBだけが戻り、もう1回でAが戻る。
11. **区切らないもの**：矢印キーで動かす → グリッドの表示を切り替える／拡大・縮小する／キャンバスを移動する → また矢印キーで動かす、のあとは、取り消し1回でその図形の移動がまとめて戻る。
12. **往復**：矢印キーで右へ1px、左へ1pxと動かして元の位置に戻した場合、取り消しの履歴が増えていない（取り消しボタンの押せる/押せないの状態が、動かす前と同じ）。
13. **スナップと無関係**：グリッドのスナップを10pxにしても、矢印キー1回は1pxのまま（刻みへ丸められない）。`?dev`で小数の座標の図形を読み込み、矢印キーで動かすと小数のまま1pxずつ動く。
14. **入力欄との競合**：線の太さの欄・キャンバス名の欄などにフォーカスがある間は、矢印キーが欄の操作に使われ、図形・頂点は動かない。欄の外へフォーカスを戻すと、また動くようになる。
15. **ドラッグ中**：図形をマウスで押したまま矢印キーを押しても何も起きない（離してからは効く）。
16. **ほかの操作が今までどおり**：`V`・`A`・`P`・`H`・数字・`Esc`・`Delete`・`J`・`Home`/`End`/`PageUp`/`PageDown`・`Ctrl`系・`Z`/`X`/`C`・`D`・`I`・`Tab`・スペースパン、保存・読み込み・書き出し、キャンバスパレットが今までどおり動く。
17. **多い図形での反応**：図形を数十個選んで矢印キーを押しっぱなしにしても、操作が重くて追従しないほどにはならない（重さを感じた場合はその状況を報告すること）。

---

### 関連フォルダと論理クラス

* **対象フォルダ**：`./js/core/`（規則・履歴・キーの対応表）、`./js/edit/`（図形一式を扱う手順）、`./js/`（`main.js`の配線）、`./test/core/`・`./test/edit/`（自動テスト）
* **関連する論理クラス・モジュール**
  * 新規：`core/NudgeTargetRules`（動かす対象を決める規則・まとめの鍵の組み立て）・`edit/NudgeEditor`（微調整の1件の編集操作の手順）
  * 既存（変更）：`core/HistoryManager`（`commitEdit`の省略できる引数と畳む記録）・`core/KeyboardShortcuts`（矢印キーの8エントリと`nudgeSelection`）・`main.js`（生成と注入）
  * 新規（テスト）：`test/core/NudgeTargetRules.test.js`・`test/core/HistoryManager.test.js`・`test/core/KeyboardShortcuts.test.js`・`test/edit/NudgeEditor.test.js`
  * 既存（**変更しない**。依存先・読むだけ）：`core/VectorModel`（`getSelectedIds`・`getSelectedVertices`・`getShapes`・`moveShapes`・`updateVertices`）・`core/InputModes`・`core/InputTracker`（`getMode`のみ使う）・`core/FocusKeyYieldRules`・`core/ShapeFactory`・`core/UnitSnapRules`・`core/UnitSnapSettings`・`core/CanvasManager`・`shapes/`の5つの図形クラス（`getVertexIndexForHandle`・`getHandlePosition`）・`shapes/EndpointSnapRules`・`edit/SnapshotAdapter`・`edit/EndpointSnapper`・`io/`・`js/palette/`・`js/wiring/`・`index.html`・`asset/`・既存のテスト全ファイル
* **依存方向**：`main.js → edit → io → core → shapes`の一方向を保つ。本作業で増える向きは次の3つだけで、いずれも下向き。
  * `main.js → edit/NudgeEditor`（既存の`main.js → edit/`と同じ）
  * `edit/NudgeEditor → core/NudgeTargetRules`（**`edit/`から`core/`をimportする最初の例**。下向きで依存方向に沿う）
  * `core/NudgeTargetRules → core/InputModes`（`core/`内。`InputModes`は何もimportしない）
  * 循環importは無い。`core/`から`io/`・`edit/`・`palette/`・`asset/`をimportしない。

### 参照する責務
（`PROJECT_CONSTITUTION.md`・`PROJECT_ARCHITECTURE.md`および`_doc/arch/`から抜粋。**以後のタスク実行チャットは、この項目のみを責務情報源とする**）

* **憲法（必ず守る）**
  * すべての`.js`の最先頭行に、そのファイルの単一の責務をJSDocで3行以内に明記する。**ファイル先頭に定義された責務を逸脱するメソッド・ロジックを追記しない**。
  * クラス・関数・メソッド・データ構造にはJSDocで引数・戻り値・責務を明文化する。
  * 状態（モデル）と描画（Canvas API）を混同しない。`CanvasManager`に座標データ・選択状態を持たせない。
  * グローバル（`window`）を汚染しない。外部ライブラリ・フレームワーク・ビルドツールを導入しない。計算は標準の`Math`で自前実装する。
  * 検証コマンドは、リポジトリのルートの`node --test`（全件合格が合否）。
  * REQ／RESで変更対象として明示されたファイル以外は変更しない（ついでの整形・不要に見えるコードの削除・命名の改善も禁止）。
* **`core/`の規則のファイル**（`PointHitRules`・`SelectionRules`・`VertexHandleRules`等と同じ位置づけ）
  * 状態・DOM（要素・id・クラス名）を持たない。図形種別の分岐・図形固有のプロパティ名を持たない。
  * 引数を書き換えず、毎回新しいオブジェクト・配列を返す。`io/`・`edit/`・`palette/`・`asset/`をimportしない。
  * 判定表・規則は1か所にだけ置き、呼び出し側（`main.js`・`KeyboardShortcuts`・`edit/`）に同じ判定を書かない。
* **`core/KeyboardShortcuts.js`**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみを担う。公開メソッドなし。新しいショートカットは**対応表へのエントリ追加（＋必要なら注入コールバックの追加）**で対応し、`Shift`規則は必ず`ShiftRule`の値を指定する。図形種別のエントリは`SHAPE_TYPES`の並びから生成する。知らないこと：表示の状態・`VectorModel`・`ViewTransform`・`InputTracker`インスタンス・DOMのボタン要素。importは`InputModes`の`OperationMode`・`ShapeFactory`の`SHAPE_TYPES`・`FocusKeyYieldRules`の2関数のみ。`keyup`は購読しない。操作の実体は注入コールバックへ委譲し、コンストラクタで全action名の注入を検証して欠落時は`Error`をthrowする。ショートカット専用のUI同期・再描画を持たない。
  * 受理判定の順序（固定）：①IME変換中 ②テキスト入力中（`isTextInputElement`） ③対応表の一致（`#findBinding`。`Alt`押下時は常に不一致、`Meta`は`Ctrl`と同一視、キーは`event.code`で識別） ④`ctrl: false`のエントリで色の欄等（`isSpaceOperatedInputElement`）にフォーカスがあれば何もしない ⑤ドラッグ中は実行しない ⑥キーリピートかつ`repeatable: false`なら実行しない ⑦コールバックが`true`を返したときだけ`preventDefault()`。⑤⑥で実行しなかった場合、`ctrl: true`のエントリのみ`preventDefault()`する。
* **`core/HistoryManager.js`**：編集操作の履歴（スナップショットの前後の組の列・位置・上限）の保持と、記録・取り消し・やり直し・リセット・可否の照会を担う。公開メソッドは`beginEdit`・`commitEdit`・`undo`・`redo`・`canUndo`・`canRedo`・`clear`・`onChange`、export：`HISTORY_LIMIT`。DOM・図形種別・図形固有のプロパティ名・作業データの中身を知らず、importを持たない。スナップショットの取得・適用は注入された`{ capture, restore }`へ委譲する。変更通知は記録時・適用成功時・`clear()`で実際に破棄したときのみ（`beginEdit()`・不記録の`commitEdit()`では通知しない）。呼び出し元：`beginEdit`/`commitEdit`は`InputTracker`・`main.js`・`ShapeInserter`・`PathJoiner`・`EndpointSnapper`・`ShapeStyleEditor`・`ShapeOrderEditor`（いずれも`EditRecorder`として注入され、戻り値を使っていない）、`undo`/`redo`は`main.js`の`performUndo`/`performRedo`のみ、`clear`は`CanvasLibrary`のみ、`onChange`は`main.js`のボタン同期と`CanvasLibrary`の自動保存の契機。
  * 記録の規則（3章6.）：変更処理を`beginEdit()`と`commitEdit()`で挟む。`model.onChange`ごとの記録はしない。前後の作業データ部分の`JSON.stringify`が一致する場合は記録せず、やり直しの履歴も破棄しない（選択集合は比較しない）。適用の流れ・適用後の選択集合・通知の回数は変えない。
* **`edit/`（全クラス共通）**：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。知らないこと：DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、**操作モード**。`InputTracker`に依存しない。操作モードに依存する判定・処理は中立な注入関数で受け取る。`VectorModel`・`HistoryManager`等は注入で受け取る。1件の編集操作は`beginEdit`→モデルの変更→`commitEdit`で、何もしない場合は`beginEdit`も呼ばない（`ShapeOrderEditor`・`EndpointSnapper`の契約）。ドラッグ中の判定・進行中の入力操作の中断・モード切り替えは行わない（呼び出し側の責務）。
* **`core/VectorModel.js`（変更しない。使う公開メソッドのみ）**
  * `getSelectedIds()`：選択中の図形idの新しい配列（`#shapes`の並び＝描画順）。
  * `getSelectedVertices()`：`{ shapeId, handle }`の新しい配列（選んだ順。コピー）。**不変条件：選択集合に含まれる図形の組だけを持つ**。頂点の選択は履歴・作業データ・書き出しの対象外。
  * `getShapes()`：図形の並び（描画順）。
  * `moveShapes(ids, dx, dy)`：`shape.translate`へポリモーフィックに委譲し、1件以上動かしたときだけ**通知1回**。存在しないidは無視。
  * `updateVertices(updates)`：`updates`＝`{ id, vertexIndex, x, y }`（ワールド座標の絶対値）の配列。各組を順に`shape.setVertex`へ委譲し、1件以上更新したときだけ**通知1回**。存在しないidの組は無視、空の配列では何もせず通知もしない。引数の配列・要素を書き換えない。
  * `updateVertex(id, vertexIndex, x, y)`は`updateVertices`へ委譲する薄い入口。**本番から呼ばれなくなっても消さない・改名しない**（現場設計セッションの決定）。
* **`shapes/`の共通メソッド契約（変更しない。呼ぶだけ）**
  * `getVertexIndexForHandle(handleName)`：ハンドル名から頂点インデックスを返す（解決できなければ`null`）。
  * `getHandlePosition(handleName)`：ハンドルの位置を新しい`{x, y}`で返す。**ハンドル名でない値（`null`・未知の文字列・文字列以外・`Object.prototype`のキー名）には例外を投げず`null`を返す**。
  * `getVertexHandleNames()`が返す名前は、必ず`getVertexIndexForHandle`が番号を、`getHandlePosition`が位置を返すものに限る（`'move'`は含めない。円・弧は空）。
* **`main.js`**：インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶ連携のみ。**判定ロジック・作業データの中身の解釈を持たない**（持たせる必要が生じたら別モジュールへ分離する）。配線ブロックはコメント番号の順に置く（`// 7.8.`の次が`// 8.`＝`performInvertSelection`・`KeyboardShortcuts`の生成・`AltKeyGuard`）。再描画・UI同期は既存の`onChange`の経路のみで行い、機能専用の再描画・同期処理を足さない。ショートカットのコールバックの戻り値の意味は`ShortcutActions`のtypedefを正とする。
* **`test/`**：`node:test`・`node:assert/strict`のみ使う（外部ライブラリ・DOMの模擬ライブラリを使わない）。置き場所と命名は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。共有の補助モジュールを置かず、補助関数は各テストファイルの中に書く（JSDoc必須）。先頭行に単一責務のJSDoc（3行以内）。公開APIのみを通し、**テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない**。`globalThis`・`window`へ代入しない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える（実物の`VectorModel`等を組み合わせるのは、対象がDOM・ブラウザのAPIに依存せず公開APIだけを通す場合の例外）。図形の`id`は公開プロパティ`id`へ直接代入する。
* **3章17.（スナップ）との関係**：スナップは座標・移動量を単位の倍数へ**丸める**機能で、丸めは入力の座標・移動量の入口（`InputTracker`）で行い、`VectorModel`・図形クラスは丸めを知らない。**本作業の微調整は丸めの対象に加えない**（`UnitSnapRules`・`UnitSnapSettings`を読まない）。
* **3章18.（頂点の選択）との関係**：頂点の選択の状態は`VectorModel`が持ち、2つ以上の組が入る。頂点のまとめ移動は`updateVertices`で通知1回・取り消し1件。**端点への吸い付きは頂点を1つだけ選んでいるときだけ働く**（マウスのドラッグの話で、微調整では働かせない）。`A`での`Delete`は何もしない。選択（`V`）では図形の外枠のハンドルを描かず当てない。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体の修正は**最終タスクでのみ**行う。個別の実装タスクでは本欄への追記だけを行う）

* **1章 フォルダ構造の一覧**：`js/core/NudgeTargetRules.js`（矢印キーで動かす対象の規則とまとめの鍵。状態なし。`edit/NudgeEditor`から使う）・`js/edit/NudgeEditor.js`・`test/core/NudgeTargetRules.test.js`・`test/core/HistoryManager.test.js`・`test/core/KeyboardShortcuts.test.js`・`test/edit/NudgeEditor.test.js`の6行を追加。
* **1章「存在しないもの」**：Phase 08-02a・08-02bの一覧にある「矢印キーでの微調整」を、本作業で行ったものとして整理し、Phase 08-03の分（位置の数値入力・整列と分布、拡大縮小・回転・反転・外枠のハンドル、頂点の追加・削除／パスの分割／区間の切り替え／パスを開く・閉じる、`Ctrl`＋矢印・`Alt`＋矢印への割り当て、微調整でのスナップの丸め・端点への吸い付き、ツールパレット等へのボタンの追加、性能の改善を目的とした変更、書き出しの際の座標の丸め）を追記。
* **1章「フォルダ分割の方針」**：`core/`に`NudgeTargetRules`（`edit/`から使う、操作モードの知識を要する状態のない規則。`edit/`は操作モードを知らないため`edit/`へは置けない）を足したこと、`edit/`に`NudgeEditor`（`ShapeOrderEditor`と同じ「1件の編集操作の手順」）を足したことを追記。
* **1章「依存方向」**：`main.js → edit/NudgeEditor`、`edit/NudgeEditor → core/NudgeTargetRules`（**`edit/`から`core/`をimportする最初の例**。下向きで依存方向に沿う）、`core/NudgeTargetRules → core/InputModes`（`OperationMode`のみ）を追記。循環importが無いことも書く。
* **3章**：**「19. 矢印キーでの微調整（ナッジ）」を新設**（関わるモジュール、動く量（1px／`Shift`で10px）と4方向の定義の唯一の場所、対象の決め方、まとめの区切り、スナップ・端点への吸い付きと無関係であること、対象がないときは受理しないこと、キーリピート、発注者の決定（2026-11-17）、テストプレイの結果）。
* **3章6.（履歴）**：「記録する操作と時点」へ矢印キーでの微調整（`NudgeEditor.nudge`で`moveShapes`／`updateVertices`の前後。続けた分は`commitEdit`のまとめの鍵で直前の1件へ畳む）を追記し、「まとめの鍵」の約束（畳む条件・往復で消えること・鍵を忘れる契機・通知）を書く。
* **3章17.（スナップ）**：「丸めないもの」へ「矢印キーでの微調整の移動量（発注者の決定）」を追記。
* **3章18.（頂点の選択）**：「やらないこと（08-02a/08-02b）」の「矢印キーでの微調整」が本作業で入ったことと、頂点の微調整が`updateVertices`の既存の経路に載ることを追記。
* **4章の一覧**：`NudgeTargetRules.js` → `_doc/arch/41_NudgeTargetRules.md` の行を追加。
* **`_doc/arch/41_NudgeTargetRules.md`（新規）**：責務・公開関数・戻り値の形・鍵の約束・知らないこと・使う側・置き場所の理由・テスト。
* **`_doc/arch/07_KeyboardShortcuts.md`**：「矢印キーでの微調整のキー（Phase 08-03）」の項を足す（8エントリの作り方・`ctrl: false`のみ・`Shift`で1px／10px・`repeatable: true`・コールバックは`nudgeSelection`の1つ・動く量と4方向の定義が同ファイルの1か所であること）。`Shift`の規則の説明（`REQUIRED`は`Ctrl+Shift+Z`と`Ctrl+Shift+V`のみ／`Shift`併用は予約）を実態に合わせて直す。
* **`_doc/arch/08_HistoryManager.md`**：`commitEdit`の省略できる「まとめの鍵」の引数、畳む条件、往復でエントリが消えること、鍵を忘れる契機、畳んだとき・取り除いたときも通知すること、戻り値の意味、呼び出し元に`edit/NudgeEditor`を追記（鍵を渡すのは`NudgeEditor`だけ）。
* **`_doc/arch/14_edit.md`**：`NudgeEditor.js`の項（責務・公開メソッド`nudge`・依存（`model`の使うメソッド・`editRecorder`・`getMode`）・契約（対象なし／0件では記録先に触れない・通知1回・取り消し1件・ビュー変換を読まない・スナップと吸い付きを通さない）・例外として`core/NudgeTargetRules`をimportすること・操作モードの値を解釈せず規則へ渡すだけであること）。「依存」の段落へ`core/`のimportの例外を追記。
* **`_doc/arch/02_main.md`**：配線ブロックの表へ`// 7.9.`（微調整の配線）、注入の一覧へ`NudgeEditor`（`model`・`editRecorder`＝`historyManager`・`getMode`＝`() => inputTracker.getMode()`）、`KeyboardShortcuts`の注入へ`nudgeSelection`、行数の更新（実測は899行→908行（タスク4で+9行。最終タスクで再確認））。
* **`_doc/arch/03_VectorModel.md`**：`moveShapes`・`updateVertices`の呼び出し元に`edit/NudgeEditor`が加わったこと（`updateVertices`の「呼び出し元は`InputTracker`の頂点のドラッグ」の記述を更新）。
* **`_doc/arch/32_InputModes.md`**：使う側（import元）へ`core/NudgeTargetRules`（`OperationMode`）を追記。
* **`_doc/arch/16_test.md`**：「Phase 08-03の新設・追加分」（新設4ファイルと検証範囲）、「テストできない箇所（08-03の追加）」（`KeyboardShortcuts`の矢印キーの受理判定全般、`main.js`の`// 7.9.`の配線と`nudgeSelection`のコールバック）、「書き換えた既存のテスト（08-03）」（無し）、件数（08-03前は1411件）、`test/edit/NudgeEditor.test.js`が実物の`VectorModel`を使う例外の条件を追記。
* （影響が無いと判断したもの：`_doc/arch/06_InputTracker.md`・`12_shapes.md`・`30_UnitSnapRules.md`・`31_UnitSnapSettings.md`・`38_VertexHandleRules.md`・`01_index_html.md`。実装中に影響が判明した場合は本欄へ追記する）

---

## 3. タスクリスト

*   [x] タスク1: 要件1 動かす対象を決める規則（`core/NudgeTargetRules`）
    *   **対象ファイル** :
        *   `./js/core/NudgeTargetRules.js` :（新規）
        *   `./test/core/NudgeTargetRules.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。importは`./InputModes.js`の`OperationMode`のみ。状態・DOMを持たない。
        *   typedef`NudgeTarget`（`{ type: 'shapes', shapeIds: string[] }`／`{ type: 'vertices', vertices: Array<{shapeId: string, handle: string}> }`）を書く。
        *   `resolveNudgeTarget(mode, selectedIds, selectedVertices)`を実装する。分岐は要件1の表のとおり（`SELECT`＋図形1件以上→`shapes`／`VERTEX`＋頂点1件以上→`vertices`／それ以外→`null`）。並びは与えられた順のまま、引数を書き換えず、毎回新しい配列・新しいオブジェクトを返す。図形種別の分岐・図形固有のプロパティ名・頂点インデックスの規約を持たず、ハンドル名は文字列として扱うだけ。
        *   `buildNudgeGroupKey(target)`を実装する（`null`→`null`、それ以外は`JSON.stringify(target)`）。JSDocに「同じ対象なら同じ・対象が変わると別」の約束と、区切り文字を自前で決めず`JSON.stringify`にした理由（idの形・ハンドル名の文字を知らないまま衝突を避けるため）を書く。
        *   `test/core/NudgeTargetRules.test.js`（新規）：先頭に単一責務のJSDoc。要件1のテストの観点をすべて確かめる（4モード×選択あり/なし、`VERTEX`で頂点0件、未知のモード、並びの保持、非破壊・新しい配列、鍵が同じ／別になる各ケース）。`OperationMode`は`js/core/InputModes.js`からimportする。補助関数にはJSDoc（`@param`・`@returns`）を書く。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝と`updateVertex`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク2: 要件2 履歴の記録の入口に「まとめの鍵」を足す（`core/HistoryManager`）
    *   **対象ファイル** :
        *   `./js/core/HistoryManager.js` :（更新）
        *   `./test/core/HistoryManager.test.js` :（新規）
    *   **作業内容** :
        *   非公開フィールド`#lastGroupKey`（`string|null`。初期値`null`）を1つ足す（JSDoc付き）。
        *   `commitEdit(groupKey)`に省略できる引数を1つ足し、要件2の手順（畳む条件・置き換え・往復での取り除き・通知・鍵の記憶と忘却・戻り値）を実装する。**引数を渡さない既存の呼び出しのふるまいを一切変えない**（処理順・警告・比較・上限・やり直しの履歴の破棄・通知の条件）。
        *   畳む条件は「`groupKey`が空でない文字列」「`#lastGroupKey === groupKey`」「位置 > 0」。畳んだエントリは`Object.freeze({ before: 直前のbefore, after })`で置き換える。前後が同じになったらエントリを取り除いて位置を1つ戻し、`#lastGroupKey`を`null`にする。どちらの場合も変更通知を行う。
        *   `undo()`・`redo()`の冒頭（`#discardPendingWithWarning`と同じ位置）と`clear()`で`#lastGroupKey`を`null`にする。`undo`/`redo`のそれ以外の処理・`clear()`の通知の条件は変えない。
        *   JSDoc：`commitEdit`の`@param`（省略できる鍵）・`@returns`（記録として残ったか）と、畳む約束・鍵を忘れる3つの契機・畳んだとき/取り除いたときも通知することを書く。クラスのJSDocの箇条書きへ「続けた同じ鍵の記録は直前の1件へ畳む」ことを1行足す。ファイル先頭の責務定義は変えない（記録の責務の範囲内）。
        *   履歴のエントリの形（`{before, after}`）・`HISTORY_LIMIT`・スナップショットの取得と凍結・`beginEdit`の約束・`onChange`の契約は変えない。
        *   `test/core/HistoryManager.test.js`（新規。現在このファイルは存在しない）：先頭に単一責務のJSDoc。偽物の`capture`／`restore`で、要件2のテストの観点をすべて確かめる（鍵つきで畳む／件数が増えない／取り消し1回で最初の状態／鍵なしの記録・取り消し・やり直し・鍵の変化で畳まれない／往復でエントリが消え、その後の同じ鍵の記録が前のエントリへ畳まれない／畳んだときの通知／既存の引数なしのふるまい一式）。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。補助関数にはJSDoc（`@param`・`@returns`）を書く。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝と`updateVertex`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（既存の`test/edit/`の履歴を使うテストが落ちないこと＝引数なしのふるまいが変わっていないことの確認を兼ねる）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク3: 要件3 微調整の実体（`edit/NudgeEditor`）
    *   **対象ファイル** :
        *   `./js/edit/NudgeEditor.js` :（新規）
        *   `./test/edit/NudgeEditor.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。importは`../core/NudgeTargetRules.js`の2関数のみ（下向きの依存。JSDocに理由を書く）。
        *   クラス`NudgeEditor`：コンストラクタ`{ model, editRecorder, getMode }`（他の`edit/`のクラスと同じく検証しない）、公開メソッドは`nudge(dx, dy)`の1つだけ。要件3の処理の順序のとおりに実装する。
        *   対象なし（`null`）・頂点の組み立てが0件のときは、**記録先に一切触れず**`false`を返す（`beginEdit`も呼ばない）。それ以外は`beginEdit()` → モデルの変更1回 → `commitEdit(鍵)`の順で`true`を返す。
        *   頂点は`model.getShapes()`を1度だけ取り、`getVertexIndexForHandle`・`getHandlePosition`で頂点インデックスと今の位置を求め、「今の位置＋移動量」を`updateVertices`へ**1回で**渡す。図形が見つからない組・位置が`null`の組は飛ばす。
        *   ビュー変換・スナップ・端点への吸い付き・DOM・`InputTracker`・`CanvasManager`を受け取らず読まない。図形種別の分岐・図形固有のプロパティ名を持たない。再描画・UI同期を自分で呼ばない。`try/catch`を持たない。操作モードの値は**解釈せず**規則へ渡すだけにする（`OperationMode`をimportしない）。
        *   JSDocに、`@param`・`@returns`（動かしたか）、記録先に触れない条件、通知が1回・取り消しが1件であること、移動量がワールド座標のpxであること、スナップ・端点への吸い付きを通さないこと（発注者の決定）を書く。
        *   `test/edit/NudgeEditor.test.js`（新規）：先頭に単一責務のJSDoc。実物の`VectorModel`と図形クラス、偽物の`editRecorder`（呼び出しの順・引数を記録する素のオブジェクト）・偽物の`getMode`（返す値を差し替えられる関数）で、要件3のテストの観点をすべて確かめる。図形の`id`は公開プロパティ`id`へ直接代入する。補助関数にはJSDoc（`@param`・`@returns`）を書く。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝と`updateVertex`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク4: 要件4・要件5 矢印キーの8エントリと配線（`core/KeyboardShortcuts`・`main.js`）
    *   **対象ファイル** :
        *   `./js/core/KeyboardShortcuts.js` :（更新）
        *   `./js/main.js` :（更新）
        *   `./test/core/KeyboardShortcuts.test.js` :（新規）
    *   **作業内容** :
        *   **要件4と要件5を同じタスクにまとめる理由**：対応表へ`nudgeSelection`のエントリを足した時点で、`main.js`が同名のコールバックを注入していないと`KeyboardShortcuts`のコンストラクタが起動時に`Error`をthrowする（配線が揃うまでアプリが起動しない）。REQの「順序」の但し書きに従って1タスクにまとめる。
        *   `KeyboardShortcuts.js`：非公開の定数`NUDGE_STEPS`（1と10）と`NUDGE_DIRECTIONS`（4方向と符号）を**1か所だけ**に置き、どちらも`Object.freeze`する（要素も凍結）。対応表の末尾に、この定義から組み立てた8エントリ（`ctrl: false`・`Shift`なしは`FORBIDDEN`／ありは`REQUIRED`・`repeatable: true`・`action: 'nudgeSelection'`・`arg`は凍結した`{dx, dy}`）を足す。既存のエントリ・受理判定・`#findBinding`・`#matchesShiftRule`・コンストラクタは変えない。
        *   `KeyboardShortcuts.js`のJSDoc：`ShiftRule`の`FORBIDDEN`・`REQUIRED`の説明、`SHORTCUT_BINDINGS`の修飾キー規則、`#findBinding`の`REQUIRED`の説明を、矢印キーが加わった実態に合わせて直す（`Shift`＋矢印＝10px。`Shift`併用が予約だけではなくなったこと）。`ShortcutActions`のtypedefへ`nudgeSelection`（引数`{dx, dy}`・戻り値の意味）を足す。矢印キーのエントリの直前に、方向と量の対応・`Ctrl`／`Alt`付きは一致しないことのコメントを書く。
        *   `main.js`：`import { NudgeEditor } from './edit/NudgeEditor.js';`を足し、新しい配線ブロック`// 7.9. 微調整（矢印キー）配線`を`// 7.8.`の後・`// 8.`の前に置いて`NudgeEditor`を1つ生成する（`model`・`editRecorder: historyManager`・`getMode: () => inputTracker.getMode()`）。`KeyboardShortcuts`の注入へ`nudgeSelection: (delta) => nudgeEditor.nudge(delta.dx, delta.dy),`を足す（`startEyedropper`の後）。**判定・計算を`main.js`へ書かない**。
        *   `main.js`の既存の生成・注入の順序、`onChange`の登録順、既存の関数・コールバックは変えない。機能専用の再描画・同期の呼び出しを足さない。`index.html`・`js/palette/`・`js/wiring/`・`asset/`は変更しない。
        *   `test/core/KeyboardShortcuts.test.js`（新規）：先頭に単一責務のJSDoc。要件4のテストの観点（`{}`での`Error`と文言、`nudgeSelection`だけを欠いたときに欠落名が`nudgeSelection`だけになること）を確かめる。コールバック群は`Proxy`で作り、action名の一覧をテスト側へ二重に書かない。ソースへ`export`の追加・privateの公開を行わない。補助関数にはJSDoc（`@param`・`@returns`）を書く。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝と`updateVertex`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク5: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
    *   **対象ファイル** :
        *   （原則として変更なし。漏れが見つかった場合のみ、タスク1〜4で触れたファイルを直す）
    *   **作業内容** :
        *   タスク1〜4で新規・更新した全ファイルについて、ファイル先頭の責務定義（3行以内）と、クラス・関数・メソッド・typedefのJSDoc（`@param`・`@returns`・責務）の記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝＝各図形の`drawHandles`・`resolvePressAction`のハンドルの枝・`CursorShapeRules`の選択モードのハンドルの枝・`CanvasManager.render`のハンドルを描く段と、`VectorModel.updateVertex`は**残す**）。
        *   `git status`・`git diff --stat`で、変更したファイルが本計画書の対象ファイルだけであることを確認する（`js/core/InputTracker.js`・`js/core/VectorModel.js`・`js/core/CanvasManager.js`・`js/core/UnitSnapRules.js`・`js/core/UnitSnapSettings.js`・`js/shapes/`・`js/io/`・`js/edit/SnapshotAdapter.js`・`js/edit/EndpointSnapper.js`・`js/palette/`・`js/wiring/`・`index.html`・`asset/`が変わっていないこと）。
        *   既存のテストの期待値を変えていないことを確認する（`git diff`で既存のテストファイルに変更が無いこと）。
        *   リポジトリのルートで`node --test`を実行し、全件通ること（`fail 0`）を確認し、`tests`・`suites`・`pass`の件数を控える（08-03前は tests 1411 / suites 216）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク6: 要件6 テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   `./_log/res/261117_1122_RES_Phase08-03_Arrow_Nudge.md` :（更新。詳細作業内容への記載のみ）
    *   **作業内容** :
        *   本計画書の「要件6: ふるまいの確認（テストプレイの確認項目）」の0〜17をそのまま発注者へ提示する（画面・操作・挙動の言葉で書く）。
        *   自動テストで確かめられない箇所（`KeyboardShortcuts`の矢印キーの受理判定・`main.js`の配線）を、特に確かめてほしい項目として添える。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ提示した内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク7: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/41_NudgeTargetRules.md` :（新規）
        *   `./_doc/arch/07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`14_edit.md`・`02_main.md`・`16_test.md`・`03_VectorModel.md`・`32_InputModes.md` :（更新）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄の全項目（各タスクでの追記を含む）を確認し、資料へ反映する。
        *   1章（ファイルの一覧・「存在しないもの」・フォルダ分割の方針・依存方向）、3章（19.の新設・6.の履歴・17.の丸めないもの・18.の頂点の選択）、4章の一覧（`41_NudgeTargetRules.md`の行）を更新する。
        *   `_doc/arch/`の各ファイルを更新予定欄のとおりに直す。`16_test.md`には新設4ファイルの検証範囲・テストできない箇所（08-03の追加）・書き換えた既存のテスト（無し）・件数（タスク5で控えた`node --test`の結果）を書く。
        *   記載基準に従う（1つのファイルのJSDocを読めば分かることは書かない。責務・境界・依存方向・流れと順序・誰が呼ぶか・設計判断の理由・やらないと決めたことを残す）。実コードと食い違う記述を作らない。
        *   **本タスクは開発資料の書き換えが明示的に許された唯一のタスク**であり、後続タスクは無い。ソースコード（`js/`・`test/`）は変更しない。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1 動かす対象を決める規則（`core/NudgeTargetRules`）
*   **作業内容** :
    *   `js/core/NudgeTargetRules.js`を新規作成（`resolveNudgeTarget`・`buildNudgeGroupKey`・typedef`NudgeTarget`。importは`InputModes`の`OperationMode`のみ）。
    *   `test/core/NudgeTargetRules.test.js`を新規作成（要件1のテスト観点を網羅）。
    *   `node --test`：1427件全件合格。

### タスク2: 要件2 履歴の記録の入口に「まとめの鍵」を足す（`core/HistoryManager`）
*   **作業内容** :
    *   `js/core/HistoryManager.js`：`commitEdit(groupKey)`（省略可）と非公開`#lastGroupKey`を追加。畳み・往復で消える場合の取り除き（鍵を忘れる）・`undo`/`redo`冒頭と`clear`での鍵の忘却を実装。戻り値の意味をJSDocに明記。不変条件「鍵を覚えている間は位置＝エントリ数」を`#lastGroupKey`と`commitEdit`のJSDocに記載。
    *   `test/core/HistoryManager.test.js`を新規作成（鍵つきの畳み・各区切り・往復消去・通知・引数なしの既存ふるまい・上限・警告）。補助関数にJSDocあり。
    *   `node --test`：1444件全件合格。
    *   （監査指摘対応）`HistoryManager`クラスのJSDocの箇条書きへ「同じ鍵で続けた記録は直前の1件へ畳む」旨の1行を追記（コメントのみ。ふるまい変更なし）。

### タスク3: 要件3 微調整の実体（`edit/NudgeEditor`）
*   **作業内容** :
    *   `js/edit/NudgeEditor.js`を新規作成（コンストラクタ`{ model, editRecorder, getMode }`・公開メソッド`nudge(dx, dy)`のみ・非公開`#buildVertexUpdates`）。importは`core/NudgeTargetRules`の2関数のみ（下向きの依存の理由をファイル先頭の責務JSDocの直後にコメントで記載）。クラスJSDocに、ワールド座標のpx・スナップと端点への吸い付きを通さないこと・通知1回／取り消し1件・記録先に触れない条件・`@param`／`@returns`を記載。
    *   `test/edit/NudgeEditor.test.js`を新規作成（図形の移動・頂点の移動・対象なし4通り・位置が求まらないハンドル・同じ／別の鍵・呼び出し順・小数のまま動く・ワールド座標）。補助関数にJSDocあり。
    *   `node --test`：1455件全件合格。

### タスク4: 要件4・要件5 矢印キーの8エントリと配線（`core/KeyboardShortcuts`・`main.js`）
*   **作業内容** :
    *   `js/core/KeyboardShortcuts.js`：非公開の定数`NUDGE_STEPS`・`NUDGE_DIRECTIONS`（要素も凍結）を1か所に追加し、対応表の末尾へ`flatMap`で8エントリ（`ctrl: false`・`Shift`なし`FORBIDDEN`／あり`REQUIRED`・`repeatable: true`・`action: 'nudgeSelection'`・凍結した`arg {dx, dy}`）を追加。エントリの直前に方向・量・`Ctrl`／`Alt`付きは一致しないことのコメントを記載。
    *   JSDoc更新：`ShiftRule`の`FORBIDDEN`・`REQUIRED`、`SHORTCUT_BINDINGS`の修飾キー規則、`#findBinding`の`REQUIRED`の説明を矢印キーが加わった実態へ修正。`ShortcutActions`のtypedefへ`nudgeSelection`を追加。ファイル先頭の責務・受理判定・既存エントリは変更なし。
    *   `js/main.js`：`NudgeEditor`のimport、`// 7.9. 微調整（矢印キー）配線`ブロック（`NudgeEditor`生成）を`// 7.8.`の後・`// 8.`の前に追加、`KeyboardShortcuts`注入へ`nudgeSelection`を`startEyedropper`の後に追加。既存の順序・`onChange`の登録順は不変。
    *   `test/core/KeyboardShortcuts.test.js`を新規作成（`{}`での`Error`と文言、`nudgeSelection`だけを欠いたときの欠落名。`Proxy`使用、補助関数にJSDocあり）。
    *   `node --test`：1457件全件合格。

### タスク5: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
*   **作業内容** :
    *   JSDoc確認：新規・更新の全ファイルの先頭責務（3行以内）と関数・メソッド・typedefのJSDocを確認。漏れは`test/core/NudgeTargetRules.test.js`のインライン補助関数`k`（2か所）のみで、`@param`・`@returns`つきのJSDocを追記（テストの中身は不変）。
    *   不要コード確認：未使用のimport・関数・定数は無し（`NudgeTargetRules`のimportは`InputModes`のみ、`NudgeEditor`のimportは`NudgeTargetRules`の2関数のみ）。
    *   変更範囲：`git diff --name-status`で、変更は計画書の対象ファイル（`js/core/HistoryManager.js`・`KeyboardShortcuts.js`・`NudgeTargetRules.js`・`js/edit/NudgeEditor.js`・`js/main.js`・テスト4件・本RES）のみ。`InputTracker`・`VectorModel`等の禁止対象は無変更。既存テストファイルの変更なし。
    *   『開発資料の更新予定』欄：`02_main.md`の行数を899→908へ訂正。（タスク4）の更新予定の内容は既に同欄で網羅済みのため重複追記せず。
    *   `node --test`：tests 1457 / suites 221 / pass 1457 / fail 0（08-03前は tests 1411 / suites 216）。

### タスク6: 要件6 テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   実装統括AI（オーケストレータ）が発注者へ直接提示済み。提示した内容は、本計画書「要件6: ふるまいの確認（テストプレイの確認項目）」の0〜17をそのまま（準備・図形1px/Shift10px・複数図形・頂点1px・頂点複数・対象なし・押しっぱなし・取り消しのまとまり・区切り3種・往復・スナップと無関係・入力欄との競合・ドラッグ中・他操作の非退行・多い図形での反応）。
    *   あわせて、自動テストで確かめられない箇所を特に確かめてほしい項目として添えた：`KeyboardShortcuts`の矢印キーの受理判定（項目6・14・15・16に関わる）、`js/main.js`の配線（項目1〜5・8〜12に関わる）。
    *   ソースコード・開発資料・テストは変更していない。`node --test`は再実行していない。

### タスク7: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   `PROJECT_ARCHITECTURE.md`：1章のファイル一覧（`NudgeTargetRules.js`・`NudgeEditor.js`・テスト4件）、「存在しないもの」（08-02a・08-02bの「矢印キーでの微調整」を外し、Phase 08-03の分を追記）、「フォルダ分割の方針」（`core/`の`NudgeTargetRules`・`edit/`の`NudgeEditor`）、「依存方向」（`main.js → edit/NudgeEditor`・`edit/NudgeEditor → core/NudgeTargetRules`（`edit/`から`core/`への最初の例）・`core/NudgeTargetRules → core/InputModes`、循環なし）、3章6.（記録する操作へ微調整、「まとめの鍵」の約束）、3章17.（丸めないものへ微調整）、3章18.（やらないこと2か所へ追記）、3章19.の新設（流れ・分担・対象の決め方・受理しないこと・まとめの区切り・スナップと無関係・キーリピート・キーの受理・発注者の決定・やらないこと・確認の状況）、4章の一覧へ`41_NudgeTargetRules.md`の行。
    *   `_doc/arch/41_NudgeTargetRules.md`を新規作成。`07_KeyboardShortcuts.md`（矢印キーのキーの項、`Shift`規則の説明を実態へ修正）・`08_HistoryManager.md`（まとめの鍵）・`14_edit.md`（`NudgeEditor`の項、`core/`のimportの例外）・`02_main.md`（`// 7.9.`・注入の一覧・行数908行）・`03_VectorModel.md`（`moveShapes`・`updateVertices`の呼び出し元）・`32_InputModes.md`（使う側）・`16_test.md`（新設4ファイル・テストできない箇所・書き換えた既存のテスト無し・件数 tests 1457 / suites 221、`NudgeEditor.test.js`が実物の`VectorModel`と図形クラスを使う例外）を更新。
    *   書く前に`js/core/NudgeTargetRules.js`・`js/edit/NudgeEditor.js`・`js/core/KeyboardShortcuts.js`・`js/core/HistoryManager.js`・`js/main.js`・各テストのimportと件数を読んで裏を取った。ソースコード（`js/`・`test/`）は変更していない。`node --test`は再実行していない（件数はタスク5で控えた値）。
    *   （追記）テストプレイの回答（2026-11-17、要件6の0〜17すべて問題なし）を受け、`PROJECT_ARCHITECTURE.md`3章19.の「確認の状況」と`_doc/arch/16_test.md`の「未反映」の記述を「全項目問題なし」に直した。他の`_doc/arch/`に同趣旨の記述は無かった。
    *   （追記）diff監査の軽微3件を修正：(1) `PROJECT_ARCHITECTURE.md`3章17.「丸めないもの」の句読点の重複（「。、」）を直し、新しい項目の文末に句点を足した。(2) `32_InputModes.md`のテストの列挙へ`test/core/NudgeTargetRules.test.js`・`test/edit/NudgeEditor.test.js`を足した（`VertexHandleRules.test.js`の既存の抜けは本作業のスコープ外のため触れていない）。(3) 3章16.「修飾キーを見る時点」へ、矢印キーの`Shift`（`keydown`の`event.shiftKey`で1px／10pxが決まる。19.参照）を足した。ソースコードは変更していない。

---

## 5. 懸念事項・要確認ポイント

* **`test/core/HistoryManager.test.js`は現在存在しない**（`_doc/arch/16_test.md`の一覧にも無く、履歴は`test/edit/`の各テストから間接的に確かめられていた）。REQの「`test/core/HistoryManager.test.js`にテストを足す」は新規作成として扱う。「既存のケースは変えない」は自動的に満たされる。
* **畳んだ結果エントリが消えたときに、覚えている鍵を忘れること**はREQに明記が無いが、忘れないと次の同じ鍵の微調整が**さらに前の無関係なエントリへ畳まれ**、そのエントリの「後の状態」が壊れる（取り消し1回で2つの操作が同時に戻る）。要件2の「まとまりの先頭の状態を残す」約束を守るために必要な設計判断として計画に入れた。
* **`commitEdit`の戻り値の意味**はREQに明記が無いため、「履歴に記録として残ったか」（新しいエントリ・畳んで残ったエントリ＝`true`、前後が同じ・畳んだ結果エントリが消えた・`beginEdit`なし＝`false`）と定義した。既存の呼び出し元は戻り値を使っていないため、既存のふるまいへの影響は無い。
* **`edit/`から`core/`をimportするのは本作業が最初**（`edit/NudgeEditor → core/NudgeTargetRules`）。依存方向（`main.js → edit → io → core → shapes`）に沿った下向きの向きであり、循環もしないが、`_doc/arch/14_edit.md`の「importは`DocumentSerializer`のみ（例外…）」の記述に例外を1つ足す必要がある（最終タスクで反映）。
* **`NudgeEditor`が操作モードの値を受け取ること**は、`edit/`の「操作モードを知らない」の約束と見かけ上ぶつかる。値を解釈せず（`OperationMode`をimportせず、比較も分岐もせず）規則へ渡すだけにすることで約束を守る設計にした（REQ 要件3の指定どおり）。
* **性能**（確認項目17）：微調整1回ごとに`capture`（作業データの直列化）と`JSON.stringify`の比較が最大3回（前後の比較＋畳んだ後の比較）走る。これは既存の編集操作1件と同じ仕組みで、**性能の改善を目的とした変更は行わない**（REQのスコープ外）。図形数が多い状態でのキーリピートの体感は、テストプレイで確かめてもらう。
* **矢印キーの受理判定そのもの（`event.code`での一致・`Shift`の分かれ方・キーリピート・入力欄とドラッグ中の見送り・`preventDefault()`の有無）は`node --test`で確かめられない**（`document`・`KeyboardEvent`に依存）。テストプレイの項目6・7・14・15・16で確かめる。
* **`Ctrl`＋矢印・`Alt`＋矢印**は意図的に一致させない（ブラウザ・OSの操作をそのまま通す）。`Shift`＋矢印は本作業で「10px動かす」の意味を持つため、将来`Shift`＋矢印に別の操作（方向の限定等）を割り当てることはできなくなる。

* **（タスク3）頂点の組み立てでは、位置が`null`の組に加え頂点インデックスが`null`の組（線の`'move'`＝中点。位置は返るがインデックスは無い）も飛ばした**。計画の「位置が求まらない組は飛ばす」の趣旨（`updateVertices`へ不正な組を渡さない）に沿う安全側の判断。通常`getVertexHandleNames()`由来の頂点の選択では起きない。
* **（タスク4）矢印キーのエントリの直前の説明は、既存の流儀に合わせ行コメント（`//`）で書いた**（JSDocへ書く指示のあった項目は`ShiftRule`・`SHORTCUT_BINDINGS`・`#findBinding`・`ShortcutActions`のJSDocに反映済み）。実際の矢印キーの動き（1px／10px・`Ctrl`／`Alt`での不一致・キーリピート・入力欄／ドラッグ中の見送り・実物の`HistoryManager`との結合での取り消し1件）はテストプレイで確認すること。
* **（タスク4）開発資料の更新予定**：`KeyboardShortcuts`の対応表に矢印キー8エントリ（`nudgeSelection`）が加わったこと、`main.js`に`// 7.9.`の配線と`NudgeEditor`が加わったこと、`test/core/KeyboardShortcuts.test.js`が新設されたこと（資料本体は未修正。タスク7で反映）。
* **（タスク3）テストの偽物は`editRecorder`・`getMode`のみ**。実物の`HistoryManager`との結合（畳み・取り消し1件）はタスク4以降／テストプレイで確認する。

* **（タスク7）テストプレイの結果は資料へ反映済み**：発注者のテストプレイ（2026-11-17）で要件6の0〜17のすべてが問題なしだった。`PROJECT_ARCHITECTURE.md`3章19.の「確認の状況」と`16_test.md`の「テストできない箇所（08-03の追加）」へ反映した。
* **（タスク7）まとめの区切り「選ぶ対象の変更」の実態**：鍵は微調整の時点の対象だけで判定し、選択の変更そのものは`HistoryManager`に届かない。別の対象を選んでから元の対象を選び直し、間に別の編集操作が挟まらなければ、直前のまとまりへ畳まれる。資料（3章19.）にその旨を書いた。発注者の決定の趣旨（対象が変われば区切る）と合うかは、テストプレイの確認項目（区切り3種）で確かめること。
* **（タスク7）`Shift`＋矢印キーは「10px動かす」に占められた**：将来、方向の限定などをこの組み合わせに割り当てられない（`PROJECT_ARCHITECTURE.md`1章「存在しないもの」と`07_KeyboardShortcuts.md`に記載）。
* **（タスク7）`02_main.md`の行数の行は、タスク7の着手前から全角括弧の開閉が1つ合っていない**（既存の状態）。今回足した分は括弧を閉じたが、既存の不整合は直していない。
