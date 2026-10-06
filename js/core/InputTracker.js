/**
 * 責務：ユーザー入力の解釈とModelへの反映、および入力解釈の状態（操作モード・当たり判定）に
 * 応じたキャンバス上のマウスカーソル形状のフィードバックを担う。
 */

/**
 * InputTrackerが取りうる内部状態。
 * IDLE: 待機状態（ホバー判定・クリックによる新規作成/選択待ち）。
 * DRAWING: 新規Line作成中（始点確定済み、終点をカーソルに追従させている）。
 * DRAGGING_HANDLE: 選択中図形のハンドル（start/end/move）をドラッグ中。
 * @readonly
 * @enum {string}
 */
export const InputState = {
    IDLE: 'IDLE',
    DRAWING: 'DRAWING',
    DRAGGING_HANDLE: 'DRAGGING_HANDLE',
};

/**
 * 操作モード。コントロールパネルの各ボタンはこの値に1対1で対応する。
 * SELECT: 選択モード（ホバー判定・選択・ハンドルドラッグ・削除）。
 * CREATE: 図形作成モード（currentShapeTypeの図形を新規作成）。
 * パンモード等のモードを追加する際は、ここへ1エントリを追加する（setMode()のバリデーションは本定義の値を正とする）。
 * @readonly
 * @enum {string}
 */
export const OperationMode = Object.freeze({
    SELECT: 'select',
    CREATE: 'create',
});

/**
 * 図形作成モードで作成可能な図形種別のホワイトリスト。setShapeType()の引数バリデーション
 * （includes()による受理判定）のみに用いる。図形種別ごとの分岐には用いない。
 * ※ShapeFactoryの受理種別と一致させること。
 * @type {ReadonlyArray<'line'|'curve'|'arc'|'rect'|'circle'>}
 */
export const SHAPE_TYPES = Object.freeze(['line', 'curve', 'arc', 'rect', 'circle']);

/**
 * キャンバスのマウス・キーボード入力を解釈し、VectorModelの対応APIを呼び出す状態遷移マシン
 * （IDLE / DRAWING / DRAGGING_HANDLE）。操作モード（currentMode）と図形種別（currentShapeType）を
 * 独立した状態として保持し、操作モード・入力状態・当たり判定に応じてキャンバスのカーソル形状を更新する。
 */
export class InputTracker {
    /**
     * @param {HTMLCanvasElement} canvas - イベントをリッスンするキャンバス
     * @param {Object} model - 図形データを管理するVectorModelインスタンス
     */
    constructor(canvas, model) {
        this.canvas = canvas;
        this.model = model;

        /**
         * 現在の内部状態（IDLE / DRAWING / DRAGGING_HANDLE）。状態遷移マシンの起点。
         * @type {string}
         */
        this.state = InputState.IDLE;

        /**
         * 現在の操作モード（OperationModeの値）。モードに応じてhandleMouseMove/handleMouseDown/
         * handleClick/handleKeyDownの入力解釈を排他的に切り替える。setMode()経由でのみ更新する。
         * @type {'select'|'create'}
         */
        this.currentMode = OperationMode.SELECT;

        /**
         * 図形作成モードで作成する図形種別（SHAPE_TYPESのいずれか）。setShapeType()経由でのみ更新する。
         * 操作モードの切り替えではリセットされないため、図形作成モードへ戻った際は前回の種別へ復帰する。
         * @type {'line'|'curve'|'arc'|'rect'|'circle'}
         */
        this.currentShapeType = 'line';

        /**
         * DRAGGING_HANDLE状態中、moveハンドルの差分移動計算に用いる直前のカーソル論理座標。
         * IDLE/DRAWING状態では未使用（null）。
         * @type {{x: number, y: number} | null}
         */
        this.lastCursor = null;

        /**
         * DRAGGING_HANDLE状態中に操作しているハンドルの種別。mousedown時にhitTestHandleの
         * 戻り値を記憶しておき、mousemove/mouseupから参照する。
         * IDLE/DRAWING状態では未使用（null）。
         * @type {'start'|'end'|'move'|null}
         */
        this.activeHandle = null;

        /**
         * DRAGGING_HANDLE状態中に操作している図形のid。
         * IDLE/DRAWING状態では未使用（null）。
         * @type {string|null}
         */
        this.activeShapeId = null;

        /**
         * 当たり判定（線分本体のhitTest・ハンドルのhitTestHandle共通）の許容誤差。
         * 論理座標系のピクセル単位。
         * @type {number}
         */
        this.hitTolerance = 5;

        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('click', this.handleClick.bind(this));
        document.addEventListener('keydown', this.handleKeyDown.bind(this));

        this.#updateCursor();
    }

