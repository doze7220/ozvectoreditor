# PROJECT_ARCHITECTURE.md
## OZ Vector Editor 全体仕様および実装定義書

本資料は、「OZ Vector Editor」（ブラウザ版ベクターパーツ作成エディタ）をAI-IDEが実装・修正する際の「全体マップ（見取り図）」および「インデックス（索引）」となる設計図である。
直接コードを読めば分かる内部ロジックの詳細（関数の中身、引数の全列挙、出力コードのテンプレート等）は本資料には記載しない。実装が進むごとに、セクション4を随時追記・更新していくこと。

---

### 1. プロジェクトフォルダ構造
AIは新規にファイルを作成、あるいはログを記録する際、必ずこの構造に準拠すること。各ファイルの責務は本資料の「4. 各モジュールの責務リファレンス」を唯一の正解（SSOT）とし、ここには記載しない。

```text
/oz-vector-editor/
├── index.html                  # スタイルはCSSファイル分割せず<style>タグに内包。キャンバスパレット等のフロートウィンドウも静的に置く
├── js/
│   ├── main.js
│   ├── core/
│   │   ├── VectorModel.js
│   │   ├── CanvasManager.js
│   │   ├── ViewTransform.js
│   │   ├── InputTracker.js
│   │   ├── KeyboardShortcuts.js
│   │   ├── DragTracker.js
│   │   ├── HistoryManager.js
│   │   ├── ShapeFactory.js
│   │   └── WindowManager.js
│   ├── shapes/
│   │   └── (図形クラスを種別ごとに1ファイルで追加していく)
│   ├── palette/
│   │   ├── PaletteController.js
│   │   ├── DevPanel.js
│   │   ├── CanvasPalette.js
│   │   ├── PaletteLauncher.js
│   │   └── (ツールバー・カラーピッカー等、自己完結するUI部品をここに追加していく)
│   ├── edit/
│   │   ├── ShapeInserter.js
│   │   ├── ClipboardController.js
│   │   ├── SnapshotAdapter.js
│   │   └── CanvasLibrary.js
│   └── io/
│       ├── DocumentSerializer.js
│       ├── CanvasStorage.js
│       ├── CodeExporter.js
│       └── CodeImporter.js
│
├── PROJECT_CONSTITUTION.md
├── PROJECT_ARCHITECTURE.md
│
├── _doc/
│   # 人間用の開発資料、未確定の仕様メモ、手書きスケッチ等
│   # AIは明示的な指示がない限り、この中身を勝手に読んで行動してはならない
│
└── _log/
    ├── req/
    │   └── closed/    # フェイズ大番号移行時にアーカイブ済みREQの退避先
    └── res/
        └── closed/    # フェイズ大番号移行時にアーカイブ済みRESの退避先
```

**フォルダ分割の方針**：横断的な処理（入力→状態→描画の複数層にまたがるもの）は `core/` に置く。自己完結する機能（1種類の図形、1つのUI部品など）は、それぞれ専用フォルダにまとめる。`io/`・`core/`の機能を組み合わせて図形一式を扱う手順は`edit/`に置く（`core/`は`io/`をimportせず、`io/`は作業データ形式の変換とブラウザ内保存先への読み書きのみを担うため）。`edit/`には、図形一式を編集する手順（貼り付け・複製等）に加え、履歴のスナップショットの取得・適用（`SnapshotAdapter`）と、キャンバス一覧の管理（`CanvasLibrary`。開く・新規作成・名前の変更・削除・切り替え・自動保存）を含める。`edit/`は操作モードを知らず、操作モードに依存する判定・処理は`shouldRestoreSelection`・`prepareSwitch`のような中立な注入関数で受け取る。`io/`は作業データ形式の変換（`DocumentSerializer`）とブラウザ内保存先（IndexedDB）への読み書き（`CanvasStorage`）を担う。依存方向は`main.js → edit → io → core → shapes`の一方向で、`core/`・`io/`は`edit/`をimportしない。

---

