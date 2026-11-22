/**
 * 責務: SpriteSerializerが組み立てるスプライトデータ（描画要素・外枠・source・JSON文字列化）の中身を、公開APIのみを通して検証する。
 * 拡大縮小（createTransformed）した全図形の種類の書き出し（描画要素・外枠）も含む。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpriteSerializer, DEFAULT_STROKE_WIDTH } from '../../js/io/SpriteSerializer.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { cubicBezierPoint } from '../../js/shapes/ShapeGeometry.js';
import { SegmentKindSwitch, planSegmentKindSwitch } from '../../js/shapes/PathSegmentKindRules.js';
import { planJoin } from '../../js/shapes/PathJoinRules.js';

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
        assert.equal(data.formatVersion, 3);
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
            'kind', 'id', 'x', 'y', 'radiusX', 'radiusY', 'rotation', 'startAngle', 'endAngle', 'closed', 'strokeColor', 'strokeWidth', 'fillColor',
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

describe('SpriteSerializer.computeShapesBounds', () => {
    it('各種の図形（線あり・線なし・弧・曲線・パス・複数）でserialize(shapes).boundsと同じ値', () => {
        const caseList = [
            [withId(new Line(10, 20, 30, 5, '#000000', 8), 'a')],
            [withId(new Line(10, 20, 30, 5, null, 8), 'b')],
            [withId(new Ellipse(0, 0, 20, 10, 'arc', '#000000', 4), 'c')],
            [withId(new Ellipse(0, 0, 20, 10, 'circle', null, 4, '#ff0000'), 'd')],
            [makeCurve([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }])],
            [makeSquarePath(true, 'e'), makeSquarePath(false, 'f', null)],
            makeFilledShapes(),
        ];
        for (const shapes of caseList) {
            assert.deepEqual(SpriteSerializer.computeShapesBounds(shapes), SpriteSerializer.serialize(shapes).bounds);
        }
    });

    it('図形0個でnull', () => {
        assert.equal(SpriteSerializer.computeShapesBounds([]), null);
    });

    it('引数の配列と図形を書き換えない', () => {
        const shapes = makeFilledShapes();
        const shapesBefore = [...shapes];
        const jsonBefore = shapes.map((shape) => shape.toJSON());
        SpriteSerializer.computeShapesBounds(shapes);
        assert.equal(shapes.length, shapesBefore.length);
        shapes.forEach((shape, i) => assert.equal(shape, shapesBefore[i]));
        assert.deepEqual(shapes.map((shape) => shape.toJSON()), jsonBefore);
    });
});

/**
 * 曲線の区間だけのパスを作る（idつき）。
 * @param {Array<{x: number, y: number}>} points - 頂点
 * @param {boolean} closed - 閉じるか
 * @param {string|null} [strokeColor='#000000'] - 線の色
 * @param {number} [strokeWidth=2] - 線の太さ
 * @param {string|null} [fillColor=null] - 塗りの色
 * @returns {Path} 曲線のパス
 */
function makeSmoothPathShape(points, closed, strokeColor = '#000000', strokeWidth = 2, fillColor = null) {
    return withId(new Path(points, closed, strokeColor, strokeWidth, fillColor, SEGMENT_KIND_SMOOTH), 'sp');
}

/**
 * 描画要素の区間を細かくサンプリングして外接矩形を求める（形の範囲の検算用）。
 * @param {object} element - `bezierPath`の描画要素
 * @returns {{minX: number, minY: number, maxX: number, maxY: number}} 外接矩形
 */
