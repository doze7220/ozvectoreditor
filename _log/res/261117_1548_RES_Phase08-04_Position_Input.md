# RES: 作業計画・作業レポート (Phase 08-04) : 位置の数値入力
* 参照元REQ: `./_log/req/261117_1330_REQ_Phase08-04_Position_Input.md`

## 1. 作業目的

選んでいる**図形**、または選んでいる**頂点**の位置を、**ツールバーのオプションバーの数値の欄（X・Y）で直接指定できるようにする**。マウスのドラッグ・矢印キーでの微調整に続く「狙った位置に置く」ための3つめの入口であり、**既存のオプションバーの部品の作り（3層）と、既存の移動・履歴の仕組み（`VectorModel.moveShapes`／`updateVertices`・`HistoryManager`の`beginEdit`／`commitEdit`の対）の上に載せる**。新しい判定・新しい外枠の求め方・新しい同期の経路は作らない。

**本作業で満たすこと**

* 操作モードが**選択（`V`）**で図形を1つ以上選んでいるとき、位置の欄に**選択集合全体の外枠の左上**（線の太さを含む）が小数第1位まで出る。数値を確定すると、選んだ図形すべてが**位置関係を保ったまま**その位置へ動く。
* 操作モードが**頂点の選択（`A`）**で頂点を1つ以上選んでいるとき、位置の欄に**選んだ頂点全体の範囲の左上**（線の太さは無関係）が出る。数値を確定すると、選んだ頂点すべてが**位置関係を保ったまま**動く。
* **指定しなかった軸は動かない**（Xに入れたらX方向だけ動く）。
* **動かす対象がないとき**（何も選んでいない／`A`で頂点を1つも選んでいない＝図形だけを選んでいるときを含む／図形作成（`P`）・キャンバス移動（`H`）のモード）は、**欄を押せない見た目にして空にする**。
* **数値の確定1回が取り消し1件**（続けて確定した分をまとめない）。
* 欄の表示は、**既存の`model.onChange`の同期だけで**あらゆる経路（マウスでの移動・矢印キーでの微調整・取り消し／やり直し・選択の変更・モードの切り替え・線の太さの変更・キャンバスの切り替え）に追従する。

**変えないこと（これを破る変更は失敗とみなす）**

* 自動テスト（リポジトリのルートの`node --test`）が**全件通る**。**既存のテストの期待値を変えない**。
* 作業データ形式・書き出し形式・履歴のエントリの形を変えない（版はどちらも2のまま。欄の値は保存しない）。
* マウスでの操作・キーのふるまいを一切変えない。`js/core/InputTracker.js`・`js/core/KeyboardShortcuts.js`・`js/core/FocusKeyYieldRules.js`は**変更しない**（`type="number"`は既存の受理判定で**テキスト入力扱い**になるため、判定を足さない）。
* オプションバーの既存のまとまり（スタイル・重なり順）のふるまい・見た目・DOMのid・クラス名を変えない。ステータスバーの表示も変えない。
* 外枠の求め方を変えない・2通りにしない（`js/io/SpriteSerializer.js`・`js/edit/ShapeExtentReader.js`は**変更しない**）。
* スナップ（刻みへの丸め）・端点への吸い付きを位置の欄に働かせない。
* 改名・整形・「不要に見えるコードの削除」を行わない。既存の公開メソッド名・フィールド名・DOMのid・クラス名を変えない。

**発注者の決定（2026-11-17。計画で変えてはならない）**

1. **図形の位置は「外枠の左上」で表し、その外枠には線の太さを含める**（ステータスバーの「大きさ」・書き出しの`bounds`と同じ求め方）。**線の太さを変えると、図形を動かしていなくてもX・Yの表示が変わる**ことを受け入れる（仕様。不具合として直さない）。
2. **頂点を複数選んでいるときは、選んだ頂点全体の範囲の左上**を表示し、数値を入れると頂点どうしの位置関係を保ったまま全部が動く（複数の図形を選んでいるときと同じ考え方）。
3. **円・弧も、ほかの図形と同じく外枠の左上**で表す（中心の座標にしない。座標の規則に図形種別の分岐を持たせないため）。
4. **欄に出す数字は小数第1位まで**（`120.5`・`-40.0`）。**入力は小数・負の値をそのまま受け付ける**。
5. **何も動かす対象がないときは、欄を押せない見た目にして空にする**。
6. **数値の確定1回が取り消し1件**（続けて確定した分をまとめない＝まとめの鍵を使わない）。

**用語**（本計画書・コード・資料で使い分ける）

* **外枠**：図形（または選択集合全体）を囲む矩形。求め方の正本は`js/io/SpriteSerializer.js`の`computeShapesBounds`で、**線を描く図形は線の太さの半分だけ外側へ広げた範囲**になる（書き出しの`bounds`・ステータスバーの「大きさ」と同じ値）。照会の入口は`js/edit/ShapeExtentReader.js`。
* **頂点の範囲**：選んでいる頂点の位置だけを囲む矩形（線の太さは関係しない）。本作業で新しく求める（要件1）。
* **位置の欄**：本作業でオプションバーに足すX・Yの数値の欄（`#option-position-x`・`#option-position-y`）。
* **微調整（ナッジ）**：矢印キーで、選んでいる図形または頂点を決まった量だけ動かすこと（Phase 08-03）。
* **まとめの鍵**：続けた記録を取り消し1件へ畳むための鍵（`HistoryManager.commitEdit(groupKey)`）。**位置の数値入力では渡さない**。

---

## 2. アーキテクチャ設計

### 全体の流れ（新しい経路を作らず、既存の経路に載せる）

```
[表示]
model.onChange（既存の通知。選択・移動・取り消し/やり直し・モード切替・太さの変更すべてがこれを通る）
  → main.js の syncOptionBarPositionGroup()（// 7.10. 橋渡しのみ）
    → edit/PositionInputEditor.getPositionView()
        1. core/NudgeTargetRules.resolveNudgeTarget(モード, 図形の選択, 頂点の選択) → 対象 or null
        2. 対象の種類が 'shapes' なら edit/ShapeExtentReader.getSelectedBounds()（外枠。太さを含む）
           対象の種類が 'vertices' なら core/VertexHandleRules.computeVertexHandlesBounds(図形, 頂点の組)（頂点の範囲）
           （種類の値は NudgeTargetRules が返す 'shapes'／'vertices' のみ。ほかの値は存在しない）
        3. edit/PositionInputRules.buildPositionInputView(対象, 範囲) → { x, y, disabled }
             └ 数字の形は core/StatusReadoutRules.formatReadoutNumber（既存。丸めを書き直さない）
      → palette/OptionBarPositionGroup.render(view)（DOMへ値と disabled を当てるだけ）

[入力]
X・Yの欄の change（Enter・欄から出たとき・欄の矢印の操作）
  → palette/OptionBarPositionGroup（軸と欄の文字列をコールバックへ渡すだけ）
    → main.js の onPositionChange（positionInputEditor.setPosition(axis, text) を呼んで戻り値を返すだけ）
      → edit/PositionInputEditor.setPosition(axis, text)
          1. 上の 1.〜2. と同じ手順で対象と範囲を求める（対象なしなら false。記録先に触れない）
          2. edit/PositionInputRules.resolvePositionDelta(axis, text, 範囲) → {dx, dy} or null
             （null なら false。記録先に一切触れない＝履歴も通知も増えない）
          3. edit/NudgeEditor.nudgeWithoutGrouping(dx, dy)（要件3で足す入口。まとめの鍵を渡さない）
               └ 既存の対象の解決・移動の処理（moveShapes / updateVertices）と beginEdit/commitEdit を共有
      → 戻り値 false なら OptionBarPositionGroup が表示を実値へ戻す（太さの欄と同じ）
```

**3層の分担（オプションバーのスタイルのまとまりと同じ形）**

| 層 | ファイル | 持つもの／持たないもの |
| --- | --- | --- |
| DOM専任のUI部品 | `js/palette/OptionBarPositionGroup.js`（新規） | 要素の解決・`render`・`change`／`blur`の購読のみ。**importなし・状態なし・判定なし** |
| 表示と入力の規則 | `js/edit/PositionInputRules.js`（新規） | 欄に出す内容の算出・入力から移動量の算出。**状態なし・DOMなし**。importは`core/StatusReadoutRules`の`formatReadoutNumber`のみ |
| 編集操作 | `js/edit/PositionInputEditor.js`（新規） | 対象と範囲の解決、規則の呼び出し、移動の委譲。**DOMなし・`HistoryManager`を直接受け取らない** |
| 配線 | `js/main.js`（更新） | 生成・注入・受け渡し・既存の`model.onChange`への同期の追加のみ。**判定・計算を書かない** |

**正本（同じ判定・同じ計算・同じ丸めを2か所に書かない）**

* 動かす対象の判定＝`js/core/NudgeTargetRules.resolveNudgeTarget`（既存。本作業で書き直さない）
* 外枠の求め方＝`js/io/SpriteSerializer.computeShapesBounds`、照会の入口＝`js/edit/ShapeExtentReader`（既存。本作業で書き直さない）
* 頂点の範囲＝`js/core/VertexHandleRules.computeVertexHandlesBounds`（要件1で新設）
* 数字の形（小数第1位・`-0`を`0.0`）＝`js/core/StatusReadoutRules.formatReadoutNumber`（既存。importして使う）
* 移動量を対象へ当てる処理と履歴への記録＝`js/edit/NudgeEditor`（既存。要件3で入口を1つ足すだけ）

---

### 要件1: 選んでいる頂点の範囲を求める規則（`js/core/VertexHandleRules.js`。更新）

既存の3関数（`collectVertexHandles`・`isVertexHandle`・`collectVertexHandlesInRect`）は**一切変えず**、関数を1つ足す。

```js
computeVertexHandlesBounds(shapes, vertices) → {minX, minY, maxX, maxY} | null
```

