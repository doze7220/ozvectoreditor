/**
 * 責務: DocumentSerializerの往復（図形インスタンス→作業データ→図形インスタンス）で5種の図形とパス（塗り・線なし・
 * 拡大縮小したcreateTransformedの結果を含む）が元と同じ図形に戻ることを、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { ShapeFactory, SHAPE_TYPES } from '../../js/core/ShapeFactory.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path, SEGMENT_KIND_SMOOTH } from '../../js/shapes/Path.js';
import { SegmentKindSwitch, planSegmentKindSwitch } from '../../js/shapes/PathSegmentKindRules.js';
import { planJoin } from '../../js/shapes/PathJoinRules.js';

/** 種別ごとの頂点数（開発資料4章 shapes/）。 */
const POINT_COUNTS = { line: 2, curve: 3, rect: 4, arc: 5, circle: 5 };

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック（呼び出し回数の確認に使う）
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 復元した図形が元の図形と同じ内容の別インスタンスであることを検証する。
 * @param {object} actual - 復元後の図形
 * @param {object} expected - 元の図形
 * @returns {void}
 */
function assertSameShape(actual, expected) {
    assert.notStrictEqual(actual, expected);
    assert.equal(actual.constructor, expected.constructor);
    assert.deepStrictEqual(actual.toJSON(), expected.toJSON());
    assert.equal(actual.toJSON().points.length, POINT_COUNTS[expected.type]);
    if (expected.type === 'arc' || expected.type === 'circle') {
        assert.equal(actual.startAngle, expected.startAngle);
        assert.equal(actual.endAngle, expected.endAngle);
    }
}

/**
 * 結果が成功・スキップなしであることと、各図形が元と一致することを検証する。
 * @param {object} result - デシリアライズの結果
 * @param {object[]} shapes - 元の図形の配列
 * @returns {void}
 */
function assertRestored(result, shapes) {
    assert.equal(result.ok, true);
    assert.deepStrictEqual(result.skipped, []);
    assert.equal(result.error, null);
    assert.equal(result.shapes.length, shapes.length);
    shapes.forEach((shape, i) => assertSameShape(result.shapes[i], shape));
}

/**
 * オブジェクト層で往復させる。
 * @param {object[]} shapes - 図形インスタンスの配列
 * @returns {object} デシリアライズの結果
 */
function roundTripByObject(shapes) {
    return DocumentSerializer.deserialize(DocumentSerializer.serialize(shapes));
}

/**
 * 文字列層で往復させる。
 * @param {object[]} shapes - 図形インスタンスの配列
 * @returns {object} デシリアライズの結果
 */
function roundTripByString(shapes) {
    return DocumentSerializer.deserializeFromString(DocumentSerializer.serializeToString(shapes));
}

/** 往復の経路（名前と関数）。 */
const ROUTES = [
    { name: 'オブジェクト層', run: roundTripByObject },
    { name: '文字列層', run: roundTripByString },
];

/**
 * 状態の定義。build は図形を作る関数、baseline は「動かす前」の図形を作る関数（なければ null）、
 * styled は線の色・太さを変えた状態かどうか。
 * @param {string} type - 図形種別
 * @returns {{name: string, build: Function, baseline: (Function|null), styled: boolean}[]} 状態の配列
 */
function statesFor(type) {
    /**
     * 対象の種別の図形を作る（curve は今の曲線 Curve を直接、ほかは ShapeFactory で作る）。
     * @param {...number} args - 図形の生成へ渡す座標引数
     * @returns {object} 図形インスタンス
     */
    const mk = (...args) => (type === 'curve' ? new Curve(...args) : ShapeFactory.create(type, ...args));
    /**
     * 生成後に図形を動かす状態（build）と、動かす前の図形を作る関数（baseline）を持つ定義を作る。
     * @param {number[]} args - 図形の生成引数
     * @param {(shape: object) => void} fn - 生成した図形を動かす関数
     * @returns {{build: Function, baseline: Function, styled: boolean}} 状態の定義（名前を除く）
     */
    const moved = (args, fn) => ({
        build: () => { const s = mk(...args); fn(s); return s; },
        baseline: () => mk(...args),
        styled: false,
    });
    /**
     * 生成直後のまま（動かさない）状態の定義を作る。
     * @param {number[]} args - 図形の生成引数
     * @returns {{build: Function, baseline: null, styled: boolean}} 状態の定義（名前を除く）
     */
    const plain = (args) => ({ build: () => mk(...args), baseline: null, styled: false });
    switch (type) {
        case 'line':
            return [
                { name: '生成直後', ...plain([10, 20, 110, 70]) },
                { name: '逆向き', ...plain([110, 70, 10, 20]) },
                { name: '頂点を動かした', ...moved([10, 20, 110, 70], (s) => { s.setVertex(0, -15.5, 30.25); s.setVertex(1, 240, -60); }) },
                { name: '平行移動した', ...moved([10, 20, 110, 70], (s) => s.translate(12.5, -7)) },
                { name: '線の色・太さを変えた', build: () => new Line(0, 0, 50, 50, '#ff0000', 5.5), baseline: null, styled: true },
            ];
        case 'curve':
            return [
                { name: '生成直後', ...plain([0, 0, 100, 40]) },
                { name: '頂点を動かした', ...moved([0, 0, 100, 40], (s) => { s.setVertex(1, 30, -80); s.setVertex(2, 150.75, 10); }) },
                { name: '平行移動した', ...moved([0, 0, 100, 40], (s) => s.translate(-3, 4.5)) },
                { name: '線の色・太さを変えた', build: () => new Curve(0, 0, 100, 40, '#00ff00', 1), baseline: null, styled: true },
            ];
        case 'rect':
            return [
                { name: '生成直後', ...plain([10, 10, 90, 60]) },
                { name: '右下から左上へ作った', ...plain([90, 60, 10, 10]) },
                { name: '頂点を動かした', ...moved([10, 10, 90, 60], (s) => { s.setVertex(2, 120, 95); s.setVertex(3, 5, 70.5); }) },
                { name: '平行移動した', ...moved([10, 10, 90, 60], (s) => s.translate(100, -50)) },
                { name: '線の色・太さを変えた', build: () => new Rect(10, 10, 90, 60, '#123456', 8), baseline: null, styled: true },
            ];
        default:
            return [
                { name: '生成直後', ...plain([50, 50, 80, 20]) },
                { name: '楕円にした', ...moved([50, 50, 80, 20], (s) => { s.setVertex(1, 120, 0); s.setVertex(2, 0, 10); }) },
                { name: '中心を動かした', ...moved([50, 50, 80, 20], (s) => s.setVertex(0, -20, 35.5)) },
                { name: '平行移動した', ...moved([50, 50, 80, 20], (s) => s.translate(7, -9)) },
                { name: '線の色・太さを変えた', build: () => new Ellipse(50, 50, 80, 20, type, '#0000ff', 3), baseline: null, styled: true },
            ];
    }
}

