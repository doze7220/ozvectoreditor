/**
 * 責務: `source`の無いJS（新しいJS）の開く・インポート・出力が、CanvasFileOperationsの手順として成り立つことと、組み立てた図形が編集できることを検証する。
 * 実物のVectorModel・ShapeInserter・HistoryManager・SnapshotAdapter・PathJoiner・ShapeStyleEditor・PathCornerEditorを組み合わせ、ダウンロード・キャンバス管理だけ偽物にする。公開APIだけを通す。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CanvasFileOperations } from '../../js/edit/CanvasFileOperations.js';
import { ShapeInserter } from '../../js/edit/ShapeInserter.js';
import { SnapshotAdapter } from '../../js/edit/SnapshotAdapter.js';
import { PathJoiner } from '../../js/edit/PathJoiner.js';
import { ShapeStyleEditor } from '../../js/edit/ShapeStyleEditor.js';
import { PathCornerEditor } from '../../js/edit/PathCornerEditor.js';
import { VectorModel } from '../../js/core/VectorModel.js';
import { HistoryManager } from '../../js/core/HistoryManager.js';
import { OperationMode } from '../../js/core/InputModes.js';
import { DocumentSerializer } from '../../js/io/DocumentSerializer.js';
import { SpriteSerializer } from '../../js/io/SpriteSerializer.js';
import { CodeExporter } from '../../js/io/CodeExporter.js';
import { Line } from '../../js/shapes/Line.js';
import { Rect } from '../../js/shapes/Rect.js';
import { Ellipse } from '../../js/shapes/Ellipse.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * console.warn を、そのテストの終了時に自動で元へ戻るモックへ置き換えて抑止する。
 * @param {import('node:test').TestContext} t - テストコンテキスト
 * @returns {object} console.warn のモック
 */
function silenceWarn(t) {
    return t.mock.method(console, 'warn', () => {});
}

/**
 * 名前・表示・ロック・フォルダを持つ元の絵（隠した図形・ロックした図形・フォルダを含む）を作る。
 * 見えている図形は6つ（直線・矩形・円・弧・閉じたパス・開いたパス）。隠した矩形だけが色`#bb0003`を持つ。
 * @returns {object[]} アイテムの入れ子
 */
function sourceItems() {
    return [
        {
            kind: 'group', name: 'フォルダF', visible: true, locked: false, children: [
                { kind: 'shape', shape: new Line(0, 0, 50, 0, '#aa0001', 3, null), name: '線A', visible: true, locked: false },
                { kind: 'shape', shape: new Rect(0, 10, 40, 50, '#00aa02', 2, '#ffee00'), name: '矩形B', visible: true, locked: false }
            ]
        },
        { kind: 'shape', shape: new Rect(200, 0, 240, 40, '#bb0003', 2, null), name: 'かくれ', visible: false, locked: false },
        { kind: 'shape', shape: new Ellipse(100, 100, 160, 140, 'circle', '#0000cc', 2, '#ccddee'), name: '丸', visible: true, locked: true },
        { kind: 'shape', shape: new Ellipse(100, 200, 160, 240, 'arc', '#0000dd', 2, null), name: '弧', visible: true, locked: false },
        {
            kind: 'shape',
            shape: new Path([{ x: 300, y: 0 }, { x: 340, y: 0 }, { x: 320, y: 30 }], true, '#123456', 2, '#abcdef'),
            name: '三角', visible: true, locked: false
        },
        {
            kind: 'shape',
            shape: new Path([{ x: 400, y: 0 }, { x: 430, y: 20 }, { x: 460, y: 0 }], false, '#654321', 2, null),
            name: '折れ線', visible: true, locked: false
        }
    ];
}

/**
 * 描画要素の並びからスプライトデータを作る（書き出しの戻り値の形。`bounds`は読まれない）。
 * @param {object[]} elements - 描画要素の並び
 * @returns {object} スプライトデータ
 */
function spriteOf(elements) {
    return { ...SpriteSerializer.serialize([]), elements };
}

/**
 * スプライトデータを新しいJSのテキストにする。
 * @param {object} spriteData - スプライトデータ
 * @returns {string} JSのテキスト
 */
