# 作業指示書 REQ: PlanningUpdate : Phase01-03 `startDraft`引数順序の修正とkeydown購読先の明記
* ルール: `./PROJECT_CONSTITUTION.md`
* 開発資料: `./PROJECT_ARCHITECTURE.md`
* 作業計画書: `./_log/res/260808_2356_RES_Phase01-03_CanvasFullscreen_And_FloatUI.md`

--------------------------------------------------------------------------------

#### 【作業手順（厳守事項）】
**本プロンプトは、Step 0/1（計画立案・アーキテクチャ設計）の延長であり、ソースコードの実装（Step 2）ではない。**
**絶対に各種ソースコード（.jsや.html）の修正・書き換えを行わないこと。対象は、作業計画書（RES）ファイル自体の書き換えのみである。**

1. ルールおよび開発資料を熟読・把握すること。
2. 既存の作業計画書（`./_log/res/260808_2356_RES_Phase01-03_CanvasFullscreen_And_FloatUI.md`）を読み込み、以下の【改修要件】に従って、計画書ファイルそのものを直接編集・改修すること。全タスクが未着手（`[ ]`）のため、過去ログ保護の対象は現時点で存在しないが、念のため改修範囲は下記の指定箇所に限定すること。
3. 改修完了後、チャットにて「作業計画書（RES）のアップデートが完了しました。以降のタスク実行指示をお待ちしています」と報告すること。

--------------------------------------------------------------------------------

#### 【計画書（RES）の改修要件】

##### 1. 概要
発注者による計画監査（チェック0）にて、以下2点の問題が判明した。実装（Step 2）着手前の計画立案段階での修正となる。

**問題A：`startDraft`のデフォルト引数順序が意図した後方互換性を実現しない**
現行の計画（要件5・タスク5）は`startDraft(type = 'line', x, y)`という第1引数にtypeを置く形を採用している。しかしJavaScriptのデフォルト引数は「その位置の引数が省略された場合」にのみ適用される。既存の呼び出し元`this.model.startDraft(x, y)`は2つの引数を渡すため、`type`にはデフォルト値`'line'`ではなく1つ目の引数（座標の数値）がそのまま代入されてしまう。結果として`ShapeFactory.create()`が数値の`type`を受け取り、タスク4で確定した「未知typeはErrorをthrow」の方針により、タスク5完了後・タスク6完了前の間は直線作成のクリックのたびに例外が発生する。これは「タスクの区切り目で動作確認が壊れないようにする」という本来の設計意図に反する。

**対応**：`type`引数を末尾に、デフォルト値付きで配置する`startDraft(x, y, type = 'line')`に変更する。これにより、既存の2引数呼び出し（`x, y`のみ）では`type`が正しく省略扱いとなり`'line'`にデフォルトされ、後方互換性が実際に機能する。

**問題B：`keydown`イベントリスナーの購読先が未指定**
要件6・タスク6は「`keydown`イベントリスナーを新設する」とあるのみで、購読先（`this.canvas`か`document`/`window`か）が明記されていない。`<canvas>`要素は`tabindex`を設定しない限りフォーカスを持てずキーボードイベントを受け取れないため、既存のマウスイベントと同様に`this.canvas`へ付けた場合、削除機能が発火しない可能性が高い。

**対応**：`document`への購読とする旨を明記する。

##### 2. タスクの再構築（本文の書き換え）

以下の箇所を、それぞれ指定の通りに書き換えること（新規タスクの挿入ではなく、既存記述の修正）。

**(1) 「2. アーキテクチャ設計」内「要件5」の該当箇所を以下に置き換える：**

修正前：
```
*   `startDraft(x, y)`のシグネチャを`startDraft(type = 'line', x, y)`へ変更する。内部の`new Line(x, y, x, y)`を`ShapeFactory.create(type, x, y, x, y)`へ置き換える。デフォルト値`'line'`を設けるのは、`InputTracker`側の呼び出し引数更新（要件6）が別タスクとして分割された場合でも、既存の`model.startDraft(x, y)`という呼び出しがその間も直線としてそのまま機能し、タスクの区切り目で動作確認が壊れないようにするための意図的な設計である（タスクリストの実行順序にもこの意図を反映する。3.タスクリストの並び順を参照）。
```

