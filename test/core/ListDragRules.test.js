/**
 * 責務：ListDragRules（一覧の行のドラッグの規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveDraggedIds,
    resolveDropIndex,
    resolveDropMark,
    reorderRowsForDrop,
    isSameOrder,
    toDrawOrder,
    resolveAutoScrollTop
} from '../../js/core/ListDragRules.js';

/**
 * 一覧の箱の寸法を作る（左100〜右300、上50、高さ200、行の高さ36）。
 * @param {Object} [extra] - 上書きする項目
 * @returns {Object} 寸法
 */
function makeArea(extra = {}) {
    return { left: 100, right: 300, top: 50, height: 200, scrollTop: 0, maxScrollTop: 0, rowHeight: 36, ...extra };
}

describe('ListDragRules.resolveDraggedIds', () => {
    const rowIds = ['a', 'b', 'c', 'd', 'e'];

    it('押した行が選ばれていれば、選ばれている行すべて（行の並びの順）', () => {
        assert.deepEqual(resolveDraggedIds({ rowIds, selectedIds: new Set(['d', 'b']), pressedId: 'd' }), ['b', 'd']);
    });

    it('押した行が選ばれていなければ、押した行だけ', () => {
        assert.deepEqual(resolveDraggedIds({ rowIds, selectedIds: new Set(['b', 'c']), pressedId: 'e' }), ['e']);
    });

    it('選択が空なら押した行だけ', () => {
        assert.deepEqual(resolveDraggedIds({ rowIds, selectedIds: new Set(), pressedId: 'a' }), ['a']);
    });

    it('配列の選択も受ける', () => {
        assert.deepEqual(resolveDraggedIds({ rowIds, selectedIds: ['c', 'a'], pressedId: 'a' }), ['a', 'c']);
    });
});

describe('ListDragRules.resolveDropIndex', () => {
    it('各行の上半分は行の上、下半分は行の下', () => {
        const area = makeArea();
        // y - top = 17 -> 0.47 -> 0, 19 -> 0.53 -> 1
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 17, area, rowCount: 5 }), 0);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 19, area, rowCount: 5 }), 1);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 36 + 17, area, rowCount: 5 }), 1);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 36 + 19, area, rowCount: 5 }), 2);
    });

    it('一番上は0、一番下の行の下はrowCount', () => {
        const area = makeArea();
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50, area, rowCount: 5 }), 0);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 5 * 36, area: makeArea({ height: 400 }), rowCount: 5 }), 5);
    });

    it('行の数を超える位置はrowCountに収める', () => {
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 240, area: makeArea(), rowCount: 2 }), 2);
    });

    it('上下へ外れたときは見えている端として扱う（スクロール中）', () => {
        const area = makeArea({ scrollTop: 72, maxScrollTop: 500 });
        // 上へ外れる -> y=top -> round(72/36)=2
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: -1000, area, rowCount: 20 }), 2);
        // 下へ外れる -> y=top+height -> round((200+72)/36)=round(7.56)=8
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 5000, area, rowCount: 20 }), 8);
    });

    it('スクロール位置を足して求める', () => {
        const area = makeArea({ scrollTop: 36, maxScrollTop: 500 });
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 10, area, rowCount: 20 }), 1);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 50 + 20, area, rowCount: 20 }), 2);
    });

    it('左右へ外れたらnull（端は内側）', () => {
        const area = makeArea();
        assert.equal(resolveDropIndex({ pointerX: 99, pointerY: 100, area, rowCount: 5 }), null);
        assert.equal(resolveDropIndex({ pointerX: 301, pointerY: 100, area, rowCount: 5 }), null);
        assert.notEqual(resolveDropIndex({ pointerX: 100, pointerY: 100, area, rowCount: 5 }), null);
        assert.notEqual(resolveDropIndex({ pointerX: 300, pointerY: 100, area, rowCount: 5 }), null);
    });

    it('行が0個・行の高さ0・箱の高さ0ならnull', () => {
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 100, area: makeArea(), rowCount: 0 }), null);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 100, area: makeArea({ rowHeight: 0 }), rowCount: 5 }), null);
        assert.equal(resolveDropIndex({ pointerX: 150, pointerY: 100, area: makeArea({ height: 0 }), rowCount: 5 }), null);
    });
});

