# RES: 作業計画・作業レポート (Interrupt) : Phase 10 クローズの開発資料の相違の修正
* 参照元REQ: `./_log/req/261123_2040_REQ_Interrupt_Phase10_Close_Doc_Fix.md`

## 1. 作業目的
Phase 10のクローズに伴うSurvey（`./_log/res/261123_1315_RES_Survey_Phase10_Doc_Consistency.md` の5章＝995〜1042行）が見つけた、開発資料と実コードの相違47件のうちNo.43を除く46件と、追加5件（A1〜A5）、コードのコメント2か所（C1・C2）を直す。

* 資料の記述を実コードに合わせるのが唯一の方向で、コードのふるまいは一切変えない。`js/`・`index.html`で変えてよいのはC1・C2のコメントの文字だけ。
* No.43（`16_test.md`の「（Node.js v24.20.0で確認）」）・Survey 6章のA1〜A5以外の項目・`PROJECT_ARCHITECTURE.md` 265行(c)は変えない。テストは足さない。テストプレイは行わない。
* 確定した事実：書き出し形式の版3（Phase 09-04）・版4（Phase 10-04）はどちらもエンジンへ連絡済み。Phase 10-01のテストプレイは2026-11-22に合格。ツールパレットの実測はx 28〜74、y 108〜486（見出し39px＋本体337px＋枠2px）。

## 2. アーキテクチャ設計
### 共通の直し方（REQの原則の要約。全タスクで守る）
1. 列挙の取りこぼしは、実コードに合わせて列挙そのものに足す（参照で済ませない）。
2. 「だけ」「のみ」の断定は、実態と合わなければ外して実態を書く。設計として守りたい約束は残す。どちらとも決められなければ直さずに報告する。
3. 「確かめられない・テストできない」の誤り（No.8・9・11・16・21・22・40・41）は、理由を外して**「今はテストが無い」**にそろえる。`InputTracker`の生成が`canvas`・`DragTracker`（`window`）に依存することの記述は残してよい。
4. 過去の時点の記述は、今の事実と取り違えるものだけ、時点を書き添えるか今の値に直す。
5. 行末を変えない。修正に必要のない箇所は1文字も変えない。既存の表記・箇条の形・経緯の付記を保つ。伸びるときは同じ節の冗長な表現を削る。
6. Survey 5章の記述と実コードが食い違う場合は、その箇所を直さず相違点を報告して指示を待つ。

### 置き換えの手順（全タスク共通）
* 各タスクの作業内容に、置き換えの「旧」「新」を計画時に確定した文で書いた。**旧の文字列が開始時点のファイルに1回だけ現れ、行番号が合うことを計画時に機械的に確かめた**（タスク7のC2の476行・483行だけは同じ文が2回で、2か所とも置き換える）。「旧:」「新:」の見出しと字下げは計画書の体裁で、ファイルの文字ではない。行番号は開始時点のもので、箇所は旧の文言で特定する。
* 実コードとの照合は、計画時にNo.1・2・6〜9・11・12・14・16〜24・26〜36・38〜42・47で該当箇所のコードかテストを読むか実行して行った。ほかの番号は資料の文言とSurveyの記述だけで確定した。担当タスクで、置き換える前に該当する実コードを確かめること（旧の文言が見つからない・実コードと合わないときは、直さず報告する）。
* 書き換えの前に、対象ファイルのバイト数・CRLFの数・LFの数を実測する。置き換えはバイト列のまま行う（Edit、または`python`で`rb`／`wb`。開いて書き直すときに行末を変換しない）。終わったら同じ値を測り、行末の種類が変わっていないことを確かめる（`grep -c $'\r$'`は使わない）。
* 開始時点の実測（計画時）：

    | ファイル | バイト数 | CRLFの数／LFの総数 | 終了時のCRLFの数／LFの総数 |
    | --- | --- | --- | --- |
    | `PROJECT_ARCHITECTURE.md` | 398982 | 825／825 | 820／820（タスク3で5行減る） |
    | `_doc/arch/01_index_html.md` | 33974 | 20／20 | 同じ |
    | `_doc/arch/02_main.md` | 41346 | 84／84 | 同じ |
    | `_doc/arch/06_InputTracker.md` | 53944 | 57／57 | 同じ |
    | `_doc/arch/07_KeyboardShortcuts.md` | 18717 | 0／23 | 同じ |
    | `_doc/arch/12_shapes.md` | 64464 | 91／91 | 同じ |
    | `_doc/arch/14_edit.md` | 54788 | 118／118 | 同じ |
    | `_doc/arch/15_io.md` | 22044 | 37／37 | 同じ |
    | `_doc/arch/16_test.md` | 131429 | 237／237 | 同じ |
    | `_doc/arch/32_InputModes.md` | 5905 | 0／8 | 同じ |
    | `_doc/arch/40_asset_sprite.md` | 2692 | 0／6 | 同じ |
    | `_doc/arch/42_ScaleHandleRules.md` | 9003 | 0／11 | 同じ |
    | `_doc/arch/43_RotationRules.md` | 9206 | 0／14 | 同じ |
    | `js/core/InputTracker.js` | 142447 | 2020／2020 | 同じ |
    | `index.html` | 42208 | 0／689 | 同じ |

### 要件1: `PROJECT_ARCHITECTURE.md` 1章（No.1〜No.4）
使う側の列挙に2件を足し、「存在しないもの」から連絡済みの3か所を消す。タスク1。

### 要件2: `PROJECT_ARCHITECTURE.md` 3章3.・17.（No.6・No.10・No.44）
`Shift`の効く操作・配線ブロックの制約の時点・メソッドの番号。タスク2。

### 要件3: `PROJECT_ARCHITECTURE.md` 3章18.（No.13。A2の615行を含む）
前半・後半の2段の構成を1つにまとめる。前半の各項はすでに08-02bの内容を含むため、項の並び（ツール・操作モードの一覧 → 選択（`V`）の変更 → 頂点の選択モードの操作 → モジュールの分担 → 頂点のハンドルの表示 → ハンドルの処理の整理 → 履歴・保存 → ツールのアイコン → 発注者の決定 → やらないこと → 注意 → テストプレイの結果）は今のまま残し、後半の5項（618〜622行）の内容を対応する項へ移して消す。対応表はタスク3の作業内容。タスク3（単独）。

### 要件4: `PROJECT_ARCHITECTURE.md` 3章25.・26.・27.（No.15〜No.18・No.21・No.22・No.24）
テストプレイの結果・「今はテストが無い」・中断の対象・クリックの順序・誤差の説明。タスク4。

### 要件5: `PROJECT_ARCHITECTURE.md` の追加（A1〜A4）
外枠の正本の範囲・「やらないこと」の参照の言い方・版の時点・件数の時点。A2の対象はREQの挙げた08-02a（タスク3）・08-03・08-04・08-05・09-02b。タスク5。

### 要件6: `_doc/arch/01_index_html.md`・`02_main.md`（No.25〜No.29・A5）と`index.html`のコメント（C1）
タスク6。

### 要件7: `_doc/arch/06_InputTracker.md`（No.30〜No.32）と`js/core/InputTracker.js`のJSDoc（C2）
タスク7。

### 要件8: `_doc/arch/12_shapes.md`（No.33〜No.37）
タスク8。

### 要件9: `_doc/arch/16_test.md`（No.38〜No.42・No.46・No.47）
タスク9。

### 要件10: `_doc/arch/07`・`14`・`15`・`32`・`40`・`42`・`43`（No.5・No.7〜No.9・No.11・No.12・No.14・No.19・No.20・No.23・No.45）
ファイル4つまでの目安に従い、タスク10（`07`・`14`・`15`・`32`）とタスク11（`40`・`42`・`43`）に分ける。

### 要件11: 確認
タスク12（固定タスク）。

### 関連フォルダと論理クラス
*   **対象フォルダ**: リポジトリのルート（`PROJECT_ARCHITECTURE.md`・`index.html`のコメント）、`./_doc/arch/`（REQが挙げた12ファイル）、`./js/core/`（`InputTracker.js`のJSDocの3行だけ）
*   **関連する論理クラス**: なし（コードのふるまいは変えない。クラス・関数の追加・変更なし）

### 参照する責務
*   本作業は資料の記述を実コードに合わせるもので、責務の判断を要しない。資料の記載基準（`PROJECT_ARCHITECTURE.md`の冒頭）：第一の目的はハルシネーションの防止、第二がコンテキストの削減。責務・境界・依存方向・流れと順序の保証・設計判断の理由・やらないと決めたこと・未実装のものは残す。1つのファイルのJSDocを読めば分かることは書かない。消すか迷ったら残す。誤った記述は直すか消す。

### 開発資料（`PROJECT_ARCHITECTURE.md`）の更新予定
*   本作業は開発資料の修正そのものが目的で、テンプレートの「書き換えは最終タスクのみ」の定めは適用しない（REQの指示）。各タスクで担当する資料を直接直す。責務マッピングの変更はない。

