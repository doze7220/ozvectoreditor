/**
 * 責務: 円・弧（Ellipse）の当たり判定（輪郭（縮退時の分岐を含む）・内側）・塗れる形か（isFillable）・偽のctxによる描画命令・図形データとの相互変換
 * （fromJSONの受理と不正なデータのエラー文・toJSON・toDrawElement）・ハンドルの位置（getHandlePosition）を、公開APIのみを通して検証する。
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

    it('toDrawElementのキー順（ellipseの12キー）', () => {
        assert.deepEqual(Object.keys(makeCircle().toDrawElement()), [
            'kind', 'id', 'x', 'y', 'radiusX', 'radiusY', 'startAngle', 'endAngle',
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
    it('円・弧それぞれで5つのハンドルの位置（左端・下端は計算上の位置）', () => {
        for (const type of ['circle', 'arc']) {
            const ellipse = new Ellipse(10, 20, 40, 60, type);
            assert.deepEqual(ellipse.getHandlePosition('move'), { x: 10, y: 20 });
            assert.deepEqual(ellipse.getHandlePosition('right'), { x: 40, y: 20 });
            assert.deepEqual(ellipse.getHandlePosition('up'), { x: 10, y: -20 });
            assert.deepEqual(ellipse.getHandlePosition('left'), { x: -20, y: 20 });
            assert.deepEqual(ellipse.getHandlePosition('down'), { x: 10, y: 60 });
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

    it('返したオブジェクトを書き換えても図形は変わらず、毎回新しいオブジェクト', () => {
        const ellipse = new Ellipse(0, 0, 50, 50);
        const before = JSON.stringify(ellipse);
        const pos = ellipse.getHandlePosition('right');
        pos.x = 999;
        pos.y = 999;
        assert.equal(JSON.stringify(ellipse), before);
        assert.notEqual(ellipse.getHandlePosition('right'), ellipse.getHandlePosition('right'));
        assert.deepEqual(ellipse.getHandlePosition('right'), { x: 50, y: 0 });
    });

    it('返した位置をhitTestHandleへ渡すとそのハンドル名が返る（円・弧）', () => {
        for (const type of ['circle', 'arc']) {
            const ellipse = new Ellipse(100, 100, 160, 140, type);
            for (const name of ['move', 'right', 'up', 'left', 'down']) {
                const pos = ellipse.getHandlePosition(name);
                assert.equal(ellipse.hitTestHandle(pos.x, pos.y, 1), name);
            }
        }
    });
});
