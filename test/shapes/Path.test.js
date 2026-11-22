/**
 * 責務: パス（Path）の当たり判定（輪郭・内側）・頂点のハンドル・塗れる形（isFillable）・描画命令（塗り・線なし）・
 * fromJSONの不正な図形データのエラー文・図形データと描画要素への変換・ハンドルの位置（getHandlePosition）・頂点のハンドル名の一覧（getVertexHandleNames）・コンストラクタ（区間の種類の配列）・変形を当てた新しい図形の生成（createTransformed）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Path, SEGMENT_KIND_LINE, SEGMENT_KIND_SMOOTH, SEGMENT_KIND_BEZIER, readCornerFlags } from '../../js/shapes/Path.js';
import { applyAffineTransformToPoint, computeSmoothSegmentControls, cubicBezierPoint } from '../../js/shapes/ShapeGeometry.js';

/**
 * 標準のパスの頂点を新しく作る。頂点は(0,0)・(100,0)・(100,100)・(0,100)。
 * @returns {{x: number, y: number}[]} 頂点の並び
 */
function makePoints() {
    return [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 100 },
        { x: 0, y: 100 },
    ];
}

/**
 * 標準のパスを作る。開いたパスは区間3、閉じたパスは区間4（終点→始点の区間はx = 0の縦線）。
 * @param {boolean} closed - 閉じたパスにするか
 * @returns {Path} 標準のパス
 */
function makePath(closed) {
    return new Path(makePoints(), closed);
}

/**
 * 正常な図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @param {boolean} closed - 閉じたパスの図形データにするか
 * @returns {{type: string, id: string, points: {x: number, y: number}[], closed: boolean, segments: {kind: string}[], strokeColor: string, strokeWidth: number, fillColor: string|null}} 正常な図形データ
 */
function makeValidData(closed) {
    const data = makePath(closed).toJSON();
    data.id = 'shape-1';
    return data;
}

/**
 * Path.fromJSONが指定の図形データでErrorを投げ、メッセージが「Path.fromJSON: 理由」の全文と一致することを確かめる。
 * @param {*} data - fromJSONへ渡す図形データ
 * @param {string} reason - 「Path.fromJSON: 」の後ろに続く理由
 * @returns {void}
 */
function assertFromJSONError(data, reason) {
    assert.throws(() => Path.fromJSON(data), { name: 'Error', message: 'Path.fromJSON: ' + reason });
}

/**
 * メソッド呼び出しとプロパティ代入を記録する偽のctxを作る。
 * @returns {{ctx: Object, log: Array}} 偽のctxと記録の配列（呼び出しは[名前, ...引数]、代入は['set', 名前, 値]）
 */
function makeRecordingCtx() {
    const log = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'closePath', 'stroke', 'fill', 'rect']) {
        ctx[name] = (...args) => {
            log.push([name, ...args]);
        };
    }
    for (const name of ['strokeStyle', 'lineWidth', 'fillStyle']) {
        Object.defineProperty(ctx, name, {
            set(value) {
                log.push(['set', name, value]);
            },
        });
    }
    return { ctx, log };
}

describe('Path.hitTest', () => {
    for (const closed of [false, true]) {
        const label = closed ? '閉じたパス' : '開いたパス';

        it(`${label}: 区間の上は当たる`, () => {
            const p = makePath(closed);
            assert.equal(p.hitTest(50, 0, 0), true);
            assert.equal(p.hitTest(100, 50, 0), true);
            assert.equal(p.hitTest(50, 100, 0), true);
        });

        it(`${label}: 塗り内部（中央）は当たらない`, () => {
            assert.equal(makePath(closed).hitTest(50, 50, 5), false);
        });

        it(`${label}: 許容誤差ちょうど（区間から距離5）は当たる`, () => {
            const p = makePath(closed);
            assert.equal(p.hitTest(50, -5, 5), true);
            assert.equal(p.hitTest(50, 5, 5), true);
        });

        it(`${label}: 許容誤差の外（距離6）は当たらない`, () => {
            const p = makePath(closed);
            assert.equal(p.hitTest(50, -6, 5), false);
            assert.equal(p.hitTest(50, 6, 5), false);
        });
    }

    it('開いたパス: 始点・終点の外側の延長上（端点から距離6）は当たらない', () => {
        const p = makePath(false);
        assert.equal(p.hitTest(-6, 0, 5), false);
        assert.equal(p.hitTest(-6, 100, 5), false);
    });

    it('終点→始点の区間上は閉じたパスだけが当たる', () => {
        assert.equal(makePath(true).hitTest(0, 50, 0), true);
        assert.equal(makePath(false).hitTest(0, 50, 5), false);
    });

    it('頂点を動かした後の区間で判定する', () => {
        const p = makePath(false);
        p.setVertex(1, 100, -50);
        assert.equal(p.hitTest(100, -50, 0), true);
        assert.equal(p.hitTest(100, 0, 5), true);
        assert.equal(p.hitTest(50, 0, 5), false);
    });

    it('平行移動した後の区間で判定する', () => {
        const p = makePath(true);
        p.translate(200, 300);
        assert.equal(p.hitTest(250, 300, 0), true);
        assert.equal(p.hitTest(200, 350, 0), true);
        assert.equal(p.hitTest(50, 0, 5), false);
    });

    it('長さ0の区間を含むパスでも区間上が当たり例外を投げない', () => {
        const p = new Path([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }]);
        assert.equal(p.hitTest(0, 0, 0), true);
        assert.equal(p.hitTest(50, 0, 0), true);
        assert.equal(p.hitTest(50, 6, 5), false);
        assert.equal(p.hitTest(-6, 0, 5), false);
    });

    it('strokeWidthを大きくしても許容誤差に足されない', () => {
        const p = new Path(makePoints(), true, '#000000', 40);
        assert.equal(p.hitTest(50, -6, 5), false);
        assert.equal(p.hitTest(50, -5, 5), true);
    });
});

/**
 * 塗り色つきの閉じたパスを作る。
 * @param {{x: number, y: number}[]} points - 頂点の並び
 * @param {string|null} [fillColor='#ff0000'] - 塗りの色
 * @param {string|null} [strokeColor='#000000'] - 線の色
 * @returns {Path} 閉じたパス
 */
function makeFilledClosed(points, fillColor = '#ff0000', strokeColor = '#000000') {
    return new Path(points, true, strokeColor, 2, fillColor);
}

describe('Path.hitTestFill', () => {
    it('塗られた閉じたパス: 内側は真・外側は偽', () => {
        const p = makeFilledClosed(makePoints());
        assert.equal(p.hitTestFill(50, 50), true);
        assert.equal(p.hitTestFill(1, 1), true);
        assert.equal(p.hitTestFill(-1, 50), false);
        assert.equal(p.hitTestFill(101, 50), false);
        assert.equal(p.hitTestFill(50, 200), false);
    });

    it('境界上（辺・頂点・閉じる区間）は偽', () => {
        const p = makeFilledClosed(makePoints());
        assert.equal(p.hitTestFill(50, 0), false);
        assert.equal(p.hitTestFill(100, 50), false);
        assert.equal(p.hitTestFill(0, 50), false);
        assert.equal(p.hitTestFill(0, 0), false);
        assert.equal(p.hitTestFill(100, 100), false);
    });

    it('fillColorがnullなら偽', () => {
        assert.equal(makeFilledClosed(makePoints(), null).hitTestFill(50, 50), false);
    });

    it('strokeColorがnullでも塗られていれば真', () => {
        assert.equal(makeFilledClosed(makePoints(), '#ff0000', null).hitTestFill(50, 50), true);
    });

    it('開いたパスはfillColorが文字列でも偽（閉じれば内側になる位置でも）', () => {
        const p = new Path(makePoints(), false, '#000000', 2, '#ff0000');
        assert.equal(p.hitTestFill(50, 50), false);
        assert.equal(p.hitTestFill(10, 50), false);
    });

    it('凹型（矢じり形）: 本体は真・くぼみは偽', () => {
        const p = makeFilledClosed([
            { x: 20, y: 0 },
            { x: -10, y: -10 },
            { x: -4, y: 0 },
            { x: -10, y: 10 },
        ]);
        assert.equal(p.hitTestFill(0, 0), true);
        assert.equal(p.hitTestFill(-7, 0), false);
        assert.equal(p.hitTestFill(-8, -7), true);
    });

    it('自己交差（五芒星）: 中心と先端の三角形の内側は真・星の外は偽', () => {
        const star = [];
        for (const k of [0, 2, 4, 1, 3]) {
            const angle = ((-90 + 72 * k) * Math.PI) / 180;
            star.push({ x: 100 * Math.cos(angle), y: 100 * Math.sin(angle) });
        }
        const p = makeFilledClosed(star);
        assert.equal(p.hitTestFill(0, 0), true);
        assert.equal(p.hitTestFill(0, -95), true);
        assert.equal(p.hitTestFill(0, -120), false);
        assert.equal(p.hitTestFill(100, 100), false);
    });

    it('巻き数0の穴: 穴の中は偽・塗られている帯は真', () => {
        const p = makeFilledClosed([
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
            { x: 0, y: 100 },
            { x: 0, y: 0 },
            { x: 25, y: 25 },
            { x: 25, y: 75 },
            { x: 75, y: 75 },
            { x: 75, y: 25 },
            { x: 25, y: 25 },
        ]);
        assert.equal(p.hitTestFill(50, 50), false);
        assert.equal(p.hitTestFill(10, 50), true);
        assert.equal(p.hitTestFill(90, 50), true);
        assert.equal(p.hitTestFill(50, 10), true);
    });

    it('長さ0の区間（重複する頂点）を含んでも例外を投げず判定できる', () => {
        const p = makeFilledClosed([
            { x: 0, y: 0 },
            { x: 0, y: 0 },
            { x: 100, y: 0 },
            { x: 100, y: 100 },
        ]);
        assert.doesNotThrow(() => p.hitTestFill(50, 20));
        assert.equal(p.hitTestFill(80, 20), true);
        assert.equal(p.hitTestFill(20, 80), false);
        assert.equal(p.hitTestFill(0, 0), false);
    });

    it('許容誤差を使わない（境界のすぐ外は偽）', () => {
        const p = makeFilledClosed(makePoints());
        assert.equal(p.hitTestFill(-0.5, 50), false);
        assert.equal(p.hitTestFill(0.5, 50), true);
    });

    it('translate後は移動先で真・元の位置で偽', () => {
        const p = makeFilledClosed(makePoints());
        p.translate(200, 300);
        assert.equal(p.hitTestFill(250, 350), true);
        assert.equal(p.hitTestFill(50, 50), false);
    });

    it('toJSON→fromJSONの往復後も同じ結果', () => {
        const original = makeFilledClosed(makePoints());
        const data = original.toJSON();
        data.id = 'shape-1';
        const restored = Path.fromJSON(data);
        for (const [x, y] of [[50, 50], [150, 50], [0, 50], [10, 90]]) {
            assert.equal(restored.hitTestFill(x, y), original.hitTestFill(x, y));
        }
        assert.equal(restored.hitTestFill(50, 50), true);
    });

    it('塗られている条件がtoDrawElementの塗る条件と一致する（開いた／閉じた × fillColorの有無）', () => {
        for (const closed of [false, true]) {
            for (const fillColor of [null, '#ff0000']) {
                const p = new Path(makePoints(), closed, '#000000', 2, fillColor);
                const element = p.toDrawElement();
                const fills = typeof element.fillColor === 'string' && element.kind === 'polyline' && element.closed === true;
                assert.equal(p.hitTestFill(50, 50), fills, `closed=${closed}, fillColor=${fillColor}`);
            }
        }
    });
});