### 2. データ構造（Model）の概要
図形（Shape）は`shapes/`の図形クラスのインスタンスであり、共通プロパティは`type`（図形種別。`ShapeFactory`が受理する文字列と一致）・`id`（`VectorModel`が採番）・`strokeColor`・`strokeWidth`である。頂点の保持形式は図形クラスごとに異なる（`Line`は`x1, y1, x2, y2`、`Curve`/`Rect`/`Ellipse`は`points`配列）。塗りつぶしの共通プロパティは未定義である。頂点構造の詳細は4章`shapes/`を参照。
**図形データ**（1図形のJSON表現）は全図形共通で`{ type, id, points: [{ x, y }, ...], strokeColor, strokeWidth }`の形を取り、各図形クラスの`toJSON()`/`static fromJSON(data)`で相互変換する（`Line`も`points`2点＝[始点, 終点]で表す。`points`の並びは各図形クラスの頂点の並びと同じ）。`fromJSON`直後の図形の`id`は未検証・未正規化であり（欠落なら`undefined`、任意の型を取り得る）、`VectorModel.replaceAllShapes`の正規化を経て初めて一意な文字列になる。
**作業データ形式**（キャンバス全体の版番号付きJSON表現）は`{ format: "oz-vector-editor", version, shapes: [図形データ, ...] }`（`shapes`は描画順）であり、`io/DocumentSerializer.js`が変換を担う。保存対象は図形データのみで、選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない。図形クラスは常に現行版の図形データのみを扱い、旧版の知識は`DocumentSerializer`のマイグレーション表に閉じる。
**キャンバス**（名前を持ち、ブラウザ内に保存される1つの作品の単位。画面に開くキャンバスは常に1枚）の保存単位は**キャンバス記録**`{ id, name, updatedAt, document }`（typedef`CanvasRecord`は`io/CanvasStorage.js`）である。`id`はキャンバスの識別子（形式`canvas-<Date.now()の36進>-<Math.randomの36進8文字>`。採番と形式の知識は`CanvasLibrary`に閉じ、他のモジュールは解釈しない。図形のid`shape-<連番>`とは別体系）、`name`はキャンバス名（前後の空白を除いた1〜100文字。重複は許す）、`updatedAt`は最終更新日時（`Date.now()`のミリ秒。名前の変更では更新しない）、`document`は作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値）で、保存処理・キャンバス一覧の管理とも中身を解釈しない（読み込みは`DocumentSerializer.deserialize`を通し、旧版のマイグレーションはその仕組みに任せる）。保存しないものは、Undo/Redoの履歴・選択集合・ホバー・作成中の図形・選択矩形・ビュー変換・クリップボード・操作モード。保存先はIndexedDB（データベース名・版・ストア名等は`CanvasStorage.js`の定数`STORAGE_CONFIG`が唯一の定義箇所。キャンバス記録のストアと、「最後に開いていたキャンバスの識別子」を保持するメタ情報のストアの2つ）。IndexedDBはオリジン単位のため、`file://`で開いた場合とローカルサーバー経由で開いた場合は別のキャンバス一覧になる。複数タブで同時に開いた場合の整合は扱わない（後から書き込んだ側が残る）。
図形の座標はすべてワールド座標である。ビュー変換（表示倍率・オフセット）は図形データに含まれず、表示専用の状態として`core/ViewTransform.js`が保持する（パン・ズームによって図形データが書き換わることはない）。
選択状態は**選択集合**（選択中の図形idの集合。0個以上で、常に現存図形のidのみを含む）であり、範囲選択中の表示用の**選択矩形**（ワールド座標の対角2点。押下点と現在のカーソル位置で、正規化しない）とともに`core/VectorModel.js`が保持する。

---

### 3. 描画・操作フロー（実行サイクル）

