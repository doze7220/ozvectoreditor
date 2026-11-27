/**
 * 責務: 複合パス（Phase 12-04）の切り替え・描く単位・クリック・スタイル・保存・コピー・書き出し・開き直しを、実物を組み合わせて公開APIだけで通して検証する。
 * 実物はVectorModel・SnapshotAdapter・HistoryManager・GroupEditor・CompoundPathEditor・ShapeOrderEditor・ShapeStyleEditor・StyleEyedropper・ShapeInserter・ClipboardController・DocumentSerializer・SpriteSerializer・CodeExporter・FileContentReader。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { classifyPointHit } from '../../js/core/PointHitRules.js';
import { buildDrawUnits, collectCompoundGroupIds, DRAW_UNIT_KIND } from '../../js/core/CompoundPathRules.js';
import { collectEditableIds } from '../../js/core/ItemStateRules.js';
import { resolveSelectedUnitIds } from '../../js/core/GroupSelectionRules.js';
import { canToggleCompound, resolveCompoundButtonState } from '../../js/core/GroupCommandRules.js';
import { PLACE_KIND } from '../../js/core/ItemPlaceRules.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { GroupEditor } from '../../js/edit/GroupEditor.js';
import { CompoundPathEditor } from '../../js/edit/CompoundPathEditor.js';
import { ShapeOrderEditor } from '../../js/edit/ShapeOrderEditor.js';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { StyleEyedropper } from '../../js/edit/StyleEyedropper.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { ClipboardController } from '../../js/edit/ClipboardController.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { FileContentReader } from '../../js/io/FileContentReader.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/** 大きい円の塗りの色。 */
const BIG_FILL = '#ff0000';
/** 小さい円の塗りの色。 */
const SMALL_FILL = '#00ff00';
/** 点の当たりの許容誤差。 */
const TOLERANCE = 3;

/**
 * 実物をすべて組み合わせ、大きい円（中心100,100・半径100）と小さい円（同じ中心・半径30）を描き、2つをフォルダにまとめる。
 * @returns {Object} 実物の組と、図形・フォルダのid
 */
function setup() {
    const model = new VectorModel();
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const groupEditor = new GroupEditor({ model, editRecorder: history, getMode: () => OperationMode.SELECT });
    const compoundEditor = new CompoundPathEditor({ model, editRecorder: history });
    const orderEditor = new ShapeOrderEditor({ model, editRecorder: history });
    const styleEditor = new ShapeStyleEditor({ model, editRecorder: history });
    const eyedropper = new StyleEyedropper({
        model,
        applyStyle: (style) => styleEditor.applyStyle(style),
        getCompoundPaths: () => model.getCompoundPaths()
    });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    const clipboard = new ClipboardController({ model, inserter, deleteSelection: () => groupEditor.removeSelection() });

    const big = new Ellipse(100, 100, 200, 200, 'circle', '#112233', 2, BIG_FILL);
    const small = new Ellipse(100, 100, 130, 130, 'circle', '#445566', 4, SMALL_FILL);
    const [bigId, smallId] = model.addShapesWithNewIds([big, small]);
    model.setSelection([bigId, smallId]);
    assert.equal(groupEditor.groupSelection(), true);
    const groupId = model.getItems()[0].id;
    return { model, history, groupEditor, compoundEditor, orderEditor, styleEditor, eyedropper, inserter, clipboard, bigId, smallId, groupId };
}

/**
 * フォルダだけを選んだ状態にする（中の図形もすべて選ばれた状態で、選んでいるフォルダがそのフォルダ）。
 * @param {VectorModel} model モデル
 * @param {Array<string>} shapeIds フォルダの中の図形のid
 * @param {string} groupId フォルダのid
 */
function selectGroup(model, shapeIds, groupId) {
    model.setSelection(shapeIds, { groupIds: [groupId] });
}

/**
 * 複合パスのボタンの状態を、一覧の配線と同じ組み立てで求める。
 * @param {VectorModel} model モデル
 * @returns {{groupId: (string|null), enabled: boolean, pressed: boolean}} ボタンの状態
 */