describe('ListDragRules.resolveDropMark', () => {
    const rowIds = ['a', 'b', 'c'];

    it('rowIds.length未満ならその行のbefore', () => {
        assert.deepEqual(resolveDropMark(rowIds, 0), { id: 'a', edge: 'before' });
        assert.deepEqual(resolveDropMark(rowIds, 2), { id: 'c', edge: 'before' });
    });

    it('rowIds.lengthなら最後の行のafter', () => {
        assert.deepEqual(resolveDropMark(rowIds, 3), { id: 'c', edge: 'after' });
    });

    it('dropIndexがnull・行が無ければnull', () => {
        assert.equal(resolveDropMark(rowIds, null), null);
        assert.equal(resolveDropMark([], 0), null);
    });
});

describe('ListDragRules.reorderRowsForDrop', () => {
    const rowIds = ['a', 'b', 'c', 'd', 'e'];

    it('1行を下へ動かす', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['b'], dropIndex: 4 }), ['a', 'c', 'd', 'b', 'e']);
    });

    it('1行を上へ動かす', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['d'], dropIndex: 1 }), ['a', 'd', 'b', 'c', 'e']);
    });

    it('連続する複数行をひとかたまりで動かす', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['b', 'c'], dropIndex: 5 }), ['a', 'd', 'e', 'b', 'c']);
    });

    it('離れた複数行を、行の並びの順のままひとかたまりにする', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['b', 'd'], dropIndex: 0 }), ['b', 'd', 'a', 'c', 'e']);
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['b', 'd'], dropIndex: 3 }), ['a', 'c', 'b', 'd', 'e']);
    });

    it('同じ位置（行の直前・直後）では並びが変わらない', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['c'], dropIndex: 2 }), rowIds);
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['c'], dropIndex: 3 }), rowIds);
    });

    it('先頭・末尾へ動かす', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['e'], dropIndex: 0 }), ['e', 'a', 'b', 'c', 'd']);
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: ['a'], dropIndex: 5 }), ['b', 'c', 'd', 'e', 'a']);
    });

    it('全行を動かしても並びは変わらない', () => {
        assert.deepEqual(reorderRowsForDrop({ rowIds, draggedIds: [...rowIds], dropIndex: 2 }), rowIds);
    });

    it('引数を書き換えず新しい配列を返す', () => {
        const dragged = ['b'];
        const result = reorderRowsForDrop({ rowIds, draggedIds: dragged, dropIndex: 4 });
        assert.notEqual(result, rowIds);
        assert.deepEqual(rowIds, ['a', 'b', 'c', 'd', 'e']);
        assert.deepEqual(dragged, ['b']);
    });
});

describe('ListDragRules.toDrawOrder / isSameOrder', () => {
    it('toDrawOrderは逆順の新しい配列', () => {
        const rows = ['a', 'b', 'c'];
        const result = toDrawOrder(rows);
        assert.deepEqual(result, ['c', 'b', 'a']);
        assert.deepEqual(rows, ['a', 'b', 'c']);
        assert.deepEqual(toDrawOrder([]), []);
    });

    it('isSameOrderは長さと各位置が同じときだけ真', () => {
        assert.equal(isSameOrder(['a', 'b'], ['a', 'b']), true);
        assert.equal(isSameOrder(['a', 'b'], ['b', 'a']), false);
        assert.equal(isSameOrder(['a'], ['a', 'b']), false);
        assert.equal(isSameOrder([], []), true);
    });
});

