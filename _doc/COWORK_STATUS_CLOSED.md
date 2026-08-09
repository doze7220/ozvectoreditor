# COWORK_STATUS_CLOSED.md
## 解決済み・決定済み事項アーカイブ

---

### このファイルについて
* `COWORK_STATUS.md`に蓄積されるとコンテキスト肥大化・ハルシネーション誘発の原因になる「解決済み・決定済みの過去の懸念事項」を隔離して保管する専用ファイル。
* Coworkは通常セッションで本ファイルを能動的に読みに行く必要はない。過去の実装経緯を遡って追跡したい場合、デバッグ時、または過去の設計判断の根拠を再確認したい場合にのみ参照する。
* 各項目には対応の一次情報源（REQ/RESファイルパス、タスク番号）を残す。詳細な経緯・議論の全文はそちらを正とし、本ファイルには要点のみ記録する。
* Phaseクローズのたびに、`COWORK_STATUS.md`側で「解決済み」に仕分けられた項目をここへ追記していく（追記型。既存の記載内容は変更しない）。

---

### Phase01-02「LINEの作成・選択・再編集における入力・描画・座標基盤の確立」（クローズ日：2026-08-08）

* RES: `_log/res/260808_1835_RES_Phase01-02_LineInteraction_Foundation.md`
* 参照元REQ群:
  * `_log/req/20260808_1831_REQ_Phase01-02_LineInteraction_Foundation.md`（本体）
  * `_log/req/20260808_2011_REQ_Interrupt_Phase01-02_Task5.5_ShapeVertexPolymorphism.md`（Task5.5 Interrupt）
  * `_log/req/20260808_2036_REQ_PlanningUpdate_Phase01-02_Task6.5_MainJsWiring.md`（Task6.5 PlanningUpdate）

| 項目 | 結論 | 対応箇所 |
|---|---|---|
| toleranceの具体値 | `hitTolerance = 5px`（線分本体・ハンドル共用）に決定 | タスク8 |
| `updateVertex`/`moveShape`がLine固有プロパティ(x1,y1,x2,y2)に直接アクセスしていたアーキテクチャ違反 | `Line.setVertex`/`translate`を追加し、ポリモーフィックな委譲に置き換え | Task5.5 Interrupt |
| `main.js`のrender呼び出しに状態(selectedId/hoveredId/draftLine)を渡す配線がタスク計画から漏れていた | タスク6.5として新設・実行し解消 | Task6.5 PlanningUpdate |
| 旧`handleClick`（+50,+50固定ダミーLine生成）と新実装の重複リスナー懸念 | タスク8で完全削除・新実装へ置換。タスク10・11で残存なしを再確認済み | タスク8/10/11 |
| `DRAGGING_HANDLE`状態で`mouseup`未実装のため操作不能になる一時的制約 | `handleMouseUp`実装により解消 | タスク10 |
| ハンドル同士が近接した場合の当たり判定優先順位 | `start→end→move`の順で先着1件を返す仕様で確定 | タスク2 |
| `selectShape`/`setHovered`のid実在チェック省略 | 呼び出し元が実在idのみ渡す前提の設計として確定、実害なしと判断 | タスク3 |
| `getDraftLine()`の追加要否 | `CanvasManager`の描画に必要な最小限のgetterとして正当と判断し追加 | タスク4 |
| `#draftLine`がnullの時の各メソッドの早期return設計 | 防御的実装として確定。タスク9実装後の実機確認でも問題なし | タスク4/9 |
| `DRAWING`分岐の判定順序（IDLEガードより手前に配置） | 拡張しやすいパターンとして確定、以後の`DRAGGING_HANDLE`分岐にも踏襲 | タスク9/10 |
| `mouseup`時に`activeHandle`/`activeShapeId`/`lastCursor`をクリアしない設計 | 次回`mousedown`で必ず上書きされるため実害なしと判断 | タスク10 |
| ファイル先頭JSDoc責務定義の同期 | `Line.js`を「データ保持・描画・当たり判定」の3責務に更新。以後のルールとして定着 | タスク2 |
| RES→REQ逆リンク（参照元REQ行）の欠落 | 全RESテンプレート5種（ImpretonPlan/SurveyPlan/Interrupt/AddInterrupt/Survey）に`参照元REQ`行を追加。Phase01-02のRESにも遡及追記済み | テンプレート改修 |
| タスク5.5見出しの表記不一致（タスク5の見出しをコピーしたまま） | ユーザーが直接修正 | 軽微修正 |
| `InputTracker.js`の`activeHandle`コメントの陳腐化（「タスク10で実装」が実装完了後も残存） | ユーザーが直接修正 | 軽微修正 |
| ホバー強調とハンドル表示の同時表示（選択中図形にカーソルを重ねた時の見た目） | ユーザーが実機で目視確認し、現状の実装のまま問題ないと判断 | テストプレイ（2026-08-08） |
| ハンドル・ホバーの暫定デザイン（正方形8px・半透明青など） | ユーザーが実機で目視確認し、現状のデザインのまま進めてよいと判断 | テストプレイ（2026-08-08） |
| 長さ0の線が生成されるケースの許容可否 | ユーザーが実機で目視確認し、許容して問題ないと判断（`commitDraft()`へのガード追加は不要） | テストプレイ（2026-08-08） |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* `startDraft`/`updateDraft`のLine固定インスタンス化・直接プロパティアクセス → P1-3着手時に設計判断
* `moveShape`のDPI/CSSズーム誤差、タッチ非対応、id採番方式とImport機能の衝突、無条件notifyChangeのパフォーマンス → いずれも将来Phase（ズーム/パン、タッチ対応、Import機能実装、パフォーマンス問題顕在化時）に先送り

