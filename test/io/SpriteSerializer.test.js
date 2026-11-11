/**
 * 責務: SpriteSerializerが組み立てるスプライトデータ（描画要素・外枠・source・JSON文字列化）の中身を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteSerializer, DEFAULT_STROKE_WIDTH } from '../../js/io/SpriteSerializer.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 図形へ文字列のidを代入して返す。
 * @param {object} shape - 図形
 * @param {string} id - 代入するid
 * @returns {object} 同じ図形
 */
function withId(shape, id) {
    shape.id = id;
    return shape;
}

/**
 * 外枠の4値を許容誤差つきで比べる。
 * @param {object} actual - 実際の外枠
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} expected - 期待する外枠
 * @param {number} [tolerance=1e-9] - 許容誤差
 * @returns {void}
 */
function assertBoundsClose(actual, expected, tolerance = 1e-9) {
    assert.deepEqual(Object.keys(actual), ['minX', 'minY', 'maxX', 'maxY']);
    for (const key of ['minX', 'minY', 'maxX', 'maxY']) {
        assert.ok(Math.abs(actual[key] - expected[key]) <= tolerance, `${key}: ${actual[key]} != ${expected[key]}`);
    }
}

/**
 * 始点・制御点・終点を指定した曲線を作る。
 * @param {Array<{x: number, y: number}>} points - 3点
 * @returns {Curve} 曲線
 */
function makeCurve(points) {
    const curve = new Curve(0, 0, 1, 1);
    curve.points = points.map((p) => ({ ...p }));
    return curve;
}

