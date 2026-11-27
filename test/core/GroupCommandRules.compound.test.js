/**
 * 責務: GroupCommandRules の複合パスのボタンの状態（resolveCompoundButtonState）と受け付けの条件（canToggleCompound）を検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCompoundButtonState, canToggleCompound } from '../../js/core/GroupCommandRules.js';

/**
 * 既定の引数に上書きして状態を求める。
 * @param {Object} overrides 上書きする引数
 * @returns {Object} ボタンの状態
 */
function resolve(overrides) {
    return resolveCompoundButtonState({
        unitIds: ['g1'],
        selectedGroupIds: ['g1'],
        isEditable: () => true,
        isCompound: () => false,
        ...overrides
    });
}

describe('resolveCompoundButtonState', () => {
    it('フォルダを1つだけ選んでいる：groupId・押せる・普通のフォルダは押されていない', () => {
        assert.deepEqual(resolve({}), { groupId: 'g1', enabled: true, pressed: false });
    });

    it('複合パスなら押された見た目', () => {
        assert.deepEqual(resolve({ isCompound: (id) => id === 'g1' }), { groupId: 'g1', enabled: true, pressed: true });
    });

    it('何も選んでいない：groupIdなし・押せない', () => {
        assert.deepEqual(resolve({ unitIds: [], selectedGroupIds: [] }), { groupId: null, enabled: false, pressed: false });
    });

    it('図形だけを選んでいる：groupIdなし', () => {
        assert.deepEqual(resolve({ unitIds: ['s1'], selectedGroupIds: [] }), { groupId: null, enabled: false, pressed: false });
    });

    it('フォルダを2つ選んでいる：groupIdなし', () => {
        assert.deepEqual(resolve({ unitIds: ['g1', 'g2'], selectedGroupIds: ['g1', 'g2'] }), {
            groupId: null,
            enabled: false,
            pressed: false
        });
    });

    it('フォルダと外の図形を選んでいる：groupIdなし', () => {
        assert.deepEqual(resolve({ unitIds: ['g1', 's1'], selectedGroupIds: ['g1'] }), {
            groupId: null,
            enabled: false,
            pressed: false
        });
    });

    it('空のフォルダを1つ選んでいる：押せる', () => {
        assert.deepEqual(resolve({ unitIds: ['g9'], selectedGroupIds: ['g9'] }), { groupId: 'g9', enabled: true, pressed: false });
    });

    it('変えられない（isEditableが偽）：押せないが押された見た目は値のまま', () => {
        assert.deepEqual(resolve({ isEditable: () => false }), { groupId: 'g1', enabled: false, pressed: false });
        assert.deepEqual(resolve({ isEditable: () => false, isCompound: () => true }), {
            groupId: 'g1',
            enabled: false,
            pressed: true
        });
    });
});

describe('canToggleCompound', () => {
    const base = { state: { groupId: 'g1', enabled: true, pressed: false }, isDragging: false, isRowDragging: false, isLocked: false };

    it('押せて、ロック・ドラッグなしなら真', () => {
        assert.equal(canToggleCompound(base), true);
    });

    it('押せないなら偽', () => {
        assert.equal(canToggleCompound({ ...base, state: { groupId: null, enabled: false, pressed: false } }), false);
    });

    it('ロック中・ドラッグ中・行のドラッグ中は偽', () => {
        assert.equal(canToggleCompound({ ...base, isLocked: true }), false);
        assert.equal(canToggleCompound({ ...base, isDragging: true }), false);
        assert.equal(canToggleCompound({ ...base, isRowDragging: true }), false);
    });
});
