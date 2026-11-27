/**
 * 責務: 図形クラス5つの共通メソッド appendOutline（輪郭を共有のパスへ足す）・isInsideOutline（自分の輪郭のevenodd内側）を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 図形のメソッドが呼んだ2Dコンテキストの命令を、名前と引数で記録して返す。
 * @param {Object} shape - 図形
 * @param {string} method - メソッド名（'appendOutline'|'draw'）
 * @returns {Array<Array<string|number>>} 記録（[命令名, ...引数]の配列）
 */
function record(shape, method) {
    const calls = [];
    const ctx = {};
    for (const name of ['beginPath', 'moveTo', 'lineTo', 'quadraticCurveTo', 'bezierCurveTo', 'ellipse', 'closePath', 'fill', 'stroke']) {
        ctx[name] = (...args) => { calls.push([name, ...args]); };
    }
    shape[method](ctx);
    return calls;
}

describe('appendOutline', () => {
    it('Line: moveTo→lineTo だけ（beginPath・塗り・線を呼ばない）', () => {
        const line = new Line(1, 2, 3, 4, '#000000', 2, '#ff0000');
        assert.deepEqual(record(line, 'appendOutline'), [['moveTo', 1, 2], ['lineTo', 3, 4]]);
    });

    it('Curve: moveTo→quadraticCurveTo', () => {
        const curve = new Curve(0, 0, 10, 0);
        curve.points[1] = { x: 5, y: 8 };
        assert.deepEqual(record(curve, 'appendOutline'), [['moveTo', 0, 0], ['quadraticCurveTo', 5, 8, 10, 0]]);
    });

    it('Rect: moveTo→lineTo×3→closePath。drawのbeginPath後〜塗り前と同じ並び', () => {
        const rect = new Rect(0, 0, 10, 20, null, 2, '#00ff00');
        const outline = record(rect, 'appendOutline');
        assert.deepEqual(outline, [['moveTo', 0, 0], ['lineTo', 10, 0], ['lineTo', 10, 20], ['lineTo', 0, 20], ['closePath']]);
        const drawn = record(rect, 'draw');
        assert.deepEqual(drawn.slice(1, 1 + outline.length), outline);
    });

    it('Path（閉じた・曲線の区間つき）: drawのパスの命令と同じ並びでbeginPathなし', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true, '#000000', 2, '#ff0000', 'smooth');
        const outline = record(path, 'appendOutline');
        assert.equal(outline.some(([name]) => name === 'beginPath'), false);
        assert.equal(outline[0][0], 'moveTo');
        assert.equal(outline[outline.length - 1][0], 'closePath');
        const drawn = record(path, 'draw');
        assert.deepEqual(drawn.slice(1, 1 + outline.length), outline);
    });

    it('Path（開いた）: closePathを呼ばない', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
        assert.deepEqual(record(path, 'appendOutline'), [['moveTo', 0, 0], ['lineTo', 10, 0], ['lineTo', 10, 10]]);
    });

    it('Ellipse（円）: 始点へmoveTo→ellipse→closePath', () => {
        const circle = new Ellipse(0, 0, 10, 10, 'circle');
        const outline = record(circle, 'appendOutline');
        assert.deepEqual(outline.map(([name]) => name), ['moveTo', 'ellipse', 'closePath']);
        assert.ok(Math.abs(outline[0][1] - 10) < 1e-9);
        assert.ok(Math.abs(outline[0][2] - 0) < 1e-9);
        const drawn = record(circle, 'draw');
        assert.deepEqual(drawn.slice(1, 3), outline.slice(1, 3));
    });

    it('Ellipse（弧）: 始点へmoveTo→ellipse（閉じない）', () => {
        const arc = new Ellipse(0, 0, 10, 10, 'arc');
        const outline = record(arc, 'appendOutline');
        assert.deepEqual(outline.map(([name]) => name), ['moveTo', 'ellipse']);
        // 弧の始点は左端（startAngle=π）
        assert.ok(Math.abs(outline[0][1] - (-10)) < 1e-9);
        assert.ok(Math.abs(outline[0][2] - 0) < 1e-9);
    });
});

