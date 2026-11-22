/**
 * 責務：ScaleHandleRules（外枠のハンドルの出し方・位置・当たり・カーソルの向き・倍率と動かない点・スナップの当て方・変換の組み立て）の公開APIを検証する。
 * 期待値は固定の値で、手計算で確かめている（丸めの結果は`UnitSnapRules`の関数に任せ、本テストに丸め方を写さない）。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    SCALE_HANDLE_NAMES,
    SCALE_HANDLE_HIT_SCREEN_PX,
    SCALE_EDGE_HANDLE_MIN_SCREEN_PX,
    collectScaleFrame,
    collectFrameCorners,
    computeFrameCenter,
    hitTestScaleHandle,
    resolveScaleHandleCursor,
    computeBoundsScale,
    toScaleTransform
} from '../../js/core/ScaleHandleRules.js';
import { OperationMode } from '../../js/core/InputModes.js';

/** 基準の外枠（幅100・高さ50。中心(50, 25)）。 */
const B = Object.freeze({ minX: 0, minY: 0, maxX: 100, maxY: 50 });

/**
 * 2つの数値が許容量以内で等しいことを確かめる。
 * @param {number} actual 実際の値
 * @param {number} expected 期待値
 * @param {string} [label] 失敗時の説明
 * @returns {void}
 */
function assertClose(actual, expected, label = '') {
    assert.ok(Math.abs(actual - expected) <= 1e-9, `${label} actual=${actual} expected=${expected}`);
}

/**
 * `computeBoundsScale`の結果が期待の4値と許容量以内で等しいことを確かめる。
 * @param {{scaleX: number, scaleY: number, originX: number, originY: number}} result 実際の結果
 * @param {number[]} expected 期待値の配列`[scaleX, scaleY, originX, originY]`
 * @returns {void}
 */
function assertScale(result, expected) {
    assertClose(result.scaleX, expected[0], 'scaleX');
    assertClose(result.scaleY, expected[1], 'scaleY');
    assertClose(result.originX, expected[2], 'originX');
    assertClose(result.originY, expected[3], 'originY');
}

/**
 * `computeBoundsScale`を既定値（外枠B・修飾キーなし・丸めなし・直前の倍率1）で呼ぶ。
 * @param {Object} overrides 上書きする入力
 * @returns {{scaleX: number, scaleY: number, originX: number, originY: number}} 結果
 */
function scaleOf(overrides) {
    return computeBoundsScale({
        handle: 'se',
        bounds: B,
        pointer: { x: 0, y: 0 },
        keepAspect: false,
        fromCenter: false,
        step: null,
        previous: { scaleX: 1, scaleY: 1 },
        ...overrides
    });
}

/**
 * 外枠のハンドル名の並びを返す。
 * @param {{handles: {name: string}[]}} frame 外枠
 * @returns {string[]} ハンドル名の並び
 */
function names(frame) {
    return frame.handles.map((h) => h.name);
}

describe('定数', () => {
    it('ハンドル名・当たりの半分・辺のハンドルの下限', () => {
        assert.deepEqual({ ...SCALE_HANDLE_NAMES }, {
            NW: 'nw', N: 'n', NE: 'ne', E: 'e', SE: 'se', S: 's', SW: 'sw', W: 'w'
        });
        assert.ok(Object.isFrozen(SCALE_HANDLE_NAMES));
        assert.equal(SCALE_HANDLE_HIT_SCREEN_PX, 6);
        assert.equal(SCALE_EDGE_HANDLE_MIN_SCREEN_PX, 24);
    });
});

describe('collectScaleFrame：8つのハンドルの位置と並び', () => {
    it('幅100・高さ50・倍率1：辺→角の順で8つ、位置は外枠の辺の中央・四隅', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, B, 1);
        assert.deepEqual(frame.handles, [
            { name: 'n', x: 50, y: 0 },
            { name: 'e', x: 100, y: 25 },
            { name: 's', x: 50, y: 50 },
            { name: 'w', x: 0, y: 25 },
            { name: 'nw', x: 0, y: 0 },
            { name: 'ne', x: 100, y: 0 },
            { name: 'se', x: 100, y: 50 },
            { name: 'sw', x: 0, y: 50 }
        ]);
        assert.deepEqual(frame.bounds, { minX: 0, minY: 0, maxX: 100, maxY: 50 });
    });

    it('外枠が原点以外・負の座標でも位置は辺の中央・四隅', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: -20, minY: 10, maxX: 40, maxY: 40 }, 1);
        assert.deepEqual(frame.handles, [
            { name: 'n', x: 10, y: 10 },
            { name: 'e', x: 40, y: 25 },
            { name: 's', x: 10, y: 40 },
            { name: 'w', x: -20, y: 25 },
            { name: 'nw', x: -20, y: 10 },
            { name: 'ne', x: 40, y: 10 },
            { name: 'se', x: 40, y: 40 },
            { name: 'sw', x: -20, y: 40 }
        ]);
    });

    it('bounds は新しいオブジェクトに写され、引数を書き換えない', () => {
        const input = { minX: 0, minY: 0, maxX: 100, maxY: 50 };
        const frame = collectScaleFrame(OperationMode.SELECT, input, 1);
        assert.notEqual(frame.bounds, input);
        frame.bounds.minX = 999;
        assert.deepEqual(input, { minX: 0, minY: 0, maxX: 100, maxY: 50 });
    });
});

