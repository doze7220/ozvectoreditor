/**
 * 責務：作業データファイルのブラウザ内での読み書き（Blobのダウンロード・Fileの読み取り・ファイル名とキャンバス名の変換）を担う。
 * 作業データの中身は解釈しない（文字列として受け渡す）。
 */

/**
 * 作業データファイルの拡張子。
 * @type {string}
 */
const FILE_EXTENSION = '.json';

/**
 * ダウンロードするBlobのMIMEタイプ。
 * @type {string}
 */
const FILE_MIME_TYPE = 'application/json';

/**
 * ファイル名の変換結果が空になった場合の既定のファイル名（拡張子を除く）。
 * 新規キャンバスの接頭辞「無題」と揃える（連番は付けない）。
 * @type {string}
 */
const DEFAULT_FILE_BASE_NAME = '無題';

/**
 * オブジェクトURLを解放するまでの待ち時間（ミリ秒。唯一の定義箇所）。
 * ブラウザによってはダウンロードの開始が`click()`より後になるため、直後には解放しない。
 * @type {number}
 */
const OBJECT_URL_REVOKE_DELAY_MS = 10000;

/**
 * ファイル名に使えない文字（`\ / : * ? " < > |`と制御文字）の正規表現。
 * @type {RegExp}
 */
const INVALID_FILE_NAME_CHARS = /[\\/:*?"<>|\p{Cc}]/gu;

/**
 * 末尾のピリオドと空白の正規表現。
 * @type {RegExp}
 */
const TRAILING_DOTS_AND_SPACES = /[.\s]+$/u;

/**
 * ファイル名末尾の拡張子（`.json`、大文字小文字を区別しない）の正規表現。
 * @type {RegExp}
 */
const FILE_EXTENSION_PATTERN = /\.json$/i;

/**
 * 作業データファイルの読み書きを担うクラス。
 *
 * 作業データファイルとは、作業データ形式のJSON文字列を内容とするファイル（既定の拡張子`.json`）である。
 * 本クラスは作業データの形式・版・図形の知識を持たず、状態も持たない。
 * 例外・rejectは捕捉しない。呼び出し側で捕捉すること。
 */
export class DocumentFileIO {
    /**
     * テキストを作業データファイルとしてダウンロードする。
     *
     * 手順：Blobを作成しオブジェクトURLを得る → 非表示の`<a download>`を`document.body`へ追加して`click()` → 削除。
     * オブジェクトURLの解放は`try/finally`で必ず予約し、`OBJECT_URL_REVOKE_DELAY_MS`（10秒）後に行う。
     * 理由：ブラウザによってはダウンロードの開始が`click()`より後になり、直後に解放すると失敗するため。
     * ダウンロードの準備中の例外はそのまま投げる（呼び出し側で捕捉すること）。
     *
     * @param {string} text ファイルの内容（作業データ形式のJSON文字列。解釈しない）
     * @param {string} canvasName キャンバス名（ファイル名へ`toFileName`で変換する）
     * @returns {void}
     */
    downloadText(text, canvasName) {
        const blob = new Blob([text], { type: FILE_MIME_TYPE });
        const url = URL.createObjectURL(blob);
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = this.toFileName(canvasName);
            link.hidden = true;
            document.body.appendChild(link);
            try {
                link.click();
            } finally {
                link.remove();
            }
        } finally {
            setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
        }
    }

    /**
     * ファイルの内容をUTF-8のテキストとして読み取る（先頭のBOMは`Blob.text()`が除く）。
     * 失敗時はrejectする（呼び出し側で捕捉すること）。
     *
     * @param {File} file 読み取るファイル
     * @returns {Promise<string>} ファイルの内容
     */
    readText(file) {
        return file.text();
    }

    /**
     * ファイルのファイル名を返す。
     *
     * @param {File} file 対象のファイル
     * @returns {string} ファイル名（拡張子を含む）
     */
    getFileName(file) {
        return file.name;
    }

    /**
     * キャンバス名をダウンロード用のファイル名へ変換する。
     *
     * 規則：
     *   1. `\ / : * ? " < > |`と制御文字を`_`へ置換する。
     *   2. 前後の空白を除き、末尾のピリオドと空白を除く。
     *   3. 結果が空なら既定の名前`無題`とする（連番は付けない）。
     *   4. 末尾に`.json`を付ける（キャンバス名が`a.json`なら`a.json.json`。開くと`a.json`へ戻るため往復で名前が変わらない）。
     *
     * @param {string} canvasName キャンバス名
     * @returns {string} ファイル名（拡張子`.json`を含む）
     */
    toFileName(canvasName) {
        const source = typeof canvasName === 'string' ? canvasName : '';
        const base = source
            .replace(INVALID_FILE_NAME_CHARS, '_')
            .trim()
            .replace(TRAILING_DOTS_AND_SPACES, '');
        return (base || DEFAULT_FILE_BASE_NAME) + FILE_EXTENSION;
    }

    /**
     * ファイル名をキャンバス名の元になる文字列へ変換する。
     *
     * 本メソッドは末尾の`.json`（大文字小文字を区別しない）のみを除く。
     * 前後の空白の除去・文字数の切り詰め・空の場合の命名は`CanvasLibrary`が名前の変更と同じ規則で行う。
     *
     * @param {string} fileName ファイル名
     * @returns {string} 末尾の`.json`を除いた文字列
     */
    toCanvasName(fileName) {
        const source = typeof fileName === 'string' ? fileName : '';
        return source.replace(FILE_EXTENSION_PATTERN, '');
    }
}
