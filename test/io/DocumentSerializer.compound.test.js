/**
 * 責務: DocumentSerializerの複合パス（フォルダのcompound）の書き出し・読み込み・往復と、版4から版5への移行を、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Rect } from '../../js/shapes/Rect.js';

/**
 * idを付けた矩形のアイテムを作る。
 * @param {string} id - 図形のid
 * @returns {object} 図形のアイテム
 */
function shapeItem(id) {
    const shape = new Rect(0, 0, 10, 10);
    shape.id = id;
    return { kind: 'shape', shape, name: id, visible: true, locked: false };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Array<object>} children - 中身
 * @param {*} [compound] - 指定すればcompoundの値として持つ
 * @returns {object} フォルダのアイテム
 */
function groupItem(id, children, compound) {
    const item = { kind: 'group', id, name: id, visible: true, locked: false, children };
    if (compound !== undefined) {
        item.compound = compound;
    }
    return item;
}

/**
 * 作業データを作る。
 * @param {number} version - 版
 * @param {Array<object>} shapes - 要素
 * @returns {object} 作業データ
 */
function doc(version, shapes) {
    return { format: 'oz-vector-editor', version, shapes };
}

/**
 * フォルダの要素を作る。
 * @param {string} id - id
 * @param {Array<object>} children - 子
 * @param {object} [extra] - 追加のキー
 * @returns {object} フォルダの要素
 */
function groupElement(id, children, extra = {}) {
    return { type: 'group', id, name: id, visible: true, locked: false, ...extra, children };
}

describe('DocumentSerializer 版5: 複合パスの書き出し', () => {
    it('現行版は5で、複合パスのフォルダだけがcompound: trueを持ち、キー順はcollapsedの後・childrenの前', () => {
        const data = DocumentSerializer.serialize([
            groupItem('G1', [shapeItem('a')], true),
            { ...groupItem('G2', [], true), collapsed: true },
            groupItem('G3', [shapeItem('b')]),
        ]);
        assert.equal(data.version, 5);
        assert.deepStrictEqual(Object.keys(data.shapes[0]), ['type', 'id', 'name', 'visible', 'locked', 'compound', 'children']);
        assert.deepStrictEqual(Object.keys(data.shapes[1]), ['type', 'id', 'name', 'visible', 'locked', 'collapsed', 'compound', 'children']);
        assert.equal(Object.hasOwn(data.shapes[2], 'compound'), false);
        assert.equal(Object.hasOwn(data.shapes[0].children[0], 'compound'), false);
    });

    it('compoundがtrue以外の値のフォルダは書かない', () => {
        const data = DocumentSerializer.serialize([groupItem('G', [], 'yes')]);
        assert.equal(Object.hasOwn(data.shapes[0], 'compound'), false);
    });
});

describe('DocumentSerializer 版5: 複合パスの読み込みと往復', () => {
    it('書いて読むとcompoundが戻り、入れ子の内側の値も保たれる', () => {
        const items = [groupItem('O', [groupItem('I', [shapeItem('a')], true), groupItem('P', [])], true), groupItem('E', [], true)];
        const result = DocumentSerializer.deserialize(DocumentSerializer.serialize(items));
        assert.equal(result.ok, true);
        assert.equal(result.items[0].compound, true);
        assert.equal(result.items[0].children[0].compound, true);
        assert.equal(Object.hasOwn(result.items[0].children[1], 'compound'), false);
        assert.equal(result.items[1].compound, true);
        assert.deepStrictEqual(DocumentSerializer.serialize(result.items), DocumentSerializer.serialize(items));
    });

    it('文字列層でも往復する', () => {
        const text = DocumentSerializer.serializeToString([groupItem('G', [shapeItem('a')], true)]);
        const result = DocumentSerializer.deserializeFromString(text);
        assert.equal(result.ok, true);
        assert.equal(result.items[0].compound, true);
    });

    it('版5の要素のcompoundがtrue以外ならキーが消える', () => {
        const result = DocumentSerializer.deserialize(doc(5, [
            groupElement('A', [], { compound: false }),
            groupElement('B', [], { compound: 'true' }),
            groupElement('C', [], { compound: 1 }),
        ]));
        assert.equal(result.ok, true);
        result.items.forEach((item) => assert.equal(Object.hasOwn(item, 'compound'), false));
    });
});

describe('DocumentSerializer 版5: 版4から版5への移行', () => {
    it('版4のフォルダのcompoundは入れ子の中も含めて消える', () => {
        const input = doc(4, [groupElement('G', [groupElement('H', [], { compound: true })], { compound: true })]);
        const result = DocumentSerializer.deserialize(input);
        assert.equal(result.ok, true);
        assert.equal(Object.hasOwn(result.items[0], 'compound'), false);
        assert.equal(Object.hasOwn(result.items[0].children[0], 'compound'), false);
    });

    it('移行は引数を書き換えない', () => {
        const input = doc(4, [groupElement('G', [], { compound: true })]);
        const before = JSON.stringify(input);
        DocumentSerializer.deserialize(input);
        assert.equal(JSON.stringify(input), before);
    });

    it('childrenが配列でないフォルダは1件の読み飛ばしのまま', (t) => {
        t.mock.method(console, 'warn', () => {});
        const input = doc(4, [{ type: 'group', id: 'G', compound: true, children: null }]);
        const result = DocumentSerializer.deserialize(input);
        assert.equal(result.ok, true);
        assert.equal(result.skipped.length, 1);
    });

    it('版6以上は全体失敗', (t) => {
        t.mock.method(console, 'warn', () => {});
        assert.equal(DocumentSerializer.deserialize(doc(6, [])).ok, false);
    });
});