describe('Path.intersectsRect', () => {
    for (const closed of [false, true]) {
        const label = closed ? '閉じたパス' : '開いたパス';

        it(`${label}: 矩形が区間に掛かる`, () => {
            assert.equal(makePath(closed).intersectsRect(90, -10, 110, 10), true);
        });

        it(`${label}: パス全体を内側に含む`, () => {
            assert.equal(makePath(closed).intersectsRect(-10, -10, 110, 110), true);
        });

        it(`${label}: 塗り内部だけを囲む場合はfalse`, () => {
            assert.equal(makePath(closed).intersectsRect(30, 30, 70, 70), false);
        });

        it(`${label}: 完全に外れる場合はfalse`, () => {
            assert.equal(makePath(closed).intersectsRect(200, 200, 300, 300), false);
        });

        it(`${label}: 境界にちょうど接する場合はtrue`, () => {
            const p = makePath(closed);
            assert.equal(p.intersectsRect(100, 40, 120, 60), true);
            assert.equal(p.intersectsRect(40, -20, 60, 0), true);
        });
    }

    it('終点→始点の区間だけに掛かる矩形は閉じたパスだけがtrue', () => {
        assert.equal(makePath(true).intersectsRect(-5, 40, 5, 60), true);
        assert.equal(makePath(false).intersectsRect(-5, 40, 5, 60), false);
    });

    it('頂点を動かした後の区間で判定する', () => {
        const p = makePath(false);
        p.setVertex(1, 100, -50);
        assert.equal(p.intersectsRect(90, -60, 110, -40), true);
        assert.equal(p.intersectsRect(40, -5, 60, 5), false);
    });

    it('平行移動した後の区間で判定する', () => {
        const p = makePath(true);
        p.translate(200, 300);
        assert.equal(p.intersectsRect(190, 340, 210, 360), true);
        assert.equal(p.intersectsRect(-5, 40, 5, 60), false);
    });

    it('長さ0の区間を含む場合', () => {
        const p = new Path([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }]);
        assert.equal(p.intersectsRect(-5, -5, 5, 5), true);
        assert.equal(p.intersectsRect(40, -5, 60, 5), true);
        assert.equal(p.intersectsRect(40, 10, 60, 20), false);
    });
});

describe('Path の頂点のハンドル', () => {
    it('各頂点の位置でhitTestHandleが vertex-<i> を返し、番号に解決でき、setVertexでその頂点だけが動く', () => {
        const base = makePoints();
        base.forEach((vertex, i) => {
            const p = makePath(false);
            const name = p.hitTestHandle(vertex.x, vertex.y, 5);
            assert.equal(name, `vertex-${i}`);
            assert.equal(p.getVertexIndexForHandle(name), i);
            p.setVertex(i, 500, 600);
            const expected = makePoints();
            expected[i] = { x: 500, y: 600 };
            assert.deepEqual(p.points, expected);
        });
    });

    it('閉じたパスでも各頂点のハンドルが得られる', () => {
        const p = makePath(true);
        assert.equal(p.hitTestHandle(0, 100, 5), 'vertex-3');
    });

    it('頂点以外（区間の中ほど等）ではnullで、moveを返さない', () => {
        const p = makePath(true);
        assert.equal(p.hitTestHandle(50, 0, 5), null);
        assert.equal(p.hitTestHandle(50, 50, 5), null);
        assert.equal(p.hitTestHandle(0, 50, 5), null);
    });

    it('許容誤差ちょうど（距離5）は当たり、距離6は当たらない', () => {
        const p = makePath(false);
        assert.equal(p.hitTestHandle(5, 0, 5), 'vertex-0');
        assert.equal(p.hitTestHandle(6, 0, 5), null);
    });

    it('ハンドルが重なるときは番号の小さい頂点が選ばれる', () => {
        const same = new Path([{ x: 10, y: 10 }, { x: 10, y: 10 }, { x: 100, y: 10 }]);
        assert.equal(same.hitTestHandle(10, 10, 5), 'vertex-0');
        const near = new Path([{ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 100, y: 0 }]);
        assert.equal(near.hitTestHandle(2, 0, 5), 'vertex-0');
        assert.equal(near.hitTestHandle(8, 0, 5), 'vertex-1');
    });

    it('頂点が10個以上のパスで2桁の番号が解決できる', () => {
        const points = Array.from({ length: 13 }, (_, i) => ({ x: i * 50, y: 0 }));
        const p = new Path(points);
        const name = p.hitTestHandle(600, 0, 5);
        assert.equal(name, 'vertex-12');
        assert.equal(p.getVertexIndexForHandle(name), 12);
    });

    it('getVertexIndexForHandleは不正な名前でnullを返し例外を投げない', () => {
        const p = makePath(false);
        const invalid = ['move', 'start', 'vertex-', 'vertex-01', 'vertex--1', 'vertex-1.5', 'vertex-4', 'vertex-99', null, undefined, 0];
        for (const name of invalid) {
            assert.equal(p.getVertexIndexForHandle(name), null, String(name));
        }
        assert.equal(p.getVertexIndexForHandle('vertex-0'), 0);
        assert.equal(p.getVertexIndexForHandle('vertex-3'), 3);
    });

    it('setVertexは範囲外・不正な番号で例外を投げずtoJSON()が変わらない', () => {
        const p = makePath(true);
        p.id = 'shape-1';
        const before = p.toJSON();
        for (const index of [-1, 4, 1.5, null, '1', NaN, undefined]) {
            assert.doesNotThrow(() => p.setVertex(index, 7, 8));
            assert.deepEqual(p.toJSON(), before, String(index));
        }
    });

    it('updateDraftEndは終点だけを動かす', () => {
        const p = makePath(false);
        p.updateDraftEnd(300, 400);
        const expected = makePoints();
        expected[3] = { x: 300, y: 400 };
        assert.deepEqual(p.points, expected);
    });

    it('translateは全頂点を動かし、区間・閉じているかは変えない', () => {
        const p = makePath(true);
        p.translate(10, -20);
        assert.deepEqual(p.points, makePoints().map(({ x, y }) => ({ x: x + 10, y: y - 20 })));
        assert.equal(p.closed, true);
        assert.equal(p.segments.length, 4);
    });
});

