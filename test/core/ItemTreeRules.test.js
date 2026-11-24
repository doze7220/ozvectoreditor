/**
 * 責務：ItemTreeRules（図形とフォルダのアイテムの入れ子を扱う計算の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ITEM_KIND,
    toItems,
    listItems,
    listShapeItems,
    listShapes,
    placeShapeItems,
    filterShapes,
    insertItemsAbove
} from '../../js/core/ItemTreeRules.js';

/**
 * テスト用の素の図形（不透明な値）を作る。
 * @param {string} id - 図形の id
 * @returns {{id: string}} 図形の代わりのオブジェクト
 */
function shape(id) {
    return { id };
}

/**
 * 図形のアイテムを作る。
 * @param {string} id - 図形の id
 * @param {string} name - 名前
 * @returns {Object} 図形のアイテム
 */
function sItem(id, name) {
    return { kind: 'shape', shape: shape(id), name, visible: true, locked: false };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダの id
 * @param {Object[]} children - 中身
 * @returns {Object} フォルダのアイテム
 */
function gItem(id, children) {
    return { kind: 'group', id, name: id, visible: false, locked: true, children };
}

/**
 * 3段の入れ子を作る：s1, G1[s2, G2[s3, G3[s4]], s5], s6。
 * @returns {Object[]} アイテムの入れ子
 */
function deepTree() {
    return [
        sItem('s1', 'n1'),
        gItem('G1', [
            sItem('s2', 'n2'),
            gItem('G2', [sItem('s3', 'n3'), gItem('G3', [sItem('s4', 'n4')])]),
            sItem('s5', 'n5')
        ]),
        sItem('s6', 'n6')
    ];
}

/**
 * アイテムの並びを id の文字列に直す（図形は shape.id、フォルダは id）。
 * @param {Object[]} items - アイテムの配列
 * @returns {string[]} id の配列
 */
function ids(items) {
    return items.map((item) => (item.kind === 'group' ? item.id : item.shape.id));
}

describe('ITEM_KIND', () => {
    it('shape と group の値を持ち、凍結されている', () => {
        assert.deepEqual({ ...ITEM_KIND }, { SHAPE: 'shape', GROUP: 'group' });
        assert.equal(Object.isFrozen(ITEM_KIND), true);
    });
});

describe('toItems', () => {
    it('素の図形は名前・表示・ロックが未定の図形のアイテムになり、図形は共有する', () => {
        const a = shape('a');
        const result = toItems([a]);
        assert.equal(result.length, 1);
        assert.equal(result[0].kind, 'shape');
        assert.equal(result[0].shape, a);
        assert.equal(result[0].name, undefined);
        assert.equal(result[0].visible, undefined);
        assert.equal(result[0].locked, undefined);
    });

    it('アイテムは新しいオブジェクトへ写され、図形インスタンスは共有される', () => {
        const source = [sItem('a', '名前')];
        const result = toItems(source);
        assert.notEqual(result[0], source[0]);
        assert.deepEqual(result[0], source[0]);
        assert.equal(result[0].shape, source[0].shape);
    });

    it('入れ子まで写し、書き換えても元が変わらない', () => {
        const source = deepTree();
        const before = JSON.stringify(source);
        const result = toItems(source);
        assert.notEqual(result[1], source[1]);
        assert.notEqual(result[1].children, source[1].children);
        result[1].name = '変更';
        result[1].children.push(sItem('x', 'x'));
        result[1].children[0].name = '変更';
        assert.equal(JSON.stringify(source), before);
    });

    it('素の図形とアイテムが混ざっていても順を保つ', () => {
        const result = toItems([shape('a'), gItem('G', [shape('b')]), sItem('c', 'c')]);
        assert.deepEqual(ids(result), ['a', 'G', 'c']);
        assert.equal(result[1].children[0].kind, 'shape');
        assert.equal(result[1].children[0].shape.id, 'b');
    });

    it('空配列は空配列', () => {
        assert.deepEqual(toItems([]), []);
    });
});

describe('listItems', () => {
    it('入れ子を前順（フォルダ → その中身）で並べ、要素は引数のアイテムそのもの', () => {
        const tree = deepTree();
        const list = listItems(tree);
        assert.deepEqual(ids(list), ['s1', 'G1', 's2', 'G2', 's3', 'G3', 's4', 's5', 's6']);
        assert.equal(list[1], tree[1]);
        assert.equal(list[2], tree[1].children[0]);
    });

    it('空のフォルダも含む', () => {
        assert.deepEqual(ids(listItems([gItem('G', [])])), ['G']);
    });

    it('空配列は空配列', () => {
        assert.deepEqual(listItems([]), []);
    });

    it('引数を書き換えない', () => {
        const tree = deepTree();
        const before = JSON.stringify(tree);
        listItems(tree);
        assert.equal(JSON.stringify(tree), before);
    });
});

describe('listShapeItems / listShapes', () => {
    it('図形のアイテムだけを前順で返す', () => {
        const tree = deepTree();
        const shapeItems = listShapeItems(tree);
        assert.deepEqual(ids(shapeItems), ['s1', 's2', 's3', 's4', 's5', 's6']);
        assert.equal(shapeItems[1], tree[1].children[0]);
    });

    it('listShapes は図形だけ（重なり順）を返す', () => {
        const tree = deepTree();
        const shapes = listShapes(tree);
        assert.deepEqual(shapes.map((s) => s.id), ['s1', 's2', 's3', 's4', 's5', 's6']);
        assert.equal(shapes[0], tree[0].shape);
    });

    it('フォルダだけなら空', () => {
        assert.deepEqual(listShapeItems([gItem('G', [])]), []);
        assert.deepEqual(listShapes([gItem('G', [gItem('H', [])])]), []);
    });

    it('素の図形を toItems した並びからも取れる', () => {
        const a = shape('a');
        assert.deepEqual(listShapes(toItems([a])), [a]);
    });

    it('空配列は空配列', () => {
        assert.deepEqual(listShapeItems([]), []);
        assert.deepEqual(listShapes([]), []);
    });
});

describe('placeShapeItems', () => {
    it('フォルダの位置・id・属性・入れ子を保ち、図形のアイテムを前から順に置く', () => {
        const tree = deepTree();
        const reversed = listShapeItems(tree).reverse();
        const result = placeShapeItems(tree, reversed);
        assert.deepEqual(ids(listItems(result)), ['s6', 'G1', 's5', 'G2', 's4', 'G3', 's3', 's2', 's1']);
        const g1 = result[1];
        assert.equal(g1.id, 'G1');
        assert.equal(g1.name, 'G1');
        assert.equal(g1.visible, false);
        assert.equal(g1.locked, true);
        assert.equal(g1.children.length, 3);
        assert.equal(g1.children[1].id, 'G2');
        assert.equal(g1.children[1].children[1].id, 'G3');
    });

    it('図形の名前・表示・ロックは図形のアイテムについて動く', () => {
        const tree = [sItem('a', 'A'), gItem('G', [sItem('b', 'B')])];
        const [first, second] = listShapeItems(tree);
        const result = placeShapeItems(tree, [second, first]);
        assert.equal(result[0].shape.id, 'b');
        assert.equal(result[0].name, 'B');
        assert.equal(result[1].children[0].shape.id, 'a');
        assert.equal(result[1].children[0].name, 'A');
        assert.equal(result[1].name, 'G');
    });

    it('同じ順で置けば同じ内容になる', () => {
        const tree = deepTree();
        const result = placeShapeItems(tree, listShapeItems(tree));
        assert.deepEqual(result, tree);
    });

    it('空のフォルダを保つ・空配列は空配列', () => {
        const result = placeShapeItems([gItem('G', []), sItem('a', 'A')], [sItem('b', 'B')]);
        assert.deepEqual(ids(result), ['G', 'b']);
        assert.deepEqual(result[0].children, []);
        assert.deepEqual(placeShapeItems([], []), []);
    });

    it('引数の配列・アイテムを書き換えず、フォルダは新しいオブジェクトになる', () => {
        const tree = deepTree();
        const shapeItems = listShapeItems(tree).reverse();
        const treeBefore = JSON.stringify(tree);
        const itemsBefore = JSON.stringify(shapeItems);
        const result = placeShapeItems(tree, shapeItems);
        assert.equal(JSON.stringify(tree), treeBefore);
        assert.equal(JSON.stringify(shapeItems), itemsBefore);
        assert.notEqual(result[1], tree[1]);
        assert.notEqual(result[1].children, tree[1].children);
    });
});

describe('filterShapes', () => {
    it('keep が偽の図形のアイテムだけを除き、フォルダは空になっても残す', () => {
        const tree = deepTree();
        const result = filterShapes(tree, (s) => s.id !== 's4' && s.id !== 's1');
        assert.deepEqual(ids(listItems(result)), ['G1', 's2', 'G2', 's3', 'G3', 's5', 's6']);
        const g3 = result[0].children[1].children[1];
        assert.equal(g3.id, 'G3');
        assert.deepEqual(g3.children, []);
    });

    it('すべて除いてもフォルダは残る', () => {
        const result = filterShapes(deepTree(), () => false);
        assert.deepEqual(ids(listItems(result)), ['G1', 'G2', 'G3']);
    });

    it('keep は図形1つにつき1回、前順で呼ぶ（フォルダでは呼ばない）', () => {
        const calls = [];
        filterShapes(deepTree(), (s) => {
            calls.push(s.id);
            return true;
        });
        assert.deepEqual(calls, ['s1', 's2', 's3', 's4', 's5', 's6']);
    });

    it('残したアイテムの属性は保たれる', () => {
        const tree = deepTree();
        const result = filterShapes(tree, () => true);
        assert.deepEqual(result, tree);
    });

    it('空配列は空配列で、keep を呼ばない', () => {
        let count = 0;
        assert.deepEqual(filterShapes([], () => { count += 1; return true; }), []);
        assert.equal(count, 0);
    });

    it('引数を書き換えない', () => {
        const tree = deepTree();
        const before = JSON.stringify(tree);
        const result = filterShapes(tree, (s) => s.id !== 's2');
        assert.equal(JSON.stringify(tree), before);
        assert.notEqual(result[1], tree[1]);
    });
});

describe('insertItemsAbove', () => {
    const is = (id) => (s) => s.id === id;

    it('外側の図形のすぐ後ろへ入る', () => {
        const result = insertItemsAbove(deepTree(), is('s1'), [sItem('n1', 'x')]);
        assert.deepEqual(ids(result), ['s1', 'n1', 'G1', 's6']);
    });

    it('フォルダの中の図形なら同じフォルダの中へ入る', () => {
        const result = insertItemsAbove(deepTree(), is('s2'), [sItem('n1', 'x')]);
        assert.deepEqual(ids(result), ['s1', 'G1', 's6']);
        assert.deepEqual(ids(result[1].children), ['s2', 'n1', 'G2', 's5']);
    });

    it('深い入れ子の中の図形でも、その並びへ入る', () => {
        const result = insertItemsAbove(deepTree(), is('s4'), [sItem('n1', 'x')]);
        const g3 = result[1].children[1].children[1];
        assert.deepEqual(ids(g3.children), ['s4', 'n1']);
    });

    it('見つからなければいちばん外側の末尾へ足す', () => {
        const result = insertItemsAbove(deepTree(), is('none'), [sItem('n1', 'x')]);
        assert.deepEqual(ids(result), ['s1', 'G1', 's6', 'n1']);
    });

    it('複数は順のまま入る', () => {
        const result = insertItemsAbove(deepTree(), is('s3'), [sItem('n1', 'x'), sItem('n2', 'y')]);
        const g2 = result[1].children[1];
        assert.deepEqual(ids(g2.children), ['s3', 'n1', 'n2', 'G3']);
    });

    it('フォルダを含む追加もそのまま入る', () => {
        const added = [gItem('NG', [sItem('n1', 'x')]), sItem('n2', 'y')];
        const result = insertItemsAbove(deepTree(), is('s6'), added);
        assert.deepEqual(ids(result), ['s1', 'G1', 's6', 'NG', 'n2']);
        assert.deepEqual(ids(result[3].children), ['n1']);
    });

    it('最初（前順）に当たった図形だけが基準になる', () => {
        const result = insertItemsAbove(deepTree(), () => true, [sItem('n1', 'x')]);
        assert.deepEqual(ids(result), ['s1', 'n1', 'G1', 's6']);
    });

    it('引数を書き換えない。通り道のフォルダだけ新しく、通らないものは同じ参照', () => {
        const tree = deepTree();
        const before = JSON.stringify(tree);
        const added = [sItem('n1', 'x')];
        const addedBefore = JSON.stringify(added);
        const result = insertItemsAbove(tree, is('s3'), added);
        assert.equal(JSON.stringify(tree), before);
        assert.equal(JSON.stringify(added), addedBefore);
        assert.notEqual(result, tree);
        assert.notEqual(result[1], tree[1]);
        assert.notEqual(result[1].children[1], tree[1].children[1]);
        assert.equal(result[0], tree[0]);
        assert.equal(result[2], tree[2]);
        assert.equal(result[1].children[1].children[2], tree[1].children[1].children[1]);
    });

    it('空の入れ子には末尾（先頭）へ足す', () => {
        const result = insertItemsAbove([], is('s1'), [sItem('n1', 'x')]);
        assert.deepEqual(ids(result), ['n1']);
    });
});
