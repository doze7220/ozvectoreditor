/**
 * 責務: パス（Path）の当たり判定（輪郭・内側）・頂点のハンドル・塗れる形（isFillable）・描画命令（塗り・線なし）・
 * fromJSONの不正な図形データのエラー文・図形データと描画要素への変換・ハンドルの位置（getHandlePosition）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Path } from '../../js/shapes/Path.js';

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
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'stroke', 'fill', 'rect']) {
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
            assertFromJSONError(unknown, "segments[2]のkindが'line'ではありません（curve）");
            const noKind = makeValidData(false);
            noKind.segments[0] = {};
            assertFromJSONError(noKind, "segments[0]のkindが'line'ではありません（undefined）");
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
            assertFromJSONError(data, "segments[0]のkindが'line'ではありません（curve）");
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
