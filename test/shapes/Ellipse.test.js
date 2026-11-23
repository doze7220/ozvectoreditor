/**
 * 責務: 円・弧（Ellipse）の当たり判定（輪郭（縮退時の分岐を含む）・内側）・塗れる形か（isFillable）・偽のctxによる描画命令・図形データとの相互変換
 * （fromJSONの受理と不正なデータのエラー文・toJSON・toDrawElement）・ハンドルの位置（getHandlePosition）・頂点のハンドル名の一覧（getVertexHandleNames）・変形を当てた新しい図形の生成（createTransformed）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * 正常な円・弧の図形データ（idを入れたtoJSON()の戻り値）を返す。呼ぶたびに新しいオブジェクトを返す。
 * @param {string} [type='circle'] - 図形種別（'circle'|'arc'）
 * @returns {{type: string, id: string, points: {x: number, y: number}[], strokeColor: string|null, strokeWidth: number, fillColor: string|null}} 正常な図形データ
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
 * 呼び出し・代入を順に記録する偽のctxを作る（beginPath・ellipse・closePath・fill・stroke の呼び出しと
 * strokeStyle・lineWidth・fillStyle の代入）。
 * @returns {{ctx: Object, log: Array}} 偽のctxと、記録の配列（呼び出しは`['name', ...args]`、代入は`['set:name', value]`）
 */
function makeRecordingCtx() {
    const log = [];
    const ctx = {};
    for (const name of ['beginPath', 'ellipse', 'closePath', 'fill', 'stroke']) {
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

/** `fromJSON`が種別不正のときに返すエラー理由の先頭部分（期待値）。 */
const TYPE_REASON_HEAD = "図形種別が'circle'・'arc'のいずれでもありません";

describe('Ellipse.isFillable とコンストラクタ', () => {
    it('円はtrue・弧はfalse', () => {
        assert.equal(new Ellipse(0, 0, 5, 5, 'circle').isFillable(), true);
        assert.equal(new Ellipse(0, 0, 5, 5, 'arc').isFillable(), false);
        assert.equal(new Ellipse(0, 0, 5, 5, 'arc', '#000000', 2, '#ff0000').isFillable(), false);
    });

    it('既定のfillColorはnullで、既存の引数の位置・既定値は変わらない', () => {
        const e = new Ellipse(1, 2, 3, 4);
        assert.equal(e.type, 'circle');
        assert.equal(e.fillColor, null);
        assert.equal(e.strokeColor, '#000000');
        assert.equal(e.strokeWidth, 2);
        const styled = new Ellipse(1, 2, 3, 4, 'arc', '#ff0000', 5, '#00ff00');
        assert.equal(styled.type, 'arc');
        assert.equal(styled.strokeColor, '#ff0000');
        assert.equal(styled.strokeWidth, 5);
        assert.equal(styled.fillColor, '#00ff00');
    });
});

describe('Ellipse.draw の描画命令', () => {
    const circlePath = [['beginPath'], ['ellipse', 0, 0, 50, 50, 0, 0, Math.PI * 2], ['closePath']];
    const arcPath = [['beginPath'], ['ellipse', 0, 0, 50, 50, 0, Math.PI, Math.PI * 2]];

    it('円：塗りあり線ありはパス → fillStyle → fill() → strokeStyle → lineWidth → stroke()', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'circle', '#111111', 3, '#222222').draw(ctx);
        assert.deepEqual(log, [
            ...circlePath, ['set:fillStyle', '#222222'], ['fill'],
            ['set:strokeStyle', '#111111'], ['set:lineWidth', 3], ['stroke'],
        ]);
    });

    it('円：塗りあり線なしはパス → fillStyle → fill() のみ', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'circle', null, 3, '#222222').draw(ctx);
        assert.deepEqual(log, [...circlePath, ['set:fillStyle', '#222222'], ['fill']]);
    });

    it('円：塗りなし線ありは従来と同じ命令列', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'circle', '#111111', 3).draw(ctx);
        assert.deepEqual(log, [
            ...circlePath, ['set:strokeStyle', '#111111'], ['set:lineWidth', 3], ['stroke'],
        ]);
    });

    it('円：塗りも線もなしは何も呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'circle', null, 3, null).draw(ctx);
        assert.deepEqual(log, []);
    });

    it('弧：塗りなし線ありは従来と同じ命令列（closePathなし）', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'arc', '#111111', 3).draw(ctx);
        assert.deepEqual(log, [
            ...arcPath, ['set:strokeStyle', '#111111'], ['set:lineWidth', 3], ['stroke'],
        ]);
    });

    it('弧：fillColorがあっても線ありなら塗らずに線だけ描く', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'arc', '#111111', 3, '#222222').draw(ctx);
        assert.deepEqual(log, [
            ...arcPath, ['set:strokeStyle', '#111111'], ['set:lineWidth', 3], ['stroke'],
        ]);
    });

    it('弧：fillColorがあっても線なしなら何も呼ばない', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'arc', null, 3, '#222222').draw(ctx);
        assert.deepEqual(log, []);
    });
});

