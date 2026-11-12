# COWORK_STATUS_CLOSED.md
## 解決済み・決定済み事項アーカイブ

---

### このファイルについて
* `COWORK_STATUS.md`に蓄積されるとコンテキスト肥大化・ハルシネーション誘発の原因になる「解決済み・決定済みの過去の懸念事項」を隔離して保管する専用ファイル。
* **記載は当時の事実であり、現在の仕様・コードの根拠にしない**（「9メソッド契約」「論理座標系」など古い用語・古い設計を含む）。現在の事実は`PROJECT_ARCHITECTURE.md`・`_doc/arch/`と実コードを正とする。
* Coworkは通常セッションで本ファイルを能動的に読みに行く必要はない。過去の実装経緯を遡って追跡したい場合、デバッグ時、または過去の設計判断の根拠を再確認したい場合にのみ参照する。
* 各項目には対応の一次情報源（REQ/RESファイルパス、タスク番号）を残す。詳細な経緯・議論の全文はそちらを正とし、本ファイルには要点のみ記録する。
* Phaseクローズのたびに、`COWORK_STATUS.md`側で「解決済み」に仕分けられた項目をここへ追記していく（追記型。既存の記載内容は変更しない）。

---

### 運用インシデント（Phase01-01期間中、発生日：2026-08-08）

* REQファイル `_log/req/closed/260808_1227_REQ_Phase01-01_MVC_Architecture_Plan.md` が、ユーザーの「別名保存のつもりが上書き保存してしまった」操作ミスにより、後発の別REQ（座標正規化要件の追記REQ）の内容で上書きされる事故が発生。ユーザーが元の内容を復元し解決済み。再発防止として、以後はCoworkがREQファイルを直接作成する運用に変更した。RES→REQ逆リンク（各RES冒頭の「参照元REQ」行）の必要性を実証する形となった。

---

### Phase01-02「LINEの作成・選択・再編集における入力・描画・座標基盤の確立」（クローズ日：2026-08-08）

* RES: `_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`
* 参照元REQ群:
  * `_log/req/260808_1831_REQ_Phase01-02_LineInteraction_Foundation.md`（本体）
  * `_log/req/260808_2011_REQ_Interrupt_Phase01-02_Task5.5_ShapeVertexPolymorphism.md`（Task5.5 Interrupt）
  * `_log/req/260808_2036_REQ_PlanningUpdate_Phase01-02_Task6.5_MainJsWiring.md`（Task6.5 PlanningUpdate）

| 項目                                                                                                | 結論                                                                                                                                | 対応箇所                   |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| toleranceの具体値                                                                                   | `hitTolerance = 5px`（線分本体・ハンドル共用）に決定                                                                                | タスク8                    |
| `updateVertex`/`moveShape`がLine固有プロパティ(x1,y1,x2,y2)に直接アクセスしていたアーキテクチャ違反 | `Line.setVertex`/`translate`を追加し、ポリモーフィックな委譲に置き換え                                                              | Task5.5 Interrupt          |
| `main.js`のrender呼び出しに状態(selectedId/hoveredId/draftLine)を渡す配線がタスク計画から漏れていた | タスク6.5として新設・実行し解消                                                                                                     | Task6.5 PlanningUpdate     |
| 旧`handleClick`（+50,+50固定ダミーLine生成）と新実装の重複リスナー懸念                              | タスク8で完全削除・新実装へ置換。タスク10・11で残存なしを再確認済み                                                                 | タスク8/10/11              |
| `DRAGGING_HANDLE`状態で`mouseup`未実装のため操作不能になる一時的制約                                | `handleMouseUp`実装により解消                                                                                                       | タスク10                   |
| ハンドル同士が近接した場合の当たり判定優先順位                                                      | `start→end→move`の順で先着1件を返す仕様で確定                                                                                       | タスク2                    |
| `selectShape`/`setHovered`のid実在チェック省略                                                      | 呼び出し元が実在idのみ渡す前提の設計として確定、実害なしと判断                                                                      | タスク3                    |
| `getDraftLine()`の追加要否                                                                          | `CanvasManager`の描画に必要な最小限のgetterとして正当と判断し追加                                                                   | タスク4                    |
| `#draftLine`がnullの時の各メソッドの早期return設計                                                  | 防御的実装として確定。タスク9実装後の実機確認でも問題なし                                                                           | タスク4/9                  |
| `DRAWING`分岐の判定順序（IDLEガードより手前に配置）                                                 | 拡張しやすいパターンとして確定、以後の`DRAGGING_HANDLE`分岐にも踏襲                                                                 | タスク9/10                 |
| `mouseup`時に`activeHandle`/`activeShapeId`/`lastCursor`をクリアしない設計                          | 次回`mousedown`で必ず上書きされるため実害なしと判断                                                                                 | タスク10                   |
| ファイル先頭JSDoc責務定義の同期                                                                     | `Line.js`を「データ保持・描画・当たり判定」の3責務に更新。以後のルールとして定着                                                    | タスク2                    |
| RES→REQ逆リンク（参照元REQ行）の欠落                                                                | 全RESテンプレート5種（ImpretonPlan/SurveyPlan/Interrupt/AddInterrupt/Survey）に`参照元REQ`行を追加。Phase01-02のRESにも遡及追記済み | テンプレート改修           |
| タスク5.5見出しの表記不一致（タスク5の見出しをコピーしたまま）                                      | ユーザーが直接修正                                                                                                                  | 軽微修正                   |
| `InputTracker.js`の`activeHandle`コメントの陳腐化（「タスク10で実装」が実装完了後も残存）           | ユーザーが直接修正                                                                                                                  | 軽微修正                   |
| ホバー強調とハンドル表示の同時表示（選択中図形にカーソルを重ねた時の見た目）                        | ユーザーが実機で目視確認し、現状の実装のまま問題ないと判断                                                                          | テストプレイ（2026-08-08） |
| ハンドル・ホバーの暫定デザイン（正方形8px・半透明青など）                                           | ユーザーが実機で目視確認し、現状のデザインのまま進めてよいと判断                                                                    | テストプレイ（2026-08-08） |
| 長さ0の線が生成されるケースの許容可否                                                               | ユーザーが実機で目視確認し、許容して問題ないと判断（`commitDraft()`へのガード追加は不要）                                           | テストプレイ（2026-08-08） |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* `startDraft`/`updateDraft`のLine固定インスタンス化・直接プロパティアクセス → P1-3着手時に設計判断
* `moveShape`のDPI/CSSズーム誤差、タッチ非対応、id採番方式とImport機能の衝突、無条件notifyChangeのパフォーマンス → いずれも将来Phase（ズーム/パン、タッチ対応、Import機能実装、パフォーマンス問題顕在化時）に先送り

---

### Phase01-03「キャンバス全体化、右側固定フロートUI、およびツールモード切り替えの基盤確立」（クローズ日：2026-08-09）

* DIR: `_log/dir/260808_2307_DIR_Phase01-03_CanvasFullscreen_And_FloatUI.md`
* RES: `_log/res/260808_2356_RES_Phase01-03_CanvasFullscreen_And_FloatUI.md`
* 参照元REQ群:
  * `_log/req/260808_2345_REQ_Phase01-03_CanvasFullscreen_And_FloatUI.md`（本体）
  * `_log/req/260809_0002_REQ_PlanningUpdate_Phase01-03_StartDraftSignatureFix.md`（PlanningUpdate）
  * `_log/req/260809_0015_REQ_PlanningUpdate_Phase01-03_ArchDocPreviewFix.md`（PlanningUpdate）

| 項目                                                                                                                 | 結論                                                                                           | 対応箇所                   |
| -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- |
| `startDraft(type = 'line', x, y)`のデフォルト引数順序が後方互換動作を実現しないJS仕様上の欠陥（チェック0で発見）     | `startDraft(x, y, type = 'line')`へ変更し、`type`を末尾・デフォルト値付きに修正して解消        | PlanningUpdate `260809_0002` |
| `keydown`リスナーの購読先未指定（`<canvas>`はフォーカス不可でキーボードイベントを受け取れない懸念、チェック0で発見） | `document`への購読と明記し解消                                                                 | PlanningUpdate `260809_0002` |
| 「開発資料の更新予定」欄に残った旧シグネチャ表記の修正漏れ（チェック0再監査で発見）                                  | 該当1箇所を修正                                                                                | PlanningUpdate `260809_0015` |
| Canvas全画面化・ウィンドウリサイズ追従・dprスケール累積の有無                                                        | ユーザーが実機で目視確認し、問題なしと判断                                                     | テストプレイ（2026-08-09） |
| コントロールパネルの`z-index`層順・ボタンのアクティブ状態CSS表示                                                     | 問題報告なし、正常動作と判断                                                                   | テストプレイ（2026-08-09） |
| コントロールパネル上のマウスイベント遮断（`stopPropagation`）                                                        | 問題報告なし、正常動作と判断                                                                   | テストプレイ（2026-08-09） |
| 図形削除機能（`select`ツール中の`Delete`/`Backspace`キー）                                                           | 実機で動作確認済み（削除ボタン等のUI不在による発見しにくさは別課題として次フェイズへ持ち越し） | テストプレイ（2026-08-09） |
| タスク1〜8内に累積した「中間状態」注記群（各タスク完了前後の一時的な未実装状態の説明）                               | 全8タスク完了により解消、記録不要と判断                                                        | タスク1〜8                 |
| `deleteShape(id)`の実装スタイル（`findIndex`+`splice`採用の理由）                                                    | 既存メソッドとの一貫性を優先した設計判断として記録のみ、対応不要                               | タスク5                    |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* パン機能の不在、ツール操作の直感性の低さ、削除UIの不在（キーボードのみで発見しにくい） → 「UI・操作充実フェイズ」で対応
* `line`ツール中のホバー視覚フィードバック欠如、コントロールパネルヘッダーのドラッグ移動非機能、`setTool`引数バリデーション欠如、`createToolClickHandler`の2ボタン限定実装、`keydown`の`document`購読と将来のテキスト入力UI追加時の誤爆対策 → 同上フェイズで検討
* 新規図形クラス追加時の`setVertex`/`translate`/`draw`インターフェース契約遵守、`ShapeFactory.create`の未知type時Error未キャッチ → 次の図形追加Phaseで対応
* resizeイベントのデバウンス未実装、resizeリスナーのクリーンアップ未実装、`mouseup`への`stopPropagation`未実装 → いずれも実害なしと確認済み、将来の設計変更・パフォーマンス問題顕在化時に検討
* タスク6の`handleMouseMove`/`handleMouseDown`のJSDoc説明文が`currentTool`ガード条件を反映していない軽微な記載漏れ → 次のInterruptでまとめて修正
* `main.js`のツールボタン配線を`palette/`へ切り出すか（チェック1で判明） → 次の図形パレット実装Phaseで再検討

---

### Phase01-04「フロートウィンドウシステムの構築と図形パレットの統合」（クローズ日：2026-08-09）

* DIR: `_log/dir/260809_1115_DIR_Phase01-04_FloatWindowManager_And_PaletteP.md`
* RES: `_log/res/260809_1212_RES_Phase01-04_FloatWindowManager_And_PaletteP.md`
* 参照元REQ群:
  * `_log/req/260809_1157_REQ_Phase01-04_FloatWindowManager_And_PaletteP.md`（本体）
  * `_log/req/260809_1242_REQ_PlanningUpdate_Phase01-04_PaletteExtraction.md`（PlanningUpdate：パレット配線のmain.jsからの切り出し）
  * `_log/req/260809_1633_REQ_Interrupt_Phase01-04_DragAndPaletteSyncFix.md`（Interrupt：テストプレイ発見の3件修正）

