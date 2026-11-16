# RES: 作業計画・作業レポート (Phase 08-02a) : 頂点の選択ツール（前半：ツールの追加と、頂点を1つずつ選んで動かす）
* 参照元REQ: `./_log/req/261116_1913_REQ_Phase08-02a_Vertex_Tool.md`

## 1. 作業目的

図形を選ぶツール（選択・`V`）と、図形の頂点を選ぶツール（頂点の選択・`A`）を分ける。本作業（前半）では、ツールの骨組みと「頂点を1つ選んで動かす」までを作る。

* 操作モードに「頂点の選択」を1つ足し、ツールパレットのボタン（`#tool-select`の次）とキー`A`で切り替えられるようにする。
* 選択（`V`）ではハンドルを出さない（描画・当たり判定の両方）。図形の移動は本体のドラッグで行う。
* 頂点の選択（`A`）では、選択中の図形の頂点のハンドルを描き、頂点を1つクリックで選び、ドラッグで動かせるようにする。移動は既存のハンドルのドラッグの仕組み（スナップ・端点への吸い付き・取り消し1件）にそのまま載せる。
* ツールパレットの選択・頂点の選択のアイコンを、本アプリの書き出し形式のスプライトJS（`asset/sprite/`）から`<canvas>`へ描く。

**最上位の要件**：リポジトリのルートの`node --test`が全件通ること。作業データ形式・書き出し形式・履歴の形を変えないこと（版はどちらも2のまま。頂点の選択は保存も履歴の対象化もしない）。図形の作成・パン・ズーム・スタイル・重なり順・結合・クリップボード・ファイル操作・表示の切り替え・スナップ・端点への吸い付きの既存のふるまいを変えないこと。改名・整形・「不要に見えるコードの削除」を行わないこと。

**複数の頂点を選ぶこと・まとめて動かすことは本作業では作らない**（後半）。

## 2. アーキテクチャ設計

### 共通の用語（本計画書・コード・資料で使い分ける）
* **スナップ**：座標・移動量を単位（1px／グリッド10px）の倍数へ丸めること（`core/UnitSnapRules`・`UnitSnapSettings`）。
* **端点への吸い付き**：直線を描くとき・線の端点のハンドルをドラッグするときに、結合できる線の端点へ吸い付くこと（`shapes/EndpointSnapRules`・`edit/EndpointSnapper`）。
* **ハンドル**：`hitTestHandle`が返す名前で表される操作点（`'move'`を含む）。
* **頂点のハンドル**：ハンドルのうち、`getVertexIndexForHandle`が頂点の番号を返すもの（本作業で足す一覧が正本）。

---

### 要件1: 操作モードとツールを足す

**`js/core/InputModes.js`**
* `OperationMode`へ`VERTEX: 'vertex'`を**1エントリだけ**足す（`'select'`・`'create'`・`'pan'`と重ならない）。既存の3つの値と`InputState`は変えない。
* JSDocの説明に`VERTEX`の1行（頂点の選択モード：選択中の図形の頂点を選んで動かす）を足す。`Object.freeze`は今のまま。

**`js/core/ToolRules.js`**
* `TOOL_IDS`を`[OperationMode.SELECT, OperationMode.VERTEX, OperationMode.PAN, EYEDROPPER_TOOL_ID, ...SHAPE_TYPES]`にする。
  識別子の約束（ツールの識別子は操作モードの値と同じ）を守るため、頂点の選択のツールの識別子は`OperationMode.VERTEX`そのものを使い、**新しい定数を定義しない**（定義箇所を増やさない）。
* `resolveActiveTool`に`if (mode === OperationMode.VERTEX) return OperationMode.VERTEX;`の分岐を、選択の分岐の次に足す。`picking`が真なら常にスポイト、という優先は変えない。
* `test/core/ToolRules.test.js`：並びの期待値（`['select', 'vertex', 'pan', 'eyedropper', ...SHAPE_TYPES]`）・`EYEDROPPER_TOOL_ID`の位置（3番目→4番目）・先頭が`SELECT`・`VERTEX`・`PAN`であることの既存ケースを直し、頂点の選択のモードの分岐のケースを足す。

**`index.html`**
* ツールパレットの先頭のまとまり（`.tool-palette-group`）の`#tool-select`の**次**に、`<button type="button" id="tool-vertex" class="tool-btn icon-btn" title="頂点の選択 (A)"></button>`を足す（中身は空。要件2の配線が`<canvas>`を入れる）。
* 既存の`#tool-select`の`title`（`選択 (V)`）・id・クラスは変えない。`aria-pressed`は付けない（押し込みは`.active`）。

**`js/core/KeyboardShortcuts.js`**
* `SHORTCUT_BINDINGS`の`KeyH`（`setMode`／`PAN`）の次に、`{ codes: ['KeyA'], ctrl: false, shift: ShiftRule.FORBIDDEN, repeatable: false, action: 'setMode', arg: OperationMode.VERTEX }`を足す。
* 既存の`Ctrl`+`A`（`selectAll`。`ctrl: true`）とは`ctrl`の値で排他的に分かれる（`KeyI`／`Ctrl`+`I`と同じ形。`#findBinding`は`binding.ctrl === ctrlPressed`で照合する）。
* 対応表の先頭のJSDocの修飾キー規則の説明に1行足す（`KeyA`は`ctrl`の値で`A`単体（頂点の選択モードへの切り替え）と`Ctrl`+`A`（全選択）に排他的に分かれる）。
* **新しいactionは足さない**（既存の`setMode`を使う）。`ShortcutActions`のtypedefは変えない。

**`js/main.js`**
* `applyMode`の引数のJSDocへ`'vertex'`を足す。
* `toolActions`へ`[OperationMode.VERTEX]: () => applyMode(OperationMode.VERTEX)`を、`SELECT`の次（`TOOL_IDS`と同じ並び）に足す（表引きであり判定ではない）。これが無いとパレットのボタンが働かない。
* `ensureSelectMode`は**今のまま**（全選択・貼り付け・選択の反転・スポイトの開始は、頂点の選択のモードからでも選択モードへ切り替わる）。
* `SnapshotAdapter`へ注入する`shouldRestoreSelection`を
  `() => inputTracker.getMode() === OperationMode.SELECT || inputTracker.getMode() === OperationMode.VERTEX`
  にする（取り消し・やり直しで図形の選択が戻る）。`edit/SnapshotAdapter.js`は変更しない。

**不変条件の更新**：「選択集合は選択モード以外では空」を「選択集合は選択モード・頂点の選択モード以外では空」にする。`InputTracker.setMode`は今までどおり切り替えのたびに無条件で選択集合をクリアするため、`V`⇄`A`の切り替えで選択は解除される（要件7の「`setMode`の既存のふるまいを変えない」）。

---

### 要件2: ツールのアイコンを、仮のスプライトJSから描く

**`asset/sprite/`（新規フォルダ）**
* `select-arrow.js`（黒い矢印＝選択）と`vertex-arrow.js`（白い矢印＝頂点の選択）の2本。
* **本アプリの書き出し（`js/io/CodeExporter.toModuleText`）で実際に生成したテキストを置く**。生成は1回限りの手作業で、ビルド手順・生成スクリプトをリポジトリへ残さない（作業用のスクリプトは一時フォルダに置いて使い捨てる）。
* 生成の手順（Node.js。`node --test`とは別に1回だけ実行する）：
  1. `js/shapes/Path.js`の`Path.fromJSON(図形データ)`で矢印の閉じたパスを1つ作る。
  2. `js/io/SpriteSerializer.js`の`SpriteSerializer.serialize([shape])`でスプライトデータを作る。
  3. `js/io/CodeExporter.js`の`CodeExporter.toModuleText(spriteData)`でJSのテキストを作り、`asset/sprite/<名前>.js`へ書く。
* 矢印の図形データ（手で用意してよい部分）。`Path.fromJSON`は`type`・`points`・`closed`・`segments`（要素数と各要素の`kind`）を検証するため、**渡すJSONの全キーを次のとおりにする**（1つでも欠けると例外になる）：
  * `type`: `'path'`
  * `id`: `'shape-1'`（`fromJSON`は検証せずそのまま保持する。`toJSON`の往復のため）
  * `points`（**7頂点**）: `[{x:0,y:0},{x:0,y:16},{x:4.2,y:12.2},{x:6.6,y:17.6},{x:9.2,y:16.5},{x:6.9,y:11.3},{x:11.5,y:11.3}]`
  * `closed`: `true`
  * `segments`: 閉じたパスなので**要素数7**（開いたパスなら頂点数−1）。各要素は`{ kind: 'line' }`
  * `strokeColor`・`strokeWidth`・`fillColor`: 2本で値を変える
    * 選択（黒い矢印）：`strokeColor: null`・`strokeWidth: 2`・`fillColor: '#000000'`
    * 頂点の選択（白い矢印）：`strokeColor: '#000000'`・`strokeWidth: 1`・`fillColor: '#ffffff'`（Photoshopと同じ色の約束）
* 書き出し形式の版は2のまま、作業データの版も2のまま。

**`js/core/SpriteFitRules.js`（新規。`core/`の状態を持たない規則）**
* 公開：`computeSpriteFitTransform(bounds, width, height, padding = 0)` → `{ scale: number, offsetX: number, offsetY: number }` または `null`。
* スプライトの外枠（`bounds`）と描画先の大きさ・余白から、外枠を余白の内側へ収めて中央に置くための倍率と平行移動を求める（`スクリーン = ワールド × scale + offset`。`core/ViewTransform`・`ViewFitRules`と同じ向きの定義）。
* 規則：
  * `bounds`が`null`・オブジェクトでない・4つの値が有限でない・`minX > maxX`／`minY > maxY`なら`null`。
  * `width`・`height`が有限の正の数でない、または`padding`が有限の0以上の数でない、または余白を引いた領域（`width - padding*2`・`height - padding*2`）が0以下なら`null`。
  * 外枠の幅・高さが0の軸は倍率の制約にしない（両方0＝点なら`scale = 1`）。それ以外は`scale = min(使える幅 / 外枠の幅, 使える高さ / 外枠の高さ)`（軸が片方だけ0ならもう一方だけで決める）。拡大も行う（上限・下限は設けない）。
  * `offsetX = padding + (使える幅 - 外枠の幅 * scale) / 2 - minX * scale`、`offsetY`も同様。
* 状態・DOMを持たず、何もimportしない（`asset/`のファイルもimportしない）。引数を書き換えず、戻り値は毎回新しいオブジェクト。
* テスト：`test/core/SpriteFitRules.test.js`（新規）。

**`js/wiring/ToolIconWiring.js`（新規。`wiring/`の配線）**
* 公開：`drawToolIcons()`（引数なし。`main.js`が起動時に1回だけ呼ぶ）。
* import：`asset/sprite/select-arrow.js`・`asset/sprite/vertex-arrow.js`（既定のexport）、`core/SpriteFitRules`の`computeSpriteFitTransform`、`core/InputModes`の`OperationMode`（ボタンのidを`tool-${OperationMode.SELECT}`・`tool-${OperationMode.VERTEX}`で組み立て、識別子を二重に書かないため）。
* 処理（ボタン1つあたり）：
  1. `document.getElementById(id)`で要素を取る。無ければ`console.warn`してそのボタンだけ配線しない（`palette/`のUI部品と同じ扱い）。
  2. ボタンの中身を空にして`<canvas>`を1つ作り、`appendChild`する。
  3. `const dpr = window.devicePixelRatio || 1;`。`canvas.width`・`canvas.height`は`Math.round(ICON_CANVAS_SIZE * dpr)`、`canvas.style.width`・`style.height`は`${ICON_CANVAS_SIZE}px`（`CanvasManager.resize`と同じ考え方）。
  4. `computeSpriteFitTransform(sprite.bounds, ICON_CANVAS_SIZE, ICON_CANVAS_SIZE, ICON_CANVAS_PADDING)`を求め、`null`なら描かない。
  5. `ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY)`のうえ`sprite.draw(ctx)`を呼ぶ。
