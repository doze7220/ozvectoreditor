*   **main.js**：アプリケーションのエントリポイント。インスタンス化・依存の注入・イベントバインドと、既存モジュールのAPIを決められた順に呼ぶモジュール間の連携を担う。
    *   **持たないもの**：判定ロジック・作業データの中身の解釈。持たせる必要が生じたら別モジュールへ分離する（履歴のスナップショットは`edit/SnapshotAdapter`、キャンバス管理は`edit/CanvasLibrary`、ファイル操作は`edit/CanvasFileOperations`へ分離済み）。`core/`から`io/`をimportしないため、`DocumentSerializer`を使う処理は`main.js`と`edit/`が持つ。
    *   **行数**：701行。配線を追加する場合は配線ブロック（`// 7.6.`。`applyMode`・`viewTransform`等への依存の受け渡しを伴う）の切り出しを検討する。`// 7.7.`（プロパティパネル。約30行。`main.js`全体の増分は+35行）は`applyMode`・`viewTransform`等への依存の受け渡しを伴わない独立したブロックのため、切り出さなかった。`// 7.8.`（約40行。全体の増分は+53行）も同様に独立したブロックのため切り出さなかった。
    *   **主な関数**：`performUndo`・`performRedo`・`performJoin`・`performShapeOrder`・`renderCurrentState`・`applyMode`・`applyShapeType`・`selectShapeTool`・`selectTool`・`syncToolPalette`・`syncZoomDisplay`・`syncDeleteButtonState`・`syncJoinButtonState`・`syncHistoryButtonState`・`syncPropertyShapeSection`・`syncPropertyOrderSection`・`syncCanvasNameDisplay`・`syncLoadingCover`・`zoomAtCanvasCenter`。
    *   **配線ブロック**（コメント番号の順に置く）：

        | ブロック | 内容 |
        | --- | --- |
        | `// 1.`〜`// 3.` | `VectorModel`・`CanvasManager`・`ViewTransform`の生成 |
        | `// 3.5.` | `SnapshotAdapter`・`HistoryManager`の生成、`performUndo`/`performRedo` |
        | `// 4.` | `EndpointSnapper`・`InputTracker`の生成、`renderCurrentState`、再描画の登録 |
        | `// 5.` | `WindowManager`の生成 |
        | `// 6.` | ツールバー・ステータスバーの配線（ビュー・削除・取り消し/やり直しのボタンと表示同期、倍率の表示とリセット、結合（`PathJoiner`の生成・`performJoin`・ボタンと表示同期）） |
        | `// 7.` | ツールパレット（`ToolPalette`の生成、`syncToolPalette`・`applyMode`・`applyShapeType`・`selectShapeTool`・`toolActions`・`selectTool`） |
        | `// 7.5.` | `ShapeInserter`・`ClipboardController`の生成のみ |
        | `// 7.6.` | キャンバス管理（`PaletteLauncher`・`CanvasLibrary`・`CanvasFileOperations`・`CanvasPalette`と表示同期、キャンバス名の表示（`#canvas-name-display`・`syncCanvasNameDisplay`）、ページ非表示時の確定、`beforeunload`の確認） |
        | `// 7.7.` | プロパティパネル（「図形」の段。`ShapeStyleEditor`・`PropertyShapeSection`の生成、`syncPropertyShapeSection`と`model.onChange`への登録）。段を足すときはこの後に段ごとのブロックを足す |
        | `// 7.8.` | プロパティパネル（「重なり順」の段。`ShapeOrderEditor`・`PropertyOrderSection`の生成、`performShapeOrder`、`syncPropertyOrderSection`と`model.onChange`への登録） |
        | `// 8.` | `KeyboardShortcuts`の生成 |
        | `// 9.` | `?dev`のときのみ`DevPanel` |

    *   **注入の一覧**：

        | 生成するクラス | 注入するもの |
        | --- | --- |
        | `SnapshotAdapter` | `model`、`shouldRestoreSelection`＝`() => inputTracker.getMode() === OperationMode.SELECT` |
        | `HistoryManager` | `capture`・`restore`＝`snapshotAdapter`のメソッド |
        | `EndpointSnapper` | `model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`＝`(length) => viewTransform.screenLengthToWorld(length)` |
        | `InputTracker` | `canvas`・`model`・`viewTransform`・`editRecorder`＝`historyManager`・第5引数`snapAssist`＝`endpointSnapper` |
        | `ToolPalette` | `#window-tool-palette`の要素・`TOOL_IDS`（`ToolRules`）・`onToolSelected`＝`selectTool` |
        | `ShapeInserter` | `model`・`editRecorder`＝`historyManager` |
        | `PathJoiner` | `model`・`editRecorder`＝`historyManager`・`screenLengthToWorld`＝`(length) => viewTransform.screenLengthToWorld(length)` |
        | `ClipboardController` | `model`・`inserter`＝`shapeInserter`・`deleteSelection`＝`() => inputTracker.deleteSelection()` |
        | `ShapeStyleEditor` | `model`・`editRecorder`＝`historyManager` |
        | `PropertyShapeSection` | `#property-shape-section`の要素・`onStrokeEnabledChange`/`onFillEnabledChange`/`onStrokeWidthChange`/`onColorInput`/`onColorChange`/`onColorEditEnd`→`shapeStyleEditor`の`setStrokeEnabled`/`setFillEnabled`/`setStrokeWidth`/`previewColor`/`commitColor`/`finishColorPreview`（各メソッド呼び出しのみ） |
        | `ShapeOrderEditor` | `model`・`editRecorder`＝`historyManager` |
        | `PropertyOrderSection` | `#property-order-section`の要素・`onBringToFront`/`onBringForward`/`onSendBackward`/`onSendToBack`→`performShapeOrder(ShapeOrderOperation.…)` |
        | `PaletteLauncher` | `paletteLaunchers`（`main.js`が唯一の定義箇所） |
        | `CanvasLibrary` | `storage`＝`new CanvasStorage()`・`model`・`historyManager`・`prepareSwitch`＝`() => applyMode(OperationMode.SELECT)`・`resetView`＝`() => resetViewToCenter()`・`confirmOpenUnsaved`＝`() => canvasPalette.confirmOpenUnsaved()` |
        | `CanvasFileOperations` | `fileIO`＝`new DocumentFileIO()`・`canvasLibrary`・`inserter`＝`shapeInserter`・`model`・`prepareInsert`＝`() => applyMode(OperationMode.SELECT)` |
        | `CanvasPalette` | `onOpen`/`onCreate`/`onRename`/`onDelete`→`canvasLibrary`の`openCanvas`/`createCanvas`/`renameCanvas`/`deleteCanvas`、`onExport`/`onExportSprite`/`onOpenFile`/`onImportFile`→`canvasFileOperations`の`exportCanvas`/`exportSprite`/`openFile`/`importFile` |
        | `KeyboardShortcuts` | `isDragging`/`setMode`/`setShapeType`/`zoomStep`/`resetView`/`cancel`/`selectAll`/`deleteSelection`/`join`/`bringToFront`/`bringForward`/`sendBackward`/`sendToBack`/`undo`/`redo`/`copy`/`cut`/`paste`/`duplicate`のコールバック |
        | `DevPanel` | `onExport`・`onImport` |

    *   **生成順の制約**：`HistoryManager`は`InputTracker`へ注入するため`InputTracker`より先に生成する。`EndpointSnapper`も`InputTracker`へ注入するため`InputTracker`より先（`HistoryManager`の後）に生成する。`renderCurrentState`は`model.getSnapPoint()`を`canvasManager.render`の`snapPoint`として渡す（吸い付きの表示は既存の再描画の経路のみで描かれる）。`shouldRestoreSelection`の実体・`performUndo`・`performRedo`は後で宣言される`inputTracker`を参照するが、呼ばれるのは起動完了後のみ（起動処理中に`undo()`/`redo()`を呼ぶ変更をする場合は注意）。`confirmOpenUnsaved`の実体も後で宣言される`canvasPalette`を参照するが、呼ばれるのは利用者の操作による新規作成・開く（ファイル）のみ（起動時の`start()`からは呼ばれない）。`CanvasFileOperations`は`canvasLibrary`の生成の直後、`CanvasPalette`の生成の前。
    *   **同一経路の原則**：取り消し・やり直しのボタンとショートカットは`performUndo()`/`performRedo()`を呼ぶのみ（`historyManager.undo()`/`redo()`を直接呼ばない）。削除ボタンとショートカットは`inputTracker.deleteSelection()`を呼ぶのみ（`model.deleteShapes`を直接呼ばない。受理判定は`InputTracker`側）。結合ボタンとショートカットは`performJoin()`を呼ぶのみ（`pathJoiner.join()`を直接呼ばない。ドラッグ中の判定は`performJoin`が行う）。重なり順のボタンとショートカットは`performShapeOrder()`を呼ぶのみ（`shapeOrderEditor.apply()`を直接呼ばない。ドラッグ中の判定は`performShapeOrder`が行う）。ビューのリセットボタン・リセットのショートカット・`CanvasLibrary`へ注入する`resetView`は`resetViewToCenter()`（`viewTransform.reset(canvas.clientWidth / 2, canvas.clientHeight / 2)`）のみ（操作モード・選択集合に触れない）。キャンバス要素の大きさを使う計算は`resetViewToCenter`と`zoomAtCanvasCenter`に集める（中心はキャンバスの領域の中心。ツールバー・ステータスバーを除いた領域）。ツールパレットの図形のボタンと数字キーは`selectShapeTool`を呼ぶ。選択・キャンバス移動のボタンと`V`・`H`・`P`は`applyMode`を呼ぶ。
    *   **プロパティパネルの同一経路**：パネルのコールバックは`shapeStyleEditor`のメソッドを呼ぶのみ（判定を持たない）。`inputTracker.isDragging()`は見ない（理由と残る経路は`PROJECT_ARCHITECTURE.md`3章13.）。表示は`syncPropertyShapeSection()`（`propertyShapeSection.render(shapeStyleEditor.getPanelView())`）を`model.onChange`へ登録して同期する（専用の同期経路は足さない）。`getPanelView()`は覚えている色を更新するため、この関数以外から呼ばない。
    *   **押せる/押せない状態**：取り消しボタンは「履歴がなく作成途中の図形もない」とき`disabled`。作成途中の図形は取り消しで破棄できるため、`syncHistoryButtonState()`は`model.onChange`と`historyManager.onChange`の両方に登録する。結合ボタンは現在の選択が結合できないとき`disabled`（`pathJoiner.canJoin()`。`syncJoinButtonState()`を`model.onChange`に登録。`canJoin`は表示倍率を見ない）。「重なり順」の4ボタンは、その操作で並びが変わらないとき`disabled`（`shapeOrderEditor.getAvailability()`。`syncPropertyOrderSection()`を`model.onChange`に登録）。
    *   **操作モード・図形種別の切替**：`applyMode(mode)`・`applyShapeType(type)`が一元管理する。切替後に`inputTracker.getMode()`／`getShapeType()`で実状態を読み返して表示を同期する。押し込みにするツールは`ToolRules.resolveActiveTool(getMode(), getShapeType())`で求め、`applyMode`・`applyShapeType`の中の`syncToolPalette`が`toolPalette.setActiveTool`へ渡す（判定は`ToolRules`にあり、`main.js`は持たない。ツールパレットは常に押せ、活性・非活性の判断は無い）。`toolActions`は識別子→操作の表引きで、判定ではない（`if (action)`は一覧外の識別子を無視する防御のみ）。`P`は`applyMode(CREATE)`のみで、最後に選んだ図形（起動直後は先頭の図形）のボタンが押し込みになる。新しいツールの足し方：識別子を`ToolRules`の`TOOL_IDS`へ（図形は`SHAPE_TYPES`から自動）、`index.html`へ`#tool-<id>`のボタン、`main.js`の`toolActions`へ操作（図形は`SHAPE_TYPES`から自動）。`SHAPE_TYPES`は正本の`ShapeFactory.js`から直接importする。
    *   **起動時の同期**：初回の描画・表示を`onChange`通知や`index.html`の初期記述に依存させないため、初期化の最後に`applyMode(OperationMode.SELECT)`と各表示の同期関数（`syncPropertyShapeSection()`を含む）・パレットの`render`を（ツールパレットの押し込みの表示は`applyMode`が同期する）明示的に1回ずつ呼ぶ。その後に`canvasLibrary.start()`を`await`せずに呼ぶ。`start()`前の`canvasLibrary.getState().loading`は真。
    *   **キャンバス管理の表示同期**：`syncCanvasNameDisplay()`・`syncLoadingCover()`は`canvasLibrary.onChange`へ、パレットの`render`は`canvasFileOperations.onChange`へ登録する（パレットの表示同期を1経路にまとめるため）。
    *   **キーボードショートカットのコールバック**：戻り値の意味はtypedef`ShortcutActions`を正とする。`setShapeType`は`selectShapeTool`を呼ぶ。モード自動切替を伴う操作（数字キー→図形作成モード、全選択→選択モード、貼り付け→選択モード）は、コールバック内で先に`applyMode`を呼ぶ。`paste`/`duplicate`はドラッグ中を自ら判定しない。ドラッグ中は`KeyboardShortcuts`の受理判定で呼ばれないだけである（`undo`/`redo`がコールバック内で判定するのとは異なる）。ボタン等ショートカット以外から呼ぶ場合は呼び出し側でドラッグ中の判定が必要。
    *   **開発者向け確認用ウィンドウ**：`URLSearchParams(window.location.search).has('dev')`が真のときのみ`DevPanel`を生成する。判定結果・関数・インスタンスを`window`へ公開しない。`onImport(text)`は読み込み中（`canvasLibrary.getState().loading`）なら図形一式・履歴に触れず失敗を返す（読み込み完了時の切り替えで復元内容が消されるため）。それ以外は3章5.の順序で入れ替える。`DevPanel`はコールバックの例外を捕捉しないため、`onImport`から例外を漏らさない。
