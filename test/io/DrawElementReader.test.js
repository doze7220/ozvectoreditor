/**
 * 責務: DrawElementReader（描画要素1つ→図形データの変換）を、公開APIと`ShapeFactory.fromJSON`を通して検証する。
 * 入力は文字どおりの要素か`toDrawElement()`の戻り値から作り、戻り値の`id`の有無に依らない。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DrawElementReader } from '../../js/io/DrawElementReader.js';
import { DEFAULT_STROKE_WIDTH } from '../../js/io/SpriteSerializer.js';
import { ShapeFactory } from '../../js/core/ShapeFactory.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';
import { Rect } from '../../js/shapes/Rect.js';

const P = (x, y) => ({ x, y });

/**
 * 描画要素から図形を組み立てる。
 * @param {object} element - 描画要素
 * @returns {object} 図形
 */
function build(element) {
    return ShapeFactory.fromJSON(DrawElementReader.toShapeData(element));
}

/**
 * 輪郭の点（媒介変数を等分した点）の並びを返す。`points`の約束（`中心 + u·cos t − w·sin t`）で読む。
 * @param {object} ellipse - 円・弧
 * @param {number} t0 - 始めの媒介変数
 * @param {number} t1 - 終わりの媒介変数
 * @returns {{x: number, y: number}[]} 点の並び
 */
function outline(ellipse, t0, t1) {
    const [c, a, b] = ellipse.points;
    const u = { x: a.x - c.x, y: a.y - c.y };
    const w = { x: b.x - c.x, y: b.y - c.y };
    const out = [];
    for (let i = 0; i <= 8; i++) {
        const t = t0 + ((t1 - t0) * i) / 8;
        out.push({ x: c.x + u.x * Math.cos(t) - w.x * Math.sin(t), y: c.y + u.y * Math.cos(t) - w.y * Math.sin(t) });
    }
    return out;
}

/**
 * 点の並びが丸めの範囲で一致することを確かめる。
 * @param {{x: number, y: number}[]} actual - 実際の並び
 * @param {{x: number, y: number}[]} expected - 期待する並び
 * @returns {void}
 */
function assertPointsClose(actual, expected) {
    assert.equal(actual.length, expected.length);
    actual.forEach((p, i) => {
        assert.ok(Math.abs(p.x - expected[i].x) < 1e-9 && Math.abs(p.y - expected[i].y) < 1e-9, `点${i}: (${p.x}, ${p.y}) と (${expected[i].x}, ${expected[i].y})`);
    });
}

/**
 * 描画要素の楕円の輪郭（媒介変数を等分した点）を返す。
 * @param {object} el - `ellipse`の描画要素
 * @returns {{x: number, y: number}[]} 点の並び
 */
function elementOutline(el) {
    let end = el.endAngle;
    if (end < el.startAngle) end += 2 * Math.PI;
    const out = [];
    for (let i = 0; i <= 8; i++) {
        const t = el.startAngle + ((end - el.startAngle) * i) / 8;
        const ex = el.radiusX * Math.cos(t);
        const ey = el.radiusY * Math.sin(t);
        out.push({
            x: el.x + ex * Math.cos(el.rotation) - ey * Math.sin(el.rotation),
            y: el.y + ex * Math.sin(el.rotation) + ey * Math.cos(el.rotation),
        });
    }
    return out;
}

