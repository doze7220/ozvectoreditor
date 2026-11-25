/**
 * 責務：ListSelectionRules（一覧のクリック・Ctrl・Shiftでの次の選択と起点）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveListClickSelection, resolveRowClickSelection } from '../../js/core/ListSelectionRules.js';

const ROWS = ['a', 'b', 'c', 'd', 'e'];

/**
 * 既定値つきで呼ぶ。
 * @param {Object} overrides - 上書きする引数
 * @returns {{ids: string[], anchorId: string|null}} 結果
 */
function run(overrides) {
    return resolveListClickSelection({
        rowIds: ROWS,
        selectedIds: [],
        hitId: 'c',
        additive: false,
        range: false,
        anchorId: null,
        ...overrides
    });
}

describe('resolveListClickSelection: ふつうのクリック', () => {
    it('押した行だけを選び、起点にする', () => {
        assert.deepEqual(run({ selectedIds: ['a', 'b'], hitId: 'd', anchorId: 'a' }), { ids: ['d'], anchorId: 'd' });
    });
    it('選択済みの行を押しても、その行だけになる', () => {
        assert.deepEqual(run({ selectedIds: ['a', 'c'], hitId: 'c' }), { ids: ['c'], anchorId: 'c' });
    });
});

describe('resolveListClickSelection: Ctrl', () => {
    it('未選択の行は末尾へ足し、起点にする', () => {
        assert.deepEqual(run({ additive: true, selectedIds: ['a'], hitId: 'd', anchorId: 'a' }), { ids: ['a', 'd'], anchorId: 'd' });
    });
    it('選択済みの行は外し、起点はその行になる', () => {
        assert.deepEqual(run({ additive: true, selectedIds: ['a', 'd'], hitId: 'd', anchorId: 'a' }), { ids: ['a'], anchorId: 'd' });
    });
});

describe('resolveListClickSelection: Shift', () => {
    it('起点から下へ、連続した行を選ぶ。起点は変わらない', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['b'], anchorId: 'b', hitId: 'd' }), { ids: ['b', 'c', 'd'], anchorId: 'b' });
    });
    it('起点から上へ（逆向き）も選べる', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['d'], anchorId: 'd', hitId: 'b' }), { ids: ['b', 'c', 'd'], anchorId: 'd' });
    });
    it('起点と同じ行を押すと、その行だけ', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['c'], anchorId: 'c', hitId: 'c' }), { ids: ['c'], anchorId: 'c' });
    });
    it('起点が無いとき、最初の選ばれている行（上から）を起点にする。渡された起点（null）は変わらない', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['d', 'b'], anchorId: null, hitId: 'e' }), { ids: ['b', 'c', 'd', 'e'], anchorId: null });
    });
    it('起点の行が無くなったとき、最初の選ばれている行を起点にする', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['b'], anchorId: 'zzz', hitId: 'd' }), { ids: ['b', 'c', 'd'], anchorId: 'zzz' });
    });
    it('起点が選ばれていないとき、最初の選ばれている行を起点にする', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['d'], anchorId: 'a', hitId: 'e' }), { ids: ['d', 'e'], anchorId: 'a' });
    });
    it('何も選ばれていなければ、押した行だけ', () => {
        assert.deepEqual(run({ range: true, selectedIds: [], anchorId: null, hitId: 'c' }), { ids: ['c'], anchorId: null });
    });
    it('それまでの選択は置き換わる', () => {
        assert.deepEqual(run({ range: true, selectedIds: ['a', 'e'], anchorId: 'a', hitId: 'b' }), { ids: ['a', 'b'], anchorId: 'a' });
    });
    it('Ctrl+Shiftは、Shiftと同じ', () => {
        const base = { selectedIds: ['b'], anchorId: 'b', hitId: 'd' };
        assert.deepEqual(run({ ...base, range: true, additive: true }), run({ ...base, range: true }));
    });
    it('Ctrlで外した後のShiftは、いちばん上の選ばれている行を起点にする', () => {
        const afterCtrl = run({ additive: true, selectedIds: ['b', 'd'], hitId: 'd', anchorId: 'b' });
        assert.deepEqual(afterCtrl, { ids: ['b'], anchorId: 'd' });
        assert.deepEqual(run({ range: true, selectedIds: afterCtrl.ids, anchorId: afterCtrl.anchorId, hitId: 'e' }), { ids: ['b', 'c', 'd', 'e'], anchorId: 'd' });
    });
});

