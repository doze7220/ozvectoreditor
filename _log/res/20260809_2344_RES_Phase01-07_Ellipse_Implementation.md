# RES: 作業計画・作業レポート (Phase 01-07) : 楕円弧（Ellipse.js）の一元化設計と段階的実装
* 参照元REQ: `./_log/req/20260809_2250_REQ_Phase01-07_Ellipse_Implementation.md`
* 参照元DIR: `./_log/dir/20260809_2247_DIR_Phase01-07_Ellipse_Implementation-v2.md`（本Phaseの北極星。本計画はDIRからの逸脱がないよう自己監査済み）

## 1. 作業目的
円・楕円・弧という幾何学的に同根の図形を、将来の相互型変換およびモーフィング（Lerp）時のトポロジー破綻から保護するため、`js/shapes/Ellipse.js` を新規実装し、`points` 配列を長さ5固定の一元データ構造として確立する。あわせて `js/core/ShapeFactory.js` の `circle`/`arc` 分岐を、暫定 `Line` フォールバックから `Ellipse` の本実装接続へ差し替える。`Line`/`Curve`/`Rect` と同一の9メソッド契約をEllipseが自律実装することで、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を1行も変更せずに、円・弧の作成・選択・ハンドル編集フローへ組み込むことをゴールとする。

## 2. アーキテクチャ設計

### 要件1: `points` 5頂点構造とコンストラクタ（種別出し分け）
* `points` はコンストラクタ実行時点から常に長さ5で保持する。
    * `points[0]`＝中心（Center）
    * `points[1]`＝右端制御点（`xc+rx, yc`）… 中心からの距離が $r_x$
    * `points[2]`＝上端制御点（`xc, yc-ry`）… 中心からの距離が $r_y$
    * `points[3]`＝開始角制御点（常に `xc+rx, yc`。開始角0固定）
    * `points[4]`＝終了角制御点（円＝`xc+rx, yc`と同座標／弧＝`xc-rx, yc`）
* コンストラクタは `(x1, y1, x2, y2, shapeType = 'circle')` のシグネチャとする。`x1, y1` を中心、`x2, y2` から $r_x=|x2-x1|, r_y=|y2-y1|$ を算出して初期 `points` を構築する（`ShapeFactory` からの生成直後は `x1===x2, y1===y2` となり $r_x=r_y=0$ の縮退状態からスタートする点は `Line`/`Curve`/`Rect` の作図開始時と同様の挙動）。
* `shapeType`（`'circle'` | `'arc'`）は、共通データ構造上すでに規定されている `this.type` プロパティにそのまま格納する（`ShapeData` 標準プロパティ `type` の値をそのまま種別フラグとして流用するため、専用の重複フラグは持たない＝Single Source of Truth）。円・弧の判定が必要な箇所（`draw`/`hitTest`等）は都度 `this.type === 'circle'` を参照する。
* `this.startAngle = 0`、`this.endAngle = (this.type === 'circle') ? Math.PI * 2 : Math.PI` をコンストラクタ内で固定する（本Phaseでは可変ハンドル非対応のためNon-goals範囲内の定数として扱う）。

### 要件2: 2クリック作図とドラフト追従（`updateDraftEnd(x, y)`）
* 1回目クリック地点＝中心 `points[0]` は固定したまま変更しない。
* マウス座標 `(x, y)` から $r_x=|x-xc|, r_y=|y-yc|$ を算出し、`points[1]`（右端）・`points[2]`（上端）を再計算する。
* 同時に非表示の `points[3]`（開始角固定点＝`xc+rx, yc`）・`points[4]`（終了角点＝円なら`xc+rx,yc`、弧なら`xc-rx,yc`）も最新の $r_x, r_y$ に同期再計算する（化石化防止、DIR要件2）。

