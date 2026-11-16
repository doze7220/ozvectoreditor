/**
 * 責務：PressActionRules（押下点の当たり分類から、始める操作を決める規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePressAction, resolveVertexPressAction } from '../../js/core/PressActionRules.js';

/**
 * 選択集合（Set）を引く照会関数と、呼び出しの記録を作る。
 * @param {string[]} ids 選択中の図形ID
 * @returns {{isSelected: (id: string) => boolean, calls: string[]}} 照会関数と引数の記録
 */
function makeIsSelected(ids) {
    const set = new Set(ids);
    const calls = [];
    return {
        isSelected: (id) => {
            calls.push(id);
            return set.has(id);
        },
        calls,
    };
}

describe('resolvePressAction：ハンドルあり', () => {
    it('moveハンドルはmoveSelection', () => {
        const { isSelected } = makeIsSelected([]);
        const hit = { handle: { shapeId: 's1', handle: 'move' }, bodyId: 's1' };
        assert.deepEqual(resolvePressAction(hit, isSelected), { type: 'moveSelection' });
    });

    it('頂点ハンドルはdragHandleでtargetはhit.handleそのもの', () => {
        const { isSelected } = makeIsSelected([]);
        const handle = { shapeId: 's1', handle: 'v0' };
        const result = resolvePressAction({ handle, bodyId: 's1' }, isSelected);
        assert.equal(result.type, 'dragHandle');
        assert.equal(result.target, handle);
    });

    it('ハンドルは本体が選択集合内でも優先される', () => {
        const { isSelected } = makeIsSelected(['s1']);
        const handle = { shapeId: 's1', handle: 'v1' };
        const result = resolvePressAction({ handle, bodyId: 's1' }, isSelected);
        assert.deepEqual(result, { type: 'dragHandle', target: handle });
    });

    it('ハンドルあり（move・頂点とも）のときisSelectedを呼ばない', () => {
        const a = makeIsSelected(['s1']);
        resolvePressAction({ handle: { shapeId: 's1', handle: 'move' }, bodyId: 's1' }, a.isSelected);
        const b = makeIsSelected(['s1']);
        resolvePressAction({ handle: { shapeId: 's1', handle: 'v0' }, bodyId: 's1' }, b.isSelected);
        assert.deepEqual(a.calls, []);
        assert.deepEqual(b.calls, []);
    });

    it('ハンドルありでbodyIdがnullでもハンドルが優先される', () => {
        const { isSelected } = makeIsSelected([]);
        const handle = { shapeId: 's1', handle: 'v0' };
        assert.deepEqual(resolvePressAction({ handle, bodyId: null }, isSelected), { type: 'dragHandle', target: handle });
    });
});

describe('resolvePressAction：本体・空白', () => {
    it('本体が選択集合内ならmoveSelection', () => {
        const { isSelected } = makeIsSelected(['s1']);
        assert.deepEqual(resolvePressAction({ handle: null, bodyId: 's1' }, isSelected), { type: 'moveSelection' });
    });

    it('本体が選択集合外ならnull', () => {
        const { isSelected } = makeIsSelected(['s2']);
        assert.equal(resolvePressAction({ handle: null, bodyId: 's1' }, isSelected), null);
    });

    it('空白（bodyIdがnull）ならmarquee', () => {
        const { isSelected } = makeIsSelected(['s1']);
        assert.deepEqual(resolvePressAction({ handle: null, bodyId: null }, isSelected), { type: 'marquee' });
    });

    it('本体の判定ではisSelectedをhit.bodyIdで1回だけ呼ぶ', () => {
        const { isSelected, calls } = makeIsSelected(['s1']);
        resolvePressAction({ handle: null, bodyId: 's1' }, isSelected);
        assert.deepEqual(calls, ['s1']);
    });

    it('空白のときisSelectedを呼ばない', () => {
        const { isSelected, calls } = makeIsSelected(['s1']);
        resolvePressAction({ handle: null, bodyId: null }, isSelected);
        assert.deepEqual(calls, []);
    });
});

describe('resolvePressAction：引数不変・新しいオブジェクト', () => {
    it('hitを書き換えない', () => {
        const { isSelected } = makeIsSelected(['s1']);
        const hit = { handle: { shapeId: 's1', handle: 'v0' }, bodyId: 's1' };
        const snapshot = JSON.parse(JSON.stringify(hit));
        resolvePressAction(hit, isSelected);
        assert.deepEqual(hit, snapshot);
    });

    it('moveSelection・marqueeは呼ぶたびに新しいオブジェクト', () => {
        const { isSelected } = makeIsSelected(['s1']);
        const hit = { handle: null, bodyId: 's1' };
        assert.notEqual(resolvePressAction(hit, isSelected), resolvePressAction(hit, isSelected));
        const blank = { handle: null, bodyId: null };
        assert.notEqual(resolvePressAction(blank, isSelected), resolvePressAction(blank, isSelected));
    });
});

