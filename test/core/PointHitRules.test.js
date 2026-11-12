/**
 * 責務: PointHitRules.classifyPointHit（選択モードの当たり分類の規則：ハンドル・本体の優先順位・空白）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPointHit } from '../../js/core/PointHitRules.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';
import { Line } from '../../js/shapes/Line.js';

const TOLERANCE = 5;

/**
 * 指定したidの矩形を作る。
 * @param {string} id 図形id
 * @param {number[]} box [x1, y1, x2, y2]
 * @param {string|null} fillColor 塗りの色
 * @param {string|null} [strokeColor='#000000'] 線の色
 * @returns {Rect} 矩形
 */
function makeRect(id, box, fillColor, strokeColor = '#000000') {
    const rect = new Rect(box[0], box[1], box[2], box[3], strokeColor, 2, fillColor);
    rect.id = id;
    return rect;
}

/**
 * 指定したidの円（中心と半径指定）を作る。
 * @param {string} id 図形id
 * @param {number} cx 中心のX座標
 * @param {number} cy 中心のY座標
 * @param {number} r 半径
 * @param {string|null} fillColor 塗りの色
 * @returns {Ellipse} 円
 */
function makeCircle(id, cx, cy, r, fillColor) {
    const circle = new Ellipse(cx, cy, cx + r, cy + r, 'circle', '#000000', 2, fillColor);
    circle.id = id;
    return circle;
}

/**
 * 指定したidの直線を作る。
 * @param {string} id 図形id
 * @param {number[]} seg [x1, y1, x2, y2]
 * @returns {Line} 直線
 */
function makeLine(id, seg) {
    const line = new Line(seg[0], seg[1], seg[2], seg[3]);
    line.id = id;
    return line;
}

/**
 * 選択集合による`isSelected`関数を作る。
 * @param {string[]} ids 選択中の図形id
 * @returns {function(string): boolean} 選択中かの照会
 */
function selectedBy(ids) {
    const set = new Set(ids);
    return (id) => set.has(id);
}

describe('classifyPointHit: ハンドル（規則1）', () => {
    test('選択集合の図形のハンドルが当たる', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null)];
        const hit = classifyPointHit(shapes, selectedBy(['a']), 1, 1, TOLERANCE);
        assert.deepEqual(hit.handle, { shapeId: 'a', handle: 'topLeft' });
    });

    test('選択されていない図形のハンドルは当たらない', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null)];
        const hit = classifyPointHit(shapes, selectedBy([]), 1, 1, TOLERANCE);
        assert.equal(hit.handle, null);
    });

    test('ハンドルが重なるときは手前（図形配列の後ろ）の図形', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null), makeRect('b', [0, 0, 50, 50], null)];
        const hit = classifyPointHit(shapes, selectedBy(['a', 'b']), 0, 0, TOLERANCE);
        assert.deepEqual(hit.handle, { shapeId: 'b', handle: 'topLeft' });
    });

    test('ハンドルが当たってもbodyIdも求められる', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null)];
        const hit = classifyPointHit(shapes, selectedBy(['a']), 0, 0, TOLERANCE);
        assert.equal(hit.handle.shapeId, 'a');
        assert.equal(hit.bodyId, 'a');
    });
});

