/**
 * 責務: 端点への吸い付きの照会（直線を描くとき・端点のハンドルのドラッグ中）と、吸い付いた端点での描き足し・結合・閉じる操作の
 * モデルへの反映を、規則（`shapes/EndpointSnapRules`・`shapes/PathJoinRules`）に従って行う手順を担う。DOMに触れない。
 */
import {
    SNAP_TOLERANCE_SCREEN_PX,
    isSnapDrawShapeType,
    resolveEndpointHandle,
    findSnapTarget
} from '../shapes/EndpointSnapRules.js';
import {
    JOIN_TOLERANCE_SCREEN_PX,
    planDrawnLineJoin,
    planEndpointDragJoin
} from '../shapes/PathJoinRules.js';

/**
 * 端点への吸い付きの照会と、吸い付いた端点での描き足し・結合・閉じる操作の反映を行うクラス。
 * `main.js`が生成して`InputTracker`へ注入する（`InputTracker`は注入されたものを呼ぶだけ）。
 *
 * 依存の制約:
 *   - importは`../shapes/EndpointSnapRules.js`と`../shapes/PathJoinRules.js`のみ（`edit/`の例外）。
 *     VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。`model`は`getShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`のみ使う。
 *   - InputTrackerには依存しない。DOMに触れない。
 *   - 図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない（読むのは共通プロパティ`id`のみ）。
 *   - `try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）:
 *   - `commitDrawnLine`は作成途中の直線があるときに呼ぶ。
 *   - `joinDraggedEndpoint`は呼び出し側が開いた編集操作の中で、選択モードのときに呼ぶ（記録の確定も呼び出し側）。
 *
 * 通知の回数: `commitDrawnLine`は`cancelDraft`（1回）と`replaceShape`（1回）。`joinDraggedEndpoint`は`replaceShape`（1回）。
 */
export class EndpointSnapper {
    /**
     * 図形一式と作成途中の図形を保持するモデル。
     * @type {import('../core/VectorModel.js').VectorModel}
     */
    #model;

    /**
     * 編集操作の開始・確定を受け取る記録先（実体はmain.jsが注入するHistoryManager）。
     * @type {import('./ShapeInserter.js').EditRecorder}
     */
    #editRecorder;

    /**
     * 画面上の長さをワールド座標の長さへ換算する注入関数。呼び出しのたびに使う。
     * @type {(length: number) => number}
     */
    #screenLengthToWorld;

    /**
     * @param {Object} deps - 依存オブジェクト
     * @param {import('../core/VectorModel.js').VectorModel} deps.model - 図形一式と作成途中の図形を保持するモデル
     * @param {import('./ShapeInserter.js').EditRecorder} deps.editRecorder - 編集操作の記録先（実体はHistoryManager）
     * @param {(length: number) => number} deps.screenLengthToWorld - 画面上の長さ→ワールド座標の長さの換算関数
     */
    constructor({ model, editRecorder, screenLengthToWorld }) {
        this.#model = model;
        this.#editRecorder = editRecorder;
        this.#screenLengthToWorld = screenLengthToWorld;
    }

    /**
     * 直線を描くときの吸い付く端点を照会する。
     * `isSnapDrawShapeType(shapeType)`が偽なら`screenLengthToWorld`も呼ばず`null`。
     * 真なら`findSnapTarget(model.getShapes(), point, screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX))`。
     * @param {*} shapeType 描く図形種別（不透明な値として規則へ渡す）
     * @param {{x: number, y: number}} point 照会する点（ワールド座標）
     * @returns {import('../shapes/EndpointSnapRules.js').SnapTarget|null} 吸い付く端点。無ければnull
     */
    findDrawSnap(shapeType, point) {
        if (!isSnapDrawShapeType(shapeType)) {
            return null;
        }
        return findSnapTarget(
            this.#model.getShapes(),
            point,
            this.#screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX)
        );
    }