* 定数`ICON_CANVAS_SIZE`（20）・`ICON_CANVAS_PADDING`（1）は本ファイルが唯一の定義箇所（`.icon-btn`は32×32のまま。既存の1文字のアイコン（`font-size: 16px`）と見比べて違和感のない大きさ）。
* 判定・計算は持たない（収める計算は`SpriteFitRules`、絵はスプライトJSの`draw`）。`VectorModel`・`InputTracker`・`ToolPalette`・表示の状態を知らない。
* **やらないこと**：`devicePixelRatio`の変化・ウィンドウの移動での描き直し、他のボタンのアイコンの差し替え、押し込みに応じた描き分け。

**`js/main.js`**
* `// 7.`のツールパレットの配線の中（`ToolPalette`の生成の直後）で`drawToolIcons()`を1回だけ呼ぶ。購読の登録は無いため、同じ位置の順を保てばよい。

**`index.html`**
* `#tool-select`の中身の`🖱`を削除して空にする（アイコンの定義をスプライトJSの1か所にするため。`id`・クラス・`title`は変えない）。
* `.icon-btn`のルールの後に`.icon-btn canvas { display: block; }`を足す（`<canvas>`のベースラインの隙間をなくすため。大きさはJSが要素へ直接設定する）。`.icon-btn`の既存のルールは変えない。

---

### 要件3: 選択（`V`）ではハンドルを出さない

**描画（`js/core/CanvasManager.js`）**
* `render`の**第2引数の状態オブジェクト**（実シグネチャは`render(shapes, { hoveredId = null, … } = {})`。第2引数そのものは既存であり、新しい引数を足すのではない）へ、プロパティ`showHandles`（既定`true`。省略時は従来どおり描く）を足す。偽なら「選択集合の図形の`drawHandles`」の段（描画順の(2)）を丸ごと行わない。
* `CanvasManager`は状態を持たないまま（どのモードかを知らない）。

**`js/main.js`の`renderCurrentState`**
* `canvasManager.render`へ`showHandles: false`を渡す（本作業の後、`drawHandles`はどのモードでも呼ばれない）。定数であり判定ではない。コメントで「変形のPhaseで外枠のハンドルを入れるときに去就を決める」と書き残す。

**当たり判定（`js/core/PointHitRules.js`）**
* `classifyPointHit(shapes, isSelected, x, y, tolerance, includeFill = true, includeHandles = true)`とし、第7引数`includeHandles`が偽なら`handle`は常に`null`を返す（`findHandleHit`を呼ばない）。既定値は今のふるまい（含める）。
* `bodyId`の求め方は変えない。`includeFill`の意味・既定値も変えない。
* テスト：`test/core/PointHitRules.test.js`へ、`includeHandles`が偽のときハンドルが`null`になり`bodyId`は変わらないこと・真を明示すると省略時と同じであること・`includeFill`との独立性を足す（既存のケースは既定値のままなので変えない）。

**`InputTracker`からの受け渡し**（実装は要件7のタスク）
* `#classifyPoint`が、頂点の選択のモードのときだけ`includeHandles`に真を渡す（選択モードでは偽）。
* この結果、選択モードでは`PressActionRules`のハンドルの枝と`CursorShapeRules`の「ハンドル上 → `move`」が通らなくなる。**`PressActionRules.js`・`CursorShapeRules.js`の判定表そのものは変えない**（`CursorShapeRules`への変更は要件7の頂点の選択のモードの分岐だけ）。`test/core/PressActionRules.test.js`は変えない。
* 各図形の`drawHandles`は**消さない**（共通メソッド契約は据え置き。本作業の後は呼ばれなくなる）。

---

### 要件4: 図形の共通メソッド契約に「頂点として扱えるハンドル名の一覧」を足す

* 共通メソッド契約の**18番目**として`getVertexHandleNames()`（引数なし）を`Line`・`Curve`・`Rect`・`Ellipse`・`Path`の5クラスへ足す。
* 戻り値は**毎回新しい配列**（呼び出し側が書き換えても図形に影響しない）。要素は文字列のハンドル名。
* 並びは、既存の`getVertexIndexForHandle`が返す頂点の番号の昇順：
  * `Line`：`['start', 'end']`（**`'move'`＝中点は含めない**）
  * `Curve`：`['start', 'control', 'end']`
  * `Rect`：`['topLeft', 'topRight', 'bottomRight', 'bottomLeft']`
  * `Ellipse`（円・弧）：`[]`（発注者の決定。`'move'`・`'right'`・`'up'`・`'left'`・`'down'`はいずれも含めない）
  * `Path`：`points`の数だけ`['vertex-0', 'vertex-1', …]`（既存の名前の形。頂点0個でも`[]`）
* 一覧に含まれる名前は、必ず既存の`hitTestHandle`が返しうる名前であり、`getVertexIndexForHandle`が番号を返し、`getHandlePosition`が位置を返すものに限る（ハンドル名の契約の4つ目として資料に足す）。
* **本作業では`hitTestHandle`・`getVertexIndexForHandle`・`getHandlePosition`・`setVertex`・`VectorModel.updateVertex`・`EndpointSnapRules`・`EndpointSnapper`を一切変えない**。
* 各クラスのクラスJSDocの契約の列挙（17メソッド → 18メソッド）も更新する。
* テスト：`test/shapes/Line.test.js`・`Curve.test.js`・`Rect.test.js`・`Ellipse.test.js`・`Path.test.js`へ、一覧の内容と並び・毎回新しい配列で書き換えても図形が変わらないこと・一覧の各名前が`getVertexIndexForHandle`で番号になり`getHandlePosition`で位置になること（`Path`は開いた・閉じたの両方、頂点数を変えた後も）を足す。先頭の責務定義のコメントも更新する。

---

### 要件5: 頂点の選択の状態（`js/core/VectorModel.js`）

* 非公開フィールド`#selectedVertices`（`Array<{shapeId: string, handle: string}>`。選んだ順）。保存しない一時的な状態（ホバー・選択矩形・吸い付きの表示と同じ扱い）。**本作業では最大1つしか入らない操作だけを配線する**（後半で複数にする）。
* 公開メソッド（4つ）：
  * `setSelectedVertices(pairs)`：置き換え。`pairs`の各要素のうち、`shapeId`が**現在の選択集合に含まれ**かつ`handle`が空でない文字列のものだけを、与えられた順で（同じ組の重複は除いて）新しい配列に写す。内容が変わったときだけ`#notifyChange()`を1回出す。要素は新しいオブジェクトとして持つ（引数のオブジェクトを保持しない・引数を書き換えない）。
  * `clearSelectedVertices()`：全解除。1つ以上あったときだけ`#notifyChange()`を1回出す。
  * `getSelectedVertices()`：読み出し。新しい配列・新しいオブジェクトのコピーを返す。
  * `isVertexSelected(shapeId, handle)`：1つの頂点が選ばれているかの照会（真偽値）。
* **不変条件**：頂点の選択は常に「選択集合に含まれる図形」の組だけを含む。
* **落とし方**：非公開の`#pruneSelectedVertices()`（選択集合に無い`shapeId`の組を落とす。落ちたかを返す）を、選択集合・図形一式が変わる既存のメソッドの`#notifyChange()`の**前**で呼ぶ：`setSelection`・`clearSelection`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`。これにより、取り消し・やり直し、キャンバスの切り替え、削除、結合、貼り付け、`?dev`の復元、`setMode`（`clearSelection`を通る）で取り残しが出ない。**通知の回数は増やさない**（既存の通知に相乗りする）。
  * `reorderShapes`・`moveShapes`・`updateVertex`・`updateShapeStyles`は選択集合・図形の増減を変えないため呼ばない。
* 作業データ・履歴のスナップショット・書き出しには**一切入れない**（`io/DocumentSerializer`・`edit/SnapshotAdapter`・`io/SpriteSerializer`は変更しない）。
* テスト：`test/core/VectorModel.selectedVertices.test.js`（新規）。初期値が空・置き換えと通知1回・同じ内容の置き換えでは通知しない・選択集合に無い図形の組は受け付けない・重複を除く・全解除（空のときは通知しない）・`getSelectedVertices`がコピーを返すこと・`isVertexSelected`・`setSelection`／`clearSelection`／`deleteShapes`／`replaceAllShapes`／`addShapesWithNewIds`／`replaceShape`で落ちること（通知の回数が増えないこと）・他の状態（ホバー・選択矩形・吸い付きの点・直前に使った値・図形）に触れないこと。

---

### 要件6: 頂点のハンドルの表示

**`js/core/VertexHandleRules.js`（新規。`core/`の状態を持たない規則）**
* 公開：
  * `collectVertexHandles(mode, shapes, selectedIds, selectedVertices)` → `Array<{shapeId: string, handles: Array<{x: number, y: number, selected: boolean}>}>`。
    `mode`が`OperationMode.VERTEX`でなければ空配列。そうでなければ、`shapes`の並び（描画順）のうち`selectedIds`に含まれる図形について、`shape.getVertexHandleNames()`の順に`shape.getHandlePosition(name)`で位置を求め（`null`は飛ばす）、`selectedVertices`に同じ`{shapeId, handle}`の組があれば`selected: true`にする。ハンドルが0個の図形（円・弧）は結果に含めない。
  * `isVertexHandle(shape, handleName)` → 真偽値。`shape`が`getVertexHandleNames`を持ち、その一覧に`handleName`が含まれるときだけ真（`shape`が`null`・`undefined`でも例外を投げない）。
* 状態・DOMを持たず、importは`core/InputModes`の`OperationMode`のみ。図形種別の分岐・図形固有のプロパティ名を持たず、共通メソッドをポリモーフィックに呼ぶだけ。引数を書き換えない。
* テスト：`test/core/VertexHandleRules.test.js`（新規）。実物の図形クラスを使い、5種別の一覧と位置・円/弧が含まれないこと・選択中でない図形が含まれないこと・`selected`の付き方・モードが違えば空配列・引数を書き換えないこと・`isVertexHandle`（`'move'`が偽・未知の名前・`null`）。

**`js/core/CanvasManager.js`**
* `render`の**第2引数の状態オブジェクト**（実シグネチャは`render(shapes, { hoveredId = null, … } = {})`。第2引数そのものは既存）へ、プロパティ`vertexHandles`（既定`[]`）を足す。描画順は**今までの`drawHandles`と同じ位置**（全図形の描画の後・作成中の図形の前）。
* 見た目：選ばれていない頂点は既存のハンドルと同じ（画面上8pxの白い四角・青い枠・線幅1.5px）、**選ばれている頂点は塗りを青（枠と同じ`#4a90e2`）にして見分けられるようにする**。大きさ・線幅は`÷ view.scale`で画面上一定。倍率が正の有限値でなければ描かない（`#drawSnapIndicator`と同じ防御）。スタイルは`save()`/`restore()`で後続へ残さない。
* 定数（`VERTEX_HANDLE_SIZE` 8・`VERTEX_HANDLE_LINE_WIDTH` 1.5・`VERTEX_HANDLE_FILL_COLOR` `'#ffffff'`・`VERTEX_HANDLE_SELECTED_FILL_COLOR` `'#4a90e2'`・`VERTEX_HANDLE_STROKE_COLOR` `'#4a90e2'`）は`CanvasManager`内に置く（図形の`drawHandles`の値と同じだが**別の定義**。既存の`drawHandles`は変えない）。
* 図形種別の分岐・図形固有のプロパティ名は持たない（位置と選ばれているかを引数で受け取るだけ）。状態も持たない。

