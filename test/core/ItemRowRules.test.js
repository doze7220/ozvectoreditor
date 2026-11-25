/**
 * 責務：ItemRowRules（一覧の行の並び・字下げ・行の見た目・スクロールの対象）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildItemRows,
    resolveRowIndent,
    resolveRowViews,
    resolveRowHighlight
} from '../../js/core/ItemRowRules.js';

/**
 * 図形のアイテムを作る。
 * @param {string} id - 図形の id
 * @returns {Object} 図形のアイテム
 */
function sItem(id) {
    return { kind: 'shape', shape: { id }, name: `n${id}`, visible: true, locked: false };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダの id
 * @param {Object[]} children - 中のアイテム
 * @param {boolean} [collapsed=false] - 閉じているか
 * @returns {Object} フォルダのアイテム
 */
function gItem(id, children, collapsed = false) {
    const item = { kind: 'group', id, name: `g${id}`, visible: true, locked: false, children };
    if (collapsed) item.collapsed = true;
    return item;
}

/**
 * 選択の判定関数を作る。
 * @param {string[]} ids - 選ばれている図形のid
 * @returns {function(string): boolean} 判定関数
 */
function selecting(ids) {
    const set = new Set(ids);
    return (id) => set.has(id);
}

describe('buildItemRows', () => {
    it('空なら行は無い', () => {
        assert.deepEqual(buildItemRows([]), []);
    });

    it('フォルダの無い並びは、前順の逆（先頭が前面）で深さ0・図形の行になる', () => {
        const items = [sItem('a'), sItem('b')];
        const rows = buildItemRows(items);
        assert.deepEqual(rows.map((row) => row.id), ['b', 'a']);
        assert.equal(rows[0].kind, 'shape');
        assert.equal(rows[0].depth, 0);
        assert.deepEqual(rows[0].ancestorIds, []);
        assert.equal(rows[0].shape, items[1].shape);
        assert.deepEqual(rows[0].shapeIds, ['b']);
        assert.deepEqual(rows[0].groupIds, []);
        assert.equal(rows[0].name, 'nb');
        assert.equal(rows[0].collapsed, false);
        assert.equal(rows[0].isEmpty, false);
    });

    it('フォルダの行の次に中身の行が並び、深さ・ancestorIdsが付く', () => {
        const items = [sItem('a'), gItem('g1', [sItem('b'), sItem('c')]), sItem('d')];
        const rows = buildItemRows(items);
        assert.deepEqual(rows.map((row) => row.id), ['d', 'g1', 'c', 'b', 'a']);
        assert.deepEqual(rows.map((row) => row.depth), [0, 0, 1, 1, 0]);
        assert.deepEqual(rows[2].ancestorIds, ['g1']);
        assert.equal(rows[1].kind, 'group');
        assert.equal(rows[1].shape, null);
        assert.equal(rows[1].name, 'gg1');
    });

    it('フォルダのshapeIds・groupIdsは入れ子の中すべて（行の並びの順）', () => {
        const items = [gItem('g1', [sItem('a'), gItem('g2', [sItem('b'), gItem('g3', [])]), sItem('c')])];
        const rows = buildItemRows(items);
        assert.deepEqual(rows.map((row) => row.id), ['g1', 'c', 'g2', 'g3', 'b', 'a']);
        assert.deepEqual(rows[0].shapeIds, ['c', 'b', 'a']);
        assert.deepEqual(rows[0].groupIds, ['g2', 'g3']);
        assert.deepEqual(rows[2].shapeIds, ['b']);
        assert.deepEqual(rows[2].groupIds, ['g3']);
        assert.deepEqual(rows[3].ancestorIds, ['g1', 'g2']);
        assert.equal(rows[3].depth, 2);
    });

    it('空のフォルダは行になり、isEmptyが真', () => {
        const rows = buildItemRows([gItem('g1', [])]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].isEmpty, true);
        assert.deepEqual(rows[0].shapeIds, []);
    });

    it('折りたたんだフォルダの中身は行にならないが、shapeIdsには入る', () => {
        const rows = buildItemRows([gItem('g1', [sItem('a'), sItem('b')], true), sItem('c')]);
        assert.deepEqual(rows.map((row) => row.id), ['c', 'g1']);
        assert.equal(rows[1].collapsed, true);
        assert.deepEqual(rows[1].shapeIds, ['b', 'a']);
    });

    it('折りたたんだ中の折りたたんだフォルダも行にならず、外側のフォルダの集計に入る', () => {
        const rows = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')], true), sItem('b')], true)]);
        assert.deepEqual(rows.map((row) => row.id), ['g1']);
        assert.deepEqual(rows[0].shapeIds, ['b', 'a']);
        assert.deepEqual(rows[0].groupIds, ['g2']);
    });

    it('開いたフォルダの中の閉じたフォルダは行になるが、その中身は行にならない', () => {
        const rows = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')], true)])]);
        assert.deepEqual(rows.map((row) => row.id), ['g1', 'g2']);
        assert.equal(rows[1].collapsed, true);
    });

    it('引数を書き換えない', () => {
        const items = [gItem('g1', [sItem('a')])];
        const before = JSON.stringify(items);
        buildItemRows(items);
        assert.equal(JSON.stringify(items), before);
    });
});

