# COWORK_STATUS.md
## 現在状況・懸念事項（蓄積・毎セッション更新編）

---

### このファイルについて
* `COWORK_HANDOFF.md`（固定方針）と対をなす、**毎セッション更新するローカル専用ファイル**。
* Coworkプロジェクトの「コンテキスト」にはアップロードしない。Coworkは`_doc/COWORK_HANDOFF.md`の指示に従い、このファイルを直接読みに来ること。
* 新しいセッションで状況を更新した場合、このファイルを編集して最新状態を保つこと。
* **運用ルール（2026-08-08改訂）**：項目が「解決済み」になった場合、このファイルに残し続けない。要点と対応REQ/タスク番号を`_doc/COWORK_STATUS_CLOSED.md`へ移し、こちらからは削除する（コンテキスト肥大化・ハルシネーション誘発を避けるため）。このファイルには「現在進行中の作業」「まだ判断・対応が済んでいない懸念事項」のみを残す。過去の詳細な経緯を追う必要がある場合は、CLOSED側の対応REQ/RESファイルパスから遡ること。

---

### 1. プロジェクト現況スナップショット（最終更新：2026-08-09）
* **Phase01-01「拡張性を考慮したMVC最小骨格」：完了。**
  * 実装ファイル：`index.html`, `js/main.js`, `js/core/VectorModel.js`, `js/core/CanvasManager.js`, `js/core/InputTracker.js`, `js/shapes/Line.js`
* **Phase01-02「LINEの作成・選択・再編集における入力・描画・座標基盤の確立」：完了・クローズ済み（2026-08-08）。**
  * RES: `_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`（タスク1〜11、Task5.5 Interrupt、Task6.5 PlanningUpdateすべて完了・監査済み）
  * LINEのみを対象に「作成（2クリック配置＋プレビュー）」「選択（ホバー強調＋クリック選択＋ハンドル表示）」「再編集（始点/終点/移動の3種ハンドルのドラッグ）」を実現。当たり判定・ハンドル・ホバー・頂点操作（`hitTest`/`hitTestHandle`/`drawHandles`/`drawHover`/`setVertex`/`translate`の6メソッド）は`Line.js`側に自己完結させ、`core/`配下に図形種別分岐を持ち込まない拡張性を確保した。
  * 解決済み事項の詳細は`_doc/COWORK_STATUS_CLOSED.md`のPhase01-02章を参照。
* **Phase01-03「キャンバス全体化、右側固定フロートUI、およびツールモード切り替えの基盤確立」：完了・クローズ済み（2026-08-09）。**
  * DIR: `_log/dir/20260808_2307_DIR_Phase01-03_CanvasFullscreen_And_FloatUI.md`
  * RES: `_log/res/260808_2356_RES_Phase01-03_CanvasFullscreen_And_FloatUI.md`（タスク1〜8すべて完了、チェック0/1/2＋タスクごとのgit diff監査、テストプレイすべて通過）
  * Canvasの100vw/100vh全画面化＋リサイズ追従（dprスケール累積バグ対策込み）、右側固定フロートUI（コントロールパネル）の土台、`select`/`line`の明示的ツールモード切替、`ShapeFactory`新設による`VectorModel`のLine直接依存排除、図形削除機能（`Delete`/`Backspace`）を実現。
  * 解決済み事項の詳細は`_doc/COWORK_STATUS_CLOSED.md`のPhase01-03章を参照。
  * 図形パレットサブウィンドウ実装（旧P1-3計画）は、レイアウト基盤を先に固める判断により後続Phaseへスライド済み（暫定でPhase01-04以降と呼称）。