describe('SpriteSerializer.serialize: 描画要素', () => {
    it('キーの順と識別子・版を持ち、最上位にversionを持たない', () => {
        const data = SpriteSerializer.serialize([withId(new Line(0, 0, 10, 10), 'a')]);
        assert.deepEqual(Object.keys(data), ['format', 'formatVersion', 'bounds', 'elements', 'source']);
        assert.equal(data.format, 'oz-vector-editor-sprite');
        assert.equal(data.formatVersion, 2);
        assert.equal('version' in data, false);
        assert.equal(data.source.version, 2);
        assert.equal(data.source.format, 'oz-vector-editor');
    });

    it('lineはpolyline（closed: false・2点）', () => {
        const line = withId(new Line(1, 2, 3, 4, '#ff0000', 5), 'L1');
        const [el] = SpriteSerializer.serialize([line]).elements;
        assert.deepEqual(Object.keys(el), ['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.deepEqual(el, {
            kind: 'polyline', id: 'L1', points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
            closed: false, strokeColor: '#ff0000', strokeWidth: 5, fillColor: null,
        });
    });

    it('rectはpolyline（closed: true・4点をpointsの並びのまま）', () => {
        const rect = withId(new Rect(10, 20, 50, 80, '#00ff00', 3), 'R1');
        const [el] = SpriteSerializer.serialize([rect]).elements;
        assert.equal(el.kind, 'polyline');
        assert.equal(el.id, 'R1');
        assert.equal(el.closed, true);
        assert.deepEqual(el.points, rect.points);
        assert.equal(el.points.length, 4);
        assert.equal(el.strokeColor, '#00ff00');
        assert.equal(el.strokeWidth, 3);
    });

    it('curveはquadratic（3点）', () => {
        const curve = withId(makeCurve([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }]), 'C1');
        const [el] = SpriteSerializer.serialize([curve]).elements;
        assert.deepEqual(Object.keys(el), ['kind', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.equal(el.kind, 'quadratic');
        assert.equal(el.id, 'C1');
        assert.deepEqual(el.points, [{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }]);
    });

    it('circleはellipse（0〜2π・closed: true）', () => {
        const circle = withId(new Ellipse(10, 20, 40, 60, 'circle', '#123456', 4), 'E1');
        const [el] = SpriteSerializer.serialize([circle]).elements;
        assert.deepEqual(Object.keys(el), [
            'kind', 'id', 'x', 'y', 'radiusX', 'radiusY', 'startAngle', 'endAngle', 'closed', 'strokeColor', 'strokeWidth', 'fillColor',
        ]);
        assert.equal(el.kind, 'ellipse');
        assert.equal(el.x, 10);
        assert.equal(el.y, 20);
        assert.equal(el.radiusX, 30);
        assert.equal(el.radiusY, 40);
        assert.equal(el.startAngle, 0);
        assert.equal(el.endAngle, 2 * Math.PI);
        assert.equal(el.closed, true);
        assert.equal(el.strokeColor, '#123456');
        assert.equal(el.strokeWidth, 4);
    });

    it('arcはellipse（π〜2π・closed: false）', () => {
        const arc = withId(new Ellipse(10, 20, 40, 60, 'arc'), 'E2');
        const [el] = SpriteSerializer.serialize([arc]).elements;
        assert.equal(el.kind, 'ellipse');
        assert.equal(el.startAngle, Math.PI);
        assert.equal(el.endAngle, 2 * Math.PI);
        assert.equal(el.closed, false);
    });

    it('頂点を動かした図形の位置が描画要素へ反映され、描画順が保たれる', () => {
        const line = withId(new Line(0, 0, 10, 10), 'first');
        const rect = withId(new Rect(0, 0, 5, 5), 'second');
        line.translate(3, 4);
        const data = SpriteSerializer.serialize([line, rect]);
        assert.deepEqual(data.elements.map((e) => e.id), ['first', 'second']);
        assert.deepEqual(data.elements[0].points, [{ x: 3, y: 4 }, { x: 13, y: 14 }]);
    });
});

describe('SpriteSerializer.serialize: 外枠', () => {
    it('図形0個は elements: []・bounds: null・sourceは図形0個の作業データ', () => {
        const data = SpriteSerializer.serialize([]);
        assert.deepEqual(data.elements, []);
        assert.equal(data.bounds, null);
        assert.deepEqual(data.source, { format: 'oz-vector-editor', version: 2, shapes: [] });
    });

    it('線は線の太さの半分だけ広がる', () => {
        const data = SpriteSerializer.serialize([new Line(10, 20, 30, 5, '#000000', 4)]);
        assertBoundsClose(data.bounds, { minX: 8, minY: 3, maxX: 32, maxY: 22 });
    });

    it('曲線は制御点ではなく極値を使う', () => {
        const curve = makeCurve([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }]);
        const data = SpriteSerializer.serialize([curve]);
        assertBoundsClose(data.bounds, { minX: -1, minY: -1, maxX: 101, maxY: 51 });
    });

    it('円は全周', () => {
        const data = SpriteSerializer.serialize([new Ellipse(10, 20, 40, 60, 'circle')]);
        assertBoundsClose(data.bounds, { minX: -21, minY: -21, maxX: 41, maxY: 61 });
    });

    it('弧は上半分（maxYは中心線の高さ＋太さの半分）', () => {
        const data = SpriteSerializer.serialize([new Ellipse(10, 20, 40, 60, 'arc')]);
        assertBoundsClose(data.bounds, { minX: -21, minY: -21, maxX: 41, maxY: 21 });
    });

    it('複数の図形は和を取る', () => {
        const data = SpriteSerializer.serialize([
            new Line(0, 0, 10, 10, '#000000', 2),
            new Rect(-20, 5, 30, 40, '#000000', 6),
        ]);
        assertBoundsClose(data.bounds, { minX: -23, minY: -1, maxX: 33, maxY: 43 });
    });

    it('strokeWidthがundefinedの要素は2pxで外枠を求める', () => {
        const line = new Line(0, 0, 10, 10);
        line.strokeWidth = undefined;
        const data = SpriteSerializer.serialize([line]);
        assert.equal(DEFAULT_STROKE_WIDTH, 2);
        assertBoundsClose(data.bounds, { minX: -1, minY: -1, maxX: 11, maxY: 11 });
    });

    it('未知のkindの描画要素はErrorをthrowする', () => {
        const fake = { toDrawElement: () => ({ kind: 'unknown', strokeWidth: 2 }), toJSON: () => ({}) };
        assert.throws(() => SpriteSerializer.serialize([fake]), Error);
    });
});