describe('resolveRowIndent', () => {
    it('1段12pxで、6段で頭打ち（72px）', () => {
        assert.equal(resolveRowIndent(0), 0);
        assert.equal(resolveRowIndent(1), 12);
        assert.equal(resolveRowIndent(6), 72);
        assert.equal(resolveRowIndent(7), 72);
        assert.equal(resolveRowIndent(20), 72);
    });
});

describe('resolveRowViews', () => {
    const items = [gItem('g1', [sItem('a'), sItem('b')]), sItem('c')];
    const rows = buildItemRows(items);

    it('図形の行は字下げ・選択・描き込む先の印を持つ', () => {
        const views = resolveRowViews({ rows, isSelected: selecting(['c']), selectedGroupIds: [], insertMarkId: null });
        assert.deepEqual(views.map((view) => view.id), ['c', 'g1', 'b', 'a']);
        assert.equal(views[0].selected, true);
        assert.equal(views[0].selectedInGroup, false);
        assert.equal(views[2].indent, 12);
        assert.equal(views[2].selected, false);
        const marked = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: 'a' });
        assert.equal(marked[3].insertTarget, true);
        assert.equal(marked[2].insertTarget, false);
    });

    it('選んでいるフォルダは強く、中の図形は弱い見た目になる', () => {
        const views = resolveRowViews({ rows, isSelected: selecting(['a', 'b']), selectedGroupIds: ['g1'], insertMarkId: null });
        assert.equal(views[1].selected, true);
        assert.equal(views[1].selectedInGroup, false);
        assert.equal(views[2].selected, false);
        assert.equal(views[2].selectedInGroup, true);
        assert.equal(views[3].selectedInGroup, true);
        assert.equal(views[0].selected, false);
    });

    it('入れ子のフォルダは、外側が選ばれていれば弱い見た目で、自分だけ選ばれていれば強い', () => {
        const nested = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')])])]);
        const outer = resolveRowViews({ rows: nested, isSelected: selecting(['a']), selectedGroupIds: ['g1'], insertMarkId: null });
        assert.equal(outer[1].selected, false);
        assert.equal(outer[1].selectedInGroup, true);
        const inner = resolveRowViews({ rows: nested, isSelected: selecting(['a']), selectedGroupIds: ['g2'], insertMarkId: null });
        assert.equal(inner[0].selected, false);
        assert.equal(inner[1].selected, true);
        assert.equal(inner[2].selectedInGroup, true);
    });

    it('canToggleは空でないフォルダだけ真', () => {
        const withEmpty = buildItemRows([gItem('g1', []), gItem('g2', [sItem('a')]), sItem('b')]);
        const views = resolveRowViews({ rows: withEmpty, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: null });
        assert.equal(views.find((view) => view.id === 'g1').canToggle, false);
        assert.equal(views.find((view) => view.id === 'g2').canToggle, true);
        assert.equal(views.find((view) => view.id === 'b').canToggle, false);
    });

    it('見えない行の印：閉じたフォルダの中の選択・描き込む先・選んでいるフォルダで出る', () => {
        const closed = buildItemRows([gItem('g1', [sItem('a'), gItem('g2', [sItem('b')])], true), sItem('c')]);
        const none = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: null });
        assert.equal(none.find((view) => view.id === 'g1').hiddenMark, false);
        const bySelect = resolveRowViews({ rows: closed, isSelected: selecting(['a']), selectedGroupIds: [], insertMarkId: null });
        assert.equal(bySelect.find((view) => view.id === 'g1').hiddenMark, true);
        const byMark = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: 'b' });
        assert.equal(byMark.find((view) => view.id === 'g1').hiddenMark, true);
        const byGroup = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: ['g2'], insertMarkId: null });
        assert.equal(byGroup.find((view) => view.id === 'g1').hiddenMark, true);
        assert.equal(byGroup.find((view) => view.id === 'c').hiddenMark, false);
    });

    it('見えない行の印は、閉じたフォルダ自身が選ばれていても出る。開いたフォルダ・図形には出ない', () => {
        const closed = buildItemRows([gItem('g1', [sItem('a')], true)]);
        const views = resolveRowViews({ rows: closed, isSelected: selecting(['a']), selectedGroupIds: ['g1'], insertMarkId: null });
        assert.equal(views[0].selected, true);
        assert.equal(views[0].hiddenMark, true);
        const open = resolveRowViews({ rows, isSelected: selecting(['a']), selectedGroupIds: [], insertMarkId: null });
        assert.equal(open.some((view) => view.hiddenMark), false);
    });

    it('多段では、見えている外側の閉じたフォルダだけに印が出る', () => {
        const nested = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')], true)], true)]);
        const views = resolveRowViews({ rows: nested, isSelected: selecting(['a']), selectedGroupIds: [], insertMarkId: null });
        assert.equal(views.length, 1);
        assert.equal(views[0].hiddenMark, true);
        const open = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')], true)])]);
        const openViews = resolveRowViews({ rows: open, isSelected: selecting(['a']), selectedGroupIds: [], insertMarkId: null });
        assert.equal(openViews[0].hiddenMark, false);
        assert.equal(openViews[1].hiddenMark, true);
    });

    it('引数を書き換えない', () => {
        const before = JSON.stringify(rows);
        resolveRowViews({ rows, isSelected: selecting(['a']), selectedGroupIds: ['g1'], insertMarkId: 'a' });
        assert.equal(JSON.stringify(rows), before);
    });
});