describe('Path.fromJSON のエラー文', () => {
    it('正常なデータは例外を投げずtoJSON()が元のデータと一致する', () => {
        const cases = [
            makeValidData(false),
            makeValidData(true),
            Object.assign(new Path([{ x: 1, y: 2 }, { x: 3, y: 4 }]), { id: 'a' }).toJSON(),
            Object.assign(new Path([{ x: 0, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 5 }], true, '#ff0000', 3), { id: 'b' }).toJSON(),
            Object.assign(new Path([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 }]), { id: 'c' }).toJSON(),
        ];
        for (const data of cases) {
            const path = Path.fromJSON(data);
            assert.ok(path instanceof Path);
            assert.deepEqual(path.toJSON(), data);
        }
    });

    describe('共通項目', () => {
        it('図形データがオブジェクトでない', () => {
            for (const bad of [null, [], 'path', 42, undefined]) {
                assertFromJSONError(bad, '図形データがオブジェクトではありません');
            }
        });

        it('図形種別の不一致（他の種別・キーなし）', () => {
            assertFromJSONError({ ...makeValidData(false), type: 'line' }, "図形種別が'path'ではありません（line）");
            const noType = makeValidData(false);
            delete noType.type;
            assertFromJSONError(noType, "図形種別が'path'ではありません（undefined）");
        });

        it('pointsが2要素以上の配列でない（1点・0点・キーなし・配列でない）', () => {
            const reason = 'pointsが2要素以上の配列ではありません';
            assertFromJSONError({ ...makeValidData(false), points: [{ x: 0, y: 0 }] }, reason);
            assertFromJSONError({ ...makeValidData(false), points: [] }, reason);
            const noPoints = makeValidData(false);
            delete noPoints.points;
            assertFromJSONError(noPoints, reason);
            assertFromJSONError({ ...makeValidData(false), points: 'abc' }, reason);
        });

        it('頂点の座標が有限の数値でない（何番目かを添える）', () => {
            for (const bad of [NaN, Infinity, '1']) {
                const data = makeValidData(false);
                data.points[2] = { x: bad, y: 0 };
                assertFromJSONError(data, 'points[2]のx・yが有限の数値ではありません');
                const dataY = makeValidData(false);
                dataY.points[1] = { x: 0, y: bad };
                assertFromJSONError(dataY, 'points[1]のx・yが有限の数値ではありません');
            }
            const nullPoint = makeValidData(false);
            nullPoint.points[3] = null;
            assertFromJSONError(nullPoint, 'points[3]のx・yが有限の数値ではありません');
        });

        it('strokeColorが文字列でない', () => {
            assertFromJSONError({ ...makeValidData(false), strokeColor: 123 }, 'strokeColorが文字列またはnullではありません');
            const data = makeValidData(false);
            delete data.strokeColor;
            assertFromJSONError(data, 'strokeColorが文字列またはnullではありません');
        });

        it('strokeWidthが0以下／有限でない', () => {
            for (const bad of [0, -1, NaN, Infinity, '2', null]) {
                assertFromJSONError({ ...makeValidData(false), strokeWidth: bad }, 'strokeWidthが正の有限の数値ではありません');
            }
        });
    });

    describe('共通項目の既定値と線なし', () => {
        it('strokeColor: nullの図形データを受理する（線なし）', () => {
            const data = { ...makeValidData(false), strokeColor: null };
            assert.equal(Path.fromJSON(data).toJSON().strokeColor, null);
        });

        it('strokeWidthのキーが無い図形データを受理し、2pxとして読む', () => {
            const data = makeValidData(false);
            delete data.strokeWidth;
            assert.equal(Path.fromJSON(data).toJSON().strokeWidth, 2);
        });
    });

    describe('fillColor', () => {
        it('文字列・null・キーなしを受理する（キーなしはnull）', () => {
            assert.equal(Path.fromJSON({ ...makeValidData(true), fillColor: '#ff0000' }).toJSON().fillColor, '#ff0000');
            assert.equal(Path.fromJSON({ ...makeValidData(true), fillColor: null }).toJSON().fillColor, null);
            const data = makeValidData(true);
            delete data.fillColor;
            assert.equal(Path.fromJSON(data).toJSON().fillColor, null);
        });

        it('文字列でもnullでもない値は拒否する', () => {
            for (const bad of [1, true, {}, [], NaN]) {
                assertFromJSONError({ ...makeValidData(false), fillColor: bad }, 'fillColorが文字列またはnullではありません');
            }
        });
    });

    describe('パス固有の項目', () => {
        it('closedが真偽値でない（キーなし・1・\'true\'・null）', () => {
            for (const bad of [1, 'true', null, 0]) {
                assertFromJSONError({ ...makeValidData(false), closed: bad }, 'closedが真偽値ではありません');
            }
            const data = makeValidData(false);
            delete data.closed;
            assertFromJSONError(data, 'closedが真偽値ではありません');
        });

        it('閉じたパスの頂点数が3未満（2点）', () => {
            const data = makeValidData(true);
            data.points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
            data.segments = [{ kind: 'line' }, { kind: 'line' }];
            assertFromJSONError(data, '閉じたパスのpointsが3要素以上の配列ではありません');
        });

        it('segmentsが配列でない（キーなし・オブジェクト）', () => {
            const data = makeValidData(false);
            delete data.segments;
            assertFromJSONError(data, 'segmentsが配列ではありません');
            assertFromJSONError({ ...makeValidData(false), segments: { kind: 'line' } }, 'segmentsが配列ではありません');
        });

        it('segmentsの要素数の不一致（開いた／閉じたそれぞれで多い・少ない）', () => {
            const line = { kind: 'line' };
            assertFromJSONError({ ...makeValidData(false), segments: [line, line] }, 'segmentsが3要素の配列ではありません');
            assertFromJSONError({ ...makeValidData(false), segments: [line, line, line, line] }, 'segmentsが3要素の配列ではありません');
            assertFromJSONError({ ...makeValidData(true), segments: [line, line, line] }, 'segmentsが4要素の配列ではありません');
            assertFromJSONError({ ...makeValidData(true), segments: [line, line, line, line, line] }, 'segmentsが4要素の配列ではありません');
            assertFromJSONError({ ...makeValidData(false), segments: [] }, 'segmentsが3要素の配列ではありません');
        });

        it('開いた3点のパスは2要素、閉じた3点のパスは3要素を期待する', () => {
            const open = new Path([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], false).toJSON();
            open.segments = [];
            assertFromJSONError(open, 'segmentsが2要素の配列ではありません');
            const closed = new Path([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }], true).toJSON();
            closed.segments = [];
            assertFromJSONError(closed, 'segmentsが3要素の配列ではありません');
        });

        it('segmentsの要素がオブジェクトでない（null・\'line\'・配列）', () => {
            for (const bad of [null, 'line', []]) {
                const data = makeValidData(false);
                data.segments[1] = bad;
                assertFromJSONError(data, 'segments[1]がオブジェクトではありません');
            }
        });

        it('segmentsのkindが未知（\'curve\'・キーなし）', () => {
            const unknown = makeValidData(true);
            unknown.segments[2] = { kind: 'curve' };
            assertFromJSONError(unknown, "segments[2]のkindが'line'・'smooth'ではありません（curve）");
            const noKind = makeValidData(false);
            noKind.segments[0] = {};
            assertFromJSONError(noKind, "segments[0]のkindが'line'・'smooth'ではありません（undefined）");
        });
    });

    describe('検査の順序', () => {
        it('頂点の不正とstrokeColorの不正 → 頂点', () => {
            const data = { ...makeValidData(false), strokeColor: 1 };
            data.points[1] = { x: NaN, y: 0 };
            assertFromJSONError(data, 'points[1]のx・yが有限の数値ではありません');
        });

        it('strokeWidthの不正とclosedの不正 → strokeWidth', () => {
            assertFromJSONError({ ...makeValidData(false), strokeWidth: 0, closed: 'x' }, 'strokeWidthが正の有限の数値ではありません');
        });

        it('fillColorの不正とclosedの不正 → fillColor', () => {
            assertFromJSONError({ ...makeValidData(false), fillColor: 1, closed: 'x' }, 'fillColorが文字列またはnullではありません');
        });

        it('strokeWidth・strokeColorの不正とfillColorの不正 → strokeWidth・strokeColor', () => {
            assertFromJSONError({ ...makeValidData(false), strokeWidth: 0, fillColor: 1 }, 'strokeWidthが正の有限の数値ではありません');
            assertFromJSONError({ ...makeValidData(false), strokeColor: 1, fillColor: 1 }, 'strokeColorが文字列またはnullではありません');
        });

        it('closedの不正とsegmentsの不正 → closed', () => {
            assertFromJSONError({ ...makeValidData(false), closed: 'x', segments: 'y' }, 'closedが真偽値ではありません');
        });

        it('閉じた2点とsegmentsの要素数の不一致 → 頂点数', () => {
            const data = makeValidData(true);
            data.points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
            data.segments = [];
            assertFromJSONError(data, '閉じたパスのpointsが3要素以上の配列ではありません');
        });

        it('segmentsの要素数の不一致と要素の不正 → 要素数', () => {
            assertFromJSONError({ ...makeValidData(false), segments: [null, null] }, 'segmentsが3要素の配列ではありません');
        });

        it('segments[0]の未知のkindとsegments[1]がオブジェクトでない → segments[0]', () => {
            const data = makeValidData(false);
            data.segments = [{ kind: 'curve' }, 'x', { kind: 'line' }];
            assertFromJSONError(data, "segments[0]のkindが'line'・'smooth'ではありません（curve）");
        });

        it('segments[0]がオブジェクトでない場合はそのkind検査より先に報告される', () => {
            const data = makeValidData(false);
            data.segments = ['x', { kind: 'curve' }, { kind: 'line' }];
            assertFromJSONError(data, 'segments[0]がオブジェクトではありません');
        });
    });

    it('余分なプロパティ（最上位・区間の要素）は無視されtoJSON()に出ない', () => {
        const data = makeValidData(true);
        data.extra = 1;
        data.segments[0] = { kind: 'line', extra: 'x' };
        const path = Path.fromJSON(data);
        assert.deepEqual(path.toJSON(), makeValidData(true));
        assert.equal('extra' in path.toJSON(), false);
        assert.deepEqual(path.segments[0], { kind: 'line' });
    });

    it('idは検証されずそのまま保持される（数値・undefined）', () => {
        const withNumber = { ...makeValidData(false), id: 42 };
        assert.equal(Path.fromJSON(withNumber).id, 42);
        const noId = makeValidData(false);
        delete noId.id;
        assert.equal(Path.fromJSON(noId).id, undefined);
    });
});

describe('Path の toJSON・fromJSON・toDrawElement', () => {
    it('toJSONのキー順と中身（開いたパス）', () => {
        const p = new Path(makePoints(), false, '#123456', 3);
        p.id = 'p1';
        const json = p.toJSON();
        assert.deepEqual(Object.keys(json), ['type', 'id', 'points', 'closed', 'segments', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.deepEqual(json, {
            type: 'path',
            id: 'p1',
            points: makePoints(),
            closed: false,
            segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }],
            strokeColor: '#123456',
            strokeWidth: 3,
            fillColor: null,
        });
    });

    it('toJSONの中身（閉じたパス）とJSON.stringify', () => {
        const p = makePath(true);
        p.id = 'p2';
        const json = p.toJSON();
        assert.equal(json.closed, true);
        assert.equal(json.segments.length, 4);
        assert.equal(json.strokeColor, '#000000');
        assert.equal(json.strokeWidth, 2);
        assert.equal(JSON.stringify(p), JSON.stringify(json));
    });

    it('コンストラクタの既定値とidの初期値', () => {
        const p = new Path(makePoints());
        assert.equal(p.type, 'path');
        assert.equal(p.id, null);
        assert.equal(p.closed, false);
        assert.equal(p.strokeColor, '#000000');
        assert.equal(p.strokeWidth, 2);
    });

    it('コンストラクタの既定のfillColorはnullで、既存の引数の位置と既定値は変わらない', () => {
        const p = new Path(makePoints());
        assert.equal(p.fillColor, null);
        const q = new Path(makePoints(), true, '#111111', 7, '#222222');
        assert.equal(q.closed, true);
        assert.equal(q.strokeColor, '#111111');
        assert.equal(q.strokeWidth, 7);
        assert.equal(q.fillColor, '#222222');
    });

    it('toJSONは塗れない形（開いたパス）でもfillColorを保持して出力し、往復で保たれる', () => {
        const p = new Path(makePoints(), false, '#000000', 2, '#abcdef');
        assert.equal(p.toJSON().fillColor, '#abcdef');
        assert.equal(Path.fromJSON(p.toJSON()).toJSON().fillColor, '#abcdef');
    });

    it('toDrawElementのfillColor（閉じたパスは図形の値・開いたパスはnull）', () => {
        assert.equal(new Path(makePoints(), true, '#000000', 2, '#abcdef').toDrawElement().fillColor, '#abcdef');
        assert.equal(new Path(makePoints(), true).toDrawElement().fillColor, null);
        assert.equal(new Path(makePoints(), false, '#000000', 2, '#abcdef').toDrawElement().fillColor, null);
    });

    it('toDrawElementのstrokeColorはnull（線なし）もそのまま入れる', () => {
        assert.equal(new Path(makePoints(), true, null, 2, '#abcdef').toDrawElement().strokeColor, null);
    });

    it('往復でtoJSON()・hitTest・intersectsRectの結果が一致する', () => {
        for (const closed of [false, true]) {
            const original = makePath(closed);
            original.id = 'r1';
            original.translate(3, 4);
            const restored = Path.fromJSON(JSON.parse(JSON.stringify(original.toJSON())));
            assert.deepEqual(restored.toJSON(), original.toJSON());
            for (const [x, y] of [[3, 54], [53, 54], [53, 4], [60, 60], [-20, -20]]) {
                assert.equal(restored.hitTest(x, y, 5), original.hitTest(x, y, 5));
            }
            for (const rect of [[-5, 40, 10, 60], [30, 30, 70, 70], [90, -10, 110, 10]]) {
                assert.equal(restored.intersectsRect(...rect), original.intersectsRect(...rect));
            }
        }
    });

    it('toJSON()の戻り値を書き換えても元が変わらない', () => {
        const p = makePath(true);
        const json = p.toJSON();
        json.points[0].x = 999;
        json.points.push({ x: 1, y: 1 });
        json.segments[0].kind = 'curve';
        json.segments.push({ kind: 'line' });
        assert.deepEqual(p.toJSON(), makePath(true).toJSON());
    });

    it('fromJSONへ渡したdataと復元したパスは互いに独立している', () => {
        const data = makeValidData(true);
        const path = Path.fromJSON(data);
        data.points[0].x = 999;
        data.points.push({ x: 1, y: 1 });
        data.segments[0].kind = 'curve';
        data.segments.push({ kind: 'line' });
        assert.deepEqual(path.toJSON(), makeValidData(true));

        const data2 = makeValidData(false);
        const path2 = Path.fromJSON(data2);
        path2.points[0].x = 777;
        path2.segments[0].kind = 'curve';
        assert.deepEqual(data2, makeValidData(false));
    });

    it('コンストラクタへ渡した配列・頂点を書き換えてもパスが変わらない', () => {
        const points = makePoints();
        const p = new Path(points, true);
        points[0].x = 999;
        points.push({ x: 5, y: 5 });
        assert.deepEqual(p.points, makePoints());
        assert.equal(p.segments.length, 4);
    });

    it('toDrawElementの中身とキー順（開いたパス）', () => {
        const p = new Path(makePoints(), false, '#abcdef', 5);
        p.id = 'd1';
        const element = p.toDrawElement();
        assert.deepEqual(Object.keys(element), ['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.deepEqual(element, {
            kind: 'polyline',
            id: 'd1',
            points: makePoints(),
            closed: false,
            strokeColor: '#abcdef',
            strokeWidth: 5,
            fillColor: null,
        });
        assert.equal('segments' in element, false);
    });

    it('toDrawElementの閉じたパスはclosed: trueで頂点はn個（始点を重複させない）', () => {
        const element = makePath(true).toDrawElement();
        assert.equal(element.closed, true);
        assert.equal(element.points.length, 4);
        assert.deepEqual(element.points, makePoints());
    });

    it('toDrawElementの戻り値は内部の配列・頂点を共有しない', () => {
        const p = makePath(true);
        const element = p.toDrawElement();
        element.points[0].x = 999;
        element.points.push({ x: 1, y: 1 });
        assert.deepEqual(p.points, makePoints());
        assert.notEqual(p.toDrawElement().points, p.toDrawElement().points);
    });
});

