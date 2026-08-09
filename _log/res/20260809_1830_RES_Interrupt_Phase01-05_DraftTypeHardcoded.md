# RES: 作業計画・作業レポート Interrupt : `InputTracker.handleClick`の新規図形作成タイプ固定バグ修正
* 参照元REQ: `./_log/req/20260809_1830_REQ_Interrupt_Phase01-05_DraftTypeHardcoded.md`

## 1. 作業目的
図形選択パレットで「曲線」等を選択して作図しても、生成される図形が常に`Line`になってしまう不具合を修正する。原因は`InputTracker.handleClick`が`VectorModel.startDraft`呼び出し時に図形typeを`'line'`固定の文字列リテラルで渡していたことであり、これを現在アクティブなツール種別（`this.currentTool`）を参照する形に修正する。

## 2. 実装内容
REQ記載の修正内容の通り、`handleClick(event)`内の`this.model.startDraft(x, y, 'line');`を`this.model.startDraft(x, y, this.currentTool);`へ変更した。`handleClick`到達時点（208〜221行目）では直前の分岐により`this.currentTool !== 'select'`であることが保証されているため、追加のバリデーションは行っていない。

## 3. 対象ファイル
* `./js/core/InputTracker.js` : 更新（`handleClick`内の該当1行、および直上のJSDocへの1文追記のみ）

## 4. 詳細作業内容
* **作業内容**:
  * `handleClick`の直上JSDocに「作成する図形のtypeには、現在アクティブなツール種別（currentTool）をそのまま使用する。」を1文追記した。
  * `this.model.startDraft(x, y, 'line');` → `this.model.startDraft(x, y, this.currentTool);` に変更した。
  * `state`遷移、`select`ツール時の分岐、`DRAWING`状態からの`commitDraft()`呼び出しなど、その他のロジックは無変更。
  * `Curve.js`/`ShapeFactory.js`/`VectorModel.js`など他ファイルは無改変。

## 5. 懸念事項・要確認ポイント
* 特になし。パレットで「曲線」を選択して2クリックで作図した際に`Curve`（ベジェ曲線）が生成されること、また「直線」選択時は従来通り`Line`が生成されることの目視確認をお願いします。
