# RES: 作業計画・作業レポート (Phase 08-05) : 整列・分布
* 参照元REQ: `./_log/req/261117_1700_REQ_Phase08-05_Align_Distribute.md`

## 1. 作業目的

選んでいる**複数の図形**の位置を、**ツールバーのオプションバーのボタン1つでそろえられるようにする**（整列6種・分布2種）。マウスのドラッグ・矢印キーでの微調整・位置の数値入力に続く「狙った位置に置く」ための4つめの入口であり、**既存のオプションバーの「重なり順」のまとまりと同じ作り（規則＋編集操作＋DOM専任のUI部品の3層）と、既存の移動・履歴の仕組み（`VectorModel`の移動の入口・`HistoryManager`の`beginEdit`／`commitEdit`の対）の上に載せる**。新しい外枠の求め方・新しい同期の経路は作らない。

**本作業で満たすこと**

* 図形を**2つ以上**選んでいるとき、整列の6ボタン（左・左右中央・右・上・上下中央・下）で、各図形の外枠を**選択全体の外枠**の端（または中央）へそろえられる。
* 図形を**3つ以上**選んでいるとき、分布の2ボタン（横方向に均等・縦方向に均等）で、**外枠どうしのすき間**を等しくできる（両端の図形は動かず、間の図形が動く）。
* **1pxも動かない操作のボタンは押せない見た目**になる（すでにそろっている・図形の数が足りない）。
* **操作1回が取り消し1件**（まとめの鍵を渡さない）。
* ボタンの押せる・押せないの表示は、**既存の`model.onChange`の同期だけで**、選択の変更・移動・取り消し／やり直し・線の太さの変更・キャンバスの切り替えに追従する。

**変えないこと（これを破る変更は失敗とみなす）**

* 自動テスト（リポジトリのルートの`node --test`）が**全件通る**。**既存のテストの期待値を変えない**（本作業は既存のふるまいを変えないため。計画時点の件数は tests 1496 / suites 222 / pass 1496 / fail 0）。
* 作業データ形式・書き出し形式・履歴のエントリの形を変えない（版はどちらも2のまま）。
* マウスでの操作・キーのふるまいを一切変えない。`js/core/InputTracker.js`・`js/core/KeyboardShortcuts.js`・`js/core/FocusKeyYieldRules.js`は**変更しない**（キーを割り当てない）。
* オプションバーの既存のまとまり（スタイル・重なり順・位置）のふるまい・見た目・DOMのid・クラス名を変えない。ステータスバーの表示も変えない。
* 外枠の求め方を変えない・2通りにしない（`js/io/SpriteSerializer.js`は変更しない。`js/edit/ShapeExtentReader.js`へは要件1の照会の追加のみ）。
* スナップ（刻みへの丸め）・端点への吸い付きを整列・分布に働かせない（そろえた結果の座標を刻みへ丸めない）。
* 改名・整形・「不要に見えるコードの削除」を行わない。既存の公開メソッド名・フィールド名・DOMのid・クラス名は変えない。既存の`VectorModel.moveShapes`の名前・引数・ふるまいを変えない。

**発注者の決定（2026-11-17。計画で変えてはならない）**

1. **「間隔を均等にする」は、外枠どうしのすき間をそろえる**（中心の間隔をそろえるのではない）。両端の図形は動かさず、間の図形を動かしてすき間を等しくする。大きさの違う図形が混ざっていても見た目のすき間がそろう。
2. **対象は図形だけ**。頂点の選択（`A`）で選んだ頂点をそろえる機能は作らない（後のPhaseで足せる作りにしておく）。
3. **すでにそろっていて1pxも動かない操作のボタンは押せない見た目にする**。あわせて**図形の数が足りないとき**（整列は2つ未満、分布は3つ未満）も押せない。
4. **キーボードショートカットは割り当てない**（ボタンだけ）。
5. **整列の基準は選択全体の外枠**（2026-11-16の決定。基準にする図形・キャンバスを基準にする仕組みは作らない）。
6. **そろえる・間隔を均等にする操作1回が取り消し（`Ctrl`+`Z`）1件**。

**用語**（本計画書・コード・資料で使い分ける）

* **外枠**：図形（または選択集合全体）を囲む矩形。求め方の正本は`js/io/SpriteSerializer.js`の`computeShapesBounds`で、**線を描く図形は線の太さの半分だけ外側へ広げた範囲**（書き出しの`bounds`・ステータスバーの「大きさ」・位置の数値入力と同じ値）。照会の入口は`js/edit/ShapeExtentReader.js`。
* **整列**：選んでいる図形を、選択全体の外枠の左・左右中央・右・上・上下中央・下のいずれかにそろえること（6種）。
* **分布**：選んでいる図形の外枠どうしのすき間を、横方向または縦方向で等しくすること（2種）。
* **すき間**：隣り合う2つの図形の外枠の間隔（左の図形の右端から右の図形の左端まで）。重なっている場合は負の値。
* **移動量**：ある図形を動かす量（`{dx, dy}`）。整列・分布では図形ごとに違う値になる。
* **全体の範囲**：規則の中で各図形の外枠の和として求める矩形（＝選択全体の外枠と同じ値）。

---

## 2. アーキテクチャ設計

### 全体の流れ（新しい経路を作らず、既存の経路に載せる）

```
[表示（押せる・押せない）]
model.onChange（既存の通知。選択の変更・移動・取り消し/やり直し・線の太さの変更・キャンバスの切り替えすべてがこれを通る）
  → main.js の syncOptionBarAlignGroup()（// 7.11. 橋渡しのみ）
    → edit/ShapeAlignEditor.getAvailability()
        1. edit/ShapeExtentReader.getSelectedBoundsPerShape() → items = [{ id, bounds }, ...]（1回だけ求める）
             └ 図形1つずつ io/SpriteSerializer.computeShapesBounds([shape])（既存の求め方。書き直さない）
        2. 8操作それぞれ edit/ShapeAlignRules.canApplyAlign(items, operation)
      → palette/OptionBarAlignGroup.render(availability)（8ボタンの disabled を当てるだけ）

[入力]
8ボタンのどれかの click
  → palette/OptionBarAlignGroup（押されたボタンの操作の文字列をコールバック onAlign へ渡すだけ）
    → main.js の performShapeAlign(operation)（ドラッグ中なら false。それ以外は shapeAlignEditor.apply の戻り値を返すだけ）
      → edit/ShapeAlignEditor.apply(operation)
          1. items = shapeExtentReader.getSelectedBoundsPerShape()
          2. canApplyAlign(items, operation) が偽なら false（記録先に一切触れない。未知の操作はここで Error）
          3. moves = computeAlignMoves(items, operation) → [{ id, dx, dy }, ...]（動く図形だけ）
          4. editRecorder.beginEdit() → model.moveShapesBy(moves)（要件3で足す入口。通知1回）→ editRecorder.commitEdit()（鍵なし）
          5. true
```

**3層の分担（オプションバーの「重なり順」のまとまりと同じ形）**

| 層 | ファイル | 持つもの／持たないもの | ならう先 |
| --- | --- | --- | --- |
| 規則 | `js/edit/ShapeAlignRules.js`（新規） | 操作の値の唯一の定義・移動量の計算・押せるかの判定。**状態なし・DOMなし・importなし**。受け取るのは`id`と外枠の数値だけ | `ShapeOrderRules.js` |
| 編集操作 | `js/edit/ShapeAlignEditor.js`（新規） | 1件の編集操作（`apply`）と可否の照会（`getAvailability`）。**DOMなし・操作モードを知らない**。importは`./ShapeAlignRules.js`のみ | `ShapeOrderEditor.js` |
| UI部品 | `js/palette/OptionBarAlignGroup.js`（新規） | 要素の解決・`render`・`click`の通知のみ。**importなし・状態なし・判定なし** | `OptionBarOrderGroup.js` |
| 配線 | `js/main.js`（更新。`// 7.11.`） | 生成・注入・受け渡し・既存の`model.onChange`への同期の追加のみ。**判定・計算を書かない** | `// 7.8.`・`// 7.10.` |

**正本（同じ判定・同じ計算を2か所に書かない）**

* 外枠の求め方＝`js/io/SpriteSerializer.computeShapesBounds`、照会の入口＝`js/edit/ShapeExtentReader`（要件1で照会を1つ足す。範囲の計算は書かない）
* 操作の値・移動量の計算・全体の範囲の計算・押せるかの判定＝`js/edit/ShapeAlignRules`（要件2。全体の範囲を規則の外で求めない）
* 図形ごとに違う移動量の反映＝`js/core/VectorModel.moveShapesBy`（要件3。`shape.translate`への委譲）
* 記録＝`HistoryManager.beginEdit`／`commitEdit()`の対（鍵なし）

**決めた名前（以後のタスクはこの名前を使う）**

| 種類 | 名前 |
| --- | --- |
| 要件1の照会 | `ShapeExtentReader.getSelectedBoundsPerShape()` → `Array<ShapeBoundsEntry>`（typedef`ShapeBoundsEntry`＝`{ id: string, bounds: {minX, minY, maxX, maxY} }`） |
| 要件2の列挙 | `ShapeAlignOperation`（下表の8つ） |
| 要件2の関数 | `computeAlignMoves(items, operation)` → `Array<{id, dx, dy}>`、`canApplyAlign(items, operation)` → `boolean` |
| 要件3のメソッド | `VectorModel.moveShapesBy(moves)`（`moves`＝`Array<{ id, dx, dy }>`） |
| 要件4のクラス | `ShapeAlignEditor`（`apply(operation)`・`getAvailability()`）、typedef`ShapeAlignAvailability` |
| 要件6のクラス | `OptionBarAlignGroup`（`render(view)`）、typedef`ShapeAlignAvailability`（二重定義）・`OptionBarAlignGroupActions`（`onAlign`） |
| 要件7の関数 | `performShapeAlign(operation)`・`syncOptionBarAlignGroup()` |
| 要件5のまとまり | `<div id="option-align-group" class="toolbar-group">` |