describe('Path の描画命令', () => {
    it('draw: 開いたパスはclosePathを含まない', () => {
        const { ctx, log } = makeRecordingCtx();
        const p = new Path(makePoints(), false, '#112233', 4);
        p.draw(ctx);
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 0],
            ['lineTo', 100, 100],
            ['lineTo', 0, 100],
            ['set', 'strokeStyle', '#112233'],
            ['set', 'lineWidth', 4],
            ['stroke'],
        ]);
    });

    it('draw: 閉じたパスはclosePathが入りlineToで始点を重ねない', () => {
        const { ctx, log } = makeRecordingCtx();
        makePath(true).draw(ctx, 0.5);
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 0],
            ['lineTo', 100, 100],
            ['lineTo', 0, 100],
            ['closePath'],
            ['set', 'strokeStyle', '#000000'],
            ['set', 'lineWidth', 2],
            ['stroke'],
        ]);
    });

    it('isFillable: 閉じたパスはtrue・開いたパスはfalse', () => {
        assert.equal(makePath(true).isFillable(), true);
        assert.equal(makePath(false).isFillable(), false);
    });

    it('draw: 閉じたパス・塗りあり線あり → パス、fillStyle、fill()（引数なし）、線の順', () => {
        const { ctx, log } = makeRecordingCtx();
        new Path(makePoints(), true, '#112233', 4, '#ff0000').draw(ctx);
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 0],
            ['lineTo', 100, 100],
            ['lineTo', 0, 100],
            ['closePath'],
            ['set', 'fillStyle', '#ff0000'],
            ['fill'],
            ['set', 'strokeStyle', '#112233'],
            ['set', 'lineWidth', 4],
            ['stroke'],
        ]);
    });

    it('draw: 閉じたパス・塗りあり線なし → 塗りだけ', () => {
        const { ctx, log } = makeRecordingCtx();
        new Path(makePoints(), true, null, 4, '#ff0000').draw(ctx);
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 0],
            ['lineTo', 100, 100],
            ['lineTo', 0, 100],
            ['closePath'],
            ['set', 'fillStyle', '#ff0000'],
            ['fill'],
        ]);
    });

    it('draw: 閉じたパス・塗りなし線あり → 従来と同じ（線だけ）', () => {
        const { ctx, log } = makeRecordingCtx();
        new Path(makePoints(), true, '#112233', 4, null).draw(ctx);
        assert.deepEqual(log.map(([name]) => name), ['beginPath', 'moveTo', 'lineTo', 'lineTo', 'lineTo', 'closePath', 'set', 'set', 'stroke']);
    });

    it('draw: 閉じたパス・塗りも線もなし → 何も呼ばない（beginPathも呼ばない）', () => {
        const { ctx, log } = makeRecordingCtx();
        new Path(makePoints(), true, null, 4, null).draw(ctx);
        assert.deepEqual(log, []);
    });

    it('draw: 自分自身と交差する閉じたパスも同じ命令列でfill()を引数なしで呼ぶ', () => {
        const { ctx, log } = makeRecordingCtx();
        const points = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 100, y: 0 }, { x: 0, y: 100 }];
        new Path(points, true, '#112233', 2, '#00ff00').draw(ctx);
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 100],
            ['lineTo', 100, 0],
            ['lineTo', 0, 100],
            ['closePath'],
            ['set', 'fillStyle', '#00ff00'],
            ['fill'],
            ['set', 'strokeStyle', '#112233'],
            ['set', 'lineWidth', 2],
            ['stroke'],
        ]);
    });

    it('draw: 開いたパスにfillColorがあっても塗らない（線ありなら線だけ・線なしなら何も呼ばない）', () => {
        const withStroke = makeRecordingCtx();
        new Path(makePoints(), false, '#112233', 4, '#ff0000').draw(withStroke.ctx);
        assert.equal(withStroke.log.some(([name]) => name === 'fill'), false);
        assert.equal(withStroke.log.some(([name, key]) => name === 'set' && key === 'fillStyle'), false);
        assert.deepEqual(withStroke.log.slice(-3), [
            ['set', 'strokeStyle', '#112233'],
            ['set', 'lineWidth', 4],
            ['stroke'],
        ]);
        const noStroke = makeRecordingCtx();
        new Path(makePoints(), false, null, 4, '#ff0000').draw(noStroke.ctx);
        assert.deepEqual(noStroke.log, []);
    });

    it('drawHover: 強調の線幅はstrokeWidth + 6 / viewScaleで、閉じたパスだけclosePathが入る', () => {
        const open = makeRecordingCtx();
        makePath(false).drawHover(open.ctx, 2);
        assert.equal(open.log.some(([name]) => name === 'closePath'), false);
        assert.deepEqual(open.log.slice(-3), [
            ['set', 'strokeStyle', 'rgba(74, 144, 226, 0.4)'],
            ['set', 'lineWidth', 5],
            ['stroke'],
        ]);
        const closed = makeRecordingCtx();
        makePath(true).drawHover(closed.ctx);
        assert.equal(closed.log.filter(([name]) => name === 'closePath').length, 1);
        assert.deepEqual(closed.log.slice(-2), [['set', 'lineWidth', 8], ['stroke']]);
    });

    it('drawHandles: 全頂点に一辺8 / viewScaleの正方形を頂点中心に描く', () => {
        const { ctx, log } = makeRecordingCtx();
        makePath(false).drawHandles(ctx, 2);
        const rects = log.filter(([name]) => name === 'rect');
        assert.deepEqual(rects, [
            ['rect', -2, -2, 4, 4],
            ['rect', 98, -2, 4, 4],
            ['rect', 98, 98, 4, 4],
            ['rect', -2, 98, 4, 4],
        ]);
        assert.deepEqual(log.slice(0, 3), [
            ['set', 'fillStyle', '#ffffff'],
            ['set', 'strokeStyle', '#4a90e2'],
            ['set', 'lineWidth', 0.75],
        ]);
    });
});

describe('Path.drawOutline の描画命令', () => {
    it('開いたパス: パス → strokeStyle(color) → lineWidth(1 / viewScale) → stroke で、closePathとfillを呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Path(makePoints(), false, '#112233', 4, '#ff0000').drawOutline(ctx, 2, '#abcdef');
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 0],
            ['lineTo', 100, 100],
            ['lineTo', 0, 100],
            ['set', 'strokeStyle', '#abcdef'],
            ['set', 'lineWidth', 0.5],
            ['stroke'],
        ]);
    });

    it('閉じたパス: closePathが1回入り、fill・fillStyleを呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Path(makePoints(), true, '#112233', 4, '#ff0000').drawOutline(ctx, 4, '#000000');
        assert.deepEqual(log, [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['lineTo', 100, 0],
            ['lineTo', 100, 100],
            ['lineTo', 0, 100],
            ['closePath'],
            ['set', 'strokeStyle', '#000000'],
            ['set', 'lineWidth', 0.25],
            ['stroke'],
        ]);
        assert.equal(log.some(([name]) => name === 'fill'), false);
        assert.equal(log.some(([name, key]) => name === 'set' && key === 'fillStyle'), false);
    });

    it('viewScale省略時はlineWidthが1', () => {
        const { ctx, log } = makeRecordingCtx();
        makePath(true).drawOutline(ctx, undefined, '#ffffff');
        assert.deepEqual(log.slice(-3), [
            ['set', 'strokeStyle', '#ffffff'],
            ['set', 'lineWidth', 1],
            ['stroke'],
        ]);
    });

    it('線なし・塗りなし・何も描かれない図形でも同じ命令を出す（開いた・閉じたの両方）', () => {
        for (const closed of [false, true]) {
            const styled = makeRecordingCtx();
            new Path(makePoints(), closed, '#112233', 4, '#ff0000').drawOutline(styled.ctx, 2, '#abcdef');
            const plain = makeRecordingCtx();
            new Path(makePoints(), closed, null, 4, null).drawOutline(plain.ctx, 2, '#abcdef');
            assert.deepEqual(plain.log, styled.log);
            assert.equal(plain.log.filter(([name]) => name === 'stroke').length, 1);
        }
    });
});

describe('Path.getHandlePosition', () => {
    for (const closed of [false, true]) {
        const label = closed ? '閉じたパス' : '開いたパス';

        it(`${label}：各頂点の位置を返す（頂点を動かした後もその頂点の位置）`, () => {
            const path = makePath(closed);
            const expected = makePoints();
            expected.forEach((point, i) => {
                assert.deepEqual(path.getHandlePosition(`vertex-${i}`), point);
            });
            path.setVertex(2, 130, 70);
            assert.deepEqual(path.getHandlePosition('vertex-2'), { x: 130, y: 70 });
            assert.deepEqual(path.getHandlePosition('vertex-0'), { x: 0, y: 0 });
        });

        it(`${label}：'move'・不正名・範囲外の番号・文字列以外はnull`, () => {
            const path = makePath(closed);
            for (const name of ['move', 'vertex-4', 'vertex-99', 'vertex--1', 'vertex-01', 'vertex-', 'vertex-1.5', 'unknown', '', null, undefined, 0, 1, {}, [], true]) {
                assert.doesNotThrow(() => path.getHandlePosition(name));
                assert.equal(path.getHandlePosition(name), null, String(name));
            }
        });

        it(`${label}：Object.prototypeのキー名で例外なくnull`, () => {
            const path = makePath(closed);
            for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
                assert.doesNotThrow(() => path.getHandlePosition(name));
                assert.equal(path.getHandlePosition(name), null);
            }
        });

        it(`${label}：戻り値を書き換えても図形は変わらず、毎回新しいオブジェクト`, () => {
            const path = makePath(closed);
            const pos = path.getHandlePosition('vertex-1');
            pos.x = 999;
            pos.y = 999;
            assert.deepEqual(path.points[1], { x: 100, y: 0 });
            assert.notEqual(path.getHandlePosition('vertex-1'), path.getHandlePosition('vertex-1'));
            assert.notEqual(path.getHandlePosition('vertex-1'), path.points[1]);
        });

        it(`${label}：返した位置をhitTestHandleへ渡すと同じ名前が返る`, () => {
            const path = makePath(closed);
            for (let i = 0; i < 4; i++) {
                const pos = path.getHandlePosition(`vertex-${i}`);
                assert.equal(path.hitTestHandle(pos.x, pos.y, 1), `vertex-${i}`);
            }
        });
    }
});

