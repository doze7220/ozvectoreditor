/**
 * 責務: 2次ベジェ曲線（Curve）の当たり判定（hitTest・intersectsRect）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Curve } from '../../js/shapes/Curve.js';

/**
 * 正常な曲線の図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @returns {{type: string, id: string, points: {x: number, y: number}[], strokeColor: string, strokeWidth: number}} 正常な図形データ
 */
function makeValidData() {
    const data = new Curve(0, 0, 100, 0).toJSON();
    data.id = 'shape-1';
    return data;
}

/**
 * Curve.fromJSONが指定の図形データでErrorを投げ、メッセージが「Curve.fromJSON: 理由」の全文と一致することを確かめる。
 * @param {*} data - fromJSONへ渡す図形データ
 * @param {string} reason - 「Curve.fromJSON: 」の後ろに続く理由
 * @returns {void}
 */
function assertFromJSONError(data, reason) {
    assert.throws(() => Curve.fromJSON(data), { name: 'Error', message: 'Curve.fromJSON: ' + reason });
}

/**
 * 図形A（曲がった曲線）を作る。始点(0,0)・制御点(50,100)・終点(100,0)。頂点はt=0.5の(50,50)。
 * @returns {Curve} 図形A
 */
function curveA() {
    const c = new Curve(0, 0, 100, 0);
    c.setVertex(1, 50, 100);
    return c;
}

/**
 * 図形B（まっすぐな曲線）を作る。始点(0,0)・制御点は中点(50,0)・終点(100,0)。
 * @returns {Curve} 図形B
 */
function curveB() {
    return new Curve(0, 0, 100, 0);
}

describe('Curve.hitTest', () => {
    it('A: 輪郭線の上（t=0.5の分割点）は当たる', () => {
        assert.equal(curveA().hitTest(50, 50, 0), true);
    });

    it('A: 許容誤差ちょうど（頂点から距離5）は当たり、外（距離6）は当たらない', () => {
        assert.equal(curveA().hitTest(50, 55, 5), true);
        assert.equal(curveA().hitTest(50, 56, 5), false);
    });

    it('A: 制御点は輪郭ではないので当たらない', () => {
        assert.equal(curveA().hitTest(50, 100, 5), false);
    });

    it('A: 端点は当たる', () => {
        assert.equal(curveA().hitTest(0, 0, 0), true);
        assert.equal(curveA().hitTest(100, 0, 0), true);
    });

    it('A: 始点の外側は距離5まで当たり、距離6は当たらない', () => {
        assert.equal(curveA().hitTest(-5, 0, 5), true);
        assert.equal(curveA().hitTest(-6, 0, 5), false);
    });

    it('B: 終点の外側の延長上は距離5まで当たり、距離6は当たらない', () => {
        assert.equal(curveB().hitTest(105, 0, 5), true);
        assert.equal(curveB().hitTest(106, 0, 5), false);
    });

    it('B: 輪郭線の上は当たる', () => {
        assert.equal(curveB().hitTest(50, 0, 0), true);
    });

    it('平行移動の後の曲線で判定する', () => {
        const c = curveA();
        c.translate(10, 10);
        assert.equal(c.hitTest(60, 60, 0), true);
        assert.equal(c.hitTest(50, 50, 1), false);
    });

    it('縮退（3点が同じ位置）は点との距離で判定する', () => {
        const c = new Curve(10, 10, 10, 10);
        assert.equal(c.hitTest(13, 14, 5), true);
        assert.equal(c.hitTest(10, 16, 5), false);
    });
});

describe('Curve.intersectsRect', () => {
    it('A: 輪郭に掛かる矩形・全体を含む矩形は true', () => {
        assert.equal(curveA().intersectsRect(45, 45, 55, 55), true);
        assert.equal(curveA().intersectsRect(-10, -10, 110, 110), true);
    });

    it('A: 曲線の内側（凹んだ側）だけの矩形は false', () => {
        assert.equal(curveA().intersectsRect(40, 10, 60, 40), false);
    });

    it('A: 頂点と制御点の間だけの矩形（早期棄却を通過し、分割で外れる）は false', () => {
        assert.equal(curveA().intersectsRect(40, 60, 60, 90), false);
    });

    it('A: 完全に外れる矩形（早期棄却）は false', () => {
        assert.equal(curveA().intersectsRect(200, 200, 300, 300), false);
    });

    it('A: 境界に接する（頂点が矩形の上辺）は true、わずか外は false', () => {
        assert.equal(curveA().intersectsRect(45, 50, 55, 60), true);
        assert.equal(curveA().intersectsRect(45, 50.5, 55, 60), false);
    });

    it('B: 境界に接する（辺・終点が矩形の角）は true', () => {
        assert.equal(curveB().intersectsRect(40, 0, 60, 10), true);
        assert.equal(curveB().intersectsRect(100, 0, 110, 10), true);
    });

    it('B: 境界のわずか外は false', () => {
        assert.equal(curveB().intersectsRect(40, 0.5, 60, 10), false);
        assert.equal(curveB().intersectsRect(100.5, -10, 110, 10), false);
    });

    it('平行移動の後の曲線で判定する', () => {
        const c = curveA();
        c.translate(10, 10);
        assert.equal(c.intersectsRect(55, 55, 65, 65), true);
        assert.equal(c.intersectsRect(45, 45, 55, 55), false);
    });

    it('縮退（3点が同じ位置）は点の内包判定になる', () => {
        const c = new Curve(10, 10, 10, 10);
        assert.equal(c.intersectsRect(0, 0, 20, 20), true);
        assert.equal(c.intersectsRect(11, 11, 20, 20), false);
    });
});