## 3. タスクリスト
*   [x] タスク1: 要件1 `PROJECT_ARCHITECTURE.md` 1章（No.1〜No.4）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.1・No.2：使う側の列挙に足す（実コード：`InputModes`の`js/`のimport元は`ScaleHandleRules.js:5`を含む9ファイル、`NudgeTargetRules`のimport元は`PathCornerEditor.js:6`を含む4ファイル）。
        *   No.3・No.4：「存在しないもの」の行から版4（2か所）・版3の「確認と連絡票」を消す。この行の、ほかの項目は変えない。265行(c)は変えない。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.1（`PROJECT_ARCHITECTURE.md` 29行）：
            ```text
            旧: VertexHandleRules・NudgeTargetRules・wiring/ToolIconWiring・main.jsから使う
            新: VertexHandleRules・NudgeTargetRules・ScaleHandleRules・wiring/ToolIconWiring・main.jsから使う
            ```
        *   No.2（`PROJECT_ARCHITECTURE.md` 42行）：
            ```text
            旧: `edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/TransformInputEditor`から使う
            新: `edit/NudgeEditor`・`edit/PositionInputEditor`・`edit/TransformInputEditor`・`edit/PathCornerEditor`から使う
            ```
        *   No.3（10-02の列挙の末尾）（`PROJECT_ARCHITECTURE.md` 218行）：
            ```text
            旧: 、エンジンでの版4の確認と連絡票（Phase 10-04）、**変形のPhase 10-03
            新: 、**変形のPhase 10-03
            ```
        *   No.3（10-03の列挙の末尾）（`PROJECT_ARCHITECTURE.md` 218行）：
            ```text
            旧: ・エンジンでの版4の確認と連絡票（Phase 10-04）、頂点の選択の保存
            新: 、頂点の選択の保存
            ```
        *   No.4（`PROJECT_ARCHITECTURE.md` 218行）：
            ```text
            旧: 、エンジンでの版3の確認と連絡票（Phase 09-04）、曲線の方向のハンドル
            新: 、曲線の方向のハンドル
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク2: 要件2 `PROJECT_ARCHITECTURE.md` 3章3.・17.（No.6・No.10・No.44）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.6：`Shift`の実態（`InputTracker.js:873・1604・1628・1654`）に合わせる。移動方向の限定が効く操作の範囲と、直線・曲線のツールの例外は残す。
        *   No.10：時点の制約であることを書き添える。No.44：番号だけ直す。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.6（`PROJECT_ARCHITECTURE.md` 367行）：
            ```text
            旧: `Shift`が効くのは本体の移動だけ（頂点のハンドル・範囲選択・パン・弧・矩形・円の作成では何もしない）。例外として、
            新: `Shift`が移動方向を限定するのは本体の移動だけ（頂点のハンドル・範囲選択・パン・弧・矩形・円の作成では何もしない。拡大縮小のドラッグでは比率を保ち、回転のドラッグでは15°刻みにする。25.・26.）。例外として、
            ```
        *   No.10（`PROJECT_ARCHITECTURE.md` 594行）：
            ```text
            旧: `main.js`の配線ブロックの切り出しは行わない。
            新: `main.js`の配線ブロックの切り出しは行わない（Phase 07-05の指示書の時点の制約。今は`wiring/`へ切り出したものがある。1章）。
            ```
        *   No.44（`PROJECT_ARCHITECTURE.md` 594行）：
            ```text
            旧: ハンドルの位置は図形クラスの共通メソッド（17番目）で求める
            新: ハンドルの位置は図形クラスの共通メソッド（16番目）で求める
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク3: 要件3 `PROJECT_ARCHITECTURE.md` 3章18. を1つの構成にまとめる（No.13・A2の615行）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   下の対応表のとおりに直す。対応表に「そのまま」とある項は1文字も変えない。
        *   章の見出しの番号・題（「18. **頂点の選択（…）…**」）は変えない。章の終わりの空行（「19.」の前の1行）は残す。CRLFは825→820（618〜622行の5行を消すため）。
        *   落としてよいのは理由(a)(b)(c)（REQの要件3）とA2のものだけ。作業の後に、落とした文の内容が章（または表に書いた参照先）にあることを1つずつ確かめる。
        *   「18.」を指す参照（`PROJECT_ARCHITECTURE.md`の218・336・363・366・539・561・735・751・752行、`_doc/arch/02_main.md`74行、`03_VectorModel.md`4・5行、`06_InputTracker.md`15・22行、`16_test.md`220行、`42_ScaleHandleRules.md`10行）の指す内容が章に残っていることを確かめる（参照元は変えない）。「前半」「後半」の語は368行・`03_VectorModel.md`4行・`06_InputTracker.md`19行も使うため、見出しの括弧に「Phase 08-02a＝前半」「Phase 08-02b＝後半」の対応を残す。
        *   作業レポート（4章）に、対応表の実施結果（置き場所・落とした理由）を書く。
        *   **まとめる前の項（箇条）と、まとめた後の置き場所の対応表**（行番号は開始時点。落とした理由(a)＝2か所の重複、(b)＝反映済みの「訂正」の履歴、(c)＝後で変わって今は成り立たない文）：

            | まとめる前の項（行） | まとめた後の置き場所 | 落としたもの・理由 |
            | --- | --- | --- |
            | 見出し（598） | 見出し。括弧の中をPhase 08-02a＝前半・08-02b＝後半の対応に書き直す | なし（番号・題は変えない） |
            | ツール・操作モードの一覧（599） | そのまま | なし |
            | 選択（`V`）の変更（600） | そのまま | なし |
            | 頂点の選択モードの操作（601）・クリック（602）・押下（603）・まとめ移動（604）・範囲選択（605）・`Esc`（606）・`Delete`（607） | そのまま（すでに前半・後半の両方を含む） | なし |
            | ホバー・カーソル（608） | 同じ項。618行の「範囲選択中のカーソルは既存の構造により矢印のまま」を加える | なし |
            | モジュールの分担（609） | 同じ項。618行の「`js/main.js`・`CanvasManager`・`CursorShapeRules`は変更していない（…）」を、08-02bの時点の記述として末尾に加える | なし |
            | 頂点のハンドルの表示（610）・使われないハンドルの処理の整理（611） | そのまま | なし |
            | 履歴・保存（612） | 同じ項。「変更していない」「版は2のまま」に時点を付け、618行の「変えていない」（状態の形・不変条件・保存しないこと・選択（`V`）のふるまい）をここへ移す | 時点の無い「版は作業データ・書き出し形式とも2のまま」＝(c)（時点を付けて残し、今の版は2章を指す） |
            | ツールのアイコン（613） | そのまま | なし |
            | 発注者の決定・08-02a（614） | 「発注者の決定」の(1)〜(8)。番号は変えない | (2)の「前半では何も始めないとしたが」＝(c)、(2)の末尾の「図形は動かない」＝(a)（同じ文の中の重複） |
            | やらないこと・08-02a（615） | 「やらないこと」の前半。参照の言い方をやめる。列挙の項目は変えない | 「1章「存在しないもの」のPhase 08-02aの分のとおり」＝A2（指す括りが無い） |
            | 注意（616） | そのまま | なし |
            | テストプレイの結果・08-02a（617） | 「テストプレイの結果」（08-02aの確認項目と結果） | なし |
            | Phase 08-02bの要点（618）：複数選択の入口 | 602・603・605の各項 | (a) |
            | 同：まとめ移動は`updateVertices`で通知1回・取り消し1件／吸い付きは1つだけのとき | 604・609の各項と、決定の(11) | (a) |
            | 同：`A`のまま`Ctrl`＋クリックで図形の追加・解除（頂点の選択は空にならない） | 602の項と、決定の(12) | (a) |
            | 同：状態の形・不変条件・保存しないこと・履歴の対象外・版・選択（`V`）のふるまいは変えていない | 612の項（履歴の対象外は元から612にある） | 履歴の対象外＝(a)、版の「どちらも2」の時点の無い書き方＝(c)（612の時点付きの記述へ） |
            | 同：`js/main.js`・`CanvasManager`・`CursorShapeRules`は変更していない／範囲選択中のカーソル | 609・608の項 | なし（時点を付けて残す） |
            | 発注者の決定・08-02b（619）の(1)〜(5) | 「発注者の決定」の(9)〜(13) | なし |
            | 同(6)（前半の決定はそのまま） | `Esc`の2段＝決定の(14)、`Delete`・`Backspace`＝決定の(4)へ`Backspace`を足す | 円・弧＝(3)との重複(a) |
            | やらないこと・08-02b（620） | 「やらないこと」の後半。1章218行にある08-02b由来の項目（方向の限定・吸い付き・範囲選択の対象）を列挙で書く。08-04で入った「位置の数値入力」の付記は残す | 「1章…Phase 08-02bの分のとおり」＝指す括りが無い（A2と同じ）。「矢印キーでの微調整」の付記＝(a)（615行の分） |
            | 前半の記述の訂正（621） | なし | (b)。「どちらからでも範囲選択が始まる」＝603④・605・決定の(2)(9)、「クリックは`Ctrl`を見る」＝602、「2つ以上の組が入る」＝602・605と2章336行に反映済み |
            | テストプレイの結果・08-02b（622） | 「テストプレイの結果」の末尾（全項目OK。tests 1411は08-02bの完了時の件数と明記） | 日付・`16_test.md`の参照＝(a) |

        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.13（見出し）（`PROJECT_ARCHITECTURE.md` 598行）：
            ```text
            旧: （Phase 08-02a。図形を選ぶ「選択（`V`）」と、図形の頂点を選ぶ「頂点の選択（`A`）」を分ける。前半＝ツールの骨組みと頂点を1つ選んで動かすまで。Phase 08-02b＝後半：頂点を複数選んで、まとめて動かす）：
            新: （図形を選ぶ「選択（`V`）」と、図形の頂点を選ぶ「頂点の選択（`A`）」を分ける。Phase 08-02a＝前半：ツールの骨組みと頂点を1つ選んで動かすまで。Phase 08-02b＝後半：頂点を複数選んで、まとめて動かす）：
            ```
        *   No.13（ホバー・カーソル）（`PROJECT_ARCHITECTURE.md` 608行）：
            ```text
            旧: （`CursorShapeRules`の判定表の(2a)。パン中・`Space`押下中の優先は変えない。
            新: （`CursorShapeRules`の判定表の(2a)。範囲選択中は既存の構造により矢印のまま。パン中・`Space`押下中の優先は変えない。
            ```
        *   No.13（モジュールの分担の末尾）。609行の末尾（この文の直後が「頂点のハンドルの表示」の項）（`PROJECT_ARCHITECTURE.md` 609行）：
            ```text
            旧: 再描画は既存の`model.onChange`の経路のみ（機能専用の経路を足さない）。
            新: 再描画は既存の`model.onChange`の経路のみ（機能専用の経路を足さない）。Phase 08-02bでは`js/main.js`・`CanvasManager`・`CursorShapeRules`を変更していない（複数の頂点が選ばれた色で並ぶ表示・カーソルの形は既存の経路のまま。3つとも後に外枠のハンドル等で変わった。25.・26.）。
            ```
        *   No.13（履歴・保存）（`PROJECT_ARCHITECTURE.md` 612行）：
            ```text
            旧: （`io/DocumentSerializer`・`edit/SnapshotAdapter`・`io/SpriteSerializer`は変更していない。版は作業データ・書き出し形式とも2のまま）。
            新: （Phase 08-02a・08-02bでは`io/DocumentSerializer`・`edit/SnapshotAdapter`・`io/SpriteSerializer`を変更せず、作業データ・書き出し形式の版も当時の2のまま変えていない。今の版は2章。頂点の選択の状態の形・不変条件・保存しないこと・選択（`V`）のふるまいはPhase 08-02bでも変えていない）。
            ```
        *   No.13（発注者の決定(2)）（`PROJECT_ARCHITECTURE.md` 614行）：
            ```text
            旧: (2) 頂点の選択（`A`）で、本体の上・空白の押下は図形を動かさない（前半では何も始めないとしたが、Phase 08-02bから範囲選択が始まる。図形は動かない）。
            新: (2) 頂点の選択（`A`）で、本体の上・空白の押下は図形を動かさない（Phase 08-02bから範囲選択が始まる）。
            ```
        *   No.13（発注者の決定(4)）（`PROJECT_ARCHITECTURE.md` 614行）：
            ```text
            旧: (4) `A`で`Delete`は何もしない。
            新: (4) `A`で`Delete`・`Backspace`は何もしない。
            ```
        *   No.13（発注者の決定の末尾へ08-02bの分を続ける。619行から）（`PROJECT_ARCHITECTURE.md` 614行）：
            ```text
            旧: （`main.js`の`syncDeleteButtonState`へ操作モードの判定を足さない。`main.js`に判定を持たせない方針のため）。
            新: （`main.js`の`syncDeleteButtonState`へ操作モードの判定を足さない。`main.js`に判定を持たせない方針のため）。**Phase 08-02bの決定**：(9) 頂点の範囲選択の枠は、空白からでも図形の本体（線の上）からでも引き始められる。(10) 範囲選択で選べる頂点は、頂点が出ている図形（選択集合の図形）の頂点だけ。範囲選択で図形そのものの選択は変わらない。(11) 端点への吸い付きは、頂点を1つだけ選んでいるときだけ働く（2つ以上では吸い付かない。スナップの丸めは働く）。(12) `A`のまま`Ctrl`（`⌘`）＋クリックで図形そのものを選択へ追加・解除できる。(13) 頂点のドラッグに`Shift`での移動方向の限定は入れない。(14) `Esc`はまず頂点の選択だけを解除し、もう一度で図形の選択も解除する。
            ```
        *   A2（615行）・No.13（やらないこと。620行をまとめる）（`PROJECT_ARCHITECTURE.md` 615行）：
            ```text
            旧: *   **やらないこと（08-02a）**：1章「存在しないもの」のPhase 08-02aの分のとおり（頂点の追加・削除、矢印キーの微調整、ツールごとのカーソルの形、他のアイコンの差し替え、アイコンの`devicePixelRatio`の変化での描き直し）。（Phase 08-03で「矢印キーの微調整」は入った。頂点の微調整は`NudgeEditor`が`VectorModel.updateVertices`の既存の経路に載せて動かす＝通知1回・取り消し1件。19.）
            新: *   **やらないこと**：頂点の追加・削除、矢印キーの微調整、ツールごとのカーソルの形、他のアイコンの差し替え、アイコンの`devicePixelRatio`の変化での描き直し。（Phase 08-03で「矢印キーの微調整」は入った。頂点の微調整は`NudgeEditor`が`VectorModel.updateVertices`の既存の経路に載せて動かす＝通知1回・取り消し1件。19.）頂点の複数選択・まとめ移動では、頂点のドラッグでの`Shift`による方向の限定、2つ以上の頂点を選んでいるときの端点への吸い付き、範囲選択で図形そのもの・頂点が出ていない図形の頂点を選ぶこと。（Phase 08-04で「位置の数値入力」は入った。20.）
            ```
        *   No.13（テストプレイの結果。622行をまとめる）（`PROJECT_ARCHITECTURE.md` 617行）：
            ```text
            旧: **テストプレイの結果（2026-11-16 発注者の回答）**：確認項目（
            新: **テストプレイの結果（2026-11-16 発注者の回答）**：Phase 08-02aの確認項目（
            ```
        *   No.13（テストプレイの結果の末尾と、618〜622行の5項の削除）（`PROJECT_ARCHITECTURE.md` 617行）：617行の末尾を下のとおり直し、続く618〜622行の5項（「Phase 08-02b（後半：…）」「発注者の決定（…Phase 08-02b…）」「やらないこと（08-02b）」「前半の記述の訂正」「テストプレイの結果（Phase 08-02b…）」）を行ごと消す。
            ```text
            旧: もこのテストプレイで確かめた。自動テストの件数は`_doc/arch/16_test.md`。
            新: もこのテストプレイで確かめた。Phase 08-02bも全項目OK。自動テストの件数は`_doc/arch/16_test.md`（Phase 08-02bの完了時はtests 1411）。
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク4: 要件4 `PROJECT_ARCHITECTURE.md` 3章25.・26.・27.（No.15〜No.18・No.21・No.22・No.24）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.16・No.21・No.22は原則3（「今はテストが無い」）。No.21の「一覧を`CANCELABLE_DRAG_STATES`に置く」決定と、テストを足さない事実は変えない。
        *   No.17はタスク7のNo.30（「拡大縮小・回転」）と書き方をそろえる。
        *   736行の「特に、…目視で確かめる。」の文は、確かめる範囲の説明として変えない。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.15・No.16（736行）（`PROJECT_ARCHITECTURE.md` 736行）：
            ```text
            旧: `InputTracker`の拡大縮小の配線・`DragTracker.cancel`の`suppressClick`・`CanvasManager`の描画・`main.js`の配線・`#handleKeyDown`を通した修飾キー付きの`Esc`は`node --test`で確かめられず、発注者のテストプレイで確かめる範囲（確認項目を発注者へ提示した。この資料の時点で結果は未記録）。
            新: `InputTracker`の拡大縮小の配線・`DragTracker.cancel`の`suppressClick`・`CanvasManager`の描画・`main.js`の配線は`node --test`で確かめられず、`#handleKeyDown`を通した修飾キー付きの`Esc`は今はテストが無い。いずれも発注者のテストプレイで確かめる範囲（確認項目は`_log/res/261122_1050_RES_Phase10-01_Scale_Handles.md`の4章タスク13。2026-11-22に発注者のテストプレイで合格）。
            ```
        *   No.16（732行）（`PROJECT_ARCHITECTURE.md` 732行）：
            ```text
            旧: （`#handleKeyDown`は`document`に依存してテストできないため）
            新: （`#handleKeyDown`を通した修飾キー付きの`Esc`は今はテストが無い）
            ```
        *   No.17（`PROJECT_ARCHITECTURE.md` 730行）：
            ```text
            旧: （拡大縮小のドラッグだけ。ほかの左ドラッグは反映済みの変化が残って1件記録される。6.）
            新: （拡大縮小・回転のドラッグだけ。ほかの左ドラッグは反映済みの変化が残って1件記録される。6.）
            ```
        *   No.18（`PROJECT_ARCHITECTURE.md` 726行）：
            ```text
            旧: （待ち受けの判定の後・`hit.handle`の前。押して
            新: （待ち受けの判定の後・選択の変更の前。押して
            ```
        *   No.21（`PROJECT_ARCHITECTURE.md` 750行）：
            ```text
            旧: （判定の1か所`isScalingSelection()`が`DragTracker`・DOMに依存して`node --test`で確かめられないため。テストは一覧の中身と`findCancelableDragBinding`への受け渡しで確かめる）
            新: （判定の1か所`isScalingSelection()`は今はテストが無い。テストは一覧の中身と`findCancelableDragBinding`への受け渡しで確かめる）
            ```
        *   No.22（InputTrackerの配線の列挙から外す）（`PROJECT_ARCHITECTURE.md` 753行）：
            ```text
            旧: `getRotationDragView`・`isScalingSelection`・`handleClick`の動かさず離したとき）
            新: `getRotationDragView`・`handleClick`の動かさず離したとき）
            ```
        *   No.22（本文）（`PROJECT_ARCHITECTURE.md` 753行）：
            ```text
            旧: ・`main.js`の配線・`#handleKeyDown`を通した修飾キー付きの`Esc`・回転のカーソルの実際の絵と向き・ピッカーを開いたままの回転・離した瞬間の再描画は`node --test`で確かめられず、発注者のテストプレイで確かめる範囲
            新: ・`main.js`の配線・回転のカーソルの実際の絵と向き・ピッカーを開いたままの回転・離した瞬間の再描画は`node --test`で確かめられず、`isScalingSelection`・`#handleKeyDown`を通した修飾キー付きの`Esc`は今はテストが無い。いずれも発注者のテストプレイで確かめる範囲
            ```
        *   No.24（`PROJECT_ARCHITECTURE.md` 770行）：
            ```text
            旧: (d) 回した・裏返した円・弧の座標に三角関数由来の約1e-14の誤差が出る（テストは許容誤差で比べる）。
            新: (d) 回した円・弧の座標と、弧の外枠の値（反転の前から）に三角関数由来の約1e-14の誤差が出る（裏返した円・弧の座標には出ない。テストは許容誤差で比べる）。
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク5: 要件5 `PROJECT_ARCHITECTURE.md` の追加（A1〜A4）
    *   **対象ファイル** :
        *   `./PROJECT_ARCHITECTURE.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   A1：線を含む外枠の正本であることを明示し、線を含まない外枠は27.を参照する。約束（線を含む外枠の求め方を増やさない）は残す。
        *   A2：634・649・666・721行（615行はタスク3）。参照の言い方と、列挙を囲む括弧だけを外し、列挙の項目は変えない。721行（09-02b）は、1章218行に「Phase 09-02b」の語はあるが、「区間の切り替えのキー（…。Phase 09-02b）」という1項目の付記で、10-01〜10-03の「**変形のPhase 10-0x（…）でやらないと決めたこと**＝」のような括りではないため、括りとして成り立たないと判断した。
        *   A3：時点を書き添える（今の作業データの版は3）。A4：件数の時点を書き添える（件数は変えない）。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   A1（`PROJECT_ARCHITECTURE.md` 657行）：
            ```text
            旧: 外枠の求め方の正本は`SpriteSerializer.computeShapesBounds`（線を描く図形は線の太さの半分だけ外側へ広げる。書き出しの`bounds`・ステータスバーの「大きさ」と同じ値。位置の欄（20.）はPhase 10-03から線を含まない外枠の上の基準点で、この値とは別。27.）で、2通りにしない。
            新: 整列・分布・書き出しの`bounds`・ステータスバーの「大きさ」が使う**線を含む外枠**の求め方の正本は`SpriteSerializer.computeShapesBounds`（線を描く図形は線の太さの半分だけ外側へ広げる）で、2通りにしない。線を含まない外枠（`ShapeExtentReader.getSelectedGeometryBounds`。外枠のハンドル・回転・基準点・位置の欄（Phase 10-03から）・幅と高さの欄）は別（27.）。
            ```
        *   A2（634行・前）（`PROJECT_ARCHITECTURE.md` 634行）：
            ```text
            旧: 1章「存在しないもの」のPhase 08-03の分のとおり（整列と分布（
            新: 整列と分布（
            ```
        *   A2（634行・後）（`PROJECT_ARCHITECTURE.md` 634行）：
            ```text
            旧: ボタンの追加、性能の改善、書き出しの際の座標の丸め）。
            新: ボタンの追加、性能の改善、書き出しの際の座標の丸め。
            ```
        *   A2（649行・前）（`PROJECT_ARCHITECTURE.md` 649行）：
            ```text
            旧: 1章「存在しないもの」のPhase 08-04の分のとおり（整列と分布（
            新: 整列と分布（
            ```
        *   A2（649行・後）（`PROJECT_ARCHITECTURE.md` 649行）：
            ```text
            旧: 位置の欄でのスナップの丸め・端点への吸い付き、欄の値の保存）。
            新: 位置の欄でのスナップの丸め・端点への吸い付き、欄の値の保存。
            ```
        *   A2（666行・前）（`PROJECT_ARCHITECTURE.md` 666行）：
            ```text
            旧: 1章「存在しないもの」のPhase 08-05の分のとおり（頂点をそろえる機能、
            新: 頂点をそろえる機能、
            ```
        *   A2（666行・後）（`PROJECT_ARCHITECTURE.md` 666行）：
            ```text
            旧: 結果へのスナップの丸め・端点への吸い付き）。
            新: 結果へのスナップの丸め・端点への吸い付き。
            ```
        *   A2（721行・前）（`PROJECT_ARCHITECTURE.md` 721行）：
            ```text
            旧: 1章「存在しないもの」のPhase 09-02bの分のとおり（区間のハイライト表示、
            新: 区間のハイライト表示、
            ```
        *   A2（721行・後）（`PROJECT_ARCHITECTURE.md` 721行）：
            ```text
            旧: （Phase 09-03aの発注者の決定で今までどおり何もしない））。
            新: （Phase 09-03aの発注者の決定で今までどおり何もしない）。
            ```
        *   A3（246行）（`PROJECT_ARCHITECTURE.md` 246行）：
            ```text
            旧: そのパスだけがスキップされる（作業データの版は2のまま）。
            新: そのパスだけがスキップされる（Phase 09-03aの時点で作業データの版は2のまま。今は3）。
            ```
        *   A3（248行）（`PROJECT_ARCHITECTURE.md` 248行）：
            ```text
            旧: 角の点がなめらかに描かれるだけ（作業データの版は2のまま）。
            新: 角の点がなめらかに描かれるだけ（Phase 09-02aの時点で作業データの版は2のまま。今は3）。
            ```
        *   A3（250行）（`PROJECT_ARCHITECTURE.md` 250行）：
            ```text
            旧: 曲がり方を持つ区間（`'bezier'`）の追加でも作業データの版は2のまま（古いエディタでは
            新: 曲がり方を持つ区間（`'bezier'`）の追加でも、その時点（Phase 09-01a・09-03a）の作業データの版は2のまま（今は3。古いエディタでは
            ```
        *   A4（`PROJECT_ARCHITECTURE.md` 772行）：
            ```text
            旧: （件数は`_doc/arch/16_test.md`。tests 2467 / suites 400）
            新: （件数は`_doc/arch/16_test.md`。Phase 10-03の完了時はtests 2467 / suites 400）
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク6: 要件6 `_doc/arch/01_index_html.md`・`02_main.md`・`index.html`（No.25〜No.29・A5・C1）
    *   **対象ファイル** :
        *   `./_doc/arch/01_index_html.md` :（更新。記述の修正）
        *   `./_doc/arch/02_main.md` :（更新。記述の修正）
        *   `./index.html` :（更新。コメントの文字だけ）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.25・C1は、REQの実測（y 108〜486、見出し39px＋本体337px＋枠2px）に合わせる。`index.html`はコメントの文字だけを変え、宣言は変えない。
        *   No.26・No.27は同じファイルの16行・17行と、`index.html`（`.toolbar-group`・`user-select: text`のセレクタ＝436〜446行）に合わせる。
        *   No.29：`js/main.js:306`。A5：同じ行のほかの「切り出しはしていない」（Phase 10-03・10-02の時点の記述）は変えない。1章の`wiring/`の項（`DisplayWiring`・`ToolIconWiring`の2つ）と食い違わないことを確かめる。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.25（`_doc/arch/01_index_html.md` 12行）：
            ```text
            旧: `y 108〜約450`（ツールバー
            新: `y 108〜486`（ツールバー
            ```
        *   No.26（`_doc/arch/01_index_html.md` 15行）：
            ```text
            旧: `#toolbar`の既存3つのまとまりの右に続く5つの`<div class="toolbar-group">`（スタイル`#option-style-group`、重なり順`#option-order-group`、位置`#option-position-group`。Phase 08-04、整列・分布
            新: `#toolbar`の既存3つのまとまりに続く7つの`<div class="toolbar-group">`（スタイル`#option-style-group`、重なり順`#option-order-group`、位置`#option-position-group`。Phase 08-04、大きさ`#option-size-group`・変形`#option-transform-group`。Phase 10-03、整列・分布
            ```
        *   No.27（`_doc/arch/01_index_html.md` 15行）：
            ```text
            旧: オプションバーの中では太さの欄と位置の欄のみ`user-select: text`
            新: オプションバーの中では太さ・位置・幅・高さ・角度の欄のみ`user-select: text`
            ```
        *   No.28（15行）（`_doc/arch/01_index_html.md` 15行）：
            ```text
            旧: （CSSコメント「ツールバー全体の幅の見積もり」が正。最初の
            新: （CSSコメント「ツールバーの各行の幅の見積もり」が正。最初の
            ```
        *   No.28（17行）（`_doc/arch/01_index_html.md` 17行）：
            ```text
            旧: CSSコメント「ツールバー全体の幅の見積もり」が正。実測は
            新: CSSコメント「ツールバーの各行の幅の見積もり」が正。実測は
            ```
        *   No.29（`_doc/arch/02_main.md` 4行）：
            ```text
            旧: `syncZoomDisplay`・`syncDeleteButtonState`
            新: `syncZoomDisplay`・`resetViewToCenter`・`syncDeleteButtonState`
            ```
        *   A5（`_doc/arch/02_main.md` 3行）：
            ```text
            旧: Phase 08-01で`// 6.5.`の表示配線だけを`wiring/DisplayWiring`へ切り出した）
            新: 例外はPhase 08-01で`// 6.5.`の表示配線を`wiring/DisplayWiring`へ、Phase 08-02aでツールのアイコンを描く配線を`wiring/ToolIconWiring`へ切り出した2つ）
            ```
        *   C1（1行目）（`index.html` 236行）：
            ```text
            旧: 1280×800での範囲はx 28〜74、y 108〜約450
            新: 1280×800での範囲はx 28〜74、y 108〜486
            ```
        *   C1（2行目）（`index.html` 237行）：
            ```text
            旧: （見出し約39px＋本体約301px＋枠2px）で、
            新: （見出し39px＋本体337px＋枠2px）で、
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク7: 要件7 `_doc/arch/06_InputTracker.md`・`js/core/InputTracker.js`（No.30〜No.32・C2）
    *   **対象ファイル** :
        *   `./_doc/arch/06_InputTracker.md` :（更新。記述の修正）
        *   `./js/core/InputTracker.js` :（更新。コメントの文字だけ）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.30〜No.32は同じファイルの39行・41行と、`InputTracker.js:1654・1734〜1738・2006`に合わせる。
        *   C2：JSDocの3行の文字だけを変える（行数・CRLFの数2020は変わらない）。コードには触れない。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.30（`_doc/arch/06_InputTracker.md` 33行）：
            ```text
            旧: **中断で引き始めの形に戻るのは拡大縮小だけ**
            新: **中断で引き始めの形に戻るのは拡大縮小・回転だけ**
            ```
        *   No.31（`_doc/arch/06_InputTracker.md` 31行）：
            ```text
            旧: `#updateCursor(hit, scaleHandle)`は`#scaleDrag`があれば
            新: `#updateCursor(hit, scaleHandle, rotationCorner)`（第3引数はPhase 10-02）は`#scaleDrag`があれば
            ```
        *   No.32（`_doc/arch/06_InputTracker.md` 43行）：
            ```text
            旧: Phase 10-01。3章25.）と、直線・曲線のツールで
            新: Phase 10-01。3章25.）、回転のドラッグの追従のたびのイベント（15°刻み。Phase 10-02。3章26.）と、直線・曲線のツールで
            ```
        *   C2（451行）（`js/core/InputTracker.js` 451行）：
            ```text
            旧: MARQUEE_SELECTING / SCALING_SELECTION）。状態遷移マシンの起点。
            新: MARQUEE_SELECTING / SCALING_SELECTION / ROTATING_SELECTION）。状態遷移マシンの起点。
            ```
        *   C2（476行・483行の2か所。同じ文）（`js/core/InputTracker.js` 476行）：
            ```text
            旧: MARQUEE_SELECTING/SCALING_SELECTION状態では未使用（null）。
            新: MARQUEE_SELECTING/SCALING_SELECTION/ROTATING_SELECTION状態では未使用（null）。
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク8: 要件8 `_doc/arch/12_shapes.md`（No.33〜No.37）
    *   **対象ファイル** :
        *   `./_doc/arch/12_shapes.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.33〜No.35の実コード：`VertexHandleRules.js:26・68・98`・`NudgeEditor.js:143`、`TransformInputEditor`の`#apply`（`setSize`・`rotateBy`・`flip`から呼ばれる）、`PathCornerEditor.js:152`（`#remapSelectedVertices`）。
        *   No.34：Survey 5章は契機を「位置・大きさ・角度の欄・反転の入力」と書くが、`TransformInputEditor`が受け持つのは幅・高さ・角度・反転（位置の欄は`NudgeEditor`の平行移動）。「のみ」が誤りである点は正しいので直す。
        *   No.36・No.37：半径の比・「今の約束の位置では」の限定を添える。同じファイルの8行・13行と食い違わないことを確かめる。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.33（`_doc/arch/12_shapes.md` 42行）：
            ```text
            旧: 呼び出し元は`core/InputTracker`の`#beginLeftDrag`のみ（図形種別によらずポリモーフィックに呼ぶ）。
            新: `shapes/`の外の呼び出し元は`core/InputTracker`の`#beginLeftDrag`・`core/VertexHandleRules`（`collectVertexHandles`・`collectVertexHandlesInRect`・`computeVertexHandlesBounds`）・`edit/NudgeEditor`（図形種別によらずポリモーフィックに呼ぶ）。
            ```
        *   No.34（`_doc/arch/12_shapes.md` 44行）：
            ```text
            旧: 差し替えは`#replaceWithTransformed`）のみで、結果は`VectorModel.replaceShapesKeepingIds`で同じidの位置へ入る（引き始めの図形から毎回求めるため誤差がたまらない）。
            新: 差し替えは`#replaceWithTransformed`。引き始めの図形から毎回求めるため誤差がたまらない）と`edit/TransformInputEditor`（幅・高さ・角度の欄と反転。Phase 10-03）で、結果は`VectorModel.replaceShapesKeepingIds`で同じidの位置へ入る。
            ```
        *   No.35（`_doc/arch/12_shapes.md` 43行）：
            ```text
            旧: と、範囲選択での頂点の収集（`collectVertexHandlesInRect`。Phase 08-02b））：
            新: と、範囲選択での頂点の収集（`collectVertexHandlesInRect`。Phase 08-02b）と、`edit/PathCornerEditor`＝角・区間の切り替え後の頂点の選択の付け替え）：
            ```
        *   No.36（`_doc/arch/12_shapes.md` 72行）：
            ```text
            旧: `rotation`がちょうど0になる形＝90°回した弧も
            新: `rotation`がちょうど0になる形＝横の半径が縦より小さい弧を90°回した形も
            ```
        *   No.37（頂点3つ）（`_doc/arch/12_shapes.md` 79行）：
            ```text
            旧: 弧を「頂点3つ（左端・頂上・右端）と曲がり方を持つ区間2つの開いたパス」として読み、
            新: 弧を「頂点3つ（始点・頂上・終点）と曲がり方を持つ区間2つの開いたパス」として読み、
            ```
        *   No.37（始点・終点）（`_doc/arch/12_shapes.md` 79行）：
            ```text
            旧: 弧の始点＝左端・終点＝右端（`points`の先頭の中心
            新: 弧の始点・終点は、今の約束の位置では左端・右端（回した・左右に裏返した弧では点のとおり。`points`の先頭の中心
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [x] タスク9: 要件9 `_doc/arch/16_test.md`（No.38〜No.42・No.46・No.47）
    *   **対象ファイル** :
        *   `./_doc/arch/16_test.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.40・No.41は原則3。見出しの「テストできない箇所（…）」は変えない。
        *   **236行の「（Node.js v24.20.0で確認）」は変えない（No.43）。** テストの件数の記載は変えない。
        *   No.42の実態：`HistoryManager`＋`SnapshotAdapter`を使うほかのテストは、`ClipboardController`・`PathCornerEditor`・`PathCornerEditor.segmentSwitch`・`ShapeOrderEditor`・`ShapeStyleEditor`（undo・redo）、`StyleEyedropper`・`TransformInputEditor`（undoだけ）。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.38（`_doc/arch/16_test.md` 188行）：
            ```text
            旧: （`console.warn`は`t.mock.method`で抑止）
            新: （`console.warn`を呼び出し回数を数える関数へ差し替え、`finally`で戻す）
            ```
        *   No.39（`_doc/arch/16_test.md` 19行）：
            ```text
            旧: 図形は実物の図形クラス、`isSelected`は`Set`による素の関数。
            新: 図形は実物の図形クラス（`hitTestHandle`が頂点でない名前を返すケースの1件だけ素のオブジェクト）、`isSelected`は`Set`による素の関数。
            ```
        *   No.40（InputTrackerの配線の列挙から外す）（`_doc/arch/16_test.md` 194行）：
            ```text
            旧: `#onLeftDragCancel`の戻し・`isScalingSelection`・`handleClick`の外枠の判定。
            新: `#onLeftDragCancel`の戻し・`handleClick`の外枠の判定。
            ```
        *   No.40（本文）（`_doc/arch/16_test.md` 194行）：
            ```text
            旧: `KeyboardShortcuts`の`#handleKeyDown`を通した修飾キー付きの`Esc`（`document`に依存。例外の判定の`findCancelableDragBinding`だけを確かめる）、
            新: `isScalingSelection`（今はテストが無い）、`KeyboardShortcuts`の`#handleKeyDown`を通した修飾キー付きの`Esc`（今はテストが無い。例外の判定の`findCancelableDragBinding`だけを確かめる）、
            ```
        *   No.41（InputTrackerの配線の列挙から外す）（`_doc/arch/16_test.md` 207行）：
            ```text
            旧: `getRotationDragView`・`isScalingSelection`・`handleClick`の動かさず離したとき。
            新: `getRotationDragView`・`handleClick`の動かさず離したとき。
            ```
        *   No.41（本文）（`_doc/arch/16_test.md` 207行）：
            ```text
            旧: `isScalingSelection()`が`CANCELABLE_DRAG_STATES`を使うこと（一覧の中身と`findCancelableDragBinding`への受け渡しだけ確かめる）、`KeyboardShortcuts`の`#handleKeyDown`を通した修飾キー付きの`Esc`、
            新: `isScalingSelection()`が`CANCELABLE_DRAG_STATES`を使うこと（今はテストが無い。一覧の中身と`findCancelableDragBinding`への受け渡しだけ確かめる）、`KeyboardShortcuts`の`#handleKeyDown`を通した修飾キー付きの`Esc`（今はテストが無い）、
            ```
        *   No.42（`_doc/arch/16_test.md` 236行）：
            ```text
            旧: 。他の編集操作と`main.js`の`performUndo`/`performRedo`は自動テストにしていない）。
            新: 。同じ組み合わせのUndo/Redoは`ShapeStyleEditor`・`ShapeOrderEditor`・`ClipboardController`・`PathCornerEditor`（区間の切り替えを含む）の各テストでも、Undoだけは`StyleEyedropper`・`TransformInputEditor`のテストでも確かめている。これら以外の編集操作と`main.js`の`performUndo`/`performRedo`は自動テストにしていない）。
            ```
        *   No.46（`_doc/arch/16_test.md` 34行）：
            ```text
            旧: 書き出し形式。現行は版3（Phase 09-01a）。
            新: 書き出し形式。現行は版4（Phase 10-02）。
            ```
        *   No.47（`_doc/arch/16_test.md` 228行）：
            ```text
            旧: 現在は版2で`MIGRATIONS`に版1→版2があり、
            新: 現在は版3で`MIGRATIONS`に版1→版2・版2→版3があり、
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [ ] タスク10: 要件10（前半） `_doc/arch/07`・`14`・`15`・`32`（No.5・No.7〜No.9・No.11・No.12・No.14）
    *   **対象ファイル** :
        *   `./_doc/arch/07_KeyboardShortcuts.md` :（更新。記述の修正）
        *   `./_doc/arch/32_InputModes.md` :（更新。記述の修正）
        *   `./_doc/arch/14_edit.md` :（更新。記述の修正）
        *   `./_doc/arch/15_io.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.8・No.9・No.11は原則3。No.7の実態：列挙の内容は`describe`（`findCancelableDragBinding`）の6件と、`isCancelableDrag`だけを欠く配線検証1件の計7件（`test/core/KeyboardShortcuts.test.js`のファイル全体は11件）。
        *   No.11：一覧を`InputModes`に置く決定は変えない。No.12：`InputModes`をimportするテストは13ファイル（4行・8行の2か所に今の`import`元を足す）。
        *   `07`・`32`はLF、`14`・`15`はCRLF。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.7（`_doc/arch/07_KeyboardShortcuts.md` 20行）：
            ```text
            旧: すべてで`cancel`のエントリが返る。計9件。
            新: すべてで`cancel`のエントリが返る。計7件（`findCancelableDragBinding`の6件と配線検証の1件）。
            ```
        *   No.9（`_doc/arch/07_KeyboardShortcuts.md` 20行）：
            ```text
            旧: `isScalingSelection()`が一覧を使うことそのものは`DragTracker`・DOMに依存して確かめられず、テストプレイで確かめる）
            新: `isScalingSelection()`が一覧を使うことそのものは今はテストが無く、テストプレイで確かめる）
            ```
        *   No.8（`_doc/arch/07_KeyboardShortcuts.md` 20行）：
            ```text
            旧: 修飾キー付きの`Esc`は`document`に依存してテストできず、テストプレイで確かめる（
            新: 修飾キー付きの`Esc`は今はテストが無く、テストプレイで確かめる（
            ```
        *   No.11（`_doc/arch/32_InputModes.md` 2行）：
            ```text
            旧: 一覧を値として`InputModes`に置く理由：判定の1か所が`DragTracker`・DOMに依存して`node --test`で確かめられないため、対象の状態の一覧だけをここに置いてテストで確かめられるようにする（
            新: 一覧を値として`InputModes`に置く理由：対象の状態の一覧だけをここに置いてテストで確かめられるようにする（
            ```
        *   No.11（末尾）（`_doc/arch/32_InputModes.md` 2行）：
            ```text
            旧: `isScalingSelection()`が一覧を使うことそのものは確かめられない）
            新: `isScalingSelection()`が一覧を使うことそのものは今はテストが無い）
            ```
        *   No.12（4行）（`_doc/arch/32_InputModes.md` 4行）：
            ```text
            旧: `test/edit/PositionInputEditor.test.js`（`OperationMode`）。
            新: `test/edit/PositionInputEditor.test.js`（`OperationMode`）・`test/core/RotationRules.test.js`・`test/core/ScaleHandleRules.test.js`・`test/edit/PathCornerEditor.test.js`・`test/edit/PathCornerEditor.segmentSwitch.test.js`・`test/edit/TransformInputEditor.test.js`（いずれも`OperationMode`）と、`test/core/InputModes.test.js`・`test/core/KeyboardShortcuts.test.js`（下の`CANCELABLE_DRAG_STATES`）。
            ```
        *   No.12（8行）（`_doc/arch/32_InputModes.md` 8行）：
            ```text
            旧: `test/edit/NudgeEditor.test.js`・`test/edit/PositionInputEditor.test.js`が値を使う）。
            新: `test/core/RotationRules.test.js`・`test/core/ScaleHandleRules.test.js`・`test/core/KeyboardShortcuts.test.js`・`test/edit/NudgeEditor.test.js`・`test/edit/PositionInputEditor.test.js`・`test/edit/PathCornerEditor.test.js`・`test/edit/PathCornerEditor.segmentSwitch.test.js`・`test/edit/TransformInputEditor.test.js`が値を使う）。
            ```
        *   No.14（`_doc/arch/14_edit.md` 28行）：
            ```text
            旧: `getSelectedBounds`が`null`のとき（図形が
            新: `getSelectedGeometryBounds`が`null`のとき（図形が
            ```
        *   No.5（`_doc/arch/15_io.md` 25行）：
            ```text
            旧: 版3への版上げはエンジンへ連絡済み（Phase 09-04。2章）。**版4はPhase 10-04で連絡する（本作業の時点で未連絡）**）。
            新: 版3・版4への版上げはどちらもエンジンへ連絡済み（Phase 09-04・Phase 10-04。2章））。
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [ ] タスク11: 要件10（後半） `_doc/arch/40`・`42`・`43`（No.19・No.20・No.23・No.45）
    *   **対象ファイル** :
        *   `./_doc/arch/40_asset_sprite.md` :（更新。記述の修正）
        *   `./_doc/arch/42_ScaleHandleRules.md` :（更新。記述の修正）
        *   `./_doc/arch/43_RotationRules.md` :（更新。記述の修正）
        *   本RESファイル :（更新。3章のチェック・4章の担当の欄。必要なら5章の末尾）
    *   **作業内容** :
        *   No.19・No.20は1章228行と食い違わないことを確かめる（`RotationRules.js:5`・`:211`・`:236`、`ScaleHandleRules.js:317`）。No.23は「引数を書き換えない」を残し、同じファイルの8行と食い違わないことを確かめる。No.45は生成物が版2のままである点を残す。
        *   3ファイルともLF。
        *   置き換え（2章「置き換えの手順」に従う）は次のとおり。
        *   No.45（`_doc/arch/40_asset_sprite.md` 2行）：
            ```text
            旧: **現行の書き出し形式はPhase 09-01aで版3になったが、生成物は版2のまま書き換えない**（`SpriteSerializer.checkFormat`は版1〜3を受理し、
            新: **現行の書き出し形式は版4（Phase 10-02）だが、生成物は版2のまま書き換えない**（`SpriteSerializer.checkFormat`は版1〜4を受理し、
            ```
        *   No.20（`_doc/arch/42_ScaleHandleRules.md` 6行）：
            ```text
            旧: `core/ → shapes/`の型参照はこの1か所だけの例外で、
            新: `core/ → shapes/`の型参照は本ファイルと`RotationRules`の2か所だけの例外で、
            ```
        *   No.19（`_doc/arch/42_ScaleHandleRules.md` 8行）：
            ```text
            旧: `hitTestScaleHandle`・`collectFrameCorners`・`computeFrameCenter`。Phase 10-02。
            新: `hitTestScaleHandle`・`collectFrameCorners`。Phase 10-02。
            ```
        *   No.23（`_doc/arch/43_RotationRules.md` 2行）：
            ```text
            旧: いずれも新しいオブジェクトを返し、引数を書き換えない。
            新: オブジェクトを返す関数は新しいオブジェクトを返し（`resolveDisplayedScaleFrame`は`rotationView`が`null`なら`frame`をそのまま返す）、いずれも引数を書き換えない。
            ```
        *   直した記述が同じ資料の別の箇所・別のファイルと矛盾しないかを確かめ、触ったファイルの行末をバイト数で確かめる。4章に、直した番号と前後の記述の要点、行末の実測値を書く。
