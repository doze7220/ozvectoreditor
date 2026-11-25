*   **GroupCommandRules.js**：フォルダを作る・解除する操作を受け付ける操作モードと、フォルダを作るボタンの動作を、状態を持たない関数として提供する（Phase 11-04aで新設。流れは`PROJECT_ARCHITECTURE.md`3章28.）。
    *   **公開**：`FOLDER_BUTTON_ACTION`（`{ NONE: 'none', GROUP: 'group', ADD_AND_SELECT: 'addAndSelect', ADD: 'add' }`。凍結）・`canEditGroups(mode)`・`resolveFolderButtonAction({ mode, hasUnits, isDragging, isRowDragging, isLocked })`。
    *   **`canEditGroups(mode)`**：まとめる・解除する操作（`Ctrl`+`G`・`Ctrl`+`Shift`+`G`）を受け付ける操作モードか。選択モード（`OperationMode.SELECT`）だけ真。`GroupEditor.groupSelection`・`ungroupSelection`が`getMode()`の結果を渡して使う（`GroupEditor`は操作モードを解釈しない）。頂点の選択モードでは受け付けない。削除（`removeSelection`）と空のフォルダの追加（`addEmptyGroup`）はこの規則を通らない（受理の判定は`InputTracker.deleteSelection()`・`resolveFolderButtonAction`が行う）。
    *   **`resolveFolderButtonAction`**：フォルダを作るボタンを押したときの動作。上から、ロック中（`isLocked`）・キャンバスのドラッグ中（`isDragging`）・行のドラッグ中（`isRowDragging`）なら`none`／選択モードでまとまりがある（`hasUnits`）なら`group`（選んでいるまとまりをフォルダにまとめる）／選択モード・頂点の選択モードなら`addAndSelect`（空のフォルダを足して選ぶ）／それ以外（図形を描くツール・キャンバス移動・スポイト待ち受けなど）は`add`（空のフォルダを足すだけ。選択・ツール・引いている途中の線に触れない）。結果に従って`ItemListWiring.#handleAddGroup`が`groupEditor`を呼ぶ。
    *   **読むもの**：渡された`mode`と真偽値だけ。importは`core/InputModes`（`OperationMode`）のみ。
    *   **知らないこと**：DOM・`VectorModel`・`GroupEditor`・図形・フォルダ・選択の中身（`hasUnits`は呼び出し側が求める）。状態を持たない。
    *   **使う側**：`edit/GroupEditor`（`canEditGroups`）・`wiring/ItemListWiring`（`resolveFolderButtonAction`・`FOLDER_BUTTON_ACTION`）。
    *   **置き場所の理由**：操作モードの解釈を`edit/`（解釈しない）にも`wiring/`（判定を持たない）にも置けないため、`node --test`で確かめられる状態を持たない規則として`core/`に置いた。
    *   **テスト**：`test/core/GroupCommandRules.test.js`（8件。`_doc/arch/16_test.md`）。