---

### Phase01-03「キャンバス全体化、右側固定フロートUI、およびツールモード切り替えの基盤確立」（クローズ日：2026-08-09）

* DIR: `_log/dir/20260808_2307_DIR_Phase01-03_CanvasFullscreen_And_FloatUI.md`
* RES: `_log/res/260808_2356_RES_Phase01-03_CanvasFullscreen_And_FloatUI.md`
* 参照元REQ群:
  * `_log/req/20260808_2345_REQ_Phase01-03_CanvasFullscreen_And_FloatUI.md`（本体）
  * `_log/req/20260809_0002_REQ_PlanningUpdate_Phase01-03_StartDraftSignatureFix.md`（PlanningUpdate）
  * `_log/req/20260809_0015_REQ_PlanningUpdate_Phase01-03_ArchDocPreviewFix.md`（PlanningUpdate）

| 項目 | 結論 | 対応箇所 |
|---|---|---|
| `startDraft(type = 'line', x, y)`のデフォルト引数順序が後方互換動作を実現しないJS仕様上の欠陥（チェック0で発見） | `startDraft(x, y, type = 'line')`へ変更し、`type`を末尾・デフォルト値付きに修正して解消 | PlanningUpdate `20260809_0002` |
| `keydown`リスナーの購読先未指定（`<canvas>`はフォーカス不可でキーボードイベントを受け取れない懸念、チェック0で発見） | `document`への購読と明記し解消 | PlanningUpdate `20260809_0002` |
| 「開発資料の更新予定」欄に残った旧シグネチャ表記の修正漏れ（チェック0再監査で発見） | 該当1箇所を修正 | PlanningUpdate `20260809_0015` |
| Canvas全画面化・ウィンドウリサイズ追従・dprスケール累積の有無 | ユーザーが実機で目視確認し、問題なしと判断 | テストプレイ（2026-08-09） |
| コントロールパネルの`z-index`層順・ボタンのアクティブ状態CSS表示 | 問題報告なし、正常動作と判断 | テストプレイ（2026-08-09） |
| コントロールパネル上のマウスイベント遮断（`stopPropagation`） | 問題報告なし、正常動作と判断 | テストプレイ（2026-08-09） |
| 図形削除機能（`select`ツール中の`Delete`/`Backspace`キー） | 実機で動作確認済み（削除ボタン等のUI不在による発見しにくさは別課題として次フェイズへ持ち越し） | テストプレイ（2026-08-09） |
| タスク1〜8内に累積した「中間状態」注記群（各タスク完了前後の一時的な未実装状態の説明） | 全8タスク完了により解消、記録不要と判断 | タスク1〜8 |
| `deleteShape(id)`の実装スタイル（`findIndex`+`splice`採用の理由） | 既存メソッドとの一貫性を優先した設計判断として記録のみ、対応不要 | タスク5 |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* パン機能の不在、ツール操作の直感性の低さ、削除UIの不在（キーボードのみで発見しにくい） → 「UI・操作充実フェイズ」で対応
* `line`ツール中のホバー視覚フィードバック欠如、コントロールパネルヘッダーのドラッグ移動非機能、`setTool`引数バリデーション欠如、`createToolClickHandler`の2ボタン限定実装、`keydown`の`document`購読と将来のテキスト入力UI追加時の誤爆対策 → 同上フェイズで検討
* 新規図形クラス追加時の`setVertex`/`translate`/`draw`インターフェース契約遵守、`ShapeFactory.create`の未知type時Error未キャッチ → 次の図形追加Phaseで対応
* resizeイベントのデバウンス未実装、resizeリスナーのクリーンアップ未実装、`mouseup`への`stopPropagation`未実装 → いずれも実害なしと確認済み、将来の設計変更・パフォーマンス問題顕在化時に検討
* タスク6の`handleMouseMove`/`handleMouseDown`のJSDoc説明文が`currentTool`ガード条件を反映していない軽微な記載漏れ → 次のInterruptでまとめて修正
* `main.js`のツールボタン配線を`palette/`へ切り出すか（チェック1で判明） → 次の図形パレット実装Phaseで再検討

---

### Phase01-04「フロートウィンドウシステムの構築と図形パレットの統合」（クローズ日：2026-08-09）

