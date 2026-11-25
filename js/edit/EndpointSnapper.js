/**
 * 責務: 端点への吸い付きの照会（直線・曲線のツールで描くとき・端点のハンドルのドラッグ中。線を引いている途中は作成途中の線の始点も）と、
 * 吸い付いた端点での描き足し・結合・閉じる操作、および直線・曲線のツールで続けて引く線の点を打つ・最後の点を消す・終える操作の
 * モデルへの反映を、規則（`shapes/EndpointSnapRules`・`shapes/PathJoinRules`）に従って行う手順を担う。DOMに触れない。
 */
import {
    SNAP_TOLERANCE_SCREEN_PX,
    isSnapDrawShapeType,
    resolveEndpointHandle,
    findSnapTarget,
    isDrawnStartSnap,
    findDrawnLineSnapTarget
} from '../shapes/EndpointSnapRules.js';
import {
    JOIN_TOLERANCE_SCREEN_PX,
    planDrawnLineJoin,
    planEndpointDragJoin,
    isDrawnLineShape,
    addDrawnPoint,
    removeLastDrawnPoint,
    buildFinishedDrawnLine,
    getLastDrawnPoint,
    isOnLastDrawnPoint,
    canCloseDrawnLine
} from '../shapes/PathJoinRules.js';

/**
 * 端点への吸い付きの照会と、吸い付いた端点での描き足し・結合・閉じる操作の反映を行うクラス。
 * `main.js`が生成して`InputTracker`へ注入する（`InputTracker`は注入されたものを呼ぶだけ）。
 *
 * 依存の制約:
 *   - importは`../shapes/EndpointSnapRules.js`と`../shapes/PathJoinRules.js`のみ（`edit/`の例外）。
 *     VectorModel・HistoryManagerはimportせず、インスタンスを注入で受け取る。`model`は`getShapes`（変えられなくなった図形の判定だけ）・`getEditableShapes`・`getDraftShape`・`cancelDraft`・`replaceShape`・`replaceDraft`・`commitDraft`のみ使う。
 *   - InputTrackerには依存しない。DOMに触れない。
 *   - 吸い付く先・結合の対象は変えられる図形（`model.getEditableShapes()`）だけ。隠れている・ロックされている図形の端点には吸い付かず、結合・描き足しもしない。
 *   - 図形種別の分岐・図形固有のプロパティ名・idの形式・操作モードの知識を持たない（読むのは共通プロパティ`id`のみ）。
 *   - `try/catch`を持たない。
 *
 * 前提（呼び出し側の責務）:
 *   - `commitDrawnLine`は作成途中の線があるときに呼ぶ。
 *   - 線を引く手順のメソッド（`findDrawnLineSnap`・`getDrawnLineLastPoint`・`clickDrawnLine`・`finishDrawnLine`・`removeDrawnLinePoint`）は、
 *     作成途中の線があるとき（`isDrawingLine()`が真のとき）に呼ぶ。
 *   - `joinDraggedEndpoint`は呼び出し側が開いた編集操作の中で、選択モードのときに呼ぶ（記録の確定も呼び出し側）。
 *
 * 通知の回数: `commitDrawnLine`は`cancelDraft`（1回）と`replaceShape`（1回）。`joinDraggedEndpoint`は`replaceShape`（1回）。
 *   `clickDrawnLine`は点を打つとき`replaceDraft`（1回）、閉じるとき`replaceDraft`と`commitDraft`（各1回）、つながって終えるとき`commitDrawnLine`と同じ。
 *   開いたまま終えるときは`finishDrawnLine(startSnap)`に任せるため、下の`finishDrawnLine`の行と同じ（吸い付きなしなら`replaceDraft`と`commitDraft`、描き始めが端点なら`cancelDraft`と`replaceShape`、打った点が始点だけなら`cancelDraft`のみ）。
 *   `finishDrawnLine`は点が始点だけのとき`cancelDraft`（1回）、吸い付きなしで終えるとき`replaceDraft`と`commitDraft`（各1回）、描き始めが端点のとき`cancelDraft`と`replaceShape`（各1回）。
 *   `removeDrawnLinePoint`は`replaceDraft`（1回）または`cancelDraft`（1回）。
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
     * 直線・曲線のツールで描き始めるときの吸い付く端点を照会する。
     * `isSnapDrawShapeType(shapeType)`が偽（直線・曲線のツール以外）なら`screenLengthToWorld`も呼ばず`null`。
     * 真なら`findSnapTarget(model.getEditableShapes(), point, screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX))`。
     * @param {*} shapeType 描く図形種別（不透明な値として規則へ渡す）
     * @param {{x: number, y: number}} point 照会する点（ワールド座標）
     * @returns {import('../shapes/EndpointSnapRules.js').SnapTarget|null} 吸い付く端点。無ければnull
     */
    findDrawSnap(shapeType, point) {
        if (!isSnapDrawShapeType(shapeType)) {
            return null;
        }
        return findSnapTarget(
            this.#model.getEditableShapes(),
            point,
            this.#screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX)
        );
    }

    /**
     * ドラッグ開始したハンドルが結合できる線の端点のハンドルかを解決する。
     * 図形が`model.getEditableShapes()`に無ければ`null`。あれば`resolveEndpointHandle`の結果。
     * @param {*} shapeId ドラッグしている図形のid
     * @param {*} handleName ドラッグしているハンドル名
     * @returns {'start'|'end'|null} 端点のハンドルなら'start'/'end'、それ以外はnull
     */
    resolveDragEndpoint(shapeId, handleName) {
        const shape = this.#model.getEditableShapes().find((s) => s.id === shapeId);
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
            this.#model.getEditableShapes(),
            point,
            this.#screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX),
            dragged
        );
    }

    /**
     * 描き終えた線を、吸い付いた端点での描き足し・結合・閉じる操作として反映する。
     * 作成途中の線は点が複数でもよい（付いてくる線の先＝`endSnap`の端点を含む並び）。
     * `endSnap`に`DrawnStartSnap`（始点への吸い付き）を渡してはならない（`clickDrawnLine`が先に扱う）。
     *
     * 処理順:
     *   1. 両方`null`なら何も呼ばず`false`（`screenLengthToWorld`も呼ばない。呼び出し側が従来の確定を行う）。
     *   2. `#reflectDrawnJoin(作成途中の図形, startSnap, endSnap)`で次の3.〜6.を行う（`finishDrawnLine`と共有）。
     *   3. `planDrawnLineJoin`で計画を作る（許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`）。作成途中の図形が無ければ計画なし。
     *   4. `model.cancelDraft()`で作成途中の線（直線・曲線のツールの線）を捨てる。
     *   5. 計画が`null`なら何も起きない（`beginEdit`/`commitEdit`を呼ばない）。
     *   6. `editRecorder.beginEdit()` → `model.replaceShape(..., { keepId, removeIds, select: false })` → `editRecorder.commitEdit()`。
     *   7. `true`を返す。
     *
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} startSnap 描き始めの点が吸い付いた端点
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} endSnap 描き終えの点が吸い付いた端点
     * @returns {boolean} 反映（または何も起きない扱い）にしたか。両方nullのときだけfalse
     */
    commitDrawnLine(startSnap, endSnap) {
        startSnap = this.#toUsableSnap(startSnap);
        endSnap = this.#toUsableSnap(endSnap);
        if (startSnap === null && endSnap === null) {
            return false;
        }
        this.#reflectDrawnJoin(this.#model.getDraftShape(), startSnap, endSnap);
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
            this.#model.getEditableShapes(),
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

    /**
     * 線を引いている途中か（作成途中の図形が続けて引く線の形＝直線、または区間の種類によらず開いたパスか）を返す。
     * 直線のツールの作成途中の線は直線か直線の区間だけの開いたパス、曲線のツールの作成途中の線は曲線の区間の開いたパス
     * （打った点が1つの間も頂点2つの曲線のパス）。弧・矩形・円の作成途中の図形は当たらない。
     * モデル・記録先を変えない。
     * @returns {boolean} 線を引いている途中ならtrue
     */
    isDrawingLine() {
        const drawn = this.#model.getDraftShape();
        return drawn !== null && drawn !== undefined && isDrawnLineShape(drawn);
    }

    /**
     * 線を引いている途中の吸い付く先（描き始めの端点を除く端点と、作成途中の線の始点）を照会する。
     *
     * 処理順:
     *   1. 作成途中の図形が無ければ`screenLengthToWorld`も呼ばず`null`。
     *   2. `findDrawnLineSnapTarget(model.getEditableShapes(), 作成途中の図形, point, screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX), startSnap)`を返す。
     *
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} startSnap 描き始めの点が吸い付いた端点
     * @param {{x: number, y: number}} point 照会する点（ワールド座標）
     * @returns {import('../shapes/EndpointSnapRules.js').SnapTarget|import('../shapes/EndpointSnapRules.js').DrawnStartSnap|null} 吸い付く先。無ければnull
     */
    findDrawnLineSnap(startSnap, point) {
        startSnap = this.#toUsableSnap(startSnap);
        const drawn = this.#model.getDraftShape();
        if (drawn === null || drawn === undefined) {
            return null;
        }
        return findDrawnLineSnapTarget(
            this.#model.getEditableShapes(),
            drawn,
            point,
            this.#screenLengthToWorld(SNAP_TOLERANCE_SCREEN_PX),
            startSnap
        );
    }

    /**
     * 作成途中の線の最後の点（`Shift`の向きの限定の基準点）を返す。
     * 作成途中の図形が無ければ`null`。あれば`getLastDrawnPoint(作成途中の図形)`。
     * @returns {{x: number, y: number}|null} 最後の点（新しいオブジェクト）。無ければnull
     */
    getDrawnLineLastPoint() {
        const drawn = this.#model.getDraftShape();
        if (drawn === null || drawn === undefined) {
            return null;
        }
        return getLastDrawnPoint(drawn);
    }

    /**
     * 線を引いている途中のクリックを反映する。
     *
     * 処理順:
     *   1. 作成途中の図形が無ければ`false`。
     *   2. `endSnap`が始点への吸い付きで作成途中の線が閉じられるなら、`#commitDrawnShape(buildFinishedDrawnLine(作成途中の図形, true))`（閉じて終える）で`false`。
     *   3. 付いてくる線の先が最後の点と重なる（許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`）なら、`finishDrawnLine(startSnap)`（開いたまま終える）で`false`。
     *   4. `endSnap`が`null`でなく始点への吸い付きでもなければ、`commitDrawnLine(startSnap, endSnap)`（つながって終える）で`false`。
     *   5. それ以外（始点への吸い付きでも閉じられないときを含む）は`model.replaceDraft(addDrawnPoint(作成途中の図形))`（点を打つ。記録先に触れない）で`true`。
     *
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} startSnap 描き始めの点が吸い付いた端点
     * @param {import('../shapes/EndpointSnapRules.js').SnapTarget|import('../shapes/EndpointSnapRules.js').DrawnStartSnap|null} endSnap 直前の照会結果
     * @returns {boolean} 点を打って引き続けるならtrue、終えた（または何もしなかった）ならfalse
     */
    clickDrawnLine(startSnap, endSnap) {
        startSnap = this.#toUsableSnap(startSnap);
        endSnap = this.#toUsableSnap(endSnap);
        const drawn = this.#model.getDraftShape();
        if (drawn === null || drawn === undefined) {
            return false;
        }
        if (isDrawnStartSnap(endSnap) && canCloseDrawnLine(drawn)) {
            this.#commitDrawnShape(buildFinishedDrawnLine(drawn, true));
            return false;
        }
        if (isOnLastDrawnPoint(drawn, this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX))) {
            this.finishDrawnLine(startSnap);
            return false;
        }
        if (endSnap !== null && endSnap !== undefined && !isDrawnStartSnap(endSnap)) {
            this.commitDrawnLine(startSnap, endSnap);
            return false;
        }
        this.#model.replaceDraft(addDrawnPoint(drawn));
        return true;
    }

    /**
     * 線を引いている途中の線を、打った点だけで開いたまま終える（`Esc`・ツールの切り替え・最後の点のクリック）。戻り値なし。
     *
     * 処理順:
     *   1. 作成途中の図形が無ければ何もしない。
     *   2. `buildFinishedDrawnLine(作成途中の図形, false)`が`null`（打った点が始点だけ）なら`model.cancelDraft()`だけ（何も残さない。記録しない）。
     *   3. `startSnap`が`null`なら`#commitDrawnShape(終えた線)`。
     *   4. それ以外は`#reflectDrawnJoin(終えた線, startSnap, null, 作成途中の図形)`（描き始めの線の続きとして描き足す。計画が`null`なら作成途中の線を捨てるだけ）。
     *      描いた区間の種類は作成途中の線から読む（点2つの終えた線は`Line`で区間の種類を持たないため）。
     *
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} startSnap 描き始めの点が吸い付いた端点
     */
    finishDrawnLine(startSnap) {
        startSnap = this.#toUsableSnap(startSnap);
        const drawn = this.#model.getDraftShape();
        if (drawn === null || drawn === undefined) {
            return;
        }
        const finished = buildFinishedDrawnLine(drawn, false);
        if (finished === null) {
            this.#model.cancelDraft();
            return;
        }
        if (startSnap === null || startSnap === undefined) {
            this.#commitDrawnShape(finished);
            return;
        }
        this.#reflectDrawnJoin(finished, startSnap, null, drawn);
    }

    /**
     * 線を引いている途中の最後の点を消す。記録先に触れない。
     *
     * 処理順:
     *   1. 作成途中の図形が無ければ`false`。
     *   2. `removeLastDrawnPoint(作成途中の図形)`が`null`（打った点が始点だけ）なら`model.cancelDraft()`で`false`（引くのをやめる）。
     *   3. それ以外は`model.replaceDraft(消した線)`で`true`。
     *
     * @returns {boolean} 引き続けるならtrue、やめた（または何もしなかった）ならfalse
     */
    removeDrawnLinePoint() {
        const drawn = this.#model.getDraftShape();
        if (drawn === null || drawn === undefined) {
            return false;
        }
        const next = removeLastDrawnPoint(drawn);
        if (next === null) {
            this.#model.cancelDraft();
            return false;
        }
        this.#model.replaceDraft(next);
        return true;
    }

    /**
     * 引き始めた後で変えられなくなった図形の端点への吸い付きを外す（線を引いている途中に、一覧の行のドラッグでロックしたフォルダの中へ動かされた場合など）。
     * `null`・`undefined`・始点への吸い付きはそのまま。`model.getShapes()`にあるのに`model.getEditableShapes()`に無い図形の端点なら`null`。
     * それ以外（今ある変えられる図形・もう無い図形）はそのまま。モデル・記録先を変えない。
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|import('../shapes/EndpointSnapRules.js').DrawnStartSnap|null|undefined} snap 吸い付き
     * @returns {import('../shapes/PathJoinRules.js').EndpointRef|import('../shapes/EndpointSnapRules.js').DrawnStartSnap|null|undefined} 使える吸い付き。外すときはnull
     */
    #toUsableSnap(snap) {
        if (snap === null || snap === undefined || isDrawnStartSnap(snap)) {
            return snap;
        }
        const exists = this.#model.getShapes().some((s) => s.id === snap.shapeId);
        if (!exists) {
            return snap;
        }
        const editable = this.#model.getEditableShapes().some((s) => s.id === snap.shapeId);
        return editable ? snap : null;
    }

    /**
     * 吸い付きなしで終えた線を、直前に使った値のスタイル・新しいidで確定する（記録は1件）。
     * `model.replaceDraft(shape)` → `editRecorder.beginEdit()` → `model.commitDraft({ atInsertTarget: true })`（描き込む先（行の上・フォルダの中・一番下）へ入る。描き込む先が無ければ最前面）→ `editRecorder.commitEdit()`。
     * @param {Object} shape 終えた線（`buildFinishedDrawnLine`の結果）
     */
    #commitDrawnShape(shape) {
        this.#model.replaceDraft(shape);
        this.#editRecorder.beginEdit();
        this.#model.commitDraft({ atInsertTarget: true });
        this.#editRecorder.commitEdit();
    }

    /**
     * 線を、吸い付いた端点での描き足し・結合・閉じる操作として反映する（`commitDrawnLine`と`finishDrawnLine`が共有）。
     *
     * 処理順:
     *   1. `drawn`が無ければ計画なし。あれば`planDrawnLineJoin`で計画を作る（許容距離は`screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX)`）。
     *   2. `model.cancelDraft()`で作成途中の線を捨てる。
     *   3. 計画が`null`なら終わる（`beginEdit`/`commitEdit`を呼ばない）。
     *   4. `editRecorder.beginEdit()` → `model.replaceShape(..., { keepId, removeIds, select: false })` → `editRecorder.commitEdit()`。
     *
     * @param {Object|null|undefined} drawn 結合できる線（作成途中の図形、または`finishDrawnLine`が組み立てた終えた線）
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} startSnap 描き始めの点が吸い付いた端点
     * @param {import('../shapes/PathJoinRules.js').EndpointRef|null} endSnap 描き終えの点が吸い付いた端点
     * @param {Object} [drawnKindSource] 描いた区間の種類を読む作成途中の線（`finishDrawnLine`だけが渡す。省くと`drawn`）
     */
    #reflectDrawnJoin(drawn, startSnap, endSnap, drawnKindSource) {
        const plan = drawn === null || drawn === undefined
            ? null
            : planDrawnLineJoin(
                this.#model.getEditableShapes(),
                drawn,
                startSnap,
                endSnap,
                this.#screenLengthToWorld(JOIN_TOLERANCE_SCREEN_PX),
                drawnKindSource
            );
        this.#model.cancelDraft();
        if (plan === null) {
            return;
        }

        this.#editRecorder.beginEdit();
        this.#model.replaceShape(plan.targetId, plan.path, {
            keepId: plan.keepId,
            removeIds: plan.removeIds,
            select: false
        });
        this.#editRecorder.commitEdit();
    }
}