**`js/main.js`の`renderCurrentState`**
* `const shapes = model.getShapes();`を一度だけ取り、`canvasManager.render(shapes, { …, showHandles: false, vertexHandles: collectVertexHandles(inputTracker.getMode(), shapes, model.getSelectedIds(), model.getSelectedVertices()) })`とする。判定・計算は規則の関数が持ち、`main.js`は受け渡しだけを行う。
* 再描画の経路は既存の`model.onChange`・`viewTransform.onChange`・`displayState.onChange`・`resize`のまま（**機能専用の再描画・同期の経路を足さない**）。頂点の選択の変更は`model.onChange`で届く。

---

### 要件7: 頂点の選択（`A`）の操作

**`js/core/CursorShapeRules.js`**
* 判定表へ、(2)キャンバス移動モード → `'grab'`の**次**、(3)選択モード以外 → `'default'`の**前**に、頂点の選択のモードの分岐を足す：
  * `state === InputState.DRAGGING_HANDLE` → `'move'`
  * `hit === null` → `'default'`
  * `hit.handle` → `'move'`
  * `hit.bodyId` → `'pointer'`（選択中かどうかで変えない。`isSelected`を呼ばない）
  * それ以外 → `'default'`
* (0a)パンのドラッグ中の`'grabbing'`・(0b)`Space`押下中の`'grab'`の優先は変えない。選択モードの分岐・スポイトの`'cell'`の位置も変えない。**ツールごとにカーソルの形を変えることはしない**（発注者の決定）。
* 渡される`hit.handle`は、呼び出し側（`InputTracker`）が頂点のハンドルだけに絞り込んだ結果である（本ファイルは絞り込みを持たない）。
* JSDocの判定表の説明を更新する。typedef`CursorShapeInput`の項目は変えない。
* テスト：`test/core/CursorShapeRules.test.js`へ、頂点の選択のモードの5通り＋パン中・`Space`押下中が優先されること＋`isSelected`・`isPickingShape`を呼ばないことを足す（既存のケースは変えない）。

**`js/core/InputTracker.js`**
* import：`core/VertexHandleRules`の`isVertexHandle`を足す（`core/`内）。
* `#classifyPoint(point)`：`classifyPointHit`の第7引数`includeHandles`へ「頂点の選択のモードか」を渡す（**選択モードでは偽＝ハンドルを当たりに含めない**＝要件3）。頂点の選択のモードのときは、得られた`hit.handle`（`{ shapeId, handle }`）が頂点のハンドルかを`isVertexHandle(対象の図形, hit.handle.handle)`で確かめ、違えば`{ handle: null, bodyId: hit.bodyId }`を返す（円・弧のハンドル・直線の中点のハンドルは頂点として扱わない）。**対象の図形は、既存の`InputTracker`と同じ形の`this.model.getShapes().find((s) => s.id === hit.handle.shapeId)`で得る（`VectorModel`に図形照会のメソッドを足さない）。**ホバー・押下・クリック・カーソルの4箇所は引き続きこの1つの結果を共用する。
* `handleMouseMove`：IDLE かつ **選択モードまたは頂点の選択のモード**で、当たり分類 → ホバーの更新 → カーソルの更新を行う（今の選択モードの処理をそのまま頂点の選択のモードにも適用する）。`DRAWING`・図形作成モードのIDLE・ドラッグ中の扱いは変えない。
* `handleMouseDown`：中ボタン・ドラッグ中・`Space`／キャンバス移動モードのパン・左ボタン以外の判定（スペース押下中・中ボタンのパンの優先）は、**この複合ガードより前にあるものを一切動かさない**。
  実コードの`if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) return;`という複合ガードを、**「IDLEでなければ`return`」と「操作モードごとの分岐」の2つに割る**：IDLEの判定を単独の早期`return`として残し、その後に**頂点の選択のモードの分岐**と**選択モードの分岐**を置く（選択モードの枝の中身＝`isPickingShape`の早期`return`・`resolvePressAction`による振り分けは今のまま動かさない）。頂点の選択のモードの分岐は次のとおり：
  * 当たり分類（上記の絞り込み済み）→ `hit.handle`があれば、`model.setSelectedVertices([{ shapeId, handle }])`でその頂点だけを頂点の選択にしてから、`#beginLeftDrag(event, InputState.DRAGGING_HANDLE, point, hit.handle)`でそのハンドルのドラッグを始める（既存のハンドルのドラッグとまったく同じ状態・同じ経路。`resolveDragEndpoint`・`#unitSnapHandleOrigin`の記憶も既存のまま働く）。
  * `hit.handle`が無ければ**何も始めない**（図形の本体の上も空白も。発注者の決定。範囲選択は後半）。
  * スポイトの待ち受けの判定（`isPickingShape`）による早期`return`は**選択モードの枝の中に残す**。頂点の選択のモードには足さない（スポイトの開始は`ensureSelectMode`で選択モードへ切り替わるため、頂点の選択のモードで待ち受けになることはない）。
* `handleClick`：`DRAWING`・抑止の判定は変えない。IDLEで**頂点の選択のモードの分岐**を置く（選択モードの分岐とは操作モードで排他のため、選択モードの分岐との前後は順不同でよい）。`Ctrl`（`⌘`）は見ない（`additive`に常に偽を渡す）：
  * `hit.handle`があれば → `model.setSelectedVertices([hit.handle])`（図形の選択は変えない）。
  * `hit.bodyId`があれば → `model.clearSelectedVertices()`の後、`#applySelectionChange(resolveClickSelection(this.model.getSelectedIds(), hit.bodyId, false))`（その図形だけを選ぶ。既存の選択モードと同じ規則を再利用し、規則を二重に書かない）。
  * 空白なら → `model.clearSelectedVertices()`の後、同じく`resolveClickSelection(…, null, false)`（選択があれば全解除、なければ何もしない）。
  * 通知は、頂点の選択が空でなければ最大2回（頂点の解除＋選択の変更）。既存の経路のみを通る。
* `#applyLeftDragUpdate`・`#onLeftDragStart`・`#onLeftDragEnd`・`#finishLeftDrag`・`#beginLeftDrag`は**変更しない**（スナップの丸め、`Ctrl`を押している間の一時無効、端点への吸い付き、取り消し1件への記録、閾値以内で離したときにクリックとして扱うことが、そのまま頂点の選択のモードにも効く）。
* `cancelDraftOrClearSelection()`（`Esc`の実体）：
  1. ドラッグ中なら`false`（今のまま）。
  2. `DRAWING`なら今のまま。
  3. **（新）頂点の選択が1つ以上あれば`model.clearSelectedVertices()`して`true`**（図形の選択・頂点の表示はそのまま）。
  4. **選択モードまたは頂点の選択のモード**かつIDLEかつ選択集合が空でなければ`clearSelection()`して`true`（モードの条件だけを広げる）。
  5. それ以外は`false`。
* `deleteSelection()`は**変更しない**（受理条件が選択モードのため、頂点の選択のモードでは`false`を返し図形は消えない＝発注者の決定）。`selectAll()`・`abortOngoingOperation()`・`setMode`・`setShapeType`・`handleKeyDown`／`handleKeyUp`（`Space`専用）・`handleWheel`も変更しない。
* `setMode`で頂点の選択が空になることは、`model.clearSelection()` → 要件5の落とし方により自動的に満たされる（`InputTracker`に専用の処理を足さない）。
* JSDoc：クラス先頭の責務定義・`setMode`／`getMode`の`@param`／`@returns`の型（`'select'|'create'|'pan'|'vertex'`）・各ハンドラの判定順の説明・`#classifyPoint`の説明を更新する。
* **`InputTracker`の状態の持ち主を分けない**（`InputState`・パンのフラグ・ドラッグの作業用フィールドの持ち主を変えない。頂点の選択の状態は`VectorModel`が持つ）。

---

### 要件8: ふるまいの確認（テストプレイの確認項目）
最終タスクで発注者へ提示する（内容は「3. タスクリスト」のタスク16に全文を置く）。

---

### 関連フォルダと論理クラス

* **対象フォルダ**: `./js/core/`（入力・状態・描画・規則）、`./js/shapes/`（図形ドメイン）、`./js/wiring/`（配線）、`./asset/sprite/`（新規。スプライトJS）、`./test/core/`・`./test/shapes/`（自動テスト）、`./index.html`、`./js/main.js`
* **関連する論理クラス・モジュール**：
  * 既存（変更）：`core/InputModes`・`core/ToolRules`・`core/KeyboardShortcuts`・`core/PointHitRules`・`core/CursorShapeRules`・`core/InputTracker`・`core/VectorModel`・`core/CanvasManager`・`shapes/Line`・`Curve`・`Rect`・`Ellipse`・`Path`・`main.js`・`index.html`
  * 新規：`core/SpriteFitRules`（スプライトを描画先へ収める倍率と平行移動の規則）・`core/VertexHandleRules`（頂点のハンドルの一覧の組み立てと頂点のハンドルかの照会の規則）・`wiring/ToolIconWiring`（ツールのアイコンの`<canvas>`の配線）・`asset/sprite/select-arrow.js`・`asset/sprite/vertex-arrow.js`
  * 既存（変更しない。依存先として読むだけ）：`core/PressActionRules`・`core/SelectionRules`・`core/UnitSnapRules`・`core/UnitSnapSettings`・`core/ShapeFactory`・`core/DragTracker`・`core/HistoryManager`・`shapes/EndpointSnapRules`・`shapes/PathJoinRules`・`edit/EndpointSnapper`・`edit/SnapshotAdapter`・`io/SpriteSerializer`・`io/CodeExporter`・`io/DocumentSerializer`・`palette/ToolPalette`・`wiring/DisplayWiring`
* **依存方向**：`main.js → wiring → palette / edit / core`、`core → shapes`の一方向を保つ。
  * 新規：`wiring/ToolIconWiring → asset/sprite/*.js`（新しい方向。`asset/`は何もimportしない葉のモジュール）と`wiring/ToolIconWiring → core/SpriteFitRules`・`core/InputModes`。
  * `core/`は`asset/`・`io/`・`edit/`・`palette/`・`wiring/`をimportしない（`SpriteFitRules`は何もimportしない、`VertexHandleRules`は`core/InputModes`のみ）。
  * `core/InputTracker → core/VertexHandleRules`（`core/`内）。循環import無し。

### 参照する責務
（`PROJECT_CONSTITUTION.md`・`PROJECT_ARCHITECTURE.md`および`_doc/arch/`から抜粋。**以後のタスク実行チャットは、この項目のみを責務情報源とする**）

* **憲法（必ず守る）**
  * すべての`.js`の最先頭行に、そのファイルの単一の責務をJSDocで3行以内に明記する。**ファイル先頭に定義された責務を逸脱するメソッド・ロジックを追記しない**。
  * クラス・関数・メソッド・データ構造にはJSDocで引数・戻り値・責務を明文化する。
  * 状態（モデル）と描画（Canvas API）を混同しない。`CanvasManager`に座標データ・選択状態を持たせない。
  * グローバル変数（`window`）を汚染しない。外部ライブラリ・フレームワーク・ビルドツールを導入しない。数学は標準の`Math`で自前実装する。
  * 検証コマンドは、リポジトリのルートの`node --test`（全件合格が合否）。
  * REQ／RESで変更対象として明示されたファイル以外は変更しない（ついでの整形・不要に見えるコードの削除・命名の改善も禁止）。

