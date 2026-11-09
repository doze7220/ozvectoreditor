/**
 * 責務：作業データファイルとスプライトのJSのブラウザ内での読み書き（Blobのダウンロード・Fileの読み取り・ファイル名とキャンバス名の変換）を担う。
 * 中身は解釈しない（文字列として受け渡す）。
 */

/**
 * 作業データファイルの拡張子。
 * @type {string}
 */
const FILE_EXTENSION = '.ozve.json';

/**
 * 作業データファイルのBlobのMIMEタイプ。
 * @type {string}
 */
const FILE_MIME_TYPE = 'application/json';

/**
 * スプライトのJS（ESモジュール）の拡張子。
 * @type {string}
 */
const SPRITE_MODULE_EXTENSION = '.js';

/**
 * スプライトのJSのBlobのMIMEタイプ。
 * @type {string}
 */
const SPRITE_MODULE_MIME_TYPE = 'text/javascript';

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
 * 先頭の`_`と空白の正規表現（スプライトのファイル名のみで使う）。
 * @type {RegExp}
 */
const LEADING_UNDERSCORES_AND_SPACES = /^[_\s]+/u;

/**
 * ファイル名末尾の拡張子（`.ozve.json`・`.json`・`.js`のいずれか、大文字小文字を区別しない）の正規表現。
 * `.ozve.json`があれば`.ozve`ごと除く。
 * @type {RegExp}
 */
const FILE_EXTENSION_PATTERN = /(?:\.ozve)?\.json$|\.js$/i;

/**
 * 作業データファイルとスプライトのファイルの読み書きを担うクラス。
 *
 * 作業データファイルとは、作業データ形式のJSON文字列を内容とするファイル（既定の拡張子`.ozve.json`）である。
 * スプライトのファイルとは、スプライトのJS（`<名前>.js`）である。
 * ファイルの種類ごとの拡張子・MIMEタイプ・ファイル名の規則は本クラスが唯一の定義箇所である。
 * ファイルを開くときにキャンバス名から除く拡張子（`.ozve.json`・`.json`・`.js`）も本クラスが定める。
 * 本クラスは作業データ・スプライトの形式・版・図形の知識を持たず、状態も持たない。
 * 例外・rejectは捕捉しない。呼び出し側で捕捉すること。
 */
export class DocumentFileIO {
    /**
     * テキストを作業データファイル（`<名前>.ozve.json`）としてダウンロードする。
     *
     * @param {string} text ファイルの内容（作業データ形式のJSON文字列。解釈しない）
     * @param {string} canvasName キャンバス名（ファイル名へ`toFileName`で変換する）
     * @returns {void}
     */
    downloadText(text, canvasName) {
        this.#downloadBlob(text, this.toFileName(canvasName), FILE_MIME_TYPE);
    }

