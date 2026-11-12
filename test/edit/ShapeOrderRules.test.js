/**
 * 責務: ShapeOrderRulesの公開API（ShapeOrderOperation・reorderSelected・canReorderSelected）を、文字列の要素で検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
    ShapeOrderOperation,
    reorderSelected,
    canReorderSelected,
} from '../../js/edit/ShapeOrderRules.js';

const OPS = Object.values(ShapeOrderOperation);

/**
 * 文字列の並び表記（選択中は末尾に`*`）から、要素の配列と選択中の集合を作る。
 * @param {string} notation 例: 'A B* C'
 * @returns {{ items: string[], selected: Set<string> }}
 */
function parse(notation) {
    const tokens = notation.trim() === '' ? [] : notation.trim().split(/\s+/);
    const items = tokens.map((t) => t.replace('*', ''));
    const selected = new Set(tokens.filter((t) => t.endsWith('*')).map((t) => t.replace('*', '')));
    return { items, selected };
}

/**
 * `Set`から`isSelected`関数を作る。
 * @param {Set<string>} selected 選択中の要素
 * @returns {(item: string) => boolean}
 */
function asPredicate(selected) {
    return (item) => selected.has(item);
}

/**
 * 表記に操作を適用して、結果を（`*`を除いた）空白区切りの文字列で返す。
 * @param {string} notation 並びの表記
 * @param {string} op 操作
 * @returns {string}
 */
function run(notation, op) {
    const { items, selected } = parse(notation);
    return reorderSelected(items, asPredicate(selected), op).join(' ');
}

/** 照合用の全ケース（並びの表記）。 */
const CASES = [
    'A B* C D* E', 'A B* C*', 'A* B C*', 'A* B* C', 'A B C', 'A* B* C*', '', 'A*', 'A', 'A B C*', 'A* B C',
    'A B* C', 'A B* C* D', 'A* B C* D E*',
];

describe('ShapeOrderOperation', () => {
    it('4つの値を持ち凍結されている', () => {
        assert.deepEqual({ ...ShapeOrderOperation }, {
            BRING_TO_FRONT: 'bringToFront',
            BRING_FORWARD: 'bringForward',
            SEND_BACKWARD: 'sendBackward',
            SEND_TO_BACK: 'sendToBack',
        });
        assert.ok(Object.isFrozen(ShapeOrderOperation));
    });
});

describe('reorderSelected: 最前面へ', () => {
    const op = ShapeOrderOperation.BRING_TO_FRONT;
    it('単一選択', () => assert.equal(run('A B* C D', op), 'A C D B'));
    it('連続した複数選択', () => assert.equal(run('A B* C* D', op), 'A D B C'));
    it('離れた複数選択（まとめて末尾へ・元の順）', () => assert.equal(run('A B* C D* E', op), 'A C E B D'));
    it('すでに端にある場合は不変', () => assert.equal(run('A B C*', op), 'A B C'));
    it('選択なしは不変', () => assert.equal(run('A B C', op), 'A B C'));
    it('全要素選択は不変', () => assert.equal(run('A* B* C*', op), 'A B C'));
    it('要素0個は空', () => assert.deepEqual(reorderSelected([], () => false, op), []));
});

describe('reorderSelected: 最背面へ', () => {
    const op = ShapeOrderOperation.SEND_TO_BACK;
    it('単一選択', () => assert.equal(run('A B C* D', op), 'C A B D'));
    it('連続した複数選択', () => assert.equal(run('A B* C* D', op), 'B C A D'));
    it('離れた複数選択', () => assert.equal(run('A B* C D* E', op), 'B D A C E'));
    it('すでに端にある場合は不変', () => assert.equal(run('A* B C', op), 'A B C'));
    it('選択なしは不変', () => assert.equal(run('A B C', op), 'A B C'));
    it('全要素選択は不変', () => assert.equal(run('A* B* C*', op), 'A B C'));
    it('要素0個は空', () => assert.deepEqual(reorderSelected([], () => false, op), []));
});

describe('reorderSelected: 前へ', () => {
    const op = ShapeOrderOperation.BRING_FORWARD;
    it('単一選択', () => assert.equal(run('A B* C D', op), 'A C B D'));
    it('連続した複数選択は一緒に動く', () => assert.equal(run('A B* C* D', op), 'A D B C'));
    it('離れた複数選択[A,B*,C,D*,E]', () => assert.equal(run('A B* C D* E', op), 'A C B E D'));
    it('[A,B*,C*]は不変', () => assert.equal(run('A B* C*', op), 'A B C'));
    it('[A*,B,C*]→[B,A*,C*]', () => assert.equal(run('A* B C*', op), 'B A C'));
    it('[A*,B*,C]→[C,A*,B*]', () => assert.equal(run('A* B* C', op), 'C A B'));
    it('すでに端にある場合は不変', () => assert.equal(run('A B C*', op), 'A B C'));
    it('選択なしは不変', () => assert.equal(run('A B C', op), 'A B C'));
    it('全要素選択は不変', () => assert.equal(run('A* B* C*', op), 'A B C'));
    it('要素0個は空', () => assert.deepEqual(reorderSelected([], () => false, op), []));
});