describe('Path.getVertexHandleNames', () => {
    it('頂点数ぶんの vertex-<i> を番号順に返す（開いた・閉じた・頂点数違い）', () => {
        assert.deepEqual(makePath(false).getVertexHandleNames(), ['vertex-0', 'vertex-1', 'vertex-2', 'vertex-3']);
        assert.deepEqual(makePath(true).getVertexHandleNames(), ['vertex-0', 'vertex-1', 'vertex-2', 'vertex-3']);
        const five = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 20, y: 5 }, { x: 10, y: 20 }, { x: 0, y: 10 }], true);
        assert.deepEqual(five.getVertexHandleNames(), ['vertex-0', 'vertex-1', 'vertex-2', 'vertex-3', 'vertex-4']);
        const two = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }], false);
        assert.deepEqual(two.getVertexHandleNames(), ['vertex-0', 'vertex-1']);
    });

    it('毎回新しい配列を返し、書き換えても図形は変わらない', () => {
        const p = makePath(false);
        const before = JSON.stringify(p.toJSON());
        const names = p.getVertexHandleNames();
        names.push('extra');
        names.length = 0;
        assert.notEqual(p.getVertexHandleNames(), names);
        assert.equal(p.getVertexHandleNames().length, 4);
        assert.equal(JSON.stringify(p.toJSON()), before);
    });

    it('一覧の各名前が頂点の番号と位置に解決できる', () => {
        for (const closed of [false, true]) {
            const p = makePath(closed);
            const base = makePoints();
            p.getVertexHandleNames().forEach((name, i) => {
                assert.equal(p.getVertexIndexForHandle(name), i);
                assert.deepEqual(p.getHandlePosition(name), base[i]);
            });
        }
    });
});

/**
 * 区間の種類を指定してパスを作る（`toJSON`→`fromJSON`で区間を差し替える）。頂点は標準の4点。
 * @param {boolean} closed - 閉じたパスにするか
 * @param {string[]} kinds - 区間ごとの種類
 * @param {string|null} [fillColor=null] - 塗りの色
 * @returns {Path} 区間の種類が混ざったパス
 */
function makeMixedPath(closed, kinds, fillColor = null) {
    const data = new Path(makePoints(), closed, '#000000', 2, fillColor).toJSON();
    data.id = 'p1';
    data.segments = kinds.map((kind) => ({ kind }));
    return Path.fromJSON(data);
}

/**
 * パスの区間ごとの制御点を、公開の式（`computeSmoothSegmentControls`）から求める。
 * @param {Path} path - 対象のパス
 * @returns {Array<{control1: {x: number, y: number}, control2: {x: number, y: number}}|null>} 区間ごとの制御点
 */
function expectedControls(path) {
    return computeSmoothSegmentControls(path.points, path.segments.map((s) => s.kind === SEGMENT_KIND_SMOOTH), path.closed);
}

describe('Path の曲線の区間（コンストラクタ・定数）', () => {
    it('第6引数を省くと全区間が直線、smoothを渡すと全区間が曲線（開いたn-1・閉じたn）', () => {
        assert.equal(SEGMENT_KIND_LINE, 'line');
        assert.equal(SEGMENT_KIND_SMOOTH, 'smooth');
        assert.deepEqual(makePath(false).segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        const open = new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_SMOOTH);
        assert.deepEqual(open.segments, [{ kind: 'smooth' }, { kind: 'smooth' }, { kind: 'smooth' }]);
        const closed = new Path(makePoints(), true, '#000000', 2, null, SEGMENT_KIND_SMOOTH);
        assert.equal(closed.segments.length, 4);
        assert.ok(closed.segments.every((s) => s.kind === 'smooth'));
    });
});

describe('Path の曲線の区間の描画命令', () => {
    it('開いた曲線のパスは moveTo → bezierCurveTo×区間数（制御点は式の値）', () => {
        const p = new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_SMOOTH);
        const controls = expectedControls(p);
        const { ctx, log } = makeRecordingCtx();
        p.draw(ctx);
        const pts = makePoints();
        assert.deepEqual(log.slice(0, 5), [
            ['beginPath'],
            ['moveTo', 0, 0],
            ['bezierCurveTo', controls[0].control1.x, controls[0].control1.y, controls[0].control2.x, controls[0].control2.y, pts[1].x, pts[1].y],
            ['bezierCurveTo', controls[1].control1.x, controls[1].control1.y, controls[1].control2.x, controls[1].control2.y, pts[2].x, pts[2].y],
            ['bezierCurveTo', controls[2].control1.x, controls[2].control1.y, controls[2].control2.x, controls[2].control2.y, pts[3].x, pts[3].y],
        ]);
        assert.deepEqual(log.slice(5), [['set', 'strokeStyle', '#000000'], ['set', 'lineWidth', 2], ['stroke']]);
    });

    it('閉じた全区間曲線は閉じる区間も bezierCurveTo で始点へ戻り closePath', () => {
        const p = new Path(makePoints(), true, '#000000', 2, '#ff0000', SEGMENT_KIND_SMOOTH);
        const controls = expectedControls(p);
        const { ctx, log } = makeRecordingCtx();
        p.draw(ctx);
        const names = log.map((entry) => entry[0]);
        assert.deepEqual(names.slice(0, 7), ['beginPath', 'moveTo', 'bezierCurveTo', 'bezierCurveTo', 'bezierCurveTo', 'bezierCurveTo', 'closePath']);
        assert.deepEqual(log[5], ['bezierCurveTo', controls[3].control1.x, controls[3].control1.y, controls[3].control2.x, controls[3].control2.y, 0, 0]);
        assert.ok(names.includes('fill'));
        assert.ok(names.includes('stroke'));
    });

    it('直線と曲線の混在：直線の区間は lineTo、閉じる区間が直線なら lineTo なしで closePath', () => {
        const p = makeMixedPath(true, ['smooth', 'line', 'smooth', 'line']);
        const { ctx, log } = makeRecordingCtx();
        p.draw(ctx);
        assert.deepEqual(log.slice(0, 6).map((entry) => entry[0]), ['beginPath', 'moveTo', 'bezierCurveTo', 'lineTo', 'bezierCurveTo', 'closePath']);
        const open = makeMixedPath(false, ['line', 'smooth', 'line']);
        const rec = makeRecordingCtx();
        open.draw(rec.ctx);
        assert.deepEqual(rec.log.slice(0, 5).map((entry) => entry[0]), ['beginPath', 'moveTo', 'lineTo', 'bezierCurveTo', 'lineTo']);
    });

    it('区間がすべて直線のパスの命令は今と同じ（lineTo→closePath）', () => {
        const { ctx, log } = makeRecordingCtx();
        makePath(true).draw(ctx);
        assert.deepEqual(log.slice(0, 6), [
            ['beginPath'], ['moveTo', 0, 0], ['lineTo', 100, 0], ['lineTo', 100, 100], ['lineTo', 0, 100], ['closePath'],
        ]);
    });

    it('drawHover・drawOutline・線なし塗りのみも同じパスを辿る', () => {
        const p = new Path(makePoints(), true, null, 2, '#ff0000', SEGMENT_KIND_SMOOTH);
        const fillOnly = makeRecordingCtx();
        p.draw(fillOnly.ctx);
        assert.deepEqual(fillOnly.log.slice(-2), [['set', 'fillStyle', '#ff0000'], ['fill']]);
        assert.equal(fillOnly.log.filter((e) => e[0] === 'bezierCurveTo').length, 4);
        const expectedNames = ['beginPath', 'moveTo', 'bezierCurveTo', 'bezierCurveTo', 'bezierCurveTo', 'bezierCurveTo', 'closePath'];
        const hover = makeRecordingCtx();
        p.drawHover(hover.ctx, 1);
        assert.deepEqual(hover.log.slice(0, 7).map((e) => e[0]), expectedNames);
        const outline = makeRecordingCtx();
        p.drawOutline(outline.ctx, 1, '#00ff00');
        assert.deepEqual(outline.log.slice(0, 7).map((e) => e[0]), expectedNames);
    });
});

describe('Path の曲線の区間の当たり判定・範囲選択', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 0 }];

    it('hitTest：曲線の上の点に当たり、頂点を結ぶ直線上でも曲線から離れた点には当たらない', () => {
        const p = new Path(pts, false, '#000000', 2, null, SEGMENT_KIND_SMOOTH);
        const c = expectedControls(p)[0];
        const onCurve = cubicBezierPoint(pts[0], c.control1, c.control2, pts[1], 0.5);
        assert.equal(p.hitTest(onCurve.x, onCurve.y, 0.5), true);
        assert.equal(p.hitTest(pts[1].x, pts[1].y, 0.5), true);
        const mid = { x: 50, y: 50 };
        assert.ok(Math.hypot(mid.x - onCurve.x, mid.y - onCurve.y) > 1);
        assert.equal(p.hitTest(mid.x, mid.y, 0.5), false);
        assert.equal(new Path(pts, false).hitTest(mid.x, mid.y, 0.5), true);
    });

    it('intersectsRect：曲線だけが掛かる矩形で真、頂点を結ぶ直線にだけ掛かる矩形で偽', () => {
        const p = new Path(pts, false, '#000000', 2, null, SEGMENT_KIND_SMOOTH);
        const c = expectedControls(p)[0];
        const onCurve = cubicBezierPoint(pts[0], c.control1, c.control2, pts[1], 0.5);
        assert.equal(p.intersectsRect(onCurve.x - 0.5, onCurve.y - 0.5, onCurve.x + 0.5, onCurve.y + 0.5), true);
        assert.equal(p.intersectsRect(49.5, 49.5, 50.5, 50.5), false);
    });

    it('hitTestFill：閉じた曲線のパスで膨らみの内側（頂点の多角形の外）が真、塗りなし・開いたパスは偽', () => {
        const tri = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 80 }];
        const p = new Path(tri, true, '#000000', 2, '#ff0000', SEGMENT_KIND_SMOOTH);
        assert.equal(p.hitTestFill(50, 30), true);
        const c = expectedControls(p)[0];
        const bulge = cubicBezierPoint(tri[0], c.control1, c.control2, tri[1], 0.5);
        assert.ok(bulge.y < -1);
        assert.equal(p.hitTestFill(bulge.x, bulge.y / 2), true);
        assert.equal(new Path(tri, true, '#000000', 2, '#ff0000').hitTestFill(bulge.x, bulge.y / 2), false);
        assert.equal(new Path(tri, true, '#000000', 2, null, SEGMENT_KIND_SMOOTH).hitTestFill(50, 30), false);
        assert.equal(new Path(tri, false, '#000000', 2, '#ff0000', SEGMENT_KIND_SMOOTH).hitTestFill(50, 30), false);
    });
});

