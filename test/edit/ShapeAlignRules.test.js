/**
 * 責務: ShapeAlignRulesの公開API（ShapeAlignOperation・computeAlignMoves・canApplyAlign）を、素の外枠の数値で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ShapeAlignOperation,
    computeAlignMoves,
    canApplyAlign,
} from '../../js/edit/ShapeAlignRules.js';

const OPS = Object.values(ShapeAlignOperation);

/**
 * 整列・分布の対象1件を作る。
 * @param {string} id 図形のid
 * @param {number} minX 左端
 * @param {number} minY 上端
 * @param {number} maxX 右端
 * @param {number} maxY 下端
 * @returns {{id: string, bounds: {minX: number, minY: number, maxX: number, maxY: number}}}
 */
function item(id, minX, minY, maxX, maxY) {
    return { id, bounds: { minX, minY, maxX, maxY } };
}

/**
 * 大きさの違う3つの図形（A・B・C）を作る。全体の範囲は X: 0〜120、Y: 0〜60。
 * @returns {Array<ReturnType<typeof item>>}
 */
function sample() {
    return [
        item('A', 0, 0, 10, 10),
        item('B', 20, 5, 50, 25),
        item('C', 100, 40, 120, 60),
    ];
}

/**
 * 移動量の配列を`{id: [dx, dy]}`の形にする。
 * @param {Array<{id: string, dx: number, dy: number}>} moves 移動量
 * @returns {Record<string, number[]>}
 */
function toMap(moves) {
    const map = {};
    for (const m of moves) map[m.id] = [m.dx, m.dy];
    return map;
}

describe('ShapeAlignOperation', () => {
    it('8つの値が宣言順に定義され、凍結されている', () => {
        assert.deepEqual(OPS, [
            'alignLeft',
            'alignHorizontalCenter',
            'alignRight',
            'alignTop',
            'alignVerticalCenter',
            'alignBottom',
            'distributeHorizontal',
            'distributeVertical',
        ]);
        assert.ok(Object.isFrozen(ShapeAlignOperation));
    });
});

describe('ShapeAlignRules.computeAlignMoves: 整列の移動量', () => {
    it('左へ: 基準の端にある図形は含まれず、動かさない軸は0', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.ALIGN_LEFT);
        assert.deepEqual(toMap(moves), { B: [-20, 0], C: [-100, 0] });
    });

    it('左右中央へ', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.ALIGN_HORIZONTAL_CENTER);
        assert.deepEqual(toMap(moves), { A: [55, 0], B: [25, 0], C: [-50, 0] });
    });

    it('右へ', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.ALIGN_RIGHT);
        assert.deepEqual(toMap(moves), { A: [110, 0], B: [70, 0] });
    });

    it('上へ', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.ALIGN_TOP);
        assert.deepEqual(toMap(moves), { B: [0, -5], C: [0, -40] });
    });

    it('上下中央へ', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.ALIGN_VERTICAL_CENTER);
        assert.deepEqual(toMap(moves), { A: [0, 25], B: [0, 15], C: [0, -20] });
    });

    it('下へ', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.ALIGN_BOTTOM);
        assert.deepEqual(toMap(moves), { A: [0, 50], B: [0, 35] });
    });
});

describe('ShapeAlignRules.computeAlignMoves: 分布の移動量', () => {
    it('横方向: 両端は動かず、間の図形だけが動いてすき間が等しくなる', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.DISTRIBUTE_HORIZONTAL);
        assert.deepEqual(toMap(moves), { B: [20, 0] });
        // 移動後: A 0-10, B 40-70, C 100-120 → すき間は 30 と 30
        assert.equal(40 - 10, 100 - 70);
    });

    it('縦方向', () => {
        const moves = computeAlignMoves(sample(), ShapeAlignOperation.DISTRIBUTE_VERTICAL);
        assert.deepEqual(toMap(moves), { B: [0, 10] });
    });

    it('移動量を当てた後の隣どうしのすき間が等しい（元の順が入れ替わっていても）', () => {
        const items = [
            item('C', 100, 0, 120, 10),
            item('A', 0, 0, 13, 10),
            item('B', 17, 0, 30, 10),
            item('D', 40, 0, 47, 10),
        ];
        const moves = computeAlignMoves(items, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL);
        const moved = items.map((it) => {
            const m = moves.find((x) => x.id === it.id);
            const dx = m ? m.dx : 0;
            return { id: it.id, min: it.bounds.minX + dx, max: it.bounds.maxX + dx };
        });
        moved.sort((a, b) => a.min - b.min);
        const gaps = [];
        for (let i = 1; i < moved.length; i += 1) gaps.push(moved[i].min - moved[i - 1].max);
        assert.ok(Math.abs(gaps[0] - gaps[1]) < 1e-9);
        assert.ok(Math.abs(gaps[1] - gaps[2]) < 1e-9);
        // 両端（並べた先頭A・末尾C）は動かない
        assert.ok(!moves.some((m) => m.id === 'A' || m.id === 'C'));
    });

    it('すき間が負（重なり）でも負のまま均等になり、Errorにならない', () => {
        const items = [item('A', 0, 0, 20, 10), item('B', 5, 0, 25, 10), item('C', 20, 0, 40, 10)];
        const moves = computeAlignMoves(items, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL);
        assert.deepEqual(toMap(moves), { B: [5, 0] });
        // 移動後: A 0-20, B 10-30, C 20-40 → すき間は -10 と -10
    });

    it('minが同じ図形があるとき、元の順が保たれて並べられる', () => {
        const items = [item('B', 0, 0, 30, 10), item('A', 0, 0, 10, 10), item('C', 100, 0, 110, 10)];
        const moves = computeAlignMoves(items, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL);
        // 並べた順は B, A, C。すき間 30。Bは0、Aは60、Cは100に置く。
        assert.deepEqual(toMap(moves), { A: [60, 0] });
    });

    it('入れ子でmaxが最大の図形が並べた末尾でないとき、手順どおりに末尾の図形が動く', () => {
        const items = [item('A', 0, 0, 100, 10), item('B', 10, 0, 20, 10), item('C', 30, 0, 40, 10)];
        const moves = computeAlignMoves(items, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL);
        // すき間 (100 − 120) / 2 = −10。Aは0、Bは90、Cは90に置く。
        assert.deepEqual(toMap(moves), { B: [80, 0], C: [60, 0] });
    });
});