修正後：
```
*   `startDraft(x, y)`のシグネチャを`startDraft(x, y, type = 'line')`へ変更する（`type`は**末尾に**デフォルト値付きで追加する。JavaScriptのデフォルト引数は該当位置の引数が省略された場合にのみ適用されるため、`type`を先頭に置くと既存の2引数呼び出し`model.startDraft(x, y)`が`x`を`type`として誤って受け取ってしまう。末尾に置くことで、既存呼び出しは`type`省略＝`'line'`デフォルトとして正しく後方互換動作する）。内部の`new Line(x, y, x, y)`を`ShapeFactory.create(type, x, y, x, y)`へ置き換える。この設計により、`InputTracker`側の呼び出し引数更新（要件6）が別タスクとして分割されても、既存の`model.startDraft(x, y)`という呼び出しがその間も直線としてそのまま機能し、タスクの区切り目で動作確認が壊れない。
```

**(2) 「2. アーキテクチャ設計」内「要件6」のうち、`line`ツール中のクリック処理の記述を以下に置き換える：**

修正前：
```
    *   `line`ツール中: ホバー判定を行っていないため、常に`this.model.startDraft('line', x, y)`を呼び`DRAWING`へ遷移する。
```

修正後：
```
    *   `line`ツール中: ホバー判定を行っていないため、常に`this.model.startDraft(x, y, 'line')`を呼び`DRAWING`へ遷移する（引数順序は要件5の`startDraft(x, y, type = 'line')`に合わせる）。
```

**(3) 「2. アーキテクチャ設計」内「要件6」の`keydown`に関する記述を以下に置き換える：**

修正前：
```
*   `keydown`イベントリスナーを新設する。`this.currentTool === 'select'`かつ`this.model.getSelectedId()`が存在し、押下キーが`Delete`または`Backspace`である場合のみ、`event.preventDefault()`を呼んだうえで`this.model.deleteShape(selectedId)`を実行する。
```

修正後：
```
*   `keydown`イベントリスナーを新設する。**購読先は`document`とする**（`<canvas>`要素はデフォルトでフォーカスを持てずキーボードイベントを受け取れないため、既存のマウスイベント群のように`this.canvas`へバインドしてはならない）。`this.currentTool === 'select'`かつ`this.model.getSelectedId()`が存在し、押下キーが`Delete`または`Backspace`である場合のみ、`event.preventDefault()`を呼んだうえで`this.model.deleteShape(selectedId)`を実行する。
```

**(4) 「3. タスクリスト」内「タスク5」の作業内容のうち、該当行を以下に置き換える：**

修正前：
```
        *   `startDraft(x, y)`を`startDraft(type = 'line', x, y)`に変更し、内部で`ShapeFactory.create(type, x, y, x, y)`を呼び出す形に変更する。
```

修正後：
```
        *   `startDraft(x, y)`を`startDraft(x, y, type = 'line')`に変更し（`type`は末尾・デフォルト値付き。理由は「2. アーキテクチャ設計」要件5を参照）、内部で`ShapeFactory.create(type, x, y, x, y)`を呼び出す形に変更する。
```

**(5) 「3. タスクリスト」内「タスク6」の作業内容のうち、該当2行を以下に置き換える：**

修正前：
```
        *   `handleClick`のIDLE時分岐を`currentTool`に応じた排他処理（`select`: 選択/選択解除のみ、`line`: 常に`startDraft('line', x, y)`）に書き換える。
```
```
        *   `keydown`イベントリスナーを追加し、`select`ツール中に選択中図形がある状態での`Delete`/`Backspace`押下で`event.preventDefault()`＋`model.deleteShape(selectedId)`を実行する。
```

修正後：
```
        *   `handleClick`のIDLE時分岐を`currentTool`に応じた排他処理（`select`: 選択/選択解除のみ、`line`: 常に`startDraft(x, y, 'line')`）に書き換える。
```
```
        *   `document`を購読先として`keydown`イベントリスナーを追加し、`select`ツール中に選択中図形がある状態での`Delete`/`Backspace`押下で`event.preventDefault()`＋`model.deleteShape(selectedId)`を実行する。
```

--------------------------------------------------------------------------------

#### 【絶対遵守ルール (Constraints)】
*   **過去ログ・ステータスの保護**: 本Phaseの全タスクは現時点で未着手（`[ ]`）であるため該当なしだが、万一すでに着手済みのタスクがあれば、その`[x]`マーク・完了日時・詳細作業内容のテキストは1文字も改変してはならない。
*   **改修範囲の限定**: 本REQで書き換えるのは上記(1)〜(5)の該当箇所のみとする。RESの他の記述（タスク1〜4, 7, 8および懸念事項欄）には触れないこと。