describe('collectScaleFrame：小さい外枠（24px）', () => {
    it('辺の長さがちょうど24px（幅24・倍率1）なら辺のハンドルも出す', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 0, maxX: 24, maxY: 24 }, 1);
        assert.deepEqual(names(frame), ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw']);
    });

    it('幅だけが24px未満（23.5）なら n・s が消え、高さ100の e・w は残る', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 0, maxX: 23.5, maxY: 100 }, 1);
        assert.deepEqual(names(frame), ['e', 'w', 'nw', 'ne', 'se', 'sw']);
    });

    it('高さだけが24px未満（23.5）なら e・w が消え、幅100の n・s は残る', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 0, maxX: 100, maxY: 23.5 }, 1);
        assert.deepEqual(names(frame), ['n', 's', 'nw', 'ne', 'se', 'sw']);
    });

    it('両方24px未満なら角の4つだけ', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 0, maxX: 10, maxY: 10 }, 1);
        assert.deepEqual(names(frame), ['nw', 'ne', 'se', 'sw']);
    });

    it('表示倍率で変わる：幅100・高さ50で倍率0.5は50px・25pxで全部、倍率0.4は40px・20pxで n・s だけ', () => {
        assert.deepEqual(names(collectScaleFrame(OperationMode.SELECT, B, 0.5)),
            ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw']);
        assert.deepEqual(names(collectScaleFrame(OperationMode.SELECT, B, 0.4)),
            ['n', 's', 'nw', 'ne', 'se', 'sw']);
    });

    it('表示倍率で変わる：幅12・高さ12は倍率2（24px）で全部、倍率1（12px）で角だけ', () => {
        const small = { minX: 0, minY: 0, maxX: 12, maxY: 12 };
        assert.deepEqual(names(collectScaleFrame(OperationMode.SELECT, small, 2)),
            ['n', 'e', 's', 'w', 'nw', 'ne', 'se', 'sw']);
        assert.deepEqual(names(collectScaleFrame(OperationMode.SELECT, small, 1)),
            ['nw', 'ne', 'se', 'sw']);
    });
});

describe('collectScaleFrame：幅か高さが0・両方0', () => {
    it('幅0（高さ50）：n・s だけ（角と e・w は出さない）。24px未満でも出す', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: 10, minY: 0, maxX: 10, maxY: 50 }, 0.1);
        assert.deepEqual(frame.handles, [
            { name: 'n', x: 10, y: 0 },
            { name: 's', x: 10, y: 50 }
        ]);
    });

    it('高さ0（幅100）：e・w だけ（角と n・s は出さない）', () => {
        const frame = collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 5, maxX: 100, maxY: 5 }, 1);
        assert.deepEqual(frame.handles, [
            { name: 'e', x: 100, y: 5 },
            { name: 'w', x: 0, y: 5 }
        ]);
    });

    it('幅も高さも0：null（外枠もハンドルも出さない）', () => {
        assert.equal(collectScaleFrame(OperationMode.SELECT, { minX: 5, minY: 5, maxX: 5, maxY: 5 }, 1), null);
    });
});

describe('collectScaleFrame：出さない条件', () => {
    it('選択モード以外（作成・頂点の選択・パン）は null', () => {
        assert.equal(collectScaleFrame(OperationMode.VERTEX, B, 1), null);
        assert.equal(collectScaleFrame(OperationMode.PAN, B, 1), null);
        assert.equal(collectScaleFrame(OperationMode.CREATE, B, 1), null);
        assert.equal(collectScaleFrame(undefined, B, 1), null);
    });

    it('bounds が null・値が有限でない場合は null', () => {
        assert.equal(collectScaleFrame(OperationMode.SELECT, null, 1), null);
        assert.equal(collectScaleFrame(OperationMode.SELECT, { minX: NaN, minY: 0, maxX: 10, maxY: 10 }, 1), null);
        assert.equal(collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 0, maxX: Infinity, maxY: 10 }, 1), null);
    });

    it('viewScale が正の有限の数値でない場合は null', () => {
        assert.equal(collectScaleFrame(OperationMode.SELECT, B, 0), null);
        assert.equal(collectScaleFrame(OperationMode.SELECT, B, -1), null);
        assert.equal(collectScaleFrame(OperationMode.SELECT, B, NaN), null);
        assert.equal(collectScaleFrame(OperationMode.SELECT, B, Infinity), null);
        assert.equal(collectScaleFrame(OperationMode.SELECT, B, '1'), null);
    });
});

