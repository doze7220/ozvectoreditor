/**
 * 責務: 図形種別一覧の正本（対応表）と、種別に応じたインスタンス生成・図形データからの復元の振り分けを一元的に担うFactory。
 * `core/`層で図形種別の対応づけを許容する唯一の例外。
 */
import { Line } from '../shapes/Line.js';
import { Curve } from '../shapes/Curve.js';
import { Rect } from '../shapes/Rect.js';
import { Ellipse } from '../shapes/Ellipse.js';
import { Path } from '../shapes/Path.js';

/**
 * 図形種別の対応表の1エントリ。
 * @typedef {Object} ShapeRegistryEntry
 * @property {string} type 図形種別（各図形クラスのtypeプロパティ・図形データのtypeと一致）
 * @property {((x1: number, y1: number, x2: number, y2: number) => Object) | null} create
 *     始点・終点（ワールド座標）から図形インスタンスを新規生成する。
 *     nullは「作れない種別」（読み込み専用。ツールパレット・数字キーに出さず、createもできない。fromJSONでのみ復元される）
 * @property {(data: Object) => Object} fromJSON
 *     図形データから図形インスタンスを復元する（各図形クラスのstatic fromJSONへ委譲。不正なデータではErrorをthrowする）
 */

/**
 * 図形種別の対応表（図形種別一覧の正本）。
 * 並び順＝ツールパレットの図形のボタン順＝数字キー（1〜）の割り当て順（KeyboardShortcutsがこの並びを前提とする）。
 * この並びの意味はcreateがnullでないエントリについてのもの。createがnullの読み込み専用のエントリ（path）は末尾に置き、ツールパレットのボタンは不要。
 * 作成できる図形種別を追加する際は、ここへ1エントリを追加し、index.htmlのツールパレットに`#tool-${type}`のボタンを用意する（`ToolRules`の`TOOL_IDS`は`SHAPE_TYPES`から導出されるため変更不要）。
 * @type {ReadonlyArray<Readonly<ShapeRegistryEntry>>}
 */
const SHAPE_REGISTRY = Object.freeze([
    Object.freeze({ type: 'line',   create: (x1, y1, x2, y2) => new Line(x1, y1, x2, y2),              fromJSON: (data) => Line.fromJSON(data) }),
    Object.freeze({ type: 'curve',  create: (x1, y1, x2, y2) => new Curve(x1, y1, x2, y2),             fromJSON: (data) => Curve.fromJSON(data) }),
    Object.freeze({ type: 'arc',    create: (x1, y1, x2, y2) => new Ellipse(x1, y1, x2, y2, 'arc'),    fromJSON: (data) => Ellipse.fromJSON(data) }),
    Object.freeze({ type: 'rect',   create: (x1, y1, x2, y2) => new Rect(x1, y1, x2, y2),              fromJSON: (data) => Rect.fromJSON(data) }),
    Object.freeze({ type: 'circle', create: (x1, y1, x2, y2) => new Ellipse(x1, y1, x2, y2, 'circle'), fromJSON: (data) => Ellipse.fromJSON(data) }),
    Object.freeze({ type: 'path',   create: null,                                                      fromJSON: (data) => Path.fromJSON(data) }),
]);

/**
 * 図形種別 → 対応表エントリの検索用Map（非公開。SHAPE_REGISTRYから導出する）。
 * @type {Map<string, Readonly<ShapeRegistryEntry>>}
 */
const REGISTRY_BY_TYPE = new Map(SHAPE_REGISTRY.map((entry) => [entry.type, entry]));

/**
 * 作成できる図形種別一覧（SHAPE_REGISTRYのうちcreateがnullでないエントリから導出。並び順も対応表と同一）。
 * createがnullの読み込み専用の種別（path）は含まない。
 * 図形種別の受理判定・ツールパレットの配線（`ToolRules`の`TOOL_IDS`経由）・数字キーの割り当てはすべてこの値を用いる。
 * InputTracker.jsはこれを再exportしている（既存のimport元を変えないため）。
 * @type {ReadonlyArray<string>}
 */
export const SHAPE_TYPES = Object.freeze(
    SHAPE_REGISTRY.filter((entry) => entry.create !== null).map((entry) => entry.type)
);

/**
 * 図形種別に応じた図形インスタンスの生成（create）と、図形データからの復元の振り分け（fromJSON）を行う静的メソッド群。
 * 種別の対応づけはSHAPE_REGISTRYの表引きのみで行い、インスタンス状態を持たない。
 */
export class ShapeFactory {
    /**
     * typeに応じた図形インスタンスを生成する。
     * @param {string} type - 生成する図形の種別（SHAPE_TYPESのいずれか。'path'は作れない）
     * @param {number} x1 - 始点のX座標
     * @param {number} y1 - 始点のY座標
     * @param {number} x2 - 終点のX座標
     * @param {number} y2 - 終点のY座標
     * @returns {Line|Curve|Rect|Ellipse} 生成された図形インスタンス
     * @throws {Error} SHAPE_TYPESに含まれない未知のtype、またはcreateがnullの種別（'path'）が渡された場合
     */
    static create(type, x1, y1, x2, y2) {
        const entry = REGISTRY_BY_TYPE.get(type);
        if (!entry || entry.create === null) {
            throw new Error(`ShapeFactory: unknown shape type "${type}"`);
        }
        return entry.create(x1, y1, x2, y2);
    }

    /**
     * 図形データ（1図形のJSON表現）のtypeに応じて、対応する図形クラスのstatic fromJSONへ復元を振り分ける。
     * 本メソッドは例外を捕捉しない（図形単位の捕捉はDocumentSerializer.deserializeの1箇所で行う）。
     * @param {Object} data - 図形データ（{ type, id, points, strokeColor, strokeWidth, fillColor }。strokeColorはnull＝線なし、fillColorはnull＝塗りなし。pathは closed・segments も持つ）
     * @returns {Line|Curve|Rect|Ellipse|Path} 復元された図形インスタンス
     * @throws {Error} dataがプレーンオブジェクト（null・配列以外のobject）でない場合、
     *     data.typeが対応表に無い（未知の図形種別）場合、
     *     または委譲先の図形クラスのfromJSONが図形データを不正と判定した場合
     */
    static fromJSON(data) {
        if (typeof data !== 'object' || data === null || Array.isArray(data)) {
            throw new Error('ShapeFactory.fromJSON: 図形データがオブジェクトではありません');
        }
        const entry = REGISTRY_BY_TYPE.get(data.type);
        if (!entry) {
            throw new Error(`ShapeFactory.fromJSON: 未知の図形種別です: ${String(data.type)}`);
        }
        return entry.fromJSON(data);
    }
}
