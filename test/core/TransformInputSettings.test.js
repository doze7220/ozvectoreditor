/**
 * 責務: TransformInputSettings（基準点・縦横比の鍵の保持・切り替え・変更通知）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { TransformInputSettings } from '../../js/core/TransformInputSettings.js';
import { REFERENCE_POINT } from '../../js/core/ReferencePointRules.js';

/**
 * console.warn を一時的に捕捉して呼び出し回数を返す。
 * @param {Function} fn 実行する関数
 * @returns {number} warn の呼び出し回数
 */
function countWarns(fn) {
    const original = console.warn;
    let count = 0;
    console.warn = () => { count++; };
    try {
        fn();
    } finally {
        console.warn = original;
    }
    return count;
}

describe('TransformInputSettings 初期値', () => {
    test('中心・鍵は外れている', () => {
        const s = new TransformInputSettings();
        assert.deepEqual(s.getState(), { referencePoint: 'center', aspectLocked: false });
        assert.equal(s.getReferencePoint(), REFERENCE_POINT.CENTER);
        assert.equal(s.isAspectLocked(), false);
    });

    test('getState は毎回新しいオブジェクトを返し、書き換えても内部は変わらない', () => {
        const s = new TransformInputSettings();
        const a = s.getState();
        a.referencePoint = 'nw';
        a.aspectLocked = true;
        const b = s.getState();
        assert.notEqual(a, b);
        assert.deepEqual(b, { referencePoint: 'center', aspectLocked: false });
    });
});

describe('TransformInputSettings 基準点', () => {
    test('変えると1回通知する', () => {
        const s = new TransformInputSettings();
        let n = 0;
        s.onChange(() => { n++; });
        s.setReferencePoint(REFERENCE_POINT.SE);
        assert.equal(s.getReferencePoint(), REFERENCE_POINT.SE);
        assert.equal(n, 1);
    });

    test('同じ値は通知しない', () => {
        const s = new TransformInputSettings();
        let n = 0;
        s.onChange(() => { n++; });
        s.setReferencePoint(REFERENCE_POINT.CENTER);
        assert.equal(n, 0);
    });

    test('未知の値は通知せず値も変えず console.warn する', () => {
        const s = new TransformInputSettings();
        let n = 0;
        s.onChange(() => { n++; });
        const warns = countWarns(() => {
            s.setReferencePoint('unknown');
            s.setReferencePoint(null);
            s.setReferencePoint(undefined);
        });
        assert.equal(warns, 3);
        assert.equal(n, 0);
        assert.equal(s.getReferencePoint(), REFERENCE_POINT.CENTER);
    });

    test('9か所すべて設定できる', () => {
        const s = new TransformInputSettings();
        for (const name of Object.values(REFERENCE_POINT)) {
            s.setReferencePoint(name);
            assert.equal(s.getReferencePoint(), name);
        }
    });
});

describe('TransformInputSettings 比率の鍵', () => {
    test('setAspectLocked は変わったときだけ1回通知する', () => {
        const s = new TransformInputSettings();
        let n = 0;
        s.onChange(() => { n++; });
        s.setAspectLocked(true);
        assert.equal(s.isAspectLocked(), true);
        assert.equal(n, 1);
        s.setAspectLocked(true);
        assert.equal(n, 1);
    });

    test('真偽値でない値は通知せず console.warn する', () => {
        const s = new TransformInputSettings();
        let n = 0;
        s.onChange(() => { n++; });
        const warns = countWarns(() => {
            s.setAspectLocked(1);
            s.setAspectLocked('true');
            s.setAspectLocked(null);
        });
        assert.equal(warns, 3);
        assert.equal(n, 0);
        assert.equal(s.isAspectLocked(), false);
    });

    test('toggleAspectLock は反転して1回ずつ通知する', () => {
        const s = new TransformInputSettings();
        let n = 0;
        s.onChange(() => { n++; });
        s.toggleAspectLock();
        assert.equal(s.isAspectLocked(), true);
        assert.equal(n, 1);
        s.toggleAspectLock();
        assert.equal(s.isAspectLocked(), false);
        assert.equal(n, 2);
    });

    test('基準点と鍵は互いに影響しない', () => {
        const s = new TransformInputSettings();
        s.setAspectLocked(true);
        s.setReferencePoint(REFERENCE_POINT.NW);
        assert.deepEqual(s.getState(), { referencePoint: 'nw', aspectLocked: true });
    });
});

describe('TransformInputSettings onChange', () => {
    test('関数以外は無視する（例外も出ない）', () => {
        const s = new TransformInputSettings();
        s.onChange(null);
        s.onChange(undefined);
        s.onChange('x');
        s.onChange({});
        assert.doesNotThrow(() => s.toggleAspectLock());
    });

    test('複数登録は登録順にすべて引数なしで呼ばれる', () => {
        const s = new TransformInputSettings();
        const calls = [];
        s.onChange((...args) => calls.push(['a', args.length]));
        s.onChange((...args) => calls.push(['b', args.length]));
        s.toggleAspectLock();
        assert.deepEqual(calls, [['a', 0], ['b', 0]]);
    });
});
