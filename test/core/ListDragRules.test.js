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
    resolveAutoScrollTop,
    resolveDraggedUnitIds,
    resolveDraggedRowIds,
    resolveDropPlace,
    resolvePlaceMark,
    isSameRows
} from '../../js/core/ListDragRules.js';
import { buildItemRows } from '../../js/core/ItemRowRules.js';
import { moveItems } from '../../js/core/ItemPlaceRules.js';

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

/** 行の材料（ItemRow の必要な項目だけ）を作る。 */
function row(id, kind = 'shape', extra = {}) {
    return { id, kind, depth: 0, ancestorIds: [], collapsed: false, isEmpty: false, ...extra };
}
const sh = (id) => ({ kind: 'shape', shape: { id } });
const gr = (id, children = [], extra = {}) => ({ kind: 'group', id, children, ...extra });

describe('ListDragRules.resolveDraggedUnitIds', () => {
    it('押した行が選んでいるまとまりにあれば、まとまりの写し（前順）', () => {
        const unitIds = ['a', 'G', 'c'];
        const result = resolveDraggedUnitIds({ unitIds, pressedId: 'G' });
        assert.deepEqual(result, ['a', 'G', 'c']);
        assert.notEqual(result, unitIds);
    });
    it('折りたたまれて行の無いものも含む', () => {
        assert.deepEqual(resolveDraggedUnitIds({ unitIds: ['x', 'hidden'], pressedId: 'x' }), ['x', 'hidden']);
    });
    it('押した行がまとまりに無ければ、押した行だけ', () => {
        assert.deepEqual(resolveDraggedUnitIds({ unitIds: ['a', 'b'], pressedId: 'z' }), ['z']);
    });
    it('選んでいるフォルダの中の行を押すと、その行だけ', () => {
        assert.deepEqual(resolveDraggedUnitIds({ unitIds: ['G'], pressedId: 'inner' }), ['inner']);
    });
    it('まとまりが空なら押した行だけ', () => {
        assert.deepEqual(resolveDraggedUnitIds({ unitIds: [], pressedId: 'a' }), ['a']);
    });
});

describe('ListDragRules.resolveDraggedRowIds', () => {
    const rows = [
        row('a'),
        row('G', 'group'),
        row('g1', 'shape', { depth: 1, ancestorIds: ['G'] }),
        row('H', 'group', { depth: 1, ancestorIds: ['G'] }),
        row('h1', 'shape', { depth: 2, ancestorIds: ['G', 'H'] }),
        row('b')
    ];
    it('動かすものの行と、動かすフォルダの中の行（入れ子の中も）', () => {
        assert.deepEqual(resolveDraggedRowIds({ rows, draggedIds: ['G', 'b'] }), ['G', 'g1', 'H', 'h1', 'b']);
    });
    it('図形だけならその行だけ', () => {
        assert.deepEqual(resolveDraggedRowIds({ rows, draggedIds: new Set(['a']) }), ['a']);
    });
    it('内側のフォルダだけなら、その中の行まで', () => {
        assert.deepEqual(resolveDraggedRowIds({ rows, draggedIds: ['H'] }), ['H', 'h1']);
    });
    it('行に無いid（折りたたまれた中など）は無視する', () => {
        assert.deepEqual(resolveDraggedRowIds({ rows, draggedIds: ['hidden'] }), []);
    });
});

