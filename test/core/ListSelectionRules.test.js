/**
 * 責務：ListSelectionRules（一覧のクリック・Ctrl・Shiftでの次の選択と起点）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveListClickSelection } from '../../js/core/ListSelectionRules.js';

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