    /**
     * 操作モードを切り替える。
     * OperationModeに定義されていない値が渡された場合はconsole.warnを出して何もしない
     * （内部状態・選択状態・カーソルは一切変更しない）。
     * 有効な値の場合は常に（同じモードの再指定でも）、(1)currentModeの更新、(2)選択状態・
     * ホバー状態の無条件クリア、(3)進行中の作成/ドラッグ操作（DRAWING/DRAGGING_HANDLE状態）が
     * あればcancelDraft()で破棄したうえでIDLE状態へ強制リセット、(4)カーソル形状の再評価、
     * の4処理を行う（モード切り替え時に前モードの状態が残留することを防ぐため）。
     * 図形種別（currentShapeType）は変更しない。
     * @param {'select'|'create'} mode 切り替え先の操作モード（OperationModeの値）
     */
    setMode(mode) {
        if (!Object.values(OperationMode).includes(mode)) {
            console.warn(`InputTracker.setMode: 未知の操作モードのため無視します: ${mode}`);
            return;
        }

        this.currentMode = mode;

        this.model.clearSelection();
        this.model.clearHovered();

        if (this.state === InputState.DRAWING || this.state === InputState.DRAGGING_HANDLE) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
        }

        this.#updateCursor();
    }

    /**
     * 図形作成モードで作成する図形種別を切り替える。
     * SHAPE_TYPESに含まれない値が渡された場合はconsole.warnを出して何もしない。
     * 有効な値の場合はcurrentShapeTypeを更新し、作成途中の図形（DRAWING状態）があれば
     * cancelDraft()で破棄してIDLE状態へ戻す。
     * 操作モード・選択状態・ホバー状態・カーソル形状は変更しない（図形作成モード中に呼ばれても
     * モードは'create'のまま維持される）。
     * @param {'line'|'curve'|'arc'|'rect'|'circle'} type 切り替え先の図形種別（SHAPE_TYPESのいずれか）
     */
    setShapeType(type) {
        if (!SHAPE_TYPES.includes(type)) {
            console.warn(`InputTracker.setShapeType: 未知の図形種別のため無視します: ${type}`);
            return;
        }

        this.currentShapeType = type;

        if (this.state === InputState.DRAWING) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
        }
    }

    /**
     * 現在の操作モードを返す。UI側がバリデーション後の実際の内部状態を読み返して表示を同期するために用いる。
     * @returns {'select'|'create'} 現在の操作モード（OperationModeの値）
     */
    getMode() {
        return this.currentMode;
    }

    /**
     * 現在記憶している図形種別を返す。UI側がバリデーション後の実際の内部状態を読み返して表示を同期するために用いる。
     * @returns {'line'|'curve'|'arc'|'rect'|'circle'} 現在の図形種別（SHAPE_TYPESのいずれか）
     */
    getShapeType() {
        return this.currentShapeType;
    }

    /**
     * mousemoveイベントのハンドラ。
     * IDLE状態かつ選択モード中のみ、図形配列に対し shape.hitTest(...) をポリモーフィックに呼び出して
     * ホバー判定を行い、該当図形があればModelへホバー登録、なければホバー解除した上で、
     * カーソル位置に応じてカーソル形状を更新する（選択モード以外のIDLE状態では何もしない）。
     * DRAWING状態では、作成中Lineの終点をカーソル位置に追従させる。
     * DRAGGING_HANDLE状態では、start/endハンドルなら現在の論理座標をそのままModelへ、
     * moveハンドルなら直前カーソル座標との差分をModelへ渡し、直前カーソル座標を更新する。
     * @param {MouseEvent} event
     */
    handleMouseMove(event) {
        if (this.state === InputState.DRAWING) {
            const { x, y } = this.getLogicalCoordinate(event);
            this.model.updateDraft(x, y);
            return;
        }

        if (this.state === InputState.DRAGGING_HANDLE) {
            const { x, y } = this.getLogicalCoordinate(event);

            if (this.activeHandle === 'move') {
                const dx = x - this.lastCursor.x;
                const dy = y - this.lastCursor.y;
                this.model.moveShape(this.activeShapeId, dx, dy);
                this.lastCursor = { x, y };
            } else {
                const shape = this.model.getShapes().find((s) => s.id === this.activeShapeId);
                const vertexIndex = shape.getVertexIndexForHandle(this.activeHandle);
                this.model.updateVertex(this.activeShapeId, vertexIndex, x, y);
            }
            return;
        }

        if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) {
            return;
        }

        const { x, y } = this.getLogicalCoordinate(event);
        const hitShape = this.model.getShapes().find((shape) => shape.hitTest(x, y, this.hitTolerance));

        if (hitShape) {
            this.model.setHovered(hitShape.id);
        } else {
            this.model.clearHovered();
        }

        this.#updateCursor({ x, y });
    }

    /**
     * mousedownイベントのハンドラ。
     * IDLE状態かつ選択モード中で、選択中図形が存在する場合のみ、その図形へ shape.hitTestHandle(...) を
     * ポリモーフィックに呼び出してハンドル上での押下かを判定する。該当すれば操作対象の
     * ハンドル種別・図形id・直前カーソル座標を記憶し、DRAGGING_HANDLE状態へ遷移してカーソル形状を更新する。
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        if (this.state !== InputState.IDLE || this.currentMode !== OperationMode.SELECT) {
            return;
        }

        const selectedId = this.model.getSelectedId();
        if (!selectedId) {
            return;
        }

        const selectedShape = this.model.getShapes().find((shape) => shape.id === selectedId);
        if (!selectedShape) {
            return;
        }

        const { x, y } = this.getLogicalCoordinate(event);
        const handle = selectedShape.hitTestHandle(x, y, this.hitTolerance);
        if (!handle) {
            return;
        }

        this.activeHandle = handle;
        this.activeShapeId = selectedId;
        this.lastCursor = { x, y };
        this.state = InputState.DRAGGING_HANDLE;
        this.#updateCursor();
    }

    /**
     * mouseupイベントのハンドラ。
     * DRAGGING_HANDLE状態でのハンドルドラッグを終了し、IDLE状態へ遷移する。
     * @param {MouseEvent} event
     */
    handleMouseUp(event) {
        if (this.state !== InputState.DRAGGING_HANDLE) {
            return;
        }

        this.state = InputState.IDLE;
    }

    /**
     * clickイベントのハンドラ。
     * DRAWING状態では、作成中Lineを確定登録してIDLE状態へ遷移する。
     * IDLE状態かつ選択モード中では、ホバー中の図形があればそれを選択状態にし、
     * ホバー中の図形がない（空白部分のクリック）場合は、選択中であれば選択解除する。
     * IDLE状態かつ図形作成モード中では、Modelへ新規図形作成の開始を指示してDRAWING状態へ遷移する。
     * 作成する図形のtypeには、現在記憶している図形種別（currentShapeType）をそのまま使用する。
     * 選択モード・図形作成モード以外のモードでは、IDLE状態のクリックを無視する。
     * @param {MouseEvent} event
     */
    handleClick(event) {
        if (this.state === InputState.DRAWING) {
            this.model.commitDraft();
            this.state = InputState.IDLE;
            return;
        }

        if (this.state !== InputState.IDLE) {
            return;
        }

        const { x, y } = this.getLogicalCoordinate(event);

        if (this.currentMode === OperationMode.SELECT) {
            const hoveredId = this.model.getHoveredId();
            if (hoveredId) {
                this.model.selectShape(hoveredId);
            } else if (this.model.getSelectedId()) {
                this.model.clearSelection();
            }
            return;
        }

        if (this.currentMode === OperationMode.CREATE) {
            this.model.startDraft(x, y, this.currentShapeType);
            this.state = InputState.DRAWING;
        }
    }

    /**
     * keydownイベントのハンドラ。documentへ購読する（<canvas>要素はデフォルトでフォーカスを
     * 持てずキーボードイベントを受け取れないため）。
     * 選択モード中に選択中図形が存在する状態でDelete/Backspaceが押下された場合のみ、
     * ブラウザのデフォルト動作（Backspaceでの戻る操作等）をpreventDefault()で抑止した上で、
     * その図形をModelから削除する。
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (this.currentMode !== OperationMode.SELECT) {
            return;
        }

        const selectedId = this.model.getSelectedId();
        if (!selectedId) {
            return;
        }

        if (event.key !== 'Delete' && event.key !== 'Backspace') {
            return;
        }

        event.preventDefault();
        this.model.deleteShape(selectedId);
    }

    /**
     * マウスイベントからCanvas内の論理座標を取得する
     * ※将来的にキャンバスのズーム・パン機能を追加する際は、本メソッドの座標計算ロジックの修正が必要
     * 
     * @param {MouseEvent} event 
     * @returns {{x: number, y: number}} Canvas内部の論理座標
     */
    getLogicalCoordinate(event) {
        const rect = this.canvas.getBoundingClientRect();

        // CSSでの表示サイズ（論理サイズ）と実際のDOM要素サイズ（rect）の比率から
        // CSSのズーム等による表示位置ズレを完全に吸収して論理座標へ逆換算する
        const scaleX = this.canvas.clientWidth / rect.width;
        const scaleY = this.canvas.clientHeight / rect.height;

        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        return { x, y };
    }

    /**
     * 現在の操作モード・入力状態・カーソル位置から、キャンバスに適用すべきCSS cursor値を判定する。
     * DOMには触れない純粋な判定関数。判定順序：
     * (1)図形作成モード → 'crosshair'（作成途中を含む）、
     * (2)選択モード以外のモード → 'default'（将来のモード追加時の既定値）、
     * (3)DRAGGING_HANDLE状態 → 'move'、
     * (4)座標不明（point === null） → 'default'、
     * (5)選択中図形のハンドル上（shape.hitTestHandle(...)のポリモーフィック呼び出し） → 'move'、
     * (6)ホバー中の図形あり（直前のhandleMouseMoveで更新されたホバー状態を再利用） → 'pointer'、
     * (7)それ以外 → 'default'。
     * @param {{x: number, y: number} | null} point カーソルの論理座標。座標が不明なとき（setMode直後等）はnull
     * @returns {'crosshair'|'move'|'pointer'|'default'} 適用すべきCSS cursor値
     */
    #resolveCursor(point) {
        if (this.currentMode === OperationMode.CREATE) {
            return 'crosshair';
        }

        if (this.currentMode !== OperationMode.SELECT) {
            return 'default';
        }

        if (this.state === InputState.DRAGGING_HANDLE) {
            return 'move';
        }

        if (point === null) {
            return 'default';
        }

        const selectedId = this.model.getSelectedId();
        const selectedShape = selectedId
            ? this.model.getShapes().find((shape) => shape.id === selectedId)
            : null;
        if (selectedShape && selectedShape.hitTestHandle(point.x, point.y, this.hitTolerance)) {
            return 'move';
        }

        if (this.model.getHoveredId()) {
            return 'pointer';
        }

        return 'default';
    }

    /**
     * #resolveCursor(point)の判定結果をキャンバス要素のCSS cursorへ適用する。
     * @param {{x: number, y: number} | null} [point=null] カーソルの論理座標。座標が不明なときはnull
     */
    #updateCursor(point = null) {
        this.canvas.style.cursor = this.#resolveCursor(point);
    }
}