describe('ListDragRules.resolveDropPlace', () => {
    // 行の高さ36・上端50。行iは y が 50+36i 〜 86+36i。
    const shapeRows = [row('a'), row('b'), row('c')];
    const place = (pointerY, rows, extra = {}) => resolveDropPlace({ pointerX: 150, pointerY, area: makeArea(extra), rows });

    it('図形の行の上半分は above、下半分は below', () => {
        assert.deepEqual(place(50 + 36 + 1, shapeRows), { kind: 'above', id: 'b' });
        assert.deepEqual(place(50 + 36 + 17, shapeRows), { kind: 'above', id: 'b' });
        assert.deepEqual(place(50 + 36 + 19, shapeRows), { kind: 'below', id: 'b' });
        assert.deepEqual(place(50 + 36 + 35, shapeRows), { kind: 'below', id: 'b' });
    });
    it('図形の行の境目（0.5）は下側', () => {
        assert.deepEqual(place(50 + 18, shapeRows), { kind: 'below', id: 'a' });
    });
    it('フォルダの行（開いていて中身がある）：上の4分の1は above、真ん中は inside、下の4分の1も inside', () => {
        const rows = [row('G', 'group'), row('g1', 'shape', { depth: 1, ancestorIds: ['G'] })];
        assert.deepEqual(place(50 + 8, rows), { kind: 'above', id: 'G' });
        assert.deepEqual(place(50 + 18, rows), { kind: 'inside', id: 'G' });
        assert.deepEqual(place(50 + 28, rows), { kind: 'inside', id: 'G' });
        assert.deepEqual(place(50 + 35, rows), { kind: 'inside', id: 'G' });
    });
    it('フォルダの行（折りたたみ）：下の4分の1は below', () => {
        const rows = [row('G', 'group', { collapsed: true })];
        assert.deepEqual(place(50 + 8, rows), { kind: 'above', id: 'G' });
        assert.deepEqual(place(50 + 18, rows), { kind: 'inside', id: 'G' });
        assert.deepEqual(place(50 + 28, rows), { kind: 'below', id: 'G' });
    });
    it('フォルダの行（空）：下の4分の1は below', () => {
        const rows = [row('G', 'group', { isEmpty: true })];
        assert.deepEqual(place(50 + 28, rows), { kind: 'below', id: 'G' });
    });
    it('フォルダの行の境（0.25・0.75）', () => {
        const rows = [row('G', 'group', { collapsed: true })];
        assert.deepEqual(place(50 + 9, rows), { kind: 'inside', id: 'G' });
        assert.deepEqual(place(50 + 27, rows), { kind: 'below', id: 'G' });
        assert.deepEqual(place(50 + 8.9, rows), { kind: 'above', id: 'G' });
        assert.deepEqual(place(50 + 26.9, rows), { kind: 'inside', id: 'G' });
    });
    it('深い入れ子の行でも、その行の above / below', () => {
        const rows = [row('deep', 'shape', { depth: 3, ancestorIds: ['x', 'y', 'z'] })];
        assert.deepEqual(place(50 + 4, rows), { kind: 'above', id: 'deep' });
        assert.deepEqual(place(50 + 30, rows), { kind: 'below', id: 'deep' });
    });
    it('一番上の行より上へ外れると、その行の above', () => {
        assert.deepEqual(place(0, shapeRows), { kind: 'above', id: 'a' });
        assert.deepEqual(place(50, shapeRows), { kind: 'above', id: 'a' });
    });
    it('最後の行より下の空いている所は、いちばん外側の一番下', () => {
        assert.deepEqual(place(50 + 3 * 36, shapeRows), { kind: 'bottom', id: null });
        assert.deepEqual(place(50 + 150, shapeRows), { kind: 'bottom', id: null });
    });
    it('最後の行の下半分は below（空いている所の手前）', () => {
        assert.deepEqual(place(50 + 3 * 36 - 1, shapeRows), { kind: 'below', id: 'c' });
    });
    it('左右へ外れると null（端は内側）', () => {
        const at = (pointerX) => resolveDropPlace({ pointerX, pointerY: 60, area: makeArea(), rows: shapeRows });
        assert.equal(at(99), null);
        assert.equal(at(301), null);
        assert.deepEqual(at(100), { kind: 'above', id: 'a' });
        assert.deepEqual(at(300), { kind: 'above', id: 'a' });
    });
    it('行が0個・寸法が正でないときは null', () => {
        assert.equal(place(60, []), null);
        assert.equal(place(60, shapeRows, { rowHeight: 0 }), null);
        assert.equal(place(60, shapeRows, { height: 0 }), null);
    });
    it('スクロール中は、スクロール量を足した行を指す', () => {
        const rows = Array.from({ length: 10 }, (_, i) => row('r' + i));
        const result = place(50 + 10, rows, { scrollTop: 72, maxScrollTop: 160 });
        assert.deepEqual(result, { kind: 'above', id: 'r2' });
    });

    describe('一番下まで送ったとき（小数のスクロール位置）', () => {
        const rows = [];
        for (let i = 0; i < 18; i++) {
            rows.push(row('r' + i));
        }
        rows.push(row('F', 'group'));
        rows.push(row('z', 'shape', { depth: 1, ancestorIds: ['F'] }));
        const bottomY = 50 + 498;
        const at = (pointerY, scrollTop) => place(pointerY, rows, { height: 498, scrollTop, maxScrollTop: 222 });

        it('scrollTop 221.6：下端ちょうどでもずっと下でも、いちばん外側の一番下', () => {
            assert.deepEqual(at(bottomY, 221.6), { kind: 'bottom', id: null });
            assert.deepEqual(at(bottomY + 500, 221.6), { kind: 'bottom', id: null });
        });
        it('scrollTop 221.6：下端より少し上は、最後の行の below', () => {
            assert.deepEqual(at(bottomY - 8, 221.6), { kind: 'below', id: 'z' });
        });
        it('scrollTop 221（余裕の境）は一番下、220.9 は最後の行の below', () => {
            assert.deepEqual(at(bottomY, 221), { kind: 'bottom', id: null });
            assert.deepEqual(at(bottomY, 220.9), { kind: 'below', id: 'z' });
        });
        it('途中までしか送っていないときに下へ外れたら、見えている端の行の場所', () => {
            assert.deepEqual(at(bottomY + 300, 100), { kind: 'below', id: 'r16' });
        });
    });

    describe('フォルダの無い並びでは、ItemPlaceRules.moveItems の結果が「上の動かさない行＋動かす行＋残り」と一致する', () => {
        const items = ['a', 'b', 'c', 'd', 'e'].map(sh); // 行は e d c b a の順
        const rows = buildItemRows(items);
        const rowIds = rows.map((r) => r.id);
        const area = makeArea({ height: 400 });
        const draggedSets = [['c'], ['b', 'd'], ['e', 'a'], ['a', 'b', 'c', 'd', 'e']];
        const pointers = [];
        rowIds.forEach((id, i) => {
            pointers.push({ y: 50 + 36 * i + 5, dropIndex: i });
            pointers.push({ y: 50 + 36 * i + 31, dropIndex: i + 1 });
        });
        pointers.push({ y: 50 + 36 * 5 + 10, dropIndex: rowIds.length });
        for (const draggedIds of draggedSets) {
            it('動かすもの ' + draggedIds.join(','), () => {
                for (const { y, dropIndex } of pointers) {
                    const resultPlace = resolveDropPlace({ pointerX: 150, pointerY: y, area, rows });
                    const next = moveItems(items, new Set(draggedIds), resultPlace);
                    const dragged = new Set(draggedIds);
                    const expected = [
                        ...rowIds.slice(0, dropIndex).filter((id) => !dragged.has(id)),
                        ...rowIds.filter((id) => dragged.has(id)),
                        ...rowIds.slice(dropIndex).filter((id) => !dragged.has(id))
                    ];
                    assert.deepEqual(buildItemRows(next).map((r) => r.id), expected, 'y=' + y);
                }
            });
        }
    });
});