function jsOf(spriteData) {
    return CodeExporter.toModuleText(spriteData);
}

/**
 * 実物を組み合わせた手順を作る。ダウンロードの内容とキャンバスを開く呼び出しを記録する。
 * @param {object[]} [items] - モデルへ入れるアイテム（既定は1つの矩形）
 * @returns {object} 手順・実物・記録
 */
function setup(items = [{ kind: 'shape', shape: new Rect(0, 0, 10, 10, '#112233', 2, null) }]) {
    const model = new VectorModel();
    model.replaceAllShapes(items);
    const adapter = new SnapshotAdapter({ model, shouldRestoreSelection: () => true });
    const history = new HistoryManager({
        capture: () => adapter.capture(),
        restore: (snapshot) => adapter.restore(snapshot)
    });
    const inserter = new ShapeInserter({ model, editRecorder: history });
    const downloads = [];
    const opened = [];
    const modeState = { mode: OperationMode.SELECT };
    const fileIO = {
        /**
         * @param {{name: string}} file - ファイルの偽物
         * @returns {string} ファイル名
         */
        getFileName: (file) => file.name,
        /**
         * @param {{text: string}} file - ファイルの偽物
         * @returns {Promise<string>} 中身
         */
        readText: (file) => Promise.resolve(file.text),
        /**
         * @param {string} name - ファイル名
         * @returns {string} キャンバス名
         */
        toCanvasName: (name) => name,
        /**
         * @param {string} text - 中身
         * @param {string} name - 名前
         * @returns {void}
         */
        downloadText: (text, name) => {
            downloads.push({ name, text });
        },
        /**
         * @param {string} text - JSの中身
         * @param {string} name - 名前
         * @returns {void}
         */
        downloadSpriteModule: (text, name) => {
            downloads.push({ name, text });
        }
    };
    const canvasLibrary = {
        /**
         * @returns {object} 状態
         */
        getState: () => ({
            loading: false, busy: false, canManage: true, openCanvasId: 'c', openCanvasName: 'C',
            canvases: [], issue: null, hasSaveProblem: false
        }),
        /**
         * @returns {void}
         */
        onChange: () => {},
        /**
         * @param {string} name - 名前
         * @param {object[]} received - 渡されたアイテム
         * @returns {Promise<boolean>} 常に true
         */
        createCanvasFromShapes: (name, received) => {
            opened.push({ name, items: received });
            return Promise.resolve(true);
        }
    };
    const ops = new CanvasFileOperations({ fileIO, canvasLibrary, inserter, model, prepareInsert: () => {} });
    const joiner = new PathJoiner({ model, editRecorder: history, screenLengthToWorld: (length) => length });
    const styleEditor = new ShapeStyleEditor({ model, editRecorder: history });
    const corner = new PathCornerEditor({ model, editRecorder: history, getMode: () => modeState.mode });
    return { ops, model, history, downloads, opened, joiner, styleEditor, corner, modeState };
}

/**
 * アイテムの入れ子を、作業データの`shapes`部分のJSON文字列にする（順序・値の比較用）。
 * @param {object[]} items - アイテムの入れ子
 * @returns {string} JSON文字列
 */
function shapesJson(items) {
    return JSON.stringify(DocumentSerializer.serialize(items).shapes);
}

/**
 * 元の絵を書き出した新しいJSのテキストを作る（`exportSprite`を通す）。
 * @returns {string} JSのテキスト
 */
function exportedJs() {
    const h = setup(sourceItems());
    h.ops.exportSprite();
    return h.downloads[0].text;
}

/**
 * 組み立てた絵を開いたキャンバスに相当する手順を作る（開いて渡されたアイテムを新しいモデルへ入れる）。
 * @param {string} text - 開くJSのテキスト
 * @returns {Promise<object>} 組み立てた絵を持つ手順
 */
async function openedSetup(text) {
    const h = setup();
    await h.ops.openFile({ name: 'n.js', text });
    return setup(h.opened[0].items);
}

