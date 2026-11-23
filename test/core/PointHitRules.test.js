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

describe('classifyPointHit: includeFill（塗った内側を当たりに含めるか）', () => {
    test('falseのとき、塗った内側は空白になる（選択中の図形の内側でも）', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000')];
        assert.deepEqual(classifyPointHit(shapes, selectedBy([]), 50, 50, TOLERANCE, false), { handle: null, bodyId: null });
        assert.equal(classifyPointHit(shapes, selectedBy(['a']), 50, 50, TOLERANCE, false).bodyId, null);
    });

    test('falseのとき、手前の塗った図形の内側にある奥の図形の輪郭が選ばれる', () => {
        const shapes = [makeRect('a', [40, 40, 60, 60], null), makeRect('b', [0, 0, 100, 100], '#ff0000')];
        assert.equal(classifyPointHit(shapes, selectedBy([]), 40, 50, TOLERANCE, false).bodyId, 'a');
        assert.equal(classifyPointHit(shapes, selectedBy([]), 40, 50, TOLERANCE, true).bodyId, 'b');
    });

    test('falseのとき、選択集合の図形の輪郭の優先は変わらない', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], null), makeRect('b', [20, -50, 80, 50], '#ff0000')];
        assert.equal(classifyPointHit(shapes, selectedBy(['a']), 50, 0, TOLERANCE, false).bodyId, 'a');
    });

    test('falseのとき、ハンドルの当たりは変わらない', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000')];
        const hit = classifyPointHit(shapes, selectedBy(['a']), 1, 1, TOLERANCE, false);
        assert.deepEqual(hit.handle, { shapeId: 'a', handle: 'topLeft' });
        assert.equal(hit.bodyId, 'a');
    });

    test('falseのとき、輪郭の近くは今までどおり選ばれる', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000')];
        assert.equal(classifyPointHit(shapes, selectedBy([]), 0, 50, TOLERANCE, false).bodyId, 'a');
        assert.equal(classifyPointHit(shapes, selectedBy([]), 100, 50, TOLERANCE, false).bodyId, 'a');
    });

    test('trueを明示したときは省略時と同じ結果', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000'), makeRect('b', [50, 50, 150, 150], '#0000ff')];
        const points = [[75, 75], [25, 25], [0, 50], [200, 200], [120, 120]];
        for (const [x, y] of points) {
            assert.deepEqual(
                classifyPointHit(shapes, selectedBy(['a']), x, y, TOLERANCE, true),
                classifyPointHit(shapes, selectedBy(['a']), x, y, TOLERANCE)
            );
        }
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

describe('classifyPointHit: includeHandles', () => {
    test('falseのときハンドルはnullで、bodyIdは変わらない', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000')];
        const on = classifyPointHit(shapes, selectedBy(['a']), 0, 0, TOLERANCE, true, true);
        const off = classifyPointHit(shapes, selectedBy(['a']), 0, 0, TOLERANCE, true, false);
        assert.notEqual(on.handle, null);
        assert.equal(off.handle, null);
        assert.equal(off.bodyId, on.bodyId);
    });

    test('trueを明示したときは省略時と同じ結果', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000'), makeRect('b', [50, 50, 150, 150], '#0000ff')];
        const points = [[0, 0], [75, 75], [25, 25], [200, 200]];
        for (const [x, y] of points) {
            assert.deepEqual(
                classifyPointHit(shapes, selectedBy(['a']), x, y, TOLERANCE, true, true),
                classifyPointHit(shapes, selectedBy(['a']), x, y, TOLERANCE)
            );
        }
    });

    test('includeFillと独立に働く', () => {
        const shapes = [makeRect('a', [0, 0, 100, 100], '#ff0000')];
        for (const includeFill of [true, false]) {
            const hit = classifyPointHit(shapes, selectedBy(['a']), 0, 0, TOLERANCE, includeFill, false);
            assert.equal(hit.handle, null);
            assert.equal(hit.bodyId, 'a');
        }
        assert.equal(classifyPointHit(shapes, selectedBy([]), 50, 50, TOLERANCE, true, false).bodyId, 'a');
        assert.equal(classifyPointHit(shapes, selectedBy([]), 50, 50, TOLERANCE, false, false).bodyId, null);
    });
});