describe('Ellipse.drawOutline の描画命令', () => {
    const circleOutline = [
        ['beginPath'], ['ellipse', 0, 0, 50, 50, 0, 0, Math.PI * 2], ['closePath'],
        ['set:strokeStyle', '#123456'], ['set:lineWidth', 1], ['stroke'],
    ];
    const arcOutline = [
        ['beginPath'], ['ellipse', 0, 0, 50, 50, 0, Math.PI, Math.PI * 2],
        ['set:strokeStyle', '#123456'], ['set:lineWidth', 1], ['stroke'],
    ];

    it('円：パスはdrawと同じ形（closePathあり）で、色・画面上1pxの線・strokeを1回だけ呼ぶ', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'circle', '#111111', 3, '#222222').drawOutline(ctx, 1, '#123456');
        assert.deepEqual(log, circleOutline);
    });

    it('弧：パスはdrawと同じ形（closePathなし）で、色・画面上1pxの線・strokeを1回だけ呼ぶ', () => {
        const { ctx, log } = makeRecordingCtx();
        new Ellipse(0, 0, 50, 50, 'arc', '#111111', 3, '#222222').drawOutline(ctx, 1, '#123456');
        assert.deepEqual(log, arcOutline);
    });

    it('lineWidthは1 / viewScale（viewScale=2で0.5）、省略時は1', () => {
        const scaled = makeRecordingCtx();
        makeCircle().drawOutline(scaled.ctx, 2, '#000000');
        assert.deepEqual(scaled.log.find(([name]) => name === 'set:lineWidth'), ['set:lineWidth', 0.5]);
        const omitted = makeRecordingCtx();
        makeArc().drawOutline(omitted.ctx, undefined, '#000000');
        assert.deepEqual(omitted.log.find(([name]) => name === 'set:lineWidth'), ['set:lineWidth', 1]);
    });

    it('fill・fillStyleを呼ばない（円・弧とも）', () => {
        for (const ellipse of [
            new Ellipse(0, 0, 50, 50, 'circle', '#111111', 3, '#222222'),
            new Ellipse(0, 0, 50, 50, 'arc', '#111111', 3, '#222222'),
        ]) {
            const { ctx, log } = makeRecordingCtx();
            ellipse.drawOutline(ctx, 1, '#000000');
            const names = log.map(([name]) => name);
            assert.equal(names.includes('fill'), false);
            assert.equal(names.includes('set:fillStyle'), false);
            assert.equal(names.filter((name) => name === 'stroke').length, 1);
        }
    });

    it('線なし・塗りなし・何も描かれない図形でも同じ命令列を出し、図形のスタイルを使わない', () => {
        for (const type of ['circle', 'arc']) {
            const expected = [
                ['beginPath'], ['ellipse', 0, 0, 50, 50, 0, type === 'circle' ? 0 : Math.PI, Math.PI * 2],
                ...(type === 'circle' ? [['closePath']] : []),
                ['set:strokeStyle', '#ffffff'], ['set:lineWidth', 0.5], ['stroke'],
            ];
            for (const ellipse of [
                new Ellipse(0, 0, 50, 50, type, null, 5, '#00ff00'),
                new Ellipse(0, 0, 50, 50, type, '#ff0000', 9, null),
                new Ellipse(0, 0, 50, 50, type, null, 5, null),
            ]) {
                const { ctx, log } = makeRecordingCtx();
                ellipse.drawOutline(ctx, 2, '#ffffff');
                assert.deepEqual(log, expected);
            }
        }
    });
});

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

describe('Ellipse.hitTestFill', () => {
    it('塗られた円：中心と内側（比率0.9）は真・外側（比率1.1）は偽', () => {
        const c = new Ellipse(0, 0, 50, 50, 'circle', '#000000', 2, '#ff0000');
        assert.equal(c.hitTestFill(0, 0), true);
        assert.equal(c.hitTestFill(45, 0), true);
        assert.equal(c.hitTestFill(0, -45), true);
        assert.equal(c.hitTestFill(55, 0), false);
        assert.equal(c.hitTestFill(0, 55), false);
    });

    it('塗られた楕円（rx ≠ ry）：軸ごとの半径で判定する', () => {
        const e = new Ellipse(0, 0, 100, 50, 'circle', '#000000', 2, '#ff0000');
        assert.equal(e.hitTestFill(0, 0), true);
        assert.equal(e.hitTestFill(90, 0), true);
        assert.equal(e.hitTestFill(0, -45), true);
        assert.equal(e.hitTestFill(110, 0), false);
        assert.equal(e.hitTestFill(0, -55), false);
        assert.equal(e.hitTestFill(0, 45), true);
    });

    it('軸上の境界ちょうどは偽（輪郭の当たりが受け持つ）', () => {
        const c = new Ellipse(0, 0, 50, 50, 'circle', '#000000', 2, '#ff0000');
        assert.equal(c.hitTestFill(50, 0), false);
        assert.equal(c.hitTestFill(-50, 0), false);
        assert.equal(c.hitTestFill(0, -50), false);
        assert.equal(c.hitTestFill(0, 50), false);
        assert.equal(c.hitTest(50, 0, 5), true);
    });

    it('fillColor が null なら内側でも偽', () => {
        assert.equal(new Ellipse(0, 0, 50, 50, 'circle', '#000000', 2, null).hitTestFill(0, 0), false);
    });

    it('strokeColor が null でも塗られていれば真', () => {
        assert.equal(new Ellipse(0, 0, 50, 50, 'circle', null, 2, '#ff0000').hitTestFill(0, 0), true);
    });

    it('弧は fillColor が色の文字列でも中心・弧の内側で偽', () => {
        const a = new Ellipse(0, 0, 50, 50, 'arc', '#000000', 2, '#ff0000');
        assert.equal(a.hitTestFill(0, 0), false);
        assert.equal(a.hitTestFill(0, -25), false);
        assert.equal(a.hitTestFill(0, 25), false);
    });

    it('許容誤差を使わない（輪郭の外側の許容幅内の点は偽）', () => {
        const c = new Ellipse(0, 0, 50, 50, 'circle', '#000000', 2, '#ff0000');
        assert.equal(c.hitTest(52, 0, 5), true);
        assert.equal(c.hitTestFill(52, 0), false);
    });

    it('つぶれた円（rx = 0・ry = 0・両方0）は中心を含めどこでも偽で例外を投げない', () => {
        for (const [x2, y2] of [[0, 50], [50, 0], [0, 0]]) {
            const e = new Ellipse(0, 0, x2, y2, 'circle', '#000000', 2, '#ff0000');
            assert.doesNotThrow(() => e.hitTestFill(0, 0));
            assert.equal(e.hitTestFill(0, 0), false);
            assert.equal(e.hitTestFill(10, 10), false);
            assert.equal(e.hitTestFill(0, 25), false);
            assert.equal(e.hitTestFill(25, 0), false);
        }
    });

    it('rx = 0.5・ry = 50 は半径が正なので厳密に判定する（中心は真・離れた点は偽）', () => {
        const e = new Ellipse(0, 0, 0.5, 50, 'circle', '#000000', 2, '#ff0000');
        assert.equal(e.hitTestFill(0, 0), true);
        assert.equal(e.hitTestFill(0, 25), true);
        assert.equal(e.hitTestFill(2, 0), false);
        assert.equal(e.hitTestFill(1000, 1000), false);
    });

    it('平行移動の後：移動先で真・元の位置で偽', () => {
        const c = new Ellipse(0, 0, 50, 50, 'circle', '#000000', 2, '#ff0000');
        c.translate(200, 100);
        assert.equal(c.hitTestFill(200, 100), true);
        assert.equal(c.hitTestFill(0, 0), false);
    });

    it('toJSON → fromJSON の往復後も同じ結果', () => {
        const c = new Ellipse(0, 0, 100, 50, 'circle', '#000000', 2, '#ff0000');
        c.id = 'shape-1';
        const restored = Ellipse.fromJSON(c.toJSON());
        for (const [x, y] of [[0, 0], [90, 0], [110, 0], [0, -45], [0, -55], [100, 0]]) {
            assert.equal(restored.hitTestFill(x, y), c.hitTestFill(x, y));
        }
        assert.equal(restored.hitTestFill(0, 0), true);
    });

    it('塗られている条件が toDrawElement の塗る条件と一致する（円／弧 × fillColor の有無）', () => {
        for (const type of ['circle', 'arc']) {
            for (const fill of ['#ff0000', null]) {
                const e = new Ellipse(0, 0, 50, 50, type, '#000000', 2, fill);
                const el = e.toDrawElement();
                const drawFills = el.kind === 'ellipse' && el.closed === true && typeof el.fillColor === 'string';
                assert.equal(e.hitTestFill(0, -10) || e.hitTestFill(0, 10), drawFills);
                assert.equal(e.hitTestFill(0, 0), drawFills);
            }
        }
    });

    it('内側と輪郭の当たりの間に隙間が無い（rx = 100・ry = 50 の円、中心から外へ向かう線上）', () => {
        const e = new Ellipse(0, 0, 100, 50, 'circle', '#000000', 2, '#ff0000');
        const tolerance = 5;
        const rAvg = (100 + 50) / 2;
        const limitRatio = 1 + (tolerance + e.strokeWidth / 2) / rAvg;
        for (let angleStep = 0; angleStep < 72; angleStep++) {
            const theta = (Math.PI * 2 * angleStep) / 72;
            for (let step = 0; step <= 1000; step++) {
                const ratio = (limitRatio * 0.99 * step) / 1000;
                const x = ratio * 100 * Math.cos(theta);
                const y = ratio * 50 * Math.sin(theta);
                assert.equal(e.hitTestFill(x, y) || e.hitTest(x, y, tolerance), true);
            }
        }
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
        assert.equal(Ellipse.fromJSON(data).toJSON().strokeColor, null);
    });

    it('strokeWidthのキーが無い図形データを受理し、2pxとして読む', () => {
        const data = makeValidData();
        delete data.strokeWidth;
        assert.equal(Ellipse.fromJSON(data).toJSON().strokeWidth, 2);
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
        assertFromJSONError(colorAndWidth, 'strokeColorが文字列またはnullではありません');
    });

    it('検査の順序：strokeWidth・strokeColorの不正がfillColorの不正より先', () => {
        const widthAndFill = makeValidData();
        widthAndFill.strokeWidth = 0;
        widthAndFill.fillColor = 123;
        assertFromJSONError(widthAndFill, 'strokeWidthが正の有限の数値ではありません');

        const colorAndFill = makeValidData();
        colorAndFill.strokeColor = 123;
        colorAndFill.fillColor = 123;
        assertFromJSONError(colorAndFill, 'strokeColorが文字列またはnullではありません');
    });

    it('fillColorは文字列・null・キーなし（nullとして読む）を受理する（circle・arc）', () => {
        for (const type of ['circle', 'arc']) {
            const str = makeValidData(type);
            str.fillColor = '#abcdef';
            assert.equal(Ellipse.fromJSON(str).toJSON().fillColor, '#abcdef');
            const isNull = makeValidData(type);
            isNull.fillColor = null;
            assert.equal(Ellipse.fromJSON(isNull).toJSON().fillColor, null);
            const none = makeValidData(type);
            delete none.fillColor;
            assert.equal(Ellipse.fromJSON(none).toJSON().fillColor, null);
        }
    });

    it('fillColorが文字列でもnullでもなければ拒否する（circle・arc）', () => {
        for (const type of ['circle', 'arc']) {
            for (const bad of [1, true, {}, []]) {
                const data = makeValidData(type);
                data.fillColor = bad;
                assertFromJSONError(data, 'fillColorが文字列またはnullではありません');
            }
        }
    });

    it('strokeWidthのキーなしはfromJSONの戻り値を通して2pxになる（弧も）', () => {
        const data = makeValidData('arc');
        delete data.strokeWidth;
        const ellipse = Ellipse.fromJSON(data);
        assert.equal(ellipse.strokeWidth, 2);
    });
});