| 項目                                                                                                                                                   | 結論                                                                                                                                       | 対応箇所                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| フロートウィンドウのドラッグが機能しない（ウィンドウ自身の`stopPropagation`が`WindowManager`自身の`window`レベル追従リスナーを遮断していた）           | ドラッグ追従用の`window`の`mousemove`/`mouseup`リスナーをキャプチャフェーズ登録に変更し解消                                                | Interrupt `260809_1633`                |
| パレット5ボタン直接クリック時に`.active`表示が更新されない（`PaletteController`が`inputTracker`を直接呼び`applyTool`を経由しない設計だった）           | `PaletteController`をコールバック（`onToolSelected`）受け取り式に変更し、`main.js`が`applyTool`自体を渡すことで全7ボタンの表示更新を一元化 | Interrupt `260809_1633`                |
| Ctrl+A・ダブルクリックでウィンドウ内テキストが選択状態になる                                                                                           | `.float-window`に`user-select: none;`を追加                                                                                                | Interrupt `260809_1633`                |
| `main.js`にツールボタン配線を直書きする責務違反（Phase01-03から持ち越し）                                                                              | `js/palette/PaletteController.js`（`js/palette/`フォルダの最初の入居者）へ切り出して解消                                                   | PlanningUpdate `260809_1242` / タスク5 |
| 将来`applyTool`をパレットにも使い回すと干渉するのではという懸念（タスク6の申し送り）                                                                   | `PaletteController`がコールバックを受け取る設計への変更により、`applyTool`一本化で自然に解消                                               | Interrupt `260809_1633`                |
| top/right→left/top切替方式によるドラッグ開始時の位置ジャンプ有無                                                                                       | ドラッグ修正後、ユーザーが実機で確認し問題なしと判断                                                                                       | テストプレイ（2026-08-09）           |
| 複数`.float-window`間のz-index最前面化の排他制御                                                                                                       | ユーザーが実機で確認、問題なしと判断                                                                                                       | テストプレイ（2026-08-09）           |
| コントロールパネル／パレット内操作のCanvasへの透過（誤爆）有無                                                                                         | ユーザーが実機で確認、問題なしと判断                                                                                                       | テストプレイ（2026-08-09）           |
| 5大図形ボタン（line/curve/arc/rect/circle）での作図・スタブフォールバック動作                                                                          | ユーザーが実機で確認、いずれもLineとして正常描画、問題なしと判断                                                                           | テストプレイ（2026-08-09）           |
| 選択ツールでのホバー/選択/ハンドルドラッグ/Delete削除・リサイズ追従の回帰確認                                                                          | ユーザーが実機で確認、Phase01-01〜03の既存機能に影響なしと判断                                                                             | テストプレイ（2026-08-09）           |
| パレット初期配置座標（`top:320px`仮値）の重なり有無、ボタンラベル記号（`◠`等）のフォント崩れ有無、コントロールパネル/パレットの×ボタンの見た目バランス | テストプレイで問題報告なし、現状のままで問題なしと判断                                                                                     | テストプレイ（2026-08-09）           |
| `.disabled`の適用範囲（ルート要素全体、ヘッダーごと非活性化する設計判断）                                                                              | 実害なしと確認、設計判断として確定                                                                                                         | タスク3/テストプレイ                 |
| `tool`不一致時のパレット全ボタン非アクティブ表現（`.disabled`と`.active`を独立に評価する二重非活性化構造）                                             | 実害なしと確認、現状の実装のまま確定                                                                                                       | タスク5/テストプレイ                 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* コントロールパネルの操作モードボタン再設計（「直線ツール」の扱い。将来「キャンバス移動」等のモードも同列に追加予定のため、「図形作成」等への統合を検討） → 「UI・操作充実フェイズ」で対応（ユーザー指摘、2026-08-09）
* `WindowManager`の動的追加ウィンドウ再検知（`MutationObserver`等）非対応、単一`#draggingWindow`フィールドによる複数ウィンドウ同時ドラッグ非対応 → 将来ウィンドウを動的生成／複数同時操作するPhaseで対応
* `.disabled`クラスの意味（`opacity:0.4`+`pointer-events:none`）が将来増える他の`.float-window`種別すべてに適切か → ウィンドウ種類が増えた時点で再検討
* `PaletteController`のボタンid解決が見つからない場合に静かにフィルタされエラー化しない仕様 → 将来ボタンid命名規則を変更する際に注意
* 初期`.disabled`（`index.html`側）と`InputTracker`の初期`currentTool`（`'select'`）の暗黙的な結合 → 将来初期ツールを変更する際は両方を同期させること
* `ShapeFactory`の`curve`/`arc`/`rect`/`circle`フォールスルー`case`構造、将来矩形・円等でコンストラクタ引数の意味・個数が変わる場合の呼び出し元見直し → 次の図形追加Phaseで対応（既存の同種項目へ統合）

---

### Phase01-05「ベジエ曲線（Curve.js）の完全実装と幾何ポリモーフィズムの確立」（クローズ日：2026-08-09）

* DIR: `_log/dir/260809_1727_DIR_Phase01-05_BezierCurve_Implementation.md`
* RES: `_log/res/260809_1745_RES_Phase01-05_BezierCurve_Implementation.md`
* 参照元REQ群:
  * `_log/req/260809_1735_REQ_Phase01-05_BezierCurve_Implementation.md`（本体）
  * `_log/req/260809_1830_REQ_Interrupt_Phase01-05_DraftTypeHardcoded.md`（Interrupt：作図時の図形type固定バグ修正）
  * `_log/req/260809_1842_REQ_Interrupt_Phase01-05_MultiVertexShapeContract.md`（Interrupt：`vertexIndex`意味不一致の解消）

| 項目                                                                                                   | 結論                                                                                                                                                                                                                                                                                                                                                         | 対応箇所                |
| ------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------- |
| 2次ベジェ（制御点1つ）限定か3次まで対応するか                                                          | データ構造の簡素化・処理の軽量化のため2次限定に決定。3次ベジェは対象外                                                                                                                                                                                                                                                                                       | DIR/Step0企画検討       |
| `Curve`に移動（move）ハンドルを持たせるか                                                              | 本Phaseでは持たせず、始点・制御点・終点の個別ドラッグのみに限定。制御点の追加削除・moveハンドル追加は発注者の意向により別Phaseで対応予定                                                                                                                                                                                                                     | DIR6章/Step0企画検討    |
| ひし形（制御点）ハンドルの当たり判定方式                                                               | 正方形ハンドルと同様の円形近似（`Math.hypot`によるハンドル中心からの距離判定）で確定。実機確認で操作感に問題なし                                                                                                                                                                                                                                             | タスク3/テストプレイ    |
| 点線ヘルパーの配色・太さ                                                                               | `rgba(0, 0, 0, 0.4)`・`lineWidth 1`で確定。実機確認で視認性に問題なし                                                                                                                                                                                                                                                                                        | タスク2/テストプレイ    |
| `Curve`コンストラクタの`strokeColor`/`strokeWidth`引数が`ShapeFactory`経由では常にデフォルト値になる件 | 現行`Line`と同一挙動であり本Phaseでは問題なしと判断。将来カラーピッカー機能実装時に`ShapeFactory.create`のシグネチャ拡張が必要になる点のみ申し送り                                                                                                                                                                                                           | 実装時の設計注記        |
| パレットで「曲線」を選んで作図しても直線が生成される不具合                                             | `InputTracker.handleClick`が新規図形のtypeを`'line'`固定の文字列リテラルで渡していたバグ（Phase01-02由来、Phase01-04のパレット追加時も見過ごされていた）。`this.currentTool`を参照する実装に修正して解消                                                                                                                                                     | Interrupt `260809_1830`   |
| 作図プレビューがマウスまでの半分の距離までしか伸びず、確定後も始点・終点が同一座標になる不具合         | `VectorModel.updateDraft`が`setVertex(1, x, y)`という`Line`前提（`vertexIndex=1`＝終点）の呼び出しをハードコードしており、`Curve`では同じ`1`が制御点を指すため終点が更新されていなかったのが原因。`Line`/`Curve`双方に`updateDraftEnd(x, y)`を新設し、`VectorModel`はこれへポリモーフィックに委譲する設計に変更して解消                                      | Interrupt `260809_1842`   |
| 終点ハンドルをドラッグすると制御点が動いてしまう潜在バグ（実機発見前だが同根のため合わせて修正）       | `InputTracker`のハンドルドラッグ処理が`activeHandle === 'start' ? 0 : 1`という2値決め打ちの三項演算子で`vertexIndex`を算出しており、`Curve`の`'end'`（本来index2）を`'control'`と同じindex1に誤って丸めていたのが原因。`Line`/`Curve`双方に`getVertexIndexForHandle(handleName)`を新設し、`InputTracker`はこれへポリモーフィックに委譲する設計に変更して解消 | Interrupt `260809_1842`   |
| タスク1〜4内に累積した「中間状態」注記群（`hitTest`等未実装によるTypeError警告等）                     | 全タスク・全Interruptの完了により解消、記録不要と判断                                                                                                                                                                                                                                                                                                        | タスク1〜4/Interrupt2件 |
| `PROJECT_ARCHITECTURE.md`記載と実コードの整合性（RESが一次情報として記述したことへの注記）             | Coworkによる各タスク・Interruptのgit diff監査で都度整合を確認済み、問題なし                                                                                                                                                                                                                                                                                  | 各RES監査               |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* `draw(ctx, t=0)`の`t`引数（将来のモーフィング機能用の伏線） → 将来のモーフィング機能実装Phaseで対応
* `hitTest`の100分割ループの計算コスト → 頂点数が数千を超える規模になった際のパフォーマンスPhaseで、AABBによる早期判定フィルタリング等を検討（既存の同種項目へ統合）
* `ShapeFactory`の`arc`/`rect`/`circle`は引き続き`Line`スタブ。専用クラス実装時は、今回`Curve`で確立した9メソッド契約（`hitTest`/`hitTestHandle`/`draw`/`drawHandles`/`drawHover`/`setVertex`/`translate`/`updateDraftEnd`/`getVertexIndexForHandle`）、特に`updateDraftEnd`・`getVertexIndexForHandle`の自己申告を必ず倣うこと（詳細はインシデント履歴の`vertexIndex`不一致バグを参照）
* 制御点の追加・削除、moveハンドルの追加 → 発注者の意向により別Phaseで対応予定

---

### Phase01-06「矩形（Rect.js）の実装および図形パレット・ツール切替のハードコード排除」（クローズ日：2026-08-09）

* DIR: `_log/dir/260809_1915_DIR_Phase01-06_Rect_And_PaletteRefinement.md`
* RES: `_log/res/260809_1925_RES_Phase01-06_Rect_And_PaletteRefinement.md`
* 参照元REQ: `_log/req/260809_1918_REQ_Phase01-06_Rect_And_PaletteRefinement.md`（本体、Interruptなし）

| 項目                                                                                                                                                              | 結論                                                                                                                                                       | 対応箇所                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| DIR2章（「main.js/PaletteController.js双方の汎用化」）とDIR4章（改修対象は`main.js`のみ）の記載齟齬                                                               | `main.js`＝コントロールパネル領域、`PaletteController`＝パレット領域という領域分担で二重管理を回避する設計として、チェック0でユーザー承認のうえ確定        | チェック0/タスク4                     |
| タスク2（Rect.js本実装、9メソッド分）の粒度がCurve.js実装時の前例より大きい                                                                                       | チェック2で判明し、描画・プレビュー追従系（タスク2）と当たり判定・頂点操作・ホバー系（タスク3）の2タスクへ分割する差し戻しを実施。再監査でPASS             | チェック2/RES差し戻し                 |
| `Rect`コンストラクタの非正規化方針（`x1>x2`等で`topLeft`命名と実データが食い違いうる）                                                                            | DIRのNon-goals（矩形維持ロジック非搭載）と`updateDraftEnd`側の非正規化ロジックとの一貫性を優先し、正規化を行わない設計として確定                           | 要件1/タスク1                         |
| `hitTest`の内部ヘルパー（`#distanceToSegment`）切り出し、`Line.js`とのロジック重複                                                                                | Rect内部専用の実装詳細として9メソッド契約外に位置づけ、`Line.js`非変更方針（スコープ外）を維持したまま確定                                                 | タスク3                               |
| Claude Browser paneのローカル`file://`ページ制約（`<canvas>`の`clientWidth`/`clientHeight`が`0`のまま）により、実装AI自身は画面上のマウス操作テストができなかった | 動的import＋メソッド直接呼び出しによる構造的検証で代替。最終的にユーザー自身のテストプレイ（選択・ハンドルドラッグ・ボタン同期いずれもOK）で解消・確認済み | タスク1〜5/テストプレイ（2026-08-09） |
| RESヘッダーの「参照元DIR」バックリンク行の欠落                                                                                                                    | ユーザーが意図的に削除。DIRはRES段階で実装形態が変わりうるため、残すと実装AIが読んでハルシネーションを招くとの判断（参照元REQは残しているため実害なし）    | ユーザー判断（2026-08-09）            |
| `main.js`の`toolButtons`汎用トグル化の達成度                                                                                                                      | `Object.entries`ベースの汎用ループへの置換で、個別ボタンのハードコード分岐を完全撤去。開閉原則が成立し実機確認済み                                         | タスク4/テストプレイ                  |
| `PROJECT_ARCHITECTURE.md`の`main.js`項目要否                                                                                                                      | 「4. 各モジュールの責務リファレンス」に`main.js`専用項目が存在しなかったため、新規追加する判断で確定（今後`main.js`に責務が増えた際の追記の前例とする）    | タスク5                               |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* `hitTestHandle`の優先順位問題（矩形を極端に小さく変形させた場合、複数頂点が近接すると`topLeft`側が常に優先される） → 「UI・操作充実フェイズ」で最小サイズ制約等を検討する際に対応
* `toolButtons`への将来ツールボタン追加時の注意点（対応DOM要素を`index.html`側に先に用意しないと`TypeError`になる） → 同フェイズでpan/zoom等の新規モード追加時に対応
* `ShapeFactory.js`の`arc`/`circle`残存フォールバック文言、将来どちらか一方だけ先に専用クラス化された場合の言及順序修正 → 次の図形追加Phaseで対応（既存の同種項目へ統合）

