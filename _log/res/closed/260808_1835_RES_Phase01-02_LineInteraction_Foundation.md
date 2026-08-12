# RES: 作業計画・作業レポート (Phase 01-02) : LINEの作成・選択・再編集における入力・描画・座標基盤の確立
* 参照元REQ: `./_log/req/2608_1831_REQ_Phase01-02_LineInteraction_Foundation.md`
* 参照元REQ: `./_log/req/2608_2011_REQ_Interrupt_Phase01-02_Task5.5_ShapeVertexPolymorphism.md` ※タスク5.5として追加作業
* 参照元REQ: `./_log/req/2608_2036_REQ_PlanningUpdate_Phase01-02_Task6.5_MainJsWiring.md` ※タスク6.5として追加作業

## 1. 作業目的
Phase01-01で構築したMVC最小骨格（`VectorModel` / `CanvasManager` / `InputTracker` / `shapes/Line.js`）を土台に、LINE（直線）1種類のみを対象として「作成」「選択」「再編集」の一連の操作フローを実現する。パレット未実装の現段階では、「空白クリック＝新規作成」「既存図形クリック＝選択」という暗黙の分岐で操作モードを切り替える。

本Phaseの中心命題は、単に機能を作ることではなく、**図形種別ごとの当たり判定・描画ロジックを`Line.js`自身に完全に閉じ込め、`core/`配下（Model/Renderer/InputTracker）には一切のif/switch分岐を持ち込まない**という拡張性の担保にある。これにより将来の曲線・円・楕円追加時、`core/`を変更せず新規Shapeファイルの追加のみで対応可能な設計を実現する。

## 2. アーキテクチャ設計

### 要件1: `shapes/Line.js` の責務拡張（当たり判定・ハンドル・ホバーの自己完結化）
`Line`自身に、線分本体への当たり判定（`hitTest`）、3種のハンドル（始点/終点/移動）への当たり判定（`hitTestHandle`）、選択中のハンドル描画（`drawHandles`）、ホバー時の強調描画（`drawHover`）を実装する。`id`はコンストラクタ外から設定可能にし、採番ロジック自体は持たない（採番は`VectorModel`の責務）。`move`ハンドルは線分の中点座標から算出する。

これにより、`VectorModel`や`InputTracker`は「図形が線かどうか」を意識せず、ポリモーフィックに`shape.hitTest(...)` / `shape.hitTestHandle(...)`を呼び出すだけで済む。

#### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/shapes/` - 図形ドメイン
*   **関連する論理クラス**: `Line`（既存クラスの拡張。新規クラス追加なし）
*   **参照する責務**: `PROJECT_ARCHITECTURE.md` 4章 `shapes/` = 「図形種別ごとの定義・当たり判定。各図形が自身のプロパティと描画ロジック(`draw`メソッド)を持つ。」→ 当たり判定・ハンドル・ホバー描画もこの自己完結の原則に含める形で責務を拡張する。

---

### 要件2: `core/VectorModel.js` の状態拡張（SSOTとしての選択・ホバー・ドラフト管理）
既存の`#shapes`配列に加え、`#selectedId`・`#hoveredId`・`#draftLine`（作成中の未確定Line）を新設する。選択/ホバーの読み書きAPI（`selectShape` / `clearSelection` / `getSelectedId` / `setHovered` / `clearHovered` / `getHoveredId`）、ドラフト作成のライフサイクルAPI（`startDraft` / `updateDraft` / `commitDraft` / `cancelDraft`）、再編集用API（`updateVertex` / `moveShape`）を追加する。`commitDraft()`実行時にidを採番し`#shapes`へ確定する（採番ロジックの実体はここに置く）。すべての状態変更は既存の`#notifyChange()`パターンに乗せ、Pull型（Model→通知→CanvasManager再描画）の関係を崩さない。

#### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`
*   **関連する論理クラス**: `VectorModel`（既存クラスの拡張）
*   **参照する責務**: `PROJECT_ARCHITECTURE.md` 4章 `VectorModel.js` = 「描画データ（Shape配列）と選択状態を保持する単一の真実（SSOT）。」→ 選択状態・ホバー状態・ドラフト状態を包含する形でSSOTの範囲を明確化する。

---

### 要件3: `core/CanvasManager.js` の描画拡張（純粋レンダラーとしての引数追従）
`render(shapes, { hoveredId, selectedId, draftLine })`の形にシグネチャを拡張する。通常描画（`shape.draw(ctx)`）に加え、`hoveredId`と一致する図形には`drawHover(ctx)`を、`selectedId`と一致する図形には`drawHandles(ctx)`を追加で呼び出し、`draftLine`が存在すれば最後に重ねて描画する。`CanvasManager`は判定ロジックを一切持たず、渡された状態をそのまま描画するだけに徹する。

#### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`
*   **関連する論理クラス**: `CanvasManager`（既存クラスの拡張）
*   **参照する責務**: `PROJECT_ARCHITECTURE.md` 4章 `CanvasManager.js` = 「Canvasへの純粋な描画（レンダラーの責務）。状態は持たない。」→ 拡張後も「受け取った引数をそのまま描画するだけ」の純粋性を維持する。

---

### 要件4: `core/InputTracker.js` の状態遷移マシン導入（IDLE / DRAWING / DRAGGING_HANDLE）
内部状態として`IDLE` / `DRAWING` / `DRAGGING_HANDLE`の3状態を持つ簡易ステートマシンを導入する。各状態でのイベント処理はREQ本文の仕様通りとし、状態遷移に応じて`VectorModel`の対応するAPIを呼び出す。図形種別の判定は一切行わず、`model`から取得したshape配列に対し`shape.hitTest(...)` / `shape.hitTestHandle(...)`をポリモーフィックに呼び出すのみとする。座標変換は既存の`getLogicalCoordinate`をそのまま流用し、DPI対応・CSSズーム吸収ロジックには手を加えない。

#### 関連フォルダと論理クラス
*   **対象フォルダ**: `./js/core/`
*   **関連する論理クラス**: `InputTracker`（既存クラスの拡張）
*   **参照する責務**: `PROJECT_ARCHITECTURE.md` 4章 `InputTracker.js` = 「マウス・キーボード入力の解釈、キャンバス座標への変換。」→ 状態遷移マシンの導入により「入力の解釈」の内容を具体化する。

---

### 開発資料（PROJECT_ARCHITECTURE.md）の更新予定
4章の以下4項目は、現状「方向性のみの薄い記載」であり、本Phaseの実装により具体的な責務（保持する状態・主要メソッド）が確定するため、実装完了後に更新する：
*   `VectorModel.js`：選択状態・ホバー状態・ドラフト状態の保持と、それらを操作するAPI群を追記。
*   `CanvasManager.js`：`render`シグネチャが`{ hoveredId, selectedId, draftLine }`を受け取る旨を追記。
*   `InputTracker.js`：`IDLE` / `DRAWING` / `DRAGGING_HANDLE`の状態遷移マシンを持つ旨を追記。
*   `shapes/`：`Line.js`を「作成済み図形」として明記し、`hitTest` / `hitTestHandle` / `drawHandles` / `drawHover`という当たり判定・ハンドル描画の自己完結パターンを、今後追加される図形（曲線・円・楕円）が踏襲すべき共通インターフェースとして記載。

具体的な更新文言はタスク11の実施時に確定させる。

## 3. タスクリスト

*   [x] タスク1: `Line.js` - id設定対応 と 線分本体の当たり判定（`hitTest`）
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新
    *   **作業内容** :
        *   `id`を外部から設定可能にする（採番ロジックは持たない。既存コンストラクタ/プロパティ構成を踏まえ、最小限の変更で対応すること）。
        *   `hitTest(x, y, tolerance)`：点(x, y)と線分との距離を計算し、`tolerance`以内かどうかを返す当たり判定を実装する。
        *   JSDocコメントの記載漏れがないことを確認する（引数・戻り値・責務を明文化）。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点（toleranceの単位・妥当値など）があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク2: `Line.js` - ハンドル当たり判定・ハンドル描画・ホバー描画
    *   **対象ファイル** :
        *   `./js/shapes/Line.js` : 更新
    *   **作業内容** :
        *   `hitTestHandle(x, y, tolerance)`：始点/終点/中点（move）のいずれかへの当たり判定を行い、`'start' | 'end' | 'move' | null`を返す。
        *   `drawHandles(ctx)`：選択中に始点・終点・移動ハンドルの3種を描き分けて描画する（暫定デザインで可）。
        *   `drawHover(ctx)`：ホバー時の強調表示を描画する（暫定デザインで可）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点（ハンドル同士が近接した場合の優先順位など）があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク3: `VectorModel.js` - 選択状態・ホバー状態のAPI追加
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
    *   **作業内容** :
        *   `#selectedId` / `#hoveredId`を新設する。
        *   `selectShape(id)` / `clearSelection()` / `getSelectedId()`を実装する。
        *   `setHovered(id)` / `clearHovered()` / `getHoveredId()`を実装する。
        *   いずれも既存の`#notifyChange()`パターンに乗せる。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク4: `VectorModel.js` - ドラフト（作成中Line）のライフサイクルAPI追加
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
    *   **作業内容** :
        *   `#draftLine`を新設する。
        *   `startDraft(x, y)`：始点確定・仮`Line`インスタンス生成。
        *   `updateDraft(x, y)`：終点をカーソル位置に追従させる。
        *   `commitDraft()`：一意なidを採番し`#shapes`へ確定登録、`#draftLine`を破棄する。
        *   `cancelDraft()`：将来のキャンセル操作用に用意のみ行う（呼び出し元の実装は本Phaseのスコープ外）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点（`startDraft`直後、`updateDraft`が一度も呼ばれない場合の終点初期値など）があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク5: `VectorModel.js` - 再編集API追加（`updateVertex` / `moveShape`）
    *   **対象ファイル** :
        *   `./js/core/VectorModel.js` : 更新
    *   **作業内容** :
        *   `updateVertex(id, vertexIndex, x, y)`：絶対座標による端点の更新を実装する。
        *   `moveShape(id, dx, dy)`：相対差分による図形全体の平行移動を実装する。
        *   いずれも既存の`#notifyChange()`パターンに乗せる。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク5.5: shapeへの頂点操作の委譲（ポリモーフィック化）
    *   詳細は本ドキュメント末尾を参照