**操作の値・ボタン・記号の対応（並び＝ボタンの並び＝列挙の宣言順）**

| 列挙のキー | 値（文字列） | ボタンのid | 記号（案） | `title` |
| --- | --- | --- | --- | --- |
| `ALIGN_LEFT` | `'alignLeft'` | `option-align-left` | `⬅` | 左へそろえる |
| `ALIGN_HORIZONTAL_CENTER` | `'alignHorizontalCenter'` | `option-align-horizontal-center` | `↔` | 左右中央へそろえる |
| `ALIGN_RIGHT` | `'alignRight'` | `option-align-right` | `➡` | 右へそろえる |
| `ALIGN_TOP` | `'alignTop'` | `option-align-top` | `⬆` | 上へそろえる |
| `ALIGN_VERTICAL_CENTER` | `'alignVerticalCenter'` | `option-align-vertical-center` | `↕` | 上下中央へそろえる |
| `ALIGN_BOTTOM` | `'alignBottom'` | `option-align-bottom` | `⬇` | 下へそろえる |
| `DISTRIBUTE_HORIZONTAL` | `'distributeHorizontal'` | `option-distribute-horizontal` | `⋯` | 横方向に均等に並べる |
| `DISTRIBUTE_VERTICAL` | `'distributeVertical'` | `option-distribute-vertical` | `⋮` | 縦方向に均等に並べる |

* 値（文字列）は、`ShapeAlignEditor.getAvailability`が返す`ShapeAlignAvailability`のキー、`OptionBarAlignGroup`の対応表の操作の文字列（＝表示内容のキー）、`onAlign`へ渡す引数に**同じ文字列として**使う（二重定義。変えるときは`ShapeAlignRules.js`・`ShapeAlignEditor.js`のtypedef・`OptionBarAlignGroup.js`の3か所をそろえる）。
* **記号は`index.html`のボタンの中身の1か所だけで決まる**（JS側は記号を持たない）。見分けにくければ発注者の判断で差し替えられる（要件8の確認項目0）。

---

### 要件1: 選んでいる図形1つずつの外枠の照会（`js/edit/ShapeExtentReader.js`。既存へ追加）

既存の`getSelectedBounds`・`getAllBounds`・コンストラクタ・フィールドは**一切変えず**、公開メソッドを1つ足す。

```js
getSelectedBoundsPerShape() → Array<{ id: string, bounds: {minX, minY, maxX, maxY} }>
```

* `this.#model.getShapes()`を描画順のまま走査し、`this.#model.isSelected(shape.id)`が真の図形だけについて、`SpriteSerializer.computeShapesBounds([shape])`（図形1つを渡す）で外枠を求め、`{ id: shape.id, bounds }`の新しいオブジェクトにして新しい配列で返す。選択なしなら空配列。
* `computeShapesBounds`が`null`を返した図形は結果に含めない（保険。図形1つを渡すと`null`にならない＝`null`は要素0個のときだけ、という理由をJSDocに書く）。
* 範囲の計算を本クラスに書かない。図形種別の分岐・図形固有のプロパティ名を持たない（読むのは`id`のみ）。モデル・選択集合・履歴を変えない。DOMに触れない。**importは現在のまま**（`io/SpriteSerializer.js`のみ）。
* typedef`ShapeBoundsEntry`を本ファイルに書く（`edit/ShapeAlignRules.js`の`AlignItem`と同じ形の二重定義である旨と、形を変えるときは両方をそろえることを明記）。
* `@throws`は既存の2メソッドと同じ（`computeShapesBounds`と同じ）。
* ファイル先頭の責務定義（3行以内）に「図形1つずつの外枠」を加える（既存の記述は残す）。
* 各図形の外枠の和は`getSelectedBounds()`と同じ値になる（`#computeBounds`は要素ごとの最小・最大を取るだけのため）。これを要件2の「全体の範囲を規則の中で求める」根拠としてJSDocに1行書く。

**テスト**（`test/edit/ShapeExtentReader.test.js`へ`describe('ShapeExtentReader.getSelectedBoundsPerShape')`を追加。既存のケース・`setup()`は変えない。新しい補助関数を足すならJSDoc付き）：

* 選択なしで空配列。
* 1つ選択：要素1件で、`id`が一致し、`bounds`が`getSelectedBounds()`と`deepEqual`。
* 複数選択：描画順のまま・件数・各要素の`bounds`が`SpriteSerializer.computeShapesBounds([その図形])`と`deepEqual`（既存のテストと同じ「正本と比べる」確かめ方）で、要素どうしが違う値であること。
* 線を描く図形は線の太さの半分だけ外側へ広がる：正本との比較に加え、数値でも1件確かめる（例：`new Rect(0, 0, 10, 10, '#000000', 4, null)`で`minX === -2`・`maxX === 12`。線なし（`strokeColor: null`）の図形は形の範囲のまま、を対で確かめてよい）。
* 選択中でない図形が含まれないこと（`id`の一覧で確かめる）。
* モデルを変えないこと（既存の「副作用」のケースと同じ確かめ方：図形のインスタンス・`toJSON`・選択集合が同じで`onChange`が0回）。

---

### 要件2: 整列・分布の規則（`js/edit/ShapeAlignRules.js`。新規）

状態を持たず、DOM（要素・id・クラス名）に触れず、`VectorModel`・図形のインスタンス・履歴・イベント・操作モードを知らない。**importを持たない**（`ShapeOrderRules.js`と同じ）。図形種別の分岐・図形固有のプロパティ名を持たない（受け取るのは`id`と外枠の数値だけ）。

**公開するもの**

```js
export const ShapeAlignOperation = Object.freeze({ ...上表の8つ });
export function computeAlignMoves(items, operation) → Array<{ id, dx, dy }>
export function canApplyAlign(items, operation) → boolean
```

* typedef`AlignItem`（`{ id: string, bounds: { minX, minY, maxX, maxY } }`。`ShapeExtentReader.js`の`ShapeBoundsEntry`との二重定義である旨を明記）と、typedef`AlignMove`（`{ id: string, dx: number, dy: number }`）を書く。
* `ShapeAlignOperation`のJSDocには、値が`ShapeAlignAvailability`のキーと`OptionBarAlignGroup`の対応表の操作の文字列に同じ文字列として使われること、変えるときは両方そろえること（値を変えると表示側が黙って押せない表示になるため）を書く（`ShapeOrderOperation`の書き方にならう）。

**非公開のもの（本ファイル1か所の定義）**

* `assertKnownOperation(operation)`：`Object.values(ShapeAlignOperation).includes(operation)`でなければ`Error`をthrow（`ShapeOrderRules`と同じ形。文言は`ShapeAlignRules: 未知の整列・分布の操作です: ${String(operation)}`）。
* `ZERO_MOVE_EPSILON = 1e-9`：移動量が0かの判定の許容量。**JSDocに理由を書く**（分布は割り算・累積の足し算を使うため、すでに均等な図形でも計算の誤差で極小の移動量が出ることがある。そのままでは「押せるのに押しても見た目が変わらない」ボタンが残り、発注者の決定3を満たせないため。座標そのものは丸めない）。
* 図形の数の下限：整列は2、分布は3（定数として1か所に置く）。
* 操作ごとの定義の表（凍結）：各操作について「種類（整列／分布）」「軸（X／Y）」「整列のときの基準（最小端・中央・最大端）」を持つ。軸は外枠のキー（X軸＝`minX`・`maxX`、Y軸＝`minY`・`maxY`）で表し、**XとYで同じ手順を2回書かない**（軸のキーを引数にした非公開の関数1つで両軸を扱う）。

**`computeAlignMoves(items, operation)`の手順**

1. `assertKnownOperation(operation)`（**計算の前に投げる**。`items`が空でも投げる）。
2. 件数が下限未満（整列は2件未満、分布は3件未満）なら空配列を返す。
3. **全体の範囲**を`items`の外枠の和（`minX`・`minY`の最小、`maxX`・`maxY`の最大）として**この関数の中で求める**（選択全体の外枠を別の引数で受け取らない）。
4. 各図形の、操作の軸の移動量を求める（もう一方の軸は`0`）。
   * **整列**：最小端＝`全体.min − 図形.min`／最大端＝`全体.max − 図形.max`／中央＝`(全体.min + 全体.max) / 2 − (図形.min + 図形.max) / 2`。
   * **分布**：
     1. `items`の**コピー**を軸の`min`の昇順に並べる（`Array.prototype.sort`はES2019以降安定なため、同じ値のときは元の順が保たれる。引数の配列は並べ替えない）。
     2. すき間＝（全体の長さ（`全体.max − 全体.min`）− 各図形の長さ（`図形.max − 図形.min`）の合計）÷（件数 − 1）。
     3. 並べた順に置いていく：先頭は`置く位置 = 全体.min`、以降は`置く位置 = 直前の図形の置いた後の max ＋ すき間`（直前の図形の置いた後の max ＝ 直前の置く位置 ＋ 直前の図形の長さ）。各図形の移動量＝`置く位置 − 図形.min`。
     * 結果として、並べたときの先頭の図形は動かず、末尾の図形の右端（下端）が全体の右端（下端）にそろう。すき間が負（重なっていて長さの合計が全体の長さを超える）でも同じ手順で計算する（**異常として扱わない・特別扱いしない**）。入れ子などで「`max`が最大の図形」が並べた末尾でない場合も同じ手順のとおり（末尾の図形が動いて右端が全体の右端にそろう）。
