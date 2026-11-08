/**
 * 責務: 確認用ページで、選んだファイルの中身が本アプリのスプライトかの判定（JSONの値・JSの既定のexport）と、情報欄に出す値の要約を担う。
 * DOMに依存しない。
 */
import { SpriteSerializer } from '../io/SpriteSerializer.js';

/**
 * テキストの見分け結果。`kind: 'json'`＝JSONとして解析できた（`value`が解析結果）／`kind: 'module'`＝JSONではない（JSとして`import`する側）。
 * @typedef {{kind: 'json', value: *}|{kind: 'module'}} ParsedText
 */

/**
 * 判定の結果。`ok: true`＝本アプリのスプライト／`ok: false`＝`reason`が理由の区分。
 * `notSprite`＝本アプリのスプライトの形ではない／`unsupportedVersion`＝書き出し形式の版が範囲外。
 * @typedef {{ok: true}|{ok: false, reason: 'notSprite'|'unsupportedVersion'}} InspectResult
 */

/**
 * 外枠の要約。`state: 'none'`＝外枠なし（`null`）／`'ok'`＝4つの値が有限の数値（幅・高さ付き）／`'invalid'`＝それ以外（形が不正）。値は丸めない。
 * @typedef {{state: 'none'}|{state: 'invalid'}|{state: 'ok', minX: number, minY: number, maxX: number, maxY: number, width: number, height: number}} BoundsSummary
 */

/**
 * 情報欄に出す値の要約。
 * `formatVersion`＝書き出し形式の版（そのままの値）／`sourceVersion`＝作業データの版（無ければ`null`）／`elementCount`＝描画要素の数（配列でなければ`null`＝不明）／`bounds`＝外枠の要約。
 * @typedef {Object} SpriteSummary
 * @property {*} formatVersion
 * @property {*} sourceVersion
 * @property {number|null} elementCount
 * @property {BoundsSummary} bounds
 */

/**
 * 値がプレーンなオブジェクト（`null`・配列以外の`object`）かを返す。
 * @param {*} value - 調べる値
 * @returns {boolean} プレーンなオブジェクトなら`true`
 */
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * 確認用ページの判定・要約を行う静的メソッド群。インスタンス状態を持たず、DOM・`import`・描画を扱わない。
 * 識別子・版の条件は`SpriteSerializer.checkFormat`に任せ、定数を重複して持たない。呼び出し元: `SpriteCheckPage`。
 */
export class SpriteCheckInspector {
    /**
     * テキストがJSONかを中身で見分ける（拡張子に頼らない）。例外を投げない。
     * @param {string} text - ファイルのテキスト
     * @returns {ParsedText} `JSON.parse`できれば`{ kind: 'json', value }`、できなければ`{ kind: 'module' }`
     */
    static parseText(text) {
        try {
            return { kind: 'json', value: JSON.parse(text) };
        } catch {
            return { kind: 'module' };
        }
    }

    /**
     * JSONの値が本アプリのスプライトデータか判定する（`SpriteSerializer.checkFormat`の結果を理由の区分へ写す）。
     * @param {*} value - JSONを解析した値
     * @returns {InspectResult} `'supported'`なら`{ ok: true }`、それ以外は`{ ok: false, reason }`
     */
    static inspectSpriteData(value) {
        const check = SpriteSerializer.checkFormat(value);
        if (check === 'supported') {
            return { ok: true };
        }
        return { ok: false, reason: check };
    }

    /**
     * JSの既定のexportが本アプリのスプライトか判定する（オブジェクトで、`checkFormat`が`'supported'`、かつ`draw`が関数）。
     * @param {*} value - JSを`import`した既定のexport
     * @returns {InspectResult} 判定の結果
     */
    static inspectModuleExport(value) {
        if (typeof value !== 'object' || value === null) {
            return { ok: false, reason: 'notSprite' };
        }
        const check = SpriteSerializer.checkFormat(value);
        if (check !== 'supported') {
            return { ok: false, reason: check };
        }
        if (typeof value.draw !== 'function') {
            return { ok: false, reason: 'notSprite' };
        }
        return { ok: true };
    }

    /**
     * 判定を通ったスプライトデータから情報欄に出す値を要約する。値は丸めない。
     * @param {Object} spriteData - 判定を通ったスプライトデータ
     * @returns {SpriteSummary} 要約
     */
    static summarize(spriteData) {
        const source = spriteData.source;
        const sourceVersion = isPlainObject(source) && source.version !== undefined ? source.version : null;
        const elementCount = Array.isArray(spriteData.elements) ? spriteData.elements.length : null;
        return {
            formatVersion: spriteData.formatVersion,
            sourceVersion,
            elementCount,
            bounds: SpriteCheckInspector.#summarizeBounds(spriteData.bounds),
        };
    }

    /**
     * 外枠の値を要約する。
     * @param {*} bounds - スプライトデータの`bounds`
     * @returns {BoundsSummary} `null`なら`none`、4つとも有限の数値なら`ok`（幅・高さ付き）、それ以外は`invalid`
     */
    static #summarizeBounds(bounds) {
        if (bounds === null) {
            return { state: 'none' };
        }
        if (!isPlainObject(bounds)) {
            return { state: 'invalid' };
        }
        const { minX, minY, maxX, maxY } = bounds;
        const valid = [minX, minY, maxX, maxY].every((v) => typeof v === 'number' && Number.isFinite(v));
        if (!valid) {
            return { state: 'invalid' };
        }
        return { state: 'ok', minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
    }
}