describe('resolveListClickSelection: 防御・不変', () => {
    it('押した行が行に無いときは、選択の写しと渡された起点を返す', () => {
        const selectedIds = ['a'];
        const result = run({ selectedIds, hitId: 'zzz', anchorId: 'a' });
        assert.deepEqual(result, { ids: ['a'], anchorId: 'a' });
        assert.notEqual(result.ids, selectedIds);
    });
    it('引数を書き換えない', () => {
        const rowIds = [...ROWS];
        const selectedIds = ['b', 'd'];
        run({ rowIds, selectedIds, range: true, anchorId: 'b', hitId: 'e' });
        run({ rowIds, selectedIds, additive: true, hitId: 'd' });
        run({ rowIds, selectedIds, hitId: 'a' });
        assert.deepEqual(rowIds, ROWS);
        assert.deepEqual(selectedIds, ['b', 'd']);
    });
});

describe('resolveRowClickSelection', () => {
    /**
     * 行を作る。
     * @param {string} id - 行のid
     * @param {Object} [extra] - 上書きする値
     * @returns {Object} 行
     */
    function row(id, extra = {}) {
        return { id, kind: 'shape', ancestorIds: [], shapeIds: [id], groupIds: [], ...extra };
    }

    // 並び：c, g1(開) { b, a }, g2(空)
    const rows = [
        row('c'),
        row('g1', { kind: 'group', shapeIds: ['b', 'a'], groupIds: [] }),
        row('b', { ancestorIds: ['g1'] }),
        row('a', { ancestorIds: ['g1'] }),
        row('g2', { kind: 'group', shapeIds: [], groupIds: [] })
    ];
    const base = { rows, selectedIds: [], selectedGroupIds: [], additive: false, range: false, anchorId: null };

    it('ふつう：図形の行は自分だけ、フォルダの行は中の図形とフォルダ', () => {
        assert.deepEqual(resolveRowClickSelection({ ...base, hitId: 'c' }), { ids: ['c'], groupIds: [], anchorId: 'c' });
        assert.deepEqual(resolveRowClickSelection({ ...base, hitId: 'g1' }), { ids: ['b', 'a'], groupIds: ['g1'], anchorId: 'g1' });
        assert.deepEqual(resolveRowClickSelection({ ...base, hitId: 'g2' }), { ids: [], groupIds: ['g2'], anchorId: 'g2' });
    });

    it('Ctrlで足す：今の選択に押した行の図形とフォルダが加わる', () => {
        const result = resolveRowClickSelection({ ...base, selectedIds: ['c'], additive: true, hitId: 'g1' });
        assert.deepEqual(result.ids, ['c', 'b', 'a']);
        assert.deepEqual(result.groupIds, ['g1']);
        assert.equal(result.anchorId, 'g1');
    });

    it('Ctrlで足す：空のフォルダはフォルダの選択だけ増える', () => {
        const result = resolveRowClickSelection({ ...base, selectedIds: ['c'], additive: true, hitId: 'g2' });
        assert.deepEqual(result.ids, ['c']);
        assert.deepEqual(result.groupIds, ['g2']);
    });

    it('Ctrlで外す：選んでいるフォルダの中の図形を外すと、その図形だけ外れフォルダの選択も外れる', () => {
        const result = resolveRowClickSelection({
            ...base, selectedIds: ['b', 'a', 'c'], selectedGroupIds: ['g1'], additive: true, hitId: 'b'
        });
        assert.deepEqual(result.ids, ['a', 'c']);
        assert.deepEqual(result.groupIds, []);
        assert.equal(result.anchorId, 'b');
    });

    it('Ctrlで外す：選んでいるフォルダ自身を外すと中の図形も外れ、ほかの図形は残る', () => {
        const result = resolveRowClickSelection({
            ...base, selectedIds: ['b', 'a', 'c'], selectedGroupIds: ['g1'], additive: true, hitId: 'g1'
        });
        assert.deepEqual(result.ids, ['c']);
        assert.deepEqual(result.groupIds, []);
    });

    it('Ctrlで外す：選んでいる空のフォルダを外す', () => {
        const result = resolveRowClickSelection({
            ...base, selectedGroupIds: ['g2', 'g1'], selectedIds: ['b', 'a'], additive: true, hitId: 'g2'
        });
        assert.deepEqual(result.ids, ['b', 'a']);
        assert.deepEqual(result.groupIds, ['g1']);
    });

    it('Ctrlで外す：中のフォルダを外すと、上のフォルダも外れる', () => {
        const nested = [
            row('g1', { kind: 'group', shapeIds: ['a'], groupIds: ['g2'] }),
            row('g2', { kind: 'group', ancestorIds: ['g1'], shapeIds: ['a'], groupIds: [] }),
            row('a', { ancestorIds: ['g1', 'g2'] })
        ];
        const result = resolveRowClickSelection({
            ...base, rows: nested, selectedIds: ['a'], selectedGroupIds: ['g1'], additive: true, hitId: 'g2'
        });
        assert.deepEqual(result.ids, []);
        assert.deepEqual(result.groupIds, []);
    });

    it('Shiftの範囲：起点から押した行までの行の図形とフォルダ', () => {
        const result = resolveRowClickSelection({ ...base, selectedIds: ['c'], range: true, anchorId: 'c', hitId: 'b' });
        assert.deepEqual([...result.ids].sort(), ['a', 'b', 'c']);
        assert.deepEqual(result.groupIds, ['g1']);
        assert.equal(result.anchorId, 'c');
    });

    it('Shiftの範囲：起点がフォルダの行でもよい', () => {
        const result = resolveRowClickSelection({
            ...base, selectedIds: ['b', 'a'], selectedGroupIds: ['g1'], range: true, anchorId: 'g1', hitId: 'g2'
        });
        assert.deepEqual([...result.ids].sort(), ['a', 'b']);
        assert.deepEqual(result.groupIds, ['g1', 'g2']);
    });

    it('Shiftの範囲：閉じたフォルダの行は中の図形をすべて含む', () => {
        const closedRows = [
            row('c'),
            row('g1', { kind: 'group', shapeIds: ['b', 'a'], collapsed: true }),
            row('d')
        ];
        const result = resolveRowClickSelection({
            ...base, rows: closedRows, selectedIds: ['c'], range: true, anchorId: 'c', hitId: 'd'
        });
        assert.deepEqual(result.ids, ['c', 'b', 'a', 'd']);
        assert.deepEqual(result.groupIds, ['g1']);
    });

    it('折りたたまれて行の無い選択は、Ctrlで足す・外すで残る', () => {
        const added = resolveRowClickSelection({ ...base, selectedIds: ['hidden'], additive: true, hitId: 'c' });
        assert.deepEqual(added.ids, ['hidden', 'c']);
        const removed = resolveRowClickSelection({ ...base, selectedIds: ['hidden', 'c'], additive: true, hitId: 'c' });
        assert.deepEqual(removed.ids, ['hidden']);
    });

    it('行が無いidは、今の選択と起点をそのまま返す', () => {
        const result = resolveRowClickSelection({
            ...base, selectedIds: ['c'], selectedGroupIds: ['g2'], anchorId: 'c', hitId: 'zzz'
        });
        assert.deepEqual(result, { ids: ['c'], groupIds: ['g2'], anchorId: 'c' });
    });

    it('引数を書き換えない', () => {
        const selectedIds = ['b', 'a'];
        const selectedGroupIds = ['g1'];
        const snapshot = JSON.stringify(rows);
        resolveRowClickSelection({ ...base, selectedIds, selectedGroupIds, additive: true, hitId: 'b' });
        assert.deepEqual(selectedIds, ['b', 'a']);
        assert.deepEqual(selectedGroupIds, ['g1']);
        assert.equal(JSON.stringify(rows), snapshot);
    });
});
