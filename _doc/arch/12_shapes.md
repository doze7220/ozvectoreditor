*   **shapes/**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換を担う。図形クラスが扱う座標はすべてワールド座標で、オフセットは渡されない。内部実装は各ファイルのJSDocを参照。共通基底クラスは無い。図形クラスの間で共通の幾何の計算と図形データの検証は、共通モジュールの関数を呼ぶ（継承ではなく関数の切り出し。2026-11-09 発注者の決定）。
    *   **共通モジュール**（`ShapeGeometry.js`・`ShapeDataValidation.js`）：状態を持たない`export`した関数のみで、クラスにしない。
        *   `ShapeGeometry.js`：`distanceToSegment`（点と線分の距離）・`segmentIntersectsRect`（線分と矩形の交差）・`quadraticBezierPoint`（2次ベジェの点）。`ShapeDataValidation.js`：`validateShapeData`（`fromJSON`の共通項目の検証と、キーが無い項目の既定値の解決。検証に通った`{ strokeColor, strokeWidth, fillColor }`を既定値解決済みの新しいオブジェクトとして返し、`data`は書き換えない。各図形クラスの`fromJSON`はこの戻り値をコンストラクタへ渡す）。検査の順序は`strokeColor` → `strokeWidth` → `fillColor`。`strokeWidth`のキーが無ければ2px（非公開定数`DEFAULT_STROKE_WIDTH`の`shapes/`内の唯一の定義。`io/SpriteSerializer.js`の同名の定数と同じ値であるべき別の定義）。`fillColor`のキーが無ければ`null`。
        *   **JSDocの食い違い（JSDocが直るまでの正しい記述）**：`ShapeDataValidation.js:18`の`DEFAULT_STROKE_WIDTH`のJSDocは「図形クラスのコンストラクタの`strokeWidth`の既定値（新しく描く図形の太さ）とは別の定義」と書くが、括弧内は実態と食い違う。新しく描く図形の既定の太さは`core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE.strokeWidth`が決め、図形クラスのコンストラクタの既定値は引数を省略して生成したときの値（新しく描く図形の太さを決めない）。「コンストラクタの既定値とは別の定義」という点自体は正しい。正しい位置づけは`PROJECT_ARCHITECTURE.md`2章「線の太さ2pxの4つの定義と位置づけ」。`shapes/`を変更する後続の作業で直す。
        *   `import`するのは`shapes/`の図形クラスのみ（`core/`・`io/`等からは使わない）。共通モジュールは`shapes/`の外および互いを`import`しない。
        *   式を変えると複数の図形の当たり判定・検証が同時に変わるため、変えるときは`test/shapes/`の全テストを確かめる。
        *   置き換えなかった重複（やらないと決めたこと）：`Ellipse.#distanceToOutline`は`Math.hypot`版の点と線分の距離を自前で持つ（`distanceToSegment`と式が異なり、統一すると値が変わり得るため）。`Curve`の分割数・サンプリングのループ・早期棄却は`Curve`側にある（`hitTest`の分割数`100`の直書きと`CURVE_INTERSECT_SEGMENTS`の違いも残っている）。
    *   **PathJoinRules.js**：図形をまたぐ規則（結合）。図形クラスではなく、共通モジュールとも異なる第3の種類。状態を持たない`export`した関数と定数のみ。流れは3章11.、規則の詳細の正本はJSDoc。
        *   **公開**：`JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin`。Phase 05-04の追加：`buildJoinedPathAt`・`buildExtendedPath`・`canCloseByMergingEnds`・`planDrawnLineJoin`・`planEndpointDragJoin`、typedef`EndpointRef`。
        *   **読むもの**：図形の`type`・公開プロパティ`id`・`toJSON()`の図形データだけ。図形クラスの内部プロパティを読まない。importは`./Path.js`のみ（共通モジュールはimportしない。結果は`Path`のコンストラクタで作る）。
        *   **使う側**：`edit/PathJoiner`・`edit/EndpointSnapper`・`shapes/EndpointSnapRules`（`core/`は使わない。`InputTracker`は`EndpointSnapper`を注入で呼ぶ）。図形クラスは使わない。
        *   **知らないこと**：表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式（idは不透明な値として読み写すだけ）。許容距離はワールドの長さで引数に受け取る。`try/catch`を持たない。結果は元の図形と配列・頂点を共有しない。
        *   **結果の塗り**：結果の`fillColor`は基準の線A（描き足し・閉じるは元の線）のもの（`toJSON()`の図形データから読む）。開いたパスを閉じると塗れる形になり持っていた塗りが現れる。直線の`fillColor`は描かれないが結果のパスに引き継がれる。
        *   **注意**：`JOIN_TOLERANCE_SCREEN_PX`と`InputTracker`の`hitTolerance`は同じ5pxだが別の定義（どちらを変えても他方は変わらない）。頂点の並べ方・まとめ方は非公開の組み立て関数が共有しているため、規則を変えると`buildJoinedPath`・`buildJoinedPathAt`・`buildExtendedPath`が同時に変わる（`test/shapes/PathJoinRules.test.js`の全ケースで確かめる）。`planDrawnLineJoin`の`startSnap`/`endSnap`は`null`で渡す前提（`undefined`は未対応。`planEndpointDragJoin`の`snap`のみ`undefined`も`null`として扱う）。同じ線を閉じる計画は`planDrawnLineJoin`と`planEndpointDragJoin`が非公開の`planCloseOf`で共有する。
    *   **EndpointSnapRules.js**：図形をまたぐ規則（端点への吸い付き）。`PathJoinRules`と同じ第3の種類で、状態を持たない`export`した関数と定数のみ。流れは3章12.、規則の詳細の正本はJSDoc。
        *   **公開**：`SNAP_TOLERANCE_SCREEN_PX`・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`、typedef`SnapTarget`。
        *   **読むもの**：図形の`type`（`isJoinableLine`経由）・公開プロパティ`id`・`toJSON()`・`getVertexIndexForHandle`。importは`./PathJoinRules.js`のみ（`isJoinableLine`・`canCloseByMergingEnds`）。
        *   **使う側**：`edit/EndpointSnapper`のみ。
        *   **知らないこと**：表示倍率・`ViewTransform`・`VectorModel`・履歴・DOM・操作モード・idの形式。許容距離はワールドの長さで引数に受け取る。`try/catch`を持たない。
        *   **注意**：`resolveEndpointHandle`は「頂点の番号`i`＝図形データの`points[i]`」に依る。結合できる線の種類を足すとき、`Line`・`Path`の頂点の番号の約束を変えるときは見直す。`SNAP_TOLERANCE_SCREEN_PX`（8）は`JOIN_TOLERANCE_SCREEN_PX`（5）とも`hitTolerance`とも別の定義。
    *   **14メソッド契約（公開メソッドの一覧）**：`draw(ctx, t)`、`drawHandles(ctx, viewScale = 1)`、`drawHover(ctx, viewScale = 1)`、`hitTest(x, y, tolerance)`、`hitTestHandle(x, y, tolerance)`、`setVertex(vertexIndex, x, y)`、`translate(dx, dy)`、`updateDraftEnd(x, y)`、`getVertexIndexForHandle(handleName)`、`intersectsRect(minX, minY, maxX, maxY)`、`toDrawElement()`、`toJSON()`、`static fromJSON(data)`、`isFillable()`。
        *   `Line`/`Curve`/`Rect`/`Ellipse`/`Path`はいずれもこの14メソッドを自律実装する。
        *   **`isFillable()`**：塗れる形かの真偽値（データに保存しない）。`Line`・`Curve`は常に`false`、`Rect`は常に`true`、`Ellipse`は`type === 'circle'`（弧は`false`）、`Path`は`closed === true`。塗れるかの規則はこのメソッドだけに置く。Phase 06-02で`edit/StylePanelRules`・`edit/ShapeStyleEditor`（プロパティパネルの塗りの欄）が外から使っている。06-03（内側の当たり判定）でも使う予定。コンストラクタの既定値（`strokeWidth = 2`等）は引数を省略したときの値で、新しく描く図形のスタイルは`VectorModel.startDraft`が直前に使った値（2章）で当てる（図形クラスは関与せず、06-02でも`shapes/`は変更していない）。
        *   **`draw`の描き方（5クラス共通の順序）**：`shouldFill = this.isFillable() && typeof this.fillColor === 'string'`、`shouldStroke = typeof this.strokeColor === 'string'`。どちらも偽なら何も呼ばずに`return`（`beginPath`も呼ばない）。形のパスを組み立て → `shouldFill`なら`fillStyle` → `fill()`（引数なし＝nonzero）→ `shouldStroke`なら`strokeStyle` → `lineWidth` → `stroke()`。判定の2行は各クラスに書く（`draw`は自律実装で、共通モジュールは幾何と検証に限るため）。**`io/CodeExporter.js`の`DRAW_SOURCE`と命令・引数・順序を揃えること**（塗れる形の要素だけが`closed === true`かつ`fillColor`が文字列になり得るため、両者の条件は同じ結果になる）。一致は`test/io/CodeExporter.test.js`で確かめる。
        *   `fillColor`は塗れない形でも保持する（`toJSON`は保持している値をそのまま出す）。`toDrawElement()`の`fillColor`は`this.isFillable() ? this.fillColor : null`（塗れない形は`null`）。
        *   `draw`のシグネチャの例外：`Line`は`t`を持たず`draw(ctx)`。他4クラス（`Path`を含む）は`draw(ctx, t = 0)`だが`t`は未使用で、どの呼び出し元からも渡されない。
        *   新規図形を追加する際はこの契約を満たすこと。満たせば`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）・`io/`を変更せずに作成・選択・範囲選択・再編集・作業データの変換/復元フローへ組み込める（`ShapeFactory`の対応表への登録とボタンは必要。読み込み専用の種別（`create: null`）はボタン不要。4章`ShapeFactory.js`）。ただしスプライトの出力は、`toDrawElement`の戻り値を既存の`kind`で表せない場合は`io/`の`SpriteSerializer`・`CodeExporter`も変更が要る。新しい図形クラスは、幾何の計算（点と線分の距離・線分と矩形の交差・2次ベジェの点）と`fromJSON`の共通項目の検証に共通モジュールの関数を使い、図形クラスへ複製しない。図形種別を追加したら`test/shapes/<クラス名>.test.js`へ当たり判定と`fromJSON`のエラー文のテストを、`test/io/DocumentSerializer.roundtrip.test.js`へ往復のケースを、`test/io/SpriteSerializer.test.js`・`test/io/CodeExporter.test.js`へスプライトのケースを足す。
        *   各図形クラスのクラスJSDocは契約（`isFillable`を含む14メソッド）を列挙している。メソッドを増減する場合は`Path`を含む5クラスのクラスJSDocも更新する。
    *   **ハンドル名の契約**（シグネチャだけでは満たせない）：
        *   移動ハンドルの名前は文字列`'move'`固定（`InputTracker`がこの名前で分岐する）。
        *   `'move'`以外のハンドル名は、`getVertexIndexForHandle`で有効な番号に解決できなければならない。解決できないと`null`のまま`setVertex`へ渡り、エラーなしでドラッグが無反応になる。
    *   **`intersectsRect`**：範囲選択用の交差判定。引数はワールド座標の正規化済み（min ≤ max）軸平行矩形（境界を含む）。描画されている輪郭線の中心線（`strokeWidth`は含めない）が一部でも掛かれば`true`。塗り内部は判定しない。`Line`・`Rect`・`Path`は線分の厳密判定、`Curve`・`Ellipse`は輪郭を100分割した折れ線による近似判定。`Ellipse`の弧は描画されている弧部分のみが対象。
    *   **`toDrawElement()`**：スプライト（書き出し形式。2章）の描画要素を返す。戻り値は2章「描画要素」（`polyline`・`quadratic`・`ellipse`。`Line`・`Rect`・`Path`は`polyline`、`Curve`は`quadratic`、`Ellipse`は`ellipse`）。毎回新しいオブジェクト・頂点を作り、内部配列・頂点を共有しない。値は`draw`と同じ式で求める（`Ellipse`の`points`の約束・角度が`type`から決まること等の内部の約束を図形クラスの外へ出さないため）。呼び出し元は`SpriteSerializer`のみ（`core/`は呼ばない）。`Ellipse`の種別による分岐は、`closed: this.type === 'circle'`と、`isFillable()`（`type`で決まる）を通した`fillColor`の2箇所。`draw`の式を変えたら`toDrawElement`・`io/CodeExporter.js`の描画処理・`test/io/CodeExporter.test.js`を揃える。
    *   **`viewScale`**：`drawHandles`/`drawHover`の`viewScale`は表示倍率で、補助表示を画面上一定に保つため`÷ viewScale`で換算する。図形本体の`draw`は倍率を受け取らない（線幅は倍率に比例して表示される）。
    *   **`toJSON`/`fromJSON`**：
        *   どちらの方向でも内部配列・頂点オブジェクトを共有しない（`data`内の配列・オブジェクトも流用しない）。
        *   `fromJSON`は不正な入力で`Error`をthrowする（条件は各クラスの`@throws`。`strokeWidth`の0以下も不正：Canvasが0以下の線幅の代入を無視して直前の値を残すため。ただし`strokeWidth`のキーが無い（`undefined`）場合は不正ではなく2pxとして読む。`strokeColor`・`fillColor`は文字列または`null`のみ受理。ただし`fillColor`のキーが無い（`undefined`）場合は不正ではなく`null`として読む。`strokeColor`のキーが無い場合は不正）。
        *   `id`は検証せずそのまま保持する（正規化は`VectorModel.replaceAllShapes`の責務）。余分なプロパティは無視する。
        *   各図形クラス・`ShapeFactory`は`try/catch`を持たない（捕捉は`DocumentSerializer`）。
        *   往復（`toJSON`→`fromJSON`）で図形データの内容と描画・当たり判定の結果は一致する。
    *   **変換の変更時の注意**：
        *   `fromJSON`の共通項目の検証は`ShapeDataValidation.validateShapeData`が行う（エラー文のクラス名・受理する種別・頂点数を各図形クラスが引数で渡す。種別の文言は受理する種別の並びから作る）。共通項目の規則を変える場合はこの関数を変え、`test/shapes/`の全クラス（`Path`の`test/shapes/Path.test.js`を含む）のエラー文のテストを確かめる。
        *   `validateShapeData`の頂点数の引数は、数値（ちょうどその数）か`{ min }`（その数以上。`Path`が使う）。
        *   `Path.fromJSON`はコンストラクタが`data`の頂点を複製して生成し、区間を`data.segments`の`kind`から作り直す。パス固有の項目（`closed`・閉じたパスの頂点数・`segments`）は`Path`側で検証する（検査は共通項目の後）。
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
        *   `type`（`'circle'`|`'arc'`）で振る舞いも分岐する（`isFillable`も`type`で分岐：円は真・弧は偽）。開始角・終了角は`type`から決まる固定値のため図形データに保存しない（弧の角度編集を実装する際は保存対象へ加え、作業データ形式の版を上げる）。
        *   弧は画面の上半分を描く（`startAngle`=π、`endAngle`=2π。発注者の決定。ボタンの絵`◠`と揃えた）。`hitTest`・`intersectsRect`も同じ。`down`ハンドルは弧の線上にない。保存済みの弧の`points`は変換しないため、変更前に描いた弧も上半分に表示される（作業データ形式の版は変えていない）。
        *   回転は表現できない（回転角は0固定）。
        *   `hitTest`は他4クラス（`Path`を含む）と異なり`strokeWidth/2`を許容誤差に足す。
    *   **Path.js**：パス（折れ線）。頂点数可変の`points`・`closed`・`segments`で保持する（約束は2章「図形データ」）。`ShapeFactory.create`では作られない（読み込み専用。作る操作は結合・描き足し・閉じる（`PathJoinRules`がコンストラクタで作る。3章11.・12.）。
        *   `hitTestHandle`の戻り値は`'vertex-<i>'`（`<i>`は頂点の番号の10進表記・先頭の0なし）か`null`。番号の小さい順の先着1件。`move`ハンドルは持たない（本体のドラッグで移動）。`getVertexIndexForHandle`は`'vertex-<i>'`を範囲内の番号へ解決し、それ以外は`null`。`setVertex`は範囲外・整数でない番号では何もしない。`updateDraftEnd`は終点を動かす（現在は呼ばれない）。
        *   `hitTest`は`strokeWidth`を許容誤差に足さない。閉じたパスは終点→始点の区間も描画・当たり判定・範囲選択の対象。
        *   区間の要素数の不変条件は、頂点の追加・削除・閉じる/開く操作を足すときに保つこと。
        *   やらないと決めたこと／将来の注意：曲線の区間を足すときは、描画・当たり判定・範囲選択・`toDrawElement`のすべてで区間の種類による分岐が要り、`polyline`で表せなくなるため新しい`kind`と書き出し形式の版の判断（エンジンへの連絡票）が要る。
