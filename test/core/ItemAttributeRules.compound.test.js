/**
 * 責務: ItemAttributeRules.resolveItems がフォルダの compound を true のときだけ残すことを、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveItems } from '../../js/core/ItemAttributeRules.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';

/**
 * フォルダのアイテムを作る。
 * @param {string} id - id
 * @param {Object[]} children - 中身
 * @param {Object} [attrs] - 追加の値
 * @returns {Object} フォルダのアイテム
 */
function group(id, children, attrs = {}) {
    return { kind: ITEM_KIND.GROUP, id, name: id, children, ...attrs };
}

describe('resolveItems: compound', () => {
    it('trueだけを残し、false・"true"・undefinedのキーを消す', () => {
        const out = resolveItems([
            group('a', [], { compound: true }),
            group('b', [], { compound: false }),
            group('c', [], { compound: 'true' }),
            group('d', [], { compound: undefined }),
            group('e', [])
        ]);
        assert.equal(out[0].compound, true);
        for (const item of out.slice(1)) {
            assert.equal('compound' in item, false);
        }
    });

    it('入れ子の中のフォルダも補う', () => {
        const out = resolveItems([group('a', [group('b', [], { compound: true }), group('c', [], { compound: 0 })])]);
        assert.equal(out[0].children[0].compound, true);
        assert.equal('compound' in out[0].children[1], false);
    });

    it('図形のアイテムには触れない', () => {
        const shape = { type: 'rect', id: 'r1' };
        const out = resolveItems([{ kind: ITEM_KIND.SHAPE, shape, compound: 'x' }]);
        assert.equal(out[0].compound, 'x');
    });

    it('2回通しても同じ', () => {
        const once = resolveItems([group('a', [], { compound: true }), group('b', [], { compound: false })]);
        const twice = resolveItems(once);
        assert.deepEqual(twice, once);
    });
});