describe('CanvasFileOperations: 新しいJS（sourceなし）の出力', () => {
    it('出力（エンジン用）のテキストにsource・名前・フォルダ・隠した図形が無い', () => {
        const text = exportedJs();
        assert.equal(text.includes('"source"'), false);
        assert.equal(text.includes('"id"'), false);
        for (const word of ['フォルダF', '線A', '矩形B', 'かくれ', '丸', '弧', '三角', '折れ線', '"children"', '"group"']) {
            assert.equal(text.includes(word), false, word);
        }
        assert.equal(text.includes('#bb0003'), false, '隠した図形の色');
        assert.equal(text.includes('#0000cc'), true, 'ロックした図形は出る');
    });
});

describe('CanvasFileOperations: 新しいJSを開く', () => {
    it('図形が並び、自動の名前・フォルダなし・表示あり・ロックなしで開き、通知が出ない', async (t) => {
        silenceWarn(t);
        const h = setup();
        const result = await h.ops.openFile({ name: 'new.js', text: exportedJs() });
        assert.equal(result, true);
        assert.equal(h.opened.length, 1);
        assert.equal(h.opened[0].name, 'new.js');
        const items = h.opened[0].items;
        assert.equal(items.length, 6);
        assert.deepStrictEqual(items.map((i) => i.kind), ['shape', 'shape', 'shape', 'shape', 'shape', 'shape']);
        assert.deepStrictEqual(items.map((i) => i.shape.toJSON().type), ['line', 'path', 'circle', 'arc', 'path', 'path']);
        assert.deepStrictEqual(items.map((i) => i.visible), [true, true, true, true, true, true]);
        assert.deepStrictEqual(items.map((i) => i.locked), [false, false, false, false, false, false]);
        for (const item of items) {
            assert.equal(typeof item.name, 'string');
            assert.notEqual(item.name, '');
        }
        assert.equal(new Set(items.map((i) => i.name)).size, 6, '名前は図形ごとに別');
        assert.equal(h.ops.getState().fileNotice, null);
    });

    it('矩形は4点・4区間の閉じたパスになり、色・太さ・塗りが戻る', async (t) => {
        silenceWarn(t);
        const h = setup();
        await h.ops.openFile({ name: 'new.js', text: exportedJs() });
        const rect = h.opened[0].items[1].shape.toJSON();
        assert.equal(rect.type, 'path');
        assert.equal(rect.closed, true);
        assert.equal(rect.points.length, 4);
        assert.equal(rect.segments.length, 4);
        assert.equal(rect.strokeColor, '#00aa02');
        assert.equal(rect.fillColor, '#ffee00');
    });
});

describe('CanvasFileOperations: 新しいJSのインポート', () => {
    it('追加した図形だけが選ばれ、1件の記録で、取り消し1回で元どおり・やり直しで戻る', async (t) => {
        silenceWarn(t);
        const h = setup();
        const beforeIds = h.model.getShapes().map((s) => s.id);
        const before = shapesJson(h.model.getItems());
        const result = await h.ops.importFile({ name: 'new.js', text: exportedJs() });
        assert.equal(result, true);
        assert.equal(h.model.getShapes().length, 1 + 6);
        const addedIds = h.model.getShapes().map((s) => s.id).filter((id) => !beforeIds.includes(id));
        assert.equal(addedIds.length, 6);
        assert.deepStrictEqual([...h.model.getSelectedIds()].sort(), [...addedIds].sort());
        assert.equal(h.ops.getState().fileNotice, null);
        const after = shapesJson(h.model.getItems());
        assert.equal(h.history.undo(), true);
        assert.equal(shapesJson(h.model.getItems()), before);
        assert.equal(h.history.canUndo(), false, '記録は1件');
        assert.equal(h.history.redo(), true);
        assert.equal(shapesJson(h.model.getItems()), after);
    });
});

