# 作業指示書 REQ: Interrupt : エディタのWEBアイコン（OZ Engine から移植）
* ルール: `./PROJECT_CONSTITUTION.md`

## 【作業手順（厳守事項）】
本プロンプトは、エディタのページにWEBアイコン（ブラウザのタブなどに出る画像）を付ける Interrupt である。画像は OZ Engine の土台にあるものを、作り直さず中身を変えずにそのままコピーする。必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. 本REQの【関連する責務】を把握すること。作業に必要な責務情報はすべてここに記載されている。開発資料（`PROJECT_ARCHITECTURE.md`）は、記載外の責務を確認する必要が生じた場合にのみ参照すること。
3. 実装対象のファイルを読み、【関連する責務】に**記述されている内容と実際のファイルが矛盾する**場合は、修正に着手せず、相違点を報告して指示を待つこと。記述にない事項の存在は相違とみなさない。
4. 相違がなければ、【実装要件】に従って作業を開始すること。
5. 作業が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポート（`./_log/res/261126_1200_RES_Interrupt_Web_Icon.md`）を新規作成して出力すること。RES冒頭の「参照元REQ」には本ファイル（`./_log/req/261126_1200_REQ_Interrupt_Web_Icon.md`）を記載すること。
   * テンプレートの項目に従い、「原因と修正方針」「対象ファイル」「詳細作業内容」を正確に記述すること。
   * 「詳細作業内容」に、4つの PNG をコピーした手順と、コピー元とコピー先の中身が同じことを確かめた結果（4つそれぞれのバイト数と SHA-256 の値。コピー元・コピー先の両方）を書くこと。
6. 開発資料（`PROJECT_ARCHITECTURE.md`）の内容に影響がある場合は、資料本体は修正せず、その旨を作業レポートの『開発資料の更新予定』欄に明記すること（要件4）。
7. すべての作業が完了したら、チャットにて「実装が完了しました。ビルド・動作確認をお願いします」と報告すること。

## 【実装要件】
コピー元は OZ Engine のリポジトリ（`D:\ozlab\ozengine-web`）である。**読むだけで、変更しない。**

*   **要件1: 4つの PNG を `asset/icon/` にコピーする**
    *  フォルダ `asset/icon/` を新しく作り、`D:\ozlab\ozengine-web\assets\icon\` の次の4つの PNG を、**同じファイル名のまま、中身を変えずに**コピーする（コピー元のフォルダは `assets`（複数形）、コピー先はエディタの `asset`（単数形）である点に注意）。

        | ファイル名 | 大きさ | コピー元のバイト数 |
        | --- | --- | --- |
        | `favicon-32.png` | 32 × 32 px | 1093 |
        | `apple-touch-icon-180.png` | 180 × 180 px | 2485 |
        | `icon-192.png` | 192 × 192 px | 2499 |
        | `icon-512.png` | 512 × 512 px | 4498 |

    *  中身は白い「OZ」のロゴで、背景は透明（RGBA）。**画像を開いて保存し直す・縮小や拡大をする・最適化の道具にかけるなど、中身が変わる操作はしない。** ファイルのコピー（`cp` など）だけで行う。
    *  コピーの後、4つそれぞれについて、コピー元とコピー先のバイト数と SHA-256 の値が一致することを確かめる（例 `sha256sum`）。一致しなければ作業を止めて報告する。
    *  `asset/icon/` には、この4つ以外のファイル（説明のテキスト・`.gitkeep` など）を置かない。

*   **要件2: `index.html` にアイコンの指定を足す**
    *  `<head>` の中の `<title>OZ Vector Editor</title>` の行の直後に、次の4行をこの順・この書き方で足す（OZ Engine の `index.html` と同じ4行で、パスだけをエディタの置き場所 `./asset/icon/` に合わせたもの）。字下げは `index.html` の `<head>` の中の既存の行に合わせて空白4つとする。

        ```html
            <link rel="icon" type="image/png" sizes="32x32" href="./asset/icon/favicon-32.png">
            <link rel="icon" type="image/png" sizes="192x192" href="./asset/icon/icon-192.png">
            <link rel="icon" type="image/png" sizes="512x512" href="./asset/icon/icon-512.png">
            <link rel="apple-touch-icon" sizes="180x180" href="./asset/icon/apple-touch-icon-180.png">
        ```

    *  `index.html` のそのほか（`<title>`・`<meta>`・`<style>`・本文のマークアップ・スクリプトの読み込み）は変えない。
    *  `index.html` の先頭には責務の文（HTMLのコメント）は無い（憲法の責務の文の義務は `.js` のファイルが対象）。今回も責務の文を新しく足さない。

*   **要件3: `sprite-check.html` にも同じ指定を足す**
    *  `<head>` の中の `<title>スプライトの確認 - OZ Vector Editor</title>` の行の直後に、要件2と同じ4行（同じ順・同じパス・字下げは空白4つ）を足す。
    *  `sprite-check.html` のそのほかは変えない。先頭に責務の文は無く、今回も足さない。

*   **要件4: 開発資料の更新予定（作業レポートに書くだけ。`PROJECT_ARCHITECTURE.md` は変更しない）**
    作業レポートの『開発資料の更新予定』欄に、次の1点だけを書く（発注者の決定、2026-11-26：開発資料には構成図の1行だけを足し、`_doc/arch/01_index_html.md`・`_doc/arch/17_sprite_check.md` などHTMLの説明には書き足さない）。
    *  `PROJECT_ARCHITECTURE.md` 1章のフォルダの構成図で、`asset/` の下の `sprite/` の行の前に、`icon/` の行を足す（`sprite/` の行の枝の記号は `└──` のまま、`icon/` は `├──`）。行の説明の例：`# WEBアイコン（ブラウザのタブなどに出る画像。favicon-32.png・apple-touch-icon-180.png・icon-192.png・icon-512.png）。OZ Engine の土台の assets/icon/ の4つのPNGを中身を変えずにコピーしたもの。index.html・sprite-check.html の<link>だけが使う。JSからはimportしない`

