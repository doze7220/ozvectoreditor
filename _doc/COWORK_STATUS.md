# COWORK_STATUS.md
## 現在状況・懸念事項（蓄積・毎セッション更新編）

---

### このファイルについて
* `COWORK_HANDOFF.md`（固定方針）と対をなす、**毎セッション更新するローカル専用ファイル**。
* Coworkプロジェクトの「コンテキスト」にはアップロードしない。Coworkは`_doc/COWORK_HANDOFF.md`の指示に従い、このファイルを直接読みに来ること。
* 新しいセッションで状況を更新した場合、このファイルを編集して最新状態を保つこと（過去の記述は基本的に残し、古くなった項目は「解決済み」「Phase◯◯へ移行」等に更新する）。

---

### 1. プロジェクト現況スナップショット（最終更新：2026-08-08）
* **Phase01-01「拡張性を考慮したMVC最小骨格」：完了。**
  * タスク1〜9すべて `[x]`。RES記載内容と実コードを突合監査済み、アーキテクチャ違反なし。
  * 実装ファイル：`index.html`, `js/main.js`, `js/core/VectorModel.js`, `js/core/CanvasManager.js`, `js/core/InputTracker.js`, `js/shapes/Line.js`
  * 座標正規化・DPI対応（要件4／タスク4・5改修）も反映済み。
* **Phase01-02「LINEの作成・選択・再編集における入力・描画・座標基盤の確立」：企画検討（Step 0）完了、REQ発行済み。**
  * REQ: `_log/req/20260808_1831_REQ_Phase01-02_LineInteraction_Foundation.md`
  * Cowork側で確定した設計方針（次セッションでのRES監査の前提となるため記録）：
    * LINEのみを対象に「作成（2クリック配置＋プレビュー）」「選択（ホバー強調＋クリック選択＋ハンドル表示）」「再編集（始点/終点/移動の3種ハンドルのドラッグ）」までを実現し、入力・描画・座標統一の基盤を固める。
    * パレット未実装のため、モード切り替えは「空白クリック＝新規作成」「既存図形クリック＝選択」の暗黙分岐。選択中に空白クリックで選択解除。
    * 当たり判定・ハンドル描画は`Line.js`側に閉じ込め、`VectorModel`/`CanvasManager`/`InputTracker`に図形種別分岐を持ち込まない（将来の曲線・円追加時の拡張性担保）。
    * moveハンドルは線分中点に配置。曲線実装時（P1-4）に中点ハンドルとの衝突が起きうるが、これはShape側にロジックが閉じているため今回は対処不要、P1-4着手時の課題としてバックログ送り。
  * RES: `_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`（監査済み・チェック0/1/2すべて通過。タスク1〜11の実行フェイズへ移行可）
  * 次のアクション：実装AIにタスク1から順次実行させる（`TEMPLATE_REQ_TaskExecution_Lite.md`を使用）。

---

### 2. 現在進行中のタスク・懸念事項（毎セッション更新）
* （2026-08-08時点）Phase01-02はタスク実行待ち（タスク1〜11、未着手）。
* RES監査で見つけた実装時の軽微な注意点（RESの修正までは不要、タスク8/10実装時に留意すればよいレベル）：
  * `DRAGGING_HANDLE`状態で`mouseup`により`IDLE`へ戻った直後、ブラウザ仕様上その直後に`click`イベントが発火する。ハンドル位置はほぼ常にshape本体の`hitTest`範囲内でもあるため、IDLE側の「クリックで選択」処理が同一図形に対して冗長に再発火しうる（実害はほぼ無い＝同じidへの再selectShapeなので無視して問題ないが、念のためタスク8実装時に意識しておくとよい）。
