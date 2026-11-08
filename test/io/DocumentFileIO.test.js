/**
 * 責務: DocumentFileIOのファイル名とキャンバス名の変換規則（作業データファイル・スプライト）を検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DocumentFileIO } from '../../js/io/DocumentFileIO.js';

/**
 * テスト用のDocumentFileIOを作る。
 * @returns {DocumentFileIO} 新しいインスタンス
 */
function createIO() {
    return new DocumentFileIO();
}

describe('DocumentFileIO.toFileName（作業データファイル）', () => {
    it('拡張子は.ozve.jsonになる', () => {
        assert.equal(createIO().toFileName('ship'), 'ship.ozve.json');
    });

    it('使えない文字を_へ置換する', () => {
        assert.equal(createIO().toFileName('a\\b/c:d*e?f"g<h>i|j'), 'a_b_c_d_e_f_g_h_i_j.ozve.json');
        assert.equal(createIO().toFileName('a\u0001b'), 'a_b.ozve.json');
    });

    it('前後の空白と末尾のピリオドを除く', () => {
        assert.equal(createIO().toFileName('  ship  '), 'ship.ozve.json');
        assert.equal(createIO().toFileName('ship. . '), 'ship.ozve.json');
    });

    it('先頭の_は除かない', () => {
        assert.equal(createIO().toFileName('_hero'), '_hero.ozve.json');
    });

    it('空なら無題になる', () => {
        assert.equal(createIO().toFileName(''), '無題.ozve.json');
        assert.equal(createIO().toFileName('  ..'), '無題.ozve.json');
    });

    it('文字列以外は無題として扱う', () => {
        assert.equal(createIO().toFileName(undefined), '無題.ozve.json');
        assert.equal(createIO().toFileName(null), '無題.ozve.json');
        assert.equal(createIO().toFileName(123), '無題.ozve.json');
    });
});

describe('DocumentFileIO.toSpriteModuleFileName・toSpriteJsonFileName', () => {
    it('拡張子は.js・.jsonになる', () => {
        assert.equal(createIO().toSpriteModuleFileName('ship'), 'ship.js');
        assert.equal(createIO().toSpriteJsonFileName('ship'), 'ship.json');
    });

    it('先頭の_と空白をすべて除く', () => {
        assert.equal(createIO().toSpriteModuleFileName('_hero'), 'hero.js');
        assert.equal(createIO().toSpriteJsonFileName('__ a'), 'a.json');
        assert.equal(createIO().toSpriteModuleFileName('_ _a_b'), 'a_b.js');
    });

    it('除去で空になれば無題になる', () => {
        assert.equal(createIO().toSpriteModuleFileName('___'), '無題.js');
        assert.equal(createIO().toSpriteJsonFileName('_ _'), '無題.json');
        assert.equal(createIO().toSpriteJsonFileName(''), '無題.json');
    });

    it('使えない文字の置換の後に先頭の_を除く', () => {
        assert.equal(createIO().toSpriteModuleFileName('/ship'), 'ship.js');
        assert.equal(createIO().toSpriteJsonFileName('a/b'), 'a_b.json');
    });

    it('前後の空白・末尾のピリオドを除く', () => {
        assert.equal(createIO().toSpriteModuleFileName('  ship. '), 'ship.js');
    });

    it('文字列以外は無題として扱う', () => {
        assert.equal(createIO().toSpriteModuleFileName(undefined), '無題.js');
        assert.equal(createIO().toSpriteJsonFileName(42), '無題.json');
    });
});

describe('DocumentFileIO.toCanvasName', () => {
    it('.ozve.jsonを除く', () => {
        assert.equal(createIO().toCanvasName('ship.ozve.json'), 'ship');
    });

    it('従来の.jsonを除く', () => {
        assert.equal(createIO().toCanvasName('ship.json'), 'ship');
    });

    it('大文字小文字を区別しない', () => {
        assert.equal(createIO().toCanvasName('ship.OZVE.JSON'), 'ship');
        assert.equal(createIO().toCanvasName('ship.JSON'), 'ship');
    });

    it('1回だけ除く', () => {
        assert.equal(createIO().toCanvasName('a.ozve.json.ozve.json'), 'a.ozve.json');
        assert.equal(createIO().toCanvasName('a.json.json'), 'a.json');
    });

    it('スプライトの.jsを除く（大文字小文字を区別しない）', () => {
        assert.equal(createIO().toCanvasName('ship.js'), 'ship');
        assert.equal(createIO().toCanvasName('ship.JS'), 'ship');
    });

    it('.jsも1回だけ除き、末尾の拡張子だけを見る', () => {
        assert.equal(createIO().toCanvasName('a.json.js'), 'a.json');
        assert.equal(createIO().toCanvasName('a.js.ozve.json'), 'a.js');
        assert.equal(createIO().toCanvasName('a.js.js'), 'a.js');
    });

    it('拡張子が無ければそのまま・文字列以外は空', () => {
        assert.equal(createIO().toCanvasName('ship'), 'ship');
        assert.equal(createIO().toCanvasName(undefined), '');
    });
});

describe('DocumentFileIO の往復（toFileName → toCanvasName）', () => {
    it('名前が変わらない', () => {
        const io = createIO();
        for (const name of ['a', 'a.ozve', 'a.json', 'a.ozve.json', 'a.js']) {
            assert.equal(io.toCanvasName(io.toFileName(name)), name);
        }
        assert.equal(io.toFileName('a.ozve'), 'a.ozve.ozve.json');
        assert.equal(io.toFileName('a.json'), 'a.json.ozve.json');
        assert.equal(io.toFileName('a.js'), 'a.js.ozve.json');
    });

    it('従来のship.jsonはshipとして読める', () => {
        assert.equal(createIO().toCanvasName('ship.json'), 'ship');
    });
});
