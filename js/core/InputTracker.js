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
                const vertexIndex = this.activeHandle === 'start' ? 0 : 1;
                this.model.updateVertex(this.activeShapeId, vertexIndex, x, y);
            }
            return;
        }

        if (this.state !== InputState.IDLE) {
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
        if (this.state !== InputState.IDLE) {
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
        const hoveredId = this.model.getHoveredId();

        if (hoveredId) {
            this.model.selectShape(hoveredId);
            return;
        }

        if (this.model.getSelectedId()) {
            this.model.clearSelection();
        }
        this.model.startDraft(x, y);
        this.state = InputState.DRAWING;
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
