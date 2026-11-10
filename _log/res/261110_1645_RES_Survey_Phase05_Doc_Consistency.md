# RES: 作業レポート Survey : Phase 5 クローズの開発資料の整合確認
* 参照元REQ: `./_log/req/261110_1645_REQ_Survey_Phase05_Doc_Consistency.md`

## 1. 調査目的
Phase 5「パスの基礎」の期間に書き換えられた開発資料（`PROJECT_ARCHITECTURE.md` と `_doc/arch/` 配下の11ファイル）の、差分の `+` 行に書かれた事実の主張が、Phase 5 終了時点（現在の `HEAD`）の実コードと食い違っていないかを確かめる。特に、後のサブフェイズ（05-03・05-04）のコード変更によって、前のサブフェイズで書いた記述が古くなっていないかを見る。

## 2. 調査方針
* `git diff 8fdefcd d569bbf -- PROJECT_ARCHITECTURE.md _doc/arch` の `+` 行（12ファイル）を取得し、コードで真偽を確かめられる主張を資料のファイル（節）ごとに実コードと照合した。
* 照合に使った実コード：`index.html`、`js/` 配下（`main.js`、`core/`、`edit/`、`shapes/`、`io/DocumentSerializer.js` ほか）、`test/` 配下（テストのタイトル・import・該当ケースの本文）。
* 数値は実測した。`wc -l js/main.js` ＝ 593、`wc -l js/core/InputTracker.js` ＝ 1310。
* 自動テストの記述の裏付けとして `node --test` を1回実行した（読み取りのみ。結果は 646 tests・pass 646・fail 0）。
* 本調査でソースコードおよび資料ファイルは変更していない（`git status` で、作業開始時から追加された変更がないことを確認済み。未追跡は `.vscode/` と本REQのみ）。
* 「意図・方針」の記述（発注者の決定・やらないこと・注意）は、コードの振る舞いとして確かめられる範囲だけを照合した。
* `_doc/COWORK_STATUS.md`（`06_InputTracker.md` の「再分離の候補は〜2章A」）は、REQが読む範囲として許可していないため内容を照合していない（ファイルの存在のみ `ls` で確認）。

## 3. 対象ファイル
* `./PROJECT_ARCHITECTURE.md`（資料）
* `./_doc/arch/01_index_html.md`・`02_main.md`・`03_VectorModel.md`・`04_CanvasManager.md`・`06_InputTracker.md`・`07_KeyboardShortcuts.md`・`08_HistoryManager.md`・`10_ShapeFactory.md`・`12_shapes.md`・`14_edit.md`・`16_test.md`（資料）
* 照合した実コード：`./index.html`、`./js/main.js`、`./js/core/{VectorModel,CanvasManager,InputTracker,KeyboardShortcuts,ShapeFactory,ViewTransform,HistoryManager}.js`、`./js/edit/{PathJoiner,EndpointSnapper,CanvasLibrary,SnapshotAdapter}.js`、`./js/shapes/*.js`（9ファイル）、`./js/io/DocumentSerializer.js`、`./test/**`

## 4. 調査結果
* **調査内容**: 差分の `+` 行の主張を節ごとに照合した。以下、一致したものは「一致」と記す。相違は5章に記載した。