5. **移動量が0の図形を除く**：`Math.abs(dx) < ZERO_MOVE_EPSILON && Math.abs(dy) < ZERO_MOVE_EPSILON`の図形は結果に含めない。含める図形の移動量は**計算した値のまま**（丸めない・極小の成分を0へ書き換えない。動かさない軸はもともと`0`）。
6. 結果は**`items`の元の順**（＝描画順）で、毎回新しい配列・新しいオブジェクト`{ id, dx, dy }`を返す。
* **丸めない**（刻みへの丸め・小数の切り捨て・`Math.round`等を書かない）。引数（`items`・各要素・各`bounds`）を書き換えない。外枠の値が有限であることは呼び出し側（`ShapeExtentReader`の値）の前提とし、検証しない（JSDocに書く）。

**`canApplyAlign(items, operation)`**：`computeAlignMoves(items, operation).length > 0`。**押せる・押せないの判定と手順の「何もしない」の判定はこの関数だけで行う**（規則を二重に書かない）旨をJSDocに書く（`canReorderSelected`の書き方にならう）。未知の操作は`computeAlignMoves`と同じく`Error`。

**テスト**（`test/edit/ShapeAlignRules.test.js`。新規。素のオブジェクトの配列を使い、図形クラスを使わない。補助関数（例：`item(id, minX, minY, maxX, maxY)`）にはJSDoc）：

* 列挙：8つの値（上表のとおり）・凍結されていること。
* 8操作それぞれの移動量：大きさの違う図形を混ぜ、軸ごとに期待値を数値で確かめる（動かさない軸が`0`であることも確かめる）。
* 整列は1件・0件で空配列／分布は2件・1件・0件で空配列（`canApplyAlign`は偽）。
* すでにそろっているときに空配列（＝`canApplyAlign`が偽）：整列（例：左がそろっている）・分布（すき間が等しい）。
* 分布で**両端が動かないこと**（並べた先頭と末尾が結果に含まれない）・**すき間が等しくなること**（移動量を当てた後の外枠から隣どうしのすき間を計算して等しい）。
* 図形が重なっていてすき間が負になる場合（負のまま均等になり、`Error`にならない）。
* `minX`（`minY`）が同じ図形があるときに元の順が保たれること（並べた順で置かれることを移動量で確かめる）。
* 入れ子で`maxX`が最大の図形が並べた末尾でない場合に、手順どおりの移動量になること。
* 移動量が0の図形が結果に含まれないこと（整列で基準の端にある図形）。
* 極小の誤差（`1e-12`程度ずれた外枠）が0として扱われること（その図形が結果に含まれない。すべてがその状態なら`canApplyAlign`が偽）。
* 未知の操作で`Error`（`items`が空でも。`computeAlignMoves`・`canApplyAlign`とも）。
* 引数（`items`の配列の並び・各要素・各`bounds`）を書き換えないこと（呼ぶ前の`JSON.stringify`と比べる。分布で並べ替えが起きるケースを含める）。
* 結果が毎回新しい配列で、要素が`items`の要素と別のオブジェクトであること。

---

### 要件3: 図形ごとに違う移動量をまとめて当てる入口（`js/core/VectorModel.js`。既存へ追加）

**既存の`moveShapes(ids, dx, dy)`の名前・引数・ふるまい・JSDocは一切変えない。** `moveShapes`の直後にメソッドを1つ足す。

```js
moveShapesBy(moves)   // moves: Array<{ id: string, dx: number, dy: number }>
```

* 書き方は`updateVertices(updates)`にそろえる：`let moved = false;` → `for (const { id, dx, dy } of moves)`で`this.#shapes.find((s) => s.id === id)`、無ければ`continue`、あれば`shape.translate(dx, dy)`（**図形種別を問わない共通メソッドへの委譲**。分岐を書かない）して`moved = true` → ループの後で`if (moved) this.#notifyChange();`（**1件以上動かしたときだけ1回**）。
* 存在しない`id`は飛ばす。空配列では何もせず通知もしない。引数の配列・要素を書き換えない。選択集合・ホバー・頂点の選択・並びに触れない（`#pruneSelectedVertices`も呼ばない。`moveShapes`・`updateVertices`と同じ扱い）。
* 同じ`id`が複数回現れた場合は配列の順にそれぞれ当てる（`updateVertices`と同じ。JSDocに書く）。
* JSDocに、`moveShapes`との違いを1行で書く（`moveShapes`＝指定した図形すべてを同じ量だけ／`moveShapesBy`＝図形ごとに違う量。用途：整列・分布）。同じ形の入口（配列を受け取り通知1回）が`updateVertices`と2つになるため、どちらがどの用途か（`updateVertices`＝頂点の絶対座標の更新／`moveShapesBy`＝図形の相対移動）をJSDocに示す。
* **ファイル先頭の責務定義は変えない**。importを増やさない。

**テスト**（`test/core/VectorModel.moveShapesBy.test.js`。新規。`VectorModel.updateVertices.test.js`の書き方（`node:test`の`test`・`setup()`・通知の回数のカウンタ・idを直接代入した図形）にそろえる）：

* 図形ごとに違う量で動くこと（2図形にそれぞれ別の`{dx, dy}`。座標で確かめる）・通知1回。
* 存在しない`id`を飛ばすこと（混在なら見つかったものだけ動いて通知1回）。
* **変更の通知が1回だけであること**（複数件でも1回）。
* 1件も動かなかった（全部が存在しない`id`）ときに通知しないこと。
* 空配列で何も起きないこと（通知0回）。
* 引数（配列・要素）を書き換えないこと。
* 選択集合・頂点の選択を変えないこと。
* 既存の`moveShapes`のふるまいが変わっていないこと（同じファイル内で：全図形が同じ量だけ動く・存在しないidを無視・通知1回／動かなければ0回）。**既存のテストファイルは変えない**。

---

### 要件4: 整列・分布の編集操作（`js/edit/ShapeAlignEditor.js`。新規）

**DOM（要素・id・クラス名）を知らない。** 操作モードを知らない（選択集合に図形があるかだけで決まる）。`ShapeOrderEditor.js`の作り・JSDocの書き方（責務定義・typedef・クラスの「依存の制約」「前提（呼び出し側の責務）」・処理順の番号付きJSDoc）にそろえる。

* **import**：`./ShapeAlignRules.js`の`ShapeAlignOperation`・`computeAlignMoves`・`canApplyAlign`のみ（`edit/`内の例外。`ShapeOrderEditor`と同じ）。
* **コンストラクタ**`{ model, editRecorder, shapeExtentReader }`（他の`edit/`のクラスと同じく検証しない）。非公開フィールド3つ（JSDoc付き）。
  * `model`：`moveShapesBy`だけを使う。
  * `editRecorder`：`import('./ShapeInserter.js').EditRecorder`（実体は`HistoryManager`。`beginEdit`・`commitEdit`だけを使う）。
  * `shapeExtentReader`：`getSelectedBoundsPerShape`だけを使う。
* typedef`ShapeAlignAvailability`（8つの`boolean`。キーは`ShapeAlignOperation`の値）を書く。`palette/OptionBarAlignGroup.js`と同じ内容の二重定義である旨と、形を変えるときは両方をそろえることを明記。

| メソッド | 内容 |
| --- | --- |
| `apply(operation)` → `boolean` | 1. `items = shapeExtentReader.getSelectedBoundsPerShape()`。2. `canApplyAlign(items, operation)`が偽なら**記録先に一切触れずに**`false`（履歴も通知も増えない。未知の操作はここで規則が`Error`をthrowする＝`beginEdit`より前のため対が崩れない）。3. `moves = computeAlignMoves(items, operation)`。4. `editRecorder.beginEdit()` → `model.moveShapesBy(moves)`（**1回**）→ `editRecorder.commitEdit()`（**引数なし＝まとめの鍵を渡さない**）。5. `true` |
| `getAvailability()` → `ShapeAlignAvailability` | `items`を**1回だけ**求め、`Object.values(ShapeAlignOperation)`の8操作それぞれで`canApplyAlign(items, operation)`を入れたオブジェクトを返す（外枠の計算を8回しない）。モデル・選択集合・履歴を変えない |

* 図形種別の分岐・図形固有のプロパティ名・idの形式を持たない。`try/catch`を持たない。ドラッグ中かの判定を持たない（`main.js`の`performShapeAlign`が持つ）。
* 再描画・UI同期を自分で呼ばない（`model.onChange`の経路のみ）。ビュー変換（表示倍率・スクロール）を読まない（値はワールド座標のpx）。スナップの設定を読まない。
* クラスのJSDocの「前提」に、選択モード・頂点の選択モード以外・読み込み中は選択集合が空のため何もしないこと（操作モードは知らない）と、進行中の入力操作の中断・モード切り替えを行わないことを書く（`ShapeOrderEditor`と同じ）。

**テスト**（`test/edit/ShapeAlignEditor.test.js`。新規。`ShapeOrderEditor.test.js`の組み方にそろえる。**`model`（`VectorModel`）・図形クラス・`shapeExtentReader`（`ShapeExtentReader({ model })`）は実物**、**記録先は呼び出しを記録する素のオブジェクトの偽物**（`beginEdit: (...args) => calls.push(['beginEdit', ...args])`・`commitEdit: (...args) => calls.push(['commitEdit', ...args])`＝引数の個数を観測できる形）。補助関数はJSDoc付き）：

