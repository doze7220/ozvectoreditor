# RES: 作業計画・作業レポート (Phase 08-02b) : 頂点の選択ツール（後半：頂点を複数選んで、まとめて動かす）
* 参照元REQ: `./_log/req/261116_2030_REQ_Phase08-02b_Vertex_Multi.md`

## 1. 作業目的

頂点の選択ツール（`A`）の**後半**。前半（REQ `261116_1913`）で入った「ツールの追加・アイコン・選択（`V`）でハンドルを出さないこと・頂点を1つ選んで動かすこと」の上に、**頂点を複数選べるようにし、選んだ頂点をまとめて動かせるようにする**。

* 複数選択の入口は3つ：**`Ctrl`（`⌘`）＋クリック**（頂点の追加・解除）・**範囲選択**（空白からでも図形の本体の上からでも引き始められる）・**選んでいる頂点のうち1つを押してのドラッグ**（選んでいる頂点すべてが同じだけ動く）。
* 判定は規則のファイルへ置く：押下で何を始めるかは `core/PressActionRules.js`、頂点の選択がどう変わるかは `core/SelectionRules.js`、どの頂点が範囲に入るかは `core/VertexHandleRules.js`。`InputTracker` は受け渡しと状態遷移だけを行う。頂点の選択の状態は `VectorModel` が持つ。
* 既存の仕組みに載せる：ドラッグは既存の `DRAGGING_HANDLE`・`MARQUEE_SELECTING`、記録は既存の左ドラッグの履歴の経路、再描画は既存の `model.onChange` の経路だけを使う（新しい入力状態・機能専用の再描画の経路・並行する別の仕組みを作らない）。
* **最上位の要件**：リポジトリのルートの `node --test` が全件通り、**既存のテストの期待値を変えない**。作業データ形式・書き出し形式・履歴の形を変えない（版はどちらも2のまま。頂点の選択は保存せず履歴の対象にもしない）。**選択（`V`）のふるまいを一切変えない**。**頂点を1つだけ選んで動かしたときの結果が前半と完全に同じ**になる（スナップの丸め・端点への吸い付きと印・取り消し1件・閾値以内はクリック扱い）。図形の作成・パン・ズーム・スタイル・重なり順・結合・クリップボード・ファイル操作・表示の切り替え・スナップ・端点への吸い付きのふるまいを変えない。改名・整形・「不要に見えるコードの削除」を行わない。

**用語**（本計画書・コード・資料で使い分ける）
* **スナップ**：座標・移動量を単位（1px／グリッド10px）の倍数へ丸めること（`core/UnitSnapRules.js`・`UnitSnapSettings.js`）。
* **端点への吸い付き**：直線を描くとき・線の端点のハンドルをドラッグするときに、結合できる線の端点へ吸い付くこと（`shapes/EndpointSnapRules.js`・`edit/EndpointSnapper.js`）。
* **選択（`V`）**：図形を選んで動かすツール（ハンドルは出ない）。**頂点の選択（`A`）**：図形の頂点を選んで動かすツール。
* **アンカー**：頂点のドラッグで、押した頂点のこと（スナップの丸めと端点への吸い付きの基準になる1点）。

**発注者の決定（2026-11-16。計画で変えてはならない）**
1. 頂点の範囲選択の枠は、空白からでも図形の本体（線の上）からでも引き始められる（前半の「本体をドラッグしても何も起きない」は「図形は動かない」の意味。本作業からは代わりに範囲選択が始まる）。
2. 範囲選択で選べる頂点は、頂点が出ている図形（＝選択中の図形）の頂点だけ。範囲選択で図形そのものの選択は変わらない。
3. 端点への吸い付きは、頂点を1つだけ選んでいるときだけ働く（2つ以上では吸い付かない。スナップの丸めは働く）。
4. 頂点の選択（`A`）のまま、`Ctrl`（`⌘`）＋クリックで図形そのものを選択へ追加・解除できる。
5. 頂点のドラッグに `Shift` での移動方向の限定は入れない。
6. 前半の決定はそのまま（円・弧はハンドルを出さない／`A`で`Delete`・`Backspace`は何もしない／`Esc`はまず頂点の選択だけを解除し、もう一度で図形の選択も解除する）。

## 2. アーキテクチャ設計

### 要件1: 頂点の選択の状態を、2つ以上の組が入る使い方に広げる

* `js/core/VectorModel.js` の頂点の選択は、前半から非公開の `#selectedVertices`（`{ shapeId, handle }` の配列。選んだ順）で、`setSelectedVertices(pairs)` は**与えられた順に重複を除いて**受理する実装になっている。したがって**状態の形・公開メソッドの名前・引数・戻り値は変えない**（本要件のためのソース変更は無く、2つ以上の組を渡す配線は要件3・4・6で行う）。
* 前半で用意された照会 `isVertexSelected(shapeId, handle)` を、本作業で初めて実際に使う（要件3の押下の判定。`InputTracker` がアロー関数にして規則へ渡し、規則は `VectorModel` を知らない）。
* 落とす仕組み（非公開の `#pruneSelectedVertices()`）は**変えない**。`setSelection`・`clearSelection`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape` の `#notifyChange()` の前で呼ばれ、**選択集合に無い図形の組だけ**が落ちる。2つ以上選んでいるときも、残る図形の組は順を保って残る（通知の回数は増やさない）。
* 保存・履歴・書き出しには入れない（`io/DocumentSerializer.js`・`edit/SnapshotAdapter.js`・`io/SpriteSerializer.js` は変更しない）。
* `test/core/VectorModel.selectedVertices.test.js` へ、2つ以上の組の置き換え・並びの保持・同じ図形の複数の頂点・同じ組を重ねたときの扱い・図形の選択が変わったときに落ちる組と残る組のケースを足す（既存のケースは変えない）。

### 要件2: 複数の頂点の座標を、1回の通知でまとめて更新できるようにする

* `js/core/VectorModel.js` へ公開メソッド `updateVertices(updates)` を1つ足す。`updates` は `Array<{ id: string, vertexIndex: number, x: number, y: number }>`（キー名は既存の `updateShapeStyles(changes)` の `id` にそろえる）。
* 各組について `#shapes` から `id` の図形を引き、`shape.setVertex(vertexIndex, x, y)` を**ポリモーフィックに**呼ぶ。図形種別の分岐・図形固有のプロパティ名を持たず、頂点インデックスと図形固有プロパティの対応は関知しない（既存の `updateVertex` と同じ考え方）。
* **変更通知は1回だけ**（`moveShapes` と同じ約束）。1件以上更新したときだけ `#notifyChange()` を呼ぶ。存在しない図形の `id` は無視する。空の配列なら何もしない（通知もしない）。配列の順に適用する（同じ頂点が2回現れたときは後の値が残る）。引数の配列・要素を書き換えない。
* 既存の `updateVertex(id, vertexIndex, x, y)` は `this.updateVertices([{ id, vertexIndex, x, y }])` へ**委譲**し、`setVertex` を呼ぶ箇所を1か所にまとめる。名前・引数・ふるまい（見つかったときだけ通知1回、見つからなければ何もしない）は変えない（`test/edit/EndpointSnapper.test.js` が使っている）。
* 選択集合・ホバー・作成途中の図形・選択矩形・吸い付きの表示の点・直前に使った値には触れない（`updateVertex` と同じ）。
* `test/core/VectorModel.updateVertices.test.js`（新規）でテストする（複数の図形にまたがる更新・同じ図形の複数の頂点・通知が1回であること・存在しないid・空の配列・引数の配列を書き換えないこと・`updateVertex` が従来どおりであること）。

### 要件3: 頂点の選択のモードで「押下で何を始めるか」の判定表を規則へ置く

* `js/core/PressActionRules.js` へ関数 `resolveVertexPressAction(hit, isVertexSelected, additive)` を1つ足す。**既存の `resolvePressAction`（選択モード用）の判定表・戻り値・`MOVE_HANDLE_NAME` は変えない。**
* 判定表（この順）：

    | 順 | 条件 | 結果 |
    | --- | --- | --- |
    | 1 | `hit.handle` があり、その頂点が選ばれている（`isVertexSelected` が真） | `{ type: 'dragSelectedVertices', target: hit.handle }`（選んでいる頂点すべてのドラッグを始める） |
    | 2 | `hit.handle` があり、選ばれていない かつ `additive` が偽 | `{ type: 'selectVertexAndDrag', target: hit.handle }`（その頂点だけを選び直してドラッグを始める） |
    | 3 | `hit.handle` があり、選ばれていない かつ `additive` が真 | `null`（何も始めない。離した後の`click`で選択へ追加・解除する） |
    | 4 | `hit.handle` が無い（本体の上・空白のどちらでも） | `{ type: 'marquee' }`（範囲選択を始める） |

* `target` は `hit.handle` そのもの（既存の `dragHandle` と同じ約束）。`marquee` は既存と同じ形・同じ文字列で、`InputTracker` は同じ `#beginLeftDrag(…, InputState.MARQUEE_SELECTING, …)` へ振り分ける。`dragSelectedVertices` と `selectVertexAndDrag` を分けるのは、**呼び出し側が「選び直すか」を区別できるようにする**ためで、どちらも `DRAGGING_HANDLE` で始まる。
* 「その頂点が選ばれているか」は照会の関数 `isVertexSelected(shapeId, handle)` で受け取る（実体は `VectorModel.isVertexSelected`）。**呼ぶのは `hit.handle` があるときだけで1回**（引数は `hit.handle.shapeId`・`hit.handle.handle`）。`Ctrl` の有無は真偽の引数 `additive`（図形用の `SelectionRules` と同じ語）で受け取る（規則の中でイベント・修飾キーの判定を持たない）。
* 新しい typedef `VertexPressAction` を足す（既存の `PressAction` は変えない）。結果の `marquee` は毎回新しいオブジェクト。引数（`hit`）を書き換えない。何もimportしない・DOMを持たない・状態を持たない。
* `test/core/PressActionRules.test.js` へ新しい関数のテストを足す（上の4通り・照会を呼ぶ回数と引数・ハンドルなしで本体ありのときも範囲選択になること・引数不変・新しいオブジェクト）。**既存のケースは変えない。**

### 要件4: 頂点の選択の変更（クリック・範囲選択）の規則を足す

* `js/core/SelectionRules.js` へ関数を2つ足す。既存の3つ（`resolveClickSelection`・`resolveMarqueeSelection`・`invertSelection`）と typedef `SelectionChange` は変えない。
  * `resolveVertexClickSelection(selectedVertices, hitVertex, additive)`：`additive` が偽 → `hitVertex` があれば `{ type: 'set', vertices: [当たった組] }`、無ければ選んでいる頂点があるときだけ `{ type: 'clear' }`・無ければ `null`。`additive` が真 → `hitVertex` が無ければ `null`、選ばれていれば外した配列で `set`、選ばれていなければ末尾へ足した配列で `set`。
  * `resolveVertexMarqueeSelection(selectedVertices, hitVertices, additive)`：`additive` が偽 → `{ type: 'set', vertices: [...hitVertices] }`（0件でも置き換える＝空になる）。真 → 0件なら `null`、そうでなければ既存へ**未選択のものだけ**を足した配列で `set`（重複しない）。
* 戻り値は図形用と**同じ形・同じ約束**の typedef `VertexSelectionChange`（`{ type: 'set', vertices }`／`{ type: 'clear' }`／`null`）。「置き換え」と「全解除」を区別するのは、`VectorModel` の `setSelectedVertices`・`clearSelectedVertices` の呼び分けを呼び出し側が再現できるようにするため（図形用で `set`／`clear` を分けている理由と同じ）。キー名は組の配列であることが分かる `vertices` にする（図形用の `ids` と混ざらないため）。
* 頂点の同一性は「図形のid」と「ハンドル名」の**両方が一致**すること。この比較は本ファイル内の非公開の補助関数1つに閉じ、2つの新しい関数が共有する（`SelectionRules` は「importなし」の約束を保つため、他ファイルの比較と関数を共有しない。規則の文章の正本は資料の3章・`_doc/arch/27_SelectionRules.md`）。
* 引数（配列・要素）を書き換えず、毎回新しい配列を返す。要素は受け取った組をそのまま並べる（`VectorModel.setSelectedVertices` が新しいオブジェクトへ写すため、ここでの複製は不要）。`import`なし・DOMなし・状態なしを保つ。
* `test/core/SelectionRules.test.js` へテストを足す（上の各分岐・同じ図形の別の頂点が混ざるとき・別の図形の同じハンドル名が混ざるとき・並びが保たれること・引数を書き換えないこと）。**既存のケースは変えない。**

### 要件5: 範囲に入った頂点を集める規則を足す

