# 作業指示書 REQ: Interrupt : Phase 7 クローズ前の直し（丸めの理由のコメント・矩形のハンドルの位置の照会・`?dev`の復元でのスポイトの待ち受け）
* ルール: `./PROJECT_CONSTITUTION.md`

## 【作業手順（厳守事項）】
本プロンプトは、Phase 7 クローズの整合確認で見つかった3点（丸めの理由のコメント、矩形のハンドルの位置の照会、`?dev`の復元でのスポイトの待ち受け）を直すInterruptである。必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本REQの【関連する責務】を把握すること。作業に必要な責務情報はすべてここに記載されている。開発資料（`PROJECT_ARCHITECTURE.md`）は、記載外の責務を確認する必要が生じた場合にのみ参照すること。
3. 実装対象のコードを読み、【関連する責務】に**記述されている内容と実コードが矛盾する**場合は、修正に着手せず、相違点を報告して指示を待つこと。記述にない事項の存在は相違とみなさない。
4. 相違がなければ、【実装要件】に従って実装を開始し、ソースコードの修正を実行すること。
5. コード修正が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポート（`./_log/res/261114_1933_RES_Interrupt_Phase07_Close_Comment_Guard_Fix.md`）を新規作成して出力すること。
   * テンプレートの項目に従い、「原因と修正方針」「対象ファイル」「詳細作業内容」を正確に記述すること。
