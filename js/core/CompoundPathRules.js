/**
 * 責務：複合パスのフォルダの規則（属性の読み書き・効いている複合パスの中身と一番下の図形・描く単位・塗られた所の判定・スタイルの反映先への読み替え）。
 * 状態を持たずDOMに触れない。importは ItemTreeRules・ItemStateRules のみ。
 */
import { ITEM_KIND, listShapeItems } from './ItemTreeRules.js';
import { listItemStates } from './ItemStateRules.js';

/** @typedef {import('./ItemTreeRules.js').Item} Item */

/**
 * 複合パスのスタイル（一番下の図形の共通プロパティをそのまま写したもの）。
 * @typedef {Object} CompoundStyle
 * @property {*} strokeColor - 線の色
 * @property {*} strokeWidth - 線の太さ
 * @property {*} fillColor - 塗りの色（`isFillable()`を問わず、文字列なら塗る）
 */

/**
 * 効いている複合パス1つ。
 * @typedef {Object} CompoundPath
 * @property {string} groupId - 複合パスのフォルダのid
 * @property {Object[]} shapes - 中の図形（描画順。1つ以上。先頭が一番下の図形）
 * @property {CompoundStyle} style - 一番下の図形から写したスタイル
 * @property {boolean} baseEditable - 一番下の図形が変えられるか（`ItemStateRules`の`editable`）
 */

/**
 * 描く単位。図形1つ、または複合パス1つ。
 * @typedef {{kind: 'shape', shapes: Object[]} | {kind: 'compound', groupId: string, shapes: Object[], style: CompoundStyle, baseEditable: boolean}} DrawUnit
 */

/**
 * 描く単位の種類の値。
 * @type {Readonly<{SHAPE: 'shape', COMPOUND: 'compound'}>}
 */
export const DRAW_UNIT_KIND = Object.freeze({ SHAPE: 'shape', COMPOUND: 'compound' });

/**
 * アイテムが複合パスのフォルダか（フォルダで`compound === true`）を判定する。
 * `compound`の値を意味として読むのはここだけ（作業データの読み書きをする`DocumentSerializer`と、
 * 不備の補いをする`ItemAttributeRules`を除く）。
 * @param {Item} item - アイテム
 * @returns {boolean} 複合パスのフォルダなら true
 */
export function isCompoundGroup(item) {
    return item.kind === ITEM_KIND.GROUP && item.compound === true;
}

/**
 * idのフォルダの`compound`を変えた新しい入れ子を返す（真なら`compound: true`、偽ならキーを消す）。
 * 変わらない（無いid・フォルダでない・同じ値）なら引数と同じ参照を返す。
 * 通り道と変わるフォルダだけ新しいオブジェクトにし、図形インスタンスは共有する。引数は書き換えない。
 * `compound`のキーを書くのはここだけ（作業データの読み書きをする`DocumentSerializer`を除く）。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - 変えるフォルダのid
 * @param {boolean} compound - 新しい値
 * @returns {Item[]} 新しい入れ子。変わらないときは`items`そのもの
 */
export function setCompound(items, id, compound) {
    const next = items.map((item) => {
        if (item.kind !== ITEM_KIND.GROUP) {
            return item;
        }
        if (item.id === id) {
            if (isCompoundGroup(item) === compound) {
                return item;
            }
            const changed = { ...item };
            if (compound) {
                changed.compound = true;
            } else {
                delete changed.compound;
            }
            return changed;
        }
        const children = setCompound(item.children, id, compound);
        return children === item.children ? item : { ...item, children };
    });
    return next.every((item, index) => item === items[index]) ? items : next;
}

/**
 * 複合パスの切り替え（今の値の反対）を求める。
 * @param {Item[]} items - アイテムの入れ子
 * @param {string} id - フォルダのid
 * @returns {{id: string, compound: boolean}|null} 変更。無い・フォルダでないなら null
 */
export function resolveCompoundToggle(items, id) {
    const walk = (list) => {
        for (const item of list) {
            if (item.kind !== ITEM_KIND.GROUP) {
                continue;
            }
            if (item.id === id) {
                return { id, compound: !isCompoundGroup(item) };
            }
            const found = walk(item.children);
            if (found !== null) {
                return found;
            }
        }
        return null;
    };
    return walk(items);
}

/**
 * 複合パスのフォルダ（入れ子の中・隠れたものも）のidを集める。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Set<string>} 複合パスのフォルダのid
 */
export function collectCompoundGroupIds(items) {
    const ids = new Set();
    const walk = (list) => {
        for (const item of list) {
            if (item.kind !== ITEM_KIND.GROUP) {
                continue;
            }
            if (isCompoundGroup(item)) {
                ids.add(item.id);
            }
            walk(item.children);
        }
    };
    walk(items);
    return ids;
}

/**
 * 効いている複合パス（上のフォルダのどれも複合パスでないもの）を前順で返す。
 * 中の図形は見えている（隠れていない）子孫の図形で、内側の複合パスは外側に入る。
 * 中の図形が1つも無い複合パスは返さない。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {CompoundPath[]} 効いている複合パス
 */