describe('Path の曲線の区間の toDrawElement', () => {
    it('区間がすべて直線のパスは今と同じ polyline', () => {
        const p = makePath(true);
        assert.deepEqual(Object.keys(p.toDrawElement()), ['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.equal(p.toDrawElement().kind, 'polyline');
    });

    it('曲線のパスは bezierPath（キー順・区間の line/cubic・制御点・fillColor）', () => {
        const open = makeMixedPath(false, ['line', 'smooth', 'smooth'], '#ff0000');
        const el = open.toDrawElement();
        assert.deepEqual(Object.keys(el), ['kind', 'id', 'points', 'closed', 'segments', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.equal(el.kind, 'bezierPath');
        assert.equal(el.id, 'p1');
        assert.equal(el.fillColor, null);
        const controls = expectedControls(open);
        assert.deepEqual(el.segments[0], { kind: 'line' });
        assert.deepEqual(el.segments[1], { kind: 'cubic', control1: controls[1].control1, control2: controls[1].control2 });
        assert.deepEqual(Object.keys(el.segments[1]), ['kind', 'control1', 'control2']);
        assert.equal(el.points.length, 4);
        const closed = makeMixedPath(true, ['smooth', 'smooth', 'smooth', 'line'], '#ff0000');
        const cel = closed.toDrawElement();
        assert.equal(cel.fillColor, '#ff0000');
        assert.equal(cel.points.length, 4);
        assert.equal(cel.segments.length, 4);
        assert.equal(cel.segments[3].kind, 'line');
    });

    it('戻り値は自身と配列・頂点を共有しない', () => {
        const p = new Path(makePoints(), true, '#000000', 2, '#ff0000', SEGMENT_KIND_SMOOTH);
        const el = p.toDrawElement();
        const before = JSON.stringify(p.toJSON());
        el.points[0].x = 999;
        el.segments[0].control1.x = 999;
        el.segments.length = 0;
        assert.equal(JSON.stringify(p.toJSON()), before);
        assert.notEqual(p.toDrawElement().segments[0].control1.x, 999);
    });
});

describe('Path の曲線の区間の toJSON・fromJSON', () => {
    it('smooth を含む往復（混在を含む）で図形データ・描画・当たり判定が一致', () => {
        const cases = [
            [false, ['smooth', 'smooth', 'smooth']],
            [true, ['smooth', 'line', 'smooth', 'smooth']],
            [false, ['line', 'smooth', 'line']],
        ];
        for (const [closed, kinds] of cases) {
            const original = makeMixedPath(closed, kinds, '#ff0000');
            const restored = Path.fromJSON(original.toJSON());
            assert.deepEqual(restored.toJSON(), original.toJSON());
            assert.deepEqual(restored.toDrawElement(), original.toDrawElement());
            const a = makeRecordingCtx();
            const b = makeRecordingCtx();
            original.draw(a.ctx);
            restored.draw(b.ctx);
            assert.deepEqual(b.log, a.log);
            assert.equal(restored.hitTest(50, 20, 3), original.hitTest(50, 20, 3));
        }
    });

    it('未知の kind はエラー（文言は line・smooth）', () => {
        const data = makeValidData(false);
        data.segments[1] = { kind: 'curve' };
        assertFromJSONError(data, "segments[1]のkindが'line'・'smooth'ではありません（curve）");
        const noKind = makeValidData(false);
        noKind.segments[0] = {};
        assertFromJSONError(noKind, "segments[0]のkindが'line'・'smooth'ではありません（undefined）");
    });
});

describe('Path コンストラクタの区間ごとの種類の配列（Phase 09-01b）', () => {
    it('配列を渡すと区間ごとの種類になる（開いたn-1・閉じたn。直線と曲線の混在）', () => {
        const open = new Path(makePoints(), false, '#000000', 2, null, ['line', 'smooth', 'line']);
        assert.deepEqual(open.segments, [{ kind: 'line' }, { kind: 'smooth' }, { kind: 'line' }]);
        const closed = new Path(makePoints(), true, '#000000', 2, null, ['smooth', 'line', 'smooth', 'line']);
        assert.deepEqual(closed.segments, [{ kind: 'smooth' }, { kind: 'line' }, { kind: 'smooth' }, { kind: 'line' }]);
    });

    it('構築後に渡した配列を書き換えても segments は変わらない（共有しない）', () => {
        const kinds = ['line', 'smooth', 'line'];
        const path = new Path(makePoints(), false, '#000000', 2, null, kinds);
        kinds[0] = 'smooth';
        kinds.push('smooth');
        assert.deepEqual(path.segments, [{ kind: 'line' }, { kind: 'smooth' }, { kind: 'line' }]);
        assert.notEqual(path.segments[0], path.segments[2]);
    });

    it('同じ頂点・種類の fromJSON で作ったパスと toJSON・toDrawElement が一致する', () => {
        for (const closed of [false, true]) {
            const kinds = closed ? ['smooth', 'line', 'smooth', 'smooth'] : ['line', 'smooth', 'smooth'];
            const byCtor = new Path(makePoints(), closed, '#112233', 3, closed ? '#445566' : null, kinds);
            byCtor.id = 'p1';
            const byJson = Path.fromJSON(byCtor.toJSON());
            assert.deepEqual(byCtor.toJSON(), byJson.toJSON());
            assert.deepEqual(byCtor.toDrawElement(), byJson.toDrawElement());
        }
    });

    it('第6引数が文字列・省略のときの結果は今までと同じ', () => {
        const line = new Path(makePoints(), false, '#000000', 2, null, 'line');
        assert.deepEqual(line.segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
        const smooth = new Path(makePoints(), true, '#000000', 2, null, 'smooth');
        assert.deepEqual(smooth.segments, [{ kind: 'smooth' }, { kind: 'smooth' }, { kind: 'smooth' }, { kind: 'smooth' }]);
        assert.deepEqual(new Path(makePoints()).segments, [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }]);
    });
});

describe('Path の角の点（Phase 09-02a）', () => {
    const NONE = [false, false, false, false];
    const ONE = [false, true, false, false];

    /**
     * 全区間曲線のパスを、角の情報つきで作る。
     * @param {boolean} closed - 閉じたパスにするか
     * @param {boolean[]} [corners] - 角の点の並び
     * @param {string|null} [fillColor=null] - 塗りの色
     * @returns {Path} 全区間曲線のパス
     */
    function makeSmooth(closed, corners, fillColor = null) {
        const p = new Path(makePoints(), closed, '#000000', 2, fillColor, SEGMENT_KIND_SMOOTH, corners);
        p.id = 'p1';
        return p;
    }

    /**
     * パスの区間ごとの制御点を、角の情報つきで公開の式から求める。
     * @param {Path} path - 対象のパス
     * @returns {Array<Object|null>} 区間ごとの制御点
     */
    function controlsWithCorners(path) {
        return computeSmoothSegmentControls(path.points, path.segments.map((s) => s.kind === SEGMENT_KIND_SMOOTH), path.closed, path.corners);
    }

    it('コンストラクタの既定の corners はすべて false（要素数は points と同じ）', () => {
        assert.deepEqual(new Path(makePoints()).corners, NONE);
        assert.deepEqual(new Path(makePoints(), true, '#000000', 2, null, SEGMENT_KIND_SMOOTH).corners, NONE);
    });

    it('第7引数は写して保持する（共有しない・true 以外は false・要素数を points にそろえる）', () => {
        const src = [false, true, 1, 'true', true, true];
        const p = new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_SMOOTH, src);
        assert.deepEqual(p.corners, [false, true, false, false]);
        src[0] = true;
        assert.deepEqual(p.corners, [false, true, false, false]);
        assert.notEqual(p.corners, src);
        assert.deepEqual(new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_SMOOTH, [true]).corners, [true, false, false, false]);
        assert.deepEqual(new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_SMOOTH, null).corners, NONE);
    });

    it('角の点がないパスの toJSON のキーは今と同じ（corners が無い）', () => {
        assert.deepEqual(Object.keys(makeSmooth(false).toJSON()), ['type', 'id', 'points', 'closed', 'segments', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.equal('corners' in makeSmooth(false, NONE).toJSON(), false);
    });

    it('角の点があると corners が segments の直後・strokeColor の前に新しい配列で出る', () => {
        const p = makeSmooth(false, ONE);
        const data = p.toJSON();
        assert.deepEqual(Object.keys(data), ['type', 'id', 'points', 'closed', 'segments', 'corners', 'strokeColor', 'strokeWidth', 'fillColor']);
        assert.deepEqual(data.corners, ONE);
        assert.notEqual(data.corners, p.corners);
        data.corners[0] = true;
        assert.deepEqual(p.corners, ONE);
    });

    it('toJSON → fromJSON の往復で corners・描画・当たり判定が一致する', () => {
        for (const closed of [false, true]) {
            const p = makeSmooth(closed, ONE, closed ? '#ff0000' : null);
            const back = Path.fromJSON(p.toJSON());
            assert.deepEqual(back.toJSON(), p.toJSON());
            assert.deepEqual(back.corners, ONE);
            const a = makeRecordingCtx();
            const b = makeRecordingCtx();
            p.draw(a.ctx);
            back.draw(b.ctx);
            assert.deepEqual(b.log, a.log);
            for (const [x, y] of [[50, 20], [100, 50], [20, 80], [60, 60]]) {
                assert.equal(back.hitTest(x, y, 3), p.hitTest(x, y, 3));
                assert.equal(back.hitTestFill(x, y), p.hitTestFill(x, y));
            }
        }
    });

    it('すべて false の corners は受理し、toJSON では出ない', () => {
        const data = makeSmooth(false).toJSON();
        data.corners = NONE.slice();
        const p = Path.fromJSON(data);
        assert.deepEqual(p.corners, NONE);
        assert.equal('corners' in p.toJSON(), false);
    });

    it('fromJSON のエラー文（配列でない・null・要素数違い・真偽値でない要素）', () => {
        let data = makeSmooth(false).toJSON();
        data.corners = 'x';
        assertFromJSONError(data, 'cornersが配列ではありません');
        data = makeSmooth(false).toJSON();
        data.corners = null;
        assertFromJSONError(data, 'cornersが配列ではありません');
        data = makeSmooth(false).toJSON();
        data.corners = [false, true];
        assertFromJSONError(data, 'cornersが4要素の配列ではありません');
        data = makeSmooth(false).toJSON();
        data.corners = [false, 1, false, false];
        assertFromJSONError(data, 'corners[1]が真偽値ではありません');
    });

    it('corners の検査は segments の検査の後', () => {
        const data = makeSmooth(false).toJSON();
        data.corners = 'x';
        data.segments = 'x';
        assertFromJSONError(data, 'segmentsが配列ではありません');
        const data2 = makeSmooth(false).toJSON();
        data2.corners = 'x';
        data2.segments[0] = { kind: 'bad' };
        assert.throws(() => Path.fromJSON(data2), /segments\[0\]のkind/);
    });

    it('setVertex・translate の後も corners が残る', () => {
        const p = makeSmooth(false, ONE);
        p.setVertex(1, 50, 50);
        assert.deepEqual(p.corners, ONE);
        p.translate(5, 5);
        assert.deepEqual(p.corners, ONE);
        assert.deepEqual(p.toJSON().corners, ONE);
    });

    it('toDrawElement の cubic の制御点が式（corners つき）と一致し、角なしと違う', () => {
        const p = makeSmooth(false, ONE);
        const el = p.toDrawElement();
        assert.equal(el.kind, 'bezierPath');
        const controls = controlsWithCorners(p);
        el.segments.forEach((seg, i) => {
            assert.deepEqual(seg.control1, controls[i].control1);
            assert.deepEqual(seg.control2, controls[i].control2);
        });
        assert.notDeepEqual(el.segments, makeSmooth(false).toDrawElement().segments);
    });

    it('区間がすべて直線のパスは角の情報があっても polyline のまま', () => {
        const p = new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_LINE, ONE);
        assert.equal(p.toDrawElement().kind, 'polyline');
    });

    it('draw の bezierCurveTo の引数が角の点を反映する', () => {
        const p = makeSmooth(false, ONE);
        const controls = controlsWithCorners(p);
        const { ctx, log } = makeRecordingCtx();
        p.draw(ctx);
        const pts = makePoints();
        assert.deepEqual(log[2], ['bezierCurveTo', controls[0].control1.x, controls[0].control1.y, controls[0].control2.x, controls[0].control2.y, pts[1].x, pts[1].y]);
        const plain = makeRecordingCtx();
        makeSmooth(false).draw(plain.ctx);
        assert.notDeepEqual(log, plain.log);
    });

    it('当たり判定・範囲選択・塗りの内側が角の点を反映する', () => {
        const p = makeSmooth(false, ONE);
        const plain = makeSmooth(false);
        const c = controlsWithCorners(p)[0];
        const onCurve = cubicBezierPoint(p.points[0], c.control1, c.control2, p.points[1], 0.5);
        assert.equal(p.hitTest(onCurve.x, onCurve.y, 0.5), true);
        assert.equal(plain.hitTest(onCurve.x, onCurve.y, 0.5), false);
        assert.equal(p.intersectsRect(onCurve.x - 0.5, onCurve.y - 0.5, onCurve.x + 0.5, onCurve.y + 0.5), true);
        assert.equal(plain.intersectsRect(onCurve.x - 0.5, onCurve.y - 0.5, onCurve.x + 0.5, onCurve.y + 0.5), false);
        const allCorner = makeSmooth(true, [true, true, true, true], '#ff0000');
        for (const [x, y] of [[50, 50], [10, 10], [90, 90], [-5, 50], [105, 50], [50, 105]]) {
            const inside = x > 0 && x < 100 && y > 0 && y < 100;
            assert.equal(allCorner.hitTestFill(x, y), inside);
        }
    });

    it('readCornerFlags：キーなし・あり・直線の toJSON・新しい配列', () => {
        assert.deepEqual(readCornerFlags({ points: makePoints() }), NONE);
        const withKey = { points: makePoints(), corners: [true, false, 1, true] };
        const flags = readCornerFlags(withKey);
        assert.deepEqual(flags, [true, false, false, true]);
        assert.notEqual(flags, withKey.corners);
        assert.deepEqual(readCornerFlags({ points: makePoints(), corners: 'x' }), NONE);
        assert.deepEqual(readCornerFlags({ type: 'line', points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }), [false, false]);
    });
});

/**
 * 曲がり方を持つ区間の値を作る（引っ張る点は新しいオブジェクト）。
 * @param {number} x1 - control1のX
 * @param {number} y1 - control1のY
 * @param {number} x2 - control2のX
 * @param {number} y2 - control2のY
 * @returns {{kind: string, control1: {x: number, y: number}, control2: {x: number, y: number}}} 区間の値
 */
function bez(x1, y1, x2, y2) {
    return { kind: 'bezier', control1: { x: x1, y: y1 }, control2: { x: x2, y: y2 } };
}

describe('Path の曲がり方を持つ区間（Phase 09-03a）', () => {
    const P2 = [{ x: 0, y: 0 }, { x: 60, y: 0 }];
    const P3 = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 120, y: 60 }];

    it('定数 SEGMENT_KIND_BEZIER は "bezier"', () => {
        assert.equal(SEGMENT_KIND_BEZIER, 'bezier');
    });

    it('区間の指定：文字列と区間の値の混在を写し、余分なキーは捨てる', () => {
        const spec = [{ kind: 'line', control1: { x: 1, y: 1 } }, bez(20, 40, 40, 40)];
        const path = new Path(P3, false, '#000000', 2, null, spec);
        assert.deepEqual(path.segments, [{ kind: 'line' }, bez(20, 40, 40, 40)]);
        const mixed = new Path(P3, false, '#000000', 2, null, ['smooth', bez(1, 2, 3, 4)]);
        assert.deepEqual(mixed.segments, [{ kind: 'smooth' }, bez(1, 2, 3, 4)]);
    });

    it('渡した配列・区間の値・座標を後で書き換えても図形は変わらない', () => {
        const spec = [bez(20, 40, 40, 40)];
        const path = new Path(P2, false, '#000000', 2, null, spec);
        spec[0].control1.x = 999;
        spec[0].control2.y = 999;
        spec[0].kind = 'line';
        spec.length = 0;
        assert.deepEqual(path.segments, [bez(20, 40, 40, 40)]);
    });

    it('形：toDrawElement は bezierPath の cubic（絶対座標）', () => {
        const path = new Path(P2, false, '#000000', 2, null, [bez(20, 40, 40, 40)]);
        const element = path.toDrawElement();
        assert.equal(element.kind, 'bezierPath');
        assert.deepEqual(element.segments[0], { kind: 'cubic', control1: { x: 20, y: 40 }, control2: { x: 40, y: 40 } });
    });

    it('形：描画の命令は moveTo → bezierCurveTo', () => {
        const path = new Path(P2, false, '#000000', 2, null, [bez(20, 40, 40, 40)]);
        const { ctx, log } = makeRecordingCtx();
        path.draw(ctx);
        assert.deepEqual(log.slice(0, 3), [['beginPath'], ['moveTo', 0, 0], ['bezierCurveTo', 20, 40, 40, 40, 60, 0]]);
    });

    it('形：hitTest・intersectsRect', () => {
        const path = new Path(P2, false, '#000000', 2, null, [bez(20, 40, 40, 40)]);
        assert.equal(path.hitTest(30, 30, 1), true);
        assert.equal(path.hitTest(30, 0, 1), false);
        assert.equal(path.intersectsRect(25, 25, 35, 35), true);
        assert.equal(path.intersectsRect(25, 40, 35, 50), false);
    });

    it('塗りの内側：膨らみの中は真・外は偽', () => {
        const points = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }];
        const path = new Path(points, true, '#000000', 2, '#ff0000', [bez(20, -40, 40, -40), 'line', 'line', 'line']);
        assert.equal(path.hitTestFill(30, -20), true);
        assert.equal(path.hitTestFill(30, -40), false);
        assert.equal(path.hitTestFill(30, 30), true);
    });

    it('隣の打った点の曲線の区間の制御点は、隣が直線のときと一致する（つなぎ目は角）', () => {
        const withBezier = new Path(P3, false, '#000000', 2, null, [bez(20, 40, 40, 40), 'smooth']);
        const withLine = new Path(P3, false, '#000000', 2, null, ['line', 'smooth']);
        assert.deepEqual(withBezier.toDrawElement().segments[1], withLine.toDrawElement().segments[1]);
        assert.equal(withBezier.toDrawElement().segments[1].kind, 'cubic');
    });

    it('setVertex：頂点につながる区間の引っ張る点だけがついていく（開いたパス）', () => {
        const path = new Path(P3, false, '#000000', 2, null, [bez(10, 10, 50, 10), bez(70, 10, 110, 50)]);
        path.setVertex(1, 63, 5);
        assert.deepEqual(path.segments, [bez(10, 10, 53, 15), bez(73, 15, 110, 50)]);
        path.setVertex(0, 2, 3);
        assert.deepEqual(path.segments[0].control1, { x: 12, y: 13 });
        assert.deepEqual(path.segments[0].control2, { x: 53, y: 15 });
        path.setVertex(2, 130, 60);
        assert.deepEqual(path.segments[1].control2, { x: 120, y: 50 });
        assert.deepEqual(path.segments[1].control1, { x: 73, y: 15 });
    });

    it('setVertex：閉じたパスの最後の区間の control2 は頂点0についていく', () => {
        const points = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }];
        const path = new Path(points, true, '#000000', 2, null, ['line', 'line', bez(40, 60, 10, 30)]);
        path.setVertex(0, 5, 5);
        assert.deepEqual(path.segments[2], bez(40, 60, 15, 35));
        path.setVertex(2, 60, 70);
        assert.deepEqual(path.segments[2].control1, { x: 40, y: 70 });
    });

    it('setVertex：範囲外・不正な番号では何も変わらない', () => {
        const path = new Path(P2, false, '#000000', 2, null, [bez(20, 40, 40, 40)]);
        const before = path.toJSON();
        path.setVertex(2, 9, 9);
        path.setVertex(-1, 9, 9);
        path.setVertex(0.5, 9, 9);
        path.setVertex('0', 9, 9);
        assert.deepEqual(path.toJSON(), before);
    });

    it('translate：頂点も引っ張る点もすべて動く', () => {
        const path = new Path(P3, false, '#000000', 2, null, [bez(10, 10, 50, 10), 'line']);
        path.translate(5, -5);
        assert.deepEqual(path.points[1], { x: 65, y: -5 });
        assert.deepEqual(path.segments, [bez(15, 5, 55, 5), { kind: 'line' }]);
    });

    it('直線・打った点の曲線の区間だけのパスの setVertex・translate は今までと同じ', () => {
        const path = new Path(P3, false, '#000000', 2, null, ['line', 'smooth']);
        path.setVertex(1, 70, 10);
        path.translate(1, 2);
        const json = path.toJSON();
        assert.deepEqual(json.points, [{ x: 1, y: 2 }, { x: 71, y: 12 }, { x: 121, y: 62 }]);
        assert.deepEqual(json.segments, [{ kind: 'line' }, { kind: 'smooth' }]);
    });

    it('toJSON：bezier は kind・control1・control2 の順、戻り値を書き換えても図形は変わらない', () => {
        const path = new Path(P3, false, '#000000', 2, null, [bez(10, 10, 50, 10), 'line']);
        const json = path.toJSON();
        assert.deepEqual(Object.keys(json.segments[0]), ['kind', 'control1', 'control2']);
        assert.deepEqual(Object.keys(json.segments[1]), ['kind']);
        json.segments[0].control1.x = 999;
        json.segments.length = 0;
        assert.deepEqual(path.segments[0], bez(10, 10, 50, 10));
    });

    it('fromJSON：往復が一致する（開いた・閉じた・混在・corners あり）', () => {
        const open = new Path(P3, false, '#112233', 3, null, [bez(10, 10, 50, 10), 'smooth']);
        const points4 = [{ x: 0, y: 0 }, { x: 60, y: 0 }, { x: 60, y: 60 }, { x: 0, y: 60 }];
        const closed = new Path(points4, true, '#112233', 3, '#ff0000', ['line', 'smooth', bez(60, 40, 20, 80), 'smooth'], [false, true, false, false]);
        for (const path of [open, closed]) {
            path.id = 's1';
            const json = path.toJSON();
            const restored = Path.fromJSON(json);
            assert.deepEqual(restored.toJSON(), json);
            assert.deepEqual(restored.toDrawElement(), path.toDrawElement());
            json.segments.forEach((segment) => {
                if (segment.control1) segment.control1.x = 12345;
            });
            assert.deepEqual(restored.toJSON(), path.toJSON());
        }
    });

    it('fromJSON：不正な引っ張る点は Error（文面の完全一致）', () => {
        const base = () => ({
            type: 'path', id: 's', points: P2.map((p) => ({ ...p })), closed: false,
            segments: [bez(20, 40, 40, 40)], strokeColor: '#000000', strokeWidth: 2, fillColor: null,
        });
        for (const key of ['control1', 'control2']) {
            const reason = `segments[0]の${key}がx・yを有限の数値で持つオブジェクトではありません`;
            const bad = [undefined, null, [], 5, { y: 1 }, { x: 1 }, { x: NaN, y: 1 }, { x: 1, y: Infinity }, { x: '1', y: 1 }];
            for (const value of bad) {
                const data = base();
                if (value === undefined) {
                    delete data.segments[0][key];
                } else {
                    data.segments[0][key] = value;
                }
                assertFromJSONError(data, reason);
            }
        }
    });

    it('fromJSON：line の区間が control1 を持っていても無視する／未知の種類の文面は今のまま', () => {
        const data = {
            type: 'path', id: 's', points: P2.map((p) => ({ ...p })), closed: false,
            segments: [{ kind: 'line', control1: { x: 1, y: 1 } }], strokeColor: '#000000', strokeWidth: 2, fillColor: null,
        };
        assert.deepEqual(Path.fromJSON(data).toJSON().segments, [{ kind: 'line' }]);
        data.segments = [{ kind: 'arc' }];
        assertFromJSONError(data, "segments[0]のkindが'line'・'smooth'ではありません（arc）");
    });
});

