/**
 * 責務: DocumentSerializerの版5（図形の名前・表示・ロックとフォルダの入れ子）の書き出し・読み込み・旧版からの移行を、公開APIのみを通して検証する。
 * 入れ子の読み飛ばし（index・path）・名前の補い・極端に深い入れ子での全体失敗もここで確かめる。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';

/**
 * console.warnを抑止し、呼び出しの記録を返す。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {import('node:test').Mock} warnのモック
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * idを付けた線を作る。
 * @param {string} id - 図形のid
 * @returns {Line} 線
 */
function line(id) {
    const shape = new Line(0, 0, 10, 10);
    shape.id = id;
    return shape;
}

/**
 * idを付けた矩形を作る。
 * @param {string} id - 図形のid
 * @returns {Rect} 矩形
 */
function rect(id) {
    const shape = new Rect(0, 0, 10, 10);
    shape.id = id;
    return shape;
}

/**
 * 図形のアイテムを作る。
 * @param {object} shape - 図形
 * @param {object} [attrs] - name・visible・locked
 * @returns {object} 図形のアイテム
 */
function shapeItem(shape, attrs = {}) {
    return { kind: 'shape', shape, ...attrs };
}

/**
 * フォルダのアイテムを作る。
 * @param {string} id - フォルダのid
 * @param {Array<object>} children - 中身
 * @param {object} [attrs] - name・visible・locked
 * @returns {object} フォルダのアイテム
 */
function groupItem(id, children, attrs = {}) {
    return { kind: 'group', id, children, ...attrs };
}

/**
 * 図形の要素（版3の形）を作る。
 * @param {string} id - 図形のid
 * @param {object} [extra] - 足すキー
 * @returns {object} 図形の要素
 */
function lineElement(id, extra = {}) {
    return { ...line(id).toJSON(), ...extra };
}

/**
 * 作業データを作る。
 * @param {number} version - 版
 * @param {Array<*>} shapes - 要素の配列
 * @returns {object} 作業データ
 */
function doc(version, shapes) {
    return { format: 'oz-vector-editor', version, shapes };
}

/**
 * 入れ子の中の名前を前順で集める。
 * @param {Array<object>} items - アイテム
 * @returns {Array<string>} 名前の並び
 */
function namesOf(items) {
    return items.flatMap((item) => [item.name, ...(item.kind === 'group' ? namesOf(item.children) : [])]);
}

describe('DocumentSerializer 版5: 書き出し', () => {
    it('図形の要素は図形データの後ろにname・visible・lockedが並び、フォルダの要素はこのキー順', () => {
        const items = [
            groupItem('group-1', [shapeItem(line('shape-1'), { name: 'あ', visible: false, locked: true })], { name: 'F', visible: true, locked: false }),
        ];
        const data = DocumentSerializer.serialize(items);
        assert.equal(data.version, 5);
        assert.deepStrictEqual(Object.keys(data), ['format', 'version', 'shapes']);
        assert.deepStrictEqual(Object.keys(data.shapes[0]), ['type', 'id', 'name', 'visible', 'locked', 'children']);
        assert.deepStrictEqual(data.shapes[0], {
            type: 'group', id: 'group-1', name: 'F', visible: true, locked: false,
            children: [{ ...line('shape-1').toJSON(), name: 'あ', visible: false, locked: true }],
        });
        assert.deepStrictEqual(Object.keys(data.shapes[0].children[0]).slice(-3), ['name', 'visible', 'locked']);
    });

    it('素の図形インスタンスは自動の名前が付き、表示・ロックは既定になる', () => {
        const data = DocumentSerializer.serialize([line('a'), rect('b'), line('c')]);
        assert.deepStrictEqual(data.shapes.map((s) => [s.name, s.visible, s.locked]), [
            ['直線 1', true, false], ['矩形 1', true, false], ['直線 2', true, false],
        ]);
    });

    it('引数を書き換えない', () => {
        const items = [groupItem('group-1', [shapeItem(line('a'))])];
        const before = JSON.stringify(items);
        DocumentSerializer.serialize(items);
        assert.equal(JSON.stringify(items), before);
        assert.equal('name' in items[0].children[0], false);
    });
});

