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
