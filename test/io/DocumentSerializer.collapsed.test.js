/**
 * 責務: DocumentSerializerのフォルダの折りたたみ（collapsed）の書き出し・読み込み・往復と、折りたたみが書き出しのelements・boundsを変えないことを、公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
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
 * @param {boolean} collapsed - 閉じているか
 * @returns {object} フォルダのアイテム
 */
function groupItem(id, children, collapsed) {
    const item = { kind: 'group', id, name: id, visible: true, locked: false, children };
    if (collapsed) {
        item.collapsed = true;
    }
    return item;
}

/**
 * 作業データを読み、フォルダの折りたたみの真偽を前順に返す。
 * @param {object} data - 作業データ
 * @returns {Array<boolean>} 入れ子の最上位のフォルダのcollapsed（キーの有無でなく値がtrueか）
 */
function readCollapsed(data) {
    const result = DocumentSerializer.deserialize(data);
    assert.equal(result.ok, true);
    return result.items.map((item) => item.collapsed === true);
}

/**
 * フォルダが1つの作業データを作る。
 * @param {object} [extra] - フォルダの要素へ足すキー
 * @returns {object} 作業データ
 */
function docWithGroup(extra = {}) {
    return {
        format: 'oz-vector-editor',
        version: 4,
        shapes: [{ type: 'group', id: 'G1', name: 'G', visible: true, locked: false, ...extra, children: [] }],
    };
}

describe('DocumentSerializer: 折りたたみの書き出し', () => {
    it('閉じているときだけcollapsed: trueのキーがあり、キー順はtype, id, name, visible, locked, collapsed, children', () => {
        const closed = DocumentSerializer.serialize([groupItem('G1', [shapeItem('a')], true)]);
        assert.deepEqual(Object.keys(closed.shapes[0]), ['type', 'id', 'name', 'visible', 'locked', 'collapsed', 'children']);
        assert.equal(closed.shapes[0].collapsed, true);
        const open = DocumentSerializer.serialize([groupItem('G1', [shapeItem('a')], false)]);
        assert.deepEqual(Object.keys(open.shapes[0]), ['type', 'id', 'name', 'visible', 'locked', 'children']);
    });

    it('開いている絵のJSONは、collapsedを持たないアイテムと同じ', () => {
        const withKey = groupItem('G1', [shapeItem('a')], false);
        withKey.collapsed = false;
        assert.equal(
            DocumentSerializer.serializeToString([withKey]),
            DocumentSerializer.serializeToString([groupItem('G1', [shapeItem('a')], false)])
        );
        assert.equal(DocumentSerializer.serializeToString([withKey]).includes('collapsed'), false);
    });

    it('入れ子の中の閉じたフォルダも書かれ、versionは4のまま', () => {
        const data = DocumentSerializer.serialize([groupItem('G1', [groupItem('G2', [], true)], false)]);
        assert.equal(data.version, 4);
        assert.equal(Object.hasOwn(data.shapes[0], 'collapsed'), false);
        assert.equal(data.shapes[0].children[0].collapsed, true);
    });

    it('図形のアイテムにcollapsedがあっても要素には書かれない', () => {
        const item = shapeItem('a');
        item.collapsed = true;
        assert.equal(Object.hasOwn(DocumentSerializer.serialize([item]).shapes[0], 'collapsed'), false);
    });
});

describe('DocumentSerializer: 折りたたみの読み込み', () => {
    it('collapsed: trueは閉じている', () => {
        assert.deepEqual(readCollapsed(docWithGroup({ collapsed: true })), [true]);
    });

    it('キーが無い・文字列・1・null・falseは開いている（キーも持たない）', () => {
        assert.deepEqual(readCollapsed(docWithGroup()), [false]);
        for (const value of ['true', 1, null, false]) {
            const result = DocumentSerializer.deserialize(docWithGroup({ collapsed: value }));
            assert.equal(result.ok, true);
            assert.equal(Object.hasOwn(result.items[0], 'collapsed'), false, String(value));
        }
    });

    it('図形の要素のcollapsedは無視される', () => {
        const doc = DocumentSerializer.serialize([shapeItem('a')]);
        doc.shapes[0].collapsed = true;
        const result = DocumentSerializer.deserialize(doc);
        assert.equal(result.ok, true);
        assert.equal(Object.hasOwn(result.items[0], 'collapsed'), false);
    });

    it('往復（オブジェクト層・文字列層）で入れ子の折りたたみが戻る', () => {
        const items = [groupItem('G1', [groupItem('G2', [shapeItem('a')], true), shapeItem('b')], true), groupItem('G3', [], false)];
        for (const result of [
            DocumentSerializer.deserialize(DocumentSerializer.serialize(items)),
            DocumentSerializer.deserializeFromString(DocumentSerializer.serializeToString(items)),
        ]) {
            assert.equal(result.ok, true);
            assert.equal(result.items[0].collapsed, true);
            assert.equal(result.items[0].children[0].collapsed, true);
            assert.equal(Object.hasOwn(result.items[1], 'collapsed'), false);
        }
    });

    it('版1〜3のフォルダは今までどおり読み飛ばされる', (t) => {
        t.mock.method(console, 'warn', () => {});
        for (const version of [1, 2, 3]) {
            const doc = {
                format: 'oz-vector-editor',
                version,
                shapes: [{ type: 'group', id: 'G1', collapsed: true, children: [] }],
            };
            const result = DocumentSerializer.deserialize(doc);
            assert.equal(result.ok, true, `version ${version}`);
            assert.equal(result.items.length, 0, `version ${version}`);
            assert.equal(result.skipped.length, 1, `version ${version}`);
        }
    });
});

describe('SpriteSerializer: 折りたたみと書き出し', () => {
    it('elements・boundsは折りたたみで変わらず、作業データにはcollapsedが入る', () => {
        const openItems = [groupItem('G1', [shapeItem('a')], false)];
        const closedItems = [groupItem('G1', [shapeItem('a')], true)];
        const open = SpriteSerializer.serialize(openItems);
        const closed = SpriteSerializer.serialize(closedItems);
        assert.deepEqual(closed.elements, open.elements);
        assert.deepEqual(closed.bounds, open.bounds);
        const closedSource = DocumentSerializer.serialize(closedItems);
        const openSource = DocumentSerializer.serialize(openItems);
        assert.equal(closedSource.shapes[0].collapsed, true);
        assert.equal(Object.hasOwn(openSource.shapes[0], 'collapsed'), false);
        assert.equal(closedSource.version, 4);
    });
});