1.  **起動処理 (`main.js`)** : DOMの読み込み完了後、`VectorModel`・`CanvasManager`・`ViewTransform`・`SnapshotAdapter`・`HistoryManager`・`InputTracker`・`WindowManager`・`PaletteController`・`ShapeInserter`・`ClipboardController`・`PaletteLauncher`・`CanvasStorage`・`CanvasLibrary`・`CanvasPalette`・`KeyboardShortcuts`をインスタンス化し、イベントをバインドする。URLに`?dev`が付いている場合のみ、開発者向け確認用ウィンドウ（`DevPanel`）も生成・表示する。
    *   **キャンバスの非同期の読み込み** : 初期化の最後（既存の初期同期の後）に`canvasLibrary.start()`を呼び（`await`しない。rejectしない）、ブラウザ内に保存されたキャンバスを非同期に読み込む。起動直後は空のキャンバスで描画され、読み込み完了時に切り替え処理（8.）で図形一式が入る（倍率100%・選択モード・履歴は空）。開くキャンバスは、候補を「最後に開いていたキャンバス（一覧にあれば）→ 残りを最終更新日時の新しい順」に並べ、先頭から作業データの読み込みを試して全体として読めた最初の1枚とする（読めない記録は一覧に残し、保存先からも消さない）。候補が無い・すべて読めない場合は新しい空のキャンバスを作成して開く（初回起動を含む）。保存先を開けない・一覧を読み出せない場合は、保存先へ一切書き込まずにメモリ上だけの空のキャンバス「無題 1」を開き、編集は続けられる（8.の`'unavailable'`）。
    *   **読み込み完了前の操作の扱い** : 読み込み完了まで、`index.html`で表示状態から始まる覆い要素`#canvas-loading-cover`がキャンバスへのマウス入力（図形作成・選択・ドラッグ・パン・ホイールズーム）を遮り（`main.js`の`syncLoadingCover()`が`getState().loading`に応じて表示を切り替える）、読み込み完了時の切り替えで利用者の操作が消されたり別のキャンバスに保存されたりしないようにする。キーボードショートカットとフロートウィンドウ上のボタンは働くが、読み込み中は図形0個・クリップボード空・履歴空のため図形一式を変えない。唯一図形一式を変え得る`?dev`の「復元」は、読み込み中は受理しない。`CanvasLibrary`も読み込み中の開く・新規作成等を受理しない。
2.  **描画サイクル (`CanvasManager.js`)** : 常時ループは持たず、状態変化の通知を受けた時点で同期的に再描画する（経路は4.「再描画の経路」）。背景グリッドとワールド座標の原点(0, 0)を示す軸線・原点マークを描いた上に、`VectorModel` から読み込んだShape配列を順次描画する（描画順の全体は4章`CanvasManager.js`）。
3.  **入力監視 (`InputTracker.js`・`KeyboardShortcuts.js` → `VectorModel.js`)** : マウスドラッグによる頂点・図形の移動、クリックによる選択、範囲選択（マーキー選択）による複数選択、選択集合の一括削除（削除ボタン・`Delete`/`Backspace`）、キーボードショートカット。状態が更新されると `VectorModel` が更新イベントを発火し、`CanvasManager` に再描画を促す。
    *   **ドラッグのライフサイクル** : 左ドラッグ（ハンドルドラッグ・本体ドラッグ・範囲選択）とパンの、ボタン押下から解放までのライフサイクル（開始ボタン・移動量閾値・追従/終了検知・中断・終了直後のclick抑止）は`DragTracker`が`window`へのcapture購読で一元管理し、ドラッグの意味の解釈（パン量・頂点変形・選択集合の平行移動・範囲選択）は`InputTracker`が行う。閾値判定のみスクリーン座標で行い、当たり判定・移動量・選択矩形はワールド座標で扱う。
    *   **範囲選択の流れ** : 選択モードで空白を左ボタンで押下 → 閾値（スクリーン3px）超過後、押下点と現在のカーソル位置（ワールド座標）で`VectorModel`の選択矩形を更新（描画は`CanvasManager`）→ 解放時に矩形を正規化し、各図形の`intersectsRect`をポリモーフィックに呼んで掛かった図形で選択集合を置き換え、選択矩形を破棄する（0件なら全解除）。中断（blur・モード切替）時は選択矩形を破棄するのみで確定しない。
    *   **キーボード操作** : `document`の`keydown`は、`Space`を`InputTracker`（スペースパン）、それ以外のキーを`KeyboardShortcuts`（対応表`SHORTCUT_BINDINGS`と受理判定）が排他的に担当する（同一キーを二重に解釈しない。`keyup`は`Space`のみ`InputTracker`が購読）。`KeyboardShortcuts`の受理判定の順序は「IME変換中 → テキスト入力中（`isTextInputElement`）→ 対応表照合（修飾キー・Shift規則）→ ドラッグ中またはキーリピート → コールバック実行」で（Shift規則は対応表エントリごとの3値：Shift禁止・Shift不問（拡大・縮小）・Shift必須（`Ctrl`+`Shift`+`Z`のやり直し））、`preventDefault()`はコールバックが`true`（受理）を返した場合のみ行う。唯一の例外として、`ctrl: true`のエントリがドラッグ中またはキーリピートで実行されなかった場合は`preventDefault()`のみ行う（ブラウザのズーム・ページ全選択・コピー・切り取り・貼り付け・ブックマーク追加の抑止）。操作の実体は`main.js`から注入されたコールバック（`applyMode`/`applyShapeType`/`viewTransform`/`InputTracker`の公開メソッド/`performUndo`・`performRedo`/`ClipboardController`の`copy`・`cut`・`paste`・`duplicate`）で実行され、UI同期は既存経路（`applyMode`・`applyShapeType`・`viewTransform.onChange`・`model.onChange`・`historyManager.onChange`）のみを通る（ショートカット専用のUI同期・再描画は持たない）。