* **Phase01-04「フロートウィンドウシステムの構築と図形パレットの統合」：完了・クローズ済み（2026-08-09）。**
  * DIR: `_log/dir/20260808_1952_DIR_Phase01-04_FloatWindowManager_And_PaletteP.md`（リード設計AI発行）
  * RES: `_log/res/20260809_1212_RES_Phase01-04_FloatWindowManager_And_PaletteP.md`（タスク1〜7すべて完了、チェック0/1/2＋タスクごとのgit diff監査、Interrupt修正込みでテストプレイすべて通過）
  * `core/WindowManager.js`新設（フロートウィンドウのドラッグ・最前面化・イベント遮断の一元管理）、コントロールパネルのフロートウィンドウ化、5大図形（直線/曲線/弧/矩形/円）選択パレットウィンドウの新設と`js/palette/PaletteController.js`への配線切り出し、`ShapeFactory`への5大図形スタブ配備（未実装4種はLineへの安全なフォールバック）を実現。テストプレイで発見されたドラッグ不具合・パレットアクティブ表示同期不具合・テキスト選択不具合はInterrupt（`_log/req/20260809_1633_REQ_Interrupt_Phase01-04_DragAndPaletteSyncFix.md`）で修正済み。
  * 解決済み事項の詳細は`_doc/COWORK_STATUS_CLOSED.md`のPhase01-04章を参照。
* **Phase01-05「ベジエ曲線（Curve.js）の完全実装と幾何ポリモーフィズムの確立」：完了・クローズ済み（2026-08-09）。**
  * DIR: `_log/dir/20260809_1727_DIR_Phase01-05_BezierCurve_Implementation.md`（リード設計AI発行）
  * RES: `_log/res/20260809_1745_RES_Phase01-05_BezierCurve_Implementation.md`（タスク1〜4すべて完了、チェック0/1/2＋タスクごとのgit diff監査、テストプレイすべて通過）
  * 最初の新規具象図形クラス`js/shapes/Curve.js`（2次ベジェ曲線、始点・制御点・終点の3頂点構造）を実装し、`Line.js`と同名・同シグネチャの共通APIを自律実装することで、`core/`層（`VectorModel`/`CanvasManager`/`InputTracker`）を変更せずに図形種別を追加できる幾何ポリモーフィズムを実証した。`ShapeFactory`の`curve`分岐を本実装に接続。テストプレイで発見された2件の不具合（パレットで「曲線」を選んでも直線が生成される／作図プレビューが正しく追従せず始点終点が同一座標になる）はInterrupt2件（`_log/req/20260809_1830_REQ_Interrupt_Phase01-05_DraftTypeHardcoded.md`、`_log/req/20260809_1842_REQ_Interrupt_Phase01-05_MultiVertexShapeContract.md`）で修正済み。後者の修正で、共通APIは`updateDraftEnd`/`getVertexIndexForHandle`が加わり9メソッドに拡張された。
  * 解決済み事項の詳細は`_doc/COWORK_STATUS_CLOSED.md`のPhase01-05章を参照。
* **Phase01-06「矩形（Rect.js）の実装および図形パレット・ツール切替のハードコード排除」：完了・クローズ済み（2026-08-09）。**
  * DIR: `_log/dir/20260809_1915_DIR_Phase01-06_Rect_And_PaletteRefinement.md`（リード設計AI発行）
  * RES: `_log/res/20260809_1925_RES_Phase01-06_Rect_And_PaletteRefinement.md`（タスク1〜5すべて完了、チェック0/1/2＋タスクごとのgit diff監査、テストプレイ通過）
  * 図形ポリモーフィズム実証の第二弾として`js/shapes/Rect.js`（4頂点構造、`Line`/`Curve`と同一の9メソッド契約）を実装し、`ShapeFactory`の`rect`分岐を本実装に接続。同時に`main.js`のツール切替ロジック（コントロールパネルの`select`/`line`ボタン）を、個別ハードコードされた`classList.toggle`/`addEventListener`から`toolButtons`オブジェクトを走査する汎用ループへリファクタリングし、ボタン増設時に`main.js`本体を書き換えなくてよい開閉原則を成立させた（パレット側`PaletteController`は変更対象外のまま、コントロールパネル領域とパレット領域で`.active`管理の責任者を分離する設計とした）。チェック2でタスク2（Rect.js本実装）の粒度が前例（Curve.js）より大きいことが判明し、描画系（タスク2）と当たり判定・頂点操作系（タスク3）の2タスクに分割する差し戻しを実施。
  * 解決済み事項の詳細は`_doc/COWORK_STATUS_CLOSED.md`のPhase01-06章を参照。