*   [x] タスク6: `CanvasManager.js` - `render`シグネチャ拡張
    *   **対象ファイル** :
        *   `./js/core/CanvasManager.js` : 更新
    *   **作業内容** :
        *   `render(shapes, { hoveredId, selectedId, draftLine })`の形にシグネチャを拡張する。
        *   通常描画（`shape.draw(ctx)`）後、`hoveredId`一致図形の`drawHover(ctx)`、`selectedId`一致図形の`drawHandles(ctx)`を呼び出す。
        *   `draftLine`が存在する場合、最後に重ねて描画する。
        *   `CanvasManager`が状態を一切保持しないことを確認する（引数をそのまま描画するのみ）。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク6.5: `main.js` - `render`呼び出しへの状態配線
    *   詳細は本ドキュメント末尾を参照

*   [x] タスク7: `InputTracker.js` - 状態遷移マシンの基盤導入
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   内部状態（`IDLE` / `DRAWING` / `DRAGGING_HANDLE`）を表す状態変数を新設する。
        *   ドラッグ中の「直前のカーソル座標」を一時保持するための内部変数を新設する（moveハンドルの差分計算用）。
        *   既存の`getLogicalCoordinate`メソッドに一切手を加えず、そのまま各状態のハンドラから呼び出せることを確認する。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク8: `InputTracker.js` - `IDLE`状態のイベント処理実装
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `mousemove`時、`model`のshape配列に対し`shape.hitTest(...)`をポリモーフィックに呼び出してホバー判定を行い、`model.setHovered(id)` / `model.clearHovered()`を呼ぶ。
        *   選択中図形がある場合、ハンドル位置での`mousedown`を`shape.hitTestHandle(...)`で検知し、得られたハンドル種別（start/end/move）を記憶した上で`DRAGGING_HANDLE`へ遷移する。
        *   空白部分のクリックで`model.startDraft(x, y)`を呼び`DRAWING`へ遷移する。
        *   ホバー中の図形のクリックで`model.selectShape(id)`を呼ぶ。
        *   選択中に空白部分をクリックした場合`model.clearSelection()`を呼ぶ。
        *   図形種別のif/switch分岐を一切書かないことを確認する。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点（ホバー判定とハンドル判定が競合するケースの優先順位など）があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク9: `InputTracker.js` - `DRAWING`状態のイベント処理実装
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `mousemove`時、`model.updateDraft(x, y)`を呼ぶ。
        *   クリック時、`model.commitDraft()`を呼び`IDLE`へ遷移する。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク10: `InputTracker.js` - `DRAGGING_HANDLE`状態のイベント処理実装
    *   **対象ファイル** :
        *   `./js/core/InputTracker.js` : 更新
    *   **作業内容** :
        *   `mousemove`時、start/endハンドルの場合は現在の論理座標をそのまま`model.updateVertex(id, vertexIndex, x, y)`へ渡す。
        *   `mousemove`時、moveハンドルの場合は直前のカーソル位置との差分(dx, dy)を`model.moveShape(id, dx, dy)`へ渡し、直前カーソル座標を更新する。
        *   `mouseup`時、`IDLE`へ遷移する。
        *   JSDocコメントの記載漏れがないことを確認する。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
        *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*   [x] タスク11: 開発資料（PROJECT_ARCHITECTURE.md）の確認・更新（固定タスク）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` : 更新（影響がある場合のみ）
    *   **作業内容** :
        *   タスク1〜10の実装内容が「2. アーキテクチャ設計」記載の更新予定（`VectorModel.js` / `CanvasManager.js` / `InputTracker.js` / `shapes/`の4章記載）に影響するかを確認する。
        *   影響がある場合、4章の該当箇所を実装結果に合わせて更新する。影響がない場合は本タスクを完了のみとし、資料更新は行わない。
        *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細（更新有無とその理由）を追記する。

## 4. 詳細作業内容

### タスク1: `Line.js` - id設定対応 と 線分本体の当たり判定（`hitTest`）
*   **対象ファイル**: `./js/shapes/Line.js`
*   **実施内容**:
    *   コンストラクタ内に `this.id = null;` を追加した。採番ロジックは持たせず、外部（`VectorModel`）から `line.id = ...` の形でプロパティに直接代入する運用とする（セッターメソッドは設けず、既存のパブリックプロパティ構成に合わせた最小限の変更とした）。
    *   `hitTest(x, y, tolerance)` を実装した。点から線分への最短距離を「線分上の最近接点（クランプ付き射影）」を求める方式で計算し、`tolerance`以内であれば`true`を返す。線分の長さが0（始点=終点）の場合は始点との距離で判定するようゼロ除算を回避した。
    *   JSDocを追加し、`id`プロパティおよび`hitTest`の引数・戻り値・責務を明文化した。

### タスク1: 動作確認
*   `hitTest`は本タスク単体では呼び出し元（`InputTracker`）が未実装のため、目視でのブラウザ動作確認は次タスク以降（タスク7〜9）でのポリモーフィック呼び出し実装後にまとめて行う想定。ロジック自体は点と線分の距離公式に基づく標準的な実装であり、単体でのコードレビューにより正当性を確認した。

### タスク2: `Line.js` - ハンドル当たり判定・ハンドル描画・ホバー描画
*   **対象ファイル**: `./js/shapes/Line.js`
*   **実施内容**:
    *   `hitTestHandle(x, y, tolerance)` を実装した。始点(`x1, y1`)・終点(`x2, y2`)・移動ハンドル（線分の中点）それぞれとの距離を`Math.hypot`で計算し、`tolerance`以内であれば対応する`'start' | 'end' | 'move'`を返す。いずれにも該当しなければ`null`を返す。判定順序は`start → end → move`とし、複数のハンドルが同時にtolerance以内となる場合は先着（`start`優先）の1件のみを返す仕様とした。
    *   `drawHandles(ctx)` を実装した。始点・終点ハンドルは正方形（一辺8px、白塗り＋青枠）、移動ハンドル（中点）は円（直径8px、同配色）で描き分け、視覚的に区別できるようにした（暫定デザイン）。
    *   `drawHover(ctx)` を実装した。本体の線と同じ経路に、半透明の青色（`rgba(74, 144, 226, 0.4)`）かつ本体より6px太い線を重ね描きすることで強調表示とした（暫定デザイン）。
    *   ファイル先頭のJSDoc責務定義を「直線のデータ保持とCanvasへの描画処理を担う。」から「直線のデータ保持・Canvasへの描画処理・当たり判定を担う。」へ更新した。タスク1で追加した`hitTest`および本タスクで追加した`hitTestHandle`により、当たり判定が`Line`の実質的な第3の責務となったため、`PROJECT_CONSTITUTION.md`の「責務が増える場合は定義自体を更新する」という趣旨に従い同期した。
    *   3メソッドすべてにJSDocを追加し、引数・戻り値・責務を明文化した。

### タスク2: 動作確認
*   `hitTestHandle` / `drawHandles` / `drawHover` の3メソッドは、いずれも呼び出し元（`VectorModel`のタスク3〜5、`InputTracker`のタスク7〜10、`CanvasManager`のタスク6）が未実装のため、本タスク単体でのブラウザ目視確認はできない。ロジック・描画コードのコードレビューにより、REQ本文の仕様（ハンドル3種の描き分け、ホバー強調表示）との整合性を確認した。実際の見た目・操作感の目視確認は、関連タスク完了後にまとめて行う想定。

### タスク3: `VectorModel.js` - 選択状態・ホバー状態のAPI追加
*   **対象ファイル**: `./js/core/VectorModel.js`
*   **実施内容**:
    *   `#selectedId` / `#hoveredId` を新設し、コンストラクタで`null`初期化した。
    *   `selectShape(id)` / `clearSelection()` / `getSelectedId()` を実装した。`selectShape`・`clearSelection`はいずれも既存の`#notifyChange()`パターンに乗せ、値が変化したかどうかに関わらず常に通知する（既存の`addShape`と同じ無条件通知の方針に合わせた）。
    *   `setHovered(id)` / `clearHovered()` / `getHoveredId()` を実装した。実装方針は選択状態のAPI群と同一（無条件通知）。
    *   `selectShape(id)` / `setHovered(id)` は、渡された`id`が`#shapes`内に実在するかの検証は行わない（純粋なsetterとして実装）。存在確認は呼び出し元（`InputTracker`、タスク8）の責務とした。
    *   6メソッドすべてにJSDocを追加し、引数・戻り値・責務を明文化した。

### タスク3: 動作確認
*   `selectShape` / `clearSelection` / `getSelectedId` / `setHovered` / `clearHovered` / `getHoveredId` は、いずれも呼び出し元（`InputTracker`のタスク8〜10、`CanvasManager`のタスク6）が未実装のため、本タスク単体でのブラウザ目視確認はできない。コードレビューにより、既存の`#notifyChange()`パターンとの整合性、および`#shapes`同様プライベートフィールドとして完全にカプセル化されていることを確認した。

### タスク4: `VectorModel.js` - ドラフト（作成中Line）のライフサイクルAPI追加
*   **対象ファイル**: `./js/core/VectorModel.js`
*   **実施内容**:
    *   `Line`を`../shapes/Line.js`からimportした（`VectorModel`が図形種別を判定する分岐は持たないが、「LINEの作成」という操作自体はREQで明示された本Phaseの要件であるため、draft生成時のインスタンス化のみ許容）。
    *   `#draftLine`（初期値`null`）、および採番用の`#nextId`（初期値`1`）を新設した。
    *   `startDraft(x, y)`：始点・終点が同一座標（`x1=x2, y1=y2`）の仮`Line`を生成し`#draftLine`へ格納する。
    *   `updateDraft(x, y)`：`#draftLine`が存在する場合のみ、その`x2, y2`をカーソル位置に更新する。
    *   `commitDraft()`：`#draftLine`が存在する場合のみ、`` `shape-${#nextId++}` ``形式のidを採番して付与し、`#shapes`へpushした上で`#draftLine`を`null`に戻す。
    *   `cancelDraft()`：`#draftLine`が存在する場合のみ、確定せずに`null`へ戻す（呼び出し元からの利用は本Phaseのスコープ外のため未接続）。
    *   `getDraftLine()`：`#draftLine`を取得する。REQ本文には明記がなかったが、`CanvasManager`（タスク6）が`draftLine`を描画するために必要な最小限のgetterであり、既存の`getSelectedId` / `getHoveredId`と同一パターンのため追加した。
    *   `startDraft` / `updateDraft` / `commitDraft` / `cancelDraft`はいずれも状態変化時に既存の`#notifyChange()`を呼ぶ。`updateDraft` / `commitDraft` / `cancelDraft`は`#draftLine`が`null`の場合は何もせず`#notifyChange()`も呼ばない（無条件通知としない）。
    *   JSDocを追加し、全メソッド・フィールドの引数・戻り値・責務を明文化した。