* `js/core/VertexHandleRules.js` へ関数 `collectVertexHandlesInRect(shapes, selectedIds, minX, minY, maxX, maxY)` を1つ足す（戻り値は `Array<{ shapeId: string, handle: string }>`）。既存の `collectVertexHandles`・`isVertexHandle` は変えない。
* 対象は**選択中の図形だけ**（＝頂点が出ている図形。発注者の決定）。`shapes` の並び（描画順）のうち `selectedIds` に含まれる図形について、`shape.getVertexHandleNames()` の順に `shape.getHandlePosition(name)` で位置を求め、**矩形の中（境界の上も中に含める。`minX <= x <= maxX` かつ `minY <= y <= maxY`）**なら `{ shapeId, handle }` を集める。位置が得られないハンドル（`null`）は飛ばす。
* 並びは「図形の並び（描画順）→ その図形のハンドル名の一覧の順」。戻り値は毎回新しい配列。引数を書き換えず、例外を投げない（図形が共通メソッド契約を満たす前提）。
* **矩形の正規化はこの関数では行わない**（正規化は `InputTracker` の範囲選択の確定が行う唯一の箇所）。正規化済みの値（`min <= max`）を受け取る前提をJSDocに明記する。
* 操作モードの引数は取らない（頂点の選択のモードでだけ呼ぶのは呼び出し側の事情。`collectVertexHandles` がモードを取るのは `main.js` の描画の経路でモードによらず呼ばれるため）。図形種別の分岐・図形固有のプロパティ名・状態・DOMを持たない。`intersectsRect` は使わない（図形の当たりではなく頂点の位置で判定するため）。importは今までどおり `core/InputModes` の `OperationMode` のみ。
* **既存の `collectVertexHandles` との走査は共有しない**（同一ファイル内の非公開の補助関数へ括らず、新しい関数の中に書く）。そう決めた理由：
  * **集める条件と戻り値の形が違う**。`collectVertexHandles` は図形ごとにまとめた `{ shapeId, handles: [{ x, y, selected }] }` を返し、`selectedVertices` との照合で `selected` を付け、ハンドルが0個の図形は結果に含めない。新しい関数は `{ shapeId, handle }` の**平らな配列**で、矩形に入るものだけを集め、`selected` も図形ごとのまとまりも持たない。共通部分を関数へ括ると、走査の中身を外から差し替える形（コールバック渡し）になり、**既存の `collectVertexHandles` の本体を書き換えることになる**。要件5の「既存の `collectVertexHandles`・`isVertexHandle` のふるまいを変えない」を守るため、既存関数には手を触れない方を採る。
  * **REQ:184 が禁じる「同じ判定表・同じ比較の条件を2か所に書く」には当たらない**。矩形に入るかの判定は新しい関数の1か所だけ、頂点の同一性の比較は `collectVertexHandles` の `some(...)`（表示用の照合）と `SelectionRules` の非公開の補助（選択の変更用）にそれぞれ閉じており、新しい関数はどちらも持たない。重なるのは「`selectedIds` をSetにして `shapes` の並びを辿り、`getVertexHandleNames()` の順に `getHandlePosition(name)` を読み、`null` は飛ばす」という**図形の共通メソッドの読み方**だけで、その正本は図形側（`getVertexHandleNames`・`getHandlePosition`）にあり、ここに書かれるのは正本の読み出しの手順に過ぎない。
* `test/core/VertexHandleRules.test.js` へテストを足す（実物の図形を使う。直線・曲線・矩形・パスの頂点が入る／入らない、円・弧は0件、選択中でない図形は対象外、境界の上、並び、面積0の矩形、引数不変）。

### 要件6: 操作を配線する（`js/core/InputTracker.js`）

#### 作業用フィールド（新規1つ）
* `#vertexDragOrigins`：`Array<{ shapeId: string, handle: string, vertexIndex: *, x: number, y: number }>`。頂点のハンドルのドラッグで動かす頂点それぞれの**押下時の位置と頂点インデックス**（アンカーを含む）。寿命は既存の `#unitSnapHandleOrigin` と同じ（`#beginLeftDrag` で設定し、`DRAGGING_HANDLE` 以外の押下では空配列、`#finishLeftDrag` で空配列に戻す）。頂点インデックスは `shape.getVertexIndexForHandle(ハンドル名)`、位置は `shape.getHandlePosition(ハンドル名)` で**押下の時点に1回だけ**求める。
* 記憶する組の決め方：`model.getSelectedVertices()` に押した頂点（`target`）が含まれていればその全体、含まれていなければ `target` 1つだけ（選択モードの既存のハンドルのドラッグはこの経路で `[target]` になり、前半までと同じ1頂点の動きになる）。図形が見つからない組は飛ばす。位置が得られない組も飛ばす（ただしアンカーは、位置が得られなくても残す。従来どおり丸めずカーソル位置へ追従させるため）。
* `#unitSnapHandleOrigin`（既存。スナップの丸めの基準）は、記憶した組のうちアンカーの位置から設定する（値は今までと同じ `shape.getHandlePosition(target.handle)` の結果。`getHandlePosition` を二重に呼ばないため。得られなければ `null`）。

#### 押下（`handleMouseDown`）
* 頂点の選択のモードの枝を、**要件3の規則の結果で振り分ける形**に直す（判定表を `InputTracker` の中に書かない）。前半の枝（頂点のハンドル上なら選び直してドラッグ、それ以外は何もしない）を置き換える。
  * `resolveVertexPressAction(hit, (shapeId, handle) => this.model.isVertexSelected(shapeId, handle), hasCtrlModifier(event))` を呼び、
  * `dragSelectedVertices` → `#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, action.target)`、
  * `selectVertexAndDrag` → `model.setSelectedVertices([{ shapeId, handle }])` の後に同じ `#beginLeftDrag`（前半と同じ順。記憶する組は選び直した後の選択になる）、
  * `marquee` → `#beginLeftDrag(event, InputState.MARQUEE_SELECTING, point)`、
  * `null` → 何もしない。
* `InputState` に新しい値を足さない。押した頂点は今までどおり操作対象（`activeShapeId`・`activeHandle`）として記憶する（`#beginLeftDrag` の `target`）。範囲選択は既存の `MARQUEE_SELECTING`（押下点の記憶・選択矩形の表示・閾値の扱い・編集操作として記録しないこと）をそのまま使う。
* スペース押下中・中ボタン・キャンバス移動モードのパンの優先、`IDLE` でなければ何も始めないこと、`isPickingShape` の扱い（選択モードの枝の中に残す）は変えない。押下で `Ctrl` を見るのは**頂点が選ばれていないときに何も始めないかの判定だけ**で、選択モードの押下の分岐の表は `Ctrl` で変えない（発注者の決定）。

#### 端点への吸い付きの解決（`#beginLeftDrag` の `DRAGGING_HANDLE`）
* **記憶した組が1つだけのときに限り**、今までどおり注入された補助の `resolveDragEndpoint(図形id, ハンドル名)` で端点のハンドルかを解決して `#dragEndpoint` に入れる。2つ以上のときは**解決も照会もしない**（`#dragEndpoint` は `null` のままで、追従での照会・印の表示・離したときの結合はすべて起きない。発注者の決定）。選択モードの既存の経路は記憶した組が常に1つ（`[target]`）のため、今までと同じに解決される。

#### 追従（`#applyLeftDragUpdate` の `DRAGGING_HANDLE`）
* アンカーの行き先の求め方は**今までどおり**：対象図形が見つからなければ何もしない（既存の早期`return`を残す）。`#dragEndpoint` があるときだけ吸い付きを照会して印を出し（`Ctrl` の間は照会しない）、吸い付けばその座標、吸い付かず `#unitSnapHandleOrigin` があれば `roundPointFromOriginToUnit(#unitSnapHandleOrigin, カーソル位置, 刻み)`、位置が得られないときは丸めずカーソル位置（`Shift` は見ない）。
* アンカーの行き先とアンカーの押下時の位置（`#unitSnapHandleOrigin`）との差を移動量 `dx`・`dy` とし、**記憶した組すべての押下時の位置へ同じだけ足した座標**を1つの配列にまとめて `model.updateVertices(updates)` へ**1回**で渡す（頂点ごとに1回ずつ渡さない）。
  * **アンカー自身の座標は、足し算を通さずアンカーの行き先そのものを渡す**（浮動小数の計算を1つも増やさないため。これにより頂点を1つだけ選んで動かしたときの結果が前半と完全に同じになる）。
  * `#unitSnapHandleOrigin` が `null`（アンカーの押下時の位置が得られない）ときは移動量を0として扱う（アンカーだけがカーソルへ追従し、ほかの頂点は動かない。従来の1頂点のふるまいを保つための退避の経路）。
  * 頂点インデックスは記憶した値を使う（追従のたびに `getVertexIndexForHandle` を呼ばない）。
* 選んでいる頂点が0のときは何もしない（押下の判定表により、この状態でドラッグは始まらない）。`MOVING_SELECTION`・`MARQUEE_SELECTING` の枝は変えない。
* 取り消しは、既存の左ドラッグの記録の経路（閾値超過時の `#onLeftDragStart` で `beginEdit()`、`#finishLeftDrag` の `commitEdit()`）にそのまま載る（まとめて動かした操作も取り消し1件）。**`js/core/HistoryManager.js`・`js/edit/SnapshotAdapter.js` は変更しない。**

#### 範囲選択の確定（`#commitMarquee`）
* 選択矩形の正規化は今までどおりこのメソッドで行う（**矩形の正規化を行う唯一の箇所**）。正規化した後、頂点の選択のモードでは：
  * 要件5の `collectVertexHandlesInRect(model.getShapes(), model.getSelectedIds(), minX, minY, maxX, maxY)` で頂点の組を集め、
  * `model.clearSelectionRect()`（選択矩形の破棄。今までどおり）、
  * 要件4の `resolveVertexMarqueeSelection(model.getSelectedVertices(), 集めた組, hasCtrlModifier(event))` の結果を、新しい非公開メソッド `#applyVertexSelectionChange(change)`（`null` なら何もしない・`clear` なら `clearSelectedVertices()`・`set` なら `setSelectedVertices(change.vertices)`。受け渡しのみ）で反映して終わる。
  * **図形の選択を一切変えない**（`intersectsRect` を呼ばない・`resolveMarqueeSelection` を呼ばない）。
* 選択モードの確定のふるまい（`intersectsRect`・`resolveMarqueeSelection`・`#applySelectionChange`・通知の回数）は変えない。`Ctrl` を見るのは終了のイベント（確定の時点）で今までどおり。中断（`#onLeftDragCancel`）は選択矩形を破棄するだけで確定しないことも変えない。

#### クリック（`handleClick`）
* 頂点の選択のモードの枝で `Ctrl`（`hasCtrlModifier(event)`）を見るようにし、次のとおり分ける。
  * **頂点のハンドルの上** → 要件4の `resolveVertexClickSelection(model.getSelectedVertices(), { shapeId, handle }, Ctrl)` の結果を `#applyVertexSelectionChange` で反映する（**図形の選択は変えない**）。
  * **図形の本体の上** → `Ctrl` なしは前半どおり `clearSelectedVertices()` の後に `resolveClickSelection(選択集合, bodyId, false)` を `#applySelectionChange` へ。**`Ctrl` ありは `resolveClickSelection(選択集合, bodyId, true)` を `#applySelectionChange` へ**（頂点の選択は空にしない。選択から外れた図形の頂点は要件1の落とす仕組みが落とす）。
  * **空白** → `Ctrl` なしは前半どおり `clearSelectedVertices()` の後に `resolveClickSelection(選択集合, null, false)`（選択があれば全解除）。**`Ctrl` ありは何もしない**（`resolveClickSelection` が `additive` 真・当たりなしで `null` を返すため、同じ呼び出しで約束が守られる）。
* 閾値を超えて動かした後の `click` の抑止（`DragTracker` の `consumeSuppressedClick()`）は今までどおり効く（ドラッグの後に選択が変わらない）。選択モード・図形作成モードの `handleClick` は変えない。

#### 変えないもの
* `Esc`（`cancelDraftOrClearSelection`。頂点→図形の2段）・`deleteSelection`（`A` では `false`）・`setMode`（中断・図形の選択の全解除・ホバーの解除）・`handleMouseMove`（ホバーの強調は選択モードと同じ）・`#classifyPoint`（`includeHandles` と頂点のハンドルへの絞り込み）・`#onLeftDragEnd`／`#onLeftDragCancel`／`#onLeftDragStart` の構造・パンとズーム・`handleKeyDown`／`handleKeyUp`。
* クラス先頭の責務定義と、直した各ハンドラのJSDoc（判定の順・押下の判定表の参照先・新しい作業用フィールドの寿命）は、実装に合わせて書き直す。**フィールド `activeHandle` のJSDoc**も書き直す（現在は「ドラッグの追従（`#applyLeftDragUpdate`）で `shape.getVertexIndexForHandle()` により頂点インデックスへ解決する」と書かれているが、本作業で解決は押下の時点（`#beginLeftDrag` の `#vertexDragOrigins` の組み立て）へ移るため、そのままでは実装と食い違う）。