### 4.1 `PROJECT_ARCHITECTURE.md`
* **1章 フォルダ構成図**（`js/shapes/` の9ファイル、`js/edit/` の `PathJoiner.js`・`EndpointSnapper.js`、`test/` 配下）：`js/` 配下の各フォルダのファイル一覧が図と一致（`shapes/` 9、`edit/` 7、`core/` 9、`io/` 6、`palette/` 4、`check/` 3）。`test/` 配下も図の16＋α個（`core/` 3、`shapes/` 7、`io/` 7、`edit/` 4、`check/` 1）が実在し、過不足なし。一致。
* **1章 `shapes/` 層・`edit/` 層の説明**：図形クラスだけが使う共通関数＝`ShapeGeometry.js`・`ShapeDataValidation.js`（図形クラス5つからのみ import されている）、第3の種類＝`PathJoinRules.js`・`EndpointSnapRules.js`。`edit/` で `shapes/` を import するのは `PathJoiner.js`（`PathJoinRules`）と `EndpointSnapper.js`（`EndpointSnapRules`・`PathJoinRules`）のみ（`js/` 全体の import を grep で確認）。一致。
* **1章 依存方向**：`PathJoiner`→`PathJoinRules`、`EndpointSnapper`→`EndpointSnapRules`・`PathJoinRules`、`EndpointSnapRules`→`PathJoinRules`（`EndpointSnapRules.js:5`）、`PathJoinRules`→`Path` のみ（`PathJoinRules.js:5`）で循環なし。`InputTracker.js` は `edit/` を import せず（import は `DragTracker`・`ShapeFactory` のみ）、`main.js` が `EndpointSnapper` を第5引数に注入（`main.js:109-115`）。一致。
* **2章 頂点の保持形式**：`Line` は `x1,y1,x2,y2`（`Line.js:33`）、`Curve`/`Rect`/`Ellipse`/`Path` は `points` 配列（`Curve.js:42`・`Rect.js:35`・`Ellipse.js:62`・`Path.js:77`）。一致。
* **2章 図形データ（`path`）**：`toJSON` のキー順 `type,id,points,closed,segments,strokeColor,strokeWidth`（`Path.js:295-309`）、`closed` は真偽値のみ（`Path.js:333`付近）、`segments` の要素数 開いた `n-1`・閉じた `n`（`Path.js:84-87`・`fromJSON`）、`kind` は `'line'` のみ（`Path.js:25-33`）、区間の要素の余分なキーは無視（`fromJSON` が `kind` だけ写す）、頂点数の下限 開いた2・閉じた3・上限なし（`Path.js:10-19`）、長さ0の区間は可（テストあり）。作業データの版は `CURRENT_DOCUMENT_VERSION = 1` のまま（`DocumentSerializer.js:18`）。未知の種別は `ShapeFactory.fromJSON` が `Error` を投げる。一致。
* **2章 スプライトの `polyline`**（`line`・`rect`・`path`）：`Line.toDrawElement`（`closed:false`・2点、`Line.js:204-215`）、`Rect.toDrawElement`（`closed:true`・4点、`Rect.js:216-225`）、`Path.toDrawElement`（`closed` のとおり・全頂点・始点を重複させない、`Path.js:277-286`）。区間の種類は出さない。キー順 `kind,id,points,closed,strokeColor,strokeWidth` 一致。
* **2章 保存対象／保存しないもの／吸い付きの表示の点**：`SnapshotAdapter.capture` は図形一式（`DocumentSerializer.serialize`）と選択集合のみ。吸い付きの表示の点は `VectorModel.#snapPoint` に持ち（`VectorModel.js:93`）、`InputTracker` が `setSnapPoint`/`clearSnapPoint` を呼ぶ。一致。
* **3章 読み込み完了前の操作**：`#canvas-loading-cover` は `hidden` なしで始まり（`index.html:267`）、`z-index: 5` でキャンバスより前面・フロートウィンドウより背面（`index.html:213-229`）。`performJoin` に読み込み中の判定はない（`main.js:238-243`）。`?dev` の復元は `canvasLibrary.getState().loading` で拒否（`main.js:539-541`）。`CanvasLibrary` は読み込み中の開く・新規作成等を受理しない（`#canAcceptOperation()` が `!this.#isLoading` を含み、`CanvasLibrary.js:666-668`。なお `canManage` は `issue !== 'unavailable'` のみで読み込み中とは無関係、`:638`）。一致。
* **3章 キーボード操作**：`InputTracker` は `Space` のみ keydown を解釈（`InputTracker.js:807-813`付近）、`KeyboardShortcuts` は keyup を購読しない。コールバック一覧（`performJoin` を含む）一致（`main.js:455-519`）。
* **3章 6. 記録する操作と時点**：図形の作成（`handleClick` の `DRAWING` 確定、`commitDrawnLine` を先に呼び、偽のときだけ `beginEdit`→`commitDraft`→`commitEdit`、`InputTracker.js:750-756`）。ドラッグの開始・確定・中断（`#onLeftDragStart` で `beginEdit`、`#finishLeftDrag` で `commitEdit`、`InputTracker.js:934`・`1060-1062`）。端点のハンドルを吸い付いて離した場合の結合・閉じるは `#onLeftDragEnd` で `#finishLeftDrag` の前に `joinDraggedEndpoint`（`InputTracker.js:1006-1009`）。結合は `PathJoiner.join` で `beginEdit`→`replaceShape`→`commitEdit`（`PathJoiner.js:83-88`）、結合できない選択では記録しない。一致。
* **3章 11. 結合**：流れ（`performJoin` → `pathJoiner.join()` → `planJoin(重なり順の選択図形, 5pxのワールド換算)` → `beginEdit` → `replaceShape` → `commitEdit`）、`syncJoinButtonState` が `canJoin()` で `disabled` を更新（`main.js:250-255`）、`canJoin` は表示倍率を見ない、基準の線A＝`getShapes()` の並びで奥、2本の結合は A の位置に新しいid（`keepId:false`）で B を除く、閉じるは `keepId:true`（`PathJoinRules.js:308-321`）、重なり＝5px以内（`<=`）、重なる端点は1つにまとめ離れていれば区間でつなぐ（`assembleOpenPath`）、結果は開いたパス（自動で閉じない、`buildJoinedPath`／`buildJoinedPathAt`）、結合後は結果だけを選択（`replaceShape` の `select` 既定が真）。「端点を指定する入口」として挙げた5つの関数は全て `export` され、`assembleOpenPath`・`planCloseOf`（非公開）を共有する。描き足しの規則（元のid・色・太さ・位置・向きを保つ、足す頂点が端点と重なれば `null`）一致。吸い付きでの結合（つなぐ端点は指定された端点で `planJoinAt` が `buildJoinedPathAt` を使う）一致。`InputTracker.hitTolerance` は5（`InputTracker.js:341`）で `JOIN_TOLERANCE_SCREEN_PX`（`PathJoinRules.js:12`）とは別定義。
* **3章 12. 端点への吸い付きと描き足し**：モジュールの分担、流れ（描き始め＝クリック位置で照会して保持・表示・吸い付いていれば端点の座標で `startDraft`、`InputTracker.js:781-784`／描いている途中＝mousemoveごとに照会して終点を追従、`InputTracker.js:627-631`／描き終え＝`commitDrawnLine(#drawStartSnap, #drawEndSnap)`、描き終えの端点は直前のmousemoveの結果、`InputTracker.js:751`／ハンドルのドラッグ＝開始時に `resolveDragEndpoint`、更新ごとに `findDragSnap`→表示→`updateVertex`、`InputTracker.js:915-919`・`978-990`）一致。`commitDrawnLine` は両方 `null` なら `false`、それ以外は `cancelDraft` の後に計画を反映し、計画なしなら記録しない（`EndpointSnapper.js:131-155`）。吸い付く距離＝8px（`EndpointSnapRules.js:13`、ちょうどを含む `<=`、`EndpointSnapRules.js:79`）。対象は結合できる線の端点のみ。閉じられない場合は自身のもう一方の端点に吸い付かない（`canCloseByMergingEnds`＝頂点4つ以上の開いたパス、`EndpointSnapRules.js:72-78`）。頂点2つの線は閉じない（`buildClosedPath` は `Line` に対し `null`）。選択集合は作成モードでは `select:false`、ドラッグでは `select:true`（`EndpointSnapper.js:148-153`・`EndpointSnapper.js:182-186`付近）。表示＝中を青（`#4a90e2`）で塗った8pxの正方形・画面上で一定（`CanvasManager.js:97-115`・`253-266`）。「別の定義」の4つ（8px・5px・`hitTolerance` 5px・`SNAP_INDICATOR_SIZE` 8）は互いに別の定数。
* **3章 12. 表示を消す箇所**：`#resetSnapState()` の呼び出し元は 描き終え（`InputTracker.js:757`）・`cancelDraftOrClearSelection` の `DRAWING` 分岐（`:495`）・`setShapeType`（`:421`）・`#abortOngoingOperation`（`:574`）・`#finishLeftDrag`（`:1064`）の5か所。`#beginPan` が `clearSnapPoint`（`:1106`）。図形作成モードの IDLE で直線以外の図形種別の mousemove は `findDrawSnap` が `null` を返し `clearSnapPoint`（`:636`・`#showSnap`）。`VectorModel.replaceAllShapes` が表示の点を消す（`#snapPoint = null` は `VectorModel.js:428`）。`InputTracker.js` の `clearSnapPoint` の直接の呼び出しは `#showSnap` の `:588`・`#resetSnapState` の `:601`・`#beginPan` の `:1106` の3か所、`setSnapPoint` の呼び出しは `#showSnap` の `:586` のみ、`#showSnap` の呼び出し元は `:630`（DRAWING の mousemove）・`:636`（IDLE かつ作成モードの mousemove）・`:783`（描き始めのクリック）・`:983`（端点のハンドルのドラッグの更新）の4か所（全呼び出し元を洗い直した）。`VectorModel` 内で `#snapPoint` を `null` にするのは `clearSnapPoint`（`:237`）・`replaceAllShapes`（`:428`）・初期化（`:93`）のみ。`:630`・`:783` も照会結果が `null` なら表示を消すが、これらは表示を「更新する」箇所で、資料の「配線の場面」に含まれる。`:983` は DragTracker の onMove（`:899`）に加え `handleWheel` からも到達する（下記）。`replaceAllShapes` の呼び出し元は `SnapshotAdapter.restore`（取り消し/やり直し）・`CanvasLibrary`（切り替え、`:948`）・`main.js` の `?dev` 復元（`:548`）の3つで、記述のとおり。インポートは `prepareInsert: () => applyMode(SELECT)`（`main.js:365`）→`setMode`→`#abortOngoingOperation`（同じモードの再指定でも常に実行、`setMode` は `InputTracker.js:382-396`、呼び出しは `:388`）→`#resetSnapState()`。パンの開始で表示は消すが `#drawEndSnap` は残す（`:1085-1107`）、`handleWheel` 自体は `clearSnapPoint` を直接呼ばないが、**端点のハンドルを閾値超過でドラッグ中のホイールは `#applyLeftDragUpdate`→`#showSnap(null)`→`clearSnapPoint` で表示を消し得る**（`InputTracker.js:848-849`・`:980-983`・`:584-588`。DRAWING・IDLE では `#isLeftDragState()` が偽で再照会が走らず表示は残る）。この点は資料の「ズームは表示を消さない」と相違する（5章）。上記以外の消去箇所の一致は変わらない。
* **3章 12. やらないこと**：曲線・矩形・円・弧・閉じたパスの点／途中の頂点への吸い付き（`findSnapTarget`・`resolveEndpointHandle` の対象外）、本体・moveハンドルのドラッグでの吸い付き（`#dragEndpoint` が端点のハンドルのときのみ）。一致。