for (const type of SHAPE_TYPES) {
    describe(`${type} の往復`, () => {
        for (const state of statesFor(type)) {
            for (const route of ROUTES) {
                it(`${state.name}（${route.name}）`, (t) => {
                    const warn = silenceWarn(t);
                    const shape = state.build();
                    shape.id = 'shape-1';
                    if (state.baseline) {
                        assert.notDeepStrictEqual(shape.toJSON().points, state.baseline().toJSON().points);
                    }
                    if (state.styled) {
                        assert.notEqual(shape.toJSON().strokeColor, '#000000');
                        assert.notEqual(shape.toJSON().strokeWidth, 2);
                    }
                    assertRestored(route.run([shape]), [shape]);
                    assert.equal(warn.mock.callCount(), 0);
                });
            }
        }
    });
}

describe('混在・図形0個・補足の検証', () => {
    /**
     * 既定と異なる並びの5種の図形（一部は頂点を動かした状態）を作る。
     * @returns {object[]} 図形の配列（id は shape-1〜shape-5）
     */
    function makeMixed() {
        const rect = ShapeFactory.create('rect', 10, 10, 90, 60);
        rect.setVertex(2, 120, 95);
        const arc = ShapeFactory.create('arc', 50, 50, 80, 20);
        arc.setVertex(1, 120, 0);
        const line = ShapeFactory.create('line', 10, 20, 110, 70);
        const circle = ShapeFactory.create('circle', 50, 50, 80, 20);
        circle.translate(7, -9);
        const curve = new Curve(0, 0, 100, 40);
        curve.setVertex(1, 30, -80);
        const shapes = [rect, arc, line, circle, curve];
        shapes.forEach((s, i) => { s.id = `shape-${i + 1}`; });
        return shapes;
    }

    for (const route of ROUTES) {
        it(`混在の往復で描画順・idが保たれる（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const shapes = makeMixed();
            const result = route.run(shapes);
            assertRestored(result, shapes);
            assert.deepStrictEqual(result.shapes.map((s) => s.type), ['rect', 'arc', 'line', 'circle', 'curve']);
            assert.deepStrictEqual(result.shapes.map((s) => s.id), ['shape-1', 'shape-2', 'shape-3', 'shape-4', 'shape-5']);
            assert.equal(warn.mock.callCount(), 0);
        });

        it(`図形0個の往復（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const result = route.run([]);
            assert.equal(result.ok, true);
            assert.deepStrictEqual(result.shapes, []);
            assert.deepStrictEqual(result.skipped, []);
            assert.equal(result.error, null);
            assert.equal(warn.mock.callCount(), 0);
        });
    }

    it('文字列層とオブジェクト層が同じ作業データを表す', (t) => {
        silenceWarn(t);
        const shapes = makeMixed();
        assert.deepStrictEqual(
            JSON.parse(DocumentSerializer.serializeToString(shapes)),
            DocumentSerializer.serialize(shapes),
        );
    });

    it('serializeの結果の形（format・version・shapes）', (t) => {
        silenceWarn(t);
        const shapes = makeMixed();
        const doc = DocumentSerializer.serialize(shapes);
        assert.equal(doc.format, 'oz-vector-editor');
        assert.ok(Number.isInteger(doc.version) && doc.version >= 1);
        assert.deepStrictEqual(doc.shapes, shapes.map((s, i) => ({ ...s.toJSON(), name: ['矩形 1', '弧 1', '直線 1', '円 1', '曲線 1'][i], visible: true, locked: false })));
    });

    it('復元した図形を動かしても元の図形が変わらない', (t) => {
        silenceWarn(t);
        const shapes = makeMixed();
        const before = shapes.map((s) => s.toJSON());
        const result = roundTripByObject(shapes);
        result.shapes.forEach((s) => s.translate(30, 40));
        assert.deepStrictEqual(shapes.map((s) => s.toJSON()), before);
    });

    it('serializeの結果を書き換えても元の図形が変わらない', (t) => {
        silenceWarn(t);
        const shapes = makeMixed();
        const before = shapes.map((s) => s.toJSON());
        const doc = DocumentSerializer.serialize(shapes);
        doc.shapes.forEach((data) => data.points.forEach((p) => { p.x += 1000; p.y += 1000; }));
        assert.deepStrictEqual(shapes.map((s) => s.toJSON()), before);
    });
});