describe('ShapeAlignRules.computeAlignMoves: 何もしない場合', () => {
    it('整列は1件・0件で空配列、分布は2件・1件・0件で空配列', () => {
        const [a, b] = sample();
        for (const op of OPS.slice(0, 6)) {
            assert.deepEqual(computeAlignMoves([a], op), []);
            assert.deepEqual(computeAlignMoves([], op), []);
            assert.equal(canApplyAlign([a], op), false);
        }
        for (const op of OPS.slice(6)) {
            assert.deepEqual(computeAlignMoves([a, b], op), []);
            assert.deepEqual(computeAlignMoves([a], op), []);
            assert.deepEqual(computeAlignMoves([], op), []);
            assert.equal(canApplyAlign([a, b], op), false);
        }
    });

    it('2件の整列は動く', () => {
        const [a, b] = sample();
        assert.equal(canApplyAlign([a, b], ShapeAlignOperation.ALIGN_RIGHT), true);
    });

    it('すでにそろっているときは空配列（canApplyAlignは偽）', () => {
        const aligned = [item('A', 0, 0, 10, 10), item('B', 0, 20, 30, 30)];
        assert.deepEqual(computeAlignMoves(aligned, ShapeAlignOperation.ALIGN_LEFT), []);
        assert.equal(canApplyAlign(aligned, ShapeAlignOperation.ALIGN_LEFT), false);

        const even = [item('A', 0, 0, 10, 10), item('B', 20, 0, 30, 10), item('C', 40, 0, 50, 10)];
        assert.deepEqual(computeAlignMoves(even, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL), []);
        assert.equal(canApplyAlign(even, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL), false);
    });

    it('極小の誤差(1e-12)は0として扱われ、その図形は結果に含まれない', () => {
        const items = [item('A', 0, 0, 10, 10), item('B', 1e-12, 20, 30, 30)];
        assert.deepEqual(computeAlignMoves(items, ShapeAlignOperation.ALIGN_LEFT), []);
        assert.equal(canApplyAlign(items, ShapeAlignOperation.ALIGN_LEFT), false);

        const mixed = [item('A', 0, 0, 10, 10), item('B', 1e-12, 0, 30, 10), item('C', 5, 0, 20, 10)];
        const moves = computeAlignMoves(mixed, ShapeAlignOperation.ALIGN_LEFT);
        assert.deepEqual(moves.map((m) => m.id), ['C']);

        const nearEven = [item('A', 0, 0, 10, 10), item('B', 20 + 1e-12, 0, 30 + 1e-12, 10), item('C', 40, 0, 50, 10)];
        assert.equal(canApplyAlign(nearEven, ShapeAlignOperation.DISTRIBUTE_HORIZONTAL), false);
    });
});

describe('ShapeAlignRules: 未知の操作と引数の扱い', () => {
    it('未知の操作でErrorを投げる（itemsが空でも。computeAlignMoves・canApplyAlignとも）', () => {
        assert.throws(() => computeAlignMoves([], 'nope'), /未知の整列・分布の操作です: nope/);
        assert.throws(() => computeAlignMoves(sample(), 'nope'), /未知の整列・分布の操作です/);
        assert.throws(() => canApplyAlign([], 'nope'), /未知の整列・分布の操作です/);
        assert.throws(() => canApplyAlign(sample(), undefined), /未知の整列・分布の操作です: undefined/);
    });

    it('引数（配列の並び・要素・外枠）を書き換えない（分布の並べ替えが起きる場合を含む）', () => {
        const items = [
            item('C', 100, 0, 120, 10),
            item('A', 0, 0, 13, 10),
            item('B', 17, 0, 30, 10),
            item('D', 40, 0, 47, 10),
        ];
        const before = JSON.stringify(items);
        for (const op of OPS) {
            computeAlignMoves(items, op);
            canApplyAlign(items, op);
        }
        assert.equal(JSON.stringify(items), before);
    });

    it('結果は毎回新しい配列で、要素はitemsの要素と別のオブジェクト（itemsの元の順）', () => {
        const items = sample();
        const first = computeAlignMoves(items, ShapeAlignOperation.ALIGN_HORIZONTAL_CENTER);
        const second = computeAlignMoves(items, ShapeAlignOperation.ALIGN_HORIZONTAL_CENTER);
        assert.notEqual(first, second);
        assert.notEqual(first[0], second[0]);
        assert.deepEqual(first.map((m) => m.id), ['A', 'B', 'C']);
        for (const m of first) {
            assert.ok(!items.includes(m));
        }
    });
});
