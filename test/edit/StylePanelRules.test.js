/**
 * 責務: StylePanelRulesの公開API（buildStylePanelView・toColorInputValue・parseStrokeWidthInput・RESET_COLORS_STYLE・sampleStyleFromShape）を、実物の図形クラスを使って検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    buildStylePanelView,
    toColorInputValue,
    parseStrokeWidthInput,
    nextEnabledOnToggle,
    RESET_COLORS_STYLE,
    sampleStyleFromShape,
} from '../../js/edit/StylePanelRules.js';
import { Line } from '../../js/shapes/Line.js';
import { Curve } from '../../js/shapes/Curve.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/** 次に描く図形のスタイルの例（線あり・黒・太さ2・塗りなし）。 */
const NEW_STYLE = Object.freeze({
    strokeEnabled: true, strokeColor: '#000000', strokeWidth: 2, fillEnabled: false, fillColor: '#ffffff',
});
/** パネルが覚えている色の例（線・塗り）。 */
const REMEMBERED = Object.freeze({ stroke: '#123456', fill: '#abcdef' });

/**
 * 矩形を作る（塗れる形）。
 * @param {string|null} stroke - 線の色
 * @param {number} [width=2] - 線の太さ
 * @param {string|null} [fill=null] - 塗りの色
 * @returns {Rect} 矩形
 */
function rect(stroke, width = 2, fill = null) {
    return new Rect(0, 0, 10, 10, stroke, width, fill);
}

/**
 * 直線を作る（塗れない形）。
 * @param {string|null} stroke - 線の色
 * @param {number} [width=2] - 線の太さ
 * @param {string|null} [fill=null] - 塗りの色（保持するだけ）
 * @returns {Line} 直線
 */
function line(stroke, width = 2, fill = null) {
    return new Line(0, 0, 10, 10, stroke, width, fill);
}

/**
 * パネルに出す内容を求める。
 * @param {object[]} selectedShapes - 選択中の図形
 * @returns {object} パネルに出す内容
 */
function build(selectedShapes) {
    return buildStylePanelView({ selectedShapes, newShapeStyle: NEW_STYLE, rememberedColors: REMEMBERED });
}

describe('toColorInputValue', () => {
    it('#rrggbbは小文字にする', () => {
        assert.equal(toColorInputValue('#FF00aA'), '#ff00aa');
    });
    it('#rgbは展開する', () => {
        assert.equal(toColorInputValue('#F0a'), '#ff00aa');
    });
    it('変換できない値はnull', () => {
        for (const value of ['red', 'rgb(1,2,3)', '#ff00aa80', '#f0a8', '', null, undefined, 5, '#gggggg']) {
            assert.equal(toColorInputValue(value), null, String(value));
        }
    });
});

describe('parseStrokeWidthInput', () => {
    it('1以上100以下の整数を受理する', () => {
        assert.equal(parseStrokeWidthInput('1'), 1);
        assert.equal(parseStrokeWidthInput('100'), 100);
        assert.equal(parseStrokeWidthInput(' 7 '), 7);
        assert.equal(parseStrokeWidthInput('1.0'), 1);
        assert.equal(parseStrokeWidthInput('1e1'), 10);
    });
    it('空・0・負・小数・100超・数値でない・文字列でない値は受理しない', () => {
        for (const value of ['', '  ', '0', '-3', '2.5', '101', 'abc', '1e3', 'Infinity', 5, null, undefined]) {
            assert.equal(parseStrokeWidthInput(value), null, String(value));
        }
    });
});

describe('nextEnabledOnToggle', () => {
    it('ON（true）ならOFF（false）になる', () => {
        assert.equal(nextEnabledOnToggle(true), false);
    });

    it('OFF（false）ならON（true）になる', () => {
        assert.equal(nextEnabledOnToggle(false), true);
    });

    it('そろっていない（null）ならON（true）になる', () => {
        assert.equal(nextEnabledOnToggle(null), true);
    });
});