/**
 * 復元したパスが元のパスと同じ内容の別インスタンスであることを検証する。
 * @param {object} actual - 復元後のパス
 * @param {object} expected - 元のパス
 * @returns {void}
 */
function assertSamePath(actual, expected) {
    assert.notStrictEqual(actual, expected);
    assert.equal(actual.constructor, expected.constructor);
    assert.equal(actual.constructor, Path);
    assert.deepStrictEqual(actual.toJSON(), expected.toJSON());
    assert.deepStrictEqual(actual.points, expected.points);
    assert.equal(actual.closed, expected.closed);
    assert.deepStrictEqual(actual.segments, expected.segments);
    assert.equal(actual.strokeColor, expected.strokeColor);
    assert.equal(actual.strokeWidth, expected.strokeWidth);
}

/**
 * 結果が成功・スキップなしであることと、パスと既存の5種が混在する各図形が元と一致することを検証する。
 * @param {object} result - デシリアライズの結果
 * @param {object[]} shapes - 元の図形の配列（パスを含んでよい）
 * @returns {void}
 */
function assertRestoredWithPaths(result, shapes) {
    assert.equal(result.ok, true);
    assert.deepStrictEqual(result.skipped, []);
    assert.equal(result.error, null);
    assert.equal(result.shapes.length, shapes.length);
    shapes.forEach((shape, i) => {
        if (shape.type === 'path') {
            assertSamePath(result.shapes[i], shape);
        } else {
            assertSameShape(result.shapes[i], shape);
        }
    });
}

/**
 * パスを作る。
 * @param {{x: number, y: number}[]} points - 頂点の並び
 * @param {boolean} closed - 閉じているか
 * @param {string} [strokeColor] - 線の色
 * @param {number} [strokeWidth] - 線の太さ
 * @returns {Path} パス
 */
function makePath(points, closed, strokeColor, strokeWidth) {
    return new Path(points, closed, strokeColor, strokeWidth);
}

/** パスの頂点の例（4点）。 */
const PATH_POINTS = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

/** パスの状態の定義（名前・build・baseline・styled）。 */
const PATH_STATES = [
    { name: '開いたパス（4点）', build: () => makePath(PATH_POINTS, false), baseline: null, styled: false },
    { name: '閉じたパス', build: () => makePath(PATH_POINTS, true), baseline: null, styled: false },
    { name: '2点の開いたパス', build: () => makePath([{ x: 5, y: 6 }, { x: 70.5, y: -20 }], false), baseline: null, styled: false },
    {
        name: '頂点を動かした',
        build: () => { const p = makePath(PATH_POINTS, true); p.setVertex(1, 130.25, -15.5); p.setVertex(3, -8, 90); return p; },
        baseline: () => makePath(PATH_POINTS, true),
        styled: false,
    },
    {
        name: '平行移動した',
        build: () => { const p = makePath(PATH_POINTS, false); p.translate(12.5, -7); return p; },
        baseline: () => makePath(PATH_POINTS, false),
        styled: false,
    },
    { name: '線の色・太さを変えた', build: () => makePath(PATH_POINTS, true, '#ff8800', 5.5), baseline: null, styled: true },
    {
        name: '長さ0の区間を含む',
        build: () => makePath([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }], false),
        baseline: null,
        styled: false,
    },
];