4.  **座標系とビュー変換 (`ViewTransform.js`)** : 図形データが保持する座標を「ワールド座標」、キャンバス要素の左上を原点とするCSSピクセル座標を「スクリーン座標」と呼び、`スクリーン = ワールド × 倍率 ＋ オフセット` の関係にある。
    *   **入力** : `InputTracker`がマウスイベントからスクリーン座標を取得し、`ViewTransform.screenToWorld`でワールド座標へ逆変換して`VectorModel`・当たり判定へ渡す（パン量・ズーム中心はスクリーン座標のまま`ViewTransform`へ渡す）。
    *   **描画** : `main.js`の`renderCurrentState()`が`viewTransform.getState()`を`CanvasManager.render()`へ渡し、`CanvasManager`がdprと合成した描画変換を毎フレーム設定する。
    *   **再描画の経路** : `VectorModel.onChange`・`ViewTransform.onChange`・ウィンドウリサイズの3経路から、同一関数`renderCurrentState()`で再描画する。
5.  **作業データの変換・復元 (`DocumentSerializer.js` ⇔ `VectorModel.js`)** : 変換は`DocumentSerializer`が`model.getShapes()`の各図形の`toJSON()`から作業データを組み立てる。復元は`DocumentSerializer`のデシリアライズ（`ShapeFactory.fromJSON`→各図形クラスの`fromJSON`）で図形インスタンスを生成し、成功時のみ`InputTracker.abortOngoingOperation()`（進行中の入力操作の中断）→`HistoryManager.beginEdit()`→`VectorModel.replaceAllShapes(shapes)`（図形一式の入れ替え）→`HistoryManager.commitEdit()`の順に呼ぶ（復元は1件の編集操作として履歴に記録される。中断を先に行うのは、ドラッグ中だった場合にその中断分を先に1件確定させるため）。全体の読み込みに失敗した場合はキャンバスを変更せず、履歴にも記録しない。再描画・UI同期は`model.onChange`・`historyManager.onChange`経路のみで行い、復元専用の再描画は持たない。
6.  **履歴（取り消し・やり直し） (`InputTracker.js`・`edit/ShapeInserter.js`・`main.js` → `HistoryManager.js`)** : 編集操作（図形一式を変化させる利用者の1回の操作）の前後の図形一式を丸ごと記録するスナップショット方式である。スナップショットは`{ document: 作業データ（DocumentSerializer.serialize(model.getShapes())）, selectedIds: 選択集合 }`。スナップショットの取得・適用の実体は`edit/SnapshotAdapter`（`HistoryManager`へ`capture`/`restore`として注入）。
    *   **記録の流れ** : 変更処理を`HistoryManager.beginEdit()`（前の状態を取得）と`commitEdit()`（後の状態を取得して1件記録）で挟む。`model.onChange`ごとの記録は行わない。記録される操作と時点は次のとおり。
        *   図形の作成：`InputTracker.handleClick`の`DRAWING`確定時、`model.commitDraft()`の前後。
        *   削除（削除ボタン・`Delete`/`Backspace`）：`InputTracker.deleteSelection()`の受理時、`model.deleteShapes(ids)`の前後。
        *   本体ドラッグ・moveハンドルによる移動、ハンドルによる変形：閾値超過時（`#onLeftDragStart`）に開始、ドラッグの終了・中断の共通後始末（`#finishLeftDrag`）で確定。中断（`blur`・モード切替・`abortOngoingOperation()`）で残った変化も1件として記録する（記録しないと次の編集操作の前の状態に混ざり、単独で取り消せなくなるため）。
        *   `?dev`の「JSONから復元」：`main.js`の`onImport`（5.のとおり）。
        *   切り取り（`Ctrl`+`X`）：`ClipboardController.cut()`→`InputTracker.deleteSelection()`経由で、削除と同一（`model.deleteShapes(ids)`の前後）。
        *   貼り付け・複製（`Ctrl`+`V`／`Ctrl`+`D`）：`ShapeInserter.insertDocument`で、`model.addShapesWithNewIds(shapes)`の前後（7.のとおり。追加0件・クリップボードが空・選択集合が空では記録しない）。コピーは記録しない。
        *   範囲選択・クリック選択・全選択・選択解除・ホバー・パン・ズーム・ビューのリセット・操作モード/図形種別の切り替え、作成途中の図形の開始・破棄は記録経路を通らない。
        *   前後の作業データ部分の`JSON.stringify`が一致する場合（閾値以内のクリック・元の位置へ戻したドラッグ等）は記録せず、やり直しの履歴も破棄しない（選択集合は比較しない）。新たに記録するとやり直しの履歴は破棄され、上限`HISTORY_LIMIT`（100件）を超えると最古から捨てる。
        *   後続の編集操作（インポート（Phase 03-05。`ShapeInserter.insertDocument`を再利用する想定）等）も、変更処理を`beginEdit()`／`commitEdit()`で挟むだけで履歴の対象になる。
    *   **適用の流れ** : ショートカット（`Ctrl`+`Z`／`Ctrl`+`Y`・`Ctrl`+`Shift`+`Z`）とボタン（`#history-undo`／`#history-redo`）は、どちらも`main.js`の`performUndo()`／`performRedo()`を呼ぶ（同一経路）。処理は「ドラッグ中（`inputTracker.isDragging()`）なら不受理 → `inputTracker.abortOngoingOperation()`（取り消しは、作成途中の図形を破棄した場合はそこで終了し履歴を変化させない。やり直しは破棄したうえで続行）→ `HistoryManager.undo()`／`redo()` → 注入された`restore`＝`SnapshotAdapter.restore(snapshot)`：`DocumentSerializer.deserialize`（失敗・スキップ1件以上なら`console.warn`してキャンバスを変更せず、履歴の位置も動かさない）→ `model.replaceAllShapes` → 選択集合を復元してよいとき（注入関数`shouldRestoreSelection()`が真。実体は`main.js`が与える「選択モードのときのみ」）のみ`model.setSelection(snapshot.selectedIds)`」。ドラッグ中でなければ、取り消し・やり直しできる履歴がなくても受理（`true`）を返し、ブラウザ標準の動作を抑止する。適用後の選択集合は記録時点のもの（前の状態＝操作開始時、後の状態＝操作完了時。選択モード以外では空）。再描画・ボタン同期は`model.onChange`（選択モードでは2回、それ以外では1回）→`historyManager.onChange`（1回）の既存経路のみで行う。
    *   **履歴のリセット** : `HistoryManager.clear()`の呼び出し元は`CanvasLibrary`の切り替え処理（8.）のみである。キャンバスを開く・新規作成・削除後の切り替え・起動時の復元では履歴を空にし、切り替えそのものは編集操作として記録しない（`beginEdit`/`commitEdit`を呼ばない）。
