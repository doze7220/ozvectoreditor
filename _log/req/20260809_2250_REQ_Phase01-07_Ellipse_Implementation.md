### 作業指示書 REQ: Phase 01-07 : 楕円弧（Ellipse.js）の一元化設計と段階的実装
*  ルール: ./PROJECT_CONSTITUTION.md
*  開発資料: ./PROJECT_ARCHITECTURE.md
*  指針書(DIR): ./_log/dir/20260809_2247_DIR_Phase01-07_Ellipse_Implementation-v2.md

--------------------------------------------------------------------------------

#### 【作業手順（厳守事項）】
本プロンプトは、リード設計AIが発行したDIR（`./_log/dir/20260809_2247_DIR_Phase01-07_Ellipse_Implementation-v2.md`）に基づく、Phase 01-07「楕円弧（Ellipse.js）の一元化設計と段階的実装」の **「計画立案」のみを目的とする。絶対にソースコードの修正（ファイルの書き換え）を行わないこと。** 計画立案のみに留めること。

1. ルール（`./PROJECT_CONSTITUTION.md`）、開発資料（`./PROJECT_ARCHITECTURE.md`）、および指針書（DIR、上記パス）を熟読・把握すること。DIRは本Phaseにおいて実装AIが1歩も逸脱してはならない制約事項（北極星）である。
2. 以下の【実装要件】を満たすための高度なアーキテクチャ設計と作業計画を立案し、AIがハルシネーションを起こさない適切なスコープを持つ細かなタスクリストを構築すること。DIRとREQの記載に矛盾がある場合はDIRを優先すること。
3. 計画を出力する前に内部で自己監査を行い、ルール・開発資料・DIRの責務違反（`core/`層への図形種別分岐の新規混入、`Line`/`Curve`/`Rect`との共通API契約からの逸脱、`setVertex`の正規化ロジック欠落による反転ワープ不具合など）がないか確認して計画を純化すること。
4. 監査を通過した計画を、作業計画書テンプレート（`./_log/TEMPLATE_RES_ImpretonPlan.md`）に完全に準拠したフォーマットで、新規ファイルとして出力すること。
    *  出力先・ファイル名: `./_log/res/YYMMDD_HHMM_RES_Phase01-07_Ellipse_Implementation.md`（※YYMMDD_HHMMの部分は、作業実行時の現在日時を当てはめること）
5. チャットにて「計画書の作成が完了しました。タスクを実行するための新しいチャットへ移行してください」と報告すること。

--------------------------------------------------------------------------------

#### 【実装要件】
DIRに定義された以下2点を実現する。詳細な設計判断（数式、描画命令、ハンドル形状の細部等）はDIR本文（3章）に完全準拠すること。以下は要件の要約であり、矛盾する記載があればDIR本文を正とする。