* 図形が実際にそろうこと（モデルの座標＝そろえた後に`ShapeExtentReader`で求めた各図形の外枠で確認）：整列（左・右・上下中央など代表）と分布（横・縦）。
* **線の太さを含む外枠でそろうこと**：太さの違う図形を混ぜて左へそろえ、各図形の外枠の`minX`（線の外側）が等しく、中心線の座標は太さの分だけずれていること。
* 押せないとき（図形0個・1個、分布で2個、すでにそろっている）に`apply`が`false`で**記録先を1回も呼ばないこと**（`calls`が空）、モデルの通知も0回。
* 動いたときに`beginEdit`→`commitEdit`の対が**1回だけ**で、**まとめの鍵が渡らないこと**（記録の各要素の長さが1＝引数の個数が0）、モデルの通知が1回。
* 選択中でない図形が動かないこと。
* `getAvailability()`が8操作分のキー（`ShapeAlignOperation`の値の集合と一致）を返し、図形2個・3個で整列／分布の可否が分かれること、モデル（`toJSON`）・選択集合を変えず通知0回・記録先を呼ばないこと。
* `getAvailability()`で照会が1回だけ呼ばれること（実物の`ShapeExtentReader`を包んで呼び出しを数える素のオブジェクトを渡す）。
* 未知の操作で`Error`（記録先を呼ばない）。

---

### 要件5: オプションバーの整列・分布のまとまり（`index.html`。更新）

**HTML**：`#option-position-group`の`</div>`の後ろ（`</header>`の前＝オプションバーの末尾）に、まとまりを1つ足す。既存のまとまりの並び・DOMのid・クラス名は変えない。

```html
<div id="option-align-group" class="toolbar-group">
    <button type="button" id="option-align-left" class="tool-btn icon-btn" title="左へそろえる" disabled>⬅</button>
    …（上表の順で8つ。id・記号・title は上表のとおり。すべて初期値 disabled）
</div>
```

* ボタンは既存の`class="tool-btn icon-btn"`をそのまま使い、**新しいクラス・新しい見た目の決まりを作らない**。要素idの接頭辞は`option-`。
* **HTMLの初期値として`disabled`を書く**（起動時に`main.js`が1回同期するまで押せない。重なり順のまとまりと同じ形）。
* `title`には操作の名前だけを書く。**キーは割り当てないため`title`にキーを書かない**。
* **記号はこのHTMLの1か所だけで決まる**（見分けにくければ発注者の判断で差し替えられる）。

**CSS**：**宣言は足さない・変えない**（`.toolbar-group`の区切り・`.tool-btn.icon-btn`がそのまま効く）。更新するのは「ツールバー全体の幅の見積もり（1280px幅）」のコメントだけ：既存の式の末尾に`＋区切り17px＋整列・分布284px（ボタン32×8＋間隔4×7）`を加え、合計を`約1138px`に直す。

**1280px幅に収まるかの検算（計画立案時に実コードで確認済み）**

* ボタンの幅：`.icon-btn`の`width: 32px`（`box-sizing: border-box`のため枠を含めて32px）。
* まとまりの中の間隔：`.toolbar-group`の`gap: 4px`（`.toolbar`自体は`gap`を持たない）。
* まとまりの区切り：`.toolbar-group + .toolbar-group`の`border-left: 1px`＋`margin-left: 8px`＋`padding-left: 8px`＝17px。
* 足す分：17＋32×8＋4×7＝**301px**。起点は`_doc/COWORK_STATUS.md`2章Cの実測（最後の要素の右端は1280px幅で約828px）で合計**約1129px**、CSSコメントの見積もり（約837px。左右の余白16pxを含む）基準でも**約1138px**。1280pxに対して約140〜150pxの余裕があり、**1行に収まる見込み**（実装を止める必要はない）。実測の確認は要件8の確認項目0で発注者に見てもらう。

---

### 要件6: UI部品（`js/palette/OptionBarAlignGroup.js`。新規）

既存のオプションバーのUI部品と**同じ約束**：**importを持たず、状態・判定を持たず、図形データ・選択状態・規則・編集操作に関与しない**（受け取るのは`render(view)`の表示内容とコンストラクタのコールバックのみ）。`OptionBarOrderGroup.js`の作り・JSDocの書き方にそろえる。

* ファイル先頭に単一責務のJSDoc（3行以内。例：「ツールバーのオプションバーの『整列・分布』のまとまり（`#option-align-group`）の8つのボタンの押せる/押せないの表示と、押下のコールバックへの通知を担う。選択状態・整列・分布の規則には関与しない。DOM操作専任。」）。
* typedef`ShapeAlignAvailability`（`edit/ShapeAlignEditor.js`との二重定義である旨を明記）と`OptionBarAlignGroupActions`（`onAlign: (operation: string) => boolean`。押されたボタンの操作の文字列を受け取る。**戻り値は本部品では使わない**）。
* **ボタンの対応表**`ALIGN_BUTTONS`（凍結した配列。要素も凍結）：各要素は`{ operation, id }`（`operation`＝操作の文字列で、`ShapeAlignAvailability`のキー（表示内容のキー）と`onAlign`へ渡す値を兼ねる。両者は同じ文字列のため1つのフィールドで持つ。`id`＝`'#option-align-left'`等のセレクタ）。上表の順で8つ。本ファイルの唯一の定義で、操作の文字列は`edit/ShapeAlignRules.js`の`ShapeAlignOperation`と同じ内容の二重定義（importを持たない約束のため。`OptionBarPositionGroup`が軸の文字列を持つのと同じ扱い。形を変えるときは両方をそろえる）である旨をJSDocに書く。
* コンストラクタ`(groupElement, actions)`：
  * `actions`が無い、または`actions.onAlign`が関数でなければ`Error`を投げる（**コールバックは1つだけ**。8つ分を並べない）。
  * 要素はルート要素内の`querySelector(id)`で解決し、1つでも欠ければ`console.warn`（`OptionBarAlignGroup: 整列・分布のまとまりの要素が見つからないため、配線しません。`）して配線しない（以後の`render`は何もしない）。
  * 配線：各ボタンの`click`で`this.#actions.onAlign(entry.operation)`を呼ぶ。
* `render(view)`：配線されていなければ何もしない。8つのボタンの`disabled`を、`!(view && view[operation] === true)`で**毎回**当てる（`true`のときだけ押せる）。
* `disabled`のボタンには`click`が来ないため、**押せない判定を`click`側に書かない**（クラスのJSDocに明記。`OptionBarOrderGroup`と同じ）。
* クラスのJSDocに「まとまりの構成」（ルート要素は自分の`<div id="option-align-group" class="toolbar-group">`、既存のまとまり・UI部品を変えない、隣に別のまとまりを足せる）を書く。
* **テストは置かない**（DOMに依存するため）。`_doc/arch/16_test.md`の「テストできない箇所」への記載は最終タスクで行う。

---

### 要件7: 配線（`js/main.js`。更新）

* **import**を2つ足す：`import { ShapeAlignEditor } from './edit/ShapeAlignEditor.js';`・`import { OptionBarAlignGroup } from './palette/OptionBarAlignGroup.js';`（既存のオプションバーのimportの並び＝`OptionBarPositionGroup`のimportの後に置く）。**`ShapeAlignOperation`は`main.js`でimportしない**（UI部品が操作の文字列を渡すため）。
* `// 7.10.`のブロック（`model.onChange(syncOptionBarPositionGroup);`）の後・`// 8.`の前に、**`// 7.11. オプションバー（整列・分布のまとまり）配線`**のブロックを足す（`// 7.8.`・`// 7.10.`と同じ形。冒頭コメントで分担（表示＝`OptionBarAlignGroup`、編集操作＝`ShapeAlignEditor`、規則＝`ShapeAlignRules`、外枠の照会＝`// 7.10.`の同じ`shapeExtentReader`）と「判定・計算を書かない」「表示の同期は`model.onChange`のみ」「キーは割り当てない」を示す）。
  1. `const shapeAlignEditor = new ShapeAlignEditor({ model, editRecorder: historyManager, shapeExtentReader });`（**`shapeExtentReader`は`// 7.10.`で生成した既存のインスタンス**。3つ目を生成しない。`js/wiring/DisplayWiring.js`は変更しない）。
  2. `function performShapeAlign(operation)`（JSDoc付き。`performShapeOrder`と同じ形）：(1) `inputTracker.isDragging()`が真なら何もせず`false`（ボタンはショートカット以外の呼び出し元のため、中ボタンのパン中に左クリックで押される場合に備える）。(2) それ以外は`shapeAlignEditor.apply(operation)`の結果を返す。**判定・計算を書かない。**
  3. `const optionBarAlignGroup = new OptionBarAlignGroup(document.getElementById('option-align-group'), { onAlign: (operation) => performShapeAlign(operation) });`（操作の文字列をそのまま渡し、戻り値をそのまま返すだけ）。
  4. `function syncOptionBarAlignGroup()`（JSDoc付き。橋渡しのみ）：`optionBarAlignGroup.render(shapeAlignEditor.getAvailability());`。`model.onChange(syncOptionBarAlignGroup);`で登録する。
* **起動時の1回の同期**：`syncOptionBarPositionGroup();`の後に、既存と同じ形のコメント（`index.html`の初期`disabled`属性や`onChange`通知に依存させず、選択集合と図形の外枠の実値で明示的に1回同期する）付きで`syncOptionBarAlignGroup();`を足す。
* **整列・分布専用の再描画・同期の経路を作らない**。`document`へのイベントの購読も足さない。キーの割り当て（`// 8.`の`KeyboardShortcuts`への注入）に何も足さない。
* 追従の確認（新しい通知を足さないことの裏取り）：選択の変更（`setSelection`・`clearSelection`）・移動（`moveShapes`・`moveShapesBy`・`updateVertices`）・取り消し／やり直し（`replaceAllShapes`）・線の太さの変更（`updateShapeStyles`）・キャンバスの切り替え（`replaceAllShapes`）・モードの切り替え（`clearSelection`）がすべて`model.onChange`を通知することをコードで追って確かめる。

---

### 要件8: ふるまいの確認（テストプレイの確認項目）

実装AIは、下記の確認項目を**実装後のコードで裏取りしたうえで**発注者へ提示する（発注者はコードを読まない。ブラウザでの操作の言葉で書く）。