### 要件7: 表示とカーソル（変える必要があるかを確かめる）

* 選ばれている頂点の見た目は前半のまま（`CanvasManager` が `vertexHandles` の各要素の `selected` で塗りを青にする）。前半の `collectVertexHandles` は `selectedVertices.some(...)` で**組ごとに**`selected` を付けるため、2つ以上が同時に選ばれていても見分けられる。**実コードを読んだ結果、`js/core/CanvasManager.js`・`js/main.js`・`js/core/VertexHandleRules.js` の表示の経路は変更不要**（本計画では表示のコードを変更対象に含めない）。確認のタスクで読み直し、変える必要があると判断した場合は理由を本計画書へ記録し、`CanvasManager` に状態・図形種別の分岐・図形固有のプロパティを持ち込まない（必要な値は `render` の引数で受け取る）。
* 範囲選択の枠の見た目は、**選択モードの範囲選択と同じもの**（`model.setSelectionRect` と `CanvasManager` の既存の選択矩形）をそのまま使う。新しい描画の経路・新しい見た目を作らない。
* カーソルの形の規則（`js/core/CursorShapeRules.js`）は**変更不要**の見込み。判定表(2a)により、頂点の選択のモードでは `DRAGGING_HANDLE` 中は `'move'`、`hit.handle` ありは `'move'`、`hit.bodyId` ありは `'pointer'`、空白・`hit === null` は `'default'` で、範囲選択中（`MARQUEE_SELECTING`）は `#updateCursor()` が `hit` なしで呼ばれるため `'default'` になる（選択モードの(5)と同じ見た目）。`Ctrl` でカーソルを変えない約束も保つ。変える必要があると判断した場合は理由を本計画書へ記録し、`test/core/CursorShapeRules.test.js` も直す。

### 要件8: ふるまいの確認（テストプレイの確認項目）

発注者が画面で確かめられる確認項目を、タスク12で提示する（**最初の手順にブラウザの強制再読み込み（`Ctrl`+`F5`）を入れる**）。項目はタスク12の作業内容に列挙する。

### 関連フォルダと論理クラス

* **対象フォルダ**: `./js/core/`（入力・状態・規則）、`./test/core/`（自動テスト）
* **関連する論理クラス・モジュール**：
  * 既存（変更）：`core/VectorModel`（`updateVertices` の追加と `updateVertex` の委譲）・`core/PressActionRules`（頂点の選択のモードの押下の判定表を追加）・`core/SelectionRules`（頂点のクリック・範囲選択の規則を追加）・`core/VertexHandleRules`（矩形に入る頂点を集める関数を追加）・`core/InputTracker`（配線）
  * 既存（変更。テスト）：`test/core/VectorModel.selectedVertices.test.js`・`test/core/PressActionRules.test.js`・`test/core/SelectionRules.test.js`・`test/core/VertexHandleRules.test.js`
  * 新規：`test/core/VectorModel.updateVertices.test.js`
  * 既存（変更しない。依存先として読むだけ）：`core/InputModes`・`core/PointHitRules`・`core/CursorShapeRules`・`core/UnitSnapRules`・`core/UnitSnapSettings`・`core/MoveDirectionRules`・`core/DragTracker`・`core/HistoryManager`・`core/CanvasManager`・`core/FocusKeyYieldRules`・`core/ShapeFactory`・`shapes/`の5つの図形クラス・`shapes/EndpointSnapRules`・`edit/EndpointSnapper`・`edit/SnapshotAdapter`・`io/DocumentSerializer`・`io/SpriteSerializer`・`main.js`・`index.html`・`js/palette/`・`js/wiring/`・`asset/`
* **依存方向**：`main.js → wiring → palette / edit / core`、`core → shapes` の一方向を保つ。新しい向きは作らない（`core/InputTracker` は既存どおり `core/PressActionRules`・`core/SelectionRules`・`core/VertexHandleRules` を `core/` 内でimportするだけ。`PressActionRules`・`SelectionRules` は何もimportしない、`VertexHandleRules` は `core/InputModes` のみ）。循環importは作らない。

### 参照する責務
（`PROJECT_CONSTITUTION.md`・`PROJECT_ARCHITECTURE.md`および`_doc/arch/`から抜粋。**以後のタスク実行チャットは、この項目のみを責務情報源とする**）

* **憲法（必ず守る）**
  * すべての`.js`の最先頭行に、そのファイルの単一の責務をJSDocで3行以内に明記する。**ファイル先頭に定義された責務を逸脱するメソッド・ロジックを追記しない**。
  * クラス・関数・メソッド・データ構造にはJSDocで引数・戻り値・責務を明文化する。
  * 状態（モデル）と描画（Canvas API）を混同しない。`CanvasManager`に座標データ・選択状態を持たせない。
  * グローバル変数（`window`）を汚染しない。外部ライブラリ・フレームワーク・ビルドツールを導入しない。数学は標準の`Math`で自前実装する。
  * 検証コマンドは、リポジトリのルートの`node --test`（全件合格が合否）。
  * REQ／RESで変更対象として明示されたファイル以外は変更しない（ついでの整形・不要に見えるコードの削除・命名の改善も禁止）。

* **`js/core/VectorModel.js`**：描画データ（Shape配列）と、選択集合・頂点の選択・ホバー状態・作成中図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイルを保持する単一の真実（SSOT）。**図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式を知らない**（共通プロパティのスタイル3つだけは例外として書く）。再編集・追従は図形の`setVertex`/`translate`/`updateDraftEnd`へポリモーフィックに委譲する。通知は各操作につき1回（`#notifyChange()`。`moveShapes`・`updateShapeStyles`は1件以上更新したときだけ1回で、図形数に比例して発行しない）。`updateVertex(id, vertexIndex, x, y)`は該当図形が無ければ何もしない。
  * **頂点の選択**：非公開の`#selectedVertices`（`{ shapeId, handle }`の配列。選んだ順）。表示専用の一時的な状態で、保存・履歴・書き出しの対象外。公開は`setSelectedVertices(pairs)`（置き換え。`shapeId`が**現在の選択集合に含まれ**かつ`handle`が空でない文字列の組だけを、与えられた順で重複を除いて新しいオブジェクトとして写す。引数を保持も書き換えもしない。内容が変わったときだけ通知1回）・`clearSelectedVertices()`（1つ以上あったときだけ通知1回）・`getSelectedVertices()`（コピーを返す）・`isVertexSelected(shapeId, handle)`。**不変条件：選択集合に含まれる図形の組だけを持つ**（非公開の`#pruneSelectedVertices()`を`setSelection`・`clearSelection`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`の通知の**前**で呼ぶ。**通知の回数は増やさず既存の通知に相乗りする**）。`VectorModel`はハンドル名の意味を知らず文字列として持つだけ。呼び出し元は`InputTracker`（設定・解除）と`main.js`（`getSelectedVertices`を`renderCurrentState`で読む）。
  * **表示専用・保存しない一時的な状態（ホバー・選択矩形・吸い付きの表示の点・頂点の選択）と同じ扱いの状態をここへ足してよい**（作業データ・スナップショットには入らない）。

* **`js/core/InputTracker.js`**：ユーザー入力（図形作成・選択・範囲選択・本体ドラッグ・ハンドルドラッグ・パン・ズーム。キーはスペースパンのみ）の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知、カーソル形状のフィードバック（形の判定は`CursorShapeRules`へ渡し、キャンバスへ適用するだけ）。各ハンドラの判定順はJSDocを正とする。
  * **知らないこと**：図形種別（if/switch分岐を一切行わない。当たり判定は`PointHitRules`経由、`intersectsRect`・`getVertexIndexForHandle`・`getHandlePosition`は直接ポリモーフィックに呼ぶ。`vertexIndex`規約を`core/`層にハードコードしない）。`HistoryManager`・`edit/`をimportしない（注入された補助を呼ぶだけ）。スナップの設定を知らない（注入された`getUnitSnapStep`で刻みを受け取るだけ）。
  * **状態**：`InputState`（`IDLE`/`DRAWING`/`DRAGGING_HANDLE`/`MOVING_SELECTION`/`MARQUEE_SELECTING`）・操作モード（`'select'`/`'vertex'`/`'create'`/`'pan'`）・図形種別を独立に保持。パン状態は別フラグ。**頂点の選択の状態は持たない**（持ち主は`VectorModel`）。
  * **当たり分類**：`#classifyPoint`の1つの結果をホバー・押下・クリック・カーソルの4箇所で共用する。`classifyPointHit`へ`includeHandles`（頂点の選択のモードか）を渡し、頂点の選択のモードでは`isVertexHandle`で頂点のハンドルだけに絞り込む。**範囲選択の矩形の正規化は確定処理（`#commitMarquee`）の1箇所のみ**。
  * **押下・カーソルの委譲**：`handleMouseDown`の選択モード・`IDLE`の分岐は`PressActionRules.resolvePressAction`の結果を`#beginMoveSelection`・`#beginLeftDrag`へ振り分けるだけで分岐の表を持たない。カーソルの形は`CursorShapeRules.resolveCursorShape`へ渡し、戻り値を`canvas.style.cursor`へ入れるだけ。
  * **選択の規則の呼び出し**：`handleClick`・`#commitMarquee`が`SelectionRules`の結果を非公開の`#applySelectionChange(change)`で`model.setSelection`/`clearSelection`へ受け渡すだけ（判定を持たない）。
  * **修飾キー**：`hasCtrlModifier(event)`（`event.ctrlKey || event.metaKey`）が**`Ctrl`（`⌘`を含む）の読み取りの唯一の定義**。`Ctrl`を見るのは`click`・範囲選択の終了のイベント（確定の時点）と、スナップ・端点への吸い付きの省略（描き始め・描いている途中・ドラッグの追従のたびのイベント）。`Shift`は本体ドラッグの追従のたび、`Alt`は押した時点（`#beginMoveSelection`の1か所）。キーの購読は足さない。
  * **頂点のハンドルのドラッグ（前半まで）**：`#beginLeftDrag`が`DRAGGING_HANDLE`のとき`resolveDragEndpoint`で`#dragEndpoint`を、`shape.getHandlePosition(target.handle)`で`#unitSnapHandleOrigin`を記憶する（それ以外の押下では`null`）。`#applyLeftDragUpdate`は「吸い付けばその端点の座標、でなければ『始めた時点のハンドルの位置＋丸めた移動量』（位置が無ければカーソル位置）」を`model.updateVertex`へ渡す（`Shift`は効かない）。`#finishLeftDrag`が`commitEdit()`・`#resetSnapState()`・作業用フィールドの後始末（`#unitSnapHandleOrigin`を含む）を行う。**作業用フィールドの寿命は入力状態と同じで、遷移のたびに消す対応を崩さない**。
  * **頂点の選択のモード（前半）**：`handleMouseMove`は選択モードと同じ（ホバー＋カーソル）。`handleMouseDown`は頂点のハンドルなら`setSelectedVertices([1つ])`の後`DRAGGING_HANDLE`、それ以外は何も始めない。`handleClick`は頂点のハンドルなら`setSelectedVertices([hit.handle])`、本体なら`clearSelectedVertices()`＋`resolveClickSelection(…, false)`、空白なら`clearSelectedVertices()`＋`resolveClickSelection(…, null, false)`。`Esc`は頂点の選択が1つ以上あれば頂点だけ解除、なければ図形の選択を解除。`deleteSelection()`は選択モードのみ受理（`A`では`false`）。
  * **`Alt`+ドラッグ**：`#duplicateOnMove`は`MOVING_SELECTION`の押下（`#beginMoveSelection`）でだけ立て、**頂点のハンドル・範囲選択では立てない**。閾値超過の`#onLeftDragStart`で`beginEdit()`の後に`duplicateSelection()`を呼ぶ。

* **`js/core/PressActionRules.js`**：選択モードでマウスを押したとき、当たり分類の結果から「何の操作を始めるか」を決める規則（押下時の分岐の表）を、状態を持たない関数として提供する。公開は`resolvePressAction(hit, isSelected)`とtypedef`PressAction`（`moveSelection`／`dragHandle`＋`target`／`marquee`／`null`）。非公開の`MOVE_HANDLE_NAME`（`'move'`。`'move'`との比較はここ1か所だけ）。**`isSelected`を呼ぶのは本体の判定のときだけで引数は`hit.bodyId`**（呼び出しの回数を変えないため）。結果の`moveSelection`・`marquee`は毎回新しいオブジェクト。何もimportせず、DOM・イベント・修飾キー・操作モード・入力状態・図形種別・`VectorModel`を知らない。**押下時の分岐の表を変えるときはこのファイルだけを変える。** 選択モードの表は`Ctrl`で変えない（発注者の決定）。使う側は`InputTracker.handleMouseDown`のみ。テストは`test/core/PressActionRules.test.js`（12件）。

