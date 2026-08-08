/**
 * 責務：各モジュールの初期化と連携(依存性の注入)を担う。
 */

import { VectorModel } from './core/VectorModel.js';
import { CanvasManager } from './core/CanvasManager.js';
import { InputTracker } from './core/InputTracker.js';

// DOMが読み込まれた後に初期化を行う
document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('editor-canvas');
    if (!canvas) {
        console.error('Canvas element not found.');
        return;
    }

    // 1. Model (データ管理)
    const model = new VectorModel();
    
    // 2. View (描画管理)
    const canvasManager = new CanvasManager(canvas);
    
    // 3. Controller (入力管理)
    const inputTracker = new InputTracker(canvas, model);

    // 依存性の注入と連携セットアップ: 
    // Modelのデータが変更されたら、Viewに描画を要求する
    model.onChange(() => {
        canvasManager.render(model.getShapes());
    });
});