describe('isInsideOutline', () => {
    it('Line: 常に偽', () => {
        const line = new Line(0, 0, 10, 10, '#000000', 2, '#ff0000');
        assert.equal(line.isInsideOutline(5, 5), false);
        assert.equal(line.isInsideOutline(100, 0), false);
    });

    it('Curve: 曲線と弦で囲まれた部分は真・外側は偽。スタイルを読まない', () => {
        const curve = new Curve(0, 0, 100, 0, null, 2, null);
        curve.points[1] = { x: 50, y: 100 };
        assert.equal(curve.isInsideOutline(50, 20), true);
        assert.equal(curve.isInsideOutline(50, 80), false);
        assert.equal(curve.isInsideOutline(50, -5), false);
        assert.equal(curve.isInsideOutline(50, 0), false);
    });

    it('Rect: fillColorがnullでも内側は真、境界は偽', () => {
        const rect = new Rect(0, 0, 10, 10, '#000000', 2, null);
        assert.equal(rect.isInsideOutline(5, 5), true);
        assert.equal(rect.isInsideOutline(15, 5), false);
        assert.equal(rect.isInsideOutline(0, 5), false);
        assert.equal(rect.isInsideOutline(10, 10), false);
    });

    it('Path（閉じた）: 内側は真・外側は偽。fillColor・strokeColorを読まない', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }], true, null, 2, null);
        assert.equal(path.isInsideOutline(5, 5), true);
        assert.equal(path.isInsideOutline(20, 5), false);
        assert.equal(path.isInsideOutline(5, 0), false);
    });

    it('Path（開いた）: 始点と終点を結んだ形の内側は真。hitTestFillは偽のまま', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }], false, '#000000', 2, '#ff0000');
        assert.equal(path.isInsideOutline(8, 2), true);
        assert.equal(path.isInsideOutline(2, 8), false);
        assert.equal(path.hitTestFill(8, 2), false);
    });

    it('Path（開いた・曲線の区間）: 末尾の頂点を足した多角形で判定する', () => {
        const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], false, '#000000', 2, null, 'smooth');
        assert.equal(path.isInsideOutline(50, 50), true);
        assert.equal(path.isInsideOutline(200, 50), false);
    });

    it('Ellipse（円）: hitTestFillと同じ式。fillColorがnullでも真', () => {
        const circle = new Ellipse(0, 0, 10, 10, 'circle', '#000000', 2, null);
        assert.equal(circle.isInsideOutline(0, 0), true);
        assert.equal(circle.isInsideOutline(5, 5), true);
        assert.equal(circle.isInsideOutline(10, 0), false);
        assert.equal(circle.isInsideOutline(20, 0), false);
        const filled = new Ellipse(0, 0, 10, 10, 'circle', '#000000', 2, '#ff0000');
        for (const [x, y] of [[0, 0], [9, 0], [7, 7], [10, 0], [11, 3]]) {
            assert.equal(circle.isInsideOutline(x, y), filled.hitTestFill(x, y));
        }
    });

    it('Ellipse（円）: 半径0は偽', () => {
        const circle = new Ellipse(0, 0, 0, 0, 'circle');
        assert.equal(circle.isInsideOutline(0, 0), false);
    });

    it('Ellipse（弧）: 弦で閉じた半円の内側は真、反対側は偽。isFillable()を問わない', () => {
        const arc = new Ellipse(0, 0, 100, 100, 'arc');
        assert.equal(arc.isFillable(), false);
        assert.equal(arc.isInsideOutline(0, -50), true);
        assert.equal(arc.isInsideOutline(0, 50), false);
        assert.equal(arc.isInsideOutline(0, -200), false);
    });
});
