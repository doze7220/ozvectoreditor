/**
 * 責務: 作業データ形式（キャンバス全体の版番号付きJSON表現。図形の名前・表示・ロックとフォルダの入れ子・折りたたみを含む）の
 * シリアライズ・デシリアライズと旧版からのマイグレーションを担う。図形単位の変換はShapeFactory・図形クラスへ委譲する。
 */
import { ShapeFactory } from '../core/ShapeFactory.js';
import { ITEM_KIND, listShapes } from '../core/ItemTreeRules.js';
import { resolveItems } from '../core/ItemAttributeRules.js';

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
const CURRENT_DOCUMENT_VERSION = 4;

/**
 * 作業データのフォルダの要素の`type`の値（作業データ上の識別子。エディタの中のアイテムの`kind`とは別）。
 * @type {string}
 */
const GROUP_TYPE = 'group';

/**
 * 版2→3の変換で、弧の開始角の制御点（points[3]）がすでに約束の位置（左端）にあるとみなす許容量の比。
 * エディタは左端を半径から`xc - rx`で求め、平行移動では全点に同じ量を足すため、保存された`points[3].x`と
 * `c.x - |右端.x - c.x|`は数ulpずれ得る。ちょうどの比較では、エディタが作った今あるデータの値を書き換えてしまうため、
 * この比（丸めの誤差より十分大きい）の範囲内なら値をそのまま写す。points[3]は版2・版3のどちらの読み方でも形に効かない。
 * @type {number}
 */
const ARC_START_POINT_TOLERANCE_RATIO = 1e-9;

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
 * 値が有限の数値の`x`・`y`を持つプレーンオブジェクト（点）かを判定する。
 * @param {*} value - 判定対象
 * @returns {boolean} 点であればtrue
 */
function isFinitePoint(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
        && Number.isFinite(value.x) && Number.isFinite(value.y);
}

/**
 * 版2の円・弧の図形データの5つの点を、版3の読み方に合う今の約束の位置へそろえる。
 * 約束の位置＝points[0]中心、[1]右端(xc + rx, yc)、[2]上端(xc, yc - ry)、[4]右端、[3]は円で右端・弧で左端(xc - rx, yc)。
 * rx = |p1.x - c.x|、ry = |p2.y - c.y|。すでに約束の位置にある右端・上端・弧のpoints[3]は値をそのまま写す（計算し直さない）。
 * `type`が'circle'・'arc'でない・pointsが長さ5の配列でない・いずれかの点がx・yが有限の数値のプレーンオブジェクトでない場合は、
 * そのまま返す（後段の図形単位の検証に任せる）。引数を書き換えない。throwしない。
 * @param {*} item - 版2の図形データ（`shapes`の要素。任意の値）
 * @returns {*} 版3へそろえた図形データ（新しいオブジェクト）。対象外なら引数そのもの
 */
function alignEllipsePointsForVersion3(item) {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return item;
    if (item.type !== 'circle' && item.type !== 'arc') return item;
    if (!Array.isArray(item.points) || item.points.length !== 5 || !item.points.every(isFinitePoint)) return item;

    const [c, p1, p2, p3] = item.points;
    const rx = Math.abs(p1.x - c.x);
    const ry = Math.abs(p2.y - c.y);

    const right = (p1.x >= c.x && p1.y === c.y)
        ? { x: p1.x, y: p1.y }
        : { x: c.x + rx, y: c.y };
    const top = (p2.y <= c.y && p2.x === c.x)
        ? { x: p2.x, y: p2.y }
        : { x: c.x, y: c.y - ry };

    let startControl;
    if (item.type === 'circle') {
        startControl = { x: right.x, y: right.y };
    } else {
        const tolerance = ARC_START_POINT_TOLERANCE_RATIO * Math.max(1, Math.abs(c.x), rx);
        const aligned = p3.y === c.y && p3.x <= c.x && Math.abs((c.x - p3.x) - rx) <= tolerance;
        startControl = aligned ? { x: p3.x, y: p3.y } : { x: c.x - rx, y: c.y };
    }

    return {
        ...item,
        points: [{ x: c.x, y: c.y }, right, top, startControl, { x: right.x, y: right.y }],
    };
}