0. **準備**：ブラウザで画面を開き、`Ctrl`+`F5`（強制再読み込み）で最新の状態にする。**1280px幅のウィンドウで、ツールバーが1行に収まり、右端（最後のボタン）が切れていない**ことを確かめる。あわせて**8つのボタンの記号が見分けられる**かを見る（見分けにくければ差し替えられる）。直線・曲線・矩形・パス・円・弧を、**大きさと線の太さを変えて**いくつか描いておく。
1. **何も選んでいないとき・1つだけ選んでいるとき**、8つのボタンがすべて押せない見た目であること。
2. **2つ選ぶ**と整列の6つが押せるようになり、**分布の2つはまだ押せない**こと。**3つ選ぶ**と分布の2つも押せること。
3. 左・右・上・下へそろえると、**選択全体の外枠の端**に各図形の端がそろうこと（いちばん左の図形は動かない）。
4. 左右中央・上下中央へそろえると、各図形の中央が**選択全体の中央**にそろうこと。
5. **線の太さが違う図形を混ぜて左へそろえる**と、**線の外側**がそろうこと（外枠に線の太さを含めているため。ステータスバーの「大きさ」・位置の欄と同じ考え方。これは仕様）。
6. **すでにそろっている図形を選ぶと、その操作のボタンが押せない見た目になる**こと（例：左へそろえた直後は「左へ」が押せない。別の図形を動かすと押せるようになる）。
7. **横方向に均等**にすると、**いちばん左といちばん右の図形は動かず**、間の図形が動いて**外枠どうしのすき間が等しく**なること（大きさの違う図形を混ぜて確かめる）。**縦方向に均等**も同じこと。
8. 図形が重なっている状態で均等にすると、**すき間が負のまま均等に重なる**こと（エラーにならない）。
9. **取り消し（`Ctrl`+`Z`）1回で、そろえる前の位置に全部戻る**こと（操作1回＝取り消し1件）。やり直し（`Ctrl`+`Shift`+`Z`または`Ctrl`+`Y`）1回でそろえた状態へ戻ること。続けて2回そろえたら、取り消しも2回必要であること。
10. **円・弧・パス・曲線**も外枠でそろうこと（中心ではない）。
11. スナップの刻みを10pxにしても、**そろえた結果が刻みへ丸められない**こと（そろえた位置がそのままであること）。
12. 表示倍率・スクロールを変えても**同じ結果**になること（倍率に関係なくワールド座標でそろう）。
13. そろえた後に、**矢印キーでの微調整・位置の数値の欄・マウスでのドラッグ**が従来どおり働くこと。位置の欄の表示がそろえた結果に追従すること。
14. **既存のまとまりが従来どおり**であること（線・塗りのON/OFFと色・太さ、重なり順の4ボタン、位置のX・Yの欄）。
15. 頂点の選択（`A`）に切り替えたときの挙動（選択が空になるため、ボタンは押せない見た目になる。`A`のまま図形を選べる場合は、重なり順のボタンと同じ扱いで押せる）。**実装後のコードで実際の挙動を確かめてから提示すること**（計画時点の読み：`InputTracker.setMode`は`model.clearSelection()`を呼ぶためモードの切り替えで選択は空になる。`A`のまま図形をクリックすると選択集合に図形が入るため、2つ以上なら押せる。`ShapeAlignEditor`は操作モードを見ない）。
16. 図形を**たくさん（30個程度）**選んでそろえたとき、待たされる感じがないこと。

---

### 関連フォルダと論理クラス

* **対象フォルダ**
  * `./js/edit/` － 編集操作と規則（`ShapeAlignRules`・`ShapeAlignEditor`を新設、`ShapeExtentReader`へ照会を1つ追加）
  * `./js/core/` － `VectorModel`へ図形ごとに違う移動量をまとめて当てる入口を1つ追加
  * `./js/palette/` － DOM専任のUI部品（`OptionBarAlignGroup`を新設）
  * `./index.html` － オプションバーの整列・分布のまとまり（HTMLとCSSコメント）
  * `./js/main.js` － 生成・注入・同期の配線（`// 7.11.`）
  * `./test/core/`・`./test/edit/` － 自動テスト
* **関連する論理クラス・関数**
  * 新規：`ShapeAlignRules`（`ShapeAlignOperation`・`computeAlignMoves`・`canApplyAlign`）、`ShapeAlignEditor`（`apply`・`getAvailability`）、`OptionBarAlignGroup`（`render`）、`ShapeExtentReader.getSelectedBoundsPerShape`、`VectorModel.moveShapesBy`
  * 既存（使うだけ・変えない）：`SpriteSerializer.computeShapesBounds`、`ShapeExtentReader`のコンストラクタ（`// 7.10.`の同じインスタンス）、`VectorModel.getShapes`／`isSelected`／`onChange`、図形の共通メソッド`translate`・`toDrawElement`、`HistoryManager.beginEdit`／`commitEdit`、`InputTracker.isDragging`

### 参照する責務

（以後のタスク実行チャットは、この項目のみを責務情報源とする）

* **依存方向（1章）**：`main.js → edit → io → core → shapes`の一方向（`main.js`は加えて`wiring/`をimportする）。`core/`は`io/`・`edit/`・`palette/`・`asset/`をimportしない。`palette/`は何もimportしない。循環importを作らない。
* **`edit/`（全クラス共通）**：`io/`・`core/`の機能を組み合わせて図形一式を扱う手順。**知らないこと＝DOM、図形種別の分岐、図形固有のプロパティ名、図形のid形式、操作モード**（`InputTracker`に依存しない）。他の依存（`VectorModel`・`HistoryManager`等）は注入で受け取り、コンストラクタで検証しない。importの例外は個別に列挙されている（`ShapeOrderEditor`＝`edit/`内の`./ShapeOrderRules.js`のみ、`ShapeExtentReader`＝`io/SpriteSerializer`のみ）。
* **`ShapeOrderRules.js`（ならう先）**：選択中の要素の重なり順の変更の規則。状態を持たない`export`した関数と定数のみ。**importなし・DOMに触れない**・要素を不透明に扱う。公開は`ShapeOrderOperation`（4操作の値の唯一の定義。`Object.freeze`）・`reorderSelected`・`canReorderSelected`。未知の操作は非公開の`assertKnownOperation`で`Error`（`items`が空でも）。**`canReorderSelected`は`reorderSelected`の結果から求め、押せる/押せないと手順の「何もしない」の判定をこの1か所に保つ**。操作の値は`ShapeOrderAvailability`のキー・`OptionBarOrderGroup`の対応表のキーにも同じ文字列として使われる（変えるときは両方をそろえる）。
* **`ShapeOrderEditor.js`（ならう先）**：選択中の図形の重なり順を、規則で求めた並びを履歴の記録で挟んで`VectorModel`へ渡す1件の編集操作。公開は`apply(operation)`・`getAvailability()`。コンストラクタ`{ model, editRecorder }`（`editRecorder`の型は`import('./ShapeInserter.js').EditRecorder`）。`apply`の処理順：可否が偽なら何も呼ばずに`false`（未知の操作はここで規則が`Error`。`beginEdit`より前）→ 規則で結果を求める → `beginEdit()` → モデルの更新 → `commitEdit()`。DOMなし・`try/catch`なし。ドラッグ中でないことは呼び出し側（`main.js`の`performShapeOrder`）の責務。typedef`ShapeOrderAvailability`は`palette/OptionBarOrderGroup.js`と二重定義。
* **`ShapeExtentReader.js`**：選択中の図形・全図形の外枠（書き出しの`bounds`と同じ求め方）の照会のみ。公開は`getSelectedBounds`（選択なしで`null`）・`getAllBounds`。どちらも`SpriteSerializer.computeShapesBounds`を使う（**外枠の求め方を二重に書かない**）。コンストラクタは`{ model }`（`getShapes`・`isSelected`を使う）。図形・選択集合・履歴に触れず、作成途中の図形は`getShapes()`に含まれないため対象外。`@throws`は`computeShapesBounds`と同じ。**生成は2か所**（`wiring/DisplayWiring`の内部と、`main.js`の`// 7.10.`。状態を持たない照会で値は同じ）。
* **`SpriteSerializer.computeShapesBounds(shapes)`**：各図形の`toDrawElement()`の形の範囲の和（要素ごとの最小・最大を取る）。**`strokeColor`が文字列の要素は形の範囲を線の太さの半分だけ広げる**（線を描かない要素は形の範囲のまま）。図形0個で`null`。
* **`VectorModel`**：図形データ・選択集合等の状態管理（SSOT）と更新通知。`moveShapes(ids, dx, dy)`は指定した図形すべてを`shape.translate(dx, dy)`へポリモーフィックに委譲して同じ量だけ動かし、1件以上移動したときだけ通知1回。`updateVertices(updates)`は各組を配列の順に`shape.setVertex`へ委譲し、1件以上更新したときだけ通知1回（存在しないidは無視・空配列では何もしない・引数を書き換えない）。`moveShapes`・`updateVertices`・`updateShapeStyles`・`reorderShapes`は選択集合・図形の増減を変えないため`#pruneSelectedVertices`を呼ばない。**知らないこと**：図形固有の頂点構造・内部プロパティ名。委譲は`setVertex`/`translate`/`updateDraftEnd`へポリモーフィックに行う。
* **`HistoryManager`**：変更処理を`beginEdit()`と`commitEdit()`で挟んで1件を記録する（スナップショット方式）。`commitEdit(groupKey)`は鍵が空でない文字列のときだけ直前の同じ鍵の1件へ畳む。**鍵なしなら新しいエントリを足す**。前後の作業データが同じなら記録しない。重なり順の変更・位置の数値入力は鍵なし。
* **`palette/`**：自己完結するUI部品。**DOM操作専任**で、`VectorModel`・図形データ・選択状態に関与しない（受け取るのは注入された値とコールバックのみ）。**importを持たない**。ツールバーのオプションバーはまとまり（`.toolbar-group`）ごとに1つのUI部品を持つ。
* **`OptionBarOrderGroup.js`（ならう先）**：公開は`render`のみ。コンストラクタでまとまりのルート要素とコールバックを受け取り、**コールバックが関数でなければ`Error`、要素が1つでも欠ければ`console.warn`して配線しない**（`render`は何もしない）。要素はルート要素内の`querySelector('#id')`で解決する。ボタンの対応表（凍結）は本ファイルが唯一の定義箇所。`render(view)`は各ボタンの`disabled`を`!(view && view[key] === true)`で当てる。`disabled`のボタンは`click`が来ないため押せない判定を`click`側に書かない。typedefは`edit/`側と同じ内容の二重定義。
* **まとまりの足し方（3章13.・`_doc/arch/13_palette.md`）**：オプションバーはまとまりごとに`palette/`のUI部品1つと`main.js`の配線ブロック1つを持つ。まとまりを足すときは、`index.html`に`<div class="toolbar-group">`、`palette/`にUI部品、`main.js`にブロックを足すだけで、**既存のまとまり・部品・配線を変えない**。要素idの接頭辞は`option-`。幅が足りないときは右のまとまりから切れる（ツールバーは1行固定・折り返さない）。
* **`main.js`**：配線ブロックをコメント番号の順に置く（`// 7.7.`＝スタイル、`// 7.8.`＝重なり順、`// 7.9.`＝微調整、`// 7.10.`＝位置、`// 8.`＝キーボードショートカット）。**判定・計算を持たず**、生成・注入・受け渡し・同期だけを行う。表示の同期は`model.onChange`のみで行い、機能専用の同期経路は足さない。初回の表示を`onChange`通知や`index.html`の初期記述に依存させないため、初期化の最後に各同期関数を明示的に1回ずつ呼ぶ。`performShapeOrder`はドラッグ中（`inputTracker.isDragging()`）なら`false`、それ以外は編集操作の結果を返すだけ。
* **3章 同期の経路（全機能共通）**：再描画・UI同期は既存の経路（`model.onChange`等）のみで行う。機能専用の再描画・同期処理を足さない。
* **3章 位置の数値入力（20.）の考え方**：図形の位置は外枠（線の太さを含む）で表し、**円・弧も外枠**（座標の規則に図形種別の分岐を持たせない）。スナップ（17.）・端点への吸い付き（12.）を働かせない。移動量はワールド座標のpxで、表示倍率・スクロールを読まない。
* **`test/`**：実行は`node --test`（引数なし）。`node:test`・`node:assert/strict`のみで書く。注入される依存はテストファイル内の素のオブジェクトの偽物で置き換える（`VectorModel`・図形クラスは実物を使う例が多い）。テストファイルの先頭にも責務のJSDocを書く。DOMに依存するもの（`palette/`の部品・`main.js`の配線・`index.html`）はテスト対象外で、`_doc/arch/16_test.md`の「テストできない箇所」に記載する。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定

