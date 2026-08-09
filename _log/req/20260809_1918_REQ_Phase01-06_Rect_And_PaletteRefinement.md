### 作業指示書 REQ: Phase 01-06 : 矩形（Rect.js）の実装および図形パレット・ツール切替のハードコード排除
*  ルール: ./PROJECT_CONSTITUTION.md
*  開発資料: ./PROJECT_ARCHITECTURE.md

--------------------------------------------------------------------------------

#### 【作業手順（厳守事項）】
本プロンプトは、Phase 01-06「矩形（Rect.js）の実装および図形パレット・ツール切替のハードコード排除」の **「計画立案」のみを目的とする。絶対にソースコードの修正（ファイルの書き換え）を行わないこと。** 計画立案のみに留めること。

1. ルール（`./PROJECT_CONSTITUTION.md`）、開発資料（`./PROJECT_ARCHITECTURE.md`）、および指針書（DIR、上記パス）を熟読・把握すること。DIRは本Phaseにおいて実装AIが1歩も逸脱してはならない制約事項（北極星）である。
2. 以下の【実装要件】を満たすための高度なアーキテクチャ設計と作業計画を立案し、AIがハルシネーションを起こさない適切なスコープを持つ細かなタスクリストを構築すること。DIRとREQの記載に矛盾がある場合はDIRを優先すること。DIR 7章のステップロードマップ（ステップ1〜3）を計画立案時のタスク分割の基準とすること。
3. 計画を出力する前に内部で自己監査を行い、ルール・開発資料・DIRの責務違反（`core/`層への図形種別分岐の新規混入、`Line`/`Curve`との共通API契約からの逸脱、ツール切替ロジックのハードコード残存など）がないか確認して計画を純化すること。
4. 監査を通過した計画を、作業計画書テンプレート（`./_log/TEMPLATE_RES_ImpretonPlan.md`）に完全に準拠したフォーマットで、新規ファイルとして出力すること。
    *  出力先・ファイル名: `./_log/res/YYMMDD_HHMM_RES_Phase01-06_Rect_And_PaletteRefinement.md`（※YYMMDD_HHMMの部分は、作業実行時の現在日時を当てはめること）
5. チャットにて「計画書の作成が完了しました。タスクを実行するための新しいチャットへ移行してください」と報告すること。

--------------------------------------------------------------------------------

#### 【実装要件】
DIRに定義された以下2点を実現する。詳細な設計判断（座標計算式、描画命令、ハンドル形状の細部等）はDIR本文（3章・7章）に完全準拠すること。以下は要件の要約であり、矛盾する記載があればDIR本文を正とする。