* **`js/core/InputModes.js`**：入力の状態（`InputState`）と操作モード（`OperationMode`）の値の定義だけを持つ。判定・状態・関数・importを持たず、DOMに触れない。公開は`InputState`（素のオブジェクト）と`OperationMode`（`Object.freeze`）。**操作モードを足すときはここへ1エントリを足す**（`InputTracker.setMode()`の受理判定は本定義の値を正とする）。`OperationMode`の値は`index.html`のボタンのid（`#tool-select`等）と対応する。import元は`InputTracker`・`CursorShapeRules`・`ToolRules`・`KeyboardShortcuts`・`main.js`とテスト。

* **`js/core/ToolRules.js`**：ツールの一覧と、操作モード・図形種別・スポイトの待ち受けから押し込みの表示にするツールを求める規則を、状態を持たない関数として提供する。DOMを知らない。公開は`EYEDROPPER_TOOL_ID`・`TOOL_IDS`（凍結した配列。並び＝ツールパレットのボタンの並び）・`resolveActiveTool(mode, shapeType, picking = false)`。**識別子の約束**：選択・キャンバス移動のツールは`OperationMode`の値と同じ、スポイトは独自の`EYEDROPPER_TOOL_ID`、図形のツールは図形種別の値と同じ。ボタンのid`tool-${toolId}`は`index.html`側の約束。importは`core/InputModes`の`OperationMode`と`core/ShapeFactory`の`SHAPE_TYPES`のみ。使う側は`main.js`とテストだけ。同じ表を2か所に書かない。

* **`js/core/KeyboardShortcuts.js`**：キー→操作の対応表（`SHORTCUT_BINDINGS`）と`keydown`の受理判定のみ。新しいショートカットは対応表へのエントリ追加（＋必要なら注入コールバックの追加）で対応する。`Shift`規則は必ず`ShiftRule`の値を指定する。同一の`code`・修飾キーの組み合わせに一致するエントリが2件以上存在しないこと（`#findBinding`は`binding.ctrl === ctrlPressed`で照合し最初の一致を返す）。`index.html`の各ボタンの`title`属性はこの表と手動で一致させる。importは`InputModes`の`OperationMode`・`ShapeFactory`の`SHAPE_TYPES`・`FocusKeyYieldRules`の2関数のみ。表示の状態・`VectorModel`・`ViewTransform`・`InputTracker`インスタンス・DOMのボタン要素を知らない。ショートカット専用のUI同期・再描画は持たない。

* **`js/core/PointHitRules.js`**：当たり分類の規則（ある点が選択集合の図形のハンドル・図形の本体・空白のどれに当たるか）を、図形の公開メソッドと選択中かの照会だけで判定する、状態を持たない関数。公開は`classifyPointHit(shapes, isSelected, x, y, tolerance, includeFill = true)`とtypedef`PointHit`（**正本はこのファイル**）。読むのは図形の`id`・`hitTestHandle`・`hitTest`・`hitTestFill`と引数の`isSelected`のみ。何もimportしない。図形種別・`isFillable()`・`fillColor`・`VectorModel`・表示倍率・DOMを知らない。規則：(1)ハンドル＝選択集合の図形だけ、図形配列の後ろ（手前）から最初の非`null`。(2)本体＝選択集合の図形の輪郭を手前優先、(3)なければ手前から`hitTest || (includeFill && hitTestFill)`。`handle`と`bodyId`は独立に求める。ハンドルの優先順位は`CanvasManager`のハンドル描画順と一致させる。

* **`js/core/CursorShapeRules.js`**：操作モード・入力状態・当たり分類から、キャンバスに適用すべきCSSの`cursor`値を決める規則（判定表）を、状態を持たない関数として提供する。公開は`resolveCursorShape(input)`とtypedef`CursorShapeInput`（`isPanning`・`isSpacePressed`・`isLeftDragState`・`mode`・`state`・`isPickingShape`（関数）・`hit`・`isSelected`（関数）の8項目）。判定の順は (0a)パン中→`'grabbing'`、(0b)`Space`押下中かつ左ドラッグ状態でない→`'grab'`、(1)図形作成→`'crosshair'`、(2)キャンバス移動→`'grab'`、(3)選択モード以外→`'default'`、(3a)待ち受け中→`'cell'`、(4)`DRAGGING_HANDLE`・`MOVING_SELECTION`→`'move'`、(5)`MARQUEE_SELECTING`→`'default'`、(6)`hit === null`→`'default'`、(7)`hit.handle`→`'move'`、(8)選択内の`bodyId`→`'move'`、(9)それ以外の`bodyId`→`'pointer'`、(10)→`'default'`。importは`core/InputModes`のみ。**`isPickingShape`・`isSelected`は関数で受け、呼び出しの回数（短絡評価）を変えない**。DOM・当たり分類の計算・修飾キーを知らない（ホバー・カーソルは`Ctrl`で変えない＝発注者の決定）。

* **`js/core/PressActionRules.js`（変更しない）**：選択モードの押下時の分岐の表。`resolvePressAction(hit, isSelected)` → `moveSelection`／`dragHandle`＋`target`／`marquee`／`null`。ハンドルが当たれば本体の判定より先。**押下時の分岐の表を変えるときはこのファイルだけを変える**。`Ctrl`で変えない（発注者の決定）。

* **`js/core/SelectionRules.js`（変更しない）**：クリック・範囲選択の次の選択の指示と選択の反転の規則。`resolveClickSelection(selectedIds, hitId, additive)`は`additive`が偽なら、当たれば`{type:'set', ids:[hitId]}`・空白で選択があれば`{type:'clear'}`・なければ`null`を返す。引数を書き換えず新しい配列を返す。

* **`js/core/InputTracker.js`**：ユーザー入力の解釈とModel・ビュー変換への反映、状態依存の操作の公開、編集操作の開始・確定の通知、カーソル形状のフィードバック（形の判定は`CursorShapeRules`へ渡し、キャンバスへ適用するだけ）。**図形種別を知らない**（if/switch分岐を一切行わない。当たり判定は`PointHitRules`経由、`intersectsRect`・`getVertexIndexForHandle`・`getHandlePosition`は直接ポリモーフィックに呼ぶ。`vertexIndex`規約を`core/`層にハードコードしない）。`HistoryManager`・`edit/`をimportしない（注入された補助を呼ぶだけ）。状態は入力状態`InputState`・操作モード・図形種別を独立に保持し、パン状態は別フラグ。当たり分類は`#classifyPoint`の1つの結果をホバー・押下・クリック・カーソルの4箇所で共用する。押下時の分岐は`PressActionRules`、カーソルの形は`CursorShapeRules`へ委譲し、判定表を持たない。修飾キーの読み取りは`hasCtrlModifier(event)`（**`Ctrl`（`⌘`を含む）の読み取りの唯一の定義**）。頂点のハンドルのドラッグは、`#beginLeftDrag`が`resolveDragEndpoint`と`shape.getHandlePosition`による`#unitSnapHandleOrigin`を記憶し、`#applyLeftDragUpdate`が「吸い付けばその端点、でなければ『始めた時点のハンドルの位置＋丸めた移動量』」を`model.updateVertex`へ渡す。`#finishLeftDrag`が`commitEdit`・`#resetSnapState()`・作業用フィールドの後始末を行う。吸い付きの作業用フィールドの寿命は入力状態と同じで、遷移のたびに消す対応を崩さない。

* **`js/core/VectorModel.js`**：描画データ（Shape配列）と、選択集合・ホバー状態・作成中図形・選択矩形・吸い付きの表示の点・新しく描く図形のスタイルを保持する単一の真実（SSOT）。**図形固有の頂点構造・内部プロパティ名、図形データ・作業データ形式を知らない**（共通プロパティのスタイル3つだけは例外として書く）。再編集・追従は図形の`setVertex`/`translate`/`updateDraftEnd`へポリモーフィックに委譲する。`deleteShapes`は除去した図形のidを選択集合・ホバーからも除く。`replaceAllShapes`は選択集合・ホバー・作成中の図形・選択矩形・吸い付きの表示の点をクリアする（通知は1回）。`addShapesWithNewIds`は追加した図形だけを選択する。`replaceShape`は`select`が真なら結果だけを選択し、偽なら現存しないidだけ外す。通知は各操作につき1回（`#notifyChange()`）。**表示専用・保存しない一時的な状態（ホバー・選択矩形・吸い付きの表示の点）と同じ扱いの状態をここへ足してよい**（作業データ・スナップショットには入らない）。

* **`js/core/CanvasManager.js`**：Canvasへの純粋な描画（レンダラーの責務）。**図形データ・選択状態・ビュー変換状態・表示の状態を持たない**（値は`render`の引数で受け取る）。保持するのはCanvas要素・2Dコンテキスト・dprのみ。描画順：背景の塗り → 背景グリッド → 軸線・原点マーク → 全図形の`draw`（＋ホバー）→ 選択集合の図形の`drawHandles`（全図形の描画後にまとめて描く2パス）→ 作成中の図形 → 吸い付きの表示 → 選択矩形。補助表示の大きさ・線幅は`÷ view.scale`で画面上一定にし、定数は`CanvasManager`内に置く。倍率が正の有限値でなければ補助表示を描かない。スタイルは`save()`/`restore()`で後続へ残さない。補助描画はいずれもポリモーフィックに呼ぶ。`render()`を呼ぶのは`main.js`だけ。

* **`js/shapes/`（図形クラス）**：図形種別ごとのデータ保持・描画・当たり判定・図形データとの相互変換。共通基底クラスは無く、共通の幾何・検証は共通モジュールの関数を呼ぶ。**17メソッド契約**（`draw`・`drawHandles`・`drawHover`・`hitTest`・`hitTestHandle`・`setVertex`・`translate`・`updateDraftEnd`・`getVertexIndexForHandle`・`intersectsRect`・`toDrawElement`・`toJSON`・`static fromJSON`・`isFillable`・`hitTestFill`・`drawOutline`・`getHandlePosition`）を`Line`/`Curve`/`Rect`/`Ellipse`/`Path`が自律実装する。**メソッドを増減する場合は5クラスのクラスJSDocも更新する**。
  * **ハンドル名の契約**：移動ハンドルの名前は`'move'`固定。`'move'`以外のハンドル名は`getVertexIndexForHandle`で有効な番号に解決できなければならない。`hitTestHandle`が返し得るすべての名前（`'move'`を含む）は`getHandlePosition`で位置に解決できなければならない。`getHandlePosition`の位置は`hitTestHandle`・`drawHandles`と同じ式で求める。
  * `getHandlePosition(handleName)`は新しいオブジェクト`{x, y}`を返し、ハンドル名でない値（`null`・`undefined`・未知の文字列・文字列以外・`Object.prototype`のキー名）には例外を投げず`null`を返す。
  * ハンドル名と頂点の番号：`Line`＝`start`→0・`end`→1（`move`は中点で番号なし）、`Curve`＝`start`→0・`control`→1・`end`→2、`Rect`＝`topLeft`→0・`topRight`→1・`bottomRight`→2・`bottomLeft`→3、`Ellipse`＝`right`/`left`→1・`up`/`down`→2（ハンドルと頂点は別物。`setVertex`は半径として解釈する）、`Path`＝`vertex-<i>`→`i`。
  * `drawHandles(ctx, viewScale = 1)`は画面上8pxの白い四角（`#ffffff`）・青い枠（`#4a90e2`）・線幅1.5pxを`÷ viewScale`で描く。