資料本体の書き換えは**最終タスクのみ**で行う（個別タスクでは本欄に追記する）。

* **1章 プロジェクトフォルダ構造**
  * `js/edit/`に`ShapeAlignRules.js`（整列・分布の操作の値と移動量の規則。状態なし・importなし）・`ShapeAlignEditor.js`（整列・分布の1件の編集操作と可否の照会）を追加。`ShapeExtentReader.js`の説明に「図形1つずつの外枠」を追加。
  * `js/palette/`に`OptionBarAlignGroup.js`（オプションバーの「整列・分布」のまとまり）を追加。
  * `test/core/`に`VectorModel.moveShapesBy.test.js`、`test/edit/`に`ShapeAlignRules.test.js`・`ShapeAlignEditor.test.js`を追加（`ShapeExtentReader.test.js`は件数が増える）。
  * 「存在しないもの」にPhase 08-05の分を追加（整列・分布は実装済み。頂点をそろえる機能・基準にする図形（キーオブジェクト）・キャンバスを基準にした整列・指定した間隔の分布・中心の間隔をそろえる分布・整列・分布のキー・大きさ／角度の欄・基準点・変形・複数選択の比率の保持・頂点の追加削除ほかは無い）。Phase 08-02b・08-03・08-04の分の「整列と分布」は当時の記録として残し、08-05の分で実装済みであることを示す。
  * フォルダ分割の方針の`edit/`の説明と依存方向に、`edit/ShapeAlignEditor → edit/ShapeAlignRules`（`edit/`内。`ShapeAlignRules`は何もimportしない）と`main.js → edit/ShapeAlignEditor`・`palette/OptionBarAlignGroup`を追加（循環importは無い）。`ShapeExtentReader`の生成は2か所のまま（`main.js`の`// 7.10.`のインスタンスを`PositionInputEditor`と`ShapeAlignEditor`の2つが使う）。
* **2章 データ構造**：作業データ・書き出し・履歴のエントリの形は変わらない（記載の変更なし。必要なら「整列・分布の結果は図形の座標そのものに入り、別のデータを持たない」旨のみ）。
* **3章 描画・操作フロー**
  * **21.「整列・分布」を新設**：流れ（表示＝`model.onChange` → `syncOptionBarAlignGroup` → `ShapeAlignEditor.getAvailability` → `OptionBarAlignGroup.render`、入力＝`click` → `onAlign(operation)` → `performShapeAlign` → `ShapeAlignEditor.apply` → `canApplyAlign`／`computeAlignMoves` → `beginEdit` → `moveShapesBy` → `commitEdit()`）、モジュールの分担（規則／編集操作／UI部品／配線／外枠の照会／移動の反映）、**整列の基準＝選択全体の外枠**（全体の範囲は規則の中で各図形の外枠の和として求める）、**外枠に線の太さを含めること**、**分布はすき間をそろえること**（並べ方・すき間の式・負のすき間・同じ値の順・入れ子の場合）、移動量0の許容量（`1e-9`）とその理由、**押せない条件**（動く図形が無い・整列は2つ未満・分布は3つ未満）、**操作1回＝取り消し1件**（鍵なし）、**キーを割り当てないこと**、スナップ・端点への吸い付き・表示倍率と無関係、ドラッグ中は受理しない（`performShapeAlign`）、操作モードを見ない（`A`で図形を選んでいれば押せる）、発注者の決定6点、やらないこと、確認の状況（DOM依存のためテストプレイで確かめた範囲）。
  * **冒頭の同期の経路**：オプションバー（スタイル・重なり順のまとまり）の表示は`model.onChange`で同期する、の列挙に整列・分布のまとまりを加える（位置のまとまりも含め実態に合わせる）。
  * **6.（履歴）の「記録する操作と時点」**：整列・分布（オプションバーの整列・分布のボタン）：`ShapeAlignEditor.apply`で、`model.moveShapesBy`の前後。動く図形が無い操作では`beginEdit`も呼ばない。鍵なし。
  * **13.（オプションバー）**：「まとまりごとの分け方」に整列・分布のまとまり（`#option-align-group`。21.）を加える。
  * **19.・20.の「やらないこと」**：整列と分布はPhase 08-05で入った（21.）ことを添える。
* **4章 各モジュールの責務リファレンス**（モジュールのファイルへ反映。一覧の表に新しい行は増えない＝新しい規則・編集操作は`14_edit.md`、UI部品は`13_palette.md`に書く）
  * `_doc/arch/14_edit.md`：`ShapeAlignRules.js`・`ShapeAlignEditor.js`の項目を新設（公開・依存・契約・二重定義・使う側・テスト）。`ShapeExtentReader.js`の項目に`getSelectedBoundsPerShape`（契約・呼び出し元＝`ShapeAlignEditor`）と、`main.js`の`// 7.10.`のインスタンスを`ShapeAlignEditor`も使うことを追加。冒頭の「依存」の例外の列挙に`ShapeAlignEditor`（`./ShapeAlignRules.js`のみ）を追加。
  * `_doc/arch/13_palette.md`：`OptionBarAlignGroup.js`の項目を新設（公開`render`・注入（コールバック1つ`onAlign`）・知らないこと・対応表と操作の文字列の二重定義・テスト対象外）、冒頭のオプションバーのまとまりの列挙と「ツールバーの位置づけ」に整列・分布を追加。
  * `_doc/arch/03_VectorModel.md`：公開メソッドの一覧に`moveShapesBy`、`moveShapes`との違い・契約（通知1回・存在しないidを飛ばす・引数を書き換えない・選択集合に触れない・`#pruneSelectedVertices`を呼ばない）・呼び出し元（`ShapeAlignEditor`のみ）・テストを追加。
  * `_doc/arch/01_index_html.md`：オプションバーの項目に整列・分布のまとまり（`#option-align-group`・8ボタンのid・初期`disabled`・`title`にキーなし・記号は仮でHTMLの1か所だけ）と、1280px幅の見積もりの更新（約1138px）を反映。「3つの`<div class="toolbar-group">`」を4つに直す。
  * `_doc/arch/02_main.md`：配線ブロックの表に`// 7.11.`を追加、主な関数に`performShapeAlign`・`syncOptionBarAlignGroup`を追加、注入の一覧に`ShapeAlignEditor`（`model`・`editRecorder`＝`historyManager`・`shapeExtentReader`（`// 7.10.`の同じインスタンス））を追加、`ShapeExtentReader`の行に`ShapeAlignEditor`も使うことを追加、起動時の同期に`syncOptionBarAlignGroup()`を追加、行数の更新。
  * `_doc/arch/16_test.md`：Phase 08-05の新設分（`ShapeAlignRules.test.js`・`ShapeAlignEditor.test.js`・`VectorModel.moveShapesBy.test.js`の検証範囲）、既存への追加（`ShapeExtentReader.test.js`）、既存のケースの期待値の書き換え（無しの見込み）、テストできない箇所（08-05の追加＝`OptionBarAlignGroup`（DOM）・`main.js`の`// 7.11.`の配線・`index.html`の整列・分布のまとまりの見た目と1280px幅での収まり・記号の見分けやすさ）、件数（`node --test`の結果。08-05前は tests 1496 / suites 222）。
  * `_doc/arch/36_DisplayWiring.md`：**変更しない**（`DisplayWiring`は無変更）。