7.  **コピー・貼り付け・複製 (`KeyboardShortcuts.js` → `main.js` → `ClipboardController.js` → `ShapeInserter.js` → `VectorModel.js`)** : `Ctrl`+`C`（コピー）／`Ctrl`+`X`（切り取り）／`Ctrl`+`V`（貼り付け）／`Ctrl`+`D`（複製）で操作する（ボタンはない）。
    *   **クリップボード** : アプリ内部（メモリ上）の領域で、OSのクリップボードは使わない。`ClipboardController`が作業データ形式のオブジェクト（`DocumentSerializer.serialize`の戻り値。空なら`null`）と貼り付けの段数を保持する。図形インスタンスを参照しないため、コピー後に元の図形を変形・削除しても内容は変わらない（外部へ返さず書き換えない）。履歴の対象外で、取り消し・やり直しでは内容・段数は変わらない。インスタンスは`main.js`が起動時に1つだけ生成するため、キャンバスを切り替えても消えない（ページの再読み込みで空になる）。
    *   **コピー・切り取り** : 選択集合の図形を描画順で`serialize`してクリップボードへ記録する。切り取りは先に`serialize`したうえで既存の唯一の削除経路`InputTracker.deleteSelection()`（`main.js`が注入）を呼び、受理された場合のみクリップボードを置き換える（削除と同じ結果・1件の編集操作）。選択集合が空（選択モード以外を含む）なら何もせず`false`を返し、`preventDefault()`しない（ページ上の文字のブラウザ標準のコピーを妨げないため）。
    *   **貼り付け・複製** : 貼り付けはクリップボードの内容を、複製は選択集合の図形を`serialize`した作業データを（クリップボードを経由せず）、`ShapeInserter.insertDocument(documentData, dx, dy)`へ渡す。追加した図形は毎回新しいインスタンス・新しいidで最前面へ追加され、追加した図形だけが選択される。ずらし量は1段＝`PASTE_OFFSET_STEP`（ワールド座標20。`ClipboardController.js`が唯一の定義箇所）で右下へずらす。貼り付けの段数はコピーで1・切り取りで0にリセットし、貼り付けで1件以上追加するたびに+1する（複製・取り消し・やり直しでは変えない）。複製は常に1段で、続けて押すと階段状に並ぶ。
    *   **選択モード以外での貼り付け** : `main.js`の`paste`コールバックは、クリップボードが空なら何もしない（モードも切り替えない）。空でなければ、選択モード以外のとき先に`applyMode(OperationMode.SELECT)`で切り替えてから貼り付ける（作成途中の図形は`setMode`の強制中断で破棄される）。
    *   **`ShapeInserter.insertDocument`の処理順** : `DocumentSerializer.deserialize`（`ok: false`なら何も変更せず記録もしない）→ 復元0件なら何もしない → `dx`・`dy`がともに0でなければ各図形の`translate(dx, dy)` → `HistoryManager.beginEdit()` → `VectorModel.addShapesWithNewIds(shapes)` → `HistoryManager.commitEdit()`。一部の図形がスキップされても読めた図形を追加し、戻り値`InsertResult`（`{ ok, insertedIds, skipped, error }`）の`skipped`で伝える。進行中の入力操作の中断・モード切り替えは行わない（呼び出し側の責務）。
    *   再描画・ボタン同期は`model.onChange`（1回）・`historyManager.onChange`の既存経路のみで行う。
