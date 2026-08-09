/**
 * 責務：ユーザー入力の解釈とModelへの反映を担う。
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
         * 現在アクティブなツール種別（'select' / 'line'）。ツールに応じてhandleMouseMove/
         * handleMouseDown/handleClickの入力解釈を排他的に切り替える。setTool()経由でのみ更新する。
         * @type {'select'|'line'}
         */
        this.currentTool = 'select';

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
    }

    /**
     * アクティブなツールを切り替える。
     * 呼び出し時は常に、(1)currentToolの更新、(2)選択状態・ホバー状態の無条件クリア、
     * (3)進行中の作成/ドラッグ操作（DRAWING/DRAGGING_HANDLE状態）があればcancelDraft()で
     * 破棄したうえでIDLE状態へ強制リセット、の3処理を行う（ツール切り替え時に前ツールの
     * 状態が残留することを防ぐため）。
     * @param {'select'|'line'} tool 切り替え先のツール種別
     */
    setTool(tool) {
        this.currentTool = tool;

        this.model.clearSelection();
        this.model.clearHovered();

        if (this.state === InputState.DRAWING || this.state === InputState.DRAGGING_HANDLE) {
            this.model.cancelDraft();
            this.state = InputState.IDLE;
        }
    }

    /**
     * mousemoveイベントのハンドラ。
     * IDLE状態では、図形配列に対し shape.hitTest(...) をポリモーフィックに呼び出して
     * ホバー判定を行い、該当図形があればModelへホバー登録、なければホバー解除する。
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

        if (this.state !== InputState.IDLE || this.currentTool !== 'select') {
            return;
        }

        const { x, y } = this.getLogicalCoordinate(event);
        const hitShape = this.model.getShapes().find((shape) => shape.hitTest(x, y, this.hitTolerance));

        if (hitShape) {
            this.model.setHovered(hitShape.id);
        } else {
            this.model.clearHovered();
        }
    }

    /**
     * mousedownイベントのハンドラ。
     * IDLE状態で選択中図形が存在する場合のみ、その図形へ shape.hitTestHandle(...) を
     * ポリモーフィックに呼び出してハンドル上での押下かを判定する。該当すれば操作対象の
     * ハンドル種別・図形id・直前カーソル座標を記憶し、DRAGGING_HANDLE状態へ遷移する。
     * @param {MouseEvent} event
     */
    handleMouseDown(event) {
        if (this.state !== InputState.IDLE || this.currentTool !== 'select') {
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
     * IDLE状態では、ホバー中の図形があればそれを選択状態にする。
     * ホバー中の図形がない（空白部分のクリック）場合は、選択中であればまず選択解除し、
     * その上でModelへ新規Line作成の開始を指示してDRAWING状態へ遷移する。
     * 作成する図形のtypeには、現在アクティブなツール種別（currentTool）をそのまま使用する。
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

        if (this.currentTool === 'select') {
            const hoveredId = this.model.getHoveredId();
            if (hoveredId) {
                this.model.selectShape(hoveredId);
            } else if (this.model.getSelectedId()) {
                this.model.clearSelection();
            }
            return;
        }

        this.model.startDraft(x, y, this.currentTool);
        this.state = InputState.DRAWING;
    }

    /**
     * keydownイベントのハンドラ。documentへ購読する（<canvas>要素はデフォルトでフォーカスを
     * 持てずキーボードイベントを受け取れないため）。
     * selectツール中に選択中図形が存在する状態でDelete/Backspaceが押下された場合のみ、
     * ブラウザのデフォルト動作（Backspaceでの戻る操作等）をpreventDefault()で抑止した上で、
     * その図形をModelから削除する。
     * @param {KeyboardEvent} event
     */
    handleKeyDown(event) {
        if (this.currentTool !== 'select') {
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
}
