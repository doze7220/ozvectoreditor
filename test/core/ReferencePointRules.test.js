/**
 * 責務: ReferencePointRules（基準点の名前と外枠の上の位置の求め方）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    REFERENCE_POINT,
    DEFAULT_REFERENCE_POINT,
    isReferencePoint,
    resolveReferencePointPosition
} from '../../js/core/ReferencePointRules.js';
import { computeFrameCenter } from '../../js/core/ScaleHandleRules.js';

const BOUNDS = { minX: 10, minY: 20, maxX: 50, maxY: 80 };

describe('ReferencePointRules 定数', () => {
    test('9つの値と凍結', () => {
        assert.deepEqual(Object.values(REFERENCE_POINT).sort(), ['center', 'e', 'n', 'ne', 'nw', 's', 'se', 'sw', 'w']);
        assert.equal(REFERENCE_POINT.CENTER, 'center');
        assert.ok(Object.isFrozen(REFERENCE_POINT));
    });
    test('既定は中心', () => {
        assert.equal(DEFAULT_REFERENCE_POINT, 'center');
    });
});

describe('isReferencePoint', () => {
    test('9つは真', () => {
        for (const v of Object.values(REFERENCE_POINT)) assert.equal(isReferencePoint(v), true);
    });
    test('それ以外は偽', () => {
        for (const v of [null, undefined, 'c', 'NW', '', 1, {}]) assert.equal(isReferencePoint(v), false);
    });
});

describe('resolveReferencePointPosition', () => {
    test('9か所の位置', () => {
        const expected = {
            nw: { x: 10, y: 20 }, n: { x: 30, y: 20 }, ne: { x: 50, y: 20 },
            w: { x: 10, y: 50 }, center: { x: 30, y: 50 }, e: { x: 50, y: 50 },
            sw: { x: 10, y: 80 }, s: { x: 30, y: 80 }, se: { x: 50, y: 80 }
        };
        for (const [name, pos] of Object.entries(expected)) {
            assert.deepEqual(resolveReferencePointPosition(BOUNDS, name), pos, name);
        }
    });
    test('中心はcomputeFrameCenterと同じ値', () => {
        assert.deepEqual(resolveReferencePointPosition(BOUNDS, 'center'), computeFrameCenter(BOUNDS));
    });
    test('null・未知の名前は中心', () => {
        const c = computeFrameCenter(BOUNDS);
        assert.deepEqual(resolveReferencePointPosition(BOUNDS, null), c);
        assert.deepEqual(resolveReferencePointPosition(BOUNDS, undefined), c);
        assert.deepEqual(resolveReferencePointPosition(BOUNDS, 'xx'), c);
    });
    test('幅0・高さ0・両方0の外枠', () => {
        const flatW = { minX: 10, minY: 20, maxX: 10, maxY: 80 };
        assert.deepEqual(resolveReferencePointPosition(flatW, 'ne'), { x: 10, y: 20 });
        assert.deepEqual(resolveReferencePointPosition(flatW, 'e'), { x: 10, y: 50 });
        const flatH = { minX: 10, minY: 20, maxX: 50, maxY: 20 };
        assert.deepEqual(resolveReferencePointPosition(flatH, 'sw'), { x: 10, y: 20 });
        assert.deepEqual(resolveReferencePointPosition(flatH, 's'), { x: 30, y: 20 });
        const dot = { minX: 5, minY: 7, maxX: 5, maxY: 7 };
        for (const name of Object.values(REFERENCE_POINT)) {
            assert.deepEqual(resolveReferencePointPosition(dot, name), { x: 5, y: 7 }, name);
        }
    });
    test('引数を書き換えず新しいオブジェクトを返す', () => {
        const b = { ...BOUNDS };
        const a = resolveReferencePointPosition(b, 'nw');
        const c = resolveReferencePointPosition(b, 'nw');
        assert.deepEqual(b, BOUNDS);
        assert.notEqual(a, c);
    });
});