describe('classifyPointHit: 本体の優先順位（規則2・3）', () => {
    test('選択集合の図形の輪郭が、手前の選択されていない塗った図形の内側より優先される', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null), makeRect('b', [20, -50, 80, 50], '#ff0000')];
        const hit = classifyPointHit(shapes, selectedBy(['a']), 50, 0, TOLERANCE);
        assert.equal(hit.bodyId, 'a');
    });

    test('選択集合の図形が複数当たるとき手前が選ばれる', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null), makeRect('b', [0, 0, 100, 50], null)];
        const hit = classifyPointHit(shapes, selectedBy(['a', 'b']), 50, 0, TOLERANCE);
        assert.equal(hit.bodyId, 'b');
    });

    test('選択中の奥の大きな塗った図形の上にある手前の図形の内側で、手前の図形が選ばれる', () => {
        const shapes = [makeRect('big', [0, 0, 200, 200], '#00ff00'), makeCircle('c', 100, 100, 20, '#ff0000')];
        const hit = classifyPointHit(shapes, selectedBy(['big']), 100, 100, TOLERANCE);
        assert.equal(hit.bodyId, 'c');
    });

    test('塗った図形の内側で、その図形が選ばれる（選択中の図形の内側でもその図形）', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000')];
        assert.equal(classifyPointHit(shapes, selectedBy([]), 50, 50, TOLERANCE).bodyId, 'a');
        assert.equal(classifyPointHit(shapes, selectedBy(['a']), 50, 50, TOLERANCE).bodyId, 'a');
    });

    test('塗った図形が重なる所で手前が選ばれる', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000'), makeRect('b', [50, 50, 150, 150], '#0000ff')];
        const hit = classifyPointHit(shapes, selectedBy([]), 75, 75, TOLERANCE);
        assert.equal(hit.bodyId, 'b');
    });

    test('手前の塗った図形に隠れた奥の図形（選択されていない）の輪郭の近くで、手前の塗った図形が選ばれる', () => {
        const shapes = [makeRect('a', [40, 40, 60, 60], null), makeRect('b', [0, 0, 100, 100], '#ff0000')];
        const hit = classifyPointHit(shapes, selectedBy([]), 40, 50, TOLERANCE);
        assert.equal(hit.bodyId, 'b');
    });

    test('塗りのない図形どうしの輪郭の重なりで手前が選ばれる', () => {
        const shapes = [makeLine('a', [0, 0, 100, 0]), makeLine('b', [50, -50, 50, 50])];
        const hit = classifyPointHit(shapes, selectedBy([]), 50, 0, TOLERANCE);
        assert.equal(hit.bodyId, 'b');
    });
});

describe('classifyPointHit: 空白と見えない図形', () => {
    test('塗りなしの図形の内側は空白', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null)];
        const hit = classifyPointHit(shapes, selectedBy([]), 50, 50, TOLERANCE);
        assert.deepEqual(hit, { handle: null, bodyId: null });
    });

    test('塗れない形（開いたパス）がfillColorを持っていても内側は空白', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], false, '#000000', 2, '#ff0000');
        path.id = 'p';
        const hit = classifyPointHit([path], selectedBy([]), 70, 30, TOLERANCE);
        assert.equal(hit.bodyId, null);
    });

    test('塗れない形（弧）がfillColorを持っていても内側は空白', () => {
        const arc = new Ellipse(100, 100, 200, 0, 'arc', '#000000', 2, '#ff0000');
        arc.id = 'arc';
        const hit = classifyPointHit([arc], selectedBy([]), 100, 130, TOLERANCE);
        assert.equal(hit.bodyId, null);
    });

    test('図形0個ではhandleもbodyIdもnull', () => {
        const hit = classifyPointHit([], selectedBy([]), 0, 0, TOLERANCE);
        assert.deepEqual(hit, { handle: null, bodyId: null });
    });

    test('見えない図形（線も塗りもない）は輪郭の当たりで選ばれ、内側では選ばれない', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null, null)];
        assert.equal(classifyPointHit(shapes, selectedBy([]), 0, 50, TOLERANCE).bodyId, 'a');
        assert.equal(classifyPointHit(shapes, selectedBy([]), 50, 50, TOLERANCE).bodyId, null);
    });

    test('線なしで塗られた図形の塗りの外側の許容誤差以内で選ばれる', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000', null)];
        assert.equal(classifyPointHit(shapes, selectedBy([]), -3, 50, TOLERANCE).bodyId, 'a');
        assert.equal(classifyPointHit(shapes, selectedBy([]), -30, 50, TOLERANCE).bodyId, null);
    });
});

describe('classifyPointHit: 非破壊', () => {
    test('引数の図形配列の並びを書き換えない', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000'), makeRect('b', [50, 50, 150, 150], '#0000ff')];
        const before = shapes.slice();
        classifyPointHit(shapes, selectedBy(['a']), 75, 75, TOLERANCE);
        assert.deepEqual(shapes.map((s) => s.id), before.map((s) => s.id));
        assert.equal(shapes.length, 2);
        assert.equal(shapes[0], before[0]);
        assert.equal(shapes[1], before[1]);
    });
});