describe('path の往復', () => {
    for (const state of PATH_STATES) {
        for (const route of ROUTES) {
            it(`${state.name}（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const path = state.build();
                path.id = 'path-1';
                if (state.baseline) {
                    assert.notDeepStrictEqual(path.toJSON().points, state.baseline().toJSON().points);
                }
                if (state.styled) {
                    assert.notEqual(path.toJSON().strokeColor, '#000000');
                    assert.notEqual(path.toJSON().strokeWidth, 2);
                }
                assertRestoredWithPaths(route.run([path]), [path]);
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }
});

/**
 * 区間の種類を指定して曲線のパスを作る（kinds の長さは頂点数-1。closed なら頂点数）。
 * @param {{x: number, y: number}[]} points - 頂点の並び
 * @param {boolean} closed - 閉じているか
 * @param {string[]} kinds - 区間ごとの種類（'line' または 'smooth'）
 * @param {(string|null)} [fillColor=null] - 塗りの色
 * @returns {Path} 区間の種類を設定したパス
 */
function makeSmoothPath(points, closed, kinds, fillColor = null) {
    const data = new Path(points, closed, '#102030', 3, fillColor, SEGMENT_KIND_SMOOTH).toJSON();
    data.segments = kinds.map((kind) => ({ kind }));
    return Path.fromJSON(data);
}

describe('曲線のパスの往復', () => {
    const states = [
        { name: '開いた曲線のパス', build: () => makeSmoothPath(PATH_POINTS, false, ['smooth', 'smooth', 'smooth']) },
        { name: '閉じた曲線のパス', build: () => makeSmoothPath(PATH_POINTS, true, ['smooth', 'smooth', 'smooth', 'smooth']) },
        { name: '直線と曲線の混在', build: () => makeSmoothPath(PATH_POINTS, false, ['line', 'smooth', 'line']) },
        {
            name: '頂点を動かした',
            build: () => { const p = makeSmoothPath(PATH_POINTS, true, ['smooth', 'line', 'smooth', 'smooth']); p.setVertex(1, 130.25, -15.5); return p; },
        },
        { name: '塗りを付けた', build: () => makeSmoothPath(PATH_POINTS, true, ['smooth', 'smooth', 'smooth', 'smooth'], '#ffcc00') },
    ];
    for (const state of states) {
        for (const route of ROUTES) {
            it(`${state.name}（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const path = state.build();
                path.id = 'path-1';
                assert.ok(path.segments.some((segment) => segment.kind === 'smooth'));
                assertRestoredWithPaths(route.run([path]), [path]);
                const restored = route.run([path]).shapes[0];
                assert.deepStrictEqual(restored.segments, path.segments);
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }
});

describe('パスと既存の5種の混在の往復', () => {
    /**
     * 既存の5種とパス（開いた・閉じた）が混在する図形を作る。
     * @returns {object[]} 図形の配列（id は shape-1〜shape-7）
     */
    function makeMixedWithPaths() {
        const rect = ShapeFactory.create('rect', 10, 10, 90, 60);
        const openPath = makePath(PATH_POINTS, false, '#112233', 4);
        openPath.setVertex(2, 150, 120);
        const line = ShapeFactory.create('line', 10, 20, 110, 70);
        const closedPath = makePath(PATH_POINTS, true);
        closedPath.translate(30, -10);
        const circle = ShapeFactory.create('circle', 50, 50, 80, 20);
        const curve = new Curve(0, 0, 100, 40);
        const arc = ShapeFactory.create('arc', 50, 50, 80, 20);
        const shapes = [rect, openPath, line, closedPath, circle, curve, arc];
        shapes.forEach((s, i) => { s.id = `shape-${i + 1}`; });
        return shapes;
    }

    for (const route of ROUTES) {
        it(`描画順（type の並び）・id・各図形の内容が保たれる（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const shapes = makeMixedWithPaths();
            const result = route.run(shapes);
            assertRestoredWithPaths(result, shapes);
            assert.deepStrictEqual(
                result.shapes.map((s) => s.type),
                ['rect', 'path', 'line', 'path', 'circle', 'curve', 'arc'],
            );
            assert.deepStrictEqual(
                result.shapes.map((s) => s.id),
                ['shape-1', 'shape-2', 'shape-3', 'shape-4', 'shape-5', 'shape-6', 'shape-7'],
            );
            assert.deepStrictEqual(result.shapes.map((s) => s.closed), [undefined, false, undefined, true, undefined, undefined, undefined]);
            assert.equal(warn.mock.callCount(), 0);
        });
    }
});

describe('塗り・線なしの往復（作業データの版5）', () => {
    /** 自分自身と交差する閉じたパス（五角形の星形）の頂点。 */
    const STAR_POINTS = [
        { x: 50, y: 0 }, { x: 80, y: 95 }, { x: 0, y: 36 }, { x: 100, y: 36 }, { x: 20, y: 95 },
    ];

    /**
     * 塗り・線なしを含む図形を作る。
     * @returns {object[]} 図形の配列（id は shape-1〜shape-9）
     */
    function makeFillStrokeShapes() {
        const shapes = [
            new Rect(10, 10, 90, 60, '#112233', 3, '#ff0000'),
            new Ellipse(50, 50, 80, 20, 'circle', null, 2, '#00ff00'),
            makeFilledPath(PATH_POINTS, true, null, 2, '#0000ff'),
            makeFilledPath(STAR_POINTS, true, '#000000', 2, '#ffff00'),
            new Line(0, 0, 50, 50, '#123456', 2, '#abcdef'),
            new Curve(0, 0, 100, 40, '#654321', 4, '#fedcba'),
            new Ellipse(50, 50, 80, 20, 'arc', '#778899', 2, '#112233'),
            makeFilledPath(PATH_POINTS, false, '#445566', 2, '#778899'),
            new Line(5, 5, 60, 80, null, 2, null),
        ];
        shapes.forEach((s, i) => { s.id = `shape-${i + 1}`; });
        return shapes;
    }

    /**
     * 塗りを指定してパスを作る。
     * @param {{x: number, y: number}[]} points - 頂点の並び
     * @param {boolean} closed - 閉じているか
     * @param {(string|null)} strokeColor - 線の色（nullは線なし）
     * @param {number} strokeWidth - 線の太さ
     * @param {(string|null)} fillColor - 塗りの色（nullは塗りなし）
     * @returns {Path} パス
     */
    function makeFilledPath(points, closed, strokeColor, strokeWidth, fillColor) {
        return new Path(points, closed, strokeColor, strokeWidth, fillColor);
    }

    /**
     * 復元した図形の fillColor・strokeColor・strokeWidth が元と同じであることを明示的に比べる。
     * @param {object} result - デシリアライズの結果
     * @param {object[]} shapes - 元の図形の配列
     * @returns {void}
     */
    function assertStyles(result, shapes) {
        assert.equal(result.shapes.length, shapes.length);
        shapes.forEach((shape, i) => {
            assert.equal(result.shapes[i].fillColor, shape.fillColor);
            assert.equal(result.shapes[i].strokeColor, shape.strokeColor);
            assert.equal(result.shapes[i].strokeWidth, shape.strokeWidth);
            assert.equal(result.shapes[i].toJSON().fillColor, shape.fillColor);
            assert.equal(result.shapes[i].toJSON().strokeColor, shape.strokeColor);
        });
    }

    for (const route of ROUTES) {
        it(`塗り・線なしを含む図形が元どおりに戻る（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const shapes = makeFillStrokeShapes();
            const result = route.run(shapes);
            assertRestoredWithPaths(result, shapes);
            assertStyles(result, shapes);
            assert.deepStrictEqual(
                result.shapes.map((s) => s.fillColor),
                ['#ff0000', '#00ff00', '#0000ff', '#ffff00', '#abcdef', '#fedcba', '#112233', '#778899', null],
            );
            assert.deepStrictEqual(
                result.shapes.map((s) => s.strokeColor),
                ['#112233', null, null, '#000000', '#123456', '#654321', '#778899', '#445566', null],
            );
            assert.equal(warn.mock.callCount(), 0);
        });

        it(`塗れない形の fillColor も保持される（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const shapes = makeFillStrokeShapes();
            const result = route.run(shapes);
            const unfillable = result.shapes.filter((s) => !s.isFillable());
            assert.deepStrictEqual(unfillable.map((s) => s.type), ['line', 'curve', 'arc', 'path', 'line']);
            assert.deepStrictEqual(
                unfillable.map((s) => s.fillColor),
                ['#abcdef', '#fedcba', '#112233', '#778899', null],
            );
            assert.equal(warn.mock.callCount(), 0);
        });

        it(`自分自身と交差する閉じたパスの塗りが保たれる（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const star = makeFilledPath(STAR_POINTS, true, '#000000', 2, '#ffff00');
            star.id = 'star-1';
            const result = route.run([star]);
            assertRestoredWithPaths(result, [star]);
            assert.equal(result.shapes[0].fillColor, '#ffff00');
            assert.equal(result.shapes[0].isFillable(), true);
            assert.equal(warn.mock.callCount(), 0);
        });

        it(`線なしで塗りなしの直線も受理され元どおりに戻る（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const line = new Line(5, 5, 60, 80, null, 2, null);
            line.id = 'line-1';
            const result = route.run([line]);
            assertRestoredWithPaths(result, [line]);
            assert.equal(result.shapes[0].strokeColor, null);
            assert.equal(result.shapes[0].fillColor, null);
            assert.equal(warn.mock.callCount(), 0);
        });
    }

    it('serializeの version が 5 である', (t) => {
        silenceWarn(t);
        assert.equal(DocumentSerializer.serialize(makeFillStrokeShapes()).version, 5);
        assert.equal(JSON.parse(DocumentSerializer.serializeToString(makeFillStrokeShapes())).version, 5);
    });
});

describe('角の点を含むパスの往復（Phase 09-02a）', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 20 }, { x: 150, y: 100 }, { x: 40, y: 120 }];
    const states = [
        { name: '開いたパス', build: () => new Path(points, false, '#102030', 3, null, SEGMENT_KIND_SMOOTH, [false, true, true, false]) },
        { name: '閉じたパス', build: () => new Path(points, true, '#102030', 3, '#ffcc00', SEGMENT_KIND_SMOOTH, [true, false, true, false]) },
    ];
    for (const state of states) {
        for (const route of ROUTES) {
            it(`${state.name}の角の点が保たれる（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const path = state.build();
                path.id = 'path-1';
                assert.ok(path.corners.includes(true));
                const result = route.run([path]);
                assertRestoredWithPaths(result, [path]);
                assert.deepStrictEqual(result.shapes[0].corners, path.corners);
                assert.deepStrictEqual(result.shapes[0].toJSON().corners, path.corners);
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }

    it('角の点がないパスの作業データには corners が出ない', () => {
        const path = new Path(points, false, '#102030', 3, null, SEGMENT_KIND_SMOOTH);
        path.id = 'path-1';
        const doc = DocumentSerializer.serialize([path]);
        assert.equal('corners' in doc.shapes[0], false);
    });
});

describe('区間の切り替えで作った図形の往復（Phase 09-02b）', () => {
    /**
     * 頂点番号の一覧の点を選んだ対象の並びにする。
     * @param {object} shape - 図形
     * @param {number[]} indexes - 頂点の番号
     * @returns {{shape: object, vertexIndex: number}[]} 切り替えの対象
     */
    const targetsOf = (shape, indexes) => indexes.map((vertexIndex) => ({ shape, vertexIndex }));

    /**
     * 切り替えの計画の最初の図形へidを付けて返す。
     * @param {object} source - 元の図形
     * @param {number[]} indexes - 選ぶ頂点の番号
     * @param {string} operation - 切り替えの操作
     * @returns {object} 切り替えた新しい図形
     */
    const switched = (source, indexes, operation) => {
        source.id = 'src-1';
        const plan = planSegmentKindSwitch(targetsOf(source, indexes), operation);
        assert.equal(plan.length, 1);
        const shape = plan[0].shape;
        shape.id = 'switched-1';
        return shape;
    };

    const openPoints = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 60 }, { x: 120, y: 120 }];
    const states = [
        {
            name: '開いたパスの「曲線に」（角の点ができる）',
            build: () => switched(new Path(openPoints, false, '#102030', 3), [0, 1, 2], SegmentKindSwitch.TO_CURVE),
            expectCorners: true,
        },
        {
            name: '閉じた塗りありのパスの「曲線に」（終点→始点の区間を含む）',
            build: () => switched(new Path(openPoints, true, '#102030', 3, '#ffcc00'), [3, 0, 1], SegmentKindSwitch.TO_CURVE),
            expectCorners: true,
        },
        {
            name: '単独の直線から変わったパス',
            build: () => switched(new Line(0, 0, 30, 60, '#102030', 3), [0, 1], SegmentKindSwitch.TO_CURVE),
            expectCorners: false,
        },
        {
            name: '今の曲線から変わった直線',
            build: () => {
                const curve = new Curve(0, 0, 90, 30, '#102030', 3);
                curve.setVertex(1, 30, 60);
                return switched(curve, [0, 2], SegmentKindSwitch.TO_LINE);
            },
            expectCorners: false,
        },
    ];

    for (const state of states) {
        for (const route of ROUTES) {
            it(`${state.name}が保たれる（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const shape = state.build();
                if (shape.type === 'path') {
                    assert.equal('corners' in shape.toJSON(), state.expectCorners);
                }
                const result = route.run([shape]);
                assertRestoredWithPaths(result, [shape]);
                assert.deepStrictEqual(result.shapes[0].toJSON(), shape.toJSON());
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }

    it('作業データの版は5のまま・図形データのキーは名前・表示・ロックのほかに増えない', () => {
        const path = switched(new Path(openPoints, false, '#102030', 3), [0, 1, 2], SegmentKindSwitch.TO_CURVE);
        const doc = DocumentSerializer.serialize([path]);
        assert.equal(doc.version, 5);
        assert.deepStrictEqual(Object.keys(doc.shapes[0]), [
            'type', 'id', 'points', 'closed', 'segments', 'corners', 'strokeColor', 'strokeWidth', 'fillColor',
            'name', 'visible', 'locked',
        ]);
    });
});

describe('曲がり方を持つ区間を含むパスの往復（Phase 09-03a）', () => {
    const points = [{ x: 0, y: 0 }, { x: 60, y: 40 }, { x: 120, y: 0 }, { x: 160, y: 50 }];
    /**
     * 曲がり方を持つ区間の指定を作る。
     * @param {number} c1x - control1のx
     * @param {number} c1y - control1のy
     * @param {number} c2x - control2のx
     * @param {number} c2y - control2のy
     * @returns {{kind: string, control1: object, control2: object}} 区間の指定
     */
    const bez = (c1x, c1y, c2x, c2y) => ({ kind: 'bezier', control1: { x: c1x, y: c1y }, control2: { x: c2x, y: c2y } });
    const states = [
        {
            name: '開いたパス',
            build: () => new Path(points, false, '#102030', 3, null, [bez(10, 30, 40, 50), 'line', bez(130, 20, 150, 60)]),
        },
        {
            name: '閉じた塗りありのパス',
            build: () => new Path(points, true, '#102030', 3, '#ffcc00', [bez(10, 30, 40, 50), 'line', bez(130, 20, 150, 60), 'line']),
        },
        {
            name: '直線・曲線・曲がり方を持つ区間が混ざったパス',
            build: () => new Path(points, false, '#102030', 3, null, ['line', 'smooth', bez(130, 20, 150, 60)]),
        },
        {
            name: '角の点を持つパス',
            build: () => new Path(points, false, '#102030', 3, null, [bez(10, 30, 40, 50), 'smooth', 'smooth'], [false, true, false, false]),
        },
    ];
    for (const state of states) {
        for (const route of ROUTES) {
            it(`${state.name}が保たれる（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const path = state.build();
                path.id = 'path-1';
                assert.ok(path.segments.some((segment) => segment.kind === 'bezier'));
                const result = route.run([path]);
                assertRestoredWithPaths(result, [path]);
                assert.deepStrictEqual(result.shapes[0].toJSON(), path.toJSON());
                assert.deepStrictEqual(result.shapes[0].segments, path.segments);
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }

    it('今の曲線と直線を結合した結果が往復で保たれ、作業データの版は5のまま', (t) => {
        const warn = silenceWarn(t);
        const curve = new Curve(0, 0, 60, 0);
        curve.setVertex(1, 30, 60);
        curve.id = 'c-1';
        const line = new Line(60, 0, 100, 20);
        line.id = 'l-1';
        const plan = planJoin([curve, line], 0);
        assert.notEqual(plan, null);
        const joined = plan.path;
        joined.id = 'joined-1';
        assert.deepStrictEqual(joined.toJSON().segments.map((s) => s.kind), ['bezier', 'line']);
        for (const route of ROUTES) {
            const result = route.run([joined]);
            assertRestoredWithPaths(result, [joined]);
            assert.deepStrictEqual(result.shapes[0].toJSON(), joined.toJSON());
        }
        assert.equal(DocumentSerializer.serialize([joined]).version, 5);
        assert.equal(JSON.parse(DocumentSerializer.serializeToString([joined])).version, 5);
        assert.equal(warn.mock.callCount(), 0);
    });
});

/**
 * 弧と直線などを`planJoin`で結合した結果のパスを作る（弧は中心(100,200)・横の半径60・縦の半径30。左端(40,200)・右端(160,200)）。
 * @param {object[]} shapes - 結合する図形（基準の線Aが先頭）
 * @param {string} id - 結果のパスに付けるid
 * @returns {Path} 結合した結果のパス
 */
function joinForArcRoundtrip(shapes, id) {
    shapes.forEach((shape, i) => {
        shape.id = `src-${i}`;
    });
    const plan = planJoin(shapes, 0);
    assert.notEqual(plan, null);
    plan.path.id = id;
    return plan.path;
}

describe('弧を結合した結果の往復（Phase 09-03b）', () => {
    const states = [
        {
            name: '弧と直線を結合した開いたパス',
            build: () => joinForArcRoundtrip(
                [new Ellipse(100, 200, 160, 230, 'arc', '#102030', 3), new Line(160, 200, 220, 220, '#102030', 3)],
                'arc-line',
            ),
            kinds: ['bezier', 'bezier', 'line'],
            closed: false,
        },
        {
            name: '半月形の閉じた塗りありのパス',
            build: () => {
                const open = joinForArcRoundtrip(
                    [new Ellipse(100, 200, 160, 230, 'arc', '#102030', 3, '#ffcc00'), new Line(160, 200, 40, 200, '#102030', 3)],
                    'half-moon',
                );
                const closedPlan = planJoin([open], 0);
                assert.notEqual(closedPlan, null);
                return closedPlan.path;
            },
            kinds: ['bezier', 'bezier', 'line'],
            closed: true,
        },
        {
            name: '弧2本を結合したパス',
            build: () => joinForArcRoundtrip(
                [new Ellipse(100, 200, 160, 230, 'arc', '#102030', 3), new Ellipse(220, 200, 280, 230, 'arc', '#102030', 3)],
                'arc-arc',
            ),
            kinds: ['bezier', 'bezier', 'bezier', 'bezier'],
            closed: false,
        },
    ];
    for (const state of states) {
        for (const route of ROUTES) {
            it(`${state.name}が保たれ、作業データの版は5のまま（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const path = state.build();
                path.id = 'joined-arc';
                assert.deepStrictEqual(path.segments.map((s) => s.kind), state.kinds);
                assert.equal(path.closed, state.closed);
                const result = route.run([path]);
                assertRestoredWithPaths(result, [path]);
                assert.deepStrictEqual(result.shapes[0].toJSON(), path.toJSON());
                assert.deepStrictEqual(result.shapes[0].segments, path.segments);
                assert.equal(DocumentSerializer.serialize([path]).version, 5);
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }
});

describe('拡大縮小（createTransformed）した図形の往復（Phase 10-01）', () => {
    /** 変換。点(x, y)→(-2x + 100, -0.5y + 50)（左右・上下の裏返しを含む）。 */
    const TRANSFORM = { a: -2, b: 0, c: 0, d: -0.5, e: 100, f: 50 };

    /**
     * 6種の図形を作って変換を当てた新しい図形を、直線・曲線・矩形・円・弧・パスの順で返す。
     * @returns {object[]} 変換後の図形（id は L1・C1・R1・E1・E2・P1）
     */
    function makeTransformedShapes() {
        const line = new Line(10, 20, 30, 40, '#ff0000', 4);
        const curve = new Curve(0, 0, 100, 40, '#00ff00', 2);
        curve.setVertex(1, 30, -80);
        const rect = new Rect(10, 10, 90, 60, '#112233', 6, '#ff0000');
        const circle = new Ellipse(50, 50, 80, 20, 'circle', '#0000ff', 2, '#00ff00');
        const arc = new Ellipse(50, 50, 80, 20, 'arc', '#778899', 2);
        const bezier = { kind: 'bezier', control1: { x: 120, y: 30 }, control2: { x: 120, y: 70 } };
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }],
            true, '#102030', 4, '#ffcc00', ['line', bezier, 'line', 'line'],
        );
        const sources = [line, curve, rect, circle, arc, path];
        sources.forEach((s, i) => { s.id = ['L1', 'C1', 'R1', 'E1', 'E2', 'P1'][i]; });
        return sources.map((s) => s.createTransformed(TRANSFORM));
    }

    /** 変換後の図形の作業データ（手計算の固定値）。 */
    const EXPECTED_JSON = [
        {
            type: 'line', id: 'L1', points: [{ x: 80, y: 40 }, { x: 40, y: 30 }],
            strokeColor: '#ff0000', strokeWidth: 4, fillColor: null,
        },
        {
            type: 'curve', id: 'C1', points: [{ x: 100, y: 50 }, { x: 40, y: 90 }, { x: -100, y: 30 }],
            strokeColor: '#00ff00', strokeWidth: 2, fillColor: null,
        },
        {
            type: 'rect', id: 'R1', points: [{ x: 80, y: 45 }, { x: -80, y: 45 }, { x: -80, y: 20 }, { x: 80, y: 20 }],
            strokeColor: '#112233', strokeWidth: 6, fillColor: '#ff0000',
        },
        {
            type: 'circle', id: 'E1',
            points: [{ x: 0, y: 25 }, { x: -60, y: 25 }, { x: 0, y: 40 }, { x: -60, y: 25 }, { x: -60, y: 25 }],
            strokeColor: '#0000ff', strokeWidth: 2, fillColor: '#00ff00',
        },
        {
            type: 'arc', id: 'E2',
            points: [{ x: 0, y: 25 }, { x: -60, y: 25 }, { x: 0, y: 40 }, { x: 60, y: 25 }, { x: -60, y: 25 }],
            strokeColor: '#778899', strokeWidth: 2, fillColor: null,
        },
        {
            type: 'path', id: 'P1',
            points: [{ x: 100, y: 50 }, { x: -100, y: 50 }, { x: -100, y: 0 }, { x: 100, y: 0 }], closed: true,
            segments: [
                { kind: 'line' },
                { kind: 'bezier', control1: { x: -140, y: 35 }, control2: { x: -140, y: 15 } },
                { kind: 'line' },
                { kind: 'line' },
            ],
            strokeColor: '#102030', strokeWidth: 4, fillColor: '#ffcc00',
        },
    ];

    it('変換後の図形の作業データが固定の値になる（往復の前提）', () => {
        const shapes = makeTransformedShapes();
        assert.deepStrictEqual(shapes.map((s) => s.toJSON()), EXPECTED_JSON);
    });

    for (const route of ROUTES) {
        it(`6種それぞれが元と同じ図形に戻り、作業データが固定の値のまま（${route.name}）`, (t) => {
            const warn = silenceWarn(t);
            const shapes = makeTransformedShapes();
            shapes.forEach((shape) => {
                const result = route.run([shape]);
                assertRestoredWithPaths(result, [shape]);
            });
            const result = route.run(shapes);
            assertRestoredWithPaths(result, shapes);
            assert.deepStrictEqual(result.shapes.map((s) => s.toJSON()), EXPECTED_JSON);
            assert.deepStrictEqual(result.shapes.map((s) => s.type), ['line', 'curve', 'rect', 'circle', 'arc', 'path']);
            assert.deepStrictEqual(result.shapes.map((s) => s.id), ['L1', 'C1', 'R1', 'E1', 'E2', 'P1']);
            assert.equal(warn.mock.callCount(), 0);
        });
    }

    it('円は楕円（横60・縦15）、弧は上下・左右に裏返った弧（下半分）として復元され、角度は種別から決まる', (t) => {
        silenceWarn(t);
        const result = roundTripByObject(makeTransformedShapes());
        const circle = result.shapes[3];
        const arc = result.shapes[4];
        assert.equal(circle.startAngle, 0);
        assert.equal(circle.endAngle, 2 * Math.PI);
        assert.equal(arc.startAngle, Math.PI);
        assert.equal(arc.endAngle, 2 * Math.PI);
        assert.deepStrictEqual(circle.toDrawElement().radiusX, 60);
        assert.deepStrictEqual(circle.toDrawElement().radiusY, 15);
        assert.deepStrictEqual([arc.toDrawElement().x, arc.toDrawElement().y], [0, 25]);
    });

    it('復元したパスの曲がり方を持つ区間・描画要素が変換後のまま保たれる', (t) => {
        silenceWarn(t);
        const path = roundTripByString(makeTransformedShapes()).shapes[5];
        assert.deepStrictEqual(path.segments[1], { kind: 'bezier', control1: { x: -140, y: 35 }, control2: { x: -140, y: 15 } });
        assert.deepStrictEqual(path.toDrawElement().segments[1], {
            kind: 'cubic', control1: { x: -140, y: 35 }, control2: { x: -140, y: 15 },
        });
    });

    it('変換後の図形の作業データは版5で、図形データのキーが名前・表示・ロックのほかに増えない', (t) => {
        silenceWarn(t);
        const doc = DocumentSerializer.serialize(makeTransformedShapes());
        assert.equal(doc.version, 5);
        assert.deepStrictEqual(doc.shapes.map((s) => Object.keys(s)), [
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor', 'name', 'visible', 'locked'],
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor', 'name', 'visible', 'locked'],
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor', 'name', 'visible', 'locked'],
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor', 'name', 'visible', 'locked'],
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor', 'name', 'visible', 'locked'],
            ['type', 'id', 'points', 'closed', 'segments', 'strokeColor', 'strokeWidth', 'fillColor', 'name', 'visible', 'locked'],
        ]);
    });

    it('復元した図形を動かしても変換後の図形が変わらない', (t) => {
        silenceWarn(t);
        const shapes = makeTransformedShapes();
        const result = roundTripByObject(shapes);
        result.shapes.forEach((s) => s.translate(30, 40));
        assert.deepStrictEqual(shapes.map((s) => s.toJSON()), EXPECTED_JSON);
    });
});

describe('回した図形の往復（Phase 10-02）', () => {
    /**
     * 回した5種の図形（円・弧・矩形・直線・パス）を作る。
     * @param {{a: number, b: number, c: number, d: number, e: number, f: number}} transform - 当てる変換
     * @returns {object[]} 変換後の図形
     */
    function makeRotatedShapes(transform) {
        const sources = [
            new Ellipse(100, 100, 130, 140, 'circle', '#102030', 3, '#aabbcc'),
            new Ellipse(100, 100, 130, 140, 'arc', '#102030', 3),
            ShapeFactory.create('rect', 10, 20, 70, 50),
            ShapeFactory.create('line', 0, 0, 40, 30),
            new Path([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 30 }], false, '#102030', 3),
        ];
        sources.forEach((s, i) => { s.id = `r-${i}`; });
        return sources.map((s) => s.createTransformed(transform));
    }

    const ROTATIONS = [
        { name: '90度', transform: { a: 0, b: 1, c: -1, d: 0, e: 150, f: -20 } },
        { name: '30度', transform: { a: Math.cos(Math.PI / 6), b: Math.sin(Math.PI / 6), c: -Math.sin(Math.PI / 6), d: Math.cos(Math.PI / 6), e: 12.5, f: 7.25 } },
    ];

    for (const rotation of ROTATIONS) {
        for (const route of ROUTES) {
            it(`${rotation.name}回した円・弧・矩形・直線・パスの作業データの往復（${route.name}）`, (t) => {
                const warn = silenceWarn(t);
                const shapes = makeRotatedShapes(rotation.transform);
                const result = route.run(shapes);
                assert.equal(result.ok, true);
                assert.deepStrictEqual(result.skipped, []);
                assert.equal(result.shapes.length, shapes.length);
                result.shapes.forEach((restored, i) => {
                    assert.notStrictEqual(restored, shapes[i]);
                    assert.equal(restored.constructor, shapes[i].constructor);
                    assert.deepStrictEqual(restored.toJSON(), shapes[i].toJSON());
                });
                assert.deepStrictEqual(result.shapes.map((s) => s.toDrawElement()), shapes.map((s) => s.toDrawElement()));
                assert.equal(warn.mock.callCount(), 0);
            });
        }
    }

    it('回した円・弧はserializeの版5のまま読み込み時に点を変えない', (t) => {
        silenceWarn(t);
        const shapes = makeRotatedShapes(ROTATIONS[1].transform).slice(0, 2);
        const doc = DocumentSerializer.serialize(shapes);
        assert.equal(doc.version, 5);
        const result = DocumentSerializer.deserialize(structuredClone(doc));
        assert.deepStrictEqual(result.shapes.map((s) => s.toJSON().points), doc.shapes.map((s) => s.points));
    });
});
