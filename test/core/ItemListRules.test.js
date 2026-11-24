/**
 * 責務：ItemListRules（一覧の行の並び・行の操作の判定の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildItemRows,
    ROW_PRESS_ACTION,
    resolveRowPressAction,
    isListLocked,
    ROW_HOVER_ACTION,
    resolveRowHover,
    isOwnHover,
    canStartNameEdit,
    resolveNameEditKey
} from '../../js/core/ItemListRules.js';
import { OperationMode } from '../../js/core/InputModes.js';

/**
 * 図形のアイテムを作る。
 * @param {string} id - 図形の id
 * @param {Object} [extra] - 追加のプロパティ
 * @returns {Object} 図形のアイテム
 */
function sItem(id, extra = {}) {
    return { kind: 'shape', shape: { id }, name: `n${id}`, visible: true, locked: false, ...extra };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダの id
 * @param {Object[]} children - 中身
 * @returns {Object} フォルダのアイテム
 */
function gItem(id, children) {
    return { kind: 'group', id, name: id, visible: true, locked: false, children };
}

describe('buildItemRows', () => {
    it('前面（前順の末尾）が先頭になる', () => {
        const rows = buildItemRows([sItem('a'), sItem('b'), sItem('c')]);
        assert.deepEqual(rows.map((r) => r.id), ['c', 'b', 'a']);
        assert.deepEqual(rows.map((r) => r.name), ['nc', 'nb', 'na']);
    });

    it('0個なら空', () => {
        assert.deepEqual(buildItemRows([]), []);
    });

    it('フォルダは行にならず、入れ子の中の図形も含み、全体が逆順', () => {
        const items = [sItem('a'), gItem('G', [sItem('b'), gItem('H', [sItem('c')]), sItem('d')]), sItem('e')];
        assert.deepEqual(buildItemRows(items).map((r) => r.id), ['e', 'd', 'c', 'b', 'a']);
    });

    it('空のフォルダだけなら空', () => {
        assert.deepEqual(buildItemRows([gItem('G', [])]), []);
    });

    it('隠れている・ロックの図形も含める', () => {
        const rows = buildItemRows([sItem('a', { visible: false }), sItem('b', { locked: true })]);
        assert.deepEqual(rows.map((r) => r.id), ['b', 'a']);
    });

    it('名前が未定なら空文字', () => {
        const rows = buildItemRows([{ kind: 'shape', shape: { id: 'a' } }]);
        assert.equal(rows[0].name, '');
    });

    it('図形のインスタンスは同じで、引数を書き換えない', () => {
        const a = sItem('a');
        const b = sItem('b');
        const items = [a, gItem('G', [b])];
        const snapshot = JSON.stringify(items);
        const rows = buildItemRows(items);
        assert.equal(rows[0].shape, b.shape);
        assert.equal(rows[1].shape, a.shape);
        assert.equal(JSON.stringify(items), snapshot);
        assert.deepEqual(items.map((i) => i.kind), ['shape', 'group']);
    });
});

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