### タスク4: 動作確認
*   `startDraft` / `updateDraft` / `commitDraft` / `cancelDraft` / `getDraftLine`は、いずれも呼び出し元（`InputTracker`のタスク7〜9、`CanvasManager`のタスク6）が未実装のため、本タスク単体でのブラウザ目視確認はできない。コードレビューにより、`#draftLine`が存在しない場合の早期returnガード、idの一意性（連番カウンタ）、`#notifyChange()`との整合性を確認した。

### タスク5: `VectorModel.js` - 再編集API追加（`updateVertex` / `moveShape`）
*   **対象ファイル**: `./js/core/VectorModel.js`
*   **実施内容**:
    *   `updateVertex(id, vertexIndex, x, y)` を実装した。`#shapes`からidが一致する図形を`find`で検索し、存在しない場合は何もせず`#notifyChange()`も呼ばずに早期returnする（タスク4の`updateDraft`等と同じガード付き通知パターン）。`vertexIndex === 0`なら`x1, y1`を、`vertexIndex === 1`なら`x2, y2`を絶対座標で上書きする。`0`・`1`以外の値が渡された場合も何もせず早期returnする。
    *   `moveShape(id, dx, dy)` を実装した。同様に`find`で対象図形を検索し、存在しなければ早期return。存在すれば`x1, y1, x2, y2`すべてに`dx, dy`を加算する相対移動を行う。
    *   両メソッドとも、REQ本文・RES設計（要件2）で対象ファイルが`VectorModel.js`のみと明記されており`shapes/Line.js`の変更はタスクスコープ外だったため、`Line`が持つ`x1, y1, x2, y2`プロパティに`VectorModel`側から直接アクセスする実装とした（詳細は「5. 懸念事項」に後述）。
    *   2メソッドともJSDocを追加し、引数・戻り値・責務、および将来の設計上の注意点をコメントとして明文化した。

### タスク5: 動作確認
*   `updateVertex` / `moveShape` は、いずれも呼び出し元（`InputTracker`のタスク10）が未実装のため、本タスク単体でのブラウザ目視確認はできない。コードレビューにより、存在しないidを渡した場合の早期returnガード、`vertexIndex`が0/1以外の場合のガード、`dx, dy`加算による相対移動ロジックの正当性を確認した。実際の操作感（ドラッグによる再編集）の目視確認は、タスク10完了後にまとめて行う想定。

### タスク5.5: shapeへの頂点操作の委譲（ポリモーフィック化）
*   詳細は本ドキュメント末尾を参照

### タスク6: `CanvasManager.js` - `render`シグネチャ拡張
*   **対象ファイル**: `./js/core/CanvasManager.js`
*   **実施内容**:
    *   `render(shapes, state)`のシグネチャを拡張した。第2引数は`{ hoveredId = null, selectedId = null, draftLine = null } = {}`という分割代入デフォルト値付きの形とし、引数自体を省略した場合（旧シグネチャでの呼び出し）でも例外が発生しないようにした。
    *   既存の描画ループ内で、各`shape`について`shape.draw(ctx)`実行後、`shape.id === hoveredId`であれば`shape.drawHover(ctx)`を、`shape.id === selectedId`であれば`shape.drawHandles(ctx)`を追加で呼び出す形とした（1図形につき1回のループ内でdraw→hover判定→handles判定を行う実装とし、2種類の判定のために配列を2回走査するような無駄は避けた）。
    *   `draftLine`が渡されている（truthyである）場合、通常図形の描画ループが終わった後に`draftLine.draw(ctx)`を呼び出し、最後に重ねて描画する形とした。`draftLine`自体はホバー・選択の対象ではない（作成中で未確定のため`hoveredId`/`selectedId`と一致しうる`id`を持たない）ため、`drawHover`/`drawHandles`は呼び出さず`draw`のみとした。
    *   `CanvasManager`は本タスクの実装後も内部に状態を一切保持していないことを確認した（`hoveredId`/`selectedId`/`draftLine`はいずれも引数として受け取り、呼び出しの都度使い切るのみで、インスタンスフィールドへの保存は行っていない）。図形種別の判定（if/switchによるtype分岐）も一切行わず、`shape.id`との一致判定と、`shape.draw`/`drawHover`/`drawHandles`/`draftLine.draw`のポリモーフィックな呼び出しのみで完結している。
    *   JSDocを更新し、拡張後の第2引数（`state.hoveredId`/`state.selectedId`/`state.draftLine`）の型・省略可否・責務を明文化した。

### タスク6: 動作確認
*   呼び出し元の`main.js`は本タスクのスコープ外（RES対象ファイルに`main.js`は含まれていない）のため、現時点では`canvasManager.render(model.getShapes())`という第2引数省略の旧来の呼び出し方のまま残っている。デフォルト値付きの分割代入により、この状態でもエラーは発生せず、`hoveredId`/`selectedId`/`draftLine`はいずれも`null`として扱われ、通常描画のみが行われることをコードレビューで確認した。ホバー強調・ハンドル描画・ドラフト描画の実際のブラウザ目視確認は、`InputTracker`側の状態遷移実装（タスク7〜10）および`main.js`側で`model`の状態を`render`へ渡す配線が完了した後にまとめて行う想定。

### タスク6.5:  `main.js` - `render`呼び出しへの状態配線
*   詳細は本ドキュメント末尾を参照

### タスク7: `InputTracker.js` - 状態遷移マシンの基盤導入
*   **対象ファイル**: `./js/core/InputTracker.js`
*   **実施内容**:
    *   内部状態（`IDLE` / `DRAWING` / `DRAGGING_HANDLE`）を表す定数として、モジュールスコープに`InputState`オブジェクト（`{ IDLE: 'IDLE', DRAWING: 'DRAWING', DRAGGING_HANDLE: 'DRAGGING_HANDLE' }`）を新設し`export`した。タスク8〜10で`InputTracker`本体から各状態を参照・比較する際に使うことを見越し、クラス外部からもimport可能な形とした（`InputTracker`クラス自体はこれまで通りdefault exportではなく名前付きexportのまま変更していない）。
    *   コンストラクタ内に`this.state = InputState.IDLE;`を追加した。初期状態は`IDLE`とした（REQ本文・RES設計とも初期状態の明記はなかったが、「何も操作していない待機状態」が起動直後の自然な状態であるため）。
    *   コンストラクタ内に`this.lastCursor = null;`を追加した。moveハンドルドラッグ時（タスク10）の差分計算用に、直前のカーソル論理座標を保持するための一時変数で、`DRAGGING_HANDLE`状態以外では未使用（`null`のまま）である旨をJSDocコメントに明記した。
    *   既存の`getLogicalCoordinate`メソッドには一切手を加えていない。本タスクで新設した状態変数はメソッド内から未参照であり、タスク8〜10の各状態ハンドラから今まで通り呼び出し可能なことをコードレビューで確認した。
    *   既存の`handleClick`（ダミーLine生成ロジック）にも一切手を加えていない。タスク7は状態変数の新設のみがスコープであり、イベントハンドラの状態別実装はタスク8〜10のスコープであるため、現時点では意図的に旧来のダミー実装のまま残している。
    *   `InputState`・`this.state`・`this.lastCursor`それぞれにJSDocを追加し、責務（状態遷移マシンの起点、moveハンドル差分計算用の一時変数）を明文化した。ファイル先頭の責務定義（「ユーザー入力の解釈とModelへの反映を担う。」）は、状態遷移マシンの導入も「入力の解釈」の具体化の範囲内であり新責務ではないと判断し、更新不要とした。

### タスク7: 動作確認
*   `this.state` / `this.lastCursor` / `InputState`は、いずれも参照元（タスク8〜10の状態別イベントハンドラ）が未実装のため、本タスク単体でのブラウザ目視確認（状態遷移の挙動確認）はできない。ブラウザで`index.html`を読み込み、コンソールエラーが発生しないこと（`InputState`の構文・importエラーがないこと）、および既存の`handleClick`によるダミーLine生成が従来通り動作すること（クリックでLineが追加されること）をコードレビューおよび目視で確認した。状態遷移そのものの目視確認は、タスク8〜10実装後にまとめて行う想定。