* 引数：`shapes`＝図形の配列（描画順のまま。並びは結果に影響しない）、`vertices`＝`Array<{shapeId: string, handle: string}>`。
* 手順：各組について`shapes`から`id`が一致する図形を引き（無ければ飛ばす）、`shape.getHandlePosition(handle)`で位置を求め（`null`は飛ばす）、**位置が求まった組だけ**から`Math.min`／`Math.max`で最小・最大のX・Yを求める。
* 組が飛ばされるのは次の2つの場合だけである（実コードで確認した前提）：**`shapes`に一致する`id`が無い**場合と、**`getHandlePosition(handle)`が`null`を返す場合＝その図形が知らない（未知の）ハンドル名**の場合。なお**円・弧（`shapes/Ellipse.js`）は`getVertexHandleNames()`が空配列を返すだけで、`getHandlePosition('right')`等は位置を返す**（＝「円・弧なら位置が求まらない」わけではない）。本関数は渡された組をそのまま引くだけで、`getVertexHandleNames`を見る・頂点として扱えるハンドルかを判定することはしない（その判定は呼び出し側＝選択の時点で済んでいる）。
* 戻り値：`{minX, minY, maxX, maxY}`（外枠と同じ形。頂点1つなら最小と最大が同じ値）。**組が0件・どれも位置が求まらない場合は`null`**。
* **線の太さは見ない**（頂点の位置だけ）。`getVertexIndexForHandle`も呼ばない（範囲を求めるのに不要）。
* 図形種別の分岐・図形固有のプロパティ名・頂点インデックスの規約を持たない。引数を書き換えない。**importは現在のまま**（`core/InputModes`の`OperationMode`のみ。本関数はモードを見ない）。
* `collectVertexHandles`・`collectVertexHandlesInRect`と**走査を共有しない**（集める条件と戻り値の形が違い、共通化すると既存関数の本体を書き換えることになるため。既存の2関数の分け方の理由と同じ）。
* ファイル先頭の責務定義（3行以内）に「選んでいる頂点の範囲」を加える（既存の3つの役割の記述は残す）。

**テスト**（`test/core/VertexHandleRules.test.js`へ`describe('computeVertexHandlesBounds')`を追加。既存のケースは変えない）：頂点1つ（最小＝最大）／同じ図形の複数の頂点／複数の図形にまたがる頂点／存在しない図形のidを含む組（飛ばす）／**未知のハンドル名**を含む組（`getHandlePosition`が`null`を返す名前。飛ばす。全部そうなら`null`）／0件で`null`／引数（`shapes`・`vertices`）を書き換えないこと。実物の図形クラスを使う（既存のテストと同じ方式）。

* 「位置が求まらない」ケースは**未知のハンドル名**（例：`'nope'`のような、どの図形も知らない名前）で作る。**円・弧を「位置が求まらない例」として使わない**（`Ellipse.getHandlePosition('right')`等は位置を返すため、期待値が合わない）。円・弧を使う場合は「`getVertexHandleNames()`が空でも、組で渡されたハンドル名の位置は求まる」ことを確かめるケースとして書いてよい（任意）。

---

### 要件2: 位置の欄に出す内容と、入力から移動量を求める規則（`js/edit/PositionInputRules.js`。新規）

状態を持たず、DOM（要素・id・クラス名）に触れず、`VectorModel`・図形のインスタンス・履歴・イベントを知らない。importは`../core/StatusReadoutRules.js`の`formatReadoutNumber`のみ（`edit → core`の下向きの依存。`NudgeEditor`に続く2つめの例で、`StatusReadoutRules`はimportを持たないため循環しない）。

**公開するもの**

```js
export const POSITION_AXIS = Object.freeze({ X: 'x', Y: 'y' });   // 軸の値の唯一の定義箇所
buildPositionInputView(target, bounds) → { x: string, y: string, disabled: boolean }
resolvePositionDelta(axis, text, bounds) → { dx: number, dy: number } | null
```

* typedef`PositionInputView`（`x`・`y`・`disabled`）を書く。`palette/OptionBarPositionGroup.js`と**同じ内容の二重定義**（形を変えるときは両方を揃える。`StylePanelView`・`ShapeOrderAvailability`と同じ扱い）。
* `buildPositionInputView(target, bounds)`
  * `target`が`null`／`undefined`、`bounds`が`null`／`undefined`、`bounds.minX`・`bounds.minY`のどちらかが有限でない → `{ x: '', y: '', disabled: true }`。
  * それ以外 → `{ x: formatReadoutNumber(bounds.minX), y: formatReadoutNumber(bounds.minY), disabled: false }`。
  * `target`は**種類で分岐しない**（「対象なしか」だけを見る）。`formatReadoutNumber`が「有限でない数」に返す記号（`—`）は数値の欄に入れられないため、**上の「有限でない → 押せない」で先に弾く**。丸めを本ファイルに書かない。
* `resolvePositionDelta(axis, text, bounds)`
  * `text`が文字列でない／前後の空白を除いて空／`Number`で有限の数にならない → `null`（受理しない。`parseStrokeWidthInput`と同じ書き方にそろえる。`Number('')`が`0`になるため空の判定を先に行う）。
  * `bounds`が`null`／`undefined`、対象の軸の最小値が有限でない → `null`。
  * `axis`が`POSITION_AXIS.X` → `{ dx: 入力値 - bounds.minX, dy: 0 }`。`POSITION_AXIS.Y` → `{ dx: 0, dy: 入力値 - bounds.minY }`。**それ以外の`axis`は`null`**。
  * 求めた移動量が`0`（`dx === 0 && dy === 0`）なら`null`（何もしない）。
  * **スナップ（刻みへの丸め）・端点への吸い付きを行わない**（入れた値そのものへ動かす）。`UnitSnapRules`・`UnitSnapSettings`・`EndpointSnapRules`をimportしない。
  * 引数を書き換えず、毎回新しいオブジェクトを返す。
* 表示は小数第1位に丸めるが**移動量は丸めない**（例：外枠の左上が`10.04`で欄に`10.0`と出ている状態で`20`を入れると、`20 - 10.04 = 9.96`動いて左上はちょうど`20`になる）。欄の表示の丸めを位置の値へ持ち込まないため、この順序を変えない。

**`js/core/StatusReadoutRules.js`（責務定義のみ更新）**：先頭の責務定義が「ステータスバーの」限定の書き方になっているため、**オプションバーの位置の欄も使うことを反映する**（3行以内）。関数のふるまい・文言・記号・公開名は**一切変えない**。

**テスト**（`test/edit/PositionInputRules.test.js`。新規）：対象なし／範囲なし／範囲の値が有限でない（`Infinity`・`NaN`）→ 空＋押せない。小数第1位の表示（`120.45` → `120.5`）・負の値（`-40` → `-40.0`）・`-0`と`-0.04`が`0.0`になること。入力＝空文字・空白のみ・数値でない文字列（`abc`）・`Infinity`／`NaN`になる文字列は`null`。X軸では`dy`が0、Y軸では`dx`が0になること。移動量0で`null`。未知の軸で`null`。小数・負の値がそのまま移動量になること（丸めないこと）。引数（`bounds`）を書き換えないこと。

---

### 要件3: 移動量を当てる入口の追加（`js/edit/NudgeEditor.js`。更新）

**既存の`nudge(dx, dy)`の名前・引数・ふるまいは一切変えない。**

```js
nudgeWithoutGrouping(dx, dy) → boolean   // 新規。まとめの鍵を渡さずに1件として記録する
```

* 違いは**記録のときにまとめの鍵を渡さないこと（`commitEdit()`を引数なしで呼ぶ）**だけ。続けて呼んでも直前の1件へ畳まれず、1回ごとに取り消し1件になる（`HistoryManager`は鍵が無ければ新しいエントリを足し、記憶している鍵を忘れる＝次の矢印キーの微調整が位置の数値入力の1件へ畳まれることもない）。
* それ以外（対象の解決・図形と頂点の動かし方・対象なしや頂点0件のときに記録先へ一切触れずに`false`を返すこと・戻り値の意味）は`nudge`と同じ。
* **対象の解決と移動の処理は既存のメソッドと共有する**（同じ処理を2か所に書かない）。実装は非公開メソッドへ括り出し、2つの公開メソッドはそれを呼ぶだけにする：

```
nudge(dx, dy)                → #applyMove(dx, dy, true)    // 鍵あり（既存のふるまい）
nudgeWithoutGrouping(dx, dy) → #applyMove(dx, dy, false)   // 鍵なし
#applyMove(dx, dy, grouped)  → 対象の解決 → 図形は moveShapes / 頂点は #buildVertexUpdates + updateVertices
                               記録は grouped なら commitEdit(buildNudgeGroupKey(対象))、そうでなければ commitEdit()
```

* `commitEdit()`は**引数を渡さずに呼ぶ**（`undefined`を渡す形にしない。偽物の記録先で「鍵が渡らないこと」を確かめられるようにするため）。`buildNudgeGroupKey`は鍵ありのときだけ呼ぶ。
* `#buildVertexUpdates`は変更しない。importも増やさない（`resolveNudgeTarget`・`buildNudgeGroupKey`のまま）。
* **ファイル先頭の責務定義を書き直す**：「矢印キーでの微調整」限定の書き方から、**「選んでいる図形・頂点を移動量だけ動かす1件の編集操作（矢印キーでの微調整と位置の数値入力の両方が使う）」**の意味へ（3行以内）。**ファイル名・クラス名は変えない**。クラスのJSDocと公開メソッドのJSDocも実態に合わせる（まとめの鍵の有無の違い、呼び出し元が2つになること）。

**テスト**（`test/edit/NudgeEditor.test.js`へ追加。既存のケースは変えない）：`nudgeWithoutGrouping`で図形が動くこと／頂点が動くこと／記録先の`commitEdit`へ**まとめの鍵が渡らないこと**（引数の個数が0であること）／続けて2回呼ぶと`beginEdit`・`commitEdit`の対が2回記録されること／対象なし（選択なし・`CREATE`等）と頂点0件で記録先を呼ばないこと（`false`）。既存の`nudge`が鍵を渡し続けていることのケースはそのまま残す。

