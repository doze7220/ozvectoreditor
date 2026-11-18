# RES: 作業レポート Interrupt : Phase 8 クローズの開発資料の直し（残り5件）
* 参照元REQ: `./_log/req/261118_1112_REQ_Interrupt_Phase08_Close_Doc_Fix2.md`

## 1. 作業目的
RES `261118_1044` で申し送られた開発資料の相違5件を、`_doc/arch/` の6ファイルの各1行の書き換えで直す。ソースは変更しない。

## 2. 実装内容
資料の記述を実コードに合わせた。実コードとREQの事実の矛盾はなかった。`node -v` は v24.15.0、`node --test` は全件成功（tests 1543 / suites 230 / pass 1543 / fail 0）。

## 3. 対象ファイル
* `./_doc/arch/24_CanvasCursorTracker.md` 3行目 : 更新
* `./_doc/arch/01_index_html.md` 1行目 : 更新
* `./_doc/arch/03_VectorModel.md` 4行目 : 更新
* `./_doc/arch/32_InputModes.md` 6行目 : 更新
* `./_doc/arch/33_FocusKeyYieldRules.md` 6行目 : 更新
* `./_doc/arch/16_test.md` 2行目 : 更新

## 4. 詳細作業内容
* **要件1（24:3）**
  * 前：実体は`main.js`が注入する`InputTracker.js`の`hasCtrlModifier`（`Ctrl`（`⌘`を含む）の読み取りの唯一の定義。二重に書かない）。
  * 後：実体は`main.js`が注入する`InputTracker.js`の`hasCtrlModifier`（**マウスのイベントの`Ctrl`（`⌘`を含む）の読み取りはこの関数に寄せ、二重に書かない**。キーボードの`Ctrl`は`KeyboardShortcuts`が別に読む）。
  * 言い回しは `PROJECT_ARCHITECTURE.md` 528行・`06_InputTracker.md` 27行にそろえた。
* **要件2（01:1）**
  * 前：配置・見た目はマークアップとCSSコメントを正とする。
  * 後：配置・見た目はマークアップとCSSの宣言を正とする（CSSコメントの中の見積もりの数値は正本でない。古いことがある）。
* **要件3（03:4 末尾）**
  * 前：呼び出し元は`InputTracker`のみ（設定・解除）と、`getSelectedVertices`を読む`main.js`（`renderCurrentState`）・…
  * 後：設定・解除を呼ぶのは`InputTracker`のみ（`InputTracker`は`getSelectedVertices`も読む）。そのほかに`getSelectedVertices`を読むのは`main.js`（`renderCurrentState`）・…（以降は不変）
* **要件4（32:6・33:6）**
  * 32 前：…値の分をなくすため（判定の関数の分は`core/FocusKeyYieldRules`。…
  * 32 後：…値の分をなくすため（`OperationMode`は本ファイルへ移し、`SHAPE_TYPES`は正本の`ShapeFactory.js`から直接importする形になった。判定の関数の分は`core/FocusKeyYieldRules`。…
  * 33 前：…importしていた（値の分は`core/InputModes`。`_doc/arch/32_InputModes.md`）。…
  * 33 後：…importしていた（値の分は`core/InputModes`（`OperationMode`。`SHAPE_TYPES`は正本の`ShapeFactory.js`から直接importする形になった）。`_doc/arch/32_InputModes.md`）。…
* **要件5（16:2）**
  * 前：確認したNode.jsの版はv24.20.0。
  * 後：確認したNode.jsの版はv24.15.0。（`node -v` の実測値）
* **確認**
  * `git diff -U0`：変更ハンクは6つ（01:1、03:4、16:2、24:3、32:6、33:6）のみ。各 `+1 -1`、行の増減なし。
  * 行末（作業ツリーを実測）：01・03・16 は CRLF のまま（全行）、24・32・33 は LF のまま（全行）。編集はバイト単位で行い、前後で変わっていない。
  * `node --test`：tests 1543 / suites 230 / pass 1543 / fail 0。
  * `git diff --name-only`：上記6ファイルのみ。`js/`・`test/`・`index.html`・`asset/` に差分なし。`git status` の未追跡は既存の `.vscode/` のみ。

## 5. 開発資料の更新予定
* 該当なし（本作業で資料を直接修正した）。

## 6. 懸念事項・要確認ポイント
* 特になし。（`git diff` が24・32・33で「LF will be replaced by CRLF」の警告を出すが、autocrlf設定による表示で、ファイルの行末は変えていない。）
