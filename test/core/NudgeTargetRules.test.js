/**
 * 責務：NudgeTargetRules（矢印キーの微調整で動かす対象の決定とまとめの鍵）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveNudgeTarget, buildNudgeGroupKey } from '../../js/core/NudgeTargetRules.js';
import { OperationMode } from '../../js/core/InputModes.js';

/**
 * 頂点の選択の組を作る補助。
 * @param {string} shapeId 図形id
 * @param {string} handle ハンドル名
 * @returns {{shapeId: string, handle: string}} 頂点の組
 */
function v(shapeId, handle) {
    return { shapeId, handle };
}

describe('resolveNudgeTarget', () => {
    const ids = ['a', 'b'];
    const verts = [v('a', 'p1'), v('b', 'p0')];

    it('SELECTで図形を選んでいれば shapes を返す', () => {
        assert.deepEqual(resolveNudgeTarget(OperationMode.SELECT, ids, verts), { type: 'shapes', shapeIds: ['a', 'b'] });
    });
    it('SELECTで図形0件ならnull（頂点の選択が入っていても）', () => {
        assert.equal(resolveNudgeTarget(OperationMode.SELECT, [], verts), null);
    });
    it('VERTEXで頂点を選んでいれば vertices を返す', () => {
        assert.deepEqual(resolveNudgeTarget(OperationMode.VERTEX, ids, verts), {
            type: 'vertices',
            vertices: [v('a', 'p1'), v('b', 'p0')]
        });
    });
    it('VERTEXで図形だけ選び頂点0件ならnull', () => {
        assert.equal(resolveNudgeTarget(OperationMode.VERTEX, ids, []), null);
    });
    it('VERTEXでは図形の選択の有無を見ない', () => {
        assert.deepEqual(resolveNudgeTarget(OperationMode.VERTEX, [], verts).type, 'vertices');
    });
    it('CREATE・PANは選択があってもnull、選択なしでもnull', () => {
        for (const mode of [OperationMode.CREATE, OperationMode.PAN]) {
            assert.equal(resolveNudgeTarget(mode, ids, verts), null);
            assert.equal(resolveNudgeTarget(mode, [], []), null);
        }
    });
    it('SELECT・VERTEXで選択なしならnull', () => {
        assert.equal(resolveNudgeTarget(OperationMode.SELECT, [], []), null);
        assert.equal(resolveNudgeTarget(OperationMode.VERTEX, [], []), null);
    });
    it('未知のモードはnull', () => {
        assert.equal(resolveNudgeTarget('UNKNOWN', ids, verts), null);
    });
    it('並びを保つ', () => {
        const t = resolveNudgeTarget(OperationMode.SELECT, ['c', 'a', 'b'], []);
        assert.deepEqual(t.shapeIds, ['c', 'a', 'b']);
        const t2 = resolveNudgeTarget(OperationMode.VERTEX, [], [v('z', 'h2'), v('a', 'h1')]);
        assert.deepEqual(t2.vertices, [v('z', 'h2'), v('a', 'h1')]);
    });
    it('引数を書き換えず、毎回新しい配列・オブジェクトを返す', () => {
        const inIds = ['a', 'b'];
        const inVerts = [v('a', 'p1')];
        const idsCopy = structuredClone(inIds);
        const vertsCopy = structuredClone(inVerts);
        const t1 = resolveNudgeTarget(OperationMode.SELECT, inIds, inVerts);
        const t2 = resolveNudgeTarget(OperationMode.SELECT, inIds, inVerts);
        assert.notEqual(t1, t2);
        assert.notEqual(t1.shapeIds, inIds);
        assert.notEqual(t1.shapeIds, t2.shapeIds);
        const u1 = resolveNudgeTarget(OperationMode.VERTEX, inIds, inVerts);
        assert.notEqual(u1.vertices, inVerts);
        assert.notEqual(u1.vertices[0], inVerts[0]);
        u1.vertices[0].handle = 'changed';
        t1.shapeIds.push('x');
        assert.deepEqual(inIds, idsCopy);
        assert.deepEqual(inVerts, vertsCopy);
    });
});

describe('buildNudgeGroupKey', () => {
    it('nullならnull', () => {
        assert.equal(buildNudgeGroupKey(null), null);
    });
    it('同じ内容の別オブジェクトなら同じ鍵', () => {
        const a = { type: 'shapes', shapeIds: ['a', 'b'] };
        const b = { type: 'shapes', shapeIds: ['a', 'b'] };
        assert.equal(typeof buildNudgeGroupKey(a), 'string');
        assert.equal(buildNudgeGroupKey(a), buildNudgeGroupKey(b));
    });
    it('図形が増える・減る・並びが変わると別の鍵', () => {
        const base = buildNudgeGroupKey({ type: 'shapes', shapeIds: ['a', 'b'] });
        assert.notEqual(base, buildNudgeGroupKey({ type: 'shapes', shapeIds: ['a', 'b', 'c'] }));
        assert.notEqual(base, buildNudgeGroupKey({ type: 'shapes', shapeIds: ['a'] }));
        assert.notEqual(base, buildNudgeGroupKey({ type: 'shapes', shapeIds: ['b', 'a'] }));
    });
    it('種類が違うと別の鍵', () => {
        assert.notEqual(
            buildNudgeGroupKey({ type: 'shapes', shapeIds: ['a'] }),
            buildNudgeGroupKey({ type: 'vertices', vertices: [v('a', 'p0')] })
        );
    });
    it('同じ図形の別のハンドル名・別の図形の同じハンドル名で別の鍵', () => {
        const k = (s, h) => buildNudgeGroupKey({ type: 'vertices', vertices: [v(s, h)] });
        assert.notEqual(k('a', 'p0'), k('a', 'p1'));
        assert.notEqual(k('a', 'p0'), k('b', 'p0'));
    });
    it('区切り文字を含むid・ハンドル名でも衝突しない', () => {
        const k = (s, h) => buildNudgeGroupKey({ type: 'vertices', vertices: [v(s, h)] });
        assert.notEqual(k('a-b', 'c'), k('a', 'b-c'));
    });
});
