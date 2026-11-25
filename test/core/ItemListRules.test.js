/**
 * 責務：ItemListRules（一覧の行の並び・行の操作の判定の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ROW_PRESS_ACTION,
    resolveRowPressAction,
    isListLocked,
    ROW_HOVER_ACTION,
    resolveRowHover,
    isOwnHover,
    canStartNameEdit,
    canSetInsertTargetByRow,
    canStartRowDrag,
    canToggleGroup,
    shouldSelectPressedRow,
    resolveNameEditKey
} from '../../js/core/ItemListRules.js';
import { OperationMode } from '../../js/core/InputModes.js';

describe('resolveRowPressAction', () => {
    const base = { mode: OperationMode.SELECT, isPicking: false, isDragging: false, isLocked: false };
    const act = (over) => resolveRowPressAction({ ...base, ...over });

    it('ロック中・ドラッグ中は何もしない（待ち受け中でも）', () => {
        assert.equal(act({ isLocked: true }), ROW_PRESS_ACTION.NONE);
        assert.equal(act({ isDragging: true }), ROW_PRESS_ACTION.NONE);
        assert.equal(act({ isLocked: true, isPicking: true }), ROW_PRESS_ACTION.NONE);
        assert.equal(act({ isDragging: true, mode: OperationMode.PAN }), ROW_PRESS_ACTION.NONE);
    });

    it('スポイトの待ち受け中は切り替えて選ぶ', () => {
        assert.equal(act({ isPicking: true }), ROW_PRESS_ACTION.SWITCH_AND_SELECT);
        assert.equal(act({ isPicking: true, mode: OperationMode.CREATE }), ROW_PRESS_ACTION.SWITCH_AND_SELECT);
    });

    it('選択・頂点の選択は選ぶ', () => {
        assert.equal(act({ mode: OperationMode.SELECT }), ROW_PRESS_ACTION.SELECT);
        assert.equal(act({ mode: OperationMode.VERTEX }), ROW_PRESS_ACTION.SELECT);
    });

    it('キャンバス移動は切り替えて選ぶ', () => {
        assert.equal(act({ mode: OperationMode.PAN }), ROW_PRESS_ACTION.SWITCH_AND_SELECT);
    });

    it('図形作成・未知のモードは何もしない', () => {
        assert.equal(act({ mode: OperationMode.CREATE }), ROW_PRESS_ACTION.NONE);
        assert.equal(act({ mode: 'unknown' }), ROW_PRESS_ACTION.NONE);
        assert.equal(act({ mode: undefined }), ROW_PRESS_ACTION.NONE);
    });

    it('値は凍結されている', () => {
        assert.ok(Object.isFrozen(ROW_PRESS_ACTION));
    });
});

describe('isListLocked', () => {
    it('loading・busy の4通り', () => {
        assert.equal(isListLocked({ loading: false, busy: false }), false);
        assert.equal(isListLocked({ loading: true, busy: false }), true);
        assert.equal(isListLocked({ loading: false, busy: true }), true);
        assert.equal(isListLocked({ loading: true, busy: true }), true);
    });
});

describe('resolveRowHover', () => {
    /**
     * 呼ばれた回数を数える照会を作って判定する。
     * @param {Object} over - 上書きする引数
     * @param {{locked?: boolean, exists?: boolean}} [answers] - 照会の答え
     * @returns {{action: string, lockedCalls: number, existsCalls: number}} 結果と呼ばれた回数
     */
    function run(over, answers = {}) {
        let lockedCalls = 0;
        let existsCalls = 0;
        const action = resolveRowHover({
            id: 'a',
            hoveredRowId: null,
            hoveredId: null,
            isDragging: false,
            queryLocked: () => { lockedCalls += 1; return answers.locked ?? false; },
            queryExists: () => { existsCalls += 1; return answers.exists ?? true; },
            ...over
        });
        return { action, lockedCalls, existsCalls };
    }

    it('1. id が null なら clear（照会なし）', () => {
        const r = run({ id: null, hoveredRowId: 'a', hoveredId: 'a' });
        assert.equal(r.action, ROW_HOVER_ACTION.CLEAR);
        assert.equal(r.lockedCalls, 0);
        assert.equal(r.existsCalls, 0);
    });

    it('2. 記録ともホバーとも同じなら none（照会なし。ドラッグ中・ロック中でも先）', () => {
        const r = run({ hoveredRowId: 'a', hoveredId: 'a' }, { locked: true });
        assert.equal(r.action, ROW_HOVER_ACTION.NONE);
        assert.equal(r.lockedCalls, 0);
        assert.equal(r.existsCalls, 0);
        assert.equal(run({ hoveredRowId: 'a', hoveredId: 'a', isDragging: true }).action, ROW_HOVER_ACTION.NONE);
    });

    it('3. ドラッグ中は clear（どちらの照会も呼ばない）', () => {
        const r = run({ isDragging: true });
        assert.equal(r.action, ROW_HOVER_ACTION.CLEAR);
        assert.equal(r.lockedCalls, 0);
        assert.equal(r.existsCalls, 0);
    });

    it('3. ロック中は clear（存在の照会は呼ばない）', () => {
        const r = run({}, { locked: true });
        assert.equal(r.action, ROW_HOVER_ACTION.CLEAR);
        assert.equal(r.lockedCalls, 1);
        assert.equal(r.existsCalls, 0);
    });

    it('ドラッグ中・ロック中は id がホバーと同じでも clear', () => {
        assert.equal(run({ hoveredId: 'a', isDragging: true }).action, ROW_HOVER_ACTION.CLEAR);
        assert.equal(run({ hoveredId: 'a' }, { locked: true }).action, ROW_HOVER_ACTION.CLEAR);
    });

    it('4. id がホバーと同じ（記録だけ違う）なら record（存在の照会なし）', () => {
        const r = run({ hoveredId: 'a', hoveredRowId: null });
        assert.equal(r.action, ROW_HOVER_ACTION.RECORD);
        assert.equal(r.lockedCalls, 1);
        assert.equal(r.existsCalls, 0);
        assert.equal(run({ hoveredId: 'a', hoveredRowId: 'b' }).action, ROW_HOVER_ACTION.RECORD);
    });

    it('5. 図形があれば set', () => {
        const r = run({ hoveredId: 'b' });
        assert.equal(r.action, ROW_HOVER_ACTION.SET);
        assert.equal(r.lockedCalls, 1);
        assert.equal(r.existsCalls, 1);
    });

    it('id が記録とだけ同じ（ホバーが外で消えた）なら set', () => {
        assert.equal(run({ hoveredRowId: 'a', hoveredId: null }).action, ROW_HOVER_ACTION.SET);
    });

    it('6. 図形が無ければ clear', () => {
        assert.equal(run({}, { exists: false }).action, ROW_HOVER_ACTION.CLEAR);
    });

    it('値は凍結されている', () => {
        assert.ok(Object.isFrozen(ROW_HOVER_ACTION));
    });
});