    /**
     * ドラッグ開始したハンドルが結合できる線の端点のハンドルかを解決する。
     * 図形が`model.getShapes()`に無ければ`null`。あれば`resolveEndpointHandle`の結果。
     * @param {*} shapeId ドラッグしている図形のid
     * @param {*} handleName ドラッグしているハンドル名
     * @returns {'start'|'end'|null} 端点のハンドルなら'start'/'end'、それ以外はnull
     */
    resolveDragEndpoint(shapeId, handleName) {
        const shape = this.#model.getShapes().find((s) => s.id === shapeId);
        if (shape === undefined) {
            return null;
        }
        return resolveEndpointHandle(shape, handleName);
    }

    /**
     * 端点のハンドルのドラッグ中の吸い付く端点を照会する（ドラッグしている端点は対象外）。
     * @param {{shapeId: *, end: 'start'|'end'}} dragged ドラッグしている端点
     * @param {{x: number, y: number}} point 照会する点（ワールド座標）
     * @returns {import('../shapes/EndpointSnapRules.js').SnapTarget|null} 吸い付く端点。無ければnull
     */
    findDragSnap(dragged, point) {
        return findSnapTarget(
            this.#model.getShapes(),
            point,
            this.#screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX),
            dragged
        );
    }

    /**
     * 描き終えた直線を、吸い付いた端点での描き足し・結合・閉じる操作として反映する。
     *
     * 処理順:
     *   1. 両方`null`なら何も呼ばず`false`（`screenLengthToWorld`も呼ばない。呼び出し側が従来の確定を行う）。
     *   2. `planDrawnLineJoin`で計画を作る（許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`）。作成途中の図形が無ければ計画なし。
     *   3. `model.cancelDraft()`で作成途中の直線を捨てる。
     *   4. 計画が`null`なら`true`を返して終わる（何も起きない。`beginEdit`/`commitEdit`を呼ばない）。
     *   5. `editRecorder.beginEdit()` → `model.replaceShape(..., { keepId, removeIds, select: false })` → `editRecorder.commitEdit()`。`true`を返す。
     *
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} startSnap 描き始めの点が吸い付いた端点
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} endSnap 描き終えの点が吸い付いた端点
     * @returns {boolean} 反映（または何も起きない扱い）にしたか。両方nullのときだけfalse
     */
    commitDrawnLine(startSnap, endSnap) {
        if (startSnap === null && endSnap === null) {
            return false;
        }
        const drawn = this.#model.getDraftShape();
        const plan = drawn === null || drawn === undefined
            ? null
            : planDrawnLineJoin(
                this.#model.getShapes(),
                drawn,
                startSnap,
                endSnap,
                this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)
            );
        this.#model.cancelDraft();
        if (plan === null) {
            return true;
        }

        this.#editRecorder.beginEdit();
        this.#model.replaceShape(plan.targetId, plan.path, {
            keepId: plan.keepId,
            removeIds: plan.removeIds,
            select: false
        });
        this.#editRecorder.commitEdit();
        return true;
    }

    /**
     * 端点のハンドルをドラッグして吸い付いたまま離したときの、結合・閉じる操作を反映する。
     * `beginEdit`/`commitEdit`は呼ばない（呼び出し側が開いた編集操作の中で行い、頂点の移動とあわせて1件になる）。
     *
     * 処理順:
     *   1. `planEndpointDragJoin`で計画を作る（許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`）。`null`なら何も呼ばず`false`。
     *   2. `model.replaceShape(..., { keepId, removeIds, select: true })`（結果だけを選択）。`true`を返す。
     *
     * @param {{shapeId: *, end: 'start'|'end'}} dragged ドラッグしていた端点
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} snap 吸い付いた端点
     * @returns {boolean} 反映したか（計画がnullのときfalse）
     */
    joinDraggedEndpoint(dragged, snap) {
        const plan = planEndpointDragJoin(
            this.#model.getShapes(),
            dragged,
            snap,
            this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)
        );
        if (plan === null) {
            return false;
        }

        this.#model.replaceShape(plan.targetId, plan.path, {
            keepId: plan.keepId,
            removeIds: plan.removeIds,
            select: true
        });
        return true;
    }
}
