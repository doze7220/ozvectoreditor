/**
 * 責務: 矩形（Rect）の当たり判定（輪郭・内側）・塗れる形か（isFillable）・偽のctxによる描画命令・図形データとの相互変換
 * （fromJSONの受理と不正なデータのエラー文・toJSON・toDrawElement）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * 正常な矩形の図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @returns {{type: string, id: string, points: {x: number, y: number}[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 正常な図形データ
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

/**
 * 標準の矩形を作る。頂点は(0,0)・(100,0)・(100,50)・(0,50)。
 * @returns {Rect} 標準の矩形
 */
function makeRect() {
    return new Rect(0, 0, 100, 50);
}

describe('Rect.isFillable とコンストラクタ', () => {
    it('isFillable()は常にtrue', () => {
        assert.equal(new Rect(0, 0, 1, 1).isFillable(), true);
        assert.equal(new Rect(0, 0, 1, 1, null, 2, null).isFillable(), true);
    });

    it('既定のfillColorはnullで、既存の引数の位置・既定値は変わらない', () => {
        const rect = new Rect(1, 2, 3, 4);
        assert.equal(rect.fillColor, null);
        assert.equal(rect.strokeColor, '#000000');
        assert.equal(rect.strokeWidth, 2);
        const styled = new Rect(1, 2, 3, 4, '#ff0000', 5, '#00ff00');
        assert.equal(styled.strokeColor, '#ff0000');
        assert.equal(styled.strokeWidth, 5);
        assert.equal(styled.fillColor, '#00ff00');
    });
});

describe('Rect.draw の描画命令', () => {
    const expectedPath = [
        ['beginPath'], ['moveTo', 1, 2], ['lineTo', 3, 2], ['lineTo', 3, 4], ['lineTo', 1, 4], ['closePath'],
    ];

    it('塗りあり線ありはパス → fillStyle → fill() → strokeStyle → lineWidth → stroke()', () => {
        const { ctx, log } = makeRecordingCtx();
        new Rect(1, 2, 3, 4, '#ff0000', 5, '#00ff00').draw(ctx);
        assert.deepEqual(log, [
            ...expectedPath,
            ['set:fillStyle', '#00ff00'], ['fill'],
            ['set:strokeStyle', '#ff0000'], ['set:lineWidth', 5], ['stroke'],
        ]);
    });

    it('塗りあり線なしはパス → fillStyle → fill()のみ', () => {
        const { ctx, log } = makeRecordingCtx();
        new Rect(1, 2, 3, 4, null, 5, '#00ff00').draw(ctx);
        assert.deepEqual(log, [
            ...expectedPath,
            ['set:fillStyle', '#00ff00'], ['fill'],
        ]);
    });

    it('塗りなし線ありは従来と同じ命令列', () => {
        const { ctx, log } = makeRecordingCtx();
        new Rect(1, 2, 3, 4, '#ff0000', 5).draw(ctx);
        assert.deepEqual(log, [
            ...expectedPath,
            ['set:strokeStyle', '#ff0000'], ['set:lineWidth', 5], ['stroke'],
        ]);
    });

    it('塗りも線もなしは何も呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Rect(1, 2, 3, 4, null, 5, null).draw(ctx);
        assert.deepEqual(log, []);
    });
});

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