describe('resolveRowHighlight', () => {
    const rows = buildItemRows([gItem('g1', [sItem('a'), sItem('b')]), sItem('c')]);

    it('selected・selectedInGroupの行のid、印が無ければmarkIdはnull、indexesは選ばれている行', () => {
        const views = resolveRowViews({ rows, isSelected: selecting(['a', 'b']), selectedGroupIds: ['g1'], insertMarkId: null });
        const highlight = resolveRowHighlight(views);
        assert.deepEqual(highlight.selectedIds, ['g1', 'b', 'a']);
        assert.equal(highlight.markId, null);
        assert.deepEqual(highlight.indexes, [1, 2, 3]);
    });

    it('選ばれている行が無ければ、印の行がindexesになる', () => {
        const views = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: 'a' });
        const highlight = resolveRowHighlight(views);
        assert.deepEqual(highlight.selectedIds, []);
        assert.equal(highlight.markId, 'a');
        assert.deepEqual(highlight.indexes, [3]);
    });

    it('markIdは、描き込む先か見えない行の印の最初の行', () => {
        const closed = buildItemRows([gItem('g1', [sItem('a')], true), sItem('b')]);
        const views = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: 'a' });
        assert.equal(resolveRowHighlight(views).markId, 'g1');
    });

    it('何も無ければ空', () => {
        const views = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMarkId: null });
        assert.deepEqual(resolveRowHighlight(views), { selectedIds: [], markId: null, indexes: [] });
    });
});