* **`js/core/SelectionRules.js`**：クリック・範囲選択の次の選択の指示と、選択の反転の結果を、状態を持たない関数として提供する。公開は`resolveClickSelection(selectedIds, hitId, additive)`・`resolveMarqueeSelection(selectedIds, hitIds, additive)`・`invertSelection(allIds, selectedIds)`とtypedef`SelectionChange`（`{type:'set', ids}`／`{type:'clear'}`／`null`。**正本はこのファイル**）。`additive`が偽のときの結果は従来の`VectorModel`の呼び出し（回数と引数）と1対1で一致する（クリック：当たれば`set([hitId])`・空白で選択があれば`clear`・なければ`null`／範囲選択：0件でも`set([])`）。真のとき、クリックは空白で`null`・選択中なら外す・未選択は末尾へ追加、範囲選択は未選択のものだけ足し0件なら`null`。**「置き換え」と「全解除」を区別して返すのは、`Ctrl`なしで従来と同じ呼び出しを再現するため**。引数を書き換えず新しい配列を返す。何もimportしない（DOM・`VectorModel`・図形・修飾キーのイベントを知らない。`Ctrl`の読み取りは呼び出し側）。使う側は`InputTracker`と`main.js`（`invertSelection`）。テストは`test/core/SelectionRules.test.js`（20件）。

* **`js/core/VertexHandleRules.js`**：頂点の選択モードで描く頂点のハンドルの一覧の組み立てと、ハンドル名が頂点のハンドルかの判定を、図形の共通メソッドだけを使う状態を持たない関数として提供する。公開は`collectVertexHandles(mode, shapes, selectedIds, selectedVertices)`（`mode`が`OperationMode.VERTEX`でなければ空配列。`shapes`の並びのうち`selectedIds`に含まれる図形について`getVertexHandleNames()`の順に`getHandlePosition(name)`で位置を求め（`null`は飛ばす）、`selectedVertices`に同じ組があれば`selected: true`。ハンドルが0個の図形は含めない）と`isVertexHandle(shape, handleName)`（`shape`が`getVertexHandleNames`を持ち一覧に含まれるときだけ真。`null`・`undefined`でも例外を投げない）。**読むものは図形の共通メソッド`getVertexHandleNames`・`getHandlePosition`と`id`だけ**（図形種別の分岐・図形固有のプロパティ名・`vertexIndex`規約を持たない）。importは`core/InputModes`の`OperationMode`のみ。DOM・`CanvasManager`の描き方・`VectorModel`・表示倍率・履歴・入力の状態を知らない。使う側は`main.js`（描画の引数）と`InputTracker`（絞り込み）。**頂点として扱う名前の正本は図形の`getVertexHandleNames`**で、表示と当たりの絞り込みが同じ一覧を読む。

* **`js/core/PointHitRules.js`（変更しない）**：当たり分類の規則。`classifyPointHit(shapes, isSelected, x, y, tolerance, includeFill = true, includeHandles = true)`とtypedef`PointHit`（`handle: {shapeId, handle}|null`・`bodyId: string|null`。両方`null`は空白。**正本はこのファイル**）。`includeHandles`が偽なら`handle`は常に`null`。ハンドルは選択集合の図形だけ・図形配列の後ろ（手前）優先。`handle`と`bodyId`は独立に求める。

* **`js/core/CursorShapeRules.js`（変更しない見込み）**：操作モード・入力状態・当たり分類からCSSの`cursor`値を決める判定表。(0a)パン中→`'grabbing'`、(0b)`Space`押下中かつ左ドラッグ状態でない→`'grab'`、(1)図形作成→`'crosshair'`、(2)キャンバス移動→`'grab'`、**(2a)頂点の選択モード→`state`が`DRAGGING_HANDLE`なら`'move'`、`hit === null`なら`'default'`、`hit.handle`あり→`'move'`、`hit.bodyId`あり→`'pointer'`、それ以外→`'default'`（`isSelected`・`isPickingShape`を呼ばない）**、(3)選択モード以外→`'default'`、(3a)待ち受け中→`'cell'`、(4)`DRAGGING_HANDLE`・`MOVING_SELECTION`→`'move'`、(5)`MARQUEE_SELECTING`→`'default'`、(6)`hit === null`→`'default'`、(7)`hit.handle`→`'move'`、(8)選択内の`bodyId`→`'move'`、(9)それ以外の`bodyId`→`'pointer'`、(10)→`'default'`。**ツールごとにカーソルの形を変えない**（発注者の決定）。ホバー・カーソルは`Ctrl`で変えない。

* **`js/core/UnitSnapRules.js`（変更しない）**：スナップ（丸め）の規則。`resolveUnitSnapStep(activeStep, suppressed)`（`suppressed`が真なら`null`）・`roundPointToUnit`・`roundDeltaToUnit`・`roundConstrainedDeltaToUnit`・`roundPointFromOriginToUnit(origin, target, step)`（「基準点＋丸めた移動量」。丸めない刻みでは`target`と同じ値）。正の有限の数値の刻み以外では丸めない。ちょうど中間の値は0から遠い側へ丸める。状態なし・DOMなし・importなし。

* **`js/core/CanvasManager.js`（変更しない見込み）**：Canvasへの純粋な描画（レンダラーの責務）。**図形データ・選択状態・ビュー変換状態・表示の状態を持たない**（値は`render`の引数で受け取る）。`render(shapes, { …, showHandles, vertexHandles })`。頂点のハンドルは全図形の描画の後・作成中の図形の前に描き、**選ばれていない頂点は白い四角・青い枠、選ばれている頂点は塗りを青**にして見分ける（大きさ・線幅は`÷ view.scale`。定数は`CanvasManager`内）。どのモードかは知らない。

* **`js/shapes/`（変更しない）**：図形種別ごとのデータ保持・描画・当たり判定・相互変換。**18メソッド契約**（`getVertexHandleNames`を含む）を5クラスが自律実装する。**ハンドル名の契約**：移動ハンドルの名前は`'move'`固定。`'move'`以外のハンドル名は`getVertexIndexForHandle`で有効な番号に解決できなければならない。`hitTestHandle`が返し得るすべての名前は`getHandlePosition`で位置に解決できなければならない。**`getVertexHandleNames`が返す名前は、`hitTestHandle`が返しうる名前であり、`getVertexIndexForHandle`が番号を、`getHandlePosition`が位置を返すものに限る**（`'move'`は含めない。`Line`＝`start`・`end`、`Curve`＝`start`・`control`・`end`、`Rect`＝4隅、`Path`＝`vertex-<i>`すべて、`Ellipse`＝なし）。`getHandlePosition(handleName)`は新しいオブジェクト`{x, y}`を返し、ハンドル名でない値には例外を投げず`null`を返す。`setVertex(vertexIndex, x, y)`は図形種別ごとの解釈（円・弧は半径）で頂点を動かす。

* **`js/edit/EndpointSnapper.js`・`js/shapes/EndpointSnapRules.js`（変更しない）**：端点への吸い付きの手順と規則。`InputTracker`は注入された補助として`findDrawSnap`・`resolveDragEndpoint(shapeId, handle)`・`findDragSnap`・`commitDrawnLine`・`joinDraggedEndpoint`を呼ぶだけで、候補の探索・距離の判定・モデルへの反映・端点のハンドルの判定を持たない。**吸い付きの対象を広げない。**

* **履歴の経路（変更しない）**：`core/HistoryManager.js`・`edit/SnapshotAdapter.js`。左ドラッグの記録は閾値超過時の`beginEdit()`と`#finishLeftDrag`の`commitEdit()`で1件（入れ子にしない。前後が同じなら記録先が記録しない）。頂点の選択は履歴・作業データ・書き出しの対象外。

* **`js/main.js`（変更しない）**：エントリポイント。インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶ連携のみ。**判定ロジックを持たない**。`renderCurrentState`は`collectVertexHandles(…)`の結果を`canvasManager.render`の`vertexHandles`へ渡すだけ。再描画・UI同期は既存の`onChange`の経路のみで行い、**機能専用の再描画・同期処理を足さない**。

* **`test/`**：`node:test`・`node:assert/strict`のみで書き、リポジトリのルートの`node --test`で実行する。置き場所は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。**テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない**。公開APIのみを通す。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc（`@param`・`@returns`）。`test/`以下に共有の補助モジュール・テスト以外の`.js`を置かない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存は素のオブジェクトの偽物で置き換える（実物の組み合わせは既存の例外のみ）。図形の`id`は公開プロパティへ直接代入して設定する。DOM・Canvasに依存する箇所（`CanvasManager`・`InputTracker`の配線・`index.html`・`main.js`／`wiring/`の配線）はテストできず、テストプレイで確かめる。現在の件数は tests 1365 / suites 208 / pass 1365 / fail 0。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体の修正は最終タスク（タスク13）でのみ行う。個別の実装タスク内では書き換えず、判明した点はこの欄へ追記する）

* **1章 フォルダ構造**：`VertexHandleRules.js`の一行説明（現状「頂点の選択モードで描く頂点のハンドルの一覧と、ハンドル名が頂点のハンドルかの規則（状態なし）。InputTracker・main.jsから使う」）を、範囲に入る頂点を集める規則（`collectVertexHandlesInRect`）も提供することに合わせて直す。また1章の`core/`説明（Phase 08-02aの`VertexHandleRules`の記述）にも同趣旨を足すか確認する。
* **1章 フォルダ構造**：`test/core/`の一覧へ`VectorModel.updateVertices.test.js`を1行足す。
* **1章 フォルダ構造**：`PressActionRules.js`の一行説明（現状「選択モードでマウスを押したときに何を始めるかの規則（状態なし）。InputTrackerから使う」）を、頂点の選択のモードの押下の判定表も提供することに合わせて直す。
* **1章 フォルダ構造**：`SelectionRules.js`の一行説明（現状「クリック・範囲選択の次の選択と選択の反転の規則（状態なし）。InputTracker・main.jsから使う」）を、図形と頂点の両方のクリック・範囲選択の次の選択の規則と、**選択の反転は図形のみ**であることが読み取れる文言へ直す。
* **1章「存在しないもの」**：Phase 08-02aの分にある「複数の頂点の選択・まとめ移動・範囲での頂点の選択（後半のPhaseで行う）」を外し、**本作業（Phase 08-02b）でやらないこと**（頂点の追加・削除、パスの分割、区間の直線／曲線の切り替え、パスを開く／閉じる、矢印キーでの微調整・位置の数値入力・整列と分布、拡大縮小・回転・反転・外枠のハンドル、複数の頂点を選んでいるときの端点への吸い付き、頂点のドラッグでの`Shift`の限定、範囲選択で図形そのものを選ぶこと・頂点が出ていない図形の頂点を範囲選択で選ぶこと）を足す。
* **2章 頂点の選択**：「本作業の操作は最大1つしか入れない（複数は後半）」の記述を外し、**2つ以上の組が入る**こと（入れる操作は`Ctrl`＋クリック・範囲選択・選び直し）を書く。状態の形・不変条件・保存しないことは変えない。
* **3章 3. 入力監視**：
  * 「範囲選択の流れ」へ、**頂点の選択のモードでは空白からでも図形の本体の上からでも始められ、確定では図形の選択を変えず（`intersectsRect`を呼ばず）`VertexHandleRules`で集めた頂点の組を`SelectionRules`の頂点用の規則へ渡す**ことを足す（正規化は確定処理の1箇所のままであることも明記）。
  * 「クリックの解釈」へ、頂点の選択のモードの`Ctrl`の約束（頂点のハンドル＝頂点の選択へ追加・解除、図形の本体＝図形の選択へ追加・解除で頂点の選択は空にしない、空白＝何もしない）を足す。
  * 「頂点のハンドルのドラッグ・図形の作成で打つ点」へ、**アンカー（押した頂点）を基準に丸め、選んでいる頂点すべてへ同じ移動量を足して1回の通知で渡す**ことと、**端点への吸い付きは頂点を1つだけ選んでいるときだけ働く**ことを足す。
