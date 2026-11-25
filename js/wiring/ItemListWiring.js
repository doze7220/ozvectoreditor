/**
 * 責務：右端の図形の一覧の配線（購読・生成・注入と、規則の結果を`model`・パネルへ渡す橋渡し）を担う。
 * 判定・計算の規則は持たず、各規則のモジュールへ渡すだけ。保存しない一時的な値だけを持つ。
 */
import {
    ROW_HOVER_ACTION,
    ROW_PRESS_ACTION,
    canSetInsertTargetByRow,
    canStartNameEdit,
    canStartRowDrag,
    canToggleGroup,
    isListLocked,
    isOwnHover,
    resolveNameEditKey,
    resolveRowHover,
    resolveRowPressAction,
    shouldSelectPressedRow
} from '../core/ItemListRules.js';
import { resolveInsertMarkId } from '../core/InsertTargetRules.js';
import { buildItemRows, resolveRowHighlight, resolveRowViews } from '../core/ItemRowRules.js';
import { hasGroupItem } from '../core/GroupTreeRules.js';
import { FOLDER_BUTTON_ACTION, resolveFolderButtonAction } from '../core/GroupCommandRules.js';
import { resolveRowClickSelection } from '../core/ListSelectionRules.js';
import { hasHighlightChanged, resolveSelectionScrollTop, resolveVisibleRowRange } from '../core/ListScrollRules.js';
import { THUMBNAIL_SIZE_PX, buildThumbnailKey, needsThumbnailRedraw } from '../core/ThumbnailRules.js';
import { drawThumbnail } from '../core/ThumbnailRenderer.js';
import { ItemListPanel } from '../palette/ItemListPanel.js';
import { ItemListRowDrag } from './ItemListRowDrag.js';

/** サムネイルを描く範囲の、見えている行の前後に足す余裕の行数。 */
const THUMBNAIL_OVERSCAN_ROWS = 4;

/**
 * 図形の一覧の配線。生成時にパネル・行のドラッグの進行の生成と購読の登録を行い、公開するのはコンストラクタと`sync()`・`isRowDragging()`・`cancelRowDrag()`のみ。
 * 一時的な値として、`Shift`＋クリックの起点・自分が出したホバーのid・最後に見た`openCanvasId`だけを持つ（保存しない）。
 */
export class ItemListWiring {
    /** @type {import('../core/VectorModel.js').VectorModel} 図形一式・選択の持ち主 */
    #model;
    /** @type {import('../edit/ShapeExtentReader.js').ShapeExtentReader} 図形1つの外枠の照会 */
    #shapeExtentReader;
    /** @type {ItemListPanel} 一覧のUI部品 */
    #panel;
    /** @type {boolean} 次のフレームでの同期を予約済みか */
    #isSyncRequested = false;
    /** @type {WeakMap<HTMLCanvasElement, string>} サムネイルの`<canvas>`に最後に描いた鍵 */
    #drawnKeys = new WeakMap();
    /** @type {import('../edit/CanvasLibrary.js').CanvasLibrary} キャンバスの状態の照会（ロック中か・開いているキャンバス） */
    #canvasLibrary;
    /** @type {() => string} 操作モードの照会 */
    #getMode;
    /** @type {() => boolean} ドラッグ中（左ドラッグ・パン）かの照会 */
    #isDragging;
    /** @type {() => boolean} スポイトの待ち受け中かの照会 */
    #isPicking;
    /** @type {() => void} 選択ツールへ切り替える */
    #selectSelectTool;
    /** @type {(event: MouseEvent) => boolean} `Ctrl`（`Meta`）が押されているかの読み取り */
    #readCtrlModifier;
    /** @type {import('../edit/ItemRenameEditor.js').ItemRenameEditor} 名前を変える編集操作 */
    #itemRenameEditor;
    /** @type {import('../edit/GroupEditor.js').GroupEditor} フォルダを作る編集操作 */
    #groupEditor;
    /** @type {ItemListRowDrag} 行のドラッグ（並べ替え）の進行 */
    #rowDrag;
    /** @type {string|null} `Shift`＋クリックの範囲の起点の行のid（図形またはフォルダ） */
    #anchorId = null;
    /** @type {string|null} 自分が出したホバーとして記録している図形id */
    #hoveredRowId = null;
    /** @type {string|null} 最後に見た`openCanvasId` */
    #lastOpenCanvasId = null;