describe('Rect.hitTestFill', () => {
    /**
     * 塗られた標準の矩形（頂点(0,0)・(100,0)・(100,50)・(0,50)）を作る。
     * @returns {Rect} 塗り色`#ff0000`の矩形
     */
    function makeFilledRect() {
        return new Rect(0, 0, 100, 50, '#000000', 2, '#ff0000');
    }

    it('塗られた矩形の内側で真・外側で偽', () => {
        const r = makeFilledRect();
        assert.equal(r.hitTestFill(50, 25), true);
        assert.equal(r.hitTestFill(1, 1), true);
        assert.equal(r.hitTestFill(-1, 25), false);
        assert.equal(r.hitTestFill(101, 25), false);
        assert.equal(r.hitTestFill(50, 51), false);
        assert.equal(r.hitTestFill(50, -1), false);
    });

    it('辺の上と頂点の上は偽（輪郭の当たりが受け持つ）', () => {
        const r = makeFilledRect();
        assert.equal(r.hitTestFill(50, 0), false);
        assert.equal(r.hitTestFill(100, 25), false);
        assert.equal(r.hitTestFill(50, 50), false);
        assert.equal(r.hitTestFill(0, 25), false);
        assert.equal(r.hitTestFill(0, 0), false);
        assert.equal(r.hitTestFill(100, 50), false);
        assert.equal(r.hitTest(50, 0, 5), true);
    });

    it('fillColorがnullなら内側でも偽', () => {
        assert.equal(makeRect().hitTestFill(50, 25), false);
    });

    it('strokeColorがnullでも塗られていれば真', () => {
        const r = new Rect(0, 0, 100, 50, null, 2, '#00ff00');
        assert.equal(r.hitTestFill(50, 25), true);
    });

    it('許容誤差を受け取らず、外側は輪郭の近くでも偽', () => {
        const r = makeFilledRect();
        assert.equal(r.hitTestFill(103, 25), false);
        assert.equal(r.hitTest(103, 25, 5), true);
    });

    it('頂点を動かした矩形：菱形は軸平行でなくても形の内側で判定する', () => {
        const r = makeFilledRect();
        r.setVertex(0, 50, 0);
        r.setVertex(1, 100, 25);
        r.setVertex(2, 50, 50);
        r.setVertex(3, 0, 25);
        assert.equal(r.hitTestFill(50, 25), true);
        assert.equal(r.hitTestFill(5, 2), false);
        assert.equal(r.hitTestFill(95, 48), false);
    });

    it('頂点を動かした矩形：凹の形のくぼみは偽', () => {
        const r = new Rect(0, 0, 100, 100, '#000000', 2, '#ff0000');
        r.setVertex(2, 20, 20);
        assert.equal(r.hitTestFill(50, 10), true);
        assert.equal(r.hitTestFill(10, 50), true);
        assert.equal(r.hitTestFill(60, 60), false);
    });

    it('頂点を動かした矩形：自己交差（蝶ネクタイ形）の2つの三角形の内側は真で左右のすき間は偽', () => {
        const r = new Rect(0, 0, 100, 100, '#000000', 2, '#ff0000');
        r.setVertex(2, 0, 100);
        r.setVertex(3, 100, 100);
        assert.deepEqual(r.points, [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: 100, y: 100 }]);
        assert.equal(r.hitTestFill(50, 20), true);
        assert.equal(r.hitTestFill(50, 80), true);
        assert.equal(r.hitTestFill(10, 50), false);
        assert.equal(r.hitTestFill(90, 50), false);
    });

    it('translate後は移動先で真・元の位置で偽', () => {
        const r = makeFilledRect();
        r.translate(200, 100);
        assert.equal(r.hitTestFill(250, 125), true);
        assert.equal(r.hitTestFill(50, 25), false);
    });

    it('toJSON→fromJSONの往復後も同じ結果', () => {
        const r = makeFilledRect();
        r.setVertex(2, 80, 40);
        const restored = Rect.fromJSON(r.toJSON());
        for (const [x, y] of [[50, 25], [90, 45], [-5, 25], [50, 0], [10, 40]]) {
            assert.equal(restored.hitTestFill(x, y), r.hitTestFill(x, y));
        }
        assert.equal(restored.hitTestFill(50, 25), true);
    });

    it('塗られている条件がtoDrawElement()の塗る条件と一致する', () => {
        for (const fillColor of ['#ff0000', null]) {
            const r = new Rect(0, 0, 100, 50, '#000000', 2, fillColor);
            const el = r.toDrawElement();
            const exporterFills = typeof el.fillColor === 'string' && el.kind === 'polyline' && el.closed === true;
            assert.equal(r.hitTestFill(50, 25), exporterFills);
        }
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
        assert.equal(Rect.fromJSON(data).toJSON().strokeColor, null);
    });

    it('strokeWidthのキーが無い図形データを受理し、2pxとして読む', () => {
        const data = makeValidData();
        delete data.strokeWidth;
        assert.equal(Rect.fromJSON(data).toJSON().strokeWidth, 2);
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
        assertFromJSONError(colorAndWidth, 'strokeColorが文字列またはnullではありません');
    });
});

describe('Rect.fromJSON の fillColor', () => {
    it('文字列・nullを受理し、キーなしはnullとして読む', () => {
        const str = makeValidData();
        str.fillColor = '#ff0000';
        assert.equal(Rect.fromJSON(str).toJSON().fillColor, '#ff0000');
        const nul = makeValidData();
        nul.fillColor = null;
        assert.equal(Rect.fromJSON(nul).toJSON().fillColor, null);
        const none = makeValidData();
        delete none.fillColor;
        assert.equal(Rect.fromJSON(none).toJSON().fillColor, null);
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
        const rect = Rect.fromJSON(data);
        assert.equal(rect.strokeWidth, 2);
        assert.equal(rect.toJSON().strokeWidth, 2);
    });
});

describe('Rect.toJSON / toDrawElement の fillColor', () => {
    it('toJSONのキー順', () => {
        assert.deepEqual(Object.keys(new Rect(0, 0, 1, 1).toJSON()),
            ['type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor']);
    });

    it('fillColorを持つ矩形の往復でfillColorが保持される', () => {
        const rect = new Rect(1, 2, 3, 4, '#ff0000', 5, '#00ff00');
        rect.id = 'R1';
        const restored = Rect.fromJSON(rect.toJSON());
        assert.deepEqual(restored.toJSON(), rect.toJSON());
        assert.equal(restored.fillColor, '#00ff00');
    });

    it('toDrawElementのキー順（polyline）', () => {
        assert.deepEqual(Object.keys(new Rect(0, 0, 1, 1).toDrawElement()),
            ['kind', 'id', 'points', 'closed', 'strokeColor', 'strokeWidth', 'fillColor']);
    });

    it('toDrawElementのfillColorは図形の値（nullも）、strokeColor: nullはそのまま', () => {
        assert.equal(new Rect(0, 0, 1, 1).toDrawElement().fillColor, null);
        const filled = new Rect(0, 0, 1, 1, '#ff0000', 2, '#00ff00').toDrawElement();
        assert.equal(filled.fillColor, '#00ff00');
        const noStroke = new Rect(0, 0, 1, 1, null, 2, '#00ff00').toDrawElement();
        assert.equal(noStroke.strokeColor, null);
        assert.equal(noStroke.fillColor, '#00ff00');
    });
});