* **3章 18. 頂点の選択**：本作業（Phase 08-02b）の内容を足す。複数選択（`Ctrl`＋クリック・範囲選択・選び直し）・まとめ移動（`updateVertices`で通知1回・取り消し1件）・`Ctrl`＋クリックで図形を選択へ追加・解除できること・端点への吸い付きを1つのときだけにしたこと・押下の判定表の正本が`PressActionRules.resolveVertexPressAction`であること・頂点の選択の変更の規則が`SelectionRules`の2つの関数であること・範囲に入る頂点を集めるのが`VertexHandleRules.collectVertexHandlesInRect`であること・発注者の決定（2026-11-16の6点）・やらないこと・前半の記述の訂正（「本体の上・空白の押下は何も始めない」→「本体の上・空白のどちらからでも範囲選択が始まる（図形は動かない）」、押下とクリックの判定表、クリックで`Ctrl`を見ないという記述）。注意(a)の「通知が2回」の記述は本作業後の経路に合わせて見直す（`Ctrl`ありの本体のクリックでは頂点を解除しないこと）。
* **4章の各モジュールのファイル**：
  * `_doc/arch/03_VectorModel.md`：公開メソッドの一覧へ`updateVertices`を足し、`updateVertex`が`updateVertices`へ委譲すること（`setVertex`を呼ぶ箇所の一本化）・通知1回の約束・存在しないidと空の配列の扱いを書く。頂点の選択の項の「最大1つ」等の前半の前提を直し、2つ以上の組が入ることと落とし方（変更なし）を書く。
  * `_doc/arch/06_InputTracker.md`：頂点の選択のモードの押下（判定表の委譲先と4通り）・追従（まとめ移動の式・`updateVertices`へ1回・アンカーの扱い）・範囲選択の確定（頂点の組の集め方と図形の選択を変えないこと）・クリック（`Ctrl`の約束）・新しい作業用フィールド`#vertexDragOrigins`の寿命・端点の解決を1つのときだけ行うこと・`#applyVertexSelectionChange`・importの追加・行数を更新する。
    * （タスク7で判明）`06_InputTracker.md`・`PROJECT_ARCHITECTURE.md`3章の入力監視へ：作業用フィールド`#vertexDragOrigins`（押下時の位置と頂点インデックスを押下の時点に1回だけ求める・寿命は`#unitSnapHandleOrigin`と同じ）、フィールド`activeHandle`の頂点インデックス解決が追従から押下時へ移ったこと、端点への吸い付きの解決は記憶した頂点が1つのときだけであること、クラス先頭の責務定義に頂点の複数選択とまとめ移動を足したこと。
    * （タスク8で判明）`06_InputTracker.md`の追従の記述：`#applyLeftDragUpdate`は頂点インデックスを解決せず`#vertexDragOrigins`の記憶値を使い、`updateVertices`へ`{id, vertexIndex, x, y}`の配列を1回で渡す（アンカーは行き先そのもの）。
  * `_doc/arch/34_PressActionRules.md`：`resolveVertexPressAction`と`VertexPressAction`の判定の表（4通り）・照会の呼び方・選択モードの表を変えていないこと・テストの件数を足す。
  * `_doc/arch/27_SelectionRules.md`：頂点用の2つの関数と`VertexSelectionChange`・頂点の同一性（図形のidとハンドル名の両方一致）・`additive`の約束・テストの件数を足す。あわせて、同資料の冒頭の責務の一文（現状「クリック・範囲選択の次の選択の指示と、選択の反転の結果を…」）を、実コードの先頭の責務定義（図形と頂点の両方・選択の反転は図形のみ）に合わせて書き直す。
  * `_doc/arch/38_VertexHandleRules.md`：`collectVertexHandlesInRect`（対象は選択中の図形だけ・境界を含む・並び・正規化済みの矩形を受け取る前提・`intersectsRect`を使わない理由）とテストの件数を足す。
  * `_doc/arch/16_test.md`：Phase 08-02bの新設・追加分（新設1ファイルと既存4ファイルへの追加）、書き換えた既存のテスト（無しの見込み）、テストできない箇所（`InputTracker`の頂点の複数選択・まとめ移動・範囲選択の配線）、`node --test`の件数を足す。
  * （要件7の確認で表示・カーソルの変更が必要と判断した場合のみ）`_doc/arch/04_CanvasManager.md`・`_doc/arch/35_CursorShapeRules.md`へ理由とともに反映する。

## 3. タスクリスト

