/**
 * 責務: 直線（Line）の当たり判定・塗れる形か（isFillable）・偽のctxによる描画命令・図形データとの相互変換
 * （fromJSONの受理と不正なデータのエラー文・toJSON・toDrawElement）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Line } from '../../js/shapes/Line.js';

/**
 * 正常な直線の図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @returns {{type: string, id: string, points: {x: number, y: number}[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 正常な図形データ
 */
function makeValidData() {
    const data = new Line(0, 0, 100, 0).toJSON();
    data.id = 'shape-1';
    return data;
}

/**
 * Line.fromJSONが指定の図形データでErrorを投げ、メッセージが「Line.fromJSON: 理由」の全文と一致することを確かめる。
 * @param {*} data - fromJSONへ渡す図形データ
 * @param {string} reason - 「Line.fromJSON: 」の後ろに続く理由
 * @returns {void}
 */
function assertFromJSONError(data, reason) {
    assert.throws(() => Line.fromJSON(data), { name: 'Error', message: 'Line.fromJSON: ' + reason });
}

/**
 * 呼び出し・代入を順に記録する偽のctxを作る（beginPath・moveTo・lineTo・closePath・fill・stroke の呼び出しと
 * strokeStyle・lineWidth・fillStyle の代入）。
 * @returns {{ctx: Object, log: Array}} 偽のctxと、記録の配列（呼び出しは`['name', ...args]`、代入は`['set:name', value]`）
 */
function makeRecordingCtx() {
    const log = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke']) {
        ctx[name] = (...args) => { log.push([name, ...args]); };
    }
    for (const name of ['strokeStyle', 'lineWidth', 'fillStyle']) {
        Object.defineProperty(ctx, name, {
            set(value) { log.push(['set:' + name, value]); },
            get() { return undefined; },
        });
    }
    return { ctx, log };
}

describe('Line.isFillable とコンストラクタ', () => {
    it('isFillable()は常にfalse', () => {
        assert.equal(new Line(0, 0, 1, 1).isFillable(), false);
        assert.equal(new Line(0, 0, 1, 1, '#000', 2, '#ff0000').isFillable(), false);
    });

    it('既定のfillColorはnullで、既存の引数の位置・既定値は変わらない', () => {
        const line = new Line(1, 2, 3, 4);
        assert.equal(line.fillColor, null);
        assert.equal(line.strokeColor, '#000000');
        assert.equal(line.strokeWidth, 2);
        const styled = new Line(1, 2, 3, 4, '#ff0000', 5, '#00ff00');
        assert.equal(styled.strokeColor, '#ff0000');
        assert.equal(styled.strokeWidth, 5);
        assert.equal(styled.fillColor, '#00ff00');
    });
});

describe('Line.draw の描画命令', () => {
    it('塗りなし線ありは従来と同じ命令列', () => {
        const { ctx, log } = makeRecordingCtx();
        new Line(1, 2, 3, 4, '#ff0000', 5).draw(ctx);
        assert.deepEqual(log, [
            ['beginPath'], ['moveTo', 1, 2], ['lineTo', 3, 4],
            ['set:strokeStyle', '#ff0000'], ['set:lineWidth', 5], ['stroke'],
        ]);
    });

    it('fillColorがある線ありでも塗らない（fillStyle・fillが出ない）', () => {
        const { ctx, log } = makeRecordingCtx();
        new Line(1, 2, 3, 4, '#ff0000', 5, '#00ff00').draw(ctx);
        assert.deepEqual(log, [
            ['beginPath'], ['moveTo', 1, 2], ['lineTo', 3, 4],
            ['set:strokeStyle', '#ff0000'], ['set:lineWidth', 5], ['stroke'],
        ]);
    });

    it('fillColorがある線なしは何も呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Line(1, 2, 3, 4, null, 5, '#00ff00').draw(ctx);
        assert.deepEqual(log, []);
    });

    it('塗りも線もなしは何も呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Line(1, 2, 3, 4, null, 5, null).draw(ctx);
        assert.deepEqual(log, []);
    });
});