### タスク8: `InputTracker.js` - `IDLE`状態のイベント処理実装
*   **対象ファイル**: `./js/core/InputTracker.js`
*   **実施内容**:
    *   旧`handleClick`（クリック位置から+50,+50固定のダミーLineを生成する仮実装）と、それを登録していた`this.canvas.addEventListener('click', this.handleClick.bind(this))`を完全に削除した。ダミーLine生成に使っていた`import { Line } from '../shapes/Line.js';`も未使用となったため削除した（`Line`のインスタンス化は`VectorModel.startDraft`内に閉じており、`InputTracker`が`Line`を直接importする必要がなくなった）。
    *   新たに`mousemove` / `mousedown` / `click`の3種のイベントリスナーをコンストラクタで登録し、それぞれ`handleMouseMove` / `handleMouseDown` / `handleClick`（新実装、旧実装とは別内容）へ紐付けた。
    *   `handleMouseMove(event)`：`this.state !== InputState.IDLE`であれば即returnする（DRAWING/DRAGGING_HANDLE状態でのmousemove処理は次タスク9・10のスコープ）。IDLE状態であれば、`model.getShapes()`で取得した図形配列に対し`shape.hitTest(x, y, this.hitTolerance)`をポリモーフィックに呼び出し、該当図形があれば`model.setHovered(id)`を、なければ`model.clearHovered()`を呼ぶ。図形種別のif/switch分岐は一切書いていない。
    *   `handleMouseDown(event)`：`this.state !== InputState.IDLE`であれば即return。`model.getSelectedId()`が`null`（未選択）であれば即return。選択中idに対応する図形を`model.getShapes()`から`find`で取得し（見つからなければ即return）、その図形へ`shape.hitTestHandle(x, y, this.hitTolerance)`をポリモーフィックに呼び出す。ハンドルに該当すれば、戻り値（`'start'|'end'|'move'`）を`this.activeHandle`、選択中idを`this.activeShapeId`、現在の論理座標を`this.lastCursor`（タスク7で用意済みの器）へ記憶した上で`this.state = InputState.DRAGGING_HANDLE`へ遷移する。該当しなければ何もしない（IDLEのまま）。
    *   `handleClick(event)`（新実装）：`this.state !== InputState.IDLE`であれば即return。`model.getHoveredId()`を取得し、ホバー中の図形があれば`model.selectShape(hoveredId)`を呼んで終了する（空白クリックの判定はホバー状態を流用し、`mousemove`で継続的に更新される`hoveredId`の有無で行う設計とした）。ホバー中の図形がない（空白部分のクリック）場合は、まず`model.getSelectedId()`が存在すれば`model.clearSelection()`を呼び、続けて`model.startDraft(x, y)`を呼んで`this.state = InputState.DRAWING`へ遷移する。
    *   `this.activeHandle` / `this.activeShapeId`はタスク7時点では未定義だったため、本タスクで新設した（`DRAGGING_HANDLE`状態への遷移に不可欠な、操作対象を特定するための情報であり、タスク10で実際に参照される想定）。それぞれJSDocを追加し、責務と有効な状態（DRAGGING_HANDLE中のみ使用）を明文化した。
    *   当たり判定の許容誤差として`this.hitTolerance = 5`（論理座標系のピクセル単位）をコンストラクタで新設した。`hitTest`（線分本体）・`hitTestHandle`（ハンドル）の両方で共用する値とし、JSDocに単位・用途を明記した。
    *   `handleMouseMove` / `handleMouseDown` / `handleClick`の3メソッドすべてにJSDocを追加し、引数・IDLE以外の状態での早期returnの扱い・責務を明文化した。図形種別に関するif/switch分岐が存在しないことをコードレビューで確認した。

### タスク8: 動作確認
*   `python -m http.server`でプロジェクトルートを配信し、ブラウザプレビュー環境で`index.html`を読み込んで確認した。読み込み時点でコンソールエラーは発生しなかった。
*   実際の`editor-canvas`要素に対し`mousemove`→`mousedown`→`mouseup`→`click`の順でDOMイベントを発火させ（空白部分の座標）、`main.js`で結線された実際の`InputTracker`インスタンス経由で一連の処理が実行されることを確認した。この際もコンソールエラーは発生しなかった（旧`handleClick`の削除・新イベントリスナーへの置換が正しく反映されていることの間接確認）。
*   タスク9（`DRAWING`状態での`commitDraft`実装）が未実装のため、UI操作のみで「既存図形を確定させてからホバー・選択・ハンドル操作を通しで確認する」ことは本タスク時点ではできない。この制約を踏まえ、ブラウザのコンソールから`InputTracker.js`と`shapes/Line.js`をモジュールとして直接importし、モック（フェイク）の`canvas`・`model`オブジェクトを用いて`InputTracker`単体の分岐網羅テストを実施した。結果は以下の通り、すべて設計通りの挙動を示した：
    1.  既存図形の本体上へ`mousemove` → `model.setHovered('shape-1')`が呼ばれ、状態は`IDLE`を維持。
    2.  ホバー中に`click` → `model.selectShape('shape-1')`が呼ばれ、状態は`IDLE`を維持。
    3.  図形から離れた位置へ`mousemove` → `model.clearHovered()`が呼ばれる。
    4.  選択中図形の始点ハンドル位置へ`mousedown` → `this.state`が`DRAGGING_HANDLE`へ遷移し、`this.activeHandle === 'start'`、`this.activeShapeId === 'shape-1'`、`this.lastCursor`にmousedown時の座標が記憶されることを確認。
    5.  図形が選択済みの状態で空白部分へ`click` → `model.clearSelection()`→`model.startDraft(x, y)`の順に呼ばれ、状態が`DRAWING`へ遷移することを確認。
    6.  `DRAWING`状態へ遷移した後、続けて空白部分への`click`や`mousemove`を発火させても、`handleClick` / `handleMouseMove`内の`state !== InputState.IDLE`ガードにより`model`への呼び出しが一切追加発生しないこと（IDLE以外の状態ではタスク8の実装範囲が無反応のままであること）を確認した。
*   検証用に起動した`python -m http.server`は確認後に停止し、恒久設定への追加は行っていない。

### タスク9: `InputTracker.js` - `DRAWING`状態のイベント処理実装
*   **対象ファイル**: `./js/core/InputTracker.js`
*   **実施内容**:
    *   `handleMouseMove(event)`の冒頭に`this.state === InputState.DRAWING`の分岐を追加した。`DRAWING`状態の場合は`getLogicalCoordinate(event)`で得た論理座標をそのまま`model.updateDraft(x, y)`へ渡し、即returnする（既存のIDLE状態向けホバー判定ロジックより手前に置くことで、状態ごとの処理を完全に分離した）。既存のIDLE状態向け分岐（`state !== InputState.IDLE`なら早期return）は変更していない。
    *   `handleClick(event)`の冒頭に`this.state === InputState.DRAWING`の分岐を追加した。`DRAWING`状態の場合は`model.commitDraft()`を呼び出した後、`this.state = InputState.IDLE`へ遷移し、即returnする。既存のIDLE状態向け分岐（ホバー中図形の選択／空白クリックでの新規Draft開始）はその後段にそのまま残しており、変更していない。
    *   `DRAWING`状態では図形種別のif/switch分岐は一切行っていない（`model.updateDraft` / `model.commitDraft`という`VectorModel`の既存APIをそのまま呼び出すのみ）。
    *   両メソッドともJSDocを更新し、`DRAWING`状態での処理内容（updateDraftへの委譲／commitDraftによる確定とIDLEへの復帰）を追記した。
    *   タスク7時点で「旧`handleClick`（ダミーLine生成）が未置換のまま残存」として記載されていた懸念事項は、タスク8実施時点で既に解消済み（旧ダミー実装・旧イベントリスナー登録は完全に削除され、現在の`handleClick`は本タスクで拡張した新実装のみが存在する）であることをコードレビューで再確認した。

### タスク9: 動作確認
*   `python -m http.server`で一時的にプロジェクトルートを配信し、ブラウザプレビュー環境で`index.html`を読み込んで確認した。読み込み時点でコンソールエラーは発生しなかった。
*   `editor-canvas`要素に対し実際のDOMイベント（`mousemove` / `click`）を発火させ、`main.js`で結線された実際の`InputTracker` / `VectorModel` / `CanvasManager`の連携を通しで確認した。結果は以下の通り、いずれも設計通りの挙動を示した：
    1.  空白部分（論理座標(20,20)）へ`click` → `model.startDraft(20, 20)`が呼ばれ`DRAWING`へ遷移。続けて(120,120)へ`mousemove` → `model.updateDraft(120, 120)`が呼ばれ、始点(20,20)〜終点(120,120)の線分の中点(70,70)に該当するピクセルが描画色（黒）に変化することを`getImageData`で確認した（ドラフト線がカーソルに追従することの間接確認）。
    2.  続けて(120,120)へ`click` → `model.commitDraft()`が呼ばれ`#shapes`へ確定登録された後`IDLE`へ復帰し、中点(70,70)のピクセルが引き続き描画色のまま残ることを確認した（確定後も線が消えないこと）。
    3.  `IDLE`復帰の確認として、別の空白部分（(300,300)〜(350,350)）へ同様の`click`→`mousemove`→`click`の手順を実施し、1本目と同じく新規Draft開始・追従・確定が問題なく行われることを確認した（`DRAWING`状態から`IDLE`へ正しく戻っていなければ2本目のDraft開始自体が発生しないため、これによって状態復帰を間接的に確認した）。
    4.  1本目の線の中点(70,70)へ`mousemove`（ホバー判定）→`click`を発火させ、`model.selectShape(...)`経由でハンドル（始点(20,20)位置に白塗り正方形）が描画されることを`getImageData`で確認した。これは、コミット後に状態が確実に`IDLE`へ戻っており、`IDLE`状態本来のホバー・選択処理が正常に機能していることの確認を兼ねる。
*   検証用に起動した`python -m http.server`は確認後に停止し、恒久設定への追加は行っていない。

### タスク10: `InputTracker.js` - `DRAGGING_HANDLE`状態のイベント処理実装
*   **対象ファイル**: `./js/core/InputTracker.js`
*   **実施内容**:
    *   `handleMouseMove(event)`に`this.state === InputState.DRAGGING_HANDLE`の分岐を、既存の`DRAWING`分岐の直後・`IDLE`向けガードの手前に追加した（タスク9で確立した「各状態の分岐を上から順に並べる」パターンを踏襲）。
        *   `this.activeHandle === 'move'`の場合：現在の論理座標と`this.lastCursor`との差分（`dx, dy`）を算出し`model.moveShape(this.activeShapeId, dx, dy)`へ渡した後、`this.lastCursor`を現在座標で更新する。
        *   `this.activeHandle`が`'start'`または`'end'`の場合：`this.activeHandle === 'start' ? 0 : 1`で`vertexIndex`を算出し、現在の論理座標をそのまま`model.updateVertex(this.activeShapeId, vertexIndex, x, y)`へ渡す（タスク5の懸念事項に記載されていた「start/endを0/1へ正しくマッピングする」責務を本タスクで実装した）。
    *   `handleMouseUp(event)`を新設した。`this.state !== InputState.DRAGGING_HANDLE`であれば即returnし、それ以外（＝`DRAGGING_HANDLE`中）であれば`this.state = InputState.IDLE`へ遷移するのみのシンプルな実装とした。`activeHandle` / `activeShapeId` / `lastCursor`のクリアはREQ本文に明記がなく、次回`mousedown`でのDRAGGING_HANDLE再突入時に必ず上書きされる値であるため、本タスクでは行っていない（詳細は「5. 懸念事項・要確認ポイント」に記載）。
    *   コンストラクタに`this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));`を追加した。
    *   `DRAGGING_HANDLE`状態の処理においても図形種別のif/switch分岐は一切行っていない（`activeHandle`の`'start'|'end'|'move'`という値の分岐のみであり、Shapeの型を判定するものではない。`model.updateVertex` / `model.moveShape`という`VectorModel`の既存APIをそのまま呼び出すのみ）。
    *   `handleMouseMove`のJSDocを更新し、`DRAGGING_HANDLE`状態での処理内容を追記した。`handleMouseUp`には新規JSDocを追加した。
    *   ユーザーからの追加指示に基づき、旧`handleClick`（ダミーLine生成の仮実装）およびそれを登録していた旧イベントリスナーが新実装に置き換わった状態のまま残っていないかを再確認した。タスク8実施時点で既に完全に削除・置換済みであり、現存する`handleClick`・そのイベントリスナー登録はいずれも新実装のみであることを`grep`で確認した（重複や旧実装の残存なし）。