### 4.2 `_doc/arch/01_index_html.md`
* `title` に `(J)` を併記（`index.html:278` ＝「選択中の線を結合 (J)」）、`.selection-button-row`（`index.html:130-138`）で `#selection-delete` と `#selection-join` を1行に並べる（`:276-279`）、`#selection-join` は `disabled` で始まる（`:278`）、`syncJoinButtonState` が同期（`main.js:250`・`576`）。一致。

### 4.3 `_doc/arch/02_main.md`
* 行数 593（実測）。配線ブロックの表：`// 4.` に `EndpointSnapper`・`InputTracker`・`renderCurrentState`・再描画の登録（`main.js:106-146`）、`// 6.` に `PathJoiner` の生成（`:223`）・`performJoin`（`:238`）・`syncJoinButtonState`（`:250`）、`// 7.5.` に `ShapeInserter`・`ClipboardController`、`// 7.6.` に `canvasLibrary`→`canvasFileOperations`→`canvasPalette` の順（`:349`・`:360`・`:369`）、`// 8.`・`// 9.`。一致。
* 注入の表（`EndpointSnapper`・`InputTracker`〔第5引数 `snapAssist`＝`endpointSnapper`〕・`PathJoiner`・`KeyboardShortcuts` の `join` ほか15コールバック）一致。
* 生成順の制約：`historyManager`（`:58`）→`endpointSnapper`（`:109`）→`inputTracker`（`:115`）の順。`renderCurrentState` が `snapPoint: model.getSnapPoint()` を渡す（`:129`）。
* 主な関数13個はすべて `main.js` に存在。同一経路の原則（結合ボタンは `performJoin()` のみ呼ぶ、`:258`）、押せる/押せない状態（結合ボタンは `model.onChange` に登録、`:255`）一致。