    /**
     * 一覧のパネルを生成し、`model.onChange`・`window`の`resize`・パネルのスクロールで同期を予約する。
     * @param {Object} deps
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式・選択の持ち主
     * @param {import('../edit/ShapeExtentReader.js').ShapeExtentReader} deps.shapeExtentReader - 図形1つの外枠の照会
     * @param {{ isFloatWindowsVisible: () => boolean, onChange: (listener: Function) => void }} deps.displayState - 表示の状態
     * @param {import('../edit/CanvasLibrary.js').CanvasLibrary} deps.canvasLibrary - キャンバスの状態の照会
     * @param {() => string} deps.getMode - 操作モードの照会
     * @param {() => boolean} deps.isDragging - ドラッグ中かの照会
     * @param {() => boolean} deps.isPicking - スポイトの待ち受け中かの照会
     * @param {() => void} deps.selectSelectTool - 選択ツールへ切り替える
     * @param {(event: MouseEvent) => boolean} deps.readCtrlModifier - `Ctrl`（`Meta`）が押されているかの読み取り
     * @param {import('../edit/ItemRenameEditor.js').ItemRenameEditor} deps.itemRenameEditor - 名前を変える編集操作
     * @param {(orderedIds: string[]) => boolean} deps.applyRowOrder - 行のドラッグで決まった並び全体（描画順）を適用する（記録つきの編集操作）
     * @param {import('../edit/GroupEditor.js').GroupEditor} deps.groupEditor - フォルダをまとめる・空のフォルダを足す編集操作（作るボタンが使う）
     */
    constructor({ model, shapeExtentReader, displayState, canvasLibrary, getMode, isDragging, isPicking, selectSelectTool, readCtrlModifier, itemRenameEditor, applyRowOrder, groupEditor }) {
        this.#model = model;
        this.#shapeExtentReader = shapeExtentReader;
        this.#canvasLibrary = canvasLibrary;
        this.#getMode = getMode;
        this.#isDragging = isDragging;
        this.#isPicking = isPicking;
        this.#selectSelectTool = selectSelectTool;
        this.#readCtrlModifier = readCtrlModifier;
        this.#itemRenameEditor = itemRenameEditor;
        this.#groupEditor = groupEditor;
        this.#lastOpenCanvasId = canvasLibrary.getState().openCanvasId;
        this.#panel = new ItemListPanel(document.getElementById('item-list-panel'), {
            thumbnailSize: THUMBNAIL_SIZE_PX,
            onScroll: () => {
                this.#requestSync();
                this.#rowDrag.refresh();
            },
            onRowPress: (id, event, isEditingRow) => this.#handleRowPress(id, event, isEditingRow),
            onRowClick: (id, event) => this.#handleRowClick(id, event),
            onRowHover: (id) => this.#handleRowHover(id),
            onNameEditRequest: (id, event) => this.#handleNameEditRequest(id, event),
            onNameCommit: (id, text) => this.#itemRenameEditor.rename(id, text),
            resolveNameEditKey,
            onGroupToggle: (id) => this.#handleGroupToggle(id),
            onAddGroup: () => this.#handleAddGroup()
        });
        this.#rowDrag = new ItemListRowDrag({
            panel: this.#panel,
            getRowIds: () => buildItemRows(model.getItems()).map((row) => row.id),
            isSelected: (id) => model.isSelected(id),
            shouldSelectPressedRow: (id) => shouldSelectPressedRow({ mode: getMode(), isPicking: isPicking(), isSelected: model.isSelected(id) }),
            selectRow: (id) => {
                model.setSelectionByUser([id]);
                this.#anchorId = id;
                this.sync({ allowScroll: false });
            },
            applyOrder: applyRowOrder,
            onDragStart: () => this.#clearOwnHover()
        });
        model.onChange(() => this.#requestSync());
        window.addEventListener('resize', () => this.#requestSync());
        canvasLibrary.onChange(() => {
            const state = canvasLibrary.getState();
            if (state.openCanvasId !== this.#lastOpenCanvasId) {
                this.#lastOpenCanvasId = state.openCanvasId;
                // 図形のidは別のキャンバスと同じ値になり得るため、起点を忘れる
                this.#anchorId = null;
                // キャンバスを切り替えてもidが同じ図形があり得るため、編集中の名前は捨てる
                this.#panel.cancelNameEdit();
                this.#rowDrag.cancel();
            }
            if (isListLocked(state)) {
                this.#clearOwnHover();
                this.#rowDrag.cancel();
            }
        });
        displayState.onChange(() => {
            if (!displayState.isFloatWindowsVisible()) {
                this.#clearOwnHover();
                this.#rowDrag.cancel();
            }
        });
    }

    /**
     * 一覧の表示を今の`model`に合わせる。行の組み立て（平らにするのは1回）・パネルへの反映・
     * 選択または描き込む先の印が変わったときのスクロール・見えている行のサムネイルの描画を順に行う。
     * @param {Object} [options]
     * @param {boolean} [options.allowScroll=true] - 偽なら、選択・印が変わってもスクロールしない
     * @returns {void}
     */
    sync({ allowScroll = true } = {}) {
        this.#rowDrag.cancelIfRowsChanged();
        const model = this.#model;
        const rows = buildItemRows(model.getItems());
        const previousIds = this.#panel.getSelectedRowIds();
        const previousMarkId = this.#panel.getMarkedRowId();
        const insertMarkId = resolveInsertMarkId({ selectedCount: model.getSelectedIds().length, insertTargetId: model.getInsertTargetId() });
        const views = resolveRowViews({
            rows,
            isSelected: (id) => model.isSelected(id),
            selectedGroupIds: model.getSelectedGroupIds(),
            insertMarkId
        });
        this.#panel.render(views);
        const { selectedIds, markId, indexes } = resolveRowHighlight(views);

        if (allowScroll && hasHighlightChanged({ previousSelectedIds: previousIds, selectedIds, previousMarkId, markId })) {
            // 選ばれている行があればその行、無ければ印の行を見せる
            const { scrollTop, height, rowHeight } = this.#panel.getViewport();
            const top = resolveSelectionScrollTop({ selectedIndexes: indexes, scrollTop, height, rowHeight });
            if (top !== null) this.#panel.setScrollTop(top);
        }

        this.#drawVisibleThumbnails(rows);
    }

    /**
     * 行の押下を処理する。ドラッグを始めてよいかは`canStartRowDrag`に任せ、結果とともに行のドラッグの進行へ渡すだけ。
     * @param {string} id - 押した行のid（図形またはフォルダ）
     * @param {MouseEvent} event - `mousedown`のイベント
     * @param {boolean} isEditingRow - 押した行が名前の編集中か
     * @returns {void}
     */
    #handleRowPress(id, event, isEditingRow) {
        const canStart = canStartRowDrag({
            button: event.button,
            hasModifier: this.#readCtrlModifier(event) || event.shiftKey === true,
            isEditingRow,
            isDragging: this.#isDragging(),
            isLocked: isListLocked(this.#canvasLibrary.getState()),
            hasGroups: hasGroupItem(this.#model.getItems())
        });
        this.#rowDrag.press(id, event, canStart);
    }

    /**
     * 行のドラッグ（押下から。閾値以前を含む）の最中かを返す。`Esc`で中断できるドラッグの照会に使う。
     * @returns {boolean}
     */
    isRowDragging() {
        return this.#rowDrag.isActive();
    }

    /**
     * 行のドラッグを取りやめる（元の並びのまま。離したときのclickも無視する）。
     * @returns {boolean} 取りやめる対象があったら真
     */
    cancelRowDrag() {
        return this.#rowDrag.cancel();
    }

    /**
     * 行のクリックを処理する。押したときの判定は`resolveRowPressAction`（描くツールでは`canSetInsertTargetByRow`）、次の選択は`resolveRowClickSelection`に任せ、
     * 結果を`model`へ渡すだけ（選択は`setSelectionByUser`（折りたたみは保つ）、描くツールでは`setInsertTarget`）。選択の変化は記録しない。
     * @param {string} id - 押した行のid（図形またはフォルダ）
     * @param {MouseEvent} event - クリックのイベント
     * @returns {void}
     */
    #handleRowClick(id, event) {
        // 行のドラッグ（または取りやめ）の直後のclickは、クリックとして扱わない
        if (this.#rowDrag.consumeSuppressedClick()) return;
        const action = resolveRowPressAction({
            mode: this.#getMode(),
            isPicking: this.#isPicking(),
            isDragging: this.#isDragging(),
            isLocked: isListLocked(this.#canvasLibrary.getState())
        });
        if (action === ROW_PRESS_ACTION.NONE) {
            // 描くツールでは、行のクリックは描き込む先の指定（行が今あるかは`setInsertTarget`が見る）
            const canSetTarget = canSetInsertTargetByRow({
                mode: this.#getMode(),
                isPicking: this.#isPicking(),
                isDragging: this.#isDragging(),
                isLocked: isListLocked(this.#canvasLibrary.getState())
            });
            if (canSetTarget) {
                this.#model.setInsertTarget(id);
                this.sync({ allowScroll: false });
            }
            return;
        }

        const model = this.#model;
        const rows = buildItemRows(model.getItems());
        if (!rows.some((row) => row.id === id)) return;

        let additive = this.#readCtrlModifier(event);
        let range = event.shiftKey === true;
        if (action === ROW_PRESS_ACTION.SWITCH_AND_SELECT) {
            this.#selectSelectTool();
            // 切り替えの後は修飾キーによらず、ふつうのクリックとして選ぶ
            additive = false;
            range = false;
        }
        const result = resolveRowClickSelection({
            rows,
            selectedIds: model.getSelectedIds(),
            selectedGroupIds: model.getSelectedGroupIds(),
            hitId: id,
            additive,
            range,
            anchorId: this.#anchorId
        });
        model.setSelectionByUser(result.ids, { groupIds: result.groupIds, keepsCollapsed: true });
        this.#anchorId = result.anchorId;
        // 表示を先に今の選択へそろえ、予約済みの同期で「選択が変わった」とならないようにする（一覧での選択ではスクロールしない）
        this.sync({ allowScroll: false });
        // 切り替え（setMode）がホバーを消すため、その行のホバーを当て直す
        this.#handleRowHover(id);
    }

    /**
     * フォルダの三角のクリックを処理する。押してよいかは`canToggleGroup`に任せ、`model.setGroupCollapsed`へ渡すだけ（選択に触れない）。
     * @param {string} id - 三角を押したフォルダの行のid
     * @returns {void}
     */
    #handleGroupToggle(id) {
        if (this.#rowDrag.consumeSuppressedClick()) return;
        const canToggle = canToggleGroup({
            isDragging: this.#isDragging(),
            isLocked: isListLocked(this.#canvasLibrary.getState())
        });
        if (!canToggle) return;
        const row = buildItemRows(this.#model.getItems()).find((candidate) => candidate.id === id);
        if (!row || row.kind !== 'group') return;
        this.#model.setGroupCollapsed(id, !row.collapsed);
        this.sync({ allowScroll: false });
    }

    /**
     * フォルダを作るボタンのクリックを処理する。動作は`resolveFolderButtonAction`に任せ、結果に従って`groupEditor`を呼ぶだけ（モード・ツールは変えない）。
     * @returns {void}
     */
    #handleAddGroup() {
        const action = resolveFolderButtonAction({
            mode: this.#getMode(),
            hasUnits: this.#groupEditor.hasSelectedUnits(),
            isDragging: this.#isDragging(),
            isRowDragging: this.#rowDrag.isActive(),
            isLocked: isListLocked(this.#canvasLibrary.getState())
        });
        if (action === FOLDER_BUTTON_ACTION.GROUP) {
            this.#groupEditor.groupSelection();
        } else if (action === FOLDER_BUTTON_ACTION.ADD_AND_SELECT) {
            this.#groupEditor.addEmptyGroup({ selects: true });
        } else if (action === FOLDER_BUTTON_ACTION.ADD) {
            this.#groupEditor.addEmptyGroup({ selects: false });
        }
    }

    /**
     * 名前の編集の開始を処理する。始めるかは`canStartNameEdit`に任せ、始めるなら表示を今の`model`にそろえて欄を出す。
     * @param {string} id - ダブルクリックされた行のid（図形またはフォルダ）
     * @param {MouseEvent} event - ダブルクリックのイベント
     * @returns {void}
     */
    #handleNameEditRequest(id, event) {
        const canStart = canStartNameEdit({
            isDragging: this.#isDragging(),
            isLocked: isListLocked(this.#canvasLibrary.getState()),
            hasModifier: this.#readCtrlModifier(event) || event.shiftKey === true
        });
        if (!canStart) return;
        const row = buildItemRows(this.#model.getItems()).find((candidate) => candidate.id === id);
        if (!row) return;
        this.sync({ allowScroll: false });
        this.#panel.startNameEdit(id, row.name);
    }

    /**
     * 行へのカーソルの出入りを処理する。判定は`resolveRowHover`に任せ、返った値に従って`model`へ反映するだけ。
     * @param {string|null} id - カーソルのある行のid（図形またはフォルダ。行の無い所・外へ出たときは`null`）
     * @returns {void}
     */
    #handleRowHover(id) {
        const model = this.#model;
        const action = resolveRowHover({
            id,
            hoveredRowId: this.#hoveredRowId,
            hoveredId: model.getHoveredId(),
            isDragging: this.#isDragging() || this.#rowDrag.isMoving(),
            queryLocked: () => isListLocked(this.#canvasLibrary.getState()),
            queryExists: (shapeId) => model.getShapes().some((shape) => shape.id === shapeId)
        });
        if (action === ROW_HOVER_ACTION.RECORD) {
            this.#hoveredRowId = id;
        } else if (action === ROW_HOVER_ACTION.SET) {
            model.setHovered(id);
            this.#hoveredRowId = id;
        } else if (action === ROW_HOVER_ACTION.CLEAR) {
            this.#clearOwnHover();
        }
    }

    /**
     * 自分が出したホバーを消す（キャンバス側が出したホバーは消さない）。記録は常に`null`へ戻す。
     * @returns {void}
     */
    #clearOwnHover() {
        if (isOwnHover(this.#hoveredRowId, this.#model.getHoveredId())) {
            this.#model.clearHovered();
        }
        this.#hoveredRowId = null;
    }

    /**
     * 同期を次のフレームへ予約する（予約済みなら何もしない）。通知のたびに行を組み立てない。
     * @returns {void}
     */
    #requestSync() {
        if (this.#isSyncRequested) return;
        this.#isSyncRequested = true;
        requestAnimationFrame(() => {
            this.#isSyncRequested = false;
            this.sync();
        });
    }

    /**
     * 見えている行（前後に余裕を足す）のサムネイルのうち、図形の今の内容が最後に描いたものと違う行だけ描き直す。
     * @param {Array<{id: string, shape: ?Object}>} rows - 行（先頭＝いちばん上。フォルダの行は`shape`が`null`で飛ばす）
     * @returns {void}
     */
    #drawVisibleThumbnails(rows) {
        const { scrollTop, height, rowHeight } = this.#panel.getViewport();
        const { start, end } = resolveVisibleRowRange({
            scrollTop,
            height,
            rowHeight,
            rowCount: rows.length,
            overscan: THUMBNAIL_OVERSCAN_ROWS
        });
        const pixelRatio = window.devicePixelRatio || 1;
        for (let index = start; index < end; index++) {
            const row = rows[index];
            if (!row.shape) continue;
            const canvas = this.#panel.getThumbnailCanvas(row.id);
            if (!canvas) continue;
            const key = buildThumbnailKey(row.shape.toJSON(), pixelRatio);
            if (!needsThumbnailRedraw(this.#drawnKeys.get(canvas), key)) continue;
            drawThumbnail(canvas, row.shape, this.#shapeExtentReader.getShapeBounds(row.shape), pixelRatio);
            this.#drawnKeys.set(canvas, key);
        }
    }
}