describe('hitTestScaleHandle：当たり', () => {
    const frame = collectScaleFrame(OperationMode.SELECT, B, 1);

    it('ハンドルの中心は当たる（8つとも）', () => {
        assert.equal(hitTestScaleHandle(frame, { x: 50, y: 0 }, 1), 'n');
        assert.equal(hitTestScaleHandle(frame, { x: 100, y: 25 }, 1), 'e');
        assert.equal(hitTestScaleHandle(frame, { x: 50, y: 50 }, 1), 's');
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 25 }, 1), 'w');
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 0 }, 1), 'nw');
        assert.equal(hitTestScaleHandle(frame, { x: 100, y: 0 }, 1), 'ne');
        assert.equal(hitTestScaleHandle(frame, { x: 100, y: 50 }, 1), 'se');
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 50 }, 1), 'sw');
    });

    it('倍率1：半分6の境界（6は当たり、6.5は外れ。縦横とも）', () => {
        assert.equal(hitTestScaleHandle(frame, { x: 6, y: 0 }, 1), 'nw');
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 6 }, 1), 'nw');
        assert.equal(hitTestScaleHandle(frame, { x: -6, y: -6 }, 1), 'nw');
        assert.equal(hitTestScaleHandle(frame, { x: 6.5, y: 0 }, 1), null);
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 6.5 }, 1), null);
    });

    it('倍率2：半分は 6/2 = 3（3は当たり、3.5は外れ）', () => {
        assert.equal(hitTestScaleHandle(frame, { x: 3, y: 0 }, 2), 'nw');
        assert.equal(hitTestScaleHandle(frame, { x: 3.5, y: 0 }, 2), null);
    });

    it('ハンドルの無い場所（外枠の内側・外）は null', () => {
        assert.equal(hitTestScaleHandle(frame, { x: 30, y: 25 }, 1), null);
        assert.equal(hitTestScaleHandle(frame, { x: 200, y: 200 }, 1), null);
    });

    it('重なったとき後ろ（角）が優先：n と nw が同じ位置の frame', () => {
        const overlap = {
            bounds: B,
            handles: [{ name: 'n', x: 0, y: 0 }, { name: 'nw', x: 0, y: 0 }]
        };
        assert.equal(hitTestScaleHandle(overlap, { x: 0, y: 0 }, 1), 'nw');
    });

    it('小さい外枠（2×2・倍率1）で角が互いに重なるときは、並びの最後（sw）が優先', () => {
        const small = collectScaleFrame(OperationMode.SELECT, { minX: 0, minY: 0, maxX: 2, maxY: 2 }, 1);
        assert.equal(hitTestScaleHandle(small, { x: 1, y: 1 }, 1), 'sw');
    });

    it('frame が null・viewScale が正の有限でない場合は null', () => {
        assert.equal(hitTestScaleHandle(null, { x: 0, y: 0 }, 1), null);
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 0 }, 0), null);
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 0 }, -1), null);
        assert.equal(hitTestScaleHandle(frame, { x: 0, y: 0 }, NaN), null);
    });
});

describe('resolveScaleHandleCursor：カーソルの向き', () => {
    it('角・辺の向き', () => {
        assert.equal(resolveScaleHandleCursor('nw'), 'nwse-resize');
        assert.equal(resolveScaleHandleCursor('se'), 'nwse-resize');
        assert.equal(resolveScaleHandleCursor('ne'), 'nesw-resize');
        assert.equal(resolveScaleHandleCursor('sw'), 'nesw-resize');
        assert.equal(resolveScaleHandleCursor('e'), 'ew-resize');
        assert.equal(resolveScaleHandleCursor('w'), 'ew-resize');
        assert.equal(resolveScaleHandleCursor('n'), 'ns-resize');
        assert.equal(resolveScaleHandleCursor('s'), 'ns-resize');
    });

    it('null・未知の値・省略は null', () => {
        assert.equal(resolveScaleHandleCursor(null), null);
        assert.equal(resolveScaleHandleCursor('x'), null);
        assert.equal(resolveScaleHandleCursor(''), null);
        assert.equal(resolveScaleHandleCursor(undefined), null);
    });
});

describe('computeBoundsScale：角（修飾キーなし）', () => {
    it('se：動かない点は左上(0,0)。(150,100)→{1.5, 2}', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: 150, y: 100 } }), [1.5, 2, 0, 0]);
    });

    it('nw：動かない点は右下(100,50)。(50,0)→rawX=(50-100)/(0-100)=0.5, rawY=(0-50)/(0-50)=1', () => {
        assertScale(scaleOf({ handle: 'nw', pointer: { x: 50, y: 0 } }), [0.5, 1, 100, 50]);
    });

    it('ne：動かない点は左下(0,50)。(200,25)→rawX=2, rawY=(25-50)/(0-50)=0.5', () => {
        assertScale(scaleOf({ handle: 'ne', pointer: { x: 200, y: 25 } }), [2, 0.5, 0, 50]);
    });

    it('sw：動かない点は右上(100,0)。(0,100)→rawX=(0-100)/(0-100)=1, rawY=100/50=2', () => {
        assertScale(scaleOf({ handle: 'sw', pointer: { x: 0, y: 100 } }), [1, 2, 100, 0]);
    });

    it('引き始めの位置（ハンドルの位置そのもの）は倍率1', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: 100, y: 50 } }), [1, 1, 0, 0]);
    });
});