### 4.4 `_doc/arch/03_VectorModel.md`
* 公開メソッドの一覧：実際の公開メソッド（`addShape`〜`onChange`）と過不足なし。`setSnapPoint` は同座標で通知しない（`VectorModel.js:222-229`）、`clearSnapPoint` は表示中のみ通知（`:233-239`）、`getSnapPoint` はコピー（`:245-247`）、`replaceAllShapes` は点も消して通知1回（`:424-428`）。`replaceShape`：通知1回（`:523`）、`select` 既定は真で結果だけ選択・偽なら消えたidだけ外す（`:514-519`）、`keepId` が真なら指定idを引き継ぎ偽なら `#issueId()`（`:507`）。呼び出し元は `PathJoiner`（`select` 既定）と `EndpointSnapper`（描き足し等は `false`、ドラッグでの結合は `true`）。一致。

### 4.5 `_doc/arch/04_CanvasManager.md`
* 公開メソッド `render(shapes, { hoveredId, selectedIds, draftShape, selectionRect, view, snapPoint } = {})`・`resize()`（`render` が `CanvasManager.js:189`、`resize` が `:148`）。呼び出し元は `main.js`（`:124`）のみ（`check/` は別の描画クラス）。描画順（グリッド→軸線・原点→図形＋ホバー→ハンドル→ドラフト→吸い付き→選択矩形）と `draw` に `t` を渡さないこと一致（`:192-240`）。