*   **自動テスト**：リポジトリのルートで `node --test` を実行し、`fail 0` であることを確かめる（今回の作業はJSを変えないので件数は変わらない見込み。テストは足さない・変えない）。

*   **要件5: ふるまいの確認（テストプレイの確認項目）**
    実装の最後に、発注者が画面で確かめられる確認項目を提示すること（画面・操作・挙動の言葉で書くこと）。少なくとも次を含める。
    0. **準備**：リポジトリのルートで静的サーバを立て（例 `python -m http.server 8000`）、`index.html` と `sprite-check.html` をそれぞれ別のタブで開く。アイコンが前のまま変わらなければ、`Ctrl`+`F5`（強制再読み込み）かシークレットウィンドウで開き直す。
    1. **エディタのタブ**：`index.html` のタブに白い「OZ」のロゴのアイコンが出る。
    2. **確認用ページのタブ**：`sprite-check.html` のタブにも同じアイコンが出る。
    3. **明るい色のタブでの見え方**：明るい色のタブでは白いロゴがほとんど見えない（承知のうえ。見え方を記録に残すだけで、直さない）。
    4. **読み込みのエラーがないこと**：開発者ツールのコンソールに、アイコンの読み込みのエラー（404）が出ていない。
    5. **残りの3つの画像**：`http://localhost:8000/asset/icon/icon-512.png` などをアドレスで直接開くと、白いロゴの画像が出る（4つとも開けること）。
    6. **ほかは変わらないこと**：エディタ・確認用ページのそのほかの見た目と操作は前と変わらない。

### 今回やらないこと
*   画像の作り直し・背景の追加・エディタ専用のロゴの用意。白いロゴは明るい色のタブでほとんど見えないが、OZ Engine 側と同じく発注者は承知している。
*   `manifest.json`（Web App Manifest）・`favicon.ico`・`theme-color` など、上の4つ以外のアイコンの仕組みの追加。
*   `asset/sprite/` の変更、JS（`js/` の下）・テスト（`test/` の下）の変更。
*   `_doc/arch/` の下の資料の変更、および `PROJECT_ARCHITECTURE.md` 本体の変更（要件4は作業レポートに書くだけ）。
*   OZ Engine のリポジトリ（`D:\ozlab\ozengine-web`）の変更。

## 【関連する責務】
* `index.html` : エディタのページ。スタイルはCSSファイルに分けず `<style>` に内包する。`<head>` は `<meta charset>`・`<meta name="viewport">`・`<title>OZ Vector Editor</title>`・`<style>` の順。ファイルの先頭は `<!DOCTYPE html>` で、責務の文のコメントは無い（本作業でアイコンの指定を加える）。
* `sprite-check.html` : 確認用ページ（書き出したスプライトJSを、エディタ側だけで読み込んで描いて確かめるページ）。`index.html` とは別に開く。スタイルは `<style>` に内包する。`<head>` は `<meta charset>`・`<meta name="viewport">`・`<title>スプライトの確認 - OZ Vector Editor</title>`・`<style>` の順。先頭に責務の文のコメントは無い（本作業でアイコンの指定を加える）。
* `asset/` : エディタの素材のフォルダ（単数形）。今は `asset/sprite/` だけがあり、ツールのアイコンの仮のスプライトJS（`select-arrow.js`・`vertex-arrow.js`。本アプリの書き出しが作った生成物で、手で書き換えない）を置く。`asset/sprite/` を使うのは `js/wiring/ToolIconWiring.js` だけ。本作業で足す `asset/icon/` はHTMLの `<link>` だけが参照し、JSからは参照しない（`asset/sprite/` の決まりとは独立）。

## 【絶対遵守ルール (Constraints)】
* **中身を変えないコピー** : 4つの PNG はファイルのコピーだけで置く。画像を加工・再保存する道具（Pillow・画像編集ソフト・PNGの最適化の道具など）は使わない。
* **OZ Engine のリポジトリは読むだけ** : `D:\ozlab\ozengine-web` の下のファイルを変更・移動・削除しない。
* **スコープ** : 変更してよいのは、新しく作る `asset/icon/` の4つの PNG、`index.html`・`sprite-check.html` の `<title>` の直後への4行の追加、作業レポートの新規作成だけ。