describe('computeBoundsScale：辺（修飾キーなし）', () => {
    it('e：横だけ。動かない点は左辺x=0・縦は中心25。(150, 999)→{1.5, 1}', () => {
        assertScale(scaleOf({ handle: 'e', pointer: { x: 150, y: 999 } }), [1.5, 1, 0, 25]);
    });

    it('w：横だけ。動かない点は右辺x=100。(50, 999)→raw=(50-100)/(0-100)=0.5', () => {
        assertScale(scaleOf({ handle: 'w', pointer: { x: 50, y: 999 } }), [0.5, 1, 100, 25]);
    });

    it('n：縦だけ。動かない点は下辺y=50・横は中心50。(999, 25)→raw=(25-50)/(0-50)=0.5', () => {
        assertScale(scaleOf({ handle: 'n', pointer: { x: 999, y: 25 } }), [1, 0.5, 50, 50]);
    });

    it('s：縦だけ。動かない点は上辺y=0。(999, 100)→raw=100/50=2', () => {
        assertScale(scaleOf({ handle: 's', pointer: { x: 999, y: 100 } }), [1, 2, 50, 0]);
    });
});

describe('computeBoundsScale：Shift（比率を保つ）', () => {
    it('se：横の動きの割合が大きい。(150,60)→rawX=1.5, rawY=1.2 → 横にそろえて {1.5, 1.5}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 150, y: 60 } }), [1.5, 1.5, 0, 0]);
    });

    it('se：縦の動きの割合が大きい。(110,100)→rawX=1.1, rawY=2 → 縦にそろえて {2, 2}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 110, y: 100 } }), [2, 2, 0, 0]);
    });

    it('se：割合が同じなら横。(150,75)→rawX=1.5, rawY=1.5 → {1.5, 1.5}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 150, y: 75 } }), [1.5, 1.5, 0, 0]);
    });

    it('se：縮めるとき。(50,45)→rawX=0.5, rawY=0.9 → |rawX-1|=0.5 が大きい横にそろえて {0.5, 0.5}（倍率の大きいほうの0.9ではない）', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 50, y: 45 } }), [0.5, 0.5, 0, 0]);
    });

    it('nw：(0,0)から(-50,-25)→rawX=1.5, rawY=1.5 → {1.5, 1.5}、動かない点は(100,50)', () => {
        assertScale(scaleOf({ handle: 'nw', keepAspect: true, pointer: { x: -50, y: -25 } }), [1.5, 1.5, 100, 50]);
    });

    it('辺 e：もう一方の向きも同じ割合（|s|）。(150,…)→{1.5, 1.5}、縦の動かない点は中心25', () => {
        assertScale(scaleOf({ handle: 'e', keepAspect: true, pointer: { x: 150, y: 999 } }), [1.5, 1.5, 0, 25]);
    });

    it('辺 n：もう一方の向きも同じ割合。(…,-50)→raw=(-50-50)/(0-50)=2 → {2, 2}、横の動かない点は中心50', () => {
        assertScale(scaleOf({ handle: 'n', keepAspect: true, pointer: { x: 999, y: -50 } }), [2, 2, 50, 50]);
    });

    it('辺 e で裏返す：(-50,…)→s=-0.5。もう一方は裏返らず |s| = 0.5 → {-0.5, 0.5}', () => {
        assertScale(scaleOf({ handle: 'e', keepAspect: true, pointer: { x: -50, y: 0 } }), [-0.5, 0.5, 0, 25]);
    });

    it('高さ0の外枠の辺 e：もう一方の向きは伸ばさない（1のまま）。(200,…)→{2, 1}', () => {
        const flat = { minX: 0, minY: 5, maxX: 100, maxY: 5 };
        assertScale(scaleOf({ handle: 'e', bounds: flat, keepAspect: true, pointer: { x: 200, y: 99 } }), [2, 1, 0, 5]);
    });

    it('幅0の外枠の辺 s：もう一方の向きは伸ばさない（1のまま）。(…,100)→{1, 2}', () => {
        const tall = { minX: 10, minY: 0, maxX: 10, maxY: 50 };
        assertScale(scaleOf({ handle: 's', bounds: tall, keepAspect: true, pointer: { x: 99, y: 100 } }), [1, 2, 10, 0]);
    });
});

