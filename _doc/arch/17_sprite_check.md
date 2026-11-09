*   **sprite-check.html・check/**：書き出したスプライト（`<名前>.js`）を、OZ Engineを待たずにエディタ側だけで「読み込み→描画」して確かめる確認用ページ。流れは3章10.、スプライトの形は2章「スプライト（書き出し形式）」。エディタ本体（`index.html`・`main.js`・`edit/`・`palette/`）とは状態を共有しない。
    *   **依存**：`check/`内と`io/`の`SpriteSerializer`のみ（`SpriteCheckInspector`から）importする。`main.js`・`edit/`・`palette/`・`core/`の状態を持つモジュール（`VectorModel`等）をimportしない。`js/`の他のモジュール・`index.html`は`check/`をimportしない。`SpriteSerializer`のimportを通じて`DocumentSerializer`・`core/ShapeFactory`・`shapes/`が読み込まれるが、いずれも状態を持たず、確認用ページはそれらを呼ばない。
    *   **sprite-check.html**：プロジェクトのルートに置く。`index.html`と同じく同じフォルダのHTMLをブラウザで開くだけで動く（ビルドなし・スタイルは`<style>`に内包）。`<script type="module" src="js/check/SpriteCheckPage.js">`の1つだけを読む。`index.html`からのリンクは置かない。ファイル選択の`accept`は`.js,text/javascript`だけ（JSONは選べないが、「すべてのファイル」で選んだ場合は中身で見分けて`notSprite`にする）。
        *   **選んだJSはこのページで実行される**：注意書き`#check-warning`で利用者へ示す。選んだJSはページのDOM・`window`にも触れ得る。無限ループするJSを選ぶとページが固まり止められない（タブを閉じる）。終わらない`await`を持つJSは「読み込み中…」のままになるが、別のファイルを選べば新しい読み込みが優先される。これらへの対策は作らない（決定）。
        *   **要素のid**：`check-file-input`（1ファイル・`multiple`なし）・`check-file-name`・`check-format-version`・`check-source-version`・`check-element-count`・`check-bounds`・`check-message`・`check-canvas-area`・`check-canvas`。1つでも欠けたら`SpriteCheckPage`は`console.warn`して配線しない。
        *   **ブラウザでの開き方**：Blob URLの動的`import`は、ローカルサーバー経由（`http://127.0.0.1`）のChromium系で成功を確認済み。`file://`で開いた場合の可否は未確認（ブラウザにより異なり得る。失敗しても「JSとして読み込めませんでした（壊れたファイル、またはJSの読み込み中のエラー）。」と表示されページは止まらない）。
    *   **SpriteCheckPage.js**：起動・要素の解決・ファイル選択から表示までの流れ（読み取り→判定→Blob URLの動的`import`→描画→情報欄）・表示中のスプライトと外枠の保持を担う。
        *   **公開**：なし（`DOMContentLoaded`で自分で起動する。`window`へ代入しない）。
        *   **文言の対応表**`FAILURE_MESSAGES`（理由の区分`readFailed`・`notSprite`・`unsupportedVersion`・`importFailed`・`drawFailed`→画面の文言）はこのファイルが唯一の定義箇所。区分を足す場合はここのみ直す。例外の詳細は`console.warn`。
        *   **直接使うもの**：`File`・`Blob`・`URL`（エディタの`DocumentFileIO`は使わない。ファイル名の規則を持ち込まないため）。JSONかJSかは拡張子ではなく中身で見分け、JSONは`import`を試みずに`notSprite`として表示する。JSはテキストのままBlob URLで動的`import`する（壊れたJSは`importFailed`）。
        *   **知らないこと**：図形・作業データ・スプライトの描き方・識別子と版の値（`SpriteCheckInspector`と`io/`に任せる）。
    *   **SpriteCheckCanvas.js**：描画領域の大きさの調整と描画を担う。
        *   **公開メソッド**：`resize`・`clear`・`render(sprite, bounds)`。呼び出し元は`SpriteCheckPage`のみ。
        *   **状態**：描画領域の大きさ（CSSの幅・高さ・dpr）のみ。スプライト・外枠・ファイルの情報は引数で受け取り保持しない。DOMは`canvas`と親要素のみ。
        *   **描画の座標**：原点(0, 0)を描画領域の中央（`Math.round(幅 / 2)`）に置き、等倍で描く。拡大縮小・移動はしない。高DPIは`canvas`の内部の大きさ×`devicePixelRatio`と`setTransform`で合わせる。
        *   **重ね順**：背景（白）→ 外枠の矩形（青系の1pxの破線。`bounds`の値をそのまま使い再計算しない）→ 原点の印（赤系の1pxの実線の十字）→ スプライトの`draw(ctx)`。印・外枠を絵より先に描くため絵は隠れない。`draw`は`save`・`try/finally`・`restore`で囲む。`draw`の例外は捕捉せず投げる（`SpriteCheckPage`が`drawFailed`にする）。色・線種の値は`SpriteCheckCanvas.js`の定数が唯一の定義箇所。
    *   **SpriteCheckInspector.js**：本アプリのスプライトかの判定（JSの既定のexport）、JSONかの見分け、情報欄の要約を担う静的メソッドのみのクラス。DOMに依存しない。
        *   **公開メソッド**：`parseText`・`inspectModuleExport`・`summarize`。呼び出し元は`SpriteCheckPage`のみ。
        *   **判定の条件**：JSの既定のexportは、`null`でない`object`で、`checkFormat`が`'supported'`、かつ`draw`が関数。識別子・版の条件は`checkFormat`に任せ、定数を重複して持たない。
        *   **知らないこと**：DOM・`import`・描画。importは`io/SpriteSerializer`のみ。
        *   **テスト**：`test/check/SpriteCheckInspector.test.js`（4章`test/`）。`SpriteCheckPage`・`SpriteCheckCanvas`は自動テストの対象外（テストプレイで確かめる）。
    *   **io/から使うもの**：`SpriteSerializer.checkFormat`（判定）のみ。
    *   **やらないこと**：拡大縮小・移動・編集、複数ファイルの同時表示、組み立て用のJSの表示、エディタ本体からのリンク、無限ループ・終わらない`import`への対策。
