/**
 * 責務：GroupSelectionRules（フォルダを選んでいる状態の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveGroupCandidates,
    resolveSelectedGroupIds,
    resolveSelectedUnitIds,
    resolveRevealIds
} from '../../js/core/GroupSelectionRules.js';

const s = (id) => ({ kind: 'shape', shape: { id } });
const g = (id, children = []) => ({ kind: 'group', id, children });

describe('resolveGroupCandidates', () => {
    it('指定があればそれを使う（additive・今の値より優先）', () => {
        const result = resolveGroupCandidates({ currentIds: new Set(['A']), requestedIds: ['B'], additive: true });
        assert.deepEqual([...result], ['B']);
    });
    it('指定が空の配列でも指定として扱い、空になる', () => {
        const result = resolveGroupCandidates({ currentIds: new Set(['A']), requestedIds: [], additive: true });
        assert.equal(result.size, 0);
    });
    it('指定が無く additive が真なら今の値', () => {
        const result = resolveGroupCandidates({ currentIds: new Set(['A', 'B']), additive: true });
        assert.deepEqual([...result], ['A', 'B']);
    });
    it('指定が無く additive が偽なら空（選び直し）', () => {
        const result = resolveGroupCandidates({ currentIds: new Set(['A']), additive: false });
        assert.equal(result.size, 0);
    });
});

describe('resolveSelectedGroupIds', () => {
    const items = [g('G1', [s('a'), s('b')]), s('c')];
    const run = (selected, candidates, previousItems = items, nextItems = items) => resolveSelectedGroupIds({
        previousItems,
        items: nextItems,
        selectedIds: new Set(selected),
        candidateIds: new Set(candidates)
    });

    it('中の図形がすべて選ばれていれば残る', () => {
        assert.deepEqual([...run(['a', 'b'], ['G1'])], ['G1']);
    });
    it('1つ外れていれば落ちる', () => {
        assert.equal(run(['a'], ['G1']).size, 0);
    });
    it('空のフォルダは残る', () => {
        const empty = [g('E')];
        assert.deepEqual([...run([], ['E'], empty, empty)], ['E']);
    });
    it('今の items に無いフォルダは落ちる', () => {
        assert.equal(run(['a', 'b'], ['X']).size, 0);
    });
    it('入れ子の中の図形も見る', () => {
        const nested = [g('G1', [s('a'), g('G2', [s('b')])])];
        assert.deepEqual([...run(['a', 'b'], ['G1', 'G2'], nested, nested)].sort(), ['G1', 'G2']);
        assert.deepEqual([...run(['a'], ['G1', 'G2'], nested, nested)], []);
        assert.deepEqual([...run(['b'], ['G1', 'G2'], nested, nested)], ['G2']);
    });
    it('前にフォルダの中にあった図形が消えて選ばれていなければ落ちる', () => {
        const after = [g('G1', [s('a')]), s('c')];
        assert.equal(run(['a'], ['G1'], items, after).size, 0);
    });
    it('前にあった図形が選ばれていれば、今の中身が全部選ばれている限り残る', () => {
        const after = [g('G1', [s('a')]), s('b')];
        assert.deepEqual([...run(['a', 'b'], ['G1'], items, after)], ['G1']);
    });
    it('中が空になったフォルダは、前の中身が選ばれていなければ落ちる', () => {
        const after = [g('G1'), s('c')];
        assert.equal(run([], ['G1'], items, after).size, 0);
    });
    it('候補が空なら入れ子を見ずに空を返す', () => {
        const poisoned = { get length() { throw new Error('見てはいけない'); } };
        const result = resolveSelectedGroupIds({
            previousItems: poisoned,
            items: poisoned,
            selectedIds: new Set(['a']),
            candidateIds: new Set()
        });
        assert.equal(result.size, 0);
    });
});

describe('resolveSelectedUnitIds', () => {
    const run = (items, selected, groups = []) => resolveSelectedUnitIds({
        items,
        isSelected: (id) => selected.includes(id),
        selectedGroupIds: new Set(groups)
    });

    it('図形だけなら選ばれている図形を前順で返す', () => {
        assert.deepEqual(run([s('a'), s('b'), s('c')], ['c', 'a']), ['a', 'c']);
    });
    it('選んでいるフォルダは1つのまとまりで、中へは進まない', () => {
        const items = [g('G1', [s('a'), s('b')]), s('c')];
        assert.deepEqual(run(items, ['a', 'b'], ['G1']), ['G1']);
    });
    it('入れ子のフォルダも選んでいるときは外側だけ', () => {
        const items = [g('G1', [s('a'), g('G2', [s('b')])])];
        assert.deepEqual(run(items, ['a', 'b'], ['G1', 'G2']), ['G1']);
    });
    it('フォルダと外の図形は前順で並ぶ', () => {
        const items = [s('x'), g('G1', [s('a')]), s('y')];
        assert.deepEqual(run(items, ['x', 'a', 'y'], ['G1']), ['x', 'G1', 'y']);
    });
    it('フォルダの中の一部だけ選ばれているときは図形が個別のまとまり', () => {
        const items = [g('G1', [s('a'), s('b')])];
        assert.deepEqual(run(items, ['a']), ['a']);
    });
    it('空のフォルダだけを選んでいればそのフォルダ', () => {
        assert.deepEqual(run([g('E'), s('a')], [], ['E']), ['E']);
    });
    it('何も選んでいなければ空', () => {
        assert.deepEqual(run([g('G1', [s('a')]), s('b')], []), []);
    });
});

describe('resolveRevealIds', () => {
    const run = (previousIds, nextIds, previousGroupIds, nextGroupIds, additive) => resolveRevealIds({
        previousIds, nextIds, previousGroupIds, nextGroupIds, additive
    });

    it('additive が真なら新しく選ばれた図形だけ', () => {
        assert.deepEqual(run(['a'], ['a', 'b'], [], [], true), ['b']);
    });
    it('additive が真で増えていなければ空', () => {
        assert.deepEqual(run(['a', 'b'], ['a'], [], [], true), []);
    });
    it('置き換えなら次の選択の全部', () => {
        assert.deepEqual(run(['a'], ['b', 'c'], [], [], false), ['b', 'c']);
    });
    it('図形の選択が変わらなければ空', () => {
        assert.deepEqual(run(['a', 'b'], ['b', 'a'], ['G'], ['G'], false), []);
    });
    it('フォルダの選択だけが変わったときも次の選択の全部', () => {
        assert.deepEqual(run(['a', 'b'], ['a', 'b'], [], ['G'], false), ['a', 'b']);
    });
    it('何も選ばなくなったときは空', () => {
        assert.deepEqual(run(['a'], [], [], [], false), []);
    });
});