describe('computeBoundsScale：Alt（中心を動かさない）', () => {
    it('se：動かない点は中心(50,25)。(150,50)→rawX=100/50=2, rawY=25/25=1 → {2, 1}', () => {
        assertScale(scaleOf({ handle: 'se', fromCenter: true, pointer: { x: 150, y: 50 } }), [2, 1, 50, 25]);
    });

    it('nw：中心基準。(0,0)から(-50,-25)→rawX=(-50-50)/(0-50)=2, rawY=(-25-25)/(0-25)=2 → {2, 2}', () => {
        assertScale(scaleOf({ handle: 'nw', fromCenter: true, pointer: { x: -50, y: -25 } }), [2, 2, 50, 25]);
    });

    it('辺 e：横だけ。(150,…)→{2, 1}、動かない点は中心(50,25)', () => {
        assertScale(scaleOf({ handle: 'e', fromCenter: true, pointer: { x: 150, y: 999 } }), [2, 1, 50, 25]);
    });

    it('辺 n：縦だけ。(…,-25)→raw=(-25-25)/(0-25)=2 → {1, 2}、動かない点は中心(50,25)', () => {
        assertScale(scaleOf({ handle: 'n', fromCenter: true, pointer: { x: 999, y: -25 } }), [1, 2, 50, 25]);
    });

    it('辺 w で中心を越える：(100,…)→raw=(100-50)/(0-50)=-1 → {-1, 1}', () => {
        assertScale(scaleOf({ handle: 'w', fromCenter: true, pointer: { x: 100, y: 0 } }), [-1, 1, 50, 25]);
    });
});

describe('computeBoundsScale：Shift+Alt', () => {
    it('se：中心基準で比率を保つ。(150,50)→rawX=2, rawY=1 → 横にそろえて {2, 2}、動かない点は中心', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, fromCenter: true, pointer: { x: 150, y: 50 } }), [2, 2, 50, 25]);
    });

    it('se：縦の割合が大きい。(60,75)→rawX=10/50=0.2, rawY=50/25=2 → |rawY-1|=1 が大きい縦にそろえて {2, 2}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, fromCenter: true, pointer: { x: 60, y: 75 } }), [2, 2, 50, 25]);
    });

    it('辺 e：中心基準でもう一方も同じ割合。(150,…)→{2, 2}、動かない点は中心', () => {
        assertScale(scaleOf({ handle: 'e', keepAspect: true, fromCenter: true, pointer: { x: 150, y: 999 } }), [2, 2, 50, 25]);
    });
});

describe('computeBoundsScale：裏返り', () => {
    it('横：se を左へ越える。(-100,100)→rawX=-1, rawY=2 → {-1, 2}', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: -100, y: 100 } }), [-1, 2, 0, 0]);
    });

    it('縦：se を上へ越える。(200,-50)→rawX=2, rawY=-1 → {2, -1}', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: 200, y: -50 } }), [2, -1, 0, 0]);
    });

    it('両方：se を左上へ越える。(-50,-25)→rawX=-0.5, rawY=-0.5 → {-0.5, -0.5}', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: -50, y: -25 } }), [-0.5, -0.5, 0, 0]);
    });

    it('辺 e：左へ越える。(-100,…)→{-1, 1}。辺 s：上へ越える。(…,-50)→{1, -1}', () => {
        assertScale(scaleOf({ handle: 'e', pointer: { x: -100, y: 0 } }), [-1, 1, 0, 25]);
        assertScale(scaleOf({ handle: 's', pointer: { x: 0, y: -50 } }), [1, -1, 50, 0]);
    });

    it('Shift の角：横にそろう裏返し。(-50,60)→rawX=-0.5, rawY=1.2 → m=0.5、符号(-,+) → {-0.5, 0.5}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: -50, y: 60 } }), [-0.5, 0.5, 0, 0]);
    });

    it('Shift の角：両方の裏返し。(-50,-25)→rawX=-0.5, rawY=-0.5 → {-0.5, -0.5}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: -50, y: -25 } }), [-0.5, -0.5, 0, 0]);
    });

    it('Shift の角：縦にそろう裏返し。(110,-50)→rawX=1.1, rawY=-1 → m=1、符号(+,-) → {1, -1}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 110, y: -50 } }), [1, -1, 0, 0]);
    });
});