* **`js/wiring/`**：`main.js`から切り出した、DOMの取得・購読の登録・同期の配線。**判定・計算の規則は持たず**、`core/`の規則・`palette/`の部品・`edit/`の照会を呼ぶだけ。`main.js`だけが使い、`js/`の他のフォルダは`wiring/`をimportしない。要素が欠ければ`console.warn`して配線しない（`palette/`のUI部品と同じ扱い）。

* **`js/palette/ToolPalette.js`（変更しない）**：ツールパレットのツールのボタンの配線。ボタンはid規則`tool-${toolId}`で解決し、一覧にあるのにボタンが無い／一覧に無い`tool-`の要素は`console.warn`で報告する。照合はコンストラクタの1回のみ。`setActiveTool(toolId)`は一致するボタン1つだけに`.active`を付ける。操作モードの知識を持たず、importも持たない。パレット内ではツールのボタン以外の要素に`tool-`で始まるidを使わない。

* **`js/io/SpriteSerializer.js`・`js/io/CodeExporter.js`（変更しない）**：スプライト（書き出し形式）の組み立てとJSのテキストの組み立て。`SpriteSerializer.serialize(shapes)` → `{ format: "oz-vector-editor-sprite", formatVersion: 2, bounds, elements, source }`。`bounds`はワールド座標の`{minX, minY, maxX, maxY}`（図形0個は`null`。線を描く要素は線の太さの半分だけ四方へ広げる）。`CodeExporter.toModuleText(spriteData)`は`import`文を含まず単体で`import`できるESモジュールのテキストを返し、**既定のexportのみ**（スプライトデータの全キーと`draw(ctx)`）。`draw(ctx)`は`ctx`の現在の変換の上に、原点(0,0)を基準に描き、呼び出し前後で`ctx`の状態は変わらない。**書き出し形式の版を上げない限り、エンジンへの連絡票は不要**。

* **`js/main.js`**：エントリポイント。インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶ連携のみ。**判定ロジック・作業データの中身の解釈を持たない**。配線ブロックはコメント番号（`// 1.`〜`// 9.`）の順に置く。`// 6.5.`（`DisplayWiring`の生成）と`syncAll()`の位置を動かさない（購読の登録順が通知の呼ばれる順に効くため）。同一経路の原則：ボタンとキーは同じ関数を呼ぶ。**新しいツールの足し方**：識別子を`ToolRules`の`TOOL_IDS`へ、`index.html`へ`#tool-<id>`のボタン、`main.js`の`toolActions`へ操作。押し込みは`ToolRules.resolveActiveTool`で求め`syncToolPalette`が渡す。再描画・UI同期は既存の`onChange`の経路のみで行い、**機能専用の再描画・同期処理を足さない**。

* **`index.html`**：スタイルは`<style>`タグに内包。ツールバー・ステータスバー・ツールパレットのボタンはアイコンのみ（`class="tool-btn icon-btn"`）。説明とショートカットは`title`に書く。`.icon-btn`は`.tool-btn`のルールの後に置き、大きさ（32×32）と中央寄せだけを上書きする。ツールパレットのボタンのidは`tool-${toolId}`で、パレット内ではツールのボタン以外に`tool-`で始まるidを使わない。最初のまとまりは「選択・キャンバス移動・スポイト」、次が図形のボタン。押し込みの初期状態は`#tool-select`の`active`のみ`index.html`に書く。`#editor-canvas`に背景色・枠線・内側の余白を付けない。

* **`test/`**：`node:test`・`node:assert/strict`のみで書き、リポジトリのルートの`node --test`で実行する。置き場所は`test/<js/からの相対フォルダ>/<対象モジュール名>[.<観点>].test.js`。**テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない**。公開APIのみを通す。先頭行に単一責務のJSDoc（3行以内）、補助関数にもJSDoc。`test/`以下に共有の補助モジュール・テスト以外の`.js`を置かない。`console.warn`は`t.mock.method(console, 'warn', () => {})`で抑止する。注入される依存は素のオブジェクトの偽物で置き換える（実物の組み合わせは既存の例外のみ）。図形の`id`は公開プロパティへ直接代入して設定する。DOM・Canvasに依存する箇所（`CanvasManager`・`InputTracker`の配線・`index.html`・`main.js`／`wiring/`の配線）はテストできず、テストプレイで確かめる。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
（資料本体の修正は最終タスク（タスク17）でのみ行う。個別の実装タスク内では書き換えず、判明した点はこの欄へ追記する）

* **1章 フォルダ構造**：`asset/sprite/`（新規。ツールのアイコンの仮のスプライトJS）、`js/core/SpriteFitRules.js`・`js/core/VertexHandleRules.js`・`js/wiring/ToolIconWiring.js`の3行、`test/core/SpriteFitRules.test.js`・`VertexHandleRules.test.js`・`VectorModel.selectedVertices.test.js`の3行を足す。
* **1章 フォルダ分割の方針・依存方向**：`SpriteFitRules`・`VertexHandleRules`を`core/`の状態を持たない規則に足す（`SpriteFitRules`は`wiring/`だけが使う＝`ToolRules`と同じ位置づけ、`VertexHandleRules`は`InputTracker`と`main.js`の両方が使う＝`SelectionRules`と同じ位置づけ）。`wiring/ToolIconWiring → asset/sprite/*.js`という新しい依存の向き（`core/`は`asset/`をimportしない）を明記する。
* **2章 スプライト（書き出し形式）**：本アプリ自身のツールのアイコンに書き出し形式のスプライトJSを使っていること（`asset/sprite/`。後日、本アプリで描き直して差し替える仮のもの）を足す。版は2のまま、エンジンへの連絡票は不要。
* **2章 選択状態**：不変条件「選択集合は選択モード以外では空」を「選択モード・頂点の選択モード以外では空」に直す。**頂点の選択**（`VectorModel`が持つ「図形のid＋ハンドル名」の組の配列。保存・履歴・書き出しの対象外。選択集合に含まれる図形の組だけを保つ）の項を足す。
* **3章 描画・操作フロー**：
  * 当たり分類の項へ`includeHandles`（選択モードではハンドルを当たりに含めない）を足す。
  * ツール・操作モードの一覧（`InputModes`・`ToolRules`・ツールパレットの並び）に頂点の選択を足す。
  * キーボード操作の項へ`A`（`Ctrl`+`A`と`ctrl`の値で排他）を足す。
  * 履歴の適用の`shouldRestoreSelection`の実体を「選択モード・頂点の選択モードのときのみ」に直す。
  * 新しい節「18. 頂点の選択（ツールの分割・頂点のハンドルの表示と操作）」を足す（モジュールの分担・操作の規則・発注者の決定・やらないこと・テストプレイの結果）。`drawHandles`が本作業の後は呼ばれなくなること、変形のPhaseで外枠のハンドルを入れるときに去就を決めることを明記する。
  * 1章「存在しないもの」へ、本作業でやらないこと（複数の頂点の選択・まとめ移動、頂点の追加/削除、矢印キーの微調整、ツールごとのカーソル、他のアイコンの差し替え、アイコンの`devicePixelRatio`の変化での描き直し）を足す。
* **4章の一覧**：`SpriteFitRules.js`（`_doc/arch/37_SpriteFitRules.md`）・`VertexHandleRules.js`（`_doc/arch/38_VertexHandleRules.md`）・`wiring/ToolIconWiring.js`（`_doc/arch/39_ToolIconWiring.md`）・`asset/sprite/`（`_doc/arch/40_asset_sprite.md`）の4行を足し、同じ形式のファイルを新設する。
* **4章の各モジュールのファイル**：
  * `_doc/arch/01_index_html.md`：ツールパレットの頂点の選択のボタン、`#tool-select`の中身がJSの作る`<canvas>`になったこと（「アイコンはボタンの中身の1か所だけに書く」の例外。絵の定義はスプライトJS）、`.icon-btn canvas`のルール、`title`のキーの手動同期（`頂点の選択 (A)`）。
  * `_doc/arch/02_main.md`：`applyMode`の引数、`toolActions`の並び、`shouldRestoreSelection`の実体、`renderCurrentState`の新しい引数（`showHandles`・`vertexHandles`）、`// 7.`での`drawToolIcons()`の呼び出し、行数。
  * `_doc/arch/03_VectorModel.md`：頂点の選択の状態と4つの公開メソッド・落とし方・通知の相乗り。
  * `_doc/arch/04_CanvasManager.md`：`render`の引数（`showHandles`・`vertexHandles`）、頂点のハンドルの描画（位置・色・描画順）、`drawHandles`が呼ばれなくなること。
  * `_doc/arch/06_InputTracker.md`：頂点の選択のモードの分岐（mousemove・mousedown・click・`Esc`）、`#classifyPoint`の`includeHandles`と頂点のハンドルの絞り込み、`VertexHandleRules`のimport、行数。
  * `_doc/arch/07_KeyboardShortcuts.md`：`A`のエントリ。
  * `_doc/arch/12_shapes.md`：17メソッド契約 → **18メソッド契約**（`getVertexHandleNames`）、ハンドル名の契約の4つ目、各クラスの一覧の内容。
  * `_doc/arch/16_test.md`：Phase 08-02aの新設・追加分、書き換えた既存のテスト（`ToolRules.test.js`の並びのケース）、テストできない箇所（`CanvasManager`の頂点のハンドルの描画、`InputTracker`の頂点の選択の配線、`wiring/ToolIconWiring`、`asset/sprite/`、`index.html`のボタン）、件数。
  * `_doc/arch/18_PointHitRules.md`：`includeHandles`の追加。
  * `_doc/arch/19_ToolRules.md`：`TOOL_IDS`の並びと頂点の選択の識別子の約束、`resolveActiveTool`の分岐。
  * `_doc/arch/32_InputModes.md`：`OperationMode.VERTEX`。
  * `_doc/arch/35_CursorShapeRules.md`：頂点の選択のモードの分岐と判定の順。
  * `_doc/arch/13_palette.md`：ツールのアイコンの`<canvas>`は`wiring/ToolIconWiring`が作り、`ToolPalette`は関与しないこと。

## 3. タスクリスト

*   [x] タスク1: 要件1-1 操作モードとツールの識別子を足す
    *   **対象ファイル** :
        *   `./js/core/InputModes.js` :（更新）
        *   `./js/core/ToolRules.js` :（更新）
        *   `./test/core/ToolRules.test.js` :（更新）
    *   **作業内容** :
        *   `OperationMode`へ`VERTEX: 'vertex'`を1エントリ足し、JSDocの説明に1行加える。既存の3つの値・`InputState`は変えない。
        *   `ToolRules`の`TOOL_IDS`を`[SELECT, VERTEX, PAN, EYEDROPPER_TOOL_ID, ...SHAPE_TYPES]`にし、JSDocの並びの説明と識別子の約束を更新する。新しい定数は作らない。
        *   `resolveActiveTool`へ頂点の選択のモードの分岐を足し、JSDocを更新する。`picking`の優先は変えない。
        *   `test/core/ToolRules.test.js`：並びの期待値・`EYEDROPPER_TOOL_ID`の位置・先頭の値のケースを直し、頂点の選択のモードが`'vertex'`を返すケース（全図形種別で）を足す。先頭の責務定義のコメントは必要なら更新する。
        *   **このタスクの後、タスク2でボタンを足すまでは、ブラウザのコンソールに`ToolPalette`の`console.warn`（`TOOL_IDS`にあるのに`#tool-vertex`のボタンが無い旨）が出る**（さらにタスク3で`toolActions`を足すまでは、ボタンを押してもモードが切り替わらない）。自動テストは落ちない。異常ではないので対処しない。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`test/core/ToolRules.test.js`の期待値を書き換えるため必須）。

