/**
 * 責務：図形とフォルダのアイテム（入れ子の並び）を扱う計算の規則。状態を持たず、DOMにも触れず、importもしない。
 * 図形は不透明に扱う（アイテムか素の図形かの判定で値の kind を見ることを除き、図形のプロパティを読まない）。
 */

/**
 * 図形のアイテム。
 * @typedef {Object} ShapeItem
 * @property {'shape'} kind - アイテムの種類
 * @property {Object} shape - 図形クラスのインスタンス（id は shape.id）
 * @property {string} [name] - 名前（未定なら無い）
 * @property {boolean} [visible] - 表示（未定なら無い）
 * @property {boolean} [locked] - ロック（未定なら無い）
 */

/**
 * フォルダのアイテム。
 * @typedef {Object} GroupItem
 * @property {'group'} kind - アイテムの種類
 * @property {string} id - フォルダの id
 * @property {string} [name] - 名前（未定なら無い）
 * @property {boolean} [visible] - 表示（未定なら無い）
 * @property {boolean} [locked] - ロック（未定なら無い）
 * @property {true} [collapsed] - 閉じているときだけ true（開いているときはキー自体が無い）
 * @property {true} [compound] - 複合パスのときだけ true（普通のフォルダはキー自体が無い）
 * @property {Item[]} children - 中身（入れ子）
 */

/** @typedef {ShapeItem | GroupItem} Item */

/**
 * アイテムの種類の値。
 * @type {Readonly<{SHAPE: 'shape', GROUP: 'group'}>}
 */
export const ITEM_KIND = Object.freeze({ SHAPE: 'shape', GROUP: 'group' });

/**
 * 値がアイテム（kind が ITEM_KIND のいずれか）かを判定する。アイテム判定の唯一の箇所。
 * @param {*} value - 判定する値
 * @returns {boolean} アイテムなら true
 */
function isItem(value) {
    return value !== null
        && typeof value === 'object'
        && (value.kind === ITEM_KIND.SHAPE || value.kind === ITEM_KIND.GROUP);
}

/**
 * アイテムまたは素の図形インスタンスの配列から、新しいアイテムの入れ子を作る。
 * アイテムは入れ子まで新しいオブジェクトへ写し、図形インスタンスは共有する。
 * 素の図形インスタンスは名前・表示・ロックが未定の図形のアイテムになる。引数は書き換えない。
 * @param {Array<Item|Object>} values - アイテムまたは素の図形インスタンスの配列
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function toItems(values) {
    return values.map((value) => {
        if (!isItem(value)) {
            return { kind: ITEM_KIND.SHAPE, shape: value };
        }
        if (value.kind === ITEM_KIND.GROUP) {
            return { ...value, children: toItems(value.children) };
        }
        return { ...value };
    });
}

/**
 * 全アイテムを前順（フォルダ自身 → その中身）で並べた新しい配列を返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Item[]} 前順に平らにした配列（要素は引数のアイテムそのもの）
 */
export function listItems(items) {
    const result = [];
    const visit = (list) => {
        for (const item of list) {
            result.push(item);
            if (item.kind === ITEM_KIND.GROUP) {
                visit(item.children);
            }
        }
    };
    visit(items);
    return result;
}

/**
 * 図形のアイテムだけを前順で並べた新しい配列を返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {ShapeItem[]} 図形のアイテムの配列
 */
export function listShapeItems(items) {
    return listItems(items).filter((item) => item.kind === ITEM_KIND.SHAPE);
}

/**
 * 図形だけを前順（重なり順）で並べた新しい配列を返す。
 * @param {Item[]} items - アイテムの入れ子
 * @returns {Object[]} 図形の配列
 */
export function listShapes(items) {
    return listShapeItems(items).map((item) => item.shape);
}

/**
 * フォルダの位置と入れ子を保ち、図形のアイテムの位置へ shapeItems を前から順に置いた新しい入れ子を返す。
 * 前提：shapeItems の数が図形のアイテムの数と同じ。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子（フォルダの位置と入れ子の元）
 * @param {ShapeItem[]} shapeItems - 置く図形のアイテム（新しい順）
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function placeShapeItems(items, shapeItems) {
    let next = 0;
    const place = (list) => list.map((item) => {
        if (item.kind === ITEM_KIND.GROUP) {
            return { ...item, children: place(item.children) };
        }
        const placed = shapeItems[next];
        next += 1;
        return placed;
    });
    return place(items);
}

/**
 * keep(shape) が偽の図形のアイテムだけを除いた新しい入れ子を返す。
 * フォルダは中身が空になっても残す。keep は図形1つにつき1回、前順で呼ぶ。引数は書き換えない。
 * @param {Item[]} items - アイテムの入れ子
 * @param {(shape: Object) => boolean} keep - 残すなら true を返す判定
 * @returns {Item[]} 新しいアイテムの入れ子
 */
export function filterShapes(items, keep) {
    const result = [];
    for (const item of items) {
        if (item.kind === ITEM_KIND.GROUP) {
            result.push({ ...item, children: filterShapes(item.children, keep) });
        } else if (keep(item.shape)) {
            result.push(item);
        }
    }
    return result;
}
