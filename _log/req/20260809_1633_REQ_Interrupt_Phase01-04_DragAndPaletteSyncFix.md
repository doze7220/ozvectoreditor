# 作業指示書 REQ: Interrupt : Phase01-04 テストプレイで発見されたフロートウィンドウ関連3件の不具合修正
*  ルール: `./PROJECT_CONSTITUTION.md`
*  開発資料: `./PROJECT_ARCHITECTURE.md`
*  作業計画書: `./_log/res/20260809_1212_RES_Phase01-04_FloatWindowManager_And_PaletteP.md`

## 【作業手順（厳守事項）】
本プロンプトは、Phase01-04（フロートウィンドウシステムの構築と図形パレットの統合）完了後のテストプレイで発見された3件の不具合に対するInterruptである。必ず以下の順序で作業を行うこと。
1. ルール（`PROJECT_CONSTITUTION.md`）および開発資料（`PROJECT_ARCHITECTURE.md`）を熟読・把握すること。
2. 作業計画書（`./_log/res/20260809_1212_RES_Phase01-04_FloatWindowManager_And_PaletteP.md`）を読み、Phase01-04で確立した`WindowManager`/`PaletteController`/`main.js`の設計・現状を把握すること。
3. 以下の【実装要件】に従って、3件の修正をすべて実装すること（3件は互いに独立しており、まとめて実行してよい）。
4. コード修正が完了したら、既存の作業レポート（`./_log/res/20260809_1212_RES_Phase01-04_FloatWindowManager_And_PaletteP.md`）の末尾に、追記用テンプレート（`./_log/TEMPLATE_RES_AddInterrupt.md`）を用いて作業の詳細を追記すること。3件それぞれについて「原因・理由」と「対応（対象ファイル・具体的な修正内容）」を分けて記述すること。
5. 開発資料（`PROJECT_ARCHITECTURE.md`）の記述に影響がある場合（`WindowManager.js`・`PaletteController.js`の責務説明の変更等）は資料を修正し、その旨を作業レポートの対応内容に含めること。
6. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【実装要件】

### 不具合1：フロートウィンドウのドラッグが機能しない（最重要）
*   **現象**: `.window-header`を掴んでドラッグしても、マウスに滑らかに追従しない。マウスがウィンドウの外（Canvas等）に出た瞬間にその位置へ「ワープ」し、ウィンドウの上でマウスボタンを離してもドラッグが終了しない（ウィンドウの外でボタンを離して初めて終了する）。
*   **原因**: `js/core/WindowManager.js`の`#setupWindow(windowEl)`が、各`.float-window`要素自身に対して`mousemove`/`mouseup`の`stopPropagation()`をバブルフェーズの通常リスナーとして登録している。一方、ドラッグ追従を担う`#handleWindowMouseMove`/`#handleWindowMouseUp`は`window`に対してこれもバブルフェーズの通常リスナーとして登録されている。マウスがウィンドウ（ヘッダー含む）の内側にある間、`mousemove`/`mouseup`イベントは対象要素→…→ウィンドウ要素の時点で`stopPropagation()`により止められ、バブルフェーズでその先（`document`→`window`）まで届かない。そのため、`window`レベルのドラッグ追従リスナーは、マウスがウィンドウの外に出て初めて（遮断されずに）イベントを受け取れる状態になっており、これが報告された「ワープ」「ウィンドウ上で離しても終わらない」という挙動の原因である。
*   **修正内容**: `js/core/WindowManager.js`のコンストラクタ内、ドラッグ追従用の2つのリスナー登録
    ```js
    window.addEventListener('mousemove', this.#handleWindowMouseMove.bind(this));
    window.addEventListener('mouseup', this.#handleWindowMouseUp.bind(this));
    ```
    を、**キャプチャフェーズ**（第3引数に`true`を指定）で登録するよう変更すること。
    ```js
    window.addEventListener('mousemove', this.#handleWindowMouseMove.bind(this), true);
    window.addEventListener('mouseup', this.#handleWindowMouseUp.bind(this), true);
    ```
    キャプチャフェーズは「`window`→`document`→…→対象要素」の順で対象要素に到達する前に発火するため、後続のバブルフェーズで発生する`stopPropagation()`の影響を受けない。これにより、既存の「イベント透過防止」機能（外部の要素・ドキュメントへの伝播遮断）の挙動は変更せず、`WindowManager`自身のドラッグ追従だけを正しく機能させることができる。
    * `#setupWindow`側の`mousedown`/`click`/`mousemove`/`mouseup`の`stopPropagation`実装、および`#startDrag`のドラッグ開始ロジックは変更しないこと。