describe('ListDragRules.resolvePlaceMark', () => {
    const rows = [
        row('G', 'group'),
        row('g1', 'shape', { depth: 1, ancestorIds: ['G'] }),
        row('deep', 'shape', { depth: 8, ancestorIds: [] }),
        row('last')
    ];
    it('above は、その行の before と字下げ', () => {
        assert.deepEqual(resolvePlaceMark({ rows, place: { kind: 'above', id: 'g1' } }), { id: 'g1', edge: 'before', indent: 12 });
    });
    it('below は、その行の after と字下げ', () => {
        assert.deepEqual(resolvePlaceMark({ rows, place: { kind: 'below', id: 'g1' } }), { id: 'g1', edge: 'after', indent: 12 });
    });
    it('inside は、その行の inside・字下げ0', () => {
        assert.deepEqual(resolvePlaceMark({ rows, place: { kind: 'inside', id: 'G' } }), { id: 'G', edge: 'inside', indent: 0 });
    });
    it('字下げは6段で頭打ち', () => {
        assert.deepEqual(resolvePlaceMark({ rows, place: { kind: 'above', id: 'deep' } }), { id: 'deep', edge: 'before', indent: 72 });
    });
    it('{ bottom, null } は最後の行の after・字下げ0', () => {
        assert.deepEqual(resolvePlaceMark({ rows, place: { kind: 'bottom', id: null } }), { id: 'last', edge: 'after', indent: 0 });
    });
    it('null・行が無い・行が見えていない・{ bottom, フォルダ } は null', () => {
        assert.equal(resolvePlaceMark({ rows, place: null }), null);
        assert.equal(resolvePlaceMark({ rows: [], place: { kind: 'above', id: 'a' } }), null);
        assert.equal(resolvePlaceMark({ rows, place: { kind: 'above', id: 'nothing' } }), null);
        assert.equal(resolvePlaceMark({ rows, place: { kind: 'bottom', id: 'G' } }), null);
    });
});

describe('ListDragRules.isSameRows', () => {
    const a = [row('a'), row('G', 'group', { collapsed: true })];
    it('長さと各位置の id・depth・collapsed・isEmpty が同じなら true', () => {
        assert.equal(isSameRows(a, [row('a'), row('G', 'group', { collapsed: true })]), true);
        assert.equal(isSameRows([], []), true);
    });
    it('長さが違えば false', () => {
        assert.equal(isSameRows(a, [row('a')]), false);
    });
    it('id が違えば false', () => {
        assert.equal(isSameRows(a, [row('a'), row('H', 'group', { collapsed: true })]), false);
    });
    it('depth・collapsed・isEmpty が違えば false', () => {
        assert.equal(isSameRows(a, [row('a', 'shape', { depth: 1 }), a[1]]), false);
        assert.equal(isSameRows(a, [a[0], row('G', 'group', { collapsed: false })]), false);
        assert.equal(isSameRows(a, [a[0], row('G', 'group', { collapsed: true, isEmpty: true })]), false);
    });
    it('入れ子が変わった実物の行（並びのid は同じ）を見分ける', () => {
        const before = buildItemRows([sh('x'), gr('G', [sh('y')])]);
        const after = buildItemRows([sh('x'), gr('G', [sh('y')], { collapsed: true })]);
        assert.equal(isSameRows(before, after), false);
        assert.equal(isSameRows(before, buildItemRows([sh('x'), gr('G', [sh('y')])])), true);
    });
});
