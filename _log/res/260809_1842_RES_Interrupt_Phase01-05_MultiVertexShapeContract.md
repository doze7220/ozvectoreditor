# RES: 作業計画・作業レポート Interrupt : 3頂点図形（Curve）の作図・再編集フローにおけるvertexIndex意味不一致の解消
* 参照元REQ: `./_log/req/2609_1842_REQ_Interrupt_Phase01-05_MultiVertexShapeContract.md`

## 1. 作業目的
`Line`（2頂点）と`Curve`（3頂点）とで`vertexIndex=1`の意味が異なる（`Line`は終点、`Curve`は制御点）にもかかわらず、`core/`層（`VectorModel`/`InputTracker`）が「`vertexIndex=1`は常に終点」という`Line`前提の規約をハードコードしていたことに起因する、`Curve`特有の2件の不具合（作図中プレビューが正しく追従しない／終点ハンドルドラッグで制御点が動いてしまう）を解消する。

## 2. 実装内容
`core/`層に図形種別分岐を持ち込まない設計方針を維持したまま、`Line.js`/`Curve.js`双方に新規インスタンスメソッド2つ（`updateDraftEnd(x, y)`/`getVertexIndexForHandle(handleName)`）を追加し、`VectorModel.updateDraft`と`InputTracker.handleMouseMove`からはこれらをポリモーフィックに呼び出す形へ変更した。既存の`setVertex`シグネチャ・`hitTestHandle`の戻り値は無変更。

## 3. 対象ファイル
* `./js/shapes/Line.js` : 更新（`updateDraftEnd`/`getVertexIndexForHandle`の2メソッド追加）
* `./js/shapes/Curve.js` : 更新（同上2メソッド追加）
* `./js/core/VectorModel.js` : 更新（`updateDraft`内の委譲先変更、JSDoc更新）
* `./js/core/InputTracker.js` : 更新（`handleMouseMove`内の`DRAGGING_HANDLE`分岐の三項演算子撤去）
* `./PROJECT_ARCHITECTURE.md` : 更新（`Line.js`/`Curve.js`/`VectorModel.js`/`InputTracker.js`の各エントリへ反映）

## 4. 詳細作業内容
* **作業内容**:
  * **不具合1対応**:
    * `Line.js`に`updateDraftEnd(x, y)`を追加。内部で`this.setVertex(1, x, y)`を呼ぶのみ（終点をそのまま更新）。
    * `Curve.js`に`updateDraftEnd(x, y)`を追加。終点`points[2]`を`(x, y)`に更新し、制御点`points[1]`を「始点と新しい終点の中点」として再計算するロジックをREQ記載通りに実装。
    * `VectorModel.js`の`updateDraft(x, y)`内、`this.#draftLine.setVertex(1, x, y);`を`this.#draftLine.updateDraftEnd(x, y);`に置き換え、JSDocを「追従処理自体はshape.updateDraftEnd(x, y)へポリモーフィックに委譲する」旨に更新。
  * **不具合2対応**:
    * `Line.js`に`getVertexIndexForHandle(handleName)`を追加。`{ start: 0, end: 1 }[handleName] ?? null`のルックアップ実装。
    * `Curve.js`に`getVertexIndexForHandle(handleName)`を追加。`{ start: 0, control: 1, end: 2 }[handleName] ?? null`のルックアップ実装。
    * `InputTracker.js`の`handleMouseMove`内、`DRAGGING_HANDLE`状態かつ`activeHandle !== 'move'`の分岐を、`this.model.getShapes()`から対象図形を取得したうえで`shape.getVertexIndexForHandle(this.activeHandle)`を呼び出す形へ書き換え。`'start'|'end'`決め打ちの三項演算子は完全に撤去。
    * `activeHandle === 'move'`の分岐（`moveShape`呼び出し）は無変更。
  * **ドキュメント反映**: `PROJECT_ARCHITECTURE.md`の`Line.js`/`Curve.js`エントリに新規2メソッドの説明を追記し、`VectorModel.js`の`updateDraft`に関する記述、`InputTracker.js`の`vertexIndex`解決方法に関する記述をそれぞれ実態に合わせて更新した。
* **設計方針の遵守確認**: `VectorModel.js`・`InputTracker.js`のいずれにも`if (type === 'curve')`等の図形種別分岐は追加しておらず、すべて`shape.メソッド名(...)`の同一呼び出し規約でポリモーフィックに解決している。`ShapeFactory.js`・`WindowManager.js`・`PaletteController.js`・`main.js`は無改変。

## 5. 懸念事項・要確認ポイント
* 特になし。以下2点の目視確認をお願いします。
  * 「曲線」ツールで2クリック作図した際、1回目クリック後にマウスを動かすと終点（＝カーソル位置）まで直線状のプレビューが正しく追従し、2回目クリックで確定した`Curve`が意図通りの始点・終点になっていること。
  * 確定済み`Curve`を選択した状態で、正方形（終点）ハンドルをドラッグした際に終点のみが動き、ひし形（制御点）ハンドルをドラッグした際に制御点のみが動くこと（`Line`側の始点・終点ハンドル操作に回帰がないことも合わせて）。