6. 開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/arch/`）の内容に影響がある場合は、資料本体は修正せず、その旨を作業レポートの『開発資料の更新予定』欄に明記すること。
7. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【背景と確定事項】
以下は発注者の決定（2026-11-14）であり、変更してはならない。
* **丸めの理由のコメント**：コードのふるまいは変えず、コメントの「理由」の文だけを事実に直す。`roundConstrainedDeltaToUnit`と`roundDeltaToUnit`を1つにまとめない。
* **矩形のハンドルの位置の照会**：コードを直し、図形クラス5つの約束（ハンドル名でない値には`null`を返す）にそろえる。画面の動きは変わらない（実際の呼び出しは`hitTestHandle`が返した文字列だけを渡す）。
* **`?dev`の復元**：開発用パネルの「JSONから復元」が成功したとき、スポイトの待ち受けをやめる。操作モード・選択・履歴・それ以外の動きは変えない。

事実（現場設計AIが実行して確かめた。調査の記録は`./_log/res/261114_1541_RES_Survey_Phase07_Doc_Consistency.md` 5章のタスク10・タスク11）：
* `roundDeltaToUnit`（軸ごとに独立に丸める）は、`|dx| === |dy|`が厳密に成り立つ入力なら、丸めた後も`|dx| === |dy|`のままである（1つの値の丸めが「絶対値を丸めて符号を戻す」ため）。`constrainMoveDirection`の結果（横・縦・斜め45°）に対しては、`roundDeltaToUnit`と`roundConstrainedDeltaToUnit`の結果は同じになる。2つの結果が違うのは、`|dx|`と`|dy|`が厳密には等しくない斜めの入力のときだけ（例：刻み1で`{ dx: 2.4, dy: 2.6 }` → `roundDeltaToUnit`は`{ dx: 2, dy: 3 }`、`roundConstrainedDeltaToUnit`は`{ dx: 3, dy: 3 }`）。
* `new Rect(0, 0, 10, 10).getHandlePosition(['topLeft'])`・`getHandlePosition(new String('topLeft'))`・`getHandlePosition({ toString() { return 'topLeft'; } })`は、今はいずれも`{ x: 0, y: 0 }`を返す（`null`でない）。`getVertexIndexForHandle`が対応表の添字として引数を文字列へ変換するため。

## 【実装要件】
### 要件1: 丸めの理由のコメント（`js/core/UnitSnapRules.js`。コメントのみ）
* `roundConstrainedDeltaToUnit`のJSDocの「(b)とは別の規則を持つ理由：斜めを軸ごとに独立に丸めると、ちょうど中間の値などで`|dx| === |dy|`が崩れ45°から外れるため。」の1文を、次の内容に書き換える（言い回しは整えてよいが、内容を足さない・減らさない）：
  * `|dx| === |dy|`が厳密に成り立つ入力（`constrainMoveDirection`の結果）なら、(b)でも45°は崩れず、本関数と同じ結果になる。
  * (b)とは別の規則を持つ理由は、`|dx|`と`|dy|`が厳密には等しくない斜めの入力でも、結果を必ず45°（`|dx| === |dy|`）にするため（例：刻み1で`{ dx: 2.4, dy: 2.6 }` → (b)は`{ dx: 2, dy: 3 }`、本関数は`{ dx: 3, dy: 3 }`）。
* このファイルの実行されるコード・ほかのコメントは変えない。`test/core/UnitSnapRules.test.js`・`js/core/InputTracker.js`・`js/core/MoveDirectionRules.js`は変えない。

### 要件2: 矩形のハンドルの位置の照会（`js/shapes/Rect.js`・`test/shapes/Rect.test.js`）
* `Rect.getHandlePosition(handleName)`の先頭で、`handleName`が文字列でなければ（`typeof handleName !== 'string'`）`null`を返す。それ以降の処理（`getVertexIndexForHandle`で番号を得て、0〜3の整数であることを確かめてから`points[番号]`を写す）は変えない。
* `Rect.getVertexIndexForHandle`は変えない（コードもJSDocも）。
* `getHandlePosition`のJSDocに、文字列であることを先に確かめる理由（`getVertexIndexForHandle`は対応表を引くため、添字が文字列へ変換され、`['topLeft']`のような文字列以外の値でも番号が返り得る）を足す。既存の「番号が0〜3の整数であることを確かめてから写す」の説明は残す。
* `test/shapes/Rect.test.js`の`describe('Rect.getHandlePosition', …)`にある既存のテスト`'未知の名前・null・undefined・文字列以外はnull'`の値の一覧へ、文字列へ変換すると有効なハンドル名になる値を3つ足す：`['topLeft']`・`new String('topLeft')`・`{ toString() { return 'topLeft'; } }`。**テストの件数（`it`の数）は増やさない**（開発資料が件数を記録しているため）。ほかのテストは変えない。

### 要件3: `?dev`の復元でスポイトの待ち受けをやめる（`js/main.js`）
* `// 9.`の`DevPanel`へ渡す`onImport`の成功時の経路で、`inputTracker.abortOngoingOperation()`の直後（`historyManager.beginEdit()`より前）に`styleEyedropper.stop()`を1回呼ぶ。失敗時（読み込み中・全体の読み込みに失敗）の経路では呼ばない（失敗時は何も変えない、という今の約束を保つ）。
* `applyMode`は呼ばない（操作モード・選択の扱いを変えないため）。`abortOngoingOperation` → `beginEdit` → `replaceAllShapes` → `commitEdit`の順序は変えない。
* ツールパレットの押し込みの同期は、既存の`styleEyedropper.onChange(syncToolPalette)`の経路に任せる（`onImport`の中で`syncToolPalette`を直接呼ばない）。
* コメントを修正後の動作に合わせる：
  * `onImport`の上のコメントに、成功時にスポイトの待ち受けをやめること（通常のインポートは`applyMode`の経路でやめるが、復元は`applyMode`を通らないためここで呼ぶ）を足す。
  * `styleEyedropper.onChange(syncToolPalette)`の上のコメントの「待ち受けの変化」の列挙（`I`・ボタン・`Esc`・`applyMode`でのやめる・取り込み）と、`syncToolPalette`のJSDocの「`styleEyedropper.onChange`（待ち受けの開始・終了・取り込み。…）」の括弧書きが、`?dev`の復元でやめる場合を含む記述になるよう、必要な分だけ直す。
* `js/edit/StyleEyedropper.js`・`js/palette/DevPanel.js`・`js/core/InputTracker.js`は変えない。

