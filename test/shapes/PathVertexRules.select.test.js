/**
 * 責務: PathVertexRules のうち、選んだ点の番号の読み替え（outlineVertexIndexOf）と選んでいる区間の判定（selectedSegmentIndexesOf）、およびそれを使う「曲線に」「直線に」が変わらないことを、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { outlineVertexIndexOf, selectedSegmentIndexesOf } from '../../js/shapes/PathVertexRules.js';
import { resolveSegmentSwitchAvailability, planSegmentKindSwitch, SegmentKindSwitch } from '../../js/shapes/PathSegmentKindRules.js';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

const P = (x, y) => ({ x, y });
const openPath = () => new Path([P(0, 0), P(10, 0), P(20, 0), P(30, 0)], false, '#000000', 2, null, SEGMENT_KIND_LINE);
const closedPath = () => new Path([P(0, 0), P(10, 0), P(10, 10), P(0, 10)], true, '#000000', 2, null, SEGMENT_KIND_LINE);

describe('outlineVertexIndexOf', () => {
    it('直線・矩形・パスは同じ番号', () => {
        const line = new Line(0, 0, 10, 0).toJSON();
        assert.equal(outlineVertexIndexOf(line, 0), 0);
        assert.equal(outlineVertexIndexOf(line, 1), 1);
        const rect = new Rect(0, 0, 10, 10).toJSON();
        for (let i = 0; i < 4; i++) assert.equal(outlineVertexIndexOf(rect, i), i);
        const path = openPath().toJSON();
        for (let i = 0; i < 4; i++) assert.equal(outlineVertexIndexOf(path, i), i);
    });

    it('今の曲線は0→0・1→null・2→1', () => {
        const curve = new Curve(0, 0, 100, 0).toJSON();
        assert.equal(outlineVertexIndexOf(curve, 0), 0);
        assert.equal(outlineVertexIndexOf(curve, 1), null);
        assert.equal(outlineVertexIndexOf(curve, 2), 1);
    });

    it('円・弧・範囲外・整数でない値はnull', () => {
        assert.equal(outlineVertexIndexOf(new Ellipse(0, 0, 10, 10).toJSON(), 0), null);
        assert.equal(outlineVertexIndexOf({ type: 'arc', points: [P(0, 0), P(1, 1), P(2, 0)] }, 0), null);
        const path = openPath().toJSON();
        assert.equal(outlineVertexIndexOf(path, -1), null);
        assert.equal(outlineVertexIndexOf(path, 4), null);
        assert.equal(outlineVertexIndexOf(path, 1.5), null);
        assert.equal(outlineVertexIndexOf(path, NaN), null);
        assert.equal(outlineVertexIndexOf(path, '1'), null);
        assert.equal(outlineVertexIndexOf(new Curve(0, 0, 100, 0).toJSON(), 3), null);
    });
});

describe('selectedSegmentIndexesOf', () => {
    it('開いたパス：隣り合う2点・3点続き・始点と終点だけは区間なし', () => {
        const data = openPath().toJSON();
        assert.deepEqual(selectedSegmentIndexesOf(data, [1, 2]), [1]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1, 2]), [0, 1]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 3]), []);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 2]), []);
        assert.deepEqual(selectedSegmentIndexesOf(data, []), []);
    });

    it('閉じたパス：最後の点と始点は最後の区間', () => {
        const data = closedPath().toJSON();
        assert.deepEqual(selectedSegmentIndexesOf(data, [3, 0]), [3]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1, 2, 3]), [0, 1, 2, 3]);
    });

    it('矩形：隣り合う角は区間・対角だけは空・4つの角で4区間', () => {
        const data = new Rect(0, 0, 10, 10).toJSON();
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1]), [0]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [3, 0]), [3]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 2]), []);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1, 2, 3]), [0, 1, 2, 3]);
    });

    it('直線：両端で区間0', () => {
        const data = new Line(0, 0, 10, 0).toJSON();
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1]), [0]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0]), []);
    });

    it('今の曲線：始点と終点で区間0・制御点は関係しない', () => {
        const data = new Curve(0, 0, 100, 0).toJSON();
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 2]), [0]);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1]), []);
        assert.deepEqual(selectedSegmentIndexesOf(data, [1, 2]), []);
        assert.deepEqual(selectedSegmentIndexesOf(data, [0, 1, 2]), [0]);
    });

    it('円・弧は空', () => {
        assert.deepEqual(selectedSegmentIndexesOf(new Ellipse(0, 0, 10, 10).toJSON(), [0, 1]), []);
        assert.deepEqual(selectedSegmentIndexesOf({ type: 'arc', points: [P(0, 0), P(1, 1), P(2, 0)] }, [0, 1, 2]), []);
    });

    it('同じ点の重複は1つ・Setも受け付ける・引数を書き換えない', () => {
        const data = openPath().toJSON();
        const before = JSON.stringify(data);
        const indexes = [1, 2, 2, 1];
        assert.deepEqual(selectedSegmentIndexesOf(data, indexes), [1]);
        assert.deepEqual(indexes, [1, 2, 2, 1]);
        assert.deepEqual(selectedSegmentIndexesOf(data, new Set([2, 3])), [2]);
        assert.equal(JSON.stringify(data), before);
    });
});

describe('「曲線に」「直線に」が変わらない', () => {
    const targetsOf = (shape, indexes) => indexes.map((vertexIndex) => ({ shape, vertexIndex }));

    it('今の曲線の始点と終点：「直線に」だけ押せて直線になる', () => {
        const curve = new Curve(0, 0, 100, 0);
        curve.id = 'c1';
        const targets = targetsOf(curve, [0, 2]);
        assert.deepEqual(resolveSegmentSwitchAvailability(targets), { toLine: true, toCurve: false });
        const plan = planSegmentKindSwitch(targets, SegmentKindSwitch.TO_LINE);
        assert.equal(plan.length, 1);
        assert.equal(plan[0].targetId, 'c1');
        assert.deepEqual(plan[0].vertexIndexMap, [0, null, 1]);
        assert.deepEqual(planSegmentKindSwitch(targets, SegmentKindSwitch.TO_CURVE), []);
    });

    it('今の曲線の始点と制御点：押せない', () => {
        const curve = new Curve(0, 0, 100, 0);
        assert.deepEqual(resolveSegmentSwitchAvailability(targetsOf(curve, [0, 1])), { toLine: false, toCurve: false });
    });

    it('閉じたパスの終点と始点：最後の区間が切り替わる', () => {
        const path = new Path([P(0, 0), P(10, 0), P(10, 10)], true, '#000000', 2, null, [SEGMENT_KIND_LINE, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH]);
        path.id = 'p1';
        const targets = targetsOf(path, [2, 0]);
        assert.deepEqual(resolveSegmentSwitchAvailability(targets), { toLine: true, toCurve: false });
        const plan = planSegmentKindSwitch(targets, SegmentKindSwitch.TO_LINE);
        assert.equal(plan.length, 1);
        assert.deepEqual(plan[0].shape.toJSON().segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        assert.deepEqual(plan[0].vertexIndexMap, [0, 1, 2]);
    });

    it('開いたパスの始点と終点だけ：押せない・空', () => {
        const path = openPath();
        const targets = targetsOf(path, [0, 3]);
        assert.deepEqual(resolveSegmentSwitchAvailability(targets), { toLine: false, toCurve: false });
        assert.deepEqual(planSegmentKindSwitch(targets, SegmentKindSwitch.TO_CURVE), []);
        assert.deepEqual(planSegmentKindSwitch(targets, SegmentKindSwitch.TO_LINE), []);
    });

    it('矩形の隣り合う角：押せない・空のまま', () => {
        const rect = new Rect(0, 0, 10, 10);
        const targets = targetsOf(rect, [0, 1]);
        assert.deepEqual(resolveSegmentSwitchAvailability(targets), { toLine: false, toCurve: false });
        assert.deepEqual(planSegmentKindSwitch(targets, SegmentKindSwitch.TO_CURVE), []);
        assert.deepEqual(planSegmentKindSwitch(targets, SegmentKindSwitch.TO_LINE), []);
    });
});
