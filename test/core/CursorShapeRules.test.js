/**
 * 責務：CursorShapeRules（モード・入力状態・当たり分類からCSS cursor値を決める規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCursorShape } from '../../js/core/CursorShapeRules.js';
import { InputState, OperationMode } from '../../js/core/InputModes.js';

/**
 * 既定（選択モード・IDLE・当たりなし）の入力を作り、overridesで上書きする。
 * @param {object} [overrides] 上書きする項目
 * @returns {object} resolveCursorShapeへ渡す入力
 */
function makeInput(overrides = {}) {
    return {
        isPanning: false,
        isSpacePressed: false,
        isLeftDragState: false,
        mode: OperationMode.SELECT,
        state: InputState.IDLE,
        isPickingShape: () => false,
        hit: { handle: null, bodyId: null },
        isSelected: () => false,
        ...overrides,
    };
}

describe('resolveCursorShape：パン・スペース', () => {
    it('パン中はgrabbing', () => {
        assert.equal(resolveCursorShape(makeInput({ isPanning: true })), 'grabbing');
    });

    it('パン中は他のすべての条件より優先される', () => {
        const input = makeInput({
            isPanning: true,
            isSpacePressed: true,
            mode: OperationMode.CREATE,
            isPickingShape: () => true,
            hit: { handle: { shapeId: 's1', handle: 'move' }, bodyId: 's1' },
        });
        assert.equal(resolveCursorShape(input), 'grabbing');
    });

    it('スペース押下中はgrab（左ドラッグ状態でない）', () => {
        assert.equal(resolveCursorShape(makeInput({ isSpacePressed: true })), 'grab');
    });

    it('スペース押下中はCREATEモードのcrosshairより優先される', () => {
        assert.equal(resolveCursorShape(makeInput({ isSpacePressed: true, mode: OperationMode.CREATE })), 'grab');
    });

    it('スペース押下中でも左ドラッグ状態ならgrabにならず、状態の判定へ進む', () => {
        const input = makeInput({
            isSpacePressed: true,
            isLeftDragState: true,
            state: InputState.MOVING_SELECTION,
        });
        assert.equal(resolveCursorShape(input), 'move');
    });

    it('スペース押下中の左ドラッグ状態（MARQUEE_SELECTING）はdefault', () => {
        const input = makeInput({
            isSpacePressed: true,
            isLeftDragState: true,
            state: InputState.MARQUEE_SELECTING,
        });
        assert.equal(resolveCursorShape(input), 'default');
    });
});

describe('resolveCursorShape：モード', () => {
    it('CREATEモードはcrosshair', () => {
        assert.equal(resolveCursorShape(makeInput({ mode: OperationMode.CREATE })), 'crosshair');
    });

    it('CREATEモードは作成途中（DRAWING）でもcrosshair', () => {
        const input = makeInput({ mode: OperationMode.CREATE, state: InputState.DRAWING });
        assert.equal(resolveCursorShape(input), 'crosshair');
    });

    it('PANモードはgrab', () => {
        assert.equal(resolveCursorShape(makeInput({ mode: OperationMode.PAN })), 'grab');
    });

    it('未知のモードはdefault', () => {
        assert.equal(resolveCursorShape(makeInput({ mode: 'unknown' })), 'default');
    });

    it('選択モード以外では待ち受け中でもcellにならず、当たり分類も見ない', () => {
        const input = makeInput({
            mode: 'unknown',
            isPickingShape: () => true,
            hit: { handle: { shapeId: 's1', handle: 'move' }, bodyId: 's1' },
        });
        assert.equal(resolveCursorShape(input), 'default');
    });
});

describe('resolveCursorShape：選択モード', () => {
    it('待ち受け中はcell', () => {
        assert.equal(resolveCursorShape(makeInput({ isPickingShape: () => true })), 'cell');
    });

    it('待ち受け中は状態・当たり分類より優先される', () => {
        const input = makeInput({
            isPickingShape: () => true,
            state: InputState.MOVING_SELECTION,
            hit: { handle: { shapeId: 's1', handle: 'move' }, bodyId: 's1' },
        });
        assert.equal(resolveCursorShape(input), 'cell');
    });

    it('パン中・スペース押下中は待ち受け中より優先される', () => {
        assert.equal(resolveCursorShape(makeInput({ isPickingShape: () => true, isPanning: true })), 'grabbing');
        assert.equal(resolveCursorShape(makeInput({ isPickingShape: () => true, isSpacePressed: true })), 'grab');
    });

    it('DRAGGING_HANDLEはmove', () => {
        assert.equal(resolveCursorShape(makeInput({ state: InputState.DRAGGING_HANDLE })), 'move');
    });

    it('MOVING_SELECTIONはmove（当たり分類がnullでも）', () => {
        assert.equal(resolveCursorShape(makeInput({ state: InputState.MOVING_SELECTION, hit: null })), 'move');
    });

    it('MARQUEE_SELECTINGはdefault（ハンドル上でも）', () => {
        const input = makeInput({
            state: InputState.MARQUEE_SELECTING,
            hit: { handle: { shapeId: 's1', handle: 'move' }, bodyId: 's1' },
        });
        assert.equal(resolveCursorShape(input), 'default');
    });

    it('当たり分類がnullならdefault', () => {
        assert.equal(resolveCursorShape(makeInput({ hit: null })), 'default');
    });

    it('ハンドル上はmove（本体が選択外でも）', () => {
        const hit = { handle: { shapeId: 's1', handle: 'v0' }, bodyId: 's1' };
        assert.equal(resolveCursorShape(makeInput({ hit })), 'move');
    });

    it('選択集合内の図形の本体上はmove', () => {
        const input = makeInput({
            hit: { handle: null, bodyId: 's1' },
            isSelected: (id) => id === 's1',
        });
        assert.equal(resolveCursorShape(input), 'move');
    });

    it('選択集合外の図形の本体上はpointer', () => {
        const input = makeInput({ hit: { handle: null, bodyId: 's2' } });
        assert.equal(resolveCursorShape(input), 'pointer');
    });

    it('何にも当たらなければdefault', () => {
        assert.equal(resolveCursorShape(makeInput()), 'default');
    });
});

