/**
 * 責務: UnitSnapSettings（スナップの設定の保持・切り替え・変更通知）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { UnitSnapSettings, UnitSnapUnit, UNIT_SNAP_STEPS } from '../../js/core/UnitSnapSettings.js';

describe('UnitSnapSettings 定数', () => {
    test('単位の識別子と刻み', () => {
        assert.equal(UnitSnapUnit.PIXEL, 'pixel');
        assert.equal(UnitSnapUnit.GRID, 'grid');
        assert.equal(UNIT_SNAP_STEPS.pixel, 1);
        assert.equal(UNIT_SNAP_STEPS.grid, 10);
        assert.ok(Object.isFrozen(UnitSnapUnit));
        assert.ok(Object.isFrozen(UNIT_SNAP_STEPS));
    });
});

describe('UnitSnapSettings 初期値', () => {
    test('ON・1px', () => {
        const s = new UnitSnapSettings();
        assert.deepEqual(s.getState(), { enabled: true, unit: 'pixel', unitStep: 1 });
        assert.equal(s.getActiveStep(), 1);
    });

    test('getState は新しいオブジェクトを返し、書き換えても内部は変わらない', () => {
        const s = new UnitSnapSettings();
        const a = s.getState();
        a.enabled = false;
        a.unit = 'grid';
        a.unitStep = 99;
        assert.notEqual(s.getState(), a);
        assert.deepEqual(s.getState(), { enabled: true, unit: 'pixel', unitStep: 1 });
    });
});

describe('UnitSnapSettings getActiveStep', () => {
    test('ONなら単位の値、OFFなら null', () => {
        const s = new UnitSnapSettings();
        s.setUnit('grid');
        assert.equal(s.getActiveStep(), 10);
        s.setEnabled(false);
        assert.equal(s.getActiveStep(), null);
        s.setUnit('pixel');
        assert.equal(s.getActiveStep(), null);
        s.setEnabled(true);
        assert.equal(s.getActiveStep(), 1);
    });

    test('OFFでも getState の unitStep は単位の値', () => {
        const s = new UnitSnapSettings();
        s.setEnabled(false);
        s.setUnit('grid');
        assert.deepEqual(s.getState(), { enabled: false, unit: 'grid', unitStep: 10 });
    });
});

describe('UnitSnapSettings setEnabled / toggleEnabled', () => {
    test('変わったときだけ通知1回', () => {
        const s = new UnitSnapSettings();
        let count = 0;
        s.onChange(() => { count++; });
        s.setEnabled(true);
        assert.equal(count, 0);
        s.setEnabled(false);
        assert.equal(count, 1);
        assert.equal(s.getState().enabled, false);
        s.setEnabled(false);
        assert.equal(count, 1);
    });

    test('toggleEnabled は反転し通知1回、単位は変えない', () => {
        const s = new UnitSnapSettings();
        s.setUnit('grid');
        let count = 0;
        s.onChange(() => { count++; });
        s.toggleEnabled();
        assert.equal(s.getState().enabled, false);
        assert.equal(s.getState().unit, 'grid');
        assert.equal(count, 1);
        s.toggleEnabled();
        assert.equal(s.getState().enabled, true);
        assert.equal(count, 2);
    });

    test('真偽値でない値は警告して何もしない（通知なし）', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const s = new UnitSnapSettings();
        let count = 0;
        s.onChange(() => { count++; });
        for (const v of [0, 1, 'true', null, undefined, {}]) {
            s.setEnabled(v);
        }
        assert.equal(s.getState().enabled, true);
        assert.equal(count, 0);
        assert.equal(warn.mock.callCount(), 6);
        assert.equal(
            warn.mock.calls[0].arguments[0],
            'UnitSnapSettings.setEnabled: 真偽値ではない値が指定されました: 0'
        );
    });
});

describe('UnitSnapSettings setUnit / toggleUnit', () => {
    test('変わったときだけ通知1回', () => {
        const s = new UnitSnapSettings();
        let count = 0;
        s.onChange(() => { count++; });
        s.setUnit('pixel');
        assert.equal(count, 0);
        s.setUnit('grid');
        assert.equal(count, 1);
        assert.equal(s.getState().unit, 'grid');
        s.setUnit('grid');
        assert.equal(count, 1);
    });

    test('toggleUnit は 1px⇄グリッドを入れ替え通知1回、ON/OFFは変えない', () => {
        const s = new UnitSnapSettings();
        s.setEnabled(false);
        let count = 0;
        s.onChange(() => { count++; });
        s.toggleUnit();
        assert.deepEqual(s.getState(), { enabled: false, unit: 'grid', unitStep: 10 });
        assert.equal(count, 1);
        s.toggleUnit();
        assert.deepEqual(s.getState(), { enabled: false, unit: 'pixel', unitStep: 1 });
        assert.equal(count, 2);
    });

    test('未知の単位は警告して何もしない（通知なし）', (t) => {
        const warn = t.mock.method(console, 'warn', () => {});
        const s = new UnitSnapSettings();
        let count = 0;
        s.onChange(() => { count++; });
        for (const v of ['px', 'GRID', 1, 10, null, undefined]) {
            s.setUnit(v);
        }
        assert.equal(s.getState().unit, 'pixel');
        assert.equal(count, 0);
        assert.equal(warn.mock.callCount(), 6);
        assert.equal(
            warn.mock.calls[0].arguments[0],
            'UnitSnapSettings.setUnit: 未知の単位が指定されました: px'
        );
    });
});

describe('UnitSnapSettings onChange', () => {
    test('関数以外は無視し、複数の登録は引数なしで順に呼ばれる', () => {
        const s = new UnitSnapSettings();
        s.onChange(null);
        s.onChange('x');
        const calls = [];
        s.onChange((...args) => { calls.push(['a', args.length]); });
        s.onChange((...args) => { calls.push(['b', args.length]); });
        s.toggleEnabled();
        assert.deepEqual(calls, [['a', 0], ['b', 0]]);
    });

    test('インスタンスごとに独立している', () => {
        const a = new UnitSnapSettings();
        const b = new UnitSnapSettings();
        let count = 0;
        b.onChange(() => { count++; });
        a.toggleEnabled();
        a.toggleUnit();
        assert.equal(count, 0);
        assert.deepEqual(b.getState(), { enabled: true, unit: 'pixel', unitStep: 1 });
    });
});