---

### Phase01-07「楕円弧（Ellipse.js）の一元化設計と段階的実装」（クローズ日：2026-08-12）

* DIR: `_log/dir/260809_2247_DIR_Phase01-07_Ellipse_Implementation-v2.md`（v1は`260809_2111`、DIR指摘を反映したv2で正式発注）
* RES: `_log/res/260809_2344_RES_Phase01-07_Ellipse_Implementation.md`
* 参照元REQ群:
  * `_log/req/260809_2250_REQ_Phase01-07_Ellipse_Implementation.md`（本体、8タスク）
  * `_log/req/260811_2246_REQ_PlanningUpdate_Phase01-07_EllipseTypePropertyFix.md`（PlanningUpdate：チェック0で発見した2件の事実誤認の訂正）
  * `_log/req/260811_2301_REQ_PlanningUpdate_Phase01-07_SharedRecalcHelperNote.md`（PlanningUpdate：チェック2で指摘した計算重複の共通ヘルパー化）

| 項目                                                                                                       | 結論                                                                                                                                                                                                                             | 対応箇所                    |
| ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| circle/arc/ellipseを別クラスにするか単一クラスに統合するか                                                | DIR方針どおり`Ellipse`単一クラスに統合し、コンストラクタの`shapeType`引数（`'circle'`/`'arc'`）で挙動を分岐する設計で確定                                                                                                        | DIR/要件1                   |
| 5頂点構造（中心・右制御点・上制御点・開始角ダミー・終了角ダミー）の採用理由                                | 9メソッド契約を`Line`/`Curve`/`Rect`と完全に揃えたまま`rx`/`ry`/`startAngle`/`endAngle`を頂点ドラッグだけで再現するための設計として確定                                                                                         | DIR/要件2                   |
| `this.type`をEllipse固有プロパティとして新設した記述をRESが「既存の共通データ構造上の標準プロパティ」と誤記していた件 | 実コード上`this.type`は他図形に一切存在しないEllipse固有プロパティであると訂正                                                                                                                                                  | PlanningUpdate `260811_2246` |
| 共通プロパティの命名例をRESが`color`/`isFilled`と誤記していた件（実際は`strokeColor`のみ、`isFilled`は非存在かつDIRのNon-goalsと矛盾） | `strokeColor`/`strokeWidth`のみを共通プロパティとし、`isFilled`の記述を削除する訂正で確定                                                                                                                                        | PlanningUpdate `260811_2246` |
| `setVertex`と`updateDraftEnd`間の`rx`/`ry`再計算ロジックの重複リスク（チェック2で指摘）                    | Phase01-05の`vertexIndex`不一致インシデントと同根の分岐再発防止として、private共通ヘルパー`#updatePointsFromRadii`へ抽出する設計に変更して確定                                                                                 | PlanningUpdate `260811_2301` / タスク4 |
| `rx`/`ry`が0に近い縮退状態での0除算対策                                                                    | `hitTest`冒頭で`rx<1｜｜ry<1`の場合に`false`を早期returnするガードとして実装、確定                                                                                                                                              | タスク5                     |
| circle/arcの視覚的区別方法                                                                                 | `ctx.ellipse`の`startAngle`/`endAngle`を切り替えたうえで、circleのみ`closePath()`を呼ぶ設計で確定                                                                                                                              | タスク2                     |
| Task3完了時点のハンドル視覚仕様（色・サイズ・線幅）が既存図形（8px正方形・`#4a90e2`・線幅1.5）と不一致だったバグ | Task3のREQに参考資料（`Line.js`/`Curve.js`/`Rect.js`）の閲覧許可が漏れていたことが原因と判明。Interrupt_Additionalで既存図形と同一の値へ修正して解消                                                                            | Interrupt_Additional（チャット直接指示） |
| 同バグに付随する`hitTestHandle`の当たり判定方式（矩形領域判定）が既存図形（`Math.hypot`によるユークリッド距離判定）と不一致だった件 | 同Interrupt_Additionalで`Math.hypot`方式へ統一して解消                                                                                                                                                                          | Interrupt_Additional（チャット直接指示） |
| `ShapeFactory`への`circle`/`arc`ケース接続（旧`Line`スタブからの置き換え）                                 | `Ellipse`をimportし、`shapeType`引数に`'circle'`/`'arc'`をそれぞれ渡す形で接続完了、動作確認済み                                                                                                                               | タスク6                     |
| 縮退状態（`rx`または`ry`≒0）のEllipseが選択不可能になる制約                                                | ユーザーが実機テストプレイで確認。0除算ガードの意図した挙動であり、現時点では計算上やむを得ないと判断。将来的にはマーキー選択や図形リスト（レイヤー）ウィンドウからの直接選択で解消予定と申し送り                              | テストプレイ（2026-08-11）  |
| `Line`/`Curve`/`Rect`に続き最も複雑な頂点構造（5頂点・2バリアント）でも9メソッド契約のみで`core/`層無改修のまま統合できるか | 実証済み。これにより当初想定していた5大図形実装が完了したため、「次の図形追加Phase」区分の主目的はPhase01-07クローズをもって完了と判断                                                                                          | タスク1〜8全体               |
| `PROJECT_ARCHITECTURE.md`のTask8更新内容の正確性                                                           | `shapes/`セクションに`Ellipse.js`を`Line`/`Curve`/`Rect`と同粒度で追記、`ShapeFactory.js`項目の記述も接続完了を反映した内容に更新されていることをCoworkが直接確認済み                                                          | タスク8                     |
| RES内「## 5. 懸念事項・要確認ポイント」見出しの重複（Task3完了後の位置と末尾の2箇所に存在）                | タスク間の追記位置の取り違えが原因と判明。孤立していた1つ目の見出しとその配下7項目（末尾の見出し配下12項目のサブセット）をCoworkが直接`Edit`で削除し、内容欠落なく単一化して解消                                              | Cowork直接修正（棚卸り前段階） |
| `COWORK_STATUS.md`/`COWORK_STATUS_CLOSED.md`両ファイルに生じていたファイル名参照破損（タイムスタンプ桁数の欠落、約32箇所） | 実在ファイル一覧との照合により発見。パターン別（一般欠落・特殊欠落2件）に分けてCoworkが直接修正し、全参照がゼロ欠損であることを再検証済み                                                                                      | Cowork直接修正（棚卸し中）    |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* 縮退状態のEllipseに対する選択手段（マーキー選択、図形リスト／レイヤーウィンドウからの直接選択） → 「UI・操作充実フェイズ」で対応
* `hitTest`の楕円境界判定が厳密な楕円上距離ではなく比率近似（`allowedDiff`）である点の精度 → 実害が顕在化した場合に将来検討

---

### Phase02-01「操作モード再設計」（クローズ日：2026-10-06）
* DIR: `_log/dir/261006_2239_DIR_Phase02-00_UI_And_Operation_Enhancement.md`（Phase 02-01節）
* REQ: `_log/req/261006_2244_REQ_Phase02-01_OperationMode_Redesign.md`
* RES: `_log/res/261006_2247_RES_Phase02-01_OperationMode_Redesign.md`（全6タスク、PlanningUpdate・Interruptなし）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 「直線ツール」とパレット「直線」が同じ`tool='line'`を指し同時ハイライトされる問題（操作モードと図形種別の混在） | `InputTracker`の状態を`currentMode`（`OperationMode`：`'select'`/`'create'`）と`currentShapeType`に分離。コントロールパネルは「選択」「図形作成」の操作モード専用、パレットは図形種別専用として解消 | タスク1〜4 |
| 図形作成モードへ戻った際の図形種別 | `currentShapeType`をモード切替でリセットしない設計で「前回使った図形」に復帰（初回は直線）。発注者決定 | REQ要件1 / タスク1 |
| 選択モード中（パレット非活性）のパレット内ハイライト | 記憶中の図形種別をハイライトしたままとする（RES設計どおり）。発注者決定 | RES監査時（2026-10-06） |
| `setTool`の引数バリデーション欠如・`createToolClickHandler`の2ボタン限定 | `setMode`/`setShapeType`に未知値の`console.warn`＋無視を導入。`main.js`は`modeButtons`走査ループ＋`getMode()`読み返しで表示同期し、モード追加は`index.html`・`OperationMode`・`modeButtons`への追加のみで対応可能 | タスク1・4 |
| パンモード追加時にクリックで図形が作成される事故の予防 | `handleClick`の作成開始を`currentMode === OperationMode.CREATE`の明示ガードに変更 | タスク1 |
| `line`ツール中のホバー視覚フィードバック欠如 | カーソル形状を導入（作成モード`crosshair`／選択モードでハンドル上・ドラッグ中`move`／図形上`pointer`／その他`default`）。担当は`InputTracker`（`#resolveCursor`/`#updateCursor`）、判定は`hitTestHandle`とホバー状態のポリモーフィック利用のみ | タスク1 |
| `PaletteController.setActiveTool`のモード知識混入 | `setEnabled(enabled)`／`setActiveType(type)`に分割し、パレットは操作モードを知らない構造に。活性判断は`main.js`の責務 | タスク2・4 |
| コントロールパネルのヘッダードラッグ非機能（Phase01-03由来の持ち越し） | 実際はInterrupt `260809_1633`で解消済みの古い記載だった。今回は回帰防止のみとし、テストプレイでドラッグ可能を確認 | テストプレイ（2026-10-06） |
| `currentTool`ガード条件のJSDoc記載漏れ・`'select'|'line'`型注釈 | 新API・新フィールドのJSDocとして実態どおりに更新、旧名称の残存0件を確認。クラスJSDoc（`InputTracker`/`PaletteController`）と`modeButtons`の`@type`も補完 | タスク1・5 |
| `toolButtons`へのボタン追加時はDOM側を先に用意する注意点 | `modeButtons`に引き継ぎ、開発資料4章の`main.js`記述に明記 | タスク6 |
| `PROJECT_ARCHITECTURE.md`の反映 | 4章`main.js`/`InputTracker.js`/`PaletteController.js`の3項目を更新、旧名称の残存0件。CoworkがRES更新予定欄との一致を確認 | タスク6 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* 選択モード中は図形パレットのヘッダーもドラッグできない（`.disabled`の`pointer-events: none`） → Phase 02-02で判断
* 図形種別一覧の二重管理（`ShapeFactory`/`SHAPE_TYPES`）、古いJSDoc・「ツール状態」表記の残存、カーソル再評価タイミング → Interrupt候補

---

