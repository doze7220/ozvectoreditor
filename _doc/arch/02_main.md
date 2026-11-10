*   **main.js**：アプリケーションのエントリポイント。インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶモジュール間の連携を担う。
    *   **持たないもの**：判定ロジック・作業データの中身の解釈。持たせる必要が生じたら別モジュールへ分離する（履歴のスナップショットは`edit/SnapshotAdapter`、キャンバス管理は`edit/CanvasLibrary`、ファイル操作は`edit/CanvasFileOperations`へ分離済み）。`core/`から`io/`をimportしないため、`DocumentSerializer`を使う処理は`main.js`と`edit/`が持つ。
    *   **行数**：593行。配線を追加する場合は配線ブロック（`// 7.6.`。`applyMode`・`viewTransform`等への依存の受け渡しを伴う）の切り出しを検討する。
    *   **主な関数**：`performUndo`・`performRedo`・`performJoin`・`renderCurrentState`・`applyMode`・`applyShapeType`・`syncZoomDisplay`・`syncDeleteButtonState`・`syncJoinButtonState`・`syncHistoryButtonState`・`syncCanvasNameDisplay`・`syncLoadingCover`・`zoomAtCanvasCenter`。
    *   **配線ブロック**（コメント番号の順に置く）：

        | ブロック | 内容 |
        | --- | --- |
        | `// 1.`〜`// 3.` | `VectorModel`・`CanvasManager`・`ViewTransform`の生成 |
        | `// 3.5.` | `SnapshotAdapter`・`HistoryManager`の生成、`performUndo`/`performRedo` |
        | `// 4.` | `EndpointSnapper`・`InputTracker`の生成、`renderCurrentState`、再描画の登録 |
        | `// 5.` | `WindowManager`の生成 |
        | `// 6.` | コントロールパネルの配線（`modeButtons`の定義、ビュー・削除・取り消し/やり直しのボタンと表示同期、結合（`PathJoiner`の生成・`performJoin`・ボタンと表示同期）） |
        | `// 7.` | 図形選択パレット、`applyMode`・`applyShapeType`、モードボタンのクリック登録 |
        | `// 7.5.` | `ShapeInserter`・`ClipboardController`の生成のみ |
        | `// 7.6.` | キャンバス管理（`PaletteLauncher`・`CanvasLibrary`・`CanvasFileOperations`・`CanvasPalette`と表示同期、ページ非表示時の確定、`beforeunload`の確認） |
        | `// 8.` | `KeyboardShortcuts`の生成 |
        | `// 9.` | `?dev`のときのみ`DevPanel` |

    *   **注入の一覧**：

        | 生成するクラス | 注入するもの |
        | --- | --- |
        | `SnapshotAdapter` | `model`、`shouldRestoreSelection`＝`() => inputTracker.getMode() === OperationMode.SELECT` |
        | `HistoryManager` | `capture`・`restore`＝`snapshotAdapter`のメソッド |
        | `EndpointSnapper` | `model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`＝`(length) => viewTransform.screenLengthToWorld(length)` |
        | `InputTracker` | `canvas`・`model`・`viewTransform`・`editRecorder`＝`historyManager`・第5引数`snapAssist`＝`endpointSnapper` |
        | `PaletteController` | パレットのルート要素・`SHAPE_TYPES`・`onTypeSelected`＝`applyShapeType` |
        | `ShapeInserter` | `model`・`editRecorder`＝`historyManager` |
        | `PathJoiner` | `model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`＝`(length) => viewTransform.screenLengthToWorld(length)` |
        | `ClipboardController` | `model`・`inserter`＝`shapeInserter`・`deleteSelection`＝`() => inputTracker.deleteSelection()` |
        | `PaletteLauncher` | `paletteLaunchers`（`main.js`が唯一の定義箇所） |
        | `CanvasLibrary` | `storage`＝`new CanvasStorage()`・`model`・`historyManager`・`prepareSwitch`＝`() => applyMode(OperationMode.SELECT)`・`resetView`＝`() => resetViewToCenter()`・`confirmOpenUnsaved`＝`() => canvasPalette.confirmOpenUnsaved()` |
        | `CanvasFileOperations` | `fileIO`＝`new DocumentFileIO()`・`canvasLibrary`・`inserter`＝`shapeInserter`・`model`・`prepareInsert`＝`() => applyMode(OperationMode.SELECT)` |
        | `CanvasPalette` | `onOpen`/`onCreate`/`onRename`/`onDelete`→`canvasLibrary`の`openCanvas`/`createCanvas`/`renameCanvas`/`deleteCanvas`、`onExport`/`onExportSprite`/`onOpenFile`/`onImportFile`→`canvasFileOperations`の`exportCanvas`/`exportSprite`/`openFile`/`importFile` |
        | `KeyboardShortcuts` | `isDragging`/`setMode`/`setShapeType`/`zoomStep`/`resetView`/`cancel`/`selectAll`/`deleteSelection`/`join`/`undo`/`redo`/`copy`/`cut`/`paste`/`duplicate`のコールバック |
        | `DevPanel` | `onExport`・`onImport` |

    *   **生成順の制約**：`HistoryManager`は`InputTracker`へ注入するため`InputTracker`より先に生成する。`EndpointSnapper`も`InputTracker`へ注入するため`InputTracker`より先（`HistoryManager`の後）に生成する。`renderCurrentState`は`model.getSnapPoint()`を`canvasManager.render`の`snapPoint`として渡す（吸い付きの表示は既存の再描画の経路のみで描かれる）。`shouldRestoreSelection`の実体・`performUndo`・`performRedo`は後で宣言される`inputTracker`を参照するが、呼ばれるのは起動完了後のみ（起動処理中に`undo()`/`redo()`を呼ぶ変更をする場合は注意）。`confirmOpenUnsaved`の実体も後で宣言される`canvasPalette`を参照するが、呼ばれるのは利用者の操作による新規作成・開く（ファイル）のみ（起動時の`start()`からは呼ばれない）。`CanvasFileOperations`は`canvasLibrary`の生成の直後、`CanvasPalette`の生成の前。
    *   **同一経路の原則**：取り消し・やり直しのボタンとショートカットは`performUndo()`/`performRedo()`を呼ぶのみ（`historyManager.undo()`/`redo()`を直接呼ばない）。削除ボタンとショートカットは`inputTracker.deleteSelection()`を呼ぶのみ（`model.deleteShapes`を直接呼ばない。受理判定は`InputTracker`側）。結合ボタンとショートカットは`performJoin()`を呼ぶのみ（`pathJoiner.join()`を直接呼ばない。ドラッグ中の判定は`performJoin`が行う）。ビューのリセットボタン・リセットのショートカット・`CanvasLibrary`へ注入する`resetView`は`resetViewToCenter()`（`viewTransform.reset(canvas.clientWidth / 2, canvas.clientHeight / 2)`）のみ（操作モード・選択集合に触れない）。キャンバス要素の大きさを使う計算は`resetViewToCenter`と`zoomAtCanvasCenter`に集める。
    *   **押せる/押せない状態**：取り消しボタンは「履歴がなく作成途中の図形もない」とき`disabled`。作成途中の図形は取り消しで破棄できるため、`syncHistoryButtonState()`は`model.onChange`と`historyManager.onChange`の両方に登録する。結合ボタンは現在の選択が結合できないとき`disabled`（`pathJoiner.canJoin()`。`syncJoinButtonState()`を`model.onChange`に登録。`canJoin`は表示倍率を見ない）。
    *   **操作モード・図形種別の切替**：`applyMode(mode)`・`applyShapeType(type)`が一元管理する。切替後に`inputTracker.getMode()`／`getShapeType()`で実状態を読み返して表示を同期する。新規モードは`modeButtons`へのエントリ追加で対応する（`index.html`のDOM要素と`InputTracker`の`OperationMode`の値も追加が必要）。パレットの活性の判断は`main.js`が行い、`PaletteController`へ指示する。`SHAPE_TYPES`は正本の`ShapeFactory.js`から直接importする。
    *   **起動時の同期**：初回の描画・表示を`onChange`通知や`index.html`の初期記述に依存させないため、初期化の最後に`applyMode(OperationMode.SELECT)`と各表示の同期関数・パレットの`render`を明示的に1回ずつ呼ぶ。その後に`canvasLibrary.start()`を`await`せずに呼ぶ。`start()`前の`canvasLibrary.getState().loading`は真。
    *   **キャンバス管理の表示同期**：`syncCanvasNameDisplay()`・`syncLoadingCover()`は`canvasLibrary.onChange`へ、パレットの`render`は`canvasFileOperations.onChange`へ登録する（パレットの表示同期を1経路にまとめるため）。
    *   **キーボードショートカットのコールバック**：戻り値の意味はtypedef`ShortcutActions`を正とする。モード自動切替を伴う操作（数字キー→図形作成モード、全選択→選択モード、貼り付け→選択モード）は、コールバック内で先に`applyMode`を呼ぶ。`paste`/`duplicate`はドラッグ中を自ら判定しない。ドラッグ中は`KeyboardShortcuts`の受理判定で呼ばれないだけである（`undo`/`redo`がコールバック内で判定するのとは異なる）。ボタン等ショートカット以外から呼ぶ場合は呼び出し側でドラッグ中の判定が必要。
    *   **開発者向け確認用ウィンドウ**：`URLSearchParams(window.location.search).has('dev')`が真のときのみ`DevPanel`を生成する。判定結果・関数・インスタンスを`window`へ公開しない。`onImport(text)`は読み込み中（`canvasLibrary.getState().loading`）なら図形一式・履歴に触れず失敗を返す（読み込み完了時の切り替えで復元内容が消されるため）。それ以外は3章5.の順序で入れ替える。`DevPanel`はコールバックの例外を捕捉しないため、`onImport`から例外を漏らさない。