**テストに必要な準備（共有ヘルパの拡張。既存のケースの期待値は変えない）**：現在の`setup()`の偽の記録先は`commitEdit: (key) => calls.push(['commitEdit', key])`で、**引数を1つ受け取る形のため「鍵が渡らないこと」と「`undefined`が渡ったこと」を区別できない**。そこで**共有ヘルパの偽の記録先1行だけを可変長引数へ広げる**：

```js
commitEdit: (...args) => calls.push(['commitEdit', ...args])
```

* 引数の個数は記録の長さ（`記録.length - 1`）で読める。鍵なしの呼び出しは`['commitEdit']`（長さ1）、鍵ありは`['commitEdit', 鍵]`（長さ2）。
* **既存のケースの期待値は変わらない**：鍵ありの呼び出しの記録は今と同じ`['commitEdit', 鍵]`のままなので、鍵を`c[1]`で読んでいる既存のケース（同じ対象なら同じ鍵・対象を変えると別の鍵）も、`names(calls)`で呼び出し名の並びだけを見ている既存のケースも、`assert.deepEqual(calls, [])`で記録先に触れないことを見ている既存のケースも、すべてそのまま通る。
* 新しい偽物をもう1つ作る案（`setup()`を増やす・テスト内で別の記録先を組む）は採らない。**同じ偽物を2通り持つと記録の形が2つになり、以後のケースがどちらを使うのか曖昧になる**ため、共有ヘルパ1か所の拡張を選ぶ。
* ヘルパのJSDoc（`setup`の説明「偽のeditRecorderの呼び出しとモデルの変更通知は、同じ`calls`へ呼ばれた順に記録する」）に、**引数は渡された分だけ記録する（＝引数の個数が読める）**ことを補う。

---

### 要件4: 位置の数値入力の編集操作（`js/edit/PositionInputEditor.js`。新規）

**DOM（要素・id・クラス名）を知らない。** `edit/`の約束どおり操作モードの値を解釈しない（`getMode`の戻り値を規則へ渡すだけ）。

**注入で受け取るもの**（他の`edit/`のクラスと同じく検証しない）

```js
new PositionInputEditor({ model, getMode, shapeExtentReader, nudgeEditor })
```

* `model`＝`VectorModel`。使うのは`getSelectedIds`・`getSelectedVertices`・`getShapes`だけ（**読むだけ。書き換えない**）。
* `getMode`＝現在の操作モードを返す関数（`() => inputTracker.getMode()`）。
* `shapeExtentReader`＝外枠の照会（`getSelectedBounds()`だけ使う）。
* `nudgeEditor`＝移動量を当てる編集操作（`nudgeWithoutGrouping(dx, dy)`だけ使う）。
* **`HistoryManager`は直接受け取らない**（記録は`NudgeEditor`に任せ、`beginEdit`／`commitEdit`をこのクラスに書かない）。

**import**：`../core/NudgeTargetRules.js`の`resolveNudgeTarget`、`../core/VertexHandleRules.js`の`computeVertexHandlesBounds`、`./PositionInputRules.js`の`buildPositionInputView`・`resolvePositionDelta`。いずれも下向き（`edit → core`・`edit`内）で循環しない。

**公開するもの**

| メソッド | 内容 |
| --- | --- |
| `getPositionView()` | 対象と範囲を求め、`buildPositionInputView`の結果を返す。**図形・選択集合・履歴を変更しない**（純粋な照会。`ShapeStyleEditor.getPanelView`と違い覚えている値を持たない） |
| `setPosition(axis, text)` | 同じ手順で対象と範囲を求め、`resolvePositionDelta`で移動量を求め、`null`なら**記録先に一切触れず**`false`。求まったら`nudgeEditor.nudgeWithoutGrouping(dx, dy)`の戻り値を返す |

**対象と範囲の解決（非公開メソッド1つに括り、2つの公開メソッドが共有する）**

1. `resolveNudgeTarget(this.#getMode(), model.getSelectedIds(), model.getSelectedVertices())` → 対象（`null`のことがある）。
2. 対象が`null` → 範囲も`null`。
3. 対象が`'shapes'` → `shapeExtentReader.getSelectedBounds()`（外枠。線の太さを含む。対象の図形idは選択集合そのものなので絞り込みを二重に書かない）。
4. 対象が`'vertices'` → `computeVertexHandlesBounds(model.getShapes(), 対象.vertices)`（頂点の範囲）。

* 図形種別の分岐・図形固有のプロパティ名を持たない（対象の`type`は`NudgeTargetRules`が決めた対象の種類で、図形種別ではない）。
* 再描画・UI同期を自分で呼ばない（既存の`model.onChange`の経路に任せる）。ビュー変換（表示倍率・スクロール）を読まない（値はワールド座標のpx）。
* `try/catch`を持たない（`getSelectedBounds`の`@throws`は既存のステータスバーの大きさの表示と同じ条件で、新しい危険を増やさない）。

**テスト**（`test/edit/PositionInputEditor.test.js`。新規）

偽物を置く場所は**2通りを使い分ける**（どちらもREQ:84の「記録先・操作モードは素のオブジェクト・関数の偽物で置き換えること」を満たす。`VectorModel`・図形クラスは両方とも実物、`getMode`は両方とも素の関数の偽物、`shapeExtentReader`は**両方とも実物の`ShapeExtentReader({ model })`**＝外枠の求め方の正本であり、偽物にすると「外枠の左上」の確認が意味を失うため）。

| 組み方 | `nudgeEditor` | 記録先 | 何を確かめるか |
| --- | --- | --- | --- |
| A（実物を通す） | **実物の`NudgeEditor`**（`{ model, editRecorder: 偽の記録先, getMode }`で生成。`model`・`getMode`は`PositionInputEditor`と同じものを渡す） | 偽の`editRecorder`（`{ beginEdit, commitEdit }`の素のオブジェクト。`HistoryManager`の代わり） | **図形・頂点が実際にその位置へ動くこと**（モデルの座標で確認） |
| B（呼ばれないことを見る） | **偽の`nudgeEditor`**（`{ nudgeWithoutGrouping: (...args) => { 呼び出しを記録して戻り値を返す } }`の素のオブジェクト） | （`PositionInputEditor`は記録先を受け取らないため無し） | **移動先に一切触れないこと**と、移動量・戻り値の素通し |

* **Aで確かめるもの**：図形1つ（外枠の左上が出る・Xに値を入れると図形がその位置へ動く）／図形複数（**図形どうしの位置関係が保たれる**・外枠の左上が選択全体の値になる）／頂点1つ（その頂点だけが動く）／頂点複数（**頂点どうしの位置関係が保たれる**）／**X軸だけ変えたときにY座標が変わらないこと**（Y軸も同様）／線の太さを変えると外枠の左上の表示が変わること（決定1の確認）／`getPositionView()`の`disabled`が対象の有無で切り替わること／`getPositionView()`が図形・選択集合を変えないこと。
* **Bで確かめるもの**：対象なし（選択なし・`A`で頂点0件・`CREATE`・`PAN`）で`false`になり**`nudgeWithoutGrouping`が1回も呼ばれないこと**／受理しない入力（空文字・数値でない文字列・同じ値＝移動量0）で`false`になり**呼ばれないこと**／受理する入力では`nudgeWithoutGrouping`へ求めた`{dx, dy}`が渡り、その戻り値がそのまま`setPosition`の戻り値になること。
* 記録が1件ずつになること・まとめの鍵が渡らないことは**要件3のテストで確かめるため、ここでは重ねて確かめない**（Aの偽の記録先は、実物の`NudgeEditor`を動かすために必要なだけの素のオブジェクトとして置く）。
* 2つの組み方は補助関数2つ（JSDoc付き）に分け、どのテストがどちらを使うかをテスト名から分かるようにする。

---

### 要件5: オプションバーの位置のまとまり（`index.html`。更新）

**HTML**：`#option-order-group`の**後ろ（オプションバーの末尾）**に、まとまりを1つ足す。既存のまとまりの並び・DOMのid・クラス名は変えない。

```html
<div id="option-position-group" class="toolbar-group">
    <span class="option-unit">X:</span>
    <input type="number" id="option-position-x" step="any" title="選択の外枠の左上のX座標（線の太さを含む。頂点の選択では選んだ頂点の左上）">
    <span class="option-unit">Y:</span>
    <input type="number" id="option-position-y" step="any" title="選択の外枠の左上のY座標（線の太さを含む。頂点の選択では選んだ頂点の左上）">
    <span class="option-unit">px</span>
</div>
```

* 要素idの接頭辞は既存どおり`option-`。`value`・`disabled`等の初期値は**書かない**（起動時に`main.js`が1回同期する。既定値を二重に書かない。重なり順の4ボタンの`disabled`は`FocusKeyYieldRules`の判定の都合で例外だったが、数値の欄にはその都合がない）。
* `step="any"`で**小数を入れられる**ようにし、`min`・`max`を**付けない**ことで**負の値**も上限・下限なしで入れられる（太さの欄の`min`・`max`・`step`の書き方にならい、位置には範囲を設けないという判断）。欄の上下の矢印は1pxずつ動く（ブラウザ既定。矢印キーでの微調整の1pxと同じ量になる）。
* `title`に「外枠の左上の座標（線の太さを含む）」の意味が分かる説明を入れる。**キーの割り当ては足さないため`title`にキーは書かない**。
* `X:`・`Y:`・`px`は既存の`.option-unit`（オプションバーの小さな添え字の見た目。font-size 12px・色#666）をそのまま使う。**新しいクラス・新しい見た目の決まりを作らない**（`.option-unit`のCSSコメントに「単位と欄の見出し」の意味を補うだけで、宣言の値は変えない）。
* 今回やらないこと（大きさ・角度の欄）を後から足せるように、**位置は位置だけのまとまり**にする（将来は`#option-size-group`等を隣へ足すだけで、本まとまり・UI部品・配線を作り直さずに済む）。

