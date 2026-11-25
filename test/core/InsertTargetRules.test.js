/**
 * 責務：InsertTargetRules（描き込む先の決まり方と印の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveInsertMark,
    resolveNextInsertTarget,
    resolveRowInsertTarget,
    isSameInsertTarget,
    resolvePastePlace,
    resolveDuplicatePlace
} from '../../js/core/InsertTargetRules.js';

describe('resolveInsertMark', () => {
    it('選択が1つ以上なら null', () => {
        assert.equal(resolveInsertMark({ selectedCount: 1, target: { kind: 'above', id: 'a' } }), null);
    });

    it('選択が無ければ描き込む先', () => {
        assert.deepEqual(resolveInsertMark({ selectedCount: 0, target: { kind: 'above', id: 'a' } }), { kind: 'above', id: 'a' });
        assert.deepEqual(resolveInsertMark({ selectedCount: 0, target: { kind: 'bottom', id: null } }), { kind: 'bottom', id: null });
    });

    it('選択も描き込む先も無ければ null', () => {
        assert.equal(resolveInsertMark({ selectedCount: 0, target: null }), null);
    });
});

const shape = (id) => ({ kind: 'shape', shape: { id } });
const group = (id, children = [], extra = {}) => ({ kind: 'group', id, name: id, children, ...extra });
const above = (id) => ({ kind: 'above', id });
const inside = (id) => ({ kind: 'inside', id });
const bottom = (id) => ({ kind: 'bottom', id });

/**
 * resolveNextInsertTarget の呼び出しの短縮。
 * @param {Object} params - 引数
 * @returns {Object|null} 描き込む先
 */
function next({ previousItems, items, selected = [], groups = [], target = null }) {
    return resolveNextInsertTarget({
        previousItems: previousItems ?? items,
        items,
        selectedIds: new Set(selected),
        selectedGroupIds: new Set(groups),
        target
    });
}

describe('resolveNextInsertTarget（選択・そのまま）', () => {
    const items = [shape('a'), shape('b'), shape('c'), shape('d')];

    it('選択があれば、選ばれている一番上（最後）の図形の above になる', () => {
        assert.deepEqual(next({ items, selected: ['b', 'c'], target: above('a') }), above('c'));
    });

    it('選択があれば候補が null でも選択で決まる', () => {
        assert.deepEqual(next({ items, selected: ['a'] }), above('a'));
    });

    it('選択集合のうち items に無いものは数えない', () => {
        assert.deepEqual(next({ items, selected: ['zz'], target: above('a') }), above('a'));
    });

    it('選択が無く候補が null なら null', () => {
        assert.equal(next({ items }), null);
    });

    it('選択が無く候補が今もあれば、そのまま', () => {
        assert.deepEqual(next({ items, target: above('b') }), above('b'));
    });

    it('候補の行が並びの中で動いても同じ id のまま', () => {
        const previousItems = [shape('a'), shape('b'), shape('c')];
        const moved = [shape('c'), shape('a'), shape('b')];
        assert.deepEqual(next({ previousItems, items: moved, target: above('b') }), above('b'));
    });

    it('別のフォルダへ移っても同じ id のまま', () => {
        const previousItems = [shape('a'), group('g', [shape('b')])];
        const moved = [group('g', [shape('a'), shape('b')])];
        assert.deepEqual(next({ previousItems, items: moved, target: above('a') }), above('a'));
    });

    it('引数を書き換えない', () => {
        const previousItems = [shape('a'), shape('b')];
        const nextItems = [shape('a')];
        const target = above('b');
        const selectedIds = new Set();
        const selectedGroupIds = new Set();
        const before = JSON.stringify([previousItems, nextItems, target]);
        resolveNextInsertTarget({ previousItems, items: nextItems, selectedIds, selectedGroupIds, target });
        assert.equal(JSON.stringify([previousItems, nextItems, target]), before);
        assert.equal(selectedIds.size, 0);
    });
});