##### 1. `js/shapes/Rect.js` の新規実装
*   **データ構造**：`this.points = [{x, y}, {x, y}, {x, y}, {x, y}]`（長さ4固定、`points[0]`=topLeft／`points[1]`=topRight／`points[2]`=bottomRight／`points[3]`=bottomLeft）で一貫して保持する（DIR 要件1）。コンストラクタは`(x1, y1, x2, y2)`を受け取り、対角線をなす2点から初期矩形（4点）を計算する（DIR 7章ステップ1）。
*   **作図プレビュー追従（`updateDraftEnd(x, y)`）**：1回目のクリック座標`P0`（topLeft）を固定し、現在のカーソル座標を`P2`（bottomRight）として追従させ、対角線上の`P1(x_current, y_start)`／`P3(x_start, y_current)`を動的に再計算する（DIR 要件1）。
*   **描画（`draw(ctx, t = 0)`）**：`points[0]→points[1]→points[2]→points[3]`の順に`lineTo`を回し`closePath()`で閉じる。`Curve.js`とのシグネチャ統一のため第2引数`t`（未使用でも構わない）を維持すること（DIR 要件1、既存`Line`/`Curve`との共通API契約）。
*   **ハンドル描画（`drawHandles(ctx)`）**：4つの角すべてに、一辺8pxの正方形（白塗り青枠）ハンドルを表示する（DIR 要件1）。
*   **当たり判定（`hitTest(x, y, tolerance)`）**：4辺（P0-P1, P1-P2, P2-P3, P3-P0）それぞれの線分最短距離を判定し、いずれか1辺でも`tolerance`以内であれば`true`（DIR 要件1）。
*   **ハンドル判定（`hitTestHandle(x, y, tolerance)`）**：4つの角との距離判定を優先順位`'topLeft'`→`'topRight'`→`'bottomRight'`→`'bottomLeft'`で行い、対応する識別子（またはいずれにも該当しない場合`null`）を返す（DIR 要件1）。
*   **頂点更新・移動**：`setVertex(vertexIndex, x, y)`（`0`=topLeft／`1`=topRight／`2`=bottomRight／`3`=bottomLeft）、`translate(dx, dy)`（4点全ての相対移動）を実装する。確定後（編集時）は4頂点を個別に自由に動かせる仕様とし、平行四辺形や任意の歪んだ四角形になることを許容する（矩形維持ロジックは持ち込まない、DIR 4章「本Phase固有の設計原則」）。
*   **ハンドル名→vertexIndex解決（`getVertexIndexForHandle(handleName)`）**：`{topLeft:0, topRight:1, bottomRight:2, bottomLeft:3}`のルックアップで対応する`vertexIndex`を返す（該当なしは`null`）。
*   **ホバー描画（`drawHover(ctx)`）**：矩形パスに沿った半透明の幅広ハイライト線を描画する（`Line`/`Curve`の`drawHover`と同等の視覚仕様に準拠）。
*   `Line.js`／`Curve.js`が満たす9メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`/`updateDraftEnd`/`getVertexIndexForHandle`）を、`Rect.js`でも100%同名・同引数で自律実装すること（DIR 要件1）。これにより`VectorModel`/`CanvasManager`/`InputTracker`は1行の変更もなく矩形を扱えることを担保する。

##### 2. `js/core/ShapeFactory.js` の配線接続
*   `ShapeFactory.create('rect', ...)`における暫定`Line`フォールバックを撤去し、`new Rect(x1, y1, x2, y2)`を返すよう接続する（DIR 要件1、7章ステップ1）。
*   `arc`/`circle`の2種は本Phaseのスコープ外であり、既存の`Line`スタブフォールバックのまま一切変更しないこと。

##### 3. `js/main.js` のツール切替・アクティブトグルシステムの汎用化
*   現行の`applyTool(tool)`（コントロールパネルの`select`/`line`ボタンと、パレット側のハイライトを個別に扱う実装）を、すべてのツールボタン（コントロールパネルの`select`/`line`、パレットの`line`/`curve`/`arc`/`rect`/`circle`）をツール名文字列でマッピングした汎用データ構造（例：`toolButtons`オブジェクト）に基づき、一括して`.active`クラスを付与／剥奪する汎用ループ処理へリファクタリングすること（DIR 要件2）。
*   同一の`'line'`キーを指すコントロールパネルのボタンとパレットのボタンが、この汎用処理によって常に同時に正しくアクティブ化／非アクティブ化されることを保証すること（DIR 要件2、DIR 6章の持ち越し事項Aの解消）。
*   `PaletteController.js`が既に持つパレット内5ボタンの排他制御（`setActiveTool(tool)`）との責務分担について、DIR 2章では`main.js`と`PaletteController.js`双方の「ハードコード排除」が述べられている一方、DIR 4章の改修モジュール一覧では`main.js`のみが挙げられている。計画立案時は、`PaletteController`が担ってきたDOM操作専任の責務（コンストラクタ非依存・`onToolSelected`コールバック経由の疎結合）を崩さない範囲で、`main.js`の汎用トグル処理と`PaletteController.setActiveTool`のロジック重複・二重管理が発生しないよう整理方針を計画書に明記すること（例：`main.js`側の汎用トグルが唯一の一元管理箇所となり、`PaletteController`は自身の内部DOM操作のみに徹する、等）。

##### Non-goals（DIR 2章より）
*   **SHIFTキーによる「正方形」作図・「矩形維持」変形連動**：スコープ外。データ構造（`points`長さ4）のみを先行して敷き、操作連動は後続の「UI・操作充実フェイズ」で実装する。
*   **塗りつぶし（Fill）機能**：本Phaseでは「枠線（Stroke）のみ」の描画とする。
*   **`arc`/`circle`の本実装**：`Line`スタブフォールバックのまま現状維持とし、一切触らない（P1-7で対応予定）。

--------------------------------------------------------------------------------

#### 【計画書に必ず含めるべきタスクごとの作業】
計画書（RES）のタスクリストには、個別の実装タスクの後に、以下の作業を必ず含めること。
*  コード修正完了後、JSDocコメントの記載漏れがないことを確認する。
*  タスク完了後、作業レポート（本RESファイル）の詳細作業内容を記載し完成させる。
*  実装中に判断に迷った点、目視確認を推奨する箇所、将来この箇所を修正する際に注意すべき点があれば、RESの「懸念事項・要確認ポイント」欄に記述する。

#### 【計画書に必ず含めるべき固定タスク】
計画書（RES）のタスクリストには、全実装タスクの後に、以下のタスクを必ず含めること。
*  開発資料（PROJECT_ARCHITECTURE.md）を確認し、今回の実装がアーキテクチャの記載に影響を与えた場合は資料を更新する（`shapes/Rect.js`の新設、`ShapeFactory`の`rect`分岐の本実装化、`main.js`のツール切替方式の変更は影響大のため、更新は必須と想定してタスク化すること）。

--------------------------------------------------------------------------------

#### 【計画立案時の絶対遵守ルール (Constraints)】
*  **4頂点構造の一貫性**：`points`配列は`topLeft`/`topRight`/`bottomRight`/`bottomLeft`の順で長さ4固定とし、作図確定後は各頂点を個別に自由に動かせる仕様（歪んだ四角形を許容）を崩さないこと。矩形維持・スナップ等の先回り実装は行わないこと（YAGNI徹底）。
*  **共通API契約の完全準拠**：`Line`/`Curve`が実装する9メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`/`updateDraftEnd`/`getVertexIndexForHandle`）を同名・同シグネチャで実装し、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）のコードを一切変更しないこと。
*  **図形種別分岐の局所化維持**：`ShapeFactory`内の`type`判定を唯一の例外とし、`VectorModel`/`CanvasManager`/`InputTracker`に図形種別のif/switch分岐を新たに持ち込まないこと。
*  **ツール切替ハードコードの完全排除**：`main.js`のツールボタン制御において、個別ボタンごとの`if`/`else`分岐や2ボタン限定の相互排他ロジックを新たに残さないこと。ボタン追加時に`main.js`の当該ループ処理そのものを書き換える必要がない設計（開閉原則）とすること。
*  **スコープの厳守**：`js/shapes/Rect.js`の新規作成、`js/core/ShapeFactory.js`の`rect`分岐改修、`js/main.js`のツール切替汎用化リファクタリング以外のファイル（`Line.js`/`Curve.js`含む）は変更しないこと。SHIFTスナップ、塗りつぶし、`arc`/`circle`の実装には一切着手しないこと。
*  **Vanilla JS原則の維持**：外部ライブラリ・フレームワークを導入しないこと。
*  **MVCの厳守**：`VectorModel`を唯一のSSOTとし、「Model ➡️ 変更通知 ➡️ CanvasManager再描画」のPull型関係を崩さないこと。
*  **責務定義の明記（PROJECT_CONSTITUTION.md 3章）**：`Rect.js`を含む新規・改修対象の全`.js`ファイルは、先頭行に当該モジュールの単一責務を3行以内のJSDocで明記すること。責務に合わない機能は当該ファイルに追記せず、別ファイルへ分離すること。