function buttonState(model) {
    const items = model.getItems();
    const editableIds = collectEditableIds(items);
    const compoundIds = collectCompoundGroupIds(items);
    const selectedGroupIds = model.getSelectedGroupIds();
    return resolveCompoundButtonState({
        unitIds: resolveSelectedUnitIds({ items, isSelected: (id) => model.isSelected(id), selectedGroupIds: new Set(selectedGroupIds) }),
        selectedGroupIds,
        isEditable: (id) => editableIds.has(id),
        isCompound: (id) => compoundIds.has(id)
    });
}

/**
 * 点の当たりを求める（選択なし・ハンドルなし・塗りの内側を含める。塗りの判定は複合パスを渡す）。
 * @param {VectorModel} model モデル
 * @param {number} x X座標
 * @param {number} y Y座標
 * @returns {string|null} 当たった図形のid（空白ならnull）
 */
function bodyAt(model, x, y) {
    model.clearSelection();
    return classifyPointHit(model.getEditableShapes(), (id) => model.isSelected(id), x, y, TOLERANCE, true, false, model.getCompoundPaths()).bodyId;
}

/**
 * idの図形をモデルから取り出す。
 * @param {VectorModel} model モデル
 * @param {string} id 図形のid
 * @returns {Object} 図形
 */
function shapeOf(model, id) {
    return model.getShapes().find((shape) => shape.id === id);
}

/**
 * 描く単位の種類の並びを返す。
 * @param {VectorModel} model モデル
 * @returns {Array<string>} 単位の種類
 */
function unitKinds(model) {
    return buildDrawUnits(model.getVisibleShapes(), model.getCompoundPaths()).map((unit) => unit.kind);
}

describe('複合パスの通し：切り替え・取り消し・やり直し', () => {
    it('フォルダだけを選ぶとボタンが押せ、toggleでドーナツになる（一番下＝大きい円）', () => {
        const { model, compoundEditor, bigId, smallId, groupId } = setup();
        assert.equal(bodyAt(model, 100, 100), smallId, '切り替え前は穴の位置で小さい円に当たる');
        selectGroup(model, [bigId, smallId], groupId);
        assert.deepEqual(buttonState(model), { groupId, enabled: true, pressed: false });
        assert.equal(canToggleCompound({ state: buttonState(model), isDragging: false, isRowDragging: false, isLocked: false }), true);

        assert.equal(compoundEditor.toggle(groupId), true);

        const compounds = model.getCompoundPaths();
        assert.equal(compounds.length, 1);
        assert.equal(compounds[0].shapes[0].id, bigId);
        assert.equal(compounds[0].style.fillColor, BIG_FILL);
        assert.deepEqual(unitKinds(model), [DRAW_UNIT_KIND.COMPOUND]);
        assert.equal(buttonState(model).pressed, true);
        assert.equal(bodyAt(model, 165, 100), bigId, '輪（塗られた所）は大きい円');
        assert.equal(bodyAt(model, 100, 100), null, '穴は素通りで空白');
        assert.equal(bodyAt(model, 230, 100), null, '円の外は空白');
    });

    it('undoで戻りredoで戻る（描く単位・当たりも）', () => {
        const { model, history, compoundEditor, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);

        assert.equal(history.undo(), true);
        assert.equal(model.getCompoundPaths().length, 0);
        assert.deepEqual(unitKinds(model), [DRAW_UNIT_KIND.SHAPE, DRAW_UNIT_KIND.SHAPE]);
        assert.equal(bodyAt(model, 100, 100), smallId);

        assert.equal(history.redo(), true);
        assert.equal(model.getCompoundPaths().length, 1);
        assert.equal(bodyAt(model, 100, 100), null);
    });

    it('スタイルは切り替えで書き換わらない', () => {
        const { model, compoundEditor, bigId, smallId, groupId } = setup();
        const read = () => [bigId, smallId].map((id) => {
            const shape = shapeOf(model, id);
            return [shape.strokeColor, shape.strokeWidth, shape.fillColor];
        });
        const before = read();
        compoundEditor.toggle(groupId);
        assert.deepEqual(read(), before);
        compoundEditor.toggle(groupId);
        assert.deepEqual(read(), before);
    });
});

