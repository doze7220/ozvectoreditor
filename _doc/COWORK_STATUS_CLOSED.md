# COWORK_STATUS_CLOSED.md
## 解決済み・決定済み事項アーカイブ

---

### このファイルについて
* `COWORK_STATUS.md`に蓄積されるとコンテキスト肥大化・ハルシネーション誘発の原因になる「解決済み・決定済みの過去の懸念事項」を隔離して保管する専用ファイル。
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
