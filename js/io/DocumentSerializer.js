/**
 * 責務: 作業データ形式（キャンバス全体の版番号付きJSON表現）のシリアライズ・デシリアライズと旧版からのマイグレーションを担う。
 * 図形単位の変換はShapeFactory・図形クラスへ委譲する。
 */
import { ShapeFactory } from '../core/ShapeFactory.js';

/**
 * 作業データ形式の識別子。作業データ最上位の`format`に格納し、読み込み時に一致を検証する。
 * @type {string}
 */
const DOCUMENT_FORMAT = 'oz-vector-editor';

/**
 * 作業データ形式の現行版番号（現行版の唯一の定義箇所）。
 * シリアライズは常にこの版で出力し、デシリアライズは1〜この版までを受理する（旧版はMIGRATIONSで現行版へ変換する）。
 * @type {number}
 */
const CURRENT_DOCUMENT_VERSION = 2;

/**
 * 版1の作業データを版2へ変換する（全図形を塗りなしにする）。
 * 版1に`fillColor`の意味はないため、`shapes`のプレーンオブジェクトの要素は`fillColor`を持っていても`null`にする。
 * `strokeColor`・`strokeWidth`には触れない（`strokeWidth`が無い要素は図形クラスの検証で2pxになる）。
 * プレーンオブジェクトでない要素はそのまま残す（後段の図形単位の検証でスキップされる）。
 * `shapes`が配列でなければその値をそのまま入れる（後段の「shapesが配列ではありません」の全体失敗に任せる）。
 * 引数（doc・doc.shapes・各要素）を書き換えない。throwしない。
 * @param {Object} doc - 版1の作業データ（プレーンオブジェクト）
 * @returns {Object} 版2の作業データ（新しいオブジェクト）
 */
function migrateVersion1To2(doc) {
    const shapes = Array.isArray(doc.shapes)
        ? doc.shapes.map((item) => (
            typeof item === 'object' && item !== null && !Array.isArray(item)
                ? { ...item, fillColor: null }
                : item
        ))
        : doc.shapes;
    return { ...doc, version: 2, shapes };
}

/**
 * 作業データ形式のマイグレーション表。
 * キー＝変換元の版n、値＝「版nの作業データ（プレーンオブジェクト）を受け取り、版n+1の作業データを新しいオブジェクトとして返す関数」。
 * 関数は引数を書き換えてはならない。変換できない場合はErrorをthrowしてよい（全体の読み込み失敗として扱う）。
 *
 * 版を追加する手順:
 *   1. このMIGRATIONSへ `[旧版]: (doc) => 新版のdoc` を追加する
 *   2. CURRENT_DOCUMENT_VERSIONを+1する
 *   3. 図形クラスのtoJSON/fromJSONを新版の図形データへ更新する
 *      （図形クラスは常に現行版のみを扱い、旧版の知識はこのMIGRATIONSに閉じる）
 *
 * 現時点の登録: 版1→版2（migrateVersion1To2。全図形のfillColorをnullにする）。
 * @type {Readonly<Object<number, (doc: Object) => Object>>}
 */
const MIGRATIONS = Object.freeze({ 1: migrateVersion1To2 });

/**
 * 作業データ形式（現行版2）の最上位の形。
 * 図形データの形は`{ type, id, points, strokeColor, strokeWidth, fillColor }`（pathは`closed`・`segments`が加わる）。
 * strokeColorは色の文字列またはnull（線なし）、fillColorは色の文字列またはnull（塗りなし。キーが無ければnullとして読む）。
 * @typedef {Object} DocumentData
 * @property {string} format 作業データ形式の識別子（'oz-vector-editor'）
 * @property {number} version 作業データ形式の版番号（1以上の整数。シリアライズは常に現行版の2）
 * @property {Array<Object>} shapes 図形データ（{ type, id, points, strokeColor, strokeWidth, fillColor }）の配列（描画順）
 */

/**
 * 読み込めずにスキップした図形の記録。
 * @typedef {Object} SkippedShape
 * @property {number} index 作業データの`shapes`配列内での位置（0始まり）
 * @property {string|null} type 要素が文字列の`type`を持てばその値、なければnull
 * @property {string} reason スキップした理由（捕捉したErrorのmessage）
 */

/**
 * デシリアライズの結果オブジェクト。
 * @typedef {Object} DeserializeResult
 * @property {boolean} ok 全体の読み込みに成功したか（全図形がスキップされた場合・図形0個の場合もtrue）
 * @property {Array<Object>} shapes 復元できた図形インスタンス（描画順。ok=falseなら空配列）
 * @property {Array<SkippedShape>} skipped スキップした図形（ok=falseなら空配列）
 * @property {string|null} error 全体の読み込み失敗の理由（ok=trueならnull）
 */

/**
 * 作業データ形式との相互変換を行う静的メソッド群。インスタンス状態を持たず、DOMにも依存しない。
 * 保存対象は図形データのみ（選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない）。
 * 文字列層（serializeToString / deserializeFromString）とオブジェクト層（serialize / deserialize）の両方を提供する。
 * デシリアライズ系のメソッドは例外をthrowせず、すべての失敗をDeserializeResultで返す。
 */
export class DocumentSerializer {
    /**
     * 図形の配列を作業データ（現行版）へ変換する。各図形はtoJSON()（図形データ）へ変換する。
     * @param {Array<Object>} shapes - 図形インスタンスの配列（描画順）
     * @returns {DocumentData} 新しい作業データオブジェクト（図形インスタンスを共有しない）
     */
    static serialize(shapes) {
        return {
            format: DOCUMENT_FORMAT,
            version: CURRENT_DOCUMENT_VERSION,
            shapes: shapes.map((shape) => shape.toJSON()),
        };
    }