describe('Ellipse.toJSON と toDrawElement', () => {
    it('toJSONのキー順', () => {
        assert.deepEqual(Object.keys(makeCircle().toJSON()), [
            'type', 'id', 'points', 'strokeColor', 'strokeWidth', 'fillColor',
        ]);
    });

    it('fillColorを持つ円・弧の往復でfillColorが保持される（弧は塗れなくても保持）', () => {
        for (const type of ['circle', 'arc']) {
            const data = makeValidData(type);
            data.fillColor = '#123456';
            const restored = Ellipse.fromJSON(data);
            assert.equal(restored.fillColor, '#123456');
            assert.deepEqual(restored.toJSON(), data);
        }
    });

    it('toDrawElementのキー順（ellipseの13キー）', () => {
        assert.deepEqual(Object.keys(makeCircle().toDrawElement()), [
            'kind', 'id', 'x', 'y', 'radiusX', 'radiusY', 'rotation', 'startAngle', 'endAngle',
            'closed', 'strokeColor', 'strokeWidth', 'fillColor',
        ]);
    });

    it('toDrawElementのfillColor：円は図形の値、弧はfillColorを持っていてもnull', () => {
        assert.equal(new Ellipse(0, 0, 5, 5, 'circle', '#000000', 2, '#ff0000').toDrawElement().fillColor, '#ff0000');
        assert.equal(new Ellipse(0, 0, 5, 5, 'circle').toDrawElement().fillColor, null);
        assert.equal(new Ellipse(0, 0, 5, 5, 'arc', '#000000', 2, '#ff0000').toDrawElement().fillColor, null);
    });

    it('toDrawElementのstrokeColor: nullはそのままnull', () => {
        assert.equal(new Ellipse(0, 0, 5, 5, 'circle', null).toDrawElement().strokeColor, null);
    });
});