describe('SpriteSerializer: source・JSON・独立性', () => {
    it('sourceはDocumentSerializer.deserializeで元の図形に戻る', () => {
        const shapes = [
            withId(new Line(0, 0, 10, 10, '#111111', 3), 's1'),
            withId(new Rect(1, 2, 30, 40), 's2'),
            withId(new Ellipse(5, 5, 20, 30, 'arc'), 's3'),
        ];
        const data = SpriteSerializer.serialize(shapes);
        const result = DocumentSerializer.deserialize(data.source);
        assert.equal(result.ok, true);
        assert.deepEqual(result.shapes.map((s) => s.toJSON()), shapes.map((s) => s.toJSON()));
        assert.deepEqual(data.source, DocumentSerializer.serialize(shapes));
    });

    it('stringifyの結果をJSON.parseするとserializeの結果と同じ（字下げ2）', () => {
        const data = SpriteSerializer.serialize([withId(new Line(0, 0, 10, 10), 'a'), withId(new Ellipse(0, 0, 5, 5), 'b')]);
        const text = SpriteSerializer.stringify(data);
        assert.deepEqual(JSON.parse(text), data);
        assert.equal(text, JSON.stringify(data, null, 2));
        assert.ok(text.startsWith('{\n  "format"'));
    });

    it('戻り値を書き換えても図形は変わらず、引数も書き換えない', () => {
        const rect = withId(new Rect(0, 0, 10, 10), 'r');
        const line = withId(new Line(0, 0, 10, 10), 'l');
        const curve = withId(makeCurve([{ x: 0, y: 0 }, { x: 5, y: 9 }, { x: 10, y: 0 }]), 'c');
        const shapes = [rect, line, curve];
        const before = shapes.map((s) => JSON.stringify(s.toJSON()));
        const data = SpriteSerializer.serialize(shapes);
        for (const el of data.elements) {
            if (el.points) {
                el.points.push({ x: 999, y: 999 });
                el.points[0].x = 999;
            }
            el.strokeColor = '#ffffff';
        }
        data.source.shapes[0].points[0].x = 999;
        assert.deepEqual(shapes.map((s) => JSON.stringify(s.toJSON())), before);
        assert.equal(shapes.length, 3);
        assert.deepEqual(shapes, [rect, line, curve]);
    });
});

describe('SpriteSerializer.checkFormat', () => {
    /**
     * checkFormatのテストで使う、IDつきの図形2個（矩形と線）を作る。
     * @returns {Array<object>} 図形の配列
     */
    const sampleShapes = () => [withId(new Rect(0, 0, 10, 10), 'r1'), withId(new Line(0, 0, 5, 5), 'l1')];

    it('serializeの戻り値とそのJSONのJSON.parseは supported（図形0個も）', () => {
        for (const shapes of [sampleShapes(), []]) {
            const data = SpriteSerializer.serialize(shapes);
            assert.equal(SpriteSerializer.checkFormat(data), 'supported');
            assert.equal(SpriteSerializer.checkFormat(JSON.parse(SpriteSerializer.stringify(data))), 'supported');
        }
    });

    it('プレーンなオブジェクトでない値・作業データ・他のformatは notSprite', () => {
        const work = DocumentSerializer.serialize(sampleShapes());
        const cases = [null, undefined, [], [1, 2], 'text', 42, true, work, { format: 'other', formatVersion: 1 }, {}];
        for (const value of cases) {
            assert.equal(SpriteSerializer.checkFormat(value), 'notSprite');
        }
    });

    it('formatVersionが範囲外・整数でない・キーが無い場合は unsupportedVersion', () => {
        const base = SpriteSerializer.serialize([]);
        const current = base.formatVersion;
        for (const formatVersion of [0, current + 1, 1.5, '1', -1, null, NaN]) {
            assert.equal(SpriteSerializer.checkFormat({ ...base, formatVersion }), 'unsupportedVersion');
        }
        const noVersion = { ...base };
        delete noVersion.formatVersion;
        assert.equal(SpriteSerializer.checkFormat(noVersion), 'unsupportedVersion');
    });

    it('bounds・elements・sourceの形は見ず、例外を投げない', () => {
        const base = SpriteSerializer.serialize([]);
        assert.equal(SpriteSerializer.checkFormat({ format: base.format, formatVersion: base.formatVersion }), 'supported');
        const weird = [Object.create(null), () => {}, Symbol('x'), 10n];
        for (const value of weird) {
            assert.doesNotThrow(() => SpriteSerializer.checkFormat(value));
        }
    });
});

/**
 * 頂点(0,0)・(100,0)・(100,100)・(0,100)のパスを作り、idを代入して返す。
 * @param {boolean} closed - 閉じたパスか
 * @param {string} id - 代入するid
 * @param {string} [strokeColor='#123456'] - 線の色
 * @param {number} [strokeWidth=4] - 線の太さ
 * @returns {Path} パス
 */