describe('複合パスの通し：中の図形の移動・出し入れ', () => {
    it('小さい円を動かすと穴の位置の当たりが変わる', () => {
        const { model, compoundEditor, bigId, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);
        assert.equal(bodyAt(model, 100, 100), null);
        assert.equal(bodyAt(model, 250, 100), null);

        model.moveShapes([smallId], 150, 0);

        assert.equal(bodyAt(model, 100, 100), bigId, '元の穴の位置は大きい円だけの塗り');
        assert.equal(bodyAt(model, 250, 100), smallId, '大きい円の外へ出た所は小さい円だけの塗り');
    });

    it('小さい円をフォルダの外へ出すと複合パスの単位に入らず自分のスタイル、戻すと元に戻る', () => {
        const { model, history, compoundEditor, orderEditor, bigId, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);

        assert.equal(orderEditor.moveTo([smallId], { kind: PLACE_KIND.ABOVE, id: groupId }), true);

        const units = buildDrawUnits(model.getVisibleShapes(), model.getCompoundPaths());
        assert.deepEqual(units.map((unit) => unit.kind), [DRAW_UNIT_KIND.COMPOUND, DRAW_UNIT_KIND.SHAPE]);
        assert.deepEqual(units[0].shapes.map((shape) => shape.id), [bigId]);
        assert.equal(units[1].shapes[0].id, smallId);
        assert.equal(shapeOf(model, smallId).fillColor, SMALL_FILL);
        assert.equal(bodyAt(model, 100, 100), smallId, '穴は無く、小さい円が手前で当たる');

        assert.equal(history.undo(), true);
        assert.deepEqual(unitKinds(model), [DRAW_UNIT_KIND.COMPOUND]);
        assert.equal(bodyAt(model, 100, 100), null);
    });

    it('一番下の図形を隠すと先頭が次の図形になり、スタイルもそれに替わる', () => {
        const { model, compoundEditor, bigId, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);

        model.setItemStates([{ id: bigId, visible: false }]);

        const compounds = model.getCompoundPaths();
        assert.equal(compounds.length, 1);
        assert.equal(compounds[0].shapes[0].id, smallId);
        assert.equal(compounds[0].style.fillColor, SMALL_FILL);
        assert.equal(bodyAt(model, 100, 100), smallId, '小さい円だけの複合パスは内側で当たる');
    });
});

describe('複合パスの通し：スタイルとスポイト', () => {
    it('小さい円を選んで塗りを変えると大きい円が変わり、小さい円は変わらない。普通のフォルダへ戻すと小さい円は元の値', () => {
        const { model, compoundEditor, styleEditor, bigId, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);
        model.setSelection([smallId]);

        assert.equal(styleEditor.applyStyle({ fillColor: '#abcdef' }), true);

        assert.equal(shapeOf(model, bigId).fillColor, '#abcdef');
        assert.equal(shapeOf(model, smallId).fillColor, SMALL_FILL);
        assert.equal(styleEditor.getPanelView().fill.color, '#abcdef');

        compoundEditor.toggle(groupId);
        assert.equal(shapeOf(model, smallId).fillColor, SMALL_FILL);
        assert.equal(shapeOf(model, bigId).fillColor, '#abcdef');
    });

    it('スポイトは中の図形をクリックすると複合パスのスタイルを拾う', () => {
        const { model, compoundEditor, eyedropper, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);
        model.setSelection([]);

        eyedropper.start();
        assert.equal(eyedropper.pickFrom(smallId), true);

        const style = model.getNewShapeStyle();
        assert.equal(style.fillColor, BIG_FILL);
        assert.equal(style.strokeColor, '#112233');
        assert.equal(style.strokeWidth, 2);
    });
});