### 要件4: 確認
* 変更した`.js`ファイルを`node --check`で確かめる。
* プロジェクトのルートで`node --test`を実行し、全件成功すること（変更前は tests 1261 / pass 1261 / fail 0。件数は変わらないはず）を確かめ、結果の件数を作業レポートに記す。
* 要件2について、【背景と確定事項】の3つの呼び出しが`null`を返すようになったことを、足したテストで確かめる。
* ブラウザでの動作確認は現場設計AIが行う（実装AIは行わない）。

## 【関連する責務】
* `core/UnitSnapRules.js`：スナップ（座標・移動量を刻みの倍数へ丸めること）の規則を、状態を持たない関数として提供する。importなし・DOMなし。`roundDeltaToUnit`は移動量を軸ごとに独立に丸め、`roundConstrainedDeltaToUnit`は`MoveDirectionRules.constrainMoveDirection`の結果を、限定した直線の上に保ったまま丸める（`MoveDirectionRules`をimportせず、入力の形だけを前提にする）。1つの値の丸めは、ちょうど中間の値を0から遠い側へ丸める（符号について対称）。
* 図形クラスの共通メソッド契約の第17メソッド`getHandlePosition(handleName)`：`hitTestHandle`が返し得るハンドル名に対して、そのハンドルの位置を新しいオブジェクト`{ x, y }`で返す。ハンドル名でない値（`null`・`undefined`・未知の文字列・文字列以外・`Object.prototype`のキー名）には例外を投げず`null`を返す（5クラス共通。`@param`の型は`{*}`）。`Line`・`Curve`・`Ellipse`は名前の厳密比較で分岐し、`Rect`・`Path`は`getVertexIndexForHandle`で番号を得て、番号が範囲内の整数であることを確かめてから`points[番号]`を写す。`Path.getVertexIndexForHandle`は文字列でない値に`null`を返す。`Rect.getVertexIndexForHandle`は対応表を引く（`'constructor'`等で関数が返り得る）。
* `edit/StyleEyedropper.js`：スポイトの待ち受けの状態（待ち受け中か）の保持と変更の通知、取り込みの手順。DOM・操作モード・`InputTracker`を知らない。`stop()`は待ち受け中でなければ何もせず通知もしない。
* `main.js`：各部品の組み立てと依存の注入（判定・計算を持たない）。`applyMode`は必ず`styleEyedropper.stop()`を呼ぶ。待ち受けの変化は`styleEyedropper.onChange` → `syncToolPalette`でツールパレットの押し込みに同期する。再描画・UI同期は既存の経路（`model.onChange`等）のみで行い、機能専用の同期処理を足さない。
* `?dev`の「JSONから復元」の順序：成功時のみ`InputTracker.abortOngoingOperation()` → `HistoryManager.beginEdit()` → `VectorModel.replaceAllShapes(shapes)` → `HistoryManager.commitEdit()`。中断を先に行うのは、ドラッグ中だった場合にその中断分を先に1件確定させるため。全体の読み込みに失敗したらキャンバスを変更せず、履歴にも記録しない。読み込み中（`canvasLibrary.getState().loading`）は受理しない。`onImport`から例外を漏らさない（`DevPanel`は捕捉しない）。

## 【絶対遵守ルール (Constraints)】
* **対象ファイル** : `js/core/UnitSnapRules.js`（コメントのみ）・`js/shapes/Rect.js`・`test/shapes/Rect.test.js`・`js/main.js`のみ。新規に作るのは作業レポートだけ。
* **範囲外** : 丸めの関数の統合・呼び出し元の変更。`Rect.getVertexIndexForHandle`とほかの図形クラスの変更。`?dev`の復元での操作モードの切り替え・選択の扱いの変更。取り消し・やり直しでのスポイトの待ち受けの扱い（続くままとする）。開発資料（`PROJECT_ARCHITECTURE.md`・`_doc/`配下）の書き換え。
* **アーキテクチャの維持** : `StyleEyedropper`・`UnitSnapRules`・図形クラスの依存関係を変えない。`main.js`に判定・計算を足さない（足すのは`stop()`の呼び出し1つ）。
