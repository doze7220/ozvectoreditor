/**
 * 責務: CompoundPathRenderer.drawCompoundPath の命令の順・スタイルの出所・何も描かない条件を、命令を記録する偽のctxと実物の図形で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawCompoundPath } from '../../js/core/CompoundPathRenderer.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Line } from '../../js/shapes/Line.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 命令と代入を記録する偽のctxを作る。
 * @returns {{ctx: Object, calls: Array<Array<*>>}} ctxと記録
 */
function makeCtx() {
    const calls = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse', 'closePath', 'fill', 'stroke']) {
        ctx[name] = (...args) => { calls.push([name, ...args]); };
    }
    for (const prop of ['fillStyle', 'strokeStyle', 'lineWidth']) {
        Object.defineProperty(ctx, prop, { set(v) { calls.push([prop, v]); }, get() { return undefined; } });
    }
    return { ctx, calls };
}

/**
 * 一番下の図形のスタイルを写した複合パスを作る。
 * @param {Object[]} shapes - 中の図形
 * @returns {Object} 複合パス
 */
function makeCompound(shapes) {
    const base = shapes[0];
    return {
        groupId: 'g1',
        shapes,
        style: { strokeColor: base.strokeColor, strokeWidth: base.strokeWidth, fillColor: base.fillColor },
        baseEditable: true
    };
}

describe('drawCompoundPath', () => {
    it('大きな円＋小さな円: beginPath1回→各輪郭→fillStyle→fill(evenodd)→strokeStyle→lineWidth→stroke', () => {
        const big = new Ellipse(0, 0, 100, 100, 'circle', '#112233', 4, '#aabbcc');
        const small = new Ellipse(25, 25, 75, 75, 'circle', '#ff0000', 9, '#00ff00');
        const { ctx, calls } = makeCtx();
        drawCompoundPath(ctx, makeCompound([big, small]));
        const names = calls.map((c) => c[0]);
        assert.deepEqual(names, [
            'beginPath',
            'moveTo', 'ellipse', 'closePath',
            'moveTo', 'ellipse', 'closePath',
            'fillStyle', 'fill', 'strokeStyle', 'lineWidth', 'stroke'
        ]);
        assert.equal(calls.filter((c) => c[0] === 'beginPath').length, 1);
        assert.deepEqual(calls[names.indexOf('fillStyle')], ['fillStyle', '#aabbcc']);
        assert.deepEqual(calls[names.indexOf('fill')], ['fill', 'evenodd']);
        assert.deepEqual(calls[names.indexOf('strokeStyle')], ['strokeStyle', '#112233']);
        assert.deepEqual(calls[names.indexOf('lineWidth')], ['lineWidth', 4]);
    });

    it('塗りなし(fillColor: null)は fill を呼ばない', () => {
        const a = new Ellipse(0, 0, 100, 100, 'circle', '#112233', 4, null);
        const b = new Ellipse(25, 25, 75, 75, 'circle', '#112233', 4, '#00ff00');
        const { ctx, calls } = makeCtx();
        drawCompoundPath(ctx, makeCompound([a, b]));
        const names = calls.map((c) => c[0]);
        assert.ok(!names.includes('fill'));
        assert.ok(!names.includes('fillStyle'));
        assert.deepEqual(names.slice(-3), ['strokeStyle', 'lineWidth', 'stroke']);
    });

    it('線なしは線の3つを呼ばない', () => {
        const a = new Ellipse(0, 0, 100, 100, 'circle', null, 4, '#aabbcc');
        const { ctx, calls } = makeCtx();
        drawCompoundPath(ctx, makeCompound([a]));
        const names = calls.map((c) => c[0]);
        assert.ok(names.includes('fill'));
        assert.ok(!names.includes('strokeStyle'));
        assert.ok(!names.includes('lineWidth'));
        assert.ok(!names.includes('stroke'));
    });

    it('塗りも線もない・shapesが空は何も呼ばない', () => {
        const a = new Ellipse(0, 0, 100, 100, 'circle', null, 4, null);
        const none = makeCtx();
        drawCompoundPath(none.ctx, makeCompound([a]));
        assert.deepEqual(none.calls, []);
        const empty = makeCtx();
        drawCompoundPath(empty.ctx, { groupId: 'g', shapes: [], style: { strokeColor: '#000000', strokeWidth: 2, fillColor: '#ffffff' }, baseEditable: true });
        assert.deepEqual(empty.calls, []);
    });

    it('一番下が塗れない形（直線・開いたパス）でも fillColor が文字列なら fill(evenodd)', () => {
        const line = new Line(0, 0, 10, 10, '#000000', 2, '#123456');
        const { ctx, calls } = makeCtx();
        drawCompoundPath(ctx, makeCompound([line]));
        assert.deepEqual(calls.find((c) => c[0] === 'fill'), ['fill', 'evenodd']);
        assert.deepEqual(calls.find((c) => c[0] === 'fillStyle'), ['fillStyle', '#123456']);

        const open = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false, '#000000', 2, '#654321');
        const second = makeCtx();
        drawCompoundPath(second.ctx, makeCompound([open]));
        assert.deepEqual(second.calls.find((c) => c[0] === 'fill'), ['fill', 'evenodd']);
    });

    it('図形1つでも同じ形・図形のdrawを呼ばず図形を書き換えない', () => {
        const a = new Ellipse(0, 0, 100, 100, 'circle', '#112233', 4, '#aabbcc');
        const before = JSON.stringify(a.toDrawElement());
        let drawn = 0;
        a.draw = () => { drawn++; };
        const { ctx, calls } = makeCtx();
        drawCompoundPath(ctx, makeCompound([a]));
        assert.equal(drawn, 0);
        assert.deepEqual(calls.map((c) => c[0]), ['beginPath', 'moveTo', 'ellipse', 'closePath', 'fillStyle', 'fill', 'strokeStyle', 'lineWidth', 'stroke']);
        delete a.draw;
        assert.equal(JSON.stringify(a.toDrawElement()), before);
    });
});