*   [ ] タスク12: 要件11 確認と懸念事項の記述（固定タスク）
    *   **対象ファイル** :
        *   本RESファイル :（更新。資料・コードは変えない）
    *   **作業内容** :
        *   `node --check js/core/InputTracker.js` で構文を確かめる。
        *   プロジェクトのルートで `node --test` を実行し、全件成功（変更前は tests 2470 / suites 401 / fail 0。件数は変わらないはず）を確かめ、件数を4章に記す。
        *   本作業の開始時点のコミット`aef1085`との差分（`git diff aef1085 -- js index.html`。読み取りだけ）で、変更がC1（`index.html`のコメント2行）とC2（`InputTracker.js`のJSDoc3行）だけであることを確かめる。同じく`git diff --stat aef1085`で、変更したファイルがREQの要件の対象15ファイルと本RESだけであることを確かめる。
        *   触った15ファイルの行末を、2章の表と比べてバイト数で確かめる（CRLFのファイルはCRLFの数＝LFの総数、LFのファイルはCRLF 0）。
        *   No.1〜No.47（No.43を除く）・A1〜A5・C1・C2を番号順に並べ、処理したタスクと結果を4章に記す。直せなかったもの・直さないと判断したものは、番号と理由を書く。
        *   No.43の箇所・`PROJECT_ARCHITECTURE.md`の265行(c)（版3・版4は連絡済みの文）が変わっていないことを確かめる。
        *   5章（懸念事項・今後の修正における注意点）へ、判断に迷った点、資料の別の箇所との整合で気づいた点を追記する。