describe('DrawElementReader.toShapeData: polyline', () => {
    it('閉じていない2点は直線（塗りなし）', () => {
        const data = DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(10, 5)], closed: false, strokeColor: '#111111', strokeWidth: 3, fillColor: '#ff0000' });
        assert.deepEqual(data, { type: 'line', points: [P(0, 0), P(10, 5)], strokeColor: '#111111', strokeWidth: 3, fillColor: null });
        assert.equal(ShapeFactory.fromJSON(data).type, 'line');
    });

    it('閉じていない3点以上は直線区間のパス（n-1区間・塗りなし）', () => {
        const data = DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(1, 1), P(2, 0)], closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: '#ff0000' });
        assert.equal(data.type, 'path');
        assert.equal(data.closed, false);
        assert.deepEqual(data.segments, [{ kind: 'line' }, { kind: 'line' }]);
        assert.equal(data.fillColor, null);
        assert.equal(ShapeFactory.fromJSON(data).type, 'path');
    });

    it('閉じていれば区間はn個で塗りを読む', () => {
        const data = DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(4, 0), P(4, 4), P(0, 4)], closed: true, strokeColor: '#000000', strokeWidth: 2, fillColor: '#00ff00' });
        assert.equal(data.type, 'path');
        assert.equal(data.closed, true);
        assert.equal(data.segments.length, 4);
        assert.equal(data.fillColor, '#00ff00');
        const shape = ShapeFactory.fromJSON(data);
        assert.equal(shape.type, 'path');
        assert.equal(shape.closed, true);
    });

    it('閉じた2点・1点はShapeFactoryが断る', () => {
        assert.throws(() => build({ kind: 'polyline', points: [P(0, 0), P(1, 1)], closed: true }), Error);
        assert.throws(() => build({ kind: 'polyline', points: [P(0, 0)], closed: false }), Error);
    });

    it('閉じているかはtrueだけで判定する', () => {
        ['true', 1, 'yes', null, undefined].forEach((closed) => {
            const data = DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(4, 0), P(4, 4)], closed, strokeColor: '#000000', strokeWidth: 2, fillColor: '#00ff00' });
            assert.equal(data.closed, false);
            assert.equal(data.fillColor, null);
        });
        const noKey = DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(1, 1)] });
        assert.equal(noKey.type, 'line');
    });

    it('pointsが配列でなければErrorで、メッセージはDrawElementReader: で始まる', () => {
        assert.throws(() => DrawElementReader.toShapeData({ kind: 'polyline', points: null }), /^Error: DrawElementReader: /);
        assert.throws(() => DrawElementReader.toShapeData({ kind: 'polyline' }), /polyline/);
    });
});

describe('DrawElementReader.toShapeData: bezierPath', () => {
    const element = {
        kind: 'bezierPath',
        points: [P(0, 0), P(10, 0), P(10, 10)],
        closed: false,
        segments: [{ kind: 'line' }, { kind: 'cubic', control1: P(10, 3), control2: P(10, 7) }],
        strokeColor: '#222222',
        strokeWidth: 4,
        fillColor: '#ff0000',
    };

    it('lineはline・cubicはbezierへ変換し、cornersは付けない', () => {
        const data = DrawElementReader.toShapeData(element);
        assert.deepEqual(data, {
            type: 'path',
            points: [P(0, 0), P(10, 0), P(10, 10)],
            closed: false,
            segments: [{ kind: 'line' }, { kind: 'bezier', control1: P(10, 3), control2: P(10, 7) }],
            strokeColor: '#222222',
            strokeWidth: 4,
            fillColor: null,
        });
        assert.ok(!('corners' in data));
        const path = ShapeFactory.fromJSON(data);
        assert.ok(path instanceof Path);
        assert.equal(path.segments[1].kind, 'bezier');
    });

    it('閉じていれば塗りを読む', () => {
        const data = DrawElementReader.toShapeData({ ...element, points: [P(0, 0), P(10, 0), P(10, 10)], closed: true, segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }] });
        assert.equal(data.fillColor, '#ff0000');
    });

    it('segmentsが配列でない・区間がオブジェクトでない・未知のkindはError', () => {
        assert.throws(() => DrawElementReader.toShapeData({ ...element, segments: null }), /DrawElementReader: /);
        assert.throws(() => DrawElementReader.toShapeData({ ...element, segments: [{ kind: 'line' }, null] }), /DrawElementReader: /);
        ['smooth', 'bezier', 'toString', undefined].forEach((kind) => {
            assert.throws(() => DrawElementReader.toShapeData({ ...element, segments: [{ kind: 'line' }, { kind }] }), /DrawElementReader: /);
        });
    });

    it('区間の数の違いはShapeFactoryが断る', () => {
        assert.throws(() => build({ ...element, segments: [{ kind: 'line' }] }), Error);
    });
});