describe('Path.createTransformed', () => {
    const SCALE = { a: 2, b: 0, c: 0, d: 3, e: 0, f: 0 };
    /**
     * 曲がり方を持つ区間を含む開いたパスを作る（頂点(0,0)・(100,0)・(100,100)。区間は曲がり方を持つ区間・直線の区間）。
     * @returns {Path} 区間が混ざったパス
     */
    function makeBezierPath() {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
            false, '#112233', 5, null,
            [{ kind: 'bezier', control1: { x: 10, y: 20 }, control2: { x: 90, y: 20 } }, 'line'],
        );
        path.id = 'p1';
        return path;
    }
    it('直線の区間のパスの頂点が写る（スタイル・id・closedは同じ）', () => {
        const path = makePath(true);
        path.id = 'p1';
        path.strokeColor = '#112233';
        path.strokeWidth = 5;
        path.fillColor = '#445566';
        const out = path.createTransformed(SCALE);
        assert.deepEqual(out.toJSON(), {
            type: 'path', id: 'p1',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }, { x: 0, y: 300 }],
            closed: true,
            segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'line' }],
            strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566',
        });
        assert.deepEqual(out.toDrawElement(), {
            kind: 'polyline', id: 'p1',
            points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }, { x: 0, y: 300 }],
            closed: true, strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566',
        });
    });
    it('曲がり方を持つ区間の引っ張る点も写り、直線の区間は{ kind }のまま', () => {
        const out = makeBezierPath().createTransformed({ a: -1, b: 0, c: 0, d: 2, e: 10, f: 0 });
        assert.deepEqual(out.toJSON(), {
            type: 'path', id: 'p1',
            points: [{ x: 10, y: 0 }, { x: -90, y: 0 }, { x: -90, y: 200 }],
            closed: false,
            segments: [{ kind: 'bezier', control1: { x: 0, y: 40 }, control2: { x: -80, y: 40 } }, { kind: 'line' }],
            strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
        assert.deepEqual(out.toDrawElement(), {
            kind: 'bezierPath', id: 'p1',
            points: [{ x: 10, y: 0 }, { x: -90, y: 0 }, { x: -90, y: 200 }],
            closed: false,
            segments: [{ kind: 'cubic', control1: { x: 0, y: 40 }, control2: { x: -80, y: 40 } }, { kind: 'line' }],
            strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
    });
    it('曲線の区間（smooth）と角の点（corners）が同じ並びで保たれ、制御点は頂点の写しに追従する', () => {
        const path = new Path(makePoints(), false, '#000000', 2, null, SEGMENT_KIND_SMOOTH, [false, true, false, false]);
        path.id = 'p1';
        const out = path.createTransformed(SCALE);
        assert.deepEqual(out.segments, [{ kind: 'smooth' }, { kind: 'smooth' }, { kind: 'smooth' }]);
        assert.deepEqual(out.corners, [false, true, false, false]);
        assert.deepEqual(out.toJSON().points, [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 300 }, { x: 0, y: 300 }]);
        assert.deepEqual(out.toJSON().corners, [false, true, false, false]);
        const before = computeSmoothSegmentControls(path.points, path.segments.map((s) => s.kind === SEGMENT_KIND_SMOOTH), path.closed, path.corners);
        const after = computeSmoothSegmentControls(out.points, out.segments.map((s) => s.kind === SEGMENT_KIND_SMOOTH), out.closed, out.corners);
        after.forEach((control, i) => {
            assert.ok(Math.abs(control.control1.x - before[i].control1.x * 2) < 1e-9);
            assert.ok(Math.abs(control.control1.y - before[i].control1.y * 3) < 1e-9);
            assert.ok(Math.abs(control.control2.x - before[i].control2.x * 2) < 1e-9);
            assert.ok(Math.abs(control.control2.y - before[i].control2.y * 3) < 1e-9);
        });
    });
    /**
     * 直線・曲がり方を持つ・曲線の区間と角の点を含む開いたパスを作る（頂点(0,0)・(100,0)・(100,100)・(0,100)・(-50,150)。
     * 区間は直線・曲がり方を持つ(120,30)(130,70)・曲線・曲線。角の点は頂点3）。
     * @returns {Path} 区間が混ざったパス
     */
    function makeMixedPath() {
        const path = new Path(
            [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: -50, y: 150 }],
            false, '#112233', 5, null,
            ['line', { kind: 'bezier', control1: { x: 120, y: 30 }, control2: { x: 130, y: 70 } }, 'smooth', 'smooth'],
            [false, false, false, true, false],
        );
        path.id = 'p1';
        return path;
    }
    /**
     * 変換後の曲線の区間の制御点が、変換前の制御点を同じ変換で写した点と一致することを確かめる。
     * @param {Path} before - 変換前
     * @param {Path} after - 変換後
     * @param {{a: number, b: number, c: number, d: number, e: number, f: number}} t - 当てた変換
     */
    function assertSmoothControlsFollow(before, after, t) {
        const isSmooth = (s) => s.kind === SEGMENT_KIND_SMOOTH;
        const b = computeSmoothSegmentControls(before.points, before.segments.map(isSmooth), before.closed, before.corners);
        const a = computeSmoothSegmentControls(after.points, after.segments.map(isSmooth), after.closed, after.corners);
        b.forEach((control, i) => {
            if (control === null) {
                assert.equal(a[i], null);
                return;
            }
            for (const key of ['control1', 'control2']) {
                const expected = applyAffineTransformToPoint(t, control[key]);
                assert.ok(Math.abs(a[i][key].x - expected.x) < 1e-9);
                assert.ok(Math.abs(a[i][key].y - expected.y) < 1e-9);
            }
        });
    }
    it('直線・曲がり方を持つ・曲線の区間と角の点を含むパスの上下の裏返し（d < 0）', () => {
        const t = { a: 1, b: 0, c: 0, d: -1, e: 0, f: 200 };
        const path = makeMixedPath();
        const out = path.createTransformed(t);
        assert.deepEqual(out.toJSON(), {
            type: 'path', id: 'p1',
            points: [{ x: 0, y: 200 }, { x: 100, y: 200 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: -50, y: 50 }],
            closed: false,
            segments: [{ kind: 'line' }, { kind: 'bezier', control1: { x: 120, y: 170 }, control2: { x: 130, y: 130 } }, { kind: 'smooth' }, { kind: 'smooth' }],
            corners: [false, false, false, true, false],
            strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
        assert.deepEqual(out.toDrawElement().points, [{ x: 0, y: 200 }, { x: 100, y: 200 }, { x: 100, y: 100 }, { x: 0, y: 100 }, { x: -50, y: 50 }]);
        assertSmoothControlsFollow(path, out, t);
    });
    it('直線・曲がり方を持つ・曲線の区間と角の点を含むパスの上下と左右の両方の裏返し（a < 0かつd < 0）', () => {
        const t = { a: -1, b: 0, c: 0, d: -1, e: 100, f: 200 };
        const path = makeMixedPath();
        const out = path.createTransformed(t);
        assert.deepEqual(out.toJSON(), {
            type: 'path', id: 'p1',
            points: [{ x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 150, y: 50 }],
            closed: false,
            segments: [{ kind: 'line' }, { kind: 'bezier', control1: { x: -20, y: 170 }, control2: { x: -30, y: 130 } }, { kind: 'smooth' }, { kind: 'smooth' }],
            corners: [false, false, false, true, false],
            strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
        assert.deepEqual(out.toDrawElement().points, [{ x: 100, y: 200 }, { x: 0, y: 200 }, { x: 0, y: 100 }, { x: 100, y: 100 }, { x: 150, y: 50 }]);
        assertSmoothControlsFollow(path, out, t);
    });
    it('角の点がないパスの変形後のtoJSON()にcornersのキーが出ない', () => {
        assert.equal('corners' in makePath(false).createTransformed(SCALE).toJSON(), false);
    });
    it('回転を含む一般の変換でも頂点・引っ張る点が写る', () => {
        const out = makeBezierPath().createTransformed({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
        assert.deepEqual(out.toJSON().points, [{ x: 0, y: 0 }, { x: 0, y: 100 }, { x: -100, y: 100 }]);
        assert.deepEqual(out.toJSON().segments[0], { kind: 'bezier', control1: { x: -20, y: 10 }, control2: { x: -20, y: 90 } });
    });
    it('自身は変わらず、戻り値と頂点・区間・引っ張る点・cornersを共有しない', () => {
        const path = makeBezierPath();
        path.corners[1] = true;
        const before = JSON.stringify(path.toJSON());
        const out = path.createTransformed(SCALE);
        assert.equal(JSON.stringify(path.toJSON()), before);
        assert.notEqual(out, path);
        out.points[0].x = 999;
        out.segments[0].control1.x = 999;
        out.segments[1].kind = 'smooth';
        out.corners[1] = false;
        out.translate(5, 5);
        assert.equal(JSON.stringify(path.toJSON()), before);
    });
    it('同じ自身から2回作っても2回目は1回目の影響を受けない', () => {
        const path = makeBezierPath();
        const t = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
        const first = path.createTransformed(t);
        first.translate(100, 100);
        const second = path.createTransformed(t);
        assert.deepEqual(second.toJSON().points, [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 200, y: 200 }]);
        assert.deepEqual(second.toJSON().segments[0], { kind: 'bezier', control1: { x: 20, y: 40 }, control2: { x: 180, y: 40 } });
        assert.deepEqual(first.toJSON().points, [{ x: 100, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }]);
        assert.deepEqual(first.toJSON().segments[0], { kind: 'bezier', control1: { x: 120, y: 140 }, control2: { x: 280, y: 140 } });
    });
});
