/**
 * 責務: 図形を書き出したスプライトのJS（`source`なし）から、FileContentReaderが図形を組み立て、
 * 元の図形・書き出したJSの`draw`・組み立てた図形の`draw`・書き出し直した`elements`が同じ見た目になることを、公開APIだけで検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FileContentReader } from '../../js/io/FileContentReader.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { DrawElementReader } from '../../js/io/DrawElementReader.js';
import { ITEM_KIND } from '../../js/core/ItemTreeRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/** 比較の許容差（図形の大きさに対する比）。 */
const RELATIVE_TOLERANCE = 1e-9;

/** 円・弧の輪郭を比べるときの、媒介変数の等分数。 */
const OUTLINE_STEPS = 16;

/**
 * 呼び出しと代入をすべて記録する偽のctxを作る（メソッド名は問わず、どの名前でも呼べる）。
 * @returns {{ctx: object, log: Array<Array<*>>}} 偽のctxと記録（要素は[名前, ...引数]または['set:名前', 値]）
 */
function createRecordingCtx() {
    const log = [];
    const ctx = new Proxy({}, {
        get(_target, name) {
            return (...args) => {
                log.push([String(name), ...args]);
            };
        },
        set(_target, name, value) {
            log.push([`set:${String(name)}`, value]);
            return true;
        },
    });
    return { ctx, log };
}

/**
 * 図形の配列を、それぞれの`draw`で描いた記録を返す。
 * @param {Array<object>} shapes - 図形
 * @returns {Array<Array<*>>} 記録
 */
function recordShapes(shapes) {
    const { ctx, log } = createRecordingCtx();
    for (const shape of shapes) {
        shape.draw(ctx);
    }
    return log;
}

/**
 * 書き出したスプライトの`draw`の前置きの設定と後始末で、図形の記録を挟んだ記録を作る。
 * @param {Array<Array<*>>} shapeLog - 図形の`draw`の記録
 * @returns {Array<Array<*>>} 書き出しの`draw`が出すはずの記録
 */
function wrapAsExport(shapeLog) {
    return [
        ['save'],
        ['set:lineCap', 'butt'],
        ['set:lineJoin', 'miter'],
        ['set:miterLimit', 10],
        ['setLineDash', []],
        ...shapeLog,
        ['restore'],
    ];
}

/**
 * 書き出したJSのテキストを実際に読み込み（`data:`のURL）、既定のexportを返す。
 * @param {string} moduleText - スプライトのJSのテキスト
 * @returns {Promise<object>} 既定のexport（スプライトデータと`draw`を持つ）
 */
async function importModuleText(moduleText) {
    const module = await import(`data:text/javascript;charset=utf-8,${encodeURIComponent(moduleText)}`);
    return module.default;
}

/**
 * アフィン変換2つを合成する（`first`を先に当て、次に`second`を当てる）。
 * @param {{a: number, b: number, c: number, d: number, e: number, f: number}} first - 先に当てる変換
 * @param {{a: number, b: number, c: number, d: number, e: number, f: number}} second - 後に当てる変換
 * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}} 合成した変換
 */
function compose(first, second) {
    return {
        a: second.a * first.a + second.c * first.b,
        b: second.b * first.a + second.d * first.b,
        c: second.a * first.c + second.c * first.d,
        d: second.b * first.c + second.d * first.d,
        e: second.a * first.e + second.c * first.f + second.e,
        f: second.b * first.e + second.d * first.f + second.f,
    };
}

/** 変換の中心（図形の置かれた辺り）。 */
const CENTER = { x: 60, y: 55 };

/**
 * 中心を固定した回転の変換を作る。
 * @param {number} degrees - 回転の角度（度）
 * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}} 変換
 */
