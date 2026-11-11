/**
 * 責務: DocumentSerializerの往復（図形インスタンス→作業データ→図形インスタンス）で5種の図形と
 * パス（塗り・線なしを含む）が元と同じ図形に戻ることを、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { ShapeFactory, SHAPE_TYPES } from '../../js/core/ShapeFactory.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

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
     * 対象の種別の図形を ShapeFactory で作る。
     * @param {...number} args - ShapeFactory.create へ渡す座標引数
     * @returns {object} 図形インスタンス
     */
    const mk = (...args) => ShapeFactory.create(type, ...args);
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
        const curve = ShapeFactory.create('curve', 0, 0, 100, 40);
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
        assert.deepStrictEqual(doc.shapes, shapes.map((s) => s.toJSON()));
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
        const curve = ShapeFactory.create('curve', 0, 0, 100, 40);
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

describe('塗り・線なしの往復（作業データの版2）', () => {
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

    it('serializeの version が 2 である', (t) => {
        silenceWarn(t);
        assert.equal(DocumentSerializer.serialize(makeFillStrokeShapes()).version, 2);
        assert.equal(JSON.parse(DocumentSerializer.serializeToString(makeFillStrokeShapes())).version, 2);
    });
});