**CSS**：既存の`#option-stroke-width`のルール（`box-sizing: border-box; width: 56px; height: 24px; user-select: text;`）の**セレクタに位置の2つの欄を加える**（`#option-stroke-width, #option-position-x, #option-position-y`）。宣言の値は変えないため太さの欄の見た目は変わらず、同じ値を2か所に書かない。コメントも「太さの欄・位置の欄」に直す（`.toolbar`の`user-select: none`は変えない）。

**押せないときの見た目**：`disabled`属性のみ（ブラウザ既定のグレー表示）。既存の押せないボタン・押せない欄（塗りの色の欄・重なり順のボタン）と同じ扱いで、**新しい見た目を作らない**。

**1280px幅に収まるかの確認**：起点は`_doc/COWORK_STATUS.md`2章Cの実測「ツールバーの最後のボタン（⏬）の右端は1280px幅で左から637px」。足す分は、まとまりの区切り17px（罫線1px＋`margin-left`8px＋`padding-left`8px）＋中身（`X:`約15px＋欄56px＋`Y:`約15px＋欄56px＋`px`約16px＋`gap`4px×4＝16px＝約174px）＝**約191px**。合計**約828px**で、1280pxに対して余裕が約450pxあるため**1行に収まる**（判断：実装を進める）。`index.html`のCSSコメント「ツールバー全体の幅の見積もり」（現在「約646px」）は、位置のまとまりの分を加えた値へ更新する。実測の確認は要件8の確認項目0で発注者に見てもらう。

---

### 要件6: UI部品（`js/palette/OptionBarPositionGroup.js`。新規）

既存のオプションバーのUI部品（`OptionBarStyleGroup`・`OptionBarOrderGroup`）と**同じ約束**：**importを持たず、状態・判定を持たず、図形データ・選択状態に関与しない**（受け取るのは`render(view)`の内容とコンストラクタのコールバックのみ）。

**公開するもの**

* コンストラクタ`(groupElement, actions)`：`actions.onPositionChange`が関数でなければ`Error`を投げる（起動時に気づけるようにする。`OptionBarStyleGroup`と同じ）。要素はルート要素内の`querySelector('#id')`で解決し、1つでも欠ければ`console.warn`して配線しない（以後の`render`は何もしない。`OptionBarStyleGroup`と同じ）。
* `render(view)`：`view.x`・`view.y`の文字列と`view.disabled`を表示へ当てるだけ。
  * `disabled`は毎回当てる。`value`は**その欄にフォーカスがある間は書き換えない**（打ち込み途中の値が`model.onChange`で消えないため。太さの欄と同じ）。
  * 最後に表示した内容（`#lastView`）を保持し、書き戻しに使う（太さの欄と同じ）。

**操作の通知**

* X・Yそれぞれの欄の`change`（`Enter`・欄から出たとき・欄の矢印の操作）で`actions.onPositionChange(軸, 欄の文字列)`を呼び、**戻り値が`false`（受理されなかった）なら表示を実値（最後の`view`）へ戻す**（太さの欄と同じ）。
* `blur`でも最後の`view`で書き戻す（太さの欄と同じ）。
* **`input`は購読しない**（1文字打つごとに図形が動かないようにするため。理由をJSDocに書く）。
* 軸の値は`'x'`・`'y'`の文字列をそのまま渡す（`OptionBarStyleGroup`が色の項目に`'stroke'`・`'fill'`を渡すのと同じ形）。**値の正本は`edit/PositionInputRules.js`の`POSITION_AXIS`**で、本ファイルは同じ文字列を持つ二重定義（importを持たない約束のため。形を変えるときは両方を揃える）。
* typedef`PositionInputView`（`x`・`y`・`disabled`）と`OptionBarPositionGroupActions`（`onPositionChange`）を書く。

**テスト**：置かない（DOMに依存するため）。`_doc/arch/16_test.md`の「テストできない箇所」へ記載する（最終タスク）。

---

### 要件7: 配線（`js/main.js`。更新）

`// 7.9.`（微調整）の後・`// 8.`（キーボードショートカット）の前に、**`// 7.10.` オプションバー（位置のまとまり）配線**のブロックを足す（`// 7.7.`・`// 7.8.`と同じ形）。

```
// 7.10. オプションバー（位置のまとまり）配線
//   表示＝OptionBarPositionGroup（palette/）、欄の内容と移動量の規則＝PositionInputRules（edit/）、
//   手順＝PositionInputEditor（edit/）、移動と記録＝NudgeEditor（// 7.9. で生成した同じインスタンス）。
//   ここは生成・注入・同期のみ（判定・計算を書かない）。表示の同期は model.onChange のみ。
const shapeExtentReader = new ShapeExtentReader({ model });
const positionInputEditor = new PositionInputEditor({
    model,
    getMode: () => inputTracker.getMode(),
    shapeExtentReader,
    nudgeEditor
});
const optionBarPositionGroup = new OptionBarPositionGroup(document.getElementById('option-position-group'), {
    onPositionChange: (axis, text) => positionInputEditor.setPosition(axis, text)
});
function syncOptionBarPositionGroup() { optionBarPositionGroup.render(positionInputEditor.getPositionView()); }
model.onChange(syncOptionBarPositionGroup);
```

* 追加するimportは3つ：`./edit/PositionInputEditor.js`・`./palette/OptionBarPositionGroup.js`・`./edit/ShapeExtentReader.js`（既存のimportの並びの作法にそろえる）。
* 外枠の照会は**`main.js`で1つ生成**して要件4のクラスへ渡す。**`js/wiring/DisplayWiring.js`は変更しない**（同クラスが内部で持っている照会はそのまま。`ShapeExtentReader`は状態を持たない照会のため2つあっても値は同じで、`DisplayWiring`の内部構成を本作業で揺らさない方を選ぶ）。
* 要件3のクラス（`NudgeEditor`）は、**矢印キーの配線で使っているインスタンスをそのまま渡す**（2つ生成しない）。そのため生成順は`// 7.9.`の後でなければならない（`inputTracker`・`historyManager`・`model`はいずれもこれより前に生成済み）。
* 起動時の1回の同期も、既存の「起動時に明示的に1回ずつ同期する」並び（`syncOptionBarOrderGroup()`の後）へ**同じ形で足す**（コメントの書き方も既存にそろえる）。
* **位置の欄専用の再描画・同期の経路を作らない**。`document`へのイベントの購読も足さない。
* コールバックは欄の文字列をそのまま渡し、戻り値をそのまま返すだけ（判定を書かない）。`inputTracker.isDragging()`は見ない（`// 7.7.`の太さの欄と同じ理由。見ると打ち込んだ値が失われる）。

**既存の通知だけで追従することの確認**（新しい通知を足さない根拠）

| 操作 | 追従の経路 |
| --- | --- |
| 操作モードの切り替え（`V`／`A`／`P`／`H`） | `applyMode` → `inputTracker.setMode` → `model.clearSelection()`（無条件に通知） |
| 選択の変更・頂点の選択の変更 | `VectorModel`の選択の変更がすべて通知 |
| 図形の移動（マウス・矢印キー）・取り消し／やり直し・キャンバスの切り替え | `moveShapes`／`updateVertices`／スナップショットの適用／図形一式の差し替えがすべて通知 |
| 線の太さの変更 | `updateShapeStyles`が通知（外枠に太さを含むため表示が変わる＝決定1のとおり） |
| 図形の作成・削除 | `addShape`／削除が通知 |

---

### 要件8: ふるまいの確認（テストプレイの確認項目）

0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。1280px幅のウィンドウで、**ツールバーが1行に収まり、右端（`px`まで）が切れていない**ことを確かめる。直線・曲線・矩形・パス・円・弧をいくつか描いておく。
1. **何も選んでいないとき**：位置の欄（X・Y）が押せない見た目で空になっている。
2. **図形1つ**：選択（`V`）で図形を1つ選ぶと、X・Yに外枠の左上の座標が小数第1位まで出る。ステータスバーの大きさ（`W:`・`H:`）の表示と見比べて、同じ外枠の値になっている（左上＋大きさ＝右下）。
3. **数値を入れて動かす**：Xに数値を入れて`Enter`を押すと、図形がその位置へ動く（横だけ動き、縦は動かない）。Yも同じ。欄から出たとき（`Tab`・キャンバスのクリック）・欄の上下の矢印でも同じように確定する。
4. **取り消し**：確定1回が取り消し（`Ctrl`+`Z`）1回で戻る。続けて2回確定したら、取り消しも2回必要になる。
5. **図形を複数**：図形を2つ以上選ぶと、選択全体の外枠の左上が出る。数値を入れると、図形どうしの位置関係を保ったまま全部が動く。
6. **線の太さとの関係**：図形を選んだまま線の太さを変えると、図形を動かしていないのにX・Yの表示が変わる（ステータスバーの大きさも同じく変わる）。これは外枠に太さを含める決定どおりで、不具合ではない。
7. **円・弧**：円・弧を選ぶと、中心ではなく外枠の左上の座標が出る。数値を入れるとその位置へ動く。
8. **頂点1つ**：頂点の選択（`A`）で頂点を1つ選ぶと、その頂点の座標が出る。数値を入れるとその頂点だけが動き、図形の形が変わる。
9. **頂点を複数**：頂点を2つ以上（別の図形の頂点を含めてよい）選ぶと、選んだ頂点全体の左上が出る。数値を入れると、頂点どうしの位置関係を保ったまま全部が動く。
10. **対象がないとき**：頂点の選択（`A`）で図形だけを選んで頂点を選んでいないとき、図形作成（`P`）・キャンバス移動（`H`）のときは、欄が押せない見た目で空になる。
11. **小数と負の値**：`-40.5`のような値を入れられ、そのとおりの位置へ動く。グリッドのスナップを10pxにしていても、入れた値が刻みへ丸められない。
12. **おかしな入力**：欄を空にして`Enter`、文字を入れて`Enter`、同じ値のまま`Enter`のいずれでも図形は動かず、欄の表示が実際の値へ戻る（取り消しの履歴も増えない）。
13. **ほかの経路との追従**：マウスで図形を動かす・矢印キーで微調整する・取り消し／やり直しをする・ツールを切り替える・選ぶ対象を変えると、そのたびに欄の表示が実際の位置へ追従する。
14. **欄にフォーカスがある間のキー**：欄に数字を打っている間は、`V`・`A`・`P`・数字・`Delete`・`Z`／`X`／`C`・`Tab`以外のショートカットが働かず、矢印キーも欄の数値の増減に使われる（図形・頂点は動かない）。欄の外へフォーカスを戻すと、また働くようになる。
15. **ほかの操作が今までどおり**：オプションバーのスタイル（線・塗りのON/OFF・色・太さ）と重なり順の4ボタン、ステータスバーの表示、ツールパレット、キャンバスパレット、保存・読み込み・書き出し、表示の切り替えが今までどおり動く。
16. **表示倍率と無関係**：表示倍率を変えても、欄の値はワールド座標のpxのまま（書き出したファイルの座標と同じ値）で変わらない。