### タスク10: 動作確認
*   `.claude/launch.json`に`python -m http.server 8000`を起動する一時設定を作成し、Browserツールでプレビューを起動して`index.html`を読み込んだ。読み込み時点でコンソールエラーは発生しなかった。
*   実際の`editor-canvas`要素に対し、`getBoundingClientRect`のスケールを加味した座標変換を行った上でDOMイベント（`click` / `mousemove` / `mousedown` / `mouseup`）を発火させ、`main.js`で結線された実際の`InputTracker` / `VectorModel` / `CanvasManager`の連携を通しで確認した。`getImageData`によるピクセル確認の結果は以下の通り、いずれも設計通りの挙動を示した：
    1.  **start ハンドルのドラッグ**：線分(50,50)-(150,150)を作成・選択し、始点ハンドル(50,50)へ`mousedown`→(80,80)へ`mousemove`→`mouseup`を実行。旧位置(50,50)周辺のハンドル描画ピクセルが消え、新位置(80,80)周辺に青枠ハンドルのピクセルが新規に描画されたことを確認した（`updateVertex(id, 0, x, y)`による始点の絶対座標更新が正しく反映されていることの確認）。
    2.  **mouseup による IDLE 復帰**：上記のドラッグ操作後、まず`mousemove`（ホバー判定）を経由せずに`click`のみを空白部分へ発火した際は、直前の`hoveredId`が選択中図形のまま残っていたため再選択が起きるのみで空白クリックとして扱われなかった（タスク8時点で既知の「空白判定にホバー状態を流用」という設計上の制約が、状態遷移そのものとは独立した挙動として再現されただけであり、`DRAGGING_HANDLE`→`IDLE`の遷移自体は正しく完了していることを別途確認した）。空白部分へ`mousemove`を先に発火してから`click`した場合は、選択解除・新規Draft開始・Draft追従のいずれも正常に動作し、`mouseup`によって状態が確実に`IDLE`へ復帰していることを確認した。
    3.  **move ハンドルのドラッグ**：別の線分(300,300)-(350,350)を作成・選択し、中点（moveハンドル、325,325）へ`mousedown`→(335,345)へ`mousemove`（差分`dx=10, dy=20`）→`mouseup`を実行。旧始点(300,300)周辺のピクセルが消え、新始点(310,320)相当の位置・新中点(335,345)にハンドルが移動していることを確認した（`moveShape(id, dx, dy)`による図形全体の相対平行移動、および`this.lastCursor`の更新が正しく機能していることの確認）。
    4.  旧`handleClick`（ダミーLine生成）およびその旧イベントリスナー登録が残存していないことを`grep`で確認した（`handleClick`の出現箇所はイベントリスナー登録1箇所・新実装のメソッド定義1箇所のみ）。
*   検証用に起動した`.claude/launch.json`・`python -m http.server`は確認後にサーバーを停止し、`.claude/launch.json`自体も削除した（タスク8・9と同様、恒久設定への追加は行わない方針を踏襲）。

### タスク11: 開発資料（PROJECT_ARCHITECTURE.md）の確認・更新（固定タスク）
*   **対象ファイル**: `./PROJECT_ARCHITECTURE.md`
*   **実施内容**:
    *   実装完了済みのタスク1〜10（`shapes/Line.js`・`core/VectorModel.js`・`core/CanvasManager.js`・`core/InputTracker.js`、およびタスク5.5・タスク6.5のInterrupt/PlanningUpdateを含む）の最終的なソースコード（[Line.js](../../js/shapes/Line.js)、[VectorModel.js](../../js/core/VectorModel.js)、[CanvasManager.js](../../js/core/CanvasManager.js)、[InputTracker.js](../../js/core/InputTracker.js)）を直接確認した結果、「2. アーキテクチャ設計」記載の更新予定（`VectorModel.js`/`CanvasManager.js`/`InputTracker.js`/`shapes/`の4章記載）に**影響あり**と判断し、4章を実装結果に合わせて更新した。
    *   **`VectorModel.js`**：`#selectedId`/`#hoveredId`/`#draftLine`の保持、選択・ホバーの読み書きAPI、ドラフトのライフサイクルAPI（`startDraft`/`updateDraft`/`commitDraft`/`cancelDraft`/`getDraftLine`）、および再編集用API（`updateVertex`/`moveShape`）が**タスク5.5のポリモーフィック化を経た最終形**（`shape.setVertex(...)`/`shape.translate(...)`への委譲）で機能する旨を追記した。
    *   **`CanvasManager.js`**：`render(shapes, { hoveredId, selectedId, draftLine } = {})`という拡張後のシグネチャ、`drawHover`/`drawHandles`のポリモーフィックな追加呼び出し、`draftLine`の重ね描画、第2引数省略可能である旨を追記した。
    *   **`InputTracker.js`**：`IDLE`/`DRAWING`/`DRAGGING_HANDLE`の3状態を持つ状態遷移マシンである旨、各状態の役割、図形種別のif/switch分岐を持たずポリモーフィックな呼び出しのみで完結している旨を追記した。
    *   **`shapes/`**：`Line.js`を「作成済み図形」として明記し、当たり判定・ハンドル・ホバー・頂点操作の共通インターフェース（`hitTest`/`hitTestHandle`/`drawHandles`/`drawHover`/`setVertex`/`translate`の6メソッド）を列挙した。今後追加する図形（曲線・円・楕円）もこの6メソッドを実装すれば`core/`側の変更なしに同一フローへ組み込める旨を明記した。
    *   本タスクの対象は「2. アーキテクチャ設計」記載の更新予定4項目（＝4章の該当箇所）のみであり、1〜3章および4章のうち`palette/`・`CodeExporter.js`・`CodeImporter.js`の記載（本Phaseで未着手）には一切手を加えていない。

### タスク11: 動作確認
*   本タスクはドキュメント更新のみでソースコードの変更を伴わないため、ブラウザでの動作確認は対象外と判断した。更新内容が実装（タスク1〜10、タスク5.5、タスク6.5）の最終コードと相違ないことを、該当4ファイルの現物を読み直すコードレビューによって確認した。

（タスク11をもって、Phase01-02のタスクリストは全項目が完了した。）

## 5. 懸念事項・要確認ポイント
*   **toleranceの具体値**：`hitTest` / `hitTestHandle`の`tolerance`（許容誤差）は、REQ本文に具体的な数値の指定がない。実装時に妥当な値（例: 5px前後）を決定し、論理座標系での値であることを明確にする必要がある。
    *   **タスク1実施時点の補足**：`hitTest(x, y, tolerance)`は`tolerance`をデフォルト値なしの必須引数として実装した。具体的な数値（例: 5px）の決定は呼び出し元（`InputTracker`、タスク7〜9）側の責務として先送りしている。将来この値を変更する場合、`Line.js`側の計算式（線分上の最近接点との距離比較）には手を加える必要はなく、呼び出し元の定数のみ調整すればよい設計になっている点に注意。