*   [x] タスク1: 要件1 頂点の選択の状態に2つ以上の組が入ることをテストで固める
    *   **対象ファイル** :
        *   `./test/core/VectorModel.selectedVertices.test.js` :（更新）
    *   **作業内容** :
        *   `js/core/VectorModel.js`は**変更しない**（状態の形・公開メソッドは前半のままで、2つ以上の組を渡す配線は後続のタスクで行う）。
        *   既存のケースを変えずに、次のケースを足す：3つ以上の組の置き換えで**与えられた並びが保たれる**こと／**同じ図形の複数の頂点**（例：`shape-a`の`start`と`end`）が入ること／同じ組を重ねて入れても1つになり、並びは最初に現れた位置になること／選択集合が複数のまま一部の図形だけ外れたときに、**落ちる組と残る組**が正しく分かれ、残る組の並びが保たれること（通知は1回のまま）。
        *   補助関数（`setup`）は既存のものを使い、書き換えない。新しい補助が必要な場合はファイル内に足し、JSDoc（`@param`・`@returns`）を書く。
        *   JSDocの記載漏れが無いことを確認する（テストファイル先頭の責務コメントを含む）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク2: 要件2 複数の頂点の座標をまとめて更新するメソッド（`updateVertices`）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./test/core/VectorModel.updateVertices.test.js` :（新規）
    *   **作業内容** :
        *   `updateVertices(updates)`を`updateVertex`の直後に足す。`updates`は`Array<{ id, vertexIndex, x, y }>`。各組について`#shapes`から`id`の図形を引き、見つかったものだけ`shape.setVertex(vertexIndex, x, y)`を配列の順に呼び、**1件以上更新したときだけ`#notifyChange()`を1回**呼ぶ。存在しないidは無視し、空の配列では何もしない。図形種別の分岐・図形固有のプロパティ名を持たず、引数の配列・要素を書き換えない。
        *   `updateVertex(id, vertexIndex, x, y)`を`this.updateVertices([{ id, vertexIndex, x, y }])`へ委譲する形に直す（名前・引数・ふるまいは変えない）。JSDocに委譲することと、`setVertex`を呼ぶ箇所が`updateVertices`の1か所であることを書く。
        *   JSDocは`moveShapes`・`updateShapeStyles`の書き方にそろえ、「通知は1回」「存在しないidは無視」「引数を書き換えない」「頂点インデックスと図形固有プロパティの対応は関知しない」を明記する。クラス先頭の責務定義が変更不要（委譲の方針のまま）であることを確認する。
        *   `test/core/VectorModel.updateVertices.test.js`（新規）：先頭に単一責務のJSDoc。実物の`VectorModel`と図形クラスで、複数の図形にまたがる更新・同じ図形の複数の頂点・**通知が1回**であること・存在しないidの無視（混在した場合は見つかったものだけ更新して通知1回）・全部が存在しないidなら通知0回・空の配列で通知0回・引数の配列と要素を書き換えないこと・`updateVertex`が従来どおり（1頂点・通知1回・存在しないidで通知0回）であることを確かめる。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`test/edit/EndpointSnapper.test.js`が`updateVertex`を使うため必須）。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク3: 要件3 頂点の選択のモードの押下の判定表（`resolveVertexPressAction`）
    *   **対象ファイル** :
        *   `./js/core/PressActionRules.js` :（更新）
        *   `./test/core/PressActionRules.test.js` :（更新）
    *   **作業内容** :
        *   typedef`VertexPressAction`（`{type:'dragSelectedVertices', target}`／`{type:'selectVertexAndDrag', target}`／`{type:'marquee'}`／`null`）と関数`resolveVertexPressAction(hit, isVertexSelected, additive)`を足す。判定の順は要件3の表のとおりで、JSDocに表と同じ順序・条件・結果を書く。
        *   **既存の`resolvePressAction`・`PressAction`・`MOVE_HANDLE_NAME`は変えない**（`'move'`の比較は既存の1か所のままで、頂点用の関数は`'move'`を見ない。頂点のハンドルだけに絞り込むのは`InputTracker`の`#classifyPoint`の責務）。
        *   `isVertexSelected`は`hit.handle`があるときだけ1回呼び、引数は`hit.handle.shapeId`・`hit.handle.handle`。`additive`は真偽値として読むだけ（イベント・修飾キーの判定を持たない）。`target`は`hit.handle`そのもの、`marquee`は毎回新しいオブジェクト。引数を書き換えない。importなし・DOMなし・状態なしを保つ。
        *   ファイル先頭の責務定義を、選択モードと頂点の選択のモードの両方の押下の判定表を提供することに合わせて書き直す（3行以内）。
        *   `test/core/PressActionRules.test.js`：**既存の12件を変えずに**、`resolveVertexPressAction`のケースを足す（選ばれている頂点→`dragSelectedVertices`で`target`が同一参照／選ばれていない＋`Ctrl`なし→`selectVertexAndDrag`／選ばれていない＋`Ctrl`あり→`null`／ハンドルなし・本体あり→`marquee`／ハンドルなし・空白→`marquee`／`isVertexSelected`の呼び出しの回数と引数（ハンドルなしでは呼ばない）／`hit`を書き換えないこと・`marquee`が毎回新しいオブジェクト）。照会の記録用の補助関数にはJSDocを書く。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク4: 要件4 頂点の選択の変更の規則（クリック・範囲選択）
    *   **対象ファイル** :
        *   `./js/core/SelectionRules.js` :（更新）
        *   `./test/core/SelectionRules.test.js` :（更新）
    *   **作業内容** :
        *   typedef`VertexSelectionChange`（`{type:'set', vertices}`／`{type:'clear'}`／`null`）と、`resolveVertexClickSelection(selectedVertices, hitVertex, additive)`・`resolveVertexMarqueeSelection(selectedVertices, hitVertices, additive)`を足す（図形用の2つの関数と同じ形・同じ約束。分岐は要件4のとおり）。
        *   頂点の同一性（図形のidとハンドル名の**両方が一致**）の比較は、本ファイル内の非公開の補助関数1つに閉じ、2つの関数が共有する（同じ条件を2か所に書かない）。
        *   引数（配列・要素）を書き換えず、毎回新しい配列を返す。`import`なし・DOMなし・状態なしを保つ。**既存の3つの関数と`SelectionChange`は変えない。**
        *   JSDocに、`additive`が偽／真のときの結果、0件のときの扱い（クリック＝選んでいる頂点があるときだけ`clear`、範囲選択＝`Ctrl`なしは`set([])`・`Ctrl`ありは`null`）、並びが保たれること、`VectorModel`の呼び分け（`setSelectedVertices`／`clearSelectedVertices`）を想定した戻り値であることを書く。ファイル先頭の責務定義は図形と頂点の両方を扱うことに合わせて書き直す（3行以内）。
        *   `test/core/SelectionRules.test.js`：**既存の20件を変えずに**、頂点用の2つの関数のケースを足す（クリック：`Ctrl`なしで当たった頂点だけに置き換え・当たっていなければ選択ありで`clear`／選択なしで`null`、`Ctrl`ありで追加・解除・空白で`null`／範囲選択：`Ctrl`なしで置き換え・0件でも`set([])`、`Ctrl`ありで未選択のものだけ追加・重複しない・0件で`null`／同じ図形の別の頂点が混ざるとき・別の図形の同じハンドル名が混ざるときに取り違えないこと／並びが保たれること／引数を書き換えず新しい配列を返すこと）。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク5: 要件5 範囲に入った頂点を集める規則（`collectVertexHandlesInRect`）
    *   **対象ファイル** :
        *   `./js/core/VertexHandleRules.js` :（更新）
        *   `./test/core/VertexHandleRules.test.js` :（更新）
    *   **作業内容** :
        *   `collectVertexHandlesInRect(shapes, selectedIds, minX, minY, maxX, maxY)`を足す（戻り値は`Array<{shapeId, handle}>`）。対象は`selectedIds`に含まれる図形だけ。各図形の`getVertexHandleNames()`の順に`getHandlePosition(name)`で位置を求め、`null`は飛ばし、**境界の上も中に含める**判定（`minX <= x <= maxX`かつ`minY <= y <= maxY`）で入る組を集める。並びは図形の並び（描画順）→ ハンドル名の一覧の順。毎回新しい配列を返し、引数を書き換えず、例外を投げない。
        *   JSDocに、**正規化済みの矩形（`min <= max`）を受け取る前提**（正規化は`InputTracker`の範囲選択の確定が行う唯一の箇所）・境界を含むこと・対象が選択中の図形だけであること（発注者の決定）・`intersectsRect`を使わない理由（図形の当たりではなく頂点の位置で判定するため）を書く。
        *   **既存の`collectVertexHandles`との走査は共有しない**（非公開の補助関数へ括らず、新しい関数の中に書く）。理由は要件5のとおり：集める条件と戻り値の形が違い（図形ごとのまとまり＋`selected`付き／組の平らな配列）、括ると既存の`collectVertexHandles`の本体を書き換えることになるため（要件5の「既存のふるまいを変えない」を優先する）。REQ:184が禁じる「同じ判定表・同じ比較の条件の二重定義」には当たらない（矩形の判定は新しい関数の1か所だけ・頂点の同一性の比較は持たない）。重なるのは図形の共通メソッドの読み方だけで、その正本は図形側にある。
        *   既存の`collectVertexHandles`・`isVertexHandle`は変えない（引数・戻り値・走査の中身に手を触れない）。操作モードの引数は取らない。図形種別の分岐・図形固有のプロパティ名・状態・DOMを持たず、importは`core/InputModes`の`OperationMode`のみのままにする。ファイル先頭の責務定義に、範囲に入る頂点を集めることを加える（3行以内）。
        *   `test/core/VertexHandleRules.test.js`：既存の8件を変えずにケースを足す（実物の図形を使う。直線・曲線・矩形・パスの頂点が入る／入らない・一部だけ入る／円・弧は0件／選択中でない図形は対象外／境界の上の頂点が入ること／並びが「図形の並び→ハンドル名の順」であること／面積0の矩形（1点）で、その点にある頂点だけが入ること／引数を書き換えないこと）。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク6: 要件6 範囲選択の確定に頂点の選択の枝を足す（`#commitMarquee`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `VertexHandleRules`から`collectVertexHandlesInRect`、`SelectionRules`から`resolveVertexMarqueeSelection`をimportに足す（既存のimportの並びに合わせる）。
        *   非公開メソッド`#applyVertexSelectionChange(change)`を`#applySelectionChange`の直後に足す（`null`なら何もしない・`clear`なら`model.clearSelectedVertices()`・`set`なら`model.setSelectedVertices(change.vertices)`。受け渡しのみで判定を持たない）。JSDocに型（`VertexSelectionChange`）と受け渡しだけである旨を書く。
        *   `#commitMarquee`に頂点の選択のモードの枝を足す：矩形の正規化（既存の計算。**唯一の正規化の箇所**）の後、`currentMode === OperationMode.VERTEX`なら`collectVertexHandlesInRect(this.model.getShapes(), this.model.getSelectedIds(), minX, minY, maxX, maxY)`で組を集め、`model.clearSelectionRect()`の後に`resolveVertexMarqueeSelection(this.model.getSelectedVertices(), 集めた組, hasCtrlModifier(event))`の結果を`#applyVertexSelectionChange`へ渡して`return`する（`intersectsRect`・`resolveMarqueeSelection`を呼ばず、**図形の選択を変えない**）。選択モードの既存の経路・通知の回数・`Ctrl`を見る時点は変えない。
        *   `#commitMarquee`のJSDocへ、モードごとの枝（頂点の選択のモードでは頂点の選択だけを変えること・正規化は本メソッドの1箇所であること・通知の回数）を書き足す。
        *   **このタスクの時点では頂点の選択のモードで範囲選択が始まらないため、この枝はまだ通らない**（押下の配線はタスク7）。異常ではない。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク7: 要件6 押下の配線と作業用フィールド（`handleMouseDown`・`#beginLeftDrag`・`#finishLeftDrag`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `PressActionRules`から`resolveVertexPressAction`をimportに足す。
        *   作業用フィールド`#vertexDragOrigins = []`を`#unitSnapHandleOrigin`の直後に足し、JSDocへ型・意味・**寿命**（`#beginLeftDrag`で設定、`DRAGGING_HANDLE`以外の押下では空配列、`#finishLeftDrag`で空配列に戻す）・位置と頂点インデックスを押下の時点で1回だけ求めることを書く。
        *   `handleMouseDown`の頂点の選択のモードの枝を、`resolveVertexPressAction(hit, (shapeId, handle) => this.model.isVertexSelected(shapeId, handle), hasCtrlModifier(event))`の結果で振り分ける形に置き換える（`dragSelectedVertices`→`#beginLeftDrag(…, InputState.DRAGGING_HANDLE, point, action.target)`／`selectVertexAndDrag`→`model.setSelectedVertices([{ shapeId, handle }])`の後に同じ`#beginLeftDrag`／`marquee`→`#beginLeftDrag(…, InputState.MARQUEE_SELECTING, point)`／`null`→何もしない）。判定表を`InputTracker`に書かない。選択モードの枝・中ボタン・`Space`・パン・`IDLE`の早期`return`・`isPickingShape`の扱いは変えない。
        *   `#beginLeftDrag`の`DRAGGING_HANDLE`の分岐で、`#vertexDragOrigins`を組み立てる：`model.getSelectedVertices()`に`target`と同じ組があればその全体、無ければ`[target]`を対象にし、各組について図形を引いて`getVertexIndexForHandle(ハンドル名)`と`getHandlePosition(ハンドル名)`を求め、`{ shapeId, handle, vertexIndex, x, y }`として記憶する（図形が無い組・位置が得られない組は飛ばす。ただしアンカー＝`target`の組は位置が得られなくても残し、その場合は位置なしとして扱う）。`#unitSnapHandleOrigin`はアンカーの位置から設定する（値は従来と同じ`getHandlePosition`の結果。得られなければ`null`）。
        *   **端点への吸い付きの解決**：記憶した組が1つだけのときに限り、従来どおり`this.#snapAssist.resolveDragEndpoint(target.shapeId, target.handle)`で`#dragEndpoint`を解決する（2つ以上のときは解決せず`null`のまま。発注者の決定）。`DRAGGING_HANDLE`以外では`#vertexDragOrigins`を空配列にする。
        *   `#finishLeftDrag`で`#vertexDragOrigins`を空配列に戻す（`#unitSnapHandleOrigin`を`null`にする箇所の近く。既存の順序＝`commitEdit()`→`#resetSnapState()`の順は変えない）。
        *   `handleMouseDown`・`#beginLeftDrag`・`#finishLeftDrag`・**フィールド`activeHandle`**のJSDocを実装に合わせて書き直す（押下の判定表の参照先・記憶する組の決め方・端点の解決を1つのときだけ行うこと・作業用フィールドの寿命）。`activeHandle`は現在「ドラッグの追従（`#applyLeftDragUpdate`）で`shape.getVertexIndexForHandle()`により頂点インデックスへ解決する」と書かれているので、**解決が押下の時点（`#vertexDragOrigins`の組み立て）へ移ったことに合わせて直す**（書き直しを漏らすと実装と食い違う）。クラス先頭の責務定義も、頂点の複数選択とまとめ移動の解釈を含む形に合わせて見直す（3行以内）。
        *   **このタスクの時点では追従がまだアンカーだけを動かす**（まとめ移動の配線はタスク8）。範囲選択はタスク6の枝で確定するため、図形の選択は変わらない。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク8: 要件6 追従（まとめ移動。`#applyLeftDragUpdate`）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `#applyLeftDragUpdate`の`DRAGGING_HANDLE`の処理を、次の順に直す（`MARQUEE_SELECTING`・`MOVING_SELECTION`の枝は変えない）。
            1. 対象図形（`activeShapeId`）を引き、見つからなければ何もしない（既存の早期`return`を残す）。
            2. アンカーの行き先を**今までどおり**求める（`#dragEndpoint`があるときだけ吸い付きを照会・保持・表示（`Ctrl`の間は照会しない）、吸い付けばその座標、吸い付かず`#unitSnapHandleOrigin`があれば`roundPointFromOriginToUnit`、位置が無ければカーソル位置。`Shift`は見ない）。
            3. 移動量を`アンカーの行き先 − #unitSnapHandleOrigin`で求める（`#unitSnapHandleOrigin`が`null`なら移動量0）。
            4. `#vertexDragOrigins`から更新の配列を作る：**アンカーの組はアンカーの行き先そのもの**、ほかの組は`押下時の位置＋移動量`。`vertexIndex`は記憶した値を使う。
            5. `this.model.updateVertices(updates)`へ**1回**で渡す（頂点ごとに呼ばない）。
        *   頂点が1つだけのときの結果が前半と完全に同じになること（アンカーの座標に足し算を通さないこと・`updateVertices`が1件で通知1回であること）をコード上で確かめ、JSDocに明記する。
        *   `#applyLeftDragUpdate`のJSDocを実装に合わせて書き直す（アンカーの意味・移動量の求め方・選んでいる頂点すべてへ同じ移動量を足すこと・通知が1回であること・端点への吸い付きは頂点が1つだけのときにしか起きないこと・`Shift`は効かないこと）。あわせて**フィールド`activeHandle`のJSDoc**が、頂点インデックスの解決を追従ではなく押下の時点で行う実装と合っていることを確認する（タスク7で直していなければここで直す。食い違う記述を残さない）。
        *   取り消しの記録の経路（`#onLeftDragStart`の`beginEdit()`・`#finishLeftDrag`の`commitEdit()`）・`#onLeftDragEnd`の結合の条件は変えない（`js/core/HistoryManager.js`・`js/edit/SnapshotAdapter.js`・`js/edit/EndpointSnapper.js`は変更しない）。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [x] タスク9: 要件6 クリック（`handleClick`の`Ctrl`の約束）
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `SelectionRules`から`resolveVertexClickSelection`をimportに足す。
        *   `handleClick`の頂点の選択のモードの枝を次に直す：`Ctrl`の有無（`hasCtrlModifier(event)`）を読み、**頂点のハンドルの上**なら`resolveVertexClickSelection(this.model.getSelectedVertices(), { shapeId: hit.handle.shapeId, handle: hit.handle.handle }, Ctrl)`の結果を`#applyVertexSelectionChange`へ（図形の選択は変えない）。**`Ctrl`が真**なら`resolveClickSelection(this.model.getSelectedIds(), hit.bodyId, true)`の結果を`#applySelectionChange`へ渡して終わる（本体なら図形の選択へ追加・解除、空白なら規則が`null`を返して何もしない。頂点の選択は空にしない）。**`Ctrl`が偽**なら前半どおり`model.clearSelectedVertices()`の後に`resolveClickSelection(this.model.getSelectedIds(), hit.bodyId, false)`の結果を`#applySelectionChange`へ渡す。
        *   選択モード・図形作成モードの`handleClick`の処理、`DRAWING`の確定、`consumeSuppressedClick()`による抑止は変えない。
        *   `handleClick`のJSDocの頂点の選択のモードの段落を実装に合わせて書き直す（判定の順・`Ctrl`を見る時点（この`click`イベント＝確定の時点）・図形の選択を変える場合と変えない場合・選択から外れた図形の頂点は`VectorModel`が落とすこと・通知の回数）。
        *   **`Ctrl`＋選択中の頂点の押下との組み合わせのふるまいを、同じJSDocへ書き残す**：押下の判定表（要件3の1行目）は`Ctrl`で変えないため、`Ctrl`を押していても**選ばれている頂点を押せばドラッグが始まり**、そのまま閾値以内で離すと、この`click`の規則（`Ctrl`あり・当たった頂点が選択中→外す）によって**その頂点が選択から外れる**。これはREQどおりの正しいふるまいであり不整合ではない（**ガード処理を足さないこと**）。閾値を超えて動かした場合は移動し、直後の`click`は`consumeSuppressedClick()`で抑止されるため選択は変わらない。図形側に同じ趣旨の記述が既にある（`js/core/InputTracker.js`の`handleClick`のJSDoc「押下時の分岐（handleMouseDown）はCtrlで変えないため、選択中の図形をCtrlで押して閾値以内で離すと、このclickで『選択中なら外す』になる」）ので、頂点側も同じ書き方にそろえる。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   開発資料の記載に影響が出る点があれば、本計画書の『開発資料の更新予定』欄へ追記する（資料本体は修正しない）。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク10: 要件7 表示とカーソルを変える必要があるかを実コードで確かめる
    *   **対象ファイル** :
        *   （確認のみ。変更が必要と判断した場合に限り`./js/core/CanvasManager.js`または`./js/core/CursorShapeRules.js`＋`./test/core/CursorShapeRules.test.js`）
    *   **作業内容** :
        *   `js/core/VertexHandleRules.js`の`collectVertexHandles`・`js/main.js`の`renderCurrentState`・`js/core/CanvasManager.js`の頂点のハンドルの描画を読み、**2つ以上の頂点が同時に選ばれていても見分けられる**ことを確かめる（組ごとに`selected`が付くこと・描画が各要素の`selected`で塗りを変えること）。
        *   `js/core/CursorShapeRules.js`の判定表(2a)と`#updateCursor`の呼び出しを読み、頂点の上は`move`・本体の上は`pointer`・空白は既定・範囲選択中は既定のままであることを確かめる。
        *   どちらも変更不要であれば**ファイルを変更せず**、確認した内容を本RESの詳細作業内容へ記録する。変更が必要と判断した場合は、理由を本RESへ書き、`CanvasManager`に状態・図形種別の分岐・図形固有のプロパティを持ち込まない（必要な値は`render`の引数で受け取る）形で直し、`CursorShapeRules`を変えた場合は`test/core/CursorShapeRules.test.js`も直して『開発資料の更新予定』へ追記する。
        *   範囲選択の枠が既存の選択矩形の見た目をそのまま使っていること（新しい描画の経路・新しい見た目を作っていないこと）を確かめる。
        *   JSDocの記載漏れが無いことを確認する（変更が生じた場合は、直した関数・メソッド・ファイル先頭の責務定義を含めて確認する）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし「今回やらないこと」に挙げた到達不能な枝は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク11: 仕上げの確認（JSDoc・不要なコード・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。問題が見つかった場合のみ該当ファイルを修正する）
    *   **作業内容** :
        *   本作業で追加・変更したすべての関数・メソッド・データ構造（typedefを含む）にJSDocがあり、責務・引数・戻り値が明文化されていることを確認する（記載漏れがあれば補う）。各ファイル先頭の責務定義が実装と合っていることも確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（**ただし「今回やらないこと」に挙げた到達不能な枝＝各図形の`drawHandles`・`resolvePressAction`のハンドルの枝・`CursorShapeRules`の選択モードのハンドルの枝・`CanvasManager.render`のハンドルを描く段は残す**）。
        *   `git diff`で、スコープ外のファイル・改名・整形・削除が混ざっていないことを確認する（変更してよいのは`js/core/VectorModel.js`・`js/core/PressActionRules.js`・`js/core/SelectionRules.js`・`js/core/VertexHandleRules.js`・`js/core/InputTracker.js`・`test/core/`の5ファイル（うち1つは新規）と、最終タスクの開発資料のみ）。
        *   既存のテストの期待値を変えていないことを`git diff`で確認する（変えざるを得なかった場合は理由を本RESの「5. 懸念事項」へ書く）。
        *   リポジトリのルートで`node --test`を実行し、全件通る（`fail 0`）ことを確認し、件数を記録する。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク12: 要件8 テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （提示のみ。ファイルの変更なし）
    *   **作業内容** :
        *   次の確認項目を発注者へ提示する。
        *   **0. 最初に必ずブラウザの強制再読み込み（`Ctrl`+`F5`）を行う**（古いJSが残ると、直したはずの動きが直っていないように見えるため）。
        *   1. **前半のまま動くこと**：頂点の選択（`A`）で図形をクリックすると頂点が出る。頂点をクリックすると1つだけ選ばれる。頂点をドラッグするとその頂点だけが動き、スナップ・端点への吸い付き・取り消し1件が今までどおり働く。
        *   2. **`Ctrl`＋クリックで頂点を足す**：頂点を1つ選び、`Ctrl`を押しながら別の頂点をクリックすると2つとも選ばれた見た目（青い塗り）になる。さらに足せる。
        *   3. **`Ctrl`＋クリックで頂点を外す**：選ばれている頂点を`Ctrl`＋クリックすると、その頂点だけ選ばれていない見た目に戻る。全部外すと0個になる。
        *   4. **範囲選択（空白から）**：頂点が出ている状態で、何もない所から枠を引くと、枠に入った頂点がまとめて選ばれる。枠に頂点が入らなければ選択は空になる。
        *   5. **範囲選択（本体の上から）**：図形の線の上から枠を引き始めても範囲選択が始まる（図形は動かない）。
        *   6. **範囲選択に`Ctrl`**：いくつか選んだ状態で`Ctrl`を押しながら枠を引くと、枠に入った頂点が選択へ足される（元の選択は消えない）。
        *   7. **範囲選択で図形は変わらない**：範囲選択の枠が別の図形に掛かっても、選ばれている図形は変わらない（頂点が出ている図形も変わらない）。
        *   8. **まとめて移動**：2つ以上の頂点を選び、そのうちの1つをドラッグすると、選んでいる頂点が同じだけ動く（選んでいない頂点・ほかの図形は動かない）。矩形の2つの角を選んで動かすと、その2点だけが動く。
        *   9. **選んでいない頂点を押したとき**：選んでいない頂点をドラッグすると、選択がその頂点だけに切り替わってその頂点だけが動く。
        *   10. **まとめて移動とスナップ**：表示倍率を110%にし、グリッドを10pxにして、`?dev`で読み込んだ小数の座標の図形の頂点を複数選んで動かすと、押した頂点がスナップの単位に乗り、ほかの頂点も同じだけ動く。`Ctrl`を押している間は丸められない。
        *   11. **まとめて移動と端点への吸い付き**：頂点を1つだけ選んで直線の端点をドラッグすると今までどおり吸い付く（印が出る）。**2つ以上選んでいるときは吸い付かない（印も出ない）。**
        *   12. **取り消し・やり直し**：複数の頂点をまとめて動かした後の`Ctrl`+`Z`で全部まとまって元に戻り（1回で戻る）、`Ctrl`+`Y`でやり直せる。頂点の選択そのものは取り消しの対象にならない。
        *   13. **`Ctrl`＋クリックで図形を足す**：頂点の選択（`A`）のまま、`Ctrl`を押しながら別の図形の線の上をクリックすると、その図形も選ばれて頂点が出る。2つの図形の頂点を混ぜて選び、まとめて動かせる。`Ctrl`＋クリックで図形を外すと、その図形の頂点は選択から消える（残った図形の頂点は選ばれたまま）。
        *   14. **`Esc`・`Delete`**：複数選んだ状態で`Esc`を押すと頂点の選択だけ解けて頂点は出たまま、もう一度で図形の選択も解ける。`Delete`・`Backspace`は何も起きない。
        *   15. **`Shift`**：頂点のドラッグ中に`Shift`を押しても方向は限定されない（今回入れていない）。選択（`V`）の本体ドラッグでは今までどおり限定される。
        *   16. **選択（`V`）が変わっていないこと**：クリック・`Ctrl`＋クリック・範囲選択・本体ドラッグ・`Alt`＋ドラッグの複製・`Shift`・`Delete`が今までどおり。ハンドルは出ない。
        *   17. **ほかの操作**：図形の作成（1〜5）・パン（`H`・スペース・中ボタン）・ズーム・表示の切り替え・スタイル・重なり順・結合（`J`）・クリップボード・キャンバスパレット・ファイル操作・入力欄との競合（太さ・色の欄にフォーカスがある間は`A`・`V`が働かない）が今までどおり。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ提示した内容を記載し、タスクリストのチェックを`[x]`にする。

