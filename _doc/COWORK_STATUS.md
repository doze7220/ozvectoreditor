# COWORK_STATUS.md
## 現在状況・懸念事項（蓄積・毎セッション更新編）

---

### このファイルについて
* `COWORK_HANDOFF.md`（固定方針）と対をなす、**毎セッション更新するローカル専用ファイル**。
* Coworkプロジェクトの「コンテキスト」にはアップロードしない。Coworkは`_doc/COWORK_HANDOFF.md`の指示に従い、このファイルを直接読みに来ること。
* 新しいセッションで状況を更新した場合、このファイルを編集して最新状態を保つこと。
* **運用ルール（2026-08-08改訂）**：項目が「解決済み」になった場合、このファイルに残し続けない。要点と対応REQ/タスク番号を`_doc/COWORK_STATUS_CLOSED.md`へ移し、こちらからは削除する（コンテキスト肥大化・ハルシネーション誘発を避けるため）。このファイルには「現在進行中の作業」「まだ判断・対応が済んでいない懸念事項」のみを残す。過去の詳細な経緯を追う必要がある場合は、CLOSED側の対応REQ/RESファイルパスから遡ること。

---

### 1. プロジェクト現況スナップショット（最終更新：2026-10-06）
* **Phase 1「ベクターエディタとしての最低限機能実装とパイプライン構築」：完了・クローズ済み（2026-08-12）。**
  * MVC最小骨格構築（P1-01）を土台に、LINE操作基盤（P1-02）、キャンバス全画面化・フロートUI・ツールモード基盤（P1-03）、フロートウィンドウ管理・図形パレット統合（P1-04）を経て、曲線（P1-05）・矩形（P1-06）・円/楕円/弧（P1-07）の5大図形すべてを、共通9メソッド契約（`draw`/`drawHandles`/`drawHover`/`hitTest`/`hitTestHandle`/`setVertex`/`translate`/`updateDraftEnd`/`getVertexIndexForHandle`）を各図形クラスが自律実装する形で`core/`層無改修のまま実装完了。
  * 各サブフェイズ（P1-01〜P1-07）の実装詳細・棚卸し結果・監査記録は`_doc/COWORK_STATUS_CLOSED.md`の対応章を参照。REQ/RES/DIRファイル本体は`_log/req/closed/`・`_log/res/closed/`・`_log/dir/closed/`にアーカイブ済み。
* **Phase 2「UI・操作充実」：進行中。** 2026-10-06に`Phase02-00`でDIRを発行（`_log/dir/261006_2239_DIR_Phase02-00_UI_And_Operation_Enhancement.md`）。`Phase02-01`（操作モード再設計）は2026-10-06に完了。次は`Phase02-02`（ビュー変換：パン・ズーム・グリッド）。サブフェイズの進行状況はDIRの「サブフェイズ一覧」が正本。
* **2026-10-06：ワークフロー改訂（Interrupt扱い）。** NotebookLMの利用を中止し、リード設計AI役もCoworkが担う体制へ移行。DIRは`Phase XX-00`でPhase全体に1本だけ発行する軽量な基礎設計方針（大ゴール・サブフェイズ分け・サブフェイズごとの実装要件）とし、`Phase XX-01`以降はサブフェイズごとに別セッションでREQ→RES原本を作成する。途中変更はDIRを直接書き換えて変更履歴に残す。改訂対象：`TEMPLATE_DIR.md`、`PROJECT_AI_WORKFLOW.md`、`COWORK_HANDOFF.md`、`PROJECT_README.md`、`PROJECT_MILESTONE.md`、`PROJECT_PHASE_TRANSITION_CLEANUP.md`、`README.md`（クレジット欄）。`NOTEBOOK_HANDOFF.md`は廃止。
* Phase進行中は、サブフェイズの進み具合をDIRの「サブフェイズ一覧」で管理する（本ファイルでは重複管理しない）。

---

### 2. 現在進行中のタスク・懸念事項（毎セッション更新）
* （2026-10-06、Phase02-00）Phase 2のテーマを「UI・操作充実」に決定（多角形生成はP3、着色はP4へ繰り下げ）。下記Aの大半はPhase 2 DIRの各サブフェイズ「持ち越し事項」に割り当て済み。`hitTestHandle`の優先順位問題のみ本Phaseの対象外（極端な変形UIを扱わないため）。