describe('isOwnHover', () => {
    it('null どうしは偽', () => {
        assert.equal(isOwnHover(null, null), false);
    });

    it('同じ id は真、違う id は偽', () => {
        assert.equal(isOwnHover('a', 'a'), true);
        assert.equal(isOwnHover('a', 'b'), false);
    });

    it('片方だけ null は偽', () => {
        assert.equal(isOwnHover('a', null), false);
        assert.equal(isOwnHover(null, 'a'), false);
    });
});

describe('canStartNameEdit', () => {
    it('全8通り：すべて偽のときだけ真', () => {
        for (const isDragging of [false, true]) {
            for (const isLocked of [false, true]) {
                for (const hasModifier of [false, true]) {
                    const expected = !isDragging && !isLocked && !hasModifier;
                    assert.equal(canStartNameEdit({ isDragging, isLocked, hasModifier }), expected);
                }
            }
        }
    });
});

describe('resolveNameEditKey', () => {
    it('Enter は commit、Escape は cancel', () => {
        assert.equal(resolveNameEditKey('Enter', false), 'commit');
        assert.equal(resolveNameEditKey('Escape', false), 'cancel');
    });

    it('ほかのキーは null', () => {
        assert.equal(resolveNameEditKey('a', false), null);
        assert.equal(resolveNameEditKey('Tab', false), null);
    });

    it('変換中は Enter・Escape でも null', () => {
        assert.equal(resolveNameEditKey('Enter', true), null);
        assert.equal(resolveNameEditKey('Escape', true), null);
    });
});