describe('ListDragRules.resolveAutoScrollTop', () => {
    // 箱: 上50〜下250、帯24px -> 上の帯 y<74、下の帯 y>226
    const base = { scrollTop: 100, maxScrollTop: 1000 };

    it('帯の外ではnull', () => {
        const area = makeArea(base);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 150, area, elapsedMs: 16 }), null);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 74, area, elapsedMs: 16 }), null);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 226, area, elapsedMs: 16 }), null);
    });

    it('帯の入口は90px/秒、中ほどは深さに応じて速くなる', () => {
        const area = makeArea(base);
        // 上の帯の中ほど: depth 0.5 -> 495px/秒、経過20ms -> 9.9
        const mid = resolveAutoScrollTop({ pointerX: 150, pointerY: 62, area, elapsedMs: 20 });
        assert.ok(Math.abs(mid - (100 - 9.9)) < 1e-9);
        // 深さ0（帯の境目のすぐ内側）に近いほど遅い
        const shallow = resolveAutoScrollTop({ pointerX: 150, pointerY: 73.99, area, elapsedMs: 1000 / 1 });
        assert.ok(shallow < 100 && shallow > 100 - 90 * 0.05 - 1);
        // 下の帯: 下へ進む
        const down = resolveAutoScrollTop({ pointerX: 150, pointerY: 238, area, elapsedMs: 20 });
        assert.ok(Math.abs(down - (100 + 9.9)) < 1e-9);
    });

    it('上下へ外れたときは最大の速さ（900px/秒）', () => {
        const area = makeArea(base);
        assert.ok(Math.abs(resolveAutoScrollTop({ pointerX: 150, pointerY: -500, area, elapsedMs: 20 }) - (100 - 18)) < 1e-9);
        assert.ok(Math.abs(resolveAutoScrollTop({ pointerX: 150, pointerY: 9999, area, elapsedMs: 20 }) - (100 + 18)) < 1e-9);
        // 帯の端（箱の上端）でも最大
        assert.ok(Math.abs(resolveAutoScrollTop({ pointerX: 150, pointerY: 50, area, elapsedMs: 20 }) - (100 - 18)) < 1e-9);
    });

    it('左右へ外れているときはnull', () => {
        const area = makeArea(base);
        assert.equal(resolveAutoScrollTop({ pointerX: 99, pointerY: 55, area, elapsedMs: 16 }), null);
        assert.equal(resolveAutoScrollTop({ pointerX: 301, pointerY: 245, area, elapsedMs: 16 }), null);
    });

    it('端で止まる（0〜maxScrollTopに収め、同じ値ならnull）', () => {
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 55, area: makeArea({ scrollTop: 0, maxScrollTop: 1000 }), elapsedMs: 16 }), null);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 245, area: makeArea({ scrollTop: 1000, maxScrollTop: 1000 }), elapsedMs: 16 }), null);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 55, area: makeArea({ scrollTop: 5, maxScrollTop: 1000 }), elapsedMs: 50 }), 0);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 245, area: makeArea({ scrollTop: 995, maxScrollTop: 1000 }), elapsedMs: 50 }), 1000);
    });

    it('経過時間は50msまでとして量を求める', () => {
        const area = makeArea(base);
        const capped = resolveAutoScrollTop({ pointerX: 150, pointerY: 0, area, elapsedMs: 5000 });
        assert.ok(Math.abs(capped - (100 - 45)) < 1e-9);
        assert.equal(capped, resolveAutoScrollTop({ pointerX: 150, pointerY: 0, area, elapsedMs: 50 }));
    });

    it('スクロールできない（maxScrollTopが正でない）・寸法が正でないときはnull', () => {
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 55, area: makeArea({ scrollTop: 0, maxScrollTop: 0 }), elapsedMs: 16 }), null);
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 55, area: makeArea({ height: 0, maxScrollTop: 100, scrollTop: 50 }), elapsedMs: 16 }), null);
    });

    it('低い一覧では帯が高さの半分を超えない（中央が境目）', () => {
        // 高さ30 -> 帯15。上の帯 y<65、下の帯 y>65... 境目ちょうどは帯の外
        const area = makeArea({ top: 50, height: 30, scrollTop: 100, maxScrollTop: 1000 });
        assert.equal(resolveAutoScrollTop({ pointerX: 150, pointerY: 65, area, elapsedMs: 16 }), null);
        assert.ok(resolveAutoScrollTop({ pointerX: 150, pointerY: 60, area, elapsedMs: 16 }) < 100);
        assert.ok(resolveAutoScrollTop({ pointerX: 150, pointerY: 70, area, elapsedMs: 16 }) > 100);
    });
});