describe('buildStylePanelView: 選択なし', () => {
    it('直前に使った値をそのまま出す', () => {
        const view = buildStylePanelView({
            selectedShapes: [],
            newShapeStyle: { strokeEnabled: false, strokeColor: '#F00', strokeWidth: 5, fillEnabled: true, fillColor: 'red' },
            rememberedColors: REMEMBERED,
        });
        assert.deepEqual(view, {
            stroke: { enabled: false, color: '#ff0000', colorNote: '', disabled: false },
            strokeWidth: 5,
            fill: { enabled: true, color: '#abcdef', colorNote: '', disabled: false },
        });
    });
});

describe('buildStylePanelView: 選択あり', () => {
    it('1個選択', () => {
        const view = build([rect('#FF0000', 3, '#00ff00')]);
        assert.deepEqual(view, {
            stroke: { enabled: true, color: '#ff0000', colorNote: '', disabled: false },
            strokeWidth: 3,
            fill: { enabled: true, color: '#00ff00', colorNote: '', disabled: false },
        });
    });
    it('値がそろっている複数選択', () => {
        const view = build([rect('#ff0000', 4), line('#ff0000', 4)]);
        assert.equal(view.stroke.enabled, true);
        assert.equal(view.stroke.colorNote, '');
        assert.equal(view.strokeWidth, 4);
    });
    it('有無・色・太さが混在', () => {
        const view = build([rect('#ff0000', 2), rect(null, 3), rect('#0000ff', 2)]);
        assert.equal(view.stroke.enabled, null);
        assert.equal(view.stroke.colorNote, 'mixed');
        assert.equal(view.stroke.color, '#0000ff');
        assert.equal(view.strokeWidth, null);
    });
    it('線なしの図形を含む選択の線の色は線ありの図形だけで決める', () => {
        const view = build([rect('#00ff00'), rect(null)]);
        assert.equal(view.stroke.enabled, null);
        assert.equal(view.stroke.color, '#00ff00');
        assert.equal(view.stroke.colorNote, '');
    });
    it('最も手前（配列の最後）の線ありの図形の色を出す', () => {
        const view = build([rect('#111111'), rect('#222222'), rect(null)]);
        assert.equal(view.stroke.color, '#222222');
        assert.equal(view.stroke.colorNote, 'mixed');
    });
    it('すべて線なしなら覚えている色・線なし・太さはそのまま', () => {
        const view = build([rect(null, 6), line(null, 6)]);
        assert.deepEqual(view.stroke, { enabled: false, color: '#123456', colorNote: '', disabled: false });
        assert.equal(view.strokeWidth, 6);
    });
    it('塗れない形だけなら塗りの欄は無効', () => {
        const view = build([line('#000000', 2, '#ff0000'), new Curve(0, 0, 5, 5, '#000000', 2, '#00ff00')]);
        assert.deepEqual(view.fill, { enabled: false, color: '#abcdef', colorNote: '', disabled: true });
    });
    it('塗りの値は塗れる形だけで決める（塗れない形のfillColorは無関係）', () => {
        const view = build([rect('#000000', 2, '#ff0000'), line('#000000', 2, '#00ff00')]);
        assert.deepEqual(view.fill, { enabled: true, color: '#ff0000', colorNote: '', disabled: false });
    });
    it('円・閉じたパスは塗れ、弧・開いたパスは塗れない', () => {
        const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
        assert.equal(build([new Ellipse(0, 0, 9, 9, 'circle', '#000000', 2, '#010101')]).fill.disabled, false);
        assert.equal(build([new Path(pts, true, '#000000', 2, '#010101')]).fill.disabled, false);
        assert.equal(build([new Ellipse(0, 0, 9, 9, 'arc', '#000000', 2, '#010101')]).fill.disabled, true);
        assert.equal(build([new Path(pts, false, '#000000', 2, '#010101')]).fill.disabled, true);
    });
    it('塗れる形の塗りの有無が混在', () => {
        const view = build([rect('#000000', 2, '#ff0000'), rect('#000000', 2, null)]);
        assert.equal(view.fill.enabled, null);
        assert.equal(view.fill.color, '#ff0000');
    });
    it('#rgbは展開して出し、変換できない色は覚えている色と「表示できない色」', () => {
        assert.equal(build([rect('#F0a')]).stroke.color, '#ff00aa');
        const view = build([rect('red')]);
        assert.equal(view.stroke.color, '#123456');
        assert.equal(view.stroke.colorNote, 'unsupported');
        assert.equal(view.stroke.enabled, true);
    });
    it('色の種類が2つ以上なら変換できなくても混在を優先する', () => {
        const view = build([rect('red'), rect('blue')]);
        assert.equal(view.stroke.colorNote, 'mixed');
    });
    it('小数の太さはそのまま出す', () => {
        assert.equal(build([rect('#000000', 2.5), line('#000000', 2.5)]).strokeWidth, 2.5);
    });
    it('引数を書き換えない', () => {
        const shapes = [rect('#ff0000', 3, 'red'), line(null, 4, '#00ff00')];
        const before = JSON.stringify(shapes.map((shape) => shape.toJSON()));
        const newStyle = { ...NEW_STYLE };
        const remembered = { ...REMEMBERED };
        buildStylePanelView({ selectedShapes: shapes, newShapeStyle: newStyle, rememberedColors: remembered });
        assert.equal(JSON.stringify(shapes.map((shape) => shape.toJSON())), before);
        assert.deepEqual(newStyle, NEW_STYLE);
        assert.deepEqual(remembered, REMEMBERED);
        assert.equal(shapes.length, 2);
    });
});