---

## 3. タスクリスト

**タスクの分け方**：要件1〜7をそれぞれ別のタスクにする。要件5（HTML）・6（UI部品）・7（配線）は分けたままとする（まとめない）。理由：途中の段階でも、HTMLのボタンは初期値の`disabled`のため押せず、UI部品はどこからもimportされないだけで、アプリのふるまいも`node --test`の結果も壊れない（Phase 08-04の位置のまとまりと同じ分け方で、1タスクのスコープを1ファイルに保てる）。

*   [ ] タスク1: 要件1 選んでいる図形1つずつの外枠の照会（`edit/ShapeExtentReader`）
    *   **対象ファイル** :
        *   `./js/edit/ShapeExtentReader.js` :（更新。照会の追加と先頭の責務定義への追記のみ）
        *   `./test/edit/ShapeExtentReader.test.js` :（更新。`describe`の追加のみ）
    *   **作業内容** :
        *   `getSelectedBoundsPerShape()`を足す（要件1のとおり。既存の`getSelectedBounds`・`getAllBounds`・コンストラクタ・フィールドは**一切変えない**。importも増やさない）。`computeShapesBounds([shape])`が`null`の図形は除く。
        *   typedef`ShapeBoundsEntry`を書く（`edit/ShapeAlignRules.js`の`AlignItem`との二重定義である旨を明記。`ShapeAlignRules.js`はタスク2で作るため、名前だけを先に書いてよい）。
        *   メソッドのJSDoc（責務・`@returns`・`@throws`）に、描画順のまま・選択なしで空配列・`null`を除く理由（図形1つでは起きない想定）・各要素の外枠の和が`getSelectedBounds()`と同じ値になることを書く。
        *   ファイル先頭の責務定義（3行以内）に「図形1つずつの外枠」を加える（既存の記述は残す）。
        *   `test/edit/ShapeExtentReader.test.js`へ要件1のテストの観点をすべて確かめる`describe`を足す。**既存のケース・`setup()`は変えない**（必要な図形クラスのimportの追加は可）。新しい補助関数にはJSDocを書く。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（「今回やらないこと」に挙げた到達不能な枝は**残す**）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク2: 要件2 整列・分布の規則（`edit/ShapeAlignRules`）
    *   **対象ファイル** :
        *   `./js/edit/ShapeAlignRules.js` :（新規）
        *   `./test/edit/ShapeAlignRules.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内。例：「選んでいる図形の整列（6種）・分布（2種）の移動量の規則を、状態を持たずDOMに触れない関数として担う。図形は`id`と外枠の数値だけで扱う（importなし）。」）。**importを持たない**。
        *   `ShapeAlignOperation`（上表の8つ。宣言順＝ボタンの並び。`Object.freeze`）、typedef`AlignItem`・`AlignMove`、非公開の`assertKnownOperation`・`ZERO_MOVE_EPSILON`（JSDocに理由）・件数の下限・操作ごとの定義の表を書く。
        *   `computeAlignMoves(items, operation)`を要件2の手順1〜6どおりに実装する（未知の操作は計算の前に`Error`／件数の下限／全体の範囲を関数の中で求める／整列・分布の式／安定な並べ替えはコピーに対して行う／移動量0の除外は許容量で判定し、含める値は丸めない／結果は`items`の元の順・新しいオブジェクト）。XとYで同じ手順を2回書かない。
        *   `canApplyAlign(items, operation)`を`computeAlignMoves(...).length > 0`で実装し、押せる・押せないと手順の「何もしない」の判定をこの1か所に保つ旨をJSDocに書く。
        *   各関数のJSDoc（`@param`・`@returns`・`@throws`）に、丸めないこと・引数を書き換えないこと・すき間が負でも特別扱いしないこと・外枠の値の有限性を検証しないことを書く。
        *   `test/edit/ShapeAlignRules.test.js`（新規）：先頭に単一責務のJSDoc。要件2のテストの観点をすべて確かめる。素のオブジェクトの配列を使い、図形クラスを使わない。補助関数にはJSDoc。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク3: 要件3 図形ごとに違う移動量をまとめて当てる入口（`core/VectorModel.moveShapesBy`）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新。`moveShapesBy`の追加のみ）
        *   `./test/core/VectorModel.moveShapesBy.test.js` :（新規）
    *   **作業内容** :
        *   `moveShapes`の直後に`moveShapesBy(moves)`を足す（要件3のとおり。`updateVertices`と同じ書き方。`shape.translate(dx, dy)`への委譲・存在しないidを飛ばす・1件以上動かしたときだけ通知1回）。**`moveShapes`・他のメソッド・ファイル先頭の責務定義・importは一切変えない**。
        *   JSDocに、`moveShapes`との違い（同じ量か図形ごとに違う量か）の1行・`updateVertices`との用途の違い・同じidが複数回あれば順に当てること・引数を書き換えないこと・選択集合等に触れないことを書く。
        *   `test/core/VectorModel.moveShapesBy.test.js`（新規）：先頭に単一責務のJSDoc。`VectorModel.updateVertices.test.js`の書き方にそろえ、要件3のテストの観点をすべて確かめる（既存の`moveShapes`のふるまいの確認もこのファイルで行う）。補助関数にはJSDoc。**既存のテストファイルは変えない**。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（`VectorModel.updateVertex`等の到達不能な枝は**残す**）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク4: 要件4 整列・分布の編集操作（`edit/ShapeAlignEditor`）
    *   **対象ファイル** :
        *   `./js/edit/ShapeAlignEditor.js` :（新規）
        *   `./test/edit/ShapeAlignEditor.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内。例：「選んでいる図形の整列・分布を、規則（`./ShapeAlignRules.js`）で求めた図形ごとの移動量に従ってモデルへ反映する1件の編集操作と、各操作で動く図形があるかの照会を担う。DOMに触れない。」）。importは`./ShapeAlignRules.js`のみ。
        *   typedef`ShapeAlignAvailability`（8キー。`palette/OptionBarAlignGroup.js`との二重定義である旨を明記）を書く。
        *   `ShapeAlignEditor`クラス（コンストラクタ`{ model, editRecorder, shapeExtentReader }`・非公開フィールド3つ・`apply(operation)`・`getAvailability()`）を要件4のとおりに実装する。クラスのJSDocに「依存の制約」（使うメソッドの限定・import・DOMなし・図形種別とidの形式と操作モードを知らない・`try/catch`なし）と「前提（呼び出し側の責務）」（ドラッグ中でないこと＝`main.js`の`performShapeAlign`、選択モード・頂点の選択モード以外と読み込み中は選択集合が空で何もしないこと、入力操作の中断・モード切り替えをしないこと）を書く（`ShapeOrderEditor`の書き方にならう）。`apply`のJSDocには処理順1〜5を番号付きで書く。
        *   `test/edit/ShapeAlignEditor.test.js`（新規）：先頭に単一責務のJSDoc。要件4のテストの観点をすべて確かめる（`VectorModel`・図形クラス・`ShapeExtentReader`は実物、記録先は引数の個数を観測できる素のオブジェクトの偽物）。補助関数にはJSDoc。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク5: 要件5 オプションバーの整列・分布のまとまり（`index.html`）
    *   **対象ファイル** :
        *   `./index.html` :（更新。まとまりの追加と幅の見積もりのコメントのみ）
    *   **作業内容** :
        *   `#option-position-group`の後ろ（`</header>`の前）に`<div id="option-align-group" class="toolbar-group">`と8つのボタンを、上表の順・id・記号・`title`で置く（`type="button"`・`class="tool-btn icon-btn"`・初期値`disabled`）。既存のまとまりの並び・id・クラス名は**変えない**。
        *   `title`にキーを書かない。新しいクラス・新しい見た目の決まりを作らない。
        *   CSSの宣言は**足さない・変えない**。「ツールバー全体の幅の見積もり（1280px幅）」のコメントだけを、要件5のとおり（＋区切り17px＋整列・分布284px（ボタン32×8＋間隔4×7）＝約1138px）に更新する。更新の際に`.icon-btn`の幅・`.toolbar-group`の`gap`・区切りのCSSを読み直して見積もりを検算し、1280px幅に収まらない見込みになった場合は**実装を止めて本計画書の5章へ記載し、発注者の判断を仰ぐ**。
        *   JSDocコメントの記載漏れがないことを確認する（`index.html`には`.js`のJSDocは無いため、対象は**足したHTMLのまとまり・ボタンの`title`と、更新したCSSコメント**が既存の書き方どおりに意図を説明できているかの確認とする）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`index.html`はテスト対象外だが、ほかを壊していないことの確認として行う）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク6: 要件6 UI部品（`palette/OptionBarAlignGroup`）
    *   **対象ファイル** :
        *   `./js/palette/OptionBarAlignGroup.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。**importを持たず**、状態・判定を持たず、図形データ・選択状態・規則・編集操作に関与しない（既存のオプションバーのUI部品と同じ約束をクラスのJSDocに明記）。
        *   typedef`ShapeAlignAvailability`（`edit/ShapeAlignEditor.js`との二重定義）・`OptionBarAlignGroupActions`（`onAlign`。戻り値は使わない）を書く。
        *   ボタンの対応表`ALIGN_BUTTONS`（`{ operation, id }`の凍結した配列。上表の順で8つ。操作の文字列が`ShapeAlignOperation`との二重定義である旨をJSDocに書く）を書く。
        *   コンストラクタ`(groupElement, actions)`・`render(view)`を要件6のとおりに実装する（`onAlign`が関数でなければ`Error`／要素が1つでも欠ければ`console.warn`して配線しない／`click`で`onAlign(operation)`／`render`は8つの`disabled`を毎回当てる／押せない判定を`click`側に書かない）。`OptionBarOrderGroup`の作り・JSDocの書き方にそろえる。
        *   テストは置かない（DOM依存。`_doc/arch/16_test.md`への記載は最終タスクで行う）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク7: 要件7 配線（`main.js`の`// 7.11.`）
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `./edit/ShapeAlignEditor.js`・`./palette/OptionBarAlignGroup.js`のimportを、既存の並び（`OptionBarPositionGroup`のimportの後）に足す（**`ShapeAlignOperation`はimportしない**）。
        *   `// 7.10.`のブロックの後・`// 8.`の前に`// 7.11. オプションバー（整列・分布のまとまり）配線`のブロックを要件7の1〜4のとおりに足す（`ShapeAlignEditor`の生成に`// 7.10.`の`shapeExtentReader`をそのまま渡す＝3つ目を生成しない／`performShapeAlign`（JSDoc付き。`performShapeOrder`と同じ形）／`OptionBarAlignGroup`の生成（`onAlign`は`performShapeAlign(operation)`の戻り値をそのまま返すだけ）／`syncOptionBarAlignGroup`（JSDoc付き。橋渡しのみ）と`model.onChange`への登録）。**判定・計算を書かない**。
        *   起動時の同期の並び（`syncOptionBarPositionGroup();`の後）へ`syncOptionBarAlignGroup();`の1回の呼び出しを既存と同じ形のコメント付きで足す。
        *   **整列・分布専用の再描画・同期の経路や`document`への購読を足さない**。`// 8.`の`KeyboardShortcuts`への注入に何も足さない。`js/wiring/DisplayWiring.js`は変更しない。
        *   要件7の「追従の確認」の経路が既存の`model.onChange`だけでボタンの表示に追従することを、コードを追って確認する（新しい通知を足さない）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない。`main.js`の行数も控える）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク8: 仕上げの確認（JSDoc・不要なコード・全テスト・スコープ）
    *   **対象ファイル** :
        *   （原則として変更なし。漏れが見つかった場合のみ、タスク1〜7で触れたファイルを直す）
    *   **作業内容** :
        *   タスク1〜7で新規・更新した全ファイルについて、ファイル先頭の責務定義（3行以内）と、クラス・関数・メソッド・typedef・定数のJSDoc（責務・`@param`・`@returns`・`@throws`）の記載漏れがないことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（「今回やらないこと」に挙げた到達不能な枝＝各図形の`drawHandles`・`resolvePressAction`のハンドルの枝・`CursorShapeRules`の選択モードのハンドルの枝・`CanvasManager.render`のハンドルを描く段と、`VectorModel.updateVertex`は**残す**）。
        *   `git status`・`git diff --stat`で、変更したファイルが本計画書の対象ファイルだけであることを確認する（`js/core/InputTracker.js`・`KeyboardShortcuts.js`・`FocusKeyYieldRules.js`・`HistoryManager.js`・`NudgeTargetRules.js`・`VertexHandleRules.js`・`StatusReadoutRules.js`・`CanvasManager.js`・`UnitSnapRules.js`・`UnitSnapSettings.js`・`PressActionRules.js`・`SelectionRules.js`・`CursorShapeRules.js`・`PointHitRules.js`・`js/shapes/`・`js/io/`・`js/edit/NudgeEditor.js`・`PositionInputEditor.js`・`PositionInputRules.js`・`ShapeOrderEditor.js`・`ShapeOrderRules.js`・`ShapeStyleEditor.js`・`StylePanelRules.js`・`SnapshotAdapter.js`・`EndpointSnapper.js`・`js/wiring/`・`asset/`が**変わっていないこと**。`js/core/VectorModel.js`は`moveShapesBy`の追加のみ、`js/edit/ShapeExtentReader.js`は要件1の追加と責務定義への追記のみであること）。
        *   既存のテストの期待値を変えていないことを確認する（`git diff`で既存のテストファイルの変更が`test/edit/ShapeExtentReader.test.js`への`describe`の追加（と必要なimportの追加）だけであること）。
        *   リポジトリのルートで`node --test`を実行し、全件通ること（`fail 0`）を確認し、`tests`・`suites`・`pass`の件数を控える（08-05前は tests 1496 / suites 222）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク9: 要件8 テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   `./_log/res/261117_1809_RES_Phase08-05_Align_Distribute.md` :（更新。詳細作業内容への記載のみ）
    *   **作業内容** :
        *   本計画書の「要件8: ふるまいの確認（テストプレイの確認項目）」の0〜16を、**実装後のコードで裏取りしたうえで**、画面・操作・挙動の言葉で発注者へ提示する（とくに15.の頂点の選択（`A`）での挙動は、`InputTracker.setMode`・`A`での図形のクリックの選択の扱いを実コードで確かめてから書く）。
        *   自動テストで確かめられない箇所（`OptionBarAlignGroup`のDOMのふるまい、`main.js`の`// 7.11.`の配線、`index.html`の見た目と1280px幅での収まり、記号の見分けやすさ）を、特に確かめてほしい項目として添える。記号は`index.html`の1か所で差し替えられることを添える。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ提示した内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク10: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`13_palette.md`・`14_edit.md`・`16_test.md` :（更新）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄の全項目（各タスクでの追記を含む）を確認し、資料へ反映する。
        *   1章（ファイルの一覧・「存在しないもの」・フォルダ分割の方針・依存方向）、3章（**21.「整列・分布」の新設**（整列の基準＝選択全体の外枠・外枠に線の太さを含めること・分布はすき間をそろえること・押せない条件・操作1回＝取り消し1件・キーを割り当てないこと・発注者の決定）・冒頭の同期の経路・6.・13.・19.・20.の更新）を更新する。4章の一覧の表は新しい行が増えない（新しい規則・編集操作は`14_edit.md`、UI部品は`13_palette.md`に書く）ことを確認する。
        *   `_doc/arch/`の各ファイルを更新予定欄のとおりに直す。`16_test.md`には新設3ファイルと既存1ファイルへの追加の検証範囲・テストできない箇所（08-05の追加）・既存のケースの期待値の書き換え（無し）・件数（タスク8で控えた`node --test`の結果）を書く。
        *   記載基準に従う（1つのファイルのJSDocを読めば分かることは書かない。責務・境界・依存方向・流れと順序・誰が呼ぶか・設計判断の理由・やらないと決めたことを残す）。実コードと食い違う記述を作らない。
        *   **本タスクは開発資料の書き換えが明示的に許された唯一のタスク**であり、後続タスクは無い。ソースコード（`js/`・`test/`・`index.html`）は変更しない。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