/**
 * 頂点の選択状態（組のSet）を引く照会関数と、呼び出しの記録を作る。
 * @param {Array<[string, string]>} pairs 選択中の頂点（[shapeId, handle]）
 * @returns {{isVertexSelected: (shapeId: string, handle: string) => boolean, calls: Array<[string, string]>}} 照会関数と引数の記録
 */
function makeIsVertexSelected(pairs) {
    const set = new Set(pairs.map(([s, h]) => `${s}|${h}`));
    const calls = [];
    return {
        isVertexSelected: (shapeId, handle) => {
            calls.push([shapeId, handle]);
            return set.has(`${shapeId}|${handle}`);
        },
        calls,
    };
}

describe('resolveVertexPressAction：ハンドルあり', () => {
    it('選ばれている頂点 → dragSelectedVertices（additiveに関わらず）', () => {
        const hit = { handle: { shapeId: 's1', handle: 'start' }, bodyId: 's1' };
        for (const additive of [false, true]) {
            const { isVertexSelected } = makeIsVertexSelected([['s1', 'start']]);
            const action = resolveVertexPressAction(hit, isVertexSelected, additive);
            assert.deepEqual(action, { type: 'dragSelectedVertices', target: hit.handle });
            assert.equal(action.target, hit.handle);
        }
    });

    it('選ばれていない・additive偽 → selectVertexAndDrag', () => {
        const hit = { handle: { shapeId: 's1', handle: 'end' }, bodyId: 's1' };
        const { isVertexSelected } = makeIsVertexSelected([['s1', 'start']]);
        const action = resolveVertexPressAction(hit, isVertexSelected, false);
        assert.deepEqual(action, { type: 'selectVertexAndDrag', target: hit.handle });
        assert.equal(action.target, hit.handle);
    });

    it('選ばれていない・additive真 → null', () => {
        const hit = { handle: { shapeId: 's1', handle: 'end' }, bodyId: 's1' };
        const { isVertexSelected } = makeIsVertexSelected([]);
        assert.equal(resolveVertexPressAction(hit, isVertexSelected, true), null);
    });

    it('別の図形の同名の頂点は選ばれていない扱い', () => {
        const { isVertexSelected } = makeIsVertexSelected([['s1', 'start']]);
        const other = { handle: { shapeId: 's2', handle: 'start' }, bodyId: 's2' };
        assert.equal(resolveVertexPressAction(other, isVertexSelected, false).type, 'selectVertexAndDrag');
    });

    it('isVertexSelectedは1回だけ、hit.handleの組で呼ぶ', () => {
        const hit = { handle: { shapeId: 's1', handle: 'end' }, bodyId: 's1' };
        const { isVertexSelected, calls } = makeIsVertexSelected([]);
        resolveVertexPressAction(hit, isVertexSelected, false);
        assert.deepEqual(calls, [['s1', 'end']]);
    });
});

describe('resolveVertexPressAction：ハンドルなし', () => {
    it('本体の上・空白のどちらでも marquee（additiveに関わらず）で、isVertexSelectedは呼ばない', () => {
        const hits = [
            { handle: null, bodyId: 's1' },
            { handle: null, bodyId: null },
        ];
        for (const hit of hits) {
            for (const additive of [false, true]) {
                const { isVertexSelected, calls } = makeIsVertexSelected([['s1', 'start']]);
                assert.deepEqual(resolveVertexPressAction(hit, isVertexSelected, additive), { type: 'marquee' });
                assert.equal(calls.length, 0);
            }
        }
    });
});

describe('resolveVertexPressAction：引数不変・新しいオブジェクト', () => {
    it('hitを書き換えない', () => {
        const { isVertexSelected } = makeIsVertexSelected([]);
        const hit = { handle: { shapeId: 's1', handle: 'start' }, bodyId: 's1' };
        const snapshot = JSON.parse(JSON.stringify(hit));
        resolveVertexPressAction(hit, isVertexSelected, false);
        assert.deepEqual(hit, snapshot);
    });

    it('marqueeは呼ぶたびに新しいオブジェクト', () => {
        const { isVertexSelected } = makeIsVertexSelected([]);
        const hit = { handle: null, bodyId: null };
        assert.notEqual(
            resolveVertexPressAction(hit, isVertexSelected, false),
            resolveVertexPressAction(hit, isVertexSelected, false),
        );
    });
});