describe('Ellipse.getHandlePosition', () => {
    it('円・弧それぞれで5つの名前（move・right・up・left・down）の位置はすべてnull（位置なし）', () => {
        for (const type of ['circle', 'arc']) {
            const ellipse = new Ellipse(10, 20, 40, 60, type);
            for (const name of ['move', 'right', 'up', 'left', 'down']) {
                assert.equal(ellipse.getHandlePosition(name), null);
            }
        }
    });

    it('ハンドル名でない値はnull（null・undefined・未知の文字列・文字列以外）', () => {
        const ellipse = new Ellipse(0, 0, 50, 50);
        for (const value of [null, undefined, 'unknown', '', 0, 1, {}, [], true, Symbol('x')]) {
            assert.equal(ellipse.getHandlePosition(value), null);
        }
    });

    it('Object.prototypeのキー名でも例外にならずnull', () => {
        const ellipse = new Ellipse(0, 0, 50, 50);
        for (const name of ['constructor', 'toString', '__proto__', 'hasOwnProperty', 'valueOf']) {
            assert.doesNotThrow(() => ellipse.getHandlePosition(name));
            assert.equal(ellipse.getHandlePosition(name), null);
        }
    });

});

describe('Ellipse.hitTestHandle・getVertexIndexForHandle（頂点のハンドルを持たない）', () => {
    it('hitTestHandleは5か所（円・弧・回した円）でnull', () => {
        const rotate = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
        const shapes = [
            new Ellipse(10, 20, 40, 60, 'circle'),
            new Ellipse(10, 20, 40, 60, 'arc'),
            new Ellipse(10, 20, 40, 60, 'circle').createTransformed(rotate),
        ];
        for (const ellipse of shapes) {
            const p = ellipse.points;
            const xc = p[0].x;
            const yc = p[0].y;
            const rx = Math.abs(p[1].x - xc);
            const ry = Math.abs(p[2].y - yc);
            const spots = [[xc, yc], [xc + rx, yc], [xc, yc - ry], [xc - rx, yc], [xc, yc + ry]];
            for (const [x, y] of spots) {
                assert.equal(ellipse.hitTestHandle(x, y, 1000), null);
            }
        }
    });

    it('getVertexIndexForHandleは5つの名前でnull', () => {
        for (const type of ['circle', 'arc']) {
            const ellipse = new Ellipse(10, 20, 40, 60, type);
            for (const name of ['move', 'right', 'up', 'left', 'down']) {
                assert.equal(ellipse.getVertexIndexForHandle(name), null);
            }
        }
    });
});

describe('Ellipse.getVertexHandleNames', () => {
    it('円・弧のどちらでも空の配列を返す', () => {
        assert.deepEqual(new Ellipse(0, 0, 50, 50, 'circle').getVertexHandleNames(), []);
        assert.deepEqual(new Ellipse(0, 0, 50, 50, 'arc').getVertexHandleNames(), []);
    });

    it('毎回新しい配列を返し、書き換えても図形は変わらない', () => {
        const e = new Ellipse(0, 0, 50, 50, 'circle');
        const before = JSON.stringify(e.toJSON());
        const names = e.getVertexHandleNames();
        names.push('extra');
        assert.notEqual(e.getVertexHandleNames(), names);
        assert.deepEqual(e.getVertexHandleNames(), []);
        assert.equal(JSON.stringify(e.toJSON()), before);
    });
});