---

### 2. 現在進行中のタスク・懸念事項（毎セッション更新）
* （2026-08-09時点、Phase01-06クローズ後）次の一手は未確定。ユーザーの意向として、パン機能・直感的な操作・削除UI等の不足を補う「UI・操作充実フェイズ」、または弧・円等の次の図形追加Phase（P1-7）のいずれかが候補。着手時はStep 0（企画検討）から。

* **A. 次の「UI・操作充実フェイズ」へ持ち越し**
  * パン機能が未実装で、実用的な編集アプリとしては不十分（ユーザー自身がテストプレイで指摘、2026-08-09）。
  * 選択ツール・直線ツールはあるが、直感的なオブジェクト操作・作成ができない（同上）。
  * 図形削除は`Delete`/`Backspace`キーで機能しているが、削除ボタン等のUIがなく発見しにくい（同上）。
  * `line`ツール中はホバー判定自体を行わないため、ホバー時の視覚的フィードバック（カーソル形状の変化等）が一切ない。
  * コントロールパネルのヘッダーは現状ドラッグ移動が非機能（見た目のみ）。実装する際は`mousedown`の`stopPropagation`との整合を確認すること。
  * `InputTracker.setTool(tool)`に引数バリデーションがなく、`main.js`の`createToolClickHandler`も2ボタン限定実装。ツール種別を増やす際は両方の書き換えが必要。
  * `InputTracker`の`keydown`は`document`購読のため、将来カラーコード入力欄等のテキスト入力UIを追加する際は、フォーカス中要素を判定して`Delete`/`Backspace`の誤爆を除外するロジックが必要。
  * タスク6で追加した`currentTool`ガード条件が`handleMouseMove`/`handleMouseDown`の既存JSDoc説明文に反映されていない軽微な記載漏れ（動作に影響なし）。まとめて修正してよい。
  * コントロールパネルの操作モードボタン再設計：「直線ツール」は現状パレットの「直線」ボタンと同一の`tool='line'`を指すため、両者が連動してハイライトされる（バグではなく仕様上の帰結）。コントロールパネルは「現在の操作モード」を設定する場所であり、将来「キャンバス移動（パン）」等のモードも同列に追加予定のため、「直線ツール」は図形種別選択ではなく「図形作成」等の汎用モードボタンへ統合するのが妥当（ユーザー指摘、2026-08-09）。なお、Phase01-06で`main.js`のトグル機構自体は汎用化済み（`toolButtons`走査ループ）だが、ボタンの意味づけ自体の再設計はまだ手つかず。
  * `hitTestHandle`の優先順位問題（Phase01-06由来）：矩形（`Rect`）を`setVertex`による自由変形で極端に小さく潰した場合、複数の頂点が同一`tolerance`範囲内に密集すると常に`topLeft`側のハンドルが優先的に選ばれる（`Line`/`Curve`と同じ設計思想で不具合ではないが、極端な変形を行うUIが必要になった場合は最小サイズ制約等の検討が要る）。
  * `toolButtons`（`main.js`、Phase01-06由来）へ将来ボタン追加時の注意点：対応するDOM要素を`index.html`側に先に用意しないと、`document.getElementById(...)`が`null`を返し`.classList`アクセスで`TypeError`になる。パン/zoom等の新規モードボタンを追加する際はDOM側を先に用意すること。

