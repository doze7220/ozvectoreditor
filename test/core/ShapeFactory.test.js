/**
 * 責務: ShapeFactoryの種別一覧（SHAPE_TYPES）・生成（create）・図形データからの復元の振り分け（fromJSON）を、
 * 公開APIのみを通して検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ShapeFactory, SHAPE_TYPES } from '../../js/core/ShapeFactory.js';
import { Path } from '../../js/shapes/Path.js';

/**
 * 正常なパスの図形データを新しく作る。
 * @param {boolean} closed - 閉じたパスにするか
 * @returns {Object} パスの図形データ（idを入れたtoJSON()の戻り値）
 */
function makePathData(closed) {
    const path = new Path([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], closed, '#ff0000', 3);
    path.id = 'path-1';
    return path.toJSON();
}

describe('SHAPE_TYPES', () => {
    it('5種・従来の並びで、pathを含まない', () => {
        assert.deepEqual([...SHAPE_TYPES], ['line', 'curve', 'arc', 'rect', 'circle']);
        assert.equal(SHAPE_TYPES.includes('path'), false);
    });

    it('凍結されている', () => {
        assert.equal(Object.isFrozen(SHAPE_TYPES), true);
    });
});

describe('ShapeFactory.create', () => {
    it('SHAPE_TYPESの各種別でtypeが一致する図形を返す', () => {
        for (const type of SHAPE_TYPES) {
            const shape = ShapeFactory.create(type, 0, 0, 10, 10);
            assert.equal(shape.type, type);
        }
    });

    it('pathは作れず、未知の種別と同じ形のErrorをthrowする', () => {
        assert.throws(
            () => ShapeFactory.create('path', 0, 0, 10, 10),
            { name: 'Error', message: 'ShapeFactory: unknown shape type "path"' }
        );
        assert.throws(
            () => ShapeFactory.create('triangle', 0, 0, 10, 10),
            { name: 'Error', message: 'ShapeFactory: unknown shape type "triangle"' }
        );
    });
});

describe('ShapeFactory.fromJSON', () => {
    it('開いたパスの図形データからPathを復元する', () => {
        const data = makePathData(false);
        const shape = ShapeFactory.fromJSON(data);
        assert.ok(shape instanceof Path);
        assert.deepEqual(shape.toJSON(), data);
    });

    it('閉じたパスの図形データからPathを復元する', () => {
        const data = makePathData(true);
        const shape = ShapeFactory.fromJSON(data);
        assert.ok(shape instanceof Path);
        assert.deepEqual(shape.toJSON(), data);
    });

    it('不正なパスの図形データではPath.fromJSONのErrorがそのまま伝わる', () => {
        const data = makePathData(false);
        data.closed = 1;
        assert.throws(
            () => ShapeFactory.fromJSON(data),
            { name: 'Error', message: 'Path.fromJSON: closedが真偽値ではありません' }
        );
    });

    it('オブジェクトでない入力・未知の種別は従来どおりのエラー文', () => {
        assert.throws(
            () => ShapeFactory.fromJSON(null),
            { name: 'Error', message: 'ShapeFactory.fromJSON: 図形データがオブジェクトではありません' }
        );
        assert.throws(
            () => ShapeFactory.fromJSON({ type: 'triangle' }),
            { name: 'Error', message: 'ShapeFactory.fromJSON: 未知の図形種別です: triangle' }
        );
    });
});