### 不具合2：図形選択パレットの5ボタンをクリックしても、アクティブ表示（`.active`）が更新されない
*   **現象**: パレットの「曲線」「弧」「矩形」「円」ボタンをクリックすると図形は正しく切り替わり作図もできるが、パレット内のどのボタンも見た目上アクティブにならない（あるいは直前にコントロールパネル側で選んだ「直線ツール」のアクティブ表示が残ったままになる）。
*   **原因**: `js/palette/PaletteController.js`のコンストラクタは、パレット5ボタンの`click`時に`this.#inputTracker.setTool(type)`を直接呼び出す設計になっている。一方、パレット自身の`.active`表示や、コントロールパネル側`select`/`line`ボタンの`.active`表示、パレット本体の`.disabled`制御をすべて一元的に担っているのは`js/main.js`内の`applyTool(tool)`関数であり、これは現状コントロールパネルの2ボタンからしか呼ばれていない。そのため、パレットボタンのクリックは実際のツール切り替え（`inputTracker.setTool`）こそ行うが、表示更新を行う`applyTool`（および`paletteController.setActiveTool`）を一切経由せず、見た目が更新されない。
*   **修正内容**:
    1.  `js/palette/PaletteController.js`のコンストラクタ引数を、`inputTracker`インスタンスへの直接依存から、ツール選択時に呼び出す汎用コールバック（例: `onToolSelected(type)`という名前の関数）を受け取る設計に変更すること。`#inputTracker`フィールドは廃止し、代わりに`#onToolSelected`（コールバック関数を保持するprivateフィールド）を新設する。
    2.  5ボタンの`click`リスナー内で呼んでいた`this.#inputTracker.setTool(type)`を、`this.#onToolSelected(type)`の呼び出しに置き換えること。
    3.  `js/main.js`側で、`new PaletteController(shapePaletteEl, inputTracker)`となっている箇所を`new PaletteController(shapePaletteEl, applyTool)`に変更すること（`applyTool`は関数宣言のためホイスティングにより、テキスト上の定義位置が`PaletteController`のインスタンス化より後であっても問題なく参照できる）。
    4.  この変更により、コントロールパネルの2ボタン・パレットの5ボタンのいずれを押した場合も、必ず`applyTool(tool)`を経由して「`inputTracker.setTool(tool)`の呼び出し」「コントロールパネル`select`/`line`の`.active`排他制御」「`paletteController.setActiveTool(tool)`によるパレット側の表示更新」の3処理が一貫して実行されるようになる。
    5.  `PaletteController`のファイル先頭JSDoc・コンストラクタJSDocを、`inputTracker`ではなく汎用コールバックを受け取る設計に合わせて更新すること。

### 不具合3（軽微）：Ctrl+Aやダブルクリックでウィンドウ内のテキストが選択状態になる
*   **現象**: フロートウィンドウ（コントロールパネル・パレット）のタイトルやボタンラベルが、ブラウザ標準のテキスト選択（ドラッグ選択・ダブルクリック選択・Ctrl+A全選択）の対象になってしまう。
*   **修正内容**: `index.html`の`<style>`内、`.float-window`のCSSルールに`user-select: none;`を追加すること（`.float-window`全体に適用することで、ヘッダー・ボディ内のボタン等すべてを対象にする）。

## 【絶対遵守ルール (Constraints)】
*   **修正範囲の限定**: 上記3件の修正以外の設計・ロジックには一切手を加えないこと（`WindowManager`のドラッグ開始ロジック・z-index管理、`ShapeFactory`のスタブ分岐、`index.html`のマークアップ構造等は無改変）。
*   **イベント透過防止機能の維持**: 不具合1の修正は、既存の「外部要素への伝播遮断」機能（`mousedown`/`click`/`mousemove`/`mouseup`の`stopPropagation`）の挙動を変えないこと。あくまで`WindowManager`自身の`window`レベルリスナーの発火タイミング（キャプチャフェーズ化）のみを変更する。
*   **単一責任・JSDocの維持**: `PaletteController`の依存関係変更（不具合2）に伴い、JSDocコメント（ファイル先頭・コンストラクタ・privateフィールド）の記載漏れがないか確認すること。
