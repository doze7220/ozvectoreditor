/**
 * 責務：VertexEditRules（ダブルクリックで点を足す相手の決定と削除の入口の振り分け）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DELETE_ROUTE, resolveDeleteRoute, resolveDoubleClickInsertTarget } from '../../js/core/VertexEditRules.js';
import { InputState, OperationMode } from '../../js/core/InputModes.js';

/**
 * 足せる条件がそろった引数を作る補助。
 * @param {Object} [override] 上書きする項目
 * @returns {Object} resolveDoubleClickInsertTargetの引数
 */
function params(override = {}) {
    return {
        mode: OperationMode.VERTEX,
        state: InputState.IDLE,
        isDragging: false,
        clickSuppressed: false,
        hit: { handle: null, bodyId: 'shape-1' },
        ...override
    };
}

describe('VertexEditRules.resolveDeleteRoute', () => {
    it('VERTEXはVERTICES', () => {
        assert.equal(resolveDeleteRoute(OperationMode.VERTEX), DELETE_ROUTE.VERTICES);
    });
    it('SELECT・CREATE・PAN・未知の値はITEMS', () => {
        assert.equal(resolveDeleteRoute(OperationMode.SELECT), DELETE_ROUTE.ITEMS);
        assert.equal(resolveDeleteRoute(OperationMode.CREATE), DELETE_ROUTE.ITEMS);
        assert.equal(resolveDeleteRoute(OperationMode.PAN), DELETE_ROUTE.ITEMS);
        assert.equal(resolveDeleteRoute('unknown'), DELETE_ROUTE.ITEMS);
    });
    it('DELETE_ROUTEは凍結されている', () => {
        assert.ok(Object.isFrozen(DELETE_ROUTE));
        assert.equal(DELETE_ROUTE.ITEMS, 'items');
        assert.equal(DELETE_ROUTE.VERTICES, 'vertices');
    });
});

describe('VertexEditRules.resolveDoubleClickInsertTarget', () => {
    it('条件がそろえば本体のidを返す', () => {
        assert.equal(resolveDoubleClickInsertTarget(params()), 'shape-1');
    });
    it('VERTEX以外の4モードのうち3つ（SELECT・CREATE・PAN）はnull', () => {
        for (const mode of [OperationMode.SELECT, OperationMode.CREATE, OperationMode.PAN, 'unknown']) {
            assert.equal(resolveDoubleClickInsertTarget(params({ mode })), null);
        }
    });
    it('IDLEでない入力状態はnull', () => {
        for (const state of [
            InputState.DRAWING,
            InputState.DRAGGING_HANDLE,
            InputState.MOVING_SELECTION,
            InputState.MARQUEE_SELECTING,
            InputState.SCALING_SELECTION,
            InputState.ROTATING_SELECTION
        ]) {
            assert.equal(resolveDoubleClickInsertTarget(params({ state })), null);
        }
    });
    it('ドラッグ中はnull', () => {
        assert.equal(resolveDoubleClickInsertTarget(params({ isDragging: true })), null);
    });
    it('直前のクリックが抑止されたらnull', () => {
        assert.equal(resolveDoubleClickInsertTarget(params({ clickSuppressed: true })), null);
    });
    it('頂点のハンドルの上ならbodyIdがあってもnull', () => {
        const hit = { handle: { shapeId: 'shape-1', handle: 'p0' }, bodyId: 'shape-1' };
        assert.equal(resolveDoubleClickInsertTarget(params({ hit })), null);
    });
    it('空白（両方null）・hitがnullはnull', () => {
        assert.equal(resolveDoubleClickInsertTarget(params({ hit: { handle: null, bodyId: null } })), null);
        assert.equal(resolveDoubleClickInsertTarget(params({ hit: null })), null);
    });
    it('引数を書き換えない', () => {
        const p = params();
        const copy = JSON.parse(JSON.stringify(p));
        resolveDoubleClickInsertTarget(p);
        assert.deepEqual(p, copy);
    });
});