---

### 関連フォルダと論理クラス

* **対象フォルダ**
  * `./js/core/` － 状態を持たない規則（`VertexHandleRules`に頂点の範囲を足す。`StatusReadoutRules`は責務定義のみ）
  * `./js/edit/` － 編集操作と表示・入力の規則（`PositionInputRules`・`PositionInputEditor`を新設、`NudgeEditor`へ入口を1つ追加）
  * `./js/palette/` － DOM専任のUI部品（`OptionBarPositionGroup`を新設）
  * `./index.html` － オプションバーの位置のまとまり（HTMLとCSS）
  * `./js/main.js` － 生成・注入・同期の配線（`// 7.10.`）
  * `./test/core/`・`./test/edit/` － 自動テスト
* **関連する論理クラス・関数**
  * 新規：`PositionInputRules`（`POSITION_AXIS`・`buildPositionInputView`・`resolvePositionDelta`）、`PositionInputEditor`（`getPositionView`・`setPosition`）、`OptionBarPositionGroup`（`render`）、`VertexHandleRules.computeVertexHandlesBounds`、`NudgeEditor.nudgeWithoutGrouping`
  * 既存（使うだけ・変えない）：`NudgeTargetRules.resolveNudgeTarget`、`ShapeExtentReader.getSelectedBounds`、`SpriteSerializer.computeShapesBounds`、`StatusReadoutRules.formatReadoutNumber`、`VectorModel.moveShapes`／`updateVertices`／`getShapes`／`getSelectedIds`／`getSelectedVertices`／`onChange`、`HistoryManager.beginEdit`／`commitEdit`、図形の共通メソッド`getHandlePosition`／`getVertexIndexForHandle`

### 参照する責務

（以後のタスク実行チャットは、この項目のみを責務情報源とする）

* **`core/`（1章・3章の方針）**：状態を持たない規則のファイルは状態・DOM（要素・id・クラス名）を持たず、**図形種別の分岐・図形固有のプロパティ名を持たない**。`core/`は`io/`・`edit/`・`palette/`・`asset/`をimportしない。依存方向は`main.js → edit → io → core → shapes`の一方向（`main.js`は加えて`wiring/`をimportする）。
* **`VertexHandleRules.js`**：頂点の選択モードで描く頂点のハンドルの一覧の組み立て、ハンドル名が頂点のハンドルかの判定、矩形に入る頂点の収集を、**図形の共通メソッドだけを使う状態を持たない関数**として提供する。読むものは`getVertexHandleNames`・`getHandlePosition`と`id`だけ（ポリモーフィックに呼ぶ）。importは`core/InputModes`の`OperationMode`のみ。毎回新しい配列を返し、引数を書き換えない。`collectVertexHandles`と`collectVertexHandlesInRect`は**走査を共有しない**（集める条件と戻り値の形が違うため）。
* **`StatusReadoutRules.js`**：ステータスバーの座標・大きさ・グリッドの表示の文字列の規則（文言・記号の唯一の定義箇所）。`formatReadoutNumber(value)`は有限の数でなければ`—`、それ以外は小数第1位に丸めて固定の小数第1位（`-0`・`-0.04`は`0.0`）。importを持たず、DOM・座標の求め方・外枠の求め方を知らない（値は引数で受け取る）。
* **`NudgeTargetRules.js`**：微調整で動かす対象の決定とまとめの鍵の組み立て。`resolveNudgeTarget(mode, selectedIds, selectedVertices)`は`SELECT`＋図形1件以上で`{type:'shapes', shapeIds}`、`VERTEX`＋頂点1件以上で`{type:'vertices', vertices}`、それ以外（`CREATE`・`PAN`・未知のモード・選択なし）は`null`。**モードに対応しない側の選択は見ない**。並びは与えられた順のまま、引数を書き換えず新しい値を返す。
* **`edit/`（全クラス共通）**：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。**知らないこと＝DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、操作モード**（`InputTracker`に依存しない）。操作モードに依存する判定は中立な注入関数（`getMode`等）で受け取る。importは原則`DocumentSerializer`のみで、個別の例外が列挙されている（`ShapeExtentReader`＝`io/SpriteSerializer`、`NudgeEditor`＝`core/NudgeTargetRules`。**`edit/`から`core/`をimportする最初の例**。いずれも下向きで循環しない）。
* **`ShapeExtentReader.js`**：選択中の図形・全図形の外枠（書き出しの`bounds`と同じ求め方）の照会のみ。`getSelectedBounds`（選択なしで`null`）・`getAllBounds`。どちらも`SpriteSerializer.computeShapesBounds`を使う（**外枠の求め方を二重に書かない**）。コンストラクタは`{ model }`。図形・選択集合・履歴に触れず、作成途中の図形は対象外。`@throws`は`computeShapesBounds`と同じ（未知の`kind`）。
* **`SpriteSerializer.computeShapesBounds(shapes)`**：各図形の`toDrawElement()`の形の範囲の和。**`strokeColor`が文字列の要素は形の範囲を線の太さの半分だけ広げる**（線を描かない要素は形の範囲のまま）。図形0個で`null`。
* **`NudgeEditor.js`**：選んでいる図形または頂点を指定の移動量だけ動かす1件の編集操作。`nudge(dx, dy)`は`resolveNudgeTarget`で対象を決め、対象が`null`なら`false`（**記録先に一切触れない**）。図形は`beginEdit` → `moveShapes`（通知1回）→ `commitEdit(鍵)`、頂点は各組の`getVertexIndexForHandle`・`getHandlePosition`で今の位置を求め、移動量を足した絶対座標を`updateVertices`へ渡す（通知1回）。図形が見つからない・頂点インデックスか位置が求まらない組は飛ばし、1件も残らなければ`false`（`beginEdit`も呼ばない）。移動量はワールド座標のpxで、スナップ・端点への吸い付きを通さない。`getMode`の戻り値は解釈せず規則へ渡すだけ。DOM・`try/catch`なし。再描画・UI同期を呼ばない。
* **`HistoryManager.commitEdit(groupKey)`**：鍵が文字列で空でないときだけ、同じ鍵が続いていれば直前の1件へ畳む（`before`据え置き・`after`更新）。**鍵が無ければ新しいエントリを足し、記憶している鍵を忘れる**。前後のスナップショットが同じなら記録しない（`false`）。`beginEdit`が呼ばれていなければ`console.warn`して`false`。
* **`VectorModel`**：`moveShapes(ids, dx, dy)`は`shape.translate`へポリモーフィックに委譲し、1件以上移動したときだけ通知1回。`updateVertices(updates)`は各組を`shape.setVertex`へ委譲し、1件以上更新したときだけ通知1回（存在しないidは無視）。`getSelectedIds`は描画順の新しい配列、`getSelectedVertices`は選んだ順の新しい配列（コピー）。`clearSelection`は無条件に通知する。
* **`palette/`**：自己完結するUI部品。いずれも**DOM操作専任**で、`VectorModel`・図形データ・選択状態に関与しない（受け取るのは注入された値とコールバックのみ）。ツールバーのオプションバーのまとまりは`palette/`のUI部品が担う。
* **`OptionBarStyleGroup.js`（ならう先）**：公開メソッドは`render`のみ。コンストラクタでまとまりのルート要素とコールバック群を受け取り、**コールバックが関数でなければ`Error`、要素が欠ければ`console.warn`して配線しない**（`render`は何もしない）。要素はルート要素内の`querySelector('#id')`で解決する。**太さの欄はフォーカスがある間は書き換えない**（打ち込み途中の値が`model.onChange`で消えないため）。値の確定が受理されなかったとき（コールバックが`false`）・欄から出たときは最後の`view`で書き戻す。importを持たず、判定・変更の手順を持たない。typedefは`edit/`側と同じ内容の二重定義（形を変えるときは両方を揃える）。
* **まとまりの足し方（3章13.・`_doc/arch/13_palette.md`・`01_index_html.md`）**：オプションバーはまとまり（`.toolbar-group`）ごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持つ。まとまりを足すときは、`index.html`に`<div class="toolbar-group">`、`palette/`にUI部品、`main.js`にブロックを足すだけで、**既存のまとまり・部品・配線を変えない**。要素idの接頭辞は`option-`。`value`等の初期値は書かない（起動時に`main.js`が1回同期する）。幅が足りないときは右のまとまりから切れる。
* **`main.js`**：配線ブロックをコメント番号の順に置く（`// 7.7.`＝スタイルのまとまり、`// 7.8.`＝重なり順のまとまり、`// 7.9.`＝微調整、`// 8.`＝キーボードショートカット）。**判定・計算を持たず**、生成・注入・受け渡し・同期だけを行う。表示の同期は`model.onChange`のみで行い、機能専用の同期経路は足さない。初回の表示を`onChange`通知や`index.html`の初期記述に依存させないため、初期化の最後に各同期関数を明示的に1回ずつ呼ぶ。
* **`FocusKeyYieldRules.js`**：`isTextInputElement`は`input`要素の`type`で判定し、**`'number'`はテキスト入力扱い**の一覧に含まれる（＝欄にフォーカスがある間はショートカットが働かない）。
* **`test/`**：実行は`node --test`（引数なし）。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える（`VectorModel`・図形クラスは実物を使う例が多い）。DOMに依存するもの（`palette/`の部品・`main.js`の配線・`index.html`）はテスト対象外で、`_doc/arch/16_test.md`の「テストできない箇所」に記載する。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定

