/**
 * 責務：ItemPlaceRules（アイテムの入る場所の値と、入れる・動かす計算、位置の照会）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    PLACE_KIND,
    findItemLocation,
    insertItemsAt,
    canMoveItems,
    moveItems
} from '../../js/core/ItemPlaceRules.js';

const s = (id) => ({ kind: 'shape', shape: { id } });
const g = (id, children = [], extra = {}) => ({ kind: 'group', id, children, ...extra });
const above = (id) => ({ kind: 'above', id });
const below = (id) => ({ kind: 'below', id });
const inside = (id) => ({ kind: 'inside', id });
const bottom = (id) => ({ kind: 'bottom', id });

/** 入れ子を id の入れ子（フォルダは { id: [...] }）へ直す。 */
function shape(items) {
    return items.map((item) => (item.kind === 'group' ? { [item.id]: shape(item.children) } : item.shape.id));
}

/** [s1, G1[s2, G2[s3, s4], s5], s6] */
function tree() {
    return [s('s1'), g('G1', [s('s2'), g('G2', [s('s3'), s('s4')]), s('s5')]), s('s6')];
}

describe('PLACE_KIND', () => {
    it('4つの値を持つ', () => {
        assert.deepEqual({ ...PLACE_KIND }, { ABOVE: 'above', BELOW: 'below', INSIDE: 'inside', BOTTOM: 'bottom' });
        assert.equal(Object.isFrozen(PLACE_KIND), true);
    });
});

describe('findItemLocation', () => {
    it('いちばん外側のアイテム', () => {
        const items = tree();
        const location = findItemLocation(items, 's6');
        assert.equal(location.parentId, null);
        assert.equal(location.siblings, items);
        assert.equal(location.index, 2);
        assert.deepEqual(location.ancestorIds, []);
    });
    it('入れ子の中の図形（外側から並べた入っているフォルダ）', () => {
        const items = tree();
        const location = findItemLocation(items, 's4');
        assert.equal(location.parentId, 'G2');
        assert.equal(location.siblings, items[1].children[1].children);
        assert.equal(location.index, 1);
        assert.deepEqual(location.ancestorIds, ['G1', 'G2']);
    });
    it('フォルダ自身', () => {
        const location = findItemLocation(tree(), 'G2');
        assert.equal(location.parentId, 'G1');
        assert.equal(location.index, 1);
        assert.deepEqual(location.ancestorIds, ['G1']);
    });
    it('無ければ null', () => {
        assert.equal(findItemLocation(tree(), 'zzz'), null);
        assert.equal(findItemLocation([], 'a'), null);
    });
});

