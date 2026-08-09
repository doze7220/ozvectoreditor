# 作業指示書 REQ: Interrupt : `InputTracker.handleClick`の新規図形作成タイプ固定バグ修正
*  ルール: `./PROJECT_CONSTITUTION.md`
*  開発資料: `./PROJECT_ARCHITECTURE.md`
*  参考資料: `./_log/res/20260809_1745_RES_Phase01-05_BezierCurve_Implementation.md`（不具合が顕在化したPhase01-05のRES。原因箇所自体はこのRESの変更対象外）

## 【作業手順（厳守事項）】
本プロンプトは、Phase01-05（`Curve.js`実装）完了後のテストプレイで発見された不具合に対するInterruptである。必ず以下の順序で作業を行うこと。
1. ルール（`PROJECT_CONSTITUTION.md`）および開発資料（`PROJECT_ARCHITECTURE.md`）を熟読・把握すること。
2. 以下の【実装要件】に従って、修正を実装すること。
3. コード修正が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポートを新規作成して出力すること。
    * 出力先・ファイル名: `./_log/res/20260809_1830_RES_Interrupt_Phase01-05_DraftTypeHardcoded.md`
4. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【実装要件】

### 不具合：図形選択パレットで「曲線」を選んで作図しても、直線が生成される
*   **現象**: 図形選択パレットで「曲線」ボタンを押し（`currentTool`が`'curve'`に切り替わる）、キャンバス上で2クリックして作図しても、生成される図形は`Curve`ではなく`Line`になる（見た目も直線のまま）。
*   **原因**: `js/core/InputTracker.js`の`handleClick(event)`内、新規図形の作成を開始する行

    ```js
    this.model.startDraft(x, y, 'line');
    ```

    が、`this.currentTool`の値を参照せず`'line'`という文字列リテラルに固定されている。そのため、パレットで`'curve'`/`'arc'`/`'rect'`/`'circle'`のいずれを選んでいても、`VectorModel.startDraft`には常に`type = 'line'`が渡され、`ShapeFactory.create('line', ...)`経由で`Line`インスタンスが生成されてしまう。

    このバグ自体はPhase01-02（Line専用実装時にこの固定値で書かれた）由来であり、Phase01-04で5図形パレットが追加された際も見過ごされていた。`arc`/`rect`/`circle`はいずれにせよ`ShapeFactory`側で`Line`にフォールバックするスタブだったため表面化せず、Phase01-05で`Curve`が本実装されたことにより初めて挙動の差が可視化された。
*   **修正内容**: `js/core/InputTracker.js`の`handleClick(event)`内、該当行を以下のように修正すること。

    ```js
    this.model.startDraft(x, y, this.currentTool);
    ```

    * この行に到達する時点で`this.currentTool !== 'select'`であることは直前の分岐（209〜218行目）で保証されているため、`this.currentTool`は必ず`'line'|'curve'|'arc'|'rect'|'circle'`のいずれかであり、`VectorModel.startDraft`の`type`引数としてそのまま利用できる。
    * `handleClick`メソッドのJSDocに、この行が「現在アクティブなツール種別をそのまま作成する図形typeとして使う」という意図を簡潔に追記すること（既存のJSDoc記述と重複しない範囲で1文程度）。
    * それ以外のロジック（`state`遷移、`select`ツール時の分岐、`DRAWING`状態からの`commitDraft`呼び出し等）は一切変更しないこと。

## 【絶対遵守ルール (Constraints)】
*   **修正範囲の限定**: `js/core/InputTracker.js`の`handleClick`内、該当1行およびその直上のJSDocの記載更新以外には一切手を加えないこと。`Curve.js`/`ShapeFactory.js`/`VectorModel.js`等、Phase01-05で完成させた実装・他ファイルは無改変とする。
*   **`currentTool`のバリデーションを新設しない**: `handleClick`到達時点で`currentTool`が`'select'`以外であることは既存の分岐で保証済みのため、追加の型チェック・バリデーションロジックをフライング実装しないこと（`COWORK_STATUS.md`記載の「`setTool`引数バリデーション」課題は別Interrupt/Phaseの対象であり、本Interruptのスコープではない）。