### 4.6 `_doc/arch/06_InputTracker.md`
* 第5引数 `snapAssist`（typedef `EndpointSnapAssist`、省略時は何もしない既定値 `NO_SNAP_ASSIST`、`InputTracker.js:97-127`・`275`）、`SnapTarget` は `x`・`y` だけを読む（`#showSnap`）、候補の探索・距離判定・結果の組み立てを持たない。配線の場面（mousemove・描き始め・描き終え・ドラッグの開始/更新/終了）は4.1のとおり一致。表示を消す箇所は、ドラッグ中の `handleWheel` 経由の消去を除き4.1のとおり一致（相違は5章）。行数 1310（実測）。

### 4.7 `_doc/arch/07_KeyboardShortcuts.md`
* `J`：`{ codes:['KeyJ'], ctrl:false, shift:FORBIDDEN, repeatable:false, action:'join' }`（`KeyboardShortcuts.js:95`）、コールバックは結合した場合のみ `true`（`performJoin` の戻り値）。`Ctrl`+`J`・`Shift`+`J` は `#findBinding` が一致させないため `join` を実行せず `preventDefault` もしない（`:190-199`）。一致。

### 4.8 `_doc/arch/08_HistoryManager.md`
* `beginEdit`/`commitEdit` の呼び出し元：`InputTracker`（作成・削除・ドラッグ）・`main.js`（`?dev` の復元、`:547-549`）・`ShapeInserter`・`PathJoiner`・`EndpointSnapper`。`HistoryManager.js` を import するのは `main.js` のみ。`undo`/`redo` の呼び出しは `performUndo`/`performRedo`（`main.js:82`・`102`）のみ、`clear` は `CanvasLibrary.js:950` のみ、`onChange` は `main.js:278` と `CanvasLibrary.js:357`。一致。

### 4.9 `_doc/arch/10_ShapeFactory.md`
* `SHAPE_REGISTRY` が正本で `SHAPE_TYPES` は `create !== null` のエントリから導出（`ShapeFactory.js:51-53`）。`path` は `create: null`・末尾（`:35`）、`create('path')` は未知と同じ `Error`（`:68-71`）、`fromJSON` は振り分け。`InputTracker` は `SHAPE_TYPES` を再 export（`InputTracker.js:58`）。並び順の先頭が `InputTracker` の初期図形種別と `VectorModel.startDraft` の既定値になる（`VectorModel.js:256` ＝ `SHAPE_TYPES[0]`）。一致。

