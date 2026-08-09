/**
 * 責務：各モジュールの初期化と連携(依存性の注入)を担う。
 */

import { VectorModel } from './core/VectorModel.js';
import { CanvasManager } from './core/CanvasManager.js';
import { InputTracker } from './core/InputTracker.js';
import { WindowManager } from './core/WindowManager.js';
import { PaletteController } from './palette/PaletteController.js';

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

    // 4. フロートウィンドウ統治（ドラッグ・最前面化・イベント遮断の一元管理）
    new WindowManager();

    // 5. フロートパネル（コントロールパネル）配線
    // コントロールパネルがownするツールボタンをツール名文字列でマッピングする汎用テーブル。
    // 将来ボタンが増設された場合、このオブジェクトへのエントリ追加のみで対応でき、
    // 下記のapplyTool本体・クリックリスナー登録ループの書き換えは一切不要になる（開閉原則）。
    const toolButtons = {
        select: document.getElementById('tool-select'),
        line: document.getElementById('tool-line')
    };

    // 6. 図形選択パレット配線
    const shapePaletteEl = document.getElementById('window-shape-palette');
    const paletteController = new PaletteController(shapePaletteEl, applyTool);

    /**
     * ツール切り替えを一元的に行う共通関数。コントロールパネル各ボタン（`toolButtons`）の
     * clickリスナー、およびPaletteControllerへ`onToolSelected`コールバックとして渡され
     * パレット5ボタン('line'/'curve'/'arc'/'rect'/'circle')のclick時にも呼び出される。
     * InputTrackerへのツール切り替え要求、`toolButtons`を走査する汎用ループによる
     * コントロールパネル側ボタンの排他的な`.active`付け外し（`toolButtons`に存在しない
     * toolの場合はいずれの`.active`も外れる）、末尾でのPaletteController#setActiveToolへの
     * 委譲（パレット側の活性/非活性・アクティブ表示更新）の3処理を担う。
     * @param {string} tool - 切り替え先のツール名（'select' | 'line' | 'curve' | 'arc' | 'rect' | 'circle'）
     */
    function applyTool(tool) {
        inputTracker.setTool(tool);
        Object.entries(toolButtons).forEach(([key, btn]) => btn.classList.toggle('active', key === tool));
        paletteController.setActiveTool(tool);
    }

    Object.entries(toolButtons).forEach(([tool, btn]) => btn.addEventListener('click', () => applyTool(tool)));
});