describe('DrawElementReader.toShapeData: quadratic', () => {
    it('曲線（塗りなし）へ変換する', () => {
        const data = DrawElementReader.toShapeData({ kind: 'quadratic', points: [P(0, 0), P(5, 10), P(10, 0)], strokeColor: '#333333', strokeWidth: 2, fillColor: '#ff0000' });
        assert.deepEqual(data, { type: 'curve', points: [P(0, 0), P(5, 10), P(10, 0)], strokeColor: '#333333', strokeWidth: 2, fillColor: null });
        assert.equal(ShapeFactory.fromJSON(data).type, 'curve');
    });

    it('3点でなければShapeFactoryが断る・pointsが配列でなければError', () => {
        assert.throws(() => build({ kind: 'quadratic', points: [P(0, 0), P(1, 1)] }), Error);
        assert.throws(() => build({ kind: 'quadratic', points: [P(0, 0), P(1, 1), P(2, 2), P(3, 3)] }), Error);
        assert.throws(() => DrawElementReader.toShapeData({ kind: 'quadratic', points: 'x' }), /DrawElementReader: /);
    });
});

describe('DrawElementReader.toShapeData: スタイルの読み方', () => {
    const base = { kind: 'polyline', points: [P(0, 0), P(4, 0), P(4, 4)], closed: true };

    it('線なし・塗りなし・太さの不正', () => {
        const data = DrawElementReader.toShapeData({ ...base, strokeColor: null, strokeWidth: 5, fillColor: null });
        assert.equal(data.strokeColor, null);
        assert.equal(data.fillColor, null);
        assert.equal(data.strokeWidth, 5);
        [0, -1, NaN, Infinity, '3', null, undefined].forEach((strokeWidth) => {
            assert.equal(DrawElementReader.toShapeData({ ...base, strokeColor: '#000000', strokeWidth }).strokeWidth, DEFAULT_STROKE_WIDTH);
        });
    });

    it('色が文字列でなければnull', () => {
        const data = DrawElementReader.toShapeData({ ...base, strokeColor: 5, strokeWidth: 2, fillColor: {} });
        assert.equal(data.strokeColor, null);
        assert.equal(data.fillColor, null);
    });

    it('fillColor・closed・rotationのキーが無くても読める', () => {
        const data = DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(1, 1), P(2, 0)], strokeColor: '#000000', strokeWidth: 2 });
        assert.equal(data.fillColor, null);
        assert.equal(data.closed, false);
        const el = DrawElementReader.toShapeData({ kind: 'ellipse', x: 1, y: 2, radiusX: 3, radiusY: 4, startAngle: 0, endAngle: 2 * Math.PI, closed: true, strokeColor: '#000000', strokeWidth: 2 });
        assert.equal(el.type, 'circle');
        assert.equal(el.fillColor, null);
    });

    it('塗れない要素（直線・曲線・弧）の塗りは読まない', () => {
        assert.equal(DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(1, 1)], closed: false, fillColor: '#ff0000' }).fillColor, null);
        const arc = DrawElementReader.toShapeData({ kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 5, rotation: 0, startAngle: Math.PI, endAngle: 2 * Math.PI, closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: '#ff0000' });
        assert.equal(arc.fillColor, null);
    });
});