8.  **キャンバス管理（自動保存・切り替え） (`CanvasPalette.js` → `main.js` → `CanvasLibrary.js` → `CanvasStorage.js`・`DocumentSerializer.js`・`VectorModel.js`・`HistoryManager.js`)** : キャンバスパレットの操作（開く・新規作成・名前の変更・削除）は`main.js`経由で`CanvasLibrary`の公開メソッドへ渡され、受理判定と処理本体は`CanvasLibrary`が担う。開いているキャンバスの名前の表示・ページのタイトル・パレットの一覧・読み込み中の覆い要素は、`canvasLibrary.onChange`の通知1経路で`getState()`から同期する。
    *   **自動保存** : 契機は`historyManager.onChange`のみ（編集操作の記録・取り消し・やり直しの適用成功・`clear()`での破棄）。選択の変更・ホバー・パン・ズーム・作成途中の図形の開始/破棄・ドラッグ中の途中経過では通知されないため保存しない（`model.onChange`は使わない）。通知のたびに待ち時間`AUTOSAVE_DELAY_MS`（500ms。`CanvasLibrary.js`が唯一の定義箇所）を張り直し、最後の通知から待ち時間後に1回、開いているキャンバスの記録全体を書き込む（連続した操作は1回にまとまる）。予約しないのは、開いているキャンバスが無い（読み込み完了前）・`'unavailable'`・切り替え中（下記`#isSwitching`）のとき。保存の作業データは呼び出し時点で同期的に取得し、予約時点のキャンバスと開いているキャンバスが一致する場合のみ、そのキャンバスの記録へ書く。
    *   **ページ非表示時の確定** : `main.js`が`document`の`visibilitychange`（`hidden`のとき）と`window`の`pagehide`で`canvasLibrary.flushPendingSave()`を呼ぶ（`CanvasLibrary`自体は`document`・`window`のイベントを購読しない）。`flushPendingSave()`は、保留中の保存があれば直ちに保存し（作業データの取得と書き込みの開始はハンドラ内で同期的に行われる）、保留が無く書き込み中の保存があればその完了を待って成否を返し、どちらも無ければ`true`を返す。
    *   **切り替え処理** : 開く・新規作成・開いているキャンバスの削除後の切り替え・起動時の復元が共通して通る、開いているキャンバスを入れ替える手順である。
        1.  進行中の入力操作の中断と選択モードへの切り替え（注入された`prepareSwitch()`。作成途中の図形は破棄され、本体ドラッグ・ハンドル操作で動かした分は1件の編集操作として記録されて自動保存が予約される）。
        2.  切り替え前のキャンバスの保存の確定（`flushPendingSave()`の完了を待つ）。失敗した場合は切り替えを中止する（開いているキャンバスのまま。保存できていない変更を画面から消さないため）。
        3.  切り替え先の読み込み（開く：記録の取得→`deserialize`。記録が無い・全体として読めない場合は中止。新規作成：空の作業データの記録を作成して書き込む。書き込みに失敗しても中止せず開き、次の自動保存で記録が作られる）。
        4.  同期区間の開始（ここから手順6まで`await`を挟まない）：もう一度`prepareSwitch()`を呼んで`await`中に始まった操作を中断し、`await`中の編集による保留中の保存があれば切り替え前のキャンバスへ書き始める（完了は待たず、失敗しても切り替えを続ける。同期区間を途切れさせないため。失敗は`'writeFailed'`で示す）。続けて図形一式を`model.replaceAllShapes`で入れ替える（図形のidは記録されたものを保持）。
        5.  履歴のリセット（`historyManager.clear()`）→ ビュー変換を初期表示へ（注入された`resetView()`）。
        6.  開いているキャンバスと「最後に開いていたキャンバスの識別子」を更新し（書き込みの完了は待たない）、読み込みの問題（`issue`）を更新して変更通知する。
        *   通り方：開く・新規作成は手順1から通る。起動時の復元と開いているキャンバスの削除後の切り替えは、いずれも共通の候補選択処理（`CanvasLibrary`のprivate`#openFirstLoadable`。候補を順に試して全体として読めた最初の1枚を開き、読めるものが無ければ新規作成して開く）を経由して手順3（記録の取得→`deserialize`）から通る（起動時は開いているキャンバスがまだ無いため、削除後は削除の開始時に進行中の入力操作を中断し保留中の保存を破棄済みのため、手順1〜2は通らない）。保存先を利用できない（`'unavailable'`）起動時のメモリ上の「無題 1」のみ、読み込む記録が無いため手順4から通る。
        *   再描画・ボタン同期は`replaceAllShapes`の`model.onChange`、`clear()`の`historyManager.onChange`、`reset()`の`viewTransform.onChange`の既存経路のみで行う（切り替え専用の再描画・同期処理は持たない）。クリップボードには触れない（切り替えで消えず、貼り付けの段数もリセットしない）。
    *   **非同期保存と切り替えの順序の保証** : `CanvasStorage`はすべての書き込みのトランザクションを呼び出し時点で同期的に生成し、IndexedDBはそれを生成順に実行するため、書き込みは呼び出し順に反映される。これと、手順2・手順4で図形一式の入れ替え前に保留中の保存を確定すること、保存の作業データを予約時点のキャンバスのidと組で同期的に取得することにより、切り替え前のキャンバスの記録を切り替え後の内容で上書きすることも、切り替え後のキャンバスの記録へ切り替え前の内容を書くことも起きない。
    *   **自動保存の予約を止める区間（`#isSwitching`）** : 自動保存の予約を止める唯一の仕組みである。真にするのは (a)切り替え処理の同期区間（手順4〜5。手順5の`clear()`による通知を保存の契機にしないため）と (b)開いているキャンバスの削除の開始から、削除後の切り替え処理の手順5の終わりまたは削除の中止まで、の2箇所のみで、偽へ戻すのは手順5の終わりと削除の中止時のみ。
    *   **名前の変更** : 一覧の任意のキャンバスが対象。前後の空白を除いて空の名前は受理せず、最大文字数`CANVAS_NAME_MAX_LENGTH`（100文字。`CanvasLibrary.js`が唯一の定義箇所）を超える名前は切り詰めて受理する（切り詰め後に末尾に残った空白も除く）。現在の名前と同じなら書き込まない。保存先へは名前のみを書き、最終更新日時は更新しない（一覧の並び（最終更新日時の新しい順）が名前の変更で入れ替わると、押そうとした行が動いて紛らわしいため）。
    *   **削除** : 一覧の任意のキャンバスが対象（確認の小窓は`CanvasPalette`が表示する）。開いていないキャンバスの削除は、開いているキャンバス・図形一式・履歴・自動保存に触れない。開いているキャンバスの削除は、進行中の入力操作の中断 → 保留中の保存の破棄（確定しない）→ 予約の停止（`#isSwitching`）→ 記録の削除の順に行い、成功したら残りのキャンバスを最終更新日時の新しい順に試して開く（1枚も残らない・すべて読めない場合は新しい空のキャンバス）。削除に失敗した場合は中止して開いているキャンバスのままとし、自動保存を予約し直す。保留の破棄・予約の停止・書き込みの生成順により、削除したキャンバスの記録が削除後に復活することはない。
    *   **新規キャンバスの命名規則** : 「無題 1」「無題 2」…のうち、キャンバス一覧の名前と一致しない最小の番号（`'無題 ' + n`）。
    *   **処理中の直列化** : 開く・新規作成・名前の変更・削除・起動時の復元は同時に1つだけ処理し、処理中・読み込み中・`'unavailable'`では新たな操作を受け付けない（パレットの操作ボタンは押せない状態になる）。処理中もキャンバスの編集は止めない（手順4で整合を取る）。公開メソッドの`Promise`はrejectしない（内部で捕捉して`console.warn`と下記の`issue`で示す）。
    *   **保存・読み込みの問題（`issue`）** : アプリは停止せず、最後に起きた問題を1つだけ保持して、キャンバスパレットの文言（`CanvasPalette`の`ISSUE_MESSAGES`）と、保存の問題（`'unavailable'`・`'writeFailed'`）ではコントロールパネルのキャンバス名の先頭の`⚠ `で示す。
        *   `'unavailable'`：起動時に保存先を開けない・一覧を読み出せない。メモリ上だけのキャンバスで編集を続け、開く・新規作成・名前の変更・削除・自動保存を行わない。解除しない。
        *   `'writeFailed'`：自動保存・新規作成の記録・名前の変更・削除・最後に開いていたキャンバスの識別子の書き込みに失敗した。次に自動保存が成功した時点で解除する。
        *   `'loadFailed'`：開こうとしたキャンバスの記録が見つからない・作業データが全体として読めない（そのキャンバスは開かず、記録も消さない）。次の切り替えの成功で解除する（読み込みに失敗して別のキャンバスを開いた場合は残す）。
        *   `'partialLoad'`：一部の図形をスキップして開いた（開いただけでは記録を書き換えないが、編集するとスキップした図形は記録から失われる）。次の切り替えの成功で解除する。

