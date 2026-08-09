/**
 * 責務: 図形typeに応じたインスタンス生成を一元的に担うFactory。
 * `core/`層で図形種別分岐を許容する唯一の例外。
 */
import { Line } from '../shapes/Line.js';
import { Curve } from '../shapes/Curve.js';

export class ShapeFactory {
    /**
     * typeに応じた図形インスタンスを生成する。
     * arc/rect/circleは専用クラス未実装のため、暫定的にLineへフォールバックするスタブ。
     * @param {string} type - 生成する図形の種別（'line' | 'curve' | 'arc' | 'rect' | 'circle'）
     * @param {number} x1 - 始点のX座標
     * @param {number} y1 - 始点のY座標
     * @param {number} x2 - 終点のX座標
     * @param {number} y2 - 終点のY座標
     * @returns {Line|Curve} 生成された図形インスタンス（未実装3種は暫定的にLineインスタンスを返す）
     * @throws {Error} 上記5種以外の未知のtypeが渡された場合
     */
    static create(type, x1, y1, x2, y2) {
        switch (type) {
            case 'line':
                return new Line(x1, y1, x2, y2);
            case 'curve':
                return new Curve(x1, y1, x2, y2);
            case 'arc':
            case 'rect':
            case 'circle':
                // TODO(Phase未定): 専用クラス未実装のためLineへポリモーフィックにフォールバックするスタブ
                return new Line(x1, y1, x2, y2);
            default:
                throw new Error(`ShapeFactory: unknown shape type "${type}"`);
        }
    }
}