describe('insertItemsAt', () => {
    const add = () => [s('n1'), s('n2')];
    it('above：外側・フォルダの中・深い入れ子（すぐ後ろ）', () => {
        assert.deepEqual(shape(insertItemsAt(tree(), above('s1'), add())), ['s1', 'n1', 'n2', { G1: ['s2', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), above('s2'), add())), ['s1', { G1: ['s2', 'n1', 'n2', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), above('s3'), add())), ['s1', { G1: ['s2', { G2: ['s3', 'n1', 'n2', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), above('G2'), add())), ['s1', { G1: ['s2', { G2: ['s3', 's4'] }, 'n1', 'n2', 's5'] }, 's6']);
    });
    it('above：並びの最後の図形の上は並びの末尾へ', () => {
        assert.deepEqual(shape(insertItemsAt(tree(), above('s6'), add())), ['s1', { G1: ['s2', { G2: ['s3', 's4'] }, 's5'] }, 's6', 'n1', 'n2']);
        assert.deepEqual(shape(insertItemsAt(tree(), above('s4'), add())), ['s1', { G1: ['s2', { G2: ['s3', 's4', 'n1', 'n2'] }, 's5'] }, 's6']);
    });
    it('below：同じ並びのすぐ前', () => {
        assert.deepEqual(shape(insertItemsAt(tree(), below('s1'), add())), ['n1', 'n2', 's1', { G1: ['s2', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), below('s3'), add())), ['s1', { G1: ['s2', { G2: ['n1', 'n2', 's3', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), below('G2'), add())), ['s1', { G1: ['s2', 'n1', 'n2', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
    });
    it('inside：フォルダの中の一番上（末尾）', () => {
        assert.deepEqual(shape(insertItemsAt(tree(), inside('G1'), add())), ['s1', { G1: ['s2', { G2: ['s3', 's4'] }, 's5', 'n1', 'n2'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), inside('G2'), add())), ['s1', { G1: ['s2', { G2: ['s3', 's4', 'n1', 'n2'] }, 's5'] }, 's6']);
    });
    it('bottom：フォルダの中の一番下（先頭）・いちばん外側の先頭', () => {
        assert.deepEqual(shape(insertItemsAt(tree(), bottom('G1'), add())), ['s1', { G1: ['n1', 'n2', 's2', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), bottom('G2'), add())), ['s1', { G1: ['s2', { G2: ['n1', 'n2', 's3', 's4'] }, 's5'] }, 's6']);
        assert.deepEqual(shape(insertItemsAt(tree(), bottom(null), add())), ['n1', 'n2', 's1', { G1: ['s2', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
    });
    it('空のフォルダの inside・bottom', () => {
        const items = [g('E'), s('a')];
        assert.deepEqual(shape(insertItemsAt(items, inside('E'), add())), [{ E: ['n1', 'n2'] }, 'a']);
        assert.deepEqual(shape(insertItemsAt(items, bottom('E'), add())), [{ E: ['n1', 'n2'] }, 'a']);
    });
    it('null・無いid・図形への inside/bottom はいちばん外側の末尾', () => {
        const expected = ['s1', { G1: ['s2', { G2: ['s3', 's4'] }, 's5'] }, 's6', 'n1', 'n2'];
        assert.deepEqual(shape(insertItemsAt(tree(), null, add())), expected);
        assert.deepEqual(shape(insertItemsAt(tree(), above('zzz'), add())), expected);
        assert.deepEqual(shape(insertItemsAt(tree(), below('zzz'), add())), expected);
        assert.deepEqual(shape(insertItemsAt(tree(), inside('zzz'), add())), expected);
        assert.deepEqual(shape(insertItemsAt(tree(), inside('s1'), add())), expected);
        assert.deepEqual(shape(insertItemsAt(tree(), bottom('s1'), add())), expected);
    });
    it('空の入れ子でも入る', () => {
        assert.deepEqual(shape(insertItemsAt([], null, add())), ['n1', 'n2']);
        assert.deepEqual(shape(insertItemsAt([], bottom(null), add())), ['n1', 'n2']);
    });
    it('フォルダを含む複数の追加は順のまま', () => {
        const added = [s('n1'), g('NG', [s('n2')]), s('n3')];
        assert.deepEqual(shape(insertItemsAt(tree(), above('s2'), added)), ['s1', { G1: ['s2', 'n1', { NG: ['n2'] }, 'n3', { G2: ['s3', 's4'] }, 's5'] }, 's6']);
    });
    it('通り道でないフォルダは同じ参照', () => {
        const items = tree();
        const result = insertItemsAt(items, above('s1'), add());
        assert.equal(result[3], items[1]);
        const result2 = insertItemsAt(items, above('s3'), add());
        assert.notEqual(result2[1], items[1]);
        assert.equal(result2[1].children[0], items[1].children[0]);
        assert.equal(result2[1].children[2], items[1].children[2]);
    });
    it('引数を書き換えない', () => {
        const items = tree();
        const before = JSON.stringify(items);
        const added = add();
        const addedBefore = JSON.stringify(added);
        insertItemsAt(items, above('s3'), added);
        insertItemsAt(items, bottom('G1'), added);
        assert.equal(JSON.stringify(items), before);
        assert.equal(JSON.stringify(added), addedBefore);
    });
});

describe('insertItemsAt：insertItemsAbove と同じ値（above）', () => {
    const deep = () => [s('s1'), g('G1', [s('s2'), g('G2', [s('s3')]), s('s4')]), s('s5')];
    it('外側の図形のすぐ後ろ', () => {
        assert.deepEqual(shape(insertItemsAt(deep(), above('s1'), [s('x')])), ['s1', 'x', { G1: ['s2', { G2: ['s3'] }, 's4'] }, 's5']);
    });
    it('フォルダの中の図形のすぐ後ろ', () => {
        assert.deepEqual(shape(insertItemsAt(deep(), above('s2'), [s('x')])), ['s1', { G1: ['s2', 'x', { G2: ['s3'] }, 's4'] }, 's5']);
    });
    it('入れ子の奥の図形のすぐ後ろ', () => {
        assert.deepEqual(shape(insertItemsAt(deep(), above('s3'), [s('x'), s('y')])), ['s1', { G1: ['s2', { G2: ['s3', 'x', 'y'] }, 's4'] }, 's5']);
    });
    it('無い図形は末尾', () => {
        assert.deepEqual(shape(insertItemsAt(deep(), above('none'), [s('x')])), ['s1', { G1: ['s2', { G2: ['s3'] }, 's4'] }, 's5', 'x']);
    });
    it('空の入れ子は追加だけ', () => {
        assert.deepEqual(shape(insertItemsAt([], above('s1'), [s('x')])), ['x']);
    });
});

describe('canMoveItems', () => {
    it('null は偽・{ bottom, null } は真', () => {
        assert.equal(canMoveItems(tree(), new Set(['s1']), null), false);
        assert.equal(canMoveItems(tree(), new Set(['G1']), bottom(null)), true);
    });
    it('無い id は偽', () => {
        assert.equal(canMoveItems(tree(), new Set(['s1']), above('zzz')), false);
        assert.equal(canMoveItems(tree(), new Set(['s1']), inside('zzz')), false);
    });
    it('自分の中・自分の中のフォルダの中は偽', () => {
        const ids = new Set(['G1']);
        assert.equal(canMoveItems(tree(), ids, inside('G1')), false);
        assert.equal(canMoveItems(tree(), ids, bottom('G1')), false);
        assert.equal(canMoveItems(tree(), ids, inside('G2')), false);
        assert.equal(canMoveItems(tree(), ids, bottom('G2')), false);
    });
    it('動かすフォルダの中の図形の上下は偽', () => {
        const ids = new Set(['G1']);
        assert.equal(canMoveItems(tree(), ids, above('s2')), false);
        assert.equal(canMoveItems(tree(), ids, below('s3')), false);
    });
    it('自分自身の上下は真', () => {
        assert.equal(canMoveItems(tree(), new Set(['G1']), above('G1')), true);
        assert.equal(canMoveItems(tree(), new Set(['G1']), below('G1')), true);
        assert.equal(canMoveItems(tree(), new Set(['s1']), above('s1')), true);
    });
    it('ほかのフォルダの中・上下は真', () => {
        assert.equal(canMoveItems(tree(), new Set(['s1']), inside('G2')), true);
        assert.equal(canMoveItems(tree(), new Set(['G2']), inside('G1')), true);
        assert.equal(canMoveItems(tree(), new Set(['G2']), above('s2')), true);
    });
    it('図形への inside・bottom は偽', () => {
        assert.equal(canMoveItems(tree(), new Set(['s1']), inside('s6')), false);
        assert.equal(canMoveItems(tree(), new Set(['s1']), bottom('s6')), false);
    });
});

describe('moveItems', () => {
    it('図形1つを外から別のフォルダの中へ', () => {
        assert.deepEqual(shape(moveItems(tree(), new Set(['s1']), inside('G2'))), [{ G1: ['s2', { G2: ['s3', 's4', 's1'] }, 's5'] }, 's6']);
    });
    it('フォルダの中から外へ（外側の一番下）', () => {
        assert.deepEqual(shape(moveItems(tree(), new Set(['s5']), bottom(null))), ['s5', 's1', { G1: ['s2', { G2: ['s3', 's4'] }] }, 's6']);
    });
    it('離れた複数がひとかたまりで前順のまま入る', () => {
        assert.deepEqual(shape(moveItems(tree(), new Set(['s6', 's1']), above('s3'))), [{ G1: ['s2', { G2: ['s3', 's1', 's6', 's4'] }, 's5'] }]);
    });
    it('フォルダごと動かす', () => {
        assert.deepEqual(shape(moveItems(tree(), new Set(['G2']), below('s1'))), [{ G2: ['s3', 's4'] }, 's1', { G1: ['s2', 's5'] }, 's6']);
    });
    it('フォルダと図形の混ざり', () => {
        assert.deepEqual(shape(moveItems(tree(), new Set(['G2', 's1']), inside('G1'))), [{ G1: ['s2', 's5', 's1', { G2: ['s3', 's4'] }] }, 's6']);
    });
    it('フォルダの中から別のフォルダへ', () => {
        const items = [g('A', [s('a1')]), g('B', [s('b1')])];
        assert.deepEqual(shape(moveItems(items, new Set(['a1']), inside('B'))), [{ A: [] }, { B: ['b1', 'a1'] }]);
    });
    it('まとまり自身の行の上下を指しても位置がずれない', () => {
        const items = [s('a'), s('b'), s('c')];
        assert.deepEqual(shape(moveItems(items, new Set(['b']), above('b'))), ['a', 'b', 'c']);
        assert.deepEqual(shape(moveItems(items, new Set(['b']), below('b'))), ['a', 'b', 'c']);
        assert.deepEqual(shape(moveItems(items, new Set(['b']), above('a'))), ['a', 'b', 'c']);
        assert.deepEqual(shape(moveItems(items, new Set(['a', 'b']), above('b'))), ['a', 'b', 'c']);
    });
    it('同じ場所なら同じ構造', () => {
        const items = tree();
        const result = moveItems(items, new Set(['s5']), inside('G1'));
        assert.deepEqual(shape(result), shape(items));
    });
    it('空になったフォルダが残る・空のフォルダも動かせる', () => {
        const items = [g('A', [s('a1')]), g('E'), s('x')];
        assert.deepEqual(shape(moveItems(items, new Set(['a1']), bottom(null))), ['a1', { A: [] }, { E: [] }, 'x']);
        assert.deepEqual(shape(moveItems(items, new Set(['E']), inside('A'))), [{ A: ['a1', { E: [] }] }, 'x']);
    });
    it('折りたたみ等の属性が保たれる', () => {
        const items = [g('A', [s('a1')], { collapsed: true, name: 'n' }), s('x')];
        const result = moveItems(items, new Set(['A']), above('x'));
        assert.deepEqual(shape(result), ['x', { A: ['a1'] }]);
        assert.equal(result[1].collapsed, true);
        assert.equal(result[1].name, 'n');
        const result2 = moveItems(items, new Set(['x']), inside('A'));
        assert.equal(result2[0].collapsed, true);
    });
    it('入れられない場所・無い id・動かすものが無いときは null', () => {
        assert.equal(moveItems(tree(), new Set(['G1']), inside('G2')), null);
        assert.equal(moveItems(tree(), new Set(['s1']), above('zzz')), null);
        assert.equal(moveItems(tree(), new Set(['s1']), null), null);
        assert.equal(moveItems(tree(), new Set(['zzz']), bottom(null)), null);
    });
    it('引数を書き換えない・動かさないアイテムは同じ参照', () => {
        const items = tree();
        const before = JSON.stringify(items);
        const result = moveItems(items, new Set(['s1']), inside('G2'));
        assert.equal(JSON.stringify(items), before);
        assert.equal(result[1], items[2]);
        assert.equal(result[0].children[0], items[1].children[0]);
    });
});