describe('reorderSelected: 後ろへ', () => {
    const op = ShapeOrderOperation.SEND_BACKWARD;
    it('単一選択', () => assert.equal(run('A B C* D', op), 'A C B D'));
    it('連続した複数選択は一緒に動く', () => assert.equal(run('A B* C* D', op), 'B C A D'));
    it('離れた複数選択[A,B*,C,D*,E]', () => assert.equal(run('A B* C D* E', op), 'B A D C E'));
    it('[A*,B*,C]は不変', () => assert.equal(run('A* B* C', op), 'A B C'));
    it('[A*,B,C*]→[A*,C*,B]', () => assert.equal(run('A* B C*', op), 'A C B'));
    it('すでに端にある場合は不変', () => assert.equal(run('A* B C', op), 'A B C'));
    it('選択なしは不変', () => assert.equal(run('A B C', op), 'A B C'));
    it('全要素選択は不変', () => assert.equal(run('A* B* C*', op), 'A B C'));
    it('要素0個は空', () => assert.deepEqual(reorderSelected([], () => false, op), []));
});

describe('reorderSelected: 共通の性質', () => {
    it('選択中どうし・選択されていないどうしの相対的な順が保たれる（全ケース×4操作）', () => {
        for (const notation of CASES) {
            const { items, selected } = parse(notation);
            for (const op of OPS) {
                const result = reorderSelected(items, asPredicate(selected), op);
                assert.deepEqual([...result].sort(), [...items].sort());
                assert.deepEqual(result.filter((x) => selected.has(x)), items.filter((x) => selected.has(x)), `${notation} ${op}`);
                assert.deepEqual(result.filter((x) => !selected.has(x)), items.filter((x) => !selected.has(x)), `${notation} ${op}`);
            }
        }
    });

    it('引数の配列を書き換えず、戻り値は新しい配列（不変の場合も）', () => {
        for (const op of OPS) {
            const items = Object.freeze(['A', 'B', 'C']);
            const result = reorderSelected(items, () => false, op);
            assert.notEqual(result, items);
            assert.deepEqual(items, ['A', 'B', 'C']);
        }
    });

    it('isSelectedは各要素1回ずつ呼ばれる', () => {
        for (const op of OPS) {
            const calls = [];
            reorderSelected(['A', 'B', 'C', 'D'], (item) => { calls.push(item); return item === 'B'; }, op);
            assert.deepEqual(calls, ['A', 'B', 'C', 'D'], op);
        }
    });

    it('未知の操作はErrorをthrowする（要素0個でも）', () => {
        assert.throws(() => reorderSelected(['A'], () => true, 'unknown'), /未知の重なり順の操作です: unknown/);
        assert.throws(() => reorderSelected([], () => true, 'unknown'), /未知の重なり順の操作です/);
        assert.throws(() => reorderSelected([], () => true, undefined), /未知の重なり順の操作です: undefined/);
        assert.throws(() => canReorderSelected([], () => true, 'unknown'), /未知の重なり順の操作です/);
    });
});

describe('canReorderSelected', () => {
    it('reorderSelectedの結果が変わるかと一致する（全ケース×4操作）', () => {
        for (const notation of CASES) {
            const { items, selected } = parse(notation);
            for (const op of OPS) {
                const result = reorderSelected(items, asPredicate(selected), op);
                const changed = result.some((x, i) => x !== items[i]);
                assert.equal(canReorderSelected(items, asPredicate(selected), op), changed, `${notation} ${op}`);
            }
        }
    });

    it('代表例', () => {
        const { items, selected } = parse('A B* C');
        const p = asPredicate(selected);
        assert.equal(canReorderSelected(items, p, ShapeOrderOperation.BRING_TO_FRONT), true);
        assert.equal(canReorderSelected(items, p, ShapeOrderOperation.SEND_TO_BACK), true);
        const top = parse('A B C*');
        assert.equal(canReorderSelected(top.items, asPredicate(top.selected), ShapeOrderOperation.BRING_FORWARD), false);
        assert.equal(canReorderSelected([], () => false, ShapeOrderOperation.BRING_FORWARD), false);
    });
});