資料本体の書き換えは**最終タスクのみ**で行う（個別タスクでは本欄に追記する）。

* **1章 プロジェクトフォルダ構造**
  * `js/edit/`に`PositionInputRules.js`（位置の欄に出す内容と入力から移動量の規則。状態なし）・`PositionInputEditor.js`（位置の数値入力の1件の編集操作）を追加。
  * `js/palette/`に`OptionBarPositionGroup.js`（オプションバーの「位置」のまとまり）を追加。
  * `test/core/`・`test/edit/`に`PositionInputRules.test.js`・`PositionInputEditor.test.js`を追加（`VertexHandleRules.test.js`・`NudgeEditor.test.js`は件数が増える）。
  * `core/VertexHandleRules.js`の説明に「選んでいる頂点の範囲」を追加。
  * 「存在しないもの」のPhase 08-04の分を更新（位置の数値入力は実装済みになり、整列と分布・大きさ／角度の欄・基準点・変形・頂点の追加削除は引き続き無い）。
  * フォルダ分割の方針の`edit/`の説明と依存方向の記述に、`edit → core`のimportの例が2つになったこと（`NudgeEditor`＝`NudgeTargetRules`、`PositionInputRules`＝`StatusReadoutRules`、`PositionInputEditor`＝`NudgeTargetRules`・`VertexHandleRules`）を反映。
* **3章 描画・操作フロー**
  * **20.「位置の数値入力」を新設**：流れ（表示＝`model.onChange` → `syncOptionBarPositionGroup` → `PositionInputEditor.getPositionView` → `OptionBarPositionGroup.render`、入力＝`change` → `setPosition` → `NudgeEditor.nudgeWithoutGrouping`）、モジュールの分担（DOM／規則／手順／配線）、**外枠に線の太さを含めること（ステータスバーの大きさと同じ求め方。太さを変えると表示が変わるのは仕様）**、頂点を複数選んでいるときは頂点全体の範囲の左上、**円・弧も外枠の左上**（座標の規則に図形種別の分岐を持たせない）、数字の形（小数第1位・`-0`は`0.0`。正本は`StatusReadoutRules`）、表示の丸めを移動量へ持ち込まないこと、確定の契機（`change`＝`Enter`・欄から出たとき・欄の矢印。受理しなければ実値へ戻す。`input`は購読しない）、**確定1回が取り消し1件（まとめの鍵を渡さない）**、スナップ・端点への吸い付きを働かせないこと、対象なしで押せない見た目になる条件、発注者の決定6点、やらないこと、確認の状況（DOM依存のためテストプレイで確かめた範囲）。
  * **13.（オプションバー）**：「まとまりごとの分け方」に位置のまとまり（`#option-position-group`）が加わったことと、「やらないこと」の「頂点の座標・図形の大きさの数値の欄（精度のPhase）」のうち位置の欄が実装済みになったことを反映（大きさ・角度の欄は引き続き無い）。
  * **19.（矢印キーでの微調整）**：`NudgeEditor`の呼び出し元が2つになったこと（矢印キーは鍵あり、位置の数値入力は鍵なし）と、「やらないこと」の位置の数値入力の記述を更新。
* **4章 各モジュールの責務リファレンス**（モジュールのファイルへ反映。一覧の表に新しい行は増えない）
  * `_doc/arch/38_VertexHandleRules.md`：`computeVertexHandlesBounds`の公開・契約（位置が求まった組だけ・0件で`null`・線の太さを見ない・既存の関数と走査を共有しない理由）・使う側（`edit/PositionInputEditor`）・テストの件数。
  * `_doc/arch/26_StatusReadoutRules.md`：使う側に`edit/PositionInputRules`（オプションバーの位置の欄）が加わったこと、責務定義の書き直し（ステータスバー限定ではないこと）、`formatReadoutNumber`が「有限でない数」に返す`—`は数値の欄に入れられないため呼び出し側が先に弾くこと。
  * `_doc/arch/14_edit.md`：`PositionInputRules.js`・`PositionInputEditor.js`の項目を新設（公開・依存・契約・置き場所の理由・テスト）、`NudgeEditor.js`の項目に`nudgeWithoutGrouping`と責務の書き直し（呼び出し元が2つ）を反映、冒頭の「依存」の例外の列挙に`PositionInputRules`・`PositionInputEditor`を追加。
  * `_doc/arch/13_palette.md`：`OptionBarPositionGroup.js`の項目を新設（公開`render`・注入・知らないこと・`input`を購読しない理由・軸の文字列の二重定義・テスト対象外）、冒頭のオプションバーのまとまりの列挙に位置を追加。
  * `_doc/arch/01_index_html.md`：オプションバーの項目に位置のまとまり（`#option-position-group`・`#option-position-x`・`#option-position-y`・`step="any"`・`min`／`max`なし・`.option-unit`の使い回し・`#option-stroke-width`のCSSルールの共用）と、1280px幅の見積もりの更新を反映。
  * `_doc/arch/02_main.md`：配線ブロックの表に`// 7.10.`を追加、主な関数に`syncOptionBarPositionGroup`を追加、注入の一覧に`PositionInputEditor`（`model`・`getMode`・`shapeExtentReader`・`nudgeEditor`）と`ShapeExtentReader`（`main.js`でも1つ生成すること）を追加、起動時の同期に`syncOptionBarPositionGroup()`を追加、行数の更新。
  * `_doc/arch/16_test.md`：Phase 08-04の新設分（`PositionInputRules.test.js`・`PositionInputEditor.test.js`の検証範囲）、既存への追加（`VertexHandleRules.test.js`・`NudgeEditor.test.js`）、**既存のケースの期待値の書き換え＝無し**（`NudgeEditor.test.js`は共有ヘルパの偽の記録先を可変長引数へ広げるのみ＝引数の個数を観測できるようにするため。既存のケースの記録の形と期待値は変わらない）、テストできない箇所（08-04の追加＝`OptionBarPositionGroup`（DOM）・`main.js`の`// 7.10.`の配線・`index.html`の位置のまとまりの見た目と1280px幅での収まり・`type="number"`の`change`／`blur`／矢印の操作のふるまい）、件数（`node --test`の結果。08-04前は tests 1457 / suites 221）。
  * `_doc/arch/36_DisplayWiring.md`：**変更しない**（`DisplayWiring`は無変更。ただし`ShapeExtentReader`が`main.js`側にも1つできる点は`14_edit.md`・`02_main.md`側に書く）。

---

## 3. タスクリスト