## 4. 詳細作業内容
※ 「3. タスクリスト」と同数の見出しを立て、タスク実行時にそれぞれ記入する。

### タスク1: 要件1 `PROJECT_ARCHITECTURE.md` 1章（No.1〜No.4）
*   **作業内容** :
    *   No.1（29行）：`InputModes`の使う側に`ScaleHandleRules`を追記。実コードの照合：`InputModes`のimport元は`js/`の9ファイル（`ScaleHandleRules.js:5`を含む）で一致。
    *   No.2（42行）：`NudgeTargetRules`の使う側に`edit/PathCornerEditor`を追記。import元は`PathCornerEditor.js:6`を含む4ファイルで一致。
    *   No.3（218行）：10-02・10-03の列挙末尾から「エンジンでの版4の確認と連絡票（Phase 10-04）」の2か所を削除。No.4（218行）：「エンジンでの版3の確認と連絡票（Phase 09-04）」を削除。行内のほかの項目・265行(c)は未変更。
    *   旧の文字列はすべて1回だけ現れ、置き換えた（`python`の`rb`／`wb`）。No.2の旧は、RES記載どおりだと一意だったが、短縮形では2回現れるため全文で置き換えた。
    *   行末の実測：`PROJECT_ARCHITECTURE.md` 398982→398838バイト、CRLF／LF 825／825→825／825（変化なし）。`git diff --stat`は3行の変更のみ。