---

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1 選んでいる図形1つずつの外枠の照会（`edit/ShapeExtentReader`）
*   **作業内容** :
    *   （未実施）

### タスク2: 要件2 整列・分布の規則（`edit/ShapeAlignRules`）
*   **作業内容** :
    *   （未実施）

### タスク3: 要件3 図形ごとに違う移動量をまとめて当てる入口（`core/VectorModel.moveShapesBy`）
*   **作業内容** :
    *   （未実施）

### タスク4: 要件4 整列・分布の編集操作（`edit/ShapeAlignEditor`）
*   **作業内容** :
    *   （未実施）

### タスク5: 要件5 オプションバーの整列・分布のまとまり（`index.html`）
*   **作業内容** :
    *   （未実施）

### タスク6: 要件6 UI部品（`palette/OptionBarAlignGroup`）
*   **作業内容** :
    *   （未実施）

### タスク7: 要件7 配線（`main.js`の`// 7.11.`）
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

## 5. 懸念事項・要確認ポイント
* **（計画時点）`ShapeExtentReader`のクラスJSDocの記述が実態と食い違っている**：クラスのJSDocに「main.jsが1つだけ生成する」とあるが、実際には`wiring/DisplayWiring`の内部と`main.js`の`// 7.10.`の2か所で生成している（Phase 08-04から。開発資料の`14_edit.md`は2か所と正しく書いている）。本作業の要件1は「照会の追加と先頭の責務定義への追記のみ」のため**このJSDocは直さない**。直すなら別のREQで扱う。
* **（計画時点）記号の見え方**：`⬅`・`➡`・`⬆`・`⬇`は環境によって絵文字（色付き）で表示され、`↔`・`↕`・`⋯`・`⋮`は文字の表示になるため、8つの見た目の大きさ・太さがそろわない可能性がある。記号は`index.html`の1か所だけで決まるので、見分けにくければ発注者の判断で差し替える（要件8の確認項目0）。
* **（計画時点）同期の回数**：`syncOptionBarAlignGroup`は既存のオプションバーの同期と同じく、`model.onChange`のたび（ホバー・ドラッグ中の移動を含む）に選択中の図形の外枠を1回ずつ求める（8操作分は使い回す）。REQの方針（性能の改善を目的とした変更を行わない・同期の回数を今のままにする）どおり、間引きの仕組みは足さない。30個程度の選択での体感は要件8の確認項目16で見てもらう。
* **（計画時点）分布で「並べた末尾」が全体の右端の図形でない場合**：入れ子などで`maxX`が最大の図形が`minX`の順で末尾にならないとき、要件2の手順どおり末尾の図形が動いて右端が全体の右端にそろい、`maxX`が最大だった図形は動く場合がある（REQの定義どおり。発注者の決定1の「両端の図形は動かさず」は、図形が横に並んでいる通常の場合に成り立つ）。