export function listCompoundPaths(items) {
    const states = new Map();
    for (const state of listItemStates(items)) {
        states.set(state.item, state);
    }
    /** @type {CompoundPath[]} */
    const result = [];
    const walk = (list) => {
        for (const item of list) {
            if (item.kind !== ITEM_KIND.GROUP) {
                continue;
            }
            if (!isCompoundGroup(item)) {
                walk(item.children);
                continue;
            }
            const inner = listShapeItems(item.children).filter((shapeItem) => !states.get(shapeItem).hidden);
            if (inner.length === 0) {
                continue;
            }
            const base = inner[0].shape;
            result.push({
                groupId: item.id,
                shapes: inner.map((shapeItem) => shapeItem.shape),
                style: { strokeColor: base.strokeColor, strokeWidth: base.strokeWidth, fillColor: base.fillColor },
                baseEditable: states.get(inner[0]).editable
            });
        }
    };
    walk(items);
    return result;
}

/**
 * 中の図形（インスタンス）→その図形が入っている複合パスの`Map`を返す。
 * 図形→複合パスの引き方の計算はここだけに置く。引数は書き換えない。
 * @param {CompoundPath[]} compoundPaths - `listCompoundPaths`の結果
 * @returns {Map<Object, CompoundPath>} 図形 → 複合パス（参照は引数の要素と同じ）
 */
export function mapCompoundsByShape(compoundPaths) {
    const map = new Map();
    for (const compound of compoundPaths) {
        for (const shape of compound.shapes) {
            map.set(shape, compound);
        }
    }
    return map;
}

/**
 * 見えている図形の並び（描画順）から描く単位の並びを作る。
 * 複合パスに入っていない図形は1つずつの単位、複合パスは最初に出会った位置に1つの単位、2回目以降の中の図形は飛ばす。
 * @param {Object[]} shapes - 見えている図形（描画順）
 * @param {CompoundPath[]} compoundPaths - `listCompoundPaths`の結果
 * @returns {DrawUnit[]} 描く単位（描画順）
 */
export function buildDrawUnits(shapes, compoundPaths) {
    const byShape = mapCompoundsByShape(compoundPaths);
    const emitted = new Set();
    /** @type {DrawUnit[]} */
    const units = [];
    for (const shape of shapes) {
        const compound = byShape.get(shape);
        if (compound === undefined) {
            units.push({ kind: DRAW_UNIT_KIND.SHAPE, shapes: [shape] });
            continue;
        }
        if (emitted.has(compound)) {
            continue;
        }
        emitted.add(compound);
        units.push({
            kind: DRAW_UNIT_KIND.COMPOUND,
            groupId: compound.groupId,
            shapes: compound.shapes,
            style: compound.style,
            baseEditable: compound.baseEditable
        });
    }
    return units;
}

/**
 * 図形（インスタンス）が入っている複合パスを返す。
 * @param {CompoundPath[]} compoundPaths - `listCompoundPaths`の結果
 * @param {Object} shape - 図形
 * @returns {CompoundPath|null} 複合パス。無ければ null
 */
export function findCompoundOf(compoundPaths, shape) {
    return mapCompoundsByShape(compoundPaths).get(shape) ?? null;
}

/**
 * 点が複合パスの塗られた所（スタイルの`fillColor`が文字列で、中の図形の輪郭の内側の数が奇数）かを判定する。
 * @param {CompoundPath} compound - 複合パス
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @returns {boolean} 塗られた所なら true
 */
export function isInsideCompoundFill(compound, x, y) {
    if (typeof compound.style.fillColor !== 'string') {
        return false;
    }
    let count = 0;
    for (const shape of compound.shapes) {
        if (shape.isInsideOutline(x, y)) {
            count += 1;
        }
    }
    return count % 2 === 1;
}

/**
 * 点が複合パスの塗られた所で、かつその図形が点を自分の輪郭で囲むかを判定する。
 * @param {CompoundPath} compound - 複合パス
 * @param {Object} shape - 中の図形
 * @param {number} x - X座標
 * @param {number} y - Y座標
 * @returns {boolean} 当たるなら true
 */
export function hitTestCompoundFill(compound, shape, x, y) {
    return isInsideCompoundFill(compound, x, y) && shape.isInsideOutline(x, y);
}

/**
 * 選択中の変えられる図形（描画順）を、スタイルの反映先へ読み替える。
 * 中の図形は複合パスの一番下の図形へ（`baseEditable`が偽の複合パスは飛ばす。同じ複合パスは最初の1回だけ）、
 * 一番下の図形は塗りの対象にも入れる。そうでない図形はそのままで、塗りの対象は`isFillable()`が真のものだけ。
 * @param {Object[]} shapes - 選択中の変えられる図形（描画順）
 * @param {CompoundPath[]} compoundPaths - `listCompoundPaths`の結果
 * @returns {{shapes: Object[], fillShapes: Object[]}} 反映先の図形と、塗りの反映先の図形
 */
export function resolveStyleTargets(shapes, compoundPaths) {
    const byShape = mapCompoundsByShape(compoundPaths);
    const seen = new Set();
    const targets = [];
    const fillShapes = [];
    for (const shape of shapes) {
        const compound = byShape.get(shape);
        if (compound === undefined) {
            targets.push(shape);
            if (shape.isFillable()) {
                fillShapes.push(shape);
            }
            continue;
        }
        if (!compound.baseEditable || seen.has(compound)) {
            continue;
        }
        seen.add(compound);
        targets.push(compound.shapes[0]);
        fillShapes.push(compound.shapes[0]);
    }
    return { shapes: targets, fillShapes };
}