    /**
     * テキストをスプライトのJS（`<名前>.js`）としてダウンロードする。
     *
     * @param {string} text ファイルの内容（スプライトのJSのテキスト。解釈しない）
     * @param {string} canvasName キャンバス名（ファイル名へ`toSpriteModuleFileName`で変換する）
     * @returns {void}
     */
    downloadSpriteModule(text, canvasName) {
        this.#downloadBlob(text, this.toSpriteModuleFileName(canvasName), SPRITE_MODULE_MIME_TYPE);
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
     * キャンバス名を作業データファイルのファイル名へ変換する。
     *
     * 規則：
     *   1. `\ / : * ? " < > |`と制御文字を`_`へ置換する。
     *   2. 前後の空白を除き、末尾のピリオドと空白を除く。
     *   3. 結果が空なら既定の名前`無題`とする（連番は付けない）。
     *   4. 末尾に`.ozve.json`を付ける（先頭の`_`は除かない）。
     * 開くときは`toCanvasName`が末尾の`.ozve.json`を1回だけ除くため、往復で名前が変わらない
     * （例：`a` → `a.ozve.json` → `a`、`a.json` → `a.json.ozve.json` → `a.json`、`a.ozve.json` → `a.ozve.json.ozve.json` → `a.ozve.json`）。
     *
     * @param {string} canvasName キャンバス名
     * @returns {string} ファイル名（拡張子`.ozve.json`を含む）
     */
    toFileName(canvasName) {
        return this.#toBaseName(canvasName, false) + FILE_EXTENSION;
    }

    /**
     * キャンバス名をスプライトのJSのファイル名（`<名前>.js`）へ変換する。
     *
     * 規則は`toFileName`の1〜3に加え、前後の空白・末尾のピリオドを除いた後に先頭の`_`と空白をすべて除く
     * （組み立て用のJSは名前の頭に`_`を付け、パーツのJSは付けないため）。除いた結果が空なら`無題`。
     *
     * @param {string} canvasName キャンバス名
     * @returns {string} ファイル名（拡張子`.js`を含む）
     */
    toSpriteModuleFileName(canvasName) {
        return this.#toBaseName(canvasName, true) + SPRITE_MODULE_EXTENSION;
    }

    /**
     * ファイル名をキャンバス名の元になる文字列へ変換する。
     *
     * 本メソッドは末尾の`.ozve.json`・`.json`・`.js`のいずれか（大文字小文字を区別しない）を1回だけ除く
     * （`.ozve.json`があれば`.ozve`ごと除く。従来の`.json`の作業データファイルも、スプライトのJSも開ける）。
     * 例：`ship.js` → `ship`、`a.json.js` → `a.json`、`a.js.ozve.json` → `a.js`。
     * 前後の空白の除去・文字数の切り詰め・空の場合の命名は`CanvasLibrary`が名前の変更と同じ規則で行う。
     *
     * @param {string} fileName ファイル名
     * @returns {string} 末尾の拡張子を1回だけ除いた文字列
     */
    toCanvasName(fileName) {
        const source = typeof fileName === 'string' ? fileName : '';
        return source.replace(FILE_EXTENSION_PATTERN, '');
    }

    /**
     * Blobを作成して`<a download>`でダウンロードする（2つのダウンロード（作業データファイル・スプライトのJS）の共通の手順）。
     *
     * 手順：Blobを作成しオブジェクトURLを得る → 非表示の`<a download>`を`document.body`へ追加して`click()` → 削除。
     * オブジェクトURLの解放は`try/finally`で必ず予約し、`OBJECT_URL_REVOKE_DELAY_MS`（10秒）後に行う。
     * 理由：ブラウザによってはダウンロードの開始が`click()`より後になり、直後に解放すると失敗するため。
     * ダウンロードの準備中の例外はそのまま投げる（呼び出し側で捕捉すること）。
     *
     * @param {string} text ファイルの内容
     * @param {string} fileName ダウンロードのファイル名
     * @param {string} mimeType BlobのMIMEタイプ
     * @returns {void}
     */
    #downloadBlob(text, fileName, mimeType) {
        const blob = new Blob([text], { type: mimeType });
        const url = URL.createObjectURL(blob);
        try {
            const link = document.createElement('a');
            link.href = url;
            link.download = fileName;
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
     * キャンバス名からファイル名の拡張子を除いた部分を求める（ファイル名の共通の手順）。
     *
     * @param {string} canvasName キャンバス名（文字列以外は空として扱う）
     * @param {boolean} stripLeadingUnderscores trueなら先頭の`_`と空白をすべて除く（スプライト用）
     * @returns {string} ファイル名の拡張子を除いた部分（空なら既定の`無題`）
     */
    #toBaseName(canvasName, stripLeadingUnderscores) {
        const source = typeof canvasName === 'string' ? canvasName : '';
        let base = source
            .replace(INVALID_FILE_NAME_CHARS, '_')
            .trim()
            .replace(TRAILING_DOTS_AND_SPACES, '');
        if (stripLeadingUnderscores) {
            base = base.replace(LEADING_UNDERSCORES_AND_SPACES, '');
        }
        return base || DEFAULT_FILE_BASE_NAME;
    }
}