* **B. 次の図形追加Phase（弧・円等）へ持ち越し**
  * 新規図形クラスは`Line`/`Curve`/`Rect`と同一の9メソッド共通インターフェース（`hitTest`/`hitTestHandle`/`draw`/`drawHandles`/`drawHover`/`setVertex`/`translate`/`updateDraftEnd`/`getVertexIndexForHandle`）を実装する必要がある（`VectorModel`/`InputTracker`は具象クラスを意識しないため、契約が破られると発生箇所から遠いエラーになる。Phase01-05で`vertexIndex`の意味不一致により実際に発生した不具合の詳細は5章のインシデント履歴を参照）。特に`updateDraftEnd`（2クリック作図中の追従挙動）と`getVertexIndexForHandle`（ハンドル名→vertexIndexの自己申告）は、頂点数・頂点構造が図形ごとに異なる場合に食い違いが起きやすいため要注意。
  * `ShapeFactory.create()`は未知の`type`に対し`Error`をthrowするが、呼び出し元は`try/catch`していない。図形種別を追加する際は`type`文字列の綴りに注意、または呼び出し元のバリデーション導入を検討。
  * `ShapeFactory`の`arc`/`circle`は現状フォールスルー`case`でLineスタブを共有している（`curve`はPhase01-05、`rect`はPhase01-06でそれぞれ個別`case`に分離済み）。専用クラス実装時は該当`case`を個別の`return new XXX(...)`に差し替える。将来`arc`/`circle`のどちらか一方だけ先に専用クラス化された場合、`PROJECT_ARCHITECTURE.md`の`ShapeFactory.js`エントリの言及順序（現在「`arc`/`circle`の2種は...」とまとめて記載）も1種のみに絞り込む修正が必要（Phase01-06由来）。弧・円等、直線とコンストラクタ引数の意味・個数が異なりうる図形を実装する際は、`ShapeFactory.create`の呼び出し元（`InputTracker`等）の引数の渡し方も合わせて見直す必要がある。
  * `Curve.draw(ctx, t=0)`の`t`引数は将来のモーフィング機能用の伏線として維持されているが本Phaseでは未使用 → モーフィング機能実装Phaseで対応。
  * `Curve.hitTest`の100分割ループによる当たり判定コストは、現状のベクター数（数十個程度）では無視できる計算量と評価済み → 頂点数が数千を超える規模になった際にAABB等の早期判定フィルタリングを検討（Cセクションのパフォーマンス項目と合わせて）。
  * `Curve`への制御点の追加・削除、moveハンドル（平行移動）の追加は、発注者の意向により別Phaseで対応予定（Phase01-05 DIR6章の設計決定）。

* **C. さらに将来のPhaseへ先送り**
  * `moveShape`の差分計算はDPI・CSSズーム環境下での誤差が未検証 → ズーム/パン機能実装時に本格検証。
  * 「空白部分」の判定にホバー状態（`mousemove`更新）を流用しており、タッチ操作等`mousemove`を経由しない入力には非対応 → タッチ対応検討時に見直し。
  * `commitDraft()`のid採番（連番文字列）は永続化・再読込を考慮していない → `CodeImporter.js`実装時、既存idとの衝突可能性を検討。
  * 選択・ホバー系APIの無条件`notifyChange()`呼び出し → 図形数増加でパフォーマンス問題が顕在化したら値変化チェックの追加を検討。
  * `window.addEventListener('resize', ...)`のデバウンス未実装、`removeEventListener`によるクリーンアップ未実装、`mouseup`への`stopPropagation`未実装 → いずれも現状は実害なしと確認済み。図形数の大幅増加やCanvasの動的生成/破棄など設計変更が入る場合に検討。
  * `WindowManager`の動的追加ウィンドウ再検知（`MutationObserver`等）非対応、単一`#draggingWindow`フィールドによる複数ウィンドウ同時ドラッグ非対応（Phase01-04由来） → ウィンドウを動的生成／複数同時操作する設計が入るPhaseで検討。
  * `.disabled`クラスの意味（`opacity:0.4`+`pointer-events:none`）が将来増える他の`.float-window`種別すべてに適切か（Phase01-04由来） → ウィンドウ種類が増えた時点で再検討。
  * `PaletteController`のボタンid解決が見つからない場合に静かにフィルタされエラー化しない仕様、初期`.disabled`（`index.html`）と`InputTracker`の初期`currentTool`の暗黙的な結合（いずれもPhase01-04由来） → ボタンid命名規則の変更時・初期ツール変更時に注意。

