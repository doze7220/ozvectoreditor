*   **shapes/**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。図形クラスが扱う座標はすべてワールド座標で、オフセットは渡されない。内部実装は各ファイルのJSDocを参照。共通基底クラスは無い。
    *   **12メソッド契約（公開メソッドの一覧）**：`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`、`intersectsRect(minX, minY, maxX, maxY)`、`toJSON()`、`static fromJSON(data)`。
        *   `Line`/`Curve`/`Rect`/`Ellipse`はいずれもこの12メソッドを自律実装する。
        *   `draw`のシグネチャの例外：`Line`は`t`を持たず`draw(ctx)`。他3クラスは`draw(ctx, t = 0)`だが`t`は未使用で、どの呼び出し元からも渡されない。
        *   新規図形を追加する際はこの契約を満たすこと。満たせば`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）・`io/`を変更せずに作成・選択・範囲選択・再編集・作業データの変換/復元フローへ組み込める（`ShapeFactory`の対応表への登録とボタンは必要。4章`ShapeFactory.js`）。図形種別を追加したら`test/io/DocumentSerializer.roundtrip.test.js`へ往復のケースを足す。
        *   各図形クラスのクラスJSDocは契約を列挙している。メソッドを増減する場合は4クラスのクラスJSDocも更新する。
    *   **ハンドル名の契約**（シグネチャだけでは満たせない）：
        *   移動ハンドルの名前は文字列`'move'`固定（`InputTracker`がこの名前で分岐する）。
        *   `'move'`以外のハンドル名は、`getVertexIndexForHandle`で有効な番号に解決できなければならない。解決できないと`null`のまま`setVertex`へ渡り、エラーなしでドラッグが無反応になる。
    *   **`intersectsRect`**：範囲選択用の交差判定。引数はワールド座標の正規化済み（min ≤ max）軸平行矩形（境界を含む）。描画されている輪郭線の中心線（`strokeWidth`は含めない）が一部でも掛かれば`true`。塗り内部は判定しない。`Line`・`Rect`は線分の厳密判定、`Curve`・`Ellipse`は輪郭を100分割した折れ線による近似判定。`Ellipse`の弧は描画されている弧部分のみが対象。
    *   **`viewScale`**：`drawHandles`/`drawHover`の`viewScale`は表示倍率で、補助表示を画面上一定に保つため`÷ viewScale`で換算する。図形本体の`draw`は倍率を受け取らない（線幅は倍率に比例して表示される）。
    *   **`toJSON`/`fromJSON`**：
        *   どちらの方向でも内部配列・頂点オブジェクトを共有しない（`data`内の配列・オブジェクトも流用しない）。
        *   `fromJSON`は不正な入力で`Error`をthrowする（条件は各クラスの`@throws`。`strokeWidth`の0以下も不正：Canvasが0以下の線幅の代入を無視して直前の値を残すため）。
        *   `id`は検証せずそのまま保持する（正規化は`VectorModel.replaceAllShapes`の責務）。余分なプロパティは無視する。
        *   各図形クラス・`ShapeFactory`は`try/catch`を持たない（捕捉は`DocumentSerializer`）。
        *   往復（`toJSON`→`fromJSON`）で図形データの内容と描画・当たり判定の結果は一致する。
    *   **変換の変更時の注意**：
        *   検証ロジックは各図形クラスのprivate staticヘルパーとして個別に持つ（共通モジュールはない）。図形データの共通項目の規則を変える場合は4クラスすべてを追従させる。
        *   `Curve`・`Rect`・`Ellipse`の`fromJSON`はコンストラクタで仮生成した後に頂点を`data`の値で設定し直す（`Line`は最初から`data`の値で生成する）。将来コンストラクタに派生値の初期化等を加える場合は、頂点の差し替え後に整合が崩れないか確認する。
        *   図形データの形を変える場合は`DocumentSerializer`の版の追加手順（`MIGRATIONS`のJSDoc）に従う。
    *   **Line.js**：直線。`points`配列は持たず`x1, y1`=始点／`x2, y2`=終点で保持する。図形データでは`points`2点[始点, 終点]へ変換する。`hitTestHandle`の戻り値は`'start'|'end'|'move'|null`（`move`は中点）。
    *   **Curve.js**：2次ベジェ曲線。3頂点：`points[0]`=始点／`[1]`=制御点／`[2]`=終点。`hitTestHandle`の戻り値は`'start'|'end'|'control'|null`。`move`ハンドルは持たない。
    *   **Rect.js**：矩形。4頂点：`points[0]`=topLeft／`[1]`=topRight／`[2]`=bottomRight／`[3]`=bottomLeft。`hitTestHandle`の戻り値はこの4名か`null`。`move`ハンドルは持たない。
        *   コンストラクタは対角2点から4点を算出するのみで、矩形維持のための正規化は行わない（4隅の自由変形が可能）。`fromJSON`も4頂点を独立に採用する。
        *   `topLeft`等は論理名で、見た目の位置を保証しない（右下から左上へ作図すると`points[0]`は見た目の右下になる）。
    *   **Ellipse.js**：円・楕円・弧。5頂点：`points[0]`=中心／`[1]`=右端制御点／`[2]`=上端制御点／`[3]`=開始角制御点／`[4]`=終了角制御点（位置はJSDoc）。
        *   ハンドルと頂点は別物。`hitTestHandle`の戻り値は`'move'|'right'|'up'|'left'|'down'|null`。`getVertexIndexForHandle`は`right`/`left`→1、`up`/`down`→2。0を返すことはない。
        *   `setVertex`が受けるのは0〜2のみで、3・4は何もしない。`setVertex(1)`はyを、`setVertex(2)`はxを無視する。
        *   `type`（`'circle'`|`'arc'`）で振る舞いも分岐する。開始角・終了角は`type`から決まる固定値のため図形データに保存しない（弧の角度編集を実装する際は保存対象へ加え、作業データ形式の版を上げる）。
        *   弧は画面の上半分を描く（`startAngle`=π、`endAngle`=2π。発注者の決定。ボタンの絵`◠`と揃えた）。`hitTest`・`intersectsRect`も同じ。`down`ハンドルは弧の線上にない。保存済みの弧の`points`は変換しないため、変更前に描いた弧も上半分に表示される（作業データ形式の版は変えていない）。
        *   回転は表現できない（回転角は0固定）。
        *   `hitTest`は他3クラスと異なり`strokeWidth/2`を許容誤差に足す。
