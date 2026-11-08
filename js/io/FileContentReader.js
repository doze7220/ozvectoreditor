/**
 * 責務: 開く・インポートで選ばれたファイルのテキストを中身で判別し（作業データ・スプライトのJSON・スプライトのJS）、
 * 作業データ（スプライトはsource）をDocumentSerializer.deserializeへ渡す読み込みの入口を担う。JSは実行しない。DOMに依存しない。
 */
import { DocumentSerializer } from './DocumentSerializer.js';
import { SpriteSerializer } from './SpriteSerializer.js';
import { CodeExporter } from './CodeExporter.js';

/**
 * 開く・インポートで選ばれたファイルのテキストから図形を復元する入口（静的メソッドのみ。状態を持たない）。
 * 呼び出し元は`CanvasFileOperations`（`edit/`）。
 *
 * ■ 判別の順序
 *   1. `JSON.parse(text)`を試す。成功すればその値を`data`とする（「JSONから」）。
 *   2. 失敗したら`CodeExporter.extractSpriteDataText(text)`でスプライトデータのJSONのテキストを取り出し
 *      （JSは実行しない。`import`・`eval`・`Function`を使わない）、`JSON.parse`して`data`とする（「JSから」）。
 *      取り出せない・`JSON.parse`に失敗した場合は読み込み不可。
 *   3. `SpriteSerializer.checkFormat(data)`で判別する。
 *
 *   | checkFormatの結果      | 「JSONから」                              | 「JSから」       |
 *   | ---------------------- | ----------------------------------------- | ---------------- |
 *   | 'notSprite'            | `DocumentSerializer.deserialize(data)`    | 読み込み不可     |
 *   | 'unsupportedVersion'   | 読み込み不可                              | 読み込み不可     |
 *   | 'supported'            | `source`が無ければ読み込み不可。あれば`DocumentSerializer.deserialize(data.source)` |（同左）|
 *
 * ■ 規則
 *   - スプライトの`elements`・`bounds`は読まない（`source`だけを使う）。
 *   - 全体失敗の警告（`console.warn`）はどの経路でも1回（本クラス自身が判定した読み込み不可は本クラスが、
 *     `DocumentSerializer`の判定による失敗は`DocumentSerializer`が出す）。
 *   - 作業データファイルの結果は`DocumentSerializer.deserializeFromString`と同じ分類になる
 *     （JSONとして解析できない場合の`error`の文字列と警告の出し手のみ異なる）。
 *   - 例外を投げない。引数・取り出した値を書き換えない。
 *   - 識別子・版の値は`SpriteSerializer`、JSの形は`CodeExporter`、作業データ・旧版の変換は`DocumentSerializer`だけが知る。
 */
export class FileContentReader {
    /**
     * ファイルのテキストを中身で判別し、図形を復元する。例外を投げない。
     * @param {string} text - ファイルのテキスト（作業データのJSON・スプライトのJSON・スプライトのJS）
     * @returns {import('./DocumentSerializer.js').DeserializeResult} 結果オブジェクト（`DocumentSerializer`の結果と同じ形）
     */
    static deserializeFromText(text) {
        let data;
        let fromModule = false;
        try {
            data = JSON.parse(text);
        } catch (jsonError) {
            const dataText = CodeExporter.extractSpriteDataText(text);
            if (dataText === null) {
                return FileContentReader.#failure('JSONとして解析できず、スプライトのJSからも取り出せません');
            }
            try {
                data = JSON.parse(dataText);
            } catch (embeddedError) {
                return FileContentReader.#failure('スプライトのJSに埋め込まれたデータをJSONとして解析できません');
            }
            fromModule = true;
        }

        const check = SpriteSerializer.checkFormat(data);
        if (check === 'notSprite') {
            if (fromModule) {
                return FileContentReader.#failure('JSに埋め込まれたデータがスプライトではありません');
            }
            return DocumentSerializer.deserialize(data);
        }
        if (check === 'unsupportedVersion') {
            return FileContentReader.#failure('対応していないスプライトの書き出し形式の版です');
        }
        if (data.source === undefined) {
            return FileContentReader.#failure('スプライトにsourceがありません');
        }
        return DocumentSerializer.deserialize(data.source);
    }

    /**
     * 本クラス自身が判定した読み込み不可の結果オブジェクトを生成し、console.warnで1回報告する。
     * @param {string} reason - 読み込み不可の理由
     * @returns {import('./DocumentSerializer.js').DeserializeResult} ok=false・shapes/skippedが空配列の結果オブジェクト
     */
    static #failure(reason) {
        console.warn('FileContentReader: ファイルを読み込めませんでした: ' + reason);
        return { ok: false, shapes: [], skipped: [], error: reason };
    }
}