* 恒久対応として、RES→REQ逆リンク（参照元REQ行）が全RESテンプレート（ImpretonPlan/SurveyPlan/Interrupt/AddInterrupt/Survey）に欠けていたため、5テンプレートすべてに`* 参照元REQ:`行を追加。今回のPhase01-02のRESにも遡って追記済み。Phase01-01のRESには未追記（過去ログ保護のため、触れる場合は別途ユーザー判断で対応）。
* Phase01-02 タスク1〜5完了・監査済み。ただしタスク5（`updateVertex`/`moveShape`）で、`VectorModel`が`shape.x1`等のLine固有プロパティに直接アクセスするアーキテクチャ上の不備を発見（実装AIも懸念事項欄で自己申告済み）。
* **Task5.5（Interrupt）完了・監査済み**：REQ `_log/req/20260808_2011_REQ_Interrupt_Phase01-02_Task5.5_ShapeVertexPolymorphism.md`。`Line.js`に`setVertex`/`translate`を追加し、`VectorModel.updateVertex`/`moveShape`をポリモーフィック呼び出しへ置き換え済み。`updateVertex`/`moveShape`内のLine固有プロパティ直接アクセスは解消。次はタスク6（`CanvasManager.js`のrenderシグネチャ拡張）。
* タスク5.5見出しの不一致はユーザー側で修正済み。
* Phase01-02 タスク6完了・監査済み（`CanvasManager.render`のシグネチャ拡張、問題なし）。ただしタスク6実施時点で計画の穴を発見：`main.js`の`render`呼び出しに状態を渡す配線タスクがどこにも存在しなかった（タスク7〜11のいずれにも`main.js`の言及なし）。
* **タスク6.5（PlanningUpdate）発行済み**：REQ `_log/req/20260808_2036_REQ_PlanningUpdate_Phase01-02_Task6.5_MainJsWiring.md`。タスク6直後・タスク7の前に`main.js`の状態配線タスクを新設。タスク7〜10を段階的に目視確認できるようにする狙い。次のアクションはこのPlanningUpdateの実行（RESへのタスク6.5追加）→その後タスク6.5自体の実行→監査→タスク7へ進行。
* **バックログ候補（P1-3着手時に検討）**：`VectorModel.startDraft`が`new Line(x, y, x, y)`とLine固定でインスタンス化しており（タスク4実装）、`updateDraft`も`this.#draftLine.x2 = x`のようにLine固有プロパティへ直接アクセスしている（タスク5.5実施時点で確認・スコープ外として現状維持）。P1-3でパレットが導入され複数図形をツールとして切り替えられるようになった際、「選択中ツールに応じてどの図形クラスを生成するか」をVectorModel内でif/switch分岐させると、本Phaseで徹底している「core/に図形種別分岐を持ち込まない」原則に抵触する。ファクトリパターンの導入、またはInputTracker側で生成済みdraftオブジェクトをVectorModelへ渡す設計など、P1-3の企画検討（Step 0）時に解決方針を決めること（`updateDraft`は`setVertex`が既に存在するため、ドラフト生成方式が決まればごく小さな修正で追従可能）。

---

### 3. 保留・後回しにした事項（バックログ）
* `README.md` / `PROJECT_CONSTITUTION.md` の実態とのズレ（実装AIが「Google Antigravity」のまま、READMEのフォルダ構成が古い）：修正保留。キリのいいタイミングでまとめて対応予定。

---

### 4. Phaseクローズ記録
（Phaseがクローズされるたびに、棚卸し結果・仕分け結果をここに追記する。手順は`COWORK_HANDOFF.md`5章参照）

* まだクローズされたPhaseはなし。

---

### 5. 既知のインシデント履歴
* **2026-08-08**：REQファイル `_log/req/20260808_1227_REQ_Phase01-01_MVC_Architecture_Plan.md` が、ユーザーの「別名保存のつもりが上書き保存してしまった」という操作ミスにより、後発の別REQ内容（座標正規化要件の追記REQ）で上書きされる事故が発生。RES→REQ逆リンクの必要性を実証する形となった。ユーザーが元の内容を復元し、解決済み。再発防止として、以後はCoworkがREQファイルを直接作成する運用に変更。
