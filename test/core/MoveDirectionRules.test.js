/**
 * 責務：MoveDirectionRules（移動量を横・縦・斜め45°の直線へ限定する規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { constrainMoveDirection } from '../../js/core/MoveDirectionRules.js';

describe('constrainMoveDirection：各直線の上の入力', () => {
    it('横の軸上は入力と同じ値', () => {
        assert.deepEqual(constrainMoveDirection(10, 0), { dx: 10, dy: 0 });
        assert.deepEqual(constrainMoveDirection(-10, 0), { dx: -10, dy: 0 });
    });

    it('縦の軸上は入力と同じ値', () => {
        assert.deepEqual(constrainMoveDirection(0, 10), { dx: 0, dy: 10 });
        assert.deepEqual(constrainMoveDirection(0, -10), { dx: 0, dy: -10 });
    });

    it('斜め4方向の対角線上は入力と同じ値', () => {
        assert.deepEqual(constrainMoveDirection(7, 7), { dx: 7, dy: 7 });
        assert.deepEqual(constrainMoveDirection(-7, 7), { dx: -7, dy: 7 });
        assert.deepEqual(constrainMoveDirection(7, -7), { dx: 7, dy: -7 });
        assert.deepEqual(constrainMoveDirection(-7, -7), { dx: -7, dy: -7 });
    });
});

describe('constrainMoveDirection：近い直線への限定', () => {
    it('横に近い向きは横へ', () => {
        assert.deepEqual(constrainMoveDirection(10, 1), { dx: 10, dy: 0 });
    });

    it('縦に近い向きは縦へ', () => {
        assert.deepEqual(constrainMoveDirection(1, -10), { dx: 0, dy: -10 });
    });

    it('斜めに近い向きは斜めへ（正射影）', () => {
        assert.deepEqual(constrainMoveDirection(10, 9), { dx: 9.5, dy: 9.5 });
        assert.deepEqual(constrainMoveDirection(-10, 8), { dx: -9, dy: 9 });
    });

    it('22.5°の少し手前は横、少し先は斜めに分かれる', () => {
        const near = constrainMoveDirection(100, 41);
        assert.equal(near.dy, 0);
        assert.equal(near.dx, 100);
        const far = constrainMoveDirection(100, 42);
        assert.equal(far.dx, far.dy);
        assert.ok(far.dx > 0);
    });

    it('67.5°の少し手前は斜め、少し先は縦に分かれる', () => {
        const diagonal = constrainMoveDirection(42, 100);
        assert.equal(diagonal.dx, diagonal.dy);
        const vertical = constrainMoveDirection(41, 100);
        assert.deepEqual(vertical, { dx: 0, dy: 100 });
    });
});

describe('constrainMoveDirection：移動量0', () => {
    it('移動量0はそのまま返す', () => {
        assert.deepEqual(constrainMoveDirection(0, 0), { dx: 0, dy: 0 });
    });
});

describe('constrainMoveDirection：性質', () => {
    /** 決まった式で作る多数の入力（乱数を使わず再現できるようにする） */
    function sampleInputs() {
        const inputs = [];
        for (let i = -20; i <= 20; i++) {
            for (let j = -20; j <= 20; j++) {
                inputs.push([i * 1.7, j * 0.9]);
            }
        }
        return inputs;
    }

    it('結果は4本の直線のいずれかの上にある', () => {
        for (const [dx, dy] of sampleInputs()) {
            const r = constrainMoveDirection(dx, dy);
            const onLine = r.dy === 0 || r.dx === 0 || Math.abs(r.dx) === Math.abs(r.dy);
            assert.ok(onLine, `(${dx}, ${dy}) -> (${r.dx}, ${r.dy})`);
        }
    });

    it('結果は元の移動量の正射影（差が結果に直交する）', () => {
        for (const [dx, dy] of sampleInputs()) {
            const r = constrainMoveDirection(dx, dy);
            const dot = (dx - r.dx) * r.dx + (dy - r.dy) * r.dy;
            assert.ok(Math.abs(dot) < 1e-9, `(${dx}, ${dy}) -> (${r.dx}, ${r.dy}) dot=${dot}`);
        }
    });

    it('同じ入力には同じ結果を返し、新しいオブジェクトを返す', () => {
        const a = constrainMoveDirection(13, 5);
        const b = constrainMoveDirection(13, 5);
        assert.deepEqual(a, b);
        assert.notEqual(a, b);
    });
});