describe('resolveNextInsertTarget（まとまり）', () => {
    it('一番上のまとまりが図形なら above', () => {
        const items = [group('g', [shape('a')]), shape('b')];
        assert.deepEqual(next({ items, selected: ['b'] }), above('b'));
    });

    it('一番上のまとまりがフォルダなら inside', () => {
        const items = [shape('b'), group('g', [shape('a')])];
        assert.deepEqual(next({ items, selected: ['a'], groups: ['g'] }), inside('g'));
    });

    it('空のフォルダだけを選んでいれば inside', () => {
        const items = [shape('a'), group('e')];
        assert.deepEqual(next({ items, groups: ['e'] }), inside('e'));
    });

    it('フォルダと外の図形が混ざれば、前順で最後のもので決まる', () => {
        const items = [group('g', [shape('a')]), shape('b')];
        assert.deepEqual(next({ items, selected: ['a', 'b'], groups: ['g'] }), above('b'));
        const items2 = [shape('b'), group('g', [shape('a')])];
        assert.deepEqual(next({ items: items2, selected: ['a', 'b'], groups: ['g'] }), inside('g'));
    });

    it('選んでいるフォルダの中の図形ではなくフォルダで決まる', () => {
        const items = [group('g', [shape('a'), shape('b')])];
        assert.deepEqual(next({ items, selected: ['a', 'b'], groups: ['g'] }), inside('g'));
    });
});

describe('resolveNextInsertTarget（inside・bottom）', () => {
    it('inside は、フォルダがあればそのまま残る', () => {
        const items = [group('g', [shape('a')])];
        assert.deepEqual(next({ items, target: inside('g') }), inside('g'));
    });

    it('bottom（フォルダ）は、フォルダがあればそのまま残る', () => {
        const items = [group('g', [shape('a')])];
        assert.deepEqual(next({ items, target: bottom('g') }), bottom('g'));
    });

    it('{ bottom, null } は、items が1つ以上あればそのまま残る', () => {
        assert.deepEqual(next({ items: [shape('a')], target: bottom(null) }), bottom(null));
    });

    it('inside の id が図形なら有効ではない（元の場所から求める）', () => {
        const items = [shape('a'), shape('b')];
        assert.deepEqual(next({ items, target: inside('b') }), above('a'));
    });
});

describe('resolveNextInsertTarget（元の場所）', () => {
    it('下の行が消えたら、そのすぐ下に残っている行の above', () => {
        const previousItems = [shape('a'), shape('b'), shape('c')];
        const items = [shape('a'), shape('c')];
        assert.deepEqual(next({ previousItems, items, target: above('b') }), above('a'));
    });

    it('下が全部消えたら { bottom, null }', () => {
        const previousItems = [shape('a'), shape('b'), shape('c')];
        const items = [shape('c')];
        assert.deepEqual(next({ previousItems, items, target: above('b') }), bottom(null));
    });

    it('いちばん外側が空になれば null', () => {
        const previousItems = [shape('a')];
        assert.equal(next({ previousItems, items: [], target: above('a') }), null);
    });

    it('フォルダの中の途中の行が消えたら、同じフォルダの下の行の above', () => {
        const previousItems = [group('g', [shape('a'), shape('b'), shape('c')])];
        const items = [group('g', [shape('a'), shape('c')])];
        assert.deepEqual(next({ previousItems, items, target: above('b') }), above('a'));
    });

    it('フォルダの中の一番下の行が消えたら、そのフォルダの bottom', () => {
        const previousItems = [shape('x'), group('g', [shape('a'), shape('b')])];
        const items = [shape('x'), group('g', [shape('b')])];
        assert.deepEqual(next({ previousItems, items, target: above('a') }), bottom('g'));
    });

    it('入れ子の中の一番下の行が消えたら、その入れ子のフォルダの bottom', () => {
        const previousItems = [group('o', [group('i', [shape('a')])])];
        const items = [group('o', [group('i', [])])];
        assert.deepEqual(next({ previousItems, items, target: above('a') }), bottom('i'));
    });

    it('すぐ下の行がフォルダなら、そのフォルダの above', () => {
        const previousItems = [group('g', [shape('a')]), shape('b')];
        const items = [group('g', [shape('a')])];
        assert.deepEqual(next({ previousItems, items, target: above('b') }), above('g'));
    });

    it('すぐ下の行も消えていれば、さらに下の行をたどる', () => {
        const previousItems = [shape('a'), shape('b'), shape('c')];
        const items = [shape('a')];
        assert.deepEqual(next({ previousItems, items, target: above('c') }), above('a'));
    });

    it('すぐ下の行が別のフォルダへ移っていたら数えず、その先の同じ並びの行をたどる', () => {
        const previousItems = [group('g', [shape('x')]), shape('a'), shape('b')];
        const items = [group('g', [shape('x'), shape('a')]), shape('c')];
        assert.deepEqual(next({ previousItems, items, target: above('b') }), above('g'));
    });

    it('フォルダごと無くなったら、そのフォルダの外の並びでたどる', () => {
        const previousItems = [shape('x'), group('g', [shape('a')]), shape('y')];
        const items = [shape('x'), shape('y')];
        assert.deepEqual(next({ previousItems, items, target: above('a') }), above('x'));
    });

    it('外側のフォルダも無くなったら、さらに外の並びでたどる', () => {
        const previousItems = [shape('x'), group('o', [group('i', [shape('a')])])];
        const items = [shape('x')];
        assert.deepEqual(next({ previousItems, items, target: above('a') }), above('x'));
    });

    it('inside のフォルダが無くなったら、そのフォルダの行が無くなったものとして求める', () => {
        const previousItems = [shape('x'), group('g', [shape('a')]), shape('y')];
        const items = [shape('x'), shape('y')];
        assert.deepEqual(next({ previousItems, items, target: inside('g') }), above('x'));
    });

    it('bottom のフォルダが無くなったら、そのフォルダの行が無くなったものとして求める', () => {
        const previousItems = [group('g', []), shape('y')];
        const items = [shape('y')];
        assert.deepEqual(next({ previousItems, items, target: bottom('g') }), bottom(null));
    });

    it('{ bottom, null } で items が空になったら null', () => {
        assert.equal(next({ previousItems: [shape('a')], items: [], target: bottom(null) }), null);
    });

    it('前の入れ子にも無ければ null', () => {
        const items = [shape('a')];
        assert.equal(next({ items, target: above('zz') }), null);
    });
});