describe('DocumentSerializer 版5: 往復', () => {
    /**
     * アイテムの入れ子を作る（空のフォルダ・多段・表示なし・ロックあり）。
     * @returns {Array<object>} アイテム
     */
    function makeNested() {
        return [
            shapeItem(line('shape-1'), { name: '外', visible: true, locked: false }),
            groupItem('group-2', [
                shapeItem(rect('shape-3'), { name: '内', visible: false, locked: true }),
                groupItem('group-4', [], { name: '空', visible: false, locked: false }),
                groupItem('group-5', [shapeItem(line('shape-6'), { name: '奥', visible: true, locked: true })], { name: '多段', visible: true, locked: true }),
            ], { name: '親', visible: false, locked: false }),
        ];
    }

    for (const route of ['オブジェクト層', '文字列層']) {
        it(`${route}: 入れ子・名前・表示・ロックが戻り、書き出し→読み込み→書き出しのJSONが一致する`, (t) => {
            silenceWarn(t);
            const items = makeNested();
            const first = DocumentSerializer.serialize(items);
            const result = route === 'オブジェクト層'
                ? DocumentSerializer.deserialize(first)
                : DocumentSerializer.deserializeFromString(DocumentSerializer.serializeToString(items));
            assert.equal(result.ok, true);
            assert.deepStrictEqual(result.skipped, []);
            assert.deepStrictEqual(result.shapes.map((s) => s.id), ['shape-1', 'shape-3', 'shape-6']);
            assert.deepStrictEqual(result.items.map((i) => i.kind), ['shape', 'group']);
            assert.equal(result.items[1].children[1].children.length, 0);
            assert.deepStrictEqual(namesOf(result.items), ['外', '親', '内', '空', '多段', '奥']);
            assert.equal(result.items[1].children[0].visible, false);
            assert.equal(result.items[1].children[0].locked, true);
            assert.equal(JSON.stringify(DocumentSerializer.serialize(result.items)), JSON.stringify(first));
        });
    }

    it('shapesは前順に平らにした図形の配列（itemsの図形インスタンスと同じ）', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(DocumentSerializer.serialize(makeNested()));
        assert.equal(result.shapes[1], result.items[1].children[0].shape);
    });

    it('深い入れ子（200段）が往復する', (t) => {
        silenceWarn(t);
        let inner = [shapeItem(line('shape-1'))];
        for (let i = 0; i < 200; i++) inner = [groupItem(`group-${i + 2}`, inner)];
        const first = DocumentSerializer.serialize(inner);
        const result = DocumentSerializer.deserialize(first);
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 1);
        assert.equal(JSON.stringify(DocumentSerializer.serialize(result.items)), JSON.stringify(first));
    });
});