function rotation(degrees) {
    const radians = (degrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    return {
        a: cos, b: sin, c: -sin, d: cos,
        e: CENTER.x - cos * CENTER.x + sin * CENTER.y,
        f: CENTER.y - sin * CENTER.x - cos * CENTER.y,
    };
}

/**
 * 中心を固定した拡大縮小・反転の変換を作る（負の倍率が反転）。
 * @param {number} scaleX - 横の倍率
 * @param {number} scaleY - 縦の倍率
 * @returns {{a: number, b: number, c: number, d: number, e: number, f: number}} 変換
 */
function scaling(scaleX, scaleY) {
    return { a: scaleX, b: 0, c: 0, d: scaleY, e: CENTER.x - scaleX * CENTER.x, f: CENTER.y - scaleY * CENTER.y };
}

/**
 * 検証する変換の一覧（名前つき）を作る。拡大縮小（なし・縦横別）× 反転（なし・左右・上下・両方）× 回転（0・30・90・180・斜め）。
 * @returns {Array<{name: string, transform: object}>} 変換の一覧（先頭は何もしない変換）
 */
function buildTransforms() {
    const scales = [['等倍', 1, 1], ['縦横別', 1.7, 0.6]];
    const flips = [['反転なし', 1, 1], ['左右', -1, 1], ['上下', 1, -1], ['左右上下', -1, -1]];
    const angles = [0, 30, 90, 180, 37];
    const list = [];
    for (const [scaleName, sx, sy] of scales) {
        for (const [flipName, fx, fy] of flips) {
            for (const angle of angles) {
                const transform = compose(compose(scaling(sx, sy), scaling(fx, fy)), rotation(angle));
                list.push({ name: `${scaleName}・${flipName}・${angle}度`, transform });
            }
        }
    }
    return list;
}

/**
 * 検証する図形の一覧（名前つき）を作る。
 * @returns {Array<{name: string, create: function(): object}>} 図形を新しく作る関数の一覧
 */
function buildShapeCases() {
    const open = [{ x: 10, y: 20 }, { x: 50, y: 10 }, { x: 90, y: 60 }, { x: 40, y: 95 }];
    const five = [{ x: 10, y: 20 }, { x: 40, y: 5 }, { x: 80, y: 30 }, { x: 95, y: 70 }, { x: 30, y: 90 }];
    const bezier = (c1x, c1y, c2x, c2y) => ({ kind: 'bezier', control1: { x: c1x, y: c1y }, control2: { x: c2x, y: c2y } });
    return [
        { name: '直線', create: () => new Line(10, 20, 110, 90, '#ff0000', 3) },
        { name: '今の曲線', create: () => new Curve(0, 0, 100, 60, '#00aa00', 2) },
        { name: '矩形（塗りあり）', create: () => new Rect(20, 30, 100, 80, '#0000ff', 4, '#ffcc00') },
        { name: '円（塗りあり）', create: () => new Ellipse(20, 30, 100, 80, 'circle', '#123456', 4, '#00ff00') },
        { name: '弧', create: () => new Ellipse(20, 30, 100, 80, 'arc', '#abcdef', 3) },
        { name: '開いたパス（直線だけ）', create: () => new Path(open, false, '#111111', 3) },
        { name: '閉じたパス（直線だけ・塗りあり）', create: () => new Path(open, true, '#222222', 2, '#ff00ff') },
        { name: '開いたパス（曲線）', create: () => new Path(five, false, '#333333', 2, null, 'smooth') },
        { name: '閉じたパス（曲線・塗りあり）', create: () => new Path(five, true, '#444444', 2, '#00ffff', 'smooth') },
        {
            name: '開いたパス（曲がり方を持つ区間）',
            create: () => new Path(open, false, '#555555', 2, null, [bezier(20, 0, 40, 30), bezier(70, 20, 80, 40), bezier(80, 90, 60, 100)]),
        },
        {
            name: '閉じたパス（曲がり方を持つ区間・塗りあり）',
            create: () => new Path(open, true, '#666666', 2, '#ccff00', [bezier(20, 0, 40, 30), bezier(70, 20, 80, 40), bezier(80, 90, 60, 100), bezier(10, 70, 5, 40)]),
        },
        {
            name: '開いたパス（直線・曲線・曲がり方を持つ区間の混ざり）',
            create: () => new Path(five, false, '#777777', 2, null, [{ kind: 'line' }, { kind: 'smooth' }, bezier(90, 40, 100, 60), { kind: 'line' }]),
        },
        {
            name: '閉じたパス（混ざり・塗りあり）',
            create: () => new Path(five, true, '#888888', 2, '#aabbcc', [{ kind: 'smooth' }, { kind: 'line' }, bezier(90, 40, 100, 60), { kind: 'smooth' }, { kind: 'smooth' }]),
        },
        {
            name: '開いたパス（角の点）',
            create: () => new Path(five, false, '#999999', 2, null, 'smooth', [false, false, true, false, false]),
        },
        {
            name: '閉じたパス（角の点・塗りあり）',
            create: () => new Path(five, true, '#aaaaaa', 2, '#bbbbbb', 'smooth', [true, false, true, false, false]),
        },
    ];
}

/**
 * 値が数値なら許容差内で、配列・オブジェクトなら中身を再帰的に比べる（キーの並びも見る）。
 * @param {*} actual - 実際の値
 * @param {*} expected - 期待する値
 * @param {number} tolerance - 数値の許容差
 * @param {string} where - 失敗時に示す場所
 */
function assertClose(actual, expected, tolerance, where) {
    if (typeof expected === 'number' && typeof actual === 'number') {
        assert.ok(Math.abs(actual - expected) <= tolerance, `${where}: ${actual} と ${expected} の差が許容差${tolerance}を超える`);
        return;
    }
    if (Array.isArray(expected)) {
        assert.ok(Array.isArray(actual), `${where}: 配列ではない`);
        assert.equal(actual.length, expected.length, `${where}: 要素数が違う`);
        expected.forEach((value, index) => assertClose(actual[index], value, tolerance, `${where}[${index}]`));
        return;
    }
    if (typeof expected === 'object' && expected !== null) {
        assert.ok(typeof actual === 'object' && actual !== null, `${where}: オブジェクトではない`);
        assert.deepStrictEqual(Object.keys(actual), Object.keys(expected), `${where}: キーの並びが違う`);
        for (const key of Object.keys(expected)) {
            assertClose(actual[key], expected[key], tolerance, `${where}.${key}`);
        }
        return;
    }
    assert.deepStrictEqual(actual, expected, `${where}: 値が違う`);
}

/**
 * 楕円（`ctx.ellipse`の引数）を、同じ形を表す別の値でも同じになる特徴へ直す。
 * 1周なら中心と輪郭の形（`A = rx²cos²φ + ry²sin²φ`・`B = (rx² − ry²)sinφcosφ`・`C = rx²sin²φ + ry²cos²φ`）、
 * 1周でなければ媒介変数を等分した輪郭の点の並び。
 * @param {{x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number}} e - 楕円の引数
 * @returns {object} 特徴
 */
function ellipseFeature(e) {
    const cos = Math.cos(e.rotation);
    const sin = Math.sin(e.rotation);
    let sweep = e.endAngle - e.startAngle;
    if (sweep < 0) {
        sweep += 2 * Math.PI;
    }
    if (Math.abs(sweep - 2 * Math.PI) < 1e-6) {
        return {
            shape: 'full',
            x: e.x,
            y: e.y,
            A: e.radiusX ** 2 * cos ** 2 + e.radiusY ** 2 * sin ** 2,
            B: (e.radiusX ** 2 - e.radiusY ** 2) * sin * cos,
            C: e.radiusX ** 2 * sin ** 2 + e.radiusY ** 2 * cos ** 2,
        };
    }
    const points = [];
    for (let i = 0; i <= OUTLINE_STEPS; i++) {
        const t = e.startAngle + (sweep * i) / OUTLINE_STEPS;
        const px = e.radiusX * Math.cos(t);
        const py = e.radiusY * Math.sin(t);
        points.push({ x: e.x + px * cos - py * sin, y: e.y + px * sin + py * cos });
    }
    return { shape: 'arc', points };
}

/**
 * 描画の記録のうち`ellipse`の呼び出しを、`ellipseFeature`へ置き換えた記録を返す（ほかは変えない）。
 * @param {Array<Array<*>>} log - 描画の記録
 * @returns {Array<Array<*>>} 置き換えた記録
 */
function looseEllipseLog(log) {
    return log.map((entry) => {
        if (entry[0] !== 'ellipse') {
            return entry;
        }
        const [, x, y, radiusX, radiusY, rotation, startAngle, endAngle] = entry;
        return ['ellipse', ellipseFeature({ x, y, radiusX, radiusY, rotation, startAngle, endAngle })];
    });
}

/**
 * `elements`のうち`ellipse`の描画要素を、`ellipseFeature`へ置き換えた配列を返す（ほかは変えない）。
 * @param {Array<object>} elements - 描画要素の並び
 * @returns {Array<object>} 置き換えた並び
 */
function looseEllipseElements(elements) {
    return elements.map((element) => (element.kind === 'ellipse'
        ? {
            kind: 'ellipse',
            closed: element.closed,
            strokeColor: element.strokeColor,
            strokeWidth: element.strokeWidth,
            fillColor: element.fillColor,
            feature: ellipseFeature({ ...element, rotation: Number.isFinite(element.rotation) ? element.rotation : 0 }),
        }
        : element));
}

/**
 * 図形の大きさに合わせた許容差を返す。
 * @param {{minX: number, minY: number, maxX: number, maxY: number}} bounds - 外枠
 * @returns {number} 許容差
 */
function toleranceFor(bounds) {
    return RELATIVE_TOLERANCE * Math.max(1, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
}

/**
 * 図形を書き出し、JSのテキストにして読み、組み立てた図形・書き出したスプライトを返す。
 * @param {Array<object>} shapes - 図形
 * @returns {Promise<{data: object, text: string, sprite: object, result: object}>} 書き出しと読み込みの結果
 */
async function exportAndRead(shapes) {
    const data = SpriteSerializer.serialize(shapes);
    const text = CodeExporter.toModuleText(data);
    const sprite = await importModuleText(text);
    const result = FileContentReader.deserializeFromText(text);
    return { data, text, sprite, result };
}

/**
 * 元の図形・書き出したJSの`draw`・組み立てた図形の`draw`と、書き出し直した`elements`・`bounds`が一致することを確かめる。
 * `ellipse`の緩め（組み立てた図形との比較に限る）：回した・裏返した円・弧は、組み立てると`Ellipse`の分解の取り方により、
 * 同じ形を表す別の値（`rotation`・`startAngle`・半径の並びが違う）で書き出し直されることがあるため、輪郭の形・点の並びで比べる。
 * 元の図形と書き出したJSの`draw`は、組み立てを挟まないため、`ellipse`の引数もそのまま比べる。
 * @param {Array<object>} shapes - 元の図形
 * @param {string} where - 失敗時に示す場所
 */
async function assertFullRoundTrip(shapes, where) {
    const { data, sprite, result } = await exportAndRead(shapes);
    assert.equal(result.ok, true, `${where}: 読み込めない`);
    assert.deepStrictEqual(result.skipped, [], `${where}: 読み飛ばしがある`);
    assert.equal(result.shapes.length, shapes.length, `${where}: 図形の数が違う`);
    const tolerance = toleranceFor(data.bounds);

    const original = wrapAsExport(recordShapes(shapes));
    const exported = (() => {
        const { ctx, log } = createRecordingCtx();
        sprite.draw(ctx);
        return log;
    })();
    assertClose(exported, original, tolerance, `${where}: 書き出したJSのdraw`);

    const rebuilt = wrapAsExport(recordShapes(result.shapes));
    assertClose(looseEllipseLog(rebuilt), looseEllipseLog(exported), tolerance, `${where}: 組み立てた図形のdraw`);

    const again = SpriteSerializer.serialize(result.shapes);
    assertClose(again.bounds, data.bounds, tolerance, `${where}: 書き出し直したbounds`);
    assert.deepStrictEqual(Object.keys(again), Object.keys(data), `${where}: 書き出し直したキーの並び`);
    assertClose(looseEllipseElements(again.elements), looseEllipseElements(data.elements), tolerance, `${where}: 書き出し直したelements`);
}

/**
 * 図形一式を作り、それぞれにidを付ける。
 * @param {Array<{create: function(): object}>} cases - 図形の一覧
 * @returns {Array<object>} 図形
 */
function createAll(cases) {
    return cases.map((c, index) => {
        const shape = c.create();
        shape.id = `shape-${index}`;
        return shape;
    });
}

describe('スプライトの往復: 図形の種類 × 変換', () => {
    const transforms = buildTransforms();
    for (const shapeCase of buildShapeCases()) {
        it(`${shapeCase.name}：書き出し→組み立て→描画→書き出し直しが同じ見た目（拡大縮小・反転・回転${transforms.length}通り）`, async () => {
            for (const { name, transform } of transforms) {
                const shape = shapeCase.create().createTransformed(transform);
                await assertFullRoundTrip([shape], `${shapeCase.name}・${name}`);
            }
        });
    }

    it('全種類を1つのスプライトにしても、図形の種類・塗り・重なり順が保たれる', async () => {
        const cases = buildShapeCases();
        const shapes = createAll(cases);
        await assertFullRoundTrip(shapes, '全種類');
        const { result } = await exportAndRead(shapes);
        assert.deepStrictEqual(result.shapes.map((s) => s.type), [
            'line', 'curve', 'path', 'circle', 'arc', 'path', 'path', 'path', 'path', 'path', 'path', 'path', 'path', 'path', 'path',
        ]);
        result.shapes.forEach((shape, index) => {
            assert.equal(shape.strokeColor, shapes[index].strokeColor, `${cases[index].name}: 線の色`);
            assert.equal(shape.strokeWidth, shapes[index].strokeWidth, `${cases[index].name}: 線の太さ`);
            assert.equal(shape.fillColor, shapes[index].fillColor, `${cases[index].name}: 塗り`);
        });
    });

    it('変換した図形をまとめて1つのスプライトにしても同じ見た目', async () => {
        const transforms2 = buildTransforms().filter((_, index) => index % 7 === 3);
        const cases = buildShapeCases();
        const shapes = [];
        transforms2.forEach(({ transform }, index) => {
            const shape = cases[index % cases.length].create().createTransformed(transform);
            shape.id = `t-${index}`;
            shapes.push(shape);
        });
        await assertFullRoundTrip(shapes, '変換した図形のまとめ');
    });
});

describe('スプライトの往復: 組み立てた図形の種類と値', () => {
    it('矩形は4点・4区間の閉じたパス（path）になり、線と塗りが保たれる', async () => {
        const rect = new Rect(20, 30, 100, 80, '#0000ff', 4, '#ffcc00');
        const { result } = await exportAndRead([rect]);
        const [shape] = result.shapes;
        assert.equal(shape.type, 'path');
        assert.equal(shape.closed, true);
        assert.equal(shape.points.length, 4);
        assert.deepStrictEqual(shape.segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        assert.equal(shape.strokeColor, '#0000ff');
        assert.equal(shape.strokeWidth, 4);
        assert.equal(shape.fillColor, '#ffcc00');
    });

    it('回していない円・約束の位置の弧は、組み立てても引数そのものが同じ（緩めなし）', async () => {
        const shapes = [
            new Ellipse(20, 30, 100, 80, 'circle', '#123456', 4, '#00ff00'),
            new Ellipse(20, 30, 100, 80, 'arc', '#abcdef', 3),
        ];
        const scaled = shapes.map((s) => s.createTransformed(scaling(1.7, 0.6)));
        for (const target of [shapes, scaled]) {
            const { sprite, result } = await exportAndRead(target);
            const { ctx, log } = createRecordingCtx();
            sprite.draw(ctx);
            const tolerance = toleranceFor(SpriteSerializer.serialize(target).bounds);
            assertClose(wrapAsExport(recordShapes(result.shapes)), log, tolerance, '組み立てた図形のdraw（緩めなし）');
        }
    });

    it('曲線の区間は曲がり方を持つ区間になり、角の点は付かない', async () => {
        const path = new Path([{ x: 10, y: 20 }, { x: 50, y: 10 }, { x: 90, y: 60 }], false, '#333333', 2, null, 'smooth');
        const { result } = await exportAndRead([path]);
        const [shape] = result.shapes;
        assert.deepStrictEqual(shape.segments.map((s) => s.kind), ['bezier', 'bezier']);
        assert.deepStrictEqual(shape.corners, [false, false, false]);
    });
});

describe('スプライトの往復: 組み立てた図形の編集', () => {
    it('動かす・createTransformedしても、元の図形に同じ操作をしたものと同じ見た目になる', async () => {
        const transform = compose(scaling(1.5, 0.8), rotation(30));
        for (const shapeCase of buildShapeCases()) {
            const original = shapeCase.create();
            const { result } = await exportAndRead([original]);
            const rebuilt = result.shapes[0];
            const tolerance = toleranceFor(SpriteSerializer.serialize([original]).bounds);

            rebuilt.translate(7, -3);
            original.translate(7, -3);
            assertClose(looseEllipseLog(recordShapes([rebuilt])), looseEllipseLog(recordShapes([original])), tolerance, `${shapeCase.name}: 動かした後`);

            const rebuiltTransformed = rebuilt.createTransformed(transform);
            const originalTransformed = original.createTransformed(transform);
            assertClose(
                looseEllipseLog(recordShapes([rebuiltTransformed])),
                looseEllipseLog(recordShapes([originalTransformed])),
                tolerance,
                `${shapeCase.name}: createTransformedした後`,
            );
        }
    });

    it('作業データの往復（DocumentSerializer）をしても、組み立てた図形の見た目は変わらない', async () => {
        const shapes = createAll(buildShapeCases()).map((s, index) => s.createTransformed(buildTransforms()[(index * 5 + 7) % 40]));
        const { result } = await exportAndRead(shapes);
        const text = DocumentSerializer.serialize(result.shapes);
        const restored = DocumentSerializer.deserialize(JSON.parse(JSON.stringify(text)));
        assert.equal(restored.ok, true);
        assert.deepStrictEqual(restored.skipped, []);
        const tolerance = toleranceFor(SpriteSerializer.serialize(shapes).bounds);
        assertClose(recordShapes(restored.shapes), recordShapes(result.shapes), tolerance, '作業データの往復');
    });
});

describe('スプライトの往復: 書き出しのテキストと引数', () => {
    it('書き出したJSのテキストに"source"・"id"・"name"が無い（idや名前を持つ図形でも）', () => {
        const shapes = createAll(buildShapeCases());
        const items = shapes.map((shape, index) => ({ kind: ITEM_KIND.SHAPE, shape, name: `名前-${index}` }));
        for (const values of [shapes, items]) {
            const text = CodeExporter.toModuleText(SpriteSerializer.serialize(values));
            for (const key of ['"source"', '"id"', '"name"']) {
                assert.ok(!text.includes(key), `${key}が含まれている`);
            }
        }
    });

    it('書き出し・テキスト化・読み込み・組み立てが、引数を書き換えない', () => {
        const shapes = createAll(buildShapeCases());
        const shapesBefore = JSON.stringify(shapes.map((s) => s.toJSON()));
        const data = SpriteSerializer.serialize(shapes);
        assert.equal(JSON.stringify(shapes.map((s) => s.toJSON())), shapesBefore);

        const dataBefore = JSON.stringify(data);
        const text = CodeExporter.toModuleText(data);
        assert.equal(JSON.stringify(data), dataBefore);

        const elementsBefore = JSON.stringify(data.elements);
        for (const element of data.elements) {
            DrawElementReader.toShapeData(element);
        }
        DocumentSerializer.deserializeShapeElements(data.elements, (element) => DrawElementReader.toShapeData(element));
        assert.equal(JSON.stringify(data.elements), elementsBefore);

        const result = FileContentReader.deserializeFromText(text);
        assert.equal(result.ok, true);
        assert.equal(JSON.stringify(data), dataBefore);
    });
});