describe('DrawElementReader.toShapeData: ellipse（円・弧）', () => {
    it('約束の位置の円は中心・右端・上端・開始角（右端）・終了角（右端）', () => {
        const data = DrawElementReader.toShapeData({ kind: 'ellipse', x: 10, y: 20, radiusX: 6, radiusY: 4, rotation: 0, startAngle: 0, endAngle: 2 * Math.PI, closed: true, strokeColor: '#000000', strokeWidth: 2, fillColor: '#ff0000' });
        assert.equal(data.type, 'circle');
        assert.deepEqual(data.points, [P(10, 20), P(16, 20), P(10, 16), P(16, 20), P(16, 20)]);
        assert.equal(data.fillColor, '#ff0000');
        assert.ok(ShapeFactory.fromJSON(data) instanceof Ellipse);
    });

    it('約束の位置の弧は開始角が左端で塗りなし', () => {
        const data = DrawElementReader.toShapeData({ kind: 'ellipse', x: 10, y: 20, radiusX: 6, radiusY: 4, rotation: 0, startAngle: Math.PI, endAngle: 2 * Math.PI, closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: null });
        assert.equal(data.type, 'arc');
        assert.deepEqual(data.points, [P(10, 20), P(16, 20), P(10, 16), P(4, 20), P(16, 20)]);
        assert.equal(data.fillColor, null);
    });

    it('描いた円・弧の5点が描いたときと同じ', () => {
        const circle = new Ellipse(30, 40, 50, 55, 'circle', '#123456', 3, '#abcdef');
        const arc = new Ellipse(30, 40, 50, 55, 'arc', '#123456', 3);
        [circle, arc].forEach((shape) => {
            const built = build(shape.toDrawElement());
            assert.equal(built.type, shape.type);
            assertPointsClose(built.points, shape.points);
            assert.equal(built.strokeColor, '#123456');
            assert.equal(built.strokeWidth, 3);
        });
        assert.equal(build(circle.toDrawElement()).fillColor, '#abcdef');
    });

    it('左右・上下・両方の裏返し・回転・傾きでも輪郭が一致する', () => {
        const transforms = {
            左右: { a: -1, b: 0, c: 0, d: 1, e: 100, f: 0 },
            上下: { a: 1, b: 0, c: 0, d: -1, e: 0, f: 100 },
            両方: { a: -1, b: 0, c: 0, d: -1, e: 100, f: 100 },
            回転90: { a: 0, b: 1, c: -1, d: 0, e: 100, f: 0 },
            回転180: { a: -1, b: 0, c: 0, d: -1, e: 100, f: 100 },
            回転30: { a: Math.cos(Math.PI / 6), b: Math.sin(Math.PI / 6), c: -Math.sin(Math.PI / 6), d: Math.cos(Math.PI / 6), e: 10, f: 5 },
            傾き: { a: 1, b: 0.3, c: 0.5, d: 1.2, e: 7, f: 3 },
        };
        ['circle', 'arc'].forEach((type) => {
            Object.entries(transforms).forEach(([name, transform]) => {
                const shape = new Ellipse(30, 40, 50, 55, type, '#000000', 2, null).createTransformed(transform);
                const element = shape.toDrawElement();
                const built = build(element);
                assert.equal(built.type, type, `${type}・${name}`);
                if (type === 'arc') {
                    assertPointsClose(outline(built, Math.PI, 2 * Math.PI), elementOutline(element));
                } else {
                    assertPointsClose(outline(built, 0, 2 * Math.PI), elementOutline(element));
                }
            });
        });
    });

    it('rotationが数値でなければ0として読む', () => {
        ['x', null, NaN, undefined].forEach((rotation) => {
            const data = DrawElementReader.toShapeData({ kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 3, rotation, startAngle: 0, endAngle: 2 * Math.PI, closed: true, strokeColor: '#000000', strokeWidth: 2 });
            assert.deepEqual(data.points.slice(0, 3), [P(0, 0), P(5, 0), P(0, -3)]);
        });
    });

    it('終了角が開始角より小さければ2πを足して読む（負の開き）', () => {
        const data = DrawElementReader.toShapeData({ kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 5, rotation: 0, startAngle: 2 * Math.PI, endAngle: Math.PI, closed: false, strokeColor: '#000000', strokeWidth: 2 });
        assert.equal(data.type, 'arc');
    });

    it('半径0でも変換できる', () => {
        const data = DrawElementReader.toShapeData({ kind: 'ellipse', x: 3, y: 4, radiusX: 0, radiusY: 0, rotation: 0, startAngle: 0, endAngle: 2 * Math.PI, closed: true });
        assert.deepEqual(data.points[0], P(3, 4));
        assert.doesNotThrow(() => ShapeFactory.fromJSON(data));
    });

    it('断る入力: 項目の不足・NaN・負の半径', () => {
        const ok = { kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 3, rotation: 0, startAngle: 0, endAngle: 2 * Math.PI, closed: true };
        ['x', 'y', 'radiusX', 'radiusY', 'startAngle', 'endAngle'].forEach((key) => {
            const missing = { ...ok };
            delete missing[key];
            assert.throws(() => DrawElementReader.toShapeData(missing), /DrawElementReader: /, `${key}が無い`);
            assert.throws(() => DrawElementReader.toShapeData({ ...ok, [key]: NaN }), /DrawElementReader: /, `${key}がNaN`);
            assert.throws(() => DrawElementReader.toShapeData({ ...ok, [key]: '1' }), /DrawElementReader: /, `${key}が文字列`);
        });
        assert.throws(() => DrawElementReader.toShapeData({ ...ok, radiusX: -1 }), /DrawElementReader: /);
        assert.throws(() => DrawElementReader.toShapeData({ ...ok, radiusY: -1 }), /DrawElementReader: /);
    });

    it('断る入力: 閉じた半周・開いた1周・4分の1周', () => {
        const ok = { kind: 'ellipse', x: 0, y: 0, radiusX: 5, radiusY: 3, rotation: 0 };
        assert.throws(() => DrawElementReader.toShapeData({ ...ok, startAngle: Math.PI, endAngle: 2 * Math.PI, closed: true }), /DrawElementReader: /);
        assert.throws(() => DrawElementReader.toShapeData({ ...ok, startAngle: 0, endAngle: 2 * Math.PI, closed: false }), /DrawElementReader: /);
        assert.throws(() => DrawElementReader.toShapeData({ ...ok, startAngle: 0, endAngle: Math.PI / 2, closed: false }), /DrawElementReader: /);
        assert.throws(() => DrawElementReader.toShapeData({ ...ok, startAngle: 0, endAngle: 4 * Math.PI, closed: true }), /DrawElementReader: /);
    });
});

