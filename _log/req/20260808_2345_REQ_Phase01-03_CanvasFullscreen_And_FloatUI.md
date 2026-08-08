### 作業指示書 REQ: Phase 01-03 : キャンバス全体化、右側固定フロートUI、およびツールモード切り替えの基盤確立
*  ルール: ./PROJECT_CONSTITUTION.md
*  開発資料: ./PROJECT_ARCHITECTURE.md

--------------------------------------------------------------------------------

#### 【作業手順（厳守事項）】
本プロンプトは、Phase 01-03「キャンバス全体化、右側固定フロートUI、およびツールモード切り替えの基盤確立」の **「計画立案」のみを目的とする。絶対にソースコードの修正（ファイルの書き換え）を行わないこと。** 計画立案のみに留めること。

1. ルール（`./PROJECT_CONSTITUTION.md`）および開発資料（`./PROJECT_ARCHITECTURE.md`）を熟読・把握すること。
2. 以下の【実装要件】を満たすための高度なアーキテクチャ設計と作業計画を立案し、AIがハルシネーションを起こさない適切なスコープを持つ細かなタスクリストを構築すること。
3. 計画を出力する前に内部で自己監査を行い、ルール・開発資料の責務違反（Managerへの状態混入、Rendererへの図形種別分岐のベタ書きなど）がないか確認して計画を純化すること。
4. 監査を通過した計画を、作業計画書テンプレート（`./_log/TEMPLATE_RES_ImpretonPlan.md`）に完全に準拠したフォーマットで、新規ファイルとして出力すること。
    *  出力先・ファイル名: `./_log/res/YYMMDD_HHMM_RES_Phase01-03_CanvasFullscreen_And_FloatUI.md` (※YYMMDD_HHMMの部分は、作業実行時の現在日時を当てはめること)
5. チャットにて「計画書の作成が完了しました。タスクを実行するための新しいチャットへ移行してください」と報告すること。

--------------------------------------------------------------------------------

#### 【実装要件】
Phase01-02で確立したLINE専用の入力・描画・座標基盤を土台に、本Phaseでは以下4つの基盤整備を並行して行う：(1) Canvasの全画面化とリサイズ追従、(2) 右側固定フロートUI（コントロールパネル）の土台構築、(3) 明示的なツールモード（SELECT/LINE）の導入と図形削除機能、(4) `ShapeFactory`によるModelのLine直接依存の排除。以下は設計AI（発注者側）で確定済みの方針であり、そのままRESの「2. アーキテクチャ設計」に反映すること。

##### 1. `index.html` / CSSの全画面化
*   Canvasを`100vw` / `100vh`、`position: absolute; top: 0; left: 0; z-index: 1;`で配置する。
*   現行のbody要素のflexboxによる中央寄せレイアウト（`display: flex; justify-content: center; align-items: center;`）を撤去し、全画面表示に適したスタイル（`margin: 0`、`overflow: hidden`等）に置き換える。
*   `<canvas>`要素のHTML属性`width="800" height="600"`のハードコードを削除する（バッファサイズはJS側（`CanvasManager`）が計算して設定するため）。
*   画面右側に固定されるフロートコンテナ`<div id="control-panel">`を新設する。本体コンテナとヘッダー（将来のドラッグバー想定領域）を明確に分離したDOM構造にする（ドラッグ移動機能自体は本Phaseのスコープ外、構造の用意のみ）。
*   フロートパネル内に「選択ツール」ボタンと「直線ツール」ボタンを配置する。アイコンは簡易的なテキスト・絵文字・CSSのみで表現し、外部アイコンライブラリ等は導入しないこと。現在アクティブなツールのボタンが視覚的に強調されるようスタイルを用意する。

##### 2. `core/CanvasManager.js` のリサイズ対応
*   既存の`initCanvasSize()`のロジックを、初期化時にもリサイズ時にも呼び出せる公開メソッド`resize()`として一本化する（初期化用と再計算用でロジックを重複させないこと）。
*   `resize()`の先頭で必ず`ctx.setTransform(1, 0, 0, 1, 0, 0)`（または`ctx.resetTransform()`）を呼び出し、それまでの`dpr`スケーリングをリセットしてから、最新の`dpr`で`ctx.scale(dpr, dpr)`を適用すること。（※これを怠ると、リサイズのたびに拡大率が累積して描画が際限なく拡大してしまうバグが発生するため、確実に反映すること。）
*   `CanvasManager`自身はshapes配列やModelへの参照を一切持たない。`resize()`はCanvasのバッファサイズ再計算のみを行い、再描画（`render()`の呼び出し）はしない（純粋レンダラーの責務を維持するため、トリガーは要件3で`main.js`側に持たせる）。

