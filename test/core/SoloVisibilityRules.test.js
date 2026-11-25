/**
 * 責務：SoloVisibilityRules（その行だけの表示の規則）の公開APIを検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSoloToggle } from '../../js/core/SoloVisibilityRules.js';
import { applyItemStates, collectItemStates, resolveVisibleToggle } from '../../js/core/ItemStateRules.js';

const s = (id, extra = {}) => ({ kind: 'shape', shape: { id }, ...extra });
const g = (id, children = [], extra = {}) => ({ kind: 'group', id, children, ...extra });

/** 各行の自分の表示を id → boolean で返す。 */
const vis = (items) => Object.fromEntries([...collectItemStates(items)].map(([id, st]) => [id, st.visible]));

/** Alt+クリックを1回当てる。 */
function solo(state, id) {
    const r = resolveSoloToggle({ items: state.items, id, memory: state.memory });
    return { items: applyItemStates(state.items, r.changes), memory: r.memory, changes: r.changes };
}

/** 目の切り替えを1回当てる（記憶はそのまま）。 */
function eye(state, id) {
    return { ...state, items: applyItemStates(state.items, [resolveVisibleToggle(state.items, id)]) };
}

const start = (items) => ({ items, memory: null });

describe('resolveSoloToggle：その行だけにする', () => {
    it('いちばん外側の図形：その図形だけが表示になる', () => {
        const st = solo(start([s('a'), s('b'), s('c')]), 'b');
        assert.deepEqual(vis(st.items), { a: false, b: true, c: false });
    });

    it('フォルダの中の図形：上のフォルダと、各階層の兄弟が変わる', () => {
        const items = [s('x'), g('G', [s('a'), s('b')]), s('y')];
        const st = solo(start(items), 'a');
        assert.deepEqual(vis(st.items), { x: false, G: true, a: true, b: false, y: false });
    });

    it('フォルダの行：中のものの値は変えない', () => {
        const items = [s('x'), g('G', [s('a', { visible: false }), s('b')]), s('y')];
        const st = solo(start(items), 'G');
        assert.deepEqual(vis(st.items), { x: false, G: true, a: false, b: true, y: false });
    });

    it('入れ子のフォルダ：兄弟の中のものには触れない', () => {
        const items = [g('G', [g('H', [s('a'), s('b')]), s('c'), g('K', [s('d')])]), s('e')];
        const st = solo(start(items), 'a');
        assert.deepEqual(vis(st.items), { G: true, H: true, a: true, b: false, c: false, K: false, d: true, e: false });
    });

    it('上のフォルダが隠れていた行：上のフォルダも表示になる', () => {
        const items = [g('G', [s('a'), s('b')], { visible: false }), s('c')];
        const st = solo(start(items), 'a');
        assert.deepEqual(vis(st.items), { G: true, a: true, b: false, c: false });
    });

    it('変えるものは今の値と違うものだけ', () => {
        const r = resolveSoloToggle({ items: [s('a'), s('b'), s('c', { visible: false })], id: 'a', memory: null });
        assert.deepEqual(r.changes, [{ id: 'b', visible: false }]);
        assert.equal(r.memory.displays.length, 1);
    });

    it('図形インスタンスは共有される', () => {
        const items = [s('a'), s('b')];
        const st = solo(start(items), 'a');
        assert.equal(st.items[0].shape, items[0].shape);
    });
});

