/**
 * 責務: 矩形（Rect）の当たり判定（hitTest・intersectsRect）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 正常な矩形の図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @returns {{type: string, id: string, points: {x: number, y: number}[], strokeColor: string, strokeWidth: number}} 正常な図形データ
 */
function makeValidData() {
    const data = new Rect(0, 0, 100, 50).toJSON();
    data.id = 'shape-1';
    return data;
}

/**
 * Rect.fromJSONが指定の図形データでErrorを投げ、メッセージが「Rect.fromJSON: 理由」の全文と一致することを確かめる。
 * @param {*} data - fromJSONへ渡す図形データ
 * @param {string} reason - 「Rect.fromJSON: 」の後ろに続く理由
 * @returns {void}
 */
function assertFromJSONError(data, reason) {
    assert.throws(() => Rect.fromJSON(data), { name: 'Error', message: 'Rect.fromJSON: ' + reason });
}

/**
 * 標準の矩形を作る。頂点は(0,0)・(100,0)・(100,50)・(0,50)。
 * @returns {Rect} 標準の矩形
 */
function makeRect() {
    return new Rect(0, 0, 100, 50);
}

describe('Rect.hitTest', () => {
    it('4辺の上は当たる', () => {
        const r = makeRect();
        assert.equal(r.hitTest(50, 0, 0), true);
        assert.equal(r.hitTest(100, 25, 0), true);
        assert.equal(r.hitTest(50, 50, 0), true);
        assert.equal(r.hitTest(0, 25, 0), true);
    });

    it('塗り内部（中央）は当たらない', () => {
        assert.equal(makeRect().hitTest(50, 25, 5), false);
    });

    it('許容誤差ちょうど（外側・内側に距離5）は当たる', () => {
        const r = makeRect();
        assert.equal(r.hitTest(50, -5, 5), true);
        assert.equal(r.hitTest(50, 5, 5), true);
    });

    it('許容誤差の外（外側・内側に距離6）は当たらない', () => {
        const r = makeRect();
        assert.equal(r.hitTest(50, -6, 5), false);
        assert.equal(r.hitTest(50, 6, 5), false);
    });

    it('角の外側の斜めは距離5まで当たり、約5.66は当たらない', () => {
        const r = makeRect();
        assert.equal(r.hitTest(103, -4, 5), true);
        assert.equal(r.hitTest(104, -4, 5), false);
    });

    it('辺の延長上（角から距離6）は当たらない', () => {
        assert.equal(makeRect().hitTest(106, 0, 5), false);
    });

    it('頂点を動かした後（4頂点の自由変形）の辺で判定する', () => {
        const r = makeRect();
        r.setVertex(2, 200, 100);
        assert.equal(r.hitTest(150, 50, 0), true);
        assert.equal(r.hitTest(100, 25, 1), false);
    });

    it('平行移動の後の矩形で判定する', () => {
        const r = makeRect();
        r.translate(10, 10);
        assert.equal(r.hitTest(60, 10, 0), true);
        assert.equal(r.hitTest(50, 0, 1), false);
    });

    it('縮退（4点が同じ位置）は点との距離で判定する', () => {
        const r = new Rect(10, 10, 10, 10);
        assert.equal(r.hitTest(13, 14, 5), true);
        assert.equal(r.hitTest(10, 16, 5), false);
    });
});

describe('Rect.intersectsRect', () => {
    it('辺に掛かる矩形・全体を含む矩形は true', () => {
        const r = makeRect();
        assert.equal(r.intersectsRect(90, 10, 110, 20), true);
        assert.equal(r.intersectsRect(-10, -10, 110, 60), true);
    });

    it('塗り内部だけを囲む矩形は false', () => {
        assert.equal(makeRect().intersectsRect(10, 10, 90, 40), false);
    });

    it('完全に外れる矩形は false', () => {
        assert.equal(makeRect().intersectsRect(200, 200, 300, 300), false);
    });

    it('境界に接する（辺・角）は true', () => {
        const r = makeRect();
        assert.equal(r.intersectsRect(100, 10, 110, 20), true);
        assert.equal(r.intersectsRect(-10, 50, 0, 60), true);
    });

    it('境界のわずか外は false', () => {
        assert.equal(makeRect().intersectsRect(100.5, 10, 110, 20), false);
    });

    it('頂点を動かした後（4頂点の自由変形）の辺で判定する', () => {
        const r = makeRect();
        r.setVertex(2, 200, 100);
        assert.equal(r.intersectsRect(95, 20, 105, 30), false);
        assert.equal(r.intersectsRect(145, 45, 155, 55), true);
    });

    it('平行移動の後の矩形で判定する', () => {
        const r = makeRect();
        r.translate(10, 10);
        assert.equal(r.intersectsRect(40, -5, 60, 5), false);
        assert.equal(r.intersectsRect(40, 5, 60, 15), true);
    });

    it('縮退（4点が同じ位置）は点の内包判定になる', () => {
        const r = new Rect(10, 10, 10, 10);
        assert.equal(r.intersectsRect(0, 0, 20, 20), true);
        assert.equal(r.intersectsRect(11, 11, 20, 20), false);
    });
});