describe('computeBoundsScale：大きさがちょうど0になる位置（直前の形のまま）', () => {
    const previous = { scaleX: 0.5, scaleY: 2 };

    it('辺 e：カーソルが動かない点と同じx（0）→ 直前の scaleX=0.5、もう一方は1', () => {
        assertScale(scaleOf({ handle: 'e', pointer: { x: 0, y: 30 }, previous }), [0.5, 1, 0, 25]);
    });

    it('辺 s：カーソルが動かない点と同じy（0）→ 直前の scaleY=2', () => {
        assertScale(scaleOf({ handle: 's', pointer: { x: 30, y: 0 }, previous }), [1, 2, 50, 0]);
    });

    it('角（Shiftなし）：x だけ0 → x は直前の0.5、y は raw=2。(0,100)→{0.5, 2}', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: 0, y: 100 }, previous }), [0.5, 2, 0, 0]);
    });

    it('角（Shiftなし）：y だけ0 → y は直前の2、x は raw=1.5。(150,0)→{1.5, 2}', () => {
        assertScale(scaleOf({ handle: 'se', pointer: { x: 150, y: 0 }, previous }), [1.5, 2, 0, 0]);
    });

    it('辺 e（Shift）：x が0 → 直前の0.5、もう一方も |0.5|。(0,…)→{0.5, 0.5}', () => {
        assertScale(scaleOf({ handle: 'e', keepAspect: true, pointer: { x: 0, y: 0 }, previous: { scaleX: 0.5, scaleY: 0.5 } }),
            [0.5, 0.5, 0, 25]);
    });

    it('角（Shift）：倍率を決める向きが0 → 両方とも直前のまま。(0,60)→rawX=0（|-1|）, rawY=1.2（0.2）→ 横が決める → {0.5, 2}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 0, y: 60 }, previous }), [0.5, 2, 0, 0]);
    });

    it('角（Shift）：縦が決める向きで縦が0 → 両方とも直前のまま。(150,0)→rawX=1.5（0.5）, rawY=0（|-1|）→ {0.5, 2}', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 150, y: 0 }, previous }), [0.5, 2, 0, 0]);
    });

    it('角（Shift）：決める向きは0でなく、もう一方の raw がちょうど0 → その軸の符号は直前の符号。(0,150)→rawX=0, rawY=3 → m=3', () => {
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 0, y: 150 }, previous: { scaleX: -0.5, scaleY: 2 } }),
            [-3, 3, 0, 0]);
        assertScale(scaleOf({ handle: 'se', keepAspect: true, pointer: { x: 0, y: 150 }, previous: { scaleX: 1, scaleY: 1 } }),
            [3, 3, 0, 0]);
    });
});

describe('computeBoundsScale：幅か高さが0の向き', () => {
    const tall = { minX: 10, minY: 0, maxX: 10, maxY: 50 };
    const flat = { minX: 0, minY: 5, maxX: 100, maxY: 5 };

    it('幅0：角 se でも横は引かず倍率1・動かない点は中心x=10。(200,100)→{1, 2}', () => {
        assertScale(scaleOf({ handle: 'se', bounds: tall, pointer: { x: 200, y: 100 } }), [1, 2, 10, 0]);
    });

    it('幅0：Shift の角でも横は1のまま（縦だけ変わる）。(200,100)→{1, 2}', () => {
        assertScale(scaleOf({ handle: 'se', bounds: tall, keepAspect: true, pointer: { x: 200, y: 100 } }), [1, 2, 10, 0]);
    });

    it('幅0：辺 e は引く軸が無く {1, 1}、動かない点は中心(10, 25)', () => {
        assertScale(scaleOf({ handle: 'e', bounds: tall, pointer: { x: 200, y: 100 } }), [1, 1, 10, 25]);
    });

    it('高さ0：辺 e は横だけ。(200,…)→{2, 1}、縦の動かない点は y=5', () => {
        assertScale(scaleOf({ handle: 'e', bounds: flat, pointer: { x: 200, y: 99 } }), [2, 1, 0, 5]);
    });

    it('高さ0：辺 n は引く軸が無く {1, 1}、動かない点は中心(50, 5)', () => {
        assertScale(scaleOf({ handle: 'n', bounds: flat, pointer: { x: 200, y: 99 } }), [1, 1, 50, 5]);
    });

    it('高さ0：Alt の辺 e は横だけ中心基準。(150,…)→{2, 1}、動かない点は(50, 5)', () => {
        assertScale(scaleOf({ handle: 'e', bounds: flat, fromCenter: true, pointer: { x: 150, y: 99 } }), [2, 1, 50, 5]);
    });
});