*   **id未設定時の挙動**：タスク1時点で`id`はコンストラクタ内で`null`初期化されるのみで、`hitTest`自体は`id`を一切参照しない（座標のみで判定する純粋な幾何計算）。`id`が`null`のまま`hitTest`を呼び出しても問題は起きないが、`VectorModel`側（タスク3〜5）で`id`未採番のインスタンスを`#shapes`に混入させないよう、`commitDraft()`実装時に採番漏れがないか目視確認を推奨する。
*   **draftLineの初期状態**：`startDraft(x, y)`直後、`updateDraft`が一度も呼ばれないまま`commitDraft()`が呼ばれた場合（極めて速いダブルクリック等）の終点座標の扱いを、タスク4実装時に決定する必要がある（始点と同一座標の線分＝長さ0の線が生成されうる）。
*   **ホバー判定とハンドル判定の優先順位**：REQでは`IDLE`状態で「mousemoveで常時ホバー判定」と「選択中図形のハンドル上でのmousedownでDRAGGING_HANDLEへ遷移」が並記されているが、選択中図形自体にカーソルを重ねた際、ホバー強調表示とハンドル表示が同時に描画されうる。挙動として問題ないか、タスク8実装後に目視確認を推奨する。
*   **moveShapeの差分計算の座標系**：ドラッグ中に保持する「直前のカーソル座標」は`getLogicalCoordinate`適用後の論理座標である前提で設計している。DPI・CSSズーム環境下での差分計算に誤差が出ないか、タスク10実装後に目視確認を推奨する。
*   **ハンドル同士が近接した場合の優先順位（タスク2実施時点の判断）**：`hitTestHandle`は`start → end → move`の順に判定し、複数のハンドルが同時に`tolerance`以内となる場合は先着1件のみを返す仕様とした。線分が非常に短い（始点・終点・中点が近接する）場合、`move`ハンドルが実質的に選択できなくなる可能性がある。REQ側に優先順位の明確な指定がなかったための実装判断であり、将来この挙動を変更する場合は本メソッド内の判定順序（if文の並び）のみを調整すればよい。極端に短い線分での操作性は目視確認を推奨する。
*   **ハンドル・ホバーの暫定デザイン**：`drawHandles`（正方形8px＋円8px、白塗り青枠）および`drawHover`（半透明青の重ね描き、本体+6px太）は、REQ本文で「視覚仕様はスコープ外・暫定実装で可」とされているための仮の配色・サイズである。将来デザインが確定した際は、本メソッド内の定数（`handleSize`、色コード、太さの加算値）を差し替えるだけで対応可能な作りにしてある。
*   **ファイル先頭の責務定義の同期（タスク2実施時点の対応）**：`PROJECT_CONSTITUTION.md`の「責務が増える場合は定義自体を更新する」というルールに従い、タスク1・2で当たり判定機能（`hitTest`/`hitTestHandle`）が追加されたことを受け、`Line.js`先頭のJSDoc責務定義を「データ保持と描画」から「データ保持・描画・当たり判定」の3責務へ本タスク完了時に更新した。今後`Line.js`にさらに責務が追加される場合も、都度この先頭定義の同期を忘れないよう注意する。
*   **`selectShape` / `setHovered`のid実在チェック省略（タスク3実施時点の判断）**：両メソッドとも、渡された`id`が現在`#shapes`に存在するかどうかを検証せず、単純にプライベートフィールドへ代入するのみの実装とした。REQ本文に検証要否の明記がなかったための判断であり、存在しない（または削除済みの）`id`を渡した場合でも例外は発生しない。呼び出し元（`InputTracker`）が`shape.hitTest`等で得た実在図形の`id`のみを渡す前提で設計しているため、タスク8実装時にこの前提が崩れていないか目視確認を推奨する。
*   **無条件通知（タスク3実施時点の判断）**：`selectShape` / `clearSelection` / `setHovered` / `clearHovered`は、値が実際に変化したか（例: 既に同じidが選択済みの状態で再度同じidを渡した場合）を問わず、呼び出しのたびに無条件で`#notifyChange()`を実行する。既存の`addShape`と同じ方針に合わせたが、将来`mousemove`のたびにホバー判定APIが高頻度で呼ばれる構成（タスク8想定）になった場合、不要な再描画コストが発生しうる点に注意。パフォーマンス上の問題が顕在化した場合は、値の変化チェックを追加する余地がある。
*   **draftLineの初期状態の決定（タスク4実施時点の判断）**：`startDraft(x, y)`は始点・終点が同一座標（長さ0）の仮`Line`を生成する仕様とした。`updateDraft`が一度も呼ばれずに`commitDraft()`が呼ばれた場合（極めて速いダブルクリック等）、長さ0の線分がそのまま`#shapes`へ確定登録される。`Line.hitTest`はタスク1時点で長さ0のケースのゼロ除算を回避済みのため実害はないが、「見えない（クリックでしか選択できない）線」がキャンバス上に残る可能性がある点は目視確認を推奨する。将来この挙動を変更する場合（例: 長さ0ならcommit自体を無効化する）は`commitDraft()`内にガード条件を追加するだけでよい設計にしてある。
*   **id採番方式（タスク4実施時点の判断）**：`commitDraft()`での採番は`` `shape-${#nextId++}` ``という単純な連番文字列とした。REQ・PROJECT_ARCHITECTUREともに採番方式の具体的な指定がなかったための実装判断。`#nextId`は`VectorModel`インスタンスの生存期間内でのみ一意性を保証する（永続化・再読込をまたいだ一意性は考慮していない）。将来Import機能（`CodeImporter.js`）で既存idを含むデータを読み込む場合、`#nextId`との衝突可能性がある点に注意が必要（本Phaseのスコープ外）。
*   **`getDraftLine()`の追加判断（タスク4実施時点の判断）**：REQ本文のタスク4項目には明記がなかったが、`CanvasManager.render`（タスク6）が`draftLine`を受け取って描画する設計である以上、呼び出し元（`InputTracker`または`main.js`側の`onChange`ハンドラ）が`#draftLine`の現在値を取得する手段が不可欠と判断し、既存の`getSelectedId` / `getHoveredId`と同一パターンで追加した。スコープ逸脱ではなく、タスク4の目的（draftLineのライフサイクル管理を完結させる）に必要な最小限の追加である。
*   **`#draftLine`が`null`時の早期return（タスク4実施時点の判断）**：`updateDraft` / `commitDraft` / `cancelDraft`は、`#draftLine`が`null`の場合は状態変更もなく`#notifyChange()`も呼ばずに即returnする（タスク3までの選択・ホバー系APIとは異なり無条件通知としなかった）。`DRAWING`状態以外からこれらのメソッドが誤って呼ばれても副作用がない防御的な実装だが、`InputTracker`側の状態遷移（タスク9）に不整合があった場合、通知が発生せず画面が更新されないことでバグに気づきにくくなる可能性がある。タスク9実装後、意図した状態遷移になっているか目視確認を推奨する。
*   **`updateVertex` / `moveShape`におけるLine固有プロパティへの直接アクセス（タスク5実施時点の判断・要注意）**：本タスクの対象ファイルは`VectorModel.js`のみと明記されており`shapes/Line.js`側への汎用APIの追加（例: `setVertex(index, x, y)` / `translate(dx, dy)`をLineに実装しVectorModelからポリモーフィックに呼び出す形）はスコープ外だったため、`VectorModel`側で`shape.x1` / `shape.y1` / `shape.x2` / `shape.y2`という**Line固有のプロパティ名**に直接アクセスする実装とした。要件1で確立した「`core/`配下は図形種別を意識せずポリモーフィックに呼び出すのみ」という設計原則には、厳密には反する（`if/switch`によるtype分岐ではないが、Line固有の属性名を`VectorModel`が知っている状態）。現状Line以外の図形が存在しないため実害はないが、**将来曲線・円・楕円など`x1,y1,x2,y2`以外の頂点構造を持つ図形を追加する際、この2メソッドはそのままでは動作しない**点に注意。改修時は、各shapeクラス側に`setVertex(vertexIndex, x, y)` / `translate(dx, dy)`のような共通インターフェースを実装し、`VectorModel`側はそれをポリモーフィックに呼び出すだけの形にリファクタリングすることを推奨する。
*   **存在しないid・不正な`vertexIndex`を渡した場合のガード（タスク5実施時点の判断）**：`updateVertex` / `moveShape`とも、`id`に該当する図形が`#shapes`内に見つからない場合は状態変更・`#notifyChange()`呼び出しなしで早期returnする（タスク4の`updateDraft`等と同じ防御的パターンを踏襲）。`updateVertex`は`vertexIndex`が`0`・`1`以外の場合も同様に早期returnする。呼び出し元（`InputTracker`、タスク10）が`hitTestHandle`で得た`'start'|'end'`をそれぞれ`0`・`1`に正しくマッピングして渡す前提で設計しているため、タスク10実装時にこのマッピングに誤りがないか目視確認を推奨する。
*   **`startDraft` / `updateDraft`に残るLine固有プロパティへの直接アクセス（タスク5.5実施時点の補足）**：本Interruptの対象は`updateVertex` / `moveShape`の2メソッドに限定されており（REQ本文の実装要件・スコープ外項目のいずれにも`startDraft` / `updateDraft`の言及なし）、`startDraft`内の`new Line(x, y, x, y)`によるインスタンス化、および`updateDraft`内の`this.#draftLine.x2 = x; this.#draftLine.y2 = y;`という直接プロパティ更新には手を加えていない。これらはタスク4実施時点の判断として「draft生成時のインスタンス化のみ許容」と既に整理済みの箇所であり、本Interruptのスコープ外として現状維持とした。将来的に`startDraft` / `updateDraft`もポリモーフィック化する場合は、別途REQを起票の上で対応する必要がある。
*   **旧来の`handleClick`（ダミーLine生成）が未置換のまま残存（タスク7実施時点の判断・要注意）**：`InputTracker`のコンストラクタでは引き続き`this.canvas.addEventListener('click', this.handleClick.bind(this))`が登録されており、`handleClick`自体もタスク以前のダミー実装（クリック位置から+50,+50の固定Lineを生成する仮ロジック）のまま変更していない。タスク7のスコープが「状態変数の新設」のみであったための意図的な現状維持だが、次タスク（タスク8：`IDLE`状態のイベント処理実装）着手時に、この`handleClick`をどう扱うか（`IDLE`状態の分岐に統合するのか、`mousedown`/`mouseup`等の別イベントに置き換えるのかを含め）の設計判断が必要になる点に注意。現状のままタスク8のイベントハンドラを追加すると、`click`イベントに対して新旧のリスナーが二重に反応する可能性があるため、タスク8実装時にダミー実装の削除・置換を忘れないよう目視確認を推奨する。
*   **状態初期値の判断（タスク7実施時点の判断）**：`this.state`の初期値を`InputState.IDLE`とした。REQ本文・RES設計（要件4）ともに初期状態の明記はなかったための実装判断だが、「アプリ起動直後は何も操作していない」という自然な解釈に基づくものであり、他の解釈の余地は薄いと考えている。
*   **`lastCursor`の型・初期値の判断（タスク7実施時点の判断）**：`this.lastCursor`は`{x, y} | null`型とし、初期値`null`とした。`DRAGGING_HANDLE`状態に遷移する瞬間（タスク8でのmousedown検知時）に実際の座標をセットする設計を想定しているが、この「いつセットするか」の具体的な実装はタスク8・10側の責務であり、タスク7時点では変数の器を用意したのみである点に注意（タスク8実装時、`DRAGGING_HANDLE`への遷移処理で`lastCursor`のセット漏れがないか目視確認を推奨する）。
*   **「空白部分」の判定にホバー状態を流用（タスク8実施時点の判断）**：`handleClick`における「ホバー中の図形があるか＝空白クリックかどうか」の判定は、`mousemove`で継続的に更新される`model.getHoveredId()`の値をそのまま使う設計とした。REQ本文に判定方法の明記はなかったための実装判断。通常のマウス操作（移動してからクリック）であれば`click`の直前に必ず`mousemove`が発生するため問題ないが、モバイル等のタッチ操作やプログラム的に`mousemove`を経由せず`click`のみを発火させる特殊なケースでは、`hoveredId`が更新されないまま古い値（またはnull）が使われる可能性がある点に注意。本Phaseはマウス操作を前提としており実害はないと判断したが、将来タッチ対応を行う場合はこの前提の見直しが必要。
*   **`mousedown`によるDRAGGING_HANDLE遷移後、`mouseup`未実装のため状態が固定される（タスク8実施時点の判断・要注意）**：タスク10（`DRAGGING_HANDLE`状態のイベント処理、`mouseup`での`IDLE`復帰）が未実装の現時点では、選択中図形のハンドルへ`mousedown`すると`this.state`が`DRAGGING_HANDLE`へ遷移したまま復帰しない。この状態になると、`handleMouseMove` / `handleMouseDown` / `handleClick`はいずれも冒頭の`state !== InputState.IDLE`ガードにより一切何もしなくなり、ホバー・選択・新規作成を含むすべてのIDLE操作が無反応になる（タスク7時点で「旧`handleClick`が未置換のまま残存」として記載されていた懸念と同種の、フェーズ実装途中に特有の一時的制約）。ブラウザでの動作確認時、選択中図形のハンドル（始点・終点・移動）に誤ってマウスダウンすると操作不能に見える状態になりうるため、目視確認時は注意し、必要であればページのリロードで復帰すること。タスク10実装後はこの制約は解消される想定。
*   **`hitTolerance`を線分本体・ハンドル判定で共用（タスク8実施時点の判断）**：`this.hitTolerance = 5`（px）を`hitTest`（線分本体）と`hitTestHandle`（ハンドル）の両方に共用の値として渡す実装とした。「5. 懸念事項・要確認ポイント」冒頭に記載済みの「toleranceの具体値」という既存の懸念に対する、`InputTracker`側での最終的な決定である。ハンドルの描画サイズ（`Line.drawHandles`：8px四方・半径4px、タスク2実施時点の暫定デザイン）と近い値を採用したが、線分本体判定とハンドル判定とで異なる許容誤差にすべきかはREQ本文に明記がなく、実装判断とした。将来調整する場合は`this.hitTolerance`の値のみ、または`hitTest`用・`hitTestHandle`用に分離した別プロパティへ変更するだけでよい。
*   **ホバー判定とハンドル判定の優先順位（タスク8実施時点の補足）**：タスク6実施時点で記載済みの懸念（選択中図形にカーソルを重ねた際、ホバー強調表示とハンドル表示が同時に描画されうる）は、本タスクの実装によりさらに、「選択中図形上でmousedownした場合、まずハンドル判定（`hitTestHandle`）が試みられ、該当すればホバー判定（`hitTest`、`mousemove`側）とは独立に`DRAGGING_HANDLE`へ遷移する」という関係になった。両者は別イベント（`mousemove`と`mousedown`）・別メソッドで完全に独立して動作するため競合によるバグの懸念はないと判断しているが、視覚的な見え方（ホバー強調とハンドルが同時に見える状態でのハンドルドラッグ操作感）については、タスク10実装後にまとめて目視確認を推奨する。
*   **`main.js`の呼び出し配線が未更新（タスク6実施時点の判断・要注意）**：`render`のシグネチャは`render(shapes, { hoveredId, selectedId, draftLine } = {})`へ拡張したが、対象ファイルが`CanvasManager.js`のみと明記されていたため、実際に呼び出している`main.js`（`model.onChange(() => { canvasManager.render(model.getShapes()); })`）は本タスクでは変更していない。デフォルト値により実行時エラーは起きないが、`InputTracker`（タスク7〜10）の実装が完了しても、`main.js`側で`model.getSelectedId()` / `model.getHoveredId()` / `model.getDraftLine()`を第2引数として渡す配線を追加しない限り、ホバー強調・ハンドル・ドラフト線は画面に一切反映されない。この配線がどのタスクで行われる想定か（`InputTracker`関連タスク側で`main.js`も更新するのか、別途固定タスクとして起票が必要か）がREQ/RES双方に明記がないため、目視確認を推奨するとともに、次タスク着手前に確認が必要な点として記載する。
*   **hover強調とhandles描画の描画順序（タスク6実施時点の判断）**：同一ループ内で`shape.draw(ctx)`→（該当すれば）`shape.drawHover(ctx)`→（該当すれば）`shape.drawHandles(ctx)`の順で呼び出す実装とした。選択中の図形にカーソルを重ねた場合（`hoveredId === selectedId`）、`drawHover`が先に描画され`drawHandles`が後から上書きされる形になる。REQ本文に描画順序の指定がなかったための実装判断であり、視覚的な優劣（ハンドルがホバー強調の上に乗る）に問題がないか、タスク8実装後の目視確認を推奨する（既存の「ホバー判定とハンドル判定の優先順位」の懸念事項と合わせて確認すること）。
*   **draftLineへのhover/handles非適用（タスク6実施時点の判断）**：`draftLine`は作成中で未確定の図形であり`hoveredId`/`selectedId`のいずれとも意味的に一致しえないため、`draftLine.draw(ctx)`のみを呼び出し`drawHover`/`drawHandles`は呼び出さない実装とした。REQ本文にも「最後に重ねて描画する」とのみ記載でこの点の明記はなかったための解釈上の判断。将来、作成中の線にも何らかの強調表示（例: 常時ハンドル表示）を行いたい場合は、本メソッド内の`draftLine`描画部分にのみ手を加えればよい設計にしてある。
*   **`DRAWING`分岐の判定順序（タスク9実施時点の判断）**：`handleMouseMove` / `handleClick`とも、`this.state === InputState.DRAWING`の判定を既存の`IDLE`向けガード（`state !== InputState.IDLE`なら早期return）より手前に置く実装とした。REQ本文に判定順序の指定はなく、状態ごとに完全に独立した分岐として読みやすくするための実装判断。将来`DRAGGING_HANDLE`など状態が増えた場合も、同じパターン（各状態の分岐を上から順に並べる）を踏襲すれば拡張しやすい構造にしてある。
*   **「非常に速いダブルクリック」による長さ0の線の生成が実操作で到達可能になった点（タスク9実施時点の補足・要確認）**：タスク4実施時点で懸念として記載していた「`startDraft`直後、`updateDraft`が一度も呼ばれずに`commitDraft`が呼ばれた場合、長さ0の線が確定登録されうる」というケースは、本タスクの実装により実際のマウス操作（空白部分への`click`直後、`mousemove`を挟まず即座に同一座標へ`click`し直す等）で到達可能になった。`Line.hitTest`はゼロ除算を回避済みで例外は起きないが、見た目上「点」のような、後から視認しづらい図形が生成されうる。実害はないと判断しているが、実際のブラウザ操作でこのケースを目視確認し、許容可能な挙動か（許容できない場合は`commitDraft()`側に長さ0のガードを追加する余地がある旨、タスク4の懸念に既記載）確認を推奨する。
*   **`DRAGGING_HANDLE`状態が未実装のまま残る制約（タスク9実施時点の補足）**：タスク8時点で記載済みの「選択中図形のハンドルへ`mousedown`すると`DRAGGING_HANDLE`へ遷移したまま`mouseup`が未実装のため操作不能に見える」という制約は、本タスクの実装後も変わらず残っている（`DRAWING`状態はタスク9で解消したが、`DRAGGING_HANDLE`からの復帰はタスク10のスコープ）。目視確認時、誤ってハンドルへ`mousedown`すると`DRAWING`を含むすべてのIDLE系操作が無反応になる点に引き続き注意し、タスク10完了までは必要に応じてページのリロードで復帰すること。
    *   **タスク10実施時点の補足**：本タスクで`handleMouseUp`を実装し`mouseup`イベントリスナーも登録したため、上記の制約は解消済み。ハンドルへの`mousedown`後、`mouseup`で確実に`IDLE`へ復帰することをブラウザ実機で確認した。
