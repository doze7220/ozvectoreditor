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
 * @param {Object} [extra] - 追加のプロパティ
 * @returns {Object} 図形のアイテム
 */
function sItem(id, extra = {}) {
    return { kind: 'shape', shape: { id }, name: `n${id}`, visible: true, locked: false, ...extra };
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
    it('0個なら空（空なら行は無い）', () => {
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

    it('前面（前順の末尾）が先頭になる', () => {
        const rows = buildItemRows([sItem('a'), sItem('b'), sItem('c')]);
        assert.deepEqual(rows.map((r) => r.id), ['c', 'b', 'a']);
        assert.deepEqual(rows.map((r) => r.name), ['nc', 'nb', 'na']);
    });

    it('フォルダは行になり、入れ子の中の図形も含み、全体が逆順', () => {
        const items = [sItem('a'), gItem('G', [sItem('b'), gItem('H', [sItem('c')]), sItem('d')]), sItem('e')];
        assert.deepEqual(buildItemRows(items).map((r) => r.id), ['e', 'G', 'd', 'H', 'c', 'b', 'a']);
    });

    it('空のフォルダだけなら行は1つ', () => {
        const rows = buildItemRows([gItem('G', [])]);
        assert.equal(rows.length, 1);
        assert.equal(rows[0].id, 'G');
    });

    it('隠れている・ロックの図形も含める', () => {
        const rows = buildItemRows([sItem('a', { visible: false }), sItem('b', { locked: true })]);
        assert.deepEqual(rows.map((r) => r.id), ['b', 'a']);
    });

    it('名前が未定なら空文字', () => {
        const rows = buildItemRows([{ kind: 'shape', shape: { id: 'a' } }]);
        assert.equal(rows[0].name, '');
    });

    it('図形のインスタンスは同じで、引数を書き換えない', () => {
        const a = sItem('a');
        const b = sItem('b');
        const items = [a, gItem('G', [b])];
        const snapshot = JSON.stringify(items);
        const rows = buildItemRows(items);
        assert.equal(rows[0].kind, 'group');
        assert.equal(rows[1].shape, b.shape);
        assert.equal(rows[2].shape, a.shape);
        assert.equal(JSON.stringify(items), snapshot);
        assert.deepEqual(items.map((i) => i.kind), ['shape', 'group']);
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
        const views = resolveRowViews({ rows, isSelected: selecting(['c']), selectedGroupIds: [], insertMark: null });
        assert.deepEqual(views.map((view) => view.id), ['c', 'g1', 'b', 'a']);
        assert.equal(views[0].selected, true);
        assert.equal(views[0].selectedInGroup, false);
        assert.equal(views[2].indent, 12);
        assert.equal(views[2].selected, false);
        const marked = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMark: { kind: 'above', id: 'a' } });
        assert.equal(marked[3].insertTarget, true);
        assert.equal(marked[2].insertTarget, false);
    });

    it('選んでいるフォルダは強く、中の図形は弱い見た目になる', () => {
        const views = resolveRowViews({ rows, isSelected: selecting(['a', 'b']), selectedGroupIds: ['g1'], insertMark: null });
        assert.equal(views[1].selected, true);
        assert.equal(views[1].selectedInGroup, false);
        assert.equal(views[2].selected, false);
        assert.equal(views[2].selectedInGroup, true);
        assert.equal(views[3].selectedInGroup, true);
        assert.equal(views[0].selected, false);
    });

    it('入れ子のフォルダは、外側が選ばれていれば弱い見た目で、自分だけ選ばれていれば強い', () => {
        const nested = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')])])]);
        const outer = resolveRowViews({ rows: nested, isSelected: selecting(['a']), selectedGroupIds: ['g1'], insertMark: null });
        assert.equal(outer[1].selected, false);
        assert.equal(outer[1].selectedInGroup, true);
        const inner = resolveRowViews({ rows: nested, isSelected: selecting(['a']), selectedGroupIds: ['g2'], insertMark: null });
        assert.equal(inner[0].selected, false);
        assert.equal(inner[1].selected, true);
        assert.equal(inner[2].selectedInGroup, true);
    });

    it('canToggleは空でないフォルダだけ真', () => {
        const withEmpty = buildItemRows([gItem('g1', []), gItem('g2', [sItem('a')]), sItem('b')]);
        const views = resolveRowViews({ rows: withEmpty, isSelected: selecting([]), selectedGroupIds: [], insertMark: null });
        assert.equal(views.find((view) => view.id === 'g1').canToggle, false);
        assert.equal(views.find((view) => view.id === 'g2').canToggle, true);
        assert.equal(views.find((view) => view.id === 'b').canToggle, false);
    });

    it('見えない行の印：閉じたフォルダの中の選択・描き込む先・選んでいるフォルダで出る', () => {
        const closed = buildItemRows([gItem('g1', [sItem('a'), gItem('g2', [sItem('b')])], true), sItem('c')]);
        const none = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: [], insertMark: null });
        assert.equal(none.find((view) => view.id === 'g1').hiddenMark, false);
        const bySelect = resolveRowViews({ rows: closed, isSelected: selecting(['a']), selectedGroupIds: [], insertMark: null });
        assert.equal(bySelect.find((view) => view.id === 'g1').hiddenMark, true);
        const byMark = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: [], insertMark: { kind: 'above', id: 'b' } });
        assert.equal(byMark.find((view) => view.id === 'g1').hiddenMark, true);
        const byGroup = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: ['g2'], insertMark: null });
        assert.equal(byGroup.find((view) => view.id === 'g1').hiddenMark, true);
        assert.equal(byGroup.find((view) => view.id === 'c').hiddenMark, false);
    });

    it('見えない行の印は、閉じたフォルダ自身が選ばれていても出る。開いたフォルダ・図形には出ない', () => {
        const closed = buildItemRows([gItem('g1', [sItem('a')], true)]);
        const views = resolveRowViews({ rows: closed, isSelected: selecting(['a']), selectedGroupIds: ['g1'], insertMark: null });
        assert.equal(views[0].selected, true);
        assert.equal(views[0].hiddenMark, true);
        const open = resolveRowViews({ rows, isSelected: selecting(['a']), selectedGroupIds: [], insertMark: null });
        assert.equal(open.some((view) => view.hiddenMark), false);
    });

    it('多段では、見えている外側の閉じたフォルダだけに印が出る', () => {
        const nested = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')], true)], true)]);
        const views = resolveRowViews({ rows: nested, isSelected: selecting(['a']), selectedGroupIds: [], insertMark: null });
        assert.equal(views.length, 1);
        assert.equal(views[0].hiddenMark, true);
        const open = buildItemRows([gItem('g1', [gItem('g2', [sItem('a')], true)])]);
        const openViews = resolveRowViews({ rows: open, isSelected: selecting(['a']), selectedGroupIds: [], insertMark: null });
        assert.equal(openViews[0].hiddenMark, false);
        assert.equal(openViews[1].hiddenMark, true);
    });

    it('引数を書き換えない', () => {
        const before = JSON.stringify(rows);
        resolveRowViews({ rows, isSelected: selecting(['a']), selectedGroupIds: ['g1'], insertMark: { kind: 'above', id: 'a' } });
        assert.equal(JSON.stringify(rows), before);
    });
});