describe('DocumentSerializer 版5: 読み込みの規則', () => {
    it('知らないキー（最上位・図形・フォルダ）は読まず、書き出しにも出ない', (t) => {
        silenceWarn(t);
        const data = {
            ...doc(4, [
                { ...lineElement('a', { name: 'x', visible: true, locked: false, extra: 1 }) },
                { type: 'group', id: 'g', name: 'F', visible: true, locked: false, children: [], foo: 'bar' },
            ]),
            unknownTop: true,
        };
        const result = DocumentSerializer.deserialize(data);
        assert.equal(result.ok, true);
        const out = DocumentSerializer.serialize(result.items);
        assert.deepStrictEqual(Object.keys(out), ['format', 'version', 'shapes']);
        assert.equal('extra' in out.shapes[0], false);
        assert.equal('foo' in out.shapes[1], false);
    });

    it('name・visible・lockedの不備を補う（名前なし・前後の空白・長すぎる名前・非真偽値）', (t) => {
        silenceWarn(t);
        const long = 'あ'.repeat(120);
        const result = DocumentSerializer.deserialize(doc(4, [
            lineElement('a', { name: 5, visible: 'no', locked: 1 }),
            lineElement('b', { name: '  X  ' }),
            lineElement('c', { name: long, visible: false, locked: true }),
            lineElement('d'),
        ]));
        assert.deepStrictEqual(result.items.map((i) => [i.name, i.visible, i.locked]), [
            ['直線 1', true, false],
            ['X', true, false],
            ['あ'.repeat(100), false, true],
            ['直線 2', true, false],
        ]);
    });

    it('名前のある要素と自動の名前の番号が重ならない（後ろにあっても）', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(4, [
            lineElement('a', { name: '' }),
            lineElement('b', { name: '直線 3' }),
            lineElement('c', { name: '' }),
        ]));
        assert.deepStrictEqual(result.items.map((i) => i.name), ['直線 4', '直線 3', '直線 5']);
    });

    it('同じデータを2回読むと同じ名前になる', (t) => {
        silenceWarn(t);
        const data = doc(4, [lineElement('a', { name: '' }), { type: 'group', id: 'g', children: [lineElement('b')] }]);
        const first = DocumentSerializer.deserialize(data);
        const second = DocumentSerializer.deserialize(data);
        assert.deepStrictEqual(namesOf(first.items), namesOf(second.items));
        assert.deepStrictEqual(namesOf(first.items), ['直線 1', 'フォルダ 1', '直線 2']);
    });

    it('読み込みは引数を書き換えない', (t) => {
        silenceWarn(t);
        const data = doc(3, [lineElement('a'), { type: 'group', id: 'g' }]);
        const before = JSON.stringify(data);
        DocumentSerializer.deserialize(data);
        assert.equal(JSON.stringify(data), before);
    });
});

describe('DocumentSerializer 版5: children と読み飛ばし', () => {
    for (const [label, children] of [['無い', undefined], ['null', null], ['オブジェクト', {}]]) {
        it(`childrenが${label}フォルダは1件の読み飛ばし（type: group）で、他の図形は残る`, (t) => {
            const warn = silenceWarn(t);
            const group = { type: 'group', id: 'g', name: 'F', visible: true, locked: false };
            if (children !== undefined) group.children = children;
            const result = DocumentSerializer.deserialize(doc(4, [lineElement('a'), group, lineElement('b')]));
            assert.equal(result.ok, true);
            assert.deepStrictEqual(result.shapes.map((s) => s.id), ['a', 'b']);
            assert.equal(result.skipped.length, 1);
            assert.deepStrictEqual(
                { index: result.skipped[0].index, path: result.skipped[0].path, type: result.skipped[0].type },
                { index: 1, path: [1], type: 'group' },
            );
            assert.equal(warn.mock.callCount(), 1);
            assert.match(warn.mock.calls[0].arguments[0], /図形 #1（group）/);
        });
    }

    it('入れ子の中の読み飛ばしは最上位のindexとpathを持ち、警告は1回で、フォルダと他の図形が残る', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(4, [
            lineElement('a'),
            { type: 'group', id: 'g1', children: [
                lineElement('b'),
                { type: 'group', id: 'g2', children: [lineElement('c'), { type: 'unknown-kind' }] },
                { type: 'group', id: 'g3', children: 7 },
            ] },
        ]));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.shapes.map((s) => s.id), ['a', 'b', 'c']);
        assert.deepStrictEqual(result.skipped.map((s) => [s.index, s.path, s.type]), [
            [1, [1, 1, 1], 'unknown-kind'],
            [1, [1, 2], 'group'],
        ]);
        assert.equal(warn.mock.callCount(), 2);
        assert.match(warn.mock.calls[0].arguments[0], /図形 #1\/1\/1（unknown-kind）/);
        assert.equal(result.items[1].children[1].kind, 'group');
        assert.equal(result.items[1].children.length, 2);
    });

    it('プレーンでない要素は種別不明で読み飛ばす（最上位のpathは[index]）', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(4, [null, lineElement('a')]));
        assert.deepStrictEqual(result.skipped.map((s) => [s.index, s.path, s.type]), [[0, [0], null]]);
        assert.equal(result.shapes.length, 1);
    });

    it('フォルダだけ・空のフォルダだけのデータは図形0個・読み飛ばし0件で成功する', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(4, [
            { type: 'group', id: 'g1', children: [{ type: 'group', id: 'g2', children: [] }] },
        ]));
        assert.equal(result.ok, true);
        assert.equal(result.shapes.length, 0);
        assert.equal(result.skipped.length, 0);
        assert.equal(result.items.length, 1);
        assert.equal(result.items[0].children.length, 1);
    });
});