describe('CanvasFileOperations: 新しいJSの一部・すべてが読めない・空', () => {
    const bad = { kind: 'bogus' };

    it('一部が読めない: 開くもインポートも読めた分だけで、partialReadと件数', async (t) => {
        silenceWarn(t);
        const data = SpriteSerializer.serialize(sourceItems());
        const text = jsOf({ ...data, elements: [bad, ...data.elements, { kind: 'polyline', points: 'x' }] });

        const opening = setup();
        assert.equal(await opening.ops.openFile({ name: 'p.js', text }), true);
        assert.equal(opening.opened[0].items.length, 6);
        assert.deepStrictEqual(opening.ops.getState().fileNotice, { kind: 'partialRead', fileName: 'p.js', skippedCount: 2 });

        const importing = setup();
        assert.equal(await importing.ops.importFile({ name: 'p.js', text }), true);
        assert.equal(importing.model.getShapes().length, 1 + 6);
        assert.deepStrictEqual(importing.ops.getState().fileNotice, { kind: 'partialRead', fileName: 'p.js', skippedCount: 2 });
    });

    for (const [title, elements] of [
        ['すべて読めない', [bad, { kind: 'polyline', points: 'x' }]],
        ['elementsが配列でない', 'いいえ']
    ]) {
        it(`${title}: readFailedで、開くもインポートも何も変えない`, async (t) => {
            silenceWarn(t);
            const text = jsOf({ ...spriteOf([]), elements });

            const opening = setup();
            const openBefore = shapesJson(opening.model.getItems());
            assert.equal(await opening.ops.openFile({ name: 'x.js', text }), false);
            assert.equal(opening.opened.length, 0);
            assert.equal(opening.ops.getState().fileNotice.kind, 'readFailed');
            assert.equal(shapesJson(opening.model.getItems()), openBefore);

            const importing = setup();
            const importBefore = shapesJson(importing.model.getItems());
            assert.equal(await importing.ops.importFile({ name: 'x.js', text }), false);
            assert.equal(importing.ops.getState().fileNotice.kind, 'readFailed');
            assert.equal(shapesJson(importing.model.getItems()), importBefore);
            assert.equal(importing.history.canUndo(), false);
        });
    }

    it('空（elementsが0個）: 開くは空のキャンバス・通知なし、インポートはnoShapesで何も変えない', async (t) => {
        silenceWarn(t);
        const text = jsOf(spriteOf([]));

        const opening = setup();
        assert.equal(await opening.ops.openFile({ name: 'e.js', text }), true);
        assert.equal(opening.opened.length, 1);
        assert.deepStrictEqual(opening.opened[0].items, []);
        assert.equal(opening.ops.getState().fileNotice, null);

        const importing = setup();
        const before = shapesJson(importing.model.getItems());
        assert.equal(await importing.ops.importFile({ name: 'e.js', text }), false);
        assert.equal(importing.ops.getState().fileNotice.kind, 'noShapes');
        assert.equal(shapesJson(importing.model.getItems()), before);
        assert.equal(importing.history.canUndo(), false);
    });
});

describe('CanvasFileOperations: 組み立てた図形を開いた後の出力', () => {
    it('作業ファイルの出力→開くで同じ図形が戻る', async (t) => {
        silenceWarn(t);
        const first = await openedSetup(exportedJs());
        first.ops.exportCanvas();
        const second = setup();
        await second.ops.openFile({ name: 'w.json', text: first.downloads[0].text });
        assert.equal(shapesJson(second.opened[0].items), shapesJson(first.model.getItems()));
    });

    it('もう一度のエンジン用の出力が同じ見た目（描画要素・外枠が同じ）', async (t) => {
        silenceWarn(t);
        const text = exportedJs();
        const first = await openedSetup(text);
        first.ops.exportSprite();
        const again = first.downloads[0].text;
        assert.equal(again.includes('"source"'), false);
        assert.equal(again, text);
    });

    it('今までのJS（source入り）を開いて書き出し直すとsourceが無く、フォルダ・名前は戻っていた', async (t) => {
        silenceWarn(t);
        const items = sourceItems();
        const legacy = jsOf({ ...SpriteSerializer.serialize(items), source: DocumentSerializer.serialize(items) });
        const h = setup();
        assert.equal(await h.ops.openFile({ name: 'old.js', text: legacy }), true);
        const opened = h.opened[0].items;
        assert.equal(opened[0].kind, 'group');
        assert.equal(opened[0].name, 'フォルダF');
        assert.equal(opened[1].name, 'かくれ');
        assert.equal(opened[1].visible, false);
        assert.equal(h.ops.getState().fileNotice, null);

        const reopened = setup(opened);
        reopened.ops.exportSprite();
        const rewritten = reopened.downloads[0].text;
        assert.equal(rewritten.includes('"source"'), false);
        assert.equal(rewritten.includes('フォルダF'), false);
        assert.equal(rewritten.includes('#bb0003'), false);
        assert.equal(rewritten, exportedJs());
    });
});

