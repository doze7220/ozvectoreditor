# 作業指示書 REQ: Interrupt : 開発資料4章のモジュール別ファイル分割
* ルール: `./PROJECT_CONSTITUTION.md`

## 【作業手順（厳守事項）】
本プロンプトは開発資料（`PROJECT_ARCHITECTURE.md`）の4章「各モジュールの責務リファレンス」をモジュール別ファイルへ機械的に分割するInterruptである。ソースコード（`index.html`・`js/`）は一切変更しない。必ず以下の順序で作業を行うこと。

1. ルール（`PROJECT_CONSTITUTION.md`）を熟読・把握すること。
2. `PROJECT_ARCHITECTURE.md` の135行目以降（4章）の構造を確認し、【実装要件】の「分割単位」と一致するか確かめること。一致しない（トップレベルの箇条の数・名前・順序が異なる）場合は、分割に着手せず、相違点を報告して指示を待つこと。
3. 一致すれば、【実装要件】に従って分割を行うこと。本文の切り出しは手作業のコピーではなく、スクリプト（例：Node.js または PowerShell。スクリプト自体は `./_log/` 配下にもリポジトリにも保存しない）で行い、【検証】の確認を機械的に行うこと。
4. 作業が完了したら、Interrupt作業レポートテンプレート（`./_log/TEMPLATE_RES_Interrupt.md`）を元に、作業レポート（`./_log/res/YYMMDD_HHMM_RES_Interrupt_Architecture_Split.md`）を新規作成して出力すること。『詳細作業内容』には、使用したスクリプトの処理概要と【検証】の結果（一致した旨と、比較したバイト数）を記すこと。
5. すべての作業が完了したら、チャットにて「作業が完了しました」と報告すること。

## 【実装要件】
### 分割単位と分割先
4章のトップレベルの箇条（行頭が `*   **` で始まる行）ごとに1ファイルとする。各箇条は、その行から次のトップレベル箇条の直前の行まで（最後の箇条はファイル末尾まで）を範囲とする。分割先は新規フォルダ `_doc/arch/` とし、ファイル名は次の表のとおりとする（表の順序が4章での登場順）。

| 箇条 | 分割先ファイル |
| --- | --- |
| `index.html` | `_doc/arch/01_index_html.md` |
| `main.js` | `_doc/arch/02_main.md` |
| `VectorModel.js` | `_doc/arch/03_VectorModel.md` |
| `CanvasManager.js` | `_doc/arch/04_CanvasManager.md` |
| `ViewTransform.js` | `_doc/arch/05_ViewTransform.md` |
| `InputTracker.js` | `_doc/arch/06_InputTracker.md` |
| `KeyboardShortcuts.js` | `_doc/arch/07_KeyboardShortcuts.md` |
| `HistoryManager.js` | `_doc/arch/08_HistoryManager.md` |
| `DragTracker.js` | `_doc/arch/09_DragTracker.md` |
| `ShapeFactory.js` | `_doc/arch/10_ShapeFactory.md` |
| `WindowManager.js` | `_doc/arch/11_WindowManager.md` |
| `shapes/` | `_doc/arch/12_shapes.md` |
| `palette/` | `_doc/arch/13_palette.md` |
| `edit/` | `_doc/arch/14_edit.md` |
| `io/` | `_doc/arch/15_io.md` |

### 分割後ファイルの中身
* 各ファイルの中身は、該当範囲の行を**1バイトも変えずに**そのまま置いたものとする（見出し・注記・空行などを追加しない。文字コードUTF-8・BOMなし・改行LFは元ファイルのまま）。

### 索引として残す `PROJECT_ARCHITECTURE.md`
* 1行目から137行目（1〜3章、4章見出し `### 4. 各モジュールの責務リファレンス`、その次の `※ 実装が進むごとに…` の注記行、その後の空行）は1バイトも変えない。
* 138行目以降（各モジュールの箇条すべて）を削除し、代わりに次の内容を置く（`〜` 部分は上の表の15行をそのまま並べる）。ファイル末尾は改行1つで終える。

```
**4章の本文はモジュールごとのファイルに分かれている。作業では、該当するモジュールのファイルだけを読むこと。開発資料への反映（更新）も、該当するモジュールのファイルに対して行うこと。** 新しいモジュールの項目を追加するときは、`_doc/arch/` に同じ形式のファイルを作り、下の一覧に1行追加する。

| モジュール | ファイル |
| --- | --- |
| `index.html` | `_doc/arch/01_index_html.md` |
〜（表の残り14行）
```

### 【検証】（機械的に確認し、結果をRESに記すこと）
1. 15ファイルを表の順に連結したバイト列が、作業前（`git show HEAD:PROJECT_ARCHITECTURE.md`）の138行目からファイル末尾までのバイト列と完全に一致すること。
2. 作業後の `PROJECT_ARCHITECTURE.md` の1〜137行目のバイト列が、作業前の1〜137行目と完全に一致すること。

## 【対象ファイル】
* `PROJECT_ARCHITECTURE.md`（更新：4章本文を索引に置き換え）
* `_doc/arch/` 配下の15ファイル（新規）
* `_log/res/YYMMDD_HHMM_RES_Interrupt_Architecture_Split.md`（新規）

## 【関連する責務】
* 該当なし（ソースコードの責務には関与しない。資料の配置のみの変更）

## 【絶対遵守ルール (Constraints)】
* **本文不変** : 分割した本文の言い回し・表記・空白・改行は一切変えない（簡潔化は本Interruptの範囲外）。
* **対象外ファイルの不変** : 上記【対象ファイル】以外（ワークフロー・テンプレート・スキル・エージェント定義・ソースコード等）は変更しない。
* **開発資料の書き換えの例外** : 本REQは開発資料の配置替えそのものを目的とするため、`PROJECT_ARCHITECTURE.md` の上記の書き換えに限り、実装AIが行ってよい。