describe('computeBoundsScale：スナップ（刻み10）', () => {
    it('角（Shiftなし）：引いている角の位置を目へ。(143,57)→目標(140,60) → {1.4, 1.2}', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, pointer: { x: 143, y: 57 } }), [1.4, 1.2, 0, 0]);
    });

    it('刻みが null なら丸めない。(143,57)→{1.43, 1.14}', () => {
        assertScale(scaleOf({ handle: 'se', step: null, pointer: { x: 143, y: 57 } }), [1.43, 1.14, 0, 0]);
    });

    it('刻みが0・負・NaN など丸めに使えない値でも丸めない（UnitSnapRulesの規則どおり）', () => {
        assertScale(scaleOf({ handle: 'se', step: 0, pointer: { x: 143, y: 57 } }), [1.43, 1.14, 0, 0]);
        assertScale(scaleOf({ handle: 'se', step: -10, pointer: { x: 143, y: 57 } }), [1.43, 1.14, 0, 0]);
    });

    it('辺 e：引く軸だけ丸め、もう一方は1。(143,57)→{1.4, 1}', () => {
        assertScale(scaleOf({ handle: 'e', step: 10, pointer: { x: 143, y: 57 } }), [1.4, 1, 0, 25]);
    });

    it('辺 s：引く軸だけ丸める。(143,57)→目標y=60 → {1, 1.2}', () => {
        assertScale(scaleOf({ handle: 's', step: 10, pointer: { x: 143, y: 57 } }), [1, 1.2, 50, 0]);
    });

    it('Shift の角：倍率を決めた向き（横）だけ丸める。(143,57)→rawX=1.43, rawY=1.14 → 目標x=140 → {1.4, 1.4}', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, keepAspect: true, pointer: { x: 143, y: 57 } }), [1.4, 1.4, 0, 0]);
    });

    it('Shift の角：倍率を決めた向き（縦）だけ丸める。(101,87)→rawX=1.01, rawY=1.74 → 目標y=90 → {1.8, 1.8}', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, keepAspect: true, pointer: { x: 101, y: 87 } }), [1.8, 1.8, 0, 0]);
    });

    it('Shift の角：raw は正でも丸めた目標が動かない点の反対側なら、倍率を決めた向きの符号は丸めた後の s から（Shiftなしと同じ裏返り）。外枠x[10.5,110.5]・(12,50)→rawX=0.015, rawY=1 → 目標x=10 → s=(10-10.5)/100=-0.005、縦はrawY>0で+ → {-0.005, 0.005, 10.5, 0}', () => {
        const bounds = { minX: 10.5, minY: 0, maxX: 110.5, maxY: 50 };
        assertScale(scaleOf({ handle: 'se', bounds, step: 10, keepAspect: true, pointer: { x: 12, y: 50 } }), [-0.005, 0.005, 10.5, 0]);
        assertScale(scaleOf({ handle: 'se', bounds, step: 10, keepAspect: false, pointer: { x: 12, y: 50 } }), [-0.005, 1, 10.5, 0]);
    });

    it('Shift の辺 e：引く軸を丸めてもう一方が同じ割合。(143,…)→{1.4, 1.4}', () => {
        assertScale(scaleOf({ handle: 'e', step: 10, keepAspect: true, pointer: { x: 143, y: 0 } }), [1.4, 1.4, 0, 25]);
    });

    it('Alt の角：中心基準で目標の位置を丸める。(143,57)→目標(140,60) → sX=(140-50)/50=1.8, sY=(60-25)/25=1.4', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, fromCenter: true, pointer: { x: 143, y: 57 } }), [1.8, 1.4, 50, 25]);
    });

    it('Shift+Alt の角：決めた向き（横）だけ丸める。(143,57)→rawX=(143-50)/50=1.86, rawY=(57-25)/25=1.28 → 目標x=140 → s=1.8 → {1.8, 1.8}', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, keepAspect: true, fromCenter: true, pointer: { x: 143, y: 57 } }), [1.8, 1.8, 50, 25]);
    });

    it('外枠の辺がもともと半端な位置（minX=10.5）でも、引いた辺が目へそろう（刻み1・(110.5,50)→目標x=111 → s=(111-10.5)/100=1.005）', () => {
        const odd = { minX: 10.5, minY: 0, maxX: 110.5, maxY: 50 };
        assertScale(scaleOf({ handle: 'se', bounds: odd, step: 1, pointer: { x: 110.5, y: 50 } }), [1.005, 1, 10.5, 0]);
    });

    it('外枠の辺がもともと半端な位置：動かない辺は動かさず（origin=10.5）、丸めない場合は raw のまま {1, 1}', () => {
        const odd = { minX: 10.5, minY: 0, maxX: 110.5, maxY: 50 };
        assertScale(scaleOf({ handle: 'se', bounds: odd, step: null, pointer: { x: 110.5, y: 50 } }), [1, 1, 10.5, 0]);
    });

    it('丸めた結果がちょうど0（目標が動かない点と同じ）→ 直前の形。(4,100)→目標x=0 → x は直前の0.5、y は目標100で2', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, pointer: { x: 4, y: 100 }, previous: { scaleX: 0.5, scaleY: 2 } }), [0.5, 2, 0, 0]);
    });

    it('Shift の角で丸めた結果がちょうど0 → 両方とも直前のまま。(4,60)→rawX=0.04, rawY=1.2 → 横が決め目標x=0 → {0.5, 2}', () => {
        assertScale(scaleOf({ handle: 'se', step: 10, keepAspect: true, pointer: { x: 4, y: 60 }, previous: { scaleX: 0.5, scaleY: 2 } }),
            [0.5, 2, 0, 0]);
    });
});