describe('resolveRowHighlight', () => {
    const rows = buildItemRows([gItem('g1', [sItem('a'), sItem('b')]), sItem('c')]);

    it('selected・selectedInGroupの行のid、印が無ければmarkIdはnull、indexesは選ばれている行', () => {
        const views = resolveRowViews({ rows, isSelected: selecting(['a', 'b']), selectedGroupIds: ['g1'], insertMark: null });
        const highlight = resolveRowHighlight(views);
        assert.deepEqual(highlight.selectedIds, ['g1', 'b', 'a']);
        assert.equal(highlight.markId, null);
        assert.deepEqual(highlight.indexes, [1, 2, 3]);
    });

    it('選ばれている行が無ければ、印の行がindexesになる', () => {
        const views = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMark: { kind: 'above', id: 'a' } });
        const highlight = resolveRowHighlight(views);
        assert.deepEqual(highlight.selectedIds, []);
        assert.equal(highlight.markId, 'a');
        assert.deepEqual(highlight.indexes, [3]);
    });

    it('markIdは、描き込む先か見えない行の印の最初の行', () => {
        const closed = buildItemRows([gItem('g1', [sItem('a')], true), sItem('b')]);
        const views = resolveRowViews({ rows: closed, isSelected: selecting([]), selectedGroupIds: [], insertMark: { kind: 'above', id: 'a' } });
        assert.equal(resolveRowHighlight(views).markId, 'g1');
    });

    it('何も無ければ空', () => {
        const views = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMark: null });
        assert.deepEqual(resolveRowHighlight(views), { selectedIds: [], markId: null, indexes: [] });
    });
});