/**
 * 版2の作業データを版3へ変換する（円・弧の5つの点を今の約束の位置へそろえる）。
 * 版3は円・弧の点を共役な半径として読む（回転・裏返しを表せる）ため、版2で見た目に効かなかった点の向きをそろえる。
 * `shapes`が配列なら各要素を`alignEllipsePointsForVersion3`で写し、配列でなければその値をそのまま入れる。
 * 引数（doc・doc.shapes・各要素）を書き換えない。throwしない。
 * @param {Object} doc - 版2の作業データ（プレーンオブジェクト）
 * @returns {Object} 版3の作業データ（新しいオブジェクト）
 */
function migrateVersion2To3(doc) {
    const shapes = Array.isArray(doc.shapes)
        ? doc.shapes.map(alignEllipsePointsForVersion3)
        : doc.shapes;
    return { ...doc, version: 3, shapes };
}

/**
 * 版3の作業データを版4へ変換する（図形の名前・表示・ロックを補う）。
 * `shapes`のプレーンオブジェクトの要素ごとに、新しいオブジェクトで`name: ''`（名前なし。読み込みの規則が自動の名前を付ける）・
 * `visible: true`・`locked: false`を入れる（版3以前に意味の無かったキーなので、値を持っていても置き換える）。
 * 版3以前の`type: 'group'`の要素は未知の図形種別として読み飛ばされていた。版4でフォルダとして受理されないよう
 * `children: null`を入れる（「`children`が配列でないフォルダ」として1件の読み飛ばしになる）。
 * プレーンオブジェクトでない要素・配列でない`shapes`はそのまま残す。引数を書き換えない。throwしない。
 * @param {Object} doc - 版3の作業データ（プレーンオブジェクト）
 * @returns {Object} 版4の作業データ（新しいオブジェクト）
 */
