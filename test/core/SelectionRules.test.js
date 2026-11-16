/**
 * 責務：SelectionRules（図形と頂点の、クリック・範囲選択の次の選択と図形の選択の反転の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveClickSelection,
    resolveMarqueeSelection,
    invertSelection,
    resolveVertexClickSelection,
    resolveVertexMarqueeSelection
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

/**
 * 頂点の組を作る補助。
 * @param {string} shapeId 図形id
 * @param {string} handle ハンドル名
 * @returns {{shapeId: string, handle: string}} 頂点の組
 */
function v(shapeId, handle) {
    return { shapeId, handle };
}

describe('resolveVertexClickSelection（Ctrlなし）', () => {
    it('当たった頂点だけで置き換える', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start'), v('b', 'end')], v('c', 'start'), false),
            { type: 'set', vertices: [v('c', 'start')] }
        );
    });

    it('選択中の頂点に当たっても、その1つだけで置き換える', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start'), v('a', 'end')], v('a', 'end'), false),
            { type: 'set', vertices: [v('a', 'end')] }
        );
    });

    it('当たらず選んでいる頂点があると、全解除する', () => {
        assert.deepEqual(resolveVertexClickSelection([v('a', 'start')], null, false), { type: 'clear' });
    });

    it('当たらず選んでいる頂点も無いと、何もしない', () => {
        assert.equal(resolveVertexClickSelection([], null, false), null);
    });
});

describe('resolveVertexClickSelection（Ctrlあり）', () => {
    it('未選択の頂点は末尾へ追加する', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start')], v('b', 'start'), true),
            { type: 'set', vertices: [v('a', 'start'), v('b', 'start')] }
        );
    });

    it('選択中の頂点は外し、残りの並びは保たれる', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start'), v('b', 'start'), v('c', 'start')], v('b', 'start'), true),
            { type: 'set', vertices: [v('a', 'start'), v('c', 'start')] }
        );
    });

    it('空白（当たらない）では何もしない', () => {
        assert.equal(resolveVertexClickSelection([v('a', 'start')], null, true), null);
    });

    it('同じ図形の別の頂点は別物として追加する', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start')], v('a', 'end'), true),
            { type: 'set', vertices: [v('a', 'start'), v('a', 'end')] }
        );
    });

    it('別の図形の同じハンドル名は別物として追加する', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start')], v('b', 'start'), true),
            { type: 'set', vertices: [v('a', 'start'), v('b', 'start')] }
        );
    });

    it('同じ図形の別の頂点を外すとき、取り違えない', () => {
        assert.deepEqual(
            resolveVertexClickSelection([v('a', 'start'), v('a', 'end'), v('b', 'end')], v('a', 'end'), true),
            { type: 'set', vertices: [v('a', 'start'), v('b', 'end')] }
        );
    });
});

describe('resolveVertexMarqueeSelection', () => {
    it('Ctrlなしは当たった頂点で置き換える（並びを保つ）', () => {
        assert.deepEqual(
            resolveVertexMarqueeSelection([v('a', 'start')], [v('c', 'end'), v('b', 'start')], false),
            { type: 'set', vertices: [v('c', 'end'), v('b', 'start')] }
        );
    });

    it('Ctrlなしで0件でも空で置き換える', () => {
        assert.deepEqual(
            resolveVertexMarqueeSelection([v('a', 'start')], [], false),
            { type: 'set', vertices: [] }
        );
    });

    it('Ctrlありは未選択のものだけを末尾へ足し、重複しない', () => {
        assert.deepEqual(
            resolveVertexMarqueeSelection([v('a', 'start'), v('b', 'start')], [v('b', 'start'), v('c', 'start')], true),
            { type: 'set', vertices: [v('a', 'start'), v('b', 'start'), v('c', 'start')] }
        );
    });

    it('Ctrlありで0件なら何もしない', () => {
        assert.equal(resolveVertexMarqueeSelection([v('a', 'start')], [], true), null);
    });

    it('同じ図形の別の頂点・別の図形の同じハンドル名を同一視しない', () => {
        assert.deepEqual(
            resolveVertexMarqueeSelection([v('a', 'start')], [v('a', 'end'), v('b', 'start'), v('a', 'start')], true),
            { type: 'set', vertices: [v('a', 'start'), v('a', 'end'), v('b', 'start')] }
        );
    });
});

describe('頂点用の規則の引数の非破壊', () => {
    it('引数を書き換えず、戻り値は引数と別の配列になる', () => {
        const selected = [v('a', 'start'), v('b', 'start')];
        const hits = [v('c', 'start')];
        const selectedCopy = selected.map((x) => ({ ...x }));
        const hitsCopy = hits.map((x) => ({ ...x }));

        const click = resolveVertexClickSelection(selected, v('c', 'start'), true);
        const clickOff = resolveVertexClickSelection(selected, v('a', 'start'), true);
        const clickReplace = resolveVertexClickSelection(selected, v('c', 'start'), false);
        const marquee = resolveVertexMarqueeSelection(selected, hits, true);
        const marqueeReplace = resolveVertexMarqueeSelection(selected, hits, false);

        assert.deepEqual(selected, selectedCopy);
        assert.deepEqual(hits, hitsCopy);
        assert.notEqual(click.vertices, selected);
        assert.notEqual(clickOff.vertices, selected);
        assert.notEqual(clickReplace.vertices, selected);
        assert.notEqual(marquee.vertices, selected);
        assert.notEqual(marqueeReplace.vertices, hits);
    });
});