describe('canSetInsertTargetByRow', () => {
    const base = { mode: OperationMode.CREATE, isPicking: false, isDragging: false, isLocked: false };
    it('作成モードで何も妨げが無ければ真', () => {
        assert.equal(canSetInsertTargetByRow(base), true);
    });
    it('作成モード以外は偽', () => {
        for (const mode of [OperationMode.SELECT, OperationMode.VERTEX, OperationMode.PAN]) {
            assert.equal(canSetInsertTargetByRow({ ...base, mode }), false);
        }
    });
    it('スポイト待ち受け中・ドラッグ中・ロック中は偽', () => {
        assert.equal(canSetInsertTargetByRow({ ...base, isPicking: true }), false);
        assert.equal(canSetInsertTargetByRow({ ...base, isDragging: true }), false);
        assert.equal(canSetInsertTargetByRow({ ...base, isLocked: true }), false);
    });
});

describe('canStartRowDrag', () => {
    const base = { button: 0, hasModifier: false, isEditingRow: false, isDragging: false, isLocked: false };

    it('左ボタンで、修飾キーなし・編集中でない・ドラッグ中でない・ロック中でないときだけ真', () => {
        assert.equal(canStartRowDrag(base), true);
    });

    it('左以外のボタンは偽', () => {
        assert.equal(canStartRowDrag({ ...base, button: 1 }), false);
        assert.equal(canStartRowDrag({ ...base, button: 2 }), false);
    });

    it('修飾キー・編集中の行・ドラッグ中・ロック中はそれぞれ偽', () => {
        assert.equal(canStartRowDrag({ ...base, hasModifier: true }), false);
        assert.equal(canStartRowDrag({ ...base, isEditingRow: true }), false);
        assert.equal(canStartRowDrag({ ...base, isDragging: true }), false);
        assert.equal(canStartRowDrag({ ...base, isLocked: true }), false);
    });
});

describe('shouldSelectPressedRow', () => {
    const base = { mode: OperationMode.SELECT, isPicking: false, isSelected: false };

    it('選択・頂点の選択モードで、待ち受け中でなく、押した行が選ばれていないときだけ真', () => {
        assert.equal(shouldSelectPressedRow(base), true);
        assert.equal(shouldSelectPressedRow({ ...base, mode: OperationMode.VERTEX }), true);
    });

    it('ほかの操作モード（作成・パン）は偽', () => {
        assert.equal(shouldSelectPressedRow({ ...base, mode: OperationMode.CREATE }), false);
        assert.equal(shouldSelectPressedRow({ ...base, mode: OperationMode.PAN }), false);
    });

    it('スポイトの待ち受け中・押した行が選ばれている場合は偽', () => {
        assert.equal(shouldSelectPressedRow({ ...base, isPicking: true }), false);
        assert.equal(shouldSelectPressedRow({ ...base, isSelected: true }), false);
    });
});

describe('canToggleGroup', () => {
    it('ドラッグ中・ロック中でないときだけ真', () => {
        assert.equal(canToggleGroup({ isDragging: false, isLocked: false }), true);
        assert.equal(canToggleGroup({ isDragging: true, isLocked: false }), false);
        assert.equal(canToggleGroup({ isDragging: false, isLocked: true }), false);
    });
});