### 要件3: 描画（`draw`/`drawHover`）とハンドル（`drawHandles`/`hitTestHandle`/`setVertex`の正規化）
* `draw(ctx, t = 0)`：`ctx.ellipse(xc, yc, rx, ry, 0, this.startAngle, this.endAngle)` を使用。円（`this.type === 'circle'`）は `closePath()` を呼んでから `stroke()`、弧は `closePath()` を呼ばずに `stroke()` する。
* `drawHover(ctx)`：`draw` と同一パス構築（円は閉じる／弧は開いたまま）に対し、`Line`/`Curve`/`Rect` と同一仕様（半透明・太線）の強調描画を行う。
* `drawHandles(ctx)`：中心（円形、`move`ハンドルとして`Line`/`Curve`と同一意匠）、右端 `points[1]`（正方形）、上端 `points[2]`（正方形）、左端 `(xc-rx, yc)`（正方形・対称ダミー）、下端 `(xc, yc+ry)`（正方形・対称ダミー）の計5個を描画する。`points[3]`/`points[4]`（開始角・終了角）はDIR Non-goalsに基づき描画対象外とする。
* `hitTestHandle(x, y, tolerance)`：判定優先順位は 中心→`'move'`、右端→`'right'`、上端→`'up'`、左端→`'left'`、下端→`'down'`。該当なしは `null`。
* `getVertexIndexForHandle(handleName)`：ルックアップは `{ right: 1, up: 2, left: 1, down: 2 }`（`'move'`キーは含めない。既存`InputTracker`は`activeHandle === 'move'`時に本メソッドを呼ばず`moveShape`へ分岐する既存契約のため、`Line`/`Curve`/`Rect`同様に含める必要がない）。
* **【超重要】`setVertex(vertexIndex, x, y)` の正準再配置ロジック**（左端/下端ドラッグ時の反転ワープ不具合防止）：
    * `vertexIndex === 1`：$r_x=|x-xc|$ を再計算し、`points[1]` を常に正準右端位置 `(xc+rx, yc)` に再配置する（`left`ハンドルドラッグ時も`vertexIndex=1`で呼ばれるため、入力座標をそのまま代入せず絶対距離から再構成する）。
    * `vertexIndex === 2`：$r_y=|y-yc|$ を再計算し、`points[2]` を常に正準上端位置 `(xc, yc-ry)` に再配置する。
    * 上記いずれの場合も、更新後の $r_x, r_y$ を基に `points[3]`・`points[4]` を円周上の同期位置へ再配置する。
    * `vertexIndex === 0`：中心座標を `(x, y)` に更新し、既存の $r_x, r_y$ を維持したまま全 `points` を新中心基準で再計算する（`translate`と等価の平行移動処理を内部で流用してよい）。

### 要件4: 当たり判定（`hitTest`）— 0除算ガードと角度フィルタ
* **最優先ガード**：関数冒頭で $r_x < 1$ または $r_y < 1$ の場合は即座に `false` を返す（NaN/Infinity暴走・全面誤爆の防止、DIR要件4）。
* 楕円方程式 $\frac{(x-xc)^2}{r_x^2} + \frac{(y-yc)^2}{r_y^2} \approx 1$ に `tolerance` と `strokeWidth` を加味した境界線判定を行う。
* 弧（`this.type !== 'circle'`）の場合、`atan2(y-yc, x-xc)` で入力点の角度を算出し、`this.startAngle`〜`this.endAngle` の範囲内でなければ `false` とする角度フィルターを追加適用する（空隙部分での誤爆防止）。

### 要件5: `translate(dx, dy)`
* `points` 5要素すべて（開始角・終了角のダミー点を含む）に `dx, dy` を相対加算する。

### 要件6: `ShapeFactory.js` の `circle`/`arc` 配線接続
* `case 'circle':` → `return new Ellipse(x1, y1, x2, y2, 'circle');`
* `case 'arc':` → `return new Ellipse(x1, y1, x2, y2, 'arc');`
* 既存の `line`/`curve`/`rect` の各 `case` および未知`type`時の`Error` throwはそのまま変更しない。

### 関連フォルダと論理クラス
* **対象フォルダ**：`./js/shapes/`（`Ellipse.js` 新規作成）、`./js/core/`（`ShapeFactory.js` 改修）
* **関連する論理クラス**：`Ellipse`（新規具象図形クラス、円と弧を1クラスで一元管理）、`ShapeFactory`（図形種別ごとのインスタンス生成を一元的に担うFactory。`core/`層全体を通じて図形種別のif/switch分岐を許容する唯一の例外モジュール）
* **参照する責務**（`PROJECT_ARCHITECTURE.md` 4章より抜粋）：
    * `shapes/` : 「図形種別ごとの定義・当たり判定。各図形が自身のプロパティと描画ロジック(`draw`メソッド)を持つ」
    * `ShapeFactory.js` : 「`arc`/`circle`の2種は専用クラス未実装のため、引き続き暫定的に`new Line(x1, y1, x2, y2)`を返すスタブフォールバックとなっている（将来専用クラスを実装する際は、この`switch`文の該当`case`を個別の`return new XXX(...)`に差し替える）」