---

### 4. 各モジュールの責務リファレンス
※ 実装が進むごとに随時追記していく。個々のメソッドの内部アルゴリズムは各ファイルのJSDocを正とし、ここには書かない。

**4章の本文はモジュールごとのファイルに分かれている。作業では、該当するモジュールのファイルだけを読むこと。開発資料への反映（更新）も、該当するモジュールのファイルに対して行うこと。** 新しいモジュールの項目を追加するときは、`_doc/arch/` に同じ形式のファイルを作り、下の一覧に1行追加する。

| モジュール | ファイル |
| --- | --- |
| `index.html` | `_doc/arch/01_index_html.md` |
| `main.js` | `_doc/arch/02_main.md` |
| `VectorModel.js` | `_doc/arch/03_VectorModel.md` |
| `CanvasManager.js` | `_doc/arch/04_CanvasManager.md` |
| `ViewTransform.js` | `_doc/arch/05_ViewTransform.md` |
| `InputTracker.js` | `_doc/arch/06_InputTracker.md` |
| `KeyboardShortcuts.js` | `_doc/arch/07_KeyboardShortcuts.md` |
| `HistoryManager.js` | `_doc/arch/08_HistoryManager.md` |
| `DragTracker.js` | `_doc/arch/09_DragTracker.md` |
| `ShapeFactory.js` | `_doc/arch/10_ShapeFactory.md` |
| `WindowManager.js` | `_doc/arch/11_WindowManager.md` |
| `shapes/` | `_doc/arch/12_shapes.md` |
| `palette/` | `_doc/arch/13_palette.md` |
| `edit/` | `_doc/arch/14_edit.md` |
| `io/` | `_doc/arch/15_io.md` |