describe('resolveRowViews（描き込む先の3つの形）', () => {
    const above = (id) => ({ kind: 'above', id });
    const inside = (id) => ({ kind: 'inside', id });
    const bottom = (id) => ({ kind: 'bottom', id });
    const noSel = selecting([]);

    /**
     * 印だけを見る短縮。
     * @param {Object[]} items - アイテムの入れ子
     * @param {Object|null} insertMark - 描き込む先
     * @returns {Object[]} 行の見た目
     */
    function viewsOf(items, insertMark) {
        return resolveRowViews({ rows: buildItemRows(items), isSelected: noSel, selectedGroupIds: [], insertMark });
    }

    it('図形のaboveは行の印で、線は無い', () => {
        const views = viewsOf([sItem('a'), sItem('b')], above('a'));
        assert.deepEqual(views.map((view) => view.insertTarget), [false, true]);
        assert.deepEqual(views.map((view) => view.insertLine), [null, null]);
    });

    it('フォルダのaboveは、その行の上の線（字下げは行の深さ）で、行の印は無い', () => {
        const views = viewsOf([gItem('g1', [gItem('g2', [sItem('a')])])], above('g2'));
        const g2 = views.find((view) => view.id === 'g2');
        assert.deepEqual(g2.insertLine, { edge: 'before', indent: 12 });
        assert.equal(g2.insertTarget, false);
        assert.equal(views.filter((view) => view.insertLine !== null).length, 1);
    });

    it('insideは、開いた・閉じた・空のフォルダのどれでも行の印（閉じても見えない行の印にしない）', () => {
        const open = viewsOf([gItem('g1', [sItem('a')])], inside('g1'));
        assert.equal(open.find((view) => view.id === 'g1').insertTarget, true);
        assert.equal(open.some((view) => view.insertLine !== null), false);
        const closed = viewsOf([gItem('g1', [sItem('a')], true)], inside('g1'));
        assert.equal(closed[0].insertTarget, true);
        assert.equal(closed[0].hiddenMark, false);
        const empty = viewsOf([gItem('g1', [])], inside('g1'));
        assert.equal(empty[0].insertTarget, true);
    });

    it('bottomでidが無ければ、最後の行の下の線（字下げ0）', () => {
        const views = viewsOf([gItem('g1', [sItem('a')]), sItem('b')], bottom(null));
        assert.deepEqual(views.map((view) => view.insertLine), [null, null, { edge: 'after', indent: 0 }]);
    });

    it('bottomでフォルダが開いていて中身があれば、中の最後の見えている行の下の線（1段深い字下げ）', () => {
        const views = viewsOf([sItem('c'), gItem('g1', [sItem('a'), gItem('g2', [sItem('b')])])], bottom('g1'));
        assert.deepEqual(views.map((view) => view.id), ['g1', 'g2', 'b', 'a', 'c']);
        assert.deepEqual(views.map((view) => view.insertLine), [null, null, null, { edge: 'after', indent: 12 }, null]);
        const nestedLast = viewsOf([gItem('g1', [gItem('g2', [sItem('b')]), sItem('a')])], bottom('g1'));
        assert.deepEqual(nestedLast.map((view) => view.id), ['g1', 'a', 'g2', 'b']);
        assert.deepEqual(nestedLast[3].insertLine, { edge: 'after', indent: 12 });
    });

    it('bottomの空のフォルダは行の印、閉じたフォルダは見えない行の印', () => {
        const empty = viewsOf([gItem('g1', [])], bottom('g1'));
        assert.equal(empty[0].insertTarget, true);
        assert.equal(empty[0].insertLine, null);
        const closed = viewsOf([gItem('g1', [sItem('a')], true)], bottom('g1'));
        assert.equal(closed[0].hiddenMark, true);
        assert.equal(closed[0].insertTarget, false);
        assert.equal(closed[0].insertLine, null);
    });

    it('行が見えないとき（閉じたフォルダの中）は、見えている外側の閉じたフォルダに見えない行の印（above・inside・bottom・多段）', () => {
        const items = [gItem('g1', [gItem('g2', [sItem('a'), gItem('g3', [sItem('b')])])], true), sItem('c')];
        for (const mark of [above('a'), above('g3'), inside('g3'), bottom('g3'), bottom('g2'), inside('g2')]) {
            const views = viewsOf(items, mark);
            assert.equal(views.length, 2);
            assert.equal(views[1].hiddenMark, true, mark.kind + ':' + mark.id);
            assert.equal(views[0].hiddenMark, false);
            assert.equal(views.some((view) => view.insertTarget || view.insertLine !== null), false);
        }
    });

    it('行が無い・描き込む先が無い・idの行が無ければ何も付かない', () => {
        assert.deepEqual(resolveRowViews({ rows: [], isSelected: noSel, selectedGroupIds: [], insertMark: bottom(null) }), []);
        for (const mark of [null, above('zz'), inside('zz'), bottom('zz')]) {
            const views = viewsOf([gItem('g1', [sItem('a')]), sItem('b')], mark);
            assert.equal(views.some((view) => view.insertTarget || view.insertLine !== null || view.hiddenMark), false);
        }
    });

    it('引数を書き換えない', () => {
        const rows = buildItemRows([gItem('g1', [sItem('a')]), sItem('b')]);
        const before = JSON.stringify(rows);
        resolveRowViews({ rows, isSelected: noSel, selectedGroupIds: [], insertMark: bottom('g1') });
        assert.equal(JSON.stringify(rows), before);
    });
});