### Phase02-02「ビュー変換（パン・ズーム・グリッド）」（クローズ日：2026-10-18）
* DIR: `_log/dir/261006_2239_DIR_Phase02-00_UI_And_Operation_Enhancement.md`（Phase 02-02節）
* REQ: `_log/req/261008_2031_REQ_Phase02-02_View_Transform.md`
* RES: `_log/res/261008_2150_RES_Phase02-02_View_Transform.md`（全10タスク、PlanningUpdate・Interruptなし。タスク4・9にCoworkの追加注意事項あり）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| パン機能が未実装（Phase01由来、2026-08-09ユーザー指摘） | 中ボタンドラッグ・スペース＋左ドラッグ・「✋ キャンバス移動」モード（`OperationMode.PAN`）の3経路でパン。パン状態は`InputState`と直交するフラグで持ち、作成途中（`DRAWING`）を保持したままパン可能。終了検知は`window`のcapture購読、左ボタンのパン後の`click`は1回抑止 | REQ要件2 / タスク6・7・8 |
| ワールド座標とスクリーン座標の分離 | `core/ViewTransform.js`を新設し、倍率・オフセットと変換式を一元化。`InputTracker`は`getScreenCoordinate`/`getWorldCoordinate`に分離、`CanvasManager`は`render()`の引数で受け取った`view`とdprを毎フレーム合成 | REQ要件1・7 / タスク1・2・4・5 |
| ズーム・倍率表示・リセット | ホイールでカーソル中心ズーム（約1.1倍刻み、10%〜1000%）。コントロールパネルに倍率表示とリセット。発注者決定（範囲・連続ズーム） | REQ要件3・4 / タスク5・7・8 |
| 背景グリッド | ワールド座標上の細線10/太線100、画面上8px未満で10倍ずつ間引き、線幅は画面上1px一定。発注者決定（自動調整） | REQ要件5 / タスク2 |
| ズーム時のハンドル・当たり判定 | 画面上一定（発注者決定）。当たり判定は`InputTracker`でワールド換算、描画は`drawHandles`/`drawHover`に`viewScale`引数（既定1）を追加し9メソッド契約を更新 | REQ要件6 / タスク3・5 |
| `moveShape`の差分計算のDPI・CSSズーム環境下での誤差（Phase01由来） | 差分をワールド座標で計算。ブラウザズーム125〜150%を含むテストプレイでずれなしを発注者が確認（2026-10-18） | REQ要件8 / タスク5 |
| 起動直後の初回描画が`clearSelection()`の無条件通知の副作用に依存 | 起動時初期化の末尾に`renderCurrentState()`・`syncZoomDisplay()`の明示呼び出しを追加（Cowork監査で発見） | タスク4・8（追加注意事項） |
| `PROJECT_ARCHITECTURE.md`の反映 | 1〜4章を更新（`ViewTransform`新設、座標系とビュー変換の節、各モジュール責務、9メソッド契約）。旧記述の残存0件 | タスク10 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* ハンドルドラッグの終了検知漏れ・マウスボタン種別未判定、ハンドルドラッグ直後の選択解除（要調査） → Interrupt候補
* 用語「論理座標系」の残存、開発資料3章・`WindowManager`項目の既存記述のズレ → Interrupt／資料監査
* `InputTracker`の肥大化 → Phase 02-03でドラッグ操作の分離を検討（DIRメモに記載）

---

### Phase02-03「範囲選択・複数選択」（クローズ日：2026-10-31）
* DIR: `_log/dir/261006_2239_DIR_Phase02-00_UI_And_Operation_Enhancement.md`（Phase 02-03節）
* REQ: `_log/req/261018_0212_REQ_Phase02-03_Marquee_Multi_Select.md`
* RES: `_log/res/261018_0222_RES_Phase02-03_Marquee_Multi_Select.md`（全12タスク、PlanningUpdate・Interruptなし。タスク6にCoworkの追加注意事項あり）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 選択状態の複数化 | `VectorModel`の`#selectedId`を選択集合`#selectedIds`（`Set`）へ。`setSelection(ids)`/`clearSelection()`/`getSelectedIds()`/`isSelected(id)`、一括`moveShapes`/`deleteShapes`（通知1回）、選択矩形API。旧単一選択API（`selectShape`/`getSelectedId`/`moveShape`/`deleteShape`）は互換ラッパー経由で段階移行し削除 | REQ要件1 / タスク3・7・10 |
| 範囲選択（マーキー選択） | 空白から左ドラッグ（スクリーン3px閾値）。判定は「輪郭線の中心線が一部でも掛かれば選択」（発注者決定）、塗り内部は対象外。各図形クラスに第10共通メソッド`intersectsRect`（Line/Rectは厳密、Curve/Ellipseは100分割の折れ線近似）を追加。矩形の正規化は確定処理1箇所のみ | REQ要件2 / タスク1・2・9 |
| 縮退した楕円が選択不可（Phase01-07由来、2026-08-12ユーザー指摘） | 範囲選択で選択・削除可能に（`intersectsRect`は0除算なし）。クリック選択不可の`hitTest`ガードは維持 | REQ要件2 / タスク2・9 |
| 複数選択中の表示・操作 | 全図形のハンドルを表示（発注者決定）。ハンドル描画は全図形描画後の2パス、当たり判定は前面優先。頂点ハンドルは1図形のみ変形、moveハンドル・本体ドラッグは選択集合の全図形を移動。単一選択でも本体ドラッグ可（発注者決定） | REQ要件3・4 / タスク4・7・8 |
| ハンドルドラッグの終了検知漏れ・ボタン種別未判定（Phase02-02由来） | `core/DragTracker.js`を新設し、パン・左ドラッグのライフサイクル（開始ボタン・閾値・`window`のcapture購読による追従/終了・`buttons`による取りこぼし検知・blur中断・click抑止）を一元化。キャンバスの`mouseup`購読を廃止 | REQ要件5・8 / タスク5・6 |
| ハンドルドラッグ直後に選択が外れる（Phase02-02由来・要調査） | 原因はクリック時に古いホバー状態を参照していたこと（輪郭外のハンドルではホバーが`null`）。当たり分類`#classifyPoint`をホバー・押下・クリック・カーソルで共用し、クリックをその場の座標で判定するよう変更。ドラッグ後のclickは抑止 | REQ要件5 / タスク6・7 |
| 「空白部分」の判定にホバー状態を流用（Phase01由来、タッチ非対応の懸念） | 上記の`#classifyPoint`によりクリック時に直接判定するため解消 | タスク7 |
| `InputTracker`の肥大化（Phase02-02由来、DIRメモ） | ドラッグのライフサイクルのみを`DragTracker`へ分離（計画AI判断）。意味の解釈・当たり分類・カーソルは`InputTracker`に残し、セクション区切りで整理。行数は約960行で、再分離候補は`COWORK_STATUS.md`で追跡 | REQ要件8 / タスク5・10 |
| `VectorModel.js`・`InputTracker.js`の古い用語（「論理座標系」「作成中Line」「start/end/move」等） | 両ファイル分は修正済み（図形クラス分は持ち越し） | タスク3・6・11 |
| `PROJECT_ARCHITECTURE.md`の反映 | 1〜4章を更新（`DragTracker`新設、選択集合・選択矩形、ドラッグのライフサイクル・範囲選択の流れ、各モジュール責務、10メソッド契約）。`Line.js`項の頂点表記の誤り（`points[0]`/`[1]`）はCowork監査で発見し発注者が修正 | タスク12 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* ハンドルの2パス描画による見え方（発注者判断で後回し）、輪郭付近からの範囲選択開始・ハンドル付近の別図形選択の操作感 → 作業での使用感次第
* 図形クラスの「論理座標系」、`draftLine`命名、`WindowManager`の「ツール状態」表記、開発資料の既存記述のズレ → Interrupt／資料監査
* `#segmentIntersectsRect`の4重複、弧の角度可変化時の注意、`InputTracker`の再分離候補、`buttons`の環境依存 → 該当箇所の変更時に対応

---

### Phase02-04「削除UI・キーボードショートカット」（クローズ日：2026-11-01）
* DIR: `_log/dir/261006_2239_DIR_Phase02-00_UI_And_Operation_Enhancement.md`（Phase 02-04節）
* REQ: `_log/req/261031_0331_REQ_Phase02-04_Delete_UI_And_Shortcuts.md`
* RES: `_log/res/261031_2121_RES_Phase02-04_Delete_UI_And_Shortcuts.md`（全8タスク、PlanningUpdate・Interruptなし。タスク5に追加仕様あり）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 図形削除UIがなく発見しにくい（Phase01由来） | コントロールパネルに削除ボタン`#selection-delete`を追加。選択集合が空なら`disabled`（`main.js`の`syncDeleteButtonState()`を`model.onChange`へ登録＋起動時に明示呼び出し）。押せない状態は`.tool-btn:disabled`で表し、フロートウィンドウ用の`.disabled`とは使い分け | REQ要件1 / タスク3・4 |
| 削除経路の一本化 | `InputTracker.deleteSelection()`（受理条件：選択モード・`IDLE`・ドラッグ中でない・選択集合が空でない）を削除ボタンと`Delete`/`Backspace`の唯一の経路とした。パン中の削除は受け付けない形に厳格化 | REQ要件1 / タスク2・6 |
| キーボードショートカット | `V`/`P`/`H`（モード）、`1`〜`5`・テンキー（図形種別、他モードからは図形作成モードへ切替）、`Ctrl`/`⌘`+`0`（リセット）・`=`/`;`/テンキー`+`（拡大）・`-`/テンキー`-`（縮小）、`Esc`（作成途中の破棄／選択解除）、`Ctrl`+`A`（全選択、他モードからは選択モードへ切替）、`Delete`/`Backspace`。`event.code`で識別し、Shift併用は拡大・縮小のみ、キーリピートも拡大・縮小のみ実行。UI同期は`applyMode`/`applyShapeType`/`onChange`の既存経路のみ | REQ要件2 / タスク5・6 |
| ショートカットの責務配置・`InputTracker`の`keydown` | `core/KeyboardShortcuts.js`を新設し、対応表`SHORTCUT_BINDINGS`と受理判定のみを担当（操作の実体は`main.js`から注入）。`InputTracker`の`keydown`はスペースパンのみに縮退し、同一キーの二重解釈をなくした。`preventDefault()`は受理したキーのみ（例外：`Ctrl`系エントリがドラッグ中・リピートで実行されなかった場合。タスク5の追加仕様） | REQ要件3 / タスク5・6 |
| テキスト入力中の`Delete`/`Backspace`等の誤爆（Phase01由来） | ショートカット・スペースパンとも`isTextInputElement`で除外。`input`は`type`別判定（`TEXT_INPUT_TYPES`）に変更。IME変換中も除外。確認用の入力欄は置かない（発注者決定） | REQ要件4 / タスク1・5 |
| `PROJECT_ARCHITECTURE.md`の反映 | 1章（`KeyboardShortcuts.js`）、3章（キーボード操作の小項目）、4章（`index.html`項の新設、`main.js`・`InputTracker.js`の更新、`KeyboardShortcuts.js`項の新設）を更新 | タスク8 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* 実機での目視確認（ブラウザズーム・ページ全選択の抑止、IME、macOS、削除ボタン押下後のフォーカス） → テストプレイ
* `title`属性と対応表の手動同期、`SHAPE_TYPES`の並び順への依存、テキスト入力UI追加時の確認項目、コントロールパネルの余白 → 該当箇所の変更時に対応
* `KeyboardShortcuts`の無効化API、`InputTracker`・`main.js`の肥大化防止、キーボードズームの中心・`WHEEL_ZOOM_STEP`の名称 → 必要になった時点で対応

---

---

### Phase 2「UI・操作充実」フェイズ大番号クローズ（クローズ日：2026-11-01）
* `COWORK_STATUS.md` 2章の未解決事項を、A（Phase 3候補）／B（テストプレイ待ち）／C（条件付き将来）の3区分に再整理。旧区分「A. 次の『UI・操作充実フェイズ』へ持ち越し」「B. さらに将来のPhaseへ先送り」と、Phase02-00時点の割り当てメモ（2026-10-06）は廃止。
* 【解決】`PROJECT_ARCHITECTURE.md`の既存記述のズレ（Phase02-02由来）：2章ShapeData共通プロパティ（`type`/`color`/`isFilled`/`points`は実在せず、実際の共通プロパティは`id`/`strokeColor`/`strokeWidth`、`Line`は`x1/y1/x2/y2`）、3章1.起動処理の列挙漏れ（`ViewTransform`/`WindowManager`/`PaletteController`/`KeyboardShortcuts`）、3章2.の`requestAnimationFrame`描画ループ記述（実装はイベント駆動の同期再描画）、4章`WindowManager`の「ツール状態」表記、4章の記載形式の混在（`main.js`・`InputTracker`をサブ項目形式に統一）を、`PROJECT_PHASE_TRANSITION_CLEANUP.md`の資料監査で修正。
* `_log/req`・`_log/res`・`_log/dir`のPhase 2関連ファイル（REQ 4件・RES 4件・DIR 1件）を`closed/`へ`git mv`でアーカイブ。