describe('複合パスの通し：保存・コピー', () => {
    it('serialize → JSON → deserialize → replaceAllShapesで複合パスのまま', () => {
        const { model, compoundEditor, groupId } = setup();
        compoundEditor.toggle(groupId);

        const data = JSON.parse(JSON.stringify(DocumentSerializer.serialize(model.getItems())));
        assert.equal(data.shapes[0].compound, true);
        const result = DocumentSerializer.deserialize(data);
        assert.equal(result.ok, true);
        const other = new VectorModel();
        other.replaceAllShapes(result.items);

        assert.equal(other.getCompoundPaths().length, 1);
        assert.equal(other.getCompoundPaths()[0].style.fillColor, BIG_FILL);
        assert.equal(other.getItems()[0].compound, true);
    });

    it('フォルダごとのコピー・貼り付けで複合パスのまま入る（新しいid）。1回の取り消しで消える', () => {
        const { model, history, compoundEditor, clipboard, bigId, smallId, groupId } = setup();
        compoundEditor.toggle(groupId);
        selectGroup(model, [bigId, smallId], groupId);

        assert.equal(clipboard.copy(), true);
        assert.equal(clipboard.paste(), true);

        const groups = model.getItems().filter((item) => item.kind === 'group');
        assert.equal(groups.length, 2);
        assert.equal(groups[1].compound, true);
        assert.notEqual(groups[1].id, groupId);
        assert.equal(model.getCompoundPaths().length, 2);

        assert.equal(history.undo(), true);
        assert.equal(model.getCompoundPaths().length, 1);
    });
});

describe('複合パスの通し：書き出し・開き直し・前の版', () => {
    it('書き出し → JSのテキスト → 開くで複合パスのフォルダに戻る', () => {
        const { model, compoundEditor, groupId } = setup();
        compoundEditor.toggle(groupId);

        const spriteData = SpriteSerializer.serialize(model.getItems());
        assert.equal(spriteData.formatVersion, 5);
        assert.equal(spriteData.elements.length, 1);
        assert.equal(spriteData.elements[0].kind, 'compoundPath');
        assert.equal(spriteData.elements[0].outlines.length, 2);
        assert.equal(spriteData.elements[0].fillColor, BIG_FILL);

        const text = CodeExporter.toModuleText(spriteData);
        const result = FileContentReader.deserializeFromText(text);
        assert.equal(result.ok, true);
        assert.deepEqual(result.skipped, []);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].kind, 'group');
        assert.equal(result.items[0].compound, true);
        assert.equal(result.items[0].children.length, 2);
        assert.equal(result.shapes.length, 2);

        const reopened = new VectorModel();
        reopened.replaceAllShapes(result.items);
        assert.equal(reopened.getCompoundPaths().length, 1);
        assert.equal(reopened.getCompoundPaths()[0].style.fillColor, BIG_FILL);
        assert.equal(bodyAt(reopened, 100, 100), null);
        assert.notEqual(bodyAt(reopened, 165, 100), null);
    });

    it('版4の作業データ（compoundのキーがあっても）は今までどおり開け、複合パスにならない', () => {
        const { model, compoundEditor, groupId } = setup();
        compoundEditor.toggle(groupId);
        const data = JSON.parse(JSON.stringify(DocumentSerializer.serialize(model.getItems())));
        data.version = 4;

        const result = DocumentSerializer.deserialize(data);

        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 2);
        assert.equal(result.items[0].kind, 'group');
        assert.equal('compound' in result.items[0], false);
    });

    it('版4のJS（compoundPathを含まない）が今までどおり開ける', () => {
        const { model } = setup();
        const spriteData = { ...SpriteSerializer.serialize(model.getItems()), formatVersion: 4 };
        assert.equal(spriteData.elements.some((element) => element.kind === 'compoundPath'), false);

        const result = FileContentReader.deserializeFromText(CodeExporter.toModuleText(spriteData));

        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 2);
        assert.equal(result.items.every((item) => item.kind === 'shape'), true);
    });
});