describe('resolveSoloToggle：もう一度で戻る', () => {
    it('もう一度で、はじめの前へ戻る', () => {
        const items = [s('a'), s('b', { visible: false }), s('c')];
        let st = solo(start(items), 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: false });
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
    });

    it('間にほかの行（兄弟・親のフォルダ・別のフォルダの中）を挟んでもはじめの前へ戻る', () => {
        const items = [g('G', [s('a'), s('b')]), g('H', [s('c'), s('d', { visible: false })]), s('e')];
        const original = vis(items);
        let st = solo(start(items), 'a');
        st = solo(st, 'b');
        st = solo(st, 'e');
        st = solo(st, 'c');
        st = solo(st, 'd');
        assert.deepEqual(vis(st.items), { G: false, a: false, b: true, H: true, c: false, d: true, e: false });
        st = solo(st, 'd');
        assert.deepEqual(vis(st.items), original);
    });

    it('間に目の切り替えがあると新しく始まる', () => {
        const items = [s('a'), s('b'), s('c')];
        let st = solo(start(items), 'a');
        st = eye(st, 'c');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
        st = solo(st, 'b');
        assert.deepEqual(vis(st.items), { a: false, b: true, c: false });
        st = solo(st, 'b');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
    });

    it('はじめの前へ戻した後に目を切り替えると新しく始まる', () => {
        const items = [s('a'), s('b'), s('c')];
        let st = solo(start(items), 'a');
        st = solo(st, 'a');
        st = eye(st, 'b');
        st = eye(st, 'b');
        st = solo(st, 'c');
        assert.deepEqual(vis(st.items), { a: false, b: false, c: true });
        st = solo(st, 'c');
        assert.deepEqual(vis(st.items), { a: true, b: true, c: true });
    });

    it('戻した後に取り消した（その行だけに戻った）ときもう一度で戻る', () => {
        const items = [s('a'), s('b', { visible: false }), s('c')];
        let st = solo(start(items), 'a');
        const soloItems = st.items;
        st = solo(st, 'a');
        st = { ...st, items: soloItems };
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
    });

    it('A→Bの後に取り消してAだけに戻ったとき：Aをもう一度でははじめの前へ戻る', () => {
        const items = [s('a'), s('b', { visible: false }), s('c')];
        let st = solo(start(items), 'a');
        const aOnly = st.items;
        st = solo(st, 'b');
        assert.deepEqual(vis(st.items), { a: false, b: true, c: false });
        st = { ...st, items: aOnly };
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
    });

    it('A→Bの後に取り消してAだけに戻ったとき：Bをもう一度でBだけになり、次のBではじめの前へ戻る', () => {
        const items = [s('a'), s('b', { visible: false }), s('c')];
        let st = solo(start(items), 'a');
        const aOnly = st.items;
        st = solo(st, 'b');
        st = { ...st, items: aOnly };
        st = solo(st, 'b');
        assert.deepEqual(vis(st.items), { a: false, b: true, c: false });
        st = solo(st, 'b');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
    });

    it('A→Bの後に取り消してAだけに戻ったとき：間に増えた行があっても同じ', () => {
        const items = [s('a'), s('b', { visible: false }), s('c')];
        let st = solo(start(items), 'a');
        const aOnly = st.items;
        st = solo(st, 'b');
        st = { ...st, items: [...aOnly, s('n')] };
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true, n: true });
    });

    it('A→Bの後に取り消して目を切り替え、どの控えとも違う表示なら新しく始まる', () => {
        const items = [s('a'), s('b'), s('c')];
        let st = solo(start(items), 'a');
        const aOnly = st.items;
        st = solo(st, 'b');
        st = eye({ ...st, items: aOnly }, 'c');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: false });
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false, c: true });
    });

    it('フォルダ→その中の行と移った後に中の目だけを切り替えてから外の行を押すと新しく始まる', () => {
        const items = [g('G', [s('a'), s('b'), s('c')]), s('x')];
        let st = solo(start(items), 'G');
        st = solo(st, 'a');
        st = eye(st, 'c');
        st = solo(st, 'x');
        assert.deepEqual(vis(st.items), { G: false, a: true, b: false, c: true, x: true });
        st = solo(st, 'x');
        assert.deepEqual(vis(st.items), { G: true, a: true, b: false, c: true, x: false });
    });

    it('フォルダ→その中の行：もう一度ではじめの前へ戻る', () => {
        const items = [g('G', [s('a'), s('b')]), s('x')];
        const original = vis(items);
        let st = solo(start(items), 'G');
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { G: true, a: true, b: false, x: false });
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), original);
    });

    it('当たる控えは無いが、押した行がその行だけの表示で要る分を覚えている：はじめの前へ戻る', () => {
        const items = [s('a'), s('b'), s('c')];
        const first = solo(start(items), 'a');
        // 手で作った表示：記憶（a・b・cを覚えている）に当たる控えは無いが、b だけの表示になっている
        const manual = applyItemStates(first.items, [
            { id: 'a', visible: false },
            { id: 'b', visible: true },
            { id: 'c', visible: true },
            { id: 'c', visible: false }
        ]);
        const forgot = { items: manual, memory: { ...first.memory, displays: [] } };
        const st = solo(forgot, 'b');
        assert.deepEqual(vis(st.items), { a: true, b: true, c: true });
    });

    it('その行だけにしたフォルダの中ではじめからその行だけだった行：はじめの前へ戻る', () => {
        const items = [g('G', [s('a'), s('b', { visible: false })]), s('x')];
        const original = vis(items);
        let st = solo(start(items), 'G');
        assert.deepEqual(vis(st.items), { G: true, a: true, b: false, x: false });
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), original);
    });

    it('増えた行（兄弟・行の中）がそのまま', () => {
        const items = [g('G', [s('a')]), s('x')];
        let st = solo(start(items), 'G');
        const withNew = [
            { ...st.items[0], children: [...st.items[0].children, s('n1')] },
            st.items[1],
            s('n2', { visible: true })
        ];
        st = solo({ ...st, items: withNew }, 'G');
        assert.deepEqual(vis(st.items), { G: true, a: true, n1: true, x: true, n2: true });
    });

    it('消えた行があっても戻る', () => {
        const items = [s('a'), s('b'), s('c')];
        let st = solo(start(items), 'a');
        st = solo({ ...st, items: st.items.filter((it) => it.shape.id !== 'b') }, 'a');
        assert.deepEqual(vis(st.items), { a: true, c: true });
    });

    it('行が別のフォルダへ動いた', () => {
        const items = [g('G', [s('a')]), s('b'), s('c')];
        let st = solo(start(items), 'b');
        const moved = [
            { ...st.items[0], children: [...st.items[0].children, st.items[1]] },
            st.items[2]
        ];
        st = solo({ ...st, items: moved }, 'b');
        assert.deepEqual(vis(st.items), { G: true, a: false, b: true, c: false });
        st = solo(st, 'b');
        assert.deepEqual(vis(st.items), { G: true, a: true, b: true, c: true });
    });
});