##### 3. `main.js` のresizeイベント配線
*   `window.addEventListener('resize', ...)`を追加する。
*   リサイズ発火時、まず`canvasManager.resize()`を呼んでバッファサイズを同期させ、その直後に既存の`model.onChange`コールバックと同じ引数構成（`selectedId` / `hoveredId` / `draftLine`）で`canvasManager.render(model.getShapes(), { ... })`を呼び出し、再描画をトリガーする。
*   再描画トリガーの責務は`main.js`側に置くこと。`CanvasManager`内部にshapesを保持させて自己再描画させるような設計は禁止（要件2参照）。

##### 4. `core/ShapeFactory.js` の新設
*   新規ファイル `./js/core/ShapeFactory.js` を作成する。最先頭行に「図形オブジェクトの生成責務（Factoryパターン）を担う。」という趣旨の責務定義コメントを3行以内のJSDocで記述する。
*   `create(type, x1, y1, x2, y2)`メソッドを実装する。`type === 'line'`の場合に`Line`インスタンスを生成して返す。未知の`type`が渡された場合の挙動（エラーを投げる／`null`を返す等）は実装AIが妥当と判断する方針を採用し、RESの該当タスクにその方針を明記すること。

##### 5. `core/VectorModel.js` のデカップリングとドラフト生成方式の変更
*   `Line.js`の直接importを削除し、図形の生成をすべて`ShapeFactory`経由に置き換える。
*   `startDraft(x, y)`のシグネチャを`startDraft(type = 'line', x, y)`のように、第1引数に`type`を**デフォルト値`'line'`付きで**追加する。内部では`ShapeFactory.create(type, x, y, x, y)`を呼び出す形に変更する。
    *   デフォルト値を設けるのは、`InputTracker`側の呼び出し引数の更新（要件6）が別タスクに分割されても、既存の`model.startDraft(x, y)`という呼び出しがその間も直線としてそのまま機能し、タスクの区切り目で動作確認が壊れないようにするための意図的な設計である。RESのタスク分割・実行順序にこの意図を反映すること。
*   `updateDraft(x, y)`内の`this.#draftLine.x2 = x`等の直接プロパティアクセスを、`this.#draftLine.setVertex(1, x, y)`へのポリモーフィックな呼び出しに置き換える。
*   `deleteShape(id)`を新設する。指定idの図形を`#shapes`から除去し`#notifyChange()`を呼ぶ。削除対象が選択中（`#selectedId`）またはホバー中（`#hoveredId`）であった場合は、削除と同時にそれらもクリアし、存在しない図形のidを状態に残さないこと。
*   `#draftLine`に付与されているJSDocの`@type {Line|null}`など、Line固有の型注記が残っている箇所は、Line依存排除の趣旨に合わせて汎用的な表現（例:`{Object|null}`、または「draw/setVertex等の共通インターフェースを持つ図形オブジェクト」といった説明）に更新すること。

##### 6. `core/InputTracker.js` へのツールモード導入
*   `this.currentTool = 'select'`（デフォルト）を新設する。
*   外部（`main.js`）からツールを切り替えるための`setTool(tool)`メソッドを新設し、呼び出し時に必ず以下を行う：
    1.  `this.currentTool`を更新する。
    2.  `this.model.clearSelection()`と`this.model.clearHovered()`を**無条件で**呼び出し、選択・ホバー状態をクリアする（ツールを切り替えた瞬間、直前のツールの選択・ホバー状態を一切引き継がせない）。
    3.  ツール切り替え時点で`DRAWING`（作成途中）または`DRAGGING_HANDLE`（ハンドル操作中）の状態であった場合は、`model.cancelDraft()`を呼んだ上で内部状態を強制的に`IDLE`へリセットする。
*   `IDLE`状態の`mousemove`によるホバー判定は`this.currentTool === 'select'`の場合のみ実行するようガードする。`line`ツール中はホバー判定・`setHovered`/`clearHovered`の呼び出しを一切行わない。
*   `mousedown`によるハンドル検出（`hitTestHandle`呼び出し）も`this.currentTool === 'select'`の場合のみ実行するようガードする。
*   `IDLE`状態の`click`ハンドラを、`currentTool`に応じて次のように分岐する：
    *   **`select`ツール中**：ホバー中の図形があれば`selectShape`を呼ぶ。ホバー中の図形がなければ、選択中であれば`clearSelection`のみを呼ぶ。**新規図形の作成（`startDraft`の呼び出し）は一切行わない。**
    *   **`line`ツール中**：ホバー判定自体を行っていないため、クリック位置に関わらず常に`model.startDraft('line', x, y)`を呼び`DRAWING`へ遷移する。