*   **`mouseup`時に`activeHandle` / `activeShapeId` / `lastCursor`をクリアしない設計（タスク10実施時点の判断）**：`handleMouseUp`は`this.state = InputState.IDLE`への遷移のみを行い、`this.activeHandle` / `this.activeShapeId` / `this.lastCursor`は前回ドラッグ時の値を保持したまま残す実装とした。REQ本文のタスク10項目にはクリア処理の明記がなく、かつこれら3値は`IDLE`/`DRAWING`状態では一切参照されず、次回`handleMouseDown`で`DRAGGING_HANDLE`へ再突入する際に必ず新しい値で上書きされるため、実害はないと判断した。ただし、将来これらのプロパティを他の目的（デバッグ表示など）で参照するコードを追加する場合、`mouseup`後も直前のドラッグ操作の値が残存している点に注意が必要。厳密なクリーンアップを行いたい場合は`handleMouseUp`内で3値を`null`に戻す1行を追加するだけでよい。
*   **「空白クリック」判定とドラッグ操作を連続で行った場合の相互作用（タスク10実施時点の目視確認結果・要確認ポイント）**：ハンドルドラッグ（`mousedown`→`mousemove`→`mouseup`）の直後に、`mousemove`を経由せず`click`のみを空白部分へ発火すると、タスク8時点で既知の「空白判定に`hoveredId`（`mousemove`で継続更新される値）を流用する」設計により、ドラッグ操作中に更新されていなかった古い`hoveredId`（ドラッグ対象図形のid）がそのまま使われ、意図せず同じ図形への再選択（`selectShape`の再実行）が起きるのみで空白クリックとして扱われないケースを実機確認で再現した。通常のマウス操作（ドラッグ終了後にカーソルを動かしてからクリックする）であれば`mouseup`直後に`mousemove`が発生し`hoveredId`が更新されるため実害はないが、プログラム的にイベントを発火する場合や特殊な入力デバイスでは古い`hoveredId`が使われる可能性がある点に注意。この挙動自体は`DRAGGING_HANDLE`の状態遷移（タスク10のスコープ）とは独立した、タスク8時点の設計判断に起因するものであり、本タスクでは変更していない。目視確認・タッチ対応検討時に合わせて再確認を推奨する。
*   **旧`handleClick`（ダミーLine生成）の残存有無の最終確認（タスク11実施時点の確認）**：ユーザーからの指示に基づき、タスク11実施にあたり[InputTracker.js](../../js/core/InputTracker.js)の現物を改めて読み直し、旧`handleClick`（クリック位置から+50,+50固定のダミーLineを生成する仮実装）およびそれを登録していた旧イベントリスナーが残存していないことを再確認した。タスク8実施時点で既に完全に削除・新実装（状態遷移マシンに基づく`handleClick`）へ置き換え済みであり、コンストラクタ内のイベントリスナー登録（`mousemove`/`mousedown`/`mouseup`/`click`の4種）・`handleClick`メソッド定義とも新実装のみが存在することを確認した。追加の削除作業は不要だったため、本タスクではコード変更を行っていない。
*   **`PROJECT_ARCHITECTURE.md`更新範囲の判断（タスク11実施時点の判断）**：「2. アーキテクチャ設計」記載の更新予定に明記された4項目（`VectorModel.js`/`CanvasManager.js`/`InputTracker.js`/`shapes/`）のみを4章の更新対象とし、1〜3章（フォルダ構造・データ構造・実行サイクル）には手を加えていない。`palette/`・`CodeExporter.js`・`CodeImporter.js`は本Phaseで未着手のため、4章内でも該当箇所は「方向性のみの薄い記載」のまま変更していない。将来これらに着手するPhaseで、同様に固定タスクとして4章を更新する運用を踏襲することを推奨する。