*   [x] タスク1: 要件1 選んでいる頂点の範囲を求める規則（`core/VertexHandleRules`）
    *   **対象ファイル** :
        *   `./js/core/VertexHandleRules.js` :（更新）
        *   `./test/core/VertexHandleRules.test.js` :（更新）
    *   **作業内容** :
        *   `computeVertexHandlesBounds(shapes, vertices)`を足す（既存の3関数は**一切変えない**。importも増やさない）。要件1の手順どおり、図形を`id`で引き、`getHandlePosition(handle)`で位置を求め、**位置が求まった組だけ**から最小・最大のX・Yを返す。0件・どれも求まらないときは`null`。
        *   関数のJSDoc（責務・`@param`・`@returns`）に、線の太さを見ないこと・頂点1つなら最小＝最大になること・引数を書き換えないこと・既存の関数と走査を共有しない理由を書く。
        *   ファイル先頭の責務定義（3行以内）に「選んでいる頂点の範囲」を加える（既存の記述は残す）。
        *   `test/core/VertexHandleRules.test.js`へ`describe('computeVertexHandlesBounds')`を足し、要件1のテストの観点をすべて確かめる（頂点1つ・同じ図形の複数・複数の図形にまたがる・存在しない図形のid・**未知のハンドル名**・0件で`null`・引数の非破壊）。**既存のケースは変えない**。補助関数にはJSDocを書く。
        *   「位置が求まらない」ケースは**未知のハンドル名**（どの図形も知らない名前）で作る。**円・弧を「位置が求まらない例」として使わない**（`Ellipse`は`getVertexHandleNames()`が空配列を返すだけで、`getHandlePosition('right')`等は位置を返すため）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（「今回やらないこと」に挙げた到達不能な枝は**残す**）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク2: 要件2 位置の欄に出す内容と入力から移動量を求める規則（`edit/PositionInputRules`）
    *   **対象ファイル** :
        *   `./js/edit/PositionInputRules.js` :（新規）
        *   `./js/core/StatusReadoutRules.js` :（更新。**先頭の責務定義の書き直しのみ**）
        *   `./test/edit/PositionInputRules.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。importは`../core/StatusReadoutRules.js`の`formatReadoutNumber`のみ（`edit → core`の下向きの依存である旨と、循環しない理由をコメントに書く。`NudgeEditor`の書き方にならう）。
        *   `POSITION_AXIS`（`Object.freeze({ X: 'x', Y: 'y' })`。軸の値の唯一の定義箇所）とtypedef`PositionInputView`を書く（`palette/OptionBarPositionGroup.js`との二重定義である旨を明記）。
        *   `buildPositionInputView(target, bounds)`を実装する（要件2のとおり。対象なし・範囲なし・有限でない値は`{x:'', y:'', disabled:true}`。それ以外は`formatReadoutNumber`で小数第1位の文字列。`target`の種類で分岐しない）。JSDocに「`—`を数値の欄に入れないため有限でない値を先に弾く」理由を書く。
        *   `resolvePositionDelta(axis, text, bounds)`を実装する（要件2のとおり。空・数値でない・有限でない → `null`。X軸は`{dx: 値 - minX, dy: 0}`、Y軸は`{dx: 0, dy: 値 - minY}`、未知の軸は`null`、移動量0は`null`）。**スナップ・吸い付きを行わないこと**と、**表示の丸めを移動量へ持ち込まないこと**をJSDocに書く。
        *   `js/core/StatusReadoutRules.js`の**先頭の責務定義だけ**を、オプションバーの位置の欄も使う意味へ書き直す（3行以内。関数・文言・記号・公開名・ふるまいは**一切変えない**）。
        *   `test/edit/PositionInputRules.test.js`（新規）：先頭に単一責務のJSDoc。要件2のテストの観点をすべて確かめる（対象なし・範囲なし・有限でない範囲・小数第1位の表示・負の値・`-0`の扱い・空文字・空白のみ・数値でない文字列・移動量0・未知の軸・X軸とY軸でもう一方が0になること・丸めずに移動量が求まること・引数の非破壊）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク3: 要件3 移動量を当てる入口の追加（`edit/NudgeEditor`）
    *   **対象ファイル** :
        *   `./js/edit/NudgeEditor.js` :（更新）
        *   `./test/edit/NudgeEditor.test.js` :（更新）
    *   **作業内容** :
        *   既存の`nudge(dx, dy)`の**名前・引数・ふるまい（記録の順序・鍵の渡し方・戻り値・対象なしで記録先に触れないこと）を一切変えない**まま、対象の解決と移動の処理を非公開メソッドへ括り出し、`nudge`と新しい`nudgeWithoutGrouping(dx, dy)`の両方がそれを使う形にする（**同じ処理を2か所に書かない**）。
        *   `nudgeWithoutGrouping`は記録のときに**鍵を渡さない**（`commitEdit()`を引数なしで呼ぶ。`buildNudgeGroupKey`は鍵ありの経路でのみ呼ぶ）。それ以外は`nudge`と同じ。
        *   `#buildVertexUpdates`は変更しない。importを増やさない。
        *   ファイル先頭の責務定義（3行以内）を、「選んでいる図形・頂点を移動量だけ動かす1件の編集操作（矢印キーでの微調整と位置の数値入力の両方が使う）」の意味へ書き直す（**ファイル名・クラス名は変えない**）。クラスのJSDocと公開メソッドのJSDocも実態に合わせる（鍵の有無の違い・呼び出し元が2つ・取り消しの件数の違い）。
        *   `test/edit/NudgeEditor.test.js`の共有ヘルパ`setup()`の偽の記録先を、**`commitEdit: (...args) => calls.push(['commitEdit', ...args])`の1行の形へ広げる**（引数の個数を`記録.length - 1`で読めるようにするため）。鍵ありの呼び出しの記録の形は今と同じ`['commitEdit', 鍵]`なので、**既存のケースの期待値は変えない**（鍵を`c[1]`で読むケース・`names(calls)`のケース・`deepEqual(calls, [])`のケースはそのまま）。`setup`のJSDocに「引数は渡された分だけ記録する」旨を補う。偽物を別に用意する案は採らない（記録の形が2つになり、以後のケースがどちらを使うのか曖昧になるため）。
        *   `test/edit/NudgeEditor.test.js`へ要件3のケースを足す（新しいメソッドで図形が動く・頂点が動く・`commitEdit`へ鍵が渡らない（記録の長さが1＝引数の個数が0）・続けて2回で記録が2件・対象なしと頂点0件で記録先を呼ばず`false`）。**既存のケースは変えない**。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク4: 要件4 位置の数値入力の編集操作（`edit/PositionInputEditor`）
    *   **対象ファイル** :
        *   `./js/edit/PositionInputEditor.js` :（新規）
        *   `./test/edit/PositionInputEditor.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。importは`../core/NudgeTargetRules.js`・`../core/VertexHandleRules.js`・`./PositionInputRules.js`のみ（下向きの依存である旨をコメントに書く）。
        *   コンストラクタ`{ model, getMode, shapeExtentReader, nudgeEditor }`と非公開フィールドを書く（JSDoc付き。`model`は読むだけ、**`HistoryManager`は受け取らない**旨をクラスのJSDocに明記）。
        *   対象と範囲の解決を非公開メソッド1つに括り、`getPositionView()`・`setPosition(axis, text)`が共有する（要件4の手順1〜4）。
        *   `getPositionView()`：`buildPositionInputView(対象, 範囲)`を返す。**図形・選択集合・履歴を変更しない**（純粋な照会である旨をJSDocに書く）。
        *   `setPosition(axis, text)`：対象が`null`なら`false`、`resolvePositionDelta`が`null`なら`false`（いずれも**記録先に一切触れない**）。求まったら`nudgeEditor.nudgeWithoutGrouping(dx, dy)`の戻り値を返す。
        *   クラスのJSDocに「知らないこと」（DOM・図形種別の分岐・図形固有のプロパティ名・ビュー変換・スナップ・操作モードの値の意味）と「再描画・UI同期を呼ばない」ことを書く。
        *   `test/edit/PositionInputEditor.test.js`（新規）：先頭に単一責務のJSDoc。`VectorModel`・図形クラスは実物、`getMode`は素の関数の偽物、`shapeExtentReader`は**実物の`ShapeExtentReader({ model })`**。`nudgeEditor`は**2通りを使い分ける補助関数2つ**（それぞれJSDoc付き）に分ける。
            *   **組み方A（実物を通す）**：`nudgeEditor`は**実物の`NudgeEditor`**（`{ model, editRecorder, getMode }`で生成し、`editRecorder`には`beginEdit`・`commitEdit`を持つ偽の記録先の素のオブジェクトを渡す。`model`・`getMode`は`PositionInputEditor`と同じものを渡す）。これで**図形・頂点が実際にその位置へ動くこと**を確かめる＝図形1つ／図形複数（位置関係が保たれる・外枠の左上が選択全体の値）／頂点1つ／頂点複数（位置関係が保たれる）／X軸だけ変えてY座標が変わらない（Y軸も同様）／線の太さで表示が変わる／`disabled`の切り替わり／照会が図形と選択を変えない。
            *   **組み方B（呼ばれないことを見る）**：`nudgeEditor`は**偽物**（`nudgeWithoutGrouping`の呼び出しを記録して戻り値を返す素のオブジェクト）。これで**対象なし（選択なし・`A`で頂点0件・`CREATE`・`PAN`）と受理しない入力（空・数値でない文字列・同じ値）で`false`になり移動先を1回も呼ばないこと**、および受理する入力で`{dx, dy}`と戻り値が素通しされることを確かめる。
            *   記録が1件ずつ・鍵が渡らないことは要件3のテストで確かめるため、ここでは重ねて確かめない。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク5: 要件5 オプションバーの位置のまとまり（`index.html`のHTMLとCSS）
    *   **対象ファイル** :
        *   `./index.html` :（更新）
    *   **作業内容** :
        *   `#option-order-group`の後ろに`<div id="option-position-group" class="toolbar-group">`を足し、中身を要件5のとおりに置く（`X:`・`#option-position-x`・`Y:`・`#option-position-y`・`px`）。既存のまとまりの並び・id・クラス名は**変えない**。
        *   数値の欄は`type="number"`・`step="any"`とし、`min`・`max`は**付けない**（小数・負の値をそのまま入れられるようにする）。`value`・`disabled`等の初期値は書かない。
        *   `title`に「外枠の左上の座標（線の太さを含む。頂点の選択では選んだ頂点の左上）」の意味が分かる説明を入れる（**キーは書かない**）。
        *   `X:`・`Y:`・`px`は既存の`.option-unit`を使う（新しいクラス・新しい見た目の決まりを作らない）。必要なら`.option-unit`のコメントに「単位と欄の見出しに使う」旨を補う（宣言の値は変えない）。
        *   CSSは既存の`#option-stroke-width`のルールのセレクタへ`#option-position-x`・`#option-position-y`を加える（宣言の値は変えず、同じ値を2か所に書かない）。コメントを「太さの欄・位置の欄」に直す。
        *   CSSコメント「ツールバー全体の幅の見積もり（1280px幅）」に位置のまとまりの分（区切り17px＋中身約174px）を加えた値へ更新する。計算上1280px幅に収まること（約828px）を確認し、収まらない見積もりになった場合は**実装を止めて計画書へ記載し発注者の判断を仰ぐ**。
        *   押せないときの見た目は`disabled`属性のみ（既存の押せない欄・ボタンと同じ扱い。新しい見た目を作らない）。
        *   ステータスバー・既存のまとまり・ツールバーの`user-select: none`・`overflow: hidden`は変えない。
        *   JSDocコメントの記載漏れがないことを確認する（`index.html`には`.js`のJSDocは無いため、対象は**足したHTMLのまとまり・欄の`title`と、CSSのルールのコメント**が、既存の書き方どおりに意図を説明できているかの確認とする）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`index.html`はテスト対象外だが、ほかを壊していないことの確認として行う）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク6: 要件6 UI部品（`palette/OptionBarPositionGroup`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarPositionGroup.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。**importを持たず**、状態・判定を持たず、図形データ・選択状態に関与しない（既存のオプションバーのUI部品と同じ約束をクラスのJSDocに明記）。
        *   typedef`PositionInputView`（`edit/PositionInputRules.js`との二重定義である旨を明記）と`OptionBarPositionGroupActions`（`onPositionChange(axis, value) → boolean`）を書く。
        *   コンストラクタ`(groupElement, actions)`：コールバックが関数でなければ`Error`、要素はルート要素内の`querySelector('#id')`で解決し1つでも欠ければ`console.warn`して配線しない（`render`は何もしない）。`OptionBarStyleGroup`の書き方にそろえる。
        *   `render(view)`：`disabled`は毎回当て、`value`は**その欄にフォーカスがある間は書き換えない**。最後に表示した内容を保持する。
        *   `change`の購読：`actions.onPositionChange('x'|'y', 欄の値)`を呼び、**戻り値が`false`なら最後の`view`で書き戻す**。`blur`でも書き戻す。**`input`は購読しない**（理由をJSDocに書く）。
        *   軸の文字列の正本が`edit/PositionInputRules.js`の`POSITION_AXIS`であり、importを持たない約束のため同じ文字列を持つ二重定義であることをJSDocに書く。
        *   テストは置かない（DOM依存。`_doc/arch/16_test.md`の「テストできない箇所」への記載は最終タスクで行う）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク7: 要件7 配線（`main.js`の`// 7.10.`）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `./edit/PositionInputEditor.js`・`./palette/OptionBarPositionGroup.js`・`./edit/ShapeExtentReader.js`のimportを既存の並びの作法にそろえて足す。
        *   `// 7.9.`の後・`// 8.`の前に`// 7.10. オプションバー（位置のまとまり）配線`のブロックを足す（`// 7.7.`・`// 7.8.`と同じ形。コメントで分担と「判定・計算を書かない」「表示の同期は`model.onChange`のみ」を示す）。
        *   `ShapeExtentReader`を**`main.js`で1つ生成**して`PositionInputEditor`へ渡す。**`js/wiring/DisplayWiring.js`は変更しない**。
        *   `NudgeEditor`は`// 7.9.`で生成した**同じインスタンス**を渡す（2つ生成しない）。
        *   `OptionBarPositionGroup`を生成し、`onPositionChange`は`positionInputEditor.setPosition(axis, text)`を呼んで戻り値をそのまま返すだけにする（**判定・計算を書かない**。`isDragging()`は見ない）。
        *   `syncOptionBarPositionGroup()`（JSDoc付き。橋渡しのみ）を定義して`model.onChange`へ登録し、起動時の同期の並び（`syncOptionBarOrderGroup()`の後）へ1回の呼び出しを既存と同じ形のコメント付きで足す。**位置の欄専用の再描画・同期の経路や`document`への購読を足さない**。
        *   要件7の表の経路（モード切替・選択の変更・頂点の選択の変更・図形の移動・取り消し／やり直し・太さの変更）が既存の通知だけで欄の表示に追従することを、コードを追って確認する（新しい通知を足さない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない。`main.js`の行数も控える）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク8: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
    *   **対象ファイル** :
        *   （原則として変更なし。漏れが見つかった場合のみ、タスク1〜7で触れたファイルを直す）
    *   **作業内容** :
        *   タスク1〜7で新規・更新した全ファイルについて、ファイル先頭の責務定義（3行以内）と、クラス・関数・メソッド・typedefのJSDoc（責務・`@param`・`@returns`）の記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（「今回やらないこと」に挙げた到達不能な枝＝各図形の`drawHandles`・`resolvePressAction`のハンドルの枝・`CursorShapeRules`の選択モードのハンドルの枝・`CanvasManager.render`のハンドルを描く段と、`VectorModel.updateVertex`は**残す**）。
        *   `git status`・`git diff --stat`で、変更したファイルが本計画書の対象ファイルだけであることを確認する（`js/core/InputTracker.js`・`KeyboardShortcuts.js`・`FocusKeyYieldRules.js`・`VectorModel.js`・`HistoryManager.js`・`NudgeTargetRules.js`・`CanvasManager.js`・`UnitSnapRules.js`・`UnitSnapSettings.js`・`PressActionRules.js`・`SelectionRules.js`・`CursorShapeRules.js`・`PointHitRules.js`・`js/shapes/`・`js/io/`・`js/edit/ShapeExtentReader.js`・`SnapshotAdapter.js`・`EndpointSnapper.js`・`ShapeStyleEditor.js`・`StylePanelRules.js`・`js/wiring/`・`asset/`が**変わっていないこと**。`js/core/StatusReadoutRules.js`は先頭の責務定義のみ、`js/core/VertexHandleRules.js`は要件1の追加のみ、`js/edit/NudgeEditor.js`は要件3の追加と責務定義・JSDocの書き直しのみであること）。
        *   既存のテストの期待値を変えていないことを確認する（`git diff`で既存のテストのケースに変更が無いこと。`test/edit/NudgeEditor.test.js`の共有ヘルパの偽の記録先を可変長引数へ広げた1行とそのJSDocの補いだけは例外で、**既存のケースの記録の形・期待値が変わっていないこと**を確認する）。
        *   リポジトリのルートで`node --test`を実行し、全件通ること（`fail 0`）を確認し、`tests`・`suites`・`pass`の件数を控える（08-04前は tests 1457 / suites 221）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク9: 要件8 テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   `./_log/res/261117_1548_RES_Phase08-04_Position_Input.md` :（更新。詳細作業内容への記載のみ）
    *   **作業内容** :
        *   本計画書の「要件8: ふるまいの確認（テストプレイの確認項目）」の0〜16をそのまま発注者へ提示する（画面・操作・挙動の言葉で書く）。
        *   自動テストで確かめられない箇所（`OptionBarPositionGroup`のDOMのふるまい、`main.js`の`// 7.10.`の配線、`index.html`の見た目と1280px幅での収まり、`type="number"`の`change`／`blur`／矢印の操作）を、特に確かめてほしい項目として添える。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ提示した内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/01_index_html.md`・`02_main.md`・`13_palette.md`・`14_edit.md`・`16_test.md`・`26_StatusReadoutRules.md`・`38_VertexHandleRules.md` :（更新）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄の全項目（各タスクでの追記を含む）を確認し、資料へ反映する。
        *   1章（ファイルの一覧・「存在しないもの」・フォルダ分割の方針・依存方向）、3章（**20.「位置の数値入力」の新設**・13.・19.の更新）を更新する。4章の一覧の表は新しい行が増えない（新しい規則・編集操作・UI部品は`14_edit.md`・`13_palette.md`に書く）ことを確認する。
        *   `_doc/arch/`の各ファイルを更新予定欄のとおりに直す。`16_test.md`には新設2ファイルと既存2ファイルへの追加の検証範囲・テストできない箇所（08-04の追加）・既存のケースの期待値の書き換え（無し。`NudgeEditor.test.js`の共有ヘルパの拡張のみ）・件数（タスク8で控えた`node --test`の結果）を書く。
        *   記載基準に従う（1つのファイルのJSDocを読めば分かることは書かない。責務・境界・依存方向・流れと順序・誰が呼ぶか・設計判断の理由・やらないと決めたことを残す）。実コードと食い違う記述を作らない。
        *   **本タスクは開発資料の書き換えが明示的に許された唯一のタスク**であり、後続タスクは無い。ソースコード（`js/`・`test/`・`index.html`）は変更しない。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1 選んでいる頂点の範囲を求める規則（`core/VertexHandleRules`）
*   **作業内容** :
    *   `js/core/VertexHandleRules.js`に`computeVertexHandlesBounds(shapes, vertices)`を追加（既存3関数・importは無変更、JSDoc・先頭の責務定義を更新）。
    *   `test/core/VertexHandleRules.test.js`に`describe('computeVertexHandlesBounds')`を8ケース追加（頂点1つ／同一図形の複数／複数図形／存在しないid／未知のハンドル名／0件／円のgetHandlePosition／非破壊）。既存ケースは無変更。
    *   `node --test`：tests 1465 / suites 222 / fail 0。
    *   監査指摘の修正：非破壊ケースを既存ケースと同じ強度（`shapes`は`toJSON`まで、`vertices`も中身をJSON比較）へそろえた。`node --test`全件通過。

### タスク2: 要件2 位置の欄に出す内容と入力から移動量を求める規則（`edit/PositionInputRules`）
*   **作業内容** :
    *   （未実施）

### タスク3: 要件3 移動量を当てる入口の追加（`edit/NudgeEditor`）
*   **作業内容** :
    *   （未実施）

### タスク4: 要件4 位置の数値入力の編集操作（`edit/PositionInputEditor`）
*   **作業内容** :
    *   （未実施）

### タスク5: 要件5 オプションバーの位置のまとまり（`index.html`のHTMLとCSS）
*   **作業内容** :
    *   （未実施）

### タスク6: 要件6 UI部品（`palette/OptionBarPositionGroup`）
*   **作業内容** :
    *   （未実施）

### タスク7: 要件7 配線（`main.js`の`// 7.10.`）
*   **作業内容** :
    *   （未実施）

