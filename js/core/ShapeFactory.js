/**
 * 責務: 図形typeに応じたインスタンス生成を一元的に担うFactory。
 * `core/`層で図形種別分岐を許容する唯一の例外。
 */
import { Line } from '../shapes/Line.js';

export class ShapeFactory {
    /**
     * typeに応じた図形インスタンスを生成する。
     * @param {string} type - 生成する図形の種別（例: 'line'）
     * @param {number} x1 - 始点のX座標
     * @param {number} y1 - 始点のY座標
     * @param {number} x2 - 終点のX座標
     * @param {number} y2 - 終点のY座標
     * @returns {Line} 生成された図形インスタンス
     * @throws {Error} 未知のtypeが渡された場合
     */
    static create(type, x1, y1, x2, y2) {
        if (type === 'line') {
            return new Line(x1, y1, x2, y2);
        }
        throw new Error(`ShapeFactory: unknown shape type "${type}"`);
    }
}
