/**
 * 責務: DocumentSerializerの版1→版2（全図形をfillColor: nullにする）・版2→版3（円・弧の5つの点を今の約束の位置へそろえる）・版3→版4（図形に名前・表示・ロックを補う）の
 * マイグレーションの契約を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック（呼び出し回数の確認に使う）
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 版1の図形データ（fillColorを持たない。5種＋開いた／閉じたパス）を毎回新しく作る。
 * @returns {object[]} 版1の図形データの配列
 */
function makeVersion1Shapes() {
    const two = [{ x: 0, y: 0 }, { x: 10, y: 10 }];
    const five = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 }, { x: 10, y: 0 }, { x: 10, y: 0 }];
    return [
        { type: 'line', id: 'l', points: two.map((p) => ({ ...p })), strokeColor: '#111111', strokeWidth: 3 },
        { type: 'curve', id: 'c', points: [{ x: 0, y: 0 }, { x: 5, y: 9 }, { x: 10, y: 0 }], strokeColor: '#222222', strokeWidth: 4 },
        { type: 'rect', id: 'r', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], strokeColor: '#333333', strokeWidth: 5 },
        { type: 'circle', id: 'ci', points: five.map((p) => ({ ...p })), strokeColor: '#444444', strokeWidth: 6 },
        { type: 'arc', id: 'a', points: five.map((p) => ({ ...p })), strokeColor: '#555555', strokeWidth: 7 },
        {
            type: 'path', id: 'po', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: false,
            segments: [{ kind: 'line' }, { kind: 'line' }], strokeColor: '#666666', strokeWidth: 1,
        },
        {
            type: 'path', id: 'pc', points: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], closed: true,
            segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }], strokeColor: '#777777', strokeWidth: 2,
        },
    ];
}

/**
 * 版1の作業データを作る。
 * @param {*} shapes - shapesに入れる値
 * @returns {object} 版1の作業データ
 */
function makeVersion1Doc(shapes) {
    return { format: 'oz-vector-editor', version: 1, shapes };
}

/**
 * 版1の図形データの版2→3の変換後の期待値（弧の`points[3]`だけが約束の位置の左端(−10, 0)になり、ほかは入力と同じ）を作る。
 * @param {object} item - 版1の図形データ
 * @returns {object} 期待する図形データ（新しいオブジェクト）
 */
function expectedAfterVersion3(item) {
    if (item.type !== 'arc') return item;
    const points = item.points.map((p) => ({ ...p }));
    points[3] = { x: -10, y: 0 };
    return { ...item, points };
}

describe('DocumentSerializer: 版1→版2のマイグレーション', () => {
    it('オブジェクト層で全図形がfillColor: nullで読め、他の項目は元のとおり（弧の開始角の制御点は版2→3の変換で約束の位置へそろう）', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes();
        const result = DocumentSerializer.deserialize(makeVersion1Doc(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        assert.deepEqual(result.skipped, []);
        result.shapes.forEach((shape, i) => {
            const json = shape.toJSON();
            assert.equal(json.fillColor, null);
            const { fillColor, ...rest } = json;
            assert.deepEqual(rest, expectedAfterVersion3(data[i]));
        });
    });

    it('文字列層でも全図形がfillColor: nullで読め、他の項目は元のとおり（弧の開始角の制御点は版2→3の変換で約束の位置へそろう）', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes();
        const result = DocumentSerializer.deserializeFromString(JSON.stringify(makeVersion1Doc(data)));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        result.shapes.forEach((shape, i) => {
            const json = shape.toJSON();
            assert.equal(json.fillColor, null);
            const { fillColor, ...rest } = json;
            assert.deepEqual(rest, expectedAfterVersion3(data[i]));
        });
    });

    it('版1の要素がfillColor（文字列）を持っていてもnullになる', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes().map((item) => ({ ...item, fillColor: '#ff0000' }));
        const result = DocumentSerializer.deserialize(makeVersion1Doc(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        result.shapes.forEach((shape) => {
            assert.equal(shape.toJSON().fillColor, null);
        });
    });

    it('版1でstrokeWidthの無い図形は2pxで読める', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes().map((item) => {
            const { strokeWidth, ...rest } = item;
            return rest;
        });
        const result = DocumentSerializer.deserialize(makeVersion1Doc(data));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, data.length);
        result.shapes.forEach((shape) => {
            assert.equal(shape.toJSON().strokeWidth, 2);
        });
    });

    it('版1のshapesのプレーンオブジェクトでない要素はスキップされ、残りが読める', (t) => {
        const warn = silenceWarn(t);
        const valid = makeVersion1Shapes();
        const shapes = [null, valid[0], 42, valid[1], [1, 2], 'text', valid[2]];
        const result = DocumentSerializer.deserialize(makeVersion1Doc(shapes));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 3);
        assert.deepEqual(result.shapes.map((s) => s.type), ['line', 'curve', 'rect']);
        assert.deepEqual(result.skipped.map((s) => ({ index: s.index, type: s.type })), [
            { index: 0, type: null },
            { index: 2, type: null },
            { index: 4, type: null },
            { index: 5, type: null },
        ]);
        assert.equal(warn.mock.calls.length, 4);
    });

    it('版1でshapesが配列でない場合は全体失敗（警告1回）', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserialize(makeVersion1Doc({ not: 'array' }));
        assert.equal(result.ok, false);
        assert.deepEqual(result.shapes, []);
        assert.deepEqual(result.skipped, []);
        assert.match(result.error, /shapesが配列ではありません/);
        assert.equal(warn.mock.calls.length, 1);
    });

    it('引数の作業データ（shapes・各要素を含む）を書き換えない', (t) => {
        silenceWarn(t);
        const doc = makeVersion1Doc([...makeVersion1Shapes(), null]);
        const snapshot = structuredClone(doc);
        DocumentSerializer.deserialize(doc);
        assert.deepEqual(doc, snapshot);
    });
});

