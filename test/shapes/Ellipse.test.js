/**
 * 責務: 円・弧（Ellipse）の当たり判定（hitTest・intersectsRect。縮退時の分岐を含む）とfromJSONの不正な図形データのエラー文を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 正常な円・弧の図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @param {string} [type='circle'] - 図形種別（'circle'|'arc'）
 * @returns {{type: string, id: string, points: {x: number, y: number}[], strokeColor: string, strokeWidth: number}} 正常な図形データ
 */
function makeValidData(type = 'circle') {
    const data = new Ellipse(0, 0, 50, 50, type).toJSON();
    data.id = 'shape-1';
    return data;
}

/**
 * Ellipse.fromJSONが指定の図形データでErrorを投げ、メッセージが「Ellipse.fromJSON: 理由」の全文と一致することを確かめる。
 * @param {*} data - fromJSONへ渡す図形データ
 * @param {string} reason - 「Ellipse.fromJSON: 」の後ろに続く理由
 * @returns {void}
 */
function assertFromJSONError(data, reason) {
    assert.throws(() => Ellipse.fromJSON(data), { name: 'Error', message: 'Ellipse.fromJSON: ' + reason });
}

/**
 * 図形C（中心(0,0)・半径50の円）を作る。
 * @returns {Ellipse} 半径50の円
 */
function makeCircle() {
    return new Ellipse(0, 0, 50, 50, 'circle');
}

/**
 * 図形D（中心(0,0)・半径50の弧。画面の上半分を描く）を作る。
 * @returns {Ellipse} 半径50の弧
 */
function makeArc() {
    return new Ellipse(0, 0, 50, 50, 'arc');
}

const TYPE_REASON_HEAD = "図形種別が'circle'・'arc'のいずれでもありません";

describe('Ellipse.hitTest', () => {
    it('円の輪郭線の上（右・上・下・左）は当たる', () => {
        const c = makeCircle();
        assert.equal(c.hitTest(50, 0, 0), true);
        assert.equal(c.hitTest(0, -50, 0), true);
        assert.equal(c.hitTest(0, 50, 0), true);
        assert.equal(c.hitTest(-50, 0, 0), true);
    });

    it('円の許容幅（4+1）の内側の付近は当たる', () => {
        const c = makeCircle();
        assert.equal(c.hitTest(54.5, 0, 4), true);
        assert.equal(c.hitTest(45.5, 0, 4), true);
    });

    it('円の許容幅の外側の付近は当たらない', () => {
        const c = makeCircle();
        assert.equal(c.hitTest(55.5, 0, 4), false);
        assert.equal(c.hitTest(44.5, 0, 4), false);
    });

    it('円の塗り内部（中心）は当たらない', () => {
        assert.equal(makeCircle().hitTest(0, 0, 5), false);
    });

    it('strokeWidth / 2 を許容誤差に足す（太さ2では距離4は外、太さ10では内）', () => {
        assert.equal(makeCircle().hitTest(54, 0, 0), false);
        const thick = new Ellipse(0, 0, 50, 50, 'circle', '#000000', 10);
        assert.equal(thick.hitTest(54, 0, 0), true);
        assert.equal(thick.hitTest(56, 0, 0), false);
    });

    it('弧の上半分の輪郭（上・右端・左端）は当たる', () => {
        const a = makeArc();
        assert.equal(a.hitTest(0, -50, 0), true);
        assert.equal(a.hitTest(50, 0, 0), true);
        assert.equal(a.hitTest(-50, 0, 0), true);
    });

    it('弧の下半分は当たらない', () => {
        const a = makeArc();
        assert.equal(a.hitTest(0, 50, 0), false);
        assert.equal(a.hitTest(0, 54.5, 4), false);
    });

    it('弧の上半分の許容幅の内側の付近は当たる', () => {
        assert.equal(makeArc().hitTest(0, -54.5, 4), true);
    });

    it('弧の端点のわずか下（角度の範囲外）は当たらない', () => {
        const a = makeArc();
        assert.equal(a.hitTest(50, 0.5, 0), false);
        assert.equal(a.hitTest(-50, 0.5, 0), false);
    });

    it('頂点を動かした後：右端の移動で半径xが変わり、yは無視される', () => {
        const c = makeCircle();
        c.setVertex(1, 100, 999);
        assert.equal(c.hitTest(100, 0, 0), true);
        assert.equal(c.hitTest(50, 0, 0), false);
    });

    it('頂点を動かした後：中心の移動で半径を保って移動する', () => {
        const c = makeCircle();
        c.setVertex(0, 10, 10);
        assert.equal(c.hitTest(60, 10, 0), true);
        assert.equal(c.hitTest(50, 0, 0), false);
    });

    it('楕円（半径が異なる）の輪郭で判定する', () => {
        const e = new Ellipse(0, 0, 100, 50, 'circle');
        assert.equal(e.hitTest(100, 0, 0), true);
        assert.equal(e.hitTest(0, -50, 0), true);
        assert.equal(e.hitTest(0, -55, 0), false);
    });

    it('平行移動の後の円で判定する', () => {
        const c = makeCircle();
        c.translate(10, 20);
        assert.equal(c.hitTest(60, 20, 0), true);
        assert.equal(c.hitTest(50, 0, 0), false);
    });

    it('縮退：半径0の円は折れ線までの距離（tolerance + strokeWidth / 2 以下）で判定する', () => {
        const e = new Ellipse(0, 0, 0, 0, 'circle');
        assert.equal(e.hitTest(0.5, 0, 0), true);
        assert.equal(e.hitTest(3, 0, 0), false);
        assert.equal(e.hitTest(3, 4, 4), true);
        assert.equal(e.hitTest(3, 4, 3.9), false);
    });

    it('縮退：つぶれた円（半径y=0）は中心も輪郭の線分上として当たる', () => {
        const e = new Ellipse(0, 0, 50, 0, 'circle');
        assert.equal(e.hitTest(0, 0, 0), true);
        assert.equal(e.hitTest(49, 0, 0), true);
        assert.equal(e.hitTest(0, 1.9, 1), true);
        assert.equal(e.hitTest(0, 2.1, 1), false);
        assert.equal(e.hitTest(51.9, 0, 1), true);
        assert.equal(e.hitTest(52.1, 0, 1), false);
    });

    it('縮退：つぶれた弧（半径x=0）は上へ伸びる線分だけ当たり、同じ大きさの円は下側も当たる', () => {
        const a = new Ellipse(0, 0, 0, 50, 'arc');
        assert.equal(a.hitTest(0, -25, 0), true);
        assert.equal(a.hitTest(0, 25, 0), false);
        const c = new Ellipse(0, 0, 0, 50, 'circle');
        assert.equal(c.hitTest(0, 25, 0), true);
    });

    it('縮退：半径が0でないが1未満でも縮退の分岐に入る', () => {
        const e = new Ellipse(0, 0, 0.5, 50, 'circle');
        assert.equal(e.hitTest(0, 0, 0), true);
        assert.equal(e.hitTest(0, 49, 0), true);
    });
});