describe('Line.hitTest', () => {
    const line = () => new Line(0, 0, 100, 0);

    it('輪郭線の上は当たる', () => {
        assert.equal(line().hitTest(50, 0, 0), true);
    });

    it('許容誤差ちょうど（距離5）は当たり、外（5.5）は当たらない', () => {
        assert.equal(line().hitTest(50, 5, 5), true);
        assert.equal(line().hitTest(50, 5.5, 5), false);
    });

    it('端点の外側の延長上は距離5まで当たり、距離6は当たらない', () => {
        assert.equal(line().hitTest(-5, 0, 5), true);
        assert.equal(line().hitTest(-6, 0, 5), false);
        assert.equal(line().hitTest(106, 0, 5), false);
    });

    it('終点付近の斜め（終点から距離5）は当たる', () => {
        assert.equal(line().hitTest(103, 4, 5), true);
    });

    it('頂点を動かした後の線分で判定する', () => {
        const l = line();
        l.setVertex(1, 0, 100);
        assert.equal(l.hitTest(0, 50, 0), true);
        assert.equal(l.hitTest(50, 0, 1), false);
    });

    it('平行移動の後の線分で判定する', () => {
        const l = line();
        l.translate(10, 20);
        assert.equal(l.hitTest(60, 20, 0), true);
        assert.equal(l.hitTest(50, 0, 1), false);
    });

    it('長さ0の線分は点との距離で判定する', () => {
        const l = new Line(10, 10, 10, 10);
        assert.equal(l.hitTest(13, 14, 5), true);
        assert.equal(l.hitTest(10, 16, 5), false);
    });
});

describe('Line.intersectsRect', () => {
    const line = () => new Line(0, 0, 100, 0);

    it('輪郭に掛かる矩形・全体を含む矩形は true', () => {
        assert.equal(line().intersectsRect(40, -10, 60, 10), true);
        assert.equal(line().intersectsRect(-10, -10, 110, 10), true);
    });

    it('線分から外れる矩形（上下）は false', () => {
        assert.equal(line().intersectsRect(40, 5, 60, 10), false);
    });

    it('線分の延長上だけに掛かる矩形は false', () => {
        assert.equal(line().intersectsRect(110, -10, 120, 10), false);
        assert.equal(line().intersectsRect(-10, -10, -0.5, 10), false);
    });

    it('境界に接する場合（辺・終点が矩形の角）は true', () => {
        assert.equal(line().intersectsRect(40, 0, 60, 10), true);
        assert.equal(line().intersectsRect(100, 0, 110, 10), true);
    });

    it('境界のわずか外は false', () => {
        assert.equal(line().intersectsRect(40, 0.5, 60, 10), false);
        assert.equal(line().intersectsRect(100.5, -10, 110, 10), false);
    });

    it('大きさ0の矩形が線上にあれば true', () => {
        assert.equal(line().intersectsRect(50, 0, 50, 0), true);
    });

    it('頂点を動かした後の線分で判定する', () => {
        const l = line();
        l.setVertex(1, 0, 100);
        assert.equal(l.intersectsRect(-5, 40, 5, 60), true);
        assert.equal(l.intersectsRect(10, 40, 20, 60), false);
    });

    it('平行移動の後の線分で判定する', () => {
        const l = line();
        l.translate(10, 20);
        assert.equal(l.intersectsRect(40, -10, 60, 10), false);
        assert.equal(l.intersectsRect(50, 15, 70, 25), true);
    });

    it('長さ0の線分は点の内包判定になる', () => {
        const l = new Line(10, 10, 10, 10);
        assert.equal(l.intersectsRect(0, 0, 20, 20), true);
        assert.equal(l.intersectsRect(10, 10, 20, 20), true);
        assert.equal(l.intersectsRect(11, 11, 20, 20), false);
    });
});