describe('DocumentSerializer 版5: 旧版からの移行', () => {
    it('版3: 名前なし・表示・ロックなしを補い、番号は描画順（種類ごと）', (t) => {
        silenceWarn(t);
        const rectData = { ...rect('r').toJSON() };
        const result = DocumentSerializer.deserialize(doc(3, [lineElement('a'), rectData, lineElement('b')]));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.items.map((i) => [i.name, i.visible, i.locked]), [
            ['直線 1', true, false], ['矩形 1', true, false], ['直線 2', true, false],
        ]);
    });

    it('版3の図形が持つname・visible・lockedは使わない', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(3, [lineElement('a', { name: '手書き', visible: false, locked: true })]));
        assert.deepStrictEqual([result.items[0].name, result.items[0].visible, result.items[0].locked], ['直線 1', true, false]);
    });

    it('版3以前のtype: groupは未知の図形種別と同じく1件の読み飛ばし', (t) => {
        const warn = silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(3, [
            lineElement('a'),
            { type: 'group', id: 'g', children: [lineElement('b')] },
        ]));
        assert.equal(result.ok, true);
        assert.deepStrictEqual(result.shapes.map((s) => s.id), ['a']);
        assert.deepStrictEqual(result.skipped.map((s) => [s.index, s.path, s.type]), [[1, [1], 'group']]);
        assert.equal(warn.mock.callCount(), 1);
    });

    it('版1・版2から版5まで順に移行できる', (t) => {
        silenceWarn(t);
        const circle = new Ellipse(50, 50, 80, 20, 'circle');
        circle.id = 'c';
        const v1 = doc(1, [{ ...lineElement('a'), fillColor: '#ff0000' }]);
        const r1 = DocumentSerializer.deserialize(v1);
        assert.equal(r1.ok, true);
        assert.equal(r1.items[0].name, '直線 1');
        assert.equal(r1.shapes[0].fillColor, null);
        const r2 = DocumentSerializer.deserialize(doc(2, [lineElement('a'), circle.toJSON()]));
        assert.equal(r2.ok, true);
        assert.deepStrictEqual(r2.items.map((i) => i.name), ['直線 1', '円 1']);
    });

    it('版6以上は全体失敗', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(doc(6, []));
        assert.equal(result.ok, false);
        assert.deepStrictEqual(result.items, []);
    });
});

describe('DocumentSerializer 版5: 全体失敗と極端な入れ子', () => {
    it('全体失敗の結果はitems・shapes・skippedが空配列', (t) => {
        silenceWarn(t);
        const result = DocumentSerializer.deserialize(null);
        assert.deepStrictEqual([result.ok, result.items, result.shapes, result.skipped], [false, [], [], []]);
    });

    it('極端に深いデータは例外を投げず全体失敗になる', (t) => {
        const warn = silenceWarn(t);
        let node = { type: 'group', id: 'g0', children: [] };
        for (let i = 1; i < 20000; i++) node = { type: 'group', id: `g${i}`, children: [node] };
        let result;
        assert.doesNotThrow(() => {
            result = DocumentSerializer.deserialize(doc(4, [node]));
        });
        assert.equal(result.ok, false);
        assert.deepStrictEqual([result.items, result.shapes, result.skipped], [[], [], []]);
        assert.equal(warn.mock.callCount(), 1);
    });

    it('循環参照のデータは例外を投げず全体失敗になる', (t) => {
        silenceWarn(t);
        const group = { type: 'group', id: 'g', children: [] };
        group.children.push(group);
        let result;
        assert.doesNotThrow(() => {
            result = DocumentSerializer.deserialize(doc(4, [group]));
        });
        assert.equal(result.ok, false);
    });
});