describe('Ellipse.createTransformed', () => {
    const TWO_PI = Math.PI * 2;
    it('円に縦横別の倍率を当てると楕円になる（スタイル・id・typeは同じ）', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle', '#112233', 5, '#445566');
        shape.id = 's1';
        const out = shape.createTransformed({ a: 2, b: 0, c: 0, d: 0.5, e: 0, f: 0 });
        assert.deepEqual(out.toJSON(), {
            type: 'circle', id: 's1',
            points: [{ x: 200, y: 50 }, { x: 260, y: 50 }, { x: 200, y: 30 }, { x: 260, y: 50 }, { x: 260, y: 50 }],
            strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566',
        });
        assert.equal(out.type, 'circle');
        assert.equal(out.id, 's1');
    });
    it('変形後のtoDrawElement()の座標・半径・角度・線の太さ・色・塗りが期待どおり（円）', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle', '#112233', 5, '#445566');
        shape.id = 's1';
        const out = shape.createTransformed({ a: 2, b: 0, c: 0, d: 0.5, e: 0, f: 0 });
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 's1', x: 200, y: 50, radiusX: 60, radiusY: 20, rotation: 0, startAngle: 0, endAngle: TWO_PI,
            closed: true, strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566',
        });
    });
    it('円は上下・左右に裏返しても5つの点を写すだけ（半径は絶対値）', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle', '#112233', 5, '#445566');
        const out = shape.createTransformed({ a: -1, b: 0, c: 0, d: -2, e: 0, f: 0 });
        assert.deepEqual(out.toJSON().points, [{ x: -100, y: -200 }, { x: -130, y: -200 }, { x: -100, y: -120 }, { x: -130, y: -200 }, { x: -130, y: -200 }]);
    });
    it('弧の上下の裏返し（d < 0）は5つの点を写すだけで、下半分の弧になる', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, '#445566');
        shape.id = 'a1';
        const out = shape.createTransformed({ a: 1, b: 0, c: 0, d: -2, e: 0, f: 0 });
        assert.deepEqual(out.toJSON().points, [{ x: 100, y: -200 }, { x: 130, y: -200 }, { x: 100, y: -120 }, { x: 70, y: -200 }, { x: 130, y: -200 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 'a1', x: 100, y: -200, radiusX: 30, radiusY: 80, rotation: 0, startAngle: 0, endAngle: Math.PI,
            closed: false, strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
        assert.equal(out.fillColor, '#445566');
    });
    it('弧の左右の裏返し（a < 0）は5つの点を写すだけ（描画要素の形は上下に裏返っていない弧のまま）', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        const out = shape.createTransformed({ a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 });
        assert.deepEqual(out.toJSON().points, [{ x: -100, y: 100 }, { x: -130, y: 100 }, { x: -100, y: 60 }, { x: -70, y: 100 }, { x: -130, y: 100 }]);
    });
    it('弧の上下に裏返さない拡大縮小は5つの点を写すだけ', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        const out = shape.createTransformed({ a: 2, b: 0, c: 0, d: 0.5, e: 0, f: 0 });
        assert.deepEqual(out.toJSON().points, [{ x: 200, y: 50 }, { x: 260, y: 50 }, { x: 200, y: 30 }, { x: 140, y: 50 }, { x: 260, y: 50 }]);
    });
    it('真円（rx=ry）に縦横別の倍率と原点以外の動かない点（外枠の左下(70,130)）を当てると楕円になる', () => {
        const shape = new Ellipse(100, 100, 130, 130, 'circle', '#112233', 5, '#445566');
        shape.id = 'c1';
        const out = shape.createTransformed({ a: 2, b: 0, c: 0, d: 0.5, e: -70, f: 65 });
        assert.deepEqual(out.toJSON().points, [{ x: 130, y: 115 }, { x: 190, y: 115 }, { x: 130, y: 100 }, { x: 190, y: 115 }, { x: 190, y: 115 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 'c1', x: 130, y: 115, radiusX: 60, radiusY: 15, rotation: 0, startAngle: 0, endAngle: TWO_PI,
            closed: true, strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566',
        });
    });
    it('弧を外枠の下端（y=100）を基準に上下を裏返す（d < 0と平行移動）と、点を写した位置（中心(100,100)）の下半分の弧になる', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        shape.id = 'a1';
        const out = shape.createTransformed({ a: 1, b: 0, c: 0, d: -1, e: 0, f: 200 });
        assert.deepEqual(out.toJSON().points, [{ x: 100, y: 100 }, { x: 130, y: 100 }, { x: 100, y: 140 }, { x: 70, y: 100 }, { x: 130, y: 100 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 'a1', x: 100, y: 100, radiusX: 30, radiusY: 40, rotation: 0, startAngle: 0, endAngle: Math.PI,
            closed: false, strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
    });
    it('弧を外枠の下端を基準に縦横別の倍率と上下の裏返しを同時に当てる（a=2・d=-0.5・動かない点(100,100)）と下半分の弧', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        shape.id = 'a1';
        const out = shape.createTransformed({ a: 2, b: 0, c: 0, d: -0.5, e: -100, f: 150 });
        assert.deepEqual(out.toJSON().points, [{ x: 100, y: 100 }, { x: 160, y: 100 }, { x: 100, y: 120 }, { x: 40, y: 100 }, { x: 160, y: 100 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 'a1', x: 100, y: 100, radiusX: 60, radiusY: 20, rotation: 0, startAngle: 0, endAngle: Math.PI,
            closed: false, strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
    });
    it('弧の上下と左右を同時に裏返す（a < 0かつd < 0。平行移動つき）', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        shape.id = 'a1';
        const out = shape.createTransformed({ a: -1, b: 0, c: 0, d: -1, e: 300, f: 200 });
        assert.deepEqual(out.toJSON().points, [{ x: 200, y: 100 }, { x: 170, y: 100 }, { x: 200, y: 140 }, { x: 230, y: 100 }, { x: 170, y: 100 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 'a1', x: 200, y: 100, radiusX: 30, radiusY: 40, rotation: 0, startAngle: 0, endAngle: Math.PI,
            closed: false, strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
    });
    it('弧に縦横別の倍率と原点以外の動かない点（外枠の左下(70,100)。d > 0）を当てる', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        shape.id = 'a1';
        const out = shape.createTransformed({ a: 0.5, b: 0, c: 0, d: 2, e: 35, f: -100 });
        assert.deepEqual(out.toJSON().points, [{ x: 85, y: 100 }, { x: 100, y: 100 }, { x: 85, y: 20 }, { x: 70, y: 100 }, { x: 100, y: 100 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 'a1', x: 85, y: 100, radiusX: 15, radiusY: 80, rotation: 0, startAngle: Math.PI, endAngle: TWO_PI,
            closed: false, strokeColor: '#112233', strokeWidth: 5, fillColor: null,
        });
    });
    it('b・cが0でない変換（回転・傾き）はErrorにならず5つの点がそのまま写り、自身は変わらない', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle');
        const before = JSON.stringify(shape.toJSON());
        const rotated = shape.createTransformed({ a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 });
        assert.deepEqual(rotated.toJSON().points, [{ x: -100, y: 100 }, { x: -100, y: 130 }, { x: -60, y: 100 }, { x: -100, y: 130 }, { x: -100, y: 130 }]);
        const sheared = shape.createTransformed({ a: 1, b: 1, c: 0, d: 1, e: 0, f: 0 });
        assert.deepEqual(sheared.toJSON().points, [{ x: 100, y: 200 }, { x: 130, y: 230 }, { x: 100, y: 160 }, { x: 130, y: 230 }, { x: 130, y: 230 }]);
        const skewed = new Ellipse(0, 0, 10, 10, 'arc').createTransformed({ a: 1, b: 0, c: 0.5, d: 1, e: 0, f: 0 });
        assert.deepEqual(skewed.toJSON().points, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: -5, y: -10 }, { x: -10, y: 0 }, { x: 10, y: 0 }]);
        assert.equal(JSON.stringify(shape.toJSON()), before);
    });
    it('自身は変わらず、戻り値と頂点を共有しない', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, '#445566');
        const before = JSON.stringify(shape.toJSON());
        const out = shape.createTransformed({ a: 2, b: 0, c: 0, d: -1, e: 1, f: 1 });
        assert.equal(JSON.stringify(shape.toJSON()), before);
        assert.notEqual(out, shape);
        assert.notEqual(out.points, shape.points);
        out.translate(5, 5);
        out.setVertex(1, 500, 0);
        assert.equal(JSON.stringify(shape.toJSON()), before);
    });
    it('同じ自身から2回作っても2回目は1回目の影響を受けない', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle', '#112233', 5, null);
        const t = { a: 2, b: 0, c: 0, d: 2, e: 0, f: 0 };
        const first = shape.createTransformed(t);
        first.translate(100, 100);
        const second = shape.createTransformed(t);
        assert.deepEqual(second.toJSON().points, [{ x: 200, y: 200 }, { x: 260, y: 200 }, { x: 200, y: 120 }, { x: 260, y: 200 }, { x: 260, y: 200 }]);
        assert.deepEqual(first.toJSON().points, [{ x: 300, y: 300 }, { x: 360, y: 300 }, { x: 300, y: 220 }, { x: 360, y: 300 }, { x: 360, y: 300 }]);
    });
});

/**
 * 円・弧を`fromJSON`で作る（5つの点を指定。中心は`points[0]`）。
 * @param {string} type - 図形種別（'circle'|'arc'）
 * @param {number[][]} pts - 5つの点`[x, y]`（中心・`u`側・`w`側・開始角側・終了角側）
 * @returns {Ellipse} 復元した円・弧
 */