### タスク2: 要件2 `PROJECT_ARCHITECTURE.md` 3章3.・17.（No.6・No.10・No.44）
*   **作業内容** :
    *   No.6（367行）：「`Shift`が効くのは」を「`Shift`が移動方向を限定するのは」に直し、拡大縮小のドラッグは比率を保ち回転のドラッグは15°刻みにすることを括弧内に加えた（25.・26.を参照）。直線・曲線のツールの例外は変えていない。
    *   No.10（594行）：「Phase 07-05の指示書の時点の制約。今は`wiring/`へ切り出したものがある。1章」を書き添えた。No.44（594行）：「17番目」を「16番目」に直した。
    *   旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測：`PROJECT_ARCHITECTURE.md` 398838→399076バイト、CRLF／LF 825／825→825／825（変化なし）。`git diff --stat`は2行の変更（367行・594行）のみ。

### タスク3: 要件3 `PROJECT_ARCHITECTURE.md` 3章18. を1つの構成にまとめる（No.13・A2の615行）
*   **作業内容** :
    *   見出し（598行）を「Phase 08-02a＝前半／08-02b＝後半」の対応に書き直し、608行（範囲選択中のカーソル）・609行（08-02bで`main.js`等は未変更）・612行（時点付きの版・08-02bでも変えない事項）・614行（決定(2)の整理、(4)へ`Backspace`、(9)〜(14)の08-02bの決定を追記）・615行（A2：参照の言い方をやめ、08-02b分の「やらないこと」を同じ項へ統合）・617行（08-02aの確認項目・08-02bも全項目OK・tests 1411）を対応表のとおり置き換え、618〜622行の5項を削除した。落とした内容（複数選択の入口・まとめ移動・`Ctrl`クリック・前半の訂正）は602〜605・612・決定(9)〜(14)・2章336行にあることを確認。章末の空行は残した。
    *   置き換えの旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測：`PROJECT_ARCHITECTURE.md` 399076→397864バイト、CRLF／LF 825／825→820／820（計画どおり）。`git diff --stat`は7挿入・12削除。
