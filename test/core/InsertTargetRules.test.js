/**
 * 責務：InsertTargetRules（描き込む先の決まり方と印の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveInsertTarget, resolveInsertMarkId } from '../../js/core/InsertTargetRules.js';

describe('resolveInsertTarget', () => {
    it('選択があれば、選ばれている一番上（描画順で最後）の行になる', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b', 'c', 'd'],
            ids: ['a', 'b', 'c', 'd'],
            selectedIds: new Set(['b', 'c']),
            targetId: 'a'
        });
        assert.equal(result, 'c');
    });

    it('選択があれば候補が null でも選択で決まる', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b'], ids: ['a', 'b'], selectedIds: new Set(['a']), targetId: null
        });
        assert.equal(result, 'a');
    });

    it('選択集合のうち ids に無いものは数えない', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b'], ids: ['a', 'b'], selectedIds: new Set(['zz']), targetId: 'a'
        });
        assert.equal(result, 'a');
    });

    it('候補が null なら null', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b'], ids: ['a', 'b'], selectedIds: new Set(), targetId: null
        });
        assert.equal(result, null);
    });

    it('候補が残っていればそのまま', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b', 'c'], ids: ['a', 'b', 'c'], selectedIds: new Set(), targetId: 'b'
        });
        assert.equal(result, 'b');
    });

    it('候補が消えたら、下の行（前の並びで先頭側）のうち残っている最初のもの', () => {
        const far = resolveInsertTarget({
            previousIds: ['a', 'b', 'c', 'd'], ids: ['a', 'd'], selectedIds: new Set(), targetId: 'c'
        });
        assert.equal(far, 'a');
        const near = resolveInsertTarget({
            previousIds: ['a', 'b', 'c', 'd'], ids: ['a', 'b', 'd'], selectedIds: new Set(), targetId: 'c'
        });
        assert.equal(near, 'b');
    });

    it('下が全部消えたら null（上にある図形へは移らない）', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b', 'c'], ids: ['c'], selectedIds: new Set(), targetId: 'b'
        });
        assert.equal(result, null);
    });

    it('前の並びにも無い候補は null', () => {
        const result = resolveInsertTarget({
            previousIds: ['a', 'b'], ids: ['a', 'b'], selectedIds: new Set(), targetId: 'zz'
        });
        assert.equal(result, null);
    });

    it('引数を書き換えない', () => {
        const previousIds = ['a', 'b', 'c'];
        const ids = ['a', 'c'];
        const selectedIds = new Set(['c']);
        resolveInsertTarget({ previousIds, ids, selectedIds, targetId: 'b' });
        assert.deepEqual(previousIds, ['a', 'b', 'c']);
        assert.deepEqual(ids, ['a', 'c']);
        assert.deepEqual([...selectedIds], ['c']);
    });
});

describe('resolveInsertMarkId', () => {
    it('選択が1つ以上なら null', () => {
        assert.equal(resolveInsertMarkId({ selectedCount: 1, insertTargetId: 'a' }), null);
    });

    it('選択が無ければ描き込む先のid', () => {
        assert.equal(resolveInsertMarkId({ selectedCount: 0, insertTargetId: 'a' }), 'a');
    });

    it('選択も描き込む先も無ければ null', () => {
        assert.equal(resolveInsertMarkId({ selectedCount: 0, insertTargetId: null }), null);
    });
});