*   [x] タスク2: 要件1-2 ツールパレットのボタンとキー`A`
    *   **対象ファイル** :
        *   `./index.html` :（更新）
        *   `./js/core/KeyboardShortcuts.js` :（更新）
    *   **作業内容** :
        *   `index.html`：先頭の`.tool-palette-group`の`#tool-select`の次に`<button type="button" id="tool-vertex" class="tool-btn icon-btn" title="頂点の選択 (A)"></button>`を足す（中身は空。`aria-pressed`は付けない）。既存の`#tool-select`の`id`・クラス・`title`は変えない（中身の`🖱`はタスク14で空にする）。
        *   `KeyboardShortcuts.js`：`SHORTCUT_BINDINGS`の`KeyH`の次に`A`単体（`ctrl: false`・`ShiftRule.FORBIDDEN`・`repeatable: false`・`action: 'setMode'`・`arg: OperationMode.VERTEX`）のエントリを足す。対応表の先頭のJSDocの修飾キー規則へ「`KeyA`は`ctrl`の値で`A`単体（頂点の選択モード）と`Ctrl`+`A`（全選択）に排他的に分かれる」の1行を足す。新しいactionは足さない。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。

*   [x] タスク3: 要件1-3 `main.js`のモードの受け口
    *   **対象ファイル** :
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `applyMode`の`@param`へ`'vertex'`を足す（JSDocのみ。処理は変えない）。
        *   `toolActions`へ`[OperationMode.VERTEX]: () => applyMode(OperationMode.VERTEX)`を`SELECT`の次（`TOOL_IDS`と同じ並び）に足し、コメントの並びの説明も合わせる。
        *   `SnapshotAdapter`へ注入する`shouldRestoreSelection`を「選択モードまたは頂点の選択のモード」にし、コメントを更新する。`edit/SnapshotAdapter.js`は変更しない。
        *   `ensureSelectMode`は変えない。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。

*   [x] タスク4: 要件4-1 図形の5クラスへ`getVertexHandleNames()`を実装する
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` `./js/shapes/Curve.js` `./js/shapes/Rect.js` `./js/shapes/Ellipse.js` `./js/shapes/Path.js` :（更新）
    *   **作業内容** :
        *   5クラスへ`getVertexHandleNames()`（引数なし・毎回新しい配列）を実装する。内容と並びは2章の要件4のとおり（`Line`は`'move'`を含めない、`Ellipse`は空配列、`Path`は頂点数ぶん）。
        *   各メソッドにJSDoc（責務・`@returns`・並びの根拠＝`getVertexIndexForHandle`の番号の昇順・新しい配列であること）を書く。
        *   5クラスのクラスJSDocの契約の列挙を17メソッド → 18メソッドに更新する（`getVertexHandleNames`を末尾に足す）。
        *   既存のメソッド（`hitTestHandle`・`getVertexIndexForHandle`・`getHandlePosition`・`setVertex`等）は一切変えない。`test/shapes/`は次のタスク5で触る（このタスクでは変更しない）。
        *   JSDocの記載漏れが無いことを確認する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（既存のテストが落ちないこと）。

*   [x] タスク5: 要件4-2 図形の5つのテストへ`getVertexHandleNames()`のテストを足す
    *   **対象ファイル** :
        *   `./test/shapes/Line.test.js` `./test/shapes/Curve.test.js` `./test/shapes/Rect.test.js` `./test/shapes/Ellipse.test.js` `./test/shapes/Path.test.js` :（更新）
    *   **作業内容** :
        *   5つのテストファイルへ、一覧の内容と並び・毎回新しい配列で書き換えても図形が変わらないこと・一覧の各名前が`getVertexIndexForHandle`で番号に、`getHandlePosition`で位置に解決できること（`Path`は開いた・閉じた、頂点数違いの両方）を足す。先頭の責務定義のコメントを更新する。
        *   テストのためにソースへ`export`の追加・privateの公開・処理の切り出しをしない（公開APIのみを通す）。`js/shapes/`は変更しない。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。

*   [x] タスク6: 要件5 頂点の選択の状態（`VectorModel`）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` :（更新）
        *   `./test/core/VectorModel.selectedVertices.test.js` :（新規）
    *   **作業内容** :
        *   非公開フィールド`#selectedVertices`（JSDoc付き）とコンストラクタの初期化（空配列）を足す。
        *   公開メソッド`setSelectedVertices(pairs)`・`clearSelectedVertices()`・`getSelectedVertices()`・`isVertexSelected(shapeId, handle)`を、2章の要件5の規則どおり実装する（JSDoc必須。受理の条件・通知の条件・コピーを返すことを明記）。
        *   非公開の`#pruneSelectedVertices()`を足し、`setSelection`・`clearSelection`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`の`#notifyChange()`の前で呼ぶ（通知の回数を増やさない）。各メソッドのJSDocへ「頂点の選択から選択中でない図形の組を落とす」ことを追記する。
        *   クラス先頭の責務定義のJSDocへ頂点の選択の状態を足す。保存・履歴・書き出しには入れない（`DocumentSerializer`・`SnapshotAdapter`・`SpriteSerializer`は変更しない）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   新規テストを作り、リポジトリのルートで`node --test`を実行して全件通ることを確認する。

*   [x] タスク7: 要件6-1 頂点のハンドルの規則（`VertexHandleRules`）の新設
    *   **対象ファイル** :
        *   `./js/core/VertexHandleRules.js` :（新規）
        *   `./test/core/VertexHandleRules.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。
        *   `collectVertexHandles(mode, shapes, selectedIds, selectedVertices)`と`isVertexHandle(shape, handleName)`を2章の要件6のとおり実装する（JSDoc必須。戻り値の形・引数を書き換えないこと・例外を投げないことを明記）。
        *   importは`core/InputModes`の`OperationMode`のみ。状態・DOM・図形種別の分岐・図形固有のプロパティ名を持たない。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   新規テストを作り、リポジトリのルートで`node --test`を実行して全件通ることを確認する。

*   [x] タスク8: 要件6-2・要件3（描画） 頂点のハンドルを描き、選択モードのハンドルを描かない
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` :（更新）
        *   `./js/main.js` :（更新）
    *   **作業内容** :
        *   `CanvasManager.render`の**第2引数の状態オブジェクト**（実シグネチャは`render(shapes, { hoveredId = null, … } = {})`。第2引数そのものは既存であり、新しい引数を足すのではない）へ、プロパティ`showHandles`（既定`true`）と`vertexHandles`（既定`[]`）を足し、JSDoc（`@param`・描画順の説明）を更新する。
        *   `showHandles`が偽なら選択集合の図形の`drawHandles`の段を行わない。
        *   `vertexHandles`の各図形・各ハンドルを、`drawHandles`と同じ描画順の位置（全図形の描画の後・作成中の図形の前）に描く非公開メソッド（例：`#drawVertexHandles(vertexHandles, scale)`）を足す。見た目・定数・防御は2章の要件6のとおり。図形種別の分岐・図形固有のプロパティ名を持たない。
        *   `main.js`の`renderCurrentState`で`model.getShapes()`を1つのローカル変数にまとめ、`showHandles: false`と`vertexHandles: collectVertexHandles(inputTracker.getMode(), shapes, model.getSelectedIds(), model.getSelectedVertices())`を渡す。`core/VertexHandleRules`のimportを足し、`showHandles: false`の理由（変形のPhaseで去就を決める）をコメントに残す。
        *   再描画・同期の経路は既存のまま（機能専用の経路を足さない）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   JSDocの記載漏れが無いことを確認し、リポジトリのルートで`node --test`を実行して全件通ることを確認する。

*   [x] タスク9: 要件3（当たり判定） `classifyPointHit`に`includeHandles`を足す
    *   **対象ファイル** :
        *   `./js/core/PointHitRules.js` :（更新）
        *   `./test/core/PointHitRules.test.js` :（更新）
    *   **作業内容** :
        *   `classifyPointHit`の第7引数`includeHandles = true`を足し、偽なら`handle`を常に`null`にする（`findHandleHit`を呼ばない）。`bodyId`の求め方・`includeFill`の意味は変えない。
        *   ファイル先頭の責務定義・関数のJSDoc・typedef`PointHit`の説明を更新する。
        *   テストへ、`includeHandles`が偽のときハンドルが`null`で`bodyId`が変わらないこと・真を明示すると省略時と同じであること・`includeFill`と独立であることを足す（既存のケースは変えない）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。

*   [ ] タスク10: 要件7-1 カーソルの形の規則に頂点の選択のモードを足す
    *   **対象ファイル** :
        *   `./js/core/CursorShapeRules.js` :（更新）
        *   `./test/core/CursorShapeRules.test.js` :（更新）
    *   **作業内容** :
        *   判定表へ頂点の選択のモードの分岐を2章の要件7の順・条件で足す（キャンバス移動モードの次・「選択モード以外 → `'default'`」の前）。既存の分岐・順序・結果の文字列は変えない。
        *   関数のJSDocの判定の表を更新する。typedef`CursorShapeInput`は変えない。
        *   テストへ、頂点の選択のモードの各分岐・パン中と`Space`押下中の優先・`isSelected`／`isPickingShape`を呼ばないことを足す（既存のケースは変えない）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。

*   [ ] タスク11: 要件7-2 `InputTracker`に頂点の選択の操作を配線する
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` :（更新）
    *   **作業内容** :
        *   `core/VertexHandleRules`の`isVertexHandle`をimportする。
        *   `#classifyPoint`で`includeHandles`（頂点の選択のモードか）を渡し、頂点の選択のモードでは`hit.handle`を頂点のハンドルだけに絞り込む（2章の要件7）。JSDocを更新する。
        *   `handleMouseMove`：IDLEのホバー・カーソルの処理を頂点の選択のモードにも適用する。
        *   `handleMouseDown`：頂点の選択のモードの分岐（頂点の上なら頂点の選択を置き換えてハンドルのドラッグを開始、本体・空白では何も始めない）を足す。選択モードの分岐・それ以前のパン等の判定は変えない。
        *   `handleClick`：頂点の選択のモードの分岐（頂点／本体／空白。`Ctrl`は見ない。本体・空白では先に頂点の選択を空にしてから`resolveClickSelection(…, false)`の結果を`#applySelectionChange`へ）を足す。
        *   `cancelDraftOrClearSelection()`：頂点の選択があれば頂点の選択だけを空にする分岐を足し、選択の全解除のモードの条件を「選択モードまたは頂点の選択のモード」に広げる。
        *   `deleteSelection`・`selectAll`・`setMode`・`setShapeType`・`abortOngoingOperation`・左ドラッグの各メソッド・パン・`handleWheel`・`handleKeyDown`／`handleKeyUp`は変えない。`PressActionRules`・`SelectionRules`・`UnitSnapRules`・`EndpointSnapper`の呼び方も変えない。
        *   クラス先頭の責務定義・`setMode`／`getMode`の型・各ハンドラの判定順のJSDocを更新する。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   JSDocの記載漏れが無いことを確認し、リポジトリのルートで`node --test`を実行して全件通ることを確認する。