function sampleBezierPathRange(element) {
    const { points, segments } = element;
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    segments.forEach((segment, i) => {
        if (segment.kind !== 'cubic') {
            return;
        }
        const a = points[i];
        const b = points[(i + 1) % points.length];
        for (let k = 0; k <= 2000; k++) {
            const p = cubicBezierPoint(a, segment.control1, segment.control2, b, k / 2000);
            xs.push(p.x);
            ys.push(p.y);
        }
    });
    return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

describe('SpriteSerializer: 版3・bezierPath', () => {
    const openPoints = [{ x: 0, y: 0 }, { x: 50, y: 80 }, { x: 100, y: 0 }, { x: 150, y: 60 }];

    it('曲線のパスは bezierPath の形・キー順で、区間がすべて直線のパスは polyline', () => {
        const open = SpriteSerializer.serialize([makeSmoothPathShape(openPoints, false)]).elements[0];
        assert.equal(open.kind, 'bezierPath');
        assert.deepEqual(Object.keys(open), ['kind', 'id', 'points', 'closed', 'segments', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.equal(open.segments.length, 3);
        assert.deepEqual(Object.keys(open.segments[0]), ['kind', 'control1', 'control2']);
        assert.equal(open.segments[0].kind, 'cubic');
        assert.equal(open.fillColor, null);

        const closed = SpriteSerializer.serialize([makeSmoothPathShape(openPoints, true, '#000000', 2, '#ff0000')]).elements[0];
        assert.equal(closed.kind, 'bezierPath');
        assert.equal(closed.segments.length, 4);
        assert.equal(closed.fillColor, '#ff0000');

        const line = SpriteSerializer.serialize([makeSquarePath(true, 'e')]).elements[0];
        assert.equal(line.kind, 'polyline');
    });

    it('直線と曲線が混在するパスの区間は line と cubic', () => {
        const path = makeSmoothPathShape(openPoints, false);
        path.segments[1] = { kind: 'line' };
        const element = SpriteSerializer.serialize([path]).elements[0];
        assert.deepEqual(element.segments.map((s) => s.kind), ['cubic', 'line', 'cubic']);
        assert.deepEqual(Object.keys(element.segments[1]), ['kind']);
    });

    it('区間の種類の配列で作った直線と曲線が混ざる開いたパス: 区間・制御点・外枠（Phase 09-01b）', () => {
        const points = [{ x: 0, y: 0 }, { x: 40, y: 60 }, { x: 80, y: 0 }, { x: 120, y: 70 }, { x: 160, y: 10 }];
        const path = withId(new Path(points, false, null, 2, null, ['line', 'smooth', 'smooth', 'line']), 'mx');
        const data = SpriteSerializer.serialize([path]);
        const element = data.elements[0];
        assert.equal(element.kind, 'bezierPath');
        assert.deepEqual(element.segments.map((s) => s.kind), ['line', 'cubic', 'cubic', 'line']);
        const expected = path.toDrawElement();
        assert.deepEqual(element.segments, expected.segments);
        assert.deepEqual(element.points, expected.points);
        assertBoundsClose(data.bounds, sampleBezierPathRange(element), 1e-3);
    });

    it('外枠は曲線の膨らみ（極値）を含み、制御点を含まない', () => {
        for (const closed of [false, true]) {
            const shape = makeSmoothPathShape(openPoints, closed, null);
            const data = SpriteSerializer.serialize([shape]);
            const expected = sampleBezierPathRange(data.elements[0]);
            assertBoundsClose(data.bounds, expected, 1e-3);
            const vertexXs = openPoints.map((p) => p.x);
            const vertexYs = openPoints.map((p) => p.y);
            const hasBulge = data.bounds.minX < Math.min(...vertexXs) || data.bounds.maxX > Math.max(...vertexXs)
                || data.bounds.minY < Math.min(...vertexYs) || data.bounds.maxY > Math.max(...vertexYs);
            assert.ok(hasBulge);
            const controls = data.elements[0].segments.flatMap((s) => [s.control1, s.control2]);
            const controlMaxY = Math.max(...controls.map((c) => c.y));
            assert.ok(data.bounds.maxY <= controlMaxY + 1e-9);
        }
    });

    it('線の太さの半分だけ広げ、線なしなら広げない', () => {
        const noStroke = SpriteSerializer.serialize([makeSmoothPathShape(openPoints, false, null)]).bounds;
        const stroke = SpriteSerializer.serialize([makeSmoothPathShape(openPoints, false, '#000000', 10)]).bounds;
        assertBoundsClose(stroke, {
            minX: noStroke.minX - 5, minY: noStroke.minY - 5, maxX: noStroke.maxX + 5, maxY: noStroke.maxY + 5,
        });
    });

    it('3次ベジェの極値: 手計算の例（y軸がp0=0,c1=40,c2=40,p3=0の山なりの形）', () => {
        const element = {
            kind: 'bezierPath',
            id: 'x',
            points: [{ x: 0, y: 0 }, { x: 30, y: 0 }],
            closed: false,
            segments: [{ kind: 'cubic', control1: { x: 0, y: 40 }, control2: { x: 30, y: 40 } }],
            strokeColor: null,
            strokeWidth: 2,
            fillColor: null,
        };
        const shape = { toDrawElement: () => element };
        const bounds = SpriteSerializer.computeShapesBounds([shape]);
        // y(t) = 3(1-t)^2 t*40 + 3(1-t) t^2*40 = 120 t (1-t) → t=0.5 で最大 30
        assertBoundsClose(bounds, { minX: 0, minY: 0, maxX: 30, maxY: 30 });
    });

    it('computeShapesBounds は serialize(shapes).bounds と同じ値', () => {
        const shapes = [makeSmoothPathShape(openPoints, true, '#000000', 6), makeSquarePath(true, 'e')];
        assert.deepEqual(SpriteSerializer.computeShapesBounds(shapes), SpriteSerializer.serialize(shapes).bounds);
    });

    it('checkFormat は版3・2・1を supported、4を unsupportedVersion とする', () => {
        const base = SpriteSerializer.serialize([]);
        assert.equal(base.formatVersion, 3);
        for (const formatVersion of [3, 2, 1]) {
            assert.equal(SpriteSerializer.checkFormat({ ...base, formatVersion }), 'supported');
        }
        assert.equal(SpriteSerializer.checkFormat({ ...base, formatVersion: 4 }), 'unsupportedVersion');
    });
});

describe('SpriteSerializer: 角の点を含むパスの bezierPath（Phase 09-02a）', () => {
    const points = [{ x: 0, y: 0 }, { x: 50, y: 80 }, { x: 100, y: 0 }, { x: 150, y: 60 }];

    for (const closed of [false, true]) {
        it(`${closed ? '閉じた' : '開いた'}パス: 制御点は角なしと違い toDrawElement と一致し、外枠が形を囲む`, () => {
            const plain = withId(new Path(points, closed, null, 2, null, SEGMENT_KIND_SMOOTH), 'pl');
            const cornered = withId(new Path(points, closed, null, 2, null, SEGMENT_KIND_SMOOTH, [false, true, true, false]), 'co');
            const data = SpriteSerializer.serialize([cornered]);
            const element = data.elements[0];
            assert.equal(element.kind, 'bezierPath');
            const expected = cornered.toDrawElement();
            assert.deepEqual(element.segments, expected.segments);
            assert.deepEqual(element.points, expected.points);
            assert.notDeepEqual(element.segments, SpriteSerializer.serialize([plain]).elements[0].segments);
            assertBoundsClose(data.bounds, sampleBezierPathRange(element), 1e-3);
        });
    }
});

describe('SpriteSerializer: 区間の切り替えで作った図形（Phase 09-02b）', () => {
    /**
     * 頂点番号の一覧の点を選んだ対象の並びにする。
     * @param {object} shape - 図形
     * @param {number[]} indexes - 頂点の番号
     * @returns {{shape: object, vertexIndex: number}[]} 切り替えの対象
     */
    const targetsOf = (shape, indexes) => indexes.map((vertexIndex) => ({ shape, vertexIndex }));

    /**
     * 切り替えた新しい図形（1つ）へidを付けて返す。
     * @param {object} source - 元の図形
     * @param {number[]} indexes - 選ぶ頂点の番号
     * @param {string} operation - 切り替えの操作
     * @returns {object} 切り替えた新しい図形
     */
    const switched = (source, indexes, operation) => {
        withId(source, 'src');
        const plan = planSegmentKindSwitch(targetsOf(source, indexes), operation);
        assert.equal(plan.length, 1);
        return withId(plan[0].shape, 'sw');
    };

    const points = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 60 }, { x: 120, y: 120 }];

    for (const closed of [false, true]) {
        it(`${closed ? '閉じた' : '開いた'}パスの「曲線に」: bezierPath の要素が toDrawElement と一致し、外枠が形を囲む`, () => {
            const source = new Path(points, closed, '#102030', 4, closed ? '#ffcc00' : null);
            const path = switched(source, closed ? [3, 0, 1] : [0, 1, 2], SegmentKindSwitch.TO_CURVE);
            const data = SpriteSerializer.serialize([path]);
            const element = data.elements[0];
            assert.equal(element.kind, 'bezierPath');
            assert.equal(element.points.length, points.length + 2);
            assert.equal(element.segments.length, closed ? element.points.length : element.points.length - 1);
            const expected = path.toDrawElement();
            assert.deepEqual(element.segments, expected.segments);
            assert.deepEqual(element.points, expected.points);
            assert.ok(element.segments.some((s) => s.kind === 'cubic'));
            if (closed) {
                assert.equal(element.fillColor, '#ffcc00');
            }
            const range = sampleBezierPathRange(element);
            const half = 2;
            assertBoundsClose(data.bounds, {
                minX: range.minX - half, minY: range.minY - half, maxX: range.maxX + half, maxY: range.maxY + half,
            }, 1e-3);
        });
    }

    it('単独の直線を「曲線に」した直後の外枠は、元の直線の外枠と同じ', () => {
        const line = withId(new Line(0, 0, 30, 60, '#102030', 4), 'ln');
        const before = SpriteSerializer.serialize([line]).bounds;
        const path = switched(line, [0, 1], SegmentKindSwitch.TO_CURVE);
        const data = SpriteSerializer.serialize([path]);
        assert.equal(data.elements[0].kind, 'bezierPath');
        assertBoundsClose(data.bounds, before, 1e-9);
        for (const segment of data.elements[0].segments) {
            assert.equal(segment.kind, 'cubic');
        }
    });

    it('今の曲線を「直線に」した結果は polyline', () => {
        const curve = makeCurve([{ x: 0, y: 0 }, { x: 30, y: 60 }, { x: 90, y: 30 }]);
        const line = switched(curve, [0, 2], SegmentKindSwitch.TO_LINE);
        const element = SpriteSerializer.serialize([line]).elements[0];
        assert.equal(element.kind, 'polyline');
        assert.deepEqual(element.points, [{ x: 0, y: 0 }, { x: 90, y: 30 }]);
    });

    it('書き出し形式の版は3のまま', () => {
        const path = switched(new Path(points, false), [0, 1], SegmentKindSwitch.TO_CURVE);
        assert.equal(SpriteSerializer.serialize([path]).formatVersion, 3);
    });
});

describe('SpriteSerializer: 曲がり方を持つ区間を含むパス（Phase 09-03a）', () => {
    const control1 = { x: 10, y: 50 };
    const control2 = { x: 70, y: -20 };
    const points = [{ x: 0, y: 0 }, { x: 80, y: 30 }, { x: 140, y: 0 }];

    it('bezierPath の区間の cubic の control1・control2 が作業データの引っ張る点と一致し、版は3', () => {
        const path = withId(new Path(points, false, '#102030', 2, null, [{ kind: 'bezier', control1, control2 }, 'line']), 'bz');
        const data = SpriteSerializer.serialize([path]);
        assert.equal(data.formatVersion, 3);
        const element = data.elements[0];
        assert.equal(element.kind, 'bezierPath');
        assert.deepEqual(element.segments.map((s) => s.kind), ['cubic', 'line']);
        assert.deepEqual(element.segments[0].control1, path.toJSON().segments[0].control1);
        assert.deepEqual(element.segments[0].control2, path.toJSON().segments[0].control2);
        assert.deepEqual(element.segments[0].control1, control1);
        assert.deepEqual(element.segments[0].control2, control2);
        assert.deepEqual(element.segments, path.toDrawElement().segments);
    });

    it('曲がり方を持つ区間1つの開いたパスの外枠は、同じ形の今の曲線（quadratic）の外枠と一致する', () => {
        const curve = withId(makeCurve([{ x: 0, y: 0 }, { x: 30, y: 60 }, { x: 60, y: 0 }]), 'cv');
        const quadratic = SpriteSerializer.serialize([curve]);
        assert.equal(quadratic.elements[0].kind, 'quadratic');
        // 2次→3次: control1 = s + (c - s) * 2 / 3、control2 = e + (c - e) * 2 / 3
        const path = withId(new Path(
            [{ x: 0, y: 0 }, { x: 60, y: 0 }], false, '#000000', 2, null,
            [{ kind: 'bezier', control1: { x: 20, y: 40 }, control2: { x: 40, y: 40 } }],
        ), 'bp');
        const data = SpriteSerializer.serialize([path]);
        assert.equal(data.elements[0].kind, 'bezierPath');
        assertBoundsClose(data.bounds, quadratic.bounds, 1e-6);
    });

    it('今の曲線と直線を結合した結果の外枠は形を囲む', () => {
        const curve = withId(makeCurve([{ x: 0, y: 0 }, { x: 30, y: 60 }, { x: 60, y: 0 }]), 'cv');
        const line = withId(new Line(60, 0, 100, -20, '#000000', 2), 'ln');
        const plan = planJoin([curve, line], 0);
        assert.notEqual(plan, null);
        const joined = withId(plan.path, 'jn');
        const data = SpriteSerializer.serialize([joined]);
        const element = data.elements[0];
        assert.equal(element.kind, 'bezierPath');
        assert.deepEqual(element.segments.map((s) => s.kind), ['cubic', 'line']);
        const range = sampleBezierPathRange(element);
        const half = 1;
        assertBoundsClose(data.bounds, {
            minX: range.minX - half, minY: range.minY - half, maxX: range.maxX + half, maxY: range.maxY + half,
        }, 1e-3);
        // 曲線の山（y=30）を含む
        assert.ok(data.bounds.maxY >= 30);
    });
});

describe('SpriteSerializer: 弧を結合した結果（Phase 09-03b）', () => {
    /**
     * 弧（中心(100,200)・横の半径60・縦の半径30。左端(40,200)・右端(160,200)）と別の線を`planJoin`で結合した結果のパスを作る。
     * @param {object} other - 弧と結合するもう1本の図形
     * @param {string} id - 結果のパスに付けるid
     * @param {string|null} [arcFill=null] - 弧の塗りの色
     * @returns {Path} 結合した結果のパス
     */
    function joinArc(other, id, arcFill = null) {
        const arc = withId(new Ellipse(100, 200, 160, 230, 'arc', '#102030', 4, arcFill), 'arc');
        const plan = planJoin([arc, withId(other, 'other')], 0);
        assert.notEqual(plan, null);
        return withId(plan.path, id);
    }

    it('bezierPath の区間は cubic・cubic・line で、引っ張る点が作業データと一致し、版は3・外枠は形を囲む', () => {
        const path = joinArc(new Line(160, 200, 220, 260, '#102030', 4), 'jn');
        const data = SpriteSerializer.serialize([path]);
        assert.equal(data.formatVersion, 3);
        const element = data.elements[0];
        assert.equal(element.kind, 'bezierPath');
        assert.deepEqual(element.segments.map((s) => s.kind), ['cubic', 'cubic', 'line']);
        const source = path.toJSON().segments;
        assert.deepEqual(element.segments[0].control1, source[0].control1);
        assert.deepEqual(element.segments[0].control2, source[0].control2);
        assert.deepEqual(element.segments[1].control1, source[1].control1);
        assert.deepEqual(element.segments[1].control2, source[1].control2);
        assert.deepEqual(element.segments, path.toDrawElement().segments);
        const range = sampleBezierPathRange(element);
        const half = 2;
        assertBoundsClose(data.bounds, {
            minX: range.minX - half, minY: range.minY - half, maxX: range.maxX + half, maxY: range.maxY + half,
        }, 1e-3);
    });

    it('弧と弧の外接矩形の内側に収まる直線を結合した結果の外枠は、元の弧だけの外枠と一致する', () => {
        const arc = withId(new Ellipse(100, 200, 160, 230, 'arc', '#102030', 4), 'arc-only');
        const original = SpriteSerializer.serialize([arc]);
        assert.equal(original.elements[0].kind, 'ellipse');
        const path = joinArc(new Line(160, 200, 100, 200, '#102030', 4), 'jn');
        const joined = SpriteSerializer.serialize([path]);
        assert.equal(joined.elements[0].kind, 'bezierPath');
        assertBoundsClose(joined.bounds, original.bounds, 1e-6);
    });

    it('半月形の閉じた塗りありは closed: true で fillColor を持つ', () => {
        const open = joinArc(new Line(160, 200, 40, 200, '#102030', 4), 'open', '#ffcc00');
        const closedPlan = planJoin([open], 0);
        assert.notEqual(closedPlan, null);
        const closed = withId(closedPlan.path, 'half-moon');
        const element = SpriteSerializer.serialize([closed]).elements[0];
        assert.equal(element.kind, 'bezierPath');
        assert.equal(element.closed, true);
        assert.equal(element.fillColor, '#ffcc00');
        assert.deepEqual(element.segments.map((s) => s.kind), ['cubic', 'cubic', 'line']);
    });
});

describe('SpriteSerializer.computeShapesGeometryBounds', () => {
    it('線は線の太さを含まない（線を含む外枠より太さの半分ずつ内側）', () => {
        const line = new Line(10, 20, 30, 5, '#000000', 4);
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([line]), { minX: 10, minY: 5, maxX: 30, maxY: 20 });
        assertBoundsClose(SpriteSerializer.computeShapesBounds([line]), { minX: 8, minY: 3, maxX: 32, maxY: 22 });
        const rect = new Rect(10, 20, 30, 50, '#000000', 8, '#ff0000');
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([rect]), { minX: 10, minY: 20, maxX: 30, maxY: 50 });
        assertBoundsClose(SpriteSerializer.computeShapesBounds([rect]), { minX: 6, minY: 16, maxX: 34, maxY: 54 });
    });

    it('曲線は制御点ではなく極値を使う（線の太さを含まない）', () => {
        const curve = makeCurve([{ x: 0, y: 0 }, { x: 50, y: 100 }, { x: 100, y: 0 }]);
        // y(t) = 2(1-t)t*100 → t=0.5 で 50
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([curve]), { minX: 0, minY: 0, maxX: 100, maxY: 50 });
    });

    it('3次ベジェ（bezierPath）は端点と極値を使い、線の太さを含まない', () => {
        const element = {
            kind: 'bezierPath',
            id: 'x',
            points: [{ x: 0, y: 0 }, { x: 30, y: 0 }],
            closed: false,
            segments: [{ kind: 'cubic', control1: { x: 0, y: 40 }, control2: { x: 30, y: 40 } }],
            strokeColor: '#000000',
            strokeWidth: 10,
            fillColor: null,
        };
        const shape = { toDrawElement: () => element };
        // y(t) = 120 t (1-t) → t=0.5 で最大 30
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([shape]), { minX: 0, minY: 0, maxX: 30, maxY: 30 });
        assertBoundsClose(SpriteSerializer.computeShapesBounds([shape]), { minX: -5, minY: -5, maxX: 35, maxY: 35 });
    });

    it('円は全周・弧は上半分の範囲（線の太さを含まない）', () => {
        const circle = new Ellipse(10, 20, 40, 60, 'circle');
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([circle]), { minX: -20, minY: -20, maxX: 40, maxY: 60 });
        const arc = new Ellipse(10, 20, 40, 60, 'arc');
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([arc]), { minX: -20, minY: -20, maxX: 40, maxY: 20 });
    });

    it('線なしの要素も和に含め、複数の図形は和を取る', () => {
        const shapes = [
            new Line(-50, -50, -40, -40, null, 10),
            new Rect(0, 0, 10, 10, '#000000', 4, '#ff0000'),
        ];
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds(shapes), { minX: -50, minY: -50, maxX: 10, maxY: 10 });
        const mixed = [new Line(0, 0, 10, 10, '#000000', 2), new Rect(-20, 5, 30, 40, '#000000', 6)];
        assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds(mixed), { minX: -20, minY: 0, maxX: 30, maxY: 40 });
        assertBoundsClose(SpriteSerializer.computeShapesBounds(mixed), { minX: -23, minY: -1, maxX: 33, maxY: 43 });
    });

    it('図形0個でnull', () => {
        assert.equal(SpriteSerializer.computeShapesGeometryBounds([]), null);
    });

    it('未知のkindの描画要素はErrorをthrowする', () => {
        const fake = { toDrawElement: () => ({ kind: 'unknown', strokeWidth: 2 }) };
        assert.throws(() => SpriteSerializer.computeShapesGeometryBounds([fake]), Error);
    });

    it('引数の配列と図形を書き換えず、毎回新しいオブジェクトを返す', () => {
        const shapes = makeFilledShapes();
        const shapesBefore = [...shapes];
        const jsonBefore = shapes.map((shape) => shape.toJSON());
        const first = SpriteSerializer.computeShapesGeometryBounds(shapes);
        const second = SpriteSerializer.computeShapesGeometryBounds(shapes);
        assert.notEqual(first, second);
        assert.deepEqual(first, second);
        assert.equal(shapes.length, shapesBefore.length);
        shapes.forEach((shape, i) => assert.equal(shape, shapesBefore[i]));
        assert.deepEqual(shapes.map((shape) => shape.toJSON()), jsonBefore);
    });

    it('線を含む外枠（computeShapesBounds・serialize）の値は変わらない', () => {
        const shapes = [new Line(10, 20, 30, 5, '#000000', 4), new Rect(-20, 5, 30, 40, '#000000', 6)];
        const expected = { minX: -23, minY: 2, maxX: 33, maxY: 43 };
        assertBoundsClose(SpriteSerializer.computeShapesBounds(shapes), expected);
        assertBoundsClose(SpriteSerializer.serialize(shapes).bounds, expected);
    });
});