### 開発資料（PROJECT_ARCHITECTURE.md）の更新予定
* 4章「shapes/」セクションに `Ellipse.js`（作成済み）の項目を、`Line.js`/`Curve.js`/`Rect.js` と同一粒度（データ構造・9メソッドの実装詳細・正規化ロジックの要点）で追記する。
* 4章「ShapeFactory.js」セクションの記述を、「`circle`/`arc`は暫定`Line`フォールバック」という現行文言から、「`circle`/`arc`いずれも`new Ellipse(...)`へ接続済み（Phase01-07で本実装接続済み）」という趣旨に更新する。
* 影響度は大きいため、本更新は必須タスクとしてタスクリストに組み込む（REQ「計画書に必ず含めるべき固定タスク」対応）。

## 3. タスクリスト
* [ ] タスク1: `Ellipse.js` の新規作成・責務JSDoc・コンストラクタ・5頂点データ構造の実装
    * **対象ファイル** :
        * `./js/shapes/Ellipse.js` : 新規
    * **作業内容** :
        * ファイル先頭にPROJECT_CONSTITUTION.md 3章準拠の責務定義JSDoc（3行以内）を記述する。
        * `constructor(x1, y1, x2, y2, shapeType = 'circle')` を実装し、`this.type`（共通プロパティ）に`shapeType`をそのまま格納、`this.startAngle`/`this.endAngle`を種別に応じて固定初期化する。
        * $r_x, r_y$ から `points[0]`〜`points[4]` の5点を算出する初期化ロジックを実装する（要件1）。
        * 色・線幅・塗りつぶし等の共通プロパティ（`color`/`strokeWidth`/`isFilled`等）は、既存図形（`Line.js`/`Curve.js`/`Rect.js`）のコンストラクタ初期化パターンに完全準拠させる（実装時に当該ファイルを直接参照し、命名・デフォルト値の一貫性を確認すること）。
        * クラス・コンストラクタにJSDocコメント（引数・責務の明文化）を記述する。
        * JSDocコメントの記載漏れがないことを確認する。
        * 完了後、本RESファイル「4. 詳細作業内容」に実施内容を追記する。
        * 判断に迷った点・目視確認推奨箇所があれば「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク2: 描画メソッド（`draw`/`drawHover`）の実装
    * **対象ファイル** :
        * `./js/shapes/Ellipse.js` : 更新
    * **作業内容** :
        * `draw(ctx, t = 0)` を実装し、`ctx.ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)` を用いた円／弧の描画分岐（`closePath()`有無）を行う（要件3）。
        * `drawHover(ctx)` を実装し、`Line`/`Curve`/`Rect`と同一仕様の強調描画（半透明・太線）を行う。
        * 各メソッドにJSDocコメント（引数・戻り値・責務）を記述する。
        * JSDocコメントの記載漏れがないことを確認する。
        * 完了後、本RESファイル「4. 詳細作業内容」に実施内容を追記する。
        * 判断に迷った点・目視確認推奨箇所（特に弧の見た目が円と混同されないかの目視確認）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク3: ハンドル表示・判定（`drawHandles`/`hitTestHandle`/`getVertexIndexForHandle`）の実装
    * **対象ファイル** :
        * `./js/shapes/Ellipse.js` : 更新
    * **作業内容** :
        * `drawHandles(ctx)` を実装し、中心（円形・moveハンドル）、右端・上端（正方形、`points[1]`/`points[2]`実値）、左端・下端（正方形、`(xc-rx,yc)`/`(xc,yc+ry)`の計算値による対称ダミーハンドル）の計5個を描画する（`points[3]`/`points[4]`は非表示のまま）。
        * `hitTestHandle(x, y, tolerance)` を実装し、優先順位 中心`'move'`→右端`'right'`→上端`'up'`→左端`'left'`→下端`'down'`の順で判定、該当なしは`null`を返す。
        * `getVertexIndexForHandle(handleName)` を実装し、ルックアップ `{ right: 1, up: 2, left: 1, down: 2 }`（`'move'`キーは含めない）で解決する。
        * 各メソッドにJSDocコメント（引数・戻り値・責務、特に`left`/`down`が`vertexIndex`としては`right`/`up`と同値`1`/`2`を返す設計意図）を記述する。
        * JSDocコメントの記載漏れがないことを確認する。
        * 完了後、本RESファイル「4. 詳細作業内容」に実施内容を追記する。
        * 判断に迷った点（本タスクリスト末尾の「懸念事項」既定項目：DIR本文とREQ本文の記載差異）を「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク4: 頂点更新・移動（`setVertex`正規化ロジック/`translate`/`updateDraftEnd`）の実装
    * **対象ファイル** :
        * `./js/shapes/Ellipse.js` : 更新
    * **作業内容** :
        * `setVertex(vertexIndex, x, y)` を実装し、`vertexIndex===1`／`vertexIndex===2`のケースで単純代入を行わず、必ず中心からの絶対距離$r_x$/$r_y$を再計算して正準位置へ再配置する正規化ロジックを実装する（左端/下端ドラッグ時の反転ワープ不具合防止、DIR要件3【超重要】節）。同時に`points[3]`/`points[4]`を再同期する。`vertexIndex===0`は中心移動として$r_x,r_y$を維持したまま全点を再計算する。
        * `translate(dx, dy)` を実装し、`points`5要素全てに`dx, dy`を相対加算する（要件5）。
        * `updateDraftEnd(x, y)` を実装し、作図中の中心固定＋$r_x,r_y$動的算出＋`points[1]`〜`points[4]`の同期再計算を行う（要件2）。
        * 各メソッドにJSDocコメント（引数・責務、特に`setVertex`の正規化理由）を記述する。
        * JSDocコメントの記載漏れがないことを確認する。
        * 完了後、本RESファイル「4. 詳細作業内容」に実施内容を追記する。
        * 判断に迷った点・目視確認推奨箇所（特に左端/下端ハンドルをドラッグしても瞬間ワープしないことの目視確認）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク5: 当たり判定（`hitTest`）の実装（0除算ガード・角度フィルタ）
    * **対象ファイル** :
        * `./js/shapes/Ellipse.js` : 更新
    * **作業内容** :
        * `hitTest(x, y, tolerance)` 冒頭に $r_x<1$ または $r_y<1$ の場合に即座に`false`を返すガード処理を最優先で実装する（要件4【不具合防止】節）。
        * 楕円方程式ベースの境界線判定（`tolerance`・`strokeWidth`加味）を実装する。
        * 弧の場合に`atan2`による角度算出と`startAngle`〜`endAngle`範囲フィルタを追加適用する（空隙部分の誤爆防止）。
        * メソッドにJSDocコメント（引数・戻り値・0除算ガードの理由）を記述する。
        * JSDocコメントの記載漏れがないことを確認する。
        * 完了後、本RESファイル「4. 詳細作業内容」に実施内容を追記する。
        * 判断に迷った点・目視確認推奨箇所（特に縮退状態での0除算ガード動作、弧の空隙クリックが誤爆しないことの確認）があれば「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク6: `ShapeFactory.js` の `circle`/`arc` 配線接続
    * **対象ファイル** :
        * `./js/core/ShapeFactory.js` : 更新
    * **作業内容** :
        * `Ellipse.js` を`import`する。
        * `case 'circle':` を `return new Ellipse(x1, y1, x2, y2, 'circle');` に差し替える。
        * `case 'arc':` を `return new Ellipse(x1, y1, x2, y2, 'arc');` に差し替える。
        * `line`/`curve`/`rect`の既存`case`、および未知`type`時の`Error` throwロジックには一切手を加えない。
        * 変更箇所のJSDocコメント（`create`メソッドの説明文中、`circle`/`arc`が暫定スタブである旨の記述）を実体に即して更新する。
        * JSDocコメントの記載漏れがないことを確認する。
        * 完了後、本RESファイル「4. 詳細作業内容」に実施内容を追記する。
        * 判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク7: 統合動作確認（目視確認）
    * **対象ファイル** :
        * なし（`index.html`をブラウザで開いての動作確認のみ、コード修正は行わない）
    * **作業内容** :
        * パレットの「円」「弧」ボタンでツール切替が正しく活性ハイライトされることを確認する。
        * 「1クリック目（中心）→ドラッグ→2クリック目」で円・弧がそれぞれ滑らかに作図されることを確認する。
        * 選択後、中心・右端・上端・左端・下端の5ハンドルが表示され、ドラッグで平行移動・X/Y半径個別伸縮が反転ワープなく行えることを確認する。
        * 縮退（$r_x$または$r_y$が0に近い）状態、および弧の空隙部分クリック時に、コンソールエラー・誤爆選択が発生しないことを確認する。
        * 確認結果を本RESファイル「4. 詳細作業内容」に記述する。
        * 目視確認で気になった挙動があれば「5. 懸念事項・要確認ポイント」に記述する。