describe('resolveRowHighlight（線の印）', () => {
    it('線を持つ行が印の行・スクロールの対象になる', () => {
        const rows = buildItemRows([sItem('c'), gItem('g1', [sItem('a')])]);
        const views = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMark: { kind: 'bottom', id: 'g1' } });
        const highlight = resolveRowHighlight(views);
        assert.equal(highlight.markId, 'a');
        assert.deepEqual(highlight.indexes, [1]);
        const above = resolveRowViews({ rows, isSelected: selecting([]), selectedGroupIds: [], insertMark: { kind: 'above', id: 'g1' } });
        assert.equal(resolveRowHighlight(above).markId, 'g1');
        assert.deepEqual(resolveRowHighlight(above).indexes, [0]);
    });

    it('選ばれている行があれば、スクロールの対象はそちら', () => {
        const rows = buildItemRows([sItem('c'), gItem('g1', [sItem('a')])]);
        const views = resolveRowViews({ rows, isSelected: selecting(['c']), selectedGroupIds: [], insertMark: { kind: 'bottom', id: 'g1' } });
        assert.deepEqual(resolveRowHighlight(views).indexes, [2]);
    });
});

describe('表示・ロックの項目（buildItemRows・resolveRowViews）', () => {
    const noMark = { isSelected: selecting([]), selectedGroupIds: [], insertMark: null };
    const pick = (obj) => ({
        visible: obj.visible,
        locked: obj.locked,
        hiddenByAncestor: obj.hiddenByAncestor,
        lockedByAncestor: obj.lockedByAncestor,
        hidden: obj.hidden
    });
    const FLAGS = (visible, locked, hiddenByAncestor, lockedByAncestor, hidden) => ({
        visible, locked, hiddenByAncestor, lockedByAncestor, hidden
    });
    const byIdOf = (rows) => new Map(rows.map((row) => [row.id, row]));

    it('すべて表示・ロックなしなら、5つの項目は true/false/false/false/false', () => {
        const rows = buildItemRows([sItem('a'), gItem('g1', [sItem('b')])]);
        for (const row of rows) {
            assert.deepEqual(pick(row), FLAGS(true, false, false, false, false));
        }
    });

    it('自分の表示が切の図形は hidden で、上から受け継いでいない', () => {
        const rows = buildItemRows([sItem('a', { visible: false })]);
        assert.deepEqual(pick(rows[0]), FLAGS(false, false, false, false, true));
    });

    it('自分のロックが入の図形は locked で、hidden ではない', () => {
        const rows = buildItemRows([sItem('a', { locked: true })]);
        assert.deepEqual(pick(rows[0]), FLAGS(true, true, false, false, false));
    });

    it('フォルダの表示が切なら、中身は受け継いで hidden（自分の値は入のまま）', () => {
        const rows = buildItemRows([{ ...gItem('g1', [sItem('a')]), visible: false }]);
        const byId = byIdOf(rows);
        assert.deepEqual(pick(byId.get('g1')), FLAGS(false, false, false, false, true));
        assert.deepEqual(pick(byId.get('a')), FLAGS(true, false, true, false, true));
    });

    it('フォルダのロックが入なら、中身は lockedByAncestor（hidden ではない）', () => {
        const rows = buildItemRows([{ ...gItem('g1', [sItem('a')]), locked: true }]);
        const byId = byIdOf(rows);
        assert.deepEqual(pick(byId.get('g1')), FLAGS(true, true, false, false, false));
        assert.deepEqual(pick(byId.get('a')), FLAGS(true, false, false, true, false));
    });

    it('深い入れ子では、どの段の切・入も下まで受け継ぐ', () => {
        const inner = { ...gItem('g2', [sItem('a')]), locked: true };
        const outer = { ...gItem('g1', [inner]), visible: false };
        const byId = byIdOf(buildItemRows([outer]));
        assert.deepEqual(pick(byId.get('g2')), FLAGS(true, true, true, false, true));
        assert.deepEqual(pick(byId.get('a')), FLAGS(true, false, true, true, true));
    });

    it('折りたたんだ中の行は出ないが、折りたたんだフォルダ自身は値を持つ', () => {
        const folder = { ...gItem('g1', [sItem('a')], true), visible: false, locked: true };
        const rows = buildItemRows([folder]);
        assert.deepEqual(rows.map((row) => row.id), ['g1']);
        assert.deepEqual(pick(rows[0]), FLAGS(false, true, false, false, true));
    });

    it('空のフォルダも自分の値を持つ', () => {
        const rows = buildItemRows([{ ...gItem('g1', []), visible: false }]);
        assert.deepEqual(pick(rows[0]), FLAGS(false, false, false, false, true));
        assert.equal(rows[0].isEmpty, true);
    });

    it('値が無いアイテム・素の図形は、表示あり・ロックなし', () => {
        const rows = buildItemRows([
            { kind: 'shape', shape: { id: 'a' } },
            { kind: 'group', id: 'g1', children: [] }
        ]);
        for (const row of rows) {
            assert.deepEqual(pick(row), FLAGS(true, false, false, false, false));
        }
    });

    it('resolveRowViews は5つの項目をそのまま見た目へ渡す', () => {
        const inner = { ...gItem('g2', [sItem('a')]), locked: true };
        const outer = { ...gItem('g1', [inner]), visible: false };
        const rows = buildItemRows([outer, sItem('b', { locked: true })]);
        const views = resolveRowViews({ rows, ...noMark });
        assert.equal(views.length, rows.length);
        views.forEach((view, index) => {
            assert.deepEqual(pick(view), pick(rows[index]));
        });
    });

    it('ほかの見た目の項目は、表示・ロックの値で変わらない', () => {
        const plain = resolveRowViews({ rows: buildItemRows([sItem('a'), gItem('g1', [sItem('b')])]), ...noMark });
        const marked = resolveRowViews({
            rows: buildItemRows([sItem('a', { visible: false, locked: true }), { ...gItem('g1', [sItem('b')]), visible: false }]),
            ...noMark
        });
        const strip = (view) => ({ ...view, ...FLAGS(undefined, undefined, undefined, undefined, undefined) });
        assert.deepEqual(marked.map(strip), plain.map(strip));
    });
});