/**
 * 指定した位置を最初の頂点にし、残りを遠くに置いた開いたパスを作る。
 * @param {string} id 図形id
 * @param {{x: number, y: number}} first 最初の頂点の位置
 * @returns {Path} パス（頂点は'vertex-0'・'vertex-1'・'vertex-2'）
 */
function makePathStartingAt(id, first) {
    const path = new Path([first, { x: first.x + 500, y: first.y }, { x: first.x + 500, y: first.y + 500 }], false, '#000000', 2, null);
    path.id = id;
    return path;
}

/**
 * 円・弧の回した後の図形の`points`から、頂点でないハンドルがあった5か所（中心・右・上・左・下）を求める。
 * 直す前の`hitTestHandle`と同じ式（図形のハンドルのメソッドは呼ばない）。
 * @param {Ellipse} shape 円または弧
 * @returns {Array<{x: number, y: number}>} 中心・右・上・左・下の位置
 */
function fiveNonVertexPositions(shape) {
    const xc = shape.points[0].x;
    const yc = shape.points[0].y;
    const rx = Math.abs(shape.points[1].x - xc);
    const ry = Math.abs(shape.points[2].y - yc);
    return [
        { x: xc, y: yc },
        { x: xc + rx, y: yc },
        { x: xc, y: yc - ry },
        { x: xc - rx, y: yc },
        { x: xc, y: yc + ry },
    ];
}

/**
 * 点(cx, cy)のまわりに角度angleだけ回すアフィン変換を作る。
 * @param {number} cx 回転の中心のX座標
 * @param {number} cy 回転の中心のY座標
 * @param {number} angle 回転角（ラジアン）
 * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}} アフィン変換
 */
function rotationAround(cx, cy, angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return { a: cos, b: sin, c: -sin, d: cos, e: cx - (cos * cx - sin * cy), f: cy - (sin * cx + cos * cy) };
}

