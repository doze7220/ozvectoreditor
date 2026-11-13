/**
 * 責務：SelectionRules（クリック・範囲選択の次の選択と選択の反転の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveClickSelection,
    resolveMarqueeSelection,
    invertSelection
} from '../../js/core/SelectionRules.js';

describe('resolveClickSelection（Ctrlなし）', () => {
    it('本体に当たると、その1つだけで置き換える', () => {
        assert.deepEqual(resolveClickSelection(['a', 'b'], 'c', false), { type: 'set', ids: ['c'] });
    });

    it('選択中の図形に当たっても、その1つだけで置き換える', () => {
        assert.deepEqual(resolveClickSelection(['a', 'b'], 'a', false), { type: 'set', ids: ['a'] });
    });

    it('空白で選択があると、全解除する', () => {
        assert.deepEqual(resolveClickSelection(['a'], null, false), { type: 'clear' });
    });

    it('空白で選択がないと、何もしない', () => {
        assert.equal(resolveClickSelection([], null, false), null);
    });
});

describe('resolveClickSelection（Ctrlあり）', () => {
    it('未選択の図形は末尾へ追加する', () => {
        assert.deepEqual(resolveClickSelection(['a'], 'b', true), { type: 'set', ids: ['a', 'b'] });
    });

    it('選択がなくても追加できる', () => {
        assert.deepEqual(resolveClickSelection([], 'a', true), { type: 'set', ids: ['a'] });
    });

    it('選択中の図形は外し、ほかの選択は残る', () => {
        assert.deepEqual(resolveClickSelection(['a', 'b', 'c'], 'b', true), { type: 'set', ids: ['a', 'c'] });
    });

    it('最後の1つを外すとset([])になる', () => {
        assert.deepEqual(resolveClickSelection(['a'], 'a', true), { type: 'set', ids: [] });
    });

    it('空白は解除しない（nullを返す）', () => {
        assert.equal(resolveClickSelection(['a'], null, true), null);
        assert.equal(resolveClickSelection([], null, true), null);
    });
});

describe('resolveMarqueeSelection（Ctrlなし）', () => {
    it('当たった図形で置き換える', () => {
        assert.deepEqual(resolveMarqueeSelection(['a'], ['b', 'c'], false), { type: 'set', ids: ['b', 'c'] });
    });

    it('0件でもset([])で置き換える', () => {
        assert.deepEqual(resolveMarqueeSelection(['a'], [], false), { type: 'set', ids: [] });
        assert.deepEqual(resolveMarqueeSelection([], [], false), { type: 'set', ids: [] });
    });
});

describe('resolveMarqueeSelection（Ctrlあり）', () => {
    it('既存の選択を残して追加する', () => {
        assert.deepEqual(resolveMarqueeSelection(['a'], ['b', 'c'], true), { type: 'set', ids: ['a', 'b', 'c'] });
    });

    it('すでに選択中のidは重複しない', () => {
        assert.deepEqual(resolveMarqueeSelection(['a', 'b'], ['b', 'c'], true), { type: 'set', ids: ['a', 'b', 'c'] });
    });

    it('0件ならnull（選択を変えない）', () => {
        assert.equal(resolveMarqueeSelection(['a'], [], true), null);
    });
});

describe('invertSelection', () => {
    it('一部選択だと、未選択をallIdsの順で返す', () => {
        assert.deepEqual(invertSelection(['a', 'b', 'c', 'd'], ['c', 'a']), ['b', 'd']);
    });

    it('全選択だと空になる', () => {
        assert.deepEqual(invertSelection(['a', 'b'], ['b', 'a']), []);
    });

    it('選択なしだと全部になる', () => {
        assert.deepEqual(invertSelection(['a', 'b'], []), ['a', 'b']);
    });

    it('図形が0個だと空になる', () => {
        assert.deepEqual(invertSelection([], []), []);
    });

    it('allIdsに無いidがselectedIdsにあっても結果に出ない', () => {
        assert.deepEqual(invertSelection(['a', 'b'], ['x', 'a']), ['b']);
    });
});

describe('引数の非破壊', () => {
    it('引数を書き換えず、戻り値は引数と別の配列になる', () => {
        const selected = ['a', 'b'];
        const hits = ['c'];
        const all = ['a', 'b', 'c'];

        const click = resolveClickSelection(selected, 'c', true);
        const clickOff = resolveClickSelection(selected, 'a', true);
        const marquee = resolveMarqueeSelection(selected, hits, true);
        const marqueeReplace = resolveMarqueeSelection(selected, hits, false);
        const inverted = invertSelection(all, selected);

        assert.deepEqual(selected, ['a', 'b']);
        assert.deepEqual(hits, ['c']);
        assert.deepEqual(all, ['a', 'b', 'c']);
        assert.notEqual(click.ids, selected);
        assert.notEqual(clickOff.ids, selected);
        assert.notEqual(marquee.ids, selected);
        assert.notEqual(marqueeReplace.ids, hits);
        assert.notEqual(inverted, all);
    });
});