function fromPoints(type, pts) {
    return Ellipse.fromJSON({
        type, id: 'g1', points: pts.map(([x, y]) => ({ x, y })), strokeColor: '#112233', strokeWidth: 3, fillColor: '#445566',
    });
}

/**
 * 描画要素から輪郭上の点（x + R(rotation)·(radiusX·cosθ, radiusY·sinθ)）を求める。
 * @param {Object} el - 楕円の描画要素
 * @param {number} theta - 媒介変数の角度
 * @returns {{x: number, y: number}} 輪郭上の点
 */
function outlinePointOf(el, theta) {
    const ex = el.radiusX * Math.cos(theta);
    const ey = el.radiusY * Math.sin(theta);
    return {
        x: el.x + ex * Math.cos(el.rotation) - ey * Math.sin(el.rotation),
        y: el.y + ex * Math.sin(el.rotation) + ey * Math.cos(el.rotation),
    };
}

/**
 * 2点が許容量内で一致することを確かめる。
 * @param {{x: number, y: number}} actual - 実際の点
 * @param {number[]} expected - 期待する点`[x, y]`
 * @returns {void}
 */
function assertPointNear(actual, expected) {
    assert.ok(Math.abs(actual.x - expected[0]) < 1e-9 && Math.abs(actual.y - expected[1]) < 1e-9, `(${actual.x}, ${actual.y}) != (${expected})`);
}

describe('Ellipse の形の読み方（回転・裏返し）と描画・描画要素', () => {
    it('回していない円・弧は ctx.ellipse の引数が今と同じ（回転0・今の開始角）で、draw・drawHover・drawOutline が一致する', () => {
        for (const [type, start] of [['circle', 0], ['arc', Math.PI]]) {
            const shape = new Ellipse(10, 20, 40, 60, type, '#111111', 3);
            const expected = ['ellipse', 10, 20, 30, 40, 0, start, Math.PI * 2];
            const d = makeRecordingCtx();
            shape.draw(d.ctx);
            const h = makeRecordingCtx();
            shape.drawHover(h.ctx, 1);
            const o = makeRecordingCtx();
            shape.drawOutline(o.ctx, 1, '#000000');
            assert.deepEqual(d.log.find((e) => e[0] === 'ellipse'), expected);
            assert.deepEqual(h.log.find((e) => e[0] === 'ellipse'), expected);
            assert.deepEqual(o.log.find((e) => e[0] === 'ellipse'), expected);
        }
    });

    it('回していない円・弧の toDrawElement は rotation: 0 以外今と同じ', () => {
        assert.deepEqual(new Ellipse(10, 20, 40, 60, 'arc', '#111111', 3, '#222222').toDrawElement(), {
            kind: 'ellipse', id: null, x: 10, y: 20, radiusX: 30, radiusY: 40, rotation: 0,
            startAngle: Math.PI, endAngle: Math.PI * 2, closed: false, strokeColor: '#111111', strokeWidth: 3, fillColor: null,
        });
    });

    it('90度回した円（中心(100,100)・u=(0,30)・w=(40,0)）は ctx.ellipse へ回した形を渡し、輪郭の点が5つの点の位置と一致する', () => {
        const shape = fromPoints('circle', [[100, 100], [100, 130], [140, 100], [100, 130], [100, 130]]);
        const el = shape.toDrawElement();
        assert.equal(el.radiusX, 40);
        assert.equal(el.radiusY, 30);
        assert.equal(el.rotation, 0);
        assert.equal(el.startAngle, 0);
        assert.equal(el.endAngle, Math.PI * 2);
        assert.equal(el.closed, true);
        const rec = makeRecordingCtx();
        shape.draw(rec.ctx);
        assert.deepEqual(rec.log.find((e) => e[0] === 'ellipse'), ['ellipse', 100, 100, 40, 30, 0, 0, Math.PI * 2]);
        // 円は全周のため開始角に依らず、輪郭の点の集合が5つの点（右端(100,130)・上端(140,100)）を含む
        assertPointNear(outlinePointOf(el, 0), [140, 100]);
        assertPointNear(outlinePointOf(el, Math.PI / 2), [100, 130]);
    });

    it('90度回した弧（中心(100,100)・points[1](100,130)・points[2](140,100)）は右半分（radiusX 40・radiusY 30・開始角3π/2・終了角5π/2）', () => {
        const el = fromPoints('arc', [[100, 100], [100, 130], [140, 100], [60, 100], [100, 130]]).toDrawElement();
        assert.equal(el.radiusX, 40);
        assert.equal(el.radiusY, 30);
        assert.equal(el.rotation, 0);
        assert.ok(Math.abs(el.startAngle - Math.PI * 1.5) < 1e-9);
        assert.ok(Math.abs(el.endAngle - Math.PI * 2.5) < 1e-9);
        assertPointNear(outlinePointOf(el, el.startAngle), [100, 70]);
        assertPointNear(outlinePointOf(el, el.endAngle), [100, 130]);
        assertPointNear(outlinePointOf(el, (el.startAngle + el.endAngle) / 2), [140, 100]);
    });

    it('上下に裏返した弧（u=(30,0)・w=(0,40)）は下半分（開始角0・終了角π）で、頂上が(100,140)', () => {
        const shape = fromPoints('arc', [[100, 100], [130, 100], [100, 140], [70, 100], [130, 100]]);
        const el = shape.toDrawElement();
        assert.equal(el.radiusX, 30);
        assert.equal(el.radiusY, 40);
        assert.equal(el.rotation, 0);
        assert.equal(el.startAngle, 0);
        assert.equal(el.endAngle, Math.PI);
        const rec = makeRecordingCtx();
        shape.drawOutline(rec.ctx, 1, '#000000');
        assert.deepEqual(rec.log.find((e) => e[0] === 'ellipse'), ['ellipse', 100, 100, 30, 40, 0, 0, Math.PI]);
    });

    it('左右に裏返した弧（u=(-30,0)・w=(0,-40)）は同じ上半分（開始角π・終了角2π）、左右上下に裏返すと下半分', () => {
        const left = fromPoints('arc', [[100, 100], [70, 100], [100, 60], [130, 100], [70, 100]]).toDrawElement();
        assert.equal(left.startAngle, Math.PI);
        assert.equal(left.endAngle, Math.PI * 2);
        const both = fromPoints('arc', [[100, 100], [70, 100], [100, 140], [130, 100], [70, 100]]).toDrawElement();
        assert.equal(both.startAngle, 0);
        assert.equal(both.endAngle, Math.PI);
    });

    it('45度回した円（u=(a,a)・w=(b,-b)相当）は半径の組と輪郭の点が5つの点と一致し、draw が ctx.ellipse へ回転を渡す', () => {
        const s = Math.SQRT1_2;
        const shape = fromPoints('circle', [[0, 0], [40 * s, 40 * s], [20 * s, -20 * s], [40 * s, 40 * s], [40 * s, 40 * s]]);
        const el = shape.toDrawElement();
        assert.ok(Math.abs(el.radiusX - 40) < 1e-9);
        assert.ok(Math.abs(el.radiusY - 20) < 1e-9);
        assertPointNear(outlinePointOf(el, 0), [40 * s, 40 * s]);
        assertPointNear(outlinePointOf(el, el.startAngle + Math.PI / 2), [-20 * s, 20 * s]);
        const rec = makeRecordingCtx();
        shape.draw(rec.ctx);
        const call = rec.log.find((e) => e[0] === 'ellipse');
        assert.equal(call[5], el.rotation);
        assert.equal(call[3], el.radiusX);
        assert.equal(call[4], el.radiusY);
    });

    it('回した後に縦横別に伸ばした弧でも、輪郭の両端・頂上が5つの点の位置と一致する', () => {
        // 非直交の共役半径（u=(50,0)・w=(30,40)。傾いた楕円の弧になる）
        const shape = fromPoints('arc', [[10, 10], [60, 10], [40, 50], [-40, 10], [60, 10]]);
        const el = shape.toDrawElement();
        // 両端は中心−u(-40,10)・中心＋u(60,10)、弧の中央は中心＋w(40,50)（裏返った形は描く向きが逆になり、開始角側が中心＋u）
        assertPointNear(outlinePointOf(el, el.startAngle), [60, 10]);
        assertPointNear(outlinePointOf(el, (el.startAngle + el.endAngle) / 2), [40, 50]);
        assertPointNear(outlinePointOf(el, el.endAngle), [-40, 10]);
    });

    it('toDrawElement・draw は図形を書き換えない（5つの点は変わらない）', () => {
        const shape = fromPoints('arc', [[100, 100], [100, 130], [140, 100], [60, 100], [100, 130]]);
        const before = JSON.stringify(shape.toJSON());
        shape.toDrawElement();
        shape.draw(makeRecordingCtx().ctx);
        assert.equal(JSON.stringify(shape.toJSON()), before);
    });
});