    /**
     * 図形の配列を作業データ（現行版）のJSON文字列へ変換する（字下げ2）。
     * @param {Array<Object>} shapes - 図形インスタンスの配列（描画順）
     * @returns {string} 作業データのJSON文字列
     */
    static serializeToString(shapes) {
        return JSON.stringify(DocumentSerializer.serialize(shapes), null, 2);
    }

    /**
     * 作業データ（オブジェクト）から図形インスタンスを復元する。例外をthrowしない。
     *
     * 全体の読み込み失敗（ok=false。図形は1つも返さない）となる条件:
     *   - 最上位がプレーンオブジェクト（null・配列以外のobject）でない
     *   - formatが'oz-vector-editor'でない
     *   - versionが整数でない／1未満／現行版より大きい
     *   - 必要なマイグレーション関数が未定義、例外をthrowした、またはプレーンオブジェクトを返さなかった
     *   - マイグレーション後のshapesが配列でない
     *
     * 図形単位では、ShapeFactory.fromJSONが投げたError（未知の図形種別・不正な図形データ）をここで捕捉し、
     * その要素をスキップとして記録して残りを続行する（図形単位の例外捕捉の唯一の箇所）。
     * スキップ1件ごと、および全体の読み込み失敗時にconsole.warnを出す。
     * 引数のオブジェクトは書き換えない。
     * @param {*} documentData - 作業データ（JSON.parse済みのオブジェクト）
     * @returns {DeserializeResult} 結果オブジェクト
     */
    static deserialize(documentData) {
        if (!DocumentSerializer.#isPlainObject(documentData)) {
            return DocumentSerializer.#failure('作業データがオブジェクトではありません');
        }
        if (documentData.format !== DOCUMENT_FORMAT) {
            return DocumentSerializer.#failure(`作業データ形式が一致しません: ${String(documentData.format)}`);
        }
        const version = documentData.version;
        if (!Number.isInteger(version) || version < 1 || version > CURRENT_DOCUMENT_VERSION) {
            return DocumentSerializer.#failure(
                `対応していない版番号です: ${String(version)}（対応範囲: 1〜${CURRENT_DOCUMENT_VERSION}）`
            );
        }

        let migrated = documentData;
        for (let v = version; v < CURRENT_DOCUMENT_VERSION; v++) {
            const migrate = Object.prototype.hasOwnProperty.call(MIGRATIONS, v) ? MIGRATIONS[v] : undefined;
            if (typeof migrate !== 'function') {
                return DocumentSerializer.#failure(`版${v}から版${v + 1}へのマイグレーションが定義されていません`);
            }
            try {
                migrated = migrate(migrated);
            } catch (error) {
                return DocumentSerializer.#failure(
                    `版${v}から版${v + 1}へのマイグレーションに失敗しました: ${DocumentSerializer.#messageOf(error)}`
                );
            }
            if (!DocumentSerializer.#isPlainObject(migrated)) {
                return DocumentSerializer.#failure(`版${v}から版${v + 1}へのマイグレーション結果がオブジェクトではありません`);
            }
        }

        if (!Array.isArray(migrated.shapes)) {
            return DocumentSerializer.#failure('shapesが配列ではありません');
        }

        const shapes = [];
        const skipped = [];
        migrated.shapes.forEach((item, index) => {
            try {
                shapes.push(ShapeFactory.fromJSON(item));
            } catch (error) {
                const type = DocumentSerializer.#isPlainObject(item) && typeof item.type === 'string' ? item.type : null;
                const reason = DocumentSerializer.#messageOf(error);
                skipped.push({ index, type, reason });
                console.warn(`DocumentSerializer: 図形 #${index}（${type ?? '種別不明'}）を読み飛ばしました: ${reason}`);
            }
        });

        return { ok: true, shapes, skipped, error: null };
    }

    /**
     * 作業データのJSON文字列から図形インスタンスを復元する。例外をthrowしない。
     * JSON.parseに失敗した場合は全体の読み込み失敗の結果を返し、成功した場合はdeserializeへ委ねる。
     * @param {string} text - 作業データのJSON文字列
     * @returns {DeserializeResult} 結果オブジェクト
     */
    static deserializeFromString(text) {
        let documentData;
        try {
            documentData = JSON.parse(text);
        } catch (error) {
            return DocumentSerializer.#failure(`JSONとして解析できません: ${DocumentSerializer.#messageOf(error)}`);
        }
        return DocumentSerializer.deserialize(documentData);
    }

    /**
     * 全体の読み込み失敗の結果オブジェクトを生成し、console.warnで報告する。
     * @param {string} reason - 失敗の理由
     * @returns {DeserializeResult} ok=false・shapes/skippedが空配列の結果オブジェクト
     */
    static #failure(reason) {
        console.warn(`DocumentSerializer: 作業データを読み込めませんでした: ${reason}`);
        return { ok: false, shapes: [], skipped: [], error: reason };
    }

    /**
     * 値がプレーンオブジェクト（null・配列以外のobject）かを判定する。
     * @param {*} value - 判定対象
     * @returns {boolean} プレーンオブジェクトであればtrue
     */
    static #isPlainObject(value) {
        return typeof value === 'object' && value !== null && !Array.isArray(value);
    }

    /**
     * 捕捉した例外から理由の文字列を取り出す（Error以外がthrowされた場合も文字列化する）。
     * @param {*} error - 捕捉した例外
     * @returns {string} 理由の文字列
     */
    static #messageOf(error) {
        return error instanceof Error ? error.message : String(error);
    }
}