describe('resolveRowInsertTarget', () => {
    const items = [shape('a'), group('g', [shape('b')]), group('e')];

    it('図形なら above', () => {
        assert.deepEqual(resolveRowInsertTarget(items, 'b'), above('b'));
    });

    it('フォルダ（空を含む）なら inside', () => {
        assert.deepEqual(resolveRowInsertTarget(items, 'g'), inside('g'));
        assert.deepEqual(resolveRowInsertTarget(items, 'e'), inside('e'));
    });

    it('無ければ null', () => {
        assert.equal(resolveRowInsertTarget(items, 'zz'), null);
    });
});

describe('isSameInsertTarget', () => {
    it('どちらも null なら真', () => {
        assert.equal(isSameInsertTarget(null, null), true);
    });

    it('片方だけ null なら偽', () => {
        assert.equal(isSameInsertTarget(null, above('a')), false);
        assert.equal(isSameInsertTarget(above('a'), null), false);
    });

    it('kind と id が同じなら真、違えば偽', () => {
        assert.equal(isSameInsertTarget(above('a'), above('a')), true);
        assert.equal(isSameInsertTarget(above('a'), inside('a')), false);
        assert.equal(isSameInsertTarget(above('a'), above('b')), false);
        assert.equal(isSameInsertTarget(bottom(null), bottom(null)), true);
    });
});

describe('resolvePastePlace', () => {
    const copied = new Set(['g']);

    it('inside で id が自分のコピーなら、そのフォルダの above', () => {
        assert.deepEqual(resolvePastePlace({ target: inside('g'), copiedGroupIds: copied }), above('g'));
    });

    it('違うフォルダの inside はそのまま', () => {
        assert.deepEqual(resolvePastePlace({ target: inside('h'), copiedGroupIds: copied }), inside('h'));
    });

    it('above・bottom・null はそのまま', () => {
        assert.deepEqual(resolvePastePlace({ target: above('g'), copiedGroupIds: copied }), above('g'));
        assert.deepEqual(resolvePastePlace({ target: bottom('g'), copiedGroupIds: copied }), bottom('g'));
        assert.deepEqual(resolvePastePlace({ target: bottom(null), copiedGroupIds: copied }), bottom(null));
        assert.equal(resolvePastePlace({ target: null, copiedGroupIds: copied }), null);
    });
});

describe('resolveDuplicatePlace', () => {
    it('まとまりが空なら null', () => {
        assert.equal(resolveDuplicatePlace([]), null);
    });

    it('まとまりの最後（一番上）の id の above', () => {
        assert.deepEqual(resolveDuplicatePlace(['a', 'g', 'b']), above('b'));
    });
});
