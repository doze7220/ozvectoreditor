/**
 * 責務：UnitSnapRules（座標・移動量を刻みの倍数へ丸める規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    resolveUnitSnapStep,
    roundPointToUnit,
    roundDeltaToUnit,
    roundConstrainedDeltaToUnit,
    roundPointFromOriginToUnit
} from '../../js/core/UnitSnapRules.js';

describe('roundPointToUnit：丸める', () => {
    it('刻み1：正・負・0・小数', () => {
        assert.deepEqual(roundPointToUnit({ x: 3.4, y: 3.6 }, 1), { x: 3, y: 4 });
        assert.deepEqual(roundPointToUnit({ x: -3.4, y: -3.6 }, 1), { x: -3, y: -4 });
        assert.deepEqual(roundPointToUnit({ x: 0, y: 0 }, 1), { x: 0, y: 0 });
    });

    it('刻み10：正・負', () => {
        assert.deepEqual(roundPointToUnit({ x: 14, y: 16 }, 10), { x: 10, y: 20 });
        assert.deepEqual(roundPointToUnit({ x: -14, y: -16 }, 10), { x: -10, y: -20 });
    });

    it('ちょうど中間の値は0から遠い側へ丸める', () => {
        assert.deepEqual(roundPointToUnit({ x: 2.5, y: -2.5 }, 1), { x: 3, y: -3 });
        assert.deepEqual(roundPointToUnit({ x: 15, y: -15 }, 10), { x: 20, y: -20 });
        assert.deepEqual(roundPointToUnit({ x: 5, y: -5 }, 10), { x: 10, y: -10 });
    });

    it('すでに倍数の値は変わらない', () => {
        assert.deepEqual(roundPointToUnit({ x: 30, y: -40 }, 10), { x: 30, y: -40 });
        assert.deepEqual(roundPointToUnit({ x: 7, y: -8 }, 1), { x: 7, y: -8 });
    });

    it('結果に-0を含めない', () => {
        const r = roundPointToUnit({ x: -0.4, y: -4 }, 10);
        assert.ok(!Object.is(r.x, -0));
        assert.ok(!Object.is(r.y, -0));
        assert.ok(!Object.is(roundPointToUnit({ x: -0.4, y: 0 }, 1).x, -0));
    });

    it('引数を書き換えず新しいオブジェクトを返す', () => {
        const p = { x: 2.5, y: 1.2 };
        const r = roundPointToUnit(p, 1);
        assert.deepEqual(p, { x: 2.5, y: 1.2 });
        assert.notEqual(r, p);
    });

    it('同じ入力に同じ結果', () => {
        assert.deepEqual(roundPointToUnit({ x: 2.5, y: 7.7 }, 1), roundPointToUnit({ x: 2.5, y: 7.7 }, 1));
    });
});

describe('roundPointToUnit：丸めない刻み', () => {
    for (const step of [null, 0, -1, NaN, '10', undefined, Infinity]) {
        it(`刻み ${String(step)} は入力と同じ値（-0もそのまま）`, () => {
            const p = { x: 2.5, y: -0 };
            const r = roundPointToUnit(p, step);
            assert.ok(Object.is(r.x, 2.5));
            assert.ok(Object.is(r.y, -0));
            assert.notEqual(r, p);
        });
    }
});

describe('roundDeltaToUnit', () => {
    it('刻み1・10で軸ごとに丸める', () => {
        assert.deepEqual(roundDeltaToUnit({ dx: 3.4, dy: -3.6 }, 1), { dx: 3, dy: -4 });
        assert.deepEqual(roundDeltaToUnit({ dx: 14, dy: -16 }, 10), { dx: 10, dy: -20 });
        assert.deepEqual(roundDeltaToUnit({ dx: 0, dy: 0 }, 10), { dx: 0, dy: 0 });
    });

    it('ちょうど中間の値は0から遠い側', () => {
        assert.deepEqual(roundDeltaToUnit({ dx: 2.5, dy: -2.5 }, 1), { dx: 3, dy: -3 });
        assert.deepEqual(roundDeltaToUnit({ dx: 15, dy: -15 }, 10), { dx: 20, dy: -20 });
    });

    it('すでに倍数の値は変わらない', () => {
        assert.deepEqual(roundDeltaToUnit({ dx: 20, dy: -30 }, 10), { dx: 20, dy: -30 });
    });

    it('結果に-0を含めない', () => {
        const r = roundDeltaToUnit({ dx: -0.3, dy: -0.2 }, 1);
        assert.ok(!Object.is(r.dx, -0));
        assert.ok(!Object.is(r.dy, -0));
    });

    it('丸めない刻みでは入力と同じ値・新しいオブジェクト', () => {
        const d = { dx: 2.5, dy: -0 };
        for (const step of [null, 0, -5, NaN, 'x']) {
            const r = roundDeltaToUnit(d, step);
            assert.ok(Object.is(r.dx, 2.5));
            assert.ok(Object.is(r.dy, -0));
            assert.notEqual(r, d);
        }
    });

    it('引数を書き換えない', () => {
        const d = { dx: 2.5, dy: 1.2 };
        roundDeltaToUnit(d, 1);
        assert.deepEqual(d, { dx: 2.5, dy: 1.2 });
    });
});

describe('roundConstrainedDeltaToUnit', () => {
    it('横：dy === 0 のまま dx だけ丸める', () => {
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: 13.4, dy: 0 }, 10), { dx: 10, dy: 0 });
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: -2.5, dy: 0 }, 1), { dx: -3, dy: 0 });
    });

    it('縦：dx === 0 のまま dy だけ丸める', () => {
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: 0, dy: 16 }, 10), { dx: 0, dy: 20 });
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: 0, dy: -2.5 }, 1), { dx: 0, dy: -3 });
    });

    it('斜め4向き：|dx| === |dy| が厳密に成り立ち刻みの倍数', () => {
        const cases = [
            { dx: 12.3, dy: 12.3 },
            { dx: -12.3, dy: 12.3 },
            { dx: 12.3, dy: -12.3 },
            { dx: -12.3, dy: -12.3 }
        ];
        for (const c of cases) {
            for (const step of [1, 10]) {
                const r = roundConstrainedDeltaToUnit(c, step);
                assert.equal(Math.abs(r.dx), Math.abs(r.dy));
                assert.equal(Math.abs(r.dx) % step, 0);
                assert.equal(Math.sign(r.dx), Math.sign(c.dx));
                assert.equal(Math.sign(r.dy), Math.sign(c.dy));
            }
        }
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: 12.3, dy: -12.3 }, 10), { dx: 10, dy: -10 });
    });

    it('ちょうど中間でも45°が崩れない', () => {
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: 2.5, dy: -2.5 }, 1), { dx: 3, dy: -3 });
        assert.deepEqual(roundConstrainedDeltaToUnit({ dx: -15, dy: 15 }, 10), { dx: -20, dy: 20 });
    });

    it('移動量0は0のまま（-0にしない）', () => {
        const r = roundConstrainedDeltaToUnit({ dx: 0, dy: 0 }, 10);
        assert.ok(Object.is(r.dx, 0));
        assert.ok(Object.is(r.dy, 0));
    });

    it('斜めで0に丸まっても-0を含めない', () => {
        const r = roundConstrainedDeltaToUnit({ dx: -0.3, dy: -0.3 }, 1);
        assert.ok(Object.is(r.dx, 0));
        assert.ok(Object.is(r.dy, 0));
    });

    it('丸めない刻みでは入力と同じ値・新しいオブジェクト', () => {
        const d = { dx: 2.5, dy: -2.5 };
        for (const step of [null, 0, -1, NaN, '1']) {
            const r = roundConstrainedDeltaToUnit(d, step);
            assert.deepEqual(r, { dx: 2.5, dy: -2.5 });
            assert.notEqual(r, d);
        }
    });

    it('引数を書き換えない', () => {
        const d = { dx: 2.5, dy: -2.5 };
        roundConstrainedDeltaToUnit(d, 1);
        assert.deepEqual(d, { dx: 2.5, dy: -2.5 });
    });
});

describe('roundPointFromOriginToUnit', () => {
    it('整数の基準点：移動量が刻みの倍数になる', () => {
        assert.deepEqual(roundPointFromOriginToUnit({ x: 100, y: 50 }, { x: 113, y: 47 }, 10), { x: 110, y: 50 });
        assert.deepEqual(roundPointFromOriginToUnit({ x: 100, y: 50 }, { x: 103.4, y: 47.6 }, 1), { x: 103, y: 48 });
    });

    it('小数の基準点：小数の部分が保たれる', () => {
        assert.deepEqual(roundPointFromOriginToUnit({ x: 0.25, y: -3.75 }, { x: 7.1, y: 2.2 }, 1), { x: 7.25, y: 2.25 });
        assert.deepEqual(roundPointFromOriginToUnit({ x: 0.25, y: -3.75 }, { x: 13, y: 12 }, 10), { x: 10.25, y: 16.25 });
    });

    it('結果に-0を含めない', () => {
        const z = roundPointFromOriginToUnit({ x: 10, y: 10 }, { x: 0.1, y: -0.2 }, 10);
        assert.ok(Object.is(z.x, 0));
        assert.ok(Object.is(z.y, 0));
    });

    it('丸めない刻みでは target と同じ値（計算しない）', () => {
        const target = { x: 0.1 + 0.2, y: -0 };
        for (const step of [null, 0, -1, NaN, '10']) {
            const r = roundPointFromOriginToUnit({ x: 0.7, y: 3 }, target, step);
            assert.ok(Object.is(r.x, target.x));
            assert.ok(Object.is(r.y, -0));
            assert.notEqual(r, target);
        }
    });

    it('引数を書き換えない・同じ入力に同じ結果', () => {
        const o = { x: 1.5, y: 2.5 };
        const t = { x: 8.2, y: 9.9 };
        const a = roundPointFromOriginToUnit(o, t, 1);
        const b = roundPointFromOriginToUnit(o, t, 1);
        assert.deepEqual(o, { x: 1.5, y: 2.5 });
        assert.deepEqual(t, { x: 8.2, y: 9.9 });
        assert.deepEqual(a, b);
    });
});

describe('resolveUnitSnapStep', () => {
    it('suppressed が真なら null', () => {
        assert.equal(resolveUnitSnapStep(1, true), null);
        assert.equal(resolveUnitSnapStep(10, true), null);
        assert.equal(resolveUnitSnapStep(null, true), null);
    });

    it('suppressed が偽なら activeStep そのまま（null も）', () => {
        assert.equal(resolveUnitSnapStep(1, false), 1);
        assert.equal(resolveUnitSnapStep(10, false), 10);
        assert.equal(resolveUnitSnapStep(null, false), null);
    });
});