### タスク8: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
*   **作業内容** :
    *   （未実施）

### タスク9: 要件8 テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （未実施）

### タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （未実施）

---

## 5. 懸念事項・要確認ポイント

* **欄の幅（56px）**：太さの欄にそろえて56pxにしている。`-1234.5`のような桁数の多い値では、ブラウザの上下の矢印と合わせて表示が窮屈になる可能性がある（値が消えるわけではない）。1280px幅には約450pxの余裕があるため、発注者が画面で見て狭いと感じた場合は、欄の幅だけを広げる（CSSの1か所）対応ができる。要件8の確認項目2・11で見てほしい。
* **1280px幅の収まり**：計算上は約828px（現状637px＋約191px）で収まる見積もりだが、`X:`・`Y:`・`px`の文字幅はフォントによって前後する。実測は要件8の確認項目0で確かめてほしい。
* **`step="any"`の上下の矢印**：`step="any"`のとき、欄の上下の矢印・`↑`／`↓`キーが動かす量はブラウザ既定（1px）になる。入れた小数（`10.25`など）から矢印を押すと`11.25`のように1pxずつ動く見込みだが、ブラウザによって刻みの基準が異なる可能性があるため、要件8の確認項目3・14で挙動を見てほしい。
* **表示の丸めと実際の位置**：欄は小数第1位までの表示なので、座標が`10.04`の図形では欄に`10.0`と出る。この状態で`10`を入れて確定すると`0.04`動いてちょうど`10.0`になり、見た目の表示は変わらないのに取り消しが1件増える（実際に位置が変わっているため）。発注者の決定4（小数第1位の表示）と「入れた値そのものへ動かす」を両立させた結果であり、不具合ではない。気になる場合は次のPhaseで扱う。
* **`ShapeExtentReader`が2つできること**：`wiring/DisplayWiring`は内部で1つ持ち、本作業では`main.js`がもう1つ生成する（`DisplayWiring`を変更しないというREQの指示に従った）。状態を持たない照会なので値は同じだが、資料には「2か所で生成している」ことを残す（将来1つにまとめるなら`DisplayWiring`の構成を触るPhaseで行う）。
* **線の太さを変えるとX・Yの表示が変わること**：発注者の決定1のとおりの仕様。要件8の確認項目6で確かめる（不具合として直さない）。
