/**
 * 責務: ToolRules（ツールの一覧TOOL_IDSと、押し込みにするツールを求めるresolveActiveTool）の振る舞いを検証する。
 */
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { TOOL_IDS, resolveActiveTool } from '../../js/core/ToolRules.js';
import { OperationMode } from '../../js/core/InputTracker.js';
import { SHAPE_TYPES } from '../../js/core/ShapeFactory.js';

/** 図形種別の入力として試す値（全種別・図形ではない値・未知の値・未定義）。 */
const SHAPE_TYPE_INPUTS = [...SHAPE_TYPES, 'path', 'unknown', undefined];

describe('TOOL_IDS', () => {
    test('凍結されている', () => {
        assert.ok(Object.isFrozen(TOOL_IDS));
    });

    test('並びが select, pan, ...SHAPE_TYPES である', () => {
        assert.deepEqual([...TOOL_IDS], ['select', 'pan', ...SHAPE_TYPES]);
    });

    test('先頭2つが OperationMode.SELECT・PAN と同じ値である', () => {
        assert.equal(TOOL_IDS[0], OperationMode.SELECT);
        assert.equal(TOOL_IDS[1], OperationMode.PAN);
    });

    test('重複がない', () => {
        assert.equal(new Set(TOOL_IDS).size, TOOL_IDS.length);
    });

    test('SHAPE_TYPES の全要素を含む', () => {
        for (const type of SHAPE_TYPES) {
            assert.ok(TOOL_IDS.includes(type), type);
        }
    });
});

describe('resolveActiveTool', () => {
    test('選択モードは図形種別によらず select', () => {
        for (const type of SHAPE_TYPE_INPUTS) {
            assert.equal(resolveActiveTool(OperationMode.SELECT, type), 'select');
        }
    });

    test('キャンバス移動モードは図形種別によらず pan', () => {
        for (const type of SHAPE_TYPE_INPUTS) {
            assert.equal(resolveActiveTool(OperationMode.PAN, type), 'pan');
        }
    });

    test('図形作成モードは各図形種別でその種別', () => {
        for (const type of SHAPE_TYPES) {
            assert.equal(resolveActiveTool(OperationMode.CREATE, type), type);
        }
    });

    test('全操作モード×全図形種別で結果が TOOL_IDS にちょうど1回現れる', () => {
        for (const mode of Object.values(OperationMode)) {
            for (const type of SHAPE_TYPES) {
                const result = resolveActiveTool(mode, type);
                assert.equal(TOOL_IDS.filter((id) => id === result).length, 1, `${mode}/${type}`);
            }
        }
    });

    test('未知の mode は null', () => {
        assert.equal(resolveActiveTool('unknown', SHAPE_TYPES[0]), null);
        assert.equal(resolveActiveTool(undefined, SHAPE_TYPES[0]), null);
    });

    test('図形作成モードで図形種別が SHAPE_TYPES 外なら null', () => {
        assert.equal(resolveActiveTool(OperationMode.CREATE, 'path'), null);
        assert.equal(resolveActiveTool(OperationMode.CREATE, 'unknown'), null);
        assert.equal(resolveActiveTool(OperationMode.CREATE, undefined), null);
    });
});
