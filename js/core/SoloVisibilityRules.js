/**
 * 責務：その行だけの表示（Alt+クリック）の見分け・次の表示の値・覚える内容を求める。
 * 状態を持たず、DOMにも触れない。importするのは GroupTreeRules・ItemPlaceRules・ItemStateRules のみ。図形は id だけを読む。
 */
import { itemIdOf } from './GroupTreeRules.js';
import { findItemLocation } from './ItemPlaceRules.js';
import { listItemStates } from './ItemStateRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * 1回の「その行だけ」にした直後の控え。
 * @typedef {Object} SoloDisplay
 * @property {Map<string, boolean>} visibleById - その時点で覚えている行（今ある行だけ）の、直後の値
 * @property {Set<string>} knownIds - その時点の全部の行のid
 */

/**
 * その行だけの表示にする前の表示の記憶。
 * @typedef {Object} SoloMemory
 * @property {Map<string, boolean>} visibleById - 覚えている行の、はじめの前の値
 * @property {SoloDisplay[]} displays - はじめから今までの控え（古い順）
 */

/**
 * 「その行だけの表示」にしたときの、行ごとの目標の値を求める（非公開）。
 * その行と上のフォルダは true、その行と上のフォルダそれぞれの兄弟は false。行の中のもの・兄弟の中のものは入らない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - 行のid
 * @returns {Map<string, boolean>|null} id → 目標の値。行が無ければ null
 */
function buildTargets(items, id) {
    const location = findItemLocation(items, id);
    if (location === null) return null;
    const targets = new Map();
    for (const pathId of [...location.ancestorIds, id]) {
        const pathLocation = findItemLocation(items, pathId);
        targets.set(pathId, true);
        for (const sibling of pathLocation.siblings) {
            const siblingId = itemIdOf(sibling);
            if (siblingId !== pathId) targets.set(siblingId, false);
        }
    }
    return targets;
}

/**
 * 今の表示に当たる控えを探す（非公開）。複数あれば最後のもの。
 * 覚えている行のうち今ある行のすべてで、今の値が「控えの値（控えに無い行は覚えている値）」と同じものが当たる。
 * @param {Map<string, boolean>} current - 今ある行の id → 自分の表示
 * @param {SoloMemory|null|undefined} memory - 記憶
 * @returns {SoloDisplay|null} 当たる控え。無ければ null
 */
function findMatchingDisplay(current, memory) {
    if (!memory) return null;
    const presentIds = [...memory.visibleById.keys()].filter((rowId) => current.has(rowId));
    if (presentIds.length === 0) return null;
    for (let i = memory.displays.length - 1; i >= 0; i -= 1) {
        const display = memory.displays[i];
        const matched = presentIds.every((rowId) => {
            const expected = display.visibleById.has(rowId)
                ? display.visibleById.get(rowId)
                : memory.visibleById.get(rowId);
            return current.get(rowId) === expected;
        });
        if (matched) return display;
    }
    return null;
}

/**
 * 行がその行だけの表示になっているかを返す（非公開）。
 * 目標の値が今の値とすべて同じなら真。当たる控えがあるときは、目標が false の行のうち控えの knownIds に無いもの（その後に増えた行）を見ない。
 * @param {Map<string, boolean>} targets - 目標の値
 * @param {Map<string, boolean>} current - 今ある行の id → 自分の表示
 * @param {SoloDisplay|null} display - 当たる控え
 * @returns {boolean} その行だけの表示なら true
 */
function isSoloDisplay(targets, current, display) {
    for (const [rowId, value] of targets) {
        if (!value && display && !display.knownIds.has(rowId)) continue;
        if (current.get(rowId) !== value) return false;
    }
    return true;
}

/**
 * 行の目（Alt+クリック）を押したときの、表示の変更と次の記憶を求める。引数（memory を含む）は書き換えない。
 * 行がその行だけの表示なら、はじめの前の表示へ戻す（使えなければ全部表示）。それ以外は、その行だけの表示にする。
 * @param {Object} args - 引数
 * @param {Item[]} args.items - アイテムの入れ子
 * @param {string} args.id - 押した行のid
 * @param {SoloMemory|null} [args.memory] - 今の記憶
 * @returns {{changes: Array<{id: string, visible: boolean}>, memory: SoloMemory|null}} 今の値と違う変更・次の記憶
 */
export function resolveSoloToggle({ items, id, memory = null }) {
    const targets = buildTargets(items, id);
    if (targets === null) return { changes: [], memory };

    const states = listItemStates(items);
    /** @type {Map<string, boolean>} */
    const current = new Map(states.map((state) => [state.id, state.visible]));
    const display = findMatchingDisplay(current, memory);

    if (isSoloDisplay(targets, current, display)) {
        const usable = display !== null
            || (memory !== null && memory !== undefined && [...targets.keys()].every((rowId) => memory.visibleById.has(rowId)));
        const changes = [];
        if (usable) {
            for (const [rowId, value] of memory.visibleById) {
                if (current.has(rowId) && current.get(rowId) !== value) changes.push({ id: rowId, visible: value });
            }
        } else {
            for (const [rowId, value] of current) {
                if (!value) changes.push({ id: rowId, visible: true });
            }
        }
        return { changes, memory };
    }

    const changes = [];
    for (const [rowId, value] of targets) {
        if (current.get(rowId) !== value) changes.push({ id: rowId, visible: value });
    }
    const keep = display !== null;
    const visibleById = new Map(keep ? memory.visibleById : []);
    for (const rowId of targets.keys()) {
        if (!visibleById.has(rowId)) visibleById.set(rowId, current.get(rowId));
    }
    const afterVisibleById = new Map();
    for (const rowId of visibleById.keys()) {
        if (!current.has(rowId)) continue;
        afterVisibleById.set(rowId, targets.has(rowId) ? targets.get(rowId) : current.get(rowId));
    }
    const nextDisplay = { visibleById: afterVisibleById, knownIds: new Set(current.keys()) };
    return {
        changes,
        memory: {
            visibleById,
            displays: keep ? [...memory.displays, nextDisplay] : [nextDisplay]
        }
    };
}