*   `DRAWING`状態での`click`による`commitDraft()`実行後も、**`currentTool`は`line`のまま維持し、内部状態を`IDLE`へ戻すのみでツールの自動切り替えは行わない**（ツールを明示的に切り替えない限り、連続して直線を作成できるようにするため）。
*   `SELECT_TOOL`（`currentTool === 'select'`）かつ図形選択中に`Delete`または`Backspace`キーが押下された場合、選択中図形を削除する`keydown`イベントハンドラを追加する。
    *   `this.currentTool === 'select'`かつ`this.model.getSelectedId()`が存在する場合のみ、`this.model.deleteShape(selectedId)`を呼び出す。
    *   ブラウザ標準の「戻る」動作等の誤発火を防ぐため、該当条件でハンドラを実行する際は`event.preventDefault()`を呼ぶこと。
    *   フォーム要素へのフォーカス等による誤爆の考慮は、現状フォーム要素が存在しないため本Phaseでは不要（将来UI要素が増えた際の課題として送ってよい）。

##### 7. `main.js` のツールボタン配線
*   フロートパネル内の「選択ツール」「直線ツール」ボタンの`click`イベントを購読し、それぞれ`inputTracker.setTool('select')` / `inputTracker.setTool('line')`を呼び出す。
*   フロートUI（コントロールパネルのコンテナ要素）に対して`mousedown` / `click` / `mousemove`の各イベントに`event.stopPropagation()`を実装し、UI操作がCanvas（`InputTracker`）側へ透過して意図しない選択解除やライン描画開始を引き起こさないようにする。
*   アクティブなツールのボタンに視覚的な強調（CSSクラスの切り替え等）を適用する配線を行う。

##### スコープ外（本計画に絶対に含めないこと）
*   複数図形パレット・LINE以外の図形追加（後続Phaseで対応）
*   フロートパネルのドラッグ移動機能そのもの（DOM構造の準備のみが本Phaseの範囲）
*   パン・ズーム機能
*   タッチ操作対応
*   Undo/Redo
*   複数選択（マルチセレクト）

--------------------------------------------------------------------------------

#### 【計画書に必ず含めるべきタスクごとの作業】
計画書（RES）のタスクリストには、個別の実装タスクの後に、以下の作業を必ず含めること。
*  コード修正完了後、JSDocコメントの記載漏れがないことを確認する。
*  タスク完了後、作業レポート（本RESファイル）の詳細作業内容を記載し完成させる。
*  実装中に判断に迷った点、目視確認を推奨する箇所、将来この箇所を修正する際に注意すべき点があれば、RESの「懸念事項・要確認ポイント」欄に記述する。

#### 【計画書に必ず含めるべき固定タスク】
計画書（RES）のタスクリストには、全実装タスクの後に、以下のタスクを必ず含めること。
*  開発資料（PROJECT_ARCHITECTURE.md）を確認し、今回の実装がアーキテクチャの記載に影響を与えた場合は資料を更新する。開発資料に影響がない場合は、このタスクは不要とする。

--------------------------------------------------------------------------------

#### 【計画立案時の絶対遵守ルール (Constraints)】
*  **MVCの厳守（防衛線の維持）**：`VectorModel`を唯一のSSOTとし、「Model ➡️ 変更通知 ➡️ CanvasManager再描画」というPull型の関係を100%維持すること。`CanvasManager`にshapes配列やModelへの参照を持たせ、リサイズ時に自己完結で再描画するような設計は禁止。再描画のトリガーは必ず`main.js`側に置くこと（要件2・3参照）。
*  **図形種別分岐の排除**：`ShapeFactory`内の`type`判定を唯一の例外とし、`VectorModel` / `CanvasManager` / `InputTracker`のいずれにも図形種別を判定するif/switch分岐を新たに持ち込まないこと。将来の曲線・円・楕円の追加時に、`ShapeFactory`への分岐追加のみで対応できることを設計の妥当性の判断基準とすること。
*  **dprスケールのリセット必須**：`CanvasManager.resize()`は、`ctx.scale`を適用する前に必ず`ctx.setTransform(1, 0, 0, 1, 0, 0)`等でトランスフォームをリセットすること。これを怠った実装は不可とする。
*  **ツールモードの排他性**：`select`ツール中は新規図形作成を、`line`ツール中はホバー判定・選択・ハンドル操作を、それぞれ一切発生させないこと（要件6参照）。
*  **ツール切り替え時の状態クリア**：`setTool`実行時は選択・ホバー状態を無条件でクリアし、進行中のドラフト・ドラッグ操作も安全に破棄すること（要件6参照）。
*  **既存座標変換ロジックの保護**：`InputTracker.getLogicalCoordinate`のDPI対応・CSSズーム吸収ロジックを壊さないこと。
