/**
 * 責務: 吸い付く先の点の走査（findNearestSnapPoint）と距離の測り方（snapDistance）を、公開APIのみを通して検証する。
 * 許容距離の境界・同距離の優先・返す値の同一性・引数を書き換えないことを確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { snapDistance, findNearestSnapPoint } from '../../js/shapes/EndpointSnapRules.js';

/** 図形のid付きの簡易オブジェクトと、その点の並びを作る */
const shapeOf = (id, points) => ({ id, points });
const pointsOf = (shape) => shape.points;

describe('snapDistance', () => {
    it('2点間の距離を返す', () => {
        assert.equal(snapDistance({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
    });
    it('引数の順を入れ替えても同じ値', () => {
        const a = { x: 1, y: 2 };
        const b = { x: 4, y: 6 };
        assert.equal(snapDistance(a, b), snapDistance(b, a));
    });
    it('負の座標でも正しい距離を返す', () => {
        assert.equal(snapDistance({ x: -3, y: -4 }, { x: 0, y: 0 }), 5);
        assert.equal(snapDistance({ x: -1, y: -1 }, { x: -4, y: -5 }), 5);
    });
});

describe('findNearestSnapPoint', () => {
    const origin = { x: 0, y: 0 };

    it('図形が無ければ shape・candidate が null で distance が Infinity', () => {
        const r = findNearestSnapPoint([], origin, 10, pointsOf);
        assert.deepEqual(r, { shape: null, candidate: null, distance: Infinity });
    });
    it('候補が無い（pointsOf が空）なら見つからない', () => {
        const r = findNearestSnapPoint([shapeOf('a', [])], origin, 10, pointsOf);
        assert.deepEqual(r, { shape: null, candidate: null, distance: Infinity });
    });
    it('許容距離ちょうどは選ぶ', () => {
        const r = findNearestSnapPoint([shapeOf('a', [{ x: 3, y: 4 }])], origin, 5, pointsOf);
        assert.equal(r.shape.id, 'a');
        assert.equal(r.distance, 5);
    });
    it('許容距離をわずかに超えると選ばない', () => {
        const r = findNearestSnapPoint([shapeOf('a', [{ x: 3, y: 4.001 }])], origin, 5, pointsOf);
        assert.equal(r.shape, null);
        assert.equal(r.candidate, null);
    });
    it('いちばん近い候補を選ぶ', () => {
        const shapes = [shapeOf('a', [{ x: 4, y: 0 }, { x: 2, y: 0 }]), shapeOf('b', [{ x: 3, y: 0 }])];
        const r = findNearestSnapPoint(shapes, origin, 10, pointsOf);
        assert.equal(r.shape.id, 'a');
        assert.equal(r.candidate.x, 2);
        assert.equal(r.distance, 2);
    });
    it('同じ距離なら前面（配列で後ろ）の図形を選ぶ', () => {
        const shapes = [shapeOf('back', [{ x: 2, y: 0 }]), shapeOf('front', [{ x: 0, y: 2 }])];
        const r = findNearestSnapPoint(shapes, origin, 10, pointsOf);
        assert.equal(r.shape.id, 'front');
    });
    it('同じ図形の中で同じ距離なら pointsOf の並びの前の方を選ぶ', () => {
        const first = { x: 2, y: 0, tag: 'first' };
        const second = { x: 0, y: 2, tag: 'second' };
        const r = findNearestSnapPoint([shapeOf('a', [first, second])], origin, 10, pointsOf);
        assert.equal(r.candidate.tag, 'first');
    });
    it('candidate は pointsOf が返したオブジェクトそのもの（ほかのキーも保つ）・shape は図形そのもの', () => {
        const cand = { x: 1, y: 1, end: 'start', extra: 42 };
        const shape = shapeOf('a', [cand]);
        const r = findNearestSnapPoint([shape], origin, 10, pointsOf);
        assert.equal(r.candidate, cand);
        assert.equal(r.candidate.extra, 42);
        assert.equal(r.shape, shape);
    });
    it('引数を書き換えない', () => {
        const shapes = [shapeOf('a', [{ x: 1, y: 1 }, { x: 5, y: 5 }]), shapeOf('b', [{ x: 2, y: 2 }])];
        const point = { x: 0, y: 0 };
        const shapesBefore = JSON.stringify(shapes);
        const pointBefore = JSON.stringify(point);
        findNearestSnapPoint(shapes, point, 10, pointsOf);
        assert.equal(JSON.stringify(shapes), shapesBefore);
        assert.equal(JSON.stringify(point), pointBefore);
    });
});