describe('classifyPointHit: 頂点でないハンドル', () => {
    const FIVE_NAMES = ['中心', '右', '上', '左', '下'];

    test('手前が円・奥がパス：円の中心・右・上・左・下に重なったパスの頂点が当たる', () => {
        const front = makeCircle('c', 100, 100, 20, null);
        const positions = fiveNonVertexPositions(front);
        positions.forEach((pos, i) => {
            const shapes = [makePathStartingAt('p', pos), front];
            const hit = classifyPointHit(shapes, selectedBy(['p', 'c']), pos.x, pos.y, TOLERANCE, true, true);
            assert.deepEqual(hit.handle, { shapeId: 'p', handle: 'vertex-0' }, FIVE_NAMES[i]);
        });
    });

    test('手前が弧・奥が線：弧の中心・右・上・左・下に重なった線の頂点が当たる', () => {
        const front = new Ellipse(100, 100, 120, 80, 'arc', '#000000', 2, null);
        front.id = 'a';
        const positions = fiveNonVertexPositions(front);
        positions.forEach((pos, i) => {
            const back = makeLine('l', [pos.x, pos.y, pos.x + 500, pos.y]);
            const hit = classifyPointHit([back, front], selectedBy(['l', 'a']), pos.x, pos.y, TOLERANCE, true, true);
            assert.deepEqual(hit.handle, { shapeId: 'l', handle: 'start' }, FIVE_NAMES[i]);
        });
    });

    test('手前が回した円・奥が線：回した後の5か所に重なった線の頂点が当たる', () => {
        const front = makeCircle('c', 100, 100, 20, null).createTransformed(rotationAround(100, 100, Math.PI / 6));
        const positions = fiveNonVertexPositions(front);
        positions.forEach((pos, i) => {
            const back = makeLine('l', [pos.x, pos.y, pos.x + 500, pos.y]);
            const hit = classifyPointHit([back, front], selectedBy(['l', 'c']), pos.x, pos.y, TOLERANCE, true, true);
            assert.deepEqual(hit.handle, { shapeId: 'l', handle: 'start' }, FIVE_NAMES[i]);
        });
    });

    test('手前が回した弧・奥がパス：回した後の5か所に重なったパスの頂点が当たる', () => {
        const arc = new Ellipse(100, 100, 120, 80, 'arc', '#000000', 2, null);
        arc.id = 'a';
        const front = arc.createTransformed(rotationAround(100, 100, Math.PI / 6));
        const positions = fiveNonVertexPositions(front);
        positions.forEach((pos, i) => {
            const shapes = [makePathStartingAt('p', pos), front];
            const hit = classifyPointHit(shapes, selectedBy(['p', 'a']), pos.x, pos.y, TOLERANCE, true, true);
            assert.deepEqual(hit.handle, { shapeId: 'p', handle: 'vertex-0' }, FIVE_NAMES[i]);
        });
    });

    test('手前が直線の中点・奥がパス：中点に重なったパスの頂点が当たる', () => {
        const front = makeLine('l', [100, 100, 140, 100]);
        const shapes = [makePathStartingAt('p', { x: 120, y: 100 }), front];
        const hit = classifyPointHit(shapes, selectedBy(['p', 'l']), 120, 100, TOLERANCE, true, true);
        assert.deepEqual(hit.handle, { shapeId: 'p', handle: 'vertex-0' });
    });

    test('手前が直線の中点・奥が線：中点に重なった線の頂点が当たる', () => {
        const front = makeLine('f', [100, 100, 140, 100]);
        const back = makeLine('b', [120, 100, 620, 100]);
        const hit = classifyPointHit([back, front], selectedBy(['b', 'f']), 120, 100, TOLERANCE, true, true);
        assert.deepEqual(hit.handle, { shapeId: 'b', handle: 'start' });
    });

    test('円の中心で奥に頂点が無いとき、handleはnullでbodyIdはincludeHandlesが偽のときと同じ', () => {
        const front = makeCircle('c', 100, 100, 20, null);
        const back = makeRect('r', [300, 300, 400, 400], null);
        const on = classifyPointHit([back, front], selectedBy(['r', 'c']), 100, 100, TOLERANCE, true, true);
        const off = classifyPointHit([back, front], selectedBy(['r', 'c']), 100, 100, TOLERANCE, true, false);
        assert.equal(on.handle, null);
        assert.equal(on.bodyId, off.bodyId);
    });

    test('頂点どうしの重なりは手前の図形が優先される', () => {
        const front = makeLine('l', [100, 100, 140, 100]);
        const shapes = [makePathStartingAt('p', { x: 140, y: 100 }), front];
        const hit = classifyPointHit(shapes, selectedBy(['p', 'l']), 140, 100, TOLERANCE, true, true);
        assert.deepEqual(hit.handle, { shapeId: 'l', handle: 'end' });
    });

    test('hitTestHandleが頂点でない名前を返す図形（getVertexHandleNamesに無い名前）が手前でも、奥の頂点が当たる', () => {
        const fake = {
            id: 'f',
            hitTestHandle: () => 'bogus',
            getVertexHandleNames: () => ['vertex-0'],
            hitTest: () => false,
            hitTestFill: () => false,
        };
        const shapes = [makePathStartingAt('p', { x: 50, y: 50 }), fake];
        const hit = classifyPointHit(shapes, selectedBy(['p', 'f']), 50, 50, TOLERANCE, true, true);
        assert.deepEqual(hit.handle, { shapeId: 'p', handle: 'vertex-0' });
    });
});