---

### 3. 保留・後回しにした事項（バックログ）
* `README.md` / `PROJECT_CONSTITUTION.md` の実態とのズレ（実装AIが「Google Antigravity」のまま、READMEのフォルダ構成が古い）：修正保留。キリのいいタイミングでまとめて対応予定。

---

### 4. Phaseクローズ記録
（Phaseがクローズされるたびに、棚卸し結果・仕分け結果をここに追記する。手順は`PROJECT_AI_WORKFLOW.md`3-5章参照）

* **Phase01-02（2026-08-08クローズ）**：全RESの懸念事項欄（約30項目）を棚卸し。ほぼ解決済み・設計決定確定済みと判断した項目は`_doc/COWORK_STATUS_CLOSED.md`へ移動（詳細は同ファイル参照）。実際に触っての目視判断が必要な項目（A）、P1-3着手時に判断が必要な項目（B）、さらに将来のPhaseへ先送りする項目（C）は本ファイル2章に残し、次セッション以降で扱う。
* **Phase01-03（2026-08-09クローズ）**：RESの懸念事項欄（約25項目）を棚卸し。タスク間の中間状態注記や、チェック0で発見・PlanningUpdateで解消済みのバグ（`startDraft`引数順序、`keydown`購読先）、テストプレイで確認済みの項目は`_doc/COWORK_STATUS_CLOSED.md`へ移動。ユーザー自身がテストプレイで指摘した「UI・操作充実フェイズ」向けの項目（A）、パレット実装Phase向け（B）、図形追加Phase向け（C）、さらに将来へ先送り（D）は本ファイル2章に残した。次フェイズは未着手（Step 0から開始）。
* **Phase01-04（2026-08-09クローズ）**：RESの懸念事項欄・Interrupt追記分を棚卸し。テストプレイで発見された3件の不具合（フロートウィンドウのドラッグ不可、パレットのアクティブ表示非同期、テキスト選択）はInterrupt（`20260809_1633`）で修正・実機確認済みのため`_doc/COWORK_STATUS_CLOSED.md`へ移動。Phase01-03から持ち越されていた「`main.js`のパレット配線切り出し」（旧B）は`PaletteController.js`新設により解消し同ファイルへ移動。ドラッグ・z-index排他・作図パイプライン・既存機能の回帰確認はすべてユーザーのテストプレイで問題なしと確認済み。テストプレイ中に新たに判明した「コントロールパネルの操作モードボタン再設計（直線ツール→図形作成等への統合）」は「UI・操作充実フェイズ」向け（A）として、`ShapeFactory`のフォールスルー`case`・将来のコンストラクタ引数差異は次の図形追加Phase向け（B）として、`WindowManager`の動的検知非対応等は将来へ先送り（C）として本ファイル2章に残した。次フェイズは未着手（Step 0から開始）。
* **Phase01-05（2026-08-09クローズ）**：`Curve.js`実装本体（RES `20260809_1745`）に加え、テストプレイで発見された2件の不具合修正Interrupt（`20260809_1830`：作図type固定バグ、`20260809_1842`：`vertexIndex`意味不一致バグ）を含めて棚卸し。3件のRESすべてのチェック0/1/2＋タスク/Interruptごとのgit diff監査を実施し、いずれも計画・REQ通りの実装であることを確認済み。2件の不具合はいずれも`Curve.js`自体の実装ミスではなく、`Line`（2頂点）を前提に書かれていた`core/`層（`VectorModel.updateDraft`／`InputTracker`のハンドルドラッグ処理）の規約ハードコードが原因であり、`updateDraftEnd`/`getVertexIndexForHandle`という2つの新規共通APIをShape側に自己申告させる設計で解消した（詳細は5章のインシデント履歴）。ひし形ハンドルの当たり判定・点線ヘルパーの視認性・作図/選択/ハンドルドラッグの一連の操作フローはすべてユーザーのテストプレイで問題なしと確認済み。`Curve`のmoveハンドル非搭載・2次ベジェ限定という設計決定は発注者の事前合意通りで確定事項として`_doc/COWORK_STATUS_CLOSED.md`へ移動。`t`引数・100分割ループのパフォーマンス・制御点追加削除機能・`arc`/`rect`/`circle`実装時の9メソッド契約遵守は次フェイズ向け（B）として本ファイル2章に残した。次フェイズは未着手（Step 0から開始）。
* **Phase01-06（2026-08-09クローズ）**：`Rect.js`実装（タスク1〜3）と`main.js`のツール切替汎用化（タスク4）、開発資料更新（タスク5）を含む全5タスクのRESを棚卸し。チェック0でDIR2章/4章の記載齟齬（`main.js`/`PaletteController.js`の責務分担）を発見しユーザー承認のうえ領域分担案で確定、チェック2でタスク2の粒度が前例（Curve.js）超過と判明しタスク2/3への分割差し戻しを実施（差し戻し後は再監査PASS）。Claude Browser paneのローカル`file://`環境制約により実装AI自身は画面上のマウス操作テストができなかったが、ユーザー自身のテストプレイ（選択・ハンドルドラッグ・ボタン同期）で解消・確認済み。`Rect`コンストラクタの非正規化方針・`hitTest`内部ヘルパーの位置づけ・`main.js`と`PaletteController`の責務分担・`PROJECT_ARCHITECTURE.md`の`main.js`項目追加判断は確定事項として`_doc/COWORK_STATUS_CLOSED.md`へ移動。`hitTestHandle`の優先順位問題・`toolButtons`拡張時の注意点は次のUI充実フェイズ向け（A）、`ShapeFactory`の`arc`/`circle`残存フォールバック文言の将来修正は次の図形追加Phase向け（B）として本ファイル2章に残した。次フェイズは未着手（Step 0から開始）。