function makeSquarePath(closed, id, strokeColor = '#123456', strokeWidth = 4) {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    return withId(new Path(points, closed, strokeColor, strokeWidth), id);
}

describe('SpriteSerializer.serialize: パス', () => {
    it('開いたパスはpolyline（closed: false・segmentsなし・キー順）', () => {
        const [el] = SpriteSerializer.serialize([makeSquarePath(false, 'P1')]).elements;
        assert.deepEqual(Object.keys(el), ['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.deepEqual(el, {
            kind: 'polyline', id: 'P1',
            points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            closed: false, strokeColor: '#123456', strokeWidth: 4, fillColor: null,
        });
        assert.equal('segments' in el, false);
    });

    it('閉じたパスはclosed: true・頂点n個（始点を重複させない）', () => {
        const [el] = SpriteSerializer.serialize([makeSquarePath(true, 'P2')]).elements;
        assert.equal(el.kind, 'polyline');
        assert.equal(el.closed, true);
        assert.equal(el.points.length, 4);
        assert.deepEqual(el.points[0], { x: 0, y: 0 });
        assert.equal('segments' in el, false);
    });

    it('開いたパス・閉じたパスの外枠は全頂点の最小・最大を線の太さの半分だけ広げた値', () => {
        const open = SpriteSerializer.serialize([makeSquarePath(false, 'a')]);
        const closed = SpriteSerializer.serialize([makeSquarePath(true, 'b')]);
        assertBoundsClose(open.bounds, { minX: -2, minY: -2, maxX: 102, maxY: 102 });
        assertBoundsClose(closed.bounds, { minX: -2, minY: -2, maxX: 102, maxY: 102 });
    });

    it('パスと他の図形の混在は描画順を保ち、外枠は和を取る', () => {
        const shapes = [
            withId(new Line(-30, 10, -10, 20, '#000000', 2), 'L'),
            makeSquarePath(true, 'P'),
            withId(new Rect(50, 50, 200, 120, '#000000', 6), 'R'),
        ];
        const data = SpriteSerializer.serialize(shapes);
        assert.deepEqual(data.elements.map((el) => el.id), ['L', 'P', 'R']);
        assert.deepEqual(data.elements.map((el) => el.kind), ['polyline', 'polyline', 'polyline']);
        assertBoundsClose(data.bounds, { minX: -31, minY: -2, maxX: 203, maxY: 123 });
    });

    it('sourceはDocumentSerializer.deserializeでclosed・segmentsを含めて元のパスに戻る', () => {
        const shapes = [makeSquarePath(false, 's1'), makeSquarePath(true, 's2', '#abcdef', 7), withId(new Line(0, 0, 5, 5), 's3')];
        const data = SpriteSerializer.serialize(shapes);
        const result = DocumentSerializer.deserialize(data.source);
        assert.equal(result.ok, true);
        assert.deepEqual(result.shapes.map((s) => s.toJSON()), shapes.map((s) => s.toJSON()));
        assert.ok(result.shapes[0] instanceof Path);
        assert.equal(result.shapes[0].closed, false);
        assert.equal(result.shapes[1].closed, true);
        assert.deepEqual(result.shapes[0].segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        assert.deepEqual(result.shapes[1].segments.length, 4);
    });
});

/**
 * 塗れる形・塗れない形を含む、fillColorを持つ図形の一覧を作る。
 * @returns {Array<object>} 図形の配列（id: rect, circle, closedPath, line, curve, arc, openPath）
 */
function makeFilledShapes() {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
    return [
        withId(new Rect(0, 0, 10, 10, '#000000', 2, '#ff0000'), 'rect'),
        withId(new Ellipse(0, 0, 10, 10, 'circle', '#000000', 2, '#00ff00'), 'circle'),
        withId(new Path(points, true, '#000000', 2, '#0000ff'), 'closedPath'),
        withId(new Line(0, 0, 10, 10, '#000000', 2, '#111111'), 'line'),
        withId(new Curve(0, 0, 10, 10, '#000000', 2, '#222222'), 'curve'),
        withId(new Ellipse(0, 0, 10, 10, 'arc', '#000000', 2, '#333333'), 'arc'),
        withId(new Path(points, false, '#000000', 2, '#444444'), 'openPath'),
    ];
}

describe('SpriteSerializer.serialize: 版2のfillColor', () => {
    it('描画要素のfillColorは塗れる形が図形の値、塗れない形はnull（最後のキー）', () => {
        const data = SpriteSerializer.serialize(makeFilledShapes());
        const fills = Object.fromEntries(data.elements.map((el) => [el.id, el.fillColor]));
        assert.deepEqual(fills, {
            rect: '#ff0000', circle: '#00ff00', closedPath: '#0000ff',
            line: null, curve: null, arc: null, openPath: null,
        });
        for (const el of data.elements) {
            const keys = Object.keys(el);
            assert.equal(keys[keys.length - 1], 'fillColor');
        }
    });

    it('sourceの図形データには塗れない形のfillColorも残る', () => {
        const data = SpriteSerializer.serialize(makeFilledShapes());
        const fills = Object.fromEntries(data.source.shapes.map((s) => [s.id, s.fillColor]));
        assert.deepEqual(fills, {
            rect: '#ff0000', circle: '#00ff00', closedPath: '#0000ff',
            line: '#111111', curve: '#222222', arc: '#333333', openPath: '#444444',
        });
    });

    it('checkFormatは formatVersion: 1 を supported とする', () => {
        const base = SpriteSerializer.serialize([]);
        assert.equal(SpriteSerializer.checkFormat({ ...base, formatVersion: 1 }), 'supported');
    });
});

describe('SpriteSerializer.serialize: 線なしの外枠', () => {
    it('strokeColor: null の各図形は形の範囲のまま広げない', () => {
        const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];
        const cases = [
            [new Line(10, 20, 30, 5, null, 8), { minX: 10, minY: 5, maxX: 30, maxY: 20 }],
            [new Rect(10, 20, 30, 50, null, 8, '#ff0000'), { minX: 10, minY: 20, maxX: 30, maxY: 50 }],
            [new Path(points, true, null, 8, '#ff0000'), { minX: 0, minY: 0, maxX: 100, maxY: 100 }],
            [new Path(points, false, null, 8), { minX: 0, minY: 0, maxX: 100, maxY: 100 }],
        ];
        for (const [shape, expected] of cases) {
            assertBoundsClose(SpriteSerializer.serialize([shape]).bounds, expected);
        }
        const circleBounds = SpriteSerializer.serialize([new Ellipse(0, 0, 20, 10, 'circle', null, 8, '#ff0000')]).bounds;
        const circleStroke = SpriteSerializer.serialize([new Ellipse(0, 0, 20, 10, 'circle', '#000000', 8, '#ff0000')]).bounds;
        assertBoundsClose(circleBounds, {
            minX: circleStroke.minX + 4, minY: circleStroke.minY + 4, maxX: circleStroke.maxX - 4, maxY: circleStroke.maxY - 4,
        });
        const curve = new Curve(0, 0, 100, 0, null, 8);
        const curveBounds = SpriteSerializer.serialize([curve]).bounds;
        const withStroke = SpriteSerializer.serialize([new Curve(0, 0, 100, 0, '#000000', 8)]).bounds;
        assertBoundsClose(curveBounds, {
            minX: withStroke.minX + 4, minY: withStroke.minY + 4, maxX: withStroke.maxX - 4, maxY: withStroke.maxY - 4,
        });
        const arcBounds = SpriteSerializer.serialize([new Ellipse(0, 0, 20, 10, 'arc', null, 8)]).bounds;
        const arcStroke = SpriteSerializer.serialize([new Ellipse(0, 0, 20, 10, 'arc', '#000000', 8)]).bounds;
        assertBoundsClose(arcBounds, {
            minX: arcStroke.minX + 4, minY: arcStroke.minY + 4, maxX: arcStroke.maxX - 4, maxY: arcStroke.maxY - 4,
        });
    });

    it('線ありは従来どおり広がる', () => {
        const data = SpriteSerializer.serialize([new Rect(10, 20, 30, 50, '#000000', 8, '#ff0000')]);
        assertBoundsClose(data.bounds, { minX: 6, minY: 16, maxX: 34, maxY: 54 });
    });

    it('線なしと線ありの混在は和を取り、線なしで塗れない要素も含める', () => {
        const data = SpriteSerializer.serialize([
            new Line(-50, -50, -40, -40, null, 10),
            new Rect(0, 0, 10, 10, '#000000', 4, '#ff0000'),
        ]);
        assertBoundsClose(data.bounds, { minX: -50, minY: -50, maxX: 12, maxY: 12 });
    });
});