---

### Phase03-01「シリアライズ契約」（クローズ日：2026-11-03）
* DIR: `_log/dir/261101_2154_DIR_Phase03-00_Editing_Foundation.md`（Phase 03-01節）
* REQ: `_log/req/261101_2257_REQ_Phase03-01_Serialization_Contract.md`
* RES: `_log/res/261102_0003_RES_Phase03-01_Serialization_Contract.md`（全11タスク、PlanningUpdate・Interruptなし。タスク8に追加仕様あり）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 図形種別（`type`）の持たせ方 | 全図形クラスに`type`プロパティを持たせ、値は`ShapeFactory`の受理文字列と一致（`Ellipse`は既存の`'circle'`/`'arc'`を維持）。発注者決定 | REQ要件1 / タスク1・2 |
| `Line`の頂点保持形式 | 内部は`x1/y1/x2/y2`のまま、図形データ（JSON）のみ`points`2点に揃えた。内部の`points`化はパスPhaseで検討。発注者決定 | REQ要件1・2 / タスク1 |
| 図形種別一覧の多重管理（Phase02-01由来・DIR持ち越し） | `ShapeFactory.js`の対応表`SHAPE_REGISTRY`を正本とし`SHAPE_TYPES`を導出・export。`InputTracker`は再export（`KeyboardShortcuts`は無変更）、`PaletteController`は種別一覧を引数で受け取りid規則`palette-${type}`で照合し、不整合を`console.warn`。`index.html`のボタンは静的記述のまま | REQ要件1 / タスク3・4 |
| `ShapeFactory.create()`の例外を呼び出し元が捕捉しない件（Phase01由来・DIR持ち越し） | `create()`の仕様は変えず（プログラムの誤りとして例外のまま）。種別一覧の一本化で受理種別と対応表の食い違いが構造上起きなくなったため解消とした。JSONからの復元は例外を結果オブジェクトへ変換 | REQ要件2・4 / タスク3・5 |
| 図形のシリアライズ契約 | 共通メソッド契約を10→12メソッドに拡張（`toJSON()`・`static fromJSON(data)`）。図形データは`{type, id, points, strokeColor, strokeWidth}`。`Ellipse`の角度は保存しない。`id`は`fromJSON`で検証しない。`strokeWidth`の0以下は不正 | REQ要件2 / タスク1・2 |
| 版番号とマイグレーションの置き場所 | `io/DocumentSerializer.js`を新設。最上位は`{format: "oz-vector-editor", version: 1, shapes}`。マイグレーション表（版n→n+1、引数を書き換えない）と版の追加手順を同ファイルに置く。保存対象は図形データのみ（選択・ホバー・ビュー変換は含めない） | REQ要件3 / タスク5 |
| 未知の図形種別の伝え方 | デシリアライズは例外を出さず結果オブジェクト（`ok`/`shapes`/`skipped`/`error`）を返し、不正な図形のみスキップ。図形単位の`try/catch`は1箇所。03-01時点の伝え方は確認用ウィンドウと`console.warn` | REQ要件4 / タスク5・8 |
| 図形一式の入れ替えとidの扱い | `VectorModel.replaceAllShapes`を新設（idは保存値を使い、欠落・重複は振り直し、`#nextId`を繰り上げ、採番は`#issueId()`に一本化）。入れ替え前の中断用に`InputTracker.abortOngoingOperation()`を新設（`setMode`と中断処理を共用。新旧30通りの比較で最終状態の同一性を確認） | REQ要件5 / タスク6 |
| 確認用の操作手段 | `?dev`時のみ表示する確認用ウィンドウ（`palette/DevPanel.js`＋`index.html`の静的DOM）。`window`への公開はしない。本アプリ初のテキスト入力欄として誤作動防止を確認（自動確認できなかったテンキー・IME・Space残留・コピー＆ペーストは発注者のテストプレイで問題報告なし） | REQ要件6 / タスク8 |
| 原点(0, 0)の表示 | `CanvasManager`にグリッドの直後・図形の背面で軸線（画面上1px）と原点マーク（十字＋円、画面上一定）を追加。可視範囲の計算を共用化し、グリッドの描画結果が不変であることを描画命令522通り・画素比較で確認。初期表示の原点位置（左上）は変更しない（発注者決定） | REQ要件7 / タスク7 |
| `PROJECT_ARCHITECTURE.md`の反映 | 1〜4章を更新。コード追従記述（文言・定数値・コメント位置）は除外するよう指示して反映 | タスク11 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* 後続サブフェイズへの申し送り（03-02：中断手段の再利用・通知順、03-03：インスタンス重複時のid・既存図形と合わせたid振り直し、03-04：`×`ボタン・確認用ウィンドウの扱い、03-05：一般利用者向けの通知UI） → `COWORK_STATUS.md` 2章P3
* `VectorModel`クラスJSDocの「生成・復元」表記 → 古いJSDoc・用語の修正Interruptにまとめる
* 開発資料の記述量の増加 → Phase 3クローズ時の資料監査

---

### Phase03-02「Undo/Redo」（クローズ日：2026-11-03）
* DIR: `_log/dir/261101_2154_DIR_Phase03-00_Editing_Foundation.md`（Phase 03-02節）
* REQ: `_log/req/261103_1904_REQ_Phase03-02_Undo_Redo.md`
* RES: `_log/res/261103_1911_RES_Phase03-02_Undo_Redo.md`（全7タスク。計画監査の軽微指摘を受けてPlanningUpdate 1回（配線位置の明確化）。Interruptなし）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 実装方式 | スナップショット方式（作業データ形式＋選択集合を操作の前後で丸ごと記録）。`core/HistoryManager.js`を新設（importなし・DOM非依存・取得/適用は`main.js`から注入）。逆操作は書かない | REQ要件3・7 / タスク1・3 |
| 記録の単位と時点 | 作成確定・削除・本体移動・ハンドル変形・`?dev`復元を各1件。`InputTracker`が注入された記録先へ`beginEdit`/`commitEdit`を通知（`model.onChange`は使わない）。変化がなければ記録しない（作業データの`JSON.stringify`比較）。ドラッグの中断で残った変化も1件として記録 | REQ要件2・6 / タスク2・3 |
| 履歴の上限 | 100件（`HISTORY_LIMIT`）。発注者決定 | REQ要件1 / タスク1 |
| 作成途中の取り消し | 作成途中の図形だけを破棄し履歴は変えない（`Esc`と同じ）。やり直しは破棄してから実行。発注者決定 | REQ要件4 / タスク4 |
| 適用後の選択状態 | 記録時点の選択集合へ戻す（選択モード以外では空、存在しないidは無視）。発注者決定 | REQ要件3 / タスク3 |
| ショートカット | `Ctrl`+`Z`／`Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`（リピート可）。`KeyboardShortcuts`の`allowShift`（2値）を`ShiftRule`（`FORBIDDEN`/`ANY`/`REQUIRED`）へ拡張 | REQ要件5 / タスク4 |
| ボタンと配置（`_doc/COWORK_STATUS.md` 2章C「余白24px」） | コントロールパネルの削除ボタンの下に「↶ 取り消し」「↷ やり直し」を横並び。押せる/押せないは`model.onChange`と`historyManager.onChange`で同期。図形パレットを`top: 368px`へ下げた。発注者決定 | REQ要件5 / タスク5 |
| 履歴のリセット手段 | `HistoryManager.clear()`を用意（呼び出しは03-04・03-05で接続） | REQ要件1 / タスク1 |
| `PROJECT_ARCHITECTURE.md`の反映 | 1・3・4章を更新（3章に6.履歴を新設）。完了処理で3章6.の通知回数の記述（選択モード以外では1回）を設計AIが訂正 | タスク7・完了処理 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* 03-03への申し送り（編集操作の追加方法・`ShiftRule`）、03-04への申し送り（`clear()`の呼び出し・`main.js`の肥大化） → `COWORK_STATUS.md` 2章P3

### Phase03-03「複製・コピー＆ペースト」（クローズ日：2026-11-04）
* DIR: `_log/dir/261101_2154_DIR_Phase03-00_Editing_Foundation.md`（Phase 03-03節）
* REQ: `_log/req/261103_2355_REQ_Phase03-03_Copy_Paste.md`
* RES: `_log/res/261103_2359_RES_Phase03-03_Copy_Paste.md`（全6タスク。計画監査の軽微指摘2件を受けて計画書を1回修正。Interruptなし）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| クリップボード | アプリ内部（メモリ）に作業データ形式で保持。OSのクリップボードは使わない（別タブ不可・再読み込みで消える）。取り消し・やり直しの対象外。発注者決定 | REQ要件1 / タスク3 |
| 置き場所 | `js/edit/`を新設し、`ShapeInserter.js`（作業データ→新しいidで追加・選択・履歴記録。03-05のインポートで再利用）と`ClipboardController.js`（クリップボードとコピー/切り取り/貼り付け/複製）に分割。依存は`main.js → edit → io → core → shapes` | REQ要件1・4 / タスク2・3 |
| idの採番（DIR持ち越し：`commitDraft()`の連番と永続化） | `VectorModel.addShapesWithNewIds`を新設。追加する図形に`#issueId()`で新しいidを採番（`#nextId`は単調増加・03-01で`replaceAllShapes`時の繰り上げ済み）。同一インスタンスの重複は参照で除外 | REQ要件3 / タスク1 |
| ずらし量 | 1段＝ワールド座標20。コピー後は1段目から、切り取り後は0段（元の位置）から、貼るたびに1段ずつ右下へ。複製は常に1段（段数・クリップボードは変えない）。発注者決定 | REQ要件3・4 / タスク3 |
| 選択モード以外での貼り付け | 選択モードへ切り替えてから貼り付け（クリップボードが空ならモードも変えない）。発注者決定 | REQ要件3 / タスク4 |
| ショートカット | `Ctrl`+`C`/`X`（リピート不可）・`Ctrl`+`V`/`D`（リピート可）、すべて`ShiftRule.FORBIDDEN`。`Ctrl`+`D`は常に`preventDefault()`。ボタンは追加しない（発注者決定） | REQ要件6 / タスク4 |
| 履歴（03-02申し送り） | 切り取りは既存の`deleteSelection()`経由、貼り付け・複製は`ShapeInserter`が`beginEdit`/`commitEdit`で囲んで各1件 | REQ要件5 / タスク2〜4 |
| `PROJECT_ARCHITECTURE.md`の反映 | 1・3・4章を更新（3章に7.クリップボードを新設）。完了処理で3章6.の見出しの呼び出し元に`edit/ShapeInserter.js`を設計AIが追記 | タスク6・完了処理 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* 別キャンバスへの貼り付けの確認・`main.js`の肥大化（418行）→ 2章P3【03-04へ】、インポートでの`ShapeInserter`再利用の前提 → 2章P3【03-05へ】、`paste`/`duplicate`のドラッグ判定・`EditRecorder`の重複定義・未使用の`addShape` → 2章C