describe('Rect.fromJSON のエラー文', () => {
    it('正常なデータは例外を投げず、座標・色・太さ・idを復元する', () => {
        const rect = Rect.fromJSON(makeValidData());
        assert.deepEqual(rect.toJSON(), makeValidData());
    });

    it('オブジェクトでない入力は拒否する', () => {
        for (const bad of [null, [], 'rect', 42, undefined]) {
            assertFromJSONError(bad, '図形データがオブジェクトではありません');
        }
    });

    it('種別の不一致は拒否する', () => {
        const other = makeValidData();
        other.type = 'line';
        assertFromJSONError(other, "図形種別が'rect'ではありません（line）");
        const noType = makeValidData();
        delete noType.type;
        assertFromJSONError(noType, "図形種別が'rect'ではありません（undefined）");
    });

    it('頂点数の不一致は拒否する', () => {
        const few = makeValidData();
        few.points = few.points.slice(0, 3);
        assertFromJSONError(few, 'pointsが4要素の配列ではありません');
        const many = makeValidData();
        many.points.push({ x: 0, y: 0 });
        assertFromJSONError(many, 'pointsが4要素の配列ではありません');
        const none = makeValidData();
        delete none.points;
        assertFromJSONError(none, 'pointsが4要素の配列ではありません');
        const notArray = makeValidData();
        notArray.points = {};
        assertFromJSONError(notArray, 'pointsが4要素の配列ではありません');
    });

    it('頂点の座標が有限の数値でなければ、何番目かを添えて拒否する', () => {
        const nan = makeValidData();
        nan.points[3] = { x: 0, y: NaN };
        assertFromJSONError(nan, 'points[3]のx・yが有限の数値ではありません');
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
        assertFromJSONError(num, 'strokeColorが文字列ではありません');
        const none = makeValidData();
        delete none.strokeColor;
        assertFromJSONError(none, 'strokeColorが文字列ではありません');
    });

    it('strokeWidthが正の有限の数値でなければ拒否する', () => {
        for (const bad of [0, -1, NaN, Infinity, '2']) {
            const data = makeValidData();
            data.strokeWidth = bad;
            assertFromJSONError(data, 'strokeWidthが正の有限の数値ではありません');
        }
        const none = makeValidData();
        delete none.strokeWidth;
        assertFromJSONError(none, 'strokeWidthが正の有限の数値ではありません');
    });

    it('検査の順序：種別 → 頂点数 → 頂点（小さい番号が先）→ strokeColor → strokeWidth', () => {
        const typeAndCount = makeValidData();
        typeAndCount.type = 'line';
        typeAndCount.points = [];
        assertFromJSONError(typeAndCount, "図形種別が'rect'ではありません（line）");

        const countAndColor = makeValidData();
        countAndColor.points = [];
        countAndColor.strokeColor = 123;
        assertFromJSONError(countAndColor, 'pointsが4要素の配列ではありません');

        const bothPoints = makeValidData();
        bothPoints.points[0] = { x: NaN, y: 0 };
        bothPoints.points[1] = { x: 0, y: NaN };
        assertFromJSONError(bothPoints, 'points[0]のx・yが有限の数値ではありません');

        const pointAndColor = makeValidData();
        pointAndColor.points[3] = { x: 0, y: NaN };
        pointAndColor.strokeColor = 123;
        assertFromJSONError(pointAndColor, 'points[3]のx・yが有限の数値ではありません');

        const colorAndWidth = makeValidData();
        colorAndWidth.strokeColor = 123;
        colorAndWidth.strokeWidth = 0;
        assertFromJSONError(colorAndWidth, 'strokeColorが文字列ではありません');
    });
});