##### 1. `js/shapes/Ellipse.js` の新規実装
*   **データ構造**：`this.points`は長さ5固定で保持する（DIR 要件1）。`points[0]`=中心／`points[1]`=右端制御点（X半径基準）／`points[2]`=上端制御点（Y半径基準）／`points[3]`=開始角制御点（常に`(xc+rx, yc)`）／`points[4]`=終了角制御点（円なら`(xc+rx, yc)`＝右端と同座標、弧なら`(xc-rx, yc)`＝左端）。
*   **コンストラクタと種別出し分け**：`(x1, y1, x2, y2)`に加え、`ShapeFactory`から「円」か「弧」かを区別するための追加パラメータ（例：第5引数の種別フラグ）を受け取れる形にする。円は`startAngle=0, endAngle=2π`、弧は`startAngle=0, endAngle=π`として初期化する（DIR 要件1・2章）。パラメータの具体名・型は計画時に決定してよいが、`ShapeFactory.create`の固定シグネチャ`(type, x1, y1, x2, y2)`自体は変更しないこと（`ShapeFactory`内部で`Ellipse`へ渡す引数を組み立てる形にする）。
*   **2クリック作図とドラフト追従（`updateDraftEnd(x, y)`）**：1回目のクリックを中心点`Pc`として固定し、`rx = |x_current - xc|`, `ry = |y_current - yc|`を算出、`points[1]`（右端: `xc+rx, yc`）・`points[2]`（上端: `xc, yc-ry`）を動的に再計算する。同時に`points[3]`・`points[4]`も最新の`rx, ry`に基づく円周上の位置へ同期再計算する（DIR 要件2、化石化防止）。
*   **描画（`draw(ctx, t = 0)`）**：`ctx.ellipse(xc, yc, rx, ry, 0, startAngle, endAngle)`を用いる。円は`closePath()`してstroke、弧は`closePath()`を呼ばずにstrokeする（DIR 要件3）。
*   **ハンドル描画（`drawHandles(ctx)`）**：中心（円形、moveハンドル、`Line`/`Curve`のmoveと同一仕様）、右端・上端（正方形、`points[1]`/`points[2]`そのもの）、左端・下端（正方形、`(xc-rx, yc)`/`(xc, yc+ry)`の計算値、対称位置ダミーハンドル）の計5個を表示する。開始角・終了角ハンドル（`points[3]`/`points[4]`）は本フェイズでは描画・当たり判定ともに対象外とする（DIR 要件3）。
*   **【最重要】ハンドル判定（`hitTestHandle(x, y, tolerance)`）とハンドル名解決**：中心→`'move'`、右端→`'right'`、上端→`'up'`、左端（対称位置）→`'left'`、下端（対称位置）→`'down'`を返す（優先順位はこの列挙順）。`getVertexIndexForHandle(handleName)`は`{ right: 1, up: 2, left: 1, down: 2 }`のルックアップとする（`'move'`キーは含めない。既存`InputTracker.handleMouseMove`は`activeHandle === 'move'`の場合に`getVertexIndexForHandle`を呼ばず`moveShape`へ分岐する既存実装のため、`Line`/`Curve`同様に`'move'`はこのルックアップ表に含めなくてよい）。
*   **【超重要】`setVertex(vertexIndex, x, y)`の正規化ロジック**：`InputTracker`はハンドル名をvertexIndexに変換してから`setVertex`を呼ぶため、`setVertex`側は呼び出し元がどのハンドル名だったかを知らない。単純な座標代入（`this.points[1] = {x, y}`）は左端ドラッグ時にハンドルが右側へ瞬間ワープする不具合を起こすため、必ず以下の正規化を実装すること（DIR 要件3【超重要】節）：
    *   `setVertex(1, x, y)`：`rx = |x - xc|`を再計算し、`points[1]`を常に正準右端位置`(xc+rx, yc)`に再配置する。
    *   `setVertex(2, x, y)`：`ry = |y - yc|`を再計算し、`points[2]`を常に正準上端位置`(xc, yc-ry)`に再配置する。
    *   上記2ケースいずれでも、更新後の`rx, ry`を基に`points[3]`・`points[4]`を円周上の同期位置へ再配置する。
    *   `setVertex(0, x, y)`：中心座標を`(x, y)`に更新し、`rx, ry`を維持したまま全`points`を中心基準で再計算する。
*   **当たり判定（`hitTest(x, y, tolerance)`）**：
    *   **0除算ガード（最優先で実装）**：`rx < 1`または`ry < 1`の場合は計算を行わず即座に`false`を返す（DIR 要件4【不具合防止】節）。
    *   楕円方程式`((x-xc)^2)/rx^2 + ((y-yc)^2)/ry^2 ≈ 1`に`tolerance`・`strokeWidth`を加味した境界線判定を行う。
    *   弧（開いている状態）の場合、`atan2(y-yc, x-xc)`で算出した角度が現在の開始角〜終了角の範囲内にある場合のみ`true`とする角度フィルターを実装する（DIR 要件4）。空隙部分（弧なら180°〜360°）での誤爆を防ぐこと。
*   **`translate(dx, dy)`**：`points`配列5要素すべて（開始角・終了角のダミー点含む）に`dx, dy`を相対加算する（DIR 要件5-6）。
*   **ホバー描画（`drawHover(ctx)`）**：`draw`と同じパス（円は閉じる、弧は開いたまま）に対し、`Line`/`Curve`/`Rect`と同一仕様（半透明の太線）で強調する。
*   `Line`/`Curve`/`Rect`が満たす9メソッド（`draw`/`drawHandles`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`drawHover`/`updateDraftEnd`/`getVertexIndexForHandle`）を、`Ellipse`でも100%同名・同引数で自律実装すること（DIR 要件5）。これにより`VectorModel`/`CanvasManager`/`InputTracker`は1行の変更もなく楕円弧を扱えることを担保する。