describe('Ellipse.intersectsRect', () => {
    it('円の輪郭に掛かる矩形は交差する', () => {
        assert.equal(makeCircle().intersectsRect(45, -5, 55, 5), true);
    });

    it('円の全体を含む矩形は交差する', () => {
        assert.equal(makeCircle().intersectsRect(-60, -60, 60, 60), true);
    });

    it('円の塗り内部だけを囲む矩形は交差しない', () => {
        const c = makeCircle();
        assert.equal(c.intersectsRect(-20, -20, 20, 20), false);
        assert.equal(c.intersectsRect(-10, -5, 10, 5), false);
    });

    it('円に完全に外れる矩形（早期棄却）は交差しない', () => {
        assert.equal(makeCircle().intersectsRect(100, 100, 200, 200), false);
    });

    it('円の境界に接する矩形は交差し、わずか外は交差しない', () => {
        const c = makeCircle();
        assert.equal(c.intersectsRect(50, -10, 60, 10), true);
        assert.equal(c.intersectsRect(50.5, -10, 60, 10), false);
    });

    it('円の下半分にも掛かる', () => {
        const c = makeCircle();
        assert.equal(c.intersectsRect(-5, 45, 5, 55), true);
        assert.equal(c.intersectsRect(-60, 10, 60, 60), true);
    });

    it('弧の上半分に掛かる矩形は交差する', () => {
        const a = makeArc();
        assert.equal(a.intersectsRect(-5, -55, 5, -45), true);
        assert.equal(a.intersectsRect(45, -5, 55, 5), true);
    });

    it('弧の下半分だけに掛かる矩形は交差しない', () => {
        const a = makeArc();
        assert.equal(a.intersectsRect(-5, 45, 5, 55), false);
        assert.equal(a.intersectsRect(-60, 10, 60, 60), false);
    });

    it('弧の弦（両端を結ぶ線）の位置だけの矩形は交差しない', () => {
        assert.equal(makeArc().intersectsRect(-10, -5, 10, 5), false);
    });

    it('弧の右端に接する矩形は交差し、わずか下は交差しない', () => {
        const a = makeArc();
        assert.equal(a.intersectsRect(50, -10, 60, 10), true);
        assert.equal(a.intersectsRect(50, 0.5, 60, 10), false);
    });

    it('弧の全体を含む矩形は交差する', () => {
        assert.equal(makeArc().intersectsRect(-60, -60, 60, 60), true);
    });

    it('平行移動の後の円で判定する', () => {
        const c = makeCircle();
        c.translate(10, 20);
        assert.equal(c.intersectsRect(55, 15, 65, 25), true);
        assert.equal(c.intersectsRect(49, -1, 51, 1), false);
    });

    it('縮退：半径0の円は点の内包判定になる', () => {
        const e = new Ellipse(0, 0, 0, 0, 'circle');
        assert.equal(e.intersectsRect(-1, -1, 1, 1), true);
        assert.equal(e.intersectsRect(0, 0, 1, 1), true);
        assert.equal(e.intersectsRect(1, 1, 2, 2), false);
    });

    it('縮退：つぶれた円（半径y=0）は線分として判定する', () => {
        const e = new Ellipse(0, 0, 50, 0, 'circle');
        assert.equal(e.intersectsRect(-5, -1, 5, 1), true);
        assert.equal(e.intersectsRect(-5, 1, 5, 5), false);
    });

    it('縮退：つぶれた弧（半径x=0）は上へ伸びる線分だけ、同じ大きさの円は下側も交差する', () => {
        const a = new Ellipse(0, 0, 0, 50, 'arc');
        assert.equal(a.intersectsRect(-5, -40, 5, -10), true);
        assert.equal(a.intersectsRect(-5, 10, 5, 40), false);
        const c = new Ellipse(0, 0, 0, 50, 'circle');
        assert.equal(c.intersectsRect(-5, 10, 5, 40), true);
    });
});