* **A. 次の「UI・操作充実フェイズ」へ持ち越し**
  * パン機能が未実装で、実用的な編集アプリとしては不十分（ユーザー自身がテストプレイで指摘、2026-08-09）。
  * 図形削除は`Delete`/`Backspace`キーで機能しているが、削除ボタン等のUIがなく発見しにくい（同上）。
  * `InputTracker`の`keydown`は`document`購読のため、将来カラーコード入力欄等のテキスト入力UIを追加する際は、フォーカス中要素を判定して`Delete`/`Backspace`の誤爆を除外するロジックが必要。
  * `hitTestHandle`の優先順位問題（Phase01-06由来、Phase01-07のEllipseでも同様）：図形を`setVertex`による自由変形で極端に小さく潰した場合、複数の頂点が同一`tolerance`範囲内に密集すると常に先着の1ハンドルが優先的に選ばれる（`Line`/`Curve`/`Rect`/`Ellipse`共通の設計思想で不具合ではないが、極端な変形を行うUIが必要になった場合は最小サイズ制約等の検討が要る）。
  * 【Phase01-07由来・新規】縮退状態（`rx`または`ry`がほぼ0）の`Ellipse`は、`hitTest`の0除算ガードにより選択不可能になる（意図した安全策の副作用であり不具合ではない）。将来的にマーキー選択（ドラッグ範囲選択）や図形リスト（レイヤー）ウィンドウからの直接選択機能を実装する際に、この制約への対応（縮退図形へのアクセス手段の確保）を検討する（ユーザー指摘、2026-08-12）。
  * 【Phase02-01由来】選択モード中は図形パレットが`.disabled`（`pointer-events: none`がウィンドウ全体に掛かる）のため、ヘッダーもドラッグ移動できない。Phase01-04で「ヘッダーごと非活性化」と決めた仕様で回帰ではない。発注者は現状許容（2026-10-06）。Phase 02-02でモード追加時に`.disabled`の適用先を`.window-body`に限定するか判断する（DIRのPhase 02-02メモに記載済み）。