describe('Line.fromJSON のエラー文', () => {
    it('正常なデータは例外を投げず、座標・色・太さ・idを復元する', () => {
        const line = Line.fromJSON(makeValidData());
        assert.deepEqual(line.toJSON(), makeValidData());
    });

    it('オブジェクトでない入力は拒否する', () => {
        for (const bad of [null, [], 'line', 42, undefined]) {
            assertFromJSONError(bad, '図形データがオブジェクトではありません');
        }
    });

    it('種別の不一致は拒否する', () => {
        const other = makeValidData();
        other.type = 'curve';
        assertFromJSONError(other, "図形種別が'line'ではありません（curve）");
        const noType = makeValidData();
        delete noType.type;
        assertFromJSONError(noType, "図形種別が'line'ではありません（undefined）");
    });

    it('頂点数の不一致は拒否する', () => {
        const few = makeValidData();
        few.points = few.points.slice(0, 1);
        assertFromJSONError(few, 'pointsが2要素の配列ではありません');
        const many = makeValidData();
        many.points.push({ x: 0, y: 0 });
        assertFromJSONError(many, 'pointsが2要素の配列ではありません');
        const none = makeValidData();
        delete none.points;
        assertFromJSONError(none, 'pointsが2要素の配列ではありません');
        const notArray = makeValidData();
        notArray.points = {};
        assertFromJSONError(notArray, 'pointsが2要素の配列ではありません');
    });

    it('頂点の座標が有限の数値でなければ、何番目かを添えて拒否する', () => {
        const nan = makeValidData();
        nan.points[1] = { x: 0, y: NaN };
        assertFromJSONError(nan, 'points[1]のx・yが有限の数値ではありません');
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
        assert.equal(Line.fromJSON(data).toJSON().strokeColor, null);
    });

    it('strokeWidthのキーが無い図形データを受理し、2pxとして読む', () => {
        const data = makeValidData();
        delete data.strokeWidth;
        assert.equal(Line.fromJSON(data).toJSON().strokeWidth, 2);
    });

    it('検査の順序：種別 → 頂点数 → 頂点（小さい番号が先）→ strokeColor → strokeWidth', () => {
        const typeAndCount = makeValidData();
        typeAndCount.type = 'curve';
        typeAndCount.points = [];
        assertFromJSONError(typeAndCount, "図形種別が'line'ではありません（curve）");

        const countAndColor = makeValidData();
        countAndColor.points = [];
        countAndColor.strokeColor = 123;
        assertFromJSONError(countAndColor, 'pointsが2要素の配列ではありません');

        const bothPoints = makeValidData();
        bothPoints.points = [{ x: NaN, y: 0 }, { x: 0, y: NaN }];
        assertFromJSONError(bothPoints, 'points[0]のx・yが有限の数値ではありません');

        const pointAndColor = makeValidData();
        pointAndColor.points[1] = { x: 0, y: NaN };
        pointAndColor.strokeColor = 123;
        assertFromJSONError(pointAndColor, 'points[1]のx・yが有限の数値ではありません');

        const colorAndWidth = makeValidData();
        colorAndWidth.strokeColor = 123;
        colorAndWidth.strokeWidth = 0;
        assertFromJSONError(colorAndWidth, 'strokeColorが文字列またはnullではありません');
    });
});

describe('Line.fromJSON の fillColor', () => {
    it('文字列・nullを受理し、キーなしはnullとして読む', () => {
        const str = makeValidData();
        str.fillColor = '#ff0000';
        assert.equal(Line.fromJSON(str).toJSON().fillColor, '#ff0000');
        const nul = makeValidData();
        nul.fillColor = null;
        assert.equal(Line.fromJSON(nul).toJSON().fillColor, null);
        const none = makeValidData();
        delete none.fillColor;
        assert.equal(Line.fromJSON(none).toJSON().fillColor, null);
    });

    it('文字列・null以外は拒否する', () => {
        for (const bad of [1, true, {}, []]) {
            const data = makeValidData();
            data.fillColor = bad;
            assertFromJSONError(data, 'fillColorが文字列またはnullではありません');
        }
    });

    it('検査の順序：strokeWidth・strokeColorの不正がfillColorの不正より先', () => {
        const widthAndFill = makeValidData();
        widthAndFill.strokeWidth = 0;
        widthAndFill.fillColor = 1;
        assertFromJSONError(widthAndFill, 'strokeWidthが正の有限の数値ではありません');
        const colorAndFill = makeValidData();
        colorAndFill.strokeColor = 123;
        colorAndFill.fillColor = 1;
        assertFromJSONError(colorAndFill, 'strokeColorが文字列またはnullではありません');
    });

    it('strokeWidthのキーなしはfromJSONの結果で2になる', () => {
        const data = makeValidData();
        delete data.strokeWidth;
        const line = Line.fromJSON(data);
        assert.equal(line.strokeWidth, 2);
        assert.equal(line.toJSON().strokeWidth, 2);
    });
});

describe('Line.toJSON / toDrawElement の fillColor', () => {
    it('toJSONのキー順', () => {
        assert.deepEqual(Object.keys(new Line(0, 0, 1, 1).toJSON()),
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor']);
    });

    it('fillColorを持つ直線の往復でfillColorが保持される', () => {
        const line = new Line(1, 2, 3, 4, '#ff0000', 5, '#00ff00');
        line.id = 'L1';
        const restored = Line.fromJSON(line.toJSON());
        assert.deepEqual(restored.toJSON(), line.toJSON());
        assert.equal(restored.fillColor, '#00ff00');
    });

    it('toDrawElementのキー順', () => {
        assert.deepEqual(Object.keys(new Line(0, 0, 1, 1).toDrawElement()),
            ['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']);
    });

    it('toDrawElementのfillColorはfillColorを持っていてもnull、strokeColor: nullはそのまま', () => {
        const filled = new Line(0, 0, 1, 1, '#ff0000', 2, '#00ff00').toDrawElement();
        assert.equal(filled.fillColor, null);
        const noStroke = new Line(0, 0, 1, 1, null, 2, '#00ff00').toDrawElement();
        assert.equal(noStroke.strokeColor, null);
        assert.equal(noStroke.fillColor, null);
    });
});