describe('resolveSoloToggle：記憶が使えないとき・変えないとき', () => {
    it('記憶なしでその行だけの表示：全部の行が表示になる（入れ子の中の非表示も）', () => {
        const items = [s('a', { visible: false }), g('G', [s('b', { visible: false }), s('c')], { visible: false }), s('d')];
        // 手で作った「aだけ」の表示（記憶なし）
        const handMade = applyItemStates(items, [{ id: 'a', visible: true }, { id: 'G', visible: false }, { id: 'd', visible: false }]);
        const r = resolveSoloToggle({ items: handMade, id: 'a', memory: null });
        const after = applyItemStates(handMade, r.changes);
        assert.deepEqual(vis(after), { a: true, G: true, b: true, c: true, d: true });
        assert.equal(r.memory, null);
    });

    it('行が1つだけで変わるものが無い', () => {
        const r = resolveSoloToggle({ items: [s('a')], id: 'a', memory: null });
        assert.deepEqual(r.changes, []);
        assert.equal(r.memory, null);
    });

    it('覚えている表示はあるが戻すものが無いとき変更なし（memoryも変わらない）', () => {
        const items = [s('a'), s('b', { visible: false })];
        let st = solo(start(items), 'b');
        assert.deepEqual(vis(st.items), { a: false, b: true });
        st = solo(st, 'a');
        assert.deepEqual(vis(st.items), { a: true, b: false });
        const before = st.memory;
        st = solo(st, 'a');
        assert.deepEqual(st.changes, []);
        assert.equal(st.memory, before);
    });

    it('覚えている表示に要る分が無いとき（当たる控えが無く、別のフォルダの中の覚えていない行）全部表示', () => {
        const items = [g('G', [s('a'), s('b')]), g('H', [s('c'), s('d')])];
        const first = solo(start(items), 'a');
        // 記憶は G・a・b・H を覚えているが、手で c だけの表示にした
        const handMade = applyItemStates(first.items, [
            { id: 'G', visible: false }, { id: 'a', visible: false }, { id: 'H', visible: true },
            { id: 'c', visible: true }, { id: 'd', visible: false }
        ]);
        const r = resolveSoloToggle({ items: handMade, id: 'c', memory: first.memory });
        const after = applyItemStates(handMade, r.changes);
        assert.deepEqual(vis(after), { G: true, a: true, b: true, H: true, c: true, d: true });
    });

    it('無いid：変更なしで memory はそのまま', () => {
        const items = [s('a'), s('b')];
        const st = solo(start(items), 'a');
        const r = resolveSoloToggle({ items: st.items, id: 'zzz', memory: st.memory });
        assert.deepEqual(r.changes, []);
        assert.equal(r.memory, st.memory);
        const r2 = resolveSoloToggle({ items, id: 'zzz', memory: null });
        assert.equal(r2.memory, null);
    });
});

describe('resolveSoloToggle：引数を書き換えない', () => {
    it('items・memory を書き換えない', () => {
        const items = [g('G', [s('a'), s('b')]), s('x')];
        const first = resolveSoloToggle({ items, id: 'a', memory: null });
        const memory = first.memory;
        const itemsAfter = applyItemStates(items, first.changes);
        const snapshotItems = JSON.stringify(itemsAfter);
        const snapshotMemory = JSON.stringify({
            v: [...memory.visibleById],
            d: memory.displays.map((d) => [[...d.visibleById], [...d.knownIds]])
        });
        resolveSoloToggle({ items: itemsAfter, id: 'a', memory });
        resolveSoloToggle({ items: itemsAfter, id: 'x', memory });
        assert.equal(JSON.stringify(itemsAfter), snapshotItems);
        assert.equal(JSON.stringify({
            v: [...memory.visibleById],
            d: memory.displays.map((d) => [[...d.visibleById], [...d.knownIds]])
        }), snapshotMemory);
        assert.equal(first.memory.displays.length, 1);
        const second = resolveSoloToggle({ items: itemsAfter, id: 'x', memory });
        assert.equal(memory.displays.length, 1);
        assert.equal(second.memory.displays.length, 2);
    });
});