*   [ ] タスク13: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/03_VectorModel.md` `./_doc/arch/06_InputTracker.md` `./_doc/arch/16_test.md` `./_doc/arch/27_SelectionRules.md` `./_doc/arch/34_PressActionRules.md` `./_doc/arch/38_VertexHandleRules.md` :（更新）
        *   （要件7で変更が生じた場合のみ）`./_doc/arch/04_CanvasManager.md` `./_doc/arch/35_CursorShapeRules.md` :（更新）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄と、各タスクで追記された更新予定をすべて反映する。
        *   **`Ctrl`＋選択中の頂点の押下との組み合わせ**（押下の判定表は`Ctrl`で変えないため、選ばれている頂点を`Ctrl`で押して閾値以内で離すと`click`で選択から外れること。REQどおりの正しいふるまいで、ガード処理を足さないこと）を、3章の「クリックの解釈」または「18. 頂点の選択」へ書き残す（図形側の同じ記述と同じ扱いにする）。
        *   少なくとも、3章「18. 頂点の選択」（複数選択・範囲選択・まとめ移動・`Ctrl`の約束・端点への吸い付きを1つのときだけにしたこと・発注者の決定）、3章3.の当たり分類・選択の規則・押下の分岐・範囲選択の流れ・クリックの解釈、2章の頂点の選択、1章の「存在しないもの」とテストの一覧、4章の`VectorModel.js`・`InputTracker.js`・`PressActionRules.js`・`SelectionRules.js`・`VertexHandleRules.js`・`test/`の各ファイル（`_doc/arch/`）を対象にする。
        *   **前半の資料にある「最大1つしか入らない」「1つだけ選ぶ」「本体の上・空白の押下は何も始めない」といった記述は、本作業の実態に合わせて直す**（誤った記述を残さない）。
        *   記載基準（残す：責務と境界・依存方向・流れと順序の保証・誰が呼ぶか・設計判断の理由・やらないと決めたこと／書かない：1つのファイルのJSDocを読めば分かること）に従う。実コードと食い違う記述を作らないこと（迷ったら実コードを確認する）。
        *   **この最終タスクのみ、実装AIによる開発資料の書き換えを明示的な例外として認める**。個別の実装タスク内では書き換えない。
        *   本RESファイルの「4. 詳細作業内容」の該当見出しへ作業内容を記載し、タスクリストのチェックを`[x]`にする。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1 頂点の選択の状態に2つ以上の組が入ることをテストで固める
*   **作業内容** :
    *   `test/core/VectorModel.selectedVertices.test.js` の末尾へ4ケースを追加（既存ケース・`setup`は不変、`VectorModel.js`は無変更）：4組の置き換えで並び保持＋通知1回／同じ図形の複数の頂点／同じ組の重ねで最初の位置に1つ／選択集合が複数のまま一部の図形が外れたとき落ちる組と残る組（並び保持・通知1回）。当該テストファイルは全件合格。

### タスク2: 要件2 複数の頂点の座標をまとめて更新するメソッド（`updateVertices`）
*   **作業内容** :
    *   `js/core/VectorModel.js`：`updateVertices(updates)`を`updateVertex`の直後に追加（存在しないidは無視・1件以上更新で通知1回・空配列は何もしない・引数は書き換えない）。`updateVertex`は`updateVertices([{...}])`へ委譲する形に変更（JSDocに委譲と`setVertex`の呼び出し箇所が1か所であることを記載）。クラス先頭の責務定義は変更不要。
    *   `test/core/VectorModel.updateVertices.test.js`（新規）：8ケース（複数図形・同一図形の複数頂点・混在・全て不在・空配列・引数不変・`updateVertex`の従来動作と不在id）。`node --test`全件合格（1377件）。

### タスク3: 要件3 頂点の選択のモードの押下の判定表（`resolveVertexPressAction`）
*   **作業内容** :
    *   `js/core/PressActionRules.js`：typedef `VertexPressAction`と`resolveVertexPressAction(hit, isVertexSelected, additive)`を末尾へ追加（表の順どおり。`isVertexSelected`は`hit.handle`があるときだけ1回。`marquee`は毎回新規、`target`は`hit.handle`そのもの）。既存の`resolvePressAction`・`PressAction`・`MOVE_HANDLE_NAME`は無変更。`test/core/PressActionRules.test.js`：importに追加し、補助関数と8ケースを末尾へ追加。`node --test`全件合格（1385件）。監査後の修正：ファイル先頭の責務定義を「選択モードと頂点の選択のモードのそれぞれで、押下時の当たり分類の結果から何の操作を始めるかを決める判定表を、状態を持たない関数として提供する」に書き直した（2行、「引数を書き換えない。importなし・DOMなし。」は維持）。テスト「同じ図形の別の頂点・別の図形の同名の頂点は選ばれていない扱い」は実際の検証内容（別の図形の同名の頂点）に合わせて名前を「別の図形の同名の頂点は選ばれていない扱い」へ直した。

### タスク4: 要件4 頂点の選択の変更の規則（クリック・範囲選択）
*   **作業内容** :
    *   `js/core/SelectionRules.js`：typedef `VertexSelectionChange`、非公開の補助`isSameVertex`（図形idとハンドル名の両方一致）、`resolveVertexClickSelection`・`resolveVertexMarqueeSelection`を末尾へ追加（分岐は要件4どおり）。既存の3関数・`SelectionChange`は無変更。ファイル先頭の責務定義を図形と頂点の両方を扱う内容に書き直した（3行以内）。
    *   `test/core/SelectionRules.test.js`：importへ2関数を追加し、補助`v`と頂点用ケースを末尾へ追加（既存20件は不変）。`node --test`全件合格。
    *   監査後の修正：テストファイル2行目の責務コメントを「図形と頂点の、クリック・範囲選択の次の選択と図形の選択の反転の規則」へ直した（3行以内）。『開発資料の更新予定』欄へ、1章`SelectionRules.js`の一行説明の修正項目と、`27_SelectionRules.md`冒頭の責務の一文の更新を追記した。

### タスク5: 要件5 範囲に入った頂点を集める規則（`collectVertexHandlesInRect`）
*   **作業内容** :
    *   `js/core/VertexHandleRules.js`：`collectVertexHandlesInRect(shapes, selectedIds, minX, minY, maxX, maxY)`を末尾へ追加（選択中の図形だけ・描画順→ハンドル名の順・`null`は飛ばす・境界を含む・毎回新しい配列）。既存の`collectVertexHandles`・`isVertexHandle`は無変更で、走査は共有していない。JSDocに、正規化済み矩形を受け取る前提・境界を含むこと・対象が選択中の図形だけであること・`intersectsRect`を使わない理由を記載。importは`OperationMode`のみのまま。**ファイル先頭の責務定義**を「頂点のハンドルの一覧、ハンドル名が頂点のハンドルかの判定、範囲に入る頂点を集めること」を提供する内容へ書き直した（2行）。
    *   `test/core/VertexHandleRules.test.js`：importへ追加し、`describe('collectVertexHandlesInRect')`に9ケースを末尾へ追加（既存8件は不変）。`node --test`全件合格（1410件）。
    *   **監査後の修正**：`test/core/VertexHandleRules.test.js`へ`test('弧は0件')`を追加（`new Ellipse(..., 'arc')`で選択しても0件）。ファイル先頭の責務定義を「一覧・ハンドル名の判定・範囲に入る頂点を集めること」へ更新（2行）。

### タスク6: 要件6 範囲選択の確定に頂点の選択の枝を足す（`#commitMarquee`）
*   **作業内容** :
    *   `js/core/InputTracker.js`：importへ`collectVertexHandlesInRect`・`resolveVertexMarqueeSelection`を追加。非公開メソッド`#applyVertexSelectionChange`を`#applySelectionChange`の直後に追加（受け渡しのみ）。`#commitMarquee`の正規化の後に`currentMode === OperationMode.VERTEX`の枝（収集→`clearSelectionRect`→規則→反映→`return`）を追加。
    *   JSDoc：`#commitMarquee`へ頂点の選択のモードの枝・正規化が1箇所であること・通知回数を追記。ファイル先頭の責務定義の「結果の反映は#applySelectionChangeが受け渡す」の括弧へ、頂点の範囲選択の収集・規則の委譲と`#applyVertexSelectionChange`を追記。
    *   枝はタスク7まで通らない（計画どおり）。`node --test`全件合格を確認。

