/**
 * 責務：KeyboardShortcuts（キー→操作の対応表と受理判定）のうち、document非依存で確かめられる起動時の配線漏れの検出を検証する。
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardShortcuts } from '../../js/core/KeyboardShortcuts.js';

/**
 * 指定した名前を除く、どのプロパティ名にも関数を返すコールバック群（Proxy）を作る補助。
 * action名の一覧をテスト側へ二重に書かないために、プロパティ参照のたびに関数を返す。
 * @param {string} excludedName 関数を返さない（undefinedにする）プロパティ名
 * @returns {Object} コールバック群として渡せるProxy
 */
function createActionsExcept(excludedName) {
    return new Proxy({}, {
        /**
         * プロパティ参照のトラップ。除外名以外には関数を返す。
         * @param {Object} target 対象（未使用）
         * @param {string|symbol} name 参照されたプロパティ名
         * @returns {Function|undefined} 除外名ならundefined、それ以外は常にtrueを返す関数
         */
        get(target, name) {
            return name === excludedName ? undefined : () => true;
        },
    });
}

/**
 * コンストラクタが投げたErrorの文言から、欠落として列挙された名前の一覧を取り出す補助。
 * @param {Object} actions コンストラクタへ渡すコールバック群
 * @returns {string[]} 文言に列挙された欠落名（Errorが投げられなければテストが失敗する）
 */
function getMissingNames(actions) {
    let message = null;
    try {
        new KeyboardShortcuts(actions);
    } catch (error) {
        assert.ok(error instanceof Error);
        message = error.message;
    }
    assert.notEqual(message, null, 'Errorが投げられること');
    return message.split(': ').pop().split(', ');
}

describe('KeyboardShortcuts コンストラクタの配線検証', () => {
    it('コールバックが空なら Error を投げ、文言に nudgeSelection と isDragging が含まれる', () => {
        assert.throws(() => new KeyboardShortcuts({}), (error) => {
            assert.ok(error instanceof Error);
            assert.ok(error.message.includes('nudgeSelection'));
            assert.ok(error.message.includes('isDragging'));
            return true;
        });
    });

    it('nudgeSelection だけを欠くと Error を投げ、欠落名が nudgeSelection だけになる', () => {
        assert.deepEqual(getMissingNames(createActionsExcept('nudgeSelection')), ['nudgeSelection']);
    });
});