describe('computeBoundsScale：入力の検証・不変', () => {
    it('未知のハンドル名は Error', () => {
        assert.throws(() => scaleOf({ handle: 'x' }), /未知のハンドル名/);
        assert.throws(() => scaleOf({ handle: null }), Error);
    });

    it('引数を書き換えず、戻り値は毎回新しいオブジェクト', () => {
        const input = Object.freeze({
            handle: 'se',
            bounds: Object.freeze({ minX: 0, minY: 0, maxX: 100, maxY: 50 }),
            pointer: Object.freeze({ x: 143, y: 57 }),
            keepAspect: true,
            fromCenter: true,
            step: 10,
            previous: Object.freeze({ scaleX: 1, scaleY: 1 })
        });
        const a = computeBoundsScale(input);
        const b = computeBoundsScale(input);
        assert.notEqual(a, b);
        assert.deepEqual(a, b);
        assert.deepEqual(input.pointer, { x: 143, y: 57 });
    });
});

describe('toScaleTransform：変換の組み立て', () => {
    it('動かない点(10,20)・{2, -1}：e=10-2*10=-10, f=20-(-1)*20=40', () => {
        assert.deepEqual(
            toScaleTransform({ scaleX: 2, scaleY: -1, originX: 10, originY: 20 }),
            { a: 2, b: 0, c: 0, d: -1, e: -10, f: 40 }
        );
    });

    it('外枠{10,20,30,60}の4隅の写り先：(10,20)は動かず、(30,20)→(50,20)、(30,60)→(50,-20)、(10,60)→(10,-20)', () => {
        const t = toScaleTransform({ scaleX: 2, scaleY: -1, originX: 10, originY: 20 });
        const apply = (x, y) => ({ x: t.a * x + t.c * y + t.e, y: t.b * x + t.d * y + t.f });
        assert.deepEqual(apply(10, 20), { x: 10, y: 20 });
        assert.deepEqual(apply(30, 20), { x: 50, y: 20 });
        assert.deepEqual(apply(30, 60), { x: 50, y: -20 });
        assert.deepEqual(apply(10, 60), { x: 10, y: -20 });
    });

    it('computeBoundsScale の結果と合わせると、引いた se の角がカーソル位置へ写る：(100,50)→(150,100)', () => {
        const t = toScaleTransform(scaleOf({ handle: 'se', pointer: { x: 150, y: 100 } }));
        assert.deepEqual(t, { a: 1.5, b: 0, c: 0, d: 2, e: 0, f: 0 });
        assertClose(t.a * 100 + t.e, 150);
        assertClose(t.d * 50 + t.f, 100);
    });

    it('引数を書き換えず、新しいオブジェクトを返す', () => {
        const scale = Object.freeze({ scaleX: 1.5, scaleY: 2, originX: 0, originY: 0 });
        const a = toScaleTransform(scale);
        const b = toScaleTransform(scale);
        assert.notEqual(a, b);
        assert.deepEqual(scale, { scaleX: 1.5, scaleY: 2, originX: 0, originY: 0 });
    });
});

describe('collectFrameCorners：外枠の角の位置', () => {
    it('nw・ne・se・swの順で位置を返す', () => {
        assert.deepEqual(collectFrameCorners(B), [
            { name: 'nw', x: 0, y: 0 },
            { name: 'ne', x: 100, y: 0 },
            { name: 'se', x: 100, y: 50 },
            { name: 'sw', x: 0, y: 50 }
        ]);
    });

    it('幅0・高さ0でも4つ返す', () => {
        const corners = collectFrameCorners({ minX: 5, minY: 7, maxX: 5, maxY: 7 });
        assert.equal(corners.length, 4);
        assert.deepEqual(corners.map(c => c.name), ['nw', 'ne', 'se', 'sw']);
        assert.ok(corners.every(c => c.x === 5 && c.y === 7));
    });

    it('毎回新しいオブジェクトを返し、引数を書き換えない', () => {
        const a = collectFrameCorners(B);
        const b = collectFrameCorners(B);
        assert.notEqual(a, b);
        assert.notEqual(a[0], b[0]);
        assert.deepEqual(B, { minX: 0, minY: 0, maxX: 100, maxY: 50 });
    });
});

describe('computeFrameCenter：外枠の中心', () => {
    it('ちょうど表せる値の中心を返す', () => {
        assert.deepEqual(computeFrameCenter(B), { x: 50, y: 25 });
    });

    it('丸めの入る値でも(min + max) / 2と厳密に一致する', () => {
        const bounds = { minX: 0.1, minY: 0.2, maxX: 0.3, maxY: 0.7 };
        const c = computeFrameCenter(bounds);
        assert.equal(c.x, (0.1 + 0.3) / 2);
        assert.equal(c.y, (0.2 + 0.7) / 2);
    });

    it('毎回新しいオブジェクトを返し、引数を書き換えない', () => {
        const a = computeFrameCenter(B);
        const b = computeFrameCenter(B);
        assert.notEqual(a, b);
        assert.deepEqual(B, { minX: 0, minY: 0, maxX: 100, maxY: 50 });
    });
});