---

### 5. 既知のインシデント履歴
* **2026-08-08**：REQファイル `_log/req/20260808_1227_REQ_Phase01-01_MVC_Architecture_Plan.md` が、ユーザーの「別名保存のつもりが上書き保存してしまった」という操作ミスにより、後発の別REQ内容（座標正規化要件の追記REQ）で上書きされる事故が発生。RES→REQ逆リンクの必要性を実証する形となった。ユーザーが元の内容を復元し、解決済み。再発防止として、以後はCoworkがREQファイルを直接作成する運用に変更。
* **2026-08-09（Phase01-05）**：`Curve`（3頂点図形）実装後のテストプレイで、「曲線を選んで作図しても直線になる」「作図プレビューがマウスまでの半分の距離までしか伸びず、始点・終点が同一座標になる」という2件の不具合が発覚。原因は`Curve.js`自体ではなく、`core/`層（`VectorModel.updateDraft`／`InputTracker`のハンドルドラッグ処理）が「図形は`Line`と同じ2頂点（`start`=0, `end`=1）」という前提の`vertexIndex`規約をハードコードしていたこと。`Curve`は3頂点（`start`=0, `control`=1, `end`=2）のため`index=1`の意味がズレ、作図中・再編集中のいずれも意図しない頂点（制御点）が動く形で表面化した。`Line`/`Curve`双方に`updateDraftEnd(x, y)`（作図プレビュー時の終点追従）と`getVertexIndexForHandle(handleName)`（ハンドル名→vertexIndexの自己申告）という2つの共通APIを新設し、`core/`層は常にこれらをポリモーフィックに呼び出す設計へ修正して解消（Interrupt `20260809_1842`）。**教訓**：新規図形クラスが`Line`と異なる頂点数・頂点構造を持つ場合、既存の`setVertex(vertexIndex,...)`/`hitTestHandle`の契約を満たすだけでは不十分で、`core/`層が暗黙に依存している「index=1は終点」等の慣習が他にも潜んでいないか、新規図形追加のたびに横断的に確認する必要がある。
