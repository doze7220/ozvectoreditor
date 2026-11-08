*   **index.html**：スタイルはCSSファイル分割せず`<style>`タグに内包する。配置・見た目はマークアップとCSSコメントを正とする。
    *   **非活性の表現**：フロートウィンドウ全体の非活性化は`.disabled`クラス（`pointer-events: none`）、ボタン単体の押せない状態はHTMLの`disabled`属性と`.tool-btn:disabled`で表す。両者を混用しない。
    *   **ショートカットの表記**：各ボタンの`title`属性にショートカットキーを併記している（図形パレットは`SHAPE_TYPES`の並びに対応する数字）。`KeyboardShortcuts.js`の`SHORTCUT_BINDINGS`と手動で同期する必要がある。
    *   **読み込み中の覆い要素**：`#canvas-loading-cover`は`hidden`を付けずに表示状態で始める（`main.js`の実行前からキャンバスへのマウス入力を遮るため）。`.canvas-loading-cover[hidden] { display: none; }`の指定は必須。`main.js`の初期化が途中で失敗すると覆いが消えない（その場合はコンソールのエラーを確認する）。
    *   **図形選択パレットの位置**：`#window-shape-palette`の`top`はコントロールパネルの下端との余白24px以上を確保するための固定値。自動配置はしない。コントロールパネルの高さを変える場合は手動で再調整する（ボタンの高さはフォント・絵文字の表示に依存する）。
    *   **図形選択パレットのボタン**：idは`palette-${type}`（`type`は`SHAPE_TYPES`の値）。`PaletteController`が起動時にこの規則で照合・配線する。アイコン・表示名・`title`は静的記述。パレット内では、図形種別ボタン以外の要素に`palette-`で始まるidを使わない（照合時に警告される）。
    *   **キャンバスパレットのボタンの並び**：「＋ 新規作成」・「出力（作業ファイル）」（`#canvas-export`）・「出力（エンジン用）」（`#canvas-export-sprite`）は1行に1つずつ縦に並べ、「開く」「インポート」だけを`.canvas-file-row`で横並びにする（出力の2ボタンは文字だけで約247pxとなり、パレットの内側の幅216pxに1行で収まらないため）。`title`にダウンロードされるファイルの拡張子を書く。
    *   **キャンバスパレットのファイル選択**：非表示の`<input type="file">`を「開く」用（`#canvas-open-file-input`）と「インポート」用（`#canvas-import-file-input`）の2つ置く。どちらのボタンから開いたかの状態を持たずに済むため。1つにまとめない。`accept=".json,.js,application/json,text/javascript"`は拡張子の末尾で照合するため`.ozve.json`も選べ、スプライトのJS・JSONも選べる（変更しない。2章「エディタで開くときの規則」）。ボタンの`title`に作業ファイル（.ozve.json）とスプライト（.js・.json）を書く。
    *   **確認用ウィンドウ**：`#window-dev-panel`は`hidden`で初期非表示。`?dev`時のみ`main.js`が表示する。
    *   **フロートウィンドウの`×`ボタン**：コントロールパネル・図形選択パレットには`×`が無い（見出しはタイトルのみ。`.window-header`の`min-height`で他のウィンドウと高さをそろえる）。`PaletteLauncher`の対応表に含まれる開閉式パレット（現状はキャンバスパレットのみ）の`×`は閉じ、呼び出し口で開き直せる。`?dev`の確認用ウィンドウの`×`は`DevPanel`が配線して閉じる（開き直す手段は無く、再読み込みで再表示）。