### タスク7: 要件6 押下の配線と作業用フィールド（`handleMouseDown`・`#beginLeftDrag`・`#finishLeftDrag`）
*   **作業内容** :
    *   `js/core/InputTracker.js`：`resolveVertexPressAction`をimport。作業用フィールド`#vertexDragOrigins`を`#unitSnapHandleOrigin`の直後に追加（JSDocに型・意味・寿命・押下時に1回だけ求めること）。
    *   `handleMouseDown`の頂点の選択のモードの枝を`resolveVertexPressAction`の結果（`dragSelectedVertices`／`selectVertexAndDrag`／`marquee`／`null`）での振り分けに置き換えた。選択モードの枝・パン・早期`return`は変更なし。
    *   `#beginLeftDrag`：`DRAGGING_HANDLE`で、`getSelectedVertices()`に`target`があればその全体、無ければ`[target]`について図形を引き、`getHandlePosition`・`getVertexIndexForHandle`を押下時に1回求めて`#vertexDragOrigins`へ記憶（図形なし・位置なしの組は飛ばす。アンカーは位置なしでも残し`x`・`y`は`null`）。`#unitSnapHandleOrigin`はアンカーの位置から設定。端点への吸い付きの解決は記憶した組が1つのときだけ。`DRAGGING_HANDLE`以外では`#vertexDragOrigins`を空配列にする。
    *   `#finishLeftDrag`：`#vertexDragOrigins`を空配列に戻す（`commitEdit()`→`#resetSnapState()`の順は不変）。
    *   JSDoc：`handleMouseDown`・`#beginLeftDrag`・`#finishLeftDrag`・フィールド`activeHandle`（頂点インデックスの解決が押下時へ移ったこと）・クラス先頭の責務定義（頂点の複数選択とまとめ移動を追記）を書き直した。
    *   追従はまだアンカー1点のみ（タスク8でまとめ移動）。`#vertexDragOrigins`は追従でまだ未使用（計画どおり）。`node --test`全件合格（1411件）。

### タスク8: 要件6 追従（まとめ移動。`#applyLeftDragUpdate`）
*   **作業内容** :
    *   `js/core/InputTracker.js`：`#applyLeftDragUpdate`の`DRAGGING_HANDLE`を、図形の早期`return`→`#vertexDragOrigins`からアンカーの組を引く（無ければ`return`）→アンカーの行き先を従来どおり求める→移動量（`#unitSnapHandleOrigin`が`null`なら0）→アンカーは行き先そのもの・ほかは`押下時の位置＋移動量`で更新配列（`{id, vertexIndex, x, y}`）を作り`model.updateVertices`へ1回で渡す、に直した。追従での`getVertexIndexForHandle`呼び出しを廃止し記憶値へ置換。
    *   JSDoc：`#applyLeftDragUpdate`をまとめ移動・アンカーに足し算を通さないこと・通知1回・端点への吸い付きは1頂点のみ・`Shift`不使用に合わせて書き直した。`#vertexDragOrigins`の`vertexIndex`の型を`(number|null)`へ修正。`activeHandle`のJSDocはタスク7で直済みで追従の実装と一致。
    *   `node --test`全件合格（1411件）。

### タスク9: 要件6 クリック（`handleClick`の`Ctrl`の約束）
*   **作業内容** :
    *   `js/core/InputTracker.js`：`resolveVertexClickSelection`をimportに追加。`handleClick`の頂点の選択のモードの枝を、`Ctrl`（`hasCtrlModifier(event)`）を読み、頂点のハンドル上→`resolveVertexClickSelection`の結果を`#applyVertexSelectionChange`へ（図形の選択は変えない）／ハンドル上でなく`Ctrl`あり→`resolveClickSelection(選択集合, bodyId, true)`を`#applySelectionChange`へ（頂点の選択は空にしない）／`Ctrl`なし→`clearSelectedVertices()`の後に`resolveClickSelection(..., false)`、に直した。選択（`V`）・図形作成・`DRAWING`・`consumeSuppressedClick()`は変更なし。
    *   JSDoc：`handleClick`の頂点の選択のモードの段落を判定の順・`Ctrl`を見る時点・図形の選択を変える／変えない場合・落とす頂点・通知回数に合わせて書き直し、`Ctrl`＋選択中の頂点の押下→閾値以内で離すとこの`click`で外れること（正しいふるまい・ガード処理を足さない・閾値超過は`consumeSuppressedClick()`で抑止）を図形側と同じ書き方で書き残した。
    *   `node --test`全件合格（1411件）。開発資料：既存の更新予定（3章「クリックの解釈」）で足りるため追記なし。

### タスク10: 要件7 表示とカーソルを変える必要があるかを実コードで確かめる
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク11: 仕上げの確認（JSDoc・不要なコード・全テスト）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク12: 要件8 テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク13: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント

* **頂点を1つだけ選んだときの同一性**：まとめ移動の式は「アンカーの押下時の位置からの移動量を、選んでいる各頂点の押下時の位置へ足す」だが、**アンカー自身には足し算を通さずアンカーの行き先そのものを渡す**設計にしている（`origin + (target − origin)`は浮動小数では`target`と厳密に一致しないため）。1頂点のときの結果を前半と完全に一致させるための要の点なので、実装時に崩さないこと。
* **アンカーの押下時の位置が得られない場合**：`getHandlePosition`が`null`を返す場合（ハンドル名の契約上は起きない）、移動量を求められないため0として扱い、アンカーだけがカーソルへ追従する（ほかの頂点は動かない）。従来の1頂点のふるまい（丸めずカーソル位置）を保つための退避の経路で、通常は通らない。
* **頂点インデックスを押下時に1回だけ求めること**：追従のたびの`getVertexIndexForHandle`の呼び出しが無くなる。ドラッグ中に図形が入れ替わる経路（結合は離したとき、取り消し・やり直しはドラッグ中は不受理）は無いため問題にならない見込みだが、実装時に`#beginLeftDrag`以降で図形が入れ替わる経路が無いことを再確認したい。
* **`InputTracker`の行数**：本作業で頂点の選択の配線が増えるため、1445行からさらに増える（再分離は行わない＝REQの「やらないこと」）。資料の行数の記録はタスク13で更新する。
* **自動テストで確かめられない範囲**：`InputTracker`の配線（押下の振り分け・まとめ移動・範囲選択の確定・クリックの`Ctrl`）は`DragTracker`・DOMに依存するため`node --test`で確かめられない。規則（`PressActionRules`・`SelectionRules`・`VertexHandleRules`）と`VectorModel`の`updateVertices`はテストで確かめ、配線はタスク12のテストプレイで確かめていただきたい。
* **通知（再描画）の回数**：頂点の選択のモードのクリックで図形の本体・空白を`Ctrl`なしで押すと、前半どおり頂点の解除と選択集合の変更で通知が2回出る（見た目・結果に違いは無い。1回にまとめるには`VectorModel`へ専用のメソッドが要る）。本作業では前半の約束を変えない。`Ctrl`ありの本体のクリックでは頂点を解除しないため通知は1回になる。
* **`Ctrl`＋選択中の頂点の押下（不整合に見えるが正しい組み合わせ）**：押下の判定表（要件3）の1行目により、`Ctrl`を押していても「選ばれている頂点」を押せばドラッグが始まる。そのまま閾値以内で離すと、クリックの規則（要件4。`Ctrl`あり・当たった頂点が選択中→外す）により**その頂点が選択から外れる**。これはREQどおりの正しいふるまいであって不整合ではない（図形側も同じで、実コードのJSDoc（`js/core/InputTracker.js`の`handleClick`）に明記されている）。**実装時にガード処理（押下で`Ctrl`を見て分岐を変える・`click`を抑止する等）を足さないこと。** 頂点側も同じ趣旨をJSDoc（タスク9）と開発資料（タスク13）へ書き残し、後から読む者が「不整合だ」と誤解して直してしまう事故を防ぐ。
* **`collectVertexHandlesInRect`と`collectVertexHandles`の走査を共有しないこと**：2つの関数は「`selectedIds`をSetにして図形の並びを辿り、`getVertexHandleNames()`の順に`getHandlePosition(name)`を読み、`null`を飛ばす」までが同じに見えるが、集める条件・戻り値の形（図形ごとのまとまり＋`selected`付き／組の平らな配列）が違い、共通化するとコールバック渡しになって**既存の`collectVertexHandles`の本体を書き換えることになる**ため、括らない方を採る（要件5の「既存のふるまいを変えない」を優先）。REQ:184の「同じ判定表・同じ比較の条件を2か所に書かない」に当たる部分（矩形に入るかの判定・頂点の同一性の比較）は重複しない。将来、戻り値の形がそろう変更（変形のPhase等）が入るなら、その時点で括り直しを検討する。
* **範囲選択で頂点が0件のとき**：`Ctrl`なしの範囲選択は0件でも置き換える（頂点の選択が空になる）。`Ctrl`ありの0件は選択を変えない。図形用の範囲選択と同じ約束で、REQの要件4のとおり。
* **タスク6（`#commitMarquee`の頂点の枝）**：タスク7まで頂点の選択のモードで範囲選択が始まらないため、新しい枝は未到達（計画どおり）。目視確認はタスク7以降で行う。ファイル先頭の責務定義の括弧へ頂点の範囲選択の委譲を追記した。`InputTracker.js`の1章の一行説明は、タスク6の範囲では影響なし（全体の見直しは最終タスクで判断）。
* **タスク7（押下の配線）**：頂点の選択のモードで範囲選択が始まるようになったため、タスク6の確定の枝が通る。目視確認はタスク8・9の後にまとめて行うのが望ましい。`#beginLeftDrag`で図形が見つからないアンカーは記憶されず`#unitSnapHandleOrigin`は`null`のままで、このとき端点の解決も行わない（追従は図形が無ければ何もしない）。
* **タスク8（追従）**：アンカーの組が`#vertexDragOrigins`に無い（図形が無い等）ときは何もしない。ほかの頂点の`x`・`y`は位置が得られた組だけが入るため`null`にならない。複数頂点の目視確認はタスク9の後に。`#vertexDragOrigins`の更新配列のキーは`updateVertices`の仕様どおり`id`。
* **タスク9（クリック）**：`Ctrl`＋選択中の頂点を押して閾値以内で離すと選択から外れるのは仕様どおり（ガード無し）。頂点の選択のモードのクリックで、頂点上の`Ctrl`なしは頂点を単一選択へ置き換える（前半と同じ）。目視確認（`Ctrl`クリックでの追加・解除、`Ctrl`＋本体クリックでの図形の追加・解除）は発注者のテストプレイで。