describe('Curve.fromJSON のエラー文', () => {
    it('正常なデータは例外を投げず、座標・色・太さ・idを復元する', () => {
        const curve = Curve.fromJSON(makeValidData());
        assert.deepEqual(curve.toJSON(), makeValidData());
    });

    it('オブジェクトでない入力は拒否する', () => {
        for (const bad of [null, [], 'curve', 42, undefined]) {
            assertFromJSONError(bad, '図形データがオブジェクトではありません');
        }
    });

    it('種別の不一致は拒否する', () => {
        const other = makeValidData();
        other.type = 'line';
        assertFromJSONError(other, "図形種別が'curve'ではありません（line）");
        const noType = makeValidData();
        delete noType.type;
        assertFromJSONError(noType, "図形種別が'curve'ではありません（undefined）");
    });

    it('頂点数の不一致は拒否する', () => {
        const few = makeValidData();
        few.points = few.points.slice(0, 2);
        assertFromJSONError(few, 'pointsが3要素の配列ではありません');
        const many = makeValidData();
        many.points.push({ x: 0, y: 0 });
        assertFromJSONError(many, 'pointsが3要素の配列ではありません');
        const none = makeValidData();
        delete none.points;
        assertFromJSONError(none, 'pointsが3要素の配列ではありません');
        const notArray = makeValidData();
        notArray.points = {};
        assertFromJSONError(notArray, 'pointsが3要素の配列ではありません');
    });

    it('頂点の座標が有限の数値でなければ、何番目かを添えて拒否する', () => {
        const nan = makeValidData();
        nan.points[2] = { x: 0, y: NaN };
        assertFromJSONError(nan, 'points[2]のx・yが有限の数値ではありません');
        const isNull = makeValidData();
        isNull.points[0] = null;
        assertFromJSONError(isNull, 'points[0]のx・yが有限の数値ではありません');
        const str = makeValidData();
        str.points[0] = { x: '1', y: 0 };
        assertFromJSONError(str, 'points[0]のx・yが有限の数値ではありません');
        const inf = makeValidData();
        inf.points[0] = { x: Infinity, y: 0 };
        assertFromJSONError(inf, 'points[0]のx・yが有限の数値ではありません');
    });

    it('strokeColorが文字列でなければ拒否する', () => {
        const num = makeValidData();
        num.strokeColor = 123;
        assertFromJSONError(num, 'strokeColorが文字列またはnullではありません');
        const none = makeValidData();
        delete none.strokeColor;
        assertFromJSONError(none, 'strokeColorが文字列またはnullではありません');
    });

    it('strokeWidthが正の有限の数値でなければ拒否する', () => {
        for (const bad of [0, -1, NaN, Infinity, '2', null]) {
            const data = makeValidData();
            data.strokeWidth = bad;
            assertFromJSONError(data, 'strokeWidthが正の有限の数値ではありません');
        }
    });

    it('strokeColor: nullの図形データを受理する（線なし）', () => {
        const data = makeValidData();
        data.strokeColor = null;
        assert.equal(Curve.fromJSON(data).toJSON().strokeColor, null);
    });

    it('strokeWidthのキーが無い図形データを受理し、2pxとして読む', () => {
        const data = makeValidData();
        delete data.strokeWidth;
        assert.equal(Curve.fromJSON(data).toJSON().strokeWidth, 2);
    });

    it('検査の順序：種別 → 頂点数 → 頂点（小さい番号が先）→ strokeColor → strokeWidth', () => {
        const typeAndCount = makeValidData();
        typeAndCount.type = 'line';
        typeAndCount.points = [];
        assertFromJSONError(typeAndCount, "図形種別が'curve'ではありません（line）");

        const countAndColor = makeValidData();
        countAndColor.points = [];
        countAndColor.strokeColor = 123;
        assertFromJSONError(countAndColor, 'pointsが3要素の配列ではありません');

        const bothPoints = makeValidData();
        bothPoints.points = [{ x: NaN, y: 0 }, { x: 0, y: NaN }, { x: 0, y: 0 }];
        assertFromJSONError(bothPoints, 'points[0]のx・yが有限の数値ではありません');

        const pointAndColor = makeValidData();
        pointAndColor.points[2] = { x: 0, y: NaN };
        pointAndColor.strokeColor = 123;
        assertFromJSONError(pointAndColor, 'points[2]のx・yが有限の数値ではありません');

        const colorAndWidth = makeValidData();
        colorAndWidth.strokeColor = 123;
        colorAndWidth.strokeWidth = 0;
        assertFromJSONError(colorAndWidth, 'strokeColorが文字列またはnullではありません');
    });
});