### 4.10 `_doc/arch/12_shapes.md`
* 共通モジュール：`ShapeGeometry.js` は `distanceToSegment`・`segmentIntersectsRect`・`quadraticBezierPoint` の3関数のみ、`ShapeDataValidation.js` は `validateShapeData` のみ、状態を持たない関数のみ。import するのは図形クラスのみ（`core/`・`io/`・`edit/`・規則のモジュールからは使われていない）、共通モジュール同士は import し合わない。`validateShapeData` の頂点数の引数は数値（ちょうどその数）か `{ min }`（`ShapeDataValidation.js:44-67`）、検査の順序一致。`Ellipse.#distanceToOutline`（`Ellipse.js:348`）は `Math.hypot` 版の自前実装、`Curve` は `hitTest` の分割数 `100` の直書き（`Curve.js:124`）と `CURVE_INTERSECT_SEGMENTS`（`:14`）が併存。一致。
* `PathJoinRules.js`：公開は `JOIN_TOLERANCE_SCREEN_PX`・`isJoinableLine`・`classifyJoin`・`buildClosedPath`・`buildJoinedPath`・`planJoin` と Phase 05-04 の5関数（`buildJoinedPathAt`・`buildExtendedPath`・`canCloseByMergingEnds`・`planDrawnLineJoin`・`planEndpointDragJoin`）、typedef `EndpointRef`。読むものは `type`・`id`・`toJSON()` のみ、import は `./Path.js` のみ、`try/catch` なし、使う側は `PathJoiner`・`EndpointSnapper`・`EndpointSnapRules`。`planDrawnLineJoin` は `startSnap`/`endSnap` に `undefined` を渡すと `startSnap.shapeId` で例外になる（`null` 前提）、`planEndpointDragJoin` の `snap` のみ `undefined` を `null` として扱う（`PathJoinRules.js:292`）。一致。
* `EndpointSnapRules.js`：公開は `SNAP_TOLERANCE_SCREEN_PX`・`isSnapDrawShapeType`・`resolveEndpointHandle`・`findSnapTarget`、typedef `SnapTarget`。読むものは `type`（`isJoinableLine` 経由）・`id`・`toJSON()`・`getVertexIndexForHandle`、import は `./PathJoinRules.js` のみ、使う側は `EndpointSnapper` のみ。`resolveEndpointHandle` は頂点の番号＝`points[i]` に依る。一致。
* 13メソッド契約：5クラスとも13メソッドを実装。`draw` のシグネチャ：`Line` は `draw(ctx)`（`Line.js:139`）、他4クラスは `draw(ctx, t = 0)`、呼び出し元は `shape.draw(this.ctx)`（`CanvasManager.js:211`・`230`）のみで `t` は渡されない。クラスJSDocが13メソッドを列挙（5クラス）。一致。
* `intersectsRect`（`Line`・`Rect`・`Path` は線分の厳密判定、`Curve`・`Ellipse` は100分割）、`toDrawElement` の呼び出し元は `SpriteSerializer` のみ（`SpriteSerializer.js:204`）、`Ellipse` の `hitTest` は `strokeWidth / 2` を足し（`Ellipse.js:301`・`314`）他4クラスは足さない。一致。
* `Path`：`ShapeFactory.create` では作られない、`hitTestHandle` は `'vertex-<i>'`（先頭0なし）か `null`・番号の小さい順の先着・`move` なし（`Path.js:208-216`）、`getVertexIndexForHandle` は範囲内のみ解決（`:223-235`）、`setVertex` は範囲外・整数でない番号では何もしない（`:242-246`）、`updateDraftEnd` は終点を動かし現在の呼び出し元は `VectorModel.updateDraft`（作成中の図形）のみで `path` は作成中にならない、`hitTest` は `strokeWidth` を足さない・閉じたパスは終点→始点も対象（`#someSegment`）、`Path.fromJSON` はコンストラクタで頂点を複製・区間を `kind` から作り直し・パス固有の項目は共通項目の後に検証（`:322-351`）。一致。

### 4.11 `_doc/arch/14_edit.md`
* `PathJoiner`：公開は `canJoin`・`join`、呼び出し元は `main.js`（`performJoin`・`syncJoinButtonState`）、`model` は `getShapes`・`isSelected`・`replaceShape` のみ、`HistoryManager`/`VectorModel` を import しない、`try/catch` なし。`EndpointSnapper`：公開は `findDrawSnap`・`resolveDragEndpoint`・`findDragSnap`・`commitDrawnLine`・`joinDraggedEndpoint`、呼び出し元は `InputTracker` のみ、`model` は `getShapes`・`getDraftShape`・`cancelDraft`・`replaceShape` のみ、`replaceShape` の戻り値は見ない、`joinDraggedEndpoint` は `beginEdit`/`commitEdit` を呼ばない、`resolveDragEndpoint` は図形が `getShapes()` に無ければ `null`。一致。