*   **対応表の実施結果**（まとめる前の項は開始時点の行番号。まとめた後の置き場所は、`git diff HEAD -- PROJECT_ARCHITECTURE.md`と現在の資料で確かめた今の行番号。落とした各文の内容が置き場所にあることを1件ずつ確かめた。理由(a)＝2か所の重複、(b)＝反映済みの「訂正」の履歴、(c)＝後で変わって今は成り立たない文）：

    | まとめる前の項（開始時点の行） | まとめた後の置き場所（今の行） | 落としたもの・理由 |
    | --- | --- | --- |
    | 見出し（598） | 598。括弧の中を「Phase 08-02a＝前半」「Phase 08-02b＝後半」の対応に書き直した | なし（番号・題は変えない） |
    | ツール・操作モードの一覧（599） | 599（そのまま） | なし |
    | 選択（`V`）の変更（600） | 600（そのまま） | なし |
    | 頂点の選択モードの操作（601）・クリック（602）・押下（603）・まとめ移動（604）・範囲選択（605）・`Esc`（606）・`Delete`（607） | 601〜607（そのまま） | なし |
    | ホバー・カーソル（608） | 608。「範囲選択中は既存の構造により矢印のまま」を加えた | なし |
    | モジュールの分担（609） | 609。末尾に「Phase 08-02bでは`js/main.js`・`CanvasManager`・`CursorShapeRules`を変更していない（…後に外枠のハンドル等で変わった。25.・26.）」を加えた | なし |
    | 頂点のハンドルの表示（610）・使われないハンドルの処理の整理（611） | 610・611（そのまま） | なし |
    | 履歴・保存（612） | 612。「Phase 08-02a・08-02bでは…を変更せず、…版も当時の2のまま変えていない。今の版は2章」と時点を付け、「頂点の選択の状態の形・不変条件・保存しないこと・選択（`V`）のふるまいはPhase 08-02bでも変えていない」をここへ移した | 時点の無い「版は作業データ・書き出し形式とも2のまま」＝(c)（時点付きで612に残した） |
    | ツールのアイコン（613） | 613（そのまま） | なし |
    | 発注者の決定・08-02a（614） | 614の(1)〜(8)。番号は変えない | (2)の「前半では何も始めないとしたが」＝(c)。(2)末尾の「図形は動かない」＝(a)（同じ文の中の重複。603④に「図形は動かない」がある）。「Phase 08-02bから範囲選択が始まる」は残した |
    | やらないこと・08-02a（615） | 615の前半（「頂点の追加・削除、矢印キーの微調整、ツールごとのカーソルの形、他のアイコンの差し替え、アイコンの`devicePixelRatio`の変化での描き直し」。08-03・08-04の付記も残した）。列挙の項目は変えていない | 「1章「存在しないもの」のPhase 08-02aの分のとおり」＝A2（指す括りが無い） |
    | 注意（616） | 616（そのまま） | なし |
    | テストプレイの結果・08-02a（617） | 617。08-02aの確認項目と結果をそのまま残した | なし |
    | Phase 08-02bの要点（618）：複数選択の入口（`Ctrl`＋クリック・範囲選択・選んでいる頂点のドラッグ） | 602（クリック）・603（押下①）・605（範囲選択） | (a)。3つの入口とも各項に書いてあることを確かめた |
    | 同：まとめ移動は`updateVertices`で通知1回・取り消し1件／吸い付きは1つだけのとき | 604（通知1回・取り消し1件・吸い付きは1つだけのとき）・609（`updateVertices`は通知1回）・614の(11) | (a)。3か所にあることを確かめた |
    | 同：`A`のまま`Ctrl`＋クリックで図形の追加・解除（頂点の選択は空にならない） | 602（「図形の選択へ追加・解除。**頂点の選択は空にしない**」）・614の(12) | (a) |
    | 同：状態の形・不変条件・保存しないこと・履歴の対象外・版・選択（`V`）のふるまいは変えていない | 612（「頂点の選択の状態の形・不変条件・保存しないこと・選択（`V`）のふるまいはPhase 08-02bでも変えていない」「履歴・作業データ・書き出しの対象外」「当時の2」）。状態の形・不変条件の正本は2章336行 | 履歴の対象外＝(a)（612に元からある）。版の「どちらも2」の時点の無い書き方＝(c)（612の時点付きの記述へ） |
    | 同：`js/main.js`・`CanvasManager`・`CursorShapeRules`は変更していない／範囲選択中のカーソル | 609（変更していない）・608（範囲選択中のカーソル） | なし（時点を付けて残した） |
    | 発注者の決定・08-02b（619）の(1)〜(5) | 614の(9)〜(13) | なし |
    | 同(6)（前半の決定はそのまま） | `Esc`の2段＝614の(14)、`Delete`・`Backspace`＝614の(4)に`Backspace`を足した | 円・弧＝(3)との重複(a) |
    | やらないこと・08-02b（620） | 615の後半。「頂点の複数選択・まとめ移動では、頂点のドラッグでの`Shift`による方向の限定、2つ以上の頂点を選んでいるときの端点への吸い付き、範囲選択で図形そのもの・頂点が出ていない図形の頂点を選ぶこと。（Phase 08-04で「位置の数値入力」は入った。20.）」。列挙で書いたのは08-02bに固有の3つだけ（1章218行には08-02b由来の項目としてほかに「パスの分割」「パスを開く／閉じる」もあり、それは1章に残る） | 「1章…Phase 08-02bの分のとおり」＝指す括りが無い（A2と同じ）。「矢印キーでの微調整」の付記＝(a)（615の分と同じ） |
    | 前半の記述の訂正（621） | なし | (b)。「どちらからでも範囲選択が始まる」＝603④・605・614の(2)(9)、「クリックは`Ctrl`を見る」＝602、「2つ以上の組が入る」＝602・605と2章336行に反映済みであることを確かめた |
    | テストプレイの結果・08-02b（622） | 617の末尾（「Phase 08-02bも全項目OK。…（Phase 08-02bの完了時はtests 1411）」） | 日付・`16_test.md`の参照＝(a)（617にある） |