describe('DrawElementReader.toShapeData: 共通', () => {
    it('オブジェクトでない入力・未知のkindはError（継承した名前を含む）', () => {
        [null, undefined, 5, 'x', [], true].forEach((value) => {
            assert.throws(() => DrawElementReader.toShapeData(value), /DrawElementReader: /);
        });
        ['circle', 'rect', 'toString', 'constructor', '__proto__', 'hasOwnProperty', '', undefined, 5].forEach((kind) => {
            assert.throws(() => DrawElementReader.toShapeData({ kind, points: [P(0, 0), P(1, 1)] }), /DrawElementReader: /);
        });
    });

    it('知らないキー（id・name・type）は読まず、図形データに持ち込まない', () => {
        const element = { kind: 'polyline', points: [P(0, 0), P(1, 1)], closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: null };
        const plain = DrawElementReader.toShapeData(element);
        const extra = DrawElementReader.toShapeData({ ...element, id: 'abc', name: '名前', type: 'rect', visible: false, locked: true });
        assert.deepEqual(extra, plain);
        ['id', 'name', 'visible', 'locked'].forEach((key) => assert.ok(!(key in extra)));
        assert.equal(extra.type, 'line');
    });

    it('toDrawElement()の戻り値からも変換できる（idの有無に依らない）', () => {
        const rect = new Rect(0, 0, 10, 6, '#112233', 3, '#445566');
        const element = rect.toDrawElement();
        const path = build(element);
        assert.equal(path.type, 'path');
        assert.equal(path.closed, true);
        assert.equal(path.fillColor, '#445566');
        assert.equal(path.points.length, 4);
        const withId = build({ ...element, id: 'x1' });
        assert.deepEqual(withId.points, path.points);
        assert.equal(withId.id, undefined);
        assert.equal(path.id, undefined);
    });

    it('引数を書き換えず、戻り値と引数が配列・点を共有しない', () => {
        const element = {
            kind: 'bezierPath',
            points: [P(0, 0), P(10, 0), P(10, 10)],
            closed: false,
            segments: [{ kind: 'line' }, { kind: 'cubic', control1: P(10, 3), control2: P(10, 7) }],
            strokeColor: '#000000',
            strokeWidth: 2,
            fillColor: null,
        };
        const snapshot = structuredClone(element);
        const data = DrawElementReader.toShapeData(element);
        assert.deepEqual(element, snapshot);
        assert.notEqual(data.points, element.points);
        assert.notEqual(data.points[0], element.points[0]);
        assert.notEqual(data.segments[1].control1, element.segments[1].control1);
        data.points[0].x = 99;
        data.segments[1].control1.x = 99;
        assert.deepEqual(element, snapshot);
    });

    it('警告を出さない', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        DrawElementReader.toShapeData({ kind: 'polyline', points: [P(0, 0), P(1, 1)] });
        assert.throws(() => DrawElementReader.toShapeData({ kind: 'nope' }));
        assert.equal(warn.mock.callCount(), 0);
    });
});