* [ ] タスク8（固定タスク）: `PROJECT_ARCHITECTURE.md` の更新
    * **対象ファイル** :
        * `./PROJECT_ARCHITECTURE.md` : 更新
    * **作業内容** :
        * 4章「shapes/」セクションに `Ellipse.js`（作成済み）の責務・データ構造・9メソッド実装詳細・正規化ロジックの要点を、`Line.js`/`Curve.js`/`Rect.js`と同一粒度で追記する。
        * 4章「ShapeFactory.js」セクションの`circle`/`arc`暫定スタブに関する記述を、本実装接続済みである旨に更新する。
        * 完了後、本RESファイル「4. 詳細作業内容」に更新箇所を追記する。

## 4. 詳細作業内容
（タスク実行フェイズで、各タスク完了ごとに実施内容をここに追記する。計画立案段階の本RESでは未記載。）

## 5. 懸念事項・要確認ポイント
* **DIR本文とREQ本文における`getVertexIndexForHandle`ルックアップ表記の差異**：DIR 3章要件5-9項は `{ start: 0, right: 1, up: 2 }[handleName] ?? null` と記載しているが、Ellipseの`hitTestHandle`が返すハンドル名語彙には`'start'`は存在せず（中心は`Line`/`Curve`の`'move'`相当、DIR自身も同箇所の括弧書きで「左端・下端の対称ハンドルも、ドラッグ時はそれぞれ右端『1』、上端『2』を返して`setVertex`側で正規化処理させる」と説明しており、この趣旨はREQ本文が明記する`{ right: 1, up: 2, left: 1, down: 2 }`（`'move'`キー非包含）と完全に一致する）。本計画では、DIRの当該コード断片は`Line`/`Curve`のテンプレートからの転記残り（誤記）と判断し、DIR自身の説明文の意図およびREQ本文の明示的なルックアップ表 `{ right: 1, up: 2, left: 1, down: 2 }` を正として採用する。実装タスク（タスク3）着手時に、この解釈で相違ないか実装AIは一度立ち止まって確認することを推奨する。
* **共通プロパティ（`color`/`strokeWidth`/`isFilled`等）の初期化規約**：本計画書はPROJECT_CONSTITUTION.mdのREQ指定外ファイル参照禁止ルールに従い、`Line.js`/`Curve.js`/`Rect.js`の実ソースコードを直接読み込まずに計画立案を行っている。そのため、共通プロパティの具体的なデフォルト値・命名の完全な一致は、タスク1実装時に実装AIが当該ファイルを直接参照して整合させる必要がある（設計判断としては「完全準拠」の方針のみを本計画で確定し、値の一次情報はソースコード自体とする）。
* **`hitTest`の`tolerance`と`strokeWidth`の加味方法**：楕円方程式ベースの境界線判定において、`tolerance`・`strokeWidth`をどの程度の許容幅として反映するかの具体的な係数は、`Line`/`Curve`/`Rect`の既存実装との視覚的な当たり判定感覚の一貫性を、タスク7の目視確認時に重点的に確認することを推奨する。
* **弧の`hitTest`角度フィルタと境界線判定の順序**：0除算ガード→楕円方程式境界判定→角度フィルタ、の順で実装することを想定しているが、境界判定と角度フィルタの順序を入れ替えても結果は同一のため、実装効率上都合の良い順序で構わない（AND条件である点のみ厳守）。