describe('CanvasFileOperations: 組み立てた図形の編集', () => {
    it('2本の直線の結合: 1つのパスになり、取り消しで2本に戻る', async (t) => {
        silenceWarn(t);
        const text = jsOf(spriteOf([
            { kind: 'polyline', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }], closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: null },
            { kind: 'polyline', points: [{ x: 50, y: 0 }, { x: 50, y: 40 }], closed: false, strokeColor: '#000000', strokeWidth: 2, fillColor: null }
        ]));
        const h = await openedSetup(text);
        const shapes = h.model.getShapes();
        assert.deepStrictEqual(shapes.map((s) => s.toJSON().type), ['line', 'line']);
        h.model.setSelection(shapes.map((s) => s.id));
        assert.equal(h.joiner.canJoin(), true);
        assert.equal(h.joiner.join(), true);
        assert.equal(h.model.getShapes().length, 1);
        const joined = h.model.getShapes()[0].toJSON();
        assert.equal(joined.type, 'path');
        assert.equal(joined.points.length, 3);
        assert.equal(h.history.undo(), true);
        assert.equal(h.model.getShapes().length, 2);
    });

    it('色の変更: 組み立てた矩形（パス）の線と塗りの色が変わる', async (t) => {
        silenceWarn(t);
        const h = await openedSetup(exportedJs());
        const rectShape = h.model.getShapes()[1];
        h.model.setSelection([rectShape.id]);
        assert.equal(h.styleEditor.applyStyle({ strokeColor: '#ff0000', fillColor: '#00ff00' }), true);
        const json = h.model.getShapes()[1].toJSON();
        assert.equal(json.type, 'path');
        assert.equal(json.strokeColor, '#ff0000');
        assert.equal(json.fillColor, '#00ff00');
        assert.equal(h.history.undo(), true);
        assert.equal(h.model.getShapes()[1].toJSON().strokeColor, '#00aa02');
    });

    it('直線／曲線の切り替え: 曲線のパスは直線に、直線のパスは曲線にできる', async (t) => {
        silenceWarn(t);
        const curved = {
            kind: 'bezierPath', points: [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }], closed: false,
            segments: [
                { kind: 'cubic', control1: { x: 10, y: -20 }, control2: { x: 40, y: -20 } },
                { kind: 'cubic', control1: { x: 60, y: 20 }, control2: { x: 90, y: 20 } }
            ],
            strokeColor: '#000000', strokeWidth: 2, fillColor: null
        };
        const h = await openedSetup(jsOf(spriteOf([curved])));
        const id = h.model.getShapes()[0].id;
        assert.deepStrictEqual(h.model.getShapes()[0].toJSON().segments.map((s) => s.kind), ['bezier', 'bezier']);
        h.modeState.mode = OperationMode.VERTEX;
        h.model.setSelection([id]);
        h.model.setSelectedVertices(['vertex-0', 'vertex-1', 'vertex-2'].map((handle) => ({ shapeId: id, handle })));
        assert.equal(h.corner.getSegmentSwitchAvailability().toLine, true);
        assert.equal(h.corner.switchSegmentsToLine(), true);
        const lined = h.model.getShapes()[0].toJSON();
        assert.equal(lined.type, 'path');
        assert.deepStrictEqual(lined.segments.map((s) => s.kind), ['line', 'line']);

        h.model.setSelectedVertices(['vertex-0', 'vertex-1', 'vertex-2'].map((handle) => ({ shapeId: id, handle })));
        assert.equal(h.corner.getSegmentSwitchAvailability().toCurve, true);
        assert.equal(h.corner.switchSegmentsToCurve(), true);
        const back = h.model.getShapes()[0].toJSON();
        assert.equal(back.type, 'path');
        assert.equal(back.segments.some((s) => s.kind !== 'line'), true);
    });
});