### タスク4: 要件4 `PROJECT_ARCHITECTURE.md` 3章25.・26.・27.（No.15〜No.18・No.21・No.22・No.24）
*   **作業内容** :
    *   No.15・16（25.の「確認の状況」。731行）：合格の記述に確認項目の置き場所と2026-11-22の合格を添え、`#handleKeyDown`を通した`Esc`は「今はテストが無い」にした。「特に、…目視で確かめる。」の文は未変更。
    *   No.16（25.の「発注者の決定」。727行）：「`document`に依存してテストできないため」を「…`Esc`は今はテストが無い」へ。No.17（25.の「`Esc`・確定・中断」。725行）：「拡大縮小・回転のドラッグだけ」（タスク7のNo.30と同じ書き方）。No.18（25.の「流れ（入力）」。721行）：「`hit.handle`の前」を「選択の変更の前」へ。
    *   No.21（26.の「発注者の決定」。745行）：理由「`DragTracker`・DOMに依存して…確かめられないため」を「今はテストが無い」に。`CANCELABLE_DRAG_STATES`の決定・テストの事実は未変更（`InputModes.js:32`・`InputTracker.js:239`・613・673行で`isScalingSelection()`と一覧の存在を確認）。
    *   No.22（26.の「確認の状況」。748行）：配線の列挙から`isScalingSelection`を外し、本文に「`isScalingSelection`・`#handleKeyDown`を通した修飾キー付きの`Esc`は今はテストが無い」を追加。No.24（27.の「ふるまいの注意」。765行）：(d)を計画の新の文に。
    *   旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた（行番号は要件3で5行減っており、計画の番号から−5）。行末の実測：`PROJECT_ARCHITECTURE.md` 397864→398050バイト、CRLF／LF 820／820→820／820（変化なし）。`git diff --stat`は7行の変更のみ。

### タスク5: 要件5 `PROJECT_ARCHITECTURE.md` の追加（A1〜A4）
*   **作業内容** :
    *   A1（652行）：「線を含む外枠」の正本が`SpriteSerializer.computeShapesBounds`であることを明示し、線を含まない外枠（`ShapeExtentReader.getSelectedGeometryBounds`）は27.を参照する書き方にした。「2通りにしない」の約束は残した。実コード照合：両メソッドが`SpriteSerializer.js:315`・`ShapeExtentReader.js:47`に存在。
    *   A2（629・644・661・716行。タスク3で5行減ったため計画の番号から−5）：「1章「存在しないもの」のPhase 08-03／08-04／08-05／09-02bの分のとおり（」を外し、各列挙末尾の閉じ括弧を外した。列挙の項目は変えていない。
    *   A3（246・248・250行）：「Phase 09-03aの時点」「Phase 09-02aの時点」「その時点（Phase 09-01a・09-03a）」と時点を書き添え、今の版は3と付記。A4（767行）：「Phase 10-03の完了時は」を件数の前に追加（件数は不変）。
    *   旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測：`PROJECT_ARCHITECTURE.md` 398050→398031バイト、CRLF／LF 820／820→820／820（変化なし）。`git diff --stat`は9行の変更のみ。