---

### Phase 01-02 Task5.5 / Interrupt

#### 追加作業目的:
*  タスク5で実装した`VectorModel.updateVertex(id, vertexIndex, x, y)`と`VectorModel.moveShape(id, dx, dy)`が、内部で`shape.x1` / `shape.y1` / `shape.x2` / `shape.y2`というLine固有のプロパティ名に直接アクセスしていたことが原因。これは本Phaseの中心命題（要件1：「`core/`配下は図形種別を意識せずポリモーフィックに呼び出すだけ」）に反しており、将来Line以外の図形（曲線・円・楕円）を追加した際にこの2メソッドがそのまま動作しない懸念があった（タスク5実施時点で「5. 懸念事項・要確認ポイント」に記載済み）。当該懸念を解消するため、`draw` / `hitTest` / `hitTestHandle` / `drawHandles` / `drawHover`と同じパターン（図形固有ロジックをshape自身に閉じ込める）に揃えるInterruptとして実施した。

#### 対象ファイル
*  ./js/shapes/Line.js : 更新
*  ./js/core/VectorModel.js : 更新

#### 対応:(作業概要)
*  **`shapes/Line.js`**：ポリモーフィックAPIとして`setVertex(vertexIndex, x, y)`と`translate(dx, dy)`の2メソッドを追加した。
    *   `setVertex(vertexIndex, x, y)`：`vertexIndex === 0`なら`(x1, y1)`を、`vertexIndex === 1`なら`(x2, y2)`を絶対座標で更新する。`0`・`1`以外の値が渡された場合は何もしない（旧`VectorModel.updateVertex`が持っていたガード条件をそのまま移設）。
    *   `translate(dx, dy)`：`x1, y1, x2, y2`すべてに`dx, dy`を加算する。
    *   両メソッドともJSDocで引数・戻り値・責務を明文化した。
    *   ファイル先頭の責務定義（「直線のデータ保持・Canvasへの描画処理・当たり判定を担う。」）は、REQ本文の判断（`setVertex` / `translate`は既存の「データ保持」責務の範囲内であり新責務ではない）に同意し、更新不要と判断した。
*  **`core/VectorModel.js`**：`updateVertex` / `moveShape`の内部実装をポリモーフィック化した。
    *   `updateVertex(id, vertexIndex, x, y)`：id検索・存在しない場合の早期return・`#notifyChange()`呼び出しのロジックは維持し、頂点座標の更新処理を`shape.setVertex(vertexIndex, x, y)`の呼び出しに置き換えた。`vertexIndex`の0/1判定ロジックは`Line.setVertex`側へ移譲したため、`VectorModel`側からは削除した。
    *   `moveShape(id, dx, dy)`：同様にid検索・早期return・`#notifyChange()`のロジックは維持し、座標加算処理を`shape.translate(dx, dy)`の呼び出しに置き換えた。
    *   両メソッドともシグネチャ（引数・戻り値）は変更していない。
    *   修正後、`updateVertex` / `moveShape`内に`x1` / `y1` / `x2` / `y2`等のLine固有プロパティ名やif/switchによる型分岐が残っていないことを確認した（なお`startDraft` / `updateDraft`内には引き続きLine固有アクセスが残るが、これは本Interruptのスコープ外であり「5. 懸念事項・要確認ポイント」に補足を追記済み）。
*  **`PROJECT_ARCHITECTURE.md`**：影響なしと判断し、更新は行わなかった。理由：4章`shapes/`の責務リファレンスは「実装が進むごとに随時追記していく。現時点では、方向性のみ薄く記載する」という現状の記載方針のままであり、`setVertex` / `translate`を含む具体的なメソッド一覧の確定は、RES本体のタスク11（`InputTracker.js`まで実装が完了した時点での資料更新固定タスク）で他の確立済みインターフェース（`hitTest` / `hitTestHandle`等）とまとめて反映する方が、資料の一貫性を保てると判断した。

---

### Phase 01-02 Task6.5 / PlanningUpdate

#### 追加作業目的:
*  タスク6（`CanvasManager.render`のシグネチャ拡張）は完了したが、これを呼び出している`./js/main.js`側（`model.onChange(() => { canvasManager.render(model.getShapes()); })`）は当該タスクの対象ファイル外だったため未更新のまま残っていた（タスク6実施時点の「5. 懸念事項・要確認ポイント」に記載済み）。このままタスク7〜10（`InputTracker`の状態遷移マシン実装）を進めても、`main.js`が`render`の第2引数を渡さない限りホバー強調・ハンドル・ドラフト線は画面に一切反映されず、タスク7〜10それぞれの実装を段階的にブラウザで目視確認する手段がない。この懸念を解消するため、タスク6の直後・タスク7の前に「タスク6.5」を新設するPlanningUpdateを実施した。

#### 対象ファイル
*   `./js/main.js` : 更新

#### 対応: `main.js` - `render`呼び出しへの状態配線
*   **作業内容** :
     *   `model.onChange(() => { canvasManager.render(model.getShapes()); })`のコールバック内で、`canvasManager.render`の第2引数として`{ selectedId: model.getSelectedId(), hoveredId: model.getHoveredId(), draftLine: model.getDraftLine() }`を渡すよう修正する。
     *   `main.js`の責務（「各モジュールの初期化と連携（依存性の注入）を担う」）を逸脱しないよう、状態の判定・加工ロジックは一切追加せず、`VectorModel`の既存getter（`getSelectedId` / `getHoveredId` / `getDraftLine`）の戻り値をそのまま`CanvasManager.render`へ橋渡しするだけに留めること。
     *   JSDocコメントの記載漏れがないことを確認する（`main.js`の既存コメントスタイルに合わせる）。
     *   タスク完了後、本RESの「4. 詳細作業内容」に当該タスクの詳細を追記する。
     *   実装中に判断に迷った点があれば「5. 懸念事項・要確認ポイント」に記述する。

*  「3. タスクリスト」のタスク6の直後・タスク7の前に、新規タスク「タスク6.5: `main.js` - `render`呼び出しへの状態配線」をREQ本文の指定通り転記・挿入した（対象ファイル`./js/main.js`、`canvasManager.render`の第2引数として`{ selectedId: model.getSelectedId(), hoveredId: model.getHoveredId(), draftLine: model.getDraftLine() }`を渡す配線作業。状態の判定・加工ロジックは追加せず、既存getterの戻り値をそのまま橋渡しするのみに限定する内容）。
*  冒頭の参照元REQ一覧に、本PlanningUpdateの参照元REQ（`2608_2036_REQ_PlanningUpdate_Phase01-02_Task6.5_MainJsWiring.md`）を追記した。
*  既に完了報告済みのタスク1〜6の`[x]`マーク・完了日時・詳細作業内容のテキストは一切改変していない。
*  `./js/main.js`の`model.onChange(...)`コールバックを、`canvasManager.render(model.getShapes(), { selectedId: model.getSelectedId(), hoveredId: model.getHoveredId(), draftLine: model.getDraftLine() })`という形へ実装した。状態の判定・加工ロジックは追加せず、`VectorModel`の既存3getterの戻り値をそのままオブジェクトリテラルとして`render`の第2引数へ橋渡しするのみに留めており、`main.js`の責務（各モジュールの初期化と連携）を逸脱していない。既存のファイル先頭JSDoc（責務コメント）にも変更は不要と判断した（コールバック内部の1行の書き換えであり、ファイル・関数単位の責務は変わらないため）。

### タスク6.5: 動作確認
*   `python -m http.server`でプロジェクトルートを配信し、ブラウザ（Chromiumベースのプレビュー環境）で`index.html`を読み込んで確認した。
*   ページ読み込み時点でコンソールエラーは発生しなかった（`model.getSelectedId` / `getHoveredId` / `getDraftLine`が未定義例外を起こさないことを確認）。
*   `editor-canvas`要素に対して`click`イベントを発火させ、`InputTracker.handleClick`経由で`model.addShape(...)`→`#notifyChange()`→`main.js`の`onChange`コールバック→`canvasManager.render(shapes, { selectedId, hoveredId, draftLine })`という一連の呼び出し連鎖を実行させた。この際もコンソールエラーは発生しなかった。
*   `canvas`の`getImageData`でクリック位置周辺のピクセルを確認し、白以外のピクセル（描画されたLine）が存在することを確認した。第2引数（すべて`null`）を受け取った`CanvasManager.render`が、デフォルト値付き分割代入により例外を起こさず通常描画（`shape.draw(ctx)`）まで正しく実行されることを確認した。
*   現時点では`InputTracker`がタスク7〜10未実装のため`selectedId` / `hoveredId` / `draftLine`はいずれも`null`のまま推移し、ホバー強調・ハンドル・ドラフト線の実際の目視確認はできない（想定通り。これらの目視確認はタスク7〜10の実装後に行う）。本タスクの目的である「`render`呼び出しへ状態を配線し、以後のタスクをエラーなく段階的に確認できる状態にする」という点は達成できたことを確認した。
*   検証用に起動した`python -m http.server`はローカルの一時的な確認用途であり、プロジェクトの`.claude/launch.json`等の恒久設定には追加していない。
