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

    /**
     * Modelの現在の状態（shapes/selectedId/hoveredId/draftLine）をそのままCanvasManagerへ渡し、
     * 再描画を要求するローカル関数。model.onChangeのコールバックとresizeハンドラの双方から
     * 同一の引数構成で呼び出すことで、再描画トリガーの重複定義を避ける。
     */
    function renderCurrentState() {
        canvasManager.render(model.getShapes(), {
            selectedId: model.getSelectedId(),
            hoveredId: model.getHoveredId(),
            draftLine: model.getDraftLine()
        });
    }

    // 依存性の注入と連携セットアップ:
    // Modelのデータが変更されたら、Viewに描画を要求する
    model.onChange(renderCurrentState);

    // ウィンドウリサイズ時は、まずCanvasManagerのバッファサイズ・dprスケールを同期し、
    // その直後に最新のModel状態で再描画する（この呼び出し順序を厳守すること）
    window.addEventListener('resize', () => {
        canvasManager.resize();
        renderCurrentState();
    });

    // 4. フロートパネル（コントロールパネル）配線
    const controlPanel = document.getElementById('control-panel');
    const toolSelectBtn = document.getElementById('tool-select');
    const toolLineBtn = document.getElementById('tool-line');

    /**
     * ツールボタンのクリックハンドラを生成する。
     * InputTrackerへのツール切り替え要求と、アクティブツールを示すCSSクラスの
     * 付与/削除を同一ハンドラ内で行う。
     * @param {string} tool - 切り替え先のツール名（'select'/'line'）
     * @param {HTMLButtonElement} activeBtn - アクティブ化するボタン要素
     * @param {HTMLButtonElement} inactiveBtn - 非アクティブ化するボタン要素
     * @returns {Function} クリックイベントハンドラ
     */
    function createToolClickHandler(tool, activeBtn, inactiveBtn) {
        return () => {
            inputTracker.setTool(tool);
            activeBtn.classList.add('active');
            inactiveBtn.classList.remove('active');
        };
    }

    toolSelectBtn.addEventListener('click', createToolClickHandler('select', toolSelectBtn, toolLineBtn));
    toolLineBtn.addEventListener('click', createToolClickHandler('line', toolLineBtn, toolSelectBtn));

    // コントロールパネル上でのマウス操作がCanvas側のInputTrackerへ伝播し、
    // 意図しない選択解除やライン描画開始を引き起こさないよう、伝播を遮断する
    controlPanel.addEventListener('mousedown', (event) => event.stopPropagation());
    controlPanel.addEventListener('click', (event) => event.stopPropagation());
    controlPanel.addEventListener('mousemove', (event) => event.stopPropagation());
});