describe('Ellipse.fromJSON のエラー文', () => {
    it('正常なデータ（circle・arcの両方）は例外を投げず、座標・色・太さ・idを復元する', () => {
        for (const type of ['circle', 'arc']) {
            const ellipse = Ellipse.fromJSON(makeValidData(type));
            assert.deepEqual(ellipse.toJSON(), makeValidData(type));
        }
    });

    it('オブジェクトでない入力は拒否する', () => {
        for (const bad of [null, [], 'circle', 42, undefined]) {
            assertFromJSONError(bad, '図形データがオブジェクトではありません');
        }
    });

    it('種別の不一致は拒否する', () => {
        for (const other of ['line', 'rect']) {
            const data = makeValidData();
            data.type = other;
            assertFromJSONError(data, `${TYPE_REASON_HEAD}（${other}）`);
        }
        const noType = makeValidData();
        delete noType.type;
        assertFromJSONError(noType, `${TYPE_REASON_HEAD}（undefined）`);
    });

    it('頂点数の不一致は拒否する', () => {
        const few = makeValidData();
        few.points = few.points.slice(0, 4);
        assertFromJSONError(few, 'pointsが5要素の配列ではありません');
        const many = makeValidData();
        many.points.push({ x: 0, y: 0 });
        assertFromJSONError(many, 'pointsが5要素の配列ではありません');
        const none = makeValidData();
        delete none.points;
        assertFromJSONError(none, 'pointsが5要素の配列ではありません');
        const notArray = makeValidData();
        notArray.points = {};
        assertFromJSONError(notArray, 'pointsが5要素の配列ではありません');
    });

    it('頂点の座標が有限の数値でなければ、何番目かを添えて拒否する', () => {
        const nan = makeValidData();
        nan.points[4] = { x: 0, y: NaN };
        assertFromJSONError(nan, 'points[4]のx・yが有限の数値ではありません');
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
        assertFromJSONError(typeAndCount, `${TYPE_REASON_HEAD}（line）`);

        const countAndColor = makeValidData();
        countAndColor.points = [];
        countAndColor.strokeColor = 123;
        assertFromJSONError(countAndColor, 'pointsが5要素の配列ではありません');

        const bothPoints = makeValidData();
        bothPoints.points[0] = { x: NaN, y: 0 };
        bothPoints.points[1] = { x: 0, y: NaN };
        assertFromJSONError(bothPoints, 'points[0]のx・yが有限の数値ではありません');

        const pointAndColor = makeValidData();
        pointAndColor.points[4] = { x: 0, y: NaN };
        pointAndColor.strokeColor = 123;
        assertFromJSONError(pointAndColor, 'points[4]のx・yが有限の数値ではありません');

        const colorAndWidth = makeValidData();
        colorAndWidth.strokeColor = 123;
        colorAndWidth.strokeWidth = 0;
        assertFromJSONError(colorAndWidth, 'strokeColorが文字列ではありません');
    });
});
