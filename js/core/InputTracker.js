/**
 * 責務：ユーザー入力の解釈とModelへの反映を担う。
 */
import { Line } from '../shapes/Line.js';

export class InputTracker {
    /**
     * @param {HTMLCanvasElement} canvas - イベントをリッスンするキャンバス
     * @param {Object} model - 図形データを管理するVectorModelインスタンス
     */
    constructor(canvas, model) {
        this.canvas = canvas;
        this.model = model;
        
        // P1-1要件: Canvasへの click イベントリスナーの登録
        this.canvas.addEventListener('click', this.handleClick.bind(this));
    }

    /**
     * クリックイベントのハンドラ
     * 仮の直線データを生成してModelに追加する
     * @param {MouseEvent} event 
     */
    handleClick(event) {
        // 論理座標の取得
        const { x, y } = this.getLogicalCoordinate(event);
        
        // 1クリックで仮の直線を生成（終点は+50固定）
        const dummyLine = new Line(x, y, x + 50, y + 50);
        this.model.addShape(dummyLine);
    }

    /**
     * マウスイベントからCanvas内の論理座標を取得する
     * ※将来的にキャンバスのズーム・パン機能を追加する際は、本メソッドの座標計算ロジックの修正が必要
     * 
     * @param {MouseEvent} event 
     * @returns {{x: number, y: number}} Canvas内部の論理座標
     */
    getLogicalCoordinate(event) {
        const rect = this.canvas.getBoundingClientRect();
        
        // CSSでの表示サイズ（論理サイズ）と実際のDOM要素サイズ（rect）の比率から
        // CSSのズーム等による表示位置ズレを完全に吸収して論理座標へ逆換算する
        const scaleX = this.canvas.clientWidth / rect.width;
        const scaleY = this.canvas.clientHeight / rect.height;
        
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;

        return { x, y };
    }
}