/**
 * 拡大縮小（createTransformed）の確認用の変換。x方向は-2倍（左右の裏返し）・y方向は-0.5倍（上下の裏返し）・平行移動(100, 50)。
 * 点(x, y)→(-2x + 100, -0.5y + 50)。
 */
const SCALE_TRANSFORM = { a: -2, b: 0, c: 0, d: -0.5, e: 100, f: 50 };

/**
 * 6種の図形（直線・今の曲線・矩形・円・弧・パス）を作って`SCALE_TRANSFORM`を当てた新しい図形を、この順で返す。
 * 元の座標・変換後の座標は手計算の固定値（呼び出し側のテストの題・期待値に書く）。
 * @returns {object[]} 変換後の図形（id は L1・C1・R1・E1・E2・P1）
 */
function makeScaledShapes() {
    const line = withId(new Line(10, 20, 30, 40, '#ff0000', 4), 'L1');
    const curve = withId(new Curve(0, 0, 100, 40, '#00ff00', 2), 'C1');
    curve.setVertex(1, 30, -80);
    const rect = withId(new Rect(10, 10, 90, 60, '#112233', 6, '#ff0000'), 'R1');
    const circle = withId(new Ellipse(50, 50, 80, 20, 'circle', '#0000ff', 2, '#00ff00'), 'E1');
    const arc = withId(new Ellipse(50, 50, 80, 20, 'arc', '#778899', 2), 'E2');
    const bezier = { kind: 'bezier', control1: { x: 120, y: 30 }, control2: { x: 120, y: 70 } };
    const path = withId(new Path(
        [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
        true, '#102030', 4, '#ffcc00', ['line', bezier, 'line', 'line'],
    ), 'P1');
    return [line, curve, rect, circle, arc, path].map((shape) => shape.createTransformed(SCALE_TRANSFORM));
}

describe('SpriteSerializer: createTransformed した図形の書き出し', () => {
    it('直線の描画要素（(10,20)→(80,40)・(30,40)→(40,30)。太さ・色・idは変わらない）', () => {
        const [el] = SpriteSerializer.serialize([makeScaledShapes()[0]]).elements;
        assert.deepEqual(el, {
            kind: 'polyline', id: 'L1', points: [{ x: 80, y: 40 }, { x: 40, y: 30 }],
            closed: false, strokeColor: '#ff0000', strokeWidth: 4, fillColor: null,
        });
    });

    it('今の曲線の描画要素（(0,0)→(100,50)・(30,-80)→(40,90)・(100,40)→(-100,30)）', () => {
        const [el] = SpriteSerializer.serialize([makeScaledShapes()[1]]).elements;
        assert.deepEqual(el, {
            kind: 'quadratic', id: 'C1', points: [{ x: 100, y: 50 }, { x: 40, y: 90 }, { x: -100, y: 30 }],
            strokeColor: '#00ff00', strokeWidth: 2, fillColor: null,
        });
    });

    it('矩形の描画要素（頂点の並びのまま (80,45)・(-80,45)・(-80,20)・(80,20)）', () => {
        const [el] = SpriteSerializer.serialize([makeScaledShapes()[2]]).elements;
        assert.deepEqual(el, {
            kind: 'polyline', id: 'R1',
            points: [{ x: 80, y: 45 }, { x: -80, y: 45 }, { x: -80, y: 20 }, { x: 80, y: 20 }],
            closed: true, strokeColor: '#112233', strokeWidth: 6, fillColor: '#ff0000',
        });
    });

    it('円の描画要素（中心(50,50)→(0,25)・半径30→横60・縦15）', () => {
        const [el] = SpriteSerializer.serialize([makeScaledShapes()[3]]).elements;
        assert.deepEqual(el, {
            kind: 'ellipse', id: 'E1', x: 0, y: 25, radiusX: 60, radiusY: 15, rotation: 0,
            startAngle: 0, endAngle: 2 * Math.PI, closed: true,
            strokeColor: '#0000ff', strokeWidth: 2, fillColor: '#00ff00',
        });
    });

    it('弧の描画要素（5つの点を写した位置で中心は(0,25)・横60・縦15・上下・左右に裏返った下半分）', () => {
        const [el] = SpriteSerializer.serialize([makeScaledShapes()[4]]).elements;
        assert.deepEqual(el, {
            kind: 'ellipse', id: 'E2', x: 0, y: 25, radiusX: 60, radiusY: 15, rotation: 0,
            startAngle: 0, endAngle: Math.PI, closed: false,
            strokeColor: '#778899', strokeWidth: 2, fillColor: null,
        });
    });

    it('曲がり方を持つ区間を含むパスの描画要素（頂点と引っ張る点が写り、cubicの制御点は(-140,35)・(-140,15)）', () => {
        const [el] = SpriteSerializer.serialize([makeScaledShapes()[5]]).elements;
        assert.deepEqual(el, {
            kind: 'bezierPath', id: 'P1',
            points: [{ x: 100, y: 50 }, { x: -100, y: 50 }, { x: -100, y: 0 }, { x: 100, y: 0 }],
            closed: true,
            segments: [
                { kind: 'line' },
                { kind: 'cubic', control1: { x: -140, y: 35 }, control2: { x: -140, y: 15 } },
                { kind: 'line' },
                { kind: 'line' },
            ],
            strokeColor: '#102030', strokeWidth: 4, fillColor: '#ffcc00',
        });
    });

    it('図形ごとの外枠（線の太さを含む／含まない）が固定の値になる', () => {
        // 線の太さの半分: 直線2・曲線1・矩形3・円1・弧1・パス2
        const expected = [
            { geometry: { minX: 40, minY: 30, maxX: 80, maxY: 40 }, stroke: { minX: 38, minY: 28, maxX: 82, maxY: 42 } },
            // 曲線: xは単調で[-100,100]。yは y'(t)=0 → t=0.4 で 0.36*50+0.48*90+0.16*30=66
            { geometry: { minX: -100, minY: 30, maxX: 100, maxY: 66 }, stroke: { minX: -101, minY: 29, maxX: 101, maxY: 67 } },
            { geometry: { minX: -80, minY: 20, maxX: 80, maxY: 45 }, stroke: { minX: -83, minY: 17, maxX: 83, maxY: 48 } },
            { geometry: { minX: -60, minY: 10, maxX: 60, maxY: 40 }, stroke: { minX: -61, minY: 9, maxX: 61, maxY: 41 } },
            { geometry: { minX: -60, minY: 25, maxX: 60, maxY: 40 }, stroke: { minX: -61, minY: 24, maxX: 61, maxY: 41 } },
            // パス: 曲がり方を持つ区間のxの極値は-100-30=-130（-120·t(1-t)の最小は t=0.5 で-30）
            { geometry: { minX: -130, minY: 0, maxX: 100, maxY: 50 }, stroke: { minX: -132, minY: -2, maxX: 102, maxY: 52 } },
        ];
        const shapes = makeScaledShapes();
        shapes.forEach((shape, i) => {
            assertBoundsClose(SpriteSerializer.computeShapesGeometryBounds([shape]), expected[i].geometry);
            assertBoundsClose(SpriteSerializer.computeShapesBounds([shape]), expected[i].stroke);
            assertBoundsClose(SpriteSerializer.serialize([shape]).bounds, expected[i].stroke);
        });
    });

    it('6種を並べた書き出しの描画順・種類・外枠（和）が固定の値になる', () => {
        const data = SpriteSerializer.serialize(makeScaledShapes());
        assert.deepEqual(data.elements.map((e) => e.id), ['L1', 'C1', 'R1', 'E1', 'E2', 'P1']);
        assert.deepEqual(
            data.elements.map((e) => e.kind),
            ['polyline', 'quadratic', 'polyline', 'ellipse', 'ellipse', 'bezierPath'],
        );
        assertBoundsClose(data.bounds, { minX: -132, minY: -2, maxX: 102, maxY: 67 });
        assertBoundsClose(
            SpriteSerializer.computeShapesGeometryBounds(makeScaledShapes()),
            { minX: -130, minY: 0, maxX: 100, maxY: 66 },
        );
    });

    it('source（作業データ）にも変換後の図形が入り、版は変わらない', () => {
        const data = SpriteSerializer.serialize(makeScaledShapes());
        assert.equal(data.source.version, 2);
        assert.deepEqual(data.source.shapes.map((s) => s.type), ['line', 'curve', 'rect', 'circle', 'arc', 'path']);
        assert.deepEqual(data.source.shapes[0].points, [{ x: 80, y: 40 }, { x: 40, y: 30 }]);
        assert.deepEqual(data.source.shapes[4].points[0], { x: 0, y: 25 });
    });
});
