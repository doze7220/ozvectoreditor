/**
 * 責務: ItemAttributeRules（名前の整え方・自動の名前の番号・表示とロックの補い）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveItems, normalizeItemName, applyItemRename } from '../../js/core/ItemAttributeRules.js';
import { ITEM_KIND, listItems } from '../../js/core/ItemTreeRules.js';

/**
 * 図形の代わりの値を作る（typeとidだけを持つ）。
 * @param {string} type - 図形種別
 * @param {string} [id] - 図形のid
 * @returns {{type: string, id: string}} 図形の代わりの値
 */
function fakeShape(type, id = `s-${type}`) {
    return { type, id };
}

/**
 * 図形のアイテムを作る。
 * @param {string} type - 図形種別
 * @param {Object} [attrs] - name・visible・lockedなどの追加の値
 * @returns {Object} 図形のアイテム
 */
function shapeItem(type, attrs = {}) {
    return { kind: ITEM_KIND.SHAPE, shape: fakeShape(type), ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {Array<Object>} children - 中身
 * @param {Object} [attrs] - name・visible・lockedなどの追加の値
 * @returns {Object} フォルダのアイテム
 */
function groupItem(children, attrs = {}) {
    return { kind: ITEM_KIND.GROUP, id: 'group-1', children, ...attrs };
}

/**
 * 結果の名前を描画順（前順）に並べる。
 * @param {Array<Object>} items - アイテムの入れ子
 * @returns {string[]} 名前の配列
 */
function names(items) {
    return listItems(items).map((item) => item.name);
}

describe('normalizeItemName', () => {
    it('文字列でない値は名前なし', () => {
        assert.equal(normalizeItemName(undefined), '');
        assert.equal(normalizeItemName(null), '');
        assert.equal(normalizeItemName(12), '');
        assert.equal(normalizeItemName({}), '');
    });

    it('前後の空白を除く・空白だけは名前なし', () => {
        assert.equal(normalizeItemName('  あ い  '), 'あ い');
        assert.equal(normalizeItemName('   '), '');
        assert.equal(normalizeItemName(''), '');
    });

    it('101文字以上は先頭100文字に切る', () => {
        assert.equal(normalizeItemName('a'.repeat(150)), 'a'.repeat(100));
        assert.equal(normalizeItemName('a'.repeat(100)), 'a'.repeat(100));
    });

    it('100文字目の前後の空白は切った後に除く', () => {
        assert.equal(normalizeItemName('a'.repeat(99) + ' bcd'), 'a'.repeat(99));
        assert.equal(normalizeItemName('a'.repeat(98) + '  bcd'), 'a'.repeat(98));
    });

    it('サロゲートペアを分断しない', () => {
        assert.equal(normalizeItemName('😀'.repeat(101)), '😀'.repeat(100));
    });
});

describe('resolveItems: 種類ごとの呼び名', () => {
    it('6種の呼び名と未知の種別', () => {
        const types = ['line', 'curve', 'arc', 'rect', 'circle', 'path', 'zzz'];
        const result = resolveItems(types.map((t) => shapeItem(t)));
        assert.deepEqual(names(result), ['直線 1', '曲線 1', '弧 1', '矩形 1', '円 1', 'パス 1', '図形 1']);
    });

    it('素の図形インスタンスも受ける', () => {
        const result = resolveItems([fakeShape('line'), fakeShape('line', 's2')]);
        assert.deepEqual(names(result), ['直線 1', '直線 2']);
        assert.equal(result[0].kind, ITEM_KIND.SHAPE);
    });

    it('フォルダの自動の名前', () => {
        const result = resolveItems([groupItem([]), groupItem([groupItem([])])]);
        assert.deepEqual(names(result), ['フォルダ 1', 'フォルダ 2', 'フォルダ 3']);
    });

    it('空の並びは空の配列', () => {
        assert.deepEqual(resolveItems([]), []);
    });
});

describe('resolveItems: 番号の数え方', () => {
    it('最大番号の次を付け、欠番を埋めない', () => {
        const result = resolveItems([
            shapeItem('line', { name: '直線 5' }),
            shapeItem('line', { name: '直線 2' }),
            shapeItem('line'),
        ]);
        assert.deepEqual(names(result), ['直線 5', '直線 2', '直線 6']);
    });

    it('種別と食い違う名前も名前の文字列で数える', () => {
        const result = resolveItems([shapeItem('path', { name: '直線 2' }), shapeItem('line')]);
        assert.deepEqual(names(result), ['直線 2', '直線 3']);
    });

    it('existingItemsの名前を避ける（書き換えない）', () => {
        const existing = [shapeItem('line', { name: '直線 3' }), groupItem([], { name: 'フォルダ 4' })];
        const snapshot = JSON.stringify(existing);
        const result = resolveItems([shapeItem('line'), groupItem([])], existing);
        assert.deepEqual(names(result), ['直線 4', 'フォルダ 5']);
        assert.equal(JSON.stringify(existing), snapshot);
    });

    it('existingItemsの名前も整えて数える', () => {
        const result = resolveItems([shapeItem('path')], [shapeItem('path', { name: ' パス 7 ' })]);
        assert.deepEqual(names(result), ['パス 8']);
    });

    it('後ろにある名前のある要素とも重ならない', () => {
        const result = resolveItems([shapeItem('rect'), shapeItem('rect', { name: '矩形 1' })]);
        assert.deepEqual(names(result), ['矩形 2', '矩形 1']);
    });

    it('入れ子の中の名前も数える', () => {
        const result = resolveItems([
            shapeItem('circle'),
            groupItem([groupItem([shapeItem('circle', { name: '円 3' })])]),
        ]);
        assert.deepEqual(names(result), ['円 4', 'フォルダ 1', 'フォルダ 2', '円 3']);
    });

    it('フォルダの名前も数える', () => {
        const result = resolveItems([groupItem([], { name: 'フォルダ 9' }), groupItem([])]);
        assert.deepEqual(names(result), ['フォルダ 9', 'フォルダ 10']);
    });

    it('前後に空白のある名前と名前なしが混ざっても重ならない（順が逆でも）', () => {
        const a = resolveItems([shapeItem('path', { name: ' パス 1 ' }), shapeItem('path')]);
        assert.deepEqual(names(a), ['パス 1', 'パス 2']);
        const b = resolveItems([shapeItem('path'), shapeItem('path', { name: ' パス 1 ' })]);
        assert.deepEqual(names(b), ['パス 2', 'パス 1']);
    });

    it('100文字で切って初めて自動の名前の形になる名前も数える', () => {
        const long = 'パス 1' + ' '.repeat(96) + 'x';
        const result = resolveItems([shapeItem('path', { name: long }), shapeItem('path')]);
        assert.deepEqual(names(result), ['パス 1', 'パス 2']);
    });

    it('自動の名前の形でないものは数えない', () => {
        const odd = ['パス', 'パス  3', 'パス 03', 'パス ３', 'パス 0', 'パス 3a', 'パス\n9'];
        const result = resolveItems([...odd.map((name) => shapeItem('path', { name })), shapeItem('path')]);
        assert.equal(names(result).at(-1), 'パス 1');
    });

    it('非常に大きい番号で壊れない', () => {
        const huge = resolveItems([shapeItem('line', { name: `直線 ${'9'.repeat(400)}` }), shapeItem('line')]);
        assert.equal(names(huge)[1], '直線 1');
        const edge = resolveItems([shapeItem('line', { name: `直線 ${Number.MAX_SAFE_INTEGER}` }), shapeItem('line')]);
        assert.equal(names(edge)[1], '直線 1');
        const ok = resolveItems([shapeItem('line', { name: `直線 ${Number.MAX_SAFE_INTEGER - 1}` }), shapeItem('line')]);
        assert.equal(names(ok)[1], `直線 ${Number.MAX_SAFE_INTEGER}`);
    });
});

describe('resolveItems: 名前の不備', () => {
    it('無い・数値・null・空・空白だけは名前なしとして自動の名前になる', () => {
        const bad = [undefined, 5, null, '', '   '];
        const result = resolveItems(bad.map((name) => shapeItem('line', { name })));
        assert.deepEqual(names(result), ['直線 1', '直線 2', '直線 3', '直線 4', '直線 5']);
    });

    it('名前の前後の空白を除き、101文字以上は100文字にする', () => {
        const result = resolveItems([
            shapeItem('line', { name: '  あ  ' }),
            shapeItem('line', { name: 'b'.repeat(101) }),
            shapeItem('line', { name: '😀'.repeat(101) }),
        ]);
        assert.deepEqual(names(result), ['あ', 'b'.repeat(100), '😀'.repeat(100)]);
    });

    it('重複した名前は許す', () => {
        const result = resolveItems([shapeItem('line', { name: 'A' }), shapeItem('line', { name: 'A' })]);
        assert.deepEqual(names(result), ['A', 'A']);
    });
});

describe('resolveItems: 表示・ロック', () => {
    it('不備は visible=true・locked=false に補う', () => {
        const bad = [undefined, 'false', 0, 1, null];
        const result = resolveItems(bad.map((v) => shapeItem('line', { visible: v, locked: v })));
        for (const item of result) {
            assert.equal(item.visible, true);
            assert.equal(item.locked, false);
        }
    });

    it('真偽値はそのまま保つ', () => {
        const result = resolveItems([shapeItem('line', { visible: false, locked: true })]);
        assert.equal(result[0].visible, false);
        assert.equal(result[0].locked, true);
    });

    it('フォルダにも補う', () => {
        const result = resolveItems([groupItem([shapeItem('line')])]);
        assert.equal(result[0].visible, true);
        assert.equal(result[0].locked, false);
        assert.equal(result[0].children[0].visible, true);
    });
});

describe('resolveItems: 不変性・冪等性', () => {
    it('引数を書き換えず、毎回新しいアイテムを返す', () => {
        const input = [groupItem([shapeItem('line', { name: ' x ' })]), shapeItem('arc')];
        const snapshot = JSON.stringify(input);
        const first = resolveItems(input);
        assert.equal(JSON.stringify(input), snapshot);
        assert.notEqual(first[0], input[0]);
        assert.notEqual(first[0].children[0], input[0].children[0]);
        assert.equal(first[0].children[0].shape, input[0].children[0].shape);
        assert.notEqual(resolveItems(input)[1], first[1]);
    });

    it('2回通しても値が変わらない', () => {
        const input = [
            shapeItem('line'),
            groupItem([shapeItem('path', { name: ' パス 3 ' }), shapeItem('path')]),
            shapeItem('rect', { visible: false }),
        ];
        const once = resolveItems(input);
        const twice = resolveItems(once);
        assert.equal(JSON.stringify(twice), JSON.stringify(once));
    });

    it('入れ子の中の名前なしにも描画順で番号が付く', () => {
        const result = resolveItems([
            groupItem([shapeItem('line'), groupItem([shapeItem('line')])]),
            shapeItem('line'),
        ]);
        assert.deepEqual(names(result), ['フォルダ 1', '直線 1', 'フォルダ 2', '直線 2', '直線 3']);
    });
});

describe('applyItemRename', () => {
    /**
     * 名前つきの図形のアイテムを作る。
     * @param {string} id - 図形のid
     * @param {string} name - 名前
     * @param {Object} [attrs] - 追加の値
     * @returns {Object} 図形のアイテム
     */
    function named(id, name, attrs = {}) {
        return shapeItem('rect', { name, ...attrs, shape: fakeShape('rect', id) });
    }

    it('前後の空白を除いた名前になる', () => {
        const result = applyItemRename([named('a', '旧')], 'a', '  新しい  ');
        assert.equal(result[0].name, '新しい');
    });

    it('101文字は100文字に切る', () => {
        const result = applyItemRename([named('a', '旧')], 'a', 'x'.repeat(101));
        assert.equal(result[0].name, 'x'.repeat(100));
    });

    it('サロゲートペアは1文字と数える', () => {
        const result = applyItemRename([named('a', '旧')], 'a', '😀'.repeat(101));
        assert.equal(Array.from(result[0].name).length, 100);
    });

    it('空・空白だけ・文字列でない値はnull', () => {
        const items = [named('a', '旧')];
        assert.equal(applyItemRename(items, 'a', ''), null);
        assert.equal(applyItemRename(items, 'a', '   	'), null);
        assert.equal(applyItemRename(items, 'a', undefined), null);
        assert.equal(applyItemRename(items, 'a', 5), null);
    });

    it('今の名前と同じ・整えると同じならnull', () => {
        const items = [named('a', '旧')];
        assert.equal(applyItemRename(items, 'a', '旧'), null);
        assert.equal(applyItemRename(items, 'a', '  旧 '), null);
    });

    it('無いidはnull', () => {
        assert.equal(applyItemRename([named('a', '旧')], 'zzz', '新'), null);
        assert.equal(applyItemRename([], 'a', '新'), null);
    });

    it('フォルダはitem.idで探して名前を変える', () => {
        const items = [groupItem([named('a', '旧')], { id: 'g1', name: 'フォルダ 1' })];
        const result = applyItemRename(items, 'g1', '箱');
        assert.equal(result[0].name, '箱');
        assert.equal(result[0].children[0].name, '旧');
    });

    it('フォルダの中の図形も変えられる', () => {
        const items = [groupItem([named('a', '旧'), named('b', 'B')], { id: 'g1', name: 'G' })];
        const result = applyItemRename(items, 'b', '新');
        assert.equal(result[0].children[1].name, '新');
        assert.equal(result[0].children[0].name, '旧');
        assert.equal(result[0].name, 'G');
    });

    it('重複した名前も許す', () => {
        const items = [named('a', '旧'), named('b', '同じ')];
        const result = applyItemRename(items, 'a', '同じ');
        assert.deepEqual(names(result), ['同じ', '同じ']);
    });

    it('引数を書き換えない・新しいアイテムを返す', () => {
        const items = [groupItem([named('a', '旧')], { id: 'g1', name: 'G' }), named('b', 'B')];
        const before = JSON.stringify(items);
        const result = applyItemRename(items, 'a', '新');
        assert.equal(JSON.stringify(items), before);
        assert.notEqual(result[0], items[0]);
        assert.notEqual(result[0].children[0], items[0].children[0]);
        assert.equal(items[0].children[0].name, '旧');
    });

    it('表示・ロック・図形は変わらない', () => {
        const shape = fakeShape('rect', 'a');
        const items = [{ kind: ITEM_KIND.SHAPE, shape, name: '旧', visible: false, locked: true }];
        const result = applyItemRename(items, 'a', '新');
        assert.equal(result[0].visible, false);
        assert.equal(result[0].locked, true);
        assert.equal(result[0].shape, shape);
    });
});