### 4.12 `_doc/arch/16_test.md`
* 上記のテストファイルは全て実在。`node --test` は 646 tests・pass 646・fail 0。
* 実物の組み合わせ（`VectorModel`・`SnapshotAdapter`・`HistoryManager`）を使うのは `test/edit/PathJoiner.test.js` と `test/edit/EndpointSnapper.test.js` の「実物の組み合わせ」のケースのみ（`test/` 配下でこれら3クラスを import するのはこの2ファイルと、対象そのものの `VectorModel.*.test.js`）。`PathJoiner.test.js` は実物の `PathJoiner`、`EndpointSnapper.test.js` は実物の `EndpointSnapper` を import し、後者は `PathJoiner` を import しない。`ShapeGeometry`・`ShapeDataValidation` を直接 import するテストはない（図形クラスのテスト経由）。`node:` 以外の外部 import はなし（`node:fs` 等は `CodeExporter.assembly.test.js` のみ）。一致。
* 各テストの内容：`Path.test.js`（hitTest・intersectsRect・頂点のハンドル・`fromJSON` のエラー文と検査の順序・`toJSON`/`toDrawElement`・偽の `ctx` の描画命令）、`PathJoinRules.test.js`（受理・閉じる・2本の結合・`planJoin`・往復と独立性・Phase 05-04 の5関数）、`EndpointSnapRules.test.js`、`VectorModel.snapPoint.test.js`、`VectorModel.replaceShape.test.js`（`select:false` を含む）、`ShapeFactory.test.js`、`DocumentSerializer.roundtrip.test.js`（パス・混在）、`SpriteSerializer.test.js`（パス・未知の `kind` は `Error`）、`CodeExporter.test.js`（パス〔開いた・閉じた・2点・3点・長さ0・混在〕を偽の `ctx` の記録で比較）、`FileContentReader.test.js`（パスを含むスプライト）のタイトルと本文を確認し、記述と合致。
* `EndpointSnapper.test.js` の「閉じる」の記述（「描いて閉じる」は undo で開いたパスに戻ることのみ、「ハンドルのドラッグで閉じる」は undo で頂点数4・開いたパスに戻ることまで、redo と履歴1件は確かめていない）は、テスト本文（`:325-338`・`:386-407`）と合致。「描き足し・結合・ハンドルのドラッグでの結合」は undo/redo の往復と履歴1件を確かめている（`:275-298`・`:301-322`・`:357-383`）。
* 「テストできない箇所」の `InputTracker` の吸い付きの配線・`CanvasManager` の吸い付きの表示・結合ボタン・`J` キー・`performJoin` は、該当する自動テストが存在しない（記述どおり）。

* **事実（実コードの記述）**:
  * 実測の行数：`js/main.js` 593、`js/core/InputTracker.js` 1310（資料の値と一致）。
  * 距離・大きさ：結合の重なり 5px（`PathJoinRules.js:12`）、吸い付き 8px（`EndpointSnapRules.js:13`）、`InputTracker.hitTolerance` 5（`InputTracker.js:341`）、吸い付きの表示の正方形 8px（`CanvasManager.js:97`）。
  * `PathJoiner.canJoin()` が真でも `join()` が偽を返し得る：頂点3つの開いたパス1本で始点と終点の距離が許容距離以内のとき、`classifyJoin` は `'close'` だが `buildClosedPath` は最後の頂点を除いて2点になり `null`（`PathJoinRules.js:78-93`・`planJoin`）。この場合 `join()` は `beginEdit` を呼ばず `false`（`PathJoiner.js:73-80`）。
  * `planDrawnLineJoin` で同じ線の始点と終点にそれぞれ吸い付いた場合の閉じる計画も、同じ `buildClosedPath` の `null` により何も起きない（`PathJoinRules.js:259-266`・`planCloseOf`）。
* **推測・所見**:
  * 資料と実コードの食い違いが1件見つかった（5章。ドラッグ中のズームで表示が消え得る）。以下は、複数の読み方ができ得る記述の指摘である。
  * `PROJECT_ARCHITECTURE.md` の1章 フォルダ構成図の `PathJoinRules.js`／`EndpointSnapRules.js` のコメント「shapes/の外から使う」は、`PathJoinRules` については `shapes/EndpointSnapRules` からも使われる（`EndpointSnapRules.js:5`）ため、字義どおりには「`shapes/` の外**だけ**から」ではない。1章の依存方向の節に「`shapes/`内」の例外の記述があるので、図のコメントだけを読むと解釈が分かれる。
  * `12_shapes.md` の `PathJoinRules.js` の「公開」の節は、公開の typedef として `EndpointRef` のみを挙げているが、実コードには `JoinPlan` も `@typedef` として存在する（`PathJoinRules.js:25-31`）。資料に書かれていない事項のため相違とはしていない。
  * 3章12.「計画が何も起こさない場合（同じ端点・頂点2つの線の閉じる・足す頂点が端点と重なる）」の括弧書きは、上記の事実（頂点3つのパスの両端が許容距離以内で閉じる計画が `null` になる場合）を挙げていない。括弧書きが網羅か例示かは、資料からは読み取れない（実コードは「閉じる計画が `null`」であれば全て記録せず捨てるだけ、`EndpointSnapper.js:144-146`）。
  * 3章12.「発注者の決定」の「頂点2つの線は閉じない」は、`Line` と頂点2つの `Path` のことで、ハンドルのドラッグでは「吸い付かない」（`canCloseByMergingEnds` が偽）、描き終えでは「閉じる計画が `null`」と、止める箇所が2つに分かれている。資料の1文では区別されていない。
  * 06「配線の場面」の「描き始め（クリック位置で照会）」は、`handleClick` の IDLE かつ図形作成モードの分岐のことで、`handleMouseDown` ではない（`InputTracker.js:779-785`）。「ドラッグ開始時の `resolveDragEndpoint`」は `#beginLeftDrag`（mousedown 時、閾値超過前）で呼ばれる（`:915-919`）。資料の「ドラッグ開始」がどちらの時点か（押下か閾値超過か）は、文面だけでは読み分けにくい。