### Phase03-04「ブラウザ内のキャンバス管理」（クローズ日：2026-11-04）
* DIR: `_log/dir/261101_2154_DIR_Phase03-00_Editing_Foundation.md`（Phase 03-04節）
* REQ: `_log/req/261104_0046_REQ_Phase03-04_Canvas_Library.md`
* RES: `_log/res/261104_0049_RES_Phase03-04_Canvas_Library.md`（全9タスク。計画監査でチェック0（読み込み完了前の操作が破棄される件）・チェック2（タスク順序で覆い要素がキャンバス操作を止める件）の要修正各1件と軽微指摘を受け、計画書を2回修正。タスク4に追加仕様（書き込み中の自動保存も切り替え前の確定の対象にする）を上乗せ。Interruptなし）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 保存先 | IndexedDB（`js/io/CanvasStorage.js`がAPIを呼ぶ唯一のファイル。定数`STORAGE_CONFIG`）。キャンバス記録`{ id, name, updatedAt, document }`＋最後に開いていたキャンバスの識別子。履歴・選択・ビュー変換・クリップボードは保存しない。ビュー変換は保存しない（発注者決定） | REQ要件1 / タスク2 |
| 自動保存 | `historyManager.onChange`を契機に最後の変更から0.5秒後に保存（`AUTOSAVE_DELAY_MS`）。ページ非表示時（`visibilitychange`・`pagehide`）に確定。非同期保存と切り替えの順序を保証（予約時のidと照合・同期的な作業データ取得・生成順の書き込み） | REQ要件2 / タスク3・4・7 |
| キャンバス一覧の管理 | `js/edit/CanvasLibrary.js`（起動時の復元・開く・新規作成・名前の変更・削除・切り替え処理・自動保存・保存失敗の状態`issue`）。切り替えは編集操作として記録せず`historyManager.clear()`と`viewTransform.reset()`を行う（03-02申し送り解消）。クリップボードは切り替えで消えない（段数もリセットしない） | REQ要件3〜5 / タスク3・4 |
| 起動時・読み込み中 | 最後に開いていたキャンバス→最終更新順に読める1枚を開く。なければ新規作成。読み込み完了まで覆い要素`#canvas-loading-cover`でキャンバス操作を止め、`?dev`の復元も受け付けない | REQ要件3 / タスク3・6・7 |
| 名前の変更・削除 | ブラウザ標準の小窓（`prompt`/`confirm`）。最大100文字、重複可、最終更新日時は変えない。開いているキャンバスの削除後は最近更新したものを開き、なければ新規作成（発注者決定） | REQ要件5 / タスク4・5 |
| パレットと呼び出し口 | 開閉式のキャンバスパレット（発注者決定）。`js/palette/PaletteLauncher.js`がボタンとパレットの対応表で開閉を共通化。`js/palette/CanvasPalette.js`が一覧・操作・状態表示。キャンバス名はコントロールパネルと`document.title`に表示。図形パレットの`top`を440pxへ | REQ要件6・7 / タスク5〜7 |
| `main.js`の肥大化（03-02申し送り） | スナップショットの取得・適用を`js/edit/SnapshotAdapter.js`へ切り出し（418→390行）。キャンバス管理の配線追加で最終496行 | REQ要件8 / タスク1・7 |
| 別キャンバスへの貼り付け（03-03持ち越し） | テストプレイで確認済み | テストプレイ |
| `PROJECT_ARCHITECTURE.md`の反映 | 1〜4章を更新（3章に8.キャンバス管理を新設、`edit/`の定義を拡張） | タスク9 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* ファイル関連操作のキャンバスパレットへの追加・`CanvasLibrary`の再利用・通知UIの統合 → 2章P3【03-05へ・03-04由来】、`×`ボタン・`?dev`の扱い → 2章P3【03-05以降・03-04由来】、`main.js`の行数・型定義の二重化・JSDocと開発資料の軽微な不一致・保存失敗時の切り替え中止等の仕様 → 2章C

### Phase03-05「ファイル入出力」（実装完了日：2026-11-06。テストプレイは2026-11-07に実施し問題なし）
* DIR: `_log/dir/261101_2154_DIR_Phase03-00_Editing_Foundation.md`（Phase 03-05節）
* REQ: `_log/req/261106_1354_REQ_Phase03-05_File_IO.md`
* RES: `_log/res/261106_1401_RES_Phase03-05_File_IO.md`（全8タスク。計画監査で`main.js`と`CanvasPalette`のタスク分割等を修正。テストプレイ項目は5章）

| 項目 | 結論 | 対応箇所 |
| ---- | ---- | -------- |
| 書き出し | `<キャンバス名>.json`をダウンロード（発注者決定：拡張子`.json`、ファイル名＝キャンバス名。作業データ形式は変更なし）。編集状態を変えない | REQ要件1 / タスク1・3 |
| 開く（ファイル） | ファイル名をキャンバス名にした新しいキャンバスとして登録し切り替える。`CanvasLibrary.createCanvasFromShapes`で既存の切り替え処理を再利用。記録は読めた図形を現行版で保存 | REQ要件2 / タスク2・3 |
| インポート | ファイル内の座標のまま追加（発注者決定）。`ShapeInserter.insertDocument`を再利用し1件の編集操作。失敗・追加0件なら図形・選択・履歴・操作モード・作成途中の図形を変えない | REQ要件3 / タスク3 |
| 組み立てと読み書きの分離 | `js/edit/CanvasFileOperations.js`（組み立て・判定・通知の状態。DOMに触れない）、`js/io/DocumentFileIO.js`（Blob・File・ファイル名の変換） | REQ要件7 / タスク1・3 |
| 一般利用者向けの読み込み失敗通知（03-01持ち越し、C-6・C-32・C-34） | パレット内の文言（発注者決定）。`issue`とは別の状態`fileNotice`で持ち、`#canvas-file-notice`へ表示（保存の問題と同時に出せる）。全図形スキップは呼び出し側で読み込み不可と判定（`deserialize`の仕様は変更せず）。`console.warn`は開発者向けに残す。`version: "1"`の見分けにくさは通知に現れないため対応不要 | REQ要件5 / タスク3・4・6 |
| 保存できない環境 | 書き出し・インポートは使える。開く・新規作成は押せない | REQ要件4 / タスク6 |
| `PROJECT_ARCHITECTURE.md`の反映 | 1〜3章（3章に9.ファイル入出力を新設）と`_doc/arch/`の5ファイルを更新 | タスク8 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* テストプレイ未実施 → 2章P3【Phase 3クローズ前・03-05由来】、`main.js`の行数・`FileNotice`の二重化等 → 2章C【Phase03-05由来】

---

### 開発資料の整理（Interrupt扱い。実施日：2026-11-06。発注者判断でP4着手前に実施）
* 実施者：現場設計AI（`PROJECT_PHASE_TRANSITION_CLEANUP.md`2・3章の基準に準拠）。資料の更新は設計AIの担当のためREQ/RESは発行せず、コードは変更していない。実施前の全文はGit履歴（コミット`ba21f24`）で参照できる。
* 発注者が示した基準：第一の目的はハルシネーションの防止、第二がコンテキストの削減。記載基準は`PROJECT_ARCHITECTURE.md`冒頭。
* 確かめ方：`oz-auditor`で資料・JSDoc・コードの3者を照合し、食い違いのうちJSDocの誤りとコードの不具合の疑いは`COWORK_STATUS.md`2章D・Eへ移した。

**`COWORK_STATUS.md`から移した項目**
* 2026-10-06のワークフロー改訂（Interrupt扱い）：NotebookLMの利用を中止し、リード設計AI役もCoworkが担う体制へ移行。DIRは`Phase XX-00`でPhase全体に1本だけ発行し、`Phase XX-01`以降はサブフェイズごとに別セッションでREQ→RES原本を作成する。`NOTEBOOK_HANDOFF.md`は廃止。
* 開発資料の分割（RES `261104_0943`）：`PROJECT_ARCHITECTURE.md`4章本文を`_doc/arch/`のモジュール別15ファイルへ分割。1章の`_doc/arch/`未記載は今回解決。
* 5大図形の完了に伴う「次の図形追加Phase」区分の統合（新規図形クラスの教訓はPhase01-05章）。
* Phase03-01由来の資料の増量（約34KB→約52KB）の懸念：今回の整理で解決。
* `README.md`・`PROJECT_CONSTITUTION.md`の実装AI名「Google Antigravity」のズレ：両ファイルに該当語が無いことを確認して解決（`README.md`のフォルダ構成の古さは未解決で残す）。
* `mouseup`への`stopPropagation`未実装の懸念：`WindowManager.js`に実装済みのため削除。
* Phase 1クローズの記録（2026-08-12）：全7サブフェイズの棚卸し完了、Phase1関連のREQ/RES/DIRを`closed/`へアーカイブ、開発資料を監査。
* Phase 2クローズの記録（2026-11-01）：本ファイルの「Phase 2フェイズ大番号クローズ」章を参照。

---

### Interrupt「P4前の不具合修正とJSDoc・用語の修正」（実施日：2026-11-07）
* REQ: `_log/req/261107_0038_REQ_Interrupt_P4_Prep_Bugfix_JSDoc.md`
* RES: `_log/res/261107_0038_RES_Interrupt_P4_Prep_Bugfix_JSDoc.md`（全11タスク）
* 確かめ方：内蔵ブラウザとローカルサーバーで修正の前後を実測した。保存の失敗は`IDBObjectStore.prototype.put`を例外にして再現した。

| 項目 | 修正前の実測 | 対応 | タスク |
| ---- | ---- | ---- | ---- |
| E-1 キャンバスがウィンドウに追従しない | 2026-11-06に実測済み | `resize()`のpx固定を削除し、表示サイズはCSSに任せる。根が同じ「非表示で読み込むと0×0のまま」も解消する見込み（修正前に0×0は観測。修正後はこの状況を再現できず未確認） | 2 |
| E-2 保存失敗の後に変更が消える | 起きた（切り替えを押すと変更が消えた） | 失敗した変更を保留として保持し、切り替えのたびに再試行して失敗なら止める。読み込み中の編集も確定手順で守る。`beforeunload`で確認する。発注者の決定：移動は止めるだけで、捨てて移る小窓は足さない | 1 |
| E-3 記録を書けない新規キャンバス | 起きた（読めなくなり、再読み込みで一覧から消えた） | 確認の小窓「新しいキャンバスを保存できませんでした。保存しないまま開きますか？」。いいえ＝作らない、はい＝開いて保存できるまで移れない（発注者の決定） | 1・4 |
| E-4 ウィンドウのドラッグの残留 | 起きた（`mouseup`の取りこぼしを合成イベントで再現） | `blur`と`buttons === 0`の`mousemove`で解除 | 3 |
| E-5 `Rect.setVertex`の範囲外 | 起きた（直接呼ぶと`points[null]`ができる。アプリの操作からの経路は無い） | 0〜3の整数以外を無視 | 5 |
| E-6 例外時の停止 | 3件とも例外を注入すると起きた（通常の操作で例外が出る経路は未確認） | `#notifyChange`がリスナーごとに捕捉、`serialize`の例外を書き込みの失敗と同じ扱いに、手順4の`prepareSwitch()`の例外は続行 | 4 |
| E-7 弧のアイコンと描画の向き | アイコン`◠`に対し描画は下半分 | 発注者の決定：アイコンが正しい。描画を上半分へ（保存済みの弧も上下が逆に表示される） | 6 |
| E-8 つぶれた円・弧の判定の不一致 | 起きた（クリックで選べず範囲選択で選べた） | 発注者の決定：クリックでも選べるように（輪郭の折れ線への距離で判定） | 6 |

* **2章D（JSDoc・用語）**：全項目を修正（タスク2・3・5・6で不具合に関わる分、タスク7で`draftLine`→`draftShape`の改名、タスク8〜11で残り）。JSDocの誤りを補っていた開発資料の記述は、JSDocで分かるようになった分を削除した（切り替え処理の手順の細則・`#isSwitching`の区間・`issue`の種類と解除条件・`replaceAllShapes`/`addShapesWithNewIds`の契約など）。
* **`COWORK_STATUS.md`から削除した項目**：2章D・E全件、2章Cの「非表示で読み込んだ場合」。

### Interrupt：フロートウィンドウの×の整理と、原点を表示領域の中央に置く初期表示（2026-11-07）
* REQ：`_log/req/261107_1357_REQ_Interrupt_Window_Close_View_Center.md`／RES：`_log/res/261107_1357_RES_Interrupt_Window_Close_View_Center.md`（TASK1で実装）。
* **×（旧C-46）**：コントロールパネル・図形パレットの×を削除。キャンバスパレットは現状維持。`?dev`の確認用ウィンドウは×で閉じる（開き直しは再読み込み）。確認用ウィンドウは`?dev`のときだけ表示する形で残すと発注者が決定。
* **原点の初期表示**：開く・新規作成・開く（ファイル）・起動時の復元・ビューのリセット（`Ctrl`+`0`・ボタン）で、原点をキャンバス要素全体の中央・倍率100%に置く。インポートでは表示を変えない。ウィンドウの大きさの変更には追従しない。**Phase 03-01の「初期表示・リセット時の原点はキャンバス左上」という決定を変更した。**
* 確かめ方：内蔵ブラウザで起動時の復元・リセットボタン・`Ctrl`+`0`（合成イベント）・新規作成・一覧から開く・確認用ウィンドウの×を確認。発注者のテストプレイでOK。
* **`COWORK_STATUS.md`から削除した項目**：2章P3の×ボタン（C-46）・確認用ウィンドウを残すかの判断。