describe('resolveCursorShape：頂点の選択モード', () => {
    const vertexInput = (overrides = {}) => makeInput({ mode: OperationMode.VERTEX, ...overrides });

    it('DRAGGING_HANDLEはmove（hitがnullでも）', () => {
        assert.equal(resolveCursorShape(vertexInput({ state: InputState.DRAGGING_HANDLE, hit: null })), 'move');
    });

    it('hitがnullならdefault', () => {
        assert.equal(resolveCursorShape(vertexInput({ hit: null })), 'default');
    });

    it('頂点のハンドル上はmove', () => {
        const hit = { handle: { shapeId: 's1', handle: 'v0' }, bodyId: 's1' };
        assert.equal(resolveCursorShape(vertexInput({ hit })), 'move');
    });

    it('図形の本体上はpointer（選択中でも）', () => {
        const hit = { handle: null, bodyId: 's1' };
        assert.equal(resolveCursorShape(vertexInput({ hit, isSelected: () => true })), 'pointer');
    });

    it('何にも当たらなければdefault', () => {
        assert.equal(resolveCursorShape(vertexInput()), 'default');
    });

    it('パン中はgrabbing、スペース押下中はgrab', () => {
        assert.equal(resolveCursorShape(vertexInput({ isPanning: true })), 'grabbing');
        assert.equal(resolveCursorShape(vertexInput({ isSpacePressed: true })), 'grab');
    });

    it('isPickingShape・isSelectedを呼ばない', () => {
        let calls = 0;
        const fn = () => { calls++; return true; };
        resolveCursorShape(vertexInput({ isPickingShape: fn, isSelected: fn, hit: { handle: null, bodyId: 's1' } }));
        resolveCursorShape(vertexInput({ isPickingShape: fn, isSelected: fn, hit: { handle: { shapeId: 's1', handle: 'v0' }, bodyId: 's1' } }));
        assert.equal(calls, 0);
    });
});

describe('resolveCursorShape：短絡評価と引数不変', () => {
    it('パン中はisPickingShape・isSelectedを呼ばない', () => {
        let calls = 0;
        const input = makeInput({
            isPanning: true,
            isPickingShape: () => { calls++; return false; },
            isSelected: () => { calls++; return false; },
            hit: { handle: null, bodyId: 's1' },
        });
        resolveCursorShape(input);
        assert.equal(calls, 0);
    });

    it('選択モード以外ではisPickingShapeを呼ばない', () => {
        let calls = 0;
        resolveCursorShape(makeInput({
            mode: OperationMode.CREATE,
            isPickingShape: () => { calls++; return false; },
        }));
        assert.equal(calls, 0);
    });

    it('選択モードではisPickingShapeを1回だけ呼ぶ', () => {
        let calls = 0;
        resolveCursorShape(makeInput({ isPickingShape: () => { calls++; return false; } }));
        assert.equal(calls, 1);
    });

    it('isSelectedは本体に当たったときだけ、bodyIdを引数に1回呼ぶ', () => {
        const args = [];
        const isSelected = (id) => { args.push(id); return false; };
        resolveCursorShape(makeInput({ hit: { handle: null, bodyId: 's1' }, isSelected }));
        assert.deepEqual(args, ['s1']);
    });

    it('isSelectedはハンドル上・本体なし・hitがnull・ドラッグ状態では呼ばない', () => {
        let calls = 0;
        const isSelected = () => { calls++; return false; };
        resolveCursorShape(makeInput({ hit: { handle: { shapeId: 's1', handle: 'v0' }, bodyId: 's1' }, isSelected }));
        resolveCursorShape(makeInput({ hit: { handle: null, bodyId: null }, isSelected }));
        resolveCursorShape(makeInput({ hit: null, isSelected }));
        resolveCursorShape(makeInput({ state: InputState.MOVING_SELECTION, hit: { handle: null, bodyId: 's1' }, isSelected }));
        assert.equal(calls, 0);
    });

    it('入力オブジェクトとhitを書き換えない', () => {
        const hit = Object.freeze({ handle: null, bodyId: 's1' });
        const input = Object.freeze(makeInput({ hit, isSelected: () => true }));
        assert.equal(resolveCursorShape(input), 'move');
        assert.deepEqual(hit, { handle: null, bodyId: 's1' });
    });
});