## 5. 開発資料との相違
相違が1件ある（それ以外の、コードで真偽を確かめられる主張は、上記4章の範囲で実コードと一致した。照合できなかったのは、`06_InputTracker.md` の「再分離の候補は `_doc/COWORK_STATUS.md` 2章A」のみで、REQが読む範囲として許可していないため）。

* **`PROJECT_ARCHITECTURE.md` 3章12.「注意（パン／ズームの後）」**
  * 資料の記述：「ズーム（`handleWheel`）は表示を消さないので、ズームの後は表示が残る」。4.1の旧記述も「`handleWheel` は表示を消さない」だった（本RESの初版は「一致」としていたが誤り）。
  * 実コードの実態：ズームで表示が消えない場面と消え得る場面がある。
    * **消え得る場面＝端点のハンドルを閾値を超えてドラッグしている最中のホイール**：`handleWheel` は `ViewTransform.zoomAt` の後、`#drag.hasMoved() && #isLeftDragState()` なら `#applyLeftDragUpdate(event)` を呼ぶ（`InputTracker.js:846-850`）。`#dragEndpoint` があれば `findDragSnap` で照会し直して `#showSnap(snap)` に渡し（`:980-983`）、`snap` が無ければ `model.clearSnapPoint()` が呼ばれる（`:584-588`）。吸い付く距離は `screenLengthToWorld(8)` で、毎回その時点の表示倍率で換算し直される（`EndpointSnapper.js:105-111`）。このため、拡大して吸い付く距離（ワールド）が縮み端点が範囲外になると、表示が消える。
    * 表示が残る場面：DRAWING・IDLE のホイール（`#isLeftDragState()` が偽で再照会が走らない。`:848`・`:870-876`）、閾値以前のホイール（`hasMoved()` が偽）、範囲選択・選択集合の移動中のホイール（`#applyLeftDragUpdate` が吸い付きの照会より前に戻る、`:961-972`）、パン中（パンは左ドラッグ状態ではない）。DRAWING のズームでは表示は残るが、照会し直さないため作成途中の終点・保持した端点も更新されない。
  * 影響：資料の文は DRAWING・IDLE の場合にだけ成り立つ。4.1「表示を消す箇所」の項のとおり、表示を消す箇所は資料に挙げられたもの以外に、`#showSnap(null)` 経由（IDLE の mousemove `:636`、DRAWING の mousemove `:630`、描き始めのクリック `:783`、ハンドルのドラッグの更新 `:983`〔DragTracker の onMove とドラッグ中の `handleWheel` の両方から到達〕）がある。

## 6. 懸念事項・今後の修正における注意点
* 結合ボタンの活性（`canJoin`）は「受理する選択か」だけを見るため、頂点3つの開いたパスで両端が重なっている場合など、ボタンは押せるが何も起きない選択が存在する（4章の事実）。資料は「`canJoin`は受理する選択かの判定のみ」と書いており矛盾はないが、結合の規則を変えるときは、`canJoin`（`classifyJoin`）と `planJoin` の結果が食い違い得る点に注意が要る。
* `planDrawnLineJoin` の `startSnap`/`endSnap` を `undefined` で渡すと例外になる（`null` 前提）。`InputTracker` は `#drawStartSnap`・`#drawEndSnap` を `null` で初期化・復帰させている（`InputTracker.js:243`・`250`・`597-598`）ので現状は問題ないが、`NO_SNAP_ASSIST` 以外の補助を差し替える場合は戻り値を `null` に揃える必要がある。
