/**
 * 責務：アイテムの名前・表示・ロック・フォルダの折りたたみ・複合パスの値の規則（名前の整え方・自動の名前の番号・不備の補い・名前の変更）。
 * 状態を持たず、DOMにも触れない。
 */
import { ITEM_KIND, toItems, listItems } from './ItemTreeRules.js';
import { ShapeFactory } from './ShapeFactory.js';

/**
 * 名前の長さの上限（文字数。サロゲートペアは1文字と数える）。
 * @type {number}
 */
const MAX_NAME_LENGTH = 100;

/**
 * フォルダの自動の名前に使う呼び名。
 * @type {string}
 */
const GROUP_LABEL = 'フォルダ';

/**
 * 自動の名前の形 `<呼び名><半角空白><番号>` に一致する正規表現。
 * 第1グループ＝呼び名、第2グループ＝番号（先頭が0でない整数）。改行を含む名前には一致しない。
 * @type {RegExp}
 */
const AUTO_NAME_PATTERN = /^(.*[^\s]) ([1-9][0-9]*)$/;

/**
 * 名前を整える。文字列でなければ名前なし、文字列なら前後の空白を除き、先頭100文字に切り、切った後の前後の空白を除く。
 * 本規則は edit/CanvasLibrary のキャンバス名の正規化とは別のもので、共通化しない。
 * @param {*} value - 名前の候補
 * @returns {string} 整えた名前（名前なしは空文字列）
 */
export function normalizeItemName(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return Array.from(value.trim()).slice(0, MAX_NAME_LENGTH).join('').trim();
}

/**
 * 整えた名前が自動の名前の形なら、呼び名ごとの最大番号の表へ反映する。
 * @param {Map<string, number>} maxByLabel - 呼び名 → 最大番号（書き換える）
 * @param {string} name - 整えた名前
 * @returns {void}
 */
function countName(maxByLabel, name) {
    const match = AUTO_NAME_PATTERN.exec(name);
    if (match === null) {
        return;
    }
    const number = Number(match[2]);
    if (!Number.isSafeInteger(number + 1)) {
        return;
    }
    const current = maxByLabel.get(match[1]);
    if (current === undefined || number > current) {
        maxByLabel.set(match[1], number);
    }
}

/**
 * アイテムの自動の名前の呼び名を返す。
 * @param {Object} item - アイテム
 * @returns {string} 呼び名（フォルダは「フォルダ」、図形は種別の呼び名）
 */
function labelOf(item) {
    return item.kind === ITEM_KIND.GROUP ? GROUP_LABEL : ShapeFactory.getTypeLabel(item.shape.type);
}

/**
 * アイテムの並び（アイテムまたは素の図形インスタンス）から、名前・表示・ロックが決まった新しい入れ子を作る。
 * フォルダの collapsed・compound は true のときだけ残し、true 以外ならキーを消す（図形のアイテムには付けない）。
 * 手順：(1) 全アイテムの名前を整える (2) 整えた名前と existingItems の名前から呼び名ごとの最大番号を数える
 * (3) visible が真偽値でなければ true、locked が真偽値でなければ false (4) 名前なしに描画順で「呼び名 最大番号+1」を付ける。
 * 毎回新しいアイテムを返し、引数は書き換えない。2回通しても値は変わらない。
 * @param {Array<Object>} values - アイテムまたは素の図形インスタンスの配列
 * @param {Array<Object>} [existingItems] - 今のキャンバスのアイテムの入れ子（番号の重複を避けるために名前を読むだけ）
 * @returns {Object[]} 名前・表示・ロックが決まった新しいアイテムの入れ子
 */
export function resolveItems(values, existingItems = []) {
    const resolved = toItems(values);
    const flat = listItems(resolved);
    const maxByLabel = new Map();

    for (const item of flat) {
        item.name = normalizeItemName(item.name);
        countName(maxByLabel, item.name);
    }
    for (const item of listItems(existingItems)) {
        countName(maxByLabel, normalizeItemName(item.name));
    }
    for (const item of flat) {
        if (typeof item.visible !== 'boolean') {
            item.visible = true;
        }
        if (typeof item.locked !== 'boolean') {
            item.locked = false;
        }
    }
    for (const item of flat) {
        if (item.kind === ITEM_KIND.GROUP && item.collapsed !== true) {
            delete item.collapsed;
        }
        if (item.kind === ITEM_KIND.GROUP && item.compound !== true) {
            delete item.compound;
        }
    }
    for (const item of flat) {
        if (item.name !== '') {
            continue;
        }
        const label = labelOf(item);
        const next = (maxByLabel.get(label) ?? 0) + 1;
        maxByLabel.set(label, next);
        item.name = `${label} ${next}`;
    }
    return resolved;
}

/**
 * アイテムの名前を変えた新しい入れ子を作る。図形のアイテムは`item.shape.id`、フォルダは`item.id`で探す。
 * 変えない場合（idのアイテムが無い・整えた名前が空・今の名前と同じ）は`null`を返す。
 * 毎回新しいアイテムへ写してから書き換え、引数は書き換えない（図形インスタンスは共有）。
 * @param {Object[]} items - アイテムの入れ子
 * @param {string} id - 名前を変えるアイテムのid（図形のid、またはフォルダのid）
 * @param {*} value - 新しい名前の候補（`normalizeItemName`で整える）
 * @returns {Object[]|null} 名前を変えた新しい入れ子。変わらないときは`null`
 */
export function applyItemRename(items, id, value) {
    const name = normalizeItemName(value);
    if (name === '') {
        return null;
    }
    const copied = toItems(items);
    const target = listItems(copied).find((item) => (
        item.kind === ITEM_KIND.GROUP ? item.id === id : item.shape.id === id
    ));
    if (target === undefined || target.name === name) {
        return null;
    }
    target.name = name;
    return copied;
}