function migrateVersion3To4(doc) {
    const shapes = Array.isArray(doc.shapes)
        ? doc.shapes.map((item) => {
            if (typeof item !== 'object' || item === null || Array.isArray(item)) return item;
            const filled = { ...item, name: '', visible: true, locked: false };
            return item.type === GROUP_TYPE ? { ...filled, children: null } : filled;
        })
        : doc.shapes;
    return { ...doc, version: 4, shapes };
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
 * 現時点の登録: 版1→版2（migrateVersion1To2。全図形のfillColorをnullにする）、
 * 版2→版3（migrateVersion2To3。円・弧の5つの点を今の約束の位置へそろえる）、
 * 版3→版4（migrateVersion3To4。図形に名前なし・表示・ロックなしを補う）。
 * @type {Readonly<Object<number, (doc: Object) => Object>>}
 */
const MIGRATIONS = Object.freeze({ 1: migrateVersion1To2, 2: migrateVersion2To3, 3: migrateVersion3To4 });

/**
 * 作業データ形式（現行版4）の最上位の形。知らないキーは最上位・図形の要素・フォルダの要素とも読まない。
 * 図形の要素は`{ type, id, points, strokeColor, strokeWidth, fillColor, name, visible, locked }`（pathは`closed`・`segments`が加わり、角の点があるときだけ`corners`も加わる）。
 * フォルダの要素は`{ type: 'group', id, name, visible, locked, (collapsed), children }`（`collapsed: true`は閉じているときだけ書く。無ければ開いている。`children`は図形・フォルダの要素の配列。空でもよい）。
 * strokeColorは色の文字列またはnull（線なし）、fillColorは色の文字列またはnull（塗りなし。キーが無ければnullとして読む）。
 * @typedef {Object} DocumentData
 * @property {string} format 作業データ形式の識別子（'oz-vector-editor'）
 * @property {number} version 作業データ形式の版番号（1以上の整数。シリアライズは常に現行版の4）
 * @property {Array<Object>} shapes 図形の要素・フォルダの要素の配列（描画順。フォルダは自身の次にその中身が並ぶ順で重なる）
 */

/**
 * 読み込めずにスキップした図形の記録。
 * @typedef {Object} SkippedShape
 * @property {number} index 最上位の`shapes`配列内での位置（0始まり。入れ子の中なら、それを含む最上位の要素の位置）
 * @property {Array<number>} path 最上位からの位置の並び（例: [1, 2]＝`shapes[1].children[2]`。最上位なら[index]）
 * @property {string|null} type 要素が文字列の`type`を持てばその値、なければnull
 * @property {string} reason スキップした理由（捕捉したErrorのmessage）
 */

/**
 * デシリアライズの結果オブジェクト。
 * @typedef {Object} DeserializeResult
 * @property {boolean} ok 全体の読み込みに成功したか（全図形がスキップされた場合・図形0個の場合もtrue）
 * @property {Array<Object>} items 復元できたアイテムの入れ子（名前・表示・ロック補い済み。ok=falseなら空配列）
 * @property {Array<Object>} shapes `items`から取り出した図形インスタンスの平らな配列（描画順。ok=falseなら空配列）
 * @property {Array<SkippedShape>} skipped スキップした図形（ok=falseなら空配列）
 * @property {string|null} error 全体の読み込み失敗の理由（ok=trueならnull）
 */

/**
 * 作業データ形式との相互変換を行う静的メソッド群。インスタンス状態を持たず、DOMにも依存しない。
 * 保存対象は図形データ・図形の名前・表示・ロック・フォルダの入れ子のみ（選択集合・ホバー・作成中の図形・選択矩形・ビュー変換は含めない）。
 * 文字列層（serializeToString / deserializeFromString）とオブジェクト層（serialize / deserialize）の両方を提供する。
 * デシリアライズ系のメソッドは例外をthrowせず、すべての失敗をDeserializeResultで返す。
 */
export class DocumentSerializer {
    /**
     * アイテムの並びを作業データ（現行版）へ変換する。図形はtoJSON()（図形データ）に名前・表示・ロックを足した要素、
     * フォルダは`type: 'group'`の要素へ再帰して変換する。入力は検証しない。引数を書き換えない。
     * 名前・表示・ロック・フォルダを保つには、`model.getItems()`または`deserialize`の`items`を渡すこと。
     * 素の図形インスタンスを渡した場合は名前の無い図形のアイテムとして扱い、自動の名前が付く（フォルダは失われる）。
     * @param {Array<Object>} values - アイテム（入れ子）または素の図形インスタンスの配列（描画順）
     * @returns {DocumentData} 新しい作業データオブジェクト（図形インスタンスを共有しない）
     */
    static serialize(values) {
        return {
            format: DOCUMENT_FORMAT,
            version: CURRENT_DOCUMENT_VERSION,
            shapes: resolveItems(values).map((item) => DocumentSerializer.#itemToElement(item)),
        };
    }

    /**
     * アイテムの並びを作業データ（現行版）のJSON文字列へ変換する（字下げ2）。引数の扱いは`serialize`と同じ。
     * @param {Array<Object>} values - アイテム（入れ子）または素の図形インスタンスの配列（描画順）
     * @returns {string} 作業データのJSON文字列
     */
    static serializeToString(values) {
        return JSON.stringify(DocumentSerializer.serialize(values), null, 2);
    }

    /**
     * 作業データ（オブジェクト）からアイテムの入れ子と図形インスタンスを復元する。例外をthrowしない。
     *
     * 全体の読み込み失敗（ok=false。図形は1つも返さない）となる条件:
     *   - 最上位がプレーンオブジェクト（null・配列以外のobject）でない
     *   - formatが'oz-vector-editor'でない
     *   - versionが整数でない／1未満／現行版より大きい
     *   - 必要なマイグレーション関数が未定義、例外をthrowした、またはプレーンオブジェクトを返さなかった
     *   - マイグレーション後のshapesが配列でない
     *   - 入れ子が実行環境の再帰の限界を超えた（RangeErrorなど。深さの制限は設けない）
     *   - 要素の読み取り・resolveItems・listShapesが図形単位の捕捉の外で例外を投げた（種類によらず全体失敗にし、例外は外へ出さない）
     *
     * 図形単位では、ShapeFactory.fromJSONが投げたError（未知の図形種別・不正な図形データ）をここで捕捉し、
     * その要素をスキップとして記録して残りを続行する（図形単位の例外捕捉の唯一の箇所）。
     * `children`が配列でないフォルダも1件のスキップ（type: 'group'。中身は読まない）。
     * スキップ1件ごと、および全体の読み込み失敗時にconsole.warnを出す。
     * 読めた要素にはresolveItemsを1回通し（ファイルの中だけで自動の名前の番号を決める）、`items`とする。
     * フォルダのidは検証せずそのまま持つ（VectorModel.replaceAllShapesが正規化する）。
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

        const skipped = [];
        let items;
        let shapes;
        try {
            items = resolveItems(DocumentSerializer.#readElements(migrated.shapes, [], skipped));
            shapes = listShapes(items);
        } catch (error) {
            if (error instanceof RangeError) {
                return DocumentSerializer.#failure(`入れ子が深すぎて読み込めません: ${DocumentSerializer.#messageOf(error)}`);
            }
            return DocumentSerializer.#failure(`図形を読み込めません: ${DocumentSerializer.#messageOf(error)}`);
        }

        return { ok: true, items, shapes, skipped, error: null };
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
     * @returns {DeserializeResult} ok=false・items/shapes/skippedが空配列の結果オブジェクト
     */
    static #failure(reason) {
        console.warn(`DocumentSerializer: 作業データを読み込めませんでした: ${reason}`);
        return { ok: false, items: [], shapes: [], skipped: [], error: reason };
    }

    /**
     * アイテムを作業データの要素へ変換する（フォルダは再帰）。
     * @param {Object} item - resolveItemsを通したアイテム
     * @returns {Object} 図形の要素（図形データ＋name・visible・locked）またはフォルダの要素（閉じているときだけcollapsedを持つ）
     */
    static #itemToElement(item) {
        if (item.kind === ITEM_KIND.GROUP) {
            const element = {
                type: GROUP_TYPE,
                id: item.id,
                name: item.name,
                visible: item.visible,
                locked: item.locked,
            };
            if (item.collapsed === true) {
                element.collapsed = true;
            }
            element.children = item.children.map((child) => DocumentSerializer.#itemToElement(child));
            return element;
        }
        return { ...item.shape.toJSON(), name: item.name, visible: item.visible, locked: item.locked };
    }

    /**
     * 作業データの要素の配列を再帰で読み、アイテムの配列（名前・表示・ロック・フォルダのcollapsedは要素の値のまま。補い・整えは呼び出し側）を返す。
     * 読めない要素は読み飛ばして`skipped`へ記録する。図形単位ではRangeErrorを再送出し、呼び出し側（deserialize）が全体の失敗にする。
     * @param {Array<*>} elements - 要素の配列
     * @param {Array<number>} parentPath - この配列の最上位からの位置の並び（最上位なら空）
     * @param {Array<SkippedShape>} skipped - 読み飛ばしの記録の追加先
     * @returns {Array<Object>} 読めたアイテムの配列
     */
    static #readElements(elements, parentPath, skipped) {
        const items = [];
        elements.forEach((element, position) => {
            const path = [...parentPath, position];
            if (DocumentSerializer.#isPlainObject(element) && element.type === GROUP_TYPE) {
                if (!Array.isArray(element.children)) {
                    DocumentSerializer.#recordSkip(skipped, path, element, 'フォルダのchildrenが配列ではありません');
                    return;
                }
                items.push({
                    kind: ITEM_KIND.GROUP,
                    id: element.id,
                    name: element.name,
                    visible: element.visible,
                    locked: element.locked,
                    collapsed: element.collapsed,
                    children: DocumentSerializer.#readElements(element.children, path, skipped),
                });
                return;
            }
            try {
                const plain = DocumentSerializer.#isPlainObject(element);
                items.push({
                    kind: ITEM_KIND.SHAPE,
                    shape: ShapeFactory.fromJSON(element),
                    name: plain ? element.name : undefined,
                    visible: plain ? element.visible : undefined,
                    locked: plain ? element.locked : undefined,
                });
            } catch (error) {
                if (error instanceof RangeError) throw error;
                DocumentSerializer.#recordSkip(skipped, path, element, DocumentSerializer.#messageOf(error));
            }
        });
        return items;
    }

    /**
     * 読み飛ばしを記録しconsole.warnを1回出す（読み飛ばしの記録の唯一の箇所）。
     * @param {Array<SkippedShape>} skipped - 記録の追加先
     * @param {Array<number>} path - 最上位からの位置の並び
     * @param {*} element - 読み飛ばした要素
     * @param {string} reason - 読み飛ばした理由
     * @returns {void}
     */
    static #recordSkip(skipped, path, element, reason) {
        const type = DocumentSerializer.#isPlainObject(element) && typeof element.type === 'string' ? element.type : null;
        skipped.push({ index: path[0], path, type, reason });
        console.warn(`DocumentSerializer: 図形 #${path.join('/')}（${type ?? '種別不明'}）を読み飛ばしました: ${reason}`);
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