/**
 * 版2の作業データを作る。
 * @param {*} shapes - shapesに入れる値
 * @returns {object} 版2の作業データ
 */
function makeVersion2Doc(shapes) {
    return { format: 'oz-vector-editor', version: 2, shapes };
}

/**
 * 版2の円・弧の図形データを作る。
 * @param {string} type - 'circle'|'arc'
 * @param {{x: number, y: number}[]} points - 5つの点
 * @returns {object} 図形データ
 */
function makeEllipseData(type, points) {
    return { type, id: `e-${type}`, points, strokeColor: '#123456', strokeWidth: 3, fillColor: null };
}

/**
 * 変換だけを通した円・弧の`points`を取り出す（`toJSON()`の`points`）。
 * @param {object} data - 版2の図形データ
 * @returns {{x: number, y: number}[]} 版3へそろえた後の`points`
 */
function alignedPointsOf(data) {
    const result = DocumentSerializer.deserialize(makeVersion2Doc([data]));
    assert.equal(result.ok, true);
    assert.equal(result.shapes.length, 1);
    return result.shapes[0].toJSON().points;
}

describe('DocumentSerializer: 版2→版3のマイグレーション（円・弧の点を約束の位置へそろえる）', () => {
    it('今の約束の位置の円・弧は5つの点とも値を変えない（弧のpoints[3]が数ulpずれていてもそのまま）', (t) => {
        silenceWarn(t);
        const shapes = [
            new Ellipse(0.7, 0, 0.1, 10, 'arc'),
            new Ellipse(0.7, 0, 0.1, 10, 'circle'),
            new Ellipse(100, 200, 160, 230, 'arc'),
            new Ellipse(100, 200, 160, 230, 'circle'),
        ];
        shapes.forEach((shape) => {
            const data = shape.toJSON();
            assert.deepStrictEqual(alignedPointsOf(structuredClone(data)), data.points);
        });
        const arc = shapes[0].toJSON().points;
        assert.notEqual(arc[3].x, arc[0].x - Math.abs(arc[1].x - arc[0].x));
    });

    it('手で書いた見た目に効かない値の円・弧は5つの点とも約束の位置へそろう', (t) => {
        silenceWarn(t);
        const messy = [
            { x: 100, y: 200 }, { x: 40, y: 205 }, { x: 103, y: 230 }, { x: 999, y: 999 }, { x: -5, y: 7 },
        ];
        assert.deepStrictEqual(alignedPointsOf(makeEllipseData('circle', structuredClone(messy))), [
            { x: 100, y: 200 }, { x: 160, y: 200 }, { x: 100, y: 170 }, { x: 160, y: 200 }, { x: 160, y: 200 },
        ]);
        assert.deepStrictEqual(alignedPointsOf(makeEllipseData('arc', structuredClone(messy))), [
            { x: 100, y: 200 }, { x: 160, y: 200 }, { x: 100, y: 170 }, { x: 40, y: 200 }, { x: 160, y: 200 },
        ]);
        const arcRightStart = [
            { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 }, { x: 10, y: 0 }, { x: 10, y: 0 },
        ];
        assert.equal(alignedPointsOf(makeEllipseData('arc', arcRightStart))[3].x, -10);
        const circleLeftStart = [
            { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 }, { x: -10, y: 0 }, { x: 10, y: 0 },
        ];
        assert.equal(alignedPointsOf(makeEllipseData('circle', circleLeftStart))[3].x, 10);
    });

    it('そろえた後の見た目（描画要素）は版2の読み方（rx=|p1.x−xc|・ry=|p2.y−yc|）と同じ', (t) => {
        silenceWarn(t);
        const points = [{ x: 100, y: 200 }, { x: 40, y: 205 }, { x: 103, y: 230 }, { x: 999, y: 999 }, { x: -5, y: 7 }];
        ['circle', 'arc'].forEach((type) => {
            const result = DocumentSerializer.deserialize(makeVersion2Doc([makeEllipseData(type, structuredClone(points))]));
            const element = result.shapes[0].toDrawElement();
            assert.equal(element.x, 100);
            assert.equal(element.y, 200);
            assert.equal(element.radiusX, 60);
            assert.equal(element.radiusY, 30);
            assert.equal(element.rotation, 0);
        });
    });

    it('形の壊れた円・弧（pointsが5つでない・数値でない）はそのまま図形単位でスキップされる', (t) => {
        const warn = silenceWarn(t);
        const good = makeEllipseData('circle', [
            { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 0, y: -10 }, { x: 10, y: 0 }, { x: 10, y: 0 },
        ]);
        const four = makeEllipseData('arc', good.points.slice(0, 4));
        const nan = makeEllipseData('circle', good.points.map((p, i) => (i === 1 ? { x: 'a', y: 0 } : p)));
        const result = DocumentSerializer.deserialize(makeVersion2Doc([four, good, nan]));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 1);
        assert.deepEqual(result.skipped.map((s) => s.index), [0, 2]);
        assert.equal(warn.mock.calls.length, 2);
    });

    it('円・弧以外の図形は変えない', (t) => {
        silenceWarn(t);
        const data = makeVersion1Shapes().filter((s) => s.type !== 'circle' && s.type !== 'arc')
            .map((s) => ({ ...s, fillColor: null }));
        const result = DocumentSerializer.deserialize(makeVersion2Doc(structuredClone(data)));
        assert.deepEqual(result.shapes.map((s) => s.toJSON()), data);
    });

    it('shapesが配列でなければ全体失敗、版は現行版へ上がる', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(makeVersion2Doc('x'));
        assert.equal(result.ok, false);
        assert.match(result.error, /shapesが配列ではありません/);
        const ok = DocumentSerializer.deserialize(makeVersion2Doc([]));
        assert.equal(ok.ok, true);
    });

    it('版1の弧・円は版1→2→3の順に通って約束の位置にそろう', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(makeVersion1Doc(makeVersion1Shapes()));
        const circle = result.shapes[3].toJSON().points;
        const arc = result.shapes[4].toJSON().points;
        assert.deepEqual(circle[3], { x: 10, y: 0 });
        assert.deepEqual(arc[3], { x: -10, y: 0 });
        assert.deepEqual(arc[4], { x: 10, y: 0 });
    });

    it('引数の作業データ（shapes・各要素・points）を書き換えない', (t) => {
        silenceWarn(t);
        const doc = makeVersion2Doc([
            makeEllipseData('arc', [{ x: 100, y: 200 }, { x: 40, y: 205 }, { x: 103, y: 230 }, { x: 9, y: 9 }, { x: 8, y: 8 }]),
            null,
        ]);
        const snapshot = structuredClone(doc);
        DocumentSerializer.deserialize(doc);
        assert.deepEqual(doc, snapshot);
    });

    it('版3の作業データは円・弧の点が変換されず、回した円・弧の点がそのまま読める', (t) => {
        silenceWarn(t);
        const rotated = [
            { x: 100, y: 100 }, { x: 100, y: 130 }, { x: 60, y: 100 }, { x: 100, y: 70 }, { x: 100, y: 130 },
        ];
        const doc = { format: 'oz-vector-editor', version: 3, shapes: [makeEllipseData('arc', structuredClone(rotated))] };
        const result = DocumentSerializer.deserialize(doc);
        assert.equal(result.ok, true);
        assert.deepEqual(result.shapes[0].toJSON().points, rotated);
    });
});