### タスク6: 要件6 `_doc/arch/01_index_html.md`・`02_main.md`・`index.html`（No.25〜No.29・A5・C1）
*   **作業内容** :
    *   No.25（01の12行）：`y 108〜約450`を`y 108〜486`へ。No.26・27（15行）：まとまりを7つにし大きさ・変形の2グループ（Phase 10-03）を追記、`user-select: text`の欄を太さ・位置・幅・高さ・角度へ。照合：`index.html`の`.toolbar-group`は`#option-style-group`〜`#option-corner-group`ほか、`user-select: text`のセレクタは`#option-stroke-width`・`position-x/y`・`size-width/height`・`angle`の6欄（436〜446行）で一致。No.28（15行・17行）：CSSコメント名を「ツールバーの各行の幅の見積もり」へ（`index.html:487`で一致）。
    *   No.29（02の4行）：`resetViewToCenter`を追記（`js/main.js:306`に存在）。A5（02の3行）：切り出しの例外を`wiring/DisplayWiring`・`wiring/ToolIconWiring`の2つとした（`js/wiring/`の2ファイルと一致。同じ行のPhase 10-03・10-02時点の「切り出しはしていない」は未変更）。
    *   C1（`index.html`の236・237行のコメント）：x 28〜74、y 108〜486、見出し39px＋本体337px＋枠2pxへ。宣言は未変更。
    *   旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測（バイト数、CRLF／LF）：01 33974→34069、20／20→20／20。02 41346→41461、84／84→84／84。`index.html` 42208→42199、CRLF／LF 0／689→0／689（`rb`で数え直した値。変化なし）。`git diff --stat`は3ファイル計7行の変更のみ。

### タスク7: 要件7 `_doc/arch/06_InputTracker.md`・`js/core/InputTracker.js`（No.30〜No.32・C2）
*   **作業内容** :
    *   No.30（06の33行）：「拡大縮小だけ」を「拡大縮小・回転だけ」へ（`InputTracker.js`の`#onLeftDragCancel`が`ROTATING_SELECTION`で`#restoreOriginals`を呼ぶことと一致）。No.31（31行）：`#updateCursor(hit, scaleHandle, rotationCorner)`へ（第3引数はPhase 10-02。`InputTracker.js`の定義と一致）。No.32（43行）：回転のドラッグの追従イベント（15°刻み・Phase 10-02・3章26.）を追記（`snapToStep: Boolean(event.shiftKey)`を確認）。
    *   C2：`InputTracker.js`のJSDoc 3か所（451行・476行・483行）に`ROTATING_SELECTION`を追記。コードは未変更。
    *   旧の文字列は計画どおりの回数だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測（バイト数、CRLF／LF）：06 53944→54096、57／57→57／57。`InputTracker.js` 142447→142506、2020／2020→2020／2020。`git diff --stat`は2ファイル計6行の変更のみ。

### タスク8: 要件8 `_doc/arch/12_shapes.md`（No.33〜No.37）
*   **作業内容** :
    *   No.33（42行）：`getHandlePosition`の呼び出し元を、`VertexHandleRules.js`（26・68行の`getHandlePosition`）と`NudgeEditor.js`（143行）を読んで`core/VertexHandleRules`・`edit/NudgeEditor`まで広げた。No.34（44行）：`TransformInputEditor`の`#apply`が`createTransformed`を呼び、`setSize`・`rotateBy`・`flip`から使われることを確かめ、`edit/TransformInputEditor`（幅・高さ・角度の欄と反転。Phase 10-03）を足した。Survey 5章の契機は「位置・大きさ・角度の欄・反転」だが、位置の欄は`NudgeEditor`の平行移動で`TransformInputEditor`の受け持ちではない。この食い違いは現場設計セッションへ報告済みで、「位置」を除いて書いてよいと確認されている。No.35（43行）：`PathCornerEditor.js`の`getVertexHandleNames`を呼ぶ箇所（152行付近の頂点の選択の付け替え）を確かめ、使う側に`edit/PathCornerEditor`を足した。
    *   No.36（72行）：「90°回した弧も」を「横の半径が縦より小さい弧を90°回した形も」へ。No.37（79行の2か所）：頂点3つの括弧を「始点・頂上・終点」へ、始点・終点の位置に「今の約束の位置では」と、回した・左右に裏返した弧は点のとおりである旨を足した。同じファイルの8行（`lineEndpointOf`の「今の約束の位置では左端・右端」）・13行（`arcChainSourceOf`の「今の約束の位置では左端…」）と食い違わないことを確かめた。
    *   旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測（バイト数、CRLF／LF）：12_shapes 64464→64915、91／91→91／91。`git diff --stat`は1ファイル5行の変更のみ。

### タスク9: 要件9 `_doc/arch/16_test.md`（No.38〜No.42・No.46・No.47）
*   **作業内容** :
    *   No.38（188行）：`VectorModel.replaceShapesKeepingIds.test.js`が`console.warn`を一時的に差し替え`finally`で戻す補助を持つことを確かめ、「`t.mock.method`で抑止」を計画の新の文へ。No.39（19行）：`PointHitRules.test.js`の`hitTestHandle: () => 'bogus'`の偽の図形1件を確かめ、例外の旨を追記。
    *   No.40（194行）・No.41（207行）：配線の列挙から`isScalingSelection`を外し、本文に「今はテストが無い」を追加（`Esc`の`document`依存の理由は外した）。見出し「テストできない箇所」・236行の「（Node.js v24.20.0で確認）」（No.43）・件数の記載は未変更。
    *   No.42（236行）：`HistoryManager`を使う`test/edit/`のテスト（`ClipboardController`・`PathCornerEditor`・`PathCornerEditor.segmentSwitch`・`ShapeOrderEditor`・`ShapeStyleEditor`・`StyleEyedropper`・`TransformInputEditor`）の存在を確かめ、計画の新の文へ。No.46（34行）：`SpriteSerializer.js:19`の`SPRITE_FORMAT_VERSION = 4`と一致。No.47（228行）：`DocumentSerializer.js`の`CURRENT_DOCUMENT_VERSION = 3`・`MIGRATIONS`が1→2・2→3と一致。
    *   旧の文字列はすべて1回だけ現れ、`python`の`rb`／`wb`で置き換えた。行末の実測（バイト数、CRLF／LF）：16_test 131429→131945、237／237→237／237（変化なし）。`git diff --stat`は1ファイル7行の変更のみ。

### タスク10: 要件10（前半） `_doc/arch/07`・`14`・`15`・`32`（No.5・No.7〜No.9・No.11・No.12・No.14）
*   **作業内容** :
    *   （未実施）

### タスク11: 要件10（後半） `_doc/arch/40`・`42`・`43`（No.19・No.20・No.23・No.45）
*   **作業内容** :
    *   （未実施）

### タスク12: 要件11 確認と懸念事項の記述（固定タスク）
*   **作業内容** :
    *   （未実施）

## 5. 懸念事項・要確認ポイント
（懸念事項・今後の修正における注意点。計画時に気づいたもの。各タスクで気づいた点は末尾に追記する）

* **計画時に読んだ範囲**：`PROJECT_ARCHITECTURE.md`は、冒頭の記載基準・1章の該当行・2章の240〜268行・3章の2.〜4.・17.（該当行）・18.・21.（655行以降）・25.〜27.と、検索で当たる行を読んだ（全文の通読はしていない）。Survey 6章は、A2の対象を確かめるために「存在しないもの」「分のとおり」を含む行だけを検索して読んだ（REQでは「読まなくてよい」の範囲）。
* **A2と同じ形で、今回は直さない行**：1章「存在しないもの」に括りが無い参照は、557行（07-03）・570行（07-04。括弧の列挙なし）・597行（07-05）・692行（連続引き）・706行（09-02a。721行と同じく付記の語だけある）にもある。REQのA2が挙げた行（615・634・649・666・721行。Survey 6章も同じ5行）に含まれないため触れない。620行（08-02b）は要件3の章の中で、構成の統合として同じ扱いにする。
* **No.6と同じ種類の記述が1章218行に残る**：「頂点のハンドルのドラッグでの`Shift`の限定（`Shift`が効くのは本体の移動と、直線・曲線のツールで線を引いている途中の付いてくる線の先だけ。…）」。要件1の「この行の、ほかの項目は変えない」により触れない。
* **A2の列挙の項目**：18.・20.・21.の「頂点の追加・削除」は、Phase 09-02bの「曲線に」で足す点と取り違える余地がある（1章218行は「「曲線に」で足す点以外の頂点の追加」と書く）。「列挙の項目は変えない」により変えない。
* **A3の周辺**：246・248・250行の「古いエディタではその図形だけがスキップされる」は各Phaseの時点の記述で、今の版3の作業データは版2までのエディタでは全体が断られる（264行）。時点を書き添えるだけにする。時点の無い「版は2のまま」は318・559・572・624・636・652行と`12_shapes.md`88行・`15_io.md`9行にもあるが、対象外。
* **No.15**：合格の記述に、26.・27.とそろえて確認項目の置き場所（`_log/res/261122_1050_RES_Phase10-01_Scale_Handles.md`の4章タスク13）を添える。続く「特に、…目視で確かめる。」の文は確かめる範囲の説明として残す。
* **No.21**：決定の理由として挙がっていた「確かめられないため」を外すと、決定の括弧は「今はテストが無い」と「一覧の中身と受け渡しで確かめる」だけになる。決定・テストの事実は変えていない。
* **No.40・No.41**：見出し「テストできない箇所」の中に「今はテストが無い」項目が並ぶ形になるが、見出しは変えない。
* **No.34**：Survey 5章の契機の書き方（「位置・大きさ・角度の欄・反転の入力」）のうち「位置」は`TransformInputEditor`の受け持ちではない。資料へは幅・高さ・角度・反転と書く（「のみ」の断定が誤りである点はSurveyのとおり）。
* **C1の近く**：`index.html`のツールのまとまりのCSSコメント「「選択・キャンバス移動・スポイト」と「図形」の2つ」に頂点の選択が無い。対象外のため触れない。
* **目視確認**：不要（画面のふるまいは変わらない）。