---

### Phase 3「編集基盤」フェイズ大番号クローズ（クローズ日：2026-11-07）
* 棚卸しの対象：Phase 3期間のRES 8本（`261102_0003`〜`261106_1401`のサブフェイズ5本、Interrupt `261104_0943`・`261107_0038`・`261107_1357`）。開発資料の整合確認はコミット`06b430e`で実施済み。
* 【解決】Phase03-05のテストプレイ未実施（旧2章P3）：2026-11-07に発注者が実施し問題なし（RES `261106_1401` 5章の確認項目）。
* 【解決】フロートウィンドウの見出しの高さの目視確認（RES `261107_1357` 6章）：テストプレイでOK。
* 【破棄】取りこぼし4件（発注者決定：使っていて気になったらその時にInterruptで対応する）
  * `Space`を押したまま名前の変更・削除・ファイル選択の小窓を開き、表示中に離すと`grab`カーソルが残る（次の`Space`・`blur`で解消。RES `261104_0049`・`261106_1401` 5章）。
  * `event.code`による識別のため、QWERTZ・AZERTY配列では`Ctrl`+`Z`/`Y`が刻印どおりに動かない（対象は日本語・US配列。RES `261103_1911` 5章）。
  * `'unavailable'`の未保存は、取り消しで元の内容へ戻しても偽へ戻らない（REQの定義どおり。RES `261107_0038` 5章）。
  * 長いファイル名の読み込み失敗通知でパレットが伸び、画面の低い環境で下部が画面外に出うる（RES `261106_1401` 5章）。
* 【破棄】`COWORK_STATUS.md` 2章のPhase 3由来の項目（発注者決定：同上。参照用に要点を残す）
  * 【B・Phase03-04】覆い要素の表示中は`Ctrl`+ホイールでブラウザ自体の拡大縮小が起きうる（RES `261104_0049` 5章）。
  * 【B・RES `261107_0038`・未確認】実際の容量超過、`beforeunload`の小窓が実際に出ること、実マウスのタブ切り替え中のドラッグ（E-4）、非表示で読み込むと0×0のまま残る件の解消。
  * 【B・RES `261107_0038`・操作感】`⚠ `と保存失敗の文言は次の自動保存の成功まで残る（新規作成の確認で「いいえ」の後、失敗中に開いているキャンバスを削除した後も）。
  * 【B・内蔵ブラウザの制約】Claudeデスクトップアプリの内蔵ブラウザは`window.prompt`に対応せず、キャンバス名の変更（✎）は動かない。コードは変えないと発注者が決定（2026-11-07）。自動操作で確かめるときは`window.prompt`を差し替える。
  * 【C・性能】起動時に全キャンバスの作業データを一度読み出す。巨大なファイルの読み込みの最適化・サイズ制限なし（RES `261106_1401` 5章）。
  * 【C・`main.js`の肥大化】526行。配線を追加する場合は`// 7.6.`ブロックの別モジュール化、注入オブジェクトの組み立ての分離を検討（Phase02-04由来の`KeyboardShortcuts`の有効/無効APIの項は2章Cに残した）。
  * 【C・`ShortcutActions`】`paste`/`duplicate`はドラッグ中を自ら判定しない（ボタン等から呼ぶ場合は呼び出し側で判定）。未使用の`VectorModel.addShape`（RES `261103_2359` 5章）。
  * 【C・型定義の二重化】`EditRecorder`・`Snapshot`・`CanvasLibraryState`・`FileNotice`がそれぞれ2ファイルにある（形を変える場合は両方を揃える）。
  * 【C・`CanvasLibrary.js`】約1200行（分割しない方針）。`#enterCanvas`に入る前の予期しない例外で`#isSwitching`が真のまま残る等（RES `261107_0038` 5章）。
  * 【C・保存の制約】保存できない状態が続くと別のキャンバスへ移れない（発注者の決定）。名前の変更の失敗は再読み込みで古い名前へ戻る。一部の図形を読めずに開いたキャンバスは編集すると読めなかった図形が保存から消える。
  * 【C・`CanvasFileOperations`】表示同期のリスナーが例外を投げると処理中のフラグが真のまま残る（RES `261106_1401` 5章）。
* 資料・JSDocに注意書きとして載っているため棚卸しの対象外とした設計メモ（例：ビューの回転時の可視範囲計算、履歴のメモリ量、`onversionchange`、`file://`での保存先）は、`_doc/arch/`の各ファイルを参照。
* DIR変更提案（親セッションへ）：Interrupt `261107_1357`による「初期表示・リセット時の原点は左上」（Phase03-01の決定）から「表示領域の中央」への変更を、DIRの変更履歴へ記録する。

### Phase04-04「OZ Engineでの表示確認と往復」（完了日：2026-11-09。テストプレイ実施済み、問題なし）
* REQ `_log/req/261109_1856_REQ_Phase04-04_Engine_Roundtrip.md`、RES `_log/res/261109_1902_RES_Phase04-04_Engine_Roundtrip.md`。
* 決定（発注者、261109）：スプライトのJSON（`<名前>.json`）の出力をやめ、エディタの「開く」「インポート」でも読まない（「`.json`＝作業データファイル、`.js`＝スプライト」と1対1にするため）。確認用ページもJSだけを表示する。書き出し形式の版（`formatVersion`）は1のまま。
* エンジンとの約束（エンジンは既定のexportの`draw(ctx)`だけを読む、版やexportの形を変えるときは連絡票を出す等）を`PROJECT_ARCHITECTURE.md`2章「スプライト（書き出し形式）」へ書き足した。エンジンからの返信`_doc/BRIDGE_FROM_ENGINE.md`は削除した（要点は2章へ移した）。
* 解消した懸念：「出力（エンジン用）」の2ファイル連続ダウンロードによる複数ダウンロードの許可（Phase04-02由来）、確認用ページでJSONを描くときの描画処理の食い違いの可能性（Phase04-03由来）。
* 完了処理で、`_doc/arch/14_edit.md`の`CanvasFileOperations`の依存の一覧に`FileContentReader`が抜けていた記載漏れを直した（発注者了承）。

### Phase 4「薄い書き出し」フェイズ大番号クローズ（クローズ日：2026-11-09）
* 棚卸しの対象：Phase 4期間のRES 4本（`261107_2041`・`261107_2156`・`261109_0003`・`261109_1902`。Interruptなし）の5章と「開発資料の更新予定」。各サブフェイズの完了処理で開発資料へ反映済みのため、調査（Survey）は行っていない。発注者の指示（「問題がなければクローズまで」、2026-11-09）により、Phase 3の扱い（使っていて気になったらInterruptで対応する）にならって親セッションが仕分けた。
* 【解決】`PROJECT_ARCHITECTURE.md`2章「エディタで開くときの規則」の「読み込み不可」の項に、JSON全体の判定規則が重なっていた件（RES `261109_1902`）：Phaseクローズで清書した。
* 【解決】スプライトのJSONの2ファイル連続ダウンロード・確認用ページでJSONを描くときの描画処理の食い違い（RES `261107_2156`・`261109_0003`）：Phase04-04でスプライトのJSONをやめて解消（上の「Phase04-04」章）。
* 【破棄】低優先の項目（参照用に要点を残す）
  * `sprite-check.html`の`#check-canvas-area`の`position: relative`は効果のない指定（RES `261109_0003` 5章）。
  * `CanvasFileOperations`の`#runReadOperation`のJSDocが「読み取り＋デシリアライズ」のままで、入口が`FileContentReader.deserializeFromText`であることを明記していない（実態との食い違いはない。RES `261109_0003`）。
  * 確認用ページでJSONを選んだ場合と、JSだが既定のexportがスプライトでない場合は同じ区分`notSprite`・同じ文言になる。`SpriteCheckInspector.parseText`の`value`は使われなくなったが戻り値の形は変えていない（RES `261109_1902` 5章）。
  * エディタでスプライトのJSONを選んだときの`console.warn`は`DocumentSerializer`の「作業データ形式が一致しません」になる（通知は`readFailed`。`DocumentSerializer`にスプライトの識別子を持ち込まない制約は開発資料2章にある。RES `261109_1902` 5章）。
* 【2章から外した・開発資料が正本】確認用ページで無限ループするJSを選ぶとページが固まる件（`_doc/arch/17_sprite_check.md`）。
* 2章Cに残したもの：線の太さが無い図形を2pxとして読み込む（Phase 4の後のInterrupt候補）、書き出したJSの描画処理と各図形の`draw`の手での同期、既定のexportの浅いコピー、スプライトのJSの取り出しが書き出した形に頼ること。
* RES 5章のその他の設計上の注意（`package.json`を置かないこと・Node.jsの版、テストの補助モジュール、マイグレーションのテストの追加時期、外枠の近似、ES2019以降の前提、`file://`での開き方等）は開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/16_test.md`・`17_sprite_check.md`等）に載っているため棚卸しの対象外とした。

### Phase05-01「図形クラスの共通の関数の切り出し」（完了日：2026-11-09。テストプレイ実施済み、問題なし）
* 【解決】図形クラスの重複（`#segmentIntersectsRect`・`#validateData`が`Line`/`Curve`/`Rect`/`Ellipse`の4ファイルに重複。Phase02-03由来）：共通モジュール`js/shapes/ShapeGeometry.js`（点と線分の距離・線分と矩形の交差・2次ベジェの点）と`js/shapes/ShapeDataValidation.js`（`fromJSON`の共通項目の検証）へ切り出した。継承ではなく関数の切り出し（発注者の決定）。式の異なる`Ellipse.#distanceToOutline`は置き換えていない。切り出しの前に`test/shapes/`へ4クラスの当たり判定と`fromJSON`のエラー文のテストを追加。REQ `261109_2107`・RES `261109_2115`。詳細は`_doc/arch/12_shapes.md`。

### Phase05-02「パスの図形」（完了日：2026-11-10。テストプレイ実施済み、問題なし）
* 【解決】`validateShapeData`の頂点数が固定の数しか受けない件（Phase05-01由来）：第4引数を`number | { min }`に拡張した（既存4クラスの呼び出し・エラー文は不変）。パスの図形`js/shapes/Path.js`（図形種別`'path'`。図形データに`closed`・`segments`を足す）を、`ShapeFactory`の読み込み専用のエントリ（`create: null`。`SHAPE_TYPES`は5種のまま）として追加。書き出しは版1の`polyline`で表し、`formatVersion`・作業データの版は上げていない。REQ `261110_1007`・RES `261110_1037`。詳細は`PROJECT_ARCHITECTURE.md`2章・`_doc/arch/12_shapes.md`・`10_ShapeFactory.md`。

### Phase05-04「端点へのスナップと描き足し」（完了日：2026-11-10。テストプレイ実施済み、問題なし）
* 【解決】Phase05-03由来の「結合の規則を05-04で使い回す」件と、発注者の宿題（2026-11-10。線を引くとき端点の近くでハンドルを表示し、その線の続きとして描けるようにする）、Phase05-02由来の「描き足し・閉じる処理でのパスの区間の要素数の不変条件」の注意：直線を描くとき・端点のハンドルをドラッグするときに、結合できる線（直線・開いたパス）の端点へ画面上8px以内で吸い付き、中を青で塗った正方形を表示するようにした。描き足しは元の線のidを保ち、2本をつなぐ場合は05-03の結合の規則（奥の線が基準・新しいid）、閉じる場合は05-03の閉じる規則に揃えた。規則は`js/shapes/PathJoinRules.js`（端点を指定してつなぐ入口・描き足しの入口を追加）と新設`js/shapes/EndpointSnapRules.js`、手順は新設`js/edit/EndpointSnapper.js`（`main.js`が生成して`InputTracker`へ注入）、表示の点は`VectorModel`、`replaceShape`に`select`引数を追加。REQ `261110_1430`・RES `261110_1514`。詳細は`PROJECT_ARCHITECTURE.md`3章11.・12.と`_doc/arch/12_shapes.md`・`14_edit.md`・`06_InputTracker.md`。