describe('RESET_COLORS_STYLE', () => {
    it('線は黒・塗りは白で、太さを持たず、凍結されている', () => {
        assert.equal(RESET_COLORS_STYLE.strokeColor, '#000000');
        assert.equal(RESET_COLORS_STYLE.fillColor, '#ffffff');
        assert.equal(Object.hasOwn(RESET_COLORS_STYLE, 'strokeWidth'), false);
        assert.equal(Object.isFrozen(RESET_COLORS_STYLE), true);
    });
});

describe('sampleStyleFromShape', () => {
    it('塗れる形は線の色・太さ・塗りの色を取り込む', () => {
        assert.deepEqual(sampleStyleFromShape(rect('#ff0000', 3, '#00ff00')), {
            strokeColor: '#ff0000', strokeWidth: 3, fillColor: '#00ff00',
        });
        const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
        assert.equal(Object.hasOwn(sampleStyleFromShape(new Ellipse(0, 0, 9, 9, 'circle', '#000000', 2, '#010101')), 'fillColor'), true);
        assert.equal(Object.hasOwn(sampleStyleFromShape(new Path(pts, true, '#000000', 2, '#010101')), 'fillColor'), true);
    });
    it('塗れない形（直線・開いたパス）はfillColorのキーを持たない', () => {
        const pts = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }];
        const lineStyle = sampleStyleFromShape(line('#112233', 4, '#ff0000'));
        assert.deepEqual(lineStyle, { strokeColor: '#112233', strokeWidth: 4 });
        assert.equal(Object.hasOwn(lineStyle, 'fillColor'), false);
        assert.equal(Object.hasOwn(sampleStyleFromShape(new Path(pts, false, '#000000', 2, '#010101')), 'fillColor'), false);
    });
    it('線なし・塗りなしはnullのまま取り込む', () => {
        assert.deepEqual(sampleStyleFromShape(rect(null, 2, null)), { strokeColor: null, strokeWidth: 2, fillColor: null });
    });
    it('小数の太さ・色の文字列をそのまま取り込む', () => {
        assert.equal(sampleStyleFromShape(rect('#000000', 2.5)).strokeWidth, 2.5);
        for (const color of ['red', '#ABC', 'rgb(1,2,3)']) {
            const style = sampleStyleFromShape(rect(color, 2, color));
            assert.equal(style.strokeColor, color);
            assert.equal(style.fillColor, color);
        }
    });
    it('図形を書き換えず、呼ぶたびに新しいオブジェクトを返す', () => {
        const shape = rect('#ff0000', 3, 'red');
        const before = JSON.stringify(shape.toJSON());
        const first = sampleStyleFromShape(shape);
        const second = sampleStyleFromShape(shape);
        assert.equal(JSON.stringify(shape.toJSON()), before);
        assert.notEqual(first, second);
        assert.deepEqual(first, second);
    });
});
