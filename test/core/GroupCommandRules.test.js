/**
 * 責務: GroupCommandRules（まとめる・解除を受け付ける操作モード、フォルダを作るボタンの動作）の判定を検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { canEditGroups, FOLDER_BUTTON_ACTION, resolveFolderButtonAction } from '../../js/core/GroupCommandRules.js';
import { OperationMode } from '../../js/core/InputModes.js';

/**
 * 既定の引数（ロック・ドラッグなし）に上書きして動作を求める。
 * @param {Object} overrides 上書きする引数
 * @returns {string} 動作
 */
function resolve(overrides) {
    return resolveFolderButtonAction({
        mode: OperationMode.SELECT,
        hasUnits: false,
        isDragging: false,
        isRowDragging: false,
        isLocked: false,
        ...overrides
    });
}

describe('canEditGroups', () => {
    it('選択モードだけ受け付ける', () => {
        assert.equal(canEditGroups(OperationMode.SELECT), true);
        assert.equal(canEditGroups(OperationMode.VERTEX), false);
        assert.equal(canEditGroups(OperationMode.CREATE), false);
        assert.equal(canEditGroups(OperationMode.PAN), false);
    });

    it('未知のモード・未指定は受け付けない', () => {
        assert.equal(canEditGroups('unknown'), false);
        assert.equal(canEditGroups(undefined), false);
    });
});

describe('FOLDER_BUTTON_ACTION', () => {
    it('4つの値を持ち、凍結されている', () => {
        assert.deepEqual({ ...FOLDER_BUTTON_ACTION }, { NONE: 'none', GROUP: 'group', ADD_AND_SELECT: 'addAndSelect', ADD: 'add' });
        assert.equal(Object.isFrozen(FOLDER_BUTTON_ACTION), true);
    });
});

describe('resolveFolderButtonAction', () => {
    it('選択モードでまとまりがあれば group', () => {
        assert.equal(resolve({ hasUnits: true }), 'group');
    });

    it('選択モードでまとまりが無ければ addAndSelect', () => {
        assert.equal(resolve({ hasUnits: false }), 'addAndSelect');
    });

    it('頂点の選択モードは、まとまりの有無によらず addAndSelect', () => {
        assert.equal(resolve({ mode: OperationMode.VERTEX, hasUnits: true }), 'addAndSelect');
        assert.equal(resolve({ mode: OperationMode.VERTEX, hasUnits: false }), 'addAndSelect');
    });

    it('図形を描くモード・キャンバス移動は、まとまりの有無によらず add', () => {
        for (const mode of [OperationMode.CREATE, OperationMode.PAN]) {
            assert.equal(resolve({ mode, hasUnits: true }), 'add');
            assert.equal(resolve({ mode, hasUnits: false }), 'add');
        }
    });

    it('ロック中・ドラッグ中・行のドラッグ中は、どのモードでも none', () => {
        for (const mode of Object.values(OperationMode)) {
            for (const hasUnits of [true, false]) {
                assert.equal(resolve({ mode, hasUnits, isLocked: true }), 'none');
                assert.equal(resolve({ mode, hasUnits, isDragging: true }), 'none');
                assert.equal(resolve({ mode, hasUnits, isRowDragging: true }), 'none');
            }
        }
    });
});