describe('Ellipse の当たり判定（回した・裏返した円・弧）', () => {
    // 中心(100,100)の円・弧を90度（画面の時計回り）回した形：u=(0,40)・w=(20,0)
    const rotated90 = (type) => fromPoints(type, [[100, 100], [100, 140], [120, 100], [100, 140], [100, 140]]);

    it('90度回した円：輪郭は縦長の楕円（半径 横20・縦40）の上で当たり、回す前の位置（横40）では外れる', () => {
        const shape = rotated90('circle');
        assert.equal(shape.hitTest(100, 140, 0), true);
        assert.equal(shape.hitTest(120, 100, 0), true);
        assert.equal(shape.hitTest(100, 60, 0), true);
        assert.equal(shape.hitTest(140, 100, 0), false);
        assert.equal(shape.hitTest(100, 100, 0), false);
    });

    it('90度回した円：内側（hitTestFill）は縦長の楕円の内側だけで、境界上は含まない', () => {
        const shape = rotated90('circle');
        assert.equal(shape.hitTestFill(100, 130), true);
        assert.equal(shape.hitTestFill(110, 100), true);
        assert.equal(shape.hitTestFill(130, 100), false);
        assert.equal(shape.hitTestFill(120, 100), false);
    });

    it('45度回した円：長軸・短軸の向きで当たり、半径の外・内の判定が回転に従う', () => {
        const s = Math.SQRT1_2;
        const shape = fromPoints('circle', [[0, 0], [40 * s, 40 * s], [20 * s, -20 * s], [40 * s, 40 * s], [40 * s, 40 * s]]);
        assert.equal(shape.hitTest(40 * s, 40 * s, 0), true);
        assert.equal(shape.hitTest(-40 * s, -40 * s, 0), true);
        assert.equal(shape.hitTest(20 * s, -20 * s, 0), true);
        assert.equal(shape.hitTest(40 * s, -40 * s, 0), false);
        assert.equal(shape.hitTestFill(30 * s, 30 * s), true);
        assert.equal(shape.hitTestFill(30 * s, -30 * s), false);
    });

    it('90度回した弧：描かれる右半分だけで当たり、反対側（空隙）では外れる', () => {
        const shape = rotated90('arc');
        assert.equal(shape.hitTest(120, 100, 0), true);
        assert.equal(shape.hitTest(80, 100, 0), false);
        // 媒介変数 t = 5π/4（描かれる側）と 3π/4（空隙側）の輪郭上の点：中心 + u·cos t − w·sin t
        const c = Math.SQRT1_2;
        assert.equal(shape.hitTest(100 + 20 * c, 100 - 40 * c, 0), true);
        assert.equal(shape.hitTest(100 - 20 * c, 100 - 40 * c, 0), false);
        assert.equal(shape.hitTestFill(110, 100), false);
    });

    it('上下に裏返した弧は下半分、左右に裏返した弧は上半分で当たる', () => {
        const down = fromPoints('arc', [[100, 100], [130, 100], [100, 140], [70, 100], [130, 100]]);
        assert.equal(down.hitTest(100, 140, 0), true);
        assert.equal(down.hitTest(100, 60, 0), false);
        const up = fromPoints('arc', [[100, 100], [70, 100], [100, 60], [130, 100], [70, 100]]);
        assert.equal(up.hitTest(100, 60, 0), true);
        assert.equal(up.hitTest(100, 140, 0), false);
    });

    it('非直交の共役半径の弧（回した後に縦横別に伸ばした形）：両端と頂上で当たり、反対側では外れる', () => {
        const shape = fromPoints('arc', [[10, 10], [60, 10], [40, 50], [-40, 10], [60, 10]]);
        const c = Math.SQRT1_2;
        // 頂上（中心＋w）、描かれる側（t = 5π/4）と空隙側（t = 3π/4）の輪郭上の点：中心 + u·cos t − w·sin t
        assert.equal(shape.hitTest(40, 50, 0), true);
        assert.equal(shape.hitTest(10 - 50 * c + 30 * c, 10 + 40 * c, 0), true);
        assert.equal(shape.hitTest(10 - 50 * c - 30 * c, 10 - 40 * c, 0), false);
        assert.equal(shape.hitTest(-20, -30, 0), false);
    });

    it('縮んだ回した弧（半径が1未満）：折れ線までの距離で判定し、輪郭の近くで当たり遠くで外れる', () => {
        const shape = fromPoints('arc', [[100, 100], [100, 100.5], [100.3, 100], [100, 100.5], [100, 100.5]]);
        assert.equal(shape.hitTest(100, 100.5, 0), true);
        assert.equal(shape.hitTest(100, 110, 0), false);
    });

    it('90度回した円：範囲選択は輪郭が掛かるときだけ true（内側だけ・横の外側は false）', () => {
        const shape = rotated90('circle');
        assert.equal(shape.intersectsRect(99, 138, 101, 142), true);
        assert.equal(shape.intersectsRect(118, 98, 122, 102), true);
        assert.equal(shape.intersectsRect(95, 95, 105, 105), false);
        assert.equal(shape.intersectsRect(130, 98, 150, 102), false);
        assert.equal(shape.intersectsRect(200, 200, 210, 210), false);
    });

    it('90度回した弧：範囲選択は描かれる右半分だけに掛かる', () => {
        const shape = rotated90('arc');
        assert.equal(shape.intersectsRect(118, 98, 122, 102), true);
        assert.equal(shape.intersectsRect(78, 98, 82, 102), false);
    });

    it('当たり判定は図形を書き換えない', () => {
        const shape = rotated90('arc');
        const before = JSON.stringify(shape.toJSON());
        shape.hitTest(120, 100, 2);
        shape.hitTestFill(110, 100);
        shape.intersectsRect(0, 0, 500, 500);
        assert.equal(JSON.stringify(shape.toJSON()), before);
    });
});