*   [ ] タスク12: 要件2-1 スプライトを描画先へ収める規則（`SpriteFitRules`）の新設
    *   **対象ファイル** :
        *   `./js/core/SpriteFitRules.js` :（新規）
        *   `./test/core/SpriteFitRules.test.js` :（新規）
    *   **作業内容** :
        *   ファイル先頭に単一責務のJSDoc（3行以内）を書く。
        *   `computeSpriteFitTransform(bounds, width, height, padding = 0)`を2章の要件2の規則どおり実装する（JSDoc必須。`null`を返す条件・倍率の求め方・中央寄せ・引数を書き換えないこと・新しいオブジェクトを返すことを明記）。
        *   状態・DOMを持たず、何もimportしない（`asset/`もimportしない）。
        *   新規テスト（横長・縦長・正方形の外枠、余白あり／なし、幅や高さが0の外枠、点、`bounds`が`null`・不正、`width`／`height`／`padding`が不正、余白が領域以上、拡大する場合、引数の非破壊、戻り値の独立性）を作る。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する。

*   [ ] タスク13: 要件2-2 ツールのアイコンのスプライトJSを書き出しの経路で生成する
    *   **対象ファイル** :
        *   `./asset/sprite/select-arrow.js` :（新規）
        *   `./asset/sprite/vertex-arrow.js` :（新規）
    *   **作業内容** :
        *   一時フォルダ（スクラッチパッド）に使い捨ての生成スクリプトを書き、`js/shapes/Path.js`・`js/io/SpriteSerializer.js`・`js/io/CodeExporter.js`を使って2本のJSのテキストを作り、`asset/sprite/`へ書き出す。**リポジトリに生成スクリプト・ビルド手順を残さない**（`test/`以下にも置かない）。
        *   `Path.fromJSON`へ渡すJSONは、**全キー**（`type: 'path'`・`id: 'shape-1'`・`points`（7頂点）・`closed: true`・`segments`（閉じたパスなので要素数7・各要素`{ kind: 'line' }`）・`strokeColor`・`strokeWidth`・`fillColor`）を2章の要件2のとおりに書く（`fromJSON`は`type`・`segments`の要素数・各`kind`を検証するため、1つでも欠けると例外になる）。
        *   書き出したJSが、`export default`に`format`・`formatVersion`（2）・`bounds`・`elements`・`source`・`draw`を持つことを目視で確認する（`io/`・`shapes/`のソースは変更しない）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   リポジトリのルートで`node --test`を実行し、全件通ることを確認する（`asset/`は`test/`の対象外）。

*   [ ] タスク14: 要件2-3 ツールのアイコンの配線
    *   **対象ファイル** :
        *   `./js/wiring/ToolIconWiring.js` :（新規）
        *   `./js/main.js` :（更新）
        *   `./index.html` :（更新）
    *   **作業内容** :
        *   `ToolIconWiring.js`：ファイル先頭に単一責務のJSDoc（3行以内）を書き、`drawToolIcons()`を2章の要件2のとおり実装する（定数`ICON_CANVAS_SIZE`・`ICON_CANVAS_PADDING`、要素が無ければ`console.warn`、`devicePixelRatio`に合わせた`<canvas>`、`computeSpriteFitTransform`の結果での`setTransform`、`sprite.draw(ctx)`）。判定・計算を持たない。
        *   `main.js`：`// 7.`の`ToolPalette`の生成の直後で`drawToolIcons()`を1回だけ呼ぶ（importを足す）。
        *   `index.html`：`#tool-select`の中身の`🖱`を削除して空にする（`id`・クラス・`title`は変えない）。`.icon-btn`のルールの後に`.icon-btn canvas { display: block; }`を足す。`.icon-btn`の既存のルールは変えない。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（ただし各図形の`drawHandles`は残す）。
        *   JSDocの記載漏れが無いことを確認し、リポジトリのルートで`node --test`を実行して全件通ることを確認する。

*   [ ] タスク15: 仕上げの確認（JSDoc・不要なコード・全テスト）
    *   **対象ファイル** :
        *   （確認のみ。問題が見つかった場合のみ該当ファイルを修正する）
    *   **作業内容** :
        *   本作業で追加・変更したすべてのクラス・関数・メソッド・データ構造にJSDocがあり、責務・引数・戻り値が明文化されていることを確認する（記載漏れがあれば補う）。
        *   使われなくなった`import`・関数・定数・コメントが残っていないことを確認する（**ただし要件3の各図形の`drawHandles`と`CanvasManager`の`showHandles`の分岐は残す**）。
        *   `git diff`で、スコープ外のファイル・改名・整形・削除が混ざっていないことを確認する。
        *   リポジトリのルートで`node --test`を実行し、全件通る（`fail 0`）ことを確認し、件数を記録する。

*   [ ] タスク16: 要件8 テストプレイの確認項目を発注者へ提示する
    *   **対象ファイル** :
        *   （提示のみ。ファイルの変更なし）
    *   **作業内容** :
        *   次の確認項目を発注者へ提示する。
        *   **0. 最初に必ずブラウザの強制再読み込み（`Ctrl`+`F5`）を行う**（古いJSが残ると、直したはずの動きが直っていないように見えるため）。
        *   1. **起動時**：ツールパレットの先頭に「黒い矢印」「白い矢印」の2つのボタンが並び、黒い矢印が押し込みになっている。アイコンがつぶれず・ぼやけず描かれている。`title`にキー（`選択 (V)`・`頂点の選択 (A)`）が出る。
        *   2. **ツールの切り替え**：ボタンのクリック・`V`・`A`で押し込みが切り替わる。`Ctrl`+`A`（全選択）は今までどおり選択ツールへ切り替わって全部選ばれる。
        *   3. **選択（`V`）**：図形をクリックで選べる。**ハンドル（白い四角・直線の中点の丸・円の5点）が出ない**。選んだ図形の本体をドラッグすると動く。`Shift`で方向が限定される。`Alt`+ドラッグで複製される。`Ctrl`+クリック・範囲選択での追加・解除が今までどおり。
        *   4. **選択（`V`）でできなくなること**：矩形の角・円の半径をドラッグして変える操作ができない（ハンドルが無いため。意図した変更）。
        *   5. **頂点の選択（`A`）の表示**：図形をクリックすると、直線は2点、曲線は3点、矩形は4点、パスは頂点の数だけハンドルが出る。**円・弧はハンドルが出ない**。
        *   6. **頂点の選択**：頂点をクリックすると、その頂点だけ見た目が変わる（青く塗られる）。ほかの頂点をクリックすると選び直される。別の図形の本体をクリックすると、その図形の頂点に変わる。
        *   7. **頂点の移動**：頂点をドラッグすると、その頂点だけが動く（ほかの頂点・図形は動かない）。矩形は角だけが動いて台形になる。
        *   8. **頂点の移動とスナップ**：表示倍率を110%にし、グリッドを10pxにして、`?dev`で読み込んだ小数の座標の図形の頂点をドラッグすると、スナップの単位に丸められる。`Ctrl`を押している間は丸められない。
        *   9. **頂点の移動と端点への吸い付き**：直線の端点をドラッグすると、今までどおり別の線の端点へ吸い付く（印が出る）。`Ctrl`の間は吸い付かない。
        *   10. **本体のドラッグ**：頂点の選択（`A`）で図形の線の上をドラッグしても、何も起きない（図形は動かない・範囲選択も始まらない）。
        *   11. **`Esc`**：頂点を選んだ状態で`Esc`を押すと頂点の選択だけ解けて頂点は出たまま、もう一度押すと図形の選択も解ける。
        *   12. **`Delete`**：頂点の選択（`A`）で`Delete`・`Backspace`を押しても図形が消えない（ツールバーの削除ボタンも押せるが何も起きない。「5. 懸念事項」を参照）。選択（`V`）に戻すと今までどおり消せる。
        *   13. **取り消し・やり直し**：頂点を動かした後の`Ctrl`+`Z`で位置が戻り、`Ctrl`+`Y`でやり直せる。頂点の選択そのものは取り消しの対象にならない。
        *   14. **カーソルの形**：頂点の選択（`A`）で、頂点の上は`move`、図形の線の上は`pointer`、空白は矢印。スペースを押している間は手の形。
        *   15. **ほかの操作**：図形の作成（1〜5）・パン（`H`・スペース・中ボタン）・ズーム・表示の切り替え（`Z`・`X`・`C`・▢◐▦）・スタイル・重なり順・結合（`J`）・クリップボード・キャンバスパレット・ファイル操作が今までどおり。
        *   16. **入力欄との競合**：太さの欄・色の欄にフォーカスがある間、`A`・`V`でツールが切り替わらない（文字が入る／欄の操作になる）。`Tab`の扱いも今までどおり。
        *   17. **線の上の強調表示（これでよいか答えてほしい）**：頂点の選択（`A`）で図形を1つ選び、その図形や別の図形の線の上にマウスを乗せる。選択（`V`）のときと同じように線が強調される（色が変わる）。**頂点の選択のときもこの強調表示を出したままでよいか**（出さない方がよければ指示がほしい）。
        *   18. **削除ボタンの見た目（これでよいか答えてほしい）**：頂点の選択（`A`）で図形を1つ選ぶと、ツールバーの削除ボタンが押せる見た目（薄くならない状態）のままになる。押しても図形は消えない。**この見た目のままでよいか**（押せない見た目にしたければ指示がほしい）。

*   [ ] タスク17: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新）
        *   `./_doc/arch/01_index_html.md` `./_doc/arch/02_main.md` `./_doc/arch/03_VectorModel.md` `./_doc/arch/04_CanvasManager.md` `./_doc/arch/06_InputTracker.md` `./_doc/arch/07_KeyboardShortcuts.md` `./_doc/arch/12_shapes.md` `./_doc/arch/13_palette.md` `./_doc/arch/16_test.md` `./_doc/arch/18_PointHitRules.md` `./_doc/arch/19_ToolRules.md` `./_doc/arch/32_InputModes.md` `./_doc/arch/35_CursorShapeRules.md` :（更新）
        *   `./_doc/arch/37_SpriteFitRules.md` `./_doc/arch/38_VertexHandleRules.md` `./_doc/arch/39_ToolIconWiring.md` `./_doc/arch/40_asset_sprite.md` :（新規）
    *   **作業内容** :
        *   本計画書の『開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定』欄と、各タスクで追記された更新予定をすべて反映する。
        *   新しいモジュールのファイルは`_doc/arch/`の既存の形式に合わせて作り、`PROJECT_ARCHITECTURE.md`4章の一覧に行を足す。
        *   記載基準（残す：責務と境界・依存方向・流れと順序の保証・誰が呼ぶか・設計判断の理由・やらないと決めたこと／書かない：1つのファイルのJSDocを読めば分かること）に従う。
        *   実コードと食い違う記述を作らないこと（迷ったら実コードを確認する）。
        *   `_doc/arch/40_asset_sprite.md`に、`asset/sprite/`のJSは書き出しの経路（`CodeExporter`）が作る生成物であり、先頭には`CodeExporter`の固定のヘッダコメント（`OZ Vector Editor が出力したスプライト…`）が入って**「責務:」の語を含まない**こと（憲法の責務コメントの書き方とは別であること）を明記する（監査時の誤検知を防ぐため）。
        *   **この最終タスクのみ、実装AIによる開発資料の書き換えを明示的な例外として認める**。個別の実装タスク内では書き換えない。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1-1 操作モードとツールの識別子を足す
*   **作業内容** :
    *   `InputModes.js`：`OperationMode`へ`VERTEX: 'vertex'`を足し、JSDocに1行加えた。
    *   `ToolRules.js`：`TOOL_IDS`を`[SELECT, VERTEX, PAN, EYEDROPPER_TOOL_ID, ...SHAPE_TYPES]`にし、`resolveActiveTool`へ`VERTEX`の分岐（選択の次）を足し、JSDocを更新した。新しい定数は無い。
    *   `ToolRules.test.js`：並び・`EYEDROPPER_TOOL_ID`の位置（4番目）・先頭3つのケースを直し、頂点の選択モードのケースを足した。
    *   `node --test`：1302件全て合格。