##### 2. `js/core/ShapeFactory.js` の配線接続
*   `ShapeFactory.create('circle', ...)`・`ShapeFactory.create('arc', ...)`における暫定`Line`フォールバックを撤去し、いずれも`new Ellipse(...)`のインスタンス生成へ接続する。`circle`は閉じた楕円（`endAngle=2π`相当）、`arc`は開いた半円（`endAngle=π`相当）として初期化されるよう、`Ellipse`コンストラクタへ渡す引数（種別フラグ）を出し分けること（DIR 要件1・2章、4章）。
*   `line`/`curve`/`rect`の3種は本Phaseのスコープ外であり、既存の実装のまま一切変更しないこと。

##### Non-goals（DIR 2章より）
*   **開始角・終了角の可変ハンドルの表示・操作**：スコープ外。`points[3]`/`points[4]`はデータとして裏側で同期更新するのみに留め、操作ハンドル・ピザスライス描画の有効化は後続の「弧・プロパティ拡張フェイズ」へ送る。
*   **SHIFTキーによる正円作図スナップ**：スコープ外。本フェイズは対角ドラッグ比率通りの自由な楕円/半楕円作図を許容する。
*   **塗りつぶし（Fill）機能**：本Phaseでは「枠線（Stroke）のみ」の描画とする（既存図形との一貫性）。

--------------------------------------------------------------------------------

#### 【計画書に必ず含めるべきタスクごとの作業】
計画書（RES）のタスクリストには、個別の実装タスクの後に、以下の作業を必ず含めること。
*  コード修正完了後、JSDocコメントの記載漏れがないことを確認する。
*  タスク完了後、作業レポート（本RESファイル）の詳細作業内容を記載し完成させる。
*  実装中に判断に迷った点、目視確認を推奨する箇所、将来この箇所を修正する際に注意すべき点があれば、RESの「懸念事項・要確認ポイント」欄に記述する。

#### 【計画書に必ず含めるべき固定タスク】
計画書（RES）のタスクリストには、全実装タスクの後に、以下のタスクを必ず含めること。
*  開発資料（PROJECT_ARCHITECTURE.md）を確認し、今回の実装がアーキテクチャの記載に影響を与えた場合は資料を更新する（`shapes/Ellipse.js`の新設、`ShapeFactory`の`circle`/`arc`分岐の本実装化は影響大のため、更新は必須と想定してタスク化すること）。

--------------------------------------------------------------------------------

#### 【計画立案時の絶対遵守ルール (Constraints)】
*  **5頂点構造の一貫性**：`points`配列は中心／右端／上端／開始角／終了角の順で長さ5固定とし、円・弧いずれの状態でもこの構造を崩さないこと（将来のモーフィング互換のため）。
*  **`setVertex`の正規化必須**：`vertexIndex=1,2`の更新は必ず中心からの絶対距離で`rx`/`ry`を再計算し正準位置へ再配置すること。呼び出し元のハンドル名に依存した分岐を`setVertex`内に持ち込まないこと（`setVertex`は`(vertexIndex, x, y)`のみを受け取る既存契約を変更しない）。
*  **0除算ガードの必達**：`hitTest`冒頭で`rx < 1`または`ry < 1`を弾く処理を欠落させないこと。
*  **円/弧の視覚的差異の確保**：弧は`closePath()`を呼ばない開いたストロークとし、円と混同されない見た目にすること。
*  **共通API契約の完全準拠**：`Line`/`Curve`/`Rect`が実装する9メソッドを同名・同シグネチャで実装し、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）のコードを一切変更しないこと。
*  **図形種別分岐の局所化維持**：`ShapeFactory`内の`type`判定を唯一の例外とし、`VectorModel`/`CanvasManager`/`InputTracker`に図形種別のif/switch分岐を新たに持ち込まないこと。
*  **スコープの厳守**：`js/shapes/Ellipse.js`の新規作成と`js/core/ShapeFactory.js`の`circle`/`arc`分岐改修以外のファイル（`Line.js`/`Curve.js`/`Rect.js`/`main.js`/`PaletteController.js`含む）は変更しないこと。角度可変ハンドル、SHIFTスナップ、塗りつぶしには一切着手しないこと。
*  **Vanilla JS原則の維持**：外部ライブラリ・フレームワークを導入しないこと。
*  **MVCの厳守**：`VectorModel`を唯一のSSOTとし、「Model ➡️ 変更通知 ➡️ CanvasManager再描画」のPull型関係を崩さないこと。
*  **責務定義の明記（PROJECT_CONSTITUTION.md 3章）**：`Ellipse.js`の先頭行に当該モジュールの単一責務を3行以内のJSDocで明記すること。