describe('Ellipse.createTransformed（回転・傾き・Phase 10-02）', () => {
    const ROTATE_90 = { a: 0, b: 1, c: -1, d: 0, e: 0, f: 0 };
    it('円を90°回すと5つの点がそのまま写り、半径の組が入れ替わった楕円になる（スタイル・idは同じ）', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle', '#112233', 5, '#445566');
        shape.id = 's1';
        const out = shape.createTransformed(ROTATE_90);
        assert.deepEqual(out.toJSON().points, [{ x: -100, y: 100 }, { x: -100, y: 130 }, { x: -60, y: 100 }, { x: -100, y: 130 }, { x: -100, y: 130 }]);
        assert.deepEqual(out.toDrawElement(), {
            kind: 'ellipse', id: 's1', x: -100, y: 100, radiusX: 40, radiusY: 30, rotation: 0, startAngle: 0, endAngle: Math.PI * 2,
            closed: true, strokeColor: '#112233', strokeWidth: 5, fillColor: '#445566',
        });
        assert.equal(out.type, 'circle');
        assert.equal(out.hitTest(-140, 100, 3), true);
        assert.equal(out.hitTest(-100, 130, 3), true);
        assert.equal(out.hitTest(-70, 100, 3), false);
    });
    it('弧を90°回すと点を写した位置の弧になり、描画要素から求めた輪郭の端点が変換した弧の両端と一致する', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'arc', '#112233', 5, null);
        shape.id = 'a1';
        const out = shape.createTransformed(ROTATE_90);
        assert.deepEqual(out.toJSON().points, [{ x: -100, y: 100 }, { x: -100, y: 130 }, { x: -60, y: 100 }, { x: -100, y: 70 }, { x: -100, y: 130 }]);
        const el = out.toDrawElement();
        assert.deepEqual([el.x, el.y, el.radiusX, el.radiusY, el.rotation], [-100, 100, 40, 30, 0]);
        const at = (theta) => ({
            x: el.x + el.radiusX * Math.cos(theta) * Math.cos(el.rotation) - el.radiusY * Math.sin(theta) * Math.sin(el.rotation),
            y: el.y + el.radiusX * Math.cos(theta) * Math.sin(el.rotation) + el.radiusY * Math.sin(theta) * Math.cos(el.rotation),
        });
        const start = at(el.startAngle);
        const end = at(el.endAngle);
        // 元の弧の両端（右端(130,100)・左端(70,100)）を90°回した位置（x' = -y, y' = x）。描く向きの始点・終点は一致すればよい
        const ends = [{ x: -100, y: 130 }, { x: -100, y: 70 }];
        const matches = (p, q) => Math.abs(p.x - q.x) < 1e-9 && Math.abs(p.y - q.y) < 1e-9;
        assert.ok(ends.some((q) => matches(start, q)));
        assert.ok(ends.some((q) => matches(end, q)));
        assert.equal(out.hitTest(-60, 100, 3), true);
        assert.equal(out.hitTest(-140, 100, 3), false);
    });
    it('回した円に縦横別の倍率を当てても5つの点が写り、自身は変わらない', () => {
        const shape = new Ellipse(100, 100, 130, 140, 'circle', '#112233', 5, null);
        const before = JSON.stringify(shape.toJSON());
        const rotated = shape.createTransformed(ROTATE_90);
        const scaled = rotated.createTransformed({ a: 2, b: 0, c: 0, d: 0.5, e: 0, f: 0 });
        assert.deepEqual(scaled.toJSON().points, [{ x: -200, y: 50 }, { x: -200, y: 65 }, { x: -120, y: 50 }, { x: -200, y: 65 }, { x: -200, y: 65 }]);
        assert.equal(JSON.stringify(shape.toJSON()), before);
    });
    it('一般の角度（45°）で回した円の中心・端点が写る（許容量1e-9）', () => {
        const c = Math.cos(Math.PI / 4);
        const s = Math.sin(Math.PI / 4);
        const shape = new Ellipse(0, 0, 40, 30, 'circle');
        const out = shape.createTransformed({ a: c, b: s, c: -s, d: c, e: 0, f: 0 });
        const points = out.toJSON().points;
        assert.ok(Math.abs(points[1].x - 40 * c) < 1e-9);
        assert.ok(Math.abs(points[1].y - 40 * s) < 1e-9);
        assert.ok(Math.abs(points[2].x - 30 * s) < 1e-9);
        assert.ok(Math.abs(points[2].y + 30 * c) < 1e-9);
        assert.equal(out.hitTest(40 * c, 40 * s, 1), true);
    });
});