* **B. さらに将来のPhaseへ先送り**
  * 当初想定していた5大図形（直線・曲線・弧・矩形・円）の実装がPhase01-07で完了したため、「次の図形追加Phase」区分は本クローズをもって統合・整理した（新規図形クラス実装時に必要な9メソッド共通インターフェース遵守の教訓は`_doc/COWORK_STATUS_CLOSED.md`のPhase01-05章を参照）。
  * `ShapeFactory.create()`は未知の`type`に対し`Error`をthrowするが、呼び出し元は`try/catch`していない。将来新たな図形種別を追加する場合は`type`文字列の綴りに注意、または呼び出し元のバリデーション導入を検討。
  * `Curve.draw`/`Rect.draw`/`Ellipse.draw`の`t`引数は将来のモーフィング機能用の伏線として維持されているが未使用 → モーフィング機能実装Phaseで対応。
  * `Curve.hitTest`の100分割ループによる当たり判定コストは、現状のベクター数（数十個程度）では無視できる計算量と評価済み → 頂点数が数千を超える規模になった際にAABB等の早期判定フィルタリングを検討。
  * `Curve`への制御点の追加・削除、moveハンドル（平行移動）の追加は、発注者の意向により別Phaseで対応予定（Phase01-05 DIR6章の設計決定）。
  * `Ellipse.hitTest`の境界線判定は、中心距離比率と平均半径`(rx+ry)/2`による近似判定（真の最短距離計算を避けた設計、Phase01-07由来）。極端に細長い楕円の場合、長軸側と短軸側で当たり判定の許容幅に視覚的なブレが生じる可能性があるが、通常操作ではテストプレイで問題なしと確認済みの低優先度事項。
  * `moveShape`の差分計算はDPI・CSSズーム環境下での誤差が未検証 → ズーム/パン機能実装時に本格検証。
  * 「空白部分」の判定にホバー状態（`mousemove`更新）を流用しており、タッチ操作等`mousemove`を経由しない入力には非対応 → タッチ対応検討時に見直し。
  * `commitDraft()`のid採番（連番文字列）は永続化・再読込を考慮していない → `CodeImporter.js`実装時、既存idとの衝突可能性を検討。
  * 選択・ホバー系APIの無条件`notifyChange()`呼び出し → 図形数増加でパフォーマンス問題が顕在化したら値変化チェックの追加を検討。
  * `window.addEventListener('resize', ...)`のデバウンス未実装、`removeEventListener`によるクリーンアップ未実装、`mouseup`への`stopPropagation`未実装 → いずれも現状は実害なしと確認済み。図形数の大幅増加やCanvasの動的生成/破棄など設計変更が入る場合に検討。
  * `WindowManager`の動的追加ウィンドウ再検知（`MutationObserver`等）非対応、単一`#draggingWindow`フィールドによる複数ウィンドウ同時ドラッグ非対応（Phase01-04由来） → ウィンドウを動的生成／複数同時操作する設計が入るPhaseで検討。
  * `.disabled`クラスの意味（`opacity:0.4`+`pointer-events:none`）が将来増える他の`.float-window`種別すべてに適切か（Phase01-04由来） → ウィンドウ種類が増えた時点で再検討。
  * `PaletteController`のボタンid解決が見つからない場合に静かにフィルタされエラー化しない仕様、初期`.disabled`/`.active`（`index.html`）と`InputTracker`の初期`currentMode`の暗黙的な結合（Phase01-04由来。Phase02-01で起動時の`applyMode(OperationMode.SELECT)`による同期を導入したが、JS読込前の初期表示用に静的記述も残している） → ボタンid命名規則の変更時・初期モード変更時は`index.html`と`main.js`の両方を揃えること。
  * 【Phase02-01由来】図形種別の一覧が`ShapeFactory`の受理種別と`InputTracker`の`SHAPE_TYPES`に二重管理されている（加えて`PaletteController.#BUTTON_DEFS`・`index.html`も揃える必要あり）。`ShapeFactory`側に受理種別一覧を公開させて単一化するのが望ましい → 図形種別追加時、または次に`ShapeFactory.js`に触れる際にInterruptで対応。
  * 【Phase02-01由来】古いJSDoc・用語の残存：`InputState`のJSDoc（「新規Line作成中」「start/end/move」）、`activeHandle`の`@type {'start'|'end'|'move'|null}`、`handleMouseMove`の「作成中Line」表記、`WindowManager.js`責務JSDocと開発資料4章の「ツール状態」表記（→「操作モード」）。いずれも動作に影響なし → 該当ファイルに触れる際、またはまとめてInterruptで修正。
  * 【Phase02-01由来】カーソル形状は`setMode`・`mousemove`・ハンドルドラッグ開始時にのみ再評価されるため、クリック選択直後・ドラッグ終了直後・`Delete`削除直後はマウスを動かすまで直前の形状が残る（実害小） → テストプレイで気になった場合に対応。

---

### 3. 保留・後回しにした事項（バックログ）
* `README.md` / `PROJECT_CONSTITUTION.md` の実態とのズレ（実装AIが「Google Antigravity」のまま、READMEのフォルダ構成が古い）：本格修正は保留、キリのいいタイミングでまとめて対応予定。ただし2026-08-12、README.mdには「開発中・完成予想図」である旨の一文のみ先行して追記済み。

---

### 4. Phaseクローズ記録
（Phaseがクローズされるたびに、棚卸し結果・仕分け結果をここに追記する。手順は`PROJECT_AI_WORKFLOW.md`3-5章参照）

* **Phase 1（P1-01〜P1-07、2026-08-12にフェイズ大番号クローズ）**：全7サブフェイズの棚卸しが完了。サブフェイズごとの棚卸し記録・解決済み事項は`_doc/COWORK_STATUS_CLOSED.md`（Phase01-02〜01-07の各章）へ移動済み。未解決のまま持ち越した項目は本ファイル2章にA/B区分で整理済み。あわせて`_doc/PROJECT_PHASE_TRANSITION_CLEANUP.md`の定型プロセスに沿って、`_log/req`・`_log/res`・`_log/dir`のPhase1関連ファイルを`closed/`へ物理アーカイブ、`PROJECT_ARCHITECTURE.md`の監査（コード追従記述・比喩・多重表記の排除）を実施した。次のPhase 2は未着手。

---

### 5. 既知のインシデント履歴
（インシデント発生時にここへ記録し、解消後は`_doc/COWORK_STATUS_CLOSED.md`へ移動する）

* Phase1期間中に発生した2件のインシデント（2026-08-08のREQ上書き事故、2026-08-09のCurve `vertexIndex`不一致バグ）はいずれも解消済み。詳細と教訓は`_doc/COWORK_STATUS_CLOSED.md`（運用インシデント章、Phase01-05章）を参照。