### Phase 5「パスの基礎」フェイズ大番号クローズ（クローズ日：2026-11-10）
* 棚卸しの対象：Phase 5期間のRES 4本（`261109_2115`・`261110_1037`・`261110_1147`・`261110_1514`。Interruptなし）の5章と「開発資料の更新予定」。各サブフェイズの完了処理で開発資料へ反映済みのため、「開発資料の更新予定」に未反映のものはない。DIRは`_log/dir/closed/261109_2044_DIR_Phase05-00_Path_Basics.md`（決めたことは変更履歴）。
* 【破棄】低優先の項目（発注者の決定、2026-11-10。参照用に要点を残す）
  * 直線の描き終えの吸い付きは直前のカーソル移動の照会結果を使うため、中ボタンのパンの後にカーソルを動かさずに描き終えると、表示が消えたままパン前の照会結果で描き足し・結合になり得る（ホイールのズームは表示を消さない）。テストプレイでは問題なし（RES `261110_1514` 5章）。
  * `validateShapeData`は頂点を`forEach`で調べるため、穴のある`points`配列を検査せずに通し`TypeError`になる。作業データファイルからは起きず、オブジェクトを直接渡しても`DocumentSerializer`で図形単位のスキップになる（RES `261109_2115` 5章）。
  * `SpriteSerializer`の`polylineRange`は頂点の配列を展開して`Math.min`・`Math.max`へ渡すため、頂点数がおおむね10万点以上のパスでは書き出しで例外になり得る（パスの頂点数に上限は設けない。RES `261110_1037` 5章）。
  * RES 5章のみにあった項目：`Ellipse.hitTest`の比率の式は許容幅ちょうどの点で`false`になり得る（既存の振る舞い。テストは余裕を持たせた値で確かめる）。`quadraticBezierPoint`が呼び出しごとに新しいオブジェクトを返す割り当て（テストプレイで体感の変化なし）。計画時のNode.jsの版（v24.15.0）が`_doc/arch/16_test.md`の記載（v24.20.0）と違う件（v24.15.0でも全件成功。RES `261109_2115` 5章）。削除ボタンが行の半分の幅・中央寄せになった見た目の変化（テストプレイで確認。RES `261110_1147` 5章）。吸い付きの表示の枠の色・太さ（テストプレイで問題なし。RES `261110_1514` 5章）。
* 【2章から外した・開発資料が正本】`JOIN_TOLERANCE_SCREEN_PX`と`InputTracker`の`hitTolerance`が同じ5pxで別の定義である件（`_doc/arch/12_shapes.md`）。`main.js`の行数と配線ブロックの切り出しの検討（`_doc/arch/02_main.md`）。`resolveEndpointHandle`が「頂点の番号＝`points`の番号」に依る件（`_doc/arch/12_shapes.md`）。
* 2章に残したもの：曲線の結合と区間の削除（パスの編集。発注者の宿題）、曲線の区間と書き出し形式の版上げ（パスの編集。`Path.js`の区間の判定の共通化の見直しを含む）、吸い付きの対象を広げるときの区別（精度）、`InputTracker`約1310行の再分離と吸い付きの作業用フィールドの寿命（精度）、吸い付きの照会の性能（2章Cの性能の項）。
* 開発資料の整合確認：調査（Survey。RES `261110_1645`。Phase 5期間に追加・変更された`PROJECT_ARCHITECTURE.md`と`_doc/arch/`の記述を実コードと照合）で行った。相違は1件で、`PROJECT_ARCHITECTURE.md`3章12.「注意（パン／ズームの後）」の「ズームは表示を消さない」が、端点のハンドルを閾値を超えてドラッグしている最中のズーム（照会し直し、吸い付く距離を新しい表示倍率で換算し直すため、吸い付きが外れて表示が消え得る）に当てはまらなかった。コードは変えず、発注者の決定（2026-11-10）により資料の文を実際の動きに合わせて直した。上の【破棄】の「ホイールのズームは表示を消さない」は描いている途中の話で、引き続き正しい。相違ではない読み方の分かれ得る点（`canJoin`が真でも結合が何も起こさない選択がある等）はRESの4章・6章に残した。

### Phase06-01「塗り・線なしのデータと描画」（完了日：2026-11-11。テストプレイ実施済み、問題なし）
* 【解決】Phase04-02由来の「エディタ側でも線の太さ（`strokeWidth`）が無い図形を2pxとして読み込む」（発注者の意向・Interrupt候補）：キーが無い（`undefined`）場合だけ2pxとして読むようにした（値があって0以下・`null`・文字列等は従来どおり不正）。既定値は`js/shapes/ShapeDataValidation.js`の非公開定数（`io/SpriteSerializer.js`の`DEFAULT_STROKE_WIDTH`と同じ値であるべき）。あわせて図形データに`fillColor`（色の文字列または`null`。キーが無ければ`null`）・線なし（`strokeColor: null`）を足し、塗れる形（矩形・円・閉じたパス。共通メソッド契約の第14メソッド`isFillable()`）だけを塗る。作業データの版・書き出し形式の版をどちらも2に上げた（版1→版2の移行は`fillColor: null`を設定）。`DRAW_SOURCE`も塗りに対応し、線なしの要素は外枠を広げない。結合・描き足し・閉じるの塗りは基準の線Aのもの。REQ `261111_1828`・RES `261111_1913`。詳細は`PROJECT_ARCHITECTURE.md`2章・`_doc/arch/12_shapes.md`・`15_io.md`・`16_test.md`。

### Phase06-02「プロパティパネル（図形の段）と既定の色」（完了日：2026-11-12。テストプレイ実施済み、問題なし）
* 【解決】Phase06-01由来の「線の太さ2pxの定義が3種類ある。『直前に使った値』を入れるときに3つ目（図形クラスのコンストラクタの既定値）の扱いを決める」：新しく描く図形の既定の太さは`core/VectorModel.js`の`DEFAULT_NEW_SHAPE_STYLE.strokeWidth`を唯一の定義とし、`startDraft`が生成直後に直前に使った値を当てる。コンストラクタの既定値は「引数を省略して生成したときの値」として残し、読み込み・書き出しの既定値は変えていない（4つの定義の位置づけは`PROJECT_ARCHITECTURE.md`2章）。
* 【一部解決】Phase06-01由来の「見えない図形（線なしで塗れない形）をプロパティパネルで許すか」：許すと決めた（発注者、2026-11-12）。選び方は06-03で決める（本ファイル2章Dに残した）。
* 【一部解決】Phase02-04由来の「`checkbox`/`color`等にフォーカス中はショートカットが効き、`Space`がパンになる」：`checkbox`・`color`は`InputTracker.js`の`isSpaceOperatedInputElement`で対応した（`Space`でパンせず`Ctrl`なしのショートカットを止める。`Ctrl`のショートカットは効く）。`range`等は2章Cに残した。
* 実装の内容：常に表示するフロートウィンドウ「プロパティ」に「図形」の段を足し、選択中の図形の線の有無・線の色・太さ（整数1〜100）・塗りの有無・塗りの色を表示・変更できるようにした（複数選択は一番手前の値＋「混在」、塗れる形だけに塗りを反映、色を選ぶとその項目を「あり」にする、ピッカー1回分で取り消し1回）。何も選んでいないときは「次に描く図形」の値（直前に使った値。保存しない）を表示・変更する。規則は新設`js/edit/StylePanelRules.js`、手順は新設`js/edit/ShapeStyleEditor.js`、DOMは新設`js/palette/PropertyShapeSection.js`、直前に使った値とスタイルの書き換えは`VectorModel`。REQ `261112_1130`・RES `261112_1151`。詳細は`PROJECT_ARCHITECTURE.md`2章・3章13.と`_doc/arch/02_main.md`・`13_palette.md`・`14_edit.md`。

### Phase06-03「塗った内側の当たり判定」（完了日：2026-11-12。テストプレイ実施済み、問題なし）
* 【解決】Phase06-01・06-02由来の「見えない図形（線なしで塗れない形、線も塗りもない図形）の選び方」：今のまま変えないと決めた（発注者、2026-11-12）。輪郭付近のクリック・範囲選択・全選択で選べ、ホバーの強調・ハンドルが出る。内側の当たりは塗られていないため常に偽。
* 【解決】Phase06-02由来の「`js/shapes/ShapeDataValidation.js:18`の`DEFAULT_STROKE_WIDTH`のJSDocの食い違い」：JSDocを直し、`PROJECT_ARCHITECTURE.md`2章・`_doc/arch/12_shapes.md`の「JSDocの食い違い」の記述を削除した。
* 【解決】Phase06-01由来の「内側の当たり判定は`isFillable()`を正本にし、書き出し側と食い違わないこと」：`hitTestFill`は`draw`の塗る条件（`isFillable() && typeof fillColor === 'string'`）と同じ条件で判定する。
* 実装の内容：共通メソッド契約に第15メソッド`hitTestFill(x, y)`を足した（許容誤差なし・境界を含まない。矩形・閉じたパスは新設`ShapeGeometry.isPointInPolygonNonzero`（nonzero）、円は楕円の式、直線・曲線・弧・開いたパスは常に偽）。当たり分類の規則を新設`js/core/PointHitRules.js`へ切り出し、「見た目どおり」（選択集合の図形のハンドル → 選択集合の図形の輪郭・手前優先 → 手前から輪郭または塗った内側）にした（発注者、2026-11-12）。塗りのない輪郭どうしの重なりは奥から手前に変わった（了承済み）。選択集合外の図形を押してそのままドラッグしても動かない・範囲選択は輪郭のみ・`Ellipse.hitTest`の近似は見直さない、は今のまま。REQ `261112_1503`・RES `261112_1513`。詳細は`PROJECT_ARCHITECTURE.md`3章3.・`_doc/arch/12_shapes.md`・`18_PointHitRules.md`・`16_test.md`。

### Phase06-05「OZ Engineとの往復」（完了日：2026-11-12。エンジン側で表示確認済み、発注者のテストプレイ（PC・スマホ）OK）
* 機体の絵（手書きの`ship.js`と同じ座標の凹型の閉じたパス＋円2つ。白の塗りのみ・線なし）はAIが作業ファイル`ship.ozve.json`として用意し、発注者がエディタで開いて「出力（エンジン用）」で書き出した（発注者の決定。エディタで描く確認はしていない）。確認用ページ・エディタの背景は白のままとし（背景の切り替えは足さない。発注者の決定）、確認用ページでは外枠・情報欄だけを確かめ、見た目はエンジンの画面で確かめた。
* 連絡票`D:\ozlab\ozengine-web\_doc\BRIDGE_FROM_VECTOREDITOR.md`で、書き出し形式の版2・`draw(ctx)`の約束が変わらないこと・`ship.js`の置き換えの依頼・Phaseを名前で指す取り決めを伝えた。往復は1回で完了。
* エンジンからの返信`_doc/BRIDGE_FROM_ENGINE.md`の要点（返信は取り込み後に削除。コミットはしていない）：エンジンの`assets/sprites/ship.js`を書き出しファイルで置き換え（改行コードのみCRLFに変換）、エンジンのコード（`js/`・`oz/`）の変更なしでタイトル・プレイの両方に表示された。手書きとの画素比較では円のふちのぼかしだけがわずかに違う（目で見てわかる差ではない。手書きの`arc`と書き出しの`ellipse`の違いと推測、原因は未確認）。`ctx`の`fillStyle`等に左右されず、`ctx`の状態も元に戻ることを確認。エディタ側の直しはなし。エンジン側の資料は`PROJECT_ARCHITECTURE.md` 4章の`assets/sprites/*.js`の行を「エディタの書き出しファイルで、手で編集しない」に変えた。`oz/ENGINE_API.md` 23章は形式を書き写していないため変更なし。エンジンの`_doc/PROJECT_MILESTONE.md`に残るエディタのPhaseの番号（「P5」3か所・「P7」1か所）はエンジンのリード設計のセッションが後で直す。
* 開発資料：`PROJECT_ARCHITECTURE.md` 2章「エンジンとの約束」の(a)を実態（参照元はエンジンの`oz/ENGINE_API.md` 23章）に直し、(c)に版2の連絡済みを、(d)にエンジンの`ship.js`は本アプリの書き出しで手で編集しない・直すときは本アプリで開いて書き出し直すことを足した。REQ `261112_2119`・RES `261112_2122`。