### タスク2: 要件1-2 ツールパレットのボタンとキー`A`
*   **作業内容** :
    *   `index.html`：`#tool-select`の次に`#tool-vertex`のボタン（中身は空）を足した。
    *   `KeyboardShortcuts.js`：`KeyH`の次に`KeyA`単体（VERTEX）のエントリを足し、JSDocの修飾キー規則へ`KeyA`の1行を足した。
    *   `node --test`：1302件全て合格。

### タスク3: 要件1-3 `main.js`のモードの受け口
*   **作業内容** :
    *   `applyMode`の`@param`へ`'vertex'`を足した。`toolActions`へ`VERTEX`を`SELECT`の次に足し、JSDocの説明も更新した。`shouldRestoreSelection`を選択モードまたは頂点の選択モードで真にし、コメントを更新した。`ensureSelectMode`・`SnapshotAdapter.js`は変更なし。

### タスク4: 要件4-1 図形の5クラスへ`getVertexHandleNames()`を実装する
*   **作業内容** :
    *   `Line`（`['start','end']`）・`Curve`（`['start','control','end']`）・`Rect`（4つの角）・`Ellipse`（`[]`）・`Path`（`points`の数だけ`'vertex-<i>'`）へ、`getHandlePosition`の次に`getVertexHandleNames()`をJSDoc付きで足した。毎回新しい配列を返す。
    *   5クラスのクラスJSDocの契約の列挙を17メソッド → 18メソッドにし、末尾へ`getVertexHandleNames`を足した。既存のメソッド・`test/shapes/`は変更なし。
    *   `node --test`：1302件全て合格。
    *   監査指摘の修正：`Path.getVertexHandleNames()`のハンドル名を文字列リテラルから既存の定数`VERTEX_HANDLE_PREFIX`へ一本化した（挙動は変更なし）。

### タスク5: 要件4-2 図形の5つのテストへ`getVertexHandleNames()`のテストを足す
*   **作業内容** :
    *   `Line`・`Curve`・`Rect`の各テストへ、一覧の内容と並び・毎回新しい配列で書き換えても図形（`toJSON`）が変わらないこと・各名前が`getVertexIndexForHandle`で番号（並びの添字）に、`getHandlePosition`で位置に解決できることのテストを足した。`Ellipse`は円・弧とも空配列であることと、新しい配列・不変のテスト。`Path`は開いた・閉じた・頂点数2/4/5の一覧、新しい配列・不変、番号・位置の解決のテスト。
    *   5ファイルの先頭の責務定義へ`getVertexHandleNames`を足した。`js/`は変更なし。
    *   `node --test`：1316件全て合格。

### タスク6: 要件5 頂点の選択の状態（`VectorModel`）
*   **作業内容** :
    *   `VectorModel.js`：非公開`#selectedVertices`（初期は空配列）と、公開4メソッド`setSelectedVertices`・`clearSelectedVertices`・`getSelectedVertices`・`isVertexSelected`を追加。非公開`#pruneSelectedVertices()`を`setSelection`・`clearSelection`・`deleteShapes`・`replaceAllShapes`・`addShapesWithNewIds`・`replaceShape`の`#notifyChange()`の前で呼ぶ（通知回数は増えない）。各JSDocと先頭の責務定義を更新。
    *   `test/core/VectorModel.selectedVertices.test.js`を新規作成（15ケース）。`node --test`は1331件全件合格。
    *   保存・履歴・書き出しには入れていない（`DocumentSerializer`・`SnapshotAdapter`・`SpriteSerializer`は未変更）。

### タスク7: 要件6-1 頂点のハンドルの規則（`VertexHandleRules`）の新設
*   **作業内容** :
    *   `js/core/VertexHandleRules.js`を新規作成（`collectVertexHandles`・`isVertexHandle`。importは`OperationMode`のみ、状態・DOM・図形種別の分岐なし）。
    *   `test/core/VertexHandleRules.test.js`を新規作成（実物の図形5種別）。`node --test`全件合格（1339件）。

### タスク8: 要件6-2・要件3（描画） 頂点のハンドルを描き、選択モードのハンドルを描かない
*   **作業内容** :
    *   `CanvasManager.render`の状態オブジェクトへ`showHandles`（既定`true`）・`vertexHandles`（既定`[]`）を追加。JSDoc・描画順の説明を更新。`showHandles`が偽なら`drawHandles`の段を行わない。
    *   定数5つ（`VERTEX_HANDLE_*`）と非公開メソッド`#drawVertexHandles`を追加（`drawHandles`と同じ位置で描画。倍率の防御・`save/restore`あり）。
    *   `main.js`の`renderCurrentState`で`shapes`を1回取得し、`showHandles: false`と`collectVertexHandles(...)`の結果を渡す。`VertexHandleRules`をimport。
    *   `node --test`: 1339件全件合格。

### タスク9: 要件3（当たり判定） `classifyPointHit`に`includeHandles`を足す
*   **作業内容** :
    *   `js/core/PointHitRules.js`：`classifyPointHit`の第7引数`includeHandles = true`を足し、偽なら`findHandleHit`を呼ばず`handle`を`null`にした。責務定義・JSDoc・typedef`PointHit`を更新。
    *   `test/core/PointHitRules.test.js`：`includeHandles`のケース3件（偽でhandleがnull・bodyId不変／true明示＝省略時／includeFillと独立）を追記。

### タスク10: 要件7-1 カーソルの形の規則に頂点の選択のモードを足す
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク11: 要件7-2 `InputTracker`に頂点の選択の操作を配線する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク12: 要件2-1 スプライトを描画先へ収める規則（`SpriteFitRules`）の新設
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク13: 要件2-2 ツールのアイコンのスプライトJSを書き出しの経路で生成する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク14: 要件2-3 ツールのアイコンの配線
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク15: 仕上げの確認（JSDoc・不要なコード・全テスト）
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク16: 要件8 テストプレイの確認項目を発注者へ提示する
*   **作業内容** :
    *   （タスク実行時に記入）

### タスク17: 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）への反映
*   **作業内容** :
    *   （タスク実行時に記入）

## 5. 懸念事項・要確認ポイント

1. **頂点の選択のモードでも選択集合が空でなくなることの波及（要確認）**：本作業で不変条件が「選択集合は選択モード・頂点の選択モード以外では空」に変わる。その結果、頂点の選択（`A`）のままでも、選択中の図形に対して次が働くようになる（いずれも**既存の動きを変えたわけではなく、新しいモードでの新しい動き**）。
   * ツールバーの**削除ボタンが押せる状態になるが、押しても何も起きない**（`InputTracker.deleteSelection()`の受理条件が選択モードのままのため。発注者の決定「`A`で`Delete`は何もしない」に合わせた結果）。押せないようにするには`main.js`の`syncDeleteButtonState`へ操作モードの判定を足すことになり、「`main.js`に判定を持たせない」方針とスコープの両方に触れるため、本作業では行っていない。**ボタンを押せなくすべきかを確認したい。**
   * 結合（`J`・結合ボタン）・重なり順の変更・コピー（`Ctrl`+`C`）・複製（`Ctrl`+`D`）・オプションバーのスタイルの変更は、頂点の選択のモードでも選択中の図形に対して働く。切り取り（`Ctrl`+`X`）は削除が受理されないため何も起きない。
2. **頂点の選択のモードでのホバーの強調（要確認）**：REQはカーソルの形だけを定めているため、ホバーの強調（`drawHover`）は選択モードと同じ扱い（本体の上で強調する）にした。頂点の選択のモードでは強調しない方がよければ指示がほしい。
3. **`main.js`の`toolActions`への追記**：REQの要件1の`main.js`の項目には明記されていないが、これが無いとツールパレットのボタンが働かない（開発資料4章`main.js`の「新しいツールの足し方」に従った）。
4. **要件6の表示のための規則のモジュール（`core/VertexHandleRules`）の新設**：REQは要件6で新しいモジュールを明示していないが、`CanvasManager`が位置を引数で受け取り（REQ要件6）、`main.js`が判定・計算を持たない（憲法・開発資料）という2つの制約を同時に満たすには、`core/`に状態を持たない規則を1つ置くのが唯一の素直な置き場所と判断した。あわせて`InputTracker`が「頂点のハンドルか」を判定するための`isVertexHandle`も同じファイルに置き、ハンドル名の一覧の読み取りを1か所にまとめた。自動テストも足す。
5. **`render`の`showHandles`に`main.js`が常に`false`を渡すこと**：本作業の後、`drawHandles`はどのモードでも呼ばれない。REQの「`CanvasManager.render`は状態を持たないまま、ハンドルを描くかを呼び出し側から受け取る」「各図形の`drawHandles`は消さない」に従い、引数と図形のメソッドは残したうえで、呼び出し側が`false`を渡す形にした（変形のPhaseで外枠のハンドルを入れるときに去就を決める）。
6. **選ばれている頂点の色（目視確認したい）**：青い枠はそのままに、塗りを枠と同じ青（`#4a90e2`）にして見分ける。黒の背景でも見えるはずだが、見分けやすさは画面で確認してほしい。
7. **ツールのアイコンの大きさ（目視確認したい）**：`.icon-btn`は32×32のまま、中の`<canvas>`を20×20（余白1px）にする。既存の1文字のアイコン（`font-size: 16px`）と並べたときの大きさ・位置のバランスは画面で確認してほしい。矢印の形（頂点の座標）も仮のものであり、後日本アプリで描き直して差し替える前提。
8. **アイコンの`devicePixelRatio`の変化**：起動時に1回だけ描くため、ウィンドウを別の解像度のディスプレイへ移すとアイコンだけがぼやけたままになる（再読み込みで直る）。本作業では描き直しを行わない。
9. **`asset/sprite/`のJSの生成**：書き出しの経路（`SpriteSerializer` → `CodeExporter`）で作るため、`io/`・`shapes/`のソースは変更しない。生成に使うスクリプトは一時フォルダに置いて使い捨て、リポジトリには残さない（ビルド手順を足さないため）。
10. **既存のテストの書き換え**：`test/core/ToolRules.test.js`の`TOOL_IDS`の並び・`EYEDROPPER_TOOL_ID`の位置・先頭の値のケースのみ、REQが明示的に変更を求めているふるまい（ツールの並び）に合わせて期待値を直す。`test/core/PressActionRules.test.js`・`CursorShapeRules.test.js`の既存ケース・`test/core/PointHitRules.test.js`の既存ケースは変えない（いずれも既定値のまま通る）。
11. **頂点の選択のモードのクリックで変更通知が2回出ること**：頂点の選択（`A`）で図形の本体・空白をクリックすると、頂点の選択の解除（`clearSelectedVertices`）と選択集合の変更（`#applySelectionChange`）で`#notifyChange()`が2回出る（再描画も2回）。既存の経路だけを使い、**機能専用の経路を足さないこと**を優先した結果であり、見た目・結果に違いは出ない（REQの「性能の改善を目的とした変更を行わない」にも沿う）。1回にまとめるには`VectorModel`へ専用のメソッドを足すことになるため、本作業では行わない。
12. **`asset/sprite/`の生成されるJSの先頭のコメント**：書き出しの経路（`CodeExporter`）で作るため、生成されるJSの先頭には`CodeExporter`の固定のヘッダコメントが入り、**「責務:」の語は含まれない**（憲法3章の「すべての`.js`の最先頭行に責務を書く」との関係で、監査時に違反と誤検知されやすい）。生成物であり手で書き換えないものなので、その旨を資料（`_doc/arch/40_asset_sprite.md`）側に明記する（最終タスクの作業内容に含めた）。