* DIR: `_log/dir/20260808_1952_DIR_Phase01-04_FloatWindowManager_And_PaletteP.md`
* RES: `_log/res/20260809_1212_RES_Phase01-04_FloatWindowManager_And_PaletteP.md`
* 参照元REQ群:
  * `_log/req/20260809_1157_REQ_Phase01-04_FloatWindowManager_And_PaletteP.md`（本体）
  * `_log/req/20260809_1242_REQ_PlanningUpdate_Phase01-04_PaletteExtraction.md`（PlanningUpdate：パレット配線のmain.jsからの切り出し）
  * `_log/req/20260809_1633_REQ_Interrupt_Phase01-04_DragAndPaletteSyncFix.md`（Interrupt：テストプレイ発見の3件修正）

| 項目 | 結論 | 対応箇所 |
|---|---|---|
| フロートウィンドウのドラッグが機能しない（ウィンドウ自身の`stopPropagation`が`WindowManager`自身の`window`レベル追従リスナーを遮断していた） | ドラッグ追従用の`window`の`mousemove`/`mouseup`リスナーをキャプチャフェーズ登録に変更し解消 | Interrupt `20260809_1633` |
| パレット5ボタン直接クリック時に`.active`表示が更新されない（`PaletteController`が`inputTracker`を直接呼び`applyTool`を経由しない設計だった） | `PaletteController`をコールバック（`onToolSelected`）受け取り式に変更し、`main.js`が`applyTool`自体を渡すことで全7ボタンの表示更新を一元化 | Interrupt `20260809_1633` |
| Ctrl+A・ダブルクリックでウィンドウ内テキストが選択状態になる | `.float-window`に`user-select: none;`を追加 | Interrupt `20260809_1633` |
| `main.js`にツールボタン配線を直書きする責務違反（Phase01-03から持ち越し） | `js/palette/PaletteController.js`（`js/palette/`フォルダの最初の入居者）へ切り出して解消 | PlanningUpdate `20260809_1242` / タスク5 |
| 将来`applyTool`をパレットにも使い回すと干渉するのではという懸念（タスク6の申し送り） | `PaletteController`がコールバックを受け取る設計への変更により、`applyTool`一本化で自然に解消 | Interrupt `20260809_1633` |
| top/right→left/top切替方式によるドラッグ開始時の位置ジャンプ有無 | ドラッグ修正後、ユーザーが実機で確認し問題なしと判断 | テストプレイ（2026-08-09） |
| 複数`.float-window`間のz-index最前面化の排他制御 | ユーザーが実機で確認、問題なしと判断 | テストプレイ（2026-08-09） |
| コントロールパネル／パレット内操作のCanvasへの透過（誤爆）有無 | ユーザーが実機で確認、問題なしと判断 | テストプレイ（2026-08-09） |
| 5大図形ボタン（line/curve/arc/rect/circle）での作図・スタブフォールバック動作 | ユーザーが実機で確認、いずれもLineとして正常描画、問題なしと判断 | テストプレイ（2026-08-09） |
| 選択ツールでのホバー/選択/ハンドルドラッグ/Delete削除・リサイズ追従の回帰確認 | ユーザーが実機で確認、Phase01-01〜03の既存機能に影響なしと判断 | テストプレイ（2026-08-09） |
| パレット初期配置座標（`top:320px`仮値）の重なり有無、ボタンラベル記号（`◠`等）のフォント崩れ有無、コントロールパネル/パレットの×ボタンの見た目バランス | テストプレイで問題報告なし、現状のままで問題なしと判断 | テストプレイ（2026-08-09） |
| `.disabled`の適用範囲（ルート要素全体、ヘッダーごと非活性化する設計判断） | 実害なしと確認、設計判断として確定 | タスク3/テストプレイ |
| `tool`不一致時のパレット全ボタン非アクティブ表現（`.disabled`と`.active`を独立に評価する二重非活性化構造） | 実害なしと確認、現状の実装のまま確定 | タスク5/テストプレイ |

**未解決のまま次に持ち越した項目**（`COWORK_STATUS.md`側で追跡中。ここには含めない）:
* コントロールパネルの操作モードボタン再設計（「直線ツール」の扱い。将来「キャンバス移動」等のモードも同列に追加予定のため、「図形作成」等への統合を検討） → 「UI・操作充実フェイズ」で対応（ユーザー指摘、2026-08-09）
* `WindowManager`の動的追加ウィンドウ再検知（`MutationObserver`等）非対応、単一`#draggingWindow`フィールドによる複数ウィンドウ同時ドラッグ非対応 → 将来ウィンドウを動的生成／複数同時操作するPhaseで対応
* `.disabled`クラスの意味（`opacity:0.4`+`pointer-events:none`）が将来増える他の`.float-window`種別すべてに適切か → ウィンドウ種類が増えた時点で再検討
* `PaletteController`のボタンid解決が見つからない場合に静かにフィルタされエラー化しない仕様 → 将来ボタンid命名規則を変更する際に注意
* 初期`.disabled`（`index.html`側）と`InputTracker`の初期`currentTool`（`'select'`）の暗黙的な結合 → 将来初期ツールを変更する際は両方を同期させること
* `ShapeFactory`の`curve`/`arc`/`rect`/`circle`フォールスルー`case`構造、将来矩形・円等でコンストラクタ引数の意味・個数が変わる場合の呼び出し元見直し → 次の図形追加Phaseで対応（既存の同種項目へ統合）
